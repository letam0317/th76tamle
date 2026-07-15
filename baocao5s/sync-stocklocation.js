/**
 * ============================================================================
 *  ĐỒNG BỘ "TỒN MÃ VỊ TRÍ" (stock-location) WMS → Google Sheet stocklocationfactory
 * ============================================================================
 *  Chạy NỐI SAU auto-export-sync.js trong AUTO-EXPORT.bat (lịch 7h00) — lúc đó
 *  phiên Hasaki SSO trong Edge profile vừa được làm tươi, nên bước lấy token WMS
 *  bên dưới diễn ra IM LẶNG (không đăng nhập lại, không OTP).
 *
 *  LƯU Ý TOKEN: report wms.inshasaki.com KHÔNG dùng token wshr (work/hr) mà dùng
 *  JWT OIDC riêng (auth-gateway-public.inshasaki.com). Cùng 1 phiên SSO nên chỉ cần
 *  mở trang report bằng Edge profile dùng chung là chụp được Bearer — token này
 *  được cache vào kho token-store dưới khoá "wms" (TTL 40') để các lượt chạy gần
 *  nhau không phải mở lại trình duyệt. Phiên hết hạn → auto-login lo (ĐƠN LƯỢT),
 *  KHÔNG viết lại logic đăng nhập ở đây.
 *
 *  Quy trình:
 *    1) Token WMS từ kho (layTokenTuPhucHoi, app "wms") + kiểm sống bằng get-me
 *    2) Kéo TOÀN BỘ 2 bộ (Mastige 1002 / Garment 1005) — tự dò size lớn nhất
 *       API chấp nhận (5000→1000→200) + lặp page tới khi đủ `count` bản ghi
 *    3) Lọc in-memory: chỉ giữ các Kho (warehouse_name) trong danh sách khoGiuLai
 *    4) POST syncTasks (sheetId ngoài) → tab "mastige" / "garment": gói đầu XOÁ
 *       SẠCH dữ liệu cũ rồi ghi, các gói sau ghi nối tiếp (append) — chống rác
 *
 *  Chạy:  node sync-stocklocation.js          (Task Scheduler gọi qua AUTO-EXPORT.bat)
 *         node sync-stocklocation.js --dry    (kéo + lọc, lưu .exports/stocklocation-out.json, KHÔNG ghi Sheet)
 * ============================================================================
 */
import puppeteer from "puppeteer";
import fs from "node:fs";
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
const SHEET_ID = process.env.STOCKLOC_SHEET_ID || "1eY_oo9fAvWCTXp24x-Z0FXq9mp_jJPlTHg09qdemETs";
const API = "https://wms-gw.inshasaki.com/api/v1/wms/report-management/stock-locations/bins/count/v3";
const GET_ME = "https://wms-gw.inshasaki.com/api/v1/auth/user/get-me";
const CHUNK = 8000;                     // số dòng mỗi POST lên Apps Script (39k dòng ≈ 5 gói, mỗi gói vài MB)
const DRY = process.argv.includes("--dry");

// 2 bộ công ty — tab đích, tham số API và DANH SÁCH KHO GIỮ LẠI (lọc theo tên chính xác)
const BO = [
  {
    tab: "mastige", ten: "Mastige", company: "1002",
    warehouses: "1458,1441,1307,1250,1179,1178,1177,1151",
    khoGiuLai: [
      "WH - MATERIAL - MTG", "OFFICE - 130 AP CHANH - MTG", "WH - SEMI PRODUCT - MTG",
      "SAMPLE - 130 AP CHANH - MTG", "NG - MATERIAL - 130 AP CHANH - MTG",
      "NG - OFFICE - 130 AP CHANH - MTG", "GARMENT - 130 AP CHANH - MTG", "WH - FINISHED GOODS - MTG",
    ],
  },
  {
    tab: "garment", ten: "Garment", company: "1005",
    warehouses: "1458,1441,1307,1250,1179,1178,1177,1151,1516,1341,1340,1339,1266",
    khoGiuLai: [
      "WH - MATERIAL - GARMENT", "SHOP - 130 AP CHANH - GARMENT",
      "NG - 130 AP CHANH - GARMENT", "WH - SEMI PRODUCT - GARMENT",
    ],
  },
];

