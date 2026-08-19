# Nhận diện SKU — chụp tem NCC ra mã SKU nội bộ

Tab thứ 5 của **Audit Factory** (`factory/index.html`). Thủ kho chụp tem nhà cung cấp trên điện
thoại → AI đọc từ khoá → dashboard đối soát với danh mục SKU nguyên liệu → gợi ý **Top 3 SKU** kèm
% độ tin cậy → bấm một nút là SKU vào **giỏ "Tạo lệnh kiểm kê"** đang dùng ở tab Kiểm kê.

Dựng ngày **18/08/2026**. Ba tầng độc lập — tầng dưới không phụ thuộc tầng trên, nên **mất mạng /
hết hạn mức AI vẫn dùng được**:

| Tầng | Ở đâu | Vai trò | Hỏng thì sao |
|---|---|---|---|
| 1. Danh mục | tab Sheet `SKU_MASTER` | 5.610 SKU 3 kho nguyên liệu (kèm đơn vị tính) | dùng bản cache trong máy (12h), có ghi rõ tuổi |
| 2. **Mã vạch** | `BarcodeDetector` sẵn trong trình duyệt | ảnh → mã vạch, **~0,1 s, không mạng** | tụt xuống tầng 3/4 |
| 3. **Sổ tay tem** | `localStorage` trên máy | chữ ký tem / mã vạch → SKU **người đã chốt** | tem lạ thì tụt xuống tầng 4 |
| 4. Đọc tem bằng AI | Apps Script `action=sku_vision` → Gemini | ảnh → chữ + từ khoá gắn vai, **~5 s** (model 2 s + 2 s phí 2 chặng GAS) | tụt xuống tầng 5 |
| 5. **OCR của Google** | Apps Script `action=sku_ocr` → Drive OCR | ảnh → **chữ thô**, ~7,4 s, **MIỄN PHÍ** (0 hạn mức AI) | gõ mã trên tem / dán chữ |
| 6. Đối soát | 100% trong trình duyệt (`NDS_ENGINE`) | trọng số 45/25/20/10 + fuzzy, vai lấy bằng chứng từ danh mục | — (không phụ thuộc mạng) |

> **Thứ tự CÓ CHỦ Ý, và đã đảo một lần** (chiều 19/08/2026, sau khi thủ kho báo *"đọc quá lâu >20s"*):
> tầng 2–3 vẫn chạy trước vì chúng **0 giây, 0 mạng**. Nhưng giữa AI và OCR thì **AI đứng trước** —
> đo thật: AI ~5 s còn OCR ~7,4 s (riêng Drive chuyển ảnh sang Google Docs đã 3–4 s, không sửa được),
> và AI còn **đúng hơn** ở tem chữ nhỏ/nhoè. OCR giữ đúng vai trị giá nhất của nó: **chạy khi AI hết
> hạn mức / trả JSON sai khuôn** — tức đúng ca "không có kết quả nào". Chi tiết + số đo: **mục 5b**.

---

## 1. Danh mục `SKU_MASTER`

`node sync-sku-master.mjs` — WMS `report-management/stock-inventories` → tab `SKU_MASTER` của Sheet
factory (`1eY_oo9f…`). **5 cột đầu là hợp đồng, đừng đổi thứ tự** (dashboard kiểm cột rồi mới nạp);
cột F thêm 19/08/2026, chỉ nối vào cuối nên bản dashboard cũ vẫn đọc được:

```
A SKU · B PRODUCTNAME · C TYPE (COMBO|NORMAL) · D STATUS (ACTIVE|INACTIVE) · E INVENTORY_QTY
F UNIT (đơn vị tính — đoạn cuối sau dấu "/" của PRODUCTNAME, chép nguyên chữ WMS)
```

**Phạm vi = 3 KHO NGUYÊN LIỆU** (tem NCC chỉ xuất hiện ở đó):

| Kho | id | Công ty | Dòng |
|---|---|---|---|
| WH - MATERIAL - MTG | 1177 | Mastige 1002 | 4.756 |
| NG - MATERIAL - 130 AP CHANH - MTG | 1458 | Mastige 1002 | 59 |
| WH - MATERIAL - GARMENT | 1339 | Garment 1005 | 1.174 |

⇒ **~7 lượt gọi WMS mỗi lượt sync** (luật "nhẹ tải upstream") và dashboard chỉ tải **1,0 MB** thay
vì ~20 MB. Muốn rộng ra cả factory: `--tat-ca` (≈150.000 dòng) — nhớ đo lại thời gian mở tab trên
điện thoại trước khi chốt.

**TYPE**: `product_type` của WMS; `Combo` → COMBO, còn lại (Normal / Material) → NORMAL.

**STATUS là SUY RA, không phải cờ của WMS.** Đã kiểm 18/08/2026: báo cáo này có 18 trường, **không
có** status/is_active, và `last_modified` bị làm tươi liên tục (100% dòng ≤ 90 ngày) nên không dùng
để suy ra "SKU chết". Luật đang dùng:

* `ACTIVE` = còn dấu hiệu đang dùng: `in_stock > 0` hoặc `available > 0` hoặc `in_coming > 0` (4.295 SKU)
* `INACTIVE` = không tồn, không hàng đang về (1.313 SKU)

Dashboard mặc định chỉ gợi ý ACTIVE (theo đặc tả) nhưng có công tắc **ACTIVE / Tất cả**, và khi
không có ứng viên ACTIVE nào thì **tự hiện nhóm INACTIVE kèm giải thích** — vì hàng vừa nhập lần đầu
(chưa có PO ghi nhận) cũng nằm ở nhóm INACTIVE.

Từ 19/08/2026 **mọi thẻ gợi ý luôn in chữ ACTIVE / INACTIVE** (trước chỉ vẽ badge lúc INACTIVE, nên
không phân biệt được "SKU còn sống" với "thẻ quên vẽ badge"), và các SKU cùng mặt hàng khác đơn vị
cũng hiện trạng thái của từng cái. Màu: **ACTIVE xanh, INACTIVE xám** — cố ý *không* tô đỏ, vì hàng
mới nhập lần đầu cũng nằm ở INACTIVE, tô đỏ là báo động giả. Badge TYPE hạ xuống xám để không tranh
màu với trạng thái.

### `UNIT` — đơn vị tính, và luật "luôn lấy SKU đơn vị nhỏ nhất"

WMS cũng **không** có trường đơn vị (kiểm 19/08/2026: 31 trường, không `unit`/`uom`). Đơn vị nằm ở
**đoạn cuối sau dấu `/`** của `product_name`: `…/mm` · `…/mét` · `…/gam` · `…/cuộn 5000m` · `…/pcs`.

Vấn đề: **cùng một vật tư thường có 2–3 SKU chỉ khác đơn vị.** Đo thật trên 5.610 SKU kho nguyên
liệu: **459/5.053 nhóm tên có ≥2 đơn vị** — mét↔mm, yard↔mm, "cuộn 5000m"↔mm.

```
Keo bonding/3914_Bemis/Polyurethane nhiệt dẻo/None/Clear/None/…/mét   422267173  tồn 8.200
Keo bonding/3914_Bemis/Polyurethane nhiệt dẻo/None/Clear/None/…/mm    422467512  tồn 8.200.000  ← đếm bằng cái này
```

Kiểm kê đếm bằng **đơn vị nhỏ nhất**, nên thẻ gợi ý **luôn là SKU đơn vị nhỏ nhất** của mặt hàng.
Các đơn vị lớn hơn **không bị giấu**: nằm ngay trong thẻ ở dòng *"Cùng mặt hàng, khác đơn vị"*, mỗi
cái là một nút bấm-là-chọn, kèm ĐVT + ACTIVE/INACTIVE + tồn (phòng khi bản đơn vị lớn mới là bản
đang thật sự có tồn).

Cột `UNIT` chỉ **chép nguyên chữ WMS** (không chuẩn hoá) để người đọc Sheet lọc được. Việc xếp hạng
"đơn vị nào nhỏ hơn" nằm **một chỗ duy nhất** trong `NDS_ENGINE` (hàm `donVi` / `khoaHang`) — hai
bên không có gì để lệch nhau.

`INVENTORY_QTY` = **tổng tồn 3 kho nguyên liệu** (hợp đồng 5 cột không có cột kho).

Chạy trong cụm: `SYNC-STOCK.bat`, ngay **sau** `sync-tonbatthuong` → token trong kho còn tươi nên
bước này **không bao giờ tự đăng nhập** (không đá phiên ai); không có token sống thì thoát 75 (hoãn),
lượt guard sau chạy lại. Log riêng: `sku-master.log`. Mốc bước: `.sync-ok-skumaster`.

> Cố ý **không** thêm `skumaster` vào `CAC_BUOC_SYNC` của `session-rules.js`: đó là danh sách
> watchdog dùng để phán "dữ liệu trễ trong ngày". Thêm vào là đổi luật báo động của cả cụm cho một
> bước phụ. Bước này tự lo bằng mốc riêng + hash.

---

## 2. Bớt phụ thuộc AI — mã vạch + sổ tay tem (19/08/2026)

AI ở đây chỉ làm **đúng một việc**: biến pixel thành từ khoá. Việc đó tốn **3–7 giây** và một suất
trong hạn mức ngày. Mọi thứ còn lại đã chạy offline trong trình duyệt. Nên "bớt phụ thuộc AI" =
tìm đường khác để có từ khoá / có thẳng SKU.

> **Không có chuyện "huấn luyện" model.** Gemini **không** học gì từ ảnh mình gửi — mỗi lượt gọi là
> độc lập, gửi 1.000 tấm tem giống nhau thì tấm 1.001 vẫn tốn đúng ngần ấy giây. Fine-tuning thật
> cần hạ tầng + dữ liệu gán nhãn, trái luật "không xin IT, không thêm hạ tầng". Cái học được là
> **của mình**: một cuốn sổ tra cứu — và với việc này nó còn hơn fine-tuning ở hai chỗ quan trọng:
> **giải thích được** ("lần trước tem này được chọn là SKU X") và **sửa được** (bấm "Quên ghi nhớ này").

### 2.1 Mã vạch — đường nhanh nhất

`BarcodeDetector` **có sẵn** trong Edge/Chrome trên Android: không tải thêm thư viện nào, chạy
offline, ~0,1 giây. Có ảnh là dashboard **tự thử ngay và im lặng** (`ndsDatAnh` → `ndsThuMaVach`),
không đợi người bấm.

