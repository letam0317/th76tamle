/**
 * qc-chimuc-cat-san.mjs — CHỈ MỤC CẤT SẴN (IndexedDB) PHẢI GIỐNG HỆT CHỈ MỤC VỪA DỰNG
 * ===========================================================================================
 *  Nền: 23/08/2026 tab Nhận diện SKU thôi dựng lại chỉ mục mỗi lần mở trang — dựng xong thì đóng
 *  gói cất vào IndexedDB, lần sau gắn lại (18ms thay vì 226ms). Cái đáng sợ không phải tốc độ mà
 *  là HẠN DÙNG: một gói cũ được tin là đúng thì lặng lẽ trả SKU sai.
 *
 *  Bộ này canh 4 điều, KHÔNG gọi mạng:
 *    ① gói → mở gói ra phải cho chỉ mục GIỐNG TỪNG BYTE với chỉ mục vừa dựng
 *    ② đối soát bằng chỉ mục mở từ gói phải ra Y HỆT kết quả (cùng SKU, cùng %)
 *    ③ vân danh mục đổi khi NỘI DUNG đổi (1 ký tự trong tên hàng, đổi status, thêm/bớt dòng)
 *       và KHÔNG đổi khi danh mục y nguyên (nếu không thì ngày nào cũng dựng lại vô ích)
 *    ④ vân lõi đổi khi lõi bóc từ khoá đổi — kể cả đổi trong BẢNG dữ liệu (cặp màu, từ bỏ)
 *
 *  node qc-chimuc-cat-san.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(DIR, "..", "factory", "index.html"), "utf8");
const nguonLoi = html.slice(html.indexOf("/*<NDS-ENGINE>*/"), html.indexOf("/*</NDS-ENGINE>*/"));

/* Lấy ĐÚNG mã nguồn tầng cất sẵn đang chạy trên trang (không chép lại — chép lại là đo bản khác) */
const dauKho = html.indexOf("var NDS_KHO_DB =");
const cuoiKho = html.indexOf("/* DỰNG CHỈ MỤC THEO LÔ", dauKho);
if (dauKho < 0 || cuoiKho < 0) { console.error("✗ Không tìm thấy khối CHỈ MỤC CẤT SẴN trong factory/index.html"); process.exit(2); }
const nguonKho = html.slice(dauKho, cuoiKho);

/* `document.scripts` giả: trên trang thật, vân lõi băm THẲNG mã nguồn của khối lõi trong thẻ
   <script> nội tuyến. Dựng lại đúng cảnh đó ở đây để đo chính đường đang chạy. Truyền
   `khongCoDocument` để đo đường lùi (không đọc được nguồn). */
function moiSan(nguonLoiThayThe, khongCoDocument) {
  const nguon = nguonLoiThayThe || nguonLoi;
  const doc = khongCoDocument ? "var document = undefined;\n"
    : "var document = { scripts: [ { textContent: __NGUON__ } ] };\n";
  /* `NDS` là hộp trạng thái của tab; ở đây chỉ cần nó là một object rỗng */
  const f = new Function("__NGUON__",
    nguon + "\n" + doc + "var NDS = {};\n" + nguonKho +
    "\nreturn { E:NDS_ENGINE, NDS:NDS, van:ndsVan, vanLoi:ndsVanLoi, vanDm:ndsVanDanhMuc, goi:ndsDongGoi, moGoi:ndsMoGoi, nguonLoi:ndsNguonLoi };");
  return f(nguon + "/*</NDS-ENGINE>*/");
}

const rowsGoc = JSON.parse(fs.readFileSync(path.join(DIR, ".sku-master-dry.json"), "utf8")).rows;
const mk = () => rowsGoc.map((r) => ({ sku: String(r[0]), pn: r[1], type: r[2], status: r[3], qty: Number(r[4]) || 0 }));

let dat = 0, hong = 0;
const ok = (ten, dung, ghiChu) => { if (dung) { dat++; console.log("  ✓ " + ten + (ghiChu ? "  — " + ghiChu : "")); } else { hong++; console.log("  ✗ " + ten + (ghiChu ? "  — " + ghiChu : "")); } };

