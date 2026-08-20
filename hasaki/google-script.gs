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
var SYNC_PIN = 'DAT_PIN_RIENG_O_DAY';        // PIN chung: form Ghi nhận 5S + Cập nhật chấm công
var SYNC_PIN_DATA = 'DAT_PIN_TAI_DU_LIEU';  // PIN RIÊNG cho "Cập nhật ngay" (ép tải dữ liệu 5S)
var KHONG_VI_PHAM_PREFIX = 'Không phát sinh vi phạm';
var COL_MA_TASK = 6;
var COL_TG_VI_PHAM = 7;
var SO_COT = 7;
var MAX_PENDING = 25;
var ALERT_EMAIL = 'th76tamle02@gmail.com';
var ALERT_THROTTLE_GIO = 12;

var TEN_SHEET_TASKS = '5S-TASKS';

// 🔒 BẢO MẬT PII: tab NHAN-SU/CHAM-CONG ghi sang SHEET RIÊNG (không chia sẻ công khai).
// Dashboard KHÔNG đọc các tab này. ID được LƯU TỰ ĐỘNG vào Script Properties khi chạy thietLapSheetRieng().
var PRIVATE_SHEET_ID = PropertiesService.getScriptProperties().getProperty('PRIVATE_SHEET_ID') || '';
var PII_TABS = ['NHAN-SU', 'CHAM-CONG'];
var SERVE_PRIVATE_TABS = ['PHU-TRACH-QUAY-KE', 'CHAMCONG-VESINH', 'VESINH-YEUCAU', 'VESINH-ANH', 'VESINH-ANH-CU', 'VESINH-NHATKY', 'VESINH-AI', 'VESINH-PHANCONG', 'VESINH-LICHSU', 'VESINH-CHAMCONG-NGAY'];   // ghi vào sheet PRIVATE + phục vụ dashboard qua action=readTab (sheet gốc KHÔNG public)
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
function keyBodyOK_(duLieu) { return layKeyBody_(duLieu) === SECRET; }

// Chống brute-force PIN: đếm số lần sai theo "định danh" (mã NV / obj), khoá 15' sau 5 lần.
function pinBiKhoa_(dinhDanh) {
  var c = CacheService.getScriptCache();
  var n = Number(c.get('pinfail_' + dinhDanh) || 0);
  return n >= 5;
}
function ghiNhanSaiPin_(dinhDanh) {
  var c = CacheService.getScriptCache();
  var n = Number(c.get('pinfail_' + dinhDanh) || 0) + 1;
  c.put('pinfail_' + dinhDanh, String(n), 15 * 60);   // TTL 15 phút
  return n;
}
function xoaSaiPin_(dinhDanh) { CacheService.getScriptCache().remove('pinfail_' + dinhDanh); }

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
    if (duLieu && duLieu.action === 'caps') return keyBodyOK_(duLieu) ? phanHoiJson({ status: 'success', timesheet: true, tabWrite: true, checkPin: true, extSheet: true, stockSync: true, kiemke: true, stockFlag: true, bridgeToken: true, touchTabs: true, tuChua: true, servedTabs: SERVE_PRIVATE_TABS }) : phanHoiJson({ status: 'error', message: 'Sai key' });
    if (duLieu && duLieu.action === 'pending') return keyBodyOK_(duLieu) ? apiPendingData_() : phanHoiJson({ status: 'error', message: 'Sai key' });
    if (duLieu && duLieu.action === 'mark') return keyBodyOK_(duLieu) ? apiMarkData_(duLieu) : phanHoiJson({ status: 'error', message: 'Sai key' });
    if (duLieu && duLieu.action === 'alert') { if (!keyBodyOK_(duLieu)) return phanHoiJson({ status: 'error', message: 'Sai key' }); apiAlert({ parameter: { key: SECRET, msg: String(duLieu.msg || '') } }); return phanHoiJson({ status: 'success' }); }
    // 12/08/2026 — tầng tự chữa lành (google-script-TuChua.gs): sổ sự cố + thư cảnh báo + nhịp tim.
    if (duLieu && duLieu.action === 'suCo') return keyBodyOK_(duLieu) ? tcApiSuCo(duLieu) : phanHoiJson({ status: 'error', message: 'Sai key' });
    if (duLieu && duLieu.action === 'heartbeat') return keyBodyOK_(duLieu) ? tcApiNhipTim(duLieu) : phanHoiJson({ status: 'error', message: 'Sai key' });
    if (duLieu && (duLieu.action === 'syncTasks')) { if (!keyBodyOK_(duLieu)) return phanHoiJson({ status: 'error', message: 'Sai key' }); return apiSyncTasks(duLieu); }
    if (duLieu && duLieu.action === 'purgeTab') { if (!keyBodyOK_(duLieu)) return phanHoiJson({ status: 'error', message: 'Sai key' }); return apiPurgeTab(duLieu); }
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
       tem của kho. `pr_them` PUBLIC (người bấm trên điện thoại không có SECRET), hai cái còn lại là
       máy-gọi-máy nên đòi SECRET. */
    if (duLieu && duLieu.action === 'pr_them') return apiPrThem(duLieu);
    if (duLieu && duLieu.action === 'pr_lay') return keyBodyOK_(duLieu) ? apiPrLay(duLieu) : phanHoiJson({ status: 'error', message: 'Sai key' });
    if (duLieu && duLieu.action === 'pr_xong') return keyBodyOK_(duLieu) ? apiPrXong(duLieu) : phanHoiJson({ status: 'error', message: 'Sai key' });
    if (duLieu && duLieu.action === 'pr_hoan') return keyBodyOK_(duLieu) ? apiPrHoan(duLieu) : phanHoiJson({ status: 'error', message: 'Sai key' });
    if (duLieu && duLieu.action === 'pr_trangthai') return apiPrTrangThai(duLieu);
    if (duLieu && duLieu.action === 'pr_hangdoi') return apiPrHangDoi(duLieu);
    if (duLieu && duLieu.action === 'requestStockSync') return apiRequestStockSync(duLieu);   // nút "Tải lại dữ liệu" — public, tự bảo vệ bằng cooldown 4h + chống spam cờ
    if (duLieu && duLieu.action === 'stockSyncStatus') return keyBodyOK_(duLieu) ? phanHoiJson(trangThaiCo_('STOCK_SYNC_REQUESTED')) : phanHoiJson({ status: 'error', message: 'Sai key' });
    if (duLieu && duLieu.action === 'clearStockSync') return keyBodyOK_(duLieu) ? xoaCo_('STOCK_SYNC_REQUESTED') : phanHoiJson({ status: 'error', message: 'Sai key' });
    if (duLieu && duLieu.action === 'bridgeToken') return apiBridgeToken(duLieu);             // extension wms-bridge đẩy token PHIÊN SỐNG của operator — public, validate dạng JWT + throttle
    if (duLieu && duLieu.action === 'getBridgeToken') return keyBodyOK_(duLieu) ? apiGetBridgeToken(duLieu.kind) : phanHoiJson({ status: 'error', message: 'Sai key' });
    // Bộ pc_* (PhysicalCountImport.gs — dashboard factory "Tạo lệnh kiểm kê" + "SL điều chỉnh"):
    // khoá RIÊNG PC_KEY (không dùng SECRET 5S — tránh lộ khoá chủ cho operator dashboard public).
    // Các dòng này trước đây chỉ được thêm TAY trên bản deploy (sa.js) — nay nối vào nguồn để dán nguyên file là đủ.
    if (duLieu && duLieu.action === 'pc_import') return pcJson_(pcKeyOK_(duLieu) ? pcImport_(duLieu) : pcKeyErr_());
    if (duLieu && duLieu.action === 'pc_token') return pcJson_(pcKeyOK_(duLieu) ? pcToken_() : pcKeyErr_());
    if (duLieu && duLieu.action === 'pc_save_whcode') return pcJson_(pcKeyOK_(duLieu) ? pcSaveWhcode_(duLieu) : pcKeyErr_());
    if (duLieu && duLieu.action === 'pc_sync_whcode') return pcJson_(pcKeyOK_(duLieu) ? pcSyncWarehouses() : pcKeyErr_());
    if (duLieu && duLieu.action === 'pc_set_key') return pcJson_(pcSetKey_(duLieu));
    if (duLieu && duLieu.action === 'pc_adjust') return pcJson_(pcKeyOK_(duLieu) ? pcAdjust_(duLieu) : pcKeyErr_());   // 27/07/2026: lưu SL điều chỉnh Physical Count Detail vào tab kiemke-adjust
    if (duLieu && duLieu.action === 'pc_uidgr_edit') return pcJson_(pcUidgrEdit_(duLieu));   // 27/07/2026: Action trên dòng UID group lệch — KHÔNG PC_KEY, gác bằng email @hasaki.vn (kiểm server-side trong PhysicalCountImport)
    if (duLieu && duLieu.action === 'sku_vision') return phanHoiJson(skuVision_(duLieu));   // 18/08/2026: tab "Nhận diện SKU" — proxy Vision LLM, gác bằng email @hasaki.vn + hạn mức ngày
    if (duLieu && duLieu.action === 'sku_ocr') return phanHoiJson(skuOcr_(duLieu));      // 19/08/2026: đọc CHỮ trên tem bằng OCR của Google Drive — miễn phí, không tốn hạn mức AI
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
    sheet.appendRow([
      new Date(),
      duLieu.hienTrang || '',
      duLieu.viTri || '',
      duLieu.hangMuc || '',
      chuoiHinhAnh,
      '',                          // 6 Mã task
      duLieu.thoiGianViPham || '', // 7 Thời gian vi phạm
      duLieu.maSanPham || ''       // 8 Mã sản phẩm (không bắt buộc)
    ]);
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
  if (action === 'bridgeCaps') return phanHoiJson({ status: 'success', bridgeToken: true, bridgeWshr: true, stockFlag: true });
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
function apiPendingData_() {
  var sheet = layHoacTaoSheet();
  var last = sheet.getLastRow();
  if (last < 2) return phanHoiJson({ status: 'success', rows: [] });
  var values = sheet.getRange(2, 1, last - 1, SO_COT).getValues();
  var rows = [];
  for (var i = 0; i < values.length && rows.length < MAX_PENDING; i++) {
    var r = values[i], rowIndex = i + 2;
    var maTask = String(r[COL_MA_TASK - 1] || '').trim();
    var hangMuc = String(r[3] || '').trim();
    if (maTask) continue;
    if (!hangMuc) continue;
    if (hangMuc.indexOf(KHONG_VI_PHAM_PREFIX) === 0) { sheet.getRange(rowIndex, COL_MA_TASK).setValue('(không vi phạm - bỏ qua)'); continue; }
    rows.push({ row: rowIndex, ngay: formatNgay(r[0]), hienTrang: String(r[1] || ''), viTri: String(r[2] || ''), hangMuc: hangMuc, thoiGianViPham: formatNgay(r[COL_TG_VI_PHAM - 1]), images: layAnhBase64(String(r[4] || '')) });
  }
  return phanHoiJson({ status: 'success', rows: rows });
}
function apiMarkData_(duLieu) {
  var row = parseInt(duLieu.row, 10), code = duLieu.code || '';
  if (!row) return phanHoiJson({ status: 'error', message: 'Thiếu row' });
  layHoacTaoSheet().getRange(row, COL_MA_TASK).setValue(code);
  return phanHoiJson({ status: 'success' });
}

/** Dashboard bấm "Cập nhật ngay" + nhập PIN → đặt cờ để máy PC tự chạy auto-export. */
function apiRequestSync(e) {
  var cb = e.parameter.callback || 'cb';
  if (pinBiKhoa_('sync')) return phanHoiJsonp(cb, { status: 'error', message: 'Nhập sai PIN quá nhiều lần. Thử lại sau 15 phút.' });
  if ((e.parameter.pin || '') !== SYNC_PIN_DATA) { ghiNhanSaiPin_('sync'); return phanHoiJsonp(cb, { status: 'error', message: 'Sai PIN' }); }
  xoaSaiPin_('sync');
  // Chống SPAM: chặn 2 lần requestSync cách nhau < 60 giây (đỡ nã máy PC/WMS liên tục)
  var props = PropertiesService.getScriptProperties();
  var last = Number(props.getProperty('LAST_SYNC_REQUEST_MS') || 0), now = new Date().getTime();
  if (now - last < 60 * 1000) return phanHoiJsonp(cb, { status: 'error', code: 429, message: 'Vừa gửi yêu cầu cách đây <60s. Vui lòng đợi rồi thử lại.' });
  props.setProperty('LAST_SYNC_REQUEST_MS', String(now));
  props.setProperty('SYNC_REQUESTED', String(now));
  return phanHoiJsonp(cb, { status: 'success', message: 'Đã gửi yêu cầu cập nhật. Dữ liệu sẽ mới sau vài phút.' });
}

/** Máy PC hỏi: có ai vừa bấm "Cập nhật ngay" không? (cờ hiệu lực 15 phút). */
function apiSyncStatus(e) {
  if ((e.parameter.key || '') !== SECRET) return phanHoiJson({ status: 'error', message: 'Sai key' });
  var ts = Number(PropertiesService.getScriptProperties().getProperty('SYNC_REQUESTED') || 0);
  return phanHoiJson({ status: 'success', requested: ts > 0 && (new Date().getTime() - ts) < 15 * 60 * 1000, ts: ts });
}

/** Máy PC báo đã chạy auto-export → xoá cờ. */
function apiClearSync(e) {
  if ((e.parameter.key || '') !== SECRET) return phanHoiJson({ status: 'error', message: 'Sai key' });
  PropertiesService.getScriptProperties().deleteProperty('SYNC_REQUESTED');
  return phanHoiJson({ status: 'success', cleared: true });
}

/** Dashboard bấm "Cập nhật chấm công" + PIN → đặt cờ để máy PC chạy pull-timesheet. */
function apiRequestTimesheet(e) {
  var cb = e.parameter.callback || 'cb';
  if (pinBiKhoa_('ts')) return phanHoiJsonp(cb, { status: 'error', message: 'Nhập sai PIN quá nhiều lần. Thử lại sau 15 phút.' });
  if ((e.parameter.pin || '') !== SYNC_PIN) { ghiNhanSaiPin_('ts'); return phanHoiJsonp(cb, { status: 'error', message: 'Sai PIN' }); }
  xoaSaiPin_('ts');
  var props = PropertiesService.getScriptProperties();
  var last = Number(props.getProperty('LAST_TS_REQUEST_MS') || 0), now = new Date().getTime();
  if (now - last < 60 * 1000) return phanHoiJsonp(cb, { status: 'error', code: 429, message: 'Vừa gửi yêu cầu cách đây <60s. Vui lòng đợi rồi thử lại.' });
  props.setProperty('LAST_TS_REQUEST_MS', String(now));
  props.setProperty('TS_REQUESTED', String(now));
  return phanHoiJsonp(cb, { status: 'success', message: 'Đã gửi yêu cầu cập nhật chấm công. Dữ liệu sẽ mới sau vài phút.' });
}
/** Máy PC hỏi: có ai vừa bấm "Cập nhật chấm công" không? (cờ hiệu lực 15 phút). */
function apiTimesheetStatus(e) {
  if ((e.parameter.key || '') !== SECRET) return phanHoiJson({ status: 'error', message: 'Sai key' });
  var ts = Number(PropertiesService.getScriptProperties().getProperty('TS_REQUESTED') || 0);
  return phanHoiJson({ status: 'success', requested: ts > 0 && (new Date().getTime() - ts) < 15 * 60 * 1000, ts: ts });
}
/** Máy PC báo đã kéo chấm công → xoá cờ. */
function apiClearTimesheet(e) {
  if ((e.parameter.key || '') !== SECRET) return phanHoiJson({ status: 'error', message: 'Sai key' });
  PropertiesService.getScriptProperties().deleteProperty('TS_REQUESTED');
  return phanHoiJson({ status: 'success', cleared: true });
}

/** Kiểm PIN cho form Ghi nhận 5S — trả JSONP {status,ok}. PIN KHÔNG còn nằm trong mã front-end. */
function apiCheckPin(e) {
  var cb = e.parameter.callback || 'cb';
  if (pinBiKhoa_('checkpin')) return phanHoiJsonp(cb, { status: 'error', ok: false, message: 'Nhập sai PIN quá nhiều lần. Thử lại sau 15 phút.' });
  var ok = (e.parameter.pin || '') === SYNC_PIN;
  if (ok) xoaSaiPin_('checkpin'); else ghiNhanSaiPin_('checkpin');
  return phanHoiJsonp(cb, { status: 'success', ok: ok });
}

/* ---- Biến thể POST (PIN trong body, trả JSON thường) — dùng chung logic brute-force/cooldown ---- */
function apiCheckPinPost(duLieu) {
  if (pinBiKhoa_('checkpin')) return phanHoiJson({ status: 'error', ok: false, message: 'Nhập sai PIN quá nhiều lần. Thử lại sau 15 phút.' });
  var ok = String(duLieu.pin || '') === SYNC_PIN;
  if (ok) xoaSaiPin_('checkpin'); else ghiNhanSaiPin_('checkpin');
  return phanHoiJson({ status: 'success', ok: ok });
}
function apiRequestSyncPost(duLieu) {
  if (pinBiKhoa_('sync')) return phanHoiJson({ status: 'error', message: 'Nhập sai PIN quá nhiều lần. Thử lại sau 15 phút.' });
  if (String(duLieu.pin || '') !== SYNC_PIN_DATA) { ghiNhanSaiPin_('sync'); return phanHoiJson({ status: 'error', message: 'Sai PIN' }); }
  xoaSaiPin_('sync');
  var props = PropertiesService.getScriptProperties();
  var last = Number(props.getProperty('LAST_SYNC_REQUEST_MS') || 0), now = new Date().getTime();
  if (now - last < 60 * 1000) return phanHoiJson({ status: 'error', code: 429, message: 'Vừa gửi yêu cầu cách đây <60s. Vui lòng đợi rồi thử lại.' });
  props.setProperty('LAST_SYNC_REQUEST_MS', String(now));
  props.setProperty('SYNC_REQUESTED', String(now));
  return phanHoiJson({ status: 'success', message: 'Đã gửi yêu cầu cập nhật. Dữ liệu sẽ mới sau vài phút.' });
}
function apiRequestTimesheetPost(duLieu) {
  if (pinBiKhoa_('ts')) return phanHoiJson({ status: 'error', message: 'Nhập sai PIN quá nhiều lần. Thử lại sau 15 phút.' });
  if (String(duLieu.pin || '') !== SYNC_PIN) { ghiNhanSaiPin_('ts'); return phanHoiJson({ status: 'error', message: 'Sai PIN' }); }
  xoaSaiPin_('ts');
  var props = PropertiesService.getScriptProperties();
  var last = Number(props.getProperty('LAST_TS_REQUEST_MS') || 0), now = new Date().getTime();
  if (now - last < 60 * 1000) return phanHoiJson({ status: 'error', code: 429, message: 'Vừa gửi yêu cầu cách đây <60s. Vui lòng đợi rồi thử lại.' });
  props.setProperty('LAST_TS_REQUEST_MS', String(now));
  props.setProperty('TS_REQUESTED', String(now));
  return phanHoiJson({ status: 'success', message: 'Đã gửi yêu cầu cập nhật chấm công. Dữ liệu sẽ mới sau vài phút.' });
}

