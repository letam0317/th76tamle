/**
 * push-pc-to-sheet.mjs — Kéo physical-count THẬT (type-sku + type-location) rồi ghi vào
 *  Google Sheet 1eY_oo… tab kiemke-sku / kiemke-location (đúng tab dashboard đọc).
 *  Ưu tiên token cache (không mở Edge); hết hạn mới đăng nhập lại (đăng xuất WMS ở Edge của bạn).
 *
 *  node push-pc-to-sheet.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { tokenCon, luuToken } from "./token-store.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const APPSCRIPT_URL = process.env.APPSCRIPT_URL || "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
const APPSCRIPT_KEY = process.env.APPSCRIPT_KEY;
const SHEET_ID = "1eY_oo9fAvWCTXp24x-Z0FXq9mp_jJPlTHg09qdemETs";
const GW = "https://wms-gw.inshasaki.com/api/v1/wms/counting-plan/checklists";
const GET_ME = "https://wms-gw.inshasaki.com/api/v1/auth/user/get-me";
const SIZE = 500, CHUNK = 4000;
// Kéo theo khoảng ngày ĐẾM (bỏ lọc kho) rồi giữ cả 2 kho material — MTG + GARMENT
const PARAMS = { from_counted_date: "1781456400000", to_counted_date: "1784134799999" };
const chuanKho = (s) => String(s || "").replace(/\s+/g, " ").trim().toUpperCase();
const KEEP = new Set(["WH - MATERIAL - MTG", "WH - MATERIAL - GARMENT"].map(chuanKho));
const nghi = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
if (!APPSCRIPT_KEY) { console.error("✗ Thiếu APPSCRIPT_KEY trong .env."); process.exit(3); }

const HEADER_SKU = ["No.", "ID", "Request code", "Source code", "Warehouse", "SKU", "Product Name", "Category", "Type", "Required VAT", "Priority", "Diff By Location", "Diff By Sku", "Inventory", "Quantity Count", "Assign to", "Counted by", "Counted date", "Updated At", "Plan Date", "Status"];
const HEADER_LOC = ["No.", "ID", "Request code", "Source code", "Warehouse", "Type", "Location", "Priority", "Diff", "Assign to", "Counted by", "Counted date", "Updated At", "Plan Date", "Status"];

async function getTokenLive() {
  const puppeteer = (await import("puppeteer")).default;
  const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
  const PROFILE = process.env.EDGE_PROFILE_DIR || path.join(DIR, ".wms-session", "edge-profile");
  const browser = await puppeteer.launch({ headless: true, executablePath: EDGE, userDataDir: PROFILE, args: ["--disable-blink-features=AutomationControlled"] });
  try {
    const page = (await browser.pages())[0] || (await browser.newPage());
    let token = null, good = null; const norm = (a) => (/^Bearer /i.test(a) ? a : "Bearer " + a);
    page.on("request", (req) => { const a = req.headers()["authorization"]; if (a && /wms-gw\.inshasaki\.com/.test(req.url())) token = norm(a); });
    await page.goto("https://wms.inshasaki.com/physical-count/result/list?current_tab=sku", { waitUntil: "networkidle2", timeout: 90000 }).catch(() => {});
    let b = 0, x = 0;
    for (let i = 0; i < 90 && !good; i++) {
      const u = page.url();
      if (/auth\/login/.test(u) && Date.now() - b > 5000) { const ok = await page.evaluate(() => { const e = [...document.querySelectorAll("button,[role=button],a")].find((z) => /SSO/i.test(z.innerText || "")); if (e) { e.click(); return 1; } }).catch(() => 0); if (ok) { b = Date.now(); log("  → bấm SSO..."); } }
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

async function keoType(token, type) {
  let kept = [], seen = 0, total = null;
  for (let page = 1; page <= 400; page++) {
    const url = GW + "/type-" + type + "?" + qs(PARAMS) + "&page=" + page + "&size=" + SIZE;
    const r = await fetch(url, { headers: { authorization: token } });
    if (r.status !== 200) { if (page === 1) throw new Error("type-" + type + " trả HTTP " + r.status); break; }
    const j = await r.json().catch(() => null); if (!j) break;
    if (total === null) total = j.count ?? j.total ?? (j.data && (j.data.count ?? j.data.total)) ?? null;
    const rr = getRecs(j); if (!rr.length) break;
    seen += rr.length;
    kept = kept.concat(rr.filter((x) => KEEP.has(chuanKho(x.warehouse_name))));   // chỉ giữ 2 kho material
    if (total != null && seen >= total) break;
    await nghi(400);
  }
  const byKho = {}; kept.forEach((x) => { byKho[x.warehouse_name] = (byKho[x.warehouse_name] || 0) + 1; });
  log("  ✓ type-" + type + ": giữ " + kept.length + "/" + seen + " (quét) — " + JSON.stringify(byKho));
  return kept;
}
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
async function ghiTab(tab, header, rows, apiAt) {
  if (!rows.length) { log("  (⚠ " + tab + ": 0 dòng — bỏ qua, giữ data cũ)"); return; }
  for (let i = 0; i < rows.length; i += CHUNK) {
    const phan = rows.slice(i, i + CHUNK);
    const body = JSON.stringify({ action: "syncTasks", key: APPSCRIPT_KEY, tab, sheetId: SHEET_ID, header, rows: phan, append: i > 0, apiAt });
    const j = await (await fetch(APPSCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body })).json();
    if (j.status !== "success") throw new Error(tab + ": " + (j.message || "?"));
    log("  ✓ " + tab + ": ghi " + Math.min(i + CHUNK, rows.length) + "/" + rows.length + (i === 0 ? " (xoá data cũ trước)" : " (nối tiếp)"));
  }
}

(async () => {
  let token = tokenCon(DIR, "wms");
  if (token) { const me = await fetch(GET_ME, { headers: { authorization: token } }).catch(() => null); if (!me || me.status !== 200) { log("Token cache hết hạn."); token = null; } else log("✓ Dùng token cache (không mở Edge)."); }
  if (!token) { log("⚠ Mở edge-profile đăng nhập lại — SẼ đăng xuất WMS trên Edge bạn đang mở."); token = await getTokenLive(); luuToken(DIR, "wms", token); log("✓ Token mới."); }

  const apiAt = Date.now();
  log("Kéo physical-count (2 kho material MTG + GARMENT, theo khoảng ngày đếm)...");
  const sku = await keoType(token, "sku");
  await nghi(600);
  const loc = await keoType(token, "location");

  await ghiTab("kiemke-sku", HEADER_SKU, sku.map(rowSku), apiAt);
  await ghiTab("kiemke-location", HEADER_LOC, loc.map(rowLoc), apiAt);
  log("✓ HOÀN TẤT — dashboard Kiểm kê có dữ liệu physical-count THẬT cả 2 kho MTG + GARMENT.");
  process.exit(0);
})().catch((e) => { log("✗ " + e.message); process.exit(2); });
