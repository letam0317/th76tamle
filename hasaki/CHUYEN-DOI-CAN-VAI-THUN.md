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

## Bổ sung 23/08 (user báo): quy cách phải là quy cách CỦA LOẠI HÀNG ĐÓ

*"Ở mục Thun cần hiển thị đúng số đơn vị độ dài của các SKU thun, ví dụ 1kg-6700m, chứ không phải
lấy chỉ số của chỉ (2.500 / 3.000 / 5.000 m)."*

Đúng, và nó tệ hơn vẻ ngoài: hàng chip quy cách chôn cứng ba con số của CHỈ MAY, mà chip **5.000 m
vẫn SÁNG** khi chuyển sang Thun/Vải — tức máy lặng lẽ tính bằng cuộn chỉ 5.000 m cho một cuộn thun.

**① Chip quy cách nay ĐẾM TỪ DANH MỤC theo từng loại** (cùng nguồn cache với chip Tex, 0 lượt mạng),
sau khi **bóc bỏ hệ số cân↔dài** khỏi tên — `1kg-6700m` có chữ "6700m" nhưng đó là TỈ LỆ CÂN, không
phải chiều dài một cuộn; nhận nhầm là sai hàng nghìn lần:

| Loại | Chip hiện ra | Vì sao |
|---|---|---|
| Chỉ | 2.500 · 3.000 · 5.000 m | giữ nguyên bản user chốt 22/08 (trùng nhóm đầu bảng: 5.000m có 343 SKU) |
| Thun | **100 m** | cả danh mục Thun chỉ có đúng một quy cách ghi trong tên |
| Vải | *(chỉ còn "Khác…")* | **không SKU vải nào** ghi quy cách cuộn |

Đổi loại mà quy cách cũ không còn trong danh sách ⇒ **bỏ chọn**, chuyển sang ô gõ tay. Thà để trống
còn hơn mượn số của mặt hàng khác.

**② Đọc luôn hệ số cân↔dài ghi sẵn trong tên hàng** (`NDS_ENGINE.heSoCan`) — 4 kiểu viết có thật,
đếm trên cả 8.143 dòng: `22g-260m` (10) · `1kg-6700m` (2) · `7m 1kg` (2) · `6300m - 1kg` (1).

* **Thun**: gõ SKU → ô g/m tự điền, dòng soi nói đúng chữ của tem: *"tên hàng ghi **1 kg = 6.700 m**
  → 0,149 g/m"*. Thứ tự tin: **sổ tay (đã cân thật) > hệ số trong tên** — có cả hai thì lấy cân
  nhưng vẫn in ra cả hai số.
* **Vải**: chỉ để SOI, **không tự dùng**. Đo thật thấy hai số chọi nhau: SKU 422462136 ghi *"Mỏng 7m
  1kg"* (143 g/m) trong khi *"228gsm, W160cm"* ra 365 g/m — **lệch 2,6 lần**. Máy không có quyền
  chọn hộ; nó in cả hai kèm cảnh báo *"chọi với định lượng… kiểm lại trước khi tin"*.

**Đo thêm:** `qc-chuyen-doi-can` **61/61** (+7 ca: 3 ca chip theo loại · 1 ca đổi loại phải bỏ quy
cách của chỉ · 2 ca lõi `heSoCan` gồm cả ca *"Cuộn 5000m là QUY CÁCH, không phải hệ số"* · 1 ca Thun
tự điền g/m từ tên).

## Dựng lại bố cục bước 1 (23/08 tối, user duyệt màn hình)

Bốn ý user nêu, không ý nào là chuyện thẩm mỹ suông:

**① "1 bên dài sọc, 1 bên trống quá nhiều".** Bước 1 xếp mỗi ô một hàng nên cột trái dài gấp đôi
cột phải. Nay ô nào **giá trị NGẮN thì đi cặp**: `Mã SKU | UIDgr` · `Tổng khối lượng | Số cuộn` ·
`Khối lượng lõi | Cuộn nguyên` (điện thoại vẫn 1 cột — 2 ô cạnh nhau ở 390px là bóp cả hai).
Cột phải thì: **panel bám theo khi cuộn** + **4 thẻ MỜ giữ chỗ** đúng chỗ 4 con số sắp hiện, nên
lúc chưa đủ số nó không còn là mảng trắng.

