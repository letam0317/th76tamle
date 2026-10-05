# Gom tin ca đêm từ nhóm Facebook — hướng dẫn cài

## Cách nó chạy (và không chạy)

| Có | Không |
|---|---|
| Dùng đúng phiên Facebook bạn đã đăng nhập sẵn trong Edge | Không đăng nhập hộ, không giữ mật khẩu, không đụng cookie |
| Mở nhóm ở **tab nền** rồi tự đóng | Không nhảy tab, không cướp con trỏ, không đổi trang bạn đang xem |
| Chỉ **đọc** bài đang hiển thị | Không thích, không bình luận, không đăng, không xin vào nhóm |
| Cuộn 4 nhịp, mỗi nhịp nghỉ 2,5 giây; mỗi nhóm cách nhau 1 phút; mặc định 3 tiếng một lượt | Không quét liên tục, không tải hàng loạt |

Nói thẳng phần rủi ro: Facebook **cấm thu thập dữ liệu tự động**. Cách làm ở đây ở mức nhẹ nhất
(đọc nhóm bạn đã tham gia, nhịp thưa, không thao tác gì khác) nên khả năng bị hỏi lại mật khẩu là
thấp, nhưng không phải bằng không. Muốn chắc chắn thì **tắt chạy tự động** và chỉ bấm
"Chạy thử ngay" khi bạn đang ngồi trước máy.

## Cài (5 phút, làm một lần)

1. **Lấy khoá**: mở bảng tính → menu **Việc ca đêm → Khoá cho tiện ích Facebook** → chép chuỗi hiện ra.
2. **Cài tiện ích vào Edge**:
   - Gõ `edge://extensions` vào thanh địa chỉ.
   - Bật **Chế độ nhà phát triển** (góc trái dưới).
   - Bấm **Tải tiện ích đã giải nén** → chọn thư mục
     `C:\Users\lechitam\New folder\viec-lam-ca-dem\tien-ich-fb`
3. **Nối với bảng tính**: ở dòng tiện ích vừa cài bấm **Chi tiết → Tuỳ chọn tiện ích**, mục *1. Nối với bảng tính*:
   - *Địa chỉ nhận bài*:
     `https://script.google.com/macros/s/AKfycbyJMoDETaBKrmEk75jr20R8GomOUXkyVNdd0ia-qc9Sy9JC_BfrTPLPHCpyi8TgcqvF/exec`
   - *Khoá*: chuỗi lấy ở bước 1.
4. **Lấy nhóm — không phải chép tay link nào**. Mục *2. Chọn nhóm* có hai nút:
   - **Lấy danh sách nhóm của tôi**: mở trang "Nhóm của bạn" ở tab nền, lấy về mọi nhóm bạn đã tham gia.
   - **Tìm nhóm công khai theo từ khoá**: tìm cả nhóm bạn CHƯA tham gia. Từ khoá mặc định đã đặt
     sẵn theo hướng bạn cần — buồng phòng, housekeeping, nhà hàng, khách sạn, ca đêm, bảo vệ đêm;
     sửa/thêm thoải mái, mỗi dòng một từ khoá. Mỗi từ khoá cách nhau 20 giây.
   Danh sách hiện ra có nhãn **ưu tiên** (buồng phòng / nhà hàng / khách sạn / lễ tân / bếp / tạp vụ),
   **đã tham gia** hay **tìm thấy**, và nhóm ưu tiên luôn nằm trên đầu.
   - **Tick nhóm buồng phòng / nhà hàng / khách sạn** — chọn nhanh đúng nhóm bạn muốn.
   - **Tick mọi nhóm việc làm** — rộng hơn, gồm cả nhóm việc làm chung.
   - Nhóm nào không có trong danh sách thì dán link vào ô **Thêm tay**.
5. Bấm **Lưu**, rồi **Chạy thử ngay** và xem Nhật ký. Đúng thì thấy dòng kiểu
   `nhóm 1: đọc được 18 bài`.
6. Muốn chạy đều thì tick **Bật chạy tự động** rồi Lưu.

## Nhóm công khai và nhóm riêng tư khác nhau chỗ nào

- **Nhóm công khai**: đọc được bài **không cần tham gia**. Đây là lý do nút tìm nhóm có ích.
- **Nhóm riêng tư**: chưa tham gia thì Facebook chỉ cho thấy tên nhóm, không cho xem bài —
  tiện ích sẽ đọc ra 0 bài. Sau **3 lượt liền đọc hụt**, nhóm đó bị **tự bỏ qua** để không ăn mất
  lượt của các nhóm đọc được; trong danh sách nó hiện nhãn *đang bỏ qua*.
  Xin vào nhóm rồi thì bấm **Bật lại nhóm bị bỏ qua** để đọc tiếp.

## Chạy nhanh tới mức nào — và giá phải trả

Các nhóm được mở trong **một cửa sổ riêng, thu nhỏ sẵn, không lấy tiêu điểm**; xong thì đóng cả
cửa sổ. Cửa sổ bạn đang làm việc không bị đụng.

Ô **Mở cùng lúc mấy nhóm (1-20)** quyết định tốc độ:

| Đặt | 10 nhóm mất khoảng | Đánh đổi |
|---|---|---|
| 2 (mặc định) | ~2 phút | nhẹ máy, nhịp giống người đọc |
| 6 | ~40 giây | cân bằng — mức tôi khuyên dùng |
| 20 | ~20 giây | ăn khoảng 6 GB RAM, bật một loạt lượt tải trong vài giây: **nhanh nhất nhưng dễ bị Facebook hỏi lại mật khẩu nhất** |

