/* google-script-Form5S.gs — tách từ google-script.gs ngày 20/10/2026 (đánh giá: 1 tệp 3.7k dòng / 81 lệnh khó soát).
 * Mục: form 5S: sổ người gửi, ghi nhận vi phạm, PIN (checkPin/requestSync/requestTimesheet), lastSync, email.
 * Cùng một dự án Apps Script → dùng chung hằng/hàm ở google-script.gs (SECRET, keyBodyOK_, phanHoiJson…). KHÔNG đặt bí mật ở tệp này.
 * deploy-gas.mjs chép sang .clasp-deploy/Form5S.js — nhớ chạy qc-gas-gac.mjs (bảng lệnh–gác). */
/* ===== SỔ NGƯỜI GỬI FORM 5S — RIÊNG TƯ (12/10/2026) ==========================================
 * User: "mục đích chính là biết được ai gửi". Form gửi kèm mã máy (tb — máy đã cấp quyền OTP, GAS biết TÊN người tự
 * khai lúc xin mã ở TB_DUYET) + tài khoản dashboard nếu có (hợp đồng hsk-nguoi-dung).
 * TUYỆT ĐỐI KHÔNG ghi vào sheet WMS-5S-AUDIT (anyone:reader) — kể cả tab ẩn. Ghi vào MỘT FILE RIÊNG do script tự tạo
 * (chủ = tài khoản deploy, không chia sẻ ai), id giữ ở Script Properties NGUOI_GUI_SHEET. Mã máy chỉ lưu 10 ký tự đầu
 * (mã máy đủ dài là chìa khoá vào dashboard). Nối sang dòng biên bản bằng mốc giây "Ngày giờ ghi nhận" + vị trí. */
