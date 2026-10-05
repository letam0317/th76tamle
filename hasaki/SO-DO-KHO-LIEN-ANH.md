# SO-DO-KHO-LIEN-ANH.md — Kho mới LIÊN ANH: số liệu, bằng chứng, cách chạy (05/10/2026)

## 1. Nguồn

- Bản vẽ hoàn công **KT 4-01 "MẶT BẰNG TRỆT" TL 1/200** — Trung tâm nguyên phụ liệu Liên Anh, huyện Dĩ An, Bình Dương
  (Đạt Việt Co. Ltd; KTS-KSXD Võ Trí Anh). Tệp `OneDrive\Desktop\C13-C17_page_3.pdf` là **ảnh quét** (pdf.js bóc được 0 chữ)
  → render 9 792 px bằng pdf.js trong Edge nền, đọc tay chuỗi kích thước ở dải đáy + dải phải.
- Trang mẫu `https://ai-tool.ngrok.app/new-warehouse` ("Kho Liên Anh C15 – cross-belt v18", three.js r128) — khung dựng gốc,
  đã bố trí sorter, soạn IT, kệ selective; đã tải về khi làm (không có trong repo).
- Toạ độ lô đất user gửi: **10,93651928 / 106,75370472**.

## 2. Kiểm chứng kích thước (user yêu cầu "khớp thực tế, chuẩn chỉnh")

