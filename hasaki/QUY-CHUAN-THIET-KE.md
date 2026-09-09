# BỘ QUY CHUẨN THIẾT KẾ — bản nháp v0.1 (07/09/2026) · CHỜ DUYỆT

> Nguồn: token + khuôn đang chạy thật trong `factory/index.html` và `kiemsoatkho/index.html`
> (+ module `hasaki-*.js`), 9 luật điện thoại + 17 bẫy trong bộ nhớ dự án, các lần anh chốt / chê
> ("thô" khi dùng `<select>` trần · "TẠI SAO VẪN CÒN ICON" · "quá to và thô" nút `!` · "load quá lâu").
> Quan hệ: `BO-CHUAN-PHAT-TRIEN.md` §6 giữ **LUẬT** (9 luật điện thoại, cấm control trần, bộ đo);
> file này giữ **HỆ THIẾT KẾ**: token, khuôn thành phần, khi nào dùng cái gì. Không lặp lại chi tiết
> 9 luật, chỉ trỏ. `QUY-CHUAN-GIAO-TIEP.md` giữ chữ trên màn.
> Repo PUBLIC — file này không chứa bí mật.

---

## 0. ĐIỂM CẦN ANH QUYẾT

| # | Vấn đề | Hiện trạng đo được | Đề xuất của tôi |
|---|---|---|---|
| 1 | Cách tắt chuyển động khi người dùng bật "giảm chuyển động" | Hai dashboard làm hai kiểu: factory ép `animation-duration:.01ms` (rồi phải vá riêng cho vòng lặp vô hạn ở Nhận diện SKU vì nhấp nháy + icon trống); 5S dùng `animation:none` | Thống nhất **`animation:none` + khai trạng thái cuối** cho vòng lặp vô hạn ở cả hai |
| 2 | Phông chữ | factory: stack hệ thống; kiemsoatkho: Inter tải từ Google (đã đặt không chặn vẽ 05/09) | **Một stack hệ thống cho cả hai**, bỏ tải Inter (nhanh hơn trên 3G, không lệch chữ giữa 2 dashboard) |
| 3 | Theme mặc định cho máy mới | `:root` = tokyo (tối) | Giữ tokyo; hasaki (sáng, màu thương hiệu) là theme cho trình chiếu |
| 4 | `#kkmodal` (factory) | Vẫn cuộn ngang trong khi bản sinh đôi bên 5S đã là thẻ; đang đạt 12 luật | Giữ đến khi chạm vào, lúc đó chuyển `mbcard` |
| 5 | 4 pop-up dùng bản chép riêng (`#prmodal` `#tvtmodal` `#abnmodal` `.ht-mtbl`) | Chạy tốt, chưa di trú | Không di trú chủ động; bảng MỚI bắt buộc `mbcard` |
| 6 | Bộ 8 kiểu tiêu đề | Đang có, dùng qua combo ở header | Giữ, nhưng khoá không thêm kiểu mới |

---

## 1. TRIẾT LÝ (đọc 30 giây)

1. **Một dữ liệu, hai hình thái.** Màn 24" cần mật độ cao (bảng 10–13 cột, nhãn 9–10px); điện thoại
   thủ kho cần **thẻ**. Không bóp cái này cho vừa cái kia.
2. **Tối giản bằng chữ.** Không icon, không khối hướng dẫn, ô không mang tin thì ẩn. Vào tab là thấy
   ô nhập hoặc số liệu ngay (mẫu: tab Nhận diện SKU).
3. **Một hệ, hai dashboard.** Cùng token, cùng keyframes, cùng tên lớp (`mbcard`, `combo`, `h2tip`,
   `toptabs`). Sửa ở một dashboard thì sửa cả hai, không thì nửa kia lặng lẽ tái phát.
4. **Tái dùng trước khi viết mới.** Grep tìm pattern tương đương rồi dùng lại class. Bản chép riêng
   là nguồn của mọi chỗ bị bỏ sót.
5. **Dữ liệu thật ngay từ bản nháp.** Thủ phạm làm vỡ bố cục là chuỗi thật dài (tên vải 90 ký tự,
   `WH - MATERIAL - GARMENT`). Skeleton dùng đúng class thật và giữ đúng chỗ.
