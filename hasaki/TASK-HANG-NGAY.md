# 9 task hằng ngày trên work.hasaki.vn — phân tích & tự động nộp báo cáo

> Bóc ngày 18/08/2026. Công cụ: `hasaki/task-hangngay.mjs`.

## 1. Bộ task được bắn mỗi ngày (T2–T7, Chủ nhật chỉ có 2 task hệ thống)

| Giờ bắn | task_id ngày 18/08 | Tên | prid | sub_type | Người giao | Nhóm |
|---|---|---|---|---|---|---|
| 07:30 | 13341637 | Sắp xếp hàng hóa trong kho | 8443 | 0 (làm nhóm) | Lê Thanh Hiền | **B** |
| 07:30 | 13341642 | Kiểm kê theo vị trí tạo bằng type full location | 8552 | 1 (mỗi người) | Lê Thanh Hiền | **A** |
| 08:00 | 13341864 | Các vấn đề bất thường (Bin F0-A0 có tồn) kho WH - MATERIAL - MTG | 0 | 0 | **Hệ thống (WMS)** | **A** |
| 08:00 | 13341865 | … kho WH - MATERIAL - GARMENT | 0 | 0 | **Hệ thống (WMS)** | **A** |
| 08:19 | 13343971 | Kiểm kê Location | 1735 "Audit" | 1 | Huỳnh Trần Như Ý | **A** |
| 08:19 | 13343972 | Kiểm kê SKU | 1735 | 1 | Huỳnh Trần Như Ý | **A** |
| 08:19 | 13343975 | Kiểm tra 5S kho tổng | 1735 | 1 | Huỳnh Trần Như Ý | **A** |
| 08:19 | 13343976 | Sắp xếp hàng hóa tại kho tổng | 1735 | 1 | Huỳnh Trần Như Ý | **tự** ⛔ |
| 08:19 | 13344022 | Dán tem QC Fail và Block UID Group vải không đạt chất lượng | 0 | 1 | Lê Thanh Hiền | **B** |

- 8 link người dùng đưa thiếu **13343976 "Sắp xếp hàng hóa tại kho tổng"** — nó cũng ra hằng ngày.
- **task_id ĐỔI MỖI NGÀY** — cột trên chỉ là id của ngày 18/08 để đối chiếu. Trong code KHÔNG có
  id nào bị chôn cứng: mỗi lượt chạy tự đọc `/news/notifications` lấy id của hôm nay rồi **khớp
  theo TÊN** (`SO_TAY` trong `task-hangngay.mjs`, mỗi dòng là một mẫu regex tên). Tên hai task
  F0-A0 có kèm ngày nên mẫu chỉ khớp phần cố định (`bất thường.*MATERIAL - MTG`).
- Đổi tên task / thêm task mới ⇒ không khớp mẫu nào ⇒ bot **không nộp** và in cảnh báo
  `⚠ N task chưa có trong sổ tay` cuối log. Sửa bằng cách thêm 1 dòng vào `SO_TAY`.
- Task **KHÔNG** phải task workflow (591…) mà là **task input** (`type=1`), sinh bởi bộ lịch định kỳ
  (`schedule_id`, `sequences: daily|weekly`, `date: ["1".."6"]` = T2–T7, `time: 07:30/08:00`).
- Hai task "Các vấn đề bất thường" do WMS tự bắn (`schedule_id: null`), tiêu đề kèm ngày, nội dung
  ghi thẳng số SKU đang treo ở bin F0-A0 + link báo cáo stock-location.

## 2. Cách hệ thống hiểu "đã hoàn thành"

- `sub_type = 1` (**mỗi thành viên đều làm**): mỗi người có 1 dòng riêng trong `staff[]`, tự nộp
  báo cáo của mình. Trạng thái task cha đổi khi có người nộp, **nhưng dòng của mình vẫn là "chưa
  làm"** → đây mới là thứ leader chấm. Ví dụ 18/08: cả 3 task Audit đã "chờ duyệt" ở cấp task
  (6/9 người nộp) trong khi dòng của mình vẫn 0.
- `sub_type = 0` (**làm nhóm**): 1 lượt nộp cho cả task.
- `data.require_virtual_configs = true` → khi nộp phải kèm **`configs.virtual_text`** (nội dung báo
  cáo). Ảnh (`configs.virtual_media`) **không bắt buộc** (`require_media: null`) — thực tế có người
  nộp chỉ text.
