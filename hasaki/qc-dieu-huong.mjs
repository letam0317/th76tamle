/**
 * qc-dieu-huong.mjs — đo KHUNG CHUNG Audit Retail ⇄ Audit Factory (13/10/2026, kế hoạch async-wibbling-haven giai đoạn A–C):
 *  N8 mỗi mục chỉ hiện 1 khung tab · N9 thanh bên không tràn (13/10)
 *  N1 mỗi mục thanh bên → link /<app>/<nhóm>/<mục> bỏ dấu (sinh từ thanh bên)   N2 mở THẲNG từng link sâu → đúng mục, không 404/lỗi trang
 *  N3 Lùi/Tới (history) về đúng mục   N4 link cũ ?tab=task tự đổi sang link mới   N5 nút cuối thanh bên sang dashboard kia
 *  N6 tên thương hiệu (Audit Retail / Audit Factory)   N7 Tổng quan: ô cao vừa nội dung (không khoảng trống > 12px dưới chip)
 * Chạy trên bản nội bộ 8123 (có trả trang cho link sâu). Chặn mọi lượt ghi ở tầng mạng (luật qc-khong-ghi-du-lieu-that).
 *   node qc-dieu-huong.mjs [--w=1440] [--anh=thư mục]
 */
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import { phienQC } from "./xacminh-dang-nhap.mjs";
const A = Object.fromEntries(process.argv.slice(2).map((x) => x.replace(/^--/, "").split("=")));
const W = +(A.w || 1440), ANH = A.anh || "", GOC = (A.goc || "http://localhost:8123").replace(/\/$/, "");   // --goc=https://qc.audit-dc.pages.dev
const PD = /\.pages\.dev$/.test(new URL(GOC).hostname);
if (ANH) fs.mkdirSync(ANH, { recursive: true });
const b = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: "new" });
let dat = 0; const loi = []; const ok = (dk, ten) => { if (dk) dat++; else loi.push(ten); console.log((dk ? "  ✓ " : "  ✗ ") + ten); };
const nghi = (ms) => new Promise((r) => setTimeout(r, ms));
async function moTrang() {
  const p = await b.newPage();
  await p.evaluateOnNewDocument((hx) => { try { localStorage.setItem("hx-phien", hx); } catch (e) {} }, (() => { try { return phienQC(); } catch (e) { return ""; } })());
  await p.setViewport({ width: W, height: 900, isMobile: W < 600, hasTouch: W < 600 });
  p.__hong = []; p.__loiTrang = [];
  p.on("pageerror", (e) => p.__loiTrang.push(e.message.slice(0, 120)));
  p.on("response", (r) => { const u = r.url(); if (r.status() === 404 && u.startsWith(GOC)) p.__hong.push(u.replace(GOC, "")); });
  await p.setRequestInterception(true); p.on("request", (r) => (/^(GET|OPTIONS|HEAD)$/.test(r.method()) ? r.continue() : r.abort()));
  return p;
}
const dsMuc = (p) => p.evaluate(() => [...document.querySelectorAll("#sideNav .s-item")].filter((x) => x.offsetParent !== null || true)
  .map((x, i) => ({ i, duong: window.adDuongMuc ? window.adDuongMuc(x) : "", ten: x.textContent.trim().replace(/\s*[\d.,]+$/, "") })));
const mucOn = (p) => p.evaluate(() => { const x = document.querySelector("#sideNav .s-item.on"); return x ? window.adDuongMuc(x) : ""; });

