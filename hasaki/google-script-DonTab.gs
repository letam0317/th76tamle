/* google-script-DonTab.gs — tách từ google-script.gs ngày 20/10/2026 (đánh giá: 1 tệp 3.7k dòng / 81 lệnh khó soát).
 * Mục: dọn/soát/chuẩn hoá tab (chạy tay trong editor) + ảnh Drive + layHoacTaoSheet.
 * Cùng một dự án Apps Script → dùng chung hằng/hàm ở google-script.gs (SECRET, keyBodyOK_, phanHoiJson…). KHÔNG đặt bí mật ở tệp này.
 * deploy-gas.mjs chép sang .clasp-deploy/DonTab.js — nhớ chạy qc-gas-gac.mjs (bảng lệnh–gác). */
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

/** Bóc DANH SÁCH id file Drive từ chuỗi cột "Chuỗi hình ảnh" (mỗi dòng 1 URL/id). */
function layIdAnh_(chuoi) {
  var out = [];
  if (!chuoi) return out;
  var lines = chuoi.split(/\s*\n\s*/);
  for (var i = 0; i < lines.length; i++) {
    var m = lines[i].match(/[-\w]{25,}/);
    if (m) out.push(m[0]);
  }
  return out;
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
    sheet.appendRow(['Ngày giờ ghi nhận', 'Hiện trạng (Ghi chú)', 'Vị trí (Mã vạch)', 'Hạng mục 5S', 'Chuỗi hình ảnh', 'Mã task workflow', 'Thời gian vi phạm', 'Mã sản phẩm', 'Nhân viên vi phạm']);
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
    if (!sheet.getRange(1, COL_MA_SP).getValue()) {
      sheet.getRange(1, COL_MA_SP).setValue('Mã sản phẩm').setFontWeight('bold').setBackground('#2563eb').setFontColor('#ffffff');
      sheet.setColumnWidth(8, 150);
    }
    // 22/09/2026 — cột 9 Nhân viên vi phạm. BẮT BUỘC nới khung cột TRƯỚC: getRange(...,SO_COT) trên sheet
    // cũ chỉ có 8 cột sẽ NÉM LỖI, làm chết cả apiPending → bộ đẩy tưởng "0 báo cáo" (bẫy 0-giả 03/09).
    if (sheet.getMaxColumns() < SO_COT) sheet.insertColumnsAfter(sheet.getMaxColumns(), SO_COT - sheet.getMaxColumns());
    if (!sheet.getRange(1, COL_NV_VP).getValue()) {
      sheet.getRange(1, COL_NV_VP).setValue('Nhân viên vi phạm').setFontWeight('bold').setBackground('#2563eb').setFontColor('#ffffff');
      sheet.setColumnWidth(9, 220);
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
