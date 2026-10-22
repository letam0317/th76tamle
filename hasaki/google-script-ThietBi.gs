/* google-script-ThietBi.gs — tách từ google-script.gs ngày 20/10/2026 (đánh giá: 1 tệp 3.7k dòng / 81 lệnh khó soát).
 * Mục: KHOÁ THIẾT BỊ (tb) + cấp quyền bằng OTP 4 số qua Telegram (tb_xin/tb_tra/tb_otp/tb_ip, tbOK_).
 * Cùng một dự án Apps Script → dùng chung hằng/hàm ở google-script.gs (SECRET, keyBodyOK_, phanHoiJson…). KHÔNG đặt bí mật ở tệp này.
 * deploy-gas.mjs chép sang .clasp-deploy/ThietBi.js — nhớ chạy qc-gas-gac.mjs (bảng lệnh–gác). */
/* ===== KHOÁ THIẾT BỊ (audit 23/08/2026 — user chốt: KHÔNG bắt gõ PIN, trừ ghi nhận 5S) =====
 * Vấn đề: repo public + URL /exec nhúng trang public ⇒ pr_them (in tem thật), sku_vision/sku_ocr
 * (đốt quota AI), pc_uidgr_edit (ghi đè tab), readTab (tên/email/giờ chấm công NV vệ sinh) đều
 * gọi được ẨN DANH từ Internet. Chữa mà không thêm bước gõ tay:
 *   · DEVICE_KEY đặt trong Script Properties (qua action setDeviceKey, cần SECRET — máy trạm làm).
 *   · CÁCH CHÍNH (24/08/2026): máy mới bấm "Xin mã OTP" → GAS tự nhắn Telegram cho quản trị kèm 4
 *     số → gõ 4 số là xong (xem khối "CẤP QUYỀN BẰNG MÃ OTP 4 SỐ" bên dưới). Không cần laptop.
 *   · Cách phụ (vẫn dùng được): link https://…/index.html#khoa=<DEVICE_KEY> — trang lưu vào
 *     localStorage rồi xoá hash; từ đó mọi request tự đính kèm `tb`, người dùng không gõ gì.
 *   · DEVICE_KEY đang TRỐNG ⇒ tbOK_ luôn cho qua (bật siết SAU khi 2 dashboard đã phát bản có khoá
 *     — thứ tự rollout an toàn, không làm trắng màn máy đang mở).
 *   · SECRET (máy trạm) luôn qua. */
function tbKhoaCauHinh_() { return PropertiesService.getScriptProperties().getProperty('DEVICE_KEY') || ''; }
/* ẢNH CHỤP Script Properties MỘT LẦN cho cả execution (29/08/2026). Đo thật cổng sku_vision: phí bên
   trong script 430–730 ms trong khi model chỉ 1,2–1,8 s — vì hơn 10 lượt RPC getProperty/setProperty/
   Lock/Cache, mỗi lượt 30–60 ms. Đường ĐỌC NHIỀU KHOÁ RỒI GHI MỘT LẦN (tbOK_ → skuVision_) nay đọc
   getProperties() đúng một lượt rồi dùng chung. KHÔNG dùng cho các luồng ghi-rồi-đọc-lại trong cùng
   execution (tb_otp/tb_xin… vẫn gọi tbKhoaCauHinh_/tbDsDoc_ trực tiếp) — ảnh chụp cũ sẽ nói dối.
   Mỗi execution của Apps Script là một VM mới nên biến toàn cục này không sống sang lượt gọi khác.
   Cố ý KHÔNG try/catch: RPC hỏng thì ném lỗi như trước, không được "fail-open" thành DEVICE_KEY rỗng. */
