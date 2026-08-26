/**
 * push-pc-to-sheet.mjs — Kéo physical-count THẬT (type-sku + type-location) rồi ghi vào
 *  Google Sheet 1eY_oo… tab kiemke-sku / kiemke-location (đúng tab dashboard đọc).
 *  Ưu tiên token cache (không mở Edge); hết hạn mới đăng nhập lại (đăng xuất WMS ở Edge của bạn).
 *
 *  BỔ SUNG HASAKI (22/07/2026): kéo thêm 2 kho 170 QL1A (warehouse_ids 863,874 — cùng bộ
 *  sync-tonbatthuong) ghi tab kiemke-sku-hasaki / kiemke-location-hasaki trên Sheet 5S
 *  (tab Kiểm kê của portal kiemsoatkho ▸ HASAKI đọc). Luồng Hasaki lỗi KHÔNG làm fail
 *  luồng factory — chỉ cảnh báo, giữ data cũ.
 *
 *  node push-pc-to-sheet.mjs            — lượt FULL (cửa sổ 90 ngày + plan ±45, ~220 call WMS)
 *  PC_DELTA=1 node push-pc-to-sheet.mjs — lượt DELTA (sync-poller): chỉ hôm nay + plan ±1 ngày,
 *      gộp vào cache lượt full gần nhất (.pc-cache.json); cache thiếu/cũ >20h tự nâng thành FULL.
 *
 *  UID GROUP LỆCH (27/07/2026): kéo thêm chi tiết tracking của các PHIẾU LỆCH (diff ≠ 0, factory)
 *  ghi tab kiemke-uidgr — pop-up Lệch âm/Lệch dương trên dashboard thể hiện thẳng UID group nào
 *  lệch, người xem đọc gviz KHÔNG cần token/PC_KEY. Response tracking đã nhúng sẵn UID group
 *  trong exp_by_user/exp_by_sys (JSON [{qty, group_uid_code, date_added?, exp?}]) — không cần
 *  API khác; Batch/Roll/Description KHÔNG có trong API (WMS cũng hiện "—") nên không ghi.
 *  Cache theo (checklist_id | updated_at) trong .pc-cache.json: mỗi phiếu chỉ tốn call WMS 1 lần,
 *  lượt sau chỉ kéo phiếu MỚI/ĐỔI. PC_UIDGR_MAX (mặc định 300 phiếu/lượt) chặn lượt đầu quá dài.
 *
 *  SL ĐẾM THEO SKU (25/08/2026): CÙNG lượt kéo tracking ở trên, phiếu VỊ TRÍ loại
 *  FULL_LOCATION_FACTORY ghi thêm TOÀN BỘ dòng (SKU × vị trí × Quantity Count — kể cả dòng khớp)
 *  vào tab kiemke-qtycount, cho mục "Tra cứu SL đếm theo SKU" ở tab Kiểm kê dashboard (ô gõ SKU
 *  + quét mã vạch). KHÔNG thêm call WMS ở trạng thái ổn định — chỉ lưu thêm cột từ response sẵn
 *  có; phiếu đã nằm cache mà THIẾU khối qc thì kéo bù 1 lần (đợt đầu ~880 phiếu, vẫn tôn trọng
 *  PC_UIDGR_MAX — quá cap thì lượt sau kéo tiếp, tab tự đầy dần).
 *  ⚠ FE tra bằng gviz `tq=select * where F=<sku>` — cột F của tab này PHẢI là SKU;
 *    đổi thứ tự cột HEADER_QTC là phải sửa CẢ hàm qtcTq() trong factory/index.html.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { luuToken, EDGE_PATH, duongDanProfile } from "./token-store.js";
import { chanReLoginNgoaiKhung, layTokenSongWms, thoatTheoLoi, fetchThuLai, ghiMocBuoc, boQuaNeuDaTuoi, hashTab, tabKhongDoi, luuHashTab, chamMocTabs, gasPost } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const APPSCRIPT_URL = process.env.APPSCRIPT_URL || "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
const APPSCRIPT_KEY = process.env.APPSCRIPT_KEY;
const SHEET_ID = "1eY_oo9fAvWCTXp24x-Z0FXq9mp_jJPlTHg09qdemETs";
const GW = "https://wms-gw.inshasaki.com/api/v1/wms/counting-plan/checklists";
const GET_ME = "https://wms-gw.inshasaki.com/api/v1/auth/user/get-me";
const SIZE = 500, CHUNK = 4000;
// Kéo theo khoảng ngày ĐẾM (bỏ lọc kho) rồi giữ cả 2 kho material — MTG + GARMENT.
// KHOẢNG NGÀY ĐỘNG để chạy theo lịch hằng ngày: [hôm nay - PC_TU_NGAY .. hết hôm nay] giờ VN (+07).
// Override khi cần chạy tay: PC_TU_NGAY=180 (số ngày) hoặc PC_FROM_MS / PC_TO_MS (epoch ms tuyệt đối).
const _vn = new Date(Date.now() + 7 * 3600 * 1000);
const _d0 = Date.UTC(_vn.getUTCFullYear(), _vn.getUTCMonth(), _vn.getUTCDate()) - 7 * 3600 * 1000;   // 00:00 hôm nay giờ VN
// ===== CHẾ ĐỘ DELTA (26/07/2026 — nhịp phân tầng sync-poller): PC_DELTA=1 chỉ kéo cửa sổ
// HÔM NAY (đếm hôm nay + plan [hôm qua..ngày mai]) rồi GỘP vào cache của lượt FULL gần nhất
// (.pc-cache.json, khoá checklist_id) trước khi ghi đè tab — WMS chỉ chịu vài trang thay vì
// ~220 call của lượt full. Cache thiếu / cũ >20h → tự NÂNG thành lượt FULL (và tạo cache mới)
// để không bao giờ ghi thiếu dữ liệu cửa sổ 90 ngày lên Sheet.
const PC_CACHE = path.join(DIR, ".pc-cache.json");
let cache = null;
let DELTA = String(process.env.PC_DELTA || "") === "1";
if (DELTA) {
  try { cache = JSON.parse(fs.readFileSync(PC_CACHE, "utf8")); } catch { cache = null; }
  if (!cache || !cache.fullAt || Date.now() - cache.fullAt > 20 * 3600 * 1000) { cache = null; DELTA = false; }
}
const PC_TU_NGAY = Number(process.env.PC_TU_NGAY || 90);
const PARAMS = DELTA ? {
  from_counted_date: String(_d0),
  to_counted_date: String(_d0 + 86400000 - 1),
} : {
  from_counted_date: process.env.PC_FROM_MS || String(_d0 - PC_TU_NGAY * 86400000),
  to_counted_date: process.env.PC_TO_MS || String(_d0 + 86400000 - 1),
};
// PHIẾU CHƯA ĐẾM (PENDING/PROCESSING…) không có counted date -> LỌT LƯỚI bộ lọc from_counted_date
// (sự cố 24/07/2026: plan 243605 có 212 dòng PENDING location kho GARMENT mà dashboard không thấy).
// Kéo BỔ SUNG theo PLAN DATE, giới hạn warehouse_ids cho nhẹ, rồi gộp khử trùng checklist_id.
const PC_PLAN_TU_NGAY = Number(process.env.PC_PLAN_TU_NGAY || 45);    // plan quá khứ: 45 ngày
const PC_PLAN_TOI_NGAY = Number(process.env.PC_PLAN_TOI_NGAY || 45);  // plan tương lai: 45 ngày
const PARAMS_PLAN = DELTA ? {
  from_plan_date: String(_d0 - 86400000),
  to_plan_date: String(_d0 + 2 * 86400000 - 1),
} : {
  from_plan_date: String(_d0 - PC_PLAN_TU_NGAY * 86400000),
  to_plan_date: String(_d0 + PC_PLAN_TOI_NGAY * 86400000 - 1),
};
const WH_IDS_FACTORY = "1177,1339";   // WH - MATERIAL - MTG (1177) + WH - MATERIAL - GARMENT (1339) — id hệ checklists/báo cáo
const chuanKho = (s) => String(s || "").replace(/\s+/g, " ").trim().toUpperCase();
const KEEP = new Set(["WH - MATERIAL - MTG", "WH - MATERIAL - GARMENT"].map(chuanKho));
// HASAKI: kéo RIÊNG theo warehouse_ids (không dựa mặc định company của token) -> ghi sheet 5S
const SHEET_HASAKI = "1FWffWi75aATbokfqIcqjByEPzkJLQBngTXp5aPOIbLM";   // sheet 5S (dashboard kiemsoatkho · công ty HASAKI)
const WH_IDS_HASAKI = "863,874";                                        // SHOP - 170 QUOC LO 1A (863) + WH - 170 QUOC LO 1A (874)
const KEEP_HASAKI = new Set(["SHOP - 170 QUOC LO 1A", "WH - 170 QUOC LO 1A"].map(chuanKho));
const nghi = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);
if (!APPSCRIPT_KEY) { console.error("✗ Thiếu APPSCRIPT_KEY trong .env."); process.exit(3); }

const HEADER_SKU = ["No.", "ID", "Request code", "Source code", "Warehouse", "SKU", "Product Name", "Category", "Type", "Required VAT", "Priority", "Diff By Location", "Diff By Sku", "Inventory", "Quantity Count", "Assign to", "Counted by", "Counted date", "Updated At", "Plan Date", "Status"];
const HEADER_LOC = ["No.", "ID", "Request code", "Source code", "Warehouse", "Type", "Location", "Priority", "Diff", "Assign to", "Counted by", "Counted date", "Updated At", "Plan Date", "Status"];
const HEADER_UIDGR = ["No.", "Kind", "Checklist ID", "Tracking ID", "Request code", "Warehouse", "Type", "Location", "SKU", "Product Name", "Line Qty Count", "Line Inventory", "Line Diff", "Line Status", "UID Group", "Group Status", "Qty Count", "Qty System", "Expiration Date", "Counted date", "Updated At"];
/* Tab kiemke-qtycount — "Tra cứu SL đếm theo SKU": cột F (thứ 6) BẮT BUỘC là SKU (FE tra bằng tq where F). */
const HEADER_QTC = ["No.", "Checklist ID", "Request code", "Warehouse", "Location", "SKU", "Product Name", "Quantity Count", "Inventory", "Diff", "Line Status", "Checklist Status", "Counted by", "Counted date", "Updated At"];
const laQtc = (kind, r) => kind === "loc" && String(r.plan_type || "").toUpperCase().replace(/[^A-Z]+/g, "_").replace(/^_+|_+$/g, "") === "FULL_LOCATION_FACTORY";
const GW_TRACKING = "https://wms-gw.inshasaki.com/api/v1/wms/counting-plan/checklist/tracking";
const UIDGR_MAX = Number(process.env.PC_UIDGR_MAX || 300);   // cap số PHIẾU kéo tracking mỗi lượt (lượt đầu nhiều, sau đó cache gánh)
const UIDGR_V = 5;   // version định dạng dòng trong cache uidgr — đổi cấu trúc thì tăng số này để lượt kế kéo lại toàn bộ (v5: chọn phiếu theo STATUS — API list XOÁ qty_by_user sau khi APPROVED)

