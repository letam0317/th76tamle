# Tự tra: "Vì sao số lượng cuộn vải / thùng hàng bị đổi?"

> Dành cho người không rành kỹ thuật. Làm hoàn toàn bằng chuột trên web WMS, không cần code.
> Viết ngày 17/09/2026, kiểm chứng bằng ca thật: nhóm `1028260227000346` (71.609 → 71.200).

---

## 0. Hiểu trước 1 điều, đỡ hoang mang

Trên WMS có **hai loại số**, rất dễ nhầm:

| | Ví dụ | Bản chất |
|---|---|---|
| **Số trong tab `group-history`** | 71.609 | **Nhật ký**. Ghi lại số tại đúng giây phút xảy ra việc đó, rồi **khoá lại vĩnh viễn**. Giống dòng bút mực trong sổ: hàng vơi đi thì dòng cũ vẫn nằm nguyên. |
| **Số ở màn tồn kho / màn Group UID** | 71.200 | **Số hiện tại**. |

➡️ **Hai số này khác nhau là CHUYỆN BÌNH THƯỜNG, không phải lỗi dữ liệu.**
Đừng bao giờ lấy tab lịch sử đi đối soát với tồn kho.

Câu hỏi đúng phải là: *"số đã đổi vào lúc nào, ai đổi, vì sao?"* — và dưới đây là cách tra.

---

## 1. Sáu bước bấm chuột

### Bước 1 — Lấy mã SKU của món hàng
Vào màn Group UID đang xem, nhìn cột tên hàng, lấy dãy số đứng trước dấu gạch.
> Ví dụ: `422423786 - Vải Weft knit jacquard/BC01232PIH_XYX/...` → **SKU = 422423786**

### Bước 2 — ⚠️ CHỌN ĐÚNG CÔNG TY (bẫy số 1, hay sai nhất)
Góc trên bên **trái**, ngay dưới chữ HASAKI WMS, có ô chọn công ty.

* Vải, nguyên phụ liệu, hàng nhà máy → chọn **Mastige Co., Ltd.**
* Nếu để mặc định **Hasaki Vietnam** → màn hình sẽ báo **"No data"** và bạn sẽ tưởng là không có dữ liệu.

### Bước 3 — Vào menu Physical Count → Physical Count Result → tab **SKU**
Menu bên trái: `Physical Count` → `Physical Count Result`.
Ở trên cùng có 5 tab, bấm tab **SKU** (không phải "Location count result").

### Bước 4 — ⚠️ NỚI RỘNG KHOẢNG NGÀY (bẫy số 2)
Ô **Plan from date – Plan to date** ở bên phải **tự động điền 7 ngày gần nhất**.
Việc kiểm kê cần tìm thường xảy ra từ mấy tháng trước → phải tự sửa lại.

> Cứ đặt rộng cho chắc, ví dụ `2025-12-01` → hôm nay.

### Bước 5 — Gõ SKU vào ô **SKU/Barcode** rồi bấm **Search**
Kết quả ra danh sách các phiếu kiểm kê đã đụng tới món hàng này.

> Ca mẫu ra 3 phiếu. Phiếu cần tìm: **ID 806410**, kho `WH - MATERIAL - MTG`, trạng thái `APPROVED`.

### Bước 6 — Bấm vào số **ID** (màu xanh), rồi bấm vào dòng chữ **"(… UID group)"**
* Bấm ID → mở chi tiết phiếu, thấy bảng chia theo từng **vị trí (Location)**, có cột `Quantity count` (đếm được) / `Inventory` (hệ thống ghi) / `Diff` (lệch).
* Tìm đúng dòng vị trí của cuộn mình quan tâm, trong ô `Quantity count` có dòng chữ nhỏ **"(6 UID group)"** — **bấm vào đó**.
* Hiện lên pop-up **Detail** — đây là đích đến.

---

## 2. Pop-up "Detail" — nơi có câu trả lời

Cột **Description** viết thẳng bằng chữ, không cần suy luận:

```
No   UID group            Quantity   Description                        Counted date
 1   1028260104000052       65.700   Update quantity: 67.700 → 65.700   2026-08-25 09:57:07
 2   1028260227000350       83.700   Update quantity: 84.124 → 83.700   2026-08-25 09:57:40
 3   1028260227000346       71.200   Update quantity: 71.609 → 71.200   2026-08-25 09:58:10   ← cuộn đang hỏi
 4   1028260104000055       70.200   —                                  2026-08-25 09:58:31
 5   1028260227000345       84.124   —                                  2026-08-25 09:58:53
 6   1028260227000348       69.500   Update quantity: 67.665 → 69.500   2026-08-25 09:59:29
```

Đọc ra ngay:
* **Ai đổi** → xem dòng `Counted date` + mục `Counted by` ở đầu trang chi tiết (ca này: `thanhnn1@hasaki.vn`).
* **Đổi lúc nào** → 25/08/2026 09:58:10 (lúc đếm), và có hiệu lực khi phiếu được **duyệt** 26/08/2026.
* **Đổi vì sao** → người đếm đo thực tế ra 71.200, hệ thống đang ghi 71.609.
* Dòng nào cột Description là `—` nghĩa là **đếm khớp**, không sửa gì.

> **Luật cần nhớ:** số trong kho **không tự trừ**. Nó đổi vì có người đếm ra số khác và phiếu kiểm kê **được duyệt**. Duyệt xong WMS mới ghi đè số đếm lên cuộn.

---

