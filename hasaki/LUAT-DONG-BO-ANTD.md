# Bộ luật đồng bộ giao diện Ant Design (khuôn mẫu: mục Xác minh)

Chốt ngày 13/10/2026. Người dùng yêu cầu: «Hạng mục 5S / Tồn kho / Xác minh cần đồng bộ thiết kế, màu sắc theo tab Xác minh — Ant Design… sau khi QC kỹ thì tạo 1 bộ luật để tiếp tục chuyển đổi với dự án Audit Factory».

- **Đã áp xong:** dashboard Audit Hasaki (`kiemsoatkho/`). Đo ngày 13/10: **0 lỗi trên 10 màn × 2 cỡ màn (1440 / 390) + 3 pop-up**.
- **Việc kế tiếp:** Audit Factory (`factory/`). Đo gốc ngày 13/10: **101 lỗi trên 8 tab**. Xem mục 4.
- **Bộ đo:** `node hasaki/qc-dong-bo-antd.mjs` (mục 3). Luật nào cũng có mã, bộ đo báo đúng mã đó.

---

## 1. Mười luật (mã trùng với bộ đo)

| Mã | Luật | Vì sao |
|---|---|---|
| AD-01 | **Không viền nhấn màu ở một cạnh.** Cấm `border-left` / `border-top` dày từ 2px, và cấm vạch `box-shadow: inset 3px 0`. Viền thẻ chỉ 1px màu `--ad-chia`. Màu nhóm, nếu cần, đặt vào **con số**. | Ant Design không có kiểu thẻ này. Xác minh không dùng. Mắt đọc vạch màu như một cảnh báo. |
| AD-02 | **Không viết IN HOA bằng CSS** (`text-transform: uppercase`). Chữ in hoa viết cứng trong JS cũng phải sửa ở **chuỗi nguồn**. | Ant Design không in hoa nhãn. Ngoại lệ là **dữ liệu** vốn in hoa: mã trạng thái WMS `APPROVED`, tên kho `WH - 170 QUOC LO 1A`. |
| AD-03 | **Bo góc theo bậc cố định:** thẻ, khung, khối con trong pop-up = **8px** · nút, ô nhập = **6px** · nhãn (Tag), chip lọc = **4px** · đầu pop-up = `8px 8px 0 0`. Cấm bo viên thuốc (999px). Được phép: hình tròn thật (rộng = cao, như avatar, chấm, nút «i») và thanh tiến độ. | Bộ token antd. Trước đây có 10 / 12 / 14 / 20 / 999px, mỗi mục một kiểu. |
| AD-04 | **Không nền chuyển sắc** (gradient). Được phép: vòng tiến độ (conic), vạch tiến độ, khung xương lúc đang tải (skeleton). | Token antd cấm gradient và nền kính mờ. |
| AD-05 | **Tiêu đề trong tab không lặp tên đã có ở đường dẫn đầu trang** (`#adCrumb`). | Luật không lặp thông tin. Ví dụ Xác minh từng có tiêu đề «Theo tác vụ» ngay dưới đường dẫn «Xác minh / Theo tác vụ». |
| AD-06 | **Độ đậm chỉ 400 hoặc 600.** Chữ thân, nhãn, `<b>`, nút đều tối đa 600. Nút, Tag dùng 400; nút chính và tiêu đề dùng 600. Số liệu lớn (từ 20px) được miễn. | Antd chỉ có 2 độ đậm. Trước đây có 650 / 700 / 800 lẫn lộn. |
| AD-07 | **Không dòng mô tả dưới tiêu đề.** Không đặt chữ thuần từ 20 ký tự trở lên ngay sau h2/h3. Số đếm đã có ở thanh bên và bộ lọc. | Luật 7 của dự án. Người dùng đã gắt vì lỗi này lặp lại («101 phiếu WF591 đang mở…»). |
| AD-08 | **Nút đầu trang:** «+ Ghi nhận 5S» **chỉ ở Tổng quan**. Mục Xác minh có «Đăng xuất» **ở đúng chỗ đó**. Bộ đo chỉ kiểm luật này trên trang 5S. | Người dùng chốt 13/10. |
| AD-09 | Cỡ chữ trong bộ antd 12/14/16/20/24/30/38. **Hiện chỉ thống kê, chưa tính lỗi**: bảng dày dùng 12,5–13px có chủ đích. | Mốc để siết dần, không ép một lần. |
| AD-10 | **Không chữ dạy thao tác** trên màn: «chạm để mở», «bấm để xem», «(Nhấn để mở rộng)»… Mũi tên ▾/▴ hoặc nút «i» là đủ. Chữ chỉ được nằm trong `title`. | Luật 7. Ví dụ «Bộ lọc — chạm để mở» → «Bộ lọc ▾». |

