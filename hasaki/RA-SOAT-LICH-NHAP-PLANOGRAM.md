# Rà soát màn "Lịch trình khai báo" — lọc **Nháp**, kho 863 + 874 (đo 22/09/2026)

Nguồn: `GET {EXT}/planogram/schedule/location-schedules?...warehouse_ids=863,874` — **3 lượt gọi**,
danh sách đã trả sẵn `standard_image[]` nên không cần gọi chi tiết từng lịch.
Công cụ (chỉ đọc): `hasaki/.exports/_soi-lich-draft.mjs` · dữ liệu thô: `.exports/_lich-draft-snapshot.json`.

## 1. Bức tranh chung

| | Số lịch |
|---|---|
| Tổng lịch kho 170 | **406** |
| Nháp (màn đang xem) | **139** |
| Approved | 265 · Chờ duyệt 1 · Reject 1 |

139 lịch nháp đang có **198 dòng ảnh tiêu chuẩn**, nhưng chỉ **69 dòng có ảnh mẫu thật** (35 %).
Đối chiếu: 265 lịch Approved có 3.297 ảnh, **100 % đều đã gắn ảnh mẫu**.

## 2. Lịch nháp ĐÃ có ảnh / CHƯA có ảnh

| Nhóm | Số lịch | Ghi chú |
|---|---|---|
| **Đã có ảnh thật** (tên bộ phận + ảnh mẫu) | **14** | 4–9 ảnh/lịch, do `tamlc@` làm 18–19/09 |
| **Khai tên ảnh nhưng CHƯA gắn ảnh mẫu** | **2** | 22649 · 22650 (F1-A26 Phòng ăn nhân viên), 3 ảnh/lịch |
| **CHƯA có ảnh** — chỉ 1 dòng mặc định | **123** | 115 × "Trực diện" · 6 × "Kệ mâm sắt" · 2 × "Trực diện kệ mâm sắt"; đều **trống mô tả + không ảnh mẫu** |

**14 lịch đã có ảnh:**

| Lịch | Vị trí | Tên | Nhịp | Ảnh |
|---|---|---|---|---|
| 53362 | F0-CB-502-01-01-01 | Đầu vào băng truyền phân loại | Hàng ngày | 9 |
| 540792 | F0-A27-00-PCCC-00-00 | Phòng bơm cứu hoả | Weekly Mon | 7 |
| 540839 | F0-A19-502-01-01-01 | Băng chuyền xuất hàng số 2 | Weekly Mon | 5 |
| 53419 | F0-A19-502-01-01-01 | Băng chuyền xuất hàng số 2 | Hàng ngày | 5 |
| 540816 / 540825 / 540838 | F0-CB-503/504/505-01-01-01 | Băng truyền xuất 1/2/3 | Hàng ngày | 5 mỗi lịch |
| 540781 | F0-A19-503-02-01-01 | Bàn làm việc băng chuyền xuất | Weekly Mon | 5 |
| 540757 | F0-A24-501-01-01-01 | Phòng giặt sấy | Weekly Mon | 5 |
| 540773 | F0-A1-00-PCCC-00-00 | Vật tư PCCC SHOP | Weekly Mon | 4 |
| 540789 | F0-A2-00-PCCC-00-00 | Vật tư PCCC WH | Weekly Mon | 4 |
| 540774 | F0-A14-501-03-01-01 | Bàn làm việc số 3 | Weekly Mon | 4 |
| 540758 | F0-A15-501-04-01-01 | Ô đậu xe nâng điện đứng số 3 | Hàng ngày | 4 |
| 540771 | F0-A1-00-PCCC-00-00 | Vật tư PCCC SHOP (bản ngày 28) | Ngày 28 | 2 |

## 3. Trùng lịch

**30 vị trí đang có ≥2 lịch.** Chia 3 loại:

**(a) Trùng tuyệt đối — cùng vị trí + cùng nhịp → dư 19 lịch, xoá thẳng được:**

| Vị trí | Nhịp | Số bản | Lịch |
|---|---|---|---|
| F0-A20-501-01-01-01 | ngày 28 | 5 | 53418 · 53414 · 53408 · 53405 · 53354 |
| F0-A9-501-07-01-01 | ngày 28 | 4 | 53417 · 53413 · 53409 · 53404 |
| F0-A17-502-01-01-01 | ngày 28 | 4 | 53416 · 53415 · 53411 · 53407 |
| F0-A13-502-01-01-01 | ngày 11,21 | 3 | 22663 · 22641 · 22640 |
| F0-A11-504-03-01-01 | ngày 13,28 | 2 | 53445 · 53444 |
| F0-A18-502-01-01-01 | ngày 12,22 | 2 | 22656 · 22655 |
| F0-A18-502-02-01-01 | ngày 12,22 | 2 | 22634 · 22633 |
| F0-IT-00-00-00-00 | Hàng ngày | 2 | 508480 · 508478 |
| F1-A26-501-01-01-01 | ngày 13,28 | 2 | 22650 · 22649 (cùng 3 ảnh) |

**(b) Nháp đè lên lịch ĐÃ DUYỆT ở cùng vị trí — 8 lịch.** Duyệt tiếp là vị trí đó phát 2 yêu cầu:

| Nháp | Vị trí | Nháp | Lịch đã duyệt |
|---|---|---|---|
| 540789 | F0-A2-00-PCCC-00-00 | Mon / 4 ảnh | 540787 ngày 28 / 2 ảnh |
| 540781 | F0-A19-503-02-01-01 | Mon / 5 ảnh | 497267 Hàng ngày / 1 ảnh |
| 540774 | F0-A14-501-03-01-01 | Mon / 4 ảnh | 497265 Hàng ngày / 1 ảnh |
| 540758 | F0-A15-501-04-01-01 | **Hàng ngày** / 4 ảnh | 22712 **Hàng ngày** / 1 ảnh — trùng y hệt |
| 540757 | F0-A24-501-01-01-01 | Mon / 5 ảnh | 22710 gần-hàng-ngày / 1 ảnh (+ nháp 22709) |
| 22726 | F0-A18-502-03-01-01 | ngày 13,28 / 1 ảnh | 22652 **ngày 13,28** / 3 ảnh — trùng y hệt |
| 22709 | F0-A24-501-01-01-01 | ngày 13,28 / 1 ảnh | 22710 |
| 22617 | F0-A4-501-01-01-01 | Hàng ngày / 1 ảnh | 525544 ngày 28 / 1 ảnh |

**(c) Cùng vị trí, khác nhịp (do tách tần suất) — 22 vị trí**, phải gộp về 1 lịch nhịp dày nhất
theo luật đã chốt 16/09 (chu kỳ thưa hơn ghi ở mục "3. Chu kỳ" của mô tả ảnh):
F0-A1-00-PCCC · F0-A2-00-PCCC · F0-A11-504-01 · F0-A13-501-01 · F0-A16-501-05 · F0-A17-502-01 ·
F0-A19-502-01 · F0-A22-501-01 · F0-A6-501-03 · F0-A7-501-01/02/03 · F0-A9-501-04/07 · F1-A26-501-01
(+ 6 cặp đã nằm trong nhóm b, và 3 cặp giữa 2 lịch **đã duyệt**: F0-A1-00-CC, F0-A2-00-CC, F0-CB-501-01).

## 4. Đã đủ yêu cầu chưa? — **Chưa.**

So số ảnh hiện có với **số CỤM/HỆ THỐNG của kế hoạch bảo dưỡng 170** (38 mã vị trí, 155 dòng hạng mục,
file gốc đã sinh 290 dòng ảnh):

| | Vị trí |
|---|---|
| Đủ ảnh | **8** — F0-A19-501-01 · F0-A19-503-01 · F0-A27-00-PCCC · F0-CB-501-01 · F0-CB-502-02 · F0-CB-503-01 · F0-CB-504-01 · F0-CB-505-01 |
| Thiếu ảnh | **30** |
| Chưa có lịch | 0 |

Thiếu nhiều nhất: `F0-A15-501-02/03/04` (cần 18, có 4 → thiếu 14 ảnh mỗi vị trí) ·
6 cặp `TD-HN`/`TD-TG` của A1/A3/A7/A10/A15/A18 (cần 5 và 9, chỉ có 1–2 ảnh) ·
`F0-CB-502-01` (cần 14, có 9) · `F0-A4-501-01` (cần 6, có 1) · `F0-A12-501-02` (cần 6, có 1).

⇒ **File `IMPORT-ANH-TIEU-CHUAN-BAO-DUONG-170.xlsx` (290 dòng / 38 lịch) mới vào được ~1/5.**
Phần đã vào là 13 lịch tạo 18/09 + vài lịch sửa 19/09 (69 ảnh). Còn lại chưa import.

## 5. Phát hiện mới — **có nhịp "Hàng tuần" thật**

`schedule_repeat_type` nay có **3 = Weekly**, `schedule_detail` = thứ trong tuần (`Mon`).
7 lịch tạo 18/09 đang dùng. Ghi chú cũ "planogram không có nhịp mỗi tuần, chỉ Daily hoặc ngày trong
tháng" **đã sai** — không phải quy đổi hàng tuần thành `4,11,18,25` nữa.

## 6. Việc nên làm, theo thứ tự

1. **Xoá 19 lịch trùng tuyệt đối** (nhóm a) — không mất gì, chỉ bỏ bản sao.
2. **Chốt 8 cặp nháp ↔ đã duyệt** (nhóm b): giữ bản có ảnh (bản nháp mới) thì phải **huỷ/Inactive lịch
   đã duyệt cũ 1 ảnh**; nếu không, vị trí đó phát 2 yêu cầu chồng nhau.
3. **Gộp 22 vị trí khác nhịp** về 1 lịch nhịp dày nhất.
4. **Import nốt ảnh tiêu chuẩn** cho 30 vị trí còn thiếu, rồi mới xin duyệt.
5. Riêng **22649/22650** (Phòng ăn): đã có 3 tên ảnh nhưng thiếu ảnh mẫu → gắn ảnh rồi xoá 1 bản.

---

# BỔ SUNG 22/09/2026 — đã xử lý bản sao + truy nguyên nhân trùng

## 7. Planogram KHÔNG có đường XOÁ lịch

Dò thật trên lịch 53418 (`.exports/_do-duong-xoa-lich.mjs`):

| Thử | Kết quả |
|---|---|
| `DELETE /location-schedules/{id}` · `?ids=` · body `{ids}` | **404 page not found** |
| `POST /location-schedules/delete` | 404 |
| `PUT /location-schedules/delete-many` | 400 — bị hiểu thành `PUT /{schedule_id}` |

