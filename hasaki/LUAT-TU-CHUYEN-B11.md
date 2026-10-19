# LUẬT TỰ CHUYỂN B1 → B1.1 (WF591) — máy đọc thông tin ở B1 rồi tự mở B1.1

> Tệp này là **bản đồ một trang**: phiếu nào máy tự chuyển, phiếu nào chờ bạn quyết, máy chuyển bằng cách nào.
> Nội dung chi tiết từng luật KHÔNG chép lại ở đây — nguồn duy nhất:
> - Luật + án lệ: `quy-tac-xac-minh-b1.json` (hiện ở g-sheet tab **QUY TẮC XÁC MINH**)
> - Bạn duyệt luật nào cho máy tự làm: `.exports/quy-tac-duyet.json` (máy chép từ cột «Bạn duyệt» trên sheet)
> - Lịch chạy: `LICH-VA-DU-PHONG.md` · Bộ chuẩn: `BO-CHUAN-PHAT-TRIEN.md` mục 11

---

## 1. Ba cửa — phải qua ĐỦ cả ba thì máy mới tự chuyển

| Cửa | Điều kiện | Không qua thì |
|---|---|---|
| ① Có luật | Hạng mục lỗi khớp từ khoá của 1 luật trong bộ luật | «Chưa có luật cho hạng mục này» → ghi sheet, bạn quyết (quyết định thành án lệ) |
| ② Bạn đã duyệt | Luật đó ở cột «Bạn duyệt» = **Cho máy tự làm** | Luật «Chỉ ghi sheet để tôi quyết» → máy chỉ ghi kết luận gợi ý |
| ③ Kết luận chắc | Ra **đúng người** chịu lỗi (đủ dữ liệu: giờ ghi nhận, mã ô, chấm công/WMS/camera khớp) | «⚠ NGHI NGỜ — bạn quyết» ở tab **PHIẾU B1 TREO** |

Bạn chọn ở cột vàng «Quyết định» trên tab PHIẾU B1 TREO (luật **QD-01**) → lượt cò sau máy làm theo, kể cả phiếu nghi ngờ.

## 2. Nhóm lỗi → máy nào lo → tự chuyển hay không