Các luật cũ **vẫn giữ nguyên hiệu lực**:
- 9 luật hiển thị điện thoại: `table.mbcard`, vùng chạm ≥40px, sàn chữ 10,5px, kẹp dòng…
- Luật không lặp thông tin, tính đồng bộ (dùng `popIn`, combo, focus ring sẵn có), cấm emoji.
- Khi luật dự án và antd đá nhau, **luật dự án thắng**. Ví dụ: antd cho nút cao 32px, nhưng trên điện thoại vẫn phải ≥40px.

## 2. Khuôn mẫu lấy từ mục Xác minh

- **Khung lọc** `.filters`: nền trắng, viền 1px, bo 8px. Nhãn nhỏ màu `--muted` đặt **trên** ô nhập. Ô chọn dùng `enhanceSelect`. Ô tìm nằm **trong** khung lọc, không đứng trần (tab Quy định đã sửa theo).
- **Bảng** `.panel` + `.panel-head`:
  - Đầu khung: tiêu đề 16/600 bên trái. Bên phải **chỉ** ghi phân trang «1–30 / 102» khi có trang sau, không lặp số đã có ở thanh bên.
  - Đầu bảng nền `--ad-nen2`.
  - Bề rộng cột khoá theo **class** (`c-o`, `c-loi`…), không khoá theo thứ tự cột.
  - Hàng cao cố định: dùng `khoaHang()` bọc ô vào `.hx-o`, đặt `max-height`. Bảng dày chữ thì kẹp 2–3 dòng, nguyên văn để trong `title`.
- **Tag** `.hx-tag`: chữ 12/20, đậm 400, bo 4px, viền mảnh. Màu theo trạng thái: `good` / `warn` / `bad` / `info`, lấy từ biến theme qua `color-mix`.
- **Nút:** nút chính nền `--accent`, bo 6px, chữ 600. Nút phụ viền 1px, nền `--surface`, chữ 400.
- **Pop-up:**
  - Đầu hộp: tiêu đề 2 dòng (tên trên, ngày giờ dưới). Liên kết ra ngoài («Mở task ↗») đứng **cạnh trái nút Đóng**.
  - Thân hộp lề 24px (điện thoại 16px).
  - Thanh nguồn (clip / ảnh) chốt ở mép phải, ngay trên khung xem.
- **Màu:** chỉ dùng biến theme: `--accent` `--good` `--warn` `--bad` `--info` `--muted` `--ad-chia` `--ad-nen2` `--ad-chon`.
  - Ngoại lệ có lý do: nhãn nổi «Không qua hệ thống» dùng `#d46b08` (antd orange-7). Lý do: `--warn` ở theme tối là vàng nhạt, chữ trắng trên đó không đọc được.

## 3. Bộ đo `qc-dong-bo-antd.mjs`

```
node hasaki/qc-dong-bo-antd.mjs                    # 5S, màn 1440, mọi tab + 3 mục con Xác minh + pop-up chính
node hasaki/qc-dong-bo-antd.mjs --w=390            # màn điện thoại
node hasaki/qc-dong-bo-antd.mjs --trang=factory    # Audit Factory
node hasaki/qc-dong-bo-antd.mjs --chi=kk,htonbat --du=1 --anh=<thư mục>   # vài tab, in hết lỗi, chụp ảnh
```

- Bộ đo chạy trên **bản nội bộ** `localhost:8123`. Nó tự cấp phiên Xác minh và **chặn mọi lượt ghi** ở tầng mạng.
- Bộ đo dò theo **kiểu hiển thị thật** (computed style), không theo danh sách class. Vì vậy tab mới hay dashboard mới chạy được ngay, không phải viết thêm ca.
- **Miễn trừ phải khai rõ.** Đặt `data-ad-mien` trên phần tử, hoặc thêm vào hàm `mien()` kèm lý do. Đang miễn: `svg`, `canvas`, `video`, sơ đồ kho (`.hp-map` / `.pg-map`…), trục thời gian clip `.hx-tl`.
- **Phạm vi lời hứa = danh sách màn của bộ đo.**
  - Pop-up hiện đo: chi tiết Vi phạm, Quyết định (Theo tác vụ), Lượt camera (Theo máy).
  - Pop-up chưa nằm trong danh sách đo thì **chưa** được tính là đạt.