## 2b. ⚠️ Bẫy số 3: cột `Updated At` KHÔNG phải "lúc đổi số lượng"

`Updated At` = **lần chạm cuối cùng vào bản ghi**. Giống "Ngày sửa" của file trong Windows:
đổi tên file thôi thì ngày sửa cũng nhảy, dù nội dung không đổi chữ nào.

Ba việc khác hẳn nhau đều làm ô này nhảy, WMS **không tách ra**:
đổi số lượng · **dời vị trí** · **khoá nhóm (Block)** · đổi tình trạng hàng.

> **Ca mẫu:** số lượng đổi ngày **26/08** (lúc duyệt phiếu kiểm kê), nhưng `Updated At` lại ghi
> **04/09 05:53 PM**. Vì ngày 04/09 `tuanlq5@` còn đụng vào cuộn 3 lần nữa — 17:35:03 dời
> F0-KHO-506 → F0-AJ, 17:35:09 Block, 17:53:11 dời F0-AJ → F0-VR — **không đụng số lượng lần nào**,
> nhưng lần cuối chiếm mất ô `Updated At`. Kiểm chứng: `Updated At` trùng **đúng từng giây** với dòng
> `Transfer location` trong tab `group-history`.

**Cách chữa:** muốn biết số lượng đổi lúc nào thì chỉ có một đường — pop-up **Detail** ở mục 2.
Muốn biết vì sao `Updated At` là ngày đó thì mở tab `group-history` của nhóm, tìm dòng có **cùng giây**.

**Cũng đừng đọc `Updated At` thành "lúc bị đánh dấu Damaged":** WMS **không lưu mốc riêng** cho việc
đổi tình trạng hàng. Và vị trí cũng không nói lên điều gì — bin `F0-VR-00-00-00-00` (kho 1177) có
872 UID thì 794 là **Normal (91%)**, chỉ 78 Damaged, tức F0-VR **không phải khu hàng lỗi**.

---

## 3. Mẹo đọc thêm — để biết có bất thường thật không

Nhìn cột `Diff` của cả **vị trí**, đừng chỉ nhìn 1 cuộn:

```
bin F0-KHO-506-02-01-01     hệ thống 445.422   đếm 444.424   lệch -998
   1028260104000052   -2.000
   1028260227000346     -409   ← cuộn đang hỏi
   1028260227000348   +1.835
   1028260227000350     -424
```

* Lệch **vài trăm mm** (như −409 ≈ 0,4 m) trên cuộn vải dài 70 m → **hao hụt đo đạc bình thường**.
* Nhưng một cuộn **dư 1.835** trong khi cuộn khác **hụt đúng 2.000** → dấu hiệu **cắt/đổi cuộn ngoài thực tế mà không khai vào WMS**, sau đó kiểm kê mới chỉnh lại. Cái này mới đáng hỏi lại kho.

---

## 4. Nếu tìm mãi không ra phiếu kiểm kê nào

Nghĩa là số đổi do việc khác. Kiểm theo thứ tự:

1. **Tách / cắt cuộn** → xem tab `group-history` của nhóm, tìm cặp dòng **`Edit - Remove`** rồi **`Edit - Add`** sát giờ nhau. Cộng số của UID cũ còn lại + UID mới, nếu bằng số ban đầu là đúng đã cắt.
   > Ca mẫu: 18/06 gỡ UID cũ `VN00319368937` (73.609) → UID cũ giữ lại 2.000, gắn UID mới `VN00401596968` 71.609. Kiểm tra: 2.000 + 71.609 = 73.609 ✔
2. **Phiếu điều chỉnh** → menu `Adjustment`, lọc theo SKU. Lưu ý phiếu điều chỉnh chỉ ghi ở **mức SKU**, không chỉ ra cuộn nào.
3. **Xuất dùng / xuất kho** → xem `Outbound` hoặc `Internal Transfer`.

---

## 5. Bảng bẫy (tóm tắt để dán lên màn hình)

| Triệu chứng | Nguyên nhân | Cách chữa |
|---|---|---|
| Tìm ra **"No data"** dù chắc chắn có | Đang đứng ở công ty **Hasaki Vietnam** | Đổi sang **Mastige Co., Ltd.** ở góc trên trái |
| Tìm ra **"No data"** dù đã đúng công ty | Ô ngày tự để **7 ngày gần nhất** | Nới `Plan from date` về đầu năm |
| Lịch sử ghi 71.609, tồn kho ghi 71.200 | Lịch sử là **ảnh chụp đóng băng** | Không phải lỗi. Xem mục 0 |
| Phiếu điều chỉnh ghi số lạ (601) | Đó là **lệch ròng của cả SKU** trong phiếu, gộp nhiều vị trí | Muốn số của 1 cuộn thì vào pop-up Detail (mục 2) |
| `Updated At` khác xa ngày duyệt phiếu | Đó là **lần chạm cuối**, gồm cả dời vị trí / Block | Xem mục 2b |

---

## 6. Đường tắt (dán thẳng vào thanh địa chỉ)

Thay `<SKU>` bằng mã SKU, nhớ đã chọn đúng công ty:

```
https://wms.inshasaki.com/physical-count/result/list?current_tab=sku&from_plan_date_str=2025-12-01&to_plan_date_str=2026-12-31&sku_or_barcode=<SKU>&page=1&size=20
```

Có mã phiếu rồi thì vào thẳng chi tiết:

```
https://wms.inshasaki.com/physical-count/result/sku/detail/<ID_PHIẾU>?page=1&size=20
```
