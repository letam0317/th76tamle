/**
 * qc-in-tem.mjs — KIỂM THỬ LÕI IN TEM SKU (khối `PR-TEM` trong `factory/index.html`).
 *
 *  Cách làm: CẮT khối giữa 2 mốc `PR-TEM` rồi chạy trong Node — test và bản in thật dùng chung
 *  một bản mã, không có bản sao nào để lệch nhau (giống cách `qc-nhan-dien-sku.mjs` làm với lõi
 *  đối soát).
 *
 *  Vì sao bộ này đáng có: mã vạch sai là loại lỗi IM LẶNG tệ nhất — tem in ra trông đẹp, dán lên
 *  hàng, tới lúc quét mới biết không đọc được, mà lúc đó cả cuộn tem đã dán hết. Nên:
 *    · bảng mẫu vạch Code 128 trong trang được đối chiếu với BẢN GỐC lưu ở `.code128-doi-chung.json`
 *      (lấy từ JsBarcode) — sai một bit là bắt được ngay;
 *    · checksum tính lại bằng CÔNG THỨC (không gọi hàm của trang) rồi so;
 *    · và có bước GIẢI MÃ NGƯỢC: đọc lại chuỗi vạch → ra đúng chuỗi ban đầu.
 *
 *  ⚠ Cái bộ test này KHÔNG thay được: quét thử một con tem bằng máy quét thật trước khi in loạt.
 *
 *  node qc-in-tem.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const F_HTML = path.join(DIR, "..", "factory", "index.html");
const F_DOI_CHUNG = path.join(DIR, ".code128-doi-chung.json");

const html = fs.readFileSync(F_HTML, "utf8");
const i1 = html.indexOf("/*<PR-TEM>*/"), i2 = html.indexOf("/*</PR-TEM>*/");
if (i1 < 0 || i2 < 0) { console.error("✗ Không thấy mốc PR-TEM trong factory/index.html"); process.exit(2); }
const nguon = html.slice(i1, i2);
const T = new Function(nguon + "\n return PR_TEM;")();
console.log("✓ Nạp lõi in tem từ factory/index.html (" + (nguon.length / 1024).toFixed(1) + " KB mã)");

let dat = 0, truot = 0;
const kiem = (ten, ok, chiTiet) => {
  if (ok) { dat++; console.log("  ✓ " + ten + (chiTiet ? "  — " + chiTiet : "")); }
  else { truot++; console.log("  ✗ " + ten + (chiTiet ? "  — " + chiTiet : "")); }
};
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ═══════════ 1. BẢNG MẪU VẠCH ═══════════ */
console.log("\n── 1. Bảng mẫu vạch Code 128 ──");
const goc = JSON.parse(fs.readFileSync(F_DOI_CHUNG, "utf8")).bars.map(String);
kiem("Bản gốc đối chứng có đủ 107 mẫu", goc.length === 107, goc.length + " mẫu · nguồn: " + JSON.parse(fs.readFileSync(F_DOI_CHUNG, "utf8")).nguon);

/* Lấy bảng của TRANG ra bằng chính hàm của nó: mã hoá một ký tự rồi đọc lại mẫu từng giá trị.
   `bit()` nối mẫu của các mã, nên mẫu của giá trị v = 11 ký tự đứng đúng chỗ. */
const mauCuaTrang = (v) => {
  /* dựng chuỗi 1 ký tự có giá trị v (v = mã ASCII - 32) rồi bóc phần giữa: [start][v][check][stop] */
  const ch = String.fromCharCode(v + 32);
  const b = T.bit(ch);
  return b.slice(11, 22);
};
let lechBang = [];
for (let v = 0; v <= 94; v++) {          // 0..94 là các ký tự in được của 128B
  if (mauCuaTrang(v) !== goc[v]) lechBang.push(v);
}
kiem("Mẫu vạch của trang khớp bản gốc ở cả 95 ký tự in được", lechBang.length === 0,
  lechBang.length ? "lệch ở giá trị: " + lechBang.slice(0, 10).join(",") : "0 lệch");
/* START_B và STOP kiểm riêng: chúng nằm ở hai đầu chuỗi */
const bMot = T.bit("A");
kiem("START_B đúng bản gốc (mã 104)", bMot.slice(0, 11) === goc[104], bMot.slice(0, 11) + " vs " + goc[104]);
kiem("STOP đúng bản gốc (mã 106, dài 13)", bMot.slice(-13) === goc[106], bMot.slice(-13) + " vs " + goc[106]);

/* Bất biến của chuẩn: mỗi mẫu 11 module, đúng 6 phần tử (3 vạch + 3 khoảng), bắt đầu bằng vạch. */
let viPham = [];
for (let v = 0; v <= 94; v++) {
  const m = mauCuaTrang(v);
  let pt = 1;
  for (let k = 1; k < m.length; k++) if (m[k] !== m[k - 1]) pt++;
  if (m.length !== 11 || pt !== 6 || m[0] !== "1" || m[10] !== "0") viPham.push(v);
}
kiem("Mọi mẫu đạt bất biến chuẩn (11 module · 6 phần tử · vạch trước)", viPham.length === 0,
  viPham.length ? "vi phạm: " + viPham.slice(0, 8).join(",") : "95/95 đạt");

/* ═══════════ 2. CHECKSUM ═══════════ */
console.log("\n── 2. Checksum (tính lại bằng công thức, không gọi hàm của trang) ──");
/* Checksum tính lại từ CHÍNH dãy mã (công thức chung của Code 128, không phụ thuộc subset):
   (mã_start + Σ vị_trí × giá_trị) mod 103. Từ 20/08/2026 mã toàn số đi subset C nên không còn giả
   định được "một ký tự = một mã" như trước. */