function soNguoiGui_() {
  var pp = PropertiesService.getScriptProperties(), id = pp.getProperty('NGUOI_GUI_SHEET'), ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create('5S-NGUOI-GUI (riêng tư — không chia sẻ)');
    var sh0 = ss.getSheets()[0]; sh0.setName('NGUOI-GUI');
    sh0.appendRow(['Lúc ghi (khoá nối)', 'Vị trí', 'Hạng mục', 'Người gửi (tên)', 'Mã NV', 'Tên máy (khai lúc xin OTP)', 'Mã máy (10 ký tự)', 'Thiết bị']);
    sh0.setFrozenRows(1);
    pp.setProperty('NGUOI_GUI_SHEET', ss.getId());
  }
  return ss.getSheets()[0];
}
function khoaNguoiGui_(luc, viTri) { var t = luc instanceof Date ? luc.getTime() : new Date(luc).getTime(); return Math.floor(t / 1000) + '|' + String(viTri || '').trim(); }
function ghiNguoiGui_(luc, duLieu) {
  var tb = String(duLieu.tb || ''), all = propsMemo_(), tenMay = '';
  /* 22/10: người gửi = TÀI KHOẢN audit-dc đã đăng nhập (GAS tự tra phiên → không giả được bằng tên tự khai). Mã «tk:<phiên>» là chìa khoá:
     KHÔNG lưu mẩu nào của nó vào sổ. */
  var tkp = String(duLieu.tkPhien || (tb.indexOf('tk:') === 0 ? tb.slice(3) : '')), nTk = tkp && typeof tkPhien_ === 'function' ? tkPhien_(tkp) : null;
  if (tb.indexOf('tk:') === 0) { tb = ''; tenMay = '(đăng nhập tài khoản, máy chưa cấp mã)'; }
  if (nTk) duLieu.nguoiGui = { ten: nTk.ten || nTk.id, code: 'tk:' + nTk.id };
  if (tb) {
    if (tb === String(all.DEVICE_KEY || '')) tenMay = '(khoá chung quản trị)';
    else { try { var dd = JSON.parse(all.TB_DUYET || '{}') || {}; tenMay = dd[tb] ? (dd[tb].ten || '(không tên)') : '(máy chưa duyệt)'; } catch (e) { } }
  }
  var ng = duLieu.nguoiGui || {};
  soNguoiGui_().appendRow([luc, String(duLieu.viTri || '').trim(), String(duLieu.hangMuc || '').slice(0, 80),
    String(ng.ten || '').slice(0, 60), String(ng.code || ng.ma || '').slice(0, 20), tenMay, tb ? tb.slice(0, 10) : '', String(duLieu.ua || '').slice(0, 120)]);
}
function timNguoiGui_(m, luc, viTri) {   // ±1 giây: phòng Sheets làm tròn mốc giờ khi đọc lại
  var t = (luc instanceof Date ? luc.getTime() : new Date(luc).getTime());
  for (var d = 0; d <= 1000; d += 1000) { var a = m[khoaNguoiGui_(t - d, viTri)] || m[khoaNguoiGui_(t + d, viTri)]; if (a) return a; }
  return null;
}
/** Bảng tra khoá → người gửi (đọc 1 lần mỗi lượt pending, chỉ khi có dòng chờ; sổ chưa có → {}). */
function bangNguoiGui_() {
  var id = PropertiesService.getScriptProperties().getProperty('NGUOI_GUI_SHEET'); if (!id) return {};
  var sh = SpreadsheetApp.openById(id).getSheets()[0], n = sh.getLastRow(); if (n < 2) return {};
  var v = sh.getRange(Math.max(2, n - 2999), 1, Math.min(3000, n - 1), 7).getValues(), m = {};
  for (var i = 0; i < v.length; i++) m[khoaNguoiGui_(v[i][0], v[i][1])] = { ten: String(v[i][3] || ''), ma: String(v[i][4] || ''), may: String(v[i][5] || ''), maMay: String(v[i][6] || '') };
  return m;
}
function apiPendingData_() {
  var sheet = layHoacTaoSheet();
  var last = sheet.getLastRow();
  if (last < 2) return phanHoiJson({ status: 'success', rows: [] });
  var values = sheet.getRange(2, 1, last - 1, SO_COT).getValues();
  var rows = [], ngGui = null;   // 12/10 sổ người gửi riêng tư — chỉ đọc khi có dòng chờ
  for (var i = 0; i < values.length && rows.length < MAX_PENDING; i++) {
    var r = values[i], rowIndex = i + 2;
    var maTask = String(r[COL_MA_TASK - 1] || '').trim();
    var hangMuc = String(r[3] || '').trim();
    if (maTask) continue;
    if (!hangMuc) continue;
    if (hangMuc.indexOf(KHONG_VI_PHAM_PREFIX) === 0) { sheet.getRange(rowIndex, COL_MA_TASK).setValue('(không vi phạm - bỏ qua)'); continue; }
    /* 03/09/2026 — VÁ NGHẼN: bản cũ nhét base64 TOÀN BỘ ảnh/video của MỌI dòng tồn vào 1 phản hồi.
       9 dòng tồn (7 dòng 03/09 + 2 dòng 13/08) → phản hồi quá nặng → chặng 2 googleusercontent 404
       rồi rơi về trang doGet mặc định → bộ đẩy tưởng "0 báo cáo" → tồn càng dày càng chết hẳn.
       Nay pending chỉ trả METADATA + anhIds; bộ đẩy lấy ảnh TỪNG FILE qua action 'anh' bên dưới. */
    if (ngGui === null) { try { ngGui = bangNguoiGui_(); } catch (eG) { ngGui = {}; } }
    rows.push({ row: rowIndex, nguoiGui: timNguoiGui_(ngGui, r[0], r[2]), ngay: formatNgay(r[0]), hienTrang: String(r[1] || ''), viTri: String(r[2] || ''), hangMuc: hangMuc, thoiGianViPham: formatNgay(r[COL_TG_VI_PHAM - 1]), maSanPham: String(r[COL_MA_SP - 1] || '').trim(), nhanVienViPham: String(r[COL_NV_VP - 1] || '').trim(), anhIds: layIdAnh_(String(r[4] || '')) });
  }
  return phanHoiJson({ status: 'success', rows: rows });
}
/** Lấy base64 theo DANH SÁCH id file Drive (bộ đẩy gọi từng file — mỗi call 1 ảnh, không gánh cả lô).
 *  duLieu.chiMeta=1: chỉ trả tên/mime/kích thước (chẩn đoán file quá nặng — video lớn base64 không
 *  bao giờ chui lọt chặng 2 googleusercontent, xem sự cố 03/09). */
