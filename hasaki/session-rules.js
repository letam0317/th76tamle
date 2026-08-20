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
export async function docTabGas(tab, log = () => {}) {
  try {
    // gasGetText: thử lại CHẶNG LẤY NỘI DUNG khi Google trả 404 (script đã chạy xong) — xem gasGoiText_
    const txt = await gasGetText("action=readTab&tab=" + encodeURIComponent(tab) + "&callback=cb&_=" + Date.now(), log, "readTab " + tab);
    if (/không được phục vụ/i.test(txt)) return null;
    const m = txt.match(/^\s*(?:\/\*\*\/)?cb\(([\s\S]*)\)\s*;?\s*$/);
    if (!m) return null;
    const j = JSON.parse(m[1]);
    return (j && j.status === "success") ? { header: j.header || [], rows: j.rows || [] } : null;
  } catch { return null; }
}
/* ===== HÂM CACHE readTab SAU KHI GHI (12/08/2026) =============================================
 * GAS @54 phục vụ readTab từ CacheService: lượt DỰNG cache phải mở sheet private + getValues nên
 * mất 15-100s và hay bị Google trả 404 giữa đường (đo thật 12/08), lượt sau chỉ còn ~2s. Ghi tab
 * nào là cache tab đó bị xoá → nếu để lượt dựng rơi vào NGƯỜI mở dashboard thì cứ sau mỗi lượt
 * sync là một người phải ngồi chờ (đúng sự cố "Chưa có dữ liệu vệ sinh" hôm nay).
 * Đây là chỗ chịu trận thay: bộ sync chạy nền, có fetchThuLai lo thử lại, chậm cũng không ai đợi.
 * Best-effort — hâm hụt thì chỉ mất lợi thế tốc độ, dữ liệu vẫn đúng. */
export async function hamCacheTabs(tabs, log = () => {}) {
  const ds = (tabs || []).filter(Boolean);
  if (!ds.length) return 0;
  let ok = 0;
  for (const tab of ds) {
    const t0 = Date.now();
    /* MỘT lượt là đủ: docTabGas nay đi qua gasGetText, bên trong đã thử lại 4 lần chặng lấy nội dung
       và tối đa 3 vòng chạy lại script. Bọc thêm vòng lặp ở đây là lồng thử-lại (3 × 12 request),
       một tab hỏng sẽ treo bộ sync hàng phút — đúng cái bẫy đã gặp với fetchThuLai. */
    const j = await docTabGas(tab, log);
    if (j) { ok++; log("  ✓ Hâm cache readTab " + tab + " (" + j.rows.length + " dòng, " + Math.round((Date.now() - t0) / 1000) + "s)."); }
    else log("  ⚠ Hâm cache readTab " + tab + " không xong — người mở dashboard đầu tiên sẽ phải chờ lượt dựng.");
  }
  return ok;
}
/* Trước 12/08/2026 hàm này probe bằng cách GỌI readTab — tức TẢI CẢ TAB (VESINH-YEUCAU 131KB!) chỉ
 * để biết tên tab có trong whitelist hay không, 4 lượt mỗi lần sync. Execution dài chính là thứ khiến
 * Google trả 404 ở khâu lấy nội dung, nên probe kiểu đó tự bơm thêm lỗi cho mình.
 * Nay hỏi `caps.servedTabs` MỘT lần rồi nhớ trong vòng đời process. GAS chưa có trường đó (bản cũ)
 * thì rơi về đường probe readTab như trước — không đổi hành vi. */
