/**
 * ============================================================================
 *  BẢN GIT-SAFE (secret đã thay bằng placeholder) — nguồn sự thật là google-script-DEPLOY.gs.
 *  ⚠ KHI DÁN VÀO APPS SCRIPT: dùng google-script-DEPLOY.gs (đã điền secret thật, không commit).
 *  Có thêm hàm testGuiMail() để cấp quyền gửi mail + test ngay trong editor.
 *  Cập nhật: thêm cột "Thời gian vi phạm" (cột 7), lưu video, đấu nối Mô tả/Video.
 * ============================================================================
 */

var TEN_SHEET = 'WMS-5S-AUDIT';
var TEN_THU_MUC_ANH = 'WMS-5S-AUDIT-HinhAnh';
var SECRET = 'DAT_MA_BI_MAT_RIENG_O_DAY';   // ⚠ ĐẶT GIÁ TRỊ THẬT (= APPSCRIPT_KEY trong .env) khi dán vào Apps Script
var SECRET_CU = 'DAT_MA_CU_RIENG_O_DAY';     // 20/10 ĐỔI KHOÁ: khoá CŨ còn nhận trong thời gian chuyển (deploy-gas chèn từ APPSCRIPT_KEY_CU; trống = không dùng). Máy trạm gọi bằng khoá cũ được trả khoaMoi ở pcNhip.
var SYNC_PIN = 'DAT_PIN_RIENG_O_DAY';        // PIN chung: form Ghi nhận 5S + Cập nhật chấm công
/* KÊNH TELEGRAM CỦA GAS (24/08/2026) — để GAS TỰ nhắn mã OTP cho quản trị, không qua máy trạm.
   Đi theo đúng đường của SECRET/SYNC_PIN: giá trị thật nằm ở .env, deploy-gas.mjs chèn vào bản
   .clasp-deploy/sa.js lúc đẩy. VÌ SAO KHÔNG làm một action GAS để đặt Script Properties từ xa:
   đợt audit 23/08 vừa đóng đúng loại lỗ "endpoint công khai đặt được bí mật" (pc_set_key TOFU),
   thêm một cái nữa là đi ngược chính mình. Ai đã đặt tay trong Script Properties thì giá trị đó
   THẮNG (tbBaoTele_ đọc Properties trước), nên đổi token gấp không cần deploy lại. */
var TELE_TOKEN = 'DAT_TELEGRAM_BOT_TOKEN_O_DAY';
var TELE_CHAT = 'DAT_TELEGRAM_CHAT_ID_O_DAY';
var SYNC_PIN_DATA = 'DAT_PIN_TAI_DU_LIEU';  // PIN RIÊNG cho "Cập nhật ngay" (ép tải dữ liệu 5S)
var SV_KHOA_CUNG = '';   // khoá Gemini dự phòng cho sku_vision (deploy-gas chèn GEMINI_API_KEY; ưu tiên Script Property GEMINI_API_KEY) — 20/10 dời từ mục SkuVision
var KHONG_VI_PHAM_PREFIX = 'Không phát sinh vi phạm';
var COL_MA_TASK = 6;
var COL_TG_VI_PHAM = 7;
var COL_MA_SP = 8;      // 03/09/2026: Mã sản phẩm (barcode/SKU quét ở form — không bắt buộc)
var COL_NV_VP = 9;      // 22/09/2026: Nhân viên vi phạm (form chọn từ danh bạ) — mở đường tự đóng B1 → B1.1
var SO_COT = 9;
var MAX_PENDING = 25;
var ALERT_EMAIL = 'th76tamle02@gmail.com';
var ALERT_THROTTLE_GIO = 12;

var TEN_SHEET_TASKS = '5S-TASKS';

// 🔒 BẢO MẬT PII: tab NHAN-SU/CHAM-CONG ghi sang SHEET RIÊNG (không chia sẻ công khai).
// Dashboard KHÔNG đọc các tab này. ID được LƯU TỰ ĐỘNG vào Script Properties khi chạy thietLapSheetRieng().
var PRIVATE_SHEET_ID = PropertiesService.getScriptProperties().getProperty('PRIVATE_SHEET_ID') || '';
var PII_TABS = ['NHAN-SU', 'CHAM-CONG'];
var SERVE_PRIVATE_TABS = ['PHU-TRACH-QUAY-KE', 'CHAMCONG-VESINH', 'VESINH-YEUCAU', 'VESINH-ANH', 'VESINH-ANH-CU', 'VESINH-NHATKY', 'VESINH-AI', 'VESINH-PHANCONG', 'VESINH-LICHSU', 'VESINH-CHAMCONG-NGAY', 'PACKER-A8-NGAY'];   // ghi vào sheet PRIVATE + phục vụ dashboard qua action=readTab (sheet gốc KHÔNG public)
// PACKER-A8-NGAY (24/09/2026, sync-packer-a8.mjs): ai ĐÓNG GÓI thật tại từng bàn/camera A8 theo NGÀY
// (email + tên + giờ phiếu đầu/cuối + số phiếu, cửa sổ trượt 30 ngày, từ WMS packings/v2) —
// pop-up ô A8 của dashboard đọc để hiện "Báo cáo đóng gói tại vị trí". Có PII nên BẮT BUỘC sheet private.
// VESINH-PHANCONG (30/07/2026, sync-phancong.mjs): bảng phân công phụ trách theo vị trí —
// kéo từ g-sheet phân công gốc của bộ phận, vị trí nào g-sheet bỏ trống thì bù bằng người
// BÁO CÁO gần nhất trong 30 ngày (planogram). Có email + tên NV nên BẮT BUỘC nằm sheet private.
// VESINH-LICHSU (01/08/2026, sync-vesinh-all.js): lịch sử TỪNG LƯỢT báo cáo theo vị trí + GIỜ,
// cửa sổ trượt 60 ngày (sang ngày thứ 61 thì sync tự xoá dòng đó). Nguồn duy nhất trả lời
// "ô này ai đã làm, lúc mấy giờ" quá 45 ngày quét. Có email + tên NV → sheet private.
// VESINH-ANH (03/08/2026, sync-vesinh-all.js): Request ID | Ngày | Ảnh — tách cột Ảnh khỏi
// VESINH-YEUCAU (tab nặng nhất lúc mở dashboard, 44/246KB là ảnh) để dashboard nạp nó ở BẬC 3.
// Không có PII, nhưng để chung sheet private cho khỏi phải nhớ tab nào nằm sheet nào.
// VESINH-ANH-CU (18/08/2026): cùng 3 cột, phần ảnh của ngày 4->7. Ảnh nay giữ đủ 7 ngày (bằng cửa
// sổ VESINH-YEUCAU) nhưng chia 2 tab để lượt mở pop-up thường ngày vẫn chỉ tải ~400KB như cũ;
// dashboard chỉ gọi tab này khi người dùng soi đúng một ngày không có trong tab nhanh.
// VESINH-CHAMCONG-NGAY (01/08/2026, sync-vesinh-all.js): chấm công THEO NGÀY (giờ vào ca + giờ ra
// cuối) của bộ phận, cửa sổ trượt 60 ngày, gói theo người. Để pop-up ô sơ đồ xem NGÀY CŨ biết được
// "hôm đó phụ trách có đi làm mà không báo cáo, hay nghỉ". Có tên + email NV → sheet private.

