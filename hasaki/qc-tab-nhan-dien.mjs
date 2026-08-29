/**
 * qc-tab-nhan-dien.mjs — SMOKE TEST tab "Nhận diện SKU" TRONG TRÌNH DUYỆT THẬT (Edge headless).
 *  Kiểm những thứ mà 2 bộ test kia không chạm được: nạp danh mục qua gviz, vẽ badge từ khoá, vẽ thẻ
 *  kết quả, nút "Chọn SKU này" đổ đúng vào giỏ kiểm kê (PC.sel), bố cục điện thoại, và các đường
 *  NGOẠI LỆ (AI trả lỗi · mất mạng · ảnh không đọc được).
 *
 *  KHÔNG gọi Apps Script: chặn request tới script.google.com rồi tự trả JSON để mô phỏng từng ca —
 *  nhờ vậy test chạy được cả khi GAS chưa deploy và không đốt hạn mức AI.
 *
 *  node qc-tab-nhan-dien.mjs [--anh]      (--anh: lưu ảnh chụp màn hình vào .exports/qc-tab)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";
import { EDGE_PATH } from "./token-store.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const URL_TRANG = "file:///" + path.join(DIR, "..", "factory", "index.html").replace(/\\/g, "/");
const OUT = path.join(DIR, ".exports", "qc-tab");
const LUU_ANH = process.argv.includes("--anh");
if (LUU_ANH) fs.mkdirSync(OUT, { recursive: true });

/* Kết quả AI giả — đúng khuôn action sku_vision trả về (tem dây kéo YKK) */
const AI_OK = {
  status: "success", model: "gemini-3.5-flash(giả)", quality: "ro", ms: 1234, conLai: 399,
  tokens: { item_codes: ["8846295", "CMOR-36"], specs: ["38.0 CM"], colors: ["345"], brands: ["YKK"], others: ["100 PCS"] },
  text: "YKK | 8846295 | CMOR-36 | Chiều dài: 38.0 CM | Màu: 345",
};
const AI_LOI = { status: "error", message: "Hết hạn mức đọc tem hôm nay (400 ảnh) — gõ từ khoá tay giúp." };
/* Kết quả OCR giả — action sku_ocr chỉ trả CHỮ THÔ (không có vai nào), đúng như Drive OCR.
   Có kèm mấy dòng GIẤY TỜ để kiểm bước lọc mảnh theo danh mục. */
const OCR_OK = {
  status: "success", nguon: "drive-ocr", ms: 5300, msUp: 4200, msExport: 800, conLai: 1999,
  text: `YKK 8846295 CMOR-36
Chiều dài: 38.0 CM  Màu: 345
ADD: LOT 24, TAN THOI HIEP IP, DIST 12, HCMC
P/O NO: 4500219877  LOT: 25/08-114
NET WEIGHT: 12.5 KG  INSPECTOR: NG.T.H`,
};
/* OCR đọc được chữ nhưng KHÔNG mảnh nào là mã hàng có thật -> phải LEO THANG sang AI */
const OCR_KHONG_MA = {
  status: "success", nguon: "drive-ocr", ms: 5100,
  text: `SEWING THREAD 100% POLYESTER
MADE IN VIETNAM
NET WEIGHT 12.5 KG`,
};
const OCR_LOI = { status: "error", message: "OCR không thấy chữ nào trên ảnh — chụp gần hơn, đủ sáng, giữ tem phẳng." };
/* AI trả về CÓ kèm mấy dòng giấy tờ trong raw_text — để kiểm bước lọc mảnh theo danh mục trên chính
   đường AI (từ 19/08/2026 chiều, AI là người đọc đầu tiên nên bước lọc phải chạy ở đây). */
const AI_GIAY_TO = {
  status: "success", model: "gemini-3.5-flash(giả)", quality: "ro", ms: 1234, conLai: 399,
  tokens: { item_codes: ["8846295", "CMOR-36"], specs: ["38.0 CM"], colors: ["345"], brands: ["YKK"], others: ["100 PCS"] },
  text: `YKK 8846295 CMOR-36
Chiều dài: 38.0 CM  Màu: 345
ADD: LOT 24, TAN THOI HIEP IP, DIST 12, HCMC
P/O NO: 4500219877  LOT: 25/08-114
NET WEIGHT: 12.5 KG  INSPECTOR: NG.T.H`,
};
/* AI đọc được chữ nhưng KHÔNG mảnh nào là mã hàng có thật → bậc thang phải tụt xuống OCR */
const AI_KHONG_MA = {
  status: "success", model: "gemini-3.5-flash(giả)", quality: "mo", ms: 1100,
  tokens: { item_codes: [], specs: [], colors: [], brands: ["SEWING THREAD"], others: [] },
  text: "SEWING THREAD 100% POLYESTER\nMADE IN VIETNAM\nNET WEIGHT 12.5 KG",
};
let traLoiOcr = OCR_OK, soGoiOcr = 0, soGoiAi = 0;
/* treGas = số ms giữ phản hồi lại, để mô phỏng mạng chậm (ca "phản hồi của ảnh cũ về muộn") */
let treGas = 0, soGoiHam = 0, mimeAI = "", mimeOCR = "";
/* Trang HTML mà chặng 2 của Apps Script (script.googleusercontent.com/…/echo) thỉnh thoảng trả về
   thay cho JSON — chính là lỗi thật 19/08/2026 ("Unexpected token '<', \"<!DOCTYPE \"…"). */
const GAS_HTML = "<!DOCTYPE html><html><head><title>Error</title></head><body>Sorry, unable to open the file.</body></html>";
let traLoi = AI_OK, soGoiGas = 0, traHtml = 0;

const browser = await puppeteer.launch({ headless: true, executablePath: EDGE_PATH,
  args: ["--allow-file-access-from-files", "--disable-web-security"] });
const page = await browser.newPage();
await page.setViewport({ width: 1360, height: 950 });
const loiTrang = [];
page.on("pageerror", (e) => loiTrang.push(String(e.message).slice(0, 200)));
page.on("console", (m) => { if (m.type() === "error") loiTrang.push("console: " + m.text().slice(0, 160)); });

/* Chặn Apps Script: trả JSON mô phỏng, KHÔNG ra internet */
await page.setRequestInterception(true);
page.on("request", (req) => {
  const u = req.url();
  if (/script\.google\.com/.test(u)) {
    soGoiGas++;
    if (/action=lastSync/.test(u)) {                       // JSONP chip giờ dữ liệu
      const cb = (u.match(/callback=([^&]+)/) || [])[1] || "cb";
      return req.respond({ status: 200, contentType: "text/javascript",
        body: cb + "({status:'success',ts:" + Date.now() + "});" });
    }
    /* Trang mở bằng file:// nên Origin là "null": phản hồi giả PHẢI có Access-Control-Allow-Origin,
       không thì fetch() bị CORS chặn và ca test trông y như "AI không trả gì". */
    if (traHtml > 0) {                                     // mô phỏng chặng 2 trả HTML
      traHtml--;
      return req.respond({ status: 200, contentType: "text/html",
        headers: { "Access-Control-Allow-Origin": "*" }, body: GAS_HTML });
    }
    /* TÁCH THEO ACTION: bậc thang có 2 người đọc, phải đếm riêng mới kiểm được "OCR ra mã rồi thì
       KHÔNG gọi AI nữa" — đó chính là hợp đồng tiết kiệm hạn mức. */
    let act = "", than0 = {};
    try { than0 = JSON.parse(req.postData() || "{}") || {}; act = than0.action || ""; } catch (e) { act = ""; }
    /* Lượt HÂM NÓNG (chuanDoan, không kèm ảnh) KHÔNG phải một lượt đọc tem — đừng tính vào bộ đếm,
       không thì mọi ca "0 lượt OCR" đỏ oan. */
    const laHam = !!than0.chuanDoan && !than0.anh;
    if (laHam) soGoiHam++;
    else if (act === "sku_ocr") { soGoiOcr++; mimeOCR = String(than0.mime || ""); }
    else if (act === "sku_vision") { soGoiAi++; mimeAI = String(than0.mime || ""); }
    const than = act === "sku_ocr" ? traLoiOcr : traLoi;
    const traVe = () => req.respond({ status: 200, contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(than) }).catch(() => { /* lượt bị abort */ });
    if (treGas > 0) { setTimeout(traVe, treGas); return; }
    return traVe();
  }
  req.continue();
});

const ket = [];
/* Bấm trong trang (không dùng page.click): trang mở bằng file:// nên vài phần tử nằm ngoài vùng
   nhìn thấy của headless -> puppeteer báo "not clickable" dù người dùng thật bấm bình thường. */
const bam = (sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) throw new Error("không thấy " + s); e.click(); }, sel);
const kiem = (ten, ok, ghi) => { ket.push({ ten, ok, ghi }); console.log((ok ? "  ✓ " : "  ✗ ") + ten + (ghi ? "  — " + ghi : "")); };

/* KHÔNG gieo sẵn email nữa: từ 19/08/2026 tab không được phép HỎI email (xem ca "không hỏi email").
   Xoá luôn sổ tay tem để mấy ca dưới chạy trên máy sạch, không ăn ké ghi nhớ của lần chạy trước. */
