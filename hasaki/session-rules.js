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
 *  ngoài giờ làm việc. Mặc định CHẶN trong 07:00–22:30 (giờ máy = giờ VN) — LIỀN MẠCH,
 *  không chừa giờ trưa nữa: 22/07/2026 tick 12:05 re-login "khung trưa an toàn" đã đá
 *  operator đang làm việc xuyên trưa. Và không chừa buổi tối nữa (sửa 10/08/2026): CA TỐI
 *  LÀM TỚI 22:00, KỂ CẢ CUỐI TUẦN — khung cũ 07:45–18:00 cho bot đăng nhập từ 18:00 là
 *  đá thẳng vào ca tối. Re-login giờ chỉ còn 22:30–07:00, đúng khung chắc chắn không ai làm.
 *  Trong giờ chặn → ném DeferError → script exit 75 ("hoãn") → sync-guard tự thử lại
 *  ở tick sau / khung kế tiếp.
 *
 *  Override qua .env:
 *   SAFE_RELOGIN_BLOCKS="07:00-22:30"   — đổi khung CHẶN (rỗng = "" thì không chặn gì)
 *   EP_RELOGIN=1                         — bỏ qua luật 2 (chạy tay/khẩn cấp)
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { docTokenCu, luuToken, nguonToken } from "./token-store.js";

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

/* ===== ĐỌC 1 TAB CỦA MÌNH QUA GAS readTab (JSONP) — DÙNG CHUNG ===============================
 * Trước 01/08/2026 mỗi bộ sync tự chép lại 2 hàm này (sync-vesinh-all, sync-phancong…): cùng một
 * regex bóc JSONP, cùng một cách nhận biết "Tab không được phục vụ". Sửa một chỗ mà quên chỗ kia là
 * bug âm thầm (bộ này ghi được, bộ kia tưởng GAS chưa deploy) → gom về đây.
 *   docTabGas(tab)     → { header, rows } | null (null = GAS chưa phục vụ tab đó / lỗi mạng)
 *   gasPhucVuTab(tab)  → true/false: CHỐT PII bắt buộc trước khi ghi tab có email/tên NV, vì GAS
 *                        bản cũ (chưa whitelist) sẽ định tuyến tab đó sang SHEET PUBLIC. */
export async function docTabGas(tab) {
  try {
    const r = await fetchThuLai(APPSCRIPT_URL + "?action=readTab&tab=" + encodeURIComponent(tab) + "&callback=cb&_=" + Date.now());
    const txt = await r.text();
    if (/không được phục vụ/i.test(txt)) return null;
    const m = txt.match(/^\s*(?:\/\*\*\/)?cb\(([\s\S]*)\)\s*;?\s*$/);
    if (!m) return null;
    const j = JSON.parse(m[1]);
    return (j && j.status === "success") ? { header: j.header || [], rows: j.rows || [] } : null;
  } catch { return null; }
}
export async function gasPhucVuTab(tab) {
  try {
    const r = await fetchThuLai(APPSCRIPT_URL + "?action=readTab&tab=" + encodeURIComponent(tab) + "&callback=cb");
    return !/không được phục vụ/i.test(await r.text());
  } catch { return false; }   // lỗi mạng → coi như CHƯA sẵn sàng (an toàn: thà không ghi hơn ghi lộ PII)
}

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

/* "5s" thêm 31/07/2026: bộ 5S trước đây đứng NGOÀI cơ chế mốc-bước, nên lượt 8h40 trượt là
 * không ai vá — dữ liệu đóng băng cả ngày (29→31/07) trong khi 4 bước factory vẫn tươi. */
export const CAC_BUOC_SYNC = ["stocklocation", "kiemke", "tonbatthuong", "vesinh", "5s"];
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

/* ---- Khung giờ CHẶN re-login (phút kể từ 00:00). Mặc định: phủ TRỌN giờ có người làm. ----
 * SỬA 10/08/2026: 07:45-18:00 → 07:00-22:30. Luật khung giờ này là đường lùi, chỉ dùng khi kênh
 * wshr CHƯA chứng thực (chưa có mốc `.bridge-wshr-ok`) — tức đúng cảnh MÁY MỚI dựng lần đầu.
 * Ca tối làm tới 22:00 kể cả cuối tuần, nên khung cũ cho phép bot đăng nhập từ 18:00 = đá phiên
 * người đang làm. Nới đầu sáng về 07:00 vì có người tới sớm. */