var _PROPS_MEMO = null;
function propsMemo_() {
  if (!_PROPS_MEMO) _PROPS_MEMO = PropertiesService.getScriptProperties().getProperties() || {};
  return _PROPS_MEMO;
}
function tbOK_(duLieu, e) {
  var all = propsMemo_();
  var k = String(all.DEVICE_KEY || '');
  if (!k) return true;   // chưa cấu hình → chưa siết
  var tb = String((duLieu && duLieu.tb) || (e && e.parameter && e.parameter.tb) || '');
  var duyet = {}; try { duyet = JSON.parse(all.TB_DUYET || '{}') || {}; } catch (eD) { duyet = {}; }
  if (tb && (tb === k || tbConHan_(duyet[tb]))) return true;   // khoá chung HOẶC máy đã duyệt qua bot (tb_xin/tb_duyet) — quyền có hạn (OTP Ghi nhận 5S) thì phải còn hạn
  /* 22/10 user «đã là quản trị, đã đăng nhập rồi còn 🔒 Máy này chưa được cấp quyền»: trang mới (xemtruoc.audit-dc) chưa có mã thiết bị.
     Phiên tài khoản audit-dc còn hạn (tk_dangnhap) = đã xác thực người ⇒ đủ thay mã thiết bị. Trang gửi tb = 'tk:<phiên>'. */
  if (tb.indexOf('tk:') === 0 && typeof tkPhien_ === 'function' && tkPhien_(tb.slice(3))) return true;
  return keyBodyOK_(duLieu || {});
}
function tbTuChoi_() {
  return phanHoiJson({ status: 'error', code: 403, canKhoa: 1,
    message: 'Máy này chưa được cấp quyền — bấm "Xin mã OTP", liên hệ quản trị nhận 4 số rồi gõ vào (làm MỘT LẦN cho máy này).' });
}

/* ===== CẤP QUYỀN BẰNG MÃ OTP 4 SỐ (24/08/2026 — thay đường "gửi link #khoa=") =================
 * VÌ SAO ĐỔI (user chốt 24/08): đường cũ dựa vào máy trạm laptop ở HAI chỗ — quản trị phải tự gửi
 * link `#khoa=` cho từng máy, và lệnh /duyet_<mã> phải do tin-nhan-bot.mjs (chạy trên laptop) nhặt
 * rồi gọi lại GAS. Giờ hành chính quản trị có thể nghỉ, laptop ĐÓNG ⇒ người trong kho đứng chờ vô
 * thời hạn. Luồng mới KHÔNG cần laptop ở bất kỳ khâu nào:
 *
 *   máy mới mở dashboard → màn khoá "liên hệ quản trị nhận mã OTP" → bấm Xin mã
 *     → GAS kiểm ĐANG Ở MẠNG CÔNG TY → sinh OTP 4 số (gắn ĐÚNG mã máy đó, hạn 60')
 *     → GAS TỰ bắn Telegram cho quản trị (UrlFetchApp chạy trên máy Google — laptop tắt vẫn gửi)
 *     → quản trị nhắn 4 số cho người kia → người kia gõ vào ô → máy được cấp quyền ngay.
 *
 * · "Mạng công ty" mà KHÔNG xin IT: GAS không thấy IP client, nên TRANG tự báo IP công cộng của nó
 *   (cloudflare trace). GAS so với 2 nguồn: WIFI_IP_ALLOW (đặt tay, nhận cả tiền tố "14.224.") và
 *   TB_IP_OK — sổ IP TỰ HỌC từ chính các máy ĐÃ ĐƯỢC DUYỆT (action tb_ip, 1 lượt/máy/ngày). IP nhà
 *   mạng VN đổi động nên sổ tự học là cách duy nhất sống lâu mà không phải sửa tay mỗi tuần.
 *   Chưa có mẫu nào để so ⇒ vẫn cho xin nhưng ĐÁNH DẤU trong tin Telegram (không dead-end rollout).
 * · IP do client tự khai NÊN GIẢ ĐƯỢC — nó là cửa chống spam, không phải cửa bảo mật. Cửa thật là:
 *   OTP chỉ quản trị biết, và quản trị đọc thấy tên + IP + có khớp mạng công ty hay không rồi mới
 *   quyết định nhắn 4 số đi hay không.
 * · Chống dò OTP: 4 số = 10.000 khả năng, nhưng mỗi mã chỉ 5 lần gõ sai là chết, mỗi máy 10' mới
 *   xin lại được (mỗi lượt xin đều bắn tin cho quản trị thấy), trần 30 lượt xin + 50 lần gõ sai
 *   mỗi ngày cho TOÀN hệ ⇒ tối đa ~50 phép thử/ngày trên 10.000.
 * · Đường cũ /duyet_<mã> · /tuchoi_<mã> GIỮ NGUYÊN làm đường phụ (laptop sống thì bấm nhanh hơn),
 *   và /tuchoi_<mã> vẫn là cách THU HỒI quyền của một máy đã cấp.
 * · GAS không thấy IP/header client ⇒ "thông tin người xin" = tên tự khai + UA client gửi + giờ.
 * · TUYỆT ĐỐI không ghi mã máy lên Sheet public (sheet anyone:reader — mã máy sau duyệt là chìa
 *   khoá, lộ là ai cũng chép vào localStorage được). Trạng thái chỉ nằm ở Script Properties.
 * · Chống spam: 1 máy 1 lượt/10' (cache), trần 30 lượt xin/ngày (Properties), sổ chờ tối đa 30. */
