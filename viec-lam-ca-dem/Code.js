/**
 * VIỆC LÀM CA ĐÊM — bộ cào tự động chạy trên máy chủ Google (Apps Script).
 * =====================================================================================
 * Vì sao có file này (14/09/2026):
 *   Bản cũ (daily_job_sync.py + scrape_jobs.py) KHÔNG hề vào mạng: 20 tin nằm cứng trong
 *   code, chạy bao nhiêu lần cũng ra đúng 20 tin đó; và máy cũng chưa hề đặt lịch 9h.
 *
 * BẢN 2 (14/09/2026) — sửa theo 4 ý user:
 *   1. CHẠY NHANH: mọi lượt tải dùng UrlFetchApp.fetchAll (gọi song song thay vì xếp hàng)
 *      + tab BỘ NHỚ giữ nội dung tin đã đọc và số km đã đo → lượt sau chỉ làm phần MỚI.
 *      Bỏ hết icon trong menu, nhãn và nút.
 *   2. Cột "Ngày đăng" (ngày giờ thật) + "Đăng cách đây" (công thức NOW() nên tự đếm tiếp).
 *   3. Việc telesale/tổng đài/CSKH bị đẩy xuống cuối bảng, có nhãn riêng.
 *   4. Bốn nguồn: vieclam24h.vn, hoteljob.vn, careerviet.vn, topcv.vn + tab TRANG CÔNG TY
 *      để tự dán link trang tuyển dụng của công ty nào muốn theo dõi.
 *      (Facebook không cào được — xem README, mục "Vì sao không có Facebook".)
 *
 * NGUYÊN TẮC AN TOÀN DỮ LIỆU
 *   - Mọi nguồn hỏng hết  → GIỮ NGUYÊN bảng cũ, chỉ ghi nhật ký. Không bao giờ xoá trắng.
 *   - Có khoá (LockService) quanh cụm xoá + ghi.
 *   - Ngân sách thời gian (trần Apps Script 6 phút) — chạm ngưỡng thì dừng, vẫn ghi được.
 *   - Nhật ký ghi rõ TỪNG nguồn: mã HTTP, lấy được bao nhiêu tin, mất bao nhiêu giây.
 */

/* ====================== HẰNG SỐ ====================== */

var TAB_CAUHINH = 'CẤU HÌNH';
var TAB_NHATKY = 'NHẬT KÝ';
var TAB_BONHO = 'BỘ NHỚ';
var TAB_NGUONCT = 'NGUỒN CÔNG TY';   // gộp TRANG CÔNG TY + CÔNG TY THEO DÕI (user: bớt tab dư, 15/09/2026)
var TEN_HAM_LICH = 'capNhatHangNgay';
/* Chạy TỪ TRÌNH SOẠN THẢO thì không có "bảng tính đang mở" — phải mở theo id. */
var ID_BANG = '1oHmNxMS1wwZvPiwb9r6bS0Tn8CxiPF3spi6xjf9I8QQ';

var TIEU_DE = [
  'Nguồn', 'Loại việc', 'Tên công việc', 'Chi tiết công việc', 'Yêu cầu công việc', 'Thời gian làm việc',
  'Mức lương', 'Địa chỉ', 'Khoảng cách ô tô', 'Nhà tuyển dụng',
  'Ngày đăng', 'Đăng cách đây', 'Link', 'Nhãn'
];
/* Cột "Loại việc" thêm 16/09/2026 — user bảo bảng "chưa đa dạng" (39 việc, toàn khách sạn/lễ tân).
   Có cột này thì nhìn một cái là biết bảng đang có bao nhiêu nhóm nghề, và lọc theo nhóm được. */
/* Bề rộng cột: 3 cột văn bản dài được rộng và cho xuống dòng; các cột còn lại hẹp, cắt gọn
   để dòng không bị kéo cao vô ích (user phàn nàn 14/09: chữ ít mà ô to). */
var RONG_COT = [100, 110, 250, 360, 290, 130, 150, 210, 90, 180, 105, 100, 90, 110];
/* Bề rộng cân theo lượng chữ thật của từng cột (đo trên bảng 35 việc ngày 15/09/2026):
   Chi tiết rộng nhất, các cột số thì hẹp. Mọi cột đều xuống dòng nên không còn cảnh mất chữ. */
var COT_GIO = 6;         // F
var COT_LUONG = 7;       // G
var COT_KM = 9;          // I
var COT_NGAYDANG = 11;   // K
var COT_CACHDAY = 12;    // L
var COT_LINK = 13;       // M

/* Trần cứng của bảng: user để 0 (không giới hạn) thì vẫn không vượt số này — giữ cho lượt chạy
   và bảng tính không phình bất ngờ. */
var TRAN_CUNG_ = 500;

var MAC_DINH = [
  ['Điểm xuất phát (để đo khoảng cách)', 'Gà hấp hèm 34, Hóc Môn, Thành phố Hồ Chí Minh'],
  ['Toạ độ dự phòng (lat,lng)', '10.8860463,106.5927134'],
  ['Bán kính tối đa (km)', 20],
  ['Từ khoá tìm (cách nhau bằng dấu phẩy)', 'ca đêm, làm đêm, trực đêm, ca tối'],
  ['Số trang mỗi từ khoá (vieclam24h)', 2],
  /* Tin "ca đêm" nằm trong MÔ TẢ chứ không ở tiêu đề thì trang việc làm không trả về khi tìm
     chữ "ca đêm" (đo 19/09/2026: tin Giám sát an ninh & Kiểm soát nội bộ của BEST Logistics ghi
     rõ "Đối với Audit tại SC bắt buộc Làm việc ca đêm" nhưng tìm "ca đêm" trên careerviet KHÔNG
     ra, chỉ ra khi tìm "giám sát an ninh"). Nên phải tìm thêm theo NGHỀ hay làm đêm rồi đọc kỹ. */
  ['Từ khoá NGHỀ hay làm đêm (tìm rộng rồi đọc kỹ)', 'bảo vệ, an ninh, giám sát, kho, phân loại hàng, lễ tân, tạp vụ, tài xế'],
  ['Số việc ghi ra tối đa', 300],
  ['Chỉ lấy tin đăng trong (ngày)', 45],
  ['Cò tự động: mấy giờ chạy một lần', 1],
  ['Lấy nội dung chi tiết từng tin', 'Có'],
  ['Việc telesale (Loại bỏ / Xuống cuối / Giữ)', 'Loại bỏ'],
  ['Dịch tin tiếng Anh sang tiếng Việt', 'Có'],
  ['Bật nguồn vieclam24h.vn', 'Có'],
  ['Bật nguồn hoteljob.vn', 'Có'],
  ['Bật nguồn careerviet.vn', 'Có'],
  ['Bật nguồn jobsgo.vn (hay chặn, đo trên máy chủ Google toàn 403)', 'Không'],
  ['Bật nguồn vieclam.thegioididong.com', 'Có'],
  ['MWG (Thế Giới Di Động + Bách Hoá Xanh + An Khang…): mấy trang mỗi lượt (20 tin/trang)', 8],
  ['Bật nguồn Facebook (bài do tiện ích gửi về)', 'Có'],
  ['Bật nguồn topcv.vn (hay bị chặn, bật cũng thường trả 403)', 'Không'],
  ['Bật nguồn trang công ty (tab TRANG CÔNG TY)', 'Có'],
  ['Trang công ty: máy chủ tự quét mấy công ty mỗi lượt', 4],
  ['Trang công ty: đọc tối đa mấy tin mới mỗi công ty', 8],
  ['Tìm theo tên công ty theo dõi (tab CÔNG TY THEO DÕI)', 'Có'],
  ['Công ty theo dõi: mấy tên mỗi lượt', 5],
  ['Số ngày giữ tin trong BỘ NHỚ', 60],
  ['Số dòng tối đa trong BỘ NHỚ', 5000],
  ['Bật nguồn vieclamtot.com (Chợ Tốt: bảo vệ, kho, quán, xưởng…)', 'Có'],
  ['Chợ Tốt: mấy trang mỗi lượt (50 tin/trang)', 7],
  ['Chợ Tốt: mấy trang cho Long An', 2],
  ['Đọc kỹ tối đa mấy tin "mơ hồ" mỗi lượt (tiêu đề không có chữ đêm)', 60],
  ['Đọc chi tiết tối đa mấy tin mỗi lượt (hoteljob + MWG)', 90],
  /* Nới ±: tin ở khoảng (bán kính, bán kính + nới] vẫn nhận nhưng gắn nhãn "Hơi xa" và xếp sau.
     User chốt 18/09/2026: "nới lên 20 km ±5 cho tất cả". */
  ['Nới thêm cho tin ở rìa (km)', 5]
];

/**
 * Từ khoá ca đêm — ĐÃ SIẾT 15/09/2026.
 * Bản cũ có "xoay ca" và "đêm" trơ trọi nên lọt tin "Tổng đài Điện Máy Xanh: làm việc xoay ca,
 * Ca 1: 8h-17h, Ca 2: 12h-21h" — xoay ca ban ngày, không phải ca đêm. Nay chỉ nhận cụm từ nói
 * thẳng là đêm; còn "đêm"/"night" trơ trọi chỉ tin khi nằm trong TÊN công việc.
 */
var DAU_HIEU_DEM = ['ca đêm', 'làm đêm', 'trực đêm', 'ban đêm', 'làm việc đêm', 'ca tối',
  'night shift', 'night audit', 'overnight', 'ca 3'];
var DAU_HIEU_DEM_TEN = DAU_HIEU_DEM.concat(['đêm', 'night']);

/* Việc telesale — 15/09/2026 user chốt: LOẠI BỎ HẲN, không phải đẩy xuống cuối nữa.
   Vẫn để đường lui trong tab CẤU HÌNH (Xuống cuối / Giữ) phòng khi đổi ý. */
/* Dấu hiệu CHẮC CHẮN là telesale — soi ở cả phần mô tả cũng không sợ oan. */
var TELESALE_CHAC = ['telesale', 'telesales', 'tele sale', 'telemarketing', 'telecare',
  'tổng đài', 'call center', 'sale phone', 'chốt sale', 'chốt đơn', 'gọi điện thoại',
  'bán hàng qua điện thoại', 'kinh doanh qua điện thoại', 'thu hồi nợ', 'nhắc nợ', 'seeding'];

/* Dấu hiệu DỄ OAN — chỉ xét ở TÊN VIỆC và TÊN CÔNG TY.
   Ca đã cắn 15/09/2026: "Nữ Lễ Tân Khách Sạn Ca Đêm (22h-7h)" bị loại nhầm vì phần mô tả có
   chữ "chăm sóc khách hàng" — lễ tân khách sạn nào chẳng viết câu đó. */
var TELESALE_NHE = ['cskh', 'chăm sóc khách hàng', 'tư vấn khách hàng', 'tư vấn viên',
  'nhân viên tư vấn', 'tư vấn visa', 'tư vấn tuyển sinh', 'tư vấn bảo hiểm', 'customer service'];

/** "Loại bỏ" → 'bo' · "Xuống cuối" → 'cuoi' · còn lại → 'giu'. */
function kieuTelesale_(x) {
  var s = khongDau_(String(x));
  if (s.indexOf('loai') >= 0 || s.indexOf('bo han') >= 0) return 'bo';
  if (s.indexOf('cuoi') >= 0) return 'cuoi';
  return 'giu';
}

/** Có phải việc telesale không — xét tên, nhà tuyển dụng và đoạn đầu mô tả. */
function laTelesale_(v) {
  var ten = khongDau_((v.ten || '') + ' ' + (v.ntd || ''));
  /* hoteljob là trang khách sạn/nhà hàng: "chăm sóc khách hàng" ở đó là đón khách ban đêm
     (ca 15/09/2026: "Nhân viên Chăm sóc Khách hàng — Ca đêm" của hostel Circadian), không phải
     gọi điện bán hàng → nguồn này chỉ soi bậc CHẮC, không soi bậc dễ oan. */
  var laKhachSan = v.nguon === 'hoteljob.vn';
  if (!laKhachSan && TELESALE_NHE.some(function (k) { return ten.indexOf(khongDau_(k)) >= 0; })) return true;
  var caBai = ten + ' ' + khongDau_(String(v.chiTiet || '').substring(0, 300));
  return TELESALE_CHAC.some(function (k) { return caBai.indexOf(khongDau_(k)) >= 0; });
}

var VUNG_GAN = ['ho chi minh', 'hcm', 'sai gon', 'binh duong', 'hoc mon', 'cu chi', 'thu duc',
  'go vap', 'tan binh', 'tan phu', 'binh tan', 'binh chanh', 'nha be', 'quan 1', 'quan 2', 'quan 3', 'quan 4', 'quan 5', 'quan 6', 'quan 7', 'quan 8', 'quan 9', 'quan 10', 'quan 11', 'quan 12', 'di an', 'thuan an', 'long an', 'duc hoa'];

/* ====================== MENU ====================== */

/**
 * Hàm này chỉ dành cho lúc MỞ bảng tính (Google tự gọi). Bấm Chạy tay trong trình soạn thảo
 * sẽ báo "Cannot call SpreadsheetApp.getUi() from this context" vì lúc đó không có thanh menu
 * nào để gắn vào — đó là chuyện bình thường, không phải hỏng. Muốn chạy tay thì chọn hàm
 * caoNgay. Bọc try/catch cho khỏi hiện dòng đỏ làm hoảng.
 */
function onOpen() {
  try { dungMenu_(); } catch (e) { Logger.log('onOpen: ' + e); }
}

function dungMenu_() {
  SpreadsheetApp.getUi()
    .createMenu('Việc ca đêm')
    .addItem('Cào ngay', 'caoNgay')
    .addSeparator()
    .addItem('Bật cò tự động (mỗi giờ tự cào)', 'batLich')
    .addItem('Tắt cò tự động', 'tatLich')
    .addItem('Kiểm tra tình trạng cò', 'xemLich')
    .addSeparator()
    .addItem('Thử nguồn (không ghi bảng)', 'kiemTraNguon')
    .addItem('Xoá bộ nhớ, cào lại từ đầu', 'xoaBoNho')
    .addSeparator()
    .addItem('Cập nhật danh sách nguồn công ty', 'capNhatNguonCongTy')
    .addSeparator()
    .addItem('Khoá cho tiện ích Facebook', 'khoaTienIch')
    .addItem('Dọn rác trong tab BÀI FACEBOOK', 'donRacFacebook')
    .addToUi();
}

/**
 * Phương án 2 nếu mở bảng tính mà KHÔNG thấy menu: chạy hàm này một lần trong trình soạn thảo.
 * Nó đặt một cái "bẫy mở file" chính thức, lần sau mở bảng tính là menu hiện.
 * (Chỉ dùng khi cần — chạy thừa sẽ thành 2 menu trùng tên.)
 */
function caiMenu() {
  var co = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'onOpen'; });
  if (co) { bao_('Đã cài sẵn rồi, không cần cài lại.'); return; }
  ScriptApp.newTrigger('onOpen').forSpreadsheet(ID_BANG).onOpen().create();
  bao_('Đã cài. Mở lại bảng tính (F5) là thấy menu Việc ca đêm.');
}

/**
 * Bấm "Cào ngay" là một lệnh duy nhất: bảng tính cào các trang việc làm NGAY, đồng thời dựng cờ
 * gọi tiện ích Facebook. Tiện ích hỏi bảng tính mỗi 3 phút, thấy cờ thì gom nhóm rồi tự bảo
 * bảng tính gộp lại. Apps Script chạy trên máy chủ Google nên không gọi thẳng xuống trình duyệt
 * được — cờ + hỏi thăm là đường duy nhất đi được.
 */
function caoNgay() {
  PropertiesService.getScriptProperties().setProperty('yc_fb', String(Date.now()));
  chay_('bấm tay');
}
function capNhatHangNgay() { chay_('lịch tự động'); }

/**
 * Cò tự động: Google tự chạy mỗi mấy giờ một lần (mặc định 1 giờ), không cần ai bấm.
 * Lượt tự động KHÔNG gọi tiện ích Facebook — tiện ích có nhịp riêng của nó, gom xong thì tự
 * báo về gộp lại. Gọi Facebook mỗi giờ là cách nhanh nhất để bị hỏi lại mật khẩu.
 */
function batLich() {
  tatLich();
  var gio = docCauHinh_(bang_()).moiMayGio;
  ScriptApp.newTrigger(TEN_HAM_LICH).timeBased().everyHours(gio).create();
  bao_('Đã bật cò: Google tự cào mỗi ' + gio + ' giờ một lần, không cần bấm gì.\n' +
    'Đổi nhịp ở tab CẤU HÌNH, mục "Cò tự động: mấy giờ chạy một lần", rồi bật lại.');
}

function tatLich() {
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === TEN_HAM_LICH) { ScriptApp.deleteTrigger(t); n++; }
  });
  if (n) bao_('Đã tắt ' + n + ' lịch chạy tự động.');
}

function xemLich() {
  var ds = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === TEN_HAM_LICH; });
  var lan = PropertiesService.getScriptProperties().getProperty('lan_chay_cuoi') || 'chưa chạy lần nào';
  bao_((ds.length
    ? 'Lịch ĐANG BẬT (mỗi ngày khoảng 9h–10h sáng, Google tự chọn phút trong khung đó).'
    : 'Lịch ĐANG TẮT — bảng sẽ không tự cập nhật.') + '\nLần chạy gần nhất: ' + lan);
}

function xoaBoNho() {
  var ss = bang_();
  var sh = ss.getSheetByName(TAB_BONHO);
  if (sh) ss.deleteSheet(sh);
  var kho = PropertiesService.getScriptProperties();
  kho.getKeys().forEach(function (k) { if (k.indexOf('km::') === 0 || k.indexOf('geo::') === 0) kho.deleteProperty(k); });
  bao_('Đã xoá bộ nhớ. Lượt cào tới sẽ đọc lại toàn bộ từ đầu (chậm hơn bình thường).');
}

/* ====================== CỬA NHẬN BÀI TỪ TIỆN ÍCH FACEBOOK ======================
 * Tiện ích trên Edge (chạy trong phiên Facebook của chính user) gửi bài về đây.
 * Cửa này CHỈ nhận, không đăng nhập hộ ai, không lấy gì ngoài thứ tiện ích gửi lên.
 * Chặn cửa bằng một khoá riêng sinh trong menu — không đặt khoá cứng trong mã nguồn.
 */

function khoaTienIch() {
  var kho = PropertiesService.getScriptProperties();
  var k = kho.getProperty('KHOA_FB');
  if (!k) {
    k = Utilities.getUuid().replace(/-/g, '').substring(0, 24);
    kho.setProperty('KHOA_FB', k);
  }
  bao_('Khoá để dán vào tiện ích:\n\n' + k + '\n\nĐịa chỉ nhận bài: xem file HUONG-DAN-TIEN-ICH.md.');
}

