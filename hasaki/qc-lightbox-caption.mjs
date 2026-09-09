import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer";
import { EDGE_PATH } from "./token-store.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, ".exports");
fs.mkdirSync(OUT, { recursive: true });

const FILE_QC = path.resolve(DIR, "kiemsoatkho", "qc-sidebar.html");
const IMG_SAMPLE = "C:\\Users\\lechitam\\Downloads\\screenshot-1788945021787.png";
let b64Img = "";
if (fs.existsSync(IMG_SAMPLE)) {
  b64Img = "data:image/png;base64," + fs.readFileSync(IMG_SAMPLE).toString("base64");
}

const b = await puppeteer.launch({
  headless: "new",
  executablePath: EDGE_PATH,
  args: ["--no-sandbox", "--disable-web-security", "--allow-file-access-from-files", "--window-size=1440,960"]
});

const p = await b.newPage();
await p.setViewport({ width: 1440, height: 960, deviceScaleFactor: 1.5 });

const loi = [];
p.on("pageerror", (e) => loi.push("pageerror: " + e.message));
p.on("console", (m) => { if (m.type() === "error") loi.push("console: " + m.text()); });

const url = pathToFileURL(FILE_QC).href + "?company=hasaki&tab=planogram";
await p.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForFunction(() => window.HPLANOGRAM != null && window.HPLANOGRAM._S != null, { timeout: 60000 });

// Ca 1: Yêu cầu 27769301 (F0-A1-505-02), mở ảnh 6 / 16 (vị trí con F0-A1-505-02-04-06)
console.log("\n=== KIỂM THỬ CA 1: F0-A1-505-02-04-06 (Ảnh 6/16) ===");
await p.evaluate((imgData) => {
  const req505 = {
    id: "27769301",
    loc: "F0-A1-505-02-04-01",
    ngay: "2026-09-08",
    email: "lechitam@hasaki.vn",
    at: "2026-09-08 14:35:10",
    anh: Array(16).fill(imgData)
  };
  window.HPLANOGRAM._S.yc.rows.push(req505);
  window.HPLANOGRAM.openAnh(req505.id, 5);
}, b64Img);

await new Promise((r) => setTimeout(r, 1200));

const capInfo1 = await p.evaluate(() => {
  const cap = document.getElementById("lbCaption");
  const cnt = document.getElementById("lbCount");
  return {
    hien: cap && getComputedStyle(cap).display !== "none",
    title: cap ? (cap.querySelector(".lb-title") || {}).innerText : "",
    sub: cap ? (cap.querySelector(".lb-sub") || {}).innerText : "",
    meta: cap ? (cap.querySelector(".lb-meta") || {}).innerText : "",
    count: cnt ? cnt.innerText : ""
  };
});
console.log("Kết quả Ca 1:", JSON.stringify(capInfo1, null, 2));
await p.screenshot({ path: path.join(OUT, "qc-subloc-505-02-04-06.png") });

// Ca 2: Đúng ảnh mẫu screenshot-1788945021787: Kệ 08 · dãy 514 (ảnh 2 / 16 -> F0-A1-514-08-04-02)
console.log("\n=== KIỂM THỬ CA 2: F0-A1-514-08 (Ảnh 2/16 -> F0-A1-514-08-04-02) ===");
await p.evaluate((imgData) => {
  const req514 = {
    id: "27769302",
    loc: "F0-A1-514-08-04-01",
    ngay: "2026-09-09",
    email: "lechitam@hasaki.vn",
    at: "2026-09-09 10:20:00",
    anh: Array(16).fill(imgData)
  };
  window.HPLANOGRAM._S.yc.rows.push(req514);
  window.HPLANOGRAM.openAnh(req514.id, 1);
}, b64Img);

await new Promise((r) => setTimeout(r, 1200));

const capInfo2 = await p.evaluate(() => {
  const cap = document.getElementById("lbCaption");
  const cnt = document.getElementById("lbCount");
  return {
    hien: cap && getComputedStyle(cap).display !== "none",
    title: cap ? (cap.querySelector(".lb-title") || {}).innerText : "",
    sub: cap ? (cap.querySelector(".lb-sub") || {}).innerText : "",
    meta: cap ? (cap.querySelector(".lb-meta") || {}).innerText : "",
    count: cnt ? cnt.innerText : ""
  };
});
console.log("Kết quả Ca 2:", JSON.stringify(capInfo2, null, 2));
await p.screenshot({ path: path.join(OUT, "qc-subloc-514-08-04-02.png") });

if (loi.length) console.log("Lỗi console:", loi);
await b.close();
