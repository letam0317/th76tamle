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
  /* 23/08/2026: con số sau "Số tem:" LẠI LÀ Ô NHẬP (`input.prtemin`, yêu cầu user) — dòng khai nhiều
     số lượng thì ô đó `readonly` (số tem là dẫn xuất từ danh sách chip), dòng một số lượng thì gõ
     được để in N con tem giống nhau. Bản 22/08 nó là chữ `.prtemso b`. */
  const tag = oSl ? oSl.closest("tr").querySelector(".prtemin") : null;
  return {
    chip1: chip(r1.slHang), chip2: chip(r2.slHang),
    sl1: r1.sl, tem1: PR_TEM.temCuaDong(r1), tong: PR_TEM.tongTem(prDs()),
    oSlVal: oSl ? oSl.value : "(không có ô)",
    tagSo: tag ? String(tag.value).trim() : "(không có)",
    tagKhoa: tag ? tag.hasAttribute("readonly") : null,
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

/* ══════════ CA 5: ô "Số tem" (23/08/2026 — user cho NHẬP LẠI con số này) ══════════
   Hai vai rạch ròi, và đây là chỗ dễ sinh "hai con số chỏi nhau" nhất nên phải đo cả hai:
     · dòng khai TỪ 2 SỐ LƯỢNG: số tem là DẪN XUẤT (mỗi chip một con tem) ⇒ ô phải `readonly` và
       hiện đúng số chip — không được nhận số rồi âm thầm bỏ qua;
     · dòng khai MỘT số lượng: gõ N vào đó là ra N con tem giống nhau (ca dưới).
   Ô nhập Số tem CỘT RIÊNG của bản 20/08 (`input.prsl-t`) vẫn phải biến mất — đó là cái từng làm số
   tem trên màn khác số tem ra khỏi máy in. */
t = await trangThai();
const oTemCu = await page.evaluate(() => !!document.querySelector("#prBody input.prsl-t"));
kiem("Nhiều số lượng → ô \"Số tem\" KHOÁ và khớp số chip (cột Số tem cũ vẫn không quay lại)",
  t.tem1 === 4 && t.tagSo === "4" && t.tagKhoa === true && !oTemCu,
  "số tem = " + t.tem1 + " · ô hiện " + t.tagSo + " · khoá: " + t.tagKhoa + " · còn cột cũ: " + oTemCu);
/* Gõ vào ô đã khoá (dòng 4 chip) → số tem KHÔNG được đổi. Dùng `prDatSl` trực tiếp vì `readonly`
   chặn bàn phím thật — cửa cần chốt ở đây là LOGIC, không phải cái thuộc tính HTML. */
await page.evaluate(() => prDatSl("422495218", 99));
await cho(250);
t = await trangThai();
kiem("Ép số tem cho dòng nhiều số lượng → bị chặn, vẫn đúng 4 tem (không có hai con số chỏi nhau)",
  t.tem1 === 4 && t.tagSo === "4", "số tem = " + t.tem1 + " · ô hiện " + t.tagSo);
/* Dòng MỘT số lượng: gõ 5 vào ô Số tem → 5 con tem cùng ghi một số lượng. Gõ bằng bàn phím thật
   (ô này không readonly) rồi Enter, đúng đường người dùng đi. */
await page.evaluate(() => { PR.sel["422423807"].slHang = "12"; prLuu(); prVe(); });
await cho(250);
const oTem = await page.$('#prBody input.prtemin[data-s="422423807"]');
await oTem.click({ clickCount: 3 });
await page.keyboard.type("5", { delay: 15 });
await page.keyboard.press("Enter");
await cho(350);
const temMot = await page.evaluate(() => ({
  sl: PR.sel["422423807"].sl, tem: PR_TEM.temCuaDong(PR.sel["422423807"]),
  no: PR_TEM.moRong([PR.sel["422423807"]]).map((x) => x.slHang).join("|"),
  o: (document.querySelector('#prBody input.prtemin[data-s="422423807"]') || {}).value }));
kiem("Một số lượng: gõ 5 vào ô \"Số tem\" → 5 con tem CÙNG số lượng 12 (khỏi chốt 12 năm lần)",
  temMot.tem === 5 && temMot.o === "5" && temMot.no === "12|12|12|12|12",
  "sl=" + temMot.sl + " · tem=" + temMot.tem + " · nở ra [" + temMot.no + "]");
/* BẤM VÀO CHỮ "Số tem:" cũng phải vào được ô — sự cố user báo 23/08: *"Số tem: 1 không nhập được trên
   bản web"*. Lái trình duyệt thật vào bản live thì ô NHẬN số, nên nguyên nhân là bản cũ trong cache
   CỘNG với việc ô 44×20px viền mờ trên một dòng phụ cỡ nửa **không đọc ra là ô nhập**: nhắm bằng chuột
   lệch ra chữ bên cạnh một lần là người dùng kết luận nó không nhận. Chữa: `<label>` bọc input (bấm
   nhãn là vào ô, không cần JS) + ô to hơn, viền pha accent. Ca này khoá cả hai. */
const bamNhan = await page.evaluate(() => {
  const o = document.querySelector('#prBody input.prtemin[data-s="422423807"]');
  const nhan = o.closest('.prtemso');
  o.blur();
  const r = nhan.getBoundingClientRect(), ro = o.getBoundingClientRect();
  const x = Math.round(r.left + Math.max(2, (ro.left - r.left) / 2));   // giữa phần CHỮ
  const cs = getComputedStyle(nhan);
  return { the: nhan.tagName, khoa: o.hasAttribute("readonly"), tro: cs.cursor,
    rongO: Math.round(ro.width), caoO: Math.round(ro.height),
    x: x, y: Math.round(r.top + r.height / 2), ngoaiO: x < Math.round(ro.left) - 2 };
});
await page.mouse.click(bamNhan.x, bamNhan.y);
await cho(250);
const daVaoO = await page.evaluate(() => {
  const a = document.activeElement;
  return !!(a && a.classList && a.classList.contains("prtemin") &&
    a.getAttribute("data-s") === "422423807");
});
kiem("Bấm vào CHỮ \"Số tem:\" (ngoài ô) → con trỏ vào luôn ô nhập; ô ≥50×22px, nhãn có cursor pointer",
  bamNhan.the === "LABEL" && !bamNhan.khoa && bamNhan.ngoaiO && daVaoO &&
  bamNhan.rongO >= 50 && bamNhan.caoO >= 22 && bamNhan.tro === "pointer",
  "thẻ <" + bamNhan.the.toLowerCase() + "> · bấm ngoài ô: " + bamNhan.ngoaiO +
  " · vào ô: " + daVaoO + " · ô " + bamNhan.rongO + "×" + bamNhan.caoO + "px · con trỏ " + bamNhan.tro);
/* Dòng số tem DẪN XUẤT thì KHÔNG được mời bấm: con trỏ phải là `default`, ô `readonly`. */
const nhanKhoa = await page.evaluate(() => {
  const o = document.querySelector('#prBody input.prtemin[data-s="422495218"]');
  const nhan = o.closest(".prtemso");
  return { cd: nhan.classList.contains("cd"), khoa: o.hasAttribute("readonly"),
    tro: getComputedStyle(nhan).cursor, vien: getComputedStyle(o).borderTopColor };
});
kiem("Dòng số tem dẫn xuất: ô khoá, nhãn KHÔNG mời bấm (cursor default), viền trong suốt như chữ",
  nhanKhoa.cd && nhanKhoa.khoa && nhanKhoa.tro === "default" && /rgba?\(.*, ?0\)$/.test(nhanKhoa.vien),
  "cd: " + nhanKhoa.cd + " · khoá: " + nhanKhoa.khoa + " · con trỏ " + nhanKhoa.tro + " · viền " + nhanKhoa.vien);
/* Trần PR_TRAN_SL phải chặn được ở ĐÂY nữa (không chỉ ở nút +): gõ 9999 là ra 200, không phải 9999
   con tem xếp hàng trong máy in. */
await page.evaluate(() => prDatSl("422423807", 9999));
await cho(250);
const temTran = await page.evaluate(() => PR_TEM.temCuaDong(PR.sel["422423807"]));
kiem("Ô \"Số tem\" bị chặn trần " + "PR_TRAN_SL" + " (gõ 9999 → 200, không phải 9999 con tem)",
  temTran === 200, "ra " + temTran + " tem");
/* SỐ CŨ KHÔNG ĐƯỢC SỐNG LẠI — bẫy sinh ra đúng lúc ô "Số tem" nhập lại được (23/08/2026):
   1 số lượng + Số tem 5 → chốt thêm một số lượng nữa (luật lõi: 2 tem) → BỎ BỚT về lại 1 số lượng.
   Nếu `sl = 5` còn nằm đó thì màn hình vừa hiện 2 tem, máy in lại nhả 5 — kiểu sai người dùng chỉ
   phát hiện khi tem đã ra. `prLuu` dọn `sl` về 1 ngay khi dòng có từ 2 số lượng. */
const songLai = await page.evaluate(async () => {
  const r = PR.sel["422423807"];
  r.slHang = "12"; r.sl = 1; prLuu(); prVe();
  prDatSl("422423807", 5);
  const mot = PR_TEM.temCuaDong(r);
  r.slHang = "12, 14"; prLuu(); prVe();
  const hai = PR_TEM.temCuaDong(r);
  r.slHang = "12"; prLuu(); prVe();
  await new Promise((x) => setTimeout(x, 120));
  return { mot: mot, hai: hai, veMot: PR_TEM.temCuaDong(r), sl: r.sl,
    o: (document.querySelector('#prBody input.prtemin[data-s="422423807"]') || {}).value };
});
kiem("Số tem cũ KHÔNG sống lại: 5 tem → thêm số lượng (2 tem) → bỏ bớt về 1 số lượng = 1 tem",
  songLai.mot === 5 && songLai.hai === 2 && songLai.veMot === 1 && songLai.sl === 1 && songLai.o === "1",
  songLai.mot + " → " + songLai.hai + " → " + songLai.veMot + " tem (sl=" + songLai.sl + ", ô hiện " + songLai.o + ")");
await page.evaluate(() => { PR.sel["422423807"].slHang = ""; PR.sel["422423807"].sl = 1; prLuu(); prVe(); });
await cho(250);

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
  tex: document.getElementById("csTex").value, loi: document.getElementById("csLoi").value,
  cuon: document.getElementById("csCuon").value,
  conThieu: (document.getElementById("csKq").textContent || "").trim(),
  hintThua: !!document.querySelector('label[for="csTex"] .hint') || !!document.querySelector('label[for="csLoi"] .hint') ||
    !!document.querySelector('label[for="csCuon"] .hint'),
  subSku: (document.querySelector("#csSub b") || {}).textContent }));
