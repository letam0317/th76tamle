# RÀ SOÁT ĐẶT TÊN MÃ VỊ TRÍ KHO 170 THEO TÀI LIỆU HR — 15/09/2026

Mục đích: tìm đúng **tài liệu quy ước đặt tên mã vị trí + sơ đồ kho** của công ty (trên nền tảng HR
`hr.hasaki.vn/company/document`), rồi đối chiếu **toàn bộ 7.414 mã vị trí đang có trên WMS của kho 170**
(2 mã kho 1436 SHOP + 1443 WH) xem đặt đúng hay sai.

---

## 0. Tài liệu đã tìm được

### 0.1 Trên HR (nguồn chính — 18.617 chapter đã quét tiêu đề)

| Mã tài liệu | Tên | Ban hành | Áp dụng cho | Dạng | Nội dung chính |
|---|---|---|---|---|---|
| **COS-S-010** | Tiêu chuẩn tạo mã quầy kệ khối mỹ phẩm | 18/07/2022 | Quầy kệ **trong cửa hàng** | PDF chữ | Công thức `Fx-Ay-cc-dd-ee-hh` + 6 luật đếm |
| **HSK-HD-187** | Hướng dẫn xác định mã vị trí cho một sản phẩm | 03/06/2024 | **Toàn bộ nhân viên Hasaki** | PDF/PPTX | 6 cấp `Fxx(Bxx)-Ayy-zzz-aa-bb-cc`, cấp 3 = **bề mặt** (1zz…6zz) |
| COS-HD-194 | Hướng dẫn đọc hiểu mã vị trí kệ | 03/11/2023 | Khối Cosmetics | Video | Chỉ có video, PPTX kèm không có phần nội dung |
| COS-HD-370 (v01) | Hướng dẫn khai báo mã vị trí một chi nhánh | 06/08/2025, sửa 08/01/2026 | Tất cả chi nhánh | 5 video | Ch.01 hàng hoá · Ch.02 tài sản (ký tự thứ 2 đổi `A → XXy`) · Ch.03 nhập WMS · Ch.04 in/dán · Ch.05 đổi mục đích |
| **COS-HD-491** (chapter) | Khai báo mã vị trí cho một chi nhánh (SOP) + bản EN "Setting Up Location Codes for a Store" | 08–17/04/2026 | Chi nhánh | PDF ảnh 12 trang | `Fx-Ay-aa-bb-cc-dd`, F1 = trệt, A1 = trưng bày, A2 = kho; import Excel; đổi Pick ↔ ST |
| CLI-HD-963 | Hướng dẫn dán mã vị trí khối Clinic | 20/03/2025 | Clinic | PPTX | Ví dụ `F05-A05-501-06-01-01`, vị trí dán tem |
| (doc 850) | Sơ đồ về kho | 04/05/2021 | Cosmetics | PDF | Chỉ là **sơ đồ luồng nghiệp vụ** (nhận PO/IT/return → kho → xuất), không có mã vị trí |
| MKT-HD-032 | Hướng dẫn bố trí layout hàng hoá | 22/11/2023 | Cửa hàng | PDF | Layout trưng bày hàng, không liên quan mã vị trí |

Link file gốc (tải không cần đăng nhập, host `hr-media.hasaki.vn/production/training/…`):
- COS-S-010: `22/07/23/TieuchuantaomaquaykekhoimyphamCOS-S-010_145732.docx2.pdf`
- HSK-HD-187: `24/06/03/HSK-HD-187.HuongDanXacDinhMaViTriChoMotSanPham.pdf` (+ `.pptx`)
- COS-HD-491 SOP: `26/04/17/Khaibaomavitricho1CN_2026-04-17_154916.pdf` · bản EN `26/04/17/BranchLocationCodingSOP17.pptx_2026-04-17_155134.pdf`
- COS-HD-370 tổng quan: `26/01/06/Tongquankhaibaomavitri105052171539.pdf`; video Ch.01 `25/09/23/Cachxacdinhmavitriquanlihanghoa_171225.1.mp4`, Ch.02 `25/09/23/HUONGDANXACDINHMAVITRIQUANLYTAISAN1_171258.mp4`
- COS-HD-194 video: `23/11/13/1699847076166-217898896.mp4`