**② "Chip nhập chỉ số không để thừa đơn vị kế bên ô chip".** Trước đây một đơn vị hiện **ba lần**:
trên từng chip ("150 cm"), ở ô nhập ("cm"), và trong dòng soi. Nay đơn vị nằm **đúng một chỗ** — chip
ĐVT cạnh ô nhập — còn chip số là **số trần**: `150 · 152 · 190` và `2,500 · 3,000 · 5,000`.

**③ "Số đã có sẵn phải phân biệt được với số phải nhập" (bỏ làm mờ, không thêm chữ).**
Phân biệt bằng HÌNH: ô **máy tự điền** → nền accent nhạt + viền accent + **dấu ✓ trong ô**; ô **còn
phải nhập** → **viền nét đứt**. Gõ đè lên số máy điền thì dấu ✓ mất ngay — lúc đó nó là số của người
dùng, không phải của máy.

**④ "Khổ vải ghi bằng inch thì sao?"** Chip ĐVT có **mũi tên sổ xuống**, bấm để đổi `cm ⇄ inch`
(và quy cách `m ⇄ yard`). Đây là đường thật chứ không phải tiện ích cho vui: danh mục có **92 SKU
ghi khổ bằng inch** và **85 SKU vải khai bằng yard**; bắt thủ kho tự nhân 2,54 hay 0,9144 trước khi
gõ là mời gọi sai số. Máy vẫn tính bằng cm/mm như cũ, chip chỉ đổi cách NGƯỜI GÕ.

**Và một lỗi thật lộ ra khi soi ảnh chụp:** mật độ của vải là số nhỏ (2,469 mm/gr) mà đang làm tròn
0 chữ số, nên phiếu tính đọc ra `23,400 gr × 2 mm/gr = 57,778 mm` — ai cầm máy tính kiểm lại cũng ra
46.800 rồi kết luận máy tính sai. Phiếu tính mà không lần lại được bằng tay thì mất sạch công dụng.
Nay số lẻ theo độ lớn: ≥100 → 0 số lẻ (chỉ may 37.037) · ≥10 → 1 · nhỏ hơn → 3.

**Đo:** `qc-chuyen-doi-can` **70/70** (+9 ca: cặp hai-ô-một-hàng · nhãn đã bỏ câu dài · chip số trần
+ đơn vị một chỗ · đổi cm⇄inch và kết quả đổi theo · dòng soi nói ra bao nhiêu cm · dấu ô máy điền ·
dấu ô còn phải nhập · gõ đè thì mất dấu · **phiếu tính phải lần lại được bằng tay**) ·
`qc-mobile-toan-du-an --file` 89 màn × 4 máy · `qc-tab-nhan-dien` 161/161 · `qc-in-tem-popup` 46/46.

**Bẫy của bộ đo lần này**: trang in số kiểu en-US (phẩy = hàng nghìn, chấm = thập phân) mà bộ đo bóc
số lại xoá mọi dấu đứng trước 3 chữ số ⇒ `2.469` thành `2469`, sai 1.000 lần và báo đỏ oan.

## Ẩn khối "Mã SKU · UIDgr code" (23/08 tối, user: "cải tiến ẩn mục này")

Hai ô đó **không bắt buộc**: chúng chỉ tra hộ quy cách/Tex/khổ/định lượng từ danh mục, còn người
đứng cân tại chỗ phần lớn gõ thẳng số cân. Để mở sẵn thì mắt phải lướt qua **hai ô trống** trước khi
tới việc chính, mà chúng lại đứng ngay đầu bước 1.

Nay khối gấp lại thành **một dòng `▸ Mã SKU · UIDgr code`** (cao 32px thay vì ~160px), dùng đúng
khuôn gấp sẵn có `details.nds-more` của dự án chứ không đẻ nút xổ riêng. Bốn luật đi kèm — mỗi luật
sinh ra từ một cách làm sai đã gặp:

* **Tự bung khi có sẵn mã** (giá trị nhớ lại / vừa tra ra). Gấp mất một ô **đang có dữ liệu** là giấu
  thông tin — bẫy đã dính ở tab khác.
* **Gấp mà vẫn thấy mã**: đang gấp thì summary nhắc lại `SKU 422273473 · UIDgr 1028…` bằng chữ màu
  accent. Gấp rồi giấu luôn cái đã nhập là bắt người mở ra chỉ để nhớ.
* **Tôn trọng cú gấp tay**: người tự gấp trong lúc đang có mã thì lượt gõ sau không bung lên lại.
  Chỉ nhớ ý đó khi **có** mã — nếu không, cú gấp tự động lúc "Lô tiếp theo" bị hiểu nhầm là ý người.
* **Không sập dưới tay**: xoá sạch mã thì gấp về, TRỪ khi con trỏ còn nằm trong khối — xoá hết chữ để
  gõ lại mà khối tự sập là cướp ô đang gõ (bẫy *"dọn ô trước khi vẽ lại"* ở màn In tem).

**Đo:** `qc-chuyen-doi-can` **74/74** (+4 ca ở mục 12f, đúng bốn luật trên) ·
`qc-mobile-toan-du-an --file --trang=factory`.

**Bẫy của bộ đo lần này:** `<details>` đóng **vẫn chừa hình chữ nhật** cho ô con (Edge giữ layout,
chỉ thôi vẽ), nên `getBoundingClientRect()` và `offsetParent` đều nói "có" — ca đo bố cục cặp
hai-ô-một-hàng vì thế **xanh trên thứ không ai thấy**. Muốn biết mắt có thấy hay không phải hỏi
`checkVisibility()`; ca đo bố cục nay tự bung khối ra trước khi đo.

## Dọn bước 1 lần hai (24/08, user nêu 6 điểm)

**① Một khuôn cho mọi ô có gợi ý.** Nhãn và ô nhập **ngang hàng**, dải chip xuống dưới mở đầu bằng
chữ **"Gợi ý:"**. Áp cho cả bốn ô có chip: quy cách · Tex · khổ vải · định lượng.

**④ Hết chip "Khác…".** Chip đó chỉ để mở một ô đang ẩn; nay ô nhập lúc nào cũng ở đó nên nó thành
chữ không dẫn tới đâu — user nói thẳng: *"buộc nhập vào ô rồi thì thể hiện chữ Khác… ở đó làm gì?"*.
Không có gợi ý nào (quy cách của **vải**: không SKU nào ghi) thì **ẩn hẳn cả dòng**.

Đổi này dọn luôn ba cờ `tuDo / texTuDo / khoTuDo` trong lõi: trước đây mỗi hàng chip có một ô nhập
**tàng hình**, đọc code phải hỏi "số đang tính nằm ở chip hay ở ô?", và bẫy thật đã dính một lần —
hàm tự điền gọi `cdChonKho` (hành vi của ngón tay: bấm lại chip đang sáng = bỏ chọn) làm khổ của SKU
thứ hai biến mất không một lời nào. Nay **một nguồn số duy nhất là ô nhập**; chip chỉ điền hộ, bấm
lại chip đang sáng = xoá ô. Số điền sẵn (quy cách hay gặp nhất: chỉ 5.000 m · thun 100 m) mang dấu
**✓ máy điền** nên nhìn là biết máy đoán, gõ đè được.

**③ Đơn vị vào TRONG ô.** `gr · cuộn · Tex · gsm · g/m` nay nằm sát mép phải **bên trong** ô, số chạy
trước nó — đọc liền một mạch "9,500 gr". Hai đơn vị **đổi được** (khổ `cm ⇄ inch` · quy cách
`m ⇄ yard`) cố ý vẫn là **nút cạnh ô**: chúng là vùng chạm thật, nhét vào trong ô thì cao chưa tới
30px — dưới sàn 40px của luật điện thoại.

