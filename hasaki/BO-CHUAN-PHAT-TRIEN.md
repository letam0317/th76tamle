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
- **`:disabled` của Alpine phải ÉP BOOLEAN `!!(…)` (17/09/2026):** Alpine chỉ GỠ thuộc tính boolean khi giá trị là
  `null/undefined/false`; giá trị là CHUỖI RỖNG `` (rất hay gặp vì cờ trạng thái hay là chuỗi, ví dụ `dangTaiBC`)
  thì nó set `disabled="disabled"` và nút CHẾT CỨNG, chạm không có phản hồi. Nút "đã xong/đã thêm" thì đừng dùng
  `disabled` — làm mờ bằng class và chặn trong chính hàm xử lý, để cú chạm vẫn tới nơi.
- Dropdown/bộ lọc → khuôn `.combo`+`.combo-menu` (popIn); animation chỉ dùng bộ sẵn có
  (`fadeUp/paneIn/popIn/sheetIn/menuIn`, easing `--ez-apple`/`--ez-spring`); modal `sheetIn`+blur;
  focus ring `--accent` + box-shadow 3px color-mix.
- Màu qua CSS variables theo theme, không hardcode (trừ palette chart đã định).
- **CẤM icon emoji** — nút chỉ dùng CHỮ; được phép ✓ ✗ ✕ ⚠ → ↗ ↑↓ và nét vẽ trong SVG minh hoạ.
- Trước khi thêm UI mới: grep tìm pattern tương đương đã có, tái dùng class — không viết bản sao.
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

## NHẬT KÝ RULE

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