const checksumTay = (ma) => {
  let tong = ma[0];
  for (let i = 1; i < ma.length - 2; i++) tong += i * ma[i];
  return tong % 103;
};
for (const ca of ["12345", "422322192", "F9-5284", "A", "0000000000"]) {
  const ma = T.maHoa(ca);
  const mong = ma ? checksumTay(ma) : -1;
  kiem('maHoa("' + ca + '"): start hợp lệ · checksum ' + mong + ' · stop 106',
    !!ma && (ma[0] === 104 || ma[0] === 105) && ma[ma.length - 1] === 106 && ma[ma.length - 2] === mong,
    ma ? ma.join(" ") : "null");
}
kiem("Ký tự ngoài tầm 128B thì TRẢ NULL chứ không in bừa (vd chữ Đ)", T.maHoa("ĐVT") === null && T.svg("ĐVT") === "",
  "maHoa('ĐVT') = " + T.maHoa("ĐVT"));

/* ═══════════ 3. GIẢI MÃ NGƯỢC ═══════════ */
console.log("\n── 3. Giải mã ngược chuỗi vạch (dùng BẢNG GỐC, không dùng bảng của trang) ──");
const tra = new Map(goc.map((m, v) => [m, v]));
const giaiMa = (bits) => {
  if (bits.length < 11 * 3 + 2) return null;
  const than = bits.slice(0, bits.length - 13), stop = bits.slice(-13);
  if (tra.get(stop) !== 106) return null;
  if (than.length % 11) return null;
  const ma = [];
  for (let i = 0; i < than.length; i += 11) {
    const v = tra.get(than.substr(i, 11));
    if (v === undefined) return null;
    ma.push(v);
  }
  if (ma[0] !== 104 && ma[0] !== 105) return null;          // START_B hoặc START_C
  const check = ma[ma.length - 1], chu = ma.slice(1, -1);
  let tong = ma[0];
  for (let i = 0; i < chu.length; i++) tong += (i + 1) * chu[i];
  if (tong % 103 !== check) return null;
  /* Giải cả hai subset: C nhét 2 chữ số vào một mã (dùng cho SKU toàn số, mã vạch ngắn 25%), B là
     một ký tự ASCII một mã; mã 99 gặp giữa dòng B = chuyển sang C. */
  let cheDo = ma[0] === 105 ? "C" : "B", ra = "";
  for (const v of chu) {
    if (cheDo === "B" && v === 99) { cheDo = "C"; continue; }
    if (cheDo === "C") ra += String(v).padStart(2, "0");
    else ra += String.fromCharCode(v + 32);
  }
  return ra;
};
for (const ca of ["422322192", "422440680", "F9-5284", "JC01262", "8846295", "1", "ABC-123.4"]) {
  const lai = giaiMa(T.bit(ca));
  kiem('Vạch của "' + ca + '" giải ngược ra đúng chuỗi ban đầu', lai === ca, "đọc lại được: " + lai);
}
/* Đổi một bit rồi giải lại: phải KHÔNG ra chuỗi cũ (chứng minh phép giải mã thật sự đọc vạch) */
{
  const b = T.bit("422322192").split("");
  const i = 30; b[i] = b[i] === "1" ? "0" : "1";
  kiem("Đổi 1 module thì giải ngược KHÔNG còn ra chuỗi cũ (phép kiểm có hiệu lực)",
    giaiMa(b.join("")) !== "422322192", "kết quả: " + giaiMa(b.join("")));
}

/* ═══════════ 4. SVG ═══════════ */
console.log("\n── 4. SVG mã vạch ──");
{
  const sv = T.svg("422322192", { mm: 0.26, cao: 9 });
  const soRect = (sv.match(/<rect /g) || []).length;
  const bits = T.bit("422322192");
  let nhom = 0; for (let i = 0; i < bits.length; i++) if (bits[i] === "1" && bits[i - 1] !== "1") nhom++;
  kiem("SVG có đúng số vạch bằng số nhóm module đen", soRect === nhom, soRect + " rect / " + nhom + " nhóm");
  const w = Number((sv.match(/width="([\d.]+)mm"/) || [])[1]);
  kiem("Bề rộng SVG = số module × bề rộng module", Math.abs(w - bits.length * 0.26) < 0.01,
    w + "mm cho " + bits.length + " module");
  kiem("Có crispEdges (in ra máy in nhãn không bị nhoè cạnh)", /shape-rendering="crispEdges"/.test(sv));
  /* `xmlns="http://www.w3.org/2000/svg"` là khai báo namespace bắt buộc, KHÔNG phải tải gì về —
     nên bỏ nó ra trước khi soi xem còn địa chỉ ngoài nào. */
  const svKhongNs = sv.replace(/xmlns="[^"]*"/g, "");
  kiem("Không nhúng thư viện/ảnh/địa chỉ ngoài (chỉ rect thuần)", !/<image|xlink:href|https?:/.test(svKhongNs));
  /* Chiều rộng thực tế phải vừa khổ tem: 422322192 ở mẫu 50×30 phải nằm trong 50mm trừ lề 2mm×2 */
  kiem("Mã vạch của SKU 9 chữ số vừa khổ tem 50×30mm", w <= 46, w.toFixed(1) + "mm ≤ 46mm");
}

/* ═══════════ 5. MẪU TEM ═══════════ */
console.log("\n── 5. Mẫu tem ──");
const dl = { sku: "422322192", pn: "Dây kéo cước thuận #3/8846295_YKK/100% Polyester/None/Soft Citrus-345/Size 38cm/pcs", dv: "pcs", ngay: "20/08/2026" };
kiem("Có đủ 5 mẫu tem (các khổ giấy thật của kho) và mẫu mặc định nằm trong đó", Object.keys(T.MAU).length === 5 && !!T.MAU[T.MAU_MAC_DINH],
  Object.keys(T.MAU).join(", ") + " · mặc định " + T.MAU_MAC_DINH);
