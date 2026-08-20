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
const checksumTay = (s) => {
  let tong = 104;                                     // START_B
  for (let i = 0; i < s.length; i++) tong += (i + 1) * (s.charCodeAt(i) - 32);
  return tong % 103;
};
for (const ca of ["12345", "422322192", "F9-5284", "A", "0000000000"]) {
  const ma = T.maHoa(ca);
  const mongCheck = checksumTay(ca);
  kiem('maHoa("' + ca + '") ra đúng dãy mã + checksum ' + mongCheck,
    !!ma && ma[0] === 104 && ma[ma.length - 1] === 106 && ma[ma.length - 2] === mongCheck && ma.length === ca.length + 3,
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
  if (ma[0] !== 104) return null;
  const check = ma[ma.length - 1], chu = ma.slice(1, -1);
  let tong = 104;
  for (let i = 0; i < chu.length; i++) tong += (i + 1) * chu[i];
  if (tong % 103 !== check) return null;
  return chu.map((v) => String.fromCharCode(v + 32)).join("");
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
kiem("Có đủ 4 mẫu tem (bốn khổ giấy thật của kho) và mẫu mặc định nằm trong đó", Object.keys(T.MAU).length === 4 && !!T.MAU[T.MAU_MAC_DINH],
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
  const dai = { sku: "1", pn: "X".repeat(400), dv: "", ngay: "" };
  const h = T.MAU[T.MAU_MAC_DINH].ve(dai, esc);
  kiem("Tên hàng rất dài bị cắt (không tràn khỏi con tem)", h.indexOf("X".repeat(200)) < 0 && /…/.test(h),
    "độ dài HTML " + h.length);
}

/* ═══════════ 6. TÍNH TOÁN TRÊN DANH SÁCH CHỜ ═══════════ */
console.log("\n── 6. Danh sách chờ in ──");
const ds = [
  { sku: "1", sl: 3, mau: "t42x62" }, { sku: "2", sl: 1, mau: "t42x62" },
  { sku: "3", sl: 10, mau: "t42x25" }, { sku: "4", sl: 0, mau: "t42x62" },
];
kiem("tongTem đếm CON TEM chứ không đếm dòng", T.tongTem(ds) === 14, T.tongTem(ds) + " tem / " + ds.length + " dòng");
kiem("Số lượng âm hoặc rác không kéo tổng xuống dưới 0",
  T.tongTem([{ sl: -5 }, { sl: "x" }, { sl: 2 }]) === 2, String(T.tongTem([{ sl: -5 }, { sl: "x" }, { sl: 2 }])));
{
  const g = T.theoMau(ds);
  kiem("theoMau gom đúng theo khổ giấy (2 khổ khác nhau)", g.thuTu.length === 2 && g.m.t42x62.length === 3 && g.m.t42x25.length === 1,
    g.thuTu.join(" + "));
  kiem("Mẫu lạ/thiếu thì rơi về mẫu mặc định chứ không mất dòng",
    T.theoMau([{ sku: "9", sl: 1, mau: "khong-co-mau-nay" }]).thuTu[0] === T.MAU_MAC_DINH);
}
kiem("cat() cắt đúng và có dấu … để biết là đã cắt", T.cat("abcdef", 4) === "abc…" && T.cat("ab", 4) === "ab", T.cat("abcdef", 4));

/* ═══════════ 7. KHỔ TEM PHẢI LÀ KHỔ GIẤY THẬT ═══════════ */
console.log("\n── 7. Khổ tem khớp form BarTender của kho ──");
/* Bốn khổ dưới đây đọc ra từ chính các form .btw trên máy cắm máy in (DESKTOP-JE75K38, 20/08/2026).
   Khoá lại để sau này ai đổi khổ thì phải đổi cả ở đây — tránh in ra tem không vừa giấy đang lắp. */
const KHO_THAT = { t42x62: [42.5, 62], t46x76: [46, 76], t42x25: [42, 25], t22x13: [21.6, 12.7] };
for (const k of Object.keys(KHO_THAT)) {
  const m = T.MAU[k];
  kiem("Mẫu " + k + " đúng khổ giấy thật " + KHO_THAT[k][0] + " × " + KHO_THAT[k][1] + " mm",
    !!m && m.w === KHO_THAT[k][0] && m.h === KHO_THAT[k][1], m ? m.w + " × " + m.h : "(không có mẫu này)");
}
kiem("Mẫu mặc định là tem SKU 42,5 × 62 mm (khổ của sku.btw đang dùng)", T.MAU_MAC_DINH === "t42x62", T.MAU_MAC_DINH);
kiem("Không còn khổ tự nghĩ nào (50×30 · 70×40 · 40×20)",
  !T.MAU.t50x30 && !T.MAU.t70x40 && !T.MAU.t40x20, Object.keys(T.MAU).join(", "));
/* Mã vạch phải vừa bề rộng của TỪNG khổ (tem mini là khổ chật nhất) */
for (const k of Object.keys(T.MAU)) {
  const m = T.MAU[k];
  const w = Number((T.svg("422322192", { mm: m.mm, cao: m.cao }).match(/width="([\d.]+)mm"/) || [])[1]);
  kiem("Mã vạch SKU 9 số vừa khổ " + k + " (" + m.w + "mm)", w <= m.w,
    w.toFixed(1) + "mm / " + m.w + "mm");
}

console.log("\n" + (truot ? "✗ " + dat + "/" + (dat + truot) + " ca đạt — " + truot + " ca TRƯỢT" : "✓ " + dat + "/" + dat + " ca đạt"));
process.exit(truot ? 1 : 0);