for (const app of [{ goc: "/retail/", ten: "Audit Retail", sang: "Audit Factory", dich: "/factory/" }, { goc: "/factory/", ten: "Audit Factory", sang: "Audit Retail", dich: PD ? "/retail/" : "/kiemsoatkho/" }]) {
  console.log("── " + app.ten + " (" + app.goc + ")");
  const p = await moTrang();
  await p.goto(GOC + app.goc, { waitUntil: "networkidle2", timeout: 90000 }); await nghi(6000);
  // N6
  const ten = await p.evaluate(() => ({ logo: (document.getElementById("adLogo") || {}).textContent || "", title: document.title }));
  ok(ten.logo.trim() === app.ten && ten.title === app.ten, "N6 tên: thanh bên «" + ten.logo.trim() + "» · tab trình duyệt «" + ten.title + "»");
  // N7 Tổng quan (13/10 phương án B): có thẻ chức năng · thẻ CÙNG HÀNG cao bằng nhau · ô chỉ số cùng hàng cao bằng nhau
  const o = await p.evaluate(() => { const hang = {}; [...document.querySelectorAll(".tq-the,.tq-o")].filter((c) => c.offsetParent !== null).forEach((c) => {
    const r = c.getBoundingClientRect(), k = c.className.split(" ")[0] + "@" + Math.round(r.top + scrollY); (hang[k] = hang[k] || new Set()).add(Math.round(r.height)); });
    return { the: document.querySelectorAll(".tq-the").length, lech: Object.entries(hang).filter(([, v]) => v.size > 1).map(([k, v]) => k + ":" + [...v].join("/")) }; });
  ok(o.the > 0 && !o.lech.length, "N7 Tổng quan " + o.the + " thẻ · thẻ cùng hàng cao bằng nhau" + (o.lech.length ? " — lệch " + o.lech.join(" | ") : ""));
  if (ANH) await p.screenshot({ path: ANH + "/" + app.goc.replace(/\//g, "") + "-" + W + "-tongquan.png" });
  // N1
  const muc = await dsMuc(p);
  const sai = []; const daQua = [], chong = [];
  for (const m of muc) {
    await p.evaluate((i) => document.querySelectorAll("#sideNav .s-item")[i].click(), m.i); await nghi(1800);
    const path = await p.evaluate(() => location.pathname), on = await mucOn(p), td = await p.evaluate(() => document.title);
    if (td !== (m.duong === app.goc ? app.ten : m.ten)) sai.push("tiêu đề cửa sổ «" + td + "» ≠ «" + (m.duong === app.goc ? app.ten : m.ten) + "»");   // T5 13/10
    daQua.push(path);
    /* N8 13/10 user «Kiểm kê lại hiển thị ở Trạng thái lưu trữ»: mỗi lúc chỉ 1 khung tab hiện (bộ áp bố cục từng đè thuộc tính hidden) */
    const hien = await p.evaluate(() => [...document.querySelectorAll("[id^=view],[id^=pane-]")].filter((v) => !v.parentElement.closest("[id^=view],[id^=pane-]") && v.offsetParent && v.getBoundingClientRect().height > 0).map((v) => v.id));
    const GOP = ["pane-kk+pane-htonbat", "viewKK+viewAbn"];   // 15/10 mục gộp «Tồn kho chính xác» = Kiểm kê (trên) + Bất thường (dưới) — chủ ý 2 khung
    if (hien.length > 1 && GOP.indexOf(hien.join("+")) < 0) chong.push(m.ten + ": " + hien.join("+"));
    if (path !== m.duong || on !== m.duong || !/^[a-z0-9/]+$/.test(path)) sai.push(m.ten + " → " + path + " (mong " + m.duong + ")");
  }
  ok(!chong.length, "N8 mỗi mục chỉ hiện 1 khung tab" + (chong.length ? " — " + chong.join(" | ") : ""));
  const tran = await p.evaluate(() => [...document.querySelectorAll("#sideNav .s-item")].filter((i) => i.offsetParent && i.scrollWidth > i.clientWidth + 1).map((i) => i.textContent.trim()));
  ok(!tran.length, "N9 thanh bên không tràn chữ/số" + (tran.length ? " — " + tran.join(" | ") : ""));
  ok(muc.length > 1 && !sai.length, "N1 " + muc.length + " mục thanh bên ↔ link: " + (sai.length ? sai.join(" | ") : daQua.join(" · ")));
  // N3 Lùi / Tới
  await p.goBack(); await nghi(1500); const lui = await p.evaluate(() => location.pathname), lOn = await mucOn(p);
  await p.goForward(); await nghi(1500); const toi = await p.evaluate(() => location.pathname), tOn = await mucOn(p);
  ok(lui === daQua[daQua.length - 2] && lOn === lui && toi === daQua[daQua.length - 1] && tOn === toi, "N3 Lùi → " + lui + " · Tới → " + toi);
  ok(!p.__hong.length && !p.__loiTrang.length, "N1/N3 không 404 · không lỗi trang" + (p.__hong.length ? " — 404: " + [...new Set(p.__hong)].slice(0, 3).join(", ") : "") + (p.__loiTrang.length ? " — " + p.__loiTrang[0] : ""));
  // N5 nút sang dashboard kia
  const ch = await p.evaluate(() => { const a = document.querySelector("#adChuyen a"); if (!a) return null; const r = a.getBoundingClientRect(); return { href: a.getAttribute("href"), chu: a.textContent.trim(), thay: r.width > 0 && r.bottom <= innerHeight + 1 }; });
  ok(ch && ch.chu.indexOf(app.sang) === 0 && ch.href === app.dich && ch.thay, "N5 nút cuối thanh bên «" + (ch && ch.chu) + "» → " + (ch && ch.href));
  if (ch) { await p.click("#adChuyen a"); await nghi(5000); const t2 = await p.evaluate(() => (document.getElementById("adLogo") || {}).textContent || ""); ok(t2.trim() === app.sang, "N5 bấm nút → mở " + t2.trim()); }
  await p.close();
  // N2 mở thẳng từng link sâu
  const sai2 = [];
  const q = await moTrang();   // 13/10: 1 trang dùng lại cho mọi link sâu (mỗi link 1 trang mới làm Edge headless tự đóng phiên)
  for (const d of daQua.filter((x, i, a) => a.indexOf(x) === i && x !== app.goc)) {
    q.__hong.length = 0; q.__loiTrang.length = 0;
    await q.goto("about:blank"); await q.goto(GOC + d, { waitUntil: "domcontentloaded", timeout: 90000 }); await nghi(9000);
    const on = await mucOn(q), path = await q.evaluate(() => location.pathname);
    if (on !== d || path.replace(/\/$/, "") !== d || q.__hong.length || q.__loiTrang.length) sai2.push(d + " → mục " + on + (q.__hong.length ? " · 404 " + q.__hong[0] : "") + (q.__loiTrang.length ? " · lỗi " + q.__loiTrang[0] : ""));
    if (ANH) await q.screenshot({ path: ANH + "/" + d.replace(/\//g, "_") + "-" + W + ".png" });
  }
  await q.close();
  ok(!sai2.length, "N2 mở thẳng " + daQua.filter((x, i, a) => a.indexOf(x) === i && x !== app.goc).length + " link sâu" + (sai2.length ? " — " + sai2.join(" | ") : ""));
}
// N4 link cũ
{ const p = await moTrang(); await p.goto(GOC + "/retail/?company=hasaki&tab=task", { waitUntil: "networkidle2", timeout: 90000 }); await nghi(5000);
  const u = await p.evaluate(() => location.pathname + location.search); ok(u === "/retail/hangmuc5s/vipham", "N4 link cũ ?tab=task → " + u); await p.close(); }
await b.close();
console.log(loi.length ? "✗ " + loi.length + " lỗi / " + (dat + loi.length) + " ca" : "✓ điều hướng: đạt " + dat + " ca"); process.exit(loi.length ? 1 : 0);
