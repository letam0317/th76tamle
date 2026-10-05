# Việc làm ca đêm — bộ cào tự động chạy trên Google

Bảng tính: https://docs.google.com/spreadsheets/d/1oHmNxMS1wwZvPiwb9r6bS0Tn8CxiPF3spi6xjf9I8QQ/edit
Trình soạn thảo mã: https://script.google.com/d/14boUG-_mWfG-S8Hcc_zyMgvqXLFnUgSdvJf7HMx6qyd-nS-L6fjDL2vs/edit

## 1. Vì sao phải làm lại (kiểm tra 14/09/2026)

Câu hỏi: *"9h có thật là luôn lấy dữ liệu mới không?"* — **Không.** Hai lý do, cái nào cũng đủ hỏng:

| Chỗ kiểm | Kết quả |
|---|---|
| Lịch 9h trong Task Scheduler | **Không tồn tại.** `daily_job_sync.py` chỉ in dòng chữ "=== [9:00 AM] ===". |
| `scrape_jobs.py` | **Không vào mạng.** 20 tin nằm cứng trong code, chạy 100 lần vẫn ra 20 tin đó. |
| Cột "4.5⭐ Google Maps" của bản cũ | Chữ viết sẵn trong code, không hề hỏi Google Maps. |

## 2. Bộ mới (bản 2, 14/09/2026)

Apps Script **gắn trong chính bảng tính**, chạy trên máy chủ Google → laptop tắt vẫn chạy.

**Nhanh** — bản 1 gọi từng trang một nên mất vài phút. Bản 2:
- `UrlFetchApp.fetchAll` gọi song song cả chục trang cùng lúc.
- Tab **BỘ NHỚ** (ẩn) giữ nội dung tin đã đọc + số km đã đo. Lượt sau chỉ làm phần mới,
  nên lượt đầu chậm còn các lượt sau thường xong trong khoảng nửa phút.
- Menu > *Xoá bộ nhớ, cào lại từ đầu* nếu muốn ép đọc lại tất cả.

**Nguồn** (bật/tắt từng cái trong tab CẤU HÌNH):

| Nguồn | Lấy được gì | Ghi chú |
|---|---|---|
| vieclam24h.vn | JSON nhúng sẵn: lương, địa chỉ, **toạ độ** để đo đường, ngày đăng | nhiều tin nhất |
| hoteljob.vn | việc khách sạn/nhà hàng, lọc sẵn TP.HCM | phải vào trang chi tiết mới biết nơi làm thật |
| careerviet.vn | lương, nơi làm, ngày cập nhật | |
| jobsgo.vn | lương, nơi làm, "8 phút trước" | trang lọc sẵn TP.HCM |
| vieclam.thegioididong.com (**cổng chung cả nhà MWG**) | tin nội bộ của Thế Giới Di Động, Điện Máy Xanh, **Bách Hoá Xanh**, Nhà thuốc An Khang, AVAKids, TopZone — không lên trang việc làm nào khác | đọc **8 trang** (20 tin/trang, ~136 tin), phải vào trang chi tiết mới biết giờ ca; nơi làm + toạ độ hỏi riêng qua `/job/getpositions` |
| Facebook (qua tiện ích Edge) | bài trong nhóm bạn đã tham gia | xem mục 3 |
| topcv.vn | — | **mặc định TẮT**: TopCV đứng sau Cloudflare, gọi từ máy chủ hay bị chặn (403) |
| Trang công ty | tab **NGUỒN CÔNG TY** (gieo sẵn TGDĐ, Kingfoodmart, WinMart, Circle K) | **tiện ích Edge** mở từng việc và đọc — máy chủ Google không chạy được JavaScript của mấy web này |
| **vieclamtot.com (Chợ Tốt)** — thêm 16/09/2026 | việc phổ thông: bảo vệ, giữ xe, kho, quán ăn, xưởng đóng gói; có sẵn **toàn văn + toạ độ + giờ đăng** ngay ở danh sách | đọc qua cổng dữ liệu công khai của trang (không cần đăng nhập); tìm rất "mờ" nên chỉ hỏi theo từ khoá đầu tiên, lấy 4 trang × 50 tin |

## Ba việc nữa phát hiện khi đo — 19/09/2026