### 0.2 Trên máy (ổ C + D)

Không có file "quy ước đặt tên" nào trên máy — quy ước chỉ nằm trên HR. Máy chỉ có **bản vẽ/sơ đồ và dữ liệu**:

| Tệp | Ngày | Ghi chú |
|---|---|---|
| `C:\Users\HASAKI\Desktop\audithsk\layout\DC HASAKI 6.6.dwg` | 25/07/2026 | **Bản vẽ mới nhất** (AutoCAD, chưa đọc được text — cần xuất PDF) |
| `…\audithsk\layout\DCHASAKI.dwg`, `DC HASAKI 6.10.dwg`, `layoutv1*.dwg` | 2024–2025 | Các bản cũ |
| `…\audithsk\layout\LAYOUT1.jpg` | 05/2024 | Sơ đồ nháp vẽ trên Excel (RACK WH 36PL/102PL, RACK KT, RACK ZONE, CHIA IT, PO, SPA) |
| `C:\Users\HASAKI\Desktop\DCHASAKI.pdf`, `kho_giay.pdf` | 06/2025 | Đã giải mã ở `SO-DO-KHO-170.md` |
| `…\audithsk\location\Xu_ly_vi_tri.xlsx`, `bin_location_suggest.xlsx` | 2024 | Dữ liệu xử lý vị trí cũ |
| `OneDrive\Desktop\template_import_excel_location_listingg.xlsx` | **15/09/2026** | Mẫu import 12 tủ điện (`Rack=TD`, `Shelf=HN/TG`) — đã xoá khỏi WMS cùng ngày |
| `Downloads\Layout.dwg`, `Zalo…\HASAKI-LAYOUT (1).dwg`, `Layout Đèn chiếu sáng Kho 170 QL1A Final-Model.pdf` | 2024–2025 | Layout thi công, không có mã vị trí |

---

## 1. Luật đặt tên rút ra từ tài liệu

Mã vị trí luôn có **6 đoạn**, nối bằng `-`:

| Đoạn | COS-S-010 (2022, cửa hàng) | HSK-HD-187 (2024, toàn công ty) | COS-HD-491 SOP (04/2026, chi nhánh) |
|---|---|---|---|
| 1. Tầng | `Fx`: **tầng 1 = F1**, tầng 2 = F2… | `Fxx`/`Bxx`: **tầng mặt đất = F01**, hầm = B01; lên cao/xuống sâu số tăng | `F1` (trệt), `F2` (lầu 1)…, `B1` (hầm) |
| 2. Khu vực | `Ay`: **A1 = khu bán hàng, A2 = khu kho** | `Ayy`: A01… đếm *ngoài vào trong, trái sang phải*; qua tầng mới đếm lại từ A01 | `A1` khu trưng bày, `A2` khu kho |
| 3. Dãy / Bề mặt | `cc` thứ tự dãy, đếm *trái → phải* từ cửa chính, bắt đầu 01 | `zzz` **bề mặt**: `1zz` tường trái · `2zz` tường đối diện · `3zz` tường phải · `4zz` tường cửa · `5zz` sàn · `6zz` trần; chia nhỏ 01… | `aa` dãy, đánh **01–99** trong mỗi khu |
| 4. Tủ / Kệ | `dd` thứ tự kệ, đếm *ngoài vào trong*, bắt đầu 01 | `aa` thứ tự đối tượng đặt trên bề mặt (theo chiều kim đồng hồ) | `bb` số thứ tự tủ/quầy trong dãy |
| 5. Tầng kệ | `ee` đếm *dưới lên trên*, bắt đầu 01 | `bb` tầng | `cc` đếm *dưới lên* (gộp cả hộc tủ) |
| 6. Ngăn / Ô | `hh` đếm *trái sang phải*, bắt đầu 01 | `cc` ngăn | `dd` thứ tự ngăn trong tầng, trái → phải |

