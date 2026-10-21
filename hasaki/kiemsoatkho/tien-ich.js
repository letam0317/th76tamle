/* tien-ich.js — TIỆN ÍCH DÙNG CHUNG cho mọi mô-đun dashboard (20/10/2026).
 * Đánh giá 20/10: esc khai lại ở 9 tệp, $id 7, e_ 3, ngayVN 2 — mỗi bản một kiểu (bản thiếu null-safe, bản không thoát dấu ').
 * Nạp TRƯỚC mọi mô-đun trong index.html; mô-đun chỉ viết `var esc = window.hskTienIch.esc;` (qc-ma-tinh không tính dòng tham chiếu này).
 * KHÔNG đặt hàm toàn cục mới ở đây — tránh đè tên của mô-đun; mọi thứ nằm trong window.hskTienIch. */
(function () {
  var TI = window.hskTienIch = window.hskTienIch || {};
  /* thoát HTML — null/undefined → "", thoát cả ' (an toàn trong thuộc tính dùng nháy đơn) */
  TI.esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  TI.$id = function (i) { return document.getElementById(i); };
  TI.hm = function (s) { return String(s || "").slice(0, 5); };                       // "13:05:00" → "13:05"
  TI.p2 = function (n) { return (n < 10 ? "0" : "") + n; };
  /* yyyy-mm-dd (có thể kèm giờ) → "dd/mm"; không đúng dạng → trả nguyên */
  TI.ngayVN = function (d) { var m = String(d || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + "/" + m[2] : d; };
  /* 21/10 gộp toast (đánh giá: 3 cách báo kết quả — toast ở index, baoOk ở Xác minh, ô riêng ở Factory): một thông báo dưới đáy màn cho mọi mô-đun.
     loai: ok (mặc định) · loi · warn; tên cũ err/error/bad → loi. Không có toast của trang (tệp chạy riêng) → alert. */
  TI.toast = function (msg, loai) {
    var l = (loai === "err" || loai === "error" || loai === "bad") ? "loi" : (loai || "ok");
    if (typeof window.toast === "function") return window.toast(msg, l);
    try { alert(msg); } catch (e) {}
  };
})();
