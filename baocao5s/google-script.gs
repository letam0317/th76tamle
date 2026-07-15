/**
 * ============================================================================
 *  BACKEND: Form Audit - Kiểm soát kho 5S  (Google Apps Script)  — BẢN 2
 * ============================================================================
 *
 *  CHỨC NĂNG:
 *   - doPost: nhận dữ liệu form web, tự tạo tab "WMS-5S-AUDIT", lưu ảnh lên
 *     Drive, chèn 1 hàng mới. (giữ nguyên như bản 1)
 *   - doGet?action=pending : trả về các báo cáo CHƯA đẩy sang workflow
 *     (cột "Mã task" còn trống) và KHÔNG phải loại "Không phát sinh vi phạm",
 *     kèm ảnh dạng base64 — để bộ đẩy (push-5s-to-workflow.js) tạo task.
 *   - doGet?action=mark&row=N&code=XXX : ghi mã task vào hàng đã đẩy xong.
 *   - doGet?action=alert&msg=... : gửi email cảnh báo (vd phiên work.hasaki.vn hết hạn),
 *     có chống spam (tối đa 1 mail / ALERT_THROTTLE_GIO giờ).
 *   * Các action trên yêu cầu tham số ?key=<SECRET> để bảo vệ dữ liệu.
 *
 *  ====== KHI CẬP NHẬT BẢN NÀY: nhớ TRIỂN KHAI LẠI ======
 *   ⚠ ĐẶT LẠI biến SECRET = giá trị thật (trùng APPSCRIPT_KEY trong .env) — trong file
 *     này nó đang là placeholder để không lộ bí mật lên git.
 *   Sau khi dán đè code: Triển khai → Quản lý bản triển khai (Manage deployments)
 *   → bấm bút chì ✎ Sửa → Version: New version → Triển khai. URL /exec giữ nguyên.
 * ============================================================================
 */

var TEN_SHEET = 'WMS-5S-AUDIT';
var TEN_THU_MUC_ANH = 'WMS-5S-AUDIT-HinhAnh';
// 🔑 Mã bí mật bảo vệ endpoint đọc/đánh dấu. Bộ đẩy phải gửi ?key=... trùng giá trị này.
//    ĐẶT GIÁ TRỊ THẬT KHI DÁN VÀO APPS SCRIPT (giống APPSCRIPT_KEY trong .env, không lưu vào git).
var SECRET = 'DAT_MA_BI_MAT_RIENG_O_DAY';
var SYNC_PIN = 'DAT_PIN_RIENG_O_DAY';        // PIN chung: form Ghi nhận 5S + Cập nhật chấm công
var SYNC_PIN_DATA = 'DAT_PIN_TAI_DU_LIEU';  // PIN RIÊNG cho "Cập nhật ngay" (ép tải dữ liệu 5S)
// Cụm mở đầu của hạng mục "đạt" (không tạo task)
var KHONG_VI_PHAM_PREFIX = 'Không phát sinh vi phạm';
// Cột (1-based): 1 Ngày | 2 Hiện trạng | 3 Vị trí | 4 Hạng mục | 5 Ảnh | 6 Mã task | 7 Thời gian vi phạm
var COL_MA_TASK = 6;
var COL_TG_VI_PHAM = 7;   // thời gian lấy từ ảnh/video (client gửi); thiếu thì để trống -> bộ đẩy dùng cột Ngày
var SO_COT = 7;
var MAX_PENDING = 25; // số báo cáo trả về mỗi lần gọi (tránh quá tải)
// 📧 Email nhận cảnh báo khi phiên đăng nhập work.hasaki.vn hết hạn (bộ đẩy không lấy được token).
var ALERT_EMAIL = 'th76tamle02@gmail.com';
var ALERT_THROTTLE_GIO = 12; // chỉ gửi tối đa 1 mail mỗi 12 giờ (tránh spam mỗi lần lịch chạy)

var TEN_SHEET_TASKS = '5S-TASKS';   // tab mirror toàn bộ task workflow (cho dashboard) — TÁCH khỏi inbox

// 🔒 BẢO MẬT DỮ LIỆU CÁ NHÂN: các tab chứa PII (họ tên/email/chấm công) ghi sang 1 SHEET RIÊNG
//    KHÔNG chia sẻ công khai. Dashboard KHÔNG đọc các tab này nên không ảnh hưởng.
//    ID sheet riêng được LƯU TỰ ĐỘNG vào Script Properties khi chạy thietLapSheetRieng() 1 lần.
var PRIVATE_SHEET_ID = PropertiesService.getScriptProperties().getProperty('PRIVATE_SHEET_ID') || '';
var PII_TABS = ['NHAN-SU', 'CHAM-CONG'];         // tab nhạy cảm -> ghi vào PRIVATE_SHEET_ID

