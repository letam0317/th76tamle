# LIENANH-RULES.md — Sổ luật công cụ bố trí kho Liên Anh (05/10/2026)

> Tệp này được commit (chỉ chứa LUẬT + GIẢ ĐỊNH, **không chứa toạ độ bố cục**). Bố cục nằm ở
> `kiemsoatkho/lienanh-bocuc-goc.js` (khởi tạo) và `kiemsoatkho/lienanh-bocuc.js` (máy chủ ghi) — cả hai gitignore vì repo public.
> Giá trị luật MẶC ĐỊNH ở `kiemsoatkho/lienanh-luat.js`; sửa trên trang (mục "Luật khoảng cách") thì bản sửa lưu cùng bố cục.

## 1. Cách công cụ làm việc (cho người không chuyên)

- Mở `hasaki\BO-TRI-LIEN-ANH.bat` → trình duyệt mở `http://localhost:8123/kiemsoatkho/lienanh-3d.html`. Chỉ máy này ghi được;
  điện thoại cùng Wi-Fi xem được nhưng không lưu.
- **Mở lần đầu: mặt bằng TRỐNG** (chỉ có cửa, dock, xe tải gắn tường). Mọi khối khu vực nằm trong **khay** ở bảng bên phải
  (tên · kích thước · m² · số món bên trong). Kéo một dòng của khay thả xuống mặt bằng là khối hiện ra đúng chỗ thả cùng đồ
  bên trong; hoặc bấm **Đặt** (đặt giữa màn hình). "Xếp theo bản mẫu" đặt cả bộ theo trang mẫu; "Cất hết vào khay" dọn trống.
  Khối đã đặt có nút **Cất vào khay** trong bảng thuộc tính.
- **Bước 1 · Khu vực**: bấm vào vùng vàng để chọn khu, kéo đi — mọi đồ bên trong đi theo. Đang kéo mà **đè lên khu khác thì
  khung đỏ + dòng "ĐÈ LÊN: …"** ngay lúc kéo (giống chế độ sửa kho 170); thả xong luật L11/DE giữ khung đỏ cho tới khi dời ra.
  Khu trong nhà không kéo ra ngoài tường bao được. Kéo 8 chấm cam để nới/thu. "Thu vừa khít" co khu ôm sát đồ bên trong
  (lề 0,5 m). Xoay 90° xoay cả khu lẫn đồ bên trong.
- **Bước 2 · Chi tiết trong khu**: chọn khu → "Vào khu" → kéo từng món; món bị giữ trong biên khu (giữ Alt để thả tự do).
  Dãy kệ: kéo 2 chấm xanh ở đầu dãy để thêm/bớt bay (bước 2,4 m).
- Mỗi thay đổi **tự lưu** và **tự kiểm luật**: khung đỏ = LỖI (chặn Chốt), khung cam = cảnh báo. Bấm dòng lỗi để bay tới.
- Nút **Chốt**: chỉ bấm được khi 0 lỗi → lưu bản chốt + xuất SVG/DXF/PNG vào `.exports/lienanh/<mốc>/` → chạy bộ đo
  `qc-lienanh-3d.mjs` → mở DXF bằng AutoCAD thật (`kiem-dxf-lienanh.mjs`: AUDIT + lưu DWG 2018). Không đẩy lên Internet.
- Tải tệp ngay không cần Chốt: SVG 2D · DXF (AutoCAD, mm) · PNG · In PDF (A3 ngang).

## 2. Hệ toạ độ · kích thước (đã kiểm chứng, xem `SO-DO-KHO-LIEN-ANH.md` §2)

- x = 0 ở trục 1 (mép trái tờ vẽ) → 108 m ở trục 19. z = 0 ở trục M (mép trên) → 80 m ở trục A (mép dưới).
  Nhìn thẳng từ trên trong công cụ = đúng tờ bản vẽ; SVG/PNG/DXF cùng hướng. DXF: X = x·1000, Y = (80 − z)·1000 (mm, Y lên).
- Khổ nhà = chuỗi kích thước bản vẽ, máy tự cộng; lệch tổng là trang báo đỏ không dựng (chống gõ nhầm).

## 3. Bộ luật khoảng cách

