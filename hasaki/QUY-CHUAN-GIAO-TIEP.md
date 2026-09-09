# BỘ QUY CHUẨN GIAO TIẾP — bản nháp v0.1 (07/09/2026) · CHỜ DUYỆT

> Nguồn: rút từ lịch sử trao đổi 07/2026 → 09/2026 (các lần anh chốt / bác / gắt), bộ nhớ dự án,
> nhãn nút + thông báo đang có trong `factory/index.html` và `kiemsoatkho/`, mẫu tin Telegram
> trong `canh-suc-khoe.js` / `tin-nhan-bot.mjs`, lịch sử commit của 2 repo.
> Quan hệ với 2 file kia: `BO-CHUAN-PHAT-TRIEN.md` giữ LUẬT KỸ THUẬT (bảo mật, tải upstream, QC),
> `QUY-CHUAN-THIET-KE.md` giữ HÌNH THỨC (token, khuôn giao diện). File này giữ **CÁCH NÓI**:
> trợ lý nói với anh thế nào, giao diện nói với thủ kho thế nào, máy nhắn cho người thế nào.
> Repo PUBLIC — file này không chứa bí mật.

---

## 0. ĐIỂM CẦN ANH QUYẾT (đánh dấu rồi trả lại, tôi sửa file theo đó)

| # | Vấn đề | Hiện trạng đo được | Đề xuất của tôi |
|---|---|---|---|
| 1 | Chính tả **Xoá / Huỷ** (kiểu cũ) hay **Xóa / Hủy** (kiểu mới) | factory: Xoá 26 · Xóa 5 · Huỷ 3 · Hủy 0; kiemsoatkho: Xoá 2 · Huỷ 2 | Chọn **Xoá / Huỷ** (đa số), quét 5 chỗ lệch |
| 2 | Commit message có dấu hay không dấu | Lịch sử lẫn lộn: "Nhan dien SKU 29/08…" và "auto-export: nguồn JSON board…" | **Có dấu**, viết qua file `git commit -F` để né lỗi mã hoá PowerShell 5.1 |
| 3 | Phân cách nghìn trong UI | `nf()` dùng en-US "10,234" (1 chỗ lẻ dùng vi-VN "10.234") | Giữ **en-US** vì WMS hiển thị kiểu đó, thủ kho đối chiếu không nhầm; báo cáo chữ cho anh thì viết kiểu Việt "10.234" |
| 4 | Ký hiệu đầu tin Telegram | Đang dùng ⛔ ✅ ⚠ | **Giữ** 3 ký hiệu này (đọc nhanh trên điện thoại), không thêm ký hiệu khác |
| 5 | Cập nhật giữa chừng khi việc dài (>10 phút) | Lúc có lúc không | 1 dòng mỗi mốc lớn (đo xong baseline / sửa xong / QC xong), không dán log |

---

## 1. NGUYÊN TẮC CHUNG (áp cho cả 3 tầng bên dưới)

1. **Tiếng Việt có dấu, đúng chính tả.** Không viết tiếng Việt không dấu ở bất kỳ đâu người đọc
   nhìn thấy (trừ tên file `.md` viết HOA-KHÔNG-DẤU theo lệ đang có và lệnh chat `/trangthai`).
2. **Đo được bao nhiêu nói bấy nhiêu.** Mỗi kết luận phải chỉ được ra con số hoặc dấu vết đứng sau
   nó. Chưa đo thì nói "chưa đo", không nói "sạch".
3. **Kết quả trước, lý do sau.** Dòng đầu tiên là thứ người đọc cần quyết; giải thích đứng sau.
4. **Không câu đệm.** Không kể lể việc đã làm, không lặp lại yêu cầu, không chào hỏi, không hứa
   hẹn cuối bài. Anh đã bác thẳng kiểu "báo cáo được nộp tự động cho task abc, xyz" (07/09/2026).
5. **Một ý một câu.** Câu khoảng 20 chữ, có động từ. Không gạch ngang dài, không mở ngoặc dài.
6. **Mọi thứ đo bằng tác dụng với người đứng ở kho**: thủ kho cầm điện thoại, mạng chập chờn,
   đọc trong 3 giây. Câu nào không giúp họ làm gì tiếp thì bỏ.

---

## 2. TRỢ LÝ ↔ ANH (khi đang làm việc trong phiên)

