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
 *  node push-pc-to-sheet.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { luuToken, EDGE_PATH, duongDanProfile } from "./token-store.js";
import { chanReLoginNgoaiKhung, layTokenSongWms, thoatTheoLoi } from "./session-rules.js";

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
const PC_TU_NGAY = Number(process.env.PC_TU_NGAY || 90);
const PARAMS = {
  from_counted_date: process.env.PC_FROM_MS || String(_d0 - PC_TU_NGAY * 86400000),
  to_counted_date: process.env.PC_TO_MS || String(_d0 + 86400000 - 1),
};
// PHIẾU CHƯA ĐẾM (PENDING/PROCESSING…) không có counted date -> LỌT LƯỚI bộ lọc from_counted_date
// (sự cố 24/07/2026: plan 243605 có 212 dòng PENDING location kho GARMENT mà dashboard không thấy).
// Kéo BỔ SUNG theo PLAN DATE, giới hạn warehouse_ids cho nhẹ, rồi gộp khử trùng checklist_id.
const PC_PLAN_TU_NGAY = Number(process.env.PC_PLAN_TU_NGAY || 45);    // plan quá khứ: 45 ngày
const PC_PLAN_TOI_NGAY = Number(process.env.PC_PLAN_TOI_NGAY || 45);  // plan tương lai: 45 ngày
const PARAMS_PLAN = {
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
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
if (!APPSCRIPT_KEY) { console.error("✗ Thiếu APPSCRIPT_KEY trong .env."); process.exit(3); }

const HEADER_SKU = ["No.", "ID", "Request code", "Source code", "Warehouse", "SKU", "Product Name", "Category", "Type", "Required VAT", "Priority", "Diff By Location", "Diff By Sku", "Inventory", "Quantity Count", "Assign to", "Counted by", "Counted date", "Updated At", "Plan Date", "Status"];
const HEADER_LOC = ["No.", "ID", "Request code", "Source code", "Warehouse", "Type", "Location", "Priority", "Diff", "Assign to", "Counted by", "Counted date", "Updated At", "Plan Date", "Status"];

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

async function keoType(token, type, params = PARAMS, keep = KEEP) {
  let kept = [], seen = 0, total = null;
  for (let page = 1; page <= 400; page++) {
    const url = GW + "/type-" + type + "?" + qs(params) + "&page=" + page + "&size=" + SIZE;
    const r = await fetch(url, { headers: { authorization: token } });
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
async function ghiTab(tab, header, rows, apiAt, sheetId = SHEET_ID) {
  if (!rows.length) { log("  (⚠ " + tab + ": 0 dòng — bỏ qua, giữ data cũ)"); return; }
  for (let i = 0; i < rows.length; i += CHUNK) {
    const phan = rows.slice(i, i + CHUNK);
    const body = JSON.stringify({ action: "syncTasks", key: APPSCRIPT_KEY, tab, sheetId, header, rows: phan, append: i > 0, apiAt });
    const j = await (await fetch(APPSCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body })).json();
    if (j.status !== "success") throw new Error(tab + ": " + (j.message || "?"));
    log("  ✓ " + tab + ": ghi " + Math.min(i + CHUNK, rows.length) + "/" + rows.length + (i === 0 ? " (xoá data cũ trước)" : " (nối tiếp)"));
  }
}

(async () => {
  // Token sống (kho bất kể tuổi + get-me → bridge) — cải tiến 22/07/2026, không vứt token theo tuổi.
  let token = await layTokenSongWms(DIR, log);
  if (!token) { log("⚠ Mở edge-profile đăng nhập lại — SẼ đăng xuất WMS trên Edge bạn đang mở."); token = await getTokenLive(); luuToken(DIR, "wms", token); log("✓ Token mới."); }

  const apiAt = Date.now();
  log("Kéo physical-count (2 kho material MTG + GARMENT, ngày đếm + BỔ SUNG theo plan date)...");
  const planF = { ...PARAMS_PLAN, warehouse_ids: WH_IDS_FACTORY };
  const sku = gopPhieu(await keoType(token, "sku"), await keoType(token, "sku", planF));
  await nghi(600);
  const loc = gopPhieu(await keoType(token, "location"), await keoType(token, "location", planF));
  log("  → sau gộp khử trùng: sku " + sku.length + " dòng, location " + loc.length + " dòng.");

  await ghiTab("kiemke-sku", HEADER_SKU, sku.map(rowSku), apiAt);
  await ghiTab("kiemke-location", HEADER_LOC, loc.map(rowLoc), apiAt);
  log("✓ Factory xong — dashboard Kiểm kê có dữ liệu physical-count THẬT cả 2 kho MTG + GARMENT.");

  // HASAKI (2 kho 170 QL1A) -> sheet 5S: lỗi ở đây KHÔNG làm fail lượt factory phía trên
  try {
    const paramsH = { ...PARAMS, warehouse_ids: WH_IDS_HASAKI };
    const planH = { ...PARAMS_PLAN, warehouse_ids: WH_IDS_HASAKI };
    log("Kéo physical-count HASAKI (SHOP + WH 170 QL1A, warehouse_ids=" + WH_IDS_HASAKI + ", ngày đếm + plan date)...");
    const skuH = gopPhieu(await keoType(token, "sku", paramsH, KEEP_HASAKI), await keoType(token, "sku", planH, KEEP_HASAKI));
    await nghi(600);
    const locH = gopPhieu(await keoType(token, "location", paramsH, KEEP_HASAKI), await keoType(token, "location", planH, KEEP_HASAKI));
    await ghiTab("kiemke-sku-hasaki", HEADER_SKU, skuH.map(rowSku), apiAt, SHEET_HASAKI);
    await ghiTab("kiemke-location-hasaki", HEADER_LOC, locH.map(rowLoc), apiAt, SHEET_HASAKI);
    log("✓ Hasaki xong — tab Kiểm kê portal kiemsoatkho (?company=hasaki&tab=kk) có dữ liệu.");
  } catch (e) { log("⚠ Hasaki lỗi (bỏ qua, giữ data cũ): " + e.message); }

  log("✓ HOÀN TẤT.");
  process.exit(0);
})().catch((e) => { thoatTheoLoi(e, log, 2); });
