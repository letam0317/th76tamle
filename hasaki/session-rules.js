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
 *  ngoài giờ làm việc. Mặc định CHẶN trong 07:45–18:00 (giờ máy = giờ VN) — LIỀN MẠCH,
 *  không chừa giờ trưa nữa: 22/07/2026 tick 12:05 re-login "khung trưa an toàn" đã đá
 *  operator đang làm việc xuyên trưa. Re-login giờ chỉ còn sáng sớm (<07:45, trước giờ
 *  làm) và chiều tối (≥18:00) — tick watchdog 18:05 là lượt vét cuối ngày.
 *  Trong giờ chặn → ném DeferError → script exit 75 ("hoãn") → sync-guard tự thử lại
 *  ở tick sau / khung kế tiếp.
 *
 *  Override qua .env:
 *   SAFE_RELOGIN_BLOCKS="07:45-18:00"   — đổi khung CHẶN (rỗng = "" thì không chặn gì)
 *   EP_RELOGIN=1                         — bỏ qua luật 2 (chạy tay/khẩn cấp)
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { docTokenCu, luuToken } from "./token-store.js";

export const DEFER_EXIT = 75;   // exit code "hoãn — không phải lỗi, sẽ thử lại sau"

/* ================== BỔ SUNG 26/07/2026 — NHỊP PHÂN TẦNG (sync-poller) ==================
 * Các bộ sync giờ chạy nhịp 15-30' (poller) thay vì 1 lần/ngày → ghi đè cả tab Sheet khi
 * dữ liệu KHÔNG đổi là phí GAS (~10-15s/tab/lượt) và phình revision history vô ích.
 * hashTab + tabKhongDoi/luuHashTab: so payload với lần ghi thành công trước (.sheet-hash.json)
 * — giống thì BỎ QUA ghi. Hash chỉ lưu SAU khi ghi trọn vẹn (ghi dở không được tính). */
const HASH_FILE = ".sheet-hash.json";
export function hashTab(header, rows) { return crypto.createHash("sha1").update(JSON.stringify([header, rows])).digest("hex"); }
function docHashFile(DIR) { try { return JSON.parse(fs.readFileSync(path.join(DIR, HASH_FILE), "utf8")); } catch { return {}; } }
export function tabKhongDoi(DIR, tab, hash) { return docHashFile(DIR)[tab] === hash; }
export function luuHashTab(DIR, tab, hash) { try { const o = docHashFile(DIR); o[tab] = hash; fs.writeFileSync(path.join(DIR, HASH_FILE), JSON.stringify(o)); } catch { /* best-effort — thiếu hash chỉ tốn 1 lượt ghi thừa */ } }

/* Hash-skip nhưng chip "cập nhật lúc" trên dashboard VẪN phải chạy theo giờ KIỂM TRA thật
 * (yêu cầu 26/07: mỗi lần kéo lại từ WMS/work/planogram là giờ hiển thị ở cả 2 dự án phải mới).
 * chamMocTabs: POST action touchTabs (chỉ set LAST_SYNC_<tab>, không ghi dữ liệu, ~1s GAS).
 * BẮT BUỘC probe caps trước khi POST action mới: GAS bản cũ gặp action lạ sẽ rơi vào nhánh
 * appendRow mặc định và ghi rác vào sheet 5S. Cache kết quả probe trong vòng đời process. */
let _touchCap = null;
export async function chamMocTabs(tabs, apiAt, log = () => {}) {
  if (!APPSCRIPT_KEY || !tabs || !tabs.length) return false;
  if (_touchCap == null) {
    try {
      const r = await fetch(APPSCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "caps", key: APPSCRIPT_KEY }) });
      const j = await r.json().catch(() => null);
      _touchCap = !!(j && j.touchTabs);
    } catch { _touchCap = false; }
  }
  if (!_touchCap) return false;   // GAS chưa deploy bản có touchTabs → im lặng bỏ qua (chip giữ mốc cũ như trước)
  try {
    const r = await fetch(APPSCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "touchTabs", key: APPSCRIPT_KEY, tabs, apiAt: apiAt || Date.now() }) });
    const j = await r.json().catch(() => null);
    if (j && j.status === "success") { log("  ✓ Chạm mốc giờ " + tabs.join(", ") + " (dữ liệu không đổi, chip vẫn chạy)."); return true; }
  } catch { /* best-effort — hụt 1 lần chạm chỉ làm chip cũ hơn vài chục phút */ }
  return false;
}

/* ================== VÁ 25/07/2026 (sự cố 24/07: kiểm kê trơ dữ liệu cũ 3 tiếng) ==================
 * 1) fetchThuLai: 1 lần "fetch failed" giữa ~150 trang physical-count từng giết cả bước kiemke.
 *    Mọi fetch dữ liệu/ghi GAS trong cụm tồn kho phải đi qua đây (thử lại 4 lượt, backoff 2s→6s→18s).
 * 2) Mốc THÀNH CÔNG TỪNG BƯỚC (.sync-ok-<bước>): guard trước chỉ nhìn Metadata!B1 (do riêng
 *    sync-stocklocation ghi) nên kiemke/tonbatthuong chết mà vẫn tưởng "đã mới". Mỗi script chạm
 *    file mốc khi xong; guard lấy mốc CŨ NHẤT trong CAC_BUOC_SYNC để kết luận và chạy vá.
 *    SYNC_SKIP_FRESH=1 (guard đặt khi chạy vá, KHÔNG đặt khi --force): bước đã tươi hôm nay
 *    tự thoát sớm — chỉ bước còn cũ phải chạy lại, khỏi kéo trùng cả cụm ~25 phút.
 * ================================================================================================ */