| Nguồn | Kết quả | Kết luận |
|---|---|---|
| Chuỗi kích thước bản vẽ | Trục 1→19: 9×6 000 + **320** (khe lún 10/10', cột đôi) + 5 680 + 8×6 000 = **108 000** · Trục M→A: 4×6 000 + 5×6 400 + 4×6 000 = **80 000** (nhịp 24 000 / 32 000 / 24 000) | tự nhất quán |
| Trang mẫu new-warehouse (dựng độc lập) | "108×80 m, nhịp 24–32–24", cột E/J bước 6 m, mái 7,3 / 11,9 / 15 | khớp |
| Ảnh vệ tinh Esri World Imagery z19 tại toạ độ lô (khoanh mái tự động + hộp xoay nhỏ nhất) | mái chính trùng khung 108×80; đo 115 × 83 m = 108×80 + mái đua ~1 m/bên + **mái phụ đông ~6 m**; trục dài nghiêng ≈ 65° so với Bắc | thực địa khớp ±1 m |
| Tỉ lệ in bản scan | bong bóng 1→19 = 522 mm giấy ≈ 104,5 m ở 1/200 (−3 %) | **không đo trên ảnh scan**, chỉ dùng số ghi |
| Hồ sơ NCC kệ kho 170 (`SO-DO-KHO-170.md` §13) | pallet 1,0×1,2 · bay 2,39–2,48 · cặp selective 2 300 · lối 2 900–3 000 | số kệ trang mẫu (2,4 · 2,3 · 3,0) đúng chuẩn NCC |

Nhãn hàng trục thứ 3 từ trên bản vẽ in là "19" (giữa L và K) — lỗi in; giữ đúng chữ bản vẽ trong `lienanh-thongso.js`.

## 3. Hệ toạ độ

x = 0 ở trục 1 (trái tờ vẽ), z = 0 ở trục M (trên tờ vẽ), y lên. Trang mẫu dùng z = A→M (hệ tay trái so với three.js) nên
nhìn từ trên bị soi gương; dữ liệu mẫu đổi một lần `z' = 80 − z`. Hàng cột giữa: J ở z 24, E ở z 56. Cột trên tường bao ở
mọi trục; cột trong nhà chỉ ở hàng J và E (như bản vẽ và trang mẫu).

## 4. Tệp

| Tệp | Vai trò | Git |
|---|---|---|
| `kiemsoatkho/lienanh-3d.html` | trang công cụ (3D three.js r128 + bộ sửa 2 bước + bảng + xuất) — không chứa bố cục | tracked |
| `kiemsoatkho/lienanh-thongso.js` | chuỗi kích thước + tham số nhà/kệ/sorter/cửa (có cột Nguồn) | tracked |
| `kiemsoatkho/lienanh-luat.js` | bộ luật mặc định L01–L14 | tracked |
| `kiemsoatkho/lienanh-xuat.js` | mô-đun thuần: hình học, diện tích, luật, hình 2D, SVG, DXF, đọc lại DXF | tracked |
| `kiemsoatkho/lienanh-bocuc-goc.js` | bố cục khởi tạo (19 khu, 119 món) | **gitignore** |
| `kiemsoatkho/lienanh-bocuc.js` | bản máy chủ ghi mỗi lần kéo (`{ver, ngay, khu, vat, xoa, luat, chot}`) | **gitignore** |
| `xem-noi-bo.mjs` | API `/api/3d/lienanh/{ping,bocuc,chot}` (đường kho 170 giữ nguyên) | tracked |
| `qc-lienanh-3d.mjs` | bộ đo (Edge nền, kéo thật bằng chuột, chặn ghi) | tracked |
| `kiem-dxf-lienanh.mjs` | kiểm DXF: đọc lại + AutoCAD 2022 nền (DXFIN → AUDIT → đếm → SAVEAS 2018) | tracked |
| `BO-TRI-LIEN-ANH.bat` | mở công cụ | tracked |
| `LIENANH-RULES.md` | sổ luật + giả định | tracked |
| `.exports/lienanh/<mốc>/` | tệp Chốt: SVG · DXF · DWG · PNG · bocuc.json | gitignore |

`deploy-kiemsoatkho.mjs` dùng danh sách tệp tường minh → tệp `lienanh-*` không bao giờ lên GitHub Pages.

## 5. Chạy · kiểm

```
hasaki\BO-TRI-LIEN-ANH.bat                                   # mở công cụ (tắt XEM-BAN-NOI-BO cũ trước nếu đang chạy cổng 8123)
node hasaki/qc-lienanh-3d.mjs [--url http://localhost:8123/kiemsoatkho/lienanh-3d.html]
node hasaki/kiem-dxf-lienanh.mjs <tep.dxf> [--khong-autocad]  # sinh <tep>.dwg + <tep>.autocad.log cạnh tệp
```

Bẫy đã gặp 05/10: (1) DXF thiếu mã 390 ở LAYER → AutoCAD "Error in LAYER Table, drawing discarded"; có 390 mà không có
đối tượng PLACEHOLDER → AUDIT "PlotstyleName Id Invalid" (26 lỗi) ⇒ phải có từ điển ACAD_PLOTSTYLENAME (E) + ACDBPLACEHOLDER (F).
(2) accoreconsole không nhận đường dẫn có dấu cách trong .scr ⇒ chép DXF sang `%TEMP%\kiem-dxf-lienanh`. (3) accoreconsole
treo nếu .scr sai prompt — tool có trần 180 s rồi kill. (4) Bộ đo phải CHẶN fetch bocuc/chot trước khi kéo, không thì mỗi
cú kéo thử ghi đè `lienanh-bocuc.js` thật (đã xảy ra một lần khi thử tay, phải xoá tệp).

## 5b. Kết quả kiểm 05/10/2026 (bản nội bộ, cổng thử 8124)

- `qc-lienanh-3d.mjs`: **43/43 đạt** (kéo khu thật → 9 món con dời đúng Δ · nới/thu/thu vừa khít · bước 2 kéo món, chặn ra ngoài
  biên · R/Ctrl+D/Delete/Ctrl+Z · tay nắm dãy kệ bớt bay · L01/L06 bắt lỗi cố ý · Chốt tắt khi còn lỗi · SVG/DXF/PNG · trạm sorter
  · điện thoại 390 px không tràn ngang, nút ≥ 40 px · console sạch). Lỗi thật bộ đo bắt được rồi sửa: bấm đúng tâm xe nâng tay
  không chọn được (hộp bắt chọn vô hình), nhả chuột ngoài canvas làm món dính con trỏ (setPointerCapture ngay khi bấm).
- `kiem-dxf-lienanh.mjs`: **13/13 đạt** — AutoCAD 2022 nền DXFIN được, AUDIT 0 lỗi, đếm 19 khu/38 chữ khớp, lưu DWG 2018 46 KB.
- `qc-kho170-3d.mjs` trên máy chủ đã sửa: **100/100** = baseline trước khi sửa (kho 170 không ảnh hưởng).

## 6. Quyết định user 05/10/2026

Chỉ nội bộ máy này · 3D như kho 170, kéo khi nhìn thẳng từ trên · khu vực là MODULE cha (dời/nới/thu, đồ bên trong đi theo),
bố trí khu trước rồi chi tiết · bổ sung văn phòng, bàn quản lý, locker, bàn bảo vệ, trữ xe nâng tay + xe sắt 2 tầng, VPP,
giấy tái chế, bóng vụn; phòng ăn ngoài kho · giữ sorter · soạn IT · kệ selective của trang mẫu.
