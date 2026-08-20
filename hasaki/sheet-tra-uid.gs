/**
 * sheet-tra-uid.gs — SCRIPT GẮN LIỀN file Google Sheet "TRA UID - Ton kho WMS"
 * =========================================================================================
 * BỐ CỤC CỘT (chốt 17/08/2026 theo yêu cầu):
 *   A = Warehouse Name   ← máy điền (và là ô hiện "⏳ đang tra…" ngay khi bạn gõ UID)
 *   B = UID              ← BẠN NHẬP
 *   C = Location         ← BẠN NHẬP (ghi chú tay, máy KHÔNG BAO GIỜ ghi đè)
 *   D = SKU · E = Product Name · F = Trạng thái · G = Vị trí (bin)   ← máy điền
 *
 * ❗ VÌ SAO SCRIPT NÀY KHÔNG TỰ GỌI WMS (đo thật 17/08/2026):
 *   Bản đầu cho Apps Script gọi thẳng `wms-gw.inshasaki.com` → mọi lượt trả
 *   *"Địa chỉ không khả dụng"*. Tên miền phân giải công khai bình thường (160.187.94.24)
 *   nên KHÔNG phải lỗi DNS: **WMS chặn IP ngoài mạng công ty**, mà máy chủ Google thì luôn
 *   ở ngoài. ⇒ Không có cách nào để Sheet tự hỏi WMS.
 *
 * ⇒ CÁCH CHẠY THẬT: script này chỉ ĐÁNH DẤU dòng cần tra ("⏳ …" ở cột A), còn MÁY TRẠM trong
 *   mạng công ty tra WMS rồi ghi kết quả vào Sheet (`node tra-uid-sheet.mjs --dien`, task
 *   "5S Tra UID tren Sheet" chạy mỗi phút, mỗi lượt canh 51 giây → gõ xong thấy kết quả ~5–6 giây).
 *
 * Cài 1 lần: mở file → menu "Tra UID" → "Cài đặt (chạy 1 lần)" → cấp quyền → xong.
 * ========================================================================================= */

var TU_TAB = 'TRA-UID';
var TU_TAB_TOKEN = '_TOKEN';                 // tàn dư bản đầu — caiDat() sẽ xoá
var TU_HEADER = ['Warehouse Name', 'UID', 'Location', 'SKU', 'Product Name', 'Trạng thái', 'Vị trí (bin)'];
var TU_C_KHO = 1;                            // cột A — kết quả đầu tiên + ô báo "đang tra"
var TU_C_UID = 2;                            // cột B — ô nhập UID (trigger nghe cột này)
var TU_C_LOC = 3;                            // cột C — ô nhập tay, không đụng tới
var TU_C_KQ1 = 4;                            // D..G — 4 cột kết quả còn lại
var TU_SO_KQ = 4;
var TU_CHO = '⏳ đang tra…';

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Tra UID')
    .addItem('Cài đặt (chạy 1 lần)', 'caiDat')
    .addSeparator()
    .addItem('Tra lại toàn bộ', 'traLaiToanBo')
    .addItem('Xoá kết quả (giữ UID + Location)', 'xoaKetQua')
    .addToUi();
}

