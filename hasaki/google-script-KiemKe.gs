/* google-script-KiemKe.gs — tách từ google-script.gs ngày 20/10/2026 (đánh giá: 1 tệp 3.7k dòng / 81 lệnh khó soát).
 * Mục: kiểm kê material (physical count) tab kiemke-material.
 * Cùng một dự án Apps Script → dùng chung hằng/hàm ở google-script.gs (SECRET, keyBodyOK_, phanHoiJson…). KHÔNG đặt bí mật ở tệp này.
 * deploy-gas.mjs chép sang .clasp-deploy/KiemKe.js — nhớ chạy qc-gas-gac.mjs (bảng lệnh–gác). */
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