- Bảng trạng thái (lấy từ mã nguồn web): `0` chưa làm · `1` đang làm · `2` **Finished** (leader đã
  duyệt) · `3` trễ · `4` huỷ · `5` **Chờ duyệt** · `6` thất bại.
  → Nhân viên bấm "hoàn thành" = đưa về **5**, không phải 2.

## 3. Đường API (đã kiểm chứng)

Cửa: `https://wshr.hasaki.vn/api` — token Bearer wshr 48h, lấy bằng `layTokenSongWork` (kho token
dùng chung / bridge extension), **không tự đăng nhập**.

| Việc | Gọi |
|---|---|
| Biết hôm nay được giao task nào | `GET /news/notifications?limit=200` → lọc `object_type = 4`, `created_at` = hôm nay. `object_id` chính là `task_id`. |
| Chi tiết + trạng thái từng người | `GET /hr/projects/task-input/{id}` |
| Đặt "giờ thực tế" (bắt buộc) | `POST /hr/projects/mass-update-field-task-input` `{ "id": …, "field": "reality_hours", "value": 1 }` |
| **Nộp báo cáo** | `POST /hr/projects/mass-update-field-task-input`<br>`{ "id": <task_id>, "field": "status", "value": 5, "extra_data": { "configs": { "virtual_text": "…" } } }` |

**Bẫy 1: phải nộp 2 nhịp.** Đẩy thẳng `status` → `422 "Vui lòng cập nhật giờ thực tế!"`. Phải đặt
`reality_hours` trước rồi mới đổi `status` (đúng thứ tự người bấm trên web). Và phải đặt **mỗi
lượt nộp**, không được nhìn `task.reality_hours` để bỏ qua: với `sub_type=1` giờ thực tế tính theo
TỪNG NGƯỜI — task cha đã có giờ (đồng nghiệp nộp trước) mà dòng của mình chưa thì vẫn 422.

**Bẫy 2 — nội dung phải dài hơn 50 ký tự.** Máy chủ chặn `422 "Vui lòng mô tả chi tiết những công
việc đã thực hiện trong kết quả công việc, hoặc đính kèm file kết quả!"` khi `virtual_text` quá
ngắn và không có `virtual_media`. Đo thật: 40 ✗ · 45 ✗ · 50 ✗ · 55 ✓. Chuỗi rỗng, `"."`, `"ok"`,
kể cả ký tự trắng braille `⠀` (mẹo cả phòng dùng tới 03/08/2026) nay đều bị chặn — từ 04/08 mọi
lượt nộp của các task này đều kèm ảnh. Bot tự nối thêm dòng mốc thời gian khi báo cáo < 55 ký tự.

Bẫy phụ: task có `action_id = 1` **validate trước khi merge** — gửi `field=status` mà không kèm
`extra_data.configs` thì báo `"Vui lòng cập nhật dữ liệu cấu hình!"` dù configs đã ghi từ lượt
trước. Luôn gửi kèm `extra_data` trong chính request đổi status.

Ghi chú tìm đường: **swagger nội bộ mở công khai tại `https://wshr.hasaki.vn/api/docs`, spec ở
`/api/doc.json`** — đó là nguồn duy nhất tra được 3 endpoint trên (mò tay 60+ đường đều 404).
`extra_data` merge đệ quy vào `task.data` và `task_staff.data`; **không** được vừa đổi `status` vừa
đổi `assign_staff` trong 1 request. Đã thử với `id` không tồn tại → `422 "Model not found!"`
(chứng minh route sống mà không đụng dữ liệu thật).

**Đã bắn thử thật 18/08/2026 19:41 lên task #13341864** (F0-A0 · MTG): sau lượt nộp, task về
`status=5`, `percent=100`, `finished_at=2026-08-18 19:41:29`, `virtual_text` nằm đúng cả ở
`task.data.configs` lẫn dòng `staff[]` của mình — y hệt một lượt nộp tay trên web.

Đường khác trong spec, chưa dùng: `POST /hr/projects/upsert-task-input` (tạo/sửa task),
`GET /hr/projects/{id}` (thông tin project).

