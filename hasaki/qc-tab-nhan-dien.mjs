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
let treGas = 0, soGoiHam = 0;
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
    else if (act === "sku_ocr") soGoiOcr++;
    else if (act === "sku_vision") soGoiAi++;
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
  return { ten, ngoai,
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
/* 3 nút từ 19/08/2026: mã vạch · OCR Google (miễn phí) · AI — đúng 3 người đọc của bậc thang, và
   phải đúng thứ tự rẻ→đắt để ai nhìn cũng biết nên bấm cái nào trước. */
kiem("Ngoài khung chỉ còn nút hành động với KẾT QUẢ (mã vạch · OCR · AI, đúng thứ tự rẻ→đắt)",
  trongKhung.ngoai.length === 3 && /mã vạch/i.test(trongKhung.ngoai[0]) && /OCR/i.test(trongKhung.ngoai[1]) && /AI/i.test(trongKhung.ngoai[2]),
  trongKhung.ngoai.join(" · "));

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
/* THẺ GỌN (19/08/2026): chỉ hiện cái BẤT THƯỜNG. Phạm vi mặc định đã lọc ACTIVE nên badge
   "ACTIVE" trên mọi thẻ là nhiễu; "NORMAL" cũng vậy vì nó là mặc định. Tồn đã kèm đơn vị nên
   không cần thêm chip ĐVT. Chip từ khoá khớp nhốt trong <details> "Vì sao khớp". */
kiem("Thẻ GỌN: phạm vi ACTIVE thì không bày badge NORMAL/ACTIVE thừa",
  the.length > 0 && the.every((t) => t.badges.every((b) => !/^(NORMAL|ACTIVE)$/.test(b))),
  the.map((t) => "[" + t.badges.join("+") + "]").join(" · ") || "không badge nào — đúng");
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
kiem("Bấm thẻ vẫn GHI SỔ TAY đúng SKU đó (vòng tự học không mất)",
  gio.hoc > soTruocThe && gio.soTay.indexOf("422322192") >= 0, gio.soTay.join(","));
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

/* ---------- 6c. SỔ TAY TEM: học 1 lần, lần sau ra ngay KHÔNG cần AI ---------- */
/* Đây là cả mục đích của sổ tay: cùng bộ từ khoá đó, lần sau phải trả về ĐÚNG SKU người đã chọn,
   ghim #1 với 100%, kể cả khi đối soát theo điểm xếp nó ở hạng khác. */
const soTruoc = await page.evaluate(() => ndsSoDem());
await page.evaluate(() => { ndsXoaHet(); document.getElementById("ndsRaw").value = "Chi Irisa F9-5284 Tex 27 Tkt 120 Hong tro"; ndsDoiSoat(); });
await new Promise((r) => setTimeout(r, 700));
const truocHoc = await page.evaluate(() => (NDS.ket || []).map((r) => r.sku));
/* Cố ý chọn thẻ #2 (KHÔNG phải thẻ máy đoán đúng nhất) — có vậy mới chứng minh sổ tay thắng điểm số */
const skuHoc = await page.evaluate(() => { const r = NDS.ket[1] || NDS.ket[0]; ndsChonSku(r.sku); return r.sku; });
await new Promise((r) => setTimeout(r, 600));
const soSau = await page.evaluate(() => ndsSoDem());
kiem("Chọn SKU xong thì sổ tay ghi thêm ghi nhớ", soSau > soTruoc, soTruoc + " → " + soSau + " ghi nhớ");
/* Dựng lại đúng bộ từ khoá đó từ đầu (như lần sau quét lại tem cũ) */
await page.evaluate(() => { ndsXoaHet(); document.getElementById("ndsRaw").value = "Chi Irisa F9-5284 Tex 27 Tkt 120 Hong tro"; ndsDoiSoat(); });
await new Promise((r) => setTimeout(r, 700));
const sauHoc = await page.evaluate(() => ({ sku: (NDS.ket[0] || {}).sku, hoc: (NDS.ket[0] || {}).daHoc, pct: (NDS.ket[0] || {}).pct }));
kiem("Lần sau gặp lại tem đó: SKU đã học lên #1, 100%, không gọi AI",
  String(sauHoc.sku) === String(skuHoc) && sauHoc.hoc === true && sauHoc.pct === 100,
  "chọn " + skuHoc + " (trước đó máy xếp: " + truocHoc.join(",") + ") → nay #1 = " + sauHoc.sku + "/" + sauHoc.pct + "%");
/* Dấu "từ sổ tay" nay nằm ở dòng phụ chứ không phải một badge nữa (thẻ đã rút tới lõi) */
const nhanHoc = await page.$eval("#ndsCards .nds-card .nds-chead", (e) => e.textContent.trim());
kiem("Thẻ nói rõ kết quả đến TỪ SỔ TAY (để biết vì sao chắc chắn)", /từ sổ tay/.test(nhanHoc), nhanHoc);
const gasTruoc = soGoiGas;
await page.evaluate(() => ndsDoiSoat());
await new Promise((r) => setTimeout(r, 400));
kiem("Đường sổ tay KHÔNG gọi Apps Script/AI lần nào", soGoiGas === gasTruoc, soGoiGas - gasTruoc + " lượt gọi");
/* Quên đi thì phải trở về như cũ — sổ tay sai mà không sửa được thì tệ hơn không có sổ */
/* Nút "quên ghi nhớ này" phải NHÌN THẤY ĐƯỢC trên thẻ (19/08/2026: hàm có, ca test có, nhưng
   không có nút nào trong giao diện gọi tới ⇒ chọn nhầm là ghim SKU sai 100% mãi mãi). Và bấm nó
   KHÔNG được kích chọn SKU của thẻ cha. */
const nutQuen = await page.evaluate(() => {
  const b = document.querySelector("#ndsCards .nds-card .nds-quen");
  return b ? { chu: b.textContent.trim(), trongThe: !!b.closest(".nds-card") } : null;
});
kiem("Thẻ \"từ sổ tay\" có nút gỡ ghi nhớ ngay tại chỗ (không phải Xoá sổ tay cả bộ)",
  !!nutQuen && /quên ghi nhớ/i.test(nutQuen.chu) && nutQuen.trongThe, nutQuen ? nutQuen.chu : "KHÔNG có nút nào");
/* Thước đo là SỔ TAY (từ 20/08/2026 bấm thẻ không còn vào giỏ nữa): bấm "quên ghi nhớ" mà nổi bọt
   lên thẻ cha thì thẻ cha sẽ HỌC LẠI ngay cái vừa gỡ ⇒ số ghi nhớ không giảm. */
const hocTruoc = await page.evaluate(() => ndsSoDem());
await page.evaluate(() => document.querySelector("#ndsCards .nds-card .nds-quen").click());
await new Promise((r) => setTimeout(r, 500));
const hocSau = await page.evaluate(() => ndsSoDem());
kiem("Bấm \"quên ghi nhớ\" KHÔNG kích xác nhận SKU của thẻ cha (chặn nổi bọt)", hocSau < hocTruoc,
  "ghi nhớ trước " + hocTruoc + " · sau " + hocSau);
await new Promise((r) => setTimeout(r, 500));
const sauQuen = await page.evaluate(() => ({ sku: (NDS.ket[0] || {}).sku, hoc: !!(NDS.ket[0] || {}).daHoc }));
kiem("\"Quên ghi nhớ này\" gỡ được ghi nhớ sai", sauQuen.hoc === false, "#1 quay lại " + sauQuen.sku);

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
/* Dạy sổ tay theo mã vạch rồi quét lại: phải ra ngay SKU đó, kể cả khi chữ trên tem đọc không ra */
const skuMV = await page.evaluate(() => { const s = NDS.ds[10].sku; ndsChonSku(s); return s; });
await new Promise((r) => setTimeout(r, 500));
await page.evaluate(() => { ndsXoaHet(); return ndsThuMaVach(); });
await new Promise((r) => setTimeout(r, 700));
const mvHoc = await page.evaluate(() => ({ sku: (NDS.ket[0] || {}).sku, hoc: (NDS.ket[0] || {}).daHoc }));
kiem("Quét lại đúng mã vạch đó → SKU đã học ra ngay (đường hoàn toàn không cần AI)",
  String(mvHoc.sku) === String(skuMV) && mvHoc.hoc === true, "mã vạch → " + mvHoc.sku);
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
/* Không có mã nào: phải hiện dải cảnh báo, không được im lặng */
await page.evaluate(() => { ndsXoaHet(); document.getElementById("ndsRaw").value = "Chi Filtex Phong Viet Polyester"; ndsDoiSoat(); });
await new Promise((r) => setTimeout(r, 800));
const canhBao = await page.evaluate(() => {
  const n = document.querySelector("#ndsCards .pcdnote");
  return { co: !!n, chu: n ? n.textContent.trim().slice(0, 60) : "", coMa: !!(NDS.ket || []).coMaKhop };
});
kiem("Không khớp được mã nào → CẢNH BÁO ngay trên đầu kết quả",
  canhBao.co && /Chưa khớp được MÃ HÀNG/.test(canhBao.chu) && !canhBao.coMa, canhBao.chu || "(không có cảnh báo)");

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
  const hienModal = document.getElementById("prmodal").classList.contains("show");
  const dong = document.querySelectorAll("#prBody tr").length;
  const oSl = document.querySelectorAll("#prBody input.prsl").length;
  const oMau = document.querySelectorAll("#prBody select.prmau").length;
  const nutXoa = document.querySelectorAll("#prBody .prdel").length;
  const soMau = document.querySelectorAll("#prBody select.prmau option").length / Math.max(1, oMau);
  return { hienModal, dong, oSl, oMau, nutXoa, soMau, tong: prTongTem() };
});
kiem("Mở được bảng danh sách in, mỗi dòng có mẫu tem + số lượng + nút xoá",
  bang.hienModal && bang.dong === 2 && bang.oSl === 2 && bang.oMau === 2 && bang.nutXoa === 2,
  bang.dong + " dòng · " + bang.oMau + " ô mẫu (" + bang.soMau + " mẫu chọn được) · " + bang.oSl + " ô số lượng");