**⑤ Khổ + định lượng gợi ý theo TẦN SUẤT thật.** Trước đây khổ chôn cứng `150/152/190` và định lượng
không có gợi ý nào. Nay cả hai đếm từ chính danh mục vải (972 SKU, đo 24/08):

| | nhiều nhất | rồi | rồi | tổng số giá trị |
|---|---|---|---|---|
| khổ (cm) | 150 — 122 SKU | 152 — 96 | 190 — 66 | 53 |
| định lượng (gsm) | 160 — 57 SKU | 220 — 42 | 170 — 40 | 75 |

Ba chip đầu là chỗ với tay nhanh; phần đuôi tản mát gõ thẳng vào ô. Không có danh mục (offline lượt
đầu) thì khổ rơi về 3 số quen, định lượng ẩn dòng gợi ý.

**⑥ Ô nào có ở loại nào.** Vải **không** có *"Số cuộn thừa"* lẫn *"Khối lượng 1 lõi"* (vải trả về là
một tấm, không cuốn lõi); thun **không** có *"Số cuộn thừa"*. Ẩn thì máy tự hiểu — vải/thun tính như
**1 cuộn**, vải tính **lõi 0 gr** — chứ không bỏ trống phép tính. Kéo theo ba chỗ phải dọn: ô còn lại
của cặp trải hết bề ngang, nút *"cân cả lõi / riêng hàng"* ẩn cùng lõi, phiếu tính bỏ hai bước trừ
lõi (in "− 0 gr" rồi "còn lại 25.000 gr" là hai dòng không nói gì). Thẻ **"Trung bình 1 cuộn thừa"**
cũng bỏ ở vải/thun — với một cuộn nó nói lại đúng con số ở thẻ đầu; chỗ đó thành **Quy ra yard**.
Và cờ đỏ *"dài hơn cả cuộn nguyên"* hạ thành **dòng nhắc** cho vải/thun: cân nhiều tấm một lượt là
chuyện thường ngày, báo đỏ ở đó là **báo oan**.

**② Có sổ cân rồi thì đừng hỏi lại.** Chỉ may: gõ SKU → máy tra **sổ cân CAN-LOI-CHI** theo nhãn +
cỡ + quy cách. Có số thì **ẩn hai ô** *Khối lượng 1 lõi* / *Khối lượng 1 cuộn nguyên*, thay bằng một
dòng nói rõ nguồn: *"lấy từ sổ cân CAN-LOI-CHI (Irisa · Tex 27 · cuộn 5.000 m): lõi **14 gr** · cuộn
nguyên **171,5 gr** → mỗi cuộn còn **157,5 gr** chỉ"* kèm nút **"Cân lại cuộn này"** để gõ tay khi
cần. Chưa có số thì hỏi như cũ. Dùng lại nguyên khối `CL` (`clNap` / `clTim`) mà pop-up *Cân → Số
lượng* đang dùng — cùng một sổ, cùng một cách khớp nhãn, không đẻ đường đọc thứ hai để rồi hai nơi
khớp lệch nhau. **Quy cách điền kèm luôn**: cặp (lõi, cuộn nguyên) chỉ có nghĩa với đúng cuộn dài
`met` mét — điền cân mà để nguyên quy cách của lô trước là ra mật độ sai.

**Đo:** `qc-chuyen-doi-can` **94/94** (+17 ca: khuôn ô ⟷ nhãn ⟷ "Gợi ý:" · điền sẵn quy cách phổ
biến · chỉ→vải→chỉ phải điền lại · gõ ngoài dải gợi ý · đơn vị trong ô (7 ô) · hai đơn vị đổi được
vẫn là nút · gợi ý khổ/định lượng theo tần suất + bấm chip điền vào ô · đường lùi offline · ẩn/hiện
ô theo 3 loại hàng · không báo đỏ oan · sổ cân: ẩn 2 ô + điền đúng quy cách + toán 313.015.873 mm +
"cân lại"/"dùng lại" + nhãn chưa cân) · `qc-mobile-toan-du-an --file --trang=factory` 93 màn × 4 máy ·
`qc-in-tem-popup` 46/46 (pop-up Cân → SL vẫn đọc đúng khoá `loi` trong `cd-quycach`) ·
`qc-chu-thich` 26/26 — trong đó **sửa một ca đỏ vĩnh viễn có từ bản đang phát**: dòng `#cdState`
*"Còn thiếu: …"* bị bộ dò văn xuôi bắt vì dài 105 ký tự, nhưng nó đúng là **thông báo trạng thái**
(chỉ hiện khi số liệu chưa đủ) nên đã thêm vào danh sách miễn trừ; đã đối chứng bản HEAD ra **cùng
một dòng** để chắc chắn không phải lỗi mới.