kiem("Cân→SL: SKU Chỉ TỰ vào danh sách in + prefill Tex 27 từ tên + lõi 50 đã nhớ",
  cs.show && cs.daThem && cs.tex === "27" && cs.loi === "50", JSON.stringify(cs).slice(0, 160));
/* Bản 22/08/2026 tối: Số cuộn thừa BẮT BUỘC (không còn mặc định 1), 3 cụm hint thừa đã bỏ,
   mã SKU ở dòng phụ đề tô nổi bằng <b>. */
kiem("Số cuộn thừa BẮT BUỘC: mở pop-up là ô trống + khối \"Còn thiếu\" kể tên nó",
  cs.cuon === "" && /số cuộn thừa/i.test(cs.conThieu), "ô = \"" + cs.cuon + "\" · " + cs.conThieu.slice(0, 80));
kiem("3 cụm hint thừa đã bỏ (Tex/lõi/cuộn) + SKU tô nổi ở dòng phụ đề",
  !cs.hintThua && cs.subSku === "422533333", "hint còn: " + cs.hintThua + " · sub b = " + cs.subSku);
await page.click("#csCan", { clickCount: 3 });
await page.keyboard.type("185", { delay: 10 });
await cho(300);
/* Sự cố máy thật 22/08/2026: bàn phím ảo che ô "Số cuộn thừa", người dùng không biết còn ô phải
   nhập. Nay Enter ở ô cân khi CÒN THIẾU → nhảy thẳng sang ô thiếu; gõ xong Enter lần nữa (đủ cả,
   đứng ở ô cuộn) → BLUR để bàn phím rút xuống cho thấy kết quả + nút Chốt. */
