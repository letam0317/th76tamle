/**
 * qc-tvt-live.mjs — mở THẬT factory/index.html bằng Edge headless, sang tab "Tồn kho bất thường",
 * chờ mục "Tồn tại vị trí" đọc xong tab Sheet `ton-vitri` rồi kiểm số + mở pop-up + chụp ảnh.
 * Render "trông ổn" mà console đỏ thì vẫn tính là hỏng.
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
await p.setViewport({ width: 1560, height: 1100, deviceScaleFactor: 2 });
const loi = [];
p.on("console", (m) => { if (m.type() === "error") loi.push("console: " + m.text()); });
p.on("pageerror", (e) => loi.push("pageerror: " + e.message));

await p.goto(pathToFileURL(FILE).href, { waitUntil: "networkidle2", timeout: 60000 });
await p.evaluate(() => showTab("abn"));   // click thẳng dễ vướng lớp skeleton lúc trang còn nạp tab 1
await p.waitForFunction(() => window.TVT && window.TVT.ok && document.querySelectorAll("#tvtWrap .abntile").length > 0, { timeout: 60000 });
await new Promise((r) => setTimeout(r, 900));

const do_ = await p.evaluate(() => {
  const the = [...document.querySelectorAll("#tvtWrap .abntile")].map((x) => x.querySelector(".l").textContent + "=" + x.querySelector(".k").textContent);
  const chip = [...document.querySelectorAll("#tvtWrap .kkbar .kktab")].map((x) => x.textContent.trim());
  const vt = [...document.querySelectorAll("#tvtWrap .abnchart .abnrow")].length;
  return { the, chip, vt, nRow: TVT.rows.length, nScope: tvtRowsInScope().length,
    baiCho: TVT.rows.filter((r) => /^F0-A0/i.test(r.loc)).length,
    coGrp: TVT.rows.filter((r) => r.grp && r.grp !== "0").length };
});
console.log("thẻ  :", do_.the.join(" | "));
console.log("chip :", do_.chip.join(" | "));
console.log("dòng :", do_.nRow, "· trong phạm vi", do_.nScope, "· thanh vị trí+kho", do_.vt);
console.log("chốt : dòng ở bãi chờ F0-A0 =", do_.baiCho, "(phải 0) · dòng CÓ group =", do_.coGrp, "(phải 0)");
await p.screenshot({ path: path.join(OUT, "qc-tvt-tab.png"), fullPage: false });

/* mở pop-up từ thanh vị trí đầu tiên */
await p.evaluate(() => document.querySelector("#tvtWrap .abnchart .abnrow").click());
await p.waitForFunction(() => document.querySelector("#tvtmodal").classList.contains("show") &&
  document.querySelectorAll("#tvtmBody tr").length > 0, { timeout: 20000 });
await new Promise((r) => setTimeout(r, 700));
const pop = await p.evaluate(() => ({
  tieuDe: document.getElementById("tvtmTitle").textContent,
  tong: document.getElementById("tvtmSum").textContent,
  cot: [...document.querySelectorAll("#tvtmodal thead th")].map((t) => t.textContent.trim()),
  dong: document.querySelectorAll("#tvtmBody tr").length,
  loc: [...document.querySelectorAll("#tvtmFilters .combo input")].map((i) => i.getAttribute("data-fk") + "=" + i.value),
  mau: [...document.querySelectorAll("#tvtmBody tr")].slice(0, 2).map((tr) => [...tr.children].map((td) => td.textContent.trim()).join(" | ")),
}));
console.log("\npop-up:", pop.tieuDe);
console.log("  cột :", pop.cot.join(" | "));
console.log("  lọc :", pop.loc.join(" · "));
console.log("  ", pop.tong);
pop.mau.forEach((m) => console.log("   " + m));
await p.screenshot({ path: path.join(OUT, "qc-tvt-popup.png"), fullPage: false });

/* tick 1 dòng -> giỏ tạo lệnh kiểm kê phải nhận */
const gio = await p.evaluate(() => {
  const c = document.querySelector("#tvtmBody .pcr"); if (!c) return "không có ô tick";
  c.click();
  return "giỏ = " + pcCount() + " · lý do: " + (Object.values(PC.sel)[0] || {}).src;
});
console.log("  tick:", gio);

console.log(loi.length ? "\n✗ LỖI:\n  " + loi.join("\n  ") : "\n✓ không có lỗi console");
await b.close();
process.exit(loi.length ? 1 : 0);