Bundle giao diện (`_chunk/putScheduleOfDeclaration-*.js`) chỉ có 7 hành động:
`approve · reject · toggle/status/{id} · {id} (sửa) · {id}/devide · toggle/status/detail · re-open`.
⇒ **"Xoá" = `PUT /toggle/status/{id}` → `status_id` 1 (Active) ↔ 2 (Inactive)**. Là TOGGLE nên
gọi lại là bật lên — **hoàn tác được**.

## 8. Đã TẮT 14 lịch trùng thật (không phải 19)

Con số 19 ở mục 3 đếm theo **vị trí + nhịp**. Khi mở chi tiết từng lịch xem SKU bên trong
(`.exports/_soi-chitiet-trung.mjs`), chỉ **14 lịch là bản sao thật** (cùng vị trí + cùng nhịp +
**cùng SKU**); 5 lịch còn lại mang **thiết bị khác**, tắt là mất hẳn thiết bị đó nên đã giữ lại.

| Vị trí | Nhịp | SKU | Giữ | Đã tắt |
|---|---|---|---|---|
| F0-A20-501-01-01-01 | ngày 28 | 422214859 Quạt treo CN | 53405 | 53408 · 53414 · 53418 |
| F0-A9-501-07-01-01 | ngày 28 | 422214859 | 53404 | 53409 · 53413 · 53417 |
| F0-A17-502-01-01-01 | ngày 28 | 422214859 | 53407 | 53411 · 53415 · 53416 |
| F0-A13-502-01-01-01 | ngày 11,21 | 422216782 Máy scan 3D | 22640 | 22641 |
| F0-A11-504-03-01-01 | ngày 13,28 | 422203849 Quạt đảo trần | 53444 | 53445 |
| F0-A18-502-01-01-01 | ngày 12,22 | 422206777 Xe nâng tay cao | 22655 | 22656 |
| F0-A18-502-02-01-01 | ngày 12,22 | 422210846 Xe nâng ngồi | 22633 | 22634 |
| F1-A26-501-01-01-01 | ngày 13,28 | 422202854 Quạt trần đảo | 22649 (3 ảnh) | 22650 (3 ảnh) |

14/14 đã xác nhận `status_id 1 → 2`. Công cụ: `.exports/_tat-lich-trung.mjs` (dry-run mặc định,
`--that` mới chạy). Bản lưu trước khi tắt: `.exports/_backup-truoc-khi-tat-2026-09-22.json`.

## 9. Trả lời: **có phải do g-sheet khai mỗi SKU/hạng mục là 1 yêu cầu riêng?**

**14 bản sao vừa tắt — KHÔNG phải.** Chúng tạo **15/09/2025 và 06/10/2025** bởi `api@hasaki.vn`,
tức **trước kế hoạch bảo dưỡng gần một năm**. Và 13/15 SKU trong đó **không có trong kế hoạch**
(quạt treo công nghiệp, máy scan 3D, máy lạnh Midea, mâm sắt V, nẹp V, máy rửa xe…). Đúng dấu hiệu
một lượt import chạy lặp: SKU **422214859** bị nhân **4 bản ở 3 vị trí khác nhau**, nội dung y hệt.

**27 vị trí còn trùng — ĐÚNG là cơ chế đó.** Soi chi tiết thì **cả 27/27 đều là "mỗi thiết bị/SKU
một lịch riêng"**, không còn vị trí nào trùng do cùng SKU. Nhưng chỉ **2 vị trí là do file của mình**:

| Vị trí | Hai lịch | Vì sao |
|---|---|---|
| F0-A1-00-PCCC-00-00 | 540773 T.tuần Mon (7 SKU, 4 ảnh) + 540771 ngày 28 (8 SKU, 2 ảnh) | cùng tạo 18/09 — file khai **2 chu kỳ khác nhau cho cùng 1 vị trí** ⇒ hệ sinh 2 lịch |
| F0-A2-00-PCCC-00-00 | 540789 T.tuần Mon (5 SKU, 4 ảnh) + 540787 ngày 28 (5 SKU, 2 ảnh) | như trên |

5 vị trí khác là **lịch mới của mình nằm cạnh lịch cũ của IT**, không phải mình tự nhân đôi:
A14-501-03 · A15-501-04 · A19-502-01 · A19-503-02 · A24-501-01.
20 vị trí còn lại là lịch cũ của `api@` (2025 → 08/2026), mỗi thiết bị một lịch.

## 10. Vì sao chưa tắt 27 vị trí đó

1. **Tắt là mất thiết bị**: mỗi lịch mang SKU khác nhau, ví dụ F0-IT có 508478 (xe nâng ngồi) và
   508480 (dàn con lăn băng tải) — tắt bản nào cũng mất hẳn phần bảo dưỡng của máy đó.
2. **Lịch Nháp không phát yêu cầu nào** nên trùng ở mức Nháp **chưa gây hại gì**. Chỉ 9 vị trí có
   dính lịch Approved mới thật sự phát 2 yêu cầu: A1-CC · A2-CC · A14-501-03 · A15-501-04 ·
   A18-502-03 · A19-503-02 · A24-501-01 · A4-501-01 · CB-501-01.
3. **Cách đúng là GỘP, không phải tắt**: giữ 1 lịch/vị trí, dồn mọi SKU của vị trí vào lịch đó,
   rồi mới tắt lịch dư. Với cặp Approved–Nháp thì phải **duyệt lịch mới (đã có ảnh) TRƯỚC**, tắt
   lịch cũ sau, nếu không vị trí đó bị trống lịch.