let nutChot = await page.$eval("#csBtnChot", (e) => ({ dis: e.disabled, chu: e.textContent }));
kiem("Gõ 185 gr mà CHƯA khai số cuộn thừa → nút Chốt vẫn khoá (bắt buộc đủ 2 giá trị)",
  nutChot.dis === true, nutChot.chu);
await page.keyboard.press("Enter");
await cho(250);
const focusSauEnter = await page.evaluate(() => (document.activeElement || {}).id || "(không)");
kiem("Enter ở ô cân khi còn thiếu → focus NHẢY sang ô Số cuộn thừa",
  focusSauEnter === "csCuon", "focus = " + focusSauEnter);
await page.keyboard.type("1", { delay: 10 });
await page.keyboard.press("Enter");
await cho(250);
const sauCuon = await page.evaluate(() => ({
  focus: (document.activeElement || {}).id || "(không)",
  dis: document.getElementById("csBtnChot").disabled, chu: document.getElementById("csBtnChot").textContent }));
kiem("Đủ 2 giá trị + Enter ở ô cuộn → BLUR (bàn phím rút xuống), nút chốt bật đúng 5,000,000 mm",
  sauCuon.focus !== "csCuon" && sauCuon.focus !== "csCan" && !sauCuon.dis && /5,000,000 mm/.test(sauCuon.chu),
  "focus = " + sauCuon.focus + " · " + sauCuon.chu);
