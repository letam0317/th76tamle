/* kho170-thongso.js — NƠI DUY NHẤT ĐỂ SỬA THÔNG SỐ KHO 170
 * ============================================================================
 * Mô hình 3D (kho170-3d.html) đọc đúng file này. Sửa số ở đây → tải lại trang là thấy đổi.
 * Hoặc sửa ngay trên trang: mở "Chi tiết" → mục "Thông số kho (sửa được)" → gõ số →
 * bấm "Áp dụng" (đổi liền, nhớ trong máy) → bấm "Tải file thông số" để lấy file này về
 * cho lần sau. KHÔNG cần biết lập trình: chỉ đổi con số sau chữ gt.
 *
 *   gt    = giá trị (con số anh sửa)
 *   dv    = đơn vị
 *   nguon = số này lấy ở đâu:  "bản vẽ" (đo từ DCMTG1.dwg) · "NCC" (bản vẽ NCC kệ: Thăng Long cho A2, Tín Đạt/Eurorack cho A1)
 *                              · "TẠM" (tôi đoán — CẦN ANH SỬA)
 *   mo    = giải thích số đó là gì
 *
 * Ô "Dựng theo" của mỗi khối:
 *   banve   = lấy y nguyên vị trí từng ô trong bản vẽ AutoCAD
 *   thongso = BỎ bản vẽ, dựng lại bằng các con số bên dưới (dùng khi bản vẽ sai thực tế)
 *
 * Thông số có `chiTs: 1` là thông số BỐ CỤC — chỉ ăn khi khối đó dựng theo "thongso"
 * (trên trang nó mang nhãn xanh "bố cục"). Gõ vào một trong số đó thì trang TỰ chuyển khối
 * đó sang "thongso", vì nếu không thì gõ mà không thấy gì đổi, rất dễ tưởng hỏng.
 * ============================================================================ */