let hopThoai = [];
page.on("dialog", async (d) => { hopThoai.push(d.type() + ": " + d.message().slice(0, 60)); await d.dismiss(); });
await page.goto(URL_TRANG, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.evaluate(() => { try { localStorage.removeItem("nds-master-v1"); localStorage.removeItem("nds-mail"); localStorage.removeItem("nds-so-v1"); } catch (e) {} });

/* ---------- 1. Tab xuất hiện + mở được ---------- */
const coTab = await page.$("#ttSku");
kiem("Nút tab \"Nhận diện SKU\" có trên thanh tab", !!coTab);
await bam("#ttSku");
const hienView = await page.evaluate(() => !document.getElementById("viewNds").hidden &&
  document.getElementById("viewPlg").hidden && document.getElementById("viewStock").hidden);
kiem("Mở tab thì chỉ view Nhận diện SKU hiện, các view khác ẩn", hienView);

/* ---------- 1b. BỐ CỤC: Ảnh → SKU gợi ý → Từ khoá (thứ tự chốt 19/08/2026) ---------- */
const thuTu = await page.$$eval("#viewNds section.panel h2", (a) => a.map((h) => h.firstChild.textContent.trim()));
kiem("Thứ tự các bước: 1 Ảnh tem → 2 SKU gợi ý → 3 Từ khoá",
  thuTu.length === 3 && /^1 · Ảnh tem/.test(thuTu[0]) && /^2 · SKU gợi ý/.test(thuTu[1]) && /^3 · Từ khoá/.test(thuTu[2]),
  thuTu.join(" | "));
const coSub = await page.$$eval("#viewNds > p.sub", (a) => a.length);
kiem("Đã bỏ đoạn mô tả dài đầu tab", coSub === 0, coSub + " đoạn");

/* ---------- 2. Nạp danh mục SKU_MASTER qua gviz (mạng thật, đúng đường dashboard đi) ---------- */
const nap = await page.waitForFunction(() => window.NDS && NDS.ds && NDS.ds.length > 0, { timeout: 45000 })
  .then(() => true).catch(() => false);
const soSku = await page.evaluate(() => (window.NDS && NDS.ds) ? NDS.ds.length : 0);
kiem("Nạp tab SKU_MASTER qua gviz", nap && soSku > 1000, soSku + " SKU");
/* ĐỔI 20/08/2026 (yêu cầu user): dòng chân KHÔNG còn dòng thông báo nào ("Danh mục 5.625 SKU kho
   nguyên liệu … · đối soát 7ms · Sổ tay tem: N ghi nhớ …"), chỉ còn NÚT làm được việc. Số liệu vẫn
   nằm trong NDS.ds nên vẫn kiểm được bằng state. */
const chan = await page.evaluate(() => {
  const e = document.getElementById("ndsFoot");
  return { chu: (e.textContent || "").replace(/⟳|Tải lại danh mục|Xoá sổ tay/g, "").trim(),
    nut: Array.prototype.map.call(e.querySelectorAll("button"), (b) => b.textContent.trim()) };
});
kiem("Dòng chân chỉ còn nút, không còn dòng thông báo nào",
  chan.chu === "" && chan.nut.length >= 1 && /Tải lại danh mục/.test(chan.nut[0]),
  "chữ còn lại: \"" + chan.chu + "\" · nút: " + chan.nut.join(" · "));

/* ---------- 3. Ảnh + gọi AI (giả) → badge từ khoá → thẻ kết quả ---------- */
/* Dựng ảnh JPEG THẬT bằng canvas rồi nạp vào tab (không dùng base64 gõ tay: JPEG sai 1 byte là
   trình duyệt trả ERR_INVALID_URL và ca test trông y như "AI không đọc được"). Đường ảnh chụp thật
   đã được kiểm ở qc-tem-vision.mjs. */
await page.evaluate(() => {
  var c = document.createElement("canvas"); c.width = 640; c.height = 420;
  var x = c.getContext("2d");
  x.fillStyle = "#fff"; x.fillRect(0, 0, 640, 420);
  x.fillStyle = "#111"; x.font = "bold 30px Arial"; x.fillText("YKK 8846295", 40, 90);
  x.font = "22px Arial"; x.fillText("38.0 CM  ·  345", 40, 150);
  ndsDatAnh(c.toDataURL("image/jpeg", 0.9));
});
/* ---------- 2b. SOÁT MỐC GHI TAB: danh mục trên Sheet đổi thì tự nạp lại (20/08/2026) ----------
   Sự cố: kho MẪU nhặt về 11:16, thủ kho quét 13:18 vẫn thấy "Chưa khớp được MÃ HÀNG nào" vì cache
   TTL 12 giờ (nay hạ còn 2 giờ). Bắt người dùng nhớ bấm "Tải lại danh mục" là không được — họ không
   có cách nào biết danh mục vừa đổi. */
const socMoc = await page.evaluate(async () => {
  const ra = {};
  /* (a) Mốc CŨ HƠN bản đang giữ -> KHÔNG được tải lại */
  NDS.cacheAt = Date.now();
  NDS.dangSoatMoc = false; NDS.nguon = 'đánh dấu-a';
  ndsSoatMocDanhMuc();
  await new Promise((r) => setTimeout(r, 900));
  ra.giuNguyen = NDS.nguon === 'đánh dấu-a';
  /* (b) Mốc MỚI HƠN (mock lastSync trả Date.now(), đặt cache thành 6 giờ trước) -> phải tải lại */
  NDS.cacheAt = Date.now() - 6 * 3600 * 1000;
  NDS.dangSoatMoc = false; NDS.nguon = 'đánh dấu-b';
  ndsSoatMocDanhMuc();
  for (let i = 0; i < 60 && NDS.nguon === 'đánh dấu-b'; i++) await new Promise((r) => setTimeout(r, 250));
  ra.daTaiLai = /vừa tải/.test(NDS.nguon);
  ra.nguon = NDS.nguon;
  ra.ttlGio = Math.round(NDS_CACHE_TTL / 3600000);
  return ra;
});
kiem("Mốc ghi tab MỚI HƠN cache → tự nạp lại danh mục; mốc cũ hơn thì giữ nguyên (TTL chỉ là lưới cuối)",
  socMoc.giuNguyen && socMoc.daTaiLai && socMoc.ttlGio <= 2,
  "giữ nguyên khi mốc cũ: " + socMoc.giuNguyen + " · tải lại khi mốc mới: " + socMoc.daTaiLai +
  " (nguồn: " + socMoc.nguon + ") · TTL " + socMoc.ttlGio + "h");

/* "Ý BẠN LÀ…" (20/08/2026): tem in "Col C3185" mà OCR đọc lệch một số ("C3186") thì lõi KHÔNG tự
   đổi (danh mục có cả c3185 và c3184 — đoán bừa là chọn sai hàng), nhưng phải MỜI CHỌN mã có thật
   gần nhất, bấm một cái là tra ngay. */
const moiChon = await page.evaluate(() => {
  const cu = NDS.tokens.slice();
  NDS.tokens = [{ t: "c3186", vai: "code", nguon: "ocr" }];
  const html = ndsMoiChonMa();
  NDS.tokens = cu;
  const d = document.createElement("div"); d.innerHTML = html;
  const nut = Array.prototype.map.call(d.querySelectorAll("button"), (b) => b.textContent.trim().split(" ")[0]);
  /* onclick dùng thực thể HTML `&#39;` cho dấu nháy — kiểm bằng cách đọc thẳng attribute đã giải mã,
     đừng khớp regex trên chuỗi thô (đã cắn: đổi cách escape là ca test đỏ oan). */
  const oc = Array.prototype.map.call(d.querySelectorAll("button"), (b) => b.getAttribute("onclick") || "");
  return { co: /Ý bạn là/.test(html), nut, bam: oc.some((x) => x === "ndsDungMa('c3185')") };
});
kiem("Mã đọc lệch mà không tự đổi được → mời chọn mã CÓ THẬT gần nhất (\"Ý bạn là…\")",
  moiChon.co && moiChon.nut.indexOf("c3185") >= 0 && moiChon.bam,
  "nút: " + moiChon.nut.join(" · ") + " · gọi đúng ndsDungMa: " + moiChon.bam);

/* ---------- 3a0. Ô "PHẦN TỬ TRÊN TEM" ĐỨNG TRÊN KHUNG CAMERA (chuyển 20/08/2026) ----------
   Yêu cầu user: mở tab là thấy ô nhập trước, khung hình sau. Kiểm bằng TOẠ ĐỘ THẬT (không kiểm thứ
   tự trong DOM) vì `.nds-grid` có thể xếp lại bằng CSS; kèm kiểm khoảng thở giữa hai khối không phình
   ra (margin cộng dồn là thứ đã cắn ở tab Planogram). */
const oTrenKhung = await page.evaluate(() => {
  const o = document.querySelector("#viewNds .nds-marow"), st = document.getElementById("ndsStage");
  const h2 = document.querySelector("#viewNds section.panel h2");
  if (!o || !st) return null;
  const a = o.getBoundingClientRect(), b = st.getBoundingClientRect(), c = h2.getBoundingClientRect();
  return { tren: a.bottom <= b.top + 1, duoiTieuDe: a.top >= c.bottom - 1,
    khe: Math.round(b.top - a.bottom), coNut: !!o.querySelector(".nds-go"),
    nhan: (o.querySelector("label") || {}).textContent || "" };
});
kiem("Ô \"Phần tử trên tem\" + nút Tra nằm NGAY TRÊN khung camera (ngay dưới tiêu đề bước 1)",
  !!oTrenKhung && oTrenKhung.tren && oTrenKhung.duoiTieuDe && oTrenKhung.coNut &&
  oTrenKhung.khe >= 0 && oTrenKhung.khe <= 18,
  oTrenKhung ? ("nhãn \"" + oTrenKhung.nhan.trim() + "\" · khe tới khung " + oTrenKhung.khe + "px") : "(không thấy ô nhập)");

/* ---------- 3a. THANH ĐIỀU KHIỂN KHUNG NẰM TRONG KHUNG (chốt 19/08/2026) ----------
   Nút thao tác với chính khung hình (bật/tắt camera · chụp · chọn ảnh · xoay) phải nằm TRÊN khung
   như app camera, không rải ra ngoài. Nút hành động với KẾT QUẢ (quét mã vạch · đọc lại bằng AI)
   thì vẫn ở dưới khung. */
const trongKhung = await page.evaluate(() => {
  const st = document.getElementById("ndsStage").getBoundingClientRect();
  const tools = document.querySelector(".nds-stage .nds-tools");
  const ten = tools ? Array.prototype.map.call(tools.querySelectorAll(".ndsib"), (b) => b.textContent.trim()) : [];
  const r = tools ? tools.getBoundingClientRect() : null;
  /* BÓ HẸP VÀO #viewNds: từ 19/08/2026 tab "Chuyển đổi cân" cũng dùng lại .nds-ctl (đúng luật
     tái dùng control của dự án), quét toàn trang là bắt luôn "Lô tiếp theo · Xoá hết" của tab đó. */
  const ngoai = Array.prototype.map.call(document.querySelectorAll("#viewNds .nds-ctl .kktab"), (b) => b.textContent.trim());
  const ctl = document.querySelector("#viewNds .nds-ctl");
  return { ten, ngoai,
    ctlAn: !!ctl && getComputedStyle(ctl).display === "none",
    lot: !!r && r.top >= st.top - 1 && r.bottom <= st.bottom + 1 && r.left >= st.left - 1 && r.right <= st.right + 1 };
});
kiem("Bật camera · Chọn ảnh · ⟲ · ⟳ nằm TRONG khung (Chụp đã dời ra thanh nổi)",
  trongKhung.ten.length === 4 && /Bật camera/.test(trongKhung.ten[0]) && trongKhung.lot &&
  !trongKhung.ten.some((t) => /^Chụp$/.test(t)),
  trongKhung.ten.join(" · "));
/* 20/08/2026 (yêu cầu user): nút CHỤP nổi ở đáy màn hình, đúng chỗ thanh "Đã chọn N SKU", màu CAM,
   và chỉ hiện khi camera đang bật. Không gọi ndsCam() được trong headless (không có camera) nên
   kiểm qua ndsHienChup — chính hàm mà ndsCam/ndsTatCam dùng. */
const barChup = await page.evaluate(() => {
  const b = document.getElementById("ndsChupbar"), nut = document.getElementById("ndsBtnChup");
  const ngoaiView = !!b && !document.getElementById("viewNds").contains(b);   // fixed phải nằm ngoài .vfade
  ndsHienChup(true);
  const st = getComputedStyle(nut), r = nut.getBoundingClientRect();
  const ra = { ngoaiView, hienKhiBat: !b.classList.contains("hidden"), nen: st.backgroundColor, chu: st.color,
    cao: Math.round(r.height), duoiCung: Math.round(innerHeight - r.bottom), coBodyClass: document.body.classList.contains("nds-chup"),
    viTri: getComputedStyle(b).position };
  ndsTatCam();
  ra.anKhiTat = b.classList.contains("hidden") && !document.body.classList.contains("nds-chup");
  return ra;
});
/* 20/08/2026 (yêu cầu user): toast ("OCR đọc được N từ khoá…") phải nằm ở ĐẦU màn hình. Trước đây
   nó neo bottom:28px — đúng chỗ nút Chụp vừa dời xuống, nên mỗi lần đọc xong tem là toast che nút
   trong 6 giây, đúng lúc thủ kho muốn chụp lại. */
const viToast = await page.evaluate(async () => {
  ndsHienChup(true);
  toast("OCR đọc được 7 từ khoá.", "ok");
  await new Promise((r) => setTimeout(r, 320));
  const t = document.getElementById("toast").getBoundingClientRect();
  const c = document.getElementById("ndsBtnChup").getBoundingClientRect();
  const ra = { tren: Math.round(t.top), nuaTren: t.bottom < innerHeight / 2, cheNut: !(t.bottom < c.top || c.bottom < t.top),
    hien: getComputedStyle(document.getElementById("toast")).opacity };
  ndsTatCam();
  return ra;
});
kiem("Toast nằm ĐẦU màn hình, không che nút Chụp",
  viToast.tren >= 0 && viToast.tren <= 40 && viToast.nuaTren && !viToast.cheNut && Number(viToast.hien) > .9,
  "top " + viToast.tren + "px · nửa trên: " + viToast.nuaTren + " · che nút Chụp: " + viToast.cheNut);
kiem("Nút CHỤP nổi ở đáy màn hình, màu cam, hiện/ẩn theo camera",
  barChup.ngoaiView && barChup.viTri === "fixed" && barChup.hienKhiBat && barChup.anKhiTat &&
  barChup.nen === "rgb(245, 124, 0)" && barChup.chu === "rgb(255, 255, 255)" &&
  barChup.cao >= 44 && barChup.duoiCung <= 160,
  "nền " + barChup.nen + " · cao " + barChup.cao + "px · cách đáy " + barChup.duoiCung + "px · ẩn khi tắt: " + barChup.anKhiTat);
/* Bẫy đã cắn 2 lần: khai `display` bằng class làm thuộc tính `hidden` mất tác dụng. Ca này quét
   MỌI phần tử đang mang `hidden` trong tab — thêm phần tử mới mà quên là bị bắt ngay. */
const anHet = await page.evaluate(() => Array.prototype.filter.call(
  document.querySelectorAll("#viewNds [hidden]"), (e) => getComputedStyle(e).display !== "none")
  .map((e) => e.id || e.className));
kiem("Mọi phần tử [hidden] trong tab đều THẬT SỰ bị ẩn (không bị class display đè)",
  anHet.length === 0, anHet.join(", ") || "sạch");
/* 3 nút mã vạch · OCR · AI: từ 22/08/2026 BỎ HIỂN THỊ (user — chụp/chọn ảnh là 3 người đọc tự chạy
   song song, nút chỉ là đường chạy lại thủ công không ai bấm). NODE PHẢI CÒN trong DOM: JS khoá/mở
   disabled bám thẳng getElementById 3 id này (có chỗ không guard null), giấu bằng display:none. */
kiem("3 nút đọc (mã vạch · OCR · AI) đã BỎ HIỂN THỊ nhưng node còn đó cho nhịp đọc tự động",
  trongKhung.ctlAn &&
  trongKhung.ngoai.length === 3 && /mã vạch/i.test(trongKhung.ngoai[0]) && /OCR/i.test(trongKhung.ngoai[1]) && /AI/i.test(trongKhung.ngoai[2]),
  (trongKhung.ctlAn ? "ẩn" : "ĐANG HIỆN") + " · " + trongKhung.ngoai.join(" · "));

/* ---------- 3b. KHUNG XEM TRƯỚC: đúng MỘT lớp hiện, không chia đôi ----------
   Bẫy đã cắn 19/08/2026: `.nds-stage{display:flex}` + `.nds-stage video,img{display:block}` đè lên
   `[hidden]{display:none}` của trình duyệt ⇒ hidden mất tác dụng ⇒ <video> rỗng và <img> thành 2
   flex-item width:100% nằm cạnh nhau, mỗi cái nửa khung. Ca này khoá cả 3 mặt: hidden có ăn không,
   chỉ 1 lớp hiện, và ảnh có phủ TRỌN khung không. */
const khung = await page.evaluate(() => {
  const st = document.getElementById("ndsStage").getBoundingClientRect();
  const hien = (id) => { const e = document.getElementById(id); const r = e.getBoundingClientRect();
    return { id, an: e.hidden, css: getComputedStyle(e).display, w: Math.round(r.width), h: Math.round(r.height) }; };
  return { st: { w: Math.round(st.width), h: Math.round(st.height) },
    lop: ["ndsVideo", "ndsShot", "ndsEmpty", "ndsAim", "ndsHint"].map(hien) };
});
const dangHien = khung.lop.filter((l) => l.css !== "none");
kiem("Khung xem trước: thuộc tính hidden CÓ tác dụng (chỉ 1 lớp được vẽ)",
  dangHien.length === 1 && dangHien[0].id === "ndsShot",
  khung.lop.map((l) => l.id + (l.an ? "[hidden]" : "") + "=" + l.css).join(" · "));
/* Sai 2px là do VIỀN 1px mỗi bên của .nds-stage (con `inset:0` nằm trong hộp padding) — bình
   thường. Cái cần bắt là ảnh chỉ chiếm NỬA khung, nên cho sai số 4px. */
kiem("Ảnh phủ TRỌN khung, không bị bóp còn nửa bên",
  !!dangHien[0] && Math.abs(dangHien[0].w - khung.st.w) <= 4 && Math.abs(dangHien[0].h - khung.st.h) <= 4,
  "khung " + khung.st.w + "×" + khung.st.h + " · ảnh " + (dangHien[0] || {}).w + "×" + (dangHien[0] || {}).h);

const moKhoa = await page.$eval("#ndsBtnDoc", (e) => !e.disabled);
const moKhoaOcr = await page.$eval("#ndsBtnOcr", (e) => !e.disabled);
kiem("Có ảnh thì mở khoá CẢ HAI nút đọc lại (OCR + AI)", moKhoa && moKhoaOcr, "OCR=" + moKhoaOcr + " · AI=" + moKhoa);
/* TỰ ĐỘNG (19/08/2026): đặt ảnh xong là phải tự chạy hết bậc thang mã vạch → sổ tay → AI, KHÔNG
   cần bấm nút nào. Ca này cố ý KHÔNG bấm gì — có badge từ khoá tức là nó đã tự chạy. */
const tuChay = await page.waitForFunction(() => document.querySelectorAll("#ndsTags .nds-tag").length > 0, { timeout: 30000 })
  .then(() => true).catch(() => false);
kiem("Chụp/chọn ảnh là TỰ nhận diện ngay, không phải bấm thêm nút", tuChay,
  tuChay ? "tự chạy xong" : "vẫn đứng im — phải bấm nút mới chạy");
const soTag = await page.$$eval("#ndsTags .nds-tag", (a) => a.length);
kiem("Từ khoá AI hiện thành badge có nút bỏ", soTag >= 4, soTag + " badge");
const vaiTag = await page.$$eval("#ndsTags .nds-tag", (a) => a.map((x) => (x.className.match(/vai-(\w+)/) || [])[1]));
kiem("Badge tô màu theo VAI (mã/thông số/màu/loại)", new Set(vaiTag).size >= 3, vaiTag.join(","));

await page.waitForFunction(() => document.querySelectorAll("#ndsCards .nds-card").length > 0, { timeout: 20000 }).catch(() => {});
const the = await page.$$eval("#ndsCards .nds-card", (a) => a.map((c) => ({
  sku: (c.querySelector(".nds-sku") || {}).textContent,
  pct: (c.querySelector(".nds-pct") || {}).textContent,
  rong: (c.querySelector(".nds-fill") || {}).style ? c.querySelector(".nds-fill").style.width : "",
  toTrung: c.querySelectorAll(".nds-pn .highlight-match").length,
  loai: (c.querySelector(".badge") || {}).textContent,
  ton: (c.querySelector(".pg-chip") || {}).textContent,
  badges: Array.prototype.map.call(c.querySelectorAll(".nds-chead .badge"), (b) => b.textContent.trim()),
  chips: Array.prototype.map.call(c.querySelectorAll(".nds-meta .pg-chip"), (b) => b.textContent.trim()),
})));
kiem("Vẽ Top 3 thẻ gợi ý", the.length === 3, the.map((t) => t.sku + " " + t.pct).join(" · "));
kiem("Thẻ #1 là SKU đúng của tem YKK 38cm màu 345", the[0] && the[0].sku === "422322192", the[0] && the[0].sku);
kiem("Thanh % có bề rộng theo điểm", !!(the[0] && /%$/.test(the[0].rong)), the[0] && the[0].rong);
kiem("Tên sản phẩm có tô đậm phần trùng khớp", !!(the[0] && the[0].toTrung >= 2), the[0] && the[0].toTrung + " đoạn .highlight-match");
/* 20/08/2026: đoạn tô phải là `<span class="highlight-match">` VỚI ĐÚNG bộ màu đã chốt — không thì
   đổi tên class ở một chỗ mà quên CSS là mất tô, im lặng (không lỗi JS, không ca test nào đỏ). */
const toMau = await page.evaluate(() => {
  const e = document.querySelector("#ndsCards .nds-pn .highlight-match");
  if (!e) return null;
  const st = getComputedStyle(e);
  return { the: e.tagName, bg: st.backgroundColor, chu: st.color, day: st.fontWeight, bo: st.borderRadius };
});
kiem("Đoạn tô là <span class='highlight-match'> với đúng bộ màu (#ffe0b2 / #e65100, in đậm)",
  !!toMau && toMau.the === "SPAN" && toMau.bg === "rgb(255, 224, 178)" && toMau.chu === "rgb(230, 81, 0)" &&
  Number(toMau.day) >= 700,
  toMau ? toMau.the + " · nền " + toMau.bg + " · chữ " + toMau.chu + " · đậm " + toMau.day : "(không thấy đoạn tô nào)");
if (LUU_ANH) {
  await page.evaluate(() => { var t=document.getElementById("toast"); t.classList.remove("show"); window.scrollTo(0,0); });
  await page.screenshot({ path: path.join(OUT, "nds-desktop.png") });
  await page.evaluate(() => document.getElementById("viewNds").scrollIntoView({ block: "end" }));
  await page.screenshot({ path: path.join(OUT, "nds-desktop-ketqua.png") });
}
/* Trạng thái SKU (ACTIVE/INACTIVE): hiển thị rõ ràng bên cạnh Type (Normal/Combo). */
kiem("Thẻ hiển thị rõ trạng thái ACTIVE/INACTIVE",
  the.length > 0 && the.every((t) => t.badges.some((b) => /^(ACTIVE|INACTIVE)$/.test(b))),
  the.map((t) => "[" + t.badges.join("+") + "]").join(" · "));
/* 19/08/2026: TỒN lên NGAY CẠNH SKU (cùng hàng đầu), và dòng phụ CHỈ còn khi có điều đáng nói
   (từ sổ tay · tem in đúng mã · lệch thông số) ⇒ thẻ thường bớt một dòng. */
const tonCanhSku = await page.$$eval("#ndsCards .nds-card .nds-chead", (a) => a.map((h) => ({
  co: !!h.querySelector(".nds-ton"),
  chu: (h.querySelector(".nds-ton") || {}).textContent || "",
  sauSku: h.querySelector(".nds-sku") && h.querySelector(".nds-sku").nextElementSibling === h.querySelector(".nds-ton"),
  cungHang: (() => { const s = h.querySelector(".nds-sku"), t = h.querySelector(".nds-ton");
    return !!s && !!t && Math.abs(s.getBoundingClientRect().top - t.getBoundingClientRect().top) < 6; })(),
})));
kiem("Tồn + đơn vị nằm NGAY CẠNH mã SKU trên cùng một hàng (thẻ gọn hơn 1 dòng)",
  tonCanhSku.length === the.length && tonCanhSku.every((x) => x.co && x.sauSku && x.cungHang && /^Tồn\s[\d.,]+\s\S/.test(x.chu)),
  (tonCanhSku[0] || {}).chu + " · liền sau SKU: " + (tonCanhSku[0] || {}).sauSku + " · cùng hàng: " + (tonCanhSku[0] || {}).cungHang);
/* 19/08/2026 (lần 2): ghi chú "tem in đúng mã này / từ sổ tay / lệch …" cũng lên HÀNG ĐẦU cùng
   SKU + tồn ⇒ thẻ KHÔNG còn dòng phụ nào. Hàng đầu là toàn bộ phần đọc nhanh. */
const ghiChu = await page.$$eval("#ndsCards .nds-card", (a) => a.map((c) => {
  const h = c.querySelector(".nds-chead"), g = h.querySelector(".nds-ok, .nds-lech");
  const sku = h.querySelector(".nds-sku");
  return { chu: g ? g.textContent.trim() : "",
    cungHang: !g || Math.abs(g.getBoundingClientRect().top - sku.getBoundingClientRect().top) < 6 };
}));
const conSub = await page.$$eval("#ndsCards .nds-sub", (a) => a.length);
kiem("Ghi chú (tem in đúng mã / lệch …) nằm CÙNG HÀNG với SKU, thẻ không còn dòng phụ nào",
  conSub === 0 && ghiChu.every((x) => x.cungHang) && the.every((t) => t.chips.length === 0),
  ghiChu.map((x) => x.chu || "—").join(" | ").slice(0, 70) + " · số dòng phụ còn lại: " + conSub);
/* 20/08/2026 — sự cố C2080: đại diện nhóm có thể là bản ĐƠN VỊ NHỎ có TỒN 0 (bản cuộn mới là bản
   có tồn). Thẻ vẫn in huy hiệu INACTIVE nên phải nói ngay vì sao nó đứng đầu, không thì thủ kho thấy
   "tồn 0" rồi bỏ qua đúng cái SKU cần đếm. Kiểm bằng cách gọi THẲNG hàm vẽ thẻ với một dòng dựng tay
   (không phụ thuộc danh mục live đã có bản /mm chưa). */
const theDvNho = await page.evaluate(() => {
  const html = ndsTheKetQua({ sku: "422304419", pn: "Chỉ may/COATS Phong Phú, C2080/Polyester /None/Lavender/None/Text 27 - 60-3- Tkt 120/mm",
    type: "NORMAL", status: "INACTIVE", qty: 0, donVi: "mm", dv: "mm", q: 0.001, pct: 98, diem: 0.98, khop: {}, xungDot: [],
    dvNhoThay: true, song: true, bienThe: [{ sku: "422266550", donVi: "Cuộn 5000m", status: "ACTIVE", qty: 32, q: 100 }] }, 1);
  const d = document.createElement("div"); d.innerHTML = html;
  const g = d.querySelector(".nds-chead .nds-ok");
  return { chu: g ? g.textContent.trim() : "", badge: Array.prototype.map.call(d.querySelectorAll(".nds-chead .badge"), (b) => b.textContent.trim()) };
});
kiem("Đại diện là bản đơn vị nhỏ TỒN 0 → thẻ nói rõ 'đếm theo mm · tồn ở bản Cuộn 5000m'",
  /đếm theo mm/.test(theDvNho.chu) && /Cuộn 5000m/.test(theDvNho.chu) && theDvNho.badge.indexOf("INACTIVE") >= 0,
  theDvNho.chu + " · huy hiệu: " + theDvNho.badge.join(","));
/* 21/08/2026 (yêu cầu user): badge đầu thẻ = LOẠI SKU (Normal/Combo) thay cho số hạng 1·2·3;
   badge COMBO riêng phía sau bỏ vì trùng tin. */
const theLoai = await page.evaluate(() => {
  const ve = (type) => {
    const html = ndsTheKetQua({ sku: "1", pn: "x/y/mm", type, status: "ACTIVE", qty: 1, donVi: "mm", dv: "mm",
      q: 0.001, pct: 50, diem: 0.5, khop: {}, xungDot: [], bienThe: [] }, 1);
    const d = document.createElement("div"); d.innerHTML = html;
    return { rank: (d.querySelector(".nds-rank") || {}).textContent || "",
      bProc: !!d.querySelector(".badge.b-proc") };
  };
  return { n: ve("NORMAL"), c: ve("COMBO") };
});
kiem("Badge đầu thẻ = LOẠI SKU (Normal/Combo) thay số hạng, không còn badge COMBO trùng",
  theLoai.n.rank === "Normal" && theLoai.c.rank === "Combo" && !theLoai.n.bProc && !theLoai.c.bProc,
  "NORMAL→\"" + theLoai.n.rank + "\" · COMBO→\"" + theLoai.c.rank + "\"");
const viSao = await page.$$eval("#ndsCards .nds-card details.nds-more", (a) => a.map((d) => ({ mo: d.open, tt: d.querySelector("summary").textContent.trim() })));
kiem("Biến thể + từ khoá khớp gộp chung MỘT <details>, mặc định đóng",
  viSao.length > 0 && viSao.every((d) => !d.mo && /từ khoá khớp|đơn vị khác/.test(d.tt)), (viSao[0] || {}).tt || "(không có)");
const songSong = await page.evaluate(() => {
  const g = document.querySelector(".nds-grid");
  const n = getComputedStyle(g).gridTemplateColumns.split(" ").length;
  const a = document.querySelectorAll("#viewNds section.panel")[0].getBoundingClientRect();
  const b = document.querySelectorAll("#viewNds section.panel")[1].getBoundingClientRect();
  return { cot: n, cungHang: Math.abs(a.top - b.top) < 30 && b.left > a.left };
});
kiem("Máy rộng: SKU gợi ý nằm SONG SONG với ảnh tem (không phải cuộn xuống)",
  songSong.cot === 2 && songSong.cungHang, songSong.cot + " cột · cùng hàng: " + songSong.cungHang);

/* ---------- 4. Bỏ từ khoá đọc nhầm -> kết quả đổi ngay ---------- */
const truoc = await page.$eval("#ndsCards .nds-card .nds-pct", (e) => e.textContent);
await page.evaluate(() => {
  var i = NDS.tokens.findIndex(function (k) { return k.t === "38cm"; });
  ndsBoToken(i >= 0 ? i : 0);
});
await new Promise((r) => setTimeout(r, 400));
const sau = await page.$eval("#ndsCards .nds-card .nds-pct", (e) => e.textContent).catch(() => "");
kiem("Bỏ từ khoá (38cm) thì đối soát lại ngay", truoc !== sau, truoc + " → " + sau);

/* ---------- 5. Thêm từ khoá bằng tay ---------- */
await page.type("#ndsAdd", "38.0 CM");
await page.keyboard.press("Enter");
await new Promise((r) => setTimeout(r, 400));
const lai = await page.$eval("#ndsCards .nds-card .nds-sku", (e) => e.textContent).catch(() => "");
kiem("Gõ tay \"38.0 CM\" thì SKU đúng trở lại #1", lai === "422322192", lai);

/* ---------- 6. Bấm thẻ = XÁC NHẬN SKU (copy mã + ghi sổ tay), KHÔNG vào giỏ kiểm kê ----------
   Đổi 20/08/2026: đường "tick chọn SKU -> tạo lệnh kiểm kê" chỉ còn ở 2 tab Kiểm kê / Tồn kho bất
   thường (PC_TAB trong index.html). Mấy ca dưới khoá cả hai nửa của hợp đồng mới: tab này KHÔNG
   được ghi vào giỏ, và thanh giỏ KHÔNG được hiện ở đây. */
await page.evaluate(() => { PC.sel = {}; pcSyncBar(); });
/* 2 nút "Chọn SKU này"/"Copy mã" đã BỎ (3 thẻ = 6 nút, lấn hết chỗ của thông tin cần đọc).
   Nay bấm CẢ THẺ là chọn — ca này khoá luôn cái hợp đồng đó. */
const nutCu = await page.$$eval("#ndsCards .nds-card .nds-go, #ndsCards .nds-card .nds-cact", (a) => a.length);
kiem("Đã bỏ 2 nút \"Chọn SKU này\" / \"Copy mã\" trên thẻ", nutCu === 0, nutCu + " nút còn sót");
const laNut = await page.$eval("#ndsCards .nds-card", (e) => e.getAttribute("role") + "/" + e.getAttribute("tabindex"));
kiem("Cả thẻ là nút chọn (bấm được + tới được bằng bàn phím)", laNut === "button/0", laNut);
const soTruocThe = await page.evaluate(() => ndsSoDem());
await bam("#ndsCards .nds-card");
const gio = await page.evaluate(() => ({
  n: pcCount(), barHien: !document.getElementById("pcbar").classList.contains("hidden"),
  hoc: ndsSoDem(), soTay: ndsSoTra(),
}));
kiem("Bấm thẻ KHÔNG đổ SKU vào giỏ kiểm kê nữa", gio.n === 0, gio.n + " SKU trong giỏ");
kiem("Thanh giỏ nổi KHÔNG hiện ở tab Nhận diện SKU", gio.barHien === false, gio.barHien ? "vẫn hiện" : "đã ẩn");
kiem("Bấm thẻ KHÔNG ghi nhớ gì nữa (sổ tay đã tắt 21/08/2026 — chống chạm nhầm ghim SKU sai)",
  gio.hoc === 0 && gio.soTay.length === 0,
  "sổ tay " + soTruocThe + " → " + gio.hoc + " ghi nhớ · tra được: " + (gio.soTay.join(",") || "(rỗng)"));
/* Giỏ vẫn phải sống ở 2 tab được phép — nhồi 1 dòng rồi đổi tab để xem thanh giỏ hiện/ẩn đúng chỗ */
const barTheoTab = await page.evaluate(() => {
  PC.sel = { "WH|1": { wh: "WH", sku: "1", pn: "x", t: 0, src: "test" } }; pcSyncBar();
  const doc = () => !document.getElementById("pcbar").classList.contains("hidden");
  const ra = {};
  ["sku", "stock", "plg", "cd", "home", "kk", "abn"].forEach((t) => { showTab(t); ra[t] = doc(); });
  showTab("sku"); PC.sel = {}; pcSyncBar();
  return ra;
});
kiem("Thanh giỏ CHỈ hiện ở tab Kiểm kê + Tồn kho bất thường",
  barTheoTab.kk === true && barTheoTab.abn === true &&
  !barTheoTab.sku && !barTheoTab.stock && !barTheoTab.plg && !barTheoTab.cd && !barTheoTab.home,
  Object.keys(barTheoTab).map((k) => k + "=" + (barTheoTab[k] ? "hiện" : "ẩn")).join(" · "));
/* Khoá cả đường gọi thẳng: pcAdd từ tab ngoài 2 tab đó phải bị chặn, không chỉ ẩn thanh */
const chanAdd = await page.evaluate(() => {
  showTab("sku"); pcAdd("WH - MATERIAL - MTG", "422322192", "x", 2, "thử");
  const nSku = pcCount();
  showTab("kk"); pcAdd("WH - MATERIAL - MTG", "422322192", "x", 2, "thử");
  const nKk = pcCount();
  PC.sel = {}; pcSyncBar(); showTab("sku");
  return { nSku, nKk };
});
kiem("pcAdd bị chặn ở tab ngoài phạm vi, vẫn chạy ở tab Kiểm kê",
  chanAdd.nSku === 0 && chanAdd.nKk === 1, "tab sku → " + chanAdd.nSku + " · tab kk → " + chanAdd.nKk);

/* ---------- 6b. ĐƠN VỊ NHỎ NHẤT (keo Bemis có cả SKU tính theo mét lẫn theo mm) ---------- */
/* Kiểm kê đếm bằng mm nên thẻ #1 phải là bản mm; bản mét KHÔNG được giấu vì có khi nó mới là bản
   đang thật sự có tồn — nên phải vẽ thành nút bấm chọn được ngay trong thẻ. */
await page.evaluate(() => { ndsXoaHet(); PC.sel = {}; pcSyncBar(); document.getElementById("ndsRaw").value = "Keo bonding 3914 Bemis Clear"; });
await page.evaluate(() => ndsDoiSoat());
await new Promise((r) => setTimeout(r, 700));
const dv = await page.evaluate(() => {
  const r = (window.NDS && NDS.ket && NDS.ket[0]) || null;
  return r ? { sku: r.sku, dv: r.dv, donVi: r.donVi, viDonVi: r.viDonVi,
    bt: (r.bienThe || []).map((x) => x.sku + "/" + x.donVi + "/" + x.status) } : null;
});
kiem("Thẻ #1 là SKU ĐƠN VỊ NHỎ NHẤT (mm), không phải bản mét", !!dv && dv.dv === "mm",
  dv ? dv.sku + " · ĐVT " + dv.donVi : "(không có kết quả)");
kiem("Biến thể cùng hàng khác đơn vị được liệt kê kèm ACTIVE/INACTIVE",
  !!dv && dv.bt.length > 0 && /\/(ACTIVE|INACTIVE)$/.test(dv.bt[0]), dv ? dv.bt.join(" | ") : "");
const soAlt = await page.$$eval("#ndsCards .nds-card .nds-alt", (a) => a.length).catch(() => 0);
kiem("Biến thể vẽ thành nút bấm chọn được (không phải chữ chết)", soAlt > 0, soAlt + " nút");
await page.evaluate(() => { const d = document.querySelector("#ndsCards .nds-card details"); if (d) d.open = true; });
const skuAlt = await page.$eval("#ndsCards .nds-card .nds-alt", (e) => e.textContent.trim().split(" ")[0]).catch(() => "");
/* Thước đo là TOAST chứ không phải sổ tay: tem keo Bemis này chỉ bóc ra được 1 từ khoá định danh
   nên `chuKy` cố tình trả rỗng (dưới 2 từ khoá thì KHÔNG đáng nhớ) ⇒ sổ tay không ghi gì, đúng thiết
   kế. Cái cần khoá ở đây là: bấm biến thể thì xác nhận ĐÚNG SKU của nút đó, và không vào giỏ. */
await page.evaluate(() => { PC.sel = {}; pcSyncBar(); const t = document.getElementById("toast"); t.textContent = ""; t.classList.remove("show"); });
await bam("#ndsCards .nds-card .nds-alt");
const altKq = await page.evaluate(() => ({ chu: document.getElementById("toast").textContent, gio: pcCount() }));
kiem("Bấm nút biến thể thì xác nhận ĐÚNG SKU đó (copy mã), không vào giỏ",
  altKq.chu.indexOf(skuAlt) >= 0 && /copy mã SKU/i.test(altKq.chu) && altKq.gio === 0,
  altKq.chu.slice(0, 70) + " · giỏ " + altKq.gio);

/* ---------- 6c. SỔ TAY TEM ĐÃ TẮT (21/08/2026, yêu cầu người dùng) ----------
   Sổ tay từng ghi nhớ "tem này = SKU kia" mỗi lần người dùng bấm một thẻ gợi ý, để lần sau ra ngay
   không cần AI. Nhưng đường ghi DUY NHẤT của nó là cú bấm vào thẻ — mà thẻ là một ô lớn trên điện
   thoại, chạm lệch rất dễ, và bấm nhầm một lần là ghim SKU SAI ở 100% cho mọi lần gặp lại tem đó.
   Mấy ca dưới khoá việc tắt: không ghi, không đọc, không còn nút nào của sổ, dữ liệu cũ đã dọn. */
const soT1 = await page.evaluate(() => ndsSoDem());
await page.evaluate(() => { ndsXoaHet(); document.getElementById("ndsRaw").value = "Chi Irisa F9-5284 Tex 27 Tkt 120 Hong tro"; ndsDoiSoat(); });
await new Promise((r) => setTimeout(r, 700));
const truocChon = await page.evaluate(() => (NDS.ket || []).map((r) => r.sku));
/* Cố ý bấm thẻ #2 (KHÔNG phải thẻ máy đoán đúng nhất) — trước đây chính cú bấm này ghim thẻ #2 lên
   #1 với 100% cho mọi lần sau. */
const chonThe2 = await page.evaluate(() => { const r = NDS.ket[1] || NDS.ket[0]; ndsChonSku(r.sku); return r.sku; });
await new Promise((r) => setTimeout(r, 500));
const soT2 = await page.evaluate(() => ({ dem: ndsSoDem(), tra: ndsSoTra(), luu: !!localStorage.getItem("nds-so-v1") }));
kiem("Chọn SKU KHÔNG ghi vào sổ tay, và không để lại gì trong máy",
  soT2.dem === 0 && soT2.tra.length === 0 && !soT2.luu,
  "bấm " + chonThe2 + " · sổ " + soT1 + " → " + soT2.dem + " ghi nhớ · localStorage " + (soT2.luu ? "CÒN" : "sạch"));
/* Dựng lại đúng bộ từ khoá đó (như lần sau quét lại tem cũ): thứ tự phải do ĐIỂM quyết định, không
   phải do cú bấm trước đó. */
await page.evaluate(() => { ndsXoaHet(); document.getElementById("ndsRaw").value = "Chi Irisa F9-5284 Tex 27 Tkt 120 Hong tro"; ndsDoiSoat(); });
await new Promise((r) => setTimeout(r, 700));
const lanSau = await page.evaluate(() => ({ ds: (NDS.ket || []).map((r) => r.sku), hoc: !!(NDS.ket[0] || {}).daHoc,
  nhanSo: !!document.querySelector("#ndsCards .nds-card .nds-quen"),
  chuThe: (document.querySelector("#ndsCards .nds-card .nds-chead") || {}).textContent || "",
  nutXoaSo: (document.getElementById("ndsFoot") || { innerHTML: "" }).innerHTML.indexOf("Xoá sổ tay") >= 0 }));
kiem("Lần sau gặp lại tem đó: thứ tự vẫn theo ĐIỂM, cú bấm trước không ghim được gì",
  lanSau.ds.join(",") === truocChon.join(",") && lanSau.hoc === false,
  "trước " + truocChon.join(",") + " → sau " + lanSau.ds.join(",") + (lanSau.hoc ? " (VẪN ghim!)" : ""));
kiem("Thẻ không còn nhãn \"từ sổ tay\" và không còn nút \"quên ghi nhớ\"",
  !lanSau.nhanSo && !/từ sổ tay/.test(lanSau.chuThe), lanSau.nhanSo ? "vẫn có nút quên" : "sạch");
kiem("Chân trang không còn nút \"Xoá sổ tay\" (không còn gì để xoá)", !lanSau.nutXoaSo);

/* ---------- 6d. THẺ MẪU CÓ NHÃN TRƯỜNG — MÃ CHỦ (sự cố 21/08/2026, thẻ CWHO0006) ----------
   Lõi đã có ca khoá trong qc-nhan-dien-sku. Ca này khoá riêng ĐƯỜNG CỦA TRANG: chữ thô đi qua
   tuVanBan để vẽ badge, rồi badge được gom lại và xếp vai bằng tuAI — bước đó KHÔNG mang theo ngữ
   cảnh nhãn, nên ndsDoiSoat phải tự đọc lại mã chủ từ ô chữ thô. Thiếu bước đó thì lõi đúng mà
   trang vẫn trả về cuộn vải. */
const THE_MAU = [
  "THẺ THÔNG TIN MẪU",
  "LOẠI MẪU: Mẫu thông chuyền",
  "Mã sản phẩm: CWHO0006",
  "Tên sản phẩm: Women_Hoodie_Full-zip_Anti-UV_Regular",
  "Size: S",
  "Nguyên phụ liệu: Đúng X Thay thế",
  "Thành phần vải: Vải Single Mesh/S130413 UZM Sheico/88% Re-Polyester, 12%Spandex/170 Gsm, 152cm",
  "Màu sắc: Xanh Tro-Dusky Green",
].join("\n");
await page.evaluate((chu) => { ndsXoaHet(); document.getElementById("ndsRaw").value = chu; return ndsDoiSoat(); }, THE_MAU);
await new Promise((r) => setTimeout(r, 900));
const theMau = await page.evaluate(() => ({
  ket: (NDS.ket || []).map((r) => r.sku),
  pct: (NDS.ket || []).map((r) => r.pct),
  maChu: (NDS.tokens || []).map((k) => k.t),
  coHang: (NDS.ds || []).some((r) => String(r.sku) === "422495218"),
  html: (document.getElementById("ndsCards") || { innerHTML: "" }).innerHTML,
}));
if (theMau.coHang) {
  kiem("Thẻ mẫu CWHO0006 trên TRANG: #1 là áo mẫu 422495218, không phải cuộn vải 422423807",
    theMau.ket[0] === "422495218" && theMau.ket.indexOf("422423807") < 0,
    theMau.ket.map((s, i) => s + "/" + theMau.pct[i] + "%").join(" · "));
} else {
  kiem("Thẻ mẫu CWHO0006 trên TRANG: #1 là áo mẫu 422495218", true, "(danh mục live chưa có SKU này)");
}
kiem("Badge của thẻ mẫu không có màu BẠC bịa ra từ nhãn \"Màu sắc\"",
  theMau.maChu.indexOf("bac") < 0 && theMau.maChu.indexOf("sac") < 0,
  "badge = " + theMau.maChu.slice(0, 14).join(",") + "…");
kiem("Thẻ mẫu ĐỌC ĐƯỢC mã thì KHÔNG hiện cảnh báo \"chưa đọc được ô Mã sản phẩm\"",
  !/chưa đọc được ô/i.test(theMau.html), /chưa đọc được ô/i.test(theMau.html) ? "vẫn cảnh báo oan" : "sạch");

/* Banner "Đây là THẺ MẪU nhưng chưa đọc được ô Mã sản phẩm" ĐÃ BỎ (yêu cầu user 21/08/2026 kèm
   video — đảo yêu cầu buổi sáng cùng ngày): 6 dòng chữ trên điện thoại, mà lối thoát trùng với
   banner "Chưa khớp được MÃ HÀNG nào". Cái CÒN PHẢI GIỮ: lõi vẫn ghi `NDS.theMau` (coNhan + maChu)
   để chẩn đoán, và thẻ không được hiện cái banner đã bỏ. Rủi ro nhận diện của ca này (cuộn vải lên
   hạng 1 khi mất ô mã) đã ghi ở NHAN-DIEN-SKU.md — người dùng chấp nhận đổi lấy màn gọn. */
await page.evaluate((chu) => { ndsXoaHet(); document.getElementById("ndsRaw").value = chu; return ndsDoiSoat(); },
  THE_MAU.replace("CWHO0006", "CVVHO0006"));
await new Promise((r) => setTimeout(r, 900));
const theXau = await page.evaluate(() => ({
  html: (document.getElementById("ndsCards") || { innerHTML: "" }).innerHTML,
  maChu: (NDS.theMau || {}).maChu || [], coNhan: !!(NDS.theMau || {}).coNhan,
  ket: (NDS.ket || []).map((r) => r.sku),
}));
kiem("Thẻ mẫu KHÔNG đọc được ô \"Mã sản phẩm\" → lõi vẫn ghi NDS.theMau, banner đã bỏ thì không hiện",
  theXau.coNhan && theXau.maChu.length === 0 && !/chưa đọc được ô/i.test(theXau.html),
  "có nhãn mã: " + theXau.coNhan + " · mã chủ: " + JSON.stringify(theXau.maChu) + " · #1: " + (theXau.ket[0] || "-") +
  " · còn banner: " + /chưa đọc được ô/i.test(theXau.html));

/* MÃ ĐỌC ĐƯỢC MÀ DANH MỤC KHÔNG CÓ — khác hẳn ca "chưa đọc được mã", và phải nói câu khác (sự cố
   thẻ CWPT0019: SKU_MASTER chỉ có tới CWPT0018). Nói "chưa khớp mã" thì thủ kho đi soi lại tấm tem,
   trong khi chỗ phải sửa là ĐỒNG BỘ danh mục. */
await page.evaluate(() => { ndsXoaHet();
  document.getElementById("ndsRaw").value = "THẺ THÔNG TIN MẪU | LOẠI MẪU: Mẫu thông chuyền | Mã sản phẩm: CWPT0019 | Size: S | Màu sắc: Đen-Deep Black";
  return ndsDoiSoat(); });
await new Promise((r) => setTimeout(r, 900));
const maLa = await page.evaluate(() => ({
  html: (document.getElementById("ndsCards") || { innerHTML: "" }).innerHTML,
  coTrongDanhMuc: !!(NDS.cm && NDS.cm.idx && NDS.cm.idx["cwpt0019"]),
  badge: (NDS.tokens || []).map((k) => k.t),
  ket: (NDS.ket || []).map((r) => r.sku + "/" + r.pct),
  khopMa: (NDS.ket || []).reduce((n, r) => n + ((r.khop && r.khop.code) || []).length, 0),
}));
if (maLa.coTrongDanhMuc) {
  kiem("Mã đọc được mà danh mục không có → nói \"Danh mục chưa có mã\"", true, "(danh mục live đã có cwpt0019)");
} else {
  kiem("Mã đọc được mà danh mục KHÔNG CÓ → banner nói đúng chỗ phải sửa (đồng bộ, không phải chụp lại tem)",
    /Danh mục chưa có mã/i.test(maLa.html) && /CWPT0019/i.test(maLa.html) &&
    /Tải lại danh mục/i.test(maLa.html) && !/chưa đọc được ô/i.test(maLa.html),
    "có banner: " + /Danh mục chưa có mã/i.test(maLa.html) + " · có nút tải lại: " + /Tải lại danh mục/i.test(maLa.html));
  kiem("… và KHÔNG dòng nào tự nhận khớp mã (cwpt0019 không được khớp mờ với cwpt0015)",
    maLa.khopMa === 0 && maLa.badge.indexOf("cwpt0019") >= 0,
    "số mảnh mã được tính khớp: " + maLa.khopMa + " · badge vẫn giữ mã đọc được: " + (maLa.badge.indexOf("cwpt0019") >= 0) +
    " · Top: " + maLa.ket.join(" · "));
}

/* Dòng "chưa có bản ĐƠN VỊ NHỎ NHẤT" ĐÃ BỎ (yêu cầu user 21/08/2026, nhắc lần 2 kèm video —
   đảo ngược yêu cầu buổi sáng cùng ngày): đơn vị của dòng đã in ngay cạnh tồn ("Tồn 47 Hộp") nên
   dải đỏ đó chỉ chiếm chỗ. Cờ `khongCoDvNho` thì lõi VẪN phải tính (bộ đo và chẩn đoán dùng).
   Tìm ngay trong danh mục của TRANG một mặt hàng chỉ có đơn vị lớn rồi soi cả hai điều đó. */
const dvLon = await page.evaluate(async () => {
  const ds = NDS.ds || [];
  const nhom = new Map();
  for (const r of ds) { const k = NDS_ENGINE.khoaHang(r.pn); if (!nhom.has(k)) nhom.set(k, []); nhom.get(k).push(r); }
  let manh = "", sku = "";
  for (const [, v] of nhom) {
    const w = v.map((r) => ({ r, d: NDS_ENGINE.donVi(r.pn) }));
    if (w.some((x) => x.d.nho) || !w.some((x) => x.d.ma)) continue;
    const p0 = String(v[0].pn).split("/")[0].trim();
    if (p0.length < 6) continue;                       // mảnh quá ngắn thì lọc ra cả trăm dòng
    manh = p0; sku = v[0].sku; break;
  }
  if (!manh) return { co: false };
  ndsXoaHet();
  NDS.loc = [manh];
  await ndsDoiSoat();
  return { co: true, manh, sku,
    html: (document.getElementById("ndsCards") || { innerHTML: "" }).innerHTML,
    ket: (NDS.ket || []).map((r) => r.sku + "/" + (r.dv || "?") + "/" + !!r.khongCoDvNho) };
});
if (!dvLon.co) kiem("Cờ khongCoDvNho còn tính, dải chữ đã bỏ", true, "(danh mục live không có mặt hàng nào chỉ đơn vị lớn)");
else {
  kiem("Mặt hàng chỉ đơn vị LỚN → cờ khongCoDvNho vẫn tính, nhưng thẻ KHÔNG còn dải \"chưa có bản ĐƠN VỊ NHỎ NHẤT\"",
    dvLon.ket.some((s) => /\/true$/.test(s)) && !/ĐƠN VỊ NHỎ NHẤT/i.test(dvLon.html),
    "mảnh \"" + dvLon.manh.slice(0, 34) + "\" → " + dvLon.ket.slice(0, 3).join(" · "));
}

/* ---------- 6d. Mã vạch: có API thì quét, không có thì nói rõ chứ không im ---------- */
const mv = await page.evaluate(() => ({ co: ndsCoMaVach(), nut: !!document.getElementById("ndsBtnMV") }));
kiem("Có nút \"Quét mã vạch\" (đường nhanh nhất, không cần AI)", mv.nut, mv.co ? "trình duyệt CÓ BarcodeDetector" : "trình duyệt không có API — tab phải nói rõ ở dòng chân");
/* Dòng chân đã bỏ hết chữ (20/08/2026) nên tình trạng mã vạch + số ghi nhớ kiểm bằng STATE. */
const mvState = await page.evaluate(() => ({ co: ndsCoMaVach(), so: ndsSoDem(), nut: !!document.getElementById("ndsBtnMV") }));
kiem("Tình trạng mã vạch + số ghi nhớ sổ tay đọc được (không cần dòng thông báo)",
  mvState.nut && typeof mvState.co === "boolean" && typeof mvState.so === "number",
  "BarcodeDetector: " + mvState.co + " · sổ tay: " + mvState.so + " ghi nhớ");

/* ---------- 6e. Mã vạch với API GIẢ ----------
   Edge trên Windows không có BarcodeDetector (API này chỉ có trên Android), nên phần THẬT sẽ chỉ
   chạy trên điện thoại. Nhưng đoạn mã của mình thì kiểm được ngay: cắm một BarcodeDetector giả rồi
   xem có đi đúng đường "quét → thành từ khoá → tra sổ tay → ra SKU, không gọi AI" hay không. */
await page.evaluate(() => {
  window.BarcodeDetector = function () {
    this.detect = function () { return Promise.resolve([{ rawValue: "8938505970012" }]); };
  };
  NDS_BD = null;
});
await page.evaluate(() => { ndsXoaHet(); PC.sel = {}; pcSyncBar(); });
const gasTruocMV = soGoiGas;
await page.evaluate(() => ndsThuMaVach());
await new Promise((r) => setTimeout(r, 700));
const mvKq = await page.evaluate(() => ({ ma: NDS.maVach.slice(), tag: NDS.tokens.map((t) => t.t), n: (NDS.ket || []).length }));
kiem("Mã vạch đọc được → vào thẳng từ khoá + đối soát ngay, KHÔNG gọi AI",
  mvKq.ma[0] === "8938505970012" && mvKq.tag.indexOf("8938505970012") >= 0 && soGoiGas === gasTruocMV,
  "mã " + mvKq.ma.join(",") + " · " + mvKq.n + " gợi ý · " + (soGoiGas - gasTruocMV) + " lượt gọi AI");
/* SỔ TAY ĐÃ TẮT (21/08/2026) nên đường "dạy mã vạch một lần, lần sau ra ngay" KHÔNG còn — đây là cái
   giá phải trả cho việc chống chạm nhầm, và ca test nói thẳng ra thay vì để nó âm thầm mất.
   Cái CÒN LẠI vẫn nguyên: quét mã vạch → thành từ khoá → đối soát bằng điểm, không gọi AI (ca trên),
   và nếu con số quét được TRÙNG một SKU nội bộ thì ăn thẳng, không cần sổ nào. */
const skuMV = await page.evaluate(() => { const s = NDS.ds[10].sku; ndsChonSku(s); return s; });
await new Promise((r) => setTimeout(r, 500));
await page.evaluate(() => { ndsXoaHet(); return ndsThuMaVach(); });
await new Promise((r) => setTimeout(r, 700));
const mvHoc = await page.evaluate(() => ({ sku: (NDS.ket[0] || {}).sku, hoc: !!(NDS.ket[0] || {}).daHoc, so: ndsSoDem() }));
kiem("Bấm chọn SKU rồi quét lại mã vạch đó: KHÔNG ghim gì (sổ tay đã tắt)",
  mvHoc.hoc === false && mvHoc.so === 0,
  "đã bấm " + skuMV + " · sổ " + mvHoc.so + " ghi nhớ · #1 hiện tại " + mvHoc.sku + (mvHoc.hoc ? " (VẪN ghim!)" : ""));
const mvSku = await page.evaluate(async () => {
  /* Mã vạch TRÙNG một SKU nội bộ (hàng đã dán tem kho): đường này không đi qua sổ tay bao giờ. */
  const s = String(NDS.ds[10].sku);
  window.BarcodeDetector = function () { this.detect = function () { return Promise.resolve([{ rawValue: s }]); }; };
  NDS_BD = null;
  ndsXoaHet();
  await ndsThuMaVach();
  await new Promise((r) => setTimeout(r, 600));
  return { can: s, ra: (NDS.ket[0] || {}).sku, laSku: !!(NDS.ket[0] || {}).laSku };
});
kiem("Mã vạch TRÙNG SKU nội bộ vẫn ra thẳng SKU đó (không cần sổ tay)",
  String(mvSku.ra) === String(mvSku.can), "quét " + mvSku.can + " → #1 " + mvSku.ra);
/* Dọn về trạng thái các ca sau đang trông đợi: bỏ API giả, xoá sổ tay, và DỰNG LẠI từ khoá tem YKK
   (ca "AI lỗi" ở dưới kiểm rằng lỗi AI không làm mất từ khoá đang có — phải có từ khoá thì mới kiểm được). */
await page.evaluate(() => {
  delete window.BarcodeDetector; NDS_BD = null;
  localStorage.removeItem("nds-so-v1"); NDS_SO.ds = null;
  ndsXoaHet();
  document.getElementById("ndsRaw").value = "YKK 8846295 CMOR-36 38.0 CM 345";
  ndsDoiSoat();
});
await new Promise((r) => setTimeout(r, 600));

/* ---------- 6h. APPS SCRIPT TRẢ HTML THAY VÌ JSON (lỗi thật 19/08/2026) ----------
   Gọi web app của GAS luôn đi 2 chặng (exec → 302 → googleusercontent/echo). Chặng 2 thỉnh thoảng
   trả TRANG HTML trong khi script đã chạy xong ⇒ r.json() ném "Unexpected token '<'". Phải THỬ LẠI
   với CÙNG nonce (doPost cất phản hồi 10 phút nên không tốn thêm lượt Gemini), và nếu vẫn hỏng thì
   báo bằng tiếng người + chỉ sang đường gõ mã. */
await page.evaluate(() => { ndsXoaHet(); document.getElementById("toast").classList.remove("show"); });
traHtml = 1;                                              // hỏng 1 lượt rồi tự khỏi
const gasTr1 = soGoiGas;
await bam("#ndsBtnDoc");
await page.waitForFunction(() => document.querySelectorAll("#ndsTags .nds-tag").length > 0, { timeout: 30000 }).catch(() => {});
const sauThuLai = await page.evaluate(() => ({ tag: document.querySelectorAll("#ndsTags .nds-tag").length,
  toast: document.getElementById("toast").textContent }));
kiem("GAS trả HTML 1 lượt → tự thử lại và VẪN đọc được tem",
  sauThuLai.tag > 0 && soGoiGas - gasTr1 >= 2, sauThuLai.tag + " từ khoá sau " + (soGoiGas - gasTr1) + " lượt gọi");
/* Hỏng cả 3 lượt: không được quăng thông báo của bộ phân tích JSON vào mặt người dùng */
await page.evaluate(() => { ndsXoaHet(); const t = document.getElementById("toast"); t.textContent = ""; t.classList.remove("show"); });
traHtml = 9;
await bam("#ndsBtnDoc");
await new Promise((r) => setTimeout(r, 6000));
const bao = await page.evaluate(() => document.getElementById("toast").textContent);
traHtml = 0;
kiem("Hỏng hết lượt → báo bằng tiếng người + chỉ sang đường gõ mã (không lộ 'Unexpected token')",
  /trang HTML/.test(bao) && /Mã trên tem/.test(bao) && !/Unexpected token/.test(bao), bao.slice(0, 110));

/* ---------- 6i. GỢI Ý MÃ NGAY KHI GÕ (không cần AI, không cần mạng) ---------- */
const goiGo = await page.evaluate(() => {
  document.getElementById("ndsMa").value = "5374"; ndsMaGo("5374");
  const el = document.getElementById("ndsMaGoi");
  return { hien: !el.hidden, nut: Array.prototype.map.call(el.querySelectorAll("button"), (b) => b.textContent.trim()) };
});
kiem("Gõ 4 ký tự giữa mã (5374) → gợi ý ngay mã thật trong danh mục, kèm số SKU",
  goiGo.hien && goiGo.nut.some((t) => /f9-5374/.test(t)) && /\d/.test(goiGo.nut[0] || ""),
  goiGo.nut.slice(0, 4).join(" · ") || "(không gợi ý)");
const gasTruocGo = soGoiGas;
await bam("#ndsMaGoi button");
await new Promise((r) => setTimeout(r, 700));
const sauGo = await page.evaluate(() => ({ n: (NDS.ket || []).length, deu: (NDS.ket || []).every((r) => String(r.pn).indexOf("5374") >= 0) }));
kiem("Chạm mã gợi ý → ra SKU đúng ngay, KHÔNG gọi AI lần nào",
  sauGo.n > 0 && sauGo.deu && soGoiGas === gasTruocGo, sauGo.n + " gợi ý · " + (soGoiGas - gasTruocGo) + " lượt gọi AI");
await page.evaluate(() => { ndsXoaHet(); document.getElementById("ndsMa").value = ""; ndsVeMaGoi([]); });

/* ---------- 6g. ZOOM CAMERA (tem nhỏ: xa thì chữ bé, gần thì nhoè) ----------
   Không mở được camera thật trong Edge headless nên kiểm phần LOGIC: hàng zoom có mặt và đang ẩn,
   ndsDatZoom đổi đúng nhãn + nhớ vào localStorage, và zoom SỐ phải đặt transform lên thẻ video
   (đó là thứ quyết định vùng sẽ được CẮT lúc chụp). */
const zoom = await page.evaluate(() => {
  const row = document.getElementById("ndsZoomRow");
  const truoc = row.hidden;
  NDS.zoomCung = false;
  ndsDatZoom(2.5);
  const v = document.getElementById("ndsVideo");
  let luu = ""; try { luu = localStorage.getItem("nds-zoom") || ""; } catch (e) {}
  const nhan = document.getElementById("ndsZoomVal").textContent;
  const tf = v.style.transform;          // CHỤP trước khi trả zoom về 1 (đọc sau là ra scale(1))
  ndsDatZoom(1);
  return { anLucDau: truoc, nhan, tf, luu, coThanh: !!document.getElementById("ndsZoom") };
});
kiem("Có thanh zoom, mặc định ẩn (chỉ hiện khi camera bật)", zoom.coThanh && zoom.anLucDau);
kiem("Kéo zoom: đổi nhãn, phóng to khung xem trước, và NHỚ cho lần sau",
  zoom.nhan === "2,5×" && /scale\(2\.5\)/.test(zoom.tf) && zoom.luu === "2.5",
  zoom.nhan + " · " + zoom.tf + " · nhớ=" + zoom.luu);

/* ---------- 6f. TRA THẲNG THEO MÃ TRÊN TEM (sự cố F9-5374 ngày 19/08/2026) ----------
   Tem in F9-5374 (mã CÓ trong danh mục) mà AI không đọc ra ⇒ máy trả về SKU khác mã, 68%, trông
   rất tự tin. Ba ca dưới khoá cả ba lối thoát: gõ mã là ra đúng · gõ sai thì gợi ý mã gần giống ·
   không khớp được mã nào thì phải CẢNH BÁO chứ không im lặng. */
await page.evaluate(() => { ndsXoaHet(); document.getElementById("ndsMaGoi").hidden = true; });
const oMa = await page.$("#ndsMa");
kiem("Có ô \"Mã trên tem\" ngay ở bước 1 (không bắt cuộn xuống bước 3)", !!oMa);
await page.evaluate(() => { document.getElementById("ndsMa").value = "F9-5374"; ndsTraMa(); });
await new Promise((r) => setTimeout(r, 800));
const traMa = await page.evaluate(() => ({
  ds: (NDS.ket || []).map((r) => r.sku),
  deu: (NDS.ket || []).length > 0 && (NDS.ket || []).every((r) => String(r.pn).indexOf("5374") >= 0),
  coMa: !!(NDS.ket || []).coMaKhop,
}));
kiem("Gõ mã F9-5374 → MỌI gợi ý đều là SKU mang mã đó", traMa.deu && traMa.coMa, traMa.ds.join(",") || "(rỗng)");
/* Gõ sai một ký tự: không được im lặng, phải mời chọn mã gần giống */
await page.evaluate(() => { ndsXoaHet(); document.getElementById("ndsMa").value = "F9-5374X"; ndsTraMa(); });
await new Promise((r) => setTimeout(r, 800));
const goiY = await page.evaluate(() => {
  const e = document.getElementById("ndsMaGoi");
  return { hien: !e.hidden, nut: Array.prototype.map.call(e.querySelectorAll("button"), (b) => b.textContent.trim()) };
});
kiem("Gõ mã sai → hiện dải \"Ý bạn là…\" để bấm chọn", goiY.hien && goiY.nut.length > 0, goiY.nut.slice(0, 5).join(" · ") || "(không gợi ý)");
if (goiY.nut.length) {
  await bam("#ndsMaGoi button");
  await new Promise((r) => setTimeout(r, 700));
  const sauChon = await page.evaluate(() => ({ n: (NDS.ket || []).length, coMa: !!(NDS.ket || []).coMaKhop }));
  kiem("Bấm mã gợi ý → đối soát lại theo mã đó", sauChon.n > 0 && sauChon.coMa, sauChon.n + " gợi ý");
}
/* Không có mã nào: banner "Chưa khớp được MÃ HÀNG nào" ĐÃ BỎ HẲN (user 22/08/2026 — "bỏ dòng
   này"): 4 dòng chữ chắn trên Top 3. Ca này đảo chiều: banner KHÔNG được hiện nữa, kết quả gợi ý
   theo chữ chung vẫn phải ra. Banner "danh mục chưa có mã X" (nhánh maLa) thì vẫn còn — ca 6đ. */
await page.evaluate(() => { ndsXoaHet(); document.getElementById("ndsRaw").value = "Chi Filtex Phong Viet Polyester"; ndsDoiSoat(); });
await new Promise((r) => setTimeout(r, 800));
const canhBao = await page.evaluate(() => {
  const n = document.querySelector("#ndsCards .pcdnote");
  return { co: !!n, chu: n ? n.textContent.trim().slice(0, 60) : "", coMa: !!(NDS.ket || []).coMaKhop,
    nKet: (NDS.ket || []).length };
});
kiem("Không khớp được mã nào → banner dạy dỗ ĐÃ BỎ, gợi ý theo chữ chung vẫn hiện",
  !canhBao.co && !canhBao.coMa && canhBao.nKet > 0,
  (canhBao.co ? "CÒN banner: " + canhBao.chu : "không banner") + " · " + canhBao.nKet + " gợi ý");

/* ---------- 6f2. NÚT "⚖ Cân → SL" (22/08/2026, user chốt): CHỈ thẻ nhóm hàng Chỉ* ----------
   Kết quả của ca trên là các SKU Chỉ (query "Chi Filtex…") → thẻ phải có nút; bấm nút phải mở
   pop-up Cân→SL + SKU tự vào danh sách in, và KHÔNG kích nhầm "bấm thẻ = copy mã" (stopPropagation
   — đúng họ bẫy của nút In tem/quên ghi nhớ). Hàng không phải chỉ thì không có nút. */
const nutCan = await page.evaluate(() => ({
  co: !!document.querySelector("#ndsCards .nds-card .nds-can"),
  tong: document.querySelectorAll("#ndsCards .nds-card").length }));
kiem("Thẻ nhóm hàng Chỉ có nút ⚖ Cân → SL", nutCan.co && nutCan.tong > 0, JSON.stringify(nutCan));
await page.evaluate(() => { try{ prXoaHet(); }catch(e){} });
await bam("#ndsCards .nds-card .nds-can");
await new Promise((r) => setTimeout(r, 600));
const sauBam = await page.evaluate(() => ({
  csShow: document.getElementById("csmodal").classList.contains("show"),
  daThem: prSo() === 1,
  texCo: document.getElementById("csTex").value !== "" }));
kiem("Bấm nút Cân → SL: mở pop-up, SKU tự vào danh sách in, Tex prefill từ tên",
  sauBam.csShow && sauBam.daThem && sauBam.texCo, JSON.stringify(sauBam));
await page.evaluate(() => { try{ csDong(); prXoaHet(); }catch(e){} });
await new Promise((r) => setTimeout(r, 400));
await page.evaluate(() => { ndsXoaHet(); document.getElementById("ndsRaw").value = "Nhan care gap satin"; ndsDoiSoat(); });
await new Promise((r) => setTimeout(r, 900));
const nutCan2 = await page.evaluate(() => ({
  co: !!document.querySelector("#ndsCards .nds-card .nds-can"),
  tong: document.querySelectorAll("#ndsCards .nds-card").length }));
kiem("Thẻ hàng KHÔNG phải chỉ (nhãn care) không có nút Cân → SL", nutCan2.tong > 0 && !nutCan2.co, JSON.stringify(nutCan2));

/* ---------- 6g. Ô "PHẦN TỬ TRÊN TEM": TRA MẢNH MỚI PHẢI ĐỔI KẾT QUẢ ----------
   LỖI THẬT 19/08/2026 (người dùng báo): gõ "gecko" → Tra ra 3 SKU Gecko (đúng), gõ tiếp "c3298"
   → Tra VẪN hiện nguyên 3 SKU Gecko ấy, không một dấu hiệu nào. Hai nguyên nhân cộng lại:
     a) token của ô này CỘNG DỒN qua từng lượt Tra ("gecko" vẫn nằm đó và vẫn chấm điểm);
     b) locDong() khớp 0 dòng thì timTop coi như "không có bộ lọc" rồi rơi xuống chấm điểm
        bằng từ khoá cũ — âm thầm trả về kết quả của lượt trước.
   Dự liệu lấy TỪ DANH MỤC THẬT lúc chạy (không găm chữ "gecko" vào test: danh mục đổi là ca chết). */
const manh = await page.evaluate(() => {
  const ds = ndsDsMa() || [];                       // các mã thật trong danh mục
  const co = ds.find((x) => x.n >= 1);
  return { co: co ? co.m : "", khong: "zzq9x7k" };   // "zzq9x7k" chắc chắn không có trong tên hàng nào
});
await page.evaluate((m) => { ndsXoaHet(); document.getElementById("ndsMa").value = m; ndsTraMa(); }, manh.co);
await new Promise((r) => setTimeout(r, 700));
const buoc1 = await page.evaluate(() => ({ n: (NDS.ket || []).length, the: document.querySelectorAll("#ndsCards .nds-card").length }));
kiem("Tra mảnh có thật (" + manh.co + ") → có gợi ý", buoc1.n > 0 && buoc1.the > 0, buoc1.n + " gợi ý");
await page.evaluate((m) => { document.getElementById("ndsMa").value = m; ndsTraMa(); }, manh.khong);
await new Promise((r) => setTimeout(r, 700));
const buoc2 = await page.evaluate(() => ({
  n: (NDS.ket || []).length, the: document.querySelectorAll("#ndsCards .nds-card").length,
  tok: NDS.tokens.map((k) => k.t), loc: (NDS.loc || []).join(","),
  st: (document.getElementById("ndsState").textContent || "").replace(/\s+/g, " ").trim(),
}));
kiem("Tra mảnh KHÔNG có trong danh mục → xóa sạch gợi ý của lượt trước (không giữ kết quả cũ)",
  buoc2.n === 0 && buoc2.the === 0 && buoc2.tok.indexOf(manh.co) < 0,
  buoc2.the + " thẻ · token: " + (buoc2.tok.join(",") || "(sạch)"));
kiem("… và nói ĐÚNG thủ phạm: nêu chính mảnh vừa gõ, không bảo đi bỏ từ khoá",
  buoc2.st.indexOf(manh.khong) >= 0 && !/bỏ từ khoá đọc nhầm/.test(buoc2.st), buoc2.st.slice(0, 105));
/* Từ khoá AI thuộc về cùng cái tem đó — dọn token của ô mảnh KHÔNG được dọn lây sang chúng */
await page.evaluate((m) => {
  ndsXoaHet();
  ndsThemToken("ykk", "brand", "ai"); ndsThemToken("38cm", "spec", "ai"); ndsVeTags();
  document.getElementById("ndsMa").value = m; ndsTraMa();
}, manh.co);
await new Promise((r) => setTimeout(r, 700));
const songSot = await page.evaluate(() => NDS.tokens.map((k) => k.nguon + ":" + k.t));
kiem("Từ khoá AI sống sót qua lượt Tra (chỉ token của ô mảnh bị thay)",
  songSot.filter((t) => /^ai:/.test(t)).length === 2 && songSot.some((t) => /^manh:/.test(t)), songSot.join(" · "));
await page.evaluate(() => { ndsXoaHet(); document.getElementById("ndsMa").value = ""; ndsVeMaGoi([]); });

await page.evaluate(() => { ndsXoaHet(); document.getElementById("ndsMa").value = ""; ndsVeMaGoi([]);
  document.getElementById("ndsRaw").value = "YKK 8846295 CMOR-36 38.0 CM 345"; ndsDoiSoat(); });
await new Promise((r) => setTimeout(r, 600));

/* ---------- 6k. IN TEM SKU: danh sách chờ in (bước 1, 20/08/2026) ----------
   Hai yêu cầu chốt của người dùng, mỗi cái một ca khoá lại:
   ① thêm vào danh sách in PHẢI do người bấm đúng nút — nhấn nhầm vào thẻ thì KHÔNG được thêm;
   ② vào danh sách rồi vẫn bỏ được: bấm lại nút trên thẻ · nút ✕ từng dòng · Xoá hết. */
await page.evaluate(() => { ndsXoaHet(); PR.sel = {}; prLuu(); prSyncBar();
  document.getElementById("ndsRaw").value = "8846295 38.0 CM #3 345 YKK"; return ndsDoiSoat(); });
await new Promise((r) => setTimeout(r, 800));
const temNut = await page.evaluate(() => ({
  soThe: document.querySelectorAll("#ndsCards .nds-card").length,
  soNut: document.querySelectorAll("#ndsCards .nds-tem").length,
  chu: (document.querySelector("#ndsCards .nds-tem") || {}).textContent,
  cao: Math.round((document.querySelector("#ndsCards .nds-tem") || {}).getBoundingClientRect?.().height || 0),
}));
kiem("Mỗi thẻ gợi ý có nút riêng để thêm vào danh sách in", temNut.soNut === temNut.soThe && temNut.soNut > 0,
  temNut.soNut + " nút / " + temNut.soThe + " thẻ · chữ \"" + temNut.chu + "\" · cao " + temNut.cao + "px");
kiem("Nút đủ cao để chạm bằng ngón tay (≥28px)", temNut.cao >= 28, temNut.cao + "px");

/* ① nhấn nhầm vào THẺ thì không được sinh ra tem để in */
await bam("#ndsCards .nds-card");
await new Promise((r) => setTimeout(r, 300));
const sauBamThe = await page.evaluate(() => ({ n: prSo(), tem: prTongTem(),
  bar: !document.getElementById("prbar").classList.contains("hidden") }));
kiem("Bấm CẢ THẺ không thêm gì vào danh sách in (chống nhấn nhầm)",
  sauBamThe.n === 0 && sauBamThe.tem === 0 && sauBamThe.bar === false,
  sauBamThe.n + " SKU · " + sauBamThe.tem + " tem · thanh " + (sauBamThe.bar ? "hiện" : "ẩn"));

/* ② bấm ĐÚNG nút thì mới thêm — và nút tự đổi trạng thái để biết đang chờ in */
const skuTem = await page.evaluate(() => (NDS.ket[0] || {}).sku);
/* Mốc sổ tay phải lấy NGAY TRƯỚC khi bấm nút: ca ① ở trên vừa bấm cả thẻ nên sổ tay đã tăng một
   lần rồi — lấy mốc từ trước đó thì ca này trượt oan (đã cắn đúng bẫy này lúc viết). */
const hocTruocNut = await page.evaluate(() => ndsSoDem());
await bam("#ndsCards .nds-tem");
await new Promise((r) => setTimeout(r, 400));
const sauTick = await page.evaluate(() => ({ n: prSo(), tem: prTongTem(), ds: Object.keys(PR.sel),
  chu: (document.querySelector("#ndsCards .nds-tem") || {}).textContent,
  co: !!document.querySelector("#ndsCards .nds-tem.co"),
  bar: !document.getElementById("prbar").classList.contains("hidden"),
  barN: document.getElementById("prbarN").textContent, barT: document.getElementById("prbarT").textContent,
  hoc: ndsSoDem() }));
kiem("Bấm nút \"＋ Tem\" đưa ĐÚNG SKU đó vào danh sách chờ in",
  sauTick.n === 1 && String(sauTick.ds[0]) === String(skuTem) && sauTick.tem === 1,
  sauTick.ds.join(",") + " · " + sauTick.tem + " tem");
kiem("Nút đổi sang trạng thái \"đang chờ in\" để nhìn là biết", /✓/.test(sauTick.chu) && sauTick.co, sauTick.chu);
kiem("Thanh nổi hiện đúng số SKU + số tem", sauTick.bar && sauTick.barN === "1" && sauTick.barT === "1",
  sauTick.barN + " SKU · " + sauTick.barT + " tem");
kiem("Bấm nút KHÔNG kích luôn hành động của thẻ cha (không ghi thêm sổ tay)", sauTick.hoc === hocTruocNut,
  "sổ tay " + hocTruocNut + " → " + sauTick.hoc);

/* ② bấm lại chính nút đó = BỎ khỏi danh sách */
await bam("#ndsCards .nds-tem.co");
await new Promise((r) => setTimeout(r, 400));
const sauBo = await page.evaluate(() => ({ n: prSo(), chu: (document.querySelector("#ndsCards .nds-tem") || {}).textContent,
  bar: !document.getElementById("prbar").classList.contains("hidden") }));
kiem("Bấm lại nút là BỎ khỏi danh sách in (không cần mở bảng)",
  /* Nhãn nút đổi 20/08/2026: "＋ Tem" → "In tem" (chưa thêm) · "✓ Đã thêm" (đã trong danh sách). */
  sauBo.n === 0 && /In tem/.test(sauBo.chu) && sauBo.bar === false, sauBo.n + " SKU · nút \"" + sauBo.chu + "\"");

/* ---------- 6k2. Bảng danh sách in: mẫu tem · số lượng · xoá từng dòng ---------- */
const bang = await page.evaluate(async () => {
  document.querySelectorAll("#ndsCards .nds-tem").forEach((b, i) => { if (i < 2) b.click(); });
  prMo();
  await new Promise((r) => setTimeout(r, 250));
  const head = [...document.querySelectorAll("#prmodal thead th")].map((t) => t.textContent.trim()).filter(Boolean);
  return {
    hienModal: document.getElementById("prmodal").classList.contains("show"),
    head,
    dong: document.querySelectorAll("#prBody tr").length,
    oNhap: document.querySelectorAll("#prBody tr:first-child input.prsl").length,
    nutXoa: document.querySelectorAll("#prBody .prdel").length,
    coXemTruoc: !!document.getElementById("prXem"),
    coMauTem: head.some((h) => /mẫu tem/i.test(h)) || !!document.querySelector("#prBody select.prmau"),
    tong: prTongTem(),
  };
});
/* Bảng đổi 22/08/2026 theo yêu cầu: CỘT "SỐ TEM" ĐÃ BỎ — còn 3 cột Số lượng · SKU · Tên sản phẩm.
   Chỗ cột Số tem cũ giờ là chip số lượng đã chốt (cùng ô với ô nhập); "Số tem: n" thành chữ hiển
   thị ở ô SKU. Bỏ cột "Mẫu tem" (một khổ giấy) và khối xem trước vẫn như bản 20/08. */
kiem("Bảng danh sách in đúng 3 cột: Số lượng · SKU · Tên sản phẩm (cột Số tem đã bỏ)",
  bang.hienModal && bang.head.length === 3 && /số lượng/i.test(bang.head[0]) &&
  /sku/i.test(bang.head[1]) && /tên sản phẩm/i.test(bang.head[2]), bang.head.join(" | "));
kiem("Mỗi dòng có 1 ô nhập (số lượng) và nút xoá — ô nhập Số tem đã đi hẳn",
  bang.dong === 2 && bang.oNhap === 1 && bang.nutXoa === 2,
  bang.dong + " dòng · " + bang.oNhap + " ô nhập · " + bang.nutXoa + " nút xoá");
kiem("Đã bỏ cột Mẫu tem và bỏ khối Xem trước", !bang.coMauTem && !bang.coXemTruoc,
  "mẫu tem: " + bang.coMauTem + " · xem trước: " + bang.coXemTruoc);


/* Cột Số tem đã bỏ (22/08/2026): số tem đi theo SỐ CHIP đã chốt — chốt 2 số lượng vào dòng 1 thì
   dòng đó 2 tem (tổng 3 vì dòng 2 vẫn 1 tem mặc định), và chữ "Số tem: 2" ở ô SKU đổi theo. */
const doiSl = await page.evaluate(async () => {
  const cam = async (v) => {
    const inp = document.querySelector("#prBody input.prsl-v");   // prVe dựng lại sau mỗi lần chốt
    inp.value = v; inp.dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 200));
  };
  await cam("5"); await cam("8");
  const tag = document.querySelector("#prBody tr .prtemin");
  return { tong: prTongTem(), tagSo: tag ? String(tag.value).trim() : "(không có)",
    nutIn: document.getElementById("prBtnIn").textContent };
});
/* 23/08/2026: "Số tem: n" là Ô NHẬP (`input.prtemin`), không còn là chữ `.prtemso b` — nhưng với
   dòng khai NHIỀU số lượng thì nó `readonly`, con số vẫn phải khớp số chip. */