// Header đúng layout 18 cột sẵn có của Sheet (Barcode/Picklisted/Picking/Notfound/Packed/ShelfLife
// API không trả — để trống; dashboard chỉ cần SKU/Location/Category/Warehouse/Total)
const HEADER = ["SKU", "Barcode", "ProductName", "LocationDescription", "BrandName", "CategoryName", "Warehouse",
  "InbinQuantity", "PicklistedQuantity", "PickingQuantity", "NotfoundQuantity", "PackedQuantity", "Total",
  "Created Date", "Updated Date", "StorageTypeName", "ClassifyName", "Shelf Life (month)"];

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const nghi = (ms) => new Promise((r) => setTimeout(r, ms));
if (!APPSCRIPT_KEY && !DRY) { console.error("✗ Thiếu APPSCRIPT_KEY trong .env."); process.exit(3); }

async function fetchRetry(url, opt, n = 3) {
  let loiCuoi;
  for (let i = 0; i < n; i++) {
    try {
      const r = await fetch(url, opt);
      if ((r.status >= 500 || r.status === 429) && i < n - 1) { await new Promise(s => setTimeout(s, 1000 * 2 ** i)); continue; }
      return r;
    } catch (e) { loiCuoi = e; if (i < n - 1) await new Promise(s => setTimeout(s, 1000 * 2 ** i)); }
  }
  if (loiCuoi) throw loiCuoi;
  return fetch(url, opt);
}

/* ---------- Token WMS: mở trang report bằng Edge profile dùng chung, chụp Bearer tới wms-gw ----------
   WMS hết phiên thì rơi về wms.inshasaki.com/auth/login — trang này CHỈ có nút "Đăng nhập bằng SSO":
   bấm nút đó → OIDC (auth-gateway → auth-idp) đi IM LẶNG bằng phiên IdP sẵn có (login-hasaki 7h vừa
   làm tươi) → quay lại report kèm token. KHÔNG gõ email/mật khẩu/OTP ở đây. */
