# Thêm VẢI và THUN vào tab "Chuyển đổi cân" — phân tích danh mục + kế hoạch

*Soạn 23/08/2026. Số liệu lấy từ tab `SKU_MASTER` (8.143 dòng, bản 23/08 07:31) bằng
`hasaki/phan-tich-vai-thun.mjs` — chạy lại được, không gọi WMS.*

---

## 1. Kết luận trước, số liệu sau

| | Vải | Thun |
|---|---|---|
| SKU trong danh mục | **972** (886 ACTIVE · 27 COMBO) | **98** (95 ACTIVE) |
| Khai theo **chiều dài** (mm/m/yard/cm) → *cần quy từ cân* | **695** (466 còn tồn) | **93** (63 còn tồn) |
| Khai theo **khối lượng** (g/kg) → *khai thẳng số cân* | 272 (174 còn tồn) | 3 |
| **Quy được NGAY từ tên hàng** | **49%** (341/695) · trong số còn tồn **45%** | **0%** |
| Tồn đang giữ | 535 triệu mm + 55,3 **tấn** | 168 triệu mm |

**Vải làm được ngay, Thun thì không** — và đó là hai bài toán khác nhau về bản chất, không phải
khác nhau về khối lượng công việc:

* **Vải là hàng KHỔ**: cân ra mét được nếu biết *định lượng* (gsm) và *khổ* (cm). Tên hàng của
  danh mục đã mang sẵn hai số đó ở khoảng một nửa số SKU.
* **Thun là hàng DẢI**: chỉ cần *định lượng dài* (g/m) — nhưng **không một SKU nào** trong 98 SKU
  Thun ghi con số đó trong tên. Tên chỉ có **bề rộng dải** (3–60mm, có ở 91%), mà bề rộng KHÔNG suy
  ra được khối lượng: thun dệt 40mm và thun nhung 40mm nặng khác nhau xa.

---

## 2. Một công thức, ba cái thước

Cả ba loại hàng đều là **một** phép chia:

```
chiều dài  =  khối lượng thật  ÷  khối lượng trên mỗi mét
```

Khác nhau chỉ ở chỗ lấy *"khối lượng trên mỗi mét"* ở đâu:

| Loại | Thước | Nguồn số | Sẵn có? |
|---|---|---|---|
| **Chỉ** (đang chạy) | Tex = g mỗi 1.000 m | chip Tex bóc từ danh mục · hoặc cân cuộn nguyên | ✅ đã làm |
| **Vải** | `g/m = gsm × khổ(m)` | gsm + khổ bóc từ **tên hàng** | ✅ 49% tên có đủ |
| **Thun** | `g/m` trực tiếp | **phải cân mới biết** | ❌ 0% tên có |

Nghĩa là tab không phải viết lại: giữ nguyên khung *"tổng cân · số cuộn · khối lượng lõi · cuộn
nguyên"* + kết quả + phiếu tính + luật đối chứng >5%, chỉ **thay khối "thước"** theo loại hàng.

> Ghi chú kỹ thuật: Tex và g/m là cùng một đại lượng khác thang (`g/m = Tex ÷ 1000`). Nhưng KHÔNG
> dùng lại ô Tex cho Thun: thun 40mm cỡ 5 g/m = "Tex 5.000", trong khi ô Tex hiện chặn ở 500 (chỉ
> may thật không quá vài trăm). Nới trần ô Tex là mở cửa cho lỗi gõ tay ở đường chỉ may — thà thêm
> ô g/m riêng.

---

## 3. Vải — số liệu chi tiết

### 3.1 Tên hàng mang sẵn thông số gì

Trên **695 SKU khai theo chiều dài** (đối tượng chính):

| | có | tỉ lệ |
|---|---|---|
| có **khổ** | 600 | 86% |
| có **định lượng** | 394 | 57% |
| **có cả hai** → quy được ngay | **341** | **49%** |
| trong số **còn tồn** (466 SKU) | 211 | 45% |

Trên 272 SKU khai theo khối lượng (nhóm này chỉ cần quy *ngược* mm → kg khi muốn đối chiếu): khổ
98% · gsm 83% · cả hai **83%**. Tức nhóm hàng mới khai (dãy SKU 4222xxxxx) ghi tên chuẩn hơn nhóm cũ.

