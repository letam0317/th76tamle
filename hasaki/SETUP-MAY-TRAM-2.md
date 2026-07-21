# Nhân bản máy trạm đồng bộ thứ 2 (dự phòng)

> Soạn 21/07/2026 cùng đợt cải tiến watchdog/luật phiên. Máy trạm 2 là **dự phòng nóng**:
> bình thường nó không làm gì (thấy dữ liệu đã mới là thoát); chỉ khi máy trạm 1 chết
> (tắt máy, hỏng, restart giữa chừng) nó mới tự kéo dữ liệu.

## ⚠ Điều kiện BẮT BUỘC trước khi bật máy 2

**Phải có tài khoản WMS riêng cho bot** (khác tài khoản người làm việc và khác máy 1 nếu
muốn 2 máy cùng active). Lý do: WMS chỉ cho **1 phiên / tài khoản** — hai máy dùng chung
tài khoản sẽ thay nhau đá phiên (đúng sự cố "đang làm việc bị văng" ngày 21/07/2026).

Tài khoản bot chỉ cần quyền: xem report `stock-locations` + `stock-inventories`
(report-management) và xem `physical-count` / `counting-plan checklists`.

Khi CHƯA có tài khoản riêng: chỉ cài máy 2 ở trạng thái **nguội** (làm hết các bước dưới
nhưng **không đăng ký task scheduler**) — lúc máy 1 hỏng thì bật task lên là chạy.

## Các bước cài đặt

1. **Copy thư mục** `hasaki/` sang máy 2 (trừ `.wms-session/`, `node_modules/`, `*.log`).
   Máy 2 phải nằm trong mạng nội bộ nhà máy (WMS chặn IP ngoài).
2. Cài Node.js (bản có sẵn `fetch`, ≥18) + Microsoft Edge.
3. `npm install` trong thư mục.
4. Tạo `.env` từ `.env.example`, điền:
   - `WMS_USERNAME / WMS_PASSWORD / WMS_2FA_SECRET` = **tài khoản bot** (không dùng tài khoản người).
   - `APPSCRIPT_KEY` = SECRET của Apps Script (giống máy 1).
   - Tuỳ chọn khác giữ mặc định.
5. Đăng nhập mồi 1 lần để có phiên SSO trong profile Edge riêng của dự án:
   `node login-hasaki.js` (gõ OTP nếu hỏi).
6. **Đăng ký task scheduler** (PowerShell, chạy trong thư mục dự án):

   ```powershell
   $vbs = (Resolve-Path .\sync-guard-hidden.vbs).Path
   $act = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument ('"' + $vbs + '"')
   $tr1 = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"; $tr1.Delay = 'PT5M'
   # LỆCH GIỜ so với máy 1: máy 1 chạy :05, máy 2 chạy :35 → máy 2 chỉ nhảy vào khi máy 1 đã lỡ hẹn
   $tr2 = New-ScheduledTaskTrigger -Daily -At '07:35'
   $tr2.Repetition = (New-ScheduledTaskTrigger -Once -At '07:35' -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration (New-TimeSpan -Hours 10)).Repetition
   $set = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 45)
   Register-ScheduledTask -TaskName 'Factory watchdog ton kho (may 2)' -Action $act -Trigger $tr1,$tr2 -Settings $set
   ```

   Máy 2 **không cần** task 7h `5S Dong bo dashboard` (cụm 5S vẫn là việc của máy 1) —
   watchdog là đủ: thấy Metadata cũ là tự kéo.

## Cơ chế phối hợp 2 máy (không cần cấu hình gì thêm)

- Cả 2 máy đọc chung **Metadata!B1** trên Google Sheet làm "sự thật": máy nào thấy mốc đã
  là hôm nay thì thoát ngay (vài giây, không tốn gì).
- Lịch lệch 30 phút + guard tự né khi thấy cụm sync khác đang chạy (soi command line)
  → gần như không bao giờ chạy trùng; nếu trùng thật thì bước ghi Sheet cũng idempotent
  (gói đầu xoá sạch rồi ghi lại).
- Cả 2 máy cùng tuân `session-rules.js`: ưu tiên token bridge, chỉ re-login trong khung
  giờ an toàn → không máy nào đá phiên người dùng trong giờ làm.

## Kiểm tra sau khi cài

```
node sync-guard.js          # dữ liệu đang mới → phải in "Dữ liệu đã mới ... không cần làm gì"
node sync-stocklocation.js --dry   # kéo + lọc, KHÔNG ghi Sheet — kiểm tra token/mạng
```
