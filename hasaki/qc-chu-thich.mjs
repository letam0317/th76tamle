/**
 * qc-chu-thich.mjs — kiểm nút chú thích "!" sau tiêu đề, VÀ chặn hồi quy khối hướng dẫn.
 *
 *  VÌ SAO (người dùng chốt 20/08/2026): mỗi tab từng mở đầu bằng một đoạn giảng giải chỉ số đọc từ
 *  đâu, lọc theo luật gì. Đọc một lần là biết, nhưng nó chiếm 2-3 dòng đầu MÀN HÌNH mỗi lần vào tab.
 *  Yêu cầu: bỏ khối đó đi; thứ nào thật cần thì để sau tiêu đề một nút "!", rê chuột vào thì hiện,
 *  rê ra thì ẩn. Mẫu để theo là tab "Nhận diện SKU" — nó không có khối giảng giải nào.
 *
 *  Tệp này kiểm HAI CHIỀU, và chiều thứ hai mới là chiều quan trọng:
 *    ① Nút "!" chạy đúng: có nút, có nội dung, ẩn lúc đầu, HIỆN khi rê vào, ẨN LẠI khi rê ra.
 *    ② KHÔNG CÓ khối hướng dẫn nào quay lại — quét MỌI tab tìm đoạn văn dài ở đầu màn. Đây là chốt
 *       chặn để lần sau thêm tab mới không lặng lẽ dán lại một đoạn giảng giải nữa: sửa xong rồi thì
 *       cái giữ cho nó khỏi tái phát phải là bộ đo, không phải trí nhớ.
 *
 *  node qc-chu-thich.mjs           (mặc định đọc file trên đĩa)
 *  node qc-chu-thich.mjs --live    (đọc bản đang phát)
 */
import path from "node:path"; import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer";
import { EDGE_PATH } from "./token-store.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, ".exports", "qc-chu-thich");
fs.mkdirSync(OUT, { recursive: true });
const LIVE = process.argv.includes("--live");
const URL_TRANG = LIVE ? "https://letam0317.github.io/stocklocationfactory/"
  : pathToFileURL(path.resolve(DIR, "..", "factory", "index.html")).href;

let loi = 0, dat = 0;
const kiem = (ten, ok, ct) => {
  if (ok) { dat++; console.log("  ✓ " + ten + (ct ? "  — " + ct : "")); }
  else { loi++; console.log("  ✗ " + ten + (ct ? "  — " + ct : "")); }
};
const nghi = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await puppeteer.launch({ headless: "new", executablePath: EDGE_PATH,
  args: ["--no-sandbox", "--allow-file-access-from-files"] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 950 });
const conLoi = [];
p.on("console", (m) => { if (m.type() === "error") conLoi.push(m.text().slice(0, 110)); });
p.on("pageerror", (e) => conLoi.push("pageerror: " + e.message.slice(0, 110)));
await p.goto(URL_TRANG, { waitUntil: "networkidle2", timeout: 90000 });
await p.waitForFunction("() => typeof showTab === 'function' && typeof TAB_TIP !== 'undefined'", { timeout: 60000 });
await nghi(2500);

/* ---------- ① Nút "!" theo từng tab ------------------------------------------------------------ */
console.log("① Nút \"!\" sau tiêu đề, theo từng tab");
const TAB = ["home", "stock", "kk", "abn", "plg", "sku", "cd"];
const coTip = await p.evaluate(() => Object.keys(TAB_TIP));
for (const t of TAB) {
  await p.evaluate((x) => showTab(x), t);
  await nghi(450);
  const r = await p.evaluate(() => {
    const btn = document.getElementById("tabTip");
    const cs = btn ? getComputedStyle(btn, "::after") : null;
    return { co: !!btn, an: btn ? btn.hidden : null,
      tip: btn ? (btn.getAttribute("data-tip") || "") : "",
      hienBong: cs ? cs.visibility : "", rong: btn ? Math.round(btn.getBoundingClientRect().width) : -1 };
  });
  const nen = coTip.includes(t);
  kiem("Tab " + t + ": " + (nen ? "CÓ nút \"!\"" : "KHÔNG có nút (đúng lệ tab Nhận diện SKU)"),
    nen ? (r.co && !r.an && r.tip.length > 20) : (r.co && r.an),
    nen ? ("nút " + r.rong + "px · chú thích " + r.tip.length + " ký tự") : "nút ẩn: " + r.an);
  if (nen) {
    /* Chú thích phải là VĂN BẢN THUẦN: `content:attr(data-tip)` không dựng thẻ, lọt <b>/<code> vào
       là người dùng đọc thấy nguyên chuỗi "<b>Product Type</b>" trên bong bóng. */
    kiem("Tab " + t + ": chú thích không lẫn thẻ HTML", !/<[a-z/][^>]*>/i.test(r.tip),
      (r.tip.match(/<[a-z/][^>]*>/i) || ["sạch"])[0]);
  }
}