const BLOCKS_RAW = process.env.SAFE_RELOGIN_BLOCKS != null ? process.env.SAFE_RELOGIN_BLOCKS : "07:00-22:30";
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

/* Bộ nhớ tạm cho cửa kiểm SYNC: `chanReLoginNgoaiKhung` được gọi ngay trước cú bấm SSO, đôi khi
 * trong vòng lặp puppeteer mỗi vài giây — không thể gọi mạng ở đó. `trangThaiPhien` (chạy trước,
 * ở đầu mỗi bộ sync qua `layTokenSongWms`) để lại kết luận ở đây. */
let _verdict = null, _dirCuoi = null;
const VERDICT_HAN_MS = 3 * 60 * 1000;   // kết luận cũ hơn 3' coi như không còn tin được

/**
 * Ném DeferError nếu KHÔNG được phép re-login lúc này (gọi ngay trước khi bấm SSO).
 *
 * HAI CHẾ ĐỘ, tự chuyển:
 *  • Kênh wshr ĐÃ chứng thực (mốc `.bridge-wshr-ok`, xem `kenhWshrDaChungThuc`) → **LUẬT PHIÊN**:
 *    có phiên sống thì cấm; không có phiên nào + đủ cửa im lặng thì CHO login **bất kể mấy giờ**
 *    → đóng lỗ "người đi làm muộn, 8h30–10h dữ liệu đứng im".
 *  • Chưa chứng thực (extension chưa Reload) → **giữ nguyên luật khung giờ cũ**, vì bộ đánh giá
 *    còn mù cổng work/hr, nới ra là tự mở đường đá phiên.
 */
export function chanReLoginNgoaiKhung(log = () => {}, DIR = _dirCuoi) {
  if (String(process.env.EP_RELOGIN || "") === "1") return;

  if (DIR && kenhWshrDaChungThuc(DIR)) {
    const v = _verdict && Date.now() - _verdict.luc < VERDICT_HAN_MS ? _verdict : null;
    if (!v) {   // chưa có kết luận tươi → không đoán, dùng luật giờ cho chắc
      if (duocPhepReLogin()) return;
      log("  ⛔ Chưa có kết luận trạng thái phiên còn tươi — tạm theo luật khung giờ, HOÃN.");
      throw new DeferError("Hoãn re-login: thiếu kết luận trạng thái phiên + đang trong khung chặn " + BLOCKS_RAW + ".");
    }
    if (v.ai !== "khong") {
      log("  ⛔ KHÔNG re-login: " + v.vi + ".");
      throw new DeferError("Hoãn re-login: đang có phiên sống (" + v.ai + ") — không đá phiên đang dùng.");
    }
    if (!v.duocLogin) {
      log("  ⛔ KHÔNG re-login: " + v.vi + ".");
      throw new DeferError("Hoãn re-login: chưa đủ cửa im lặng (" + Math.round(v.cuaMs / 60000) + "').");
    }
    log("  ✓ Được re-login theo LUẬT PHIÊN: " + v.vi + " (không có ai để đá — giờ không còn là rào).");
    return;
  }

  if (duocPhepReLogin()) return;
  log("  ⛔ Phiên WMS hết hạn nhưng đang TRONG GIỜ LÀM VIỆC — không re-login để khỏi đá phiên người đang dùng. HOÃN tới khung an toàn (sync-guard sẽ tự chạy lại).");
  throw new DeferError("Hoãn re-login WMS: đang trong giờ làm việc (khung chặn " + BLOCKS_RAW + "). Guard sẽ thử lại sau.");
}