/* ----------------------------- POST: lưu form / sync ----------------------------- */
function doPost(e) {
  try {
    var duLieu = JSON.parse(e.postData.contents);
    if (duLieu && duLieu.action === 'syncTasks') return apiSyncTasks(duLieu);   // nhánh đồng bộ dashboard
    if (duLieu && duLieu.action === 'uploadBienBan') return apiUploadBienBan(duLieu);
    // Tồn mã vị trí: nút dashboard (public, cooldown tự bảo vệ) + 2 action máy-gọi-máy (cần SECRET)
    if (duLieu && duLieu.action === 'force_sync_wms') return apiForceSyncWms();
    if (duLieu && duLieu.action === 'force_sync_kiemke') return apiForceSyncKiemke();   // Kiểm kê: tab riêng, cap 2 trang test, cooldown 15'
    if (duLieu && duLieu.action === 'saveWmsToken') return ((duLieu.key || '') === SECRET) ? apiSaveWmsToken(duLieu) : phanHoiJson({ status: 'error', message: 'Sai key' });
    if (duLieu && duLieu.action === 'setStockMeta') return ((duLieu.key || '') === SECRET) ? apiSetStockMeta(duLieu) : phanHoiJson({ status: 'error', message: 'Sai key' });
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
      '',                          // 6 Mã task: để trống = chưa đẩy
      duLieu.thoiGianViPham || '', // 7 Thời gian vi phạm (lấy từ ảnh/video; thiếu thì trống)
      duLieu.maSanPham || ''       // 8 Mã sản phẩm (không bắt buộc)
    ]);
    return phanHoiJson({ status: 'success', message: 'Đã lưu dữ liệu thành công.' });
  } catch (err) {
    return phanHoiJson({ status: 'error', message: String(err) });
  }
}

/* ------------------ GET: pending / mark / kiểm tra hoạt động ------------------ */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || '';
  if (action === 'pending') return apiPending(e);
  if (action === 'mark') return apiMark(e);
  if (action === 'alert') return apiAlert(e);
  if (action === 'info') return apiInfo(e);
  if (action === 'requestLogin') return apiRequestLogin(e);   // link trong email (điện thoại/web bấm được)
  if (action === 'loginStatus') return apiLoginStatus(e);     // máy PC hỏi có yêu cầu login không
  if (action === 'clearLogin') return apiClearLogin(e);       // máy PC báo đã xử lý
  if (action === 'requestSync') return apiRequestSync(e);     // nút "Cập nhật ngay" trên dashboard (cần PIN)
  if (action === 'syncStatus') return apiSyncStatus(e);       // máy PC hỏi có yêu cầu cập nhật không
  if (action === 'clearSync') return apiClearSync(e);         // máy PC báo đã cập nhật xong
  if (action === 'caps') return phanHoiJson({ status: 'success', timesheet: true, tabWrite: true, checkPin: true, extSheet: true, stockSync: true, kiemke: true }); // + sheet ngoài, đồng bộ WMS trực tiếp, kiểm kê material
  if (action === 'requestTimesheet') return apiRequestTimesheet(e); // nút "Cập nhật chấm công" (cần PIN)
  if (action === 'timesheetStatus') return apiTimesheetStatus(e);   // máy PC hỏi có yêu cầu chấm công không
  if (action === 'clearTimesheet') return apiClearTimesheet(e);     // máy PC báo đã kéo chấm công xong
  if (action === 'checkPin') return apiCheckPin(e);                 // form "Ghi nhận 5S" kiểm PIN phía máy chủ (không lộ PIN ra front-end)
  if (action === 'lastSync') return apiLastSync(e);                 // dashboard hỏi lần ghi 5S-TASKS gần nhất (chip giờ dữ liệu)
  return phanHoiJson({ status: 'success', message: 'Web App đang hoạt động bình thường.' });
}

