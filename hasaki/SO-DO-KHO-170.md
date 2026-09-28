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

---

## 9. TRỤC Z — ĐI TÌM CHIỀU CAO (22/09/2026)

Mặt bằng đã có đủ x, y bằng mét (§8.2). Muốn lên 2.5D/3D thì chỉ còn thiếu **chiều cao**.
Ghi lại đã dò những đâu để lần sau khỏi dò lại.

### 9.1 `Layout.dwg` của NCC kệ — ĐÃ ĐỌC, KHÔNG dùng được

`C:\Users\lechitam\Downloads\Layout.dwg` (64.735 B, 30/07/2025) — CTCP Thăng Long, sieuthigiake.com.
Đọc bằng `node hasaki/doc-ban-ve-dwg.mjs "<đường dẫn>" --ra <thư-mục> --giu-dxf`.

Tên layer nghe rất hứa hẹn (*Beam kệ · Beam phụ · Khung beam chính · Khung chân · Cột chân sàn ·
Cột chân lan can · Kích thước*) nhưng bóc ra thì:

* **cả 7 layer đó RỖNG** — mỗi tên chỉ xuất hiện đúng 1 lần trong bảng LAYER của DXF, không có
  entity nào mang layer đó. Toàn bộ 108 LINE + 24 ARC nằm trên layer `0`.
* **không có entity DIMENSION nào** ⇒ không có số kích thước nào để đọc.
* 26 MTEXT đều là khung tên (tên công ty, giám đốc, "BẢN VẼ SỐ"…), không có nhãn kỹ thuật.
* Hình học thật: một **MẶT BẰNG sàn lửng** ~20,0 × 39,2 m (đơn vị mm) — dầm rộng 400 mm, nhịp
  5.200/5.600 mm, 5 vị trí cột cách nhau 7.200 · 2.600 · 2.600 · 7.200 mm. **Không có mặt đứng.**

⇒ Bản vẽ này cho biết có sàn lửng và lưới dầm của nó, **không cho biết chiều cao kệ A1/A2**.

### 9.2 Nguồn cho được MỘT con số thật: `Copy of ConfigKe.xlsx`

`C:\Users\lechitam\OneDrive\Desktop\Copy of ConfigKe.xlsx` — sheet *Tình trạng Kệ* (1.114 bin,
chia 5 zone) + *SKU Đã Sắp xếp*. Không phải bản vẽ, nhưng có **thể tích cấp cho mỗi bin**:

| Zone | Tầng | Thể tích | Suy ra |
|---|---|---|---|
| A+ Bulk Zone | A1 tầng 01 | cấp **1.260.000.000 mm³ = 1,26 m³** | 1200 × 1000 × **1050 mm** ⇒ **thông thuỷ tầng pallet ≈ 1,05 m** |
| Main Zone Wide | A1 tầng 02–04 | 241.440.860 mm³ | |
| Main Zone Narrow | A1 tầng 02–04 | 120.750.000 mm³ = **đúng một nửa** Wide | "Narrow" là hẹp một nửa BỀ RỘNG, không phải thấp hơn |
| C- Zone · Gift Zone | A1 tầng 01 · 01–04 | 140.875.000 mm³ | |

Bề rộng bin suy ra ≈ **1.150 mm**, khớp với bước tủ 2,39 m ÷ 2 = 1,195 m của §8.2 — hai nguồn
độc lập khớp nhau, nên con số 1,05 m đáng tin. Các tầng kệ tay thì chưa tách được đâu là chiều
cao, đâu là chiều sâu (nhiều cách phân tích cùng ra một tích số) ⇒ **vẫn là số tạm**.

### 9.2b TÌM RA BẢN VẼ KỆ THẬT (22/09/2026, cùng ngày, sau §9.1)

