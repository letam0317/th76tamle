/**
 * qc-in-tem-popup.mjs — MÔ PHỎNG NGƯỜI DÙNG THẬT trên pop-up "In tem SKU"
 * ===========================================================================================
 *  Vì sao cần thêm bộ này: `qc-in-tem.mjs` chỉ kiểm LÕI (mã vạch, khổ giấy, nở danh sách), còn
 *  `qc-tab-nhan-dien.mjs` chỉ chạm pop-up ở mấy ca bố cục. Không bộ nào GÕ VÀO Ô rồi BẤM NÚT như
 *  người thật — mà đúng chỗ đó mới là chỗ sinh lỗi: ô "Số lượng" có tới BA đường chốt số (nút +,
 *  Enter, rời ô) nên rất dễ chốt HAI LẦN cho một con số.
 *
 *  Sự cố thật 21/08/2026 (user báo): "gõ thêm số lượng thì bị double lên 2 lần tem".
 *
 *  Bộ này dùng chuột/bàn phím THẬT của Chromium (page.mouse / page.keyboard), không gọi hàm trong
 *  trang — vì lỗi nằm ở THỨ TỰ SỰ KIỆN (change rồi mới click), gọi hàm trực tiếp thì không bao giờ
 *  thấy.
 *
 *  node qc-in-tem-popup.mjs [--anh]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";
import { EDGE_PATH } from "./token-store.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const URL_TRANG = "file:///" + path.join(DIR, "..", "factory", "index.html").replace(/\\/g, "/");
const OUT = path.join(DIR, ".exports", "qc-intem");
const LUU_ANH = process.argv.includes("--anh");
if (LUU_ANH) fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({ headless: true, executablePath: EDGE_PATH,
  args: ["--allow-file-access-from-files", "--disable-web-security"] });
const page = await browser.newPage();
await page.setViewport({ width: 1360, height: 950 });
const loiTrang = [];
page.on("pageerror", (e) => loiTrang.push(String(e.message).slice(0, 200)));
page.on("console", (m) => { if (m.type() === "error") loiTrang.push("console: " + m.text().slice(0, 160)); });

/* Chặn Apps Script (hàng đợi in + tình trạng máy in) — không ra internet, không đụng máy in thật. */
await page.setRequestInterception(true);
page.on("request", (req) => {
  const u = req.url();
  /* gviz tab CAN-LOI-CHI (số cân thật cho pop-up Cân → SL): trả bản DÀN DỰNG chỉ có Irisa —
     ca 11 (Astra) phải RƠI VỀ thước Tex như cũ, còn ca cân-thật kiểm bằng số Irisa đã cân 22/08
     (lõi 14 · cả cuộn 171,5 → 157,5 gr chỉ / 5.000.000 mm). Không chặn thì QC ăn dữ liệu Sheet
     thật — số đổi theo người nhập là QC gãy vô cớ. */
  if (/docs\.google\.com\/spreadsheets/.test(u) && u.includes("CAN-LOI-CHI")) {
    const cb = (u.match(/responseHandler:([^&]+)/) || [])[1] || "gviz_canloi";
    return req.respond({ status: 200, contentType: "text/javascript",
      body: cb + "(" + JSON.stringify({ status: "ok", table: {
        cols: [{ label: "MÃ NHÓM" }, { label: "NHÃN" }, { label: "CỠ CHỈ" }, { label: "QUY CÁCH" },
          { label: "CÂN LÕI RỖNG (g) ← NHẬP" }, { label: "CÂN CẢ CUỘN NGUYÊN (g) ← NHẬP" }],
        rows: [{ c: [{ v: "IRISA-TEX-27-5000M" }, { v: "Irisa" }, { v: "Tex 27" }, { v: "5000m" }, { v: 14 }, { v: 171.5 }] }],
      } }) + ");" });
  }
  if (/script\.google\.com/.test(u)) {
    if (/callback=/.test(u)) {
      const cb = (u.match(/callback=([^&]+)/) || [])[1] || "cb";
      return req.respond({ status: 200, contentType: "text/javascript", body: cb + "({status:'success'});" });
    }
    return req.respond({ status: 200, contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ status: "success", may: { ready: true, ten: "TEST" }, cho: [] }) });
  }
  req.continue();
});