/* ---------- BẢO MẬT: đọc SECRET & PIN không qua query; chống brute-force & spam ---------- */
// Apps Script KHÔNG đọc được custom header → SECRET đi trong POST body (an toàn hơn query,
// không lọt vào access-log/history). Query key chỉ còn dùng cho link email GET (requestLogin).
function layKeyBody_(duLieu) { return String((duLieu && (duLieu.key || duLieu.secret)) || ''); }
function keyBodyOK_(duLieu) { var k = layKeyBody_(duLieu); return k === SECRET || (SECRET_CU !== '' && SECRET_CU.indexOf('DAT_') !== 0 && k === SECRET_CU); }
function keyLaCu_(duLieu) { var k = layKeyBody_(duLieu); return SECRET_CU !== '' && SECRET_CU.indexOf('DAT_') !== 0 && k === SECRET_CU && k !== SECRET; }   // 20/10 máy còn dùng khoá cũ → báo khoá mới

/* ===== CHỐT CHỐNG GHI TRÙNG KHI CLIENT THỬ LẠI (nonce — 12/08/2026) ==========================
 * VẤN ĐỀ ĐO ĐƯỢC: Apps Script trả 404 ở khâu LẤY NỘI DUNG (chặng googleusercontent/echo) trong khi
 * execution phía Google VẪN CHẠY XONG — đo 12/08: client nhận 404 ở giây 46, lượt lấy lại thứ 3 nhận
 * đúng kết quả cũ. Client buộc phải thử lại, và với lượt ghi KHÔNG idempotent thì thử lại = nhân đôi:
 *   · syncTasks append=true (bộ sync chia gói lớn) → thêm 2 lần cùng khối dòng
 *   · pc_adjust / pc_uidgr_edit / suCo / heartbeat → appendRow 2 lần
 *   · alert → gửi 2 email
 * CHỮA: client gửi kèm `nonce` (GIỮ NGUYÊN qua mọi lượt thử lại của cùng nội dung). Lượt đầu chạy
 * thật rồi CẤT phản hồi theo nonce 10 phút; lượt thử lại chỉ nhận lại đúng phản hồi đó, KHÔNG chạy
 * lại thân hàm. Đặt ở doPost nên che MỌI action, không phải vá từng chỗ.
 * Không có nonce (client cũ) → chạy y như trước, không đổi hành vi. */
function doPost(e) {
  var nonce = '';
  try { var d0 = JSON.parse(e.postData.contents); nonce = d0 && d0.nonce ? String(d0.nonce).slice(0, 80) : ''; } catch (eN) {}
  if (nonce) {
    try {
      var daCo = CacheService.getScriptCache().get('NONCE:' + nonce);
      if (daCo) return ContentService.createTextOutput(daCo).setMimeType(ContentService.MimeType.JSON);
    } catch (eC) {}
  }
  var ra = doPostGoc_(e);
  if (nonce) {
    try {
      // Chỉ cất được TextOutput (mọi nhánh POST đều trả phanHoiJson) — nhánh khác thì bỏ qua.
      if (ra && typeof ra.getContent === 'function') CacheService.getScriptCache().put('NONCE:' + nonce, ra.getContent(), 600);
    } catch (eP) {}
  }
  return ra;
}