kiem("Chốt 2 số lượng → dòng thành 2 tem, tổng đổi theo, ô \"Số tem\" hiện đúng 2",
  doiSl.tong === 3 && doiSl.tagSo === "2" && /3 tem/.test(doiSl.nutIn),
  doiSl.tong + " tem · tag " + doiSl.tagSo + " · nút \"" + doiSl.nutIn + "\"");


const xoaDong = await page.evaluate(async () => {
  const truoc = prSo();
  document.querySelector("#prBody .prdel").click();
  await new Promise((r) => setTimeout(r, 200));
  return { truoc, sau: prSo(), dong: document.querySelectorAll("#prBody tr").length };
});
kiem("Xoá được TỪNG DÒNG trong danh sách in", xoaDong.sau === xoaDong.truoc - 1 && xoaDong.dong === 1,
  xoaDong.truoc + " → " + xoaDong.sau + " SKU");

/* Ô SỐ LƯỢNG KIỂU CHIP (21/08/2026, yêu cầu người dùng).
   Cùng một SKU nhưng hàng chia nhiều bịch số lượng khác nhau (1.000 · 2.000 · 3.000) → mỗi bịch một
   con tem. Cách nhập: gõ số rồi bấm nút "+"; số đã chốt thành một chip, ô nhập dọn trống để gõ tiếp.
   Bản trước bắt người dùng tự gõ dấu phẩy — cú pháp phải học, mà trên điện thoại dấu phẩy còn nằm ở
   lớp bàn phím khác.
   ⚠ 23/08/2026: chip đứng SAU ô nhập và vẽ theo THỨ TỰ NGƯỢC (mới nhất trước) để ô nhập đứng yên một
   chỗ — nên kỳ vọng thứ tự chip trong các ca dưới là mới→cũ, KHÔNG phải thứ tự gõ. `r.slHang` (dữ
   liệu gửi máy in) vẫn theo thứ tự gõ; ca "Lệnh gửi đi" bên dưới canh đúng chỗ đó. */
