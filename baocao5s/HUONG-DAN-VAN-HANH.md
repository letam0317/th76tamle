# 🚀 HƯỚNG DẪN VẬN HÀNH THỰC TẾ — Checklist & Troubleshooting

---

## ✅ SETUP LẦN ĐẦU

### **Bước 1: Chuẩn bị môi trường**

```bash
# 1.1 Clone repo (hoặc tải về)
git clone <repo> baocao5s
cd baocao5s

# 1.2 Copy .env.example → .env
node -e "import('node:fs').then(fs=>{
  if(!fs.existsSync('.env')){
    fs.copyFileSync('.env.example','.env');
    console.log('✅ Tạo .env từ .env.example');
  }
})"

# 1.3 Cài đặt dependencies
npm install

# 1.4 Kiểm tra Node version
node --version    # phải ≥18
```

### **Bước 2: Điền .env (Bí mật)**

```env
# .env (KHÔNG commit — đã trong .gitignore)

# Apps Script URL & Key
APPSCRIPT_URL=https://script.google.com/macros/s/AKfycbz...
APPSCRIPT_KEY=SECRET_XYZ_PHẢI_TRÙNG_google-script.gs

# Tài khoản work.hasaki.vn (SSO)
HASAKI_EMAIL=your-email@example.com
HASAKI_PASSWORD=your_actual_password_here
HASAKI_2FA_SECRET=JBSWY3DP57...    # Base32 (TOTP 2FA)

# Workflow ID
WORKFLOW_ID=591
STAFF_ID=17312              # Mặc định giao cho ai (Lê Chí Tâm)

# Đường dẫn Edge (Windows)
EDGE_PROFILE_DIR=C:/Users/lechitam/New folder/baocao5s/.wms-session/edge-profile

# Mốc đồng bộ
SYNC_FROM=2026-04-01

# PIN bảo vệ "Cập nhật ngay" trên dashboard
SYNC_PIN=1234

# (Optional) Email cảnh báo — mặc định: th76tamle02@gmail.com
# ALERT_EMAIL=admin@example.com
```

### **Bước 3: Deploy Google Apps Script**

```
1️⃣ Mở Google Sheet (WMS-5S-AUDIT)
   └─ Tiện ích mở rộng → Apps Script

2️⃣ Mở file google-script-DEPLOY.gs (ngoài workspace)
   ├─ Copy hết nội dung
   └─ (Chưa commit — có SECRET thật)

3️⃣ Dán vào Apps Script editor
   ├─ Xoá hết code cũ
   ├─ Paste google-script-DEPLOY.gs
   ├─ Bấm Lưu
   └─ (Lần đầu Edge sẽ cảnh báo: quyền Sheets, Drive, Gmail)

4️⃣ Test gửi email (lần đầu cấp quyền)
   ├─ Run hàm: testGuiMail()
   ├─ Approve quyền (popup)
   ├─ Kiểm tra email test (ALERT_EMAIL)
   └─ Nếu không có → check spam

5️⃣ Deploy (tạo version mới)
   ├─ Triển khai → Quản lý bản triển khai
   ├─ ✎ Edit version cũ → New version
   ├─ Triển khai
   └─ URL /exec giữ nguyên (APPSCRIPT_URL)

💡 Lưu ý: Mỗi lần sửa google-script.gs phải:
   - Copy → Paste đè google-script-DEPLOY.gs
   - Deploy → New version → Triển khai
```

### **Bước 4: Cấu hình Task Scheduler (Windows)**

#### **Task 1: Bộ đẩy (14:45 hàng ngày)**
```
Tên: DAY-BAO-CAO-5S
Lịch: Hàng ngày 14:45
Script: C:\path\to\DAY-BAO-CAO-5S.bat
```

**Nội dung DAY-BAO-CAO-5S.bat:**
```batch
@echo off
cd /d "C:\Users\lechitam\New folder\baocao5s"
node push-5s-to-workflow.js >> day-bao-cao-5s.log 2>&1
exit /b 0
```

#### **Task 2: Canh phiên (mỗi 2 phút)**
```
Tên: DONG-BO-TASK-CANH
Lịch: Mỗi 2 phút (từ 06:00 đến 18:00)
Script: C:\path\to\DONG-BO-TASK-AN.vbs
```