/**
 * ⚙️ CHẠY 1 LẦN trong editor (chọn hàm thietLapSheetRieng → Run):
 *   1) Tạo Spreadsheet RIÊNG "WMS-5S-NHANSU" (mặc định KHÔNG chia sẻ công khai), lưu ID vào Script Properties.
 *   2) Chuyển tab NHAN-SU + CHAM-CONG (kèm dữ liệu) từ sheet công khai sang sheet riêng.
 *   3) XOÁ 2 tab đó khỏi sheet công khai → hết lộ dữ liệu cá nhân qua gviz.
 *   Từ đó apiSyncTasks tự ghi 2 tab này vào sheet riêng. Chạy lại an toàn (idempotent).
 *   (Lần đầu Apps Script sẽ hỏi cấp quyền Drive/Spreadsheet — bấm Cho phép.)
 */
function thietLapSheetRieng() {
  var props = PropertiesService.getScriptProperties();
  var pubSS = SpreadsheetApp.getActiveSpreadsheet();
  var priv = null, id = props.getProperty('PRIVATE_SHEET_ID');
  if (id) { try { priv = SpreadsheetApp.openById(id); } catch (e) { priv = null; } }
  if (!priv) {
    priv = SpreadsheetApp.create('WMS-5S-NHANSU (RIENG - khong chia se cong khai)');
    props.setProperty('PRIVATE_SHEET_ID', priv.getId());
  }
  var log = ['Sheet rieng: ' + priv.getUrl()];
  for (var i = 0; i < PII_TABS.length; i++) {
    var tab = PII_TABS[i], src = pubSS.getSheetByName(tab);
    if (!src) { log.push(tab + ': khong co o sheet cong khai (bo qua)'); continue; }
    var old = priv.getSheetByName(tab); if (old) priv.deleteSheet(old);   // ghi de ban cu
    src.copyTo(priv).setName(tab);                                        // copy ca du lieu + dinh dang
    if (pubSS.getSheets().length > 1) pubSS.deleteSheet(src);             // xoa khoi cong khai
    log.push(tab + ': da chuyen sang sheet rieng + xoa khoi cong khai');
  }
  var def = priv.getSheetByName('Sheet1'); if (def && priv.getSheets().length > 1) { try { priv.deleteSheet(def); } catch (e) {} }
  var msg = 'XONG.\n' + log.join('\n') + '\n(ID da luu Script Properties -> apiSyncTasks tu ghi vao sheet rieng)';
  Logger.log(msg);
  return msg;
}

/** Lấy LINK sheet riêng (NHAN-SU/CHAM-CONG). Run trong editor -> link hiện ở kết quả + Nhật ký (Logger). */
function xemSheetRieng() {
  var id = PropertiesService.getScriptProperties().getProperty('PRIVATE_SHEET_ID');
  if (!id) { Logger.log('Chua co sheet rieng - chay thietLapSheetRieng() truoc.'); return 'Chua co sheet rieng.'; }
  var url = 'https://docs.google.com/spreadsheets/d/' + id + '/edit';
  Logger.log(url);
  return url;
}

/** Chia sẻ sheet riêng cho 1 EMAIL NỘI BỘ (quyền Xem) — vd để mở từ tài khoản khác. KHÔNG mở công khai. */
function chiaSeSheetRieng(email) {
  var id = PropertiesService.getScriptProperties().getProperty('PRIVATE_SHEET_ID');
  if (!id) return 'Chua co sheet rieng.';
  email = email || 'cosmetics@hasakigroup.vn';   // sửa email tại đây nếu cần
  try { DriveApp.getFileById(id).addViewer(email); } catch (e) { return 'Loi chia se: ' + e.message; }
  return 'Da chia se (Xem) cho ' + email + ' : https://docs.google.com/spreadsheets/d/' + id + '/edit';
}

/**
 * ⚙️ CHẠY 1 LẦN (donDepBienBanCu): chuyển biên bản từ tab BIEN-BAN cũ -> cột "Biên bản" của 5S-TASKS
 *   (khớp theo Mã task), BỎ dòng test, rồi XOÁ tab BIEN-BAN. An toàn chạy lại (idempotent).
 */
function donDepBienBanCu() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var bb = ss.getSheetByName('BIEN-BAN');
  if (!bb) return 'Khong co tab BIEN-BAN (co the da xoa).';
  var tasks = ss.getSheetByName(TEN_SHEET_TASKS);
  if (!tasks) return 'Khong tim thay 5S-TASKS.';
  var head = tasks.getRange(1, 1, 1, tasks.getLastColumn()).getValues()[0];
  var iCode = -1, iBB = -1;
  for (var c = 0; c < head.length; c++) { var h = String(head[c]).trim().toLowerCase(); if (h === 'task code') iCode = c; if (h === 'biên bản') iBB = c; }
  if (iCode < 0) for (var c2 = 0; c2 < head.length; c2++) if (/task code/i.test(head[c2])) iCode = c2;
  if (iCode < 0) return 'Khong tim thay cot Task Code trong 5S-TASKS.';
  if (iBB < 0) { iBB = tasks.getLastColumn(); tasks.getRange(1, iBB + 1).setValue('Biên bản').setFontWeight('bold').setBackground('#0f766e').setFontColor('#ffffff'); }
  var data = bb.getDataRange().getValues();
  var bh = data.length ? data[0].map(function (x) { return String(x).trim().toLowerCase(); }) : [];
  var jCode = bh.indexOf('mã task'); if (jCode < 0) jCode = 1;
  var jUrl = -1; for (var k = 0; k < bh.length; k++) if (/biên bản|url/i.test(bh[k])) jUrl = k; if (jUrl < 0) jUrl = 2;
  var last = tasks.getLastRow();
  var codes = last > 1 ? tasks.getRange(2, iCode + 1, last - 1, 1).getValues() : [];
  var rowByCode = {}; for (var r = 0; r < codes.length; r++) rowByCode[String(codes[r][0]).trim()] = r + 2;
  var moved = 0, skipped = [];
  for (var d = 1; d < data.length; d++) {
    var code = String(data[d][jCode] || '').trim(), url = String(data[d][jUrl] || '').trim();
    if (!code || !/^https?:/.test(url)) continue;
    if (/^test/i.test(code)) continue;
    var rr = rowByCode[code];
    if (!rr) { skipped.push(code + ' (khong co trong 5S-TASKS)'); continue; }
    var cell = tasks.getRange(rr, iBB + 1); var cur = String(cell.getValue() || '').trim();
    if (cur.indexOf(url) < 0) { cell.setValue(cur ? (cur + '\n' + url) : url); moved++; }
  }
  ss.deleteSheet(bb);
  var msg = 'XONG. Da chuyen ' + moved + ' bien ban vao 5S-TASKS + xoa tab BIEN-BAN.' + (skipped.length ? (' Bo qua: ' + skipped.join(', ')) : '');
  Logger.log(msg);
  return msg;
}

function apiPending(e) {
  if ((e.parameter.key || '') !== SECRET) return phanHoiJson({ status: 'error', message: 'Sai key' });
  var sheet = layHoacTaoSheet();
  var last = sheet.getLastRow();
  if (last < 2) return phanHoiJson({ status: 'success', rows: [] });
  var values = sheet.getRange(2, 1, last - 1, SO_COT).getValues();
  var rows = [];
  for (var i = 0; i < values.length && rows.length < MAX_PENDING; i++) {
    var r = values[i];
    var rowIndex = i + 2;
    var maTask = String(r[COL_MA_TASK - 1] || '').trim();
    var hangMuc = String(r[3] || '').trim();
    if (maTask) continue;
    if (!hangMuc) continue;
    if (hangMuc.indexOf(KHONG_VI_PHAM_PREFIX) === 0) {
      sheet.getRange(rowIndex, COL_MA_TASK).setValue('(không vi phạm - bỏ qua)');
      continue;
    }
    rows.push({
      row: rowIndex,
      ngay: formatNgay(r[0]),
      hienTrang: String(r[1] || ''),
      viTri: String(r[2] || ''),
      hangMuc: hangMuc,
      thoiGianViPham: formatNgay(r[COL_TG_VI_PHAM - 1]),
      images: layAnhBase64(String(r[4] || ''))
    });
  }
  return phanHoiJson({ status: 'success', rows: rows });
}

function apiMark(e) {
  if ((e.parameter.key || '') !== SECRET) return phanHoiJson({ status: 'error', message: 'Sai key' });
  var row = parseInt(e.parameter.row, 10);
  var code = e.parameter.code || '';
  if (!row) return phanHoiJson({ status: 'error', message: 'Thiếu row' });
  layHoacTaoSheet().getRange(row, COL_MA_TASK).setValue(code);
  return phanHoiJson({ status: 'success' });
}

/** Gửi email cảnh báo (vd: phiên work.hasaki.vn hết hạn). Chống spam theo ALERT_THROTTLE_GIO. */
function apiAlert(e) {
  if ((e.parameter.key || '') !== SECRET) return phanHoiJson({ status: 'error', message: 'Sai key' });
  var msg = e.parameter.msg || 'Bộ đẩy báo cáo 5S gặp sự cố.';
  var props = PropertiesService.getScriptProperties();
  var last = Number(props.getProperty('LAST_ALERT_MS') || 0);
  var now = new Date().getTime();
  if (now - last < ALERT_THROTTLE_GIO * 3600 * 1000) {
    return phanHoiJson({ status: 'success', skipped: true, message: 'Đã gửi gần đây, bỏ qua để tránh spam.' });
  }
  try {
    var thoiDiem = Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd HH:mm:ss');
    var textBody =
      '⚠️ Hệ thống 5S đã TỰ ĐỘNG thử đăng nhập lại work.hasaki.vn nhưng THẤT BẠI:\n\n' + msg +
      '\n\nBình thường token hết hạn sẽ tự đăng nhập lại (email + mật khẩu + OTP tự sinh) —\n' +
      'mail này CHỈ gửi khi việc tự động đó KHÔNG thành công, tức cần kiểm tra tay.\n\n' +
      'Nguyên nhân có thể:\n' +
      '  • Mật khẩu công ty đã đổi → cập nhật HASAKI_PASSWORD trong .env\n' +
      '  • Tài khoản bị khoá tạm (nhập sai nhiều lần) → chờ mở khoá\n' +
      '  • Khoá 2FA (HASAKI_2FA_SECRET) sai/đổi → cập nhật lại\n' +
      '  • Cổng đăng nhập nâng cấp bảo mật (Turnstile) hoặc đổi giao diện\n\n' +
      'Kiểm tra tại máy chạy: mở thư mục dự án và chạy\n    node login-hasaki.js --show\n' +
      'để xem cửa sổ đăng nhập và tìm chỗ kẹt. Vào được rồi thì lịch tự động chạy lại bình thường.\n\n' +
      'Thời điểm: ' + thoiDiem;
    var htmlBody =
      '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;line-height:1.6">' +
      '<p>⚠️ Hệ thống 5S đã <b>tự động thử đăng nhập lại</b> work.hasaki.vn nhưng <b>THẤT BẠI</b>:</p>' +
      '<p style="background:#fdecea;border:1px solid #f5a3a3;padding:10px 12px;border-radius:6px">' + msg + '</p>' +
      '<p style="color:#555">Token hết hạn bình thường sẽ <b>tự đăng nhập lại</b> (email + mật khẩu + OTP tự sinh). ' +
      'Mail này CHỈ gửi khi việc tự động đó không thành công → cần kiểm tra tay.</p>' +
      '<p><b>Nguyên nhân có thể:</b></p>' +
      '<ul style="color:#333">' +
      '<li>Mật khẩu công ty đã đổi → cập nhật <code>HASAKI_PASSWORD</code> trong <code>.env</code></li>' +
      '<li>Tài khoản bị khoá tạm (nhập sai nhiều lần) → chờ mở khoá</li>' +
      '<li>Khoá 2FA (<code>HASAKI_2FA_SECRET</code>) sai/đổi → cập nhật lại</li>' +
      '<li>Cổng đăng nhập nâng cấp Turnstile hoặc đổi giao diện</li>' +
      '</ul>' +
      '<p style="color:#555">Tại máy chạy: mở thư mục dự án, chạy <code>node login-hasaki.js --show</code> để xem cửa sổ đăng nhập và tìm chỗ kẹt.</p>' +
      '<p style="color:#888;font-size:12px;margin-top:18px">Thời điểm: ' + thoiDiem + '</p>' +
      '</div>';
    MailApp.sendEmail({
      to: ALERT_EMAIL,
      subject: '[5S] ⚠️ Tự đăng nhập work.hasaki.vn THẤT BẠI — cần kiểm tra tay',
      body: textBody,
      htmlBody: htmlBody
    });
    props.setProperty('LAST_ALERT_MS', String(now));
    return phanHoiJson({ status: 'success', sent: true });
  } catch (err) {
    return phanHoiJson({ status: 'error', message: String(err) });
  }
}

