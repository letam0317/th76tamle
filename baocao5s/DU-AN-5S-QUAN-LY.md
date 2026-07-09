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
- **URL /exec:** xem `APPSCRIPT_URL` trong `.env` (URL này lộ qua form public là bình thường; bảo vệ bằng `key` ở các action nhạy cảm).

### Endpoint (mọi action đều cần `?key=<SECRET>`)
| Action | Kiểu | Chức năng |
|---|---|---|
| `doPost` (form) | POST | Lưu 1 báo cáo + ảnh lên Drive |
| `doPost {action:syncTasks}` | POST | Ghi đè tab `5S-TASKS` bằng dữ liệu task (Module E) |
| `?action=pending` | GET | Trả báo cáo chưa đẩy (kèm ảnh base64), tối đa 25/lần |
| `?action=mark&row=N&code=XXX` | GET | Ghi mã task vào hàng N |
| `?action=alert&msg=...` | GET | Gửi email cảnh báo — CHỈ khi **tự đăng nhập thất bại** (không phải mỗi lần hết phiên); chống spam 1 mail/throttle |
| `?action=info` | GET | Trả sheetId/URL (cấu hình dashboard) |
| `?action=requestLogin` | GET | Đặt cờ "cần đăng nhập" + hiện trang ✅ (nút trong email bấm từ điện thoại/web) |
| `?action=loginStatus` / `clearLogin` | GET | Máy PC hỏi/xoá cờ đăng nhập (cờ hiệu lực 15 phút) |
| `?action=requestSync&pin=&callback=` | GET (JSONP) | **[MỚI]** Nút "Cập nhật ngay" trên dashboard — cần **`SYNC_PIN`** (không phải key); đặt cờ `SYNC_REQUESTED` |
| `?action=syncStatus` / `clearSync` | GET | **[MỚI]** Máy PC hỏi/xoá cờ cập nhật dashboard |

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

### Tự động 100% — auto-login qua SSO (cập nhật 2026-07-06, ĐÃ KIỂM CHỨNG)

**Cơ chế đăng nhập thật (đã mổ xẻ):** `work.hasaki.vn` dùng **OIDC + PKCE + DPoP + Cloudflare Turnstile**.
- Trang `work.hasaki.vn/auth/login` chỉ có nút **"Đăng nhập với Hasaki SSO"** → nhảy sang IdP `auth-idp.inshasaki.com`.
- Các bước: `identifier` (email) → `POST /api/auth/identify` (**có Turnstile, `captcha_required_level:2`**) →
  `login/password` (mật khẩu) → `login` (OTP) → callback → `work.hasaki.vn` mint JWT.
- **Vì có Turnstile + DPoP → KHÔNG thể đăng nhập bằng HTTP thuần** (Apps Script/`curl`). Bắt buộc **trình duyệt thật**.

**`login-hasaki.js`** giờ tự lái đúng luồng này:
- Máy trạng thái nhận diện theo Ô đang hiện (SSO button → email → password → OTP), dùng **React native value setter**.
- OTP tự sinh từ **`HASAKI_2FA_SECRET`** (base32) bằng `otpauth`; tối đa 2 mã (tránh khoá tài khoản).
- **Chạy NGẦM off-screen** (headful nhưng `--window-position=-32000,-32000`) — Turnstile cần trình duyệt
  thật (headless hay bị chặn), nhưng cửa sổ đặt NGOÀI màn hình → không hiện, không che, không cướp thao tác.
  Cờ `--disable-*background*` giữ trang không bị Chrome "ngủ" khi ở nền. Thêm `--show` nếu muốn hiện cửa sổ để gỡ lỗi.
- **Trang gộp**: sau "Tiếp tục", IdP hiện 1 trang có CẢ email + mật khẩu + OTP → code điền theo **ô đang trống**
  (không dùng cờ 1 lần) nên email luôn được điền; chờ Turnstile bật nút rồi mới bấm.
- **OTP chống khoá**: gõ bằng PHÍM THẬT, chỉ khi mã còn ≥10s, **NỘP ĐÚNG 1 LẦN** (`credSubmitted`), không retry/không nộp trùng.
- `--auto`: tự động hoàn toàn (chạy ngầm, tự đóng khi xong), thành công exit 0 / thất bại exit 1, hạn 4'.
- ✅ Đã kiểm chứng end-to-end (2026-07-06): SSO → email → Tiếp tục → mật khẩu → OTP → token, cửa sổ ẩn, 0 lượt sai.

**Tự phục hồi phiên (khép kín, không cần người):** `push-5s-to-workflow.js` & `auto-export-sync.js` khi thấy hết phiên
→ tự gọi `node login-hasaki.js --auto` → thử lại token. Logic chung ở `auto-login.js`
(`layTokenTuPhucHoi`, `chayAutoLogin`, `coSecret`). Bỏ trống `HASAKI_2FA_SECRET` = quay lại chế độ người gõ OTP.