const goSo = await page.evaluate(async () => {
  const o = document.querySelector("#prBody td.prslo input.prsl-v");
  const buoc = [];
  o.value = "";
  const nut = () => document.querySelector("#prBody td.prslo .prsladd");
  const congTruoc = !!nut() && nut().classList.contains("hien");
  "100000".split("").forEach((c) => { o.value += c; prGoSo(o); prHienCong(o); buoc.push(o.value); });
  const congSau = !!nut() && nut().classList.contains("hien");
  nut().click();
  await new Promise((r) => setTimeout(r, 250));
  const chip = Array.prototype.map.call(document.querySelectorAll("#prBody .prchip"),
    (e) => e.textContent.replace(/×/g, "").trim());
  return { buoc: buoc, congTruoc: congTruoc, congSau: congSau, chip: chip,
    oSau: document.querySelector("#prBody td.prslo input.prsl-v").value };
});
kiem("Gõ số lượng: tự chèn dấu chấm ngay từ hàng nghìn (1.000 … 100.000)",
  goSo.buoc[3] === "1.000" && goSo.buoc[5] === "100.000", goSo.buoc.join(" → "));
kiem("Nút \"+\" chỉ hiện khi trong ô ĐANG có số (ô trống thì ẩn)",
  goSo.congTruoc === false && goSo.congSau === true,
  "ô trống: " + (goSo.congTruoc ? "hiện" : "ẩn") + " · có số: " + (goSo.congSau ? "hiện" : "ẩn"));