async function getTokenLive() {
  // layTokenSongWms (kho + bridge) đã được thử ở caller — tới đây là đường Edge/SSO thuần.
  const puppeteer = (await import("puppeteer")).default;
  const EDGE = EDGE_PATH;
  const PROFILE = duongDanProfile(DIR);
  const browser = await puppeteer.launch({ headless: true, executablePath: EDGE, userDataDir: PROFILE, args: ["--disable-blink-features=AutomationControlled"] });
  try {
    const page = (await browser.pages())[0] || (await browser.newPage());
    let token = null, good = null; const norm = (a) => (/^Bearer /i.test(a) ? a : "Bearer " + a);
    page.on("request", (req) => { const a = req.headers()["authorization"]; if (a && /wms-gw\.inshasaki\.com/.test(req.url())) token = norm(a); });
    await page.goto("https://wms.inshasaki.com/physical-count/result/list?current_tab=sku", { waitUntil: "networkidle2", timeout: 90000 }).catch(() => {});
    let b = 0, x = 0;
    for (let i = 0; i < 90 && !good; i++) {
      const u = page.url();
      if (/auth\/login/.test(u) && Date.now() - b > 5000) { chanReLoginNgoaiKhung(log); const ok = await page.evaluate(() => { const e = [...document.querySelectorAll("button,[role=button],a")].find((z) => /SSO/i.test(z.innerText || "")); if (e) { e.click(); return 1; } }).catch(() => 0); if (ok) { b = Date.now(); log("  → bấm SSO..."); } }
      else if (/sso\/callback/.test(u) && Date.now() - x > 5000) { const t = await page.evaluate(() => { const c = [...document.querySelectorAll("button,[role=button]")].filter((z) => z.offsetParent !== null && !z.disabled); const e = c.find((z) => /đồng ý|dong y|tiếp tục|xác nhận|đăng nhập|^ok$|confirm|yes/i.test((z.innerText || "").trim()) && !/hủy|cancel|đóng|không/i.test((z.innerText || "").trim())); if (e) { e.click(); return (e.innerText || "").trim(); } }).catch(() => null); if (t) { x = Date.now(); log("  → xác nhận thiết bị: " + t); } }
      if (token) { const me = await fetch(GET_ME, { headers: { authorization: token } }).catch(() => null); if (me && me.status === 200) { good = token; break; } }
      await nghi(1000);
    }
    if (!good) throw new Error("Không lấy được token hợp lệ.");
    return good;
  } finally { await browser.close().catch(() => {}); }
}
const qs = (o) => Object.keys(o).map((k) => k + "=" + encodeURIComponent(o[k])).join("&");
const getRecs = (j) => j.records || (j.data && (j.data.records || j.data.rows || j.data.content)) || j.rows || [];