for (const k of Object.keys(T.MAU)) {
  const m = T.MAU[k], h = m.ve(dl, esc);
  const okKho = m.w >= 20 && m.w <= 120 && m.h >= 10 && m.h <= 80;
  kiem("Mẫu " + k + " (" + m.w + "×" + m.h + "mm): dựng được tem có mã SKU + mã vạch",
    okKho && h.indexOf(dl.sku) >= 0 && /<svg /.test(h), (m.ten || "") + " · " + h.length + " ký tự HTML");
  kiem("Mẫu " + k + " ghi khổ giấy vào tên để thủ kho không phải đoán", /[\d,.]+\s*×\s*[\d,.]+\s*mm/.test(m.ten), m.ten);
}
{
  /* Tên hàng có ký tự HTML thì phải bị escape — tem dựng bằng chuỗi HTML nên đây là chỗ dễ vỡ */
  const xau = { sku: "1", pn: '<script>alert(1)</script> & "x"', dv: "", ngay: "" };
  const h = T.MAU[T.MAU_MAC_DINH].ve(xau, esc);
  kiem("Tên hàng có <script> thì bị escape (không chèn được mã vào tem)",
    h.indexOf("<script") < 0 && h.indexOf("&lt;script") >= 0);
}
{
  /* Đổi 20/08/2026: tên hàng in NGUYÊN VĂN ("có sao ghi vậy"), nên KHÔNG được cắt chuỗi nữa —
     chống tràn bằng CSS (`.pr-pn5` giới hạn chiều cao + overflow), không bằng dấu "…" giữa tên. */
  const dai = { sku: "1", pn: "X".repeat(400), dv: "", ngay: "" };
  const h = T.MAU[T.MAU_MAC_DINH].ve(dai, esc);
  /* Đổi 20/08/2026 (bản SVG một nguồn): tem giờ là SVG, tên hàng được BẺ DÒNG rồi vẽ từng <text>,
     và cỡ chữ tự co để phủ đầy khung. Nên phép kiểm là: mọi ký tự của tên đều có mặt (không cắt,
     không "…"), và cỡ chữ đã co xuống mức nhỏ nhất cho tên cực dài. */
  const chuTrongSvg = (h.match(/>([^<]*)</g) || []).join("").replace(/[><]/g, "");
  const soX = (chuTrongSvg.match(/X/g) || []).length;
  const co = Number((h.match(/font-size="(\d+)"[^>]*>X/) || [])[1] || 0);
  kiem("Tên hàng cực dài: vẽ hết ký tự, không cắt, cỡ chữ tự co nhỏ nhất",
    soX >= 380 && h.indexOf("…") < 0 && co >= 7 && co <= 34, soX + "/400 ký tự X · cỡ chữ " + co + " dot (dải cho phép 7..34)");
}

/* ═══════════ 6. TÍNH TOÁN TRÊN DANH SÁCH CHỜ ═══════════ */
console.log("\n── 6. Danh sách chờ in ──");
const ds = [
  { sku: "1", sl: 3, mau: "t40x60" }, { sku: "2", sl: 1, mau: "t40x60" },
  { sku: "3", sl: 10, mau: "t42x25" }, { sku: "4", sl: 0, mau: "t40x60" },
];
kiem("tongTem đếm CON TEM chứ không đếm dòng", T.tongTem(ds) === 14, T.tongTem(ds) + " tem / " + ds.length + " dòng");
kiem("Số lượng âm hoặc rác không kéo tổng xuống dưới 0",
  T.tongTem([{ sl: -5 }, { sl: "x" }, { sl: 2 }]) === 2, String(T.tongTem([{ sl: -5 }, { sl: "x" }, { sl: 2 }])));
{
  const g = T.theoMau(ds);
  kiem("theoMau gom đúng theo khổ giấy (2 khổ khác nhau)", g.thuTu.length === 2 && g.m.t40x60.length === 3 && g.m.t42x25.length === 1,
    g.thuTu.join(" + "));
  kiem("Mẫu lạ/thiếu thì rơi về mẫu mặc định chứ không mất dòng",
    T.theoMau([{ sku: "9", sl: 1, mau: "khong-co-mau-nay" }]).thuTu[0] === T.MAU_MAC_DINH);
}
kiem("cat() cắt đúng và có dấu … để biết là đã cắt", T.cat("abcdef", 4) === "abc…" && T.cat("ab", 4) === "ab", T.cat("abcdef", 4));

/* ═══════════ 7. KHỔ TEM PHẢI LÀ KHỔ GIẤY THẬT ═══════════ */
console.log("\n── 7. Khổ tem khớp form BarTender của kho ──");
/* Bốn khổ dưới đây đọc ra từ chính các form .btw trên máy cắm máy in (DESKTOP-JE75K38, 20/08/2026).
   Khoá lại để sau này ai đổi khổ thì phải đổi cả ở đây — tránh in ra tem không vừa giấy đang lắp. */
const KHO_THAT = { t40x60: [40, 60], t42x62: [42.5, 62], t46x76: [46, 76], t42x25: [42, 25], t22x13: [21.6, 12.7] };
for (const k of Object.keys(KHO_THAT)) {
  const m = T.MAU[k];
  kiem("Mẫu " + k + " đúng khổ giấy thật " + KHO_THAT[k][0] + " × " + KHO_THAT[k][1] + " mm",
    !!m && m.w === KHO_THAT[k][0] && m.h === KHO_THAT[k][1], m ? m.w + " × " + m.h : "(không có mẫu này)");
}
kiem("Mẫu mặc định là tem 40 × 60 mm (đúng nhãn cuộn giấy đang lắp)", T.MAU_MAC_DINH === "t40x60", T.MAU_MAC_DINH);
kiem("Không còn khổ tự nghĩ nào (50×30 · 70×40 · 40×20)",
  !T.MAU.t50x30 && !T.MAU.t70x40 && !T.MAU.t40x20, Object.keys(T.MAU).join(", "));
