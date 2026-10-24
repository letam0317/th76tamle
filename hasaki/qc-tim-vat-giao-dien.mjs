/**
 * qc-tim-vat-giao-dien.mjs — đo dòng «Khoanh đồ vật» dưới dải 72 giờ (Xác minh › Quyết định phiếu) · 24/10
 *  dữ liệu THẬT từ 8591 qua trang thử 8123, chặn mọi lượt ghi ở tầng mạng (POST bị huỷ).
 *  K1 phiếu có dải → hiện dòng máy tìm + nút «Khoanh đồ vật» · K2 bấm nút → bấm khung KHÔNG gọi thu hẹp (chế độ kéo ô)
 *  · K3 kéo chuột THẬT trên khung 1 → ô viền hiện, nút «Gửi máy tìm» + «Kéo lại» · K4 «Kéo lại» xoá ô · K5 không kéo ngang trang
 *  · K6 điện thoại: nút ≥ 32 px cao, dòng không tràn · K7 không lỗi trang.
 *  Chạy: node qc-tim-vat-giao-dien.mjs [--id=…] [--anh=thư mục]
 */
import puppeteer from "puppeteer-core";
import { phienQC } from "./xacminh-dang-nhap.mjs"; const PHIEN_QC = phienQC();
const A = Object.fromEntries(process.argv.slice(2).map((x) => x.replace(/^--/, "").split("=")));
const UNG_VIEN = A.id ? [A.id] : ["14212168", "14180434", "14246123", "14079520"];
const MAY = [{ ten: "may-tinh-1600", w: 1600, h: 900, mob: false }, { ten: "iphone", w: 390, h: 844, mob: true }];
const ngu = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: "new" });
const loi = []; let dat = 0; const ok = (dk, ten) => { if (dk) dat++; else loi.push(ten); };
try {
  for (const m of MAY) {
    const p = await b.newPage();
    await p.evaluateOnNewDocument((hx) => { try { if (hx) localStorage.setItem("hx-phien", hx); localStorage.removeItem("hx-loc");
      localStorage.setItem("tk-phien", "qc"); localStorage.setItem("tk-nho", JSON.stringify({ ts: Date.now(), nguoi: { id: "qc", ten: "QC", vaiTro: "quantri" }, quyen: { "r.xacminh": "lam" } })); } catch (e) { /* */ } }, PHIEN_QC);
    await p.setViewport({ width: m.w, height: m.h, deviceScaleFactor: 1, isMobile: m.mob, hasTouch: m.mob });
    const con = [], post = []; p.on("pageerror", (e) => con.push(e.message));
    await p.setRequestInterception(true); p.on("request", (r) => { if (r.method() !== "GET" && r.method() !== "OPTIONS") { post.push(r.url()); r.abort(); } else r.continue(); });
    await p.goto("http://localhost:8123/kiemsoatkho/?tab=xacminh", { waitUntil: "networkidle2", timeout: 60000 });
    await p.waitForFunction(() => window.HXACMINH && window.HXACMINH.coDuLieu(), { timeout: 40000 });
    let id = null;
    for (const u of UNG_VIEN) {
      if (!(await p.evaluate((x) => window.HXACMINH.moPhieuId(x), u))) continue;
      await ngu(800);
      const coLui = await p.evaluate(() => { const nut = [...document.querySelectorAll(".hx-qd-nguon [data-ng]")].find((e) => /72|lùi|Dải/i.test(e.textContent + e.title)); if (nut) nut.click(); return !!document.querySelector(".hx-lui") || !!nut; });
      await ngu(600);
      if (coLui && (await p.$(".hx-lui"))) { id = u; break; }
    }
    ok(!!id, m.ten + " K0 không mở được phiếu nào có dải 72 giờ (" + UNG_VIEN.join(",") + ")");
    if (!id) { await p.close(); continue; }
    const nut = await p.$("#qdKhoanh");
    ok(!!nut, m.ten + " K1 thiếu nút «Khoanh đồ vật» (" + id + ")");
    if (!nut) { await p.close(); continue; }
    const cao = await p.evaluate(() => document.querySelector("#qdKhoanh").getBoundingClientRect().height);
    if (m.mob) ok(cao >= 32, m.ten + " K6 nút Khoanh cao " + cao + " px < 32");
    await nut.click(); await ngu(300);
    const truoc = post.length;
    const o0 = await p.$('.hx-lui [data-o="0"]'); await o0.evaluate((e) => e.scrollIntoView({ block: "center" })); await ngu(200);
    const r = await o0.boundingBox();
    await p.mouse.move(r.x + r.width * 0.3, r.y + r.height * 0.4); await p.mouse.down();
    await p.mouse.move(r.x + r.width * 0.5, r.y + r.height * 0.6, { steps: 6 }); await p.mouse.move(r.x + r.width * 0.6, r.y + r.height * 0.75, { steps: 6 }); await p.mouse.up();
    await ngu(400);
    ok(post.length === truoc && !(await p.evaluate(() => { const c = document.getElementById("qdLuiChu"); return c && !c.hidden; })), m.ten + " K2 bấm khung khi đang kéo ô vẫn gọi thu hẹp");
    const o = await p.evaluate(() => { const d = document.querySelector('.hx-lui [data-o="0"] div'); return d && d.style.display === "block" ? d.getBoundingClientRect().width : 0; });
    ok(o > 10, m.ten + " K3 không thấy ô viền sau khi kéo");
    ok(!!(await p.$("#qdKhoanhGui")) && !!(await p.$("#qdKhoanhLai")), m.ten + " K3 thiếu nút Gửi máy tìm / Kéo lại");
    if (A.anh) await p.screenshot({ path: A.anh + "/tim-vat-" + m.ten + ".png" });
    if (await p.$("#qdKhoanhLai")) { await p.click("#qdKhoanhLai"); await ngu(200);
      ok(await p.evaluate(() => { const d = document.querySelector('.hx-lui [data-o="0"] div'); return !d || d.style.display === "none"; }), m.ten + " K4 «Kéo lại» không xoá ô"); }
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), m.ten + " K5 trang bị kéo ngang");
    if (m.mob) ok(await p.evaluate(() => { const d = document.getElementById("qdKhoanhDong"); return !d || d.scrollWidth <= d.clientWidth + 1; }), m.ten + " K6 dòng khoanh tràn ngang");
    ok(!con.length, m.ten + " K7 lỗi trang: " + con.slice(0, 2).join(" | "));
    console.log(m.ten + ": phiếu " + id);
    await p.close();
  }
} finally { await b.close(); }
console.log(loi.length ? "HỎNG " + loi.length + "/" + (dat + loi.length) + ":\n - " + loi.join("\n - ") : "ĐẠT " + dat + "/" + dat);
process.exit(loi.length ? 1 : 0);
