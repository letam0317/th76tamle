# Nhận diện SKU — chụp tem NCC ra mã SKU nội bộ

Tab thứ 5 của **Audit Factory** (`factory/index.html`). Thủ kho chụp tem nhà cung cấp trên điện
thoại → AI đọc từ khoá → dashboard đối soát với danh mục SKU nguyên liệu → gợi ý **Top 3 SKU** kèm
% độ tin cậy → bấm thẻ là **copy mã SKU** và **ghi vào sổ tay tem** (lần sau gặp lại tem đó ra ngay,
không cần AI).

> **Đổi 20/08/2026 — phạm vi "tạo lệnh kiểm kê"**: trước đây bấm thẻ ở tab này đổ SKU thẳng vào giỏ
> *"Tạo lệnh kiểm kê"*. Nay đường đó **chỉ còn ở 2 tab: Kiểm kê và Tồn kho bất thường** (theo yêu
> cầu). Khoá bằng một danh sách duy nhất `PC_TAB={kk,abn}` trong `factory/index.html`, chặn cả ba
> đường: `pcAdd` (ghi vào giỏ), `pcSyncBar` (thanh giỏ nổi + preview không hiện ngoài 2 tab, nên nút
> *Tạo lệnh kiểm kê* cũng không với tới) và `pcOpen` (mở modal tạo lệnh). Giỏ **không bị xoá** khi
> ghé tab khác — chọn dở ở tab Kiểm kê, đi xem Planogram rồi quay lại vẫn còn nguyên.

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

**Học lúc nào**: đúng lúc người **bấm thẻ SKU** (trước 20/08/2026 là nút "Chọn SKU này") — đó là
khoảnh khắc DUY NHẤT ta biết chắc tem
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
  (Lần bác này là lúc ứng viên còn xếp theo **đếm đầu từ khoá**. Sau khi đổi sang cân theo IDF thì
  hạ trần lại an toàn — xem mục 3b.)

`ungVien` còn có chỉ mục **2-gram** thay cho quét tuyến tính 9.272 từ vựng. Chọn 2-gram chứ không
3-gram là có lý do: một ký tự sai phá tối đa **hai** 2-gram, mà từ dài ≥5 có ≥4 cái, nên mọi cặp mà
Levenshtein-có-ngưỡng chấp nhận đều còn chung ít nhất một 2-gram ⇒ rút ngắn danh sách mà **không bỏ
sót**. 3-gram thì `"abcde"` vs `"abXde"` mất sạch gram chung — sẽ sót.

---

## 3b. Vòng tối ưu 20/08/2026 — đo trong TRÌNH DUYỆT THẬT, không phải trong Node

Vì sao phải đo lại: mọi con số ở mục 3 đều đo bằng Node trên PC. Đo lại **trong Edge** và bóp CPU
để giả điện thoại thủ kho cầm ngoài kho (`Emulation.setCPUThrottlingRate`) thì lộ ra hai chuyện:

* mốc "một lượt tra dưới 50ms" **chỉ đạt trên PC** — bóp 4× là 70ms, bóp 6× là 111ms;
* thứ làm người dùng thấy "trang treo" **không phải bước tra** (12ms) mà là **bước dựng chỉ mục**:
  194ms trên PC nhưng **1,36 s** khi bóp 4× và **2,2 s** khi bóp 6×, chạy đồng bộ nên cả trang đứng.

| Đo trong Edge · 5.610 SKU | Trước | Sau | |
|---|---|---|---|
| Dựng chỉ mục · PC | 194 ms | **136 ms** | |
| Dựng chỉ mục · CPU 4× | 1.360 ms | **1.021 ms** | |
| **Luồng UI bị giữ** khi dựng · 4× | **1.179 ms** | **73 ms** | chia lô + nhường luồng |
| **Luồng UI bị giữ** khi dựng · 6× | **1.969 ms** | **142 ms** | |
| 1 lượt tra (30 OCR thật) · PC | 12,3 / 18,2 ms (p50/p95) | **6,3 / 8,6 ms** | |
| 1 lượt tra · CPU 4× | 70,0 / 106,5 ms | **34,7 / 48,9 ms** | đạt mốc <50ms |
| 1 lượt tra · CPU 6× | 111,2 / 173,6 ms | **57,7 / 84,6 ms** | |
| Đường gõ tay 1-3 mảnh (Node) | 7,4 ms | **1,9 ms** | |

Năm thay đổi, mỗi cái có số đo riêng (bốn cái đầu **không đổi một con số nào** của kết quả):

1. `boDau` có **đường nhanh ASCII** — chuỗi toàn ASCII thì không có dấu nào để bỏ, khỏi
   `normalize('NFD')`. Hồ sơ CPU cho thấy hàm này một mình ngốn **20,5%** bước dựng chỉ mục.
2. `loi()` **nhớ kết quả** như `chuan()`/`ocr()` đã làm. Nó bị gọi cả trên từ khoá (hàng trăm nghìn
   lượt mỗi lượt tra) lẫn trên **cả tên hàng** trong `locDong` (5.610 tên × mỗi mảnh người gõ) —
   chính chỗ thứ hai làm đường gõ tay nhanh gấp 4.
3. `khopTot` có **đường nhanh khớp tuyệt đối** (`ro.indexOf(tok)`): `khopTot`+`diemCap` chiếm **39%**
   bước tra, mà phần lớn từ khoá đã được `tuVanBan` lọc theo danh mục nên khớp nguyên văn.
4. `bocTen` **bỏ qua đoạn không có chữ số** ở bước bắt mã màu chữ-số — bước đó chỉ nhận token có số,
   mà mỗi tên hàng có 6-8 đoạn và phần lớn là chữ thuần.
5. Trần ứng viên **1.200 → 500**: chỗ duy nhất *tính ít đi*, nên phải đo kỹ. Trên 30 lượt OCR thật +
   400 tem mô phỏng, Top-1/Top-3 **y nguyên** ở mọi trần từ 1.200 xuống 150; thẻ hạng 2-3 (không
   phải đáp án) đổi ở 10/430 lượt tại trần 600 và 19/430 tại trần 400 ⇒ chọn 500. Nhúm dòng **mang
   đúng mã tem** vẫn được thêm vào sau bước cắt (`TRAN_MA`) nên trần không cắt mất bằng chứng định danh.

Và một thay đổi về **cách chạy**, không phải cách tính: `ndsNapDs` dựng chỉ mục **theo lô 200 dòng,
nhường luồng sau mỗi lô** (`dungChiMucViec` trong lõi — cùng một bản mã với `dungChiMuc`, chỉ khác
chỗ ngắt). Ba cấu hình đã đo, cột sau là mức giữ luồng lâu nhất ở 4×/6×:

| cách nhường | giữ luồng 4× / 6× | tổng thời gian |
|---|---|---|
| lô 500, nhường mỗi 3 lô | 494 / 848 ms | không đội |
| ngân sách 30-40ms mỗi lát | 128 / 158 ms | **đội 36-59%** |
| lô 200, nhường bằng `setTimeout(0)` | 59 / 122 ms | đội 25% |
| **lô 200, nhường bằng `MessageChannel`** | **73 / 142 ms** | **không đội** |

`setTimeout(0)` bị trình duyệt ghim sàn ~4ms mỗi lượt, gần 30 lượt liền là chỗ sinh ra 25% kia.

**Bẫy đã cắn ngay lúc viết** (bộ 92 ca bắt được, đáng ghi lại): bản đầu gán `NDS.ds = rows` *trước*
khi chỉ mục dựng xong. Nhưng `NDS.ds` chính là cờ "danh mục đã sẵn sàng" mà `ndsDoiSoat` xem, nên
một lượt đối soát chen vào giữa hai lô sẽ thấy cờ đã bật mà `NDS.cm` còn `null` ⇒ **không vẽ được
thẻ nào**. Hồi dựng đồng bộ thì không có kẽ nào để chen; chia lô là mở ra kẽ đó.

Sau vòng này: **64/64 ca lõi** + **93/93 ca trình duyệt** đạt, Top-1/Top-3 trên 30 lượt OCR thật vẫn
đúng **80%/90%**, và bộ 8 ca nghiệp vụ vẫn 8/8.

---

## 3c. Đã đo và KHÔNG lấy: dò khớp PHẦN TỬ tem ↔ PHẦN TỬ `PRODUCTNAME`

Ý tưởng: OCR đọc tem ra từng phần tử → lọc ký tự thừa trong từng phần tử → tìm dòng nào có phần tử
khớp. Không chấm điểm mờ, không fuzzy ⇒ đáng lẽ nhanh như tia chớp. Đã dựng thử (chỉ trong
scratchpad, không đưa vào dự án) và đo trên đúng 30 lượt OCR thật:

| | tốc độ p50 | Top-1 | Top-3 | không ra gợi ý |
|---|---|---|---|---|
| khớp **nguyên văn** phần tử | **0,03 ms** | 37% | 60% | 8/30 lượt |
| khớp **chứa nhau** | 1,20 ms | 33% | 50% | 0/30 |
| lõi sau cải tiến | 7,6 ms | **80%** | **90%** | 0/30 |

Nhanh hơn thật — 8 đến 250 lần. Nhưng nó không trả lời được câu hỏi của thủ kho, và lý do đo được
rất rõ: **58% phần tử của SKU đúng không hề được in trên tem**, chỉ **22%** được in nguyên văn. Tem
NCC và `PRODUCTNAME` của WMS không cùng quy ước — WMS ghép `F9-5284_Phong Việt` (mã + NCC trong một
phần tử), `Text 27-60-3-Tkt 120` (hai chỉ số trong một phần tử), còn tem in rời từng thứ.

Dùng làm **tầng sàng** (phần tử lọc trước, lõi chấm sau) cũng không ăn:

| tầng sàng | giữ được mặt hàng đúng | tập sàng (trung vị) |
|---|---|---|
| phần tử khớp nguyên văn | 70% (mất 9/30 lượt) | 45 dòng |
| phần tử khớp chứa nhau | 97% | 794 dòng |
| **`ungVien` hiện tại (trần 500)** | **100%** | 442 mặt hàng |

Khớp nguyên văn thì nhỏ mà **mất 30% đáp án**; khớp chứa nhau thì giữ được nhưng tập **to gần gấp
đôi** tập ứng viên hiện tại — tức không nhanh hơn. Thêm nữa, nhóm dòng đồng điểm cao nhất có trung vị
3-5 dòng và **max 626**, nên sau khi khớp phần tử vẫn phải có người phân giải: đúng những luật đang
có (ACTIVE → đóng gói → sổ tay → CÓ MÃ → đơn vị nhỏ nhất).

Chỗ mô hình này **dùng được** là một **đường tắt có điều kiện**, chưa làm:

| ngưỡng K (tập ≤ K dòng thì đi tắt) | đi tắt được | trong đó tập chứa mặt hàng đúng |
|---|---|---|
| 20 | 17% lượt | 80% |
| 50 | 27% lượt | 88% |
| 200 | 53% lượt | 94% |

Nghĩa là ~1/2 số tem có thể trả lời trong 0,03ms, nhưng cứ 16 lượt đi tắt thì 1 lượt tập sàng không
chứa mặt hàng đúng ⇒ muốn dùng thì phải **kiểm tra rồi rơi về đường thường**, chứ không được tin
đường tắt. Đường gõ tay (`locDong`) thì có thể đổi sang chỉ mục phần tử để xuống ~0,02 ms — nhưng
đổi thế là mất khả năng gõ **nửa** phần tử (`gecko` trong `Gài Gecko C3298`), thứ thủ kho đang dùng.

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

### 5b.5b Bảng chặng đầy-đủ của MỘT lượt quét (đo 19/08/2026, trang thật)

Ảnh mẫu "nặng như ảnh chụp trong kho" (nhiễu hạt mịn, 2400×1600 → gửi lên 158 KB):

| Chặng | wifi | 4G yếu (1,6/0,75 Mbps · 300 ms) | Ai giữ chặng này |
|---|---|---|---|
| Nén ảnh trên máy | 0,13 s | 0,13 s | mình |
| Đẩy ảnh lên | ~0,1 s | **~1,7 s** | mình (byte) |
| 2 chặng Apps Script (`exec` → 302 → `echo`) | **~1,8 s** | ~2,2 s | **Google** |
| Gemini đọc ảnh | **~2,3 s** | ~2,3 s | **Google** |
| Đối soát 5.613 SKU + vẽ thẻ | 0,035 s | 0,03 s | mình |
| **TỔNG tới lúc hiện Top 3** | **5,1–5,4 s** | **6,6–7,6 s** | |

Trước gói cắt byte: 4G yếu **8,0–8,3 s** (ảnh 209 KB) ⇒ cắt được **~1,3–1,7 s**. Trên wifi thì byte
không phải chặng nghẽn nên không đổi. **Hai chặng lớn nhất (~4,1 s) đều nằm ngoài tầm mình** — đó là
lý do không thể hứa "1–2 giây" như gọi model trực tiếp.

**Nếu muốn cắt tiếp thì chỉ còn 4 đường** (xếp theo lợi ích ÷ rủi ro):

| Đường | Cắt được | Cái giá |
|---|---|---|
| **Sổ tay tem DÙNG CHUNG** (thêm action GAS + tab `SKU_TEM_HOC`) | **5 s → 0 s** cho mọi tem đã có người chốt 1 lần | thêm 1 tab Sheet + 1 đường ghi; sổ tay hiện chỉ nằm trong từng máy |
| **Cắt đúng vùng tem** trước khi gửi | ~0,8 s trên 4G (158 → ~70 KB) | dò sai vùng thì cắt mất chữ ⇒ phải "dò chắc mới cắt" |
| **Gọi Gemini TRỰC TIẾP từ trang** + đọc theo luồng (`streamGenerateContent`) | ~**3 s** (bỏ 1,8 s hai chặng GAS + thấy Top 3 ngay khi model trả mã, không đợi hết JSON) | **khoá AI nằm trong trang công khai**; giới hạn theo HTTP referrer chặn được người dùng thường, KHÔNG chặn được `curl` ⇒ có thể bị đốt hạn mức |
| **Proxy riêng** (Cloudflare Worker, bậc miễn phí) | ~1,6 s (phí proxy còn ~0,1–0,2 s) | thêm một hạ tầng mới phải trông |

Đường "gọi trực tiếp" chính là cách app Gemini đạt 1–2 giây: nó không có chặng proxy nào và nó
**đọc theo luồng**. Muốn số đó thì phải trả giá bằng việc lộ khoá — đó là quyết định nghiệp vụ,
không phải quyết định kỹ thuật.

> **ĐỘ TẢN của con số**: đo live 3 lượt trên trang thật ra **4,8 s · 6,7 s · 17,9 s** cho cùng một
> tem. Lượt 17,9 s **chỉ có MỘT** lượt gọi `sku_vision` (không phải thử lại), nên nguyên nhân nằm ở
> phía Google — Apps Script khởi động nguội hoặc model xếp hàng. Không có cách nào ép nhanh từ phía
> mình; đó chính là lý do phải có **đồng hồ giây + nhắc ở giây 12** thay vì cố hứa một con số.
> Lượt xấu nhất đo được là **28,5 s** (cũng chỉ MỘT lượt POST). Vì vậy tab **hâm nóng Apps Script**
> lúc mở: một lượt `chuanDoan` rỗng, không ảnh, **không tốn hạn mức nào**, chỉ để Google dựng sẵn
> instance trước khi thủ kho chụp tem.
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
* **HÀNG ĐẦU CỦA THẺ = TOÀN BỘ PHẦN ĐỌC NHANH** (chốt 19/08/2026 sau 2 lần rút):
  `hạng · SKU · Tồn + ĐVT · ghi chú · %` — ghi chú là *tem in đúng mã này · từ sổ tay · lệch <họ>*.
  Thẻ **không còn dòng phụ nào**: còn 2 dòng nội dung (hàng đầu + tên hàng) và một dòng tóm tắt gấp
  lại. Vì sao dồn được: mấy ghi chú đó chỉ 2–4 chữ **và** chúng quyết định "có tin thẻ này không",
  nên phải đọc **cùng lúc** với mã SKU chứ không phải sau khi đã lướt hết tên hàng dài của WMS.
  Hàng đã `flex-wrap` nên máy hẹp thì phần cuối tự xuống dòng — vẫn ngắn hơn một dòng phụ riêng
  (dòng phụ có `margin-top:7px` + chiều cao dòng của chính nó).
* **Nút `quên ghi nhớ này` ngay trên thẻ** khi kết quả đến từ sổ tay. LỖ THẬT phát hiện 19/08/2026:
  `ndsSoQuen()` có hàm, có cả ca test, nhưng **không có nút nào trong giao diện gọi tới** ⇒ bấm nhầm
  một lần là sổ tay ghim SKU sai ở **100% mãi mãi**, cách duy nhất là "Xoá sổ tay" (mất sạch mọi ghi
  nhớ). Nút phải nằm đúng chỗ người ta **nhìn thấy cái sai**. Bắt buộc `stopPropagation` — cả thẻ là
  nút chọn SKU, không chặn thì bấm "quên" lại thành "chọn lại đúng cái SKU sai đó" (đúng bẫy đã cắn
  với nút biến thể đơn vị); đã có ca test khoá lại.
* 3 nút dưới khung theo đúng thứ tự bậc thang: `Quét mã vạch` (0 giây) · `Đọc lại chữ (OCR)` (miễn
  phí) · `Nhờ AI đọc`. Hộp "đang đọc" có **đồng hồ giây** và nói rõ đang nhờ ai đọc; khi AI hỏng thì
  câu chữ đổi thành *"AI không đọc được — đang thử OCR của Google (miễn phí)…"* để người dùng hiểu
  vì sao phải chờ thêm. Chỉ khi **cả hai** hỏng mới quăng một thông báo lỗi + đưa con trỏ tới ô gõ mã.
* **Cảnh báo mới "cùng mã, khác màu"**: khi ≥2 gợi ý cùng mang đúng một mã, dải chữ nói thẳng *các
  gợi ý chỉ khác nhau ở màu/thông số, máy KHÔNG tự chốt, nhìn tem rồi chọn*. Đây đúng là ca mà OCR
  đọc lệch `345`↔`145` — máy thu hẹp 5.610 dòng còn 3 dòng đúng mã, việc chọn màu để mắt người làm.

### 5b.20 Bỏ dòng đếm mảnh + combo mẫu tem theo đúng khuôn dự án (20/08/2026)

**① Bỏ hẳn dòng đếm khi quét tem.** Toast cũ: *"OCR của Google đọc được 3 mã · 5 thông số/màu · bỏ 9
mảnh giấy tờ · 4,7s."* → nay chỉ còn **"Đã đọc xong tem."** (hoặc *"Chưa đọc được tem — chụp gần hơn,
hoặc gõ mã trên tem."*). Số mảnh bóc được vẫn thấy ở badge **"N từ khoá"** của bước 3 và ở chính mấy
viên từ khoá bên dưới — không cần đọc lại trong một dải chữ biến mất sau 6 giây.

**② Ô mẫu tem: `<select>` trần → COMBO của dự án.** Lệ dự án (đã ghi ở `tinh-dong-bo-du-an`): control
mới phải **tái dùng `.combo` / `.combo-menu` popIn + focus ring** sẵn có, **cấm control trần**. Modal
*In tem SKU* đang dùng `<select>` nên lệch hẳn ngôn ngữ thiết kế của mọi pop-up khác.

Nay: `prCbHtml(chon, sku)` dựng đúng khuôn `.combo` (input readonly + `.combo-menu` + `.combo-item`),
`data-s` = SKU của dòng, **không có `data-s`** nghĩa là ô *"áp cho tất cả"*. Mở/chọn/đóng qua
`prCbMo` · `prCbChon` · `prCbDong`; **Escape** và **bấm ra ngoài** móc vào ĐÚNG hai chuỗi xử lý chung
của trang (không dựng listener rời — mỗi listener rời là một chỗ có thể quên tháo). Escape đóng **menu**
trước, modal in vẫn mở — đúng nếp "cái nào nổi trên cùng thì đóng trước" của cả dự án.

Đo: menu mở với `animation-name: popIn`, 5 mẫu tem, chọn xong tự đóng và đổi nhãn, `0 <select>` còn lại
trong modal, không lỗi JS.

**Hai bẫy đã cắn ngay lúc làm:**

* `combo-menu` để `width:max-content` thì **dù đang ẩn** (`visibility:hidden`) nó **vẫn tính vào vùng
  cuộn** ⇒ sinh **62px kéo ngang** trong modal trên máy 390px (bộ test bắt được). Máy hẹp phải trả về
  khuôn gốc: menu rộng đúng bằng ô, chữ dài thì ngắt dòng trong mục.
* Ca test bắt phần tử combo **trước** khi chọn rồi đọc `input.value` **sau** khi chọn → `prDatMau` gọi
  `prVe()` dựng lại cả bảng nên node đó **đã rời cây** và vẫn mang nhãn cũ ⇒ đỏ oan. Phải truy lại DOM
  sau mỗi lần bảng vẽ lại.

Test: **77/77** lõi · **126/126** tab (+2 ca: *ô mẫu tem dùng combo, không còn `<select>` nào* ·
*combo mở có popIn, chọn xong tự đóng và đổi nhãn*).

### 5b.19 Điện thoại: bảng "SKU đã chọn để in tem" → THẺ (20/08/2026)