Có 5 vị trí mà **SKU của lịch này nằm trọn trong lịch kia** — tắt bản con không mất thiết bị nào,
chỉ đổi nhịp: `22720⊂22719` (A11-504-01) · `22727⊂22728` (A13-501-01) · `22666⊂22665` (A16-501-05) ·
`22717⊂22718` (A22-501-01) · `22710⊂22709` (A24-501-01, bản cha là Nháp nên phải duyệt trước).
Cả 4 cặp đầu đều Nháp/0 ảnh thật — chờ user chốt nhịp nào giữ thì tắt được ngay.

---

# BỔ SUNG 2 — 22/09/2026: **xoá được thật, ở tab Quản lý sản phẩm** (user chỉ đúng)

## 11. Cơ chế thật: **bản ghi SKU sinh ra lịch**

Mỗi bản ghi ở `asset-management/product-management/expected-stock` mang **nhịp riêng của nó**
(`schedule_repeat_type` + `schedule_time`) và cờ **`single_declaration`**. Số lịch tại một vị trí =
(số bản ghi khai **RIÊNG**) + (số **nhóm nhịp** trong các bản ghi khai **gộp**). Kiểm đúng ở F1-A26:
4 bản ghi Hàng ngày/gộp → 1 lịch, 1 bản ghi ngày 13,28/RIÊNG → 1 lịch = 2 lịch.

API của tab đó (đọc từ bundle `assets/index-724H8uWL.js`), gốc
`/planogram/schedule/product-schedules/expected-stocks`:

| Hành động | Đường |
|---|---|
| Thêm | `POST /expected-stocks` |
| Sửa (đổi nhịp, số lượng) | `PUT /expected-stocks/{schedule_id}` |
| **XOÁ** | **`PUT /expected-stocks/delete`** body `{"ids":[<id bản ghi>]}` |
| Bật/tắt hàng loạt | `PUT /expected-stocks/update-statuses` body `{ids, status_id}` |
| Khai báo đơn lẻ | `PUT /expected-stocks/toggle/single-declaration/{id}` |
| Bật/tắt 1 bản ghi | `PUT /expected-stocks/toggle/status/{id}` |

`ids` là **id BẢN GHI** (cột id, vd 22582), không phải schedule_id. **Chưa gọi `delete` lần nào** —
xoá bản ghi nghĩa là "thiết bị này không còn ở vị trí này", chỉ đúng khi khai sai.

## 12. Cách xoá lịch trùng ĐÚNG NHẤT: gạt "Khai báo đơn lẻ" → gộp

Làm thật 22/09 và **hệ tự xoá lịch dư** (không cần xoá bản ghi):

| Vị trí | Trước | Sau | Lịch bị hệ bỏ hẳn |
|---|---|---|---|
| F0-A20-501-01-01-01 | 5 lịch (2 bản ghi RIÊNG ngày 28) | **1 lịch 53418**, qty 1+2=3 | 53405 · 53408 · 53414 · 53354 |
| F0-A13-502-01-01-01 | 3 lịch (1 bản ghi RIÊNG ngày 11,21) | **1 lịch 22663**, qty 3 | 22640 · 22641 |

Tổng lịch kho 170: **406 → 400**. Lịch sống sót là **id lớn nhất**, quantity **cộng dồn**, và lịch
đang Inactive cũng được bật lại thành lịch chung ⇒ đây là cách "xoá" gọn nhất, không mất thiết bị nào.

## 13. Trả lời dứt điểm: nguyên nhân trùng — **đúng là do khai mỗi thiết bị một yêu cầu riêng**

Quét 126 bản ghi ở 27 vị trí trùng: **0 cặp bản ghi trùng SKU** (không có khai trùng). Trùng lịch
đến từ đúng 2 nguồn:

| Nguồn | Số |
|---|---|
| Bản ghi bật **"Khai báo đơn lẻ = RIÊNG"** (mỗi thiết bị 1 lịch) | **22 bản ghi** |
| Vị trí có **2 nhóm nhịp** khác nhau trong các bản ghi gộp | 7 vị trí |

Thiết bị hay bị khai RIÊNG: `422214859` quạt treo CN (4 chỗ) · `422207186` quạt SUPER WIN (4 chỗ) ·
`297500306/297500307` (2 chỗ) · **`422227323` (3 chỗ — nhịp T.tuần Mon, chính là lô 18/09 của mình)** ·
`422223729` xe nâng · `422216782` · `422202854` · `297500215` · `422205960`.

⇒ Với **5 vị trí của lô 18/09** (A14-501-03 · A15-501-04 · A19-502-01 · A19-503-02 · A24-501-01),
lịch mới bị tách ra vì bản ghi để **RIÊNG** — đúng như mình đoán. Còn 14 bản sao đã tắt ở mục 8 thì
**không phải**, vì **không có bản ghi nào trùng SKU** ⇒ chúng là **lịch mồ côi** do import cũ chạy lặp.
F0-IT là ví dụ rõ nhất: **0 bản ghi mà vẫn 2 lịch** (508478, 508480) ⇒ chỉ tắt được, không gộp được.

## 14. Còn 25 vị trí — vì sao phải hỏi trước khi gộp