function apiAnhData_(duLieu) {
  var ids = duLieu.ids || [];
  if (typeof ids === 'string') ids = [ids];
  var chiMeta = !!duLieu.chiMeta;
  var out = [];
  for (var i = 0; i < ids.length && i < 8; i++) {              // trần 8 file/call — đủ cho 1 dòng báo cáo
    var id = String(ids[i] || '').trim();
    if (!/^[-\w]{25,}$/.test(id)) continue;
    try {
      var f = DriveApp.getFileById(id);
      if (chiMeta) { out.push({ id: id, filename: f.getName(), mime: f.getMimeType(), bytes: f.getSize() }); continue; }
      var b = f.getBlob();
      out.push({ id: id, filename: f.getName(), mime: b.getContentType(), base64: Utilities.base64Encode(b.getBytes()) });
    } catch (err) { out.push({ id: id, loi: String(err) }); }  // file hỏng: báo đích danh, không giết cả call
  }
  return phanHoiJson({ status: 'success', files: out });
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
      maSanPham: String(r[COL_MA_SP - 1] || '').trim(),
      nhanVienViPham: String(r[COL_NV_VP - 1] || '').trim(),
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

/** Ghi ĐÚNG MỘT CỘT của một tab, KHÔNG chạm cột khác và KHÔNG clear tab (22/09/2026).
 *  Sinh ra để cập nhật cột trạng thái trong những bảng nhiều định dạng (vd cột "KHAI BÁO PLANOGRAM"
 *  của tab BAO-DUONG-170) — `syncTasks` không dùng được ở đó vì nó ghi đè cả tab.
 *  Bắt buộc: tab · cot (1-based) · tuDong (≥2, chặn ghi lên hàng tiêu đề) · values[] (không rỗng).
 *  Chỉ setValues nên định dạng/ô hợp nhất của cột giữ nguyên. Có LockService như đường ghi chính. */
function apiGhiCot(duLieu) {
  var tab = String(duLieu.tab || ''), cot = Number(duLieu.cot || 0), tuDong = Number(duLieu.tuDong || 0);
  var values = duLieu.values || [];
  if (!tab || !(cot >= 1) || !(tuDong >= 2) || !values.length)
    return phanHoiJson({ status: 'error', message: 'Thiếu/sai tab, cot (≥1), tuDong (≥2) hoặc values rỗng.' });
  var ss;
  try { ss = duLieu.sheetId ? SpreadsheetApp.openById(String(duLieu.sheetId)) : SpreadsheetApp.getActiveSpreadsheet(); }
  catch (eO) { return phanHoiJson({ status: 'error', message: 'Không mở được sheet: ' + eO.message }); }
  var sheet = ss.getSheetByName(tab);
  if (!sheet) return phanHoiJson({ status: 'error', message: 'Không thấy tab ' + tab });
  var lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(30000)) return phanHoiJson({ status: 'error', message: 'Sheet đang bận — thử lại sau.' });
    var m = [];
    for (var i = 0; i < values.length; i++) m.push([values[i] == null ? '' : String(values[i])]);
    var can = tuDong + m.length - 1;
    if (sheet.getMaxRows() < can) sheet.insertRowsAfter(sheet.getMaxRows(), can - sheet.getMaxRows());
    sheet.getRange(tuDong, cot, m.length, 1).setValues(m);
    SpreadsheetApp.flush();
    return phanHoiJson({ status: 'success', tab: tab, cot: cot, tuDong: tuDong, soDong: m.length });
  } catch (eG) {
    return phanHoiJson({ status: 'error', message: eG.message });
  } finally {
    try { lock.releaseLock(); } catch (eL) { /* chưa giữ khoá thì thôi */ }
  }
}

/** ĐỌC một spreadsheet bất kỳ mà tài khoản GAS mở được (openById) — cặp với apiGhiCot cho sheet ngoài.
 *  Sinh 24/09/2026 (việc lắp công thức kỳ cân phế liệu): SA timvieclamdem mất quyền nên tool node
 *  không tự đọc được sheet của người khác chia sẻ cho tài khoản này; GAS đọc hộ, SECRET gác server-side.
 *  duLieu: sheetId (bắt buộc) · gid HOẶC tab (thiếu cả hai → chỉ trả DANH SÁCH tab) · vung (A1, mặc
 *  định cả vùng dữ liệu) · congThuc=true trả kèm getFormulas. Chặn vùng > 60k ô để khỏi vỡ payload. */
