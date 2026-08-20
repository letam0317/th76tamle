# 🔎 NGHIÊN CỨU — Tab "Báo cáo vệ sinh SHOP 170" (CHƯA THỰC THI)

> Mục tiêu: 1 tab MỚI trong dashboard audit Hasaki (`kiemsoatkho/index.html`), đặt **giữa
> tab "Task vi phạm" và "Hạng mục 5S"**, theo dõi việc báo cáo **vệ sinh tủ quầy kệ**
> (Shelf & counter) + **vệ sinh không gian làm việc** (Workspace) của **KHO SHOP - 170
> QUOC LO 1A**, đối chiếu **chấm công** để biết ai đi làm nhưng chưa vệ sinh.
> Nguồn tham chiếu: `planogram.hasaki.vn/asset-management/request-of-declaration/details/23632957`.
>
> **Tất cả endpoint dưới đây đã kiểm chứng THẬT bằng token phiên sống (bridge), CHỈ GET,
> không đăng nhập, không tạo phiên → không đá ai.** (24/07/2026)

---

## 0. PHÁT HIỆN QUYẾT ĐỊNH (feasibility)

- **Planogram nằm SAU CÙNG cổng auth WMS + LUẬT 1-PHIÊN.** Bot thử SSO login planogram →
  precheck trả `need_confirm:true` ("Tài khoản đã đăng nhập trên thiết bị khác… sẽ đăng
  xuất thiết bị còn lại"). ⇒ **Tuyệt đối KHÔNG login planogram bằng bot** (đá operator).
- **NHƯNG token phiên SỐNG của operator (kênh bridge hiện có, cổng `wms-gw.inshasaki.com`)
  ĐƯỢC cổng `wms-gw-external.hasaki.vn` chấp nhận** — `get-me` external trả `200`. ⇒ Đọc
  được toàn bộ dữ liệu planogram **bằng đúng cơ chế bridge sẵn có**, không login mới, không đá ai.
- ⇒ Kiến trúc y hệt `sync-tonbatthuong.js` / `sync-stocklocation.js`: **Node bot dùng
  `layTokenSongWms()` (session-rules.js) → GET planogram → ghi Google Sheet → module đọc Sheet.**
  Module trình duyệt KHÔNG gọi thẳng planogram (CORS + không có token + luật phiên).

---

## 1. NGUỒN DỮ LIỆU — API planogram (đã kiểm chứng)

Base: `https://wms-gw-external.hasaki.vn/api/v1` · Header: `Authorization: Bearer <token bridge>`,
`Company-Ids: 1001`.

### 1a. Danh sách report vệ sinh (endpoint CHÍNH của tab)
```
GET /planogram/schedule-requests
    ?company_ids=1001
    &warehouse_ids=863              # 863 = SHOP - 170 QUOC LO 1A (trùng id WMS)
    &from_date=<epoch MILLISECONDS> # mốc 00:00 giờ VN
    &to_date=<epoch MILLISECONDS>   # mốc 23:59 giờ VN  (⚠ ms, KHÔNG phải YYYY-MM-DD)
    &purpose_types=1|2              # 1 = quầy kệ, 2 = workspace (bỏ trống = cả hai)
    &page=1&size=...
```
Kiểm chứng 24/07: SHOP-170 có **179** task/ngày = **160 quầy kệ (purpose 1) + 19 workspace (purpose 2)**.

Mỗi record:
| Field | Ý nghĩa |
|---|---|
| `request_id` | id report (vd 23632957) — mở chi tiết |
| `warehouse_id` / `warehouse_name` | 863 / "SHOP - 170 QUOC LO 1A" |
| `schedule_id` | lịch gốc (join sang location-schedules) |
| `purpose_type` | **1 = Vệ sinh tủ quầy kệ · 2 = Vệ sinh không gian làm việc** (3 Spa,4 Kho tổng,5 Nhà máy,6 Thời trang) |
| `location_description` | mã vị trí (vd F0-A1-516-10-04-01) |
| `status_id` / `status_name` | **1=chưa làm** (executed rỗng) · **3=Waiting For Approve** (đã báo cáo) · 4=Approved · rejected/cancelled… |
| `executed_by_name` | **AI vệ sinh** (email, vd duonglt@hasaki.vn) — RỖNG nếu chưa làm |
| `executed_at` | **LÚC NÀO** báo cáo (vd 2026-07-24 16:19:35) — rỗng nếu chưa làm |
| `request_time` / `day_of_month` | ngày phát sinh task |
| `start_at` / `end_at` | khung giờ đăng ký (vd 08:00–23:00) |

### 1b. Chi tiết 1 report (pop-up)
```
GET /planogram/schedule-requests/{request_id}?page=1&size=20&is_schedule_group=false
GET /planogram/standard-evaluates/list?mapping_id={schedule_id}&source_type=SCHEDULE_DECLARATION
GET /planogram/schedule-requests/next-request/{request_id}?ignore_request_ids=&anchor_status_id=3
```
`{request_id}` trả `item{...}` (đủ field trên) + `standard_image[]` = **các ảnh chuẩn bắt buộc**
kèm mô tả 3 tiêu chuẩn (trưng bày / vệ sinh / báo cáo) + ảnh mẫu.

### 1c. Master (tra cứu bộ lọc)
```
GET /planogram/config/planogram-config?config_types=SCHEDULE_PURPOSE_TYPE   # bảng purpose_type
GET /wms/master-data/warehouse/by-user?types=SPA,WH,SHOP                    # danh sách kho
GET /planogram/schedule/location-schedules/detail/{schedule_id}            # lịch gốc + purpose_type
```

---

## 2. ĐỐI CHIẾU CHẤM CÔNG ("đi làm nhưng chưa vệ sinh")

- Nguồn chấm công **đã có sẵn**: `pull-timesheet.js` → tab **NHAN-SU** (Sheet riêng PII).
  Có `staff_email`, `staff_name`, **Giờ vào / Giờ ra hôm nay**, trạng thái làm việc.
- Join theo **email**: `schedule-requests.executed_by_name` (email) ↔ `NHAN-SU.staff_email`.
- Chỉ số đề xuất:
  - **Tỉ lệ hoàn thành** quầy kệ / workspace (done = status ≥ 3) hôm nay.
  - **Đã báo cáo vệ sinh** = tập hợp email `executed_by_name` distinct hôm nay.
  - **"Đi làm nhưng chưa vệ sinh"** = NV có Giờ vào hôm nay (NHAN-SU) **NHƯNG** không xuất
    hiện trong tập đã báo cáo → danh sách nhắc việc.
- ⚠ Giới hạn: task khi CHƯA làm không gắn người phụ trách (executed_by rỗng) → không suy ra
  "vị trí X thuộc NV Y" trước khi làm. Vì vậy chỉ đo được ở mức **NV có/không báo cáo vệ sinh nào**,
  không phải mức từng vị trí. (Nếu cần mức vị trí phải có bảng phân công riêng — chưa thấy trong API.)

---

## 3. NGÔN NGỮ THIẾT KẾ — nhân theo khuôn dự án (BẮT BUỘC đồng bộ)

Khớp 100% các module HASAKI hiện có (`hasaki-kiemke.js`, `hasaki-tonbatthuong.js`):
- **Tab**: thêm vào `TAB_DEFS` + `CTY.hasaki.tabs`, chèn `"vesinh"` **giữa `"task"` và `"hangmuc"`**:
  `["tong","task","vesinh","hangmuc","kk","htonbat"]`.
- **Pane**: `<section id="pane-vesinh" class="pane hidden"></section>`.
- **Lazy-load**: trong `setTab()` thêm `if(name==='vesinh'){ moHasakiVeSinh(); }`; hàm này inject
  `hasaki-vesinh.js?v=...` rồi gọi `window.HVESINH.init(pane)` (idempotent, refresh nếu dữ liệu >5').
- **Module cô lập** (đúng khuôn): closure kín, chỉ lộ `window.HVESINH`; DOM/CSS tiền tố `hv-`;
  CSS bơm 1 lần neo dưới `#pane-vesinh` + `.hv-modal`; **màu dùng CSS variables portal**
  (`--panel/--text/--muted/--line/--accent`) để tự ăn 7 theme sáng/tối.
- **Thành phần UI tái dùng khuôn Kiểm kê**: dải chỉ số bấm được (KPI cross-filter), thanh
  trạng thái %, chart theo ngày, pop-up chain-filter (mở chi tiết report + ảnh chuẩn), bộ lọc
  quầy kệ/workspace + trạng thái + khoảng ngày. Hiệu ứng/độ mượt (`--ease`, animation pane) giữ nguyên.

---

## 4. LUỒNG TRIỂN KHAI ĐỀ XUẤT (khi được duyệt)

1. **`sync-vesinh.js`** (nhân bản `sync-tonbatthuong.js`): `layTokenSongWms()` → GET
   `/planogram/schedule-requests` (SHOP-170, cả 2 purpose, cửa sổ ngày) → chuẩn hoá → POST GAS
   ghi tab **`vesinh-shop170`** trên Sheet 5S. Tuân luật phiên (bridge trước, khung an toàn).
   Gắn vào cụm 8h40 + `sync-guard` + `SYNC-STOCK.bat`.
2. **GAS**: thêm route đọc tab `vesinh-shop170` (giống các tab module khác) — hoặc dùng gviz công khai.
3. **`hasaki-vesinh.js`** + 4 điểm chỉnh trong `index.html` (mục 3).
4. Join NHAN-SU (đã có) cho khối "đi làm nhưng chưa vệ sinh".

---

## 4b. ✅ ĐÃ LÀM — Yêu cầu 1: sheet "Phụ trách quầy kệ" (LIVE 24/07/2026)

- **Bộ sync:** `sync-phutrach-quayke.js` (khuôn `sync-tonbatthuong.js`).
  - Token phiên sống (`layTokenSongWms`) → quét `planogram/schedule-requests` SHOP-170 (wh 863),
    cửa sổ **45 ngày** (`PHUTRACH_DAYS`), lọc vị trí `^F0-A1|^F0-A8`.
  - Mỗi vị trí gắn **người phụ trách = executor GẦN NHẤT** (executed_at mới nhất; rỗng nếu chưa ai báo cáo).
  - Join `executed_by_name`(email) → **Code + Name** qua danh bạ `wshr` (token bridge dùng được trên
    `wshr.hasaki.vn/api/news/staff/search-for-dropdown`; join 47/47 executor khớp).
  - Ghi Sheet 5S tab **`PHU-TRACH-QUAY-KE`** (GAS `syncTasks`, chặn ghi rỗng), cột đúng thứ tự
    **Location | Executed By | Code | Name**.
- **Kết quả 24/07:** 224 vị trí (163 F0-A1 + 61 F0-A8) — 115 đã có người phụ trách, 109 chưa báo cáo.
  Tab public, đọc được qua gviz (dashboard đọc được).
- **Tự cập nhật:** đã thêm vào `SYNC-STOCK.bat` (cụm 8h40) + regex cụm trong `sync-guard.js`
  → chạy hằng ngày + watchdog + nút "Cập nhật ngay". Chạy tay: `node sync-phutrach-quayke.js`
  (thêm `--dry` để không ghi Sheet).
- ⚠ **PII:** tab chứa email/mã/tên NV (theo đúng yêu cầu). Đặt ở sheet public để dashboard đọc —
  nhất quán với việc dự án đã hiển thị tên NV ("Counted by") công khai. Nếu cần siết, thêm
  `PHU-TRACH-QUAY-KE` vào `PII_TABS` (GAS) + đọc qua GAS action thay vì gviz.

## 4c. ✅ ĐÃ LÀM — 25/07/2026: ẢNH BÁO CÁO + tab Planogram thiết kế lại theo HÀNH ĐỘNG

### Phát hiện ẢNH (probe-vesinh-anh.mjs — chỉ GET, token bridge)
- Record **LIST** `/planogram/schedule-requests` có sẵn **`request_image[]`** (ảnh NV chụp từng ô
  khi báo cáo, mỗi request ~16 ảnh) + `standard_image[]` (ảnh chuẩn) — **không cần gọi detail**.
- URL ảnh (`.../filesmanagement/planogram/standard/<uuid><tên>.jpg`) **CÔNG KHAI — tải được
  KHÔNG cần token** (test 200/1.4MB có lẫn không Bearer) ⇒ dashboard hotlink `<img>` thẳng,
  không cần proxy/token. Bằng chứng: `.exports/probe-vesinh-anh.json`, `anh-vesinh-test.png`.

### Dữ liệu mới (sync-vesinh-all.js — vẫn 1 lượt quét, thêm 2 tab)
- **`VESINH-YEUCAU`**: từng yêu cầu HÔM NAY — Request ID | Ngày | Location | Khu vực | Status ID
  | Trạng thái | Executed By | Executed At | Phụ trách (executor gần nhất 45n) | PT Code | PT Name
  | PT đi làm (join timesheet) | PT giờ vào | Ảnh (URL nối " | ").
- **`VESINH-NHATKY`**: Ngày | Email | Code | Name | Khu vực | Số vị trí | Vị trí (45 ngày) —
  nguồn "tra cứu 1 NV làm ở đâu theo ngày".
- GAS: `SERVE_PRIVATE_TABS` += 2 tab trên (ghi sheet PRIVATE + đọc qua readTab); `apiReadTab`
  giữ nguyên giờ cho ô NGÀY+GIỜ (`yyyy-MM-dd HH:mm`).

### Tab Planogram mới (hasaki-planogram.js — v20260725a)
- **Hero "Vệ sinh hôm nay"**: 4 thẻ = Tổng yêu cầu / **Đã vệ sinh** / **Chưa vệ sinh (phụ trách
  CÓ chấm công — cần nhắc)** / **Không có ca làm việc** (phụ trách nghỉ hoặc chưa có người nhận)
  + thanh tiến độ xếp chồng. Phân nhóm: done = status 3|4; còn lại xét PT × chấm công.
- **Pop-up yêu cầu** (khuôn combo chain-filter): trạng thái thật (Chưa vệ sinh/Chờ duyệt/Đã duyệt
  /Bị từ chối), người thực hiện + giờ, phụ trách × chấm công, **thumbnail ảnh (lazy) → lightbox
  carousel của host (openLB)**, link `↗` sang planogram từng request + link list đúng ngày/khu.
- **"Theo nhân viên phụ trách" thu gọn** thành nút **"Tra cứu theo nhân viên"** → pop-up 2 cột:
  danh sách NV (tìm kiếm) + nhật ký THEO NGÀY (chip vị trí bấm mở planogram đúng ngày+vị trí).
  Bấm 1 dòng ở bảng "Đối chiếu chấm công" cũng mở nhật ký NV đó.
- Test render THẬT (chặn JSONP, bơm dữ liệu --dry): `capture-planogram-tab.mjs` →
  `.exports/shot-pg-new-*.png` (main / modal ×2 / lightbox / tra cứu NV / mobile).

## 4d. ✅ ĐÃ LÀM — 25/07/2026 (đợt 2): AI XÉT DUYỆT ẢNH + kích hoạt trọn gói

### Bộ AI xét duyệt (`sync-vesinh-ai.mjs`) — 2 nhà cung cấp, tự chọn theo key trong .env
- **GEMINI_API_KEY** (aistudio.google.com/apikey — **MIỄN PHÍ, không cần thẻ**; key định dạng mới
  `AQ.`, mặc định `gemini-3.5-flash`): ảnh tải về + thu nhỏ 1024px (sharp) gửi inline; structured
  output responseSchema; đi tuần tự nhịp ~9 req/phút. **CHUỖI MODEL DỰ PHÒNG** (mỗi model 1 quota
  ngày riêng): 3.5-flash → 3.5-flash-lite → 3-flash-preview → 2.5-flash-lite → 2.0-flash — hết quota
  model trước tự nhảy model sau; hết cả chuỗi mới dừng, lượt sau chấm tiếp. Thực chiến 25/07: chấm
  129 request/ngày (flash 18 + flash-lite 111, ~928K token) — 0 đồng.
  ⚠ Khối "AI xét duyệt ảnh" trên dashboard (v20260725d): 5 thẻ + bảng lý do + model + link planogram.

### Sơ đồ mặt bằng khu Đóng gói F0-A8 (v20260725f — theo bản vẽ BDG.pdf 25/07)
- **Quy tắc mã (operator xác nhận):** 4 cụm, mỗi cụm 2 DÃY BÀN kẹp 1 BĂNG CHUYỀN:
  501|502|503 · 504|505|506 · 507|508|509 · 510|511|512. Ô bàn = `F0-A8-<dãy>-<ô 01..08>-01-01`
  (8 ô/dãy, ghép cặp 01-02/03-04/05-06/07-08). Dãy giữa 502/505/508/511 chính là băng chuyền,
  MỖI BĂNG = 1 mã duy nhất: `F0-A8-502-01-01-01 / 505…-02 / 508…-03 / 511…-04`.
- Dashboard render sơ đồ tương tác: ô tô màu theo trạng thái NGÀY ĐANG XEM, rê chuột = phụ trách +
  giờ làm + kết luận AI. Hằng số `MAP_A8` trong hasaki-planogram.js.

### SIDEBAR LIVE + RÀ SOÁT TOÀN DỰ ÁN (26/07) — v20260726a
- **Sidebar phương án C đã ghép vào index.html production** (Planogram trong Hạng mục 5S). Kỹ thuật:
  chèn 3 khối (style qc-side-css + aside/toggle/backdrop + script) vào index.html — KHÔNG sửa
  setTab/pane/module. Drawer trượt cả web+mobile (ẩn mặc định, nút ›/‹ nhỏ góc trên trái ngang
  tiêu đề, mở thì GHIM đẩy nội dung, chọn tab KHÔNG tự đóng, mobile phủ+nền mờ). Nhóm có ô màu
  accent + sub-tab thụt vào có đường dẫn dọc. Bỏ brand lặp trong sidebar (header giữ tiêu đề).
- **Rà soát 2 agent (design consistency + UI/UX). ĐÃ SỬA:**
  · factory-stock/factory-kiemke: `--panel`→`--surface`, `--line`→`--border` (31 chỗ token không
    tồn tại → vỡ theme tối). (Factory hiện khoá, không live — sửa để future-proof.)
  · ESC đóng pop-up cho cả 3 module hasaki (trước chỉ đóng bằng click nền/×) — nhường lightbox host.
  · Cột "Trạng thái"→"Trạng thái duyệt" ở pop-up yêu cầu (tách khỏi nhãn Đã/Chưa vệ sinh — hết mơ hồ).
  · colspan loading 7→8/6 theo mode; hp-badge thêm max-width+ellipsis (chống tràn); nf() en-US→vi-VN
    cả 3 module (12.345); empty-state khi khoảng ngày 0 yêu cầu; footer/note rút gọn (đẩy chi tiết
    vào tooltip); bỏ &amp;nbsp; thừa ở legend kiemke.
### CHUẨN HOÁ THẨM MỸ ĐỒNG BỘ (26/07, "thực thi cải tiến") — v20260726b
- **Thẻ KPI 1 mẫu duy nhất:** Kiểm kê (`hk-strip .ks`) từ "dải số mỏng weight-300" CHUYỂN sang thẻ
  KPI giống Planogram/Tồn bất thường (grid auto-fit, thẻ surface + viền trái accent 4px, số 20px/780,
  hover nhấc) — chỉ đổi CSS, giữ nguyên HTML/onclick/forecast card. Nay 3 tab đồng nhất.
- **Header bảng (thead th) thống nhất:** 11px / weight 600 / KHÔNG uppercase / nowrap — kéo Kiểm kê
  (trước 10.5px/700/UPPERCASE) và giỏ PC (10.5px→11px) về chuẩn của Planogram/Tồn bất thường.
- **Badge thống nhất:** 11px / weight 650 (kéo hk-badge 10px/750 về chuẩn hp).
- **Số kiểu Việt Nam:** nf() → vi-VN toàn bộ 6 module (12.345 thay vì 12,345). 0 chỗ còn en-US.
- **Fallback màu accent thống nhất = #326e51** (brand green): thay 86 chỗ lẫn lộn #1f2937/#2563eb/
  #1e40af; accent-hover → #295b42. (Không đổi hiển thị khi token sống, nhưng hết code-smell + an toàn.)
- **CHƯA đụng:** palette `--fk*` cố định của factory-kiemke (factory khoá, không live) — để lại
  nguyên; nếu bật lại Factory sẽ map sau.

### QC · GOM TAB PHƯƠNG ÁN C (SIDEBAR) — bản nghiệm thu riêng (25/07 khuya)
- **File QC (KHÔNG đụng production):** `kiemsoatkho/qc-sidebar.html` = CLONE index.html + LỚP sidebar.
  URL: letam0317.github.io/kiemsoatkho/**qc-sidebar.html** (so sánh 3 phương án: **qc-nav.html**).
- **Nguyên tắc bất di bất dịch (user nhấn nhiều lần):** chỉ đổi LỚP ĐIỀU HƯỚNG, TUYỆT ĐỐI không đổi
  hiển thị nội dung tab. Cách làm: KHÔNG sửa `setTab`/pane/module — chèn `<aside id="sideNav">` dạng
  `position:fixed` + `.wrap{padding-left:214px}` (đẩy nội dung sang phải, nội dung y hệt); ẩn `#tabsNav`
  + `#brandTitle`. Script chèn cuối body: dựng sidebar từ `CTY[CTY_ID].tabs` (tên trần — const không
  lên window), click → gọi `setTab` gốc; bọc `setTab` để đồng bộ active; MutationObserver #tabsNav để
  dựng lại khi đổi công ty. Gom: **Hạng mục 5S** {Tổng quan, Task vi phạm, Quy định(=hangmuc đổi nhãn),
  Planogram} · **Hạng mục Tồn kho** {Kiểm kê, Tồn kho bất thường}.
- **Web + Mobile:** desktop sidebar cố định 214px; **mobile (≤940px) sidebar KHÔNG cố định** — trượt
  ra/thu vào bằng nút mũi tên ›(mở)/‹(thu) ở mép trái + backdrop mờ (body.side-open). Đã QC 4 ảnh
  (.exports/qc-side-*.png): nội dung Task/Planogram render y hệt bản gốc.
- Khi user duyệt phương án → ghép vào index.html thật (cùng kỹ thuật, thêm ~60 dòng), giữ ?embed=1 cũ.

### HỆ MÀU ĐA TRẠNG THÁI + CẢNH BÁO QUÁ HẠN + fix bug lightbox — v20260725j (25/07 khuya)
- **Bug lightbox → lòi pop-up "workflow vi phạm" (ĐÃ FIX):** thumbnail ảnh trong pop-up mang thuộc
  tính `data-i` (chỉ số ảnh) trùng selector `e.target.closest('[data-i]')` của host (index.html:3055
  → moChiTiet mở modal task). Đổi `data-i`→`data-idx`, `data-id`→`data-rid` + `event.stopPropagation()`
  trên mọi onclick ảnh. Click ảnh giờ chỉ mở lightbox, tắt xong về đúng pop-up vị trí.
- **Hệ trạng thái ô sơ đồ (CELLST)** — palette status kiểm CVD/tương phản bằng dataviz validator
  (green/red/orange đạt; slate cố ý xám = trung tính). Mỗi màu 1 nghĩa + LUÔN kèm nhãn (chú giải)
  + tooltip; chất lượng AI phân biệt thêm bằng HÌNH DẠNG badge (chấm = cần xem, tam giác = làm lại):
  · Đã VS (đạt/chờ AI) = xanh #059669 · Đã VS·cần xem = xanh + chấm hổ phách · Đã VS·không đạt = cam
  #ea580c (làm lại) · Chưa VS·có người đi làm = đỏ #dc2626 (nhắc ngay) · Chưa VS·nghỉ = slate #64748b
  · Không có yêu cầu = nét đứt. Ngày quá khứ gộp Đã/Chưa. Khoảng nhiều ngày: xanh=đủ, cam=có ngày fail,
  đỏ=có ngày chưa.
- **Cảnh báo quá hạn (tinhCanhBao):** mỗi vị trí đếm số NGÀY YÊU CẦU gần nhất liên tiếp không báo cáo
  (bỏ qua ngày không có yêu cầu → A1 tuần/A8 ngày đều đúng); ≥3 → viền đỏ tĩnh + ⚠ trên ô + banner
  đỏ nhấp nháy đầu sơ đồ ("N vị trí quá 3 ngày…") bấm mở danh sách xử lý. Chỉ banner nhấp nháy (ô tĩnh
  — tránh alert fatigue khi nhiều ô). Ngưỡng NGUONG_CANHBAO=3 (chỉnh được). ⚠ Nếu A1 phát yêu cầu
  hằng ngày nhưng vệ sinh theo tuần → có thể over-fire, cần theo dõi thực tế để tinh chỉnh ngưỡng/theo khu.

### HOÀN THIỆN UI/UX theo góp ý cuối — v20260725i (25/07 tối)
- **Bộ lọc ngày = MENU CHỌN KHOẢNG** (khuôn hp-combo-menu mượt của dự án): Hôm nay · Hôm qua ·
  3 ngày · 7 ngày gần nhất · hoặc từng ngày. Chế độ KHOẢNG: KPI 3 thẻ (Tổng/Đã/Chưa) gộp nhiều
  ngày; sơ đồ xanh = đủ mọi ngày, đỏ = có ngày chưa (tooltip liệt kê từng ngày); bảng yêu cầu
  thêm ngày vào cột Lúc. State S.dTu→S.dDen; đúng-1-ngày-hôm-nay mới chia 3 nhóm hành động.
- Pop-up vị trí: hyperlink DUY NHẤT "Yêu cầu #… ↗" ở góc phải trên (bỏ nút Mở planogram + bỏ
  ghi chú #id trùng ở hàng Trạng thái); AI đã chấm theo Display description TỪNG Ô từ trước.
- Panel "Danh sách theo dõi": bộ chuyển chế độ thành SEGMENTED CONTROL (hp-seg) đặt góc phải
  tiêu đề — tách bạch với chips lọc. Sơ đồ: bỏ ghi chú lặp ở sub-header, hint rút còn 1 câu.

### SƠ ĐỒ QUẦY KỆ A1 + chỉnh theo góp ý operator — v20260725h (25/07 tối)
- **Quy tắc mã A1 (operator xác nhận):** `F0-A1-<dãy>-<kệ>-<mâm>-<bin>` — dãy 501-516, mỗi dãy
  ~10 kệ (bản vẽ "HƯỚNG DẪN ĐƯỜNG ĐI SOẠN HÀNG_A0.pdf", Drive folder 1RWbvGgMozb9…: 4 cụm ×
  4 dãy; kệ 01-05 khối trên, 06-10 khối dưới, lối đi giữa). Mỗi kệ 4 mâm × 6 bin; YÊU CẦU VỆ SINH
  planogram tính THEO KỆ (mã ổn định dạng F0-A1-<dãy>-<kệ>-04-01). Sơ đồ data-driven qua `keA1()`
  (gom prefix dãy|kệ từ PHU-TRACH 45n + YEUCAU 7n) — dãy/kệ mới tự xuất hiện.
- Mục sơ đồ đổi tên "Sơ đồ khu vực — Quầy kệ (A1) & Bàn đóng gói/băng chuyền (A8)", lọc khu vực
  ẩn/hiện từng phần; bấm ô kệ → cùng pop-up chi tiết vị trí (tiêu đề "Kệ KK · dãy DDD").
- Góp ý đã sửa: thanh điều khiển KHU VỰC trước → NGÀY sau, ngày = Ô CHỌN (không xổ 7 chips);
  pop-up vị trí bỏ trùng lặp (1 badge nhóm — badge hệ thống chỉ thêm khi khác nghĩa; 1 link
  planogram duy nhất ở đầu pop-up).

### TÁI CẤU TRÚC BÁO CÁO v20260725g (yêu cầu "gọn, không trùng lặp", 25/07 chiều)
- **VESINH-YEUCAU giữ 7 NGÀY** (`VS_YC_DAYS`; ảnh chỉ đính 3 ngày gần — `VS_ANH_NGAY`) → toàn tab
  có TRỤC THỜI GIAN: chips Ngày (7 ngày) trên thanh điều khiển đổi cả KPI + sơ đồ + pop-up.
- Bố cục 4 khối, KHÔNG trùng số liệu: (1) Thanh điều khiển: Ngày · Khu vực · Tra cứu nhân viên ·
  Toàn bộ vị trí; (2) KPI ngày đang xem (hôm nay 4 thẻ, ngày cũ 3 thẻ Tổng/Đã/Chưa — chấm công
  quá khứ không lưu) + chip AI; (3) SƠ ĐỒ F0-A8 theo ngày — **bấm ô mở pop-up chi tiết vị trí**:
  dải lịch sử 7 ngày bấm chuyển ngày, trạng thái + badge hệ thống, người báo cáo + giờ, kết luận
  AI + lý do, ảnh báo cáo (lightbox), phụ trách gần nhất, link planogram; (4) "Danh sách theo dõi"
  1 panel 2 chế độ: AI xét duyệt ảnh · Nhân viên hôm nay (đã bỏ: panel Theo khu vực, panel Phụ
  trách vị trí, hàng thẻ AI, hàng thẻ chấm công — số liệu trùng).
- **ANTHROPIC_API_KEY** → **Claude Opus 4.8** (vision mạnh nhất, trả phí, Batch API -50%) +
  adaptive thinking + structured output json_schema — SDK `@anthropic-ai/sdk` đã cài.
- `AI_PROVIDER=gemini|claude` ép chọn; `AI_MODEL`/`--model` đổi model. Prompt KHÔNG chứa email NV.
- Quét planogram (token bridge, chỉ GET) các yêu cầu **Chờ duyệt (status 3)** cửa sổ `--days` (mặc định 3),
  ảnh truyền bằng **URL công khai** (API tự tải — không cần download).
- **Chốt cứng cục bộ đúng 100% (không tốn AI):** ảnh **DÙNG LẠI** (trùng URL với request khác — cùng đợt
  hoặc mọi request 14 ngày trước, cache `.exports/ai-vesinh-cache.json`) → KHÔNG ĐẠT; **thiếu ảnh bắt buộc**
  (so `image_name` với `standard_image.is_required`) → KHÔNG ĐẠT.
- AI chấm từng request theo **TIÊU CHUẨN TỪNG Ô** (image_description) đính ngay trước từng ảnh; rubric
  nêu rõ chỉ bắt lỗi nhìn thấy, không suy diễn; **tin cậy < 75 → ép CẦN XEM** (không tự đạt/rớt khi mơ hồ);
  AI refuse/lỗi → CẦN XEM. Kết quả: ĐẠT / KHÔNG ĐẠT / CẦN XEM + điểm + lý do + ô lỗi.
- **Batch API (-50% chi phí)** khi >5 request; ≤5 hoặc `--live N` gọi trực tiếp; batch dở dang tự thu ở lần
  chạy sau (`.exports/ai-vesinh-batch.json`). Ước lượng ~26K token vào/request (16 ảnh) ⇒ **~0,08 USD/request
  (batch, Opus)**; ngày full 179 request ≈ 13-14 USD — đổi `AI_MODEL=claude-haiku-4-5` nếu cần rẻ (~1/25 giá,
  kém chính xác hơn).
- Ghi tab **`VESINH-AI`** (sheet PRIVATE, giữ 14 ngày) — dashboard join theo Request ID: cột "AI xét duyệt"
  + bộ lọc trong pop-up, chip **Đạt/Không đạt/Cần xem** ở hero (bấm mở danh sách lọc sẵn).
- Guard: thiếu `ANTHROPIC_API_KEY` → thoát nhẹ exit 0 (không chặn cụm); GAS chưa whitelist → giữ cache cục
  bộ, KHÔNG ghi. Đã gắn vào `SYNC-STOCK.bat` (sau sync-vesinh-all) + regex sync-guard.

### Chốt an toàn PII tự động (25/07)
`sync-vesinh-all.js` probe `readTab` trước khi ghi VESINH-YEUCAU/NHATKY: **GAS cũ → tự BỎ QUA 2 tab mới**
(không ghi email NV vào sheet public) và in hướng dẫn. `sync-vesinh-ai.mjs` cũng vậy với VESINH-AI.
⇒ lịch 8h40 chạy trước khi deploy GAS vẫn an toàn.

### ⚠ KÍCH HOẠT — còn đúng 2 việc tay (còn lại đã tự động)
1. **Dán `google-script.gs` mới vào Apps Script editor + Deploy** (whitelist VESINH-YEUCAU/NHATKY/AI).
   (clasp đăng nhập letam0317@gmail.com không thấy script 5S → không tự đẩy được.)
2. **Thêm `ANTHROPIC_API_KEY=sk-ant-...` vào `hasaki/.env`** (console.anthropic.com) — cho bộ AI.
Sau đó: bấm "Cập nhật ngay" trên dashboard (hoặc chờ 8h40) — sync tự ghi tab mới, AI tự chấm.
Dashboard MỚI **đã deploy sẵn** lên Pages (v20260725b) — thiếu dữ liệu chỉ hiện gợi ý, không vỡ.
- Nhịp dữ liệu: 1 lần/ngày 8h40 + nút "Cập nhật ngay". Nếu muốn tươi hơn có thể tách "quét hôm nay"
  (1 trang) chạy mỗi giờ — CHƯA làm, chờ quyết định (tải WMS thấp, ~1 request/giờ).

## 4e. ✅ ĐÃ LÀM — 01/08/2026: LỊCH SỬ BÁO CÁO 60 NGÀY (`VESINH-LICHSU`) + vá bằng chứng giả

### Lỗi user bắt được (ô `F0-A1-513-10-04-01`, chọn ngày 29/7)
Pop-up hiện **Phụ trách = Ngô Phương Vy (bảng phân công, hôm nay KHÔNG chấm công)** và ngay bên
cạnh **"Báo cáo gần nhất: Ngô Phương Vy · không rõ ngày · ✓ đúng người trong bảng phân công"**.
Sự thật: **ô này 45 ngày quét KHÔNG có lượt báo cáo nào** (`PHU-TRACH-QUAY-KE` để trống Executed
By/At — cả dãy 513 chỉ có **1** lượt trong 45 ngày). Thẻ "tham khảo" rơi về các cột
`Phụ trách / PT Name / PT lần cuối` của `VESINH-YEUCAU` — mà từ 30/07 các cột đó được sync ghi
theo **BẢNG PHÂN CÔNG**, không phải người đã làm ⇒ nó in lại đúng người phụ trách rồi tự kết luận
"✓ đúng người", tức **so bảng phân công với chính nó và trình bày như bằng chứng**.

### Chữa (hasaki-planogram.js v20260801a)
- Bằng chứng "ai đã THỰC SỰ làm" chỉ nhận nguồn LÀ BÁO CÁO: (1) `VESINH-LICHSU` 60 ngày (có GIỜ),
  (2) `PHU-TRACH-QUAY-KE` (lượt gần nhất 45n), (3) executor của chính yêu cầu đang xem. **Cấm** dùng
  cột PT của `VESINH-YEUCAU`. Không có gì cả → nói thẳng "chưa ai báo cáo vị trí này trong 60 ngày".
- Thẻ "Báo cáo gần nhất" thêm **NGÀY + GIỜ** ("T7 01/08 lúc 05:59 · hôm nay") + nhãn nguồn bằng chứng.
- Khối **LỊCH SỬ 60 NGÀY**: tổng số lượt, số người, dòng đối chiếu `N/M lượt do đúng người phụ trách`
  (đủ = xanh, lệch = hổ phách + tên người khác kèm số lượt), 6 lượt gần nhất (ngày · giờ · người,
  người khác tô hổ phách), "… và N lượt trước đó". Nạp **bậc 3** lúc mở pop-up + cache phiên.
- Dọn 2 lỗi nhìn thấy được cùng chỗ: ghi chú "g-sheet chưa phân công vị trí này" in 2 lần; badge
  nguồn phân công bị cắt còn "SUY TỪ BÁO CÁO GẦN NH…".

### Tab mới `VESINH-LICHSU` (sync-vesinh-all.js — KHÔNG thêm request WMS nào)
`Ngày | Giờ | Location | Executed By | Code | Name | Request ID`, 1 dòng = 1 lượt báo cáo thật.
- **CỘNG DỒN, không nới cửa sổ quét**: mỗi lượt sync gộp lượt mới vào lịch sử cũ
  (`.lichsu-vesinh.json`, đã gitignore vì có PII; máy mới thì bootstrap lại từ chính tab qua
  `readTab`) rồi **tự xoá mọi dòng rơi sang ngày thứ 61**. Khoá trùng = Request ID.
- Tên/mã NV **lưu luôn vào lịch sử**, không tra lại danh bạ: NV nghỉ việc rơi khỏi danh bạ wshr thì
  lịch sử cũ vẫn còn tên — mà "ai làm ô này 2 tháng trước" chính là thứ cần đối chiếu.
- Số đo lượt đầu (01/08/2026): **541 lượt / 122 ô** (A1 85 · A8 37), tab ~89KB, phủ 18/06 → 01/08.
  Quét 45 ngày nên 15 ngày đầu chưa đủ 60; muốn đủ ngay: chạy **một lần**
  `PHUTRACH_DAYS=60 node sync-vesinh-all.js`. Pop-up in kèm "dữ liệu từ dd/mm" để không ai hiểu
  "0 lượt" là chắc chắn 60 ngày không ai làm.
- CHỐT PII: probe `gasPhucVuTab('VESINH-LICHSU')` RIÊNG (không đi kèm cờ của YC/NK) — GAS chưa
  whitelist thì lịch sử vẫn tích luỹ ở file cache nhưng **KHÔNG** ghi Sheet. Cần dán + deploy
  `google-script.gs` (đã thêm `'VESINH-LICHSU'` vào `SERVE_PRIVATE_TABS`); clasp không với tới
  script 5S nên phải dán tay.

## 4f. ✅ ĐÃ LÀM — 01/08/2026 (đợt 2): CHẤM CÔNG THEO NGÀY trong pop-up ô (`VESINH-CHAMCONG-NGAY`)

### User nói rõ ý (sau đợt 4e)
"Chọn 1 vị trí + chọn ngày thì phải hiện **giờ vô ca và giờ chấm công cuối của ca (ra về)** để xem
hôm đó **có đi làm mà không báo cáo** hay không — thể hiện ở mục **Phụ trách**; còn liệt kê thời gian
báo cáo planogram quá khứ ở thẻ tham khảo thì **không cần**."
Lỗi cốt lõi của bản trước: thẻ Phụ trách luôn dùng chấm công **HÔM NAY** (`CHAMCONG-VESINH` chỉ có
hôm nay), nên bấm xem lại 29/07 vẫn đọc ra "Hôm nay KHÔNG chấm công" — sai câu hỏi.

### Tab mới `VESINH-CHAMCONG-NGAY` (sync-vesinh-all.js)
`Code | Name | Email | Số ngày | Chấm công theo ngày (ngày vào-ra)`, ô cuối gói mọi ngày:
`2026-08-01 05:54-17:32 | 2026-07-31 05:47-16:58 | …` (thiếu giờ ghi `??:??`, KHÔNG dùng `--:--` vì
nối vào thành `05:50---:--`).
- API `hr/timesheet` nhận **from_date/to_date** và mỗi dòng có trường **`date`** (kiểm chứng
  01/08/2026) ⇒ lấy cả khoảng trong 1-2 request như trước, không cần gọi mỗi ngày một lần.
- Mỗi lượt chỉ lấy lại **7 ngày gần nhất** (`VS_CC_LAY`) vì chấm công còn được sửa/duyệt muộn (thấy
  dòng 31/07 `updated_at` 22:00 cùng ngày); các ngày trong cửa sổ đó bị **xoá rồi nạp lại** để bản
  sửa ghi đè được. Cũ hơn nằm trong `.chamcong-ngay.json` (gitignore, có PII) / chính tab.
- Cửa sổ trượt **60 ngày**, tự xoá ô ngày thứ 61 — cùng cơ chế `VESINH-LICHSU`.
- **CHỈ giữ đội vệ sinh** (bảng phân công ∪ người từng báo cáo ∪ đội chấm công): cả bộ phận là
  ~117 NV/ngày → 60 ngày ~7.200 ô (~200KB) cho một nguồn mà pop-up chỉ tra người phụ trách; lọc
  còn **64 NV / 2.969 ô ngày (~83KB)** và bớt PII người không liên quan.
- Nạp bù 60 ngày ngay: `VS_CC_LAY=60 node sync-vesinh-all.js` (đã chạy 01/08 — phủ 03/06 → 01/08).

### Pop-up ô (v20260801b)
- Thẻ **Phụ trách** đổi dòng chấm công sang **đúng ngày đang chọn**: `Ngày 29/07 · ĐI LÀM: vào 11:54
  · ra 21:00` + dòng phụ `KHÔNG báo cáo vệ sinh ô này` (ĐỎ). Ngày nghỉ: `Ngày 29/07 · KHÔNG chấm
  công` + `nghỉ / không vào ca hôm đó — không phải lỗi không báo cáo` (dòng "không báo cáo" **không
  tô đỏ** khi người ta nghỉ — đỏ nghĩa là đáng đi truy người, mà hôm đó lỗi thuộc bố trí).
  Ô đã làm: `đã báo cáo vệ sinh ô này lúc 17:47`; người khác làm: `ô này do <tên> báo cáo lúc …` (hổ phách).
- **BỎ** khối "Lịch sử 60 ngày" (danh sách lượt báo cáo cũ + dòng N/M lượt) khỏi thẻ tham khảo theo
  yêu cầu user. `VESINH-LICHSU` vẫn là nguồn cho dòng "Báo cáo gần nhất" (ngày + GIỜ thật).
- Ngày không có dòng chấm công nào của đội → nói rõ "ngoài 60 ngày đang lưu, hoặc cả đội nghỉ",
  KHÔNG kết luận "nghỉ" (tránh kết tội oan).
- GAS: `SERVE_PRIVATE_TABS` += `VESINH-CHAMCONG-NGAY` → **phải dán + deploy lại** google-script.
- Nghiệm bằng harness Puppeteer/Edge (chặn request, JSONP giả từ `.exports/*-out.json`) — 4 ca:
  ô 513-10 hôm nay (chưa chấm công) · ô 513-10 ngày 29/07 (**ĐI LÀM 11:54-21:00 mà không báo cáo**)
  · ô A8-502 hôm nay (đi làm + đã báo cáo 05:59) · ô 508-09 ngày 31/07 (đi làm 07:45-18:24, báo cáo 17:47).

## 4h. ✅ 03/08/2026 — GIẢM TẢI + "ĐI LÀM MÀ KHÔNG BÁO CÁO" CHO NGÀY CŨ

### (A) Cửa sổ quét planogram của nhịp poller: 45 → 10 ngày
Nhịp poller 15' quét lại 45 ngày mỗi lượt là dội WMS vô ích — **mọi thứ cần quá khứ nay đều nằm
trong kho CỘNG DỒN**, không còn phụ thuộc lượt quét:

| Dữ liệu | Trước (phụ thuộc cửa sổ quét) | Nay (cộng dồn) |
|---|---|---|
| Danh sách vị trí (`PHU-TRACH-QUAY-KE`) | mọi vị trí thấy trong 45 ngày | `.danhmuc-vitri.json` (bootstrap từ chính tab; quên vị trí quá `VS_DM_NGAY`=120 ngày không thấy) |
| Người phụ trách gần nhất mỗi vị trí | executor gần nhất trong lượt quét | lượt quét → thiếu thì bù từ `VESINH-LICHSU` (60 ngày) |
| Đội vệ sinh (`CHAMCONG-VESINH`) | ai báo cáo trong 45 ngày quét | `VESINH-LICHSU` trong `VS_TEAM_NGAY`=45 ngày |
| `VESINH-NHATKY` | gom từ lượt quét (45 ngày) | gom từ `VESINH-LICHSU` (**60 ngày**) |

**Đo thật cùng ngày, cùng máy:**

| | Trang | Request WMS | PHU-TRACH |
|---|---|---|---|
| 45 ngày (bản cũ) | 7 | 3.346 | 224 vị trí · 123 có người |
| 10 ngày (poller mới) | 4 | 1.790 | **224 vị trí** · **125** có người |

Cùng 224 vị trí ⇒ thu hẹp **không mất gì**; 125 > 123 vì phần bù từ lịch sử phủ tới 60 ngày, rộng
hơn cửa sổ quét cũ. `−47%` request WMS mỗi lượt × ~36 lượt/ngày.
**Không hạ được nữa:** API `schedule-requests` **chặn `size>500`** (đo: size=1000/2000 → HTTP 500),
nên 1.790 bản ghi = 4 trang là sàn của cửa sổ 10 ngày.

- Lượt cụm 8h40 (`SYNC-STOCK.bat`) **vẫn quét đủ 45 ngày** mỗi ngày một lần → vá mọi lệch tích luỹ.
- Chỉnh: `POLLER_VESINH_QUET_NGAY` (poller) · `PHUTRACH_DAYS` (chạy tay).
- **Chốt an toàn:** máy mới (cache trống) mà cũng không đọc được tab `PHU-TRACH-QUAY-KE` để
  bootstrap → sync **BỎ QUA ghi tab đó** thay vì ghi danh sách cụt (nếu ghi cụt, dashboard sẽ báo
  nhầm hàng chục vị trí là "đã dừng phát yêu cầu"). Đợi lượt 45 ngày dựng lại.
- `VS_YC_DAYS` bị **kẹp** `≤ PHUTRACH_DAYS`: xin 30 ngày yêu cầu trong lượt quét 10 ngày thì tab
  `VESINH-YEUCAU` bị cắt cụt rồi ghi đè mất phần cũ.

### (B) `VESINH-YEUCAU` 246KB → 112KB (−54%) + tách tab ảnh
Tab nặng nhất lúc mở dashboard. Đo từng cột trên chính 1.246 dòng đang chạy rồi cắt **5 cột suy được**:

| Cột bỏ | KB | Suy lại bằng gì | Đối chiếu |
|---|---|---|---|
| Khu vực | 28 | `areaOf(Location)` | dashboard **chưa từng đọc** cột này |
| Trạng thái | 19 | `ST_TEN[Status ID]` | ánh xạ 1:1: `1 New ×174 · 3 Waiting For Approve ×154 · 4 Approved ×5 · 7 Not Performed ×913` — 0 ngoại lệ |
| PT Name | 32 | `tenNm(email)` từ `PHU-TRACH` + `VESINH-PHANCONG` | **0/47** email tra không ra tên |
| PT lần cuối | 10 | `Executed At` của `PHU-TRACH-QUAY-KE` cùng Location | khớp **1246/1246** |
| Ảnh | 44 | tab **`VESINH-ANH`** riêng (Request ID \| Ngày \| Ảnh), nạp **bậc 3** | 41 dòng có ảnh, 42KB |

sync tự **cảnh báo trong log** nếu WMS đẻ Status ID ngoài bảng tra (`⚠ STATUS LẠ`) — không im lặng
hiện sai. Dashboard vẫn đọc được cột cũ nếu Sheet/cache phiên còn dữ liệu bản trước.
GAS: `SERVE_PRIVATE_TABS` += `VESINH-ANH` (đã push+deploy bằng clasp, URL không đổi).

**Tải bậc 1 (3 nguồn dựng màn hình): 428KB → 294KB.** Nặng nhất hiện giờ là `VESINH-AI` (144KB) —
việc kế tiếp nếu cần nhanh hơn.

### (C) "Đi làm mà không báo cáo" nay chạy cho CẢ NGÀY CŨ
**Đây là lỗ hổng phát hiện khi rà theo yêu cầu user 03/08.** Trước bản này việc tách
"chưa vệ sinh mà CÓ đi làm" ↔ "nghỉ" **chỉ có cho hôm nay**, vì nguồn duy nhất là cột `PT đi làm`
của `VESINH-YEUCAU` (chấm công hôm nay). Soi lại 1 ngày cũ thì:
- 3 thẻ KPI tụt về 2 (Đã / Chưa) · ô sơ đồ chỉ còn đỏ chung "Chưa vệ sinh"
- panel gom theo NV **biến mất** → muốn biết hôm đó ai đi làm mà im lặng phải **bấm từng ô**.

Từ 01/08 đã có `VESINH-CHAMCONG-NGAY` (60 ngày) nhưng chỉ pop-up dùng. Nay:
- `ptDiLamNgay(r, ngày)` tra chấm công **của đúng ngày đó** (chủ ô lấy theo `VESINH-PHANCONG`,
  rớt về cột của yêu cầu) → `cellStateDay` / `bkNgay` / panel gom NV đều day-aware.
- Trả `null` = *chưa đủ dữ liệu*, KHÔNG phải "nghỉ" — không tô đỏ oan người nghỉ phép, cũng không
  xoá dấu người đi làm mà im lặng. Chưa có chấm công của ngày đó thì tụt về "chỉ Đã/Chưa" như cũ
  và nói rõ lý do ở dòng gợi ý dưới sơ đồ.
- Nhãn đổi theo mốc thời gian: hôm nay = "Cần nhắc theo nhân viên" (đi nhắc) · ngày cũ =
  **"Đi làm mà không báo cáo"** (đi truy).
- Nhãn ô `remind` viết trung tính: "Chưa vệ sinh · phụ trách CÓ đi làm hôm đó".

**Nghiệm live** (`qc-live-planogram.mjs`, mở đúng URL người dùng, không lỗi JS):

| Ngày | Đã VS | Chưa VS | Không có ca | Panel |
|---|---|---|---|---|
| T2 03/08 (hôm nay) | 4 | 84 *(phụ trách CÓ chấm công — cần nhắc)* | 90 | Cần nhắc theo nhân viên · 30 NV · 84 ô |
| CN 02/08 (ngày cũ) | 19 | **79** *(phụ trách ĐI LÀM mà không báo cáo)* | 80 | **Đi làm mà không báo cáo · 30 NV · 79 ô** |

## 4i. ✅ 18/08/2026 — ẢNH BÁO CÁO GIỮ 7 NGÀY (chia 2 tầng, KHÔNG thêm lượt gọi WMS)

**Câu hỏi:** pop-up chi tiết planogram chỉ xem được ảnh 3 ngày gần nhất — có nâng lên 7 ngày được không?

**Được, và không chạm upstream lượt nào.** Ảnh nằm sẵn trong `request_image[]` của chính bản ghi
LIST `schedule-requests` mà `sync-vesinh-all.js` vẫn quét (10 ngày ở nhịp poller / 45 ngày ở cụm
sáng). Giữ 3 hay 7 ngày chỉ là chuyện GHI THÊM DÒNG xuống Sheet.

**Vì sao KHÔNG dồn hết vào 1 tab** (đo thật 18/08, `curl` thẳng `action=readTab`):

| tab | dòng | payload | thời gian |
|---|---|---|---|
| `VESINH-ANH` (3 ngày) | 309 | **398 KB** | 2,1–3,3 s |
| nếu gộp 7 ngày | ~760 | **~990 KB** | ~5–9 s |
| `VESINH-AI` (tab nặng nhất hiện nay) | — | 681 KB | 2,2 s |

Ảnh nhiều bất ngờ vì mỗi yêu cầu A1 mang trung bình ~16 ảnh (~86 ký tự/URL sau khi cắt tiền tố).
Gộp 1 tab = mọi lượt mở pop-up đều gánh ~1 MB, trong khi gần như mọi lượt xem là NGÀY HÔM NAY.

**Cách làm — 2 tầng:**
- `VESINH-ANH` giữ nguyên `VS_ANH_NGAY`=3 ngày → đường nhanh không đổi chi phí (vẫn ~400 KB).
- Tab mới `VESINH-ANH-CU` = ngày 4→7 (`VS_ANH_CU_NGAY`=7, trần = `VS_YC_DAYS`), 453 dòng ≈ 589 KB.
  Dashboard **chỉ gọi khi người dùng soi một ngày không có trong tab nhanh** (`canAnhNgay()` — nhận
  biết bằng chính cột `Ngày` của tab nhanh, không hard-code số 3 ở 2 nơi). Ảnh 2 tab gộp vào chung
  một sổ `S.anh.by` nên 4 chỗ vẽ ảnh (danh sách NV, pop-up ô, modal yêu cầu, lightbox) không đổi gì.
- GAS: thêm `VESINH-ANH-CU` vào `SERVE_PRIVATE_TABS` (deploy bằng clasp → **@60**, URL không đổi).
  Sync probe `gasPhucVuTab` trước khi ghi nên thứ tự bắt buộc vẫn là **GAS trước, sync sau**.

**Nghiệm live** (`qc-anh-7ngay.mjs`, mở đúng URL người dùng):

| bước | kết quả |
|---|---|
| pop-up ô HÔM NAY | 24 ảnh · gọi `VESINH-ANH` ×1 · `VESINH-ANH-CU` **×0** |
| chuyển sang 12/08 rồi mở pop-up | 24 ảnh · `VESINH-ANH-CU` ×1 (trước đây: rỗng) |
| lỗi console | không |

⚠ **BẪY ĐÃ DÍNH:** lượt QC live ĐẦU TIÊN báo "ngày cũ vẫn không có ảnh" trong khi bản local chạy
đúng — vì GitHub Pages/CDN còn cache module theo URL cũ `hasaki-planogram.js?v=20260801d`. Đổi
`?v=` trong `index.html` (nay `v=20260818a`) rồi đợi CDN là hết. Đừng đi sửa logic khi gặp triệu
chứng này: kiểm `curl` nội dung file live trước.

### Lỗi user bắt được ngay chiều 18/08 (ô `F0-A1-511-08-04-01`, bấm ngày 14/8)

Pop-up báo **"Ảnh báo cáo (0) · ảnh chỉ lưu 7 ngày gần nhất"** trong khi 14/8 cách hôm nay 4 ngày
và Sheet có đủ **16 ảnh** (`VESINH-ANH-CU` #25370202). Gốc: "ngày đang xem" có **HAI nguồn** —
`khoang()` của màn hình và `VT.ngay` riêng của pop-up ô (đổi bằng dải ô ngày trong chính pop-up).
`canAnhNgay()` bản đầu chỉ xét `khoang()`, mà `vtNgay()` thì chỉ `renderVt()` ⇒ đường bấm ngày
TRONG pop-up không bao giờ kéo tầng ảnh cũ. Chữa: `canAnhNgay()` xét thêm `VT.ngay` khi pop-up đang
mở, và `vtNgay()` gọi `canAnhNgay()` trước khi vẽ. (QC cũ không bắt được vì nó đổi ngày bằng
`setNgay()` — đúng đường màn hình, sai đường người dùng thật hay dùng.)

Sửa kèm — **câu thông báo cũ nói dối 3 tình huống khác nhau**: nay tách rõ "đang tải ảnh báo cáo…"
(nguồn chưa về) ↔ "yêu cầu này không kèm ảnh báo cáo" (nguồn đã phủ ngày đó mà không có ảnh) ↔
"ảnh chỉ lưu trên dashboard 7 ngày gần nhất" (thật sự ngoài cửa sổ). Nghiệm live `?v=20260818d`:
bấm 14/8 → "Ảnh báo cáo (16)", 4 ô + nút "+12", tải thêm 2,7 MB, gọi đúng 1 lượt `VESINH-ANH-CU`.

## 4j. ✅ 18/08/2026 — ẢNH: ĐO CHI PHÍ THẬT rồi HOÃN TẢI (không dựng kho ảnh)

**Câu hỏi của user:** lưu sẵn ảnh 7 ngày ở một nơi, chỉ tải ảnh của yêu cầu MỚI, khỏi tải lại —
để vừa nhanh vừa không đè hệ thống. Đo trước khi làm, và số đo lật ngược một nửa giả thiết:

| đo được (18/08) | số |
|---|---|
| Kích thước 1 ảnh báo cáo (8 mẫu) | **451–769 KB**, trung bình ~520 KB (ảnh gốc điện thoại) |
| Mở 1 pop-up ô | **36 ảnh · 18,6 MB · 16,8 s** (chỉ để vẽ thumbnail 34–56px) |
| Mở LẠI đúng ô đó | **0 lượt · 0 KB** |
| Nơi phát ảnh thật | `cdn-media-wms.inshasaki.com` (**Cloudflare**), không phải server WMS |
| Header WMS `.../filesmanagement/planogram/standard/<f>` | `302` → CDN, `cache-control: public, max-age=518400, immutable` (6 ngày) |
| Header CDN | `Cache-Control: max-age=604800` (7 ngày) |
| CDN có đường resize? | **KHÔNG** — `/cdn-cgi/image/width=…` trả 404, `?width=`/`?w=` bị bỏ qua, không thương lượng webp |

**Kết luận 1 — phần "khỏi tải lại" KHÔNG cần làm gì:** trình duyệt đã giữ ảnh 6–7 ngày theo đúng
header của WMS/CDN; mở lại tốn 0 byte. Dựng kho ảnh riêng chỉ để tránh tải lại là làm lại việc
hạ tầng đang làm không công.

**Kết luận 2 — kho ảnh riêng KHÔNG đáng:** muốn có thumbnail nhỏ thì máy trạm phải tải **bản gốc
một lần**: ~2.000 ảnh/ngày × 520 KB ≈ **1,05 GB/ngày** kéo về (đúng thứ cần tránh), rồi resize.
Chỗ chứa cũng không có: repo GitHub Pages phình vĩnh viễn vì git giữ lịch sử (xoá ảnh ngày thứ 8
không giảm dung lượng, ~14.000 file/7 ngày); Drive phục vụ ảnh public chậm và hay chặn hotlink;
GAS phục vụ bytes thì sàn ~2 s/lượt. Biến thể đáng làm sau này: chỉ mirror ảnh của ca **AI chấm
KHÔNG ĐẠT** (vài chục ảnh/ngày) để giữ hồ sơ bằng chứng lâu hơn 7 ngày — thứ mà cache không thay được.

**Đã làm — 2 lớp, đo lại sau mỗi lớp:**

1. `imgAnh()` + `lazyQuet()` — thumbnail mang `data-src`, chỉ đổi thành `src` khi lọt khung nhìn
   (IntersectionObserver, đệm 240 px; không hỗ trợ thì tải thẳng như cũ). Áp cho cả 3 chỗ vẽ ảnh
   (pop-up ô · danh sách theo dõi · modal yêu cầu).
   **Đo lại: 18,6 MB → 9,2 MB.** Chưa đủ, vì 24 ô thumbnail của pop-up NẰM TRỌN trong tầm nhìn ⇒
   "hoãn" không hoãn được gì. *(Bài học: lazy chỉ cứu được thứ nằm ngoài màn hình.)*
2. Pop-up bày sẵn `ANH_XEM_TRUOC` = **4 ô**, phần còn lại giấu sau nút `+N` (`moAnhHet()` trải hết
   lưới khi người dùng CHỦ ĐỘNG bấm). Lightbox vốn đã chỉ dựng 1 thẻ `<img>` mỗi lượt.

**Số đo live sau cùng** (bản `?v=20260818c`):

| | trước | sau |
|---|---|---|
| Mở 1 pop-up ô | 36 ảnh · **18,6 MB** · 16,8 s | 4 ô + nút "+20" · **2,49 MB** · **1,81 s** |
| Mở lại đúng ô đó | 0 KB | 0 KB (cache trình duyệt) |
| Bấm "+N" xem cả bộ | — | +11 MB (người dùng chủ động chọn) |
| Dựng màn hình đầu | không tải ảnh | không tải ảnh (2,93 s) |

Muốn bày nhiều/ít ô hơn: sửa `ANH_XEM_TRUOC` (mỗi ô ≈ 0,5 MB, quy đổi thẳng ra băng thông).
Kèm theo: sửa lời nhắc "ảnh chỉ lưu 3 ngày" → **7 ngày**. QC: `qc-anh-7ngay.mjs` (nhận `QC_URL=`
để soi bản localhost trước khi deploy — Pages/CDN trễ 5–8 phút, đừng sửa logic khi gặp triệu chứng
"bản mới không ăn").

## 5. Công cụ nghiên cứu đã tạo (read-only, tôn trọng luật phiên)
`.exports/` chứa bằng chứng: `probe-planogram*.json`, `captured-planogram-authed.json`.
Script: `capture-planogram.mjs`, `capture-planogram-authed.mjs` (nạp token bridge vào
`localStorage.auth_store` để SPA tự gọi API — KHÔNG login), `probe-planogram-token.mjs`,
`probe-planogram2/3/4.mjs`, `probe-vesinh-anh.mjs` (kiểm chứng request_image + tải ảnh),
`capture-planogram-tab.mjs` (test render tab mới bằng dữ liệu --dry, không đụng GAS),
`qc-live-planogram.mjs` (03/08 — mở THẲNG letam0317.github.io/kiemsoatkho tab planogram, đo thời
gian dựng màn hình + in 3 thẻ KPI cho hôm nay và một ngày cũ + đếm ảnh pop-up + bắt lỗi JS).
Tất cả CHỈ GET; dùng làm nền cho `sync-vesinh-all.js`.
