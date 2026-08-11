/**
 * ============================================================================
 *  google-script-TuChua.gs — SỔ SỰ CỐ + THƯ CẢNH BÁO (12/08/2026)
 *
 *  VÌ SAO THƯ PHẢI GỬI TỪ ĐÂY, KHÔNG PHẢI TỪ MÁY TRẠM:
 *  kịch bản tệ nhất là máy trạm TẮT — lúc đó chính nó không thể gửi thư báo là nó đã tắt.
 *  Apps Script chạy trên máy chủ Google nên vẫn sống; máy trạm chỉ đẩy NHỊP TIM lên,
 *  tcCanhNhipTim() (trigger mỗi giờ) thấy im quá 3 tiếng trong giờ làm là tự gửi thư.
 *
 *  NGƯỜI ĐỌC THƯ KHÔNG RÀNH KỸ THUẬT. Ba luật viết:
 *   1) Không một từ chuyên môn (token/endpoint/401/schema) — mã sự cố để ở chân thư.
 *   2) Luôn nói cái KHÔNG hỏng, ngay cạnh cái hỏng (thấy thư đỏ dễ tưởng sập hết).
 *   3) Mỗi việc kèm thời gian ước tính, để người nhận quyết định làm ngay hay để chiều.
 *
 *  CHỐNG SPAM: 1 thư/sự cố, nhắc lại theo mốc ngày (TC_LOAI[].mocNhac), luôn có thư ĐÓNG.
 *  Thiếu thư đóng thì người nhận phải tự vào kiểm tra, rồi sẽ bỏ qua cả thư đỏ.
 *
 *  File này KHÔNG chứa bí mật — SECRET/ALERT_EMAIL lấy từ file chính lúc chạy.
 *  Đẩy lên bằng clasp cùng sa.js (rootDir .clasp-deploy).
 * ============================================================================
 */

/* Ngưỡng im lặng của nhịp tim trước khi kết luận "máy trạm đã tắt". 3 tiếng: đủ để bỏ qua
 * một lượt reboot / mất mạng thoáng qua, chưa đủ để mất trọn buổi làm. */
var TC_NHIP_IM_GIO = 3;

/* ─────────────────── SỔ LOẠI SỰ CỐ ───────────────────
 * Mỗi loại tự khai: màu, tiêu đề, đoạn "vì sao", các bước cần làm, nút bấm.
 * Thêm kịch bản mới = thêm 1 mục ở đây, không phải sửa chỗ nào khác. */