### 2.1 Mở đầu một việc
- Một dòng nói sẽ làm gì, rồi làm. Không hỏi lại khi yêu cầu đủ rõ để hành động
  (anh đã chốt "tự động thao tác code, không cần phải hỏi").
- Chỗ mập mờ → **nêu giả định** trong bài trả lời thay cho câu hỏi. Chỉ dừng lại hỏi khi:
  (a) các cách hiểu dẫn tới sản phẩm khác hẳn nhau, hoặc (b) hành động không đảo được:
  xoá dữ liệu, push/deploy, gửi ra ngoài, chia sẻ file Drive, nộp task thay người.
- Phạm vi: chỉ đọc/sửa trong folder đang trao đổi; cần dữ liệu ngoài phạm vi thì lấy, không hỏi.

### 2.2 Trong khi làm
- Cập nhật ngắn theo mốc (điểm quyết 5). Không dán log, không dán kết quả tool nguyên khối;
  chỉ trích **con số làm thay đổi quyết định**.
- Việc chạy nền thì nói "đang chạy, chưa có kết quả" — không đoán trước kết quả.

### 2.3 Báo cáo kết thúc — khuôn cố định, theo đúng thứ tự
1. **Kết quả**: đạt / không đạt, con số QC (bộ đo nào · bao nhiêu màn × máy · số lỗi · `--file` hay live),
   đã push hay chưa.
2. **Đã làm**: file nào đổi chỗ nào. Tối đa một tên file mỗi câu, hai tên file mỗi đoạn; phần còn lại
   mô tả bằng lời.
3. **Chưa làm / chờ anh**: bản nội bộ ở đâu để anh mở, cần anh duyệt gì, việc nào tôi cố ý để lại và vì sao.
4. **Rủi ro / giả định** (nếu có).
- Dưới khoảng 500 chữ thì không dùng tiêu đề; trên đó tối đa 3 tiêu đề.
- Bảng chỉ dùng cho số liệu so sánh; danh sách gạch đầu dòng cho các mục song song (1–2 câu/mục).
- Lệnh, đường dẫn, mã lỗi để trong khối mã, không trộn vào câu.

### 2.4 Từ vựng trạng thái — nghĩa cố định, không dùng lẫn

| Nói | Nghĩa duy nhất |
|---|---|
| **Đã sửa** | Code đã đổi trên đĩa, **chưa** đo |
| **Đã QC** | Đã chạy bộ đo, kèm tên bộ đo + số màn × máy + số lỗi + `--file`/live |
| **Đã đẩy** | Đã commit + push; live có thể **chưa** đổi |
| **Live đã đổi** | Đã kiểm dấu vết (so số byte `curl | wc -c` với file cục bộ, hoặc GitHub API `size`) |
| **Sạch toàn dự án** | Chỉ được nói sau khi đọc **danh sách màn** của bộ đo và xác nhận màn đang nói nằm trong đó; dòng "○ bỏ qua" ≠ đạt |
| **Bản nội bộ** | `XEM-BAN-NOI-BO.bat` → localhost:8123; **chưa duyệt = chưa push, chưa deploy** |
| **Đã bác** | Anh đã từ chối kèm lý do; không đề xuất lại, chỉ nhắc khi có dữ kiện mới |
| **Nghi** | Chưa có bằng chứng; phải nói "nghi", không nói "là" |

### 2.5 Số liệu trong bài viết cho anh
- Con số làm thay đổi hành động → **bảng nhỏ hoặc dòng riêng**. Con số trang trí → bỏ.
- Ngày `dd/mm/yyyy` (trong cùng năm được viết `dd/mm`), giờ 24h `hh:mm`.
- Viết cho người: nghìn phân cách bằng dấu chấm `10.234`, thập phân dấu phẩy `3,3 s`, có khoảng
  cách trước đơn vị. (Trong UI theo điểm quyết 3.)
- Đo hiệu năng: ghi **trước → sau** cùng đơn vị (`p50 11,2 → 3,3 s`), ghi cách đo (CDP, đồng hồ, log).
- Không làm tròn tới mức đổi nghĩa: `99,1%` giữ nguyên, không thành "gần 100%".

### 2.6 Báo cáo dạng danh sách (task treo, lỗi QC, việc còn lại)
- Chỉ **danh sách theo ngày hoặc theo nhóm**: `mã · tên · trạng thái`. Không câu thoại trước/sau.
- Việc khác loại (ví dụ task workflow B1/B3 không thuộc sổ tay) → **một dòng riêng** ở cuối, không
  lẫn vào danh sách chính.