export async function fetchThuLai(url, opt, lan = 4) {
  let loiCuoi = null;
  for (let i = 0; i < lan; i++) {
    try {
      const r = await fetch(url, opt);
      if ((r.status >= 500 || r.status === 429) && i < lan - 1) { await new Promise((s) => setTimeout(s, 2000 * 3 ** i)); continue; }
      return r;
    } catch (e) { loiCuoi = e; if (i < lan - 1) await new Promise((s) => setTimeout(s, 2000 * 3 ** i)); }
  }
  throw loiCuoi || new Error("fetch failed");
}

export const CAC_BUOC_SYNC = ["stocklocation", "kiemke", "tonbatthuong", "vesinh"];
export function ghiMocBuoc(DIR, buoc) { try { fs.writeFileSync(path.join(DIR, ".sync-ok-" + buoc), new Date().toISOString()); } catch { /* mốc best-effort, không chặn luồng chính */ } }
export function docMocBuoc(DIR, buoc) { try { return fs.statSync(path.join(DIR, ".sync-ok-" + buoc)).mtimeMs; } catch { return 0; } }

/** true = bước đã xong sau 08:40 hôm nay và đây là lượt guard chạy VÁ (SYNC_SKIP_FRESH=1) → thoát sớm. */
export function boQuaNeuDaTuoi(DIR, buoc, log = () => {}) {
  if (String(process.env.SYNC_SKIP_FRESH || "") !== "1") return false;
  const t = docMocBuoc(DIR, buoc);
  const now = new Date();
  const nguong = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 40, 0).getTime();
  if (t < nguong) return false;
  log("✓ Bước '" + buoc + "' đã tươi hôm nay (" + new Date(t).toLocaleString("vi-VN") + ") — bỏ qua, nhường lượt cho bước còn cũ.");
  return true;
}

export class DeferError extends Error {
  constructor(msg) { super(msg); this.defer = true; }
}

const APPSCRIPT_URL = process.env.APPSCRIPT_URL || "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
const APPSCRIPT_KEY = process.env.APPSCRIPT_KEY;
const GET_ME = "https://wms-gw.inshasaki.com/api/v1/auth/user/get-me";

/* ---- Khung giờ CHẶN re-login (phút kể từ 00:00). Mặc định: 2 ca làm việc. ---- */
const BLOCKS_RAW = process.env.SAFE_RELOGIN_BLOCKS != null ? process.env.SAFE_RELOGIN_BLOCKS : "07:45-18:00";
const phut = (s) => { const m = String(s).trim().match(/^(\d{1,2}):(\d{2})$/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const BLOCKS = BLOCKS_RAW.split(",").map((c) => {
  const [a, b] = String(c).split("-");
  const t = phut(a), s = phut(b);
  return t != null && s != null ? [t, s] : null;
}).filter(Boolean);

/* Phút-trong-ngày theo GIỜ VN THẬT (Asia/Ho_Chi_Minh) — không tin múi giờ máy: luật khung chặn
   mà chạy sai múi giờ là re-login ngay giữa giờ làm = đá phiên operator (rà soát 27/07/2026). */
function phutVN(d = new Date()) {
  const [h, m] = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hour12: false }).format(d).split(":").map(Number);
  return h * 60 + m;
}

/** true = thời điểm d nằm NGOÀI mọi khung chặn → được phép re-login. */
export function trongKhungAnToan(d = new Date()) {
  const p = phutVN(d);
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

/**
 * BỘ CHỌN TOKEN WMS DÙNG CHUNG — get-me là TRỌNG TÀI DUY NHẤT, không vứt token theo tuổi
 * (cải tiến 22/07/2026: luật tuổi 40' của kho + 30' của GAS từng vứt token còn sống cả ngày,
 * ép re-login vô ích = đá phiên). Thứ tự: (1) token trong kho BẤT KỂ tuổi → get-me;
 * (2) token bridge từ GAS (layBridgeToken tự get-me) → nạp lại vào kho.
 * Trả "Bearer <jwt>" hoặc null. KHÔNG bao giờ tự re-login — đó là việc của caller (luật 2).
 */
export async function layTokenSongWms(DIR, log = () => {}) {
  const cu = docTokenCu(DIR, "wms");
  if (cu && cu.token) {
    const me = await fetch(GET_ME, { headers: { authorization: cu.token } }).catch(() => null);
    if (me && me.ok) {
      log("  ✓ Dùng lại token trong kho (lưu " + new Date(cu.at || 0).toLocaleString("vi-VN") + ", get-me OK — không đăng nhập mới, không đá ai).");
      return cu.token;
    }
    log("  … token kho đã chết (get-me " + (me ? me.status : "lỗi mạng") + ") — thử kênh bridge.");
  }
  const bridge = await layBridgeToken(log);
  if (bridge) { luuToken(DIR, "wms", bridge); return bridge; }
  return null;
}

/** Exit theo đúng bản chất lỗi: hoãn (75) hay lỗi thật (mã tuỳ caller, mặc định 2). */
export function thoatTheoLoi(e, log = () => {}, maLoi = 2) {
  log("✗ " + (e && e.message ? e.message : e));
  process.exit(e && e.defer ? DEFER_EXIT : maLoi);
}
