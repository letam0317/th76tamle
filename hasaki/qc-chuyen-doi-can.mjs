/**
 * qc-chuyen-doi-can.mjs — SMOKE TEST tab "Chuyển đổi cân" TRONG TRÌNH DUYỆT THẬT (Edge headless).
 *  Tab này không gọi mạng, nhưng chỗ dễ sai lại là TOÁN và cách ĐỌC SỐ NGƯỜI GÕ — sai một dấu phân
 *  cách là lệch 1.000 lần và con số đó đi thẳng vào phiếu kiểm kê. Nên bộ test bám 4 nhóm:
 *    1) bộ đọc số: "2.500.000" · "2,500,000" · "2500000" · "10,5" đều phải ra đúng
 *    2) công thức: đúng ví dụ thật (10kg · 10 cuộn · lõi 50gr · cuộn nguyên 5.000.000mm/120gr)
 *    3) nút "cân cả lõi / chỉ riêng chỉ" đổi kết quả 1,7 lần — chọn sai là sai to
 *    4) cờ đỏ khi số liệu vô lý + 2 ca không tính được (lõi ≥ cuộn nguyên · cân ≤ tổng lõi)
 *  Thêm: thanh chân trang ẩn hẳn ở 2 tab Công cụ kho, ghi nhớ quy cách qua F5, "Lô tiếp theo" chỉ xoá 2 ô của lô, bố cục điện thoại, chân trang.
 *  22/08/2026: thước TEX + đối chứng chéo khi điền cả 2 (mục 12b); chip Tex lọc từ SKU_MASTER
 *  qua cache chung với tab Nhận diện SKU (mục 12c — mạng vẫn bị chặn sạch).
 *  22/08/2026 chiều (user chỉnh 4 điểm): Tex nhập BẰNG CHIP ngay bước 1 (xếp theo số SKU giảm dần,
 *  "Khác…" gõ tay, bấm lại chip sáng = bỏ chọn; ô thước ② riêng đã xoá) · ô tổng CHỈ NHẬN GRAM
 *  (bỏ nút kg) · nút quy cách hiện MÉT + ô "Khác…" gõ mét — kết quả vẫn luôn mm/gr.
 *
 *  CHẶN TOÀN BỘ MẠNG RA NGOÀI (gviz + Apps Script): tab này không cần dữ liệu Sheet, chặn để test
 *  chạy được offline và KHÔNG đốt thêm lượt gọi upstream nào.
 *
 *  node qc-chuyen-doi-can.mjs [--anh]      (--anh: lưu ảnh chụp màn hình vào .exports/qc-can)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";
import { EDGE_PATH } from "./token-store.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const URL_TRANG = "file:///" + path.join(DIR, "..", "factory", "index.html").replace(/\\/g, "/");
const OUT = path.join(DIR, ".exports", "qc-can");
const LUU_ANH = process.argv.includes("--anh");
if (LUU_ANH) fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({ headless: true, executablePath: EDGE_PATH,
  args: ["--allow-file-access-from-files", "--disable-web-security"] });
const page = await browser.newPage();
await page.setViewport({ width: 1360, height: 950 });

const loiJS = [];
page.on("pageerror", (e) => loiJS.push(String(e.message).slice(0, 200)));

/* Chặn mọi thứ ra internet. Tab Chuyển đổi cân tính thuần trên máy nên chặn xong vẫn phải chạy đủ —
   đó chính là điều cần kiểm: thủ kho mất mạng vẫn quy đổi được. */
let raNgoai = 0;
await page.setRequestInterception(true);
page.on("request", (req) => {
  if (/^https?:/.test(req.url())) { raNgoai++; return req.abort(); }
  req.continue();
});

const ket = [];
const kiem = (ten, ok, ghi) => { ket.push({ ten, ok, ghi }); console.log((ok ? "  ✓ " : "  ✗ ") + ten + (ghi ? "  — " + ghi : "")); };
const bam = (sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) throw new Error("không thấy " + s); e.click(); }, sel);
/* Gõ số rồi để trang tự tính (đúng đường người dùng đi: oninput -> cdTinh) */
const go = (o) => page.evaluate((o) => {
  for (const k in o) { const e = document.getElementById(k); e.value = o[k]; e.dispatchEvent(new Event("input", { bubbles: true })); }
  /* `tiles` = CHƯA CÓ KẾT QUẢ THẬT. Từ 23/08/2026 khối thẻ không ẩn nữa mà bày 4 thẻ MỜ giữ chỗ
     (user: "1 bên trống quá nhiều"), nên "chưa có kết quả" = đang ẩn HOẶC đang là thẻ mờ. */
  const oT = document.getElementById("cdTiles");
  return { mm: CD.mm, tiles: oT.hidden || oT.classList.contains("mo"), note: document.getElementById("cdNote").textContent.trim() };
}, o);

