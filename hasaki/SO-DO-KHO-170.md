# SƠ ĐỒ KHO 170 (DC HASAKI) — GIẢI MÃ 12/09/2026

Mục đích: đọc hiểu bản vẽ kho 170 và **nối bản vẽ với mã vị trí WMS**, để sau này dựng
tab/planogram cho kho 170 không phải đoán.

## 0. Nguồn đã đọc

| Tệp | Ngày | Nội dung |
|---|---|---|
| `C:\Users\HASAKI\Desktop\screenshot_1750320064.png` | 19/06/2025 | Bản vẽ **có phủ chữ A…Y** (mã khu 5S) — chìa khoá giải mã |
| `C:\Users\HASAKI\Desktop\DCHASAKI.pdf` | 19/06/2025 | Bản vẽ chính 1 trang (792×612 pt, vẽ xoay 90°) |
| `C:\Users\HASAKI\Desktop\kho_giay.pdf` | 05/06/2025 | Phóng to khu giấy / bóng xốp |
| `…\OneDrive\Desktop\DCMTG1.dwg` | 25/08/2026 | **Bản vẽ gốc** — đã đọc được 16/09/2026 (xem §8). Chứa CẢ HAI mặt bằng: kho 170 + nhà máy Garment |
| `…\OneDrive\Tài liệu\DCMTG.dwg` | 18/12/2025 | Bản cũ hơn của cùng bản vẽ — **chỉ có kho 170**, chưa có khu nhà máy |
| `…\Downloads\Layout.dwg` | 30/07/2025 | KHÔNG phải mặt bằng — bản vẽ cơ khí **khung kệ/sàn lửng** của NCC (CTCP Thăng Long, sieuthigiake.com): layer Beam kệ / Khung beam chính / Cột chân sàn / Lan can |
| `…\OneDrive\Desktop\LocationListing_2025_06_19.xlsx` | 19/06/2025 | 5.999 bin WMS — dùng để đối chiếu (cùng ngày với bản vẽ) |

Cách dựng lại ảnh từ PDF (máy không có poppler/ghostscript, Edge headless trả trang xám):
`npm i pdfjs-dist @napi-rs/canvas` rồi render page 1 ra PNG 6000 px — script mẫu ở
`scratchpad/pdfrender/render.mjs`. Text thì `pdftotext -layout` (đã có sẵn ở `/mingw64/bin`)
đọc được tiếng Việt, nhưng **chữ số kích thước là nét vẽ nên không bóc được bằng text**.

## 1. Bảng chữ A…Y trên ảnh chụp = mã khu 5S (nguồn: sheet "Sheet1" + "định danh khu vực")