/** Tiện ích hỏi: "có lệnh cào mới không?" — trả về mốc thời gian của lần bấm Cào ngay gần nhất. */
function doGet(e) {
  var kho = PropertiesService.getScriptProperties();
  var khoa = kho.getProperty('KHOA_FB');
  var xin = (e && e.parameter && e.parameter.khoa) || '';
  /* Trả luôn danh sách trang tuyển dụng công ty (tab TRANG CÔNG TY) để tiện ích đọc bằng
     trình duyệt thật — máy chủ Google không chạy JavaScript nên đọc mấy trang đó chỉ ra cái vỏ
     (Kingfoodmart: 8,6 KB, 121 chữ, không có việc nào — đo 15/09/2026). */
  var o = (khoa && xin === khoa)
    ? { ok: true, yc: Number(kho.getProperty('yc_fb') || 0), congTy: docTrangCongTy_(bang_()),
        fbPages: docCongTyTheoDoi_(bang_()).map(function (c) { return c.fb; })
          .filter(function (u) { return /^https?:\/\/(www\.)?facebook\.com\//i.test(u); }) }
    : { ok: false, loi: 'sai khoá' };
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var tra = function (o) {
    return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
  };
  try {
    var d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var that = PropertiesService.getScriptProperties().getProperty('KHOA_FB');
    if (!that || d.khoa !== that) return tra({ ok: false, loi: 'sai khoá' });

    /* Tiện ích gom Facebook xong thì báo về đây để gộp lại bảng — không phải cào lại các trang
       việc làm, chỉ dựng lại bảng từ BỘ NHỚ + bài Facebook, nên chỉ mất vài giây. */
    if (d.lenh === 'xong-fb') {
      var khoa2 = LockService.getDocumentLock();
      khoa2.waitLock(60000);
      try {
        PropertiesService.getScriptProperties().deleteProperty('yc_fb');
        var so = gopLai_();
        return tra({ ok: true, gopLai: so });
      } finally { khoa2.releaseLock(); }
    }

    var bai = d.bai || [];
    if (!bai.length) return tra({ ok: true, nhan: 0 });

    /* Bài THỬ từ nút "Thử nối bảng tính": chỉ xác nhận đường ống thông, KHÔNG lưu — trước đây nó
       lọt vào bảng chính như một việc thật (user bắt được 15/09/2026). */
    if (d.nhom === 'thử nối' || bai.every(function (b) { return /^thu-noi-/.test(String(b.id || '')); })) {
      return tra({ ok: true, nhan: bai.length, moi: 0, thu: true });
    }

    var khoa = LockService.getDocumentLock();
    khoa.waitLock(30000);
    try {
      var n = luuBaiFb_(bang_(), bai, d.nhom || '');
      return tra({ ok: true, nhan: bai.length, moi: n });
    } finally {
      khoa.releaseLock();
    }
  } catch (err) {
    return tra({ ok: false, loi: String(err) });
  }
}

/** Xoá các dòng không phải tin tuyển người khỏi tab BÀI FACEBOOK (bài đã trót lấy về trước đây). */
function donRacFacebook() {
  var ss = bang_();
  var sh = ss.getSheetByName(TAB_FB);
  if (!sh || sh.getLastRow() < 2) { bao_('Tab BÀI FACEBOOK chưa có dữ liệu.'); return; }
  var d = sh.getRange(2, 1, sh.getLastRow() - 1, COT_FB.length).getValues();
  var giu = d.filter(function (r) { return laTinTuyenDung_(locDongGiaoDien_(r[4])); });
  var bo = d.length - giu.length;
  sh.getRange(2, 1, d.length, COT_FB.length).clearContent();
  if (giu.length) sh.getRange(2, 1, giu.length, COT_FB.length).setValues(giu);
  bao_('Đã dọn: bỏ ' + bo + ' dòng rác, giữ lại ' + giu.length + ' tin tuyển dụng.');
}

var TAB_FB = 'BÀI FACEBOOK';
var COT_FB = ['id', 'nhóm', 'tác giả', 'lúc đăng', 'nội dung', 'link', 'nhận lúc'];

/** Ghi bài mới vào tab BÀI FACEBOOK, bỏ bài đã có, giữ 45 ngày gần nhất. */
function luuBaiFb_(ss, bai, nhomMacDinh) {
  var sh = ss.getSheetByName(TAB_FB);
  if (!sh) {
    sh = ss.insertSheet(TAB_FB);
    sh.getRange(1, 1, 1, COT_FB.length).setValues([COT_FB])
      .setBackground('#1c4587').setFontColor('#ffffff').setFontWeight('bold');
    sh.setColumnWidth(1, 180); sh.setColumnWidth(2, 180); sh.setColumnWidth(3, 150);
    sh.setColumnWidth(4, 130); sh.setColumnWidth(5, 560); sh.setColumnWidth(6, 120);
    sh.setFrozenRows(1);
  }
  /* Tab này chỉ là chỗ chứa bài thô trước khi lọc — ẩn đi cho khỏi rối (user 15/09/2026). */
  if (!sh.isSheetHidden()) sh.hideSheet();
  var daCo = {};
  if (sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues()
      .forEach(function (r) { if (r[0]) daCo[String(r[0])] = 1; });
  }
  var nay = new Date(), them = [];
  bai.forEach(function (b) {
    var id = String(b.id || b.link || '').substring(0, 180);
    if (!id || daCo[id]) return;
    daCo[id] = 1;
    them.push([id, b.nhom || nhomMacDinh, b.tacGia || '', b.luc ? new Date(b.luc) : '',
      catChu_(String(b.chu || ''), 3000), b.link || '', nay]);
  });
  if (them.length) sh.getRange(sh.getLastRow() + 1, 1, them.length, COT_FB.length).setValues(them);

  /* dọn bài quá 45 ngày để tab không phình mãi */
  if (sh.getLastRow() > 1) {
    var d = sh.getRange(2, 1, sh.getLastRow() - 1, COT_FB.length).getValues();
    var giu = d.filter(function (r) {
      var t = r[6] instanceof Date ? r[6].getTime() : nay.getTime();
      return nay.getTime() - t < 45 * 86400000;
    });
    if (giu.length !== d.length) {
      sh.getRange(2, 1, d.length, COT_FB.length).clearContent();
      if (giu.length) sh.getRange(2, 1, giu.length, COT_FB.length).setValues(giu);
    }
  }
  return them.length;
}

/* ====== CÓ PHẢI TIN TUYỂN NGƯỜI KHÔNG ======
   Bài học 15/09/2026 (user chỉ ra 3 dòng rác):
     - "dạ em xin JD job service nha anh" → bình luận.
     - "E k rep đc ạ ib zl0383154301" → bình luận.
     - "mình học quản trị khách sạn... đi xin việc... lương cơ bản 8tr" → bài THẬT nhưng là người
       ĐI XIN VIỆC kể chuyện. Lọc cũ chỉ hỏi "có dính tới việc làm không" nên nó lọt.
   Luật mới: phải có ĐỘNG TỪ TUYỂN thì mới nhận; và nếu mở đầu bài là giọng người đi xin việc
   mà đoạn mở đầu không có chữ tuyển thì loại. */
/* Nới 15/09/2026 tối cho khớp với tiện ích: bắt cả "cần 2 bảo vệ", "tìm phục vụ", "nhận tạp vụ",
   và bài có lương + liên hệ/zalo/số điện thoại — kiểu viết cộc của nhóm Facebook. */
var TUYEN_NGUOI_FB = /(tuyen|can tuyen|can nguoi|can gap|can them|dang can|can \d+|can nam|can nu|can ban|nhan nguoi|nhan nhan vien|tim nguoi lam|tim nguoi|hiring|recruit|tuyen dung|can tim|(can|tim|nhan|bo sung)\s+(\d+\s+)?(ban|nam|nu|nguoi|nhan vien|bao ve|phuc vu|tap vu|le tan|buong phong|thu ngan|kho|giao hang|tai xe|shipper|phu bep|bep|pha che|giu xe|ve sinh|cong nhan|lao dong)|luong .{0,40}(lien he|lh|zalo|inbox|ib)|(lien he|lh|zalo)\s*:?\s*0\d{8,10})/;
var DI_XIN_VIEC_FB = /(xin viec|tim viec|em xin|minh xin|cho em hoi|cho minh hoi|xin hoi|minh hoc|em hoc|moi ra truong|co ai biet|ai biet cho nao|review cong ty|tam su|em can viec|minh can viec|xin jd)/;
var DONG_GIAO_DIEN_FB = /^(thích|like|trả lời|chia sẻ|bình luận|xem thêm|xem bản dịch|tất cả cảm xúc|đã thích|theo dõi|tham gia|ẩn|báo cáo|dịch|viết bình luận|tác giả)$/i;

function laTinTuyenDung_(chu) {
  var s = khongDau_(chu);
  if (s.length < 30) return false;                     // 80 → 30: "Cần 2 bảo vệ ca đêm Q12, 7tr, LH 09…" là 43 chữ
  if (!TUYEN_NGUOI_FB.test(s)) return false;          // không ai tuyển ai thì không phải tin việc
  /* Giọng người đi xin việc ở đầu bài → loại, dù trong câu có chữ "tuyển" ("ai biết chỗ nào tuyển
     bảo vệ đêm không, em cần việc") — trừ khi bài MỞ ĐẦU bằng động từ tuyển. */
  var dau = s.substring(0, 160);
  /* "mở đầu bằng động từ tuyển" phải neo ở ĐẦU CÂU — "ai biết chỗ nào tuyển…" có chữ tuyển ở
     chữ thứ 5 nhưng vẫn là người đi hỏi việc. */
  var moDauTuyen = /^\W*(tuyen|can\b|tim\b|nhan\b|dang can|bo sung|hiring|recruit)/.test(s);
  if (DI_XIN_VIEC_FB.test(dau) && !moDauTuyen) return false;
  return true;
}

/** Bỏ dòng giao diện của Facebook còn sót trong nội dung bài. */
function locDongGiaoDien_(chu) {
  return String(chu || '').split('\n')
    .filter(function (d) { return d.trim() && !DONG_GIAO_DIEN_FB.test(d.replace(/^[•\s·]+/, '').trim()); })
    .join('\n');
}

/** Đọc tab BÀI FACEBOOK thành các tin việc, để đi chung đường lọc với 5 nguồn kia. */
function nguonFacebook_(ss) {
  var sh = ss.getSheetByName(TAB_FB);
  if (!sh || sh.getLastRow() < 2) return [];
  var d = sh.getRange(2, 1, sh.getLastRow() - 1, COT_FB.length).getValues();
  return d.filter(function (r) {
    if (!r[0] || !r[4]) return false;
    /* Trang tuyển dụng của công ty thì bản thân trang đã là tin tuyển người — khỏi soi động từ
       "tuyển"; chỉ bài nhóm Facebook mới phải qua cửa đó (để bỏ bình luận, tâm sự, người xin việc). */
    if (!/facebook\.com/i.test(String(r[5] || ''))) return String(r[4]).length >= 60;
    return laTinTuyenDung_(locDongGiaoDien_(r[4]));
  }).map(function (r) {
    var chu = locDongGiaoDien_(r[4]);
    var dong = chu.split('\n').filter(function (x) { return x.trim().length > 4; });
    var luc = r[3] instanceof Date ? Math.round(r[3].getTime() / 1000) : 0;
    var laFb = /facebook\.com/i.test(String(r[5] || ''));
    return tin_({
      nguon: laFb ? 'facebook' : 'trang công ty',
      id: (laFb ? 'fb-' : 'ct-') + String(r[0]).substring(0, 60),
      ten: catChu_((dong[0] || chu).trim(), 120),
      chiTiet: catChu_(gachDauDong_(chu), 450),
      daChiTiet: true,
      /* Bài Facebook / trang công ty không đi qua bước đọc chi tiết nên phải dò giờ ca ở đây —
         thiếu dòng này bài ghi rõ "Ca 22h - 6h" vẫn hiện "Chưa nêu giờ". */
      gioLam: timGioLam_(chu),
      luong: timLuongTrongChu_(chu),
      diaChi: timDiaChiTrongChu_(chu),
      ntd: (r[2] ? r[2] + ' · ' : '') + (r[1] || 'nhóm Facebook'),
      dangLuc: kepMoc_(luc),
      link: r[5] || ''
    });
  });
}

/** Tin trên Facebook viết tự do nên chỉ đoán được lương/địa chỉ bằng vài khuôn quen thuộc. */
function timLuongTrongChu_(chu) {
  var m = String(chu).match(/(\d{1,3}(?:[.,]\d{3}){1,3})\s*(?:-|–|đến)?\s*(\d{1,3}(?:[.,]\d{3}){1,3})?\s*(?:đ|vnđ|vnd|k\/|\/ca|\/giờ|\/tháng)/i);
  if (m) return m[0].trim();
  var t = String(chu).match(/(\d{1,2}(?:[.,]\d)?)\s*(?:-|–|đến)\s*(\d{1,2}(?:[.,]\d)?)\s*(?:triệu|tr)\b/i);
  if (t) return t[0].trim() + '/tháng';
  return 'Thoả thuận';
}

function timDiaChiTrongChu_(chu) {
  /* Xét TỪNG DÒNG: bài Facebook xuống dòng liên tục, gom cả bài lại thì địa chỉ dính luôn
     câu "liên hệ Zalo…" phía sau (đã cắn ở QC 15/09). */
  var dong = String(chu).split('\n');
  for (var i = 0; i < dong.length; i++) {
    var m = dong[i].match(/(?:địa chỉ|đ\/c|đc|làm việc tại|chỗ làm)\s*:?\s*(.{8,90})/i);
    if (m) return m[1].replace(/[-–,;.\s]+$/, '').trim();
  }
  var q = String(chu).match(/(quận\s*\d{1,2}|quận\s+[a-zàâăêôơư][^\s,.]*|huyện\s+[^\s,.]{2,15}|tp\.?\s*thủ đức|bình chánh|hóc môn|củ chi|gò vấp|tân bình|tân phú|bình tân|phú nhuận|bình thạnh)/i);
  return q ? q[0].trim() : '';
}

/**
 * Gộp lại bảng mà KHÔNG cào lại các trang việc làm: lấy tin trong BỘ NHỚ (còn hạn) cộng với
 * bài Facebook mới về, lọc và xếp như thường. Vài giây là xong vì không gọi ra ngoài lượt nào.
 */
function gopLai_() {
  var t0 = Date.now();
  var ss = bang_();
  var cfg = docCauHinh_(ss);
  var nho = docBoNho_(ss);
  var goc = toaDoGoc_(cfg);
  var log = ['gộp lại sau khi tiện ích gửi bài Facebook'];

  var viec = [];
  ['vieclam24h.vn', 'hoteljob.vn', 'careerviet.vn', 'jobsgo.vn', 'thegioididong.com', 'trang công ty', 'vieclamtot.com']
    .forEach(function (ng) { viec = viec.concat(buTuBoNho_(nho, ng, cfg.ngayNho)); });
  if (cfg.batFacebook) {
    var fb = nguonFacebook_(ss);
    viec = viec.concat(fb);
    log.push('facebook ' + fb.length + ' bài');
  }

  viec = gopBoNho_(viec, nho);
  viec = locVaXep_(viec, cfg, goc);
  if (viec.boTelesale) log.push('bỏ ' + viec.boTelesale + ' telesale');
  viec = viec.slice(0, cfg.toiDa);
  viec.forEach(function (v) { if (v.kmOto == null) { try { v.kmOto = kmOto_(goc, v); } catch (e) { v.kmOto = null; } } });
  xepThuTu_(viec, cfg);
  log.push(tomTatDaDang_(viec));
  if (!viec.length) { ghiNhatKy_(ss, 'gộp lại', 'GIỮ BẢNG CŨ (không có tin nào)', log, t0, 0); return 0; }

  ghiBang_(ss, viec);
  ghiBoNho_(ss, viec, nho, cfg);
  ghiNhatKy_(ss, 'gộp lại', 'OK', log, t0, viec.length);
  return viec.length;
}

/* ====================== CHẠY CHÍNH ====================== */

function chay_(kieu) {
  var t0 = Date.now();
  var khoa = LockService.getDocumentLock();
  if (!khoa.tryLock(30000)) { bao_('Đang có lượt chạy khác, bỏ qua lượt này.'); return; }
  MOC_CHAY_ = t0;   /* mốc chung cho mọi vòng tải, xem conGioTai_ */

  var ss = bang_();
  var cfg = docCauHinh_(ss);
  var log = [];
  var viec = [];

  try {
    var goc = toaDoGoc_(cfg);
    var nho = docBoNho_(ss);
    log.push('xuất phát: ' + goc.ten.substring(0, 40) + ' · bộ nhớ ' + Object.keys(nho).length + ' tin');

    /* --- Bước 1: tải TẤT CẢ trang danh sách cùng lúc --- */
    var yeuCau = [];
    if (cfg.batVl24h) cfg.tuKhoa.forEach(function (kw) {
      for (var p = 1; p <= cfg.soTrang; p++) {
        yeuCau.push({ nguon: 'vl24h', url: 'https://vieclam24h.vn/tim-kiem-viec-lam-nhanh?q=' + encodeURIComponent(kw) + (p > 1 ? '&page=' + p : '') });
      }
    });
    if (cfg.batHoteljob) cfg.tuKhoa.forEach(function (kw) {
      yeuCau.push({ nguon: 'hoteljob', url: 'https://www.hoteljob.vn/tim-viec?keyword=' + encodeURIComponent(kw) });
    });
    if (cfg.batCareerviet) cfg.tuKhoa.forEach(function (kw) {
      yeuCau.push({ nguon: 'careerviet', url: 'https://careerviet.vn/viec-lam/' + khongDauGach_(kw) + '-k-vi.html' });
    });
    if (cfg.batJobsgo) cfg.tuKhoa.forEach(function (kw) {
      yeuCau.push({ nguon: 'jobsgo', url: 'https://jobsgo.vn/viec-lam-' + khongDauGach_(kw) + '.html' });
    });
    /* Cổng tuyển dụng MWG gom việc của CẢ nhà: Thế Giới Di Động, Điện Máy Xanh, Bách Hoá Xanh,
       Nhà thuốc An Khang, AVAKids, TopZone — 136 tin nằm trên 8 trang (20 tin/trang).
       Bản cũ chỉ đọc TRANG 1 nên mọi việc từ trang 2 trở đi không bao giờ lọt: ví dụ "Nhân viên
       Giám sát Camera An ninh Bách Hoá Xanh" (ca 21h00-6h00, 112 Hoàng Hoa Thám, Tân Bình) nằm ở
       trang 2. Đo 18/09/2026 bằng scratchpad/do-chuoi-mwg.mjs: 1 trang → 1 việc ca đêm ·
       8 trang → 8 việc ca đêm. */
    /* TỪ KHOÁ NGHỀ: tìm rộng theo nghề hay làm đêm (1 trang mỗi từ khoá), tin lấy về hầu hết
       KHÔNG có chữ đêm ở tiêu đề nên sẽ đi vào cửa "đọc kỹ tin mơ hồ" — đọc xong mới biết có ca
       đêm hay không. Chỉ hỏi những trang mà máy chủ Google đọc được ổn định. */
    cfg.tuKhoaNghe.forEach(function (kw) {
      /* CHỈ careerviet: vieclam24h đang chặn 403 từ máy chủ Google (đo 19/09/2026, 15/15 trang 403
         suốt từ 17h hôm trước) — đổ thêm 8 địa chỉ nữa chỉ nặng thêm chứ không được gì. */
      if (cfg.batCareerviet) yeuCau.push({ nguon: 'careerviet', url: 'https://careerviet.vn/viec-lam/' + khongDauGach_(kw) + '-k-vi.html' });
    });

    if (cfg.batTgdd) {
      for (var trMwg = 1; trMwg <= cfg.soTrangTgdd; trMwg++) {
        yeuCau.push({ nguon: 'tgdd', url: URL_MWG + (trMwg > 1 ? '?page=' + trMwg : '') });
      }
    }
    /* Chợ Tốt tìm rất "mờ" (mọi từ khoá có chữ đêm đều ra gần cùng một rổ ~2.700 tin) nên chỉ hỏi
       theo từ khoá ĐẦU TIÊN, lấy nhiều trang — mỗi trang 50 tin, có sẵn toàn văn để lọc ngay. */
    if (cfg.batChotot) {
      /* Chia suất: Long An 1 trang (ít tin hơn nhiều), còn lại cho TP.HCM. */
      var kwCt = cfg.tuKhoa[0] || 'ca đêm';
      /* Đo 18/09/2026 (scratchpad/do-sot-chieu-sau.mjs): trang 1-3 cho 92 việc lọt lọc, trang 4-8
         còn THÊM 28 việc nữa — đây là nguồn đáng đọc sâu nhất. Long An: trang 2 thêm 5, trang 3 hết. */
      /* Long An là trang CỘNG THÊM. Bản 18/09 trừ vào suất TP.HCM, mà ô cấu hình của bảng vẫn để
         4 nên HCM tụt còn 2 trang — ít hơn cả trước khi sửa (log 09:25 ngày 19/09: chotot 4/4 trang,
         174 tin, trước đó 200). Đo: HCM nên để 7 trang. */
      var trangHcm = Math.max(1, cfg.soTrangChotot);
      for (var pc = 1; pc <= trangHcm; pc++) {
        yeuCau.push({ nguon: 'chotot', url: urlChotot_(kwCt, pc, CHOTOT_HCM) });
      }
      for (var pl = 1; pl <= cfg.trangChototLongAn; pl++) {
        yeuCau.push({ nguon: 'chotot', url: urlChotot_(kwCt, pl, CHOTOT_LONG_AN) });
      }
    }
    if (cfg.batTheoDoi) {
      var ycTen = yeuCauTheoTenCongTy_(ss, cfg);
      ycTen.forEach(function (y) { yeuCau.push(y); });
      if (ycTen.tenChon && ycTen.tenChon.length) log.push('tìm theo tên công ty: ' + ycTen.tenChon.join(', '));
    }
    if (cfg.batTopcv) cfg.tuKhoa.forEach(function (kw) {
      yeuCau.push({ nguon: 'topcv', url: 'https://www.topcv.vn/tim-viec-lam-' + khongDauGach_(kw) });
    });
    /* Trang công ty KHÔNG cào ở đây nữa: phần lớn là web chạy JavaScript, máy chủ Google chỉ tải
       được cái vỏ. Tiện ích Edge lấy danh sách qua doGet rồi đọc bằng trình duyệt thật, gửi về
       cùng cửa với bài Facebook. */

    /* Bỏ trước các nguồn đang bị chặn dài ngày — đỡ mất thời gian chờ vô ích. */
    var boNguon = {};
    yeuCau = yeuCau.filter(function (y) {
      if (!boQuaNguon_(y.nguon)) return true;
      boNguon[y.nguon] = (boNguon[y.nguon] || 0) + 1;
      return false;
    });
    Object.keys(boNguon).forEach(function (k) {
      log.push(k + ' ĐANG NGHỈ (hỏng nhiều lượt liền, tự thử lại sau 24 giờ)');
    });

    var tra = taiNhieu_(yeuCau.map(function (y) { return y.url; }));
    var dem = {}, trangRongMwg = [];
    tra.forEach(function (r, i) {
      var ng = yeuCau[i].nguon;
      dem[ng] = dem[ng] || { goi: 0, ok: 0, tin: 0, ma: {} };
      dem[ng].goi++;
      dem[ng].ma[r.ma] = (dem[ng].ma[r.ma] || 0) + 1;
      if (r.ma !== 200) return;
      dem[ng].ok++;
      var ds = [];
      if (ng === 'vl24h') ds = phanTichVl24hDanhSach_(r.noiDung).map(chuanHoaVl24h_);
      else if (ng === 'hoteljob') ds = phanTichHoteljob_(r.noiDung);
      else if (ng === 'careerviet') ds = phanTichCareerviet_(r.noiDung);
      else if (ng === 'jobsgo') ds = phanTichJobsgo_(r.noiDung);
      else if (ng === 'tgdd') ds = phanTichTgdd_(r.noiDung);
      else if (ng === 'topcv') ds = phanTichTopcv_(r.noiDung);
      else if (ng === 'chotot') ds = phanTichChotot_(r.noiDung);
      else if (ng === 'congty') ds = phanTichTrangCongTy_(r.noiDung, r.url);
      /* Tin tìm ra theo TÊN công ty theo dõi thì gắn tên đó để nhãn ghi rõ "Theo dõi: Highlands Coffee". */
      if (yeuCau[i].congTy) ds.forEach(function (v) { v.congTyTheoDoi = yeuCau[i].congTy; });
      dem[ng].tin += ds.length;
      /* 200 mà 0 tin = mất trắng 20 tin trong im lặng (cổng MWG thỉnh thoảng trả trang rỗng khi
         bị bắn nhiều yêu cầu cùng lúc — đo thật 18/09: trang 3 rỗng 1 lượt rồi lại bình thường). */
      if (ng === 'tgdd' && !ds.length) trangRongMwg.push(yeuCau[i].url);
      viec = viec.concat(ds);
    });
    if (trangRongMwg.length) {
      var laiMwg = taiNhieu_(trangRongMwg), themMwg = 0;
      laiMwg.forEach(function (r) {
        if (r.ma !== 200) return;
        var ds2 = phanTichTgdd_(r.noiDung);
        themMwg += ds2.length;
        viec = viec.concat(ds2);
      });
      if (dem.tgdd) dem.tgdd.tin += themMwg;
      log.push('gọi lại ' + trangRongMwg.length + ' trang MWG trả rỗng → thêm ' + themMwg + ' tin');
    }

    var khoHong = PropertiesService.getScriptProperties();
    Object.keys(dem).forEach(function (k) {
      var ma = Object.keys(dem[k].ma).map(function (m) { return m + '×' + dem[k].ma[m]; }).join(' ');
      log.push(k + ' ' + dem[k].ok + '/' + dem[k].goi + ' trang [' + ma + '], ' + dem[k].tin + ' tin');
      /* Nguồn hỏng sạch 3 lượt liền thì cho nghỉ, khỏi tốn lượt gọi mỗi lần chạy.
         Tự thử lại sau mỗi 24 giờ (xem boQuaNguon_). */
      var khoa = 'hong::' + k;
      if (dem[k].ok > 0) khoHong.deleteProperty(khoa);
      else {
        var cu = JSON.parse(khoHong.getProperty(khoa) || '{"lan":0}');
        khoHong.setProperty(khoa, JSON.stringify({ lan: (cu.lan || 0) + 1, luc: Date.now() }));
      }
    });

    /* NGUỒN HỎNG THÌ BÙ BẰNG TIN CŨ.
       Sự cố 15/09/2026: vieclam24h và jobsgo cùng hỏng một lượt → bảng tụt 61 xuống 24 việc,
       trong khi những tin đó vẫn còn nguyên trong BỘ NHỚ. Từ nay nguồn nào hỏng sạch thì lấy lại
       tin của chính nguồn đó trong bộ nhớ (trong vòng 7 ngày) để bảng không co lại vì một lượt xui. */
    var TEN_NGUON = {
      vl24h: 'vieclam24h.vn', hoteljob: 'hoteljob.vn', careerviet: 'careerviet.vn',
      jobsgo: 'jobsgo.vn', topcv: 'topcv.vn', tgdd: 'thegioididong.com', congty: 'trang công ty',
      chotot: 'vieclamtot.com'
    };
    Object.keys(dem).forEach(function (k) {
      if (dem[k].ok > 0 || !TEN_NGUON[k]) return;
      var bu = buTuBoNho_(nho, TEN_NGUON[k], 7);
      if (bu.length) {
        viec = viec.concat(bu);
        log.push('BÙ từ bộ nhớ: ' + TEN_NGUON[k] + ' ' + bu.length + ' tin (nguồn đang hỏng)');
      }
    });
    /* Máy chủ tự quét trang tuyển dụng công ty (xem quetTrangCongTy_). Lượt tự động cũng chạy,
       không phụ thuộc Edge đang mở hay không. */
    var vCongTy = [];
    if (cfg.batCongTy && cfg.congTyCaoMoiLuot) {
      try {
        vCongTy = quetTrangCongTy_(ss, cfg, nho, t0);
        viec = viec.concat(vCongTy);
        log.push('trang công ty (máy chủ quét): ' + cfg.congTyCaoMoiLuot + ' công ty → đọc ' +
          vCongTy.length + ' tin mới, ca đêm ' + vCongTy.filter(laCaDem_).length);
      } catch (e) { log.push('quét trang công ty lỗi: ' + e); }
    }

    if (cfg.batFacebook) {
      var fb = nguonFacebook_(ss);
      viec = viec.concat(fb);
      log.push('facebook ' + fb.length + ' bài (tiện ích gửi về)');
    }

    /* --- Bước 2: lấy lại nội dung đã nhớ, chỉ tải chi tiết tin MỚI --- */
    var thoLay = viec.length;
    /* Việc nào chưa từng thấy ở lượt trước thì đánh dấu MỚI — cò chạy mỗi giờ thì thứ đáng xem
       nhất là cái vừa xuất hiện, chứ không phải cả bảng. */
    viec.forEach(function (v) { v.moiThay = !nho[v.id]; });
    viec = gopBoNho_(viec, nho);

    /* hoteljob phải có chi tiết TRƯỚC khi lọc, vì trang danh sách hay ghi "Toàn Quốc";
       MWG cũng vậy: giờ ca chỉ có trong trang chi tiết. Từ 18/09/2026 phải NHỚ lại những tin này
       kể cả khi bị loại — cổng MWG 8 trang là 148 tin, không nhớ thì mỗi giờ đọc lại từ đầu. */
    var daDocTruoc = [];
    if (cfg.layChiTiet) {
      daDocTruoc = viec.filter(function (v) {
        return (v.nguon === 'hoteljob.vn' || v.nguon === 'thegioididong.com') && !v.daChiTiet;
      });
      /* TRẦN mỗi lượt: lượt đầu sau khi mở thêm nguồn có tới 200 tin phải đọc, cộng 60 tin mơ hồ
         và phần quét trang công ty là quá 6 phút của Google (19/09/2026: "Vượt quá thời gian thực
         thi tối đa" → mất trắng cả lượt). Đọc dở thì lượt sau đọc tiếp; tin đã đọc nằm trong BỘ
         NHỚ nên không phải làm lại. Tin mới đăng đọc trước. */
      daDocTruoc.sort(function (a, b) { return (b.dangLuc || 0) - (a.dangLuc || 0); });
      if (daDocTruoc.length > cfg.chiTietMoiLuot) {
        log.push('còn ' + (daDocTruoc.length - cfg.chiTietMoiLuot) + ' tin chi tiết để lượt sau đọc tiếp');
        daDocTruoc = daDocTruoc.slice(0, cfg.chiTietMoiLuot);
      }
      layChiTietHangLoat_(daDocTruoc, t0);
      log.push('đọc chi tiết trước khi lọc: ' + daDocTruoc.length + ' tin (hoteljob + MWG)');
    }

    /* Việc MWG nào đã chắc là ca đêm thì hỏi thêm TOẠ ĐỘ nơi làm (xem viTriMwgHangLoat_):
       một lượt gọi mỗi việc, đổi lại không còn con số "9,3 km" giả và không tốn lượt geocode.
       Tin đã có toạ độ/số km trong BỘ NHỚ thì khỏi hỏi lại. */
    var canViTri = viec.filter(function (v) {
      return v.nguon === 'thegioididong.com' && !v.lat && v.kmOto == null && laCaDem_(v);
    });
    if (canViTri.length) {
      var xongViTri = viTriMwgHangLoat_(canViTri, goc, t0);
      log.push('MWG: hỏi nơi làm ' + canViTri.length + ' việc ca đêm → có toạ độ ' + xongViTri);
    }

    /* ĐỌC KỸ TIN MƠ HỒ (16/09/2026) — lý do bảng "chưa đa dạng":
       Với vieclam24h/careerviet, trang danh sách không có phần mô tả, nên bộ lọc ca đêm chỉ còn
       bám vào TIÊU ĐỀ. Tin "Bảo vệ", "Nhân viên kho", "Phục vụ" ghi "ca 22h-6h" trong mô tả bị
       loại oan hết → bảng chỉ còn những tin có chữ "đêm" ngay trên tiêu đề (toàn lễ tân khách sạn).
       Đo 16/09: 403 tin thô → 193 tin mơ hồ (gần, không telesale, tiêu đề không có chữ đêm);
       đọc thử 45 tin thì 14 tin là ca đêm thật (31%). Nay đọc chi tiết những tin đó (mới nhất
       trước, có trần mỗi lượt) rồi mới lọc; tin đã đọc — kể cả bị loại — đều ghi vào BỘ NHỚ để
       lượt sau không phải đọc lại. */
    var daDocKy = [];
    if (cfg.layChiTiet && cfg.docKyToiDa > 0) {
      var moHo = chonTinMoHo_(viec, cfg, goc).slice(0, cfg.docKyToiDa);
      if (moHo.length) {
        layChiTietHangLoat_(moHo, t0);
        daDocKy = moHo.filter(function (v) { return v.daChiTiet; });
        var themDem = daDocKy.filter(laCaDem_).length;
        log.push('đọc kỹ ' + daDocKy.length + '/' + moHo.length + ' tin mơ hồ → thêm ' + themDem + ' việc ca đêm');
      }
    }
    viec = locVaXep_(viec, cfg, goc);
    var sauLoc = viec.length;
    if (viec.boTelesale) log.push('bỏ ' + viec.boTelesale + ' việc telesale');
    if (viec.boCu) log.push('bỏ ' + viec.boCu + ' tin quá ' + cfg.tinTrongNgay + ' ngày');
    viec = viec.slice(0, cfg.toiDa);
    if (cfg.layChiTiet) {
      var can = viec.filter(function (v) { return !v.daChiTiet; });
      /* Cùng trần với đợt 1: sau khi đổi PHIEN_BAN thì cả bảng đều "chưa đọc", đọc hết trong một
         lượt là vỡ 6 phút. Đọc dần, tin vẫn hiển thị bằng nội dung cũ trong lúc chờ. */
      if (can.length > cfg.chiTietMoiLuot) can = can.slice(0, cfg.chiTietMoiLuot);
      layChiTietHangLoat_(can, t0);
      log.push('chi tiết: đọc mới ' + can.length + ', dùng lại từ bộ nhớ ' + (viec.length - can.length));
    }

    /* --- Bước 2b: tin tiếng Anh thì dịch sang tiếng Việt --- */
    if (cfg.dichTiengAnh) {
      var soDich = 0;
      viec.forEach(function (v) {
        if (hetGio_(t0)) return;
        var ten = dichSangViet_(v.ten);
        if (ten !== v.ten) { v.ten = ten; soDich++; }
        v.chiTiet = dichSangViet_(v.chiTiet);
        v.yeuCau = dichSangViet_(v.yeuCau);
      });
      log.push('dịch tiếng Anh: ' + soDich + ' tiêu đề');
    }

    /* --- Bước 3: đo đường (chỉ tin chưa có số km trong bộ nhớ) --- */
    var doMoi = 0, thieuDo = 0, moHoKm = 0;
    viec.forEach(function (v) {
      if (v.kmOto != null) return;
      /* Địa chỉ chỉ ghi tên tỉnh/thành thì ĐỪNG đo — xem diaChiMoHo_. Để trống số km, gắn cờ. */
      if (!v.lat && diaChiMoHo_(v.diaChi)) { v.chuaRoKm = true; moHoKm++; return; }
      if (hetGio_(t0)) { thieuDo++; return; }
      try { v.kmOto = kmOto_(goc, v); doMoi++; } catch (e) { v.kmOto = null; }
    });
    log.push('đo đường mới ' + doMoi + (thieuDo ? ', hết giờ nên bỏ ' + thieuDo : '') +
      (moHoKm ? ', ' + moHoKm + ' tin địa chỉ mơ hồ nên không đo' : ''));
    
    var demBK = {};
    viec = apBanKinh_(viec, cfg, demBK);
    log.push('bán kính ' + cfg.banKinh + ' km (nới ' + cfg.noiThem + '): bỏ ' + demBK.bo +
      ' tin quá ' + (Number(cfg.banKinh) + Number(cfg.noiThem)) + ' km · giữ ' + demBK.ria +
      ' tin ở rìa · ' + demBK.chuaRo + ' tin chưa đo được (xếp cuối)');

    xepThuTu_(viec, cfg);
    var soMoi = viec.filter(function (v) { return v.moiThay; }).length;
    log.push('thô ' + thoLay + ' → lọc còn ' + sauLoc + ' → ghi ' + viec.length + ' (MỚI: ' + soMoi + ')');
    log.push(tomTatDaDang_(viec));

    if (!viec.length) {
      ghiNhatKy_(ss, kieu, 'GIỮ BẢNG CŨ (không lấy được tin nào)', log, t0, 0);
      bao_('Không lấy được tin nào — bảng cũ giữ nguyên. Xem tab NHẬT KÝ để biết nguồn nào hỏng.');
      return;
    }

    ghiBang_(ss, viec);
    ghiBoNho_(ss, viec, nho, cfg,
      daDocKy.concat(daDocTruoc.filter(function (v) { return v.daChiTiet; })).concat(vCongTy));
    PropertiesService.getScriptProperties().setProperty('lan_chay_cuoi',
      Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm') + ' (' + kieu + ', ' + viec.length + ' việc, ' + Math.round((Date.now() - t0) / 1000) + 's)');
    /* Chưa có cò tự động thì tự bật luôn sau lượt chạy tay thành công — không bắt user mò menu.
       Bài học 15/09/2026: 7 lượt chạy đều là bấm tay, không lượt nào tự động, vì cò chưa được bật. */
    if (kieu !== 'lịch tự động') {
      try {
        var coRoi = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === TEN_HAM_LICH; });
        if (!coRoi) {
          ScriptApp.newTrigger(TEN_HAM_LICH).timeBased().everyHours(cfg.moiMayGio).create();
          log.push('đã TỰ BẬT cò: mỗi ' + cfg.moiMayGio + ' giờ tự cào');
        }
      } catch (e) { log.push('không tự bật được cò: ' + e); }
    }
    ghiNhatKy_(ss, kieu, 'OK', log, t0, viec.length);
    bao_('Xong sau ' + Math.round((Date.now() - t0) / 1000) + ' giây: ' + viec.length + ' việc.\n\n' +
      'Tiện ích Facebook sẽ nhận lệnh trong vòng 3 phút, gom nhóm rồi tự gộp lại bảng — ' +
      'không phải bấm gì thêm. (Cần Edge đang mở và tiện ích đã bật "Nghe lệnh từ bảng tính".)');
  } catch (e) {
    ghiNhatKy_(ss, kieu, 'LỖI: ' + e, log, t0, 0);
    throw e;
  } finally {
    khoa.releaseLock();
  }
}

/* ====================== TẢI SONG SONG ====================== */

/**
 * Gọi nhiều URL cùng lúc. Đây là chỗ ăn thời gian nhất của bản 1 (gọi lần lượt, mỗi lần
 * 1-3 giây). fetchAll gọi song song nên 40 trang vẫn chỉ mất vài giây.
 * Lô nào vỡ (1 URL chết kéo cả lô) thì hạ xuống gọi lẻ đúng lô đó, không mất cả lượt.
 */
function taiNhieu_(urls) {
  var ra = motLuotTai_(urls);

  /* Thử lại MỘT lần cho các địa chỉ hỏng, sau khi nghỉ 4 giây.
     Lý do (15/09/2026): lượt 8h45 vieclam24h trả hỏng cả 10 trang trong khi ngay sau đó gọi tay
     vẫn 200 — bắn 15 yêu cầu cùng lúc dễ bị trang chủ chặn nhịp. Nghỉ rồi gọi lại thường là qua. */
  /* Chỉ thử lại với lỗi TẠM THỜI. Trang đã chặn hẳn (403/404) thì gọi lại chỉ tốn thời gian:
     lượt 10h36 mất thêm 5 lượt gọi cho jobsgo dù nó trả 403 cả 5 trang. */
  var TAM_THOI = { 0: 1, 408: 1, 425: 1, 429: 1, 500: 1, 502: 1, 503: 1, 504: 1 };
  var hong = [];
  ra.forEach(function (r, i) { if (r.ma !== 200 && TAM_THOI[r.ma]) hong.push(i); });
  if (hong.length) {
    Utilities.sleep(4000);
    var lai = motLuotTai_(hong.map(function (i) { return ra[i].url; }));
    hong.forEach(function (i, k) { if (lai[k] && lai[k].ma === 200) ra[i] = lai[k]; });
  }
  return ra;
}

/**
 * Xếp xen kẽ các tên miền: mỗi lô 12 địa chỉ nhưng KHÔNG dồn 12 lượt vào cùng một trang.
 * Bắn 10 lượt liền vào vieclam24h là cách chắc chắn nhất để bị chặn nhịp (đã cắn 15/09).
 */
function xenKeTenMien_(ds) {
  var theo = {}, thuTu = [];
  ds.forEach(function (o) {
    var m = String(o.url).match(/^https?:\/\/([^/]+)/);
    var d = m ? m[1] : 'khac';
    if (!theo[d]) { theo[d] = []; thuTu.push(d); }
    theo[d].push(o);
  });
  var ra = [], con = true;
  while (con) {
    con = false;
    thuTu.forEach(function (d) { if (theo[d].length) { ra.push(theo[d].shift()); con = true; } });
  }
  return ra;
}

/** Gọi song song theo lô, giữa các lô nghỉ một nhịp cho đỡ dồn cục. */
function motLuotTai_(urls) {
  /* TRẢ VỀ ĐÚNG THỨ TỰ ĐÃ NHẬN.
     Bẫy đã cắn ngay khi thêm phần xen kẽ tên miền (15/09/2026): xáo địa chỉ để gọi cho đều
     nhưng trả kết quả theo thứ tự đã xáo → trang của hoteljob bị đưa cho bộ bóc của careerviet,
     bốn nguồn cùng lúc "200 nhưng 0 tin". Nên mỗi địa chỉ phải mang theo số thứ tự gốc. */
  var ra = new Array(urls.length);
  var danhSo = urls.map(function (u, i) { return { url: u, i: i }; });
  var xep = xenKeTenMien_(danhSo);
  var LO = 12;
  var boQuaGio = 0;
  for (var i = 0; i < xep.length; i += LO) {
    /* Hết ngân sách thì BỎ phần còn lại (trả mã 0) — thà thiếu tin còn hơn bị Google giết giữa
       chừng và mất trắng cả lượt (19/09/2026: "Vượt quá thời gian thực thi tối đa").
       Nguồn thiếu sẽ được bù lại từ BỘ NHỚ y như nguồn hỏng. */
    if (!conGioTai_()) {
      for (var bq = i; bq < xep.length; bq++) {
        ra[xep[bq].i] = { url: xep[bq].url, ma: 0, noiDung: '', loi: 'hết ngân sách thời gian' };
        boQuaGio++;
      }
      break;
    }
    if (i) Utilities.sleep(1200);
    var lo = xep.slice(i, i + LO);
    var ycs = lo.map(function (o) { return { url: o.url, muteHttpExceptions: true, followRedirects: true, headers: HEADER_ }; });
    try {
      var kq = UrlFetchApp.fetchAll(ycs);
      kq.forEach(function (r, j) {
        ra[lo[j].i] = { url: lo[j].url, ma: r.getResponseCode(), noiDung: r.getContentText() };
      });
    } catch (e) {
      lo.forEach(function (o) {
        try { var r2 = tai_(o.url); ra[o.i] = { url: o.url, ma: r2.ma, noiDung: r2.noiDung }; }
        catch (e2) { ra[o.i] = { url: o.url, ma: 0, noiDung: '', loi: String(e2) }; }
      });
    }
  }
  return ra;
}

var HEADER_ = { 'Accept-Language': 'vi-VN,vi;q=0.9', 'Accept': 'text/html,application/xhtml+xml' };

function tai_(url) {
  var r = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true, headers: HEADER_ });
  return { ma: r.getResponseCode(), noiDung: r.getContentText() };
}

