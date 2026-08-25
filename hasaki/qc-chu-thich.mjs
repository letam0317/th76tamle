/**
 * qc-chu-thich.mjs — kiểm nút chú thích `i`, VÀ chặn hồi quy khối hướng dẫn.
 *
 *  VÌ SAO (người dùng chốt 20/08/2026): mỗi tab từng mở đầu bằng một đoạn giảng giải chỉ số đọc từ
 *  đâu, lọc theo luật gì. Đọc một lần là biết, nhưng nó chiếm 2-3 dòng đầu MÀN HÌNH mỗi lần vào tab.
 *  Yêu cầu: bỏ khối đó đi; thứ nào thật cần thì để một nút nhỏ cạnh tiêu đề, rê chuột vào thì hiện,
 *  rê ra thì ẩn. Mẫu để theo là tab "Nhận diện SKU" — nó không có khối giảng giải nào.
 *
 *  VỊ TRÍ + KÝ HIỆU (sửa lần 2 sau khi tra quy ước, theo yêu cầu người dùng):
 *    · Bản đầu dán một nút "!" to cạnh TÊN DỰ ÁN ở header — sai cả hai.
 *    · Nguyên tắc PROXIMITY: nút phải sát CHÍNH THỨ nó nói tới, không thì người đọc hiểu đó là chú
 *      thích chung của cả trang (NN/g "Why So Many Info Tips Are Bad"; Carbon: definition tooltip
 *      đặt trên NHÃN của phần tử).
 *    · `i` = thông tin bổ trợ · `?` = trợ giúp · `!` = thứ BẮT BUỘC biết trước khi làm tiếp (mang sắc
 *      thái cảnh báo). Chú thích ở đây thuộc loại đầu ⇒ dùng `i`.
 *
 *  Tệp này kiểm HAI CHIỀU, và chiều thứ hai mới là chiều quan trọng:
 *    ① Nút chạy đúng: gắn đúng mục, chữ là văn bản thuần, ẩn lúc đầu, HIỆN khi rê vào, ẨN khi rê ra,
 *       bong bóng nằm trong màn và lúc ẩn không nới vùng cuộn.
 *    ② KHÔNG CÓ khối hướng dẫn nào quay lại — quét MỌI tab tìm đoạn văn dài ở đầu màn và nhãn chỉ dẫn
 *       thao tác trong ngoặc. Sửa xong rồi thì cái giữ cho nó khỏi tái phát phải là bộ đo, không phải
 *       trí nhớ.
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

/* ---------- BỘ DÒ KHỐI VĂN XUÔI — DÙNG CHUNG CHO CẢ 2 DASHBOARD -------------------------------
 * VIẾT LẠI 21/08/2026 vì bản trước ĐỂ SÓT: nó nhắm theo CLASS cụ thể (`p.sub`, `.pcsteps`, `.ht-hint`…)
 * và chỉ soi 260px ĐẦU tab. Khối "Nguồn: planogram WMS — bộ sync-vesinh-factory.mjs ghi tab … MTG_zigzag
 * …" lọt qua cả hai cửa: nó mang class `pg-hint` và nằm ở CHÂN tab. Người dùng phải tự nhìn thấy rồi
 * chỉ ra — đúng thứ bộ đo phải làm hộ.
 * Nay dò theo HÌNH DẠNG NỘI DUNG, không theo class/vị trí:
 *   · đang hiển thị · nằm trong tab/pane đang mở (kể cả chân trang)
 *   · text ≥ 90 ký tự VÀ ≥ 14 từ  → là câu văn, không phải nhãn
 *   · KHÔNG có con nào cũng là khối văn xuôi (chỉ báo khối TRONG CÙNG, khỏi báo trùng cả cây cha)
 * Loại trừ có lý do:
 *   · ô bảng / dòng bảng (td,th,tr) và `.pn` — đó là DỮ LIỆU dài (tên sản phẩm 90 ký tự)
 *   · thông báo trạng thái (đang tải / chưa có dữ liệu / lỗi mạng) — chỉ hiện khi có chuyện
 *   · phần tử chủ yếu là số (>60% ký tự là chữ số/dấu) — đó là dải chỉ số, không phải văn
 *   · nội dung của chính tooltip (.h2tip) — nó vốn là văn, nằm trong attribute lúc ẩn */