const ket = [];
function kiem(ten, ok, ghi) {
  ket.push({ ten, ok: !!ok, ghi: ghi || "" });
  console.log((ok ? "  ✓ " : "  ✗ ") + ten + (ghi ? "  — " + ghi : ""));
}
const cho = (ms) => new Promise((r) => setTimeout(r, ms));

await page.goto(URL_TRANG, { waitUntil: "domcontentloaded" });
await cho(1200);

/* ---------- Dựng danh sách chờ in: 2 SKU, mỗi dòng 1 tem ---------- */
await page.evaluate(() => {
  PR.sel = {
    "422495218": { sku: "422495218", pn: "Mẫu thông chuyền/CWHO0006/Xanh Tro-Dusky Green/Size S", slHang: "", mau: PR_TEM.MAU_MAC_DINH, sl: 1 },
    "422423807": { sku: "422423807", pn: "Vải Single Mesh/S130413 UZM Sheico/Xanh Tro-Dusky Green/mm", slHang: "", mau: PR_TEM.MAU_MAC_DINH, sl: 1 },
  };
  prLuu(); prMo();
});
await cho(600);
kiem("Pop-up In tem mở được với 2 SKU", await page.evaluate(() => {
  const m = document.getElementById("prmodal");
  return !!(m && m.classList.contains("show") && document.querySelectorAll("#prBody tr.prdong").length === 2);
}), await page.evaluate(() => document.querySelectorAll("#prBody tr.prdong").length + " dòng"));

/* ---------- Tiện ích đọc trạng thái ---------- */
const trangThai = () => page.evaluate(() => {
  const r1 = PR.sel["422495218"], r2 = PR.sel["422423807"];
  const chip = (s) => (PR_TEM.tachSl(s) || []).join("|");
  const oSl = document.querySelector('#prBody input.prsl-v[data-s="422495218"]');
  /* 22/08/2026: ô nhập Số tem ĐÃ BỎ — "Số tem: n" giờ là chữ .prtemso dán ở ô SKU cùng dòng. */
  const tag = oSl ? oSl.closest("tr").querySelector(".prtemso b") : null;
  return {
    chip1: chip(r1.slHang), chip2: chip(r2.slHang),
    sl1: r1.sl, tem1: PR_TEM.temCuaDong(r1), tong: PR_TEM.tongTem(prDs()),
    oSlVal: oSl ? oSl.value : "(không có ô)",
    tagSo: tag ? tag.textContent.trim() : "(không có)",
    nutIn: (document.querySelector("#prfoot .primary, .prfoot .primary") || {}).textContent || "",
  };
});
/* Gõ vào ô Số lượng của dòng 1 bằng BÀN PHÍM THẬT (không set .value): phải đi qua đúng chuỗi sự
   kiện input → change mà trang đang nghe. */
async function goSl(so) {
  const o = await page.$('#prBody input.prsl-v[data-s="422495218"]');
  await o.click({ clickCount: 3 });          // chọn hết nội dung cũ rồi ghi đè, y như người dùng
  await page.keyboard.type(String(so), { delay: 12 });
}
const nutCong = () => page.$('#prBody .prsladd[data-s="422495218"]');

/* ══════════ CA 1: gõ số rồi BẤM NÚT "+" ══════════
   Đây là đường chính mà giao diện dạy người dùng. Ô nhập có `onchange="prCam(this)"` và nút "+" có
   `onclick="prCam(...)"` — bấm nút thì input MẤT focus trước (change bắn) rồi mới tới click, tức
   MỘT con số có thể bị chốt HAI LẦN. */
await goSl(5);
(await nutCong()).click();
await cho(400);
let t = await trangThai();
kiem("Gõ 5 rồi bấm + → đúng MỘT chip (không double)",
  t.chip1 === "5", "chip = [" + t.chip1 + "] · số tem dòng 1 = " + t.tem1 + " · tổng " + t.tong);

