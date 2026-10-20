/* google-script-ReadTab.gs — tách từ google-script.gs ngày 20/10/2026 (đánh giá: 1 tệp 3.7k dòng / 81 lệnh khó soát).
 * Mục: readTab (sheet PRIVATE qua whitelist) + cache RT3 + uploadBienBan.
 * Cùng một dự án Apps Script → dùng chung hằng/hàm ở google-script.gs (SECRET, keyBodyOK_, phanHoiJson…). KHÔNG đặt bí mật ở tệp này.
 * deploy-gas.mjs chép sang .clasp-deploy/ReadTab.js — nhớ chạy qc-gas-gac.mjs (bảng lệnh–gác). */
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
  /* KHOÁ THIẾT BỊ (audit 23/08/2026): các tab whitelist có tên + email + giờ chấm công NV vệ sinh
     (VESINH-PHANCONG/LICHSU/CHAMCONG-NGAY…) mà endpoint từng trả cho BẤT KỲ AI — đã test live.
     Nay đòi `tb` (dashboard tự đính kèm từ localStorage, cấp 1 lần qua link — user không gõ gì).
     DEVICE_KEY chưa đặt thì vẫn mở như cũ để rollout không làm trắng dashboard. */
  if (!tbOK_(null, e)) return phanHoiJsonp(cb, { status: 'error', code: 403, canKhoa: 1, message: 'Máy này chưa được cấp quyền đọc dữ liệu vệ sinh — mở link cấp quyền một lần rồi tải lại trang.' });
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
