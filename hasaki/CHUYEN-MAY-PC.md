# KẾ HOẠCH CHUYỂN MÁY TRẠM: LAPTOP → PC CỐ ĐỊNH

> Lập ngày 18/07/2026, sau khi khảo sát toàn bộ 2 dự án `hasaki/` (5S + kiểm kê + chấm công)
> và `factory/` (GitHub Pages stocklocationfactory). Mục tiêu: **dữ liệu luôn được lấy đúng lịch,
> token tự làm mới, không phụ thuộc máy cũ.**

---

## 0. CẬP NHẬT 27/07/2026 — CHUYỂN MÁY THEO 3 GIAI ĐOẠN (thay cho lối "chuyển 1 nhát")

Bộ nguyên tắc mới (chống đá phiên + mượn phiên người dùng + PC chỉ tự đăng nhập ngoài giờ làm)
làm kế hoạch gốc lệch ở 3 chỗ: **lịch chạy**, **cách cutover**, và **số phận của laptop**
(laptop KHÔNG còn bị thải hồi — nó trở thành *nguồn token* trong giờ làm việc).

**Nguyên tắc xuyên suốt: KHÔNG chuyển máy và đổi kiến trúc cùng lúc.** Đổi hai thứ một lúc thì
lúc hỏng không biết tại máy mới hay tại kiến trúc mới. Chia làm 3 giai đoạn, mỗi giai đoạn tự nó
đã chạy được và có đường lùi:

| GĐ | Làm gì | Độ tươi dữ liệu trong giai đoạn | Đường lùi |
|---|---|---|---|
| **A** | Chuyển nguyên hệ hiện tại sang PC, đổi lịch sang **cửa sổ vàng trước 7h45** + cấm tự đăng nhập 07:45–18:00 | 1 lượt đủ/ngày lúc ~6h45 + lượt vét 18h15. **Tạm mất độ tươi 15–30' trong ngày** (chưa có bridge) | Bật lại 4 task trên laptop |
| **B** | Dựng extension bridge trên trình duyệt người dùng + mở 4 ô token & nhịp tim trên Apps Script | Về lại 10–30' trong ngày, **không lượt đăng nhập nào trong giờ làm** | Gỡ extension → lùi về hành vi GĐ A |
| **C** | PC thành máy chạy duy nhất bằng token mượn; laptop chỉ còn extension; thu hồi secret khỏi laptop | Như GĐ B, thêm khả năng chạy cả khi laptop tắt | Giữ gói secret trong két, dựng lại laptop trong 30' |

**Bước 0 bắt buộc trước mọi thứ — ĐƯA CODE VÀO GIT.** Kiểm tra ngày 27/07 cho thấy các file sau
**chưa từng commit**, nghĩa là clone repo trên PC sẽ ra một hệ thống thiếu hẳn nhánh vệ sinh/planogram,
thiếu poller, và thiếu cả script cài đặt:
`sync-poller.js`, `sync-vesinh-all.js`, `sync-vesinh-ai.mjs`, `SETUP-PC-MOI.ps1`, `BAO-MAT-MAY.ps1`,
`kiemsoatkho/hasaki-{kiemke,pc,planogram,tonbatthuong}.js`, cùng ~29 file đã sửa chưa commit.
Commit + push xong mới được sang mục 3.

**Hai thí nghiệm phải chạy trước GĐ C** (mỗi cái 5 phút, kết quả quyết định kiến trúc):
1. **Token có đi được giữa hai máy không** — lấy token từ trình duyệt laptop, gọi `get-me` từ PC.
   Nếu hệ thống buộc token theo IP/thiết bị thì GĐ C phải đổi: laptop chạy việc, PC chỉ dự phòng.
2. **Đăng nhập bù có đá phiên không** — đăng nhập hr từ profile riêng trong lúc người dùng đang giữ
   phiên WMS, kiểm `get-me` của WMS sau 1 phút. Chưa có kết quả thì **mặc định hoãn tới sau 18h**,
   không đăng nhập bù trong giờ làm.