/** CHẠY TAY 1 LẦN trong editor để cấp quyền gửi mail + test ngay (gửi mail mẫu về ALERT_EMAIL). */
function testGuiMail() {
  MailApp.sendEmail(ALERT_EMAIL, '[5S] TEST email cảnh báo',
    'Đây là email TEST từ hệ thống 5S. Nếu bạn nhận được mail này nghĩa là luồng cảnh báo đã hoạt động.\n' +
    'Thời điểm: ' + Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd HH:mm:ss'));
  Logger.log('Đã gửi email test tới ' + ALERT_EMAIL);
}

/** Trả về ID/URL spreadsheet (để cấu hình dashboard gviz). */
function apiInfo(e) {
  if ((e.parameter.key || '') !== SECRET) return phanHoiJson({ status: 'error', message: 'Sai key' });
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return phanHoiJson({ status: 'success', sheetId: ss.getId(), sheetUrl: ss.getUrl(), tabTasks: TEN_SHEET_TASKS });
}

/** Ghi đè 1 tab bằng dữ liệu do bộ sync gửi lên (mặc định 5S-TASKS; có thể chỉ định tab khác, vd CHAM-CONG).
 *  Mở rộng:
 *   - duLieu.sheetId : ghi sang SPREADSHEET NGOÀI (vd Tồn mã vị trí — stocklocationfactory) thay vì sheet 5S.
 *   - duLieu.append  : true = ghi NỐI TIẾP sau dòng cuối (bộ sync chia dữ liệu lớn thành nhiều POST;
 *                      gói ĐẦU append=false sẽ XOÁ SẠCH tab trước khi ghi — chống rác data cũ). */
function apiSyncTasks(duLieu) {
  if ((duLieu.key || '') !== SECRET) return phanHoiJson({ status: 'error', message: 'Sai key' });
  var header = duLieu.header || [];
  var rows = duLieu.rows || [];
  // CHẶN XOÁ TRẮNG: rows rỗng -> KHÔNG clear+ghi (tránh mất sạch dữ liệu tab khi 1 lượt sync lỗi ra 0 dòng)
  if (!rows.length) return phanHoiJson({ status: 'error', message: 'rows rỗng — bỏ qua, không ghi đè tab.' });
  var tenTab = duLieu.tab || TEN_SHEET_TASKS;   // tab đích (mặc định 5S-TASKS; vd NHAN-SU)
  var noiTiep = duLieu.append === true;
  var ss;
  if (duLieu.sheetId) {
    try { ss = SpreadsheetApp.openById(String(duLieu.sheetId)); }
    catch (eX) { return phanHoiJson({ status: 'error', message: 'Không mở được sheet ngoài (sheetId): ' + eX.message }); }
  } else if ((PII_TABS.indexOf(tenTab) >= 0 || SERVE_PRIVATE_TABS.indexOf(tenTab) >= 0) && PRIVATE_SHEET_ID) {
    try { ss = SpreadsheetApp.openById(PRIVATE_SHEET_ID); }
    catch (e) { return phanHoiJson({ status: 'error', message: 'Không mở được sheet riêng (PRIVATE_SHEET_ID): ' + e.message }); }
  } else {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  }
  var sheet = ss.getSheetByName(tenTab);
  if (!sheet) sheet = ss.insertSheet(tenTab);
  if (noiTiep) {
    if (header.length) sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, header.length).setValues(rows);
  } else {
    sheet.clearContents();
    var all = [header].concat(rows);
    /* Gỡ ô hợp nhất CHỈ TRONG VÙNG SẮP GHI (12/08/2026). Trước quét cả lưới getMaxRows ×
       getMaxColumns — với tab ~40k dòng là việc nặng vô ích mỗi lần ghi, mà execution càng dài thì
       Google càng hay 404 ở khâu lấy nội dung. Ô hợp nhất ngoài vùng ghi không ảnh hưởng setValues. */
    if (all.length && header.length) {
      try { sheet.getRange(1, 1, all.length, header.length).breakApart(); } catch (e) {}
    }
    if (all.length && header.length) {
      sheet.getRange(1, 1, all.length, header.length).setValues(all);
      sheet.getRange(1, 1, 1, header.length).setFontWeight('bold').setBackground('#0f766e').setFontColor('#ffffff');
      try { sheet.setFrozenRows(1); } catch (e) {}  // bỏ qua nếu còn vướng ô hợp nhất
    }
  }
  // Mốc "dữ liệu mới nhất" cho dashboard (chip giờ dữ liệu) — ƯU TIÊN apiAt (lúc LẤY DỮ LIỆU từ API WMS,
  // do bộ đồng bộ gửi kèm); thiếu thì mới lấy giờ ghi Sheet
  try {
    var apiAt = Number(duLieu.apiAt || 0) || new Date().getTime();
    PropertiesService.getScriptProperties().setProperty('LAST_SYNC_' + tenTab, String(apiAt));
  } catch (e) {}
  // Tab vừa đổi dữ liệu → bỏ cache readTab của nó, đừng để dashboard đọc bản cũ (xem rtGhiCache_)
  if (SERVE_PRIVATE_TABS.indexOf(tenTab) >= 0) rtXoaCache_(tenTab);
  return phanHoiJson({ status: 'success', written: rows.length, append: noiTiep, at: Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd HH:mm:ss') });
}

/** Dashboard hỏi lần ghi dữ liệu gần nhất (mặc định tab 5S-TASKS) — JSONP {status, ts}. Không lộ gì nhạy cảm. */
function apiLastSync(e) {
  var cb = e.parameter.callback || 'cb';
  var tab = e.parameter.tab || TEN_SHEET_TASKS;
  if (PII_TABS.indexOf(tab) >= 0) return phanHoiJsonp(cb, { status: 'error', message: 'Tab riêng tư' });
  var ts = Number(PropertiesService.getScriptProperties().getProperty('LAST_SYNC_' + tab) || 0);
  return phanHoiJsonp(cb, { status: 'success', ts: ts });
}

/* ===== CACHE PHỤC VỤ readTab (12/08/2026) =====
 * ĐO THẬT trước khi làm: readTab VESINH-YEUCAU mất 39s và TRƯỢT 9/10 lượt (404 rơi ngẫu nhiên ở
 * giây 18-90), tab nhỏ CHAMCONG-VESINH 8,4s, còn JSON tĩnh bridgeCaps chỉ 1,4s. Nghĩa là chi phí
 * nằm ở chính lượt thực thi phải openById SHEET PRIVATE (file này to: NHAN-SU, CHAM-CONG, LICHSU 60
 * ngày…) rồi getValues + serialize lại y nguyên một kết quả mà cả ngày chỉ đổi vài lần.
 * → Dựng SẴN chuỗi JSON, giữ trong CacheService: lượt sau không mở Sheet nữa, execution ngắn hẳn
 *   (đỡ luôn hạn mức runtime của tài khoản, thứ đang khiến 404 rơi ngẫu nhiên). Đo sau khi bật:
 *   VESINH-YEUCAU 15-100s (hay 404) → 2,1-2,2s.
 * Cache giới hạn 100KB/khoá nên phải CẮT KHÚC; tab nào được ghi thì xoá cache tab đó (apiSyncTasks).
 * Mất 1 khúc (cache bị đẩy ra) = coi như không có cache, đọc lại Sheet — không bao giờ trả nửa vời.
 * CHỈ CACHE PHẦN THÂN (header+rows), KHÔNG cache 'ts': hash-skip của poller mỗi 15' vẫn gọi
 * touchTabs để chip giờ dashboard chạy theo giờ quét THẬT — nếu ts nằm trong cache thì cứ 15 phút
 * lại phải xoá cache dù DỮ LIỆU KHÔNG ĐỔI, cache thành vô nghĩa. Ghép ts vào lúc trả (đọc property
 * tươi, ~0 chi phí) → touchTabs không cần đụng cache, chip giờ vẫn đúng.
 * Bộ sync tự HÂM cache sau khi ghi (session-rules.js hamCacheTabs) để lượt dựng đắt đỏ rơi vào
 * tiến trình nền, không rơi vào người mở dashboard. */
var RT_CACHE_PREFIX = 'RT3:';          // RT3: bản @52 từng cache cả ts trong thân — phải bỏ hẳn entry cũ
/* 50.000 ký tự/khúc, ghi bằng put() TỪNG KHÚC (không putAll cả gói): đo thật 12/08 — tab nhỏ 6,5KB
   (1 khúc) cache ăn ngay (3,4s → 1,25s), còn tab 131KB cắt 90.000 ký tự × 2 khúc thì lượt sau VẪN
   17s = cả gói putAll bị từ chối (im lặng, nằm trong try/catch). */
var RT_CACHE_KHUC = 50000;
var RT_CACHE_SONG = 6 * 60 * 60;       // 6 giờ

function rtKhoa_(tab, i) { return RT_CACHE_PREFIX + tab + ':' + i; }

function rtDocCache_(tab) {
  try {
    var c = CacheService.getScriptCache();
    var n = Number(c.get(RT_CACHE_PREFIX + tab + ':n') || 0);
    if (n <= 0) return null;
    var khoa = [];
    for (var i = 0; i < n; i++) khoa.push(rtKhoa_(tab, i));
    var got = c.getAll(khoa), s = '';
    for (var j = 0; j < n; j++) {
      var phan = got[rtKhoa_(tab, j)];
      if (phan == null) return null;   // thiếu khúc → dựng lại từ Sheet
      s += phan;
    }
    return s;
  } catch (e) { return null; }
}

function rtGhiCache_(tab, chuoiJson) {
  try {
    var c = CacheService.getScriptCache(), n = 0;
    for (var i = 0; i < chuoiJson.length; i += RT_CACHE_KHUC) {
      c.put(rtKhoa_(tab, n), chuoiJson.substring(i, i + RT_CACHE_KHUC), RT_CACHE_SONG);
      n++;
    }
    // Ghi khoá đếm SAU CÙNG: khúc nào hỏng giữa đường thì :n không tồn tại → lượt đọc coi như
    // chưa có cache và dựng lại, chứ không bao giờ đọc một bộ khúc thiếu.
    c.put(RT_CACHE_PREFIX + tab + ':n', String(n), RT_CACHE_SONG);
  } catch (e) {}   // cache hỏng thì bỏ qua, đường đọc Sheet vẫn nguyên
}

function rtXoaCache_(tab) {
  try {
    var c = CacheService.getScriptCache();
    var n = Number(c.get(RT_CACHE_PREFIX + tab + ':n') || 0);
    var khoa = [RT_CACHE_PREFIX + tab + ':n'];
    for (var i = 0; i < n + 4; i++) khoa.push(rtKhoa_(tab, i));   // +4: chừa cho bản cũ nhiều khúc hơn
    c.removeAll(khoa);
  } catch (e) {}
}

function rtTraJsonp_(cb, chuoiJson) {
  return ContentService.createTextOutput(cb + '(' + chuoiJson + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
}

/** Dashboard đọc 1 tab nằm ở SHEET PRIVATE (chỉ whitelist SERVE_PRIVATE_TABS) — JSONP {status, header, rows, ts}.
 *  Sheet gốc không public; dữ liệu chỉ ra ngoài qua endpoint này (đủ cho dashboard vốn public, nhưng file gốc kín). */
function apiReadTab(e) {
  var cb = e.parameter.callback || 'cb';
  var tab = e.parameter.tab || '';
  if (SERVE_PRIVATE_TABS.indexOf(tab) < 0) return phanHoiJsonp(cb, { status: 'error', message: 'Tab không được phục vụ' });
  var ts = Number(PropertiesService.getScriptProperties().getProperty('LAST_SYNC_' + tab) || 0);
  if (e.parameter.moi !== '1') {   // moi=1: ép bỏ cache, đọc thẳng Sheet (để đối chiếu khi cần)
    var than = rtDocCache_(tab);
    if (than) return rtTraJsonp_(cb, than + ',"ts":' + ts + '}');
  }
  var ss = PRIVATE_SHEET_ID ? SpreadsheetApp.openById(PRIVATE_SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(tab);
  if (!sh || sh.getLastRow() < 1 || sh.getLastColumn() < 1) return phanHoiJsonp(cb, { status: 'success', header: [], rows: [], ts: ts });
  var tz = ss.getSpreadsheetTimeZone() || 'GMT+7';
  var vals = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  var header = (vals.shift() || []).map(function (h) { return String(h); });
  var rows = vals.map(function (r) {
    return r.map(function (v) {
      if (v instanceof Date) {   // Sheets tự nhận "07:52" thành GIỜ (Date năm 1899) → HH:mm; ngày → yyyy-MM-dd; NGÀY+GIỜ (vd Executed At) → giữ cả giờ
        if (v.getFullYear() <= 1900) return Utilities.formatDate(v, tz, 'HH:mm');
        return Utilities.formatDate(v, tz, (v.getHours() || v.getMinutes() || v.getSeconds()) ? 'yyyy-MM-dd HH:mm' : 'yyyy-MM-dd');
      }
      return v;
    });
  });
  /* Cắt dấu '}' cuối để phần thân ghép được với ',"ts":…}' — thứ tự khoá trong JSON không đổi
     (status, header, rows, ts) nên client nhận đúng như cũ. */
  var goc = JSON.stringify({ status: 'success', header: header, rows: rows });
  var than2 = goc.substring(0, goc.length - 1);
  rtGhiCache_(tab, than2);
  return rtTraJsonp_(cb, than2 + ',"ts":' + ts + '}');
}

/** Xoá 1 tab whitelist khỏi SHEET PUBLIC (dọn bản sao cũ sau khi đã chuyển ghi sang sheet private). Cần key. */
function apiPurgeTab(duLieu) {
  var tab = String(duLieu.tab || '');
  // Cho phép thêm tab tiền tố 'ZZ-' (12/08/2026): tab NHÁP khi kiểm thử backend, để kiểm xong dọn được.
  var laNhap = tab.indexOf('ZZ-') === 0;
  if (!laNhap && SERVE_PRIVATE_TABS.indexOf(tab) < 0) return phanHoiJson({ status: 'error', message: 'Chỉ purge tab trong whitelist hoặc tab nháp ZZ-' });
  var ss = SpreadsheetApp.getActiveSpreadsheet();   // sheet PUBLIC (5S)
  var sh = ss.getSheetByName(tab);
  if (!sh) return phanHoiJson({ status: 'success', deleted: null, message: 'Không có tab trên sheet public' });
  ss.deleteSheet(sh);
  return phanHoiJson({ status: 'success', deleted: tab });
}

/** Tải biên bản (ảnh) cho 1 task -> lưu Drive + ghi tab BIEN-BAN. duLieu={key,code,files:[{name,mime,base64}]} */
function apiUploadBienBan(duLieu) {
  var code = String(duLieu.code || '').trim();
  if (!code) return phanHoiJson({ status: 'error', message: 'Thiếu mã task' });
  // BẢO MẬT: bắt buộc đúng PIN mới cho ghi (trước đây công khai → ai cũng nhồi ảnh vào Drive/Sheet).
  if (pinBiKhoa_('bienban')) return phanHoiJson({ status: 'error', message: 'Nhập sai PIN quá nhiều lần. Thử lại sau 15 phút.' });
  if (String(duLieu.pin || '') !== SYNC_PIN) { ghiNhanSaiPin_('bienban'); return phanHoiJson({ status: 'error', message: 'Sai PIN' }); }
  xoaSaiPin_('bienban');
  var files = duLieu.files || [];
  if (!files.length) return phanHoiJson({ status: 'error', message: 'Không có ảnh' });
  if (files.length > 10) return phanHoiJson({ status: 'error', message: 'Tối đa 10 ảnh/lần' });
  var it = DriveApp.getFoldersByName('WMS-5S-BIENBAN');
  var folder = it.hasNext() ? it.next() : DriveApp.createFolder('WMS-5S-BIENBAN');
  var urls = [];
  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    // Chỉ nhận ẢNH và < 5MB (base64 dài ~4/3 lần dung lượng thật)
    var mime = String(f.mime || 'image/jpeg');
    if (!/^image\//.test(mime)) return phanHoiJson({ status: 'error', message: 'Chỉ chấp nhận tệp ảnh (' + mime + ')' });
    var b64 = String(f.base64 || '');
    if (b64.length * 3 / 4 > 5 * 1024 * 1024) return phanHoiJson({ status: 'error', message: 'Ảnh vượt 5MB' });
    var blob = Utilities.newBlob(Utilities.base64Decode(b64), mime, f.name || ('bienban_' + code + '_' + new Date().getTime() + '.jpg'));
    var file = folder.createFile(blob);
    try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
    urls.push('https://drive.google.com/uc?export=view&id=' + file.getId());
  }
  // Ghi URL vào cột "Biên bản" (cuối) của tab 5S-TASKS, tại dòng có Task Code == code
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('5S-TASKS');
  if (sh) {
    var lastCol = sh.getLastColumn(), lastRow = sh.getLastRow();
    var head = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    var iCode = -1, iBB = -1;
    for (var c = 0; c < head.length; c++) { var h = String(head[c]).trim().toLowerCase(); if (h === 'task code') iCode = c; if (h === 'biên bản') iBB = c; }
    if (iCode < 0) for (var c2 = 0; c2 < head.length; c2++) if (/task code/i.test(head[c2])) iCode = c2;
    if (iBB < 0) { iBB = lastCol; sh.getRange(1, iBB + 1).setValue('Biên bản').setFontWeight('bold').setBackground('#0f766e').setFontColor('#ffffff'); }
    if (iCode >= 0 && lastRow > 1) {
      var codes = sh.getRange(2, iCode + 1, lastRow - 1, 1).getValues();
      for (var r = 0; r < codes.length; r++) if (String(codes[r][0]).trim() === code) {
        var cell = sh.getRange(r + 2, iBB + 1); var cur = String(cell.getValue() || '').trim();
        cell.setValue((cur ? cur + '\n' : '') + urls.join('\n')); break;
      }
    }
  }
  return phanHoiJson({ status: 'success', urls: urls });
}

/* ================== TỒN MÃ VỊ TRÍ (stocklocationfactory) ==================
 *  - apiSaveWmsToken : Node (sync-stocklocation.js, lịch 7h) đẩy Bearer token WMS
 *    mới nhất lên. LƯU Ở SCRIPT PROPERTIES, KHÔNG ghi vào Sheet — sheet stocklocation
 *    công khai (dashboard đọc gviz), ghi token vào đó là LỘ credential.
 *  - apiSetStockMeta : Node báo "đã ghi data xong lúc <at>" → ghi mốc vào tab Metadata
 *    (A1 = giờ hiển thị, B1 = epoch ms) để dashboard đọc qua gviz + làm mốc cooldown.
 *  - apiForceSyncWms : nút "Tải lại dữ liệu" trên dashboard → GAS TỰ gọi API WMS
 *    (phân trang + lọc kho hardcode) và ghi đè 2 tab. Cooldown 4h kiểm ở MÁY CHỦ
 *    (đọc lại Metadata) để chặn bypass UI; vi phạm trả code 429 trong JSON
 *    (Apps Script không đặt được HTTP status thật). Token chết trả code 401.
 * ========================================================================== */
var STOCKLOC_SHEET_ID = '1eY_oo9fAvWCTXp24x-Z0FXq9mp_jJPlTHg09qdemETs';
var STOCKLOC_META_TAB = 'Metadata';
var STOCKLOC_COOLDOWN_MS = 4 * 60 * 60 * 1000;   // 4 giờ / lần gọi WMS
var STOCKLOC_API = 'https://wms-gw.inshasaki.com/api/v1/wms/report-management/stock-locations/bins/count/v3';
var STOCKLOC_HEADER = ['SKU', 'Barcode', 'ProductName', 'LocationDescription', 'BrandName', 'CategoryName', 'Warehouse',
  'InbinQuantity', 'PicklistedQuantity', 'PickingQuantity', 'NotfoundQuantity', 'PackedQuantity', 'Total',
  'Created Date', 'Updated Date', 'StorageTypeName', 'ClassifyName', 'Shelf Life (month)'];
// Hardcode List kho đã chốt (khớp sync-stocklocation.js — sửa 1 nơi thì sửa cả 2)
var STOCKLOC_BO = [
  { tab: 'mastige', company: '1002', warehouses: '1458,1441,1307,1250,1179,1178,1177,1151',
    khoGiuLai: ['WH - MATERIAL - MTG', 'OFFICE - 130 AP CHANH - MTG', 'WH - SEMI PRODUCT - MTG',
      'SAMPLE - 130 AP CHANH - MTG', 'NG - MATERIAL - 130 AP CHANH - MTG',
      'NG - OFFICE - 130 AP CHANH - MTG', 'GARMENT - 130 AP CHANH - MTG', 'WH - FINISHED GOODS - MTG'] },
  { tab: 'garment', company: '1005', warehouses: '1458,1441,1307,1250,1179,1178,1177,1151,1516,1341,1340,1339,1266',
    khoGiuLai: ['WH - MATERIAL - GARMENT', 'SHOP - 130 AP CHANH - GARMENT',
      'NG - 130 AP CHANH - GARMENT', 'WH - SEMI PRODUCT - GARMENT'] },
];

function apiSaveWmsToken(duLieu) {
  var tk = String(duLieu.token || '').trim();
  if (!tk) return phanHoiJson({ status: 'error', message: 'Thiếu token' });
  var p = PropertiesService.getScriptProperties();
  p.setProperty('WMS_TOKEN', tk);
  p.setProperty('WMS_TOKEN_AT', String(new Date().getTime()));
  return phanHoiJson({ status: 'success' });
}

/** Ghi mốc đồng bộ WMS cuối vào tab Metadata của sheet stocklocation (+ Script Properties). */
function ghiStockMeta_(atMs) {
  try {
    var ss = SpreadsheetApp.openById(STOCKLOC_SHEET_ID);
    var sh = ss.getSheetByName(STOCKLOC_META_TAB) || ss.insertSheet(STOCKLOC_META_TAB);
    sh.getRange(1, 1, 1, 3).setValues([[
      Utilities.formatDate(new Date(atMs), 'GMT+7', 'HH:mm:ss dd/MM/yyyy'),
      atMs,
      'Mốc đồng bộ WMS cuối — dashboard đọc B1 (epoch ms), đừng sửa tay',
    ]]);
  } catch (e) { /* không chặn luồng chính vì lỗi metadata */ }
  PropertiesService.getScriptProperties().setProperty('STOCKLOC_LAST_MS', String(atMs));
}
function docStockMetaMs_() {
  var ms = Number(PropertiesService.getScriptProperties().getProperty('STOCKLOC_LAST_MS') || 0);
  if (!ms) {
    try { ms = Number(SpreadsheetApp.openById(STOCKLOC_SHEET_ID).getSheetByName(STOCKLOC_META_TAB).getRange(1, 2).getValue()) || 0; } catch (e) {}
  }
  return ms;
}
/** 26/07/2026 (nhịp phân tầng): bộ sync báo "vừa KIỂM TRA nguồn WMS/work/planogram lúc apiAt
 *  nhưng dữ liệu KHÔNG đổi (hash-skip, không ghi lại tab)" → chỉ chạm mốc LAST_SYNC_<tab>
 *  để chip "cập nhật lúc" trên các dashboard vẫn chạy đúng giờ kiểm tra thật.
 *  KHÔNG đụng tab Metadata — Metadata giữ nguyên ngữ nghĩa "lần đồng bộ tồn-vị-trí cuối"
 *  (mốc cooldown 4h của nút Tải lại + mốc sync-guard đọc). */
function apiTouchTabs(duLieu) {
  var tabs = Array.isArray(duLieu.tabs) ? duLieu.tabs : [];
  var at = Number(duLieu.apiAt || 0) || new Date().getTime();
  var p = PropertiesService.getScriptProperties();
  var ok = 0;
  for (var i = 0; i < tabs.length; i++) {
    var t = String(tabs[i] || '').trim();
    if (!t || t.length > 64) continue;
    try { p.setProperty('LAST_SYNC_' + t, String(at)); ok++; } catch (e) { /* best-effort từng tab */ }
  }
  return phanHoiJson({ status: 'success', touched: ok, at: at });
}

function apiSetStockMeta(duLieu) {
  var at = Number(duLieu.at || 0) || new Date().getTime();
  ghiStockMeta_(at);
  // Node vừa ghi xong toàn bộ (đây là bước chốt) → cắt gọt lưới các tab tồn kho cho file nhẹ
  try {
    var ss = SpreadsheetApp.openById(STOCKLOC_SHEET_ID);
    for (var i = 0; i < STOCKLOC_BO.length; i++) {
      var sh = ss.getSheetByName(STOCKLOC_BO[i].tab);
      if (sh) catGonSheet_(sh, sh.getLastRow(), STOCKLOC_HEADER.length);
    }
    var mt = ss.getSheetByName(STOCKLOC_META_TAB);
    if (mt) catGonSheet_(mt, 1, 3);
  } catch (e) { /* cắt gọt lỗi không chặn luồng chính */ }
  return phanHoiJson({ status: 'success', at: at });
}

/* ================== CỜ TẢI LẠI + TOKEN BRIDGE (thêm 21/07/2026) ==================
 * Sự cố nền: WMS 1 phiên/tài khoản — GAS/bot re-login là đá văng người đang làm việc.
 * Kiến trúc mới cho nút "Tải lại dữ liệu": GAS KHÔNG tự gọi WMS theo yêu cầu khách nữa,
 * chỉ ĐẶT CỜ STOCK_SYNC_REQUESTED; máy trạm (watch-login-request.js → sync-guard.js) thấy
 * cờ thì kéo dữ liệu theo LUẬT PHIÊN (ưu tiên token bridge, chỉ re-login trong khung an toàn).
 * Token bridge: extension wms-bridge đẩy token phiên ĐANG SỐNG của operator lên đây
 * (bridgeToken — public, chỉ nhận đúng dạng JWT + throttle 30s; token rác vô hại vì máy
 * trạm luôn kiểm get-me trước khi dùng). Máy trạm lấy lại bằng getBridgeToken (SECRET).
 * ================================================================================= */
function apiRequestStockSync(duLieu) {
  var last = docStockMetaMs_(), now = new Date().getTime();
  if (last && now - last < STOCKLOC_COOLDOWN_MS) {
    var cho = STOCKLOC_COOLDOWN_MS - (now - last);
    return phanHoiJson({ status: 'error', code: 429, message: 'Chỉ có thể tải lại dữ liệu sau mỗi 4 giờ. Còn ' + Math.ceil(cho / 60000) + ' phút nữa.', retryAfterMs: cho, lastSync: last });
  }
  var P = PropertiesService.getScriptProperties();
  var lanTruoc = Number(P.getProperty('LAST_STOCK_REQUEST_MS') || 0);
  if (now - lanTruoc >= 60 * 1000) {   // chống spam cờ: 60s chỉ ghi 1 lần, các lượt sau coi như đã xếp hàng
    P.setProperty('LAST_STOCK_REQUEST_MS', String(now));
    P.setProperty('STOCK_SYNC_REQUESTED', String(now));
  }
  return phanHoiJson({ status: 'success', queued: true, message: 'Đã gửi yêu cầu tới máy trạm — dữ liệu sẽ được cập nhật trong ít phút (trong giờ làm cần trình duyệt có extension wms-bridge đang mở WMS).', lastSync: last || 0 });
}
/* v1.4.0 extension (30/07/2026) — HAI KHE: kind='wms' (mặc định, giữ nguyên khoá cũ) và
 * kind='wshr' (work/hr). Khe wshr lưu vào khoá RIÊNG để không ghi đè token WMS.
 * Tương thích ngược: payload KHÔNG có `kind` vẫn được hiểu là 'wms' đúng như bản cũ. */
function khoaBridge_(kind) {
  return String(kind || 'wms') === 'wshr'
    ? { tk: 'BRIDGE_WSHR_TOKEN', at: 'BRIDGE_WSHR_TOKEN_AT', exp: 'BRIDGE_WSHR_TOKEN_EXP' }
    : { tk: 'BRIDGE_TOKEN', at: 'BRIDGE_TOKEN_AT', exp: 'BRIDGE_TOKEN_EXP' };
}
function apiBridgeToken(duLieu) {
  var K = khoaBridge_(duLieu.kind);
  var tk = String(duLieu.token || '').replace(/^Bearer\s+/i, '').trim();
  if (tk.length < 100 || !/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(tk)) return phanHoiJson({ status: 'error', message: 'Token không hợp lệ' });
  var P = PropertiesService.getScriptProperties();
  var truoc = Number(P.getProperty(K.at) || 0), now = new Date().getTime();
  if (now - truoc < 30 * 1000) return phanHoiJson({ status: 'success', throttled: true });
  P.setProperty(K.tk, tk);
  P.setProperty(K.at, String(now));
  P.setProperty(K.exp, String(Number(duLieu.exp || 0) || 0));
  return phanHoiJson({ status: 'success', saved: true });
}
function apiGetBridgeToken(kind) {
  var K = khoaBridge_(kind);
  var P = PropertiesService.getScriptProperties();
  var tk = P.getProperty(K.tk) || '';
  var at = Number(P.getProperty(K.at) || 0);
  var exp = Number(P.getProperty(K.exp) || 0);
  var now = new Date().getTime();
  var song = tk && (now - at < 30 * 60 * 1000) && (!exp || now < exp - 15000);   // tươi <30' và chưa quá hạn JWT
  // `at` LUÔN trả về (kể cả khi hết tươi) — máy trạm cần TUỔI để tính "cửa im lặng" của luật
  // "chỉ login khi không có phiên sống"; bản cũ trả at:0 nên không phân biệt được "chưa từng có
  // bridge" với "bridge vừa im 5 phút" hay "im 3 tiếng".
  return phanHoiJson(song
    ? { status: 'success', token: tk, at: at, exp: exp }
    : { status: 'success', token: '', at: at, coTungCo: !!tk });
}

/** Kéo trọn 1 công ty từ WMS (phân trang size 5000) + LỌC theo khoGiuLai. Trả {rows} hoặc {code,message}. */
function keoWmsBo_(token, cfg) {
  var auth = /^Bearer /i.test(token) ? token : 'Bearer ' + token;
  var giu = {};
  for (var g = 0; g < cfg.khoGiuLai.length; g++) giu[cfg.khoGiuLai[g].replace(/\s+/g, ' ').trim().toUpperCase()] = 1;
  var rows = [], size = 5000, count = null, daLay = 0;
  for (var page = 1; page <= 40; page++) {
    var url = STOCKLOC_API + '?company_ids=' + cfg.company + '&warehouse_ids=' + encodeURIComponent(cfg.warehouses) +
      '&ignore_zero_total=1&page=' + page + '&size=' + size;
    var resp;
    try { resp = UrlFetchApp.fetch(url, { headers: { Authorization: auth }, muteHttpExceptions: true }); }
    catch (e) { return { code: 502, message: 'Không gọi được WMS: ' + e.message }; }
    var http = resp.getResponseCode();
    if (http === 401 || http === 403) return { code: 401 };
    if (http >= 400) return { code: http, message: 'WMS trả lỗi HTTP ' + http + ' (trang ' + page + ', cty ' + cfg.company + ').' };
    var j; try { j = JSON.parse(resp.getContentText()); } catch (e) { return { code: 502, message: 'WMS trả dữ liệu không phải JSON.' }; }
    var recs = j.records || (j.data && j.data.records) || [];
    if (count === null) count = (j.count != null ? j.count : (j.total != null ? j.total : null));
    for (var r = 0; r < recs.length; r++) {
      var it = recs[r];
      var kho = String(it.warehouse_name || '').replace(/\s+/g, ' ').trim().toUpperCase();
      if (!giu[kho]) continue;   // BỘ LỌC KHO CHUYÊN BIỆT — chỉ giữ kho trong hardcode list
      rows.push([it.sku || '', it.barcode || '', it.product_name || '', it.location_description || '', it.brand_name || '',
        it.category_name || '', it.warehouse_name || '', (it.count_inbin == null ? '' : Number(it.count_inbin)), '', '', '', '',
        (it.quantity == null ? '' : Number(it.quantity)), it.created_at || '', it.updated_at || '',
        it.storage_type_name || '', it.product_type_name || '', it.shelf_life || '']);
    }
    daLay += recs.length;
    if (!recs.length) break;
    if (count !== null && daLay >= count) break;
    Utilities.sleep(500);   // nghỉ 0.5s giữa các trang — kéo tuần tự, không dội request lên WMS
  }
  return { rows: rows };
}

/** Cắt gọt sheet về đúng kích thước dữ liệu (xoá dòng/cột trống thừa cuối lưới) → file export/tải nhẹ nhất. */
function catGonSheet_(sh, soDongGiu, soCotGiu) {
  try {
    var canRows = Math.max(Number(soDongGiu) || 1, 1);
    if (sh.getMaxRows() > canRows) sh.deleteRows(canRows + 1, sh.getMaxRows() - canRows);
    if (soCotGiu && sh.getMaxColumns() > soCotGiu) sh.deleteColumns(soCotGiu + 1, sh.getMaxColumns() - soCotGiu);
  } catch (e) { /* sheet đang bị khoá/bảo vệ thì bỏ qua */ }
}

/**
 * ⚙️ DỌN DẸP 1 LẦN (chạy tay trong editor: chọn donDepSheetTonKho → Run):
 *  1) XOÁ tab MTG — bản dữ liệu CŨ của luồng GitHub Actions đã gỡ (đóng băng từ 8/7);
 *     mọi code hiện hành (Node + GAS + dashboard) chỉ đọc/ghi mastige & garment.
 *  2) Cắt gọt lưới các tab tồn kho + Metadata về đúng kích thước dữ liệu.
 *  Chạy lại an toàn (idempotent).
 */
function donDepSheetTonKho() {
  var ss = SpreadsheetApp.openById(STOCKLOC_SHEET_ID);
  var log = [];
  var mtg = ss.getSheetByName('MTG');
  if (mtg && ss.getSheets().length > 1) { ss.deleteSheet(mtg); log.push('MTG: ĐÃ XOÁ (dữ liệu cũ của luồng GitHub Actions đã gỡ).'); }
  else log.push('MTG: không thấy (có thể đã xoá trước đó).');
  for (var i = 0; i < STOCKLOC_BO.length; i++) {
    var sh = ss.getSheetByName(STOCKLOC_BO[i].tab);
    if (!sh) { log.push(STOCKLOC_BO[i].tab + ': chưa có tab.'); continue; }
    var truoc = sh.getMaxRows() + 'x' + sh.getMaxColumns();
    catGonSheet_(sh, sh.getLastRow(), STOCKLOC_HEADER.length);
    log.push(STOCKLOC_BO[i].tab + ': lưới ' + truoc + ' → ' + sh.getMaxRows() + 'x' + sh.getMaxColumns() + '.');
  }
  var mt = ss.getSheetByName(STOCKLOC_META_TAB);
  if (mt) { catGonSheet_(mt, 1, 3); log.push('Metadata: gọn 1x3.'); }
  var msg = log.join('\n');
  Logger.log(msg);
  return msg;
}

/** Nút "Tải lại dữ liệu" trên dashboard — public (không cần SECRET), tự bảo vệ bằng cooldown máy chủ. */
function apiForceSyncWms() {
  var last = docStockMetaMs_(), now = new Date().getTime();
  if (last && now - last < STOCKLOC_COOLDOWN_MS) {
    var cho = STOCKLOC_COOLDOWN_MS - (now - last);
    return phanHoiJson({ status: 'error', code: 429, message: 'Chỉ có thể tải lại dữ liệu sau mỗi 4 giờ. Còn ' + Math.ceil(cho / 60000) + ' phút nữa.', retryAfterMs: cho, lastSync: last });
  }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return phanHoiJson({ status: 'error', code: 429, message: 'Đang có một lượt đồng bộ khác chạy — thử lại sau ít phút.' });
  try {
    var token = PropertiesService.getScriptProperties().getProperty('WMS_TOKEN') || '';
    if (!token) return phanHoiJson({ status: 'error', code: 401, message: 'Token WMS đã hết hạn. Đang chờ luồng chạy ngầm cập nhật Token mới.' });
    // KÉO HẾT 2 công ty TRƯỚC, GHI SAU — lỗi giữa chừng thì data cũ trên Sheet còn nguyên
    var duLieuBo = [];
    for (var b = 0; b < STOCKLOC_BO.length; b++) {
      var kq = keoWmsBo_(token, STOCKLOC_BO[b]);
      if (kq.code === 401) return phanHoiJson({ status: 'error', code: 401, message: 'Token WMS đã hết hạn. Đang chờ luồng chạy ngầm cập nhật Token mới.' });
      if (kq.code) return phanHoiJson({ status: 'error', code: kq.code, message: kq.message });
      duLieuBo.push(kq.rows);
    }
    var ss = SpreadsheetApp.openById(STOCKLOC_SHEET_ID);
    var ketQua = {};
    for (var b2 = 0; b2 < STOCKLOC_BO.length; b2++) {
      var cfg = STOCKLOC_BO[b2], rows = duLieuBo[b2];
      if (!rows.length) { ketQua[cfg.tab] = 0; continue; }   // 0 dòng sau lọc = bất thường → giữ data cũ
      var sh = ss.getSheetByName(cfg.tab) || ss.insertSheet(cfg.tab);
      sh.clearContents();
      var all = [STOCKLOC_HEADER].concat(rows);
      sh.getRange(1, 1, all.length, STOCKLOC_HEADER.length).setValues(all);
      sh.getRange(1, 1, 1, STOCKLOC_HEADER.length).setFontWeight('bold').setBackground('#0f766e').setFontColor('#ffffff');
      try { sh.setFrozenRows(1); } catch (e) {}
      catGonSheet_(sh, all.length, STOCKLOC_HEADER.length);   // xoá dòng trống thừa cuối lưới
      ketQua[cfg.tab] = rows.length;
    }
    var at = new Date().getTime();
    ghiStockMeta_(at);   // bắt đầu chu kỳ cooldown 4h mới
    return phanHoiJson({ status: 'success', at: at, written: ketQua });
  } finally { lock.releaseLock(); }
}

/* ================== KIỂM KÊ MATERIAL (Physical Count) — TAB RIÊNG kiemke-material ==================
 *  GIAI ĐOẠN TEST LUỒNG (theo Technical Risk Assessment):
 *   - CHỈ 2 kho: WH - MATERIAL - MTG + WH - MATERIAL - GARMENT.
 *   - Phân trang TUẦN TỰ (for) + Utilities.sleep(500) — GAS không có Promise.all, và cũng CẤM mô phỏng song song.
 *   - KIEMKE_MAX_PAGE_TEST = 2: tối đa 2 trang (size 1000) mỗi kho — đủ dựng UI, không kéo cả kho.
 *     ⚠ GO-LIVE: nâng/bỏ cap này (đặt 40) sau khi UI được duyệt.
 *   - Ghi DUY NHẤT tab kiemke-material — không đụng mastige/garment.
 *   - Cooldown máy chủ 15 phút (nhẹ hơn stock 4h vì payload test nhỏ) + ScriptLock chống chạy chồng.
 * =================================================================================================== */
var KIEMKE_TAB = 'kiemke-material';
var KIEMKE_MAX_PAGE_TEST = 2;
var KIEMKE_SIZE = 1000;
var KIEMKE_COOLDOWN_MS = 15 * 60 * 1000;
var KIEMKE_HEADER = ['SKU', 'ProductName', 'LocationDescription', 'Warehouse', 'SystemQty', 'CountedQty', 'Diff', 'Status', 'Updated'];
var KIEMKE_BO = [
  { company: '1002', warehouses: '1458,1441,1307,1250,1179,1178,1177,1151', kho: 'WH - MATERIAL - MTG' },
  { company: '1005', warehouses: '1458,1441,1307,1250,1179,1178,1177,1151,1516,1341,1340,1339,1266', kho: 'WH - MATERIAL - GARMENT' },
];

function apiForceSyncKiemke() {
  var p = PropertiesService.getScriptProperties();
  var last = Number(p.getProperty('LAST_SYNC_' + KIEMKE_TAB) || 0), now = new Date().getTime();
  if (last && now - last < KIEMKE_COOLDOWN_MS) {
    var cho = KIEMKE_COOLDOWN_MS - (now - last);
    return phanHoiJson({ status: 'error', code: 429, message: 'Đồng bộ kiểm kê tối đa 15 phút/lần. Còn ' + Math.ceil(cho / 60000) + ' phút nữa.', retryAfterMs: cho });
  }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return phanHoiJson({ status: 'error', code: 429, message: 'Đang có một lượt đồng bộ khác chạy.' });
  try {
    var token = p.getProperty('WMS_TOKEN') || '';
    if (!token) return phanHoiJson({ status: 'error', code: 401, message: 'Token WMS đã hết hạn. Đang chờ luồng chạy ngầm cập nhật Token mới.' });
    var auth = /^Bearer /i.test(token) ? token : 'Bearer ' + token;
    var rows = [], capped = false;
    for (var b = 0; b < KIEMKE_BO.length; b++) {
      var cfg = KIEMKE_BO[b];
      var khoChuan = cfg.kho.replace(/\s+/g, ' ').trim().toUpperCase();
      for (var page = 1; page <= KIEMKE_MAX_PAGE_TEST; page++) {   // TUẦN TỰ — không bắn loạt
        var url = STOCKLOC_API + '?company_ids=' + cfg.company + '&warehouse_ids=' + encodeURIComponent(cfg.warehouses) +
          '&ignore_zero_total=1&page=' + page + '&size=' + KIEMKE_SIZE;
        var resp;
        try { resp = UrlFetchApp.fetch(url, { headers: { Authorization: auth }, muteHttpExceptions: true }); }
        catch (e) { return phanHoiJson({ status: 'error', code: 502, message: 'Không gọi được WMS: ' + e.message }); }
        var http = resp.getResponseCode();
        if (http === 401 || http === 403) return phanHoiJson({ status: 'error', code: 401, message: 'Token WMS đã hết hạn. Đang chờ luồng chạy ngầm cập nhật Token mới.' });
        if (http >= 400) return phanHoiJson({ status: 'error', code: http, message: 'WMS trả lỗi HTTP ' + http + ' (trang ' + page + ', cty ' + cfg.company + ').' });
        var j; try { j = JSON.parse(resp.getContentText()); } catch (e) { return phanHoiJson({ status: 'error', code: 502, message: 'WMS trả dữ liệu không phải JSON.' }); }
        var recs = j.records || (j.data && j.data.records) || [];
        for (var r = 0; r < recs.length; r++) {
          var it = recs[r];
          if (String(it.warehouse_name || '').replace(/\s+/g, ' ').trim().toUpperCase() !== khoChuan) continue;   // CHỈ giữ đúng kho chỉ định
          var sys = Number(it.quantity) || 0;
          var dem = (it.count_inbin == null || it.count_inbin === '') ? null : Number(it.count_inbin) || 0;
          var diff = dem == null ? 0 : dem - sys;
          rows.push([it.sku || '', it.product_name || '', it.location_description || '', it.warehouse_name || '',
            sys, dem == null ? '' : dem, diff,
            dem == null || dem === 0 ? 'Chưa đếm' : (diff === 0 ? 'Khớp' : (diff < 0 ? 'Lệch âm' : 'Lệch dương')),
            it.updated_at || '']);
        }
        if (!recs.length || recs.length < KIEMKE_SIZE) break;      // hết dữ liệu -> khỏi trang kế
        if (page === KIEMKE_MAX_PAGE_TEST) capped = true;          // còn dữ liệu nhưng chạm CAP TEST
        Utilities.sleep(500);                                      // nghỉ 0.5s giữa các trang — không dội WMS
      }
    }
    if (!rows.length) return phanHoiJson({ status: 'error', code: 404, message: 'Không có dòng nào thuộc 2 kho MATERIAL trong ' + KIEMKE_MAX_PAGE_TEST + ' trang test.' });
    var ss = SpreadsheetApp.openById(STOCKLOC_SHEET_ID);
    var sh = ss.getSheetByName(KIEMKE_TAB);
    if (!sh) sh = ss.insertSheet(KIEMKE_TAB);
    sh.clearContents();
    var all = [KIEMKE_HEADER].concat(rows);
    sh.getRange(1, 1, all.length, KIEMKE_HEADER.length).setValues(all);
    sh.getRange(1, 1, 1, KIEMKE_HEADER.length).setFontWeight('bold').setBackground('#7c3aed').setFontColor('#ffffff');
    try { sh.setFrozenRows(1); } catch (e) {}
    catGonSheet_(sh, all.length, KIEMKE_HEADER.length);
    var at = new Date().getTime();
    p.setProperty('LAST_SYNC_' + KIEMKE_TAB, String(at));          // FE đọc mốc này qua action=lastSync&tab=kiemke-material
    return phanHoiJson({ status: 'success', at: at, written: rows.length, capped: capped, maxPage: KIEMKE_MAX_PAGE_TEST });
  } finally { lock.releaseLock(); }
}

/* ============================================================================
 *  DỌN TAB DƯ THỪA — chạy 1 LẦN trong editor (chọn donDepTabThua → Run).
 *  Tab 'kiemke-material' bỏ hoang từ 2026-05-04 do apiForceSyncKiemke nạp (endpoint
 *  không chạy thật: WMS chặn IP ngoài) và FE chỉ dùng làm fallback. Kiểm kê LIVE ở
 *  kiemke-sku / kiemke-location. An toàn: chỉ xoá đúng tab trong DANH_SACH_XOA,
 *  bỏ qua nếu không thấy, không xoá tab cuối cùng; in log trước/sau.
 * ========================================================================== */
/* ============================================================================
 *  SOÁT TAB — chạy trong editor (chọn soatTabTatCa → Run), CHỈ ĐỌC, không sửa gì.
 *  Vì sao cần: sheet PRIVATE không public nên máy trạm/dashboard không liệt kê được
 *  tab của nó; muốn biết tab nào thừa/đặt tên lệch chuẩn thì phải hỏi từ trong GAS.
 *  Kết quả in ở Nhật ký (Ctrl+Enter) — dán lại cho bên phát triển để chốt danh sách xoá.
 * ========================================================================== */
function soatTabTatCa() {
  var ra = [];
  function soat(nhan, ss) {
    if (!ss) { ra.push('— ' + nhan + ': KHÔNG mở được'); return; }
    ra.push('— ' + nhan + ' (' + ss.getName() + ') — ' + ss.getSheets().length + ' tab:');
    ss.getSheets().forEach(function (s) {
      ra.push('    ' + s.getName() + '  [' + s.getLastRow() + ' dòng × ' + s.getLastColumn() + ' cột]' +
        (s.getLastRow() <= 1 ? '   ← RỖNG' : ''));
    });
  }
  soat('CÔNG KHAI (5S)', SpreadsheetApp.getActiveSpreadsheet());
  var idP = PropertiesService.getScriptProperties().getProperty('PRIVATE_SHEET_ID');
  soat('RIÊNG (nhân sự/PII)', idP ? SpreadsheetApp.openById(idP) : null);
  try { soat('FACTORY (stock-location)', SpreadsheetApp.openById(STOCKLOC_SHEET_ID)); } catch (e) { ra.push('— FACTORY: ' + e.message); }
  var msg = ra.join('\n');
  Logger.log(msg);
  return msg;
}

/* ============================================================================
 *  CHUẨN HOÁ TÊN TAB + DỌN TAB RỖNG — chạy 1 LẦN trong editor (chọn chuanHoaTenTab → Run).
 *  Vì sao đổi được mà không phải sửa code: cả `getSheetByName` (Apps Script) và `?sheet=`
 *  (gviz mà dashboard dùng) đều khớp tên KHÔNG phân biệt hoa/thường — đã kiểm chứng thật:
 *  bộ sync ghi tab 'garment' vào tab tên 'Garment' vẫn chạy, và gviz gọi 'quy-dinh' trả
 *  đúng dữ liệu 'QUY-DINH'. Nên đây CHỈ đổi hoa/thường, KHÔNG đổi ký tự nào khác.
 *  ⚠ Muốn đổi cả dấu cách/gạch nối (vd 'WAREHOUSE CODE' -> 'WAREHOUSE-CODE') thì phải sửa
 *  code song song — đừng thêm vào bảng dưới.
 *  CHỐT AN TOÀN: bỏ qua tab không tồn tại · bỏ qua nếu tên mới đã có tab khác giữ ·
 *  CHỈ xoá tab RỖNG (≤1 dòng) và không bao giờ xoá tab cuối cùng · in log trước/sau.
 * ========================================================================== */
var CHUANHOA_DOI_CONGKHAI = {
  'kiemke-location-hasaki': 'KIEMKE-LOCATION-HASAKI',
  'kiemke-sku-hasaki': 'KIEMKE-SKU-HASAKI',
  'stock-inventory-hasaki': 'STOCK-INVENTORY-HASAKI'
};
var CHUANHOA_DOI_FACTORY = {
  'Metadata': 'METADATA',
  'history': 'HISTORY',
  'mastige': 'MASTIGE',
  'Garment': 'GARMENT',
  'kiemke-sku': 'KIEMKE-SKU',
  'kiemke-location': 'KIEMKE-LOCATION',
  'kiemke-adjust': 'KIEMKE-ADJUST',
  'kiemke-uidgr': 'KIEMKE-UIDGR',
  'kiemke-uidgr-edit': 'KIEMKE-UIDGR-EDIT',
  'stock-inventory-beta': 'STOCK-INVENTORY-BETA',
  'Warehouse code': 'WAREHOUSE CODE'
};
var CHUANHOA_XOA_RIENG = ['Trang tính1', 'Sheet1'];   // tab mặc định Google tạo, còn sót vì tên bản địa hoá

function chuanHoaTenTab() {
  var ra = [];
  function xuLy(nhan, ss, doi, xoa) {
    if (!ss) { ra.push('— ' + nhan + ': KHÔNG mở được, bỏ qua.'); return; }
    ra.push('— ' + nhan + ' (' + ss.getName() + ')');
    ra.push('   TRƯỚC: ' + ss.getSheets().map(function (s) { return s.getName(); }).join(', '));
    // 1) XOÁ tab rỗng
    (xoa || []).forEach(function (ten) {
      var sh = ss.getSheetByName(ten);
      if (!sh) return;                                        // không có thì thôi, không ồn ào
      if (ss.getSheets().length <= 1) { ra.push('   ⛔ giữ "' + ten + '": là tab cuối cùng.'); return; }
      if (sh.getLastRow() > 1) { ra.push('   ⛔ KHÔNG xoá "' + ten + '": có ' + sh.getLastRow() + ' dòng dữ liệu.'); return; }
      try { ss.deleteSheet(sh); ra.push('   ✓ đã xoá tab rỗng "' + ten + '".'); }
      catch (e) { ra.push('   ⛔ xoá "' + ten + '" thất bại: ' + e.message); }
    });
    // 2) ĐỔI TÊN (chỉ hoa/thường)
    Object.keys(doi || {}).forEach(function (cu) {
      var moi = doi[cu], sh = ss.getSheetByName(cu);
      if (!sh) { ra.push('   · bỏ qua "' + cu + '": không tồn tại.'); return; }
      if (sh.getName() === moi) { ra.push('   = "' + moi + '": đã đúng chuẩn.'); return; }
      if (String(cu).toLowerCase() !== String(moi).toLowerCase()) {
        ra.push('   ⛔ TỪ CHỐI "' + cu + '" -> "' + moi + '": khác nhau hơn cả hoa/thường, phải sửa code song song.');
        return;
      }
      var vuong = ss.getSheets().filter(function (s) {
        return s.getSheetId() !== sh.getSheetId() && s.getName().toLowerCase() === String(moi).toLowerCase();
      });
      if (vuong.length) { ra.push('   ⛔ bỏ qua "' + cu + '": đã có tab khác tên "' + vuong[0].getName() + '".'); return; }
      var truoc = sh.getName();
      /* ĐỔI 2 NHỊP khi cần: Google coi tên tab là trùng KHÔNG phân biệt hoa/thường, nên
       * setName('MASTIGE') trên tab đang tên 'mastige' có thể bị từ chối vì "đã tồn tại" —
       * trùng với chính nó. Vòng qua một tên tạm rồi đặt tên đích là thoát được.
       * Bọc try/catch từng tab: một tab lỗi thì bỏ qua tab đó, KHÔNG làm gãy cả lượt chạy. */
      try {
        sh.setName(moi);
        ra.push('   ✓ "' + truoc + '"  ->  "' + moi + '"');
      } catch (e1) {
        var tam = 'ZZTMP-' + new Date().getTime();
        try {
          sh.setName(tam); sh.setName(moi);
          ra.push('   ✓ "' + truoc + '"  ->  "' + moi + '"  (đổi 2 nhịp qua tên tạm)');
        } catch (e2) {
          try { if (sh.getName() === tam) sh.setName(truoc); } catch (e3) {}   // trả lại tên cũ, không để tab mang tên tạm
          ra.push('   ⛔ đổi "' + truoc + '" -> "' + moi + '" THẤT BẠI: ' + e2.message);
        }
      }
    });
    ra.push('   SAU:   ' + ss.getSheets().map(function (s) { return s.getName(); }).join(', '));
  }
  xuLy('CÔNG KHAI (5S)', SpreadsheetApp.getActiveSpreadsheet(), CHUANHOA_DOI_CONGKHAI, null);
  var idP = PropertiesService.getScriptProperties().getProperty('PRIVATE_SHEET_ID');
  xuLy('RIÊNG (nhân sự/PII)', idP ? SpreadsheetApp.openById(idP) : null, null, CHUANHOA_XOA_RIENG);
  try { xuLy('FACTORY (stock-location)', SpreadsheetApp.openById(STOCKLOC_SHEET_ID), CHUANHOA_DOI_FACTORY, null); }
  catch (e) { ra.push('— FACTORY: ' + e.message); }
  var msg = ra.join('\n');
  Logger.log(msg);
  return msg;
}

function donDepTabThua() {
  var DANH_SACH_XOA = ['kiemke-material'];
  var ss = SpreadsheetApp.openById(STOCKLOC_SHEET_ID);
  var truoc = ss.getSheets().map(function (s) { return s.getName(); });
  Logger.log('Tab trước khi dọn (' + truoc.length + '): ' + truoc.join(', '));
  var daXoa = [];
  for (var i = 0; i < DANH_SACH_XOA.length; i++) {
    var ten = DANH_SACH_XOA[i];
    var sh = ss.getSheetByName(ten);
    if (!sh) { Logger.log('• Bỏ qua "' + ten + '" — không tồn tại.'); continue; }
    if (ss.getSheets().length <= 1) { Logger.log('• Dừng: không xoá tab cuối cùng.'); break; }
    ss.deleteSheet(sh);
    daXoa.push(ten);
    Logger.log('✓ Đã xoá tab "' + ten + '".');
  }
  var sau = ss.getSheets().map(function (s) { return s.getName(); });
  Logger.log('Tab sau khi dọn (' + sau.length + '): ' + sau.join(', '));
  return { daXoa: daXoa, conLai: sau };
}

/* ------------------------------- Tiện ích ------------------------------- */
function formatNgay(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'GMT+7', 'yyyy-MM-dd HH:mm:ss');
  return String(v || '');
}

function layAnhBase64(chuoi) {
  var out = [];
  if (!chuoi) return out;
  var lines = chuoi.split(/\s*\n\s*/);
  for (var i = 0; i < lines.length; i++) {
    var m = lines[i].match(/[-\w]{25,}/);
    if (!m) continue;
    try {
      var file = DriveApp.getFileById(m[0]);
      var blob = file.getBlob();
      out.push({ filename: file.getName(), mime: blob.getContentType(), base64: Utilities.base64Encode(blob.getBytes()) });
    } catch (err) { /* bỏ qua file lỗi */ }
  }
  return out;
}

/**
 * DỌN RÁC THỦ CÔNG (chạy 1 lần trong editor): xoá các dòng chỉ có Cột A (Ngày giờ)
 * mà Cột B (Hiện trạng) và Cột C (Vị trí) đều TRỐNG. Quét từ DƯỚI LÊN để deleteRow không lệch index.
 * KHÔNG gắn trigger — gọi tay khi cần dọn sheet WMS-5S-AUDIT.
 */
function cleanEmptyRowsWMS() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(TEN_SHEET);
  if (!sheet) { Logger.log('Không thấy sheet ' + TEN_SHEET); return; }
  var last = sheet.getLastRow();
  if (last < 2) { Logger.log('Sheet trống, không có gì để dọn.'); return; }
  var data = sheet.getRange(2, 1, last - 1, 3).getValues();   // A,B,C của các dòng dữ liệu
  var xoa = 0;
  for (var i = data.length - 1; i >= 0; i--) {                // DƯỚI LÊN
    var a = String(data[i][0] || '').trim();
    var b = String(data[i][1] || '').trim();
    var c = String(data[i][2] || '').trim();
    if (a && !b && !c) { sheet.deleteRow(i + 2); xoa++; }      // A có, B & C trống -> rác
  }
  Logger.log('Đã xoá ' + xoa + ' dòng rác (chỉ có Ngày giờ, thiếu Hiện trạng & Vị trí).');
  return xoa;
}

function layHoacTaoSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(TEN_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(TEN_SHEET);
    sheet.appendRow(['Ngày giờ ghi nhận', 'Hiện trạng (Ghi chú)', 'Vị trí (Mã vạch)', 'Hạng mục 5S', 'Chuỗi hình ảnh', 'Mã task workflow', 'Thời gian vi phạm']);
    sheet.getRange(1, 1, 1, SO_COT).setFontWeight('bold').setBackground('#2563eb').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(2, 280); sheet.setColumnWidth(4, 320); sheet.setColumnWidth(5, 320); sheet.setColumnWidth(6, 160); sheet.setColumnWidth(7, 170);
  } else {
    if (!sheet.getRange(1, COL_MA_TASK).getValue()) {
      sheet.getRange(1, COL_MA_TASK).setValue('Mã task workflow').setFontWeight('bold').setBackground('#2563eb').setFontColor('#ffffff');
      sheet.setColumnWidth(6, 160);
    }
    if (!sheet.getRange(1, COL_TG_VI_PHAM).getValue()) {
      sheet.getRange(1, COL_TG_VI_PHAM).setValue('Thời gian vi phạm').setFontWeight('bold').setBackground('#2563eb').setFontColor('#ffffff');
      sheet.setColumnWidth(7, 170);
    }
  }
  return sheet;
}

function luuHinhAnhLenDrive(danhSachAnh, viTri) {
  var thuMuc = layHoacTaoThuMuc();
  var links = [];
  var thoiGian = Utilities.formatDate(new Date(), 'GMT+7', 'yyyyMMdd_HHmmss');
  for (var i = 0; i < danhSachAnh.length; i++) {
    var anh = danhSachAnh[i];
    // Cắt SAU dấu hiệu 'base64,' thay vì split(',') — mime clip quay trực tiếp có dấu phẩy
    // (vd data:video/mp4;codecs=h264,aac;base64,...) làm split lấy nhầm đoạn 'aac;base64' -> lỗi giải mã.
    var b64 = String(anh.base64 || '');
    var vt = b64.indexOf('base64,');
    if (vt >= 0) b64 = b64.slice(vt + 7);
    var blob = Utilities.newBlob(Utilities.base64Decode(b64), anh.mime, anh.ten);
    blob.setName(thoiGian + '_' + (viTri || 'vitri') + '_' + (i + 1));
    var file = thuMuc.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    links.push(file.getUrl());
  }
  return links;
}

function layHoacTaoThuMuc() {
  var ds = DriveApp.getFoldersByName(TEN_THU_MUC_ANH);
  return ds.hasNext() ? ds.next() : DriveApp.createFolder(TEN_THU_MUC_ANH);
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════════
 *  HÀNG ĐỢI IN TEM SKU — BẢN "TỨC THÌ" (20/08/2026)
 *  ---------------------------------------------------------------------------------------------
 *  Vì sao phải có hàng đợi: máy in tem cắm USB vào một máy trong kho, còn người bấm thì đứng ngoài
 *  kho với cái điện thoại. Trình duyệt không nói được với máy in (web thuần không liệt kê nổi máy
 *  in, `http://127.0.0.1` bị Private Network Access chặn, Android/iOS không hiểu máy in share kiểu
 *  Windows). Nên đường duy nhất không cần xin IT là: cả hai đầu chỉ gọi RA NGOÀI.
 *
 *      điện thoại/PC ──(pr_them)──► HÀNG ĐỢI ◄──(pr_lay/pr_xong)── agent máy trạm ──► máy in tem
 *
 *  VÌ SAO HÀNG ĐỢI SỐNG KHÔNG CÒN NẰM Ở SHEET (đo thật 20/08/2026, người bấm nói đúng: "sao lâu"):
 *    · mỗi lượt gọi Apps Script đã mất ~1,1s trần — chuỗi chuyển hướng của Google, không cắt được;
 *    · `SpreadsheetApp.openById` cộng thêm 1,1–2,4s NỮA cho MỌI lượt, kể cả lượt hỏi lúc hàng đợi
 *      đang trống — mà agent thì hỏi liên tục. Đo được: pr_lay 3,5s · pr_trangthai 2,2s → vòng quét
 *      agent 6,5s, cộng pr_them nữa thì bấm xong phải đợi ~10s mới nghe máy in kêu.
 *  Nên hàng đợi SỐNG chuyển sang **Script Properties**: đọc/ghi ~50ms, và KHÔNG bị đuổi giữa đường
 *  như CacheService (mất một lệnh in nghĩa là tem không bao giờ ra mà chẳng ai biết vì sao).
 *  Sheet `IN-TEM-CHO` vẫn còn nguyên nhưng hạ xuống làm SỔ LƯU: chỉ ghi lúc agent rảnh, ngoài
 *  đường găng — ai in bao nhiêu tem vẫn đối chiếu được, mà không ai phải đợi cái ghi đó.
 *
 *  Giới hạn đã tính trước: 9KB cho MỖI property (một lệnh 40 SKU ~4KB — vừa; dài hơn PR_TRAN_KY_TU
 *  thì chối thẳng chứ không ghi hụt rồi im lặng), 500KB cả kho → chốt PR_TRAN_SONG lệnh sống.
 *
 *  MỘT LỆNH = một property `PRQ_<id>`:
 *      { id, nguoi, soTem, ts, tt, dong, nhan, xongLuc, ghiChu, luu }
 *      tt:  cho → dang_in → xong | loi          luu: 0 = chưa vào sổ lưu
 *  `PR_IDS` giữ thứ tự các lệnh còn sống, `PR_NHIP` là nhịp tim của agent.
 * ═══════════════════════════════════════════════════════════════════════════════════════════════ */
var PR_TAB = 'IN-TEM-CHO';
var PR_HEADER = ['id', 'luc_gui', 'nguoi', 'trang_thai', 'so_tem', 'json_dong', 'luc_nhan', 'luc_xong', 'ghi_chu'];
var PR_TRAN_DONG = 40;            // trần số SKU một lệnh — chặn gửi cả danh mục vì bấm nhầm
var PR_TRAN_TEM = 400;            // trần số con tem một lệnh
var PR_TRAN_KY_TU = 8500;         // trần độ dài JSON một lệnh (property tối đa 9KB — payload có
                                  // thêm tên sản phẩm nên 40 SKU rơi vào khoảng 7KB)
var PR_TRAN_SONG = 30;            // số lệnh giữ trong hàng đợi nhanh
var PR_GIU_XONG = 15 * 60000;     // giữ lệnh đã xong 15' để dashboard còn hỏi được trạng thái
var PR_TREO = 10 * 60000;         // dang_in quá 10' coi như treo (agent chết giữa đợt)
var PR_GIU_NGAY = 7;              // sổ lưu giữ 7 ngày
var PR_P_IDS = 'PR_IDS';
var PR_P_TIEN = 'PRQ_';
var PR_P_NHIP = 'PR_NHIP';
var PR_P_LUU = 'PR_LUU_LUC';
var PR_P_MAY = 'PR_MAY';        // tình trạng máy in do agent gửi kèm mỗi lượt hỏi việc
var PR_MAY_HET = 45000;         // tình trạng cũ hơn 45 giây thì coi như KHÔNG BIẾT (agent có thể đã tắt)
var PR_P_XEM = 'PR_XEM';        // lần cuối có người MỞ pop-up In tem (dashboard hỏi hàng đợi)
var PR_XEM_LAU = 45000;         // trong 45 giây đó thì agent đọc máy in dày hơn

function prSP_() { return PropertiesService.getScriptProperties(); }
/* ── TÌNH TRẠNG MÁY IN (21/08/2026) ──────────────────────────────────────────────────────────────
 * Sự cố: máy in hết giấy mà dashboard không báo gì; người dùng bấm ép in 4 lần rồi lắp cuộn mới vẫn
 * không ra tem. Gốc: `WritePrinter` báo OK ngay khi spooler nhận byte, không liên quan tới giấy.
 * Nay agent đọc thật (Get-Printer + WMI + queue) rồi gửi kèm MỖI lượt `pr_lay`; chỗ này giữ lại để
 * dashboard đọc được, và để `apiPrLay` KHÔNG phát việc khi máy đang chặn — lệnh nằm lại ở `cho` và
 * tự in tiếp khi máy in xong, người dùng không phải bấm lại lần nào.
 * ────────────────────────────────────────────────────────────────────────────────────────────────── */
/* CÓ NGƯỜI ĐANG XEM? Dashboard hỏi hàng đợi (mở pop-up In tem) thì đóng dấu ở đây; agent đọc cờ đó
   để chuyển sang đọc tình trạng máy in mỗi 0,7 giây thay vì 12 giây. Đọc dày cả ngày thì tốn CPU máy
   trạm vô ích, mà đọc thưa lúc người ta đang đứng nhìn thì trạng thái trễ — nên để chính người xem
   bật nó lên. */
function prXemGhi_() {
  try { prSP_().setProperty(PR_P_XEM, String(new Date().getTime())); } catch (e) {}
}
function prCoNguoiXem_(all) {
  try {
    var t = Number((all ? all[PR_P_XEM] : prSP_().getProperty(PR_P_XEM)) || 0);
    return t > 0 && new Date().getTime() - t < PR_XEM_LAU;
  } catch (e) { return false; }
}
function prMayGhi_(sp, chuoi) {
  if (!chuoi) return;
  try { sp.setProperty(PR_P_MAY, JSON.stringify({ tt: String(chuoi).slice(0, 400), luc: new Date().getTime() })); } catch (e) {}
}
/** Tình trạng máy in kèm tuổi. `ro:true` = quá cũ, đừng tin (agent có thể đã tắt). */
function prMayDoc_(all) {
  var o = null;
  try { o = JSON.parse((all ? all[PR_P_MAY] : prSP_().getProperty(PR_P_MAY)) || 'null'); } catch (e) { o = null; }
  if (!o || !o.luc) return { co: false };
  var tre = new Date().getTime() - Number(o.luc);
  var tt = {};
  try { tt = JSON.parse(o.tt); } catch (e) { tt = {}; }
  return { co: true, tre: tre, ro: tre > PR_MAY_HET, chu: String(tt.chu || ''), chan: !!tt.chan && tre <= PR_MAY_HET,
    canh: !!tt.canh, job: Number(tt.job), ma: String(tt.ma || '') };
}
function prIds_(all) { try { return JSON.parse(all[PR_P_IDS] || '[]') || []; } catch (e) { return []; } }
function prLenh_(all, id) { try { return JSON.parse(all[PR_P_TIEN + id] || 'null'); } catch (e) { return null; } }

function prSheet_() {
  var ss = SpreadsheetApp.openById(STOCKLOC_SHEET_ID);
  var sh = ss.getSheetByName(PR_TAB);
  if (!sh) {
    sh = ss.insertSheet(PR_TAB);
    sh.getRange(1, 1, 1, PR_HEADER.length).setValues([PR_HEADER])
      .setFontWeight('bold').setBackground('#0f766e').setFontColor('#ffffff');
    try { sh.setFrozenRows(1); } catch (e) {}
  }
  return sh;
}

/** Dashboard gửi một lệnh in. PUBLIC — tự bảo vệ bằng trần dòng/tem/độ dài và chống gửi trùng 5 giây.
 *  KHÔNG mở Sheet: đây là chặng người dùng đang ngồi đợi. */
function apiPrThem(duLieu) {
  var dong;
  try { dong = JSON.parse(String(duLieu.dong || '[]')); } catch (e) { dong = null; }
  if (!dong || !dong.length) return phanHoiJson({ status: 'error', message: 'Danh sách in trống.' });
  if (dong.length > PR_TRAN_DONG) return phanHoiJson({ status: 'error', message: 'Một lệnh in tối đa ' + PR_TRAN_DONG + ' SKU.' });
  var tong = 0;
  for (var i = 0; i < dong.length; i++) tong += Math.max(1, Number(dong[i].sl) || 1);
  if (tong > PR_TRAN_TEM) return phanHoiJson({ status: 'error', message: 'Một lệnh in tối đa ' + PR_TRAN_TEM + ' con tem.' });
  var chuoi = JSON.stringify(dong);
  if (chuoi.length > PR_TRAN_KY_TU) return phanHoiJson({ status: 'error', message: 'Lệnh in quá dài — hãy chia thành hai lượt.' });

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(8000)) return phanHoiJson({ status: 'error', message: 'Đang có lệnh khác ghi vào hàng đợi — thử lại sau vài giây.' });
  try {
    var sp = prSP_(), all = sp.getProperties(), ids = prIds_(all), now = new Date().getTime();
    var nguoi = String(duLieu.nguoi || '').slice(0, 60);
    /* CHỐNG GỬI TRÙNG: bấm hai lần vì mạng chậm là chuyện thường, mà mỗi lần bấm là tem thật ra khỏi
       máy in. Cùng người + cùng nội dung trong 5 giây thì coi là một lệnh. */
    for (var k = ids.length - 1; k >= 0 && k >= ids.length - 5; k--) {
      var cu = prLenh_(all, ids[k]);
      if (cu && String(cu.nguoi) === nguoi && String(cu.dong) === chuoi && now - Number(cu.ts || 0) < 5000) {
        return phanHoiJson({ status: 'success', id: String(cu.id), trung: true, message: 'Lệnh này vừa gửi rồi — không gửi lại.' });
      }
    }
    /* TRƯỚC BẠN CÒN AI: người bấm In đứng ngoài kho, không thấy máy in. Phải nói ngay là tem ra liền
       hay còn xếp sau đợt của người khác — im lặng rồi để họ ra máy in đợi là chỗ mất lòng tin nhất
       của cả đường in này. Đếm TRƯỚC khi thêm nên không tính chính mình. */
    var tr = prTruocP_(all, ids, now);
    var id = 'PR' + now + Math.floor(Math.random() * 900 + 100);
    /* DỌN TRƯỚC KHI THÊM. Thứ tự này không được đổi: `prDonNhanh_` phán xét từng id bằng bản đọc
       `all` chụp lúc đầu hàm, nên nếu dọn SAU khi push thì id vừa thêm chưa có property trong `all`
       → bị coi là id mồ côi và gạch ngay. Bẫy đã cắn thật 20/08/2026: lệnh ghi được `PRQ_<id>` nên
       `pr_trangthai` vẫn thấy "cho", mà `PR_IDS` lại không có nó nên agent quét mãi không ra việc —
       tem không bao giờ in mà chẳng có lỗi nào. */
    var xoa = prDonNhanh_(all, ids, now);
    ids.push(id);
    var ghi = {};
    /* `thu` = lệnh ĐO: agent dựng đủ tem rồi bỏ, không gửi máy in. Giữ nguyên mọi chặng khác để số
       đo là số thật. */
    ghi[PR_P_TIEN + id] = JSON.stringify({ id: id, nguoi: nguoi, soTem: tong, ts: now, tt: 'cho',
      dong: chuoi, luu: 0, thu: duLieu.thu ? 1 : 0 });
    ghi[PR_P_IDS] = JSON.stringify(ids);
    sp.setProperties(ghi, false);
    for (var d = 0; d < xoa.length; d++) sp.deleteProperty(xoa[d]);
    return phanHoiJson({ status: 'success', id: id, soTem: tong, soSku: dong.length, may: prMayDoc_(all),
      truoc: tr.soDot, temTruoc: tr.soTem, nguoiTruoc: tr.nguoi, dangIn: tr.dangIn, agentTre: prAgentTre_(all) });
  } finally { lock.releaseLock(); }
}

/** Agent hỏi việc.
 *  ĐƯỜNG NHANH (lượt hay xảy ra nhất): hàng đợi trống → trả rỗng luôn, không khoá, không mở Sheet
 *  → cả lượt chỉ còn ~1,1s trần của Apps Script, nên agent hỏi được mỗi giây mà vẫn nhẹ.
 *  Có việc thì mới khoá (hai agent không được nhặt trùng một lệnh) và ghi `dang_in`. */
function apiPrLay(duLieu) {
  var sp = prSP_(), all = sp.getProperties(), now = new Date().getTime();
  prNhipGhi_();                                      // nhịp tim: dashboard biết máy trạm còn trực
  prMayGhi_(sp, duLieu && duLieu.may);               // tình trạng máy in agent vừa đọc được
  /* MÁY IN ĐANG CHẶN (hết giấy · mở nắp · kẹt · offline · queue nghẽn) thì KHÔNG phát việc: lệnh nằm
     lại ở `cho`, dashboard đọc `may` để nói đúng lý do, và khi máy in xong thì lượt hỏi sau tự nhận
     việc. Đây là chỗ chữa gốc chuyện "bấm ép in 4 lần": người dùng không có gì phải bấm lại. */
  var may = prMayDoc_(all);
  if (duLieu && duLieu.may) {
    try { var t = JSON.parse(duLieu.may); if (t && t.chan) return phanHoiJson({ status: 'success', dsLenh: [], mayChan: String(t.chu || ''), xem: prCoNguoiXem_(all) }); } catch (e) {}
  } else if (may.chan) {
    return phanHoiJson({ status: 'success', dsLenh: [], mayChan: may.chu, xem: prCoNguoiXem_(all) });
  }
  var ids = prIds_(all), co = false;
  for (var i = 0; i < ids.length; i++) {
    var o = prLenh_(all, ids[i]);
    if (o && o.tt === 'cho') { co = true; break; }
  }
  if (!co) {
    /* Agent đang rảnh — đây là lúc RẺ NHẤT để ghi sổ lưu những đợt vừa in xong: mở Sheet tốn ~2s
       nhưng không có ai đang đợi. Cố tình KHÔNG ghi ở `pr_xong`, vì lúc đó agent còn phải quay lại
       nhặt lệnh tiếp theo của người khác. */
    return phanHoiJson({ status: 'success', dsLenh: [], daLuu: prGhiSo_(sp, all, ids), xem: prCoNguoiXem_(all) });
  }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(8000)) return phanHoiJson({ status: 'success', dsLenh: [] });
  try {
    all = sp.getProperties(); ids = prIds_(all);
    var ra = [], ghi = {}, nguoiCho = {}, soNguoi = 0;
    for (var j = 0; j < ids.length; j++) {
      var x = prLenh_(all, ids[j]);
      if (x && x.tt === 'cho' && !nguoiCho[String(x.nguoi)]) { nguoiCho[String(x.nguoi)] = 1; soNguoi++; }
    }
    for (var m = 0; m < ids.length && ra.length < 5; m++) {   // mỗi lượt tối đa 5 lệnh, khỏi ôm quá nhiều
      var o2 = prLenh_(all, ids[m]);
      if (!o2 || o2.tt !== 'cho') continue;
      o2.tt = 'dang_in'; o2.nhan = now;
      ghi[PR_P_TIEN + ids[m]] = JSON.stringify(o2);
      var d = [];
      try { d = JSON.parse(String(o2.dong || '[]')); } catch (e) { d = []; }
      ra.push({ id: String(o2.id), nguoi: String(o2.nguoi || ''), soTem: Number(o2.soTem) || 0, dong: d,
        nhieuNguoi: soNguoi > 1, thu: Number(o2.thu) === 1 });
    }
    if (ra.length) sp.setProperties(ghi, false);
    return phanHoiJson({ status: 'success', dsLenh: ra, soNguoiCho: soNguoi, xem: prCoNguoiXem_(all) });
  } finally { lock.releaseLock(); }
}