kiem("Bấm \"+\": số vào chip và ô nhập TRỐNG lại (gõ tiếp được ngay, không hiện số 0)",
  goSo.chip.join("|") === "100.000" && goSo.oSau === "",
  "chip [" + goSo.chip.join("|") + "] · ô nhập \"" + goSo.oSau + "\"");

/* Ba bịch khác số lượng: gõ–cộng ba lần, ra ba chip đúng thứ tự và ba con tem. */
const baBich = await page.evaluate(async () => {
  let x;
  while ((x = document.querySelector("#prBody .prchip .x"))) {   // dọn chip cũ
    x.click(); await new Promise((r) => setTimeout(r, 90));
  }
  const go = async (v) => {
    const o = document.querySelector("#prBody td.prslo input.prsl-v");
    o.value = v; prGoSo(o); prHienCong(o);
    document.querySelector("#prBody td.prslo .prsladd").click();
    await new Promise((r) => setTimeout(r, 160));
  };
  await go("1000"); await go("2000"); await go("3000");
  const tag = document.querySelector("#prBody tr .prtemin");
  return { chip: Array.prototype.map.call(document.querySelectorAll("#prBody .prchip"),
      (e) => e.textContent.replace(/×/g, "").trim()),
    soTem: tag ? String(tag.value).trim() : "(không có)", tong: prTongTem(),
    o: document.querySelector("#prBody td.prslo input.prsl-v").value };
});
kiem("Ba bịch 1.000 · 2.000 · 3.000 → ba chip MỚI-NHẤT-TRƯỚC (sát ô nhập), ô nhập trống lại",
  baBich.chip.join("|") === "3.000|2.000|1.000" && baBich.o === "", "[" + baBich.chip.join(" | ") + "]");
kiem("Ba chip → 3 con tem, ô \"Số tem\" ở cột SKU nói đúng 3 (và bị khoá vì là số dẫn xuất)",
  baBich.soTem === "3" && baBich.tong === 3,
  "số tem " + baBich.soTem + " · tổng " + baBich.tong);

/* Lệnh gửi đi phải khai đúng 3 tem và mang cả ba số lượng — nếu không thì hàng đợi báo hụt và trần
   số tem gác sai. */
const guiNhieu = await page.evaluate(async () => {
  window.__goi = [];
  prGoiGas = async (b) => { window.__goi.push(b); return { status: "success", id: "PRTEST2", trangThai: "xong", soTem: 3 }; };
  window.__daIn = 0; window.print = () => { window.__daIn++; };
  prIn();
  await new Promise((r) => setTimeout(r, 500));
  const b = window.__goi[0] || {};
  let d = [];
  try { d = JSON.parse(b.dong || "[]"); } catch (e) { d = []; }
  return { sl: d[0] && d[0].sl, slHang: d[0] && d[0].slHang, daIn: window.__daIn, sku: d[0] && d[0].sku };
});
kiem("Lệnh gửi đi khai ĐÚNG 3 tem và mang cả ba số lượng",
  guiNhieu.sl === 3 && guiNhieu.slHang === "1.000, 2.000, 3.000" && guiNhieu.daIn === 0,
  "sl=" + guiNhieu.sl + " · slHang=\"" + guiNhieu.slHang + "\"");

/* Xoá phải xoá ĐÚNG chip được bấm (không phải cái cuối) — nhầm chỗ này là in sai số lượng mà người
   dùng không hề biết. */
const xoaChip = await page.evaluate(async () => {
  const truoc = prTongTem();
  document.querySelectorAll("#prBody .prchip .x")[1].click();   // bỏ chip GIỮA (2.000)
  await new Promise((r) => setTimeout(r, 250));
  const chip = Array.prototype.map.call(document.querySelectorAll("#prBody .prchip"),
    (e) => e.textContent.replace(/×/g, "").trim());
  const tag = document.querySelector("#prBody tr .prtemin");
  return { truoc: truoc, chip: chip, tong: prTongTem(), soTem: tag ? String(tag.value).trim() : "" };
});
/* Chip GIỮA vẫn là 2.000 sau khi đảo chiều hiển thị (3.000 · 2.000 · 1.000) — nhưng `data-i` của nó
   trỏ vào chỉ số THẬT trong `r.slHang`, nên ca này chính là chốt chống lỗi "đảo hiển thị làm xoá
   nhầm chip". Kết quả còn lại đọc theo thứ tự MỚI→CŨ. */
kiem("Xoá chip GIỮA thì bỏ đúng 2.000, còn 1.000 và 3.000 (không phải bỏ cái cuối)",
  xoaChip.chip.join("|") === "3.000|1.000" && xoaChip.tong === 2 && xoaChip.soTem === "2",
  xoaChip.truoc + " → " + xoaChip.tong + " tem · [" + xoaChip.chip.join(" | ") + "]");

/* CHIP TÌNH TRẠNG MÁY IN (21/08/2026) — sự cố: máy in hết giấy mà pop-up không báo gì, người dùng
   bấm ép in 4 lần rồi lắp cuộn mới vẫn không ra tem. Chip phải nói đúng ba mức: sẵn sàng / cảnh báo /
   chặn, và phải nói khi SỐ LIỆU ĐÃ CŨ (agent tắt thì "sẵn sàng" đọc từ 5 phút trước là vô giá trị). */
const chipMay = await page.evaluate(async () => {
  const goc = prGoiGas;
  const ra = {};
  const thu = async (may) => {
    prGoiGas = async () => ({ status: "success", cho: 0, temCho: 0, agentTre: 1200, may: may, tranSku: 40, tranTem: 400 });
    await prHoiHangDoi();
    prNhipMayIn(false);                                  // tắt vòng 5 giây, khỏi nhiễu ca sau
    const el = document.getElementById("prMayChip");
    return { chu: el.textContent, lop: el.className };
  };
  ra.ok = await thu({ co: true, tre: 1500, ro: false, chan: false, canh: false, chu: "sẵn sàng", job: 0 });
  ra.hetGiay = await thu({ co: true, tre: 2000, ro: false, chan: true, canh: false, chu: "HẾT GIẤY", job: 2 });
  ra.ganHet = await thu({ co: true, tre: 2000, ro: false, chan: false, canh: true, chu: "gần hết giấy", job: 0 });
  ra.cu = await thu({ co: true, tre: 300000, ro: true, chan: false, canh: false, chu: "sẵn sàng", job: 0 });
  ra.chuaCo = await thu({ co: false });
  prGoiGas = goc;
  return ra;
});
kiem("Chip máy in: sẵn sàng thì xanh, HẾT GIẤY thì đỏ",
  /sẵn sàng/.test(chipMay.ok.chu) && /pp-ok/.test(chipMay.ok.lop) &&
  /HẾT GIẤY/.test(chipMay.hetGiay.chu) && /pp-bad/.test(chipMay.hetGiay.lop),
  chipMay.ok.chu + " · " + chipMay.hetGiay.chu);
kiem("Chip máy in: gần hết giấy chỉ CẢNH BÁO (vàng), không đỏ",
  /pp-warn/.test(chipMay.ganHet.lop), chipMay.ganHet.chu);
kiem("Chip máy in nói rõ khi SỐ LIỆU ĐÃ CŨ (agent có thể đã tắt) — không dám báo \"sẵn sàng\"",
  /cũ/.test(chipMay.cu.chu) && !/pp-ok/.test(chipMay.cu.lop), chipMay.cu.chu);
kiem("Chưa có số liệu nào thì nói \"chưa rõ\", không đoán bừa",
  /chưa rõ/.test(chipMay.chuaCo.chu), chipMay.chuaCo.chu);

/* TÊN THIẾT BỊ (21/08/2026): hàng đợi ghi "đợt tem của ai" — trước đây là `may-oth9uh70@hasaki.vn`,
   với người đọc thì vô nghĩa. Nay gửi tên thiết bị người tự đặt. */
const tenMay = await page.evaluate(async () => {
  const truoc = ndsTenMay();
  localStorage.setItem("nds-ten-may", "Xiaomi 13");
  prVeTenMay();
  window.__goi = [];
  const goc = prGoiGas;
  prGoiGas = async (b) => { window.__goi.push(b); return { status: "success", id: "PRTEST3", trangThai: "xong" }; };
  prIn();
  await new Promise((r) => setTimeout(r, 400));
  prGoiGas = goc;
  const b = window.__goi.filter((x) => x.action === "pr_them")[0] || {};
  return { doan: truoc, ten: ndsTenMay(), nut: document.getElementById("prTenMay").textContent,
    nguoi: b.nguoi, may: b.may };
});
kiem("Đặt tên thiết bị: hàng đợi nhận đúng tên đó, không phải chuỗi may-xxxx",
  tenMay.nguoi === "Xiaomi 13" && /@hasaki\.vn$/.test(String(tenMay.may || "")),
  "nguoi=\"" + tenMay.nguoi + "\" · danh tính kỹ thuật vẫn gửi riêng: " + tenMay.may);
kiem("Nút tên thiết bị hiện đúng tên đang dùng", /Xiaomi 13/.test(tenMay.nut), tenMay.nut);
/* Tên thiết bị phải ở ĐẦU pop-up, chôn cứng bìa phải cùng hàng với tiêu đề (yêu cầu 21/08/2026) —
   không lẫn giữa mấy nút ở chân, vì nó là danh tính chứ không phải một điều khiển của việc in. */
const viTriTen = await page.evaluate(() => {
  const b = document.getElementById("prTenMay");
  const hd = document.querySelector("#prmodal .modalhd");
  const mt = document.querySelector("#prmodal .modalhd .mt");
  const x = document.querySelector("#prmodal .mclose");
  const rb = b.getBoundingClientRect(), rh = hd.getBoundingClientRect(), rm = mt.getBoundingClientRect();
  return { trongDau: !!b.closest(".modalhd"), cungHang: Math.abs(rb.top - rm.top) < 26,
    beNPhai: rb.right >= rh.right - 90, truocNutX: !!x && rb.right <= x.getBoundingClientRect().left + 2,
    trongChan: !!b.closest(".prfoot") };
});
kiem("Tên thiết bị nằm ở ĐẦU pop-up, cùng hàng tiêu đề và sát bìa phải (không còn ở chân)",
  viTriTen.trongDau && !viTriTen.trongChan && viTriTen.cungHang && viTriTen.beNPhai && viTriTen.truocNutX,
  "trong đầu: " + viTriTen.trongDau + " · cùng hàng: " + viTriTen.cungHang + " · sát bìa phải: " + viTriTen.beNPhai);