/* Ghi chú rà soát 30/07/2026 — VÌ SAO KHÔNG cần cửa kiểm cho auto-export / pull-timesheet:
 *  • `auto-export-sync.js` KHÔNG bấm SSO: chỉ mở trang, không có token thì ném lỗi.
 *  • `pull-timesheet.js` CÓ bấm "Đăng nhập với Hasaki SSO" nhưng KHÔNG hề gõ email/mật khẩu/OTP.
 *    Phiên IdP còn sống → chỉ là một vòng SSO im lặng mint token hr mới, KHÔNG tạo phiên IdP mới
 *    nên KHÔNG đá phiên WMS. Phiên IdP đã chết → nó kẹt ở trang IdP, hết 25s rồi ném lỗi.
 *  ⇒ Cả hai đều leo thang sang `login-hasaki.js --auto`, nơi ĐÃ có cửa kiểm.
 *  Mặt đá phiên thật chỉ gồm: (1) đăng nhập IdP đầy đủ = login-hasaki (đã gác), và (2) SSO vào
 *  ứng dụng WMS = 3 bộ tồn kho (đã gác bằng chanReLoginNgoaiKhung ở trên). */

/* Bản GAS đang deploy đã có kênh bridge chưa? — probe GET công khai ?action=bridgeCaps.
   BẮT BUỘC probe trước khi POST action mới: bản GAS cũ gặp action lạ sẽ rơi vào nhánh
   appendRow mặc định và ghi rác vào sheet 5S. Cache kết quả trong vòng đời process. */
let _bridgeCap = null;
async function docBridgeCaps() {
  if (_bridgeCap != null) return _bridgeCap;
  try {
    const r = await fetch(APPSCRIPT_URL + "?action=bridgeCaps", { redirect: "follow" });
    const j = await r.json().catch(() => null);
    _bridgeCap = { wms: !!(j && j.bridgeToken), wshr: !!(j && j.bridgeWshr) };
  } catch { _bridgeCap = { wms: false, wshr: false }; }
  return _bridgeCap;
}
async function coBridgeCap() { return (await docBridgeCaps()).wms; }

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
  _dirCuoi = DIR;
  const cu = docTokenCu(DIR, "wms");
  if (cu && cu.token) {
    const me = await fetch(GET_ME, { headers: { authorization: cu.token } }).catch(() => null);
    if (me && me.ok) {
      log("  ✓ Dùng lại token trong kho (lưu " + new Date(cu.at || 0).toLocaleString("vi-VN") + ", get-me OK — không đăng nhập mới, không đá ai).");
      return cu.token;
    }
    if (!me) {   // KHÔNG có phản hồi = lỗi mạng, KHÔNG phải bằng chứng token chết (xem ghi chú ở layTokenSongWork)
      log("  ⚠ Không gọi được get-me (lỗi mạng) — GIỮ token trong kho, không tụt xuống bridge.");
      return cu.token;
    }
    log("  … token kho đã chết (get-me " + me.status + ") — thử kênh bridge.");
  }
  const bridge = await layBridgeToken(log);
  if (bridge) { luuToken(DIR, "wms", bridge, "bridge"); chamMocBridge(DIR); return bridge; }
  // KHÔNG có token sống → caller sắp cân nhắc re-login. Nạp sẵn kết luận trạng thái phiên cho
  // `chanReLoginNgoaiKhung` (hàm sync, gọi trong vòng lặp puppeteer nên không thể tự đi hỏi mạng).
  await trangThaiPhien(DIR, log).catch(() => null);
  return null;
}

/* ============ LUẬT PHIÊN THEO SỰ CÓ MẶT (Phần F, 30/07/2026) ============
 * Thay luật khung giờ 07:45–18:00 bằng MỘT câu:
 *   "Bot login chỉ gây hại khi ĐANG CÓ phiên sống để đá. Không có phiên sống ⇒ không có ai
 *    để đá ⇒ login an toàn, BẤT KỂ mấy giờ."
 * Nhờ vậy bài toán "đi làm sớm/muộn" tan biến — không còn mốc giờ nào để sai.
 *
 * ĐO IM LẶNG BẰNG MỐC CỤC BỘ, không chờ deploy GAS: `apiGetBridgeToken` hiện GIẤU tuổi khi
 * token đã cũ (trả token:'' , at:0) nên không thể tính im lặng từ GAS. Máy trạm là DUY NHẤT
 * (lease RUNNER) nên chạm mốc `.bridge-thay-cuoi` mỗi lần thấy bridge còn tươi là đủ.
 * Mốc THIẾU (máy vừa boot) → gieo bằng "bây giờ": buộc chờ đủ một cửa im lặng mới được login,
 * thay vì vừa bật máy đã đi đá phiên người đang làm. */
