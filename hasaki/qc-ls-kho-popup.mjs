/**
 * qc-ls-kho-popup.mjs — đo khối «Ai tác động ô … trước giờ ghi nhận» trong pop-up phiếu (tab Xác minh › Theo phiếu), dữ liệu THẬT từ 8591,
 *  chặn mọi lượt ghi ở tầng mạng. L1 đúng thứ tự gần giờ ghi nhận nhất trước · L2 bấm lượt → phát đúng clip · L3 không kéo ngang
 *  · L4 dòng lượt cao ≥40px (điện thoại) · L5 chữ ≥10,5px · L6 thanh nguồn không phình thêm nút · L7 không lỗi trang.
 *  Chạy: node qc-ls-kho-popup.mjs [--id=13808708] [--anh=thư mục]
 */
import puppeteer from "puppeteer-core";
import { phienQC } from "./xacminh-dang-nhap.mjs"; const PHIEN_QC = phienQC();   // 12/10 phần Xác minh cần đăng nhập — bộ đo tự cấp phiên 1 giờ
const A = Object.fromEntries(process.argv.slice(2).map((x) => x.replace(/^--/, "").split("=")));
const ID = A.id || "13808708";
const MAY = [{ ten: "iphone", w: 390, h: 844, mob: true }, { ten: "may-tinh", w: 1366, h: 768, mob: false }];
const b = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: "new" });
const loi = []; let dat = 0; const ok = (dk, ten) => { if (dk) dat++; else loi.push(ten); };
for (const m of MAY) {
  const p = await b.newPage(); await p.evaluateOnNewDocument((hx) => { try { if (hx) localStorage.setItem("hx-phien", hx); } catch (e) {} }, PHIEN_QC); await p.setViewport({ width: m.w, height: m.h, deviceScaleFactor: 2, isMobile: m.mob, hasTouch: m.mob });
  const con = []; p.on("pageerror", (e) => con.push(e.message));
  await p.setRequestInterception(true); p.on("request", (r) => (r.method() !== "GET" && r.method() !== "OPTIONS" ? r.abort() : r.continue()));
  await p.goto("http://localhost:8123/kiemsoatkho/?tab=xacminh", { waitUntil: "networkidle2", timeout: 60000 });
  await p.waitForFunction(() => window.HXACMINH && window.__HX_MUC, { timeout: 30000 });
  await p.evaluate(() => { localStorage.removeItem("hx-loc"); window.HXACMINH.sub("treo"); }); await new Promise((r) => setTimeout(r, 600));
  await p.evaluate(() => { const i = document.querySelector("#hxFilters input"); i.value = "510-07-04-05"; i.dispatchEvent(new Event("input")); }); await new Promise((r) => setTimeout(r, 600));
  const moDuoc = await p.evaluate((id) => { const r = [...document.querySelectorAll('[data-p="' + id + '"]')].find((e) => e.getBoundingClientRect().height > 0); if (!r) return false; r.querySelector("td, .cl-body").click(); return true; }, ID);
  ok(moDuoc, m.ten + ": tìm thấy phiếu " + ID); await new Promise((r) => setTimeout(r, 900));
  const d = await p.evaluate((mob) => {
    const L = [...document.querySelectorAll("#mBody .hx-lan")], gio = L.map((e) => e.querySelector(".gio").firstChild.textContent);
    const nho = [...document.querySelectorAll("#mBody .hx-lan *, #mBody .hx-qd-o")].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 10.5).map((e) => e.className);
    return { n: L.length, gio, cao: Math.min(...L.map((e) => e.getBoundingClientRect().height)), ngang: document.documentElement.scrollWidth - innerWidth,
      nut: document.querySelectorAll("#mBody .hx-qd-nguon button").length, nho, tieuDe: (document.querySelector("#mBody .hx-qd-o .lbl") || {}).textContent };
  }, m.mob);
  const ms = d.gio.map((g) => Date.parse("2026-" + g.slice(3, 5) + "-" + g.slice(0, 2) + "T" + g.slice(6) + ":00"));
  ok(d.n === 8 && ms.every((x, i) => !i || x <= ms[i - 1]), m.ten + ": 8 lượt, gần nhất trước (" + d.gio.join(", ") + ")");
  ok(d.ngang <= 1, m.ten + ": kéo ngang " + d.ngang);
  ok(!m.mob || d.cao >= 40, m.ten + ": dòng lượt cao " + d.cao);
  ok(!d.nho.length, m.ten + ": chữ nhỏ " + d.nho.slice(0, 3));
  ok(d.nut <= 4, m.ten + ": thanh nguồn " + d.nut + " nút");
  await p.evaluate(() => document.querySelector("#mBody .hx-lan").click()); await new Promise((r) => setTimeout(r, 700));
  const src = await p.evaluate(() => (document.querySelector("#qdKhung video") || {}).src || "");
  ok(/LAN-0918210544/.test(decodeURIComponent(src)), m.ten + ": bấm lượt đầu phát clip 18/09 21:05 (" + src.slice(-50) + ")");
  if (A.anh) await p.screenshot({ path: A.anh + "/lskho-" + m.ten + ".png", fullPage: false });
  ok(!con.length, m.ten + ": lỗi trang " + con.slice(0, 2));
  await p.close();
}
await b.close();
console.log(loi.length ? "✗ " + dat + " đạt, " + loi.length + " lỗi:\n  " + loi.join("\n  ") : "✓ " + dat + "/" + dat + " đạt"); process.exit(loi.length ? 1 : 0);