**Nội dung DONG-BO-TASK-AN.vbs:**
```vbscript
' Chạy ngầm (không hiện cửa sổ)
Set objShell = CreateObject("WScript.Shell")
objShell.Run """C:\Program Files\nodejs\node.exe"" watch-login-request.js", 0
```

#### **Task 3: Auto-export (7h sáng)**
```
Tên: DONG-BO-TASK-AUTO-EXPORT
Lịch: Hàng ngày 07:00
Script: C:\path\to\DONG-BO-TASK.bat
```

**Nội dung DONG-BO-TASK.bat:**
```batch
@echo off
cd /d "C:\Users\lechitam\New folder\baocao5s"
node auto-export-sync.js >> dong-bo-task.log 2>&1
exit /b 0
```

### **Bước 5: Test lần đầu**

```bash
# Test 1: Đăng nhập tự động
node login-hasaki.js --auto
# ✅ Kỳ vọng: Cửa sổ Edge mở → tự điền → tự OTP → Mint token
# ✅ Exit code: 0

# Test 2: Tạo task (chỉ 1 lần)
node push-5s-to-workflow.js
# ✅ Kỳ vọng: Lấy token ✅ → lấy pending ✅ → tạo task ✅ → mark ✅
# ✅ Log: "Hàng X: HSK-XXXXX (N ảnh, TYPE00=[...])"

# Test 3: Auto-export
node auto-export-sync.js
# ✅ Kỳ vọng: Lấy token ✅ → queue job ✅ → poll ✅ → tải ✅ → ghi Sheet ✅
# ✅ Log: "Đã ghi 100+ task vào tab 5S-TASKS"

# Test 4: Dashboard
# Mở dashboard-5s.html (hoặc URL deploy)
# ✅ Kỳ vọng: Hiển thị dữ liệu từ Sheet, có bộ lọc, có nút "Cập nhật ngay"
```

### **Bước 6: Kiểm tra cài đặt cuối cùng**

```
✅ Checklist:
□ .env đầy đủ (APPSCRIPT_KEY, HASAKI_EMAIL, SECRET, SYNC_PIN)
□ google-script-DEPLOY.gs deployed (URL /exec cố định)
□ Profile Edge tồn tại + đã đăng nhập 1 lần (manual)
□ Task Scheduler: 3 task (14:45, 2', 7h)
□ npm dependencies cài (node_modules/)
□ Form 5S deploy (GitHub Pages hoặc tự host)
□ Dashboard deploy (GitHub Pages hoặc tự host)
□ Test toàn flow 1 lần: form → task → dashboard
□ .gitignore có: .env, google-script-DEPLOY.gs, .wms-session, node_modules
```

---

## 🚨 TROUBLESHOOTING

### **Vấn đề 1: APPSCRIPT_KEY không được chấp nhận**

**Triệu chứng:**
```
✗ Apps Script error: {"status":"error","message":"Key không hợp lệ"}
```

**Nguyên nhân & Giải pháp:**
```
1️⃣ Kiểm tra SECRET trong google-script-DEPLOY.gs
   ├─ Tìm: const SECRET = "...";
   ├─ Copy giá trị đó
   └─ Paste vào .env → APPSCRIPT_KEY

2️⃣ Kiểm tra .env không có khoảng trắng thừa
   ├─ Sai:  APPSCRIPT_KEY = "SECRET123"  (có space)
   ├─ Đúng: APPSCRIPT_KEY=SECRET123      (không space)

3️⃣ Redeploy google-script-DEPLOY.gs
   ├─ Sheet → Tiện ích mở rộng → Apps Script
   ├─ Dán đè lại google-script-DEPLOY.gs
   ├─ Lưu → Deploy → New version
   └─ Thử lại
```

### **Vấn đề 2: Login fail (OTP sai hoặc TOTP lỗi)**

**Triệu chứng:**
```
✗ OTP: "OTP không hợp lệ" hoặc timeout
```

