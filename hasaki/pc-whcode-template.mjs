/**
 * pc-whcode-template.mjs — Lấy TEMPLATE GỐC từ WMS (download-template/type-sku) và nạp lại
 * tab "Warehouse code" bằng sheet tham chiếu trong CHÍNH template — nguồn mã kho ĐÚNG duy nhất.
 * (Bài học: warehouse_id của API báo cáo ≠ Warehouse Code của template import — trùng số khác kho!)
 *
 * Chạy: node pc-whcode-template.mjs <file-chứa-PC_KEY>
 */
import puppeteer from "puppeteer";
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { voiKhoa, luuToken, tokenCon } from "./token-store.js";
import { chanReLoginNgoaiKhung } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const EDGE_PATH = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PROFILE_DIR = process.env.EDGE_PROFILE_DIR || path.join(DIR, ".wms-session", "edge-profile");
const GAS = process.env.APPSCRIPT_URL || "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
const PC_KEY = (process.env.PC_KEY || (process.argv[2] && fs.existsSync(process.argv[2]) ? fs.readFileSync(process.argv[2], "utf8") : "")).trim();
const GET_ME = "https://wms-gw.inshasaki.com/api/v1/auth/user/get-me";
const TPL_URL = "https://wms-gw.inshasaki.com/api/v1/wms/counting-plan/checklists/download-template/type-sku";
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);
const nghi = (ms) => new Promise((r) => setTimeout(r, ms));
if (!PC_KEY) { console.error("✗ Thiếu PC_KEY."); process.exit(3); }

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
        /* 23/08/2026: cùng cửa kiểm với 3 bộ sync (trước đây bộ này bấm SSO không ai gác).
           Chốt cứng CAM_TU_DANG_NHAP chặn ở đây; cố ý chạy tay thì CAM_TU_DANG_NHAP=0 cho lệnh đó. */
        chanReLoginNgoaiKhung(log, DIR);
        const ok = await page.evaluate(() => { const el = [...document.querySelectorAll("button,[role=button],a")].find((e) => /SSO/i.test(e.innerText || "")); if (el) { el.click(); return true; } return false; }).catch(() => false);
        if (ok) { lanBam = Date.now(); log("  → bấm SSO trên WMS..."); }
      } else if (/wms\.inshasaki\.com\/sso\/callback/.test(url) && Date.now() - lanXN > 5000) {
        const b = await page.evaluate(() => { const c = [...document.querySelectorAll("button,[role=button]")].filter((e) => e.offsetParent !== null && !e.disabled); const el = c.find((e) => /đồng ý|dong y|tiếp tục|xác nhận|đăng nhập|^ok$|confirm|yes/i.test((e.innerText || "").trim()) && !/hủy|cancel|đóng|không/i.test((e.innerText || "").trim())); if (el) { el.click(); return (el.innerText || "").trim(); } return null; }).catch(() => null);
        if (b) { lanXN = Date.now(); log("  → xác nhận thiết bị: " + b); }
      }
      await nghi(1000);
    }
    if (!token) throw new Error("Không chụp được token.");
    token = /^Bearer /i.test(token) ? token : "Bearer " + token;
    return token;
  } finally { await browser.close().catch(() => {}); }
}