/* Mã vạch phải vừa bề rộng của TỪNG khổ (tem mini là khổ chật nhất) */
for (const k of Object.keys(T.MAU)) {
  const m = T.MAU[k];
  const w = Number((T.svg("422322192", { mm: m.mm, cao: m.cao }).match(/width="([\d.]+)mm"/) || [])[1]);
  kiem("Mã vạch SKU 9 số vừa khổ " + k + " (" + m.w + "mm)", w <= m.w,
    w.toFixed(1) + "mm / " + m.w + "mm");
}

/* ═══════════ 8. GIẤY 2 TEM MỖI HÀNG (sự cố in thử 20/08/2026) ═══════════ */
console.log("\n── 8. Giấy decal 2 tem/hàng ──");
/* Lần in thử đầu tiên ra một con tem in ĐÈ lên cả hai tem: nửa dữ liệu ở tem trái, nửa ở tem phải.
   Gốc là một giả định sai — máy in nhãn chỉ dò khe NGANG giữa các hàng, nó coi cả hàng (2 tem + khe)
   là MỘT nhãn. Nên khổ đi vào @page / SIZE của TSPL phải là khổ HÀNG, không phải khổ một con tem. */
kiem("Giấy khai đúng 2 tem mỗi hàng", !!T.GIAY && T.GIAY.soCot === 2, JSON.stringify(T.GIAY));
{
  const kt = T.khoTrang("t40x60");
  kiem("Khổ MỘT HÀNG = 2 tem + khe (40 + 2 + 40 = 82mm × 60mm)",
    kt.w === 82 && kt.h === 60 && kt.cot === 2 && kt.khe === 2,
    kt.w + " × " + kt.h + " mm · " + kt.cot + " cột · khe " + kt.khe + "mm");
  kiem("Khổ hàng KHÁC khổ tem (đúng chỗ lần in thử làm sai)", kt.w !== kt.tem.w,
    "tem " + kt.tem.w + "mm vs hàng " + kt.w + "mm");
}
{
  const t = (n) => Array.from({ length: n }, (_, i) => ({ sku: "S" + i, sl: 1, mau: "t40x60" }));
  kiem("4 con tem → 2 hàng đầy", T.chiaHang(t(4), "t40x60").length === 2,
    JSON.stringify(T.chiaHang(t(4), "t40x60").map((h) => h.length)));
  const le = T.chiaHang(t(5), "t40x60");
  kiem("5 con tem → 3 hàng, hàng cuối 1 tem (ô còn lại chừa trắng, không in đè)",
    le.length === 3 && le[2].length === 1, JSON.stringify(le.map((h) => h.length)));
  kiem("1 con tem → 1 hàng", T.chiaHang(t(1), "t40x60").length === 1);
  kiem("0 con tem → 0 hàng", T.chiaHang([], "t40x60").length === 0);
}
{
  /* Giấy 1 cột (nếu sau này đổi cuộn): khổ hàng phải bằng khổ tem, không cộng khe */
  const cu = T.GIAY.soCot;
  T.GIAY.soCot = 1;
  const kt1 = T.khoTrang("t40x60");
  kiem("Đổi sang giấy 1 tem/hàng thì khổ hàng = khổ tem (không cộng khe)", kt1.w === 40 && kt1.cot === 1,
    kt1.w + "mm · " + kt1.cot + " cột");
  T.GIAY.soCot = cu;
}