await page.click("#csBtnChot");
await cho(300);
await page.keyboard.type("117.5", { delay: 10 });   // focus đã tự quay về ô cân — nhịp cân cuộn tiếp
await page.keyboard.press("Enter");                 // đủ cả + đứng Ô CÂN → Enter = chốt luôn (nhịp cũ)
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
  const tag = o && o.closest("tr").querySelector(".prtemin");   // 23/08: là Ô NHẬP, không còn là chữ
  return {
    prShow: document.getElementById("prmodal").classList.contains("show"),
    csShow: document.getElementById("csmodal").classList.contains("show"),
    chips: [...document.querySelectorAll("#prBody .prchip")].filter((c) => /5000000|2500000/.test(c.textContent)).length,
    tagSo: tag ? String(tag.value).trim() : "(không có)" };
});
kiem("Mở In tem từ pop-up cân: 2 chip mm nằm đúng dòng, ô \"Số tem\" hiện 2 theo luật chip",
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
  texDoc: document.getElementById("csTexDoc").textContent,
  moTex: document.getElementById("csTex").classList.contains("cs-mo"),
  moLoi: document.getElementById("csLoi").classList.contains("cs-mo") }));
kiem("Cân thật: lõi tự điền 14 (đè số nhớ 50) + dòng nguồn ghi CÂN THẬT Irisa",
  cs.show && cs.loi === "14" && /CÂN THẬT/.test(cs.texDoc) && /Irisa/.test(cs.texDoc), JSON.stringify(cs).slice(0, 180));
/* Có sổ cân CAN-LOI-CHI → hai ô Tex + lõi LÀM MỜ (cs-mo) vì là số máy điền (user 22/08/2026 tối). */
kiem("Có sổ cân → số ở ô Tex + lõi LÀM MỜ (cs-mo, số máy điền)",
  cs.moTex && cs.moLoi, "Tex mờ: " + cs.moTex + " · lõi mờ: " + cs.moLoi);
await page.click("#csCan", { clickCount: 3 });
await page.keyboard.type("171.5", { delay: 10 });
await page.keyboard.press("Enter");                 // còn thiếu số cuộn thừa → nhảy sang ô đó
await page.keyboard.type("1", { delay: 10 });
await page.keyboard.press("Enter");                 // đủ cả → blur, bàn phím rút
await cho(300);
let nutThat = await page.$eval("#csBtnChot", (e) => ({ dis: e.disabled, chu: e.textContent }));
kiem("Cân 1 cuộn nguyên 171,5 gr → đúng 5,000,000 mm theo mật độ CÂN THẬT (không phải 5,833,333 theo Tex 27)",
  !nutThat.dis && /Chốt 5,000,000 mm/.test(nutThat.chu), nutThat.chu);