function doVanXuoi() {
  const trong = (el) => el.closest("td,th,tr,.pn,.pn2,.h2tip,select,textarea,label") !== null;
  /* 24/08/2026: thêm "còn thiếu" — dòng #cdState của tab Chuyển đổi cân kể tên ô CHƯA NHẬP, đúng
     loại thông báo trạng thái mà miễn trừ này nói tới (chỉ hiện khi số liệu chưa đủ). Nó đã báo
     đỏ từ bản đang phát chứ không phải lỗi mới — mà một ca đỏ vĩnh viễn thì chẳng ai còn đọc. */
  const laTrangThai = (t) => /đang tải|đang đồng bộ|chưa có dữ liệu|không có dữ liệu|không tải được|chưa có tab|còn thiếu|lỗi|thử lại|hiển thị \d/i.test(t);
  const nhieuSo = (t) => (t.replace(/[^0-9.,%/·\s-]/g, "").length / t.length) > 0.6;
  const hien = (el) => el.offsetParent !== null && el.getBoundingClientRect().height > 0;
  const vung = [...document.querySelectorAll("[id^=view],[id^=pane-]")].filter((x) => hien(x));
  const goc = vung.length ? vung : [document.body];
  /* CHỮ CỦA CHÍNH PHẦN TỬ, không phải `textContent` gộp cả cây con. Bản đầu dùng textContent nên báo
     cả khung DỮ LIỆU (`tbody`, `.kkstrip`, `.whcard`, `section.cards`) — 40 dòng nhiễu che mất mấy
     khối thật. Chữ "của chính nó" = các text node trực tiếp + con INLINE (b/code/span/a…), KHÔNG
     tính con dạng KHỐI (div/section/table/ul/li/p/h*) vì con khối là một khối riêng, tự nó bị xét. */
  const INLINE = new Set(["B","I","EM","STRONG","CODE","SPAN","A","SMALL","KBD","U","S","MARK","SUP","SUB","BR"]);
  const chuRieng = (el) => {
    let t = "";
    for (const n of el.childNodes) {
      if (n.nodeType === 3) t += " " + n.textContent;
      /* Con INLINE chỉ được tính khi nó là span/b/code CHỮ THUẦN (không có con phần tử). Nhiều chỗ
         dùng <span> làm KHUNG BỌC (vd #kkWhBar bọc cả dãy chip, .pg-chip trong thanh nguồn) — tính
         cả cây con của nó là gộp lại thành một "đoạn văn" giả và bộ dò báo nhiễu hàng chục dòng. */
      else if (n.nodeType === 1 && INLINE.has(n.tagName) && n.children.length === 0) t += " " + n.textContent;
    }
    return t.replace(/\s+/g, " ").trim();
  };
  const la = (el) => {
    if (!hien(el) || trong(el)) return false;
    /* Tab "Hạng mục 5S" MIỄN TRỪ: nội dung của nó CHÍNH LÀ văn bản quy định (bảng 5S, mức trừ KPI) —
       đó là chủ đề của tab, không phải chú thích chắn trước số liệu. */
    if (el.closest("#pane-hangmuc")) return false;
    /* MIỄN TRỪ CÓ LÝ DO — không phải "khối hướng dẫn", nên bộ dò phải bỏ qua, kẻo nó đỏ vĩnh viễn
       và một cái test đỏ mãi thì chẳng ai đọc nữa:
         · .hm-card / .hm-d  — MÔ TẢ THẺ ở bảng chọn hạng mục. Chức năng của bảng chọn CHÍNH LÀ nói
           mỗi hạng mục làm gì; bỏ nó đi thì bảng chọn thành 6 cái nút không nhãn.
         · .pg-tile / .kb-sub — nhãn + phụ đề của THẺ CHỈ SỐ (số liệu, phần lớn đến từ Sheet).
         · *-srcbar          — thanh nguồn: chip + số dòng + nút Làm mới, bị bộ dò nối lại thành một
           "câu"; nó là 3 control cạnh nhau, không phải đoạn văn. */
    if (el.closest(".hm-card,.pg-tile,.kb-tile,.hp-srcbar,.hk-srcbar,.ht-srcbar,.pg-srcbar")) return false;
    if (el.classList && (el.classList.contains("hm-d") || el.classList.contains("kb-sub"))) return false;
    const t = chuRieng(el);
    if (t.length < 90) return false;
    if (t.split(" ").length < 14) return false;
    if (laTrangThai(t) || nhieuSo(t)) return false;
    return true;
  };
  const ra = [];
  for (const v of goc) {
    for (const el of v.querySelectorAll("*")) {
      if (!la(el)) continue;
      /* Không cần lọc "khối trong cùng" nữa: `chuRieng` đã chỉ tính chữ của chính phần tử nên cha
         chứa toàn con khối sẽ không đạt ngưỡng. */
      const ten = el.tagName.toLowerCase() +
        (typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\s+/)[0] : "");
      ra.push({ el: ten, chu: chuRieng(el).slice(0, 64) });
    }
  }
  return ra;
}

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
/* ⚠ Bọc "(fn)()" — truyền CHUỖI NGUỒN arrow function cho waitForFunction thì Puppeteer đánh giá nó
   như một BIỂU THỨC, kết quả là object hàm (luôn truthy) ⇒ lệnh chờ trả về NGAY, không chờ gì.
   Đã dính đúng bẫy này ở qc-mobile-toan-du-an: bộ đo chụp lúc trang còn skeleton rồi báo ĐẠT. */