/* ══════════ CA 2: gõ số rồi bấm ENTER ══════════ */
await goSl(6);
await page.keyboard.press("Enter");
await cho(400);
t = await trangThai();
kiem("Gõ 6 rồi Enter → thành chip thứ hai (không double)",
  t.chip1 === "5|6", "chip = [" + t.chip1 + "] · số tem dòng 1 = " + t.tem1);

/* ══════════ CA 3: gõ số rồi RỜI Ô (bấm ra ngoài) ══════════
   Đường này cố ý có để "không ai mất con số vừa đánh chỉ vì quên bấm +". */
await goSl(7);
/* td 3 = Tên sản phẩm (bảng 22/08 còn 4 ô: SL · SKU · tên · ×) — bấm ra đó để ô mất focus;
   TUYỆT ĐỐI không bấm td 4: đó là nút × xoá cả dòng. */
await page.click("#prBody tr:first-child td:nth-child(3)");
await cho(400);
t = await trangThai();
kiem("Gõ 7 rồi bấm ra ngoài ô → thành chip thứ ba (không double)",
  t.chip1 === "5|6|7", "chip = [" + t.chip1 + "]");

/* ══════════ CA 4: gõ số rồi bấm sang Ô CỦA DÒNG KHÁC ══════════
   Vừa blur (change) vừa focus phần tử khác — chỗ dễ chốt hai lần nhất. */
await goSl(8);
await page.click('#prBody input.prsl-v[data-s="422423807"]');
await cho(400);
t = await trangThai();
kiem("Gõ 8 rồi bấm sang ô dòng khác → chip thứ tư, dòng khác vẫn trống",
  t.chip1 === "5|6|7|8" && t.chip2 === "", "dòng 1 = [" + t.chip1 + "] · dòng 2 = [" + t.chip2 + "]");

/* ══════════ CA 5: "Số tem" hiển thị đúng (22/08/2026: cột + ô nhập Số tem ĐÃ BỎ) ══════════
   Số tem giờ là CHỮ "Số tem: n" dán ở ô SKU (con số phải khớp số chip), và không còn cái
   input.prsl-t nào để hai con số chỏi nhau nữa. */
t = await trangThai();
const oTemCu = await page.evaluate(() => !!document.querySelector("#prBody input.prsl-t"));
kiem("Có nhiều số lượng → chữ \"Số tem: n\" ở ô SKU khớp số chip, ô nhập Số tem đã BỎ HẲN",
  t.tem1 === 4 && t.tagSo === "4" && !oTemCu,
  "số tem = " + t.tem1 + " · chữ hiện " + t.tagSo + " · còn input cũ: " + oTemCu);

/* ══════════ CA 6: ô trống thì KHÔNG có gì để chốt ══════════
   Nút "+" chỉ hiện khi trong ô ĐANG có số (class ) — ô trống thì nó phải ẩn, và Enter trên ô
   trống cũng không được sinh chip rỗng. */
const truoc6 = (await trangThai()).chip1;
const nutAn = await page.evaluate(() => {
  const b = document.querySelector('#prBody .prsladd[data-s="422495218"]');
  return !!b && getComputedStyle(b).display === 'none';
});
await page.click('#prBody input.prsl-v[data-s="422495218"]');
await page.keyboard.press('Enter');
await cho(300);
t = await trangThai();
kiem("Ô trống: nút + ẩn, Enter không sinh chip rỗng",
  nutAn && t.chip1 === truoc6, "nút + ẩn = " + nutAn + " · chip = [" + t.chip1 + "]");

/* ══════════ CA 7: xoá một chip ══════════ */
await page.click('#prBody .prchip button.x[data-s="422495218"][data-i="1"]');
await cho(400);
t = await trangThai();
kiem("Bấm × trên chip thứ 2 → chỉ mất đúng chip đó", t.chip1 === "5|7|8", "chip = [" + t.chip1 + "]");