---

## 1. HIỆN TRẠNG (kết quả khảo sát)

### Kho code (theo git — clone lại được, KHÔNG cần chép)
| Thư mục | Repo | Ghi chú |
|---|---|---|
| `New folder/` (chứa `hasaki/`, `kiemsoatkho/`) | `letam0317/th76tamle` | repo chính |
| `New folder/factory/` | `letam0317/stocklocationfactory` | repo Pages độc lập, nested (repo cha ignore) |
| `baocao5s/` | — | **vỏ rỗng, xoá được** |

### Dữ liệu RIÊNG ngoài git — PHẢI chép tay sang PC mới
| File/thư mục | Vai trò | Nếu mất? |
|---|---|---|
| `hasaki/.env` | TOÀN BỘ secret: WMS + Hasaki (user/pass/**2FA TOTP**), `APPSCRIPT_KEY/URL`, workflow id | Điền lại tay từ đầu — phiền nhất |
| `hasaki/.exports/tasks-cache.json` | Kho **đóng băng task terminal** (đồng bộ tăng dần 45 ngày) | Phải chạy `FULL_RESYNC=1` một lần (nặng WMS) |
| `hasaki/nhansu-manual.json` | Danh bạ NV khai tay (PII, gitignore) | Mất danh sách khai tay |
| `hasaki/.last-sync.json` | Marker lần đồng bộ cuối | Nhẹ, tự tạo lại |
| `hasaki/.clasp-deploy/` + `google-script-DEPLOY.gs` | Bản Apps Script live CÓ SECRET (chỉ cần khi sửa/deploy lại GAS) | Kéo lại bằng `clasp pull` |
| `hasaki/_backup-on-dinh-2026-07-15/` | Backup cũ (task XML, GAS, nhansu) | Tham khảo |

### KHÔNG chép được / KHÔNG cần chép
- **`.wms-session/edge-profile`** (phiên SSO): cookie Edge mã hoá **DPAPI theo từng máy + user**
  → chép sang PC khác là VÔ DỤNG. Trên PC mới chỉ cần chạy `LOGIN-HASAKI.bat` **1 lần** —
  vì `.env` có `HASAKI_2FA_SECRET` (TOTP) nên đăng nhập **tự động 100%**, tự tạo profile + kho token mới.
- `token-cache.json`: TTL 40 phút, tự sinh lại sau lần đăng nhập đầu.
- `node_modules/`: `npm install` lại theo `package-lock.json`.
- Không có `credentials.json` service account — mọi ghi Sheet đi qua **Apps Script webhook**
  (`APPSCRIPT_URL` + `APPSCRIPT_KEY` trong `.env`), nên phía Google **không phải cài gì thêm**.

### Cơ chế token (vì sao "dữ liệu luôn được lấy")
1. Lịch chạy → script cần token → hỏi kho chung `token-store.js` (TTL 40').
2. Kho hết hạn → `auto-login.js` mở Edge **headless** trên profile SSO → bấm SSO im lặng → chụp Bearer mới (work / hr / wms).
3. Phiên SSO chết hẳn → task "5S Cảnh yêu cầu đăng nhập" (mỗi 2') phát hiện, mở Edge + tự điền
   email/pass/OTP (TOTP từ `.env`) → phiên sống lại, chuỗi trên tự chạy tiếp.
   ⇒ Trên PC mới, chỉ cần **bước đăng nhập đầu tiên thành công** là toàn hệ tự duy trì.

### Lịch chạy CŨ trên laptop (giữ lại để đối chiếu — lịch ĐANG chạy xem `LICH-VA-DU-PHONG.md`)
| Task | Lịch | Chạy gì |
|---|---|---|
| 5S Dong bo dashboard | 07:00 hằng ngày (đã dời **08:40** từ 22/07) | `AUTO-EXPORT.bat` → 5S-TASKS **+ nối luồng stock-location (factory)** |
| 5S Cham cong | 07:20 hằng ngày | `LAY-CHAM-CONG.bat` → CHAM-CONG + NHAN-SU |
| Day bao cao 5S | mỗi 15 phút | `DAY-BAO-CAO-5S.bat` → inbox WMS-5S-AUDIT → task workflow 591 |
| 5S Canh yeu cau dang nhap | mỗi 2 phút | `KIEM-TRA-YEU-CAU-LOGIN.bat` → mở Edge đăng nhập khi cần |

Cả 4 task `LogonType=Interactive` → **chỉ chạy khi user đang đăng nhập Windows** (xem mục 3.7).

> **Vì sao lịch này không dùng lại nguyên xi trên PC:** nó bật "chạy bù khi lỡ giờ", nên trên máy hay
> tắt thì mọi thứ dồn vào lúc bật máy — sáng 27/07 task 7h20 nổ lúc 8h35, giữa giờ làm việc, và ba bộ
> lần lượt cố đăng nhập SSO. Trên PC 24/7 phải chuyển sang lịch cố định nằm gọn **trước 7h45**.

### Đã sửa code cho khả chuyển (commit này)
- Bỏ toàn bộ đường dẫn cứng `C:/Users/lechitam/...` và đường dẫn Edge cứng trong 10 script.
- `token-store.js` xuất chung: `EDGE_PATH` (tự dò x86/64-bit, override bằng biến `EDGE_PATH` trong `.env`)
  và `duongDanProfile(DIR)` (profile luôn nằm trong thư mục dự án).
- `.vbs`/`.bat` vốn đã tương đối theo thư mục → **đặt dự án ở ổ/đường dẫn nào cũng chạy**
  (khuyên: PC mới dùng đường dẫn không dấu cách, ví dụ `C:\du-an\`).

---

## 2. GÓI MANG SANG (chuẩn bị trên LAPTOP, ~5 phút)

> ⚠️ **Danh sách này đã được soát lại 27/07/2026.** Bản 18/07 thiếu 6 kho tích luỹ sinh ra sau đó
> (AI vệ sinh, bình luận, danh bạ tích luỹ, cache kiểm kê…). Chép thiếu thì hệ thống vẫn chạy nhưng
> phải **cào lại từ đầu** — nặng cho WMS và mất dữ liệu lịch sử không lấy lại được.

**Nhóm 1 — Bí mật & cấu hình** (mất là phải điền tay): `.env`, `nhansu-manual.json`,
`google-script-DEPLOY.gs`, `.clasp-deploy\`

**Nhóm 2 — Kho tích luỹ** (mất là phải cào lại, tốn tải hệ thống):

| File | Vai trò | Nếu mất |
|---|---|---|
| `.exports\nhansu-cache.json` | Danh bạ tích luỹ — **giữ cả NV đã nghỉ, code quy định KHÔNG BAO GIỜ XOÁ** | Mất toàn bộ lịch sử NV đã nghỉ, không dựng lại được |
| `.exports\ai-vesinh-cache.json` | Kết quả phân tích AI ảnh vệ sinh | Phải chạy AI lại toàn bộ — đắt nhất trong danh sách |
| `.exports\tasks-cache.json` | Đóng băng task 5S đã kết thúc | Chạy `FULL_RESYNC=1` 1 lần ngoài giờ |
| `.exports\comments-cache.json` | Bình luận task | Gọi lại API bình luận cho ~300 task |
| `.exports\anh-check-cache.json` | Kết quả quét ảnh khống | Tải lại ảnh để quét |
| `.pc-cache.json` | Cache kiểm kê physical-count (~5,5 MB) | Kéo lại ~150 trang detail |
| `.cache-danhba.json` | Cache danh bạ wshr (~3 MB, **có PII**) | Tự dựng lại, nhưng tốn 1 lượt |

**Nhóm 3 — Mốc trạng thái** (nhẹ, chép để không chạy trùng ngay ngày đầu):
`.sheet-hash.json`, `.poller-state.json`, `.sync-ok-*`, `.last-sync.json`, `.session-ledger-state.json`

Lệnh gợi ý (PowerShell, chạy trong `hasaki/`):
```powershell
$g="$env:USERPROFILE\Desktop\goi-chuyen-may"; New-Item -ItemType Directory -Force "$g\.exports" | Out-Null
Copy-Item .env,nhansu-manual.json,google-script-DEPLOY.gs $g -ErrorAction SilentlyContinue
Copy-Item .last-sync.json,.sheet-hash.json,.poller-state.json,.pc-cache.json,.cache-danhba.json,.session-ledger-state.json $g -ErrorAction SilentlyContinue
Get-ChildItem -Force -Filter ".sync-ok-*" | Copy-Item -Destination $g
Copy-Item .exports\tasks-cache.json,.exports\nhansu-cache.json,.exports\comments-cache.json,.exports\anh-check-cache.json,.exports\ai-vesinh-cache.json "$g\.exports\" -ErrorAction SilentlyContinue
Copy-Item .clasp-deploy $g -Recurse -ErrorAction SilentlyContinue
"Da gom:"; Get-ChildItem $g -Recurse -File | Select-Object FullName, Length
```
> ⚠️ `.env` chứa mật khẩu + khoá 2FA — chép bằng USB riêng, xoá sau khi xong, KHÔNG gửi qua chat/mail.
> Các file này đã mã hoá EFS trên laptop: chính bạn copy sang USB (FAT32/exFAT) sẽ **tự giải mã** — bình thường;
> nghĩa là gói USB là bản TRẦN, càng phải giữ kỹ và xoá ngay sau khi PC mới chạy ổn.

---

## 3. CÀI ĐẶT PC MỚI (theo thứ tự)

1. **Cài phần mềm**: Git; Node.js LTS (≥18, laptop đang dùng v24); Edge (Windows có sẵn).
2. **Clone code**:
   ```powershell
   git clone https://github.com/letam0317/th76tamle.git "C:\du-an"
   git clone https://github.com/letam0317/stocklocationfactory.git "C:\du-an\factory"
   ```
   Đăng nhập GitHub khi push lần đầu (Git Credential Manager tự lo, cần tài khoản `letam0317`).
3. **Đổ gói mang sang** vào `C:\du-an\hasaki\` (đúng vị trí từng file như mục 2).
4. **Cài dependency**: `cd C:\du-an\hasaki && npm install`.
5. **Chạy `SETUP-PC-MOI.ps1`** (click phải → Run with PowerShell): tự kiểm tra môi trường,
   đăng ký 4 scheduled task đúng giờ cũ, đăng ký giao thức `hasaki5s://` theo đường dẫn mới.
   (KHÔNG dùng file `DANG-KY-NUT-LOGIN.reg` cũ — nó ghi cứng đường dẫn laptop.)
6. **Đăng nhập lần đầu**: chạy `LOGIN-HASAKI.bat` — tự điền email/pass/OTP, tạo phiên SSO + kho token.
7. **PC luôn sẵn sàng** (task chỉ chạy khi user đăng nhập):
   - Không sleep: `powercfg /change standby-timeout-ac 0`
   - Tự đăng nhập Windows sau khi bật máy: `netplwiz` → bỏ tick "Users must enter a user name..."
     — **bắt buộc kèm** khoá màn hình ngay sau logon (BAO-MAT-MAY.ps1 tự đăng ký khi thấy auto-logon):
     lịch vẫn chạy khi màn hình khoá, người lạ không dùng được phiên.
   - (Tuỳ chọn) BIOS: bật "Restore AC Power Loss = Power On" để tự bật lại sau mất điện.
8. **Gia cố bảo mật**: chạy `BAO-MAT-MAY.ps1` (SAU khi đã đổ gói mang sang) — chi tiết mục 7 bên dưới.

---

## 3bis. LỊCH CHẠY MỚI TRÊN PC (thay bảng lịch cũ — áp dụng từ GĐ A)

Ba khung giờ, ranh giới đúng bằng khung chặn trong `session-rules.js` (`SAFE_RELOGIN_BLOCKS=07:45-18:00`):

| Task | Lịch | Chạy gì | Được tự đăng nhập? |
|---|---|---|---|
| **Cụm vàng** | 06:45 hằng ngày | Kéo TRỌN mọi nguồn trong **một phiên**: 5S + stock-location + kiểm kê + tồn bất thường + vệ sinh/planogram + chấm công | **CÓ** — chưa ai đi làm, không đá phiên ai |
| **Nhịp trong ngày** | mỗi 15' từ 07:45–18:00 | `sync-poller.js` + watcher cờ dashboard | **KHÔNG** — chỉ chạy khi có token mượn còn sống; không có thì bỏ lượt |
| **Lượt vét** | 18:15 hằng ngày | Kéo nguồn nào còn cũ theo sổ tươi | **CÓ** — nhưng chỉ khi nhịp tim laptop đã im >20' |
| Đẩy báo cáo 5S | mỗi 15' | `DAY-BAO-CAO-5S.bat` | **KHÔNG** — dùng token sẵn, hết token thì hoãn |

Ba điều kiện bắt buộc kèm theo, thiếu một là hỏng nguyên tắc:
1. **`EP_RELOGIN` tuyệt đối không đặt trong `.env` của PC.** Biến này bỏ qua luật khung giờ, chỉ dùng
   khi chạy tay khẩn cấp và gõ trực tiếp trên dòng lệnh.
2. **Cụm vàng phải xong trước 7h45.** Đo thử lần đầu; hiện cụm đủ mất ~20–25 phút nên 6h45 là an toàn.
   Nếu quá giờ thì lùi giờ bắt đầu, đừng nới khung chặn.
3. **Chỉ một máy được chạy lịch.** PC và laptop cùng bật lịch = hai phiên SSO đá nhau và hai nguồn
   cùng ghi Sheet. Từ GĐ B trở đi cần thêm **khoá chủ trên Apps Script** (ô "máy nào đang chạy, từ lúc nào")
   vì khoá dạng file trên đĩa hai máy không nhìn thấy nhau.

Ghi chú vận hành: task vẫn là `LogonType=Interactive` vì Puppeteer cần desktop thật (Turnstile).
PC bật auto-logon + khoá màn hình ngay (mục 3.7) là chạy được; nhưng **đừng để phiên Windows bị ngắt
kết nối kiểu RDP disconnect** — desktop biến mất thì cụm vàng sẽ trượt trong im lặng.

---

## 4. KIỂM THỬ TRÊN PC MỚI (trước khi cắt chuyển)

Chạy TAY từng bộ, sau mỗi bộ xem log + Sheet:
| Bước | Lệnh | Kiểm tra đạt |
|---|---|---|
| 1 | `AUTO-EXPORT.bat` | `auto-export.log` không lỗi; tab `5S-TASKS` có timestamp mới; `stocklocation.log` OK; tab `mastige`/`garment` Sheet factory có dữ liệu hôm nay |
| 2 | `LAY-CHAM-CONG.bat` | `cham-cong.log` OK; tab `CHAM-CONG`, `NHAN-SU` cập nhật |
| 3 | `DAY-BAO-CAO-5S.bat` | `day-bao-cao-5s.log` OK (không có báo cáo mới thì tự bỏ qua — vẫn đạt) |
| 4 | Dashboard | mở `letam0317.github.io/kiemsoatkho` + `/stocklocationfactory` → chip giờ (apiAt) là hôm nay |
| 5 | Nút PIN 233135 | bấm tải dữ liệu trên dashboard → chạy được |

---

## 5. CẮT CHUYỂN (cutover) — tránh 2 máy giành phiên

> Hai máy cùng chạy = cùng đăng nhập SSO + cùng ghi đè Sheet → dễ đá phiên nhau, log khó lần.
> **Chọn chiều tối (sau 18h) hoặc cuối tuần** — không cutover giữa giờ làm, vì lượt chạy đầu tiên
> của PC là một lượt đăng nhập thật.

**Tối hôm trước (sau 18h)**
1. Trên LAPTOP — tắt cả 4 lịch (KHÔNG xoá, để dự phòng):
   ```powershell
   '5S Dong bo dashboard','5S Cham cong','Day bao cao 5S','5S Canh yeu cau dang nhap' |
     ForEach-Object { Disable-ScheduledTask -TaskName $_ }
   Get-ScheduledTask | Where-Object {$_.TaskName -match '5S|Day bao cao'} | Select TaskName,State
   ```
   Xác nhận cả 4 đều `Disabled` rồi mới sang bước sau — đây là chốt chặn duy nhất chống hai máy giành phiên.
2. Trên PC — chạy tay **một lượt cụm vàng** để kiểm chứng (lúc này ngoài giờ làm nên an toàn),
   đối chiếu Sheet + chip giờ dashboard theo mục 4.

**Sáng hôm sau**
3. Để PC tự chạy cụm vàng 6h45. Trước 8h kiểm 3 việc: log không lỗi, chip giờ dashboard là hôm nay,
   và `session-ledger.log` không ghi phiên chết bất thường.
4. Người dùng bật laptop đi làm như bình thường. **Ở GĐ A, laptop không chạy gì cả** — nó chỉ là máy
   làm việc. Dữ liệu trong ngày sẽ đứng yên tới lượt vét 18h15; đây là điều đã biết trước, không phải lỗi.

**Theo dõi 3 ngày** rồi mới sang GĐ B (dựng extension bridge).

**Rollback**: bật lại 4 task trên laptop bằng `Enable-ScheduledTask` — toàn bộ kho tích luỹ vẫn còn
nguyên trên laptop. Lưu ý rollback **không tức thời** vì laptop có thể đang tắt, nên nếu PC trượt cụm vàng
thì cách nhanh nhất là chạy tay `AUTO-EXPORT.bat` trên laptop trước 7h45.

**Thu hồi secret — thay đổi so với bản 18/07:** laptop **không bị xoá sạch** nữa, vì từ GĐ B nó là nguồn
token. Trình tự đúng: giữ nguyên laptop suốt GĐ A–B; chỉ khi GĐ C chạy ổn 1 tuần mới gỡ `.env`,
`.wms-session`, `node_modules` khỏi laptop và **để lại đúng extension bridge**. Khi đó secret chỉ còn
tồn tại trên một máy — an toàn hơn hiện tại.

---

## 6. RỦI RO & CÁCH CHẶN

| Rủi ro | Chặn bằng |
|---|---|
| **Code chưa commit → PC clone ra hệ thiếu** (kiểm 27/07: poller, vệ sinh, planogram, cả setup script đều chưa vào git) | Bước 0 mục 0: commit + push, rồi `git status` phải sạch trước khi clone |
| **Cụm vàng chạy quá 7h45 → đăng nhập giữa giờ làm** | Đo thời lượng lượt đầu; quá thì lùi giờ bắt đầu, KHÔNG nới khung chặn |
| **Hai máy cùng ghi Sheet** (khoá file không nhìn thấy nhau qua máy) | GĐ A: tắt lịch laptop trước, xác nhận `Disabled`. GĐ B+: thêm khoá chủ trên Apps Script |
| **Mất kho AI vệ sinh / danh bạ tích luỹ** do dùng danh sách chép của bản 18/07 | Dùng danh sách đã soát lại ở mục 2 (3 nhóm) |
| Quên chép `.env` | `SETUP-PC-MOI.ps1` kiểm tra và báo đỏ ngay bước đầu |
| Chép edge-profile sang mong dùng lại phiên | Vô dụng (DPAPI) — kế hoạch dùng đăng nhập tự động TOTP thay thế |
| Quên `tasks-cache.json` → export lại toàn bộ, nặng WMS | Nằm trong danh mục gói mang sang; lỡ quên thì chạy 1 lần `FULL_RESYNC=1` ngoài giờ |
| 2 máy cùng chạy lịch | Trình tự cutover: tắt laptop TRƯỚC, bật PC SAU |
| PC ngủ/khoá màn hình → lịch không chạy | Mục 3.7: powercfg + netplwiz |
| Đường dẫn mới khác máy cũ | Đã sửa code khả chuyển + setup script tự lấy đường dẫn |
| Push GitHub lỗi trên máy mới | Đăng nhập Git Credential Manager ngay bước clone/push đầu |

---

## 7. BẢO MẬT MÁY TRẠM (đã áp dụng trên laptop 18/07/2026 — PC mới chạy lại `BAO-MAT-MAY.ps1`)

Mối đe doạ: PC cố định đặt nơi nhiều người tiếp cận, máy có sẵn tài khoản khác (HASAKI, Guest, BarTender…).
Không xử lý thì người ngồi vào máy có thể: đọc `.env` (mật khẩu + khoá 2FA), mở Edge bằng profile SSO
(đang đăng nhập sẵn WMS/work/hr), bấm các `.bat` để kích hoạt hệ thống, copy dữ liệu PII trong `.exports`.

### `BAO-MAT-MAY.ps1` làm tự động (chạy lại được nhiều lần, không cần Admin)
| Tầng | Việc | Chặn ai |
|---|---|---|
| 1 | Xoá rác bí mật (`_tok.txt` chứa Bearer trần, `debug-*`, `wms_*.json`…) | mọi người |
| 2 | NTFS ACL: cả thư mục `New folder` chỉ còn user chính + SYSTEM | tài khoản khác trên máy — không mở được folder, không bấm được `.bat` |
| 3 | EFS mã hoá: `.env`, `.wms-session` (phiên SSO + token), `.exports`, `.clasp-deploy`, `nhansu-manual.json`, `google-script-DEPLOY.gs`, `_backup-*` | tháo ổ cứng / boot USB / admin reset mật khẩu — đọc ra chỉ là rác |
| 4 | Màn hình tự khoá sau 5' + (nếu bật auto-logon) khoá NGAY sau khi máy tự đăng nhập | người lạ dùng ké phiên đang mở; lịch vẫn chạy khi màn hình khoá |

### Việc làm TAY (script chỉ nhắc, không tự làm được)
1. **Sao lưu khoá EFS** (bắt buộc, làm 1 lần/máy): `cipher /x %USERPROFILE%\Desktop\efs-backup` → cất USB riêng.
   Mất profile Windows mà không có bản này = mất luôn secret đã mã hoá.
2. Đặt **mật khẩu mạnh** cho tài khoản `lechitam` — EFS + khoá màn hình dựa hết vào nó.
3. Nhờ Admin: bật **BitLocker** ổ C:, tắt **Guest**, kiểm tra các tài khoản lạ không thuộc nhóm Administrators.
4. Người khác cần dùng máy → tạo tài khoản Windows **Standard riêng**, không dùng chung.
5. Rời máy bấm **Win+L**.

### Giới hạn cần biết (ngoài phạm vi máy trạm)
- **Dashboard là GitHub Pages public**: `kiemsoatkho`/`stocklocationfactory` ai có link đều xem được, kể cả
  tên nhân viên + vi phạm (NV_MAP ~146 tên nằm trong HTML). PIN chỉ gác thao tác GHI (đã kiểm server-side, tốt) —
  không gác việc XEM.
- ~~Sheet ID nằm trong HTML public → dò được tab NHAN-SU/CHAM-CONG (PII)~~ → **ĐÃ XỬ LÝ (xác minh 18/07/2026)**:
  Apps Script định tuyến `PII_TABS = ['NHAN-SU','CHAM-CONG']` sang **Sheet riêng không public**
  (`PRIVATE_SHEET_ID` trong Script Properties); test truy cập ẩn danh xác nhận 2 tab đã biến mất khỏi sheet public,
  tab `5S-TASKS` cho dashboard vẫn đọc bình thường.