await page.goto(URL_TRANG, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.evaluate(() => { try { localStorage.removeItem("cd-quycach"); } catch (e) {} });

/* ---------- 1. Tab có mặt đủ 2 chỗ điều hướng ---------- */
kiem("Nút tab \"Chuyển đổi cân\" có trên thanh tab đầu trang", !!(await page.$("#ttCd")));
const ben = await page.evaluate(() => {
  const g = Array.from(document.querySelectorAll("#sideNav .s-grp")).find((e) => /Công cụ kho/.test(e.textContent));
  const items = g ? Array.from(g.nextElementSibling.querySelectorAll(".s-item")).map((e) => e.getAttribute("data-tab") + ":" + e.textContent.trim()) : [];
  return items;
});
kiem("Thanh bên: nằm trong hạng mục \"Công cụ kho\", sau Nhận diện SKU",
  ben.length === 2 && /^sku:/.test(ben[0]) && ben[1] === "cd:Chuyển đổi cân", ben.join(" | "));

await bam("#ttCd");
const chiMinh = await page.evaluate(() => ["viewStock", "viewKK", "viewAbn", "viewPlg", "viewNds"].every((id) => document.getElementById(id).hidden)
  && !document.getElementById("viewCd").hidden);
kiem("Mở tab thì chỉ view Chuyển đổi cân hiện, 5 view kia ẩn", chiMinh);
const onBen = await page.evaluate(() => { const e = document.querySelector('#sideNav .s-item[data-tab="cd"]'); return e && e.classList.contains("on"); });
kiem("Thanh bên tô sáng đúng mục đang xem", !!onBen);
/* Thanh chân "Nguồn: stocklocationfactory · …" đã BỬe ở cả 2 tab Công cụ kho (19/08/2026): chúng
   không đọc tab Sheet nào nên nguồn/số dòng/mốc cập nhật đều vô nghĩa. Các tab khác phải còn nguyên. */
const chan = await page.evaluate(() => {
  const r = {};
  ["cd", "sku", "stock", "plg"].forEach((t) => { showTab(t); r[t] = document.querySelector(".footbar").offsetParent !== null; });
  return r;
});
kiem("Thanh chân ẩn hẳn ở cả 2 tab Công cụ kho, 4 tab dữ liệu vẫn còn",
  chan.cd === false && chan.sku === false && chan.stock === true && chan.plg === true, JSON.stringify(chan));
await bam("#ttCd");

/* ---------- 2. Bộ đọc số: 3 kiểu dấu phân cách + thập phân + rác ---------- */
const doc = await page.evaluate(() => ["2.500.000", "2,500,000", "2500000", "10,5", "10.5", "0,25",
  "1.234.567", "2.500,5", "120gr", " 50 ", "5 000 000", "", "abc"]
  .map((s) => [s, Number.isNaN(cdSo(s)) ? "NaN" : cdSo(s)]));
const muon = { "2.500.000": 2500000, "2,500,000": 2500000, "2500000": 2500000, "10,5": 10.5, "10.5": 10.5,
  "0,25": 0.25, "1.234.567": 1234567, "2.500,5": 2500.5, "120gr": 120, " 50 ": 50, "5 000 000": 5000000 };
const sai = doc.filter(([s, v]) => (s in muon) ? Math.abs(v - muon[s]) > 1e-9 : v !== "NaN");
kiem("Đọc được cả 3 kiểu dấu phân cách + thập phân, chữ rác trả NaN", sai.length === 0,
  sai.length ? sai.map(([s, v]) => s + "→" + v).join(", ") : doc.length + "/13 đúng");

/* ---------- 3. Thiếu ô nào thì nói rõ ô đó, chưa vẽ kết quả ---------- */
const thieu = await go({ cdTong: "10" });
const chuThieu = await page.$eval("#cdState", (e) => e.textContent.trim());
kiem("Thiếu ô thì liệt kê đúng ô còn thiếu, chưa vẽ thẻ kết quả",
  thieu.tiles === true && /số cuộn/.test(chuThieu) && /cuộn nguyên/.test(chuThieu), chuThieu.slice(0, 80));
kiem("Chưa tính được thì nút Copy mm bị khoá", await page.$eval("#cdBtnCopy", (e) => e.disabled));

/* ---------- 4. CÔNG THỨC — đúng ví dụ thật của nghiệp vụ ----------
   10.000gr · 10 cuộn · lõi 50gr · cuộn nguyên 5.000.000mm nặng 120gr (cân cả lõi)
   -> chỉ trong cuộn nguyên 70gr -> 1 gram = 71.428,57mm; lô còn 9.500gr chỉ -> 678.571.429mm */
const r1 = await go({ cdTong: "10000", cdCuon: "10", cdLoi: "50", cdNguyen: "120" });
kiem("Công thức (cân cả lõi): 10,000gr/10 cuộn/lõi 50gr/nguyên 120gr → 678,571,429 mm",
  r1.mm === 678571429, r1.mm + " mm");
const b = await page.evaluate(() => Array.from(document.querySelectorAll("#cdSteps .cd-step")).map((e) => e.querySelector(".v").textContent.trim()));
kiem("Phiếu tính đủ 5 bước, lần lại được bằng máy tính cầm tay",
  b.length === 5 && b[0] === "10,000 gr" && b[1] === "− 500 gr" && b[2] === "9,500 gr" && /71,429 mm\/gr/.test(b[3]) && b[4] === "678,571,429 mm",
  b.join(" | "));

/* ---------- 5. Bẫy lớn nhất: "120gr" là cả lõi hay riêng chỉ ---------- */
await bam("#cdNgChi");
const r2 = await page.evaluate(() => CD.mm);
kiem("Nút \"chỉ riêng chỉ\" đổi mật độ → 395,833,333 mm (lệch 1,71 lần)",
  r2 === 395833333, r2 + " mm · lệch " + (r1.mm / r2).toFixed(2) + "×");
await bam("#cdNgCa");

/* ---------- 6. Cờ đỏ khi số liệu vô lý (chính ví dụ 10kg/10cuộn ở trên) ---------- */
const co = await page.$eval("#cdNote", (e) => e.textContent.trim());
kiem("Dán cờ đỏ: mỗi cuộn thừa dài hơn cả cuộn nguyên → nhắc đi cân/đếm lại",
  /vô lý/.test(co) && /1\.2 kg/.test(co), co.slice(0, 110));

/* ---------- 7. Lô hợp lý thì không còn cờ đỏ, số khớp tay ---------- */
const r3 = await go({ cdTong: "900", cdCuon: "10" });      // 900gr - 500gr lõi = 400gr chỉ
kiem("Lô hợp lý 900gr/10 cuộn → 28,571,429 mm (5,71 cuộn nguyên), hết cờ đỏ",
  r3.mm === 28571429 && !/vô lý/.test(r3.note), r3.mm + " mm · " + (r3.note ? r3.note.slice(0, 40) : "không cờ"));
const the = await page.evaluate(() => Array.from(document.querySelectorAll("#cdTiles .abntile")).map((e) => e.querySelector(".k").textContent.trim()));
kiem("4 thẻ kết quả: mm · m · cuộn tương đương · trung bình mỗi cuộn",
  the.length === 4 && the[0] === "28,571,429 mm" && the[1] === "28,571.4 m" && the[2] === "5.71 cuộn" && /^2,857,143 mm$/.test(the[3]),
  the.join(" | "));

/* ---------- 8. Hai ca KHÔNG tính được — phải dừng, không trả số âm ---------- */
const ca1 = await go({ cdLoi: "150" });                     // lõi 150gr ≥ cuộn nguyên 120gr
kiem("Lõi ≥ cuộn nguyên → dừng, chỉ đường sang nút \"chỉ riêng chỉ\"",
  ca1.mm === 0 && ca1.tiles === true && /Không tính được/.test(ca1.note) && /riêng phần chỉ/.test(ca1.note), ca1.note.slice(0, 90));
const ca2 = await go({ cdLoi: "50", cdTong: "400", cdCuon: "10" });   // 400gr < 500gr lõi
kiem("Cân cả lô ≤ tổng khối lượng lõi → dừng, nhắc ô tổng nhận GRAM",
  ca2.mm === 0 && /Không tính được/.test(ca2.note) && /GRAM/.test(ca2.note), ca2.note.slice(0, 90));

/* ---------- 9. Chỉ còn GRAM (nút kg đã bỏ) + quy cách hiện MÉT ---------- */
kiem("Ô tổng cân chỉ còn GRAM — 2 nút kg/gr đã bỏ hẳn",
  await page.evaluate(() => !document.getElementById("cdDvKg") && !document.getElementById("cdDvG") &&
    /gr/.test(document.querySelector("#cdTong").parentElement.querySelector(".cd-dv").textContent)));
/* Chip là SỐ TRẦN, đơn vị nằm ở CHIP ĐVT cạnh ô nhập (đổi 23/08/2026, user: "không để thừa đơn vị
   kế bên ô chip") — nhưng vẫn phải là MÉT chứ không phải 5.000.000 mm. */
const nutM = await page.evaluate(() => ({
  chip: [...document.querySelectorAll("#cdQCBar .kktab")].map((b) => b.textContent.trim()),
  dv: (document.getElementById("cdQCDv") || {}).textContent,
  soDv: document.querySelectorAll("#cdQCBar .kktab").length && [...document.querySelectorAll("#cdQCBar .kktab")].filter((b) => /m|yard/i.test(b.textContent)).length
}));
kiem("Chip quy cách là SỐ TRẦN theo MÉT, đơn vị chỉ hiện MỘT chỗ ở chip ĐVT",
  nutM.chip.join("|") === "2,500|3,000|5,000|Khác…" && /^m$/.test(String(nutM.dv).trim()),
  nutM.chip.join(" | ") + "  · chip ĐVT: " + String(nutM.dv).trim());
await bam('#cdQCBar .kktab[data-mm="2500000"]');
const r25 = await go({ cdTong: "900" });
kiem("Đổi quy cách 2,500 m: mật độ đổi theo, kết quả bằng nửa — VẪN ra mm",
  r25.mm === 14285714, r25.mm + " mm (đúng nửa của 5,000,000 mm)");
const tuDo = await page.evaluate(() => { document.querySelector('#cdQCBar .kktab[data-mm="0"]').click();
  const o = document.getElementById("cdQC"); o.value = "1.000"; o.dispatchEvent(new Event("input", { bubbles: true }));
  return { hienO: !document.getElementById("cdQCRow").hidden, mm: CD.mm,
    doc: document.getElementById("cdQCDoc").textContent }; });
kiem("Quy cách \"Khác…\": gõ bằng MÉT (1.000 m), dòng soi quy ra 1,000,000 mm, kết quả vẫn mm",
  tuDo.hienO && tuDo.mm === 5714286 && /1,000,000 mm/.test(tuDo.doc), tuDo.mm + " mm · " + tuDo.doc);

/* ---------- 10. Ghi nhớ quy cách qua F5, KHÔNG nhớ số cân của lô ---------- */
await bam('#cdQCBar .kktab[data-mm="5000000"]');
await go({ cdTong: "900", cdCuon: "10", cdLoi: "50", cdNguyen: "120" });
await page.reload({ waitUntil: "domcontentloaded" });
await bam("#ttCd");
const nho = await page.evaluate(() => ({
  loi: document.getElementById("cdLoi").value, nguyen: document.getElementById("cdNguyen").value,
  qc: CD.qc, tong: document.getElementById("cdTong").value, cuon: document.getElementById("cdCuon").value,
}));
kiem("F5: nhớ quy cách + lõi + cuộn nguyên, KHÔNG nhớ số cân của lô cũ",
  nho.loi === "50" && nho.nguyen === "120" && nho.qc === 5000000 && !nho.tong && !nho.cuon,
  JSON.stringify(nho));

/* ---------- 11. "Lô tiếp theo" chỉ xoá đúng 2 ô ---------- */
await go({ cdTong: "900", cdCuon: "10" });
const sauLo = await page.evaluate(() => { cdXoaLo(); return { tong: document.getElementById("cdTong").value,
  cuon: document.getElementById("cdCuon").value, loi: document.getElementById("cdLoi").value, nguyen: document.getElementById("cdNguyen").value }; });
kiem("\"Lô tiếp theo\": xoá tổng kg + số cuộn, giữ lõi + cuộn nguyên",
  !sauLo.tong && !sauLo.cuon && sauLo.loi === "50" && sauLo.nguyen === "120", JSON.stringify(sauLo));

/* ---------- 12. Copy ra số mm TRƠN (dán vào WMS là vào thẳng) ---------- */
const rc = await go({ cdTong: "900", cdCuon: "10" });
const copy = await page.evaluate(async () => {
  let bat = null;
  /* navigator.clipboard la getter CHI DOC: gan thang khong an (that bai im lang) */
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: (t) => { bat = t; return Promise.resolve(); } } });
  cdCopy(); return bat;
});
kiem("Copy mm ra số trơn, không dấu phân cách", copy === String(rc.mm), JSON.stringify(copy));