function apiDocSheet(duLieu) {
  var sheetId = String(duLieu.sheetId || '');
  if (!sheetId) return phanHoiJson({ status: 'error', message: 'Thiếu sheetId.' });
  var ss;
  try { ss = SpreadsheetApp.openById(sheetId); }
  catch (eO) { return phanHoiJson({ status: 'error', message: 'Không mở được sheet: ' + eO.message }); }
  var coGid = duLieu.gid !== undefined && duLieu.gid !== null && duLieu.gid !== '';
  if (!coGid && !duLieu.tab) {
    var ds = ss.getSheets().map(function (s) {
      return { gid: s.getSheetId(), tab: s.getName(), dong: s.getLastRow(), cot: s.getLastColumn() };
    });
    return phanHoiJson({ status: 'success', ten: ss.getName(), tabs: ds });
  }
  var sheet = null;
  if (coGid) {
    var gid = Number(duLieu.gid), all = ss.getSheets();
    for (var i = 0; i < all.length; i++) if (all[i].getSheetId() === gid) { sheet = all[i]; break; }
  } else {
    sheet = ss.getSheetByName(String(duLieu.tab));
  }
  if (!sheet) return phanHoiJson({ status: 'error', message: 'Không thấy tab (gid/tab).' });
  var range = duLieu.vung ? sheet.getRange(String(duLieu.vung))
    : sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), Math.max(sheet.getLastColumn(), 1));
  if (range.getNumRows() * range.getNumColumns() > 60000)
    return phanHoiJson({ status: 'error', message: 'Vùng quá lớn (' + range.getNumRows() + '×' + range.getNumColumns() + ' ô > 60k) — thu hẹp bằng vung.' });
  var ra = { status: 'success', ten: ss.getName(), tab: sheet.getName(), gid: sheet.getSheetId(),
             vung: range.getA1Notation(), values: range.getDisplayValues() };
  if (duLieu.congThuc === true) ra.formulas = range.getFormulas();
  return phanHoiJson(ra);
}

/** Thao tác VÙNG trên sheet bất kỳ (bộ ba docSheet/ghiCot/vungLenh — 24/09/2026, SECRET gác server-side).
 *  duLieu: sheetId + gid HOẶC tab + lenh[] (1..30) chạy TUẦN TỰ, mỗi lệnh một trong:
 *   {loai:'copy',         tu:'O25:W25', den:'O40'}     — copyTo đủ (định dạng + công thức; công thức
 *                                                        tương đối TỰ DỊCH theo vị trí — cần thì ghi đè lại bằng 'ghi')
 *   {loai:'copyDinhDang', tu:'O24:W24', den:'O25:W39'} — CHỈ định dạng (nguồn lặp phủ kín đích)
 *   {loai:'ghi',          vung:'O2:O40', values:[[..],..]} — setValues khớp kích thước; chuỗi '=…' thành công thức
 *   {loai:'xoa',          vung:'O25:W25'}              — clearContent (giữ định dạng)
 *   {loai:'noiRong',      dong:120, cot:29}            — nới lưới tab tới tối thiểu dong×cot
 *   {loai:'dinhDangSo',   vung:'Y3:Y40', mau:'mm/yyyy'} — setNumberFormat ('@' = chữ thuần)
 *  Lỗi giữa chừng: dừng, trả daChay để biết đã chạy tới đâu. LockService như các đường ghi khác. */