**Ảnh báo lỗi từ máy thật (390px):** modal *In tem SKU* dùng `<table>` 6 cột → cột **"Tên sản phẩm" co
còn MỘT ký tự, chữ xếp dọc** thành `T ê n s ả n p h…`, các dòng bị cắt, phải kéo ngang mới đọc. Đúng
bài học đã ghi ở pop-up chi tiết phiếu Kiểm kê: **trên điện thoại mỗi dòng là một THẺ, đừng ép bảng co.**

**Làm bằng CSS THUẦN** (không sửa JS/markup của khối in — khối đó đang được một lượt khác sửa, càng ít
chạm càng tốt): ẩn `thead`, mỗi `<tr>` thành lưới 3 cột, các `<td>` xếp theo `grid-area`:

```
[ SKU .................... Số tem [1] · × ]
[ tên hàng (ngắt dòng, tối đa 2 dòng)     ]
[ ĐVT: pcs ....... mẫu tem (rộng hết ô)   ]
```

Nhãn cột trả lại bằng `::before` (`ĐVT:` / `Số tem`) vì `thead` đã ẩn.

**Hai chỗ phải sửa thêm, phát hiện khi chụp lại:**

1. `.mfilters .fld` **đóng cứng `height:32px`** cho bố cục một hàng. Xếp dọc mà giữ chiều cao đó thì ô
   chọn **tràn khỏi viên pill và hai viên ĐÈ NHAU**. Bản đầu mở `height:auto` — hết đè nhưng ngốn
   **130px** chiều dọc, trên màn 844px chỉ còn thấy ĐÚNG MỘT thẻ.
2. Chốt: **gộp hai ô "áp cho tất cả" vào MỘT hàng** `1fr 104px`, rút nhãn dài
   *"ÁP MẪU TEM CHO TẤT CẢ"* → **`MẪU`** / **`SL`** bằng `font-size:0` + `::before` — đổi chữ hiển thị
   mà **không sửa markup**. Lấy lại ~90px ⇒ thấy 2 thẻ.

**Đo sau khi sửa (máy 390×844):** kéo ngang trong modal **0px**, tràn ngang trang **0px**, `tr` là
`grid`, `thead` `display:none`, cột tên rộng **324px** (trước: ~15px), ô chọn mẫu rộng 179px thay vì bị
cắt chữ. Hai vùng cuộn có chiều cao đoán được (`modalbody 40vh` · `pr-xem 30vh`) nên **nút "In" luôn
nhìn thấy**.

Kèm theo: hàng thông tin của thẻ gợi ý nay giữ **ba** thứ (chữ tóm tắt · nhãn "lệch …" · nút **In tem**)
nên cho `flex-wrap` — máy hẹp thì xuống 2 dòng, thà vậy còn hơn đẩy nút ra khỏi thẻ. Ca test đổi trần
chiều cao 1 dòng → 2 dòng (72px), thứ vẫn khoá là **không tràn** và **nhãn lệch nằm cùng hàng, bên phải**.

> **⚠ NGƯỠNG PHẢI LÀ 1000px, KHÔNG PHẢI 640px** (siết ngay sau khi user báo *"vẫn hiển thị như cũ"*).
> Hai nguyên nhân, cả hai đều thật:
> * GitHub Pages gửi `Cache-Control: max-age=600` ⇒ máy có thể giữ HTML cũ tới **10 phút**. Chữa: tải
>   lại mạnh (đóng tab rồi mở lại).
> * **Quan trọng hơn**: điện thoại bật *"Trang máy tính"* thì **viewport CSS thành ~980px** nên MỌI quy
>   tắc `@media(max-width:640px)` **không ăn** — mà màn hình vẫn 390px. Ngưỡng **1000px** phủ luôn ca
>   đó; máy bàn thật (≥1024px) vẫn được bố cục bảng. Đo lại ở viewport 980px: kéo ngang 0px, cột tên
>   hàng rộng 890px. **Bài học: đừng chọn ngưỡng theo "cỡ điện thoại", chọn theo cỡ mà bố cục kia thật
>   sự cần.**

**Trang Tổng quan — hai công cụ kho lên hàng đầu** (cùng lượt): thêm cờ `uuTien` cho nhóm *Công cụ kho*
và `homeRender()` vẽ nhóm có cờ đó trước (sort ổn định nên các nhóm còn lại giữ nguyên thứ tự khai báo).
**Chỉ đổi thứ tự VẼ ở trang Tổng quan** — thứ tự trong `HOME_MUC` (và do đó ở thanh bên) giữ nguyên, khỏi
đổi thói tay người đang dùng. Hai công cụ này dùng ngay tại chỗ, không cần dữ liệu nền, nên là thứ hay
chọn nhất.

Ca test mới: *danh sách in là THẺ (không bóp bảng), tên hàng ≥240px, không kéo ngang* · *hai ô "áp cho
tất cả" cùng hàng và không đè nhau*. Cũng sửa ca cũ **bấm `#ndsScopeAll`** (nút đã bỏ) sang gọi
`ndsDoiScope()` và khoá luôn việc hai nút đó không được quay lại. Test: **77/77** lõi · **124/124** tab.

### 5b.17 SOÁT 30 TEM THẬT — bảng "mảnh nào vào vai nào" (20/08/2026)

Cách soát: chạy 30 lượt OCR thật (đã có đáp án) qua `tuVanBan`, rồi **đối chiếu vai của từng mảnh với
vai THẬT của mảnh đó trong tên hàng của đáp án** (`bocTen(pn)`). Chạy 3 giây, 0 lượt gọi mạng.

| Nhóm | Số loại | Ghi chú |
|---|---|---|
| Xếp sai vai | **51** | **toàn bộ cùng một hướng: mảnh MÃ bị nhân đôi vào rổ MÀU** |
| Rác trong rổ MÃ | 8 | `210000` · `21000` · `270000` · `100d-2` · `polyester-50` · `ag00133nh` |
| Rác trong rổ MÀU | 15 | dẫn đầu là **`tan` xuất hiện 20/30 tem** |
| Bị bỏ oan | **0** | bộ lọc theo danh mục không làm mất mảnh nào cần thiết |

**① `tan` = ĐỊA CHỈ NHÀ MÁY in trên mọi tem**: "ADD: LOT 24, **TÂN** THỚI HIỆP IP, DIST 12, HCMC" → bỏ
dấu thành `tan`, trùng từ màu tiếng Anh trong `TU_MAU`. Điểm mỗi vai là `(max + trung bình)/2` trên
mảnh **của tem**, nên một mảnh không khớp **làm loãng trung bình của MỌI ứng viên**. Chữa: cắt phần sau
nhãn `ADD/ADDRESS/ĐỊA CHỈ` trên **từng dòng**. Sau khi cắt: `tan` 20 → 0, rác rổ màu 15 → 12, xếp sai
vai 51 → 47.

