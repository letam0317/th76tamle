/**
 * sync-tonbatthuong.js — Đồng bộ TỒN KHO BẤT THƯỜNG (báo cáo stock-inventories WMS)
 *  → Google Sheet tab "stock-inventory-beta" (tab 3 dashboard factory đọc).
 *
 *  Chạy trong CỤM 7h (AUTO-EXPORT.bat, ngay sau sync-stocklocation): token WMS trong kho
 *  token-store (app "wms") còn tươi → KHÔNG mở Edge, KHÔNG đăng nhập thêm lần nào.
 *
 *  Lọc theo đúng spec tab dashboard: Product Type = Normal (nếu API có trường này)
 *  và có ÍT NHẤT 1 loại > 0: Committed · Committed Outbound · Unsuitable product ·
 *  UID Temp · Conflict · Not Found.
 *
 *  node sync-tonbatthuong.js
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";
import "dotenv/config";
import { layTokenTuPhucHoi } from "./auto-login.js";
import { voiKhoa, luuToken, EDGE_PATH, duongDanProfile } from "./token-store.js";
import { chanReLoginNgoaiKhung, layTokenSongWms, thoatTheoLoi, fetchThuLai, ghiMocBuoc, boQuaNeuDaTuoi, hashTab, tabKhongDoi, luuHashTab, chamMocTabs, gasPost } from "./session-rules.js";
import { kiemTruocKhiGhi, xacNhanDaGhi } from "./tu-chua.js";
import { quetTonViTri, dungBangTvt, TVT_TAB, TVT_HEADER, VT_CHO } from "./ton-vitri.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = duongDanProfile(DIR);   // EDGE_PATH + profile lấy từ token-store (khả chuyển máy)
const APPSCRIPT_URL = process.env.APPSCRIPT_URL || "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
const APPSCRIPT_KEY = process.env.APPSCRIPT_KEY;
const SHEET_FACTORY = "1eY_oo9fAvWCTXp24x-Z0FXq9mp_jJPlTHg09qdemETs";   // sheet stocklocationfactory (dashboard factory)
const SHEET_HASAKI = "1FWffWi75aATbokfqIcqjByEPzkJLQBngTXp5aPOIbLM";    // sheet 5S (dashboard kiemsoatkho · công ty HASAKI)
const GET_ME = "https://wms-gw.inshasaki.com/api/v1/auth/user/get-me";
// Ứng viên endpoint (thử lần lượt, chốt cái đầu tiên trả records) — comment trong dashboard chỉ /stock-inventories
const API_CANDS = [
  "https://wms-gw.inshasaki.com/api/v1/wms/report-management/stock-inventories",
  "https://wms-gw.inshasaki.com/api/v1/wms/report-management/stock-inventory",
];
const SIZE = 500, MAX_PAGE = 400, CHUNK = 4000;
// Mỗi bộ mang tab + sheetId ĐÍCH riêng: 2 bộ factory ghi chung stock-inventory-beta (sheet factory);
// bộ Hasaki Vietnam (company 1001) ghi stock-inventory-hasaki (sheet 5S) — trước mắt chỉ 2 kho
// SHOP - 170 QUOC LO 1A (863) + WH - 170 QUOC LO 1A (874).
const BO = [
  { ten: "Mastige", company: "1002", warehouses: "1458,1441,1307,1250,1179,1178,1177,1151", tab: "stock-inventory-beta", sheetId: SHEET_FACTORY },
  { ten: "Garment", company: "1005", warehouses: "1458,1441,1307,1250,1179,1178,1177,1151,1516,1341,1340,1339,1266", tab: "stock-inventory-beta", sheetId: SHEET_FACTORY },
  { ten: "Hasaki 170 QL1A", company: "1001", warehouses: "863,874", tab: "stock-inventory-hasaki", sheetId: SHEET_HASAKI },
];
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);
const nghi = (ms) => new Promise((r) => setTimeout(r, ms));
if (!APPSCRIPT_KEY) { console.error("✗ Thiếu APPSCRIPT_KEY trong .env."); process.exit(3); }

/* Chụp token WMS từ session sẵn có — BẢN TÔI LUYỆN của sync-stocklocation: token chụp được chỉ là
   ỨNG VIÊN (SPA có thể bắn request đầu bằng JWT CŨ trong localStorage), phải kiểm sống get-me ngay
   trong vòng lặp; chết thì loại + xoá phiên WMS cũ + ép đi lại luồng SSO. */