await p.waitForFunction("(() => typeof showTab === 'function' && typeof TIP !== 'undefined' && typeof tipMuc === 'function')()",
  { timeout: 60000 });
await nghi(3000);

/* ---------- ① Nút gắn ĐÚNG MỤC, không gắn vào tiêu đề trang ------------------------------------ */
console.log("① Nút `i` gắn theo mục (proximity), không gắn vào tiêu đề trang");
kiem("Header KHÔNG còn nút chú thích (chú thích của số liệu ≠ chú thích của cả trang)",
  await p.evaluate(() => !document.querySelector("header .h2tip") && !document.getElementById("tabTip")),
  "header sạch");

const MUC = [
  { tab: "stock", key: "stock", neo: "#viewStock .card .h2tip", ten: 'thẻ "SKU còn cần lên kệ"' },
  /* 25/08/2026: panel "Tra cứu SL đếm theo SKU" đứng ĐẦU viewKK → neo tab kk phải né .qtcpanel
     (querySelector lấy nút ĐẦU TIÊN trong DOM — không né là so tip qtc với TIP.kk, fail giả). */
  { tab: "kk", key: "kk", neo: "#viewKK .panel:not(.qtcpanel) h2 .h2tip", ten: 'tiêu đề "Kiểm kê theo SKU"' },
  { tab: "kk", key: "qtc", neo: "#viewKK .qtcpanel h2 .h2tip", ten: 'tiêu đề "Tra cứu SL đếm theo SKU"' },
  { tab: "abn", key: "abn", neo: "#viewAbn .abntile .h2tip", ten: 'thẻ "SKU bất thường"' },
  { tab: "cd", key: "cd", neo: "#viewCd h2 .h2tip", ten: 'tiêu đề "1 · Số liệu cân"' },
];
for (const m of MUC) {
  await p.evaluate((x) => showTab(x), m.tab);
  await nghi(2400);
  const r = await p.evaluate((sel, k) => {
    const el = document.querySelector(sel);
    const nen = (window.TIP || {})[k] || "";
    return { co: !!el, tip: el ? (el.getAttribute("data-tip") || "") : "", nen,
      d: el ? Math.round(el.getBoundingClientRect().width) : -1,
      trongNhan: el ? !!el.closest("h2,.card,.abntile") : false };
  }, m.neo, m.key);
  kiem("Tab " + m.tab + ": nút nằm ở " + m.ten,
    r.co && r.trongNhan && r.tip === r.nen && r.tip.length > 20,
    r.co ? ("đường kính " + r.d + "px · " + r.tip.length + " ký tự · khớp TIP: " + (r.tip === r.nen)) : "KHÔNG THẤY NÚT");
  /* Chú thích phải là VĂN BẢN THUẦN: `content:attr(data-tip)` không dựng thẻ, lọt <b>/<code> vào là
     người dùng đọc thấy nguyên chuỗi "<b>Product Type</b>" trên bong bóng. */
  if (r.co) kiem("Tab " + m.tab + ": chú thích không lẫn thẻ HTML", !/<[a-z/][^>]*>/i.test(r.tip),
    (r.tip.match(/<[a-z/][^>]*>/i) || ["sạch"])[0]);
}
/* Tab không có gì phải nói thì KHÔNG có nút — đúng lệ tab Nhận diện SKU */
for (const t of ["home", "sku"]) {
  await p.evaluate((x) => showTab(x), t);
  await nghi(1400);
  const n = await p.evaluate((x) => {
    const MAP = { home: "viewHome", sku: "viewNds" };
    return document.querySelectorAll("#" + MAP[x] + " .h2tip").length;
  }, t);
  kiem("Tab " + t + ": KHÔNG có nút chú thích (không có gì cần giảng)", n === 0, n + " nút");
}