**Nguyên nhân & Giải pháp:**
```
1️⃣ Kiểm tra HASAKI_2FA_SECRET
   ├─ Phải là base32 (JBSWY3DP57...)
   ├─ KHÔNG có khoảng trắng
   ├─ Test: node -e "
     const {TOTP,Secret} = require('otpauth');
     const s = 'JBSWY3DP57...'; // paste secret
     const t = new TOTP({secret:Secret.fromBase32(s),digits:6,period:30});
     console.log('OTP:', t.generate());
   "

2️⃣ Kiểm tra đồng hồ máy tính
   ├─ OTP phụ thuộc thời gian ±30s
   ├─ time /t  (Windows)
   ├─ Nếu sai → Setting → Time & language → Set time

3️⃣ Thử login tay OTP trước
   ├─ node login-hasaki.js  (không --auto)
   ├─ Bạn gõ OTP tay từ Google Authenticator
   ├─ Nếu OK → SECRET chính xác
   ├─ Nếu fail → cập nhật SECRET

4️⃣ Nếu vẫn fail → bypass auto, login tay
   ├─ Xóa HASAKI_2FA_SECRET từ .env
   ├─ Chạy: node login-hasaki.js
   ├─ Bạn gõ OTP tay mỗi lần
   └─ (Chậm hơn nhưng chắc chắn)
```

### **Vấn đề 3: Bộ đẩy báo "Phiên hết hạn"**

**Triệu chứng:**
```
✗ getToken(): Phiên đăng nhập work.hasaki.vn đã hết hạn
```

**Nguyên nhân & Giải pháp:**
```
1️⃣ Token 48h đã hết hiệu lực
   ├─ Auto login sẽ chạy tự động (nếu watch-login-request active)
   ├─ Hoặc bấm nút ✅ trong email cảnh báo

2️⃣ Nếu auto login không chạy:
   ├─ Chạy tay: node login-hasaki.js --auto
   ├─ Hoặc: LOGIN-HASAKI.bat (tay OTP)

3️⃣ Kiểm tra Task Scheduler watch-login-request
   ├─ Task Scheduler → Tác vụ của tôi
   ├─ DONG-BO-TASK-CANH → chạy tay (right-click → Run)
   ├─ Kiểm tra log: watch-login.log
   └─ Nếu lỗi → fix error

4️⃣ Redeploy Apps Script (nếu token logout bất thường)
   ├─ Có thể do backend lỗi
   ├─ Copy lại google-script-DEPLOY.gs → Deploy
```

### **Vấn đề 4: Dashboard không hiển thị dữ liệu**

**Triệu chứ:**
```
❌ Dashboard trắng hoặc hiện "Đang tải..." mãi
```

**Nguyên nhân & Giải pháp:**
```
1️⃣ Sheet 5S-TASKS trống
   ├─ Chạy auto-export: node auto-export-sync.js
   ├─ Hoặc bấm "Cập nhật ngay" + PIN trên dashboard

2️⃣ JSONP query Sheet fail (CORS)
   ├─ Mở Dev tools → Console (F12)
   ├─ Kiểm tra error message
   ├─ Nếu 404 → Sheet ID hoặc TAB name sai
   │  └─ Mở dashboard-5s.html → edit:
   │     const SHEET_ID = "1FWffWi75aATbokfqIcqjByEPzkJLQBngTXp5aPOIbLM";
   │     const TAB = "5S-TASKS";

3️⃣ Sheet công khai không đủ
   ├─ Sheet → Chia sẻ → "Bất kỳ ai có liên kết"
   ├─ Quyền: Editor (hoặc Viewer nếu chỉ xem)

4️⃣ Tắt cache trình duyệt
   ├─ Ctrl+Shift+Delete → Clear cache
   ├─ F5 refresh
```

### **Vấn đề 5: Tạo task fail (API 500 hoặc timeout)**

**Triệu chứ:**
```
❌ Task create error / API 500
```

**Nguyên nhân & Giải pháp:**
```
1️⃣ Token không hợp lệ
   ├─ Hết phiên → login lại (xem vấn đề 3)

2️⃣ WORKFLOW_ID sai
   ├─ Workflow URL: work.hasaki.vn/tasks-workflow?wfid=591
   ├─ Kiểm tra 591 = WORKFLOW_ID trong .env
   ├─ Hoặc thay bằng workflow ID chính xác

3️⃣ TYPE00 không khớp
   ├─ Form báo: "Sắp xếp lỏng"
   ├─ Workflow TYPE00 không có option này
   ├─ Log: "❌ Khớp TYPE00 fail: Sắp xếp lỏng"
   ├─ Giải pháp:
   │  ├─ Thêm option "Sắp xếp lỏng" vào workflow TYPE00
   │  ├─ Hoặc cập nhật hạng mục trong form để khớp
   │  └─ Hoặc tăng MATCH_THRESHOLD (nhưng rủi ro)

4️⃣ STAFF_ID không tồn tại
   ├─ workflow config → check staff list
   ├─ Thay STAFF_ID = staff ID chính xác

5️⃣ Timeout (quá lâu)
   ├─ Workflow server chậm
   ├─ Retry sau (bộ đẩy sẽ chạy lại)
   ├─ Hoặc chạy manual: node push-5s-to-workflow.js
```

