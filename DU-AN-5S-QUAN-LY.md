# 📋 DỰ ÁN 5S — Kiểm soát kho: Form → Google Sheet → Task work.hasaki.vn → Dashboard

> **File quản lý tổng hợp DUY NHẤT** của dự án.
> Thu thập báo cáo kiểm soát kho 5S qua form web → lưu Google Sheet → tự động tạo task
> xử lý vi phạm trong workflow 591 trên `work.hasaki.vn` → theo dõi qua dashboard.
> **Cập nhật lần cuối: 2026-07-01.**

---

## 0. Bản đồ toàn hệ thống (các module)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  MODULE A — THU THẬP (điện thoại)                                             │
│  public/index.html: form 5S (quét mã vạch, chụp ảnh/clip)                     │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                 │ POST (JSON text/plain, né CORS)
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  MODULE B — LƯU TRỮ & BACKEND (Google Apps Script + Google Sheet + Drive)     │
│  google-script.gs: doPost lưu form, doGet phục vụ các bộ Node                 │
│  Tab WMS-5S-AUDIT (inbox báo cáo)  ·  Tab 5S-TASKS (mirror task cho dashboard)│
└───────┬─────────────────────────────────────────────────┬─────────────────────┘
        │ ?action=pending / mark                            │ ?action=syncTasks
        ▼                                                   ▼
┌───────────────────────────┐                 ┌───────────────────────────────────┐
│ MODULE C — TẠO TASK        │                 │ MODULE E — DASHBOARD & ĐỒNG BỘ    │
│ push-5s-to-workflow.js     │                 │ sync-board-to-sheet.js (đọc Excel) │
│ → tạo task workflow 591    │                 │ dashboard-5s.html (xem + lọc)     │
└───────────┬───────────────┘                 └───────────────────────────────────┘
            │ cần token (Bearer 48h)
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  MODULE D — ĐĂNG NHẬP & PHIÊN                                                 │
│  login-hasaki.js (tự điền email+MK, gõ OTP) · watch-login-request.js (bộ canh)│
│  Nút trong email cảnh báo → yêu cầu đăng nhập từ ĐIỆN THOẠI/WEB bất kỳ        │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Nền tảng kỹ thuật:** Node ≥18 (ESM, `"type":"module"`), Puppeteer (điều khiển Edge),
`xlsx` (đọc file export), `dotenv`. Bí mật CHỈ nằm trong `.env` (đã gitignore).

---

## MODULE A — Thu thập báo cáo (Form 5S)

| Mục | Chi tiết |
|---|---|
| **File** | `public/index.html` (bản gốc) · `form-5s/index.html` = bản deploy GitHub Pages `/form-5s` |
| **Công nghệ** | HTML + Tailwind CDN + Alpine.js + html5-qrcode |
| **4 phần nhập** | (1) Hiện trạng · (2) Vị trí (quét mã vạch) · (3) Hạng mục 5S (31 mục) · (4) Ảnh/clip |
| **Ảnh/clip** | Chụp trực tiếp bằng camera live (`getUserMedia`, có nút đổi camera trước/sau) HOẶC chọn từ thư viện |
| **Gửi dữ liệu** | POST JSON `Content-Type: text/plain` → né CORS preflight tới Apps Script |

Báo cáo **"Không phát sinh vi phạm"** vẫn được lưu nhưng KHÔNG tạo task.

---

## MODULE B — Lưu trữ & Backend (Apps Script + Google Sheet)

**File:** `google-script.gs` (bản git, `SECRET` = placeholder) ·
`google-script-DEPLOY.gs` (bản dán vào Apps Script, có SECRET thật + `testGuiMail`, **KHÔNG commit**).

### Google Sheet — 2 tab tách biệt
| Tab | Vai trò | Cột |
|---|---|---|
| `WMS-5S-AUDIT` | **Inbox báo cáo** từ form | 1 Ngày · 2 Hiện trạng · 3 Vị trí · 4 Hạng mục · 5 Chuỗi ảnh · 6 **Mã task** (trống = chưa đẩy) · 7 Thời gian vi phạm |
| `5S-TASKS` | **Mirror toàn bộ task** workflow 591 (cho dashboard) | Do bộ đồng bộ ghi đè (Module E) — tách khỏi inbox nên không gây trùng lặp |

