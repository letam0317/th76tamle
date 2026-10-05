# Kênh trinh thám faceless · hồ sơ dự án

Lập 05/10/2026. Dự án cá nhân, tách hẳn khỏi `hasaki/`. Mọi script ở đây phải chạy được bằng lệnh, không cần AI ở bước lặp; AI chỉ dùng ở bước dịch và viết nháp.

## 1. Mục tiêu

Kênh kể lại vụ án có thật, chủ yếu vụ án Trung Quốc đã xét xử, bằng giọng đọc của chính mình đem clone, hình ảnh là "bàn điều tra" dựng sẵn. Kiếm tiền từ lượt xem trên YouTube và Facebook, dùng TikTok để kéo người theo dõi và bán affiliate.

## 2. Đánh giá 05/10/2026, điều quan trọng cần nhớ

Những điều các phiên hỏi đáp trước nói sai hoặc không có nguồn:

| Điều đã nói | Thực tế kiểm 05/10/2026 |
|---|---|
| TikTok trả tiền lượt xem ở Việt Nam, RPM 0,1–0,8 USD | Creator Rewards chỉ mở ở Mỹ, Anh, Đức, Pháp, Nhật, Hàn, Brazil, Mexico. Việt Nam không có. Nuôi kênh giả US bằng SIM hay VPN là vi phạm điều khoản. |
| Thư viện 3D dùng chung "an toàn 100 %" | Không ai bảo đảm được. YouTube từ 15/07/2025 phạt "nội dung giống khuôn mẫu, ít thay đổi giữa các video". Meta từ 14/07/2025 cảnh báo kiểu "chuỗi ảnh ghép lời đọc". Người duyệt nhìn tổng thể kênh. |
| Clone giọng duyệt kiếm tiền trên 95 % | Không có thống kê nào như vậy. |
| RPM true crime 5–12 USD | Đó là khán giả Mỹ. Nói tiếng Việt thì khán giả Việt, RPM thấp hơn nhiều lần. |
| Tra vụ án ở 中国裁判文书网 | Tỉ lệ công khai rơi từ 81,3 % năm 2020 xuống 12,5 % năm 2023, 2025 còn ít hơn. Vẫn tra được nhưng đừng xây hệ cào quanh nó. |
| Cào Baidu, Zhihu bằng Python | Hai trang này chặn bot rất gắt. Dùng Wikipedia tiếng Trung qua API chính thức, danh mục tập 今日说法, 人民法院案例库, báo chính thống. |

Năm lỗ hổng của kế hoạch gốc:
1. Sai nền tảng kiếm tiền. Tiền lượt xem cho người ở Việt Nam đến từ YouTube và Facebook, không phải TikTok.
2. Meta xếp nội dung tội phạm, cái chết, thương tích vào nhóm "bi kịch và xung đột", dễ bị gắn kiếm tiền hạn chế từng video.
3. Luật An ninh mạng Điều 8 cấm "mô tả tỉ mỉ hành động chém, giết, tai nạn, kinh dị, rùng rợn", phạt cá nhân 5–10 triệu đồng, đã có vụ xử lý thật năm 2022. Mô phỏng 3D cảnh giết người chi tiết là vi phạm trực tiếp.
4. AI chưa tự ghép được hoạt ảnh nhân vật 3D. Blender qua MCP chỉ đặt vật thể, ánh sáng, camera. Một video 8 phút có 20 cảnh nhân vật vẫn mất 2–4 ngày công người dựng.
5. Với kênh kể chuyện, phần giữ người xem là kịch bản, giọng và nhịp cắt. Kế hoạch gốc dồn công vào hình.

## 3. Kế hoạch điều chỉnh

### Bản đồ nền tảng
| Nền tảng | Vai trò | Định dạng |
|---|---|---|
| YouTube | nguồn tiền chính | video dài 8–15 phút, 2 video một tuần |
| Facebook Page | nguồn tiền phụ, chương trình gộp đang theo lời mời | đăng lại video dài + Reels cắt |
| TikTok | kéo người theo dõi + affiliate | Reels 60–90 giây cắt từ video dài |

Affiliate hợp ngách: camera an ninh, khoá cửa, còi báo động, sách trinh thám. Phương án B: kênh tiếng Anh về vụ án Trung Quốc, YouTube trả theo nước người xem nên người ở Việt Nam vẫn nhận RPM Mỹ hợp pháp.

