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
var SYNC_PIN = 'DAT_PIN_RIENG_O_DAY';   // PIN cho nút "Cập nhật ngay" trên dashboard (chỉ người biết PIN mới ép refresh được)
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
//    ĐẶT ID sheet riêng (tạo tay, chỉ chia sẻ nội bộ) vào đây; để trống '' = vẫn ghi vào sheet hiện tại.
var PRIVATE_SHEET_ID = '';                       // vd '1AbC...'; trống = chưa tách (giữ hành vi cũ)
var PII_TABS = ['NHAN-SU', 'CHAM-CONG'];         // tab nhạy cảm -> ghi vào PRIVATE_SHEET_ID

/* ----------------------------- POST: lưu form / sync ----------------------------- */
function doPost(e) {
  try {
    var duLieu = JSON.parse(e.postData.contents);
    if (duLieu && duLieu.action === 'syncTasks') return apiSyncTasks(duLieu);   // nhánh đồng bộ dashboard
    if (duLieu && duLieu.action === 'uploadBienBan') return apiUploadBienBan(duLieu);
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
      duLieu.thoiGianViPham || ''  // 7 Thời gian vi phạm (lấy từ ảnh/video; thiếu thì trống)
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
  if (action === 'caps') return phanHoiJson({ status: 'success', timesheet: true, tabWrite: true, checkPin: true }); // bản hỗ trợ ghi tab + chấm công + kiểm PIN máy chủ
  if (action === 'requestTimesheet') return apiRequestTimesheet(e); // nút "Cập nhật chấm công" (cần PIN)
  if (action === 'timesheetStatus') return apiTimesheetStatus(e);   // máy PC hỏi có yêu cầu chấm công không
  if (action === 'clearTimesheet') return apiClearTimesheet(e);     // máy PC báo đã kéo chấm công xong
  if (action === 'checkPin') return apiCheckPin(e);                 // form "Ghi nhận 5S" kiểm PIN phía máy chủ (không lộ PIN ra front-end)
  return phanHoiJson({ status: 'success', message: 'Web App đang hoạt động bình thường.' });
}

/** Kiểm PIN cho form Ghi nhận 5S — trả JSONP {status,ok}. PIN KHÔNG còn nằm trong mã front-end. */
function apiCheckPin(e) {
  var cb = e.parameter.callback || 'cb';
  var ok = (e.parameter.pin || '') === SYNC_PIN;
  return phanHoiJsonp(cb, { status: 'success', ok: ok });
}

/** Trả JSONP (cho dashboard gọi cross-origin qua thẻ <script>). */
function phanHoiJsonp(cb, obj) {
  return ContentService.createTextOutput(cb + '(' + JSON.stringify(obj) + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
}

/** Dashboard bấm "Cập nhật ngay" + nhập PIN → đặt cờ để máy PC tự chạy auto-export.
 *  Bảo vệ bằng SYNC_PIN (không phải SECRET) để không lộ key hệ thống trên trang public. */
function apiRequestSync(e) {
  var cb = e.parameter.callback || 'cb';
  if ((e.parameter.pin || '') !== SYNC_PIN) return phanHoiJsonp(cb, { status: 'error', message: 'Sai PIN' });
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

/** Ghi đè tab 5S-TASKS bằng dữ liệu task workflow do bộ sync gửi lên (cho dashboard). */
function apiSyncTasks(duLieu) {
  if ((duLieu.key || '') !== SECRET) return phanHoiJson({ status: 'error', message: 'Sai key' });
  var header = duLieu.header || [];
  var rows = duLieu.rows || [];
  var tenTab = duLieu.tab || TEN_SHEET_TASKS;   // tab đích (mặc định 5S-TASKS; vd NHAN-SU)
  // Tab PII (NHAN-SU/CHAM-CONG) -> ghi vào SHEET RIÊNG (không công khai) nếu đã cấu hình.
  var ss;
  if (PII_TABS.indexOf(tenTab) >= 0 && PRIVATE_SHEET_ID) {
    try { ss = SpreadsheetApp.openById(PRIVATE_SHEET_ID); }
    catch (e) { return phanHoiJson({ status: 'error', message: 'Không mở được sheet riêng (PRIVATE_SHEET_ID): ' + e.message }); }
  } else {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  }
  var sheet = ss.getSheetByName(tenTab);
  if (!sheet) sheet = ss.insertSheet(tenTab);
  sheet.clearContents();
  try { sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).breakApart(); } catch (e) {}
  var all = [header].concat(rows);
  if (all.length && header.length) {
    sheet.getRange(1, 1, all.length, header.length).setValues(all);
    sheet.getRange(1, 1, 1, header.length).setFontWeight('bold').setBackground('#0f766e').setFontColor('#ffffff');
    try { sheet.setFrozenRows(1); } catch (e) {}
  }
  return phanHoiJson({ status: 'success', written: rows.length, at: Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd HH:mm:ss') });
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
