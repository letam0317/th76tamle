# TỰ CHỮA LÀNH & THƯ CẢNH BÁO — nguồn duy nhất

> Dựng 12/08/2026. Mục tiêu: hệ chạy tiếp và **gọi đúng người** khi WMS / HR / planogram đổi,
> không cần ai ngồi canh, không phụ thuộc trợ lý AI nào.

## Vì sao có tầng này

Sự cố mở mắt: bước **chấm công** chết từ 26/07/2026 vì IdP đổi giao diện. Suốt **16 ngày**:
Task Scheduler vẫn chạy đúng giờ, vẫn báo `Result: 0`, dashboard vẫn hiện số — nhưng là số cũ.
Không ai biết.

Ba nguyên nhân, đã bịt cả ba:

| Nguyên nhân | Bịt bằng |
|---|---|
| `Result: 0` không chứng minh thành công (mã thoát bị `.bat`/`.vbs` nuốt) | Mốc ghi thành công `.sync-ok-<bước>` + `canh-suc-khoe.js` |
| Bước ngoài cụm thì watchdog không vá hộ | Danh sách `BUOC_NGOAI_CUM` canh riêng |
| Hỏng rồi không ai được báo | Sổ sự cố + thư cảnh báo gửi từ Apps Script |

**Định luật rút ra:** cùng một API HR, script **tự đăng nhập thì chết**, script **mượn phiên
người thật thì sống** (`sync-vesinh-all.js` vẫn lấy chấm công bình thường suốt 16 ngày đó).
Mọi cải tiến sau này nên đi theo hướng bỏ tự-đăng-nhập, không phải vá luồng đăng nhập.

## Kiến trúc

```
Tầng 0  CẢM BIẾN      phân loại lỗi · baseline số dòng · hợp đồng cột · mốc từng bước
Tầng 1  TỰ CHỮA CÂM   chặn ghi rác · giải trường mềm · pool địa chỉ · đổi nguồn token (đã có)
Tầng 2  BÁO NGƯỜI     sổ sự cố trên GAS → thư cảnh báo → nút bấm mở cửa sổ đăng nhập
Tầng 3  HẠ CẤP KÊNH   (chưa dựng) api → passive → export → cache, kèm banner "đóng băng"
Tầng 4  VIỆC CỦA NGƯỜI  đăng nhập passkey · lịch planogram bị huỷ · máy tắt
```

## File

| File | Vai trò |
|---|---|
| `tu-chua.js` | Thư viện: `phanLoaiLoi` · `kiemTruocKhiGhi` · `xacNhanDaGhi` · `layTruong` · `thuNhieuDiaChi` · `moSuCo`/`dongSuCo` · `nhipTim` |
| `canh-suc-khoe.js` | Đồng hồ chết phía máy trạm: soát mốc từng bước + cầu dao đăng nhập |
| `google-script-TuChua.gs` | Sổ sự cố + khuôn thư + đồng hồ chết phía Google (`tcCanhNhipTim`) |
| `.baseline-tu-chua.json` | Lịch sử số dòng đã được chấp nhận (14 mẫu/nguồn) — **không commit** |
| `.canh-suc-khoe.json` | Trạng thái lượt trước, để không gọi GAS thừa — **không commit** |
| `.dia-chi-hoc.json` | Địa chỉ API đã dò được sau khi WMS đổi endpoint — **không commit** |

Đấu nối: `sync-guard.js` (gọi cuối mỗi tick) · `sync-tonbatthuong.js` (cổng chặn ghi rác) ·
`pull-timesheet.js` (ghi mốc `chamcong`).

## Kích hoạt — 3 bước, làm 1 lần

```
1) cd hasaki\.clasp-deploy && clasp push && clasp deploy -i <DEPLOY_ID>
2) Mở editor Apps Script → chạy tay tcTaoTrigger()    (tạo trigger canh nhịp tim mỗi giờ)
3) Mở editor Apps Script → chạy tay tcThuNghiem()     (gửi 4 thư mẫu để xem thật)
```

Chưa deploy thì mọi lời gọi từ Node **tự im lặng bỏ qua** — `tu-chua.js` probe `caps.tuChua`
trước khi POST, đúng luật đã ghi trong `session-rules.js` (GAS bản cũ gặp action lạ sẽ ghi rác
vào sheet 5S).

Kiểm tra bất cứ lúc nào, không gửi thư: `node canh-suc-khoe.js --xem`

## Thư gửi khi nào