/** Agent báo kết quả một lệnh: xong hoặc lỗi (kèm lý do để dashboard nói lại cho người bấm).
 *  Chỉ ghi property — sổ lưu để lượt rảnh sau ghi, đừng giữ chân agent ở đây. */
function apiPrXong(duLieu) {
  var id = String(duLieu.id || '');
  if (!id) return phanHoiJson({ status: 'error', message: 'Thiếu id.' });
  var sp = prSP_(), o = prLenh_(sp.getProperties(), id);
  if (!o) return phanHoiJson({ status: 'error', message: 'Không thấy lệnh ' + id });
  o.tt = duLieu.loi ? 'loi' : 'xong';
  o.xongLuc = new Date().getTime();
  o.ghiChu = String(duLieu.loi || duLieu.ghiChu || '').slice(0, 300);
  o.luu = 0;
  sp.setProperty(PR_P_TIEN + id, JSON.stringify(o));
  return phanHoiJson({ status: 'success' });
}

/** Agent trả lệnh về hàng đợi vì máy in chưa sẵn sàng (hết giấy...). KHÔNG phải lỗi: lệnh về lại
 *  `cho` kèm lý do, và sẽ tự in khi máy in xong. Đếm số lần hoãn để còn thấy được nó chờ bao lâu. */