window.KHO170_TS = {
  ver: "2026-09-26",
  nhom: [

  /* ─────────────────────────────────────────────────────────────── */
  { id: "nha", ten: "1 · Vỏ nhà", ts: [
    { id: "HX",        ten: "Chiều dài kho (hướng Đông–Tây)", gt: 115.90, dv: "m", nguon: "bản vẽ", mo: "cạnh dài của mặt bằng" },
    { id: "HZ",        ten: "Chiều rộng kho (hướng Bắc–Nam)", gt: 65.05,  dv: "m", nguon: "bản vẽ", mo: "cạnh ngắn của mặt bằng" },
    { id: "nhaX0",     ten: "Tường TRÁI nhà kho (toạ độ x)",   gt: 12.36, dv: "m", nguon: "bản vẽ", mo: "nhà hình chữ L: khối trái (A1 + đóng gói) và khối phải (A2); phần còn lại của khung là sân bãi" },
    { id: "nhaGiua",   ten: "Chỗ nối khối trái ↔ khối phải (x)", gt: 42.08, dv: "m", nguon: "bản vẽ", mo: "khối trái rộng 29,7 m — bản ME ghi 29,50 m" },
    { id: "nhaX1",     ten: "Tường PHẢI nhà kho (x)",          gt: 112.56, dv: "m", nguon: "bản vẽ", mo: "khối phải dài 70,5 m — bản ME ghi 4,35 + 4,00 + 59,84 + 1,80 = 69,99 m" },
    { id: "nhaY0",     ten: "Tường TRÊN nhà kho (y)",          gt: 2.75,  dv: "m", nguon: "bản vẽ", mo: "" },
    { id: "nhaYPhai",  ten: "Tường DƯỚI khối phải (y)",        gt: 42.95, dv: "m", nguon: "bản vẽ", mo: "khối phải sâu 40,2 m" },
    { id: "nhaYTrai",  ten: "Tường DƯỚI khối trái (y)",        gt: 62.95, dv: "m", nguon: "bản vẽ", mo: "khối trái sâu 60,2 m — DCMTG1 nét 62,85/63,05; PDF DC HASAKI 3d + bản ME cùng ra ~60–61 m (58,30 chỉ là mép cửa tường bên)" },
    { id: "caoDiem",   ten: "Cao diềm mái (mép mái)",          gt: 7.50,  dv: "m", nguon: "TẠM",    mo: "đo từ sàn lên mép thấp nhất của mái" },
    { id: "caoNoc",    ten: "Cao nóc (đỉnh mái)",              gt: 10.50, dv: "m", nguon: "TẠM",    mo: "đo từ sàn lên đỉnh giữa nhà" },
    { id: "caoVach",   ten: "Cao vách ngăn trong nhà",         gt: 3.20,  dv: "m", nguon: "TẠM",    mo: "vách phòng Ortery, Re-IT, WC…" },
    { id: "caoChan",   ten: "Cao chân tường bê tông",          gt: 1.20,  dv: "m", nguon: "TẠM",    mo: "phần tường đặc dưới cùng" },
  ]},

  /* ─────────────────────────────────────────────────────────────── */
  { id: "a1", ten: "2 · Khối kệ A1 — pick hàng lẻ (dãy 501–516)", ts: [
    { id: "a1Nguon",  ten: "Dựng theo",                         gt: "banve", chon: [["banve","Bản vẽ"],["thongso","Thông số bên dưới"]], nguon: "bản vẽ", mo: "bản vẽ sai thực tế thì chuyển sang Thông số" },
    { chiTs: 1, id: "a1X",      ten: "Mép TRÁI của dãy 501",              gt: 15.68, dv: "m", nguon: "bản vẽ", mo: "tính từ tường trái của kho" },
    { chiTs: 1, id: "a1Y",      ten: "Mép TRÊN của tủ 01",                gt: 6.29,  dv: "m", nguon: "bản vẽ", mo: "tính từ tường trên của kho" },
    { chiTs: 1, id: "a1SoCum",  ten: "Số CỤM kệ",                          gt: 4,     dv: "cụm", nguon: "bản vẽ", mo: "4 cụm: 501–504, 505–508, 509–512, 513–516" },
    { chiTs: 1, id: "a1DayCum", ten: "Số DÃY trong mỗi cụm",               gt: 4,     dv: "dãy", nguon: "bản vẽ", mo: "" },
    { chiTs: 1, id: "a1SoTu",   ten: "Số TỦ mỗi dãy",                      gt: 10,    dv: "tủ",  nguon: "bản vẽ", mo: "" },
    { chiTs: 1, id: "a1RongO",  ten: "Bề rộng mặt kệ (nhìn từ trên xuống)", gt: 1.03, dv: "m", nguon: "bản vẽ", mo: "chiều sâu của một mặt kệ" },
    { chiTs: 1, id: "a1BuocTu", ten: "Chiều dài 1 tủ (bước tủ)",           gt: 2.39,  dv: "m", nguon: "bản vẽ", mo: "khớp bộ nối 2.390 mm của bản vẽ NCC" },
    { chiTs: 1, id: "a1Kc12",   ten: "Khoảng cách dãy 1 → dãy 2 trong cụm", gt: 1.18, dv: "m", nguon: "bản vẽ", mo: "tim dãy tới tim dãy" },
    { chiTs: 1, id: "a1Kc23",   ten: "Khoảng cách dãy 2 → dãy 3 trong cụm", gt: 1.02, dv: "m", nguon: "bản vẽ", mo: "" },
    { chiTs: 1, id: "a1Kc34",   ten: "Khoảng cách dãy 3 → dãy 4 trong cụm", gt: 1.18, dv: "m", nguon: "bản vẽ", mo: "" },
    { chiTs: 1, id: "a1LoiCum", ten: "LỐI ĐI giữa 2 cụm",                  gt: 2.72,  dv: "m", nguon: "bản vẽ", mo: "dãy cuối cụm này tới dãy đầu cụm sau" },
    { chiTs: 1, id: "a1TuCat",  ten: "Lối cắt ngang nằm SAU tủ thứ",       gt: 5,     dv: "tủ",  nguon: "bản vẽ", mo: "tủ 01–05 rồi mới tới 06–10" },
    { chiTs: 1, id: "a1LoiCat", ten: "Bề rộng LỐI CẮT NGANG",              gt: 3.29,  dv: "m", nguon: "bản vẽ", mo: "" },
    { id: "a1Kieu",   ten: "Kiểu kệ",                            gt: "selective", chon: [["selective","Kệ selective 2 mặt (bản vẽ NCC)"],["don","Mỗi dãy 1 kệ riêng (sơ đồ cũ)"]], nguon: "NCC", mo: "2 dãy liền nhau (501|502) là 2 MẶT của cùng 1 kệ: mặt ngoài có pallet 20/30/40, mặt trong chỉ kệ tay 01–04 — khớp WMS" },
    { id: "a1Sau",    ten: "Chiều sâu 1 kệ (R)",                 gt: 1.00,  dv: "m", nguon: "NCC",    mo: "R1000 — cả 3 hồ sơ thầu 05/2024 (Tín Đạt, Eurorack) cùng số" },
    { id: "a1Ham",    ten: "Lối nhặt hàng GIỮA 2 kệ trong cụm",  gt: 1.20,  dv: "m", nguon: "NCC",    mo: "mặt bên bản vẽ Tín Đạt: 1000 | 1200 | 1000 — người đi bộ, xe nâng không vào" },
    { id: "a1CotCao", ten: "Cao trụ kệ A1",                      gt: 5.00,  dv: "m", nguon: "NCC",    mo: "Tín Đạt D2300×R1000×5000 (Eurorack chào H4800)" },
    { id: "a1T1",     ten: "Cao độ mặt mâm tầng 01",             gt: 0.15,  dv: "m", nguon: "NCC",    mo: "shelving 4 tầng, 200 kg/tầng" },
    { id: "a1T2",     ten: "Cao độ mặt mâm tầng 02",             gt: 0.50,  dv: "m", nguon: "NCC",    mo: "" },
    { id: "a1T3",     ten: "Cao độ mặt mâm tầng 03",             gt: 0.80,  dv: "m", nguon: "NCC",    mo: "" },
    { id: "a1T4",     ten: "Cao độ mặt mâm tầng 04",             gt: 1.10,  dv: "m", nguon: "NCC",    mo: "" },
    { id: "a1P1",     ten: "Cao độ beam pallet tầng 20",         gt: 1.42,  dv: "m", nguon: "NCC",    mo: "500 kg/pallet; chỉ mặt ngoài (501, 504, 505, 508…)" },
    { id: "a1P2",     ten: "Cao độ beam pallet tầng 30",         gt: 2.52,  dv: "m", nguon: "NCC",    mo: "900 kg/pallet" },
    { id: "a1P3",     ten: "Cao độ beam pallet tầng 40",         gt: 4.32,  dv: "m", nguon: "NCC",    mo: "900 kg/pallet" },
  ]},

  /* ─────────────────────────────────────────────────────────────── */
  { id: "a2", ten: "3 · Khối kệ A2 — pallet / lưu trữ", ts: [
    { id: "a2Nguon",  ten: "Dựng theo",                   gt: "banve", chon: [["banve","Bản vẽ"],["thongso","Thông số bên dưới"]], nguon: "bản vẽ", mo: "A2 trên bản vẽ có nhiều cỡ ô khác nhau" },
    { chiTs: 1, id: "a2X",      ten: "Mép TRÁI của dãy đầu",         gt: 47.00, dv: "m", nguon: "bản vẽ", mo: "chỉ dùng khi chọn Thông số" },
    { chiTs: 1, id: "a2Y",      ten: "Mép TRÊN của tủ 01",           gt: 1.50,  dv: "m", nguon: "bản vẽ", mo: "chỉ dùng khi chọn Thông số" },
    { chiTs: 1, id: "a2SoCum",  ten: "Số CỤM kệ",                     gt: 7,     dv: "cụm", nguon: "TẠM", mo: "chỉ dùng khi chọn Thông số" },
    { chiTs: 1, id: "a2DayCum", ten: "Số DÃY mỗi cụm",                gt: 2,     dv: "dãy", nguon: "TẠM", mo: "kệ đôi đấu lưng" },
    { chiTs: 1, id: "a2SoTu",   ten: "Số TỦ mỗi dãy",                 gt: 8,     dv: "tủ",  nguon: "TẠM", mo: "" },
    { chiTs: 1, id: "a2KcTrong",ten: "Bước 2 kệ quay lưng trong cặp",   gt: 1.30,  dv: "m", nguon: "NCC", mo: "sâu 1.000 + giằng kệ đôi 300 (Thăng Long C4700/C5000: cặp 2.300)" },
    { chiTs: 1, id: "a2LoiCum", ten: "LỐI ĐI giữa 2 cụm",             gt: 2.90,  dv: "m", nguon: "bản vẽ", mo: "tài liệu ghi lối đi chính 2,90 m" },
    { id: "a2CotCao", ten: "Cao trụ kệ A2",                 gt: 5.00,  dv: "m", nguon: "NCC", mo: "TL-KHN-D2480 x R1000 x C5000" },
    { chiTs: 1, id: "a2Sau",    ten: "Chiều sâu kệ (R)",              gt: 1.00,  dv: "m", nguon: "NCC", mo: "R1000" },
    { chiTs: 1, id: "a2Bay",    ten: "Chiều dài 1 bay — bộ nối (D)",  gt: 2.39,  dv: "m", nguon: "NCC", mo: "2.390 mm" },
    { chiTs: 1, id: "a2BayDau", ten: "Chiều dài 1 bay — bộ đầu",      gt: 2.48,  dv: "m", nguon: "NCC", mo: "2.480 mm" },
    { id: "a2B1",     ten: "Cao độ beam tầng 1",            gt: 1.43,  dv: "m", nguon: "NCC", mo: "" },
    { id: "a2B2",     ten: "Cao độ beam tầng 2",            gt: 2.90,  dv: "m", nguon: "NCC", mo: "" },
    { id: "a2B3",     ten: "Cao độ beam tầng 3",            gt: 4.15,  dv: "m", nguon: "NCC", mo: "" },
  ]},

  /* ─────────────────────────────────────────────────────────────── */
  /* Cụm kệ C5000 (Thăng Long 29.3 – 31/03/2025) bên phải A2-514, đọc lại theo user 28/09/2026 + 2 ảnh chụp:
     double-deep 2.300 ĐÈ LÊN máng băng chuyền phân loại (dưới mỗi bay 2.390 là 2 cổng máng) · lối 2.900 ·
     khối double-deep 4 hàng 4.900 · lối 2.900 · khối selective 5.200 (bản vẽ vẽ như drive-in nhưng thực tế là selective).
     Các dãy sau khối đè máng "thụt lùi" cho đầu dãy thẳng hàng với khối A2-501…514. */
  { id: "c5", ten: "3c · Cụm C5000 bên phải A2-514 (double-deep trên băng chuyền)", ts: [
    { id: "c5Loi",   ten: "Lối đi A2-514 → double-deep đè máng", gt: 2.90, dv: "m", nguon: "NCC", mo: "khoảng 2.900 đầu tiên của layout C5000 (user xác nhận)" },
    { id: "c5DDSau", ten: "Bề sâu 1 khối double-deep đè máng",   gt: 2.30, dv: "m", nguon: "NCC", mo: "2 hàng 1.000 + khe 300" },
    { id: "c5ZDau",  ten: "Đầu dãy double-deep đè máng (z)",     gt: 12.36, dv: "m", nguon: "bản vẽ", mo: "11 bay 25,44 m đặt cân giữa 20 cổng máng (pallet zone z 12,70–37,45)" },
    { id: "c5Khoi4", ten: "Bề sâu khối double-deep 4 hàng (517|518)", gt: 4.90, dv: "m", nguon: "NCC", mo: "4 × 1.000 + 3 khe 300" },
    { id: "c5Sel",   ten: "Bề sâu khối selective (519|520 · 521)", gt: 5.20, dv: "m", nguon: "NCC", mo: "cặp 2.300 + lối nhặt 1.900 + kệ đơn 1.000 — cách chia bên trong là GIẢ ĐỊNH" },
  ]},

  /* ─────────────────────────────────────────────────────────────── */
  /* Kệ sát tường khu A1. Vị trí từng ô pallet đo trên DCMTG1.dwg; loại kệ theo bản vẽ Thăng Long 01/2025:
     5L1 (và 5L2) sâu 1,0 = TL-KHN-D5480×R1000×C4100 (mô-đun 5.480 = bay 2 pallet 2.270 + bay 3 pallet 3.210),
     5L3 sâu 1,1 = TL-KHN-D5970×R1100×C3000 (bay 2.480 + 3.490). Bản vẽ NCC không ghi cao độ beam → đo tỉ lệ trên hình. */
  { id: "ke5l", ten: "3b · Kệ sát tường khu A1 (5L1 · 5L2 · 5L3)", ts: [
    { id: "l1CotCao", ten: "5L1/5L2: cao trụ",              gt: 4.10, dv: "m", nguon: "NCC", mo: "D5480×R1000×C4100" },
    { id: "l1Sau",    ten: "5L1/5L2: chiều sâu kệ",         gt: 1.00, dv: "m", nguon: "NCC", mo: "R1000 — khớp bản vẽ mặt bằng 1,00 m" },
    { id: "l1B1",     ten: "5L1/5L2: cao độ beam tầng 20",  gt: 1.75, dv: "m", nguon: "đo hình NCC", mo: "đo tỉ lệ trên hình D5480 (không ghi số)" },
    { id: "l1B2",     ten: "5L1/5L2: cao độ beam tầng 30",  gt: 2.89, dv: "m", nguon: "đo hình NCC", mo: "" },
    { id: "l3CotCao", ten: "5L3: cao trụ",                  gt: 3.00, dv: "m", nguon: "NCC", mo: "D5970×R1100×C3000" },
    { id: "l3Sau",    ten: "5L3: chiều sâu kệ",             gt: 1.10, dv: "m", nguon: "NCC", mo: "R1100 (mặt bằng vẽ 1,20 gồm pallet chìa)" },
    { id: "l3B1",     ten: "5L3: cao độ beam tầng 20",      gt: 1.68, dv: "m", nguon: "đo hình NCC", mo: "đo tỉ lệ trên hình D5970" },
    { id: "l3B2",     ten: "5L3: cao độ beam tầng trên",    gt: 2.86, dv: "m", nguon: "đo hình NCC", mo: "WMS chưa khai mã tầng này" },
  ]},

  /* ─────────────────────────────────────────────────────────────── */
  { id: "a8", ten: "4 · Khu đóng gói A8 — 4 line băng chuyền · 64 bàn + xe pick", ts: [
    { id: "a8Nguon",  ten: "Dựng theo",                    gt: "banve", chon: [["banve","Bản vẽ"],["thongso","Thông số bên dưới"]], nguon: "bản vẽ", mo: "" },
    { chiTs: 1, id: "a8X",      ten: "Mép TRÁI dãy bàn đầu tiên (dãy 501)", gt: 15.85, dv: "m", nguon: "bản vẽ", mo: "DCMTG1 + DC HASAKI 3d.pdf" },
    { chiTs: 1, id: "a8Y",      ten: "Mép TRÊN bàn 01",                   gt: 41.74, dv: "m", nguon: "bản vẽ", mo: "" },
    { chiTs: 1, id: "a8SoCum",  ten: "Số LINE băng chuyền",                gt: 4,    dv: "line", nguon: "bản vẽ", mo: "mỗi line = dãy bàn trái | băng chuyền | dãy bàn phải (501|502|503 … 510|511|512)" },
    { chiTs: 1, id: "a8HangCum",ten: "Số CẶP bàn mỗi bên băng",            gt: 4,    dv: "cặp", nguon: "bản vẽ", mo: "cặp 01-02 · 03-04 · 05-06 · 07-08" },
    { chiTs: 1, id: "a8OHang",  ten: "Số bàn mỗi cặp",                     gt: 2,    dv: "bàn",  nguon: "bản vẽ", mo: "4 line × 2 bên × 4 cặp × 2 = 64 bàn" },
    { chiTs: 1, id: "a8RongBan",ten: "Bề ngang 1 bàn (vuông góc băng)",    gt: 1.20, dv: "m", nguon: "bản vẽ", mo: "" },
    { chiTs: 1, id: "a8SauBan", ten: "Bề dọc 1 bàn (theo chiều băng)",     gt: 0.60, dv: "m", nguon: "bản vẽ", mo: "" },
    { id: "a8CaoBan", ten: "Cao mặt bàn",                    gt: 0.75, dv: "m", nguon: "TẠM",    mo: "" },
    { chiTs: 1, id: "a8RongBang", ten: "Bề ngang băng chuyền (khe giữa 2 dãy bàn)", gt: 0.80, dv: "m", nguon: "bản vẽ", mo: "" },
    { id: "a8CaoBang", ten: "Cao mặt băng chuyền A8",        gt: 0.80, dv: "m", nguon: "TẠM",    mo: "chưa có bản vẽ đứng" },
    { chiTs: 1, id: "a8KcHang", ten: "Khoảng hở giữa 2 cặp bàn (dọc băng)", gt: 2.03, dv: "m", nguon: "bản vẽ", mo: "chỗ để xe pick" },
    { chiTs: 1, id: "a8KcCum",  ten: "Khoảng cách giữa 2 line",            gt: 1.50, dv: "m", nguon: "bản vẽ", mo: "bước line 4,70 m (PDF đo 4,75 m)" },
  ]},

  /* ─────────────────────────────────────────────────────────────── */
  /* NICHIYU FBR = xe nâng ĐỨNG LÁI CÀNG VƯƠN (reach truck), KHÔNG phải xe đối trọng:
     người đứng nghiêng trong buồng phía sau, hai chân càng chìa ra trước đỡ bánh tải,
     khung nâng trượt tới–lui giữa hai chân. Dáng khác hẳn nên phải dựng riêng.
     NGUỒN SỐ (22/09/2026) — 2 báo giá là PDF ảnh scan, đã kết xuất ra PNG rồi ĐỌC BẰNG MẮT
     (pdftotext trả 0 ký tự; máy không có pdftoppm nên render bằng pdf.js trong Edge):

     · Báo giá MUA 28/03/2025 — Xe nâng Nhật Tường, số 280325NT-HSK:
         Model FBRMW18-85B-600M · seri 1360-04245 · năm SX 2020 · nhập khẩu Nhật
         Tải trọng nâng 1.050 kg ở TÂM TẢI 500 mm · Chiều cao nâng 6.000 mm
         KHUNG NÂNG 3 TẦNG · Càng double deep dài 1.350 mm (càng phóng)
         Bình acid-chì 48V-370Ah/5Hr (Lifttop/Hitachi) · Động cơ AC Inverter · Vỏ cao su/PU
     · Báo giá THUÊ 07/06/2024 — Khang Nam: FBR18-R80B · 1.500 kg · nâng 3,5 m · 48V/280Ah
       KÈM ẢNH CHỤP XE THẬT — dáng xe trong mô hình dựng theo đúng ảnh này.
     · Hợp đồng mua 29/04/2025 — Khang Nam: 1,5 tấn · FBR18–R80B · nâng 6 m · 48V/280Ah

     Kích thước HÌNH HỌC (dài/rộng/cao khung hạ/dài chân càng) vẫn chưa tờ nào ghi ⇒ còn TẠM.
     Anh đo tay, hoặc thả tờ thông số kỹ thuật vào ô "Nạp tệp" ở đầu bảng. */
  { id: "xe", ten: "5 · Xe nâng NICHIYU FBR (đứng lái, càng vươn)", ts: [
    { id: "xnTai",    ten: "Tải trọng nâng",                   gt: 1050, dv: "kg", nguon: "báo giá", mo: "ở tâm tải 500 mm — báo giá 28/03/2025" },
    { id: "xnTamTai", ten: "Tâm tải",                           gt: 0.50, dv: "m", nguon: "báo giá", mo: "500 mm" },
    { id: "xnNangMax",ten: "Chiều cao nâng tối đa",             gt: 6.00, dv: "m", nguon: "báo giá", mo: "6.000 mm" },
    { id: "xnSoTangKhung", ten: "Số tầng khung nâng",           gt: 3,    dv: "tầng", nguon: "báo giá", mo: "khung 3 tầng — vẽ 3 lớp lồng nhau" },
    { id: "xnCangDD", ten: "Chiều dài càng double-deep (càng phóng)", gt: 1.35, dv: "m", nguon: "báo giá", mo: "1.350 mm — dùng cho kệ Double Deep A2" },
    { id: "xnDai",    ten: "Chiều dài thân xe (không tính càng)", gt: 2.10, dv: "m", nguon: "TẠM", mo: "đo từ đuôi xe tới gốc chân càng" },
    { id: "xnRong",   ten: "Bề rộng xe",                        gt: 1.20, dv: "m", nguon: "TẠM", mo: "chỗ rộng nhất của thân" },
    { id: "xnChanDai",ten: "Chiều dài chân càng (chân chìa ra trước)", gt: 1.50, dv: "m", nguon: "TẠM", mo: "phần đỡ bánh tải" },
    { id: "xnChanRong",ten: "Bề rộng NGOÀI hai chân càng",      gt: 1.20, dv: "m", nguon: "TẠM", mo: "" },
    { id: "xnMastHa", ten: "Cao khung nâng khi HẠ hết",         gt: 2.40, dv: "m", nguon: "TẠM", mo: "quyết định xe có chui lọt dưới kệ không" },
    { id: "xnCaoNoc", ten: "Cao nóc bảo vệ người lái",          gt: 2.20, dv: "m", nguon: "TẠM", mo: "" },
    { id: "xnCangDai",ten: "Chiều dài càng nâng",               gt: 1.07, dv: "m", nguon: "TẠM", mo: "" },
    { id: "xnAcquy",  ten: "Ắc quy",                            gt: 48,   dv: "V", nguon: "báo giá", mo: "48V-370Ah/5Hr Lifttop — chỉ ghi nhận, không vẽ" },
  ]},

  /* ─────────────────────────────────────────────────────────────── */
  { id: "khac", ten: "6 · Thứ khác", ts: [
    { id: "caoXePick",  ten: "Cao xe pick (xe soạn hàng)",  gt: 1.05, dv: "m", nguon: "TẠM", mo: "" },
    { id: "caoPalletSan", ten: "Cao khối hàng trên pallet sàn", gt: 1.15, dv: "m", nguon: "TẠM", mo: "" },
    { id: "soXeNang",   ten: "Số xe nâng chạy mô phỏng",     gt: 5,    dv: "xe", nguon: "—",   mo: "chỉ để nhìn cho sinh động" },
    { id: "tocXeNang",  ten: "Tốc độ xe nâng",               gt: 1.5,  dv: "m/s", nguon: "—",  mo: "" },
  ]},

  /* ─────────────────────────────────────────────────────────────── */
  /* Vị trí từng cụm lấy từ DCMTG1.dwg; kích thước/cao độ từ bản vẽ Intech 24083 (07–08/2024)
     và danh mục tài sản product-list-2025-08-28.xlsx (các mục "…của hệ thống băng chuyền", "…Liên Minh"). */
  { id: "bc", ten: "7 · Băng chuyền (Intech · Liên Minh)", ts: [
    { id: "bcCaoTruc",  ten: "Cao mặt băng tải PHÂN LOẠI (trục giữa A2)", gt: 0.95, dv: "m", nguon: "NCC", mo: "tài sản: băng tải phân loại 700×13.500×950 — khớp đầu cao dàn con lăn D42 (H950)" },
    { id: "bcMangCao",  ten: "Máng nhánh: đầu cao (sát trục)",           gt: 0.95, dv: "m", nguon: "NCC", mo: "Intech 24083-SP1 dàn con lăn tự do D42: H950±30" },
    { id: "bcMangThap", ten: "Máng nhánh: đầu thấp (phía pallet)",        gt: 0.62, dv: "m", nguon: "NCC", mo: "H622±30, dốc 10°, dài 2.000, rộng 716" },
    { id: "bcCaoVao",   ten: "Cao băng tải vào + Scan Code",             gt: 0.75, dv: "m", nguon: "NCC", mo: "tài sản: băng tải Scan Code 600×3.000×750" },
    { id: "bcCaoNhan",  ten: "Cao máy in & dán nhãn Liên Minh",           gt: 0.85, dv: "m", nguon: "NCC", mo: "tài sản: 1.300×650×850, servo 0,4 kW" },
    { id: "bcCaoCamLM", ten: "Cao khung camera Cognex (Liên Minh)",       gt: 2.00, dv: "m", nguon: "NCC", mo: "tài sản: 1.000×800×2.000" },
    { id: "bcCaoOut",   ten: "Cao line xuất: băng check + reject",        gt: 0.65, dv: "m", nguon: "NCC", mo: "Intech 24083-001/002: H650±30" },
    { id: "bcCaoCong",  ten: "Cao cổng camera đọc barcode (line xuất)",   gt: 2.27, dv: "m", nguon: "NCC", mo: "Intech 24083-001" },
    { id: "bcCaoNangHa",ten: "Cao đầu ra băng nâng hạ (phía cửa)",        gt: 0.95, dv: "m", nguon: "TẠM", mo: "Intech 24083-003 chỉnh được 650–1.200 theo sàn xe; đặt giữa khoảng" },
  ]},

  /* ─────────────────────────────────────────────────────────────── */
  /* Xe Ford Transit Van 2023 (số sàn, đen Absolute) de đít vào 4 cửa: IN (băng chuyền in nhãn) + OUT 3/2/1.
     Dáng xe theo bản vẽ C:/Users/HASAKI/Downloads/Ford-Transit-Van.dwg (4 hình chiếu); kích thước theo thông số hãng
     — CẦN đối chiếu cà-vẹt xe thật. */
  { id: "xv", ten: "8 · Xe Ford Transit Van (4 cửa băng chuyền)", ts: [
    { id: "xvDai",  ten: "Dài toàn bộ",        gt: 5.78, dv: "m", nguon: "TẠM", mo: "thông số hãng Transit VN 2023 — đối chiếu cà-vẹt" },
    { id: "xvRong", ten: "Rộng (không gương)", gt: 2.00, dv: "m", nguon: "TẠM", mo: "" },
    { id: "xvCao",  ten: "Cao",                gt: 2.36, dv: "m", nguon: "TẠM", mo: "" },
    { id: "xvCoSo", ten: "Chiều dài cơ sở",    gt: 3.75, dv: "m", nguon: "TẠM", mo: "bản vẽ DWG: cơ sở ≈ 0,63 × dài" },
  ]},

  ]
};