| Nhóm lỗi | Máy lo | Luật | Tự chuyển B1.1? |
|---|---|---|---|
| Phiếu MỚI từ form Ghi nhận 5S có ô «Nhân viên vi phạm» | `push-5s-to-workflow.js` (15') | — | **Có** — ngay lúc tạo phiếu |
| Vệ sinh hằng ngày cuối ca | `canh-b11.mjs` luật ⑤ (mỗi giờ :35) | VS-01…VS-04, VS-06, VS-07 | **Có** (VS-05 thì chờ bạn) |
| Không báo cáo vệ sinh 3 lần (cò luỹ tiến) | `co-luy-tien.mjs` → form → push-5s | — | **Có** |
| Trưng bày / châm hàng / soạn hàng / lệch hệ thống | `canh-b1.mjs` (2 giờ/lần) | TB-01, TB-02, TB-03, SH-01, A1-01 | **Chưa** — chỉ ghi sheet (TB-01/02 có camera xác nhận «chắc» thì ra «B1.1 · CAO» nhưng vẫn theo cột duyệt) |
| Lỗi hành vi tại chỗ (ăn uống, CCDC, chắn lối, đùa giỡn, tập trung) và **vị trí không phải mã ô** | `canh-b1.mjs` | CAM-04 | **Chưa** — chỉ ghi sheet, máy cắt khung camera giờ ghi nhận, bạn nhận người |
| Phiếu thiếu giờ/mã ô, ảnh trùng | `canh-b1.mjs` | DL-01, DL-02 | **Không** |
| 2 phiếu trùng hoàn toàn / cùng NV·cùng lỗi·cùng ngày | `canh-b1.mjs`, `canh-trung-nv.mjs` | DL-03, CH-05 | Không chuyển — **dừng phiếu sau** |
| Lấy xe soạn sai thứ tự, gửi xe sai bãi | `bai-xe-phieu.mjs`… | XE-01, BX-01 | Chỉ ghi sheet |

## 3. Máy chuyển bằng cách nào (khuôn duy nhất: `auto-complete-single-task.mjs`)

1. Ghi vào B1 (bước 7379) 3 ô **bắt buộc**: `staff` (mã NV vi phạm) · `QLBP02` (QLTT — `qltt.js`, không đoán) · `PIC02` (ảnh bằng chứng; thiếu → 422 «Vui lòng cập nhật dữ liệu cấu hình!»).
2. Đóng B1 (`status = 2`) → engine tự mở B1.1 (bước 7826).
3. **Đọc lại** B1.1, giao lại cho đúng NV vi phạm (engine hay giao nhầm cho quản lý) → đọc lần nữa mới báo xong. Không tin HTTP 200.
4. ≥2 NV → B1.1 gán đủ người + `sub_type = 1` («Mỗi thành viên», CH-02).
5. Ô nào bạn đã sửa tay trên phiếu → máy KHÔNG ghi đè (QD-02).

Chạy tay 1 phiếu: `node auto-complete-single-task.mjs --task=<id> --nv=<mã|email> --lam`

## 4. Sau khi B1.1 mở (`canh-b11.mjs`)

- Treo >48h → bình luận tag QLTT nhắc; quá 72h sau nhắc vẫn im → tự ghi lỗi cá nhân (CH-03).
- Xong đủ từng thành viên VÀ «Xác nhận lỗi» = **Lỗi cá nhân** → điền NV vi phạm vào B3.1/B3.2, chỉ lưu.
- «Không phải lỗi cá nhân» mà không có bằng chứng mới → không đổi kết quả (CH-04, chờ bạn).

## 5. Tra 1 phiếu: có tự chuyển không, vì sao

1. Tab **PHIẾU B1 TREO** trên g-sheet — cột kết luận + lý do.
2. Hoặc tệp `.exports/canh-b1-ketqua.json`, khoá = task_id: `ketLuan` = `B1.1` (máy chuyển) · `nghi-ngo` (chờ bạn) · `cho-wms`/`cho-camera` (lượt sau) · `canh-b11` (luật vệ sinh lo).
3. `node canh-b1.mjs` (diễn tập, không ghi) để xem máy sẽ làm gì với mọi phiếu đang mở.

### Ví dụ: [HSK-74Q3LNF2 — task 14230295](https://work.hasaki.vn/tasks?task_id=14230295)

«[ĐG] Đóng sai sản phẩm — Máy 31 · camera_00031 — đơn 261012CUFUPAFG», ghi nhận 12/10 11:15, tạo 17/10.
- B1 chưa có NV vi phạm, chưa có QLTT → **KHÔNG tự chuyển**, B1 vẫn mở (Lâm Thanh Tú cầm).
- Cò `canh-b1` (lượt 19/10 07:50) xếp **CAM-04 · nghi-ngo**: «Máy 31» không phải mã ô nên rơi nhánh lùi `!bin` → CAM-04, mà CAM-04 bạn duyệt «Chỉ ghi sheet».
- **Lỗ hổng:** lỗi đóng gói không phải lỗi hành vi tại chỗ — người chịu lỗi tra được từ **tài khoản đóng đơn** của mã đơn (WMS packing). Chưa có luật riêng → xem mục 6.

## 6. Luật ĐỀ XUẤT — chờ bạn duyệt

| Mã | Nội dung | Khác luật cũ |
|---|---|---|
| **ĐG-01** | Lỗi đóng gói (tên phiếu `[ĐG]`, có mã đơn) → người chịu = tài khoản **đóng đơn** của mã đơn trên WMS packing; 1 người → B1.1, không tra được → nghi ngờ | Hiện phiếu `[ĐG]` rơi vào CAM-04 (nhờ camera, bạn nhận người) chỉ vì vị trí là «Máy xx» |

Duyệt thì: thêm luật vào `quy-tac-xac-minh-b1.json` (có `khacCu` + án lệ) → `node canh-b1.mjs --qc` đúng hết án lệ → chọn «Cho máy tự làm» trên sheet.

## 7. Thêm / sửa luật (quy trình bắt buộc)

1. Sửa `quy-tac-xac-minh-b1.json`: có `khacCu` (khác cũ ở đâu + bối cảnh) và ít nhất 1 án lệ.
2. `node canh-b1.mjs --qc` → phải đúng **mọi** án lệ.
3. `python sheet-b1-treo.py --lam` đưa lên tab QUY TẮC XÁC MINH → bạn duyệt.
4. Rà việc cũ (RA-01): phiếu còn mở chạy lại theo luật mới; phiếu đã xong để nguyên.
