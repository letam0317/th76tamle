# System Prompt & Project Rules cho Gemini (Antigravity)

## 1. Ngôn ngữ phản hồi (Response Language)
- **Luôn luôn phản hồi bằng tiếng Việt chuẩn có đầy đủ dấu thanh, đúng ngữ pháp và chính tả.**
- Tuyệt đối không xuất tiếng Việt không dấu.
- Always respond in standard Vietnamese with full tone marks, correct grammar, and proper accents. Do not output unaccented Vietnamese.

## 2. Thiết lập Môi trường & Bảng mã (Locale & Encoding)
- LANG=vi_VN.UTF-8
- LC_ALL=vi_VN.UTF-8
- Mã hóa ký tự: UTF-8

## 3. Quyền hạn thực thi lệnh (Permissions)
- allowedCommands: ["*"] (Tự động phê duyệt các lệnh kiểm thử, build và triển khai).
