/**
 * qc-chinh-thanh-ben.mjs — đo BỘ CHỈNH thanh bên kiểu khung (17/10, user «rã tất cả thành phần/khung ở thanh bên phải để t tự di chuyển ở bản QC»).
 *  Mở Xác minh › Theo máy ở bản QC (localhost:8123), bật «Chỉnh bố cục» (bộ chỉnh tắt khi navigator.webdriver → giả false), rồi bằng CHUỘT THẬT:
 *  C1 mỗi khung + mỗi thành phần có tay nắm «⠿» · C2 tay nắm không che nội dung (nằm trong phần chừa đầu) · C3 kéo «Máy gợi ý» sang khung phải → nằm ở khung đó
 *  · C4 kéo mép phải khung trái → đổi số cột · C5 «+ Khung mới» → có khung trống thả được · C6 Hoàn tác (Ctrl+Z) trả bố cục · C7 «Về mặc định»
 *  · C8 lượt lưu gửi đúng thanhBen.may (BẮT gói POST, KHÔNG cho đi tới máy chủ — không ghi dash-bocuc.js) · C9 không lỗi trang.
 *  Chạy: node qc-chinh-thanh-ben.mjs [--anh=thư mục]
 */
import puppeteer from "puppeteer-core";
import { phienQC } from "./xacminh-dang-nhap.mjs"; const PHIEN_QC = phienQC();
const A = Object.fromEntries(process.argv.slice(2).map((x) => x.replace(/^--/, "").split("=")));
const ngu = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: "new" });
const loi = []; let dat = 0; const ok = (dk, ten) => { if (dk) dat++; else loi.push(ten); console.log((dk ? "  ✓ " : "  ✗ ") + ten); };
const p = await b.newPage();
await p.evaluateOnNewDocument((hx) => { try { Object.defineProperty(navigator, "webdriver", { get: () => false });
  if (hx) localStorage.setItem("hx-phien", hx); localStorage.removeItem("hx-loc");
  localStorage.setItem("tk-phien", "qc"); localStorage.setItem("tk-nho", JSON.stringify({ ts: Date.now(), nguoi: { id: "qc", ten: "QC", vaiTro: "quantri" }, quyen: { "r.xacminh": "lam" } })); } catch (e) {} }, PHIEN_QC);
await p.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1 });
const con = [], goi = []; p.on("pageerror", (e) => con.push(e.message));
await p.setRequestInterception(true);
p.on("request", (r) => { if (r.method() === "POST" && /\/api\/dash\/retail\/bocuc$/.test(r.url())) { goi.push(r.postData()); return r.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, ver: 999 }) }); }
  return r.method() !== "GET" && r.method() !== "OPTIONS" ? r.abort() : r.continue(); });
await p.goto("http://localhost:8123/kiemsoatkho/?tab=xacminh", { waitUntil: "networkidle2", timeout: 60000 });
await p.waitForFunction(() => window.HXACMINH && window.__HX_MUC && document.getElementById("dashNut"), { timeout: 30000 });
await p.evaluate(() => window.HXACMINH.sub("cam")); await ngu(1500);
await p.evaluate(() => window.HXACMINH.moLuotDau()); await ngu(1200);
await p.click("#dashNut"); await ngu(900);
const tt = () => p.evaluate(() => { const L = document.querySelector("#mBody .hx-tb-luoi"); return {
  khung: [...L.children].filter((f) => f.classList.contains("hx-tb-khung")).map((f) => ({ id: f.dataset.tbk, rong: f.style.getPropertyValue("--tb-rong"), tay: !!f.querySelector(":scope>.dash-tb-k"), ds: [...f.querySelectorAll(".hx-tb-tp")].map((x) => x.dataset.tp) })),
  tayTp: [...L.querySelectorAll(".hx-tb-tp")].filter((x) => x.querySelector(":scope>.dash-tb-p")).length, tp: L.querySelectorAll(".hx-tb-tp").length,
  che: [...L.querySelectorAll(".hx-tb-tp")].filter((x) => { const t = x.querySelector(":scope>.dash-tb-p"); if (!t) return false; const r = t.getBoundingClientRect(), c = [...x.children].find((y) => !y.classList.contains("dash-sua-ui")); return c && c.getBoundingClientRect().top < r.bottom - 1; }).map((x) => x.dataset.tp),
  duong: (document.querySelector("#dashBang .dd") || {}).textContent }; });