`Layout.dwg` là ngõ cụt, nhưng quét **385 file .pdf** trên máy theo NỘI DUNG (tên công ty,
`sieuthigiake.com`, hotline) thì ra **26 tệp** của chính NCC Thăng Long, nằm ở
`C:\Users\HASAKI\Documents\Zalo Received Files\`. Đã gom bản không trùng vào
**`C:\Users\lechitam\Desktop\NCC-THANG-LONG\`** kèm `DOC-TRUOC.md`.
Bài học: lần đầu chỉ dò TÊN FILE nên trượt hết — phải dò nội dung.

Tên tệp mã hoá sẵn kích thước: `TL-KHN-D<dài> x R<rộng> x C<cao>` (mm).

| Bản vẽ | Bay | Sâu | Cao cột | Cao độ beam |
|---|---|---|---|---|
| **TL-KHN-D2480 × R1000 × C5000 (Hasaki)** | 2.480 bộ đầu / **2.390** bộ nối | 1.000 | **5.000** | **1.430 · 2.900 · 4.150** |
| TL-KHN-D2480 × R1000 × C4700 (+ Double Deep) | 2.480 / 2.390 | 1.000 | 4.700 | |
| TL-KHN-D5480 × R1000/R1100 × C4100 | 5.480 | 1.000/1.100 | 4.100 | |
| TL-KHN-D5970 × R1100 × C3000 | 5.970 | 1.100 | 3.000 | |

Tải 1.800 kg/tầng · cột Omega 90×65×1,8 · beam 120×50×1,4.

**Bằng chứng đúng kệ kho 170:** bộ nối 2.390 mm = đúng bước tủ 2,39 m của §8.2 · sâu 1.000 mm ≈ ô
1,03 m · bản C4700 ghi **12.040 mm** = đúng chiều sâu dãy 12,04 m của §3 · chuỗi
`2480 + 9×2390 + 1450 = 25.440 mm` = một dãy kệ trọn vẹn.
Kèm 3 báo giá (03/04/2025: 416.817.360 đ sau VAT · hai bản 09/01/2025).

### 9.3 Bộ chiều cao đang dùng

Khai ở một chỗ duy nhất: hằng `KE_A2` / `KE_A1` / `CAO` trong `hasaki/kiemsoatkho/kho170-3d.html`.

| Thứ | Số đang dùng | Nguồn |
|---|---|---|
| **Kệ A2 (pallet)** | cột **5,0 m** · beam **1,43 / 2,90 / 4,15 m** · sâu 1,0 m · bay 2,39 m | **THẬT** — §9.2b, bản vẽ NCC |
| ~~Kệ A1 tầng 01–04, trụ 2,45 m~~ | **SAI — đã thay 26/09/2026**, xem §10.2 | |
| Bàn đóng gói · xe pick · pallet sàn | 0,75 · 1,05 · 1,15 m | **tạm** |
| Diềm mái 7,5 m · nóc 10,5 m · vách trong 3,2 m | | **tạm** |

### 9.4 Còn phải lấy ở đâu

1. **Ra hiện trường đo 1 lần** — nay chỉ còn ~6 số vì A2 đã có bản vẽ: cao độ 4 tầng kệ tay A1,
   đỉnh trụ A1, cao mặt bàn PACK, cao mặt băng chuyền.
2. `C:\Users\HASAKI\Desktop\audithsk\layout\DC HASAKI 6.6.dwg` (25,8 MB, 25/07/2026) — bản vẽ
   mới nhất, **chưa bóc**. Nếu có mặt cắt thì ra được cao trần / diềm mái.
3. `Layout Đèn chiếu sáng Kho 170 QL1A Final-Model.pdf` — bản vẽ đèn thường có cao độ treo, suy
   ngược ra được cao trần.

### 9.5 Chưa gán được mã: 64 ô PACK + 107 ô PICK

Vẫn đúng như §8.2 ghi: bản vẽ đếm đủ số ô nhưng không ghi cụm nào là dãy nào. Với dữ liệu **vệ
sinh planogram** (F0-A1 167 vị trí + F0-A8 68 vị trí) thì **68/235 ≈ 29% vị trí chưa tô màu được**
cho tới khi ra hiện trường chốt thứ tự 4 cụm bàn đóng gói.

### 9.6 Hình học ngang đã kiểm lại khi dựng 3D (khớp bản vẽ)

Đọc thẳng `kho170-sodo.json`, khối A1 gồm **4 cụm × 4 dãy**:

| | 501 | 502 | 503 | 504 | → 505 |
|---|---|---|---|---|---|
| x (m) | 15,68 | 16,86 | 17,88 | 19,06 | 21,78 |
| cách dãy trước | — | 1,18 | 1,02 | 1,18 | **2,72** |

Lặp đúng như vậy cho 505–508, 509–512, 513–516. Ô đều **1,03 × 2,39 m**; tủ 01–05 rồi **hở
3,29 m** (lối cắt ngang) mới tới tủ 06–10; dãy dài 27,19 m. Con số 2,72 m giữa các cụm và
3,29 m lối cắt ngang **khớp §8.2**, nên phần ngang coi như chốt.

### 9.7 Xe nâng NICHIYU FBR (22/09/2026)

Bản catalogue "Nichiyu FBR-80 Specification" trên Scribd **không tải được** (trang chỉ trả
metadata, nội dung sau tường phí). Số chắc chắn duy nhất lấy từ **hợp đồng mua bán trên máy**
`C:\Users\HASAKI\Documents\Zalo Received Files\CTY HASAKI - HĐMB (xe NICHIYU) - 29.04.25.docx`:

> Xe nâng điện **1,5 tấn** · Nhãn hiệu **NICHIYU** · Model **FBR18 – R80B** · **Nâng cao 6 m**
> · Acquy **48V/280Ah** · Bánh xe PU · Xuất xứ Nhật Bản — 155.000.000 đ + càng nâng 60.000.000 đ

Hợp đồng thuê 07/06/2024 cũng ghi cùng model FBR18-R80B ("R80B" khớp tên "FBR-80" của
catalogue ⇒ cùng dòng). **Hai báo giá NICHIYU khác trên máy là PDF ẢNH SCAN** (pdftotext bóc ra
0 ký tự) nên không lấy thêm được số nào.

**FBR là xe nâng ĐỨNG LÁI CÀNG VƯƠN (reach truck)**, không phải xe đối trọng: người đứng nghiêng
trong buồng phía sau, hai chân càng chìa ra trước đỡ bánh tải, khung nâng trượt tới–lui giữa hai
chân. Đây là lý do lối đi trong kho chỉ cần ~2,7 m. Mô hình 3D đã dựng đúng dáng này; kích thước
hình học (dài, rộng, cao khung khi hạ, dài chân càng) **còn TẠM**, khai ở nhóm "5 · Xe nâng"
trong `kho170-thongso.js`.


---

## 10. TRA CỨU LẦN 2 — PDF, ẢNH, DWG (26/09/2026)

### 10.1 Nguồn mới đã đọc

| Tệp | Là gì | Dùng được gì |
|---|---|---|
| `C:\Users\HASAKI\Desktop\audithsk\layout\DC HASAKI 6.6.dwg` (25,8 MB, 25/07/2026) | Tệp gom **~6 phiên bản mặt bằng kho** đặt cạnh nhau (toạ độ X ≈ −75.300…−74.400), 4.245 nhãn, 106 khối cột `COT`, layer đèn `E-LIGHTING` | Lịch sử bố cục. Bản đầy đủ nhất có khu **F0-AP** (15 dãy × 7 tủ + AP-L1…L5) đè lên nửa dưới A1, bãi đậu xe tải P01–P06, CỔNG PO 1/2 |
| `Desktop\NCC-THANG-LONG\Layout Đèn chiếu sáng Kho 170 QL1A Final-Model.pdf` | Bản điện **"BỐ TRÍ ME"**: đèn HB-DS120 120 W theo Line 1–5, tủ điện, máng điện, **kích thước tổng thể** | Kiểm chứng vỏ nhà (§10.3) |
| `Desktop\NCC-THANG-LONG\HASAKI-80 RACKS (1).pdf` (Tín Đạt, 27/05/2024, 2 trang) | Mặt bằng + **mặt đứng + mặt bên kệ A1** | Toàn bộ chiều cao A1 (§10.2) |
| `BAO GIA KỆ SELECTIVE HASAKI - EURORACK *.pdf` (6 bản 28–31/05/2024) | Báo giá cạnh tranh cùng gói | Cùng quy cách: 16 bộ đầu L2480 + 64 bộ nối L2390, W1000, H4800 |
| `HASAKI-LAYOUT.pdf` | Mặt bằng dự thầu: "khu vực kệ làm mới" (A1) + "kệ cũ di dời" | Xác nhận A1 là kệ làm mới năm 2024 |
| `Downloads\KIỂM SOÁT RA VÀO KHO TỔNG_a3.pdf` | Poster nội quy ra vào | Không có sơ đồ |
| `Downloads\WH170.pdf` | 186 byte — thực chất là JSON lỗi `jwt_expired` | Bỏ |

Công cụ: vẽ DXF ra ảnh **có bung block** (khối kệ/bàn/cột nằm trong BLOCK, bỏ qua thì chỉ còn 0,5 % nét) —
script mẫu ở scratchpad phiên 26/09 (`ve2.mjs`: parse → cache JSON → draw bằng `sharp`). PDF → ảnh:
`pdfjs-dist@latest` + `@napi-rs/canvas` (bản pdfjs 4 báo `InvalidArg`, phải dùng bản mới).
Tên tệp tiếng Việt: `pdftotext` của mingw không mở được → chép sang tên ASCII trước.

### 10.2 Kệ A1 THẬT là 8 kệ selective 2 mặt, cao 5 m (sửa mô hình cũ)

Cả 3 hồ sơ thầu cùng một quy cách nên kết luận không phụ thuộc ai trúng thầu:
**16 bộ đầu + 64 bộ nối = 80 khoang, sâu 1.000 mm, bước 2.390 mm, cao 4.800–5.000 mm,
"4 tầng shelving + 3 tầng pallet", tổng 480 pallet / 320 tầng shelving.**

* Mặt bên Tín Đạt: `1000 | 1200 | 1000` = **2 kệ quay lưng vào một lối nhặt hàng 1,2 m**, nối nhau
  bằng thanh C45 trên đỉnh. Giữa các cặp là lối xe nâng 2,9 m (3.000/3.200 trên mặt bằng).
* Bước cụm = 1,0 + 1,2 + 1,0 + 2,9 = **6,10 m = đúng bước cụm 501→505 trên `DCMTG1.dwg`**.
* Mỗi kệ có 2 mặt = 2 "dãy" WMS: **mặt ngoài** (501, 504, 505, 508, 509, 512, 513, 516) có pallet
  **20/30/40** + kệ tay 01–04; **mặt trong** (502, 503, …) chỉ kệ tay 01–04. WMS 15/09/2026 khớp
  từng dãy.
* Cao độ (mm, từ sàn): mâm kệ tay **150 · 500 · 800 · 1.100** (200 kg/tầng); beam pallet
  **1.420 · 2.520 · 4.320** (500 · 900 · 900 kg/pallet); trụ **5.000**.
* `DCMTG1.dwg` vẽ 4 dải 1,03 m sát nhau mỗi cụm → chỉ tin TÂM cụm + bước tủ, bề ngang dựng lại theo NCC.

⇒ Mô hình cũ (16 kệ tay độc lập cao 2,45 m, số "TẠM") sai. Đã sửa `kho170-3d.html`
(hàm `a1HaiMat` + `dungKeA1`, thông số `a1Kieu/a1Sau/a1Ham/a1P1–P3` trong `kho170-thongso.js`,
chọn "Mỗi dãy 1 kệ riêng" để quay về kiểu cũ).

### 10.3 Vỏ nhà hình chữ L — khớp bản ME

| | Sơ đồ (`DCMTG1`) | Bản ME ghi |
|---|---|---|
| Khối trái (A1 + đóng gói) rộng | 12,36 → 42,08 = 29,7 m | 4,50+2,62+5,38+4,00+13,00 = **29,50 m** |
| Khối trái sâu | 2,75 → **62,95** = **60,2 m** (sửa 28/09 — trước ghi nhầm 58,30 = mép cửa tường bên) | ME + PDF `DC HASAKI 3d` đo tỉ lệ ≈ **60–61 m** |
| Khối phải (A2) dài | 42,08 → 112,56 = 70,5 m | 4,35+4,00+59,84+1,80 = **69,99 m** |
| Khối phải sâu | 2,75 → 42,95 = 40,2 m | 10,00+5,00+5,00+10,00+… ≈ 40 m |

Mô hình 3D cũ dựng tường theo **khung 115,9 × 65,05 m bao cả sân bãi**; nay dựng theo đúng chữ L
(thông số `nhaX0/nhaGiua/nhaX1/nhaY0/nhaYPhai/nhaYTrai`), mỗi khối một mái 2 dốc.

### 10.4 Không đưa vào (có lý do)

* **Khu F0-AP / F1-AP** của bản 6.6: WMS 15/09/2026 **không còn vị trí AP nào** ⇒ trạng thái cũ
  hoặc phương án chưa làm. Bản `DCMTG1` (25/08/2026, không có AP) vẫn là bản đúng hiện trạng.
* **Đèn chiếu sáng**: bản ME chỉ có vị trí trên mặt bằng, không có cao độ treo ⇒ vẫn chưa suy
  ra cao trần. Diềm mái / nóc vẫn **TẠM**.
* **64 ô PACK + 107 ô PICK** vẫn chưa gán mã (bản 6.6 cũng không ghi dãy nào là 501/503).

### 10.5 Còn thiếu — chỉ đo tại hiện trường mới có

Cao diềm mái + nóc · cao mặt bàn PACK · cao mặt băng chuyền · cao vách ngăn. Các số khác của mô
hình nay đều có nguồn (bản vẽ hoặc NCC).

---

## 11. HỆ BĂNG CHUYỀN — INTECH + LIÊN MINH (26/09/2026)

### 11.1 Nguồn

| Tệp | Là gì |
|---|---|
| `C:\Users\HASAKI\Documents\Zalo Received Files\24083-BV-Layout-Xuất hàng.PDF` (6 trang) | **INTECH VIỆT NAM JSC** (KCN Bình Chiểu), dự án **24083-LINE XUẤT HÀNG**, 23/07/2024, **Qty 2**: 24083-001 băng check barcode · 002 con lăn reject (+SP1/SP2) · 003 băng tải xuất hàng (nâng hạ) |
| `…\24083-SP1-Dàn con lăn tự do D42.PDF` | Intech, 01/08/2024, **30 bộ** dàn con lăn tự do D42 |
| `…\HDBT băng tải gởi Tâm_Đức.xlsx` (01/11/2024) | Hồ sơ bảo trì 2 hệ: **"Hệ thống BT xuất hàng"** (người làm: Vận hành / KT-Bảo trì) và **"Hệ thống phân loại sản phẩm"** (người làm: PTCH / KT-Bảo trì) — tủ điện PLC, băng tải số 1, số 2, bộ đọc barcode + reject khí nén, tem QR |
| `…\VẬN HÀNH BĂNG CHUYỀN DÁN PACKED LABEL TỰ ĐỘNG.docx` | 6 bước vận hành băng chuyền **phân ZONE + dán Packed Label** (kỹ năng HSK-013-002-015) |
| `C:\Users\HASAKI\Downloads\TIMING BĂNG CHUYỀN.xlsx` | Thời gian thao tác băng chuyền IN 198 s / OUT 192 s |
| `C:\Users\lechitam\Downloads\product-list-2025-08-28.xlsx` | **Danh mục tài sản** — nơi DUY NHẤT ghi tên **Liên Minh** (xem 11.2) |
| `…\LAYOUT - R-PACK.dwg` | KHÔNG liên quan — bản chào kệ của Tân Phương Phát cho công ty R-PACK |

Quét toàn bộ 390 PDF + mọi docx/xlsx/pptx trên máy: **không PDF nào nhắc "Liên Minh"** (PDF xuất từ CAD
mất chữ tiếng Việt khi bóc — phải xem bằng ảnh). "Intech" chỉ có trong 2 PDF dự án 24083.

### 11.2 Danh mục tài sản ⇒ ai làm cụm nào

| Cụm | Tài sản (kích thước R×D×C mm) | Hãng |
|---|---|---|
| Trạm dán nhãn | Hệ thống máy in và dán nhãn 1300×650×850, servo 0,4 kW (572 tr) · Khung camera **Cognex** check thùng 1000×800×2000 · Belt L1000/L1500/L2000 · Băng tải xéo con lăn | **Liên Minh** |
| Băng phân loại zone | Băng tải phân loại 700×13.500×950 · Băng tải SORTING 600×13.500×750 · Bộ **Pop-Up Sorter** (693 tr) · Pop-Up chuyển 2 hướng · Băng Scan Code 600×3.000×750 · Băng thép 600×14.000×750 · Máy nén khí | ghi "hệ thống băng chuyền" |
| Line xuất | Băng thép **600×1.250×650** · Con lăn REJECT **600×800×650** · Nâng hạ **600×3.000** | = đúng số bản vẽ **Intech 24083** |
| Máng nhánh | Dàn con lăn **700×2.000×750** (+600×2.000, 700×1.000) | = **Intech 24083-SP1** (W716 × L2000) |

Bằng chứng máng nhánh = dàn con lăn Intech: đầu cao máng **H950** = đúng cao băng phân loại **950**.

### 11.3 Vị trí trên bản vẽ `DCMTG1.dwg` (toạ độ sơ đồ, m — đổi từ DXF: x−29,64 · 68,69−y)

* **Băng phân loại**: trục x 87,70–88,50, z 10,3 → 41,6; **20 máng mỗi bên**, bước 1,25 m, máng dài
  ~2 m; cuối mỗi máng 1 pallet 1,2×1,0 (trái x 84,30–85,50 · phải x 90,70–91,90). Đầu dưới rẽ trái
  thành băng vào (z 40,9–41,6, tới x 83,6) — chỗ đặt trạm dán nhãn Liên Minh + 3 tủ kỹ thuật.
* **3 line OUT** (x 96,66 / 99,86 / 103,66, rộng 0,70): dài 5,12 m từ trong ra tường (Intech: 5.063),
  nhánh reject 1,2 m ở z 38,86–39,56 (OUT 3 và OUT 1 đá sang trái, OUT 2 sang phải), băng nâng hạ 3,0 m sát cửa.
* Bản ME xác nhận cùng hình: "CHUYỀN IN" + "PACKED LABEL" + 3 chữ T ở OUT 1/2/3.

### 11.4 Còn chưa chắc

* Intech ghi **Qty 2** nhưng bản vẽ có **3** line OUT giống hệt ⇒ line thứ 3 lắp sau hoặc hãng khác — chưa rõ.
* Vị trí máy dán nhãn + khung Cognex **trên** băng vào là gần đúng (bản vẽ chỉ ghi "PACKED LABEL" ở đầu băng).
* Cao đầu ra băng nâng hạ chỉnh 0,65–1,20 m theo sàn xe → mô hình đặt 0,95 m (TẠM).

### 11.5 Đã dựng vào mô hình 3D

`kho170-3d.html`: hằng `BC` + hàm `dungBangChuyen()`; thông số nhóm **"7 · Băng chuyền"** trong
`kho170-thongso.js`; góc nhìn mới **"Băng chuyền"**. Nét khung băng tải + đường gióng kích thước trong
vùng băng chuyền KHÔNG còn dựng thành vách 3,2 m (hàm `netLaVach`), và được tính là vật cản cho xe nâng.
Máng dùng mặt vân con lăn (720 hình trụ tốn ~6% khung hình); con lăn thật chỉ ở cụm reject.

---

## 12. ĐỐI SOÁT VỚI `DC HASAKI 3d.pdf` (28/09/2026)

`C:\Users\lechitam\OneDrive\Desktop\DC HASAKI 3d.pdf` (1 trang, 792×612 pt) — mặt bằng MÀU, **đúng tỉ lệ**
(căn 3 tường bao: 60,95 px/m ngang · 60,90 px/m dọc trên ảnh 7000 px — lệch < 0,1 %). Tường thật vẽ màu
**hồng (255,0,127)**; khu A8 ghi thẳng mã vị trí từng bàn.

### 12.1 Sửa sai: khối trái sâu 60,2 m (không phải 55,6 m)

Tường dưới khối trái ở **z 62,95** (DCMTG1 nét 62,85/63,05); 58,30 chỉ là mép cửa ở tường bên. PDF và bản ME
đo tỉ lệ cùng ra 60–61 m. Đã sửa `nhaYTrai` = 62,95 (§10.3 cũng đã sửa).

### 12.2 Khu A8 — bố cục + mã vị trí (CHỐT, hết "chưa gán mã" của §8.2/§9.5)

* **4 line băng chuyền DỌC**, mỗi line = dãy bàn trái | băng | dãy bàn phải:
  `501|502|503 · 504|505|506 · 507|508|509 · 510|511|512` — băng = 1 mã (`F0-A8-502-01-01-01`,
  `505-01-01-02`, `508-01-01-03`, `511-01-01-04`), bàn `F0-A8-<dãy>-<01…08>-01-01`, đánh **từ trên xuống**
  theo 4 cặp 01-02 · 03-04 · 05-06 · 07-08.
* Khớp 3 nguồn: PDF = danh mục WMS 15/09/2026 (64 bàn + 4 băng) = `MAP_A8` của dashboard. Mô hình 3D kiểm
  tra 64/64 bàn đúng mã, 0 thiếu, 0 thừa.
* Kích thước (DCMTG1, PDF xác nhận): bàn 1,20 × 0,60 m · băng rộng 0,80 m · tâm băng x 17,45 / 22,15 / 26,85
  / 31,55 (bước 4,70 m; PDF 4,75) · băng từ z 40,99 → 53,31 + đoạn cuối 2 m tới 55,31 · khe giữa 2 cặp bàn 2,03 m.
* Cao mặt bàn / mặt băng A8 vẫn **TẠM** (0,75 / 0,80 m) — không bản vẽ nào có mặt đứng khu này.
* Mô hình cũ ở chế độ "thông số" xếp 8 bàn liền theo HÀNG NGANG (sai hướng) → đã viết lại
  (`oA8TheoTs` + `a8GanMa`), dựng lại trùng bản vẽ, lệch 0 cm; thêm 4 băng chuyền (trước đó thiếu).

### 12.3 Vách rác — công cụ `hasaki/qc-vach-kho170.mjs`

Mô hình dựng mọi nét ≥2 m thành vách 3,2 m. Công cụ đặt từng nét lên ảnh PDF, đo phần nằm trên vạch hồng:
≥ 55 % → GIỮ. Kết quả 538 nét: **giữ 71 nét / 771 m** (tường bao, phòng Re-IT / Ortery / SPA, phòng họp,
kho giấy + WC, khu Gift/KZ) · **bỏ 467 nét / 1.485 m** (mép khung kệ, ô pallet khu nhận PO + chia IT, đường
gióng kích thước, vạch bãi xe van, mũi tên, mép băng chuyền, đoạn trùng ô cửa cuốn). Ra
`kiemsoatkho/kho170-vach.js` (mô hình nạp để bỏ vách rác) + ảnh soi `.exports/qc-vach-kho170.png`.

```
node hasaki/qc-vach-kho170.mjs --anh      # cần .exports/dc-hasaki-3d-7k.png (render PDF 7000 px bằng pdfjs-dist@latest + @napi-rs/canvas)
```

Sửa bản vẽ DCMTG1 → chạy lại `kho170-sodo-build.mjs` RỒI chạy lại công cụ này (khoá vách theo toạ độ nét).

---

## 13. KỆ SELECTIVE / DOUBLE-DEEP THEO TRANG MẪU + KỆ TƯỜNG 5L (28/09/2026)

### 13.1 Trang mẫu `new-warehouse`

`https://ai-tool.ngrok.app/new-warehouse` (trang "Kho Liên Anh C15" — khung dựng gốc của `kho170-3d.html`).
Cách dựng kệ của nó: **khung đứng ở mọi ranh bay, 2 bay liền nhau DÙNG CHUNG khung** (2 trụ + giằng chéo
zic-zắc) · **beam trước/sau chạy dọc bay**, mỗi tầng 1 cặp · **2 pallet/bay/tầng**, pallet 1,0 × 1,2 m chìa ra ngoài,
**sàn cũng để pallet** · **selective = 2 dãy quay lưng khe 0,3 m** · **double-deep = hàng sâu dính liền**.

