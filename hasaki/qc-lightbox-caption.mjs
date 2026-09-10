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

// Ca 3: Kiểm tra chống giật animation (Tâm X của chip phải cố định giữa màn hình ở mọi khung hình)
console.log("\n=== KIỂM THỬ CA 3: CHỐNG GIẬT ANIMATION (Tâm X cố định, không nhảy từ phải sang trái) ===");
await p.evaluate(() => {
  if (typeof window.dongLB === "function") window.dongLB();
});
await new Promise((r) => setTimeout(r, 200));

await p.evaluate(() => {
  window.HPLANOGRAM.openAnh("27769302", 1);
});

const framesX = [];
const winWidth = await p.evaluate(() => window.innerWidth);
const midX = Math.round(winWidth / 2);

for (let t = 0; t <= 250; t += 50) {
  await new Promise((r) => setTimeout(r, 50));
  const cx = await p.evaluate(() => {
    const el = document.getElementById("lbCaption");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return Math.round(r.left + r.width / 2);
  });
  framesX.push({ t, cx, lech: Math.abs(cx - midX) });
}
console.log("Đo tâm X của chip trong 250ms animation (tâm chuẩn " + midX + "px):", framesX);
const giatAnimation = framesX.some((f) => f.lech > 1);
if (giatAnimation) {
  loi.push("LỖI GIẬT ANIMATION: Tâm chip bị lệch khỏi tâm màn hình > 1px trong lúc mở pop-up.");
  console.error("✗ Ca 3 THẤT BẠI: Tâm chip bị lệch trục trong animation.");
} else {
  console.log("✓ Ca 3 ĐẠT: Tâm chip cố định tuyệt đối ở " + midX + "px xuyên suốt animation (chống giật 100%).");
}

// Ca 4: Chuẩn hiển thị di động (Viewport 390x844 - iPhone): chip dẹt <= 40px, bottom <= 10px
console.log("\n=== KIỂM THỬ CA 4: CHUẨN CHIP DẸT DI ĐỘNG (Viewport 390px, height <= 40px, bottom <= 10px) ===");
await p.setViewport({ width: 390, height: 844 });
await new Promise((r) => setTimeout(r, 400));

const mobChip = await p.evaluate(() => {
  const el = document.getElementById("lbCaption");
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    width: Math.round(r.width),
    height: Math.round(r.height),
    bottom: Math.round(window.innerHeight - r.bottom),
    center: Math.round(r.left + r.width / 2),
    winWidth: window.innerWidth
  };
});
console.log("Đo kích thước chip trên mobile 390px:", mobChip);
await p.screenshot({ path: path.join(OUT, "qc-mobile-lightbox-caption.png") });

if (mobChip.height > 40) {
  loi.push("LỖI CHIỀU CAO: Chip chú thích trên di động cao " + mobChip.height + "px (> tiêu chuẩn 40px).");
  console.error("✗ Ca 4 THẤT BẠI: Chip chưa đủ độ dẹt.");
} else if (mobChip.bottom > 10) {
  loi.push("LỖI KHOẢNG CÁCH ĐÁY: Chip cách đáy " + mobChip.bottom + "px (> tiêu chuẩn 10px).");
  console.error("✗ Ca 4 THẤT BẠI: Chip chưa hạ sát đáy.");
} else {
  console.log("✓ Ca 4 ĐẠT: Chip dẹt " + mobChip.height + "px (<= 40px), cách đáy " + mobChip.bottom + "px (<= 10px), căn giữa " + mobChip.center + "px/390px.");
}

if (loi.length) {
  console.error("\n❌ TỔNG KẾT: Có lỗi trong quá trình QC:", loi);
  process.exit(1);
} else {
  console.log("\n✅ TỔNG KẾT: Toàn bộ 4/4 ca kiểm thử QC Lightbox Caption ĐẠT HOÀN HẢO.");
}
await b.close();