/* ═══════════ 9. BA YÊU CẦU CHỐT 20/08/2026 (sau khi soi tem in thật) ═══════════ */
console.log("\n── 9. Một nguồn dựng tem · chữ tự phủ đầy · mã vạch đúng đơn vị ──");
{
  const d = { sku: "422430797", pn: "Quần mẫu FT/SMPA01/87% Nylon, 13% Lycra/None/Deep Black/Size S", dv: "Size S", ngay: "20/8/2026" };
  const svg = T.svgTem(d, "t40x60", { dotMm: 8 });
  kiem("svgTem trả về SVG đúng khổ tem tính bằng dot (40×60mm ở 203dpi = 320×480)",
    /width="320" height="480"/.test(svg), (svg.match(/width="\d+" height="\d+"/) || [])[0]);
  /* `ve()` của mẫu là CỬA DUY NHẤT: nó gọi svgTem kèm tuỳ chọn riêng của khổ đó (dịch trái 2mm...).
     Ca này khoá đúng chỗ agent từng đi tắt và làm mất phần dịch trái. */
  const svgLech = T.svgTem(d, "t40x60", { dotMm: 8, lechMm: 2 });
  kiem("ve() của mẫu = svgTem kèm ĐÚNG tuỳ chọn của khổ (dịch trái 2mm)",
    T.MAU.t40x60.ve(d) === svgLech, "khớp: " + (T.MAU.t40x60.ve(d) === svgLech));
  kiem("Bản không dịch KHÁC bản dịch trái (chứng minh lechMm có tác dụng)", svg !== svgLech);
  /* Mã vạch: module phải là SỐ NGUYÊN dot và bề rộng phải phủ gần hết bề ngang tem — bản đầu chia
     sai đơn vị (mm trong hệ toạ độ dot) nên cả mã vạch co thành một khối bé xíu. */
  const v = T.vachRect("422430797", { mm: 0.25, dotMm: 8, cao: 64, x: 12, y: 12 });
  kiem("vachRect: bề rộng module là SỐ NGUYÊN dot", !!v && Number.isInteger(v.modMm), v ? "module " + v.modMm + " dot" : "null");
  /* Sau khi chuyển sang subset C, điều đáng kiểm không còn là "phủ rộng" mà là CÒN ĐỦ VÙNG TRẮNG
     hai đầu: Code 128 cần quiet zone ≥ 10 lần bề rộng module, và nội dung còn bị dịch trái 2mm. */
  const quiet = (320 - v.rong) / 2 - 16;
  kiem("Mã vạch còn quiet zone ≥ 10 module cả hai đầu (kể cả sau khi dịch trái 2mm)",
    !!v && quiet >= v.modMm * 10,
    v ? "rộng " + v.rong + " dot · quiet zone " + Math.round(quiet) + " dot (cần ≥ " + v.modMm * 10 + ")" : "null");
  kiem("Mã vạch nằm TRONG svgTem (không nhờ lệnh BARCODE của máy in)",
    (svg.match(/<rect /g) || []).length > 20, (svg.match(/<rect /g) || []).length + " rect");
  /* Cỡ chữ tự co: tên ngắn phải được cỡ LỚN hơn tên dài */
  const nho = T.coChuVua("Chỉ may", 294, 288, 34, 7).co;
  const dai = T.coChuVua("X".repeat(300), 294, 288, 34, 7).co;
  kiem("Cỡ chữ tự phủ đầy khung: tên ngắn cỡ lớn hơn tên dài", nho > dai, "ngắn " + nho + " dot · dài " + dai + " dot");
  kiem("Cỡ chữ trong dải cho phép (7..34 dot)", nho <= 34 && dai >= 7, nho + " / " + dai);
  /* Bẻ dòng tại dấu "/" — tên hàng WMS ghép bằng "/" nên đó là chỗ ngắt tự nhiên */
  const dong = T.beDong("Lycra/None/Deep Black", 12);
  const ghep = dong.join("").replace(/\s/g, "");
  kiem("Bẻ dòng ngắt tại dấu / và KHÔNG mất ký tự nào",
    dong.every((x) => x.length <= 12) && ghep === "Lycra/None/DeepBlack", JSON.stringify(dong));
  /* DÒNG CHÂN đổi 20/08/2026: SỐ LƯỢNG (đậm, dán mép trái, cỡ TỰ CO) · NGÀY IN (dán mép phải, cỡ
     cố định nhỏ). Bỏ ĐVT và bỏ luôn chữ "Số lượng" — tem chật, chỉ in con số. */
  const svgSl = T.MAU.t40x60.ve({ sku: "422430797", pn: "Quần mẫu FT/SMPA01", sl: "1200", ngay: "20/8/2026" });
  kiem("Dòng chân in CON SỐ số lượng, không in chữ 'Số lượng' và không còn ĐVT",
    svgSl.indexOf(">1.200<") >= 0 && svgSl.indexOf("Số lượng") < 0 && svgSl.indexOf("ĐVT") < 0);
  kiem("Ngày in dán chết mép PHẢI (text-anchor=end)", /text-anchor="end"[^>]*>20\/8\/2026</.test(svgSl),
    (svgSl.match(/<text[^>]*text-anchor="end"[^>]*>[^<]*</) || ["(không thấy)"])[0].slice(0, 80));
  {
    /* Số lượng phải TỰ CO như mã SKU: số ngắn thì to, số dài thì nhỏ lại cho vừa tem. */
    /* Số lượng in ra là bản ĐÃ có dấu nghìn (1200 -> 1.200), nên phải tìm theo chuỗi đã định dạng. */
    const co = (sl) => {
      const svgX = T.MAU.t40x60.ve({ sku: "1", pn: "x", sl: sl, ngay: "20-08-26" });
      const dat = T.soGon(sl);
      const m = svgX.match(/font-size="(\d+)" font-weight="bold">([^<]+)</);
      return m && m[2] === dat ? Number(m[1]) : 0;
    };
    const c3 = co("120"), c8 = co("12345678");
    kiem("Số lượng tự co: 3 chữ số cỡ lớn hơn 8 chữ số", c3 > 0 && c8 > 0 && c3 > c8,
      "120 → " + c3 + " dot · 12345678 → " + c8 + " dot");
    kiem("Số lượng in ĐẬM", svgSl.indexOf('font-weight="bold">1.200<') >= 0);
  }
}

/* ═══════════ 10. SUBSET C — thu nhỏ mã vạch (20/08/2026) ═══════════ */
console.log("\n── 10. Code 128 subset C cho mã toàn số ──");
{
  const bC = T.bit("422430797");
  kiem("Mã 9 chữ số dùng subset C: 101 module (subset B sẽ là 134)", bC.length === 101, bC.length + " module");
  kiem("Mã có chữ vẫn dùng subset B (start 104)", T.maHoa("F9-5284")[0] === 104, "start = " + T.maHoa("F9-5284")[0]);
  kiem("Mã số CHẴN chữ số bắt đầu bằng START_C (105)", T.maHoa("12345678")[0] === 105, "start = " + T.maHoa("12345678")[0]);
  kiem("Mã số LẺ chữ số: START_B + 1 số + chuyển sang C (mã 99)",
    T.maHoa("123456789")[0] === 104 && T.maHoa("123456789")[2] === 99, T.maHoa("123456789").slice(0, 4).join(" "));
  /* Giải mã ngược bằng bảng gốc — phép kiểm quan trọng nhất: sai subset là máy quét ra sai số. */
  for (const ca of ["422430797", "422322192", "12345678", "1234", "F9-5284", "0000000000"]) {
    kiem('Giải ngược "' + ca + '" ra đúng chuỗi ban đầu', giaiMa(T.bit(ca)) === ca, "đọc lại: " + giaiMa(T.bit(ca)));
  }
  const w9 = T.vachRect("422430797", { mm: 0.25, dotMm: 8, cao: 64 }).rong;
  kiem("Bề rộng mã vạch SKU 9 số ≈ 25mm (trước 33,5mm)", w9 === 202, w9 + " dot = " + (w9 / 8).toFixed(1) + "mm");
}