6. **Cái gì hiển thị thì phải đo được.** Màn mới → vào danh sách màn của bộ đo trước khi nói xong.

---

## 2. TOKEN

### 2.1 Màu ngữ nghĩa — chỉ dùng biến, không hardcode

| Biến | Dùng cho |
|---|---|
| `--bg` · `--surface` · `--surface2` | nền trang · nền thẻ/pop-up · nền lớp thứ hai (ô lọc, hàng xen kẽ) |
| `--border` | mọi viền 1px |
| `--text` · `--muted` | chữ chính · nhãn, chú giải, đơn vị |
| `--accent` · `--accent-hover` · `--accent-text` | hành động chính, focus ring, chip đang chọn · hover · chữ trên nền accent |
| `--good` · `--warn` · `--bad` · `--info` | đạt / lệch dương · cần chú ý · lỗi, lệch âm · thông tin trung tính |
| `--hover` · `--overlay` · `--shadow` | nền hover hàng · lớp mờ sau modal · bóng thẻ |
| `--skeleton` · `--skeleton-hi` | hai đầu dải shimmer |

- Alias cũ còn sống để tương thích (`--panel --ink --ink2 --ink3 --line --brand2 --primary`): **code
  mới không dùng**, dùng tên gốc ở bảng trên.
- Màu chỉ hardcode ở: palette chuỗi dữ liệu (§2.3), màu thương hiệu công ty, nét vẽ SVG minh hoạ 5S.

### 2.2 Bảy theme — 4 tối, 3 sáng, mỗi theme khai đủ 18 biến

| Theme | Nền | Accent | Good | Info | Warn | Bad |
|---|---|---|---|---|---|---|
| tokyo (mặc định) | `#1a1b26` | `#7aa2f7` | `#9ece6a` | `#7dcfff` | `#e0af68` | `#f7768e` |
| dracula | `#282a36` | `#bd93f9` | `#50fa7b` | `#8be9fd` | `#f1fa8c` | `#ff5555` |
| nord | `#2e3440` | `#88c0d0` | `#a3be8c` | `#81a1c1` | `#ebcb8b` | `#bf616a` |
| mocha | `#1e1e2e` | `#89b4fa` | `#a6e3a1` | `#89dceb` | `#f9e2af` | `#f38ba8` |
| latte | `#eff1f5` | `#1e66f5` | `#40a02b` | `#209fb5` | `#df8e1d` | `#d20f39` |
| solar | `#fdf6e3` | `#268bd2` | `#859900` | `#2aa198` | `#b58900` | `#dc322f` |
| hasaki | `#eef3f0` | `#326e51` | `#326e51` | `#2f7d63` | `#c98a1e` | `#c0392b` |

- Thêm theme = khai đủ 18 biến ở **cả hai** dashboard cùng commit; thiếu một biến là một theme vỡ ở
  một chỗ không ai thấy.
- Chữ `--text` trên `--surface` phải đọc được ở cả 7 theme; kiểm bằng mắt trên máy sáng + tối trước
  khi push, không thêm màu chữ riêng cho từng theme.
- Theme lưu ở `localStorage`, đổi qua combo ở header, áp ngay không tải lại.

### 2.3 Palette chuỗi dữ liệu và màu cố định

- Chuỗi `--s1…--s8` theo thứ tự, không đảo, không chọn tay:
  `#2563eb` · `#c2410c` · `#0d9488` · `#ca8a04` · `#db2777` · `#4d7c0f` · `#7c3aed` · `#0e7490`.
- Màu công ty **không đổi theo theme**: Mastige `#2563eb`, Garment `#0d9488`. `--teal #0d9488`,
  `--amber #d97706` là hằng.
- Dải trạng thái phiếu / kết luận dùng `--good/--warn/--bad`, không lấy từ palette chuỗi.

### 2.4 Hình khối

| Thứ | Giá trị |
|---|---|
| Bo góc thẻ, pop-up, panel | `--radius` = 16px |
| Bo góc chip, ô nhập, skeleton | 8px |
| Chip dạng viên (tab-chip `.kktab`) | 999px |
| Viền | 1px `var(--border)` |
| Bóng thẻ / bóng modal | `--shadow` (theo theme) / `--shadow-lg` |
| Lớp mờ sau modal | `rgba(17,24,39,.5)` + `backdrop-filter: blur(9px)` |
| Thanh cuộn | 6px, thumb `color-mix(--muted 45%)`, hover 75% |

