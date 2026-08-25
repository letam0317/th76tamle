# CÒ CHỜ MÁY IN — `Desktop-JE75K38` có điện là **mọi lượt gửi in đều ra tem**

> Chốt 21/08/2026. **Máy in bật = in được. Không phụ thuộc laptop của agent nữa.**
> Cài: `node TAO-GOI-MAY-IN.mjs` trên laptop → chép `hasaki\_GOI-MAY-IN\` sang máy in →
> bấm phải `CAI-TREN-MAY-IN.bat` → *Run as administrator*.

---

## 1. Đổi chỗ đứng của agent — đây là toàn bộ cải tiến

```
TRƯỚC 21/08/2026 — hai máy phải cùng bật
  điện thoại/PC ──► HÀNG ĐỢI GAS ──► agent trên LAPTOP ──(máy in share qua mạng)──► TSC PE200
                                          ▲                                              ▲
                                  laptop tắt = đứng                        Desktop-JE75K38 tắt = đứng

SAU — chỉ cần MỘT máy, đúng cái máy đang cắm máy in
  điện thoại/PC ──► HÀNG ĐỢI GAS ──► agent trên Desktop-JE75K38 ──(máy in nội bộ)──► TSC PE200
```

Agent là tiến trình nền `node`, **không cần cửa sổ, không cần ai đăng nhập** — task chạy bằng
**SYSTEM** gọi được, và nó in bằng `winspool` trên máy in **nội bộ** nên quyền SYSTEM là đủ. Nhờ vậy:

> **`Desktop-JE75K38` có điện → tự bật (BIOS) → task SYSTEM chạy → agent nhặt lệnh → ra tem.**
> Không ai đăng nhập máy đó cũng xong. Laptop tắt cũng xong.

Máy đó **không cài Node và cũng không xin IT cài** — gói mang theo `node.exe` (trên Windows là file
chạy độc lập, chép đi là chạy) cùng đúng 6 gói `node_modules` mà agent cần (≈20 MB, không phải cả
268 MB của dự án). Đã chạy thử chính gói đó: dựng được tem 38558 byte bằng `node.exe` đi kèm.

---

## 2. Sáng 21/08/2026 — vì sao phải đổi

Đọc từ log agent + Event Log, không suy đoán:

| Giờ | Việc | Bằng chứng |
|---|---|---|
| 20/8 **20:33:30** | Lần cuối agent đọc được trạng thái **từ Desktop-JE75K38** | `nguồn: may-chu` |
| 20/8 21:27 → 00:22 | 22 lượt liền chỉ còn bản cache cục bộ ⇒ **Desktop-JE75K38 tắt** trong khoảng 20:33–21:27 | `nguồn: cuc-bo` + `⚠ không gọi được máy chủ in` |
| 21/8 **00:32:17** | **Laptop cũng tắt** | Event 1074, `shutdown.exe`, tài khoản `lechitam` |
| 21/8 07:57 · 07:57 · 07:59 · 08:43 · 08:46 | **5 lệnh in** vào hàng đợi GAS, không ai nhặt | 4 lệnh `may-yhmfpajl@hasaki.vn`, 1 iPhone |
| 21/8 **09:00:31 → 09:02:27** | Laptop bật, agent lên, in hết 5 lệnh trong **44 giây** | — |

Không mất lệnh nào — hàng đợi giữ đúng thiết kế. Nhưng người bấm in từ 07:57 phải đợi tới 09:01.
Cả hai máy đều có nếp *tắt cuối ngày, bật khi tới nơi*, mà kho bắt đầu bấm in từ **07:57**.

> **Một chỗ dễ hiểu nhầm:** chữ *"máy trạm"* trong dashboard và log của dự án đang chỉ **laptop chạy
> agent**, không phải `Desktop-JE75K38`. Câu cảnh báo nào có chữ "máy trạm" là đang nói về laptop.

---

## 3. Cài trên `Desktop-JE75K38`

### 3.1 Gói mang sang

```powershell
# trên laptop, trong hasaki\
node TAO-GOI-MAY-IN.mjs        # dựng lại hasaki\_GOI-MAY-IN\  (~108 MB)
```

| Trong gói | Để làm gì |
|---|---|
| `node.exe` (88 MB) | Node chạy độc lập — máy in không cần cài gì |
| `hasaki\in-tem-agent.mjs` + `_IN-RAW.ps1` + `_MAY-IN-SERVER.ps1` + `_AGENT-IN-TEM-AN.vbs` | agent + đường gửi RAW + tiến trình đọc tình trạng máy in |
| `hasaki\_CO-CHO-MAY-IN.ps1` / `.bat` | bộ cò chờ: cài + tự chữa |
| `hasaki\.env` | `APPSCRIPT_URL` + `APPSCRIPT_KEY` — **là bí mật, gói này đừng để chỗ ai cũng lấy được** |
| `hasaki\node_modules\` (19,5 MB) | `sharp`, `dotenv` + phụ thuộc — tính đúng closure, không chép bừa |
| `factory\index.html` | agent cắt khối `PR-TEM` trong đó để dựng tem ⇒ tem in ra **giống hệt** bản xem trước trên dashboard |

**Đã chép sẵn 21/08/2026** qua SMB sang `\\Desktop-je75k38\Users\Public\AuditFactory`
(= `C:\Users\Public\AuditFactory` trên máy đó) — 145 file, 108,5 MB, đã đối chiếu hash từng file.

> **Cắt sang `C:\AuditFactory` TRƯỚC KHI CÀI.** `C:\Users\Public` là chỗ **ai cũng ghi được**, mà
> trong gói có `.env` chứa `APPSCRIPT_KEY`. Chuyển sau khi cài thì task đã trỏ sai đường dẫn.
> (Không chuyển hộ từ đây được: máy đó chỉ chia sẻ `Users` và `Downloads`, không với ra ngoài `C:\`.)

Rồi bấm phải **`CAI-TREN-MAY-IN.bat` → Run as administrator**.

> **Sửa code agent bên laptop xong thì phải chạy lại `TAO-GOI-MAY-IN.mjs` và chép lại.** Bản trên máy
> in là bản **rời**, nó không tự cập nhật theo laptop. Đó chính là cái giá của việc không phụ thuộc.

### 3.2 BIOS — script **thử đặt tự động trước**, không được mới tới tay

Máy **tắt hẳn** thì không còn dòng mã nào của Windows chạy; chỉ **BIOS** nghe được cú cắm điện.

Mục **9** của `_CO-CHO-MAY-IN.ps1` thử đặt thẳng từ Windows, tuỳ hãng:

| Hãng | Đường | Ghi chú |
|---|---|---|
| **HP** | `root\hp\instrumentedBIOS` → `HP_BIOSSettingInterface.SetBIOSSetting` | dò tên mục theo mẫu chữ (*After Power Loss* / *AC Power Recovery*), chọn giá trị khớp `Power On` |
| **Lenovo** | `root\wmi` → `Lenovo_SetBiosSetting` + `Lenovo_SaveBiosSettings` | phải gọi Save, không thì đặt xong mất |
| **Dell** | `cctk.exe` của *Dell Command \| Configure* nếu đã cài | Dell **không** có BIOS-WMI sẵn; chưa cài cctk thì script nói thẳng là phải bấm F2 |
| Asus / Gigabyte / MSI / Intel… | **không có đường nào** | bắt buộc F2 |

Máy có **mật khẩu BIOS** thì lệnh trả mã lỗi — script nói rõ chứ không im lặng coi như xong. Đặt được
hay không, nó đều in bảng dưới để đối chiếu, và **thiết lập chỉ có hiệu lực từ lần khởi động sau**.

**Máy thật là `Gigabyte H97-D3H`** (đọc được 21/08/2026 qua nhịp tim) ⇒ **không có BIOS-WMI, phải làm
tay**. Gigabyte **vào BIOS bằng phím `Del`**, không phải F2, và **gọi tên khác hẳn các hãng khác** —
ai đi tìm chữ *"Restore on AC Power Loss"* trên bo mạch này sẽ không bao giờ thấy:

| Mục trong BIOS Gigabyte | Đặt | Được gì |
|---|---|---|
| `Power Management` → **AC BACK** | **Always On** (3 lựa chọn: *Memory* / *Always On* / *Always Off*) | **có điện vào là máy tự bật** — đúng thứ đang cần |
| `Power Management` → **ErP** | **Disabled** | ErP = Enabled thì bo mạch cắt sạch điện chờ, **AC BACK và hẹn giờ chết theo** |
| `Power Management` → **Resume by Alarm** | **Enabled**, *Every Day*, `07:15:00` | sáng nào máy cũng tự bật, không cần ai chạm vào |

#### Có người bật máy sớm hơn 07:15 thì cò chờ có phá gì không?

**Không.** `Resume by Alarm` chỉ là một **cú bật nguồn** của BIOS: nó chỉ có tác dụng khi máy **đang
tắt** (S5/S4). Máy đã bật rồi thì tới 07:15 **không có gì xảy ra** — không khởi động lại, không ngắt,
không đụng vào tiến trình nào. `AC BACK` cũng vậy: nó chỉ quyết định máy làm gì **khi điện quay lại**.

Nên đường in **không phụ thuộc vào giờ hẹn**:

| Máy bật lúc | Chuyện gì xảy ra |
|---|---|
| 06:30 (người tới sớm bật tay) | task SYSTEM nổ theo trigger **AtStartup** → agent chạy trong ~1 phút → in bình thường. 07:15 tới, alarm không làm gì cả vì máy đang bật. |
| 07:15 (không ai đụng vào) | alarm bật máy → task SYSTEM → agent → in bình thường. |
| Mất điện rồi có lại lúc 10:00 | `AC BACK = Always On` bật máy → task SYSTEM → agent → in bình thường. |
| Ai đó tắt máy lúc 08:00 | alarm **không** bật lại trong ngày (đã qua giờ hẹn) — phải bật tay hoặc rút/cắm điện. Đây là giới hạn thật của RTC alarm, không phải lỗi. |

Lệnh in gửi từ tab **Nhận diện SKU** trên `letam0317.github.io/stocklocationfactory` (điện thoại, PC,
4G — máy nào cũng được) đi vào **hàng đợi trên Apps Script**, nằm đó tới khi có agent nhặt. Nên bấm
lúc máy in còn tắt cũng **không mất lệnh**: máy bật lên là tem ra. Agent quét mỗi **1 giây** trong
giờ làm.

**Wake-on-LAN bỏ hẳn cho máy này.** Card mạng là **TP-Link Wireless USB Adapter** — Wi-Fi qua USB,
lúc máy tắt thì không có điện nên không nghe được gói đánh thức. Script đã thử bật và **không bật
được**, đã ghi vào sổ. Nên **AC BACK + Resume by Alarm là đường duy nhất** bật được máy này khi nó đã
tắt. Muốn có thêm WoL thì phải cắm dây mạng.

Làm tay trên máy khác: khởi động lại → **F2** (hoặc **Del**) → mục **Power**:

| Thiết lập | Đặt | Được gì |
|---|---|---|
| **Restore on AC Power Loss** / *AC Recovery* / *After Power Failure* | **Power On** (đừng chọn *Last State*) | **có điện vào là máy tự bật** — đúng thứ đang cần |
| **Wake on LAN** / *PME* / *Power On by PCI-E* | Enabled | laptop gửi gói đánh thức tới MAC `3C-64-CF-55-21-B0` là máy này tự bật |
| **Auto Power On** / *RTC Alarm* (nếu có) | Everyday 07:15 | sáng nào cũng tự bật, không cần sự kiện gì |
| **ERP / EuP Ready** (nếu có) | **Disabled** | ERP cắt điện card mạng khi máy tắt ⇒ Wake-on-LAN chết |

Nếu máy đó hoá ra là laptop, script tự nhận biết và in hướng dẫn tương đương (*Wake on AC*,
*Auto On Time*). **Thử thật:** tắt máy hẳn → rút điện 10 giây → cắm lại → phải tự bật.

### 3.3 `_CO-CHO-MAY-IN.ps1` làm gì

**PHẦN 1 — chỉ đọc, chưa sửa gì** (dừng hỏi Enter mới sang phần sửa; muốn chỉ xem rồi thoát:
`-ChiDoc`): máy này desktop hay laptop · **nếp tắt/bật 10 ngày qua** (câu trả lời cho "sáng nay máy
in có bị tắt không") · spooler · máy in + chia sẻ + cờ Offline · card mạng có hỗ trợ Wake-on-LAN.

**PHẦN 2 — sửa:**

| Việc | Vì sao |
|---|---|
| Không tự ngủ / ngủ đông, cho phép hẹn giờ đánh thức | máy in phải trực cả ngày |
| **Tắt Fast Startup** | "tắt máy" kiểu Fast Startup thực ra là ngủ đông một phần — Wake-on-LAN từ trạng thái tắt thường không chạy, và driver máy in đôi khi không nạp lại đúng |
| Spooler `Automatic` + `sc failure … restart/5000` ×3 | spooler chết một lần là nằm luôn tới khi có người để ý |
| Máy in: gỡ **Use Printer Offline**, gỡ **Pause**, bật lại **Shared**, dọn job **đã lỗi** > 15 phút | ba trạng thái đầu đều làm "chưa sẵn sàng" trong khi máy vẫn bật; chỉ dọn job **đã lỗi** — dọn theo tuổi đơn thuần là mất tem của người ta mà không ai biết |
| Mạng → **Private**, card mạng **Wake on Magic Packet = Enabled** + bỏ "cho phép máy tắt card để tiết kiệm điện" | mạng Public chặn chia sẻ máy in; card ngủ thì không nghe được gói đánh thức |
| **Chốt tên máy in cho agent** | máy này có **hai** queue tên chứa `PE200` (USB031 và USB003). Thử **mở** từng cái bằng đúng đường agent sẽ dùng (`_IN-RAW.ps1 -ChiMo`: mở rồi đóng handle, **không tạo việc in, không tốn tem**), cái nào mở được thì ghi vào `.agent-may-in.txt` |
| Kiểm `node`, `.env`, và **máy này có ra được `script.google.com` không** | ba thứ thiếu một là agent không nhặt được lệnh — nói ngay lúc cài chứ đừng để phát hiện lúc có người đứng đợi tem |
| **Giữ agent sống**: không có tiến trình → gọi `_AGENT-IN-TEM-AN.vbs`; còn tiến trình mà **sổ đứng im > 12 phút** → giết rồi dựng lại | đếm tiến trình thôi là chưa đủ: agent treo vẫn còn trong Task Manager mà không nhặt lệnh nào |
| Task **"Co cho may in tem"** — **SYSTEM**, khi khởi động máy + mỗi 2 phút | không cần ai đăng nhập. Chỉ đăng ký lúc cài tay; chế độ `-Chua` chạy mỗi 2 phút **không** đăng ký lại |

**PHẦN 3:** in hướng dẫn BIOS đúng loại máy + MAC + các lệnh **hoàn tác**.

**Sổ:** `hasaki\_co-cho-may-in.log` và `hasaki\.in-tem-agent.log`.

---

### 3.4 Trạng thái đã cài (21/08/2026) và hai lỗi phải vá ngay trong giờ đầu

Cài lúc **10:34** trên `Desktop-JE75K38`. Bằng chứng chạy được, đọc từ `_nhip.txt` + `.in-tem-agent.log`:

- `[10:54:01] ✓ đã in 2 tem trong 5.1s` — **agent trên chính máy in đã in thật**, không qua laptop.
- Agent `pid 3436` sống liên tục, `hàng đợi trống` đều đặn ⇒ gọi được Apps Script.
- Mạng máy in: DNS `142.251.12.x`, TCP 443 mở, `HTTP 200` tới `script.google.com`, **không proxy**.
- Máy in chốt cho agent: `TSC PE200 (Copy 1)`; spooler `Running`.

**Hai lỗi tự gây ra, đã vá:**

1. **Chế độ `-Chua` áp lại MỌI thứ mỗi 2 phút** — sổ ghi ba dòng y hệt nhau lúc 10:36, 10:38, 10:40,
   10:42. Trong đó có `Set-NetAdapterPowerManagement`, mà **mỗi lần đụng vào card mạng là card reset,
   mạng đứt vài giây**: đúng lúc 10:34:29 agent báo `fetch failed`, và 10:46 chính laptop cũng mất
   cổng 445 sang máy đó 13 giây. Nay: việc **nặng** (powercfg · `sc failure` · card mạng) chỉ chạy
   khi cài tay hoặc **một lần mỗi ngày**; việc **rẻ** (spooler còn chạy không, máy in có bị Offline
   không, agent còn sống không) vẫn chạy mỗi lượt. Sau khi vá, sổ im từ 10:48.
2. **Cảnh báo không vào sổ** — `GhiSo` ban đầu chỉ ghi cái *đã sửa*. Lúc cần biết "bước kiểm
   `script.google.com` đã trượt hay chưa" thì không có gì để đọc. Nay ghi cả dòng `CANH:`.

**Nhịp tim `_nhip.txt` — con mắt duy nhất nhìn được vào máy đó.** Máy in chưa mở WinRM (cổng 5985
đóng) nên từ laptop không hỏi được gì; nhưng task SYSTEM chạy mỗi 2 phút **tự ghi một dòng** trạng
thái (hãng/model · card mạng · pid agent · độ trễ sổ · máy in · spooler · dòng cuối sổ agent), và thư
mục gói đọc được qua SMB. Bật thêm phần đo mạng bằng cách tạo file `_CHAN-DOAN-MANG.txt` trong thư
mục `hasaki`, xoá đi là tắt.

### 3.5 Chuyển gói ra khỏi `C:\Users\Public` — ĐÃ XONG 21/08/2026, và cái bẫy `icacls`

**Trạng thái chốt:** gói nằm ở **`C:\AuditFactory`**, quyền chỉ còn `SYSTEM` + `Administrators`
(`.env` chứa `APPSCRIPT_KEY` không còn ở chỗ `Everyone` đọc/ghi được). Task SYSTEM chạy lại đều mỗi
2 phút, agent `pid 11324` chạy từ `C:\AuditFactory\node.exe`.

Việc chuyển làm **bằng task SYSTEM trên chính máy đó** (bật bằng file cờ `_CHUYEN.txt`, cùng cơ chế
với `_QC.txt`), không bắt người kéo thả — vì thứ tự các bước rất dễ sai:

```
chép → ĐỔI TASK → ĐỌC LẠI TASK xác nhận → siết quyền → dừng agent cũ → mới xoá thư mục cũ
```

**Cái bẫy đã cắn, mất gần một tiếng.** Bước siết quyền ban đầu viết:

```powershell
icacls C:\AuditFactory /inheritance:r /grant 'SYSTEM:(OI)(CI)F' /grant 'Administrators:(OI)(CI)F' /T /C
```

Từ đó task **im hoàn toàn**. Nguyên nhân: `/inheritance:r` kèm `/T` **tắt kế thừa ở TỪNG FILE CON**,
trong khi quyền cấp ở gốc là loại **kế thừa xuống** `(OI)(CI)` — file con đã tắt kế thừa thì không
nhận được gì ⇒ **DACL rỗng, không ai mở nổi, kể cả `SYSTEM`**. Và `icacls` ở **thư mục gốc** vẫn hiện
`Administrators:(OI)(CI)(F)` + `SYSTEM:(OI)(CI)(F)` rất đẹp — nên nhìn vào đó là bị đánh lừa. Chỉ khi
`icacls` thẳng vào **một file con** mới lòi ra `Access is denied`.

Thứ tự đúng (đã vá vào `_CO-CHO-MAY-IN.ps1`):

| Bước | Lệnh | Vì sao |
|---|---|---|
| 1 | `icacls <gốc> /grant '*S-1-5-18:(OI)(CI)F'` và `'*S-1-5-32-544:(OI)(CI)F'` | cấp ở **gốc**, bằng **SID** — tên nhóm `Administrators` đổi theo ngôn ngữ Windows, trượt là trượt im lặng |
| 2 | `icacls "<gốc>\*" /reset /T /C` | **trả kế thừa cho file con** để chúng nhận quyền từ gốc — đây là bước chữa thật (chạm 173 file) |
| 3 | `icacls <gốc> /inheritance:r /C` | chặn quyền thừa từ `C:\` **chỉ ở gốc** → bỏ `Users`, đúng mục đích |
| 4 | đọc thử một file con | không đọc được thì **tự trả lại kế thừa** ngay, thà chưa siết còn hơn khoá chết |

Dấu hiệu đã chữa xong, đọc trong `_SUA-KETQUA.txt`: file con chuyển từ `Access is denied` sang
`BUILTIN\Administrators:(I)(F)` + `NT AUTHORITY\SYSTEM:(I)(F)` — chữ **`(I)`** nghĩa là *kế thừa*,
đúng cái vừa trả lại.

Trong lúc hỏng, **việc in không đứng**: agent dự phòng trên laptop vẫn nhặt lệnh, và `pr_lay` bên GAS
chạy trong `LockService` nên không in đôi. Đó chính là lý do nên giữ agent laptop cho tới khi máy in
chạy ổn định vài ngày.

> Còn một chi tiết nhỏ: agent hiện do `DESKTOP-JE75K38\Admin` khởi động (vì script sửa chạy dưới tài
> khoản đó), không phải `SYSTEM`. **Không cần làm gì** — lần đăng xuất hoặc khởi động lại kế tiếp,
> task SYSTEM sẽ dựng lại nó dưới `SYSTEM` như thiết kế.

**Hai file để lại trong `C:\Users\Public` trên máy in** (không chứa bí mật gì, xoá lúc nào cũng được):
`SUA-MAY-IN.bat` + `.ps1` (bấm `Win+R` dán đường dẫn là chạy được, tự xin Admin, tự chẩn đoán và sửa)
và `_nhip-mayin.txt` (gương nhịp tim — cửa sổ duy nhất còn nhìn được vào máy đó từ laptop sau khi gói
đã vào `C:\AuditFactory`; chỉ có trạng thái, email trong sổ đã bị xoá).

### 3.5b (bản cũ) Vì sao phải chuyển

Gói đang nằm ở `C:\Users\Public\AuditFactory` — chỗ đó **`Everyone` có Full Control**, mà trong gói
có `.env` chứa `APPSCRIPT_KEY`. (Đã thử siết ACL từ xa: không được — phiên SMB này vào bằng `Guest`.)

```
1. Task Manager -> ket thuc node.exe (agent)
2. Cat  C:\Users\Public\AuditFactory  ->  C:\AuditFactory
3. Bam phai C:\AuditFactory\CAI-TREN-MAY-IN.bat -> Run as administrator
   (chay lai se ghi de task sang duong dan moi - dung chuyen roi moi chay)