### **Vấn đề 6: Auto-export timeout (>180s)**

**Triệu chứ:**
```
❌ Quá thời gian chờ job (Excel export)
```

**Nguyên nhân & Giải pháp:**
```
1️⃣ Workflow data quá lớn
   ├─ Export 3 tháng dữ liệu → chậm
   ├─ Cung cấp dung lượng tùy theo từng query

2️⃣ Workflow server bận
   ├─ Chạy lại: node auto-export-sync.js
   ├─ Hoặc chờ server rảnh (tránh giờ cao điểm)

3️⃣ Giảm phạm vi SYNC_FROM
   ├─ .env: SYNC_FROM=2026-06-01  (gần hôm nay)
   ├─ Thay vì 2026-04-01 (cách 3 tháng)
   └─ Export sẽ nhanh hơn

4️⃣ Kiểm tra log
   ├─ dong-bo-task.log
   ├─ Tìm: "status=0" (still processing)
   ├─ Nếu lâu → kiểm tra server workflow
```

### **Vấn đề 7: File lock dính (chạy không được)**

**Triệu chứ:**
```
❌ "Đang có phiên khác chạy" (bỏ qua)
```

**Nguyên nhân & Giải pháp:**
```
1️⃣ File .login-open.lock tồn tại
   ├─ Lỗi: login-hasaki.js chạy lâu hoặc crash
   ├─ Xoá: rm .wms-session/.login-open.lock
   ├─ Hoặc: del .wms-session\.login-open.lock (Windows)

2️⃣ File .export-running.lock tồn tại
   ├─ Lỗi: auto-export-sync.js crash
   ├─ Xoá: rm .exports/.export-running.lock

3️⃣ Process chạy nền vẫn sống
   ├─ Task Manager → tìm node.exe
   ├─ Kill process → retry
```

### **Vấn đề 8: Email cảnh báo không tới**

**Triệu chứ:**
```
❌ Email không nhận được
```

**Nguyên nhân & Giải pháp:**
```
1️⃣ ALERT_EMAIL sai
   ├─ .env: ALERT_EMAIL=admin@example.com
   ├─ Kiểm tra email đúng
   ├─ Redeploy google-script-DEPLOY.gs

2️⃣ Gmail security
   ├─ Google Apps Script → Allow less secure
   ├─ Hoặc tạo App Password
   ├─ Settings → Security → App passwords

3️⃣ Email trong spam
   ├─ Kiểm tra Spam folder
   ├─ Add to contacts (lần đầu)

4️⃣ Test gửi email
   ├─ Apps Script → Run testGuiMail()
   ├─ Kiểm tra email test tới ALERT_EMAIL
   ├─ Nếu OK → backend ổn, vấn đề là throttle
   │  └─ Email chỉ gửi 1x/session (chống spam)
```

### **Vấn đề 9: Khớp hạng mục sai (TYPE00 mismatch)**

**Triệu chứ:**
```
❌ Log: "Khớp TYPE00 fail"
Hoặc: Task tạo với TYPE00 sai
```