async function getWmsToken() {
  // LUẬT 1 (session-rules): token SỐNG trước — kho bất kể tuổi (get-me trọng tài) rồi bridge;
  // không mở Edge, không đá phiên. Nhờ vậy 401 giữa chừng trong giờ làm tự lành không cần SSO.
  const song = await layTokenSongWms(DIR, log);
  if (song) return song;
  const browser = await puppeteer.launch({ headless: true, executablePath: EDGE_PATH, userDataDir: PROFILE_DIR, args: ["--disable-blink-features=AutomationControlled"] });
  try {
    const page = (await browser.pages())[0] || (await browser.newPage());
    let token = null, ungVien = null;
    const daLoai = new Set();
    page.on("request", (req) => { const a = req.headers()["authorization"]; if (a && /wms-gw\.inshasaki\.com/.test(req.url()) && !ungVien && !token && !daLoai.has(a)) ungVien = a; });
    await page.goto("https://wms.inshasaki.com/report/beta/stock-location?company_ids=1002&ignore_zero_total=1&page=1&size=20&warehouse_ids=" + encodeURIComponent(BO[0].warehouses), { waitUntil: "networkidle2", timeout: 90000 }).catch(() => {});
    let lanBam = 0, lanXN = 0;
    for (let i = 0; i < 90 && !token; i++) {
      if (ungVien) {
        const thu = /^Bearer /i.test(ungVien) ? ungVien : "Bearer " + ungVien;
        const me = await fetch(GET_ME, { headers: { authorization: thu } }).catch(() => null);
        if (me && me.ok) { token = thu; break; }
        daLoai.add(ungVien); ungVien = null;
        log("  ⚠ Token chụp được đã chết (get-me " + (me ? me.status : "lỗi mạng") + ") — xoá phiên WMS cũ, đi lại luồng SSO...");
        await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) { /* bỏ qua */ } }).catch(() => {});
        await page.goto("https://wms.inshasaki.com/auth/login", { waitUntil: "networkidle2", timeout: 60000 }).catch(() => {});
        continue;
      }
      const url = page.url();
      if (/wms\.inshasaki\.com\/auth\/login/.test(url) && Date.now() - lanBam > 5000) {
        // LUẬT 2 (session-rules): bấm SSO = đá phiên người khác → chỉ trong khung giờ an toàn.
        chanReLoginNgoaiKhung(log);
        const ok = await page.evaluate(() => { const el = [...document.querySelectorAll("button,[role=button],a")].find((e) => /SSO/i.test(e.innerText || "")); if (el) { el.click(); return true; } return false; }).catch(() => false);
        if (ok) { lanBam = Date.now(); log("  → bấm SSO trên WMS..."); }
      } else if (/wms\.inshasaki\.com\/sso\/callback/.test(url) && Date.now() - lanXN > 5000) {
        const b = await page.evaluate(() => { const c = [...document.querySelectorAll("button,[role=button]")].filter((e) => e.offsetParent !== null && !e.disabled); const el = c.find((e) => /đồng ý|dong y|tiếp tục|xác nhận|đăng nhập|^ok$|confirm|yes/i.test((e.innerText || "").trim()) && !/hủy|cancel|đóng|không/i.test((e.innerText || "").trim())); if (el) { el.click(); return (el.innerText || "").trim(); } return null; }).catch(() => null);
        if (b) { lanXN = Date.now(); log("  → xác nhận thiết bị: " + b); }
      } else if (/wms\.inshasaki\.com/.test(url) && !/\/auth\//.test(url)) {
        // Đã vào app mà chưa bắt được request → dự phòng đọc JWT trong localStorage.auth_store
        try {
          const raw = await page.evaluate(() => localStorage.getItem("auth_store") || "");
          const jwt = String(raw).match(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g);
          if (jwt && jwt.length) {
            const t = "Bearer " + jwt.sort((a, b) => b.length - a.length)[0];
            if (!daLoai.has(t)) ungVien = t;
          }
        } catch (e) { /* trang đang chuyển hướng OIDC */ }
      }
      await nghi(1000);
    }
    if (!token) throw new Error("Phiên WMS hết hạn — không chụp được token sống (kẹt ở " + page.url().slice(0, 80) + ").");
    return token;
  } finally { await browser.close().catch(() => {}); }
}