/* ═══════════ 11. SỐ LƯỢNG · NGÀY IN · THỨ TỰ XẾP TEM (chốt 20/08/2026) ═══════════ */
console.log("\n── 11. Dấu nghìn · ngày dd-mm-yy · thứ tự xếp tem trên giấy đôi ──");
{
  /* Dấu chấm hàng nghìn — và phải giữ nguyên phần chữ nếu người gõ kèm đơn vị */
  const caSo = [["1200", "1.200"], ["85", "85"], ["1500000", "1.500.000"], ["999", "999"],
                ["1200 m", "1.200 m"], ["12,5", "12,5"], ["", ""], ["abc", "abc"]];
  for (const [vao, mong] of caSo) {
    kiem('soGon("' + vao + '") → "' + mong + '"', T.soGon(vao) === mong, "ra: " + T.soGon(vao));
  }
  /* Ngày in dd-mm-yy */
  kiem("ngayTem() ra đúng dạng dd-mm-yy", /^\d{2}-\d{2}-\d{2}$/.test(T.ngayTem()), T.ngayTem());
  kiem("ngayTem(ngày cụ thể) đúng số", T.ngayTem(new Date(2026, 7, 20)) === "20-08-26",
    T.ngayTem(new Date(2026, 7, 20)));
  /* Tem in ra phải mang bản ĐÃ định dạng, không phải chuỗi thô */
  const svg = T.MAU.t40x60.ve({ sku: "1", pn: "x", sl: "1200", ngay: T.ngayTem(new Date(2026, 7, 20)) });
  kiem("Tem in số lượng có dấu nghìn (1.200) chứ không phải 1200",
    svg.indexOf(">1.200<") >= 0 && svg.indexOf(">1200<") < 0);
  kiem("Tem in ngày dạng dd-mm-yy", svg.indexOf(">20-08-26<") >= 0);
  /* Ngày in nằm DÒNG DƯỚI số lượng (y lớn hơn) và dán mép phải */
  const ySL = Number((svg.match(/y="(\d+)" font-size="\d+" font-weight="bold">1\.200</) || [])[1] || 0);
  const yNg = Number((svg.match(/y="(\d+)" font-size="\d+" text-anchor="end">20-08-26</) || [])[1] || 0);
  /* Chốt lại 20/08/2026: ngày in nằm CÙNG HÀNG với số lượng nhưng dán SÁT VIỀN DƯỚI, mép phải.
     Bản tách hai hàng đã bỏ vì nó ăn thêm ~20 dot chiều cao, bóp nhỏ ô tên sản phẩm (thấy rõ trên
     tem in thử). Phép kiểm: cùng đường chân (y bằng nhau) và đường chân đó phải sát đáy tem. */
  kiem("Ngày in cùng hàng với số lượng, dán sát viền dưới",
    ySL > 0 && yNg === ySL && ySL >= 480 - 20, "y = " + ySL + " (tem cao 480 dot)");

  /* THỨ TỰ XẾP TEM trên giấy decal đôi (đúng mô tả người dùng 20/08/2026):
       1 con tem  -> hàng 1: [tem, TRỐNG]
       2 con tem  -> hàng 1: [A, B]
       3 con tem  -> hàng 1: [A, B] · hàng 2: [C, TRỐNG]
     Điền lần lượt trái → phải rồi xuống hàng; ô cuối thiếu thì chừa trắng chứ không in đè. */
  const t = (n) => Array.from({ length: n }, (_, i) => ({ sku: "SKU" + String.fromCharCode(65 + i), sl: 1, mau: "t40x60" }));
  const h1 = T.chiaHang(t(1), "t40x60");
  kiem("1 SKU → in 1 tem vật lý, tem còn lại TRỐNG",
    h1.length === 1 && h1[0].length === 1, JSON.stringify(h1.map((h) => h.map((x) => x.sku))));
  const h2 = T.chiaHang(t(2), "t40x60");
  kiem("2 SKU → tem trái = A, tem phải = B (cùng một hàng)",
    h2.length === 1 && h2[0][0].sku === "SKUA" && h2[0][1].sku === "SKUB",
    JSON.stringify(h2.map((h) => h.map((x) => x.sku))));
  const h3 = T.chiaHang(t(3), "t40x60");
  kiem("3 SKU → hàng 1 [A,B] · hàng 2 [C, trống]",
    h3.length === 2 && h3[0].length === 2 && h3[1].length === 1 && h3[1][0].sku === "SKUC",
    JSON.stringify(h3.map((h) => h.map((x) => x.sku))));
  const h5 = T.chiaHang(t(5), "t40x60");
  kiem("5 SKU → 3 hàng, thứ tự A B / C D / E + trống",
    h5.length === 3 && h5.flat().map((x) => x.sku).join(",") === "SKUA,SKUB,SKUC,SKUD,SKUE" && h5[2].length === 1,
    JSON.stringify(h5.map((h) => h.map((x) => x.sku))));
}