- **vieclam24h.vn đang CHẶN máy chủ Google (403)** từ 17h ngày 18/09 (15/15 trang, liên tục; gọi từ
  máy nhà vẫn 200). Nguồn này vào diện "nghỉ 24 giờ".
  Lỗ hổng đi kèm: nguồn đang nghỉ bị lọc khỏi danh sách yêu cầu nên **vòng "bù từ BỘ NHỚ" bỏ sót** —
  bảng mất trắng 33 việc vieclam24h mà không ai báo. Đã vá: nguồn đang nghỉ cũng được dựng lại tin
  cũ (trong 7 ngày) từ bộ nhớ. Vì vl24h đang bị chặn nên các từ khoá NGHỀ chỉ hỏi careerviet.
- **Tự gây lỗi hôm 18/09, đã sửa**: đặt "Long An = trừ vào suất Chợ Tốt" trong khi ô cấu hình của
  bảng vẫn để 4 → Chợ Tốt TP.HCM tụt từ 3 xuống **2 trang**, ít hơn cả trước khi cải tiến. Nay Long
  An là trang **cộng thêm**; dòng *"Chợ Tốt: mấy trang mỗi lượt"* = số trang TP.HCM (nên để 7).
- **Soi cả trang phải cắt đúng vùng bài đăng**: mục *Việc làm liên quan* và khối **từ khoá SEO** ở
  chân trang cũng chứa chữ "ca đêm" — đo thật: 4/5 tin bảo vệ ban ngày bị kết luận nhầm. Nay chỉ soi
  từ mốc *"Mô tả công việc"* tới trước các mục đuôi, cộng thêm bộ lọc "dòng lặp chữ = rác SEO".

## Hai chỗ sót nữa — 19/09/2026

Ví dụ thật: tin **"NHÂN VIÊN GIÁM SÁT AN NINH & KIỂM SOÁT NỘI BỘ (AUDIT)"** của BEST Logistics
(careerviet, Quận 7) ghi rõ *"Đối với Audit tại SC bắt buộc Làm việc ca đêm"* nhưng không vào bảng.
Soi ra **hai lỗi khác nhau**, cả hai đều xảy ra TRƯỚC bộ lọc ca đêm:

**1. Trang việc làm không trả tin đó khi tìm chữ "ca đêm".** Đo 19/09: tìm `ca đêm`, `làm đêm`,
`trực đêm`, `ca tối` trên careerviet đều **không** có tin này; chỉ khi tìm **"giám sát an ninh"**
mới ra. Lý do: các trang việc làm tìm theo tiêu đề/ngành nghề, chữ "ca đêm" nằm giữa phần mô tả
thì không được đánh chỉ mục. Nghĩa là **cứ tìm theo chữ "đêm" là mãi mãi không thấy nhóm tin này**.

→ Thêm dòng cấu hình **"Từ khoá NGHỀ hay làm đêm (tìm rộng rồi đọc kỹ)"** (mặc định: bảo vệ, an
ninh, giám sát, kho, phân loại hàng, lễ tân, tạp vụ, tài xế). Tin lấy về theo nghề hầu hết không có
chữ đêm ở tiêu đề nên đi thẳng vào cửa *"đọc kỹ tin mơ hồ"* — đọc nội dung rồi mới kết luận.
Bộ nhớ nâng trần lên **5.000 dòng** để không phải đọc lại.

**2. Đoạn trích không phải là cả bài.** Câu "bắt buộc Làm việc ca đêm" nằm ở khoảng **chữ thứ
4.000**, trong khi bộ cào chỉ giữ 600 chữ mô tả + 320 chữ yêu cầu → bộ lọc không nhìn thấy gì.
→ Nay khi đọc chi tiết thì **soi cả trang**: tìm thấy câu nói tới ca đêm thì kẹp nguyên câu đó vào
đầu phần *Chi tiết công việc* với dấu **⚑** — vừa để bộ lọc thấy, vừa để người đọc biết vì sao tin
này nằm trong bảng (và vì cột chi tiết được ghi vào BỘ NHỚ nên lượt sau vẫn còn bằng chứng).
Giờ làm cũng được dò lại trên cả trang nếu đoạn trích không có, và đọc thêm kiểu **"22.00 – 07.00"**
(có chặn để không nhầm khoảng lương "9.5 - 12 triệu" thành giờ làm).

**Có làm dính oan tin ban ngày không?** Đo thử 30 tin lấy từ các từ khoá nghề: chỉ **1 tin** bị kết
luận ca đêm, và đó là tin đúng (*Lễ tân khách sạn — "Ca đêm: 22.00 – 07.00"*).