/* Getter chịu được nhiều biến thể tên trường (API snake_case là chuẩn WMS) */
const g = (it, keys) => { for (const k of keys) if (it[k] != null && it[k] !== "") return it[k]; return ""; };
const n0 = (v) => { const n = Number(String(v == null ? "" : v).replace(/,/g, "")); return isNaN(n) ? 0 : n; };
const F = {
  sku: ["sku", "product_sku", "sku_code"],
  pn: ["product_name", "name"],
  brand: ["brand_name", "brand"],
  cat: ["category_name", "category"],
  wh: ["warehouse_name", "warehouse"],
  ptype: ["product_type_name", "product_type", "classify_name", "type_name"],
  in_stock: ["in_stock", "instock", "total", "quantity"],
  available: ["available"],
  committed: ["committed"],
  committed_outbound: ["committed_outbound"],
  unsuitable: ["unsuitable_product", "unsuitable"],
  uid_temp: ["uid_temp"],
  conflict: ["conflict"],
  not_found: ["not_found", "notfound"],
};
const HEADER = ["No.", "SKU", "Product Name", "Brand Name", "Category Name", "Warehouse Name", "Product Type",
  "In Stock", "Available", "Committed", "Committed Outbound", "Unsuitable Product", "UID Temp", "Conflict", "Not Found"];

/* ---------- Tab TỔNG HỢP "<tab>-tong" (15/08/2026) ---------------------------------------------
 * VÌ SAO: dashboard factory tab "Tồn kho bất thường" tải NGUYÊN tab thô rồi mới cộng trong trình
 * duyệt. ĐO THẬT 15/08: `stock-inventory-beta` = **21,6 MB / 50.264 dòng / 8,2 s**, trong khi màn
 * hình chính chỉ cần **25 ô (kho × loại)**.
 * Đã kiểm: KHÔNG lọc bớt được dòng nào — cả 50.264 dòng đều thật sự bất thường (tầng ghi đã lọc
 * Product Type=Normal + ≥1 loại >0 rồi). Nên khoản thắng ở đây là GOM, không phải LỌC.
 * KHÔNG tốn thêm lượt WMS nào: cộng ngay trên `rows` đã có trong RAM của chính lượt sync này.
 *
 * Thứ tự loại giữ ĐÚNG ABN_TYPES của dashboard (ưu tiên loại cần xử lý trước, Committed sau cùng)
 * — thứ tự này quyết định thẻ chỉ số, chú giải và thứ tự cột pop-up bên kia. */
const TONG_LOAI = [
  ["conflict", 13], ["uid_temp", 12], ["not_found", 14], ["unsuitable_product", 11],
  ["committed", 9], ["committed_outbound", 10],
];
const TONG_HEADER = ["Warehouse Name", "Type", "SkuCount", "Qty"];
/* Kèm MỘT dòng `__all__` cho mỗi kho = tổng số dòng bất thường của kho đó.
 * Vì sao cần: `abnRender()` bên dashboard lấy `nSku = rows.length` và `byWh[wh].n` — tức ĐẾM DÒNG,
 * không cộng theo loại. Cộng SkuCount của 6 loại lại sẽ ĐẾM TRÙNG (một dòng có thể vướng nhiều loại
 * cùng lúc), nên phải có con số tổng riêng.
 * Đã kiểm trên dữ liệu thật 15/08: mỗi cặp (SKU, kho) là DUY NHẤT (8 kho, 50.351 dòng) ⇒ đếm dòng
 * ≡ đếm SKU khác nhau, hai cách cho cùng số. Nếu ngày nào WMS đổi cách phát hành (1 SKU nhiều dòng
 * trong cùng kho) thì con số này lệch — kiểm lại bằng chính đoạn đối chiếu trong scratchpad. */
