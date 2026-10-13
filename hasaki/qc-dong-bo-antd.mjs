/**
 * qc-dong-bo-antd.mjs — đo ĐỒNG BỘ thiết kế Ant Design trên MỌI tab (+ mục con Xác minh) theo bộ luật hasaki/LUAT-DONG-BO-ANTD.md.
 * 13/10/2026 user: «Hạng mục 5S / Tồn kho / Xác minh cần đồng bộ thiết kế/màu sắc theo tab Xác minh — ant design … QC cho kỹ»
 *  + «tạo 1 bộ luật để tiếp tục chuyển đổi với dự án audit factory». Bộ đo dò theo HÌNH DẠNG (computed style), không theo danh sách class,
 *  nên tab mới / dashboard Factory chạy được ngay.
 *
 * Luật (mã khớp LUAT-DONG-BO-ANTD.md):
 *  AD-01 không viền nhấn màu một cạnh (border-left/top dày ≥2px khác các cạnh còn lại) trên thẻ/hàng/ô
 *  AD-02 không chữ IN HOA bằng CSS (text-transform:uppercase)
 *  AD-03 bo góc chỉ 0/2/4/6/8px; thẻ nhỏ (cao ≤32px) không bo viên thuốc — trừ hình tròn (avatar/chấm/nút tròn) và thanh tiến độ
 *  AD-04 không nền chuyển sắc (gradient) — trừ biểu đồ vòng tiến độ (conic) và vạch tiến độ
 *  AD-05 tiêu đề trong tab không lặp tên đã có ở đường dẫn đầu trang
 *  AD-06 chữ thân không đậm quá 600 (antd chỉ 400/600) — số liệu lớn (≥20px) được miễn
 *  AD-07 không dòng mô tả dưới tiêu đề (chữ thuần ≥20 ký tự ngay sau h2/h3) — luật 7 dự án
 *  AD-08 nút đầu trang: «+ Ghi nhận 5S» CHỈ ở Tổng quan; mục Xác minh có «Đăng xuất» ở đúng chỗ đó (chỉ trang 5S)
 *  AD-10 không chữ chỉ dẫn thao tác («chạm để mở», «bấm để xem»…) — luật 7 dự án
 *  AD-09 cỡ chữ trong bộ 12/14/16/20/24/30/38 (antd) — CHỈ THỐNG KÊ, chưa tính lỗi (nhiều bảng dày 13px có chủ đích)
 * Chạy: node qc-dong-bo-antd.mjs [--trang=5s|factory] [--w=1440] [--anh=thư mục] [--chi=tab1,tab2]
 * Chặn mọi lượt ghi (POST/PUT…) ở tầng mạng — luật qc-khong-ghi-du-lieu-that.
 */
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import { phienQC } from "./xacminh-dang-nhap.mjs";
const A = Object.fromEntries(process.argv.slice(2).map((x) => x.replace(/^--/, "").split("=")));
const TRANG = A.trang || "5s", W = +(A.w || 1440), ANH = A.anh || "";
const URL = TRANG === "factory" ? "http://localhost:8123/factory/" : "http://localhost:8123/kiemsoatkho/";
if (ANH) fs.mkdirSync(ANH, { recursive: true });
const b = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: "new" });
const p = await b.newPage();
await p.evaluateOnNewDocument((hx) => { try { localStorage.setItem("hx-phien", hx); } catch (e) {} }, (() => { try { return phienQC(); } catch (e) { return ""; } })());
const con = []; p.on("pageerror", (e) => con.push(e.message.slice(0, 120)));
await p.setRequestInterception(true); p.on("request", (r) => (/^(GET|OPTIONS|HEAD)$/.test(r.method()) ? r.continue() : r.abort()));
await p.setViewport({ width: W, height: 1000, isMobile: W < 600, hasTouch: W < 600 });
await p.goto(URL, { waitUntil: "networkidle2", timeout: 90000 });
await new Promise((r) => setTimeout(r, 5000));
const doiTab = TRANG === "factory" ? "showTab" : "setTab";
let tabs = await p.evaluate(() => [...new Set([...document.querySelectorAll("#tabsNav .tab[data-tab], #sideNav .s-item[data-tab]")].map((x) => x.dataset.tab))]);
if (A.chi) tabs = A.chi.split(",");
const man = [];   // [ten, cachMo]
for (const t of tabs) {
  if (t === "xacminh" && TRANG === "5s") for (const sb of ["treo", "cam", "tg"]) man.push(["xacminh/" + sb, t, sb]);
  else man.push([t, t, null]);
}