- **Thư mục ảnh Drive:** `WMS-5S-AUDIT-HinhAnh` (chia sẻ ANYONE_WITH_LINK).
- **URL /exec:** `https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec`

### Endpoint (mọi action đều cần `?key=<SECRET>`)
| Action | Kiểu | Chức năng |
|---|---|---|
| `doPost` (form) | POST | Lưu 1 báo cáo + ảnh lên Drive |
| `doPost {action:syncTasks}` | POST | Ghi đè tab `5S-TASKS` bằng dữ liệu task (Module E) |
| `?action=pending` | GET | Trả báo cáo chưa đẩy (kèm ảnh base64), tối đa 25/lần |
| `?action=mark&row=N&code=XXX` | GET | Ghi mã task vào hàng N |
| `?action=alert&msg=...` | GET | Gửi email cảnh báo hết phiên (chống spam 1 mail/12h) |
| `?action=info` | GET | Trả sheetId/URL (cấu hình dashboard) |
| `?action=requestLogin` | GET | **[MỚI]** Đặt cờ "cần đăng nhập" + hiện trang ✅ (nút trong email bấm từ điện thoại/web) |
| `?action=loginStatus` | GET | **[MỚI]** Máy PC hỏi có yêu cầu đăng nhập không (cờ hiệu lực 15 phút) |
| `?action=clearLogin` | GET | **[MỚI]** Máy PC báo đã xử lý → xoá cờ |

- **Email cảnh báo:** `th76tamle02@gmail.com` (biến `ALERT_EMAIL`).

### Redeploy Apps Script (khi sửa backend)
1. Sheet → **Tiện ích mở rộng → Apps Script**.
2. Mở `google-script-DEPLOY.gs` → copy hết → dán đè → **Lưu**.
3. (Lần đầu có gửi mail) chạy hàm `testGuiMail` → cấp quyền → kiểm tra mail test.
4. **Triển khai → Quản lý bản triển khai → ✎ Sửa → New version → Triển khai.** URL /exec giữ nguyên.

---

## MODULE C — Tạo task tự động (bộ đẩy)

**File:** `push-5s-to-workflow.js` · chạy nhanh: `DAY-BAO-CAO-5S.bat` (chạy xong tự đóng, log `day-bao-cao-5s.log`).

**Luồng:** lấy token (Module D) → `?action=pending` → khớp hạng mục → POST tạo task → `?action=mark`.

### API tạo task (workflow 591 — "5S kiểm soát kho")
- **Endpoint:** `POST https://wshr.hasaki.vn/api/hr/projects/create-task-workflow` (multipart/form-data).
- **Auth:** `Authorization: Bearer <JWT>` — token **hết hạn 48h**, lấy tự động từ phiên Edge.
- **Định nghĩa field:** `GET https://wshr.hasaki.vn/api/hr/workflows/591`.

### Ánh xạ Form → Task
| Form 5S | → | Task workflow 591 |
|---|---|---|
| Thời gian vi phạm (từ ảnh/video; thiếu → lúc gửi form) | → | `DATE00` + date_start/date_end |
| Hạng mục 5S | → | `TYPE00` (tự khớp 32 lựa chọn, ngưỡng 0.55, normalize bỏ dấu phẩy) |
| Vị trí | → | `BIN00` (chỉ vị trí) |
| Hiện trạng (ghi chú) | → | `note` (= "Mô tả") |
| Ảnh (`image/*`) | → | `data[configs][IMA00][]` (**bắt buộc**; báo cáo chỉ có video sẽ bị bỏ qua) |
| Video (`video/*`) | → | `data[configs][VID01][]` |
| (mặc định) | | `staff_id=17312`, tiêu đề `[5S] <vị trí> - <hạng mục>` |

Bộ đẩy tách ảnh/video theo **mime** (apiPending trả mime từng file Drive).

---

## MODULE D — Đăng nhập & Phiên (MỚI — cập nhật 2026-07-01)

> **Vấn đề:** token wshr hết hạn sau 48h; đăng nhập lại cần con người gõ OTP **trên máy PC**.
> **Mục tiêu mới:** nhận cảnh báo → bấm 1 nút **từ điện thoại/web bất kỳ** → PC tự mở màn hình
> login → chỉ gõ **OTP 6 số** (email + mật khẩu tự điền).