* Con số quét được **trùng một SKU nội bộ** (hàng đã dán tem kho) → khớp tuyệt đối, xong.
* Không trùng → nó là mã của NCC: đưa vào vai **MÃ** rồi tra **sổ tay** (2.2). Lần đầu người xác
  nhận một lần, từ đó về sau quét phát là ra.
* Máy tính để bàn (Edge/Windows) **không có** API này — dashboard nói rõ ở dòng chân chứ không im.

### 2.2 Sổ tay tem — thư viện tự học

`localStorage['nds-so-v1']`, trần 5.000 ghi nhớ (đầy thì bỏ mục **cũ nhất** — tem theo mùa/đơn hàng,
lâu không gặp thì gần như chắc chắn không gặp lại). Hai loại khoá, trúng cái nào cũng được:

| Khoá | Từ đâu | Vì sao |
|---|---|---|
| `bc:<mã vạch>` | quét được ở 2.1 | chắc nhất — không phụ thuộc chữ đọc đúng hay sai |
| `tk:<chữ ký>` | `NDS_ENGINE.chuKy()` | tem không có mã vạch vẫn nhớ được |

**Chữ ký** = các từ khoá **định danh** (mã · thông số · màu) đã chuẩn hoá rồi **sắp xếp**. Cố ý
**bỏ vai loại/NCC**: nó quá chung ("polyester", "chi may", "none") — để vào thì hai tem khác hẳn
nhau vẫn ra cùng chữ ký và sổ tay sẽ trả lời chắc nịch một SKU **sai**. Dưới 2 từ khoá thì **không
đáng nhớ** (trả `''`).

**Học lúc nào**: đúng lúc người bấm **"Chọn SKU này"** — đó là khoảnh khắc DUY NHẤT ta biết chắc tem
nào ứng với SKU nào, vì người vừa xác nhận. **Tra lúc nào**: mọi lượt `ndsDoiSoat()`, trước khi
chấm điểm; trúng thì SKU đó được **ghim #1 với 100%** kèm huy hiệu `ĐÃ HỌC` — thắng cả điểm số.

Sổ nằm **trong máy**, nên chạy được cả khi mất mạng và không tốn lượt gọi nào. Cái giá: mỗi điện
thoại học riêng. Muốn dùng chung thì phải thêm một action ghi Sheet ở GAS — chưa làm (xem mục 7).

### 2.3 Bỏ ô nhập email

Trước đây lần đầu bấm "Đọc tem bằng AI" là hiện `prompt` hỏi email `@hasaki.vn` — vướng đúng lúc
đang một tay cầm điện thoại đứng trước kệ. Mà nó **không bảo vệ được gì**: trang là GitHub Pages
công khai, gõ đại một chuỗi `@hasaki.vn` là qua. Tác dụng thật của nó chỉ là **chia hạn mức**.

Nay thay bằng **danh tính theo máy** tự sinh im lặng (`may-xxxxxxxx@hasaki.vn`, lưu localStorage):
cùng tác dụng chia hạn mức, mà chia theo máy còn đúng hơn theo email gõ tay. Email cũ đã lưu thì
giữ nguyên để không mất lịch sử hạn mức. Hàng rào thật vẫn nằm ở GAS: trần 400/ngày toàn hệ thống,
120/ngày/danh tính, cờ chống gửi chồng.

---

## 3. Tốc độ (đo 19/08/2026)

| Chỗ | Trước | Sau | Làm gì |
|---|---|---|---|
| Nhận ra 1 tem đã gặp | 3–7 s (AI) | **~0 s** | sổ tay / mã vạch, không gọi mạng |
| Dựng chỉ mục 5.610 SKU | 323 ms | **~195 ms** | thôi biên dịch lại 8 regex cho MỖI tên hàng (~45.000 lượt); nhớ kết quả `chuan()` |
| Đối soát, từ khoá phổ thông | 14,6 ms | **7 ms** | nhớ điểm theo CẶP (từ khoá tem × từ khoá SKU) |
| Đối soát, tem không có mã | 28,3 ms | **12 ms** | trên + hoisting `gonTu`/`theoHo`/mã màu ra khỏi vòng lặp ứng viên |
| Mở tab lần đầu | 0,6–1,1 s chờ danh mục | **~0 s** | `ndsHamNong()` nạp sẵn lúc máy rảnh (`requestIdleCallback`) |

Hai cái bẫy đã tránh khi tối ưu:

* **Nhớ theo cặp phải nhớ 2 TẦNG** (`[tok][m]`), đừng nối chuỗi làm khoá: nối chuỗi thì mỗi lượt tra
  phải cấp phát + băm một chuỗi mới — đo thật là **đắt hơn** phép so sánh nó định tiết kiệm. (Và nếu
  nối trần không dấu ngăn thì `("ab","c")` với `("a","bc")` ra cùng khoá, nhớ nhầm của nhau.)
* **Đã thử hạ trần ứng viên** (4.000 → 600) cho nhanh: **bác**, vì Top 3 lệch 2,7% số ca. Nhanh mà
  sai thì không phải nhanh. Mọi tối ưu ở đây đều là *đổi cách tính*, không phải *tính ít đi* —
  đối chứng 400 tem mô phỏng × 2 phạm vi cho ra **giống hệt** bản trước tối ưu, 0 lượt lệch.

`ungVien` còn có chỉ mục **2-gram** thay cho quét tuyến tính 9.272 từ vựng. Chọn 2-gram chứ không
3-gram là có lý do: một ký tự sai phá tối đa **hai** 2-gram, mà từ dài ≥5 có ≥4 cái, nên mọi cặp mà
Levenshtein-có-ngưỡng chấp nhận đều còn chung ít nhất một 2-gram ⇒ rút ngắn danh sách mà **không bỏ
sót**. 3-gram thì `"abcde"` vs `"abXde"` mất sạch gram chung — sẽ sót.

---

## 4. Bố cục + luật xếp hạng (chốt 19/08/2026)

### 4.1 COMBO không được đứng đầu — và vì sao phải chốt bằng luật cứng

Ca thật gặp chiều 19/08, tem nút Morito `JC01262` 17mm:

```
(Combo) Nút kim loại…/Matt Silver/none/set     61%   ← tên KHÔNG có "17mm" ⇒ THOÁT án phạt lệch
        Nút kim loại…(button)/Matt Silver/17mm/pcs   54%   ← có "17mm" khác giá trị tem ⇒ BỊ trừ 18%
```

