# Bảng lệnh Apps Script và cách gác

Sinh tự động bởi `qc-gas-gac.mjs` (chạy trong `deploy-gas.mjs`) — **đừng sửa tay**. Lệnh KHÔNG gác phải có lý do trong `cai-pc/gas-gac-moc.json`, nếu không deploy dừng.

Cập nhật: 2026-10-20 13:16 UTC · 79 lệnh · 7 không gác (có chủ đích) · nguồn: google-script-Bridge.gs, google-script-DonTab.gs, google-script-Form5S.gs, google-script-InTem.gs, google-script-KiemKe.gs, google-script-MayTram.gs, google-script-NghiemThu.gs, google-script-ReadTab.gs, google-script-SkuVision.gs, google-script-TaiKhoan.gs, google-script-ThietBi.gs, google-script-TonMaViTri.gs, google-script-TuChua.gs, google-script-XacMinh.gs, google-script.gs

| Lệnh | Kiểu | Gác bằng | Ghi chú / lý do không gác |
|---|---|---|---|
| `bridgeCaps` | GET | **KHÔNG** | JSON tĩnh cho extension biết máy chủ hỗ trợ gì — không đọc/ghi dữ liệu. |
| `bridgeToken` | POST | **KHÔNG** | Extension wms-bridge đẩy token phiên WMS: gác bằng chính token (phải là JWT hợp lệ ≥100 ký tự, lưu theo sub trong token) — extension không giữ SECRET. |
| `lastSync` | GET | **KHÔNG** | Chỉ trả mốc giờ ghi dữ liệu gần nhất (chip «Mới nhất») — không lộ nội dung. |
| `pr_hangdoi` | POST | **KHÔNG** | Pop-up In tem hỏi máy in sống/chết + ai đang in + trần lệnh — chỉ đọc trạng thái, không có nội dung tem. |
| `requestLogin` | GET | **KHÔNG** | Nút trong email: chỉ ĐẶT CỜ yêu cầu đăng nhập cho máy trạm, không trả dữ liệu; mã OTP 6 số vẫn phải gõ trên máy. |
| `requestStockSync` | POST | **KHÔNG** | Nút «Tải lại dữ liệu» công khai: chỉ đặt cờ cho máy trạm, chống spam 60 s/lần, không gọi WMS trực tiếp. |
| `upsertPcLogin` | POST | **KHÔNG** | Agent đăng nhập PC khu A8 (top-review) ghi hostname/IP/tài khoản WMS vào tab A8-PC-DANGNHAP — CHƯA GÁC (ghi sổ, không trả dữ liệu). Nên thêm keyBodyOK_ khi sửa agent A8 lần tới (xem theo-doi-dang-nhap-pc-a8). |
| `alert` | POST | khoá SECRET (máy trạm/laptop) |  |
| `anh` | POST | khoá SECRET (máy trạm/laptop) |  |
| `bridgeDatMail` | POST | khoá SECRET (máy trạm/laptop) | 8591 tra danh bạ sub→email   // 16/10: ai đang cấp phiên bridge (email), không trả token |
| `bridgeDs` | POST | khoá SECRET (máy trạm/laptop) |  |
| `caps` | POST | khoá SECRET (máy trạm/laptop) |  |
| `checkPin` | POST | PIN tải dữ liệu (trong apiCheckPinPost) |  |
| `clearLogin` | POST | khoá SECRET (máy trạm/laptop) |  |
| `clearStockSync` | POST | khoá SECRET (máy trạm/laptop) |  |
| `clearSync` | POST | khoá SECRET (máy trạm/laptop) |  |
| `clearTimesheet` | POST | khoá SECRET (máy trạm/laptop) |  |
| `docSheet` | POST | khoá SECRET (máy trạm/laptop) |  |
| `force_sync_kiemke` | POST | khoá SECRET (máy trạm/laptop) |  |
| `force_sync_wms` | POST | khoá SECRET (máy trạm/laptop) |  |
| `getBridgeToken` | POST | khoá SECRET (máy trạm/laptop) |  |
| `ghiCot` | POST | khoá SECRET (máy trạm/laptop) |  |
| `heartbeat` | POST | khoá SECRET (máy trạm/laptop) |  |
| `loginStatus` | POST | khoá SECRET (máy trạm/laptop) |  |
| `mark` | POST | khoá SECRET (máy trạm/laptop) |  |
| `pc_adjust` | POST | khoá PC_KEY (PhysicalCountImport) | 27/07/2026: lưu SL điều chỉnh Physical Count Detail vào tab kiemke-adjust |
| `pc_import` | POST | khoá PC_KEY (PhysicalCountImport) |  |
| `pc_save_whcode` | POST | khoá PC_KEY (PhysicalCountImport) |  |
| `pc_set_key` | POST | khoá SECRET (máy trạm/laptop) |  |
| `pc_sync_whcode` | POST | khoá PC_KEY (PhysicalCountImport) |  |
| `pc_token` | POST | khoá PC_KEY (PhysicalCountImport) |  |
| `pc_uidgr_edit` | POST | khoá thiết bị (tb) | khoá thiết bị + email @hasaki.vn (kiểm server-side trong PhysicalCountImport) |
| `pcBang` | POST | khoá SECRET (máy trạm/laptop) |  |
| `pcBangPh` | POST | phiên tài khoản (quyền Xác minh) hoặc phiên Máy trạm (trong apiPcBangPh_) |  |
| `pcBoCai` | POST | phiên tài khoản (quyền Xác minh) hoặc phiên Máy trạm (trong apiPcBoCai_) | 14/10 tải bộ cài có khoá trên máy bất kỳ (phải có phiên) |
| `pcDangNhap` | POST | phiên tài khoản (quyền Xác minh) hoặc phiên Máy trạm (trong apiPcDangNhap_) |  |
| `pcDangXuat` | POST | phiên tài khoản (quyền Xác minh) hoặc phiên Máy trạm (trong apiPcDangXuat_) |  |
| `pcDatGoi` | POST | khoá SECRET (máy trạm/laptop) |  |
| `pcDatMk` | POST | khoá SECRET (máy trạm/laptop) |  |
| `pcDuyetKhoa` | POST | khoá SECRET (máy trạm/laptop) |  |
| `pcLayGoi` | POST | khoá SECRET (máy trạm/laptop) | 20/10 máy trạm tự lấy gói khoá mới (đổi khoá/mật khẩu không cài lại) |
| `pcLayKhoa` | POST | mã PC tự sinh (xin/lấy khoá, duyệt cần SECRET) (trong apiPcLayKhoa_) |  |
| `pcLenh` | POST | khoá SECRET (máy trạm/laptop) |  |
| `pcLenhPh` | POST | phiên tài khoản (TaiKhoan.gs) |  |
| `pcNhip` | POST | khoá SECRET (máy trạm/laptop) |  |
| `pcPhu` | POST | khoá SECRET (máy trạm/laptop) | 14/10 việc laptop làm thay (cò gốc) |
| `pcXinKhoa` | POST | mã PC tự sinh (xin/lấy khoá, duyệt cần SECRET) (trong apiPcXinKhoa_) |  |
| `pending` | POST | khoá SECRET (máy trạm/laptop) |  |
| `pr_hoan` | POST | khoá SECRET (máy trạm/laptop) |  |
| `pr_lay` | POST | khoá SECRET (máy trạm/laptop) |  |
| `pr_them` | POST | khoá thiết bị (tb) |  |
| `pr_trangthai` | POST | khoá SECRET (máy trạm/laptop) |  |
| `pr_xong` | POST | khoá SECRET (máy trạm/laptop) |  |
| `purgeTab` | POST | khoá SECRET (máy trạm/laptop) |  |
| `readTab` | GET | khoá thiết bị (tb) (trong apiReadTab) | dashboard đọc tab PRIVATE (whitelist SERVE_PRIVATE_TABS) |
| `requestSync` | POST | PIN tải dữ liệu (trong apiRequestSyncPost) |  |
| `requestTimesheet` | POST | PIN (trong apiRequestTimesheetPost) |  |
| `saoLuuSheet` | POST | khoá SECRET (máy trạm/laptop) | 20/10 sao lưu Sheet hằng ngày (laptop gọi) |
| `saveWmsToken` | POST | khoá SECRET (máy trạm/laptop) |  |
| `setDeviceKey` | POST | khoá SECRET (máy trạm/laptop) |  |
| `setStockMeta` | POST | khoá SECRET (máy trạm/laptop) |  |
| `sku_ocr` | POST | khoá SECRET (máy trạm/laptop) | khoá thiết bị; OCR Drive miễn phí nhưng vẫn không cho người lạ mượn |
| `sku_vision` | POST | khoá thiết bị (tb) | khoá thiết bị + hạn mức ngày (email tự khai chỉ còn là nhãn, hết đường đốt quota ẩn danh) |
| `stockSyncStatus` | POST | khoá SECRET (máy trạm/laptop) |  |
| `sucKhoeDuLieu` | POST | khoá SECRET (máy trạm/laptop) | 20/10 sức khoẻ kho dữ liệu (Script Properties/ô Sheet) — 8591 /api/suc-khoe-du-lieu |
| `suCo` | POST | khoá SECRET (máy trạm/laptop) |  |
| `syncStatus` | POST | khoá SECRET (máy trạm/laptop) |  |
| `syncTasks` | POST | khoá SECRET (máy trạm/laptop) |  |
| `tb_cho` | POST | khoá SECRET (máy trạm/laptop) |  |
| `tb_duyet` | POST | khoá SECRET (máy trạm/laptop) |  |
| `tb_ip` | POST | khoá SECRET (máy trạm/laptop) (trong apiTbIp_) | máy ĐÃ duyệt báo IP → sổ mẫu mạng công ty tự học |
| `tb_otp` | POST | mã máy + OTP 4 số (trong apiTbOtp_) | gõ 4 số quản trị nhắn cho → cấp quyền ngay, KHÔNG qua laptop |
| `tb_tra` | POST | PIN (trong apiTbTra_) |  |
| `tb_xin` | POST | mã máy + OTP 4 số (trong apiTbXin_) |  |
| `teleTest` | POST | khoá SECRET (máy trạm/laptop) |  |
| `timesheetStatus` | POST | khoá SECRET (máy trạm/laptop) |  |
| `touchTabs` | POST | khoá SECRET (máy trạm/laptop) | 26/07/2026: hash-skip vẫn chạm mốc chip giờ |
| `uploadBienBan` | POST | PIN (trong apiUploadBienBan) |  |
| `vungLenh` | POST | khoá SECRET (máy trạm/laptop) |  |