function tcSoLoai_() {
  return {
    MAY_TRAM_IM: {
      muc: 'do', mocNhac: [1, 3, 7],
      tieuDe: function (sc) { return '🔴 Máy trạm đã ngừng gửi dữ liệu — mọi bảng đang đóng băng'; },
      truoc: 'Ngừng nhận tín hiệu từ máy trạm. Không bảng nào còn được cập nhật.',
      soLieu: function (sc) { return [['Im lặng đã', tcDoiGio_(sc.soLieu.treGio), 'do'], ['Vẫn xem được', 'Toàn bộ số liệu cũ', 'xam']]; },
      viSao: function (sc) {
        return 'Máy trạm đã không gửi tín hiệu nào trong <b>' + tcDoiGio_(sc.soLieu.treGio) + '</b>. '
          + 'Thường là máy đã tắt, ngủ đông, mất mạng, hoặc bị khởi động lại giữa chừng.'
          + '<br><br>Dashboard vẫn mở và vẫn xem được — nhưng mọi con số trên đó là của lần cập nhật cuối, không phải hôm nay.';
      },
      buoc: [
        { t: 'Kiểm tra máy trạm đã bật chưa', m: 'Nếu máy tắt: bật lên là xong, hệ thống tự chạy bù trong khoảng 15 phút.' },
        { t: 'Nếu máy đang bật, kiểm tra mạng', m: 'Mở thử một trang web bất kỳ trên máy đó.' },
        { t: 'Đừng dùng Remote Desktop để vào máy', m: 'Thoát Remote Desktop sẽ làm hỏng phiên làm việc và cụm đồng bộ trượt trong im lặng. Dùng AnyDesk hoặc tới tận máy.' }
      ],
      nut: null
    },

    DANG_NHAP_TAY: {
      muc: 'do', mocNhac: [1, 3, 7],
      tieuDe: function (sc) { return '🔴 Cần bạn đăng nhập tay — hệ thống đã tự dừng để không khoá tài khoản'; },
      truoc: 'Hệ thống cố tình không thử tiếp · Mất khoảng 3 phút để xử lý',
      soLieu: function (sc) { return [['Số lượt bị từ chối', String(sc.soLieu.soLuot || '?'), 'do'], ['Dừng đã', tcDoiGio_(sc.soLieu.treGio), 'do']]; },
      viSao: function (sc) {
        return 'Cổng đăng nhập của công ty từ chối các lượt đăng nhập tự động. Có thể vì mật khẩu đã đổi, '
          + 'hoặc cổng đã đổi cách xác minh mà máy không tự làm được.'
          + '<br><br>Hệ thống đã <b>tự dừng lại</b> — nó cố tình không thử tiếp, vì nhập sai thêm sẽ khoá tài khoản, '
          + 'và khi đó chính bạn cũng không đăng nhập được.'
          + (sc.chiTiet ? '<br><br>Cổng đăng nhập báo: <i>' + tcEsc_(sc.chiTiet) + '</i>' : '');
      },
      buoc: [
        { t: 'Bấm nút đỏ bên dưới', m: 'Máy trạm sẽ tự mở sẵn cửa sổ đăng nhập trong vòng 2 phút. Bấm được từ điện thoại.' },
        { t: 'Tới máy trạm, đăng nhập như bình thường', m: 'Email và mật khẩu đã điền sẵn. Nếu mật khẩu công ty vừa đổi, hãy nhập mật khẩu mới.' },
        { t: 'Xong — đóng cửa sổ, không cần làm gì thêm', m: 'Hệ thống nhận ra phiên đang sống và tự lấy dữ liệu bù.' }
      ],
      nut: { chu: 'Mở cửa sổ đăng nhập trên máy trạm', loai: 'login' }
    },

    BUOC_DUNG: {
      muc: 'do', mocNhac: [1, 3, 7],
      tieuDe: function (sc) { return '🔴 ' + sc.nguon + ' đã ngừng cập nhật'; },
      truoc: 'Các bảng khác vẫn chạy bình thường',
      soLieu: function (sc) { return [['Dữ liệu đang cũ', tcDoiGio_(sc.soLieu.treGio), 'do'], ['Các bảng khác', 'Vẫn cập nhật bình thường', 'xam']]; },
      viSao: function (sc) {
        return 'Bảng <b>' + tcEsc_(sc.nguon) + '</b> đã không ghi được dữ liệu mới nào trong <b>' + tcDoiGio_(sc.soLieu.treGio) + '</b>. '
          + 'Hệ thống đã tự thử lại nhiều lượt nhưng vẫn không được, nên đây là ca cần người xem.'
          + (sc.chiTiet ? '<br><br>' + tcEsc_(sc.chiTiet) : '');
      },
      buoc: [
        { t: 'Thử bấm nút "Tải lại dữ liệu" trên dashboard', m: 'Nếu sau 15 phút số liệu mới về thì xong, không cần làm gì thêm.' },
        { t: 'Nếu vẫn không được: mở WMS xem báo cáo tương ứng', m: 'WMS cũng lỗi thì chờ WMS sửa — hệ thống tự chạy tiếp khi WMS đầy lại.' },
        { t: 'Nếu WMS bình thường mà bảng vẫn trống', m: 'Đây là thay đổi kỹ thuật cần người sửa. Chuyển tiếp thư này — mã sự cố ở cuối thư là đủ để bắt đầu.' }
      ],
      nut: null
    },

    DU_LIEU_LECH: {
      muc: 'cam', mocNhac: [1, 3, 7],
      tieuDe: function (sc) { return '🟠 Đã tạm dừng ghi ' + sc.nguon + ' — dashboard đang hiện số cũ'; },
      truoc: 'Dữ liệu cũ được giữ nguyên, không bị ghi đè · Cần kiểm tra khoảng 3 phút',
      soLieu: function (sc) { return [['Đọc được', String(sc.soLieu.docDuoc), 'cam'], ['Mọi ngày vẫn là', '~' + String(sc.soLieu.kyVong), 'xam']]; },
      viSao: function (sc) {
        return 'WMS trả về dữ liệu khác hẳn mọi ngày, nên hệ thống chỉ đọc được <b>' + String(sc.soLieu.docDuoc) + ' dòng</b>. '
          + 'Vì con số này bất thường, hệ đã <b>chủ động không ghi đè</b> lên dữ liệu cũ — thà giữ số hôm qua còn hơn thay bằng số sai.'
          + '<br><br>Dashboard vẫn xem được và vẫn đang hiện số đúng của lần cập nhật trước. Không có dữ liệu nào bị hỏng.'
          + (sc.chiTiet ? '<br><br><span style="color:#94A3B8">Chi tiết: ' + tcEsc_(sc.chiTiet) + '</span>' : '');
      },
      buoc: [
        { t: 'Mở WMS, vào đúng báo cáo đó', m: 'Xem báo cáo có hiện đủ dữ liệu như mọi khi không.' },
        { t: 'Nếu WMS cũng thiếu dữ liệu', m: 'Vấn đề nằm ở WMS. Chờ WMS đầy lại — hệ thống tự ghi tiếp và tự báo cho bạn, không cần làm gì.' },
        { t: 'Nếu WMS hiện đủ bình thường', m: 'Đây là thay đổi kỹ thuật cần người sửa. Chuyển tiếp thư này cho người phụ trách.' }
      ],
      nut: null
    },

    MAT_QUYEN: {
      muc: 'cam', mocNhac: [1, 3, 7],
      tieuDe: function (sc) { return '🟠 Không còn lấy được ' + sc.nguon; },
      truoc: 'Các nguồn khác vẫn bình thường',
      soLieu: function (sc) { return [['Bị từ chối đã', tcDoiGio_(sc.soLieu.treGio), 'cam'], ['Các nguồn khác', 'Vẫn lấy được', 'xam']]; },
      viSao: function (sc) {
        return 'Hệ thống bị từ chối quyền xem <b>' + tcEsc_(sc.nguon) + '</b>. Tài khoản vẫn đăng nhập được bình thường — '
          + 'chỉ riêng phần dữ liệu này không còn được phép đọc.';
      },
      buoc: [
        { t: 'Mở phần đó trên hệ thống gốc bằng tài khoản của bạn', m: 'Nếu bạn cũng không xem được thì quyền đã bị thu hồi thật.' },
        { t: 'Nếu bạn xem được bình thường', m: 'Chuyển tiếp thư này — cần người trỏ hệ thống sang đường lấy dữ liệu khác.' }
      ],
      nut: null
    },

    CHO_CAP_PHEP: {
      muc: 'xanh', mocNhac: [7, 14, 28],
      tieuDe: function (sc) { return '🔵 ' + sc.nguon + ' đang chờ bạn cấp phép'; },
      truoc: 'Không gấp · Các bảng cũ vẫn cập nhật bình thường',
      soLieu: function (sc) { return [['Chờ đã', tcDoiGio_(sc.soLieu.treGio), 'xanh'], ['Ảnh hưởng', 'Chỉ bảng mới này', 'xam']]; },
      viSao: function (sc) {
        return 'Có bảng dữ liệu mới nhưng chưa được phép ghi vào Google Sheet. <b>Không có gì hỏng</b> — '
          + 'các bảng cũ vẫn cập nhật bình thường, chỉ bảng mới này là chưa có số.'
          + (sc.chiTiet ? '<br><br>' + tcEsc_(sc.chiTiet) : '');
      },
      buoc: [{ t: 'Chuyển tiếp thư này cho người phụ trách kỹ thuật', m: 'Cần cập nhật lại phần ghi dữ liệu một lượt. Mất vài phút.' }],
      nut: null
    }
  };
}