const san = moiSan();
const { E, NDS } = san;

/* ───────── ① gói → mở gói: giống từng byte ───────── */
const dsA = mk();
const cmA = E.dungChiMuc(dsA);
NDS.van = san.van(dsA);
const goi = san.goi(cmA, dsA);
/* structuredClone là đúng thứ IndexedDB làm khi cất/đọc lại */
const goi2 = structuredClone(goi);
const dsB = mk();
const cmB = san.moGoi(goi2, dsB);

const anh = (cm, ds) => JSON.stringify({
  idx: cm.idx, tuVung: cm.tuVung, mauVung: cm.mauVung, gram: cm.gram, loiIdx: cm.loiIdx, ocrIdx: cm.ocrIdx,
  tuNgan: cm.tuNgan, theoSku: cm.theoSku, idf: cm.idf, idfGiua: cm.idfGiua, soDong: cm.soDong,
  b: ds.map((d) => d._b), dv: ds.map((d) => d._dv), k: ds.map((d) => d._k), pnc: ds.map((d) => d._pnc),
});
ok("mở gói ra = chỉ mục vừa dựng (từng byte)", !!cmB && anh(cmA, dsA) === anh(cmB, dsB),
  cmB ? (anh(cmA, dsA).length / 1048576).toFixed(2) + " MB" : "mở gói THẤT BẠI");

/* ───────── ② đối soát hai bên phải ra y hệt ───────── */
const NHAN = [
  { code: ["f9-5284"], spec: ["tex27", "tkt120", "60-3"], color: ["den"], brand: ["theseus", "irisa"] },
  { code: ["jc01262"], spec: ["17mm", "27l"], color: ["006"], brand: ["morito", "matt", "silver"] },
  { code: ["8846295"], spec: ["38cm"], color: ["345"], brand: ["ykk", "cmor-36"] },
  { code: ["8846295"], spec: ["38cm"], color: ["074"], brand: ["ykk"] },
  { code: [], spec: [], color: ["den"], brand: ["theseus"] },
  { code: ["cwpt0019"], spec: ["szxl"], color: ["trang"], brand: ["polyester"] },
  { code: [], spec: ["170gsm", "w150cm"], color: ["nguavoi"], brand: ["thun"] },
  { code: ["hkm-det.tt.10-163"], spec: [], color: [], brand: ["thun", "det"] },
  { code: ["3914"], spec: ["mm"], color: ["clear"], brand: ["bemis"] },
  { code: [], spec: [], color: [], brand: ["xxzzqq"] },
];
let lechKq = 0, viDu = "";
for (const nhan of NHAN) {
  for (const chiActive of [true, false]) {
    const ra = (cm) => JSON.stringify(E.timTop(nhan, cm, { soLuong: 3, chiActive }).map((x) => [x.sku, x.pct, x.pn]));
    const a = ra(cmA), b = ra(cmB);
    if (a !== b) { lechKq++; if (!viDu) viDu = a + " ≠ " + b; }
  }
}
ok("đối soát bằng chỉ mục mở từ gói ra kết quả y hệt", lechKq === 0,
  lechKq ? lechKq + " lượt lệch: " + viDu : NHAN.length * 2 + " lượt (Top 3 + %) trùng khít");

/* ───────── ③ vân DANH MỤC ───────── */
const van0 = san.van(mk());
ok("danh mục y nguyên → vân KHÔNG đổi (không dựng lại vô ích)", san.van(mk()) === van0, van0);