/* ══════════ CA 8 (đổi vai 22/08/2026 tối): HÀNG ĐIỀU KHIỂN ĐẦU POP-UP ĐÃ GỠ ══════════
   User bỏ cả hàng "Áp SỐ TEM cho tất cả / Áp SỐ LƯỢNG cho tất cả / Thêm SKU ngoài" (nhắc lần 2
   "vẫn còn hiển thị") — pop-up chỉ còn bảng dòng tem. Hai ca "Áp…" cũ và 4 ca "Thêm SKU ngoài"
   (thêm sáng cùng ngày) đi theo hàng đó; hàm prApSl/prApSlHang/prThemNgoai vẫn nằm trong JS
   nhưng không còn lối gọi nào. */
const hangGo = await page.evaluate(() => ({
  slAll: !!document.getElementById("prSlAll"), slhAll: !!document.getElementById("prSlhAll"),
  themSku: !!document.getElementById("prThemSku"), mfilters: !!document.querySelector("#prmodal .mfilters") }));
kiem("Hàng 'Áp SỐ TEM / Áp SỐ LƯỢNG / Thêm SKU ngoài' đã GỠ khỏi pop-up",
  !hangGo.slAll && !hangGo.slhAll && !hangGo.themSku && !hangGo.mfilters, JSON.stringify(hangGo));

/* ══════════ CA 10: gõ nhiều số một lần bằng dấu phẩy ══════════ */
await goSl("12, 14, 16");
(await nutCong()).click();
await cho(400);
t = await trangThai();
kiem("Dán \"12, 14, 16\" rồi bấm + → thêm đúng ba chip, không nhân đôi",
  t.chip1 === "5|7|8|12|14|16", "chip = [" + t.chip1 + "]");

/* ══════════ CA 11: CÂN → SỐ LƯỢNG (user chốt 22/08/2026 tối) ══════════
   Nút ⚖ trên thẻ nhận diện (chỉ nhóm Chỉ*) — ở đây gọi thẳng csMo để kiểm LÕI luồng: SKU tự vào
   danh sách in QUA prTick, prefill Tex từ tên hàng + lõi đã nhớ của tab Chuyển đổi cân, cân từng
   cuộn chốt thành chip mm TRƠN (tachSl cắt theo dấu phẩy nên "5,000,000" là vỡ 3 chip — bẫy đã né).
   Số đẹp để soi tay: Tex 27, lõi 50 → cuộn 185gr = (185−50)×10⁶/27 = 5.000.000 mm;
   cuộn 117.5gr = 67.5×10⁶/27 = 2.500.000 mm. */
await page.evaluate(() => {
  NDS.ds = [{ sku: "422533333", pn: "Chỉ astra/C9700_Coats Phong Phú/Polyester /None/Black/None/Text 27- 60-3-Tkt 120/mm", type: "NORMAL", status: "ACTIVE", qty: 9 }];
  localStorage.setItem("cd-quycach", JSON.stringify({ qc: 5000000, loi: "50" }));
  csMo("422533333");
});
await cho(500);
let cs = await page.evaluate(() => ({
  show: document.getElementById("csmodal").classList.contains("show"),
  daThem: prCo("422533333"),
  tex: document.getElementById("csTex").value, loi: document.getElementById("csLoi").value }));
kiem("Cân→SL: SKU Chỉ TỰ vào danh sách in + prefill Tex 27 từ tên + lõi 50 đã nhớ",
  cs.show && cs.daThem && cs.tex === "27" && cs.loi === "50", JSON.stringify(cs));