### 2.5 Chuyển động — 3 easing, 8 keyframes chuẩn

- `--ease` `cubic-bezier(.4,0,.2,1)` cho hover, opacity, đổi màu (.22s).
- `--ez-apple` `cubic-bezier(.32,.72,0,1)` cho trượt, mở pane, sheet.
- `--ez-spring` `cubic-bezier(.175,.885,.32,1.12)` cho popIn, menu, thẻ nhỏ nảy.

| Keyframe | Dùng cho | Không dùng cho |
|---|---|---|
| `fadeUp` | khối nội dung vào lần đầu | re-render khi lọc |
| `paneIn` | đổi tab | pop-up |
| `popIn` | menu combo, tooltip, thẻ kết quả | phần tử định tâm bằng `translateX(-50%)` |
| `barIn` | phần tử định tâm `translateX(-50%)` (giỏ SKU nổi) | mọi thứ khác |
| `sheetIn` | modal, bottom-sheet | menu |
| `menuIn` | menu ngữ cảnh nhỏ | pop-up |
| `fadeIn` | lớp mờ, đổi trạng thái | chuyển động vị trí |
| `shimmer` | skeleton (1.3s lặp) | nội dung thật |

- Keyframe chuyên đề đang có (`nds*`, `pr*`, `cnpulse`, `dpSheetUp`, `sideVao`, `wrapVao/Ra`,
  `rise`, `sp`) là **ngoại lệ có chủ đích** cho hiệu ứng riêng một mục; không lấy làm mẫu, không nhân bản.
- Thời lượng .18–.3s; chỉ `sheetIn` được tới .4s. Không tự chế keyframe mới khi bộ trên còn dùng được.
- **Không chạy lại animation vào khi re-render do lọc** (bài học Planogram 30/07: 3–4 khung trắng);
  đổi nội dung theo filter dùng `.is-filtering` / `kkSwap`.
- `prefers-reduced-motion` đã có ở cả hai (điểm quyết 1 chốt cách viết). Bẫy đã dính: ép
  `.01ms` lên **vòng lặp vô hạn** thành nhấp nháy, và icon vẽ nét (`stroke-dashoffset`) đứng ở 0%
  = trống. Animation lặp vô hạn mới thêm **phải** có nhánh `animation:none` + trạng thái cuối.

### 2.6 Chữ

- Stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
  (điểm quyết 2). Mono cho mã/UID/mã vị trí: `ui-monospace, Consolas, monospace`.
- Thân 14px / 1.55 / letter-spacing −.003em, antialiased.
- Thang cỡ đang dùng, **cỡ mới phải chọn trong thang**: 9.5–10 (nhãn field máy tính) · 10.5 (sàn
  điện thoại) · 12 · 12.5 (tab-chip) · 14 (thân) · `clamp(12px,1.5vw,14px)` (chip) · tiêu đề theo lớp
  `h2` sẵn có.
- Nhãn field: uppercase, 9.5–10px, letter-spacing .06em, màu `--muted` (khuôn `.mfilters label`,
  `.fcctl label`). Trên điện thoại nâng lên 10.5px bằng selector tường minh ở **cuối `<style>`**.
- Số dày (bảng, KPI): `font-variant-numeric: tabular-nums` để cột thẳng hàng — lệ đang có
  (79 chỗ factory · 15 chỗ 5S), bảng/KPI mới bắt buộc.

### 2.7 Khoảng cách và khung trang

- `.wrap` max 1720px, padding `20px clamp(20px,3.2vw,52px) 40px`, `min-height:100dvh`, flex-column,
  footer neo đáy bằng `margin-top:auto`.
- Khe: 4 · 8 · 12 · 16 · 20px. Header gap 12px. Không dùng số lẻ khác ngoài thang.
- Chiều cao control trên điện thoại: **40px đúng ngưỡng chạm**, không hơn để thanh không vượt 1/4 màn.

### 2.8 Lớp z-index

