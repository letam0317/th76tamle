# Kiểm thử giọng đọc tiếng Việt miễn phí · tra cứu 05/10/2026

Yêu cầu: miễn phí, tự nhiên khoảng 80–90 % so với người đọc thật, tốt nhất là clone từ giọng của mình, và có kiểm thử trước khi dùng.

## 1. Kết luận nhanh
Thử **VieNeu-TTS** đầu tiên. Đây là lựa chọn duy nhất đủ bốn điều kiện: miễn phí, clone được giọng của chính mình, chạy được trên CPU, giấy phép Apache-2.0 cho phép dùng thương mại. Hai mốc để so: **Gemini TTS** trong AI Studio có ngữ điệu tốt nhất nhưng không clone, và **edge-tts** rõ ràng nhưng đều đều kiểu đọc tin.

Kênh có bật kiếm tiền là dùng thương mại. F5-TTS Vietnamese, viXTTS, Fish S2 có giấy phép cấm thương mại, chỉ nghe thử để so, không dùng cho video đăng.

## 2. Bảng xếp hạng

| # | Tên | Miễn phí | Tiếng Việt | Clone giọng mình | Chạy CPU | Giấy phép | Ghi chú |
|---|---|---|---|---|---|---|---|
| 1 | VieNeu-TTS v3 Turbo, mã nguồn mở | có | chuyên tiếng Việt, 48 kHz | có, mẫu 3–8 giây | có, i5 đời 12 khoảng 2 lần thời gian thực | Apache-2.0 | thẻ cảm xúc [cười] [thở dài]; bản v4 đóng nguồn |
| 2 | Gemini TTS trong AI Studio | gói free | có | không | không cần | theo điều khoản Google | dữ liệu gói free bị Google dùng để cải thiện sản phẩm; điều khiển cảm xúc bằng chỉ dẫn |
| 3 | F5-TTS Vietnamese, hynt 1000 giờ | có | tốt, voz.vn hay gợi ý | có | cần GPU, CPU rất chậm | CC-BY-NC-SA, cấm thương mại | chỉ để so |
| 4 | viXTTS, capleaf | có | khá, kém với câu dưới 10 từ | có, mẫu 6 giây | chậm | Coqui CPML, cấm thương mại | chỉ để so |
| 5 | Gwen-TTS, fine-tune Qwen3-TTS | có | 1.000 giờ tiếng Việt | có | không, cần GPU NVIDIA từ 4 GB | MIT | máy này không có GPU |
| 6 | Google Cloud TTS Chirp 3 HD | free khoảng 1 triệu ký tự một tháng | tốt | chưa xác minh | cloud | thương mại được | phải gắn thẻ thanh toán |
| 7 | edge-tts, HoaiMy và NamMinh | có, không cần khoá | rõ nhưng đều đều | không | cloud | vùng xám, Microsoft nói dùng thương mại cần Azure | chỉ chỉnh tốc độ, cao độ |
| 8 | Azure Speech F0 | 0,5 triệu ký tự một tháng | cùng giọng edge-tts, có SSML | không ở gói free | cloud | hợp lệ | bản hợp pháp của edge-tts |
| 9 | FPT.AI, Viettel AI, Vbee | FPT 100.000 ký tự một tháng | giọng Việt bản xứ | không | cloud | theo hãng | một video 15 phút khoảng 10–12 nghìn ký tự |
| 10 | MiniMax Speech 2.6 | không, khoảng 0,7 USD một video 15 phút | có | có | cloud | thương mại | phương án trả phí rẻ nếu cần |

Loại vì không có tiếng Việt hoặc quá kém: Chatterbox Multilingual, Fish S1-mini, Qwen3-TTS bản gốc, CosyVoice 3, IndexTTS2 bản gốc, Kokoro, Dia.

Ghi nhận từ cộng đồng Việt: tệp mẫu sạch, không ồn, không vang, quan trọng hơn việc chọn model.