### Hình ảnh ba tầng
- Tầng 1, khoảng 70 %: bàn điều tra 3D cố định gồm bản đồ, sơ đồ hiện trường nhìn từ trên, dòng thời gian, bảng chứng cứ. Tự động hoá được, mỗi vụ khác nhau tự nhiên. Thư mục `hinh/`.
- Tầng 2, khoảng 20 %: nhân vật tối giản dạng bóng, không mặt, không máu, hoạt ảnh sẵn từ Mixamo.
- Tầng 3, khoảng 10 %: ảnh và clip báo chí có dẫn nguồn, ảnh AI minh hoạ có gắn nhãn.
Mỗi video có ít nhất một quyết định hình ảnh do người làm, kèm câu bình luận "theo tôi".

### Kịch bản
Khung 5 phần và luật 3 không trong `MAU-KICH-BAN.md`.

### Giọng
Thu giọng thật 6–8 giây sạch, clone bằng VieNeu-TTS, miễn phí, chạy trên CPU, giấy phép Apache-2.0. Chi tiết và quy trình nghe mù trong `giong/KIEM-THU-GIONG.md`.

### Thước đo trước khi mở rộng
10 video thử trong 6 tuần. Chỉ mở rộng khi:
| Chỉ số | Ngưỡng |
|---|---|
| Tỉ lệ xem trung bình video 8 phút | từ 40 % |
| Video đạt 50.000 lượt xem | ít nhất 1 |
| Video bị kiếm tiền hạn chế trên Facebook hoặc YouTube | 0 |

### Kỳ vọng thu nhập, khán giả Việt, ước lượng chưa kiểm
| Nguồn | Mốc 1 triệu lượt xem một tháng |
|---|---|
| YouTube | 300–1.000 USD |
| Facebook | bằng hoặc thấp hơn YouTube |
| TikTok affiliate | tuỳ sản phẩm |
Thời gian tới tiền đáng kể: 6–9 tháng.

### Việc bắt buộc theo luật Việt Nam
- Xác thực tài khoản bằng số điện thoại hoặc CCCD theo Nghị định 147/2024.
- Doanh thu nền tảng trên 500 triệu đồng một năm thì nộp 7 % trên phần vượt theo quy định 2026, cần kế toán xác nhận lại.
- Bật nhãn AI trên TikTok và Facebook. YouTube không bắt buộc khi clone giọng của chính mình.

## 4. Cấu trúc thư mục

```
kenh-trinh-tham/
  README.md                 tệp này
  MAU-KICH-BAN.md           khung kịch bản + luật 3 không + bảng kiểm trước khi đăng
  .env.example              chép thành .env, điền GEMINI_API_KEY nếu muốn dịch tự động
  lay-danh-sach-vu-an.mjs   lấy danh sách vụ án từ Wikipedia tiếng Trung → ho-so/
  ho-so/                    danh-sach.json + danh-sach.csv
  kich-ban/                 kịch bản từng vụ, 1 tệp .md một vụ
  giong/                    kiểm thử giọng, mẫu giọng, VieNeu
  hinh/                     bàn điều tra 3D, làm sau
  xuat/                     video xuất, không đưa lên git
```

## 5. Cách chạy

```bash
cd "C:\Users\lechitam\New folder\kenh-trinh-tham"
node lay-danh-sach-vu-an.mjs --so=30          # lấy 30 vụ, dịch tóm tắt nếu có khoá Gemini
node lay-danh-sach-vu-an.mjs --khong-dich     # chỉ lấy, không dịch
node giong/thu-giong.mjs                      # tạo mẫu giọng 60 giây bằng edge-tts + Gemini TTS
```

Khoá Gemini: script đọc `kenh-trinh-tham/.env`, không có thì đọc `GEMINI_API_KEY` trong `hasaki/.env` ở chế độ chỉ đọc.

## 6. Nguồn đã đọc 05/10/2026

- TikTok Creator Rewards nước đủ điều kiện: quasa.io, contentmonetizing.com, rentracks.com.vn
- Facebook Content Monetization: creators.facebook.com, metricool.com, shortlink.ad
- Meta siết nội dung không nguyên bản 14/07/2025: TechCrunch, Tubefilter
- YouTube inauthentic content 15/07/2025: support.google.com/youtube/answer/1311392
- YouTube khai báo nội dung tổng hợp: support.google.com/youtube/answer/14328491
- Luật An ninh mạng Điều 8, vụ Thái Nguyên 2022: thainguyen.gov.vn, qdnd.vn
- Nghị định 147/2024: mst.gov.vn. Thuế 2026: thanhnien.vn, thueonline.com
- Wenshu giảm công khai: rfa.org 02/2026
- Blender MCP giới hạn: mindstudio.ai
- VieNeu-TTS: github.com/pnnbao97/VieNeu-TTS