/* ─────────────────── ĐƯỜNG VÀO TỪ MÁY TRẠM ─────────────────── */

/** POST { action:'suCo', viec:'mo'|'dong', ma, loai, nguon, soLieu, chiTiet } */
function tcApiSuCo(duLieu) {
  try {
    var ma = String(duLieu.ma || '').replace(/[^A-Za-z0-9_.-]/g, '');
    if (!ma) return phanHoiJson({ status: 'error', message: 'Thiếu mã sự cố' });
    if (String(duLieu.viec) === 'dong') return phanHoiJson(tcDongSuCo_(ma));
    return phanHoiJson(tcMoSuCo_({
      ma: ma,
      loai: String(duLieu.loai || 'BUOC_DUNG'),
      nguon: String(duLieu.nguon || 'Dữ liệu'),
      soLieu: duLieu.soLieu || {},
      chiTiet: String(duLieu.chiTiet || '')
    }));
  } catch (err) { return phanHoiJson({ status: 'error', message: String(err) }); }
}

/** POST { action:'heartbeat', buoc } — máy trạm báo "tôi còn sống". */
function tcApiNhipTim(duLieu) {
  try {
    PropertiesService.getScriptProperties().setProperty('TC_HEARTBEAT', String(Date.now()));
    tcDongSuCo_('MAYTRAM');   // máy nói được là máy còn sống → đóng sự cố máy tắt nếu đang mở
    return phanHoiJson({ status: 'success' });
  } catch (err) { return phanHoiJson({ status: 'error', message: String(err) }); }
}