kiem("Chưa đặt tên thì đoán một cái đọc được (không phải chuỗi ngẫu nhiên)",
  !!tenMay.doan && !/^may-[a-z0-9]{8}@/.test(tenMay.doan), "tên đoán: " + tenMay.doan);

/* Trả về MỘT chip 1.200 (= 1 tem) cho mấy ca dưới — ô Số tem tự do không còn (bỏ 22/08/2026). */
await page.evaluate(async () => {
  let x;
  while ((x = document.querySelector("#prBody .prchip .x"))) { x.click(); await new Promise((r) => setTimeout(r, 90)); }
  const o = document.querySelector("#prBody td.prslo input.prsl-v");
  o.value = "1200"; prGoSo(o); prCam(o);
  await new Promise((r) => setTimeout(r, 200));
});

/* Hai khổ tem trong một lượt in: phải NÓI RÕ chứ không in bừa ra sai giấy */
const lanKho = await page.evaluate(async () => {
  document.getElementById("toast").textContent = "";
  prDong();
  await new Promise((r) => setTimeout(r, 250));
  document.querySelectorAll("#ndsCards .nds-tem").forEach((b) => { if (!b.classList.contains("co")) b.click(); });
  const ks = Object.keys(PR.sel);
  PR.sel[ks[0]].mau = "t42x62"; PR.sel[ks[1]].mau = "t42x25"; prLuu();
  window.__daIn = 0; window.print = () => { window.__daIn++; };
  prIn();
  await new Promise((r) => setTimeout(r, 200));
  return { chu: document.getElementById("toast").textContent, daIn: window.__daIn, khoTem: ks.length };
});
kiem("Danh sách có 2 khổ tem khác nhau thì CHẶN in và nói rõ (không in sai giấy)",
  lanKho.daIn === 0 && /khổ tem khác nhau/i.test(lanKho.chu), lanKho.chu.slice(0, 80));

/* Áp một mẫu cho tất cả rồi bấm Xác nhận in.
   BẮT BUỘC CHẶN GỬI THẬT: `prIn` bây giờ gửi lệnh vào hàng đợi in của kho, nên nếu để `prGoiGas`
   chạy thật thì MỖI LẦN chạy bộ test là một đợt tem THẬT ra khỏi máy in — đã xảy ra 20/08/2026, hai
   con tem của "may-…@hasaki.vn" nằm trong khay mà không ai gọi in. Thay `prGoiGas` bằng bản ghi lại
   lời gọi: vẫn kiểm được đúng cái gửi đi, mà không tốn con tem nào. */
const guiDi = await page.evaluate(async () => {
  prMo();
  await new Promise((r) => setTimeout(r, 200));
  prApMau("t40x60"); prApSl(2);
  await new Promise((r) => setTimeout(r, 200));
  window.__goi = [];
  prGoiGas = async (body) => { window.__goi.push(body); return { status: "success", id: "PRTEST1", soTem: 4, truoc: 0, agentTre: 1000 }; };
  window.__daIn = 0; window.print = () => { window.__daIn++; };
  prIn();
  await new Promise((r) => setTimeout(r, 400));
  const b = window.__goi[0] || {};
  let dong = [];
  try { dong = JSON.parse(b.dong || "[]"); } catch (e) { dong = []; }
  return { soGoi: window.__goi.length, action: b.action, dong: dong, daIn: window.__daIn, tong: prTongTem() };
});
kiem("Bấm Xác nhận in = GỬI HÀNG ĐỢI của kho (không mở hộp thoại in của máy đang cầm)",
  guiDi.action === "pr_them" && guiDi.daIn === 0,
  "action=" + guiDi.action + " · window.print gọi " + guiDi.daIn + " lần");
kiem("Lệnh gửi đi mang đủ SKU, số tem từng SKU và mẫu tem",
  guiDi.dong.length > 0 && guiDi.dong.every((d) => d.sku && d.sl >= 1 && d.mau === "t40x60") &&
  guiDi.dong.reduce((x, d) => x + d.sl, 0) === guiDi.tong,
  guiDi.dong.length + " SKU · " + guiDi.dong.reduce((x, d) => x + d.sl, 0) + "/" + guiDi.tong + " tem");

/* Hàng đợi hỏng (mất mạng) thì KHÔNG được tự mở hộp thoại in — chỉ hiện THÊM nút "In bằng máy này"
   để người dùng chủ động chọn. Bấm nút đó mới dựng khung tem và gọi window.print. */
const luiLai = await page.evaluate(async () => {
  prGoiGas = async () => { throw new Error("thu nghiem: mat mang"); };
  window.__daIn = 0; window.print = () => { window.__daIn++; };
  prIn();
  await new Promise((r) => setTimeout(r, 600));
  const nutHien = document.getElementById("prBtnLui").style.display !== "none";
  const tuIn = window.__daIn;
  prInLui();
  await new Promise((r) => setTimeout(r, 300));
  return { nutHien: nutHien, tuIn: tuIn, daIn: window.__daIn, tong: prTongTem(),
    soTem: document.querySelectorAll("#prsheet .pr-tem").length,
    page: document.getElementById("prPage").textContent, coClass: document.body.classList.contains("in-tem") };
});
kiem("Gửi hàng đợi thất bại: hiện nút \"In bằng máy này\" chứ KHÔNG tự mở hộp thoại in",
  luiLai.nutHien && luiLai.tuIn === 0,
  "nút " + (luiLai.nutHien ? "hiện" : "ẩn") + " · tự in " + luiLai.tuIn + " lần");
kiem("Nút lùi in đúng số con tem + @page là khổ MỘT HÀNG GIẤY (2 tem + khe), không phải khổ 1 tem",
  luiLai.daIn === 1 && luiLai.soTem === luiLai.tong && /82mm 60mm/.test(luiLai.page) && luiLai.coClass,
  luiLai.soTem + " tem · " + luiLai.page);

/* Dọn: khung in phải sạch sau khi hộp thoại in đóng, kẻo trang khác in ra cũng thành tem */
const donSach = await page.evaluate(async () => {
  window.dispatchEvent(new Event("afterprint"));
  await new Promise((r) => setTimeout(r, 150));
  return { soTem: document.querySelectorAll("#prsheet .pr-tem").length, coClass: document.body.classList.contains("in-tem") };
});
kiem("Đóng hộp thoại in thì khung in được dọn sạch", donSach.soTem === 0 && !donSach.coClass,
  donSach.soTem + " tem còn lại");

/* Thanh chờ in chỉ thuộc tab Nhận diện SKU; danh sách KHÔNG bị mất khi ghé tab khác */
const theoTab = await page.evaluate(() => {
  prDong();
  const hien = () => !document.getElementById("prbar").classList.contains("hidden");
  const ra = {};
  ["kk", "abn", "stock", "plg", "home", "sku"].forEach((t) => { showTab(t); ra[t] = hien(); });
  return { ra, con: prSo() };
});
kiem("Thanh chờ in CHỈ hiện ở tab Nhận diện SKU",
  theoTab.ra.sku === true && !theoTab.ra.kk && !theoTab.ra.abn && !theoTab.ra.stock && !theoTab.ra.plg && !theoTab.ra.home,
  Object.keys(theoTab.ra).map((k) => k + "=" + (theoTab.ra[k] ? "hiện" : "ẩn")).join(" · "));
kiem("Đi tab khác rồi về, danh sách in vẫn còn nguyên", theoTab.con > 0, theoTab.con + " SKU");

const xoaHet = await page.evaluate(async () => { prXoaHet(); await new Promise((r) => setTimeout(r, 200));
  return { n: prSo(), bar: !document.getElementById("prbar").classList.contains("hidden"),
    nut: document.querySelectorAll("#ndsCards .nds-tem.co").length }; });
kiem("\"Xoá\" bỏ hết danh sách in và nút trên thẻ trở lại trạng thái chưa chọn",
  xoaHet.n === 0 && !xoaHet.bar && xoaHet.nut === 0, xoaHet.n + " SKU · " + xoaHet.nut + " nút còn sáng");

/* Giỏ kiểm kê và danh sách in là HAI giỏ khác nhau — không được lẫn */
const haiGio = await page.evaluate(() => {
  showTab("sku");
  document.querySelector("#ndsCards .nds-tem").click();
  const ra = { in: prSo(), kiemKe: pcCount() };
  prXoaHet();
  return ra;
});
kiem("Thêm vào danh sách in KHÔNG chạm vào giỏ kiểm kê", haiGio.in === 1 && haiGio.kiemKe === 0,
  "danh sách in " + haiGio.in + " · giỏ kiểm kê " + haiGio.kiemKe);

/* ---------- 7. Phạm vi ACTIVE / Tất cả ----------
   HAI NÚT ACTIVE|Tất cả và dòng "Top 3 · chỉ SKU đang ACTIVE" đã BỎ khỏi giao diện 20/08/2026 (yêu cầu
   user). Cờ `NDS.chiActive` vẫn còn và vẫn đổi được bằng `ndsDoiScope` — ca test đổi sang gọi hàm, và
   khoá luôn việc hai nút đó KHÔNG được quay lại (bớt chữ trên đầu Top 3 là quyết định có chủ ý). */
const scope = await page.evaluate(async () => {
  ndsDoiScope(0);
  await new Promise((r) => setTimeout(r, 400));
  const ra = { chi: NDS.chiActive, conNut: !!document.getElementById("ndsScopeAll") || !!document.getElementById("ndsScopeA"),
    conHint: !!document.getElementById("ndsResHint"), soThe: document.querySelectorAll("#ndsCards .nds-card").length };
  ndsDoiScope(1);
  await new Promise((r) => setTimeout(r, 400));
  ra.veLai = NDS.chiActive;
  return ra;
});
kiem("Đổi phạm vi vẫn chạy bằng cờ (hai nút ACTIVE|Tất cả đã bỏ khỏi giao diện)",
  scope.chi === false && scope.veLai === true && !scope.conNut && !scope.conHint && scope.soThe > 0,
  "chiActive false→true · còn nút: " + scope.conNut + " · còn dòng hint: " + scope.conHint + " · " + scope.soThe + " thẻ");

/* ---------- 8. NGOẠI LỆ: AI trả lỗi (hết hạn mức) ---------- */
traLoi = AI_LOI;
await bam("#ndsBtnDoc");
await new Promise((r) => setTimeout(r, 1200));
const toast1 = await page.$eval("#toast", (e) => ({ hien: e.classList.contains("show"), chu: e.textContent, kieu: e.className }));
const conTag = await page.$$eval("#ndsTags .nds-tag", (a) => a.length);
kiem("AI lỗi: hiện toast lỗi, KHÔNG mất từ khoá đang có", toast1.hien && /hạn mức/i.test(toast1.chu) && conTag > 0,
  toast1.chu.slice(0, 70));

/* ---------- 9. NGOẠI LỆ: mất mạng giữa lúc gọi AI ---------- */
await page.evaluate(() => { var t=document.getElementById("toast"); t.textContent=""; t.classList.remove("show"); });   // xoá toast cũ: không thì ca này pass nhờ thông báo của ca trước
await page.setOfflineMode(true);
await bam("#ndsBtnDoc");
await new Promise((r) => setTimeout(r, 1500));
const toast2 = await page.$eval("#toast", (e) => e.textContent);
const conThe = await page.$$eval("#ndsCards .nds-card", (a) => a.length);
kiem("Mất mạng: báo lỗi rõ ràng, kết quả cũ vẫn còn để làm việc", /không đọc được tem|failed|network|mạng/i.test(toast2) && conThe > 0,
  toast2.slice(0, 70));
await page.setOfflineMode(false);

/* ---------- 10. NGOẠI LỆ: AI không bóc được từ khoá nào (ảnh mờ/tem rách) ---------- */
traLoi = { status: "success", model: "gemini(giả)", quality: "khong_doc_duoc",
  tokens: { item_codes: [], specs: [], colors: [], brands: [], others: [] }, text: "" };
await page.evaluate(() => ndsXoaHet());
await bam("#ndsBtnDoc");
await new Promise((r) => setTimeout(r, 1200));
const toast3 = await page.$eval("#toast", (e) => e.textContent);
kiem("Ảnh không đọc được: nói thẳng + hướng người dùng gõ tay", /không bóc được|khó đọc/i.test(toast3), toast3.slice(0, 80));

/* ---------- 11. Offline hoàn toàn: danh mục lấy từ cache máy ---------- */
await page.evaluate(() => { NDS.ds = null; NDS.cm = null; NDS.loadedOnce = false; });
await page.setOfflineMode(true);
const lanHai = await page.evaluate(async () => { await ndsTaiDanhMuc(false); return NDS.ds ? NDS.ds.length : 0; });
kiem("Mất mạng vẫn đối soát được nhờ danh mục cache trong máy", lanHai > 1000, lanHai + " SKU từ cache");
await page.setOfflineMode(false);

/* ---------- 12. Bố cục điện thoại + rời tab tắt camera ---------- */
await page.setViewport({ width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 });
await new Promise((r) => setTimeout(r, 600));
/* ---------- 12. BẬC THANG OCR ↔ AI (19/08/2026) ----------------------------------------------
   Hợp đồng của tầng OCR: (a) đọc được mã có thật trong danh mục thì DỪNG, không tiêu một lượt AI
   nào; (b) không lập được mã thì TỰ leo thang sang AI; (c) OCR chết cũng leo thang, không để thủ
   kho đứng nhìn màn hình trống — đây đúng là ca "không có kết quả nào" mà thủ kho báo 19/08/2026. */
const datAnhMoi = async () => {
  await page.evaluate(() => {
    ndsXoaHet();
    var c = document.createElement("canvas"); c.width = 620; c.height = 400;
    var x = c.getContext("2d");
    x.fillStyle = "#fff"; x.fillRect(0, 0, 620, 400);
    x.fillStyle = "#111"; x.font = "bold 28px Arial"; x.fillText("YKK 8846295", 36, 84);
    x.font = "20px Arial"; x.fillText("38.0 CM  ·  345", 36, 140);
    ndsDatAnh(c.toDataURL("image/jpeg", 0.9));
  });
  await page.waitForFunction(() => !NDS.tuDong && !NDS.dangDoc, { timeout: 40000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 400));
};

await bam("#ttSku");
traLoi = AI_GIAY_TO; traLoiOcr = OCR_OK; soGoiOcr = 0; soGoiAi = 0;
await datAnhMoi();
const sauAi = await page.evaluate(() => ({
  the: document.querySelectorAll("#ndsCards .nds-card").length,
  sku: (document.querySelector("#ndsCards .nds-sku") || {}).textContent || "",
  nguon: (window.NDS.tokens || []).map((t) => t.nguon).filter((v, i, a) => a.indexOf(v) === i).join(","),
  raw: (document.getElementById("ndsRaw") || {}).value || "",
  boRac: NDS.boRac || 0,
}));
kiem("AI lập được mã có thật → ra SKU luôn và KHÔNG gọi OCR lượt nào (tiết kiệm 6 giây)",
  soGoiAi === 1 && soGoiOcr === 0 && sauAi.the > 0,
  soGoiAi + " lượt AI · " + soGoiOcr + " lượt OCR · " + sauAi.the + " gợi ý · #1 = " + sauAi.sku.trim());
kiem("Chữ thô của AI cũng được tách (ghép 2 nguồn: vai AI + chữ thô)", /chu/.test(sauAi.nguon), sauAi.nguon);
kiem("Chữ đọc được đưa vào ô \"chữ trên tem\" để sửa được", /8846295/.test(sauAi.raw), sauAi.raw.slice(0, 40));
kiem("Bỏ mảnh GIẤY TỜ không có trong danh mục (địa chỉ · số PO · ngày · cân nặng)", sauAi.boRac >= 3,
  "bỏ " + sauAi.boRac + " mảnh");
const chanRac = await page.$eval("#ndsFoot", (e) => e.textContent.replace(/⟳|Tải lại danh mục|Xoá sổ tay/g, "").trim());
kiem("Dòng chân vẫn KHÔNG chèn thông báo nào sau khi đọc tem", chanRac === "", "chữ còn lại: \"" + chanRac + "\"");

/* ĐẢO CỰC 20/08/2026 (yêu cầu user): dải "N gợi ý dưới đây đều mang đúng mã X — chỉ khác nhau ở
   màu / thông số…" đã BỎ HẲN. Nó chiếm 3 dòng ngay trên Top 3 để nói một việc mà 3 thẻ đã nói rõ
   hơn (phần tô .highlight-match giống nhau, chỗ khác nhau là chữ màu không được tô). Ca test giữ
   lại nhưng đổi chiều: nếu chuỗi đó quay về là có người khôi phục mà không đọc quyết định này.
   Kèm kiểm KHÔNG chừa khoảng trống: thẻ #1 phải là phần tử đầu tiên trong #ndsCards. */
const canhMau = await page.evaluate(() => {
  const c = document.getElementById("ndsCards") || {};
  const dau = c.firstElementChild;
  return { con: ((c.textContent || "").indexOf("đều mang đúng mã") >= 0),
    dauLaThe: !!dau && dau.classList.contains("nds-card"),
    tren: dau ? Math.round(parseFloat(getComputedStyle(dau).marginTop) || 0) : -1 };
});
kiem("Dải cảnh báo 'cùng mã, khác màu' đã bỏ — Top 3 không bị đẩy xuống",
  !canhMau.con && canhMau.dauLaThe && canhMau.tren === 0,
  "còn dải: " + canhMau.con + " · phần tử đầu là thẻ: " + canhMau.dauLaThe + " · margin-top: " + canhMau.tren + "px");

/* AI đọc được chữ nhưng KHÔNG lập được mã nào có thật → phải tự tụt xuống OCR (miễn phí) */
traLoi = AI_KHONG_MA; traLoiOcr = OCR_OK; soGoiOcr = 0; soGoiAi = 0;
await datAnhMoi();
const sauLeo = await page.evaluate(() => document.querySelectorAll("#ndsCards .nds-card").length);
kiem("AI không lập được mã → TỰ tụt xuống OCR (miễn phí) và OCR cứu được",
  soGoiAi === 1 && soGoiOcr === 1 && sauLeo > 0,
  soGoiAi + " lượt AI · " + soGoiOcr + " lượt OCR · " + sauLeo + " gợi ý");

/* ĐÚNG CA THỦ KHO BÁO 19/08/2026: "không có kết quả nào" = AI hết hạn mức / trả JSON sai khuôn.
   Đây là lý do giữ OCR trong bậc thang dù nó chậm hơn: nó không dùng hạn mức nào. */
traLoi = AI_LOI; traLoiOcr = OCR_OK; soGoiOcr = 0; soGoiAi = 0;
await page.evaluate(() => {
  const t = document.getElementById("toast"); t.textContent = ""; t.classList.remove("show");
  /* 29/08/2026 — CANARY: ghi lại MỌI toast của lượt này để kiểm câu "AI đọc tem không chạy" (toast sau
     đè toast trước nên chỉ đọc textContent cuối cùng là không thấy). */
  window.__toasts = []; NDS.aiTat = "";
  if (!window.__toastGoc) { window.__toastGoc = window.toast; window.toast = function (m, t) { (window.__toasts || []).push(String(m)); return window.__toastGoc.apply(this, arguments); }; }
});
await datAnhMoi();
const canary = await page.evaluate(() => (window.__toasts || []).filter((m) => /AI đọc tem không chạy/.test(m)).length);
kiem("AI chết vì lý do máy chủ (hết hạn mức) → báo MỘT lần \"AI đọc tem không chạy\" (canary), không im lặng",
  canary === 1, canary + " lần báo · toasts: " + (await page.evaluate(() => (window.__toasts || []).map((m) => m.slice(0, 40)).join(" | "))));
const sauCuu = await page.evaluate(() => ({
  the: document.querySelectorAll("#ndsCards .nds-card").length,
  nguon: (window.NDS.tokens || []).map((t) => t.nguon).filter((v, i, a) => a.indexOf(v) === i).join(","),
}));
kiem("AI hết hạn mức → OCR CỨU, vẫn ra kết quả (đúng ca \"không có kết quả nào\")",
  soGoiAi === 1 && soGoiOcr === 1 && sauCuu.the > 0,
  soGoiAi + " lượt AI · " + soGoiOcr + " lượt OCR · " + sauCuu.the + " gợi ý · nguồn " + sauCuu.nguon);

/* Cả hai người đọc đều hỏng → mới được quăng lỗi, và phải chỉ sang đường KHÔNG CẦN MẠNG (gõ mã) */
traLoi = AI_LOI; traLoiOcr = OCR_LOI; soGoiOcr = 0; soGoiAi = 0;
await page.evaluate(() => { const t = document.getElementById("toast"); t.textContent = ""; t.classList.remove("show"); });
await datAnhMoi();
const baoHong = await page.$eval("#toast", (e) => e.textContent);
kiem("Cả AI lẫn OCR hỏng → nói thẳng một lần + chỉ sang ô gõ mã",
  soGoiAi === 1 && soGoiOcr === 1 && /gõ mã in trên tem/i.test(baoHong),
  soGoiAi + " AI · " + soGoiOcr + " OCR · toast: " + baoHong.slice(0, 64));