### Giới hạn đã biết
- **Vẫn chạy trên PC** (chọn để 0 chi phí). Muốn thoát PC phải chạy trình duyệt thật trên máy luôn-bật khác
  (VPS + Xvfb…) vì Turnstile/DPoP chặn mọi cách không-trình-duyệt. Khi tự phục hồi sẽ **hiện cửa sổ login vài chục giây**
  rồi tự đóng (không cần thao tác, nhưng có cửa sổ nhấp nháy).
- Turnstile ở mức "managed" — trình duyệt Edge thật trên PC tự vượt (đã kiểm). Nếu Hasaki nâng mức thách thức tương tác,
  có thể cần can thiệp tay 1 lần.

---

## MODULE E — Dashboard & Đồng bộ

> **Nguyên tắc:** chỉ ĐỌC workflow & GHI tab reporting, KHÔNG tạo task → không đụng inbox, không trùng lặp.

| File | Vai trò |
|---|---|
| `auto-export-sync.js` | **Bộ đồng bộ chính — TỰ ĐỘNG 100%** (không cần bấm nút, không cần file Downloads). Lấy token → `POST /api/hr/excel-io/export` (queue, chia cửa sổ ≤60 ngày vì hạn 3 tháng/lần) → poll `GET /api/hr/excel-io` (≤~300s + retry 1 lần) tới khi `status=1` → **tải file công khai** `wshr.hasaki.vn/production/hr/<file_path>` → đổi path ảnh → URL `hr-media` → gộp+khử trùng theo Task Code → ghi `5S-TASKS`. **[TỐI ƯU 2026-07-09] Đồng bộ TĂNG DẦN** (xem chi tiết cuối Module E). |
| `AUTO-EXPORT.bat` / `auto-export-hidden.vbs` | Bọc `auto-export-sync.js` (bản `.vbs` chạy ẩn cho Task Scheduler). Log `auto-export.log`. |
| `sync-board-to-sheet.js` + `DONG-BO-TASK.bat` | **Dự phòng thủ công**: đọc file `Board-*-591-*.xlsx` mới nhất trong Downloads (khi bạn tự bấm Export). Có `.last-sync.json` bỏ qua nếu file không đổi. |
| `sync-tasks-to-sheet.js` | Bản kéo qua API `detail-workflow-task` — **không dùng** (API board thiếu trường 5S, giữ tham khảo). |
| `dashboard-5s.html` | Trang xem task: đọc `5S-TASKS` qua **gviz JSONP**, lọc ngày/status/lỗi/tìm kiếm; bấm ảnh/clip → **lightbox phóng to ngay trong trang** (Esc/nền để đóng); nhấp 1 dòng xem chi tiết. |
| `kiemsoatkho/index.html` | **[MỚI] Dashboard WEB cao cấp** (thuần CSS variables, bỏ Tailwind CDN → load tức thì). **URL rút gọn: https://letam0317.github.io/kiemsoatkho/** (repo RIÊNG `kiemsoatkho`). Gồm: **2 tab (5S / Kiểm kê)**, modal chi tiết dạng **stepper NGANG** theo bước B1→B5, **lightbox carousel** (nút Trước/Sau khi bước ≥2 ảnh), **4 theme VS Code** (VS Dark/Light, High Contrast, One Dark Pro), **bỏ toàn bộ icon**, skeleton + fade-in, tự làm mới 5'. |

> **Deploy dashboard web (2 nơi):**
> 1. **CHÍNH — repo riêng `letam0317/kiemsoatkho`** (link gọn `letam0317.github.io/kiemsoatkho`): tạo repo + đẩy file + bật Pages qua **GitHub REST API** (token lấy từ Windows credential manager, scope `repo`). Cập nhật: `PUT /repos/letam0317/kiemsoatkho/contents/index.html` (base64). Xem `scratchpad/gh-deploy.mjs`.
> 2. **Cũ (redundant)** `letam0317.github.io/th76tamle/kiemsoatkho`: nhánh `main` repo `th76tamle` (=GitHub Pages front-end). Đẩy: worktree/commit trên `deploy-slf` (bám `origin/main`) rồi `git push origin deploy-slf:main`.
>
> ⚠️ Cảnh báo "không push th76tamle" ở mục 7 chỉ áp cho **nhánh tooling** (script/.env), KHÔNG áp cho nhánh `main` (front-end công khai). Dashboard chỉ chứa SHEET_ID + APPSCRIPT_URL vốn đã công khai — không lộ bí mật.
> **Lưu ý:** "th76tamle" KHÔNG xuất hiện trong mã nguồn dashboard; nó chỉ là tên repo → nằm trong URL. Rút gọn link = dùng repo riêng, không phải sửa chuỗi trong code.

**Quy trình TỰ ĐỘNG (không cần thao tác):** lịch **`5S Dong bo dashboard`** chạy ngầm mỗi 60' →
`auto-export-sync.js` tự xuất qua API, tải file, đẩy lên `5S-TASKS` → dashboard luôn cập nhật.

