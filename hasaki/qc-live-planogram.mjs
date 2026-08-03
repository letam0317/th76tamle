/* QC LIVE: mở đúng URL người dùng đưa, đo thời gian dựng màn hình + kiểm "đi làm mà không báo cáo"
   cho HÔM NAY và cho MỘT NGÀY CŨ. Không đụng dữ liệu, chỉ đọc. */
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";
import { EDGE_PATH } from "./token-store.js";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), ".exports");
const URL = "https://letam0317.github.io/kiemsoatkho/?company=hasaki&tab=planogram";

const b = await puppeteer.launch({ headless: "new", executablePath: EDGE_PATH, args: ["--window-size=1440,900"] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.4 });
const loi = [];
p.on("pageerror", (e) => loi.push("PAGEERROR: " + e.message));
p.on("console", (m) => { if (m.type() === "error") loi.push("CONSOLE: " + m.text().slice(0, 160)); });

const t0 = Date.now();
await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForSelector("#hpToday .hp-tile", { timeout: 60000 });
console.log("⏱  màn hình có nội dung sau " + (Date.now() - t0) + "ms");
await new Promise((r) => setTimeout(r, 6000));   // để bậc 3 (chấm công theo ngày) về

const doc = async () => p.evaluate(() => {
  var tiles = [].map.call(document.querySelectorAll("#hpToday .hp-tile"), function (t) {
    return ((t.querySelector(".l") || {}).textContent || "") + " = " + ((t.querySelector(".k") || {}).textContent || "") +
           "  [" + ((t.querySelector(".s") || {}).textContent || "") + "]";
  });
  var tog = document.querySelector(".hp-ptnhac .hp-ptchip.tog");
  var chip = document.querySelector("#hpToday .hp-chip");
  return { ngay: chip ? chip.textContent.trim() : "?", tiles: tiles, panel: tog ? tog.textContent.replace(/\s+/g, " ").trim() : null };
});

const inRa = (d, nhan) => {
  console.log("\n=== " + nhan + " · " + d.ngay + " ===");
  d.tiles.forEach((t) => console.log("   " + t));
  console.log("   panel gom theo NV: " + (d.panel || "KHÔNG CÓ"));
};
inRa(await doc(), "HÔM NAY");
await p.screenshot({ path: path.join(OUT, "qc-live-pg-homnay.png") });

await p.evaluate(() => HPLANOGRAM.chonNgay("hqua"));
await new Promise((r) => setTimeout(r, 3000));
inRa(await doc(), "NGÀY CŨ");
await p.screenshot({ path: path.join(OUT, "qc-live-pg-ngaycu.png") });

/* Pop-up 1 ô để chắc ảnh báo cáo (tab VESINH-ANH mới) vẫn hiện */
await p.evaluate(() => HPLANOGRAM.chonNgay("hnay"));
await new Promise((r) => setTimeout(r, 1500));
await p.evaluate(() => HPLANOGRAM.openViTri("F0-A8-502-01-01-01"));
await new Promise((r) => setTimeout(r, 4000));
const anh = await p.evaluate(() => document.querySelectorAll("#hpVtBody img").length);
console.log("\nPop-up ô F0-A8-502-01-01-01: " + anh + " ảnh báo cáo");
await p.screenshot({ path: path.join(OUT, "qc-live-pg-vitri.png") });

console.log(loi.length ? "\n⚠ LỖI TRANG:\n" + loi.join("\n") : "\n✓ Không có lỗi JS nào trên trang.");
await b.close();
