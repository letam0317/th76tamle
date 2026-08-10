/**
 * qc-plg-soikho.mjs — KIỂM CHIỀU LỌC của hộp chú giải "Kho giữ tồn".
 * Lỗi cũ: bấm WH-MATERIAL-MTG thì chính MTG bị mờ, Garment lại sáng (PLG.tat mang nghĩa "TẮT nhóm").
 * Đúng phải là: bấm nhóm nào -> ĐÚNG nhóm đó sáng, phần còn lại mờ; bấm lại -> tất cả sáng.
 * Kiểm bằng cách đếm ô .dim theo TỪNG KHO thật (đọc màu thanh accent), không tin vào số tổng.
 */
import path from "node:path"; import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer";
import { EDGE_PATH } from "./token-store.js";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const FILE = process.argv[2] || pathToFileURL(path.resolve(DIR, "..", "factory", "index.html")).href;
const OUT = path.join(DIR, ".exports");
fs.mkdirSync(OUT, { recursive: true });

const b = await puppeteer.launch({ headless: "new", executablePath: EDGE_PATH, args: ["--no-sandbox", "--allow-file-access-from-files"] });
const p = await b.newPage();
await p.setViewport({ width: 1560, height: 1000, deviceScaleFactor: 2 });
const loi = [];
p.on("console", (m) => { if (m.type() === "error") loi.push("console: " + m.text()); });
p.on("pageerror", (e) => loi.push("pageerror: " + e.message));
await p.goto(FILE, { waitUntil: "networkidle2", timeout: 90000 });
await p.evaluate(() => showTab("plg"));
await p.waitForFunction(() => document.querySelectorAll(".pg-o").length > 0, { timeout: 45000 });
/* PHẢI CHỜ DỮ LIỆU KHO (tab mastige/garment) VỀ rồi mới bấm: hộp chú giải dựng trước khi có tồn
   thì chỉ có đúng mục "Không có tồn", bấm MTG không trúng nút nào và QC báo oan là "ngược". */
await p.waitForFunction(() => [...document.querySelectorAll(".pg-legbox button")].some((x) => /MTG/i.test(x.textContent)), { timeout: 60000 });
await new Promise((r) => setTimeout(r, 600));

/* Đếm ô SÁNG / MỜ theo kho — kho nhận diện bằng màu thanh accent, đúng thứ mắt người nhìn thấy. */
const trangThai = () => p.evaluate(() => {
  const nhom = {};
  [...document.querySelectorAll(".pg-o")].forEach((c) => {
    const v = c.querySelector(".pg-vach");
    const k = v ? v.getAttribute("fill") : "(khong co ton)";
    nhom[k] = nhom[k] || { sang: 0, mo: 0 };
    if (c.classList.contains("dim")) nhom[k].mo++; else nhom[k].sang++;
  });
  const nut = [...document.querySelectorAll(".pg-legbox button")].map((x) =>
    x.textContent.replace(/\s+/g, " ").trim().slice(0, 26) + "[" + (x.className || "thuong") + "/" + x.getAttribute("aria-pressed") + "]");
  return { nhom, nut };
});

const bam = (re) => p.evaluate((r) => {
  const x = [...document.querySelectorAll(".pg-legbox button")].find((e) => new RegExp(r, "i").test(e.textContent));
  if (x) x.click(); return !!x;
}, re.source);

const in_ = (nhan, t) => {
  console.log("\n" + nhan);
  Object.keys(t.nhom).forEach((k) => console.log("   " + k.padEnd(16) + " sáng " + String(t.nhom[k].sang).padStart(3) + "  ·  mờ " + String(t.nhom[k].mo).padStart(3)));
  console.log("   nút: " + t.nut.join("  "));
};

in_("BAN DAU (chua soi gi)", await trangThai());

await bam(/MTG/); await new Promise((r) => setTimeout(r, 400));
const tMTG = await trangThai(); in_("SAU KHI BAM  >> WH - MATERIAL - MTG <<", tMTG);
await (await p.$(".pg-wrap")).screenshot({ path: path.join(OUT, "soikho-mtg.png") });

await bam(/GARMENT/); await new Promise((r) => setTimeout(r, 400));
const tGAR = await trangThai(); in_("SAU KHI BAM  >> WH - MATERIAL - GARMENT <<", tGAR);
await (await p.$(".pg-wrap")).screenshot({ path: path.join(OUT, "soikho-garment.png") });

await bam(/GARMENT/); await new Promise((r) => setTimeout(r, 400));
const tHuy = await trangThai(); in_("BAM LAI GARMENT (bo soi)", tHuy);

/* PHÁN XỬ: khi soi MTG thì nhóm xanh #2563eb phải KHÔNG có ô nào mờ, và nhóm đỏ #f43f5e phải
   KHÔNG có ô nào sáng. Soi Garment thì ngược lại. Bỏ soi thì không còn ô mờ nào. */
const g = (t, k) => t.nhom[k] || { sang: 0, mo: 0 };
const ok1 = g(tMTG, "#2563eb").mo === 0 && g(tMTG, "#2563eb").sang > 0 && g(tMTG, "#f43f5e").sang === 0;
const ok2 = g(tGAR, "#f43f5e").mo === 0 && g(tGAR, "#f43f5e").sang > 0 && g(tGAR, "#2563eb").sang === 0;
const ok3 = Object.keys(tHuy.nhom).every((k) => tHuy.nhom[k].mo === 0);
console.log("\nPHAN XU:");
console.log("  bam MTG     -> dung MTG sang, Garment mo   : " + (ok1 ? "DUNG" : "!! NGUOC"));
console.log("  bam GARMENT -> dung Garment sang, MTG mo   : " + (ok2 ? "DUNG" : "!! NGUOC"));
console.log("  bam lai     -> tat ca sang tro lai         : " + (ok3 ? "DUNG" : "!! CON O MO"));
console.log(loi.length ? "LỖI:\n  " + loi.join("\n  ") : "✓ Không có lỗi console/pageerror.");
await b.close();
process.exit(ok1 && ok2 && ok3 ? 0 : 1);