/* ---------- ② Cỡ nút (bản đầu bị nhận xét "quá to và thô") ------------------------------------ */
console.log("② Cỡ nút");
await p.evaluate(() => showTab("kk"));
await nghi(2400);
const co = await p.evaluate(() => {
  const el = document.querySelector("#viewKK h2 .h2tip"), h2 = el && el.closest("h2");
  if (!el) return null;
  return { d: Math.round(el.getBoundingClientRect().width),
    coH2: Math.round(parseFloat(getComputedStyle(h2).fontSize)),
    mo: Number(getComputedStyle(el).opacity), chu: el.textContent.trim() };
});
kiem("Nút nhỏ hơn cỡ chữ tiêu đề (ăn theo em, không đóng cứng px)",
  !!co && co.d <= co.coH2 && co.d >= 10,
  co ? ("đường kính " + co.d + "px / chữ tiêu đề " + co.coH2 + "px") : "không thấy");
kiem("Nút MỜ lúc bình thường (không tranh mắt với tiêu đề)", !!co && co.mo < 0.95, co ? ("opacity " + co.mo) : "");
kiem("Ký hiệu là `i` (thông tin bổ trợ) — `!` mang sắc thái cảnh báo", !!co && co.chu === "i", co ? ('"' + co.chu + '"') : "");

/* ---------- ③ Rê vào hiện · rê ra ẩn · lúc ẩn không nới vùng cuộn ----------------------------- */
console.log("③ Hành vi rê chuột");
const SEL = "#viewKK h2 .h2tip";
const trangThai = () => p.evaluate((s) => getComputedStyle(document.querySelector(s), "::after").display, SEL);
const truoc = await trangThai();
await p.hover(SEL);
await nghi(600);
const khiRe = await p.evaluate((s) => {
  const el = document.querySelector(s), cs = getComputedStyle(el, "::after");
  const rb = el.getBoundingClientRect(), w = parseFloat(cs.width) || 0;
  const trai = rb.left + (parseFloat(cs.left) || 0);
  return { d: cs.display, op: cs.opacity, rong: Math.round(w), trai: Math.round(trai),
    phai: Math.round(trai + w), man: document.documentElement.clientWidth };
}, SEL);
await p.screenshot({ path: path.join(OUT, "01-hover.png") });
await p.mouse.move(1200, 800);
await nghi(400);
const sau = await trangThai();
kiem("Lúc đầu KHÔNG dựng (display:none) · rê vào HIỆN · rê ra ẨN LẠI",
  truoc === "none" && khiRe.d === "block" && Number(khiRe.op) > 0.9 && sau === "none",
  "đầu=" + truoc + " · khi rê=" + khiRe.d + "/" + khiRe.op + " · sau=" + sau);
kiem("Bong bóng đủ rộng (≥200px) VÀ nằm trong màn (không cắt chữ đầu/cuối)",
  khiRe.rong >= 200 && khiRe.trai >= 0 && khiRe.phai <= khiRe.man,
  "rộng " + khiRe.rong + "px · x " + khiRe.trai + "→" + khiRe.phai + " / màn " + khiRe.man + "px");