## 3. Luật nền tảng về giọng AI, kiểm 05/10/2026
- **YouTube**: trang "Khai báo nội dung bị chỉnh sửa hoặc tổng hợp" ghi rõ KHÔNG cần khai báo khi "clone giọng của chính mình để lồng tiếng". Khai báo cũng không làm giảm tiếp cận hay ảnh hưởng kiếm tiền. Rủi ro thật nằm ở chính sách "inauthentic content": nội dung AI làm hàng loạt theo khuôn, không có góc nhìn riêng thì không được kiếm tiền.
- **TikTok**: bắt buộc gắn nhãn nội dung AI có hình, âm thanh hoặc video nghe nhìn như thật. Không gắn thì có thể bị gỡ.
- **Meta**: bắt buộc khai báo "âm thanh nghe như thật do AI tạo hoặc chỉnh". Năm 2024 Meta tự nhận chưa phát hiện được audio từ công cụ bên ngoài.
- **Tự phát hiện**: bằng chứng chắc chắn chỉ có với metadata C2PA và watermark. VieNeu không gắn watermark. Không có nguồn công khai nào chứng minh nền tảng phát hiện được giọng AI không mang watermark.
- **Khuyến nghị**: trên YouTube không bắt buộc khai báo với giọng clone của mình. Trên TikTok và Facebook bật nhãn AI, vì nhãn không bị trừ tiền còn bị bắt thì mất video.

## 4. Quy trình thử, khoảng một buổi
1. Chạy `node giong/thu-giong.mjs` để có mẫu A, B bằng edge-tts và C bằng Gemini nếu có khoá.
2. Thu giọng mình đọc đúng kịch bản `kich-ban-thu-60s.txt`, lưu `giong/thu/E-giong-that.wav`. Thu thêm 6–8 giây giọng sạch lưu `giong/mau-giong-cua-toi.wav` để clone.
3. Cài VieNeu theo `VIENEU-CAI-DAT.md`, clone bằng mẫu trên, xuất `giong/thu/D-vieneu.wav`.
4. Chạy lại `node giong/thu-giong.mjs --chi=khong` để dựng bộ nghe mù `giong/thu/nghe-mu/` gồm Mau-1… và `dap-an.txt`.
5. Ba người nghe mù, chấm theo `PHIEU-CHAM.md`: tự nhiên, ngắt nghỉ, đọc số, tên riêng, cảm xúc. Đạt khi trung bình từ 4 trên 5 và bằng ít nhất 80 % điểm của bản giọng thật.
6. Thử độ bền: tạo 3 phút liên tục bằng engine thắng, nghe xem có lệch giọng, nuốt chữ, lặp từ không.
7. Máy dò giọng AI chỉ để tham khảo: Hiya Deepfake Voice Detector, Sightengine. Kết quả máy dò không phản ánh cách nền tảng xử lý.

## 5. Nguồn
- https://github.com/pnnbao97/VieNeu-TTS
- https://unikorn.vn/p/vieneu-tts
- https://huggingface.co/capleaf/viXTTS
- https://huggingface.co/hynt/F5-TTS-Vietnamese-ViVoice
- https://github.com/ggroup-ai-lab/gwen-tts
- https://github.com/rany2/edge-tts
- https://learn.microsoft.com/en-us/answers/questions/2088770/are-opensource-edge-tts-free-for-commercial-use
- https://ai.google.dev/gemini-api/docs/speech-generation
- https://ai.google.dev/gemini-api/docs/pricing
- https://cloud.google.com/text-to-speech/pricing
- https://voz.vn/t/03-2025-con-ai-nao-free-chuyen-chu-thanh-giong-noi-tieng-viet-ko-cac-bac.1082095/
- https://trancongthang.vn/article/voice-clone-vi-2026
- https://support.google.com/youtube/answer/14328491
- https://support.google.com/youtube/answer/1311392
- https://support.tiktok.com/en/using-tiktok/creating-videos/ai-generated-content
- https://about.fb.com/news/2024/02/labeling-ai-generated-images-on-facebook-instagram-and-threads/
- https://sightengine.com/detect-ai-voice
