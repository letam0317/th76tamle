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

## Link tải phần mềm (tra ngày 10/08/2026)

Cài theo đúng thứ tự này.

### Bước 1 — Trên MÁY TÍNH: công cụ nạp phần mềm cho điện thoại
| Phần mềm | Link | Ghi chú |
|---|---|---|
| Android Platform Tools (adb + fastboot) | https://developer.android.com/tools/releases/platform-tools | Bản Windows. Giải nén ra một thư mục, không cần cài |

### Bước 2 — Mở quyền quản trị (root) — **bỏ qua nếu máy đã có Magisk**
| Phần mềm | Link | Bản mới nhất |
|---|---|---|
| **Magisk** | https://github.com/topjohnwu/Magisk/releases | v30.7 — tải file `.apk` |

⚠️ **Ba cảnh báo, đọc kỹ trước khi làm:**
1. **Xiaomi 13 phải vá `init_boot.img`, KHÔNG phải `boot.img`.** Máy ra đời với Android 13 nên
   phần khởi động nằm ở tệp riêng. Vá nhầm `boot.img` là **treo máy**.
2. Tệp `init_boot.img` phải lấy từ **đúng bản ROM đang cài** (Global/Taiwan, đúng số hiệu bản).
   Lấy từ ROM khác phiên bản cũng treo máy. Nó nằm trong gói ROM fastboot bạn đã dùng để flash.
3. **Chỉ tải Magisk từ đúng địa chỉ GitHub ở trên.** Có rất nhiều trang giả mạo Magisk cài mã độc.

### Bước 3 — Môi trường chạy: 3 app Termux
> 🔴 **Quan trọng nhất mục này: cả 3 app phải tải từ CÙNG MỘT NGUỒN (GitHub).**
> Mỗi nguồn ký bằng một chữ ký khác nhau; trộn nguồn thì Android báo *"Không cài đặt được ứng dụng"*
> mà không nói lý do. Và **tuyệt đối không lấy từ Play Store** — bản đó đã hỏng từ lâu.

| App | Link | Bản mới |
|---|---|---|
| **Termux** (chính) | https://github.com/termux/termux-app/releases | v0.118.3 |
| **Termux:Boot** (tự chạy sau khi khởi động) | https://github.com/termux/termux-boot/releases | v0.8.1 |
| **Termux:API** (đọc pin, nhiệt độ cho nhịp tim) | https://github.com/termux/termux-api/releases | bản mới nhất |

Trong mỗi trang, kéo xuống mục **Assets**, chọn file có chữ **`universal`** và **`apt-android-7`**
(an toàn nhất, không cần biết máy thuộc loại nào).

### Bước 4 — Đường cứu hộ từ xa
| Phần mềm | Link |
|---|---|
| **AnyDesk cho Android** | https://anydesk.com/en/downloads/android |
| AnyDesk Control Plugin *(chỉ cần nếu điều khiển không được)* | https://anydesk.com/downloads/android-plugin/com.anydesk.adcontrol.ad1 |

Máy đã root thì AnyDesk thường điều khiển được luôn, không cần plugin.

### Bước 5 — **Tôi tự cài, bạn không phải làm gì**
| Phần mềm | Link | Ai cài |
|---|---|---|
| ACC — giữ pin ở 55–60% | https://github.com/VR-25/acc | Tôi, qua đường điều khiển từ xa |
| Node.js, git, ssh, socat, lịch chạy | (script `00-MO-DUONG-SSH.sh` tự cài) | Script tự làm |

Không cần cài F-Droid — lấy thẳng từ GitHub là đủ và mới hơn.

---

## Nếu chỉ nhớ 3 điều

1. **Termux phải lấy từ F-Droid/GitHub, không phải Play Store.**
2. **Không đặt PIN khoá màn hình** — nếu không máy sẽ không tự sống lại được.
3. **Tắt tự động cập nhật hệ điều hành ngay** — đây là rủi ro rẻ nhất để chặn, và nặng nhất nếu bỏ qua.