await page.click("#csTex", { clickCount: 3 });
await page.keyboard.type("30", { delay: 10 });
await cho(300);
nutThat = await page.$eval("#csBtnChot", (e) => ({ chu: e.textContent }));
const texDocSau = await page.$eval("#csTexDoc", (e) => e.textContent);
const moTexSau = await page.$eval("#csTex", (e) => e.classList.contains("cs-mo"));
kiem("Gõ Tex 30 (khác prefill) = chủ động ghi đè → quay về thước Tex: 157,5 gr × 10⁶/30 = 5,250,000 mm",
  /Chốt 5,250,000 mm/.test(nutThat.chu) && !/CÂN THẬT/.test(texDocSau), nutThat.chu);
kiem("Gõ đè Tex → ô hết mờ (số người gõ, không còn là số máy điền)", moTexSau === false, "cs-mo = " + moTexSau);
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

/* ══════════ ĐIỆN THOẠI — thẻ BẢN 23/08/2026 theo 9 luật của dự án ══════════
   ĐẶC TẢ USER 23/08/2026, nguyên văn: `"x" / "422386260" / "Số tem: 1" (cho phép nhập số lượng tem)
   / "Gõ số lượng"`, và `chip số lượng đã nhập thì thể hiện bên dưới tên sản phẩm`.
   Tức so với bản 22/08 có BA thứ đảo chiều, và cả ba phải đo được bằng số:
     ① nút × XOÁ SKU chuyển từ bìa PHẢI sang BÌA TRÁI, đứng TRƯỚC mã SKU;
     ② dải chip rời khỏi hàng ô nhập, xuống hàng RIÊNG dưới tên sản phẩm;
     ③ con số "Số tem" là Ô NHẬP, không còn là chữ.
   Đo ở HAI bề rộng: 390px (máy phổ biến) và 360px (máy nhỏ nhất còn dùng ở kho) — hàng đầu giờ gánh
   bốn món nên đây đúng là chỗ dễ tràn mép, mà bộ đo cũ chỉ nhìn 390px.
   Đo bằng getBoundingClientRect nên không thể "xanh mà giao diện vẫn xấu". */