/** Kiểm PIN cho form Ghi nhận 5S — trả JSONP {status,ok}. PIN KHÔNG còn nằm trong mã front-end. */
function apiCheckPin(e) {
  var cb = e.parameter.callback || 'cb';
  var ok = (e.parameter.pin || '') === SYNC_PIN;
  return phanHoiJsonp(cb, { status: 'success', ok: ok });
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
 *   Biên bản đã ở cột 5S-TASKS -> auto-export-sync giữ lại qua mỗi lần đồng bộ.
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
    if (/^test/i.test(code)) continue;                        // bo dong test
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

/** Trả JSONP (cho dashboard gọi cross-origin qua thẻ <script>). */
function phanHoiJsonp(cb, obj) {
  return ContentService.createTextOutput(cb + '(' + JSON.stringify(obj) + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
}

/** Dashboard bấm "Cập nhật ngay" + nhập PIN → đặt cờ để máy PC tự chạy auto-export.
 *  Bảo vệ bằng SYNC_PIN (không phải SECRET) để không lộ key hệ thống trên trang public. */
function apiRequestSync(e) {
  var cb = e.parameter.callback || 'cb';
  if ((e.parameter.pin || '') !== SYNC_PIN_DATA) return phanHoiJsonp(cb, { status: 'error', message: 'Sai PIN' });
  PropertiesService.getScriptProperties().setProperty('SYNC_REQUESTED', String(new Date().getTime()));
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
  if ((e.parameter.pin || '') !== SYNC_PIN) return phanHoiJsonp(cb, { status: 'error', message: 'Sai PIN' });
  PropertiesService.getScriptProperties().setProperty('TS_REQUESTED', String(new Date().getTime()));
  return phanHoiJsonp(cb, { status: 'success', message: 'Đã gửi yêu cầu cập nhật chấm công. Dữ liệu sẽ mới sau vài phút.' });
}
function apiTimesheetStatus(e) {
  if ((e.parameter.key || '') !== SECRET) return phanHoiJson({ status: 'error', message: 'Sai key' });
  var ts = Number(PropertiesService.getScriptProperties().getProperty('TS_REQUESTED') || 0);
  return phanHoiJson({ status: 'success', requested: ts > 0 && (new Date().getTime() - ts) < 15 * 60 * 1000, ts: ts });
}
function apiClearTimesheet(e) {
  if ((e.parameter.key || '') !== SECRET) return phanHoiJson({ status: 'error', message: 'Sai key' });
  PropertiesService.getScriptProperties().deleteProperty('TS_REQUESTED');
  return phanHoiJson({ status: 'success', cleared: true });
}

/** Người dùng bấm nút trong email (từ ĐIỆN THOẠI hoặc WEB bất kỳ) → đặt cờ yêu cầu đăng nhập.
 *  Máy PC sẽ thấy cờ này (qua ?action=loginStatus) và tự mở màn hình đăng nhập.
 *  Trả về trang HTML thân thiện thay vì JSON. */
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

/** Trả về các báo cáo chưa đẩy (chưa có mã task) + ảnh base64. */
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
    if (maTask) continue;                                   // đã đẩy rồi
    if (!hangMuc) continue;                                 // thiếu hạng mục
    if (hangMuc.indexOf(KHONG_VI_PHAM_PREFIX) === 0) {      // "đạt" -> bỏ qua, đánh dấu để khỏi xét lại
      sheet.getRange(rowIndex, COL_MA_TASK).setValue('(không vi phạm - bỏ qua)');
      continue;
    }
    rows.push({
      row: rowIndex,
      ngay: formatNgay(r[0]),
      hienTrang: String(r[1] || ''),
      viTri: String(r[2] || ''),
      hangMuc: hangMuc,
      thoiGianViPham: formatNgay(r[COL_TG_VI_PHAM - 1]),     // thời gian vi phạm (nếu có)
      images: layAnhBase64(String(r[4] || ''))
    });
  }
  return phanHoiJson({ status: 'success', rows: rows });
}

/** Ghi mã task vào 1 hàng (sau khi đẩy thành công). */
function apiMark(e) {
  if ((e.parameter.key || '') !== SECRET) return phanHoiJson({ status: 'error', message: 'Sai key' });
  var row = parseInt(e.parameter.row, 10);
  var code = e.parameter.code || '';
  if (!row) return phanHoiJson({ status: 'error', message: 'Thiếu row' });
  layHoacTaoSheet().getRange(row, COL_MA_TASK).setValue(code);
  return phanHoiJson({ status: 'success' });
}

/** Gửi email cảnh báo (vd: phiên work.hasaki.vn hết hạn). Có chống spam theo ALERT_THROTTLE_GIO. */
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