function tbDsDoc_(khoa) { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(khoa) || '{}') || {}; } catch (e) { return {}; } }
function tbDsGhi_(khoa, ds) { PropertiesService.getScriptProperties().setProperty(khoa, JSON.stringify(ds)); }
/* 22/10 user: OTP «+ Ghi nhận 5S» (muc=ghi5s) — mã phải gõ trong 5 phút, quyền ghi nhận chỉ kéo dài 43 phút, đúng máy đã xin mới dùng được.
   Bản ghi duyệt có `het` = quyền có hạn; không có `het` = duyệt lâu dài như trước (Planogram/Factory, /duyet_). */
var TB_GHI5S_OTP_MS = 5 * 60 * 1000, TB_GHI5S_QUYEN_MS = 43 * 60 * 1000;
function tbConHan_(v) { return !!v && (!v.het || Number(v.het) > new Date().getTime()); }
function tbDuyetCo_(tb) { return tbConHan_(tbDsDoc_('TB_DUYET')[tb]); }
function tbBaoTele_(text) {
  // Chưa cấu hình token thì im lặng bỏ qua — yêu cầu vẫn nằm ở sổ chờ, quản trị xem bằng /choduyet.
  try {
    var p = PropertiesService.getScriptProperties();
    /* Ưu tiên Script Properties (đổi được tại chỗ, không cần deploy); chưa đặt thì dùng hằng
       do deploy-gas.mjs chèn từ .env. Cả hai rỗng (bản git-safe) thì im lặng bỏ qua. */
    var tok = p.getProperty('TELEGRAM_BOT_TOKEN') || (TELE_TOKEN.indexOf('DAT_') === 0 ? '' : TELE_TOKEN);
    var chat = p.getProperty('TELEGRAM_CHAT_ID') || (TELE_CHAT.indexOf('DAT_') === 0 ? '' : TELE_CHAT);
    if (!tok || !chat) return false;
    UrlFetchApp.fetch('https://api.telegram.org/bot' + tok + '/sendMessage',
      { method: 'post', payload: { chat_id: chat, text: text }, muteHttpExceptions: true });
    return true;
  } catch (eT) { return false; }
}
function tbXinDemNgay_() {
  var p = PropertiesService.getScriptProperties();
  var ngay = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyyMMdd');
  var d = {}; try { d = JSON.parse(p.getProperty('TB_XIN_DEM') || '{}') || {}; } catch (eD) {}
  if (d.ngay !== ngay) d = { ngay: ngay, so: 0 };
  d.so = Number(d.so || 0) + 1;
  p.setProperty('TB_XIN_DEM', JSON.stringify(d));
  return d.so;
}
/* --- Mạng công ty: chuẩn hoá IP + đối chiếu + sổ IP tự học ------------------------------------ */
function tbIpChuan_(ip) {
  ip = String(ip || '').trim();
  return /^[0-9a-fA-F:.]{7,45}$/.test(ip) ? ip : '';
}
function tbIpCoMau_() {
  var tay = String(PropertiesService.getScriptProperties().getProperty('WIFI_IP_ALLOW') || '').trim();
  return !!tay || Object.keys(tbDsDoc_('TB_IP_OK')).length > 0;
}
function tbIpDuocPhep_(ip) {
  var coMau = tbIpCoMau_();
  if (!ip) return { ok: false, coMau: coMau, vi: 'trang không đọc được IP' };
  var tay = String(PropertiesService.getScriptProperties().getProperty('WIFI_IP_ALLOW') || '')
    .split(',').map(function (x) { return x.trim(); }).filter(function (x) { return !!x; });
  for (var i = 0; i < tay.length; i++) {
    var m = tay[i];
    if (m === ip) return { ok: true, coMau: coMau, vi: 'khớp WIFI_IP_ALLOW' };
    if (m.charAt(m.length - 1) === '.' && ip.indexOf(m) === 0) return { ok: true, coMau: coMau, vi: 'khớp tiền tố ' + m };
  }
  var so = tbDsDoc_('TB_IP_OK'), gh = so[ip];
  if (gh && (new Date().getTime() - new Date(gh.luc).getTime()) < 14 * 24 * 3600 * 1000)
    return { ok: true, coMau: coMau, vi: 'IP máy đã duyệt vừa dùng (' + String(gh.luc).slice(0, 10) + ')' };
  return { ok: false, coMau: coMau, vi: 'IP lạ' };
}
/* Máy ĐÃ ĐƯỢC DUYỆT báo IP về (1 lượt/máy/ngày, trang tự hãm bằng localStorage) → sổ mẫu mạng công
   ty tự cập nhật khi nhà mạng đổi IP. CHỈ nhận từ máy đã duyệt / khoá chung / SECRET: không thì kẻ
   lạ tự nhồi IP của mình vào sổ rồi hợp lệ hoá chính nó. */