Điểm chung của cả 3 tài liệu:
- Chỉ đoạn 1–2 có chữ (`F`, `B`, `A`); **đoạn 3–6 toàn số**, 2 chữ số (riêng bề mặt 3 số).
- Đếm **liên tục, bắt đầu từ 01**, theo hướng *trái → phải, ngoài → trong, dưới → lên*.
- Ví dụ chuẩn: `F1-A1-01-01-01-01` (COS-S-010) · `F06-A08-501-02-01-01` (HSK-HD-187) · `F1-A1-03-02-04-01` (COS-HD-491).
- Khi khai lên WMS (COS-HD-491): cột **Type** 1 Hàng hoá / 2 Tài sản / 3 POSM; **Purpose** Trưng bày (Pick) hoặc Lưu trữ (ST)
  (mẫu import còn có Bin Ảo · Di động · Double Deep); **Storage** Hàng lẻ / SLL / Pallet / Out date / Fashion;
  phải điền **Floor/Area Description**.
- Lưu ý quan trọng trong SOP 2026: đổi mục đích Pick ↔ ST **xoá toàn bộ tiêu chuẩn trưng bày (planogram) cũ** của vị trí.

> Không tài liệu nào viết riêng cho **kho tổng/DC**. Kho 170 đang dùng cách ghép: đoạn 2 theo nghĩa A1/A2 của
> COS-S-010 (A1 pick, A2 lưu trữ), đoạn 3 theo "bề mặt sàn 5zz" của HSK-HD-187, còn A3…A26 lấy theo **số khu 5S**.

---

## 2. Dữ liệu rà soát

- Lấy lúc 15/09/2026 qua API danh mục vị trí của WMS (`GET /wms/accessories/bin-locations/paging`, kho 863 + 874).
- **7.414 mã**: 1436 SHOP = 5.046 · 1443 WH = 2.368. Ảnh chụp dữ liệu: `.exports/vitri-kho170-2026-09-15.json`.
- Kết quả gán nhãn từng mã: `.exports/ra-soat-ma-vi-tri-kho170-2026-09-15.csv` (7.203 dòng có ghi chú).

## 3. Kết quả

### 3.1 Phần ĐÚNG

| Điểm kiểm | Kết quả |
|---|---|
| Cấu trúc 6 đoạn, mã = ghép đúng 6 trường zone/area/aisle/rack/shelf/bin | 7.414/7.414 đúng, không ký tự lạ, không chữ thường |
| A1 = pick hàng lẻ, A2 = lưu trữ pallet | Đúng nghĩa A1/A2 của COS-S-010 & COS-HD-491 |
| Đoạn 3 dùng bề mặt sàn `5zz` (501…522) | Đúng HSK-HD-187 cho 5.606 mã; `WC1-201/202` dùng `2zz` (tường đối diện cửa) cũng đúng luật bề mặt |
| Tầng kệ tay 01–04 liên tục từ 01 | 0 nhóm lệch |
| Ô trong tầng liên tục từ 01 | Chỉ 3 lệch (A8 băng chuyền số 2/3/4 đánh ô 02/03/04) |
| Khớp bản vẽ | Khối A1 (dãy 501–516 + 3 dãy tường) khớp bản vẽ 06/2025 |

### 3.2 Phần SAI hoặc LỆCH CHUẨN