/* ---------- ② Rê vào hiện · rê ra ẩn ----------------------------------------------------------- */
console.log("② Hành vi rê chuột (hover vào hiện, ra thì ẩn)");
await p.evaluate(() => showTab("abn"));
await nghi(600);
/* ĐO `display`, KHÔNG đo `visibility`: cách ẩn đã đổi sang display:none vì bong bóng ẩn bằng
   visibility VẪN tính vào vùng cuộn và nới trang ra 186px (bộ rà bố cục bắt được). Bản đo cũ vẫn
   soi visibility nên báo "đầu=visible" — test đo đúng thứ đã không còn được dùng để ẩn. */
const anHay = () => p.evaluate(() => getComputedStyle(document.getElementById("tabTip"), "::after").display);
const truoc = await anHay();
await p.hover("#tabTip");
await nghi(700);   // CSS có transition-delay .3s cho khỏi nháy khi rê ngang qua — phải chờ quá mốc đó
const trongKhiRe = await p.evaluate(() => {
  const btn = document.getElementById("tabTip");
  const cs = getComputedStyle(btn, "::after");
  /* ĐO CẢ VỊ TRÍ, không chỉ bề rộng: lần đầu bong bóng canh giữa nút nên trổ ra ngoài mép TRÁI màn
     hình và mất mấy chữ đầu — bề rộng vẫn "đủ" nên bộ đo cũ báo xanh, phải soi ảnh mới thấy.
     `::after` không có getBoundingClientRect riêng, nên suy vị trí từ rect của nút + offset CSS. */
  const rb = btn.getBoundingClientRect();
  const w = parseFloat(cs.width) || 0;
  const trai = rb.left + (parseFloat(cs.left) || 0);
  return { vis: cs.display, op: cs.opacity, rong: Math.round(w),
    trai: Math.round(trai), phai: Math.round(trai + w), manRong: document.documentElement.clientWidth };
});
await p.screenshot({ path: path.join(OUT, "01-hover-tab.png") });
await p.mouse.move(700, 700);   // rê ra chỗ khác
await nghi(500);
const sauKhiRa = await anHay();
kiem("Lúc đầu KHÔNG dựng (display:none) · rê vào thì HIỆN · rê ra thì ẨN LẠI",
  truoc === "none" && trongKhiRe.vis === "block" && Number(trongKhiRe.op) > 0.9 && sauKhiRa === "none",
  "đầu=" + truoc + " · khi rê=" + trongKhiRe.vis + "/" + trongKhiRe.op + " · sau=" + sauKhiRa);
kiem("Bong bóng đủ rộng để đọc (≥200px) VÀ nằm trong màn (không cắt chữ đầu/cuối)",
  trongKhiRe.rong >= 200 && trongKhiRe.trai >= 0 && trongKhiRe.phai <= trongKhiRe.manRong,
  "rộng " + trongKhiRe.rong + "px · trải từ x=" + trongKhiRe.trai + " đến x=" + trongKhiRe.phai +
  " / màn " + trongKhiRe.manRong + "px");

/* CHỐT CHẶN cho bẫy vừa dính: bong bóng lúc ẩn KHÔNG được nới vùng cuộn của trang. Đo ở bề rộng
   HẸP để lộ ra ngay (bong bóng 420px trong màn 380px). */
await p.setViewport({ width: 380, height: 900 });
await nghi(600);
const keoNgang = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
kiem("Bong bóng lúc ẩn KHÔNG nới vùng cuộn trang (màn 380px)", keoNgang <= 1, "kéo ngang " + keoNgang + "px");
await p.setViewport({ width: 1440, height: 950 });
await nghi(500);

/* Nút phải nằm CẠNH tiêu đề, không rớt xuống hàng dưới (ảnh chụp cho thấy nó từng lơ lửng dưới
   dòng chữ nhỏ của tiêu đề vì .brand-title là khối nhiều dòng). */