/* ══════════ NHIỀU SỐ LƯỢNG CHO CÙNG MỘT SKU ══════════
   Nhu cầu thật của kho: SKU A có 3 bịch 12 · 14 · 16 → 3 con tem cùng SKU khác số lượng. Đây là chỗ
   dễ lệch nhất giữa hai đầu (dashboard đếm số tem, agent nở ra tem) nên nở bằng ĐÚNG một hàm của lõi
   và khoá lại bằng test. */
{
  console.log("\n▸ Nhiều số lượng cho cùng một SKU");
  kiem('tachSl("12, 14, 16") → 3 số', T.tachSl("12, 14, 16").join("|") === "12|14|16", JSON.stringify(T.tachSl("12, 14, 16")));
  kiem('Dấu CHẤM là ngăn cách hàng nghìn, KHÔNG phải tách danh sách: "1.200" vẫn là MỘT số',
    T.tachSl("1.200").length === 1 && T.tachSl("1.200")[0] === "1.200", JSON.stringify(T.tachSl("1.200")));
  kiem('Khoảng trắng cũng tách được: "1200 1400" → 2 số', T.tachSl("1200 1400").length === 2, JSON.stringify(T.tachSl("1200 1400")));
  kiem('Chữ không phải số thì bỏ: "100 m" vẫn là MỘT số', T.tachSl("100 m").length === 1, JSON.stringify(T.tachSl("100 m")));
  kiem("Ô rỗng → không có số nào", T.tachSl("").length === 0 && T.tachSl(null).length === 0);

  const nhieu = { sku: "SKUA", pn: "hàng A", slHang: "12, 14, 16", sl: 1, mau: "t40x60" };
  const mot = { sku: "SKUB", pn: "hàng B", slHang: "1.200", sl: 3, mau: "t40x60" };
  kiem("Dòng nhiều số lượng: SỐ TEM do danh sách quyết định (3 số → 3 tem, bỏ qua ô số tem)",
    T.temCuaDong(nhieu) === 3, "temCuaDong = " + T.temCuaDong(nhieu));
  kiem("Dòng một số lượng: vẫn in đúng số bản người dùng gõ", T.temCuaDong(mot) === 3, "temCuaDong = " + T.temCuaDong(mot));
  kiem("Tổng số tem cộng đúng cả hai kiểu dòng", T.tongTem([nhieu, mot]) === 6, T.tongTem([nhieu, mot]) + " tem");

  const con = T.moRong([nhieu, mot]);
  kiem("moRong: mỗi số lượng RA MỘT con tem, đúng thứ tự người gõ",
    con.length === 6 && con.slice(0, 3).map((r) => r.slHang).join("|") === "12|14|16",
    con.map((r) => r.sku + ":" + r.slHang).join(" · "));
  kiem("moRong: dòng một số lượng thì 3 con tem GIỐNG nhau",
    con.slice(3).every((r) => r.sku === "SKUB" && r.slHang === "1.200"), con.slice(3).map((r) => r.slHang).join("|"));
  kiem("moRong giữ nguyên SKU và tên hàng cho từng con tem",
    con[1].sku === "SKUA" && con[1].pn === "hàng A", con[1].sku + " / " + con[1].pn);
  const svg = T.mau("t40x60").ve({ sku: con[1].sku, pn: con[1].pn, sl: con[1].slHang, ngay: T.ngayTem() });
  kiem("Con tem thứ 2 in ĐÚNG số lượng của nó (14), không phải của con thứ nhất",
    svg.indexOf(">14<") >= 0 && svg.indexOf(">12<") < 0, "tem 2 mang số " + con[1].slHang);
}

/* ══════════ MỘT LỆNH = MỘT LUỒNG TSPL LIỀN MẠCH ══════════
   User báo 20/08/2026: in 6 tem thì máy nhả 2 con, kéo decal trống về, mới nhả 2 con tiếp. Nguyên
   nhân: mỗi hàng giấy là một trang TSPL mang theo `SIZE`/`GAP` → máy in đo lại giấy mỗi lần.
   Ca test gọi thẳng agent ở chế độ `--thu` (không gửi máy in) rồi soi luồng byte thật sẽ gửi đi. */
{
  console.log("\n▸ Luồng TSPL của cả lệnh (chống nhả–rút decal giữa các cặp tem)");
  const { execFileSync } = await import("node:child_process");
  let ra = "";
  try {
    ra = execFileSync(process.execPath, [path.join(DIR, "in-tem-agent.mjs"), "--thu", "422430797x6"],
      { encoding: "utf8", windowsHide: true, timeout: 120000 });
  } catch (e) { ra = "LOI: " + String(e.message || e); }
  const f = path.join(process.env.TEMP || process.env.TMP || ".", "audit-factory-in-tem", "ca-lenh.tspl");
  const job = fs.existsSync(f) ? fs.readFileSync(f, "latin1") : "";
  kiem("6 con tem → 3 hàng giấy, dựng thành MỘT tệp lệnh", /6 con tem → 3 hàng giấy/.test(ra) && job.length > 0,
    job ? (job.length + " byte") : ra.slice(0, 80));
  kiem("Khai khổ (SIZE) đúng MỘT lần cho cả lệnh — không bắt máy in đo lại giấy giữa các hàng",
    (job.match(/SIZE /g) || []).length === 1, (job.match(/SIZE /g) || []).length + " lần SIZE");
  kiem("GAP cũng chỉ khai một lần, và có đơn vị ở CẢ HAI tham số",
    (job.match(/GAP /g) || []).length === 1 && /GAP [0-9.]+ mm,0 mm/.test(job),
    (job.match(/GAP[^\r\n]*/) || [""])[0]);
  kiem("Có SET TEAR OFF: bỏ cú đẩy tem ra thanh xé rồi kéo về sau mỗi nhãn", job.indexOf("SET TEAR OFF") >= 0);
  kiem("Mỗi hàng giấy vẫn có CLS + PRINT riêng (3 hàng → 3 lần)",
    (job.match(/CLS/g) || []).length === 3 && (job.match(/PRINT 1,1/g) || []).length === 3,
    (job.match(/CLS/g) || []).length + " CLS · " + (job.match(/PRINT 1,1/g) || []).length + " PRINT");
  kiem("Mỗi hàng có 2 khối BITMAP (2 con tem/hàng)", (job.match(/BITMAP /g) || []).length === 6,
    (job.match(/BITMAP /g) || []).length + " BITMAP");

  /* AGENT PHẢI NỞ ĐÚNG, KHÔNG CHỈ LÕI. Ca này có mặt vì lõi đã đúng mà tem in ra vẫn sai: tiến trình
     agent đang chạy là bản khởi động TRƯỚC lúc sửa mã, nên nó lấy nguyên chuỗi "12, 14, 16, 18" làm
     số in rồi lặp 4 lần — 4 con tem thật ra khỏi máy in giống hệt nhau. Số lượng nằm trong ảnh bitmap
     nên soi luồng TSPL không thấy; phải đọc danh sách con tem mà agent tự khai. */
  let ra3 = "";
  try {
    ra3 = execFileSync(process.execPath, [path.join(DIR, "in-tem-agent.mjs"), "--thu", "422430797@12/14/16"],
      { encoding: "utf8", windowsHide: true, timeout: 120000 });
  } catch (e) { ra3 = "LOI: " + String(e.message || e); }
  const liet = (ra3.match(/1\)[^\r\n]*/) || [""])[0];
  kiem("Agent nở đúng: 1 SKU · 3 số lượng → 3 con tem mang 12 / 14 / 16 (không phải 3 con giống nhau)",
    /3 con tem/.test(ra3) && /1\)\s*\S+\s*·\s*12\s*\|\s*2\)\s*\S+\s*·\s*14\s*\|\s*3\)\s*\S+\s*·\s*16/.test(liet),
    liet || ra3.slice(0, 90));
}