### 3.2 SÁU cách ghi khổ, HAI cách ghi định lượng — bộ bóc phải chịu hết

Đếm thật trên danh mục:

```
khổ:        cm trần 266 · cm có nhãn (W/Width/Khổ) 239 · inch 84 · khoảng inch 8 · K150 1 · lỗi 2
định lượng: gsm 382 · oz 12
```

Ví dụ từng dạng — đây là danh sách bộ bóc phải qua được:

| Dạng | Ví dụ thật | Xử lý |
|---|---|---|
| cm trần | `220gsm, 180cm` | lấy trực tiếp, chặn dải 20–400cm |
| cm có nhãn | `Width 165cm+3cm` · `Khổ 147 cm` · `W150cm` | lấy số **đầu** (165), `+3cm` là biên tua |
| inch | `230gsm, 57"` · `11oz, 65"` | × 2,54 |
| khoảng inch | `Width 58-59inch` | lấy giữa → sai sẵn ±0,7% |
| oz (oz/yd²) | `11.7oz` | × 33,906 → gsm |
| `weight 210` | `Width 1650cm (phủ bì), weight 210, 220` | gsm = 210 |
| **lỗi gõ** | `Width 1650cm` (= 16,5 m!) | ÷10 rồi **cảnh báo**, không im lặng nhận |

### 3.3 Khổ và định lượng nào phổ biến (để làm chip)

```
khổ:  150cm (122) · 152cm (96) · 190cm (66) · 140cm (58) · 170cm (54) · 115cm (48) · 180cm (44) …
gsm:  160 (57) · 220 (42) · 170 (40) · 280 (34) · 157 (32) · 230 (29) · 140/300/180 (22) …
```

**Khổ thì nên làm chip** (3 giá trị đầu phủ ~40%, đúng khuôn chip Tex 27/24/60 đang chạy).
**gsm thì KHÔNG nên làm chip**: 60+ giá trị rời rạc, giá trị đầu bảng chỉ phủ 9%. Đường đúng cho
gsm là **đọc từ chính SKU**: người dùng gõ/chọn SKU → máy tự điền gsm + khổ và **nói rõ đọc được từ
đâu** trong tên. Tab đã có sẵn danh mục trong `NDS.ds` (chip Tex hiện đang dùng chung nguồn này),
nên không tốn thêm lượt gọi nào.

### 3.4 Sai số phải nói trước, không được vờ

`gsm` trong tên hàng là **định lượng danh nghĩa của NCC**, không phải cân thật của cuộn đang nằm
trên kệ. Ba nguồn lệch, cộng lại thực tế **±5–8%**:

1. **gsm dao động** theo lô nhuộm/xử lý — thường ±3–5%.
2. **Khổ có biên tua**: `Width 165cm+3cm` nghĩa là khổ dùng được 165 nhưng **cân thì cân cả 168**.
   Lấy 165 để chia là ra chiều dài **hụt** ~2%.
3. **Co vải**: vải thun cuộn căng/thả khác nhau vài %.

⇒ Luật phải bám: khi người dùng có **cân cuộn nguyên** (một cuộn còn nguyên quy cách), lấy cân làm
thước CHÍNH và gsm chỉ để **đối chứng**; lệch >5% thì cảnh báo — đúng luật đã chốt cho chỉ may hôm
22/08. Không có cuộn nguyên thì ghi rõ kết quả là **ước tính từ định lượng danh nghĩa**.

---

## 4. Thun — vì sao chưa quy được, và cách gỡ

98 SKU, **67 nhóm mặt hàng** (`khoaHang`), chia theo loại: dệt 35 · băng 12 · nhung 11 · lưng 8 ·
chỉ 5 · su 4 · khâu 4 · luồn/cuốc/kẹp/lưới/ren… còn lại. Bề rộng có ở 91% (3 · 4 · 6 · 7 · 10 · 15 ·
20 · 25 · 35 · 40 · 50 · 60mm), **định lượng không có ở SKU nào**.