async function getWmsToken() {
  const browser = await puppeteer.launch({ headless: true, executablePath: EDGE_PATH, userDataDir: PROFILE_DIR, args: ["--disable-blink-features=AutomationControlled"] });
  try {
    const page = (await browser.pages())[0] || (await browser.newPage());
    let token = null;
    page.on("request", (req) => { const a = req.headers()["authorization"]; if (a && /wms-gw\.inshasaki\.com/.test(req.url()) && !token) token = a; });
    const trang = "https://wms.inshasaki.com/report/beta/stock-location?company_ids=1002&ignore_zero_total=1&page=1&size=20&warehouse_ids=" + encodeURIComponent(BO[0].warehouses);
    await page.goto(trang, { waitUntil: "networkidle2", timeout: 90000 }).catch(() => {});
    let lanBam = 0, lanXacNhan = 0;
    for (let i = 0; i < 75 && !token; i++) {
      const url = page.url();
      if (/wms\.inshasaki\.com\/auth\/login/.test(url) && Date.now() - lanBam > 5000) {
        const bam = await page.evaluate(() => {
          const el = [...document.querySelectorAll("button,[role=button],a")].find((e) => /SSO/i.test(e.innerText || ""));
          if (el) { el.click(); return true; } return false;
        }).catch(() => false);
        if (bam) { lanBam = Date.now(); log("  → bấm 'Đăng nhập bằng SSO' trên WMS (phiên IdP sẵn có, đi im lặng)..."); }
      } else if (/wms\.inshasaki\.com\/sso\/callback/.test(url) && Date.now() - lanXacNhan > 5000) {
        // WMS giới hạn 1 phiên / loại thiết bị: hiện hộp thoại "đã đăng nhập trên thiết bị khác,
        // đăng nhập ở đây sẽ đăng xuất thiết bị kia" → tự bấm nút XÁC NHẬN để đi tiếp.
        const bam = await page.evaluate(() => {
          const co = [...document.querySelectorAll("button,[role=button]")].filter((e) => e.offsetParent !== null && !e.disabled);
          const el = co.find((e) => /đồng ý|dong y|tiếp tục|tiep tuc|xác nhận|xac nhan|đăng nhập|dang nhap|^ok$|confirm|yes/i.test((e.innerText || "").trim()) && !/hủy|huy|cancel|đóng|khong|không/i.test((e.innerText || "").trim()));
          if (el) { el.click(); return (el.innerText || "").trim().slice(0, 30); } return null;
        }).catch(() => null);
        if (bam) { lanXacNhan = Date.now(); log("  → xác nhận đăng nhập thiết bị này (đăng xuất thiết bị kia): bấm '" + bam + "'"); }
      } else if (/wms\.inshasaki\.com/.test(url) && !/\/auth\//.test(url)) {
        // Đã vào app mà request chưa bắt được → dự phòng đọc JWT trong localStorage.auth_store
        try {
          const raw = await page.evaluate(() => localStorage.getItem("auth_store") || "");
          const jwt = String(raw).match(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g);
          if (jwt && jwt.length) token = "Bearer " + jwt.sort((a, b) => b.length - a.length)[0];
        } catch { /* trang đang chuyển hướng OIDC */ }
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (!token) throw new Error("Phiên WMS (wms.inshasaki.com) đã hết hạn — không chụp được token (kẹt ở " + page.url().slice(0, 80) + ").");
    token = /^Bearer /i.test(token) ? token : "Bearer " + token;
    // Kiểm sống TRƯỚC khi trả về/cache — auth_store có thể còn giữ JWT cũ đã hết hạn
    const me = await fetch(GET_ME, { headers: { authorization: token } }).catch(() => null);
    if (!me || me.status === 401 || me.status === 403) throw new Error("Token WMS chụp được nhưng bị từ chối (get-me " + (me ? me.status : "lỗi mạng") + ").");
    return token;
  } finally { await browser.close().catch(() => {}); }
}

/* ---------- Kéo TRỌN dữ liệu 1 bộ: dò size lớn nhất rồi lặp page tới khi đủ count ---------- */
const layRecords = (j) => j?.records || j?.data?.records || j?.data?.items || j?.items || null;
const layCount = (j) => j?.count ?? j?.total ?? j?.data?.count ?? j?.data?.total ?? null;
const urlBo = (cfg, page, size) => API + "?company_ids=" + cfg.company + "&warehouse_ids=" + encodeURIComponent(cfg.warehouses) + "&ignore_zero_total=1&page=" + page + "&size=" + size;

async function keoTatCa(token, cfg) {
  const SIZES = [5000, 1000, 200];
  let size = null, count = null, records = null;
  for (const s of SIZES) {
    const r = await fetchRetry(urlBo(cfg, 1, s), { headers: { authorization: token } });
    if (r.status === 401 || r.status === 403) { const e = new Error("Token WMS bị từ chối (" + r.status + ")."); e.auth = true; throw e; }
    if (!r.ok) { log("  (size=" + s + " bị từ chối " + r.status + " — hạ size)"); continue; }
    const j = await r.json().catch(() => null);
    const recs = layRecords(j);
    if (!Array.isArray(recs)) { log("  (size=" + s + " trả cấu trúc lạ — hạ size)"); continue; }
    size = s; count = layCount(j); records = recs; break;
  }
  if (records == null) throw new Error("API stock-location không trả dữ liệu hợp lệ (cty " + cfg.company + ").");
  log("  ✓ " + cfg.ten + ": trang 1 = " + records.length + " dòng (size=" + size + ", tổng khai báo count=" + (count ?? "?") + ").");
  for (let page = 2; page <= 200; page++) {
    if (count != null && records.length >= count) break;
    await nghi(500);   // nghỉ 0.5s giữa các trang — kéo tuần tự, không dội request lên WMS
    const r = await fetchRetry(urlBo(cfg, page, size), { headers: { authorization: token } });
    if (!r.ok) throw new Error("Trang " + page + " lỗi HTTP " + r.status + " (cty " + cfg.company + ").");
    const recs = layRecords(await r.json().catch(() => null)) || [];
    if (!recs.length) break;
    records.push(...recs);
    log("    … trang " + page + ": cộng dồn " + records.length + (count != null ? "/" + count : "") + " dòng.");
  }
  if (count != null && records.length < count) log("  ⚠ " + cfg.ten + ": mới gom " + records.length + "/" + count + " — API dừng trả trang sớm.");
  return records;
}

/* ---------- Lọc kho + map sang 18 cột layout Sheet ---------- */
const chuanKho = (s) => String(s || "").replace(/\s+/g, " ").trim().toUpperCase();
const num = (v) => (v == null || v === "" ? "" : Number(v));
const fmtNgay = (v) => {
  if (v == null || v === "") return "";
  const n = Number(v);
  if (Number.isFinite(n) && n > 1e9) {  // epoch giây/miligiây → giờ VN
    const d = new Date(n > 1e12 ? n : n * 1000);
    return d.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour12: false });
  }
  return String(v);
};
const toRow = (r) => [r.sku ?? "", r.barcode ?? "", r.product_name ?? "", r.location_description ?? "", r.brand_name ?? "",
  r.category_name ?? "", r.warehouse_name ?? "", num(r.count_inbin), "", "", "", "", num(r.quantity),
  fmtNgay(r.created_at), fmtNgay(r.updated_at), r.storage_type_name ?? "", r.product_type_name ?? "", r.shelf_life ?? ""];