## 4. Nhóm A / nhóm B — ranh giới trung thực

**Nhóm A — bot có số liệu thật, nộp tự động được:**

| Task | Nguồn số liệu | Nội dung báo cáo |
|---|---|---|
| Kiểm kê SKU / Location / full location | `.pc-cache.json` (push-pc-to-sheet) | số phiếu trong ngày, đã đếm, phiếu lệch, kho, người kiểm, link WMS |
| Kiểm tra 5S kho tổng | `.exports/tasks-cache.json` (workflow 591) | số lượt vi phạm ghi nhận trong ngày + link dashboard AUDIT |
| Các vấn đề bất thường F0-A0 ×2 | 2 lượt/kho: `stock-locations/bins/count/v3` (đếm bin) + `report-inventories` (nguồn từng UID) | số SKU còn treo lúc kiểm tra lại, so với số đầu ngày, **và từng mã đi ra F0-A0 từ đâu** |

### Mã đó đi ra F0-A0 từ đâu (chốt 20/08/2026, yêu cầu chủ máy)

Báo cáo cũ chỉ nói *"còn 23 SKU treo ở F0-A0"* + liệt kê 10 mã — người đọc vẫn phải tự mở WMS dò
từng mã. Nay mỗi mã có thêm **nguồn đưa nó vào bin**:

```
Nguồn đưa vào F0-A0: 2 UID nhập mua, 1 UID điều chỉnh tồn.
Chi tiết từng mã (SL · số UID ← phiếu đưa nó vào bin):
- 422423615 (SL 1 · 1 UID) ← nhập mua phiếu 1001260811014229 · PO 10012607193930 · NCC CÔNG TY ... GEIC · vào bin 14/08 14:38 · Đỗ Thị Thùy Dương
- 422500682 (SL 174.360 · 1 UID) ← điều chỉnh tồn phiếu 1001260804016203 · PO 100052510157895 · vào bin 04/08 13:24 · Lê Thanh Hiền
```

Đường lấy: **1 lượt gọi thêm cho CẢ kho** (không phải 1 lượt/SKU) —
`report-inventories?location_description=F0-A0-00-00-00-00&warehouse_ids=<kho>&skus=<CSV>`,
header `Company-Ids` BẮT BUỘC. Tên người lấy từ `.cache-danhba.json` đã có trong máy (WMS và wshr
dùng chung dải `user_id` — đối chứng: 18811 = Lê Chí Tâm, 3490 = Lê Thanh Hiền), **không gọi API nào**.

Ba cái bẫy đã đo được 20/08/2026 (MTG, 23 SKU / 164 dòng):

1. **Phải lọc `status_id === 6` (In-BIN).** Lấy cả dòng `Adjustment - shipped` (29/164) thì số lượng
   phồng gấp trăm lần: SKU 422432609 từ 2.000 thành 3.002.000. Lọc In-BIN thì tổng qty khớp ĐÚNG
   `quantity` của `bins/count/v3` trên **23/23** SKU.
2. **`count` của endpoint không theo bộ lọc** (trả 2,1 triệu) — chỉ tin `records`.
3. **`uom` không đáng tin** (sợi tính bằng gam, dây kéo tính bằng pcs, cả hai đều trả `"Cái"`) →
   báo cáo cố ý chỉ in con số, không in đơn vị.

Trần an toàn: tối đa 25 dòng chi tiết **và** 3.500 ký tự cả báo cáo (wshr có chặn dưới 50 ký tự,
chặn trên thì chưa đo được — thà tự cắt hơn là mất lượt nộp vì 422). Bớt dòng nào thì vẫn đếm
trong câu `…(+N SKU nữa, xem link)`.

Xem trước không cần task còn hạn (mỗi ngày chỉ nộp được 1 lần):

```bash
node task-hangngay.mjs --thu-f0a0     # chỉ hỏi WMS rồi in 2 báo cáo ra màn hình, không nộp gì
```

Cả 3 bộ dựng báo cáo đều **từ chối nộp nếu dữ liệu trong máy cũ hơn 6 giờ** — số liệu cũ nộp lên
còn tệ hơn không nộp.