// Token dùng chung cả lượt chạy (module-scope để keoType tự làm tươi khi bị đá giữa chừng)
let token = null;
/* Token bị đá GIỮA CHỪNG (WMS 1 phiên/tài khoản — operator vừa đăng nhập là token bot chết ngay):
   không bỏ cuộc, chờ extension wms-bridge đẩy token phiên MỚI của operator lên GAS (throttle 30s)
   rồi mượn lại qua layTokenSongWms. KHÔNG re-login SSO ở đây (sẽ đá ngược người ta — vòng giằng co). */
async function lamTuoiTokenGiuaChung() {
  for (let i = 1; i <= 4; i++) {
    await nghi(20000 * i);   // 20s → 40s → 60s → 80s (đủ cho bridge throttle 30s đẩy token mới)
    const t = await layTokenSongWms(DIR, log);
    if (t) { token = t; return true; }
    log("  … chưa mượn được token sống (lần " + i + "/4) — chờ thêm.");
  }
  return false;
}

async function keoType(type, params = PARAMS, keep = KEEP) {
  let kept = [], seen = 0, total = null;
  for (let page = 1; page <= 400; page++) {
    const url = GW + "/type-" + type + "?" + qs(params) + "&page=" + page + "&size=" + SIZE;
    // fetchThuLai (vá 25/07/2026): 1 lần "fetch failed" giữa ~150 trang từng giết cả bước,
    // dashboard trơ dữ liệu cũ 3 tiếng (10:55→13:51 ngày 24/07).
    let r = await fetchThuLai(url, { headers: { authorization: token } });
    if (r.status === 401 || r.status === 403) {
      log("  … token bị đá giữa trang " + page + " type-" + type + " (HTTP " + r.status + ") — chờ mượn token phiên mới từ bridge...");
      if (!(await lamTuoiTokenGiuaChung())) throw new Error("type-" + type + " trả HTTP " + r.status + " — không mượn lại được token sống.");
      r = await fetchThuLai(url, { headers: { authorization: token } });
    }
    if (r.status !== 200) { if (page === 1) throw new Error("type-" + type + " trả HTTP " + r.status); break; }
    const j = await r.json().catch(() => null); if (!j) break;
    if (total === null) total = j.count ?? j.total ?? (j.data && (j.data.count ?? j.data.total)) ?? null;
    const rr = getRecs(j); if (!rr.length) break;
    seen += rr.length;
    kept = kept.concat(rr.filter((x) => keep.has(chuanKho(x.warehouse_name))));   // chỉ giữ đúng kho chỉ định
    if (total != null && seen >= total) break;
    await nghi(400);
  }
  const byKho = {}; kept.forEach((x) => { byKho[x.warehouse_name] = (byKho[x.warehouse_name] || 0) + 1; });
  log("  ✓ type-" + type + ": giữ " + kept.length + "/" + seen + " (quét) — " + JSON.stringify(byKho));
  return kept;
}
// Gộp 2 lượt kéo (counted-date + plan-date), phiếu trùng checklist_id lấy bản lượt ĐẦU (counted có đủ số liệu đếm)
const gopPhieu = (a, b) => { const co = new Set(a.map((x) => String(x.checklist_id))); return a.concat(b.filter((x) => !co.has(String(x.checklist_id)))); };
// DELTA: upsert bản ghi MỚI đè lên cache theo checklist_id (phiếu mới thì nối thêm cuối)
const gopCache = (cu, moi) => { const m = new Map((cu || []).map((x) => [String(x.checklist_id), x])); for (const x of moi) m.set(String(x.checklist_id), x); return [...m.values()]; };
const num = (v) => (v == null || v === "" ? "" : Number(v) || 0);
function rowSku(r, i) {
  return [i + 1, r.checklist_id || "", r.plan_id || "", r.source_code || "", r.warehouse_name || "", r.plan_object_code || "",
    r.product_name || "", r.category_name || "", r.plan_type || "", r.is_vat || "", r.priority_name || "",
    "", "",   // Diff By Location / Sku -> để trống, FE tự tính từ Inventory & Quantity Count
    num(r.qty_by_sys), num(r.qty_by_user), r.created_by_name || "", r.checklist_by_name || "", r.checklist_at || "",
    r.updated_at || "", r.plan_date || "", r.status_name || ""];
}
function rowLoc(r, i) {
  var diff = (r.qty_by_user == null || r.qty_by_sys == null) ? (r.qty_by_user == null ? 0 : Number(r.qty_by_user) || 0) : (Number(r.qty_by_user) || 0) - (Number(r.qty_by_sys) || 0);
  return [i + 1, r.checklist_id || "", r.plan_id || "", r.source_code || "", r.warehouse_name || "", r.plan_type || "",
    r.plan_object_code || "", r.priority_name || "", diff, r.created_by_name || "", r.checklist_by_name || "",
    r.checklist_at || "", r.updated_at || "", r.plan_date || "", r.status_name || ""];
}
/* ===== UID GROUP LỆCH — tracking chi tiết của phiếu → tab kiemke-uidgr =====
   v4 (chỉ thị 27/07 — bù trừ vị trí theo SKU): khối VỊ TRÍ lấy MỌI phiếu ĐÃ ĐẾM kể cả net=0,
   vì phiếu net 0 vẫn chứa SKU thiếu bin này thừa bin kia (dashboard tự bù trừ theo SKU).
   v5 (bệnh phát hiện 27/07 trên dữ liệu thật): API LIST XOÁ qty_by_user sau khi phiếu APPROVED
   (187/279 phiếu vị trí đã đếm bị null qty — chọn theo qty là sót gần hết) -> chọn theo STATUS:
   VERIFIED/APPROVED/WAITING FOR APPROVE/REJECTED/PROCESSING = đã/đang đếm; PENDING/NOT COUNT/
   CANCELED bỏ. Khối SKU: có qty thì chỉ kéo phiếu lệch (net phiếu = net SKU), mất qty kéo luôn. */