function apiPrHoan(duLieu) {
  var id = String(duLieu.id || '');
  if (!id) return phanHoiJson({ status: 'error', message: 'Thiếu id.' });
  var sp = prSP_(), o = prLenh_(sp.getProperties(), id);
  if (!o) return phanHoiJson({ status: 'error', message: 'Không thấy lệnh ' + id });
  o.tt = 'cho';
  o.nhan = 0;
  o.hoan = (Number(o.hoan) || 0) + 1;
  o.ghiChu = String(duLieu.ly || 'máy in chưa sẵn sàng').slice(0, 200);
  sp.setProperty(PR_P_TIEN + id, JSON.stringify(o));
  return phanHoiJson({ status: 'success', hoan: o.hoan });
}

/** Dashboard hỏi trạng thái lệnh vừa gửi (PUBLIC — chỉ trả đúng dòng theo id). Property trước,
 *  Sheet chỉ khi lệnh đã quá cũ và rời hàng đợi nhanh. */
function apiPrTrangThai(duLieu) {
  var id = String(duLieu.id || '');
  if (!id) return phanHoiJson({ status: 'error', message: 'Thiếu id.' });
  prXemGhi_();                     // đang theo dõi một lệnh cũng là đang xem
  var all = prSP_().getProperties(), o = prLenh_(all, id);
  if (!o) return prTrangThaiSo_(id);
  var tr = prTruocP_(all, prIds_(all), Number(o.ts || 0));
  return phanHoiJson({ status: 'success', id: id, trangThai: String(o.tt), soTem: Number(o.soTem) || 0,
    lucNhan: Number(o.nhan) || 0, lucXong: Number(o.xongLuc) || 0, ghiChu: String(o.ghiChu || ''),
    hoan: Number(o.hoan) || 0, may: prMayDoc_(all),
    truoc: tr.soDot, temTruoc: tr.soTem, nguoiTruoc: tr.nguoi, dangIn: tr.dangIn, agentTre: prAgentTre_(all) });
}
/** Tra lệnh cũ (đã rời hàng đợi nhanh) trong sổ lưu. Chậm hơn nhưng hiếm khi phải dùng. */
function prTrangThaiSo_(id) {
  var sh = prSheet_(), n = sh.getLastRow();
  if (n < 2) return phanHoiJson({ status: 'error', message: 'Không thấy lệnh ' + id });
  var v = sh.getRange(2, 1, n - 1, PR_HEADER.length).getValues();
  for (var i = v.length - 1; i >= 0; i--) {
    if (String(v[i][0]) !== id) continue;
    return phanHoiJson({ status: 'success', id: id, trangThai: String(v[i][3]), soTem: Number(v[i][4]) || 0,
      lucNhan: Number(v[i][6]) || 0, lucXong: Number(v[i][7]) || 0, ghiChu: String(v[i][8] || ''),
      truoc: 0, temTruoc: 0, nguoiTruoc: '', dangIn: null, agentTre: prAgentTre_(null) });
  }
  return phanHoiJson({ status: 'error', message: 'Không thấy lệnh ' + id });
}