/* ----------------------------- POST: lưu form / sync ----------------------------- */
function doPostGoc_(e) {
  try {
    var duLieu = JSON.parse(e.postData.contents);
    if (duLieu && /^tk_/.test(String(duLieu.action || ''))) return tkApi_(duLieu);   // 14/10 tài khoản + phân quyền audit-dc (google-script-TaiKhoan.gs)
    // Endpoint máy-gọi-máy dạng POST (SECRET trong body, KHÔNG qua query)
    if (duLieu && duLieu.action === 'syncStatus') return keyBodyOK_(duLieu) ? phanHoiJson(trangThaiCo_('SYNC_REQUESTED')) : phanHoiJson({ status: 'error', message: 'Sai key' });
    if (duLieu && duLieu.action === 'clearSync') return keyBodyOK_(duLieu) ? xoaCo_('SYNC_REQUESTED') : phanHoiJson({ status: 'error', message: 'Sai key' });
    if (duLieu && duLieu.action === 'timesheetStatus') return keyBodyOK_(duLieu) ? phanHoiJson(trangThaiCo_('TS_REQUESTED')) : phanHoiJson({ status: 'error', message: 'Sai key' });
    if (duLieu && duLieu.action === 'clearTimesheet') return keyBodyOK_(duLieu) ? xoaCo_('TS_REQUESTED') : phanHoiJson({ status: 'error', message: 'Sai key' });
    if (duLieu && duLieu.action === 'loginStatus') return keyBodyOK_(duLieu) ? phanHoiJson(trangThaiCo_('LOGIN_REQUESTED')) : phanHoiJson({ status: 'error', message: 'Sai key' });
    if (duLieu && duLieu.action === 'clearLogin') return keyBodyOK_(duLieu) ? xoaCo_('LOGIN_REQUESTED') : phanHoiJson({ status: 'error', message: 'Sai key' });
    /* servedTabs (12/08/2026): trả thẳng whitelist để client khỏi "probe bằng cách TẢI CẢ TAB".
       gasPhucVuTab cũ gọi readTab cho 4 tab mỗi lượt sync chỉ để biết tên tab có trong danh sách —
       execution dài chính là thứ làm Google trả 404 ở khâu lấy nội dung. */
    if (duLieu && duLieu.action === 'caps') return keyBodyOK_(duLieu) ? phanHoiJson({ status: 'success', timesheet: true, tabWrite: true, checkPin: true, extSheet: true, stockSync: true, kiemke: true, stockFlag: true, bridgeToken: true, touchTabs: true, tuChua: true, deviceKey: true, dangSietTb: !!tbKhoaCauHinh_(), servedTabs: SERVE_PRIVATE_TABS }) : phanHoiJson({ status: 'error', message: 'Sai key' });
    if (duLieu && duLieu.action === 'pending') return keyBodyOK_(duLieu) ? apiPendingData_() : phanHoiJson({ status: 'error', message: 'Sai key' });
    if (duLieu && duLieu.action === 'anh') return keyBodyOK_(duLieu) ? apiAnhData_(duLieu) : phanHoiJson({ status: 'error', message: 'Sai key' });
    if (duLieu && duLieu.action === 'mark') return keyBodyOK_(duLieu) ? apiMarkData_(duLieu) : phanHoiJson({ status: 'error', message: 'Sai key' });
    if (duLieu && duLieu.action === 'upsertPcLogin') return apiUpsertPcLogin(duLieu);
    if (duLieu && duLieu.action === 'alert') { if (!keyBodyOK_(duLieu)) return phanHoiJson({ status: 'error', message: 'Sai key' }); apiAlert({ parameter: { key: SECRET, msg: String(duLieu.msg || '') } }); return phanHoiJson({ status: 'success' }); }
    // 12/08/2026 — tầng tự chữa lành (google-script-TuChua.gs): sổ sự cố + thư cảnh báo + nhịp tim.
    if (duLieu && duLieu.action === 'suCo') return keyBodyOK_(duLieu) ? tcApiSuCo(duLieu) : phanHoiJson({ status: 'error', message: 'Sai key' });
    if (duLieu && duLieu.action === 'heartbeat') return keyBodyOK_(duLieu) ? tcApiNhipTim(duLieu) : phanHoiJson({ status: 'error', message: 'Sai key' });
    if (duLieu && (duLieu.action === 'syncTasks')) { if (!keyBodyOK_(duLieu)) return phanHoiJson({ status: 'error', message: 'Sai key' }); return apiSyncTasks(duLieu); }
    if (duLieu && duLieu.action === 'purgeTab') { if (!keyBodyOK_(duLieu)) return phanHoiJson({ status: 'error', message: 'Sai key' }); return apiPurgeTab(duLieu); }
    if (duLieu && duLieu.action === 'ghiCot') { if (!keyBodyOK_(duLieu)) return phanHoiJson({ status: 'error', message: 'Sai key' }); return apiGhiCot(duLieu); }
    if (duLieu && duLieu.action === 'docSheet') { if (!keyBodyOK_(duLieu)) return phanHoiJson({ status: 'error', message: 'Sai key' }); return apiDocSheet(duLieu); }
    if (duLieu && duLieu.action === 'vungLenh') { if (!keyBodyOK_(duLieu)) return phanHoiJson({ status: 'error', message: 'Sai key' }); return apiVungLenh(duLieu); }
    // 13/10/2026 — MÁY TRẠM (điều phối N PC): nhịp tim · bảng xem · lệnh dừng/tiếp tục (sub-tab «Máy trạm» qua máy chủ 8591)
    if (duLieu && duLieu.action === 'pcNhip') return keyBodyOK_(duLieu) ? apiPcNhip_(duLieu) : phanHoiJson({ status: 'error', message: 'Sai key' });
    if (duLieu && duLieu.action === 'pcBang') return keyBodyOK_(duLieu) ? apiPcBang_() : phanHoiJson({ status: 'error', message: 'Sai key' });
    if (duLieu && duLieu.action === 'pcPhu') return keyBodyOK_(duLieu) ? apiPcPhu_(duLieu) : phanHoiJson({ status: 'error', message: 'Sai key' });   // 14/10 việc laptop làm thay (cò gốc)
    if (duLieu && duLieu.action === 'pcLenh') return keyBodyOK_(duLieu) ? apiPcLenh_(duLieu) : phanHoiJson({ status: 'error', message: 'Sai key' });
    // 13/10 tối: Máy trạm phải có mật khẩu (= mật khẩu Xác minh). pcDatMk chỉ bang-591 (SECRET); 3 action còn lại công khai nhưng tự gác bằng phiên.
    if (duLieu && duLieu.action === 'pcDatMk') return keyBodyOK_(duLieu) ? apiPcDatMk_(duLieu) : phanHoiJson({ status: 'error', message: 'Sai key' });
    if (duLieu && duLieu.action === 'pcDangNhap') return apiPcDangNhap_(duLieu);
    if (duLieu && duLieu.action === 'pcDangXuat') return apiPcDangXuat_(duLieu);
    if (duLieu && duLieu.action === 'pcBangPh') return apiPcBangPh_(duLieu);
    /* 14/10 user «nút dừng chạy của máy trạm đâu»: nút cũ chỉ hiện khi trình duyệt gọi được 8591 trên laptop (trình duyệt mới chặn trang web gọi
       máy nội bộ) ⇒ điều khiển qua GAS bằng PHIÊN HỆ TÀI KHOẢN có quyền «làm» ở Xác minh; ghi tên người bấm. */
    if (duLieu && duLieu.action === 'pcLenhPh') {
      var nTk2 = (typeof tkPhien_ === 'function') ? tkPhien_(duLieu.ph) : null;
      if (!(nTk2 && nTk2.quyen && nTk2.quyen['r.xacminh'] === 'lam')) return phanHoiJson({ status: 'error', code: 403, message: 'Tài khoản chưa có quyền «làm» ở Xác minh — không điều khiển được máy trạm.' });
      return apiPcLenh_({ may: duLieu.may, viec: duLieu.viec, dung: duLieu.dung, xoa: duLieu.xoa, capNhat: duLieu.capNhat, boi: 'TK ' + String(nTk2.ten || nTk2.id || '').slice(0, 60) });
    }
    // 14/10: PC không khoá xin khoá — xin/lấy công khai (gác bằng mã PC tự sinh), duyệt cần SECRET (8591)
    if (duLieu && duLieu.action === 'pcXinKhoa') return apiPcXinKhoa_(duLieu);
    if (duLieu && duLieu.action === 'pcLayKhoa') return apiPcLayKhoa_(duLieu);
    if (duLieu && duLieu.action === 'pcDuyetKhoa') return keyBodyOK_(duLieu) ? apiPcDuyetKhoa_(duLieu) : phanHoiJson({ status: 'error', message: 'Sai key' });
    if (duLieu && duLieu.action === 'pcDatGoi') return keyBodyOK_(duLieu) ? apiPcDatGoi_(duLieu) : phanHoiJson({ status: 'error', message: 'Sai key' });
    if (duLieu && duLieu.action === 'pcLayGoi') return keyBodyOK_(duLieu) ? apiPcLayGoi_() : phanHoiJson({ status: 'error', message: 'Sai key' });        // 20/10 máy trạm tự lấy gói khoá mới (đổi khoá/mật khẩu không cài lại)
    if (duLieu && duLieu.action === 'sucKhoeDuLieu') return keyBodyOK_(duLieu) ? apiSucKhoeDuLieu_() : phanHoiJson({ status: 'error', message: 'Sai key' });   // 20/10 sức khoẻ kho dữ liệu (Script Properties/ô Sheet) — 8591 /api/suc-khoe-du-lieu
    if (duLieu && duLieu.action === 'saoLuuSheet') return keyBodyOK_(duLieu) ? apiSaoLuuSheet_(duLieu) : phanHoiJson({ status: 'error', message: 'Sai key' }); // 20/10 sao lưu Sheet hằng ngày (laptop gọi)
    if (duLieu && duLieu.action === 'pcBoCai') return apiPcBoCai_(duLieu);   // 14/10 tải bộ cài có khoá trên máy bất kỳ (phải có phiên)
    if (duLieu && duLieu.action === 'uploadBienBan') return apiUploadBienBan(duLieu);
    // Tồn mã vị trí: 2 action GAS-tự-gọi-WMS bằng token đã lưu. BẮT BUỘC SECRET (trước đây public →
    // khách vô danh kích được GAS gọi WMS, "cho mượn" token nội bộ). Frontend hiện KHÔNG gọi (nút "Tải
    // lại" chỉ đọc lại Sheet vì WMS chặn IP ngoài) → siết SECRET không ảnh hưởng thao tác nào.
    // force_sync_wms KHÔNG key (dashboard bản cũ / portal kiemsoatkho) → chuyển êm sang cơ chế ĐẶT CỜ
    // (không trả "Sai key" nữa; máy trạm kéo dữ liệu theo luật phiên, GAS không tự gọi WMS cho khách vô danh).
    if (duLieu && duLieu.action === 'force_sync_wms') return keyBodyOK_(duLieu) ? apiForceSyncWms() : apiRequestStockSync(duLieu);
    if (duLieu && duLieu.action === 'force_sync_kiemke') return keyBodyOK_(duLieu) ? apiForceSyncKiemke() : phanHoiJson({ status: 'error', message: 'Sai key' });
    if (duLieu && duLieu.action === 'saveWmsToken') return keyBodyOK_(duLieu) ? apiSaveWmsToken(duLieu) : phanHoiJson({ status: 'error', message: 'Sai key' });
    if (duLieu && duLieu.action === 'setStockMeta') return keyBodyOK_(duLieu) ? apiSetStockMeta(duLieu) : phanHoiJson({ status: 'error', message: 'Sai key' });
    if (duLieu && duLieu.action === 'touchTabs') return keyBodyOK_(duLieu) ? apiTouchTabs(duLieu) : phanHoiJson({ status: 'error', message: 'Sai key' });   // 26/07/2026: hash-skip vẫn chạm mốc chip giờ
    // Tồn kho factory — cơ chế CỜ + TOKEN BRIDGE (thêm 21/07/2026, xem chú thích khối STOCKLOC bên dưới):
    /* HÀNG ĐỢI IN TEM (20/08/2026) — dashboard gửi lệnh in, agent ở máy trạm nhận rồi in ra máy in
       tem của kho. `pr_them` gác bằng KHOÁ THIẾT BỊ (audit 23/08/2026 — trước đây public, ai trên
       Internet cũng đẩy được lệnh in tem thật); hai cái còn lại là máy-gọi-máy nên đòi SECRET. */
    if (duLieu && duLieu.action === 'pr_them') return tbOK_(duLieu) ? apiPrThem(duLieu) : tbTuChoi_();
    if (duLieu && duLieu.action === 'pr_lay') return keyBodyOK_(duLieu) ? apiPrLay(duLieu) : phanHoiJson({ status: 'error', message: 'Sai key' });
    if (duLieu && duLieu.action === 'pr_xong') return keyBodyOK_(duLieu) ? apiPrXong(duLieu) : phanHoiJson({ status: 'error', message: 'Sai key' });
    if (duLieu && duLieu.action === 'pr_hoan') return keyBodyOK_(duLieu) ? apiPrHoan(duLieu) : phanHoiJson({ status: 'error', message: 'Sai key' });
    if (duLieu && duLieu.action === 'pr_trangthai') return apiPrTrangThai(duLieu);
    if (duLieu && /^xm_(ds|tai|gui|khoa|xoa)$/.test(String(duLieu.action || ''))) return keyBodyOK_(duLieu) ? apiXm(duLieu) : phanHoiJson({ status: 'error', message: 'Sai key' });   // 14/10 kho dữ liệu xác minh
    if (duLieu && /^dc_(them|lay|xong|trangthai|tai)$/.test(String(duLieu.action || ''))) return keyBodyOK_(duLieu) ? apiDc(duLieu) : phanHoiJson({ status: 'error', message: 'Sai key' });   // 05/10 dựng clip từ xa
    if (duLieu && duLieu.action === 'pr_hangdoi') return apiPrHangDoi(duLieu);
    if (duLieu && duLieu.action === 'requestStockSync') return apiRequestStockSync(duLieu);   // nút "Tải lại dữ liệu" — public, tự bảo vệ bằng cooldown 4h + chống spam cờ
    if (duLieu && duLieu.action === 'stockSyncStatus') return keyBodyOK_(duLieu) ? phanHoiJson(trangThaiCo_('STOCK_SYNC_REQUESTED')) : phanHoiJson({ status: 'error', message: 'Sai key' });
    if (duLieu && duLieu.action === 'clearStockSync') return keyBodyOK_(duLieu) ? xoaCo_('STOCK_SYNC_REQUESTED') : phanHoiJson({ status: 'error', message: 'Sai key' });
    if (duLieu && duLieu.action === 'bridgeToken') return apiBridgeToken(duLieu);             // extension wms-bridge đẩy token PHIÊN SỐNG của operator — public, validate dạng JWT + throttle
    if (duLieu && duLieu.action === 'getBridgeToken') return keyBodyOK_(duLieu) ? apiGetBridgeToken(duLieu.kind, duLieu.chu) : phanHoiJson({ status: 'error', message: 'Sai key' });
    if (duLieu && duLieu.action === 'bridgeDs') return keyBodyOK_(duLieu) ? apiBridgeDs() : phanHoiJson({ status: 'error', message: 'Sai key' });
    if (duLieu && duLieu.action === 'bridgeDatMail') return keyBodyOK_(duLieu) ? apiBridgeDatMail_(duLieu) : phanHoiJson({ status: 'error', message: 'Sai key' });   // 8591 tra danh bạ sub→email   // 16/10: ai đang cấp phiên bridge (email), không trả token
    // Bộ pc_* (PhysicalCountImport.gs — dashboard factory "Tạo lệnh kiểm kê" + "SL điều chỉnh"):
    // khoá RIÊNG PC_KEY (không dùng SECRET 5S — tránh lộ khoá chủ cho operator dashboard public).
    // Các dòng này trước đây chỉ được thêm TAY trên bản deploy (sa.js) — nay nối vào nguồn để dán nguyên file là đủ.
    if (duLieu && duLieu.action === 'pc_import') return pcJson_(pcKeyOK_(duLieu) ? pcImport_(duLieu) : pcKeyErr_());
    if (duLieu && duLieu.action === 'pc_token') return pcJson_(pcKeyOK_(duLieu) ? pcToken_() : pcKeyErr_());
    if (duLieu && duLieu.action === 'pc_save_whcode') return pcJson_(pcKeyOK_(duLieu) ? pcSaveWhcode_(duLieu) : pcKeyErr_());
    if (duLieu && duLieu.action === 'pc_sync_whcode') return pcJson_(pcKeyOK_(duLieu) ? pcSyncWarehouses() : pcKeyErr_());
    // pc_set_key ĐÒI SECRET (audit 23/08/2026): TOFU public = kẻ đầu tiên trên Internet chiếm luôn
    // pc_token/import/adjust. Nay chỉ máy trạm (có SECRET) đặt/đổi được PC_KEY; luật oldKey bên trong giữ nguyên.
    if (duLieu && duLieu.action === 'pc_set_key') return keyBodyOK_(duLieu) ? pcJson_(pcSetKey_(duLieu)) : phanHoiJson({ status: 'error', message: 'Sai key' });
    // setDeviceKey (SECRET): đặt/đổi/tắt KHOÁ THIẾT BỊ. newKey rỗng = TẮT siết (đường lùi khẩn cấp).
    if (duLieu && duLieu.action === 'setDeviceKey') {
      if (!keyBodyOK_(duLieu)) return phanHoiJson({ status: 'error', message: 'Sai key' });
      var tbMoi = String(duLieu.newKey || '').trim();
      if (tbMoi && tbMoi.length < 10) return phanHoiJson({ status: 'error', message: 'newKey phải ≥ 10 ký tự (hoặc rỗng để TẮT siết).' });
      PropertiesService.getScriptProperties().setProperty('DEVICE_KEY', tbMoi);
      return phanHoiJson({ status: 'success', dangSiet: !!tbMoi });
    }
    // Xin cấp quyền qua bot Telegram (23/08/2026): tb_xin/tb_tra PUBLIC (tự rate-limit bên trong,
    // không lộ gì ngoài trạng thái chờ/duyệt); tb_duyet/tb_cho là máy-gọi-máy (tin-nhan-bot.mjs) → SECRET.
    if (duLieu && duLieu.action === 'tb_xin') return apiTbXin_(duLieu);
    if (duLieu && duLieu.action === 'tb_tra') return apiTbTra_(duLieu);
    if (duLieu && duLieu.action === 'tb_otp') return apiTbOtp_(duLieu);   // gõ 4 số quản trị nhắn cho → cấp quyền ngay, KHÔNG qua laptop
    if (duLieu && duLieu.action === 'tb_ip') return apiTbIp_(duLieu);     // máy ĐÃ duyệt báo IP → sổ mẫu mạng công ty tự học
    /* teleTest: bắn 1 tin thử để biết GAS có gửi Telegram được hay không, KHÔNG phải bật khoá thiết
       bị mới thử được (bật khoá giữa giờ làm là chặn In tem của cả kho). ĐÒI SECRET nên chỉ máy trạm
       gọi được — kẻ có SECRET thì đã ghi được Sheet, thêm quyền nhắn 1 tin không mở rộng gì. */
    if (duLieu && duLieu.action === 'teleTest') return keyBodyOK_(duLieu)
      ? phanHoiJson({ status: 'success', gui: tbBaoTele_('\ud83e\uddea GAS th\u1eed k\u00eanh Telegram — n\u1ebfu b\u1ea1n th\u1ea5y tin n\u00e0y th\u00ec l\u1ed1i b\u1eafn m\u00e3 OTP \u0111\u00e3 s\u1ed1ng (' + Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'HH:mm dd/MM') + ').') ? 1 : 0 })
      : phanHoiJson({ status: 'error', message: 'Sai key' });
    if (duLieu && duLieu.action === 'tb_duyet') return keyBodyOK_(duLieu) ? apiTbDuyet_(duLieu) : phanHoiJson({ status: 'error', message: 'Sai key' });
    if (duLieu && duLieu.action === 'tb_cho') return keyBodyOK_(duLieu) ? phanHoiJson({ status: 'success', ds: tbDsDoc_('TB_CHO'), daDuyet: Object.keys(tbDsDoc_('TB_DUYET')).length }) : phanHoiJson({ status: 'error', message: 'Sai key' });
    if (duLieu && duLieu.action === 'pc_adjust') return pcJson_(pcKeyOK_(duLieu) ? pcAdjust_(duLieu) : pcKeyErr_());   // 27/07/2026: lưu SL điều chỉnh Physical Count Detail vào tab kiemke-adjust
    if (duLieu && duLieu.action === 'pc_uidgr_edit') return tbOK_(duLieu) ? pcJson_(pcUidgrEdit_(duLieu)) : tbTuChoi_();   // khoá thiết bị + email @hasaki.vn (kiểm server-side trong PhysicalCountImport)
    if (duLieu && duLieu.action === 'sku_vision') return tbOK_(duLieu) ? phanHoiJson(skuVision_(duLieu)) : tbTuChoi_();   // khoá thiết bị + hạn mức ngày (email tự khai chỉ còn là nhãn, hết đường đốt quota ẩn danh)
    if (duLieu && duLieu.action === 'sku_ocr') return tbOK_(duLieu) ? phanHoiJson(skuOcr_(duLieu)) : tbTuChoi_();      // khoá thiết bị; OCR Drive miễn phí nhưng vẫn không cho người lạ mượn
    // 14/10 form nghiệm thu checklist kiểm kê — chưa duyệt: CHỈ nhận khi kèm khoá quản trị (bản nội bộ). User duyệt → NT_MO = true.
    if (duLieu && /^nt_(lay|tai|ghi)$/.test(String(duLieu.action || ''))) return (NT_MO ? tbOK_(duLieu) : keyBodyOK_(duLieu)) ? phanHoiJson(apiNghiemThu_(duLieu)) : tbTuChoi_();
    if (duLieu && /^nt_(dung_lai|dinh_dang|tu_dinh_dang)$/.test(String(duLieu.action || ''))) return keyBodyOK_(duLieu) ? phanHoiJson(apiNghiemThu_(duLieu)) : tbTuChoi_();   // 15/10 dựng lại MỌI ô theo khuôn mới — chỉ khoá quản trị
    // PIN qua POST body (an toàn hơn query GET: không lọt access-log/history/referer). Trả JSON thường.
    // GET JSONP cũ vẫn giữ nguyên để frontend hiện tại không gãy — flip frontend sang POST sau đó an toàn.
    if (duLieu && duLieu.action === 'checkPin') return apiCheckPinPost(duLieu);
    if (duLieu && duLieu.action === 'requestSync') return apiRequestSyncPost(duLieu);
    if (duLieu && duLieu.action === 'requestTimesheet') return apiRequestTimesheetPost(duLieu);
    // CHẶN TẬN GỐC "ghi rác do lệch phiên bản": chỉ FORM THẬT (không có 'action') mới được xuống appendRow.
    // Payload CÓ 'action' mà không khớp danh sách trên (vd Node mới POST action lạ khi backend chưa redeploy)
    // -> TỪ CHỐI, KHÔNG rơi xuống ghi dòng trống. (Đây chính là nguồn 48 dòng rác 13/7.)
    if (duLieu && duLieu.action) {
      return phanHoiJson({ status: 'error', message: 'Action không hỗ trợ: ' + duLieu.action + ' (không ghi dòng nào).' });
    }
    // CHẶN GHI RÁC: form ghi nhận PHẢI có ít nhất Hạng mục HOẶC Vị trí/Hiện trạng.
    // Không có trường lõi nào -> return, KHÔNG ghi dòng chỉ có mỗi timestamp.
    var _viTri = String((duLieu && duLieu.viTri) || '').trim();
    var _hienTrang = String((duLieu && duLieu.hienTrang) || '').trim();
    var _hangMuc = String((duLieu && duLieu.hangMuc) || '').trim();
    if (!_hangMuc && !_viTri && !_hienTrang) {
      return phanHoiJson({ status: 'error', message: 'Dữ liệu rỗng — bỏ qua (không ghi dòng trống).' });
    }
    var sheet = layHoacTaoSheet();
    var chuoiHinhAnh = '';
    if (duLieu.hinhAnh && duLieu.hinhAnh.length > 0) {
      chuoiHinhAnh = luuHinhAnhLenDrive(duLieu.hinhAnh, duLieu.viTri).join('\n');
    }
    var lucGhi = new Date();   // 12/10: cùng mốc này làm khoá nối sang sổ người gửi riêng tư
    sheet.appendRow([
      lucGhi,
      duLieu.hienTrang || '',
      duLieu.viTri || '',
      duLieu.hangMuc || '',
      chuoiHinhAnh,
      '',                          // 6 Mã task
      duLieu.thoiGianViPham || '', // 7 Thời gian vi phạm
      // 8 Mã sản phẩm (không bắt buộc) — dấu nháy đơn ép Sheets giữ TEXT: barcode bắt đầu bằng 0
      // (EAN Bắc Mỹ) mà để Sheets tự hiểu là SỐ thì rụng số 0 đầu, tra hasaki.vn sẽ trượt.
      duLieu.maSanPham ? ("'" + String(duLieu.maSanPham).trim()) : '',
      // 9 Nhân viên vi phạm (email/mã NV, nhiều người ngăn bằng dấu phẩy) — bộ đẩy dùng để TỰ hoàn thành
      // bước B1 rồi chuyển sang B1.1. Rỗng = giữ nguyên ở B1 cho người xác minh.
      duLieu.nhanVienViPham || ''
    ]);
    try { ghiNguoiGui_(lucGhi, duLieu); } catch (eNG) { console.error('ghiNguoiGui_: ' + eNG); }   // hỏng sổ riêng không được làm hỏng biên bản
    return phanHoiJson({ status: 'success', message: 'Đã lưu dữ liệu thành công.' });
  } catch (err) {
    return phanHoiJson({ status: 'error', message: String(err) });
  }
}

