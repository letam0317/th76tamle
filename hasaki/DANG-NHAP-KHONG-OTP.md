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

## Đường 2b — người gõ OTP QUA TIN NHẮN (19/08/2026)

Vẫn là "người gõ 6 số", nhưng gõ vào **Telegram** thay vì gõ vào cửa sổ trên máy trạm — nên đăng
nhập được cả khi đang ở ngoài kho.

Bật: `LOGIN_OTP_CHAT=1` trong `.env` (hoặc chạy `node login-hasaki.js --auto --otp-chat`; lệnh
`/dangnhap` trong chat luôn đi đường này). Cần kênh tin nhắn đã bật — xem `KENH-TIN-NHAN.md`.

- Tới bước OTP, `login-hasaki.js` gọi `hoiOtpQuaChat()` (`hop-thu.mjs`): nhắn xin 6 số, **giữ hộp
  thư** (bot nghe lệnh tự nhường, tránh 409 Conflict của `getUpdates`), nhận mã → `goOTP()` → nộp
  **1 lần duy nhất** như cũ.
- Không nhận được mã trong `LOGIN_OTP_CHO_GIAY` (mặc định 300s) ⇒ đóng trình duyệt, **không nộp gì
  lên IdP**, thoát 75 (hoãn). Xin hụt thì im 30' mới xin lại (`LOGIN_OTP_NGHI_LAI_PHUT`).
- Hạn tổng của lượt `--auto` tự nới thành `5' + LOGIN_OTP_CHO_GIAY` để không hết hạn ngay giữa lúc
  đang chờ người trả lời.
- Mã **không bao giờ** vào log/ảnh; nhận xong bot xoá luôn tin chứa 6 số trong chat.
- Vẫn không lách MFA: mã do chính chủ đọc từ app Hasaki Authenticator. Mọi cửa kiểm cũ giữ nguyên
  (cầu dao chống khoá tài khoản, khoá chống chạy chồng, luật phiên `--auto`).

Khi nào dùng đường nào: **2b** cho lượt tự động/ở xa (mặc định nên bật), **2** khi ngồi ngay máy,
**3** (bridge) vẫn là đường rẻ nhất — chỉ cần mở work/hr trong Edge là không phải đăng nhập gì.

## Đường 3 — bridge nghe phiên work/hr (đã có từ 30/07, extension v1.4.0)

Extension `factory/wms-bridge` v1.4.0 đã nghe cả `wshr.hasaki.vn`: hook bắt token → xác thực bằng
`search-for-dropdown?limit=1` → đẩy GAS `bridgeToken kind=wshr`. Node side `layTokenSongWork` /
`layBridgeTokenWshr` đã tiêu thụ; GAS `bridgeCaps` trả `bridgeWshr:true` (đã kiểm live 12/08).

Con người **không làm gì thêm** — chỉ cần mở work/hr trong trình duyệt có extension là phiên tự chảy
về máy trạm, push-5s mượn dùng, khỏi đăng nhập.

**Việc vận hành còn lại (không phải code):**
1. ~~Reload extension~~ → **đã ghim 11/08/2026**, xem mục dưới. Không còn việc bật/tắt tay.
2. **Giữ 1 tab work.hasaki.vn hoặc hr.hasaki.vn mở** trong lúc làm việc → bridge wshr luôn có token
   tươi. (Kiểm: `getBridgeToken kind=wshr` trên GAS trả token thay vì rỗng.)

### Sự cố 11/08/2026 — và vì sao phải GHIM extension

Chiều 11/08 dữ liệu WMS đứng ở **13:03** suốt 5 tiếng. Không phải token hết hạn, không phải WMS đổi
API: **Edge đã tắt extension cầu nối**. Bằng chứng đọc từ chính profile Edge
(`Secure Preferences`): `disable_reasons: [1]` (bị tắt bằng tay/Edge tắt hộ) và
`extensions.ui.developer_mode` trống. Extension nạp kiểu **unpacked thì sống nhờ Chế độ nhà phát
triển** — Edge tắt chế độ đó là extension chết theo, im lặng, không ai được báo. F5 trang bao nhiêu
lần cũng vô ích vì không có content script nào được chèn vào trang.

Chữa gốc — đóng gói `.crx` (khoá cố định → **ID cố định**) rồi khai bằng policy
`ExtensionInstallForcelist`. Một lệnh, làm 1 lần:

```
node factory\wms-bridge\ghim-extension.mjs        (xem: --xem · tháo: --bo)
```

Sau đó Edge **tự cài lại mỗi lần khởi động**, không cần Chế độ nhà phát triển, và người dùng
**không có nút Tắt/Xoá** (hiện chữ "Được cài bởi quản trị viên").

Đã làm 11/08/2026: ID `khmhkieopmageficdhoolmnmmfogogeo`, policy ở
`HKCU\SOFTWARE\Policies\Microsoft\Edge\ExtensionInstallForcelist`.

Hai bẫy đã đụng và cách vượt:
- `HKCU\SOFTWARE\Policies` chỉ cho **Administrators** ghi (người dùng chỉ đọc) → script tự mở đúng
  **một lượt UAC**; bấm Yes là xong. Không cần sửa ACL, không cần policy máy (HKLM).
- `--pack-extension` **im lặng không làm gì** nếu Edge đang mở (tham số bị chuyển cho tiến trình
  đang chạy) → script luôn đóng gói bằng `--user-data-dir` tạm.

Đã kiểm thật, không đoán: bật một profile Edge **tạm** → nó đọc policy, tải
`file:///…/update.xml`, cài `location=7` (EXTERNAL_POLICY_DOWNLOAD = do policy, không tắt được),
`disable_reasons: []`, ver 1.4.0. Profile đang làm việc sẽ nhận khi **khởi động lại Edge** (hoặc
`edge://policy` → Reload policies); sau đó **xoá bản unpacked cũ** để hai bản không cùng nghe token.

**Khoá riêng `.pem`** nằm ở `factory/wms-bridge-ghim/` = danh tính extension, đã `.gitignore`
(repo `factory` là repo **công khai**). Mất khoá không chết: chạy lại script, nó sinh khoá mới và
tự cập nhật đúng mục policy cũ.

## Quan hệ hai đường

Đường 3 lo phần lớn thời gian (giờ làm, có người mở work/hr). Đường 2 là lưới đỡ cho lúc bridge rỗng
(sáng sớm, chưa ai mở work/hr) và là cách **tái lập phiên** khi mọi token đã chết. Cả hai cùng bật.

## Vì sao không đi đường "nghe lén app / moi seed"

Đã phân tích và loại: bắt gói phải bẻ certificate pinning, đọc bộ nhớ phải root máy — đều là **phá lớp
bảo vệ**, vỡ liên tục, và đi ngược `PHẦN D5/B7` trong `LICH-VA-DU-PHONG.md` (quyết định đã chốt của
dự án: không giả thiết bị, không trích khoá từ app điện thoại). Lấy seed **lúc ghi danh** thì hợp lệ;
moi seed từ **app đã cài** thì không.
