/**
 * ten-phieu-5s.js — MỘT chỗ quyết tên phiếu 5S (WF591) cho mọi bộ tạo phiếu: push-5s-to-workflow.js · luat-3-ngay.mjs · _tao-phieu-5s.mjs
 * và bộ đổi tên phiếu cũ _doi-ten-phieu-5s.mjs.
 * 13/10/2026 user: «[5S] F0-A1-503-10-01-02 - Hàng hóa phải được sắp xếp gọn gàng, trưng bày… → cải tiến thành dạng [5S] A1-503-10 - Hàng hoá phải được…»
 *   · mã vị trí rút về KHU-DÃY-TỦ (bỏ "F0-", bỏ tầng-ô): người đọc tên phiếu cần biết chỗ nào, ô chi tiết đã có trong phiếu
 *   · chỗ không theo khuôn mã (vd "sạc xe nâng", "khu vực lưu trữ thùng") giữ nguyên chữ
 *   · tổng ≤ 90 ký tự như cũ (giới hạn wshr)
 */
export function viTriNgan(viTri) {
  const v = String(viTri || "").trim();
  const m = /^([A-Z]{1,3}\d{0,2})-([0-9A-Z]{3})(?:-(\d{2}))?(?:-|$)/.exec(v.replace(/^F0-/i, "").toUpperCase());   // F0-A8-501 → A8-501 · F0-KHO-508-08 → KHO-508-08
  return m ? [m[1], m[2], m[3]].filter(Boolean).join("-").toUpperCase() : (v || "?");
}
export function tenPhieu5S(viTri, hangMuc) {
  return ("[5S] " + viTriNgan(viTri) + " - " + String(hangMuc || "").trim()).slice(0, 90);
}