Tức là **SKU ghi thiếu thông số lại được điểm cao hơn SKU ghi đủ mà lệch** — đó là mặt trái của cơ
chế XUNG ĐỘT. Chữa gốc cơ chế đó thì rủi ro (nó đang là thứ duy nhất tách được 102 biến thể dây kéo
`8846295`), nên chốt bằng **luật nghiệp vụ**: `ACTIVE` và `NORMAL` là **luật cứng, đứng TRÊN điểm
số`. Kiểm kê là đếm hàng thật; combo là cách đóng gói, không phải mặt hàng để đếm. Combo **không bị
bỏ**, chỉ luôn xuống sau mọi NORMAL trong Top 3.

Hai ngoại lệ đứng trên tất cả: **tem in thẳng mã SKU nội bộ** (`laSku` — dán mã nào trả mã đó, kể cả
combo) và **sổ tay** (`ghim`).

### 4.2 Thứ tự các bước + thẻ gọn


Thứ tự **1 · Ảnh tem → 2 · SKU gợi ý → 3 · Từ khoá nhận diện**. Từ khoá tụt xuống cuối vì nó là
**công cụ SỬA** khi máy đọc nhầm, không phải một bước bắt buộc phải làm — đưa nó lên giữa là bắt
người dùng đọc một đống badge trước khi thấy thứ họ cần. Đoạn mô tả dài đầu tab đã **bỏ**.

Trên máy rộng, **1 và 2 nằm song song** (`.nds-grid` 5fr/7fr — cột kết quả rộng hơn vì tên hàng WMS
rất dài): nhìn ảnh và đối chiếu kết quả cùng lúc, không phải cuộn qua lại. Điện thoại vẫn 1 cột,
thứ tự 1-2-3.

**Thẻ gọn** — nguyên tắc **chỉ hiện cái BẤT THƯỜNG** (sửa theo phản hồi "quá màu mè"):

| Bỏ đi | Vì sao |
|---|---|
| badge `NORMAL` | là mặc định; hiện lên chỉ tốn chỗ (chỉ còn hiện `COMBO`) |
| badge `ACTIVE` | phạm vi mặc định đã lọc ACTIVE rồi; chỉ hiện khi đang xem "Tất cả" (lúc đó mới lẫn lộn) |
| chip `ĐVT: mm` | trùng — `Tồn 2.330 pcs` đã có sẵn đơn vị ngay sau con số |
| 4–6 chip từ khoá khớp | nhốt vào `<details>` **"Vì sao khớp"**, mở khi cần |
| dòng "ưu tiên đơn vị nhỏ nhất" | gộp vào chính tiêu đề dòng biến thể |

Khối ghi chú dưới ảnh cũng **gấp lại**: trên điện thoại nó nằm giữa ảnh và kết quả, mở sẵn là đẩy
Top 3 xuống dưới màn hình — đúng thứ người dùng cần xem nhất.

### 4.3 Có ảnh là chạy luôn

Không còn bắt bấm "Đọc tem bằng AI". `ndsTuDongNhanDien()` chạy ngay khi `ndsDatAnh()` có ảnh, đi
**bậc thang rẻ → đắt và DỪNG khi đã chắc**:

1. **mã vạch** (~0,1 s, offline) → trúng SKU nội bộ hoặc trúng sổ tay là **xong, không gọi AI**
2. **sổ tay** theo từ khoá đang có (0 s) → trúng là xong
3. **AI** (3–7 s) — chỉ khi 1 và 2 đều không ra

Nhờ vậy "tự động" mà **vẫn không phí hạn mức**. Nút AI đổi nhãn thành **"Đọc lại bằng AI"** — dùng
khi xoay ảnh hoặc chụp gần hơn rồi muốn đọc lại. `NDS.tuDong` chặn chạy chồng khi chọn ảnh liên tiếp.

### 4.4 Khung xem trước bị "chia đôi" — bẫy ĐỘ ƯU TIÊN CSS

Triệu chứng (báo chiều 19/08): nửa trái là hộp đen kèm icon + câu hướng dẫn, nửa phải là ảnh bị bóp
lệch sang một bên.

Gốc **không** nằm ở JS — mã JS bật/tắt `hidden` hoàn toàn đúng. Nó nằm ở **độ ưu tiên CSS**:

```css
.nds-stage{display:flex}                       /* 0-1-0 */
.nds-stage video,.nds-stage img{display:block} /* 0-2-0  ← đè lên [hidden]{display:none} (0-1-0) */
.nds-empty{display:flex}                       /* 0-1-0  ← cũng đè */
```

Rule `[hidden]{display:none}` của trình duyệt chỉ có độ ưu tiên 0-1-0, nên **mọi khai báo `display`
bằng selector class đều vô hiệu hoá thuộc tính `hidden`**. Hậu quả dây chuyền: thẻ `<video>` rỗng và
`<img>` cùng "hiện", cùng là flex-item `width:100%` trong một hàng flex ⇒ **mỗi cái chiếm nửa khung**
(ảnh bị ép vào nửa phải, `object-fit:contain` co lại nên trông như méo), còn `.nds-empty` phủ đè lên.

Chữa:

* khung **thôi flex** — mọi lớp `position:absolute; inset:0`, xếp **chồng** lên nhau;
* khai thẳng `.nds-stage [hidden]{display:none!important}` để `hidden` luôn thắng;
* gom việc bật/tắt vào **một hàm duy nhất** `ndsLop('trong'|'camera'|'anh')`. Trước đó 4 hàm
  (`ndsCam` · `ndsTatCam` · `ndsDatAnh` · `img.onerror`) mỗi hàm tự bật-tắt vài thẻ rời rạc — chính
  cái đó làm trạng thái dễ lệch thành hai lớp cùng hiện;
* khi đang quay, câu hướng dẫn thành **lớp phủ mờ ở đáy** (`.nds-hint`, `pointer-events:none`) chứ
  không phải một khối chiếm chỗ;
* chọn ảnh xong thì **tắt camera** (giữ stream sống sau lưng tấm ảnh chỉ tổ nóng máy + sáng đèn).

Điện thoại: bỏ khoảng đệm đẩy trong `.nds-ctl` và cho 2 nút hành động giãn đều 46% mỗi cái.

`qc-tab-nhan-dien.mjs` khoá lại cả ba mặt: `hidden` có tác dụng không · đúng **một** lớp được vẽ ·
ảnh phủ trọn khung (sai số 4px cho viền 1px).

### 4.5 Đơn vị GỘP không được đứng đầu

Bảng `DV` có thêm cờ `gop` cho **cuộn · roll · thùng · hộp · bộ · set · cây · chai…** — đơn vị đóng
gói nhiều món/nhiều mét vào một. `COMBO` và `gop` **gộp làm một hạng "hàng đóng gói"**: cả hai đều
không phải đơn vị để đếm khi kiểm kê, nên **tuyệt đối không đứng đầu** (luật cứng, trên điểm số, áp
cho cả đại diện nhóm lẫn xếp hạng chung).

Đo thật — tem "Chỉ Irisa F9-5284 Hồng tro": Top 3 nay là `mm · mm · m cuộn`, bản `/Cuộn 5000m` và
bản `(Combo)` biến khỏi Top 3 (vẫn chọn được qua dòng biến thể hoặc phạm vi "Tất cả").

### 4.6 Thư viện mã NCC — và cái đường tắt đã BỊ BỎ

`cm.idx` vốn đã là chỉ mục **mã → dòng**. Việc bổ sung: bảo đảm **mọi dòng mang đúng mã tem đọc
được đều được chấm**, vì `ungVien` cắt ở 4.000 dòng theo số từ khoá trúng nên có ca dòng mang đúng
mã (98%) **bị cắt mất** — bắt được khi đối chứng 400 tem mô phỏng. Đo riêng phần này: **0/800 lượt
đổi kết quả** ⇒ nó là **lưới an toàn chống sót**, không phải tăng tốc.

> **ĐÃ THỬ VÀ BỎ — "tin mã":** mã khớp tuyệt đối + nhúm nhỏ + có dòng ≥85% thì chấm **đúng nhúm mã**
> rồi thôi. Nhanh **2,2×** thật (3,0 ms so với 6,6 ms). Nhưng đo trên 800 lượt: **142 lượt cho kết
> quả XẤU HƠN** — dòng khớp cao nhờ màu/thông số mà tên **không chứa** mã đó bị đánh rơi khỏi Top 3
> (ca thật: mất một dòng 96% đang đứng ngang hạng nhất). **Nhanh mà rơi mất đáp án đúng thì không
> đổi.** Muốn thử lại thì phải chứng minh cận trên: dòng không mang mã KHÔNG THỂ vượt dòng mang mã.

### 4.7 Bỏ dòng chú thích dài ở chân trang

Khối chữ mô tả toàn bộ dashboard ở `<footer>` đã bỏ hẳn: mọi ý trong đó đều đã hiện **ngay tại chỗ
dùng** (dòng chân từng tab, tooltip, dải ghi chú), để lại chỉ là một khối chữ không ai đọc.

### 4.8 Sự cố F9-5374 — và luật cứng "CÓ MÃ"

**Báo lỗi:** tem in `F9-5374`, kết quả trả về `422378537` — "sai hoàn toàn", và không gợi ý nào
mang mã đó.

**Truy nguyên:** lõi đối soát **không sai**. Thử đúng mã `F9-5374` thì cả 3 gợi ý đều là SKU mang
mã đó (93–95%). Mã này **có** trong danh mục — 12 SKU. Cái sai là **AI không đưa được mã xuống
lõi**; thiếu mã, lõi chấm bằng chữ chung `Chỉ · Filtex · Phong Việt · Polyester` rồi trả về một SKU
**cùng dạng tên nhưng khác hẳn mã**:

```
tem đúng : Chỉ Filtex / F9-5374_Phong Việt / 100% Polyester / … / mm
máy trả  : Chỉ Filtex / F6-7829_Phong Việt / 100% Polyester / … / mm   ← 422378537
```

Độ giống 2 mã theo engine = **0** ⇒ không phải lỗi fuzzy, mà là **thiếu bằng chứng định danh**.

**Chữa 3 tầng:**

1. **Luật cứng `CÓ MÃ`** — hễ có **một** mã tem khớp tuyệt đối danh mục thì mọi SKU mang mã đó phải
   đứng **trên** mọi SKU không mang, bất kể điểm. Đặt **trên cả** luật hàng đóng gói: thà hiện bản
   combo/cuộn **đúng mã** còn hơn hiện SKU **sai mã**.
2. **Ô "Mã trên tem" ngay bước 1** — mã hàng luôn in to rõ trên tem NCC, gõ 7 ký tự là chắc ăn,
   không cần AI, không cần mạng. Không bắt cuộn xuống bước 3 tìm ô "thêm từ khoá". Gõ sai/thiếu thì
   **không im lặng**: tra trong từ vựng những mã **gần giống** rồi mời bấm chọn ("Ý bạn là…").
3. **Cảnh báo khi không khớp được mã nào** — `timTop` trả thêm cờ `coMaKhop`; giao diện in một dải
   ngay **trên đầu** kết quả: *"Chưa khớp được MÃ HÀNG nào — mấy gợi ý dưới chỉ dựa vào chữ chung,
   đừng chọn vội"* kèm nút nhảy tới ô nhập mã. Im lặng đưa ra một SKU sai kèm 68% là nguy hiểm hơn
   nhiều so với nói thẳng là chưa đủ căn cứ.

### 4.9 Zoom camera — chữa vòng luẩn quẩn của tem NHỎ

Tem nhỏ đẩy người dùng vào một vòng không lối ra: **để xa thì chữ quá bé**, **để gần thì máy không
lấy nét được** — ống kính điện thoại có khoảng nét gần tối thiểu ~10 cm, gần hơn là nhoè. Cách ra
khỏi vòng đó **không phải** rê máy lại gần, mà là **giữ khoảng cách đủ để nét rồi phóng to**.

| Máy | Cách zoom | Chất lượng |
|---|---|---|
| Có zoom phần cứng (đa số Android) | đổi thẳng `zoom` của `MediaStreamTrack` qua `applyConstraints` | ảnh **nét nguyên bản** |
| Không có | zoom **SỐ**: xem trước phóng to bằng CSS, lúc chụp **CẮT** đúng vùng giữa đó từ khung hình **gốc** | tuỳ độ phân giải, xem dưới |

Vì có nhánh zoom số nên `getUserMedia` xin luôn **2560×1920** (thay vì 1920×1440): cắt 2× còn
1280×960 — vẫn trên mức 1400px mà bước nén gửi AI dùng, nên **chữ to gấp đôi mà không phải phóng to
điểm ảnh** (không tự làm nhoè thêm). Trần **4×** cho zoom số; cắt sâu hơn là mất nét thật.
Thêm `focusMode: continuous` để máy tự lấy nét lại khi đưa tem vào gần.

⚠ Phải cắt từ **khung hình gốc của `<video>`** chứ không phải từ thẻ video đã bị CSS phóng to —
lấy từ thẻ đã phóng to là chụp lại đúng mấy điểm ảnh đã bị kéo giãn.

Hàng điều khiển: 2 nút bước ± (chỉnh nhanh bằng ngón cái khi một tay đang giữ tem) + thanh trượt +
số; **nhớ mức zoom lần trước** vì kho toàn tem cùng cỡ.

### 4.10 Thẻ gợi ý rút tới lõi — bỏ 2 nút, bấm cả thẻ

Thứ người đứng trước kệ cần đọc, theo đúng thứ tự: **mã SKU → tên (chỗ trùng khớp) → còn lại**. Nên
chỉ hai thứ đầu được "to tiếng":

* `.nds-sku` **14,5 → 17px/800**, `.nds-pn` **12,5 → 13,5px** và `<mark>` tô rõ hơn (nền đậm + viền);
* **tồn · lệch · "từ sổ tay"** dồn hết xuống **một dòng phụ** chữ nhỏ màu xám;
* **biến thể đơn vị + "vì sao khớp"** gộp chung **một** `<details>`, tóm tắt *"N đơn vị khác · N từ
  khoá khớp"*;
* **bỏ hẳn** hai nút *"Chọn SKU này"* / *"Copy mã"* — mỗi thẻ 2 nút thì 3 thẻ thành **6 nút**, lấn
  hết chỗ của chính thông tin cần đọc. Thay bằng **bấm cả thẻ là chọn**: `role="button"` +
  `tabindex="0"` + Enter/Space + vòng focus. Nút biến thể bên trong **chặn nổi bọt**
  (`event.stopPropagation()`) để không kích nhầm thẻ cha.
* Nhắc cách dùng đặt **một lần** ở tiêu đề mục ("bấm thẻ để chọn"), không lặp trên từng thẻ.

### 4.11 Lỗi `Unexpected token '<'` — Apps Script trả HTML, không phải AI hỏng

**Báo lỗi:** *"Không đọc được tem bằng AI: Unexpected token '<', "<!DOCTYPE "... is not valid JSON"*.

Không phải AI hỏng, cũng không phải ảnh xấu. Gọi một web app của Apps Script **luôn đi 2 chặng**:

```
POST script.google.com/macros/s/…/exec   →  302  →  GET script.googleusercontent.com/…/echo
```

Chặng 2 của Google thỉnh thoảng trả về **trang HTML** (lỗi tạm, 404/500, trang đăng nhập) **trong
khi script phía sau đã chạy xong** — đúng cái bẫy đã ghi trong hồ sơ sự cố GAS 12/08/2026. Lúc đó
`r.json()` gặp `<!DOCTYPE` và ném ra thông báo khó hiểu kia.

**Chữa** (`ndsGoiGas`): đọc **thô** trước → nhận diện HTML → **thử lại với CÙNG nonce**. Đây là chỗ
mấu chốt: `doPost` cất phản hồi theo nonce **10 phút**, nên lượt thử lại chỉ **lấy lại kết quả đã
có** — không chạy Gemini lần nữa, **không tốn thêm hạn mức**. 3 lượt; hết lượt thì báo bằng tiếng
người và **tự đưa con trỏ tới ô "Mã trên tem"**, chứ không quăng thông báo của bộ phân tích JSON
vào mặt thủ kho.

### 4.12 Gợi ý mã ngay khi gõ — đường nhanh nhất, không AI, không mạng

Hai sự cố liên tiếp (AI đọc sót `F9-5374`, rồi AI chết hẳn vì GAS trả HTML) đều được cứu bằng đúng
một thứ: **cái mã in to trên tem**. Nhưng bắt gõ đủ `F9-5374` thì vẫn chậm và vẫn sai được (tem mờ,
đọc nhầm `3↔8`, `5↔S`).

Nên: gõ **2–3 ký tự bất kỳ** nằm trong mã là hiện ngay **các mã THẬT của danh mục** có chứa đoạn đó,
kèm **số SKU** — chạm một cái là xong. Khớp **đầu mã** xếp trước, khớp giữa xếp sau. Danh sách mã
dựng **một lần** từ từ vựng chỉ mục (`ndsDsMa`), không quét lại 5.610 dòng mỗi lần gõ.

Đo trên trang live: gõ `5374` → gợi ý `f9-5374 (12 SKU)` trong **18 ms**, chạm một cái ra đúng 3 SKU
mang mã đó, **0 lượt gọi AI**.

### 4.13 Lọc theo PHẦN TỬ của tên hàng — lối đọc tem không cần AI

`PRODUCTNAME` của WMS vốn **là** một chuỗi phần tử ghép bằng `/`:

```
Half zipper-DÂY KÉO TRỤ: PHAO, #3 / 8916123_YKK / 100% Polyester / Xám đậm V9B11 / 29-all / pcs
```

Tem nhà cung cấp in đúng mấy phần tử đó. Nên cách chắc nhất và nhanh nhất **không phải** nhờ AI đoán,
mà là: **thủ kho đọc được mảnh nào thì gõ mảnh đó**, máy tìm những dòng **có chứa** các mảnh ấy.
Hoặc chứa hoặc không — không có % nào để nghi ngờ.

* `tachPhanTu(pn)` cắt tên thành phần tử; `locDong(mảnh, cm)` quét `indexOf` trên tên đã chuẩn hoá
  (`_pnc`, dựng **một lần** lúc dựng chỉ mục) — đo **6–12 ms** cho cả 5.610 dòng.
* Điểm lúc này **không phải điểm đoán** mà là **ĐỘ PHỦ**: khớp 3/3 mảnh = 100%, 2/3 = 67%.
* Mảnh nào trùng tuyệt đối một mã trong danh mục thì vào luôn vai **MÃ** → luật cứng "CÓ MÃ" và cơ
  chế tô đậm tên cùng làm việc.
* Chịu được gõ **không dấu** (`xam dam` ↔ `Xám đậm`) và bỏ qua dấu ngăn (`v9b11` ↔ `v9-b11`).
* Mọi luật xếp hạng phía sau chạy **y nguyên** ⇒ không có đường thứ hai để lệch hành vi.

Đo trên trang live: gõ `8916123 V9B11 29-all` → `422430687` **100%**, hai biến thể khác màu/cỡ
xuống 67%.

### 4.14 Thứ tự luật xếp hạng — chốt cuối

Sự cố: sổ tay lỡ học sang bản **COMBO** thì nó chiếm hạng 1 với *"100% · từ sổ tay"*, vượt qua cả
luật "combo/đơn vị gộp không bao giờ đứng đầu" — vì bản trước `unshift` thẳng lên đầu, bỏ qua mọi
so sánh. Nay ghim xong thì **xếp lại** bằng đúng bộ so sánh chung, và thứ tự luật chốt là:

```
laSku  →  ACTIVE  →  HÀNG ĐÓNG GÓI (combo/cuộn/set)  →  SỔ TAY  →  CÓ MÃ  →  điểm  →  đơn vị nhỏ  →  tồn
```

Đọc theo nghĩa: **luật của kho** ("combo/đơn vị gộp không bao giờ đứng đầu") thắng cả sổ tay; còn
**sổ tay** (người đã xác nhận) thắng mọi suy đoán của máy. Ngoại lệ duy nhất trên tất cả là tem in
thẳng mã SKU nội bộ.

### 4.15 Nút điều khiển khung nằm TRONG khung

Chia theo **cái mà nút tác động vào**:

* tác động lên **khung hình** — Bật/Tắt camera · Chụp · Chọn ảnh · xoay ⟲⟳ → nằm **trong** khung,
  thành một thanh nổi trên nền mờ ở đáy, đúng kiểu app camera;
* tác động lên **kết quả** — Quét mã vạch · Đọc lại bằng AI → vẫn ở **dưới** khung.

Câu hướng dẫn khi đang quay đổi lên **đỉnh** khung (đáy đã dành cho thanh nút). Nút dùng nền mờ +
viền sáng + `backdrop-filter` nên đọc được trên mọi ảnh (tem trắng, nền đen, vải sẫm), và vẫn giữ
đúng nhịp chạm/animation chung của dự án (`--ez-apple`, `scale(.96)`, focus ring).

> **Bẫy `[hidden]` cắn LẦN THỨ HAI** — chính CSS của lần sửa trước làm tái phát: `.nds-zoomrow{display:flex}`
> đè lên `[hidden]{display:none}` nên hàng zoom **không ẩn được** khi tắt camera. Nay khai **một lần
> cho cả tab**: `#viewNds [hidden]{display:none!important}` — mọi phần tử thêm sau này đều được che
> chắn sẵn. `qc-tab-nhan-dien.mjs` có hẳn một ca **quét MỌI phần tử đang mang `hidden`** trong tab
> xem có thật sự bị ẩn không, nên lần thứ ba sẽ bị bắt ngay khi thêm.

