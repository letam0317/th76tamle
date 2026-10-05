# VieNeu-TTS · cài và clone giọng mình

Mã nguồn: https://github.com/pnnbao97/VieNeu-TTS · giấy phép Apache-2.0 · chạy được trên CPU.

## Cài (đã được chạy tự động ngày 05/10/2026, nhật ký ở `giong/vieneu-cai-dat.log`)
Mở PowerShell:
```powershell
irm https://astral.sh/uv/install.ps1 | iex          # cài uv, trình quản lý Python
cd "C:\Users\lechitam\New folder\kenh-trinh-tham\giong"
git clone --depth 1 https://github.com/pnnbao97/VieNeu-TTS.git vieneu
cd vieneu
uv sync                                               # tải thư viện, lần đầu vài trăm MB
uv run vieneu-web                                     # mở giao diện web ở http://127.0.0.1:7860
```
Nếu `uv` báo không tìm thấy sau khi cài, đóng rồi mở lại PowerShell để nhận PATH mới.

## Thu mẫu giọng của mình
- Phòng kín, không nhạc nền, điện thoại hoặc micro để cách miệng một gang tay.
- Đọc 6–8 giây câu bình thường, giọng kể chuyện, không hụt hơi. Lưu WAV hoặc MP3 vào `giong/mau-giong-cua-toi.wav`.
- Đọc cả kịch bản `kich-ban-thu-60s.txt` một lần, lưu `giong/thu/E-giong-that.wav` để làm mốc so sánh.

## Tạo mẫu thử
1. Mở giao diện web, tải `mau-giong-cua-toi.wav` làm giọng tham chiếu.
2. Dán nội dung `kich-ban-thu-60s.txt`, bỏ dòng tiêu đề đầu.
3. Xuất âm thanh, lưu thành `giong/thu/D-vieneu.wav`.
4. Chạy `node giong/thu-giong.mjs --chi=khong` để dựng lại bộ nghe mù có thêm mẫu D.

## Kỳ vọng
- Trên CPU, 15 phút âm thanh mất khoảng 8–10 phút để tạo.
- Chất lượng tốt nhất trong nhóm chạy CPU miễn phí. Ngữ điệu kịch tính có thể kém ElevenLabs.
- Có thẻ cảm xúc dạng [cười], [thở dài] đặt trong văn bản.