| Nhóm | Vị trí | Vướng |
|---|---|---|
| **Gộp là ĐỔI TẦN SUẤT thiết bị** | A4-501-01 · A6-501-03 · A7-501-01/02/03 · A9-501-04 · A9-501-07 · A14-501-03 · A17-502-01 · A19-502-01 · A19-503-02 · A24-501-01 · CB-501-01 · F1-A26-501-01 | bản ghi RIÊNG đang nhịp **tháng**, nhóm chung là **Hàng ngày** ⇒ gộp là kéo quạt/xe nâng từ 1–2 lần/tháng thành **mỗi ngày** |
| **Gộp làm mất ảnh / rơi lịch đã duyệt** | A15-501-04 (540758 4 ảnh Nháp ↔ 22712 Approved) · A18-502-03 (22726 1 ảnh ↔ **22652 Approved 3 ảnh**) | lịch sống sót là id lớn nhất ⇒ A18 sẽ mất 3 ảnh của 22652; A15 thì lịch chung thành Nháp nên **ngừng phát yêu cầu đến khi duyệt** |
| **Phải đổi nhịp 15 bản ghi mới gộp được** | A1-00-PCCC (Mon ×8 + ngày 28 ×7) · A2-00-PCCC (Mon ×5 + ngày 28 ×5) | 2 nhóm nhịp, không phải RIÊNG |
| **Lịch mồ côi, chỉ tắt được** | F0-IT (2 lịch/0 bản ghi) · A1-00-CC 540631 · A2-00-CC 540633 (tạo bằng import lịch, không gắn SKU) | không có bản ghi để gộp |

---

# BỔ SUNG 3 — 22/09/2026: đã gộp 3 ô, và 2 luật mới học được

## 15. Đã làm

| Ô | Trước | Sau | Lịch WMS xoá hẳn |
|---|---|---|---|
| F0-A20-501-01-01-01 | 5 lịch | **1 lịch 53418** · qty 3 | 53405 · 53408 · 53414 · 53354 |
| F0-A13-502-01-01-01 | 3 lịch | **1 lịch 22663** · qty 3 | 22640 · 22641 |
| F0-A15-501-04-01-01 | 2 lịch (540758 Nháp 4 ảnh + 22712 Đã duyệt 1 ảnh) | **1 lịch 22712** · qty 14 · 3 SKU · **4 hạng mục ảnh của xe nâng** | 540758 |

Tổng lịch kho 170: **406 → 399**. Cộng 14 lịch bản sao đã gạt Inactive hôm qua (mục 8).

## 16. SỬA luật ở mục 12 — **lịch NHÓM sống, lịch RIÊNG bị xoá** (không phải "id lớn nhất")

Khi gạt một bản ghi từ RIÊNG → gộp: bản ghi nhập vào **lịch của nhóm cùng nhịp đang có**, và
**lịch riêng của nó bị WMS xoá hẳn**. Ở A20 cả 2 bản ghi đều RIÊNG (không có nhóm) nên WMS dựng
nhóm mới và hồi sinh 53418. Ở A15 nhóm là 22712 (cũ, Đã duyệt) nên **540758 với 4 ảnh bị xoá**.
⇒ **Phải sao lưu ảnh của lịch RIÊNG trước khi gộp** (tool `_gop-2-vitri.mjs` tự chụp
`_gop2-backup-<ô>-<giờ>.json`).

## 17. Hai điều API KHÔNG làm được (đo thật hôm nay)

1. **Không gắn được ảnh mẫu cho lịch đã từng duyệt.** `PUT /location-schedules/{id}` với
   `standard_image[].image` trả `result:1` nhưng **server bỏ trường `image`** (thử cả URL đầy đủ,
   đường dẫn tương đối, ảnh mới upload, gửi cả item). Tên ảnh + mô tả thì ghi được bình thường.
2. **Không đưa được lịch Nháp → Chờ duyệt.** `PUT /approve` chỉ nhận lịch đang *Waiting for approve*
   (payload đúng là **`{schedule_ids:[id]}`**, không phải `{ids:[…]}` — dùng `ids` thì server đi
   duyệt bản ghi khác, rất dễ gây tai nạn). `re-open` chỉ chạy trên lịch **Approved**
   (payload `{schedule_id:id}`) và đưa về Nháp. `PUT /{id}` với `loc_sched_status_id:2` trả 200 nhưng
   không đổi gì. Không có route `delete` / `cancel` cho lịch (mọi biến thể rơi vào handler
   `PUT /{schedule_id}`).

⇒ **Việc còn lại phải bấm trên giao diện**: lịch **22712** (F0-A15-501-04-01-01) đang **Nháp** nên
**ô đó tạm ngừng phát yêu cầu** — cần bấm **Phê duyệt** như đã làm với 540787/540633/540627 hôm 21/09.

## 18. Chưa gộp F0-A18-502-03 — và vì sao

Ở ô đó bản ghi RIÊNG là **quạt 422207186 → lịch 22652 (Đã duyệt, 3 ảnh thật)**, còn nhóm là
**máy rửa xe 422229644 → lịch 22726 (Nháp, 1 ảnh mặc định)**. Theo luật ở mục 16, gộp sẽ **xoá đúng
22652 và giữ 22726** — ngược hẳn ý "lấy thông tin theo lịch tốt". Hai cách đúng:
· **(a)** giữ 2 lịch (chúng là 2 máy khác nhau, cùng nhịp 13,28) — không mất gì; hoặc
· **(b)** đưa máy rửa xe vào lịch 22652: gạt bản ghi **máy rửa xe** sang RIÊNG rồi gạt **quạt** về
  gộp thì nhóm sẽ là quạt… vẫn không đảo được thứ tự ⇒ thực tế phải **thêm hạng mục ảnh máy rửa xe
  vào 22652** (làm trên giao diện, vì API không ghi được ảnh mẫu cho lịch đã duyệt) rồi mới gộp.