| # | Vấn đề | Số mã | Chi tiết |
|---|---|---|---|
| 1 | **Tầng ghi `F0`** — không tài liệu nào định nghĩa F0 (trệt phải là `F1` hoặc `F01`) | 7.411 | Quy ước riêng của DC, chưa có văn bản. Kèm **3 mã lẻ** dùng kiểu khác: `F01-WC1-201/202-…` (lamnh, 07/2026) và `F1-A26-501-01-01-01` (tamlc, 09/2025) → cùng kho mà 3 kiểu tầng |
| 2 | **Khu vực không phải `A+số`** do người tạo | 1.180 | `PL` 1.000 (pallet di động 001–500, cả 2 kho) · `TOLL` 120 · `NG` 36 (F0-NG-01…37-00-00-00) · `CB` 17 · `PA` 5 · `WC1` 2 |
| 2b | Bin ảo hệ thống tạo 30/07/2024 (không người tạo) | 427 | `FS` 201, `TF` 198, `IT` 6, `PA` 4, `VR/AJ/RT/NG/NF/GI/PO/PG/A0` mỗi kho 1 — chấp nhận được nhưng cũng ngoài chuẩn |
| 3 | **Dãy có chữ** | 205 | `A1-5L1` 60 · `A1-5L2` 43 · `A1-5L3` 52 (3 dãy kệ tường) · `A2-PL-01…50` 50 (kho 1443) — sai cả 3 tài liệu |
| 4 | Dãy 2 số dùng làm số thứ tự bin ảo | 45 | `NG-01…37`, `FS-01`, `IT-01/02`, `PA-01/02`, `RT-01` |
| 5 | **Tủ đánh số nhảy / không từ 01** | 14 dãy + 5 nhóm | A2 kho 1436 dãy 501–514 **đều thiếu tủ 05** (có 01–04, 06–09); A2 kho 1443 dãy 501/502 chỉ có tủ 06–09; `A9-501` tủ 03–08; `A15-501` tủ 02–04; `A9-502` chỉ tủ 02 |
| 6 | **Tầng kệ `10/20/30/40`** thay cho 01,02,03… | 2.567 | A2 1.964 · A1 555 · A3 48. Trong A1, 8 dãy (501,504,505,508,509,512,513,516) + 5L1/5L2/5L3 **trộn** 01–04 với 20/30/40 trong cùng dãy |
| 7 | Ô có dấu chấm (Double Deep `01.01/01.02/02.01/02.02`) | 664 | A2-515…518 = 616 · A3-502 = 48. WMS có mục đích "Double Deep" nên hệ thống chấp nhận, nhưng chuẩn không có |
| 7b | Ô 3 chữ số | 823 | `PL` 802 (001–500), `TOLL` 21 (100–120) |
| 8 | **Cùng một mã ở cả 2 kho** (1 toà nhà, tem chỉ in 1 mã) | 994 mã (1.988 dòng) | `PL` 500 · **`A2` 280** (dãy 501–514, tủ 01–04 & 06–09: kho 1443 tạo 03/01/2025 bởi api@, kho 1436 tạo 01/2025 "move A4 to A2") · `FS` 100 · `TF` 99 · `IT` 3 · `PA` 2 · `A6` 1 · bin ảo 9 |
| 9 | **Khu sai kho / khu chưa có trong 5S** | 2 | `F0-A6-504-01-01-01` ở kho 1443 "Khu vực thiết bị vệ sinh" — A6 là khu của kho 1436, theo 5S phải là **A10**; `F1-A26-501-01-01-01` "Phòng ăn nhân viên" — danh mục khu 5S chỉ tới A25 |
| 10 | **Mô tả trống hoặc còn chữ mẫu** | 5.962 (80 %) | "Mô tả tầng-Mô tả khu vực" 3.298 · trống 1.027 · "move A4 to A2" 925 · "Example" 428 · "Mô tả tầng" 234 · "Mô tả mã vị trí" 50. Theo người tạo: hungbd 1.539 · banghtt 1.833 · tupm1 285 · hệ thống 295 |
| 11 | Thiếu **mục đích** (Pick/ST) ở vị trí hàng hoá | 474 | FS 201 · TF 198 · NG 36 · … |
| 11b | Thiếu **loại lưu trữ** (Hàng lẻ/SLL/Pallet) | 3.797 | A1 2.909 · A2 791 · … |
| 12 | Bản vẽ ↔ WMS | — | Dãy **A2-522** có trên bản vẽ nhưng chưa khai WMS; **A2-515/516** có WMS nhưng không có nhãn trên bản vẽ (từ 2025, chưa đổi) |
| 13 | Mẫu import tủ điện 15/09 | 12 | `Rack=TD`, `Shelf=HN/TG` (chữ trong ô số) — đã xoá khỏi WMS cùng ngày |