| Kịch bản | Loại | Mức | Nhắc lại |
|---|---|---|---|
| Máy trạm im quá 3 giờ trong giờ làm | `MAY_TRAM_IM` | 🔴 | 1 · 3 · 7 ngày |
| Cầu dao đăng nhập ngắt (≥3 lượt IdP từ chối) | `DANG_NHAP_TAY` | 🔴 | 1 · 3 · 7 ngày |
| Một bước không ghi được > 26 giờ | `BUOC_DUNG` | 🔴 | 1 · 3 · 7 ngày |
| Số dòng tụt > 50% so với trung vị / sai hợp đồng cột | `DU_LIEU_LECH` | 🟠 | 1 · 3 · 7 ngày |
| Mất quyền một nguồn, không có đường thay thế | `MAT_QUYEN` | 🟠 | 1 · 3 · 7 ngày |
| Bảng mới chưa được cấp phép ghi | `CHO_CAP_PHEP` | 🔵 | 7 · 14 · 28 ngày |
| Dữ liệu chảy lại | thư đóng | 🟢 | — |

**Không gửi thư** khi hệ tự chữa được: đổi địa chỉ API (dò pool), bị siết nhịp (backoff),
bị đá phiên (đổi nguồn token), token hết hạn (mượn bridge).

Ba luật viết thư, giữ nguyên khi thêm kịch bản:
1. Không một từ kỹ thuật — mã sự cố để ở chân thư, dùng khi chuyển tiếp cho người sửa code.
2. Luôn nói cái **không** hỏng ngay cạnh cái hỏng — thấy thư đỏ dễ tưởng sập hết.
3. Mỗi việc kèm thời gian ước tính.

## Vì sao thư gửi từ Google, không từ máy trạm

Kịch bản tệ nhất là **máy trạm tắt** — lúc đó chính nó không thể gửi thư báo là nó đã tắt.
Nên máy trạm chỉ đẩy **nhịp tim** lên GAS; `tcCanhNhipTim()` chạy trên máy chủ Google mỗi giờ,
thấy im quá 3 tiếng trong giờ làm là tự gửi thư đỏ. Đây là đường **duy nhất** bắt được ca đó.

## Thêm một kịch bản mới

Sửa đúng một chỗ: thêm mục vào `tcSoLoai_()` trong `google-script-TuChua.gs` (màu, tiêu đề,
đoạn "vì sao", các bước, nút bấm), rồi gọi `moSuCo({ loai: 'TÊN_MỚI', ... })` từ Node.

## Cổng chặn ghi rác — luật quan trọng nhất

`kiemTruocKhiGhi()` chạy ngay trước khi POST `syncTasks`. Trượt thì **không ghi**, giữ nguyên
dữ liệu cũ trên Sheet và gửi thư 🟠.

- Baseline cần ≥ 5 mẫu; nguồn < 20 dòng thì bỏ qua luật (nhiễu).
- **Chỉ ghi mẫu baseline khi lượt đó được chấp nhận.** Ghi cả lượt tụt thì trung vị trôi dần
  xuống, vài ngày sau 12 dòng thành "bình thường" và cảm biến tự vô hiệu hoá.
- Ghi đè 2.389 dòng đúng bằng 12 dòng rác tai hại hơn nhiều so với đứng im một hôm.

## Còn thiếu — xếp theo giá trị

1. **Snapshot phát hành lại được.** Cache hiện là *tăng dần*, không phải bản chụp → chưa
   rollback được sau khi lỡ ghi. Đây là điều kiện để dám mở rộng tự chữa.
2. **Banner "đóng băng" trên dashboard** — đã có chip `apiAt`, thiếu trạng thái
   "nguồn X ngừng cập nhật từ …". Tự chữa mà không hiện nguồn đang dùng = tự nói dối.
3. **Cổng chặn ghi rác cho 4 bước còn lại** (mới đấu vào `sync-tonbatthuong.js`).
4. **Bỏ tự-đăng-nhập ở `pull-timesheet.js`** — chuyển sang mượn token `wshr` như
   `sync-vesinh-all.js`. Đây là bản vá đắt giá nhất: xoá luôn 2 kịch bản khó nhất.

## Giới hạn thành thật

Không có kiến trúc nào tự chữa được khi tổ chức đổi quyết định: IdP chuyển sang passkey,
hay bộ phận huỷ lịch planogram. Mục tiêu ở đây không phải "không bao giờ cần người" —
mà là **không bao giờ hỏng trong im lặng**, và khi cần người thì gọi đúng người, đúng một nút bấm.
