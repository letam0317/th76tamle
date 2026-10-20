/* google-script-TonMaViTri.gs — tách từ google-script.gs ngày 20/10/2026 (đánh giá: 1 tệp 3.7k dòng / 81 lệnh khó soát).
 * Mục: tồn mã vị trí (stocklocationfactory): token WMS, đồng bộ stock-locations.
 * Cùng một dự án Apps Script → dùng chung hằng/hàm ở google-script.gs (SECRET, keyBodyOK_, phanHoiJson…). KHÔNG đặt bí mật ở tệp này.
 * deploy-gas.mjs chép sang .clasp-deploy/TonMaViTri.js — nhớ chạy qc-gas-gac.mjs (bảng lệnh–gác). */
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