Mô hình kho 170 trước đó sai cấu kiện ở A2: mỗi ô 4 trụ riêng (2 bay liền = 2 trụ đứng sát nhau), beam
nằm theo chiều SÂU, không giằng; và mỗi dãy A2 bị gán ô rộng 2,0–2,3 m nên cặp kệ phình 4–4,6 m, lối chỉ còn ~0,4 m.

### 13.2 Số thật kho 170 đã dùng (giữ nguyên chiều cao/kích thước/khoảng cách)

| Khối | Vị trí mặt kệ (DCMTG1 — nét mặt kệ ≥15 m) | Loại kệ (NCC) | Cao |
|---|---|---|---|
| A2 501\|502 | 1 kệ đơn x 48,90–49,90, **2 mặt** (501 kệ tay 01–04 · 502 thêm pallet 20/30/40 — khớp WMS) | Thăng Long | trụ 5,0 · beam 1,43/2,90/4,15 |
| A2 503…514 | 6 cặp: 52,80 · 58,00 · 63,20 · 68,40 · 73,60 · 78,80 (+1,30 kệ thứ 2) | layout Thăng Long (file C4700+layout): cặp **2.300** · lối **2.900** · nửa khối 9.650 · lối cắt 3.200 · tổng 32.200 | như trên |
| A2 517\|518 | 94,90 · 96,20 — **double-deep** (WMS mỗi ô có lớp `.01`/`.02`; mã cũ không chấm còn song song) | Thăng Long "D2480×R1000×C4700 – Double deep" = 2 kệ 1.000 + giằng 300 + rào bảo vệ đôi | như trên (khối hàng tô tím) |
| A2 519\|520 · 521 | 100,10 · 101,40 · 105,30 (521 chỉ tầng 10/20 ⇒ 1 beam) | | |
| A1 | 8 kệ 2 mặt (§10.2) | Tín Đạt/Eurorack | trụ 5,0 · kệ tay 0,15/0,50/0,80/1,10 · pallet 1,42/2,52/4,32 |
| **5L1** | tường trái x 12,70–13,70, 24 ô pallet 1,0 m (nhãn z 4,29…31,79) | **TL-KHN-D5480×R1000×C4100** (09/01/2025): mô-đun 5.480 = bay 2 pallet 2.270 + bay 3 pallet 3.210 — khớp nhóm 5 ô trên mặt bằng | trụ 4,1 · beam ~1,75/2,89 (đo hình) |
| **5L2** | tường trên z 3,01–4,01, 26 ô (x 13,82…40,82) | giả định cùng loại 5L1 (sâu 1,0); chia bay 2+3 là TẠM (bản vẽ không vẽ khe khung) | như 5L1 |
| **5L3** | áp vách Re-IT/Ortery/SPA, mặt bằng vẽ x 41,30–42,50, 27 ô | **TL-KHN-D5970×R1100×C3000** (08/01/2025): bay 2.480 + 3.490 | trụ 3,0 · beam ~1,68/2,86 (đo hình) |