> 🔑 **Chốt reverse-engineering:** file Export tải công khai tại `wshr.hasaki.vn/production/hr/<file_path>`
> (KHÔNG phải `hr-media` — chỗ đó 403). Job xuất async: `POST /api/hr/excel-io/export` (multipart:
> `param[from_date]/[to_date]/[search_type]=board/[wfid]`, `type=6`; **tối đa 3 tháng/lần**) →
> `GET /api/hr/excel-io` trả `rows[].{status,file_path,param,log}` (`status=1` = xong).

### ⚡ Đồng bộ TĂNG DẦN — giảm tải WMS (tối ưu 2026-07-09)

> **Vấn đề cũ:** mỗi ngày re-export TOÀN BỘ từ `2026-04-01` → tải WMS phẳng & tăng dần, dù task đã xong không bao giờ đổi nữa.

- **Kho bền vững cục bộ:** `.exports/tasks-cache.json` = `{header, complete, rows:{TaskCode:[...]}}` (lưu dòng đã đổi path ảnh; KHÔNG chạy convMedia lại lên dòng cache).
- **Task "terminal" đóng băng:** trạng thái chính (cột `Status`, index 3) ∈ `Finished/Canceled/Failed` → không export lại. Task **còn sống** (`Processing/None`) LUÔN refresh mỗi ngày.
- **Cửa sổ động:** `from = min(hôm nay−45 ngày, ngày Created At sớm nhất của task còn sống)` → hôm nay. Task chưa xong (dù cũ) vẫn được cập nhật; 45 ngày an toàn để bắt task mới / task bị **mở lại**.
- **Gộp & ghi:** frozen cache + fresh window → upsert theo Task Code → vẫn ghi ĐÈ toàn bộ tab `5S-TASKS` (Apps Script `syncTasks` **KHÔNG đổi**).
- **Bền lỗi (chống mất dữ liệu):** LUÔN seed từ cache trước khi export → cửa sổ nào export lỗi vẫn giữ dữ liệu cũ. FULL mà còn cửa sổ lỗi → `complete:false` → lần sau tự dựng lại full.
- **Chạy tay:** `FULL_RESYNC=1 node auto-export-sync.js` dựng lại toàn bộ; biến `ROLL_DAYS` đổi cửa sổ an toàn (mặc định 45).
- **Kiểm chứng 2026-07-09:** 261 task = **239 terminal đóng băng + 22 còn sống**; incremental chỉ export **1 cửa sổ từ 25/05** thay vì 2 cửa sổ từ 01/04.

---

## 5. Cấu hình `.env` (đã gitignore)

> ⚠️ Giá trị thật của các khoá KHÔNG ghi trong tài liệu — chỉ nằm trong `.env` (đã gitignore).

```
APPSCRIPT_KEY=<bí mật — xem .env>        # PHẢI trùng biến SECRET trong Apps Script
APPSCRIPT_URL=<URL /exec — xem .env>
WORKFLOW_ID=591
STAFF_ID=17312

# Đăng nhập work.hasaki.vn (login-hasaki.js tự điền; chỉ gõ OTP 6 số)
HASAKI_EMAIL=<bí mật — xem .env>         # email SSO Hasaki
HASAKI_PASSWORD=<bí mật — xem .env>      # đổi mật khẩu công ty thì chỉ sửa dòng này

# (tuỳ chọn)
# EDGE_PROFILE_DIR=C:/Users/lechitam/New folder/baocao5s/.wms-session/edge-profile
# DOWNLOADS_DIR=C:/Users/lechitam/Downloads
```

---

## 6. Vận hành — các lịch Windows Scheduled Task

| Tên task | Chu kỳ | Gọi | Việc |
|---|---|---|---|
| `Day bao cao 5S` | mỗi 15 phút | `DAY-BAO-CAO-5S.bat` (qua wscript ẩn) | Đẩy báo cáo mới → tạo task (Module C) |
| `5S Canh yeu cau dang nhap` | mỗi 2 phút | `watch-login-hidden.vbs` | Canh cờ đăng nhập → mở login khi được yêu cầu (Module D) |
| `5S Dong bo dashboard` | **7h sáng hằng ngày** | `auto-export-hidden.vbs` | **TỰ ĐỘNG 100%**: tự xuất qua API → tải file → đẩy `5S-TASKS` (Module E) |

Ngoài lịch 7h, người dùng bấm **"⟳ Cập nhật ngay"** trên dashboard (nhập **PIN**) → cờ `SYNC_REQUESTED` →
bộ canh (mỗi 2') chạy `auto-export-sync.js` → dashboard tự làm mới sau ~2–3 phút. `auto-export-sync.js`
có khoá `.export-running.lock` chống chạy chồng (7h + nút bấm).

**Tất cả lịch chạy NGẦM (wscript + Hidden), không hiện cửa sổ, không cướp con trỏ chuột.**

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
