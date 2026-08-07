/**
 * qc-plg-factory.mjs — chụp THẬT tab Planogram của Audit Factory (không giả lập DOM).
 * Mở factory/index.html bằng Edge headless, bấm sang tab Planogram, chờ sơ đồ dựng xong rồi chụp.
 * Bắt luôn lỗi console/pageerror — render "trông ổn" mà console đỏ thì vẫn là hỏng.
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
await p.click("#ttPlg");
await p.waitForFunction(() => document.querySelectorAll("#plgContent .pg-o").length > 0, { timeout: 30000 });
await new Promise((r) => setTimeout(r, 700));

const do_ = await p.evaluate(() => {
  const cells = [...document.querySelectorAll("#plgContent .pg-o")];
  const svg = document.querySelector("#plgContent .pg-svg");
  const kpi = [...document.querySelectorAll("#plgSum .sm")].map((x) => x.querySelector(".l").textContent + "=" + x.querySelector(".k").textContent);
  const body = document.body;
  return {
    soO: cells.length,
    soDoanNen: document.querySelectorAll("#plgContent .pg-wall path").length,
    soChipDay: document.querySelectorAll("#plgContent .pg-dchip g").length,
    soNhanKhu: document.querySelectorAll("#plgContent .pg-khu text").length,
    viewBox: svg ? svg.getAttribute("viewBox") : "",
    khungPx: svg ? Math.round(svg.getBoundingClientRect().width) + "x" + Math.round(svg.getBoundingClientRect().height) : "",
    trong: cells.filter((c) => c.classList.contains("trong")).length,
    kpi, canhBao: (document.querySelector("#plgAlert .pg-alert") || {}).textContent ? true : false,
    chuGiai: document.getElementById("plgLegend").textContent.trim().slice(0, 160),
    tranNgang: body.scrollWidth > body.clientWidth + 1,
    
    footer: document.getElementById("loadinfo").textContent,
  };
});
console.log(JSON.stringify(do_, null, 1));

await p.screenshot({ path: path.join(OUT, "plg-factory.png"), fullPage: true });
// mở pop-up 1 ô để kiểm tra
await p.click("#plgContent .pg-o");   // click chuot THAT: SVGGElement khong co .click() trong Edge
await new Promise((r) => setTimeout(r, 500));
const mo = await p.evaluate(() => ({
  hien: document.getElementById("plgmodal").classList.contains("show"),
  tieuDe: document.getElementById("plgmTitle").textContent,
  dong: document.querySelectorAll("#plgmBody tr").length,
  noiDung: document.getElementById("plgmBody").textContent.replace(/\s+/g, " ").slice(0, 220),
}));
console.log("POP-UP:", JSON.stringify(mo, null, 1));
await p.screenshot({ path: path.join(OUT, "plg-factory-popup.png") });

console.log(loi.length ? "LỖI:\n  " + loi.join("\n  ") : "✓ Không có lỗi console/pageerror.");
await b.close();
