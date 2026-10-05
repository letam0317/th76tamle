/* lienanh-thongso.js — SỐ LIỆU NHÀ + THIẾT BỊ kho mới LIÊN ANH (Trung tâm nguyên phụ liệu Liên Anh, Dĩ An, Bình Dương)
 * ============================================================================
 * Nguồn: bản vẽ hoàn công KT 4-01 "MẶT BẰNG TRỆT" TL 1/200 (Đạt Việt Co. Ltd) — ảnh quét
 * OneDrive\Desktop\C13-C17_page_3.pdf, đọc chuỗi kích thước ngày 05/10/2026. Đối chiếu 3 nguồn
 * độc lập (xem hasaki/SO-DO-KHO-LIEN-ANH.md §2): chuỗi tự cộng đúng, trang mẫu new-warehouse
 * 108×80 nhịp 24–32–24, ảnh vệ tinh Esri mái khớp 108×80 (+ mái phụ đông ~6 m).
 *
 * KHÔNG ghi bố cục ở đây (tệp này được commit). Bố cục nằm ở lienanh-bocuc-goc.js (gitignore).
 *
 * Hệ toạ độ mô hình: mét. x = 0 ở trục 1 (mép trái tờ vẽ), tăng về trục 19.
 *                          z = 0 ở trục M (mép TRÊN tờ vẽ), tăng về trục A (mép dưới) — nhìn từ trên
 *                          xuống (x sang phải, z xuống) đúng y tờ bản vẽ, không soi gương.
 * Chuỗi kích thước (mm) là NGUỒN DUY NHẤT của khổ nhà: trang tự cộng, lệch tổng là báo đỏ không dựng.
 *   gt = giá trị · dv = đơn vị · nguon = "bản vẽ" (KT 4-01) · "trang mẫu" (new-warehouse) ·
 *   "NCC" (hồ sơ kệ Thăng Long/Tín Đạt kho 170) · "TẠM" (giả định — cần user sửa) · mo = giải thích
 * ============================================================================ */