---

# BỔ SUNG 4 — 22/09/2026: xoá 22726 + đồng bộ tiêu chuẩn theo g-sheet

## 19. F0-A18-502-03 — đã xoá 22726, giữ 22652

Không xoá được lịch trực tiếp, nên xử ở **gốc sinh ra nó**: bản ghi **22449** (Máy rửa xe Toàn Phát,
khai *gộp*) chính là nguồn của lịch 22726. Gạt bản ghi đó sang **Không hoạt động**
(`PUT /expected-stocks/toggle/status/22449`, hoàn tác được) ⇒ **WMS xoá luôn lịch 22726**.
Lịch 22652 (quạt SUPER WIN, 3 ảnh) nhảy sang *Chờ duyệt* vì nội dung ô đổi → đã **duyệt lại**
(`PUT /approve {schedule_ids:[22652]}`) → **Đã duyệt, 3 ảnh đủ ảnh mẫu**.
Tổng lịch kho 170: 399 → **398**. Bản lưu: `.exports/_backup-A18-502-03-truoc-xoa.json`.
(Máy rửa xe **không nằm trong kế hoạch bảo dưỡng** — kiểm cả 155 dòng g-sheet, không có dòng nào cho
A18-502 hay SKU 422229644 — nên không mất hạng mục nào của kế hoạch.)

## 20. Đồng bộ tiêu chuẩn với g-sheet BAO-DUONG-170 — tool `_ghi-anh-tieu-chuan.mjs`

Đọc live tab `BAO-DUONG-170` (155 đầu việc / 38 vị trí), dựng bộ ảnh tiêu chuẩn đúng khuôn 4 phần
đang dùng (`1. Hạng mục kiểm tra · 2. Nội dung công việc · 3. Chu kỳ · 4. Tiêu chuẩn báo cáo`),
rồi so với lịch thật và **ghi thẳng bằng API**. Giữ nguyên ảnh cũ trùng tên, giữ ảnh riêng của lịch,
chỉ bỏ ảnh mặc định "Trực diện" trống mô tả.

**Đã ghi 12 lịch** (+1 đã khớp sẵn) ⇒ **13/38 vị trí khớp hoàn toàn với g-sheet**:

| Vị trí | Lịch | Ảnh sau khi ghi |
|---|---|---|
| F0-A15-501-04-01-01 | 22712 | 4 → **17** |
| F0-CB-502-01-01-01 | 53362 | 9 → **17** |
| F0-A19-502-01-01-01 | 53419 | 5 → **13** |
| F0-A24-501-01-01-01 | 22709 | 1 → **8** |
| F0-A19-503-02-01-01 | 540781 | 5 → **8** |
| F0-A14-501-03-01-01 | 540774 | 4 → **7** |
| F0-A1-00-PCCC / F0-A2-00-PCCC | 540773 / 540789 | 4 → **6** |
| F0-A4-501-01-01-01 | 22617 | 1 → **6** |
| F0-CB-503/504/505 | 540816/540825/540838 | 5 (đã đúng, chỉ chuẩn lại mô tả) |
| F0-A27-00-PCCC-00-00 | 540792 | 7 (đã khớp sẵn) |

## 21. Hai giới hạn còn lại

**(a) 25 vị trí có lịch ĐÃ DUYỆT — API không cho sửa ảnh.** Cần thêm tổng **180 dòng ảnh**.
Đã xuất sẵn file đúng khuôn import: `.exports/IMPORT-ANH-TIEU-CHUAN-LICH-DA-DUYET.xlsx`
(sheet `Template import` 3 cột + sheet `0-DOI-CHIEU`). Nạp ở màn **Lịch trình khai báo → nút giữa
góc phải bảng → "Tải hình ảnh tiêu chuẩn"**. Thiếu nhiều nhất: A15-501-02 và A15-501-03 (mỗi lịch
thêm 13 ảnh), 6 cặp `TD-HN`/`TD-TG` (thêm 4 và 7), A12-501-02 (thêm 5), A4-504-01 (thêm 5).
**Chưa chạy** vì import sẽ đẩy lịch sang trạng thái `DraftImage` (mã 5 trong bảng trạng thái của
planogram: 1 Draft · 2 Waiting · 3 Approved · 4 Rejected · **5 DraftImage**) — chưa đo được lúc đó ô
còn phát yêu cầu hay không, mà đây là 25 ô **đang phát**.

**(b) Ảnh mẫu (ảnh minh hoạ của từng hạng mục) KHÔNG ghi được bằng API.**
`PUT /location-schedules/{id}` nhận `image_name` + `image_description` nhưng **luôn bỏ trường `image`**
— thử ảnh mới upload, URL đầy đủ, đường dẫn tương đối, gửi cả item, trên cả lịch Draft chưa từng
duyệt. ⚠ Hai tool cũ `_gan-anh-mau-api.mjs` / `_gan-anh-mau-nhieu.mjs` chỉ xem `result:1` nên **báo
"gắn xong" sai** — phải kiểm lại bằng detail. Ảnh mẫu phải gắn trong giao diện (nút upload từng ảnh).
Hiện 69 mục đã có ảnh mẫu từ trước vẫn giữ nguyên; các mục mới thêm hôm nay chưa có ảnh mẫu.