Nhưng có một mầm quý: **12 dòng trên toàn danh mục người khai đã TỰ GHI hệ số quy đổi vào tên**:

```
422295389  Thun chỉ/NSB#560-3.0-150-1-W_Triều Vĩ/…/1kg-6700m   ⇒ 0,15 g/m
422458653  Chỉ quấn chân nút/MMS TF/…/22g-260m                 ⇒ 0,08 g/m   (+9 SKU cùng loại)
```

Tức nghiệp vụ **đã** làm việc này bằng tay, chỉ chưa có chỗ chứa. Ba đường lấy g/m, xếp theo độ tin:

1. **Cân cuộn nguyên có quy cách** (cuộn 100 m, cân được 520 g, lõi 40 g ⇒ 4,8 g/m) — **chính xác
   nhất**, và tab đã có đúng bộ ô này cho chỉ may. Đây nên là đường mặc định.
2. **Sổ tay g/m tự học theo SKU** — cân một lần rồi nhớ, lần sau chỉ cần cân tổng. Đúng khuôn "sổ
   tay tem" của tab Nhận diện SKU và khuôn tab `CAN-LOI-CHI` đang chờ cân lõi thật.
3. **Bóc `1kg-6700m` trong tên** — miễn phí, phủ 12 SKU, dùng làm giá trị mồi cho sổ tay.

**Cảnh báo phải in ra màn:** thun là hàng **giãn**. Cân ra "mét" là mét ở trạng thái thả lỏng; cùng
một cuộn kéo căng khi đo sẽ ra số khác 5–15%. Với thun, con số quy đổi **chỉ dùng để khai kiểm kê /
đối chiếu tồn**, không dùng để cắt định mức.

---

## 5. Kế hoạch — 4 bước, mỗi bước dùng được ngay

### P0 · Vải, đường chắc nhất (làm trước — phủ 45% SKU còn tồn)
* Thêm hàng chọn **loại hàng**: `Chỉ` (mặc định, giữ nguyên) · `Vải` · `Thun`. Dùng lại đúng khuôn
  `.kktab` như chip Tex, không chế control mới.
* Chọn `Vải` → khối "thước" đổi thành **ô SKU** (gõ ≥4 số hoặc dán mã) + 2 ô **gsm** / **khổ** tự
  điền từ tên hàng, có dòng *"đọc được `220gsm, 180cm` ở tên hàng"* để soi lại. Sửa tay được.
* Chip khổ `150 · 152 · 190 · Khác…` cho trường hợp không có SKU trong tay.
* Kết quả: **mm · m · yard · số cuộn tương đương**, kèm dòng `1 kg ≈ 2,53 m` (thước ngược, dễ nhớ).
* Đối chứng: có cân cuộn nguyên → so với gsm danh nghĩa, lệch >5% thì cờ đỏ.
* Bộ đo: mở rộng `qc-chuyen-doi-can.mjs` (đang 38/38) + thêm màn `Chuyển đổi cân › Vải` vào
  `qc-mobile-toan-du-an.mjs`.

### P1 · Bộ bóc thông số cứng cựa
* Đưa `bocKho` / `bocGsm` (6 dạng khổ + oz + `weight`) vào `NDS_ENGINE` — **một chỗ duy nhất**, để
  tab Nhận diện SKU dùng chung sau này, không sinh bản luật thứ hai.
* Ca bắt buộc trong bộ test: `Width 165cm+3cm` · `58-59inch` · `57"` · `11.7oz` · `Width 1650cm`
  (phải cảnh báo, không nhận thẳng) · tên không có khổ (phải chịu, không đoán).

### P2 · Thun + sổ tay g/m
* Chọn `Thun` → hai đường: **(a)** cân cuộn nguyên + quy cách (m) như chỉ may, **(b)** gõ thẳng g/m.
* Cân xong thì **nhớ g/m theo SKU** vào `localStorage` (khuôn `NDS_SO`), lần sau tự điền + nói rõ
  *"g/m lấy từ sổ tay, cân ngày 23/08"*, kèm nút xoá.
* Mồi sổ tay bằng 12 SKU đã ghi `1kg-6700m` / `22g-260m` trong tên.