**NGOÀI PHẠM VI BOT — ĐÚNG MỘT TASK (chốt lại 20/08/2026):** task tên **chính xác**
`Sắp xếp hàng hóa tại kho tổng` **do Huỳnh Trần Như Ý giao** (`created_by` = 17840). Task này để
riêng, **chủ máy tự bấm Hoàn thành trên web**. Bot không soạn, không nộp, kể cả khi người bấm nút
chọn "nộp tất cả" — trong `SO_TAY` nó mang cờ `tuBaoCao: true` + `nguoiGiao` và cửa sổ nút in
`→ NGOÀI PHẠM VI BOT — bạn tự bấm Hoàn thành trên web.` Cửa duy nhất để ép: gọi đích danh
`node task-hangngay.mjs --nop --task=<id>` (phải tự gõ đúng id của ngày hôm đó nên không thể lỡ
tay).

**Mọi task còn lại trong sổ tay — kể cả nhóm B — bot đều báo cáo tự động.** Hai task việc tay
`Sắp xếp hàng hóa trong kho` (prid 8443) và `Dán tem QC Fail và Block UID Group` nộp bằng một câu
trung tính; muốn ghi nội dung thật thì viết vào `.task-baocao-tay.json` (mục 6).

Khoá bằng **cả tên neo hai đầu (`^…$`) lẫn người giao**: khớp lỏng kiểu `/tại kho tổng/` sẽ ăn lây
bất kỳ task nào chứa cụm đó (ví dụ "Sắp xếp hàng hóa tại kho tổng ca 2" của người khác) rồi lặng
lẽ không nộp. Lệch một trong hai điều kiện ⇒ task rơi vào nhánh **"task LẠ"**: bot kêu to
`⚠ N task chưa có trong sổ tay (KHÔNG nộp)` và không nộp — hướng sai an toàn.

**Nhóm B — việc tay ngoài kho:** "Sắp xếp hàng hóa trong kho" và "Dán tem QC Fail và Block UID
Group". Bot không có cách nào biết ngoài kho đã làm gì. Chủ máy chốt
18/08/2026: **không cần ghi nội dung gì**, nên bot nộp bằng **một câu trung tính** — không khai là
đã làm cũng không khai là chưa làm:

> Không có nội dung báo cáo bổ sung cho công việc này trong ngày.

Đổi câu này bằng env `TASK_BAOCAO_MACDINH`. Muốn ghi nội dung thật của ngày nào thì viết vào
`.task-baocao-tay.json` (đúng ngày hôm nay) — bot ưu tiên nội dung đó:

```json
{ "ngay": "2026-08-19",
  "baocao": {
    "Sắp xếp hàng hóa trong kho": "Hoàn thành 3 kệ vải kho GARMENT, đã dán UID Group…",
    "13344022": "Đã dán tem QC Fail 12 cây vải, block 4 UID Group."
  } }
```

## 5. Ai bấm nộp — **NÚT BẤM TAY** (chốt 19/08/2026)

Trước đó: lịch 16:00 tự nộp. **Nay bot không tự nộp nữa** — chủ máy giữ quyền "hoàn thành":

| Tình huống | Làm gì |
|---|---|
| Cần bot nộp (số liệu kiểm kê/5S/F0-A0 bot có sẵn) | **Bấm nút** — shortcut *NOP BAO CAO TASK (bam khi can)* ngoài Desktop → `NUT-NOP-TASK.bat`. Ở xa máy thì nhắn **`/nop`** cho bot Telegram rồi bấm nút xác nhận trong chat (`KENH-TIN-NHAN.md`) |
| Không cần | Không bấm. Tự bấm Hoàn thành trên work.hasaki.vn — bot không chen vào, không nộp đè |

Nút mở một cửa sổ đen, chạy `task-hangngay.mjs --nut` và **hỏi trước khi nộp**:

```
➜ Nộp lên work.hasaki.vn?  [Enter] nộp CẢ 8 task · [k] không nộp gì :
```

`Sắp xếp hàng hóa tại kho tổng` **không nằm trong lựa chọn nào** — nó ngoài phạm vi bot (mục 4).
Bấm nút bao nhiêu lần cũng vô hại: task đã nộp tự bỏ qua.