/* ── NHỊP TIM AGENT + TÌNH HÌNH HÀNG ĐỢI ────────────────────────────────────────────────────────
 * Bấm "Xác nhận in" xong là người dùng đi tới máy in lấy tem. Nếu agent ở máy trạm đang tắt, hoặc
 * đang chạy đợt của người khác, mà dashboard im lặng thì họ đứng đợi một tờ tem không bao giờ ra.
 * (Đúng cảnh đã xảy ra 20/08/2026: agent chưa bật, lệnh nằm im ở `cho`, người bấm chỉ thấy "đang
 * chờ máy in…".) Nên: mỗi lượt `pr_lay` đóng một dấu thời gian → trễ quá 60 giây là biết máy trạm
 * tắt, và dashboard nói thẳng ngay khi mở pop-up.
 * ─────────────────────────────────────────────────────────────────────────────────────────────── */
/** Đóng dấu nhịp tim vào HAI kho. Vì sao hai: đo 20/08/2026, đọc nhịp từ ảnh chụp
 *  `getProperties()` có lúc trả về RỖNG dù agent vừa gọi cách đó một giây — và dashboard sẽ báo oan
 *  "máy trạm đang tắt agent". Một lời báo động sai kiểu đó đắt hơn nhiều so với một dòng ghi thêm:
 *  người dùng mất tin, rồi lần sau họ đi in bằng máy khác. Cache nhanh nhưng bị đuổi, Property bền
 *  nhưng đọc có lúc lệch → ghi cả hai, đọc lấy cái TƯƠI HƠN. */