- Danh sách lỗi QC: `màn · máy · luật · phần tử` rồi mới tới cách chữa.

### 2.7 Khi kết luận sai hoặc có sự cố
- Nói thẳng: "Tôi đã kết luận sai vì…" rồi ghi bẫy vào memory chuyên đề. Không đổ cho công cụ.
- Chẩn đoán: **bằng chứng trước, phán xử sau** (ledger, log, số byte, header `Age`). Ba lần "báo sạch
  rồi lộ ra chỗ chưa đo" (20–21/08) và một lần "sửa không ăn" do CDN còn cache là bài học gốc.
- Nếu tests/bộ đo đỏ: dán số đỏ, không viết "gần đạt".

### 2.8 Khi đề xuất
- Mỗi đề xuất trả lời sẵn 3 câu: **thêm/bớt bao nhiêu lượt gọi upstream mỗi ngày?** · **có cần xin gì
  từ IT không?** (có → tự bác) · **có bắt gõ PIN/OTP không?** (có → tự bác, trừ ghi nhận 5S).
- Có khuyến nghị thì đặt lên đầu và nói rõ là khuyến nghị; không liệt kê 4 phương án ngang hàng.
- Không đề xuất lại các mục trong `BO-CHUAN-PHAT-TRIEN.md` §8.

### 2.9 Khi anh nói "ghi nhớ" / "cập nhật rule"
- **Luật** → đúng file chuẩn (`BO-CHUAN-PHAT-TRIEN` kỹ thuật · `QUY-CHUAN-THIET-KE` hình thức ·
  `QUY-CHUAN-GIAO-TIEP` cách nói), thêm vào đúng mục kèm ngày + 1 dòng NHẬT KÝ cuối file.
- **Bằng chứng, số đo, bẫy** → memory chuyên đề; ngày ghi tuyệt đối (`07/09/2026`, không "hôm nay").
- Rule mới đảo rule cũ → sửa tại chỗ, chú ngày đảo; không để hai bản đánh nhau.
- Anh bác một đề xuất → ghi vào mục "đã bác" **kèm lý do**, để sau này không hỏi lại.

---

## 3. NGÔN NGỮ TRONG SẢN PHẨM (chữ trên 2 dashboard, form 5S, tem in)

### 3.1 Tiếng và thuật ngữ
- Tiếng Việt có dấu. **Thuật ngữ hệ thống giữ nguyên tiếng Anh đúng như WMS / work.hasaki.vn**:
  SKU · UID · UID group · Group UID · In-BIN · Location · Counted · Finished · Active / Inactive ·
  Roll Code · PO · Type. Không dịch nửa vời ("nhóm UID", "vị trí bin").
- Tên kho, mã vị trí, mã công ty viết **y nguyên WMS**: `WH - MATERIAL - GARMENT`, `F0-A0`,
  `F0-KHO-503-09-04-01`. Không rút gọn tự chế trên màn (rút gọn chỉ trong tên biến/tab kỹ thuật:
  `UIDgr`, `kiemke-qtycount`).
- Viết hoa kiểu **câu** (chỉ chữ đầu): "Tạo lệnh kiểm kê", "Xem kế hoạch trên WMS". Ngoại lệ: nhãn
  field nhỏ uppercase theo khuôn `.mfilters label` và chip trạng thái hệ thống `ACTIVE / INACTIVE`.
- Một cách viết cho một từ trên toàn dự án (điểm quyết 1). Từ đã chốt: **sổ tay** (ledger cục bộ),
  **bản nội bộ** (staging), **bộ đo** (script QC), **cụm** (job theo lịch), **cầu nối** (extension
  bridge), **cầu dao** (circuit breaker), **nhịp tim** (heartbeat), **tem UIDgr**, **task treo**.

### 3.2 Nhãn nút
- **Động từ + đối tượng, tối đa 3 từ**: "Tra cứu", "Áp dụng", "Xoá lọc", "Xem & in", "Xác nhận in",
  "Tạo lệnh kiểm kê". Không danh từ trần ("Lọc"), không câu ("Bấm để tra cứu").
