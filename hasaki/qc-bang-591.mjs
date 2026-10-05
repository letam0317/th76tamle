/**
 * qc-bang-591.mjs — bộ đo dashboard nội bộ bang-591 (BO-CHUAN mục 6–7: phạm vi đo = phạm vi lời hứa).
 *  3 máy (iPhone 390, Android 360, máy tính 1366) × 3 mục (Nhân viên · Cò camera · Phiếu treo) + ảnh to:
 *   L1 không kéo ngang trang · L2 chữ hiển thị ≥10,5px (điện thoại) · L3 vùng bấm ≥40px (điện thoại) · L4 không lỗi console/mạng
 *   L5 mỗi mục có nội dung · L6 ảnh tải được · L7 bấm quyết định «Không rõ» rồi hoàn tác (KHÔNG BAO GIỜ thử «Lập phiếu» — sẽ sinh phiếu thật)
 *   L8 «Lập phiếu» thiếu mã NV phải bị chặn, không ghi gì.
 *  Chạy: node qc-bang-591.mjs [--url=http://127.0.0.1:8591/] [--anh=thư mục chụp]
 */
import puppeteer from "puppeteer-core"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const A = Object.fromEntries(process.argv.slice(2).map((x) => x.replace(/^--/, "").split("=")));
const URL0 = A.url || "http://127.0.0.1:8591/";
const OUT = A.anh || path.join(DIR, ".exports", ".qc-bang-591"); fs.mkdirSync(OUT, { recursive: true });
const SO = path.join(DIR, ".exports", "bang-591-quyet-dinh.json");
const MAY = [{ ten: "iphone", w: 390, h: 844, dpr: 3, mob: true }, { ten: "android", w: 360, h: 800, dpr: 3, mob: true }, { ten: "may-tinh", w: 1366, h: 768, dpr: 1, mob: false }];
const TAB = ["nv", "cam", "treo"];
const b = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: "new" });
const loi = []; let dat = 0;
const ok = (dk, ten) => { if (dk) dat++; else loi.push(ten); return dk; };
for (const m of MAY) {
  const p = await b.newPage(); await p.setViewport({ width: m.w, height: m.h, deviceScaleFactor: m.dpr, isMobile: m.mob, hasTouch: m.mob });
  const con = []; p.on("console", (x) => x.type() === "error" && con.push(x.text())); p.on("pageerror", (e) => con.push(e.message));
  p.on("requestfailed", (r) => con.push("mạng: " + r.url())); p.on("response", (r) => r.status() >= 400 && con.push(r.status() + " " + r.url()));
  await p.goto(URL0, { waitUntil: "networkidle0" }); await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: "networkidle0" });
  for (const t of TAB) {
    await p.click(`#tabs button[data-tab="${t}"]`); await p.waitForFunction(() => document.querySelector("#noi").children.length > 0, { timeout: 8000 });
    if (t === "cam") { await p.evaluate(() => { LOC.cam = "tat-ca"; ve(); }); await p.evaluate(() => Promise.all([...document.images].map((i) => i.complete ? 1 : new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 8000); })))); }
    const d = await p.evaluate((mob) => {
      const vis = (e) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
      const nho = [], beBam = [];
      for (const e of document.querySelectorAll("body *")) {
        if (!vis(e) || e.closest("#hop") || e.closest("#bao")) continue;
        const coChu = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (coChu && parseFloat(getComputedStyle(e).fontSize) < 10.5) nho.push(e.tagName + "." + e.className + ": " + e.textContent.trim().slice(0, 30));
      }
      if (mob) for (const e of document.querySelectorAll("button,a,input,select")) { if (!vis(e) || e.closest("#hop") || e.classList.contains("tip")) continue; const r = e.getBoundingClientRect(); if (r.height < 40 - 0.5) beBam.push(e.tagName + " " + e.textContent.trim().slice(0, 25) + " " + Math.round(r.height) + "px"); }
      const anhHong = [...document.images].filter((i) => !i.closest("#hop") && i.complete && i.naturalWidth === 0 && i.getBoundingClientRect().top < innerHeight * 3).map((i) => i.src);
      return { ngang: document.documentElement.scrollWidth - innerWidth, nho: nho.slice(0, 5), soNho: nho.length, beBam: beBam.slice(0, 5), soBe: beBam.length, the: document.querySelectorAll("#noi .the").length, anhHong, anh: document.querySelectorAll("#noi img").length };
    }, m.mob);
    const ma = `${m.ten}/${t}`;
    ok(d.ngang <= 1, `${ma} L1 kéo ngang ${d.ngang}px`);
    if (m.mob) { ok(!d.soNho, `${ma} L2 ${d.soNho} chữ <10,5px: ${d.nho.join(" | ")}`); ok(!d.soBe, `${ma} L3 ${d.soBe} nút <40px: ${d.beBam.join(" | ")}`); }
    ok(d.the > 0, `${ma} L5 không có thẻ nào`);
    if (t === "cam") ok(!d.anhHong.length && d.anh > 0, `${ma} L6 ảnh hỏng ${d.anhHong.length}/${d.anh}`);
    await p.screenshot({ path: path.join(OUT, `${m.ten}-${t}.png`), fullPage: false });
    console.log(`${ma}: ${d.the} thẻ · ngang ${d.ngang} · chữ nhỏ ${d.soNho} · nút bé ${d.soBe}`);
  }
  // ảnh to (lightbox)
  await p.click(`#tabs button[data-tab="cam"]`); await p.evaluate(() => { LOC.cam = "tat-ca"; ve(); });
  await p.evaluate(() => (document.querySelector(".dai img") || document.querySelector(".anh"))?.click()); await new Promise((r) => setTimeout(r, 600));
  const hop = await p.evaluate(() => ({ mo: document.getElementById("hop").classList.contains("mo"), w: document.getElementById("hopAnh").naturalWidth }));
  ok(hop.mo && hop.w > 1000, `${m.ten} ảnh to: mở ${hop.mo}, rộng ${hop.w}`);
  await p.screenshot({ path: path.join(OUT, `${m.ten}-anh-to.png`) });
  await p.evaluate(() => dongHop());
  if (m.ten === "may-tinh") {
    // L8: «Lập phiếu» thiếu mã → bị chặn, không ghi
    const truoc = fs.existsSync(SO) ? fs.readFileSync(SO, "utf8") : "";
    const id = await p.evaluate(() => { const l = D.luot.find((x) => !x.qd && !x.may); if (!l) return null; document.getElementById("ma-" + l.id).value = ""; quyet(l.id, 0); return l.id; });
    await new Promise((r) => setTimeout(r, 800));
    ok(id && (fs.existsSync(SO) ? fs.readFileSync(SO, "utf8") : "") === truoc, `L8 «Lập phiếu» thiếu mã vẫn ghi (${id})`);
    // L7: «Không rõ» rồi bấm lại để hoàn tác
    if (id) {
      await p.evaluate((id) => quyet(id, 3), id); await new Promise((r) => setTimeout(r, 1200));
      const giua = JSON.parse(fs.existsSync(SO) ? fs.readFileSync(SO, "utf8") || "{}" : "{}");
      ok(giua[id]?.qd === "Không rõ – bỏ qua", `L7 ghi «Không rõ» không ăn (${JSON.stringify(giua[id])})`);
      await p.evaluate((id) => quyet(id, 3), id); await new Promise((r) => setTimeout(r, 1200));
      const sau = JSON.parse(fs.existsSync(SO) ? fs.readFileSync(SO, "utf8") || "{}" : "{}");
      ok(!sau[id], `L7 hoàn tác không ăn (${JSON.stringify(sau[id])})`);
    }
  }
  ok(!con.length, `${m.ten} L4 lỗi: ${con.slice(0, 3).join(" | ")}`);
  await p.close();
}
await b.close();
console.log(`\nQC bang-591: ${dat} đạt · ${loi.length} lỗi${loi.length ? "\n  ✗ " + loi.join("\n  ✗ ") : ""}\nẢnh chụp: ${OUT}`);
process.exit(loi.length ? 1 : 0);