- `.modal` 99 · giỏ nổi dưới modal · `#pcmodal` 105 là **nợ đã biết** (chồng pop-up).
- Luật: **một pop-up một lúc**. Mở pop-up thứ hai từ trong pop-up = sai thiết kế; thay bằng
  hyperlink ↗ sang WMS (mã phiếu) hoặc đổi view trong cùng pop-up (`kkSetView`).

---

## 3. KHUÔN THÀNH PHẦN — lớp · khi dùng · cấm

| Thành phần | Lớp / khuôn sẵn có | Dùng khi | Cấm |
|---|---|---|---|
| Nút chính | nền `--accent`, chữ `--accent-text`, chữ 600 | một hành động chính mỗi khung | 2 nút chính cạnh nhau |
| Nút phụ | viền `--border`, nền `--surface` | hành động phụ, huỷ | nút không viền không nền (trần) |
| Tab-chip | `.kktab` (999px, 12.5px/600, `--muted`) | lọc/nhóm giá trị **cùng loại** | xếp dọc; bóp cắt nhãn |
| Chip nhãn | `.chip` (nền `--c`, 800, .06em) | mã ngắn, trạng thái | câu dài |
| Dải chip | `.toptabs` (1 hàng, `nowrap` + `overflow-x:auto`, con `flex:0 0 auto`) | ≥4 chip cùng loại | `flex-wrap` thành răng cưa |
| Chip đếm 0 | `.hp-z0` / `.pg-z0` (`opacity:.45`) | luôn | ẩn chip 0 |
| Combo | `.combo` + `.combo-menu` (popIn; item có count; mục "Tất cả") | mọi dropdown/bộ lọc | `<select>` trần |
| Menu ẩn | `display:none` → hiện bằng popIn | luôn | `visibility:hidden` (nới vùng cuộn) |
| Modal | `.modal` (overlay + blur 9px, sheetIn, `body.ovl-open`) · nút đóng `×` ≥44px | chi tiết một bản ghi | chồng modal; modal không nút đóng |
| Bottom-sheet | khuôn sheet của bộ lọc (`sheetIn`, `left/right` chốt viewport) | menu, tooltip, bộ lọc trên máy cảm ứng | menu neo `absolute` trong khung cuộn ngang (bị cắt) |
| Tooltip `i` | `.h2tip` / `TAB_TIP` / `tipMuc()` (1.15em, viền mảnh, opacity .75) | giải nghĩa 1–2 câu, đặt sát tiêu đề mục | nút `!` to; đóng cứng px; `title` |
| Bảng máy tính | `<table>` thead hiện | ≥5 cột, số dày | `innerHTML` chục nghìn dòng |
| Bảng điện thoại | `table.mbcard` + `mb-hd` `mb-tag` `mb-full` `mb-act` `mb-0` + `data-lb` (6 bước ở memory `qc-bo-cuc-dien-thoai`) | mọi bảng mới | tự viết `tr{display:flex}`; nhãn theo `nth-child` |
| Miễn trừ cuộn ngang | `data-mb-cuon="<lý do>"` | ma trận dày số, nhiều view | miễn trừ im lặng |
| Thanh lọc | hàng 1: chip cuộn ngang + nút hành động ghim phải; hàng 2–3: **grid 2 cột** | mọi thanh lọc tab | `flex-direction:column`; `display:contents` ở điện thoại; >1/4 màn |
| Bộ chuyển chế độ | `.pg-seg` / `.hp-seg`, ≥40px | đổi view trong cùng panel | cỡ `sm` 27px |
| Dải chỉ số | `.kksum` / thẻ `.ks`, cuộn ngang + `min-width` | 4–7 KPI | `text-overflow:ellipsis` cắt nhãn |
| Skeleton | `.sk` shimmer, `.sk-card` 96px, dùng **class thật** + kích cỡ chỗ giữ | mọi vùng chờ dữ liệu | spinner; skeleton khác kích cỡ nội dung thật |
| Cột phải chốt bề rộng | `minmax(280px,380px)` → chốt 380px + skeleton | bố cục 2 cột có sơ đồ | để cột co giãn theo dữ liệu (nhảy khi F5) |
| Banner cảnh báo | `.hp-alertbar.warn` 1 dòng + hành động | độ phủ thiếu, dữ liệu cũ | banner không hành động |
| Trạng thái rỗng / lỗi | khuôn câu §3.4 `QUY-CHUAN-GIAO-TIEP` + nút "Thử lại" | luôn | vẽ rỗng im lặng |
| Xem thêm | CAP 200 dòng + nút "Xem thêm" (tổng vẫn đếm đủ) | danh sách >200 | render hết |
| Bảng chọn hạng mục | `.hm-card` từ `HOME_MUC` (nguồn duy nhất), mô tả 1 câu, viền màu `cc` | trang Tổng quan | sửa danh sách tab ở 2 chỗ |
| Đoạn văn dài | kẹp `-webkit-line-clamp` 3–4 + `::after` "xem thêm/thu gọn"; chỉ >160 ký tự mới bấm | lý do AI, quy định 5S | tường chữ; mọi trường đều bấm |
| Ghi chú theo ngữ cảnh | `.pcdnote` hiện theo số vừa nhập | kết luận đúng lúc | khối hướng dẫn thường trực |
| Link ra WMS | chữ + ↗, `target=_blank` | mã phiếu, kế hoạch | pop-up con |
| Footer | neo đáy, chữ `--muted` | luôn | footer trôi giữa trang khi nội dung ngắn |
| Tem in UIDgr 40×60 | khuôn dòng cố định, mã vạch ưu tiên, dòng phụ hệ số 0.72 | in tem | thêm dòng làm mã vạch nhỏ hơn |
| Form 5S | `form.html`, PIN **chỉ ở đây** | ghi nhận 5S | PIN ở bất kỳ chỗ khác |