---

## 5. Cổng đọc tem — Apps Script `action=sku_vision`

Trang là **GitHub Pages công khai**, nhúng khoá AI vào là cho không cả thiên hạ → Apps Script đứng
giữa (vốn đã là backend ghi Sheet của dự án, không phải dựng thêm hạ tầng).

```
POST {APPSCRIPT_URL}
{ action:'sku_vision', email:'ten@hasaki.vn', mime:'image/jpeg', anh:'<base64 không tiền tố>', nonce:'…' }
→ { status:'success', model, quality:'ro|mo|khong_doc_duoc', ms, conLai,
    text:'<chữ đọc được>', tokens:{ item_codes[], specs[], colors[], brands[], others[] } }
```

**Hàng rào** (trong `skuVision_` của `google-script.gs`):

* danh tính đúng định dạng `ten@hasaki.vn` (kiểm server-side) — từ 19/08/2026 dashboard **tự sinh**
  `may-xxxxxxxx@hasaki.vn` theo máy chứ không hỏi người dùng nữa (xem 2.3)
* ảnh ≤ ~1,9 MB base64 (dashboard đã thu nhỏ còn ~200–400 KB trước khi gửi)
* hạn mức **400 ảnh/ngày** toàn hệ thống, **120 ảnh/ngày/email** (đếm trong Script Properties, tự
  dọn khoá của ngày cũ)
* cờ **"đang đọc"** theo email (LockService + Script Properties): chặn 2 lượt gửi **chồng nhau**,
  xoá ngay khi xong → quét liên tục nhiều cuộn **không** phải chờ.
  Lock chỉ giữ vài ms để "kiểm rồi đặt cờ", **không** giữ suốt 3–7 giây gọi Gemini (giữ là bắt người
  khác chờ oan). Cờ **không** để trong CacheService: đo thật 18/08 — bắn 2 lượt cùng lúc thì cả 2 đều
  chạy vì mỗi lượt là một execution riêng, cache chưa kịp lan sang nhau
* **không lưu ảnh** ở bất kỳ đâu (không Drive, không Sheet, không log)

**Model**: chuỗi dự phòng `gemini-3.5-flash → 3.5-flash-lite → 3-flash-preview → 2.5-flash-lite →
2.0-flash`. Mỗi model có quota miễn phí riêng theo ngày; 429/503 thì tự tụt model sau (giống
`sync-vesinh-ai.mjs`). Đo thật trên production: **3–7 giây/ảnh**.

**Khoá AI** — 2 đường, ưu tiên đường 1:
1. Script Properties `GEMINI_API_KEY` → mở Apps Script, dán khoá vào biến trong `datKhoaGemini()`,
   chạy 1 lần, rồi xoá khoá khỏi mã.
2. `SV_KHOA_CUNG` trong `.clasp-deploy/sa.js` — bản deploy đã gitignore (cùng chỗ với SECRET/PIN).
   Bản git-safe `google-script.gs` **luôn để trống** chuỗi này.
   Nạp khoá vào bản deploy: `node gas-nap-khoa-gemini.mjs` (đọc `.env`; `--xoa` để gỡ ra).

Khoá miễn phí: aistudio.google.com/apikey (cùng khoá `sync-vesinh-ai.mjs` đang dùng).

**Deploy**: từ `hasaki/.clasp-deploy`
```
npx @google/clasp push -f
npx @google/clasp deploy -i AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ -d "mô tả"
```
(giữ nguyên URL). Đã deploy `@63` ngày 18/08/2026 (61 = bản đầu, 62 = sửa chốt nhịp, 63 = chốt bằng lock).