const doiSl = await page.evaluate(async () => {
  const inp = document.querySelector("#prBody input.prsl");
  inp.value = "5"; inp.dispatchEvent(new Event("change"));
  await new Promise((r) => setTimeout(r, 200));
  return { tong: prTongTem(), nutIn: document.getElementById("prBtnIn").textContent,
    xem: document.querySelectorAll("#prXem .pr-tem").length, bc: document.querySelectorAll("#prXem svg").length };
});
kiem("Đổi số lượng một dòng thì tổng số tem đổi theo", doiSl.tong === 6, doiSl.tong + " tem · nút \"" + doiSl.nutIn + "\"");
kiem("Xem trước dựng tem thật, mỗi tem có mã vạch", doiSl.xem >= 6 && doiSl.bc >= 6,
  doiSl.xem + " tem xem trước · " + doiSl.bc + " mã vạch");

const doiMau = await page.evaluate(async () => {
  const sel = document.querySelector("#prBody select.prmau");
  sel.value = "t42x25"; sel.dispatchEvent(new Event("change"));
  await new Promise((r) => setTimeout(r, 200));
  const t = document.querySelector("#prXem .pr-tem");
  return { mau: Object.keys(PR.sel).map((k) => PR.sel[k].mau).join(","), kho: t ? t.style.width + "×" + t.style.height : "" };
});
kiem("Đổi mẫu tem của một dòng thì khổ tem xem trước đổi theo",
  /t42x25/.test(doiMau.mau) && doiMau.kho === "42mm×25mm", doiMau.mau + " · tem đầu " + doiMau.kho);