/** Nguồn hỏng sạch từ 3 lượt liền và mới hỏng trong vòng 24 giờ thì tạm cho nghỉ. */
function boQuaNguon_(nguon) {
  var t = PropertiesService.getScriptProperties().getProperty('hong::' + nguon);
  if (!t) return false;
  var o = JSON.parse(t);
  if ((o.lan || 0) < 3) return false;
  return (Date.now() - (o.luc || 0)) < 24 * 3600 * 1000;
}

/* ====================== CÔNG TY THEO DÕI — tìm theo TÊN trên các trang việc làm ======================
 * User chốt 15/09/2026: công ty nào web tuyển dụng chết/không vào được thì KHÔNG loại, phải mò đường
 * khác. Đường chắc nhất: công ty vẫn đăng tin trên vieclam24h / careerviet / hoteljob → tìm theo tên.
 * Xoay vòng vài tên mỗi lượt để không phình số lượt gọi (cò chạy mỗi giờ).
 */
var COT_NGUONCT = ['Tên công ty (cò tìm theo tên trên vieclam24h, careerviet, hoteljob)',
  'Trang tuyển dụng (tiện ích mở từng việc)', 'Facebook page (tiện ích đọc bài)', 'Ghi chú'];

/* MỘT bảng cho mọi công ty: có trang tuyển dụng thì điền cột B, có Facebook page thì cột C, chỉ cần
   cột A là cò đã tìm theo tên trên 3 trang việc làm. Dò 40 địa chỉ ngày 15/09/2026: 15 trang sống
   (cột B), số còn lại web chết/không vào được → đi đường tên + Facebook page (page đoán theo tên
   thường dùng, sai thì tiện ích đọc 0 bài rồi tự bỏ qua sau 3 lượt). */