**Nguyên nhân & Giải pháp:**
```
1️⃣ Kiểm tra hạng mục form
   ├─ Form 5S có 31 mục chuẩn
   ├─ Nhân viên chọn những gì?
   └─ Log: "hangMuc: [...]"

2️⃣ Kiểm tra TYPE00 workflow
   ├─ Workflow 591 → TYPE00 options
   ├─ Liệt kê toàn bộ
   ├─ So sánh với hạng mục form

3️⃣ Test khớp logic (Dice similarity)
   ├─ run push-5s-to-workflow.js --debug  (nếu có flag)
   ├─ Hoặc test hàm dice() tay:
   │  const dice = (a, b) => {
   │    const A = new Set(a.toLowerCase().split(" "));
   │    const B = new Set(b.toLowerCase().split(" "));
   │    if (!A.size || !B.size) return 0;
   │    let inter = 0;
   │    for (const w of A) if (B.has(w)) inter++;
   │    return (2 * inter) / (A.size + B.size);
   │  };
   │  console.log(dice("Sắp xếp", "Sắp xếp")); // 1.0 (khớp tuyệt)
   │  console.log(dice("Thiếu label", "Thiếu nhãn")); // 0.67

4️⃣ Tăng ngưỡng khớp hoặc giảm
   ├─ push-5s-to-workflow.js:
   │  const MATCH_THRESHOLD = 0.55;  // Điều chỉnh nếu cần
   │  (0.0-1.0, càng cao càng khắt khe)

5️⃣ Cập nhật danh sách TYPE00 trong workflow
   ├─ Thêm option không có (VD: "Sắp xếp lỏng")
   ├─ Redeploy workflow (nếu có quyền)
```

### **Vấn đề 10: Bộ đẩy chạy nhưng task không tạo được**

**Triệu chứ:**
```
✅ Log: "Lấy pending OK, tạo task..."
❌ Nhưng cột 6 Sheet vẫn trống (chưa ghi mã task)
```

**Nguyên nhân & Giải pháp:**
```
1️⃣ pending rows trống
   ├─ Không có báo cáo chưa đẩy
   ├─ Kiểm tra Sheet WMS-5S-AUDIT
   ├─ Cột 6 (Mã task) có giá trị → đã ghi → không pending

2️⃣ Hạng mục không khớp TYPE00
   ├─ Báo cáo: hangMuc = ["Sắp xếp lỏng", ...]
   ├─ Workflow TYPE00 không có "Sắp xếp lỏng"
   ├─ Log: "❌ Khớp TYPE00 fail → bỏ qua hàng"
   ├─ Giải pháp: xem vấn đề 9

3️⃣ Ảnh base64 corrupt
   ├─ Form gửi ảnh sai format
   ├─ createTask() fail khi build FormData
   ├─ Log: "❌ Ảnh corrupt → bỏ qua"

4️⃣ API fail nhưng không báo
   ├─ POST /api/hr/projects/create-task-workflow
   ├─ Response: HTTP 200 nhưng JSON error
   ├─ Log: bây giờ có, kiểm tra chi tiết

5️⃣ Mark fail (ghi mã task fail)
   ├─ Task tạo ✅ nhưng ghi mã fail
   ├─ GET ?action=mark&row=N&code=...
   ├─ Apps Script lỗi
   ├─ Thử chạy lại: node push-5s-to-workflow.js
   └─ Pending sẽ retry
```

---

## 📝 Tệp Log & Giải Thích

### **day-bao-cao-5s.log** (Bộ đẩy)
```
2026-07-05 14:45:12 ✓ Lấy token từ Edge: Bearer eyJhbGc...
2026-07-05 14:45:18 ✓ Pending rows: 1 (hàng 1001)
2026-07-05 14:45:20 ✓ Khớp TYPE00: Sắp xếp ✅
2026-07-05 14:45:25 ✓ Tạo task #1: POST /api/hr/projects/...
2026-07-05 14:45:30 ✓ Task code: HSK-00042
2026-07-05 14:45:32 ✓ Ghi mã: GET ?action=mark&row=1001&code=HSK-00042
2026-07-05 14:45:35 ✅ Hàng 1001: HSK-00042 (1 ảnh, TYPE00=Sắp xếp)
```

### **dong-bo-task.log** (Auto-export)
```
2026-07-06 07:00:05 ✓ Lấy token: Bearer eyJhbGc...
2026-07-06 07:00:10 ✓ Cửa sổ 1: 2026-04-01..2026-05-30
2026-07-06 07:00:12 ✓ Queue job: from=2026-04-01, to=2026-05-30
2026-07-06 07:01:00 ✓ Poll status: status=1, file_path=/hr-export/...xlsx
2026-07-06 07:01:05 ✓ Tải file: 4.2 MB
2026-07-06 07:01:30 ✓ Parse: 100 row
2026-07-06 07:01:45 ✓ Cửa sổ 2: 2026-05-31..2026-07-07 (42 row)
2026-07-06 07:02:00 ✓ Gộp: 142 row tổng
2026-07-06 07:02:10 ✓ POST syncTasks: đã ghi tab 5S-TASKS
2026-07-06 07:02:15 ✅ Đã cập nhật dashboard (142 task)
```