| Chữ | Mã khu | Mã kho | Tên khu vực | Nhận ra trên bản vẽ |
|---|---|---|---|---|
| A | A03 | 1436 | Kệ rack trữ VPP, sóng nhựa xanh dương, thùng rác trong kho | cụm kệ nhỏ cạnh kho giấy |
| B | A04 | 1436 | Kho trữ VPP, tái chế giấy | KHU TRỮ GIẤY / BÓNG (xem `kho_giay.pdf`) |
| C | A05 | 1436 | Khu vực bàn giao ĐVVC | "KHU VỰC ĐVVC THAO TÁC DI CHUYỂN ĐƠN" |
| D | A06 | 1436 | Bàn quản lý, hàng hoàn, VPP, SPKPH | phòng góc dưới-trái |
| E | A07 | 1436 | Khu trữ xe soạn hàng | dải đỏ "KHU TRỮ XE PICK" sát tường trái, 12,63 m |
| F | A08 | 1436 | Khu vực bàn đóng gói, băng chuyền | cụm PICK/PACK 4 băng chuyền góc dưới-trái |
| G | A10 | 1443 | Nhà vệ sinh & thiết bị vệ sinh | WC NAM/NỮ giữa kho |
| H | A11 | 1443 | Hàng đổi trả ngành hàng & thiết bị IT | ô dưới phòng SPA |
| I | A12 | 1443 | **Kho hàng CLINIC** | phòng ghi "SPA" trên bản vẽ |
| J | A09 | 1443 | Khu đồng kiểm PO, bàn làm việc | "KHU VỰC NHẬN, KIỂM TRA PO" (3 cụm bàn, 11,95 m) |
| K | A20 | 1443 | Gia cố, đóng gói vận chuyển nội bộ | "KHU VỰC CHIA IT" (4 cụm bàn) |
| L | A13 | 1443 | Phòng máy chụp hình Ortery | phòng "Ortery" |
| M | A14 | 1443 | Khu kiểm, nhập hàng IT SHOP | phòng "Re-IT" |
| N | A15 | 1443 | Khu xe nâng điện đứng | ô nhỏ góc trên-trái |
| O | CB | 1443 | **Băng chuyền phân loại đầu vào + in nhãn** | cụm đen lớn giữa kho, rộng 7,60 m, 2 hàng vị trí "pallet" hai bên |
| P | A19 | 1443 | Băng chuyền xuất & bàn giao ĐVVC | 3 cửa xuất (1,90 m / 5,10 m) phải kho |
| Q | A18 | 1443 | Khu chờ xử lý (pending) & xe nâng điện ngồi | cạnh "KHU MÁY NÉN" |
| R | A24 | 1443 | Phòng giặt sấy | khối "GIẶT SẤY" ngoài nhà |
| S | A16 | 1443 | Khu kho hành chánh | dải phải, cạnh PHÒNG HỌP |
| T | A23 | 1443 | Bãi xe nhân viên | "NHÀ ĐỂ XE NHÂN VIÊN" (20,00 m) |
| U | A22 | 1443 | Khu xe giao nhận nội bộ | "BÃI ĐỖ XE VAN, XE TẢI NỘI BỘ" ~22 m × 7,50 m, 8 chỗ |
| V | A02 | 1443 | Khu vực quà tặng | dải kệ góc trên-phải |
| W | A02 | 1443 | Hàng MTG + 1:1 | dải kệ dọc tường trên khối A2 |
| X | A21 | 1443 | Khai báo bảo vệ & tủ khoá cá nhân | ô giữa-dưới |
| Y | A17 | 1443 | Bàn làm việc LOGISTIC | dải phải, dưới kho hành chánh |
| — | A25 | 1443 | Bãi xe NCC, đối tác & thùng rác ngoài kho | ngoài nhà |

Ghi chú: **hai mã kho cùng một toà nhà** — 1436 (A03–A08) và 1443 (A02, A09–A25, CB).
Chữ A…Y **không phủ lên 2 khối kệ lớn** (A1, A2); hai khối đó quản lý bằng mã bin bên dưới.

## 2. Cú pháp mã vị trí

```
F0 - <KHU> - <DÃY> - <TỦ> - <TẦNG> - <Ô>[.<lớp sâu>]
F0 - A1   - 509   - 07   - 02     - 01
F0 - A2   - 517   - 10   - 40     - 01.02     ← Double Deep (lớp trong)
```

* `F0` = tầng trệt; có **`F1-AP`** (51 bin) ⇒ tồn tại tầng lửng/khu AP chưa thể hiện trên bản vẽ.
* **TẦNG**: `01–04` = kệ tay (pick, hàng lẻ) · `10/20/30/40` = tầng pallet.
* **Ô có dấu chấm** (`01.01`, `01.02`) = kệ **Double Deep** — 616/5.999 bin, chỉ ở A2-515…518.
* Nhãn trên bản vẽ dạng `501-05` = **dãy 501 – tủ 05**, khớp `ma_ke_1200mm.xlsx` (cột Dãy/Tủ/In).

## 3. Khối kệ A1 (trái) — 1.999 bin

* 8 khối kệ đôi = **16 mặt: dãy 501→516** (khối 1 = 501|502, khối 2 = 503|504, …, khối 8 = 515|516).
* Mỗi dãy **10 tủ × 2 ô**, tầng 01–04. Các dãy **501, 504, 505, 508, 509, 512, 513, 516** có thêm
  tầng pallet 20/30/40 (140 bin/dãy); dãy giữa chỉ 80 bin. Ngoại lệ: 504 (176 bin, có ô 03–06),
  509 (200 bin, ô 03–05).
* Chiều sâu: 2 nửa **12,04 m**, cắt ngang bởi lối 3,30 m (tủ 01–05 / tủ 06–10).
* Bước ngang: hai đầu **3,05 m**, lối đi chính **2,90 m**, khe trong cụm ~**1,6 m**
  (chữ số chồng nét — nên xác nhận lại tại hiện trường).