const ST_DEM = /VERIFIED|APPROVED|WAITING FOR APPROVE|REJECTED|PROCESSING/i;
const phieuLech = (kind, r) => {
  if (!ST_DEM.test(String(r.status_name || ""))) return false;
  if (r.qty_by_user == null) return true;    // APPROVED bị xoá qty trên list -> phải kéo tracking mới biết lệch hay không
  if (kind === "loc") return true;
  return ((Number(r.qty_by_user) || 0) - (Number(r.qty_by_sys) || 0)) !== 0;
};
const ujParse = (s) => { try { const a = JSON.parse(s || "[]"); return Array.isArray(a) ? a : []; } catch { return []; } };
const lineStatus = (sid) => (sid === 4 ? "Counted" : sid === 2 ? "Count cancelled" : "Not counted");
async function keoTracking(cid) {
  let all = [];
  for (let page = 1; page <= 10; page++) {
    const url = GW_TRACKING + "?checklist_id=" + encodeURIComponent(cid) + "&page=" + page + "&size=200";
    let r = await fetchThuLai(url, { headers: { authorization: token } });
    if (r.status === 401 || r.status === 403) {
      log("  … token bị đá khi kéo tracking phiếu " + cid + " (HTTP " + r.status + ") — chờ mượn token phiên mới...");
      if (!(await lamTuoiTokenGiuaChung())) throw new Error("tracking " + cid + " trả HTTP " + r.status + " — không mượn lại được token sống.");
      r = await fetchThuLai(url, { headers: { authorization: token } });
    }
    if (r.status !== 200) throw new Error("tracking " + cid + " trả HTTP " + r.status);
    const j = await r.json().catch(() => null); if (!j) break;
    const recs = getRecs(j); if (!recs.length) break;
    all = all.concat(recs);
    const cnt = j.count ?? (j.data && j.data.count) ?? null;
    if (recs.length < 200 || (cnt != null && all.length >= Number(cnt))) break;
  }
  return all;
}
/* 1 dòng tracking (SKU × vị trí) -> các dòng UID group: hợp nhất exp_by_user (đếm) & exp_by_sys
   (hệ thống). Status suy từ 2 phía: chỉ user = New (thêm khi đếm) · chỉ sys = Not found (hệ thống
   có mà đếm không thấy) · cả 2 = Matched / Diff qty. Entry KHÔNG có group_uid_code (hàng thường
   theo HSD) gom vào 1 dòng uid rỗng — FE hiện "—". */
