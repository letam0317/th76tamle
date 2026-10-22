/* QC 19/10: điện thoại (UA Android, 390×844) xem Xác minh qua đường hầm Cloudflare.
 * Đạt khi: thanh bên có 3 mục Theo tác vụ / Theo máy / Nhật ký; mỗi mục tải dữ liệu qua địa chỉ *.trycloudflare.com (không gọi 127.0.0.1);
 * gọi đường hầm KHÔNG phiên → 401 (api, trang gốc, tệp). Chặn mọi POST trừ đổi phiên (không ghi dữ liệu thật).
 * Dùng: node qc-dien-thoai-duong-ham.mjs [--live]   (--live = audit-dc.pages.dev, mặc định bản QC localhost:8123) */
import fs from "node:fs";
import puppeteer from "puppeteer-core";
import { phienQC } from "./xacminh-dang-nhap.mjs";
const PHIEN_QC = phienQC();
const LIVE = process.argv.includes("--live");
const GOC = LIVE ? "https://audit-dc.pages.dev/retail/" : "http://localhost:8123/kiemsoatkho/";
const HAM = JSON.parse(fs.readFileSync(new URL("./.duong-ham-591.url", import.meta.url), "utf8")).url;   // 20/10 không còn tệp công khai summary/xm-may-chu.json
let dat = 0, truot = 0; const ok = (d, t) => { d ? dat++ : truot++; console.log((d ? "  ✓ " : "  ✗ ") + t); };
const ngu = (ms) => new Promise((r) => setTimeout(r, ms));

for (const [p, ma] of [["/api/du-lieu", 401], ["/api/quyet-dinh", 401], ["/", 401], ["/clip/x.mp4", 401], ["/api/bo-cai-pc", 401], ["/api/ping", 200]]) {
  const r = await fetch(HAM + p, { headers: { "user-agent": "Mozilla/5.0" } }).catch(() => ({ status: 0 }));
  ok(r.status === ma, "không phiên " + p + " → " + r.status + " (cần " + ma + ")");
}
const b = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: "new" });
const pg = await b.newPage(); const loi = [], goi127 = [], goiHam = [];
pg.on("pageerror", (e) => loi.push(e.message));
await pg.setUserAgent("Mozilla/5.0 (Linux; Android 14; 23116PN5BC) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36");
await pg.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
/* 22/10: tệp địa chỉ công khai đã bỏ (20/10) và phiên giả «qc» không qua được pcBangPh ⇒ QC giả lập máy ĐÃ nhớ đường hầm (hx-ham) như điện thoại thật sau lần đầu */
await pg.evaluateOnNewDocument((hx, ham) => { if (window.top !== window) return; try { localStorage.setItem("hx-phien", hx); localStorage.setItem("hx-ham", ham); localStorage.removeItem("hx-api"); localStorage.removeItem("hx-loc"); localStorage.setItem("tk-phien", "qc");
  localStorage.setItem("tk-nho", JSON.stringify({ ts: Date.now(), nguoi: { id: "qc", ten: "QC", vaiTro: "quantri" }, quyen: { "r.xacminh": "lam", "r.maytram": "lam" } })); } catch (e) {} }, PHIEN_QC, HAM);
await pg.setRequestInterception(true);
pg.on("request", (r) => { const u = r.url();
  if (/127\.0\.0\.1:8591/.test(u)) goi127.push(u);
  if (u.startsWith(HAM)) goiHam.push(u.replace(HAM, ""));
  if (r.method() !== "GET" && r.method() !== "OPTIONS" && r.method() !== "HEAD") return r.abort();
  r.continue(); });