let _servedTabs = null;
export async function gasPhucVuTab(tab, log = () => {}) {
  if (_servedTabs === null && APPSCRIPT_KEY) {
    try {
      const j = await gasPost({ action: "caps", key: APPSCRIPT_KEY }, () => {}, "caps");
      _servedTabs = Array.isArray(j && j.servedTabs) ? j.servedTabs : false;
    } catch { _servedTabs = false; }
  }
  if (Array.isArray(_servedTabs)) return _servedTabs.indexOf(tab) >= 0;
  try {
    const txt = await gasGetText("action=readTab&tab=" + encodeURIComponent(tab) + "&callback=cb", log, "probe " + tab);
    return !/không được phục vụ/i.test(txt);
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
      const j = await gasPost({ action: "caps", key: APPSCRIPT_KEY }, () => {}, "caps");
      _touchCap = !!(j && j.touchTabs);
    } catch { _touchCap = false; }
  }
  if (!_touchCap) return false;   // GAS chưa deploy bản có touchTabs → im lặng bỏ qua (chip giữ mốc cũ như trước)
  try {
    const j = await gasPost({ action: "touchTabs", key: APPSCRIPT_KEY, tabs, apiAt: apiAt || Date.now() }, () => {}, "touchTabs");
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
/** Dịch lỗi mạng của undici sang câu người đọc được — dùng chung cho mọi bộ có mặt người
 *  (nút nộp báo cáo, bot tin nhắn). Bẫy 19/08/2026: wshr sau Cloudflare không bắt tay kịp,
 *  `fetch` ném `TypeError: fetch failed` trống trơn, cửa sổ hiện nguyên stack Node. */
export function moTaLoiMang(e) {
  const c = (e && e.cause && e.cause.code) || (e && e.code) || "";
  if (c === "UND_ERR_CONNECT_TIMEOUT") return "máy chủ không bắt tay kịp (mạng chậm, hoặc bị chặn)";
  if (c === "ENOTFOUND" || c === "EAI_AGAIN") return "không phân giải được tên miền (mất mạng / DNS hỏng)";
  if (c === "ECONNRESET" || c === "UND_ERR_SOCKET") return "máy chủ ngắt kết nối giữa chừng";
  if (c === "UND_ERR_HEADERS_TIMEOUT" || c === "UND_ERR_BODY_TIMEOUT") return "máy chủ nhận rồi nhưng không trả lời kịp";
  return (e && e.message) || String(e);
}

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

/* ===== GỌI GAS CHỊU ĐƯỢC 404 CỦA GOOGLE (12/08/2026) =========================================
 * ĐO THẬT ĐỂ TÌM GỐC (đừng suy đoán lại). Một lượt gọi Apps Script luôn có HAI CHẶNG:
 *   chặng 1  GET/POST …/exec  → chạy script, trả 302 kèm header Location
 *   chặng 2  GET script.googleusercontent.com/…/echo?user_content_key=…  → lấy nội dung
 * Đo 12/08 trên cùng một URL:
 *   lượt 1: chặng1 302 (4,0s) → chặng2 200 (0,5s) 127.837 byte
 *   lượt 2: chặng1 302 (11,8s) → chặng2 404 (46,5s) → 404 (16,4s) → 200 (9,3s) CÙNG 127.837 byte
 * → 404 KHÔNG phải script lỗi: SCRIPT ĐÃ CHẠY XONG, chỉ khâu lấy nội dung hỏng; thử lại chặng 2 là
 *   nhận được ĐÚNG kết quả đã tính, không chạy lại gì. Đây cũng là lý do 15:17 hôm nay bộ sync báo
 *   "ghi lỗi" trong khi Sheet thực ra đã được ghi.
 * VÌ THẾ:
 *   · Thử lại CHẶNG 2 trước — rẻ, không chạy lại script, không ghi trùng. Cắt timeout 25s để không
 *     nằm chờ 46s như lượt đo được.
 *   · Hết đường mới chạy lại chặng 1, và luôn kèm NONCE để GAS nhận ra "lượt thử lại của cùng một
 *     nội dung" mà trả lại phản hồi cũ thay vì ghi/gửi mail lần nữa (xem doPost trong
 *     google-script.gs). Nhờ nonce, thử lại an toàn cả với ghi append và action gửi mail.
 * KHÔNG nới fetchThuLai để thử lại 404 chung: 404 ở endpoint khác (WMS/wshr) là 404 thật. */
const GAS_TIMEOUT_CHANG1 = 120000;   // chạy script: lượt phải mở Sheet có thể tới ~60s
const GAS_TIMEOUT_CHANG2 = 25000;    // lấy nội dung: khoẻ thì 0,5-9,3s; quá 25s là đang hỏng
const GAS_CHANG2_LAN = 4;            // thử lại chặng 2 (rẻ)
const GAS_CHANG1_LAN = 3;            // chạy lại script (đắt) — chỉ khi chặng 2 chịu thua

function laTrangLoi_(txt) { return /^\s*<(!doctype|html)/i.test(txt || ""); }

/** Gọi GAS, trả về TEXT thân phản hồi. Ném lỗi nếu cả 3 vòng đều không lấy được nội dung. */
async function gasGoiText_(url, init, log = () => {}, nhan = "GAS") {
  let loiCuoi = null;
  for (let v = 0; v < GAS_CHANG1_LAN; v++) {
    let loc = null;
    try {
      const r1 = await fetch(url, { ...init, redirect: "manual", signal: AbortSignal.timeout(GAS_TIMEOUT_CHANG1) });
      if (r1.status >= 200 && r1.status < 300) {           // không redirect (ít gặp) → nội dung ngay đây
        const txt = await r1.text();
        if (txt && !laTrangLoi_(txt)) return txt;
        loiCuoi = new Error(nhan + ": chặng 1 trả " + r1.status + " kèm trang lỗi");
      } else {
        loc = r1.headers.get("location");
        if (!loc) loiCuoi = new Error(nhan + ": chặng 1 trả " + r1.status + " mà không có Location");
      }
    } catch (e) { loiCuoi = e; }

    if (loc) {
      for (let k = 0; k < GAS_CHANG2_LAN; k++) {
        try {
          const r2 = await fetch(loc, { signal: AbortSignal.timeout(GAS_TIMEOUT_CHANG2) });
          const txt = await r2.text();
          if (r2.ok && txt && !laTrangLoi_(txt)) return txt;
          loiCuoi = new Error(nhan + ": chặng 2 trả " + r2.status + (laTrangLoi_(txt) ? " (trang HTML lỗi)" : ""));
        } catch (e) { loiCuoi = e; }
        if (k < GAS_CHANG2_LAN - 1) {
          log("  ⚠ " + nhan + ": Google chưa trả được nội dung (script ĐÃ chạy) — lấy lại lượt " + (k + 2) + "/" + GAS_CHANG2_LAN + "…");
          await new Promise((s) => setTimeout(s, 1500 * (k + 1)));
        }
      }
    }
    if (v < GAS_CHANG1_LAN - 1) {
      log("  ⚠ " + nhan + ": không lấy được nội dung — chạy lại lượt " + (v + 2) + "/" + GAS_CHANG1_LAN + " (có nonce, không ghi trùng)…");
      await new Promise((s) => setTimeout(s, 3000 * (v + 1)));
    }
  }
  throw loiCuoi || new Error(nhan + ": không lấy được phản hồi");
}

/** POST lên GAS → trả object JSON. body: chuỗi JSON hoặc object. Tự chèn nonce để thử lại an toàn. */
export async function gasPost(body, log = () => {}, nhan = "GAS POST") {
  let chuoi = typeof body === "string" ? body : JSON.stringify(body);
  try {   // nonce GIỮ NGUYÊN qua mọi lượt thử lại của cùng nội dung này
    const o = JSON.parse(chuoi);
    if (o && typeof o === "object" && !o.nonce) { o.nonce = crypto.randomUUID(); chuoi = JSON.stringify(o); }
  } catch { /* body không phải JSON → gửi y nguyên, chỉ mất lợi thế nonce */ }
  const txt = await gasGoiText_(APPSCRIPT_URL, {
    method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: chuoi,
  }, log, nhan);
  try { return JSON.parse(txt); }
  catch { throw new Error(nhan + ": phản hồi không phải JSON: " + txt.slice(0, 80).replace(/\s+/g, " ")); }
}

/** GET GAS (action đọc — JSONP hoặc JSON) → trả TEXT. query: "action=readTab&tab=…" */
export async function gasGetText(query, log = () => {}, nhan = "GAS GET") {
  const url = APPSCRIPT_URL + (query.startsWith("?") ? query : "?" + query);
  return gasGoiText_(url, { method: "GET" }, log, nhan);
}

/* "5s" thêm 31/07/2026: bộ 5S trước đây đứng NGOÀI cơ chế mốc-bước, nên lượt 8h40 trượt là
 * không ai vá — dữ liệu đóng băng cả ngày (29→31/07) trong khi 4 bước factory vẫn tươi. */
export const CAC_BUOC_SYNC = ["stocklocation", "kiemke", "tonbatthuong", "vesinh", "5s"];
export function ghiMocBuoc(DIR, buoc) { try { fs.writeFileSync(path.join(DIR, ".sync-ok-" + buoc), new Date().toISOString()); } catch { /* mốc best-effort, không chặn luồng chính */ } }
export function docMocBuoc(DIR, buoc) { try { return fs.statSync(path.join(DIR, ".sync-ok-" + buoc)).mtimeMs; } catch { return 0; } }

/* Ngưỡng TRỄ dùng CHUNG với sync-guard.js và canh-suc-khoe.js — sửa 1 chỗ là cả 3 tầng theo. */
const NGUONG_TRE_MS = Number(process.env.CANH_TRE_PHUT || 90) * 60000;

/** true = bước còn tươi (trễ < ngưỡng 90') và đây là lượt guard chạy VÁ (SYNC_SKIP_FRESH=1) → thoát sớm.
 *
 * VÁ 15/08/2026 — sự cố chiều 14/08 (planogram đóng băng ở 15:38 tới hết ngày). Bản cũ định nghĩa
 * "tươi" = `mốc ≥ 08:40 hôm nay`, trong khi guard từ 12/08 đã kích hoạt theo `trễ > 90'`. Hai luật
 * lệch nhau ⇒ chiều 14/08 guard bắt đúng bệnh ("mốc cũ nhất 151' > ngưỡng 90'"), giành đúng ba lượt
 * ĐƯỢC login lúc 16:12/16:34/16:56 (không phiên nào sống, cửa im lặng đã qua) — nhưng cụm vừa vào
 * là MỌI bước tự thoát "đã tươi hôm nay" vì mốc của chúng đều sau 08:40. Cụm chạy 29 giây, không
 * kéo gì, guard in "✓ XONG". Ba cửa sổ login cuối cùng của ngày bị tiêu phí; tới 17:10 bridge
 * work/hr sống lại ⇒ luật phiên cấm login ⇒ dữ liệu đứng luôn tới lúc tắt máy.
 * Nay bước chỉ tự thoát khi CHÍNH NÓ còn tươi theo đúng thước đo mà guard dùng để gọi. */
export function boQuaNeuDaTuoi(DIR, buoc, log = () => {}) {
  if (String(process.env.SYNC_SKIP_FRESH || "") !== "1") return false;
  const t = docMocBuoc(DIR, buoc);
  const tre = Date.now() - t;
  if (!t || tre > NGUONG_TRE_MS) return false;
  log("✓ Bước '" + buoc + "' còn tươi (" + new Date(t).toLocaleString("vi-VN") + ", trễ " + Math.round(tre / 60000)
      + "' < ngưỡng " + Math.round(NGUONG_TRE_MS / 60000) + "') — bỏ qua, nhường lượt cho bước còn cũ.");
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
export function phutVN(d = new Date()) {
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
    // gasGetText: chịu được 404 chặng lấy nội dung — probe này quyết định có dùng token bridge hay không,
    // trượt oan là cả cụm tồn kho bỏ qua token đang sống rồi đi đăng nhập mới (đá phiên người khác).
    const j = JSON.parse(await gasGetText("action=bridgeCaps", () => {}, "bridgeCaps"));
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
    const j = await gasPost({ action: "getBridgeToken", key: APPSCRIPT_KEY }, () => {}, "getBridgeToken").catch(() => null);
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
    const j = await gasPost({ action: "getBridgeToken", kind: "wshr", key: APPSCRIPT_KEY }, () => {}, "getBridgeToken wshr").catch(() => null);
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