### P3 · Vá dữ liệu gốc (việc của kho, không phải của code)
* **Thiếu gsm trong tên**: 300 SKU khai theo chiều dài (230 còn tồn) + 46 SKU khai theo khối lượng
  (32 còn tồn). Xuất danh sách để kho bổ sung vào PRODUCTNAME — mỗi SKU được vá là một SKU quy đổi
  được vĩnh viễn, không phải cân mẫu lần nào. **230 SKU còn tồn** là con số đáng làm nhất ở đây.
* **2 SKU sai `Width 1650cm`** — sửa thành 165cm.
* Nhóm SKU cũ (dãy `3222xxxxx`: *"Vải thun lạnh/Trắng/mét"*) không có thông số nào và tồn = 0 →
  đề nghị bỏ qua, đừng tốn công.

---

## 6. Ba việc cần chốt trước khi code

1. **Ô "tổng cân" nhận kg hay gram?** Đường chỉ may hiện **chỉ nhận gram** (chốt 22/08, ô tổng bỏ
   kg). Vải thì kho cân bằng **kg** (tồn 55 tấn, cuộn vải 20–30kg/cuộn). Đề xuất: giữ ô gram cho
   Chỉ, ô Vải/Thun nhận **kg** và in dòng soi *"= 25.300 gr"* — cùng một kiểu dòng "Đọc là…" đang có.
2. **Kết quả trả về mm hay m?** Luật dự án là *"kết quả luôn mm/gr"* (chốt 22/08). Vải khai mm thì
   đúng, nhưng con số ra dài 8 chữ số (25 kg vải ≈ 63.000 mm). Đề xuất: **ô chính vẫn mm** (để copy
   vào WMS), kèm thẻ phụ đọc m + yard.
3. **Có gắn kết quả vào giỏ kiểm kê không?** Chỉ may hiện chỉ tính rồi copy. Vải khai theo cuộn có
   UID riêng, nên nếu muốn đẩy thẳng vào phiếu kiểm kê thì phải bàn tiếp — P0 cứ để copy như cũ.

---

## 7. Chạy lại phân tích

```
node phan-tich-vai-thun.mjs             # tải mới từ Sheet, cất .sku-master-gviz.json
node phan-tich-vai-thun.mjs --cache     # dùng bản đã cất
node phan-tich-vai-thun.mjs --cache --mau 40    # in thêm 40 tên hàng mẫu mỗi nhóm
```

---

# ĐÃ LÀM — bản chạy 23/08/2026

User chốt 3 câu hỏi ở §6 và thêm một yêu cầu: **ô tổng vẫn nhận GRAM** · **kết quả vẫn ra mm** ·
**không đẩy vào giỏ kiểm kê, nhưng cho đẩy sang In tem SKU như chỉ, kèm ô nhập UIDgr code** (mã group
**in LÊN TEM**) · Thun làm **đủ bộ** (cân cuộn + g/m + sổ tay).

## Một phép chia, ba cái thước — chỗ chèn nằm ở đúng một biến

Tab không phải viết lại. `cdTinh()` trước nay đã quy mọi thứ về `mmTrenG` (1 gram dài bao nhiêu mm);
nay chỉ thêm một bậc trước đó là **`gMet` — gram mỗi mét**:

```
chỉ  : gMet = Tex ÷ 1000              (Tex = gram của 1.000 m)
vải  : gMet = định lượng(g/m²) × khổ(m)
thun : gMet = g/m gõ tay / từ sổ tay
cân  : gMet = (cân cuộn nguyên − lõi) ÷ quy cách(m)      ← luôn được ưu tiên khi có
mmTrenG = 1000 ÷ gMet
```

Kiểm lại đường cũ không đổi một con số nào: `mmTrenG = 1000/(Tex/1000) = 10⁶/Tex` — đúng công thức
đang chạy từ 22/08 (bộ đo `qc-chuyen-doi-can` 38 ca cũ vẫn xanh nguyên).