const doi1 = mk(); doi1[1234].pn = doi1[1234].pn.replace(/o/i, "0");       // sửa 1 ký tự trong tên hàng
ok("sửa 1 ký tự trong tên hàng → vân đổi", san.van(doi1) !== van0);
const doi2 = mk(); doi2[77].status = doi2[77].status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
ok("đổi STATUS 1 dòng → vân đổi", san.van(doi2) !== van0);
const doi3 = mk(); doi3[900].type = doi3[900].type === "COMBO" ? "NORMAL" : "COMBO";
ok("đổi TYPE 1 dòng → vân đổi", san.van(doi3) !== van0);
const doi4 = mk(); doi4.pop();
ok("bớt 1 dòng → vân đổi", san.van(doi4) !== van0);
const doi5 = mk(); doi5[10].sku = "999999999";
ok("đổi SKU 1 dòng → vân đổi", san.van(doi5) !== van0);
/* Bẫy nối chuỗi: "ab|c" và "a|bc" phải khác vân (nút ngăn giữa các trường) */
const doi6 = mk(); doi6[5] = { ...doi6[5], sku: doi6[5].sku + doi6[5].status, status: "" };
ok("dồn trường sang nhau (ab|c vs a|bc) → vân đổi", san.van(doi6) !== van0);

/* ───────── ④ vân LÕI ───────── */
const vanLoi0 = san.vanLoi();
ok("đọc được nguồn lõi từ thẻ <script> của trang", san.nguonLoi().length > 10000,
  Math.round(san.nguonLoi().length / 1024) + " KB được băm");
ok("cùng một lõi → vân lõi KHÔNG đổi", moiSan().vanLoi() === vanLoi0, vanLoi0);
/* Sửa NGUỒN HÀM */
const loiSuaHam = nguonLoi.replace("function bocTen(text){", "function bocTen(text){ /* sua */");
ok("sửa mã nguồn hàm bóc từ khoá → vân lõi đổi", moiSan(loiSuaHam).vanLoi() !== vanLoi0);
/* Sửa BẢNG DỮ LIỆU: thêm một cặp màu KHÔNG dính gì tới 3 dòng mẫu — nguồn hàm y nguyên, kết quả
   dựng thử cũng y nguyên; chỉ có băm cả khối nguồn mới bắt được. Đây đúng là ca đã trượt hôm
   23/08/2026 khi vân lõi mới chỉ băm mã nguồn từng hàm + bóc thử. */
const loiSuaBang = nguonLoi.replace("['mint','ngoc']]", "['mint','ngoc'],['nguavoi','ivory']]");
ok("sửa BẢNG (thêm cặp màu) → vân lõi đổi", moiSan(loiSuaBang).vanLoi() !== vanLoi0);
const loiSuaSo = nguonLoi.replace("var NDS_TRAN_UNG_VIEN", "var NDS_TRAN_UNG_VIEN_X");
ok("đổi một tên biến trong lõi → vân lõi đổi", loiSuaSo === nguonLoi || moiSan(loiSuaSo).vanLoi() !== vanLoi0);
/* Đường LÙI: trang không cho đọc nguồn (không có document) — vẫn phải bắt được sửa HÀM */
const vanLui = moiSan(null, true).vanLoi();
ok("không đọc được nguồn → vẫn có vân (đường lùi)", !!vanLui && vanLui !== vanLoi0, vanLui);
ok("đường lùi: sửa hàm → vân đổi", moiSan(loiSuaHam, true).vanLoi() !== vanLui);
ok("đường lùi: đổi kết quả dựng thử → vân đổi",
  moiSan(nguonLoi.replace("['cream','kem']", "['cream','kem'],['den','black2']"), true).vanLoi() !== vanLui);

/* ───────── ⑤ gói hỏng thì phải TỪ CHỐI, không chắp vá ───────── */
const hongThieu = structuredClone(goi); hongThieu.b.pop();
ok("gói thiếu dòng → từ chối (dựng lại)", san.moGoi(hongThieu, mk()) === null);
const hongRong = structuredClone(goi); hongRong.b[42] = null;
ok("gói có dòng rỗng → từ chối", san.moGoi(hongRong, mk()) === null);
const hongIdx = structuredClone(goi); delete hongIdx.idx;
ok("gói mất bảng chỉ mục → từ chối", san.moGoi(hongIdx, mk()) === null);

console.log("\n" + (hong ? "✗ " : "✓ ") + dat + "/" + (dat + hong) + " ca đạt");
process.exit(hong ? 1 : 0);