function prNhipGhi_() {
  var t = String(new Date().getTime());
  try { prSP_().setProperty(PR_P_NHIP, t); } catch (e) {}
  try { CacheService.getScriptCache().put(PR_P_NHIP, t, 600); } catch (e) {}
}
function prAgentTre_(all) {
  var now = new Date().getTime(), moi = 0;
  try {
    var a = Number((all ? all[PR_P_NHIP] : prSP_().getProperty(PR_P_NHIP)) || 0);
    if (a > moi) moi = a;
  } catch (e) {}
  try {
    var b = Number(CacheService.getScriptCache().get(PR_P_NHIP) || 0);
    if (b > moi) moi = b;
  } catch (e) {}
  return moi ? (now - moi) : -1;                      // -1 = chưa bao giờ thấy agent gọi
}
/** Đếm đợt còn sống gửi TRƯỚC mốc `moc` (moc = 0 → đếm tất cả). */
function prTruocP_(all, ids, moc) {
  var r = { soDot: 0, soTem: 0, nguoi: '', dangIn: null }, now = new Date().getTime();
  for (var i = 0; i < ids.length; i++) {
    var o = prLenh_(all, ids[i]);
    if (!o || (o.tt !== 'cho' && o.tt !== 'dang_in')) continue;
    /* `dang_in` quá lâu = agent chết giữa đợt. Vẫn giữ để truy vết, nhưng KHÔNG tính vào "trước bạn
       còn mấy đợt": tính thì một lệnh treo sẽ vu oan cho mọi người xếp sau nó, mãi mãi. */
    if (o.tt === 'dang_in' && now - Number(o.nhan || o.ts || 0) > PR_TREO) continue;
    if (moc && Number(o.ts || 0) >= moc) continue;
    r.soDot++; r.soTem += Number(o.soTem) || 0;
    if (!r.nguoi) r.nguoi = String(o.nguoi || '');
    if (o.tt === 'dang_in' && !r.dangIn) r.dangIn = { nguoi: String(o.nguoi || ''), soTem: Number(o.soTem) || 0 };
  }
  return r;
}
/** PUBLIC: mở pop-up In tem là biết ngay máy in kho sống hay chết, có ai đang in trước mình, và trần
 *  thật của một lệnh (để dashboard chặn trước chứ không để bị chối sau khi bấm). */
function apiPrHangDoi(duLieu) {
  prXemGhi_();                     // có người mở pop-up -> agent đọc máy in dày lên
  var all = prSP_().getProperties();
  var t = prTruocP_(all, prIds_(all), 0);
  return phanHoiJson({ status: 'success', agentTre: prAgentTre_(all), cho: t.soDot, temCho: t.soTem,
    nguoiCho: t.nguoi, dangIn: t.dangIn, may: prMayDoc_(all), tranSku: PR_TRAN_DONG, tranTem: PR_TRAN_TEM });
}

/** Dọn hàng đợi nhanh: bỏ lệnh đã xong quá 15 phút VÀ đã vào sổ lưu; nếu quá trần thì bỏ tiếp từ cũ
 *  nhất. Không bao giờ bỏ lệnh chưa ghi sổ — mất dấu một đợt in là mất luôn khả năng đối chiếu. */
function prDonNhanh_(all, ids, now) {
  var xoa = [];
  for (var i = ids.length - 1; i >= 0; i--) {
    var o = prLenh_(all, ids[i]);
    if (!o) { ids.splice(i, 1); continue; }
    var roi = (o.tt === 'xong' || o.tt === 'loi');
    if (roi && Number(o.luu) === 1 && now - Number(o.xongLuc || o.ts || 0) > PR_GIU_XONG) {
      xoa.push(PR_P_TIEN + ids[i]); ids.splice(i, 1);
    }
  }
  while (ids.length > PR_TRAN_SONG) { xoa.push(PR_P_TIEN + ids[0]); ids.splice(0, 1); }
  /* QUÉT MỒ CÔI: nếu một lượt ghi bị nửa vời (ghi được `PRQ_` mà mất `PR_IDS`) thì property đó nằm
     lại mãi và gặm dần hạn mức 500KB của kho. Chỉ xoá cái đã quá PR_GIU_XONG để không bao giờ chạm
     vào lệnh đang được ghi song song. */
  var song = {};
  for (var k = 0; k < ids.length; k++) song[PR_P_TIEN + ids[k]] = 1;
  for (var key in all) {
    if (key.indexOf(PR_P_TIEN) !== 0 || song[key]) continue;
    var o2 = null;
    try { o2 = JSON.parse(all[key]); } catch (e) { o2 = null; }
    if (!o2 || now - Number(o2.ts || 0) > PR_GIU_XONG) xoa.push(key);
  }
  return xoa;
}

/** Ghi SỔ LƯU cho các đợt đã in xong mà chưa ghi. Chỉ gọi ở lượt agent rảnh, và cách nhau ít nhất
 *  30 giây, để lượt hỏi rỗng vẫn rẻ. Lỗi ghi sổ KHÔNG được làm vỡ đường in: bọc try/catch, lần rảnh
 *  sau ghi lại (cờ `luu` vẫn 0). */
function prGhiSo_(sp, all, ids) {
  if (new Date().getTime() - Number(all[PR_P_LUU] || 0) < 30000) return 0;
  var can = [];
  for (var i = 0; i < ids.length; i++) {
    var o = prLenh_(all, ids[i]);
    if (o && (o.tt === 'xong' || o.tt === 'loi') && Number(o.luu) !== 1) can.push(o);
  }
  if (!can.length) return 0;
  try {
    var sh = prSheet_(), hang = [], ghi = {};
    for (var j = 0; j < can.length; j++) {
      var o2 = can[j];
      hang.push([o2.id, o2.ts, o2.nguoi, o2.tt, o2.soTem, o2.dong, o2.nhan || '', o2.xongLuc || '', o2.ghiChu || '']);
      o2.luu = 1;
      ghi[PR_P_TIEN + o2.id] = JSON.stringify(o2);
    }
    sh.getRange(sh.getLastRow() + 1, 1, hang.length, PR_HEADER.length).setValues(hang);
    prDon_(sh);
    ghi[PR_P_LUU] = String(new Date().getTime());
    sp.setProperties(ghi, false);
    return hang.length;
  } catch (e) { return 0; }
}

/** Dọn sổ lưu: giữ 7 ngày cho đủ truy vết, xoá phần cũ để tab không phình vô hạn. */
function prDon_(sh) {
  var n = sh.getLastRow();
  if (n < 200) return;                                // chỉ dọn khi tab đã dài
  var moc = new Date().getTime() - PR_GIU_NGAY * 86400000;
  var v = sh.getRange(2, 2, n - 1, 1).getValues();
  var xoa = 0;
  for (var i = 0; i < v.length; i++) { if (Number(v[i][0] || 0) < moc) xoa++; else break; }
  if (xoa > 0) sh.deleteRows(2, xoa);
}

function phanHoiJson(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}function testQuyenFetch() {
  var r = UrlFetchApp.fetch('https://www.google.com');
  Logger.log('HTTP ' + r.getResponseCode());
}

/* ==============================================================================================
 *  NHẬN DIỆN SKU — CỔNG VISION LLM (action = sku_vision) · 18/08/2026
 * ----------------------------------------------------------------------------------------------
 *  Dashboard Audit Factory (trang GitHub Pages CÔNG KHAI) gửi ảnh tem NCC lên đây, Apps Script
 *  gọi Gemini rồi trả về TỪ KHOÁ đã gắn vai. Vì sao phải qua đây:
 *    · Khoá AI nằm trong Script Properties → KHÔNG lộ trong mã trang công khai.
 *    · Có chỗ để gác cổng: email @hasaki.vn + hạn mức ngày + nhịp chống bấm liên tục.
 *    · Không phải dựng thêm hạ tầng nào (Apps Script đã là backend ghi Sheet của dự án).
 *
 *  CÀI KHOÁ 1 LẦN (không commit khoá vào git): mở Apps Script → chạy hàm `datKhoaGemini()` sau khi
 *  dán khoá vào biến trong hàm, hoặc Project Settings → Script properties → thêm GEMINI_API_KEY.
 *  Khoá miễn phí lấy ở aistudio.google.com/apikey (cùng khoá mà sync-vesinh-ai.mjs đang dùng).
 *
 *  KHÔNG lưu ảnh, KHÔNG ghi ảnh vào Sheet/Drive. Chỉ ghi 1 dòng đếm lượt (không có ảnh) để biết
 *  hạn mức đã dùng bao nhiêu.
 * ============================================================================================== */
/* Khoá Gemini. Ưu tiên Script Properties (đặt bằng datKhoaGemini() — không nằm trong mã nguồn);
   SV_KHOA_CUNG là đường dự phòng để bản deploy chạy được ngay sau clasp push. Bản git-safe LUÔN để
   trống chuỗi này; khoá thật chỉ sống trong .clasp-deploy/sa.js (đã gitignore, cùng chỗ với SECRET/PIN). */
var SV_KHOA_CUNG = '';
var SV_TRAN_NGAY = 400;        // tổng lượt đọc tem/ngày (bậc miễn phí Gemini ~ dư sức cho kho)
var SV_TRAN_NGUOI = 120;       // lượt/ngày cho mỗi email
var SV_TRAN_ANH_B64 = 2600000; // ~1,9 MB base64 (client đã thu nhỏ còn ~200-400 KB)
/* Mỗi model có quota miễn phí RIÊNG theo ngày → hết model trước thì tự tụt model sau.
   THỨ TỰ ĐỔI 19/08/2026 (chiều) — trước đó là "chuẩn trước, nhẹ sau", ĐO THẬT thì sai cả hai mặt:
     · `gemini-3.5-flash` (đứng đầu danh sách cũ) đang trả **429** ⇒ MỌI lượt đọc tem đều tốn một
       round-trip vô ích trước khi tụt model, và nếu cả chuỗi 429 thì thủ kho thấy "không có kết quả".
     · `gemini-2.5-flash-lite` trong chuỗi cũ trả **404** (tên model không còn dùng được) ⇒ thêm một
       round-trip vô ích nữa.
     · Đo thời gian đọc CÙNG một tem khó (nghiêng + mờ): `gemini-flash-lite-latest` **1,9-2,0 s**,
       `gemini-3.5-flash-lite` 1,6-3,0 s, `gemini-3.1-flash-lite` 2,2-4,3 s — và cả ba đều bóc ĐÚNG
       mã 8209948 + 18.0 CM + màu 366. Tức bản "lite" vừa nhanh hơn 2× vừa không kém ở việc này
       (việc của nó chỉ là ĐỌC CHỮ, không phải suy luận).
   ⇒ lite trước (nhanh + quota rộng), model to để sau làm dự phòng khi lite hết quota.
   `gemini-flash-lite-latest` là bút danh trỏ tới bản lite mới nhất nên không bị chết tên như 2.5. */
