# Cách cập nhật / tải ảnh tiêu chuẩn planogram tự động (làm ngày 16/09/2026)

*Giải thích gọn, dễ hiểu. Bản kỹ thuật đầy đủ ở `NGHIEN-CUU-TAB-VE-SINH.md` mục 4l. Việc này nằm ở
commit `04e4c17`, file `kiemsoatkho/hasaki-planogram.js`, đã LIVE 16/09 ~14:00 (phiên bản module `?v=20260916a`).*

## Nói ngắn gọn

Tab Planogram trước đây **tải ảnh rất lâu, ảnh nhỏ bị bể, bấm xem ảnh to phải chờ mấy giây**. Ngày
16/09 tôi đổi lại cách trang lấy và hiển thị ảnh tiêu chuẩn của planogram. Kết quả: trang hiện nhanh
gần **gấp 2–3 lần**, ảnh đầu tiên bật lên **dưới 1 giây** (trước là 5,3 giây), mở lại lần sau gần như
**tức thì**, và **không còn ảnh bị vỡ**. Quan trọng: làm được điều này mà **không gọi hệ thống WMS
nhiều hơn — ngược lại còn gọi ÍT đi**.

## Ảnh tiêu chuẩn planogram là gì, lấy từ đâu

Là ảnh mẫu do WMS lưu cho từng vị trí (đường dẫn gốc trên WMS là `.../planogram/standard/...`). Mỗi
ảnh gốc nặng khoảng **0,5 MB**. Trang dashboard chỉ đọc ảnh về để xem, không sửa ảnh.

## Vấn đề trước ngày 16/09 (đo thật)

- Mỗi ảnh phải đi **2 chặng**: trang gọi vào "cổng" WMS (`wms-gw`), cổng lại **đá tiếp** sang kho ảnh
  ngoài (CDN). Chặng thừa này tốn 0,25–1,5 giây mỗi ảnh, và **mỗi ảnh là một lượt gọi vào WMS**.
- Mở một ô là trang **tải hàng chục ảnh gốc cùng lúc**. Trên điện thoại, một pop-up kéo tới 16 MB
  ảnh; máy hết chỗ nên **Chrome bỏ bớt ảnh → ô hiện bị trống/vỡ**.
- Thẻ số liệu (KPI) của trang phải chờ **6,3 giây** mới hiện; ảnh đầu trong pop-up chờ **5,3 giây**.

## Đã làm gì (5 việc)

1. **Lấy ảnh thẳng từ kho ảnh (CDN), bỏ chặng cổng WMS.**
   Vì đo thấy cổng WMS chỉ luôn đá sang kho ảnh với **cùng tên file**, nên trang ghép thẳng địa chỉ
   kho ảnh. Ví như trước phải hỏi tổng đài rồi tổng đài chỉ sang kho, giờ tới thẳng kho. Ảnh về sớm
   hơn một chặng, và **bớt hàng nghìn lượt gọi vào WMS mỗi ngày**. Có **đường lùi**: nếu một ảnh trên
   kho lỗi, trang tự quay lại hỏi cổng WMS đúng một lần — nên WMS có đổi kho ảnh cũng không mất ảnh.

2. **Tự thu ảnh nhỏ + xếp hàng, không tải ồ ạt.**
   Thay vì tải mọi ảnh gốc, trang **chỉ tải 3 ảnh một lúc**, ưu tiên ảnh đang nằm trong tầm nhìn.
   Mỗi ảnh được **thu nhỏ lại còn khoảng 8 KB** (từ 500 KB) để hiện ô xem trước. Nhờ vậy máy không bị
   ngộp, **hết cảnh vỡ ảnh**.

3. **Nhớ ảnh nhỏ trong máy 9 ngày (IndexedDB).**
   Ảnh nhỏ đã thu được **cất ngay trong trình duyệt**. Lần sau mở lại (kể cả tải lại trang, mở tab
   mới) thì ảnh hiện trong **0,14 giây, không cần tải mạng lần nào nữa**. Chỉ cất **ảnh nhỏ, không có
   thông tin cá nhân**.

4. **Bắt đầu tải sớm ngay khi mở trang.**
   Khi trang biết sắp mở tab Planogram, nó **bắt đầu xin dữ liệu và ảnh ngay từ lúc mới nạp**, không
   chờ mọi thứ khác xong. Tiết kiệm khoảng **1 giây**. Đồng thời **để phần AI nặng tải sau cùng**, để
   trang hiện nhanh trước, AI đến sau.

5. **Xem ảnh to (lightbox) mượt hơn.**
   Khi bấm xem ảnh to: hiện **ảnh nhỏ mờ giữ chỗ + vòng xoay chờ** cho tới khi ảnh gốc về, và **nạp
   sẵn trước 1 ảnh kế tiếp** để lướt qua ảnh sau không phải chờ.

## Kết quả (đo thật trước / sau, trên bản LIVE)

| Việc | Trước | Sau |
|------|-------|-----|
| Thẻ số liệu KPI hiện (máy tính) | 6,3 s | 2,55 s |
| Ảnh đầu tiên trong pop-up | 5,3 s | 0,64–1,04 s |
| 4 ảnh bày sẵn | 10,5 s | ~1,1–1,45 s |
| Mở lại ô đã xem (tải lại trang) | tải lại từ đầu | 0,14 s, 0 lượt mạng |
| Xem ảnh to (lightbox) | vài giây | 0,22 s |
| Ảnh bị vỡ trên điện thoại | có (ô trống) | 0 |

## Điều quan trọng: không làm nặng hệ thống

Cải tiến này **không thêm một lượt gọi nào** lên WMS/planogram — trái lại, đi thẳng kho ảnh nên
**bớt đúng 1 lượt gọi WMS cho mỗi ảnh**. Đây là ràng buộc bắt buộc của dự án (nhẹ tải hệ thống công ty).

## Vài điểm nên biết (giới hạn)

- Phần cất ảnh trong máy chỉ giữ **ảnh nhỏ** (không phải ảnh gốc, không kèm dữ liệu cá nhân), tự hết
  hạn sau 9 ngày.
- Nếu WMS đổi địa chỉ kho ảnh, trang vẫn chạy nhờ **đường lùi tự quay về cổng WMS**; chỉ chậm hơn
  đúng những ảnh bị đổi, không mất ảnh.
- Máy/trình duyệt rất cũ (Safari đời cũ không thu ảnh được) thì **tự động rơi về cách cũ** (hiện thẳng
  ảnh gốc) — vẫn xem được, chỉ không nhanh bằng.

## Nằm ở đâu (để tra lại)

- Mã: `hasaki/kiemsoatkho/hasaki-planogram.js` — các hàm `urlAnh` / `urlAnhGw` / `anhLui` (đi thẳng
  CDN + đường lùi), `anhThu` / `anhChay` / hàng đợi ảnh nhỏ, kho `hp-anh` (IndexedDB); và `index.html`
  phần `<head>` (nạp trước, biến `window.__HPT`).
- Tài liệu kỹ thuật đầy đủ + số đo: `hasaki/NGHIEN-CUU-TAB-VE-SINH.md` mục **4l**.
- Bộ đo tốc độ: `hasaki/qc-toc-do-planogram.mjs` và `hasaki/qc-toc-do-anh-planogram.mjs`.
- Commit: `04e4c17` (16/09/2026); phần tài liệu chuyển LIVE ở `88f2d58`.