**Bẫy dữ liệu:** `gid=328457741` của tab BAO-DUONG-170 **đã đổi** — gọi gviz theo gid nay trả tab
rỗng (6 cột, 0 dòng). Phải gọi theo **tên tab**. Tool mới đã dùng tên tab.

## 22. Thử 1 ô (22690 Máy Nén Khí) — kết quả quyết định cách làm 24 ô còn lại

| Bước | Kết quả |
|---|---|
| Nạp file import khi lịch đang **Đã duyệt** | **CHẶN** — `Schedule Id 22690 is not in status Draft or Reject` (3/3 dòng lỗi) |
| `PUT /re-open {schedule_id}` | 200 → lịch về **Nháp** |
| Nạp lại file import (Kiểm tra → Lưu dữ liệu) | **3/3 hợp lệ, lưu xong** (`POST excel-standard-image/validate` rồi `/import` → `result:1`) |
| Mô tả sau import | đúng g-sheet (742 → **1.633** ký tự, 532 → 762, 352 → 684) |
| **Ảnh mẫu sau import** | **MẤT cả 3** — file import không có cột ảnh nên nó **ghi đè danh sách và xoá ảnh mẫu đang có** |
| `PUT /approve` | vẫn chặn: chỉ nhận lịch *Waiting for approve* ⇒ phải bấm **Phê duyệt** trên giao diện |

⇒ **KHÔNG dùng file import cho 24 ô còn lại** (chúng đang có 69 ảnh mẫu, import là xoá sạch).
**Cách đúng, không mất gì:**
1. `PUT /location-schedules/re-open {schedule_id}` — chạy được trên lịch Đã duyệt, đưa về Nháp;
2. `node .exports/_ghi-anh-tieu-chuan.mjs --o <mã ô> --lam` — tool **giữ nguyên ảnh mẫu của các mục
   đang có** (truyền lại `image` cũ) và chỉ thêm mục còn thiếu;
3. người dùng bấm **Phê duyệt** trên giao diện (API không có đường Nháp → Chờ duyệt).

Ảnh mẫu bị mất ở 22690 là **đúng tấm ảnh mẫu chung** `ANH-MAU-CHUP-HIEN-TRANG-9x16.jpg` mà cả kho
dùng chung ⇒ gắn lại trong giao diện 1 lượt là xong.

**Đang chờ người dùng bấm Phê duyệt:** lịch **22712** (F0-A15-501-04, 17 ảnh) và **22690**
(F0-A18-501-01, 3 ảnh) — cả hai đang Nháp nên 2 ô đó tạm ngừng phát yêu cầu.

---

# BỔ SUNG 5 — 22/09/2026: **38/38 vị trí đã khớp g-sheet**, và 1 việc bị tắc

## 23. Đã ghi xong toàn bộ tiêu chuẩn

Chạy `_ghi-anh-tieu-chuan.mjs --mo-lai --lam`: với 24 lịch **đã duyệt** thì `re-open` trước (về Nháp)
rồi ghi, **giữ nguyên ảnh mẫu đang có** (truyền lại `image` cũ) và chỉ thêm mục thiếu.
**24/24 thành công, 0 lỗi.** Kết quả cuối: `_ghi-anh-tieu-chuan.mjs` báo **38 vị trí · đã khớp 38**.
Kho 170: **398 lịch · 3.654 ảnh tiêu chuẩn** (3.357 có ảnh mẫu; 297 mục mới thêm hôm nay chưa có).

Thêm nhiều nhất: A15-501-02 và A15-501-03 (+13 ảnh mỗi lịch) · 6 cặp `TD-TG` (+7) · `TD-HN` (+4) ·
A12-501-02 (+5) · A4-504-01 (+5) · 2 ô Cửa Cuốn (+4) · CB-502-02 (+2) · 2 ô LED (+1).

## 24. TẮC: không có đường đưa lịch Nháp → Chờ duyệt

Đã dò hết, **không có cách nào** (cả API cả giao diện) để **gửi duyệt** một lịch đang Nháp:

| Đường thử | Kết quả |
|---|---|
| `PUT /approve {schedule_ids}` | 400 — chỉ nhận lịch *Waiting for approve* |
| `PUT /{id}` với `loc_sched_status_id: 2` | 200 nhưng **không đổi** |
| Sửa bản ghi expected-stock (PUT y nguyên giá trị) | không đổi (lịch Approved thì đổi → Waiting, lịch Nháp thì không) |
| Gạt "Khai báo đơn lẻ" 2 lần | không đổi |
| Import "Tải thông tin lịch trình" (`excel-detail`) | 1/1 hợp lệ, lưu xong — **vẫn Nháp** |
| Trang **chi tiết lịch** của bản Nháp | chỉ có `Thêm tiêu chuẩn đánh giá · Thêm tiêu chuẩn · Lưu`. Nút **Phê duyệt/Từ chối chỉ hiện khi lịch ở *Chờ duyệt***; lịch *Đã duyệt* chỉ có **Mở lại** (đọc từ bundle `index-CnXNLzBA.js`) |

**Bằng chứng về đường thật:** lịch **22616** (F0-A7-501-03) nằm ở *Chờ duyệt* từ **07/08/2026**, do
**`api@hasaki.vn`** đặt ⇒ trạng thái *Chờ duyệt* do **trình import tạo lịch** (tài khoản api@) sinh ra,
không phải do người bấm. Nghi là template **`SCHEDULE_LOCATION_MANAGEMENT`** (`LocationOfSchedule_*.xlsx`,
14 cột **có cột `Status Id`**) — import đó nằm ở **app WMS**, chưa tìm ra màn.