/* Đọc 1 sheet trong xlsx (đã unzip) — parser tối giản đủ cho sheet danh mục dạng bảng chữ+số */
function docSheet(dirX, tenSheet) {
  const wb = fs.readFileSync(path.join(dirX, "xl/workbook.xml"), "utf8");
  const sheets = [...wb.matchAll(/<sheet[^>]*name="([^"]*)"[^>]*r:id="(rId\d+)"/g)].map((m) => ({ name: m[1], rid: m[2] }));
  const sh = sheets.find((s) => s.name.trim().toLowerCase() === tenSheet.toLowerCase()) || null;
  if (!sh) throw new Error("Template không có sheet '" + tenSheet + "' — các sheet: " + sheets.map((s) => s.name).join(" | "));
  const rels = fs.readFileSync(path.join(dirX, "xl/_rels/workbook.xml.rels"), "utf8");
  const rel = new RegExp('Id="' + sh.rid + '"[^>]*Target="([^"]*)"').exec(rels) || new RegExp('Target="([^"]*)"[^>]*Id="' + sh.rid + '"').exec(rels);
  const target = rel[1].replace(/^\//, "");
  let ss = [];
  try {
    const s = fs.readFileSync(path.join(dirX, "xl/sharedStrings.xml"), "utf8");
    ss = [...s.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(""));
  } catch {}
  const xml = fs.readFileSync(path.join(dirX, "xl", target.replace(/^xl\//, "")), "utf8");
  const giai = (t) => t.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  const rows = [];
  for (const rm of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = {};
    // hỗ trợ cả 3 kiểu ô: sharedStrings (t="s" + <v>idx</v>), số thô (<v>), inlineStr (<is><t>…</t></is> — WMS dùng kiểu này)
    for (const cm of rm[1].matchAll(/<c [^>]*r="([A-Z]+)\d+"[^>]*>([\s\S]*?)<\/c>/g)) {
      const col = cm[1], body = cm[2];
      const attrs = cm[0].slice(0, cm[0].indexOf(">"));
      const vIn = /<is>[\s\S]*?<\/is>/.exec(body);
      if (vIn) { cells[col] = giai([...vIn[0].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")); continue; }
      const v = /<v>([\s\S]*?)<\/v>/.exec(body);
      if (!v) continue;
      cells[col] = /t="s"/.test(attrs) ? giai(ss[Number(v[1])] || "") : giai(v[1]);
    }
    rows.push(cells);
  }
  return rows;
}

(async () => {
  const live = async (t) => { const r = await fetch(GET_ME, { headers: { authorization: t } }).catch(() => null); return r && r.ok; };
  let token = tokenCon(DIR, "wms");
  if (!token || !(await live(token))) {
    log("Chụp token mới (SSO im lặng)...");
    token = await voiKhoa(DIR, getWmsToken, { log });
    luuToken(DIR, "wms", token);
  }
  log("✓ Token sống.");

  // Tải template gốc: API thường trả JSON {url} -> tải tiếp file thật
  let res = await fetch(TPL_URL, { headers: { authorization: token } });
  let buf, ct = res.headers.get("content-type") || "";
  if (/json/.test(ct)) {
    const j = await res.json(); const d = j.data || j;
    const u = d.url || d.file_url || d.link;
    if (!u) throw new Error("download-template không trả url: " + JSON.stringify(j).slice(0, 200));
    log("→ file template:", u.slice(0, 120));
    buf = Buffer.from(await (await fetch(u)).arrayBuffer());
  } else buf = Buffer.from(await res.arrayBuffer());
  const fx = path.join(DIR, ".wms-session", "tpl-checklist-sku.zip");
  fs.writeFileSync(fx, buf);
  log("✓ Đã tải template (" + buf.length + " bytes).");

  // API trả ZIP BỌC NGOÀI chứa file .xlsx thật -> giải nén 2 lớp bằng tar (bsdtar Windows đọc được zip; cmd.exe không có unzip)
  const dirI = path.join(DIR, ".wms-session", "tpl-inner");
  const dirX = path.join(DIR, ".wms-session", "tpl-x");
  for (const d of [dirI, dirX]) { fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true }); }
  execSync(`tar -xf "${fx}" -C "${dirI}"`);
  const inner = fs.readdirSync(dirI).find((f) => /\.xlsx$/i.test(f));
  execSync(`tar -xf "${inner ? path.join(dirI, inner) : fx}" -C "${dirX}"`);
  const raw = docSheet(dirX, "Warehouse code");
  // dòng 1 = header; cột A=Code, B=Name, C=Type, D=City (đúng cấu trúc user mô tả)
  const rows = raw.slice(1).map((c) => [String(c.A || "").trim(), String(c.B || "").replace(/\s+/g, " ").trim(), String(c.C || "").trim(), String(c.D || "").trim()])
    .filter((r) => r[0] && r[1]);
  log("✓ Sheet 'Warehouse code' trong template: " + rows.length + " kho.");
  const r1177 = rows.find((r) => r[0] === "1177");
  log("  → code 1177 THẬT là: " + (r1177 ? r1177.join(" | ") : "(không có trong template)"));
  rows.filter((r) => /MATERIAL/i.test(r[1]) && /MTG|MASTIGE/i.test(r[1])).forEach((r) => log("  → MATERIAL MTG: " + r.join(" | ")));
  rows.filter((r) => /GARMENT/i.test(r[1])).slice(0, 6).forEach((r) => log("  → GARMENT: " + r.join(" | ")));

  const r2 = await (await fetch(GAS, { method: "POST", redirect: "follow", headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "pc_save_whcode", key: PC_KEY, replace: true, rows }) })).json();
  log("pc_save_whcode:", JSON.stringify(r2));
  log("✓ XONG — danh mục mã kho giờ lấy từ CHÍNH template import.");
})();
