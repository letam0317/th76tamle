/* google-script-Bridge.gs — tách từ google-script.gs ngày 20/10/2026 (đánh giá: 1 tệp 3.7k dòng / 81 lệnh khó soát).
 * Mục: cờ tải lại + token bridge (extension wms-bridge, wshr, chat), requestStockSync.
 * Cùng một dự án Apps Script → dùng chung hằng/hàm ở google-script.gs (SECRET, keyBodyOK_, phanHoiJson…). KHÔNG đặt bí mật ở tệp này.
 * deploy-gas.mjs chép sang .clasp-deploy/Bridge.js — nhớ chạy qc-gas-gac.mjs (bảng lệnh–gác). */
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
  var k = String(kind || 'wms');
  if (k === 'wshr') return { tk: 'BRIDGE_WSHR_TOKEN', at: 'BRIDGE_WSHR_TOKEN_AT', exp: 'BRIDGE_WSHR_TOKEN_EXP' };
  // khe chat (25/09/2026): token api.hasakichat.com từ phiên NGƯỜI THẬT (extension bắt) — chat 1 phiên
  // như WMS, bot tự đăng nhập là ĐÁ NGƯỜI (user bắt quả tang 25/09) nên bridge là đường duy nhất.
  if (k === 'chat') return { tk: 'BRIDGE_CHAT_TOKEN', at: 'BRIDGE_CHAT_TOKEN_AT', exp: 'BRIDGE_CHAT_TOKEN_EXP' };
  // API chat cần 2 header: Authorization Bearer (accessToken, khe 'chat') + Auth-Token (authToken, khe này).
  if (k === 'chatauth') return { tk: 'BRIDGE_CHATAUTH_TOKEN', at: 'BRIDGE_CHATAUTH_TOKEN_AT', exp: 'BRIDGE_CHATAUTH_TOKEN_EXP' };
  return { tk: 'BRIDGE_TOKEN', at: 'BRIDGE_TOKEN_AT', exp: 'BRIDGE_TOKEN_EXP' };
}
/* 16/10/2026 — BRIDGE THEO TỪNG NGƯỜI (hướng 3: Edge máy trạm có người khác đăng nhập).
 * Trước: mỗi khe 1 chỗ → phiên người ở máy trạm ĐÈ phiên tamlc, mọi cò (kể cả cò GHI) xài phiên người đó.
 * Nay: mỗi (khe, chủ) 1 chỗ riêng BRIDGE_U_<khe>_<sub> = {tk,at,exp,email}; chủ = sub trong JWT,
 * email lấy từ JWT (WMS/hr có Email) hoặc từ bảng sub→email ghi lúc thấy token WMS (work không có email).
 * Khe chung cũ (K.tk) GIỮ cho tương thích: tamlc luôn được ghi; người khác chỉ ghi khi tamlc KHÔNG tươi
 * → đọc mặc định ưu tiên tamlc, vắng tamlc mới mượn người khác (chỉ để ĐỌC — máy trạm có khoá ghi).
 * getBridgeToken {chu:'tamlc'} = chỉ trả phiên tamlc (cò GHI + luật «có người đang làm»). */
