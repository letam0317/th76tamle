/**
 * sheet-tra-uid.gs — SCRIPT GẮN LIỀN file Google Sheet "TRA UID - Ton kho WMS"
 * =========================================================================================
 * BỐ CỤC CỘT (chốt 21/08/2026 — thêm cột ID do người dùng tự đánh số):
 *   A = ID               ← BẠN NHẬP (máy KHÔNG BAO GIỜ đè)
 *   B = UID              ← BẠN NHẬP  (trigger nghe cột này)
 *   C = Location         ← BẠN NHẬP (ghi chú tay, máy KHÔNG BAO GIỜ đè)
 *   D = SKU              ← máy điền, VÀ là ô hiện "⏳ đang tra…" ngay khi bạn gõ UID
 *   E = Product Name · F = Trạng thái · G = Vị trí (bin) · H = Warehouse Name  ← máy điền
 *
 * ⚠ BỐ CỤC CŨ (trước 21/08) là A=Warehouse Name · B=UID · C=Location · D..G kết quả. Ngày 18/08
 *   có người chèn thêm 1 cột ở đầu bảng: mọi cột dịch phải 1 ô, ô chốt bố cục (A1) không còn là
 *   "Warehouse Name" ⇒ máy trạm CHẶN cứng và **đứng im 3.699 lượt (≈2,5 ngày)**. Bài học: đổi bố
 *   cục bảng thì phải đổi cả 2 tệp `sheet-tra-uid.gs` + `tra-uid-sheet.mjs` rồi đẩy lại script.
 *
 * ❗ VÌ SAO SCRIPT NÀY KHÔNG TỰ GỌI WMS (đo thật 17/08/2026):
 *   Bản đầu cho Apps Script gọi thẳng `wms-gw.inshasaki.com` → mọi lượt trả
 *   *"Địa chỉ không khả dụng"*. Tên miền phân giải công khai bình thường (160.187.94.24)
 *   nên KHÔNG phải lỗi DNS: **WMS chặn IP ngoài mạng công ty**, mà máy chủ Google thì luôn
 *   ở ngoài. ⇒ Không có cách nào để Sheet tự hỏi WMS.
 *
 * ⇒ CÁCH CHẠY THẬT: script này chỉ ĐÁNH DẤU dòng cần tra ("⏳ …" ở cột D), còn MÁY TRẠM trong
 *   mạng công ty tra WMS rồi ghi kết quả vào Sheet (`node tra-uid-sheet.mjs --dien`, task
 *   "5S Tra UID tren Sheet" chạy mỗi phút, mỗi lượt canh 51 giây → gõ xong thấy kết quả ~5–6 giây).
 *
 * Cài 1 lần: mở file → menu "Tra UID" → "Cài đặt (chạy 1 lần)" → cấp quyền → xong.
 * ========================================================================================= */

var TU_TAB = 'TRA-UID';
var TU_TAB_TOKEN = '_TOKEN';                 // tàn dư bản đầu — caiDat() sẽ xoá
var TU_HEADER = ['ID', 'UID', 'Location', 'SKU', 'Product Name', 'Trạng thái', 'Vị trí (bin)', 'Warehouse Name'];
var TU_C_ID = 1;                             // cột A — người dùng tự đánh số, KHÔNG ĐỤNG
var TU_C_UID = 2;                            // cột B — ô nhập UID (trigger nghe cột này)
var TU_C_LOC = 3;                            // cột C — ô nhập tay, KHÔNG ĐỤNG
var TU_C_KQ1 = 4;                            // cột D — kết quả đầu tiên (SKU) + ô báo "đang tra"
var TU_SO_KQ = 5;                            // D..H = 5 cột kết quả
var TU_CHO = '⏳ đang tra…';

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Tra UID')
    .addItem('Cài đặt (chạy 1 lần)', 'caiDat')
    .addSeparator()
    .addItem('Tra lại toàn bộ', 'traLaiToanBo')
    .addItem('Xoá kết quả (giữ ID + UID + Location)', 'xoaKetQua')
    .addToUi();
}