/* ---------- 12b. THƯỚC TEX — nhập BẰNG CHIP ngay bước 1 (user chỉnh 22/08/2026 chiều) ----------
   Ô "thước ②" riêng đã XOÁ vì lặp với hàng chip. Tex = gram của 1.000 m chỉ -> 1 gr dài
   1.000.000/Tex mm. Có thước nào dùng thước đó; điền CẢ HAI thì tính theo CÂN cuộn nguyên và đem
   Tex ra đối chứng chéo (lệch >5% dán cờ đỏ).
   Tex 27 · lô 2.000gr · 4 cuộn · lõi 50gr: chỉ thật 1.800gr -> 1.800 × 1.000.000/27 = 66.666.667 mm. */
const haiO = await page.evaluate(() => ({
  can: document.getElementById("cdNguyen").offsetParent !== null,
  texBar: document.getElementById("cdTexKhoBar").offsetParent !== null,
  khacChip: !!document.querySelector('#cdTexKhoBar .kktab[data-tex="0"]'),
  oGoAn: document.getElementById("cdTexRow").hidden }));
kiem("Tex nhập ngay hàng chip bước 1 (ô thước ② riêng đã xoá); offline vẫn còn chip Khác… gõ tay",
  haiO.can && haiO.texBar && haiO.khacChip && haiO.oGoAn, JSON.stringify(haiO));
await bam('#cdTexKhoBar .kktab[data-tex="0"]');
const rTx = await go({ cdTong: "2000", cdCuon: "4", cdLoi: "50", cdNguyen: "", cdTex: "27" });
kiem("Gõ tay Tex 27 qua chip Khác…: 2,000gr · 4 cuộn · lõi 50gr → 66,666,667 mm", rTx.mm === 66666667, rTx.mm + " mm");
const bTx = await page.evaluate(() => Array.from(document.querySelectorAll("#cdSteps .cd-step")).map((e) => e.querySelector(".t").textContent.trim()));
kiem("Phiếu tính bước 4 nói rõ lấy mật độ từ Tex trên tem", bTx.length === 5 && /Tex 27\.0 trên tem/.test(bTx[3]), bTx[3] || bTx.join(" | "));
const hintTx = await page.$eval("#cdKQHint", (e) => e.textContent);
kiem("Hint ghi Tex theo tem (số in sẵn là chính xác, không phải ≈)", /Tex 27\.0 theo tem/.test(hintTx) && !/≈/.test(hintTx), hintTx);
const thieu2 = await go({ cdTex: "" });
const chu2 = await page.$eval("#cdState", (e) => e.textContent.trim());
kiem("Trống cả 2 thước → đòi \"cuộn nguyên hoặc chỉ số Tex (một trong hai là đủ)\"",
  thieu2.tiles === true && /một trong hai/.test(chu2), chu2.slice(0, 90));
/* Điền CẢ HAI thước, KHỚP nhau: nguyên 120 cả lõi (chỉ 70gr -> Tex theo cân = 14) + tem Tex 14 */
const rKhop = await go({ cdTong: "900", cdCuon: "10", cdNguyen: "120", cdTex: "14" });
kiem("Cả 2 thước khớp nhau → tính theo cân (28,571,429 mm) + dòng đối chứng chéo khớp",
  rKhop.mm === 28571429 && /Đối chứng chéo khớp/.test(rKhop.note), rKhop.mm + " · " + rKhop.note.slice(0, 60));
/* Điền CẢ HAI nhưng LỆCH to: tem 27 vs theo cân 14 → vẫn tính theo cân + cờ đỏ nói cả 2 con số */
const rLech = await go({ cdTex: "27" });
kiem("Cả 2 thước lệch nhau (cân ≈14 vs tem 27) → cờ đỏ nói cả 2 số, vẫn tính theo cân",
  rLech.mm === 28571429 && /lệch nhau/.test(rLech.note) && /Tex 14\.0/.test(rLech.note) && /Tex 27\.0/.test(rLech.note),
  rLech.note.slice(0, 110));
await page.reload({ waitUntil: "domcontentloaded" });
await bam("#ttCd");
const nhoTx = await page.evaluate(() => ({ tuDo: CD.texTuDo, go: document.getElementById("cdTex").value,
  hien: !document.getElementById("cdTexRow").hidden }));
kiem("F5: nhớ Tex gõ tay (chip Khác… vẫn mở, số còn nguyên)", nhoTx.tuDo && nhoTx.go === "27" && nhoTx.hien,
  JSON.stringify(nhoTx));