| Mã | Luật | Tối thiểu | Mức | Căn cứ | Verify |
|---|---|---|---|---|---|
| DE | Hai món đè nhau (mọi món trong nhà; vách ↔ cửa trong vách bỏ qua) | 0 | lỗi | hình học | ✓ |
| L01 | Lối xe nâng giữa 2 dãy kệ song song (chồng hình chiếu ≥ 1 bay) | **3,0 m** (khe lưng 0,15–0,5 chỉ hợp lệ khi cả hai là kệ đơn) | lỗi | trang mẫu new-warehouse "lối 3,0 m xe nâng đứng lái"; NCC Thăng Long 2 900 | ✓ |
| L02 | Khe đầu dãy ↔ đầu dãy cùng hàng | ≤ 0,1 (nối liền) hoặc ≥ 3,0 (lối cắt) | cảnh báo | trang mẫu "lối cắt 3 m" | ✓ |
| L03 | Kệ cách tường bao (kệ đơn được dán tường ≤ 0,05) | 0,5 m | lỗi | thông lệ | CHƯA |
| L04 | Không đè cột nhà; dãy kệ cách cột ≥ 0,1 | 0 / 0,1 | lỗi | hình học | ✓ |
| L05 | Lối người giữa 2 đồ rời có người đi quanh (bàn, tủ, kệ nhẹ, quầy…) chồng hình chiếu ≥ 0,6; ghép khít ≤ 0,012 được phép; đồ XẾP HÀNG (pallet, xe, bao, lồng, ghế, tủ sạc, ô đỗ) miễn | 1,2 m | cảnh báo | QCVN 06:2022 lối thoát nạn 1,0–1,2 | CHƯA |
| L06 | Dải trước cửa trống: cửa xe (xuat/dock) sâu 3,0; cửa người (thoat) 1,5; cửa `nap` miễn (xe nạp đậu ngay cửa) | 3,0 / 1,5 | lỗi | PCCC / xe ra vào | CHƯA |
| L07 | Sorter cách dãy kệ | 2,0 m | lỗi | trang mẫu AISLE 2,0 | ✓ |
| L08 | Sorter cách cột TRONG nhà (E/J) | 0,5 m | cảnh báo | trang mẫu (máy cách cột 2,3); trạm người xếp → pallet ngoài sát cột | ✓ |
| L09 | Tủ sạc / ô đỗ xe nâng cách kệ và khu dễ cháy | 1,5 m | lỗi | NFPA 505 / OSHA 1910.178 không nêu số | CHƯA |
| L10 | Khu giấy tái chế / bóng vụn (nhom `chay`) cách tủ sạc, tủ điện | 3,0 m | lỗi | — | CHƯA |
| L11 | Khu không chồng khu (trừ khu ngoài nhà); vật phải nằm trong khu của nó (sorter được thò line #5 sang khu kề) | 0 | lỗi / cảnh báo | nghiệp vụ | ✓ |
| L12 | Vật nằm trong nhà 0…108 × 0…80 (trừ khu ngoài, dock, xe tải, cửa) | 0 | lỗi | hình học | ✓ |
| L13 | Dải xe dock (17 m ngoài tường) không chồng khu ngoài nhà | 0 | lỗi | nghiệp vụ | ✓ |
| L14 | Khu staging phải có ≥ 1 cửa xuất trên cạnh | — | cảnh báo | nghiệp vụ | ✓ |

**Thuật toán** (`lienanh-xuat.js` → `kiemLuat`): mỗi món = hộp chiếm sàn sau khi xoay (`vetVat`); sorter = 2 hộp con (khối chính
ring + line nạp + máng/lồng + lối kéo lồng; dải line #5 mảnh ±1,6 m) để line #5 không biến cả vùng đông ring thành "sorter";
`khe` theo từng trục (âm = chồng); chồng hình chiếu 1 trục thì khoảng cách = khe trục kia. Chạy sau mỗi thay đổi (≈150 món,
tức thì) và khi Chốt. Kết quả xếp LỖI trước, cảnh báo sau.

**Đổi số luật**: mục "Luật khoảng cách" trên trang → gõ số → tự áp. Muốn đổi mặc định cho mọi máy: sửa `lienanh-luat.js`
(giữ `verify: 0` cho số chưa có căn cứ chuẩn).

## 4. GIẢ ĐỊNH trong bố cục khởi tạo (user kéo lại trong công cụ)

- **GIỮ từ trang mẫu** (lật z): staging 2 bên trục 1, sorter cross-belt + 4 line nạp + line #5, lồng rỗng, soạn IT + cross-dock,
  nhận PO + QC + dock cont, tiếp NCC, chờ QC, sạc xe nâng, kệ GĐ1/GĐ2/GĐ3.
- **GĐ1 bớt 1 bay** (10 → 9 bay/dãy = 720 vị trí, −80) để chừa **dải phụ trợ 4 m sát tường trục 19**: văn phòng + 4 bàn quản lý
  + 2 bàn NV + vách kính (z 25–37) · locker (37–41) · kho VPP (41–47) · giấy tái chế (47–51) · bóng vụn (51–55).
  **Phương án B** (chưa dựng): văn phòng ở góc khu Nhận PO x 98–107,5 · z 68–80, giữ đủ 800 vị trí GĐ1.
- **Bàn bảo vệ** trong khu Nhận PO cạnh dock cont (x 86,5 · z 78,5). **Bàn điều hành sorter** trong khu soạn IT (x 65 · z 51,5).
- Vùng "Đậu xe kéo tay" đổi thành **"Trữ xe nâng tay · xe sắt 2 tầng · pallet rỗng"** (10 xe nâng tay, 12 xe sắt, 4 pallet).
- **Phòng ăn ngoài kho** (khu `ngoai`, 12 × 6 m ngoài tường M cạnh cửa thoát x 27) — chỉ tính m², miễn luật.
- Tủ sạc dời khỏi cửa (trang mẫu để tủ sạc đè cửa x 21–25): cửa thoát hiểm chuyển sang x 25–29; 3 ô đỗ xe nâng (tủ 6).
- Khối GĐ2/GĐ3: lối cắt giữa các khối đặt 3,01 m (trang mẫu 2,91 m — dưới chuẩn 3,0 của chính nó).
- Cửa: 3 cửa bản vẽ trục 1 (z ≈ 14 · 40 đập thông 10,5 m · 63); 4 cửa "mới" + cửa tường M là đề xuất (`moi:1`, màu cam).

## 5. CHƯA VERIFY (user xác nhận tại kho)

- Vị trí/độ rộng cửa thật ngoài 3 cửa trục 1; chiều cao mái 7,3 / 11,9 / 15 (trang mẫu); bề dày tường 0,25 (TẠM);
  tiết diện cột 0,45 (TẠM); mái phụ phía đông ~6 m (đo vệ tinh, chỉ vẽ nét mờ).
- Số luật L03, L05, L06, L09, L10.
- Font `arial.ttf` cho chữ Việt trong DXF (đã mở được bằng AutoCAD 2022 nền; chưa soi hiển thị trên giao diện).