Vì sao 5L1/5L2/5L3 "mất": chưa bao giờ được dựng thành kệ — trước đây chỉ nét viền ô của chúng hiện thành
"vách" 3,2 m; bộ lọc vách rác (§12.3) bỏ các nét đó nên chúng biến mất. Nay dựng thành kệ thật (32 bay, 77 ô).

### 13.3 Câu hỏi mở — khối C5000 (31/03/2025)

Bộ `29.3 - Layout C5000` (Thăng Long) là một khối **25,5 × 24,8 m**: 1 cụm **drive-in** sâu 5,2 m (tay đỡ + máng
trượt) · 1 cụm **double-deep 4 hàng liền** sâu 4,9 m · 2 cặp selective 2,3 m; mỗi hàng **11 bay** (2.480 + 9×2.390 +
1.450) — khớp dãy WMS **515/516** (11 tủ, toàn double-deep, tạo 19/05/2025). Nhưng **cả DCMTG1 (08/2026) lẫn PDF
28/09 đều không có khối này** ⇒ chưa đưa vào mô hình. Cần xác minh tại kho: đã lắp chưa, ở đâu.

### 13.4 Mã nguồn + bộ đo

`kho170-3d.html`: `A2_KE` (bảng mặt kệ A2) · `a2ThucTe` · `L5` + `hang5L` · `hangTuO` · `dungHeKe` (dựng mọi dãy kệ).
Phần tĩnh (giằng, beam, rào, khối hàng, mâm/pallet) gộp thành hình liền — trình duyệt chạy CPU xử lý ~9.000 khối
instanced chậm; trụ giữ instanced để bộ đo đếm. Bộ đo `qc-kho170-3d.mjs`: 61 mục (thêm: A1 80 bay · A2 150 bay ·
5L 32 bay / 231 pallet · trụ = 2 × khung). Vòng mô phỏng xe nâng đổi sang "đủ số khung hình" (máy chậm vẫn phán được);
mốc tốc độ mới ≥ 4 fps SwiftShader (cảnh đủ cấu kiện ~5; mốc cũ 8 là cảnh thô).