await bam('#cdTexKhoBar .kktab[data-tex="0"]');   // bấm lại chip Khác… đang sáng = bỏ Tex
const rLai = await go({ cdTong: "900", cdCuon: "10" });
kiem("Bấm lại chip Khác… = bỏ Tex: quay về thước cân, kết quả y như cũ, hết dòng đối chứng",
  rLai.mm === 28571429 && !/lệch nhau/.test(rLai.note), rLai.mm + " mm");

/* ---------- 12c. CHIP TEX TỪ DANH MỤC KHO — lọc SKU_MASTER, offline dùng cache chung ----------
   Dải chip dưới ô quy cách lọc "Tex NN" từ nhóm hàng "Chỉ*" (kể cả "(Combo) Chỉ…"). Bẫy phải chặn:
   Vitex (nhãn) · FILTEX (chỉ Phong Việt) · Winmatex (vải) đều chứa "tex" nhưng KHÔNG phải chỉ số.
   Mạng đang bị CHẶN SẠCH nên nguồn duy nhất là cache 'nds-master-v1' — đúng đường 0-lượt-mạng. */
await page.evaluate(() => {
  const rows = [
    { sku: "1", pn: "Chỉ may/COATS Phong Phú/Polyester/None/White/None/Text 27 - 60\\3- Tkt 120/mm", type: "NORMAL", status: "ACTIVE", qty: 1 },
    { sku: "2", pn: "Chỉ astra/C9700_Coats Phong Phú/Polyester /None/Black/None/Text 27- 60-3-Tkt 120/mm", type: "NORMAL", status: "ACTIVE", qty: 1 },
    { sku: "3", pn: "(Combo) Chỉ FILTEX/F2-2249_Phong Việt/Polyester/None/Đỏ gạch/None/Tex 24-100D-2-Tkt 120/Cuộn 5000m", type: "COMBO", status: "ACTIVE", qty: 1 },
    { sku: "4", pn: "Nhãn care gập/Vitex/Satin, 95% cotton/None/White/None/14.3cm*3.5cm/pcs", type: "NORMAL", status: "ACTIVE", qty: 1 },
    { sku: "5", pn: "Vải mẫu Dobby/WD68182_Winmatex/64% Poly/Dark blue/150gsm,57 - 58inch/mm", type: "NORMAL", status: "ACTIVE", qty: 1 },
  ];
  localStorage.setItem("nds-master-v1", JSON.stringify({ at: Date.now(), rows }));
});
await page.reload({ waitUntil: "domcontentloaded" });
await bam("#ttCd");
const chips = await page.evaluate(() => {
  const kho = document.getElementById("cdTexKho");
  return { hien: !kho.hidden && kho.offsetParent !== null,
    chu: Array.from(document.querySelectorAll("#cdTexKhoBar .kktab")).map((b) => b.textContent.trim().replace(/\s+/g, " ")) };
});
/* 22/08/2026 tối: chip chỉ còn "Tex 27" (số SKU dời vào tooltip) + CHỈ GIỮ Tex 27/24/60
   (23/08: Tex 18 dời sang "Khác…"), còn lại đi đường "Khác…" — vẫn xếp phổ biến trước. */
kiem("Chip Tex từ cache (0 lượt mạng), PHỔ BIẾN đứng trái, không kèm số đếm: Tex 27 → Tex 24 → Khác…; Vitex/FILTEX/Winmatex không lọt",
  chips.hien && chips.chu.length === 3 && chips.chu[0] === "Tex 27" && chips.chu[1] === "Tex 24" && chips.chu[2] === "Khác…",
  chips.chu.join(" | ") || "KHÔNG có chip nào");
const bamChip = await page.evaluate(() => {
  document.querySelector('#cdTexKhoBar .kktab[data-tex="27"]').click();
  return { tex: CD.tex, active: document.querySelector('#cdTexKhoBar .kktab[data-tex="27"]').classList.contains("active"),
    oGoAn: document.getElementById("cdTexRow").hidden };
});
kiem("Bấm chip Tex 27: thành thước Tex đang chọn, ô gõ tay vẫn ẩn", bamChip.tex === 27 && bamChip.active && bamChip.oGoAn, JSON.stringify(bamChip));
const boChon = await page.evaluate(() => {
  document.querySelector('#cdTexKhoBar .kktab[data-tex="27"]').click();
  return { tex: CD.tex, active: document.querySelector('#cdTexKhoBar .kktab[data-tex="27"]').classList.contains("active") };
});
kiem("Bấm LẠI chip đang sáng = bỏ chọn Tex (Tex không bắt buộc)", boChon.tex === 0 && !boChon.active, JSON.stringify(boChon));

/* ---------- 12d. VẢI + THUN (23/08/2026) --------------------------------------------------------
   Cùng một phép chia với chỉ may, chỉ khác cái thước:
     vải  → định lượng(g/m²) × khổ(m)     thun → g/m (cân cuộn nguyên rồi nhớ vào sổ tay)
   Bốn thứ phải đúng: TOÁN, tự điền thông số từ tên hàng, sổ tay g/m, và đẩy sang In tem kèm UIDgr. */
await page.reload({ waitUntil: "domcontentloaded" });
await page.evaluate(() => {
  try { localStorage.removeItem("cd-quycach"); localStorage.removeItem("cd-gm-sotay"); localStorage.removeItem("pr-list-v1"); } catch (e) {}
  /* Seed danh mục vào ĐÚNG cache mà tab dùng chung với Nhận diện SKU — mạng vẫn bị chặn sạch */
  try {
    localStorage.setItem("nds-master-v1", JSON.stringify({ at: Date.now(), rows: [
      { sku: "422273473", pn: "Vải Rib 1x1 USA/TN035_Trang Nhã/93% Cotton 36S, 7% Spandex 30D/220gsm, 180cm/Đen_Black/g", type: "NORMAL", status: "ACTIVE", qty: 7814 },
      { sku: "422268715", pn: "Vải mẫu Dobby/WD68182_Winmatex/64% Poly/Dark blue/150gsm,57 - 58inch/m", type: "NORMAL", status: "ACTIVE", qty: 10 },
      { sku: "422265782", pn: "Vải Cotton/TN050/Single 4C, 95% Cotton Supima 30S,5% Spandex/Width 165cm+3cm/ Black /g", type: "NORMAL", status: "ACTIVE", qty: 5 },
      { sku: "422999999", pn: "Vải Interlock/TN043/87% Cotton/170gsm, 165cm/Be/mm", type: "NORMAL", status: "ACTIVE", qty: 9 },
      { sku: "422295389", pn: "Thun chỉ/NSB#560-3.0-150-1-W_Triều Vĩ/65%polyester,35% spandex/None/White/None/DTY 150-48+Spandex 560D/1kg-6700m/mm", type: "NORMAL", status: "ACTIVE", qty: 1 },
      { sku: "322229990", pn: "Thun cổ/bản thun 4mm, 100m/cuộn", type: "NORMAL", status: "ACTIVE", qty: 1 },
      { sku: "422328160", pn: "Thun lưng/59P601522_Paiho/Polyester, Spandex/None/White/None/40mm/mm", type: "NORMAL", status: "ACTIVE", qty: 4270250 },
      { sku: "422440680", pn: "Chỉ may Tex 27-60-3/Đen 345/100% Polyester/mm", type: "NORMAL", status: "ACTIVE", qty: 1 }
    ] }));
  } catch (e) {}
});
await bam("#ttCd");
await page.evaluate(() => { CD.texNap = false; cdNapTexKho(); });

