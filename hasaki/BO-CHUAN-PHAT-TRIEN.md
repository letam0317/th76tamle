# BỘ CHUẨN PHÁT
- **17/09/2026** — Mục 7: bộ đo đọc dữ liệu Alpine/iframe phải chép trường nguyên thuỷ (Proxy qua CDP hoá thành `{}`) — rút từ lần đo nút Ghi nhận 5S trong pop-up Planogram báo hỏng oan ca thông báo nạp sẵn.
 TRIỂN — áp cho MỌI chức năng/tool mới và mọi đợt cải tiến

> Nguồn: tổng hợp từ Audit toàn diện 23/08/2026 + toàn bộ bộ QC (qc-*.mjs) + các ràng buộc
> user đã chốt qua các đợt. **Đây là nguồn duy nhất của bộ chuẩn** — khi user yêu cầu
> "cập nhật rule", thêm/sửa vào đúng mục kèm ngày, và ghi 1 dòng vào NHẬT KÝ RULE cuối file.
> File này KHÔNG được chứa bí mật (mật khẩu/PIN/token/tên tài khoản) — repo là PUBLIC.

---

## 0. QUY TRÌNH BẮT BUỘC cho mọi đợt cải tiến (chốt 23/08/2026)

1. **QC baseline TRƯỚC khi sửa** — chạy bộ đo sẵn có trên bản đang chạy, lưu kết quả để
   đối chứng "giống hệt bản cũ" sau này.
2. **Sửa code** — lưu ý: backend `.js/.mjs` trong `hasaki/` chạy LIVE theo Task Scheduler
   ngay khi lưu file → sửa thận trọng, file đang được task gọi thì sửa xong phải chạy được ngay.
3. **QC SAU khi sửa** — `node --check` + bộ đo với `--file` (soi bản chưa đẩy). Màn/pop-up/panel
   nào bị sửa hiển thị mà CHƯA nằm trong danh sách màn của bộ đo → PHẢI thêm vào trước khi đo
   (mục 7: phạm vi đo = phạm vi lời hứa).
4. **BẢN NỘI BỘ cho user duyệt** — `XEM-BAN-NOI-BO.bat` → http://localhost:8123/factory/ +
   /kiemsoatkho/ (điện thoại dùng IP LAN in ra màn hình). Phải có TRANG cho user tự xem,
   không chỉ báo cáo chữ. **Chưa duyệt = chưa push / chưa clasp deploy.**
5. **Sau khi push/deploy: kiểm dấu vết rồi mới đo live** — GitHub Pages/CDN trả bản cũ vài phút.
   So SỐ BYTE (`curl -s <url> | wc -c` = `wc -c < file`) hoặc GitHub API `/contents` → `size`,
   hoặc grep chuỗi CHỈ có ở bản mới. Đừng đếm giây, đừng kết luận "sửa không ăn" khi chưa kiểm.