/* ------------------ GET: pending / mark / alert / kiểm tra ------------------ */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || '';
  // Probe CÔNG KHAI cho extension/máy trạm biết bản GAS này đã có kênh bridge + cờ tồn kho chưa
  // (client PHẢI probe trước khi POST action mới — POST action lạ lên bản GAS cũ sẽ rơi vào
  //  nhánh appendRow mặc định và ghi rác vào sheet 5S).
  // bridgeWshr: bản này CÓ khe token work/hr riêng (kind='wshr'). Extension PHẢI thấy cờ này mới
  // đẩy token wshr — bản GAS cũ bỏ qua `kind` nên đẩy mù sẽ ghi đè token WMS bằng token wshr.
  if (action === 'bridgeCaps') return phanHoiJson({ status: 'success', bridgeToken: true, bridgeWshr: true, bridgeChat: true, bridgeChu: true, stockFlag: true });
  // GET công khai bằng PIN (không chứa SECRET): dashboard/form gọi qua JSONP <script>
  if (action === 'requestSync') return apiRequestSync(e);           // nút "Cập nhật ngay" (PIN)
  if (action === 'requestTimesheet') return apiRequestTimesheet(e); // nút "Cập nhật chấm công" (PIN)
  if (action === 'checkPin') return apiCheckPin(e);                 // form Ghi nhận 5S kiểm PIN
  if (action === 'lastSync') return apiLastSync(e);                 // chip giờ dữ liệu
  if (action === 'readTab') return apiReadTab(e);                   // dashboard đọc tab PRIVATE (whitelist SERVE_PRIVATE_TABS)
  if (action === 'requestLogin') return apiRequestLogin(e);         // link email GET (chỉ đặt cờ, không lộ dữ liệu)
  // Các action chứa SECRET đã CHUYỂN sang POST (body.key) — không còn nhận qua query để SECRET không lọt access-log.
  if (['caps','pending','mark','syncStatus','clearSync','timesheetStatus','clearTimesheet','loginStatus','clearLogin'].indexOf(action) >= 0)
    return phanHoiJson({ status: 'error', message: 'Endpoint này đã chuyển sang POST (key trong body).' });
  return phanHoiJson({ status: 'success', message: 'Web App đang hoạt động bình thường.' });
}

