/**
 * sync-kiemke.js — Kéo Kiểm kê 2 kho MATERIAL (MTG + GARMENT) từ WMS → tab kiemke-material.
 *  Chạy TỪ MÁY TRẠM (trong mạng Hasaki) vì WMS chặn IP ngoài — GAS không gọi thẳng được.
 *  Đẩy lên Sheet qua Apps Script apiSyncTasks (sheetId ngoài + tab riêng).
 *
 *  node sync-kiemke.js          (cap 2 trang/kho — giai đoạn test UI)
 *  FULL=1 node sync-kiemke.js   (kéo trọn)
 */
import puppeteer from "puppeteer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { layTokenTuPhucHoi } from "./auto-login.js";
import { voiKhoa, luuToken } from "./token-store.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const APPSCRIPT_URL = process.env.APPSCRIPT_URL || "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
const APPSCRIPT_KEY = process.env.APPSCRIPT_KEY;
const EDGE_PATH = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PROFILE_DIR = process.env.EDGE_PROFILE_DIR || "C:/Users/lechitam/New folder/baocao5s/.wms-session/edge-profile";
const SHEET_ID = "1eY_oo9fAvWCTXp24x-Z0FXq9mp_jJPlTHg09qdemETs";
const TAB = "kiemke-material";
const API = "https://wms-gw.inshasaki.com/api/v1/wms/report-management/stock-locations/bins/count/v3";
const GET_ME = "https://wms-gw.inshasaki.com/api/v1/auth/user/get-me";
const MAX_PAGE = process.env.FULL === "1" ? 40 : 2;   // test UI: 2 trang/kho
const SIZE = process.env.FULL === "1" ? 5000 : 1000;
const HEADER = ["SKU", "ProductName", "LocationDescription", "Warehouse", "SystemQty", "CountedQty", "Diff", "Status", "Updated"];
const BO = [
  { company: "1002", warehouses: "1458,1441,1307,1250,1179,1178,1177,1151", kho: "WH - MATERIAL - MTG" },
  { company: "1005", warehouses: "1458,1441,1307,1250,1179,1178,1177,1151,1516,1341,1340,1339,1266", kho: "WH - MATERIAL - GARMENT" },
];
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const nghi = (ms) => new Promise((r) => setTimeout(r, ms));
const chuanKho = (s) => String(s || "").replace(/\s+/g, " ").trim().toUpperCase();
if (!APPSCRIPT_KEY) { console.error("✗ Thiếu APPSCRIPT_KEY trong .env."); process.exit(3); }

async function getWmsToken() {
  const browser = await puppeteer.launch({ headless: true, executablePath: EDGE_PATH, userDataDir: PROFILE_DIR, args: ["--disable-blink-features=AutomationControlled"] });
  try {
    const page = (await browser.pages())[0] || (await browser.newPage());
    let token = null;
    page.on("request", (req) => { const a = req.headers()["authorization"]; if (a && /wms-gw\.inshasaki\.com/.test(req.url()) && !token) token = a; });
    await page.goto("https://wms.inshasaki.com/report/beta/stock-location?company_ids=1002&ignore_zero_total=1&page=1&size=20&warehouse_ids=" + encodeURIComponent(BO[0].warehouses), { waitUntil: "networkidle2", timeout: 90000 }).catch(() => {});
    let lanBam = 0, lanXN = 0;
    for (let i = 0; i < 75 && !token; i++) {
      const url = page.url();
      if (/wms\.inshasaki\.com\/auth\/login/.test(url) && Date.now() - lanBam > 5000) {
        const ok = await page.evaluate(() => { const el = [...document.querySelectorAll("button,[role=button],a")].find((e) => /SSO/i.test(e.innerText || "")); if (el) { el.click(); return true; } return false; }).catch(() => false);
        if (ok) { lanBam = Date.now(); log("  → bấm SSO trên WMS..."); }
      } else if (/wms\.inshasaki\.com\/sso\/callback/.test(url) && Date.now() - lanXN > 5000) {
        const b = await page.evaluate(() => { const c = [...document.querySelectorAll("button,[role=button]")].filter((e) => e.offsetParent !== null && !e.disabled); const el = c.find((e) => /đồng ý|dong y|tiếp tục|xác nhận|đăng nhập|^ok$|confirm|yes/i.test((e.innerText || "").trim()) && !/hủy|cancel|đóng|không/i.test((e.innerText || "").trim())); if (el) { el.click(); return (el.innerText || "").trim(); } return null; }).catch(() => null);
        if (b) { lanXN = Date.now(); log("  → xác nhận thiết bị: " + b); }
      }
      await nghi(1000);
    }
    if (!token) throw new Error("Phiên WMS hết hạn — không chụp được token.");
    token = /^Bearer /i.test(token) ? token : "Bearer " + token;
    const me = await fetch(GET_ME, { headers: { authorization: token } }).catch(() => null);
    if (!me || me.status === 401 || me.status === 403) throw new Error("Token WMS bị từ chối.");
    return token;
  } finally { await browser.close().catch(() => {}); }
}