**Ba bẫy của đợt này**

1. **Bộ đo chớp tắt 1/3 lượt chạy.** Trang có `ndsHamNong()` tự nạp danh mục lúc máy rảnh (chậm
   nhất 2,5 giây). Mục 12d *reload trước rồi mới seed danh mục*, nên có lượt cú hâm nóng đọc **cache
   cũ của mục trước** rồi gán vào `NDS.ds` — mà `cdDanhMuc()` ưu tiên `NDS.ds` hơn cache ⇒ gõ SKU vải
   nhận *"không thấy mã này trong danh mục"*, trượt 11 ca một cách ngẫu nhiên. Chữa: **seed trước,
   reload sau** (đúng nếp mục 12c) + chốt hạ bỏ `NDS.ds` nếu nó không phải danh mục vừa dựng.
2. **"Điền một lần cho mỗi loại hàng" là sai.** Bản đầu chống nhồi số bằng cách nhớ đã điền cho loại
   nào; đi **chỉ → vải → chỉ** thì lượt về để ô trống không một lời nào, kết quả tụt về *"còn thiếu
   quy cách"* giữa lúc đang cân. Luật đúng: điền ở **mọi lượt đổi loại hàng** khi ô trống, còn lượt
   *"danh mục vừa về"* thì không điền (người dùng có thể đang gõ dở, nhồi số vào là giật tay họ).
3. **Ba ca cũ đo trạng thái đã biến mất** (`CD.kho`, `CD.khoTuDo`, chip `data-mm`) nên phải viết lại
   theo hợp đồng mới; và ca đo bố cục cặp *tổng ⟷ số cuộn* phải **tự đứng về loại chỉ** — từ 24/08
   vải/thun không còn ô số cuộn, tin trạng thái còn sót của mục trước là đo một cặp chỉ có một ô.

## Đợt 2 cùng ngày (24/08, user soi màn hình lần nữa — 3 điểm)

**① Bỏ dòng "Đọc là 5,000 m = 5,000,000 mm mỗi cuộn nguyên".** Số đang nằm ngay trong ô, còn mm thì
phiếu tính bên phải đã lần lại từng bước — dòng đó chỉ nhắc lại. Giữ đúng một việc: gõ chữ không ra
số thì vẫn báo đỏ (`cdSoiLoi`), kỉo máy lặng lẽ tính bằng số cũ.

**② Nhãn "Quy cách cuộn nguyên" / "Định lượng dài" nhạt hơn nhãn khác** — lỗi thật do đợt 1: nhãn dời
vào `.cd-hd` nên `.cd-f>label` (đậm 700) **không còn khớp**. Nay selector nhận cả hai; bộ đo canh bằng
`font-weight` thật của cả 7 nhãn, không tin mắt.

**③ Dải gợi ý lên NGANG HÀNG tên mục** (kể cả cụm *"cân cả lõi / riêng hàng"* của ô cuộn nguyên).
Kéo theo bốn việc:
* **Lõi + cuộn nguyên thôi đi cặp** — nhét nhãn + cụm nút + ô nhập vào nửa hàng 250px là bóp cả ba.
* **Cột bước 1 rộng thêm** (`5fr/7fr` → `11fr/13fr`): cột 500px chỉ đủ nhãn + ô nhập, ba số gợi ý bị
  gom hết vào "Khác…" — tức mất đúng thứ cần thấy. Cột kết quả vẫn xếp 3 thẻ một hàng.