```

> Chuyển xong thì **mất đường đọc `_nhip.txt` từ laptop** (máy đó chỉ chia sẻ `Users` và `Downloads`).
> Đổi lại `.env` không còn nằm chỗ ai cũng ghi được. Sổ vẫn đọc được ngay tại máy đó.

---

## 4. Laptop `HSK-KHO170-TAML` — nay chỉ còn là lớp phụ

Đã cài 21/08/2026 bằng `CAI-CO-CHO.bat`. Sau khi agent trên máy in chạy được thì phần này **không
còn nằm trên đường tới hạn** nữa, nhưng giữ lại vẫn có ích:

- **Đánh thức máy in bằng Wake-on-LAN.** Đây là đường **duy nhất** để một máy bật hộ máy kia bằng
  phần mềm: gói *magic packet* 102 byte gửi UDP broadcast (cổng 9 và 7), card mạng bên kia nghe được
  cả khi Windows đã tắt — nếu BIOS + driver cho phép (§3.2). MAC **tự học từ bảng ARP** mỗi lượt
  thấy máy in còn sống (`.co-cho-mayin-mac.txt`, hiện `172.16.0.113 3C-64-CF-55-21-B0`) — học lúc nó
  **đang bật** là cách duy nhất, máy tắt thì ARP không còn dòng nào. Chỉ đánh thức trong khung
  **06:30–19:30**, tối đa 5 phút một lần: không có khung giờ thì cứ 2 phút một lần suốt đêm mình
  dựng dậy cái máy người ta vừa cố ý tắt — đó là phá, không phải chữa.
  - **"Còn sống" đo bằng cổng 445, KHÔNG ping, và phải trượt HAI LƯỢT LIỀN mới kết luận.** Bẫy này
    cắn ngay hôm dựng: 09:38:07 ping trượt → gửi WoL, trong khi chính máy đó nhận việc in bình thường
    lúc 09:39. ICMP trên laptop chập chờn thật (`Test-Connection` từng trả *"Error due to lack of
    resources"*). Cùng luật "2 lượt liền" mà `in-tem-agent.mjs` đang dùng (`_mcLoiLien`).
- **Agent dự phòng.** `pr_lay` bên GAS chạy trong `LockService.getScriptLock()` nên **hai agent cùng
  chạy không bao giờ in đôi** — mỗi lệnh chỉ một agent giành được. Ai giành trước thì in. Muốn máy in
  là đường duy nhất (nhanh hơn: in nội bộ ~2s thay vì qua share ~10s), tắt agent laptop:
  ```powershell
  Disable-ScheduledTask -TaskName 'Factory agent in tem'
  ```
  **Chỉ tắt sau khi đã thấy tem ra từ agent trên máy in.**
- Hai task `Factory co cho may tram` (đăng nhập · cắm/rút sạc · thức dậy · lặp 2′) và
  `Factory co cho bat may sang` (06:50, có `WakeToRun`) + `CO-CHO-MAY-TRAM.ps1` tự chữa agent/
  spooler/máy in phía laptop.
- Hai phát hiện lúc cài, đáng nhớ: `RTCWAKE` trên laptop trước đó là **0 = Disable** ⇒ **mọi hẹn giờ
  đánh thức từ trước tới nay không bao giờ nổ** (đã mở); và `Register-ScheduledTask` **cần nâng
  quyền** dù tài khoản là Admin (token bị UAC lọc) — câu *"KHÔNG cần Admin"* trong `SETUP-PC-MOI.ps1`
  là sai với máy này.
- Mục **tự đăng nhập Windows** trên laptop **chưa bật**: nếu vẫn muốn laptop tự chạy đủ 8 task nền
  sau khi tự bật thì cần nó (máy bật mà không đăng nhập thì task kiểu *Interactive* không chạy).
  Với riêng chuyện **in tem** thì không còn cần nữa — agent đã sang máy in.

---

## 5. Cái cò chờ **không** làm được

- **Máy tắt hẳn mà BIOS không có** *Restore on AC Power Loss* / *Wake on LAN*: chịu. Đó là lý do
  §3.2 đứng trước §3.3 chứ không phải ngược lại.
- **Mất mạng ra Internet** ở máy in: hàng đợi nằm trên Apps Script của Google. Script kiểm ngay lúc
  cài và nói thẳng nếu không ra được.
- **Hết giấy, mở nắp, kẹt giấy**: agent báo đúng (`NHAN-DIEN-SKU.md` §12.5–12.6) nhưng phải có người
  ra xử lý.
- **Cách rẻ nhất vẫn là đừng tắt máy in — chỉ khoá màn hình.** Cò chờ là lưới an toàn cho mất điện,
  ai đó bấm tắt, máy sập.

---

## 5a. NGHIỆM THU 21/08/2026 — chuỗi "bật máy → agent → máy in sẵn sàng" đã chạy thật

Đọc từ gương nhịp tim `C:\Users\Public\_nhip-mayin.txt`, hai lượt liền kề quanh lần tắt/bật thật:

```
13:36:04  agent=pid 11324  chu=DESKTOP-JE75K38\Admin
   (13:38 KHONG CO NHIP — may dang tat)