/** Người dùng bấm nút trong email (từ ĐIỆN THOẠI hoặc WEB bất kỳ) → đặt cờ yêu cầu đăng nhập. */
function apiRequestLogin(e) {
  if ((e.parameter.key || '') !== SECRET) {
    return HtmlService.createHtmlOutput('<h2>Sai mã bảo mật.</h2>').setTitle('5S - Lỗi');
  }
  PropertiesService.getScriptProperties().setProperty('LOGIN_REQUESTED', String(new Date().getTime()));
  var html =
    '<div style="font-family:Arial;max-width:460px;margin:40px auto;text-align:center;color:#222">' +
    '<div style="font-size:56px">✅</div>' +
    '<h2 style="color:#1a7f37">Đã gửi yêu cầu đăng nhập</h2>' +
    '<p style="font-size:15px;line-height:1.6">Máy tính chạy bộ đẩy 5S sẽ <b>tự mở màn hình đăng nhập</b> trong vòng ~2 phút.</p>' +
    '<p style="font-size:15px;line-height:1.6">Hãy tới máy tính đó, <b>gõ mã OTP 6 số</b> và bấm Đăng nhập (email &amp; mật khẩu đã tự điền sẵn).</p>' +
    '<p style="color:#888;font-size:12px">Có thể đóng trang này.</p>' +
    '</div>';
  return HtmlService.createHtmlOutput(html).setTitle('5S - Yêu cầu đăng nhập');
}