var BRIDGE_TAMLC_SUB_ = { '18811': 1, '9665': 1 };
var BRIDGE_TAMLC_MAIL_ = 'tamlc@hasaki.vn';
function bridgeChu_(tk) {
  try {
    var p = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(tk.split('.')[1] + '===='.slice((tk.split('.')[1].length % 4) || 4))).getDataAsString());
    return { sub: p.sub != null ? String(p.sub) : '', email: String(p.email || p.Email || p.preferred_username || '').toLowerCase() };
  } catch (e) { return { sub: '', email: '' }; }
}
function bridgeLaTamlc_(c) { return !!(c && ((c.sub && BRIDGE_TAMLC_SUB_[c.sub]) || c.email === BRIDGE_TAMLC_MAIL_)); }
function bridgeTuoi_(at, exp, now) { return (now - at < 30 * 60 * 1000) && (!exp || now < exp - 15000); }
function apiBridgeToken(duLieu) {
  var kind = String(duLieu.kind || 'wms');
  var K = khoaBridge_(kind);
  var tk = String(duLieu.token || '').replace(/^Bearer\s+/i, '').trim();
  if (tk.length < 100 || !/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(tk)) return phanHoiJson({ status: 'error', message: 'Token không hợp lệ' });
  var P = PropertiesService.getScriptProperties();
  var now = new Date().getTime(), exp = Number(duLieu.exp || 0) || 0;
  var c = bridgeChu_(tk), tamlc = bridgeLaTamlc_(c);
  if (c.sub) {
    if (c.email) P.setProperty('BRIDGE_MAIL_' + c.sub, c.email);
    var email = c.email || P.getProperty('BRIDGE_MAIL_' + c.sub) || '';
    var kU = 'BRIDGE_U_' + kind + '_' + c.sub.replace(/[^0-9A-Za-z_-]/g, '').slice(0, 40);
    var u = null; try { u = JSON.parse(P.getProperty(kU) || 'null'); } catch (e) { u = null; }
    // 17/10: extension 1.6.5 kèm may (tên máy trạm, policy ghim-bridge.ps1; laptop = '') + trình duyệt → bảng Máy trạm ghi phiên vào đúng thẻ máy
    var may = String(duLieu.may || '').replace(/[^0-9A-Za-z_.-]/g, '').slice(0, 60);
    var tdu = String(duLieu.trinhDuyet || '').replace(/[^A-Za-z]/g, '').slice(0, 12);
    if (!u || u.tk !== tk || now - Number(u.at || 0) >= 30 * 1000 || (u.may || '') !== may) {
      P.setProperty(kU, JSON.stringify({ tk: tk, at: now, exp: exp, email: email, sub: c.sub, may: may, td: tdu }));
      var ds = []; try { ds = JSON.parse(P.getProperty('BRIDGE_U_DS') || '[]'); } catch (e) { ds = []; }
      if (ds.indexOf(kU) < 0) {
        ds.push(kU);
        while (ds.length > 40) P.deleteProperty(ds.shift());   // chặn rác (khe public) — giữ 40 chỗ gần nhất
        P.setProperty('BRIDGE_U_DS', JSON.stringify(ds));
      }
    }
  }
  // khe chung: tamlc (hoặc token không đọc được chủ = hành vi cũ) luôn ghi; người khác chỉ khi tamlc vắng
  if (c.sub && !tamlc) {
    var chuCu = bridgeChu_(P.getProperty(K.tk) || 'x.x');
    if (bridgeLaTamlc_(chuCu) && bridgeTuoi_(Number(P.getProperty(K.at) || 0), Number(P.getProperty(K.exp) || 0), now))
      return phanHoiJson({ status: 'success', saved: true, chung: false });
  }
  var truoc = Number(P.getProperty(K.at) || 0);
  if (now - truoc < 30 * 1000 && (P.getProperty(K.tk) || '') === tk) return phanHoiJson({ status: 'success', throttled: true });
  P.setProperty(K.tk, tk);
  P.setProperty(K.at, String(now));
  P.setProperty(K.exp, String(exp));
  return phanHoiJson({ status: 'success', saved: true });
}
/* 22/10 user «mã hoá bí mật trên PC… làm»: không máy nào giấu được khoá khỏi chính quản trị viên của nó ⇒ chốt chặn cuối là PHÁT HIỆN.
   Mỗi lượt TRAO phiên (token khác rỗng) ghi sổ BRIDGE_LAY_LOG (200 lượt gần nhất: lúc · máy · kênh · chủ) và nhắn Telegram khi:
   ① máy khai tên mà KHÔNG có nhịp tim (không phải máy trạm đã biết; không khai tên = mã cũ, chỉ ghi sổ); ② 1 máy lấy > 40 lượt/giờ;
   ③ lấy phiên GHI (chu=tamlc) lúc 22:00–05:00. Mỗi loại báo tối đa 1 tin/giờ/máy (CacheService). Tên máy do máy tự khai — kẻ giả được
   tên máy đã biết thì lọt ①, nhưng vẫn vướng ②③ và để lại dấu ở sổ. */