13:40:13  agent=pid 11972  chu=NT AUTHORITY\SYSTEM
13:42:05  agent=pid 11972  chu=NT AUTHORITY\SYSTEM   agentLog: [13:40:27] ✓ máy in đã ổn: sẵn sàng
```

Ba dấu hiệu **cùng lúc**, không cái nào giải thích được bằng cách khác:

| Dấu hiệu | Chứng minh điều gì |
|---|---|
| **Mất lượt nhịp tim 13:38** + **pid đổi** 11324 → 11972 | máy đã **thật sự tắt rồi bật lại** (không phải chỉ khởi động lại tiến trình) |
| Agent mới **chủ là `NT AUTHORITY\SYSTEM`** | trigger **AtStartup** của task SYSTEM đã dựng nó — **không phải** do ai đăng nhập (agent do người khởi động sẽ mang tên tài khoản đó, như `pid 11324` ở dòng trên) |
| `[13:40:27] ✓ máy in đã ổn: sẵn sàng` | agent lên xong và bắt tay được với máy in, trong **~1–2 phút** kể từ lúc máy bật |

⇒ **Câu hỏi "máy có mật khẩu đăng nhập thì in có bị gián đoạn không" đã có câu trả lời bằng thực
nghiệm: KHÔNG.** Không ai đăng nhập, đường in vẫn tự dựng lại.

Thứ duy nhất nhịp tim **không** phân biệt được: máy **tự bật khi có điện** (`AC BACK`) hay **có người
bấm nút nguồn**. Windows không ghi lại "ai bật máy". Muốn chắc `AC BACK` thì phải để ý lúc cắm điện
lại: máy tự lên là ăn, phải bấm nút mới lên là chưa. `Resume by Alarm 07:15` thì sáng hôm sau nhìn
nhịp tim là biết.

## 5b. QC từ xa — bật bằng một file cờ

Máy in chưa mở WinRM nên từ laptop không chạy lệnh được. Nhưng **task SYSTEM đã chạy sẵn mỗi 2 phút**,
còn thư mục gói thì đọc/ghi được qua SMB — mượn tay nó làm QC hộ:

```powershell
# BẬT: tạo file cờ (từ laptop, qua SMB)
Set-Content '\\Desktop-je75k38\Users\Public\AuditFactory\hasaki\_QC.txt' 'chay QC'
# ĐỌC: lượt chạy kế tiếp (≤2 phút) ghi ra rồi tự xoá cờ
Get-Content '\\Desktop-je75k38\Users\Public\AuditFactory\hasaki\_QC-KETQUA.txt'
```

Soi 8 mục: **A** tiến trình agent (đúng 1 con? chủ là ai? dòng lệnh có `--may` đúng không?) · **B**
task (principal, **có trigger AtStartup không**, kết quả lần chạy cuối) · **C** spooler + recovery +
cả hai queue PE200 + job kẹt + **thử mở máy in bằng đúng đường agent dùng, không tốn tem** · **D**
node/`.env`/mốc `PR-TEM`/dung lượng đĩa · **E** **dựng thật một con tem** (`--thu`, không in) · **F**
DNS + HTTPS tới Apps Script · **G** đếm dòng lỗi trong sổ agent · **H** nguồn + 10 lần bật/tắt gần nhất.

**Kết quả QC 21/08/2026 12:52 — không còn cảnh báo nào:**

| Mục | Kết quả |
|---|---|
| Agent | đúng **1** con, `pid 6808`, chủ **`NT AUTHORITY\SYSTEM`**, lệnh `--dich-vu --may "TSC PE200 (Copy 1)"` |
| Task | `Running`, principal **SYSTEM (ServiceAccount)**, **có `MSFT_TaskBootTrigger`** + lặp `PT2M` |
| Spooler | `Running` / `Auto` + tự bật lại 3 lần × 5 giây |
| Máy in | cả 2 queue `Normal`, không Offline, không job kẹt; mở thử `OK mo` |
| Môi trường | node `v24.16.0` (bản đi kèm), `.env` đủ 2 khoá, mốc `PR-TEM` **có**, ổ C còn 157 GB |
| Dựng tem thử | **dựng được** TSPL 38558 byte (sharp + lõi PR-TEM chạy tốt) |
| Mạng | DNS ok, **HTTP 200** tới `script.google.com` |

**Ba việc QC phát hiện được mà nhìn bằng mắt không thấy:**

1. **Phép thử khởi động đã tự xảy ra.** Máy **BẬT lúc 12:32**, agent `pid 6808` *"sống 19 phút"* lúc
   12:52 ⇒ lên lúc **~12:33**, và **chủ là SYSTEM** ⇒ đúng là task SYSTEM dựng nó, không phải ai đăng
   nhập. Rồi `[12:37:55] ✓ đã in 2 tem trong 6.1s`. **Chuỗi bật máy → agent → in tem đã chạy thật.**
2. **07:55 có `Kernel-Power 41` (mất điện đột ngột), 07:56 máy BẬT LẠI.** Một phút — nhanh hơn mức
   một người đi tới bấm nút, nên nhiều khả năng **`AC BACK` trên máy đó đã là `Always On` sẵn**. Vẫn
   nên vào BIOS xác nhận, nhưng đây là dấu hiệu tốt.
3. **3 lần `fetch failed` / 51 dòng sổ** (10:34 do chính script reset card mạng — đã vá; 12:04 hai lần
   liền là **Wi-Fi USB rớt**). Không chết người (vòng quét sau tự gọi lại), nhưng **cắm dây mạng
   thay cho USB Wi-Fi là cải thiện thật** — và mở luôn được đường Wake-on-LAN.

**Hai bẫy PowerShell đã cắn khi viết QC, ghi lại để khỏi mất giờ lần sau:**

- **`R` là ALIAS sẵn có của `Invoke-History`, và trong PowerShell alias THẮNG function.** Đặt tên hàm
  ghi log là `R` thì cả 71 lời gọi chạy vào `Invoke-History` rồi hỏng **im lặng** (vì
  `$ErrorActionPreference = 'SilentlyContinue'`) — file kết quả chỉ còn 3 byte BOM. Đổi tên thành
  `QG` là xong. Kiểm nhanh trước khi đặt tên hàm ngắn: `Get-Command R`.
- **`Select-String -SimpleMatch -Quiet` báo KHÔNG THẤY mốc `/*<PR-TEM>*/`** trong khi mục ngay dưới
  dựng tem thành công từ chính file đó. Đọc thẳng `[IO.File]::ReadAllText(...).Contains(...)` thì
  đúng. Một **cảnh báo giả còn tệ hơn không cảnh báo** — lần sau không ai tin bảng QC nữa.

---

## 6. Kiểm chứng

```powershell
# ── TRÊN MÁY IN (Desktop-JE75K38) ────────────────────────────────────────────────
cd C:\AuditFactory\hasaki