---

## 14. CỤM C5000 · KỆ TƯỜNG ĐẦU DÃY A2 · SẠC XE NÂNG · XE VAN + DÒNG HÀNG (28/09/2026)

### 14.1 Cụm C5000 bên phải A2-514 — đọc lại theo user + 2 ảnh chụp tại kho

Ảnh (OneDrive Desktop `1790564289772_…jpg` — đứng trên trục phân loại nhìn dọc; `1790564605344_…jpg` — nhìn từ phía
pallet: mỗi bay có 2 đầu máng "ZONE 6C / ZONE 5A / KT4", pallet zone đặt dưới sàn trong lòng bay): **kệ double-deep dựng
ĐÈ lên máng băng chuyền phân loại**. Trang 3 layout C5000 đọc từ tây (A2-514) sang đông:

`lối 2.900 · DD 2.300 đè máng tây (515) · trục phân loại · DD 2.300 đè máng đông (516) · lối 2.900 · DD 4 hàng 4.900
(517|518) · lối 2.900 · selective 5.200 (519|520 + 521; bản vẽ vẽ như drive-in nhưng thực tế selective)`.

* 515/516: 11 bay (2.480 + 4×2.390 + 1.450 + 5×2.390 = 25,44 m) — dưới mỗi bay 2.390 là 2 cổng máng (bước 1,25 m);
  đặt cân giữa 20 cổng máng (z 12,36 → 37,80). Không pallet sàn (sàn là pallet zone + máng). Beam 1,43/2,90/4,15 > đầu
  máng 0,95 m. Khớp WMS 515/516 (11 tủ, toàn double-deep).
* Các dãy sau khối đè máng **thụt lùi** cho đầu dãy thẳng hàng khối A2-501…514: dùng đúng bố trí bay của A2-514.
* Chia bên trong khối 5.200 (cặp 2.300 + lối 1.900 + kệ đơn 521) là GIẢ ĐỊNH — thông số `c5*` sửa được.

### 14.2 Kệ tường đầu dãy A2 (phía tủ 01 của 501…520)

Sâu 1,0 m, z 3,01–4,01 (nối tiếp 5L2 bên A1). x 48,65→84,0: 5 mô-đun layout Thăng Long (bay 1.200 + 2.300 + 2.300, bước
7,19 m, hở 0,6 m ở cột nhà); x 84,69→89,47 và 99,97→110,10: bay 2,39 theo DCMTG1 (nhãn 07·06 · 05·04·03·522-02).
21 bay. Cao/beam giả định cùng hệ A2. Ô `522` cũ (nằm ngoài tường) đã bỏ.

### 14.3 Sạc xe nâng