window.LIENANH_TS = {
  ver: "2026-10-05",
  ten: "Kho Liên Anh — Trung tâm nguyên phụ liệu",
  diaChi: "Huyện Dĩ An, tỉnh Bình Dương · lô 10,93652 / 106,75370",
  banVe: "KT 4-01 Mặt bằng trệt · TL 1/200 · bản vẽ hoàn công",
  huongX: "Đông", huongZ: "Nam",              // x tăng = sang phải tờ vẽ · z tăng = xuống dưới tờ vẽ
  bacThat: 65,                                 // hướng trục dài so với Bắc địa lý (độ, đo ảnh vệ tinh) — chỉ ghi mũi tên Bắc
  /* CHUỖI KÍCH THƯỚC (mm) — đọc từ dải kích thước dưới đáy + bên phải bản vẽ */
  chuoiX: {
    nhan: ["1","2","3","4","5","6","7","8","9","10","10'","11","12","13","14","15","16","17","18","19"],
    buoc: [6000,6000,6000,6000,6000,6000,6000,6000,6000, 320, 5680, 6000,6000,6000,6000,6000,6000,6000,6000],
    tong: 108000, nguon: "bản vẽ", mo: "9 bước 6 000 · khe lún 320 tại trục 10/10' (cột đôi) · 5 680 · 8 bước 6 000"
  },
  chuoiZ: {
    /* bản vẽ in nhãn hàng thứ 3 từ trên là "19" (lỗi in — nằm giữa L và K); giữ đúng chữ bản vẽ, ghi chú ở mo */
    nhan: ["M","L","19","K","J","I","H","G","F","E","D","C","B","A"],
    buoc: [6000,6000,6000,6000, 6400,6400,6400,6400,6400, 6000,6000,6000,6000],
    tong: 80000, nguon: "bản vẽ", mo: "nhịp J–M 4×6 000 = 24 000 (trên) · nhịp E–J 5×6 400 = 32 000 (giữa) · nhịp A–E 4×6 000 = 24 000 (dưới); nhãn '19' là lỗi in trên bản vẽ"
  },
  nhom: [
  { id: "nha", ten: "1 · Vỏ nhà", ts: [
    { id: "HX",       ten: "Chiều dài (trục 1 → 19)",            gt: 108.0, dv: "m", nguon: "bản vẽ", mo: "= tổng chuỗi X 108 000 mm (máy tự cộng, không sửa tay)" },
    { id: "HZ",       ten: "Chiều rộng (trục M → A)",            gt: 80.0,  dv: "m", nguon: "bản vẽ", mo: "= tổng chuỗi Z 80 000 mm" },
    { id: "cotGiua1", ten: "Hàng cột giữa thứ nhất (trục J)",    gt: 24.0,  dv: "m", nguon: "bản vẽ", mo: "z của trục J tính từ trục M" },
    { id: "cotGiua2", ten: "Hàng cột giữa thứ hai (trục E)",     gt: 56.0,  dv: "m", nguon: "bản vẽ", mo: "z của trục E" },
    { id: "cotCanh",  ten: "Tiết diện cột",                      gt: 0.45,  dv: "m", nguon: "TẠM",    mo: "cột thép I bọc — chưa có mặt cắt" },
    { id: "tuongDay", ten: "Bề dày tường bao",                   gt: 0.25,  dv: "m", nguon: "TẠM",    mo: "chân tường BTCT + tôn" },
    { id: "caoChan",  ten: "Cao chân tường bê tông",             gt: 1.2,   dv: "m", nguon: "trang mẫu", mo: "phần tường đặc dưới cùng" },
    { id: "caoDiem",  ten: "Cao diềm mái (mép mái)",             gt: 7.3,   dv: "m", nguon: "trang mẫu", mo: "bản vẽ trệt không ghi — lấy từ new-warehouse" },
    { id: "caoEJ",    ten: "Cao mái tại hàng cột E / J",         gt: 11.9,  dv: "m", nguon: "trang mẫu", mo: "mái dốc 20 %" },
    { id: "caoNoc",   ten: "Cao nóc",                            gt: 15.0,  dv: "m", nguon: "trang mẫu", mo: "" },
    { id: "caoVach",  ten: "Cao vách ngăn trong nhà",            gt: 3.2,   dv: "m", nguon: "TẠM",    mo: "vách văn phòng, locker" },
    { id: "maiPhuDong", ten: "Mái phụ ngoài trục 19",            gt: 6.0,   dv: "m", nguon: "vệ tinh", mo: "đo ảnh vệ tinh — chỉ vẽ nét đứt, không xếp đồ" },
  ]},
  { id: "ke", ten: "2 · Kệ pallet (selective / double-deep)", ts: [
    { id: "keBay",    ten: "Chiều dài 1 bay",                    gt: 2.4,   dv: "m", nguon: "trang mẫu", mo: "NCC Thăng Long bay 2 390 / 2 480 — 2 pallet 1,0 × 1,2 mỗi bay" },
    { id: "keSau",    ten: "Chiều sâu 1 hàng kệ",                gt: 1.0,   dv: "m", nguon: "NCC",    mo: "R1000" },
    { id: "keKhe",    ten: "Khe lưng giữa 2 hàng selective",     gt: 0.3,   dv: "m", nguon: "NCC",    mo: "cặp selective = 1,0 + 0,3 + 1,0 = 2,3 m (Thăng Long 2 300)" },
    { id: "keTang",   ten: "Số tầng (sàn + beam)",               gt: 4,     dv: "tầng", nguon: "trang mẫu", mo: "sàn + 3 beam, pitch 1,4 m" },
    { id: "kePitch",  ten: "Bước tầng",                          gt: 1.4,   dv: "m", nguon: "trang mẫu", mo: "" },
    { id: "keCao",    ten: "Cao trụ kệ",                         gt: 5.5,   dv: "m", nguon: "trang mẫu", mo: "đỉnh tải 5,35 m" },
    { id: "keDDHang", ten: "Số hàng của khối double-deep",       gt: 4,     dv: "hàng", nguon: "trang mẫu", mo: "4 hàng sâu dính liền, pitch 1,0" },
    { id: "keLoi",    ten: "Lối xe nâng giữa 2 dãy kệ",          gt: 3.0,   dv: "m", nguon: "trang mẫu", mo: "xe nâng đứng lái; Thăng Long 2 900" },
  ]},
  { id: "sorter", ten: "3 · Sorter cross-belt v18", ts: [
    { id: "soLs",     ten: "Cạnh dài ring",                      gt: 31.5,  dv: "m", nguon: "trang mẫu", mo: "" },
    { id: "soLw",     ten: "Cạnh ngắn ring",                     gt: 10.0,  dv: "m", nguon: "trang mẫu", mo: "" },
    { id: "soR",      ten: "Bán kính cua",                       gt: 3.5,   dv: "m", nguon: "trang mẫu", mo: "" },
    { id: "soH",      ten: "Cao ray",                            gt: 2.4,   dv: "m", nguon: "trang mẫu", mo: "" },
    { id: "soLine",   ten: "Số line nạp từ xe tải",              gt: 4,     dv: "line", nguon: "trang mẫu", mo: "pitch 2,4 m, xe 1t9 đậu kề vai ở cửa đập thông" },
    { id: "soLoi",    ten: "Lối kéo lồng ngoài",                 gt: 2.0,   dv: "m", nguon: "trang mẫu", mo: "AISLE" },
  ]},
  { id: "cua", ten: "4 · Cửa · dock", ts: [
    { id: "cuaRong",  ten: "Bề rộng cửa xuất mặc định",          gt: 4.0,   dv: "m", nguon: "trang mẫu", mo: "cửa cũ bản vẽ ~4 m; cửa đập thông G–H 10,5 m" },
    { id: "cuaCao",   ten: "Cao cửa",                            gt: 4.5,   dv: "m", nguon: "trang mẫu", mo: "" },
    { id: "dockXe",   ten: "Dải xe trước dock cont",             gt: 17.0,  dv: "m", nguon: "trang mẫu", mo: "cont 40' + đầu kéo, ngoài nhà" },
  ]}
  ]
};