## Rà toàn bộ "cào sót" — 18/09/2026

Việc của Bách Hoá Xanh chỉ là một ví dụ. Đã đo lại **từng nguồn** xem còn sót ở đâu (số đo bằng
các bộ đo trong `scratchpad/`, chạy trên mạng thật):

| Nguồn | Đang đọc | Đo được gì | Đã làm |
|---|---|---|---|
| Cổng MWG (TGDĐ + Bách Hoá Xanh + An Khang…) | 1 trang / 136 tin | trang 2-8 có **7 việc ca đêm** nữa | đọc **8 trang** |
| Chợ Tốt (vieclamtot) | 3 trang HCM + 1 Long An | trang 4-8 còn **+28 việc** lọt lọc, Long An trang 2 **+5** | đọc **7 trang HCM + 2 Long An** |
| vieclam24h | 2 trang × 4 từ khoá | trang 3-6 chỉ thêm **1 việc** (trang này xếp theo độ hợp, đọc sâu là phí) | **giữ nguyên** |
| hoteljob | 1 trang (24 tin) | trang 2 trở đi đổi khuôn, bộ bóc đọc ra 0 tin | giữ nguyên, ghi vào sổ để làm sau |
| careerviet | 1 trang (50 tin) | nút sang trang chạy bằng JavaScript, đổi `?page=` không ăn | giữ nguyên |
| jobsgo | đang TẮT | phân trang được (`-p2.html`, +50 tin/trang) nhưng máy chủ Google bị chặn 403 | vẫn tắt |
| **Trang công ty** | **chỉ chạy khi bấm tay + Edge mở** | lượt tự động mỗi giờ **không ngó công ty nào** | **máy chủ tự quét** (xem dưới) |

**Trang công ty — chỗ sót lớn nhất về nguyên tắc.** Trước đây kênh này giao hẳn cho tiện ích Edge,
mà tiện ích chỉ chạy khi bấm "Cào ngay" và Edge đang mở → cò tự động mỗi giờ bỏ trắng. Nay máy chủ
tự quét bằng **một nguyên tắc chung cho mọi web** (không viết bộ bóc riêng từng nơi):

1. tải trang danh sách của công ty;
2. nhặt link giống tin việc, chọn **khuôn đường dẫn hay lặp nhất** (đó là khuôn tin việc — khuôn
   danh mục chỉ có vài cái);
3. xếp tin **đáng ngờ lên trước** (tên/đường dẫn có chữ đêm → kho, bảo vệ, phân loại, siêu thị… →
   còn lại), mở tối đa 8 tin **chưa đọc** mỗi công ty;
4. đọc giờ ca như tin thường; tin đã đọc — kể cả bị loại — ghi vào BỘ NHỚ nên lượt sau không đọc lại.

Mỗi lượt chỉ quét **4 công ty** (xoay vòng) nên nhẹ; vài lượt là hết danh sách. Đo trên 15 công ty
trong tab: 6 nơi là **vỏ JavaScript** (Kingfoodmart, AEON, KFC, Lotteria, Jollibee, Shopee Express)
— máy chủ chỉ tải được cái vỏ nên tự khắc ra 0 link, phần đó vẫn để tiện ích Edge lo.

**Danh sách công ty cũng đã lỗi thời**: nhiều địa chỉ 404 hoặc trỏ vào trang vỏ. Có thêm nút
**Việc ca đêm → Cập nhật danh sách nguồn công ty**: sửa những ô còn giữ địa chỉ cũ (Saigon Co.op →
cổng tuyển dụng thật, Circle K, Bách Hoá Xanh…) và thêm 7 nơi đã đo là đọc được (Nutifood, BV Tâm
Anh, BV Hoàn Mỹ, AEON Mall, J&T Express, Sotrans, MM Mega Market). Ô nào tự sửa rồi thì không đụng.

**Trần bảng (user chốt 18/09/2026: "có nhiêu nâng nhiêu")**: dòng *"Số việc ghi ra tối đa"* trong
CẤU HÌNH nay để **0 = không giới hạn** (mặc định mới là 300). Code vẫn chặn cứng ở **500 dòng** để
một lượt xui không đổ mấy nghìn dòng vào bảng. Trước đó bảng chặn ở 100 trong khi có tới ~193 việc
đạt yêu cầu — tức là đang cắt mất gần một nửa.

