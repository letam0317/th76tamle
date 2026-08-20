/**
 * qc-home.mjs — mở THẬT factory/index.html bằng Edge headless và kiểm trang Tổng quan:
 *   ① mở trang là vào Tổng quan, đủ thẻ hạng mục, thanh bên có mục "Tổng quan" đứng đầu;
 *   ② bấm từng thẻ → vào đúng tab, thanh bên sáng đúng mục, các view khác đã ẩn;
 *   ③ quay lại Tổng quan → số trên thẻ cập nhật theo thứ vừa xem;
 *   ④ thẻ là <button> thật (bàn phím Enter mở được) — không phải div bấm được.
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
let loi = 0;
const ok = (m) => console.log("  ✓ " + m);
const xau = (m) => { loi++; console.log("  ✗ " + m); };

const b = await puppeteer.launch({ headless: "new", executablePath: EDGE_PATH, args: ["--no-sandbox", "--allow-file-access-from-files"] });
const p = await b.newPage();
await p.setViewport({ width: 1560, height: 1100, deviceScaleFactor: 2 });
const console_ = [];
p.on("console", (m) => { if (m.type() === "error") console_.push("console: " + m.text()); });
p.on("pageerror", (e) => console_.push("pageerror: " + e.message));
await p.goto(pathToFileURL(FILE).href, { waitUntil: "networkidle2", timeout: 60000 });
await p.waitForFunction(() => document.querySelectorAll("#viewHome .hm-card").length > 0, { timeout: 30000 });

console.log("① Màn hình đầu tiên");
const d1 = await p.evaluate(() => ({
  tab: TOPTAB,
  hienHome: !document.getElementById("viewHome").hidden,
  anKhac: ["viewStock", "viewKK", "viewAbn", "viewPlg", "viewNds", "viewCd"].every((id) => document.getElementById(id).hidden),
  the: [...document.querySelectorAll("#viewHome .hm-card")].map((c) => c.getAttribute("data-tab")),
  nhom: [...document.querySelectorAll("#viewHome .hm-h")].map((h) => h.childNodes[0].textContent.trim()),
  theTag: [...new Set([...document.querySelectorAll("#viewHome .hm-card")].map((c) => c.tagName))],
  sideDau: [...document.querySelectorAll("#sideNav .s-item")].map((x) => x.getAttribute("data-tab")),
  khaiBao: HOME_MUC.reduce((s, g) => s + g.items.length, 0),
}));
if (d1.tab !== "home" || !d1.hienHome) xau("mở trang không vào Tổng quan (TOPTAB=" + d1.tab + ")"); else ok("mở trang = Tổng quan");
if (!d1.anKhac) xau("còn view khác chưa ẩn"); else ok("6 view tab đều đang ẩn");
if (d1.the.length !== d1.khaiBao) xau("dựng " + d1.the.length + " thẻ / khai báo " + d1.khaiBao);
else ok(d1.the.length + " thẻ: " + d1.the.join(", "));
console.log("     nhóm: " + d1.nhom.join(" | "));
if (d1.theTag.join() !== "BUTTON") xau("thẻ không phải <button> (" + d1.theTag.join() + ") — mất focus ring + bàn phím");
else ok("thẻ là <button> thật");
if (d1.sideDau[0] !== "home") xau("thanh bên thiếu mục Tổng quan ở đầu: " + d1.sideDau.join(","));
else ok("thanh bên: " + d1.sideDau.join(" → "));
if (d1.sideDau.length !== d1.khaiBao + 1) xau("thanh bên " + d1.sideDau.length + " mục ≠ Tổng quan + " + d1.khaiBao + " tab");
else ok("thanh bên và trang Tổng quan cùng một danh sách tab");
await p.screenshot({ path: path.join(OUT, "qc-home.png"), fullPage: false });

console.log("② Bấm từng thẻ → vào đúng tab");
const VIEW = { stock: "viewStock", kk: "viewKK", abn: "viewAbn", plg: "viewPlg", sku: "viewNds", cd: "viewCd" };
for (const t of d1.the) {
  await p.evaluate((t) => document.querySelector('#viewHome .hm-card[data-tab="' + t + '"]').click(), t);
  await new Promise((r) => setTimeout(r, 250));
  const r = await p.evaluate((v) => ({ tab: TOPTAB, hien: !document.getElementById(v).hidden,
    homeAn: document.getElementById("viewHome").hidden,
    sang: [...document.querySelectorAll("#sideNav .s-item.on")].map((x) => x.getAttribute("data-tab")) }), VIEW[t]);
  if (r.tab !== t || !r.hien || !r.homeAn) xau(t + ": TOPTAB=" + r.tab + " hiện=" + r.hien + " home ẩn=" + r.homeAn);
  else if (r.sang.join() !== t) xau(t + ": thanh bên sáng '" + r.sang.join() + "'");
  else ok(t + " → " + VIEW[t] + ", thanh bên sáng đúng");
  await p.evaluate(() => showTab("home"));
  await new Promise((r2) => setTimeout(r2, 200));
}

console.log("③ Quay lại Tổng quan — số trên thẻ");
const d3 = await p.evaluate(() => [...document.querySelectorAll("#viewHome .hm-card")].map((c) => {
  const k = c.querySelector(".k"), s = k.querySelector("small");
  return { t: c.getAttribute("data-tab"), v: k.childNodes[0].textContent.trim(),
    l: s ? s.textContent : "", cong: k.classList.contains("nhan") };
}));
console.log("     " + d3.map((o) => o.t + "=" + o.v + (o.l ? " (" + o.l + ")" : "")).join(" | "));
const coSo = d3.filter((o) => !o.cong && o.v !== "—").length;
const cong = d3.filter((o) => o.cong);
if (!coSo) xau("không thẻ nào có số — homeNapNhe/so() không chạy");
else ok(coSo + "/" + d3.filter((o) => !o.cong).length + " thẻ dữ liệu có số thật");
if (cong.length !== 2 || cong.some((o) => o.v !== "Công cụ")) xau("thẻ công cụ phải dán nhãn 'Công cụ', đang là: " + cong.map((o) => o.t + "=" + o.v).join(", "));
else ok("2 thẻ công cụ dán nhãn 'Công cụ' (không hiện '— mở để xem')");

console.log("④ Bàn phím");
const d4 = await p.evaluate(() => {
  const c = document.querySelector('#viewHome .hm-card[data-tab="cd"]');
  c.focus();
  const duoc = document.activeElement === c;
  c.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  c.click();   // Enter trên <button> = click; mô phỏng đúng hành vi trình duyệt
  return { duoc, tab: TOPTAB };
});
if (!d4.duoc) xau("thẻ không nhận focus bàn phím");
else if (d4.tab !== "cd") xau("Enter trên thẻ không mở tab (TOPTAB=" + d4.tab + ")");
else ok("focus + Enter mở được tab");
await p.evaluate(() => showTab("home"));

console.log("⑤ Theme tối + điện thoại");
/* Trang mới mà chỉ ngắm ở theme sáng, màn rộng thì rất dễ lọt: chữ chìm trong nền tối, hoặc
   lưới thẻ tràn ngang trên điện thoại. Đo màu thật + đo bề ngang thật thay vì tin mắt. */