var NGUONCT_MAC_DINH = [
  ['Thế Giới Di Động / Điện Máy Xanh', 'https://vieclam.thegioididong.com/tuyen-dung?kv=thanh-pho-ho-chi-minh', '', 'có sẵn cả ở nguồn riêng'],
  ['Bách Hoá Xanh', 'https://vieclam.bachhoaxanh.com/', '', 'đã có sẵn ở nguồn MWG (8 trang)'],
  ['Kingfoodmart', 'https://tuyendung.kingfoodmart.com/', '', 'web JavaScript, chỉ tiện ích đọc được'],
  ['WinMart', 'https://tuyendung.winmart.vn/', '', ''],
  ['Circle K', 'https://www.circlek.com.vn/vi/co-hoi-nghe-nghiep-circle-k/', '', 'cửa hàng 24h'],
  ['MM Mega Market', 'https://mmvietnam.com/tuyen-dung/', '', 'ca đêm nhận hàng'],
  ['AEON', 'https://tuyendung.aeon.com.vn/', '', 'web JavaScript, chỉ tiện ích đọc được'],
  ['Saigon Co.op / Co.opmart', 'https://tuyendung.saigonco-op.com.vn/viec-lam/tat-ca-viec-lam/vi', '', 'cổng tuyển dụng thật (trang cũ là vỏ JavaScript)'],
  ['FPT Shop / Long Châu', 'https://tuyendung.frt.vn/', '', ''],
  ['KFC', 'https://tuyendung.kfcvietnam.com.vn/', '', 'ca tối muộn'],
  ['Lotteria', 'https://www.lotteria.vn/tuyen-dung', '', 'web JavaScript'],
  ['Jollibee', 'https://jollibee.com.vn/tuyen-dung', '', ''],
  ['Galaxy Cinema', 'https://www.galaxycine.vn/tuyen-dung/', '', 'suất chiếu đêm'],
  ['Giao Hàng Tiết Kiệm', 'https://ghtk.vn/tuyen-dung/', '', 'kho phân loại đêm'],
  ['Shopee Express', 'https://spx.vn/careers', '', 'kho phân loại đêm, web JavaScript'],
  ['Highlands Coffee', '', 'https://www.facebook.com/highlandscoffeevietnam', 'web tuyển dụng 404 (15/09/2026)'],
  ['Phúc Long', '', 'https://www.facebook.com/PhucLongCoffeeandTea', 'web tuyển dụng 404'],
  ['GS25', '', 'https://www.facebook.com/GS25vietnam', 'web tuyển dụng 404'],
  ['7-Eleven', '', 'https://www.facebook.com/7ElevenVietnam', 'web tuyển dụng 404'],
  ['The Coffee House', '', 'https://www.facebook.com/The.Coffee.House.2014', 'web đá về trang chủ'],
  ["McDonald's", '', 'https://www.facebook.com/McDonaldsVN', 'web đá về trang chủ'],
  ['Ninja Van', '', 'https://www.facebook.com/NinjaVanVN', 'web tuyển dụng 404'],
  ['Giao Hàng Nhanh', '', 'https://www.facebook.com/GHNExpress', 'không kết nối được web'],
  ['J&T Express', '', 'https://www.facebook.com/JTExpressVN', 'không kết nối được web'],
  ['Grab', '', 'https://www.facebook.com/GrabVN', 'không kết nối được web'],
  ['Pharmacity', '', 'https://www.facebook.com/Pharmacity.vn', 'không kết nối được web'],
  ['Lotte Mart', '', 'https://www.facebook.com/LotteMartVietnam', 'không kết nối được web'],
  ['Viettel Post', '', 'https://www.facebook.com/ViettelPostOfficial', 'không kết nối được web'],
  ['Petrolimex Sài Gòn', '', '', 'không kết nối được web — cây xăng 24h'],
  ['Bảo vệ Long Hải', '', 'https://www.facebook.com/baovelonghai', 'không kết nối được web'],
  ['Vinpearl', '', 'https://www.facebook.com/Vinpearl', 'web tuyển dụng 404 — khách sạn'],
  ['Mường Thanh', '', 'https://www.facebook.com/muongthanhhospitality', 'web tuyển dụng 404 — khách sạn'],
  ['CGV', '', 'https://www.facebook.com/cgvcinemavietnam', 'web tuyển dụng 404 — rạp phim'],
  ['Lotte Cinema', '', 'https://www.facebook.com/lottecinemavn', 'web báo lỗi — rạp phim'],
  ['Saigontourist', '', '', 'web tuyển dụng 404 — khách sạn']
];

/** Đọc bảng NGUỒN CÔNG TY (tạo + gieo sẵn nếu chưa có). Trả về [{ten, trang, fb}]. */
/* Đo 18/09/2026 (scratchpad/do-trang-congty.mjs, 50 địa chỉ): nhiều trang trong danh sách đã đổi
   đường hoặc chỉ là vỏ JavaScript. Bảng dưới đây để nút "Cập nhật danh sách nguồn công ty" sửa
   ĐÚNG những ô còn giữ giá trị cũ — ô nào user đã tự sửa thì không đụng vào. */
var NGUONCT_SUA_ = [
  ['https://saigonco-op.com.vn/tuyen-dung', 'https://tuyendung.saigonco-op.com.vn/viec-lam/tat-ca-viec-lam/vi'],
  ['https://www.circlek.com.vn/vi/co-hoi-nghe-nghiep-circle-k/', 'https://www.circlek.com.vn/tuyen-dung'],
  ['https://vieclam.bachhoaxanh.com/', 'https://vieclam.bachhoaxanh.com/tuyen-dung'],
  ['https://www.galaxycine.vn/tuyen-dung/', '']   /* không kết nối được từ máy chủ Google */
];
/* Nơi đã đo là ĐỌC ĐƯỢC bằng máy chủ (có link tin việc trong HTML thô) mà danh sách chưa có. */
var NGUONCT_THEM_ = [
  ['Nutifood', 'https://tuyendung.nutifood.com.vn/viec-lam/tat-ca-viec-lam/vi', '', 'nhà máy, có ca sản xuất'],
  ['Bệnh viện Tâm Anh', 'https://tamanhhospital.vn/tuyen-dung/vi-tri-tuyen-dung/', '', 'điều dưỡng trực đêm'],
  ['Bệnh viện Hoàn Mỹ', 'https://hoanmy.com/career/vi/', '', 'điều dưỡng trực đêm'],
  ['AEON Mall', 'https://aeonmall-vietnam.com/vi/tuyen-dung/', '', 'trung tâm thương mại'],
  ['J&T Express', 'https://jtexpress.vn/vi/tuyen-dung', '', 'kho phân loại đêm'],
  ['Sotrans / Kho vận Miền Nam', 'https://sotrans.com.vn/vi/career', '', 'kho vận'],
  ['MM Mega Market', 'https://mmvietnam.com/tuyen-dung/', '', 'siêu thị bán sỉ, ca đêm nhận hàng']
];

/**
 * Nút menu: sửa URL đã chết và thêm nơi mới vào tab NGUỒN CÔNG TY.
 * Không ghi đè ô user đã tự sửa (chỉ đổi ô còn đúng giá trị cũ), không thêm trùng.
 */
function capNhatNguonCongTy() {
  var ss = bang_();
  var sh = ss.getSheetByName(TAB_NGUONCT);
  if (!sh) { docNguonCongTy_(ss); sh = ss.getSheetByName(TAB_NGUONCT); }
  var d = sh.getDataRange().getValues();
  var sua = 0, them = [];
  for (var i = 1; i < d.length; i++) {
    var u = String(d[i][1] || '').trim();
    if (!u) continue;
    for (var k = 0; k < NGUONCT_SUA_.length; k++) {
      if (u === NGUONCT_SUA_[k][0] && u !== NGUONCT_SUA_[k][1]) {
        sh.getRange(i + 1, 2).setValue(NGUONCT_SUA_[k][1]);
        sua++;
      }
    }
  }
  var dangCo = {};
  d.forEach(function (r) {
    if (r[0]) dangCo[khongDau_(String(r[0]).trim()).toLowerCase()] = 1;
  });
  NGUONCT_THEM_.forEach(function (r) {
    if (!dangCo[khongDau_(r[0]).toLowerCase()]) them.push(r);
  });
  if (them.length) sh.getRange(sh.getLastRow() + 1, 1, them.length, 4).setValues(them);
  bao_('Danh sách nguồn công ty: sửa ' + sua + ' địa chỉ đã đổi, thêm ' + them.length + ' nơi mới.\n\n' +
    'Lượt cào sau sẽ tự quét theo danh sách mới (mỗi lượt vài công ty, xoay vòng).');
}

function docNguonCongTy_(ss) {
  var sh = ss.getSheetByName(TAB_NGUONCT);
  if (!sh) {
    sh = ss.insertSheet(TAB_NGUONCT);
    sh.getRange(1, 1, 1, 4).setValues([COT_NGUONCT])
      .setBackground('#1c4587').setFontColor('#ffffff').setFontWeight('bold').setWrap(true);
    sh.setColumnWidth(1, 220); sh.setColumnWidth(2, 380); sh.setColumnWidth(3, 340); sh.setColumnWidth(4, 300);
    sh.getRange(2, 1, NGUONCT_MAC_DINH.length, 4).setValues(NGUONCT_MAC_DINH);
    sh.getRange(NGUONCT_MAC_DINH.length + 3, 1).setValue(
      'Thêm công ty: gõ tên vào cột A là đủ để cò tìm theo tên. Có trang tuyển dụng thì dán cột B, có Facebook page thì dán cột C.');
    sh.setFrozenRows(1);
  }
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues()
    .map(function (r) { return { ten: String(r[0] || '').trim(), trang: String(r[1] || '').trim(), fb: String(r[2] || '').trim() }; })
    .filter(function (c) { return c.ten.length >= 2 || c.trang.indexOf('http') === 0 || c.fb.indexOf('http') === 0; })
    .slice(0, 120);
}

/** Tên + Facebook page để tìm theo tên và đọc page. */
function docCongTyTheoDoi_(ss) {
  return docNguonCongTy_(ss).filter(function (c) { return c.ten.length >= 2; });
}

/** Mỗi lượt lấy vài tên (xoay vòng), dựng địa chỉ tìm trên 3 trang việc làm đang chạy tốt. */
function yeuCauTheoTenCongTy_(ss, cfg) {
  var ds = docCongTyTheoDoi_(ss);
  if (!ds.length) return [];
  var kho = PropertiesService.getScriptProperties();
  var moiLuot = Math.max(1, cfg.congTyMoiLuot || 5);
  var bd = Number(kho.getProperty('xoay_congty') || 0) % ds.length;
  var chon = [];
  for (var i = 0; i < Math.min(moiLuot, ds.length); i++) chon.push(ds[(bd + i) % ds.length]);
  kho.setProperty('xoay_congty', String((bd + chon.length) % ds.length));

  var ra = [];
  chon.forEach(function (c) {
    ra.push({ nguon: 'vl24h', url: 'https://vieclam24h.vn/tim-kiem-viec-lam-nhanh?q=' + encodeURIComponent(c.ten), congTy: c.ten });
    ra.push({ nguon: 'careerviet', url: 'https://careerviet.vn/viec-lam/' + khongDauGach_(c.ten) + '-k-vi.html', congTy: c.ten });
    ra.push({ nguon: 'hoteljob', url: 'https://www.hoteljob.vn/tim-viec?keyword=' + encodeURIComponent(c.ten) + '&city_id=3', congTy: c.ten });
  });
  ra.tenChon = chon.map(function (c) { return c.ten; });
  return ra;
}

/* ====================== NGUỒN 1: vieclam24h.vn ====================== */

function phanTichVl24hDanhSach_(html) {
  var d = jsonNextData_(html);
  try { return d.props.initialState.api.getJobList.data.items || []; } catch (e) { return []; }
}

function chuanHoaVl24h_(it) {
  var noi = (it.places && typeof it.places === 'string') ? JSON.parse(it.places) : (it.places || []);
  var diem = (noi && noi[0]) || {};
  var ntd = it.employer_info || {};
  var field = (it.field_ids_main && it.field_ids_main[0]) || (it.occupation_ids_main && it.occupation_ids_main[0]) || 0;
  var prov = (it.province_ids && it.province_ids[0]) || 0;
  return tin_({
    nguon: 'vieclam24h.vn',
    id: 'vl24h-' + it.id,
    ten: (it.title || '').trim(),
    luong: dinhDangLuong_(it.salary_min, it.salary_max),
    diaChi: (it.contact_address || diem.address || '').trim(),
    lat: diem.lat || null,
    lng: diem.lng || null,
    ntd: (ntd.name || '').trim(),
    dangLuc: it.approved_at || it.updated_at || it.refresh_at || it.created_at || 0,
    link: 'https://vieclam24h.vn/viec-lam/' + (it.title_slug || 'tin') + '-c' + field + 'p' + prov + 'id' + it.id + '.html',
    luongMin: it.salary_min || 0
  });
}

function phanTichVl24hChiTiet_(v, html) {
  var j = {};
  try { j = jsonNextData_(html).props.initialState.api.jobDetailHiddenContact.data || {}; } catch (e) { j = {}; }
  v.chiTiet = catChu_(gachDauDong_(boHtmlDong_(j.description_html || j.description || '')), 450);
  v.yeuCau = catChu_(gachDauDong_(boHtmlDong_([j.other_requirement_html || j.other_requirement || '',
    j.resume_requirement_html || j.resume_requirement || ''].join('<br>'))), 320);
  if (!v.luong || v.luong === 'Thoả thuận') v.luong = dinhDangLuong_(j.salary_min, j.salary_max);
  if (!v.diaChi) v.diaChi = (j.contact_address || '').trim();
  if (!v.dangLuc) v.dangLuc = kepMoc_(j.approved_at || j.updated_at || j.created_at || 0);
  /* Giờ ca hay nằm ở phần quyền lợi/ghi chú chứ không phải mô tả — gom lại để dò giờ. */
  v.chuThem = catChu_(boHtmlDong_([j.benefit_html || j.benefit || '',
    j.other_requirement_html || j.other_requirement || ''].join(' ')), 700);
}

/* ====================== NGUỒN 2: hoteljob.vn ====================== */

function phanTichHoteljob_(html) {
  var ra = [], m;
  var re = /<h3>\s*<a class="text-red" href="\/viec-lam\/(\d+)-([a-z0-9\-]+)"[^>]*title="([^"]*)"/g;
  while ((m = re.exec(html)) !== null) {
    var sau = html.substr(m.index, 2600);
    ra.push(tin_({
      nguon: 'hoteljob.vn',
      id: 'htj-' + m[1],
      ten: boHtml_(m[3]).trim(),
      luong: ((sau.match(/icon-Muc-luong[^>]*>\s*<\/i>\s*([^<]{1,80})/) || [])[1] || '').trim() || 'Thoả thuận',
      diaChi: boHtml_((sau.match(/icon-map[\s\S]{0,600}?title="([^"]{2,200})"/) || [])[1] || '').trim(),
      ntd: ((sau.match(/class="hotel-name"[^>]*>([^<]{2,120})</) || [])[1] || '').trim(),
      link: 'https://www.hoteljob.vn/viec-lam/' + m[1] + '-' + m[2]
    }));
  }
  return ra;
}