Bảng `CD_LOAI` là chỗ **duy nhất** khai sự khác nhau giữa 3 loại: tên hàng gọi là gì, khối nhập nào
hiện ra, và **`noi(gMet)` — cách ĐỌC cái thước ra chữ**. Cái cuối quan trọng hơn vẻ ngoài của nó:
dân chỉ may nói *"Tex 27"* chứ không ai nói *"0,027 g/m"* — cùng một con số nhưng nói sai tiếng thì
người dùng không soi lại được với con tem đang cầm. (Bản đầu tôi in tuốt bằng g/m và 2 ca QC của chỉ
may đỏ ngay — đúng chỗ đáng đỏ.)

## Những chỗ khác chỉ may

* **Quy cách cuộn nguyên là TUỲ CHỌN với vải/thun** (chỉ may vẫn bắt buộc): vải quy được bằng
  gsm × khổ mà không cần biết cuộn nguyên dài bao nhiêu. Không có quy cách thì thẻ *"tương đương
  cuộn nguyên"* đổi thành **yard** — số mà NCC vải hay nói.
* **Ô SKU** (không bắt buộc): gõ mã → máy tra danh mục (cache chung với tab Nhận diện SKU, **0 lượt
  mạng**), **tự điền khổ + định lượng từ tên hàng**, tự **chuyển loại hàng** theo tên, và mở đường
  đẩy sang In tem. Tên hàng thiếu số nào thì **nói thẳng là thiếu**, không đoán bừa.
* **Sổ tay g/m cho Thun**: cân 1 cuộn nguyên có quy cách → máy nhớ g/m theo SKU vào `localStorage`,
  lần sau gõ SKU là tự điền kèm ngày đã cân. Có nút xoá sổ tay.
* **Nhắc sai số của vải**: không có cân cuộn nguyên thì kết quả là **ước tính ±5–8%** (gsm dao động
  theo lô nhuộm; khổ trong tên là khổ dùng được còn cân thì cân cả biên tua) — in thẳng ra màn, không
  giấu. Có cả hai thước thì cân là chuẩn, lệch >5% là cờ đỏ nói cả hai con số.

## UIDgr in lên tem — chuỗi đi qua 3 chặng

```
tab Chuyển đổi cân (ô UIDgr)  →  PR.sel[sku].uid  →  hàng đợi GAS (dong[].uid)  →  agent máy in  →  svgTem
```

* **GAS KHÔNG phải deploy lại**: `apiPrThem` chỉ `JSON.stringify(dong)` rồi chuyển tiếp nguyên vẹn,
  không lọc trường nào — đã đọc mã nguồn để chắc, không đoán.
* **Con tem**: dòng `UIDgr <mã>` đứng ngay trên dòng chân. Chỗ cho nó **chỉ được chừa khi có mã** —
  chừa sẵn thì tên hàng bị bóp nhỏ ở **mọi** con tem, kể cả tem chỉ may không bao giờ có group.
* **Pop-up In tem** hiện chip `UIDgr …` dưới tên hàng, có nút × để gỡ. Cố ý **không** cho sửa mã ở
  đây: một chỗ nhập duy nhất (tab Chuyển đổi cân), khỏi hai đường sinh ra hai mã khác nhau.
* Mã thật là dãy **16 chữ số** (vd `1028260605000316`, lấy từ `doi-soat-po-uidgr.csv`). Ô nhập chỉ
  **nhắc** khi nhìn không giống, **không chặn cứng** — mã do máy chủ WMS sinh, không có gì bảo đảm
  định dạng đó bất biến.

⚠ **PHẢI LÀM KHI TRIỂN KHAI — và chỗ này suýt sai**: máy in `Desktop-JE75K38` **không chạy từ repo**.
Nó chạy từ **gói chép tay** `hasaki/_GOI-MAY-IN/` (có `node.exe` + `node_modules` + **bản sao
`factory/index.html`**, xem `CO-CHO-MAY-IN.md`) — thư mục này nằm trong `.gitignore` nên `git pull`
trên máy đó **không đổi được gì**. Đúng đường là:

```
node TAO-GOI-MAY-IN.mjs          # dựng lại gói (đã chạy 23/08 — gói hiện có cả uid + dòng UIDgr)
   → chép cả hasaki\_GOI-MAY-IN\ sang máy in (vd C:\AuditFactory) → chạy lại task agent
```

