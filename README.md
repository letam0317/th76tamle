# 📷 Quét tem vải — NK Textile

App web chạy trên **điện thoại**: mở camera chụp ảnh tem vải → tự động bóc tách 14 trường thông tin
(PO, Mã NPL, Mã hàng, Tên vải, Màu, Khổ vải, Mẻ vải, Số thứ tự cuộn, Trọng lượng, Gross, Net, Ngày kiểm, Phân loại, Xuất xứ).

Không cần cài đặt phần mềm, không cần API key, không cần backend.

---

## Cách dùng nhanh nhất trên điện thoại

App cần được mở qua **HTTPS** (camera trình duyệt chỉ bật khi trang chạy https hoặc localhost).
Có 3 cách, chọn 1:

### Cách 1 — Đưa lên GitHub Pages (miễn phí, khuyên dùng)
1. Tạo tài khoản github.com → tạo repository mới.
2. Tải 4 file (`index.html`, `manifest.json`, `sw.js`, `README.md`) lên repo.
3. Vào **Settings → Pages → Source: main → Save**.
4. Sau ~1 phút sẽ có link dạng `https://<tên-bạn>.github.io/<tên-repo>/`.
5. Mở link đó trên điện thoại → bấm **Mở camera** → chụp tem.
6. (Tuỳ chọn) Bấm menu trình duyệt → **Thêm vào màn hình chính** để dùng như app thật.

### Cách 2 — Netlify (kéo–thả, không cần Git)
1. Vào https://app.netlify.com/drop
2. Kéo cả thư mục này thả vào trang → nhận ngay link https.
3. Mở link trên điện thoại.

### Cách 3 — Chạy thử trên máy tính (localhost)
Mở PowerShell trong thư mục này rồi chạy (cần cài Python):
```
python -m http.server 8000
```
Mở trình duyệt máy tính: http://localhost:8000
(Trên máy tính camera laptop cũng dùng được, hoặc bấm chọn ảnh có sẵn.)

> ⚠️ Mở thẳng file `index.html` bằng cách nhấp đúp (file://) thì **camera sẽ không bật** do trình duyệt chặn. Hãy dùng 1 trong 3 cách trên.

---

## Tính năng
- 📸 Bật camera sau của điện thoại để chụp tem (hoặc chọn ảnh có sẵn).
- 🔎 OCR tiếng Việt + tiếng Anh (thư viện Tesseract.js).
- 🧩 Tự dò 14 trường theo đúng cấu trúc tem. Ô nào dò được sẽ viền **xanh lá**.
- ✏️ Mọi ô đều **sửa tay được** — OCR đọc lệch thì chỉnh lại.
- 📋 Nút **Sao chép** (văn bản) và **JSON** để dán vào Excel/phần mềm khác.
- 📄 Xem được **văn bản OCR thô** để đối chiếu.

## Mẹo chụp cho chính xác
- Chụp thẳng, đủ sáng, tem phẳng, lấp đầy khung hình.
- Tránh bóng loáng / nhăn nilon che chữ.
- Lần đầu chạy cần mạng để tải bộ nhận dạng (~vài MB), các lần sau nhanh hơn.

## Muốn tăng độ chính xác (nâng cấp về sau)
Tesseract chạy ngay trên máy, miễn phí, nhưng độ chính xác trung bình.
Nếu cần đọc chuẩn hơn cho số lượng lớn, có thể đổi sang **Google Cloud Vision API**
hoặc **Azure Document Intelligence** (cần backend + API key) — cấu trúc bóc tách trong
`index.html` (hàm `parse()`) giữ nguyên, chỉ thay nguồn văn bản OCR.

## Tuỳ biến trường thông tin
Mở `index.html`, sửa mảng `FIELDS` ở đầu thẻ `<script>`:
mỗi dòng gồm `label` (tên hiển thị) và `aliases` (từ khoá không dấu dùng để dò trên tem).