await page.click("#csCan", { clickCount: 3 });
await page.keyboard.type("185", { delay: 10 });
await cho(300);
const nutChot = await page.$eval("#csBtnChot", (e) => ({ dis: e.disabled, chu: e.textContent }));
kiem("Cân cuộn 185 gr → nút chốt bật và ghi rõ 5,000,000 mm", !nutChot.dis && /5,000,000 mm/.test(nutChot.chu), nutChot.chu);
await page.click("#csBtnChot");
await cho(300);
await page.keyboard.type("117.5", { delay: 10 });   // focus đã tự quay về ô cân — nhịp cân cuộn tiếp
await page.keyboard.press("Enter");
await cho(300);
cs = await page.evaluate(() => {
  const r = PR.sel["422533333"];
  return { slHang: r.slHang, tem: PR_TEM.temCuaDong(r), oCan: document.getElementById("csCan").value,
    daChot: document.getElementById("csDaChot").textContent };
});
kiem("Chốt 2 cuộn (nút + / Enter) → 2 chip mm TRƠN, 2 tem, ô cân tự dọn cho cuộn tiếp",
  cs.slHang === "5000000, 2500000" && cs.tem === 2 && cs.oCan === "" && /Đã chốt 2/.test(cs.daChot),
  JSON.stringify(cs));
await page.evaluate(() => { csMoInTem(); });
await cho(500);
cs = await page.evaluate(() => {
  const o = document.querySelector('#prBody input.prsl-v[data-s="422533333"]');
  const tag = o && o.closest("tr").querySelector(".prtemso b");
  return {
    prShow: document.getElementById("prmodal").classList.contains("show"),
    csShow: document.getElementById("csmodal").classList.contains("show"),
    chips: [...document.querySelectorAll("#prBody .prchip")].filter((c) => /5000000|2500000/.test(c.textContent)).length,
    tagSo: tag ? tag.textContent.trim() : "(không có)" };
});
kiem("Mở In tem từ pop-up cân: 2 chip mm nằm đúng dòng, chữ \"Số tem: 2\" theo luật chip",
  cs.prShow && !cs.csShow && cs.chips === 2 && cs.tagSo === "2", JSON.stringify(cs));
const cuNguyen = await page.evaluate(() => PR_TEM.tachSl(PR.sel["422495218"].slHang).join("|"));
kiem("Luồng in tem CŨ nguyên vẹn: chip của SKU trước không suy suyển", cuNguyen === "5|7|8|12|14|16", cuNguyen);

/* ══════════ CA 12: CÂN → SL theo SỐ CÂN THẬT (tab CAN-LOI-CHI, 22/08/2026 chiều) ══════════
   Nhãn ĐÃ cân (Irisa, dữ liệu dàn dựng ở request-interception): lõi thật 14 gr đè số nhớ 50,
   mật độ lấy 5.000.000/(171,5−14)=31.746,03 mm/gr thay vì Tex 27 danh nghĩa (37.037 — lệch
   +16,7%, đúng phát hiện 22/08: "Tex 27" 60/3 cân ra ~31,5 g/km). Số đẹp soi tay: cân đúng
   1 cuộn nguyên 171,5 gr phải ra ĐÚNG 5.000.000 mm. Gõ Tex khác prefill = chủ động ghi đè →
   quay về thước Tex (157,5 × 10⁶/30 = 5.250.000). Ca 11 (Astra, KHÔNG có trong dữ liệu cân)
   đứng trên đã chứng minh đường cũ nguyên vẹn. */
await page.evaluate(() => { prDong(); });   // ca trước để prmodal mở — về hiện trường thẻ kết quả
await cho(300);
await page.evaluate(() => {
  NDS.ds.push({ sku: "422544444", pn: "Chỉ Irisa/F1-1214_Phong Việt/100% Polyester/White/Tex 27-60-3/mm", type: "NORMAL", status: "ACTIVE", qty: 9 });
  csMo("422544444");
});
await cho(700);   // chờ JSONP dàn dựng về + csApThat điền lại
cs = await page.evaluate(() => ({
  show: document.getElementById("csmodal").classList.contains("show"),
  loi: document.getElementById("csLoi").value,
  texDoc: document.getElementById("csTexDoc").textContent }));
kiem("Cân thật: lõi tự điền 14 (đè số nhớ 50) + dòng nguồn ghi CÂN THẬT Irisa",
  cs.show && cs.loi === "14" && /CÂN THẬT/.test(cs.texDoc) && /Irisa/.test(cs.texDoc), JSON.stringify(cs).slice(0, 180));