**Vì sao bỏ lỡ việc của Bách Hoá Xanh (18/09/2026)?** Cổng tuyển dụng MWG đăng chung cho cả nhà
(TGDĐ, ĐMX, Bách Hoá Xanh, An Khang, AVAKids, TopZone): **136 tin nằm trên 8 trang**, nhưng bản cũ
chỉ đọc **trang 1** (20 tin). Việc "Nhân viên Giám sát Camera An ninh Bách Hoá Xanh" (ca
**21h00 - 6h00**, 112 Hoàng Hoa Thám, Bảy Hiền) nằm ở **trang 2** nên không lượt nào nhìn thấy.
Ba thứ đã sửa:

1. **Đọc đủ 8 trang** (chỉnh trong CẤU HÌNH). Đo 18/09: 1 trang → **1** việc ca đêm · 8 trang →
   **8** việc ca đêm, 7 việc nằm trong bán kính.
2. **Nơi làm thật thay cho "Hồ Chí Minh và 15 tỉnh…"**: trang danh sách chỉ ghi vậy, đem đi đo là
   ra tâm thành phố = "9,3 km giả". Cổng có cửa công khai `/job/getpositions?id=<mã>&provinceID=0`
   trả **địa chỉ + toạ độ từng nơi làm**; việc nhiều nơi thì lấy **nơi gần nhà nhất** (tin "Kho
   chuyên đêm" có 39 nơi trên cả nước). Chỉ hỏi cho việc **đã chắc là ca đêm** (~8 lượt gọi/lượt chạy).
3. **Ghi đúng thương hiệu**: trước đây mọi tin đều ghi "Thế Giới Di Động / Điện Máy Xanh"; nay suy
   từ tên việc → "Bách Hoá Xanh (MWG)", "Nhà thuốc An Khang (MWG)"…

Kèm theo: địa chỉ kiểu "… và N tỉnh…" / "Toàn quốc" nay bị coi là **mơ hồ** (không đem đi đo), và
số km cũ trong BỘ NHỚ đo từ địa chỉ mơ hồ sẽ bị bỏ để đo lại cho đúng.

**Vì sao trước 16/09 bảng "chưa đa dạng" (39 việc, toàn lễ tân khách sạn)?** Với vieclam24h và
careerviet, trang danh sách không có phần mô tả, nên bộ lọc ca đêm chỉ còn bám vào **tiêu đề**.
Tin "Nhân viên bảo vệ", "Nhân viên kho", "Phục vụ" ghi *ca 22h-6h* trong mô tả bị loại oan hết.
Đo ngày 16/09: 403 tin thô → 193 tin "mơ hồ" (ở gần, không telesale, tiêu đề không có chữ đêm);
đọc thử 45 tin thì **14 tin là ca đêm thật**. Nay cò **đọc kỹ** những tin mơ hồ đó (mới đăng
trước, tối đa 60 tin/lượt — chỉnh trong CẤU HÌNH) rồi mới lọc; tin đã đọc, kể cả bị loại, ghi vào
BỘ NHỚ để lượt sau không đọc lại. Cộng thêm nguồn Chợ Tốt là chỗ đăng nhiều việc phổ thông ca đêm
nhất TP.HCM.

**Cột trong bảng** (14 cột, đã bỏ hết icon):
Nguồn · **Loại việc** · Tên công việc · Chi tiết · Yêu cầu · Thời gian làm việc · Mức lương · Địa chỉ ·
**Khoảng cách ô tô** · Nhà tuyển dụng · **Ngày đăng** · **Đăng cách đây** · Link · Nhãn

- **Loại việc** (thêm 16/09/2026): nhóm nghề đoán từ tiêu đề (không ra thì từ nhà tuyển dụng + đoạn
  đầu mô tả), so **trọn từ** để "kho" không dính "sức khoẻ". 11 nhóm: Khách sạn · lễ tân / Bảo vệ ·
  giữ xe / Vệ sinh · tạp vụ / Kho · giao nhận / Kỹ thuật · bảo trì / Sản xuất · công nhân / Nhà hàng ·
  quán · bar / Bán hàng · siêu thị / Y tế · chăm sóc / Giáo dục / Văn phòng · CSKH, còn lại là Khác.
  Nhật ký mỗi lượt ghi thêm dòng `N nhóm nghề: … | theo nguồn: …` — đó là thước đo "đa dạng",
  đừng đoán bằng mắt.

- **Thứ tự hàng**: theo **ngày đăng mới nhất** ở trên (đúng cột "Đăng cách đây"), tin không rõ ngày
  đăng thì lấy lần cò thấy làm mốc. Cột Nhãn ghi `MỚI` cho việc cò vừa thấy lượt này. (Bản 15/09 chiều
  xếp theo lần cò thấy → tin đăng 21 ngày mà cò mới gặp nhảy lên đầu — đã bỏ.)
- **Ca đêm** = ca nằm trong 19h → 8h sáng (22h-6h, 18h-2h, 0h-8h); 17h-23h là ca tối, không tính.
  Có ca đêm nhưng "xoay ca / tối đa N ca đêm" → vẫn lên bảng, nhãn `Tham khảo (xoay ca…)`.
- *Đăng cách đây* là **công thức** dùng `NOW()` nên tự đếm tiếp ("3 giờ trước" → "5 giờ trước"),
  không phải chữ chết. Bảng tiếng Việt ngăn tham số bằng `;`; script tự đoán, đoán sai thì tự viết
  lại bằng dấu kia và nhớ luôn.
- *Nhãn*: Mới (≤ 3 ngày) · Tin cũ (≥ 45 ngày) · Lương cao bất thường.
- **Việc telesale bị LOẠI BỎ HẲN** (15/09/2026), không lên bảng: telesale, telemarketing, tổng đài,
  CSKH, chăm sóc khách hàng, tư vấn viên/bảo hiểm/tuyển sinh, chốt đơn, call center, thu hồi nợ…
  Xét cả tên việc, tên nhà tuyển dụng và đoạn đầu mô tả. Nhật ký ghi `bỏ N việc telesale`.
  Đổi ý thì sửa ô *Việc telesale* trong CẤU HÌNH thành `Xuống cuối` hoặc `Giữ`.

Ba tab phụ: **CẤU HÌNH** (điểm xuất phát, bán kính, từ khoá, bật/tắt nguồn), **NHẬT KÝ**
(mỗi lượt 1 dòng: nguồn nào trả mã gì, bao nhiêu tin, mấy giây), **BỘ NHỚ** (ẩn).

## 3. Facebook (15/09/2026)

Cào thẳng nhóm Facebook từ máy chủ là **không có đường hợp lệ**: nhóm kín không đăng nhập thì
không đọc được gì, API nhóm của Facebook đã đóng, còn đăng nhập bằng tài khoản thật từ máy chủ
thì rất dễ bị khoá tài khoản.

Cách đang dùng: **tiện ích Edge chạy trong phiên Facebook của chính user**. Nó mở nhóm ở tab nền,
đọc bài đang hiển thị, gửi về cửa `doPost` của Apps Script (có khoá riêng trong Script Properties),
bài vào tab **BÀI FACEBOOK** rồi đi chung đường lọc với các nguồn khác.
Chi tiết cài đặt và giới hạn: `HUONG-DAN-TIEN-ICH.md`.

## 4. Bật lần đầu (1 phút, làm 1 lần)

1. Mở bảng tính, **F5**. Nếu thấy menu **Việc ca đêm** thì bấm luôn *Thử nguồn*.
   Không thấy menu → mở **link trình soạn thảo mã** ở đầu file này, bấm **Chạy** (Run) một lần,
   rồi quay lại bảng tính F5 — menu sẽ hiện.
2. Google hỏi cấp quyền → chọn `letam0317@gmail.com` → *Nâng cao* → *Chuyển tới…* → **Cho phép**.
   (Cảnh báo "chưa xác minh" là bình thường: script do chính bạn sở hữu.)
3. Menu > **Cào ngay**.
4. Menu > **Bật lịch chạy tự động mỗi sáng**.

Lịch của Google chạy trong **khung 9h–10h**, không đúng phút 9:00 — đó là cách Google làm.

## 5. Sửa code sau này

```bash
cd "C:\Users\lechitam\New folder\viec-lam-ca-dem"
node qc-cao.mjs                      # QC: chạy thật hàm bóc dữ liệu trên mạng thật
npx --yes @google/clasp push --force # đẩy lên Google (không phải cấp quyền lại)
```

## 6. File cũ — đừng dùng nữa

- `..\daily_job_sync.py`, `scrape_jobs.py`: danh sách cứng, không cào.
- `..\upload_to_sheet.py`: đẩy CSV cũ lên Sheet — chạy là **ghi đè mất** dữ liệu mới cào được.
- `..\Viec_lam_ca_dem.csv`: 20 tin cũ.
