/**
 * qc-plg-popup.mjs — QC tab Planogram của Audit Factory: MÀU sơ đồ + POP-UP chi tiết 1 ô
 * (bản đồng bộ với Audit Hasaki, 14/08/2026).
 *
 * Mở factory/index.html bằng Edge headless, sang tab Planogram, đo màu thật của ô + nền khung,
 * rồi mở pop-up 1 ô và chụp lại. Bắt luôn console/pageerror — render "trông ổn" mà console đỏ
 * thì vẫn là hỏng.
 *
 *   node qc-plg-popup.mjs                → chụp bản đang sửa
 *   node qc-plg-popup.mjs <đường-dẫn>    → chụp một bản HTML khác (đối chứng bản cũ)
 *
 * ⚠ BẪY HEADLESS: document.timeline KHÔNG chạy trong Edge headless nên mọi @keyframes đứng ở
 * khung hình ĐẦU — .panel có `animation:fadeUp both` (from{opacity:0}) sẽ chụp ra TRANG TRẮNG dù
 * DOM đủ 161 ô. Không phải lỗi trang. Vì vậy phải tắt animation trước khi chụp.
 */
import path from "node:path"; import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer";
import { EDGE_PATH } from "./token-store.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const FILE = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(DIR, "..", "factory", "index.html");
const TEN = process.argv[3] || "qc-plg";
const OUT = path.join(DIR, ".exports");
fs.mkdirSync(OUT, { recursive: true });

const b = await puppeteer.launch({ headless: "new", executablePath: EDGE_PATH, args: ["--no-sandbox", "--allow-file-access-from-files"] });
const p = await b.newPage();
await p.setViewport({ width: 1560, height: 1000, deviceScaleFactor: 2 });
const loi = [];
p.on("console", (m) => { if (m.type() === "error") loi.push("console: " + m.text()); });
p.on("pageerror", (e) => loi.push("pageerror: " + e.message));

await p.goto(pathToFileURL(FILE).href, { waitUntil: "domcontentloaded", timeout: 60000 });
await p.evaluate(() => showTab("plg"));
await p.waitForFunction(() => document.querySelectorAll("#plgMap .pg-o").length > 0, { timeout: 40000 });
await new Promise((r) => setTimeout(r, 2500));
await p.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}" });

const doSoDo = await p.evaluate(() => {
  const cells = [...document.querySelectorAll("#plgMap .pg-o")];
  const bg = (el) => (el ? getComputedStyle(el).backgroundColor : "");
  const c0 = cells[0] && cells[0].querySelector("rect.bg");
  return {
    soO: cells.length,
    nenKhung: bg(document.querySelector("#plgMap .pg-wrap")),
    nenPanel: bg(document.querySelector("#plgMap .panel")),
    sheenConLai: document.querySelectorAll("#plgMap rect.sheen").length,
    gradConLai: document.querySelectorAll("#plgMap linearGradient").length,
    oDau: c0 ? { fill: getComputedStyle(c0).fill, stroke: getComputedStyle(c0).stroke, dash: getComputedStyle(c0).strokeDasharray } : null,
    mucSo: cells[0] ? getComputedStyle(cells[0].querySelector("text")).fill : "",
    ycOk: !!(window.PLG && PLG.yc && PLG.yc.ok), ycCo: !!(window.PLG && PLG.yc && PLG.yc.co),
    soDongDanhMuc: Object.keys((window.PLG && PLG.by) || {}).length,
  };
});
console.log("SƠ ĐỒ:", doSoDo);
await (await p.$("#plgMap")).screenshot({ path: path.join(OUT, TEN + "-map.png") });

await p.evaluate(() => plgOpen("F0-KHO-510-08"));
await new Promise((r) => setTimeout(r, 500));
const doPop = await p.evaluate(() => {
  const m = document.getElementById("plgmodal");
  const q = (s) => document.getElementById(s);
  return {
    hien: !!(m && m.classList.contains("show")),
    tieuDe: q("plgmTitle") && q("plgmTitle").textContent,
    phuDe: q("plgmSub") && q("plgmSub").textContent,
    link: q("plgmPg") && q("plgmPg").textContent,
    href: q("plgmPg") && q("plgmPg").href,
    soChipNgay: document.querySelectorAll("#plgmBody .pg-vthist").length,
    hang: [...document.querySelectorAll("#plgmBody .pg-vtrow")].map((r) => r.querySelector("label").textContent + " = " + r.querySelector("div").textContent.trim().slice(0, 130)),
    the: [...document.querySelectorAll("#plgmBody .pg-vtcard")].map((c) => c.textContent.replace(/\s+/g, " ").trim().slice(0, 220)),
  };
});
console.log("POP-UP:", JSON.stringify(doPop, null, 1));
await (await p.$("#plgmodal .modalbox")).screenshot({ path: path.join(OUT, TEN + "-popup.png") });

console.log(loi.length ? "LỖI:\n" + loi.join("\n") : "✓ không có lỗi console");
console.log("ảnh:", path.join(OUT, TEN + "-map.png"), "·", path.join(OUT, TEN + "-popup.png"));
await b.close();
