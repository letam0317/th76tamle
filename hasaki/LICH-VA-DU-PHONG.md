# LỊCH CHẠY & DỰ PHÒNG KHI MẤT API — nguồn duy nhất

> Soát 30/07/2026 bằng cách đọc code **và** truy vấn Task Scheduler thật trên máy.
> Mọi bảng lịch trong `HUONG-DAN-VAN-HANH.md`, `PHAN-TICH-HE-THONG.md`, `CHUYEN-MAY-PC.md`
> là **lịch cũ giữ lại để đối chiếu**. Khi khác nhau, tin file này.
>
> **Thiết kế "dữ liệu luôn tươi" đang chốt: đọc PHẦN F.** Phần E là bản nháp 1 đã bị thay thế.

---

## PHẦN A — LỊCH ĐANG CHẠY

### A1. Ba tầng

```
Tầng 1  Task Scheduler (8 task, 7 bật)  — mốc cố định trong ngày ("5S Task hang ngay" tắt 19/08)
Tầng 0  Kênh tin nhắn (Telegram) mỗi 2' — người ra lệnh tay từ điện thoại, KENH-TIN-NHAN.md
Tầng 2  watch-login-request.js mỗi 2'   — trục thần kinh: cờ + guard + poller + sổ phiên
Tầng 3  từng script nguồn               — tự tuân session-rules (token sống, khung chặn, hash-skip)
```

### A2. Task Scheduler (khớp `SETUP-PC-MOI.ps1` sau khi sửa 30/07)

| Task | Lịch | Chạy gì | Ghi log |
|---|---|---|---|
| **5S Dong bo dashboard** | **08:40**/ngày | `AUTO-EXPORT.bat` → `auto-export-sync.js` rồi `SYNC-STOCK.bat` (**8 bước**: stocklocation · kiemke · tonbatthuong · sku-master · vesinh-all · phancong · vesinh-factory · vesinh-ai — đối chiếu audit 23/08/2026, doc cũ ghi 5) | `auto-export.log` + log từng bước |
| **5S Cham cong** | **07:20**/ngày | `pull-timesheet.js` → tab `NHAN-SU` | `cham-cong.log` |
| **Day bao cao 5S** | mỗi **15'** | `push-5s-to-workflow.js` (chiều **GHI**: inbox 5S → task WF 591) | `day-bao-cao-5s.log` |
| **5S Canh yeu cau dang nhap** | mỗi **2'** | `watch-login-request.js` | stdout task |
| **5S Tra UID tren Sheet** | mỗi **1'** (đo task thật 23/08/2026 — doc cũ ghi 2'; mỗi lượt ở lại ~51s, nhịp canh trong lượt **10s** từ 23/08) | `tra-uid-sheet.mjs` (file Sheet "TRA UID") | `tra-uid.log` |
| **Factory agent in tem** | mỗi **5'** (bổ sung vào bảng 23/08/2026 — task đã chạy từ trước mà A2 thiếu; agent CHÍNH nay ở `Desktop-JE75K38`, task này là lớp phụ trên laptop) | `_AGENT-IN-TEM-AN.vbs` → `in-tem-agent.mjs --dich-vu` | `in-tem-agent.log` |
| **5S Kenh tin nhan** | mỗi **2'** (mỗi lượt long-poll ~100s) | `tin-nhan-bot.mjs` — nghe lệnh Telegram cho cả 2 dự án (`KENH-TIN-NHAN.md`); chưa có token thì thoát êm | `tin-nhan.log` |
| **Factory watchdog ton kho** | logon **+5'** và mỗi giờ **07:05→18:05** | `sync-guard.js` (vá bước còn cũ — từ 31/07 gọi `AUTO-EXPORT.bat` nên vá được cả bước 5S) | `sync-guard.log` |
| **Factory co cho may tram** | logon · **cắm/rút sạc** (Kernel-Power 105) · **máy thức dậy** (Power-Troubleshooter 1) · mỗi **2'** | `co-cho-hidden.vbs` → `CO-CHO-MAY-TRAM.ps1` — dựng lại agent in tem khi nó chết/treo, gỡ Offline·Pause·job mắc của máy in, áp lại cài đặt nguồn 1 lần/ngày (`CO-CHO-MAY-IN.md`) | `.co-cho.log` + `.co-cho.json` |
| **Factory co cho bat may sang** | **06:50**/ngày, **được đánh thức máy** | cùng script — task RIÊNG vì `WakeToRun` là thuộc tính của cả task, gắn chung vào nhịp 2' thì máy bị dựng dậy 720 lần/ngày | như trên |
| ~~**5S Task hang ngay**~~ | **ĐÃ TẮT 19/08/2026** (Disabled) | Thay bằng **NÚT BẤM TAY** `NUT-NOP-TASK.bat` → `task-hangngay.mjs --nut` (làm tươi số liệu nếu mốc cũ → in nháp → HỎI rồi mới nộp). Không bấm = người tự bấm Hoàn thành trên work.hasaki.vn | `task-hangngay.log` |

Vì sao 08:40 chứ không 07:00: máy hay bật muộn, task "chạy bù" dồn vào giữa giờ làm và đụng
khung chặn re-login `07:45–18:00` → cụm hoãn trong im lặng (sự cố 22/07).

**Chốt 21/08/2026 — "máy hay bật muộn" nay có số đo, và có cò chờ.** Event 1074 mười ngày gần nhất
cho thấy nếp *tắt máy cuối ngày, bật khi tới nơi*: 12/08 17:22 · 13/08 13:26 · 14/08 17:52 ·
15/08 12:26 · 17/08 18:07 · 21/08 00:32. Sáng 21/08 kho bấm in từ **07:57** mà máy tới **09:00:31**
mới bật → 5 lệnh in nằm chờ hơn một tiếng, và **mọi task trong bảng này cũng nằm im trong khoảng
đó**. Đêm đó **cả `Desktop-JE75K38` (máy cắm máy in) cũng tắt** — lượt đọc cuối còn thấy máy chủ in
là 20:33:30, sau đó 22 lượt liền chỉ còn bản cache cục bộ. Tức là đường in tem cần **HAI máy cùng
bật**, và đêm 20/08 mất cả hai.

**Cách chữa đã chốt: ĐỔI CHỖ ĐỨNG CỦA AGENT, không chỉ vá lịch.** Agent nhặt lệnh in nay chạy **ngay
trên `Desktop-JE75K38`** bằng task **SYSTEM** (`_CO-CHO-MAY-IN.bat` trong gói `_GOI-MAY-IN`, dựng
bằng `node TAO-GOI-MAY-IN.mjs`) ⇒ **máy in bật là mọi lượt gửi in đều ra tem, không phụ thuộc laptop
này nữa** — máy đó cũng không cần ai đăng nhập, và không cần cài Node (gói mang theo `node.exe`).
Chi tiết + phần BIOS *Restore on AC Power Loss* / *Wake on LAN*: `CO-CHO-MAY-IN.md`.
Phía laptop còn 2 task cuối bảng này làm lớp phụ: tự chữa agent dự phòng và gửi **Wake-on-LAN** đánh
thức máy in trong khung 06:30–19:30 (`pr_lay` bên GAS chạy trong `LockService` nên hai agent cùng
chạy **không bao giờ in đôi**).
Hai phát hiện đi kèm: `RTCWAKE` trên laptop đang là **0 = Disable** (mọi hẹn giờ đánh thức từ trước
tới nay **không bao giờ nổ** — đã mở), và task nền của dự án đều kiểu *Interactive* nên **máy bật mà
không đăng nhập Windows thì không task nào chạy** (mắt xích tự đăng nhập, chưa bật).

**Chốt 19/08/2026 — nộp báo cáo 9 task hằng ngày chuyển sang NÚT BẤM TAY, bot không tự nộp nữa.**
Chủ máy giữ quyền "hoàn thành": *cần* thì bấm nút, *không cần* thì tự bấm Hoàn thành trên
work.hasaki.vn. Việc đã làm:

- `Disable-ScheduledTask -TaskName '5S Task hang ngay'` (nhịp 16:00 + lặp 30' đã tắt, task vẫn
  còn trong Task Scheduler để bật lại 1 dòng nếu đổi ý: `Enable-ScheduledTask -TaskName …`).
