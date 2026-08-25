# KÊNH RA LỆNH BẰNG TIN NHẮN — 2 dự án, điều khiển từ điện thoại

> Dựng 19/08/2026. Công cụ: `hasaki/tin-nhan-bot.mjs` · lịch `5S Kenh tin nhan` (mỗi 2') ·
> log `tin-nhan.log`. Trạng thái: **ĐANG CHẠY từ 23/08/2026** — token + `chat_id` nằm trong
> `.env` (gitignore), ghép nối bằng §2. Kênh này cũng là **đường cảnh báo duy nhất** của
> `canh-suc-khoe.js` từ khi thư email tắt (`CANH_GUI_THU=0`) — xem §10.

Nhắn cho bot → máy trạm chạy đúng script → nhắn lại kết quả. Phủ cả **dự án 5S**
(`kiemsoatkho`: task 5S, chấm công, đẩy báo cáo) lẫn **dự án Factory** (`stocklocationfactory`:
tồn vị trí, kiểm kê, tồn bất thường, vệ sinh, tra UID).

---

## 1. Vì sao Telegram, không phải Zalo

| | Telegram Bot | Zalo OA |
|---|---|---|
| Máy nhận lệnh kiểu gì | **máy tự hỏi ra ngoài** (`getUpdates` long-poll) | Zalo **đẩy vào** (webhook) |
| Cần IP tĩnh / mở port / nhờ IT | **không** | có — phải có URL công khai |
| Duyệt / phí | không | OA doanh nghiệp phải duyệt; gửi ngoài cửa 48h phải mua ZNS |
| Nút bấm trong tin nhắn | có (inline keyboard) — hợp với mô hình "nút" của dự án | yếu |

Ràng buộc gốc của dự án là **không nhờ IT** (không service account, không IP tĩnh, không mở
firewall). Chỉ Telegram thoả được mà không phải xin gì: toàn bộ lưu lượng là HTTPS **đi ra**, y
như mọi lượt gọi WMS/GAS đang chạy hằng ngày. Đo thật 19/08/2026 tại máy trạm:
`api.telegram.org` trả lời **764 ms** — mạng công ty không chặn.

**Đường Zalo vẫn để ngỏ** (nếu sau này công ty bắt buộc): cho OA trỏ webhook vào **Apps Script Web
App** — vốn đã là URL công khai miễn phí của dự án — GAS ghi tin vào một tab hàng đợi, máy trạm
long-poll GAS y như đang hỏi cờ mỗi 2'. Vì thế phần "hộp thư" trong code (`tg()`, `guiTin()`) tách
hẳn khỏi phần thông dịch lệnh: cắm Zalo sau chỉ phải thay 2 hàm đó.

## 2. Bật kênh — 4 bước, ~2 phút, không cần IT

1. Mở Telegram → tìm **@BotFather** → Start → gõ `/newbot` → đặt tên hiển thị → đặt username kết
   thúc bằng `bot`.
2. BotFather trả về token dạng `1234567890:AAH…` → chép.
3. Dán vào `hasaki/.env`: `TELEGRAM_BOT_TOKEN=1234567890:AAH…`
4. Bấm **`GHEP-NOI-TIN-NHAN.bat`** → mở chat với bot, nhắn một chữ bất kỳ → script **tự bắt
   `chat_id` và ghi vào `.env`**, gửi lại lời chào. Xong — lịch 2' đã chạy sẵn từ trước, kênh sống
   ngay, không phải khởi động gì.

Chưa có token thì `tin-nhan-bot.mjs` **thoát êm (exit 0)**: lịch cứ chạy mỗi 2', không làm gì,
không ghi log — nên đăng ký lịch trước, dán token sau là đúng thứ tự.

## 3. Bộ lệnh

| Lệnh | Dự án | Loại | Chạy gì |
|---|---|---|---|
| `/giupdo` | chung | 👁 | danh sách lệnh |
| `/trangthai` | chung | 👁 | tuổi 7 mốc `.sync-ok-*` + phiên đang sống của ai + cụm có đang chạy |
| `/log <tên> [n]` | chung | 👁 | n dòng cuối một log (`/log kiemke 30`) |
| `/dangnhap` | chung | 🔐 | đăng nhập SSO — **bot nhắn xin bạn mã OTP 6 số**, xem §6 |
| `/5s` | 5S | ✍️ 20' | `auto-export-sync.js` (KHONG_LOGIN=1) |
| `/chamcong` | 5S | ✍️ 30' | `pull-timesheet.js` |
| `/daybaocao` | 5S | ✍️ 10' | `push-5s-to-workflow.js` |
| `/task` | 5S | 👁 | `task-hangngay.mjs` — xem 9 task + bản nháp, **không nộp** |
| `/nop` | 5S | ‼️ | nộp báo cáo task hằng ngày — **2 bước, xem §5** |
| `/dongbo` | Factory | ✍️ 30' | `sync-guard.js --force` (cả cụm tồn kho) |
| `/kiemke` | Factory | ✍️ 20' | `push-pc-to-sheet.mjs` (PC_DELTA=1) |
| `/tonkho` | Factory | ✍️ 30' | `sync-stocklocation.js` |
| `/batthuong` | Factory | ✍️ 30' | `sync-tonbatthuong.js` |
| `/vesinh` | Factory | ✍️ 15' | `sync-vesinh-all.js` |
| `/uid <mã…>` | Factory | 👁 | `tra-uid-ton.mjs` — tối đa 20 mã/lượt |

👁 chỉ đọc · ✍️ có ghi Sheet (kèm cooldown) · ‼️ ghi lên hệ thống công ty · 🔐 cần bạn đưa mã OTP.

**Không đưa vào kênh chat:** đăng nhập lại, xoá tab, deploy GAS. Ba việc đó hoặc đá phiên người
đang làm, hoặc không sửa lại được bằng một tin nhắn.

## 4. Nhịp chạy — vì sao không phải dịch vụ thường trú

```
Task Scheduler "5S Kenh tin nhan"  mỗi 2'   (MultipleInstances = IgnoreNew)
   → wscript tin-nhan-hidden.vbs (ẩn)
      → TIN-NHAN-BOT.bat  → node tin-nhan-bot.mjs
           long-poll getUpdates 45s/lượt, tổng ngân sách 100s rồi THOÁT
```

Máy tắt/bật, script chết, mạng rớt — lượt sau Task Scheduler tự dựng lại. Đúng mô hình đang nuôi
sống cả hệ; một dịch vụ thường trú chết lúc 2h sáng thì không ai biết.

Chạy **lịch riêng**, không nhét vào `watch-login-request.js`: bài học 17/08/2026 — nhét tra-UID
vào bộ canh làm lượt tra phải xếp hàng 181 giây. Long-poll giữ 100s/lượt sẽ bóp nghẹt trục thần
kinh (guard + poller + tra UID đang dùng chung tick 2').

## 5. `/nop` — giữ đúng bất biến "phải có người bấm"

Nút desktop (`NUT-NOP-TASK.bat`) chặn bằng **TTY**: không có bàn phím thì không nộp. Qua chat thì
"người" được định nghĩa lại là **chat nằm trong allowlist + bấm nút xác nhận**:

1. `/nop` → bot chạy `task-hangngay.mjs` (chế độ **xem**), gửi bản nháp về chat kèm 3 nút:
   `Nộp tất cả` · `Chỉ nhóm A` · `Thôi`.
2. Bấm nút → bot chạy `--nop --ep` (hoặc `--nop --ep --nhom=A`) rồi báo kết quả.

Chốt an toàn: `callback_data` mang **nonce dùng MỘT LẦN**, hết hạn **5 phút** (số liệu cũ hơn thì
bắt gõ lại), và chỉ nhận đúng chat đã gõ `/nop`. Bấm lại nút cũ → *"Nút này không còn hiệu lực"*.
Từ 25/08/2026 task `Sắp xếp hàng hóa tại kho tổng` nộp cùng mọi task khác — câu mặc định + phút
theo quỹ 480' (xem `TASK-HANG-NGAY.md` §4 và §6b).


## 6. `/dangnhap` — bot xin OTP, bạn nhắn 6 số

Seed TOTP đã chuyển sang app **Hasaki Authenticator**, không xuất được base32 nên bot **không tự
sinh mã**. Trước đây chỉ còn Đường 2: người phải **ngồi trước máy trạm** gõ 6 số vào cửa sổ trình
duyệt. Nay thêm **Đường 2b**: gõ 6 số vào Telegram, máy trạm tự gõ tiếp.

```
/dangnhap  →  bot kiểm luật phiên (đang có vé sống thì từ chối, khỏi đá ai)
           →  login-hasaki.js --auto --otp-chat  (cửa sổ chạy ngầm ngoài màn hình)
           →  điền email + mật khẩu → tới ô OTP
           →  📲 "🔐 CẦN MÃ OTP…"   ← bot nhắn cho bạn
           →  bạn nhắn "123456"      (bot XOÁ luôn tin đó cho sạch chat)
           →  gõ vào SSO, NỘP 1 LẦN DUY NHẤT → vé mới vào kho token, mọi bộ dùng chung
```

Không lách MFA: mã vẫn do chính bạn đọc từ app. Chat chỉ là đường chuyển 6 số thay cho bàn phím.

**Cụm 8h40 / watchdog cũng dùng được đường này** — bật `LOGIN_OTP_CHAT=1` trong `.env` thì lượt
đăng nhập tự động, thay vì hoãn im lặng vì không có ai gõ OTP, sẽ **nhắn xin bạn** rồi chạy tiếp.
Để trống = tắt, giữ nguyên hành vi cũ.

**Sáu chốt của riêng đường OTP:**

| | |
|---|---|
| Chỉ nhận mã khi **đang có yêu cầu treo** | 6 số nhắn vào lúc không ai hỏi → bot trả lời "bỏ qua", **không cất lại**. Một mã nằm chờ sẵn là mời người khác đăng nhập hộ |
| Yêu cầu chỉ do **máy trạm** phát | bot không bao giờ tự nghĩ ra lượt xin OTP; nó luôn sinh từ một lượt login đã qua cầu dao + luật phiên |
| **Không nộp bừa** | hết 5' không có mã ⇒ đóng trình duyệt, **không gửi gì lên IdP** (mỗi lượt sai là một bước tới khoá tài khoản) |
| **Chống dội** | lượt xin trước hết giờ mà không ai trả lời ⇒ im `LOGIN_OTP_NGHI_LAI_PHUT` (30') rồi mới xin lại — watchdog chạy mỗi giờ không biến chat thành chuông báo thức |
| **Xoá dấu vết** | nhận xong xoá tin chứa 6 số; mã **không bao giờ** vào log hay ảnh chụp hiện trường |
| **Báo động ngược** | tin xin OTP luôn kèm câu "KHÔNG PHẢI BẠN yêu cầu? Nhắn /huy và đổi mật khẩu" — ai đó chiếm được máy trạm mà gọi login thì bạn biết ngay |

**Một mình cái chat không đăng nhập được**: nó chỉ chuyển mã, mà mã thì chỉ app trên điện thoại
bạn sinh ra. Nhưng nếu bạn nhắn 6 số vào đúng lúc kẻ khác đang giữ máy trạm thì mã đó bị dùng —
vì thế mới có dòng cảnh báo trong mỗi lần hỏi. **Thấy tin xin OTP mà mình không yêu cầu: đừng gửi
mã, nhắn `/huy`.**

## 7. Bảo vệ

| Rủi ro | Chốt chặn |
|---|---|
| Người lạ nhắn bot | allowlist theo **`chat_id`** (số, không đổi được) — KHÔNG dùng `@username`. Chat lạ: **im lặng**, chỉ ghi log; trả lời tức là tự khai bot tồn tại |
| **Lệnh ôi** — máy tắt qua đêm, Telegram giữ tin 24h ⇒ sáng bật máy chạy sạch mớ lệnh tối qua | bỏ mọi tin cũ hơn `TIN_NHAN_HAN_PHUT` (15'), báo lại "đã quá hạn" |
| **Chạy hai lần** — Telegram giao lại update chưa xác nhận khi mạng đứt | **lưu `offset` TRƯỚC khi chạy lệnh**. Thà mất lệnh còn hơn nộp báo cáo đôi |
| Bơm tải lên WMS/work | cooldown riêng từng lệnh + trần `TIN_NHAN_MAX_LENH_GIO` (20/giờ) + né `cumDangChay()` |
| Lệnh treo | cắt sau `TIN_NHAN_CHAY_TOI_DA_PHUT` (10') |
| Đá phiên người đang làm | bot **không** truyền cờ ép đăng nhập; script con tự tuân `session-rules`, hết phiên thì exit 75 → bot trả lời "mở work/WMS rồi gõ lại" |
| Rò dữ liệu ra bên thứ ba | chat chỉ nhận **số liệu tổng hợp + đuôi log**, không đổ danh sách tên nhân viên/ảnh chứng từ. Muốn chi tiết thì mở link dashboard |
| Mất điện thoại / chiếm tài khoản | thu hồi bằng cách đổi token ở @BotFather (1') — mọi lệnh cũ chết ngay. Kênh không có lệnh nào đăng nhập/đổi mật khẩu/xoá dữ liệu |

Token bot nằm trong `.env` (đã gitignore), không bao giờ in ra log. `.tin-nhan-state.json`
(offset + cooldown + nonce) cũng gitignore: chép sang máy khác là nhận lại hoặc bỏ sót lệnh cũ.

## 8. Gỡ lỗi không cần Telegram

```bash
node tin-nhan-bot.mjs --ghepnoi            # cài đặt lần đầu (tự bắt chat_id, ghi .env)
node tin-nhan-bot.mjs --thu                # bắn 1 tin thử tới các chat được phép
TIN_NHAN_IN_RA=1 node tin-nhan-bot.mjs --lenh trangthai    # chạy lệnh, IN ra màn hình thay vì gửi
TIN_NHAN_IN_RA=1 node tin-nhan-bot.mjs --cb "nop:k:<nonce>" # thử nhánh bấm nút
```

`TIN_NHAN_IN_RA=1` là cách thử toàn bộ đường thông dịch + chạy script mà không đụng chat thật.

## 9. Bẫy đã cắn khi dựng (19/08/2026)

- **`[TimeSpan]::MaxValue` không đăng ký được lịch lặp.** `Register-ScheduledTask` trả
  `Duration:P99999999DT23H59M59S — value out of range`. Các task 2' đang chạy trên máy đều là
  **`P3650D`** (10 năm). ⇒ `SETUP-PC-MOI.ps1` đã sửa cả 3 chỗ dùng `MaxValue` (`Day bao cao 5S`,
  `5S Canh yeu cau dang nhap`, `5S Tra UID tren Sheet`) — trước đó dựng máy mới sẽ **đứt 3 task
  nhịp ngắn** ngay tại bước đăng ký.
- **Không redirect log qua `cmd >>` khi spawn script con.** Cụm đồng bộ đang giữ file log bằng
  `>>` thì tiến trình thứ hai mở không được, chết ngay `exit 1` trong 0 giây và **nuốt luôn thông
  báo lỗi**. Bot spawn `node` thẳng, tự gom stdout/stderr trong bộ nhớ.
- **Git Bash nuốt dấu `/`**: gõ `--lenh /giupdo` trong Git Bash bị đổi thành `C:/Program Files/…`.
  Trong Telegram thì không sao; thử trên máy thì gõ `--lenh giupdo` (bot chấp nhận cả hai dạng).

## 10. Chiều ngược lại: bot TỰ BÁO tình hình (không cần hỏi)

Kênh không chỉ để ra lệnh. `canh-suc-khoe.js` (chạy kèm watchdog `sync-guard`, **mỗi giờ 7–18h**)
gọi `baoTelegram()` ở cuối mỗi lượt soát:

| | |
|---|---|
| Hỏng | `⛔ Máy trạm 5S: n hạng mục cần người xử lý` + tóm tắt (bước đứng · cầu dao ngắt · cầu nối chết · dữ liệu trễ trong ngày) |
| Nhắc lại | tối đa **12h/lần** — hỏng dai không biến chat thành chuông báo thức |
| Lành | `✅ … bình thường trở lại`, gửi **một lần** rồi thôi |
| Im lặng | ngoài 7–18h và **Chủ nhật**: dữ liệu cũ lúc đó là cố ý, báo là báo giả (dạy người ta bỏ qua cảnh báo thật) |
| Chưa có token | bỏ qua êm, không lỗi |

**Báo 17h hằng ngày — "đi làm mà CHƯA báo cáo vệ sinh" (thêm 24/08/2026).** `sync-vesinh-all.js`
(poller nhịp 15') gọi `bao-vesinh-telegram.mjs` ngay sau khi tính bảng CHAMCONG-VESINH: lượt sync
ĐẦU TIÊN từ **17:00** nhắn đúng **1 tin/ngày** liệt kê từng người có chấm công hôm nay nhưng chưa
có báo cáo vệ sinh nào (tên + mã NV + giờ vào), **loại người đi ca trễ** (giờ vào ≥ 13:00 — 17h họ
chưa xong ca). Không ai chưa báo cáo → tin `✅`; không ai chấm công (ngày nghỉ) → im lặng; gửi lỗi
→ lượt 15' sau tự thử lại; mốc "hôm nay đã nhắn" ở `.bao-vesinh-17h.json` (gitignore). Chỉnh giờ
bằng `.env`: `VS_BAO_GIO=17:00`, `VS_BAO_CA_TRE=13:00`. Chạy thử: `node bao-vesinh-telegram.mjs --thu`
(tin số liệu MẪU, không đụng mốc). **0 lượt gọi upstream thêm** — dữ liệu là của chính lượt quét.

Vì `CANH_GUI_THU=0` (thư email tắt từ 15/08/2026), **đây là đường cảnh báo duy nhất còn sống**:
tắt token bot = cả hệ mất tai nghe, chỉ còn log nằm im trên đĩa. Muốn xem hiện trạng bất cứ lúc
nào mà không đợi báo: nhắn `/trangthai`, hoặc trên máy `node canh-suc-khoe.js --xem`.