/* ① Đổi loại hàng: khối thước phải đổi theo, không để hai khối cùng hiện */
await bam('#cdLoaiBar .kktab[data-loai="vai"]');
const oVai = await page.evaluate(() => ({
  tex: document.getElementById("cdTexKho").hidden, vai: document.getElementById("cdVaiF").hidden,
  thun: document.getElementById("cdThunF").hidden,
  nhan: document.querySelector('label[for="cdTong"]').textContent.replace(/\s+/g, " ").trim()
}));
kiem("Chọn loại Vải → hiện thước khổ+định lượng, ẩn thước Tex, nhãn đổi theo tên hàng",
  oVai.tex && !oVai.vai && oVai.thun && /Tổng khối lượng vải/.test(oVai.nhan), JSON.stringify(oVai));

/* ② Ô SKU tự điền khổ + định lượng từ TÊN HÀNG (đường không cần tra tem từng cuộn) */
const tuDien = await page.evaluate(() => {
  const e = document.getElementById("cdSku"); e.value = "422273473";
  e.dispatchEvent(new Event("input", { bubbles: true }));
  return { kho: CD.kho, khoGo: document.getElementById("cdKho").value, gsm: document.getElementById("cdGsm").value,
    doc: document.getElementById("cdSkuDoc").textContent.replace(/\s+/g, " ").trim() };
});
kiem("Gõ SKU vải → tự điền khổ 180cm + định lượng 220gsm từ tên hàng",
  Number(tuDien.gsm) === 220 && (Number(tuDien.kho) === 180 || Number(tuDien.khoGo) === 180),
  "khổ " + (tuDien.kho || tuDien.khoGo) + " · gsm " + tuDien.gsm + " · " + tuDien.doc.slice(0, 70));

/* ③ TOÁN: 25.000 gr − 1 lõi 1.000 gr = 24.000 gr ÷ (220 × 1,8 = 396 g/m) = 60,606 m = 60.606.061 mm */
const rVai = await go({ cdTong: "25000", cdCuon: "1", cdLoi: "1000", cdNguyen: "", cdTex: "" });
/* 25.000 − 1×1.000 = 24.000 gr ÷ (220 g/m² × 1,80 m = 396 g/m) = 60,606 m = 60.606 mm */
kiem("Vải: 25,000gr · 1 cuộn · lõi 1,000gr · 220gsm × 180cm → 60,606 mm",
  rVai.mm === 60606, rVai.mm + " mm");
const nhacVai = await page.$eval("#cdNote", (e) => e.textContent.replace(/\s+/g, " ").trim());
kiem("Không có cân cuộn nguyên → NÓI RÕ đây là ước tính ±5–8% theo định lượng danh nghĩa",
  /định lượng danh nghĩa/.test(nhacVai) && /5–8%/.test(nhacVai), nhacVai.slice(0, 96));

/* ④ Quy cách cuộn nguyên là TUỲ CHỌN với vải (chỉ may thì bắt buộc) — xoá đi vẫn phải tính được */
const khongQc = await page.evaluate(() => {
  cdChonQC(0); document.getElementById("cdQC").value = "";
  document.getElementById("cdQC").dispatchEvent(new Event("input", { bubbles: true }));
  return { mm: CD.mm, tiles: document.getElementById("cdTiles").hidden,
    yard: /yard/.test(document.getElementById("cdTiles").textContent) };
});
kiem("Vải không cần quy cách cuộn nguyên: vẫn ra số, thẻ thứ 3 đổi sang YARD",
  khongQc.mm === 60606 && khongQc.tiles === false && khongQc.yard, JSON.stringify(khongQc));
await page.evaluate(() => { cdChonQC(5000000); });

/* ⑤ Khổ ghi bằng INCH trong tên hàng → phải đổi ra cm (57-58inch ≈ 146,1cm) */
const inch = await page.evaluate(() => {
  const e = document.getElementById("cdSku"); e.value = "422268715";
  e.dispatchEvent(new Event("input", { bubbles: true }));
  return { kho: CD.kho, khoGo: document.getElementById("cdKho").value, gsm: document.getElementById("cdGsm").value,
    doc: document.getElementById("cdSkuDoc").textContent };
});
kiem("Tên hàng ghi khổ bằng inch → tự đổi ra cm và nói rõ là đổi từ inch",
  Math.abs(Number(inch.khoGo) - 146.1) < 0.6 && Number(inch.gsm) === 150 && /inch/.test(inch.doc),
  "khổ " + inch.khoGo + "cm · gsm " + inch.gsm);

/* ⑤b HAI SKU LIÊN TIẾP cùng có khổ "Khác…" (180 rồi 165) — khổ thứ hai phải THAY khổ cũ.
   Bẫy thật đã dính 23/08: hàm tự điền gọi `cdChonKho` (hành vi của NGÓN TAY: bấm lại chip đang sáng
   = bỏ chọn), nên SKU thứ hai TẮT ô khổ đang bật → khổ biến mất không một lời nào và kết quả tụt về
   "còn thiếu". Bộ đo điện thoại bắt được trước (màn mới bị bỏ qua vì tab không vẽ nổi kết quả). */
const khoHai = await page.evaluate(() => {
  const dat = (v) => { const e = document.getElementById("cdSku"); e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); };
  dat("422273473");                                    // khổ 180 → ô "Khác…" bật
  const mot = { kho: document.getElementById("cdKho").value, tuDo: CD.khoTuDo, mm: CD.mm };
  dat("422999999");                                    // khổ 165 → vẫn phải là ô "Khác…", giá trị 165
  return { mot, hai: { kho: document.getElementById("cdKho").value, tuDo: CD.khoTuDo, mm: CD.mm,
    gsm: document.getElementById("cdGsm").value } };
});
kiem("Đổi sang SKU khác cũng khổ \"Khác…\" → khổ mới THAY khổ cũ (không tắt ô đang bật)",
  khoHai.mot.kho === "180" && khoHai.hai.kho === "165" && khoHai.hai.tuDo === true && khoHai.hai.mm > 0,
  "SKU 1: khổ " + khoHai.mot.kho + " · SKU 2: khổ " + khoHai.hai.kho + " gsm " + khoHai.hai.gsm +
  " · ra " + khoHai.hai.mm + " mm");

/* ⑥ Tên hàng THIẾU định lượng → phải nói thẳng là thiếu, không đoán bừa */
const thieuGsm = await page.evaluate(() => {
  document.getElementById("cdGsm").value = "";
  const e = document.getElementById("cdSku"); e.value = "422265782";
  e.dispatchEvent(new Event("input", { bubbles: true }));
  return { gsm: document.getElementById("cdGsm").value, doc: document.getElementById("cdSkuDoc").textContent,
    state: document.getElementById("cdState").textContent.replace(/\s+/g, " ").trim() };
});
kiem("Tên hàng không ghi định lượng → nói thẳng \"không ghi định lượng\", KHÔNG đoán bừa",
  !thieuGsm.gsm && /không ghi định lượng/.test(thieuGsm.doc), thieuGsm.doc.replace(/\s+/g, " ").slice(0, 92));

/* ⑥b QUY CÁCH CUỘN NGUYÊN PHẢI THEO LOẠI HÀNG (user báo 23/08/2026).
   Trước đây hàng chip chôn cứng 2.500/3.000/5.000 m — quy cách của CHỈ MAY — và chip 5.000 m vẫn
   SÁNG khi chuyển sang Thun/Vải, tức máy lặng lẽ tính bằng cuộn chỉ. Nay đếm từ danh mục theo loại:
   chỉ giữ 3 chip đã chốt · thun có 100 m · vải không SKU nào ghi quy cách nên chỉ còn "Khác…". */