---

## 4. BỐ CỤC

- **Máy tính**: `.wrap` 1720; bố cục 2 cột khi có sơ đồ (trái `minmax(0,1fr)` · phải chốt 380px,
  `align-items:stretch`); **nén dọc** để A1+A8 lọt một khung nhìn 800–900px không cuộn; KPI một hàng.
- **Điện thoại**: 9 luật ở `BO-CHUAN-PHAT-TRIEN` §6 (không lặp). Máy đo: iPhone SE 375 · iPhone 14
  390 · Android hẹp 360 · Pixel 7 412; máy mô phỏng chuẩn khi làm tay: **390×844, isMobile, hasTouch,
  DPR 2**; dữ liệu thật qua gviz.
- **Thứ tự theo hành động**: sắp khối theo việc người dùng làm, không theo cấu trúc dữ liệu
  (Nhận diện SKU: 1 Ảnh tem → 2 SKU gợi ý → 3 Từ khoá).
- **Màn ngắn là chỗ vỡ**: kiểm ngưỡng "≤1/4 màn" trên iPhone SE 667px, không chỉ Android 800px.
- Trang không kéo ngang; khung cuộn ngang trong flex phải có `min-width:0`.
- Trang Tổng quan **cấm** chạm tab thô 21 MB; Kiểm kê và Planogram không prefetch, thẻ hiện "—" tới
  khi mở tab.

---

## 5. DỮ LIỆU VÀ BIỂU ĐỒ

- Chuỗi dữ liệu lấy `--s1…--s8` theo thứ tự; công ty lấy màu cố định; trạng thái lấy màu ngữ nghĩa.
- Chart theo ngày đọc từ tab history; nhãn trục không cắt, số qua `nf()`.
- Bảng dày số được cuộn ngang khi **tự khai miễn trừ**; ma trận lật (mỗi cột là một lần vi phạm) là
  ngoại lệ hợp lệ, cột trường đóng băng bên trái.
- Số 0: chip lọc → **mờ**; ô trong thẻ → **ẩn** (`mb-0`). Hai quy tắc khác nhau vì chip là câu trả
  lời hợp lệ, ô là dòng rỗng có nhãn.
- Ô "—" trên máy tính giữ cột thẳng hàng nên có nghĩa; trong thẻ thì ẩn.
- Chênh lệch có dấu và màu; không dùng màu thay dấu.

---

## 6. KÝ HIỆU VÀ HÌNH

