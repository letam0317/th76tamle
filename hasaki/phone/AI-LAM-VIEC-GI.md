# Ai làm việc gì — dựng máy trạm trên Xiaomi 13

> Viết cho người không rành kỹ thuật. Nguyên tắc chia việc rất đơn giản:
> **việc nào phải chạm tay/mắt vào chiếc điện thoại thì bạn làm, còn lại tôi làm.**
>
> Toàn bộ phần bạn phải làm gói gọn trong **khoảng 45 phút**, chia làm 2 lần.

---

## PHẦN 1 — Tôi đã làm xong (10/08/2026)

| Việc | Kết quả |
|---|---|
| Soát toàn bộ mã nguồn, đưa những file còn thiếu vào kho lưu trữ | Xong — máy mới tải về sẽ được hệ **đầy đủ**, không thiếu nhánh nào |
| **Bịt lỗ "đá phiên ca tối"** | Xong — trước đây từ 17:30 máy chỉ cần thấy im 5 phút là tự đăng nhập, tức đá thẳng vào người đang làm ca tối. Nay phải im **15 phút** cho tới 22:30 |
| Kèm bản vá "token tốt bị token cũ đè" (sự cố sáng nay) | Xong — mất mạng không còn bị hiểu nhầm là "hết phiên" |
| Kiểm kho dữ liệu tích luỹ có đủ để chuyển máy không | Đủ cả 3 nhóm, **không thiếu file nào** (~11,7 MB) |
| Viết sẵn script mở đường điều khiển từ xa | `phone/00-MO-DUONG-SSH.sh` |

Lưu ý: tôi **chưa** gom gói bí mật ra Desktop. Gói đó chứa mật khẩu và khoá xác thực ở
dạng đọc được, để nằm trên máy cả tuần là rủi ro thừa. Khi điện thoại sẵn sàng, tôi
chuyển thẳng qua đường mã hoá — không cần USB, không để lại bản trần ở đâu cả.

---

## PHẦN 2 — Việc CHỈ BẠN làm được — **lần 1, ~30 phút**

Vì sao tôi không làm được: những việc này cần **bấm vào màn hình điện thoại**, hoặc cần
máy khởi động vào chế độ đặc biệt. Không có đường điều khiển từ xa nào chạm tới được.

| # | Việc | Ghi chú |
|---|---|---|
| 1 | **Sao lưu dữ liệu cá nhân trong máy, rồi xoá sạch máy** | Máy trạm phải sạch để hoạt động ổn định, đoán trước được |
| 2 | **Cài Magisk** (mở quyền quản trị) | Cần cắm máy vào máy tính. Đây là thứ cho phép: giữ pin 55–60%, tự bật lại khi mất điện, điều khiển trình duyệt |
| 3 | **Cài Termux + Termux:Boot** — lấy từ **F-Droid hoặc GitHub** | ⚠️ **Tuyệt đối không lấy từ Play Store** — bản đó đã hỏng từ lâu, cài vào là tắc ngay bước đầu |
| 4 | Nối **Wi-Fi công ty**, đặt "dùng địa chỉ MAC của thiết bị" (không ngẫu nhiên) | Để máy không bị rớt mạng âm thầm |
| 5 | **Rút SIM**, tắt dữ liệu di động, tắt "tự chuyển sang mạng di động khi Wi-Fi yếu" | Rớt sang 4G là mất quyền vào hệ thống công ty — hỏng kiểu rất khó tìm |
| 6 | **Tắt tự động cập nhật hệ điều hành** | Một lần cập nhật nhầm là mất cả máy trạm lẫn dữ liệu tích luỹ |
| 7 | **KHÔNG đặt mã PIN khoá màn hình**, tắt màn hình luôn hiển thị (AOD) | Đã bàn: có PIN thì máy không tự sống lại được sau khi khởi động |
| 8 | Đặt múi giờ **GMT+7**, bật đồng bộ giờ theo mạng | Mã OTP phụ thuộc đồng hồ chính xác |
| 9 | Mở Termux, chạy **đúng một dòng** trong `00-MO-DUONG-SSH.sh` | Script tự cài mọi thứ và in ra 3 dòng ở cuối |
| 10 | **Gửi tôi 3 dòng đó** (địa chỉ IP, cổng, tài khoản) | Đây là lúc bạn bàn giao — từ đây tôi làm tiếp |