# 1. Xem trước, không sửa gì
powershell -ExecutionPolicy Bypass -File .\_CO-CHO-MAY-IN.ps1 -ChiDoc

# 2. Agent có đang chạy không
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -like '*in-tem-agent*' } | Select-Object ProcessId, CreationDate

# 3. Task SYSTEM
Get-ScheduledTask -TaskName 'Co cho may in tem' | Get-ScheduledTaskInfo

# 4. Dựng thử một con tem bằng node.exe đi kèm — KHÔNG in, không tốn tem
..\node.exe .\in-tem-agent.mjs --thu "422430797x2"

# 5. Sổ
Get-Content .\.in-tem-agent.log -Tail 20

# ── PHÉP THỬ THẬT, đúng cái người dùng quan tâm ──────────────────────────────────
#   TẮT LAPTOP, chỉ để máy in bật → bấm "Xác nhận in" trên dashboard → tem phải ra.
```

---

## 7. Liên quan

- `TAO-GOI-MAY-IN.mjs` — dựng gói mang sang máy in.
- `NHAN-DIEN-SKU.md` §12.5–12.6 — đường in tem, 4 bẫy đã cắn.
- `LICH-VA-DU-PHONG.md` §A2 — bảng task, nguồn duy nhất của lịch chạy.
- `_BAT-WINRM-MAY-IN.ps1` — mở WinRM chỉ-đọc trên máy in (hiện **chưa mở**: cổng 5985 đóng). Mở thì
  laptop mới chẩn đoán được máy đó từ xa; không mở vẫn chạy được cò chờ.