- **Cấm emoji** trong UI. Cho phép: ✓ ✗ ✕ ⚠ → ↗ ↑↓ ‹ › · … và `i` cho chú thích.
- SVG minh hoạ 5S (nét ✦ ♪ là tranh) và mã vạch là hình duy nhất được vẽ.
- Favicon SVG data-URI (5S: ngôi sao đỏ `#d81e05`); logo `hasaki-logo.png` chỉ ở header.
- Kích cỡ ký hiệu ăn theo `em` của chữ đứng cạnh, không đóng cứng px.

---

## 7. TRẠNG THÁI TƯƠNG TÁC

| Trạng thái | Khuôn |
|---|---|
| Focus | `outline:0; border-color:var(--accent); box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 16%,transparent)` |
| Hover | nền `--hover`, transition .22s `--ease` |
| Đang chọn | viền `--accent`; phần tử khác mờ (soi NV trên sơ đồ) |
| Disabled | opacity + cursor; nút `await` **luôn** `finally` mở lại |
| Đang xử lý | nhãn dạng tiếp diễn (ví dụ "Đang in…") + khoá nút; cờ có đường reset khi lỗi/offline |
| Vùng chạm | ≥40px control, ≥44px nút đóng; hộp kiểm gốc bắt chạm ở **ô** (`pcCellTap`) |

---

## 8. HIỆU NĂNG HIỂN THỊ (chi tiết ở `BO-CHUAN-PHAT-TRIEN` §4)

CAP 200 dòng · chia lô 2000 + nhường luồng · index map O(1) · cache lowercase một lần · skeleton
giữ chỗ chống layout-shift · font không chặn vẽ · chunk theo tháng, tải trước chunk kế.

---

## 9. KIỂM 10 MỤC TRƯỚC KHI ĐƯA UI MỚI RA BẢN NỘI BỘ

1. Đã grep tìm khuôn tương đương và tái dùng class chưa? Có control trần nào không?
2. Màu qua biến hết chưa? Đủ 7 theme chưa (bật từng theme nhìn một lượt)?
3. Animation lấy từ bộ 8 keyframe chưa? Có chạy lại khi lọc không?
4. Có emoji, có khối hướng dẫn, có nhãn chỉ dẫn trong ngoặc không? Chú thích đã vào nút `i` sát mục chưa?
5. Bảng mới đã `mbcard` đủ 6 bước chưa? Có ô không mang tin cần `mb-0` không?
6. Thanh lọc trên 375px cao bao nhiêu hàng, bao nhiêu px? Có vượt 1/4 màn iPhone SE không?
7. Nhãn nào có thể bị cắt ellipsis trên 360px?
8. Chữ nhỏ nhất trên điện thoại là mấy px (sàn 10.5)?
9. Trạng thái tải / rỗng / lỗi / offline đã có đủ 4 và đúng khuôn câu chưa?
10. Màn này đã vào `man[]` của `qc-mobile-toan-du-an.mjs` với `sanSangMan` bám số thật chưa?
    Chạy `--file` trước, đẩy, kiểm số byte, chạy live sau.

---

## 10. NỢ THIẾT KẾ ĐANG BIẾT (không phải lỗi mới, đừng báo lại)

- 4 pop-up dùng bản chép riêng khuôn thẻ (điểm quyết 5).
- `#kkmodal` cuộn ngang, khác bản sinh đôi bên 5S (điểm quyết 4).
- `#pcmodal` z-index 105 đè `.modal` 99 vì `kkOpen` không set `body.ovl-open`.
- Alias biến màu cũ (`--ink`, `--line`…) còn sống trong nhiều rule.
- kiemsoatkho tải font Inter (điểm quyết 2).
- Tài liệu cũ trong `hasaki/` còn emoji ở tiêu đề.

---

## NHẬT KÝ

- **07/09/2026** — Khởi tạo bản nháp v0.1 theo yêu cầu "tạo bộ quy chuẩn thiết kế… để xem-duyệt
  thành chuẩn chung". Token trích trực tiếp từ `factory/index.html` (7 theme, 8 keyframe, easing,
  radius, palette s1–s8) và đối chiếu `kiemsoatkho/index.html` (cùng 7 theme, lệch phông Inter).
  6 điểm chờ anh quyết ở §0.