### Luồng "đăng nhập theo yêu cầu"
```
[Mail cảnh báo]  nút 🔐 "Yêu cầu đăng nhập lại"  = link https (điện thoại/web đều bấm được)
      │
      ▼  ?action=requestLogin&key=…
[Apps Script] ghi cờ LOGIN_REQUESTED + hiện trang ✅ "PC sẽ mở login trong ~2 phút"
      │
      │  máy PC — lịch "5S Canh yeu cau dang nhap" chạy MỖI 2 PHÚT
      ▼
[watch-login-request.js]  ?action=loginStatus → thấy cờ → ?action=clearLogin → mở login-hasaki.js
      │
      ▼
[login-hasaki.js] Edge mở, TỰ ĐIỀN email + mật khẩu (từ .env) → người dùng gõ OTP 6 số → lưu phiên
```

### Thành phần
| File | Vai trò |
|---|---|
| `login-hasaki.js` | Mở Edge (profile `.wms-session/edge-profile`), **tự điền `HASAKI_EMAIL` + `HASAKI_PASSWORD`** (poll điền cả khi SSO nhiều bước, KHÔNG đụng ô OTP), người dùng gõ OTP. Tự dọn lockfile khi đóng. |
| `LOGIN-HASAKI.bat` | Gọi `login-hasaki.js` (dùng cho giao thức `hasaki5s://`). |
| `watch-login-request.js` | **Bộ canh trên PC**: hỏi `loginStatus`, có cờ → `clearLogin` → spawn `login-hasaki.js`. Lockfile `.login-open.lock` chống mở trùng (hết hạn 15'). |
| `KIEM-TRA-YEU-CAU-LOGIN.bat` | Bọc bộ canh (log `watch-login.log`); Task Scheduler gọi mỗi 2 phút. |
| `DANG-KY-NUT-LOGIN.reg` | Đăng ký giao thức `hasaki5s://login` → `LOGIN-HASAKI.bat` (ghi HKCU, không cần admin). Cho nút phụ "mở ngay" khi đang đọc mail **trên chính PC**. |

### Lấy token tự động (dùng cho Module C & E)
`getToken()` mở Edge headless với profile đã đăng nhập → vào `work.hasaki.vn` → bắt header
`Authorization` gửi tới `wshr.hasaki.vn` (chính là JWT). Còn phiên trong profile thì mỗi lần chạy tự lấy token mới.

### Giới hạn đã biết
- **OTP vẫn gõ tại PC** (TOTP đổi mỗi 30s, chuyển tiếp qua mạng sẽ hết hạn). Bấm điện thoại chỉ để "ra lệnh PC mở sẵn màn hình".
- **Ô tự điền là best-effort** (chưa xác minh selector trang login thật) — nếu điền sai ô, cần chỉnh selector 1 lần.
- Muốn **bấm điện thoại là xong hẳn**: nạp mã bí mật TOTP vào `.env` để tự sinh OTP (dự án đã có `otpauth`) — chưa bật.

---

## MODULE E — Dashboard & Đồng bộ

> **Nguyên tắc:** chỉ ĐỌC workflow & GHI tab reporting, KHÔNG tạo task → không đụng inbox, không trùng lặp.

| File | Vai trò |
|---|---|
| `sync-board-to-sheet.js` | **Bộ đồng bộ chính**: đọc file Excel `Board-task-workflow-step-*-591-*.xlsx` **mới nhất trong Downloads** (xuất từ nút Export trên workflow), đổi path media → URL `hr-media.hasaki.vn`, ghi đè tab `5S-TASKS` qua `?action=syncTasks`. Header ghép "nhóm bước ▸ tên cột". **Không cần token.** |
| `sync-tasks-to-sheet.js` | Bản đồng bộ qua API (Puppeteer + token) — **giữ dự phòng**, không dùng mặc định. |
| `DONG-BO-TASK.bat` | Gọi `sync-board-to-sheet.js` (chạy xong tự đóng, log `dong-bo-task.log`). |
| `DONG-BO-TASK-AN.vbs` | Chạy `DONG-BO-TASK.bat` **hoàn toàn ẩn** (không hiện cửa sổ). |
| `dashboard-5s.html` | Trang xem task: đọc tab `5S-TASKS` qua **gviz JSONP**, lọc theo ngày/status/lỗi/tìm kiếm, xem ảnh & clip (media từ `hr-media`), nhấp 1 dòng xem chi tiết. |

**Quy trình cập nhật dashboard:** bấm nút **Export** trên workflow 591 → chạy `DONG-BO-TASK.bat`
(hoặc `DONG-BO-TASK-AN.vbs`) → mở `dashboard-5s.html`.

---

## 5. Cấu hình `.env` (đã gitignore)

```
APPSCRIPT_KEY=hsk5s-2026-bem4t          # PHẢI trùng biến SECRET trong Apps Script
APPSCRIPT_URL=https://script.google.com/macros/s/AKfyc.../exec
WORKFLOW_ID=591
STAFF_ID=17312

# Đăng nhập work.hasaki.vn (login-hasaki.js tự điền; chỉ gõ OTP 6 số)
HASAKI_EMAIL=                           # email SSO Hasaki
HASAKI_PASSWORD=                        # đổi mật khẩu công ty thì chỉ sửa dòng này

# (tuỳ chọn)
# EDGE_PROFILE_DIR=C:/Users/lechitam/New folder/.wms-session/edge-profile
# DOWNLOADS_DIR=C:/Users/lechitam/Downloads
```

---

## 6. Vận hành — các lịch Windows Scheduled Task

| Tên task | Chu kỳ | Gọi | Việc |
|---|---|---|---|
| `Day bao cao 5S` | mỗi 15 phút | `DAY-BAO-CAO-5S.bat` | Đẩy báo cáo mới → tạo task (Module C) |
| `5S Canh yeu cau dang nhap` | **mỗi 2 phút** | `KIEM-TRA-YEU-CAU-LOGIN.bat` | Canh cờ đăng nhập → mở login khi được yêu cầu (Module D) |

- **Đẩy thủ công:** bấm đúp `DAY-BAO-CAO-5S.bat`.
- **Đồng bộ dashboard:** Export trên workflow → `DONG-BO-TASK.bat`.
- **Đăng nhập lại:** bấm nút trong email (mọi thiết bị) HOẶC chạy `node login-hasaki.js` tại PC.
- **Xoá 1 lịch:** `Unregister-ScheduledTask -TaskName '<tên>'`.

---

## 7. Bảo mật & Git

- Bí mật chỉ ở `.env` và `google-script-DEPLOY.gs` (**cả hai đã gitignore**). Code commit không chứa key cứng.
- Link `?action=requestLogin` trong email có kèm `key`; người lạ có mail cũng chỉ khiến PC *mở cửa sổ login* chứ không đăng nhập được (không có OTP). Rủi ro thấp.
- Tooling ở nhánh **`tooling/5s-push`** (chưa push).
- ⚠️ **KHÔNG push lên repo public** `letam0317/th76tamle` — sẽ lộ API nội bộ Hasaki. Muốn lưu git thì dùng **repo PRIVATE**.

---

## 8. Xử lý sự cố

| Triệu chứng | Cách xử lý |
|---|---|
| "Phiên đăng nhập đã hết hạn" | Bấm nút trong email, hoặc `node login-hasaki.js` |
| Nút trong email bấm không ăn (Gmail) | Gmail có thể chặn — dùng link https `requestLogin` (đã là mặc định); nếu vẫn kẹt, mở link trên trình duyệt khác |
| Login không tự điền email/mật khẩu | Kiểm tra `HASAKI_EMAIL`/`HASAKI_PASSWORD` trong `.env`; báo để chỉnh selector trang login |
| "Sai key" | `APPSCRIPT_KEY` (.env) ≠ `SECRET` (Apps Script đã deploy) |
| "Bỏ qua: không khớp hạng mục" | Hạng mục không có trong workflow, hoặc loại "không vi phạm" |
| "Không thấy file Board-...xlsx" | Chưa bấm Export trên workflow 591 trước khi chạy `DONG-BO-TASK` |
| Dashboard trống | Kiểm tra quyền chia sẻ Sheet; đã chạy đồng bộ chưa |
| POST Apps Script trả 404 | Hiccup follow-redirect — thử lại; test bằng Node `fetch`, KHÔNG dùng `curl -L` |
| Đổi người giao / workflow | Sửa `STAFF_ID` / `WORKFLOW_ID`; bắt lại field bằng `capture-task-api.js` |
