# Hướng dẫn: Tự động đẩy báo cáo 5S → Task workflow 591

Hệ thống tự đọc các báo cáo 5S **có vi phạm** trong Google Sheet rồi tạo task trong
workflow 591 trên `work.hasaki.vn`, kèm ảnh. Báo cáo "Không phát sinh vi phạm" được bỏ qua.

## Luồng hoạt động
```
Form 5S → Google Sheet (WMS-5S-AUDIT) → [push-5s-to-workflow.js] → Task workflow 591
                                          ↑ token tự lấy từ phiên Edge đã đăng nhập
```

---

## BƯỚC 1 (làm 1 lần) — Cập nhật & triển khai lại Apps Script

Bản Apps Script mới có thêm 2 chức năng: trả về báo cáo chưa đẩy và đánh dấu đã tạo task.

1. Mở Google Sheet → **Tiện ích mở rộng → Apps Script**.
2. Xoá hết code cũ, **dán đè toàn bộ** nội dung file `google-script.gs` (bản mới).
   > ⚠️ **QUAN TRỌNG:** trong file, dòng `var SECRET = 'DAT_MA_BI_MAT_RIENG_O_DAY';`
   > là placeholder. **Đổi thành giá trị thật** (đúng `APPSCRIPT_KEY` trong `.env`,
   > hiện là `hsk5s-2026-bem4t`) — nếu để placeholder, bộ đẩy sẽ báo "Sai key".
3. Bấm **Lưu**. Lần đầu chạy có action `alert`, Google sẽ hỏi cấp quyền **gửi email** → cho phép.
4. **Triển khai → Quản lý bản triển khai (Manage deployments)** → bấm bút chì ✎ **Sửa**
   → ô **Version** chọn **New version** → **Triển khai (Deploy)**.
   > Đường link `/exec` **giữ nguyên**, không đổi.

> Sheet sẽ tự có thêm cột **"Mã task workflow"** (cột F). Khi một báo cáo được tạo task,
> mã task (vd `HSK-904972Y2`) sẽ hiện ở cột này → biết cái nào đã đẩy.

---

## BƯỚC 2 (làm 1 lần) — Đăng nhập work.hasaki.vn để lưu phiên

Mở **PowerShell/CMD** tại thư mục dự án rồi chạy:
```
node login-hasaki.js
```
Một cửa sổ Edge mở ra → **đăng nhập** (email + mật khẩu + OTP) → khi thấy bảng workflow
hiện ra thì **đóng cửa sổ**. Phiên được ghi nhớ (dùng lại nhiều lần, không phải nhập OTP mỗi lần).

> Phiên này sẽ sống một thời gian. Khi nào bộ đẩy báo *"phiên đã hết hạn"* thì chạy lại
> `node login-hasaki.js` để đăng nhập lại.

---

## BƯỚC 3 — Đẩy báo cáo

**Cách thủ công:** bấm đúp file **`DAY-BAO-CAO-5S.bat`** (hoặc chạy `node push-5s-to-workflow.js`).
Nó sẽ tạo task cho mọi báo cáo vi phạm chưa đẩy, rồi ghi mã task vào Sheet.

**Tự động mỗi 6 giờ (đã thiết lập sẵn):**
Đã tạo sẵn Windows Scheduled Task tên **`Day bao cao 5S`** chạy `DAY-BAO-CAO-5S.bat auto`
mỗi 6 giờ (máy phải đang bật & đã đăng nhập Windows). Mỗi lần chạy ghi vào `day-bao-cao-5s.log`.
- Xem/sửa: mở **Task Scheduler** → tìm task `Day bao cao 5S`.
- Xoá nếu không muốn tự động: PowerShell `Unregister-ScheduledTask -TaskName 'Day bao cao 5S'`.

> 🔑 **Phiên đăng nhập:** lần đầu (và mỗi khi hết hạn) phải chạy `node login-hasaki.js`
> để đăng nhập (profile lưu ở `.wms-session/edge-profile`). Khi phiên hết hạn lúc chạy tự động,
> hệ thống **tự gửi email cảnh báo** về `th76tamle02@gmail.com` (tối đa 1 mail/12h) để bạn biết mà đăng nhập lại.

---

## Ánh xạ dữ liệu (đã kiểm chứng chạy đúng)

| Form 5S | → | Trường task (workflow 591) |
|---|---|---|
| Ngày giờ ghi nhận | → | `DATE00` (Ngày vi phạm) + ngày bắt đầu/kết thúc |
| Hạng mục 5S | → | `TYPE00` (Lỗi vi phạm) — tự khớp với 32 lựa chọn của workflow |
| Vị trí (+ ghi chú hiện trạng) | → | `BIN00` (Vị trí ghi nhận) |
| Hình ảnh | → | `IMA00` (Hình ảnh vi phạm) |
| — | | Người được giao: `staff_id=17312` (Lê Chí Tâm), Tiêu đề: `[5S] <vị trí> - <hạng mục>` |

## Xử lý sự cố
- **"Phiên đăng nhập đã hết hạn"** → chạy lại `node login-hasaki.js`.
- **Báo "Bỏ qua: không khớp hạng mục"** → hạng mục đó không có trong danh sách workflow
  (hoặc là loại "không vi phạm"). Kiểm tra lại text hạng mục trên form.
- **Muốn đổi người được giao / tiêu đề task** → sửa `STAFF_ID` / dòng tạo `name` trong
  `push-5s-to-workflow.js`.
- **Đổi workflow khác** → sửa `WORKFLOW_ID` trong `push-5s-to-workflow.js` (và bắt lại
  cấu trúc field bằng `capture-task-api.js` nếu workflow có field khác).