const canhTieuDe = await p.evaluate(() => {
  const h1 = document.getElementById("brandTitle"), btn = document.getElementById("tabTip");
  const a = h1.getBoundingClientRect(), b2 = btn.getBoundingClientRect();
  return { benPhai: b2.left >= a.right - 2, chongDoc: b2.top < a.bottom - 2,
    dx: Math.round(b2.left - a.right), dy: Math.round(b2.top - a.top) };
});
kiem("Nút \"!\" nằm BÊN PHẢI tiêu đề và cùng tầm dọc (không rớt xuống hàng dưới)",
  canhTieuDe.benPhai && canhTieuDe.chongDoc,
  "cách tiêu đề " + canhTieuDe.dx + "px ngang · lệch " + canhTieuDe.dy + "px dọc");

/* ---------- ③ Nút "!" của mục Tồn tại vị trí --------------------------------------------------- */
console.log("③ Nút \"!\" của mục \"Tồn tại vị trí\"");
const tvt = await p.evaluate(() => {
  const h2 = [...document.querySelectorAll("#tvtWrap h2")][0];
  const btn = h2 && h2.querySelector(".h2tip");
  return { coH2: !!h2, chuH2: h2 ? h2.textContent.trim() : "", coBtn: !!btn,
    tip: btn ? (btn.getAttribute("data-tip") || "") : "" };
});
kiem("Tiêu đề đã GỌN (bỏ phần trong ngoặc), nút \"!\" mang nội dung",
  tvt.coBtn && tvt.tip.length > 100 && !/\(/.test(tvt.chuH2.replace("!", "")),
  "\"" + tvt.chuH2 + "\" · chú thích " + tvt.tip.length + " ký tự");
kiem("Chú thích nêu đủ 2 miễn trừ đang áp (F0-AJ · Adjustment - shipped)",
  /F0-AJ/.test(tvt.tip) && /Adjustment - shipped/i.test(tvt.tip),
  tvt.tip.slice(-96));

/* ---------- ④ CHẶN HỒI QUY: không còn khối hướng dẫn ở đầu tab -------------------------------- */
console.log("④ Chặn hồi quy: không còn đoạn giảng giải nào ở đầu tab");
const conSot = [];
for (const t of TAB) {
  await p.evaluate((x) => showTab(x), t);
  await nghi(420);
  const r = await p.evaluate(() => {
    const v = [...document.querySelectorAll("[id^=view]")].find((x) => !x.hidden);
    if (!v) return [];
    const ra = [];
    /* Đoạn văn DÀI (>=90 ký tự) nằm trong 260px đầu của tab = khối giảng giải chắn trước số liệu.
       Ngưỡng 90 ký tự để không bắt oan mấy nhãn ngắn kiểu "Lọc:" hay "(bấm để xem danh sách)". */
    const goc = v.getBoundingClientRect().top;
    for (const el of v.querySelectorAll("p.sub, .pcsteps, .state, .abnempty")) {
      if (el.offsetParent === null) continue;
      const txt = (el.textContent || "").trim();
      if (txt.length < 90) continue;
      const r2 = el.getBoundingClientRect();
      if (r2.top - goc > 260) continue;
      /* `.state` / `.abnempty` là THÔNG BÁO TRẠNG THÁI (đang tải / chưa có dữ liệu / lỗi mạng) —
         không phải giảng giải, và chỉ hiện khi thật sự có chuyện. Bỏ qua. */
      if (el.classList.contains("state") || el.classList.contains("abnempty")) continue;
      ra.push({ cls: el.className, chu: txt.slice(0, 70) });
    }
    return ra;
  });
  r.forEach((x) => conSot.push({ tab: t, ...x }));
}
kiem("Không tab nào còn khối giảng giải ở đầu màn", conSot.length === 0,
  conSot.length ? conSot.map((x) => x.tab + ":" + x.cls + " \"" + x.chu + "…\"").join(" | ") : "sạch cả 7 tab");

/* ---------- ⑤ Console --------------------------------------------------------------------------- */
console.log("⑤ Console");
kiem("Không lỗi console/pageerror", conLoi.length === 0, [...new Set(conLoi)].slice(0, 3).join(" | ") || "sạch");

await b.close();
console.log("\nẢnh: " + OUT);
console.log(loi ? "✗ " + loi + " lỗi / " + (loi + dat) + " ca" : "✓ QC nút chú thích: đạt (" + dat + " ca)");
process.exit(loi ? 1 : 0);
