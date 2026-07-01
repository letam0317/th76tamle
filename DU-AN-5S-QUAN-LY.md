# 📋 DỰ ÁN 5S — Form Audit → Tạo task tự động trên work.hasaki.vn

> **File quản lý tổng hợp duy nhất** cho dự án: thu thập báo cáo kiểm soát kho 5S qua form web,
> lưu Google Sheet, rồi tự động tạo task xử lý vi phạm trong workflow 591 trên `work.hasaki.vn`.
> Cập nhật lần cuối: 2026-06-29.

---

## 1. Luồng hoạt động tổng thể

```
[ Người dùng điền form 5S trên điện thoại ]
                │  (HTML + Tailwind + Alpine + quét QR)
                ▼
[ Google Apps Script doPost ]  ── lưu ảnh lên Drive ──► thư mục "WMS-5S-AUDIT-HinhAnh"
                │
                ▼
[ Google Sheet  tab "WMS-5S-AUDIT" ]   (cột F = Mã task, trống = chưa đẩy)
                │
                │  push-5s-to-workflow.js đọc qua ?action=pending
                ▼
[ Bộ đẩy (Node + Puppeteer) ] ── lấy token từ phiên Edge đã đăng nhập
                │   khớp Hạng mục 5S → "Lỗi vi phạm" (TYPE00)
                ▼
[ POST wshr.hasaki.vn/api/hr/projects/create-task-workflow ]  → tạo task kèm ảnh
                │
                ▼
[ Ghi mã task ngược lại Sheet (?action=mark) ]  →  cột F hiện HSK-xxxx
```

Báo cáo "Không phát sinh vi phạm" được bỏ qua (không tạo task).
Tự động chạy mỗi 6h qua Windows Scheduled Task. Phiên hết hạn → gửi email cảnh báo.

---

## 2. Thành phần & vai trò

| File | Vai trò |
|---|---|
| `public/index.html` | **Frontend form 5S** (bản gốc). HTML + Tailwind CDN + Alpine.js + html5-qrcode. 4 mục: hiện trạng, vị trí (quét mã vạch), hạng mục 5S (31 mục), ảnh/clip — **chụp trực tiếp bằng camera live (getUserMedia, có nút đổi camera trước/sau) hoặc chọn từ thư viện**. Gửi JSON `Content-Type: text/plain` để né CORS preflight. |
| `form-5s/index.html` | Bản đã deploy của form (GitHub Pages `/form-5s`). |
| `google-script.gs` | **Backend Apps Script** (bản git, SECRET = placeholder). `doPost` lưu form; `doGet?action=pending/mark/alert`. |
| `google-script-DEPLOY.gs` | Bản dán vào Apps Script (đã điền SECRET thật + hàm `testGuiMail`). **KHÔNG commit** (đã gitignore). |
| `push-5s-to-workflow.js` | **Bộ đẩy** chính. Lấy token, đọc pending, khớp TYPE00, tạo task, mark. Đọc cấu hình từ `.env`. |
| `login-hasaki.js` | Mở Edge đăng nhập work.hasaki.vn 1 lần, lưu phiên vào `.wms-session/edge-profile`. |
| `capture-task-api.js` | Công cụ bắt cấu trúc API tạo task (Puppeteer hook `fetch`/`XHR`) — dùng khi cần reverse lại API. |
| `DAY-BAO-CAO-5S.bat` | Chạy nhanh bộ đẩy (bấm đúp) hoặc cho Task Scheduler gọi. Ghi `day-bao-cao-5s.log`. |
| `.env` / `.env.example` | Cấu hình & bí mật (xem mục 5). `.env` đã gitignore. |
| `package.json` / `node_modules/` | Phụ thuộc Node: `puppeteer`, `dotenv`. |
| `.wms-session/edge-profile/` | Profile Edge đã đăng nhập (gitignore). |

---

## 3. Backend Apps Script (Google Sheet)

- **Sheet tab:** `WMS-5S-AUDIT` — cột: 1 Ngày | 2 Hiện trạng | 3 Vị trí | 4 Hạng mục 5S | 5 Chuỗi ảnh | 6 Mã task.
- **Thư mục ảnh Drive:** `WMS-5S-AUDIT-HinhAnh` (ảnh chia sẻ ANYONE_WITH_LINK).
- **URL /exec:** `https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec`
- **Actions** (đều cần `?key=<SECRET>`):
  - `?action=pending` → trả báo cáo chưa đẩy (có ảnh base64), tối đa 25/lần.
  - `?action=mark&row=N&code=XXX` → ghi mã task vào hàng N.
  - `?action=alert&msg=...` → gửi email cảnh báo (chống spam 1 mail/12h).
- **Email cảnh báo:** `th76tamle02@gmail.com` (sửa biến `ALERT_EMAIL` trong script).

### Redeploy Apps Script (khi sửa backend)
1. Sheet → **Tiện ích mở rộng → Apps Script**.
2. Mở `google-script-DEPLOY.gs` (đã có SECRET thật) → copy hết → dán đè → **Lưu**.
3. (Lần đầu có gửi mail) chọn hàm `testGuiMail` → **Run** → cấp quyền → kiểm tra mail test.
4. **Triển khai → Quản lý bản triển khai → ✎ Sửa → Version: New version → Triển khai.** URL /exec giữ nguyên.

---