DCMTG1: "TỦ SẠC" x 42,86 · z 2,89 + 2 xe đỗ sạc (x 42,7–48,5 sát tường trên). Dựng 2 tủ sạc treo tường + dây sạc +
2 xe NICHIYU đỗ trong ô vạch vàng; ô đỗ là vật cản cho xe đang chạy.
**Sửa lỗi xe nâng chạy ra ngoài kho:** vật cản cũ chỉ là khung 115,9×65 m (bao cả sân) → qua khe cửa cuốn xe lọt ra.
Nay toàn bộ phần ngoài nhà chữ L là vật cản.

### 14.4 Xe Ford Transit + dòng hàng

* Dáng xe theo `C:\Users\HASAKI\Downloads\Ford-Transit-Van.dwg` (4 hình chiếu: dài/cao ≈ 2,15, cơ sở ≈ 0,63 × dài);
  kích thước theo thông số hãng Transit VN 2023 (5,78 × 2,00 × 2,36, cơ sở 3,75) — **TẠM, cần đối chiếu cà-vẹt**.
  Màu đen Absolute; 2 cánh cửa sau mở ~100°.
* 4 cửa cuốn khoét ở tường dưới khối phải: **IN** (băng chuyền in nhãn, x 84,8) + **OUT 3/2/1** (theo tim 3 line Intech).
* Dòng hàng: người bưng kiện từ thùng xe ở cửa IN → đặt lên băng vào → qua **trạm cân + đo kích thước + camera
  Cognex** (đèn flash quét mỗi kiện) → trục phân loại → rẽ vào 1 trong 40 máng. 3 line OUT: kiện chạy qua cổng camera
  (flash) → băng nâng hạ → vào thùng xe (có người nhận hàng).
* Bộ đo `qc-kho170-3d.mjs`: 65 mục (thêm: cụm C5000 8 hàng double-deep · kệ tường 21 bay · 4 xe + 4 người + 4 đèn quét ·
  flash có nháy · 0 xe nâng ngoài nhà).

---

## 15. DÒNG HÀNG MÔ PHỎNG + CHỈNH THEO ẢNH USER (28/09/2026 tối)

Ảnh tham chiếu (OneDrive Desktop): `1790567560962_…jpg` (trụ kệ phải nằm GIỮA 2 đầu máng; xe + người ở đầu băng
phân loại), `1790567981582_…jpg` (dãy selective đơn 521 không có thật), `screenshot_1790568210.png` (thiếu cặp kệ
cạnh WC), `screenshot_1790568501.png` (cửa xe tải SPX / J&T).

* **Máng thẳng hàng kệ:** 20 máng mỗi bên đặt đúng dưới 20 vị trí pallet của 10 bay 2 pallet (515|516); bay 1,45 m
  là lối cắt, không máng ⇒ trụ kệ rơi giữa 2 đầu máng, pallet zone dưới sàn trùng pallet tầng trên (lệch 0 cm).
  Trục phân loại co theo (z 12,0 → 40,0).
* **Băng in nhãn ≠ băng phân loại:** nối bằng **băng tải cong 90° R 1,2 m**. Băng in nhãn có máy in + **tay đấm
  dán nhãn A7 trắng** (piston đấm xuống, nhãn 105 × 74 mm dán lên nóc kiện). Không tìm được bản vẽ Liên Minh trên
  máy ⇒ hình tay đấm là dạng chung của máy in-dán (print & apply), chưa theo thiết kế hãng.
* **Trạm quét** (camera + cân + đo kích thước, đèn flash) chuyển về **tủ kỹ thuật băng phân loại** (z 39,2).
* **2 nguồn thả kiện xen kẽ** vào đầu băng phân loại: người bê từ **xe van de XÉO 60° ở băng tải cong** và người
  **khu đóng hàng IT** (x 71–80,5 · z 33–40) thả lên băng in nhãn. Luật: đầu băng trống + đến lượt mới thả; bên kia
  không có kiện chờ thì được thả luôn; chờ quá 6 s thì nhường.
* **Xe Ford Transit** vẽ lại dáng thật bản VN 2023 (5.820 × 1.974 × 2.360, cơ sở 3.750 — giaxeoto.vn), màu trắng,
  bo góc, lưới 3 thanh + logo oval, đèn hậu dọc, ốp đen.
* **Bỏ dãy 521.** **Thêm cặp kệ cạnh WC / kho giấy** (x 38,79–41,29 · z 43,47–53,03; 2 × 4 bay; cao giả định = A2).
* **Xe nâng đỗ sạc** quay song song tường, sát tường. **Xe nâng không vào khu A8 + khu bàn giao** (vùng cấm).
* **A8:** 64 người đóng gói → kiện lên 4 băng → người cuối băng quét **EDA52** (flash) → **sóng HS0199** (780 × 500 ×
  455 mm, xanh dương, 5 bánh) → đầy 12 kiện thì người đẩy ra khu bàn giao, xếp vào ô lưới (SPX: băng 1–2, J&T: 3–4).
* **Bàn giao:** 2 NV SPX (áo cam) + 2 NV J&T (áo đỏ) quét sóng (flash), bê hàng lên **xe tải 2,4 t** (kiểu Isuzu QKR,
  kích thước TẠM): SPX de vào cửa tường dưới khối trái (x 27), J&T de vào cửa tường phải khối trái (z 60,6).
* Bộ đo `qc-kho170-3d.mjs`: 68 mục (thêm: kệ cạnh WC · 20 máng lệch 0 · A8 64 người + 4 sóng).

---

## 16. VẬN HÀNH SOẠN – ĐÓNG – BÀN GIAO + BẢNG MÃ DÃY (28/09/2026 chiều)

Nguồn: ảnh ghi chú 1–4 `OneDrive\Desktop\1790569890428_…jpg` · ảnh bảng thật `1790570462839_…jpg` (A2-507/508) ·
ảnh cột chắn `1786529001334_…jpg` · Drive (công khai, đọc qua `embeddedfolderview`): `HƯỚNG DẪN ĐƯỜNG ĐI SOẠN HÀNG_A0.pdf`,
`A1_5xx_size 980x594mm`, `A2_5xx_size a2`, `5xx_BangDayKeTamGiac.pdf` + ảnh cách gắn.

* **Ghi chú 1** = khu trữ xe (43 ô "PICK" dọc tường trái): 36 xe đẩy 2 tầng **XDR100T2 755 × 435 × 775** đỏ xếp gọn;
  tổng 100 xe (64 theo người).
* **Ghi chú 2** = 64 ô "PICK" cạnh bàn A8: khối xanh bỏ; xe đẩy đỗ đúng ô đó khi về trạm, **người đứng cạnh xe, phía
  gần băng chuyền**.
* **Ghi chú 3** = bỏ dãy trong cùng (sát tường) của cặp kệ cạnh WC ⇒ còn 1 dãy × 4 bay.
* **Ghi chú 4** = ranh khu bàn giao ĐVVC: z 59,3 (x 24,8 → 42,0) + x 24,8 (z 59,3 → 62,95). Thay vạch kẻ bằng **cột inox
  2 dây rút đỏ** (12 cột). 2 cổng: SPX (x 26,6–28,5), J&T (x 36,1–38,0). Cửa J&T dời về z 61,1 cho nằm trọn trong khu.