/* Chốt chặn cho bẫy đã dính: bong bóng ẩn bằng visibility:hidden VẪN nới vùng cuộn (đã làm trang
   kéo ngang 186px trên mọi tab). Đo ở màn hẹp để lộ ngay. */
await p.setViewport({ width: 380, height: 900 });
await nghi(700);
const keo = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
kiem("Bong bóng lúc ẩn KHÔNG nới vùng cuộn trang (màn 380px)", keo <= 1, "kéo ngang " + keo + "px");
await p.setViewport({ width: 1440, height: 950 });
await nghi(500);

/* ---------- ④ Mục "Tồn tại vị trí" ------------------------------------------------------------ */
console.log("④ Mục \"Tồn tại vị trí\"");
await p.evaluate(() => showTab("abn"));
await p.waitForFunction("(() => typeof TVT !== 'undefined' && TVT.ok && document.querySelectorAll('#tvtWrap h2').length > 0)()",
  { timeout: 60000 }).catch(() => {});
await nghi(1400);
const tvt = await p.evaluate(() => {
  const h2 = document.querySelector("#tvtWrap h2");
  const btn = h2 && h2.querySelector(".h2tip");
  return { chu: h2 ? h2.textContent.trim() : "", co: !!btn, tip: btn ? (btn.getAttribute("data-tip") || "") : "" };
});
kiem("Tiêu đề GỌN (không còn phần trong ngoặc), nút mang nội dung",
  tvt.co && tvt.tip.length > 100 && !/\(/.test(tvt.chu),
  '"' + tvt.chu + '" · ' + tvt.tip.length + " ký tự");
kiem("Chú thích nêu đủ 2 miễn trừ đang áp (F0-AJ · Adjustment - shipped)",
  /F0-AJ/.test(tvt.tip) && /Adjustment - shipped/i.test(tvt.tip), tvt.tip.slice(-88));

/* ---------- ⑤ CHẶN HỒI QUY ------------------------------------------------------------------- */
console.log("⑤ Chặn hồi quy");
const TAB = ["home", "stock", "kk", "abn", "plg", "sku", "cd"];
const sot = [], ngoac = [];
for (const t of TAB) {
  await p.evaluate((x) => showTab(x), t);
  await nghi(2200);
  const khoi = await p.evaluate(doVanXuoi);
  khoi.forEach((x) => sot.push(t + " › " + x.el + ' "' + x.chu + '…"'));
  const ng = await p.evaluate(() => {
    const v = [...document.querySelectorAll("[id^=view]")].find((x) => !x.hidden);
    if (!v) return [];
    const ra = [];
    /* Nhãn chỉ dẫn thao tác trong ngoặc sau tiêu đề. GIỮ nhãn nghiệp vụ "(Type: …)" — đó là DỮ LIỆU
       (phiếu thuộc type nào), không phải hướng dẫn. */
    for (const el of v.querySelectorAll("h2 span,h3 span")) {
      if (el.offsetParent === null) continue;
      const txt = (el.textContent || "").trim();
      if (!/^\(/.test(txt)) continue;
      if (/^\(type/i.test(txt) || /type SKU|type vị trí/i.test(txt)) continue;
      if (/bấm|rê|gõ|chọn|xem|click/i.test(txt)) ra.push(txt.slice(0, 56));
    }
    return ra;
  });
  ng.forEach((x) => ngoac.push(t + ": " + x));
}
kiem("Không tab nào còn KHỐI VĂN XUÔI (dò theo hình dạng nội dung, cả chân trang)", sot.length === 0,
  sot.length ? sot.join("  |  ") : "sạch cả 7 tab");
kiem('Không còn nhãn chỉ dẫn thao tác trong ngoặc sau tiêu đề (giữ nhãn "(Type: …)")',
  ngoac.length === 0, ngoac.length ? ngoac.join(" | ") : "sạch");

/* ---------- ⑥ QUÉT DASHBOARD 5S — cùng luật, khác trang -------------------------------------- */
/* Người dùng nhắc 20/08/2026: "không phải chỉ ở Tồn tại vị trí, cái tôi nói đó là ví dụ, để soi
   TOÀN BỘ dự án". Nên bộ đo phải đi cả dashboard thứ hai, không thì luật chỉ được thi hành ở một
   nửa dự án và nửa còn lại lặng lẽ tái phát. Các tab 5S render động theo công ty ⇒ đọc thẳng
   `.tab[data-tab]` thay vì khai cứng. */
console.log("⑥ Dashboard 5S (cùng luật)");
const URL_5S = LIVE ? "https://letam0317.github.io/kiemsoatkho/"
  : pathToFileURL(path.resolve(DIR, "kiemsoatkho", "index.html")).href;
const p2 = await b.newPage();
await p2.setViewport({ width: 1440, height: 950 });
const conLoi2 = [];
p2.on("pageerror", (e) => conLoi2.push(e.message.slice(0, 110)));
try {
  await p2.goto(URL_5S, { waitUntil: "networkidle2", timeout: 90000 });
  await p2.waitForFunction("(() => typeof setTab === 'function' && typeof tipMuc === 'function')()", { timeout: 60000 });
  await nghi(3500);
  kiem("Host 5S có thành phần chú thích dùng chung (tipMuc + .h2tip)",
    await p2.evaluate(() => typeof tipMuc === "function" && typeof TIP_KYHIEU !== "undefined" && TIP_KYHIEU === "i"),
    "tipMuc + TIP_KYHIEU='i'");
  const tabs = await p2.evaluate(() => [...document.querySelectorAll("#tabsNav .tab[data-tab]")].map((x) => x.getAttribute("data-tab")));
  console.log("     · " + tabs.length + " tab: " + tabs.join(", "));
  const sot5 = [], ngoac5 = [];
  for (const t of tabs) {
    await p2.evaluate((x) => setTab(x), t);
    await nghi(2600);
    const khoi5 = await p2.evaluate(doVanXuoi);
    khoi5.forEach((x) => sot5.push(t + " › " + x.el + ' "' + x.chu + '…"'));
    const ng5 = await p2.evaluate(() => {
      const pane = [...document.querySelectorAll("[id^=pane-]")].find((x) => x.offsetParent !== null) || document.body;
      const ra = [];
      /* GIỮ nhãn nghiệp vụ "(type SKU)"/"(type Location)". */
      for (const el of pane.querySelectorAll("h2 span,h3 span")) {
        if (el.offsetParent === null) continue;
        const txt = (el.textContent || "").trim();
        if (!/^\(/.test(txt)) continue;
        if (/^\(type/i.test(txt)) continue;
        if (/bấm|rê|gõ|chọn|xem|click/i.test(txt)) ra.push(txt.slice(0, 56));
      }
      return ra;
    });
    ng5.forEach((x) => ngoac5.push(t + ": " + x));
  }
  kiem("5S: không tab nào còn KHỐI VĂN XUÔI (dò theo hình dạng, cả chân trang)", sot5.length === 0,
    sot5.length ? sot5.join("  |  ") : "sạch " + tabs.length + " tab");
  kiem('5S: không còn nhãn chỉ dẫn thao tác trong ngoặc (giữ "(type SKU)")',
    ngoac5.length === 0, ngoac5.length ? ngoac5.join(" | ") : "sạch");
  kiem("5S: không lỗi pageerror", conLoi2.length === 0, [...new Set(conLoi2)].slice(0, 2).join(" | ") || "sạch");
  await p2.screenshot({ path: path.join(OUT, "02-5s.png") });
} catch (e) {
  kiem("Mở được dashboard 5S", false, e.message.split("\n")[0]);
}
await p2.close();

console.log("⑦ Console (Audit Factory)");
kiem("Không lỗi console/pageerror", conLoi.length === 0, [...new Set(conLoi)].slice(0, 3).join(" | ") || "sạch");

await b.close();
console.log("\nẢnh: " + OUT);
console.log(loi ? "✗ " + loi + " lỗi / " + (loi + dat) + " ca" : "✓ QC nút chú thích: đạt (" + dat + " ca)");
process.exit(loi ? 1 : 0);