## 4. API tạo task work.hasaki.vn (workflow 591 — "5S kiểm soát kho")

- **Endpoint:** `POST https://wshr.hasaki.vn/api/hr/projects/create-task-workflow` (multipart/form-data).
- **Auth:** `Authorization: Bearer <JWT>`. Token wshr **hết hạn sau 48h**, lấy tự động từ phiên Edge đã đăng nhập (SSO email Hasaki, có thể kèm OTP).
- **Định nghĩa field:** `GET https://wshr.hasaki.vn/api/hr/workflows/591`.
- **Payload:**
  - Chung: `name`, `amount_of_work=0`, `type=2`, `staff_id=17312`, `date_start`, `date_end`, `planned_hours=0`, `piority=0`, `workflow_id=591`.
  - `data[configs][DATE00]` — Ngày vi phạm (date_time, bắt buộc) ← Ngày báo cáo.
  - `data[configs][TYPE00]` — Lỗi vi phạm (option, bắt buộc) ← Hạng mục 5S (**normalize bỏ dấu phẩy** để khớp).
  - `data[configs][BIN00]` — Vị trí ghi nhận (long_text) ← Vị trí + hiện trạng.
  - `data[configs][IMA00][]` — Hình ảnh vi phạm (file, mảng, bắt buộc) ← ảnh báo cáo.

### Ánh xạ Form → Task (cập nhật 2026-06-29)
| Form 5S | → | Task workflow 591 |
|---|---|---|
| Thời gian vi phạm (từ ảnh/video; thiếu → lúc gửi form) | → | `DATE00` + date_start/date_end |
| Hạng mục 5S | → | `TYPE00` (tự khớp 32 lựa chọn, ngưỡng 0.55) |
| Vị trí | → | `BIN00` (chỉ vị trí, KHÔNG còn ghép hiện trạng) |
| Hiện trạng (ghi chú) | → | `note` (= "Mô tả") — ⚠ field `note` API chấp nhận & echo nhưng endpoint danh sách không trả lại; cần xác minh trên UI. Nếu sai, bắt lại bằng `capture-task-api.js`. |
| Ảnh (image/*) | → | `data[configs][IMA00][]` (bắt buộc; báo cáo chỉ có video sẽ bị bỏ qua) |
| Video (video/*) | → | `data[configs][VID01][]` |
| (mặc định) | | giao `staff_id=17312`, tiêu đề `[5S] <vị trí> - <hạng mục>` |

Bộ đẩy tách ảnh/video theo **mime** (apiPending trả mime từng file Drive). Sheet thêm cột 7 "Thời gian vi phạm".

---

## 5. Cấu hình `.env`

```
APPSCRIPT_KEY=hsk5s-2026-bem4t          # PHẢI trùng biến SECRET trong Apps Script
APPSCRIPT_URL=https://script.google.com/macros/s/AKfyc.../exec
WORKFLOW_ID=591
STAFF_ID=17312
# (tuỳ chọn) EDGE_PROFILE_DIR=C:/Users/lechitam/New folder/.wms-session/edge-profile
```

---

## 6. Vận hành

- **Đẩy thủ công:** bấm đúp `DAY-BAO-CAO-5S.bat` (hoặc `node push-5s-to-workflow.js`).
- **Tự động:** Windows Scheduled Task tên **`Day bao cao 5S`** chạy **mỗi 15 phút** (giới hạn 5 phút/lần, IgnoreNew chặn chạy chồng). Task chỉ tạo khi lịch chạy — KHÔNG tức thời lúc gửi form (bộ đẩy cần token phiên Edge trên máy, Apps Script không tự gọi được).
  - Xoá lịch: PowerShell `Unregister-ScheduledTask -TaskName 'Day bao cao 5S'`.
- **Đăng nhập lại (khi phiên hết hạn):** `node login-hasaki.js` → đăng nhập (email + OTP) → đóng Edge.
- **Cảnh báo:** khi phiên hết hạn lúc chạy tự động, hệ thống gửi email về `th76tamle02@gmail.com`.

---

## 7. Bảo mật & Git

- Bí mật chỉ ở `.env` và `google-script-DEPLOY.gs` (cả hai đã **gitignore**). Code commit không chứa key cứng.
- Tooling commit ở nhánh **`tooling/5s-push`** (chưa push).
- ⚠️ **KHÔNG push lên repo public** `letam0317/th76tamle` — sẽ lộ API nội bộ Hasaki. Muốn lưu git thì dùng **repo PRIVATE**.

---

## 8. Xử lý sự cố

| Triệu chứng | Cách xử lý |
|---|---|
| "Phiên đăng nhập đã hết hạn" | `node login-hasaki.js` |
| "Sai key" | `APPSCRIPT_KEY` trong `.env` ≠ `SECRET` trong Apps Script đã deploy |
| "Bỏ qua: không khớp hạng mục" | Hạng mục không có trong danh sách workflow, hoặc là loại "không vi phạm" |
| POST Apps Script trả 404 (trang Drive) | Hiccup follow-redirect — thử lại; test bằng Node `fetch`, KHÔNG dùng `curl -L` |
| Đổi người được giao / tiêu đề | Sửa `STAFF_ID` / dòng tạo `name` trong `push-5s-to-workflow.js` |
| Đổi workflow khác | Sửa `WORKFLOW_ID`; bắt lại field bằng `capture-task-api.js` nếu field khác |
</content>
