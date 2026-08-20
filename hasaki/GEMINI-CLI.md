# Gemini Pro trong terminal (Antigravity CLI)

Chốt 19/08/2026. Mục tiêu: gõ 1 lệnh là hỏi được Gemini Pro bằng **thuê bao đang trả tiền**, không mở thêm hoá đơn API.

## 1. Kết quả kiểm tra — 3 cửa, 2 cửa đã đóng

| Đường vào | Trạng thái | Bằng chứng đo được |
|---|---|---|
| `GEMINI_API_KEY` trong `hasaki/.env` (AI Studio) | Chỉ **Flash**. Pro chặn | `gemini-3.5-flash` → HTTP 200; `gemini-pro-latest`, `gemini-3.1-pro-preview` → **429** `quotaId: GenerateRequestsPerDayPerProjectPerModel-FreeTier` |
| **Gemini CLI** (`@google/gemini-cli`) + đăng nhập Google | **CHẾT** với mọi tài khoản cá nhân từ 18/06/2026 | đăng nhập OK (`letam0317@gmail.com`) nhưng gọi model là `IneligibleTierError: This client is no longer supported for Gemini Code Assist for individuals` — `reasonCode: UNSUPPORTED_CLIENT` |
| **Antigravity CLI** (`agy`) + đăng nhập Google | ✅ **ĐANG CHẠY** (`letam0317@gmail.com`) | `agy -p "..." --model gemini-3.1-pro-high` → trả lời “Tôi là Gemini 3.1 Pro.”, exit 0 |

Hai điều dễ nhầm, ghi lại cho khỏi mất công lần nữa:

1. **Thuê bao Google AI Pro không biến thành quota API.** Trả tiền Pro rồi gọi bằng API key vẫn 429.
   Khoá trong `.env` là free tier, chỉ Flash.
2. Lỗi của Gemini CLI có in `tierId: free-tier` — **đừng tin dòng đó**, nó không có nghĩa "tài khoản của
   mày là hạng free". Google chặn theo *client*: Gemini CLI không còn được phép phục vụ tài khoản cá nhân,
   Pro hay Ultra cũng vậy.

## 2. Cách dùng (Antigravity CLI)

```
GEMINI.bat                      # mo che do chat tai goc du an (thay ca hasaki + factory)
GEMINI.bat "cau hoi cua toi"    # hoi 1 phat roi thoat
agy                             # hoac go truc tiep trong terminal
agy -p "tom tat @hasaki/NHAN-DIEN-SKU.md"      # headless, in ra roi thoat
agy -p "..." --output-format json               # json (co the | jq)
agy -p "..." --model gemini-3.5-flash-medium    # ep model
agy -p "..." --effort high                      # muc suy luan: low | medium | high
```

Binary: `%LOCALAPPDATA%\agy\bin\agy.exe` (1 file, không cần Node). **Nó tự cập nhật ở nền.**

### Đăng nhập lần đầu — BẮT BUỘC terminal thật

Bấm shortcut **“Gemini CLI”** ngoài Desktop (trỏ `hasaki/GEMINI.bat`), hoặc mở Windows Terminal/PowerShell
gõ `agy`. Trình duyệt bật lên → **chọn tài khoản Google đang có AI Pro**. Phiên lưu vào Windows Credential
Manager (keyring), lần sau tự vào. Qua SSH thì nó in link + mã để dán tay.

**Không có lệnh `agy login`/`agy auth`** — đăng nhập chỉ xảy ra khi CLI cần gọi model.

**Bẫy 19/08/2026 — “không thấy trình duyệt mở”:**

* Gemini CLI (bản cũ): headless khi chưa có token thì **không mở trình duyệt gì cả**, chết ngay với
  `FatalAuthenticationError: ... the current session is non-interactive` (exitCode 41). `NO_BROWSER=1`
  cũng không cứu.
* Antigravity CLI: headless thì **có** in link + chờ dán mã, nhưng cửa sổ chờ **cứng 60 giây**
  (`Waiting for authentication (timeout 60s)`) và `--print-timeout` KHÔNG nới được — 60 giây không đủ
  cho người đọc tin nhắn rồi bấm link.

* **Mã dán lại sau khi hết 60 giây là vô dụng**: `code_verifier` (PKCE) sinh trong tiến trình, tiến trình
  chết là mất, không còn gì để đổi mã. Mỗi link chỉ dùng được với đúng tiến trình đã in ra nó.
* Timeout 60s **không** nới được: soi chuỗi trong `agy.exe` không có cờ hay biến môi trường nào cho nó.
  Trong binary có 2 kiểu chờ — `Waiting for authentication (timeout 60s)` (headless) và
  `Waiting for authentication...` không hạn (đường tương tác, kèm `Opening browser to authenticate`).

Kết luận: **login lần đầu phải làm trong cửa sổ terminal có người ngồi** (shortcut Desktop), không làm
được từ trong Claude Code / job nền / Task Scheduler. Sau khi có phiên trong keyring thì headless chạy tốt.

## 3. Xác nhận Pro thật sự đang chạy

```
agy -p "tra loi dung 1 tu: OK"                                   # ra "OK", exit 0
agy -p "ban la model nao?" --model gemini-3.1-pro-high           # ra "Tôi là Gemini 3.1 Pro."
```

Cả hai đã chạy thật 19/08/2026 với `letam0317@gmail.com`. Nếu về sau báo hết hạn mức / sai hạng thì
hoặc đăng nhập sai tài khoản, hoặc thuê bao đã rời khỏi tài khoản đó.

### Đường tự động hoá (nếu về sau cần job nền)

Antigravity CLI có đường bỏ hẳn OAuth: đặt `modelProvider: "gemini"` trong
`~/.gemini/antigravity-cli/settings.json` + biến môi trường `GEMINI_API_KEY` → gọi thẳng Gemini API.
Nhưng khoá hiện tại là free tier nên đường đó **chỉ được Flash**, không phải Pro. Muốn Pro trong job nền
thì buộc phải mở billing API — chưa làm.

## 4. Còn sót lại trên máy

- `@google/gemini-cli` 0.55.1 (npm global) — **vô dụng cho Pro**, chỉ còn chạy được bằng API key (Flash).
  Muốn dọn: `npm rm -g @google/gemini-cli`, xoá `~/.gemini/settings.json` và `~/.gemini/oauth_creds.json`.
- `~/.gemini/settings.json` đang ghim `oauth-personal` + chặn `GEMINI_API_KEY` lọt từ `.env` vào CLI
  (Gemini CLI bò từ cwd lên tìm `.env` đầu tiên rồi nạp vào env — chạy trong `hasaki/` là hút đúng khoá
  free tier). Antigravity CLI đọc cấu hình riêng ở `~/.gemini/antigravity-cli/settings.json`.

## 5. Liên quan

- Tab Nhận diện SKU (`NHAN-DIEN-SKU.md`) vẫn dùng Flash qua API key trong Apps Script — **giữ nguyên**,
  GAS không đăng nhập OAuth cá nhân được. Muốn Pro soi tem thì soi tay bằng `agy`, đừng đưa vào lịch chạy
  (đốt hạn mức thuê bao, mà lịch nền lại không login được).
- Ràng buộc nhẹ tải upstream không ảnh hưởng: CLI gọi Google, không gọi work/wms/hr/planogram.
