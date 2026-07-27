/**
 * pc-whcode-bootstrap.mjs — LÀM TƯƠI TOKEN khi bị chiếm phiên:
 *   ① chụp token WMS từ profile robot (SSO im lặng — y hệt cụm 7h)
 *   ② đẩy token tươi lên GAS (saveWmsToken) -> nút import trên dashboard dùng được ngay
 *   ③ (tuỳ chọn) test endpoint VALIDATE type-sku bằng file mẫu — chỉ validate, KHÔNG tạo lệnh
 *
 * ⚠ ĐÃ GỠ phần nạp danh mục kho theo warehouse_id BÁO CÁO (sự cố 2026-07-20: id báo cáo ≠
 *   Warehouse Code của template import — trùng số, KHÁC kho). Danh mục kho: dùng
 *   pc-whcode-template.mjs (nguồn = sheet "Warehouse code" trong CHÍNH template).
 *
 * Cách chạy:  node pc-whcode-bootstrap.mjs <đường-dẫn-file-pc_key.txt> [file-xlsx-test]
 */
import puppeteer from "puppeteer";
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { voiKhoa, luuToken, tokenCon } from "./token-store.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const EDGE_PATH = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PROFILE_DIR = process.env.EDGE_PROFILE_DIR || path.join(DIR, ".wms-session", "edge-profile");
const GAS = process.env.APPSCRIPT_URL || "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
const APPSCRIPT_KEY = process.env.APPSCRIPT_KEY || "";
const PC_KEY = (process.env.PC_KEY || (process.argv[2] && fs.existsSync(process.argv[2]) ? fs.readFileSync(process.argv[2], "utf8") : "")).trim();
const GET_ME = "https://wms-gw.inshasaki.com/api/v1/auth/user/get-me";
const STOCKLOC = "https://wms-gw.inshasaki.com/api/v1/wms/report-management/stock-locations/bins/count/v3";
const VALIDATE = "https://wms-gw.inshasaki.com/api/v1/wms/counting-plan/checklists/validate/type-sku";
const IDS = ["1458", "1441", "1307", "1250", "1179", "1178", "1177", "1151", "1516", "1341", "1340", "1339", "1266"];
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);
const nghi = (ms) => new Promise((r) => setTimeout(r, ms));
if (!PC_KEY) { console.error("✗ Thiếu PC_KEY (arg 1 = file chứa khóa, hoặc env PC_KEY)."); process.exit(3); }

/* Chụp token WMS từ session robot — copy nguyên pattern sync-tonbatthuong (bấm SSO im lặng nếu bị đẩy về login) */
async function getWmsToken() {
  const browser = await puppeteer.launch({ headless: true, executablePath: EDGE_PATH, userDataDir: PROFILE_DIR, args:["--disable-blink-features=AutomationControlled","--window-position=-32000,-32000","--window-size=1280,900","--no-startup-window"] });
  try {
    const page = (await browser.pages())[0] || (await browser.newPage());
    let token = null;
    page.on("request", (req) => { const a = req.headers()["authorization"]; if (a && /wms-gw\.inshasaki\.com/.test(req.url()) && !token) token = a; });
    await page.goto("https://wms.inshasaki.com/report/beta/stock-location?company_ids=1002&ignore_zero_total=1&page=1&size=20&warehouse_ids=1458", { waitUntil: "networkidle2", timeout: 90000 }).catch(() => {});
    let lanBam = 0, lanXN = 0;
    for (let i = 0; i < 90 && !token; i++) {
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
    if (!token) throw new Error("Phiên WMS hết hạn — không chụp được token (cần chạy LOGIN-HASAKI trước).");
    token = /^Bearer /i.test(token) ? token : "Bearer " + token;
    const me = await fetch(GET_ME, { headers: { authorization: token } }).catch(() => null);
    if (!me || me.status === 401 || me.status === 403) throw new Error("Token WMS bị từ chối.");
    return token;
  } finally { await browser.close().catch(() => {}); }
}

const gasPost = async (body) => {
  const r = await fetch(GAS, { method: "POST", redirect: "follow", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) });
  return r.json();
};

(async () => {
  // ① token: dùng cache nếu còn sống, không thì chụp mới
  const live = async (t) => { const r = await fetch(GET_ME, { headers: { authorization: t } }).catch(() => null); return r && r.ok ? await r.json().catch(() => ({})) : null; };
  let token = tokenCon(DIR, "wms"), me = token ? await live(token) : null;
  if (!me) {
    log("Token cache chết/thiếu → chụp mới từ profile robot (SSO im lặng)...");
    token = await voiKhoa(DIR, getWmsToken, { log });
    luuToken(DIR, "wms", token);
    me = await live(token);
  }
  if (!me) { log("✗ Vẫn không có token sống."); process.exit(2); }
  const ai = me.data || me;
  log("✓ Token sống — tài khoản:", ai.email || ai.username || ai.name || "?");

  // (phần nạp danh mục kho theo id báo cáo ĐÃ GỠ — xem cảnh báo đầu file; dùng pc-whcode-template.mjs)

  // ② token tươi lên GAS -> dashboard import dùng được ngay
  if (APPSCRIPT_KEY) {
    const r3 = await gasPost({ action: "saveWmsToken", key: APPSCRIPT_KEY, token });
    log("saveWmsToken:", JSON.stringify(r3).slice(0, 160));
  } else log("(!) Thiếu APPSCRIPT_KEY trong .env — bỏ qua bước đẩy token lên GAS.");

  // ④ test VALIDATE (read-only) bằng file mẫu nếu truyền vào
  const f = process.argv[3];
  if (f && fs.existsSync(f)) {
    const fd = new FormData();
    fd.append("chunk", new Blob([fs.readFileSync(f)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "WMS_INVENTORY_KEY_TEMPLATE_CP_CHECKLIST_SKU.xlsx");
    const rv = await fetch(VALIDATE, { method: "POST", headers: { authorization: token }, body: fd });
    log("VALIDATE HTTP", rv.status, ":", (await rv.text()).slice(0, 500));
  }
  log("✓ XONG.");
})();