**Đã BỎ nhánh `[a] chỉ nhóm A` (20/08/2026) — nó là cái bẫy đã cắn đúng một ngày sau khi thêm.**
Chiều 20/08 người bấm nút chọn `[a]`; hai task nhóm B — #13371951 *Sắp xếp hàng hóa trong kho* và
#13373905 *Dán tem QC Fail* — bị lặng lẽ bỏ lại, log chỉ ghi `nộp 6 · bỏ qua 4` mà không một chữ
nào về hai task bị loại (6 + 4 = 10 trong khi hôm đó có 12 task — đó là dấu vết duy nhất).
Nay câu hỏi chỉ còn **nộp / không nộp**. Ai thật sự cần lọc riêng nhóm A thì dùng cờ `--nhom=A`
(nút *Chỉ nhóm A* của bot Telegram) — lựa chọn gõ tay, không phải một phím lỡ tay.

**Mạng rớt giữa chừng thì sao (bẫy 19/08/2026 10:23):** wshr sau Cloudflare có lúc không bắt tay
kịp — `fetchThuLai` thử 4 lượt (~66s) rồi ném, và vì mọi lời gọi nằm ở top-level await nên bản đầu
đổ nguyên stack `TypeError: fetch failed` ra cửa sổ nút. Nay mọi lối đứt liên lạc đều in một câu
tiếng Việt + "bấm nút lại", `exit 4`. Lượt POST nộp báo cáo **không tự thử lại** (không biết máy
chủ đã nhận chưa — thử lại có thể nộp đè lần hai); cứ bấm nút lại, task đã nộp tự bỏ qua.

**Vì sao vẫn còn chốt giờ 16h trong code:** task bắn 07:30–08:19, hạn 22:00, hướng dẫn ghi "kiểm kê
trên app trước 16:00" — nộp buổi sáng thì mọi con số còn bằng 0. Chế độ `--nop` (không hỏi) vẫn tự
chặn trước **15h** (`TASK_GIO_SOM_NHAT`). Chế độ `--nut` **bỏ** chốt này, vì đã có người xem bản
nháp rồi mới bấm — chính người bấm là cái chốt.

## 6. Dùng

```bash
node task-hangngay.mjs                # chỉ xem: bảng trạng thái + báo cáo nháp (không ghi gì)
node task-hangngay.mjs --nut          # NÚT: làm tươi số liệu cũ → in nháp → HỎI → nộp
node task-hangngay.mjs --nop          # nộp thật, KHÔNG hỏi (chỉ nộp từ 15h trở đi)
node task-hangngay.mjs --nop --ep     # nộp thật NGAY, bỏ chốt giờ
node task-hangngay.mjs --nop --task=<id>   # chỉ 1 task
```

`--nut` = `--nop --ep --hoi --lamtuoi` (dùng lẻ từng cờ cũng được):

- `--hoi` — in nháp xong thì dừng lại hỏi. **Không có bàn phím (stdin không phải TTY) ⇒ KHÔNG nộp
  gì rồi thoát**, để "bấm nút" luôn có nghĩa là có người thật bấm, kể cả khi ai đó nhét `--nut`
  vào Task Scheduler.