await page.click("#csCan", { clickCount: 3 });
await page.keyboard.type("171.5", { delay: 10 });
await cho(300);
let nutThat = await page.$eval("#csBtnChot", (e) => ({ dis: e.disabled, chu: e.textContent }));
kiem("Cân 1 cuộn nguyên 171,5 gr → đúng 5,000,000 mm theo mật độ CÂN THẬT (không phải 5,833,333 theo Tex 27)",
  !nutThat.dis && /Chốt 5,000,000 mm/.test(nutThat.chu), nutThat.chu);
await page.click("#csTex", { clickCount: 3 });
await page.keyboard.type("30", { delay: 10 });
await cho(300);
nutThat = await page.$eval("#csBtnChot", (e) => ({ chu: e.textContent }));
const texDocSau = await page.$eval("#csTexDoc", (e) => e.textContent);
kiem("Gõ Tex 30 (khác prefill) = chủ động ghi đè → quay về thước Tex: 157,5 gr × 10⁶/30 = 5,250,000 mm",
  /Chốt 5,250,000 mm/.test(nutThat.chu) && !/CÂN THẬT/.test(texDocSau), nutThat.chu);
/* ══════════ CA 13: thanh nổi "Chờ in" không được ĐÈ lên pop-up cân (ảnh user 22/08 14:03) ══════════
   Cùng khuôn prm-open của prmodal: mở #csmodal thì body mang csm-open → #prbar display:none;
   đóng pop-up thì thanh hiện lại (đang ở tab sku + có SKU chờ in). csmodal của CA 12 còn mở. */
await page.evaluate(() => { TOPTAB = "sku"; prSyncBar(); });
let barCs = await page.$eval("#prbar", (e) => getComputedStyle(e).display);
kiem("Pop-up cân mở → thanh nổi Chờ in ẨN (trước đây đè lên pop-up)", barCs === "none", "display=" + barCs);
await page.evaluate(() => { csDong(); });
await cho(300);
barCs = await page.$eval("#prbar", (e) => getComputedStyle(e).display);
kiem("Đóng pop-up cân → thanh nổi hiện lại ở tab Nhận diện", barCs === "flex", "display=" + barCs);

/* Dọn: bỏ SKU của ca này và MỞ LẠI prmodal — các ca điện thoại phía sau đo phần tử bên trong
   pop-up In tem (trước khi có ca 12, prmodal đang mở sẵn từ ca csMoInTem). */
await page.evaluate(() => { prXoa("422544444"); NDS.ds.pop(); prMo(); });
await cho(400);

/* ══════════ ĐIỆN THOẠI 390px — thẻ BẢN 22/08/2026 (bỏ cột Số tem) theo 9 luật của dự án ══════════
   Đặc tả user 22/08/2026: chip số lượng nằm CHỖ Ô "SỐ TEM" CŨ — dồn bìa trái, NGANG HÀNG với ô
   nhập số lượng; "Số tem: n" cùng hàng với mã SKU, chôn cứng kế nút ×; dải chip rời `tr.prsl2`
   và ô nhập Số tem không được còn. Đo bằng getBoundingClientRect nên không thể "xanh mà giao
   diện vẫn xấu". */
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await cho(700);
/* Cho dòng 2 (đang trống) MỘT chip để đo ca "chip ngang hàng ô nhập": dòng 1 có 6 chip thì ô nhập
   được phép rớt xuống dòng dưới (flex-wrap là chủ đích, không bóp chip) — đo ở đó là đo sai đặc tả. */