/* ─────────────────── SỔ SỰ CỐ ─────────────────── */

function tcMoSuCo_(sc) {
  var props = PropertiesService.getScriptProperties();
  var khoa = 'TC_SC_' + sc.ma;
  var ho = null;
  try { ho = JSON.parse(props.getProperty(khoa) || 'null'); } catch (e) { ho = null; }
  var nay = Date.now();
  var loai = tcSoLoai_()[sc.loai] || tcSoLoai_().BUOC_DUNG;

  if (!ho) {
    ho = { moLuc: nay, mocDaGui: 0 };
    tcGui_(sc, loai, ho);
    props.setProperty(khoa, JSON.stringify(ho));
    return { status: 'success', daGui: true, lanDau: true };
  }

  // Đã mở rồi: chỉ gửi lại khi tuổi sự cố vượt mốc nhắc kế tiếp (1→3→7 ngày).
  var tuoiNgay = (nay - ho.moLuc) / 86400000;
  var moc = loai.mocNhac || [1, 3, 7];
  var can = 0;
  for (var i = 0; i < moc.length; i++) { if (tuoiNgay >= moc[i]) can = i + 1; }
  if (can > (ho.mocDaGui || 0)) {
    ho.mocDaGui = can;
    tcGui_(sc, loai, ho);
    props.setProperty(khoa, JSON.stringify(ho));
    return { status: 'success', daGui: true, nhac: can };
  }
  return { status: 'success', daGui: false, boQua: 'chưa tới mốc nhắc' };
}

