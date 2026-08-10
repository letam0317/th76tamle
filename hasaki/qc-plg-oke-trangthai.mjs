/**
 * qc-plg-oke-trangthai.mjs — KIỂM ĐIỀU KIỆN TÔ NỀN, không phải kiểm màu.
 * Dữ liệu thật của kho nguyên liệu đang 161/161 ô là "chưa khai báo lịch" nên nhánh "ô CÓ trạng
 * thái vệ sinh -> tô nền" KHÔNG chạy lần nào trên trang thật. Ở đây bơm trạng thái giả (ghi đè
 * plgState theo số thứ tự ô) để chụp được sơ đồ TRỘN: ô có dữ liệu tô nền đặc, ô thường trong suốt.
 * Rồi kiểm tiếp: tắt 1 nhóm ở chú giải -> ô mờ đi; BẬT LẠI -> phải quay đúng về nền trong suốt.
 */
import path from "node:path"; import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer";
import { EDGE_PATH } from "./token-store.js";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(DIR, "..", "factory", "index.html");
const OUT = path.join(DIR, ".exports");
fs.mkdirSync(OUT, { recursive: true });

const b = await puppeteer.launch({ headless: "new", executablePath: EDGE_PATH, args: ["--no-sandbox", "--allow-file-access-from-files"] });
const p = await b.newPage();
await p.setViewport({ width: 1560, height: 1000, deviceScaleFactor: 2 });
const loi = [];
p.on("console", (m) => { if (m.type() === "error") loi.push("console: " + m.text()); });
p.on("pageerror", (e) => loi.push("pageerror: " + e.message));
await p.goto(pathToFileURL(FILE).href, { waitUntil: "networkidle2", timeout: 60000 });
await p.evaluate(() => showTab("plg"));
await p.waitForFunction(() => document.querySelectorAll(".pg-o").length > 0, { timeout: 30000 });

const demTheoLop = () => p.evaluate(() => {
  const c = [...document.querySelectorAll(".pg-o")];
  const dem = (k) => c.filter((x) => x.classList.contains(k)).length;
  const nen = (k) => { const x = c.find((y) => y.classList.contains(k)); return x ? getComputedStyle(x.querySelector("rect.bg")).fill : "-"; };
  return { da: dem("vs-da"), chua: dem("vs-chua"), nduyet: dem("vs-nduyet"), nolich: dem("vs-nolich"), dim: dem("dim"),
    nenDa: nen("vs-da"), nenChua: nen("vs-chua"), nenNduyet: nen("vs-nduyet"), nenThuong: nen("vs-nolich") };
});

for (const th of ["tokyo", "solar"]) {
  await p.evaluate((t) => setTheme(t), th);

  // ---- 1. THẬT: 161/161 ô thường
  await p.evaluate(() => { if (window._pgStateGoc) { plgState = window._pgStateGoc; delete window._pgStateGoc; plgRender(); } });
  await new Promise((r) => setTimeout(r, 400));
  console.log("[" + th + "] DU LIEU THAT   " + JSON.stringify(await demTheoLop()));

  // ---- 2. GIẢ: rải 4 trạng thái để nhánh tô nền chạy
  await p.evaluate(() => {
    window._pgStateGoc = plgState;
    let i = 0;
    plgState = function () { return ["da", "chua", "nduyet", "nolich", "nolich"][i++ % 5]; };
    plgRender();
  });
  await new Promise((r) => setTimeout(r, 500));
  console.log("[" + th + "] TRANG THAI GIA " + JSON.stringify(await demTheoLop()));
  await (await p.$(".pg-wrap")).screenshot({ path: path.join(OUT, `oke-tt-${th}.png`) });

  // ---- 3. TẮT 1 nhóm ở chú giải -> phải có ô .dim
  await p.evaluate(() => { const x = [...document.querySelectorAll(".pg-legbox button")].find((e) => /GARMENT/i.test(e.textContent)); if (x) x.click(); });
  await new Promise((r) => setTimeout(r, 400));
  const locBat = await demTheoLop();
  // ---- 4. BẬT LẠI -> .dim phải về 0, nền ô thường phải y như bước 2
  await p.evaluate(() => { const x = [...document.querySelectorAll(".pg-legbox button")].find((e) => /GARMENT/i.test(e.textContent)); if (x) x.click(); });
  await new Promise((r) => setTimeout(r, 400));
  const locTat = await demTheoLop();
  console.log("[" + th + "] LOC bat: dim=" + locBat.dim + " | LOC huy: dim=" + locTat.dim +
    " | nen o thuong sau khi huy loc = " + locTat.nenThuong +
    (locTat.dim === 0 && locTat.nenThuong === locBat.nenThuong ? "  -> VE DUNG NEN TRONG SUOT" : "  -> !! KHONG VE DUNG"));
}

console.log(loi.length ? "LỖI:\n  " + loi.join("\n  ") : "✓ Không có lỗi console/pageerror.");
await b.close();