/**
 * LUẬT 1b (30/07/2026) — token bridge cho **work/hr (wshr)**: extension v1.4.0 nghe thêm
 * `wshr.hasaki.vn`. Dùng cho 2 việc: (a) bộ 5S/chấm công mượn phiên người thật thay vì tự
 * đăng nhập; (b) TÍN HIỆU CÓ NGƯỜI ĐANG LÀM cho `trangThaiPhien` — bịt ca người mở work/hr
 * mà không mở WMS (trước đây bridge im → máy trạm tưởng vắng → đăng nhập đè → đá phiên).
 * FAIL CLOSED: GAS chưa deploy bản có khe wshr (`bridgeCaps.bridgeWshr`) thì trả null —
 * hỏi `kind=wshr` trên GAS cũ sẽ nhận về TOKEN WMS, dùng làm token wshr là sai lặng lẽ.
 * Trọng tài sống/chết của wshr là chính API danh bạ (giống pull-timesheet / login-hasaki).
 */
const WSHR_THU = "https://wshr.hasaki.vn/api/news/staff/search-for-dropdown?limit=1";
export async function layBridgeTokenWshr(log = () => {}) {
  if (!APPSCRIPT_KEY) return null;
  if (!(await docBridgeCaps()).wshr) return null;
  try {
    const r = await fetch(APPSCRIPT_URL, {
      method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "getBridgeToken", kind: "wshr", key: APPSCRIPT_KEY }),
    });
    const j = await r.json().catch(() => null);
    if (!j || j.status !== "success" || !j.token) return null;
    const tk = "Bearer " + String(j.token).replace(/^Bearer\s+/i, "");
    const thu = await fetch(WSHR_THU, { headers: { authorization: tk } }).catch(() => null);
    if (!thu || !thu.ok) { log("  … token bridge work/hr có nhưng wshr từ chối (" + (thu ? thu.status : "lỗi mạng") + ") — bỏ qua."); return null; }
    log("  ✓ Dùng token BRIDGE work/hr (phiên đang sống của operator — không đăng nhập mới).");
    if (_dirCuoi) chungThucKenhWshr(_dirCuoi);   // lần đầu thấy token wshr THẬT → mở luật phiên (xem dưới)
    return tk;
  } catch { return null; }
}

/**
 * BỘ CHỌN TOKEN work/hr — BẢN SONG SINH của `layTokenSongWms` cho cổng wshr (31/07/2026).
 * Cùng một luật: kho BẤT KỂ tuổi → API danh bạ là TRỌNG TÀI (không vứt token theo tuổi) →
 * bridge work/hr. Trả token hoặc null; KHÔNG bao giờ tự re-login (việc đó của caller).
 * Nhờ hàm này bộ 5S mới có "đường lùi không cần đăng nhập" y như factory, và mới chạy được
 * trong nhịp poller (nơi tuyệt đối cấm login).
 */
/* VÁ 10/08/2026 — "token tốt bị token cũ của bridge đè".
 * Sáng nay kho đang giữ token mint 09:30 (hạn 12/08) mà đến trưa lại thành token mint 08/08
 * (hạn 12:41 hôm nay) rồi hết hạn giữa buổi ⇒ mất phiên, mọi bộ đọc đứng hình.
 * Cơ chế: một lượt `fetch` TRƯỢT VÌ MẠNG trả `null`, code cũ gộp chung với "token bị từ chối"
 * → tụt xuống kênh bridge → `luuToken` ghi đè token cũ hơn (kênh bridge có lúc còn giữ token
 * của phiên trước) lên token tốt. Từ nay: KHÔNG có phản hồi HTTP thì KHÔNG kết luận token chết —
 * giữ nguyên token trong kho. Chỉ khi máy chủ THỰC SỰ từ chối (401/403/500 "Token has expired")
 * mới đi tìm token khác. */