* **64 NV vòng liên tục:** kéo xe 2 tầng đi soạn A1 theo tuyến **ziczac** của PDF (xuống ở lối xe nâng, lên ở lối nhặt trong
  cụm: trái 5L1 ↓ · 502|503 ↑ · 504|505 ↓ · 506|507 ↑ · … · phải 516 ↓ tới KẾT THÚC), dừng quét mỹ phẩm (flash) → về trạm
  A8 đóng gói (90–200 s, thả kiện lên băng) → đi soạn tiếp. Tốc độ mỗi người khác nhau (0,75–1,2 m/s) ⇒ số người ở trạm
  thay đổi liên tục (không chốt cứng).
* **2 người quét kiêm bàn giao** (thay 8 người): người 1 lo băng 1–2 → cổng SPX; người 2 lo băng 3–4 → cổng J&T. Băng CHỈ
  chạy khi người quét đứng ở cuối băng đó; băng kia **ứ hàng tại chỗ trạm, chất chồng** (tối đa 7 kiện/chỗ thì NV chờ).
  Hết hàng băng này thì đi qua băng ứ → băng chạy lại. Đủ sóng thì đẩy tới cổng → thu dây → đẩy sóng qua → NV ĐVVC quét
  nhận (flash) → đóng dây → lấy sóng rỗng về. NV ĐVVC bê 6 kiện/chuyến lên xe tải.
* **Sóng** đổi sang loại 26 bánh **1.180 × 880 × 689 mm** (chứa 30 kiện trong mô phỏng).
* **Bảng mã dãy:** A2 — bảng cam viền xanh 594 × 420 ở beam thứ 2 từ trên, đầu dãy phía tủ 01, mỗi số dãy 1 bảng;
  A1 — foam 980 × 594 (2 ô số cho 2 mặt kệ) đầu kệ; **bảng tam giác** (cạnh 10 cm, cao A5) trên mỗi trụ mặt kệ trong lối
  nhặt 1,2 m (502·503·506·507·510·511·514·515), 2 mặt ghi dãy + tủ 2 bên trụ (144 mặt). Gộp 2 lưới atlas.
* **WC · kho bóng · kho giấy** theo DCMTG1: 4 bệt + 3 lavabo WC nữ, 2 bệt + 4 tiểu WC nam, máy dập, 2 máy bế lăn, bàn dán
  thành phẩm, máy cắt bóng, 4 thùng phân loại rác, bóng xốp đóng đơn, 72 cây bóng NCC, 9 pallet giấy.
* Bộ đo: 69 mục, đạt toàn bộ (2 lượt).

---

## 17. LUẬT ĐI LẠI NGƯỜI – XE NÂNG + CHỈ 1 BẢNG/DÃY (28/09/2026 tối)

* **Không chen lấn:** người đi sau giữ ≥ 1 m với người phía trước (cùng chiều hoặc đang chờ) và đứng chờ theo; người trước
  đang dừng quét thì vượt sang phía đối diện (cách ~0,6 m); ngược chiều thì ai cũng nép phải 0,25 m.
* **Xe nâng nhường người:** xe đứng im (không chạy, không xoay, không "canh ô") khi có người trong 2,6 m quanh xe hoặc 3,4 m
  trước mũi; chờ > 5 s mà có người đang chờ gần ⇒ xe dời ra xa người đó (tiến/lùi, đường phải trống). Người xét KHUNG
  THÂN XE (hopXe, hợp hướng đích + hướng đang hiển thị): xe đang nhúc nhích ⇒ đứng yên tại chỗ; xe đứng yên ⇒ chọn mức lệch
  ngang nhỏ nhất vừa cách khung xe ≥ 0,3 m vừa không đâm kệ/tường, dạt ngang xong mới bước; không có mức nào ⇒ chờ.
* **A8 không xuyên bàn / băng:** đi theo hành lang giữa các line (x = ô xe đẩy ∓ 0,8 m, phía ngoài xe) → lối ngang z 39,3 →
  tuyến soạn A1; về ngược lại. Lúc mở trang người đang pick được rải đều theo chiều dài tuyến, ai trùng khung xe nâng thì
  dời tới trước.
* **Bảng tam giác:** mỗi dãy lối nhặt A1 chỉ 1 bảng ở trụ đầu tủ 01 (bỏ các vị trí khác như 05/06/10) — 8 dãy × 2 mặt.
* Soak 2 phút ×4 tốc độ (~8 phút mô phỏng), 2 lượt: 0 lần xe nâng chạm người · 0 lần xuyên bàn/băng · 0 người kẹt quá 7,5 s ·
  2 người sát < 0,3 m ở 4–6 % khung (lúc rẽ góc / vượt). Bộ đo 72 mục: 3/5 lượt đạt toàn bộ; lượt lỗi: 1 lần fps 3 (máy),
  1 lần 69 cặp chạm trong 12 s đầu (chưa tái hiện được khi chạy riêng).
* Bộ đo cơ cấu xe nâng (nâng hạ, xi-nhan) chạy với lối trống: NV soạn được đưa về trạm trước phép đo đó.

---

## 18. CAMERA MỚI + TÌM MÃ + A6 + VÁCH WC + TRẠM ĐÓNG GÓI A8 (28/09/2026 chiều)

User duyệt bản thử góc nhìn (4 kiểu vẽ khác "kiểu nào cũng xấu" — đã bỏ). Gộp thẳng vào `kho170-3d.html`:

* **Camera** (khối "6. Camera"): 4 kiểu điều khiển ① Xoay tự do (kéo phải/Shift/2 ngón dịch, cuộn phóng về con
  trỏ, quán tính) ② Bản đồ ③ Đi bộ (mắt 1,65 m, không xuyên vật cản — dùng `oTrong`) ④ Bay; phép chiếu phối cảnh /
  trực giao (phím O); khối hướng nhìn vẽ bằng three.js (CSS 3D bị lật gương chữ); bản đồ nhỏ chụp 1 lần; chạm đúp
  = bay tới; 3 kiểu hiển thị (chuẩn · tông phim · mô hình trắng + SAO). API: `CAM.o`, `CAM.flyTo`, `CAM.timMa`.
* **Tìm mã vị trí** (hàng đầu thanh nút): chỉ mục 390 mã = oA1 + oA2 + bàn A8 (`imMam.A8`), dựng lại sau mỗi
  `dungKho`. Gõ thiếu `F0-` vẫn ra; một phần mã (`F0-A2-507`) → khoanh cả dãy; mã có tầng/ô dài hơn → về ô cha.
* **A6** `dungA6()` theo ảnh camera "Return" `OneDrive\Desktop\screenshot_1790579112.png`: 5 bàn máy tính dọc tường
  dưới + kệ rổ, cụm **bàn quản lý** 2×2 + bàn nối (x 12,9–16,9 · z 58,8–60,4), 2 kệ sắt tường trái, 3 bàn dài dọc
  ranh ĐVVC (mép x 24,55 < vạch 24,8 — không đè), 7 sóng hàng hoàn. Vật cản đưa vào `dungCan`.
* **Vách WC** `dungVachWC()`: nét WC trong DCMTG1 bị `kho170-vach.js` xếp là rác ⇒ dựng riêng: tường phải x 46,33,
  tường dưới phần nam, tường chia nữ|nam x 44,43, tường tiền sảnh lavabo z 45,65; 4 buồng nữ + 2 buồng nam (HPL 1,9 m,
  hở chân 0,15) + tấm chắn tiểu.