const chipQc = await page.evaluate(() => {
  const doc = () => ({ chip: [...document.querySelectorAll("#cdQCBar .kktab")].map((b) => b.textContent.trim()),
    sang: [...document.querySelectorAll("#cdQCBar .kktab.active")].map((b) => b.textContent.trim()), qc: CD.qc, tuDo: CD.tuDo });
  cdChonLoai("chi"); cdChonQC(5000000); const chi = doc();
  cdChonLoai("thun"); const thun = doc();
  cdChonLoai("vai"); const vai = doc();
  return { chi, thun, vai };
});
kiem("Chỉ may: giữ nguyên 3 chip quy cách đã chốt 22/08",
  chipQc.chi.chip.join("|") === "2,500|3,000|5,000|Khác…" && chipQc.chi.sang.join("") === "5,000",
  chipQc.chi.chip.join(" | "));
kiem("Thun: chip quy cách đếm từ danh mục Thun (100 m), KHÔNG mượn số của chỉ",
  chipQc.thun.chip.join("|") === "100|Khác…", chipQc.thun.chip.join(" | "));
kiem("Vải: danh mục không SKU nào ghi quy cách → chỉ còn \"Khác…\"",
  chipQc.vai.chip.join("|") === "Khác…", chipQc.vai.chip.join(" | "));
kiem("Đổi loại hàng thì BỎ luôn quy cách 5.000 m của chỉ (không tính lén bằng cuộn chỉ)",
  chipQc.thun.qc !== 5000000 && chipQc.thun.tuDo === true && chipQc.vai.qc !== 5000000,
  "thun qc=" + chipQc.thun.qc + " tuDo=" + chipQc.thun.tuDo + " · vải qc=" + chipQc.vai.qc);

/* ⑥c HỆ SỐ CÂN↔DÀI GHI SẴN TRONG TÊN HÀNG — 4 kiểu viết có thật trong danh mục (17 dòng) */
const hs = await page.evaluate(() => {
  const f = (pn) => { const h = NDS_ENGINE.heSoCan(pn); return h ? { chu: h.chu, gMet: Math.round(h.gMet * 1e4) / 1e4 } : null; };
  return {
    a: f("Thun chỉ/NSB#560/…/1kg-6700m/mm"), b: f("Chỉ quấn chân nút/MMS TF/None/Đen/None/22g-260m/None/pcs"),
    c: f("Chỉ thun/6300m - 1kg/cuộn"), d: f("Vải lót/95% Polyester/Mỏng 7m 1kg/W 160cm, 228gsm/Đen/g"),
    quyCach: f("Chỉ astra/Coats/Text 27 - 60-3/Cuộn 5000m"), khong: f("Thun lưng/Paiho/None/White/None/40mm/mm")
  };
});
kiem("Đọc được cả 4 kiểu ghi hệ số cân↔dài trong tên hàng",
  hs.a && hs.a.gMet === 0.1493 && hs.b && hs.b.gMet === 0.0846 && hs.c && hs.c.gMet === 0.1587 && hs.d && hs.d.gMet === 142.8571,
  ["1kg-6700m", "22g-260m", "6300m - 1kg", "7m 1kg"].map((k, i) => k + "→" + [hs.a, hs.b, hs.c, hs.d][i]?.gMet).join(" · "));
kiem("\"Cuộn 5000m\" là QUY CÁCH, KHÔNG phải hệ số cân — không được nhận nhầm",
  hs.quyCach === null && hs.khong === null, "cuộn 5000m → " + hs.quyCach + " · thun 40mm → " + hs.khong);

/* ⑥d Thun: gõ SKU có hệ số trong tên → tự điền g/m và NÓI RÕ lấy từ đâu */
const thunTen = await page.evaluate(() => {
  cdChonLoai("thun");
  const o = document.getElementById("cdSku"); o.value = "422295389"; o.dispatchEvent(new Event("input", { bubbles: true }));
  return { gm: document.getElementById("cdGm").value, doc: document.getElementById("cdSkuDoc").textContent.replace(/\s+/g, " ") };
});
kiem("Thun: tên hàng ghi \"1kg-6700m\" → tự điền 0,149 g/m và nói rõ \"1 kg = 6.700 m\"",
  Number(thunTen.gm) === 0.149 && /1 kg = 6\.700 m/.test(thunTen.doc), thunTen.gm + " g/m · " + thunTen.doc.slice(-64));

/* ⑦ THUN: cân 1 cuộn nguyên (quy cách 100 m, cân 520 gr cả lõi 40 gr) ⇒ 4,8 g/m, và NHỚ vào sổ tay */
await bam('#cdLoaiBar .kktab[data-loai="thun"]');
const rThun = await page.evaluate(() => {
  const e = document.getElementById("cdSku"); e.value = "422328160";
  e.dispatchEvent(new Event("input", { bubbles: true }));
  cdChonQC(0); document.getElementById("cdQC").value = "100";
  document.getElementById("cdQC").dispatchEvent(new Event("input", { bubbles: true }));
  const dat = (id, v) => { const o = document.getElementById(id); o.value = v; o.dispatchEvent(new Event("input", { bubbles: true })); };
  dat("cdGm", ""); dat("cdLoi", "40"); dat("cdNguyen", "520"); dat("cdCuon", "3"); dat("cdTong", "1000");
  return { mm: CD.mm, gMet: Math.round(CD.gMet * 1000) / 1000,
    soTay: JSON.parse(localStorage.getItem("cd-gm-sotay") || "{}") };
});
/* (1.000 − 3×40) = 880 gr ÷ 4,8 g/m = 183,333 m = 183.333 mm */
kiem("Thun: cân cuộn nguyên 100m/520gr (lõi 40) ⇒ 4,8 g/m → 880gr ra 183,333 mm",
  rThun.mm === 183333 && rThun.gMet === 4.8, rThun.mm + " mm · " + rThun.gMet + " g/m");
kiem("Cân xong thì NHỚ g/m theo SKU vào sổ tay (lần sau khỏi cân mẫu lại)",
  rThun.soTay["422328160"] && rThun.soTay["422328160"].gm === 4.8, JSON.stringify(rThun.soTay));

/* ⑧ Sổ tay: mở lại trang, gõ đúng SKU đó → tự điền g/m, khỏi cân cuộn nguyên nữa */
await page.reload({ waitUntil: "domcontentloaded" });
await bam("#ttCd");
const dungSoTay = await page.evaluate(() => {
  cdChonLoai("thun");
  const e = document.getElementById("cdSku"); e.value = "422328160";
  e.dispatchEvent(new Event("input", { bubbles: true }));
  return { gm: document.getElementById("cdGm").value, doc: document.getElementById("cdSkuDoc").textContent,
    soTay: document.getElementById("cdSoTay").textContent.replace(/\s+/g, " ").trim() };
});
kiem("Lần sau gõ SKU đó → g/m tự điền từ sổ tay, có nói rõ lấy từ sổ tay",
  Number(dungSoTay.gm) === 4.8 && /sổ tay/.test(dungSoTay.doc + dungSoTay.soTay),
  dungSoTay.gm + " g/m · " + dungSoTay.soTay.slice(0, 68));