## 4. Chuyển đổi Audit Factory — làm theo thứ tự

Đo gốc ngày 13/10 (`--trang=factory`): **101 lỗi**.

| Tab | Số lỗi |
|---|---|
| Tổng quan | 1 |
| Trạng thái lưu trữ | 21 |
| Kiểm kê | 6 |
| Bất thường | 11 |
| Planogram | 25 |
| Nhận diện SKU | 15 |
| Chuyển đổi cân | 16 |
| Tem | 6 |

Chia theo mã: AD-03 ×47 · AD-06 ×30 · AD-04 ×12 · AD-01 ×5 · AD-02 ×4 · AD-07 ×3.

Lỗi đã biết:
- Gradient trên thẻ `.card.c1–c5` và `.nds-tools`.
- Nút «i» `.h2tip` bo viên thuốc.
- Chip `.kktab` bo 999px.
- Mô tả dưới tiêu đề ở `.abnchart`.

Các bước:
1. **Đo gốc:** chạy `node qc-dong-bo-antd.mjs --trang=factory --du=1 --anh=…` và lưu kết quả để đối chứng.
2. **Sửa ở MỘT chỗ.** Thêm khối «ĐỒNG BỘ THEO KHUÔN XÁC MINH» vào `factory/giaodien-antd.js` (bản chép của lớp dùng chung).
   - Tiền tố `html.ad body`, thêm `!important` ở thuộc tính đang tranh chấp, giống khối trong `kiemsoatkho/hasaki-giaodien-antd.js`.
   - Class khác nhau giữa 2 dự án, nên **phải đọc danh sách lỗi từng tab**, không chép mù.
   - Phần dùng chung, như thẻ Tổng quan `.ov-card` / `.hm-card` và viên Cập nhật `.cn`, thì sửa ở `kiemsoatkho` rồi `cp` sang Factory, đồng thời tăng `?v=` ở cả 2 trang.
3. **Sửa chuỗi nguồn** cho AD-02 (in hoa viết cứng), AD-07 và AD-10 (chữ giải thích, chữ dạy thao tác). CSS không sửa được những chỗ này.
4. **Pop-up Factory** (`#prmodal`, `#tvtmodal`, `#abnmodal`, `#kkmodal`, 4 pop-up planogram) chưa có trong bộ đo. Phải **thêm vào danh sách pop-up của bộ đo trước khi nói đạt**.
5. **Chạy lại đủ 4 bộ đo:**
   - `qc-dong-bo-antd --trang=factory` ở cả 1440 và 390
   - `qc-mobile-toan-du-an --file --trang=factory`
   - `qc-chu-thich`
   - Chụp ảnh từng tab và **soi bằng mắt**: bộ đo không thấy lệch màu hay lệch nhịp.
6. Dựng bản nội bộ cho người dùng duyệt **rồi mới đẩy**: `git push` cho repo factory. Kiểm dấu vết bằng sha256 sau `tr -d '\r'`, vì đẩy lên sẽ đổi CRLF thành LF.

## 5. Bẫy đã dính khi làm bản Hasaki

- **CSS module nạp SAU lớp antd và viết theo `#pane-…`** (độ ưu tiên cấp ID). Luật đồng bộ phải là `html.ad body #pane-x .cls` hoặc dùng `!important`, không thì lặng lẽ thua.
- **Bộ chọn tên lớp chung** như `.l`, `.t`, `.go`, `.st` mà áp toàn trang sẽ làm đậm cả chữ thường ở mục khác. Phải bó vào đúng `#pane-…` và thẻ cha.
- **Ảnh dải 72 giờ đã in sẵn nhãn giờ trên từng khung.** Dán thêm nhãn lên là lặp, và che mất nhãn gốc.
- **Vạch nhấn trái làm bằng `box-shadow: inset`** không có `border-left`, nên bản đầu của bộ đo không thấy. Bộ đo nay đã đo cả kiểu này.
- **Lỗi 404 trong bộ đo điện thoại** không kèm địa chỉ suốt nhiều lượt. Bộ đo nay ghi thẳng URL hỏng. Hai nguồn đã tìm ra:
  - Ảnh nhỏ `thu/*.webp` chỉ có trên link thật. Bản nội bộ nay chuyển hướng sang link thật.
  - 3 ảnh trên `cdn-media-wms.inshasaki.com` đã bị xoá phía WMS. Đây là lỗi **dữ liệu nguồn**, không phải lỗi giao diện.