> **Bẫy đã cắn:** ngay sau `deploy`, vài lượt gọi đầu vẫn do **bản CŨ** trả lời
> ("Action không hỗ trợ: sku_vision"). Và `doPost` **cất phản hồi theo `nonce` 10 phút** — test dùng
> nonce cố định sẽ nhận lại y nguyên phản hồi cũ, trông như deploy thất bại. Nonce phải khác mỗi lượt.

---

## 5b. OCR của Google — người đọc tem thứ hai (chiều 19/08/2026)

**Báo lỗi của thủ kho:** *"nhận diện toàn sai hoặc không có kết quả nào"*. Đo lại thì ra **ba** nguyên
nhân khác nhau, và chúng đòi ba cách chữa khác nhau — nên phần này ghi cả ba, đừng gộp làm một:

| # | Nguyên nhân | Bằng chứng đo được | Chữa ở đâu |
|---|---|---|---|
| ① | **AI chết lượt** ⇒ không có kết quả nào | 1/16 lượt Gemini trả JSON sai khuôn; hết hạn mức thì 429 mọi model | thêm người đọc **không tốn hạn mức AI** (mục này) |
| ② | **AI gán vai sai** ⇒ gợi ý sai hoàn toàn | CÙNG một tem chỉ Irisa: lượt thì trả `F9-5284` ở `item_codes` (97%, đúng SKU), lượt thì trả ĐÚNG chuỗi đó ở `colors` (73% + 2 SKU sai mã) | bằng chứng của **danh mục** thắng vai của AI (`napBangChung`) |
| ③ | **Lỗi trong lõi đối soát** ⇒ sai cả khi đọc đúng | 4 lỗi, xem 5b.3 | sửa lõi + khoá bằng test |

### 5b.1 Vì sao là OCR của Google Drive

Drive có sẵn chức năng **chuyển ảnh → Google Docs bằng OCR** (cùng họ engine mà Google Dịch/Lens
dùng). Nó đúng cái mà luật của dự án cho phép: **không xin IT, không thêm hạ tầng, không tốn hạn mức
Gemini** — chỉ dùng quyền Drive mà Apps Script đã có (`scope drive` có sẵn trong manifest).

```
POST {APPSCRIPT_URL}
{ action:'sku_ocr', email:'may-xxxx@hasaki.vn', mime:'image/jpeg', anh:'<base64>', lang:'vi', nonce:'…' }
→ { status:'success', nguon:'drive-ocr', text:'<toàn bộ chữ đọc được>', ms, msUp, msExport, conLai }
```

Ba chặng trong `soDriveOcr_`: **mở phiên nạp** (`uploadType=resumable`, JSON metadata + `ocrLanguage`)
→ **PUT nguyên Blob ảnh** → **export `text/plain`** → **xoá file ngay** (`finally`, mọi đường ra).

> ⚠ **BẪY ĐẮT — đừng ghép multipart bằng tay trong Apps Script.** Bản đầu dựng thân multipart trong
> JS: `dau.concat(bytes).concat(cuoi)` rồi `newBlob(...).getBytes()`. Mỗi phần tử phải đi qua cầu
> JS↔Java hai lượt ⇒ ảnh tem thành mảng nửa triệu phần tử ⇒ **execution 35–40 giây**, và execution
> dài chính là thứ làm Google trả **404 ở chặng 2** (đúng hồ sơ sự cố GAS 12/08/2026). Đổi sang
> resumable (lượt 1 chỉ JSON, lượt 2 PUT nguyên Blob): **6,9 giây** (nạp 4,7s + lấy chữ 0,8s).
> Có `msUp`/`msExport` trong phản hồi + cửa `chuanDoan:1` để lần sau không phải đoán chậm ở đâu.

> ⚠ 404-HTML ở chặng 2 xảy ra **cả với lượt chạy 1 giây** (đo 19/08). Nên `qc-sku-ocr-live.mjs` cũng
> phải thử lại **cùng nonce** y như dashboard — đó là cách gọi ĐÚNG của web app Apps Script, không
> phải mẹo che lỗi.

**Hàng rào**: email `@hasaki.vn` · ảnh ≤ 1,9 MB base64 · **2.000 ảnh/ngày** toàn hệ thống,
**400/ngày/máy** (cao hơn AI vì không tốn hạn mức, trần chỉ để một máy hỏng không quét vô hạn) · cờ
"đang đọc" theo email (Script Properties, không phải CacheService — xem ghi chú ở `sku_vision`).

### 5b.2 OCR **không thay** AI — nó là lưới đỡ khi AI chết

Đo trên **30 tem mô phỏng** (nhãn cắt từ PRODUCTNAME thật, 3 bậc khó: sạch · nghiêng+mờ+loá ·
chữ nhỏ 0,62× + nhoè + nghiêng 13° + loá mạnh):

| Người đọc | Top-1 | Top-3 | Lập được MÃ | Thời gian | Hạn mức AI |
|---|---|---|---|---|---|
| OCR Google → `tuVanBan` | **77%** | 83% | 77% | 6,0 s | **0** |
| OCR nhưng KHÔNG lọc mảnh theo danh mục | 73% | 83% | 77% | 6,0 s | 0 |

Và trên bộ 12 tem khó (có gọi cả Gemini):

| Người đọc | Top-1 | Top-3 | Lập được MÃ |
|---|---|---|---|
| AI, tin vai AI gán (**bản cũ**) | 58% | 75% | 75% |
| AI, dùng **chữ thô** → `tuVanBan` | 58% | 75% | **83%** |
| OCR Google → `tuVanBan` | 42% | 58% | 75% |

**Kết luận đúng của số liệu**: OCR đọc được **16/16 lượt** (AI trượt 1) và **miễn phí**, nhưng ở bậc
tem **RẤT KHÓ** nó đọc lệch ký tự (`Đen-580-AA` → `Ben-380-AA`, `345` → `145`) ⇒ ra **đúng mã** mà
**lệch màu**. AI là mô hình thị giác nên dựng lại được chữ nhoè. Cộng thêm số đo tốc độ ở **5b.6**
(AI ~5 s, OCR ~7,4 s), **bậc thang chốt lại là**:

```
① mã vạch (0,1s, offline) → ② sổ tay tem (0s) → ③ AI (~5s) → ④ OCR Google (~7,4s, MIỄN PHÍ — chỉ khi ③ chưa lập được mã hoặc chết)
```

> Bậc thang này từng đặt OCR ở vị trí ③ (sáng 19/08, lý do "miễn phí thì cho chạy trước"). Thủ kho
> dùng thật rồi báo **"đọc quá lâu >20s"** — phản hồi đúng, xem 5b.6 để biết 20 giây đi đâu.

Điều kiện leo thang **không phải % điểm** mà là `ndsDuCanCu()`: *đã khớp tuyệt đối một MÃ có thật
trong danh mục chưa*. Điểm cao nhờ chữ chung chính là thứ đưa ra SKU sai một cách tự tin, nên không
được dùng nó làm điều kiện dừng.

Khi ④ chạy, dashboard **ghép hai nguồn của cùng một lượt gọi**: vai do AI gán (đã qua `napBangChung`)
**+** `raw_text` qua `tuVanBan`. Hai nguồn bù nhau: chữ thô giữ được mã dài (AI hay cắt cụt, ví dụ
trả `255LK3557-2` thay cho cả chuỗi `…SAB-255LK3557-2`), còn vai của AI giữ được mẩu chữ mà bóc theo
hình dạng không ra.

### 5b.3 Bốn lỗi trong lõi — mỗi lỗi một ca test

Đây là phần đáng đọc nhất: **đọc đúng chữ mà vẫn ra SKU sai**. Cả 4 chỉ lộ ra khi đưa **chữ thô** vào
lõi (đường AI cũ nhận từ khoá đã lọc sẵn nên che mất).

1. **Mẫu thông số cắn mất khúc GIỮA của mã dài.** `HKM-DET.TT.10-163` → mẫu `\d{1,3}-\d{1,3}` lấy
   `10-163`, còn lại `hkm-det.tt` không là mã nào ⇒ mất sạch bằng chứng định danh, ra SKU **vải**
   khác hẳn (50%). Chữa: `nhanMaDai` rút mã dài **trước** `nhanSpec`.
   *Phân biệt mã với thông số bằng CẤU TẠO*: mã có **đoạn toàn chữ ≥3 ký tự** không phải đơn vị/cỡ
   (`hkm`, `det`, `sab`, `nhs`). Hai lần siết vì hai ca thật:
   `Text 27-60-3-Tkt 120` (đoạn `tkt` là đơn vị) và `20-52mm-XS` (đoạn `xs` là **cỡ** — nhận cả cụm
   là mã thì mất luôn dấu hiệu tách XS/S/M/L, cả 4 cỡ cùng 69% và đúng cỡ rơi khỏi Top 3).
2. **"Chứa trong nhau" cho 0,88 điểm mà không xét cỡ.** Số PO `4500219872` ăn 0,88 điểm **vai MÃ**
   của một SKU vải chỉ vì tên có mã màu 4 số nằm lọt trong nó; chữ `INSPECTOR` khớp `spec` y như vậy.
   Chữa: `traiDaiHopNhau` — mẩu ngắn phải ≥4 ký tự **và ≥ nửa** mẩu dài (áp cả ở `diemCap` lẫn
   `tuGanGiong`, nên bước tìm ứng viên cũng thôi kéo rác vào).
3. **Số đo chiếm chỗ trong rổ MÃ.** Tem in `5000m`; `RE_CODE` nhận vì cũng "chữ lẫn số"; cả danh mục
   có hàng nghìn tên chứa `5000m` ⇒ nhúm mã vượt trần 120 dòng ⇒ **luật cứng "CÓ MÃ" bị bỏ** ⇒ giao
   diện báo oan *"chưa khớp mã"* và trả SKU sai 90% trong khi `F9-5284` khớp tuyệt đối. Chữa:
   `nhanCode` đẩy số đo (`RE_KHONG_LA_MA`) sang **rổ thông số** — hai bên đều bóc bằng hàm này nên
   vẫn khớp nhau.
4. **Vai của AI được tin hơn danh mục.** `napBangChung`: mảnh nào **ra dáng mã** và **có thật** trong
   `cm.idx` thì lên **vai MÃ**, bất kể AI xếp nó ở `colors`/`brands`. Chỉ xét 2 rổ đó (không xét rổ
   thông số) và có `RE_KHONG_LA_MA` chặn số đo — thiếu chặn này thì `10mm` lên vai mã (nặng 45%) và
   3 SKU sai chen vào Top 5 với 74–81%.