function tcDongSuCo_(ma) {
  var props = PropertiesService.getScriptProperties();
  var khoa = 'TC_SC_' + ma;
  var raw = props.getProperty(khoa);
  if (!raw) return { status: 'success', daGui: false };   // chưa từng mở → im, gọi thoải mái
  var ho = null; try { ho = JSON.parse(raw); } catch (e) { ho = { moLuc: Date.now() }; }
  props.deleteProperty(khoa);
  try {
    var gio = Math.round((Date.now() - ho.moLuc) / 3600000);
    MailApp.sendEmail({
      to: tcEmail_(), name: 'Audit Factory',
      subject: '🟢 ' + (ho.nguon || 'Dữ liệu') + ' đã chảy lại bình thường',
      body: (ho.nguon || 'Dữ liệu') + ' đã chảy lại bình thường sau ' + tcDoiGio_(gio) + ' gián đoạn. Không cần làm gì thêm.',
      htmlBody: tcThuDong_(ho, ma, gio)
    });
  } catch (e) { /* gửi thư đóng hỏng thì thôi — sự cố đã xoá, không để lại rác */ }
  return { status: 'success', daGui: true, dong: true };
}

function tcGui_(sc, loai, ho) {
  ho.nguon = sc.nguon;
  MailApp.sendEmail({
    to: tcEmail_(), name: 'Audit Factory',
    subject: loai.tieuDe(sc) + (ho.mocDaGui ? ' (nhắc lần ' + ho.mocDaGui + ')' : ''),
    body: tcBanChu_(sc, loai),
    htmlBody: tcDungThu_(sc, loai, ho)
  });
}

/* ─────────────────── ĐỒNG HỒ CHẾT (trigger mỗi giờ) ───────────────────
 * Chạy trên Google nên vẫn gửi được thư kể cả khi máy trạm đã tắt. */
function tcCanhNhipTim() {
  var props = PropertiesService.getScriptProperties();
  var nhip = Number(props.getProperty('TC_HEARTBEAT') || 0);
  var gio = nhip ? (Date.now() - nhip) / 3600000 : 999;
  var h = Number(Utilities.formatDate(new Date(), 'GMT+7', 'H'));
  if (gio > TC_NHIP_IM_GIO && h >= 7 && h < 19) {
    tcMoSuCo_({ ma: 'MAYTRAM', loai: 'MAY_TRAM_IM', nguon: 'Máy trạm', soLieu: { treGio: Math.round(gio) }, chiTiet: '' });
  }
}

/* ─────────────────── KHUÔN THƯ ───────────────────
 * Bảng + CSS nội tuyến, không ảnh ngoài, không webfont: Gmail app trên điện thoại lược bỏ
 * thẻ <style> nên mọi định dạng phải nằm ngay trên từng thẻ. */
function tcMau_(muc) {
  var b = {
    do:   { vach: '#B42318', nen: '#FEF3F2', vien: '#FECDCA', chu: '#B42318' },
    cam:  { vach: '#B54708', nen: '#FFFAEB', vien: '#FEDF89', chu: '#B54708' },
    xanh: { vach: '#175CD3', nen: '#EFF8FF', vien: '#B2DDFF', chu: '#175CD3' },
    luc:  { vach: '#067647', nen: '#ECFDF3', vien: '#ABEFC6', chu: '#067647' }
  };
  return b[muc] || b.do;
}

var TC_SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
var TC_MONO = "ui-monospace,Menlo,Consolas,monospace";