**Tổng kết**: chỉ **211/7.414 mã** khớp trọn vẹn mọi luật — toàn bộ là vị trí **tài sản** trong các khu
A3…A25 (bàn đóng gói, kệ VPP, bàn làm việc…). 100 % vị trí **hàng hoá** đều dính ít nhất một điểm lệch
(thường là F0 + mô tả mẫu + tầng 10/20/30/40).

---

## 4. Đề xuất xử lý (theo mức ảnh hưởng)

1. **Không đổi `F0` hàng loạt** (7.411 tem đã dán, rủi ro vận hành) — nhưng **viết phụ lục quy ước cho DC** ghi rõ
   "kho 170 dùng F0 = tầng trệt", rồi sửa **3 mã lẻ** (`F01-WC1-…`, `F1-A26-…`) về `F0`.
2. Phụ lục DC cũng phải liệt kê **khu chức năng** (`PL`, `TOLL`, `FS`, `TF`, `NG`, `CB`, `PA`, `IT`…) và quy ước
   **tầng pallet 10/20/30/40**, **ô Double Deep `.01/.02`** — vì chuẩn hiện hành chỉ viết cho cửa hàng.
3. **Sửa 3 dãy kệ tường `5L1/5L2/5L3`** (155 mã) sang bề mặt số theo HSK-HD-187: tường trái = `1zz`, tường trên
   (đối diện) = `2zz`, vách phải = `3zz`. Sửa `A2-PL-01…50` (50 mã) về nhóm `PL` hoặc thành tủ số.
4. **Xử lý 994 mã trùng giữa 2 kho** — quan trọng nhất là **280 ô A2** (dãy 501–514): ra hiện trường xác nhận
   tủ 01–04/06–09 thực tế thuộc kho SHOP hay WH, rồi vô hiệu bên kia. Pallet `PL` 500 mã trùng: cân nhắc tách dải
   số (vd SHOP 001–250, WH 251–500) để tem không mơ hồ.
5. Sửa `F0-A6-504-01-01-01` (kho 1443) → `F0-A10-…`; bổ sung `A26` vào danh mục khu 5S hoặc gộp về A16/A17.
6. **Điền mô tả** cho 5.962 mã (tối thiểu "khu – dãy – tầng"), ưu tiên A1/A2 (hungbd, banghtt); điền mục đích
   cho 474 mã và loại lưu trữ cho 3.797 mã — có thể làm bằng file import/cập nhật hàng loạt.
7. Khai **A2-522** nếu kệ đã dựng; ghi nhận vị trí thật của **515/516** lên bản vẽ `DC HASAKI 6.6.dwg`.
8. Cấm chữ trong 4 đoạn cuối khi tạo vị trí mới (bài học tủ điện `TD-HN/TG`): tủ điện nếu cần quản lý thì đặt
   là **tài sản** với bề mặt tường `1zz…4zz` + số thứ tự, đúng HSK-HD-187.

---

## 4b. Sheet đề xuất mã mới (tạo 15/09/2026, theo yêu cầu user)

**Google Sheet** `Rà soát mã vị trí kho 170 – đề xuất theo quy tắc (15/09/2026)`
→ https://docs.google.com/spreadsheets/d/17OLVtB4WDQtDNkg3d1NxIEAp7UqOZ_Kz6R9H_5yahWk/edit
(chủ = tài khoản clasp letam0317, **chưa chia sẻ cho ai**; bản xlsx gốc ở `.exports/ra-soat-ma-vi-tri-kho170-de-xuat-2026-09-15.xlsx`).