**Đối chứng cũ/mới trên 30 lượt đọc GIỐNG NHAU** (`qc-loi-cu-moi.mjs`, lấy lõi cũ từ git):

| Lõi | Top-1 | Top-3 | Lập được MÃ |
|---|---|---|---|
| trước (`e7c0753`) | 77% | 87% | 70% |
| sau | **80%** | 87% | **77%** |

→ **1 lượt tốt hơn · 0 lượt xấu hơn · 29 lượt y như cũ.** Nghĩa là mấy bản vá này **không** phải cú
nhảy độ chính xác trên tem mô phỏng; giá trị của chúng là **bịt các lỗi định danh** (lập được mã
70%→77%) — đúng loại lỗi làm thủ kho mất niềm tin, vì nó đưa ra SKU sai kèm con số trông tự tin.

> ⚠ **BẪY ĐO LƯỜNG (mất 20 phút vì nó).** Bộ đề của `qc-ocr-doi-chung.mjs` ban đầu lọc SKU mẫu bằng
> `E.bocTen(...).code.length` — tức **sửa lõi là đổi luôn bộ đề**. So hai lần chạy với nhau ra
> "77% → 17%" và tưởng lõi vỡ, trong khi lõi vẫn 54/54 ca. Nay bộ đề chọn bằng **phép cắt chuỗi
> thuần**, và kho đệm khoá theo **SKU đáp án** chứ không theo tên file ảnh. Muốn biết một lần sửa
> lõi là tốt hay xấu thì **phải** dùng `qc-loi-cu-moi.mjs` (cùng chữ đã đọc, hai lõi).

### 5b.4 `tuVanBan` — chữ thô → vai, LỌC bằng chính danh mục

Bước lọc là điều kiện để chữ thô dùng được: tem thật in đầy **chữ giấy tờ** (địa chỉ NCC, số PO, số
lô, ngày, số lượng, cân nặng). Mảnh nào cả 5.610 tên hàng **không hề có** thì bỏ — giữ lại chỉ có hại:

* làm loãng điểm (mọi vai đều tính nửa trung bình);
* **bắt lệch OAN**: `LOT 25/08-114` đủ để lõi kết luận *"lệch tỉ lệ sợi"* với mọi SKU ghi `27-60-3`
  rồi trừ **18%** của chính dòng đúng.

Lọc theo 3 mức, rẻ trước: có nguyên văn trong `cm.idx` → `loi()` trùng (khác dấu ngăn: `v9b11` ~
`v9-b11`) → gần giống theo chỉ mục 2-gram cho mảnh ≥5 ký tự (chịu lỗi OCR: `jco1262` ~ `jc01262`).
Số mảnh bị bỏ hiện ở **dòng chân** ("đã bỏ N mảnh giấy tờ") — người dùng thấy máy bỏ cái gì.
Đo: lọc **+4 điểm** Top-1 (77% vs 73%).

### 5b.5 TỐC ĐỘ — "đọc quá lâu >20s" đi đâu, và cắt được bao nhiêu

**Đo thật trên chính cổng production, cùng một tem, cùng đường truyền:**

| Chặng | Thời gian | Sửa được không |
|---|---|---|
| Phí cố định 2 chặng của Apps Script (gọi không kèm ảnh) | **1,7–2,0 s** | **Không** — web app luôn đi `exec` → 302 → `googleusercontent/echo` |
| Đẩy ảnh từ điện thoại qua 4G | tuỳ mạng, **vài giây** | Có — cắt byte (xem dưới) |
| OCR: Drive chuyển ảnh → Google Docs | **3,2–4,0 s** | **Không** — việc của Google |
| OCR: export văn bản | 0,6 s | — |
| AI: model đọc ảnh | **1,9–2,5 s** (bản `lite`) | Có — chọn model (xem dưới) |

⇒ **OCR ~7,4 s · AI ~5,0 s** tổng cộng, và cộng thời gian đẩy ảnh trên mạng di động thì OCR chạm
>20 s như thủ kho gặp. **OCR không thể nhanh hơn**, nên nó phải xuống làm lưới đỡ.

**Bốn việc đã làm để cắt thời gian:**

1. **Đảo bậc thang** (AI trước): bỏ 7,4 s khỏi đường thường gặp. Đo live end-to-end sau khi đảo:
   **6,7 s** kể cả nạp trang + nạp danh mục 5.613 SKU + dựng ảnh.
2. **Chọn model theo SỐ ĐO, không theo "to là chuẩn"**. Đo cùng một tem khó:
   `gemini-flash-lite-latest` **1,9–2,0 s** · `gemini-3.5-flash-lite` 1,6–3,0 s ·
   `gemini-3.1-flash-lite` 2,2–4,3 s — **cả ba bóc đúng** mã `8209948` + `18.0 CM` + màu `366`.
   Việc của model ở đây chỉ là **ĐỌC CHỮ**, không phải suy luận, nên bản `lite` không kém.
   ⚠ Phát hiện quan trọng: `gemini-3.5-flash` (model **đứng đầu** danh sách cũ) đang trả **429**, và
   `gemini-2.5-flash-lite` trong chuỗi dự phòng trả **404** (tên model đã chết) ⇒ **mỗi lượt đọc tem
   đều tốn 1–2 round-trip vô ích**, và nếu cả chuỗi 429 thì thủ kho thấy đúng câu "không có kết quả".
   Đã đổi thứ tự (lite trước) và **nhớ model chết trong ngày** (`sv_chet_<ngày>` ở Script Properties):
   429/404 thì bỏ qua model đó tới hết ngày, hôm sau quota mới lại thử. Script từ 4,5 s → **2,3–3,2 s**.
3. **Cắt byte ảnh**: ảnh gửi OCR hạ **2000 → 1400 px** (đo: 2000/1400/1000 px cho ra **chữ y hệt
   nhau**, mà 2000 px nặng hơn ~50%), và nén theo **ngân sách byte** ≤ 430K ký tự base64 — hạ chất
   lượng 0,72 → 0,6 → 0,5 **trước** khi hạ độ phân giải (chữ chịu nhiễu nén tốt hơn chịu mất điểm ảnh).
4. **Đồng hồ giây trong hộp "đang đọc"** + đổi màu ở giây thứ 12. Không rút được 4–5 s của Google,
   nhưng bỏ được **cảm giác treo máy** — chính cái đó làm người dùng nói "quá lâu". Giây thứ 12 kèm
   nhắc: mạng yếu thì gõ mã trên tem là ra ngay, không cần chờ.

> **ĐỘ TẢN của con số**: đo live 3 lượt trên trang thật ra **4,8 s · 6,7 s · 17,9 s** cho cùng một
> tem. Lượt 17,9 s **chỉ có MỘT** lượt gọi `sku_vision` (không phải thử lại), nên nguyên nhân nằm ở
> phía Google — Apps Script khởi động nguội hoặc model xếp hàng. Không có cách nào ép nhanh từ phía
> mình; đó chính là lý do phải có **đồng hồ giây + nhắc ở giây 12** thay vì cố hứa một con số.
> Đừng đọc một lần đo rồi kết luận nhanh/chậm: phải đo vài lượt.

> **Bẫy async đã cắn khi đảo thứ tự**: `ndsNhanKetQua` không phải `async` mà bên trong có `await`
> (nạp danh mục), nên bậc thang hỏi `ndsDuCanCu()` ngay sau đó **đọc `NDS.ket` của LƯỢT TRƯỚC** rồi
> quyết định tụt xuống OCR sai. Đã cho `await` xuyên suốt.

### 5b.6 IDF — đã làm, đã đo, đang TẮT

Đề xuất (của user): thay trọng số vai cố định bằng **IDF** tự học từ danh mục. Nguyên tắc thì đúng —
`polyester` có ở 2.813 SKU (IDF **0,69**) không thể nặng bằng `8209948` có ở 12 SKU (IDF **6,15**).
Đã cài: `cm.idf` dựng cùng chỉ mục (không tốn thêm thời gian đo được, vẫn 252 ms), điểm mỗi vai đổi
từ trung bình thường sang **trung bình có trọng số IDF**, kèm công tắc `batIdf()` để đối chứng.

**Đo trên dữ liệu thật thì KHÔNG hơn:**

| Bộ đo | Tắt IDF | Bật IDF |
|---|---|---|
| 30 lượt OCR thật (tem đọc được mã) | Top-1 **80%** · Top-3 87% | Top-1 **80%** · Top-3 87% (y hệt) |
| 17 ca mô phỏng "tem mờ không đọc ra mã" — chỗ IDF *đáng lẽ* phát huy | Top-1 **76%** | Top-1 **71%** (1 ca đổi hạng 1, đổi sang SAI) |

**Vì sao không hơn** — ba thứ đã làm sẵn việc của IDF: ① `tuVanBan` **lọc mảnh theo danh mục** nên rác
không vào tới bước chấm; ② điểm mỗi vai là `(max + trung bình)/2`, phần `max` vốn không quan tâm từ
chung; ③ cái tách được các dòng cùng họ là cơ chế **XUNG ĐỘT** (nhân điểm) chứ không phải trọng số từ.
IDF chỉ đổi được nửa "trung bình" của công thức. Thêm nữa, **luật cứng "CÓ MÃ" đứng TRÊN điểm số**,
nên khi tem đọc được mã thì điểm không phải thứ quyết định hạng.

⇒ **Mặc định TẮT**, giữ `cm.idf` + `batIdf()` để đo lại khi có tem thật. Không ship thứ đo ra không
hơn mà lại mất một ca. Muốn thử lại: `qc-loi-cu-moi.mjs` đã có sẵn cột *"MỚI, tắt IDF"*.

### 5b.7 Giao diện

* Ảnh gửi OCR và AI **cùng 1400px** — bản đầu cho OCR 2000px theo lý thuyết "OCR ăn độ nét từng nét
  chữ", đo thật thì 2000/1400/1000px cho ra **chữ y hệt nhau** nên chỉ còn là byte thừa (xem 5b.5).
* Badge từ khoá ghi rõ **nguồn** trong tooltip (mã vạch · OCR · AI · tách từ chữ trên tem · gõ tay).
* 3 nút dưới khung theo đúng thứ tự bậc thang: `Quét mã vạch` (0 giây) · `Đọc lại chữ (OCR)` (miễn
  phí) · `Nhờ AI đọc`. Hộp "đang đọc" có **đồng hồ giây** và nói rõ đang nhờ ai đọc; khi AI hỏng thì
  câu chữ đổi thành *"AI không đọc được — đang thử OCR của Google (miễn phí)…"* để người dùng hiểu
  vì sao phải chờ thêm. Chỉ khi **cả hai** hỏng mới quăng một thông báo lỗi + đưa con trỏ tới ô gõ mã.