function tinhTongHop(rows) {
  const g = new Map();   // "wh␟type" -> {wh, type, sku:Set, qty}
  const tongKho = new Map();   // wh -> số DÒNG bất thường
  for (const r of rows) {
    const wh = String(r[5] || "");
    tongKho.set(wh, (tongKho.get(wh) || 0) + 1);
    for (const [ten, i] of TONG_LOAI) {
      const v = Number(r[i]) || 0;
      if (v <= 0) continue;
      const k = wh + "␟" + ten;
      let o = g.get(k);
      if (!o) { o = { wh, type: ten, sku: new Set(), qty: 0 }; g.set(k, o); }
      o.sku.add(String(r[1])); o.qty += v;
    }
  }
  const out = [...g.values()].map((o) => [o.wh, o.type, o.sku.size, o.qty]);
  for (const [wh, n] of tongKho) out.push([wh, "__all__", n, 0]);
  return out;
}
/* Best-effort: dashboard đọc được tab tổng thì vẽ nhanh, không đọc được thì tự lùi về tab thô —
   nên hỏng ở đây TUYỆT ĐỐI không được làm hỏng lượt sync chính. */
async function ghiTongHop(tab, sheetId, rows, apiAt) {
  const tabT = tab + "-tong";
  try {
    const tong = tinhTongHop(rows);
    if (!tong.length) return;
    const hash = hashTab(TONG_HEADER, tong);
    if (tabKhongDoi(DIR, tabT, hash)) { log("  = " + tabT + ": không đổi — bỏ qua ghi (" + tong.length + " ô)."); await chamMocTabs([tabT], apiAt, log); return; }
    const body = JSON.stringify({ action: "syncTasks", key: APPSCRIPT_KEY, tab: tabT, sheetId, header: TONG_HEADER, rows: tong, apiAt });
    const j = await gasPost(body, log, tabT);
    if (j.status !== "success") throw new Error(j.message || "?");
    luuHashTab(DIR, tabT, hash);
    log("  ✓ " + tabT + ": " + tong.length + " ô (kho × loại) — dashboard vẽ màn hình chính từ đây.");
  } catch (e) { log("  ⚠ Không ghi được " + tabT + ": " + e.message + " (dashboard tự lùi về tab thô)."); }
}

/* ---------- Bước "TỒN TẠI VỊ TRÍ" (19/08/2026) --------------------------------------------------
 * LUẬT: SKU vải nguyên liệu BẮT BUỘC khai báo UID group. UID nào WMS còn hiện
 * "Group UID / RFID mapping: 0" thì BUỘC phải nằm ở bãi chờ F0-A0-00-00-00-00; nằm ở vị trí khác
 * ⇒ bất thường (hàng đã lên kệ mà không truy được theo group ⇒ kiểm kê sẽ lệch).
 * PHẠM VI: chỉ SKU vải, chỉ 2 kho WH - MATERIAL - MTG + WH - MATERIAL - GARMENT.
 *
 * ĐI CHUNG LƯỢT NÀY chứ không dựng script/lịch riêng: cùng token WMS, cùng sheet đích, cùng khung
 * giờ — thêm một lượt đăng nhập nữa là đi ngược ràng buộc "nhẹ tải upstream" của dự án.
 * Chi tiết thuật toán + cơ sở đo đạc: xem đầu tệp ton-vitri.mjs.
 * BEST-EFFORT: hỏng ở đây TUYỆT ĐỐI không được làm hỏng lượt sync tồn bất thường phía trên. */
const F_TVT_LAST = path.join(DIR, ".tvt-last.json");
function tvtDocLan() { try { return JSON.parse(fs.readFileSync(F_TVT_LAST, "utf8")); } catch { return { n: 0 }; } }
function tvtLuuLan(n) { try { fs.writeFileSync(F_TVT_LAST, JSON.stringify({ n, at: new Date().toISOString() })); } catch { /* bỏ qua */ } }