for (const W of [390, 360]) {
await page.setViewport({ width: W, height: 844, deviceScaleFactor: 2 });
await cho(700);
/* Cho dòng 2 (đang trống) MỘT chip để đo ca "dải chip nằm dưới tên hàng" ở dòng ít chip nhất. */
await page.evaluate(() => { PR.sel["422423807"].slHang = "12"; prLuu(); prVe(); });
await cho(400);
const mb = await page.evaluate(() => {
  const r = (el) => el.getBoundingClientRect();
  const giua = (a) => a.top + a.height / 2;
  const tr1 = document.querySelector('#prBody input.prsl-v[data-s="422495218"]').closest("tr");
  const tr2 = document.querySelector('#prBody input.prsl-v[data-s="422423807"]').closest("tr");
  const body = document.querySelector("#prmodal .modalbody");
  const sku = tr1.querySelector("td.prsku>b"), tag = tr1.querySelector(".prtemso"), del = tr1.querySelector(".prdel");
  const oSl1 = tr1.querySelector("input.prsl-v"), nutX = tr1.querySelector(".prchip button.x");
  const chip2 = tr2.querySelector(".prchip"), oSl2 = tr2.querySelector("input.prsl-v");
  const pn2 = tr2.querySelector("td.pn");
  const rs = r(sku), rg = r(tag), rd = r(del), rx = r(nutX), rc = r(chip2), ro = r(oSl2), rt2 = r(tr2);
  const r1 = r(oSl1), rp2 = r(pn2);
  /* "Tràn mép thẻ" đo theo TỪNG Ô của hàng đầu: 4 món trên một hàng là chỗ dễ đè nhau nhất, mà
     `scrollWidth` của modalbody thì `overflow-x:hidden` che mất. */
  const cs = getComputedStyle(tr1);
  const trai = r(tr1).left + parseFloat(cs.paddingLeft), phai = r(tr1).right - parseFloat(cs.paddingRight);
  const tran = ["td.prxoa", "td.prsku", "td.prslo"].map(function (s) {
    const e = tr1.querySelector(s); if (!e) return 0;
    const b = r(e);
    return Math.round(Math.max(0, trai - b.left, b.right - phai));
  });
  return {
    daiCu: !!document.querySelector("#prBody tr.prsl2"),
    oTemCu: !!document.querySelector("#prBody input.prsl-t"),
    keoNgang: body.scrollWidth - body.clientWidth,
    tranO: Math.max.apply(null, tran), tran: tran,
    tagSo: (tag.querySelector("input") || {}).value,
    tagLaO: !!tag.querySelector("input.prtemin"),
    tagNgangSku: Math.abs(giua(rg) - giua(rs)) < 12,
    /* × ĐỨNG TRƯỚC mã SKU (đảo chiều 23/08): khoảng cách mã − × phải DƯƠNG và nhỏ. */
    xTruocSku: Math.round(rs.left - rd.right),
    xBiaTrai: Math.round(rd.left - trai),
    /* "Số tem" kẹp giữa mã SKU và ô gõ số lượng — đúng thứ tự user kể. Máy hẹp dưới ~344px thì nó
       được phép TỤT XUỐNG DÒNG DƯỚI trong ô SKU (van an toàn flex-wrap); điều KHÔNG được phép là
       nằm cùng dòng mà ĐÈ LÊN ô gõ số lượng — bản nháp 23/08 đè 12px ở 360px. */
    temGiua: rg.left > rs.left && (rg.right <= r1.left + 2 || rg.top >= rs.bottom - 2),
    temDeO: !(rg.right <= r1.left + 2 || rg.bottom <= r1.top + 2 || rg.top >= r1.bottom - 2),
    /* Dải chip nằm DƯỚI tên sản phẩm và bám bìa trái thẻ. */
    chipDuoiTen: rc.top >= rp2.bottom - 1,
    chipTrai: Math.round(rc.left - trai),
    caoO: Math.round(ro.height),
    caoX: Math.round(Math.max(rx.width, rx.height)),
    caoDel: Math.round(Math.min(rd.width, rd.height)),
    /* Nút × XOÁ SKU phải ĐỎ (user: "cần làm cho nổi bật — màu đỏ để người dùng biết"), và đỏ SẴN
       chứ không phải chỉ đỏ khi hover — điện thoại không có hover. */
    mauDel: getComputedStyle(del).color,
    rongO: Math.round((ro.width / rt2.width) * 100),
    chuChip: parseFloat(getComputedStyle(chip2).fontSize),
  };
});
const P = "Điện thoại " + W + "px: ";
/* Đỏ = kênh R trội hẳn hai kênh còn lại (biến --bad đổi theo theme nên không so chuỗi cứng được). */
const rgb = String(mb.mauDel).match(/\d+/g) || [0, 0, 0];
const doThat = Number(rgb[0]) > Number(rgb[1]) + 40 && Number(rgb[0]) > Number(rgb[2]) + 40;
kiem(P + "hết dải chip rời + hết ô Số tem cột riêng, không kéo ngang, không ô nào tràn mép thẻ",
  !mb.daiCu && !mb.oTemCu && mb.keoNgang <= 0 && mb.tranO === 0,
  "dải cũ: " + mb.daiCu + " · cột tem cũ: " + mb.oTemCu + " · kéo ngang " + mb.keoNgang +
  "px · tràn [×|SKU|ô nhập] = " + mb.tran.join("|") + "px");
kiem(P + "nút × XOÁ SKU ở BÌA TRÁI, đứng TRƯỚC mã SKU, ĐỎ sẵn, vùng chạm ≥30px",
  mb.xBiaTrai >= 0 && mb.xBiaTrai <= 4 && mb.xTruocSku >= 0 && mb.xTruocSku <= 20 &&
  doThat && mb.caoDel >= 30,
  "cách bìa trái " + mb.xBiaTrai + "px · trước mã " + mb.xTruocSku + "px · màu " + mb.mauDel +
  " · " + mb.caoDel + "px");
/* Cùng-một-dòng chỉ BẮT BUỘC từ 390px (bề rộng máy trong ảnh user). Dưới mức đó — nhất là khi danh
   sách dài sinh thanh cuộn dọc ăn thêm ~15px — "Số tem:[n]" được phép tụt xuống dòng dưới trong ô
   SKU; điều luôn phải đúng là nó KHÔNG đè lên ô gõ số lượng. */
kiem(P + "\"Số tem: 6\" là Ô NHẬP, kẹp giữa mã SKU và ô gõ số lượng, KHÔNG đè lên ô đó",
  mb.tagLaO && mb.tagSo === "6" && mb.temGiua && !mb.temDeO && (W < 390 || mb.tagNgangSku),
  "là ô: " + mb.tagLaO + " · số " + mb.tagSo + " · cùng dòng với mã: " + mb.tagNgangSku +
  (W < 390 && !mb.tagNgangSku ? " (được phép — máy hẹp, van flex-wrap)" : "") +
  " · đúng chỗ: " + mb.temGiua + " · đè ô nhập: " + mb.temDeO);
kiem(P + "dải chip nằm DƯỚI tên sản phẩm, bám bìa trái thẻ",
  mb.chipDuoiTen && mb.chipTrai >= 0 && mb.chipTrai <= 6,
  "dưới tên: " + mb.chipDuoiTen + " · cách bìa trái " + mb.chipTrai + "px");
/* 22/08/2026 đêm user hạ chiều cao khung gõ số lượng + chip còn ~1/2 (ô 44→~24px, × 40→20px) —
   ngưỡng chạm 40px được user chủ động đánh đổi, bộ đo canh theo đặc tả MỚI. */
kiem(P + "ô nhập ≤45% thẻ, cao 22–32px; nút × chip ≥20px; chữ chip ≥10,5px",
  mb.rongO > 0 && mb.rongO <= 45 && mb.caoO >= 22 && mb.caoO <= 32 && mb.caoX >= 20 && mb.chuChip >= 10.5,
  "ô nhập rộng " + mb.rongO + "% thẻ · cao " + mb.caoO + "px · nút × " + mb.caoX + "px · chip " + mb.chuChip + "px");
if (LUU_ANH) await page.screenshot({ path: path.join(OUT, "popup-" + W + ".png") });
}
await page.setViewport({ width: 1360, height: 950 });
await cho(400);