**② Mã màu của tem phải CÓ THẬT trong danh mục** (`cm.mauVung`, dựng lúc dựng chỉ mục). Trước đây bất
kỳ mảnh chữ-số nào trong rổ màu cũng được coi là mã màu ⇒ tem dây kéo SAB có `sab-255lk3557-2` và
`no.3` trong rổ màu ⇒ dòng **đúng** (có mã màu thật `PD00695MIM`) bị trừ 18%, nhường hạng 1 cho dòng
**không có mã màu nào**. Cùng họ sự cố "5000 M" (5b.14), và cách này giải luôn ca `165` (lấy từ "NET
165 KG") đã làm một bản vá trước đó phải lùi.

### 5b.18 Bốn bản vá theo bảng soát — 3 giữ, 1 BÁC (20/08/2026)

Mỗi bản vá **đo riêng** trên 30 tem thật trước khi chốt. Kết quả cuối: **Top-1 77% → 87% (26/30),
Top-3 90% → 93%, 3 lượt tốt hơn · 0 lượt xấu hơn.**

| # | Bản vá | Đo được | Chốt |
|---|---|---|---|
| A1 | **Ghép tỉ lệ chất liệu**: `100% Polyester` → `100%polyester`, áp cho CẢ tem và tên hàng trong `bocTen` nên hai bên khớp nhau | **+2 tem** | GIỮ |
| A2 | **Cứu mảnh sắp bị bỏ**: sửa đúng 1 ký tự mà thành TỪ MÀU có thật trong `cm.mauVung` thì xếp vào vai MÀU (tem in "Rêu", OCR trả "Riu") | 0 tem trên bộ này, nhưng lấy lại được bằng chứng màu | GIỮ |
| A5 | **Cỡ nút `16LN` = `16L` áp cho CẢ HAI phía** (trước chỉ áp cho tem ⇒ tem `16l` mà tên hàng `16ln`, chỉ khớp mờ ~0,85) | **+1 tem** | GIỮ |
| A3 | Phía TEM: mảnh đã ở rổ MÃ thì **đừng nhân đôi** sang rổ MÀU | **2 tốt hơn nhưng 1 XẤU HƠN** (tem 422407140: 89% đúng → 95% SAI); bỏ riêng A3 ra thì 25/30, 0 xấu hơn | **BÁC** |

> **A3 đáng ghi lại**: lý lẽ đúng, dữ liệu bác. Mấy mảnh mã trong rổ màu của tem đang **làm việc** —
> chúng khớp với mã màu chữ-số của dòng đúng (`V8S41` · `PD00695MIM` · `TN114-TN006B`), tức thứ tách
> được 102 biến thể dây kéo cùng mã. Muốn bỏ nhân đôi thì phải bù lại phần khớp đó trước.

**6 tem còn sai** — 3 trong số đó không phải lỗi máy:

| Tem | Nguyên nhân |
|---|---|
| 422292529 · 422394185 | Máy **cố ý** ưu tiên bản `/mm` thay bản `/cuộn 5000m` (luật kho); đáp án của bộ đề là bản cuộn ⇒ lệch đáp án, **không lệch luật** |
| 422278015 | Tem **không in chiều dài** mà các dòng chỉ khác nhau 14/16/18cm ⇒ **máy không thể biết** |
| 422276967 | Sau A2 đã lấy lại màu `reu`, nhưng tên hàng đáp án viết lệch khuôn ("Nút 2 holes - W/…") nên vẫn 75% vs 78% |
| 422487030 · còn 1 | soi riêng vòng sau |

## Giao diện — bốn việc cùng lượt (yêu cầu user)

* **Thông báo gọn**: toast thành công chỉ còn "Đã đọc xong tem." / "Chưa đọc được tem — chụp gần hơn.";
  bỏ hết "AI đọc được N từ khoá [model]", "mã vạch đã có trong sổ tay", "bỏ N mảnh giấy tờ".
  ⚠ **Toast HỎNG thì GIỮ nguyên nhân**: ca test khoá "báo bằng tiếng người + chỉ sang đường gõ mã" (nó
  đòi thấy chữ "trang HTML" và "Mã trên tem"). Rút hết thành "Không đọc được tem." là **mất đường chỉ
  dẫn** và ca test đỏ ngay. Thông báo lỗi không phải chỗ để gọn.
* **Bỏ khỏi giao diện**: dòng "(chụp bằng camera sau…)", dòng "Top 3 · chỉ SKU đang ACTIVE", và **hai
  nút `ACTIVE | Tất cả`**. Cờ `NDS.chiActive` vẫn còn (mặc định TRUE) vì hai đường đã bù đủ chỗ: dòng
  mang đúng mã tem thì INACTIVE vẫn hiện (5b.12), và không có dòng ACTIVE nào khớp thì `themInactive`
  tự trả nhóm INACTIVE kèm dải chữ.
* **Nút `＋ Tem` → `In tem`**, xuống **cùng hàng** với "N đơn vị khác · N từ khoá khớp" và nhãn "lệch
  …"; màu **cam cố định** `#f57c00` (như nút CHỤP — không ăn token accent vì accent đổi theo 7 theme),
  đã thêm thì **xanh + "✓ Đã thêm"** kèm hiệu ứng `nhanIn` (nảy + loé 0,32s).
  ⚠ Nút nay nằm **trong `<summary>`** nên `event.preventDefault()` là **bắt buộc** — không chặn thì bấm
  In tem lại mở/đóng luôn khối "vì sao khớp" (đúng họ bẫy với nút "quên ghi nhớ").

### 5b.16 Tem COATS astra C3185 — OCR dính "Col" vào mã, và lời mời "Ý bạn là…" (20/08/2026)

**Báo lỗi (gắt):** *"hình ảnh có mã màu là c3185 mà gợi ý không có SKU nào có phần tử c3185"* — Top 3
là 3 cuộn chỉ astra khác màu ở **32%**, kèm banner *"Chưa khớp được MÃ HÀNG nào"*.

`C3185` **có thật** trong danh mục: `422266554 · Chỉ may/COATS Phong Phú, C3185/…/Seashell Pink/…/Cuộn
5000m · ACTIVE · tồn 67` (+ bản Combo `422394070`).

**Trước hết, KIỂM XEM CÓ PHẢI DO CÁC BẢN VÁ TRONG NGÀY** (user nói "càng cải tiến càng sai" — phải trả
lời bằng số, không phải bằng lời):

| Chữ OCR có thể ra | Lõi SÁNG NAY (169b21c) | Lõi sau các bản vá trong ngày |
|---|---|---|
| `Col C3185` (đọc chuẩn) | ✗ trả bản **COMBO** 422394070 | ✓ **422266554** |
| `ColC3185` (dính liền) | ✗ 422273836 · 38% | ✗ 422273836 · 38% |
| `COIC3185` (l→I) | ✗ 38% | ✗ 38% |
| `Col C3186` (lệch 1 số) | ✗ 67% | ✗ 67% |

⇒ Tem này **chưa bao giờ nhận được**; các bản vá trong ngày chỉ làm ca "đọc chuẩn" từ SAI thành ĐÚNG.
Nhưng đó không phải cái người dùng cần — họ cần nó ĐÚNG với chữ mà OCR THẬT trả về.

**Gốc:** nhãn màu in `Col C3185`. OCR trả về **dính liền** (`ColC3185`) hoặc lệch chữ (`COIC3185`).
Token thành `colc3185`, mà `cm.idx["colc3185"]` không có ⇒ **luật cứng "CÓ MÃ" không bắn** ⇒ rơi xuống
chấm bằng chữ chung (`astra` · `COATS` · `Polyester` · `5000m`) ⇒ 3 cuộn chỉ khác màu ở 32%.
`coTuGanGiong` chỉ **GIỮ** token lại (để nó không bị coi là chữ giấy tờ) chứ **không SỬA** nó, nên mọi
bước sau vẫn tra bằng chuỗi sai.

**Chữa — `suaMaTheoDanhMuc`, nguyên tắc DANH MỤC LÀM CHỨNG, không đoán bừa:**

```
(1) cắt tiền tố TOÀN CHỮ ≤4 ký tự (col · coi · color · art · ref · lot …) rồi tra lại chỉ mục
(2) lệch ĐÚNG MỘT ký tự, cùng độ dài, và CHỈ CÓ MỘT ứng viên  →  đổi (c0098 → c0097)
    ≥2 ứng viên  →  KHÔNG đổi (c3186 có cả c3185 và c3184; f9-5285 có 4 ứng viên)
```

Chỉ áp cho mảnh **ra dáng mã**, và chỉ khi bản gốc **không có nguyên văn** trong danh mục. Kết quả:
5/6 kiểu OCR ở trên nay ra `#1 = 422266554 · 94%`.

**Ca thứ 6 (lệch 1 số, ≥2 ứng viên) — mời chọn thay vì bỏ mặc.** Đoán bừa là chọn sai hàng, nhưng để
người dùng ở cái banner "chưa khớp mã" cũng vô ích: họ **đang cầm tem**, chỉ cần thấy 2-3 mã gần nhất
là nhận ra ngay. Banner nay kèm dải **"Ý bạn là: c3185 · c3184"** — chỉ liệt mã **CÓ THẬT** trong chỉ
mục (`maGanGiong`), kèm số dòng, bấm một cái là chạy đúng đường "Tra theo mã" sẵn có.

Đo: **Top-1 77% → 80%** trên 30 lượt OCR thật (1 tốt hơn · 0 xấu hơn), và cột "khớp được mã" **về lại
77%** — bản sửa chính tả lấy lại được đúng lượt trước đó bị mất cờ `coMaKhop`.
Test: **77/77** lõi (+7 ca: 4 kiểu OCR của C3185 · *≥2 ứng viên thì KHÔNG tự đổi* · *phải mời chọn* ·
*không bao giờ tự nghĩ ra mã*) · **122/122** tab (+1 ca dải "Ý bạn là…").

> **Bẫy của chính công cụ sửa mã**: `esc()` + nháy đơn lồng nhiều tầng trong `onclick` — chuỗi
> `ndsDungMa('…')` bị công cụ soạn ăn mất dấu gạch chéo, thành `ndsDungMa(''+esc(m)+'')` (JS vẫn
> hợp lệ nên KHÔNG có lỗi cú pháp, chỉ là click ra `ndsDungMa(c3185)` — biến không tồn tại). Nay viết
> nháy đơn bằng thực thể HTML `&#39;`, và ca test đọc `getAttribute("onclick")` đã giải mã thay vì
> khớp regex trên chuỗi thô.

### 5b.15 Thẻ mẫu CMTS07 — chất liệu bị nhận là MÃ, và màu ĐEN ↔ Black (20/08/2026)

**Ảnh báo lỗi:** thẻ *Mẫu đối* — `Mã sản phẩm CMTS07` · HENLEY-T-SHIRT_MAN_REGULAR_PIQUE · XL ·
`BH-P006-PIQUE 60%Cotton + 40%Poly - 275gsm` · **Màu sắc ĐEN**. Tab gợi ý 3 dòng **Vải pique BH-P006**
(Coconut Milk / Red Ochre / Forest Biome, 64%) — không dòng nào mang CMTS07, không dòng nào màu đen.

**BA nguyên nhân, độc lập nhau:**

**① Banner "Chưa khớp được MÃ HÀNG nào" là do CACHE CŨ trên máy.** `CMTS07` có thật trong danh mục —
**16 dòng** (`Áo mẫu PP/SS/FT/CMTS07/...`), tất cả từ kho MẪU nhặt về lúc 11:16. Ảnh chụp 13:18 nhưng
`NDS_CACHE_TTL = 12 giờ`, nên máy đó vẫn đang dùng bản danh mục nạp từ sáng (chưa có kho mẫu). Nút
`⟳ Tải lại danh mục` ở dòng chân là đường chữa tay; muốn tự động thì phải hạ TTL hoặc so mốc ghi tab.

**② TỈ LỆ CHẤT LIỆU bị nhận là MÃ HÀNG.** `60%Cotton` · `40%Poly` cũng "chữ lẫn số" nên `RE_CODE` đưa
vào **rổ MÃ (nặng 45%)**. Hậu quả đo được trên danh mục live: mọi dòng chứa "60% Cotton" đều được đánh
dấu **CÓ MÃ**, nên luật cứng "CÓ MÃ" mất sạch sức phân biệt:

```
hạng 1  422492801  44%  ACTIVE    Áo Mẫu FT/CMPO0015/…        ← KHÔNG có CMTS07, vẫn coMa=true
hạng 3  422301645  61%  INACTIVE  Áo mẫu SS/CMTS07/…/Coconut Milk/Size XL
hạng 4  422322154  61%  INACTIVE  Áo mẫu PP/CMTS07/…/Black/Size XL   ← đáp án
```

Cùng mức "có mã" ⇒ bậc ACTIVE được quyền nói ⇒ dòng ACTIVE tồn 1 đè 16 dòng mang đúng mã tồn 0.
**Chữa:** thêm `[0-9]+([.,][0-9]+)?%.*` vào `RE_KHONG_LA_MA` — chất liệu là THÔNG SỐ, không phải định
danh (cả tem lẫn tên hàng WMS đều bóc bằng cùng hàm nên hai bên vẫn khớp nhau).

**③ MÀU VIỆT ↔ ANH không nối.** Thẻ ghi `ĐEN`, tên hàng ghi `…/Black/Size XL` ⇒ rổ màu hai bên không
có một chữ chung ⇒ màu (20% trọng số) đóng góp **0 cho cả dòng đúng lẫn dòng sai**, nên "Coconut Milk"
và "Black" cùng 61%. **Chữa:** bảng `DONG_NGHIA_MAU`, nối lúc **dựng chỉ mục** vào rổ màu + `all` của
từng DÒNG (không phải của tem — điểm mỗi vai là `(max+trung bình)/2` trên mảnh CỦA TEM, thêm mảnh vào
tem là làm loãng trung bình; thêm vào rổ của dòng thì chỉ có thể làm `khopTot` cao hơn).

**Kết quả:** `#1 = 422322154 · 67% · Áo mẫu PP/CMTS07/…/Black/Size XL` — đúng mã, đúng màu, đúng size.
Top 3 nay **toàn dòng mang CMTS07**.

## Chữa nguyên nhân ① — SOÁT MỐC GHI TAB thay vì bắt người dùng nhớ bấm nút

`NDS_CACHE_TTL` **12 giờ → 2 giờ**, nhưng TTL chỉ còn là **lưới cuối**. Đường chính là
`ndsSoatMocDanhMuc()`:

1. Mở tab → dùng bản cache **ngay** (không ai phải chờ, giữ nguyên tốc độ).
2. Ở NỀN, hỏi mốc `LAST_SYNC_SKU_MASTER` bằng **đúng đường JSONP mà chip giờ dữ liệu vẫn dùng**
   (`action=lastSync` — không tốn hạn mức AI, không đụng WMS, 1 lượt GET nhỏ).
3. Mốc mới hơn bản đang giữ (đệm **60 giây** cho lệch đồng hồ máy trạm ↔ điện thoại) ⇒ xoá cache,
   nạp lại, và **đối soát lại** nếu trên màn hình đang có từ khoá; kèm một toast (nay ở đầu màn hình).

Kiểm chứng mốc thật: `LAST_SYNC_SKU_MASTER = 11:18:18 20/08/2026` — đúng giây lượt sync ghi tab, tức
GAS đã tự chạm mốc này ở đường ghi (`syncTasks`), không cần thêm gì phía máy trạm.

Ca test khoá cả hai chiều: *mốc cũ hơn cache ⇒ KHÔNG tải lại* (không thì mỗi lần mở tab là tải lại
1,5 MB vô ích) và *mốc mới hơn ⇒ phải tải lại*, cùng với `TTL ≤ 2h`.

## Hai bản vá TỰ GÂY LỖI, bộ đối chứng bắt được ngay — đừng làm lại

**(a) "Mã hàng đã ở rổ MÃ thì đừng tính là mã màu nữa".** Nghe rất hợp lý (nó là họ hàng của sự cố
"5000 M" ở 5b.14). Thực tế: tem vải Rib `NKT189` có rổ màu `nkt189 · cm40 · tn114-tn006b · 165`; bỏ
mấy mảnh trùng rổ MÃ đi thì **chỉ còn `165`** (lấy từ "NET 165 KG") làm bằng chứng mã màu — nó chẳng
khớp dòng nào ⇒ **sinh xung đột mã màu GIẢ cho CẢ HAI** biến thể White/Navy, 97% tụt 80%, thứ tự đảo.
Chính mấy mảnh mã "trùng" đó đang giữ cho cơ chế xung đột khỏi bắn bừa. **Đã lùi lại.**

**(b) Nối màu HAI CHIỀU.** Nhà cung cấp **"Trang Nhã"** — bỏ dấu thành `trang`, **trùng đúng chữ
"trắng"** — nên mọi dòng của NCC đó được cộng thêm màu `white`; biến thể **Navy tự nhận mình là trắng**
và đè biến thể White đúng. Tên riêng tiếng Việt trùng từ màu là chuyện thường (Trang · Hồng · Ngọc ·
Cam), còn từ màu TIẾNG ANH gần như không bao giờ là tên NCC ⇒ **chỉ nối một chiều Anh→Việt**
(`black→den`, `white→trang`). Ca thật của user (tem "ĐEN", tên hàng "Black") nằm đúng chiều này; chiều
ngược chấp nhận bỏ.

**Đo đối chứng 30 lượt OCR thật:** Top-1 **77% → 80%**, Top-3 90% giữ nguyên, **1 tốt hơn · 0 xấu
hơn**. Test **72/72** lõi (đường live có kho mẫu) · **70/70** (đường bản nháp) · **120/120** tab, gồm 4
ca mới: *chất liệu không vào rổ MÃ* · *Top 3 toàn dòng CMTS07* · *ĐEN khớp được "Black"* · *nối màu
không chảy ngược (dòng của "Trang Nhã" không tự nhận white)*.

> **Bài học**: hai bản vá bị lùi ở trên đều **đúng về lý** và đều **sai trên dữ liệu thật**. Cả hai chỉ
> bị bắt vì có bộ đối chứng 30 lượt OCR thật chạy trong 3 giây, 0 lượt gọi mạng. Sửa lõi mà không chạy
> `qc-loi-cu-moi.mjs` thì hai lỗi này đã lên trang thật.

### 5b.14 Sự cố tem Lenio F0-1588 — "5000 M" bị coi là MÃ MÀU (20/08/2026, chiều)

**Báo lỗi:** *"sao không gợi ý 422487060 `Chỉ Lenio/F0-1588_Phong Việt/…/Tex 24-100D2/mm` (đúng) mà
gợi ý các SKU chỉ mẫu?"* — ảnh chụp màn hình cho thấy Top 3 là `422513319 · 422513324` (68%), đều là
**"Chỉ Lenio mẫu"**.

**Tem in:** `THESEUS Lenio · Made in Vietnam · 100D/2 · 5000 M · Tkt120 · Tex 24 · MA · H26/33367 · F0-1588`.
Danh mục có **11 dòng** mang mã F0-1588. Chấm điểm từng dòng:

| Điểm | SKU | Xung đột | Tên |
|---|---|---|---|
| 72% | 422389640 | — | Chỉ Lenio **mẫu**/…/Tex 24-100D-2/ cuộn 200m |
| 72% | 422447893 | — | Chỉ **mẫu**/Chỉ may Lenio Phong Việt F0-1588/…/tex 24 100D-2 |
| 69% | 422513319/24/29 | — | Chỉ Lenio **mẫu**/…/Đen sample…/tex 24/cuộn 200m/mm |
| **59%** | **422487060** | **`mamau`** | **Chỉ Lenio/…/Deep Black 19-3911 TCX_PD00695MIM/Tex 24-100D2/mm** ← đáp án |

**Gốc — KHÔNG phải kho mẫu, mà là MỘT MẢNH BỊ XẾP SAI RỔ.** Tem in `5000 M` (chiều dài cuộn); OCR
đọc ra hai mảnh rời `5000` và `M`, và mảnh `5000` **rơi vào rổ MÀU** (luật mã màu nhận cả số trần
kiểu `345`, `074`). Dòng đúng có mã màu THẬT (`19-3911`, `PD00695MIM`) ⇒ máy so "tem nói mã màu 5000,
dòng nói 19-3911" ⇒ **XUNG ĐỘT MÃ MÀU GIẢ** ⇒ nhân 0,82 ⇒ **88% tụt xuống 59%**. Mấy dòng *"mẫu"* ghi
THIẾU mã màu nên **không có gì để lệch**, thoát án và leo lên hạng 1.

> Đây đúng mặt trái đã ghi ở 5b (ca nút Morito): **dòng ghi ĐỦ thông số bị phạt, dòng ghi THIẾU được
> thưởng**. Lần đó chữa bằng luật nghiệp vụ (ACTIVE/NORMAL là luật cứng) nên không đỡ được ca này —
> ở đây cả 11 dòng đều ACTIVE và NORMAL.

**Chữa — hẹp nhất có thể, ở đúng chỗ sai:** thêm `raDangMaMau(t)` và dùng cho **CẢ HAI phía** (tem và
danh mục, cùng một hàm để không bao giờ lệch nhau):

```
có chữ/gạch  → LÀ mã màu   (19-3911 · V8S41 · PD00695MIM · #006)
số trần      → chỉ 1-3 chữ số mới là mã màu   (345 · 074)
số trần ≥1000 → KHÔNG phải mã màu   (5000 M · MOQ ≤ 1000 · keo Bemis 3914 · mã vải 92419)
```

Không chạm vào cơ chế xung đột (thứ duy nhất tách được 102 biến thể dây kéo cùng mã 8846295).

**Đo đối chứng cũ-mới, 30 lượt OCR THẬT (`qc-loi-cu-moi.mjs`, 0 lượt gọi mạng):**

| Lõi | Top-1 | Top-3 |
|---|---|---|
| CŨ (HEAD) | 77% (23/30) | 90% (27/30) |
| **MỚI** | **80% (24/30)** | 90% (27/30) |

**1 lượt tốt hơn · 0 lượt xấu hơn · 29 lượt y như cũ.** Trên danh mục live, tem Lenio giờ ra
`#1 422487060` (72%, tồn 949.696.000 mm) — đúng đáp án.

> **Bẫy đọc số đo của bộ đối chứng**: cột "khớp được mã" tụt 77% → 73% **không phải** do bản vá — bộ
> này cố ý so **hai đường khác nhau** (`bocTen` của bản cũ vs `tuVanBan` của bản mới, xem ghi chú
> trong chính file). Dựng lại phép so với CÙNG một đường thì **0/30 lượt lệch** cờ `coMaKhop`. Đừng
> vội kết luận khi một cột đổi mà cột khác thì không.

Test: **67/67** lõi (+2 ca: *"5000 M" không được coi là mã màu* và mặt ngược *mã màu THẬT (345) vẫn
phải phân biệt được biến thể — không nới luật*) · **120/120** tab.

**Việc CHƯA làm, ghi lại kẻo quên:** `5000` hiện vẫn nằm trong rổ MÀU (chỉ thôi sinh xung đột chứ
chưa được xếp đúng chỗ). Xếp nó về rổ THÔNG SỐ khi mảnh sau là đơn vị (`5000` + `M` → `5000m`) sẽ cho
dòng đúng khớp thêm một thông số nữa (88% thay vì 72%) — nhưng đó là sửa `tuVanBan`, phạm vi rộng hơn,
cần đo lại cả 30 lượt.

### 5b.13 Nhặt kho MẪU + toast lên đầu + sự cố GHI HỤT DANH MỤC (20/08/2026, chiều)

**① Toast lên ĐẦU màn hình.** Nó đang neo `bottom:28px` — đúng chỗ nút Chụp vừa dời xuống (5b.12),
nên mỗi lần đọc xong tem là dải "OCR đọc được N từ khoá" **che mất nút Chụp 6 giây**, đúng lúc thủ kho
muốn chụp lại. Nay `top:calc(14px + env(safe-area-inset-top))`, trượt vào từ trên. Ca test khoá: toast
`top ≤ 40px`, nằm nửa trên màn hình, **không giao** với hình chữ nhật của nút Chụp.

**② Nhặt kho MẪU một lượt — `sync-sku-master.mjs --bu-kho-mau` (4 lượt gọi, chạy TAY).**
Chụp nguyên kho `1441 SAMPLE - 130 AP CHANH - MTG` ra `sku-kho-mau.json`; lượt sync thường **merge**
như file biến thể, nên **cụm hằng ngày vẫn 7 lượt gọi**. Khác file biến thể một điểm: dòng kho mẫu
**giữ TỒN THẬT** (1.814/3.485 dòng có tồn) vì món mẫu nằm đúng trong kho mẫu — đó là chỗ người ta đếm
nó; dòng tồn 0 vẫn tra được nhờ luật *định danh thắng phạm vi* của 5b.12.

Kết quả: danh mục **5.625 → 8.087 SKU** (2.462 dòng mới; **1.023 SKU của kho mẫu đã có sẵn** trong 3 kho
nguyên liệu — phụ liệu để trong phòng mẫu). Quét tem thẻ mẫu giờ ra:

```
#1 422280648  80%  INACTIVE  tồn 0   Quần mẫu FT/SMPA01/87% Nylon, 13% Lycra/None/Grey/None
#2 422430797  80%  INACTIVE  tồn 0   Quần mẫu FT/SMPA01/87% Nylon, 13% Lycra/None/Deep Black/Size S
#3 422494665  25%  ACTIVE    tồn 2   Áo mẫu SizeSet/CWSM0005/…
```

> **PHÁT HIỆN QUAN TRỌNG — "Mẫu SizeSet của SMPA01" KHÔNG TỒN TẠI trong WMS.** Kho mẫu có **95 dòng
> `Quần/Áo Mẫu SizeSet/…`** nhưng mã sản phẩm của chúng là `CWPT0018 · CWJE0001 · CWPA0011 · CWSM0005`…
> Còn `SMPA01` chỉ có **2 dòng, cả hai là "Quần mẫu FT"**. Nên với tấm thẻ *sizeset* thì câu trả lời
> đúng nhất mà dữ liệu cho phép chính là 2 SKU FT cùng mã sản phẩm ở trên — không phải máy đọc sai.
> Cả kho mẫu chỉ có 4 dòng chứa "SMPA": `SMPA0003` (Quần mẫu FT) · `SMPA01` ×2 · `SMPA0002` (Áo mẫu FT).

**Giá phải trả, đo thật:** payload gviz **1.088 → 1.564 KB** (+476 KB, tải 1,0 s trên mạng công ty),
dựng chỉ mục **205 → 304 ms** (Node; trong Edge bóp CPU 4× thì ~2 s nhưng dựng theo lô + nhường luồng
nên trang KHÔNG đứng — xem 3b), đối soát **3–7 → 10–23 ms**. Mẫu sinh mới liên tục nên bản chụp cũ dần:
cần thì chạy lại, đúng 4 lượt gọi.

**③ SỰ CỐ TỰ GÂY RA VÀ ĐÃ VÁ: ghi lên Sheet một danh mục THIẾU 3.820 SKU.**
Lượt sync đầu sau khi có file kho mẫu, log ghi `✓ Mastige · kho nguyên liệu: quét 1000 dòng / 4820`
rồi vẫn ghi bình thường. Gốc: trong vòng phân trang có `const j = await r.json().catch(() => null);
if (!j) break;` — **break KHÔNG log gì**. Một lượt trả về không phải JSON ở trang 2 là dừng êm, và:

* tổng số dòng chỉ tụt **5.625 → 5.411 (−4%)** vì phần bù kho mẫu che mất chỗ hụt,
* nên **cổng chặn ghi rác `kiemTruocKhiGhi`** (bám ngưỡng tụt số dòng) **cho qua**,
* nghĩa là tem của 3.820 SKU nguyên liệu đó đều ra "không tìm thấy" mà không ai biết vì sao.

**Vá:** ① log rõ khi phản hồi không phải JSON; ② mỗi bộ so `seen` với `total` do API trả, thiếu thì
đánh dấu; ③ **thiếu bất kỳ bộ nào thì KHÔNG GHI** — `exit 75` (hoãn) để lượt cụm/watchdog sau chạy lại,
giữ nguyên dữ liệu cũ. Chạy lại ngay sau đó: quét đủ 5.994 dòng → ghi 8.087 SKU.

> **Bài học rộng hơn**: một cổng chặn bám **TỔNG số dòng** sẽ mù khi có hai nguồn cộng vào cùng một tab
> — nguồn này hụt, nguồn kia phình, tổng trông vẫn "bình thường". Cổng phải bám **từng nguồn**, và
> nguồn nào tự biết `total` của nó thì phải đối chiếu bằng chính con số đó.

### 5b.12 Thẻ mẫu SMPA01 → luật "ĐỊNH DANH THẮNG PHẠM VI" + 4 việc gọn giao diện (20/08/2026)

**Ảnh gửi tới không phải tem NCC** mà là **thẻ thông tin mẫu nội bộ** (`THẺ THÔNG TIN MẪU`: Loại mẫu ·
Mã sản phẩm **SMPA01** · Men_Track Pants_Tapper · size XL/L · 87% poly + 13% lycra · Đen). Không có mã
nhà cung cấp nào; dây neo duy nhất là `SMPA01`.

**Tra WMS thì SMPA01 CÓ THẬT** — 2 SKU, và cả hai đều **không có trường `total`** (tồn 0):

| SKU | Tên WMS | Kho | Công ty |
|---|---|---|---|
| 422430797 | Quần mẫu FT/SMPA01/87% Nylon, 13% Lycra/None/Deep Black/Size S | **1441 SAMPLE - 130 AP CHANH - MTG** | 1002 |
| 422280648 | Quần mẫu FT/SMPA01/87% Nylon, 13% Lycra/None/Grey/None | **1441 SAMPLE - 130 AP CHANH - MTG** | 1002 |

> **KHÔNG CÓ kho SAMPLE nào thuộc GARMENT.** Công ty 1005 chỉ có 5 kho — MATERIAL 1339 · SEMI PRODUCT
> 1340 · FINISHED GOODS 1341 · SHOP 1266 · NG 1516 (đã quét, đếm từng kho). Kho mẫu là của **MTG**.
> Cũng không có endpoint danh sách kho (đã thử 4 đường, đều 404) — muốn biết kho nào có gì thì
> `stock-inventories?warehouse_ids=<id>&size=1` rồi đọc `warehouse_name`.

**Hai lớp nguyên nhân, và lớp thứ hai mới là lớp đáng sửa:**

* **Lớp 1 — phạm vi danh mục** (đúng như user đoán): `SKU_MASTER` chỉ quét 3 kho nguyên liệu nên
  `SMPA01` không có trong chỉ mục ⇒ tab đưa 3 dòng chỉ khớp chữ chung `87%`/`13%`/`đen` ở 25–60%.
* **Lớp 2 — xếp hạng**: bơm 2 dòng đó vào danh mục rồi chạy lõi ĐANG DEPLOY thì máy **nhận diện
  đúng** (`diemMot = 0,82`, `coMa = true`, khớp `smpa01` tuyệt đối) nhưng **xếp hạng 344/457** — dưới
  cả dòng 25% không mang mã — và với phạm vi "chỉ ACTIVE" thì **bị loại sạch**. Vì tồn 0 ⇒ INACTIVE,
  mà luật cứng *"ACTIVE đứng trước"* (chốt 19/08) đè lên cả bằng chứng định danh. **Với hàng mẫu thì
  tồn 0 là bình thường** — mẫu may xong nằm đó, không ai nhập tồn.

**Chữa (không tốn thêm một lượt gọi WMS nào — user chốt "hạn chế đè nặng lên WMS"):**

```
laSku → [ACTIVE, chỉ khi hai bên cùng mức "có mã"] → [COMBO → GỘP, cùng điều kiện]
      → SỔ TAY → CÓ MÃ → điểm → độ phủ → đơn vị nhỏ → tồn
```

Đúng cái ngoặc đã dùng cho luật đóng gói ở 5b.9, nay áp thêm cho bậc ACTIVE: **khác mức `coMa` thì
ACTIVE im, CÓ MÃ quyết**; cùng mức thì ACTIVE vẫn quyết (hai dòng cùng mã, cái còn tồn đứng trước) ⇒
**mọi ca tem thường không đổi hành vi**. Kèm ở bước gom nhóm: nhóm không còn dòng sống nào **nhưng có
dòng mang đúng mã tem** thì vẫn được đại diện (thay vì bị `chiActive` loại).

Đo: `#1 422430797 · 82% · INACTIVE` ở CẢ hai phạm vi. Test **65/65** lõi, trong đó 2 ca khoá đúng
đường biên: *nhóm chết hoàn toàn mà chỉ khớp chữ chung → vẫn KHÔNG gợi ý* (ngoại lệ không được nới
thành "cứ chết là cho hiện") và *nhóm chết hoàn toàn mà mang đúng mã → PHẢI hiện*.

> **Ca này KHÔNG kéo kho SAMPLE vào cụm hằng ngày** (3.485 dòng, +4 lượt gọi/ngày, +0,6 MB tải) —
> user chốt giữ tải upstream. Nghĩa là **thẻ mẫu vẫn chưa tra được** cho tới khi có ai nhặt kho SAMPLE
> về một lần; sau khi có luật trên thì chỉ cần một lượt nhặt TAY (4 lượt gọi) là tra được ngay.

**Bốn việc gọn giao diện (cùng yêu cầu):**

| # | Đổi gì | Vì sao |
|---|---|---|
| 1 | Hộp "đang đọc" **chỉ còn đồng hồ giây** (bỏ "AI không đọc được — đang thử OCR của Google (miễn phí)…", "Chưa lập được mã hàng — đang đọc lại bằng OCR…"), quá 12s thì **đổi màu** thay vì thêm chữ | người đứng trước kệ không cần biết máy đang gọi ai, chỉ cần biết đang chạy và đã bao lâu |
| 2 | Nút **Chụp** rời khỏi khung, thành **thanh nổi cố định ở đáy màn hình**, **màu cam** (`#f57c00`), cao 48px, chỉ hiện khi camera bật (`ndsHienChup` — MỘT chỗ duy nhất, gọi từ cả `ndsCam` và `ndsTatCam`) | chụp tem là thao tác một tay, điện thoại cầm thấp; cam cố định vì `--accent` đổi theo 7 theme, có theme trùng luôn màu nút |
| 3 | Bỏ khối `<details>` **"Máy tự chạy thế nào?"** và rút dòng trống ô từ khoá | giảng giải bậc thang là chuyện của người dựng, không phải của người quét tem |
| 4 | **Dòng chân chỉ còn nút** (`⟳ Tải lại danh mục`, `Xoá sổ tay`) — bỏ "Danh mục 5.625 SKU kho nguyên liệu (4.297 ACTIVE/1.328 INACTIVE) · nguồn … · đối soát 7ms · Sổ tay tem: N ghi nhớ …" | trên ĐT nó chiếm 4–5 dòng ngay dưới Top 3; số liệu vẫn nằm trong `NDS.ds`/`NDS.boRac`/`NDS.msDoiSoat` để chẩn đoán và để test đọc |

**Bẫy đã xử:** ① thanh Chụp phải nằm **ngoài mọi view** trong DOM — `.vfade{will-change}` của các view
làm chính nó thành containing block của `position:fixed` (bẫy cũ của `.date-pop`); ② hai thanh nổi
(Chụp + giỏ "Đã chọn N SKU") **đè nhau** nếu không nâng giỏ lên — nay `body.nds-chup #pcbar{bottom:118px}`,
đo được khe 14px trên máy 390px; ③ **bẫy pass oan trong chính ca test**: đọc hộp "đang đọc" SAU khi
`ndsBusy(false)` thì hộp đã bị xoá nên "không còn chữ" luôn đúng — phải đọc TRƯỚC khi tắt.

Đo trên máy 390px: nút Chụp cách đáy **76px**, cao **48px**, giỏ SKU cách đáy 137px, không đè; dòng
chân còn **1 nút, 0 chữ**. Test: **65/65** lõi · **99/99** tab (+3 ca: nút Chụp nổi đúng chỗ/đúng màu/
hiện-ẩn theo camera · dòng chân không còn thông báo · hộp đọc chỉ còn đồng hồ giây).

### 5b.11 Bố cục lại giao diện (yêu cầu user 20/08/2026)

Năm việc, làm cùng một lượt vì chúng cùng một mục đích: **lấy lại chiều dọc trên điện thoại** và cho
mắt bắt được chỗ giống tem nhanh hơn.

| # | Đổi gì | Vì sao |
|---|---|---|
| 1 | Ô **Phần tử trên tem + nút Tra** lên **ngay trên khung camera** (ngay dưới tiêu đề bước 1) | đây là đường không cần camera / không cần mạng / không tốn hạn mức — mở tab phải thấy nó trước, không phải cuộn qua khung + 3 nút |
| 2 | **BỎ HẲN** dải "N gợi ý dưới đây đều mang đúng mã X — chỉ khác nhau ở màu / thông số…" | 3 dòng chữ ngay trên Top 3, trên ĐT là đẩy hẳn thẻ #1 khỏi màn hình, để nói một việc mà 3 thẻ đã nói rõ hơn |
| 3 | Nhãn **"lệch …" rời hàng đầu**, xuống **cùng hàng** với "N từ khoá khớp · N đơn vị khác" | hàng đầu đã có hạng · SKU · tồn · ghi chú · %; thêm nhãn lệch là máy hẹp phải xuống dòng và chừa một dải trống, trong khi dòng thông tin đang trống hẳn nửa phải |
| 4 | Tô trùng khớp bằng **`<span class="highlight-match">`** (`#ffe0b2` / `#e65100`, in đậm) thay `<mark>`, và tô **cả từ khoá đã quét** chứ không chỉ mảnh dòng đó khớp | bộ màu cố định nên không nhạt đi theo token của 7 theme; thủ kho so tem bằng MẮT nên mảnh nào có trên tem mà tên hàng cũng có thì phải sáng lên |
| 5 | Siết khoảng cách (`.nds-marow` 10px→2px, khoảng thở dồn vào `#ndsStage{margin-top:9px}`) | margin cộng dồn hai đầu là thứ đã cắn ở tab Planogram |

**Ba chi tiết dễ làm sai, đã xử:**

* `.nds-more>summary` có mũi tên bằng `::before` — cho `display:flex; justify-content:space-between`
  thì `::before` thành **flex item thứ ba** và space-between **xé mũi tên khỏi chữ**. Nên mũi tên
  chuyển sang `.nds-sumt::before`, summary còn đúng 2 item (chữ trái · nhãn lệch phải).
* Thẻ **không có gì để gấp lại** (không biến thể, không từ khoá khớp) mà vẫn có nhãn lệch: dùng
  `.nds-inline` — cùng một khuôn hàng, để hai kiểu thẻ không lệch nhịp nhau.
* **Nối hai đoạn tô cách nhau đúng một ký tự ngăn** (`_ / -` hoặc khoảng trắng): tên WMS ghép phần tử
  bằng mấy ký tự đó nên `8846295_YKK` bị vẽ thành hai vệt sáng kẹp khe tối, đọc lấm chấm. Chỉ nối khi
  **cả hai bên đã được tô** ⇒ không tô oan chữ nào.

Đo lại sau khi đổi (máy 390px): ô nhập ở `y=149`, khe tới khung **9px**, tràn ngang **0px**, phần tử
đầu tiên của `#ndsCards` là **thẻ #1** với `margin-top: 0` (không còn khoảng trống của dải cảnh báo cũ),
dòng thông tin cao **23px** một hàng. Test: **64/64** lõi · **96/96** tab (+4 ca mới: ô nhập trên khung ·
dải cảnh báo đã bỏ & Top 3 không bị đẩy xuống · đoạn tô là `.highlight-match` đúng bộ màu · nhãn lệch
cùng hàng trên máy 390px). Ca cũ *"Cùng mã nhưng khác màu → mời người chọn"* **đảo cực** thành *"dải đó
đã bỏ"* — chuỗi cũ quay lại là có người khôi phục mà không đọc quyết định này.

### 5b.9 Sự cố C2080 — luật "hàng đóng gói" bị dùng làm luật TOÀN CỤC

**Báo lỗi:** *"ảnh là C2080 mà kết quả SKU gợi ý vẫn theo lần tra cứu trước đó — cả tra bằng ô phần
tử và ảnh luôn"*.

**Tái hiện được ngay** (`c2080` có thật trong danh mục, 3 SKU):

```
Tra "c2080 lavender"  →  Top 3 = 422350083 · 422270001 · 422265791   (50%, KHÔNG mang mã)
                          3 SKU của c2080 nằm ở hạng 29-31 với 100% + coMa=true
```

**Gốc:** cả 3 SKU của mã `c2080` đều bán theo **"Cuộn 5000m"** ⇒ cờ `gop` ⇒ luật *"hàng đóng gói
không được đứng đầu"* — lúc đó là **luật TOÀN CỤC** — đẩy chúng xuống dưới **28 dòng chỉ khớp mỗi chữ
"lavender"**. Nhìn ra kết quả thì y như "vẫn theo lần tra trước", nhưng **không phải state leak**.
Đáng chú ý: code đang xếp **ngược với chính tài liệu của nó** (mục 4.8 ghi `CÓ MÃ` phải đứng *trên*
đóng gói).

**Nhưng không thể chỉ đảo hai luật đó**: đưa `CÓ MÃ` lên trên hẳn thì **SỔ TAY** lại bị một dòng
"tình cờ mang mã" vượt qua — mà sổ tay tồn tại chính để xử mấy tem có **mã NCC không nằm trong tên
SKU** (2 ca test đỏ liền). Ba ràng buộc tạo thành **VÒNG**:

```
đóng gói > sổ tay        (sự cố: sổ tay lỡ học COMBO thì COMBO chiếm hạng 1)
sổ tay   > có mã         (sổ tay là người tự tay xác nhận cho đúng tem đó)
có mã    > đóng gói      (sự cố C2080)
```

**Cách ra khỏi vòng — trả luật đóng gói về đúng phạm vi của nó.** Ý nghĩa thật của nó luôn là *"giữa
hai dòng **của cùng một mặt hàng** thì đừng gợi ý bản cuộn/combo, hãy gợi ý bản đếm được"*. Nó chưa
bao giờ có nghĩa "một cuộn bất kỳ phải xuống dưới một mặt hàng khác hẳn". Nên: **chỉ so đóng gói khi
hai bên CÙNG mức `coMa`**.

| Ca | Hai bên cùng mức "có mã"? | Ai quyết | Kết quả |
|---|---|---|---|
| C2080 (cuộn, có mã) vs dòng 50% không mã | không | **CÓ MÃ** | c2080 lên #1 ✓ |
| Morito COMBO vs NORMAL, cùng mã | có | **đóng gói** | COMBO xuống ✓ |
| Sổ tay lỡ học COMBO của cùng mặt hàng | có | **đóng gói** | COMBO vẫn xuống ✓ |
| Sổ tay chốt SKU không mang mã tem | không | **SỔ TAY** | ghim thắng ✓ |

**Thứ tự chốt:**

```
laSku → ACTIVE → [HÀNG ĐÓNG GÓI, chỉ khi hai bên cùng mức "có mã"] → SỔ TAY → CÓ MÃ
      (bậc đóng gói tách thành COMBO → GỘP từ 20/08/2026, xem 5b.10)
      → điểm → độ phủ → đơn vị nhỏ → tồn
```

Đo đối chứng trên 30 lượt OCR thật: Top-3 **87% → 90%**, **2 lượt tốt hơn · 0 lượt xấu hơn**.
Test: **58/58** lõi (+2 ca khoá sự cố này: *mã mà mọi SKU đều là cuộn vẫn phải lên đầu* và *trong
cùng mặt hàng thì (Combo) vẫn xuống sau NORMAL*).

> **Bài học rút ra rộng hơn**: một luật nghiệp vụ viết dưới dạng "X không bao giờ đứng đầu" gần như
> luôn thiếu phạm vi. Phải hỏi *"không đứng đầu SO VỚI CÁI GÌ"* — ở đây là so với **cùng mặt hàng**,
> không phải so với cả danh mục. Ba luật cứng mà tạo thành vòng là dấu hiệu có một luật đang bị dùng
> ngoài phạm vi của nó.

### 5b.10 Sự cố 20/08/2026 — "tem C2080 mà gợi ý ra SKU combo"

**Báo lỗi:** *"quét tem có C2080 · Tkt 120 · 5000m · Tex 27 mà đề xuất 422266550 — SKU này là combo;
SKU NORMAL của tem là 422304419, sao không đề xuất nó?"*

**Tái hiện được y hệt** (cắt lõi ra Node, chạy trên đúng bản danh mục mà máy đó đang cache —
`nds-master-v1`, chụp 10:28:58 19/08, 5.610 dòng):

```
#1 422266550  98%  NORMAL/ACTIVE  tồn 32  [Cuộn 5000m]
#2 422394068  98%  COMBO /ACTIVE  tồn 12  [Cuộn 5000m]   ← đây mới là bản (Combo)
#3 422395610  93%  NORMAL/ACTIVE  tồn  1  [cuộn 5000m]
```

**HAI việc khác nhau, đừng trộn:**

**① 422266550 KHÔNG phải combo — nó là bản ĐÓNG GÓI.** `product_type` của WMS ghi `Normal`; bản
`(Combo)` của cùng mặt hàng là **422394068**. Cái làm nó *trông* như combo là đơn vị `Cuộn 5000m`
(cờ `gop`). Máy xếp đúng theo dữ liệu nó có.

**② 422304419 KHÔNG NẰM TRONG DANH MỤC — nên không có cách nào gợi ý được.** Tra WMS
(`stock-inventories?...&sku=422304419`, tham số `sku=` có tác dụng, `keyword=` bị bỏ qua):

| SKU | Đơn vị | product_type | Có mặt ở kho | tồn |
|---|---|---|---|---|
| 422266550 | Cuộn 5000m | Normal | **1177 WH-MATERIAL-MTG** (32) · 1178 WH-SEMI PRODUCT (135) | 32 trong phạm vi |
| **422304419** | **mm** | Normal | **CHỈ 1178 WH-SEMI PRODUCT-MTG**, không có `total` | 0 |
| 422394068 | Cuộn 5000m | **Combo** | 1177 (12) · 1178 (154) · office (10) | 12 trong phạm vi |

`sync-sku-master.mjs` chỉ quét **3 kho nguyên liệu** (1177 · 1458 · 1339) để giữ luật *nhẹ tải
upstream* — nên bản `/mm` sống ở kho **bán thành phẩm** bị loại ngay từ đầu. Và nếu có kéo nó vào thì
nó vào với `tồn 0 ⇒ STATUS=INACTIVE`, tức bộ lọc "chỉ gợi ý ACTIVE" lại che nó (nó vẫn hiện ở dòng
*cùng mặt hàng, khác đơn vị* trên thẻ — đã đo).

Quy mô: **1.088/5.053 mặt hàng (21,5%)** trong danh mục hiện tại chỉ còn SKU đơn vị GỘP/COMBO còn
sống ⇒ với chúng, tem quét ra chắc chắn là bản cuộn. Ước lượng ở kho 1178 có **~3.500 dòng phụ liệu,
trong đó ~700 dòng đơn vị nhỏ** (đo bằng 4 trang mẫu/127 trang) — đó là kho biến thể còn thiếu.
Muốn nhặt về thì phải trả **~127 lượt gọi** cho một lượt quét kho 1178 (endpoint KHÔNG nhận lọc theo
category), nên đây là việc **chạy tay/định kỳ dài**, không đưa vào cụm hằng ngày.

**③ LỖ THẬT phát hiện khi đọc lại luật (đã vá).** Bậc "hàng đóng gói" viết là
`(type==='COMBO' || gop)` — **một bậc gộp hai ý niệm**. Khi hai dòng CÙNG là hàng đóng gói thì bậc đó
im hẳn, thứ tự rơi xuống **TỒN**:

```
tồn 422394068 (Combo)  >  tồn 422266550 (Normal)   ⇒  COMBO chiếm hạng 1
```

Hôm nay NORMAL thắng **chỉ vì** phạm vi danh mục chỉ thấy 12 của kho 1177 — tồn thật của bản Combo ở
kho 1178 là **154**. Tức luật *"hạng 1 luôn phải là NORMAL"* đang được giữ bởi may mắn, không phải bởi
luật. **Vá:** tách thành **hai bậc, COMBO trước GỘP** (vẫn nằm trong ngoặc "chỉ so khi hai bên cùng
mức `coMa`" của 5b.9, để định danh vẫn thắng đóng gói):

```
laSku → ACTIVE → [COMBO → GỘP, chỉ khi hai bên cùng mức "có mã"] → SỔ TAY → CÓ MÃ
      → điểm → độ phủ → đơn vị nhỏ → tồn
```

`type==='COMBO'` là **dữ liệu của WMS**, `gop` là **suy ra từ tên đơn vị** — không được để chúng triệt
tiêu nhau. Ca test khoá lại: *"COMBO có TỒN NHIỀU HƠN bản NORMAL (cùng mã, cùng cuộn) → vẫn không được
đứng đầu"* (bơm tồn combo lên +1000 rồi kiểm). Ca cũ *"(Combo) xuống ngay hạng 2"* đổi thành *"xuống
sau MỌI bản NORMAL cùng mang mã"* — vì giờ nó rơi xuống hạng 3. **62/62** lõi · **92/92** tab.

**④ CHỮA GỐC (chốt với user 20/08/2026): nhặt biến thể + cho nó lên #1.**

* `sync-sku-master.mjs --bu-bien-the` — **chạy tay, định kỳ dài**. Quét mọi kho NGOÀI 3 kho nguyên
  liệu (1178 SEMI PRODUCT-MTG 127k · 1151 OFFICE 5,5k · 1441 SAMPLE 3,5k · 1179 FINISHED 3k · 1250
  NG-OFFICE 2,3k · 1307 · 1340 SEMI PRODUCT-GARMENT 2,6k · 1266 · 1516 · 1341), **giữ lại đúng những
  dòng là biến thể đơn vị NHỎ HƠN của mặt hàng ĐÃ có trong danh mục** rồi lưu `sku-bien-the.json`.
  Không ghi Sheet. `khoaHang`/`donVi` **cắt thẳng từ `factory/index.html`** (như 2 bộ test) để không
  bao giờ có hai định nghĩa "cùng mặt hàng / đơn vị nhỏ hơn".
* Lượt sync thường **merge** file đó vào danh mục; SKU nào đã có ở kho nguyên liệu thì giữ bản của kho
  nguyên liệu (file bù chỉ THÊM, không đè). **Cụm hằng ngày vẫn đúng ~7 lượt gọi WMS.**
* Dòng bù vào luôn `INVENTORY_QTY = 0 ⇒ STATUS = INACTIVE` — tồn của nó nằm ở kho khác, ghi số đó vào
  đây là nói dối về kho nguyên liệu.
* Vì thế lõi phải có thêm một luật, nếu không thì bộ lọc "chỉ ACTIVE" lại che đúng cái vừa nhặt về:
  **khi MỌI dòng còn sống của một mặt hàng đều là hàng đóng gói thì bản đơn vị nhỏ (dù tồn 0) lên làm
  đại diện nhóm**; và "còn sống" ở luật cứng ACTIVE tính theo **cả mặt hàng** (`song`), không theo
  riêng dòng đại diện — không thì bản `/mm` tồn 0 bị mọi dòng ACTIVE 50% vượt lên trên.
  Nhóm **chết hoàn toàn** vẫn không được gợi ý (ngoại lệ không nới rộng) — có ca test khoá.
* Thẻ nói rõ vì sao đứng đầu: `đếm theo mm · tồn ở bản Cuộn 5000m` (thẻ vẫn in huy hiệu INACTIVE, nên
  không nói thì thủ kho thấy "tồn 0" rồi bỏ qua đúng SKU cần đếm).

Kết quả đo trên đúng danh mục thật + bơm thêm 422304419: `#1 = 422304419 · 98% · mm · biến thể
422266550 · Cuộn 5000m · ACTIVE 32`. Test: **64/64** lõi (+2 ca: *đại diện là bản /mm tồn 0* và *nhóm
chết hoàn toàn vẫn không gợi ý*) · **93/93** tab (+1 ca ghi chú trên thẻ).

**Không tìm lại được tấm ảnh đã quét — và đó là chủ ý.** `sku_vision` ghi rõ *"KHÔNG lưu ảnh, KHÔNG
ghi ảnh vào Sheet/Drive"*; `sku_ocr` tạo file Drive tạm rồi **DELETE** (không phải vào thùng rác) ở
mọi đường ra. Ba dấu vết còn lại, đều KHÔNG có ảnh:

* `so_chan_cuoi` (Script Property) — chặng + thời gian lượt **OCR** gần nhất. Đọc: `action=sku_ocr` +
  `chuanDoan=1`. Lúc điều tra: `lay-chu · nạp 3755ms · lấy chữ 890ms · tổng 4651ms · 18:22:10`.
* `sv_n_<ngày>` / `so_n_<ngày>` — chỉ là **số đếm** lượt/ngày.
* `nds-so-v1` + `nds-master-v1` trong localStorage của **đúng máy đã quét** — sổ tay (chữ ký tem →
  SKU người chốt) và bản cache danh mục. Đọc được bằng cách copy `Local Storage/leveldb` của profile
  Edge sang một user-data-dir tạm rồi mở bằng puppeteer + chặn request (đừng đọc thô: leveldb nén
  snappy). Lần này sổ tay có 4 mục, **không có mục nào của C2080** ⇒ loại luôn giả thuyết "sổ tay ghim
  SKU sai".

### 5b.8 MỘT LƯỢT QUÉT = MỘT TẤM TEM (sự cố 19/08/2026)

**Báo lỗi:** chụp tem mới nhưng ① từ khoá tem CŨ vẫn còn và vẫn tính điểm (mã `C3968` của lượt
trước), ② ô *"Phần tử trên tem"* + mảng token không được làm sạch, ③ sổ tay trộn token giữa hai lượt
nên gợi ý SKU cũ, và điểm **bị cào bằng** (nhiều dòng cùng 75%).

**Gốc — một chỗ, ba triệu chứng:** `ndsXoaHet()` dọn đủ 6 thứ (`tokens · ket · daBo · rawDaTach ·
maVach · loc` + 2 ô input), còn `ndsDatAnh()` chỉ đặt lại `anh` + `xoay` + `maVach`. **Hai đường dọn
khác nhau cho cùng một việc** — y hệt bài học của `ndsLop()` khi khung xem trước bị "chia đôi".

Riêng dấu hiệu **"cào bằng 75%"** chỉ đúng một chỗ và rất đáng nhớ: `NDS.loc` (mảnh gõ ở ô *Phần tử
trên tem*) còn sót ⇒ `timTop` chuyển sang chấm bằng **ĐỘ PHỦ mảnh** (3/4 = 75%, 2/4 = 50%) chứ không
phải điểm khớp tem ⇒ hàng loạt dòng cùng điểm. Thấy Top 3 cùng một con số chẵn (100/75/50%) thì hỏi
ngay: *ô Phần tử trên tem có còn chữ không?*

Và vì `ndsSoKhoa()` dựng chữ ký tem từ **chính `NDS.tokens`**, token trộn ⇒ **chữ ký trộn** ⇒ sổ tay
tra/ghi nhớ ra SKU của tem cũ. Tức triệu chứng ③ không phải lỗi riêng của sổ tay.

**Chữa:**

* **`ndsLuotMoi()` — một hàm dọn duy nhất**, gọi từ **cả hai** chỗ (đặt ảnh mới · bấm *Xoá hết*).
  Thêm hàm là quên hàm.
* **`NDS.luot` = số thứ tự lượt quét.** Mọi người đọc (AI · OCR · mã vạch · `ndsDoiSoat`) chốt số này
  lúc bắt đầu và kiểm lại **sau mỗi `await`** (`ndsConLuot`): khác số ⇒ kết quả thuộc tấm ảnh cũ ⇒ bỏ,
  **im lặng**. Không có nó thì chụp 2 tem liên tiếp là kết quả tem 1 rơi vào tem 2.
* `ndsLuotMoi()` **abort luôn lượt gọi mạng đang bay** (`NDS.huy`): vừa khỏi tốn hạn mức, vừa nhả cờ
  `dangDoc`. Trước đây `ndsTuDongNhanDien` `return` thẳng khi `dangDoc=true` ⇒ **tem thứ hai không
  được đọc** mà vẫn hiện kết quả tem thứ nhất. Nay chờ cờ nhả (12 nhịp × 60 ms) rồi chạy.
* Có ảnh mới là **xoá ngay thẻ gợi ý cũ**, đừng để nó đứng cạnh ảnh mới trong lúc đang đọc.

**Kèm một việc nữa lộ ra khi đo live:** gõ **một mảnh chung** ("polyester") thì hàng trăm dòng cùng
phủ 1/1 = **100%**, và nhóm đó trước đây xếp tiếp bằng đơn vị/tồn — gần như tuỳ ý. Nay **điểm khớp
tem làm thứ tự phụ**: cùng độ phủ thì dòng khớp thêm nhiều từ khoá của tem hơn đứng trước. Không có
từ khoá tem nào thì điểm khớp = 0 cho tất cả ⇒ thứ tự y như cũ (không đổi hành vi cũ).

**Đo live trên trang thật (2 tem liên tiếp):** tem A `F9-5284` (+ gõ mảnh "polyester") → tem B
`8209948`: từ khoá tem B **sạch bóng** tem A, ô *Phần tử* rỗng, `loc = null`, #1 = `422308806` **85%**
(điểm khớp thật, không phải độ phủ). Test: **+7 ca** trong `qc-tab-nhan-dien.mjs` (**86/86**), gồm ca
*"phản hồi đến muộn của ảnh cũ bị bỏ"* (mock giữ phản hồi 2,5 s rồi chen ảnh mới) và ca *"sổ tay không
ghim SKU tem A sang tem B"*.

> ⚠ **Bẫy trong chính test**: đọc `%` bằng regex trên `textContent` của cả thẻ thì nó ngoạm luôn mã
> SKU 9 chữ số (`142230880697`) rồi ca test **pass oan** vì `142230880697 >= 80`. Phải đọc ở đúng
> phần tử `.nds-pct`.

---

### 5b.21 Sự cố 21/08/2026 — thẻ mẫu CWHO0006: "gợi ý SKU sai hoàn toàn"

Người dùng gửi ảnh thẻ *THẺ THÔNG TIN MẪU* của xưởng và nói thẳng: mã đúng là **422495218**, nhưng tab
trả về **422423807**.

```
Mã sản phẩm   : CWHO0006                                    ← ĐỊNH DANH của món đang cầm (áo mẫu)
Tên sản phẩm  : Women_Hoodie_Full-zip_Anti-UV_Regular
Size          : S
Thành phần vải: Vải Single Mesh/S130413 UZM Sheico/88% Re-Polyester, 12%Spandex/170 Gsm, 152cm
Màu sắc       : Xanh Tro-Dusky Green
```

Tái hiện được **đúng con số user thấy** (danh mục live 8.112 SKU):

```
CŨ  #1 422423807  93%  Vải Single Mesh/S130413 UZM Sheico/…/170 Gsm, 152cm/Xanh Tro-Dusky Green/mm
    #4 422495218  87%  Mẫu thông chuyền/CWHO0006/S130413 UZM/…/170gsm/Regular/Xanh Tro-Dusky Green/Size S
```

**Gốc: thẻ mẫu là BIỂU MẪU, mà lõi đọc nó như một TÚI CHỮ.** Dòng *"Thành phần vải"* là tên **nguyên
liệu dùng để may** cái mẫu đó — nó chép gần như nguyên văn `PRODUCTNAME` của một SKU **vải** có thật.
Đổ cả thẻ vào một túi chữ thì SKU vải khớp 5/6 phần tử và thắng. Ba lỗi tách rời, thẻ này trúng cả ba
(mổ ra bằng bảng điểm từng vai):

| vai | dòng VẢI 422423807 | dòng ĐÚNG 422495218 |
|---|---|---|
| mã (45%) | `s130413`=1 · `cwho0006`=0 → **1,00** | cả hai =1 → **1,00** |
| thông số (25%) | `170gsm`=1 · `152cm`=1 → **1,00** | `170gsm`=1 · `152cm`=0 → **0,75** |
| màu (20%) | 0,83 | 0,83 |
| loại (10%) | 0,66 | 0,66 |

① **Vai MÃ chấm theo mã khớp TỐT NHẤT** (`chiTiet.code = cao`). Luật đó có lý cho tem NCC — tem in
   nhiều mã (mã NCC, mã khách, số PO, số lô) nên khớp **một** cái là định danh xong. Nhưng ở thẻ mẫu
   thì "khớp mã VẢI" ăn điểm y như "khớp cả mã vải lẫn mã áo": mã sau nhãn **Mã sản phẩm** hoàn toàn
   không có tiếng nói. Luật cứng *CÓ MÃ* cũng vô hiệu vì `maKhop` là HỢP của mọi mã ⇒ **cả hai dòng**
   đều được đánh dấu "có mã".

② **Vai THÔNG SỐ phạt ngược dòng đúng.** `152cm` là **khổ vải**, thuộc cuộn vải chứ không thuộc cái
   áo; dòng vải có ghi nên được thưởng, dòng áo không có nên bị trừ — càng ghi đầy đủ về nguyên liệu
   thì máy càng chắc chắn trả về nguyên liệu.

③ **`Size: S` bị đánh rơi ở CẢ HAI PHÍA** nên không bù lại được: `size` nằm trong `TU_BO`, còn `S`
   chỉ 1 ký tự nên bị vòng lọc chữ bỏ. Nghĩa là hôm nay **S/M/L bị đối xử khác XS/XL/2XL** (mấy cỡ
   kia may mắn ≥2 ký tự nên còn sống) — không có lý do gì.

**Chữa — đọc thẻ ĐÚNG NHƯ BIỂU MẪU** (`docTheMau` trong lõi, ngay trên `chuanChuoiTem`):

* **MÃ CHỦ.** Trường có nhãn định danh (`Mã sản phẩm` · `Mã hàng` · `Mã SP` · `Style` · `Item code` …)
  cho ra mã chủ — mã nói món hàng này **là gì**. Khi có mã chủ thì (a) vai MÃ chấm **theo đúng mã đó**
  (`chiTiet.code = caoChu`), và (b) luật cứng *CÓ MÃ* bám **nhúm mã chủ** thay vì hợp của mọi mã. Mã
  vải / mã phụ liệu / số PO in trên cùng tấm thẻ vẫn được chấm như bằng chứng phụ, chỉ mất quyền nói
  "tôi là món hàng này".
* **Cắt CHỮ NHÃN.** Nó là chữ của biểu mẫu, không của món hàng — và nó gây hại thật: nhãn `Màu sắc:`
  cho ra mảnh `sac`, rồi `suaMauTheoDanhMuc` đổi `sac` → **`bac`** (BẠC), tức thẻ tự dựng ra một màu
  không hề có trên tem. Nhãn phải **có dấu hai chấm** mới được nhận (chốt an toàn), và mẫu được dựng
  từ bảng nguyên âm nên khớp cả bản có dấu lẫn bản OCR làm mất dấu.
* **Ghép cỡ có nhãn** (`RE_GHEP_CO`): `Size: S` và `…/Size S` cùng ra một mảnh `szs` ở rổ **thông số**
  — rổ đó có cơ chế xung đột nên tem cỡ S gặp dòng cỡ XL thì bị trừ. Đây là thứ tách 5 biến thể cỡ
  của cùng một mã (CWHO0006 có XS/S/M/L/XL cùng màu Navy).

```
MỚI #1 422495218  93%  ← đúng
    #6 422423807  48%  (coMa=false — không mang mã chủ)
```

**Ba chốt an toàn (đều có ca test khoá):**

* **Danh mục làm chứng.** Mã chủ chỉ được công nhận khi có **đúng nguyên văn** trong `cm.idx`. Đọc
  lệch một ký tự, hoặc thẻ ghi mã chưa có trong danh mục ⇒ `maChu` **rỗng** và lõi chấm y như trước —
  không có đường nào để tự tin sai, và không loại oan mọi ứng viên.
* **Tem NCC thường không đổi hành vi.** Không có nhãn trường ⇒ không có mã chủ ⇒ đi đúng đường cũ.
* **Mảnh cỡ TRẦN được giữ lại** bên cạnh mảnh `szs`: tem NCC in `20-52mm-XS` (không có nhãn Size) vẫn
  phải khớp được với dòng ghi `Size XS` y như trước. Đây là **thêm** mảnh, không lấy đi mảnh cũ.

> ⚠ **Bẫy của tầng giao diện, đắt nhất trong lần vá này.** `ndsDoiSoat` không dùng thẳng kết quả của
> `tuVanBan`: nó vẽ badge, rồi **gom badge lại và xếp vai bằng `tuAI`** (để trang và 2 bộ test dùng
> cùng một cách xếp vai). Bước gom đó **mất ngữ cảnh nhãn**, nên lõi đúng mà trang vẫn trả về cuộn
> vải. Phải đọc lại mã chủ từ ô chữ thô (`NDS_ENGINE.maChuTem`) và **lọc theo badge còn lại** — thủ
> kho bấm × bỏ một mã đọc nhầm thì luật mã chủ tắt theo. Có ca browser khoá riêng đường này.

> ⚠ **Bẫy khi viết script vá file** (không thuộc sản phẩm nhưng đã cắn 2 lần): `String.replace(chuoi,
> chuoiMoi)` hiểu `$&` và `` $' `` trong **chuỗi thay** là tham chiếu — nội dung mới có `')$'` là dán
> luôn cả phần còn lại của file vào. Phải truyền **hàm** trả về chuỗi.

**Đo lại toàn bộ:** `qc-nhan-dien-sku --gviz` **100/100** · `qc-tab-nhan-dien` **155/155** ·
`qc-cham-idf` 8/8 · `qc-tem-vision` **6/6** (gọi AI thật, tem IN) · `qc-tem-tay` **7/7** (gọi AI
thật, thẻ viết tay).

Trên **30 lượt OCR thật** (toàn tem NCC, không có thẻ mẫu nào) thì bản vá này **không đổi gì**:
87%/93% trước và sau — đúng như thiết kế, vì tem NCC không có nhãn trường nên luật mã chủ không bao
giờ bắn. Nó thắng ở đúng lớp **thẻ mẫu** mà bộ đó chưa có mẫu nào; số của lớp đó ở §5b.22.

> ⚠ Đừng đọc số của `qc-loi-cu-moi.mjs` như "trước vs sau" — xem cảnh báo cuối §5b.22.

---

### 5b.22 Chữ VIẾT TAY trên thẻ mẫu (21/08/2026) — đo được gì và còn hở gì

Thẻ mẫu của xưởng: **nhãn in sẵn, giá trị người viết tay**. Mà đúng cái giá trị viết tay đó mới định
danh món hàng. `qc-tem-vision.mjs` chỉ dựng tem IN nên không chạm được khúc này ⇒ thêm
**`qc-tem-tay.mjs`**: dựng 7 "bàn tay" (font viết tay + jitter từng dòng: nghiêng · lệch chân · giãn
chữ), gọi Gemini **y như Apps Script gọi** (cắt `SV_PROMPT`/`SV_SCHEMA` từ `google-script.gs`), rồi
chấm bằng lõi thật. Lượt đọc được **lưu vào `.exports/qc-tay-dem.json`** để `--phat-lai` chấm lại
bằng lõi khác mà không tốn thêm hạn mức AI.

> ⚠ **Font viết tay KHÔNG PHẢI chữ viết tay.** Font đều tay, đúng khoảng, không lệch dòng, không
> nhoè mực, không dính nét, không ai viết chữ "a" hai kiểu trong một dòng. Mọi con số dưới đây là
> **chặn TRÊN lạc quan** — chúng trả lời được *"đường ống sập ở khúc nào"* và *"lõi tự chữa được lỗi
> đọc nào"*, nhưng KHÔNG thay được việc chụp 5-10 tấm thẻ THẬT có người viết rồi đo lại.

**Khúc AI đọc chữ: khá tốt, và quan trọng hơn là ĐỌC ĐÚNG CẤU TRÚC.** `raw_text` giữ nguyên cặp
*nhãn → giá trị* (`Mã sản phẩm: CWH00006 | Tên sản phẩm: … | Size: S`) ở cả 7 bàn tay, kể cả bản
nghiêng + mờ + loá. Đó là điều kiện sống của `docTheMau` — mất cặp nhãn→giá trị là mất luôn mã chủ.

**Nhưng AI đọc LỆCH MÃ ở 4/7 lượt, và cả 4 đều là một lỗi duy nhất: lẫn O ↔ 0.**

| bàn tay | AI đọc mã | lõi chốt |
|---|---|---|
| chữ máy (đối chứng) | `CWHO0006` | `cwho0006` |
| nét rời, mã in hoa | `CWH00006` | `cwho0006` |
| Comic Sans | `CWH00006` | `cwho0006` |
| nét nối (Segoe Script) | `CWHOOOO6` | `cwho0006` |
| thư pháp (Gabriola) | `CWHOoo06` | `cwho0006` |
| viết nhanh | `CWH00006` | `cwho0006` |
| viết nhanh + chụp khó | `CWH00006` | `cwho0006` |

**Bộ chữa cũ KHÔNG đỡ nổi lỗi này.** `ocr()` (O↔0 · I/L↔1 · S↔5 · B↔8 · Z↔2 · G↔6) chỉ được dùng lúc
CHẤM ĐIỂM; còn bước SỬA mã (`suaMaTheoDanhMuc`) chỉ có bậc *"lệch 1 ký tự, CÙNG độ dài"* — vốn là bộ
lỗi của chữ IN. Chữ tay lẫn O/0 ở **nhiều ký tự một lúc** và hay **thiếu/thừa một ký tự** vì viết
dính. Thêm hai bậc, cả hai vẫn giữ luật cũ *"chỉ đổi khi bản sửa CÓ THẬT trong danh mục và chỉ có
DUY NHẤT một ứng viên"*:

* **bậc ②** — chỉ mục `ocrIdx` (dạng chịu lỗi OCR → mã thật), dựng lúc dựng chỉ mục, chỉ cho mảnh ra
  dáng mã: **một lượt tra**, không quét gì. Phủ mọi số lượng ký tự lẫn O/0.
* **bậc ④** — lệch 1 ký tự nhưng **±1 độ dài** (thiếu/thừa, chỉ khi mã dài ≥6).

Đo trên bộ 12 cách đọc lệch (không gọi AI): **3/12 → 10/12** ra đúng SKU. Hai ca còn trượt là
`CVVHO0006` (W viết rời thành VV) và `CWH0OO6` (thiếu 1 + lệch 2) — cách xa ≥2 ký tự, **cố ý không
sửa**: thà không khớp còn hơn khớp sai.

**Một lỗi của chính bản vá hôm nay, do phân tích chữ tay lôi ra.** `locMaChu` bản đầu tra thẳng
`cm.idx[t]` trên chuỗi **THÔ**, trong khi rổ MÃ ở ngay dưới thì đã được `suaMaTheoDanhMuc` chữa. Hậu
quả: thẻ đọc thành `CWH00006` ⇒ lõi **biết** mã đúng nhưng luật mã chủ không bắn ⇒ tụt về đường cũ và
cuộn vải lại chiếm hạng 1 với **94%**. Nay `locMaChu` đi qua đúng bộ chữa đó.

**Công của từng bản vá, đo trên cùng 7 lượt đọc đã lưu:**

| lõi | hạng 1 đúng | ghi chú |
|---|---|---|
| `fb5a47d` (trước hôm nay) | **0/7** | mọi bàn tay đều ra cuộn vải; Top-3 chỉ 2/7 |
| `0764902` (mã chủ + ghép cỡ) | 7/7 | nhưng `maChu` rỗng ở 6/7 và cuộn vải nằm sát ở **93-94%** — thắng bằng tie-break, không bằng bằng chứng |
| cây làm việc (+ bậc ② ④) | **7/7** | cuộn vải rơi khỏi Top 3 (#2 còn 68-73%) — thắng bằng bằng chứng |

**Còn hở gì (rủi ro thật, không phải giả định):**

1. **Ô "Mã sản phẩm" không đọc được** (để trống, chữ quá xấu, lệch ≥2 ký tự) ⇒ mã chủ rỗng ⇒ lõi tụt
   về chấm bằng chữ chung, mà trên thẻ mẫu "chữ chung" phần lớn là dòng **Thành phần vải** ⇒ cuộn vải
   lên hạng 1. Banner cũ **im lặng** vì nó chỉ xét *"có khớp mã nào không"* — mà mã VẢI thì có khớp.
   ⇒ Đã thêm cảnh báo riêng cho đúng ca này (*"Đây là THẺ MẪU nhưng chưa đọc được ô Mã sản phẩm"*),
   kèm nút Nhập mã và lời mời "Ý bạn là…". Có ca browser khoá lại.
2. **`quality` của AI không dùng được làm tín hiệu.** Cả 7 ảnh, kể cả bản nghiêng + mờ + loá, AI đều
   tự đánh giá `"ro"`. Đừng xây luật nào dựa trên trường này.
3. **Prompt chưa biết đến BIỂU MẪU.** `SV_PROMPT` mô tả bài toán là *"tem nhãn của nhà cung cấp"*, có
   một chữ "tem viết tay" nhưng không có một câu nào về *nhãn: giá trị*. Hôm nay Gemini tự giữ được
   cặp nhãn→giá trị nên chưa cần sửa — nhưng đây là chỗ **rẻ nhất** để cải thiện nếu ảnh thật cho kết
   quả kém: dặn nó (a) giữ nguyên cặp *nhãn: giá trị* trong `raw_text`, (b) với ký tự nhập nhằng
   (O/0, 1/7, 5/S) thì ghi thêm phương án hai vào `others`. **Chưa làm** — sửa prompt là phải deploy
   GAS bằng clasp, và không nên đổi mù trước khi có ảnh thật để đo.
4. **Diacritic viết tay chưa đo.** Bộ thử này viết màu bằng "Xanh Tro-Dusky Green" (có phần tiếng
   Anh gánh). Thẻ chỉ ghi tiếng Việt có dấu ("Xanh rêu") thì chưa có số — `boDau` làm dấu thành vô
   hại, nhưng sai CHỮ thì vẫn sai.

> ⚠ **Bẫy đo lường đã dính hôm nay — đừng đọc số của `qc-loi-cu-moi.mjs` như "trước vs sau".** File
> đó cố ý cho hai bên đi **hai đường khác nhau**: bên "cũ" tách chữ bằng `bocTen` trần (hành vi
> trước 19/08), bên "mới" dùng `tuVanBan`. Nó trả lời *"đường tuVanBan có hơn đường cũ không"*, nên
> `--rev` trỏ vào mốc nào cũng ra **80%** — dùng nó để tính công bản vá là **gán sai công** (đã báo
> nhầm một lần trong ngày). Muốn so LÕI thì dùng **`qc-moc-lo-trinh.mjs`** (giữ đường đọc cố định,
> thay lõi theo mốc git). Đo lại bằng file đó trên 30 lượt OCR thật: `fb5a47d` 87/93% → `0764902`
> 87/93% → cây làm việc 87/93%, *"khớp được mã"* 77% → **80%**. Tức bản vá thẻ mẫu **không đổi gì**
> trên bộ tem NCC (đúng như thiết kế — tem NCC không có nhãn trường), và thắng ở đúng lớp thẻ mẫu mà
> bộ đó chưa có mẫu nào.

---

### 5b.23 Hai thẻ cùng 93% (21/08/2026) — luật mã chủ mà chỉ có MỘT đường vào thì quá mong manh

User chụp màn hình và hỏi thẳng: *"sao 2 SKU gợi ý top 1 có 17 từ khoá khớp 93% và top 2 có 16 từ khoá
khớp vẫn 93%? có sai không"*.

```
#1 422495218  93%  Mẫu thông chuyền/CWHO0006/…/Xanh Tro-Dusky Green/Size S      17 từ khoá khớp
#2 422423807  93%  Vải Single Mesh/S130413 UZM Sheico/…/152cm/…/mm              1 đơn vị khác · 16 từ khoá khớp
```

**Hai câu trả lời, và câu thứ hai mới là chuyện đáng làm.**

**① Bằng nhau % mà khác số từ khoá thì KHÔNG phải lỗi làm tròn.** "N từ khoá khớp" chỉ là ĐẾM ĐẦU
mảnh khớp được, còn điểm thì cân theo VAI (mã 45 · thông số 25 · màu 20 · loại 10) và mỗi vai lấy
`(max + trung bình)/2`. Một mảnh mã nặng bằng bốn năm mảnh chữ chung, nên 16 mảnh đặt đúng chỗ ngang
17 mảnh là chuyện bình thường. Đo được: `diem` hai dòng là 0,9301 và 0,9296 — làm tròn ra 93% cả hai,
đúng như nó phải thế.

**② Nhưng dòng VẢI lẽ ra không được có mặt ở 93%.** Dựng lại được đúng bộ số của user (đủ cả *"1 đơn
vị khác"* và *"16 từ khoá"*) khi `raw_text` của AI **CÒN** nhãn `Thành phần vải:` nhưng **MẤT** nhãn
`Mã sản phẩm` ⇒ `maChu` rỗng ⇒ luật mã chủ (§5b.21) im hẳn ⇒ cuộn vải leo lên ngang hàng chỉ bằng chữ
chung. Tức bản vá hôm qua đặt cả sức nặng lên **một** điều kiện: AI phải giữ đúng chữ nhãn — thứ không
ai bảo đảm được, và prompt cũng chưa hề dặn.

**Chữa: cho luật mã chủ HAI ĐƯỜNG VÀO, khác lối mà cùng kết luận.**

| đường | dấu hiệu | suy ra |
|---|---|---|
| ① khẳng định | có nhãn `Mã sản phẩm` / `Mã hàng` / `Style` | mã trong ô đó **LÀ** định danh |
| ② loại trừ | có nhãn `Thành phần vải` / `Nguyên phụ liệu` / `Chất liệu` | mã trong ô đó là mã **VẬT LIỆU** ⇒ mã nào **ngoài** ô đó mới có quyền định danh |

Đường ② không cần nhãn định danh còn sống. Ca của user: rổ mã = `[cwho0006, s130413]`, mã liệu =
`[s130413]` ⇒ mã chủ = `[cwho0006]`. Xong.

Kèm hai việc nhỏ nhưng cần:

* **Nhãn ĐỊNH DANH không còn đòi dấu hai chấm.** AI nối dòng bằng `" | "` và có lượt nó bỏ luôn dấu
  hai chấm (`Mã sản phẩm CWHO0006`). Dám nới vì giá trị vẫn phải qua `locMaChu` — chỉ nhận mã có ĐÚNG
  NGUYÊN VĂN trong danh mục — nên một lần khớp nhãn oan chỉ cho ra `maChu` **rỗng**, không đổi gì.
  Nhãn nguyên liệu và nhãn chỉ-để-cắt thì VẪN đòi dấu hai chấm (cắt chữ thật là mất luôn bằng chứng).
* **Ô định danh chỉ lấy MÃ ĐẦU TIÊN.** Hệ quả của việc nới trên: khi cả thẻ nằm một dòng và nhãn sau
  cũng mất dấu hai chấm thì "giá trị" chạy tới hết dòng, nuốt luôn mã vải ở ô kế — đo được `maChu` ra
  `[cwho0006, s130413]` và cuộn vải lại chiếm hạng 1 (91%). Ô nguyên liệu thì KHÔNG giới hạn: ở đó
  càng nhận được nhiều mã liệu càng loại trừ tốt.

**Bốn kiểu mất nhãn, đo bằng cùng một tấm thẻ:**

| raw_text của AI | trước | sau |
|---|---|---|
| còn đủ nhãn | ✓ áo mẫu 93% | ✓ áo mẫu 93% |
| **mất nhãn mã, còn nhãn thành phần** (ca của user) | ✗ vải 93% ngang hàng | ✓ áo mẫu 93%, vải rơi khỏi Top 3 |
| nhãn còn nhưng mất dấu hai chấm | ✗ vải 91% hạng 1 | ✓ áo mẫu 90% |
| **mất SẠCH nhãn** (AI dẹp phẳng) | ✗ vải 97% | ✗ vải 98% — *không chữa được, nhưng có cảnh báo* |

Ca cuối là giới hạn thật: không còn nhãn nào thì không có cách nào biết mã nào định danh. Nhưng
`laTheMau` vẫn bật (nhờ tiêu đề *THẺ THÔNG TIN MẪU*), nên banner *"Đây là THẺ MẪU nhưng chưa đọc được
ô Mã sản phẩm"* nổ — thà nói "tôi không biết" còn hơn im lặng đưa cuộn vải ở 98%.

Tem NCC thường: `laTheMau = false`, `maChu` rỗng, **không đổi một hành vi nào** (có ca test khoá).

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
**bấm cả thẻ = xác nhận SKU**).

* **Bấm thẻ** (hoặc Enter/Space khi thẻ đang được chọn) làm đúng hai việc, **không** liên quan tới
  lệnh kiểm kê nữa (xem hộp đổi phạm vi ở đầu tài liệu): **copy mã SKU** vào clipboard để dán sang
  WMS / phiếu tay, và **ghi sổ tay tem** để lần sau khỏi gọi AI. Nút biến thể trong dòng "Cùng mặt
  hàng, khác đơn vị" đi **cùng một đường**, chỉ khác là xác nhận đúng SKU của nút đó.
* Muốn đưa SKU vào lệnh kiểm kê thì tick ở pop-up của tab **Kiểm kê** hoặc **Tồn kho bất thường** —
  đó là 2 chỗ duy nhất còn giữ đường `pcAdd → #pcbar → Tạo lệnh kiểm kê`.
* Rời tab thì **tắt camera** (không để đèn camera sáng, đỡ hao pin).
* Bỏ một từ khoá thì nó **không sống lại** từ ô "dán chữ trên tem" (ô raw chỉ được tách lại khi nội
  dung ĐỔI; từ khoá đã bỏ được ghi nhớ cho tới khi đọc ảnh mới).
* Danh mục cache `localStorage` 12h → mở tab lần sau tức thì, mất mạng vẫn đối soát được.

---

## 8. Kiểm thử

| Lệnh | Kiểm gì | Kết quả 18/08/2026 |
|---|---|---|
| `node qc-nhan-dien-sku.mjs [--gviz] [--chi-tiet]` | lõi đối soát trên 5.610 SKU thật: 18 dạng đoạn ĐƠN VỊ, khoá gom mặt hàng, 3 quy cách tem, OCR sai nhẹ, SKU in trên tem, cùng mã khác màu, tem mờ, từ khoá rác, **ưu tiên đơn vị nhỏ nhất** (+ bất biến: không biến thể nào nhỏ hơn đại diện), **chữ ký + ghim sổ tay**, **6 ca chữ thô/OCR** (mã dài nhiều đoạn · chi số ghi liền · cỡ dán liền số đo · số đo không chiếm rổ mã · AI gán vai sai · số dài không khớp mã ngắn), **gõ mảnh chung thì xếp tiếp bằng điểm khớp** | **56/56** · 8-10ms/lượt (19/08) |
| `node qc-tem-vision.mjs [--giu-anh]` | **đầu-cuối**: dựng 6 ảnh tem (3 quy cách × sạch/khó: nghiêng 7° + mờ + loá nylon + vết bẩn) → Gemini thật → engine, **ghép vai AI + chữ thô y như dashboard** | **6/6 ra đúng SKU** |
| `node qc-in-tem.mjs` | lõi in tem (khối `PR-TEM`): bảng mẫu vạch Code 128 đối chiếu bản gốc từng bit · checksum tính lại bằng công thức · giải mã ngược chuỗi vạch · SVG (số vạch · bề rộng · crispEdges · vừa khổ tem) · 3 mẫu tem (khổ · escape tên hàng · cắt tên dài) · tổng số tem / gom theo khổ | **50/50** (20/08) |
| `node qc-tab-nhan-dien.mjs [--anh]` | tab trong Edge headless: nạp gviz, badge, thẻ, tô trùng khớp, giỏ kiểm kê, **badge ACTIVE/INACTIVE + chip ĐVT**, **thẻ đơn vị nhỏ nhất + nút biến thể**, ACTIVE/Tất cả, AI lỗi, mất mạng, ảnh không đọc được, cache offline, **thứ tự bước mới**, **sổ tay học 1 lần ra ngay 0 lượt gọi AI**, **mã vạch (API giả)**, **không hỏi email**, **tự chạy khi có ảnh**, **thẻ gọn (không badge thừa · Tồn kèm ĐVT · details Vì sao khớp)**, **kết quả song song với ảnh**, bố cục điện thoại, tắt camera, lỗi JS, **bậc thang AI↔OCR** (AI ra mã thì 0 lượt OCR · không lập được mã thì tụt xuống OCR · AI hết hạn mức thì OCR cứu · cả hai hỏng thì nói 1 lần · bỏ mảnh giấy tờ · cảnh báo cùng mã khác màu · đồng hồ giây), **ẢNH MỚI = LƯỢT MỚI** (từ khoá/ô Phần tử/chữ trên tem/mã vạch đều sạch · phản hồi đến muộn của ảnh cũ bị bỏ · sổ tay không ghim SKU tem cũ)  · **PHẠM VI GIỎ** (bấm thẻ không vào giỏ · thanh giỏ chỉ hiện ở tab Kiểm kê + Tồn kho bất thường · `pcAdd` bị chặn ngoài phạm vi) | **122/122** (20/08) |
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

---

## 11. IN TEM SKU — bước 1 (20/08/2026)

Nhu cầu: nhận diện xong thì chọn một hoặc nhiều SKU vào **danh sách chờ in**, ở đó chọn **mẫu tem**
và **số lượng tem** cho từng SKU, rồi xác nhận in.

### 11.1 Chống nhấn nhầm — hai yêu cầu chốt của người dùng

| Yêu cầu | Làm thế nào |
|---|---|
| "Chọn SKU để in phải là do NGƯỜI chọn, tránh nhấn nhầm cũng tự thêm vào danh sách in" | Đường **duy nhất** thêm tem là nút **`＋ Tem`** trên thẻ (`prTick`). Bấm vào **cả thẻ** (vốn là một nút lớn chiếm cả ô) vẫn chỉ làm việc cũ: copy mã + ghi sổ tay. Nút có `stopPropagation` nên bấm nút không kích luôn thẻ cha. Lượt nhận diện mới **không** tự thêm gì. |
| "Vào danh sách in rồi vẫn xoá / bỏ chọn được" | Ba đường bỏ: bấm lại nút (`✓ Tem` → bỏ), nút **✕** từng dòng trong bảng, và **Xoá hết**. |

Nghĩa là chạm lệch tay thì tệ nhất là **copy lại cái mã** — không sinh ra con tem nào để in. Giấy tem
là vật tư thật, nên hành động "sinh ra tem" phải là một cú bấm có địa chỉ.

### 11.2 Danh sách chờ in là giỏ RIÊNG, không dùng chung với giỏ kiểm kê

`PR.sel` (khoá theo **SKU**, mang thêm `mau` + `sl`, lưu ở `sessionStorage['pr-tem-v1']`) tách hẳn
với `PC.sel` của lệnh kiểm kê. Ba lý do, không phải chuyện cho gọn:

* **khoá khác**: giỏ kiểm kê khoá `kho|SKU`; giỏ in khoá theo SKU và cần thêm mẫu tem + số lượng;
* **phạm vi khác**: thanh chờ in chỉ hiện ở tab Nhận diện SKU, còn giỏ kiểm kê thì **không được**
  xuất hiện ở tab đó (xem mục 3 về `PC_TAB`);
* **hậu quả khác**: tick sai vào lệnh kiểm kê thì sửa được, in sai là mất tem thật — nên luồng in có
  xem trước + xác nhận số lượng, luồng kiểm kê thì không cần.

Giới hạn: **200 SKU** một danh sách · **200 tem** mỗi SKU · **2.000 tem** một lượt in. Trên 30 tem thì
hỏi lại một câu trước khi mở hộp thoại in.

### 11.3 Bốn mẫu tem — đều là khổ giấy THẬT của kho

Số liệu đọc ngày 20/08/2026 bằng `hasaki/_DOC-MAY-IN.ps1` chạy trên **`DESKTOP-JE75K38`** (172.16.0.113)
— máy cắm cả hai máy in tem của kho qua USB:

| Mã mẫu | Khổ | Nguồn (form BarTender · sửa lần cuối) | Máy in |
|---|---|---|---|
| **`t42x62`** (mặc định) | **42,5 × 62 mm** | `Desktop\sku.btw` · `SKU_SAMPLE.btw` — **20/08/2026** | TSC PE200 (USB031) |
| `t46x76` | 46 × 76 mm | `Downloads\adult_us_noprice_backup10.btw` — 18/08/2026 | TSC PE200 |
| `t42x25` | 42 × 25 mm | `Desktop\Barcode.btw` — 18/08/2026 | Zebra ZT230 (USB033) |
| `t22x13` | 21,6 × 12,7 mm | `Desktop\barcodetem4.btw` — 22/01/2026 | TSC PE200 |

Ba khổ dựng lúc đầu (50×30 · 70×40 · 40×20) **đã bỏ** — không khổ nào có giấy thật; đó là số tôi tự
nghĩ khi chưa đọc được máy in. Bộ test `qc-in-tem.mjs` khoá cả bốn khổ lại (mục 7) nên sau này ai đổi
khổ thì buộc phải đổi cùng lúc ở cả hai chỗ.

Bố cục tem SKU dựng theo đúng form đang dùng (bóc từ `sku.btw`: `Box 1` · `Barcode 1` · `Barcode 2` ·
`Text 1` · `Picture`, font Arial/Tahoma): tem **dọc**, khung viền mảnh, mã SKU cỡ lớn trên cùng, mã
vạch ở giữa, tên hàng nhiều dòng, ĐVT + ngày in ở chân.

Mỗi con tem in ra **đúng một trang** khổ đó (`break-after:page`) — đó là cách máy in nhãn hiểu "một
con tem". Một lượt in chỉ nhận **một khổ**: `@page` chỉ đặt được một cỡ giấy, nên trộn 2 khổ trong
một lượt là ra sai giấy — gặp thì chặn và nói rõ, có nút *"Áp mẫu tem cho tất cả"* để gộp về một khổ.

**Bẫy cần biết khi in qua hộp thoại Windows**: driver của `TSC PE200 (Copy 1)` trên máy đó đang set
khổ giấy **83,8 × 63,5 mm** (dpi 203×203), lệch với 42,5 × 62 của form — BarTender tự ghi đè khổ khi
in, còn `window.print()` thì không, nên phải chọn đúng khổ trong hộp thoại.

### 11.4 Mã vạch: Code 128B, tự vẽ, và cách canh cho khỏi sai im lặng

Đúng loại mà form của kho đang dùng — bóc từ `sku.btw` thấy kiểu `Code128` (dù tên form là
`SKU-UPC-A-Them-2-so-00`, chữ "UPC-A" chỉ là tên cũ để lại). Chọn 128B vì mã SKU của kho là dãy 9 chữ số: mã hoá gọn (11 module/ký tự → **34,8 mm** cho SKU 9 số,
vừa khổ 50 mm), và mọi máy quét cầm tay đều đọc. Vẽ bằng `<rect>` SVG thuần — không CDN (lệ dự án),
không canvas (in ra bị nhoè, máy quét kém đọc), có `shape-rendering="crispEdges"`.

Mã vạch sai là loại lỗi **im lặng** tệ nhất: tem trông đẹp, dán hết cuộn, tới lúc quét mới biết. Nên
`hasaki/qc-in-tem.mjs` canh ba lớp:

* bảng mẫu vạch trong trang được **đối chiếu từng bit** với bản gốc lưu ở `.code128-doi-chung.json`
  (lấy từ JsBarcode) — 95 ký tự in được + START_B + STOP;
* **checksum tính lại bằng công thức** `(104 + Σ vị_trí × giá_trị) mod 103`, không gọi hàm của trang;
* **giải mã ngược**: đọc lại chuỗi vạch bằng bảng gốc rồi so với chuỗi ban đầu — kèm ca "đổi 1 module
  thì phải KHÔNG đọc ra chuỗi cũ" để chứng minh phép kiểm có hiệu lực.

Bên cạnh mã vạch, tem luôn in **mã SKU dạng chữ số cỡ lớn**: quét lỗi thì còn gõ tay được.

> Ba lớp test trên **không thay được** việc quét thử một con tem bằng máy quét thật trước khi in loạt.

### 11.5 Chọn máy in: đang là hộp thoại của Windows

Bấm **In** thì trang dựng đúng số con tem vào `#prsheet`, đặt `@page` theo khổ mẫu, rồi gọi
`window.print()` — **danh sách máy in do Windows hiện**, người dùng chọn ở đó.

Hiển thị danh sách máy in + trạng thái sẵn sàng **ngay trong trang** là **bước 2**, chưa làm, vì
trình duyệt không có API nào cho việc đó. Đã đo (20/08/2026):

| Đường | Kết quả đo |
|---|---|
| trang HTTPS gọi thẳng `http://127.0.0.1` (agent ở máy) | Edge có cửa sổ thật: **được** (~900 ms/lượt); Edge headless: **bị chặn** (Private Network Access) |
| **extension làm cầu nối** (đã có `wms-bridge`) | **được** — 921 ms, đọc đúng 3 máy in kèm trạng thái + số job |
| WebUSB / WebSerial / WebBluetooth | API có mặt, nhưng phải bấm chọn thiết bị mỗi lần và trên Windows máy in đã có driver thì WebUSB không claim được |

Và cái mà Windows **không** biết: hết giấy / hết ribbon / đầu in mở của máy in nhãn thường không lên
tới hệ điều hành (`Get-Printer.PrinterStatus` trả `Normal` cho cả máy đang rút dây; chỉ
`Win32_Printer.WorkOffline` bắt được). Muốn biết thật thì phải hỏi chính máy in bằng TSPL/ZPL.

### 11.6 Dọn sau khi in

`#prsheet` được xoá sạch khi `afterprint` bắn, kèm một lượt dọn chậm 60 giây làm lưới an toàn: giữ
khung in đầy tem thì lần **in trang khác** (vd bảng kiểm kê) cũng ra tem.

---

## 12. IN TỨC THÌ — hàng đợi + agent (20/08/2026)

Kịch bản chốt: trên dashboard chọn SKU → số tem → số lượng → bấm **Xác nhận in** → máy in tem của kho
nhả tem ngay. Không mở BarTender, không hộp thoại in, **không ai phải ngồi trước máy in**.

### 12.1 Vì sao phải có hàng đợi

Máy in TSC PE200 cắm USB vào `DESKTOP-JE75K38`, còn người bấm đứng ngoài kho với cái điện thoại. Đo
20/08/2026: web thuần **không** liệt kê nổi máy in, `http://127.0.0.1` bị Private Network Access chặn,
Android/iOS **không hiểu** máy in share kiểu Windows. Nên đường duy nhất không phải xin IT là để **cả
hai đầu chỉ gọi RA NGOÀI**:

```
điện thoại/PC ──(pr_them)──► tab IN-TEM-CHO ◄──(pr_lay / pr_xong)── agent máy trạm ──► TSC PE200
```

4G cũng chạy, không cần cùng mạng, không mở cổng nào.

### 12.2 Bốn action GAS + tab `IN-TEM-CHO`

| Action | Ai gọi | Khoá |
|---|---|---|
| `pr_them` | dashboard gửi lệnh in | **public** (người bấm không có SECRET) — tự chặn bằng trần 40 SKU / 400 tem + chống gửi trùng 5 giây |
| `pr_lay` | agent lấy lệnh đang chờ, đánh dấu `dang_in` ngay | SECRET |
| `pr_xong` | agent báo `xong` / `loi` + lý do | SECRET |
| `pr_trangthai` | dashboard hỏi lại lệnh của mình | public, chỉ trả đúng dòng theo id |

Tab: `id · luc_gui · nguoi · trang_thai · so_tem · json_dong · luc_nhan · luc_xong · ghi_chu`,
trạng thái `cho → dang_in → xong | loi`, tự dọn lệnh cũ hơn 7 ngày.

### 12.3 Agent

`node in-tem-agent.mjs --dich-vu` — hoặc bấm `_AGENT-IN-TEM.bat` (có cửa sổ) / `_AGENT-IN-TEM-AN.vbs`
(chạy ẩn, dùng khi cho vào Task Scheduler lúc đăng nhập).

Ba thứ đã tính trước vì cả ba từng xảy ra thật: GAS trả HTML thay vì JSON (đọc thô rồi thử lại) ·
máy in chết giữa đợt (tự nối lại queue 3 lượt, hết lượt thì báo `loi` kèm nguyên văn) · nhiều người
cùng gửi (GAS trả cờ `nhieuNguoi`, agent in kèm **tem thông báo đợt**: ai gửi · lúc nào · bao nhiêu
tem — in một mình thì không tốn thêm tem nào).

Dashboard theo dõi 20 lượt × 3 giây rồi nói thẳng: *đang in* → *đã in xong* → hoặc *máy in báo lỗi*.
Gửi hàng đợi thất bại thì rơi về **đường lùi**: mở hộp thoại in của Windows như trước.

### 12.4 Bẫy đã cắn khi deploy GAS — và cách chặn

`google-script.gs` là bản **git-safe**: `SECRET`, `SYNC_PIN`, `SYNC_PIN_DATA` để placeholder. Bản chạy
thật là `.clasp-deploy/sa.js` (đã .gitignore). Tôi `cp` thẳng nguồn → `sa.js` rồi push: **mọi endpoint
đòi SECRET lập tức "Sai key"**, hai PIN của form 5S cũng mất. Khôi phục bằng
`clasp pull --versionNumber 69` (bản deploy cũ vẫn còn trên server).

Từ nay dùng **`node deploy-gas.mjs --deploy <mota>`**: sinh `sa.js` từ nguồn + chèn bí mật từ `.env`,
dừng hẳn nếu thiếu bất kỳ bí mật nào hoặc còn placeholder, push rồi deploy vào **đúng deployment đang
dùng** nên URL không đổi. Hai bẫy nhỏ của clasp trên Windows cũng đã vá trong script: `npx.cmd` không
spawn được bằng `execFileSync` (EINVAL), và mô tả nhiều từ bị cắt thành nhiều tham số.

### 12.5 "Sao lâu vậy" — mổ xẻ độ trễ và cắt (20/08/2026, chiều)

Người dùng bấm **Xác nhận in** rồi chỉ thấy *"Đang chờ máy in…"*. Hai chuyện khác nhau, và chuyện thứ
nhất nặng hơn nhiều:

**① Agent chưa bật → chờ vô hạn.** Lệnh nằm ở `trang_thai: cho`, `agentTre: -1` (chưa hề có ai hỏi
hàng đợi). Không có lỗi nào để đọc, tem thì không bao giờ ra. Đây mới là nguyên nhân thật của lần
phàn nàn đó — không phải chậm, mà là **không chạy**.
Chữa: task Windows **"Factory agent in tem"** — chạy lúc đăng nhập **và** tự kiểm mỗi 5 phút
(`wscript _AGENT-IN-TEM-AN.vbs`, `MultipleInstances = IgnoreNew`). Bản `.vbs` tự hỏi WMI xem đã có
`node …in-tem-agent` chưa: có thì thoát ngay, nên nhịp 5 phút là **watchdog** chứ không sinh ra agent
thứ hai (hai agent cùng nhặt lệnh = tem in đôi). Đã thử cả hai chiều: đang chạy → vẫn 1 tiến trình;
bị `Stop-Process` → 5 giây sau sống lại.
Agent chạy ẩn nên không còn cửa sổ để đọc → thêm sổ log `hasaki/.in-tem-agent.log` (tự cắt còn 200KB).

**② Độ trễ thật: đo trước, sửa sau.** Số đo (trung vị, 3 lượt):

| chặng | trước | sau | ghi chú |
|---|---|---|---|
| `pr_them` (gửi hàng đợi) | ~2,5–3,5s | **1,4–2,2s** | bỏ mở Sheet |
| agent nhặt được lệnh | tới 6,5s | **~2–3s** | nhịp 3s→1s, lượt hỏi rỗng rẻ hẳn |
| tra tên sản phẩm | 0,5–1,1s/SKU | **0ms** | dashboard gửi kèm tên |
| dựng ảnh tem | ~0,85s | **20–50ms** | danh mục giữ trong bộ nhớ |
| gửi máy in | 2–22s | **2,3–3,9s** | 1 job/lệnh + dọn job kẹt + hâm nóng |
| **bấm → tem ra khỏi máy in** | **~28,7s** | **~6–9s** | |

Bốn chỗ cắt được, và **vì sao** nó chậm:

- **Hàng đợi sống rời Sheet, sang Script Properties.** Mỗi lượt gọi Apps Script đã mất ~1,1s trần
  (chuỗi chuyển hướng của Google — không cắt được), và `SpreadsheetApp.openById` cộng thêm 1,1–2,4s
  cho **mọi** lượt, kể cả lượt agent hỏi lúc hàng đợi trống. Đo được: `pr_lay` 3,5s · `pr_trangthai`
  2,2s. Properties đọc/ghi ~50ms và **không bị đuổi** như CacheService (mất một lệnh in = tem không
  bao giờ ra mà không ai biết). Tab `IN-TEM-CHO` **vẫn còn** nhưng hạ xuống làm **sổ lưu**: ghi lúc
  agent rảnh, ngoài đường găng — vẫn đối chiếu được ai in bao nhiêu tem.
- **Tên sản phẩm gửi kèm lệnh.** `.sku-master-dry.json` chỉ có 5.610 dòng nên SKU vắng mặt phải hỏi
  gviz 0,5–1,1s. Mà dashboard đang hiện tên đó ngay trong pop-up → gửi luôn. Được thêm một cái đúng
  hơn: tem in ra mang **tên người dùng đã thấy lúc bấm**, không phải tên đọc lại từ Sheet lúc khác.
- **Một lệnh = một job spooler.** Trước đó mỗi hàng giấy một lần gọi `powershell.exe` (190ms/lần chỉ
  để mở tiến trình, 20 tem = 10 lần), lại thêm nguy cơ đợt của người khác chen vào giữa.
- **Hâm nóng + ghim tên máy in.** Lượt gửi đầu sau khi agent khởi động mất 7,9s, lượt sau 2,3s — giá
  của việc mở kết nối tới spooler máy bên kia. Trả nó ngay lúc khởi động (lệnh `SIZE`+`CLS`, **không**
  có `PRINT` nên không con tem nào ra), rồi ghim luôn tên máy in đọc được để khỏi `Get-Printer`
  (~0,47s) mỗi lượt.

Dashboard cũng đổi: hỏi trạng thái **700ms** một lượt trong 12 giây đầu rồi giãn ra 2,5s, và **đếm
giây** trong dòng trạng thái. Một dòng chữ đứng im chính là thứ làm người ta tưởng máy treo.

### 12.6 Bốn bẫy phải nhớ, cả bốn đều đã cắn trong một buổi chiều

1. **Dọn hàng đợi SAU khi thêm id mới → mất lệnh.** `prDonNhanh_` phán xét từng id bằng ảnh chụp
   `getProperties()` lấy lúc đầu hàm; id vừa `push` chưa có property trong ảnh đó nên bị coi là **mồ
   côi và gạch ngay**. Triệu chứng khó lần nhất: `pr_trangthai` vẫn thấy lệnh (`PRQ_<id>` có thật) mà
   `PR_IDS` không có nó, nên agent quét mãi không ra việc — **không lỗi, không tem**. Thứ tự đúng:
   dọn trước, thêm sau. Kèm một vòng quét property mồ côi (chỉ xoá cái đã quá 15 phút).
2. **Job kẹt trong queue làm mọi lượt gửi sau đội lên 22s.** Một job `Spooling` size 0 nằm lại là đủ.
   Agent giờ tự dọn job già hơn 2 phút (một con tem in xong trong ~2 giây, nên job 2 phút chắc chắn
   đã chết) — dọn khi gửi lỗi, và cả khi gửi **được** mà chậm bất thường (>8s).
3. **Bộ test in tem THẬT.** Ca test cũ gọi `prIn()` rồi chỉ chặn `window.print`; từ lúc "Xác nhận in"
   đổi thành gửi hàng đợi thì mỗi lần chạy test là một đợt tem thật ra khỏi máy in (2 con của
   `may-…@hasaki.vn` nằm trong khay mà không ai gọi in). Nay ca test thay `prGoiGas` bằng bản ghi lại
   lời gọi — kiểm được đúng thứ gửi đi mà không tốn tem; thêm một ca khoá luôn hành vi "hàng đợi hỏng
   thì **không** tự mở hộp thoại in, chỉ hiện nút *In bằng máy này*".
   Đo tốc độ cũng vậy: `node do-toc-do-in.mjs` mặc định **chế độ đo** (`thu:1` → agent dựng đủ tem rồi
   bỏ, không gửi máy in); muốn in thật phải gõ thêm `--in-that`.
4. **Deploy xong, phiên bản cũ còn sống vài giây.** Ngay sau `clasp deploy`, lượt gọi đầu vẫn chạy mã
   cũ (Apps Script giữ instance đang nóng) — lượt đo đầu tiên vì thế vẫn in ra một con tem thật dù đã
   bật chế độ đo. Sau khi deploy: chờ ~10 giây rồi hãy tin phiên bản mới.

Thêm một chỗ nữa: **nhịp tim agent đọc bị lệch**. `getProperties()` có lúc trả về rỗng dù agent vừa
gọi cách đó một giây, và dashboard sẽ báo oan *"máy trạm đang tắt agent"* — một báo động sai kiểu đó
đắt hơn nhiều một dòng ghi thêm, vì lần sau người dùng sẽ không tin dòng trạng thái nữa. Nay nhịp tim
ghi vào **cả Cache và Property**, đọc lấy cái tươi hơn: đo lại được 0,5–1,5s ổn định.

### 12.7 Bốn điều từ ảnh chụp máy thật (20/08/2026, 16:59)

Ảnh pop-up **In tem SKU** trên điện thoại, cùng bốn yêu cầu của người dùng. Ba trong bốn điều là lỗi
của bố cục, không phải của đường in.

**① Dấu chấm ngăn cách khi GÕ.** Đã có sẵn (`prGoSo` + `prSoCham`, chấm ngay từ hàng nghìn và giữ chỗ
con trỏ) — ảnh chụp bản live cũ nên chưa thấy. Nhưng khi làm mục ③ thì phát hiện `prSoCham` gộp cả dấu
phẩy vào con số: `"12, 14"` biến thành `"1.214"`. Nay chấm **từng số** trong ô: dấu chấm thuộc về con
số (hàng nghìn), dấu phẩy / khoảng trắng là ngăn cách danh sách nên giữ nguyên chỗ người gõ.

**② Bấm Xác nhận in là IN, không nhảy thêm bước lưu / chọn máy in.** Dòng chữ trong ảnh — *"Bấm In sẽ
mở hộp thoại in của Windows"* — là của bản trước hàng đợi; nay chỗ đó là **dòng trạng thái** và nói
đúng tình hình: máy in đang rảnh · đang chạy đợt của ai · máy trạm tắt agent · máy in báo lỗi (kèm
nguyên văn). Hộp thoại in của Windows **không còn tự mở**: gửi hàng đợi thất bại thì chỉ hiện thêm nút
*In bằng máy này* để người dùng chủ động chọn — có một ca test khoá đúng hành vi đó, vì "tự nhảy ra hộp
thoại" chính là chỗ người dùng phản ứng mạnh nhất (`!!!!!`).

**③ Cùng một SKU, nhiều bịch khác số lượng.** SKU A có 3 bịch 12 · 14 · 16 → phải ra **3 con tem cùng
SKU khác số lượng**; trước đây chỉ in được N con tem giống nhau. Cách gõ: ô **Số lượng** nhận danh
sách — `12, 14, 16`. Khi đó ô **Số tem** tự khoá và hiện đúng `3` (số tem do danh sách quyết định; để
người dùng sửa tay thì sinh ra hai con số chỏi nhau).
Việc "nở" một dòng thành từng con tem đặt ở **lõi `PR_TEM`** (`tachSl` · `temCuaDong` · `moRong`) chứ
không viết ở dashboard rồi viết lại ở agent: hai bên nở khác nhau là **số tem trên màn hình khác số
tem ra khỏi máy in**. Lệnh gửi vào hàng đợi cũng khai `sl` = số tem THẬT của dòng, nếu không thì hàng
đợi báo "1 tem" trong khi máy in nhả 3, và trần số tem gác sai.

**④ In 6 tem phải ra một hơi.** Máy đang nhả 2 con, kéo decal trống về, rồi mới nhả 2 con tiếp.
Nguyên nhân: mỗi hàng giấy là **một trang TSPL đầy đủ**, mang theo cả `SIZE` và `GAP` — hai lệnh đó bắt
máy in **đo lại giấy**, nên nó phải đẩy tem qua đầu in rồi rút về trước mỗi cặp. Nay khai khổ **một
lần** ở đầu lệnh (`tsplDau`), mỗi hàng chỉ còn `CLS` + `BITMAP` + `PRINT` (`tsplThan`), và thêm
`SET TEAR OFF` để bỏ luôn cú đẩy tem ra thanh xé rồi kéo về sau **mỗi** nhãn.
Đánh đổi đã biết: con tem cuối đứng lại trước thanh xé, bóc bằng tay (decal die-cut vẫn bóc bình
thường). Nghiệm thu thật: 4 tem `12 · 14 · 16 · 18` → **2 hàng giấy trong MỘT job 77 KB**, gửi 1,9s,
bấm → xong 6,9s.

`--thu` cũng đổi để là **bản chạy khô trung thực**: dựng cả lệnh thành một tệp `ca-lenh.tspl` y hệt
luồng mà `--dich-vu` gửi, và in ra số lần khai khổ. Bộ test soi thẳng luồng byte đó: `SIZE` đúng 1
lần · `GAP` 1 lần có đơn vị ở cả hai tham số · có `SET TEAR OFF` · 3 hàng thì 3 `CLS`/3 `PRINT`/6
`BITMAP`.

**Một bài học về TEST:** ca test điện thoại cũ đo `td[0]`/`td[1]` tưởng là SKU / tên hàng — đúng theo
bảng **6 cột đã bỏ**. Nó vẫn xanh trong khi giao diện thật dán nhãn `ĐVT:` lên ô SKU và bỏ trắng nhãn
ô Số lượng (thấy rõ trong ảnh). Nhãn gắn bằng `nth-child` là thứ **âm thầm sai** khi số cột đổi, nên
test giờ đo cả **nội dung nhãn** (`::before`), không chỉ kích cỡ: ô 1 phải là "Số tem", ô 2 "Số lượng",
ô SKU **không** được có nhãn `ĐVT`, và hai ô "áp cho tất cả" phải ghi `SỐ TEM` / `SỐ LƯỢNG` (đang ghi
`MẪU` / `SL` — nhãn của bảng cũ còn sót lại).

### 12.8 Bẫy đắt nhất trong ngày: mã đã đúng, tiến trình thì cũ

Người dùng in thử 4 con tem `12 · 14 · 16 · 18` và cả bốn con đều in **cùng một chuỗi** `"12, 14, 16, 18"`
thay vì mỗi con một số. Lõi đúng, bộ test xanh, dashboard gửi lệnh đúng — nhưng **tiến trình agent đang
chạy là bản khởi động lúc 18:23, trước khi phần nở tem được sửa**. Nó vẫn lấy nguyên ô số lượng làm số
in rồi lặp 4 lần.

Đây là loại lỗi tệ vì mọi bằng chứng đều nói "đã xong": file trên đĩa đúng, test đọc file trên đĩa nên
cũng đúng, chỉ có RAM là sai. Ba việc đã làm để nó không lặp lại:

1. **Agent tự nạp lại khi mã đổi.** Mỗi lượt quét lúc RẢNH, agent so dấu thời gian của
   `in-tem-agent.mjs` và `factory/index.html` (lõi tem nằm trong đó) với lúc nó khởi động; khác thì
   sinh tiến trình mới rồi tự thoát. Chỉ đổi lúc rảnh nên không có lệnh nào bị bỏ giữa đường. Đo thật:
   sửa file → 6 giây sau PID đã đổi, và vẫn đúng **một** tiến trình (task watchdog 5 phút là lưới đỡ
   cuối, không phải đường chính).
2. **Chế độ ĐO liệt kê từng con tem.** `[ĐO] 1) 422430797 · 12 | 2) 422430797 · 14 | …` — số lượng nằm
   trong ảnh bitmap nên soi luồng TSPL không bao giờ thấy được nó sai. Bản chạy khô mà không nói con
   tem nào mang số nào thì không kiểm được gì; 4 con tem thật đã phải in ra chỉ để biết điều đó.
3. **Ca test gọi thẳng agent**, không chỉ gọi lõi: `node in-tem-agent.mjs --thu "422430797@12/14/16"`
   rồi đọc dòng liệt kê. Ở dòng lệnh dùng dấu **gạch chéo** để tách số lượng vì dấu phẩy đã dùng để
   tách các SKU.

`chay()` (đường `--thu`/`--in`) cũng đã bỏ vòng tự lặp, dùng chung `T.moRong` như `--dich-vu`: một
đường nở tem duy nhất cho cả ba lối vào.

### 12.9 Ô số lượng kiểu CHIP + bỏ sổ tay tem (21/08/2026)

**① Bớt chữ trong pop-up.** Bỏ ba câu: hướng dẫn cú pháp dấu phẩy ở tiêu đề, dòng phụ
"N SKU · N tem · N hàng giấy" (nút ở chân đã ghi *Xác nhận in N tem*), và câu *"bấm Xác nhận in là tem
ra, không có hộp thoại nào"*. Dòng trạng thái nay **im** khi máy in rảnh — nó chỉ để dành cho lúc có
chuyện thật: đang chờ đợt của ai, máy trạm tắt agent, máy in báo lỗi.

**② Nhập nhiều số lượng bằng nút "+".** Ba bịch 1.000 · 2.000 · 3.000 thì gõ số rồi bấm **+** ba lần;
mỗi số đã chốt thành một **chip** nằm trước ô nhập, ô nhập nhảy về `0` để gõ tiếp, chip nào sai thì
bấm `×` ở chính nó. Vì sao đổi khỏi cách gõ `"1000, 2000, 3000"`: cú pháp dấu phẩy phải học, mà trên
điện thoại dấu phẩy còn nằm ở lớp bàn phím khác. Ô nhập **vẫn hiểu** chuỗi có dấu phẩy (dán vào được),
nhưng đường chính là nút +.

Chi tiết đáng giữ:
- Chip tái dùng **nguyên khuôn `.nds-tag`** của tab (popIn · nút `×` · focus ring) — lệ dự án: đã có
  khuôn thì không dựng control trần mới.
- Nút **+** nền accent đặc, chữ trắng, có bóng, và **chỉ hiện khi trong ô đang có số** — nó là thao
  tác chính của ô này, không phải một dấu cộng mờ lẫn vào nền.
- Chip xếp **trước** ô nhập nên đọc từ trái sang phải là đúng thứ tự sẽ in, và số vừa chốt luôn nằm
  sát ngay ô nhập.
- Chốt xong thì **con trỏ về lại ô đó** (`focus` + `select`): nhập ba bịch là ba lần gõ liền tay.
- Rời ô cũng chốt, và `prIn` gọi `prCamHet()` trước khi gửi — bấm In mà mất con số vừa đánh vì quên
  bấm + là kiểu mất mát người dùng chỉ phát hiện khi tem đã ra thiếu.
- Nguồn dữ liệu vẫn **chỉ là `r.slHang`** (chuỗi `"1.000, 2.000, 3.000"`); lõi `tachSl`/`moRong` lo
  phần nở. Không thêm trường mới nào để hai đầu (dashboard ↔ agent) không có gì lệch.
- Ô nhập to hơn: `64px/12.5px` → `88px/14px`, điện thoại `82px` cao `42px`.

**③ Bỏ sổ tay tem.** Sổ tay từng ghi nhớ "tem này = SKU kia" mỗi lần người dùng **bấm một thẻ gợi ý**,
để lần sau ra ngay không cần AI. Đường ghi duy nhất của nó chính là cú bấm đó — mà thẻ là một ô lớn
trên điện thoại, chạm lệch rất dễ, và **bấm nhầm một lần là ghim SKU sai ở 100% cho mọi lần gặp lại
tem đó**. Người dùng chốt: bỏ.

Cách tắt (cố ý không xoá cả khối): `ndsSoNap` luôn trả sổ **rỗng** và `ndsSoHoc` không ghi gì. Nhờ vậy
mọi đường phụ thuộc tự tắt theo mà không phải mổ vào tầng xếp hạng — `ndsSoTra()` rỗng nên luật "ghim
từ sổ tay" không chạy, `daHoc` không bật nên nhãn *"từ sổ tay"* và nút *"quên ghi nhớ"* không xuất
hiện, `ndsSoDem()` = 0 nên nút *"Xoá sổ tay"* tự ẩn. **Dữ liệu cũ trên máy cũng bị dọn một lần** khi
mở trang: chỉ chặn đường ghi mà vẫn đọc thì những ghi nhớ sai đã có từ trước vẫn tiếp tục gợi ý sai —
đúng cái cần tránh.

**Cái mất, nói thẳng:** đường "quét mã vạch tem NCC → ra ngay SKU" không còn, vì cái làm nó ra ngay
chính là sổ tay. Còn nguyên: quét mã vạch → thành từ khoá → đối soát bằng điểm (không gọi AI), và mã
vạch **trùng** một SKU nội bộ thì vẫn ăn thẳng. Muốn có lại vòng tự học thì đường ghi phải là một nút
**"Ghi nhớ tem này"** bấm có ý, chứ không ăn theo cú bấm thẻ.

**④ Bẫy escaping, lần thứ n trong dự án này.** Nút + ban đầu viết
`onclick="prCam(this.parentNode.querySelector('input.prsl-v'))"` — dấu nháy lồng trong thuộc tính HTML
bị mất backslash lúc sinh file, và **cả trang chết** (`Unexpected identifier 'input'`) chứ không phải
chỉ hỏng cái nút. Đã đổi sang `prCam(this.previousElementSibling)`: nút nằm ngay sau ô nhập nên không
cần dấu nháy nào. Kèm theo có `probe-loi-trang.mjs` — mở trang trong Edge headless rồi in **mọi** lỗi
JS, dùng khi bộ test đổ ngay từ ca đầu (lúc đó thông báo của bộ test không chỉ được vào đâu).

### 12.10 Máy in hết giấy mà không ai biết — và cách chữa (21/08/2026)

**Chuyện đã xảy ra:** máy in hết giấy giữa một đợt. Dashboard **không báo gì**. Người dùng bấm ép in
**4 lần**. Lắp cuộn decal mới vẫn không ra tem; phải mở nắp máy rồi đóng lại mới in — và chỉ ra **3
trong 5** con tem.

**Vì sao cả đường in im lặng:** `WritePrinter` trả về OK **ngay khi SPOOLER nhận byte**. Nó không hề
liên quan tới việc máy in có giấy hay không. Suốt từ đầu tới giờ agent báo `OK 19320 byte` — đúng
theo nghĩa spooler, nhưng sai hoàn toàn theo nghĩa người dùng cần. Không có ai đi hỏi máy in cả.

**Chữa: đi hỏi, rồi chặn.**
- `_TRANG-THAI-MAY-IN.ps1` đọc **ba nguồn** (mỗi nguồn thấy một phần): `Get-Printer` →
  `PrinterStatus` + `JobCount`; WMI `Win32_Printer` → `DetectedErrorState` (4 = hết giấy · 7 = mở nắp ·
  8 = kẹt · 3 = gần hết) + `WorkOffline`; `Get-PrintJob` → từng việc in trong queue **kèm tuổi**.
  Đo thật: 1,2 giây một lượt.
- Việc in nằm trong queue **quá 45 giây** là dấu hiệu chắc nhất: máy in không rút dữ liệu ra nữa. Một
  con tem in xong trong ~2 giây, nên ngưỡng đó đã rất rộng. Đây chính là dấu hiệu mà lần hết giấy vừa
  rồi lẽ ra phải bắt được.
- Agent đọc mỗi **10 giây** (và **bắt buộc đọc lại ngay trước khi gửi**), gửi kèm mỗi lượt `pr_lay`.
- **GAS không phát việc khi máy đang chặn.** Lệnh nằm lại ở `cho`; máy in xong thì lượt hỏi sau tự
  nhận việc và in. Đây là chỗ chữa gốc chuyện "bấm ép in 4 lần": **người dùng không có gì phải bấm
  lại**. Kèm `pr_hoan` để agent trả lệnh về hàng đợi khi phát hiện chặn sau khi đã nhận.
- Sau khi gửi vẫn **soi lại một lần**: nếu máy vừa chuyển sang hết giấy thì nói thẳng, và nói kèm
  *"tem sẽ ra khi xử lý xong, ĐỪNG bấm in lại"* — byte đã nằm trong queue, bấm lại là ra tem đôi.
- Dashboard: **chip tình trạng máy in** ở chân pop-up, tự làm mới 5 giây/lượt khi pop-up đang mở, ba
  màu (sẵn sàng · cảnh báo · chặn) và **nói rõ khi số liệu đã cũ** — một chip "sẵn sàng" đọc từ 5 phút
  trước là vô giá trị. Lúc máy chặn, dòng trạng thái nói lý do + việc phải làm, và `prTheoDoi` kiên
  nhẫn tới 6 phút thay vì bỏ cuộc sau 2 (người dùng còn đi lấy cuộn decal).

**Bắt được thêm một họ lỗi nữa:** cú "hâm nóng" đầu mỗi lần agent khởi động đang gửi một lệnh TSPL
rỗng, và **mỗi lần như vậy để lại một việc in 0 byte nằm trong queue** ở trạng thái `Spooling` — chính
họ lỗi làm lượt gửi sau đội từ ~2s lên 22s. Nay hâm nóng bằng `_IN-RAW.ps1 -ChiMo`: chỉ mở rồi đóng
handle máy in, **không sinh việc in nào** (đo: 451ms, queue vẫn rỗng).

**Đã nghiệm thu cả tuyến bằng trạng thái giả** (không tháo giấy máy in thật):
gửi lệnh → báo `HẾT GIẤY` → GAS phát **0** việc và trả `mayChan` → dashboard thấy `trangThai=cho`,
`may.chan=true`, `may.chu="HẾT GIẤY"` → báo `sẵn sàng` → việc được phát ra ngay, đúng lệnh cũ. 13 ca
test bơm thẳng số liệu thô của Windows vào khối phán xử (hết giấy · mở nắp · kẹt · gần hết · offline ·
queue tạm dừng · job mang cờ lỗi · job nghẽn 45s · job mới 3 giây · không hỏi được · không thấy máy).

### 12.11 Đếm được bao nhiêu tem còn lại không? — phân tích, KHÔNG thực thi

Câu trả lời ngắn: **không đếm được đáng tin**, và chỗ chặn không nằm ở code mình.

**Ba lý do, theo thứ tự cứng dần:**
1. **Không có ai giữ con số đó.** Windows/spooler không hề biết cuộn decal còn bao nhiêu nhãn; không
   có trường nào trong `Get-Printer` / WMI / queue nói về vật tư. Cảm biến của máy in chỉ có hai mức
   *có giấy / hết giấy* (mức `LowPaper` = 3 có trong chuẩn WMI và mình đã xử lý sẵn, nhưng máy in
   decal để bàn hầu như không có cảm biến "gần hết" nên đừng trông chờ nó bắn).
2. **Máy in có đồng hồ, mà mình không đọc được.** TSPL có lệnh hỏi trạng thái (`<ESC>!?`) và đồng hồ
   quãng in; muốn đọc **byte trả về** thì phải nói chuyện trực tiếp với cổng USB trên máy cắm máy in.
   Qua queue share thì đường chỉ có **một chiều: ghi**. Đây là giới hạn của quyền đang có, không phải
   thiếu code.
3. **Máy in không chỉ nhận việc từ dự án này.** Người ta vẫn in trực tiếp bằng BarTender trên
   `DESKTOP-JE75K38`. Mọi con số mình tự đếm đều mù phần đó. Và kể cả có bắt được việc in của họ
   trong queue (`Get-PrintJob` thấy được, vì là queue dùng chung) thì cũng vô dụng: một việc in RAW
   luôn báo `TotalPages = 1` bất kể trong đó có 1 hay 200 con tem.

**Ba bậc làm được, nếu vẫn muốn có một cái đồng hồ ước lượng:**
- **Bậc 1 — đếm phần của mình (chắc chắn đúng).** Agent biết chính xác số con tem mỗi lệnh. Cộng dồn
  từ lúc bấm nút *"đã lắp cuộn mới"* → *"cuộn này đã in 780 tem"*. Rẻ, không cần quyền gì thêm.
- **Bậc 2 — ước lượng còn lại (có sai số biết trước).** Khai một lần "một cuộn ≈ N tem" rồi lấy
  `N − đã in`. Sai số = **đúng bằng** số tem in trực tiếp từ desktop, tức là mình phải nói rõ đây là
  ước lượng, và cảnh báo ở mức ~85% chứ đừng hứa con số chính xác.
- **Bậc 3 — đóng nốt lỗ mù (cần thêm quyền).** Nhật ký `Microsoft-Windows-PrintService/Operational`
  trên **máy cắm máy in** ghi mọi việc in (kể cả BarTender). Đọc được nó thì đếm được cả hai nguồn —
  nhưng cần đọc event log từ xa, tức là vượt khỏi mức "chỉ dùng quyền đang có". Theo lệ của dự án thì
  bậc này **không làm**.

**Khuyến nghị:** đừng dựng đồng hồ ước lượng lúc này. Cái đau thật của sự cố vừa rồi không phải "không
biết còn mấy tem" mà là **hết giấy mà không ai báo, rồi bấm ép in 4 lần**. Phần đó đã chữa xong ở
§12.10 (báo thẳng + không phát việc + tự in lại khi lắp giấy xong). Nếu sau này vẫn muốn một cái gauge
thì làm **bậc 1 + bậc 2**, và ghi rõ trên giao diện rằng đây là số **ước lượng**.

### 12.12 Tên thiết bị thay cho `may-oth9uh70@hasaki.vn`

Hàng đợi ghi "đợt tem này của ai" để người ra lấy tem biết khúc nào của mình — nhưng danh tính đang
dùng là một chuỗi tự sinh, với người đọc thì vô nghĩa hoàn toàn.

Trình duyệt cho biết được gì: `navigator.userAgentData.getHighEntropyValues(['model'])` (Chrome/Edge
trên Android) trả về **mã máy** — Xiaomi 13 ra `2211133C`, không phải tên thương mại; iOS thì Apple
**không** cho biết model, chỉ "iPhone". Nên **không có cách nào tự đoán ra đúng chữ "Xiaomi 13"**.
Vì vậy: đoán một cái tên tạm cho khỏi trống (mã máy Android / iPhone / iPad / PC Windows), rồi để
người dùng **đặt tên một lần** — nút *"Thiết bị: …"* ở chân pop-up In tem, nhớ trong máy đó.
Danh tính kỹ thuật (`may-…@hasaki.vn`, dùng cho hạn mức AI) vẫn gửi riêng ở trường `may`.

### 12.13 iOS: bấm "Bật camera" là mất nút Chụp

Trên iPhone, bấm *Bật camera* thì khung phóng to tràn màn hình, mất luôn nút **Chụp** màu cam và hàng
tỉ lệ zoom. Nguyên nhân: Safari trên iOS **tự đưa `<video>` vào toàn màn hình** khi play nếu thiếu
thuộc tính tiền tố cũ `webkit-playsinline` (chỉ có `playsinline` là không đủ trên bản cũ). Lúc đó nút
Chụp (`position:fixed`) và hàng zoom nằm dưới lớp toàn màn hình nên coi như mất.

Vá bốn lớp, từ gốc ra ngoài: thêm `webkit-playsinline` + `autoplay` · ẩn thanh điều khiển gốc của
Safari (`::-webkit-media-controls`, nó có nút toàn màn hình — chạm nhầm là mất khung) · **trần chiều
cao** cho khung trên máy hẹp (`max-height:min(52vh,420px)`) kèm khuôn `padding-top:75%` cho trình
duyệt không hiểu `aspect-ratio` · và lưới đỡ cuối: nghe `webkitbeginfullscreen` thì gọi
`webkitExitFullscreen()` ngay.

### 12.14 Hàng nhập liệu trên điện thoại (đặc tả từ video quay máy thật, 21/08/2026)

Ba lỗi thấy trong video, và số đo sau khi vá (đo bằng `getBoundingClientRect` trong bộ test, không
phải bằng mắt):

| lỗi trong video | sau khi vá |
|---|---|
| "Số tem" chiếm gần nửa thẻ dù chỉ nhận 1-2 chữ số | **chôn cứng 82px** ở mép trái, không co giãn |
| "Số lượng" bị ép sang góc phải, chữ co lại | **232px** (gấp 2,8 lần), cao **44px**, chữ **19px/700** |
| chip số lượng chen ngang hàng → ô nhập bị bóp, rớt dòng méo | chip thành **dòng riêng phía trên**; thêm 3 chip thì ô nhập vẫn **232px**, kéo ngang **0px** |

Cách làm: thẻ trên điện thoại chuyển sang lưới **3 cột** `82px minmax(0,1fr) auto` với vùng
`"sku sku del" / "pn pn pn" / "tem sl sl"` — hàng SKU trải hai cột đầu để không bị bóp vào 82px. Ô Số
lượng tách thành hai dòng: `.prchips` (chip đã chốt, `flex-wrap`) ở trên, `.prgo` (ô nhập + nút `+`) ở
dưới. Nhãn hai ô đổi sang `display:block` nên nằm **trên** ô nhập thay vì trước nó.

**Bàn phím ảo** (chỗ này mới là phần dễ bỏ sót): bàn phím số ăn ~50% chiều cao màn, mà `vh` **không
đổi** khi bàn phím mở (nó là khung lớn) — nên pop-up vẫn cao 90% màn và tràn xuống dưới bàn phím, nút
*Xác nhận in* bị che. Vá bằng `dvh` (chiều cao vùng THẤY ĐƯỢC), khai thành **dòng riêng** để trình
duyệt không hiểu `dvh` thì chỉ bỏ dòng đó và giữ nguyên `90vh`:
`.modalbox{max-height:90vh}` rồi `.modalbox{max-height:90dvh}`; phần danh sách cũng vậy
(`min(40vh,46dvh)`). Kèm hai việc chủ động: `onfocus` thì cuộn ô đang gõ vào giữa vùng còn thấy được
(chờ 300ms cho bàn phím dựng xong — cuộn sớm thì vị trí tính ra sai), và nghe `visualViewport.resize`
để cuộn lại một lần nữa đúng lúc bàn phím vừa mở. Cả hai ô đều có `inputmode="numeric"` để bàn phím số
lên ngay (ô Số lượng phải là `type="text"` vì mình tự chèn dấu chấm hàng nghìn).

### 12.15 Ép trạng thái máy in về gần thời gian thực (21/08/2026)

User đo được: **tắt máy in 30 giây sau** dashboard mới đổi trạng thái, **bật lại thì 120 giây**. Ba
nguyên nhân, mỗi cái một tầng:

**① Hỏi sai chỗ.** Máy in này là máy SHARE. Hỏi KẾT NỐI CỤC BỘ (`Get-Printer -Name "\\may\share"`)
chỉ mất **27ms** nhưng trả về **bản cache** của Windows — chính cache đó là 30s/120s. Hỏi thẳng **máy
chủ in** (`Get-Printer -ComputerName <máy> -Name <share>`) thì đọc đúng thiết bị thật (thấy cả
`PortName USB031`). Nay hỏi máy chủ trước, chỉ rơi về cache khi không gọi được.

**② Mỗi lượt hỏi lại spawn PowerShell.** Lệnh `-ComputerName` trong một tiến trình MỚI mất **8–10
giây** (nạp module PrintManagement + dựng phiên RPC); cùng lệnh đó trong phiên đã nóng: **129ms**.
Nên nay có `_MAY-IN-SERVER.ps1` — một tiến trình PowerShell **sống lâu**, agent hỏi qua stdin và đọc
tới dòng mốc `<<END>>`. Một lượt đọc đầy đủ (máy chủ 129ms + WMI 239ms + queue 6ms) ≈ **0,4s**.
Bẫy đã cắn ngay khi làm: tiến trình mới in một **dòng chào** (`SAN-SANG`) mà agent nhận nhầm làm câu
trả lời → báo "không hỏi được", rồi lượt sau chờ hết hạn 8 giây làm **cả vòng quét dài 12 giây**. Phải
đọc bỏ dòng chào trước khi hỏi.

**③ Nhịp đọc cố định.** Nay nhịp **theo người xem**: dashboard mở pop-up In tem → GAS đóng dấu
`PR_XEM` → agent thấy cờ `xem` và chuyển sang đọc máy in mỗi **0,7s** (và gần như không nghỉ giữa hai
vòng); không ai xem thì 12s/lượt cho nhẹ máy. Dashboard cũng hỏi mỗi **900ms** thay vì 5 giây.

**Đo lại sau khi vá** (dashboard hỏi liên tục 10 lượt, máy trạm đang tắt thật):
số liệu tươi **0,5–1,9s** (trung vị ~1,2s), mỗi lượt gọi Apps Script 1,3–1,7s.
→ **Tổng độ trễ thấy trên màn hình ≈ 2–3,4s**, so với 30s/120s trước đó.

**Nói thẳng về mốc "<2s":** không đạt được qua đường hàng đợi này, và không phải vì thiếu tối ưu. Một
lượt gọi Apps Script tốn ~1,1–1,4s trần (chuỗi chuyển hướng của Google) và đường đi phải qua **hai**
lượt như vậy: agent→GAS rồi GAS→dashboard. Cộng nhịp đọc thì sàn thật là ~2,5s. Muốn dưới 2s thì
dashboard phải nói TRỰC TIẾP với máy trạm — đúng cái không làm được từ điện thoại (lý do sinh ra hàng
đợi, xem §12.1).

**Bắt được thêm một lỗ ngay trong lúc user thử:** máy trạm tắt hẳn → hỏi máy chủ in thất bại → probe
**rơi về bản cache** và báo "sẵn sàng" → agent gửi đi và nhận `LOI StartDocPrinter 1722`. Nay "không
gọi được máy chủ in" là **một tín hiệu**: hụt **hai lượt liền** thì chặn với câu *"máy trạm hoặc máy
in đang tắt?"* (một lượt đơn lẻ thì bỏ qua — chặn ngay là chặn oan vì một cú RPC hụt). Và khi lệnh gửi
thất bại với 1722 thì đặt trạng thái chặn **ngay**, không đợi lượt đọc sau.

### 12.16 Chân + đầu pop-up In tem (21/08/2026)

Bốn thứ `Máy in: sẵn sàng · Thiết bị: PC Windows · Xoá hết · Xác nhận in` đang chen một hàng flex nên
trên điện thoại rớt dòng lộn xộn — đúng họ lỗi với hàng nhập liệu ở §12.14.

- **Tên thiết bị lên ĐẦU pop-up**, chôn cứng bìa phải cùng hàng với tiêu đề, cạnh nút đóng. Nó là
  *danh tính của cái máy đang bấm*, không phải một điều khiển của việc in — để lẫn giữa mấy nút ở chân
  thì vừa chật vừa dễ bấm nhầm.
- **Chân chia hai khối:** bên trái TÌNH TRẠNG (đọc), bên phải VIỆC LÀM (bấm). Trên điện thoại xếp
  thành hai dòng, nút chính ăn hết bề rộng còn lại và cao 46px (đo được **265×46px**).
- **Tình trạng máy in thành "viên thuốc" có đèn**: một chấm màu nói nhanh hơn mọi câu chữ — xanh sẵn
  sàng · vàng cảnh báo · **đỏ + nháy** khi đang chặn (người đang định bấm In phải bị chặn mắt lại) ·
  xám chưa rõ.
- **Nút lùi "In bằng máy này" xuống một dòng riêng.** Bộ test bắt được: khi nó hiện, BA nút chen một
  hàng 350px làm nút chính co còn **126px** và chữ rớt hai dòng.
- **Bẫy CSS đáng ghi:** khối `@media(max-width:1000px)` của pop-up in nằm **TRƯỚC** phần CSS gốc của
  `.prfoot` trong file. Hai rule cùng độ ưu tiên thì **cái đứng sau thắng**, nên `align-items:stretch`
  trong media bị `align-items:center` phía dưới đè. Phải thêm tiền tố `#prmodal` (1-2-0) để thắng bất
  kể thứ tự.

Kèm hai việc nhỏ user chỉ ra: nhãn **"Số tem" căn bìa trái** (ô có class `num` nên nhãn thừa hưởng căn
phải và trôi sang bên phải cột 82px), và **chip số lượng chuyển xuống DƯỚI ô nhập** (tay đang gõ thì ô
nhập ở trên; danh sách đã chốt là thứ đọc lại nên ở dưới).

### 12.17 Ô Số lượng bị chốt HAI LẦN + dải số lượng ra hàng riêng (21/08/2026)

User báo: *"chỗ này khi gõ thêm số lượng thì bị double lên 2 lần tem"*, kèm ảnh có chip `5 · 6 · 5 · 5`
— hai số 5 dính nhau đúng kiểu một cú chốt bị nhân đôi.

**Không bộ test nào cũ bắt được vì không bộ nào GÕ VÀO Ô rồi BẤM NÚT như người thật.** `qc-in-tem.mjs`
chỉ kiểm lõi (mã vạch · khổ giấy · nở danh sách); `qc-tab-nhan-dien.mjs` có chạm ô số lượng nhưng nó
**gán thẳng `o.value` rồi gọi hàm** — mà lỗi nằm ở **THỨ TỰ SỰ KIỆN**, gán thẳng thì vĩnh viễn không
thấy. Thêm **`qc-in-tem-popup.mjs`**: dùng chuột/bàn phím THẬT của Chromium
(`page.keyboard.type` · `ElementHandle.click`), 15 ca.

Bộ mới dựng lại lỗi ngay ở ca thứ hai:

```
✓ Gõ 5 rồi bấm +        → chip [5]
✗ Gõ 6 rồi Enter        → chip [5|6|6]      ← MỘT con số, HAI chip
```

**Gốc:** ô có ba đường chốt (`onclick` của nút +, `onkeydown` Enter, `onchange` khi rời ô). Enter gọi
`prCam` (chốt lần 1) rồi `prVe()` dựng lại bảng, NHƯNG Enter trong ô text còn làm trình duyệt bắn luôn
`change` — và `preventDefault()` **không chặn được** `change`: nó là hệ quả của việc *chốt giá trị*,
không phải hành vi mặc định của phím. Ô cũ dù đã bị tháo khỏi DOM vẫn còn giữ chuỗi `"6"` nên `prCam`
chạy lần hai.

**Chữa bằng cách làm `prCam` BẤT BIẾN THEO LƯỢT: dọn ô NGAY khi đã đọc xong con số, TRƯỚC lúc vẽ lại.**
Sự kiện bắn muộn đọc lại ô thì thấy rỗng ⇒ tự thoát. Không cờ, không hẹn giờ, không phụ thuộc thứ tự
sự kiện của từng trình duyệt — nên đường nút +, đường Enter và đường rời-ô đều an toàn như nhau.

**Cùng lúc đổi cách hiển thị số lượng (user: *"vị trí hiện tại đang chưa thân thiện"*).** Trước đây
chip đã chốt nằm ngay trong cột "Số lượng" — một cột hẹp, canh phải:

* 4-5 chip là rớt thành 2-3 dòng méo mó, **ngay chỗ tay đang gõ**;
* ô nhập hiện số **`0`** khi đã có chip — *"Số lượng: 0"* đọc ra thành *"số lượng bằng không"*, đúng
  thứ làm người dùng hoang mang nhất;
* và không chỗ nào **nói ra** quan hệ *"mỗi số lượng = một con tem"* — người dùng thấy `Số tem 4` ở
  cột trước rồi 4 chip ở cột sau mà không biết cái nào sinh ra cái nào.

Nay: cột Số lượng chỉ còn **đúng chỗ để gõ** (ô nhập + nút `+`, placeholder mờ *"gõ số lượng"* /
*"+ số nữa"*), còn danh sách đã chốt xuống một **dải riêng ăn hết bề rộng dòng**, mở đầu bằng câu
*"Sẽ in **4** tem — mỗi số lượng một con tem"*.

Ba chi tiết phải làm đúng, cả ba đều do ảnh chụp 390px bắt được:

* **Dải là một `tr` riêng**, mà trên điện thoại mỗi `tr` là một THẺ có viền + bóng ⇒ để nguyên thì nó
  thành thẻ thứ hai rời rạc. Dán vào đáy thẻ trên: thẻ trên bỏ bo góc dưới bằng class `co-chip` do
  `prVe` gắn — **không dùng `:has()`** để khỏi phụ thuộc bản trình duyệt.
* **Nhãn `::before "Số tem"`** của bố cục thẻ điện thoại rơi xuống cả ô đầu của hàng dải, in ra một
  chữ "Số tem" lạc giữa hai khối. Phải `display:none` cho `tr.prsl2>td::before`.
* **Nút × của chip lên 40px** trên điện thoại. Khuôn dùng chung `.nds-tag .x` chỉ 18px — đủ cho badge
  từ khoá ở tab (bấm nhầm thì thêm lại), nhưng ở đây bấm nhầm là mất một con tem đã khai. Dải đã ăn
  hết bề rộng nên có chỗ cho chip to.

**Đo:** `qc-in-tem-popup` **15/15** (gồm 3 ca màn 390px) · `qc-in-tem` 138/138 · `qc-tab-nhan-dien`
**155/155** (4 ca phải sửa theo DOM mới: chip đổi sang `tr.prsl2`, ô nhập trống thay vì `0`).