- Nút = `NUT-NOP-TASK.bat`, shortcut **NOP BAO CAO TASK (bam khi can)** ngoài Desktop → chạy
  `task-hangngay.mjs --nut`: làm tươi số liệu cũ (chỉ khi mốc > `TASK_TUOI_TOI_DA`, mặc định 120')
  → in bản nháp từng task → **hỏi**: `Enter` nộp cả · `a` chỉ nhóm A (số liệu thật, để việc tay tự
  báo cáo) · `k` không nộp. Bấm nhiều lần vô hại (task đã nộp tự bỏ qua).
- `--nut` **không bao giờ** nộp khi chạy nền (stdin không phải TTY) — "bấm nút" luôn nghĩa là có
  người thật bấm. `TASK-HANG-NGAY.bat` (không hỏi) vẫn còn cho lượt chạy tay/khi bật lại lịch.

Nhẹ tải hơn nhịp cũ: trước đây 16:00–18:00 làm tươi kiểm kê tới 5 lượt; nay 1 lượt/1 lần bấm, và
bỏ luôn nếu poller vừa kéo trong 120' hoặc không còn task nhóm A nào đang chờ.

**Vá 12/08/2026 — watchdog nay bám TUỔI DỮ LIỆU, không chỉ "đã chạy hôm nay chưa"** (sự cố 11/08,
mất trọn buổi chiều). `sync-guard.js` sửa 2 chỗ:

1. **Điều kiện CŨ.** Trước: chỉ `mốc < 08:40 hôm nay` ⇒ cụm chạy xong buổi sáng là cả ngày còn lại
   guard in *"✓ Dữ liệu đã mới — không cần làm gì"*, dù dữ liệu đã đứng 6 tiếng. Nay thêm vế
   **trễ > 90'** (dùng chung env `CANH_TRE_PHUT` với `canh-suc-khoe.js` để 2 tầng không lệch), chỉ
   xét trong **07:00–22:30** để máy lỡ bật qua đêm không dội cụm suốt đêm. Backoff 20' vẫn giữ.
   **SIẾT 23/08/2026 (audit):** guard TỰ Ý chỉ chạy cụm trong **07:00–18:00 các ngày T2–T7**
   (đo log 22-23/08: cụm 8 bước nổ 19:14/20:48/22:20 và cả 07:00 Chủ nhật — ngoài giờ không ai xem
   dashboard, chạy chỉ tốn WMS/wshr). Cửa đặt **đầu `main()`** nên tick ngoài giờ không tốn cả lượt
   soi tiến trình lẫn lượt gviz. `--force` (nút "Tải lại dữ liệu" / chạy tay) **vẫn chạy bất kể giờ**.
   `canh-suc-khoe.js` cũng hạ cửa báo động 19h → **18h** cho khớp (sau 18h dữ liệu CỐ Ý để cũ,
   báo động lúc đó là báo động giả). `cumDangChay` của guard + poller đổi **fail-open → fail-closed**
   (PowerShell lỗi = coi như CÓ cụm đang chạy, kèm log to — hết cảnh 2 tiến trình cùng ghi 1 tab).
2. **Cửa re-login.** Trước guard chỉ hỏi ĐỒNG HỒ (`duocPhepReLogin`, chặn 07:00–22:30), trong khi
   tầng dưới `chanReLoginNgoaiKhung` từ 30/07 đã chạy **LUẬT PHIÊN** (không phiên nào sống + đủ cửa
   im lặng ⇒ được login bất kể mấy giờ, vì không có ai để đá). Lệch 2 tầng ⇒ chiều 11/08 verdict ghi
   rõ *"bridge đã im 368' ≥ cửa 15' — ĐƯỢC login"* mà guard vẫn hoãn. Nay guard hỏi đúng
   `trangThaiPhien()`; verdict `khongro` (mất mạng/GAS) vẫn KHÔNG được coi là cớ để login.

Giới hạn còn lại: máy tắt ~19:00, bật ~08:30 ⇒ khoảng đêm vẫn không ai cứu được. Bản vá chỉ giành
lại phần **13:12→19:08** (~6h) của loại sự cố này.

**Vá 15/08/2026 — bản vá 12/08 mới đi được nửa đường: tầng GỌI đổi thước, tầng LÀM thì chưa.**
Sự cố 14/08: planogram đứng ở **15:38** tới hết ngày. Guard bắt bệnh đúng ("mốc cũ nhất 151' >
ngưỡng 90'") và giành được **ba lượt ĐƯỢC login** lúc 16:12 / 16:34 / 16:56 — đúng cửa sổ vàng
16:00→17:08 khi *không phiên nào sống* nên login không đá ai. Nhưng cụm vừa vào là mọi bước tự thoát
`✓ Bước … đã tươi hôm nay`: `boQuaNeuDaTuoi` vẫn định nghĩa tươi = **mốc ≥ 08:40 hôm nay**, mà mốc
của chúng đều sau 08:40. Cụm chạy **29 giây**, không kéo gì; guard đọc lại mốc bằng đúng thước cũ
(`mocMinMoi >= homNay840`) rồi in **✓ XONG**. Tới 17:10 bridge work/hr sống lại ⇒ luật phiên
(`trangThaiPhien` → "có người đang làm dù không mở WMS") cấm login ⇒ đứng luôn tới lúc tắt máy.

Đã sửa 2 chỗ, cùng một thước `CANH_TRE_PHUT` (mặc định 90') với guard và `canh-suc-khoe.js`:

1. `session-rules.js` → `boQuaNeuDaTuoi`: bước chỉ tự thoát khi **chính nó** trễ < 90'.
   Ý đồ cũ ("đừng kéo trùng cả cụm ~25' khi chỉ 1 bước hỏng") giữ nguyên — chỉ đổi thước đo.
2. `sync-guard.js`: kết luận sau khi chạy dùng lại đúng luật đã dùng để gọi (`conCu()`), thay cho
   `mocMinMoi >= homNay840`. **Báo thành công giả nguy hơn im lặng**: nó nuốt lượt login hiếm hoi
   và reset backoff 20' — 3 lượt cuối ngày 14/08 mất theo cách đó.

Bài học chung của cả hai lần: mỗi khi đổi định nghĩa "dữ liệu cũ" ở một tầng, phải soát **cả ba**
tầng THẤY (`canh-suc-khoe`) — GỌI (`sync-guard`) — LÀM (`boQuaNeuDaTuoi` trong từng bước).

**Vá 15/08/2026 (2) — VÉ ƯU TIÊN "phiên vừa sống lại": chính backoff của guard chặn lượt tươi đầu ngày.**
Yêu cầu vận hành: *mỗi sáng, ngay khi operator có phiên work/wms/planogram thì làm tươi liền bằng
bridge — tuyệt đối không đá phiên.* Cảnh hỏng sáng 15/08: 08:34 guard chạy khi mới chỉ mượn được
token **work/hr** (đủ 5S, 4 bước factory tự hoãn) → ghi mốc `LAN_VA` → phiên **WMS** lên lúc ~08:40
thì guard đã tự khoá mình sau backoff 20' tới 08:54; chỉ nhờ task lịch 08:40 mới cứu. Nếu operator
đăng nhập lúc 08:05 hay 09:15 thì không có gì cứu — phải chờ tick giờ kế tiếp.

Cơ chế mới trong `sync-guard.js`:

- **Đảo thứ tự**: dò token **trước** backoff (phải biết kênh nào vừa sống thì mới cấp vé được).
  Không tốn thêm gì đáng kể — `sync-poller.js` vốn đã `get-me` mỗi tick 2'.
- **Trạng thái phiên tick trước** lưu ở `.guard-phien-truoc.json` (`{wms, coPhien, veLuc}`).
  Kênh chết ở tick trước mà sống ở tick này ⇒ **1 vé** đi thẳng, bỏ qua backoff.
- **Chống phiên chập chờn**: hai vé phải cách nhau ≥ **10'** (`VE_UU_TIEN_MS`).
- **Vé không mở đường login**: tới nhánh đó đã có token sống nên `nguon` luôn là token *mượn*.
  Luật phiên (`trangThaiPhien`) không bị nới một ly.
- Nhịp phủ: watch-login-request gọi guard mỗi **2'** ⇒ operator đăng nhập lúc nào, dữ liệu bắt kịp
  trong ≤2' lúc đó — không còn phụ thuộc mốc 08:40 hay tick giờ.

Kiểm chứng bằng cờ mới `node sync-guard.js --thu` (chạy khô: in phán quyết, **không** spawn cụm,
không ghi mốc, không chiếm lock) — 3 kịch bản đã chạy thật 09:02 15/08:

| Kịch bản (tick trước → tick này) | Kỳ vọng | Thực tế |
|---|---|---|
| đã có phiên WMS → vẫn có | không vé, backoff chặn | `… chờ đủ backoff 20'` · exit 75 |
| không phiên nào → có phiên WMS | **cấp vé**, chạy bằng bridge | `⚡ Phiên WMS/planogram VỪA SỐNG LẠI` · exit 0 |
| vừa cấp vé <10' trước | không cấp tiếp | `… chờ đủ backoff 20'` · exit 75 |

### A3. Nhịp trong ngày — `sync-poller.js`, chỉ trong khung **08:45–18:00**

| Nguồn | Nhịp | Cơ chế tiết kiệm |
|---|---|---|
| Vệ sinh (`sync-vesinh-all.js`) | ≥ **15'** | bản thân rẻ (~7 call), 1 lượt quét sinh 4 tab. Từ 24/08/2026 kèm **báo Telegram 17h** "đi làm mà CHƯA báo cáo vệ sinh" (loại người vào ca từ 13:00) — `bao-vesinh-telegram.mjs` tự gác 1 tin/ngày ở lượt sync đầu tiên từ 17:00, dùng chính dữ liệu lượt quét nên **0 lượt gọi thêm** |
| Bảng phân công (`sync-phancong.mjs`) | đi kèm ngay sau bước vệ sinh | **không gọi WMS** (chỉ đọc g-sheet công khai + `readTab`) → không tốn quota, không đụng luật 1-phiên; hash-skip khi không đổi |
| AI xét ảnh (`sync-vesinh-ai.mjs`) | ≥ **30'** | thoát ngay nếu không có request "Chờ duyệt" |
| Kiểm kê (`push-pc-to-sheet.mjs`) | ping ≥ **10'** (khi mốc ≥30') | **ping 4 call size=1** → marker `count@updated_at` đổi mới kéo `PC_DELTA=1` |
| Tồn mã vị trí + tồn bất thường | slot **12:15 / 17:00** (cửa 90') | cộng lượt 8:40 = **3 lần/ngày** |
| **5S (`auto-export-sync.js`)** | ≥ **45'** (thêm 31/07) | đi cổng **wshr**, chạy cả khi không có token WMS; `KHONG_LOGIN=1` → hết phiên thì exit 75, thử lại sau 10' |

Ngoài khung: lượt 8:40 lo buổi sáng, watchdog 18:05 là lượt vét cuối ngày.

### A4. Nguồn → endpoint → tab

| Hệ thống | Endpoint chính | Script | Tab đích |
|---|---|---|---|
| WMS tồn vị trí | `report-management/stock-locations/bins/count/v3` | `sync-stocklocation.js` | `mastige`, `garment` |
| WMS kiểm kê | `counting-plan/checklists/type-sku\|type-location` + `checklist/tracking` | `push-pc-to-sheet.mjs` | `kiemke-*`, `kiemke-uidgr` |
| WMS tồn bất thường | `report-management/stock-inventories` | `sync-tonbatthuong.js` | `stock-inventory-beta\|-hasaki` |
| WMS **tồn tại vị trí** (UID **vải** chưa khai báo UID group mà đã rời bãi chờ `F0-A0-00-00-00-00`; chỉ 2 kho `WH - MATERIAL - MTG` + `WH - MATERIAL - GARMENT`, trừ vị trí tiền tố `F0-KHO-HM`) | `report-management/report-inventories` (mức UID, `category_ids=463`, header `Company-Ids`) | `ton-vitri.mjs` — chạy **ké bước cuối** của `sync-tonbatthuong.js`, không có lịch riêng · ~66 lượt gọi/lần | `ton-vitri` |
| Planogram vệ sinh | `wms-gw-external` request-of-declaration | `sync-vesinh-all.js` | 4 tab `VESINH-*`, `PHU-TRACH-*` |
| Phân công phụ trách | g-sheet gốc của bộ phận (gid `341809457` + `584257479`) + bù từ `PHU-TRACH-QUAY-KE` | `sync-phancong.mjs` | `VESINH-PHANCONG` |
| work 5S | `api/hr/excel-io` (queue → poll → tải file) | `auto-export-sync.js` | `5S-TASKS` |
| HR chấm công | `api/news/staff/...`, `api/hr/timesheet` | `pull-timesheet.js` | `NHAN-SU` |
| Tra UID theo yêu cầu | `report-management/report-inventories?uids=` (header `Company-Ids`) | `tra-uid-sheet.mjs --dien` — task **"5S Tra UID tren Sheet"** mỗi 2' (TRA-UID.bat) + bước dự phòng đầu `watch-login-request.js` | `TRA-UID` (file riêng `1a_lsYf…x08U`) |

Cửa ghi **duy nhất** là Apps Script webhook (`action=syncTasks`). Dashboard đọc Sheet qua
gviz/`readTab` — **không dashboard nào gọi WMS trực tiếp**. Đây là tính chất quyết định ở Phần B.

**Tab TỔNG HỢP (15/08/2026) — 2 tab dẫn xuất, 0 lượt gọi WMS.** Cộng ngay trên dữ liệu đã có trong
RAM của chính lượt sync, ghi thêm 1 gói nhỏ:

| Tab tổng | Do ai ghi | Thay cho | Kích thước |
|---|---|---|---|
| `stockloc-tong` | `sync-stocklocation.js` | `mastige` + `garment` | **6 KB** (84 dòng) ← 12,6 MB |
| `<tab>-tong` (`stock-inventory-beta-tong`, `stock-inventory-hasaki-tong`) | `sync-tonbatthuong.js` | tab thô tương ứng | **2,5 KB** (34 dòng) ← 21,7 MB |

Dashboard vẽ **màn hình chính** từ tab tổng; **chi tiết từng dòng chỉ nạp khi mở pop-up**. Tab tổng
thiếu/hỏng ⇒ mọi dashboard tự lùi về đọc tab thô (đường cũ giữ nguyên từng dòng).

Hai điểm phải nhớ khi sửa về sau:
- Ghi tab MỚI **không cần deploy GAS**: `apiSyncTasks` tự `insertSheet`; whitelist `SERVE_PRIVATE_TABS`
  chỉ áp cho tab đọc qua `readTab` ở sheet private.
- Tab tổng của tồn bất thường có dòng **`__all__` mỗi kho = TỔNG SỐ DÒNG**. Dashboard lấy
  `nSku = rows.length` và `byWh[wh].n` (đếm DÒNG); cộng SkuCount của 6 loại sẽ **đếm trùng** vì một
  dòng vướng được nhiều loại. Đã kiểm mỗi cặp (SKU, kho) là DUY NHẤT nên đếm dòng ≡ đếm SKU — nếu
  WMS đổi cách phát hành thì phải kiểm lại chỗ này trước tiên.

### A5. Luật phiên (`session-rules.js`) — nền của mọi nhịp

1. **get-me là trọng tài duy nhất** — không vứt token theo tuổi.
2. Thứ tự token: kho `.wms-session` → **bridge** (token phiên sống của operator, extension đẩy
   qua GAS) → cuối cùng mới SSO headless.
3. Re-login SSO **bị chặn 07:45–18:00** (WMS 1 phiên/tài khoản → re-login = đá người đang làm)
   → ném `DeferError` → exit **75 "hoãn"** → guard thử lại.
4. `fetchThuLai` retry 4 lần (2s→6s→18s) cho 5xx/429.
5. **Hash-skip**: payload không đổi → không ghi Sheet, chỉ `touchTabs` để chip giờ vẫn chạy.
6. Mốc từng bước `.sync-ok-<bước>` → guard chạy lại **đúng bước hỏng**, không kéo lại cả cụm ~25'.

### A6. Cảm biến sức khoẻ — `canh-suc-khoe.js` (guard gọi cuối mỗi tick, mỗi giờ 07:05→18:05)

| Cảm biến | Ngưỡng | Ghi chú |
|---|---|---|
| Mốc từng bước dừng | **26 giờ** | Bắt ca chết cả ngày. Cố ý thô để không báo giả buổi sáng máy bật muộn. |
| Cầu dao đăng nhập | ≥3 lượt IdP từ chối | Bắt buộc gọi người — thử thêm là tiến tới khoá tài khoản. |
| **Cầu nối (extension)** | tắt/chưa cài | **Mới 11/08/2026** — đọc thẳng profile Edge (`trang-thai-bridge.js`). |
| **Trễ trong ngày** | mốc vệ sinh > **90'** (`CANH_TRE_PHUT`) | **Mới 11/08/2026** — đo đúng cái người dùng thấy; kèm chẩn đoán nguyên nhân. |

Chỉ mở sự cố trong **7h–19h**, **không Chủ nhật**. Chi tiết + khuôn thư: `TU-CHUA-LANH.md`.
Tầng tự chữa lành **đã bật 11/08/2026** (GAS @51, `caps.tuChua = true`) — trước đó mọi lời gọi
`moSuCo` đều im lặng bỏ qua, nên 5 tiếng dữ liệu đứng chiều 11/08 không sinh ra thư nào.

**⛔ 15/08/2026 — THƯ CẢNH BÁO ĐÃ TẮT** (`CANH_GUI_THU=0` trong `.env`, theo yêu cầu vận hành).
Cảm biến vẫn chạy đủ và vẫn in `⛔` vào `sync-guard.log`; **chặn ghi rác vẫn hoạt động**; chỉ
`moSuCo`/`dongSuCo` trong `tu-chua.js` trả `null` ngay, không chạm GAS. `nhipTim` **cố ý giữ** vì nó
là thứ *ngăn* thư "máy trạm im" chứ không phải thứ gửi thư. Bảng dưới vì vậy nay là **danh sách
những gì vẫn được PHÁT HIỆN**, không còn là danh sách thư sẽ nhận. Soi tay: `node canh-suc-khoe.js --xem`.

---

## PHẦN B — NẾU MỘT NGÀY WMS / PLANOGRAM / WORK / HR KHÔNG CHO GỌI API

### B1. "Không cho gọi API" có 5 kiểu rất khác nhau

Phản ứng đúng phụ thuộc kiểu chặn, nên phải phân loại trước khi chữa.

| # | Kiểu chặn | Dấu hiệu | Cái gì **vẫn** sống |
|---|---|---|---|
| 1 | **Siết phiên** (đã xảy ra 21/07: 1 phiên/tài khoản) | get-me 401 ngay sau khi người khác đăng nhập | Phiên của operator → **bridge** |
| 2 | **Anti-bot ở cửa đăng nhập** (CAPTCHA/Turnstile, chặn headless, device binding) | login tự động kẹt ở SSO; người thật đăng nhập bình thường | Mọi API — chỉ mất khả năng **tự** lấy token |
| 3 | **Rate limit / WAF trên endpoint** | 429; 403 trả HTML thay JSON; chết đúng lượt FULL ~220 call | API ở nhịp thấp; UI của người thật |
| 4 | **Đổi/bỏ endpoint, thêm signature-nonce** | 400/404 hàng loạt sau một đợt deploy WMS | UI, chức năng Export |
| 5 | **Chính sách: cấm automation / khoá tài khoản** | thư IT, tài khoản bị vô hiệu | Không còn đường kỹ thuật hợp lệ → **chỉ** kênh được cấp phép |

Kiểu 1–4 là kỹ thuật, chữa được bằng bậc thang B3. Kiểu 5 **không** chữa bằng kỹ thuật.

### B2. Ba tài sản khiến hệ này khó chết hẳn

1. **Ranh giới nạp/đọc rất sạch.** Dashboard đọc Sheet, không đọc WMS. Mọi kênh nạp mới chỉ cần
   POST đúng `syncTasks` với đúng header tab là **dashboard sống nguyên, không sửa một dòng**.
2. **Hợp đồng dữ liệu đã tồn tại** dưới dạng `HEADER_*` trong từng script (`HEADER_SKU`,
   `HEADER_LOC`, `HEADER_UIDGR`, `HEADER_YC`, `HEADER_NK`…). Thay nguồn = viết adapter trả đúng
   mảng cột đó.
3. **Kho tích luỹ không phụ thuộc API**: `.exports/tasks-cache.json` (task terminal đóng băng),
   `nhansu-cache.json` (NV đã nghỉ vẫn giữ), `.pc-cache.json`, `ai-vesinh-cache.json`,
   `.doi-soat-cache*.json`. Mất API hôm nay → lịch sử vẫn còn, dashboard không trắng.

### B3. Bậc thang 5 kênh dự phòng

#### P0 — Thu động qua extension (bền nhất về kỹ thuật; **đã có 80% hạ tầng**)
`factory/wms-bridge/wms-main-hook.js` đã hook `fetch` + `XMLHttpRequest` ở MAIN world trên
`wms.inshasaki.com` và hiện chỉ báo về **token**. Nâng cấp: với các URL trong whitelist, đọc luôn
**response body** rồi POST theo lô lên GAS.

- **Vì sao bền:** không tạo thêm một request nào — chỉ nghe dữ liệu mà operator *đã* tải khi làm
  việc bình thường. Miễn nhiễm rate-limit, WAF, anti-bot, và không thể đá phiên ai.
- **Chống được:** kiểu 1, 2, 3, và phần lớn kiểu 4 (endpoint đổi thì hook cứ nghe endpoint mới).
- **Giới hạn thật:** chỉ có dữ liệu ứng với **trang operator mở**. Cần "kịch bản đi tuần" — mỗi
  sáng mở 5 trang có bộ lọc lưu sẵn (~1 phút), hoặc chấp nhận dữ liệu theo đúng việc họ làm.
- **Cần làm:** whitelist URL + giới hạn kích thước lô + nén; GAS thêm action nhận payload thô
  (khoá riêng, **không** dùng SECRET 5S); một bộ chuyển payload → header tab dùng lại code hiện có.

#### P1 — Export chính chủ (file do hệ thống tự sinh)
Đây là chức năng **của người dùng**, thường sống sót lâu hơn API list.
- **work 5S: đường lùi còn nguyên** — `sync-board-to-sheet.js` đọc file
  `Board-task-workflow-step-*-591-*.xlsx` mới nhất trong Downloads → parse → GAS. Bấm Export trên
  UI rồi chạy `DONG-BO-TASK.bat` là xong. Đây là kênh dự phòng **đã kiểm chứng chạy thật**.
- **Kiểm kê:** đã có `export-pc.mjs`, `pc-whcode-template.mjs` (`download-template/type-sku`).
- **WMS report:** cần **xác minh một lần** hai báo cáo `stock-location` và `stock-inventories`
  có nút Export không, rồi ghi kết quả vào chính file này. Chưa xác minh thì đừng coi là có.
- **Chống được:** kiểu 2, 3, 4. Không chống được kiểu 5.

#### P2 — Đọc UI/DOM trên phiên người thật (Puppeteer, không headless)
Điều khiển trang, đọc bảng render, phân trang. Mẫu có sẵn ở `capture-*.mjs`.
Chậm (~vài phút/báo cáo), **vỡ mỗi lần WMS đổi UI**. Chỉ dùng làm cầu tạm vài ngày trong lúc dựng
P0/P1, đừng đưa vào lịch dài hạn.

#### P3 — Kênh được cấp phép (bền nhất về tổ chức; là đích đến thật)
Xếp theo mức dễ được IT duyệt:
1. **File drop định kỳ** — WMS/HR xuất CSV/Excel hằng ngày lên SFTP / Google Drive / email nội bộ,
   mình chỉ đọc file. Dễ duyệt nhất vì **không mở thêm API**, không cấp token cho ai.
2. **Service account scope hẹp** — client_credentials, chỉ vài endpoint read-only, IP allowlist.
   Hết hẳn chuyện "1 phiên/tài khoản" và đá phiên operator.
3. **Read replica / view / data warehouse** — nếu Hasaki có DWH thì đây là đường xịn nhất: hết lo
   phiên, hết lo UI đổi, kéo được lịch sử sâu.
- **Chống được: cả 5 kiểu.** Nên xin **trước** khi bị chặn — lúc đã bị chặn là thương lượng ở thế yếu.

#### P4 — Tự thu tại nguồn (độc lập hoàn toàn)
Một phần dữ liệu 5S **đã** tự thu (form 5S → GAS → Sheet + Drive, không qua WMS). Nếu planogram
đóng hẳn, chuyển "yêu cầu vệ sinh / nhật ký" sang form tự thu; kiểm kê có thể nhập bằng app quét
tem. Mất tính "một nguồn sự thật" (số của mình ≠ số WMS) nhưng vận hành không đứng.

### B4. Kiểu chặn → dùng kênh nào

| Kiểu chặn | P0 thu động | P1 export | P2 UI | P3 cấp phép | P4 tự thu |
|---|---|---|---|---|---|
| 1 siết phiên | ✅ đang dùng | ✅ | ✅ | ✅ | – |
| 2 anti-bot đăng nhập | ✅ **chính** | ✅ | ⚠️ cần người mở | ✅ | – |
| 3 rate limit / WAF | ✅ **chính** | ✅ | ⚠️ | ✅ | – |
| 4 đổi/bỏ endpoint | ✅ | ✅ **chính** | ⚠️ | ✅ | – |
| 5 chính sách cấm | ❌ | ❌ | ❌ | ✅ **duy nhất** | ✅ |

### B5. Theo từng nguồn — cái nào đau, cái nào dễ

| Nguồn | Dự phòng sẵn sàng | Độ đau nếu mất | Ghi chú |
|---|---|---|---|
| work 5S | **P1 chạy được ngay** (`sync-board-to-sheet.js`) | thấp | mất tự động, còn 1 lần bấm Export/ngày |
| Kiểm kê | P0 + P1 (export-pc/template) | trung bình | dữ liệu vốn đã cache theo `checklist_id` |
| Tồn vị trí / tồn bất thường | P0; P1 **chưa xác minh** | trung bình | đổi chậm, 3 lần/ngày → chịu được kéo tay |
| HR chấm công | P1 (export hr) hoặc P4 | trung bình | chỉ cần "hôm nay ai đi làm" |
| **Planogram vệ sinh** | **chỉ P0/P4** | **cao nhất** | nhịp 15', gần như không có đường export → **ưu tiên chuẩn bị trước** |

### B6. Nên làm TRƯỚC (xếp theo giá trị / chi phí)

1. **Bộ phân loại lỗi kênh.** Hiện `fetchThuLai` chỉ retry 5xx/429 rồi ném — mọi thất bại trông
   như nhau. Cần phân biệt **mất mạng** / **401-403 (mất quyền)** / **429 (bị siết)** /
   **200 nhưng rỗng** / **trả HTML thay JSON (WAF-captcha)** và ghi một dòng vào log riêng. Rẻ,
   dùng được ngay hôm nay, và là điều kiện để biết mình đang ở kiểu chặn nào.
2. **Banner "dữ liệu đóng băng" trên dashboard.** Đã có chip `apiAt` + `touchTabs`; thiếu trạng
   thái "nguồn X mất kênh từ lúc …". Không có nó, người xem đọc số cũ mà tưởng số mới — đây là
   rủi ro **nghiệp vụ** lớn hơn bản thân việc mất API.
3. **Snapshot hằng ngày** ra `.exports/` (+ Drive): dựng lại Sheet được kể cả khi mất cả API lẫn
   Sheet. Hiện cache là cache *tăng dần*, không phải bản chụp có thể phát hành lại.
4. **Gom `HEADER_*` thành `schema-tabs.js`** + biến `NGUON=api|export|ui|passive` cho từng bộ →
   đổi kênh bằng biến môi trường, không viết lại script.
5. **Nâng extension lên P0 thu động** (bản nháp, mặc định tắt) — có sẵn thì lúc bị chặn chỉ cần bật.
6. **Xin IT kênh file drop (P3.1) ngay khi chưa bị chặn.**

### B7. Điều **không** nên làm

Không đầu tư vào né phát hiện automation: user-agent giả, proxy luân phiên, tự giải CAPTCHA,
nhiều tài khoản để lách giới hạn phiên. Ba lý do: (a) vỡ liên tục mỗi lần hệ thống đổi;
(b) đây là hệ thống nội bộ **của chính công ty** — đường đúng và rẻ hơn là xin quyền (P3);
(c) nếu đã tới kiểu chặn 5 thì việc lách là đi ngược quyết định của tổ chức, không phải bài toán
kỹ thuật. Toàn bộ P0/P1/P2 đều nằm trong phạm vi "dữ liệu người dùng đã có quyền xem, trên phiên
của chính họ" — giữ đúng ranh giới đó.

### B8. Thời gian phục hồi ước tính (RTO)

| Kênh | Dựng lần đầu | Mỗi lượt sau khi có |
|---|---|---|
| P1 work 5S (đã có) | 0 | ~2' (bấm Export + chạy bat) |
| P0 thu động | ~1–2 ngày | tự động, theo việc operator làm |
| P2 UI | ~0,5 ngày/báo cáo | ~vài phút/báo cáo, hay vỡ |
| P3 file drop | 1–3 tuần (chờ IT) | tự động, bền |
| P4 tự thu | ~1 ngày/nguồn | theo người nhập |

---

## PHẦN D — XÁC THỰC / OTP: DUY TRÌ LUỒNG LOGIN TỰ ĐỘNG

### D1. Hiện trạng đo được (30/07/2026, đọc log chứ không phỏng đoán)

- **09:27:44 hôm nay TOTP vẫn đăng nhập THÀNH CÔNG** (`day-bao-cao-5s.log`): SSO → chọn tài khoản →
  tick robot → gõ mật khẩu → Continue → **gõ OTP** → nạp kho token → tạo được 2 task thật.
  ⇒ Tại thời điểm log gần nhất, `HASAKI_2FA_SECRET` hiện tại **vẫn đúng**.
- **Lượt trượt 09:21 KHÔNG phải do OTP.** Cùng phút đó `day-bao-cao-5s.log` có
  `getaddrinfo ENOTFOUND script.google.com` — máy vừa boot, **mạng chưa lên**. Trang không tải được
  → trang lỗi của Edge (giữ nguyên URL, chỉ có nút **Refresh**, không ô nhập) → bot bấm "Refresh".
  Bằng chứng loại trừ: 6 phút sau, luồng mật khẩu + OTP chạy trơn — nếu IdP đã đổi sang QR/duyệt-app
  thì 09:27 không thể có bước "gõ mật khẩu → gõ OTP".
- IdP tự khai phương thức trên URL: `auth_methods=PASSWORD,SMS_OTP,TOTP&method_locked=1`
  (thấy trong log 27/07). **Đây là tín hiệu đọc được TRƯỚC khi gõ gì** — đã dùng làm cửa chặn (D3).

### D2. Cái gì thực sự mong manh

Chỗ dễ vỡ **không phải** thuật toán OTP — nó chỉ là 1 hàm `genOTP()` + 1 biến `.env`. Mong manh là
**phần bám giao diện IdP**: 27/07 đổi giao diện (tile tài khoản + checkbox robot) và 30/07 lộ thêm 2
lỗi tiềm ẩn. IdP đổi 2 lần trong 1 tuần ⇒ phải giả định còn đổi nữa.

### D3. Đã vá hôm nay trong `login-hasaki.js`

1. **Báo "thành công" giả — nguy hiểm nhất.** `ok` bật khi *thấy bất kỳ* request tới wshr có header
   `authorization`, **kể cả `id_token` OIDC** của IdP. Sáng nay script in `✅ Đăng nhập thành công`,
   nạp kho **rỗng**, `exit 0` → `auto-login.js` tin là xong nên **không thử lượt 2** → cả cụm 8h40
   chết trong im lặng. Nay: thành công **= có ≥1 token được wshr chấp nhận và đã nạp kho** (`napDuoc`);
   không có thì log thất bại + ảnh hiện trường và `exit 1` (guard/lượt 2 mới có cơ hội vá).
2. **Không bấm bừa nữa.** Danh sách nút "phá luồng" (chỉ chặn đường `fallbackSubmit`) thêm
   `refresh/reload/tải lại/làm mới/resend/gửi lại/try another/another way/đổi phương thức/change`.
   Trước chỉ chặn nhóm "Use another account/sign out/cancel/back" (bẫy 27/07).
3. **Màn hình lạ thì DỪNG, không đoán.** Không còn ô nhập nào mà cũng không phải trang SSO/chọn tài
   khoản → đợi ~24s rồi dừng kèm ảnh hiện trường (chỉ áp dụng khi chưa nộp gì — sau khi nộp, trang
   callback OIDC vốn trống ô nhập). Ở `work.hasaki.vn` mà 4 lượt không thấy nút SSO nào đáng bấm →
   cũng dừng (đúng ca trang lỗi mạng 09:21).
4. **Cửa chặn theo `auth_methods`.** Đang ở host `auth-idp…` mà IdP **không** liệt kê `TOTP` →
   dừng ngay (`exit 3`), **không gõ mã** — gõ mã sinh từ secret cũ chỉ tốn lượt sai và có thể khoá
   tài khoản. Log nói rõ "hệ xác thực đã đổi".
5. **Ảnh hiện trường ở mọi lối thoát**: URL + `auth_methods` IdP đòi + danh sách ô nhập (có/trống) +
   nút + thông báo lỗi. Lần IdP đổi sau chỉ cần **đọc log**, không phải dựng lại hiện trường.

### D4. Khi hệ authenticator đổi thật — xử lý theo LOẠI

| Loại mới | Bot tự làm được? | Việc phải làm |
|---|---|---|
| **TOTP ghi danh lại ở app khác** (Google/Microsoft Authenticator, app nội bộ…) | **Được** — secret là của chính người dùng | Lấy **seed base32** ngay lúc ghi danh (từ URI `otpauth://…?secret=…` sau mã QR) → cập nhật `HASAKI_2FA_SECRET`. **Không đổi gì khác**, toàn bộ luồng chạy như cũ |
| **SMS OTP** | Gần như không | Không nên phụ thuộc (cần đọc SMS, thêm 1 điểm vỡ + phụ thuộc điện thoại). Chuyển sang D5 |
| **Duyệt trên app / quét QR (push)** | **Không** — cố ý thiết kế vậy | D5 |
| **Passkey / FIDO2** | **Không** | D5 |

Nếu chỉ là đổi app TOTP: seed 6 số/30s là chuẩn `otpauth`, `otpauth` lib đang dùng chạy đúng —
việc duy nhất là **chép seed mới**. Đừng bỏ luồng tự động vì tưởng phải viết lại.

### D5. Nếu phương thức mới KHÔNG thể tự động — hướng bền

Đích không phải "lách MFA" mà là **bỏ nhu cầu bot đăng nhập**:

1. **Mở rộng bridge sang work/hr.** Hiện `factory/wms-bridge` chỉ nghe token của
   `wms-gw.inshasaki.com` (`host_permissions` + content script chỉ khớp `wms.inshasaki.com`) —
   **chưa nghe `wshr.hasaki.vn`**. Thêm là 5S/chấm công cũng mượn được phiên người thật,
   hết cần bot đăng nhập. Đây là việc **cụ thể, rõ ràng, đáng làm trước**.
2. **Một lần đăng nhập TAY mỗi ngày** (hoặc mỗi khi phiên chết) + giữ phiên trong Edge profile.
   Đã có sẵn: nút trong email → cờ GAS → `watch-login-request.js` mở màn login.
3. **Xin IT kênh không cần phiên người** (P3 ở Phần B): service account / OIDC client_credentials
   cho tải báo cáo, hoặc file drop. MFA mạnh lên là lý do **chính đáng** để xin, không phải trở ngại.

Không đi đường né MFA (giả thiết bị, trích khoá từ app điện thoại, tự giải CAPTCHA, chặn push):
vỡ liên tục và đi ngược quyết định bảo mật của chính công ty.

### D6. Kiểm chứng an toàn (chưa chạy — cần chọn thời điểm)

Luồng login **chưa được chạy thử** sau khi vá: `login-hasaki.js` **không** tuân khung chặn
`07:45–18:00` của `session-rules.js`, nên chạy nó trong giờ làm là **đá phiên WMS của operator**
(1 phiên/tài khoản). Cách thử đúng:

```
# NGOÀI giờ làm (trước 07:45 hoặc sau 18:00), tại hasaki\
node login-hasaki.js --show --dry-otp     # đi hết tới bước OTP, GÕ nhưng KHÔNG nộp → không tốn lượt
node login-hasaki.js --show               # lượt thật, xem tận mắt IdP đang đòi gì
```

Đọc log tìm dòng `ℹ IdP đòi phương thức: …` — đó là câu trả lời chính xác cho "hệ authen mới là gì".

---

## PHẦN E — (BẢN NHÁP 1 — ĐÃ ĐƯỢC **PHẦN F** THAY THẾ)

> ⚠️ Giữ lại để đối chiếu lập luận. Bản này dựa vào "bằng chứng vắng mặt" (chấm công, lịch, công tắc
> khai báo) và có nhắc phương án xin kênh IT — **cả hai đều đã bị loại** ở Phần F: không thoả hiệp với
> IT, và hoá ra không cần đoán "hôm nay có đi làm không" chút nào. **Đọc PHẦN F.**

### E1. Chia VAI, đừng chia máy — gốc của toàn bộ thiết kế

Hiện mỗi máy là một "cục" làm tất cả. Tách thành 3 vai thì hai điều kiện trên tự nhiên giải được:

| Vai | Ai đảm | Làm gì | KHÔNG được làm |
|---|---|---|---|
| **PROVIDER** (người thật) | Trình duyệt + extension `wms-bridge` trên máy người dùng (laptop) | Nghe token phiên đang sống, tự get-me, đẩy lên GAS mỗi 2' | Không kéo dữ liệu, không ghi Sheet |
| **RUNNER** (máy trạm) | **Đúng MỘT máy** đang giữ lease — nên là PC 24/7 | Kéo dữ liệu, ghi Sheet, và *có điều kiện* mới được login | Không login khi chưa được trọng tài cho phép |
| **ARBITER** (trọng tài) | Apps Script | Giữ trạng thái mà **cả hai máy đều thấy** | Không tự gọi WMS |

Vì sao bắt buộc có ARBITER: mọi khoá hiện tại là **khoá file cục bộ** (`.poller.lock`,
`.sync-guard.lock`, `.login-open.lock`) — hai máy **không thấy khoá của nhau**. PC và laptop cùng bật
lịch = hai phiên SSO đá nhau + hai nguồn ghi đè Sheet. `CHUYEN-MAY-PC.md` đã ghi nhận cần "khoá chủ
trên Apps Script" từ GĐ B; đây chính là nó.

ARBITER cần giữ 4 thứ (Script Properties, cùng chỗ `BRIDGE_TOKEN_AT` đang nằm):

```
BRIDGE_TOKEN, BRIDGE_TOKEN_AT      (đã có) nhịp tim của người thật
RUNNER_LEASE  = {may, at}          ai đang là RUNNER, TTL ~10', gia hạn mỗi tick
NGUOI_CO_MAT  = {ngay, luc, jti}   hôm nay đã thấy người thật chưa (đóng băng quyền login)
LOGIN_BUDGET  = {ngay, soLan, lanCuoi}   ngân sách login/ngày của bot
```

### E2. Máy trạng thái QUYỀN SỞ HỮU PHIÊN (thay cho luật khung giờ)

Luật hiện tại chặn login theo **giờ** (`SAFE_RELOGIN_BLOCKS=07:45-18:00`). Điều kiện 1 đòi bot phải
login được **giữa giờ làm** khi người nghỉ ⇒ phải đổi tiêu chí từ *giờ* sang *bằng chứng vắng mặt*.
Giờ trở thành **một** đầu vào, không còn là luật duy nhất.

| Trạng thái | Nhận biết | RUNNER làm gì |
|---|---|---|
| `NGUOI_SONG` | tuổi bridge < 10' | Dùng token bridge. **Cấm login.** Đây là trạng thái mong muốn trong giờ làm |
| `NGHI_NGO_VANG` | bridge im ≥ 60' **và** không token nào sống | Chưa được login. Tích bằng chứng, chờ hết cửa im lặng |
| `VANG_XAC_NHAN` | ≥2 bằng chứng độc lập (E3) + đã qua cửa im lặng | **Được login** dù trong giờ làm, trong hạn ngân sách (E4) |
| `BOT_GIU` | vừa login xong | Kéo ngay 1 lô rồi dừng. Không giữ phiên rỗi |
| `NGUOI_QUAY_LAI` | thấy **jti mới** không phải của bot | Đặt `NGUOI_CO_MAT` → **đóng băng quyền login đến hết ngày**. Quay về dùng bridge |
| `MU` | không gọi được GAS / không đọc được trạng thái | **Không làm gì có rủi ro.** Chỉ dùng token sẵn nếu còn sống |

Bộ phát hiện `NGUOI_QUAY_LAI` **đã tồn tại dạng thô**: `session-ledger.log` (tick 2' trong
`watch-login-request.js`) ghi "PHIÊN MỚI trong kho: jti=…" và "VỪA CHẾT (get-me 401)". Chỉ cần đưa
kết luận đó lên ARBITER thay vì chỉ ghi log cục bộ.

### E3. Bằng chứng "hôm nay người dùng không đi làm" — cần ≥2, độc lập

1. **Nhịp tim bridge im ≥60'.** Extension đẩy mỗi 2' và chỉ đẩy token **đã get-me OK** (v1.3.0), im
   60' = mất ~30 nhịp. Mạnh nhưng **không đủ một mình**: extension gỡ/lỗi/hết bật cũng im.
2. **Không token nào sống**: token trong kho get-me 401 **và** bridge rỗng. Người mà đang làm thì ở
   đâu đó phải có token sống.
3. **Lịch/HR**: cuối tuần, nghỉ lễ, hoặc không có check-in hôm nay. ⚠️ Vướng thật: tab `NHAN-SU` nằm
   trong `PII_TABS` nên **không** phục vụ qua `readTab`, còn gọi API timesheet thì **lại cần token**
   (vòng lặp con gà–quả trứng). Cách gỡ: thêm một action GAS chỉ trả **đúng một boolean**
   "hôm nay chủ tài khoản đã check-in chưa", tính phía server từ sheet private — không lộ PII.
4. **Công tắc người dùng khai** (dashboard + PIN): *"Hôm nay tôi nghỉ — cho bot đăng nhập"* và
   *"Tôi đang làm — đừng đăng nhập (giữ N giờ)"*. **Rẻ nhất, chắc nhất, ít đoán nhất.** Điểm đặc biệt
   ở đây: WMS 1 phiên/tài khoản nên người duy nhất bot có thể đá **chính là chủ tài khoản** — và chủ
   tài khoản hoàn toàn tự khai được trạng thái của mình. Nên coi đây là bằng chứng hạng nhất.

**LUẬT BẤT ĐỐI XỨNG — phải viết thành nguyên tắc, không để ngầm:** bot login đá người = tốn kém và
người bị đá *không biết vì sao*; người login đá bot = vô hại, bot tự lành ở tick sau. Vì vậy mọi mơ hồ
đều phân giải thành **KHÔNG login**. Dữ liệu cũ vài giờ thì vá được; đá operator giữa lượt kiểm kê thì
không lấy lại được.

### E4. Chặn bán kính thiệt hại của mỗi lượt bot login

- **Ngân sách**: ≤1 lượt/2–3 giờ, ≤3 lượt/ngày (`LOGIN_BUDGET`).
- **Chỉ login khi CÓ VIỆC**: mốc `.sync-ok-*` đã cũ *và* đến hạn kéo — không login theo lịch cho vui.
- **Kéo ngay rồi thôi**, không giữ phiên rỗi (phiên rỗi vẫn chiếm suất 1-phiên/tài khoản).
- **Thấy người là dừng hẳn ngày đó** (`NGUOI_CO_MAT`) — xử đúng ca "người đi làm muộn 10h".
- **Luôn để lại dấu**: mỗi lượt login trong giờ làm phải log + gửi cảnh báo, để người bị đá tra được
  đúng phút và biết lý do (hiện `session-ledger.log` đã làm được nửa việc này).
- **Lỗ hổng phải bịt trước**: `login-hasaki.js` **không** hỏi `session-rules.js` — hiện *bất cứ gì*
  spawn nó đều có thể đá operator. Cửa kiểm phải chuyển về **ngay đầu vào của login**, hoặc
  ARBITER phát "vé login" thì mới được chạy. Không bịt chỗ này thì cả E2–E3 chỉ là trang trí.

### E5. Điều kiện 1 — "tươi kể cả khi laptop không mở" thực chất đòi gì

Bốn lớp, và lớp yếu nhất **không phải code**:

- **Lớp A — PC phải BẬT và có desktop thật.** Task đang là `LogonType=Interactive` vì Puppeteer cần
  desktop (Turnstile). Cần: không Sleep (`powercfg /change standby-timeout-ac 0`), auto-logon + khoá
  màn hình, **bật nguồn theo giờ trong BIOS/UEFI hoặc Wake-on-LAN** cho ca "PC đã tắt", và **đừng để
  phiên Windows ở trạng thái RDP disconnected** (desktop biến mất → cụm trượt trong im lặng).
  👉 **Đây là điểm chết thật của điều kiện 1** — vá bao nhiêu code cũng vô nghĩa nếu máy không bật.
- **Lớp B — PC giữ lease RUNNER**, kéo dữ liệu bằng token theo thứ tự: bridge → kho → *(chỉ khi
  `VANG_XAC_NHAN`)* login SSO.
- **Lớp C — cửa kiểm login đặt ở đầu vào** (E4), ARBITER là nơi duy nhất phát vé.
- **Lớp D — giới hạn bền vững**: đường "bot tự login khi người nghỉ" **chỉ sống khi MFA còn tự động
  hoá được** (TOTP). Nếu IdP chuyển sang duyệt-trên-app/passkey (Phần D4) thì **không có cách nào**
  bot tự login → điều kiện 1 chỉ còn giải được bằng **credential không cần người** (E6a).

### E6. Điều kiện 2 — bị chặn API: đâu là giảm đau, đâu là triệt để

**Kết luận logic quan trọng nhất — hai điều kiện xung đột ở phương án P0:**
thu động qua extension **bắt buộc phải có phiên người thật đang mở** ⇒ **P0 không bao giờ thoả được
điều kiện 1**. Vì vậy nếu API bị chặn *mà vẫn* cần tươi khi không ai đi làm thì chỉ còn:

| Hướng | Bản chất | Thoả ĐK1? | Thoả ĐK2? |
|---|---|---|---|
| **(a) Kênh chính thức không cần người** — service account / OIDC `client_credentials` read-only + IP allowlist; **file drop định kỳ** (SFTP/Drive/mail); DB read replica / DWH | Dữ liệu **được đưa tới**: không phiên, không trình duyệt, không MFA, không cào | ✅ | ✅ |
| **(b) Tự sở hữu dữ liệu tại nguồn** — form 5S, app quét tem | Không cần API của họ cho phần mình tự thu | ✅ (phần mình thu) | ✅ |
| P0 thu động / P1 export tay / P2 đọc UI | **Giảm đau**: mua được ngày–tuần, vẫn cưỡi trên phiên người, vẫn vỡ khi đổi UI | ❌ | ⚠️ tạm |

⇒ **Triệt để chỉ có (a) và (b).** (a) nên xin **ngay khi chưa bị chặn**: MFA siết chặt lại chính là
lý do chính đáng để xin, không phải trở ngại. Và (a) đồng thời xoá luôn cả bài toán E2–E4: không còn
phiên người để mà tranh, không còn ai bị đá.

Hai thứ phải có trước để phản ứng đúng khi bị chặn (đã nêu ở B6, nhắc lại vì gắn trực tiếp):
**bộ phân loại lỗi** (401/403 vs 429 vs HTML-captcha vs 200-rỗng vs mất mạng — không phân biệt được
thì không chọn được đối sách) và **banner "dữ liệu đóng băng"** trên dashboard. Giữ **hợp đồng =
schema tab Sheet** thì đổi kênh chỉ là đổi adapter, không phải viết lại.

### E7. Thứ tự làm (giá trị/rủi ro giảm dần)

1. **ARBITER trên GAS.** Kèm một sửa nhỏ nhưng bắt buộc: `apiGetBridgeToken` hiện **giấu tuổi** khi
   token quá cũ (trả `token:''`, `at:0`) ⇒ RUNNER **không phân biệt được** "chưa từng có bridge" với
   "bridge vừa im 5 phút" hay "im 3 tiếng". Phải trả `at`/tuổi kể cả khi hết tươi — không có số này
   thì E3 điểm 1 **không thể** tính.
2. **Chuyển cửa kiểm login về đầu vào `login-hasaki.js`** (bịt lỗ E4) — làm trước mọi việc nới lỏng.
3. **Công tắc "hôm nay tôi nghỉ / đừng đăng nhập"** trên dashboard: giảm đoán nhiều nhất trên mỗi dòng code.
4. **Mở rộng bridge sang `wshr.hasaki.vn`** (hiện `wms-bridge` chỉ nghe `wms-gw`) → 5S + chấm công
   cũng cưỡi được phiên người thật.
5. **Lease RUNNER** rồi mới bật lịch trên máy thứ hai.
6. **Nới luật giờ thành luật bằng chứng** — bước cuối, chỉ khi 1–5 đã chạy ổn.
7. Song song: **mở thoại với IT về (a)** — đích đến của cả hai điều kiện.

---

## PHẦN F — THIẾT KẾ CHỐT: DỮ LIỆU LUÔN TƯƠI (ràng buộc thực tế 30/07/2026)

> Ràng buộc đầu bài — thiết kế phải sống trong đúng 3 điều này:
> 1. **Không thoả hiệp với IT.** Mọi phương án "xin service account / xin file drop / xin API" bị loại.
>    Chỉ dùng những gì mình đang có quyền.
> 2. **Laptop luôn đăng nhập wms/hr/work trong 8h30–17h30**, nhưng **đôi khi đi trễ hoặc sớm hơn**.
> 3. **PC trạm KHÔNG có màn hình, bàn phím, chuột** — máy trạm thứ 2.
>
> Mục tiêu duy nhất: **dữ liệu luôn tươi**.

### F1. Đơn giản hoá then chốt: đừng hỏi "hôm nay có đi làm không"

Bản nháp 1 (Phần E) đi tìm bằng chứng vắng mặt: chấm công, lịch nghỉ, công tắc khai báo. **Sai hướng
và không cần thiết.** Lý do:

> **Bot login chỉ gây hại khi ĐANG CÓ một phiên sống để đá.**
> Không có phiên sống nào ⇒ **không có ai để đá** ⇒ login an toàn, **bất kể mấy giờ**.

Và "hiện có phiên sống hay không" là câu hỏi **quan sát được trực tiếp mỗi 2 phút**, không phải suy
đoán: extension đẩy nhịp tim mỗi 2' và **chỉ đẩy token đã get-me OK**. Vậy luật gọn lại còn **một câu**:

```
CÓ phiên sống  → dùng token đó (bridge). TUYỆT ĐỐI không login.
KHÔNG phiên nào sống (im ≥ cửa im lặng) → login. Không cần biết mấy giờ, không cần biết ai nghỉ.
```

**Điều này xoá sạch bài toán "đi trễ / đi sớm"** — thứ mà luật khung giờ `07:45–18:00` không bao giờ
xử được. Đi làm 7h15? Phiên bật lên, bridge có nhịp, bot im. Đi làm 10h? Từ 8h30–10h không có phiên
nào ⇒ bot cứ login và kéo, dữ liệu vẫn tươi; 10h người login, **phiên của bot bị đá** — vô hại, bot
quay về dùng bridge ở tick sau. Làm quá 18h? Bridge còn nhịp thì bot vẫn im. Không còn mốc giờ nào
để mà sai.

**Chiều bất đối xứng là thứ làm thiết kế này an toàn:** người đá bot thì bot tự lành; bot đá người thì
người mất việc đang làm. Luật trên chỉ cho bot login vào đúng lúc **không có gì để đá**.

### F2. Phát hiện "có phiên sống" — đây là cửa an toàn DUY NHẤT nên phải chắc

Bốn nguồn, tất cả đều rẻ:

1. **Nhịp tim bridge WMS** (`BRIDGE_TOKEN_AT`) — có sẵn, extension đẩy mỗi 2'.
2. **Nhịp tim bridge wshr — CÒN THIẾU, và là mảnh quan trọng nhất phải thêm.** Hiện `wms-bridge` chỉ
   nghe `wms-gw.inshasaki.com`. Đề bài nói laptop đăng nhập **cả wms/hr/work** ⇒ có ca người đang làm
   trên work/hr mà **không** mở WMS: bridge im, bot tưởng vắng, login và đá phiên. Thêm host
   `wshr.hasaki.vn` vào extension vừa **bịt lỗ an toàn này**, vừa cấp token cho 5S + chấm công.
3. **Token trong kho còn sống + BIẾT AI mint nó.** `token-store.js` hiện lưu `{token, at}` — cần thêm
   `nguon: "bot" | "bridge"`. Sống + `bridge` = người đang làm; sống + `bot` = bot đang giữ.
   Không có nhãn này thì không phân biệt được "phiên của người" với "phiên của chính mình".
4. **jti mới xuất hiện** = có người vừa login (đã có sẵn dạng thô trong `session-ledger.log`).

**Cửa im lặng + vùng đệm giờ đến** (dùng giờ như *gợi ý mềm*, không phải rào cứng):

| Khung | Cửa im lặng trước khi bot được login | Vì sao |
|---|---|---|
| 07:00–09:30 (vùng người có thể tới sớm/muộn) | **25'** | Nới rộng để không cắt ngang lượt login đang dở của người |
| 09:30–17:30 | **15'** | Đi làm muộn / nghỉ trưa ra ngoài — vá nhanh cho dữ liệu |
| 17:30–07:00 + cuối tuần | **5'** | Gần như chắc chắn không ai làm |

Chống dội: sau mỗi lượt bot login, nếu trong 10' thấy **jti mới không phải của bot** ⇒ nới cửa im lặng
lên 40' cho hết ngày và ghi log (bot vừa đoán sai, tự rút lui). Thêm jitter vài giây như poller đang làm.

### F3. Bộ máy giữ dữ liệu tươi — 3 nhịp, độc lập với việc ai cấp token

Điểm mấu chốt: **tách "làm tươi" khỏi "ai đang đăng nhập"**. Nguồn token là chi tiết cài đặt, không
phải điều kiện.

| Nhịp | Giờ | Ai cấp token | Việc |
|---|---|---|---|
| **NỀN** | **05:30** | bot login (chắc chắn không ai làm giờ này) | Kéo FULL mọi nguồn. **Xong trước cả ca đi sớm nhất** ⇒ 8h30 dữ liệu đã tươi sẵn, người đi muộn cũng không để lại lỗ hổng |
| **TRONG NGÀY** | 06:00–18:00, nhịp 15'/30' như `sync-poller.js` | bridge nếu có; **bot nếu không có phiên nào sống** (theo F1/F2) | Vệ sinh 15', AI 30', kiểm kê ping 10', tồn kho 2 slot |
| **VÉT** | **18:30** | bot (phiên đã rảnh) | Kéo bù mọi bước còn cũ, đóng ngày |

Lịch **8h40 hiện tại nên bỏ** — nó rơi đúng vào vùng người đang tới, là lúc tệ nhất để một cụm nặng
~25 phút đi xin token. Chuyển tải nặng về 05:30 và 18:30, giữa ngày chỉ còn delta rẻ.

Ghi chú: mốc `.sync-ok-*` + hash-skip + `PC_DELTA` đã có sẵn nên nhịp giữa ngày gần như không tốn gì
khi dữ liệu không đổi — "tươi" ở đây không đồng nghĩa với "nặng".

### F4. PC không màn hình/bàn phím/chuột — làm cho nó chạy được browser thật

Đây là ràng buộc kỹ thuật thật, không phải trở ngại. Puppeteer cần **desktop thật** (Turnstile).
Năm việc, đều nằm trong tầm tay:

1. **Auto-logon** (`netplwiz` hoặc `AutoAdminLogon` trong HKLM) → **có sẵn một console session ngay khi
   boot**, không cần ai bấm gì. Rồi khoá màn hình (`BAO-MAT-MAY.ps1` đã làm việc này).
2. **Cắm HDMI/DP dummy plug** (phích giả ~vài chục nghìn) **hoặc** driver Indirect Display. Máy không
   màn hình thì GPU thường không khởi tạo framebuffer, hoặc chỉ cho 1024×768 → trang render lệch,
   Cloudflare/Turnstile dễ trượt. Đây là **cách rẻ nhất để có một desktop "bình thường"**.
3. **Đừng dùng RDP để vào PC.** RDP disconnect **phá console session** → desktop biến mất → mọi lượt
   Puppeteer trượt trong im lặng (đúng cảnh báo đã ghi ở `CHUYEN-MAY-PC.md`). Dùng loại điều khiển
   **bám console session**: RustDesk / AnyDesk / TightVNC. Nếu buộc phải RDP thì khi ra phải
   `tscon <id> /dest:console` để trả session về console.
4. **Không Sleep, không Hibernate** (`powercfg /change standby-timeout-ac 0`, `monitor-timeout-ac 0`).
5. **Tự bật nguồn**: bật **RTC Alarm / Auto Power On** trong BIOS/UEFI (ví dụ 05:00 hằng ngày) để mất
   điện xong máy tự lên. Wake-on-LAN cần một thiết bị khác luôn thức để gửi gói — RTC alarm không cần ai.

Đặt thêm `--window-size` tường minh cho Puppeteer (script đã đẩy cửa sổ ra `-32000` để không che màn
hình; với PC không màn hình thì kích thước tường minh là thứ giữ cho layout ổn định).

### F5. Hai máy — chia vai, chỉ MỘT máy được ghi

Giữ nguyên F1 của bản nháp (3 vai + trọng tài trên GAS), chốt lại theo ràng buộc mới:

- **PC = RUNNER duy nhất**: giữ `RUNNER_LEASE` trên GAS (TTL 10', gia hạn mỗi tick), là máy duy nhất
  kéo dữ liệu, ghi Sheet và được phép login.
- **Laptop = PROVIDER**: chỉ chạy extension (cấp token + nhịp tim). **Tắt toàn bộ 5 Scheduled Task trên
  laptop** — hai máy cùng lịch là hai phiên đá nhau cộng hai nguồn ghi đè Sheet, và khoá file cục bộ
  (`.poller.lock`, `.sync-guard.lock`, `.login-open.lock`) **không nhìn thấy nhau giữa 2 máy**.
- Trọng tài GAS giữ: `RUNNER_LEASE`, nhịp tim bridge (wms + wshr), `LOGIN_BUDGET` (≤1 lượt/2h, ≤4/ngày),
  và mốc "lượt bot login gần nhất + có bị đá không" để chạy luật nới cửa ở F2.
- **Sửa nhỏ bắt buộc**: `apiGetBridgeToken` hiện **giấu tuổi** khi token quá cũ (trả `token:''`,`at:0`)
  ⇒ RUNNER không phân biệt được "chưa từng có bridge" / "im 5 phút" / "im 3 tiếng". Phải trả `at` kể cả
  khi hết tươi — **không có số này thì F2 không tính được cửa im lặng.**
- ✅ **Đã bịt 30/07**: `login-hasaki.js` trước đây **không hỏi** `session-rules.js` → *bất cứ gì* spawn
  nó cũng login được. Nay có cửa kiểm ở đầu vào (chỉ cho lượt `--auto`).
- ✏️ **ĐÍNH CHÍNH 30/07 (bản trước ghi SAI):** đã có lúc tôi ghi ở đây rằng `auto-export-sync.js` và
  `pull-timesheet.js` là "lỗ hổng đá phiên vì không gọi `chanReLoginNgoaiKhung`". **Không đúng** —
  đọc kỹ code thì: `auto-export-sync.js` KHÔNG bấm SSO (chỉ mở trang, không có token thì ném lỗi);
  `pull-timesheet.js` CÓ bấm "Đăng nhập với Hasaki SSO" nhưng **không hề gõ email/mật khẩu/OTP**, nên
  phiên IdP còn sống thì đó chỉ là vòng SSO im lặng mint token hr mới (**không** tạo phiên IdP mới ⇒
  **không** đá phiên WMS), còn phiên IdP đã chết thì nó kẹt ở trang IdP, hết 25s rồi ném lỗi.
  Cả hai đều leo thang sang `login-hasaki.js --auto` — nơi **đã có** cửa kiểm.
- ⇒ **Mặt đá phiên thật chỉ có 2 đường, và cả 2 đã được gác:** (1) đăng nhập IdP đầy đủ =
  `login-hasaki.js` (cửa kiểm đầu vào, bước 2); (2) SSO vào ứng dụng WMS = 3 bộ tồn kho
  (`chanReLoginNgoaiKhung`, nay đã nâng thành luật phiên ở bước 3).

### F6. Bị chặn API — không có đường IT thì còn gì

Bỏ hướng xin kênh chính thức thì bộ công cụ còn lại đúng bằng những gì mình tự làm được:

| Hướng | Chạy được khi nào | Trần của nó |
|---|---|---|
| **P0 thu động qua extension** (nâng `wms-main-hook.js` lấy thêm *response body*, không chỉ token) | Khi người đang mở máy làm việc | **Không tạo request mới** ⇒ miễn nhiễm rate-limit/WAF/anti-bot. Nhưng chỉ có dữ liệu đúng trang họ mở, và **không chạy khi không ai làm** |
| **P1 export chính chủ** | Người bấm Export | Đã chạy thật cho work 5S (`sync-board-to-sheet.js` đọc Downloads). Cần xác minh nút Export của 2 báo cáo WMS |
| **P2 đọc UI/DOM** | Có phiên người | Vỡ mỗi lần đổi giao diện — chỉ dùng làm cầu tạm |
| **P4 tự thu tại nguồn** (form 5S, app quét tem) | Luôn luôn | **Độc lập hoàn toàn với API của họ.** Đổi nguồn sự thật, chỉ phủ phần mình tự thu |
| **Kho snapshot + replay** | Luôn luôn | Không tạo dữ liệu mới, nhưng giữ cho mất kênh **xuống dốc dần** thay vì tắt đột ngột |

Nói thẳng một lần cho đủ trung thực: **P0/P1/P2 đều cần một phiên người thật**, nên nếu API bị chặn
cứng ở mức chính sách thì mục tiêu "tươi cả khi không ai đi làm" **không còn cách nào giữ trọn** —
thứ giữ được là *tươi trong giờ làm* (P0) cộng *lịch sử không mất* (snapshot) cộng *phần tự thu* (P4).
Đó là trần của bài toán khi không dùng kênh ngoài, và cách tối ưu trong trần đó là:
**lấy được lượt nào thì vắt kiệt giá trị lượt đó** — snapshot mọi lần kéo thành công ra `.exports/`
(+ Drive), giữ hợp đồng = schema tab Sheet để đổi kênh chỉ là đổi adapter, và có **bộ phân loại lỗi**
(401/403 vs 429 vs HTML-captcha vs 200-rỗng vs mất mạng) để biết mình đang đụng tường nào.

### F7. Thứ tự làm

1. ✅ **XONG 30/07** — **Nhãn `nguon` cho token** (`token-store.js`: `luuToken(...,nguon)`,
   `nguonToken()`; bridge gắn `"bridge"`, các bộ tự chụp gắn `"bot"`). **Không cần sửa GAS nữa**:
   thay vì chờ `apiGetBridgeToken` trả tuổi, đo im lặng bằng **mốc cục bộ `.bridge-thay-cuoi`**
   (`chamMocBridge`/`imLangBridgeMs` trong `session-rules.js`) — máy trạm là duy nhất nên đủ, và
   mốc thiếu (máy vừa boot) thì gieo bằng "bây giờ" để buộc chờ đủ một cửa im lặng.
2. ✅ **XONG 30/07** — **Cửa kiểm ở đầu vào `login-hasaki.js`** + bộ đánh giá
   `trangThaiPhien()` (`nguoi`/`bot`/`khong`/`khongro`) + `cuaImLangMs()` (25'/15'/5' theo khung).
   Chỉ áp cho `--auto`; lượt người bấm nút trong email (spawn **không** kèm `--auto`) không bị chặn.
   `auto-login.js` hiểu mã **75 = hoãn** (`chayAutoLoginMa`) nên không còn báo "đăng nhập thất bại" giả.
   **Đã thử thật:** bridge đang tươi → `⛔ KHÔNG đăng nhập` → exit 75, **không mở browser, không để lại lock**.
3. ✅ **XONG 30/07 — có KHOÁ TỰ ĐỘNG, không cần ai bật cờ.** `chanReLoginNgoaiKhung` nay chạy
   **hai chế độ và tự chuyển**:
   • Kênh wshr **chưa** chứng thực → **giữ nguyên luật khung giờ cũ** (bộ đánh giá còn mù cổng
     work/hr, nới ra là tự mở đường đá phiên).
   • Kênh wshr **đã** chứng thực (mốc `.bridge-wshr-ok`, ghi lần ĐẦU lấy được token wshr thật) →
     **LUẬT PHIÊN**: có phiên sống thì cấm; không phiên nào + đủ cửa im lặng thì **cho login bất kể
     mấy giờ** ⇒ **lỗ "đi làm muộn" tự đóng** ngay khi bạn Reload extension, khỏi sửa thêm dòng nào.
   Kết luận trạng thái được `layTokenSongWms` nạp sẵn (`_verdict`, hạn 3') vì `chanReLoginNgoaiKhung`
   là hàm sync gọi trong vòng lặp puppeteer — không thể tự đi hỏi mạng ở đó.
   **Đã kiểm chứng:** `kenhWshrDaChungThuc=false` → cửa kiểm vẫn chặn theo luật giờ (defer=true),
   tức **hôm nay chưa đổi hành vi gì**; và `login-hasaki --auto` vẫn chặn đúng (exit 75, không mở browser).
4. ✅ **CODE XONG 30/07 — CẦN 2 THAO TÁC TAY MỚI CÓ HIỆU LỰC.**
   Extension lên **v1.4.0**: nghe thêm `wshr.hasaki.vn` (hook + relay dùng chung, thêm matches cho
   `work.hasaki.vn` và `hr.hasaki.vn`), `background.js` quản **2 khe token** (`wms` trọng tài
   `get-me`; `wshr` trọng tài `search-for-dropdown?limit=1`), alarm 2' kiểm+đẩy cả hai khe.
   GAS (**cả `google-script.gs` và bản deploy `.clasp-deploy/sa.js`**): `bridgeToken`/`getBridgeToken`
   nhận `kind`, khe wshr lưu khoá riêng `BRIDGE_WSHR_TOKEN*`, `bridgeCaps` thêm cờ `bridgeWshr`,
   và `getBridgeToken` **luôn trả `at`** (bản cũ trả `at:0` khi hết tươi).
   Máy trạm: `layBridgeTokenWshr()` + `trangThaiPhien` xét cả 2 cổng.
   **FAIL CLOSED**: chưa thấy cờ `bridgeWshr` thì extension **không đẩy** token wshr và máy trạm
   **không hỏi** `kind=wshr` — vì GAS bản cũ bỏ qua `kind`, đẩy/hỏi mù sẽ **ghi đè token WMS bằng
   token wshr**. Nên trước khi deploy, mọi thứ chạy y như cũ.
   ✅ **GAS ĐÃ DEPLOY 30/07 15:31** — `clasp push` + `clasp deploy` vào đúng deployment production
   `AKfycbzIE6E…` → **version @44, URL KHÔNG đổi**. Trước khi push đã `clasp pull` vào thư mục tạm và
   diff: bản local **không lạc hậu** (khác biệt duy nhất đúng là các sửa này; `PhysicalCountImport.js`
   và `appsscript.json` giống hệt) ⇒ push không xoá mất thay đổi nào của editor.
   Xác nhận live: `?action=bridgeCaps` trả `{"bridgeToken":true,"bridgeWshr":true,"stockFlag":true}`.
   *Ghi chú công cụ:* clasp phải dùng **v3** (`npx @google/clasp@3`) — `~/.clasprc.json` là format v3
   (`{tokens:{default:…}}`), clasp v2 đọc không ra token. Ghi chú cũ "clasp không thấy script 5S"
   trong `NGHIEN-CUU-TAB-VE-SINH.md` **đã lỗi thời**: v3 truy cập được, `list-deployments` thấy 2 bản.
   ⏳ **CÒN ĐÚNG 1 THAO TÁC TAY (chỉ bạn làm được):** mở `edge://extensions` → **Reload**
   "Hasaki WMS Token Bridge — Factory" → mở lại tab `work.hasaki.vn` (hook chạy ở `document_start`).
   Tôi không tự làm được: extension nằm trong Edge profile bạn đang dùng, muốn nạp lại phải thao tác
   trên `edge://extensions` hoặc khởi động lại Edge — mà tắt Edge của bạn là giết luôn phiên đang làm.
   Kiểm chứng đạt: console extension in `khe wshr: CÓ`, và `trangThaiPhien` báo
   `bridge work/hr còn tươi` khi bạn đang mở work/hr mà **không** mở WMS. Ngay lúc đó mốc
   `.bridge-wshr-ok` được ghi và **luật phiên ở bước 3 tự bật**.
5. **Dựng PC theo F4** (auto-logon, dummy plug, RustDesk thay RDP, không sleep, RTC alarm) rồi
   **chuyển lease sang PC và tắt 5 task trên laptop**.
6. **Đổi lịch: bỏ 8h40, đặt NỀN 05:30 + VÉT 18:30.**
7. Nền dài hạn cho F6: nâng extension lên thu động, snapshot mỗi lượt, bộ phân loại lỗi.

---

## PHẦN C2 — ĐÃ SỬA 31/07/2026: bộ 5S mượn được bridge work/hr

**Triệu chứng:** sáng 31/07 dashboard factory tươi (08:58) nhưng dashboard 5S vẫn là số 29/07.

**Gốc:** hai dashboard đi hai kênh token khác nhau, và chỉ một kênh có đường lùi.
- Factory (`sync-stocklocation` · `sync-tonbatthuong` · `push-pc-to-sheet` · `sync-vesinh-all`)
  gọi `layTokenSongWms` = kho → **bridge WMS** ⇒ mượn thẳng phiên operator, không cần login.
- 5S (`auto-export-sync` · `push-5s-to-workflow`) gọi `layTokenTuPhucHoi(...,"work")` = kho →
  chụp Edge → **SSO**. Không có nhánh bridge nào, dù khe wshr đã chạy từ 30/07.

⇒ Nghịch lý: cửa kiểm phiên (đúng đắn) cấm bot login khi có người đang làm, nên **operator càng
online thì 5S càng không bao giờ cập nhật được**. 08:51 lượt SSO trượt (IdP: *Incorrect sign-in
details*), 08:55 lượt 2 bị chặn vì bridge WMS đã tươi → 5S đóng băng từ 29/07 09:51.

**Sửa:** `auto-login.js` — trong `layTokenTuPhucHoi`, sau khi kho rỗng và **trước** khi mở Edge:
app `"work"` thử `layBridgeTokenWshr()`, lấy được thì lưu kho với nhãn `"bridge"` và dùng luôn.
Fail-closed sẵn có: GAS chưa có khe wshr → trả `null` → đường cũ nguyên vẹn. Chỉ áp cho `"work"`
(khe wshr được trọng tài bằng chính API danh bạ mà bộ 5S dùng); `pull-timesheet` (`"hr"`) giữ nguyên.
Đã chạy thật 09:06: không mở browser, ghi 339 task vào `5S-TASKS` + đẩy 4 file Pages.

### C2b — Kéo bộ 5S vào ĐÚNG cơ chế của factory (cùng ngày)

Vá bridge ở trên mới chỉ trả lại *khả năng lấy token*. Bộ 5S vẫn thiếu 3 thứ mà 4 bước factory
đã có từ 25/07, nên hỏng là không ai biết và không ai vá:

| Cơ chế | Factory | 5S trước 31/07 | Nay |
|---|---|---|---|
| Mốc bước `.sync-ok-*` | ✅ 4 bước | ❌ không có mốc | ✅ `.sync-ok-5s`, ghi **chỉ khi** GAS trả `success` |
| Guard vá mỗi giờ | ✅ | ❌ ngoài tầm với (guard chỉ gọi `SYNC-STOCK.bat`) | ✅ guard gọi `AUTO-EXPORT.bat`; `SYNC_SKIP_FRESH=1` cho bước đã tươi thoát sớm |
| Nhịp trong ngày | ✅ 15'/30'/slot | ❌ **1 lần/ngày** ở cụm 8h40 | ✅ poller ≥45' |
| Token: phiên sống trước, SSO sau | ✅ `layTokenSongWms` | ❌ nhảy thẳng vào SSO | ✅ `layTokenSongWork` (bản song sinh cho cổng wshr) |

Chi tiết đáng nhớ:
- `layTokenSongWork(DIR, log)` — kho `work` **bất kể tuổi** → trọng tài là API danh bạ wshr →
  bridge work/hr. Không bao giờ tự login (giống hệt hợp đồng của `layTokenSongWms`).
- `KHONG_LOGIN=1` (poller đặt): hết phiên thì `auto-export-sync` **exit 75**, không mở SSO —
  giữ nguyên tắc "nhịp trong ngày không bao giờ tạo phiên mới".
- Poller: thiếu token **WMS** vẫn chạy bước 5S (cổng khác nhau) — đúng ca operator chỉ mở
  work/hr. Các bước factory trong lượt đó tự đứng ngoài.
- Chống dội: mốc bước không nhích khi hoãn, nên có thêm `s5At` (thử lại ≥10') để không spawn
  lại mỗi tick 2'. Cùng cách `aiAt`/`pcPingAt` đang dùng.
- `cumDangChay` (cả guard lẫn poller) nay nhận diện thêm `auto-export-sync.js`.
- **Đã kiểm chứng 31/07 09:28:** chạy `KHONG_LOGIN=1 node auto-export-sync.js` → lấy token bridge,
  không mở browser, ghi 340 dòng, chạm `.sync-ok-5s`; `sync-guard.js` báo *"đủ mốc 5 bước hôm nay"*.

**Còn lại:** lượt SSO 08:51 bị IdP từ chối kèm *"You have 6 attempts left before your account is
locked"*. Đồng hồ máy lệch −0,6s nên **không phải** TOTP trôi giờ. Chưa truy tiếp — thử theo **D6**
(`--dry-otp` ngoài giờ làm) trước khi để bot nộp thêm lượt nào.

---

## PHẦN C — ĐÃ SỬA 30/07/2026

- `SETUP-PC-MOI.ps1`: 07:00 → **08:40**; bổ sung task **Factory watchdog ton kho** (logon +5' và
  mỗi giờ 07:05→18:05) vốn bị thiếu; câu lệnh tắt lịch máy cũ nay liệt kê đủ 5 task.
- `sync-tonbatthuong.js`: bỏ hardcode `C:/Users/lechitam/...` + đường dẫn Edge cứng, dùng
  `EDGE_PATH` / `duongDanProfile(DIR)` của `token-store.js` như các bộ khác.
- `_diag-export.mjs`: cùng lỗi hardcode → sửa giống trên.
- `capture-task-api.js`: 2 đường dẫn trỏ vào thư mục tạm của một phiên đã chết → ghi vào
  `.exports/` của dự án (kèm `mkdirSync`).
- `HUONG-DAN-VAN-HANH.md`, `CHUYEN-MAY-PC.md`: thêm con trỏ về file này, đánh dấu lịch 07:00 là cũ.
- `login-hasaki.js`: 5 điểm ở **D3** (chặn báo thành công giả, chặn nút phá luồng, dừng ở màn hình
  lạ, cửa chặn `auth_methods`, ảnh hiện trường). Chưa chạy thử — xem **D6** để thử đúng cách.
- **Bước 1–2 của F7** (xem chi tiết ở F7): `token-store.js` (nhãn `nguon`, `nguonToken`),
  `session-rules.js` (`chamMocBridge`/`imLangBridgeMs`/`cuaImLangMs`/`trangThaiPhien`),
  `login-hasaki.js` (cửa kiểm đầu vào cho `--auto`, gắn nhãn `"bot"` khi nạp kho),
  `auto-login.js` (`chayAutoLoginMa`, hiểu 75 = hoãn), và gắn nhãn `"bot"` ở
  `sync-stocklocation.js` · `sync-tonbatthuong.js` · `push-pc-to-sheet.mjs`.
  Đã kiểm `node --check` toàn bộ + chạy thử cửa kiểm thật (chặn đúng, exit 75, không mở browser).
  **Hành vi lịch/đồng bộ hiện tại KHÔNG đổi** — luật khung giờ cũ vẫn nguyên, chỉ thêm một lớp
  chặn an toàn cho lượt login tự động.
