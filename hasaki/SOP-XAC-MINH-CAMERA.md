# QUY TRÌNH XÁC MINH NGƯỜI VI PHẠM BẰNG CAMERA (WF591 · bước B1)

> Lắng đọng từ 4 ca làm lại 01–02/10/2026: **13389950** (thùng rỗng 5L3-20 — kết luận sai 2 lần: Oanh → Như → Oanh),
> **14010729** (phòng cắt giấy — máy đoán Danh Hiếu, user xác nhận **Nguyễn Hoàng Minh Thám**), 13393072, 13393074.
> Luật máy đọc: `quy-tac-xac-minh-b1.json` (CAM-01…06, NV-01, TU-01, SH-01). Mục 11 BO-CHUAN là bản tóm tắt; file này là cách làm từng bước.

## 00. Mỗi lượt xác minh = 1 bài học cho máy (user 02/10)
Đích: luồng chuẩn chạy **tự động online không cần AI**, cải tiến từng trường hợp một. Trước khi làm: tra `kinh-nghiem-xac-minh.json` xem khuôn nào khớp (vd PALLET-NGOAI-O) và `ban-do-camera-o.json` (ô → kênh → ROI). Làm xong: ghi `ca` + sửa khuôn + bổ sung bản đồ.

## 0. Ba nguyên tắc gốc (mỗi nguyên tắc = 1 lần đã sai)
1. **Camera chỉ được XÁC NHẬN hoặc BÁC luật hệ thống bằng thứ NHÌN THẤY RÕ — không được đoán đè.**
   13389950: luật SH-01 "người soạn cuối SKU tại ô" ra Oanh = đúng; lần xem camera 01/10 đổi sang Như dựa trên phép tính
   "lấy 6 chai = hết thùng" mà không nhìn được lòng thùng ⇒ sai. Camera không thấy rõ → giữ kết luận hệ thống, ghi "camera không bác được".
2. **Không suy số lượng khi chưa biết THÙNG GỐC + QUY CÁCH.** Thùng trong ảnh là thùng giấy trơn, không phải thùng gốc
   (thùng gốc in xanh, nhãn 20 EA) ⇒ WMS không nói được thùng còn bao nhiêu. Phải đếm bằng mắt từng lần có người thò tay vào.
3. **Không loại ai chỉ vì THIẾU dữ liệu.** 14010729: Thám không có ảnh cổng 10 ngày → bị bỏ khỏi bảng so dáng → máy chọn nhầm
   người "giống nhất". Thiếu ảnh = "chưa so được", vẫn giữ trong danh sách, xếp theo bằng chứng khác (giờ ra ca).

## 1. Đồ vật trước, người sau (CAM-03)
1. Mở ảnh ghi nhận (IMA00) → gọi tên đúng ĐỒ VẬT vi phạm + vị trí trên ảnh. **Kiểm ảnh trùng** phiếu khác trước (`_trung-anh.mjs`).
2. Lỗi dính thùng/hàng: ghi **loại thùng (gốc/trơn), nhãn EA, SKU** (CAM-05).
3. Tìm kênh camera: bảng kênh ở memory `camera-a1-dau-ghi` (A1) · tên kênh mọi đầu ghi ở SmartPSS
   `C:\Users\Public\SmartPSS\Organization\OrganizationChannel.xml` (kênh top-review = `no` + 1). **Thử các góc kề, chọn góc rõ nhất;
   góc không thấy ô thì ghi rõ** (5L3-20: ch55/56/57 không thấy, chỉ ch58).

## 2. Kẹp mốc thời gian (rẻ trước, đắt sau)
1. 1 khung hình/mốc lùi dần (`_cat-doan.mjs` 5–10 s/mốc): 1 khung/giờ → 1 khung/10 phút → kẹp khoảng đồ vật đổi trạng thái.
2. Quét vùng đồ vật chỉ khi có chuyển động (`_tim-tac-dong.mjs`) → danh sách lượt có người lại gần.
3. **Mỗi lượt có người lại gần: soi TỪNG GIÂY** (khung 1–2 s, phóng to vùng đồ vật). Ghi: ai, tay chạm vào ĐÚNG đồ vật hay vật bên cạnh.
   Đã sai 2 lần vì soi thưa: 09:41 suýt ghi "đi ngang" khi NV đang lấy hàng; 09:50 ghi Hương lấy "trên nóc" — thực tế lấy TRONG thùng.
4. Ghép WMS ĐÚNG PHÚT (picking-group / transfer-bins lọc `bin_in`): mỗi lượt chạm ↔ 1 dòng lệnh. Chạm mà không có lệnh = ghi rõ.

