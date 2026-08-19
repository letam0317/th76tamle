/**
 * qc-chuyen-doi-can.mjs — SMOKE TEST tab "Chuyển đổi cân" TRONG TRÌNH DUYỆT THẬT (Edge headless).
 *  Tab này không gọi mạng, nhưng chỗ dễ sai lại là TOÁN và cách ĐỌC SỐ NGƯỜI GÕ — sai một dấu phân
 *  cách là lệch 1.000 lần và con số đó đi thẳng vào phiếu kiểm kê. Nên bộ test bám 4 nhóm:
 *    1) bộ đọc số: "2.500.000" · "2,500,000" · "2500000" · "10,5" đều phải ra đúng
 *    2) công thức: đúng ví dụ thật (10kg · 10 cuộn · lõi 50gr · cuộn nguyên 5.000.000mm/120gr)
 *    3) nút "cân cả lõi / chỉ riêng chỉ" đổi kết quả 1,7 lần — chọn sai là sai to
 *    4) cờ đỏ khi số liệu vô lý + 2 ca không tính được (lõi ≥ cuộn nguyên · cân ≤ tổng lõi)
 *  Thêm: thanh chân trang ẩn hẳn ở 2 tab Công cụ kho, ghi nhớ quy cách qua F5, "Lô tiếp theo" chỉ xoá 2 ô của lô, bố cục điện thoại, chân trang.
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
  return { mm: CD.mm, tiles: document.getElementById("cdTiles").hidden, note: document.getElementById("cdNote").textContent.trim() };
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
   10kg · 10 cuộn · lõi 50gr · cuộn nguyên 5.000.000mm nặng 120gr (cân cả lõi)
   -> chỉ trong cuộn nguyên 70gr -> 1 gram = 71.428,57mm; lô còn 9.500gr chỉ -> 678.571.429mm */
const r1 = await go({ cdTong: "10", cdCuon: "10", cdLoi: "50", cdNguyen: "120" });
kiem("Công thức (cân cả lõi): 10kg/10 cuộn/lõi 50gr/nguyên 120gr → 678,571,429 mm",
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
const r3 = await go({ cdTong: "0,9", cdCuon: "10" });      // 900gr - 500gr lõi = 400gr chỉ
kiem("Lô hợp lý 0,9kg/10 cuộn → 28,571,429 mm (5,71 cuộn nguyên), hết cờ đỏ",
  r3.mm === 28571429 && !/vô lý/.test(r3.note), r3.mm + " mm · " + (r3.note ? r3.note.slice(0, 40) : "không cờ"));
const the = await page.evaluate(() => Array.from(document.querySelectorAll("#cdTiles .abntile")).map((e) => e.querySelector(".k").textContent.trim()));
kiem("4 thẻ kết quả: mm · m · cuộn tương đương · trung bình mỗi cuộn",
  the.length === 4 && the[0] === "28,571,429 mm" && the[1] === "28,571.4 m" && the[2] === "5.71 cuộn" && /^2,857,143 mm$/.test(the[3]),
  the.join(" | "));

/* ---------- 8. Hai ca KHÔNG tính được — phải dừng, không trả số âm ---------- */
const ca1 = await go({ cdLoi: "150" });                     // lõi 150gr ≥ cuộn nguyên 120gr
kiem("Lõi ≥ cuộn nguyên → dừng, chỉ đường sang nút \"chỉ riêng chỉ\"",
  ca1.mm === 0 && ca1.tiles === true && /Không tính được/.test(ca1.note) && /riêng phần chỉ/.test(ca1.note), ca1.note.slice(0, 90));
const ca2 = await go({ cdLoi: "50", cdTong: "0,4", cdCuon: "10" });   // 400gr < 500gr lõi
kiem("Cân cả lô ≤ tổng khối lượng lõi → dừng, nhắc kiểm đơn vị kg/gr",
  ca2.mm === 0 && /Không tính được/.test(ca2.note) && /kg\/gr/.test(ca2.note), ca2.note.slice(0, 90));

/* ---------- 9. Đơn vị gr + quy cách khác ---------- */
await bam("#cdDvG");
const rG = await go({ cdTong: "900", cdCuon: "10" });
kiem("Đổi đơn vị sang gr: 900gr cho kết quả y như 0,9kg", rG.mm === 28571429, rG.mm + " mm");
await bam("#cdDvKg");
await bam('#cdQCBar .kktab[data-mm="2500000"]');
const r25 = await go({ cdTong: "0,9" });
kiem("Đổi quy cách 2,500,000 mm: mật độ đổi theo, kết quả bằng nửa",
  r25.mm === 14285714, r25.mm + " mm (đúng nửa của 5,000,000 mm)");
const tuDo = await page.evaluate(() => { document.querySelector('#cdQCBar .kktab[data-mm="0"]').click();
  const o = document.getElementById("cdQC"); o.value = "1.000.000"; o.dispatchEvent(new Event("input", { bubbles: true }));
  return { hienO: !document.getElementById("cdQCRow").hidden, mm: CD.mm }; });
kiem("Quy cách \"Khác…\": mở ô gõ tay, nhận 1.000.000 (dấu chấm)", tuDo.hienO && tuDo.mm === 5714286, tuDo.mm + " mm");

/* ---------- 10. Ghi nhớ quy cách qua F5, KHÔNG nhớ số cân của lô ---------- */
await bam('#cdQCBar .kktab[data-mm="5000000"]');
await go({ cdTong: "0,9", cdCuon: "10", cdLoi: "50", cdNguyen: "120" });
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
await go({ cdTong: "0,9", cdCuon: "10" });
const sauLo = await page.evaluate(() => { cdXoaLo(); return { tong: document.getElementById("cdTong").value,
  cuon: document.getElementById("cdCuon").value, loi: document.getElementById("cdLoi").value, nguyen: document.getElementById("cdNguyen").value }; });
kiem("\"Lô tiếp theo\": xoá tổng kg + số cuộn, giữ lõi + cuộn nguyên",
  !sauLo.tong && !sauLo.cuon && sauLo.loi === "50" && sauLo.nguyen === "120", JSON.stringify(sauLo));

/* ---------- 12. Copy ra số mm TRƠN (dán vào WMS là vào thẳng) ---------- */
const rc = await go({ cdTong: "0,9", cdCuon: "10" });
const copy = await page.evaluate(async () => {
  let bat = null;
  /* navigator.clipboard la getter CHI DOC: gan thang khong an (that bai im lang) */
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: (t) => { bat = t; return Promise.resolve(); } } });
  cdCopy(); return bat;
});
kiem("Copy mm ra số trơn, không dấu phân cách", copy === String(rc.mm), JSON.stringify(copy));

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