/* ---------- Ghi 1 tab: gói đầu clear + header, các gói sau append ---------- */
async function ghiTab(tab, rows, apiAt) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const phan = rows.slice(i, i + CHUNK);
    const body = JSON.stringify({ action: "syncTasks", key: APPSCRIPT_KEY, tab, sheetId: SHEET_ID, header: HEADER, rows: phan, append: i > 0, apiAt });
    const r = await fetchRetry(APPSCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body });
    const j = JSON.parse(await r.text());
    if (j.status !== "success") throw new Error("Apps Script từ chối (" + tab + "): " + (j.message || "?"));
    log("  ✓ " + tab + ": đã ghi " + Math.min(i + CHUNK, rows.length) + "/" + rows.length + " dòng" + (i === 0 ? " (đã xoá sạch dữ liệu cũ trước khi ghi)" : " (nối tiếp)"));
  }
}

(async () => {
  // 0) Backend phải là bản hỗ trợ ghi sheet NGOÀI (extSheet) — chưa redeploy thì dừng sớm, không ghi bậy
  if (!DRY) {
    const caps = await fetch(APPSCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "caps", key: APPSCRIPT_KEY }) }).then((r) => r.json()).catch(() => null);
    if (!caps || caps.extSheet !== true) { log("✗ Apps Script chưa redeploy bản hỗ trợ sheetId ngoài (caps.extSheet). Dán google-script-DEPLOY.gs và Triển khai lại. BỎ QUA."); process.exit(3); }
  }

  // 1) Token WMS: ưu tiên kho token (app "wms"); chết thì auto-login đơn lượt lo phần đăng nhập
  let token = await layTokenTuPhucHoi(getWmsToken, DIR, log, "wms").catch((e) => { log("✗ " + e.message); process.exit(2); });
  const me = await fetchRetry(GET_ME, { headers: { authorization: token } });
  if (me.status === 401 || me.status === 403) {
    log("  ⚠ Token wms trong kho đã cũ — chụp lại từ phiên Edge...");
    token = await voiKhoa(DIR, getWmsToken, { log });
    luuToken(DIR, "wms", token);
  }
  log("✓ Token WMS sẵn sàng.");
  // Đẩy token mới nhất lên GAS (Script Properties) — nút "Tải lại dữ liệu" trên dashboard
  // dùng token này để GAS tự gọi WMS. Best-effort: lỗi không chặn luồng chính.
  if (!DRY) {
    try {
      const j = await (await fetchRetry(APPSCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "saveWmsToken", key: APPSCRIPT_KEY, token }) })).json();
      log(j.status === "success" ? "  ✓ Đã nạp token WMS lên Apps Script (cho nút Tải lại trên dashboard)." : "  ⚠ Apps Script không nhận token: " + (j.message || "?"));
    } catch (e) { log("  ⚠ Không đẩy được token lên Apps Script: " + e.message); }
  }
  const apiAt = Date.now();   // mốc "dữ liệu lấy lúc" cho chip giờ trên dashboard

  // 2+3) Kéo trọn từng bộ rồi lọc kho
  const ketQua = [];
  for (const cfg of BO) {
    if (ketQua.length) await nghi(1000);   // nghỉ 1s giữa 2 công ty
    const tho = await keoTatCa(token, cfg);
    const giu = new Set(cfg.khoGiuLai.map(chuanKho));
    const loc = tho.filter((r) => giu.has(chuanKho(r.warehouse_name)));
    const khoLa = [...new Set(tho.map((r) => chuanKho(r.warehouse_name)))].filter((k) => !giu.has(k));
    log("→ " + cfg.ten + ": " + tho.length + " dòng thô → GIỮ " + loc.length + " dòng (" + cfg.khoGiuLai.length + " kho)." + (khoLa.length ? " Loại bỏ kho: " + khoLa.join(", ") : ""));
    ketQua.push({ cfg, rows: loc.map(toRow) });
  }

  if (DRY) {
    fs.mkdirSync(path.join(DIR, ".exports"), { recursive: true });
    fs.writeFileSync(path.join(DIR, ".exports", "stocklocation-out.json"), JSON.stringify({ apiAt, header: HEADER, tabs: Object.fromEntries(ketQua.map((k) => [k.cfg.tab, k.rows])) }));
    log("(DRY) Đã lưu .exports/stocklocation-out.json — KHÔNG ghi Sheet.");
    process.exit(0);
  }

  // 4) Ghi tách biệt 2 tab; CHẶN GHI RỖNG (0 dòng sau lọc = bất thường → giữ nguyên data cũ)
  let loi = 0;
  for (const { cfg, rows } of ketQua) {
    if (!rows.length) { log("✗ " + cfg.ten + ": 0 dòng sau lọc — BỎ QUA ghi tab " + cfg.tab + " (không xoá trắng)."); loi++; continue; }
    try { await ghiTab(cfg.tab, rows, apiAt); }
    catch (e) { log("✗ " + cfg.ten + ": " + e.message); loi++; }
  }
  // Ghi mốc đồng bộ vào tab Metadata (dashboard hiển thị "cập nhật lúc" + mốc cooldown 4h của nút Tải lại)
  if (!loi) {
    try {
      const j = await (await fetchRetry(APPSCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "setStockMeta", key: APPSCRIPT_KEY, at: apiAt }) })).json();
      log(j.status === "success" ? "  ✓ Đã ghi mốc đồng bộ (Metadata) cho dashboard." : "  ⚠ Không ghi được Metadata: " + (j.message || "?"));
    } catch (e) { log("  ⚠ Không ghi được Metadata: " + e.message); }
  }
  log(loi ? "⚠ Hoàn tất nhưng có " + loi + " bộ lỗi/bỏ qua." : "✓ Hoàn tất đồng bộ Tồn mã vị trí (2 tab mastige/garment).");
  process.exit(loi ? 2 : 0);
})().catch((e) => { log("✗ " + e.message); process.exit(2); });