export async function layTokenSongWork(DIR, log = () => {}) {
  _dirCuoi = DIR;
  const cu = docTokenCu(DIR, "work");
  if (cu && cu.token) {
    const thu = await fetch(WSHR_THU, { headers: { authorization: cu.token } }).catch(() => null);
    if (thu && thu.ok) {
      log("  ✓ Dùng lại token work trong kho (lưu " + new Date(cu.at || 0).toLocaleString("vi-VN") + ", wshr OK — không đăng nhập mới).");
      return cu.token;
    }
    if (!thu) {
      log("  ⚠ Không gọi được wshr (lỗi mạng) — GIỮ token work trong kho, không tụt xuống bridge.");
      return cu.token;
    }
    log("  … token work trong kho đã chết (wshr " + thu.status + ") — thử kênh bridge.");
  }
  const bridge = await layBridgeTokenWshr(log);
  if (bridge) { luuToken(DIR, "work", bridge, "bridge"); chamMocBridge(DIR); return bridge; }
  return null;
}

/* ---- KHOÁ TỰ ĐỘNG cho luật phiên (30/07/2026) ------------------------------------------
 * Luật "chỉ login khi không có phiên sống" chỉ AN TOÀN khi bộ đánh giá thấy được CẢ HAI cổng.
 * Trước khi extension v1.4.0 được Reload, cổng work/hr là điểm mù: người làm trên work/hr mà
 * không mở WMS ⇒ bridge WMS im ⇒ tưởng vắng ⇒ login đè ⇒ đá phiên.
 * Nên: luật mới TỰ BẬT đúng lúc kênh wshr chứng thực (lần đầu lấy được token wshr THẬT, ghi mốc
 * `.bridge-wshr-ok`). Chưa chứng thực → giữ NGUYÊN luật khung giờ cũ. Không cần ai bật cờ tay,
 * và không có cửa sổ nào chạy bằng luật mới mà lại đang mù. */
const MOC_WSHR_OK = ".bridge-wshr-ok";
export function chungThucKenhWshr(DIR) {
  try { const f = path.join(DIR, MOC_WSHR_OK); if (!fs.existsSync(f)) fs.writeFileSync(f, new Date().toISOString()); } catch { /* best-effort */ }
}
export function kenhWshrDaChungThuc(DIR) { try { return fs.existsSync(path.join(DIR, MOC_WSHR_OK)); } catch { return false; } }

const MOC_BRIDGE = ".bridge-thay-cuoi";
export function chamMocBridge(DIR) { try { fs.writeFileSync(path.join(DIR, MOC_BRIDGE), new Date().toISOString()); } catch { /* best-effort */ } }
export function imLangBridgeMs(DIR) {
  const f = path.join(DIR, MOC_BRIDGE);
  try { return Date.now() - fs.statSync(f).mtimeMs; } catch { chamMocBridge(DIR); return 0; }
}

/** Cửa im lặng theo khung giờ — giờ chỉ là GỢI Ý MỀM (đệm quanh giờ người tới), không phải rào cứng.
 *
 * SỬA 10/08/2026 — CA TỐI CHẠY TỚI 22:00, KỂ CẢ CUỐI TUẦN.
 * Bản cũ hạ cửa xuống 5' ngay từ 17:30 vì tưởng sau giờ hành chính là không còn ai. Sai:
 * ca tối làm tới 22:00 và có cả thứ 7/CN ⇒ từ 17:30 bot chỉ cần thấy im 5 phút là được
 * đăng nhập, tức đá thẳng vào phiên của người đang làm ca tối. Đây là lỗ đá phiên thật.
 * Nay ô 15' kéo dài tới 22:30 (lượt vét 22:02 rơi vào ô này — đúng lúc người vừa rời,
 * cần đệm rộng), chỉ 22:30–07:00 mới hạ về 5'. KHÔNG có ưu đãi cuối tuần. */