var SV_MODELS = ['gemini-flash-lite-latest', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash'];

var SV_PROMPT =
  'Bạn đang đọc ảnh MỘT TEM NHÃN của nhà cung cấp trong kho nguyên liệu may (chỉ may, nút/khuy, dây kéo, nhãn dệt, vải, dây thun).\n' +
  'Tem có hàng trăm quy cách khác nhau và KHÔNG theo khuôn nào: tem tròn dán lõi cuộn chỉ, tem bảng chữ nhật dán túi nút, tem dài dán cuộn dây kéo, tem in nhiệt, tem viết tay.\n' +
  'Ảnh có thể cong, nhăn, bọc nylon loá sáng, dính bụi, chụp nghiêng hoặc ngược.\n' +
  '\n' +
  'NHIỆM VỤ: trích xuất MỌI ký hiệu nhận dạng ĐỌC ĐƯỢC, phân theo 5 nhóm dưới đây. Tuyệt đối:\n' +
  '- KHÔNG suy diễn, KHÔNG bù thông tin không có trên tem, KHÔNG dịch, KHÔNG sửa chính tả của nhà cung cấp.\n' +
  '- Chữ nào không chắc thì vẫn ghi nguyên như thấy (bên dùng có công cụ khớp gần đúng).\n' +
  '- Mỗi phần tử là MỘT cụm ngắn, không phải cả câu.\n' +
  '\n' +
  'item_codes: mã hàng / mã model / mã nhà cung cấp / mã vạch dạng chữ-số (ví dụ JC01262, F9-5284, 8846295, CMOR-36, SAB-255LK3557-2, 422440680).\n' +
  'specs    : thông số kỹ thuật và kích thước (ví dụ Tex 27, 60/3, Tkt 120, 17mm, 38.0 CM, 20*58mm, 24L, #3, 170gsm).\n' +
  'colors   : mã màu và tên màu (ví dụ 345, #006, V8S41, TN050, 19-4117 TCX, Matt Silver, Hồng tro, Gunmetal).\n' +
  'brands   : thương hiệu / nhà cung cấp / tên loại hàng in trên tem (ví dụ YKK, MORITO, THESEUS IRISA, AVERY DENNISON, Phong Việt, zipper, button, thread).\n' +
  'others   : ký hiệu còn lại có thể hữu ích (số lô, số cuộn, ngày, số PO…).\n' +
  'raw_text : toàn bộ chữ đọc được, giữ thứ tự dòng, mỗi dòng cách nhau bằng " | ".\n' +
  'quality  : "ro" nếu chữ rõ; "mo" nếu mờ/loá/nghiêng phải đoán; "khong_doc_duoc" nếu hầu như không đọc được gì.';

var SV_SCHEMA = {
  type: 'OBJECT',
  required: ['item_codes', 'specs', 'colors', 'brands', 'others', 'raw_text', 'quality'],
  properties: {
    item_codes: { type: 'ARRAY', items: { type: 'STRING' } },
    specs: { type: 'ARRAY', items: { type: 'STRING' } },
    colors: { type: 'ARRAY', items: { type: 'STRING' } },
    brands: { type: 'ARRAY', items: { type: 'STRING' } },
    others: { type: 'ARRAY', items: { type: 'STRING' } },
    raw_text: { type: 'STRING' },
    quality: { type: 'STRING', enum: ['ro', 'mo', 'khong_doc_duoc'] }
  }
};

/** Cài khoá Gemini vào Script Properties — dán khoá vào rồi CHẠY HÀM NÀY 1 LẦN trong editor. */
function datKhoaGemini() {
  var khoa = '';   // ← dán khoá aistudio.google.com/apikey vào đây, chạy hàm, rồi XOÁ lại khỏi mã
  if (!khoa) throw new Error('Chưa dán khoá vào biến `khoa` trong hàm datKhoaGemini().');
  PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', khoa);
  Logger.log('Đã lưu GEMINI_API_KEY (' + khoa.length + ' ký tự). Hãy xoá khoá khỏi mã nguồn.');
}
/** Kiểm nhanh trong editor: khoá có chưa, model nào còn quota. */
function testSkuVision() {
  var p = PropertiesService.getScriptProperties();
  Logger.log('GEMINI_API_KEY: ' + (p.getProperty('GEMINI_API_KEY') ? 'đã có' : 'CHƯA CÓ'));
  Logger.log('Đã dùng hôm nay: ' + (p.getProperty('sv_n_' + svNgay_()) || 0) + '/' + SV_TRAN_NGAY);
}

function svNgay_() { return Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyyMMdd'); }
/* Dọn khoá đếm của những ngày đã qua — không dọn thì Script Properties phình dần theo ngày */
function svDonCu_(p) {
  try {
    var nay = svNgay_(), all = p.getProperties();
    for (var k in all) {
      if (k.indexOf('sv_n_') !== 0) continue;
      var d = k.slice(5, 13);
      if (/^\d{8}$/.test(d) && d < nay) p.deleteProperty(k);
    }
  } catch (e) { /* dọn dẹp best-effort, không được làm hỏng lượt đọc tem */ }
}

/**
 * action = sku_vision — body: { email, mime, anh(base64 KHÔNG có tiền tố data:), nonce }
 * Trả: { status:'success', tokens:{item_codes,specs,colors,brands,others}, text, quality, model, ms }
 */
function skuVision_(d) {
  var t0 = new Date().getTime();
  var mail = String((d && d.email) || '').trim().toLowerCase();
  if (!/^[a-z0-9._%+-]+@hasaki\.vn$/.test(mail)) return { status: 'error', message: 'Cần email đúng định dạng ten@hasaki.vn.' };
  var b64 = String((d && d.anh) || '');
  if (!b64) return { status: 'error', message: 'Thiếu ảnh tem.' };
  if (b64.length > SV_TRAN_ANH_B64) return { status: 'error', message: 'Ảnh quá lớn — chụp lại hoặc để dashboard thu nhỏ trước khi gửi.' };
  var mime = String((d && d.mime) || 'image/jpeg');
  if (!/^image\/(jpeg|png|webp)$/.test(mime)) mime = 'image/jpeg';

  var p = PropertiesService.getScriptProperties();
  var khoa = p.getProperty('GEMINI_API_KEY') || SV_KHOA_CUNG;
  if (!khoa) return { status: 'error', message: 'Apps Script chưa có khoá AI — chạy hàm datKhoaGemini() một lần (xem NHAN-DIEN-SKU.md).' };

  /* Cờ "ĐANG ĐỌC" theo email — chặn 2 lượt gửi CHỒNG NHAU (bấm 2 lần vì tưởng máy treo).
     · Cờ nằm ở Script Properties, KHÔNG phải CacheService: đo thật 18/08/2026, bắn 2 lượt cùng lúc
       thì CẢ HAI đều chạy, vì mỗi lượt là một execution riêng và cache chưa kịp lan sang nhau.
     · Script lock chỉ giữ trong lúc "kiểm rồi đặt cờ" (vài ms) rồi thả NGAY — không giữ suốt 3-7
       giây gọi Gemini, vì như thế là bắt người khác chờ oan.
     · Trần 60 giây để tự mở lại nếu lượt trước chết giữa đường; xong là xoá cờ nên quét liên tục
       nhiều cuộn KHÔNG phải chờ.
     Từ đây trở xuống, MỌI đường thoát đều phải gọi svMoCo_ — bỏ quên là khoá email đó 60 giây. */
  var kDang = 'sv_dang_' + mail, bayGio = new Date().getTime(), duocDi = true;
  var lock = LockService.getScriptLock(), coLock = false;
  try {
    coLock = lock.tryLock(3000);
    var moc = Number(p.getProperty(kDang) || 0);
    if (moc && (bayGio - moc) < 60000) duocDi = false;
    else p.setProperty(kDang, String(bayGio));
  } catch (eL) { duocDi = true; }   // chốt hỏng thì cho đi: thà tốn 1 lượt hơn chặn oan người đang làm
  finally { if (coLock) { try { lock.releaseLock(); } catch (eR) { /* đã thả */ } } }
  if (!duocDi) return { status: 'error', message: 'Đang đọc ảnh trước — chờ xong rồi bấm tiếp.' };

  try {
    /* Hạn mức ngày (tổng + theo người) */
    var ngay = svNgay_(), kAll = 'sv_n_' + ngay, kMe = 'sv_n_' + ngay + '_' + mail;
    var nAll = Number(p.getProperty(kAll) || 0), nMe = Number(p.getProperty(kMe) || 0);
    if (nAll >= SV_TRAN_NGAY) return { status: 'error', message: 'Hết hạn mức đọc tem hôm nay (' + SV_TRAN_NGAY + ' ảnh) — gõ từ khoá tay giúp, mai lại đọc được.' };
    if (nMe >= SV_TRAN_NGUOI) return { status: 'error', message: 'Email này đã dùng ' + nMe + ' lượt đọc tem hôm nay (trần ' + SV_TRAN_NGUOI + ').' };

    var kq = svGoiGemini_(b64, mime, khoa);
    if (kq.status !== 'success') return kq;

    if (nAll === 0) svDonCu_(p);
    p.setProperty(kAll, String(nAll + 1));
    p.setProperty(kMe, String(nMe + 1));
    kq.ms = new Date().getTime() - t0;
    kq.conLai = SV_TRAN_NGAY - (nAll + 1);
    return kq;
  } finally { svMoCo_(p, kDang); }
}

/** Mở cờ "đang đọc" (gọi ở finally của mọi đường ra). Hỏng ở đây thì cờ tự hết sau 60 giây. */
function svMoCo_(p, kDang) {
  try { p.deleteProperty(kDang); } catch (e) { /* cờ tự hết sau 60s */ }
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════════
 *  ĐỌC CHỮ TRÊN TEM BẰNG OCR CỦA GOOGLE (action = sku_ocr) · 19/08/2026
 *  ---------------------------------------------------------------------------------------------
 *  Vì sao thêm đường này khi đã có Vision LLM: 19/08/2026 thủ kho báo "nhận diện toàn sai hoặc
 *  không có kết quả nào". Đo thật thì ra 2 nguyên nhân, và OCR chữa được cả hai:
 *    ① AI CHẾT LƯỢT — hết hạn mức mọi model (429) hoặc trả JSON sai khuôn (đo: 1/16 lượt) ⇒ thủ kho
 *      không có kết quả nào. OCR này KHÔNG dùng hạn mức Gemini: nó là chức năng chuyển ảnh → Google
 *      Docs của Drive (chính engine mà Google Dịch/Lens đang dùng), miễn phí theo tài khoản.
 *    ② AI GÁN VAI SAI — trả mã hàng vào ô "colors" nên lõi chấm mã 45% mất bằng chứng định danh.
 *      Đường này chỉ trả CHỮ THÔ, việc xếp vai để lõi trong trình duyệt làm (NDS_ENGINE.tuVanBan)
 *      và lấy bằng chứng từ chính danh mục SKU — không ai đoán hộ nữa.
 *
 *  CÁCH LÀM (không thêm hạ tầng, không xin IT — đúng luật của dự án):
 *    upload ảnh vào Drive kèm `ocrLanguage` và yêu cầu chuyển thành Google Docs → Drive tự OCR →
 *    export văn bản thuần → XOÁ file ngay. Dùng Drive REST v3 qua UrlFetchApp + ScriptApp
 *    .getOAuthToken(), KHÔNG cần bật Advanced Drive Service (scope `drive` đã có trong manifest).
 *
 *  ĐO THẬT 19/08/2026 (16 tem mô phỏng, nhãn cắt từ SKU thật):
 *    · đọc được 16/16 lượt (AI: 15/16) · 4,6–7,2 giây · KHÔNG tốn lượt AI nào
 *    · tem sạch/khó: ra đúng SKU y như AI. Tem RẤT KHÓ (chữ nhỏ + nhoè + nghiêng 13°): OCR đọc lệch
 *      vài ký tự ("Đen-580-AA" → "Ben-380-AA", "345" → "145") nên ra đúng MÃ mà lệch MÀU ⇒ vì vậy
 *      dashboard vẫn LEO THANG sang AI khi OCR không lập được mã, và cảnh báo khi các gợi ý chỉ
 *      khác nhau ở màu. OCR không thay AI; nó là tầng rẻ chạy trước và là lưới đỡ khi AI chết.
 * ═══════════════════════════════════════════════════════════════════════════════════════════════ */
var SO_TRAN_NGAY = 2000;        // OCR không tốn hạn mức AI; trần chỉ để một máy hỏng không quét vô hạn
var SO_TRAN_NGUOI = 400;
var SO_TRAN_ANH_B64 = 2600000;  // ~1,9 MB base64 (client đã thu nhỏ còn ~200-500 KB)

/**
 * action = sku_ocr — body: { email, mime, anh(base64 KHÔNG có tiền tố data:), lang, nonce }
 * Trả: { status:'success', text, ms, nguon:'drive-ocr', conLai }
 */
function skuOcr_(d) {
  var t0 = new Date().getTime();
  var mail = String((d && d.email) || '').trim().toLowerCase();
  if (!/^[a-z0-9._%+-]+@hasaki\.vn$/.test(mail)) return { status: 'error', message: 'Cần email đúng định dạng ten@hasaki.vn.' };
  var b64 = String((d && d.anh) || '');
  /* CỬA CHẨN ĐOÁN: gọi không kèm ảnh + chuanDoan=1 thì trả về chặng/thời gian của lượt OCR gần
     nhất. Cần vì khi execution lâu, Apps Script trả trang HTML ở chặng 2 và client không nhận
     được con số nào để biết chậm ở đâu. */
  if (!b64 && d && d.chuanDoan) return { status: 'success', chanCuoi: String(PropertiesService.getScriptProperties().getProperty('so_chan_cuoi') || 'chưa có lượt nào'), tranNgay: SO_TRAN_NGAY };
  if (!b64) return { status: 'error', message: 'Thiếu ảnh tem.' };
  if (b64.length > SO_TRAN_ANH_B64) return { status: 'error', message: 'Ảnh quá lớn — để dashboard thu nhỏ trước khi gửi.' };
  var mime = String((d && d.mime) || 'image/jpeg');
  if (!/^image\/(jpeg|png|webp)$/.test(mime)) mime = 'image/jpeg';
  var lang = String((d && d.lang) || 'vi').replace(/[^a-z\-]/gi, '').slice(0, 8) || 'vi';

  var p = PropertiesService.getScriptProperties();
  /* Cờ "đang đọc" theo email — y như sku_vision (xem ghi chú ở đó: phải nằm ở Script Properties,
     không phải CacheService, và MỌI đường thoát đều đi qua svMoCo_). */
  var kDang = 'so_dang_' + mail, bayGio = new Date().getTime(), duocDi = true;
  var lock = LockService.getScriptLock(), coLock = false;
  try {
    coLock = lock.tryLock(3000);
    var moc = Number(p.getProperty(kDang) || 0);
    if (moc && (bayGio - moc) < 60000) duocDi = false;
    else p.setProperty(kDang, String(bayGio));
  } catch (eL) { duocDi = true; }
  finally { if (coLock) { try { lock.releaseLock(); } catch (eR) { /* đã thả */ } } }
  if (!duocDi) return { status: 'error', message: 'Đang đọc ảnh trước — chờ xong rồi bấm tiếp.' };

  try {
    var ngay = svNgay_(), kAll = 'so_n_' + ngay, kMe = 'so_n_' + ngay + '_' + mail;
    var nAll = Number(p.getProperty(kAll) || 0), nMe = Number(p.getProperty(kMe) || 0);
    if (nAll >= SO_TRAN_NGAY) return { status: 'error', message: 'Hết trần đọc chữ hôm nay (' + SO_TRAN_NGAY + ' ảnh).' };
    if (nMe >= SO_TRAN_NGUOI) return { status: 'error', message: 'Máy này đã dùng ' + nMe + ' lượt đọc chữ hôm nay (trần ' + SO_TRAN_NGUOI + ').' };

    var kq = soDriveOcr_(b64, mime, lang);
    if (kq.status !== 'success') return kq;

    if (nAll === 0) soDonCu_(p);
    p.setProperty(kAll, String(nAll + 1));
    p.setProperty(kMe, String(nMe + 1));
    kq.ms = new Date().getTime() - t0;
    kq.conLai = SO_TRAN_NGAY - (nAll + 1);
    return kq;
  } finally { svMoCo_(p, kDang); }
}

/** Dọn khoá đếm của những ngày đã qua (giống svDonCu_, khoá riêng để 2 đường không đè nhau). */
function soDonCu_(p) {
  try {
    var nay = svNgay_(), all = p.getProperties();
    for (var k in all) {
      if (k.indexOf('so_n_') !== 0) continue;
      var ng = k.slice(5, 13);
      if (/^\d{8}$/.test(ng) && ng < nay) p.deleteProperty(k);
    }
  } catch (e) { /* dọn dẹp best-effort */ }
}

/**
 * Ảnh → CHỮ bằng OCR của Google Drive. 3 chặng: nạp-ảnh-kèm-chuyển-đổi → export text → xoá file.
 *
 * ⚠ NẠP ẢNH BẰNG "RESUMABLE", KHÔNG GHÉP MULTIPART BẰNG TAY (sửa 19/08/2026 sau khi đo).
 *   Bản đầu ghép thân multipart trong JS: `dau.concat(bytes).concat(cuoi)` rồi `newBlob(...).getBytes()`.
 *   Mỗi phần tử của mảng phải đi qua cầu JS↔Java hai lượt, nên một ảnh tem 300–500 KB thành mảng
 *   nửa triệu phần tử — đo thật: execution 35–40 GIÂY, và execution dài chính là thứ làm Google trả
 *   404 ở chặng lấy nội dung (đã ghi trong hồ sơ sự cố GAS 12/08/2026).
 *   Đường resumable chỉ gửi JSON ở lượt 1 rồi PUT NGUYÊN Blob ở lượt 2 — Blob là kiểu GAS xử lý
 *   thẳng bằng Java, không phải dựng mảng số nào.
 *
 * ⚠ File tạm PHẢI xoá ở mọi đường ra: nó nằm trong Drive của chủ GAS, để lại là rác lớn dần và
 *   đúng cái mà luật "không chia sẻ file sang email công ty" muốn tránh (file không còn thì không
 *   có gì để lỡ chia sẻ).
 */
function soDriveOcr_(b64, mime, lang) {
  var token = ScriptApp.getOAuthToken(), H = { Authorization: 'Bearer ' + token };
  var anh;
  try { anh = Utilities.newBlob(Utilities.base64Decode(b64), mime, 'nds-tem'); }
  catch (e) { return { status: 'error', message: 'Ảnh gửi lên không đúng định dạng base64.' }; }

  var id = '', mUp = 0, mEx = 0, mMoc = new Date().getTime(), chan = 'mo-phien';
  try {
    /* Chặng 1a: mở phiên nạp (chỉ JSON, không có ảnh) — Drive trả URL phiên ở header Location */
    var r1 = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id&ocrLanguage=' + encodeURIComponent(lang), {
      method: 'post', contentType: 'application/json; charset=UTF-8', headers: H,
      payload: JSON.stringify({ name: 'nds-ocr-tam', mimeType: 'application/vnd.google-apps.document' }),
      muteHttpExceptions: true
    });
    if (r1.getResponseCode() !== 200) return { status: 'error', message: 'Drive không mở được phiên nạp ảnh (HTTP ' + r1.getResponseCode() + ').' };
    var hd = r1.getAllHeaders(), noi = hd.Location || hd.location || '';
    if (!noi) return { status: 'error', message: 'Drive không trả URL phiên nạp ảnh.' };

    /* Chặng 1b: đẩy nguyên Blob ảnh vào phiên — Drive OCR ngay khi chuyển sang Google Docs */
    chan = 'nap-anh';
    var r2 = UrlFetchApp.fetch(String(noi), { method: 'put', contentType: mime, headers: H, payload: anh, muteHttpExceptions: true });
    mUp = new Date().getTime() - mMoc;
    var c2 = r2.getResponseCode(), t2 = r2.getContentText();
    if (c2 !== 200 && c2 !== 201) return { status: 'error', message: 'Drive không nhận ảnh (HTTP ' + c2 + '): ' + String(t2).slice(0, 140) };
    id = String((JSON.parse(t2) || {}).id || '');
    if (!id) return { status: 'error', message: 'Drive không trả về id file OCR.' };

    /* Chặng 2: lấy chữ đã OCR ra dạng văn bản thuần */
    chan = 'lay-chu';
    var mocEx = new Date().getTime();
    var r3 = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + id + '/export?mimeType=text/plain', { headers: H, muteHttpExceptions: true });
    mEx = new Date().getTime() - mocEx;
    if (r3.getResponseCode() !== 200) return { status: 'error', message: 'Không lấy được chữ đã OCR (HTTP ' + r3.getResponseCode() + ').' };
    var chu = String(r3.getContentText() || '');
    /* Drive đắp một dải "____" cho đường viền của tem và có BOM ở đầu — cắt đi kẻo lõi đối soát
       coi đó là từ khoá. */
    chu = chu.replace(/\uFEFF/g, '').replace(/[_]{3,}/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (!chu) return { status: 'error', message: 'OCR không thấy chữ nào trên ảnh — chụp gần hơn, đủ sáng, giữ tem phẳng.' };
    return { status: 'success', nguon: 'drive-ocr', text: chu.slice(0, 4000), msUp: mUp, msExport: mEx };
  } catch (e3) {
    return { status: 'error', message: 'Lỗi khi OCR (' + chan + '): ' + e3.message };
  } finally {
    /* Ghi lại chặng + thời gian của lượt vừa rồi để CHẨN ĐOÁN được khi chặng 2 của Apps Script trả
       trang HTML (lúc đó client không nhận được số nào). Đọc bằng: action=sku_ocr + chuanDoan=1. */
    try {
      PropertiesService.getScriptProperties().setProperty('so_chan_cuoi',
        chan + ' · nạp ' + mUp + 'ms · lấy chữ ' + mEx + 'ms · tổng ' + (new Date().getTime() - mMoc) + 'ms · ' +
        Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'HH:mm:ss'));
    } catch (e6) { /* không ghi được cũng không sao */ }
    if (id) {
      try { UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + id, { method: 'delete', headers: H, muteHttpExceptions: true }); }
      catch (e4) { try { DriveApp.getFileById(id).setTrashed(true); } catch (e5) { /* đành để Drive dọn */ } }
    }
  }
}

/** Kiểm nhanh trong editor: khoá/hạn mức + chặng của lượt OCR gần nhất.
 *  KHÔNG tự tải ảnh từ site ngoài (mã production không nên gọi ra internet ngoài Google) — muốn đọc
 *  thử một tem thật thì chạy `node qc-sku-ocr-live.mjs`, nó tự dựng ảnh rồi gọi đúng cổng này. */
function testSkuOcr() {
  var p = PropertiesService.getScriptProperties();
  Logger.log('Đã dùng hôm nay: ' + (p.getProperty('so_n_' + svNgay_()) || 0) + '/' + SO_TRAN_NGAY);
  Logger.log('Lượt OCR gần nhất: ' + (p.getProperty('so_chan_cuoi') || 'chưa có lượt nào'));
}

/** Gọi Gemini theo chuỗi model dự phòng; 429/503 = hết quota/quá tải → tụt model sau. */
function svGoiGemini_(b64, mime, khoa) {
  var loiCuoi = '';
  /* NHỚ MODEL ĐÃ CHẾT TRONG NGÀY — model hết quota (429) hoặc chết tên (404) thì bỏ qua luôn đến
     hết ngày, khỏi tốn round-trip cho mọi lượt đọc tem sau đó (đo 19/08: model đầu danh sách 429 làm
     mỗi lượt đọc tem tốn thêm ~1 giây vô ích). Khoá theo NGÀY nên hôm sau quota mới lại được thử. */
  var pp = PropertiesService.getScriptProperties();
  var kChet = 'sv_chet_' + svNgay_();
  var chet = {};
  try { chet = JSON.parse(pp.getProperty(kChet) || '{}') || {}; } catch (eC) { chet = {}; }
  var doiChet = false;
  for (var i = 0; i < SV_MODELS.length; i++) {
    if (chet[SV_MODELS[i]]) continue;
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + SV_MODELS[i] + ':generateContent?key=' + encodeURIComponent(khoa);
    var payload = {
      contents: [{ role: 'user', parts: [{ text: SV_PROMPT }, { inline_data: { mime_type: mime, data: b64 } }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: SV_SCHEMA, maxOutputTokens: 2048, temperature: 0 }
    };
    var r;
    try {
      r = UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true });
    } catch (e) {
      loiCuoi = 'không gọi được Gemini: ' + e.message;
      continue;
    }
    var code = r.getResponseCode(), txt = r.getContentText();
    if (code === 429 || code === 404) {          // hết quota trong ngày, hoặc tên model đã chết
      chet[SV_MODELS[i]] = code; doiChet = true;
      loiCuoi = 'HTTP ' + code + ' ở ' + SV_MODELS[i]; continue;
    }
    if (code === 503) { loiCuoi = 'HTTP 503 (quá tải) ở ' + SV_MODELS[i]; continue; }   // tạm thời, KHÔNG ghi chết
    if (code !== 200) return { status: 'error', message: 'AI trả HTTP ' + code + ': ' + String(txt).slice(0, 200) };
    var j; try { j = JSON.parse(txt); } catch (e2) { return { status: 'error', message: 'AI trả dữ liệu không đọc được.' }; }
    var cand = (j.candidates || [])[0];
    if (!cand) return { status: 'error', message: 'AI không trả kết quả (có thể bị chặn nội dung).' };
    if (/SAFETY|PROHIBITED/i.test(String(cand.finishReason || ''))) return { status: 'error', message: 'AI từ chối đọc ảnh này.' };
    var chu = '';
    ((cand.content && cand.content.parts) || []).forEach(function (x) { chu += (x.text || ''); });
    var o; try { o = JSON.parse(chu); } catch (e3) { return { status: 'error', message: 'AI trả JSON sai khuôn.' }; }
    var lay = function (k) { return (o[k] || []).map(function (x) { return String(x).slice(0, 60); }).slice(0, 40); };
    if (doiChet) { try { pp.setProperty(kChet, JSON.stringify(chet)); } catch (eS) { /* nhớ được thì tốt, không thì thôi */ } }
    return {
      status: 'success', model: SV_MODELS[i],
      quality: String(o.quality || ''),
      text: String(o.raw_text || '').slice(0, 4000),
      tokens: { item_codes: lay('item_codes'), specs: lay('specs'), colors: lay('colors'), brands: lay('brands'), others: lay('others') }
    };
  }
  if (doiChet) { try { pp.setProperty(kChet, JSON.stringify(chet)); } catch (eS2) { /* best-effort */ } }
  return { status: 'error', message: 'Tất cả model AI miễn phí đều đang hết hạn mức (' + loiCuoi + ') — dashboard sẽ tự thử OCR của Google, hoặc gõ mã trên tem.' };
}