function phanTichHoteljobChiTiet_(v, html) {
  var khoi = function (ten) {
    var re = new RegExp('h2-detail-title[^>]*>\\s*' + ten + '\\s*<\\/h2>\\s*<div class="htj-content[^"]*">([\\s\\S]*?)<\\/div>');
    return boHtmlDong_((html.match(re) || [])[1] || '');
  };
  v.chiTiet = catChu_(gachDauDong_(khoi('Mô tả công việc')), 450);
  v.yeuCau = catChu_(gachDauDong_([khoi('Yêu cầu công việc'), khoi('Yêu cầu hồ sơ')].filter(String).join('\n')), 450);

  var noi = (html.match(/icon-Noi-lam-viec[\s\S]{0,400}?<strong>Nơi làm việc<\/strong>\s*<br\s*\/?>([\s\S]{0,400}?)<\/div>/) || [])[1] || '';
  noi = boHtml_(noi).replace(/\s*,\s*$/, '');
  if (noi) v.diaChi = noi;

  var c = html.match(/icon-Han-nop[\s\S]{0,400}?text-muted">\s*(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (c) v.dangLuc = kepMoc_(Math.round(new Date(+c[3], +c[2] - 1, +c[1], +(c[4] || 0), +(c[5] || 0)).getTime() / 1000));
}

/* ====================== NGUỒN 3: careerviet.vn ====================== */

function phanTichCareerviet_(html) {
  var ra = [], m, thay = {};
  /* Mỗi thẻ việc có 2 thẻ <a class="job_link"> (một ở tiêu đề, một bọc lương/nơi làm),
     nên lấy thẻ đầu rồi cắt một khoảng phía sau để đọc các trường còn lại. */
  var re = /<a class="job_link"[^>]*data-id="([A-Z0-9]+)"[^>]*title="([^"]*)"[^>]*href="([^"]+)"/g;
  while ((m = re.exec(html)) !== null) {
    if (thay[m[1]]) continue;
    thay[m[1]] = 1;
    var the = html.substr(m.index, 2500);
    var a = [null, m[2], m[3]];
    ra.push(tin_({
      nguon: 'careerviet.vn',
      id: 'cv-' + m[1],
      ten: boHtml_(a[1]).trim(),
      luong: boHtml_((the.match(/<div class="salary">([\s\S]{0,200}?)<\/div>/) || [])[1] || '')
        .replace(/^Lương\s*:?\s*/i, '').trim() || 'Thoả thuận',
      diaChi: boHtml_((the.match(/<div class="location">([\s\S]{0,300}?)<\/div>/) || [])[1] || '')
        .replace(/^[•\s]+/, '').replace(/\s*•\s*/g, ', ').trim(),
      ntd: boHtml_((the.match(/class="company-name"[^>]*title="([^"]*)"/) || [])[1] || '').trim(),
      dangLuc: ngayVnSangGiay_((the.match(/Cập nhật[\s\S]{0,60}?<time>(\d{2})-(\d{2})-(\d{4})<\/time>/) || []).slice(1)),
      link: a[2].indexOf('http') === 0 ? a[2] : 'https://careerviet.vn' + a[2]
    }));
  }
  return ra;
}

/* ====================== NGUỒN 4: topcv.vn ====================== */

function phanTichTopcv_(html) {
  var ra = [], m;
  var re = /data-job-id="(\d+)"[\s\S]{0,600}?href="(https:\/\/www\.topcv\.vn\/viec-lam\/[^"?]+)[^"]*"/g;
  var thay = {};
  while ((m = re.exec(html)) !== null) {
    if (thay[m[1]]) continue;
    thay[m[1]] = 1;
    var the = html.substr(m.index, 6000);
    var ten = (the.match(/<span data-toggle="tooltip"[^>]*title="([^"]{4,200})"/) || [])[1] || '';
    ra.push(tin_({
      nguon: 'topcv.vn',
      id: 'tcv-' + m[1],
      ten: boHtml_(ten).trim(),
      luong: boHtml_((the.match(/class="title-salary">([^<]{1,60})</) || [])[1] || '').trim() || 'Thoả thuận',
      diaChi: boHtml_((the.match(/class="city-text">([^<]{2,120})</) || [])[1] || '').trim(),
      ntd: boHtml_((the.match(/class="company-name"[^>]*title="([^"]{2,160})"/) || [])[1] || '').trim(),
      dangLuc: chuTruocSangGiay_((the.match(/label-update[^>]*>[\s\S]{0,120}?Đăng\s*<\/span>\s*([^<]{2,30})</) || [])[1] || ''),
      link: m[2]
    }));
  }
  return ra;
}

/* ====================== NGUỒN 5: jobsgo.vn ====================== */

function phanTichJobsgo_(html) {
  var ra = [], m, thay = {};
  var re = /<h3 class="job-title[^>]*>\s*<a href="(https:\/\/jobsgo\.vn\/viec-lam\/[^"?]+)[^"]*"[^>]*title="([^"]*)"/g;
  while ((m = re.exec(html)) !== null) {
    var id = (m[1].match(/-(\d+)\.html/) || [])[1] || m[1];
    if (thay[id]) continue;
    thay[id] = 1;
    var the = html.substr(m.index, 2600);
    /* dòng "Thỏa thuận | Hồ Chí Minh" — tách bằng dấu gạch đứng */
    var doi = boHtml_((the.match(/text-primary fw-semibold[^>]*>([\s\S]{0,400}?)<\/div>/) || [])[1] || '').split('|');
    ra.push(tin_({
      nguon: 'jobsgo.vn',
      id: 'jg-' + id,
      ten: boHtml_(m[2]).trim(),
      luong: (doi[0] || '').trim() || 'Thoả thuận',
      diaChi: (doi[1] || '').trim(),
      ntd: boHtml_((the.match(/class="[^"]*company-title"[^>]*title="([^"]{2,160})"/) || [])[1] || '').trim(),
      dangLuc: chuTruocSangGiay_((the.match(/title="Thời gian cập nhật"[^>]*>([^<]{2,150})</) || [])[1] || ''),
      link: m[1]
    }));
  }
  return ra;
}

/* ====================== NGUỒN 6: vieclam.thegioididong.com ====================== */

/**
 * Trang tuyển dụng riêng của Thế Giới Di Động. Tin ở đây KHÔNG lên các trang việc làm khác,
 * và thường không viết chữ "ca đêm" mà chỉ ghi giờ ca — nên phải đọc trang chi tiết rồi mới lọc.
 */
var URL_MWG = 'https://vieclam.thegioididong.com/tuyen-dung';
function phanTichTgdd_(html) {
  var ra = [], m, thay = {};
  var re = /<div class="job_box">\s*<a href="(\/tuyen-dung\/[a-z0-9\-]+-(\d+))"[\s\S]{0,1800}?<\/div>\s*<\/a>/g;
  while ((m = re.exec(html)) !== null) {
    if (thay[m[2]]) continue;
    thay[m[2]] = 1;
    var the = m[0];
    var o = [];
    var reLi = /<li class="info_box">([^<]{1,120})<\/li>/g, k;
    while ((k = reLi.exec(the)) !== null) o.push(boHtml_(k[1]).trim());
    var luong = o.filter(function (x) { return /triệu|tr\b|thỏa thuận|thoả thuận|đ\b/i.test(x); })[0] || 'Thoả thuận';
    var noi = o.filter(function (x) { return /(thành phố|tỉnh|hồ chí minh|hà nội|toàn quốc)/i.test(x); })[0] || '';
    var tenMwg = boHtml_((the.match(/<h3>([\s\S]{2,200}?)<\/h3>/) || [])[1] || '').trim();
    ra.push(tin_({
      nguon: 'thegioididong.com',
      id: 'tgdd-' + m[2],
      ten: tenMwg,
      luong: luong,
      diaChi: noi,
      /* Cổng chung cả nhà MWG nên KHÔNG dán cứng "Thế Giới Di Động / Điện Máy Xanh" nữa —
         việc của Bách Hoá Xanh phải ghi đúng Bách Hoá Xanh. */
      ntd: thuongHieuMwg_(tenMwg),
      link: 'https://vieclam.thegioididong.com' + m[1]
    }));
  }
  return ra;
}

/** Suy thương hiệu từ tên việc — cổng vieclam.thegioididong.com đăng chung cho cả nhà MWG. */
function thuongHieuMwg_(ten) {
  var k = khongDau_(ten || '');
  if (k.indexOf('bach hoa xanh') >= 0 || /(^| )bhx( |$)/.test(k)) return 'Bách Hoá Xanh (MWG)';
  if (k.indexOf('an khang') >= 0) return 'Nhà thuốc An Khang (MWG)';
  if (k.indexOf('avakids') >= 0) return 'AVAKids (MWG)';
  if (k.indexOf('topzone') >= 0) return 'TopZone (MWG)';
  if (k.indexOf('dien may xanh') >= 0 || /(^| )dmx( |$)/.test(k)) return 'Điện Máy Xanh (MWG)';
  return 'Thế Giới Di Động (MWG)';
}

/**
 * NƠI LÀM THẬT của một việc MWG — cổng có sẵn cửa công khai trả JSON kèm TOẠ ĐỘ từng nơi:
 *   /job/getpositions?id=<mã việc>&provinceID=0
 * Vì sao phải hỏi: trang danh sách chỉ ghi "Hồ Chí Minh và 15 tỉnh…" — đem đi đo là ra TÂM thành
 * phố, đúng 9,3 km từ Hóc Môn (bẫy đã chốt 18/09/2026). Trang chi tiết trên cổng chung để TRỐNG
 * danh sách nơi làm (JavaScript mới nạp), nên đọc HTML không ra.
 * Có toạ độ thì khỏi geocode: đo đường thẳng từ toạ độ, việc nào có nhiều nơi làm thì lấy nơi
 * GẦN NHÀ NHẤT (tin "Nhân viên Kho chuyên đêm" có 39 nơi trên cả nước).
 * Chỉ hỏi cho việc ĐÃ chắc là ca đêm (≈9 tin/lượt), không hỏi cho cả 136 tin.
 */
function viTriMwgHangLoat_(ds, goc, t0) {
  if (!ds.length || hetGio_(t0)) return 0;
  var tra = taiNhieu_(ds.map(function (v) {
    return URL_MWG.replace('/tuyen-dung', '') + '/job/getpositions?id=' +
      encodeURIComponent(String(v.id).replace('tgdd-', '')) + '&provinceID=0';
  }));
  var xong = 0;
  tra.forEach(function (r, i) {
    if (r.ma !== 200) return;
    var v = ds[i], d = null;
    try { d = JSON.parse(r.noiDung || '{}'); } catch (e) { return; }
    var noi = (d && d.result) || [];
    var chon = null, ganNhat = 1e9;
    noi.forEach(function (p) {
      if (!p || !p.lat || !p.lng) return;
      var km = khoangCachChim_(goc.lat, goc.lng, Number(p.lat), Number(p.lng));
      if (km < ganNhat) { ganNhat = km; chon = p; }
    });
    if (!chon) return;
    v.lat = Number(chon.lat); v.lng = Number(chon.lng);
    if (chon.address) v.diaChi = String(chon.address).trim();
    v.soDiaDiem = noi.length;
    xong++;
  });
  return xong;
}

/* ====================== NGUỒN 8: vieclamtot.com (Chợ Tốt) ======================
 * Thêm 16/09/2026 — đây là nơi đăng nhiều việc phổ thông ca đêm nhất ở TP.HCM (bảo vệ, giữ xe, kho,
 * quán ăn, xưởng đóng gói…), đúng thứ bảng đang thiếu. Đọc qua cổng dữ liệu công khai của chính
 * trang web (không cần đăng nhập/khoá), trả JSON có sẵn TOÀN VĂN tin + toạ độ + giờ đăng, nên lọc
 * được ngay không phải mở từng tin. cg=13000 là mục việc làm; region_v2 là mã tỉnh/thành.
 * Đo 18/09/2026: bỏ hẳn region_v2 (để hỏi cả nước) thì 4 trang vẫn 200 tin nhưng CHỈ 99 tin ở
 * TP.HCM — nửa còn lại là Đà Nẵng 22 · Cần Thơ 13 · Bắc Ninh 12 · Hà Nội 5… (35 tỉnh), tốn nửa
 * suất tải cho tin chắc chắn bị bán kính cắt. Nên hỏi ĐÚNG vùng đi làm được. Mã vùng đọc ngay từ
 * tin trả về (trường region_v2): TP.HCM 13000 · Long An 5032 · Bình Dương 2011.
 */
var CHOTOT_API = 'https://gateway.chotot.com/v1/public/ad-listing?cg=13000&st=s,k&limit=50';
var CHOTOT_HCM = 13000, CHOTOT_LONG_AN = 5032;
function urlChotot_(kw, trang, vung) {
  return CHOTOT_API + '&region_v2=' + (vung || CHOTOT_HCM) +
    '&q=' + encodeURIComponent(kw) + '&o=' + ((Math.max(1, trang) - 1) * 50);
}

function phanTichChotot_(json) {
  var d = {};
  try { d = JSON.parse(json || '{}'); } catch (e) { return []; }
  var ads = (d && d.ads) || [];
  var ra = [];
  ads.forEach(function (a) {
    if (!a || !a.list_id || !a.subject) return;
    var than = String(a.body || '').replace(/\r/g, '');
    /* Tên tỉnh/thành lấy từ chính tin, KHÔNG dán cứng "TP.HCM" nữa: hỏi thêm vùng Long An thì
       dán cứng là ghi sai nơi làm và dựng sai đường dẫn. */
    var tinh = String(a.region_name || 'TP.HCM').replace(/^Tp\s+/i, 'TP.').trim();
    var noi = [a.ward_name, a.area_name].filter(function (x) { return x; }).join(', ');
    var luong = String(a.price_string || '').trim();
    if (!luong || /thương lượng|thoả thuận|thỏa thuận/i.test(luong)) luong = 'Thoả thuận';
    var v = tin_({
      nguon: 'vieclamtot.com',
      id: 'vlt-' + a.list_id,
      ten: String(a.subject).trim(),
      luong: luong,
      luongMin: /tháng/i.test(luong) ? (Number(a.min_salary) || 0) : 0,
      diaChi: noi ? noi + ', ' + tinh : tinh,
      lat: Number(a.latitude) || null,
      lng: Number(a.longitude) || null,
      ntd: String(a.company_name || a.full_name || a.account_name || '').trim(),
      dangLuc: Math.round((Number(a.list_time) || 0) / 1000),
      chiTiet: catChu_(gachDauDong_(than), 450),
      yeuCau: catChu_(gachDauDong_(tachYeuCau_(than)), 320),
      chuThem: catChu_(than, 900),
      daChiTiet: true,
      /* Đường dẫn công khai của trang: /viec-lam-<quận>-tp-ho-chi-minh/<id>.htm (đối chiếu 6/6 tin 16/09). */
      link: (a.area_name && /ch[íi]\s*minh/i.test(tinh))
        ? 'https://www.vieclamtot.com/viec-lam-' + khongDauGach_(a.area_name) + '-tp-ho-chi-minh/' + a.list_id + '.htm'
        /* Ngoài TP.HCM thì dùng đường chotot.com/<id>.htm — nó tự 301 về đúng trang (đã đối chiếu). */
        : 'https://www.chotot.com/' + a.list_id + '.htm'
    });
    v.gioLam = timGioLam_(v.ten + ' ' + than);
    ra.push(v);
  });
  return ra;
}

/** Tin Chợ Tốt viết một mạch: cắt đoạn từ chữ "Yêu cầu" tới mục kế (quyền lợi/lương/liên hệ…). */
function tachYeuCau_(than) {
  var s = String(than || '');
  /* Chỉ nuốt tới dấu ":" trên cùng dòng — bản đầu nuốt cả dòng nên "Yêu cầu: có kinh nghiệm…" mất trắng. */
  var m = s.match(/y[êe]u c[ầa]u[^\n:]{0,30}:?/i);
  if (!m) return '';
  var tu = m.index;
  var sau = s.substring(tu + m[0].length);
  var k = sau.search(/\n\s*[^\n]{0,4}(quy[ềe]n l[ợo]i|ph[úu]c l[ợo]i|thu nh[ậa]p|m[ứu]c l[ưu][ơo]ng|l[ưu][ơo]ng\s*:|li[êe]n h[ệe]|đ[ịi]a đi[ểe]m|th[ờo]i gian|ca l[àa]m|m[ôo] t[ảa])/i);
  return k >= 0 ? sau.substring(0, k) : sau.substring(0, 600);
}

/* ====================== NGUỒN 7: trang tuyển dụng của công ty ====================== */

/** User dán link vào tab TRANG CÔNG TY; ở đây chỉ dò chữ "ca đêm" và cắt đoạn quanh nó. */
function phanTichTrangCongTy_(html, url) {
  var chu = boHtml_(html);
  var thuong = khongDau_(chu);
  var vt = -1;
  ['ca dem', 'lam dem', 'truc dem', 'night shift'].forEach(function (k) {
    if (vt < 0) vt = thuong.indexOf(k);
  });
  if (vt < 0) return [];
  var doan = chu.substring(Math.max(0, vt - 200), vt + 700);
  var ten = (html.match(/<title>([^<]{3,150})<\/title>/) || [])[1] || url;
  return [tin_({
    nguon: 'trang công ty',
    id: 'ct-' + url.replace(/[^a-z0-9]/gi, '').substring(0, 40),
    ten: boHtml_(ten).trim(),
    chiTiet: catChu_(gachDauDong_(doan), 450),
    daChiTiet: true,
    diaChi: '',
    ntd: url.replace(/^https?:\/\//, '').split('/')[0],
    link: url
  })];
}

/* ====================== NGUỒN 9: MÁY CHỦ TỰ QUÉT TRANG CÔNG TY (18/09/2026) ==============
 * Trước đây trang công ty giao hẳn cho tiện ích Edge, mà tiện ích chỉ chạy khi user bấm "Cào
 * ngay" và Edge đang mở → lượt tự động mỗi giờ KHÔNG hề ngó tới công ty nào. Nay máy chủ tự
 * quét, dùng MỘT nguyên tắc chung cho mọi web (không viết bộ bóc riêng từng nơi):
 *   trang danh sách → nhặt link giống tin việc → chọn KHUÔN đường dẫn hay lặp nhất (đó là khuôn
 *   của tin việc, khuôn danh mục chỉ vài cái) → mở các tin CHƯA ĐỌC → đọc giờ ca như tin thường.
 * Web nào chạy bằng JavaScript (Kingfoodmart, AEON, Shopee Express…) thì máy chủ chỉ tải được vỏ
 * → vẫn để tiện ích Edge lo, ở đây tự khắc ra 0 link.
 * Đo 18/09/2026 (scratchpad/do-cao-congty2.mjs): 8 công ty, đọc 66 tin → 26 tin có ghi giờ ca.
 * Ít việc ca đêm, nhưng đây là nơi DUY NHẤT có tin không lên trang việc làm nào (giống hệt cách
 * việc của Bách Hoá Xanh bị bỏ lỡ), nên vẫn quét — có điều chỉ 4 công ty/lượt cho nhẹ.
 */
var CT_DAU_ = /(tuyen-?dung|viec-?lam|job|career|recruit|vi-?tri|position|vacanc)/i;
var CT_BO_ = /(\.css|\.js|\.png|\.jpg|\.jpeg|\.webp|\.pdf|\.svg|login|dang-nhap|register|dang-ky|\/tag\/|\/category\/|facebook|zalo|linkedin|youtube)/i;

/** Apps Script không có lớp URL — tự tách và tự nối đường dẫn. */
function tachUrl_(u) {
  var m = String(u || '').match(/^(https?:)\/\/([^\/?#]+)([^?#]*)/i);
  if (!m) return null;
  return { goc: m[1] + '//' + m[2], host: m[2].toLowerCase(), duong: m[3] || '/' };
}
function noiUrl_(goc, href) {
  href = String(href || '').trim();
  if (!href || href.charAt(0) === '#' || /^(javascript|mailto|tel):/i.test(href)) return '';
  var g = tachUrl_(goc);
  if (!g) return '';
  if (/^https?:\/\//i.test(href)) return href;
  if (href.indexOf('//') === 0) return 'https:' + href;
  if (href.charAt(0) === '/') return g.goc + href;
  return g.goc + g.duong.replace(/[^\/]*$/, '') + href;
}
/** Khuôn đường dẫn: bỏ đoạn cuối → /jobs/*, /viec-lam/*, /tuyen-dung/* … */
function khuonDuong_(duong) {
  var p = String(duong).split('/').filter(function (x) { return x; });
  if (!p.length) return '/';
  return '/' + p.slice(0, -1).join('/') + '/*';
}

/** Nhặt link tin việc trong một trang danh sách (nguyên tắc chung, không riêng web nào). */
function linkViecTrongHtml_(html, goc) {
  var g = tachUrl_(goc);
  if (!g) return [];
  var thay = {}, re = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi, m;
  while ((m = re.exec(html)) !== null) {
    var u = noiUrl_(goc, m[1]);
    if (!u) continue;
    var t = tachUrl_(u);
    if (!t || t.host !== g.host) continue;
    var duong = t.duong.replace(/\/$/, '');
    if (!duong || CT_BO_.test(duong) || !CT_DAU_.test(duong)) continue;
    if (duong.split('/').filter(function (x) { return x; }).length < 2) continue;
    var link = t.goc + duong;
    if (link.replace(/\/$/, '') === String(goc).replace(/[?#].*$/, '').replace(/\/$/, '')) continue;
    var ten = boHtml_(m[2]).replace(/\s+/g, ' ').trim();
    if (!thay[link] || ten.length > thay[link].ten.length) {
      thay[link] = { link: link, ten: catChu_(ten, 120), khuon: khuonDuong_(duong) };
    }
  }
  var ds = [];
  Object.keys(thay).forEach(function (k) { ds.push(thay[k]); });
  if (!ds.length) return [];
  var dem = {};
  ds.forEach(function (o) { dem[o.khuon] = (dem[o.khuon] || 0) + 1; });
  var tot = Object.keys(dem).sort(function (a, b) { return dem[b] - dem[a]; })[0];
  return ds.filter(function (o) { return o.khuon === tot; });
}

/**
 * Mỗi lượt chỉ đọc được vài tin mỗi công ty, nên phải đọc tin ĐÁNG NGỜ TRƯỚC: tên/đường dẫn có
 * chữ đêm, rồi tới nhóm nghề hay làm đêm (kho, bảo vệ, phân loại, sản xuất, siêu thị…).
 * Tin còn lại vẫn tới lượt ở những lần chạy sau (đọc rồi thì nhớ, không đọc lại).
 */
var CT_UU_TIEN_ = [
  [6, /(dem|night|ca 3|overnight|khuya)/],
  [3, /(kho|bao ve|an ninh|security|phan loai|chia hang|soan hang|boc xep|giao hang|xe nang|van hanh|san xuat|cong nhan|ve sinh|tap vu|le tan|bep|phuc vu|thu ngan|sieu thi|cua hang|tai xe|lai xe|bao tri|ky thuat)/],
  [1, /(nhan vien|cong tac vien|part-?time|lao dong)/]
];
function diemLinkViec_(o) {
  var chu = khongDau_((o.ten || '') + ' ' + (o.link || ''));
  for (var i = 0; i < CT_UU_TIEN_.length; i++) {
    if (CT_UU_TIEN_[i][1].test(chu)) return CT_UU_TIEN_[i][0];
  }
  return 0;
}

function idCongTy_(link) {
  return 'ct-' + String(link).replace(/^https?:\/\//, '').replace(/[^a-z0-9]/gi, '').substring(0, 60);
}

/**
 * Quét vài công ty mỗi lượt (xoay vòng để lượt nào cũng nhẹ). Trả về mảng tin đã có nội dung.
 * Tin đã đọc ở lượt trước nằm trong BỘ NHỚ nên không mở lại.
 */
function quetTrangCongTy_(ss, cfg, nho, t0) {
  /* Bỏ những trang ĐÃ có nguồn riêng đọc kỹ hơn (cổng MWG) — quét lại chỉ tốn lượt gọi. */
  var ds = docNguonCongTy_(ss).filter(function (c) {
    if (!c.trang || c.trang.indexOf('http') !== 0) return false;
    var h = (tachUrl_(c.trang) || {}).host || '';
    return !(/vieclam\.(thegioididong|bachhoaxanh)\.com$/.test(h));
  });
  if (!ds.length || !cfg.congTyCaoMoiLuot) return [];
  var kho = PropertiesService.getScriptProperties();
  var batDau = Number(kho.getProperty('xoay_ct_cao') || 0) % ds.length;
  var chon = [];
  for (var i = 0; i < Math.min(cfg.congTyCaoMoiLuot, ds.length); i++) chon.push(ds[(batDau + i) % ds.length]);
  kho.setProperty('xoay_ct_cao', String((batDau + chon.length) % ds.length));

  var traDs = taiNhieu_(chon.map(function (c) { return c.trang; }));
  var canDoc = [], theoLink = {};
  traDs.forEach(function (r, i) {
    if (r.ma !== 200 || !r.noiDung) return;
    var ls = linkViecTrongHtml_(r.noiDung, chon[i].trang);
    ls.sort(function (a, b) { return diemLinkViec_(b) - diemLinkViec_(a); });
    var moi = 0;
    for (var k = 0; k < ls.length && moi < cfg.tinMoiCongTy; k++) {
      var id = idCongTy_(ls[k].link);
      if (nho[id] || theoLink[ls[k].link]) continue;
      theoLink[ls[k].link] = { ten: ls[k].ten, cty: chon[i].ten };
      canDoc.push(ls[k].link);
      moi++;
    }
  });
  if (!canDoc.length || hetGio_(t0)) return [];

  var tra = taiNhieu_(canDoc);
  var ra = [];
  tra.forEach(function (r, i) {
    if (r.ma !== 200 || !r.noiDung || r.noiDung.length < 800) return;
    var link = canDoc[i], o = theoLink[link] || {};
    var chu = boHtmlDong_(r.noiDung).substring(0, 15000);
    var ten = boHtml_((r.noiDung.match(/<h1[^>]*>([\s\S]{2,200}?)<\/h1>/) || [])[1] || '').trim() ||
      boHtml_((r.noiDung.match(/<title>([^<]{3,150})<\/title>/) || [])[1] || '').trim() || o.ten || link;
    var v = tin_({
      nguon: 'trang công ty',
      id: idCongTy_(link),
      ten: catChu_(ten.replace(/\s*[|\-–]\s*[^|\-–]{0,40}$/, '').trim(), 150),
      luong: timLuongTrongChu_(chu),
      diaChi: timDiaChiTrongChu_(chu),
      ntd: o.cty || (tachUrl_(link) || {}).host || '',
      chiTiet: catChu_(gachDauDong_(chu), 600),
      yeuCau: '',
      chuThem: catChu_(chu, 1500),
      daChiTiet: true,
      link: link
    });
    v.gioLam = timGioLam_(chu + ' ' + v.ten);
    ra.push(v);
  });
  return ra;
}

/* ====================== CHI TIẾT (song song) ====================== */

function layChiTietHangLoat_(ds, t0) {
  if (!ds.length || hetGio_(t0)) return;
  var tra = taiNhieu_(ds.map(function (v) { return v.link; }));
  tra.forEach(function (r, i) {
    var v = ds[i];
    if (r.ma !== 200) { v.loiChiTiet = 'HTTP ' + r.ma; return; }
    v.daChiTiet = true;
    try {
      if (v.nguon === 'vieclam24h.vn') phanTichVl24hChiTiet_(v, r.noiDung);
      else if (v.nguon === 'hoteljob.vn') phanTichHoteljobChiTiet_(v, r.noiDung);
      else if (v.nguon !== 'trang công ty') {
        v.chiTiet = catChu_(gachDauDong_(docMuc_(r.noiDung, ['MÔ TẢ CÔNG VIỆC', 'Mô tả Công việc', 'Mô tả công việc'],
          ['YÊU CẦU CÔNG VIỆC', 'Yêu Cầu Công Việc', 'Yêu cầu công việc', 'Yêu cầu ứng viên', 'QUYỀN LỢI', 'Quyền lợi'])), 600);
        v.yeuCau = catChu_(gachDauDong_(docMuc_(r.noiDung, ['YÊU CẦU CÔNG VIỆC', 'Yêu Cầu Công Việc', 'Yêu cầu công việc', 'Yêu cầu ứng viên'],
          ['QUYỀN LỢI', 'Quyền lợi', 'Phúc lợi', 'THU NHẬP', 'Địa điểm làm việc', 'Thời gian làm việc', 'Cách thức ứng tuyển'])), 320);
      }
    } catch (e) { v.loiChiTiet = String(e); }
    v.gioLam = timGioLam_((v.chiTiet || '') + ' ' + (v.yeuCau || '') + ' ' + (v.chuThem || '') + ' ' + (v.ten || ''));
    /* ĐOẠN TRÍCH KHÔNG PHẢI LÀ CẢ BÀI (bài học 19/09/2026). Tin "Giám sát an ninh & Kiểm soát nội
       bộ (Audit)" của BEST Logistics ghi "(Đối với Audit tại SC bắt buộc Làm việc ca đêm)" ở khoảng
       chữ thứ 4.000, trong khi chiTiet chỉ giữ 600 và yeuCau 320 → bộ lọc không thấy gì, loại thẳng.
       Nay soi CẢ TRANG: có câu nói ca đêm thì kẹp câu đó vào đầu phần chi tiết (vừa để bộ lọc thấy,
       vừa để người đọc biết vì sao tin nằm trong bảng). chiTiet được ghi vào BỘ NHỚ nên lượt sau
       dựng lại từ bộ nhớ vẫn còn bằng chứng. */
    try {
      var toanVan = vungBaiDang_(r.noiDung);
      if (!v.gioLam || v.gioLam === '—') {
        var gioSau = timGioLam_(toanVan);
        if (gioSau && gioSau !== '—') v.gioLam = gioSau;
      }
      var daCo = khongDau_((v.chiTiet || '') + ' ' + (v.yeuCau || '') + ' ' + (v.ten || ''));
      var coDem = DAU_HIEU_DEM.some(function (k) { return daCo.indexOf(khongDau_(k)) >= 0; });
      if (!coDem) {
        var cau = cauCoDem_(toanVan);
        if (cau) v.chiTiet = catChu_('⚑ ' + cau + ' — ' + (v.chiTiet || ''), 700);
      }
    } catch (eDem) { /* đoạn trích vẫn dùng được, không để hỏng cả lượt */ }
  });
}

/**
 * Phần CHỮ CỦA CHÍNH BÀI ĐĂNG: cắt bỏ đuôi trang (việc làm liên quan, gợi ý, khối từ khoá SEO).
 * Vì sao: soi cả trang thì tin ban ngày dính oan do mục "Việc làm liên quan" có tin ca đêm, hoặc
 * do khối từ khoá ở chân trang (đo 19/09/2026 trên vieclam24h và cổng MWG).
 */
var MOC_BAI_ = ['MÔ TẢ CÔNG VIỆC', 'Mô tả Công việc', 'Mô tả công việc', 'MÔ TẢ CÔNG VIỆC:',
  'CHI TIẾT TUYỂN DỤNG', 'Chi tiết tuyển dụng', 'Mô tả chi tiết', 'MÔ TẢ', 'Thông tin tuyển dụng'];
var CAT_DUOI_ = ['Việc làm liên quan', 'VIỆC LÀM LIÊN QUAN', 'Việc làm cùng', 'Việc làm tương tự',
  'Các công việc tương tự', 'Tin tuyển dụng khác', 'Việc làm khác', 'Gợi ý việc làm', 'Có thể bạn quan tâm',
  'Từ khóa', 'Từ khoá', 'Tìm kiếm nhiều', 'Việc làm theo', 'Quy trình tuyển dụng', 'Xem thêm việc làm'];
function vungBaiDang_(html) {
  var chu = boHtmlDong_(html).substring(0, 30000);
  /* Neo từ chỗ bắt đầu bài đăng: thanh menu đầu trang cũng có "Việc làm theo khu vực",
     cắt đuôi mà không neo thì xén mất cả bài (đo 19/09/2026 trên careerviet). */
  var batDau = -1;
  MOC_BAI_.forEach(function (m) {
    var i = chu.indexOf(m);
    if (i >= 0 && (batDau < 0 || i < batDau)) batDau = i;
  });
  var phan = batDau >= 0 ? chu.substring(batDau) : chu;
  var cat = phan.length;
  CAT_DUOI_.forEach(function (m) {
    var i = phan.indexOf(m);
    if (i > 300 && i < cat) cat = i;
  });
  return phan.substring(0, cat);
}

/**
 * Cắt đúng CÂU có nói tới ca đêm trong bài (bằng chứng để hiển thị + cho bộ lọc thấy).
 * Trả rỗng nếu câu tìm được là rác SEO — đo 19/09/2026: chân trang vieclam24h có khối từ khoá
 * kiểu "bảo vệ thời vụ Bảo Vệ bảo vệ sân bay … bảo vệ ca đêm …" làm 4/5 tin bảo vệ ban ngày bị
 * kết luận nhầm là ca đêm. Khối đó lặp đi lặp lại một chữ nên nhận ra bằng tỉ lệ chữ khác nhau.
 */
function cauCoDem_(chu) {
  var s = String(chu || '');
  var k = khongDau_(s), vt = -1, tu = '';
  DAU_HIEU_DEM.forEach(function (x) {
    var i = k.indexOf(khongDau_(x));
    if (i >= 0 && (vt < 0 || i < vt)) { vt = i; tu = x; }
  });
  if (vt < 0) return '';
  /* Lấy trọn DÒNG chứa từ khoá (boHtmlDong_ đã tách mỗi khối một dòng): cắt theo số ký tự thì
     câu hay mất đầu ('…ương tác và phối hợp tốt. 7. Chấp nhận đi công tác…'). */
  var dong = s.split('\n');
  for (var i = 0; i < dong.length; i++) {
    var d = dong[i].replace(/\s+/g, ' ').trim();
    if (d.length < 10 || d.length > 400) continue;
    if (khongDau_(d).indexOf(khongDau_(tu)) < 0) continue;
    if (raoTuKhoa_(d)) continue;
    return catChu_(d, 220);
  }
  return '';
}

/** Dòng có phải đám từ khoá SEO không: dài mà ít chữ khác nhau, hoặc một cụm lặp nhiều lần. */
function raoTuKhoa_(d) {
  var tu = khongDau_(d).split(/[^a-z0-9]+/).filter(function (x) { return x.length > 1; });
  if (tu.length < 8) return false;
  var khac = {};
  tu.forEach(function (x) { khac[x] = (khac[x] || 0) + 1; });
  var soKhac = Object.keys(khac).length;
  if (soKhac / tu.length < 0.62) return true;              /* lặp chữ quá nhiều */
  var nhieuNhat = 0;
  Object.keys(khac).forEach(function (x) { if (khac[x] > nhieuNhat) nhieuNhat = khac[x]; });
  return nhieuNhat >= 4 && tu.length >= 12;                 /* một chữ xuất hiện 4 lần trở lên */
}

/** Cắt đoạn văn nằm giữa 2 mốc chữ trên trang — dùng chung cho careerviet và topcv. */
function docMuc_(html, batDau, ketThuc) {
  var i = -1;
  for (var a = 0; a < batDau.length && i < 0; a++) i = html.indexOf(batDau[a]);
  if (i < 0) return '';
  var chu = boHtmlDong_(html.substr(i, 9000));
  for (var b = 0; b < batDau.length; b++) {
    if (chu.indexOf(batDau[b]) === 0) { chu = chu.substring(batDau[b].length); break; }
  }
  var cat = chu.length;
  ketThuc.forEach(function (k) {
    var j = chu.indexOf(k);
    if (j > 30 && j < cat) cat = j;
  });
  return chu.substring(0, cat).trim();
}

/**
 * Đọc khung giờ làm trong bài.
 * Đo trên bảng thật 15/09/2026: 42/51 dòng để trống cột này — hạn chế lớn nhất về thông tin.
 * Bản này nhận thêm: giờ kiểu Anh ("10PM - 6AM"), và tin chỉ nêu một đầu ("làm từ 22h").
 */
function timGioLam_(chu) {
  chu = String(chu || '');

  /* 1. Giờ kiểu Anh xét trước: "10PM" cũng khớp mẫu số thường nhưng hiểu sai thành 10 giờ sáng. */
  var a = chu.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*(?:-|–|—|to|đến|tới|~)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (a) {
    var g24 = function (gio, buoi) {
      gio = Number(gio) % 12;
      return String(buoi.toLowerCase() === 'pm' ? gio + 12 : gio);
    };
    var bd1 = Number(g24(a[1], a[3])), kt1 = Number(g24(a[4], a[6]));
    return so2_(bd1) + ':' + so2_(a[2] || '00') + ' - ' + so2_(kt1) + ':' + so2_(a[5] || '00') +
      (kt1 <= bd1 ? ' (hôm sau)' : '');
  }

  /* 1b. Giờ viết bằng dấu chấm: "Ca đêm: 22.00 – 07.00" (đo 19/09/2026 trên tin lễ tân khách sạn).
     BẮT BUỘC đủ 2 chữ số phút ở cả hai đầu, và ngay sau đó không được là chữ tiền — nếu không
     "lương 9.5 - 12 triệu" sẽ bị đọc thành ca làm việc. */
  var c = chu.match(/(\d{1,2})\.(\d{2})\s*(?:-|–|—|đến|tới|~)\s*(\d{1,2})\.(\d{2})(?![\d.])/);
  if (c && Number(c[1]) <= 24 && Number(c[3]) <= 24 && Number(c[2]) < 60 && Number(c[4]) < 60) {
    var sau = chu.substr(c.index + c[0].length, 15).toLowerCase();
    if (!/(tri[ệe]u|\btr\b|vnd|vnđ|\bđ\b|\bk\b|%)/.test(sau)) {
      var bdC = Number(c[1]), ktC = Number(c[3]);
      return so2_(bdC) + ':' + so2_(c[2]) + ' - ' + so2_(ktC) + ':' + so2_(c[4]) + (ktC <= bdC ? ' (hôm sau)' : '');
    }
  }

  /* 2. Giờ tiếng Việt, ưu tiên khung qua đêm nếu tin nêu nhiều ca. */
  var re = /(\d{1,2})\s*(?::|h|g|giờ)\s*(\d{0,2})\s*(?:-|–|—|đến|tới|~)\s*(\d{1,2})\s*(?::|h|g|giờ)?\s*(\d{0,2})/gi;
  var m, tot = '';
  while ((m = re.exec(chu)) !== null) {
    var bd = parseInt(m[1], 10), kt = parseInt(m[3], 10);
    if (bd > 24 || kt > 24) continue;
    var chuoi = so2_(bd) + ':' + so2_(m[2] || '00') + ' - ' + so2_(kt) + ':' + so2_(m[4] || '00');
    if (laGioDem_(bd, kt)) return chuoi + (kt <= bd ? ' (hôm sau)' : '');
    if (!tot) tot = chuoi;
  }
  if (tot) return tot;

  /* 3. Tin chỉ nêu một đầu giờ. */
  var mot = chu.match(/(?:từ|bắt đầu|vào lúc|lúc)\s*(\d{1,2})\s*(?::|h|g|giờ)\s*(\d{0,2})/i);
  if (mot && parseInt(mot[1], 10) <= 24) return 'Từ ' + so2_(mot[1]) + ':' + so2_(mot[2] || '00');

  return '—';
}

/* ====================== LỌC · XẾP ====================== */

/**
 * Có phải việc ca đêm không.
 * Ngoài từ khoá, còn xét GIỜ LÀM: nhiều tin (đúng ca đêm) không hề viết chữ "đêm", chỉ ghi
 * "Ca làm việc 22h00 - 6h00" — ví dụ tin Giám sát an ninh của Thế Giới Di Động user gửi 15/09.
 */
function laCaDem_(v) {
  /* 1. Tên công việc là bằng chứng chắc nhất — "Lễ tân ca đêm" thì khỏi xét gì thêm. */
  var ten = khongDau_(v.ten || '');
  if (DAU_HIEU_DEM_TEN.some(function (k) { return ten.indexOf(khongDau_(k)) >= 0; })) return true;

  /* 2. Đọc được giờ ca thì GIỜ CA quyết định, kể cả khi mô tả có chữ "đêm" lạc chỗ.
     timGioLam_ ưu tiên trả về khung giờ qua đêm nếu tin có nhiều ca, nên tin nào thật sự
     có ca đêm vẫn được nhận. */
  var g = v.gioLam || timGioLam_((v.chiTiet || '') + ' ' + (v.yeuCau || '') + ' ' + (v.chuThem || ''));
  var m = String(g || '').match(/^(\d{1,2}):\d{2} - (\d{1,2}):\d{2}/);
  if (m) return laGioDem_(Number(m[1]), Number(m[2]));

  /* 3. Không có giờ nào để bám thì mới xét từ khoá trong phần mô tả. */
  var mo = khongDau_((v.chiTiet || '') + ' ' + (v.yeuCau || ''));
  return DAU_HIEU_DEM.some(function (k) { return mo.indexOf(khongDau_(k)) >= 0; });
}

/**
 * Khung giờ có phải ca đêm không — user chốt 15/09/2026: ca nằm trong khoảng 19h → 8h sáng.
 *   - bắt đầu từ 19h trở đi: 20h-4h, 22h-6h, 23h-7h;
 *   - hoặc vắt qua nửa đêm và kết thúc trước 8h: 18h-2h, 19h-7h;
 *   - hoặc bắt đầu sau nửa đêm và xong trước 9h: 0h-8h.
 *   Ca 17h-23h là ca tối, không tính; ca 6h-8h không vắt qua đêm, không tính.
 */
function laGioDem_(bd, kt) {
  if (bd >= 19) return true;      // user chốt lại 15/09/2026 chiều: từ 19h là tính ca đêm
  if (kt < bd && kt <= 8) return true;
  if (bd <= 3 && kt <= 9) return true;
  return false;
}

/**
 * Xoay ca / luân ca: có ca đêm nhưng không phải ca đêm cố định (ví dụ Kingfoodmart:
 * "Ca 3: 22h-6h" nhưng "làm xoay ca, tối đa 2 ca đêm/tuần"). User chốt 15/09/2026: vẫn giữ,
 * nhưng gắn nhãn "Tham khảo (xoay ca)" để biết là không đáp ứng yêu cầu ca đêm cố định.
 */
function laXoayCa_(v) {
  var chu = khongDau_((v.ten || '') + ' ' + (v.chiTiet || '') + ' ' + (v.yeuCau || '') + ' ' + (v.chuThem || ''));
  return /(xoay ca|luan ca|luan phien|dao ca|ca ngay\s*[\/,\-va]+\s*ca dem|toi da \d+ ca dem|theo ca|3 ca|ca 1[^a-z0-9]{1,6}ca 2)/.test(chu);
}

function locVaXep_(viec, cfg, goc) {
  var thay = {}, ra = [], boTelesale = 0, boCu = 0;
  viec.forEach(function (v) {
    if (!v.id || thay[v.id]) return;
    thay[v.id] = 1;
    if (!laCaDem_(v)) return;
    v.xoayCa = laXoayCa_(v);

    /* Tin quá cũ thì bỏ: bảng đang có tin đăng từ tháng 7, ứng tuyển gần như chắc chắn hết chỗ.
       Tin không rõ ngày đăng thì vẫn giữ, không đoán mò. */
    if (v.dangLuc && cfg.tinTrongNgay &&
        (Date.now() / 1000 - v.dangLuc) > cfg.tinTrongNgay * 86400) { boCu++; return; }

    if (!oGan_(v, cfg, goc)) return;
    v.telesale = laTelesale_(v);
    if (v.telesale && cfg.telesale === 'bo') { boTelesale++; return; }
    ra.push(v);
  });
  ra.boTelesale = boTelesale;
  ra.boCu = boCu;
  /* xếp tạm theo gần-xa để nếu phải cắt bớt thì cắt tin xa trước */
  ra.sort(function (a, b) {
    if (!!a.telesale !== !!b.telesale) return a.telesale ? 1 : -1;
    /* Tin CHƯA đo được đường (bài Facebook, địa chỉ chỉ ghi tên tỉnh) coi như nằm ở rìa vùng chứ
       không phải 999 km: bản cũ gán 999 nên trần "Số việc ghi ra tối đa" cắt đúng chúng trước
       tiên — tức vẫn mất trắng dù luật 18/09/2026 nói là GIỮ. Tin xa thật vẫn nằm sau chúng. */
    var xa = function (v) {
      return v.kmOto != null ? v.kmOto : (v.kmChim == null ? (Number(cfg.banKinh) || 20) : v.kmChim);
    };
    return xa(a) - xa(b);
  });
  return ra;
}

/** Tin có nằm trong vùng đi làm được không (bán kính theo toạ độ; không có toạ độ thì soi tên nơi). */
function oGan_(v, cfg, goc) {
  if (v.lat && v.lng) {
    v.kmChim = khoangCachChim_(goc.lat, goc.lng, v.lat, v.lng);
    /* Chim bay luôn ngắn hơn đường ô tô nên cửa này lấy mốc NỚI (banKinh + noiThem) cho rộng,
       phần cắt chính xác để apBanKinh_ làm sau khi đã đo đường thật. */
    return v.kmChim <= Number(cfg.banKinh) + (Number(cfg.noiThem) || 0);
  }
  /* Trang công ty: không đọc ra nơi làm thì GIỮ (xếp cuối, cột km ghi "chưa rõ"); đọc ra rồi
     thì phải nằm trong vùng đi làm được — nhà máy ở Hà Nam/Bình Định không nên chiếm chỗ. */
  if (v.nguon === 'trang công ty') {
    var dcCt = khongDau_(v.diaChi || '');
    if (!dcCt) return true;
    return VUNG_GAN.some(function (k) { return dcCt.indexOf(k) >= 0; });
  }
  /* Bài Facebook viết tự do, địa chỉ hay nằm lẫn trong thân bài nên phải soi cả nội dung;
     các trang việc làm thì chỉ soi địa chỉ + tên cho chặt. */
  var dc = khongDau_(v.diaChi + ' ' + v.ten + (v.nguon === 'facebook' ? ' ' + v.chiTiet : ''));
  v.kmChim = null;
  return VUNG_GAN.some(function (k) { return dc.indexOf(k) >= 0; });
}

/**
 * Tin MƠ HỒ = chưa có chi tiết, tiêu đề không có chữ đêm/night, nhưng ở gần, không telesale và
 * chưa quá cũ — đúng loại tin đang bị loại oan. Mới đăng xếp trước để trần "đọc kỹ tối đa" cắt
 * đúng tin cũ.
 */
function chonTinMoHo_(viec, cfg, goc) {
  var ra = viec.filter(function (v) {
    if (v.daChiTiet || !v.link || v.nguon === 'facebook' || v.nguon === 'trang công ty') return false;
    var ten = khongDau_(v.ten || '');
    if (DAU_HIEU_DEM_TEN.some(function (k) { return ten.indexOf(khongDau_(k)) >= 0; })) return false;
    if (v.dangLuc && cfg.tinTrongNgay && (Date.now() / 1000 - v.dangLuc) > cfg.tinTrongNgay * 86400) return false;
    if (!oGan_(v, cfg, goc)) return false;
    return !laTelesale_(v);
  });
  /* Xếp mới→cũ TRONG TỪNG NGUỒN rồi xen kẽ các nguồn (nguồn có tin mới nhất đi trước). Nếu chỉ xếp
     theo ngày chung, trang kết quả chung chung của jobsgo/careerviet (mốc "vừa đăng", toàn việc ngày)
     nuốt hết suất đọc kỹ của vieclam24h — bộ đo 16/09: đọc 60 tin, thêm 0 việc. */
  var theo = {}, thuTu = [];
  ra.forEach(function (v) {
    if (!theo[v.nguon]) { theo[v.nguon] = []; thuTu.push(v.nguon); }
    theo[v.nguon].push(v);
  });
  /* Tin CHƯA CÓ NỘI DUNG BAO GIỜ xếp trước tin chỉ cần đọc lại cho tươi (sau khi đổi PHIEN_BAN,
     cả bảng đều mang cờ "chưa đọc" nên nếu không tách thì tin mới không bao giờ tới lượt). */
  thuTu.forEach(function (k) {
    theo[k].sort(function (a, b) {
      var moiA = (a.chiTiet || "").length < 40, moiB = (b.chiTiet || "").length < 40;
      if (moiA !== moiB) return moiA ? -1 : 1;
      return (b.dangLuc || 0) - (a.dangLuc || 0);
    });
  });
  thuTu.sort(function (a, b) { return (theo[b][0].dangLuc || 0) - (theo[a][0].dangLuc || 0); });
  var xen = [], con = true;
  while (con) {
    con = false;
    thuTu.forEach(function (k) { if (theo[k].length) { xen.push(theo[k].shift()); con = true; } });
  }
  return xen;
}

/* ====================== LOẠI VIỆC (nhóm nghề) ======================
 * Thêm 16/09/2026 vì user bảo bảng "chưa đa dạng": phải nhìn thấy bảng đang có nhóm nghề nào,
 * nhóm nào trống. Xét TIÊU ĐỀ trước (chắc nhất), không ra thì xét tên nhà tuyển dụng + đoạn đầu
 * mô tả. Từ khoá so theo TRỌN TỪ (không dấu) — "kho" không được dính "sức khoẻ".
 * Thứ tự nhóm là thứ tự ưu tiên khi một tin khớp nhiều nhóm ("Kỹ thuật tại siêu thị" → Kỹ thuật).
 */
var LOAI_VIEC = [
  ['Khách sạn · lễ tân', ['le tan', 'khach san', 'buong phong', 'housekeeping', 'bellman', 'receptionist',
    'hotel', 'hostel', 'resort', 'night audit', 'front office', 'quan gia', 'guest service', 'guest relation',
    'night supervisor', 'duty manager', 'homestay', 'can ho dich vu', 'hanh ly']],
  ['Bảo vệ · giữ xe', ['bao ve', 've si', 'giu xe', 'an ninh', 'security', 'guard', 'truc gac', 'camera', 'trong xe', 'bai xe']],
  ['Vệ sinh · tạp vụ', ['ve sinh', 'tap vu', 'lao cong', 'don dep', 'cleaner', 'public area', 'lay rac', 'rua chen', 'rua ly', 'giat ui']],
  ['Kho · giao nhận', ['kho', 'boc xep', 'phan loai', 'giao hang', 'shipper', 'tai xe', 'lai xe', 'logistics',
    'warehouse', 'soan hang', 'chia hang', 'xep do', 'giao nhan', 'buu cuc', 'van chuyen', 'xe nang', 'kiem hang', 'dong hang']],
  ['Kỹ thuật · bảo trì', ['ky thuat', 'bao tri', 'co dien', 'dien lanh', 'sua chua', 'technician', 'engineer',
    'van hanh may', 'tho dien', 'thiet bi', 'ky su']],
  ['Sản xuất · công nhân', ['cong nhan', 'san xuat', 'nha may', 'xuong', 'lao dong pho thong', 'dong goi', 'qc', 'kcs',
    'to truong', 'to pho', 'production', 'operator', 'may mac', 'so che', 'che bien', 'pha loc', 'phu kho', 'in an', 'gia cong']],
  ['Nhà hàng · quán · bar', ['phuc vu', 'pha che', 'bep', 'thu ngan', 'nha hang', 'quan an', 'quan nhau', 'quan oc', 'quan bar',
    'bar', 'barista', 'cafe', 'ca phe', 'bartender', 'bia', 'beer', 'karaoke', 'chay ban', 'phu bep', 'f&b', 'tra sua',
    'an uong', 'lounge', 'club', 'buffet', 'lau', 'nuong']],
  ['Bán hàng · siêu thị', ['ban hang', 'sieu thi', 'cua hang', 'circle k', 'gs25', 'quay', 'bach hoa', 'minimart', 'mini mart',
    'tien loi', 'shop', 'sales', 'kinh doanh', 'winmart', 'kingfoodmart']],
  ['Y tế · chăm sóc', ['y ta', 'dieu duong', 'ho ly', 'nha thuoc', 'duoc si', 'cham soc nguoi', 'giu tre', 'bao mau',
    'benh vien', 'phong kham', 'nurse', 'spa', 'massage', 'cham soc benh']],
  ['Giáo dục', ['giao vien', 'teacher', 'tro giang', 'anh ngu', 'gia su', 'ngoai ngu']],
  ['Văn phòng · CSKH', ['van phong', 'ke toan', 'hr', 'hris', 'nhap lieu', 'admin', 'marketing', 'it', 'cham soc khach hang',
    'customer', 'digital', 'specialist', 'photo editor', 'design', 'dao tao', 'tuyen dung', 'content', 'livestream', 'data',
    'ke hoach', 'quan ly', 'giam sat', 'supervisor', 'tieng anh', 'english', 'bpo', 'tong dai', 'tu van', 'chuyen vien', 'nhan su']]
];
var LOAI_VIEC_RE_ = LOAI_VIEC.map(function (n) {
  return [n[0], new RegExp('(^|[^a-z0-9])(' + n[1].map(function (k) {
    return k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('|') + ')([^a-z0-9]|$)')];
});
function loaiViec_(v) {
  var tim = function (chu) {
    chu = khongDau_(chu);
    if (!chu) return '';
    for (var i = 0; i < LOAI_VIEC_RE_.length; i++) if (LOAI_VIEC_RE_[i][1].test(chu)) return LOAI_VIEC_RE_[i][0];
    return '';
  };
  var ra = tim(v.ten || '');
  if (!ra && v.nguon === 'hoteljob.vn') ra = 'Khách sạn · lễ tân';   // trang toàn việc khách sạn/nhà hàng
  if (!ra) ra = tim((v.ntd || '') + ' ' + String(v.chiTiet || '').substring(0, 300));
  return ra || 'Khác';
}

/** Một dòng nhật ký cho biết bảng đa dạng tới đâu: mấy nhóm nghề, mỗi nhóm mấy việc, mỗi nguồn mấy việc. */
function tomTatDaDang_(viec) {
  var loai = {}, nguon = {};
  viec.forEach(function (v) {
    v.loaiViec = v.loaiViec || loaiViec_(v);
    loai[v.loaiViec] = (loai[v.loaiViec] || 0) + 1;
    nguon[v.nguon] = (nguon[v.nguon] || 0) + 1;
  });
  var xep = function (o) {
    return Object.keys(o).sort(function (a, b) { return o[b] - o[a]; })
      .map(function (k) { return k + ' ' + o[k]; }).join(' · ');
  };
  return Object.keys(loai).length + ' nhóm nghề: ' + xep(loai) + ' | theo nguồn: ' + xep(nguon);
}

/* Thứ tự user chốt 14/09: telesale xuống cuối → TIN MỚI NHẤT LÊN ĐẦU → gần hơn thì trên. */
/**
 * Thứ tự user chốt 15/09/2026: VIỆC MỚI PHÁT HIỆN NẰM TRÊN, việc cũ lùi xuống — cào được 10 việc
 * nằm hàng 2-11, giờ sau cò thấy thêm 2 việc thì 2 việc đó chiếm hàng 2-3, 10 việc cũ lùi xuống
 * 4-13. Mốc dùng là lần đầu cò thấy tin (lanDau, giữ trong BỘ NHỚ), không phải ngày đăng.
 * Cùng lượt phát hiện thì tin đăng mới hơn xếp trên, rồi tới gần hơn.
 */
function xepThuTu_(viec, cfg) {
  /* Sửa 15/09/2026 tối: xếp theo NGÀY ĐĂNG, không theo lần cò thấy. Bản trước xếp theo lần thấy
     nên một tin đăng 21 ngày trước mà cò mới gặp hôm nay (đợt tìm theo tên công ty) nhảy lên đầu
     bảng — user bắt được ngay. Tin không có ngày đăng thì lấy lần cò thấy làm mốc. Tin mới đăng
     hôm nay tự nhiên nằm trên, việc cũ tự lùi — đúng ý "việc mới nối tiếp việc cũ". */
  var moc = function (v) {
    if (v.dangLuc) return v.dangLuc * 1000;
    /* Không rõ ngày đăng: coi như đăng 1 ngày trước lúc cò thấy — nằm dưới tin đăng hôm nay,
       trên tin cũ hơn, không được chiếm hàng đầu khi cột "Đăng cách đây" còn để trống. */
    var thay = v.lanDau instanceof Date ? v.lanDau.getTime() : Date.now();
    return thay - 86400000;
  };
  viec.sort(function (a, b) {
    if (cfg.telesale !== 'giu' && !!a.telesale !== !!b.telesale) return a.telesale ? 1 : -1;
    /* Tin chưa đo được khoảng cách xuống cuối bảng (user chốt 18/09/2026) — vẫn xem được, không mất. */
    if (!!a.chuaRoKm !== !!b.chuaRoKm) return a.chuaRoKm ? 1 : -1;
    var la = moc(a), lb = moc(b);
    if (la !== lb) return lb - la;
    var ka = a.kmOto != null ? a.kmOto : (a.kmChim == null ? 999 : a.kmChim);
    var kb = b.kmOto != null ? b.kmOto : (b.kmChim == null ? 999 : b.kmChim);
    return ka - kb;
  });
}

/* ====================== KHOẢNG CÁCH ====================== */

function toaDoGoc_(cfg) {
  var kho = PropertiesService.getScriptProperties();
  var khoa = 'goc::' + cfg.diemXuatPhat;
  var da = kho.getProperty(khoa);
  if (da) return JSON.parse(da);
  try {
    var g = Maps.newGeocoder().setRegion('vn').geocode(cfg.diemXuatPhat);
    if (g.status === 'OK' && g.results.length) {
      var r = g.results[0];
      var o = { ten: r.formatted_address, lat: r.geometry.location.lat, lng: r.geometry.location.lng };
      kho.setProperty(khoa, JSON.stringify(o));
      return o;
    }
  } catch (e) { /* rơi xuống toạ độ dự phòng */ }
  return { ten: cfg.diemXuatPhat + ' (toạ độ dự phòng)', lat: cfg.duPhongLat, lng: cfg.duPhongLng };
}

/**
 * Địa chỉ CHỈ ghi tên tỉnh/thành ("Hồ Chí Minh", "TP.HCM", "HCMC", "Củ Chi") thì đo đường là vô
 * nghĩa: Maps trả về tâm thành phố (10.8231, 106.6297) — cách Hóc Môn đúng 9,3 km — nên tin ở
 * Quận 1 cũng hiện 9,3 km và lọt mọi bán kính, trong khi tin khai đủ địa chỉ 16 km lại bị cắt.
 * Đo ngày 18/09/2026: 22 trong 47 dòng trên bảng đều mang đúng con số 9,3 km này.
 */
function diaChiMoHo_(dc) {
  var s = khongDau_(String(dc || '')).replace(/[.,;:\-\/]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return true;
  /* "Hồ Chí Minh và 15 tỉnh…", "Toàn quốc": CÓ chữ số nhưng không phải số nhà — đo là ra tâm thành
     phố (9,3 km giả). Phải xét TRƯỚC cửa "có số là đo được". */
  if (/(^| )(va \d+ tinh|toan quoc|nhieu tinh|cac tinh)( |$)/.test(s)) return true;
  if (/\d/.test(s)) return false;                                        /* có số nhà/số đường → đo được */
  if (/(^| )(phuong|quan|huyen|xa|thi tran|duong|ap|khu|kcn|kdc|to)( |$)/.test(s)) return false;
  return s.split(' ').length <= 3;                                       /* "ho chi minh", "tp hcm", "cu chi" */
}

/**
 * Áp luật bán kính (user chốt 18/09/2026: mốc 20 km, nới ±5, "cho tất cả").
 *   ≤ mốc                     → nhận
 *   (mốc, mốc + nới]          → nhận, gắn cờ hoiXa (nhãn "Hơi xa")
 *   > mốc + nới               → bỏ
 *   không đo được đường       → GIỮ, cờ chuaRoKm, xepThuTu_ đẩy xuống cuối
 * Vì sao giữ tin không đo được: bản sáng 18/09 cắt cứng theo số km đã xoá trắng cả 11 bài Facebook
 * mỗi lượt (bài viết tự do, không có địa chỉ máy đọc được), trong khi tin ghi mỗi "TP.HCM" lại lọt
 * nhờ con số 9,3 km giả — lọc ngược đúng chỗ cần giữ.
 */
function apBanKinh_(viec, cfg, dem) {
  var moc = Number(cfg.banKinh) || 0;
  var gioiHan = moc + (Number(cfg.noiThem) || 0);
  var d = dem || {};
  d.bo = 0; d.ria = 0; d.chuaRo = 0;
  return viec.filter(function (v) {
    var km = v.kmOto != null ? v.kmOto : v.kmChim;
    if (km == null) { v.chuaRoKm = true; d.chuaRo++; return true; }
    if (km > gioiHan) { d.bo++; return false; }
    if (km > moc) { v.hoiXa = true; d.ria++; }
    return true;
  });
}

function kmOto_(goc, v) {
  var dich = (v.lat && v.lng) ? { lat: v.lat, lng: v.lng } : geoCache_(v.diaChi);
  if (!dich) return null;
  var kho = PropertiesService.getScriptProperties();
  var khoa = 'km::' + dich.lat.toFixed(4) + ',' + dich.lng.toFixed(4);
  var da = kho.getProperty(khoa);
  if (da) return parseFloat(da);

  var d = Maps.newDirectionFinder().setOrigin(goc.lat, goc.lng).setDestination(dich.lat, dich.lng)
    .setMode(Maps.DirectionFinder.Mode.DRIVING).getDirections();
  if (!d.routes || !d.routes.length) return v.kmChim || null;
  var km = Math.round(d.routes[0].legs[0].distance.value / 100) / 10;
  kho.setProperty(khoa, String(km));
  return km;
}

function geoCache_(diaChi) {
  if (!diaChi) return null;
  var kho = PropertiesService.getScriptProperties();
  var khoa = 'geo::' + diaChi.substring(0, 100);
  var da = kho.getProperty(khoa);
  if (da) return da === 'x' ? null : JSON.parse(da);
  var g = Maps.newGeocoder().setRegion('vn').geocode(diaChi + ', Việt Nam');
  if (g.status === 'OK' && g.results.length) {
    var o = { lat: g.results[0].geometry.location.lat, lng: g.results[0].geometry.location.lng };
    kho.setProperty(khoa, JSON.stringify(o));
    return o;
  }
  kho.setProperty(khoa, 'x');
  return null;
}

function khoangCachChim_(lat1, lng1, lat2, lng2) {
  var R = 6371, rad = Math.PI / 180;
  var dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ====================== BỘ NHỚ (tab ẩn) ====================== */

var COT_BONHO = ['id', 'nguon', 'ten', 'ntd', 'luong', 'diaChi', 'lat', 'lng', 'km',
  'dangLuc', 'gioLam', 'chiTiet', 'yeuCau', 'link', 'lanThay', 'ban', 'lanDau'];

/**
 * Đổi số này mỗi khi CÁCH TRÌNH BÀY hoặc CÁCH ĐỌC dữ liệu đổi — tin cũ trong BỘ NHỚ sẽ bị coi
 * là hết hạn và đọc lại. Bài học 15/09/2026: vá xong gạch đầu dòng và múi giờ mà bảng vẫn y cũ,
 * vì nội dung được lấy lại từ bộ nhớ chứ không đọc lại trang.
 *   1-2: bản đầu · 3: gạch đầu dòng + sửa múi giờ America/New_York → Asia/Ho_Chi_Minh
 *   5 (19/09/2026): đọc chi tiết nay soi CẢ BÀI và kẹp câu bằng chứng ⚑ — tin cũ phải đọc lại
 *     mới hưởng (giữ nội dung cũ trong lúc chờ đọc lại nên bảng không tụt)
 *   4 (18/09/2026): nguồn MWG đọc đủ 8 trang, ghi đúng thương hiệu (Bách Hoá Xanh…) và lấy
 *     địa chỉ + toạ độ nơi làm thật thay cho "Hồ Chí Minh và 15 tỉnh…"
 */
var PHIEN_BAN = 5;

function docBoNho_(ss) {
  var sh = ss.getSheetByName(TAB_BONHO);
  if (!sh || sh.getLastRow() < 2) return {};
  var d = sh.getRange(2, 1, sh.getLastRow() - 1, COT_BONHO.length).getValues();
  var ra = {};
  d.forEach(function (r) {
    if (!r[0]) return;
    var o = {};
    COT_BONHO.forEach(function (c, i) { o[c] = r[i]; });
    ra[String(r[0])] = o;
  });
  return ra;
}

/** Dựng lại tin của một nguồn từ BỘ NHỚ (dùng khi nguồn đó đang hỏng). */
function buTuBoNho_(nho, tenNguon, soNgay) {
  var han = Date.now() - soNgay * 86400000;
  var ra = [];
  Object.keys(nho).forEach(function (id) {
    var o = nho[id];
    if (o.nguon !== tenNguon) return;
    var t = o.lanThay instanceof Date ? o.lanThay.getTime() : 0;
    if (t < han) return;
    ra.push(tin_({
      nguon: o.nguon, id: String(o.id), ten: o.ten, ntd: o.ntd, luong: o.luong,
      diaChi: o.diaChi, lat: Number(o.lat) || null, lng: Number(o.lng) || null,
      chiTiet: o.chiTiet, yeuCau: o.yeuCau, gioLam: o.gioLam, daChiTiet: !!o.chiTiet,
      dangLuc: kepMoc_(Number(o.dangLuc) || 0), link: o.link,
      lanDau: (o.lanDau instanceof Date) ? o.lanDau : (o.lanThay instanceof Date ? o.lanThay : null)
    }));
  });
  return ra;
}

/** Tin nào đã đọc rồi thì lấy lại nội dung + số km, khỏi tải lại trang. */
function gopBoNho_(viec, nho) {
  viec.forEach(function (v) {
    var o = nho[v.id];
    if (!o) return;
    var hetHan = String(o.ban || '') !== String(PHIEN_BAN);
    /* Mốc LẦN ĐẦU THẤY quyết định thứ tự trong bảng — tin cũ không được nhảy lên trên. Bộ nhớ
       đời trước chưa có cột này thì lấy tạm lần thấy gần nhất. */
    v.lanDau = (o.lanDau instanceof Date) ? o.lanDau : (o.lanThay instanceof Date ? o.lanThay : null);
    /* Toạ độ và số km thì cách trình bày không ảnh hưởng — giữ lại để khỏi đo đường lần nữa. */
    /* KHÔNG dùng lại số km đo từ địa chỉ mơ hồ: đó chính là "9,3 km giả" (tâm TP.HCM) mà luật
       18/09/2026 đã cấm đo — giữ lại thì tin cũ vẫn mang con số sai mãi. */
    var kmCu = (o.km !== '' && o.km != null && !isNaN(o.km)) ? Number(o.km) : null;
    if (kmCu != null && !o.lat && diaChiMoHo_(o.diaChi)) kmCu = null;
    if (kmCu != null) v.kmOto = kmCu;
    if (!v.lat && o.lat) { v.lat = Number(o.lat); v.lng = Number(o.lng); }
    /* Bản cũ hết hạn: GIỮ nội dung để tin không rơi khỏi bảng, nhưng để daChiTiet = false cho
       lượt sau đọc lại bằng cách đọc mới (có soi cả bài + kẹp câu bằng chứng). */
    if (hetHan) {
      if (o.chiTiet) { v.chiTiet = o.chiTiet; v.yeuCau = o.yeuCau; v.gioLam = o.gioLam; }
      if (!v.diaChi && o.diaChi) v.diaChi = o.diaChi;
      if (!v.dangLuc && o.dangLuc) v.dangLuc = kepMoc_(Number(o.dangLuc));
      return;
    }
    if (o.chiTiet) { v.chiTiet = o.chiTiet; v.yeuCau = o.yeuCau; v.gioLam = o.gioLam; v.daChiTiet = true; }
    if (!v.diaChi && o.diaChi) v.diaChi = o.diaChi;
    if (!v.dangLuc && o.dangLuc) v.dangLuc = kepMoc_(Number(o.dangLuc));
  });
  return viec;
}

function ghiBoNho_(ss, viec, nho, cfg, them) {
  var nay = new Date();
  var moi = {};
  var dong = function (v) {
    return [v.id, v.nguon, v.ten, v.ntd, v.luong, v.diaChi, v.lat || '', v.lng || '',
      v.kmOto == null ? '' : v.kmOto, v.dangLuc || '', v.gioLam || '', v.chiTiet || '', v.yeuCau || '',
      v.link, nay, PHIEN_BAN, (v.lanDau instanceof Date) ? v.lanDau : nay];
  };
  viec.forEach(function (v) { moi[v.id] = dong(v); });
  /* Tin đã ĐỌC KỸ mà bị loại cũng ghi lại (kèm nội dung) — lượt sau gặp lại thì lấy từ đây,
     khỏi tải trang lần nữa. Không ghi là mỗi giờ đọc lại đúng mấy chục tin đó. */
  (them || []).forEach(function (v) { if (v.id && !moi[v.id]) moi[v.id] = dong(v); });
  /* giữ lại tin cũ chưa quá hạn nhớ, để lần sau gặp lại vẫn không phải tải */
  var hanMs = cfg.ngayNho * 86400000;
  Object.keys(nho).forEach(function (id) {
    if (moi[id]) return;
    var o = nho[id];
    var t = o.lanThay instanceof Date ? o.lanThay.getTime() : 0;
    if (nay.getTime() - t > hanMs) return;
    moi[id] = COT_BONHO.map(function (c) { return o[c]; });
  });

  /* 800 → 2500 (16/09/2026): nay nhớ cả tin đã đọc mà bị loại, 800 dòng là đầy sau vài ngày. */
  /* Trần lấy theo cấu hình, mặc định 5000 (19/09/2026): từ khoá NGHỀ đưa thêm mấy trăm tin mỗi
     ngày — bộ nhớ đầy là đọc lại từ đầu, tốn lượt gọi. */
  var hang = Object.keys(moi).map(function (k) { return moi[k]; }).slice(0, cfg.dongNho || 2500);
  var sh = ss.getSheetByName(TAB_BONHO);
  if (!sh) { sh = ss.insertSheet(TAB_BONHO); sh.hideSheet(); }
  sh.clear();
  sh.getRange(1, 1, 1, COT_BONHO.length).setValues([COT_BONHO]).setFontWeight('bold');
  if (hang.length) sh.getRange(2, 1, hang.length, COT_BONHO.length).setValues(hang);
}

/* ====================== GHI BẢNG ====================== */

function ghiBang_(ss, viec) {
  var sh = tabKetQua_(ss);
  var nay = new Date();
  var hang = viec.map(function (v) {
    return [
      /* Chạy lại gạch đầu dòng lúc ghi: tin lấy từ BỘ NHỚ (định dạng đời cũ) cũng được tách dòng
         mà không phải đọc lại trang. Hàm này chạy lặp không đổi kết quả. */
      v.nguon, v.loaiViec || loaiViec_(v), v.ten, gachDauDong_(v.chiTiet) || '—', gachDauDong_(v.yeuCau) || '—',
      (v.gioLam && v.gioLam !== '—') ? v.gioLam : 'Chưa nêu giờ',
      v.luong || 'Thoả thuận', chuanDiaChi_(v.diaChi),
      (v.kmOto != null ? v.kmOto + ' km' : (v.kmChim != null ? '~' + v.kmChim.toFixed(1) + ' km (chim bay)' : 'chưa rõ')),
      v.ntd || '—',
      v.dangLuc ? new Date(v.dangLuc * 1000) : '', '', '', nhan_(v, nay)
    ];
  });

  sh.clear();
  sh.getRange(1, 1, 1, TIEU_DE.length).setValues([TIEU_DE]);
  sh.getRange(2, 1, hang.length, TIEU_DE.length).setValues(hang);

  /* cột "Đăng cách đây" là CÔNG THỨC (NOW) nên tự đếm tiếp, không phải chữ chết */
  var sep = nganCachCongThuc_(ss);
  var chuCotNgay = String.fromCharCode(64 + COT_NGAYDANG);   // cột Ngày đăng, suy từ số cột — thêm cột không phải sửa tay
  var ct = viec.map(function (v, i) {
    var o = chuCotNgay + (i + 2);
    return ['=IF(' + o + '=""' + sep + '"—"' + sep +
      'IF(NOW()-' + o + '<0' + sep + '"vừa đăng"' + sep +
      'IF(NOW()-' + o + '<1/24' + sep + 'ROUND((NOW()-' + o + ')*1440)&" phút trước"' + sep +
      'IF(NOW()-' + o + '<1' + sep + 'ROUND((NOW()-' + o + ')*24)&" giờ trước"' + sep +
      'ROUND(NOW()-' + o + ')&" ngày trước"))))'];
  });
  sh.getRange(2, COT_CACHDAY, ct.length, 1).setFormulas(ct);

  var link = viec.map(function (v) {
    return [SpreadsheetApp.newRichTextValue().setText('Ứng tuyển').setLinkUrl(v.link).build()];
  });
  sh.getRange(2, COT_LINK, link.length, 1).setRichTextValues(link);

  sh.getRange(1, TIEU_DE.length + 1).setValue('Cập nhật: ' +
    Utilities.formatDate(nay, 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm') + ' · ' + viec.length + ' việc');

  dinhDang_(sh, hang.length + 1);
  donDuThua_(sh, hang.length + 1, TIEU_DE.length + 1);
  vaCongThucNeuLoi_(sh, hang.length, sep, ss);
}

/**
 * Bảng tính tiếng Việt dùng dấu ";" ngăn tham số, bảng tiếng Anh dùng ",".
 * Đoán theo ngôn ngữ của file; nếu đoán sai (ô hiện #ERROR!) thì viết lại bằng dấu kia
 * và nhớ luôn cho lần sau — khỏi phải sửa tay.
 */
function nganCachCongThuc_(ss) {
  var kho = PropertiesService.getScriptProperties();
  var da = kho.getProperty('ngan_cach');
  if (da) return da;
  var loc = '';
  try { loc = ss.getSpreadsheetLocale() || ''; } catch (e) { loc = ''; }
  return /^en|^ja|^ko|^zh|^th|^ms|^he/.test(loc) ? ',' : ';';
}

function vaCongThucNeuLoi_(sh, soDong, sep, ss) {
  if (!soDong) return;
  SpreadsheetApp.flush();
  var o = sh.getRange(2, COT_CACHDAY).getDisplayValue();
  if (String(o).indexOf('#') !== 0) {
    PropertiesService.getScriptProperties().setProperty('ngan_cach', sep);
    return;
  }
  var kia = sep === ';' ? ',' : ';';
  var ct = sh.getRange(2, COT_CACHDAY, soDong, 1).getFormulas()
    .map(function (r) { return [String(r[0]).split(sep).join(kia)]; });
  sh.getRange(2, COT_CACHDAY, soDong, 1).setFormulas(ct);
  PropertiesService.getScriptProperties().setProperty('ngan_cach', kia);
}

/** "HCMC" của hoteljob đọc không quen mắt — đổi về cách viết quen thuộc. */
function chuanDiaChi_(dc) {
  dc = String(dc || '').trim();
  if (!dc) return '—';
  return dc.replace(/\bHCMC\b/gi, 'TP.HCM');
}

function nhan_(v, nay) {
  var n = [];
  if (v.moiThay) n.push('MỚI');
  if (v.dangLuc) {
    var ngay = (nay.getTime() / 1000 - v.dangLuc) / 86400;
    if (ngay <= 3) n.push('Mới');
    else if (ngay >= 45) n.push('Tin cũ');
  }
  if (v.congTyTheoDoi) n.push('Theo dõi: ' + v.congTyTheoDoi);
  if (v.hoiXa) n.push('Hơi xa');
  if (v.chuaRoKm) n.push('Chưa đo được khoảng cách');
  if (v.xoayCa) n.push('Tham khảo (xoay ca, không phải ca đêm cố định)');
  if (v.telesale) n.push('Telesale');
  if (v.luongMin >= 20000000) n.push('Lương cao bất thường');
  return n.join(' · ');
}

function dinhDang_(sh, soDong) {
  var cot = TIEU_DE.length;
  RONG_COT.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.getRange(1, 1, 1, cot)
    .setBackground('#1c4587').setFontColor('#ffffff').setFontWeight('bold').setFontSize(10)
    .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
  sh.setFrozenRows(1);
  if (soDong <= 1) return;

  var n = soDong - 1;
  var than = sh.getRange(2, 1, n, cot);

  /* MỌI cột đều xuống dòng. Bản trước để phần lớn cột "cắt gọn" cho dòng thấp, hậu quả là
     chữ dài bị che mất đuôi — user bắt đúng ô "Ca đêm (tin không nêu giờ)" bị cụt (15/09/2026).
     Thà dòng cao hơn một chút còn hơn giấu mất chữ. */
  than.setFontSize(10).setVerticalAlignment('top')
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP)
    .setBorder(true, true, true, true, true, true, '#d7dbe0', SpreadsheetApp.BorderStyle.SOLID);

  /* Kẻ vạch màu xen kẽ cho dễ dò ngang — xoá vạch cũ trước, không thì mỗi lượt chồng thêm một lớp. */
  sh.getBandings().forEach(function (b) { b.remove(); });
  than.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, false, false);

  sh.getRange(2, 1, n, 2).setHorizontalAlignment('center');
  sh.getRange(2, COT_GIO, n, 1).setHorizontalAlignment('center').setFontWeight('bold');
  sh.getRange(2, COT_LUONG, n, 1).setHorizontalAlignment('center');
  sh.getRange(2, COT_KM, n, 1).setHorizontalAlignment('center').setFontWeight('bold').setFontColor('#0d7326');
  sh.getRange(2, COT_NGAYDANG, n, 1).setHorizontalAlignment('center')
    .setNumberFormat('dd/MM/yyyy HH:mm');
  sh.getRange(2, COT_CACHDAY, n, 1).setHorizontalAlignment('center').setFontWeight('bold');
  sh.getRange(2, COT_LINK, n, 1).setHorizontalAlignment('center').setFontWeight('bold');
  sh.getRange(2, cot, n, 1).setHorizontalAlignment('center').setFontWeight('bold').setFontColor('#d92626');
}

/** Cắt bỏ hàng/cột trống phía dưới và bên phải để bảng dừng đúng chỗ hết dữ liệu. */
function donDuThua_(sh, soDong, soCot) {
  var r = sh.getMaxRows();
  if (r > soDong) sh.deleteRows(soDong + 1, r - soDong);
  var c = sh.getMaxColumns();
  if (c > soCot) sh.deleteColumns(soCot + 1, c - soCot);
}

function tabKetQua_(ss) {
  var ds = ss.getSheets();
  for (var i = 0; i < ds.length; i++) if (ds[i].getSheetId() === 0) return ds[i];
  return ds[0];
}

/* ====================== CẤU HÌNH · TRANG CÔNG TY · NHẬT KÝ ====================== */

function docCauHinh_(ss) {
  var sh = ss.getSheetByName(TAB_CAUHINH);
  if (!sh) {
    sh = ss.insertSheet(TAB_CAUHINH);
    sh.getRange(1, 1, 1, 2).setValues([['Mục', 'Giá trị']])
      .setBackground('#1c4587').setFontColor('#ffffff').setFontWeight('bold');
    sh.getRange(2, 1, MAC_DINH.length, 2).setValues(MAC_DINH);
    sh.setColumnWidth(1, 360); sh.setColumnWidth(2, 420);
    sh.getRange(MAC_DINH.length + 3, 1).setValue(
      'Sửa cột "Giá trị" rồi bấm menu Việc ca đêm > Cào ngay là áp dụng ngay. Để trống = dùng mặc định.');
  }

  var d = sh.getDataRange().getValues();
  var v = {}, dong = {};
  d.forEach(function (r, i) { if (r[0]) { v[String(r[0]).trim()] = r[1]; dong[String(r[0]).trim()] = i + 1; } });

  /* Tab tạo từ bản cũ sẽ thiếu các mục thêm sau này — bổ sung vào cuối, KHÔNG đụng dòng user đã sửa.
     (15/09/2026: tab của user vẫn là bản đời đầu, thiếu 8 mục nên user không thấy mà chỉnh.) */
  var thieu = MAC_DINH.filter(function (m) { return !(m[0] in v); });
  if (thieu.length) {
    var cuoi = sh.getLastRow() + 1;
    sh.getRange(cuoi, 1, thieu.length, 2).setValues(thieu);
    sh.getRange(cuoi, 1, thieu.length, 1).setFontColor('#1c4587');
    thieu.forEach(function (m) { v[m[0]] = m[1]; });
  }

  var lay = function (ten, md) { var x = v[ten]; return (x === '' || x === undefined || x === null) ? md : x; };
  var toaDo = String(lay('Toạ độ dự phòng (lat,lng)', '10.8860463,106.5927134')).split(',');

  return {
    diemXuatPhat: String(lay('Điểm xuất phát (để đo khoảng cách)', MAC_DINH[0][1])).trim(),
    duPhongLat: parseFloat(toaDo[0]) || 10.8860463,
    duPhongLng: parseFloat(toaDo[1]) || 106.5927134,
    banKinh: Number(lay('Bán kính tối đa (km)', 20)) || 20,
    noiThem: Math.max(0, Number(lay('Nới thêm cho tin ở rìa (km)', 5)) || 0),
    tuKhoa: String(lay('Từ khoá tìm (cách nhau bằng dấu phẩy)', MAC_DINH[3][1]))
      .split(',').map(function (s) { return s.trim(); }).filter(String),
    soTrang: Number(lay('Số trang mỗi từ khoá (vieclam24h)', 2)) || 2,
    tuKhoaNghe: String(lay('Từ khoá NGHỀ hay làm đêm (tìm rộng rồi đọc kỹ)', ''))
      .split(',').map(function (x) { return x.trim(); }).filter(String).slice(0, 15),
    /* User chốt 18/09/2026: "có nhiêu nâng nhiêu" — 0 nghĩa là không giới hạn. Vẫn chặn cứng ở
       TRAN_CUNG dòng để một lượt xui không đổ mấy nghìn dòng vào bảng. */
    toiDa: (function () {
      var x = lay('Số việc ghi ra tối đa', 300);
      var n = Number(x);
      if (x === '' || x === null || x === undefined || isNaN(n)) return 300;
      return n <= 0 ? TRAN_CUNG_ : Math.min(n, TRAN_CUNG_);
    })(),
    tinTrongNgay: Number(lay('Chỉ lấy tin đăng trong (ngày)', 45)) || 45,
    moiMayGio: Math.min(24, Math.max(1, Number(lay('Cò tự động: mấy giờ chạy một lần', 1)) || 1)),
    layChiTiet: coKhong_(lay('Lấy nội dung chi tiết từng tin', 'Có')),
    telesale: kieuTelesale_(lay('Việc telesale (Loại bỏ / Xuống cuối / Giữ)', 'Loại bỏ')),
    dichTiengAnh: coKhong_(lay('Dịch tin tiếng Anh sang tiếng Việt', 'Có')),
    batVl24h: coKhong_(lay('Bật nguồn vieclam24h.vn', 'Có')),
    batHoteljob: coKhong_(lay('Bật nguồn hoteljob.vn', 'Có')),
    batCareerviet: coKhong_(lay('Bật nguồn careerviet.vn', 'Có')),
    batJobsgo: coKhong_(lay('Bật nguồn jobsgo.vn (hay chặn, đo trên máy chủ Google toàn 403)',
      lay('Bật nguồn jobsgo.vn', 'Không'))),
    batTgdd: coKhong_(lay('Bật nguồn vieclam.thegioididong.com', 'Có')),
    soTrangTgdd: Math.min(10, Math.max(1, Number(lay('MWG (Thế Giới Di Động + Bách Hoá Xanh + An Khang…): mấy trang mỗi lượt (20 tin/trang)', 8)) || 8)),
    batFacebook: coKhong_(lay('Bật nguồn Facebook (bài do tiện ích gửi về)', 'Có')),
    batTopcv: coKhong_(lay('Bật nguồn topcv.vn (hay bị chặn, bật cũng thường trả 403)', 'Không')),
    batCongTy: coKhong_(lay('Bật nguồn trang công ty (tab TRANG CÔNG TY)', 'Có')),
    congTyCaoMoiLuot: Math.min(15, Math.max(0, Number(lay('Trang công ty: máy chủ tự quét mấy công ty mỗi lượt', 4)) || 0)),
    tinMoiCongTy: Math.min(20, Math.max(1, Number(lay('Trang công ty: đọc tối đa mấy tin mới mỗi công ty', 8)) || 8)),
    batTheoDoi: coKhong_(lay('Tìm theo tên công ty theo dõi (tab CÔNG TY THEO DÕI)', 'Có')),
    congTyMoiLuot: Math.min(20, Math.max(1, Number(lay('Công ty theo dõi: mấy tên mỗi lượt', 5)) || 5)),
    ngayNho: Number(lay('Số ngày giữ tin trong BỘ NHỚ', 60)) || 60,
    dongNho: Math.min(20000, Math.max(500, Number(lay('Số dòng tối đa trong BỘ NHỚ', 5000)) || 5000)),
    batChotot: coKhong_(lay('Bật nguồn vieclamtot.com (Chợ Tốt: bảo vệ, kho, quán, xưởng…)', 'Có')),
    soTrangChotot: Math.min(12, Math.max(1, Number(lay('Chợ Tốt: mấy trang mỗi lượt (50 tin/trang)', 7)) || 7)),
    trangChototLongAn: Math.min(4, Math.max(1, Number(lay('Chợ Tốt: mấy trang cho Long An', 2)) || 2)),
    chiTietMoiLuot: Math.min(300, Math.max(10, Number(lay('Đọc chi tiết tối đa mấy tin mỗi lượt (hoteljob + MWG)', 90)) || 90)),
    docKyToiDa: Math.min(150, Math.max(0, Number(lay('Đọc kỹ tối đa mấy tin "mơ hồ" mỗi lượt (tiêu đề không có chữ đêm)', 60))))
  };
}

/* Trang tuyển dụng công ty gieo sẵn (user 15/09/2026: TGDĐ chỉ là ví dụ, cần MỌI web công ty có
   ca 19h-8h). Đây là trang DANH SÁCH việc; tiện ích tự mở từng việc bên trong để đọc giờ ca. */
function docTrangCongTy_(ss) {
  /* Trang tuyển dụng (cột B của NGUỒN CÔNG TY) cho tiện ích mở từng việc. */
  return docNguonCongTy_(ss).map(function (c) { return c.trang; })
    .filter(function (u) { return u.indexOf('http') === 0; })
    .slice(0, 60);
}

function ghiNhatKy_(ss, kieu, ketQua, log, t0, soViec) {
  var sh = ss.getSheetByName(TAB_NHATKY);
  if (!sh) {
    sh = ss.insertSheet(TAB_NHATKY);
    sh.getRange(1, 1, 1, 5).setValues([['Thời điểm', 'Kiểu chạy', 'Kết quả', 'Số việc ghi ra', 'Chi tiết từng nguồn']])
      .setBackground('#1c4587').setFontColor('#ffffff').setFontWeight('bold');
    sh.setColumnWidth(1, 150); sh.setColumnWidth(2, 110); sh.setColumnWidth(3, 200);
    sh.setColumnWidth(4, 110); sh.setColumnWidth(5, 760);
    sh.setFrozenRows(1);
  }
  sh.insertRowAfter(1);
  sh.getRange(2, 1, 1, 5).setValues([[
    Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm:ss'),
    kieu, ketQua, soViec,
    log.join(' | ') + '  [' + Math.round((Date.now() - t0) / 1000) + 's]'
  ]]).setWrap(true).setVerticalAlignment('middle').setFontSize(9);
  if (sh.getLastRow() > 200) sh.deleteRows(201, sh.getLastRow() - 200);
}

/* ====================== THỬ NGUỒN ====================== */

function kiemTraNguon() {
  var t = Date.now();
  var ds = [
    ['vieclam24h', 'https://vieclam24h.vn/tim-kiem-viec-lam-nhanh?q=' + encodeURIComponent('ca đêm'), phanTichVl24hDanhSach_],
    ['hoteljob', 'https://www.hoteljob.vn/tim-viec?keyword=' + encodeURIComponent('ca đêm') + '&city_id=3', phanTichHoteljob_],
    ['careerviet', 'https://careerviet.vn/viec-lam/ca-dem-k-vi.html', phanTichCareerviet_],
    ['jobsgo', 'https://jobsgo.vn/viec-lam-ca-dem-tai-ho-chi-minh.html', phanTichJobsgo_],
    ['thegioididong', 'https://vieclam.thegioididong.com/tuyen-dung?kv=thanh-pho-ho-chi-minh', phanTichTgdd_],
    ['vieclamtot (Chợ Tốt)', urlChotot_('ca đêm', 1), phanTichChotot_],
    ['topcv', 'https://www.topcv.vn/tim-viec-lam-ca-dem-tai-ho-chi-minh-kl2', phanTichTopcv_]
  ];
  var tra = taiNhieu_(ds.map(function (x) { return x[1]; }));
  var ra = tra.map(function (r, i) {
    var so = 0;
    try { so = r.ma === 200 ? ds[i][2](r.noiDung).length : 0; } catch (e) { so = -1; }
    return ds[i][0] + ': HTTP ' + r.ma + ', ' + Math.round(r.noiDung.length / 1024) + ' KB, bóc được ' + so + ' tin';
  });
  ra.push('Tổng thời gian tải song song: ' + Math.round((Date.now() - t) / 1000) + ' giây.');
  bao_(ra.join('\n'));
}

/* ====================== TIỆN ÍCH ====================== */

/* vieclam24h đặt "refresh_at" là lần LÀM MỚI KẾ TIẾP nên có tin nằm ở tương lai → ra
   "-627 phút trước". Mốc nào vượt quá hiện tại thì kéo về hiện tại. */
function kepMoc_(giay) {
  var nay = Math.round(Date.now() / 1000);
  giay = Number(giay) || 0;
  return giay > nay ? nay : giay;
}

function tin_(o) {
  o.chiTiet = o.chiTiet || '';
  o.yeuCau = o.yeuCau || '';
  o.gioLam = o.gioLam || '';
  o.lat = o.lat || null;
  o.lng = o.lng || null;
  o.dangLuc = kepMoc_(o.dangLuc);
  o.luongMin = o.luongMin || 0;
  o.kmOto = null;
  return o;
}

function jsonNextData_(html) {
  var m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) return {};
  try { return JSON.parse(m[1]); } catch (e) { return {}; }
}

function boHtml_(s) {
  return String(s || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ').replace(/<\/p>/gi, ' ').replace(/<li>/gi, '• ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    /* Trang Thế Giới Di Động ghi tiêu đề bằng mã số (&#xE2; = â) — không giải thì ra chữ vỡ. */
    .replace(/&#x([0-9a-fA-F]+);/g, function (_, x) { return String.fromCharCode(parseInt(x, 16)); })
    .replace(/&#(\d+);/g, function (_, d) { return String.fromCharCode(Number(d)); })
    .replace(/\s+/g, ' ').trim();
}

/**
 * Như boHtml_ nhưng GIỮ xuống dòng: mỗi <p>, <br>, <li> thành một dòng riêng.
 * Cần cho cột Chi tiết / Yêu cầu — viết liền một mạch thì không đọc nổi.
 */
function boHtmlDong_(s) {
  return String(s || '').replace(/\r/g, '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#x([0-9a-fA-F]+);/g, function (_, x) { return String.fromCharCode(parseInt(x, 16)); })
    .replace(/&#(\d+);/g, function (_, d) { return String.fromCharCode(Number(d)); })
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/** Mỗi dòng một gạch đầu dòng, bỏ các dấu -, +, * lộn xộn của nhà tuyển dụng. */
function gachDauDong_(chu) {
  if (!chu) return '';
  /* Nhiều tin viết cả đoạn thành MỘT câu với dấu "•" chèn giữa ("• Nam, khoẻ • Có xe máy • Bằng lái")
     — trang gốc không xuống dòng thì mình phải tự cắt tại các dấu đầu dòng chèn giữa câu
     (kể cả ✔ ✅ 👉 🔹 ► hay dùng trên Facebook). User bắt được 15/09/2026 tối. */
  var d = String(chu).replace(/\r/g, '')
    .replace(/[ \t]+([•●▪◦■►▶➤✔✅✓👉🔹🔸📌➡]️?)[ \t]*/g, '\n$1 ')
    .split('\n');
  var ra = [];
  for (var i = 0; i < d.length; i++) {
    var dong = d[i].replace(/^[\s•\-\+\*·•●▪◦■►▶➤✔✅✓\u{1F449}\u{1F539}\u{1F538}\u{1F4CC}➡️]+/u, '').trim();
    if (dong.length > 1) ra.push('• ' + dong);
  }
  return ra.join('\n');
}

function catChu_(s, n) { s = String(s || ''); return s.length > n ? s.substring(0, n - 1) + '…' : s; }

/**
 * Tin tiếng Anh thì dịch sang tiếng Việt bằng dịch vụ dịch sẵn có của Google (không cần khoá,
 * không tốn tiền). Nhận diện: không có chữ nào mang dấu tiếng Việt VÀ có ít nhất 3 từ Anh thông dụng
 * — đủ chặt để không đụng vào tin tiếng Việt viết không dấu.
 * Lưu ý thật lòng: đây là máy dịch, đọc hiểu được nhưng không mượt như người dịch.
 */
function laTiengAnh_(chu) {
  chu = String(chu || '');
  if (chu.length < 12) return false;
  if (/[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụỳýỷỹỵ]/i.test(chu)) return false;
  var tu = chu.match(/\b(the|and|of|for|with|you|your|will|are|our|team|shift|night|hotel|customer|service|experience|responsibilities|requirements|work|working|skills|salary|benefits|company|staff|manager|support|english|guest|duty)\b/gi);
  return !!tu && tu.length >= 3;
}

function dichSangViet_(chu) {
  if (!laTiengAnh_(chu)) return chu;
  try {
    var ra = LanguageApp.translate(String(chu), 'en', 'vi');
    return (ra && ra.length > 3) ? ra : chu;
  } catch (e) {
    return chu;   // hết lượt dịch trong ngày hoặc dịch vụ bận — giữ nguyên bản gốc
  }
}

function khongDau_(s) {
  /* Gom mọi loại khoảng trắng (kể cả NBSP \\u00a0, khoảng hẹp \\u202f mà web hay chèn) về một dấu cách —
     không thì "Chăm sóc\\u00a0Khách hàng" lọt qua bộ lọc telesale (15/09/2026). */
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
    .replace(/[\s  -​ 　]+/g, ' ').trim();
}

function khongDauGach_(s) {
  return khongDau_(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** "11 phút trước" / "2 tuần trước" / "3 ngày trước" → mốc thời gian (giây). */
function chuTruocSangGiay_(chu) {
  var m = String(chu || '').match(/(\d+)\s*(phút|giờ|ngày|tuần|tháng)/);
  if (!m) return 0;
  var n = parseInt(m[1], 10);
  var giay = { 'phút': 60, 'giờ': 3600, 'ngày': 86400, 'tuần': 604800, 'tháng': 2592000 }[m[2]] || 0;
  return Math.round(Date.now() / 1000) - n * giay;
}

/** ["09","09","2026"] (dd, mm, yyyy) → giây. */
function ngayVnSangGiay_(p) {
  if (!p || p.length < 3) return 0;
  return Math.round(new Date(+p[2], +p[1] - 1, +p[0]).getTime() / 1000);
}

function dinhDangLuong_(min, max) {
  min = Number(min) || 0; max = Number(max) || 0;
  var n = function (x) { return String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
  if (min && max) return n(min) + ' - ' + n(max) + ' đ/tháng';
  if (min) return 'Từ ' + n(min) + ' đ/tháng';
  if (max) return 'Đến ' + n(max) + ' đ/tháng';
  return 'Thoả thuận';
}

function so2_(x) { x = String(x || '0'); return x.length < 2 ? '0' + x : x; }
function coKhong_(x) { return khongDau_(String(x)).indexOf('co') === 0 || String(x) === 'true' || x === true; }
function hetGio_(t0) { return Date.now() - t0 > 270000; }

/* Mốc bắt đầu lượt chạy — để ở biến chung nên MỌI vòng tải đều soi được, kể cả hàm không nhận t0.
   Trần của Google là 6 phút; quá 210 giây thì ngừng tải thêm để còn kịp ghi bảng và BỘ NHỚ.
   Bài học 19/09/2026: lượt đầu sau khi mở thêm nguồn chạy quá giờ → Google giết giữa chừng,
   KHÔNG ghi được gì, công đọc mấy trăm trang mất trắng và lượt sau lặp lại y hệt. */
var MOC_CHAY_ = 0;
var NGAN_SACH_TAI_MS = 210000;
function conGioTai_() { return !MOC_CHAY_ || (Date.now() - MOC_CHAY_) < NGAN_SACH_TAI_MS; }

/** Bảng tính đang mở; nếu chạy từ trình soạn thảo thì mở theo id. */
function bang_() {
  var ss = null;
  try { ss = SpreadsheetApp.getActive(); } catch (e) { ss = null; }
  return ss || SpreadsheetApp.openById(ID_BANG);
}

function bao_(chu) {
  Logger.log(chu);
  try { SpreadsheetApp.getUi().alert(chu); return; } catch (e) { /* không có giao diện */ }
  try { bang_().toast(chu, 'Việc ca đêm', 15); } catch (e2) { /* chạy theo lịch: chỉ ghi log */ }
}
