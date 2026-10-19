/* TU-01 (user 02/10, nhắc lại 05/10 "TAO ĐÃ YÊU CẦU CHUYỂN TỪ CẤT SANG TỪ GÌ"): từ ngữ chuẩn cho MỌI chữ máy viết về
 * hàng vào ô — chú thích clip, phụ đề, lý do gợi ý, bình luận phiếu, dashboard.
 *   "cất" (hàng vào ô)            → "châm hàng"
 *   "không ai lấy hàng ở thùng"  → "không ai tác động thùng";  "ai cất/lấy" → "ai tác động"
 * Dùng: import { chuanTu, chuanTuSau } from "./tu-ngu.mjs"; chuanTu(chuoi) · chuanTuSau(object) (đi hết chuỗi lồng nhau).
 * QC: node qc-tu-ngu.mjs (báo chỗ còn sót, thoát 1). Chỉ áp cho chữ về hàng/ô — "cất" nghĩa lưu tệp/cache ở mã nguồn không đụng. */
const LUAT = [
  [/không ai lấy hàng ở thùng/gi, "không ai tác động thùng"],
  [/ai cất\s*\/\s*lấy/gi, "ai tác động"],
  [/cất\s*\/\s*châm/gi, "châm hàng"],
  [/CẤT HÀNG/g, "CHÂM HÀNG"],
  [/Cất hàng/g, "Châm hàng"],
  [/cất hàng/gi, "châm hàng"],
  [/cất (\d)/gi, "châm $1"],          // "cất 6 cái" → "châm 6 cái"
  [/cất ≥/gi, "châm ≥"],
  [/\bCẤT\b/g, "CHÂM HÀNG"],
  [/Cất/g, "Châm hàng"],
  [/cất/g, "châm hàng"],
];
export function chuanTu(s) {
  if (typeof s !== "string" || !/cất|CẤT|Cất|lấy hàng ở thùng/.test(s)) return s;
  for (const [a, b] of LUAT) s = s.replace(a, b);
  return s.replace(/châm hàng hàng/g, "châm hàng").replace(/châm hàng vào ô/g, "châm hàng vào ô");
}
export function chuanTuSau(o) {
  if (typeof o === "string") return chuanTu(o);
  if (Array.isArray(o)) return o.map(chuanTuSau);
  if (o && typeof o === "object") { const r = {}; for (const k of Object.keys(o)) r[k] = chuanTuSau(o[k]); return r; }
  return o;
}
export const CAM = /cất|CẤT|Cất|không ai lấy hàng ở thùng/;
/* TU-01 · tên LOẠI TÁC ĐỘNG vào ô (dòng ai tác động, phụ đề clip, thẻ phiếu — hasaki-xacminh.js loaiTD). 19/10 user DUYỆT tách «trả hàng đơn huỷ»
 * khỏi «châm hàng»: phân theo LOẠI LỆNH WMS trước, rồi mới tới khu nguồn (KHÔNG gộp chung thành «lượt châm»). */
export const LOAI_TAC_DONG = [
  { ten: "châm hàng", nhan: "lệnh PUSH_MASTER (Châm từ kho tổng) — nguồn IT, PO/kho tổng, pallet, ô khác" },
  { ten: "trả hàng đơn huỷ", nhan: "lệnh REPUSH_ORDER_CANCEL_PUSH (Trả hàng đơn huỷ) — đưa thẳng từ giỏ F0-PA vào ô" },
  { ten: "soạn hàng", nhan: "lấy hàng ra khỏi ô để soạn đơn (pick)" },
  { ten: "hàng hoàn", nhan: "nguồn bin F0-RT (đơn bị trả về) / F0-NG (trả sản phẩm không phù hợp)" },
  { ten: "hàng dư", nhan: "nguồn giỏ F0-PA nhưng KHÔNG phải lệnh trả đơn huỷ (pick dư trả kệ)" },
];