function caiDat() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(TU_TAB) || ss.insertSheet(TU_TAB, 0);
  sh.getRange(1, 1, 1, TU_HEADER.length).setValues([TU_HEADER])
    .setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff');
  sh.setFrozenRows(1);
  sh.setColumnWidth(1, 60); sh.setColumnWidth(2, 140); sh.setColumnWidth(3, 150);
  sh.setColumnWidth(4, 110); sh.setColumnWidth(5, 380); sh.setColumnWidth(6, 140);
  sh.setColumnWidth(7, 180); sh.setColumnWidth(8, 250);
  try {   // 3 cột NHẬP TAY: nền vàng nhạt + dạng text để không bị cắt số 0 đầu
    sh.getRange('A2:C').setNumberFormat('@').setBackground('#fef9c3');
    sh.getRange(1, 1, 1, 3).setBackground('#854d0e');
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
    'Gõ / dán UID vào cột B. Cột A "ID" và cột C "Location" là ô nhập tay của bạn — máy không ghi đè.\n\n' +
    'Dòng vừa nhập hiện "' + TU_CHO + '" ở cột D, rồi máy trạm điền SKU / Product Name / Trạng thái / ' +
    'Vị trí (bin) / Warehouse Name (thường ~5–6 giây, cần máy trạm đang bật).\n\n' +
    'Trigger onEdit: đã cài (gỡ ' + goBo + ' cái cũ).',
    SpreadsheetApp.getUi().ButtonSet.OK);
}

/** Người gõ/dán UID vào cột B → đánh dấu "đang tra" ở cột D để máy trạm nhận việc. */
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
  sh.getRange(2, TU_C_KQ1, cuoi - 1, TU_SO_KQ).clearContent();     // D..H (giữ A, B, C)
}

/** Đánh dấu "⏳ đang tra…" ở cột D cho dòng CÓ UID mà chưa có kết quả (ep = true: mọi dòng có UID).
 *  DÒNG KHÔNG CÓ UID: giữ nguyên D..H — bảng này còn chứa hàng trăm dòng người dùng dán tay từ báo
 *  cáo WMS (có SKU/kho nhưng không có UID); bản cũ xoá trắng theo cả vùng nên sẽ nuốt sạch chúng.
 *  Ngoại lệ duy nhất: người vừa XOÁ UID ở đúng ô đó (onEdit, ep = false) thì dọn kết quả cũ đi. */
function danhDau_(sh, r1, r2, ep) {
  var n = r2 - r1 + 1;
  if (n < 1) { return; }
  var uids = sh.getRange(r1, TU_C_UID, n, 1).getValues();          // B
  var kq = sh.getRange(r1, TU_C_KQ1, n, TU_SO_KQ).getValues();     // D..H
  var doi = false;
  for (var i = 0; i < n; i++) {
    var uid = String(uids[i][0] == null ? '' : uids[i][0]).trim();
    var moc = String(kq[i][0] == null ? '' : kq[i][0]).trim();
    if (!uid) {
      if (ep) { continue; }                                        // dòng dán tay → không đụng
      for (var c = 0; c < TU_SO_KQ; c++) { if (kq[i][c] !== '') { kq[i][c] = ''; doi = true; } }
      continue;
    }
    /* GÕ UID VÀO Ô B = YÊU CẦU TRA, kể cả khi cột D đang có sẵn số (bảng này có ~640 dòng dán tay
       từ báo cáo WMS, cột D đã có SKU). Bản cũ "đã có kết quả → để yên" nên gõ UID vào đúng những
       dòng ấy thì KHÔNG BAO GIỜ được tra. Không xoá E..H ngay: cứ để giá trị cũ cho người xem tới
       khi máy trạm có câu trả lời (~5-6 giây) rồi ghi đè. */
    if (moc === TU_CHO) { continue; }                               // đang chờ rồi → khỏi ghi lại
    kq[i][0] = TU_CHO; doi = true;
    if (ep) { for (var c2 = 1; c2 < TU_SO_KQ; c2++) { kq[i][c2] = ''; } }
  }
  if (doi) { sh.getRange(r1, TU_C_KQ1, n, TU_SO_KQ).setValues(kq); }
}