function caiDat() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(TU_TAB) || ss.insertSheet(TU_TAB, 0);
  sh.getRange(1, 1, 1, TU_HEADER.length).setValues([TU_HEADER])
    .setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff');
  sh.setFrozenRows(1);
  sh.setColumnWidth(1, 250); sh.setColumnWidth(2, 140); sh.setColumnWidth(3, 150);
  sh.setColumnWidth(4, 110); sh.setColumnWidth(5, 380); sh.setColumnWidth(6, 140);
  sh.setColumnWidth(7, 180);
  try {   // 2 cột NHẬP TAY: nền vàng nhạt + dạng text để không bị cắt số 0 đầu
    sh.getRange('B2:C').setNumberFormat('@').setBackground('#fef9c3');
    sh.getRange(1, 2, 1, 2).setBackground('#854d0e');
  } catch (e) { /* trang trí, lỗi thì bỏ qua */ }

  var mac = ss.getSheetByName('Sheet1') || ss.getSheetByName('Trang tính1');   // tab trống mặc định
  if (mac && ss.getSheets().length > 1 && mac.getLastRow() === 0) { ss.deleteSheet(mac); }
  var tk = ss.getSheetByName(TU_TAB_TOKEN);   // bản đầu từng cất token ở đây — nay không cần nữa
  if (tk) { try { ss.deleteSheet(tk); } catch (e) { /* bỏ qua */ } }

  var cu = ScriptApp.getProjectTriggers(), goBo = 0;
  for (var i = 0; i < cu.length; i++) {
    if (cu[i].getHandlerFunction() === 'onEditTraUid') { ScriptApp.deleteTrigger(cu[i]); goBo++; }
  }
  ScriptApp.newTrigger('onEditTraUid').forSpreadsheet(ss).onEdit().create();

  SpreadsheetApp.getUi().alert('Tra UID — đã cài xong',
    'Gõ / dán UID vào cột B. Cột C "Location" là ô nhập tay của bạn — máy không ghi đè.\n\n' +
    'Dòng vừa nhập hiện "' + TU_CHO + '" ở cột A, rồi máy trạm điền Warehouse / SKU / Product Name / ' +
    'Trạng thái / Vị trí (thường ~5–6 giây, cần máy trạm đang bật).\n\n' +
    'Trigger onEdit: đã cài (gỡ ' + goBo + ' cái cũ).',
    SpreadsheetApp.getUi().ButtonSet.OK);
}

/** Người gõ/dán UID vào cột B → đánh dấu "đang tra" ở cột A để máy trạm nhận việc. */
function onEditTraUid(e) {
  if (!e || !e.range) { return; }
  var sh = e.range.getSheet();
  if (sh.getName() !== TU_TAB) { return; }
  var c1 = e.range.getColumn(), c2 = c1 + e.range.getNumColumns() - 1;
  if (TU_C_UID < c1 || TU_C_UID > c2) { return; }        // vùng vừa sửa không chạm cột B
  var r1 = Math.max(2, e.range.getRow());
  var r2 = e.range.getRow() + e.range.getNumRows() - 1;
  if (r2 < r1) { return; }
  danhDau_(sh, r1, r2);
}

function traLaiToanBo() {
  var sh = SpreadsheetApp.getActive().getSheetByName(TU_TAB);
  if (!sh) { return; }
  var cuoi = sh.getLastRow();
  if (cuoi >= 2) { danhDau_(sh, 2, cuoi, true); }
}

function xoaKetQua() {
  var sh = SpreadsheetApp.getActive().getSheetByName(TU_TAB);
  if (!sh) { return; }
  var cuoi = sh.getLastRow();
  if (cuoi < 2) { return; }
  sh.getRange(2, TU_C_KHO, cuoi - 1, 1).clearContent();            // A
  sh.getRange(2, TU_C_KQ1, cuoi - 1, TU_SO_KQ).clearContent();     // D..G  (giữ B = UID, C = Location)
}

/** Ghi "⏳ đang tra…" vào cột A cho dòng có UID mà chưa có kết quả (ép = true: mọi dòng có UID). */
function danhDau_(sh, r1, r2, ep) {
  var n = r2 - r1 + 1;
  if (n < 1) { return; }
  var vung = sh.getRange(r1, 1, n, 2).getValues();     // A = kho/kết quả, B = UID
  var ra = [], can = false;
  for (var i = 0; i < n; i++) {
    var kho = String(vung[i][0] == null ? '' : vung[i][0]).trim();
    var uid = String(vung[i][1] == null ? '' : vung[i][1]).trim();
    if (!uid) { ra.push(['']); continue; }             // xoá UID → xoá luôn kết quả cũ
    if (!ep && kho && kho !== TU_CHO) { ra.push([kho]); continue; }
    ra.push([TU_CHO]); can = true;
  }
  if (can || ep) { sh.getRange(r1, TU_C_KHO, n, 1).setValues(ra); }
  if (ep) { sh.getRange(r1, TU_C_KQ1, n, TU_SO_KQ).clearContent(); }
}