function doLuat() {
  const BO_CHU = [12, 14, 16, 20, 24, 30, 38], loi = [], thongKe = {};
  const pane = [...document.querySelectorAll("[id^=pane-],[id^=view]")].find((x) => x.offsetParent !== null && x.getBoundingClientRect().height > 50) || document.querySelector("main") || document.body;
  const ten = (e) => e.tagName.toLowerCase() + (e.id ? "#" + e.id : "") + (typeof e.className === "string" && e.className.trim() ? "." + e.className.trim().split(/\s+/).slice(0, 2).join(".") : "");
  const chuRieng = (e) => [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim();
  const mien = (e) => e.closest("svg,canvas,video,.hp-map,.hp-so,.pg-map,.kho-map,.hx-tl,[data-ad-mien]");   // .hx-tl = trục thời gian clip (biểu đồ)
  const vung = [pane, document.querySelector(".modal-box")].filter(Boolean);
  const daBao = new Set(); const bao = (ma, e, chu) => { const k = ma + "|" + ten(e); if (daBao.has(k)) return; daBao.add(k); loi.push({ ma, el: ten(e), chu: (chu || "").slice(0, 60) }); };
  for (const goc of vung) for (const e of goc.querySelectorAll("*")) {
    if (mien(e)) continue; const r = e.getBoundingClientRect(); if (!r.width || !r.height || e.offsetParent === null && getComputedStyle(e).position !== "fixed") continue;
    const s = getComputedStyle(e);
    // AD-01
    const bl = parseFloat(s.borderLeftWidth), bt = parseFloat(s.borderTopWidth), br = parseFloat(s.borderRightWidth), bb = parseFloat(s.borderBottomWidth);
    if (r.height > 24 && ((bl >= 2 && bl > br + 0.5 && s.borderLeftStyle !== "none") || (bt >= 2 && bt > bb + 0.5 && s.borderTopStyle !== "none" && r.width > 60))) bao("AD-01", e, chuRieng(e) || e.innerText);
    if (r.height > 24 && s.boxShadow.replace(/rgba?\([^)]*\)/g, "").split(",").some((x) => /inset/.test(x) && /^\s*([2-9]|\d{2})(\.\d+)?px\s+0px/.test(x.replace("inset", "").trim()))) bao("AD-01", e, (rc || e.innerText || "").trim() + " · vạch inset");
    // AD-02
    const rc = chuRieng(e); if (rc && /[a-zà-ỹ]/i.test(rc) && s.textTransform === "uppercase") bao("AD-02", e, rc);
    // AD-03
    const rad = parseFloat(s.borderTopLeftRadius); const tron = Math.abs(r.width - r.height) < 3;
    const coNen = s.backgroundColor !== "rgba(0, 0, 0, 0)" || parseFloat(s.borderTopWidth) > 0;
    if (coNen && rad > 8.5 && !tron && !/prog|bar|track|thanh|tiendo|slider|range/i.test(ten(e)) && !(r.height <= 12)) bao("AD-03", e, (rc || e.innerText || "").trim() + " · bo " + rad + "px");
    // AD-04
    if (/gradient/.test(s.backgroundImage) && !/conic/.test(s.backgroundImage) && !/prog|bar|track|thanh|tiendo|skel|shimmer|(^|.)sk(.|$)/i.test(ten(e))) bao("AD-04", e, rc || "");
    // AD-06 + AD-09
    if (rc && rc.length > 1) { const fs = Math.round(parseFloat(s.fontSize) * 2) / 2, fw = +s.fontWeight;
      if (fw > 600 && fs < 20 && !/^[\d.,%+−\-–\s/×:]+$/.test(rc)) bao("AD-06", e, rc + " · " + fw);
      if (!BO_CHU.includes(fs)) thongKe[fs] = (thongKe[fs] || 0) + 1; }
  }
  // AD-10 chữ chỉ dẫn thao tác trên màn («chạm để…», «bấm để…», «nhấn để…») — tooltip title không tính
  for (const goc of vung) for (const e of goc.querySelectorAll("*")) { if (mien(e) || e.offsetParent === null) continue; const t = chuRieng(e);
    if (/(^|[\s(—–-])(chạm|bấm|nhấn|click|rê chuột)\s/i.test(t)) bao("AD-10", e, t); }   // 13/10 chiều: bắt cả «bấm thanh bên dưới…» (bản đầu chỉ bắt «bấm để/vào»)
  // AD-05
  const duong = [...document.querySelectorAll("#adCrumb b, #adCrumb *")].filter((x) => !x.children.length).map((x) => x.textContent.trim()).filter(Boolean);
  const cuoi = duong[duong.length - 1] || "";
  for (const h of pane.querySelectorAll("h1,h2,h3")) if (h.offsetParent !== null && cuoi && h.textContent.trim() === cuoi) bao("AD-05", h, cuoi);
  // AD-07
  for (const h of pane.querySelectorAll("h2,h3")) { if (h.offsetParent === null || h.closest(".modal-box,table,.panel-head,.cl-item")) continue;
    const n = h.nextElementSibling; if (!n || n.offsetParent === null || n.children.length > 1 || n.querySelector("button,input,select,a,img,svg,canvas,[style*='width']") || /chart|bar|track/i.test(String(n.className))) continue;   // khối biểu đồ (thanh) là dữ liệu
    const t = n.textContent.trim(), so = (t.match(/\d/g) || []).length; if (t.length >= 20 && /\s/.test(t) && so / t.length <= 0.25) bao("AD-07", n, t); }
  const vis = (x) => !!(x && x.offsetParent !== null && x.getBoundingClientRect().width);
  return { loi, thongKe, cuoi, ghi: vis(document.querySelector("#btnGhiNhan")), dx: vis(document.querySelector("#hdrDangXuat")), dxTrongTab: vis(document.querySelector("#hxDangXuat")) };
}

const tong = []; const tk = {};
for (const [tenMan, t, sb] of man) {
  await p.evaluate((f, t, sb) => { window[f](t); if (sb && window.HXACMINH) HXACMINH.sub(sb); }, doiTab, t, sb);
  await new Promise((r) => setTimeout(r, /planogram|kk|plg|stock/.test(t) ? 6000 : 3000));
  const d = await p.evaluate(doLuat);
  if (TRANG === "5s") {
    if (t === "home" && !d.ghi) d.loi.push({ ma: "AD-08", el: "#btnGhiNhan", chu: "Tổng quan phải có nút + Ghi nhận 5S" });
    if (t !== "home" && d.ghi) d.loi.push({ ma: "AD-08", el: "#btnGhiNhan", chu: "chỉ hiện ở Tổng quan" });
    if (sb && !d.dx) d.loi.push({ ma: "AD-08", el: "#hdrDangXuat", chu: "Xác minh phải có Đăng xuất ở đầu trang" });
    if (sb && d.dxTrongTab) d.loi.push({ ma: "AD-08", el: "#hxDangXuat", chu: "Đăng xuất còn nằm trong thân tab" });
    if (!sb && d.dx) d.loi.push({ ma: "AD-08", el: "#hdrDangXuat", chu: "Đăng xuất chỉ ở mục Xác minh" });
  }
  Object.entries(d.thongKe).forEach(([k, v]) => (tk[k] = (tk[k] || 0) + v));
  console.log((d.loi.length ? "  ✗ " : "  ✓ ") + tenMan + (d.loi.length ? " — " + d.loi.length + " lỗi" : ""));
  d.loi.slice(0, A.du ? 999 : 12).forEach((x) => console.log("      " + x.ma + " " + x.el + (x.chu ? ' «' + x.chu.replace(/\s+/g, " ") + '»' : "")));
  if (!A.du && d.loi.length > 12) console.log("      … +" + (d.loi.length - 12));
  tong.push(...d.loi.map((x) => ({ man: tenMan, ...x })));
  if (ANH) await p.screenshot({ path: ANH + "/" + TRANG + "-" + W + "-" + tenMan.replace(/\W+/g, "_") + ".png" });
  /* pop-up của màn (chỉ 5S): mở dòng đầu → đo cùng luật trong .modal-box → đóng */
  const moPop = TRANG === "5s" && (t === "task" ? "#pane-task tbody tr" : sb === "treo" ? "#pane-xacminh table.hx-chung tbody tr[data-p] td" : sb === "cam" ? "#pane-xacminh table.hx-chung tbody tr[data-l] td" : "");
  if (moPop && await p.evaluate((q) => { const x = [...document.querySelectorAll(q)].find((e) => e.offsetParent !== null); if (!x) return false; x.click(); return true; }, moPop)) {
    await new Promise((r) => setTimeout(r, 2500));
    const d2 = await p.evaluate(doLuat); const lo = d2.loi.filter((x) => !/^AD-0[58]$/.test(x.ma));
    console.log((lo.length ? "  ✗ " : "  ✓ ") + tenMan + " › pop-up" + (lo.length ? " — " + lo.length + " lỗi" : ""));
    lo.slice(0, A.du ? 999 : 12).forEach((x) => console.log("      " + x.ma + " " + x.el + (x.chu ? ' «' + x.chu.replace(/\s+/g, " ") + '»' : "")));
    tong.push(...lo.map((x) => ({ man: tenMan + " pop-up", ...x })));
    if (ANH) await p.screenshot({ path: ANH + "/" + TRANG + "-" + W + "-" + tenMan.replace(/\W+/g, "_") + "-popup.png" });
    await p.evaluate(() => { const c = document.querySelector("#mClose,.modal-box [id$=Close]"); if (c) c.click(); }); await new Promise((r) => setTimeout(r, 800));
  }
}
console.log("  · AD-09 cỡ chữ ngoài bộ antd (thống kê, chưa tính lỗi): " + Object.entries(tk).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => k + "px×" + v).join(", "));
if (con.length) { console.log("  ✗ lỗi trang: " + con.slice(0, 2).join(" | ")); }
const theoMa = {}; tong.forEach((x) => (theoMa[x.ma] = (theoMa[x.ma] || 0) + 1));
console.log(tong.length || con.length ? "✗ " + tong.length + " lỗi (" + Object.entries(theoMa).map(([k, v]) => k + "×" + v).join(" ") + ") trên " + man.length + " màn" : "✓ đồng bộ antd: đạt " + man.length + " màn");
await b.close(); process.exit(tong.length || con.length ? 1 : 0);
