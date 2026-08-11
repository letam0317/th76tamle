# ĐĂNG NHẬP KHÔNG CẦN BOT TỰ SINH OTP — Đường 2 & 3

> 12/08/2026. TOTP đã chuyển sang app **Hasaki Authenticator**, không xuất seed base32 nên bot
> không tự sinh mã được nữa. Hai đường thay thế, cùng nguyên lý: **mượn phiên người thật thay vì
> để bot đăng nhập**. Không lách MFA, không moi khoá từ điện thoại.

## Nguyên lý chung

Đăng nhập ≠ lấy dữ liệu. Đăng nhập chỉ để lấy **một vé (token)**; vé dùng được nhiều giờ và **mọi
bot xài chung** (bằng chứng: token work lưu 18:42 ngày 10/8 vẫn chạy 13:31 ngày 11/8 — 19 tiếng).
Nên câu hỏi chỉ là "ai lấy vé một lần", không phải "bot sinh OTP kiểu gì".

## Đường 2 — người gõ OTP 1 lần/ngày (đã cập nhật 12/08)

Bật bằng `LOGIN_OTP_TAY=1` trong `.env`. Khi bật:

- `login-hasaki.js` coi như **không có seed** → điền sẵn email+mật khẩu rồi **dừng cho người gõ 6 số**
  (đọc từ Hasaki Authenticator). Lượt `--auto` **hoãn ngay (exit 75)** trước khi mở trình duyệt →
  **hết đốt lượt IdP**.
- `watch-login-request.js` mở cửa sổ login **--show** (hiện ra để người gõ) khi cờ bật.
- `push-5s` / `pull-timesheet`: khi không mượn được phiên, lượt hoãn **thoát êm (exit 0)**, không gửi
  mail báo động mỗi 15' — chờ người đăng nhập.

**Một ngày:** sáng bấm nút trong email (từ điện thoại) → ~1' sau cửa sổ tự mở trên máy trạm, email+
mật khẩu điền sẵn → liếc app, gõ 6 số, Enter → cả ngày mọi bot mượn vé đó.

**Lưu ý mật khẩu:** log 11/08 báo "Incorrect sign-in details" sau khi gõ đủ mật khẩu + OTP. OTP sai
là chắc (seed cũ), nhưng **mật khẩu cũng có thể đã đổi**. Ở cửa sổ --show, nếu vẫn bị từ chối sau khi
gõ đúng OTP → xoá ô mật khẩu, gõ mật khẩu hiện tại; rồi cập nhật `HASAKI_PASSWORD` trong `.env`.

**Quay lại tự động** (khi có seed mới): dán seed mới vào `HASAKI_2FA_SECRET`, đặt `LOGIN_OTP_TAY=0`
(hoặc xoá dòng đó). Không cần sửa code.

## Đường 3 — bridge nghe phiên work/hr (đã có từ 30/07, extension v1.4.0)

Extension `factory/wms-bridge` v1.4.0 đã nghe cả `wshr.hasaki.vn`: hook bắt token → xác thực bằng
`search-for-dropdown?limit=1` → đẩy GAS `bridgeToken kind=wshr`. Node side `layTokenSongWork` /
`layBridgeTokenWshr` đã tiêu thụ; GAS `bridgeCaps` trả `bridgeWshr:true` (đã kiểm live 12/08).

Con người **không làm gì thêm** — chỉ cần mở work/hr trong trình duyệt có extension là phiên tự chảy
về máy trạm, push-5s mượn dùng, khỏi đăng nhập.

**Việc vận hành còn lại (không phải code):**
1. **Reload extension** trên laptop để chắc chắn đang chạy v1.4.0 (`chrome://extensions` → Reload).
2. **Giữ 1 tab work.hasaki.vn hoặc hr.hasaki.vn mở** trong lúc làm việc → bridge wshr luôn có token
   tươi. (Kiểm: `getBridgeToken kind=wshr` trên GAS trả token thay vì rỗng.)

## Quan hệ hai đường

Đường 3 lo phần lớn thời gian (giờ làm, có người mở work/hr). Đường 2 là lưới đỡ cho lúc bridge rỗng
(sáng sớm, chưa ai mở work/hr) và là cách **tái lập phiên** khi mọi token đã chết. Cả hai cùng bật.

## Vì sao không đi đường "nghe lén app / moi seed"

Đã phân tích và loại: bắt gói phải bẻ certificate pinning, đọc bộ nhớ phải root máy — đều là **phá lớp
bảo vệ**, vỡ liên tục, và đi ngược `PHẦN D5/B7` trong `LICH-VA-DU-PHONG.md` (quyết định đã chốt của
dự án: không giả thiết bị, không trích khoá từ app điện thoại). Lấy seed **lúc ghi danh** thì hợp lệ;
moi seed từ **app đã cài** thì không.
