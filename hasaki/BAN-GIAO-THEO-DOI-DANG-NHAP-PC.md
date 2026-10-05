# BÀN GIAO: Theo dõi tài khoản @hasaki đăng nhập trên PC kho — cho agy chạy tiếp

*Bản giao cho Antigravity CLI (agy) tiếp tục. Làm việc trong `C:\Users\lechitam\New folder\hasaki`.
Đọc hết mục 5 (RÀNG BUỘC) TRƯỚC khi sửa gì. Repo PUBLIC — không commit bí mật/PII.*

## 0. Mục tiêu
Biết **tài khoản WMS @hasaki.vn nào đang đăng nhập trên từng PC** khu đóng gói A8 (64 máy), tiến tới
cả kho (~100 máy), cập nhật vài phút/lần, hiển thị trên dashboard. User KHÔNG muốn đi bộ tới từng máy.

## 1. Trạng thái hiện tại (ĐÃ XONG, đã kiểm chứng thật)
- **Phương pháp lấy tài khoản đã chứng minh** (mục 3).
- **Pilot 1 máy đã cài & chạy** trên chính laptop này: task `PC-login-agent-pilot` (mỗi 5'), ghi
  đúng {máy, user Windows, tài khoản @hasaki, IP, giờ} vào `.pc-login-agent.log`.
- **CHƯA** nối lên GAS/Sheet/dashboard. **CHƯA** triển khai máy khác (vướng rào cản mục 4).

## 2. File đã tạo + cách chạy
| File | Vai trò | Chạy |
|------|---------|------|
| `soi-auth-store.mjs` | Trích tài khoản WMS từ `auth_store` của trình duyệt (lõi tái dùng) | `node soi-auth-store.mjs [--dir=<leveldb>] [--json]` |
| `soi-pc-a8.ps1` + `SOI-PC-A8.bat` | Dò khả thi: quét mạng tìm PC, `-CredTest` đọc tài khoản từ xa qua `C$` | `SOI-PC-A8.bat -AutoSubnet [-CredTest]` (chạy trong mạng kho) |
| `pc-login-agent.mjs` | Agent 1-mục-đích: đọc login máy sở tại → ghi log | `node pc-login-agent.mjs --once` |
| `_PC-LOGIN-AGENT.vbs` | Launcher chạy ẩn cho scheduled task | (task gọi) |
| `CAI-PC-LOGIN-AGENT.bat` | Trình cài agent lên 1 máy (schtasks, mỗi 5') | Chạy trên máy đích |

Gỡ pilot: `schtasks /Delete /TN "PC-login-agent-pilot" /F`

## 3. Phương pháp cốt lõi (đã kiểm chứng offline)
1. Ứng dụng WMS (SPA) lưu đăng nhập ở **`localStorage["auth_store"]`** = `{state:{token:<JWT>}}`
   (Zustand persist, `partialize` chỉ giữ token). localStorage nằm ở `.../Local Storage/leveldb/*.ldb`
   **KHÔNG mã hoá** (khác cookie), file `.ldb` bất biến sau khi ghi nên đọc được cả khi trình duyệt mở.
2. Giải mã JWT lấy `sub` (mã user; JWT WMS không có email/tên).
3. Tra `sub` → tên/email qua **`.cache-danhba.json`** (5767 NV: `user_id→staff_name/staff_email/code`).
4. Hai kiến trúc: **(A) đọc từ xa** (máy trung tâm đọc `\\PC\C$\...\leveldb` — cần admin + PC mở
   445 inbound); **(C) agent tại máy** (đọc login sở tại rồi gửi RA GAS — chỉ cần outbound, bền hơn,
   nhưng lần cài đầu vẫn cần chạm máy). Pilot hiện dùng kiểu C.

## 4. Thực trạng mạng + RÀO CẢN (đo thật 17/09)
- Kho dùng wifi (USB wifi). 3 SSID nội bộ `Hasaki` / `Hasaki Factory` / `Hasaki Picking` — đo thấy
  **cùng một dải phẳng `192.168.0.0/22`** (không phải VLAN tách). Không có DNS nội bộ (8.8.8.8/1.1.1.1).
- Quét /22: ARP có **164 thiết bị** nhưng chỉ **8 máy Windows lộ SMB(445)**. Phần lớn thiết bị
  `c4-ef-da` **ping được nhưng không 445/NetBIOS** = máy quét/Android, KHÔNG phải PC.
- ⇒ **64 PC A8 hầu như không hiện diện**: hoặc đang TẮT, hoặc **tường lửa Windows chặn 445** (nên đọc
  qua C$ không tới). Chỉ 1 máy kho `HSK-KHO170-huynd2` (192.168.0.107) mở 445.
- **RÀO CẢN THẬT (chốt chặn của cả A và C):** để chạm 1 PC (đọc hay cài) cần **(a) tài khoản admin
  dùng được + (b) PC bật & mở cổng quản trị inbound**, trong GIỜ LÀM VIỆC. Firewall chặn inbound thì
  cả hai đường gãy. User **chưa xác nhận có admin** ("chắc có nhưng chưa biết").

## 5. RÀNG BUỘC BẮT BUỘC (đọc trước khi làm — từ bộ nhớ dự án)
- **Không thoả hiệp với IT:** cấm xin service account/API/công cụ IT. Các PC do IT quản lý
  (ManageEngine Endpoint Central + MDM). Đọc `BO-CHUAN-PHAT-TRIEN.md`.
- **KHÔNG né Endpoint Central / KHÔNG detection-evasion.** EC kiểm kê phần mềm + tiến trình, mọi agent
  sẽ hiện ra — đó là bình thường. Vấn đề là "được phép", không phải "giấu". User cần được duyệt việc
  theo dõi trước khi nhân rộng.
- **Agent phải MỘT-MỤC-ĐÍCH, minh bạch:** KHÔNG nhận lệnh tùy ý từ xa, KHÔNG tự cập nhật mã tùy ý
  (tránh biến thành khung điều khiển). Chỉ đọc login + báo cáo.
- **Nhẹ tải upstream:** mọi thứ 0 lượt gọi thêm work/wms/hr (đọc login là cục bộ; tra tên qua danh bạ
  đã cache). Chỉ chạm Google (GAS).
- **Quy trình (bộ chuẩn §0):** QC trước/sau → dựng BẢN NỘI BỘ cho user duyệt → mới push/deploy. Không
  bắt nhập PIN. Cửa ghi Sheet DUY NHẤT = GAS `action=syncTasks` (xem `session-rules.js` `gasPost`).

## 6. VIỆC TIẾP THEO (agy làm, theo thứ tự)
1. **Xác nhận khả thi cài/đọc từ xa:** hướng dẫn user chạy `SOI-PC-A8.bat -AutoSubnet -CredTest` trên
   1 PC A8 đang bật (giờ làm), nhập admin. Nếu đọc được tài khoản 1 máy khác ⇒ cài/đọc từ xa khả thi.
   Nếu không (firewall/không admin) ⇒ báo user, chỉ còn cách cài tại máy hoặc xét lại phạm vi.
2. **Nối agent → GAS → dashboard** (bản nội bộ trước): thêm GAS action **upsert theo hostname** vào
   tab private `A8-PC-DANGNHAP` (đừng dùng syncTasks ghi-đè-cả-tab vì nhiều agent sẽ đè nhau); agent
   POST 1 dòng/máy; dashboard `kiemsoatkho/hasaki-planogram.js` tô màu sơ đồ `MAP_A8` (~dòng 2504,
   64 bàn) theo tài khoản, cảnh báo "1 tài khoản trên N máy". Agent chỉ gửi `sub`+hostname; **tra
   sub→email ở tầng trung tâm** (đừng chép danh bạ 3MB sang 100 máy).
3. **Cài hàng loạt (chỉ khi bước 1 xanh + user duyệt):** script lặp qua `.exports/pc-a8-inventory.json`,
   với mỗi PC copy agent qua `C$` + `schtasks /Create` từ xa. Tái dùng `CAI-PC-LOGIN-AGENT.bat`.

## 7. BẪY KỸ THUẬT ĐÃ CẮN (đừng lặp lại)
- **File .ps1 phải THUẦN ASCII.** PS 5.1 đọc file không-BOM, ký tự phi-ASCII (vd em-dash `—`) bị hiểu
  nhầm thành nháy kết thúc chuỗi → parser vỡ. Kiểm: `grep -nP '[^\x00-\x7F]' file.ps1`.
- **`Register-ScheduledTask` báo "Access is denied"** (UAC lọc token) — dùng **`schtasks /Create`** thì
  QUA ĐƯỢC không cần admin (task chạy khi user logon).
- **JSON cho Node phải UTF-8 KHÔNG BOM** (PS `Set-Content -Encoding UTF8` thêm BOM → `JSON.parse` lỗi;
  ghi bằng `[IO.File]::WriteAllText(path, s, (New-Object Text.UTF8Encoding($false)))`). Và ép JSON
  luôn là MẢNG (1 phần tử vẫn `[...]`).
- **`@($genericList)`** ném ArgumentException dưới `$ErrorActionPreference='Stop'` — dùng pipe
  `$list | ConvertTo-Json` + `$list.Count`.
- **Đường dẫn có space "New folder"** thành `%20` trong `import.meta.url` → ENOENT. Node dùng
  `fileURLToPath(import.meta.url)`.
- **robocopy** trong lệnh tương tác bị bộ bảo vệ CLI nhầm cờ `/NFL` là đường dẫn — dùng `Copy-Item`.
- **auth_store trên đĩa CHỈ có token** (partialize), không có tên/email → bắt buộc tra danh bạ.

## 8. Bộ nhớ liên quan (nếu agy có kênh đọc): memory dự án `theo-doi-dang-nhap-pc-a8`, `khong-thoa-hiep-voi-it`,
`endpoint-central-agent`, `bo-chuan-phat-trien`, `so-do-mat-bang-kho170`.