/** Máy PC hỏi: có ai vừa yêu cầu đăng nhập không? (cờ còn hiệu lực trong 15 phút). */
function apiLoginStatus(e) {
  if ((e.parameter.key || '') !== SECRET) return phanHoiJson({ status: 'error', message: 'Sai key' });
  var ts = Number(PropertiesService.getScriptProperties().getProperty('LOGIN_REQUESTED') || 0);
  var conHieuLuc = ts > 0 && (new Date().getTime() - ts) < 15 * 60 * 1000;
  return phanHoiJson({ status: 'success', requested: conHieuLuc, ts: ts });
}

/** Máy PC báo đã mở màn hình đăng nhập → xoá cờ để khỏi mở lại. */
function apiClearLogin(e) {
  if ((e.parameter.key || '') !== SECRET) return phanHoiJson({ status: 'error', message: 'Sai key' });
  PropertiesService.getScriptProperties().deleteProperty('LOGIN_REQUESTED');
  return phanHoiJson({ status: 'success', cleared: true });
}

/** Trả JSONP (cho dashboard gọi cross-origin qua thẻ <script>). */
function phanHoiJsonp(cb, obj) {
  return ContentService.createTextOutput(cb + '(' + JSON.stringify(obj) + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
}

/* ---- Lõi dùng chung cho các endpoint máy-gọi-máy (gọi từ doPost sau khi đã verify key body) ---- */
function trangThaiCo_(prop) {
  var ts = Number(PropertiesService.getScriptProperties().getProperty(prop) || 0);
  return { status: 'success', requested: ts > 0 && (new Date().getTime() - ts) < 15 * 60 * 1000, ts: ts };
}
function xoaCo_(prop) {
  PropertiesService.getScriptProperties().deleteProperty(prop);
  return phanHoiJson({ status: 'success', cleared: true });
}
function phanHoiJson(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ===== SỨC KHOẺ KHO DỮ LIỆU (20/10/2026 — đánh giá: Script Properties có trần 500 KB tổng / 9 KB mỗi khoá, Sheet 10 triệu ô,
 * nhưng không chỗ nào đo → đầy là lệnh in tem/nhịp tim im lặng hỏng). 8591 hỏi mỗi 10' (/api/suc-khoe-du-lieu), gác SECRET.
 * Chỉ trả TÊN khoá + kích thước (không trả giá trị — có khoá chứa gói mật). ===== */
function apiSucKhoeDuLieu_() {
  var P = PropertiesService.getScriptProperties().getProperties(), ks = Object.keys(P), tong = 0, nhom = {}, to = [];
  for (var i = 0; i < ks.length; i++) {
    var n = String(P[ks[i]] || '').length; tong += n + ks[i].length;
    var g = ks[i].replace(/[_:].*$/, ''); nhom[g] = nhom[g] || { so: 0, byte: 0 }; nhom[g].so++; nhom[g].byte += n;
    if (n > 7000) to.push({ k: ks[i], byte: n });   // sát trần 9 KB/khoá
  }
  to.sort(function (a, b) { return b.byte - a.byte; });
  var sheets = [], ds = [['5S (công khai)', ''], ['PRIVATE', PRIVATE_SHEET_ID], ['NGHIEM-THU', NT_SHEET_ID], ['STOCKLOC', STOCKLOC_SHEET_ID]];
  for (var j = 0; j < ds.length; j++) {
    try {
      var ss = ds[j][1] ? SpreadsheetApp.openById(ds[j][1]) : SpreadsheetApp.getActiveSpreadsheet();
      var tabs = ss.getSheets(), o = 0, t = [];
      for (var k = 0; k < tabs.length; k++) { var c = tabs[k].getMaxRows() * tabs[k].getMaxColumns(); o += c; t.push({ ten: tabs[k].getName(), hang: tabs[k].getLastRow(), o: c }); }
      t.sort(function (a, b) { return b.o - a.o; });
      sheets.push({ ten: ds[j][0], tab: tabs.length, o: o, tranO: 10000000, tabs: t.slice(0, 8) });
    } catch (e) { sheets.push({ ten: ds[j][0], loi: String(e).slice(0, 120) }); }
  }
  return phanHoiJson({ status: 'success', luc: new Date().toISOString(),
    props: { so: ks.length, byte: tong, tranByte: 500 * 1024, nhom: nhom, to: to.slice(0, 10) }, sheets: sheets });
}

/* ===== CÁC MỤC NGHIỆP VỤ đã tách sang google-script-*.gs (20/10/2026) — xem đầu mỗi tệp; qc-gas-gac.mjs sinh API-GAS.md ===== */
