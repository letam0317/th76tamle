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