/* ⑨ ĐẨY SANG IN TEM + UIDgr (user chốt 23/08: mã group in LÊN TEM).
   Bắt đầu bằng trang SẠCH: cụm Thun ở trên đã ghi quy cách 100m + cuộn nguyên vào localStorage, để
   nguyên thì cụm này đo nhầm trạng thái của cụm trước (bẫy đã dính một lần khi viết bộ đo này). */
await page.evaluate(() => { try { localStorage.removeItem("cd-quycach"); localStorage.removeItem("pr-list-v1"); } catch (e) {} });
await page.reload({ waitUntil: "domcontentloaded" });
await bam("#ttCd");
const daydi = await page.evaluate(() => {
  cdChonLoai("vai");
  const dat = (id, v) => { const o = document.getElementById(id); o.value = v; o.dispatchEvent(new Event("input", { bubbles: true })); };
  dat("cdSku", "422273473"); dat("cdUid", "1028260605000316");
  dat("cdTong", "25000"); dat("cdCuon", "1"); dat("cdLoi", "1000"); dat("cdNguyen", ""); dat("cdGm", "");
  const truoc = document.getElementById("cdBtnTem").disabled;
  cdInTem();
  const r = PR.sel["422273473"] || {};
  const tem = PR_TEM.mau(PR_TEM.MAU_MAC_DINH).ve({ sku: r.sku, pn: r.pn, sl: r.slHang, ngay: "23-08-26", uid: r.uid });
  return { truoc: truoc, sl: r.slHang, uid: r.uid, pn: String(r.pn || "").slice(0, 24),
    temCoUid: /UIDgr 1028260605000316/.test(tem.replace(/<[^>]+>/g, " ")),
    chip: (document.getElementById("prBody") || {}).textContent || "" };
});
kiem("Đẩy sang In tem: SKU + số mm vào danh sách in, kèm UIDgr",
  daydi.truoc === false && daydi.sl === "60606" && daydi.uid === "1028260605000316" && /Vải Rib/.test(daydi.pn),
  "sl " + daydi.sl + " · uid " + daydi.uid);
kiem("Con tem in RA CÓ dòng UIDgr (chuỗi nằm trong SVG tem)", daydi.temCoUid, daydi.temCoUid ? "có dòng UIDgr" : "KHÔNG thấy dòng UIDgr trong SVG");
kiem("Pop-up In tem hiện chip UIDgr để soi lại trước khi in", /UIDgr 1028260605000316/.test(daydi.chip), daydi.chip.replace(/\s+/g, " ").slice(0, 80));

/* ⑩ Không có SKU thì KHÔNG đẩy được (tem không có mã thì in ra vô nghĩa) */
const khongSku = await page.evaluate(() => {
  const dat = (id, v) => { const o = document.getElementById(id); o.value = v; o.dispatchEvent(new Event("input", { bubbles: true })); };
  dat("cdSku", "");
  return { nut: document.getElementById("cdBtnTem").disabled, mm: CD.mm };
});
kiem("Chưa có mã SKU → nút Đẩy sang In tem khoá lại (vẫn tính bình thường)",
  khongSku.nut === true && khongSku.mm > 0, "nút khoá: " + khongSku.nut + " · vẫn ra " + khongSku.mm + " mm");

/* ⑪ Đối chứng chéo của vải: cân cuộn nguyên vs định lượng danh nghĩa, lệch >5% là cờ đỏ */
const lechVai = await page.evaluate(() => {
  const dat = (id, v) => { const o = document.getElementById(id); o.value = v; o.dispatchEvent(new Event("input", { bubbles: true })); };
  cdChonQC(0); dat("cdQC", "100");                       // cuộn nguyên 100 m
  /* Khổ 180 KHÔNG nằm trong 3 chip → nó là ô "Khác…" (CD.khoTuDo=true, giá trị nằm trong ô gõ).
     Gán CD.kho=180 mà để ô rỗng là trạng thái không có thật — bẫy đã dính khi viết bộ đo này. */
  dat("cdGsm", "220"); dat("cdKho", "180");
  dat("cdNguyen", "50000"); dat("cdLoi", "1000");        // 49.000 gr/100 m = 490 g/m vs 396 g/m
  return { note: document.getElementById("cdNote").textContent.replace(/\s+/g, " ").trim(), mm: CD.mm };
});
kiem("Vải: cân cuộn nguyên lệch >5% với định lượng danh nghĩa → cờ đỏ nói cả hai số",
  /lệch nhau/.test(lechVai.note) && /g\/m/.test(lechVai.note), lechVai.note.slice(0, 104));

/* ---------- 12e. BỐ CỤC + ĐƠN VỊ + DẤU "MÁY ĐIỀN / CÒN PHẢI NHẬP" (user 23/08/2026) ---------- */
await page.reload({ waitUntil: "domcontentloaded" });
await page.evaluate(() => { try { localStorage.removeItem("cd-quycach"); } catch (e) {} });
await bam("#ttCd");
const boCuc = await page.evaluate(() => {
  const doi = (a, b) => {
    const x = document.getElementById(a).getBoundingClientRect(), y = document.getElementById(b).getBoundingClientRect();
    return Math.abs(x.top - y.top) < 6 && x.left !== y.left;
  };
  const nhan = (id) => document.querySelector('label[for="' + id + '"]').textContent.replace(/\s+/g, " ").trim();
  return { skuUid: doi("cdSku", "cdUid"), tongCuon: doi("cdTong", "cdCuon"), loiNguyen: doi("cdLoi", "cdNguyen"),
    nhanSku: nhan("cdSku"), nhanUid: nhan("cdUid") };
});
kiem("Ô giá trị NGẮN xếp hai-một-hàng (SKU/UIDgr · tổng/số cuộn · lõi/cuộn nguyên)",
  boCuc.skuUid && boCuc.tongCuon && boCuc.loiNguyen, JSON.stringify(boCuc).slice(0, 96));
kiem("Đã bỏ câu giải nghĩa dài ở nhãn Mã SKU và UIDgr",
  boCuc.nhanSku === "Mã SKU" && boCuc.nhanUid === "UIDgr code", boCuc.nhanSku + " · " + boCuc.nhanUid);

/* Chip ĐVT của khổ: cm ⇄ inch. Danh mục có 92 SKU ghi khổ bằng inch nên đây là đường thật, không
   phải tiện ích cho vui — bắt thủ kho tự nhân 2,54 là mời gọi sai số. */
const dvKho = await page.evaluate(() => {
  cdChonLoai("vai");
  const dat = (id, v) => { const o = document.getElementById(id); o.value = v; o.dispatchEvent(new Event("input", { bubbles: true })); };
  cdChonKho(0); dat("cdKho", "57"); dat("cdGsm", "230"); dat("cdTong", "10000"); dat("cdCuon", "1"); dat("cdLoi", "0");
  const cm = { dv: document.getElementById("cdKhoDv").textContent.trim(), mm: CD.mm };
  cdDoiDv("kho");                                   // → inch
  const inch = { dv: document.getElementById("cdKhoDv").textContent.trim(), mm: CD.mm,
    doc: document.getElementById("cdKhoDoc").textContent.replace(/\s+/g, " ").trim() };
  return { cm, inch };
});
/* 57cm × 230gsm = 131,1 g/m → 10.000 gr = 76,2776 m = 76.278 mm
   57 inch = 144,78 cm → 332,99 g/m → 30,0305 m = 30.031 mm */
