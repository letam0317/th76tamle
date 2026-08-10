/**
 * qc-plg-oke-can.mjs — SOI CẬN ô kệ: chụp 3 ô đầu dãy 501 ở deviceScaleFactor 5 để kiểm
 * góc bo của thân ô có ăn khớp với 2 góc bo trái của thanh accent hay không (mắt thường ở
 * cỡ thật 52x22px không phân biệt nổi). Kèm ảnh trạng thái hover + trạng thái mờ (dim).
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
await p.setViewport({ width: 1560, height: 1000, deviceScaleFactor: 5 });
await p.goto(pathToFileURL(FILE).href, { waitUntil: "networkidle2", timeout: 60000 });
await p.evaluate(() => showTab("plg"));
await p.waitForFunction(() => document.querySelectorAll(".pg-o").length > 0, { timeout: 30000 });
await new Promise((r) => setTimeout(r, 600));

const oCao = async () => await p.evaluate(() => {
  // 3 ô CAO nhất (dãy 507/506) — chỗ bo góc 4px thể hiện rõ nhất
  const cs = [...document.querySelectorAll(".pg-o")].filter((c) => c.querySelector(".pg-vach"));
  let best = cs[0], h = 0;
  cs.forEach((c) => { const r = c.getBoundingClientRect(); if (r.height > h) { h = r.height; best = c; } });
  const i = cs.indexOf(best);
  const rs = cs.slice(i, i + 3).map((c) => c.getBoundingClientRect());
  const x0 = Math.min(...rs.map((r) => r.left)), y0 = Math.min(...rs.map((r) => r.top));
  return { x: x0 - 4, y: y0 - 4, width: Math.max(...rs.map((r) => r.right)) - x0 + 8, height: Math.max(...rs.map((r) => r.bottom)) - y0 + 8, loc: best.getAttribute("data-l") };
});

let clip = await oCao();
console.log("Soi cận ô:", clip.loc, "-", Math.round(clip.width) + "x" + Math.round(clip.height), "px");
delete clip.loc;
await p.screenshot({ path: path.join(OUT, "oke-can-thuong.png"), clip });

// HOVER ô đầu tiên trong khung soi
await p.mouse.move(clip.x + 26, clip.y + 14);
await new Promise((r) => setTimeout(r, 400));
await p.screenshot({ path: path.join(OUT, "oke-can-hover.png"), clip });
await p.mouse.move(5, 5);

// TRẠNG THÁI MỜ: tắt nhóm GARMENT ở chú giải -> ô của nhóm đó chuyển .dim
await p.evaluate(() => {
  const b = [...document.querySelectorAll(".pg-legbox button")].find((x) => /GARMENT/i.test(x.textContent));
  if (b) b.click();
});
await new Promise((r) => setTimeout(r, 500));
const cd = await p.evaluate(() => {
  const c = document.querySelector(".pg-o.dim"); if (!c) return null;
  const r = c.getBoundingClientRect();
  return { x: r.left - 30, y: r.top - 10, width: 260, height: r.height + 20 };
});
if (cd) await p.screenshot({ path: path.join(OUT, "oke-can-dim.png"), clip: cd });
console.log(cd ? "✓ Đã chụp oke-can-thuong / -hover / -dim" : "⚠ không tìm được ô .dim");
await b.close();