* 3 dãy kệ tường, **khớp chính xác với bản vẽ**: `5L1` 24 tủ (tường trái) · `5L2` 25–26 tủ
  (tường trên) · `5L3` 27 tủ (vách Re-IT / Ortery / SPA). Đây là bằng chứng bản vẽ và WMS còn đồng bộ.
* Tính chất: 1.352 bin "Trưng bày (Pick) – Hàng lẻ" ⇒ **A1 là khu pick hàng lẻ**.

## 4. Khối kệ A2 (phải) — 2.476 bin

* 7 khối kệ đôi **dãy 501→514**, rồi tới băng chuyền phân loại, rồi 3 khối **517|518, 519|520, 521**;
  dãy **522** chạy dọc tường phải (522-01, 522-02 + các tủ 03…07 rải theo tường trên).
* Mỗi khối rộng **2,30 m**, lối đi **2,90 m**, hai đầu 3,00–3,19 m; sâu 12,04 m + 3,20 m; dãy 517 có 9–10 tủ.
* Tầng chủ yếu 10/20/30/40 ⇒ **A2 là khu pallet/lưu trữ** (806 bin "Lưu trữ – SLL").
* 517/518 lớn nhất (212/204 bin) và là kệ Double Deep.

## 5. Kho giấy / bóng (`kho_giay.pdf`, khu B = A04)

Nằm giữa-dưới kho, cạnh WC: KHU TRỮ BÓNG NCC GIAO ĐẾN (64–80 cây) · KHU TRỮ GIẤY ·
MÁY DẬP GIẤY · 2 MÁY BẾ LĂN · KHU VỰC DÁN THÀNH PHẨM (4,20 × 4,20 m) · MÁY CẮT BÓNG +
KHU VỰC THAO TÁC MÁY CẮT (4,20 × 1,50 m, tổng ngang 8,48 m) · KHU VỰC PHÂN LOẠI RÁC ĐÓNG GÓI ·
KHU TRỮ BÓNG XỐP ĐÓNG ĐƠN.

## 6. Bin chức năng / bin ảo (ngoài 2 khối kệ)

`PL` pallet di động số 1→300 · `ST` 372 bin lưu trữ (dãy 01–18 × tủ 01–22, không mô tả) ·
`FS` hàng sales-off (+combo) · `TF` 99 bin · `AP` 73 bin (có cả `F1-AP`) · `CB` băng chuyền xuất 1–3 ·
`AD` chỗ để xe nâng · và nhóm bin ảo 1 vị trí: `VR` vendor return, `AJ` điều chỉnh, `RT` hàng trả về,
`NG` hàng không phù hợp, `NF` không tìm thấy, `GI` quà tặng, `PO` nhận PO, `PG` nhận PO gộp,
`PA` hàng dư khi đóng đơn, `A0` bin mặc định.

## 7. Lệch / cần xác minh

1. **A2-515 và A2-516** có trong WMS (148 bin/dãy, Double Deep, tạo 19/05/2025) nhưng **không có nhãn
   trên bản vẽ** — 2 dãy này nằm ở đâu? (nghi: cạnh băng chuyền phân loại hoặc đã gộp vào 517/518).
2. **Dãy 522** (522-01, 522-02 và các tủ 03–07 theo tường) có trên bản vẽ nhưng **không có bin nào
   trong export 19/06/2025** — kệ vẽ trước, chưa khai báo WMS, hoặc khai sau ngày export.
3. Dữ liệu WMS đang dùng là **export 19/06/2025 (cũ ~15 tháng)**; bản listing mới hơn
   (`LocationListing_2026_04_01`) chỉ 192 dòng và là của **nhà máy F0-KHO**, không phải kho 170.
4. Bản vẽ ghi **"SPA"** nhưng WMS/5S gọi là **Kho hàng CLINIC (A12)**; **"Re-IT" = A14** (kiểm/nhập IT SHOP).
5. Ảnh `screenshot_1750320064.png` là **biến thể khác** của bản vẽ (khối ngoài nhà xếp khác:
   bãi xe nhân viên nằm dưới thay vì trên). Lấy chữ A…Y từ ảnh, lấy kích thước từ `DCHASAKI.pdf`.
