/**
 * session-rules.js — LUẬT PHIÊN WMS DÙNG CHUNG cho các bộ đồng bộ tồn kho
 * (sync-stocklocation / sync-tonbatthuong / push-pc-to-sheet / sync-guard).
 *
 *  BỐI CẢNH (sự cố 21/07/2026): WMS chỉ cho 1 PHIÊN/tài khoản. Bot re-login SSO
 *  = "đăng nhập thiết bị này, đăng xuất thiết bị kia" → NGƯỜI ĐANG LÀM VIỆC bị văng.
 *  Người đăng nhập lại → token bot chết → bước sync sau re-login tiếp → văng tiếp
 *  (vòng giằng co). Từ nay mọi lượt re-login phải qua 2 luật dưới.
 *
 *  LUẬT 1 — TOKEN BRIDGE TRƯỚC: extension wms-bridge "nghe" token phiên ĐANG SỐNG
 *  của operator và đẩy lên GAS (action bridgeToken). Khi cần token mới, bot LẤY LẠI
 *  token đó (action getBridgeToken, cần SECRET) → dùng chung phiên người đang làm
 *  → KHÔNG tạo phiên mới, KHÔNG đá ai, chạy được cả trong giờ làm việc.
 *
 *  LUẬT 2 — KHUNG GIỜ AN TOÀN: không có token nào sống thì CHỈ được ép re-login SSO
 *  ngoài giờ làm việc. Mặc định CHẶN trong 07:45–11:45 và 13:00–17:30 (giờ máy = giờ VN).
 *  Trong giờ chặn → ném DeferError → script exit 75 ("hoãn") → sync-guard tự thử lại
 *  ở tick sau / khung kế tiếp.
 *
 *  Override qua .env:
 *   SAFE_RELOGIN_BLOCKS="07:45-11:45,13:00-17:30"   — đổi khung CHẶN (rỗng = "" thì không chặn gì)
 *   EP_RELOGIN=1                                     — bỏ qua luật 2 (chạy tay/khẩn cấp)
 */
import "dotenv/config";

export const DEFER_EXIT = 75;   // exit code "hoãn — không phải lỗi, sẽ thử lại sau"

export class DeferError extends Error {
  constructor(msg) { super(msg); this.defer = true; }
}

const APPSCRIPT_URL = process.env.APPSCRIPT_URL || "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
const APPSCRIPT_KEY = process.env.APPSCRIPT_KEY;
const GET_ME = "https://wms-gw.inshasaki.com/api/v1/auth/user/get-me";

/* ---- Khung giờ CHẶN re-login (phút kể từ 00:00). Mặc định: 2 ca làm việc. ---- */
const BLOCKS_RAW = process.env.SAFE_RELOGIN_BLOCKS != null ? process.env.SAFE_RELOGIN_BLOCKS : "07:45-11:45,13:00-17:30";
const phut = (s) => { const m = String(s).trim().match(/^(\d{1,2}):(\d{2})$/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const BLOCKS = BLOCKS_RAW.split(",").map((c) => {
  const [a, b] = String(c).split("-");
  const t = phut(a), s = phut(b);
  return t != null && s != null ? [t, s] : null;
}).filter(Boolean);

/** true = thời điểm d nằm NGOÀI mọi khung chặn → được phép re-login. */
export function trongKhungAnToan(d = new Date()) {
  const p = d.getHours() * 60 + d.getMinutes();
  return !BLOCKS.some(([a, b]) => p >= a && p < b);
}

/** Luật 2 gộp override: EP_RELOGIN=1 thì luôn cho phép. */
export function duocPhepReLogin(d = new Date()) {
  if (String(process.env.EP_RELOGIN || "") === "1") return true;
  return trongKhungAnToan(d);
}

/** Ném DeferError nếu KHÔNG được phép re-login lúc này (gọi ngay trước khi bấm SSO). */
export function chanReLoginNgoaiKhung(log = () => {}) {
  if (duocPhepReLogin()) return;
  log("  ⛔ Phiên WMS hết hạn nhưng đang TRONG GIỜ LÀM VIỆC — không re-login để khỏi đá phiên người đang dùng. HOÃN tới khung an toàn (sync-guard sẽ tự chạy lại).");
  throw new DeferError("Hoãn re-login WMS: đang trong giờ làm việc (khung chặn " + BLOCKS_RAW + "). Guard sẽ thử lại sau.");
}

/* Bản GAS đang deploy đã có kênh bridge chưa? — probe GET công khai ?action=bridgeCaps.
   BẮT BUỘC probe trước khi POST action mới: bản GAS cũ gặp action lạ sẽ rơi vào nhánh
   appendRow mặc định và ghi rác vào sheet 5S. Cache kết quả trong vòng đời process. */
let _bridgeCap = null;
async function coBridgeCap() {
  if (_bridgeCap != null) return _bridgeCap;
  try {
    const r = await fetch(APPSCRIPT_URL + "?action=bridgeCaps", { redirect: "follow" });
    const j = await r.json().catch(() => null);
    _bridgeCap = !!(j && j.bridgeToken);
  } catch { _bridgeCap = false; }
  return _bridgeCap;
}

/**
 * LUẬT 1: lấy token bridge (phiên đang sống của operator) từ GAS, kiểm get-me trước khi dùng.
 * Trả "Bearer <jwt>" hoặc null (không có / hết hạn / get-me chết). Không bao giờ ném lỗi.
 */
export async function layBridgeToken(log = () => {}) {
  if (!APPSCRIPT_KEY) return null;
  if (!(await coBridgeCap())) return null;   // GAS chưa redeploy bản có bridge → im lặng bỏ qua
  try {
    const r = await fetch(APPSCRIPT_URL, {
      method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "getBridgeToken", key: APPSCRIPT_KEY }),
    });
    const j = await r.json().catch(() => null);
    if (!j || j.status !== "success" || !j.token) return null;
    const tk = "Bearer " + String(j.token).replace(/^Bearer\s+/i, "");
    const me = await fetch(GET_ME, { headers: { authorization: tk } }).catch(() => null);
    if (!me || !me.ok) { log("  … token bridge có nhưng đã chết (get-me " + (me ? me.status : "lỗi mạng") + ") — bỏ qua."); return null; }
    log("  ✓ Dùng token BRIDGE (phiên đang sống của operator — không tạo phiên mới, không đá ai).");
    return tk;
  } catch { return null; }
}

/** Exit theo đúng bản chất lỗi: hoãn (75) hay lỗi thật (mã tuỳ caller, mặc định 2). */
export function thoatTheoLoi(e, log = () => {}, maLoi = 2) {
  log("✗ " + (e && e.message ? e.message : e));
  process.exit(e && e.defer ? DEFER_EXIT : maLoi);
}