3 tab:
- **DE-XUAT** — 7.414 dòng: Mã cũ · Kho · Loại · Tên/mô tả · **Mã đề xuất đúng quy tắc** · **Mã sửa tối thiểu** ·
  Đổi gì (2 cột) · Lý do/luật · Cần xác minh hiện trường · Nhóm lỗi · Người tạo · Ngày tạo. Ô mã đề xuất tô xanh khi
  khác mã cũ; ô "cần xác minh" tô vàng; mã cũ tô đỏ = trùng 2 kho/khu sai kho; dòng xám = bin ảo hệ thống.
- **TOM-TAT** — số liệu: 5.859 mã đổi nếu áp đúng quy tắc (chủ yếu F0→F1 và tầng 10/20/30/40 → 01…),
  **212 mã đổi theo phương án sửa tối thiểu**, 2.750 mã cần xác minh hiện trường.
- **QUY-TAC** — bảng 3 tài liệu theo 6 đoạn + cột "áp dụng cho kho 170 trong file này".

Luật sinh mã đề xuất (script `.exports/_de-xuat-ma-vi-tri.mjs`):

| Đoạn | Đúng quy tắc | Sửa tối thiểu |
|---|---|---|
| Tầng | mọi mã → `F1` (trệt); trừ PL/TOLL/bin ảo giữ nguyên | về `F0` (3 mã F01/F1 lẻ) |
| Khu | `A6` kho WH "thiết bị vệ sinh" → `A10`; `WC1` → `A10`; A26 cắm cờ; PL/TOLL/NG/CB giữ + ghi phụ lục | như bên |
| Dãy | `5L1/5L2/5L3` → `517/518/519` (kệ sát vách vẫn là mặt sàn 5zz); `A2-PL-nn` → `A2-523-nn` | như bên |
| Tủ | không tự đổi, cắm cờ "đánh số nhảy" (842 mã) | như bên |
| Tầng kệ | `10/20/30/40` → số thứ tự thật: tủ chỉ pallet 10→01…40→04; tủ có 4 tầng tay 01–04 rồi 20/30/40 → 05/06/07 (dựa theo tầng thực có trong từng tủ) | giữ 10–40 |
| Ô | băng chuyền A8 ô 02/03/04 → 01; Double Deep `.01/.02` giữ; ô 3 số PL/TOLL giữ | như bên |
| Trùng 2 kho | không tự chọn kho — cắm cờ 562 mã kệ (A2, A6) + 1.426 mã pallet/bin chức năng | như bên |

Làm lại: `node .exports/_de-xuat-ma-vi-tri.mjs <vitri.json> de-xuat.json` → `python .exports/_dep-de-xuat-xlsx.py de-xuat.json out.xlsx`
→ `node .exports/_nap-xlsx-len-drive.mjs out.xlsx "Tên file"` (tạo Sheet MỚI; muốn ghi đè link cũ thì PATCH upload theo fileId như ghi chú memory).

## 5. Làm lại khi cần

```
node .exports/_tai-tai-lieu-hr.mjs .exports/hr-chapters.json      # quét lại danh mục tài liệu HR (vé "work" trong kho token)
node .exports/_tai-vi-tri-kho170.mjs .exports/vitri-kho170.json     # tải 7.4xx vị trí 2 kho (GET-only)
node .exports/_ra-soat-ma-vi-tri.mjs .exports/vitri-kho170.json .exports/ra-soat.csv
```

Đọc PDF của HR: bản PDF từ PowerPoint bị mất dấu tiếng Việt khi bóc chữ → tải **file .pptx gốc** cùng đường dẫn
`source_file` rồi đọc XML slide (không cần thư viện); PDF dạng ảnh thì render bằng `pdfjs-dist` +
`@napi-rs/canvas` với `disableFontFace: true` (mặc định sẽ mất chữ).