## 25. Hệ quả cần xử ngay — 26 lịch đang Nháp

Để thêm được tiêu chuẩn, 25 lịch **đã duyệt** phải `re-open` ⇒ chúng **đang ở Nháp**, cộng 22712 từ
đợt gộp = **26 lịch**. Lịch Nháp **không phát yêu cầu**, nên **từ sáng mai 26 ô này không phát yêu cầu
vệ sinh/bảo dưỡng** cho tới khi được duyệt (yêu cầu của hôm nay đã phát lúc sáng nên hôm nay chưa ảnh hưởng).

**Danh sách cần duyệt (26):**
`540625` A1-00-CC · `540552` A1-00-LED · `540619` A1-5L2-TD-HN · `540620` A1-5L2-TD-TG ·
`540568` A10-00-TD-HN · `540569` A10-00-TD-TG · `22679` A12-501-02 · `540570` A15-00-TD-HN ·
`540571` A15-00-TD-TG · `22730` A15-501-02 · `22691` A15-501-03 · `22712` A15-501-04 ·
`540572` A18-00-TD-HN · `540573` A18-00-TD-TG · `22690` A18-501-01 · `22669` A19-501-01 ·
`22681` A19-503-01 · `540627` A2-00-CC · `540574` A2-00-LED · `540621` A3-00-TD-HN ·
`540622` A3-00-TD-TG · `22613` A4-504-01 · `540623` A7-00-TD-HN · `540624` A7-00-TD-TG ·
`53439` CB-501-01 · `22680` CB-502-02

**Cần biết:** ai/màn nào đưa lịch sang *Chờ duyệt*. Hôm nay có `phaphpv@hasaki.vn` cũng đang làm
trong planogram (sửa lịch 22721 lúc 10:57) — hỏi được thì nhanh nhất.

---

# BỔ SUNG 6 — 22/09/2026: đã cập nhật trạng thái vào g-sheet bảo dưỡng

## 26. Trước khi làm: cột đó **chưa** được cập nhật

Cột **R "KHAI BÁO PLANOGRAM"** của tab `BAO-DUONG-170` vẫn là bản **16/09**
(`Đã nhập 16/09 · lịch … · Nháp`, và 78 dòng Bảo trì / KT cơ điện vẫn ghi `Để riêng — chưa nhập`).
Tab `TRANG-THAI-WMS` cũng còn mốc **18/09**.

## 27. Đã làm

**Thêm đường ghi 1 cột cho GAS.** `syncTasks` ghi đè cả tab nên không dùng được cho bảng nhiều định
dạng này ⇒ thêm action **`ghiCot`** vào `google-script.gs` (ghi đúng 1 cột, không clear tab, chặn
ghi lên hàng tiêu đề, có LockService) rồi `node deploy-gas.mjs --deploy` (bản **@92**, URL không đổi).
Lưu ý: sau deploy Google cần ~1 phút mới phục vụ bản mới — gọi ngay sẽ nhận
`Action không hỗ trợ: ghiCot`, cứ chờ rồi gọi lại.

**Soạn lại cột R theo trạng thái thật** (`_soan-cot-khaibao.mjs` → `_ghi-cot-khaibao.mjs`):
mỗi mã vị trí trên dòng cho ra một dòng con
`Cập nhật 22/09 · lịch <id> (<nhịp>) · <trạng thái> · <n> ảnh · ✓ đã có ảnh tiêu chuẩn`,
trong đó dấu ✓/✗ là **kiểm đúng cụm của chính dòng đó** có nằm trong bộ ảnh của lịch hay không.
Kết quả: **154/155 dòng khớp** (dòng 159 là dòng rỗng của bảng, giữ nguyên ghi chú
`Bỏ — dòng không có nội dung`) · **467/470 lượt mã vị trí ✓ đã có ảnh**, 3 lượt ✗ đều thuộc đúng
dòng 159 đó ⇒ **không còn đầu việc thật nào thiếu ảnh tiêu chuẩn**.
Cũng cập nhật lại **dải chú thích dòng 2** (bỏ câu "mọi lịch còn Nháp, chưa gửi duyệt" của 16/09,
ghi rõ 38/38 mã vị trí đã có ảnh + 26 lịch đang Nháp + 297 mục chưa có ảnh mẫu).

## 28. BẪY đã cắn (ghi lại cho lần sau): **gviz bỏ dòng trống, lệch 1 dòng**

Lượt ghi đầu bị **lệch đúng 1 dòng** (ghi cả lên hàng tiêu đề). Nguyên nhân: bảng có
**dòng 1 tiêu đề · dòng 2 dải chú thích · dòng 3 TRỐNG · dòng 4 tên cột · dữ liệu 5…159**, mà
**gviz bỏ hẳn dòng 3 trống** nên chỉ số dòng của gviz KHÔNG dùng được để ghi theo vị trí.
⇒ Muốn ghi theo toạ độ thì phải lấy **lưới thật**:
`https://docs.google.com/spreadsheets/d/<id>/export?format=xlsx` (2 sheet này "anyone: reader" nên
tải không cần token) rồi đọc bằng **SheetJS** (openpyxl vỡ vì trùng tên Table1).
Đã sao lưu cột cũ ở `.exports/_backup-cot-khaibao-*.json` và dải chú thích ở
`.exports/_backup-dai-chu-thich-A2.txt`.