/* ══════════ PHÁN XỬ TÌNH TRẠNG MÁY IN ══════════
   Sự cố 21/08/2026: máy in hết giấy, dashboard không báo gì, người dùng bấm ép in 4 lần. Khối phán xử
   này là chỗ quyết định "có được gửi byte hay không", nên nó phải đúng với từng mã lỗi thật của
   Windows — mà mã lỗi thì không thể dựng lại bằng tay trên máy in thật (không thể tháo giấy ra rồi
   chạy test được). Nên: cắt khối `MAY-TT` trong agent ra rồi bơm trạng thái thô vào. */
{
  console.log("\n▸ Phán xử tình trạng máy in (từ số liệu thô của Windows)");
  const nguonMay = fs.readFileSync(path.join(DIR, "in-tem-agent.mjs"), "utf8");
  const m1 = nguonMay.indexOf("/*<MAY-TT>*/"), m2 = nguonMay.indexOf("/*</MAY-TT>*/");
  const px = new Function(nguonMay.slice(m1, m2) + "\n return phanXuMayIn;")();

  const ok = { may: "X", tt: "Normal", job: 0, err: 2, ext: 0, off: false, eps: 2, js: [], loi: "" };
  const r0 = px(ok);
  kiem("Máy bình thường → sẵn sàng, KHÔNG chặn", r0.chan === false && /sẵn sàng/.test(r0.chu), r0.chu);

  const hetGiay = px(Object.assign({}, ok, { err: 4 }));
  kiem("DetectedErrorState = 4 → \"HẾT GIẤY\" và CHẶN in", hetGiay.chan === true && /HẾT GIẤY/.test(hetGiay.chu), hetGiay.chu);
  const moNap = px(Object.assign({}, ok, { err: 7 }));
  kiem("DetectedErrorState = 7 → \"mở nắp\" và CHẶN in", moNap.chan === true && /MỞ NẮP/i.test(moNap.chu), moNap.chu);
  const ketGiay = px(Object.assign({}, ok, { err: 8 }));
  kiem("DetectedErrorState = 8 → \"kẹt giấy\" và CHẶN in", ketGiay.chan === true && /KẸT GIẤY/i.test(ketGiay.chu), ketGiay.chu);
  const ganHet = px(Object.assign({}, ok, { err: 3 }));
  kiem("Gần hết giấy → CẢNH BÁO nhưng VẪN in (đừng chặn oan)", ganHet.chan === false && ganHet.canh === true, ganHet.chu);

  const ttPaperOut = px(Object.assign({}, ok, { tt: "PaperOut" }));
  kiem("PrinterStatus = PaperOut → chặn (đường thứ hai, khi WMI không nói gì)", ttPaperOut.chan === true, ttPaperOut.chu);
  const tamDung = px(Object.assign({}, ok, { tt: "Paused" }));
  kiem("Queue TẠM DỪNG → chặn (byte vào queue rồi nằm đó, tem không ra)", tamDung.chan === true, tamDung.chu);
  const offline = px(Object.assign({}, ok, { off: true }));
  kiem("Máy in bị đặt OFFLINE → chặn", offline.chan === true && /OFFLINE/i.test(offline.chu), offline.chu);

  const jobXau = px(Object.assign({}, ok, { js: [{ id: 9, st: "Error, Offline", byte: 19320, tuoi: 5 }] }));
  kiem("Việc in mang cờ lỗi/offline → chặn, và nói rõ số việc", jobXau.chan === true && /#9/.test(jobXau.chu), jobXau.chu);
  const nghen = px(Object.assign({}, ok, { js: [{ id: 11, st: "Spooling", byte: 19320, tuoi: 120 }] }));
  kiem("Việc in nằm quá 45 giây → \"queue nghẽn\" và chặn (dấu hiệu lần hết giấy vừa rồi bỏ lọt)",
    nghen.chan === true && /nghẽn/.test(nghen.chu), nghen.chu);
  const jobMoi = px(Object.assign({}, ok, { job: 1, js: [{ id: 12, st: "Printing", byte: 19320, tuoi: 3 }] }));
  kiem("Việc in vừa gửi (3 giây, đang in) → KHÔNG chặn, chỉ báo đang in",
    jobMoi.chan === false && /đang in 1 việc/.test(jobMoi.chu), jobMoi.chu);

  const khongHoi = px(null);
  kiem("Không hỏi được máy in → cảnh báo, nhưng KHÔNG chặn (đừng vì đọc lỗi mà chặn cả đường in)",
    khongHoi.chan === false && khongHoi.canh === true, khongHoi.chu);
  const khongThay = px({ loi: "khong thay may in nao ten chua PE200" });
  kiem("Không thấy máy in nào → chặn và nói thẳng lý do", khongThay.chan === true, khongThay.chu);
}

console.log("\n" + (truot ? "✗ " + dat + "/" + (dat + truot) + " ca đạt — " + truot + " ca TRƯỢT" : "✓ " + dat + "/" + dat + " ca đạt"));
process.exit(truot ? 1 : 0);