* **Cảnh báo mới "cùng mã, khác màu"**: khi ≥2 gợi ý cùng mang đúng một mã, dải chữ nói thẳng *các
  gợi ý chỉ khác nhau ở màu/thông số, máy KHÔNG tự chốt, nhìn tem rồi chọn*. Đây đúng là ca mà OCR
  đọc lệch `345`↔`145` — máy thu hẹp 5.610 dòng còn 3 dòng đúng mã, việc chọn màu để mắt người làm.

---

## 6. Lõi đối soát (`NDS_ENGINE`, trong `factory/index.html`)

Nằm giữa 2 mốc `/*<NDS-ENGINE>*/ … /*</NDS-ENGINE>*/` — **thuần tính toán, không chạm DOM**, để 2 bộ
test cắt ra chạy trong Node (bản test và bản chạy thật không bao giờ lệch nhau).

**Bóc `PRODUCTNAME` của WMS thành 4 rổ theo vai.** Tên WMS có dạng
`Tên hàng / Mã_NCC / chất liệu / định lượng / màu / size / thông số / đơn vị`, ví dụ:

```
Chỉ Irisa / F9-5284_Phong Việt / Polyester / None / Hồng tro / None / Text 27-60-3-Tkt 120 / mm
Dây kéo cước thuận #3 / 8846295_YKK / 100% Polyester / None / Soft Citrus-(Vàng nhạt)-345 / Size 3 / 38cm / pcs
```

| Rổ | Trọng số | Cách bắt |
|---|---|---|
| MÃ | **45%** | có cả chữ lẫn số (`F9-5284`, `JC01262`, `SAB-255LK3557-2`) hoặc ≥5 chữ số (`8846295`) |
| THÔNG SỐ | **25%** | `Tex 27` · `Tkt 120` · `60/3` · `38.0 CM` · `17mm` · `20*58mm` · `24L` · `#3` · `170gsm` |
| MÀU | **20%** | từ màu (vi+en) + mã màu số (`345`, `074`, `19-4117`) + **mã màu chữ-số trong đoạn có từ màu** (`V6S70`, `TN050`) |
| LOẠI/NCC | **10%** | chữ sau `_` (nhà cung cấp) + tên loại hàng + chữ còn lại |

**Chuẩn hoá** để tem và WMS gặp được nhau: bỏ dấu · `58,5cm→58.5cm` · `38.0→38` · `60/3→60-3` ·
`20*58mm→20x58mm` · `38 cm→38cm` · `Text 27→tex27` · `Tkt 120→tkt120` · và **dạng chịu lỗi OCR**
(O↔0, I/L↔1, S↔5, B↔8, Z↔2, G↔6) nên `Tkt12O` gặp được `Tkt120`, `JCO1262` gặp `JC01262`.

**Tính điểm**
* Vai MÃ lấy **mã khớp tốt nhất** (tem in nhiều mã: mã NCC + mã khách + số PO; khớp *một* mã là đã
  định danh xong — lấy trung bình thì tem càng nhiều thông tin điểm càng thấp, ngược đời).
* Vai còn lại lấy **nửa max + nửa trung bình**.
* Vai nào tem không đọc được thì **chia lại trọng số** cho các vai còn lại.
* **XUNG ĐỘT**: cùng một *họ* thông số (cm/mm/gsm/tex/tkt/cỡ/tỉ lệ) hoặc mã màu có mặt ở **cả hai
  bên** mà không giá trị nào khớp → trừ 18%/họ. Đây là thứ tách được 102 biến thể dây kéo `8846295`
  chỉ khác nhau **chiều dài** và **màu**.
* **ĐỦ CĂN CỨ CHƯA**: khớp được mã → hệ số 0,88–1; không có mã → 0,55–1 theo *bề rộng* bằng chứng.
  Không có bước này thì tem mờ đọc được 2 chữ ("Irisa", "Hồng") vẫn ra "100% khớp" cho hàng trăm
  cuộn chỉ hồng — con số tự tin đó nguy hiểm hơn là không có con số nào.
* Tem có in **thẳng mã SKU nội bộ** (≥6 số) → 100%, khỏi chấm điểm.
* Cùng điểm thì ưu tiên SKU **đang có tồn**.

**Gom biến thể theo đơn vị** (`donVi` · `khoaHang`, thêm 19/08/2026). Sau khi chấm điểm, các dòng
**cùng `khoaHang`** (= `PRODUCTNAME` bỏ đoạn đơn vị ở cuối) được gom thành **một mặt hàng**:

* đại diện = **đơn vị nhỏ nhất** còn hợp phạm vi đang xem → Top 3 là 3 *mặt hàng*, không còn bị 3
  đơn vị của cùng một thứ chiếm hết chỗ;
* điểm của đại diện lấy **max của cả nhóm** (gộp không được làm tụt hạng);
* các đơn vị còn lại thành `bienThe` → vẽ thành nút bấm-là-chọn ngay trong thẻ;
* **tem in thẳng SKU nội bộ thì KHÔNG đổi** — người ta dán mã nào thì trả mã đó.

Thang "nhỏ hơn" quy về đơn vị gốc của họ (m · kg · lít · cái): `mm 0,001 < cm 0,01 < inch 0,0254 <
yard 0,9144 < m 1` · `mg < g/gam/gram < kg < tấn` · họ ĐẾM `pcs 1 < đôi 2 < bộ 5 < cây 50 < cuộn
100 < thùng 200` (đơn vị GỘP phải lớn hơn hẳn mm/gram). Đơn vị lạ → 1 (trung tính).

> **Bẫy:** đoạn đơn vị hay dính **quy cách cuộn** — `"cuộn 5000m, mm"`. Mẩu **có chữ số** bị bỏ qua,
> nếu không thì `5000m` bị đọc thành đơn vị `m` và SKU tính theo mm tụt hạng sau SKU tính theo cuộn
> — hỏng đúng cái luật này. `qc-nhan-dien-sku.mjs` khoá cả 18 dạng đoạn đơn vị gặp thật.

Vì phải liệt kê được cả biến thể **đã chết**, bước chấm điểm **không** loại INACTIVE nữa; lọc theo
phạm vi ACTIVE/Tất cả lùi xuống lúc chọn đại diện (nhóm chết cả nhóm thì bỏ hẳn).

**Tốc độ**: chỉ mục ngược (token → dòng) dựng 1 lần ~0,35 giây; mỗi lượt đối soát **15–20 ms** trên
5.610 SKU — chậm hơn bản đầu (12–16 ms) vì nay chấm cả dòng INACTIVE để gom biến thể. Không có chỉ
mục thì fuzzy toàn bảng mất 5–10 giây trên điện thoại.

`others` (số lô · số PO · số lượng · ngày) **chỉ vào vai LOẠI/NCC 10%**. Đo thật 18/08: để nó vào
vai MÃ thì tem in "100 PCS" → "100" khớp rổ màu của SKU **khác màu** và vô hiệu hoá luôn cơ chế bắt
lệch màu; còn "5000m" thì đẩy một SKU **khác mã** lên ngang điểm với SKU đúng.

---

## 7. Giao diện

3 khối, thứ tự chốt 19/08/2026 (xem mục 4): **1 · Ảnh tem** (camera sau / chọn ảnh / xoay ±90° ·
thu nhỏ 1400px JPEG q0.72 ngay trên máy · nút **Quét mã vạch** là nút chính, **Đọc tem bằng AI** hạ
xuống nút phụ) → **2 · SKU gợi ý** → **3 · Từ khoá** (badge tô màu theo vai, bấm × bỏ từ khoá đọc
nhầm, gõ thêm tay, hoặc dán nguyên chữ trên tem).

Mục **2 · SKU gợi ý** (Top 3: SKU · % · thanh tiến trình · tên sản phẩm **tô đậm
phần trùng khớp** · COMBO/NORMAL · **ACTIVE/INACTIVE** · `Tồn: 8.200.000 mm` · `ĐVT: mm` · chip từ
khoá đã khớp · dòng "Lệch: …" khi có xung đột · dòng **"Cùng mặt hàng, khác đơn vị"** ·
**Chọn SKU này** / Copy mã).

* "Chọn SKU này" → `pcAdd(...)` = **đúng cái giỏ** mà tab Kiểm kê / Tồn kho bất thường đang dùng,
  kèm **lý do chọn** ("Nhận diện tem: 8846295 345 ykk (97%) · ĐVT pcs") → bấm tiếp "Tạo lệnh kiểm
  kê" là xong. Nút biến thể trong dòng "Cùng mặt hàng, khác đơn vị" đi **cùng một đường** (chọn đúng
  SKU của nút đó, lý do vẫn giữ % của nhóm).
* Rời tab thì **tắt camera** (không để đèn camera sáng, đỡ hao pin).
* Bỏ một từ khoá thì nó **không sống lại** từ ô "dán chữ trên tem" (ô raw chỉ được tách lại khi nội
  dung ĐỔI; từ khoá đã bỏ được ghi nhớ cho tới khi đọc ảnh mới).
* Danh mục cache `localStorage` 12h → mở tab lần sau tức thì, mất mạng vẫn đối soát được.

---

## 8. Kiểm thử