function apiTbIp_(duLieu) {
  var tb = String(duLieu.tb || '').trim().toLowerCase(), ip = tbIpChuan_(duLieu.ip);
  var k = tbKhoaCauHinh_();
  if (!ip) return phanHoiJson({ status: 'error', message: 'Thiếu IP' });
  if (!(tb && (tb === k || tbDuyetCo_(tb))) && !keyBodyOK_(duLieu))
    return phanHoiJson({ status: 'error', code: 403, message: 'Máy chưa được cấp quyền' });
  var so = tbDsDoc_('TB_IP_OK');
  so[ip] = { luc: new Date().toISOString(), tb: tb.slice(0, 8) };
  var ks = Object.keys(so);
  while (ks.length > 20) { delete so[ks[0]]; ks.shift(); }   // rụng IP cũ nhất theo thứ tự chèn
  tbDsGhi_('TB_IP_OK', so);
  return phanHoiJson({ status: 'success', so: Object.keys(so).length });
}

/* --- OTP 4 số --------------------------------------------------------------------------------- */
var TB_OTP_HAN_MS = 60 * 60 * 1000;   // 60' — quản trị có thể đang họp/nghỉ, 15' là quá gấp
function tbOtpDonRac_(ds) {
  var nay = new Date().getTime(), doi = false;
  for (var k in ds) if (!ds[k] || Number(ds[k].het || 0) < nay) { delete ds[k]; doi = true; }
  return doi;
}
function tbOtpSinh_(tb, ten, muc) {
  var ds = tbDsDoc_('TB_OTP'); tbOtpDonRac_(ds);
  var otp = ('000' + Math.floor(Math.random() * 10000)).slice(-4);
  ds[tb] = { otp: otp, het: new Date().getTime() + (muc === 'ghi5s' ? TB_GHI5S_OTP_MS : TB_OTP_HAN_MS), sai: 0, ten: ten, muc: muc || '' };
  var ks = Object.keys(ds);
  while (ks.length > 30) { delete ds[ks[0]]; ks.shift(); }
  tbDsGhi_('TB_OTP', ds);
  return otp;
}
function tbSaiDemNgay_() {
  var p = PropertiesService.getScriptProperties();
  var ngay = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyyMMdd');
  var d = {}; try { d = JSON.parse(p.getProperty('TB_OTP_SAI_NGAY') || '{}') || {}; } catch (eD) {}
  if (d.ngay !== ngay) d = { ngay: ngay, so: 0 };
  d.so = Number(d.so || 0) + 1;
  p.setProperty('TB_OTP_SAI_NGAY', JSON.stringify(d));
  return d.so;
}
/* Gõ OTP: đúng thì cấp quyền NGAY cho ĐÚNG mã máy đã xin (không phải mã nào khác). */
function apiTbOtp_(duLieu) {
  var tb = String(duLieu.tb || '').trim().toLowerCase();
  var otp = String(duLieu.otp || '').replace(/[^0-9]/g, '');
  if (!/^m[a-z0-9]{7,19}$/.test(tb)) return phanHoiJson({ status: 'error', message: 'Mã máy không hợp lệ — tải lại trang rồi thử lại.' });
  if (!tbKhoaCauHinh_() || tbDuyetCo_(tb)) return phanHoiJson({ status: 'success', duyet: 1 });
  if (otp.length !== 4) return phanHoiJson({ status: 'error', message: 'Mã OTP gồm 4 số.' });
  var ds = tbDsDoc_('TB_OTP'); if (tbOtpDonRac_(ds)) tbDsGhi_('TB_OTP', ds);
  var g = ds[tb], laGhi = duLieu.muc === 'ghi5s';
  if (!g) return phanHoiJson({ status: 'error', hetHan: 1, message: laGhi ? 'Sai OTP — mã chỉ dùng cho đúng máy đã xin và trong 5 phút. Bấm «Xin mã OTP» lại.' : 'Chưa có mã cho máy này (hoặc mã đã hết hạn) — bấm "Xin mã OTP" lại.' });
  if (String(g.otp) !== otp) {
    g.sai = Number(g.sai || 0) + 1;
    var saiNgay = tbSaiDemNgay_();
    var chet = g.sai >= 5 || saiNgay > 50;
    if (chet) {
      delete ds[tb];
      tbBaoTele_('\u26d4 M\u00c3 OTP B\u1eca G\u00d5 SAI QU\u00c1 NHI\u1ec0U \u2014 \u0111\u00e3 hu\u1ef7 m\u00e3 c\u1ee7a m\u00e1y ' + tb.slice(0, 10) +
        '\u2026\n\u00b7 Sai ' + g.sai + ' l\u1ea7n \u00b7 t\u1ed5ng sai h\u00f4m nay: ' + saiNgay +
        '\nNg\u01b0\u1eddi th\u1eadt th\u00ec b\u1ea3o h\u1ecd b\u1ea5m "Xin m\u00e3 OTP" l\u1ea1i.');
    }
    tbDsGhi_('TB_OTP', ds);
    return phanHoiJson({ status: 'error', sai: 1, huy: chet ? 1 : 0,
      message: chet ? 'Sai quá nhiều lần — mã đã bị huỷ. Bấm "Xin mã OTP" để nhận mã mới.'
                    : (laGhi ? 'Sai OTP' : 'Mã không đúng') + ' (còn ' + (5 - g.sai) + ' lần thử).' });
  }
  delete ds[tb]; tbDsGhi_('TB_OTP', ds);
  var duyet = tbDsDoc_('TB_DUYET'), tc = tbDsDoc_('TB_TUCHOI'), cho = tbDsDoc_('TB_CHO');
  for (var kd in duyet) if (duyet[kd] && duyet[kd].het && !tbConHan_(duyet[kd])) delete duyet[kd];   // dọn quyền có hạn đã hết
  var hetQuyen = g.muc === 'ghi5s' ? new Date().getTime() + TB_GHI5S_QUYEN_MS : 0;
  duyet[tb] = { ten: (g.ten || (cho[tb] && cho[tb].ten) || ''), luc: new Date().toISOString(), qua: hetQuyen ? 'otp-ghi5s' : 'otp' };
  if (hetQuyen) duyet[tb].het = hetQuyen;
  if (tc[tb]) delete tc[tb];
  if (cho[tb]) { delete cho[tb]; tbDsGhi_('TB_CHO', cho); }
  tbDsGhi_('TB_DUYET', duyet); tbDsGhi_('TB_TUCHOI', tc);
  tbBaoTele_('\u2705 \u0110\u00c3 K\u00cdCH HO\u1ea0T b\u1eb1ng OTP: ' + (g.ten || '(kh\u00f4ng t\u00ean)') +
    '\n\u00b7 M\u00e1y: ' + tb.slice(0, 10) + '\u2026\n\u00b7 L\u00fac: ' +
    Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'HH:mm dd/MM') +
    '\n\nThu h\u1ed3i m\u00e1y n\u00e0y: /tuchoi_' + tb + (hetQuyen ? '\n(Quy\u1ec1n Ghi nh\u1eadn 5S \u2014 t\u1ef1 h\u1ebft sau 43 ph\u00fat)' : ''));
  return phanHoiJson({ status: 'success', duyet: 1, het: hetQuyen || undefined });
}
function apiTbXin_(duLieu) {
  var tb = String(duLieu.tb || '').trim().toLowerCase();
  if (!/^m[a-z0-9]{7,19}$/.test(tb)) return phanHoiJson({ status: 'error', message: 'Mã máy không hợp lệ — tải lại trang rồi thử lại.' });
  if (!tbKhoaCauHinh_() || tbDuyetCo_(tb)) return phanHoiJson({ status: 'success', duyet: 1 });   // chưa siết / đã duyệt → khỏi xin
  var ten = String(duLieu.ten || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  if (ten.length < 2) return phanHoiJson({ status: 'error', message: 'Cho quản trị biết bạn là ai (tên · bộ phận) thì mới cấp mã được.' });
  /* CỬA MẠNG CÔNG TY (24/08/2026, user chốt): chỉ máy đang dùng Wi-Fi công ty mới XIN được mã.
     Chưa có mẫu IP nào để đối chiếu (rollout ngày đầu) thì vẫn cho xin, nhưng tin Telegram phải
     nói rõ là "chưa đối chiếu được" để quản trị không nhắn mã cho người ngoài. */
  var ip = tbIpChuan_(duLieu.ip), mang = tbIpDuocPhep_(ip);
  if (!mang.ok && mang.coMau) {
    return phanHoiJson({ status: 'error', code: 403, ngoaiMang: 1,
      message: 'Chỉ xin được mã khi máy đang dùng Wi-Fi của công ty. Nối vào Wi-Fi công ty (đừng dùng 4G) rồi bấm lại.' });
  }
  var c = CacheService.getScriptCache(), muc = duLieu.muc === 'ghi5s' ? 'ghi5s' : '';
  if (c.get('tbxin_' + tb)) return phanHoiJson({ status: 'success', choOtp: 1, lai: 1,
    message: 'Vừa gửi yêu cầu cho quản trị rồi — chờ nhận 4 số rồi gõ vào ô bên dưới. (' + (muc ? 5 : 10) + ' phút nữa mới xin lại được.)' });
  if (tbXinDemNgay_() > 30) return phanHoiJson({ status: 'error', message: 'Hôm nay nhận quá nhiều lượt xin cấp quyền — thử lại ngày mai hoặc liên hệ quản trị trực tiếp.' });
  c.put('tbxin_' + tb, '1', muc ? 300 : 600);
  var trang = String(duLieu.trang || '').slice(0, 24), ua = String(duLieu.ua || '').replace(/\s+/g, ' ').slice(0, 160);
  /* Vẫn ghi sổ chờ: để đường phụ /choduyet + /duyet_<mã> (khi laptop sống) dùng được như cũ. */
  var cho = tbDsDoc_('TB_CHO');
  cho[tb] = { ten: ten, trang: trang, ua: ua, ip: ip, luc: new Date().toISOString() };
  var ks = Object.keys(cho);
  while (ks.length > 30) { delete cho[ks[0]]; ks.shift(); }   // sổ chờ đầy → rụng lượt cũ nhất (thứ tự chèn của JSON)
  tbDsGhi_('TB_CHO', cho);
  var otp = tbOtpSinh_(tb, ten, muc);
  var nhanMang = mang.ok ? ('\u2713 m\u1ea1ng c\u00f4ng ty (' + mang.vi + ')')
                         : '\u26a0 CH\u01afA \u0110\u1ed0I CHI\u1ebeU \u0110\u01af\u1ee2C M\u1ea0NG (ch\u01b0a c\u00f3 IP m\u1eabu) \u2014 h\u1ecfi l\u1ea1i xem ng\u01b0\u1eddi n\u00e0y c\u00f3 \u1edf kho kh\u00f4ng';
  var gui = tbBaoTele_((muc ? '\ud83d\udd11 M\u00c3 OTP GHI NH\u1eacN 5S' : '\ud83d\udd11 M\u00c3 OTP C\u1ea4P QUY\u1ec0N DASHBOARD') + '\n\n\u27a4 M\u00e3: ' + otp +
    (muc ? '   (g\u00f5 trong 5 ph\u00fat, ch\u1ec9 d\u00f9ng cho \u0111\u00fang m\u00e1y n\u00e0y \u2014 quy\u1ec1n ghi nh\u1eadn 43 ph\u00fat)' : '   (h\u1ea1n 60 ph\u00fat, ch\u1ec9 d\u00f9ng cho \u0111\u00fang m\u00e1y n\u00e0y)') + '\n\n\u00b7 Ng\u01b0\u1eddi xin: ' + ten +
    '\n\u00b7 Trang: ' + (trang || '?') + '\n\u00b7 IP: ' + (ip || '?') + '  \u2014 ' + nhanMang +
    '\n\u00b7 M\u00e1y: ' + (ua || '?') +
    '\n\u00b7 L\u00fac: ' + Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'HH:mm dd/MM') +
    '\n\nN\u1ebfu \u0110\u00daNG ng\u01b0\u1eddi: nh\u1eafn 4 s\u1ed1 tr\u00ean cho h\u1ecd.\nN\u1ebfu KH\u00d4NG: b\u1ecf qua tin n\u00e0y (m\u00e3 t\u1ef1 h\u1ebft h\u1ea1n).\nDuy\u1ec7t nhanh kh\u00f4ng c\u1ea7n m\u00e3: /duyet_' + tb +
    '\nCh\u1eb7n m\u00e1y n\u00e0y: /tuchoi_' + tb);
  return phanHoiJson({ status: 'success', choOtp: 1, guiTele: gui ? 1 : 0, han: muc ? 5 : 60,
    message: gui ? 'Đã gửi yêu cầu cho quản trị. Liên hệ quản trị để nhận 4 số, rồi gõ vào ô bên dưới.'
                 : 'Đã ghi nhận yêu cầu, nhưng kênh Telegram chưa cấu hình — liên hệ trực tiếp quản trị để nhận mã.' });
}
function apiTbTra_(duLieu) {
  var tb = String(duLieu.tb || '').trim().toLowerCase();
  if (!tbKhoaCauHinh_() || (tb && tbDuyetCo_(tb))) return phanHoiJson({ status: 'success', duyet: 1 });
  if (tb && tbDsDoc_('TB_TUCHOI')[tb]) return phanHoiJson({ status: 'success', tuChoi: 1 });
  return phanHoiJson({ status: 'success', choDuyet: tbDsDoc_('TB_CHO')[tb] ? 1 : 0 });
}
function apiTbDuyet_(duLieu) {
  var tb = String(duLieu.tb || '').trim().toLowerCase(), ok = String(duLieu.ok || '') === '1';
  if (!/^m[a-z0-9]{7,19}$/.test(tb)) return phanHoiJson({ status: 'error', message: 'Mã máy không hợp lệ: ' + tb });
  var cho = tbDsDoc_('TB_CHO'), tt = cho[tb] || null;
  if (cho[tb]) { delete cho[tb]; tbDsGhi_('TB_CHO', cho); }
  var duyet = tbDsDoc_('TB_DUYET'), tc = tbDsDoc_('TB_TUCHOI');
  if (ok) {
    duyet[tb] = { ten: (tt && tt.ten) || (duyet[tb] && duyet[tb].ten) || '', luc: new Date().toISOString() };
    if (tc[tb]) delete tc[tb];
  } else {
    if (duyet[tb]) delete duyet[tb];   // từ chối máy ĐÃ duyệt = THU HỒI quyền máy đó
    tc[tb] = { luc: new Date().toISOString() };
    var kt = Object.keys(tc);
    while (kt.length > 50) { delete tc[kt[0]]; kt.shift(); }
  }
  tbDsGhi_('TB_DUYET', duyet); tbDsGhi_('TB_TUCHOI', tc);
  return phanHoiJson({ status: 'success', tb: tb, ok: ok ? 1 : 0, ten: (tt && tt.ten) || '', daDuyet: Object.keys(duyet).length });
}

// Chống brute-force PIN: đếm số lần sai theo "định danh" (mã NV / obj), khoá 15' sau 5 lần.
function pinBiKhoa_(dinhDanh) {
  var c = CacheService.getScriptCache();
  var n = Number(c.get('pinfail_' + dinhDanh) || 0);
  return n >= 5;
}
function ghiNhanSaiPin_(dinhDanh) {
  var c = CacheService.getScriptCache();
  var n = Number(c.get('pinfail_' + dinhDanh) || 0) + 1;
  c.put('pinfail_' + dinhDanh, String(n), 15 * 60);   // TTL 15 phút
  return n;
}
function xoaSaiPin_(dinhDanh) { CacheService.getScriptCache().remove('pinfail_' + dinhDanh); }