/* Hộp "đang đọc" (đổi 28/08/2026 chiều — user chọn "random A, B, D" sau demo 7 phương án): ICON
   BRAINSTORM đứng GIỮA khung + mỗi lượt rút NGẪU NHIÊN một trong 3 hiệu ứng (sóng não · quỹ đạo ý
   tưởng · tự vẽ nét). Không rút được 4–8 giây của Google, nhưng phải cho thấy máy đang làm chứ không
   treo. Đo:
     · 12 lượt mở liên tiếp: mỗi lượt là 1 trong 3 hiệu ứng, có ĐỦ phần riêng của nó (bản sao nếp não
       .syn / 3 vòng .nds-ring / pathLength=100 trên mọi nét), không lặp lượt kề (ngẫu nhiên mà 3 lượt
       giống nhau thì người dùng tưởng không đổi);
     · ép từng hiệu ứng qua NDS.epHieuUng — cả 3 đều dựng được (bộ đo điện thoại dùng đúng đường này);
     · icon nằm ĐÚNG GIỮA khung (lệch tâm ≤2px), không chữ, không số (giây vẫn ghi ở data-giay);
     · quá 12 giây thì đổi màu cảnh báo (mốc "mạng yếu" cũ, chỉ đổi cách nói); tắt là sạch. */
traLoi = AI_OK; traLoiOcr = OCR_OK;
const vongCho = await page.evaluate(async () => {
  const doc = (id) => document.getElementById(id);
  const cho = (ms) => new Promise((r) => setTimeout(r, ms));
  const rieng = (box, ic, h) => h === "song" ? ic.querySelectorAll(".syn").length >= 2
    : h === "quydao" ? box.querySelectorAll(".nds-ring").length === 3
    : h === "tuve" ? [...ic.querySelectorAll("path")].every((p) => p.getAttribute("pathLength") === "100") : false;
  const chuoi = [], loi = [];
  for (let i = 0; i < 12; i++) {
    NDS.epHieuUng = null; ndsBusy(true, "đang thử"); await cho(20);
    const box = doc("ndsBusyBox"), ic = doc("ndsBrain");
    if (!box || !ic) { loi.push("lượt " + i + ": không có hộp/icon"); ndsBusy(false); continue; }
    const h = box.getAttribute("data-hieu-ung"); chuoi.push(h);
    if (!rieng(box, ic, h)) loi.push("lượt " + i + ": " + h + " thiếu phần riêng");
    if (!box.classList.contains("hu-" + h)) loi.push("lượt " + i + ": thiếu class hu-" + h);
    ndsBusy(false);
  }
  const lapKe = chuoi.some((h, i) => i > 0 && h === chuoi[i - 1]);
  const ep = {};
  for (const h of ["song", "quydao", "tuve"]) {
    NDS.epHieuUng = h; ndsBusy(true); await cho(20);
    const box = doc("ndsBusyBox"), ic = doc("ndsBrain");
    ep[h] = !!box && box.getAttribute("data-hieu-ung") === h && rieng(box, ic, h);
    ndsBusy(false);
  }
  NDS.epHieuUng = null;
  ndsBusy(true, "đang thử"); await cho(300);
  const box = doc("ndsBusyBox"), ic = doc("ndsBrain");
  const b = box.getBoundingClientRect(), r = ic.getBoundingClientRect();
  const lechTam = [Math.round((r.left + r.width / 2) - (b.left + b.width / 2)), Math.round((r.top + r.height / 2) - (b.top + b.height / 2))];
  await cho(900);
  const chu = box.textContent.trim(), giay = box.getAttribute("data-giay");
  const svgOk = ic.querySelectorAll("svg path").length >= 5;
  /* Mốc "mạng yếu": KHÔNG chờ thật 12 giây — đẩy đồng hồ của trang lên 13 giây rồi đợi một nhịp.
     Đây là đo ĐÚNG luật đang chạy (ngưỡng 12 trong `ndsBusy`), không phải cắm cờ giả cho test. */
  const goc = Date.now;
  Date.now = () => goc.call(Date) + 13000;
  await cho(520);   // đủ cho nhịp 100ms + transition màu 350ms
  const lau = box.classList.contains("lau");
  const mauLau = getComputedStyle(ic).color;
  Date.now = goc;
  await cho(520);
  const mauThuong = getComputedStyle(ic).color;
  ndsBusy(false);
  return { chuoi, soLoai: new Set(chuoi).size, lapKe, loi, ep, lechTam, chu, giay, svgOk, lau, mauLau, mauThuong,
    khung: Math.round(b.width) + "×" + Math.round(b.height),
    conSau: !!doc("ndsBusyBox") || !!doc("ndsBrain"), conVong: !!doc("ndsVong") || !!document.querySelector(".nds-cho") };
});
kiem("Hộp \"đang đọc\": icon brainstorm (nét SVG) đứng GIỮA khung, rút NGẪU NHIÊN 1/3 hiệu ứng (sóng não · quỹ đạo · tự vẽ), 12 lượt không lặp kề, ép được cả 3, không chữ, không số",
  vongCho.svgOk && vongCho.soLoai >= 2 && !vongCho.lapKe && vongCho.loi.length === 0 &&
  vongCho.ep.song && vongCho.ep.quydao && vongCho.ep.tuve &&
  Math.abs(vongCho.lechTam[0]) <= 2 && Math.abs(vongCho.lechTam[1]) <= 2 &&
  vongCho.chu === "" && !vongCho.conVong && Number(vongCho.giay) > 1 && !vongCho.conSau,
  "12 lượt: " + vongCho.chuoi.join(">") + " · lặp kề: " + vongCho.lapKe + " · ép: " + JSON.stringify(vongCho.ep) +
  " · lệch tâm " + vongCho.lechTam.join("/") + "px · khung " + vongCho.khung + " · chữ: \"" + vongCho.chu +
  "\" · data-giay " + vongCho.giay + " · tắt sạch: " + !vongCho.conSau + (vongCho.loi.length ? " · LỖI: " + vongCho.loi.join("; ") : ""));
kiem("Quá 12 giây → icon ngả màu cảnh báo (mốc \"mạng yếu\" cũ, nói bằng màu thay vì bằng số)",
  vongCho.lau && vongCho.mauLau !== vongCho.mauThuong,
  "13s: " + vongCho.mauLau + " · bình thường: " + vongCho.mauThuong);

/* ---------- 12b. TIẾT KIỆM THỜI GIAN CHỜ (19/08/2026) ----------------------------------------
   Ba việc đo được: nén ảnh ĐÚNG MỘT LẦN cho mỗi tấm (dù bậc thang dùng 2 người đọc), ảnh gửi lên
   không vượt ngân sách byte, và có lượt HÂM NÓNG Apps Script (chống lượt đầu vào instance nguội —
   đo thật có lượt 28,5s mà chỉ 1 POST, tức không phải thử lại). */
kiem("Có hâm nóng Apps Script khi mở tab (không ảnh, không tốn hạn mức)", soGoiHam >= 1, soGoiHam + " lượt hâm nóng");
traLoi = AI_KHONG_MA; traLoiOcr = OCR_OK;      // buộc bậc thang dùng CẢ HAI người đọc trên cùng 1 ảnh
await page.evaluate(() => {
  window.__soNen = 0;
  const goc = window.ndsNenAnh;
  window.ndsNenAnh = function () { window.__soNen++; return goc.apply(this, arguments); };
});
soGoiAi = 0; soGoiOcr = 0;
await datAnhMoi();
const nenSo = await page.evaluate(() => ({ so: window.__soNen, tran: window.NDS_TRAN_B64, webp: ndsWebpOk() }));
/* 29/08/2026: AI xin WebP, OCR xin JPEG cho cùng tấm ⇒ máy mã hoá được WebP thì nén ĐÚNG 2 lần (mỗi
   định dạng một lần), không thì 1; lượt đua/thử lại KHÔNG được nén lại. */
kiem("Mỗi định dạng chỉ nén MỘT lần (AI WebP + OCR JPEG), lượt đua không nén lại",
  soGoiAi === 1 && soGoiOcr === 1 && nenSo.so === (nenSo.webp ? 2 : 1),
  soGoiAi + " AI · " + soGoiOcr + " OCR · " + nenSo.so + " lần nén · máy mã hoá WebP: " + nenSo.webp);
kiem("Ảnh gửi AI là WebP khi máy mã hoá được (không thì JPEG); ảnh gửi OCR luôn JPEG",
  mimeAI === (nenSo.webp ? "image/webp" : "image/jpeg") && mimeOCR === "image/jpeg",
  "AI " + mimeAI + " · OCR " + mimeOCR);
const coWebp = await page.evaluate(async () => {
  const w = await ndsNenSan(NDS_MAX_CANH, "image/webp"), j = await ndsNenSan(NDS_MAX_CANH, "image/jpeg");
  return { w: w.b64.length, j: j.b64.length, mw: w.mime, mj: j.mime, webp: ndsWebpOk() };
});
kiem("WebP nhẹ hơn JPEG trên cùng tấm ảnh (máy không mã hoá được thì trả JPEG đúng nhãn)",
  coWebp.webp ? (coWebp.mw === "image/webp" && coWebp.w < coWebp.j) : (coWebp.mw === "image/jpeg"),
  "WebP " + Math.round(coWebp.w * 0.75 / 1024) + "KB · JPEG " + Math.round(coWebp.j * 0.75 / 1024) + "KB");
/* 29/08/2026: bật camera = sắp gửi ảnh thật → hâm nóng Apps Script (miễn phí), giãn cách 75s. Headless
   không có camera nên getUserMedia sẽ hỏng — hâm nóng phải bắn TRƯỚC khi xin quyền mới đúng ý. */
const hamTruoc = soGoiHam;
await page.evaluate(() => { NDS.hamLuc = 0; });
await bam("#ndsBtnCam");
await new Promise((r) => setTimeout(r, 500));
await bam("#ndsBtnCam");                       // bấm lại ngay: nằm trong giãn cách → KHÔNG bắn thêm
await new Promise((r) => setTimeout(r, 300));
kiem("Bật camera là hâm nóng Apps Script MỘT lượt; bấm lại trong 75s không bắn thêm",
  soGoiHam === hamTruoc + 1, (soGoiHam - hamTruoc) + " lượt hâm nóng khi bật camera");
const kbGui = await page.evaluate(async () => {
  const a = await ndsNenSan(NDS_MAX_CANH);
  return { b64: a.b64.length, kb: Math.round(a.b64.length * 0.75 / 1024), tran: NDS_TRAN_B64 };
});
kiem("Ảnh gửi lên không vượt ngân sách byte (thời gian đẩy ảnh trên 4G)",
  kbGui.b64 <= kbGui.tran, kbGui.kb + "KB (" + kbGui.b64 + " ≤ " + kbGui.tran + " ký tự base64)");

/* ---------- 13. ẢNH MỚI = LƯỢT MỚI (sự cố 19/08/2026) ----------------------------------------
   Thủ kho báo: chụp tem mới nhưng từ khoá tem CŨ vẫn còn và vẫn tính điểm (mã `C3968` của lượt
   trước), ô "Phần tử trên tem" vẫn giữ chữ cũ, sổ tay trộn token hai lượt nên gợi ý SKU cũ, điểm
   bị cào bằng (nhiều dòng cùng 75%). Cụm này khoá cả 4 mặt của lỗi đó. */
const AI_TEM_A = {
  status: "success", model: "gemini(giả)", quality: "ro",
  tokens: { item_codes: ["C3968"], specs: ["Tex 27"], colors: [], brands: ["COATS"], others: [] },
  text: "COATS C3968 Tex 27",
};
const AI_TEM_B = {
  status: "success", model: "gemini(giả)", quality: "ro",
  tokens: { item_codes: ["8209948"], specs: ["18.0 CM"], colors: ["366"], brands: ["YKK"], others: [] },
  text: "YKK 8209948 CHC-36 | Chiều dài: 18.0 CM | Màu: 366",
};
traLoi = AI_TEM_A; traLoiOcr = OCR_OK;
await datAnhMoi();
/* Người dùng còn gõ thêm mảnh vào ô "Phần tử trên tem" cho tem A -> NDS.loc có giá trị */
await page.evaluate(() => { document.getElementById("ndsMa").value = "polyester"; ndsTraMa(); });
await new Promise((r) => setTimeout(r, 600));
const truocB = await page.evaluate(() => ({
  tokens: NDS.tokens.map((t) => t.t).join(","), loc: (NDS.loc || []).join(","),
  ma: document.getElementById("ndsMa").value,
}));
kiem("Dựng được hiện trạng của tem A (có từ khoá + có mảnh đã gõ)",
  /c3968/.test(truocB.tokens) && truocB.loc.length > 0, "tokens: " + truocB.tokens.slice(0, 50) + " · loc: " + truocB.loc);

traLoi = AI_TEM_B; soGoiAi = 0; soGoiOcr = 0;
await datAnhMoi();                                        // ẢNH MỚI
const sauB = await page.evaluate(() => ({
  tokens: NDS.tokens.map((t) => t.t).join(","),
  loc: NDS.loc, ma: document.getElementById("ndsMa").value, raw: document.getElementById("ndsRaw").value,
  rawDaTach: NDS.rawDaTach, daBo: Object.keys(NDS.daBo || {}).length, maVach: (NDS.maVach || []).length,
  sku1: ((document.querySelector("#ndsCards .nds-sku") || {}).textContent || "").trim(),
  /* Đọc % ở ĐÚNG phần tử .nds-pct — bắt bằng regex trên textContent của cả thẻ thì nó ngoạm luôn
     mã SKU (9 chữ số) rồi ca test pass oan vì "142230880697 >= 80". */
  pct: Array.from(document.querySelectorAll("#ndsCards .nds-pct")).map((e) => parseInt(e.textContent, 10)).join(","),
}));
kiem("Ảnh mới KHÔNG còn từ khoá của ảnh cũ (mã C3968 phải biến mất)",
  !/c3968/.test(sauB.tokens) && /8209948/.test(sauB.tokens), sauB.tokens.slice(0, 60));
kiem("Ảnh mới dọn sạch ô \"Phần tử trên tem\" + mảnh lọc (đây là thứ làm điểm cào bằng 75%)",
  sauB.ma === "" && !sauB.loc, "ô: \"" + sauB.ma + "\" · loc: " + JSON.stringify(sauB.loc));
kiem("Ảnh mới dọn sạch ô chữ trên tem + bộ nhớ 'đã bỏ' + mã vạch cũ",
  /8209948/.test(sauB.raw) && !/C3968/.test(sauB.raw) && sauB.daBo === 0 && sauB.maVach === 0,
  "raw: " + sauB.raw.slice(0, 40) + " · daBo " + sauB.daBo + " · mã vạch " + sauB.maVach);
kiem("Kết quả là của tem MỚI và điểm là điểm khớp (không phải độ phủ mảnh cũ)",
  sauB.sku1 === "422308806" && Number(sauB.pct.split(",")[0]) >= 80,
  "#1 " + sauB.sku1 + " · các mức điểm: " + sauB.pct);

/* SỔ TAY: học SKU cho tem A rồi chụp tem B — không được ghim SKU của A sang B (token đã trộn thì
   chữ ký tem cũng trộn, đó là gốc của "gợi ý sai SKU cũ"). */
traLoi = AI_TEM_A;
await datAnhMoi();
await page.evaluate(() => { try { localStorage.removeItem("nds-so-v1"); } catch (e) {} });
await datAnhMoi();
const skuA = await page.evaluate(() => {
  const t = document.querySelector("#ndsCards .nds-card");
  if (t) t.click();
  return ((document.querySelector("#ndsCards .nds-sku") || {}).textContent || "").trim();
});
await new Promise((r) => setTimeout(r, 300));
traLoi = AI_TEM_B;
await datAnhMoi();
const hocLan = await page.evaluate(() => ({
  sku1: ((document.querySelector("#ndsCards .nds-sku") || {}).textContent || "").trim(),
  daHoc: !!(NDS.ket && NDS.ket[0] && NDS.ket[0].daHoc),
  soKhoa: (typeof ndsSoKhoa === "function" ? ndsSoKhoa() : []).join(" | "),
}));
kiem("Sổ tay KHÔNG trộn token giữa 2 lượt quét (tem B không bị ghim SKU của tem A)",
  hocLan.sku1 === "422308806" && !hocLan.daHoc && hocLan.soKhoa.indexOf("c3968") < 0,
  "đã học tem A = " + skuA + " · #1 của tem B = " + hocLan.sku1 + (hocLan.daHoc ? " (BỊ GHIM)" : "") +
  " · khoá sổ hiện tại: " + hocLan.soKhoa.slice(0, 60));

/* LƯỢT CŨ TRẢ VỀ MUỘN: chụp tem A (mạng chậm) rồi chụp ngay tem B — phản hồi của A về sau KHÔNG
   được rơi vào tem B. Đây là ca "dữ liệu ảnh quét trước" khó thấy nhất vì phụ thuộc nhịp mạng. */
traLoi = AI_TEM_A; treGas = 2500; soGoiAi = 0;
await page.evaluate(() => {
  const c = document.createElement("canvas"); c.width = 600; c.height = 380;
  const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, 600, 380);
  x.fillStyle = "#111"; x.font = "bold 30px Arial"; x.fillText("COATS C3968", 30, 90);
  ndsDatAnh(c.toDataURL("image/jpeg", 0.9));
});
await new Promise((r) => setTimeout(r, 500));            // để lượt của tem A bay đi
traLoi = AI_TEM_B; treGas = 0;
await datAnhMoi();                                        // tem B chen ngang
await new Promise((r) => setTimeout(r, 3200));            // chờ luôn cả phản hồi muộn của tem A
const sauTre = await page.evaluate(() => ({
  tokens: NDS.tokens.map((t) => t.t).join(","),
  sku1: ((document.querySelector("#ndsCards .nds-sku") || {}).textContent || "").trim(),
}));
kiem("Phản hồi ĐẾN MUỘN của ảnh cũ bị bỏ, không rơi vào ảnh mới",
  !/c3968/.test(sauTre.tokens) && sauTre.sku1 === "422308806",
  "#1 " + sauTre.sku1 + " · tokens " + sauTre.tokens.slice(0, 56));

/* Quay lại tab Nhận diện SKU trước khi đo: getComputedStyle vẫn trả giá trị grid dù phần tử đang
   bị ẩn, nên nếu không kiểm "đang hiện thật" thì ca này pass cả khi trang đứng ở tab khác. */
await bam("#ttSku");
await new Promise((r) => setTimeout(r, 500));
const tran = await page.evaluate(() => {
  const v = document.getElementById("viewNds");
  return {
    hien: !v.hidden && v.offsetWidth > 0,
    ngang: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    cot: getComputedStyle(document.querySelector(".nds-grid")).gridTemplateColumns.split(" ").length,
  };
});
const nut = await page.evaluate(() => {
  /* Hàng .nds-ctl (3 nút đọc) đã BỎ HIỂN THỊ 22/08/2026 — cụm control còn lại của tab là thanh
     TRONG khung camera (.nds-tools: Bật camera · Chọn ảnh · ⟲ · ⟳); đo cụm đó thay vì cái đã ẩn
     (đo hàng ẩn thì 0 nút và min() ra vô nghĩa). */
  const c = document.querySelector(".nds-tools");
  /* BỎ QUA nút đang ẩn: phần tử hidden trả rect 0×0 ở toạ độ (0,0) nên luôn bị tính là "tràn" */
  const bs = Array.from(c.querySelectorAll("button")).filter((b) => b.offsetParent !== null)
    .map((b) => b.getBoundingClientRect());
  const cr = c.getBoundingClientRect();
  return { tran: bs.some((b) => b.right > cr.right + 1 || b.left < cr.left - 1),
    thap: Math.round(Math.min.apply(null, bs.map((b) => b.height))), n: bs.length };
});
/* 20/08/2026 (yêu cầu user): NHÃN "lệch …" phải nằm CÙNG HÀNG với "N từ khoá khớp · N đơn vị khác",
   không được đẩy xuống dòng chừa dải trống. Dựng thẻ bằng cách gọi thẳng hàm vẽ (không phụ thuộc tem
   nào đang cho ra xung đột) rồi đo trên máy 390px — chỗ chật nhất. */