function bridgeGhiLay_(may, kind, chu) {
  try {
    may = String(may || '').slice(0, 40); var P = PropertiesService.getScriptProperties(), now = new Date(), C = CacheService.getScriptCache();
    var so = []; try { so = JSON.parse(P.getProperty('BRIDGE_LAY_LOG') || '[]'); } catch (e) { so = []; }
    so.push({ t: now.toISOString(), may: may, kind: String(kind || 'wms'), chu: chu || '' }); if (so.length > 200) so = so.slice(-200);
    P.setProperty('BRIDGE_LAY_LOG', JSON.stringify(so));
    var bao = function (loai, chu2) { var k = 'BLB:' + loai + ':' + may; if (C.get(k)) return; C.put(k, '1', 3600); tbBaoTele_('⚠️ Phiên work/WMS của bạn vừa được lấy bất thường\n' + chu2 + '\nMáy: ' + (may || '(không khai tên)') + ' · kênh ' + (kind || 'wms') + (chu ? ' · phiên GHI' : '') + '\nNếu không phải máy của bạn: đổi khoá dự án (doi-khoa.mjs) và đăng xuất work trên trình duyệt.'); };
    if (may && !P.getProperty('PCNHIP_' + may)) bao('la', 'Máy lạ — không có trong danh sách máy trạm.');   // thiếu tên = mã cũ chưa cập nhật → chỉ ghi sổ
    var gio = so.filter(function (x) { return x.may === may && now.getTime() - Date.parse(x.t) < 3600e3; }).length;
    if (gio > 40) bao('nhieu', 'Lấy ' + gio + ' lượt trong 1 giờ (bình thường dưới 20).');
    var h = Number(Utilities.formatDate(now, 'Asia/Ho_Chi_Minh', 'H'));
    if (chu === 'tamlc' && (h >= 22 || h < 5)) bao('dem', 'Lấy phiên GHI lúc ' + Utilities.formatDate(now, 'Asia/Ho_Chi_Minh', 'HH:mm') + ' (ngoài giờ làm).');
  } catch (e) { /* sổ hỏng không được làm hỏng lượt trao phiên */ }
}
function apiGetBridgeToken(kind, chu, may) {
  var kq = apiGetBridgeToken_(kind, chu);
  try { var j = JSON.parse(kq.getContent()); if (j && j.token) bridgeGhiLay_(may, kind, chu); } catch (e) {}
  return kq;
}
function apiGetBridgeToken_(kind, chu) {
  var K = khoaBridge_(kind);
  var P = PropertiesService.getScriptProperties();
  var now = new Date().getTime();
  if (chu === 'tamlc') {   // chỉ phiên tamlc: cò GHI + luật «có người đang làm» (phiên người khác không đá được tamlc)
    var tot = null, k = String(kind || 'wms');
    for (var s in BRIDGE_TAMLC_SUB_) {
      var u = null; try { u = JSON.parse(P.getProperty('BRIDGE_U_' + k + '_' + s) || 'null'); } catch (e) { u = null; }
      if (u && (!tot || u.at > tot.at)) tot = u;
    }
    if (!tot) {   // bản cũ chưa có chỗ riêng → khe chung nếu là tamlc
      var tkc = P.getProperty(K.tk) || '';
      if (tkc && bridgeLaTamlc_(bridgeChu_(tkc))) tot = { tk: tkc, at: Number(P.getProperty(K.at) || 0), exp: Number(P.getProperty(K.exp) || 0), email: BRIDGE_TAMLC_MAIL_ };
    }
    if (!tot) return phanHoiJson({ status: 'success', token: '', at: 0, coTungCo: false });
    return phanHoiJson(bridgeTuoi_(Number(tot.at || 0), Number(tot.exp || 0), now)
      ? { status: 'success', token: tot.tk, at: tot.at, exp: tot.exp, email: tot.email || BRIDGE_TAMLC_MAIL_, tamlc: true }
      : { status: 'success', token: '', at: tot.at, coTungCo: true });
  }
  var tk = P.getProperty(K.tk) || '';
  var at = Number(P.getProperty(K.at) || 0);
  var exp = Number(P.getProperty(K.exp) || 0);
  var song = tk && bridgeTuoi_(at, exp, now);   // tươi <30' và chưa quá hạn JWT
  // `at` LUÔN trả về (kể cả khi hết tươi) — máy trạm cần TUỔI để tính "cửa im lặng" của luật
  // "chỉ login khi không có phiên sống"; bản cũ trả at:0 nên không phân biệt được "chưa từng có
  // bridge" với "bridge vừa im 5 phút" hay "im 3 tiếng".
  var c = tk ? bridgeChu_(tk) : { sub: '', email: '' };
  var mail = c.email || (c.sub ? P.getProperty('BRIDGE_MAIL_' + c.sub) || '' : '');
  return phanHoiJson(song
    ? { status: 'success', token: tk, at: at, exp: exp, email: mail, tamlc: bridgeLaTamlc_(c) }
    : { status: 'success', token: '', at: at, coTungCo: !!tk });
}
/** bridgeDs (SECRET): ai đang cấp phiên qua bridge — {kind, sub, email, at, tuoi} (không trả token). Tab Máy trạm cũng nhận (pcBang/pcBangPh). */
function apiBridgeDs() { return phanHoiJson({ status: 'success', ds: bridgeDs_(), srvNow: new Date().getTime() }); }
function bridgeDs_() {
  var P = PropertiesService.getScriptProperties(), now = new Date().getTime();
  var ds = []; try { ds = JSON.parse(P.getProperty('BRIDGE_U_DS') || '[]'); } catch (e) { ds = []; }
  var out = [];
  for (var i = 0; i < ds.length; i++) {
    var u = null; try { u = JSON.parse(P.getProperty(ds[i]) || 'null'); } catch (e) { u = null; }
    if (!u) continue;
    var kind = ds[i].replace(/^BRIDGE_U_/, '').replace(/_[^_]*$/, '');
    var laTam = bridgeLaTamlc_({ sub: u.sub, email: u.email });
    out.push({ kind: kind, sub: u.sub || '', email: u.email || P.getProperty('BRIDGE_MAIL_' + u.sub) || (laTam ? BRIDGE_TAMLC_MAIL_ : ''), at: u.at, may: u.may || '', td: u.td || '', tuoi: bridgeTuoi_(Number(u.at || 0), Number(u.exp || 0), now), tamlc: bridgeLaTamlc_({ sub: u.sub, email: u.email }) });
  }
  out.sort(function (a, b) { return b.at - a.at; });
  return out;
}
/** bridgeDatMail (SECRET): token work chỉ có sub → 8591 tra danh bạ (user_id→staff_email) rồi ghi lại để điện thoại cũng thấy email. */
function apiBridgeDatMail_(d) {
  var sub = String(d.sub || ''), email = String(d.email || '').toLowerCase().trim();
  if (!/^\d{1,12}$/.test(sub) || !/^[^@\s]+@[^@\s]+$/.test(email)) return phanHoiJson({ status: 'error', message: 'sub/email sai' });
  PropertiesService.getScriptProperties().setProperty('BRIDGE_MAIL_' + sub, email);
  return phanHoiJson({ status: 'success' });
}