6. **RÀ VIỆC CŨ SAU MỖI THAY ĐỔI (chốt 01/10/2026)** — mỗi khi đổi cách làm (luật, khuôn bằng chứng, clip,
   bình luận, mẫu nộp…) phải rà LẠI mọi task/phiếu đã làm theo cách cũ: **TASK (phiếu cha) đã HOÀN THÀNH →
   để nguyên**; **task CHƯA hoàn thành → ghi đè bằng bản mới** (xoá bản cũ theo QC-01, mục 11) — kể cả khi BƯỚC
   chứa dữ liệu (vd B1) đã xong: xét theo TASK, không xét theo bước (user đính chính 01/10: "không phải hoàn thành
   bước, mà là task hoàn thành… đang trong giai đoạn cải tiến liên tục nên cần đồng bộ trước sau thay đổi").
   Trước khi ghi đè đọc lại phiếu: đúng việc, đúng mục đích — dữ liệu mới thay đúng chỗ dữ liệu cũ.
   Báo cáo cuối đợt phải có dòng: bao nhiêu phiếu rà · bao nhiêu để nguyên (đã xong) · bao nhiêu đã ghi đè.

**Không bắt nhập PIN** cho bất kỳ chức năng nào, NGOẠI TRỪ ghi nhận 5S. Bảo mật phải bằng
cách không gõ tay: khoá thiết bị cấp 1 lần qua link `#khoa=` → localStorage, quota server-side, nonce.

---

## 1. BẢO MẬT (cả 2 repo là PUBLIC — mọi file tracked là công khai Internet)

- **KHOÁ GHI theo chủ token (12/10/2026)**: token mượn từ phiên người khác (hướng 3 — bridge riêng từng PC)
  CHỈ được ĐỌC. Mọi cò GHI (tạo/nộp task, bình luận, đóng B1.1, thao tác UID…) PHẢI kiểm `laTokenGhiDuoc(token)`
  (`session-rules.js`) TRƯỚC khi ghi; không phải tamlc → DỪNG, không ghi (tránh ghi nhầm danh tính người khác).
  **CẤM bật hướng 3** (PC tự bơm token người khác) cho tới khi: mọi điểm ghi đã gắn khoá + test token-người-khác
  bị chặn đạt. Hôm nay kho chỉ có token tamlc nên khoá là NO-OP.
- **Trước MỌI cú push**: bí mật mới nào từng gõ vào code thì `git log -S "<bí mật>"` phải RỖNG.
  Commit chưa push mà dính bí mật → sửa lịch sử (rebase/soft-reset) TRƯỚC khi push, và xoay bí mật đó.
- Bí mật chỉ sống ở `.env` / Script Properties / file đã gitignore. **CẤM fallback hardcode**
  kiểu `process.env.X || "mật-khẩu-thật"` — đó chính là cách mật khẩu Inside lọt vào commit.
- File mới chứa dữ liệu thật / bí mật / chi tiết lỗ hổng → cân nhắc gitignore NGAY KHI TẠO
  (audit/rollout doc đã bị chắn bằng pattern `hasaki/AUDIT-TOAN-DIEN-*.txt`, `hasaki/ROLLOUT-AUDIT-*.md`).
- **Mọi action GAS (đọc lẫn ghi) phải gác SERVER-SIDE**: khoá thiết bị `DEVICE_KEY` cho action
  thường, SECRET cho action quản trị (setDeviceKey, set key), nonce chống replay cho action ghi.
  CẤM tin dữ liệu client tự khai (regex email là ví dụ đã bị audit bắn: client tự sinh email là qua).
  CẤM route kiểu TOFU (key trống = ai đến trước chiếm).
- Không phát token/Bearer nội bộ (WMS/work/hr) ra trình duyệt trang public; upload cần token
  thì đưa về máy trạm.
- gviz lấy tab public: chỉ kéo cột cần dùng khi thêm TAB MỚI; cột PII (email, mã NV) thì đừng
  đẩy lên sheet public ngay từ tầng ghi (chặn ở producer, không chặn ở consumer).
- Extension/bridge: `matches` hẹp đúng path của 2 dashboard, `postMessage` đích danh origin,
  khoá `.pem` không bao giờ commit.
- File Drive/Sheet tạo mới: mặc định KHÔNG chia sẻ cho ai (kể cả email công ty). Drive có bẫy
  báo chia sẻ thành công giả — kiểm lại quyền sau khi thao tác.
- Không để JWT/phiên sống trong file config được track (kể cả `.claude/settings.json`).

---

## 2. TẢI UPSTREAM (work / wms / hr / planogram) — ràng buộc thường trực

- Mọi đề xuất phải trả lời được: **"việc này thêm/bớt bao nhiêu lượt gọi upstream mỗi ngày?"**
  Không chạm upstream (Sheet ↔ trình duyệt) → làm thoải mái. Tăng lượt gọi → mặc định LOẠI,
  trừ khi đổi lại được một khoản cắt lớn hơn ở chỗ khác.
- **Cache là mặc định, không phải tối ưu về sau**: danh bạ NV 12h; comment task mở TTL 30';
  endpoint/size memo 7 ngày (tự xoá memo khi trang 1 chết); cache theo `id|updated_at` để chỉ kéo
  bản ghi đổi; hash chống ghi Sheet trùng.
- Kéo **delta**, không kéo full mỗi lượt; đếm trước bằng `size=1` rồi lấy đúng số dòng.
- Vòng poll/thử lại: **backoff tăng dần** (2→6→18s…), không nhịp cố định; `setInterval`/watcher
  không được spawn thêm tiến trình trùng việc với task đã có lịch.
- **Cụm nặng có cửa giờ 07:00–18:00 T2–T7**, đặt Ở ĐẦU main (tick ngoài giờ không tốn lượt gọi
  nào), `--force` xuyên cửa để chữa cháy.
- Kiểm "cụm khác đang chạy" phải **FAIL-CLOSED**: lỗi khi dò tiến trình → coi như ĐANG chạy,
  đừng spawn chồng (2 tiến trình cùng kéo WMS + ghi Sheet là tai nạn thật đã đo được).
- **CẤM đề xuất xin service account / API / file drop từ IT** — chỉ dùng quyền đang có.

---

## 3. OFFLINE & RESILIENCE (frontend — thủ kho dùng điện thoại, mạng kho chập chờn)

- Dashboard phải có **service worker NETWORK-FIRST** (không cache-first — deploy thường xuyên,
  cache-first = đóng băng bản cũ). Mất mạng + F5 không được trắng trang.
- **Mọi `fetch` phải có `AbortSignal.timeout`**. Gọi GAS = **45s** (đo thật 7–40s/lượt bình
  thường — 20s là bác rồi, sẽ chém nhầm lượt lành).
- Nút bấm disable rồi `await` → **bắt buộc `try{}finally{btn.disabled=false}`** — treo mạng
  không được khoá nút vĩnh viễn.
- Mọi `.then()` phải có nhánh lỗi; promise dùng làm khoá nạp (`_dangNap… = …then()`) phải
  `.finally()` reset — 1 lần lỗi không được giết mọi pop-up về sau.
- GAS lỗi trả HTML chứ không JSON → **`r.text()` rồi kiểm `t[0]==='{'`**, cấm `r.json()` thẳng.
- Offline phải BÁO trên màn ("mất mạng, bấm thử lại"), không vẽ rỗng im lặng.
- Hàng đợi gửi lại khi có mạng phải có **HẠN SỬ DỤNG** khớp cửa nonce server (nonce GAS 10' →
  queue 8'); quá hạn thì hỏi user, không gửi mù (rủi ro in đôi/ghi đôi).
- Cờ trạng thái (`dangTai`, `dangSoat`…) phải có đường reset khi lỗi/offline (callback + timeout).

---

## 4. HIỆU NĂNG FRONTEND (điện thoại thủ kho CPU yếu, dữ liệu 40-50k dòng)

- Render danh sách: **CAP 200 dòng + nút "Xem thêm"** — tổng dòng/tổng SL vẫn đếm đủ.
  Không `innerHTML` chục nghìn node.
- Vòng lặp chục nghìn dòng: **chia lô (~2000) + nhường luồng** (`ndsNhuongLuong` sẵn có,
  MessageChannel); các phép tổng hợp khác nhau dùng CHUNG một vòng quét, đừng quét lại mảng
  cho mỗi việc.
- Lọc theo phím gõ: cache mảng lowercase MỘT lần, đừng `toLowerCase()` từng dòng mỗi phím.
- Tra cứu lặp lại theo khoá → dựng index map `O(1)` một lần, đừng quét tuyến tính mỗi lượt.
- `setInterval` gọi hàm async → cờ chống chồng lượt (`if(_dangBan)return`).
- Truy cập dữ liệu theo khoá từ ngoài vào (`WH_DATA[w]`) → guard mặc định (`||{shelf:[],pend:[]}`).
- **Trang 3D three.js (07/10/2026, rút từ lienanh-3d "bị giật"):** ĐO trước bằng Edge nền GPU thật (`--use-angle=d3d11`, đếm
  `renderer.info.render.calls` + thời gian khung), không đoán. Ngân sách: **≤ 900 lần vẽ/khung** cho cảnh đầy đủ. Cách đạt:
  bóng `shadowMap.autoUpdate=false` + `needsUpdate` khi bố cục đổi (vật chuyển động thì `castShadow=false`); vật lặp (cột, xe, thùng,
  lồng, chân ray…) = InstancedMesh / kho instance; đồ rời nhiều mesh → gộp theo vật liệu; `setPixelRatio ≤ 1,5`; không
  `preserveDrawingBuffer`; ảnh phụ (bản đồ nhỏ) vẽ vào render target, **không** đổi cỡ canvas chính; huỷ geometry/texture +
  bỏ sprite khỏi mảng nhãn khi dựng lại. Bộ đo phải có ca "mesh ≤ N · lần vẽ ≤ N".

---

## 5. ĐỘ BỀN PIPELINE ETL (máy trạm → GAS → Sheet)

- Đường ghi Sheet có ≥2 nguồn gọi (task theo lịch + guard + poller) → **`LockService.waitLock`**
  quanh cụm clearContents+setValues.
- Ghi/in có thử lại → **nonce sinh NGOÀI vòng thử** (nonce trong vòng for = in đôi tem đã xảy ra).
  Gọi GAS từ node dùng `gasPost` (nonce + thử lại phân chặng — vá 404 hop-2), cấm `fetch` trần
  1 phát rồi báo "thất bại" giả.
- Vòng kéo nhiều trang trong GAS → **ngân sách thời gian** (`Date.now()-t0 > 240000 → break`,
  trần GAS 6' — chạm trần là mất trắng lượt).
- **Heartbeat phải mang số bước hỏng** — cụm fail toàn phần mà nhịp tim vẫn xanh là mù hoàn toàn.
  Cầu dao dừng-chờ-người phải đẩy trạng thái lên dashboard/Telegram, không dừng câm
  (kênh thư đang TẮT — đừng dựa vào thư).
- Đường ghi chính có URL dự phòng (`APPSCRIPT_URL_DUPHONG` — deployment thứ 2 cùng project).
- Đừng tin doc lịch chạy — `LICH-VA-DU-PHONG.md` là nguồn duy nhất, sửa lịch thì sửa doc cùng commit.
- **Edge/Chrome ngầm (puppeteer) KHÔNG được mở hồ sơ trống chưa vá** — Chromium thử đăng nhập Windows bằng mật khẩu rỗng
  ở mỗi hồ sơ mới → 1 lần sai/lượt → khoá tài khoản lechitam (10 sai/10 phút). Đã vá tập trung ở puppeteer-core bằng
  `va-puppeteer-ho-so.mjs` (tự chạy qua `postinstall`). Thêm thư viện trình duyệt mới (playwright, puppeteer bản khác,
  thư mục node_modules mới) thì phải vá theo cùng cách rồi chạy `node va-puppeteer-ho-so.mjs --kiem` = 0 còn thiếu.

---

## 6. UI/UX — TÍNH ĐỒNG BỘ + HIỂN THỊ ĐIỆN THOẠI

**Đồng bộ (cấm control trần):**
- **`:disabled` của Alpine phải ÉP BOOLEAN `!!(…)` (17/09/2026):** Alpine chỉ GỠ thuộc tính boolean khi giá trị là
  `null/undefined/false`; giá trị là CHUỖI RỖNG `` (rất hay gặp vì cờ trạng thái hay là chuỗi, ví dụ `dangTaiBC`)
  thì nó set `disabled="disabled"` và nút CHẾT CỨNG, chạm không có phản hồi. Nút "đã xong/đã thêm" thì đừng dùng
  `disabled` — làm mờ bằng class và chặn trong chính hàm xử lý, để cú chạm vẫn tới nơi.
- **BỘ LỌC NGÀY CHUẨN (19/10/2026 — user: «dùng bộ lọc ngày ở Hạng mục 5S / Planogram làm chuẩn cho toàn dự án, cả Retail và
  Factory, cả web và điện thoại; tương lai có bộ lọc ngày thì thiết kế như vậy»):** MỌI chỗ chọn ngày / khoảng ngày = 1 bản của
  `taoBoLocNgay(o)` trong `kiemsoatkho/bo-loc-ngay.js` + `.css` (NGUỒN DUY NHẤT; `factory/bo-loc-ngay.*` là bản CHÉP Y HỆT — sửa bản
  gốc rồi chép). Mặt chuẩn: nút `.date-btn` hiện khoảng đang lọc → lịch 2 tháng (popIn) / điện thoại tấm trượt đáy 1 tháng (sheetIn),
  hàng nút nhanh, chạm 1 = bắt đầu, chạm 2 = kết thúc, ‹ Trước / Sau ›, Xoá / Áp dụng. Tuỳ biến CHỈ qua tham số: `presets` +
  `tinhPreset` (nút nhanh, kể cả tính TỚI như +7 ngày), `coDuLieu` (chấm ngày có dữ liệu), `chanNgay`, `motNgay` (chọn 1 ngày —
  Plan date), `khongRong`/`macDinh`, `nhan`/`nhanChon`, `homNay` (giờ VN). Được chỉnh CỠ NÚT cho bằng ô lọc cạnh bên (như
  `#hpWhBar .hp-ngayloc .date-btn`); KHÔNG đổi lịch. **CẤM** `<input type=date>`, thư viện lịch ngoài, menu "Hôm nay/7 ngày" kiểu
  danh sách, lưới `dp-day` tự dựng. Bộ lọc ngày đặt trong `<div>`, KHÔNG bọc trong `<label>` (label chuyển cú bấm trong lịch về nút
  → lịch tự đóng). Lịch nằm trong khung tự cắt / pop-up cố định thì khuôn tự dời ra `<body>` (`.dp-noi`, chân ghim đáy) — đừng tự định
  vị. QC: `qc-bo-loc-ngay.mjs` (bộ lọc ngày mới → thêm 1 dòng vào `DS`).
- Dropdown/bộ lọc → khuôn `.combo`+`.combo-menu` (popIn); animation chỉ dùng bộ sẵn có
  (`fadeUp/paneIn/popIn/sheetIn/menuIn`, easing `--ez-apple`/`--ez-spring`); modal `sheetIn`+blur;
  focus ring `--accent` + box-shadow 3px color-mix.
- Màu qua CSS variables theo theme, không hardcode (trừ palette chart đã định).
- **CẤM icon emoji** — nút chỉ dùng CHỮ; được phép ✓ ✗ ✕ ⚠ → ↗ ↑↓ và nét vẽ trong SVG minh hoạ.
- Trước khi thêm UI mới: grep tìm pattern tương đương đã có, tái dùng class — không viết bản sao.
- **Tay nắm / điểm kéo trong cảnh 3D hoặc sơ đồ (07/10/2026):** cỡ phải tính theo PIXEL màn hình (≥ 8 px bán kính, co giãn theo
  khoảng cách camera), bắt chọn theo khoảng cách pixel (≤ 16 px) chứ không bằng tia cắt hình; rê tới thì đổi con trỏ. Rút từ
  lienanh-3d: chấm 0,28 m ≈ 5 px khi nhìn toàn kho → user "không phóng to thu nhỏ khu được" dù bộ đo (bấm đúng tâm) vẫn đạt.
  Bộ đo phải có ca bấm LỆCH tâm.
- Cùng 1 chức năng ở nhiều tab → cùng nhãn + cùng tooltip. Luật chỉ thi hành ở 1 dashboard thì
  dashboard kia lặng lẽ tái phát — áp CẢ HAI.
- **Chống giật animation cho phần tử căn giữa `translateX(-50%)` (10/09/2026):**
  Phần tử dùng `left: 50%; transform: translateX(-50%);` (như `#lbCaption`, `#lbCount`, tooltip, toast nổi)
  tuyệt đối không dùng keyframe animation ghi đè `transform` đơn lẻ (`scale(...)`, `translateY(...)`) vì sẽ
  làm mất `-50%` trục X trong lúc animation chạy, khiến phần tử dạt sang phải rồi giật ngược sang trái
  khi animation kết thúc. Bắt buộc dùng keyframe riêng mang đầy đủ `translate3d(-50%, ...)` ở mọi mốc 0% → 100%.
- **Chuẩn chip chú thích Lightbox trên điện thoại (10/09/2026):**
  Phải hạ chiều cao ($\le 40\text{px}$), padding dẹt ($\le 3\text{px}$ dọc), dán sát đáy ($\le 10\text{px}$),
  bo tròn dạng pill (`border-radius: 999px`), gộp mã vị trí và mô tả kệ lên dòng 1 dạng inline và người
  báo cáo ở dòng 2 để chip cực kỳ dẹt, không che khuất chi tiết chân ảnh.

**15 luật hiển thị điện thoại (chi tiết + 17 bẫy: memory `quy-chuan-hien-thi-dien-thoai`):**
1. Trang không kéo ngang; cuộn ngang chỉ trong khung tự khai `overflow-x:auto`.
2. Bảng nhiều cột → **`table.mbcard`** dùng chung (6 bước áp ở memory `qc-bo-cuc-dien-thoai`),
   không bóp cột, không tự chép bộ rule riêng.
3. Ô không mang tin (giá trị 0 lặp, "—", trường lặp tiêu đề pop-up) → ẩn hẳn (`mb-0`).
4. Không số mồ côi — nhãn `::before{content:attr(data-lb)}` nhắm theo CLASS, **cấm `nth-child`**.
5. Vùng chạm ≥40px và phải BẤM ĐƯỢC thật (hộp kiểm gốc không nới được bằng CSS — bắt chạm ở ô);
   nút đóng pop-up ≥44px.
6. Sàn cỡ chữ 10,5px cho mọi nhãn trên điện thoại — liệt kê tường minh theo selector, đừng quét rộng.
7. KHÔNG khối hướng dẫn thường trực trong UI → nút `i` tooltip (khuôn `.h2tip`/`TAB_TIP`/`tipMuc()`),
   văn bản thuần, gắn sát chính thứ nó nói tới; thao tác/link ở lại trên màn.
8. Bảng ≥5 cột không được trú trong khung cuộn ngang — miễn trừ phải TỰ KHAI `data-mb-cuon="<lý do>"`.
9. Đoạn văn dài kẹp dòng (`-webkit-line-clamp` + bấm trải); chỉ trường >160 ký tự mới thành ô bấm.
10. Cụm control răng cưa — thanh điều khiển không được tự ngắt thành ≥4 hàng lộn xộn hoặc cao >25% màn hình.
11. Tường chữ trong một ô — đoạn văn AI dài ≥180 ký tự phải kẹp dòng (`-webkit-line-clamp`) + nút mở rộng.
12. Ô chỉ có dấu gạch trong chế độ thẻ — ô chỉ chứa "—" phải ẩn hẳn để không sinh dòng rỗng.
13. **Chống rác tích lũy đầu màn hình (Cumulative Header Clutter - 10/09/2026):**
    - Không để nhiều tầng điều khiển, bộ lọc, chú giải thường trực và dải cảnh báo xếp chồng đẩy nội dung chính (sơ đồ/bảng) rơi khỏi màn hình đầu tiên.
    - Trần chiều cao tích lũy từ đỉnh tab tới nội dung chính trên điện thoại (≤430px) **không được vượt quá 130px** (hoặc >22% viewport).
    - **Nội dung chính gồm cả DẢI THẺ SỐ và danh sách việc cần làm** (28/09/2026): tab Vệ sinh mở đầu bằng thẻ Tiến độ + thẻ Cần xử lý (user duyệt đặt TRƯỚC sơ đồ) — đó là nội dung, không phải control/chú giải/dải cảnh báo. Bộ đo tính từ `#hpTop`.
    - Dải chú giải ≥4 mục **tuyệt đối không bung hàng tĩnh** trong tiêu đề; phải thu gọn vào nút popover con nhộng `Chú giải (N) ▾` hoặc thanh 1 hàng cuộn ngang.
    - Loại bỏ triệt để các nhãn rác ("Khu vực:", "Ngày:") làm tốn diện tích khi chip/lịch đã tự minh định ngữ cảnh.
    - Dải cảnh báo (Alert bar) phải nén dẹt siêu mỏng (≤26px, 1 hàng duy nhất).
14. **Gộp cột/trường ĐƠN TRỊ (14/09/2026 — người dùng bác bản lặp tên kho 8 lần):**
    - Cột nào mà MỌI dòng đang hiển thị đều cùng một giá trị thì nó không phân biệt được dòng nào với
      dòng nào ⇒ **ẩn cột, đưa giá trị lên tiêu đề/phụ đề** (áp cho CẢ bảng máy tính, không riêng thẻ).
    - Giá trị vừa ẩn **phải hiện lại ở một chỗ** — biến mất im lặng là mất dữ liệu.
    - Chỉ gộp cột LẶP ĐƯỢC (kho, vị trí, trạng thái, nhóm…). KHÔNG gộp UID/SKU/số lượng — đó là thứ
      người đọc dò từng dòng, trùng nhau chỉ là tình cờ.
    - Mẫu cài đặt: `tvtmDonTri()` + `tvtmAnCot()` trong mục Tồn tại vị trí (factory/index.html).
    - **12/10/2026 — user: "GHÉT NHẤT LÀ LẶP LẠI THÔNG TIN ĐÃ CÓ"** (pop-up "Bất thường tại kho WH - 170…" vẫn in cột Kho
      598 lần): luật này áp cho MỌI bảng/pop-up/thẻ, không chỉ bảng chính — tiêu đề, phụ đề, đường dẫn đầu trang, nhãn bộ lọc
      đã nói điều gì thì phần thân KHÔNG nhắc lại (cột, chip, câu mô tả, nhãn trong ô). Trước khi thêm chữ nào, tự hỏi: "chỗ
      nào trên cùng màn đã nói điều này chưa?". Đã nói → bỏ.
    - Audit Hasaki cài đặt TỰ ĐỘNG `anCotDonTri()` (kiemsoatkho/index.html) — theo dõi mọi bảng trong
      pop-up đang mở (host + module), cột Kho/Warehouse đơn trị thì ẩn, ghi giá trị lên tiêu đề nếu tiêu đề chưa có. Module mới
      không phải gọi gì; cột lặp được khác (vd Category khi lọc 1 ngành) thì thêm vào `COT_DON_TRI`.
15. **Một con số mới thì vào DẢI THẺ SỐ, đừng dựng thêm thanh điều khiển (14/09/2026):**
    - Cần theo dõi thêm một nhóm/chỉ số → thêm THẺ trong `.abntiles` (bấm thẻ = mở danh sách đã lọc).
    - CẤM thêm một thanh chip/bộ lọc mới ở đầu mục chỉ để hiện con số đó: nó ăn 32-72px đầu màn,
      đụng ngay luật 13, và người dùng đã bác đúng bản làm như vậy ("chip tào lao").
    - Nhãn phụ trong dòng: dùng MỘT ký hiệu (`⚠`) + tooltip, không dán nhãn chữ dài vào ô.

**Màn mới = phải vào bộ đo:** mọi tab/pop-up/panel-trong-tab/chế-độ-thứ-hai mới → thêm vào `man[]`
của `qc-mobile-toan-du-an.mjs` kèm `sanSangMan` bám CON SỐ THẬT (skeleton dùng chính class thật —
"đếm phần tử > 0" là bẫy).

---

## 7. BỘ QC — chạy cái gì, khi nào

| Bộ đo | Khi nào chạy |
|---|---|
| `qc-mobile-toan-du-an.mjs` (13 luật / 34 màn × 4 máy; `--file` `--may` `--trang` `--man=<regex tên màn>`) | MỌI lần sửa hiển thị của 2 dashboard — baseline trước, `--file` sau khi sửa, live sau khi kiểm dấu vết deploy |
| `qc-chu-thich.mjs` (26 ca, `--live`) | Sửa tooltip/chú thích, và làm ca CHẶN HỒI QUY (đoạn văn đầu màn + nhãn chỉ dẫn trong ngoặc) |
| `qc-lightbox-caption.mjs` (4 ca) | Sửa lightbox/ảnh báo cáo (kiểm tra đủ thông tin mã vị trí con + kệ + người báo cáo; chống giật animation tâm X cố định; chip di động dẹt ≤ 40px) |
| `qc-nhan-dien-sku.mjs` | Đụng lõi tab Nhận diện SKU |
| `qc-moc-lo-trinh.mjs` | So trước/sau lộ trình NDS (KHÔNG dùng `qc-loi-cu-moi` cho việc này) |
| `do-toc-do-tem.mjs` | Đụng tốc độ AI đọc tem |
| `qc-vesinh-muctieu.mjs` (≈34 ca × 4 máy; `--url` `--may=pc\|ip14\|ipse\|and`) | Mọi lần sửa tab Planogram › Vệ sinh — đo MỤC TIÊU chứ không chỉ luật bố cục: màn đầu có Tiến độ + Cần xử lý, các con số giữa các khối KHỚP nhau, xem ngày cũ ra đúng ngày, không chữ rác, sơ đồ vừa màn điện thoại, giả lập 25 khu |
| `qc-tvt-mobile.mjs` (18 ca) | Mẫu bộ đo SÂU cho 1 mục — mục mới có pop-up thì viết `qc-<mục>-mobile.mjs` theo mẫu này |
| `qc-nghiem-thu.mjs` (38 ca × 4 máy; `--khong-gui`) | Mọi lần sửa form Nghiệm thu checklist (`kiemsoatkho/nghiem-thu.html`) hoặc GAS `nt_*` — chạy trên bản nội bộ, ca GỬI ghi vào SHEET NHÁP qua `/api/nt-thu` của xem-noi-bo.mjs (GAS HEAD), sheet thật không bị ghi |
| `qc-lienanh-3d.mjs` (≈40 ca, `--url`) + `kiem-dxf-lienanh.mjs <tep.dxf>` (AutoCAD nền) | Mọi lần sửa công cụ bố trí kho Liên Anh (`lienanh-3d.html`, `lienanh-xuat.js`, `xem-noi-bo.mjs`); kiểm DXF sau mỗi lần đổi hàm xuất — AutoCAD từ chối DXF im lặng (05/10/2026: thiếu từ điển PlotStyleName) |
| `qc-bo-loc-ngay.mjs` (≈120 ca: mọi bộ lọc ngày × 1440/390; `--chi=regex`) | Thêm/sửa bất kỳ bộ lọc ngày nào, hoặc sửa `bo-loc-ngay.js/.css` — so CÙNG MẶT với ô Ngày Retail › Planogram, lịch trọn màn + bấm được Áp dụng, chạm chọn khoảng, lọc dữ liệu giữ đúng |
| `node --check` | Mọi file JS/MJS vừa sửa |

Nguyên tắc:
- **Phạm vi đo = phạm vi lời hứa.** Trước khi nói "sạch toàn bộ": đọc danh sách màn, tự hỏi —
  panel trong tab đã có chưa? pop-up mở bằng API module đã khai chưa? chế độ thứ hai của cùng
  panel đã đo chưa? Dòng "○ bỏ qua" ≠ đạt — truy tận gốc.
- Bộ đo truyền **HÀM THẬT** cho `page.evaluate` (chuỗi ăn mất `\`); `waitForFunction` bọc
  `"("+fn+")()"`; điều kiện "đã tải" bám con số thật; đo đúng thứ đang dùng để ẩn.
- **Đọc dữ liệu trong iframe Alpine/khung phản ứng (17/09/2026):** `page.evaluate` trả **Proxy phản ứng** (Alpine `$data`, Vue reactive) qua CDP
  thành `{}` — bộ đo phải CHÉP từng trường nguyên thuỷ ra object thường rồi mới trả về; trả proxy trần là "đỏ giả/xanh giả".
- **Bộ đo phải BẤM THẬT, không gọi hàm (17/09/2026):** ca đo tương tác chỉ được đi qua `.click()` của chính phần tử
  người dùng chạm. Gọi thẳng `dt.tickBC(0)` cho XANH GIẢ trong khi người dùng chạm mãi không được — nút mang
  `disabled` nên trình duyệt nuốt luôn sự kiện. Mỗi nút/ô bấm được phải có 1 ca "bấm được thật" (không `disabled`,
  `pointer-events` khác `none`, và trạng thái ĐỔI sau cú bấm).
- QC mới phải bắt được ít nhất 1 lỗi thật đã biết trước khi tin nó (bộ đo báo xanh trên màn
  skeleton là tai nạn đã xảy ra).
- **Bộ đo không được treo câm (07/09/2026):** mọi `page.evaluate`/chụp ảnh trong vòng đo phải có TRẦN thời gian
  (`coTran` 60s trong qc-mobile) và in rõ bước treo; trang đo phải có handler `dialog` (alert/confirm/prompt
  làm evaluate chờ vô hạn, CPU 0 — không phải vòng lặp). Bộ đo "đứng im 15 phút" ≠ đang đo.

---

## 8. ĐỀ XUẤT ĐÃ BÁC — đừng đề xuất lại (lý do đầy đủ trong memory `audit-toan-dien-2026-08-23`)

- `tq=select` cắt cột gviz ở consumer — phá thiết kế map-theo-label; muốn đóng PII thì chặn ở producer.
- Service worker **cache-first** — dùng network-first.
- Timeout 20s cho gọi GAS — dùng 45s.
- `-WakeToRun` cho task 2' — máy bị dựng 720 lần/ngày; task bật máy 06:50 đã lo.
- `git commit --amend` để gỡ bí mật ở commit không phải HEAD — phải rebase/soft-reset.
- Bỏ `pc_token` — là xoá tính năng; giữ và đóng TOFU.
- Tài khoản riêng cho tự động hoá — vướng ràng buộc "không xin IT", chờ user quyết.
- Bắt nhập PIN — bác vĩnh viễn (trừ ghi nhận 5S).

---

## 9. CÁCH CẬP NHẬT BỘ CHUẨN NÀY

- User nói "cập nhật rule…" / "ghi thêm luật…" → thêm rule vào ĐÚNG MỤC kèm ngày trong ngoặc,
  và ghi 1 dòng vào NHẬT KÝ RULE bên dưới.
- Rule mới ĐẢO NGƯỢC rule cũ → sửa tại chỗ + chú ngày đảo (user có tiền lệ đảo yêu cầu);
  không giữ 2 phiên bản đánh nhau trong cùng file.
- Bài học/bẫy chi tiết theo từng mảng vẫn ghi ở memory chuyên đề; file này giữ LUẬT, memory giữ
  BẰNG CHỨNG và bẫy.

## 10. LỊCH & YÊU CẦU PLANOGRAM BẢO DƯỠNG — tạo / cập nhật / chỉnh sửa (chốt 26/09/2026)

- **Thước đo duy nhất = bản gốc của user**: g-sheet kế hoạch bảo dưỡng, tab `BAO-DUONG-170` — mỗi dòng
  = 1 đầu việc × 1 TẦN SUẤT × các MÃ VỊ TRÍ. **Ưu tiên số 1: đúng tiêu chí · tần suất · tiêu chuẩn kiểm tra
  của hạng mục** — đứng trên việc giữ trạng thái "Đã duyệt" và trên việc gọn số lịch.
- **1 lịch = 1 tần suất tại 1 ô.** Việc khác tần suất KHÔNG ở chung lịch (cấm việc 3 tháng/tháng nằm trong
  lịch hằng ngày). Cùng tần suất thì gom chung 1 lịch được (1 hệ băng chuyền, nhiều thiết bị PCCC).
- **Thiết bị có việc ở nhiều tần suất** (vd bình chữa cháy: tuần = ngoại quan, tháng = cân + van) → có mặt
  ở MỖI lịch tương ứng, nội dung ảnh chỉ ghi việc của đúng tần suất đó (sinh từ đúng các dòng bản gốc).
- **Số ảnh tiêu chuẩn = số lượng thiết bị** tại ô: mỗi cái 1 ảnh, tên `<tên thiết bị> · i/n`. Tên ảnh là chỗ
  DUY NHẤT phân biệt đối tượng trong 1 yêu cầu.
- **App quét chỉ hiện theo MÃ VỊ TRÍ**: nhóm "Mô tả tầng" = Floor Description, dòng dưới mã = Bin Location
  Description; Display description KHÔNG hiện (đã kiểm màn "Xem thông tin"). Muốn tên đối tượng hiện ngay
  trên danh sách → đối tượng phải có mã vị trí riêng (import vị trí, tiền lệ `…-TD-HN-00` / `…-TD-TG-00`).
- **Cơ chế WMS**: nhịp lịch = nhịp BẢN KHAI của SKU; mỗi (vị trí, SKU) chỉ 1 bản khai ⇒ 1 SKU chỉ nằm ở 1
  lịch. Lịch tần suất thứ hai cần SKU khác "chở" (vd đầu dò + chuông chở lịch tháng PCCC) hoặc lịch theo Vị
  trí tạo tay trên giao diện (không SKU — tiền lệ cửa cuốn quý). Đối tượng không SKU, không có SKU chở ⇒
  báo user khai tài sản / tạo lịch Vị trí, KHÔNG nhét tạm vào lịch khác nhịp.
- **Quy đổi tần suất**: Hàng ngày = Daily · Hàng tuần = 1 thứ/tuần · Hàng tháng = 1 ngày/tháng ·
  3 tháng/lần = 1 ngày/tháng (WMS không có chu kỳ quý — ghi chú rõ, không coi là lệch).
- **Lịch Đã duyệt**: WMS cấm sửa ảnh ("Re-open or reject the schedule first") và không có đường gửi duyệt
  lại bằng API ⇒ DỪNG, báo user tự Re-open rồi mới chạy.
- **Mọi lần tạo/sửa**: sao lưu trước (công cụ tự lưu `_…-backup-<ô>-<giờ>.json`), chạy `--thu` trước khi ghi,
  và SAU KHI GHI chạy `.exports/_doi-soat-bao-duong-planogram.mjs --ghi` (cập nhật cột KHAI BÁO PLANOGRAM
  theo thực tế) + xem tab `THEO-DOI-PLANOGRAM`. Mục tiêu: 0 dòng lệch.

## 11. XÁC MINH B1 (WF591) — bộ quy tắc + cò canh + bằng chứng (chốt 01/10/2026)

- **NGUYÊN TẮC GỐC (user 05/10/2026, viết hoa):** MỌI cải tiến đều phát triển cho việc **chạy tự động hoàn toàn, không phụ thuộc AI**. Mỗi ca làm xong phải để lại luật/khuôn/vùng camera/script mà máy chạy được không cần Claude soi; bước còn cần AI ghi `tuDong:"chua"` + cách gỡ trong kinh-nghiem-xac-minh.json.

- **Mục tiêu:** bộ quy tắc xác minh ngày càng hoàn thiện, tiến tới cò canh B1 tự động hoàn toàn
  (tự chuyển B1.1 / dừng điều hướng / các trường hợp khác). **Ca nào nghi ngờ → ghi g-sheet để user quyết**,
  không tự quyết.
- **Nguồn luật DUY NHẤT** = `hasaki/quy-tac-xac-minh-b1.json` → hiện ở g-sheet tab `QUY TẮC XÁC MINH`
  (dựng bằng `sheet-b1-treo.py`). Máy CHỈ tự làm luật user duyệt «Cho máy tự làm» VÀ kết luận chắc (đúng 1 người);
  còn lại ghi «⚠ NGHI NGỜ — bạn quyết» ở tab `PHIẾU B1 TREO`.
- **Án lệ = bài kiểm tra:** mỗi ca user quyết lưu thành án lệ (`.exports/an-le-b1.json` + `anLe` trong bộ luật).
  Sửa/thêm luật xong phải chạy `node canh-b1.mjs --qc` ra đúng MỌI án lệ rồi mới chạy thật.
- **Cò canh** `canh-b1.mjs` (lỗi ngoài vệ sinh; vệ sinh hằng ngày để canh-b11 ⑤): danh sách phiếu từ tasks-cache
  (0 lượt), WMS transfer-bins **lọc `bin_in`** (KHÔNG dùng `keywords` — trả cả kho) 1 lượt/phiếu, cache vĩnh viễn,
  trần `--max`. Diễn tập mặc định; `--lam` mới ghi, trong cửa 07–18 T2–T7. Đóng B1 qua auto-complete-single-task,
  dừng phiếu theo khuôn canh-b11. Chưa lên lịch: user duyệt luật trên sheet trước.
- **Truy người chịu lỗi phải liệt kê ĐỦ mọi người cất/lấy trong cửa sổ** (lọc đúng theo ô), không dừng ở người
  đầu tiên khớp — 01/10 bỏ sót người đặt pallet gốc 19/08 khi kết luận "không ai khác" (phải đính chính).
- **QC bằng chứng (QC-01):** thay clip/ảnh/bình luận bằng chứng thì **xoá bản cũ** — mỗi phiếu chỉ còn 1 bình luận
  bằng chứng mới nhất; đăng bản mới → đọc lại thấy → mới xoá bản cũ. Ảnh B1 (PIC02) đã có thì công cụ đóng B1 GIỮ.
- **Clip camera (CAM-01):** quay tới điểm mấu chốt (tới lúc người đó rời đi / lệnh WMS xong); đoạn chỉ đi lại tua ×2,
  thao tác chính tốc độ thật, không bỏ thao tác; thêm clip đúng lúc chụp ảnh vi phạm; thử góc kề, chỉ dùng khi rõ hơn;
  chú thích phải khớp hình (soi khung trước khi viết "phía trước/sau", "thấy mặt"). Máy KHÔNG nhận diện mặt.
- **Tìm người từ VẬT (CAM-03, 01/10/2026 — user chốt khi xem clip 13389950 "vẫn chưa hiểu"):** thứ tự BẮT BUỘC:
  ① mở **ảnh ghi nhận vi phạm** (IMA00) → nhận đúng ĐỒ VẬT vi phạm (vd thùng rỗng) → tìm nó trên camera ở ô đó,
  so các góc kề, **luôn chọn góc thấy rõ nhất**; ② lùi thời gian TRƯỚC giờ ghi nhận, tìm **ai tác động đồ vật gần nhất**,
  gồm cả tác động VẬT LÝ (chạm, vô tình đụng…) lẫn HỆ THỐNG (WMS cất/soạn ở ô, theo phút); ③ đối chiếu **ảnh cổng bảo vệ**
  (`/hr/history-location`) để biết hình dáng/trang phục NV hôm đó, ngày ghi nhận không có ảnh thì lùi các ngày trước —
  ảnh cổng CHỈ để máy/người xác minh đối chiếu, **KHÔNG đính kèm lên phiếu/bình luận** (user 01/10: "KHÔNG KÈM ẢNH BẢO VỆ");
  ④ camera + WMS + ảnh cổng KHỚP thì mới đặt nghi ngờ và cắt clip đúng đoạn tác động (đoạn giữa không quan trọng tua ×2,
  khung bám sát đối tượng di chuyển). Không khớp đủ thì ghi "nghi ngờ, user quyết", không kết luận.
- **Khung bám người (CAM-02, 01/10/2026):** khung đỏ khoanh người cần xác minh PHẢI chạy theo người (khung đứng
  yên 1 chỗ = không biết cần xem ai). `_clip-chu-thich.mjs` bám mặc định (dò "người" COCO-SSD, KHÔNG nhận mặt):
  nét liền = đang thấy, nét đứt = tạm khuất. Dựng xong PHẢI soi ≥8 khung kiểm; khung nào lạc sang đồ vật
  phải sửa rồi mới gắn lên phiếu.

- **Sửa/thêm luật phải nêu KHÁC LUẬT CŨ (02/10/2026):** mỗi luật sửa/thêm có trường `khacCu` = khác luật cũ ở đâu + bối cảnh
  (án lệ, số phiếu, kết quả chạy thử) → hiện ở cột cuối tab QUY TẮC XÁC MINH để user duyệt (user: "cần nêu điểm khác gì với luật
  cũ/bối cảnh như nào khi sửa để t duyệt"). Án lệ 151 phiếu đã chốt B3: `.exports/an-le-b3.json` (`_gom-an-le-b3.cjs`).

- **Bãi xe NCC/bảo vệ (BX-01, 02/10/2026):** `canh-bai-xe.mjs` chạy mỗi ngày (task 10:15 + 14:45) — CHỈ chụp + gợi ý ứng viên
  (chấm công −3…+6', sổ cổng −1…+10') vào `Videos/5S-bang-chung/bai-xe/<ngày>/BAO-CAO.html` (ngoài repo, có mặt người); user quyết và
  nhận diện, máy KHÔNG lập phiếu. Bẫy đã gặp: trang 404 làm canvas bị khoá (phải phục vụ trang trắng cùng nguồn); đường dẫn có dấu cách
  phải dùng fileURLToPath; camera ngoài trời cần ngưỡng riêng; schtasks qua Git Bash làm hỏng dấu ngoặc kép → tạo task bằng PowerShell.
  **Quyết định trên g-sheet (02/10):** sheet riêng BÃI XE NCC (`sheet-bai-xe.py`, ảnh nhúng 900 px + link ảnh gốc Drive riêng) → task 30' `bai-xe-phieu.mjs` lập phiếu + B1.1. Clip tự động: khung đỏ bám người CHỈ trong khoảng CÓ CHUYỂN ĐỘNG (so khung 3 s trước/sau — so với đầu/cuối đoạn làm nhiều xe nối tiếp thành 1 khoảng 5'), đệm −4/+10 s, nối khi cách <30 s, khúc còn lại tua ×3; soi 12 khung trước khi tin.

- **Vệ sinh quầy kệ CÓ BÁO CÁO (VS-06 · VS-07, user 07/10/2026):** kho rất bụi → **cửa sổ 8 giờ** tính lùi từ giờ ghi nhận (09:17 06/10 → mốc 01:17 06/10).
  Báo cáo gần nhất của phụ trách TRƯỚC mốc → **KHÔNG chuyển B1.1**, bình luận tag anh Tâm «Nhờ anh Tâm kiểm tra thực tế vị trí này» (1 lần/phiếu), phiếu ở lại B1.
  Báo cáo TRONG 8 giờ → `camera-bao-cao.mjs` tra camera **đúng giờ nộp báo cáo** (đếm NGƯỜI trong vùng kệ bằng mô hình `_nguoi-trong-vung.mjs`, không nhận mặt; vùng kệ lấy từ `ban-do-camera-o.json` «<kệ>|ke», tự tìm bằng điểm ảnh chỉ để gợi ý — vùng tự tìm từng trúng pallet lối đi):
  NV chỉ ghé ≤60 s = «chỉ chụp» → **bằng chứng B1 = ảnh 3 mốc (PIC02) + clip chuẩn (video02) từ camera, KHÔNG còn chép ảnh vi phạm** → đóng B1 → B1.1;
  có mặt ≥180 s / không rõ / không có góc → nhờ anh Tâm (kèm số phút). **Tự đóng theo «chỉ chụp» đang TẮT** (`B11_CAM_TU_DONG=0`, bật khi ≥3 án lệ camera đúng VÀ vùng kệ đã người kiểm `daKiem`) — trước đó mọi kết luận đều nhờ anh Tâm. `push-5s` không tự đóng B1 ca có báo cáo nữa; ca KHÔNG báo cáo giữ VS-02.
  Ngưỡng 60/180 s (v3 07/10, xét TỔNG giây có người; bản đầu 90/240) (ca 14079520: 226 s) — chỉnh theo án lệ. Bằng chứng gắn lên phiếu luôn là clip chuẩn `_clip-noi` (CAM-06), video gốc giữ tới B3.
  **Đường KHÔNG AI (08/10/2026, user: «gán camera mà không thông qua AI»):** `camera-bao-cao.mjs --khong-ai --clip` — không mô hình, không so điểm ảnh, không kết luận.
  Chỉ dùng 3 dữ liệu cố định: ô → kênh (bản đồ tên kênh) · giờ nộp báo cáo (planogram) · vùng MẶT KỆ đã người kiểm (`ban-do-camera-o.json` «<kệ>|ke» `daKiem`).
  Ra: ảnh 3 mốc giờ cố định (−6′ · −3′ · lúc nộp, khung vàng vùng kệ) + clip `*_BAOCAO_CLIP-CAMERA.webm` ([đầu cửa sổ → nộp −90 s] tua ×5 + [nộp −90 s → +30 s] tốc độ thật; không khung đỏ, không dán tên lên người — chỉ ghi «tài khoản … nộp báo cáo»).
  `canh-b11` với `B11_CAM_KHONG_AI=1` → thay PIC02/video02 của B1 bằng ảnh/clip này (Hình ảnh bằng chứng = camera, đúng yêu cầu 07/10), phiếu Ở LẠI B1, bình luận nhờ anh Tâm xem clip; máy KHÔNG đóng B1.
  Phần máy KHÔNG làm được nếu không có mô hình/người: (1) khung đỏ bám đúng người + tên; (2) kết luận «chỉ chụp»/«có thao tác». Vùng kệ chưa `daKiem` → vẫn cắt clip nhưng không vẽ khung, chú thích nói rõ; soi lưới 80 px 1 lần/tủ để bổ sung bản đồ (việc người, không phải AI).
  **Đường GEMINI (08/10/2026, user: «2 mục này dùng Gemini chạy được không — dạy cho Gemini chạy»):** `camera-bao-cao.mjs --gemini --clip` → `_gemini-nguoi-vung.mjs`: Gemini (khoá `GEMINI_API_KEY` bậc miễn phí, chuỗi model dự phòng như `sync-vesinh-ai`) đọc **lô 8 khung/5 s** có khung vàng → từng khung: bbox người (0–1000 → px), quần áo, trong/sát khung vàng, **hành động** `ve-sinh · sap-xep-hang · chup-anh · dung-yen · di-lai`; mã người nối giữa lô bằng tâm bbox ≤220 px + chữ quần áo (tất định). Không gửi tên NV, không nhận diện danh tính.
  Người chính = nhiều khung tại kệ nhất (ưu tiên có mặt ±60 s quanh giờ nộp) → **kết luận theo giây hành động**: lau ≥30 s «co-ve-sinh» · không lau & có mặt ≤60 s «chi-chup» · xếp hàng ≥60 s «co-thao-tac» · còn lại «khong-ro» (ngưỡng `CAM_GM_VESINH_GIAY/SAPXEP_GIAY`). Khung đỏ clip = bbox Gemini nội suy (`chiNeo`), chỉ dựng khi bám nhất quán ≥0,85 (`CAM_GM_NHAT_QUAN`) và ≥6 khung; **nhãn tên NV chỉ khi định danh được** (người chính có mặt ±60 s quanh giờ nộp VÀ không ai khác tại kệ lúc đó), không thì «Người tại kệ».
  `canh-b11` cổng `B11_CAM_AI=gemini` (`khong` = đường không AI; trống = mô hình COCO): gắn ảnh/clip vào B1 + nhờ anh Tâm như đường không AI; «chi-chup» + `B11_CAM_TU_DONG=1` mới đóng B1. Gemini hỏng (quota ngày/mạng) → tự rơi về đường không AI. Bẫy: hộp cát Claude Code chặn Google (curl google.com timeout) — thử Gemini phải chạy ngoài hộp cát; `gemini-3.5-flash` hết quota ngày vì `sync-vesinh-ai` → flash-lite ~9 s/lô.
- **BẢN ĐỒ TỰ CHUYỂN B1 → B1.1 (19/10): `hasaki/LUAT-TU-CHUYEN-B11.md`** — 3 cửa, nhóm lỗi → máy nào lo, cách tra 1 phiếu.
- **SỔ TAY CHI TIẾT (09/10): `hasaki/SO-TAY-XAC-MINH-CAMERA.md`** — góc cam, vùng, khung vật/khung người, định danh, clip, máy tự bắt, cách hỏi AI. Gemini agy đọc qua skill `.agents/skills/xac-minh-camera-5s`.
- **Quy trình từng bước: `hasaki/SOP-XAC-MINH-CAMERA.md`** (3 nguyên tắc gốc + bảng tự kiểm 7 câu). Đọc TRƯỚC mỗi lần xác minh bằng camera.
- **Bài học 13389950 + 14010729 (02/10/2026 — user đính chính 2 lần):**
  - **CAM-05 thùng gốc + quy cách:** trước khi kết luận "lấy hết thùng" phải xác định thùng có phải THÙNG GỐC của SKU
    (logo, nhãn EA trên thùng gốc cùng pallet/ảnh ghi nhận). Thùng trơn/thùng lẻ → KHÔNG suy số còn lại từ WMS, soi camera
    TỪNG lần có người thò tay vào thùng. 01/10 suy "Như lấy 6 = hết" ⇒ sai; thực tế Hương 09:50 + Oanh 09:51 còn lấy.
  - **Camera chỉ được XÁC NHẬN hoặc BÁC luật hệ thống bằng chứng thấy rõ, không được "đoán đè":** SH-01(a) "người soạn
    cuối SKU tại ô" vốn ra Oanh = đúng; lần xác minh camera 01/10 đổi sang Như mà không thấy được lòng thùng ⇒ sai.
    Camera không thấy rõ → giữ kết luận hệ thống + ghi "camera không bác được".
  - **CAM-06 clip nối 1 mạch** từ lần tác động nghi ngờ → lúc chụp ảnh (`_clip-noi.mjs`): khung VÀNG đứng yên = đồ vật,
    khung ĐỎ nét đứt bám người + nhãn tài khoản (đúng theo code `_clip-noi.mjs`; sửa 09/10); mỗi người lại gần đồ vật = 1 mốc tốc độ thật, chú thích phải soi TỪNG GIÂY
    (09:41 suýt ghi "đi ngang" khi NV đang lấy hàng; 09:50 ghi Hương lấy "trên nóc" — user bác: lấy trong thùng).
  - **Khung bám người trên camera mắt cá/nhìn từ trên:** mô hình chỉ dò ra 0–40 % khung → dự phòng bám vùng CHUYỂN ĐỘNG
    lọc theo MÀU ÁO (không lọc màu thì trôi sang xe pallet đang kéo) + **điểm neo** người soi tay mỗi 3–6 s ở đoạn khó.
    Dựng xong soi ≥12 khung; khung nào lệch người thì thêm neo rồi dựng lại.
  - **NV-01 định danh khi không có lệnh WMS:** chấm công đúng phút (bộ phận theo màu đồng phục) → camera SAU vi phạm (còn làm
    hay đã rời khu ⇒ ca sáng/chiều, khớp giờ chấm ra) → ảnh cổng gần nhất ≤10 ngày (dáng, tóc, quần, dép — KHÔNG so mặt).
    Sổ cổng có thể TRỐNG cả ngày (01/10 bảo vệ không chụp) → lùi ngày. Còn ≥2 người → gửi user ảnh so sánh nội bộ.
  - **Từ ngữ (TU-01):** "châm hàng" (không dùng "cất"); "không ai tác động thùng" (không dùng "không ai lấy hàng ở thùng");
    tên trên clip = tài khoản WMS.
  - **Tải file lớn lên wshr:** fetch của Node tự ngắt sau 300 s chờ phản hồi (clip >25 MB server xử lý lâu) → gửi bằng
    https thuần (`_tao-phieu-5s.mjs`, `_thay-file-phieu.mjs`, `_thay-bang-chung-b1.mjs`); lỗi quá giờ → KIỂM phiếu đã
    tạo chưa trước khi gửi lại (tránh trùng).

## NHẬT KÝ RULE

- **19/10/2026** — Mục 6: BỘ LỌC NGÀY CHUẨN toàn dự án = `taoBoLocNgay` tách khỏi kiemsoatkho/index.html thành `bo-loc-ngay.js/.css`
  (bản chép ở factory). Đổi theo chuẩn: Retail › Xác minh (Theo máy, Nhật ký), Kiểm kê › Dự báo, Tạo lệnh kiểm kê (Plan date), tab
  Kiểm kê Factory cũ; Factory › Planogram, Kiểm kê (Ngày kiểm), Dự báo, Tạo lệnh (Plan date). QC `qc-bo-loc-ngay.mjs` 122/122.

- **12/10/2026** — Mục 6 luật 14: mở rộng thành luật CHUNG "không lặp lại thông tin đã có" (user: "ghét nhất là lặp lại") + bộ tự động `anCotDonTri()` cho bảng trong pop-up.
- **12/10/2026** — Mục 11 (xác minh B1): pop-up phiếu có khối «Ai tác động ô … trước giờ ghi nhận»: phụ trách kệ + MỌI lượt châm vào ô
  (WMS, `.cache-canh-b1.json`, 0 lượt gọi thêm), GẦN GIỜ GHI NHẬN NHẤT TRƯỚC, mỗi lượt 1 clip (`tim-bang-chung-b1.mjs` → `lanKho`, ≤24 lượt/lần chạy).
  MỐC CLIP = giờ TẠO lệnh (created_at), KHÔNG phải giờ hoàn tất: kiểm 13808708 kênh 31 — 15:10 tạo lệnh có 3 người đang châm ô 07,
  15:27 hoàn tất thì dãy trống. Chiều «lấy ra» không có trong transfer-bins (bin_out trả 0) — phải qua API soạn hàng (47–54 lượt/phiếu), chưa làm.
  QC: `qc-ls-kho-popup.mjs`.

- **12/10/2026** — Mục 1/2: SỔ TÁC GIẢ. Mọi bộ ghi lên work.hasaki.vn dùng tài khoản user nên phiếu đều đứng tên user ⇒
  `so-tac-gia.mjs` (nạp sẵn qua `token-store.js`) bọc `fetch`, mỗi lượt POST/PUT/DELETE tới wshr/work ghi 1 dòng vào
  `.exports/so-tac-gia/<YYYY-MM>.jsonl` (bộ nào · gọi từ bộ nào · Claude/tay/lịch nền · máy · phiếu · nội dung · tên + mã băm ảnh).
  KHÔNG ghi lên phiếu, KHÔNG lên git; xem ở tab Xác minh › «Máy đã làm gì» (chỉ máy có 8591) + dòng «Phiếu do … tạo» ở Theo phiếu.
  Bộ MỚI ghi lên wshr phải nạp `token-store.js` (hoặc `import "./so-tac-gia.mjs"`) và thêm tên dễ đọc vào `TEN_BO`.
  Gói mang sang máy khác có chép `token-store.js` thì phải chép kèm `so-tac-gia.mjs`. QC: `qc-so-tac-gia.mjs` (giả fetch) + `qc-so-tac-gia-ui.mjs` (3 máy, chặn ghi).
  NGƯỜI GỬI FORM 5S (cùng ngày, GAS @106 + form.html 3bee107): form gửi kèm `tb` (mã máy OTP) + `hsk-nguoi-dung` nếu có;
  GAS `ghiNguoiGui_` ghi vào FILE RIÊNG «5S-NGUOI-GUI (riêng tư — không chia sẻ)» (id ở Script Properties NGUOI_GUI_SHEET),
  CẤM ghi vào WMS-5S-AUDIT (anyone:reader); mã máy chỉ lưu 10 ký tự. `pending` trả `nguoiGui` → push-5s đặt
  `globalThis.__HSK_NGUOI_THAT` → sổ tác giả. QC: `qc-nguoi-gui-5s.mjs` (mã GAS thật + sân giả).

- **10/10/2026** — Mục 5: Edge ngầm làm khoá tài khoản Windows (277 lần sai + 26 lần khoá ngày 09/10, nguồn = msedge.exe
  do node mở, Security 4625 mật khẩu rỗng). Vá `va-puppeteer-ho-so.mjs` ghi sẵn `Local State` (os_password_blank) vào hồ sơ tạm;
  đo: hồ sơ trống +1 lần sai, sau vá +0.

- **07/10/2026** — Mục 4: ngân sách lần vẽ + cách tối ưu trang 3D (đo GPU thật trước, bóng theo nhu cầu, instance, gộp mesh,
  render target); Mục 6: tay nắm/điểm kéo tính theo pixel + bắt lệch tâm + con trỏ — rút từ lienanh-3d "bị giật" (4 510 → 736
  mesh, 15–19 → 60 khung/giây) và "không nới/thu khu được" (chấm 5 px).

- **08/10/2026** — Mục 7 — LUẬT CỨNG (sự cố mất bố trí Liên Anh): BỘ ĐO / TRANG THỬ KHÔNG BAO GIỜ ĐƯỢC GHI VÀO DỮ LIỆU THẬT. Trang tự lưu 0,7 s sau khi tải; QC cũ chỉ chặn TẢI tệp bố cục còn lệnh GHI chỉ giả lập sau khi trang dựng xong ⇒ các lượt QC/thử ghi trạng thái GỐC đè lên bố trí user nhiều lần trong ngày. Bắt buộc: (1) chặn mọi POST/PUT tới API ghi ở TẦNG MẠNG (request interception) ngay khi mở trang, mọi trang, kể cả chế độ dùng dữ liệu thật; (2) ca QC cuối so vân tay (kích thước + giờ sửa) tệp dữ liệu thật trước/sau lượt chạy — đổi là LỖI; (3) máy chủ sao lưu tệp dữ liệu trước khi ghi đè (≥ 10' một bản + ngay khi lần ghi làm giảm dữ liệu), không bao giờ chỉ 1 bản. Kèm: `git restore`/`git checkout -- <tệp>` KHÔNG lấy lại dữ liệu gitignore mà chỉ xoá code chưa commit — đã làm mất 1 ngày code html Liên Anh 08/10 (khôi phục từ bản sao lưu nháp).
- **08/10/2026** — Mục 6 (UI công cụ 3D trên máy tính): bảng điều khiển KHÔNG đặt thành cột dọc to bên phải; chuẩn là THANH TRÌNH ĐƠN 1 hàng trên cùng kiểu Excel/AutoCAD cổ điển (Tệp · Sửa · Chèn · Xem · Bố cục · Trợ giúp, mỗi mục thả xuống hàng dọc có phím tắt, ✓ cho mục đang bật; rê chuột đổi trình đơn; chọn mục thì đóng; Esc/bấm canvas đóng), chế độ (Bước 1/2) + dòng trạng thái nằm ngay trên thanh; danh sách dài = bảng thả xuống neo dưới nút; thuộc tính món = khung nhỏ bên phải chỉ hiện khi có chọn; thanh dưới + bản đồ nhỏ ẩn (user 08/10: "bỏ bản đồ nhỏ", "tạm ẩn dòng Kho Liên Anh…"). Bẫy kỹ thuật: (1) `#sua>*{flex:none}` (id) thắng mọi `.lop{flex:…}` ⇒ muốn 1 nhóm giãn phải viết `#sua>.lop`; (2) `backdrop-filter` trên thanh biến nó thành khối chứa của con `position:fixed` ⇒ bảng thả xuống bị kẹt trong thanh — bỏ backdrop-filter; (3) chiều cao thanh đổi theo bề rộng ⇒ ghi `--suaCao` bằng ResizeObserver cho mọi thứ neo dưới thanh và nới khung nhìn (nhinThang) theo nó.
- **08/10/2026** — Mục 4 (3D): LUẬT kéo/dịch bản đồ (pan) và phóng theo con trỏ: điểm sàn dưới con trỏ phải đo bằng camera ở TRẠNG THÁI GỐC của thao tác (đặt target về t0 + apply + updateMatrixWorld rồi mới raycast), KHÔNG đo bằng camera đã dời — đo bằng camera đã dời là vòng hồi tiếp: mỗi khung bù ngược nửa quãng ⇒ mô hình giật liên tục (Liên Anh 08/10, user báo). Áp cho cả chuột lẫn chạm. Mục 6 (UI): thao tác kéo giãn/thu/dời món trong công cụ 3D phải có nhãn kích thước nổi ngay trên món (số đang đổi in đậm, tự ẩn 1,5 s) — dòng trạng thái ở bảng không đủ vì mắt đang nhìn vào món.
- **08/10/2026** — Mục 7 (QC 3D Liên Anh, học từ 3 lượt rớt oan): (1) hoàn tác trong bộ đo theo ĐỘ SÂU (`window.__sua.luiSo` ghi trước khối, lùi tới khi bằng), không đếm cứng số bước — đếm sai 1 là kéo cả mặt bằng về khay, ca sau rớt dây chuyền; (2) `datBuoc(2)` bay camera vào khu nhưng `datBuoc(1)` KHÔNG bay về ⇒ sau mỗi khối phải trả `CAM.nhinThang` toàn kho + `choCam()`, nếu không điểm chiếu rơi ngoài canvas, kéo chuột trật hết; (3) tay nắm bắt trong 16 px mà tầm toàn kho chỉ ~12 px/m ⇒ thân món 3 m nằm trọn trong vùng chấm, muốn kéo thân phải phóng camera vào trước (người dùng cũng vậy); (4) bộ đo in kết quả tích luỹ khi dừng giữa chừng (`unhandledRejection`) + `QC_LUI=1` in dấu vết độ sâu lùi/số khu đặt ở các mốc — không có 2 thứ này thì 3 lượt chỉ thấy 1 dòng lỗi.
- **09/10/2026** — Mục 11: sổ tay `SO-TAY-XAC-MINH-CAMERA.md` + skill/luật agy (`.agents/skills/xac-minh-camera-5s`, `.agents/rules/xac-minh-5s.md`, GEMINI.md mục 5) để Gemini agy xác minh đúng thứ tự như Claude. Sửa 3 chỗ lệch code: màu khung CAM-06 (vàng = vật, đỏ = người), ngưỡng VS-07 60/180 s, BX-01 mẫu 15 s/3 lượt. Đường Gemini trong script giữ TẮT (bài học 7 mã cho 1 người).
- **08/10/2026** — Mục 11: đường GEMINI cho 2 việc còn thiếu của camera giờ báo cáo (khung đỏ bám đúng người + kết luận có vệ sinh thật không): `camera-bao-cao.mjs --gemini` + `_gemini-nguoi-vung.mjs`, cổng `B11_CAM_AI=gemini` (mặc định trống). Thăm dò 14079520: 8 khung 13:10–13:13 bám đúng 1 người áo xanh tại kệ, hành động xếp hàng/chụp ảnh.
- **08/10/2026** — Mục 11: đường KHÔNG AI cho camera giờ báo cáo (`camera-bao-cao.mjs --khong-ai`, cổng `B11_CAM_KHONG_AI` mặc định 0): cắt đúng kênh + cửa sổ giờ nộp, khung vàng vùng kệ đã kiểm, không mô hình/không kết luận → gắn PIC02/video02 vào B1, không đóng B1, anh Tâm xem. Bản đồ thêm `daKiem` cho 505-08 (ch16) + 513-03 (ch38) từ clip tay 07/10 đã QC. Trả lời câu user «gán camera mà không thông qua AI được không?»: gán được; kết luận và khung bám người thì không.
- **07/10/2026** — Mục 11: VS-06 cửa sổ bụi 8 giờ (có báo cáo nhưng quá 8h trước ghi nhận → không B1.1, nhờ anh Tâm kiểm tra thực tế) + VS-07 camera đúng giờ nộp báo cáo (`camera-bao-cao.mjs`; bằng chứng B1 = camera thay ảnh vi phạm) — user chốt từ phiếu 14079520 («kho rất bụi nên thời gian ghi nhận ép xuống 8h»; «bổ sung camera ở mục Hình ảnh bằng chứng thay cho hình ảnh lấy từ Hình ảnh vi phạm»). Hồi tố 3 phiếu lô 06/10 trả về B1.

- **02/10/2026 (chiều)** — Mục 11: CAM-05 thùng gốc + quy cách, camera không được đoán đè luật hệ thống, CAM-06 clip nối
  (`_clip-noi.mjs` khung đỏ bám người + neo), NV-01 định danh không có WMS, TU-01 từ ngữ (user: "Hương lấy 1 chai trong
  thùng đó", "thay cất → châm hàng", "lấy → tác động", "sao k thấy vòng khoanh vùng người di chuyển", "sao k đối chiếu ảnh ra vào").

- **21/10/2026** — Giao diện đợt 2 (chuẩn hoá thanh bên + bảng khít màn hình + bộ lọc mobile):
  (1) **Khít màn hình không khoảng trống thừa**: `.table-wrap` mở rộng sát chân màn hình (`max-height: calc(100vh - 124px)` / `calc(100dvh - 124px)`), triệt tiêu khoảng trống đáy `72vh` cũ.
  (2) **Thanh bên phải Planogram (web)**: theo luật thứ tự chuẩn: Đóng · Yêu cầu #… ↗ · Ghi nhận 5S nằm bên trái; Tên kệ/vị trí & ngày nằm bên phải căn lề phải; ẩn mã task phụ `HSK-ZRJB61HN` (`#mTitle .vp-mt2`).
  (3) **Luật tự ẩn thanh bên trái**: khi thanh bên phải hiển thị (Vi phạm, Xác minh, Planogram) hoặc khi click chọn 1 mục bất kỳ ở thanh bên trái thì thanh bên trái tự động ẩn.
  (4) **Mặc định sau đăng nhập**: chuyển ngay về tab Tổng quan (`home`) ở cả Retail và Factory.
  (5) **Bộ lọc trên điện thoại**: các mục Tồn kho chính xác / Planogram ở Retail và Factory dùng nút hình chữ nhật `.btn-filter` (cao 28px, bo góc 6px, mũi tên xổ xuống) ở lề phải H2, vùng lọc mặc định gập (`collapsed`) và bung ra với animation `popIn`.
  (6) **Thu hẹp thanh bên trái mobile**: giảm từ 264px xuống 200px ôm khít nhãn và số đếm, không lãng phí khoảng trống.

- **02/10/2026** — Mục 11: luật sửa/thêm phải có `khacCu` (khác luật cũ + bối cảnh) để user duyệt; sổ luật gộp án lệ 151 phiếu B3 (XE-01, BX-01, CAM-04, CH-04 đề xuất; VS-03 giữ; SH-01 tách 3 dạng ảnh).

- **01/10/2026 (chiều)** — Mục 0 bước 6 "rà việc cũ sau mỗi thay đổi" (user: "mỗi khi có thay đổi mới thì cần xem
  lại các task cũ đã hoàn thành chưa, nếu đã hoàn thành rồi thì thôi còn chưa hoàn thành thì ghi đè… đảm bảo đúng
  việc/đúng mục đích"); mục 11 CAM-02 khung bám người (user: "khung cần di chuyển theo người").

- **01/10/2026** — Thêm mục 11 (xác minh B1): bộ luật JSON + tab QUY TẮC XÁC MINH có cột Bạn duyệt, cò `canh-b1.mjs`
  (nghi ngờ → sheet), án lệ làm bài kiểm tra, QC-01 xoá bằng chứng cũ (user: "sao k xoá cái cũ? quy tắc QC đâu"),
  luật liệt kê đủ người trong cửa sổ (rút từ lần bỏ sót minhplc ở phiếu 13393072).

- **28/09/2026** — Tab Vệ sinh thiết kế lại theo QC user duyệt ("tiện lợi · không mục rác · gọn"): (1) **mỗi con số
  chỉ có MỘT hàm đếm** dùng chung cho mọi khối (nvTheoNgay) — 3 khối từng ra 116/38/31 cho cùng câu hỏi; (2) **khối
  nào hiển thị theo ngày thì PHẢI theo ngày đang chọn**, tiêu đề ghi rõ ngày; (3) **danh sách khu/nhóm không viết
  cứng** — ≥3 mục thì thành nút chọn + bảng tổng quan, mục không có sơ đồ vẽ tay dùng lưới tự sinh theo mã;
  (4) luật ⑬: dải thẻ số + danh sách việc cần làm là NỘI DUNG CHÍNH; (5) bộ đo mới phải chạy thử trên bản CŨ
  và bắt được lỗi cũ trước khi tin (qc-vesinh-muctieu trên live cũ: 6 ca đỏ đúng lỗi QC).

- **26/09/2026** — Thêm mục 10 (lịch & yêu cầu planogram bảo dưỡng): rút từ đợt PCCC — bản gom 1 lịch/ô bị
  user bác ("t chỉ quan tâm là có đúng theo tiêu chí/tần suất/tiêu chuẩn kiểm tra ở hạng mục hay k"); đối
  soát cùng ngày cho thấy 303/461 cặp đầu việc × vị trí lệch tần suất do luật gom "1 hệ = 1 lịch" 19/09
  (luật đó nay chỉ còn đúng khi CÙNG tần suất).

- **17/09/2026** — Mục 6 + 7: `:disabled` Alpine phải ép boolean (chuỗi rỗng = nút chết) và bộ đo phải BẤM THẬT thay vì gọi hàm — rút từ lỗi người dùng bắt ở bộ chọn ảnh báo cáo ("k tick chọn ảnh ở đây được") mà bộ đo 60/60 vẫn báo xanh.

- **10/09/2026** — Mục 6 & 7: chống giật animation cho phần tử căn giữa `translateX(-50%)` (triệt tiêu lỗi nhảy từ phải sang trái của chip chú thích ảnh) + chuẩn chip Lightbox dẹt $\le 40\text{px}$ trên điện thoại.

- **14/09/2026** — Mục 6: thêm **luật 14 (gộp cột đơn trị)** và **luật 15 (con số mới vào dải thẻ số,
  cấm dựng thêm thanh điều khiển)** — rút từ lượt làm mục "Nghi tồn ảo": bản đầu dựng một thanh chip lọc
  riêng (người dùng bác: "chip tào lao") và để cột Kho lặp y hệt ở cả 8 dòng. QC tương ứng đã thêm:
  `qc-tvt.mjs` (cấm tvtLoaiBar/tvtChipBar/tvtSetLoai tái xuất hiện), `qc-tvt-live.mjs` (thẻ đếm đúng +
  cột đơn trị phải ẩn và giá trị phải nằm ở phụ đề), `qc-tvt-mobile.mjs` (ô bị gộp thì đòi tiêu đề/phụ đề).

- **07/09/2026** — Mục 7: bộ đo không được treo câm — trần 60s cho từng bước evaluate/chụp ảnh + handler dialog
  (rút từ lần qc-mobile đứng 15 phút sau màn "Kế hoạch chờ push" khi đo 2 màn mới của thẻ "Xác nhận lỗi còn treo").

- **23/08/2026** — Khởi tạo: tổng hợp từ Audit toàn diện 23/08 (5 mảng), rollout, bộ qc-*.mjs
  và các ràng buộc đã chốt (quy trình QC + bản nội bộ, không PIN, nhẹ tải upstream, không xin IT,
  đồng bộ UI, 9 luật điện thoại, phạm vi đo = phạm vi lời hứa).