async function ghiTonViTri(token, apiAt) {
  try {
    log("— Tồn tại vị trí: quét UID vải chưa khai báo UID group nằm ngoài " + VT_CHO + " (2 kho nguyên liệu) …");
    const kq = await quetTonViTri(token, log);
    log("  ✓ " + kq.soGoi + " lượt gọi WMS → " + kq.rows.length + " UID vải sai vị trí" + (kq.duCanh ? "" : " (⚠ quét CHƯA đủ cạnh)"));

    /* Chốt chặn riêng cho bước này (KHÔNG dùng baseline tu-chua): tab này được phép tụt về 0 —
       kho xử lý xong thì đúng là hết dòng. Chỉ nghi ngờ khi quét THIẾU dữ liệu mà số lại tụt mạnh. */
    const truoc = tvtDocLan().n || 0;
    if (!kq.duCanh && truoc >= 50 && kq.rows.length < truoc * 0.5) {
      log("  ⚠ bỏ ghi " + TVT_TAB + ": quét chưa đủ cạnh mà số dòng tụt " + truoc + " → " + kq.rows.length + " (giữ dữ liệu cũ).");
      return;
    }

    let rows = dungBangTvt(kq.rows);
    /* GAS chặn rows rỗng (chống xoá trắng tab) nhưng "không còn UID nào sai vị trí" là kết quả
       ĐÚNG và cần được ghi đè lên danh sách cũ — gửi 1 dòng mốc không có UID; dashboard bỏ qua
       dòng không có UID nên màn hình hiện đúng "không có UID sai vị trí". */
    if (!rows.length) rows = [[0, "", "", "", "", "", "(không có UID sai vị trí)", "", "", "", 0, "", "", "",
      new Date().toLocaleString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" }).replace("T", " ")]];

    const hash = hashTab(TVT_HEADER, rows);
    if (tabKhongDoi(DIR, TVT_TAB, hash)) {
      log("  = " + TVT_TAB + ": không đổi — bỏ qua ghi (" + rows.length + " dòng).");
      await chamMocTabs([TVT_TAB], apiAt, log); tvtLuuLan(kq.rows.length); return;
    }
    for (let i = 0; i < rows.length; i += CHUNK) {
      const body = JSON.stringify({ action: "syncTasks", key: APPSCRIPT_KEY, tab: TVT_TAB, sheetId: SHEET_FACTORY,
        header: TVT_HEADER, rows: rows.slice(i, i + CHUNK), append: i > 0, apiAt });
      const j = await gasPost(body, log, TVT_TAB + (rows.length > CHUNK ? " gói " + (i / CHUNK + 1) : ""));
      if (j.status !== "success") throw new Error(j.message || "?");
    }
    luuHashTab(DIR, TVT_TAB, hash); tvtLuuLan(kq.rows.length);
    log("  ✓ " + TVT_TAB + ": ghi " + rows.length + " dòng.");
  } catch (e) {
    log("  ⚠ Bỏ qua bước Tồn tại vị trí: " + e.message + " (tab cũ giữ nguyên, lượt sau chạy lại).");
  }
}

(async () => {
  // Lượt guard chạy VÁ bước khác mà tonbatthuong hôm nay đã xong → thoát sớm (mốc .sync-ok-tonbatthuong).
  if (boQuaNeuDaTuoi(DIR, "tonbatthuong", log)) process.exit(0);
  let token = await layTokenTuPhucHoi(getWmsToken, DIR, log, "wms").catch((e) => { thoatTheoLoi(e, log, 2); });
  const me = await fetch(GET_ME, { headers: { authorization: token } });
  if (me.status === 401 || me.status === 403) { token = await voiKhoa(DIR, getWmsToken, { log }); luuToken(DIR, "wms", token, "bot"); }
  log("✓ Token WMS sẵn sàng.");

  // Chốt endpoint: thử từng ứng viên trên trang 1 của bộ đầu tiên
  let API = null;
  for (const cand of API_CANDS) {
    const u = cand + "?company_ids=" + BO[0].company + "&warehouse_ids=" + encodeURIComponent(BO[0].warehouses) + "&page=1&size=5";
    const r = await fetchThuLai(u, { headers: { authorization: token } }).catch(() => null);
    if (r && r.ok) { const j = await r.json().catch(() => null); const recs = j && (j.records || (j.data && j.data.records)); if (Array.isArray(recs)) { API = cand; log("✓ Endpoint: " + cand + " (mẫu " + recs.length + " dòng)"); if (recs[0]) log("  keys mẫu: " + Object.keys(recs[0]).slice(0, 24).join(",")); break; } }
    log("  … " + cand + " -> " + (r ? "HTTP " + r.status : "không gọi được"));
  }
  if (!API) { log("✗ Không tìm được endpoint stock-inventories — cần capture lại API từ trang WMS."); process.exit(2); }

  // Tự dò SIZE lớn nhất server chịu (giảm số trang -> chạy nhanh, đỡ chết token giữa chừng).
  // Chỉ nhận size lớn khi trang 1 trả về NHIỀU HƠN 500 dòng thật — server âm thầm cap thì giữ 500
  // (nếu nhận nhầm, điều kiện dừng recs.length < SIZE sẽ cắt cụt dữ liệu ngay trang đầu).
  let size = SIZE;
  for (const thu of [2000, 1000]) {
    const r = await fetchThuLai(API + "?company_ids=" + BO[0].company + "&warehouse_ids=" + encodeURIComponent(BO[0].warehouses) + "&page=1&size=" + thu, { headers: { authorization: token } }).catch(() => null);
    if (r && r.ok) { const j = await r.json().catch(() => null); const recs = (j && (j.records || (j.data && j.data.records))) || []; if (recs.length > 500) { size = thu; break; } }
  }
  log("✓ Cỡ trang: " + size + " dòng/lần.");

  // Token WMS sống ngắn (~vài phút) — 401/403 giữa chừng thì ĐĂNG NHẬP LẠI rồi thử lại đúng trang đó
  let lanDoiToken = 0;
  const fetchTrang = async (u) => {
    // fetchThuLai (vá 25/07/2026): chống "fetch failed" thoáng qua giết cả bước như kiemke 24/07
    let r = await fetchThuLai(u, { headers: { authorization: token } });
    if ((r.status === 401 || r.status === 403) && lanDoiToken < 5) {
      lanDoiToken++;
      log("  … token hết hạn giữa chừng — đăng nhập lại (" + lanDoiToken + "/5)...");
      token = await voiKhoa(DIR, getWmsToken, { log });
      luuToken(DIR, "wms", token, "bot");
      r = await fetchThuLai(u, { headers: { authorization: token } });
    }
    return r;
  };

  // Gom dòng THEO TAB ĐÍCH (factory gộp Mastige+Garment 1 tab; Hasaki tab riêng) — STT đếm riêng từng tab
  const nhom = {};   // tab -> { sheetId, rows }
  let quet = 0, coPtype = false;
  for (const cfg of BO) {
    const dich = (nhom[cfg.tab] = nhom[cfg.tab] || { sheetId: cfg.sheetId, rows: [] });
    let total = null, seen = 0;
    for (let page = 1; page <= MAX_PAGE; page++) {
      const u = API + "?company_ids=" + cfg.company + "&warehouse_ids=" + encodeURIComponent(cfg.warehouses) + "&page=" + page + "&size=" + size;
      const r = await fetchTrang(u);
      if (!r.ok) { log("  ⚠ " + cfg.ten + " trang " + page + " HTTP " + r.status); break; }
      const j = await r.json().catch(() => null); if (!j) break;
      if (total === null) total = j.count ?? j.total ?? (j.data && (j.data.count ?? j.data.total)) ?? null;
      const recs = (j.records || (j.data && j.data.records)) || [];
      if (!recs.length) break;
      seen += recs.length; quet += recs.length;
      for (const it of recs) {
        const ptype = String(g(it, F.ptype) || "");
        if (ptype) coPtype = true;
        if (ptype && !/normal/i.test(ptype)) continue;                       // chỉ Product Type = Normal
        const bat = [n0(g(it, F.committed)), n0(g(it, F.committed_outbound)), n0(g(it, F.unsuitable)),
          n0(g(it, F.uid_temp)), n0(g(it, F.conflict)), n0(g(it, F.not_found))];
        if (!bat.some((x) => x > 0)) continue;                               // phải có ít nhất 1 loại bất thường > 0
        dich.rows.push([dich.rows.length + 1, g(it, F.sku), g(it, F.pn), g(it, F.brand), g(it, F.cat), g(it, F.wh), ptype,
          n0(g(it, F.in_stock)), n0(g(it, F.available)), bat[0], bat[1], bat[2], bat[3], bat[4], bat[5]]);
      }
      if ((total != null && seen >= total) || recs.length < SIZE) break;
      await nghi(400);
    }
    log("  ✓ " + cfg.ten + ": quét " + seen + " dòng.");
  }
  const tongGiu = Object.values(nhom).reduce((s, d) => s + d.rows.length, 0);
  log("Tổng: quét " + quet + " → giữ " + tongGiu + " dòng bất thường" + (coPtype ? " (đã lọc Product Type=Normal)" : " (API không có product_type — giữ mọi loại)"));

  const apiAt = Date.now();
  for (const [tab, dich] of Object.entries(nhom)) {
    const rows = dich.rows;
    // GAS chặn ghi rows rỗng (chống xoá trắng) — 0 dòng thì bỏ qua, giữ dữ liệu cũ trên tab
    if (!rows.length) { log("  ⚠ " + tab + ": 0 dòng bất thường — bỏ qua (giữ dữ liệu cũ)."); continue; }
    /* 12/08/2026 — CỔNG CHẶN GHI RÁC (tu-chua.js). Bắt kịch bản WMS trả 200 nhưng dữ liệu
       tụt/lệch: đọc 12 dòng trong khi mọi ngày ~2.400. Ghi đè số đúng bằng số rác tai hại hơn
       nhiều so với đứng im một hôm — nên thà giữ dữ liệu cũ rồi gửi thư gọi người. */
    const cong = await kiemTruocKhiGhi(DIR, { nguon: tab, tenHienThi: "Tồn kho bất thường", header: HEADER, rows, cotSo: [7, 8, 9, 10, 11, 12, 13, 14], log });
    if (!cong.ghi) continue;
    // Chạy 3 lần/ngày (8h40 + 2 slot poller): dữ liệu không đổi thì khỏi ghi lại ~50k dòng, chỉ chạm mốc chip giờ.
    const hash = hashTab(HEADER, rows);
    if (tabKhongDoi(DIR, tab, hash)) {
      log("  = " + tab + ": dữ liệu KHÔNG đổi — bỏ qua ghi (" + rows.length + " dòng, tiết kiệm GAS).");
      await chamMocTabs([tab], apiAt, log); await xacNhanDaGhi(DIR, tab, rows.length);
      /* Vẫn gọi: lượt ĐẦU sau khi thêm tính năng này, tab thô rất có thể "không đổi" — không gọi
         ở nhánh này thì tab tổng sẽ không bao giờ được tạo ra. Nó tự có hash riêng nên không ghi thừa. */
      await ghiTongHop(tab, dich.sheetId, rows, apiAt);
      continue;
    }
    for (let i = 0; i < rows.length; i += CHUNK) {
      const phan = rows.slice(i, i + CHUNK);
      const body = JSON.stringify({ action: "syncTasks", key: APPSCRIPT_KEY, tab: tab, sheetId: dich.sheetId, header: HEADER, rows: phan, append: i > 0, apiAt });
      // gasPost: gói sau append=true, thử lại không có nonce là nhân đôi ~50k dòng (xem session-rules.js)
      const j = await gasPost(body, log, tab + " gói " + (i / CHUNK + 1));
      if (j.status !== "success") { log("✗ Ghi " + tab + " lỗi: " + (j.message || "?")); process.exit(2); }
      log("  ✓ " + tab + ": ghi " + Math.min(i + CHUNK, rows.length) + "/" + rows.length + (i === 0 ? " (xoá data cũ trước)" : " (nối tiếp)"));
    }
    luuHashTab(DIR, tab, hash);
    await xacNhanDaGhi(DIR, tab, rows.length);   // ghi mẫu baseline + đóng sự cố nếu trước đó có mở
    await ghiTongHop(tab, dich.sheetId, rows, apiAt);
  }
  await ghiTonViTri(token, apiAt);   // bước phụ, chạy ké token — hỏng cũng không ảnh hưởng tab chính
  ghiMocBuoc(DIR, "tonbatthuong");   // mốc thành công cho sync-guard
  log("✓ HOÀN TẤT — các tab Tồn kho bất thường đã có dữ liệu mới.");
  process.exit(0);
})().catch((e) => { thoatTheoLoi(e, log, 2); });