## 3. Định danh người
- **Có lệnh WMS đúng phút:** tên = tài khoản WMS ("tk …"); camera chỉ xác nhận đúng người đó thò tay vào đồ vật.
- **Không có lệnh WMS (NV-01)** — làm theo thứ tự, mỗi bước LOẠI người, không bước nào CHỌN người:
  1. Chấm công ngày đó: chỉ giữ NV **trong ca đúng phút** vi phạm, đúng bộ phận theo màu đồng phục (áo xanh = PTCH).
  2. Camera SAU vi phạm: người còn làm tiếp hay rời khu → ca kết thúc lúc nào → **giữ người có giờ chấm RA khớp**
     (Thám ra 17:14, người vi phạm rời phòng ~17:00 ✓). Đây là bộ lọc mạnh nhất ca 14010729.
  3. Ảnh cổng ≤10 ngày (`_anh-cong.mjs`): so dáng, tóc, quần, dép — **không so mặt**; sổ cổng có thể trống cả ngày (01/10).
     Người KHÔNG có ảnh cổng vẫn giữ lại (nguyên tắc 3).
  4. Còn ≥2 người → gửi user danh sách đã rút + ảnh so sánh NỘI BỘ (không đính lên phiếu), **không tự gán**.

## 4. Dựng clip bằng chứng (CAM-06 · `_clip-noi.mjs`)
- **1 clip nối liền** từ lần tác động nghi ngờ → lúc chụp ảnh ghi nhận: chứng minh người đó tác động CUỐI và sau đó không ai tác động.
- Tốc độ: thao tác chính ×1 · người đi ngang ×2–×3 · không ai tác động ×10 (có nhãn ▶▶).
- **Màu (user 02/10):** vật dụng = khung VÀNG nét liền · người vi phạm/nghi vi phạm = khung ĐỎ nét đứt CHẠY, bám theo người,
  nhãn = TÊN NV (chưa định danh thì ghi đúng như vậy) · **NV không liên quan KHÔNG khoanh**.
- Bám người: mô hình chỉ thấy người 0–40 % khung ở camera nhìn từ trên → dự phòng bám chuyển động lọc màu áo + **điểm neo** người
  soi tay mỗi 3–6 s ở đoạn khó (đi khuất, đi cạnh xe đẩy, đi cạnh người khác). Chỉ dò người ở đoạn có người vi phạm (đỡ ~80 % tải).
- **Dựng xong soi ≥12 khung, dày ở đoạn người vi phạm**; khung lạc sang người khác/xe đẩy → thêm neo, dựng lại.
- Từ ngữ (TU-01): "châm hàng" (không "cất"), "không ai tác động thùng" (không "không ai lấy hàng").

## 5. Gắn lên phiếu + dọn
- Thay bằng chứng B1: `_thay-bang-chung-b1.mjs` (xoá trắng → nạp → đọc lại → đăng bình luận mới → **chỉ xoá bình luận cũ khi thấy
  bình luận có id MỚI**). Trường khác: `_thay-file-phieu.mjs <id> <KEY> <file>`. Lập phiếu mới: `_tao-phieu-5s.mjs`.
- Gán lỗi: `auto-complete-single-task.mjs --task --nv --lam` (diễn tập trước, xem QLTT ra đúng bộ phận) → đọc lại B1.1 giao đúng NV.
- File lớn: gửi bằng https thuần (Node fetch ngắt sau 300 s); lỗi quá giờ → kiểm phiếu đã tạo chưa rồi mới gửi lại.
- Dựng clip: tạo/xoá khoá `.exports/.dung-clip.lock` (dùng chung với luồng bãi xe) — không bao giờ 2 lượt dựng cùng lúc.
- **Xoá video gốc + clip dựng + cấu hình mốc CHỈ khi phiếu đã xong B3.1/B3.2** (user 02/10: "để nhân viên cãi lại thì chỉnh sửa luôn mà không cần tải về") — áp cả trên máy dựng (PC). Xoá ngay được: khung hình soi tạm, clip BẢN CŨ đã bị thay trên phiếu.
- Ghi án lệ vào `quy-tac-xac-minh-b1.json` + chạy `node canh-b1.mjs --qc` + 1 dòng `.exports/DONG-BO-WF591.md`.

## 6. Bảng tự kiểm trước khi báo "xong"
| # | Câu hỏi | 13389950 lần 1 | 14010729 lần 1 |
|---|---|---|---|
| 1 | Đồ vật trong ảnh là gì, thùng gốc hay trơn, quy cách? | ✗ không kiểm | — |
| 2 | Mọi lượt có người lại gần đã soi từng giây? | ✗ soi thưa | ✓ |
| 3 | Kết luận camera có đè luật hệ thống mà không nhìn rõ? | ✗ có | — |
| 4 | Ai bị loại vì thiếu dữ liệu (không ảnh cổng / không lệnh)? | — | ✗ Thám bị loại |
| 5 | Lọc theo giờ ra ca đã dùng chưa? | — | ✗ dùng muộn |
| 6 | Clip nối liền tới lúc chụp ảnh? Khung đỏ đúng người ≥12 khung? | ✗ 2 clip rời | ✓ (sau 3 lượt) |
| 7 | Chú thích khớp hình từng mốc, đúng từ ngữ TU-01? | ✗ "trên nóc", "cất" | ✓ |