- Nút mang số đếm: `Nhãn · số` với dấu chấm giữa: "Tất cả · 1,234", "Toàn bộ vị trí · 161".
- **Cấm emoji.** Ký tự được phép: ✓ ✗ ✕ (đóng) ⚠ (lỗi) → ↗ (link ngoài) ↑↓ (sắp) ‹ › (trang) · …
- **Cùng chức năng → cùng nhãn + cùng tooltip** ở mọi tab và ở CẢ HAI dashboard
  (mẫu: "Kế hoạch chờ push (WMS)" có bản đầy đủ `.pt` + bản rút gọn `.ps` cho màn hẹp).
- Nút đóng pop-up: `×` (`&times;`). Nút từ chối trong hộp xác nhận: "Thôi". Nút lùi/tiến: "‹ Trước" / "Sau ›".
- Nút **có hậu quả** (Xoá sổ tay, Huỷ group, Nộp tất cả): nhãn nói rõ đối tượng + bước xác nhận
  thứ hai; nonce dùng một lần khi đi qua chat.
- Nút đang chờ mạng: khoá + đổi nhãn sang dạng tiếp diễn (ví dụ "Đang in…"), và **luôn** mở lại khi lỗi.

### 3.3 Tiêu đề và chú thích
- Tiêu đề = **tên của dữ liệu**, không kèm hướng dẫn trong ngoặc. Bỏ: "(bấm để xem SKU)",
  "(bấm × để bỏ từ khoá)". **Giữ** khi ngoặc là dữ liệu: "(Type: SKU · SKU Factory)".
  Câu hỏi phân định: *câu này nói về DỮ LIỆU hay dạy CÁCH BẤM?*
- Giải nghĩa → **nút `i`** đặt sát chính thứ nó nói tới (không ở header trang), nội dung **văn bản
  thuần** 1–2 câu, không thẻ HTML. `i` = thông tin bổ trợ · `?` = trợ giúp · `!` = bắt buộc biết
  trước khi làm (sắc thái cảnh báo) — đổi ký hiệu chỉ ở hằng `TIP_KYHIEU`.
- **Không khối hướng dẫn thường trực** trong UI; không dùng `title` thay `i` (điện thoại không hover).
- Ghi chú **theo ngữ cảnh** (hiện khi vừa nhập số, ví dụ "lô này gần như còn nguyên") được giữ:
  đó là kết luận đúng lúc, không phải văn chắn màn.
- Thao tác và link **ở lại trên màn**, không nhét vào tooltip.

### 3.4 Thông báo trạng thái — 5 loại, mỗi loại một khuôn câu

| Loại | Khuôn | Ví dụ | Cấm |
|---|---|---|---|
| Đang tải | "Đang tải <cái gì>…" + skeleton | đang dùng: "Đang tải chi tiết SKU…" | "Loading", vòng xoay không chữ |
| Rỗng hợp lệ | "Không có <cái gì>" | đang dùng: "Không có dòng phù hợp", "Không có tồn" | Tô đỏ, chữ "lỗi" |
| Chưa có nguồn | "Chưa có <tab/bộ số> — <việc cần làm>" | đang dùng: "Chưa có bộ số chuẩn tốc độ… — chạy … `--ghi` để nạp" | Dừng ở câu đầu không nói cách chữa |
| Lỗi / mất mạng | "<nguyên nhân hiểu được> — <nút hành động>" | đề xuất: "Mất mạng — bấm Thử lại" (hiện có "mất mạng rồi F5" + nút "Thử lại" rời) | Đổ mã lỗi thô / stack ra màn (đưa vào console + log) |
| Cảnh báo | ⚠ + một câu, màu `--warn`/`--bad` | "⚠ Chưa đọc được tab … Chuyển tạm sang …" | Cảnh báo không kèm hậu quả |

- Dấu ba chấm là **một ký tự** `…`, không phải `...`.
- Offline **phải báo trên màn** kèm nút "Thử lại"; không vẽ rỗng im lặng.
- Thông báo nói tên hệ thống đúng: "Google Sheet", "WMS", "Apps Script", không nói "server".

### 3.5 Số, ngày, đơn vị trên màn
- Số nguyên qua `nf()` (điểm quyết 3). Thập phân đúng số chữ số cần cho quyết định (mm không lẻ,
  giờ 1 chữ số lẻ).
- Ngày `dd/mm` khi cùng năm, `dd/mm/yyyy` khi khác năm hoặc là mốc pháp lý (ngày duyệt phiếu);
  giờ `hh:mm` 24h. Ngày giờ máy tính (ISO) chỉ trong log.