/** Trả về ID/URL spreadsheet (để cấu hình dashboard gviz). */
function apiInfo(e) {
  if ((e.parameter.key || '') !== SECRET) return phanHoiJson({ status: 'error', message: 'Sai key' });
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return phanHoiJson({ status: 'success', sheetId: ss.getId(), sheetUrl: ss.getUrl(), tabTasks: TEN_SHEET_TASKS });
}

/** Ghi đè tab 5S-TASKS bằng dữ liệu task workflow do bộ sync gửi lên (cho dashboard).
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
  // Tab PII (NHAN-SU/CHAM-CONG) -> ghi vào SHEET RIÊNG (không công khai) nếu đã cấu hình.
  var ss;
  if (duLieu.sheetId) {
    try { ss = SpreadsheetApp.openById(String(duLieu.sheetId)); }
    catch (eX) { return phanHoiJson({ status: 'error', message: 'Không mở được sheet ngoài (sheetId): ' + eX.message }); }
  } else if (PII_TABS.indexOf(tenTab) >= 0 && PRIVATE_SHEET_ID) {
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
    try { sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).breakApart(); } catch (e) {}
    var all = [header].concat(rows);
    if (all.length && header.length) {
      sheet.getRange(1, 1, all.length, header.length).setValues(all);
      sheet.getRange(1, 1, 1, header.length).setFontWeight('bold').setBackground('#0f766e').setFontColor('#ffffff');
      try { sheet.setFrozenRows(1); } catch (e) {}
    }
  }
  // Mốc "dữ liệu mới nhất" cho dashboard (chip giờ dữ liệu) — ƯU TIÊN apiAt (lúc LẤY DỮ LIỆU từ API WMS,
  // do bộ đồng bộ gửi kèm); thiếu thì mới lấy giờ ghi Sheet
  try {
    var apiAt = Number(duLieu.apiAt || 0) || new Date().getTime();
    PropertiesService.getScriptProperties().setProperty('LAST_SYNC_' + tenTab, String(apiAt));
  } catch (e) {}
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

/** Tải biên bản (ảnh) cho 1 task -> lưu Drive + ghi tab BIEN-BAN. duLieu={code,files:[{name,mime,base64}]} */
function apiUploadBienBan(duLieu) {
  var code = String(duLieu.code || '').trim();
  if (!code) return phanHoiJson({ status: 'error', message: 'Thiếu mã task' });
  var files = duLieu.files || [];
  var it = DriveApp.getFoldersByName('WMS-5S-BIENBAN');
  var folder = it.hasNext() ? it.next() : DriveApp.createFolder('WMS-5S-BIENBAN');
  var urls = [];
  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    var blob = Utilities.newBlob(Utilities.base64Decode(f.base64), f.mime || 'image/jpeg', f.name || ('bienban_' + code + '_' + new Date().getTime() + '.jpg'));
    var file = folder.createFile(blob);
    try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
    urls.push('https://drive.google.com/uc?export=view&id=' + file.getId());
  }
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

/* ------------------------------- Tiện ích ------------------------------- */
function formatNgay(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'GMT+7', 'yyyy-MM-dd HH:mm:ss');
  return String(v || '');
}

/** Từ chuỗi link Drive (mỗi dòng 1 link) -> mảng {filename, mime, base64}. */
function layAnhBase64(chuoi) {
  var out = [];
  if (!chuoi) return out;
  var lines = chuoi.split(/\s*\n\s*/);
  for (var i = 0; i < lines.length; i++) {
    var m = lines[i].match(/[-\w]{25,}/); // ID file Drive
    if (!m) continue;
    try {
      var file = DriveApp.getFileById(m[0]);
      var blob = file.getBlob();
      out.push({ filename: file.getName(), mime: blob.getContentType(), base64: Utilities.base64Encode(blob.getBytes()) });
    } catch (err) { /* bỏ qua file lỗi */ }
  }
  return out;
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
    if (!sheet.getRange(1, COL_MA_TASK).getValue()) {        // sheet cũ chưa có cột Mã task
      sheet.getRange(1, COL_MA_TASK).setValue('Mã task workflow').setFontWeight('bold').setBackground('#2563eb').setFontColor('#ffffff');
      sheet.setColumnWidth(6, 160);
    }
    if (!sheet.getRange(1, COL_TG_VI_PHAM).getValue()) {      // sheet cũ chưa có cột Thời gian vi phạm
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
    var phan = anh.base64.split(',');
    var blob = Utilities.newBlob(Utilities.base64Decode(phan[1] || phan[0]), anh.mime, anh.ten);
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

function phanHoiJson(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