* **Trạm đóng gói A8** `dungTramA8()` theo ảnh bàn thật `width_600.jfif` + Canva 3 tầng (canva.link/apoj0s8qt2jcrgy):
  bàn gỗ 1,2 × 0,6 (instanced giờ chỉ là MẶT bàn 5 cm — vẫn tô màu vệ sinh), khung thép trắng + lưới sau ở mép sau
  (2 bàn quay lưng nhau), kệ trên 1,95 m viền xanh chất carton phẳng (vân lớp), màn hình + máy quét + máy in +
  bàn phím + rổ đỏ + băng keo trên bàn, camera dưới kệ trên, CPU + 2 thùng carton dưới bàn.
* "Bảng thông tin dãy kệ chưa cập nhật" = bản thử dựng từ bản gốc TRƯỚC khi có mục 16–17 (1 bảng/dãy) — nay đã gộp.
* Bộ đo: 78 mục (thêm 6: tìm mã · 4 kiểu điều khiển · A6 không đè vạch · WC ≥ 15 tấm), đạt toàn bộ.
* **Chỉnh theo ảnh `screenshot_1790580965.png` + `screenshot_1790581263.png` (28/09 chiều):**
  ① ranh bàn giao ĐVVC nâng lên vạch mới **z 59,3 → 57,8** (13 cột: 10 dọc z + 3 dọc x 24,8) ·
  ② **kệ selective đơn `KRAC`** 2 bay 2.390 (x 37,12–41,90 · z 56,45–57,45, sâu 1,0, cao giả định = A2) · kệ cạnh WC 4 → **3 bay** ·
  ③ cụm bàn quản lý cắt đôi + xoay 90° ⇒ **3 dãy bàn VUÔNG GÓC tường trái** (mỗi dãy 2 bàn 1,6 × 0,8 + 2 ghế cùng phía +z,
  z 54,8 / 56,6 / 58,4, cách nhau 1 m) · 4 **kệ mâm sắt D1500 × R500 × C2000** vuông góc tường trái ở 2 ô đỏ (z 51,25 · 51,75 ·
  52,95 · 53,45) · ④ 2 kệ mâm sắt cũ dời về góc dưới-trái, cũng vuông góc tường (z 61,35 · 62,62). Bộ đo 79 mục, đạt toàn bộ.
* **A6 lần 3 (ảnh `screenshot_1790582206.png`):** mọi bàn dọc ranh ĐVVC = **D1500 × R600** (4 bàn, x 23,95–24,55 · z 56,25–62,25);
  bàn quản lý D1500 × R600: dãy 1 (2 bàn vuông góc tường trái, x 12,41–15,41 · z 60,3–60,9, ghế +z) dời theo mũi tên;
  dãy 2 + 3 xoay 90° ⇒ **4 bàn dọc tường trái** sát tường (x 12,41–13,01 · z 53,85–60,0), ghế phía trong phòng; kệ mâm sắt
  góc dưới-trái thứ 2 dời theo mũi tên về sát tường dưới (x 13,91–15,41 · z 62,37–62,87); dãy bàn máy tính lùi +0,21 m.
* **Bảng mã dãy — đối chiếu bộ file in thật** (Drive "bảng số dãy kệ" 1IlezB2kbR57u7MK4ThFv2V2PKz_iNCrJ, bản tải ở scratchpad
  phiên 28/09 `bang-day/`): A1 foam **980 × 420** (không phải 980 × 594), 2 ô cặp lẻ|chẵn 501|502 … 515|516 · A2 bảng đơn
  594 × 420 **chỉ 503–514** (515–521 không có bảng in) · **A2 501|502 = 1 foam 980 × 420 hai ô** · tam giác: bộ in có 8 bảng/dãy
  ở trụ GIỮA 2 tủ (02|01, 03|02, 04|03, 05|04, 07|06 … 10|09; không có trụ 05|06 vì lối cắt) — mô hình giữ luật user "1 bảng/dãy"
  nhưng đặt ở trụ giữa tủ 01|02, 2 mặt ghi 01 và 02. Chưa vẽ: bảng **"KHO" 420 × 297** (501–512 + 507A, bản 15/01/2026 —
  chưa rõ khu nào) và nhãn beam 8 × 32 (A1) / 8 × 40 (A2, không có tủ 05). Bộ đo kiểm đúng 12 đơn · 9 foam 2 ô · 16 mặt tam giác.
* **A6 lần 4 (ảnh `screenshot_1790583065.png`):** bàn dọc ranh ĐVVC còn **3** (z 57,75–62,25) · cột bàn dọc tường trái thu còn
  **4 bàn D1000 × R600**, đảo thứ tự **bàn → ghế → tường** (bàn x 13,11–13,71, ghế sát tường), z 57,0–61,0 · dãy bàn quản lý
  vuông góc dời sang x 13,75–16,75 (z 60,3–60,9), thành chữ L với cột bàn.
* **Dời cả khu A8 −2,55 m về phía A1** (ảnh `screenshot_1790583512.png`): hằng `A8_DZ` áp lên dữ liệu bản vẽ TRONG BỘ NHỚ
  (ô `pack` + 64 ô `pick` trạm, gắn cờ `_a8`; tệp kho170-sodo.js giữ nguyên) ⇒ băng A8 z 38,44–52,76; lối ngang NV
  `zNgang` 39,3 → 36,75; vùng cấm xe nâng dời theo; nhãn khu dời theo.
* **Bảng tên dãy ĐỒNG BỘ về đầu dãy PHÍA NAM** (vạch xanh trong ảnh, phía A8 / lối ngang) cho cả A1 và A2: foam A1, foam
  A2 501|502, bảng đơn A2 503–514 đặt ở `khung.at(-1) + 0,06`, mặt chữ quay +z (hàm `tamZn`, ô trái = x nhỏ); bảng tam giác
  lối nhặt ở trụ giữa tủ 09|10. Bộ đo 79 mục, đạt toàn bộ (gồm NV không xuyên bàn/băng, xe nâng không chạm người).
* **Lần 5 (ảnh `screenshot_1790584162.png`):** bảng đầu dãy (vạch xanh) **nâng +1 m, to +30 %** (`BANG_NANG`, `BANG_TO`) ·
  bảng tam giác **ĐỦ BỘ IN** thư mục "148 x 210 x 10 cm_2025_05_15": 8 bảng/dãy ở trụ giữa 2 tủ liền nhau (bỏ 05|06 = lối
  cắt) ⇒ 128 mặt · cột bàn dọc tường trái tách ở vạch xanh: 2 bàn trên giữ z 59,0–61,0, 2 bàn dưới dời −2,75 m về z 54,25–56,25 ·
  kệ mâm sắt mỗi ô = **2 kệ ĐỘC LẬP khe 6 cm** + thêm 1 cặp ở đầu mũi tên đỏ ⇒ 3 cặp (z 49,27–50,33 · 50,97–52,03 · 52,67–53,73) ·
  **NV soạn quay đầu**: kẹt sau xe nâng > 5 s hoặc sau hàng người đang chờ > 6 s ⇒ đi ngược lại đúng đường đã đi về trạm
  (đường chắc chắn trống, 1 lần/chuyến). Đo 60 s ×3: 8 lượt quay, 0 lần xuyên kệ, chờ lâu nhất 10,9 s. Bộ đo 81 mục, đạt toàn bộ.