- Đơn vị **theo đơn vị WMS**: vải mm, chỉ gram; quy đổi phụ để trong ngoặc, cỡ nhỏ hơn, làm tròn:
  "54.840 (60yd)". Luôn hiện đơn vị của SKU đơn vị nhỏ nhất khi có nhiều cấp đóng gói.
- Chênh lệch: dấu `+` / `−` (dấu trừ dài) rõ ràng, màu theo nghĩa (`--good`/`--bad`), không dùng
  màu thay dấu.
- **Không số mồ côi**: mọi con số có nhãn đứng cạnh hoặc `data-lb` khi thành thẻ điện thoại.
- Số 0: trong **chip lọc** thì làm mờ (0 là câu trả lời hợp lệ); trong **ô của thẻ** thì ẩn (`mb-0`).

### 3.6 Văn bản dài (lý do AI, quy định 5S bị vi phạm)
- **Kết luận trước, chi tiết sau**; kết luận kẹp 3–4 dòng, chi tiết thu sẵn dưới dạng gạch đầu
  dòng, bấm để trải với nhãn đổi "xem N ô lỗi" ⇄ "thu gọn".
- Chỉ trường **>160 ký tự** mới thành ô bấm được; trường ngắn không có "xem thêm".
- Nguyên văn đầy đủ giữ trong `title` cho người dùng máy tính.

---

## 4. MÁY → NGƯỜI (Telegram, nhịp tim, nhật ký, nộp task)

### 4.1 Tin Telegram
- Khuôn: `<ký hiệu> <tên bộ máy>: <một câu sự việc> <số bước hỏng/lành>`.
  Ký hiệu (điểm quyết 4): ⛔ hỏng · ✅ lành lại · ⚠ cần chú ý nhưng chưa hỏng.
  Ví dụ đang dùng: "✅ Máy trạm 5S: mọi hạng mục đã bình thường trở lại."
- Tin hỏng nhắc lại **tối đa 12 giờ/lần**; tin ngày (báo 17h vệ sinh) **một tin/ngày**.
- **Không PII, không bí mật**: chỉ số tổng hợp + đuôi log; không tên nhân viên, không ảnh chứng từ,
  không token, mã OTP không bao giờ vào log và tin chứa mã bị xoá sau khi đọc.
- Lệnh gõ vào: `/lenh` **không dấu** (gõ nhanh trên điện thoại): `/trangthai` `/nop` `/dangnhap`.
  Trả lời của bot: **có dấu**.
- Lệnh có hậu quả (`/nop`) = 2 bước: bản nháp → nút chọn → xác nhận; nonce một lần, hết hạn 5'.
- Chat lạ → im lặng, chỉ ghi log. Không trả lời để lộ bot đang sống.

### 4.2 Nhịp tim và cầu dao
- Nhịp tim **phải mang số bước hỏng**; "xanh" mà cụm fail toàn phần là mù.
- Dừng-chờ-người **không dừng câm**: đẩy trạng thái lên dashboard hoặc Telegram kèm việc người
  cần làm ("Kiểm mật khẩu rồi xoá `.login-that-bai.json`").
- Đường thư đang TẮT → không viết câu nào dựa vào "đã gửi mail".

### 4.3 Nộp / comment task trên work.hasaki.vn (bot thay người)
- Chỉ nội dung **thật, kiểm chứng được ngay trong chữ**: mã phiếu, vị trí, người, giờ. Không dựa
  vào link dashboard ngoài.
- **Không câu đệm** kiểu "Không có nội dung báo cáo bổ sung"; kiểm kê không làm ⇒ đúng câu quy định
  "Không thực hiện công việc này trong ngày".
- Không nộp lại y nguyên task đã nộp/bị trả về; gặp dấu vết trả về thì **dừng và báo**, không tự sửa cho qua.
- Bot **không** comment phản biện, **không** tag lãnh đạo — việc của người.

### 4.4 Nhật ký (log file)
- Một dòng một sự kiện, mốc giờ ISO đầu dòng, mã bước rồi mới tới chữ; không bí mật; đuôi log là
  thứ được gửi lên chat nên viết như thể người khác đọc.

---

## 5. TÀI LIỆU, COMMIT, MEMORY

