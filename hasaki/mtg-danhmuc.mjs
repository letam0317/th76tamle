/**
 * mtg-danhmuc.mjs — DANH MỤC VỊ TRÍ KHO NGUYÊN LIỆU (F0-KHO-*) theo MẶT BẰNG THẬT.
 *
 * NGUỒN: bản vẽ AutoCAD `MTG_zigzag.pdf` (1 trang vector, 1728×2592pt). `pdf-mtg-boc.mjs`
 * giải nén content stream, giải Identity-H bằng ToUnicode CMap rồi bóc 163 nhãn + 1.865 đoạn
 * thẳng; các nhãn số được gom theo toạ độ x thành từng dãy kệ.
 *
 * VÌ SAO LẤY DANH MỤC TỪ BẢN VẼ, KHÔNG LẤY TỪ DỮ LIỆU:
 * Bài học F0-A8 (07/08/2026): nếu dựng danh mục từ chính dữ liệu yêu cầu vệ sinh thì vị trí bị
 * NGỪNG phát yêu cầu sẽ lặng lẽ biến mất khỏi sơ đồ — đúng cái cần phát hiện lại thành cái không
 * nhìn thấy. Mặt bằng là sự thật độc lập, phải đến từ bản vẽ.
 *
 * ĐÃ ĐỐI CHIẾU (07/08/2026): 332 mã F0-KHO có thật trong dữ liệu kiểm kê factory (.pc-cache.json,
 * kho 1339 WH-MATERIAL-GARMENT + 1177 WH-MATERIAL-MTG) — 100% nằm trong danh mục này, không mã nào
 * rơi ra ngoài. Dữ liệu chỉ phủ được các cột từng kiểm kê nên HẸP HƠN bản vẽ, đúng như dự đoán.
 *
 * KHOÁ Ô = "F0-KHO-<dãy>-<cột>": 1 ô trên sơ đồ = 1 Ô KỆ nhìn từ trên xuống, gộp mọi tầng
 * (mã thật có thêm tầng 01–05/07 và ô 01). Bản vẽ cũng chỉ đánh số tới mức cột.
 */

/** Mỗi dãy: soCot = số cột trên bản vẽ · loiDi = sau cột này có lối đi ngang (cắt khối) */
export const DAY = [
  { d: "501", soCot: 15, loiDi: 9 },
  { d: "502", soCot: 14, loiDi: 9 },
  { d: "503", soCot: 14, loiDi: 9 },
  { d: "504", soCot: 14, loiDi: 9 },
  { d: "505", soCot: 14, loiDi: 9 },
  { d: "506", soCot: 13, loiDi: 9 },
  { d: "507", soCot: 13, loiDi: 9 },
  { d: "507A", soCot: 7, loiDi: 0 },
  { d: "508", soCot: 6, loiDi: 0 },
  { d: "509", soCot: 9, loiDi: 0 },
  { d: "510", soCot: 9, loiDi: 0 },
  { d: "511", soCot: 9, loiDi: 0 },
  { d: "512", soCot: 9, loiDi: 0 },
  { d: "513", soCot: 15, loiDi: 13 },
];

/** Cụm kệ LƯNG GIÁP LƯNG đúng bản vẽ (dãy lẻ đứng một mình, cặp dùng chung lối đi) */
export const CUM = [["501"], ["502", "503"], ["504", "505"], ["506", "507"], ["507A"],
  ["508"], ["509", "510"], ["511", "512"], ["513"]];

/** Khu chức năng không phải kệ (bản vẽ có nhãn, đưa vào sơ đồ cho đúng mặt bằng) */
export const KHU = [
  { k: "PKS", lb: "Phòng kiểm soát kho" },
  { k: "PO", lb: "Khu PO · Đồng kiểm" },
];

const p2 = (n) => (n < 10 ? "0" : "") + n;
/** Khoá ô của 1 mã vị trí đầy đủ: F0-KHO-513-01-04-01 → F0-KHO-513-01 */
export function khoaO(loc) {
  const m = String(loc || "").match(/^(F0-KHO-[0-9A-Za-z]+-\d{2})/i);
  return m ? m[1].toUpperCase() : String(loc || "").toUpperCase();
}
/** Toàn bộ ô của mặt bằng: [{ loc, day, cot }] — 161 ô */
export function danhSachO() {
  const out = [];
  for (const r of DAY) for (let c = 1; c <= r.soCot; c++) out.push({ loc: "F0-KHO-" + r.d + "-" + p2(c), day: r.d, cot: p2(c) });
  return out;
}
export const TONG_O = DAY.reduce((a, r) => a + r.soCot, 0);
