# BỘ CHUẨN PHÁT TRIỂN — áp cho MỌI chức năng/tool mới và mọi đợt cải tiến

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

**Không bắt nhập PIN** cho bất kỳ chức năng nào, NGOẠI TRỪ ghi nhận 5S. Bảo mật phải bằng
cách không gõ tay: khoá thiết bị cấp 1 lần qua link `#khoa=` → localStorage, quota server-side, nonce.

---

## 1. BẢO MẬT (cả 2 repo là PUBLIC — mọi file tracked là công khai Internet)

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

---

## 6. UI/UX — TÍNH ĐỒNG BỘ + HIỂN THỊ ĐIỆN THOẠI

**Đồng bộ (cấm control trần):**
- Dropdown/bộ lọc → khuôn `.combo`+`.combo-menu` (popIn); animation chỉ dùng bộ sẵn có
  (`fadeUp/paneIn/popIn/sheetIn/menuIn`, easing `--ez-apple`/`--ez-spring`); modal `sheetIn`+blur;
  focus ring `--accent` + box-shadow 3px color-mix.
- Màu qua CSS variables theo theme, không hardcode (trừ palette chart đã định).
- **CẤM icon emoji** — nút chỉ dùng CHỮ; được phép ✓ ✗ ✕ ⚠ → ↗ ↑↓ và nét vẽ trong SVG minh hoạ.
- Trước khi thêm UI mới: grep tìm pattern tương đương đã có, tái dùng class — không viết bản sao.
- Cùng 1 chức năng ở nhiều tab → cùng nhãn + cùng tooltip. Luật chỉ thi hành ở 1 dashboard thì
  dashboard kia lặng lẽ tái phát — áp CẢ HAI.

**9 luật hiển thị điện thoại (chi tiết + 17 bẫy: memory `quy-chuan-hien-thi-dien-thoai`):**
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

**Màn mới = phải vào bộ đo:** mọi tab/pop-up/panel-trong-tab/chế-độ-thứ-hai mới → thêm vào `man[]`
của `qc-mobile-toan-du-an.mjs` kèm `sanSangMan` bám CON SỐ THẬT (skeleton dùng chính class thật —
"đếm phần tử > 0" là bẫy).

---

## 7. BỘ QC — chạy cái gì, khi nào

| Bộ đo | Khi nào chạy |
|---|---|
| `qc-mobile-toan-du-an.mjs` (12 luật / 34 màn × 4 máy; `--file` `--may` `--trang`) | MỌI lần sửa hiển thị của 2 dashboard — baseline trước, `--file` sau khi sửa, live sau khi kiểm dấu vết deploy |
| `qc-chu-thich.mjs` (26 ca, `--live`) | Sửa tooltip/chú thích, và làm ca CHẶN HỒI QUY (đoạn văn đầu màn + nhãn chỉ dẫn trong ngoặc) |
| `qc-nhan-dien-sku.mjs` | Đụng lõi tab Nhận diện SKU |
| `qc-moc-lo-trinh.mjs` | So trước/sau lộ trình NDS (KHÔNG dùng `qc-loi-cu-moi` cho việc này) |
| `do-toc-do-tem.mjs` | Đụng tốc độ AI đọc tem |
| `qc-tvt-mobile.mjs` (18 ca) | Mẫu bộ đo SÂU cho 1 mục — mục mới có pop-up thì viết `qc-<mục>-mobile.mjs` theo mẫu này |
| `node --check` | Mọi file JS/MJS vừa sửa |

Nguyên tắc:
- **Phạm vi đo = phạm vi lời hứa.** Trước khi nói "sạch toàn bộ": đọc danh sách màn, tự hỏi —
  panel trong tab đã có chưa? pop-up mở bằng API module đã khai chưa? chế độ thứ hai của cùng
  panel đã đo chưa? Dòng "○ bỏ qua" ≠ đạt — truy tận gốc.
- Bộ đo truyền **HÀM THẬT** cho `page.evaluate` (chuỗi ăn mất `\`); `waitForFunction` bọc
  `"("+fn+")()"`; điều kiện "đã tải" bám con số thật; đo đúng thứ đang dùng để ẩn.
- QC mới phải bắt được ít nhất 1 lỗi thật đã biết trước khi tin nó (bộ đo báo xanh trên màn
  skeleton là tai nạn đã xảy ra).

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

## NHẬT KÝ RULE

- **23/08/2026** — Khởi tạo: tổng hợp từ Audit toàn diện 23/08 (5 mảng), rollout, bộ qc-*.mjs
  và các ràng buộc đã chốt (quy trình QC + bản nội bộ, không PIN, nhẹ tải upstream, không xin IT,
  đồng bộ UI, 9 luật điện thoại, phạm vi đo = phạm vi lời hứa).