export function cuaImLangMs(d = new Date()) {
  const p = phutVN(d);
  if (p >= 7 * 60 && p < 9 * 60 + 30) return Number(process.env.CUA_IM_SANG || 25) * 60000;   // vùng đi sớm/muộn: nới rộng
  if (p >= 9 * 60 + 30 && p < 22 * 60 + 30) return Number(process.env.CUA_IM_NGAY || 15) * 60000;  // cả ca ngày LẪN ca tối
  return Number(process.env.CUA_IM_DEM || 5) * 60000;                                          // 22:30–07:00: chắc chắn trống
}

/**
 * Ai đang giữ phiên WMS? — cửa an toàn DUY NHẤT của luật trên.
 *  { ai: "nguoi" | "bot" | "khong" | "khongro", imLangMs, cuaMs, duocLogin, vi }
 *   nguoi  = có phiên NGƯỜI THẬT đang sống → TUYỆT ĐỐI không login.
 *   bot    = token còn sống nhưng của chính bot → không cần login lại.
 *   khong  = không phiên nào sống → được login KHI đã đủ cửa im lặng.
 *   khongro= không kết luận được (mất mạng/GAS) → KHÔNG dùng làm cớ để login.
 */
export async function trangThaiPhien(DIR, log = () => {}) {
  _dirCuoi = DIR;
  const cuaMs = cuaImLangMs();
  const imLangMs = imLangBridgeMs(DIR);
  const goi = (ai, vi, duoc) => {
    const kq = { ai, imLangMs, cuaMs, duocLogin: duoc, vi };
    _verdict = { ...kq, luc: Date.now() };   // cache cho chanReLoginNgoaiKhung (hàm SYNC, không gọi mạng được)
    return kq;
  };

  // 1) Bridge còn tươi? = người thật đang làm (extension chỉ đẩy token ĐÃ xác thực).
  //    Xét CẢ HAI cổng: người có thể đang làm trên work/hr mà không mở WMS.
  const bridge = await layBridgeToken(log).catch(() => null);
  if (bridge) { chamMocBridge(DIR); return goi("nguoi", "bridge WMS còn tươi — có người đang làm", false); }
  const bridgeWshr = await layBridgeTokenWshr(log).catch(() => null);
  if (bridgeWshr) { chamMocBridge(DIR); return goi("nguoi", "bridge work/hr còn tươi — có người đang làm (dù không mở WMS)", false); }

  // 2) Token trong kho còn sống? get-me là trọng tài; nhãn nguon cho biết của ai.
  const cu = docTokenCu(DIR, "wms");
  if (cu && cu.token) {
    const me = await fetch(GET_ME, { headers: { authorization: cu.token } }).catch(() => null);
    if (me && me.ok) {
      const ng = nguonToken(DIR, "wms");
      if (ng === "bridge") { chamMocBridge(DIR); return goi("nguoi", "token kho còn sống và là của phiên NGƯỜI (nguon=bridge)", false); }
      if (ng === "bot") return goi("bot", "token kho còn sống, của chính bot", false);
      // Token cũ chưa có nhãn (lưu trước bản này): còn sống thì cứ dùng, KHÔNG login — an toàn hơn.
      return goi("khongro", "token kho còn sống nhưng KHÔNG có nhãn nguồn — không login, cứ dùng token này", false);
    }
    if (!me) return goi("khongro", "không gọi được get-me (mất mạng?) — không kết luận, KHÔNG login", false);
  }

  // 3) Không phiên nào sống → được login khi đã im lặng đủ lâu.
  const du = imLangMs >= cuaMs;
  return goi("khong", du
    ? "không phiên nào sống, bridge đã im " + Math.round(imLangMs / 60000) + "' ≥ cửa " + Math.round(cuaMs / 60000) + "' — ĐƯỢC login"
    : "không phiên nào sống nhưng bridge mới im " + Math.round(imLangMs / 60000) + "' < cửa " + Math.round(cuaMs / 60000) + "' — chờ thêm", du);
}

/** Exit theo đúng bản chất lỗi: hoãn (75) hay lỗi thật (mã tuỳ caller, mặc định 2). */
export function thoatTheoLoi(e, log = () => {}, maLoi = 2) {
  log("✗ " + (e && e.message ? e.message : e));
  process.exit(e && e.defer ? DEFER_EXIT : maLoi);
}