* **Chip gợi ý gọn lại** (cao 28px, chữ 11,5px) và **gom phần thừa vào chip "Khác…"** đúng như user
  chốt: `cdVuaMotDong` đo THẬT `scrollWidth > clientWidth` rồi ẩn dần chip cuối; bấm "Khác…" mở nốt.
  Hết chip mà vẫn tràn thì bỏ luôn chữ "Gợi ý:" — chip bị cắt mất chữ là phạm luật nhãn.
* **Điện thoại**: gợi ý VẪN ngang hàng tên mục, còn **ô nhập xuống dòng riêng** — nhãn + gợi ý + ô
  nhập không có cách nào vừa 330px. Ở bề ngang này chip được xuống dòng (không gom vào "Khác…"):
  thà hai hàng chip còn hơn ăn mất số gợi ý sau một chip.

**Bẫy đắt nhất đợt này:** ô nhập nở **252px** dù CSS ghi `flex:0 0 136px` — `<input>` có bề rộng nội
tại ~177px (mặc định `size=20` ký tự) nên **min-content của `.cd-in` đẩy flex-basis lên**, ăn hết chỗ
của dải gợi ý và làm chip bị gom vào "Khác…" oan. Chữa bằng `min-width:0` cho cả `.cd-in` và ô nhập
bên trong. Nhìn ảnh chụp thì tưởng "chật thật"; phải đo `getComputedStyle` + `getBoundingClientRect`
mới thấy nguyên nhân — cùng họ với bẫy `1fr` trần đã dính 22/08.

**Đo lại:** `qc-chuyen-doi-can` **100/100** (+6 ca: gợi ý cùng hàng nhãn · đã bỏ dòng "Đọc là" · vẫn
báo khi gõ chữ · nhãn đậm bằng nhau · gom chip vào "Khác…" · bấm "Khác…" mở nốt) ·
`qc-mobile-toan-du-an --file --trang=factory`.

## Đợt 3 cùng ngày (24/08, user: "sao trống dữ" · "cần cân đối / chuyên nghiệp")

**Ba nút Chỉ · Vải · Thun** lên ngang hàng nhãn *Loại hàng* — cùng khuôn với dải "Gợi ý:".

**Hết xếp cặp hai-ô-một-hàng ở khối số cân.** Đợt 2 tôi bỏ cặp *lõi ⟷ cuộn nguyên* (vì cụm
*"cân cả lõi / riêng hàng"* lên hàng tiêu đề) nhưng vẫn giữ cặp *tổng ⟷ số cuộn* — thành ra nửa trên
là hai ô sát nhau, nửa dưới là hai hàng có một khoảng trống giữa nhãn và ô. Đó chính là chỗ user chỉ
ra. Nay **mọi ô một hàng, mép phải các ô nhập thẳng một cột**: đọc như một biểu mẫu, không còn ô nào
lệch. Nhịp dọc thắt lại (`.cd-f` 12→10px, `.cd-doc` 4→3px) cho khỏi loãng vì thêm hàng.

Cách đo "cân đối" bằng SỐ (không bằng mắt): lấy `getBoundingClientRect().right` của mọi
`.cd-hd>.cd-in:not(.seg)` đang hiện, **lệch > 1px là trượt**. Ca này bắt được ngay chuyện lẫn cặp
với không-cặp — thứ mà ảnh chụp nhìn qua rất dễ bỏ sót.

**Đo lại:** `qc-chuyen-doi-can` **102/102** (+2 ca: nút Loại hàng ngang hàng nhãn · mọi ô nhập thẳng
một cột; 2 ca cũ đo cờ `.mot` của lối xếp cặp đã viết lại theo hợp đồng mới) ·
`qc-mobile-toan-du-an --file --trang=factory`.

## Còn lại (chưa làm)

* **P3 vá dữ liệu gốc**: 230 SKU vải còn tồn thiếu gsm trong tên + 2 SKU ghi sai `Width 1650cm`.
  Đây là việc sửa PRODUCTNAME trên WMS, không phải việc của code.
* Chưa gắn kết quả vào **giỏ kiểm kê** (user chốt: không làm).