6. ~~`DCMTG1.dwg` chưa đọc~~ → **đã đọc 16/09/2026, xem §8**. Bản vẽ khớp chính xác 5L1 24 tủ /
   5L2 26 tủ / 5L3 27 tủ ⇒ bản vẽ và WMS còn đồng bộ ở 3 dãy kệ tường.

---

## 8. ĐỌC THẲNG BẢN VẼ GỐC (.dwg) — mở 16/09/2026

Máy có sẵn **AutoCAD 2022** ⇒ dùng `accoreconsole.exe` (bộ chạy nền, không bật giao diện)
xuất DWG → DXF rồi bóc nhãn chữ kèm toạ độ. Tool: **`hasaki/doc-ban-ve-dwg.mjs`**

```
node hasaki/doc-ban-ve-dwg.mjs "C:\Users\lechitam\OneDrive\Desktop\DCMTG1.dwg" --ra <thư-mục>
```

Ra `<tên>.texts.tsv` (layer · X · Y · chữ) + `<tên>.tomtat.txt`. Chạy cục bộ, **không gọi
upstream**. Bản vẽ 3,3 MB → DXF ~20 MB, mất ~1 phút. Bẫy: chữ MTEXT có mã font nhúng thẳng
trong chuỗi (`\fArial|b1|i0;`, `\pxqc;`, `\P`) — phải gỡ mới đọc được, hàm `bocChu()` lo việc này.

**Đơn vị bản vẽ = mét.** Trong `DCMTG1.dwg` có 2 mặt bằng nằm cạnh nhau trên trục X:

| Vùng X | Là gì | Nhận dạng |
|---|---|---|
| 40 → 160 | **Kho 170 (DC Hasaki)** | A1-, A2-, 5L1/5L2/5L3, Ortery, SPA, Re-IT, WC NAM/NỮ, OUT 1-3, PHÒNG HỌP, KHU MÁY NÉN, kho giấy/bóng, 130 nhãn `pallet`, 107 `PICK`, 64 `PACK` |
| 220 → 280 | **Nhà máy Garment (F0-KHO)** | F0-KHO-501…513 + **507A**, KHU PO ĐỒNG KIỂM, KHU PO CHỜ QC, KHU TRỮ VẢI ĐẦU KHÚC, Phòng kiểm soát kho |

Khu nhà máy **chỉ có ở bản 25/08/2026**, bản 18/12/2025 chưa có ⇒ mặt bằng nhà máy được vẽ
thêm trong năm 2026.

### 8.1 Sơ đồ dãy kệ nhà máy F0-KHO (bóc từ bản vẽ)

14 dãy, 143 ô có đánh số trên hình. Dãy 501–507 nằm song song, cách nhau đều ~2,5 m theo trục Y;
508–513 nằm ở cụm trên, sát nhau nên **phải đối chiếu lại bằng hình học, đừng tin số ô ở cụm này**.

| Dãy | Y (m) | Số ô đọc được | Ô đầu→cuối | Bước ngang | Chiều dài dãy |
|---|---|---|---|---|---|
| 501 | −25,4 | 15 | 01→15 | 2,43 m | 34,0 m |
| 502 | −22,4 | 14 | 01→14 | 2,62 m | 34,0 m |
| 503 | −20,0 | 14 | 01→14 | 2,62 m | 34,0 m |
| 504 | −17,2 | 14 | 01→14 | 2,62 m | 34,0 m |
| 505 | −14,8 | 14 | 01→14 | 2,61 m | 33,9 m |
| 506 | −12,0 | 13 | 01→13 | ~2,0 m | 31,9 m |
| 507 | −9,6 | 9 | 01→09 | 2,39 m | 19,1 m |
| 507A | −5,9 | 7 | 01→07 | 2,38 m | 14,3 m |
| 508 | −4,3 | 6 | 01→06 | 1,58 m | 7,9 m |
| 509 | −2,5 | 7 | 01→07 | 2,39 m | 19,1 m |
| 510 | −1,6 | — | *cụm sát nhau, cần đối chiếu* | | |
| 511 | 0,0 | — | *nt* | | |
| 512 | 0,9 | ~14 | 01→14 | 2,41 m | 21,7 m |
| 513 | 2,7 | 13 | 01→13 | 1,59 m | 19,1 m |