function tcEsc_(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function tcEmail_() { return (typeof ALERT_EMAIL !== 'undefined' && ALERT_EMAIL) ? ALERT_EMAIL : Session.getEffectiveUser().getEmail(); }
function tcMaSuCo_(ma) { return 'SC-' + Utilities.formatDate(new Date(), 'GMT+7', 'yyMMdd') + '-' + ma; }
function tcGioVN_() { return Utilities.formatDate(new Date(), 'GMT+7', 'dd/MM/yyyy HH:mm'); }
function tcDoiGio_(g) {
  g = Number(g || 0);
  if (g >= 999) return 'chưa rõ';
  if (g < 24) return Math.round(g) + ' giờ';
  var n = Math.floor(g / 24), l = Math.round(g % 24);
  return n + ' ngày' + (l ? ' ' + l + ' giờ' : '');
}

function tcNutUrl_(loaiNut) {
  try {
    var base = ScriptApp.getService().getUrl();
    if (loaiNut === 'login') return base + '?action=requestLogin&key=' + encodeURIComponent(SECRET);
    return base;
  } catch (e) { return ''; }
}

function tcDungThu_(sc, loai, ho) {
  var m = tcMau_(loai.muc);
  var maHT = tcMaSuCo_(sc.ma);
  var h = [];
  h.push('<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;margin:0 auto;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:14px;overflow:hidden;font-family:' + TC_SANS + '">');
  h.push('<tr><td style="height:5px;background:' + m.vach + ';font-size:0;line-height:0">&nbsp;</td></tr>');

  // Đầu thư: tên hệ + mã sự cố
  h.push('<tr><td style="padding:26px 30px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
    + '<td style="font-size:11px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;color:#94A3B8">Audit Factory · Giám sát dữ liệu</td>'
    + '<td align="right" style="font-family:' + TC_MONO + ';font-size:11px;color:#94A3B8">' + maHT + '</td>'
    + '</tr></table></td></tr>');

  // Tiêu đề (bỏ emoji ở thân thư — emoji chỉ để phân biệt nhanh trong hộp thư)
  var tieuDe = loai.tieuDe(sc).replace(/^[^\wÀ-ỹ]+/, '');
  h.push('<tr><td style="padding:18px 30px 0"><p style="margin:0;font-size:23px;line-height:1.32;font-weight:700;color:#0F172A;letter-spacing:-.3px">' + tcEsc_(tieuDe) + '</p></td></tr>');

  // Bảng số liệu
  var ds = loai.soLieu(sc) || [];
  if (ds.length) {
    h.push('<tr><td style="padding:20px 30px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:' + m.nen + ';border:1px solid ' + m.vien + ';border-radius:10px"><tr>');
    for (var i = 0; i < ds.length; i++) {
      var mauNhan = ds[i][2] === 'xam' ? '#667085' : m.chu;
      var vienPhai = i < ds.length - 1 ? 'border-right:1px solid ' + m.vien + ';' : '';
      h.push('<td width="' + Math.floor(100 / ds.length) + '%" style="padding:16px 18px;' + vienPhai + '">'
        + '<p style="margin:0 0 3px;font-size:10.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:' + mauNhan + '">' + tcEsc_(ds[i][0]) + '</p>'
        + '<p style="margin:0;font-size:17px;color:#0F172A;font-weight:700">' + tcEsc_(ds[i][1]) + '</p></td>');
    }
    h.push('</tr></table></td></tr>');
  }

  // Vì sao
  h.push('<tr><td style="padding:26px 30px 0">'
    + '<p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:1.1px;text-transform:uppercase;color:#94A3B8">Vì sao</p>'
    + '<p style="margin:0;font-size:15px;line-height:1.68;color:#475569">' + loai.viSao(sc) + '</p></td></tr>');

  // Việc cần làm
  if (loai.buoc && loai.buoc.length) {
    h.push('<tr><td style="padding:28px 30px 0">'
      + '<p style="margin:0 0 14px;font-size:11px;font-weight:700;letter-spacing:1.1px;text-transform:uppercase;color:#94A3B8">Việc cần bạn làm</p>'
      + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">');
    for (var k = 0; k < loai.buoc.length; k++) {
      var cuoi = k === loai.buoc.length - 1;
      h.push('<tr><td width="30" valign="top" style="padding:0 0 ' + (cuoi ? '4' : '16') + 'px">'
        + '<div style="width:22px;height:22px;border-radius:11px;background:#0F172A;color:#FFFFFF;font-size:12px;font-weight:700;text-align:center;line-height:22px">' + (k + 1) + '</div></td>'
        + '<td valign="top" style="padding:0 0 ' + (cuoi ? '4' : '16') + 'px">'
        + '<p style="margin:0 0 2px;font-size:15px;font-weight:600;color:#0F172A;line-height:1.5">' + tcEsc_(loai.buoc[k].t) + '</p>'
        + '<p style="margin:0;font-size:14px;line-height:1.6;color:#475569">' + tcEsc_(loai.buoc[k].m) + '</p></td></tr>');
    }
    h.push('</table></td></tr>');
  }

  // Nút bấm
  if (loai.nut) {
    var url = tcNutUrl_(loai.nut.loai);
    if (url) {
      h.push('<tr><td style="padding:24px 30px 0"><a href="' + url + '" style="display:block;background:' + m.vach + ';color:#FFFFFF;font-size:15.5px;font-weight:600;text-align:center;text-decoration:none;padding:15px 20px;border-radius:9px">' + tcEsc_(loai.nut.chu) + '</a></td></tr>');
      h.push('<tr><td style="padding:16px 30px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:9px"><tr><td style="padding:14px 16px">'
        + '<p style="margin:0 0 4px;font-size:13.5px;font-weight:600;color:#0F172A">Bấm nút mà máy không mở gì?</p>'
        + '<p style="margin:0;font-size:13.5px;line-height:1.6;color:#475569">Máy trạm có thể đang tắt. Bật máy lên, chờ 2 phút rồi bấm lại nút này.</p>'
        + '</td></tr></table></td></tr>');
    }
  }

  // Chân thư
  h.push('<tr><td style="padding:24px 30px 28px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid #E2E8F0;padding-top:14px">'
    + '<p style="margin:0;font-size:12px;line-height:1.7;color:#94A3B8">Thư tự động · gửi ' + tcGioVN_() + ' · mã sự cố <span style="font-family:' + TC_MONO + '">' + maHT + '</span>'
    + '<br>Hệ thống sẽ tự gửi thư báo khi dữ liệu chảy lại. Không cần trả lời thư này.</p>'
    + '</td></tr></table></td></tr></table>');

  return '<div style="background:#EEF2F6;padding:24px 12px">' + h.join('') + '</div>';
}

function tcThuDong_(ho, ma, gio) {
  var m = tcMau_('luc');
  var h = [];
  h.push('<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;margin:0 auto;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:14px;overflow:hidden;font-family:' + TC_SANS + '">');
  h.push('<tr><td style="height:5px;background:' + m.vach + ';font-size:0;line-height:0">&nbsp;</td></tr>');
  h.push('<tr><td style="padding:26px 30px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
    + '<td style="font-size:11px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;color:#94A3B8">Audit Factory · Giám sát dữ liệu</td>'
    + '<td align="right" style="font-family:' + TC_MONO + ';font-size:11px;color:#94A3B8">' + tcMaSuCo_(ma) + ' · ĐÃ ĐÓNG</td>'
    + '</tr></table></td></tr>');
  h.push('<tr><td style="padding:18px 30px 0"><p style="margin:0;font-size:23px;line-height:1.32;font-weight:700;color:#0F172A;letter-spacing:-.3px">'
    + tcEsc_(ho.nguon || 'Dữ liệu') + ' đã chảy lại bình thường</p></td></tr>');
  h.push('<tr><td style="padding:20px 30px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:' + m.nen + ';border:1px solid ' + m.vien + ';border-radius:10px"><tr>'
    + '<td width="50%" style="padding:16px 18px;border-right:1px solid ' + m.vien + '">'
    + '<p style="margin:0 0 3px;font-size:10.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:' + m.chu + '">Gián đoạn</p>'
    + '<p style="margin:0;font-size:19px;color:#0F172A;font-weight:700">' + tcDoiGio_(gio) + '</p></td>'
    + '<td width="50%" style="padding:16px 18px">'
    + '<p style="margin:0 0 3px;font-size:10.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:' + m.chu + '">Khắc phục lúc</p>'
    + '<p style="margin:0;font-size:19px;color:#0F172A;font-weight:700">' + tcGioVN_() + '</p></td>'
    + '</tr></table></td></tr>');
  h.push('<tr><td style="padding:24px 30px 0"><p style="margin:0;font-size:15px;line-height:1.68;color:#475569">'
    + 'Hệ thống đã lấy bù dữ liệu của quãng gián đoạn. <b style="color:#0F172A">Không cần làm gì thêm.</b></p></td></tr>');
  h.push('<tr><td style="padding:24px 30px 28px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid #E2E8F0;padding-top:14px">'
    + '<p style="margin:0;font-size:12px;line-height:1.7;color:#94A3B8">Thư tự động · gửi ' + tcGioVN_() + '</p>'
    + '</td></tr></table></td></tr></table>');
  return '<div style="background:#EEF2F6;padding:24px 12px">' + h.join('') + '</div>';
}

/** Bản chữ thuần — đọc được trên đồng hồ / máy đọc màn hình / khi Gmail chặn HTML. */
function tcBanChu_(sc, loai) {
  var d = [loai.tieuDe(sc).replace(/^[^\wÀ-ỹ]+/, ''), ''];
  var ds = loai.soLieu(sc) || [];
  for (var i = 0; i < ds.length; i++) d.push('- ' + ds[i][0] + ': ' + ds[i][1]);
  d.push('', 'VÌ SAO', loai.viSao(sc).replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, ''), '', 'VIỆC CẦN LÀM');
  for (var k = 0; k < (loai.buoc || []).length; k++) d.push((k + 1) + '. ' + loai.buoc[k].t + ' — ' + loai.buoc[k].m);
  d.push('', 'Mã sự cố: ' + tcMaSuCo_(sc.ma) + ' · ' + tcGioVN_());
  return d.join('\n');
}

/* ─────────────────── CHẠY TAY 1 LẦN TRONG EDITOR ─────────────────── */

/** Tạo trigger canh nhịp tim mỗi giờ (chạy 1 lần; gọi lại cũng không tạo trùng). */
function tcTaoTrigger() {
  var ts = ScriptApp.getProjectTriggers();
  for (var i = 0; i < ts.length; i++) {
    if (ts[i].getHandlerFunction() === 'tcCanhNhipTim') { Logger.log('Trigger đã có sẵn.'); return; }
  }
  ScriptApp.newTrigger('tcCanhNhipTim').timeBased().everyHours(1).create();
  Logger.log('✓ Đã tạo trigger tcCanhNhipTim mỗi giờ.');
}

/** Gửi thử 1 thư mỗi loại về hộp thư cảnh báo — để xem thật trước khi bật. */
function tcThuNghiem() {
  var so = tcSoLoai_();
  var mau = {
    DANG_NHAP_TAY: { ma: 'THU-DN', loai: 'DANG_NHAP_TAY', nguon: 'Đăng nhập tự động', soLieu: { soLuot: 6, treGio: 27 }, chiTiet: 'Incorrect sign-in details.' },
    BUOC_DUNG: { ma: 'THU-BD', loai: 'BUOC_DUNG', nguon: 'Chấm công · Danh bạ nhân sự', soLieu: { treGio: 27 }, chiTiet: '' },
    DU_LIEU_LECH: { ma: 'THU-DL', loai: 'DU_LIEU_LECH', nguon: 'Tồn kho bất thường', soLieu: { docDuoc: 12, kyVong: 2400 }, chiTiet: 'trung vị 14 lượt gần nhất là 2400' },
    MAY_TRAM_IM: { ma: 'THU-MT', loai: 'MAY_TRAM_IM', nguon: 'Máy trạm', soLieu: { treGio: 5 }, chiTiet: '' }
  };
  for (var k in mau) tcGui_(mau[k], so[k], { mocDaGui: 0 });
  Logger.log('✓ Đã gửi ' + Object.keys(mau).length + ' thư mẫu tới ' + tcEmail_());
}

/** Xoá mọi sự cố đang mở (dùng khi muốn bắt đầu lại từ đầu). */
function tcXoaSoSuCo() {
  var props = PropertiesService.getScriptProperties();
  var k = props.getKeys(), n = 0;
  for (var i = 0; i < k.length; i++) if (k[i].indexOf('TC_SC_') === 0) { props.deleteProperty(k[i]); n++; }
  Logger.log('Đã xoá ' + n + ' sự cố đang mở.');
}