function uidRowsCuaLine(rec) {
  const m = new Map();   // uid -> {qtyU, qtyS, exp, dat}
  const gop = (arr, phia) => {
    for (const e of arr) {
      if (!e) continue;
      const uid = e.group_uid_code != null && e.group_uid_code !== "" ? String(e.group_uid_code) : "";
      const o = m.get(uid) || {};
      o[phia] = (o[phia] || 0) + (Number(e.qty) || 0);
      if (e.date_added && !o.dat) o.dat = String(e.date_added);
      const exp = e.exp || e.expiration_date || e.expiry_date;
      if (exp && !o.exp) o.exp = String(exp);
      const st = e.status_name || e.group_status_name || e.group_status || e.status;
      if (st && !o.gst) o.gst = String(st);
      m.set(uid, o);
    }
  };
  gop(ujParse(rec.exp_by_user), "qtyU");
  gop(ujParse(rec.exp_by_sys), "qtyS");
  const out = [];
  for (const [uid, o] of m) {
    // Trạng thái UIDgr code: lấy theo Group status của UID group (mặc định Available cho các UID group trên WMS)
    const st = o.gst || (uid ? "Available" : (o.qtyU != null && o.qtyS == null ? "New" : o.qtyU == null && o.qtyS != null ? "Not found" : "Available"));
    out.push({ uid, st, qtyU: o.qtyU, qtyS: o.qtyS, exp: o.exp || "", dat: o.dat || "" });
  }
  return out;
}
async function buocUidgr(sku, loc, uidgrCu) {
  const want = new Map();   // cid -> meta phiếu (kind + ngữ cảnh header)
  for (const [kind, arr] of [["sku", sku], ["loc", loc]]) for (const r of arr) if (phieuLech(kind, r))
    want.set(String(r.checklist_id), { kind, req: r.plan_id || "", wh: r.warehouse_name || "", type: r.plan_type || "",
      cdate: r.checklist_at || "", upd: String(r.updated_at || r.checklist_at || ""),
      st: r.status_name || "", by: r.checklist_by_name || "", qtc: laQtc(kind, r) });
  const moi = {}; let hit = 0, treo = 0;
  const canKeo = [];
  for (const [cid, meta] of want) {
    const cu = uidgrCu[cid];
    // Phiếu thuộc diện qtycount mà bản cache CHƯA có khối qc (cache đời trước 25/08) → kéo bù 1 lần
    if (cu && cu.u === meta.upd && (!meta.qtc || cu.qc)) { moi[cid] = cu; hit++; continue; }
    if (canKeo.length >= UIDGR_MAX) { treo++; if (cu) moi[cid] = cu; continue; }   // quá cap: giữ bản cũ (nếu có), lượt sau kéo bù
    canKeo.push([cid, meta]);
  }
  // 4 luồng song song (27/07/2026 — "cần nhanh hơn"): ≤4 request cùng lúc + nghỉ 120ms/phiếu,
  // vẫn hiền với WMS hơn 1 người bấm trang; token bị đá thì worker đầu làm tươi, các worker sau hưởng chung.
  let idx = 0;
  const worker = async () => {
    for (;;) {
      const i = idx++; if (i >= canKeo.length) return;
      const [cid, meta] = canKeo[i];
      const recs = await keoTracking(cid);
      const rows = [];
      const qc = meta.qtc ? [] : undefined;   // FULL_LOCATION_FACTORY: giữ MỌI dòng (kể cả khớp) cho tab kiemke-qtycount
      for (const rec of recs) {
        const cnt = rec.qty_by_user == null ? null : Number(rec.qty_by_user) || 0;
        const inv = rec.qty_by_sys == null ? null : Number(rec.qty_by_sys) || 0;
        const diff = rec.qty_diff != null ? Number(rec.qty_diff) || 0 : (cnt || 0) - (inv || 0);
        if (qc) qc.push([cid, meta.req, meta.wh, rec.bin_location || "", rec.sku || "", rec.product_name || "",
          cnt == null ? "" : cnt, inv == null ? "" : inv, (cnt == null && rec.qty_diff == null) ? "" : diff,
          lineStatus(rec.status_id), meta.st, meta.by, meta.cdate || "", meta.upd]);
        /* GIỮ TẤT CẢ CÁC DÒNG UID GROUP TẠI VỊ TRÍ (yêu cầu user 26/08): để xem trọn bộ UID group của vị trí
           thay vì chỉ hiện nhóm lệch. Dòng diff=0 và nhóm khớp vẫn được đưa vào để hiển thị đầy đủ. */
        const allGroups = uidRowsCuaLine(rec);
        const groups = allGroups.filter((u) => u.uid !== "");
        if (!groups.length) {
          if (!diff && !allGroups.length) continue;   // dòng khớp hẳn không có UID group -> bỏ
          groups.push({ uid: "", st: "", qtyU: cnt, qtyS: inv, exp: "", dat: "" });   // hàng thường không quản UID group -> 1 dòng đại diện số của dòng
        }
        for (const u of groups)
          rows.push([meta.kind, cid, String(rec.tracking_id || ""), meta.req, meta.wh, meta.type,
            rec.bin_location || "", rec.sku || "", rec.product_name || "",
            cnt == null ? "" : cnt, inv == null ? "" : inv, diff, lineStatus(rec.status_id),
            u.uid ? "'" + u.uid : "",   // dấu nháy đầu = ép TEXT trên Sheets — mã UID 16 số không bị đổi thành 1.02826E+15
            u.st, u.qtyU == null ? "" : u.qtyU, u.qtyS == null ? "" : u.qtyS, u.exp, u.dat || meta.cdate || "", meta.upd]);
      }
      moi[cid] = { u: meta.upd, rows, qc };
      await nghi(120);
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, canKeo.length) }, worker));
  const out = [], qtc = [];
  for (const cid of want.keys()) if (moi[cid]) {
    for (const r of moi[cid].rows) out.push([out.length + 1].concat(r));
    if (want.get(cid).qtc && moi[cid].qc) for (const r of moi[cid].qc) qtc.push([qtc.length + 1].concat(r));
  }
  log("  ✓ UID group lệch: " + want.size + " phiếu lệch (cache " + hit + ", kéo mới " + canKeo.length + (treo ? ", quá cap giữ cũ " + treo : "") + ") → " + out.length + " dòng.");
  log("  ✓ SL đếm theo SKU (Full location - Factory) → tab kiemke-qtycount: " + qtc.length + " dòng.");
  return { rows: out, cache: moi, qtc };
}
async function ghiTab(tab, header, rows, apiAt, sheetId = SHEET_ID) {
  if (!rows.length) { log("  (⚠ " + tab + ": 0 dòng — bỏ qua, giữ data cũ)"); return; }
  const hash = hashTab(header, rows);
  if (tabKhongDoi(DIR, tab, hash)) {
    log("  = " + tab + ": dữ liệu KHÔNG đổi so với lần ghi trước — bỏ qua ghi (" + rows.length + " dòng, tiết kiệm GAS).");
    await chamMocTabs([tab], apiAt, log);   // chip giờ trên dashboard vẫn phải chạy theo giờ KIỂM TRA thật
    return;
  }
  for (let i = 0; i < rows.length; i += CHUNK) {
    const phan = rows.slice(i, i + CHUNK);
    const body = JSON.stringify({ action: "syncTasks", key: APPSCRIPT_KEY, tab, sheetId, header, rows: phan, append: i > 0, apiAt });
    // gasPost: gói sau append=true → nonce chặn ghi trùng khi phải thử lại (xem session-rules.js)
    const j = await gasPost(body, log, tab + " gói " + (i / CHUNK + 1));
    if (j.status !== "success") throw new Error(tab + ": " + (j.message || "?"));
    log("  ✓ " + tab + ": ghi " + Math.min(i + CHUNK, rows.length) + "/" + rows.length + (i === 0 ? " (xoá data cũ trước)" : " (nối tiếp)"));
  }
  luuHashTab(DIR, tab, hash);
}