(async () => {
  let token = await layTokenTuPhucHoi(getWmsToken, DIR, log, "wms").catch((e) => { log("✗ " + e.message); process.exit(2); });
  const me = await fetch(GET_ME, { headers: { authorization: token } });
  if (me.status === 401 || me.status === 403) { token = await voiKhoa(DIR, getWmsToken, { log }); luuToken(DIR, "wms", token); }
  log("✓ Token WMS sẵn sàng.");

  const rows = [];
  for (const cfg of BO) {
    const khoC = chuanKho(cfg.kho);
    let got = 0;
    for (let page = 1; page <= MAX_PAGE; page++) {
      const url = API + "?company_ids=" + cfg.company + "&warehouse_ids=" + encodeURIComponent(cfg.warehouses) + "&ignore_zero_total=1&page=" + page + "&size=" + SIZE;
      const r = await fetch(url, { headers: { authorization: token } });
      if (!r.ok) { log("  ⚠ " + cfg.kho + " trang " + page + " HTTP " + r.status); break; }
      const j = await r.json().catch(() => null);
      const recs = (j && (j.records || (j.data && j.data.records))) || [];
      for (const it of recs) {
        if (chuanKho(it.warehouse_name) !== khoC) continue;
        const sys = Number(it.quantity) || 0;
        const dem = (it.count_inbin == null || it.count_inbin === "") ? "" : Number(it.count_inbin) || 0;
        const diff = dem === "" ? 0 : dem - sys;
        rows.push([it.sku || "", it.product_name || "", it.location_description || "", it.warehouse_name || "",
          sys, dem, diff, dem === "" || dem === 0 ? "Chưa đếm" : (diff === 0 ? "Khớp" : diff < 0 ? "Lệch âm" : "Lệch dương"), it.updated_at || ""]);
      }
      got += recs.length;
      if (!recs.length || recs.length < SIZE) break;
      await nghi(500);
    }
    log("→ " + cfg.kho + ": giữ " + rows.filter((x) => chuanKho(x[3]) === khoC).length + " dòng (quét " + got + ").");
  }
  if (!rows.length) { log("✗ 0 dòng — không ghi."); process.exit(2); }

  const apiAt = Date.now();
  const body = JSON.stringify({ action: "syncTasks", key: APPSCRIPT_KEY, tab: TAB, sheetId: SHEET_ID, header: HEADER, rows, apiAt });
  const j = await (await fetch(APPSCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body })).json();
  log(j.status === "success" ? "✓ Đã ghi " + rows.length + " dòng vào tab " + TAB + "." : "✗ Ghi lỗi: " + (j.message || "?"));
  process.exit(j.status === "success" ? 0 : 2);
})().catch((e) => { log("✗ " + e.message); process.exit(2); });
