/**
 * export-pc.mjs — Xuất dữ liệu physical-count (type-sku) theo bộ lọc trên URL WMS.
 *  Ưu tiên TOKEN CACHE (không mở Edge, không đăng xuất phiên bạn đang dùng).
 *  Token hết hạn -> mới mở edge-profile đăng nhập lại (báo trước; sẽ đăng xuất WMS ở Edge của bạn).
 *  Xuất ra .exports/pc-<tab>-<kho>.csv (mở Excel) + .json.
 *
 *  node export-pc.mjs   (mặc định theo URL: tab=sku, kho 1177, khoảng ngày đếm đã cho)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { tokenCon, luuToken } from "./token-store.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const GW = "https://wms-gw.inshasaki.com/api/v1/wms/counting-plan/checklists";
const GET_ME = "https://wms-gw.inshasaki.com/api/v1/auth/user/get-me";
const nghi = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// Bộ lọc lấy từ URL bạn gửi
const TAB = "sku";                          // type-sku | type-location
const PARAMS = { warehouse_ids: "1177", from_counted_date: "1781456400000", to_counted_date: "1784134799999" };
const SIZE = 500;

async function getTokenLive() {
  // Chỉ gọi khi cache hỏng — mở edge-profile headless, bấm SSO im lặng (SẼ đăng xuất WMS ở Edge của bạn)
  const puppeteer = (await import("puppeteer")).default;
  const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
  const PROFILE = process.env.EDGE_PROFILE_DIR || path.join(DIR, ".wms-session", "edge-profile");
  const browser = await puppeteer.launch({ headless: true, executablePath: EDGE, userDataDir: PROFILE, args: ["--disable-blink-features=AutomationControlled"] });
  try {
    const page = (await browser.pages())[0] || (await browser.newPage());
    let token = null, good = null;
    const norm = (a) => (/^Bearer /i.test(a) ? a : "Bearer " + a);
    page.on("request", (req) => { const a = req.headers()["authorization"]; if (a && /wms-gw\.inshasaki\.com/.test(req.url())) token = norm(a); });
    await page.goto("https://wms.inshasaki.com/physical-count/result/list?current_tab=sku", { waitUntil: "networkidle2", timeout: 90000 }).catch(() => {});
    let b = 0, x = 0;
    for (let i = 0; i < 90 && !good; i++) {
      const u = page.url();
      if (/auth\/login/.test(u) && Date.now() - b > 5000) { const ok = await page.evaluate(() => { const e = [...document.querySelectorAll("button,[role=button],a")].find((z) => /SSO/i.test(z.innerText || "")); if (e) { e.click(); return 1; } }).catch(() => 0); if (ok) { b = Date.now(); log("  → bấm SSO..."); } }
      else if (/sso\/callback/.test(u) && Date.now() - x > 5000) { const t = await page.evaluate(() => { const c = [...document.querySelectorAll("button,[role=button]")].filter((z) => z.offsetParent !== null && !z.disabled); const e = c.find((z) => /đồng ý|dong y|tiếp tục|xác nhận|đăng nhập|^ok$|confirm|yes/i.test((z.innerText || "").trim()) && !/hủy|cancel|đóng|không/i.test((z.innerText || "").trim())); if (e) { e.click(); return (e.innerText || "").trim(); } }).catch(() => null); if (t) { x = Date.now(); log("  → xác nhận thiết bị: " + t); } }
      // XÁC MINH token bằng get-me — chỉ chấp nhận khi 200 (token bắt sớm lúc redirect thường 401)
      if (token) { const me = await fetch(GET_ME, { headers: { authorization: token } }).catch(() => null); if (me && me.status === 200) { good = token; break; } }
      await nghi(1000);
    }
    if (!good) throw new Error("Không lấy được token hợp lệ (phiên WMS hết hạn / chưa xác nhận thiết bị).");
    return good;
  } finally { await browser.close().catch(() => {}); }
}

const qs = (o) => Object.keys(o).map((k) => k + "=" + encodeURIComponent(o[k])).join("&");
async function callApi(token, page) {
  const url = GW + "/type-" + TAB + "?" + qs(PARAMS) + "&page=" + page + "&size=" + SIZE;
  const r = await fetch(url, { headers: { authorization: token } });
  return { status: r.status, json: r.status === 200 ? await r.json().catch(() => null) : null };
}

(async () => {
  // 1) Thử token cache — KHÔNG mở trình duyệt
  let token = tokenCon(DIR, "wms");
  if (token) {
    const me = await fetch(GET_ME, { headers: { authorization: token } }).catch(() => null);
    if (!me || me.status === 401 || me.status === 403) { log("Token cache hết hạn."); token = null; }
    else log("✓ Dùng token cache (không mở Edge, không đăng xuất phiên của bạn).");
  }
  if (!token) {
    log("⚠ Cần mở edge-profile đăng nhập lại — bước này SẼ đăng xuất WMS trên Edge bạn đang mở.");
    token = await getTokenLive(); luuToken(DIR, "wms", token); log("✓ Đã lấy token mới.");
  }

  // 2) Phân trang lấy trọn
  const first = await callApi(token, 1);
  if (first.status !== 200 || !first.json) { log("✗ API trả " + first.status + " — thử lại sau hoặc kiểm tra token."); process.exit(2); }
  const total = first.json.count ?? first.json.total ?? (first.json.data && (first.json.data.count ?? first.json.data.total)) ?? null;
  const getRecs = (j) => j.records || (j.data && (j.data.records || j.data.rows || j.data.content)) || j.rows || [];
  let recs = getRecs(first.json);
  log("Tổng khai báo: " + (total ?? "?") + " — trang 1: " + recs.length + " dòng.");
  for (let page = 2; total != null && recs.length < total && page <= 200; page++) {
    await nghi(400);
    const r = await callApi(token, page);
    const rr = r.json ? getRecs(r.json) : [];
    if (!rr.length) break;
    recs = recs.concat(rr);
    log("  … trang " + page + ": " + recs.length + (total != null ? "/" + total : ""));
  }
  if (!recs.length) { log("✗ 0 dòng khớp bộ lọc (kho " + PARAMS.warehouse_ids + ", khoảng ngày đếm)."); process.exit(0); }

  // 3) Xuất CSV (BOM UTF-8 cho Excel) + JSON
  const cols = Object.keys(recs[0]);
  const esc = (v) => { v = v == null ? "" : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const csv = "﻿" + [cols.join(",")].concat(recs.map((r) => cols.map((c) => esc(r[c])).join(","))).join("\r\n");
  fs.mkdirSync(path.join(DIR, ".exports"), { recursive: true });
  const base = path.join(DIR, ".exports", "pc-" + TAB + "-kho" + PARAMS.warehouse_ids);
  fs.writeFileSync(base + ".csv", csv, "utf8");
  fs.writeFileSync(base + ".json", JSON.stringify(recs, null, 1), "utf8");
  log("✓ Đã xuất " + recs.length + " dòng:");
  log("   " + base + ".csv  (mở bằng Excel)");
  log("   " + base + ".json");
  process.exit(0);
})().catch((e) => { log("✗ " + e.message); process.exit(2); });
