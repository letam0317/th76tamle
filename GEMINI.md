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

## 4. Chiến lược Điều phối Mô hình (Model Strategy & Orchestration)
- **Giai đoạn 1 - Lên kế hoạch & Phân tích (Planning):**
  - Đối với các bài toán phân tích kiến trúc, thiết kế tính năng mới hoặc tái cấu trúc quy mô lớn, Agent luôn tự giác kích hoạt quy trình phân tích đa bước, chia nhỏ lộ trình thực hiện hoặc đề xuất sử dụng quy trình `/plan` và `/boost` để phát huy năng lực suy luận sâu tương đương **Gemini Pro**.
- **Giai đoạn 2 - Triển khai & Viết mã (Execution):**
  - Giữ **Gemini Flash** (cấu hình hiện tại) làm mô hình điều hướng chính cho mọi trao đổi, chỉnh sửa file, sinh mã nguồn, debug và tương tác lệnh nhằm đảm bảo tốc độ phản hồi tức thì và tính chính xác cao.
- **Giai đoạn 3 - Tác vụ nền & Tác vụ phụ (Background Tasks / Subagents):**
  - Khi khởi tạo subagent (`invoke_subagent`) cho các tác vụ nền, nghiên cứu codebase, đọc tài liệu, quét tìm kiếm thông tin hoặc kiểm tra kiểm thử phụ trợ, Agent **BẮT BUỘC** gán tham số `Model: "flash_lite"`.
  - Chỉ gán `Model: "pro"` cho subagent khi tác vụ yêu cầu suy luận giải thuật cực khó hoặc phân tích rủi ro hệ thống phức tạp.