Không chép gói thì **dashboard hiện chip UIDgr mà tem ra giấy vẫn không có dòng nào** — đúng loại
lệch mà không ai nhìn màn hình phát hiện được. Thử trước khi giao:

```
node in-tem-agent.mjs --thu "422440680" --uidgr 1028260605000316    # xem ảnh tem, không tốn tem
```

**Ba chỗ phải sửa cho `uid` đi hết đường** (đã sửa cả ba, ghi lại vì cùng một cái bẫy lặp ba lần):
`moRong` của lõi tem · `dongCoTen`/`conTem` của agent · **`anhTem()` — chỗ agent DỰNG LẠI `d` để gọi
`ve()`**. Chỗ thứ ba là chỗ đã cắn hồi 20/08 (agent gọi tắt `svgTem` nên mất phần dịch trái 2mm) và
lại cắn lần nữa hôm nay: sửa xong hai chỗ đầu, chạy `--thu` thì tem **vẫn không có dòng UIDgr**.

## Đo

* `qc-chuyen-doi-can` **54/54** (38 ca cũ + 16 ca mới: đổi loại hàng · tự điền khổ/định lượng · khổ
  ghi bằng inch · tên thiếu định lượng phải nói thẳng · toán vải · quy cách tuỳ chọn · toán thun + sổ
  tay + nhớ qua F5 · đẩy In tem + UIDgr có trong SVG tem + chip trong pop-up · khoá nút khi chưa có
  SKU · đối chứng chéo vải). Mạng vẫn **bị chặn sạch** — tab phải chạy được khi thủ kho mất mạng.
* `qc-in-tem` **142/142** (thêm 4 ca dòng UIDgr: có mã thì in ra · KHÔNG có mã thì tem giống HỆT bản
  cũ · có mã thì tên hàng nhường chỗ thật · mã dài quá khổ thì CẮT chứ không tràn mép) · `qc-in-tem-popup` 46/46 · `qc-tab-nhan-dien` 161/161 · `qc-nhan-dien-sku`
  110/110 · `qc-chimuc-cat-san` 20/20 · `qc-mobile-toan-du-an --file --trang=factory` (thêm 2 màn
  mới: *thước Vải*, *thước Thun*; màn Pop-up In tem nay có sẵn một dòng mang UIDgr để đo luôn chip).
* **Bẫy của BỘ ĐO ĐIỆN THOẠI (nặng nhất)**: hai màn mới bị `○ BỎ QUA: tab chưa vẽ xong dữ liệu` ở
  **cả 4 máy** mà tổng kết vẫn xanh — tức lời hứa "đã đo màn Vải/Thun" là **giả**. Gốc: `sanSangMan`
  viết `/\d/` trong chuỗi nháy kép JS, mà `"\d"` co lại thành `"d"` ⇒ điều kiện thành `/d/.test("60,606 mm")`
  = false vĩnh viễn. Trong chuỗi phải viết **hai dấu gạch chéo ngược** (`\\d`) như mọi màn cũ vẫn
  viết. Sau khi sửa: **89 màn × 4 máy đạt**, và hai màn mới CÓ TÊN trong tổng kết — đó mới là bằng
  chứng đã đo. (`○ bỏ qua` không bao giờ là `✓`.)
* **Ba bẫy đã dính khi viết bộ đo** (ghi lại kẻo lặp): ① số kỳ vọng viết nhầm **1.000 lần** —
  24 kg vải khổ 1,8m/220gsm ra **60.606 mm** (60,6 m) chứ không phải 60.606.061 mm; máy đúng, test
  sai. ② gán `CD.kho=180` mà để ô "Khác…" rỗng là **trạng thái không có thật** (khổ 180 không nằm
  trong 3 chip nên nó phải nằm ở ô gõ) — test đo trúng cái trạng thái ma đó rồi báo đỏ oan.

## Còn lại (chưa làm)

* **P3 vá dữ liệu gốc**: 230 SKU vải còn tồn thiếu gsm trong tên + 2 SKU ghi sai `Width 1650cm`.
  Đây là việc sửa PRODUCTNAME trên WMS, không phải việc của code.
* Chưa gắn kết quả vào **giỏ kiểm kê** (user chốt: không làm).