### 5.1 Tài liệu `.md` trong `hasaki/`
- Tên file HOA-KHÔNG-DẤU (lệ đang có); nội dung có dấu.
- Đầu file ghi rõ **file này là nguồn duy nhất của gì** (mẫu `LICH-VA-DU-PHONG.md`), và nếu có tài
  liệu cũ nói khác thì ghi "khi hai chỗ khác nhau, tin file X".
- Mốc thời gian luôn `dd/mm/yyyy`. Số đo ghi kèm cách đo.
- Không bí mật (mật khẩu, PIN, token, tên tài khoản, `chat_id`). File dính dữ liệu thật → gitignore
  ngay khi tạo.
- Emoji trong tài liệu mới: **không** (thống nhất với UI); tài liệu cũ đang có 🚀 ✅ để nguyên,
  sửa dần khi chạm vào.

### 5.2 Commit message
- Dòng đầu ≤ 100 ký tự, khuôn `<phạm vi>: <việc>` hoặc `<Mảng> dd/mm: <việc>`
  (mẫu đang có: `push-5s: soi metadata trước khi tải file`, `5S 05/09: dashboard tải trước chunk…`).
- Có dấu (điểm quyết 2). Nếu là tối ưu thì ghi số đo trước → sau ngay trong message.
- Trước push: `git log -S "<bí mật>"` rỗng (luật ở `BO-CHUAN-PHAT-TRIEN` §1).
- Kết thúc bằng dòng đồng tác giả theo cấu hình sẵn của công cụ.

### 5.3 Memory
- Mỗi file một sự thật; **luật** vào bộ chuẩn, **bằng chứng** vào memory; ngày tuyệt đối; liên kết
  `[[tên-memory]]`. Không ghi những gì repo đã ghi (cấu trúc code, lịch sử git).
- "Đã bác" luôn giữ lý do bác; "đã đảo" luôn giữ ngày đảo.

---

## 6. DANH MỤC THUẬT NGỮ (viết một kiểu)

| Khái niệm | Viết trên UI / báo cáo | Viết trong code / tên tab kỹ thuật |
|---|---|---|
| Đơn vị hàng | SKU | `sku` |
| Nhãn đơn chiếc | UID | `uid` |
| Nhóm UID trên WMS | UID group (đúng chữ WMS: Group UID) | `UIDgr`, `kiemke-uidgr` |
| Phiếu kiểm kê | phiếu kiểm kê, mã phiếu | `checklist_id` |
| Kiểm kê theo SKU / vị trí | kiểm kê theo SKU · kiểm kê theo vị trí | `type-sku` / `type-location` |
| Chênh lệch | Lệch âm · Lệch dương | `diff` |
| Bin trung chuyển | bin ảo F0-A0 | `pend` |
| Bản chạy thử cho anh duyệt | bản nội bộ | `XEM-BAN-NOI-BO.bat` |
| Script kiểm định | bộ đo | `qc-*.mjs` |
| Job theo lịch | cụm | Task Scheduler |
| Extension đọc WMS | cầu nối | `wms-bridge` |
| Ngắt tự động khi hỏng | cầu dao | `.login-that-bai.json` |
| Tín hiệu sống | nhịp tim | heartbeat |
| Sổ ghi cục bộ | sổ tay | ledger `.json` |
| Task chưa nộp / bị trả | task treo | `status 0/1/3` |

---

## 7. KIỂM 6 CÂU TRƯỚC KHI GỬI BẤT KỲ VĂN BẢN NÀO

1. Dòng đầu có phải là thứ người đọc cần quyết không?
2. Mỗi con số có chỗ đo ra nó không? Có số nào chỉ để trang trí không?
3. Có từ nào trong §2.4 dùng sai nghĩa không ("đã sửa" mà chưa QC, "live" mà chưa kiểm byte)?
4. Có câu đệm, câu kể, câu hứa nào không?
5. Có emoji, chữ không dấu, thuật ngữ dịch nửa vời không?
6. Có bí mật hoặc PII nào lọt vào không (kể cả trong khối mã dán từ log)?

---

## NHẬT KÝ

- **07/09/2026** — Khởi tạo bản nháp v0.1 theo yêu cầu "tạo bộ quy chuẩn giao tiếp… để xem-duyệt
  thành chuẩn chung". Nguồn: bộ nhớ dự án + rà `factory/index.html`, `kiemsoatkho/index.html`,
  `canh-suc-khoe.js`, `tin-nhan-bot.mjs`, lịch sử commit 2 repo. 5 điểm chờ anh quyết ở §0.