await page.evaluate(() => { PR.sel["422423807"].slHang = "12"; prLuu(); prVe(); });
await cho(400);
const mb = await page.evaluate(() => {
  const r = (el) => el.getBoundingClientRect();
  const giua = (a) => a.top + a.height / 2;
  const tr1 = document.querySelector('#prBody input.prsl-v[data-s="422495218"]').closest("tr");
  const tr2 = document.querySelector('#prBody input.prsl-v[data-s="422423807"]').closest("tr");
  const body = document.querySelector("#prmodal .modalbody");
  const sku = tr1.querySelector("td.prsku>b"), tag = tr1.querySelector(".prtemso"), del = tr1.querySelector(".prdel");
  const nutX = tr1.querySelector(".prchip button.x");
  const chip2 = tr2.querySelector(".prchip"), oSl2 = tr2.querySelector("input.prsl-v");
  const rs = r(sku), rg = r(tag), rd = r(del), rx = r(nutX), rc = r(chip2), ro = r(oSl2), rt2 = r(tr2);
  return {
    daiCu: !!document.querySelector("#prBody tr.prsl2"),
    oTemCu: !!document.querySelector("#prBody input.prsl-t"),
    keoNgang: body.scrollWidth - body.clientWidth,
    tagSo: (tag.querySelector("b") || {}).textContent,
    tagNgangSku: Math.abs(giua(rg) - giua(rs)) < 12,
    tagSatX: Math.round(rd.left - rg.right),
    chipTrai: Math.round(rc.left - rt2.left),
    chipNgangO: Math.abs(giua(rc) - giua(ro)) < 12,
    oSatPhai: Math.round(rt2.right - ro.right),
    caoO: Math.round(ro.height),
    caoX: Math.round(Math.max(rx.width, rx.height)),
    rongO: Math.round((ro.width / rt2.width) * 100),
    chuChip: parseFloat(getComputedStyle(chip2).fontSize),
  };
});
kiem("Điện thoại: hết dải chip rời + hết ô Số tem, không kéo ngang",
  !mb.daiCu && !mb.oTemCu && mb.keoNgang <= 0,
  "dải cũ: " + mb.daiCu + " · ô tem cũ: " + mb.oTemCu + " · kéo ngang = " + mb.keoNgang + "px");
kiem("Điện thoại: \"Số tem: 6\" NGANG HÀNG mã SKU, chôn cứng kế nút ×",
  mb.tagSo === "6" && mb.tagNgangSku && mb.tagSatX >= 0 && mb.tagSatX <= 30,
  "số " + mb.tagSo + " · ngang hàng: " + mb.tagNgangSku + " · cách nút × " + mb.tagSatX + "px");
kiem("Điện thoại: chip dồn bìa trái (chỗ ô Số tem cũ), NGANG HÀNG ô nhập; ô nhập dính bìa phải",
  mb.chipTrai <= 16 && mb.chipNgangO && mb.oSatPhai >= 0 && mb.oSatPhai <= 16,
  "chip cách trái " + mb.chipTrai + "px · ngang hàng ô nhập: " + mb.chipNgangO + " · ô cách phải " + mb.oSatPhai + "px");
kiem("Điện thoại: ô nhập ~2/5 thẻ, vẫn cao ≥44px; nút × chip ≥40px; chữ chip ≥10,5px",
  mb.rongO > 0 && mb.rongO <= 45 && mb.caoO >= 44 && mb.caoX >= 40 && mb.chuChip >= 10.5,
  "ô nhập rộng " + mb.rongO + "% thẻ · cao " + mb.caoO + "px · nút × " + mb.caoX + "px · chip " + mb.chuChip + "px");
if (LUU_ANH) await page.screenshot({ path: path.join(OUT, "popup-390.png") });
await page.setViewport({ width: 1360, height: 950 });
await cho(400);

if (LUU_ANH) await page.screenshot({ path: path.join(OUT, "popup.png") });
kiem("Không có lỗi JS nào trên trang", loiTrang.length === 0, loiTrang.slice(0, 2).join(" | "));

await browser.close();
const dat = ket.filter((k) => k.ok).length;
console.log("\n" + (dat === ket.length ? "✓ " : "✗ ") + dat + "/" + ket.length + " ca đạt" +
  (LUU_ANH ? "  (ảnh ở " + OUT + ")" : ""));
process.exit(dat === ket.length ? 0 : 1);