const mtDong = await page.evaluate(() => {
  const html = ndsTheKetQua({ sku: "422322192", pn: "Dây kéo cước thuận #3/8846295_YKK/100% Polyester/None/Soft Citrus-(Vàng nhạt)-345/Size 3/38cm/pcs",
    type: "NORMAL", status: "ACTIVE", qty: 12, donVi: "pcs", dv: "pcs", q: 1, pct: 88, diem: 0.88,
    khop: { code: ["8846295"], spec: ["38cm"], color: ["345"], brand: ["ykk"] }, xungDot: ["mamau", "tex"],
    bienThe: [{ sku: "422322216", donVi: "mm", status: "ACTIVE", qty: 5, q: 0.001 }] }, 1);
  const d = document.createElement("div"); d.className = "nds-cards";
  document.getElementById("ndsCards").parentNode.appendChild(d); d.innerHTML = html;
  const sum = d.querySelector("details.nds-more>summary");
  const t = sum && sum.querySelector(".nds-sumt"), l = sum && sum.querySelector(".nds-lech");
  const st = sum ? getComputedStyle(sum) : {};
  const a = t && t.getBoundingClientRect(), b = l && l.getBoundingClientRect(), c = sum && sum.getBoundingClientRect();
  const ra = { co: !!(t && l), flex: st.display, canh: st.justifyContent, doc: st.alignItems,
    cungHang: !!(a && b) && Math.abs(a.top - b.top) < 6,
    lechPhai: !!(a && b) && b.left >= a.right - 1,
    caoDong: c ? Math.round(c.height) : -1, tran: !!(b && c) && b.right > c.right + 1,
    chu: (l && l.textContent.trim()) || "", dauCon: d.querySelector(".nds-chead .nds-lech") ? "CÒN" : "sạch" };
  d.remove();
  return ra;
});
/* Từ 20/08/2026 hàng này giữ BA thứ (chữ tóm tắt · nhãn lệch · nút "In tem") và được phép WRAP trên
   máy hẹp — nên trần chiều cao là ĐÚNG 2 dòng (72px) — ba thứ đó không thể vừa một dòng 390px. Thứ phải giữ là "không tràn". Điều PHẢI giữ: nhãn lệch nằm cùng
   hàng với chữ tóm tắt, ở BÊN PHẢI, và không tràn khỏi thẻ. */
kiem("Điện thoại: nhãn 'lệch …' CÙNG HÀNG với 'từ khoá khớp' (flex space-between, không tràn)",
  mtDong.co && mtDong.flex === "flex" && mtDong.canh === "space-between" && mtDong.doc === "center" &&
  mtDong.cungHang && mtDong.lechPhai && !mtDong.tran && mtDong.caoDong <= 72 && mtDong.dauCon === "sạch",
  mtDong.flex + "/" + mtDong.canh + "/" + mtDong.doc + " · cùng hàng: " + mtDong.cungHang +
  " · bên phải: " + mtDong.lechPhai + " · cao " + mtDong.caoDong + "px · \"" + mtDong.chu + "\" · hàng đầu: " + mtDong.dauCon);
/* ĐIỆN THOẠI: BẢNG DANH SÁCH IN PHẢI LÀ THẺ, KHÔNG PHẢI BẢNG BÓP (20/08/2026, ảnh máy thật).
   Triệu chứng cũ: <table> 6 cột trong màn 390px làm cột "Tên sản phẩm" co còn MỘT ký tự, chữ xếp dọc
   "T ê n s ả n p h…", phải kéo ngang mới đọc. */
const inMobile = await page.evaluate(async () => {
  ndsThemToken("8846295", "code", "chu");
  NDS.ket = NDS_ENGINE.timTop(NDS_ENGINE.tuAI({ item_codes: ["8846295"], specs: [], colors: [], brands: ["YKK"] }, NDS.cm),
    NDS.cm, { soLuong: 3, chiActive: true });
  ndsVeKetQua(7);
  document.querySelectorAll("#ndsCards .nds-card .nds-tem").forEach((b) => b.click());
  await new Promise((r) => setTimeout(r, 200));
  prMo();
  await new Promise((r) => setTimeout(r, 350));
  const body = document.querySelector("#prmodal .modalbody");
  const tr = document.querySelector("#prBody tr");
  /* 5 ô, ĐÚNG thứ tự prVe bản 23/08/2026: 1 ô nhập Số lượng · 2 dải chip · 3 SKU (+ ô "Số tem") ·
     4 Tên sản phẩm · 5 nút × xoá SKU. Nhãn ::before đã BỎ HẲN — có nhãn nào mọc lại là dán sai.
     Ô lấy theo CLASS chứ không theo chỉ số con: bài học "ĐVT: 422424151" 20/08/2026 (nhãn theo
     nth-child âm thầm sai khi số cột đổi) áp cho cả bộ đo, không riêng CSS — chính lượt 23/08 này
     đổi 4 ô thành 5 ô. */
  const nhan = (el) => {
    const c = el ? String(getComputedStyle(el, "::before").content || "") : "";
    return (c === "none" || c === "normal") ? "" : c;
  };
  const q = (s) => (tr ? tr.querySelector(s) : null);
  const r = (el) => (el ? el.getBoundingClientRect() : null);
  const pn = r(q("td.pn")), sku = r(q("td.prsku"));
  const skuB = r(q("td.prsku>b"));
  const tag = r(q(".prtemso"));
  const del = r(q(".prdel"));
  const oSl = r(q("input.prsl-v"));
  const loc = document.querySelectorAll("#prmodal .mfilters .fld");
  const r1 = r(loc[0]), r2 = r(loc[1]);
  const ra = { keoNgang: body.scrollWidth - body.clientWidth,
    theLuoi: tr ? getComputedStyle(tr).display : "",
    anThead: getComputedStyle(document.querySelector("#prmodal .mtbl thead")).display,
    pnRong: pn ? Math.round(pn.width) : -1,
    pnDuoiSku: !!(pn && sku) && pn.top > sku.top - 1,
    nhanCon: ["td.prslo", "td.prchipso", "td.prsku", "td.pn", "td.prxoa"].map((s) => nhan(q(s))).join(""),
    nhanApTem: nhan(loc[0] && loc[0].querySelector("label")), nhanApSl: nhan(loc[1] && loc[1].querySelector("label")),
    tagNgangSku: !!(tag && skuB) && Math.abs((tag.top + tag.height / 2) - (skuB.top + skuB.height / 2)) < 12,
    /* 23/08/2026 ĐẢO CHIỀU: nút × XOÁ SKU về BÌA TRÁI, đứng TRƯỚC mã — nên đo "× trước mã" thay cho
       "Số tem sát ×" của bản 22/08, và "Số tem" nay kẹp giữa mã và ô gõ số lượng. */
    xTruocSku: (del && skuB) ? Math.round(skuB.left - del.right) : null,
    temTruocO: !!(tag && oSl) && tag.right <= oSl.left + 2,
    laOTem: !!q("input.prtemin"),
    locCungHang: !!(r1 && r2) && Math.abs(r1.top - r2.top) < 6,
    locDeNhau: !!(r1 && r2) && !(r1.bottom <= r2.top || r2.bottom <= r1.top) && Math.abs(r1.top - r2.top) > 6,
    tranTrang: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  prDong(); prXoaHet();
  return ra;
});
kiem("Điện thoại: danh sách in là THẺ (không bóp bảng), tên hàng đủ rộng, không kéo ngang",
  inMobile.keoNgang === 0 && inMobile.tranTrang <= 2 && inMobile.theLuoi === "grid" &&
  inMobile.anThead === "none" && inMobile.pnRong >= 240 && inMobile.pnDuoiSku,
  "kéo ngang " + inMobile.keoNgang + "px · tr=" + inMobile.theLuoi + " · thead=" + inMobile.anThead +
  " · cột tên rộng " + inMobile.pnRong + "px");
/* Hai ô "áp cho tất cả" ĐÃ BỎ (user 22/08/2026 tối bỏ cả hàng điều khiển đầu pop-up) — ca đảo
   chiều: chúng KHÔNG được còn trên màn. */
kiem("Điện thoại: hàng \"áp cho tất cả\" đã GỠ khỏi pop-up (user 22/08/2026)",
  !inMobile.locCungHang && !inMobile.locDeNhau && !inMobile.nhanApTem && !inMobile.nhanApSl,
  "còn ô 1: " + !!inMobile.nhanApTem + " · còn ô 2: " + !!inMobile.nhanApSl);
/* Bản 22/08/2026 bỏ nhãn ::before "Số tem"/"Số lượng" (placeholder nói đủ) — không ô nào được còn
   nhãn dán, kể cả "ĐVT" của sự cố 20/08. */
kiem("Điện thoại: nhãn ::before đã bỏ hẳn — không ô nào còn nhãn dán (kể cả \"ĐVT\")",
  inMobile.nhanCon === "", "nhãn còn sót: " + (inMobile.nhanCon || "(không)"));
/* ĐẢO CHIỀU 23/08/2026 (đặc tả user): × / mã SKU / ô "Số tem" / ô gõ số lượng. */
kiem("Điện thoại: nút × ĐỨNG TRƯỚC mã SKU, và ô \"Số tem\" kẹp giữa mã với ô gõ số lượng",
  inMobile.laOTem && inMobile.xTruocSku !== null && inMobile.xTruocSku >= 0 && inMobile.xTruocSku <= 20 &&
  inMobile.temTruocO,
  "là ô nhập: " + inMobile.laOTem + " · × cách mã " + inMobile.xTruocSku +
  "px · Số tem trước ô gõ: " + inMobile.temTruocO);

/* HÀNG NHẬP LIỆU TRÊN ĐIỆN THOẠI (đặc tả user 23/08/2026, thay bản 22/08):
     · ô nhập nằm CUỐI hàng đầu (sau × / mã SKU / ô "Số tem"), dính bìa phải thẻ;
     · chip đã chốt XUỐNG HÀNG RIÊNG dưới tên sản phẩm, mới nhất đứng đầu bên trái;
     · thêm chip thì ô nhập KHÔNG bị bóp một pixel nào — nó ở hàng khác, không tranh chỗ với chip nữa
       (bản 22/08 chỉ hứa "không tụt dưới 96px" vì hai thứ đó chung một hàng).
   Các con số đo bằng `getBoundingClientRect` nên không thể "xanh mà giao diện vẫn xấu". */
const nhapMobile = await page.evaluate(async () => {
  ndsThemToken("8846295", "code", "chu");
  NDS.ket = NDS_ENGINE.timTop(NDS_ENGINE.tuAI({ item_codes: ["8846295"], specs: [], colors: [], brands: ["YKK"] }, NDS.cm),
    NDS.cm, { soLuong: 1, chiActive: true });
  ndsVeKetQua(7);
  document.querySelector("#ndsCards .nds-card .nds-tem").click();
  await new Promise((r) => setTimeout(r, 200));
  prMo();
  await new Promise((r) => setTimeout(r, 350));
  const oSl = () => document.querySelector("#prBody td.prslo input.prsl-v");
  const the = () => oSl().closest("tr").getBoundingClientRect();
  const csSl = getComputedStyle(oSl());
  /* Vị trí ô nhập đo TRONG THẺ (không theo toạ độ màn): pop-up căn giữa dọc nên thẻ cao thêm là cả
     hộp nhích lên — đo theo màn sẽ báo "ô nhập nhảy" trong khi nó nằm y nguyên. */
  const vt = () => { const b = oSl().getBoundingClientRect(), t = the();
    return Math.round(b.left - t.left) + "," + Math.round(b.top - t.top) + "," + Math.round(b.width); };
  const rTruoc = oSl().getBoundingClientRect();
  const truoc = { sl: Math.round(rTruoc.width), theRong: Math.round(the().width),
    satPhai: Math.round(the().right - parseFloat(getComputedStyle(oSl().closest("tr")).paddingRight) - rTruoc.right),
    caoSl: Math.round(rTruoc.height), vt: vt(),
    chuSl: Math.round(parseFloat(csSl.fontSize)), damSl: Number(csSl.fontWeight) };
  const go = async (v) => {
    const o = oSl(); o.value = v; prGoSo(o); prHienCong(o);
    document.querySelector("#prBody td.prslo .prsladd").click();
    await new Promise((r) => setTimeout(r, 160));
  };
  await go("899"); await go("8");
  /* Chip phải nằm DƯỚI tên sản phẩm (đặc tả 23/08), bám bìa trái thẻ — và ô nhập không được nhích. */
  const rChip = document.querySelector("#prBody .prchip").getBoundingClientRect();
  const rPn = document.querySelector("#prBody td.pn").getBoundingClientRect();
  const tr0 = oSl().closest("tr"), padL = parseFloat(getComputedStyle(tr0).paddingLeft);
  const hai = { soChip: document.querySelectorAll("#prBody .prchip").length,
    chipDuoiTen: rChip.top >= rPn.bottom - 1,
    chipTrai: Math.round(rChip.left - (the().left + padL)),
    vt: vt(), chipDau: document.querySelector("#prBody .prchip").textContent.replace(/[×\s]/g, "") };
  /* Chip thứ 3: ô nhập ở hàng khác nên KHÔNG được bóp, không được nhích, không sinh kéo ngang. */
  await go("1200");
  const sau = { sl: Math.round(oSl().getBoundingClientRect().width), vt: vt(),
    soChip: document.querySelectorAll("#prBody .prchip").length,
    keoNgang: document.querySelector("#prmodal .modalbody").scrollWidth - document.querySelector("#prmodal .modalbody").clientWidth };
  prDong(); prXoaHet();
  return { truoc: truoc, hai: hai, sau: sau };
});
kiem("Điện thoại: ô Số lượng ≤45% thẻ, dính bìa phải (đứng cuối hàng × / SKU / Số tem)",
  nhapMobile.truoc.sl > 0 && nhapMobile.truoc.sl <= nhapMobile.truoc.theRong * 0.45 &&
  nhapMobile.truoc.satPhai >= -1 && nhapMobile.truoc.satPhai <= 4,
  "ô " + nhapMobile.truoc.sl + "px / thẻ " + nhapMobile.truoc.theRong + "px · cách bìa phải " + nhapMobile.truoc.satPhai + "px");
/* 22/08/2026 đêm: user hạ chiều cao ô còn ~1/2 (44→~24px, chữ 19→15px vẫn đậm) — ngưỡng đo theo
   đặc tả MỚI, không còn chuẩn 44px cho khung này. */
kiem("Điện thoại: ô Số lượng cao ~1/2 cũ (22–32px), chữ ≥14px và in đậm (đọc lại được con số)",
  nhapMobile.truoc.caoSl >= 22 && nhapMobile.truoc.caoSl <= 32 && nhapMobile.truoc.chuSl >= 14 && nhapMobile.truoc.damSl >= 600,
  "cao " + nhapMobile.truoc.caoSl + "px · chữ " + nhapMobile.truoc.chuSl + "px/" + nhapMobile.truoc.damSl);
kiem("Điện thoại: chip nằm DƯỚI tên sản phẩm, bám bìa trái, chip mới nhất (8) đứng đầu",
  nhapMobile.hai.soChip === 2 && nhapMobile.hai.chipDuoiTen && nhapMobile.hai.chipTrai >= -1 &&
  nhapMobile.hai.chipTrai <= 4 && nhapMobile.hai.chipDau === "8",
  nhapMobile.hai.soChip + " chip · dưới tên: " + nhapMobile.hai.chipDuoiTen +
  " · cách trái " + nhapMobile.hai.chipTrai + "px · chip đầu " + nhapMobile.hai.chipDau);
kiem("Điện thoại: thêm chip thứ 3 → ô nhập KHÔNG nhích, KHÔNG bị bóp, không sinh kéo ngang",
  nhapMobile.sau.soChip === 3 && nhapMobile.sau.vt === nhapMobile.truoc.vt &&
  nhapMobile.hai.vt === nhapMobile.truoc.vt && nhapMobile.sau.keoNgang === 0,
  "vị trí trong thẻ " + nhapMobile.truoc.vt + " → " + nhapMobile.hai.vt + " → " + nhapMobile.sau.vt +
  " · kéo ngang " + nhapMobile.sau.keoNgang + "px");

/* (Ca "nhãn Số tem căn bìa trái" ĐÃ GỠ 22/08/2026 — cột Số tem và nhãn ::before đi hẳn theo đặc tả
   mới; phần chân pop-up của ca đó giữ nguyên dưới đây.) */
const chanPopup = await page.evaluate(async () => {
  /* Chờ 400ms trước khi mở lại: `prDong()` của ca trước đặt `display:none` bằng setTimeout(200ms) —
     mở pop-up sớm hơn thì cái timer đó ập tới sau và đóng ngay pop-up vừa mở (nút đo ra 0×0px). */
  await new Promise((r) => setTimeout(r, 400));
  if (!prSo()) document.querySelector("#ndsCards .nds-card .nds-tem").click();
  await new Promise((r) => setTimeout(r, 200));
  prMo();
  await new Promise((r) => setTimeout(r, 450));
  /* Chân pop-up: TÌNH TRẠNG một dòng, NÚT một dòng riêng — và nút chính phải rộng. */
  const fl = document.querySelector("#prmodal .prfoot .prfl").getBoundingClientRect();
  const fr = document.querySelector("#prmodal .prfoot .prfr").getBoundingClientRect();
  const btn = document.getElementById("prBtnIn").getBoundingClientRect();
  const ra = { hai: fr.top >= fl.bottom - 2, caoBtn: Math.round(btn.height),
    rongBtn: Math.round(btn.width), rongFr: Math.round(fr.width),
    moRoi: document.getElementById("prmodal").classList.contains("show"), soSku: prSo() };
  prDong(); prXoaHet();
  return ra;
});
kiem("Điện thoại: chân pop-up xếp 2 dòng (tình trạng / nút), nút In cao ≥44px và ăn hết bề rộng",
  chanPopup.moRoi && chanPopup.hai && chanPopup.caoBtn >= 44 && chanPopup.rongBtn >= chanPopup.rongFr * 0.5,
  "pop-up mở: " + chanPopup.moRoi + " · " + chanPopup.soSku + " SKU · 2 dòng: " + chanPopup.hai +
  " · nút In " + chanPopup.rongBtn + "×" + chanPopup.caoBtn + "px");

/* KHUNG CAMERA TRÊN MÁY HẸP (sự cố iOS 21/08/2026: bấm "Bật camera" thì khung phóng to tràn màn hình,
   mất luôn nút "Chụp" màu cam và hàng tỉ lệ zoom).
   Gốc: Safari trên iPhone tự đưa <video> vào TOÀN MÀN HÌNH khi play nếu thiếu `webkit-playsinline`;
   và khung không có trần chiều cao nên khi `aspect-ratio` không tính được thì nó cao tự do. */
const camMobile = await page.evaluate(() => {
  const v = document.getElementById("ndsVideo");
  const st = document.getElementById("ndsStage");
  const r = st.getBoundingClientRect();
  const cs = getComputedStyle(st);
  return { inline: v.hasAttribute("playsinline"), wk: v.hasAttribute("webkit-playsinline"),
    dieuKhien: v.hasAttribute("controls"), cao: Math.round(r.height), tran: cs.maxHeight,
    caoManh: Math.round(window.innerHeight) };
});
kiem("iOS: <video> có CẢ playsinline và webkit-playsinline (không tự vào toàn màn hình)",
  camMobile.inline && camMobile.wk && !camMobile.dieuKhien,
  "playsinline=" + camMobile.inline + " · webkit-playsinline=" + camMobile.wk);
kiem("Điện thoại: khung camera có TRẦN chiều cao, không chiếm quá nửa màn (còn chỗ cho nút Chụp)",
  camMobile.tran !== "none" && camMobile.cao <= Math.round(camMobile.caoManh * 0.55),
  "khung cao " + camMobile.cao + "px / màn " + camMobile.caoManh + "px · max-height " + camMobile.tran);

kiem("Điện thoại: nút điều khiển không tràn khỏi khung, đủ cao để chạm", !nut.tran && nut.thap >= 24,
  nut.n + " nút · tràn: " + nut.tran + " · nút thấp nhất " + nut.thap + "px");
kiem("Điện thoại: tab đang hiện, không tràn ngang, lưới xếp 1 cột",
  tran.hien && tran.ngang <= 2 && tran.cot === 1,
  (tran.hien ? "hiện" : "ĐANG ẨN") + " · tràn " + tran.ngang + "px · " + tran.cot + " cột");
if (LUU_ANH) await page.screenshot({ path: path.join(OUT, "nds-mobile.png"), fullPage: true });
const camTat = await page.evaluate(() => { NDS.stream = { getTracks: function () { return [{ stop: function () { window.__daTat = true; } }]; } }; showTab("kk"); return !!window.__daTat; });
kiem("Rời tab thì TẮT camera (không để đèn camera sáng)", camTat);

/* Ô email cũ hỏi ngay giữa lúc đang đứng trước kệ -> đã bỏ. Ca này khoá lại để không ai vô tình
   dựng lại: suốt cả bộ test (có gọi AI 3 lượt) KHÔNG được hiện prompt/confirm nào. */
kiem("KHÔNG hỏi email @hasaki.vn (và không có hộp thoại chặn nào khác)",
  hopThoai.filter((d) => /prompt/.test(d)).length === 0, hopThoai.join(" | ") || "0 hộp thoại");
const dt = await page.evaluate(() => { try { return localStorage.getItem("nds-mail") || ""; } catch (e) { return ""; } });
kiem("Vẫn có danh tính theo MÁY để chia hạn mức AI (tự sinh, im lặng)", /@hasaki\.vn$/.test(dt), dt);

kiem("Không có lỗi JS nào trên trang", loiTrang.length === 0, loiTrang.slice(0, 3).join(" | "));

await browser.close();
const truot = ket.filter((k) => !k.ok).length;
console.log("\n" + (truot ? "✗ " : "✓ ") + (ket.length - truot) + "/" + ket.length + " mục đạt" +
  (truot ? " — " + truot + " mục TRƯỢT" : "") + " · " + soGoiGas + " lượt gọi Apps Script (" + soGoiOcr + " OCR / " + soGoiAi + " AI ở cụm cuối, đã chặn, không ra internet)" +
  (LUU_ANH ? "\n  ảnh: " + OUT : ""));
process.exit(truot ? 1 : 0);