await pg.goto(GOC + "?tab=xacminh", { waitUntil: "networkidle2", timeout: 60000 });
const coMay = await pg.waitForFunction(() => window.__HX_MAY_CHU && window.HXACMINH, { timeout: 40000 }).then(() => 1, () => 0);
ok(coMay, "điện thoại dò ra máy chủ qua đường hầm + nạp module Xác minh (HX_API=" + await pg.evaluate(() => window.HX_API) + ")");
const muc = await pg.evaluate(() => [...document.querySelectorAll("#sideNav .s-item")].map((e) => e.textContent.trim().replace(/\s*\d+$/, "")));
for (const t of ["Theo tác vụ", "Theo máy", "Nhật ký"]) ok(muc.some((m) => m.includes(t)), "thanh bên có mục «" + t + "»");
for (const [sub, sel, ten] of [["treo", "[data-p]", "Theo tác vụ"], ["cam", "[data-lid]", "Theo máy"], ["tg", "tr.hx-tg-nhom", "Nhật ký"]]) {
  if (!coMay) break;
  await pg.evaluate((s) => window.HXACMINH.sub(s), sub); await ngu(2500);
  const n = await pg.evaluate((sel) => document.querySelectorAll(sel.startsWith("tr.") ? sel : "#hxBody " + sel).length, sel);
  const ngang = await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok(n > 0, ten + ": có dữ liệu (" + n + " phần tử)");
  ok(ngang <= 1, ten + ": trang không kéo ngang (" + ngang + "px)");
  await pg.screenshot({ path: "C:/Users/lechitam/AppData/Local/Temp/claude/C--Users-lechitam-New-folder/7859bf53-989a-4347-a586-f8673c0da2ff/scratchpad/dt-" + sub + ".png" });
}
if (coMay) { await pg.evaluate(() => window.HXACMINH.sub("cam")); await ngu(1500);
  const id = await pg.evaluate(() => (document.querySelector("#hxBody [data-lid]") || {}).getAttribute?.("data-lid"));
  if (id) { await pg.evaluate((i) => window.HXACMINH.moLuotId(i), id); await ngu(2500);
    const v = await pg.evaluate(() => { const x = document.querySelector("#mBody video, #mBody img"); return x ? (x.currentSrc || x.src || "") : ""; });
    ok(v.startsWith("https://"), "mở 1 lượt Theo máy: clip/ảnh tải qua đường hầm (" + v.slice(0, 60) + ")"); } }
ok(goi127.length === 0, "không gọi 127.0.0.1 (" + goi127.length + ")");
ok(goiHam.length > 0, "có gọi qua đường hầm (" + goiHam.length + " lượt)");
ok(loi.length === 0, "không lỗi trang " + loi.slice(0, 2).join(" | "));
/* 22/10 user «đăng nhập rồi điện thoại vẫn không thấy Máy trạm/Theo tác vụ/Theo máy/Nhật ký»: mở trang KHI CHƯA đăng nhập, rồi mới đăng nhập
   (tk-doi) ⇒ phải dò lại máy chủ và hiện đủ 4 mục (bản cũ chốt cờ dò 1 lần ⇒ chỉ còn Máy trạm) */
{ const ctx = await b.createBrowserContext(); const p2 = await ctx.newPage();
  await p2.setUserAgent("Mozilla/5.0 (Linux; Android 14; 23116PN5BC) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36");
  await p2.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await p2.setRequestInterception(true);
  p2.on("request", (r) => { if (/127.0.0.1:8591/.test(r.url())) return r.abort(); if (r.method() !== "GET" && r.method() !== "OPTIONS" && r.method() !== "HEAD") return r.abort(); r.continue(); });
  await p2.goto(GOC, { waitUntil: "networkidle2", timeout: 60000 });
  const truoc = await p2.evaluate(() => document.querySelectorAll("#sideNav .s-khoa").length);
  ok(truoc === 1, "chưa đăng nhập: nhóm Xác minh khoá (" + truoc + ")");
  await p2.evaluate((hx, ham) => { localStorage.setItem("hx-phien", hx); localStorage.setItem("hx-ham", ham); localStorage.setItem("tk-phien", "qc");
    const q = { "r.xacminh": "lam", "r.maytram": "lam" }; localStorage.setItem("tk-nho", JSON.stringify({ ts: Date.now(), nguoi: { id: "qc", ten: "QC", vaiTro: "quantri" }, quyen: q }));
    window.TK.phien = "qc"; window.TK.nguoi = { id: "qc", ten: "QC", vaiTro: "quantri" }; window.TK.quyen = q; document.dispatchEvent(new CustomEvent("tk-doi")); }, PHIEN_QC, HAM);
  await p2.waitForFunction(() => document.querySelectorAll("#sideNav .s-item[data-sub]").length >= 3, { timeout: 30000 }).catch(() => {});
  const sau = await p2.evaluate(() => [...document.querySelectorAll("#sideNav .s-item")].map((e) => e.textContent.trim().replace(/s*d+$/, "")));
  for (const t of ["Theo tác vụ", "Theo máy", "Máy trạm", "Nhật ký"]) ok(sau.some((m) => m.includes(t)), "đăng nhập SAU khi mở trang → có «" + t + "»");
  await ctx.close(); }
await b.close();
console.log((truot ? "✗ " : "✓ ") + dat + "/" + (dat + truot) + " đạt");
process.exit(truot ? 1 : 0);