const s0 = await tt();
ok(s0.khung.length === 2 && s0.khung.every((k) => k.tay) && s0.tayTp === s0.tp && s0.tp >= 5, "C1 2 khung + " + s0.tp + " thành phần đều có tay nắm · " + s0.duong);
ok(!s0.che.length, "C2 tay nắm không che nội dung " + JSON.stringify(s0.che));
if (A.anh) await p.screenshot({ path: A.anh + "/chinh-thanh-ben-0.png" });
const tam = (q) => p.evaluate((q) => { const e = document.querySelector(q); let r = e.getBoundingClientRect(); if (r.top < 60 || r.bottom > innerHeight) { e.scrollIntoView({ block: "center" }); r = e.getBoundingClientRect(); } return { x: r.left + Math.min(30, r.width / 2), y: r.top + r.height / 2, r: r.right, b: r.bottom, l: r.left, t: r.top, w: r.width, h: r.height }; }, q);
const keo = async (tu, den) => { await p.mouse.move(tu.x, tu.y); await p.mouse.down(); for (let i = 1; i <= 12; i++) { await p.mouse.move(tu.x + (den.x - tu.x) * i / 12, tu.y + (den.y - tu.y) * i / 12); await ngu(20); } await p.mouse.up(); await ngu(500); };
/* C3 kéo «Máy gợi ý» thả vào nửa dưới thành phần «Câu hỏi» (khung phải) → đứng sau Câu hỏi */
let d = await tam('[data-tp="seghi"]'), a = await tam('[data-tp="trangthai"]>.dash-tb-p .keo'); d = await tam('[data-tp="seghi"]');
await keo(a, { x: d.l + d.w / 2, y: d.t + d.h * 0.8 });
let s1 = await tt(); const k3 = s1.khung.find((k) => k.ds.includes("seghi"));
ok(k3 && k3.ds.indexOf("trangthai") === k3.ds.indexOf("seghi") + 1, "C3 kéo Trạng thái lên ngay sau Sẽ ghi nhận " + JSON.stringify(s1.khung.map((k) => k.ds)));
/* C4 kéo mép phải khung trái sang trái ~2 cột */
const mep = await p.evaluate(() => { const f = document.querySelector('#mBody .hx-tb-khung:nth-child(2)>.dash-mep.p'), r = f.getBoundingClientRect(), L = document.querySelector("#mBody .hx-tb-luoi").getBoundingClientRect(); return { x: r.left + 3, y: r.top + 60, cot: L.width / 12 }; });
await keo(mep, { x: mep.x - mep.cot * 2, y: mep.y });
let s2 = await tt(); ok(s2.khung[1].rong === "6", "C4 kéo mép phải khung clip → " + s2.khung[1].rong + "/12 cột (mong 6)");
/* C5 + Khung mới → khung trống, thả «Lỗi» vào */
await p.evaluate(() => [...document.querySelectorAll("#dashBang button")].find((x) => x.dataset.a === "tbmoi").click()); await ngu(500);
let s3 = await tt(); const moi = s3.khung[s3.khung.length - 1];
ok(s3.khung.length === 3 && !moi.ds.length, "C5 + Khung mới → khung trống thứ 3");
d = await tam("#mBody .hx-tb-khung:last-child"); a = await tam('[data-tp="quyetdinh"]>.dash-tb-p .keo'); d = await tam("#mBody .hx-tb-khung:last-child");
await keo(a, { x: d.l + d.w / 2, y: d.t + d.h - 20 });
s3 = await tt(); ok(s3.khung[2].ds.join() === "quyetdinh", "C5 thả Quyết định vào khung trống " + JSON.stringify(s3.khung.map((k) => k.ds)));
if (A.anh) await p.screenshot({ path: A.anh + "/chinh-thanh-ben-1.png" });
/* C6 Ctrl+Z 1 lần → Lỗi về khung cũ, khung 4 trống */
await p.mouse.click(5, 450); await p.keyboard.down("Control"); await p.keyboard.press("z"); await p.keyboard.up("Control"); await ngu(600);
let s4 = await tt(); ok(s4.khung.length === 3 && !s4.khung[2].ds.length && s4.khung[0].ds.includes("quyetdinh"), "C6 Hoàn tác trả Quyết định về khung Ảnh ghi nhận " + JSON.stringify(s4.khung.map((k) => k.ds)));
/* C8 gói lưu */
await ngu(1000); const j = goi.length ? JSON.parse(goi[goi.length - 1]) : null;
ok(j && j.thanhBen && j.thanhBen.may && j.thanhBen.may.khung.length === 3 && j.tab && j.khoi, "C8 lưu gửi thanhBen.may (" + goi.length + " lượt, chặn tại trình duyệt)");
/* C7 Về mặc định */
await p.evaluate(() => [...document.querySelectorAll("#dashBang button")].find((x) => x.dataset.a === "tbgoc").click()); await ngu(600);
let s5 = await tt(); ok(JSON.stringify(s5.khung.map((k) => k.ds)) === JSON.stringify([["anh", "seghi", "dsnguoi", "trangthai", "quyetdinh"], ["clip"]]) && s5.khung[0].rong === "4", "C7 Về mặc định " + JSON.stringify(s5.khung.map((k) => k.ds)));
/* tắt chỉnh → không còn tay nắm, khung trống ẩn */
await p.evaluate(() => [...document.querySelectorAll("#dashBang button")].find((x) => x.dataset.a === "xong").click()); await ngu(500);
const het = await p.evaluate(() => document.querySelectorAll("#mBody .dash-sua-ui").length); ok(het === 0, "C10 Xong chỉnh → không còn tay nắm (" + het + ")");
ok(!con.length, "C9 không lỗi trang " + con.join(" | "));
await b.close();
console.log(loi.length ? "✗ " + dat + " đạt, " + loi.length + " lỗi" : "✓ " + dat + "/" + dat + " đạt");
process.exit(loi.length ? 1 : 0);