kiem("Chip ĐVT khổ đổi cm ⇄ inch và KẾT QUẢ đổi theo (57cm vs 57 inch)",
  dvKho.cm.dv === "cm" && dvKho.inch.dv === "inch" && dvKho.cm.mm === 76278 && dvKho.inch.mm === 30031,
  "cm → " + dvKho.cm.mm + " mm · inch → " + dvKho.inch.mm + " mm");
kiem("Gõ bằng inch thì dòng soi nói rõ ra bao nhiêu cm", /144[.,]8 cm/.test(dvKho.inch.doc), dvKho.inch.doc.slice(0, 70));

/* Dấu phân biệt: số MÁY TỰ ĐIỀN (từ tên hàng) vs số NGƯỜI PHẢI NHẬP — bằng hình, không bằng chữ */
const dau = await page.evaluate(() => {
  cdDoiDv("kho");                                    // trả về cm
  ["cdTong", "cdCuon", "cdLoi", "cdKho", "cdGsm"].forEach((id) => {
    const o = document.getElementById(id); o.value = ""; o.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const o = document.getElementById("cdSku"); o.value = "422273473"; o.dispatchEvent(new Event("input", { bubbles: true }));
  const lay = (id) => { const e = document.getElementById(id); return { td: e.classList.contains("tu-dien"), cn: e.classList.contains("can-nhap"), v: e.value }; };
  const sau = { gsm: lay("cdGsm"), kho: lay("cdKho"), tong: lay("cdTong"), cuon: lay("cdCuon") };
  const g = document.getElementById("cdGsm"); g.value = "300"; g.dispatchEvent(new Event("input", { bubbles: true }));
  return { sau, goDe: lay("cdGsm") };
});
kiem("Số MÁY TỰ ĐIỀN từ tên hàng được đánh dấu riêng (khổ + định lượng)",
  dau.sau.gsm.td && dau.sau.kho.td && dau.sau.gsm.v === "220", "gsm " + dau.sau.gsm.v + " · khổ " + dau.sau.kho.v);
kiem("Ô CÒN PHẢI NHẬP được đánh dấu riêng (tổng cân · số cuộn đang trống)",
  dau.sau.tong.cn && dau.sau.cuon.cn && !dau.sau.tong.td, JSON.stringify(dau.sau.tong) + " " + JSON.stringify(dau.sau.cuon));
kiem("Gõ đè lên số máy điền → hết là \"máy điền\" (số đó giờ là của người dùng)",
  dau.goDe.td === false && dau.goDe.v === "300", JSON.stringify(dau.goDe));

/* PHIẾU TÍNH PHẢI LẦN LẠI ĐƯỢC BẰNG MÁY TÍNH CẦM TAY. Mật độ của vải là số nhỏ (2,469 mm/gr) —
   làm tròn 0 số lẻ thì dòng cuối đọc ra "23,400 gr × 2 mm/gr = 57,778 mm", ai kiểm cũng ra 46.800
   và kết luận máy tính sai. (Bẫy thật, thấy trên ảnh chụp 23/08.) */
const phieu = await page.evaluate(() => {
  cdChonLoai("vai");
  const dat = (id, v) => { const o = document.getElementById(id); o.value = v; o.dispatchEvent(new Event("input", { bubbles: true })); };
  /* ĐẶT trạng thái ô "Khác…", KHÔNG bấm `cdChonKho(0)` — nó là hành vi của ngón tay (bấm lại =
     tắt), gọi bừa thì tắt mất ô đang mở và bài đo lại đi đo trạng thái cũ còn sót trong DOM. */
  CD.khoTuDo = true; CD.kho = 0; CD.dvKho = "cm"; cdVeKhoChon(); cdVeDv();
  dat("cdKho", "135"); dat("cdGsm", "300");
  dat("cdTong", "25000"); dat("cdCuon", "2"); dat("cdLoi", "800"); dat("cdNguyen", "");
  const b = [...document.querySelectorAll("#cdSteps .cd-step")].map((e) => e.querySelector(".t").textContent + " → " + e.querySelector(".v").textContent);
  return { mm: CD.mm, cuoi: b[b.length - 1] || "", hint: document.getElementById("cdKQHint").textContent };
});
const soCuoi = (phieu.cuoi.match(/([\d.,]+)\s*gr\s*×\s*([\d.,]+)\s*mm\/gr/) || []).slice(1)
  /* Trang in số kiểu en-US: dấu PHẨY là hàng nghìn, dấu CHẤM là thập phân ("23,400" · "2.469").
     Bẫy đã dính: bộ đo bỏ mọi dấu đứng trước 3 chữ số ⇒ "2.469" thành 2469, sai 1.000 lần. */
  .map((x) => Number(String(x).replace(/,/g, "")));
kiem("Phiếu tính lần lại được bằng tay: gr × mm/gr ra ĐÚNG số mm cuối",
  soCuoi.length === 2 && Math.abs(soCuoi[0] * soCuoi[1] - phieu.mm) / phieu.mm < 0.005,
  phieu.cuoi.replace(/\s+/g, " "));
kiem("Mật độ nhỏ thì hiện đủ số lẻ (vải ≈ 2,469 mm/gr, không phải \"2\")",
  /2[.,]4\d/.test(phieu.hint), phieu.hint);

/* ---------- 13. Điện thoại: 1 cột, không tràn ngang ---------- */
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await bam("#ttCd");   /* do bo cuc thi phai dang dung o tab do, khong tin trang thai con lai tu buoc truoc */
await page.evaluate(() => window.dispatchEvent(new Event("resize")));
const dt = await page.evaluate(() => {
  const v = document.getElementById("viewCd");
  const o = Array.from(v.querySelectorAll("input, .kktab, .pg-seg")).filter((e) => e.offsetParent !== null).map((e) => e.getBoundingClientRect());
  return { hien: !v.hidden && v.offsetWidth > 0,
    ngang: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    cot: getComputedStyle(document.querySelector(".cd-grid")).gridTemplateColumns.split(" ").length,
    thap: Math.round(Math.min.apply(null, o.map((r) => r.height))), n: o.length };
});
kiem("Điện thoại: tab hiện, lưới 1 cột, không tràn ngang, control đủ cao để chạm",
  dt.hien && dt.cot === 1 && dt.ngang <= 2 && dt.thap >= 24,
  (dt.hien ? "hiện" : "ĐANG ẨN") + " · " + dt.cot + " cột · tràn " + dt.ngang + "px · " + dt.n +
  " control · thấp nhất " + dt.thap + "px");
if (LUU_ANH) await page.screenshot({ path: path.join(OUT, "can-mobile.png"), fullPage: true });
await page.setViewport({ width: 1360, height: 950 });
if (LUU_ANH) { await bam("#ttCd"); await page.screenshot({ path: path.join(OUT, "can-desktop.png"), fullPage: true }); }

/* ---------- 14. Không lỗi JS, không gọi mạng ---------- */
kiem("Không có lỗi JS nào trên trang", loiJS.length === 0, loiJS.slice(0, 3).join(" | "));
kiem("Tab tính đủ dù CHẶN sạch mạng (thủ kho mất mạng vẫn quy đổi được)", rc.mm === 28571429,
  raNgoai + " lượt ra internet đã bị chặn");

await browser.close();
const truot = ket.filter((k) => !k.ok).length;
console.log("\n" + (truot ? "✗ " : "✓ ") + (ket.length - truot) + "/" + ket.length + " mục đạt" +
  (truot ? " — " + truot + " mục TRƯỢT" : "") + (LUU_ANH ? "\n  ảnh: " + OUT : ""));
process.exit(truot ? 1 : 0);