/* ══════════ MÁY BÀN: Ô NHẬP ĐỨNG YÊN KHI CHIP DỒN THÊM (đặc tả user 23/08/2026) ══════════
   Lời hứa đo được: chốt thêm số lượng thì Ô NHẬP KHÔNG ĐƯỢC NHÍCH một pixel nào (ảnh user: 24 chip
   đẩy ô "+ số nữa" xuống hàng thứ năm), và chip MỚI NHẤT phải là chip ĐẦU TIÊN — tức nằm gần ô nhập
   nhất. Cả hai đều là toạ độ thật, không phải "trông có vẻ đúng". */
const doiCho = await page.evaluate(async () => {
  const o = () => document.querySelector('#prBody input.prsl-v[data-s="422423807"]');
  /* Đo TRONG DÒNG, không theo toạ độ màn: pop-up căn giữa dọc nên bảng cao thêm là cả hộp nhích lên
     — bẫy đã dính ở lượt đo đầu (báo "ô nhập nhích 18 lần" trong khi nó nằm y nguyên trong ô). */
  const vt = () => {
    const b = o().getBoundingClientRect(), tr = o().closest("tr").getBoundingClientRect();
    return Math.round(b.left - tr.left) + "," + Math.round(b.top - tr.top) + "," + Math.round(b.width);
  };
  const chipDau = () => {
    const tr = o().closest("tr"), c = tr.querySelector(".prchip");
    return c ? c.textContent.replace(/[×\s]/g, "") : "";
  };
  const chipGanNhat = () => {
    const tr = o().closest("tr"), ro = o().getBoundingClientRect();
    let gan = null, d = 1e9;
    tr.querySelectorAll(".prchip").forEach(function (c) {
      const b = c.getBoundingClientRect();
      const k = Math.hypot(b.left - ro.right, b.top - ro.top);
      if (k < d) { d = k; gan = c.textContent.replace(/[×\s]/g, ""); }
    });
    return gan;
  };
  PR.sel["422423807"].slHang = ""; prLuu(); prVe();
  await new Promise((r) => setTimeout(r, 150));
  const vt0 = vt(), ra = [];
  /* 24 số như ảnh user — số chip đủ nhiều để tràn sang nhiều hàng. */
  for (let i = 1; i <= 24; i++) {
    const el = o(); el.value = String(i); prHienCong(el); prCam(el);
    await new Promise((r) => setTimeout(r, 25));
    ra.push(vt());
  }
  /* Dải chip phải XUỐNG DÒNG khi đầy — nếu không, nó chạy thẳng ra ngoài và đẩy cả cột SKU/Tên/×
     rơi khỏi pop-up (bẫy đã dính 23/08: `.mtbl td` gốc đóng `white-space:nowrap`, lại thiếu chỗ
     ngắt dòng giữa hai chip nên cả dải là một khối liền). Đo bằng SỐ HÀNG chip + kéo ngang. */
  const tr = o().closest("tr"), body = document.querySelector("#prmodal .modalbody");
  const hang = new Set();
  tr.querySelectorAll(".prchip").forEach(function (c) { hang.add(Math.round(c.getBoundingClientRect().top)); });
  const cot = {};
  ["td.prslo", "td.prchipso", "td.prsku", "td.pn", "td.prxoa"].forEach(function (s) {
    const e = tr.querySelector(s);
    cot[s] = e ? Math.round(e.getBoundingClientRect().right) : -1;
  });
  return { vt0: vt0, nhich: ra.filter((x) => x !== vt0).length, cuoi: ra[ra.length - 1],
    soChip: tr.querySelectorAll(".prchip").length,
    soHangChip: hang.size, keoNgang: body.scrollWidth - body.clientWidth,
    xTrongMan: cot["td.prxoa"] > 0 && cot["td.prxoa"] <= Math.round(body.getBoundingClientRect().right) + 2,
    cot: cot,
    dau: chipDau(), gan: chipGanNhat(), tem: PR_TEM.temCuaDong(PR.sel["422423807"]) };
});
kiem("Máy bàn: chốt 24 số lượng → ô nhập KHÔNG NHÍCH một pixel (ảnh user 23/08: ô bị đẩy xuống hàng 5)",
  doiCho.nhich === 0 && doiCho.soChip === 24,
  doiCho.soChip + " chip · số lượt ô nhập đổi chỗ = " + doiCho.nhich + " (" + doiCho.vt0 + " → " + doiCho.cuoi + ")");