/** Kéo trọn 1 công ty từ WMS (phân trang size 5000) + LỌC theo khoGiuLai. Trả {rows} hoặc {code,message}. */
function keoWmsBo_(token, cfg) {
  var auth = /^Bearer /i.test(token) ? token : 'Bearer ' + token;
  var giu = {};
  for (var g = 0; g < cfg.khoGiuLai.length; g++) giu[cfg.khoGiuLai[g].replace(/\s+/g, ' ').trim().toUpperCase()] = 1;
  var rows = [], size = 5000, count = null, daLay = 0;
  var t0 = new Date().getTime();
  for (var page = 1; page <= 40; page++) {
    /* NGÂN SÁCH THỜI GIAN (audit 23/08/2026): 40 trang × (fetch + sleep 0,5s) có thể chạm trần 6'
       của Apps Script → execution bị Google chém ngang, mất trắng lượt VÀ không trả được lỗi nào.
       Quá 240s thì DỪNG CÓ CHỦ ĐÍCH và trả lỗi — caller sẽ KHÔNG ghi (giữ nguyên tab cũ), tuyệt
       đối không ghi nửa vời (tab thiếu dòng chính là sự cố "mastige kẹt 87 dòng" phiên bản mới). */
    if (new Date().getTime() - t0 > 240000) return { code: 504, message: 'Quá ngân sách 240s ở trang ' + page + ' (cty ' + cfg.company + ') — không ghi để giữ dữ liệu cũ; để máy trạm đồng bộ thay.' };
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