### **watch-login.log** (Canh phiên)
```
2026-07-05 14:30:00 Canh phiên...
2026-07-05 14:30:05 ✓ syncStatus: requested=false
2026-07-05 14:30:10 ✓ loginStatus: requested=false
2026-07-05 14:30:15 ℹ️  Không có yêu cầu. Exit 0.
...
2026-07-06 08:00:00 Canh phiên...
2026-07-06 08:00:05 ✓ syncStatus: requested=true ⚡
2026-07-06 08:00:10 ✓ Clear sync flag
2026-07-06 08:00:12 ✓ Chạy auto-export-sync.js...
2026-07-06 08:01:30 ✅ Auto-export xong.
```

---

## 🔄 Quy trình Daily

### **Hàng ngày**

```
06:00 - 18:00 | watch-login-request.js canh mỗi 2 phút
              ├─ Hỏi cờ đăng nhập
              ├─ Hỏi cờ cập nhật dashboard
              └─ Tự động trigger nếu có yêu cầu

07:00 | auto-export-sync.js chạy tự động
      ├─ Export từ workflow
      ├─ Ghi tab 5S-TASKS
      └─ Dashboard cập nhật

14:45 | push-5s-to-workflow.js chạy tự động
      ├─ Lấy báo cáo chưa đẩy
      ├─ Tạo task
      └─ Ghi mã task vào Sheet

Bất cứ lúc nào:
  • Nhân viên ghi form → POST tới Apps Script
  • Quản lý bấm "Cập nhật ngay" dashboard → Trigger export
  • Phiên hết → Email cảnh báo → Bấm nút ✅ → Auto login
```

### **Hàng tuần**

```
Thứ 2 (7:00 sáng):
  ├─ Kiểm tra log toàn tuần
  ├─ Đếm số task tạo
  ├─ Đếm số task hoàn thành
  └─ Email báo cáo tóm tắt (optional)
```

### **Hàng tháng**

```
1-3 của tháng:
  ├─ Kiểm tra Google Sheet dung lượng
  ├─ Xoá ảnh cũ (nếu cần)
  ├─ Backup Sheet (xuất CSV)
  └─ Cập nhật dashboard thiết kế nếu cần
```

---

## 🔒 Bảo mật & Best Practice

```
✅ SHOULD DO:
  □ Giữ .env bí mật (gitignore)
  □ Giữ google-script-DEPLOY.gs bí mật (có SECRET)
  □ Định kỳ xem log (hàng tuần)
  □ Backup Sheet (hàng tháng)
  □ Cập nhật Node.js (security patch)
  □ Rotate SYNC_PIN (nếu quá dễ)
  □ Monitor OAuth token (48h)

❌ SHOULD NOT DO:
  □ Commit .env vào git
  □ Hardcode secret trong code
  □ Để cứ chuyển mật khẩu qua email
  □ Sử dụng profile Edge shared (người dùng khác)
  □ Disable 2FA trên account work.hasaki.vn
  □ Để máy unlock (tự động login quá dễ → rủi ro)
```

---

## 📞 Hỗ trợ & Escalation

| Vấn đề | Support Tier | Hành động |
|--------|-------------|----------|
| Dashboard không cập nhật | Tier 1 (Self) | Bấm "Cập nhật ngay" |
| Token hết 48h | Tier 1 (Self) | Bấm nút ✅ trong email |
| Login fail OTP | Tier 2 (Admin) | Kiểm tra TOTP secret + đồng hồ |
| Workflow API down | Tier 3 (Hasaki) | Contact support Hasaki |
| Sheet quota | Tier 3 (Hasaki) | Request upgrade hoặc archive |
| Performance chậm | Tier 2 (Admin) | Kiểm tra export window, network |

---

**Ghi chú:** Document này sẽ cập nhật khi phát hiện issue mới.  
**Liên hệ:** Lê Chí Tâm (lechi.tam@example.com)