Khớp với con số **14 dãy** mà tab Planogram Audit Factory đang dùng (`507A` chính là dãy thứ 14).

### 8.2 Sơ đồ mặt bằng kho 170 đưa vào tab Planogram (16/09/2026 — CHỜ DUYỆT, chưa push)

| Tệp | Vai trò |
|---|---|
| `hasaki/kho170-sodo-build.mjs` | Dựng sơ đồ từ DXF → `.exports/kho170-sodo.json` (chạy cục bộ, không gọi upstream) |
| `hasaki/kiemsoatkho/kho170-sodo.js` | Dữ liệu sơ đồ cho dashboard, 66 KB, **nạp LAZY** khi người dùng bật |
| `hasaki/kiemsoatkho/hasaki-planogram.js` | Nút "Mặt bằng thật" trong tiêu đề Sơ đồ + bộ vẽ SVG |
| `hasaki/qc-mat-bang-170.mjs` | Bộ đo riêng cho màn mới (8 nhóm kiểm, có cả bản điện thoại) |

**Bản vẽ xác nhận độc lập 2 con số danh mục** mà tab vốn chỉ giả định từ bản vẽ A0 cũ:

* **A1 = 16 dãy (501–516) × 10 tủ = 160 ô** → khớp `A1_DAY_TU` / `A1_DAY_DEN` / `A1_SO_KE`.
* **Khu đóng gói có đúng 64 ô bàn** (8 hàng × 8 ô) → khớp `MAP_A8` (4 cụm × 2 dãy × 8 ô).

Số đo lưới lấy từ bản vẽ: A1 bước dãy **1,03 m**, bước tủ **2,39 m**, tủ 05→06 cách 5,68 m ⇒ lối
đi ngang **3,29 m** (tài liệu đo tay 3,30 m — khớp).

**Chưa gán mã cho ô PACK/PICK**: bản vẽ đếm đúng 64 ô bàn nhưng KHÔNG ghi dãy nào là 501 hay 503,
gán mã lúc này là đoán — sai một cái là đổ oan người phụ trách. Ô để dạng nền, tooltip ghi rõ lý do.
Muốn gán thì phải ra hiện trường đối chiếu 1 lần rồi ghi cứng thứ tự cụm vào build.

**Bẫy đã vấp khi dựng** (đừng lặp lại):

1. Dò hộp bằng tia như sơ đồ nhà máy **không dùng được cho ô kệ** — bản vẽ chỉ vẽ ĐƯỜNG BAO cả
   khối kệ, bắn tia ra hộp 26×36 m. Ô kệ phải dựng từ **lưới nhãn** (nhãn dãy ở hàng tiêu đề,
   nhãn tủ ở cột trái), bề rộng/cao lấy **bước nhỏ nhất** để lối đi hiện ra thành khoảng trống.
2. Lọc layer trước khi dò hộp làm **mất 1 ô PACK** (layer `Defpoints` có nét khép cạnh ô) — chỉ
   được lọc layer lúc XUẤT nền.
3. Khu chức năng của **nhà máy** lấn sang X 130…165 ở phần Y âm, cắt theo X thôi là dính nhầm;
   phải chặn cả `Y > 5`.
4. Bản vẽ gốc 122.927 nét (6 MB) — bỏ nét < 1,2 m còn **1.131 nét**, sơ đồ vẫn đủ đọc.

**QC đã chạy** (16/09/2026): `node hasaki/qc-mat-bang-170.mjs` và `--mobile` — 16/16 mục ĐẠT trên
cả desktop 1440 lẫn Pixel 5; màu ô A1 khớp **từng ô** với sơ đồ lưới (0 ô lệch), console sạch.
Tải trang bản nội bộ 78 ms (trước khi sửa 104 ms). Ảnh: `.exports/qc-mat-bang-170*.png`.

**Cần user quyết trước khi push**: repo là PUBLIC ⇒ đẩy `kho170-sodo.js` là công khai mặt bằng kho
(tường, lối đi, vị trí WC/phòng họp/khu máy nén) ra Internet. Trang hiện đã công khai mã vị trí và
tên người phụ trách, nhưng mặt bằng chi tiết là mức khác — chờ duyệt.