- `--lamtuoi` — mốc `.sync-ok-kiemke` / `.sync-ok-5s` cũ hơn `TASK_TUOI_TOI_DA` (mặc định **120'**)
  thì kéo lại trước khi soạn: `PC_DELTA=1 node push-pc-to-sheet.mjs` và/hoặc
  `KHONG_LOGIN=1 node auto-export-sync.js` (log vào `kiemke.log` / `auto-export.log`). Bỏ hẳn bước
  này nếu **không** còn task nhóm A nào đang chờ → lượt bấm vào cuối ngày không tốn lượt gọi nào.

Tự bỏ qua task đã nộp, task không phải của mình, task lạ chưa có trong sổ tay, và mọi trường hợp
thiếu dữ liệu thật. Nộp xong chạm mốc `.sync-ok-task-hangngay` và ghi 1 dòng tổng kết vào
`task-hangngay.log` (cửa sổ đen đóng là mất chữ, sổ thì còn).

## 7. Lịch — ĐÃ TẮT

| Task Scheduler | Trạng thái | Chạy |
|---|---|---|
| `5S Task hang ngay` | **Disabled 19/08/2026** (nhịp cũ: 16:00 + lặp mỗi 30' trong 2h) | `task-hangngay-hidden.vbs` → `TASK-HANG-NGAY.bat` |

Task vẫn còn đăng ký (cả trong `SETUP-PC-MOI.ps1`, dựng máy mới cũng dựng-rồi-tắt) để quay về nhịp
tự động chỉ mất 1 dòng:

```powershell
Enable-ScheduledTask -TaskName '5S Task hang ngay'    # bật lại tự nộp 16:00
Disable-ScheduledTask -TaskName '5S Task hang ngay'   # tắt, quay về bấm nút
```

`TASK-HANG-NGAY.bat` (đường không hỏi, dùng khi bật lại lịch) làm 2 bước:
1. **Làm tươi số liệu kiểm kê**: `PC_DELTA=1 node push-pc-to-sheet.mjs` — chỉ kéo cửa sổ HÔM NAY
   (vài lượt gọi WMS) để con số trong báo cáo đúng tại thời điểm 16h. Tắt: `TASK_BO_QUA_LAM_TUOI=1`.
2. **Nộp**: `node task-hangngay.mjs --nop`.

**Vì sao nhịp cũ lặp 30':** bot không bao giờ tự đăng nhập — nó cần phiên work của người đang sống.
Nếu 16:00 phiên đã chết, lượt đó chỉ ghi log rồi thôi; các lượt 16:30…18:00 vét lại. Với nút bấm
tay thì hết cần vét: người bấm lúc nào là lúc đó chắc chắn có phiên sống.

Log: `task-hangngay.log`. Bảng lịch tổng: `LICH-VA-DU-PHONG.md`.

## 8. Chạy bằng cơ chế gì (không có Claude vẫn chạy)

**Không có AI nào trong luồng chạy.** `task-hangngay.mjs` là script Node thuần, không gọi
Anthropic/OpenAI, không cần `ANTHROPIC_API_KEY`. Claude chỉ tham gia lúc *viết* nó (dò swagger, bóc
payload). Xoá Claude khỏi máy thì cái nút vẫn chạy y nguyên.

Chuỗi thật khi bấm nút:

```
Bấm shortcut Desktop  →  NUT-NOP-TASK.bat  (cửa sổ đen, chcp 65001 cho tiếng Việt)
   → node task-hangngay.mjs --nut
        1. layTokenSongWork()  — lấy token Bearer wshr từ kho token dùng chung
                                 (.wms-session/token-cache.json) hoặc từ extension cầu nối
                                 Edge của phiên bạn đang mở. KHÔNG tự đăng nhập, không OTP.
        2. GET  /api/news/notifications          → danh sách task hôm nay
        3. GET  /api/hr/projects/task-input/{id} → trạng thái dòng của mình
        4. mốc .sync-ok-* cũ > 120' VÀ còn task nhóm A đang chờ
             → node push-pc-to-sheet.mjs (PC_DELTA=1) / node auto-export-sync.js — làm tươi
        5. đọc file cache trong máy (.pc-cache.json, .exports/tasks-cache.json)
           + hỏi WMS số SKU treo F0-A0 → dựng chữ báo cáo → IN BẢN NHÁP ra cửa sổ
        6. HỎI người bấm:  Enter = nộp cả · k = không nộp
        7. POST /api/hr/projects/mass-update-field-task-input ×2 nhịp → nộp phần đã chọn
```

Ba thứ script này phụ thuộc, đều đã có sẵn trong dự án:
- **Kho token dùng chung** `token-store.js` — 1 lượt đăng nhập SSO buổi sáng đủ cho mọi bộ.
- **Extension cầu nối** `factory/wms-bridge` — khi bạn mở work.hasaki.vn, nó chuyển token phiên
  của bạn cho máy trạm; nhờ vậy bot không phải đăng nhập đè (đá phiên bạn).
- **Luật phiên** `session-rules.js` — không có phiên sống thì thoát êm (cửa sổ nút in
  `✗ Không có phiên work còn sống`, exit 2), mở work.hasaki.vn một lượt rồi bấm lại là xong.

Nghĩa là điều kiện duy nhất để nút nộp được: **hôm đó bạn có mở work.hasaki.vn / hr.hasaki.vn ít
nhất một lần** (hoặc cụm 8h40 đã đăng nhập và token 48h còn hạn).