function apiVungLenh(duLieu) {
  var lenh = duLieu.lenh || [];
  if (!duLieu.sheetId || !lenh.length || lenh.length > 30)
    return phanHoiJson({ status: 'error', message: 'Cần sheetId + lenh[] (1..30 lệnh).' });
  var ss;
  try { ss = SpreadsheetApp.openById(String(duLieu.sheetId)); }
  catch (eO) { return phanHoiJson({ status: 'error', message: 'Không mở được sheet: ' + eO.message }); }
  var sheet = null;
  if (duLieu.gid !== undefined && duLieu.gid !== null && duLieu.gid !== '') {
    var gid = Number(duLieu.gid), all = ss.getSheets();
    for (var i = 0; i < all.length; i++) if (all[i].getSheetId() === gid) { sheet = all[i]; break; }
  } else {
    sheet = ss.getSheetByName(String(duLieu.tab || ''));
  }
  if (!sheet) return phanHoiJson({ status: 'error', message: 'Không thấy tab (gid/tab).' });
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return phanHoiJson({ status: 'error', message: 'Sheet đang bận — thử lại sau.' });
  var nhatKy = [];
  try {
    for (var k = 0; k < lenh.length; k++) {
      var l = lenh[k];
      if (l.loai === 'copy' || l.loai === 'copyDinhDang') {
        sheet.getRange(String(l.tu)).copyTo(sheet.getRange(String(l.den)), { formatOnly: l.loai === 'copyDinhDang' });
        nhatKy.push(l.loai + ' ' + l.tu + '→' + l.den);
      } else if (l.loai === 'ghi') {
        var r = sheet.getRange(String(l.vung));
        var vals = l.values || [];
        if (r.getNumRows() * r.getNumColumns() > 10000) throw new Error('ghi ' + l.vung + ': quá 10k ô');
        if (vals.length !== r.getNumRows() || (vals[0] || []).length !== r.getNumColumns())
          throw new Error('ghi ' + l.vung + ': values ' + vals.length + '×' + (vals[0] || []).length + ' ≠ vùng ' + r.getNumRows() + '×' + r.getNumColumns());
        r.setValues(vals);
        nhatKy.push('ghi ' + l.vung);
      } else if (l.loai === 'xoa') {
        sheet.getRange(String(l.vung)).clearContent();
        nhatKy.push('xoa ' + l.vung);
      } else if (l.loai === 'baoVe') {
        // {loai:'baoVe', vung:'P3:R100', moTa:'Khoá công thức'} — bảo vệ CẢNH BÁO (Google không cho
        // chặn tuyệt đối chủ sở hữu file; warning-only bật hộp xác nhận với MỌI người sửa, script vẫn ghi được)
        var moTaBV = String(l.moTa || 'Khoá công thức');
        var vungBV = sheet.getRange(String(l.vung));
        var daCoBV = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE).some(function (p) {
          return p.getDescription() === moTaBV && p.getRange() && p.getRange().getA1Notation() === vungBV.getA1Notation();
        });
        if (!daCoBV) vungBV.protect().setDescription(moTaBV).setWarningOnly(true);
        nhatKy.push('baoVe ' + l.vung + (daCoBV ? ' (đã có)' : ''));
      } else if (l.loai === 'toMau') {
        // {loai:'toMau', vung:'Q1:R1', mau:'#d9ead3'} — tô nền; mau rỗng = trả về trắng mặc định
        sheet.getRange(String(l.vung)).setBackground(l.mau ? String(l.mau) : null);
        nhatKy.push('toMau ' + l.vung + ' = ' + (l.mau || 'trắng'));
      } else if (l.loai === 'dinhDangSo') {
        // {loai:'dinhDangSo', vung:'Y3:Y40', mau:'mm/yyyy'} — setNumberFormat ('@' = chữ thuần)
        sheet.getRange(String(l.vung)).setNumberFormat(String(l.mau || '@'));
        nhatKy.push('dinhDangSo ' + l.vung + ' = ' + (l.mau || '@'));
      } else if (l.loai === 'noiRong') {
        // {loai:'noiRong', dong?, cot?} — nới lưới tab tới tối thiểu dong×cot (getRange ngoài lưới là ném lỗi)
        var canDong = Number(l.dong || 0), canCot = Number(l.cot || 0);
        if (canDong > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), canDong - sheet.getMaxRows());
        if (canCot > sheet.getMaxColumns()) sheet.insertColumnsAfter(sheet.getMaxColumns(), canCot - sheet.getMaxColumns());
        nhatKy.push('noiRong → ' + sheet.getMaxRows() + '×' + sheet.getMaxColumns());
      } else {
        throw new Error('lệnh không hỗ trợ: ' + l.loai);
      }
    }
    SpreadsheetApp.flush();
    return phanHoiJson({ status: 'success', daChay: nhatKy });
  } catch (eG) {
    return phanHoiJson({ status: 'error', message: eG.message, daChay: nhatKy });
  } finally {
    try { lock.releaseLock(); } catch (eL) { /* chưa giữ khoá thì thôi */ }
  }
}

/* Ghi chú 25/09/2026: quy ước "gõ đơn giá không cần dấu phẩy" của sheet phiếu cân phế liệu
 * (23→2,3 ở cột G/T tab 9999) nằm ở BOUND SCRIPT gắn thẳng sheet đó (onEdit simple trigger,
 * scriptId 1zkHvpQ8dUJcUPCvCeP3TNAJMtm-nLhH-zBTIE-HjQO7_JSiBl1sfuhIC) — không đi qua web app này
 * vì ScriptApp.newTrigger đòi scope script.scriptapp chưa từng cấp cho project. */

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
  /* LockService (audit 23/08/2026): đây là ĐƯỜNG GHI CHÍNH mà 3 nguồn cùng gọi (task 8h40, guard,
     poller 2') — không khoá thì clearContents của lượt này có thể chen GIỮA clear+setValues của
     lượt kia ⇒ tab nửa vời. Chờ tối đa 30s; không lấy được khoá thì trả lỗi để client (gasPost có
     nonce + thử lại) tự gửi lại, còn hơn ghi chồng. */
  var _lock = LockService.getScriptLock();
  try {
    if (!_lock.tryLock(30000)) return phanHoiJson({ status: 'error', message: 'Sheet đang bận (lượt ghi khác đang chạy) — thử lại sau.' });
    return apiSyncTasksGhi_(duLieu, header, rows);
  } finally {
    try { _lock.releaseLock(); } catch (eL) { /* chưa giữ khoá thì thôi */ }
  }
}
function apiSyncTasksGhi_(duLieu, header, rows) {
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