await p.evaluate(() => setTheme("tokyo"));
await new Promise((r) => setTimeout(r, 300));
const d5 = await p.evaluate(() => {
  const c = document.querySelector("#viewHome .hm-card");
  const s = getComputedStyle(c), st = getComputedStyle(c.querySelector(".hm-t"));
  const doc = (v) => v.match(/\d+/g).slice(0, 3).map(Number);
  const [br, bg2, bb] = doc(s.backgroundColor), [tr, tg, tb] = doc(st.color);
  const sang = (r, g, b) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return { nen: s.backgroundColor, chu: st.color, tuongPhan: Math.abs(sang(br, bg2, bb) - sang(tr, tg, tb)) };
});
if (d5.tuongPhan < 0.35) xau("theme tối: chữ/nền thẻ tương phản quá thấp (" + d5.tuongPhan.toFixed(2) + ") — " + d5.chu + " trên " + d5.nen);
else ok("theme Tokyo Night: tương phản chữ/nền thẻ " + d5.tuongPhan.toFixed(2));
await p.screenshot({ path: path.join(OUT, "qc-home-toi.png"), fullPage: false });
await p.evaluate(() => setTheme("hasaki"));

await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await new Promise((r) => setTimeout(r, 400));
const d6 = await p.evaluate(() => ({
  tranNgang: document.documentElement.scrollWidth > window.innerWidth + 1,
  cot: new Set([...document.querySelectorAll("#viewHome .hm-card")].map((c) => Math.round(c.getBoundingClientRect().left))).size,
  rong: Math.round(document.querySelector("#viewHome .hm-card").getBoundingClientRect().width),
}));
if (d6.tranNgang) xau("điện thoại: trang bị tràn ngang");
else if (d6.cot !== 1) xau("điện thoại: thẻ xếp " + d6.cot + " cột (phải 1)");
else ok("điện thoại 390px: 1 cột, thẻ rộng " + d6.rong + "px, không tràn ngang");
await p.screenshot({ path: path.join(OUT, "qc-home-mobile.png"), fullPage: false });

if (console_.length) { loi += console_.length; console.log("\n✗ LỖI CONSOLE:\n  " + console_.join("\n  ")); }
else console.log("\n✓ không có lỗi console");
await b.close();
console.log(loi ? "✗ " + loi + " lỗi" : "✓ QC trang Tổng quan: đạt");
process.exit(loi ? 1 : 0);