const xoaDong = await page.evaluate(async () => {
  const truoc = prSo();
  document.querySelector("#prBody .prdel").click();
  await new Promise((r) => setTimeout(r, 200));
  return { truoc, sau: prSo(), dong: document.querySelectorAll("#prBody tr").length };
});
kiem("Xoá được TỪNG DÒNG trong danh sách in", xoaDong.sau === xoaDong.truoc - 1 && xoaDong.dong === 1,
  xoaDong.truoc + " → " + xoaDong.sau + " SKU");

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

/* Áp một mẫu cho tất cả rồi in: kiểm đúng số con tem ra giấy + @page đúng khổ */
const inThat = await page.evaluate(async () => {
  prMo();
  await new Promise((r) => setTimeout(r, 200));
  prApMau("t40x60"); prApSl(2);
  await new Promise((r) => setTimeout(r, 200));
  window.__daIn = 0; window.print = () => { window.__daIn++; };
  prIn();
  await new Promise((r) => setTimeout(r, 300));
  return { daIn: window.__daIn, soTem: document.querySelectorAll("#prsheet .pr-tem").length,
    page: document.getElementById("prPage").textContent, coClass: document.body.classList.contains("in-tem"),
    tong: prTongTem() };
});
kiem("In: đúng số con tem + @page là khổ MỘT HÀNG GIẤY (2 tem + khe), không phải khổ 1 tem",
  inThat.daIn === 1 && inThat.soTem === inThat.tong && /82mm 60mm/.test(inThat.page) && inThat.coClass,
  inThat.soTem + " tem · " + inThat.page);

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

