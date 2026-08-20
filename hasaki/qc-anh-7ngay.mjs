/**
 * qc-anh-7ngay.mjs — QC LIVE tầng ảnh 2 bậc của tab Planogram (18/08/2026).
 *
 * Kiểm đúng 3 điều, trên chính URL người dùng mở:
 *   1) Mở pop-up ô của HÔM NAY: có ảnh, và dashboard KHÔNG hề gọi tab VESINH-ANH-CU (đường nhanh
 *      giữ nguyên chi phí như trước khi có 7 ngày).
 *   2) Chuyển sang MỘT NGÀY CŨ (ngoài cửa sổ tab nhanh): dashboard mới gọi VESINH-ANH-CU, và
 *      pop-up hiện được ảnh của ngày đó (trước 18/08 là rỗng).
 *   3) Không có lỗi console/pageerror.
 *
 *   node qc-anh-7ngay.mjs [locHomNay] [ngayCu] [locNgayCu]
 */
import path from "node:path"; import fs from "node:fs";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";
import { EDGE_PATH } from "./token-store.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, ".exports"); fs.mkdirSync(OUT, { recursive: true });
/* QC_URL=http://localhost:8080/... để soi bản đang sửa trước khi deploy (Pages/CDN có độ trễ). */
const URL = process.env.QC_URL || "https://letam0317.github.io/kiemsoatkho/?company=hasaki&tab=planogram";
const LOC_NAY = process.argv[2] || "F0-A1-501-05-04-01";
const NGAY_CU = process.argv[3] || "2026-08-12";
const LOC_CU  = process.argv[4] || "F0-A1-501-07-04-01";

const b = await puppeteer.launch({ headless: "new", executablePath: EDGE_PATH, args: ["--window-size=1440,900"] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900 });
const loi = [], goi = [];
p.on("pageerror", (e) => loi.push("pageerror: " + e.message));
p.on("console", (m) => { if (m.type() === "error") loi.push("console: " + m.text().slice(0, 200)); });
p.on("request", (r) => { const u = r.url(); const m = /[?&]tab=([^&]+)/.exec(u); if (/script\.google\.com/.test(u) && m) goi.push({ t: Date.now(), tab: decodeURIComponent(m[1]) }); });

const cho = (ms) => new Promise((r) => setTimeout(r, ms));
const demAnh = () => p.evaluate(() => ({
  anh: document.querySelectorAll("#hpVtBody img").length,
  tieuDe: (document.querySelector("#hpVtModal .hp-mtitle, #hpVtModal h3, #hpVtModal .hp-mhead") || {}).textContent || "",
  body: (document.getElementById("hpVtBody") || {}).innerText ? document.getElementById("hpVtBody").innerText.replace(/\s+/g, " ").slice(0, 160) : "",
}));
const daGoi = (tab) => goi.filter((g) => g.tab === tab).length;

await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForSelector("#hpToday .hp-tile", { timeout: 90000 });
await p.waitForFunction(() => window.HPLANOGRAM && document.querySelectorAll("#hpMap [data-l]").length > 0, { timeout: 90000 });
await cho(3000);
console.log("① màn hình dựng xong · tab đã gọi: " + [...new Set(goi.map((g) => g.tab))].join(", "));

/* ── HÔM NAY ─────────────────────────────────────────────── */
await p.evaluate((l) => HPLANOGRAM.openViTri(l), LOC_NAY);
await cho(9000);
const nay = await demAnh();
console.log(`② pop-up HÔM NAY ${LOC_NAY}: ${nay.anh} ảnh · gọi VESINH-ANH ×${daGoi("VESINH-ANH")} · VESINH-ANH-CU ×${daGoi("VESINH-ANH-CU")}`);
await p.screenshot({ path: path.join(OUT, "qc-anh7-homnay.png") });
const cuTruoc = daGoi("VESINH-ANH-CU");

/* ── NGÀY CŨ (ngoài cửa sổ tab nhanh) ─────────────────────── */
await p.evaluate(() => HPLANOGRAM.closeVt()); await cho(600);
await p.evaluate((d) => HPLANOGRAM.setNgay(d), NGAY_CU);
await p.evaluate((l) => HPLANOGRAM.openViTri(l), LOC_CU);
await cho(12000);
const cu = await demAnh();
console.log(`③ pop-up NGÀY CŨ ${NGAY_CU} ${LOC_CU}: ${cu.anh} ảnh · VESINH-ANH-CU ×${daGoi("VESINH-ANH-CU")}`);
await p.screenshot({ path: path.join(OUT, "qc-anh7-ngaycu.png") });

console.log("");
console.log(cuTruoc === 0 ? "✓ đường nhanh KHÔNG gánh tab ảnh cũ" : "✗ tab ảnh cũ bị gọi ngay ở lượt hôm nay (" + cuTruoc + " lượt)");
console.log(nay.anh > 0 ? "✓ ảnh hôm nay vẫn hiện" : "✗ hôm nay không có ảnh");
console.log(cu.anh > 0 ? "✓ ảnh NGÀY CŨ đã hiện (trước 18/08 là rỗng)" : "✗ ngày cũ vẫn không có ảnh");
console.log(loi.length ? "LỖI:\n" + loi.join("\n") : "✓ không có lỗi console");
await b.close();