Hai chốt chặn đã cài sẵn: tab mở **lệch nhau 0,6 giây** chứ không bật cùng lúc, và tab được đánh dấu
**không cho trình duyệt xả** giữa chừng (mở nhiều tab thì Edge hay tự xả tab nền để lấy RAM, xả giữa
chừng là mất trắng công tải). Trần cứng là 20 — gõ 200 thì vẫn chỉ chạy 20.

Vẫn giữ **xoay vòng**: chọn 200 nhóm không có nghĩa mỗi lượt đọc 200. Mỗi lượt chỉ đọc
`Số nhóm mỗi lượt` rồi lượt sau đọc tiếp nhóm kế; dòng chữ dưới ô cài đặt tính sẵn số phút mỗi lượt
và số lượt để đi hết một vòng.

## Trang tuyển dụng công ty — cũng do tiện ích đọc (15/09/2026)

Phần lớn web tuyển dụng của công ty (Kingfoodmart, AEON…) là **web chạy JavaScript**: máy chủ
Google tải về chỉ được cái vỏ, không có việc nào (Kingfoodmart: 8,6 KB, 121 chữ). Chỉ trình duyệt
thật mới thấy nội dung — nên phần này giao cho tiện ích.

Cách chạy: tiện ích lấy danh sách link ở tab **NGUỒN CÔNG TY** của bảng tính (đã gieo sẵn TGDĐ,
Kingfoodmart, WinMart, Circle K — bạn dán thêm link **trang danh sách việc** của công ty khác vào
cột A), mở từng trang, gom link từng việc, mở những việc **chưa từng đọc** (nhớ 30 ngày), lấy nguyên
văn gửi về. Bảng tính tự lọc: ca nằm trong **19h → 8h sáng**, không telesale. Việc có ca đêm nhưng
ghi "xoay ca / luân ca / tối đa N ca đêm" vẫn lên bảng, kèm nhãn **Tham khảo (xoay ca, không phải
ca đêm cố định)**.

Nhật ký ghi kiểu `web kingfoodmart.com: thấy 23 link việc, mở 10 việc chưa đọc, gửi 4 (mới 4)`.

## Công ty web chết / không vào được — không loại, đi ba đường khác (15/09/2026)

Tab **NGUỒN CÔNG TY** trong bảng tính (gieo sẵn 20 công ty: Highlands, Phúc Long, GS25, 7-Eleven,
Grab, GHN, J&T, Pharmacity, Lotte Mart, Vinpearl, CGV…). Với mỗi tên:

1. **Cò tự tìm theo tên** trên vieclam24h, careerviet, hoteljob — chạy ở máy chủ Google, không dính
   JavaScript. Xoay vòng 5 tên mỗi lượt. Tin tìm được gắn nhãn `Theo dõi: <tên công ty>`.
2. **Facebook page** ở cột B — tiện ích đọc bài trên page như đọc nhóm (page công khai, không cần
   theo dõi). Tên page là đoán theo tên thường dùng; **sai thì đọc ra 0 bài và tự bỏ qua sau 3 lượt**.
3. Với trang ở tab NGUỒN CÔNG TY mà mở lên **không thấy việc nào** (trang chủ, hoặc địa chỉ tuyển dụng
   đã đổi), tiện ích **tự dò nút "Tuyển dụng / Cơ hội nghề nghiệp / Careers"** và đi theo một bước.
   Nhật ký ghi `web …: trang gốc không có việc, đi theo nút Tuyển dụng → …`.

Thêm công ty mới: gõ tên vào cột A tab NGUỒN CÔNG TY là đủ; có page Facebook thì dán cột B.

## Bài về tới bảng tính thì nằm đâu

- Bài thô vào tab **BÀI FACEBOOK** (giữ 45 ngày, trùng thì bỏ).
- Lượt **Cào ngay** kế tiếp sẽ nhặt các bài đó, lọc ca đêm bằng đúng luật như các nguồn khác
  (từ khoá trong tiêu đề → giờ ca → từ khoá trong thân bài), đoán mức lương và địa chỉ
  trong bài, rồi ghép vào bảng chính với cột Nguồn ghi `facebook`.
- Bài không phải ca đêm hoặc không ở TP.HCM và vùng giáp ranh sẽ bị bỏ, không lên bảng.

## Khi nào phải làm lại

- **Facebook đổi giao diện** → tiện ích đọc được ít bài hoặc không bài nào. Cách nhận biết:
  Nhật ký ghi `đọc được 0 bài` nhiều lượt liền. Lúc đó báo tôi sửa lại phần đọc trang.
- **Đổi mã trong Apps Script** thì phải đẩy bản mới cho cửa nhận bài:
  ```bash
  cd "C:\Users\lechitam\New folder\viec-lam-ca-dem"
  node qc-cao.mjs
  npx --yes @google/clasp push --force
  npx --yes @google/clasp create-version "mô tả"
  npx --yes @google/clasp update-deployment -V <số version> AKfycbyJMoDETaBKrmEk75jr20R8GomOUXkyVNdd0ia-qc9Sy9JC_BfrTPLPHCpyi8TgcqvF
  ```
  (Bỏ bước version/deployment thì menu trong bảng tính vẫn chạy bản mới, nhưng **cửa nhận bài
  của tiện ích vẫn là bản cũ** — bẫy này dễ quên.)

## Đổi khoá khi cần

Khoá nằm trong Script Properties của dự án Apps Script, không nằm trong mã nguồn. Muốn đổi:
xoá thuộc tính `KHOA_FB` trong trình soạn thảo (Cài đặt dự án → Thuộc tính tập lệnh), rồi bấm lại
menu **Khoá cho tiện ích Facebook** để sinh khoá mới và dán lại vào tiện ích.