---

## PHẦN 3 — Tôi làm hết, từ xa, không phiền bạn

Sau khi có đường điều khiển, những việc sau tôi tự làm và tự kiểm chứng:

- Cài đặt môi trường chạy, tải mã nguồn 2 dự án, cài thư viện
- **Chuyển gói bí mật + kho dữ liệu tích luỹ sang** qua đường mã hoá (không cần USB)
- Cài cơ chế **giữ pin ở 55–60%** — kèm đo trước xem máy có hỗ trợ chạy thẳng bằng điện
  (nếu có thì còn tốt hơn: pin gần như không phải làm việc)
- Cài cơ chế **tự khởi động lại khi có điện** — chống cả mất điện lẫn ai đó bấm tắt máy
- Dựng cầu nối tới trình duyệt; đặt cơ chế đánh thức màn hình 1–2 phút đúng lúc cần
- Chuyển toàn bộ lịch chạy sang **05:30 / 06:00–22:00 / 22:02**, 7 ngày/tuần
- Sửa phần mã nguồn còn phụ thuộc Windows
- Dựng **nhịp tim + cảnh báo**: máy im quá 45 phút là báo, không để hỏng âm thầm
- Chạy đủ **5 phép đo** rồi báo bạn kết quả bằng ngôn ngữ thường
- Chạy **song song** với máy tính cũ vài ngày (điện thoại chỉ đọc, chưa ghi) trước khi chuyển hẳn

---

## PHẦN 4 — Việc bạn làm nốt — **lần 2, ~15 phút**, sau khi tôi báo đã sẵn sàng

| # | Việc | Vì sao chỉ bạn |
|---|---|---|
| 1 | **Đăng nhập tay một lần** vào wms / work / hr bằng trình duyệt trên điện thoại | Lần đầu nên làm bằng tay cho chắc, tránh gõ sai mã OTP nhiều lần (tài khoản có giới hạn số lần sai) |
| 2 | Bật **khoá ứng dụng** cho Cài đặt / Termux / Chrome, đặt mật khẩu riêng | Chỉ bạn được biết mật khẩu này |
| 3 | Cài **AnyDesk** + đặt mật khẩu truy cập | Đường cứu hộ dự phòng của bạn |
| 4 | **Gắn máy lên tường**: che nút nguồn, thoáng khí, bỏ ốp lưng, dán nhãn *"MÁY TRẠM — KHÔNG RÚT SẠC, KHÔNG TẮT"* | Việc vật lý |
| 5 | **Duyệt cắt chuyển** khi tôi báo đã chạy song song ổn | Quyết định của bạn |

Sau đó, việc định kỳ của bạn còn đúng **một thứ**: mỗi tháng nhìn chiếc điện thoại xem
lưng máy có bị phồng lên không. Chỉ mắt người mới thấy được.

---

## Cần mua trước

| Món | Vì sao |
|---|---|
| Củ sạc + cáp **tốt** | Cắm liên tục 24/7 — hàng rẻ là rủi ro cháy thật |
| Giá gắn tường **che được nút nguồn**, thoáng khí | Chống cầm đi + chống ai đó giữ nút tắt máy. **Không dùng hộp kín** — bí nhiệt |
| Quạt USB 5V nhỏ | Chỉ mua **sau khi** tôi đo nhiệt độ và báo là cần |

---

## Nếu chỉ nhớ 3 điều

1. **Termux phải lấy từ F-Droid/GitHub, không phải Play Store.**
2. **Không đặt PIN khoá màn hình** — nếu không máy sẽ không tự sống lại được.
3. **Tắt tự động cập nhật hệ điều hành ngay** — đây là rủi ro rẻ nhất để chặn, và nặng nhất nếu bỏ qua.