(async () => {
  // Lượt guard chạy VÁ bước khác mà kiemke hôm nay đã xong → thoát sớm (mốc .sync-ok-kiemke).
  if (boQuaNeuDaTuoi(DIR, "kiemke", log)) process.exit(0);
  // Token sống (kho bất kể tuổi + get-me → bridge) — cải tiến 22/07/2026, không vứt token theo tuổi.
  token = await layTokenSongWms(DIR, log);
  if (!token) { log("⚠ Mở edge-profile đăng nhập lại — SẼ đăng xuất WMS trên Edge bạn đang mở."); token = await getTokenLive(); luuToken(DIR, "wms", token, "bot"); log("✓ Token mới."); }

  const apiAt = Date.now();
  log(DELTA
    ? "Kéo physical-count CHẾ ĐỘ DELTA (chỉ hôm nay + plan ±1 ngày, gộp cache full " + new Date(cache.fullAt).toLocaleString("vi-VN") + ")..."
    : "Kéo physical-count (2 kho material MTG + GARMENT, ngày đếm + BỔ SUNG theo plan date)...");
  const planF = { ...PARAMS_PLAN, warehouse_ids: WH_IDS_FACTORY };
  let sku = gopPhieu(await keoType("sku"), await keoType("sku", planF));
  await nghi(600);
  let loc = gopPhieu(await keoType("location"), await keoType("location", planF));
  if (DELTA) {
    const truoc = { s: sku.length, l: loc.length };
    sku = gopCache(cache.fSku, sku); loc = gopCache(cache.fLoc, loc);
    log("  → DELTA factory: " + truoc.s + " sku + " + truoc.l + " loc mới/đổi, gộp cache → " + sku.length + " sku, " + loc.length + " loc.");
  } else log("  → sau gộp khử trùng: sku " + sku.length + " dòng, location " + loc.length + " dòng.");

  await ghiTab("kiemke-sku", HEADER_SKU, sku.map(rowSku), apiAt);
  await ghiTab("kiemke-location", HEADER_LOC, loc.map(rowLoc), apiAt);
  log("✓ Factory xong — dashboard Kiểm kê có dữ liệu physical-count THẬT cả 2 kho MTG + GARMENT.");

  // UID group lệch (factory): lỗi ở bước này KHÔNG làm fail lượt chính — giữ tab cũ, cache cũ.
  let uidgrKq = null;
  try {
    let uidgrCu = null, uidgrVCu = null;
    if (cache) { uidgrCu = cache.uidgr || null; uidgrVCu = cache.uidgrV; }   // DELTA: cache đã đọc sẵn
    if (!uidgrCu) { try { const cu = JSON.parse(fs.readFileSync(PC_CACHE, "utf8")); uidgrCu = cu.uidgr || {}; uidgrVCu = cu.uidgrV; } catch { uidgrCu = {}; } }   // FULL: tận dụng cache lượt trước
    if (uidgrVCu !== UIDGR_V) { uidgrCu = {}; }   // đổi định dạng cột -> vứt cache, kéo lại toàn bộ (4 luồng nên chỉ ~1-2 phút)
    log("Kéo UID group của phiếu lệch (tab kiemke-uidgr)...");
    uidgrKq = await buocUidgr(sku, loc, uidgrCu);
    if (uidgrKq.rows.length) await ghiTab("kiemke-uidgr", HEADER_UIDGR, uidgrKq.rows, apiAt);
    else log("  (kiemke-uidgr: 0 dòng lệch — bỏ qua ghi, giữ tab cũ)");
    // SL đếm theo SKU (mục Tra cứu SL đếm của dashboard) — cùng nguồn tracking, chỉ thêm 1 tab ghi
    if (uidgrKq.qtc.length) await ghiTab("kiemke-qtycount", HEADER_QTC, uidgrKq.qtc, apiAt);
    else log("  (kiemke-qtycount: 0 dòng — bỏ qua ghi, giữ tab cũ)");
  } catch (e) { log("⚠ UID group lệch lỗi (bỏ qua, giữ tab cũ): " + e.message); }

  // HASAKI (2 kho 170 QL1A) -> sheet 5S: lỗi ở đây KHÔNG làm fail lượt factory phía trên
  let skuH = (cache && cache.hSku) || [], locH = (cache && cache.hLoc) || [];
  try {
    const paramsH = { ...PARAMS, warehouse_ids: WH_IDS_HASAKI };
    const planH = { ...PARAMS_PLAN, warehouse_ids: WH_IDS_HASAKI };
    log("Kéo physical-count HASAKI (SHOP + WH 170 QL1A, warehouse_ids=" + WH_IDS_HASAKI + ", ngày đếm + plan date)...");
    let skuHMoi = gopPhieu(await keoType("sku", paramsH, KEEP_HASAKI), await keoType("sku", planH, KEEP_HASAKI));
    await nghi(600);
    let locHMoi = gopPhieu(await keoType("location", paramsH, KEEP_HASAKI), await keoType("location", planH, KEEP_HASAKI));
    if (DELTA) {
      // CHỐT AN TOÀN: cache hasaki rỗng (lượt full trước lỗi phần hasaki) mà đem delta hôm nay
      // ghi đè tab là XOÁ MẤT lịch sử 90 ngày trên Sheet → bỏ qua ghi, chờ lượt full kế.
      if ((cache.hSku || []).length || (cache.hLoc || []).length) { skuH = gopCache(cache.hSku, skuHMoi); locH = gopCache(cache.hLoc, locHMoi); }
      else { skuH = []; locH = []; log("  ⚠ DELTA: cache hasaki rỗng — bỏ qua ghi 2 tab hasaki (giữ data cũ), chờ lượt FULL tạo lại cache."); }
    }
    else { skuH = skuHMoi; locH = locHMoi; }
    await ghiTab("kiemke-sku-hasaki", HEADER_SKU, skuH.map(rowSku), apiAt, SHEET_HASAKI);
    await ghiTab("kiemke-location-hasaki", HEADER_LOC, locH.map(rowLoc), apiAt, SHEET_HASAKI);
    log("✓ Hasaki xong — tab Kiểm kê portal kiemsoatkho (?company=hasaki&tab=kk) có dữ liệu.");
  } catch (e) { log("⚠ Hasaki lỗi (bỏ qua, giữ data cũ): " + e.message); }

  // Cache cho lượt DELTA kế tiếp: full → chụp mới toàn bộ; delta → cập nhật bản gộp, GIỮ mốc fullAt
  // (mốc fullAt là đồng hồ nâng-cấp-full 20h — delta không được phép trẻ hoá nó).
  try {
    let uidgrLuu = uidgrKq ? uidgrKq.cache : ((cache && cache.uidgr) || undefined);   // bước uidgr lỗi -> giữ cache cũ, không mất công kéo lại
    fs.writeFileSync(PC_CACHE, JSON.stringify({ fullAt: DELTA ? cache.fullAt : apiAt, fSku: sku, fLoc: loc, hSku: skuH, hLoc: locH, uidgr: uidgrLuu, uidgrV: uidgrKq ? UIDGR_V : (cache && cache.uidgrV) }));
  } catch (e) { log("  ⚠ Không lưu được cache delta: " + e.message); }

  ghiMocBuoc(DIR, "kiemke");   // mốc thành công cho sync-guard (phần factory đã ghi xong là đạt)
  log("✓ HOÀN TẤT.");
  process.exit(0);
})().catch((e) => { thoatTheoLoi(e, log, 2); });