/* ---------- 7. Phạm vi ACTIVE / Tất cả ---------- */
await bam("#ndsScopeAll");
await new Promise((r) => setTimeout(r, 500));
const scope = await page.evaluate(() => ({ chi: NDS.chiActive, hint: document.getElementById("ndsResHint").textContent }));
kiem("Đổi phạm vi sang \"Tất cả\" (gồm INACTIVE)", scope.chi === false && /INACTIVE/.test(scope.hint), scope.hint);
await bam("#ndsScopeA");

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
await page.evaluate(() => { const t = document.getElementById("toast"); t.textContent = ""; t.classList.remove("show"); });
await datAnhMoi();
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

/* Đồng hồ giây trong hộp "đang đọc": không rút được 4–8 giây của Google, nhưng phải cho thấy máy
   đang làm chứ không treo (chính cảm giác treo làm thủ kho báo "quá lâu"). */
traLoi = AI_OK; traLoiOcr = OCR_OK;
const coDongHo = await page.evaluate(async () => {
  ndsBusy(true, "đang thử");
  await new Promise((r) => setTimeout(r, 350));
  const el = document.getElementById("ndsDongHo");
  const chu = el ? el.textContent : "";
  /* ĐỌC HỘP TRƯỚC khi tắt — bẫy pass oan: tắt rồi thì hộp không còn, "không còn chữ" luôn đúng. */
  const box = document.getElementById("ndsBusyBox");
  const conChu = box ? box.textContent.replace(chu, "").trim() : "KHÔNG THẤY HỘP";
  ndsBusy(false);
  return { chu: chu, conChu: conChu, conSau: !!document.getElementById("ndsDongHo") };
});
kiem("Hộp \"đang đọc\" CHỈ còn đồng hồ giây (không còn câu 'đang thử OCR…'), tắt sạch khi xong",
  /^0,[1-9]s$/.test(coDongHo.chu) && coDongHo.conChu === "" && !coDongHo.conSau,
  "sau 0,35s hiện " + coDongHo.chu + " · chữ kèm theo: \"" + coDongHo.conChu + "\"");

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
const nenSo = await page.evaluate(() => ({ so: window.__soNen, tran: window.NDS_TRAN_B64 }));
kiem("Một tấm ảnh chỉ nén MỘT lần dù bậc thang gọi cả AI lẫn OCR",
  soGoiAi === 1 && soGoiOcr === 1 && nenSo.so === 1,
  soGoiAi + " AI · " + soGoiOcr + " OCR · " + nenSo.so + " lần nén");
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
  const c = document.querySelector(".nds-ctl");
  /* BỎ QUA nút đang ẩn: phần tử hidden trả rect 0×0 ở toạ độ (0,0) nên luôn bị tính là "tràn" */
  const bs = Array.from(c.querySelectorAll(".kktab,.pg-seg")).filter((b) => b.offsetParent !== null)
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
kiem("Điện thoại: nhãn 'lệch …' CÙNG HÀNG với 'từ khoá khớp' (flex space-between, không tràn)",
  mtDong.co && mtDong.flex === "flex" && mtDong.canh === "space-between" && mtDong.doc === "center" &&
  mtDong.cungHang && mtDong.lechPhai && !mtDong.tran && mtDong.caoDong <= 26 && mtDong.dauCon === "sạch",
  mtDong.flex + "/" + mtDong.canh + "/" + mtDong.doc + " · cùng hàng: " + mtDong.cungHang +
  " · bên phải: " + mtDong.lechPhai + " · cao " + mtDong.caoDong + "px · \"" + mtDong.chu + "\" · hàng đầu: " + mtDong.dauCon);
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