kiem("Máy bàn: chip MỚI NHẤT (24) đứng đầu dải và là chip GẦN ô nhập nhất",
  doiCho.dau === "24" && doiCho.gan === "24" && doiCho.tem === 24,
  "chip đầu = " + doiCho.dau + " · chip gần ô nhập nhất = " + doiCho.gan + " · số tem = " + doiCho.tem);
kiem("Máy bàn: 24 chip ĐẦY thì XUỐNG DÒNG (≥3 hàng), không kéo ngang, cột × vẫn trong pop-up",
  doiCho.soHangChip >= 3 && doiCho.keoNgang <= 0 && doiCho.xTrongMan,
  doiCho.soHangChip + " hàng chip · kéo ngang " + doiCho.keoNgang + "px · mép phải các cột: " +
  JSON.stringify(doiCho.cot));
if (LUU_ANH) await page.screenshot({ path: path.join(OUT, "popup-24chip.png") });
await page.evaluate(() => { PR.sel["422423807"].slHang = ""; PR.sel["422423807"].sl = 1; prLuu(); prVe(); });
await cho(300);

if (LUU_ANH) await page.screenshot({ path: path.join(OUT, "popup.png") });
kiem("Không có lỗi JS nào trên trang", loiTrang.length === 0, loiTrang.slice(0, 2).join(" | "));

await browser.close();
const dat = ket.filter((k) => k.ok).length;
console.log("\n" + (dat === ket.length ? "✓ " : "✗ ") + dat + "/" + ket.length + " ca đạt" +
  (LUU_ANH ? "  (ảnh ở " + OUT + ")" : ""));
process.exit(dat === ket.length ? 0 : 1);