| Lệnh | Kiểm gì | Kết quả 18/08/2026 |
|---|---|---|
| `node qc-nhan-dien-sku.mjs [--gviz] [--chi-tiet]` | lõi đối soát trên 5.610 SKU thật: 18 dạng đoạn ĐƠN VỊ, khoá gom mặt hàng, 3 quy cách tem, OCR sai nhẹ, SKU in trên tem, cùng mã khác màu, tem mờ, từ khoá rác, **ưu tiên đơn vị nhỏ nhất** (+ bất biến: không biến thể nào nhỏ hơn đại diện), **chữ ký + ghim sổ tay**, **6 ca chữ thô/OCR** (mã dài nhiều đoạn · chi số ghi liền · cỡ dán liền số đo · số đo không chiếm rổ mã · AI gán vai sai · số dài không khớp mã ngắn) | **55/55** · 8ms/lượt (19/08) |
| `node qc-tem-vision.mjs [--giu-anh]` | **đầu-cuối**: dựng 6 ảnh tem (3 quy cách × sạch/khó: nghiêng 7° + mờ + loá nylon + vết bẩn) → Gemini thật → engine, **ghép vai AI + chữ thô y như dashboard** | **6/6 ra đúng SKU** |
| `node qc-tab-nhan-dien.mjs [--anh]` | tab trong Edge headless: nạp gviz, badge, thẻ, tô trùng khớp, giỏ kiểm kê, **badge ACTIVE/INACTIVE + chip ĐVT**, **thẻ đơn vị nhỏ nhất + nút biến thể**, ACTIVE/Tất cả, AI lỗi, mất mạng, ảnh không đọc được, cache offline, **thứ tự bước mới**, **sổ tay học 1 lần ra ngay 0 lượt gọi AI**, **mã vạch (API giả)**, **không hỏi email**, **tự chạy khi có ảnh**, **thẻ gọn (không badge thừa · Tồn kèm ĐVT · details Vì sao khớp)**, **kết quả song song với ảnh**, bố cục điện thoại, tắt camera, lỗi JS, **bậc thang OCR↔AI** (OCR ra mã thì 0 lượt AI · không lập được mã thì tự leo thang · OCR chết vẫn ra kết quả · bỏ mảnh giấy tờ · cảnh báo cùng mã khác màu) | **77/77** (19/08) |
| `node qc-sku-vision-live.mjs` | cổng thật trên production: chặn email lạ, chặn ảnh quá lớn, đọc tem thật, chặn 2 lượt song song (tốn 2 lượt hạn mức) | **8/8** |
| `node qc-sku-ocr-live.mjs` | **cổng OCR thật** (`sku_ocr`): deploy đã lên chưa · email lạ · ảnh quá lớn không bao giờ được OCR · đọc đúng mã trên tem · **đo thời gian từng chặng** · chặn 2 lượt song song · ảnh trắng thì nói "không thấy chữ" | **10/10** (19/08) |
| `node qc-ocr-doi-chung.mjs [--so 30] [--duong ABCDEFG] [--dung-dem]` | **đo người đọc nào tốt hơn**: 7 đường (tin vai AI · +bằng chứng · chữ thô AI · OCR · OCR không lọc · ghép AI · ghép cả 2) trên cùng bộ tem, nhãn cắt từ SKU thật + chữ giấy tờ, 3 bậc khó. `--dung-dem` chạy lại **0 lượt gọi** | OCR **77%** Top-1 / 83% Top-3 (30 tem) |
| `node qc-loi-cu-moi.mjs [--rev e7c0753]` | **đối chứng lõi cũ (từ git) với lõi mới trên CÙNG chữ đã đọc** — cách duy nhất kết luận một lần sửa lõi là tốt hay xấu; có sẵn cột **"MỚI, tắt IDF"** để đo riêng phần trọng số | 1 tốt hơn · **0 xấu hơn** · 29 y cũ · Top-1 77→80% · lập được mã 70→77% |
| `node probe-sku-master.mjs` | thăm dò lại nguồn dữ liệu khi WMS đổi trường | — |

Hai bộ test đầu **cắt mã ra khỏi file thật** (`NDS-ENGINE` trong `factory/index.html`, `SV_PROMPT`/
`SV_SCHEMA` trong `google-script.gs`) — sửa mã mà quên sửa test là test tự đỏ, không có bản sao nào
để lệch. **Đừng xoá 2 dấu mốc `NDS-ENGINE`.**

### Ba lỗi thật do test bắt được (đừng để tái phát)
1. **Mã dính tên NCC**: `_` bị tính là ký tự trong mã → `F9-5284_Phong` ⇒ tem khớp mã chỉ đạt 0,88
   ("chứa trong") chứ không tuyệt đối. Đã tách `_` thành dấu phân cách.
2. **`100% Polyester` thành "mã màu 100"**: gần như mọi SKU đều có "100" trong rổ màu, chỉ cần một
   con số rác trên tem khớp với nó là cơ chế bắt lệch màu tắt ngóm.
3. **Bỏ từ khoá xong nó quay lại**: AI điền `raw_text` vào ô "dán chữ trên tem", mỗi lượt đối soát
   lại tách ô đó ra ⇒ từ khoá vừa bấm × sống lại ngay.

---

## 9. Còn lại / hạn chế

* **Sổ tay tem chỉ nằm trong máy** — mỗi điện thoại học riêng, đổi máy/xoá dữ liệu trình duyệt là
  mất. Muốn dùng chung: thêm action ghi Sheet ở GAS (khuôn `pc_uidgr_edit` sẵn có) + tab
  `SKU_TEM_HOC`, dashboard đọc về bằng gviz rồi trộn với sổ trong máy. **Cần deploy lại GAS.**
* **Đường mã vạch chưa chạy trên máy thật**: Edge/Windows không có `BarcodeDetector` (API chỉ có
  trên Android) nên bộ test chỉ kiểm được phần mã của mình bằng API giả. Ra kho quét thử một tem
  có mã vạch là biết ngay.
* **Chưa biết bao nhiêu phần trăm tem NCC có mã vạch** — chưa có ảnh tem thật để đếm. Con số này
  quyết định đường 2.1 gánh được bao nhiêu.
* **Đơn vị đóng gói không phân biệt được bằng tem** — đã xử lý 19/08/2026 bằng luật "đơn vị nhỏ
  nhất" (mục 1 + 3): "Chỉ Irisa F9-5284 Hồng tro" có 3 SKU khác đơn vị (mm · Cuộn 5000m · **Combo**
  cuộn 5000m) thì thẻ #1 là bản **mm** (`422377978`) kèm nút chọn bản "Cuộn 5000m" (`422286239`).
  Bản **COMBO đứng riêng** (tên WMS có tiền tố `(Combo)` nên khác `khoaHang`) — cố ý: combo là mặt
  hàng khác, không phải đơn vị khác của cùng một thứ.
* Chưa nối vào portal `kiemsoatkho` (Audit Hasaki) — muốn thì bóc khối `nds-*` thành module
  lazy-load như `factory-stock.js`.
* Chưa có ảnh tem **thật** của kho trong bộ test (đang dùng tem dựng lại theo đúng 3 quy cách trong
  đặc tả + bản "khó chụp"). Có ảnh thật thì bỏ vào `.exports/qc-tem/` và trỏ `qc-tem-vision.mjs` vào đó.
* **OCR trên máy (Tesseract.js) — đã cân nhắc và BÁC**: tải ~5 MB lần đầu, 2–6 s/ảnh trên điện thoại
  (không nhanh hơn AI), mà tem bọc nylon loá thì đọc sai nhiều hơn hẳn. Vừa chậm vừa sai thì không
  đáng đổi. Đường không-cần-AI đi bằng mã vạch + sổ tay (mục 2) hiệu quả hơn nhiều.

---

## 10. Tác động lên WMS (đo 19/08/2026)

Ràng buộc của dự án: **mọi cải tiến phải giảm hoặc không tăng lượt gọi upstream**. Dưới đây là số
đo thật của tính năng này, không phải ước lượng.

### 10.1 Đường ĐỌC — 7 lượt gọi/ngày

| Hạng mục | Số đo |
|---|---|
| Script chạm WMS | **duy nhất** `sync-sku-master.mjs` |
| Endpoint | `report-management/stock-inventories` (báo cáo, không phải endpoint nghiệp vụ) |
| Phạm vi | 3 kho nguyên liệu (1177 · 1458 · 1339) — 5.994 dòng |
| Lượt gọi mỗi lần chạy | **7** (5 trang Mastige + 2 trang Garment, `size=1000`, nghỉ 300 ms/trang) |
| Số lần CHẠY THẬT trong ngày | **1** — log 19/08: 18 lần được gọi, 5 bỏ qua vì "còn tươi" (<90′), 12 hoãn vì không có token |

⇒ **~7 lượt gọi WMS/ngày** cho toàn bộ tính năng. So sánh trong cùng cụm: `sync-tonbatthuong` quét
145.972 + 26.072 + 4.895 dòng, `sync-stocklocation` ~10 trang mỗi kho — SKU_MASTER là phần **nhỏ
nhất** của cụm.

### 10.2 Không đăng nhập ⇒ không thể đá phiên ai

`sync-sku-master.mjs` **tuyệt đối không tự đăng nhập**: không có token sống thì thoát 75 (hoãn).
Log 19/08 có **12 lượt** rơi đúng vào nhánh đó — và không tạo **một** phiên đăng nhập nào. Đây là
điểm quan trọng nhất về mặt rủi ro: tính năng này **không thể** gây ra sự cố "bị đá phiên WMS".

Đánh đổi: danh mục có thể **trễ** khi cả token kho lẫn token bridge đều chết (đúng tình trạng chiều
19/08). Dashboard vì vậy luôn ghi rõ **nguồn + giờ** ở dòng chân, và vẫn chạy được bằng bản cache
trong máy.

### 10.3 Đường GHI — tab này ghi ZERO vào WMS

Tab Nhận diện SKU **không ghi gì** vào WMS. Nó chỉ đổ SKU vào **đúng cái giỏ** `PC.sel` mà tab Kiểm
kê vẫn dùng. Việc ghi chỉ xảy ra khi bấm **"Tạo lệnh kiểm kê"**, và đó là đường **đã có từ trước**:

* `counting-plan/checklists/validate/type-sku` → 1 lượt
* `counting-plan/checklists/import/type-sku` → 1 lượt
* **2 lượt/lệnh**, bất kể lệnh có 1 hay 200 SKU
* dùng **token phiên của chính người dùng** qua extension cầu nối ⇒ `created_by` = tài khoản người
  đó, không phải bot

### 10.4 Điện thoại thủ kho → WMS = 0

Dashboard đọc **Google Sheet** qua gviz; AI đi qua **Apps Script**; mã vạch và sổ tay chạy **ngay
trên máy**. Không đường nào chạm WMS. Nghĩa là **N thủ kho × N lượt quét tem = 0 lượt gọi WMS** —
tải lên WMS **không phụ thuộc số người dùng**. Đây là lý do kiến trúc đặt Google Sheet ở giữa.

### 10.5 Tác động GIÁN TIẾP — cái đáng theo dõi nhất

Tính năng này làm việc tạo lệnh kiểm kê **dễ hơn hẳn** (trước: tra SKU thủ công; nay: chụp/gõ mã →
2 chạm). Nên **số lệnh và số phiếu kiểm kê trên WMS có thể tăng**. Đó là tải **nghiệp vụ** — người
đi đếm, phiếu chờ xử lý — chứ không phải tải API, và nó **không** nằm trong ràng buộc "nhẹ tải
upstream". Nhưng nên theo dõi: nếu số phiếu tăng nhanh, chỗ nghẽn sẽ là **người xử lý phiếu**, không
phải máy chủ WMS.
