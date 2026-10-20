/* google-script-InTem.gs — tách từ google-script.gs ngày 20/10/2026 (đánh giá: 1 tệp 3.7k dòng / 81 lệnh khó soát).
 * Mục: in tem SKU: hàng đợi Script Properties (pr_*), sổ IN-TEM-CHO.
 * Cùng một dự án Apps Script → dùng chung hằng/hàm ở google-script.gs (SECRET, keyBodyOK_, phanHoiJson…). KHÔNG đặt bí mật ở tệp này.
 * deploy-gas.mjs chép sang .clasp-deploy/InTem.js — nhớ chạy qc-gas-gac.mjs (bảng lệnh–gác). */
/* ═══════════════════════════════════════════════════════════════════════════════════════════════
 *  HÀNG ĐỢI IN TEM SKU — BẢN "TỨC THÌ" (20/08/2026)
 *  ---------------------------------------------------------------------------------------------
 *  Vì sao phải có hàng đợi: máy in tem cắm USB vào một máy trong kho, còn người bấm thì đứng ngoài
 *  kho với cái điện thoại. Trình duyệt không nói được với máy in (web thuần không liệt kê nổi máy
 *  in, `http://127.0.0.1` bị Private Network Access chặn, Android/iOS không hiểu máy in share kiểu
 *  Windows). Nên đường duy nhất không cần xin IT là: cả hai đầu chỉ gọi RA NGOÀI.
 *
 *      điện thoại/PC ──(pr_them)──► HÀNG ĐỢI ◄──(pr_lay/pr_xong)── agent máy trạm ──► máy in tem
 *
 *  VÌ SAO HÀNG ĐỢI SỐNG KHÔNG CÒN NẰM Ở SHEET (đo thật 20/08/2026, người bấm nói đúng: "sao lâu"):
 *    · mỗi lượt gọi Apps Script đã mất ~1,1s trần — chuỗi chuyển hướng của Google, không cắt được;
 *    · `SpreadsheetApp.openById` cộng thêm 1,1–2,4s NỮA cho MỌI lượt, kể cả lượt hỏi lúc hàng đợi
 *      đang trống — mà agent thì hỏi liên tục. Đo được: pr_lay 3,5s · pr_trangthai 2,2s → vòng quét
 *      agent 6,5s, cộng pr_them nữa thì bấm xong phải đợi ~10s mới nghe máy in kêu.
 *  Nên hàng đợi SỐNG chuyển sang **Script Properties**: đọc/ghi ~50ms, và KHÔNG bị đuổi giữa đường
 *  như CacheService (mất một lệnh in nghĩa là tem không bao giờ ra mà chẳng ai biết vì sao).
 *  Sheet `IN-TEM-CHO` vẫn còn nguyên nhưng hạ xuống làm SỔ LƯU: chỉ ghi lúc agent rảnh, ngoài
 *  đường găng — ai in bao nhiêu tem vẫn đối chiếu được, mà không ai phải đợi cái ghi đó.
 *
 *  Giới hạn đã tính trước: 9KB cho MỖI property (một lệnh 40 SKU ~4KB — vừa; dài hơn PR_TRAN_KY_TU
 *  thì chối thẳng chứ không ghi hụt rồi im lặng), 500KB cả kho → chốt PR_TRAN_SONG lệnh sống.
 *
 *  MỘT LỆNH = một property `PRQ_<id>`:
 *      { id, nguoi, soTem, ts, tt, dong, nhan, xongLuc, ghiChu, luu }
 *      tt:  cho → dang_in → xong | loi          luu: 0 = chưa vào sổ lưu
 *  `PR_IDS` giữ thứ tự các lệnh còn sống, `PR_NHIP` là nhịp tim của agent.
 * ═══════════════════════════════════════════════════════════════════════════════════════════════ */
var PR_TAB = 'IN-TEM-CHO';
var PR_HEADER = ['id', 'luc_gui', 'nguoi', 'trang_thai', 'so_tem', 'json_dong', 'luc_nhan', 'luc_xong', 'ghi_chu'];
var PR_TRAN_DONG = 40;            // trần số SKU một lệnh — chặn gửi cả danh mục vì bấm nhầm
var PR_TRAN_TEM = 400;            // trần số con tem một lệnh
var PR_TRAN_KY_TU = 8500;         // trần độ dài JSON một lệnh (property tối đa 9KB — payload có
                                  // thêm tên sản phẩm nên 40 SKU rơi vào khoảng 7KB)
var PR_TRAN_SONG = 30;            // số lệnh giữ trong hàng đợi nhanh
var PR_GIU_XONG = 15 * 60000;     // giữ lệnh đã xong 15' để dashboard còn hỏi được trạng thái
var PR_TREO = 10 * 60000;         // dang_in quá 10' coi như treo (agent chết giữa đợt)
var PR_GIU_NGAY = 7;              // sổ lưu giữ 7 ngày
var PR_P_IDS = 'PR_IDS';
var PR_P_TIEN = 'PRQ_';
var PR_P_NHIP = 'PR_NHIP';
var PR_P_LUU = 'PR_LUU_LUC';
var PR_P_MAY = 'PR_MAY';        // tình trạng máy in do agent gửi kèm mỗi lượt hỏi việc
var PR_MAY_HET = 45000;         // tình trạng cũ hơn 45 giây thì coi như KHÔNG BIẾT (agent có thể đã tắt)
var PR_P_XEM = 'PR_XEM';        // lần cuối có người MỞ pop-up In tem (dashboard hỏi hàng đợi)
var PR_XEM_LAU = 45000;         // trong 45 giây đó thì agent đọc máy in dày hơn

function prSP_() { return PropertiesService.getScriptProperties(); }
/* ── TÌNH TRẠNG MÁY IN (21/08/2026) ──────────────────────────────────────────────────────────────
 * Sự cố: máy in hết giấy mà dashboard không báo gì; người dùng bấm ép in 4 lần rồi lắp cuộn mới vẫn
 * không ra tem. Gốc: `WritePrinter` báo OK ngay khi spooler nhận byte, không liên quan tới giấy.
 * Nay agent đọc thật (Get-Printer + WMI + queue) rồi gửi kèm MỖI lượt `pr_lay`; chỗ này giữ lại để
 * dashboard đọc được, và để `apiPrLay` KHÔNG phát việc khi máy đang chặn — lệnh nằm lại ở `cho` và
 * tự in tiếp khi máy in xong, người dùng không phải bấm lại lần nào.
 * ────────────────────────────────────────────────────────────────────────────────────────────────── */
/* CÓ NGƯỜI ĐANG XEM? Dashboard hỏi hàng đợi (mở pop-up In tem) thì đóng dấu ở đây; agent đọc cờ đó
   để chuyển sang đọc tình trạng máy in mỗi 0,7 giây thay vì 12 giây. Đọc dày cả ngày thì tốn CPU máy
   trạm vô ích, mà đọc thưa lúc người ta đang đứng nhìn thì trạng thái trễ — nên để chính người xem
   bật nó lên. */
function prXemGhi_() {
  try { prSP_().setProperty(PR_P_XEM, String(new Date().getTime())); } catch (e) {}
}
function prCoNguoiXem_(all) {
  try {
    var t = Number((all ? all[PR_P_XEM] : prSP_().getProperty(PR_P_XEM)) || 0);
    return t > 0 && new Date().getTime() - t < PR_XEM_LAU;
  } catch (e) { return false; }
}
function prMayGhi_(sp, chuoi) {
  if (!chuoi) return;
  try { sp.setProperty(PR_P_MAY, JSON.stringify({ tt: String(chuoi).slice(0, 400), luc: new Date().getTime() })); } catch (e) {}
}
/** Tình trạng máy in kèm tuổi. `ro:true` = quá cũ, đừng tin (agent có thể đã tắt). */
function prMayDoc_(all) {
  var o = null;
  try { o = JSON.parse((all ? all[PR_P_MAY] : prSP_().getProperty(PR_P_MAY)) || 'null'); } catch (e) { o = null; }
  if (!o || !o.luc) return { co: false };
  var tre = new Date().getTime() - Number(o.luc);
  var tt = {};
  try { tt = JSON.parse(o.tt); } catch (e) { tt = {}; }
  return { co: true, tre: tre, ro: tre > PR_MAY_HET, chu: String(tt.chu || ''), chan: !!tt.chan && tre <= PR_MAY_HET,
    canh: !!tt.canh, job: Number(tt.job), ma: String(tt.ma || '') };
}
function prIds_(all) { try { return JSON.parse(all[PR_P_IDS] || '[]') || []; } catch (e) { return []; } }
function prLenh_(all, id) { try { return JSON.parse(all[PR_P_TIEN + id] || 'null'); } catch (e) { return null; } }

function prSheet_() {
  var ss = SpreadsheetApp.openById(STOCKLOC_SHEET_ID);
  var sh = ss.getSheetByName(PR_TAB);
  if (!sh) {
    sh = ss.insertSheet(PR_TAB);
    sh.getRange(1, 1, 1, PR_HEADER.length).setValues([PR_HEADER])
      .setFontWeight('bold').setBackground('#0f766e').setFontColor('#ffffff');
    try { sh.setFrozenRows(1); } catch (e) {}
  }
  return sh;
}

/** Dashboard gửi một lệnh in. PUBLIC — tự bảo vệ bằng trần dòng/tem/độ dài và chống gửi trùng 5 giây.
 *  KHÔNG mở Sheet: đây là chặng người dùng đang ngồi đợi. */
function apiPrThem(duLieu) {
  var dong;
  try { dong = JSON.parse(String(duLieu.dong || '[]')); } catch (e) { dong = null; }
  if (!dong || !dong.length) return phanHoiJson({ status: 'error', message: 'Danh sách in trống.' });
  if (dong.length > PR_TRAN_DONG) return phanHoiJson({ status: 'error', message: 'Một lệnh in tối đa ' + PR_TRAN_DONG + ' SKU.' });
  var tong = 0;
  for (var i = 0; i < dong.length; i++) tong += Math.max(1, Number(dong[i].sl) || 1);
  if (tong > PR_TRAN_TEM) return phanHoiJson({ status: 'error', message: 'Một lệnh in tối đa ' + PR_TRAN_TEM + ' con tem.' });
  var chuoi = JSON.stringify(dong);
  if (chuoi.length > PR_TRAN_KY_TU) return phanHoiJson({ status: 'error', message: 'Lệnh in quá dài — hãy chia thành hai lượt.' });

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(8000)) return phanHoiJson({ status: 'error', message: 'Đang có lệnh khác ghi vào hàng đợi — thử lại sau vài giây.' });
  try {
    var sp = prSP_(), all = sp.getProperties(), ids = prIds_(all), now = new Date().getTime();
    var nguoi = String(duLieu.nguoi || '').slice(0, 60);
    /* CHỐNG GỬI TRÙNG: bấm hai lần vì mạng chậm là chuyện thường, mà mỗi lần bấm là tem thật ra khỏi
       máy in. Cùng người + cùng nội dung trong 5 giây thì coi là một lệnh. */
    for (var k = ids.length - 1; k >= 0 && k >= ids.length - 5; k--) {
      var cu = prLenh_(all, ids[k]);
      if (cu && String(cu.nguoi) === nguoi && String(cu.dong) === chuoi && now - Number(cu.ts || 0) < 5000) {
        return phanHoiJson({ status: 'success', id: String(cu.id), trung: true, message: 'Lệnh này vừa gửi rồi — không gửi lại.' });
      }
    }
    /* TRƯỚC BẠN CÒN AI: người bấm In đứng ngoài kho, không thấy máy in. Phải nói ngay là tem ra liền
       hay còn xếp sau đợt của người khác — im lặng rồi để họ ra máy in đợi là chỗ mất lòng tin nhất
       của cả đường in này. Đếm TRƯỚC khi thêm nên không tính chính mình. */
    var tr = prTruocP_(all, ids, now);
    var id = 'PR' + now + Math.floor(Math.random() * 900 + 100);
    /* DỌN TRƯỚC KHI THÊM. Thứ tự này không được đổi: `prDonNhanh_` phán xét từng id bằng bản đọc
       `all` chụp lúc đầu hàm, nên nếu dọn SAU khi push thì id vừa thêm chưa có property trong `all`
       → bị coi là id mồ côi và gạch ngay. Bẫy đã cắn thật 20/08/2026: lệnh ghi được `PRQ_<id>` nên
       `pr_trangthai` vẫn thấy "cho", mà `PR_IDS` lại không có nó nên agent quét mãi không ra việc —
       tem không bao giờ in mà chẳng có lỗi nào. */
    var xoa = prDonNhanh_(all, ids, now);
    ids.push(id);
    var ghi = {};
    /* `thu` = lệnh ĐO: agent dựng đủ tem rồi bỏ, không gửi máy in. Giữ nguyên mọi chặng khác để số
       đo là số thật. */
    ghi[PR_P_TIEN + id] = JSON.stringify({ id: id, nguoi: nguoi, soTem: tong, ts: now, tt: 'cho',
      dong: chuoi, luu: 0, thu: duLieu.thu ? 1 : 0 });
    ghi[PR_P_IDS] = JSON.stringify(ids);
    sp.setProperties(ghi, false);
    for (var d = 0; d < xoa.length; d++) sp.deleteProperty(xoa[d]);
    return phanHoiJson({ status: 'success', id: id, soTem: tong, soSku: dong.length, may: prMayDoc_(all),
      truoc: tr.soDot, temTruoc: tr.soTem, nguoiTruoc: tr.nguoi, dangIn: tr.dangIn, agentTre: prAgentTre_(all) });
  } finally { lock.releaseLock(); }
}

/** Agent hỏi việc.
 *  ĐƯỜNG NHANH (lượt hay xảy ra nhất): hàng đợi trống → trả rỗng luôn, không khoá, không mở Sheet
 *  → cả lượt chỉ còn ~1,1s trần của Apps Script, nên agent hỏi được mỗi giây mà vẫn nhẹ.
 *  Có việc thì mới khoá (hai agent không được nhặt trùng một lệnh) và ghi `dang_in`. */
function apiPrLay(duLieu) {
  var sp = prSP_(), all = sp.getProperties(), now = new Date().getTime();
  prNhipGhi_();                                      // nhịp tim: dashboard biết máy trạm còn trực
  prMayGhi_(sp, duLieu && duLieu.may);               // tình trạng máy in agent vừa đọc được
  /* MÁY IN ĐANG CHẶN (hết giấy · mở nắp · kẹt · offline · queue nghẽn) thì KHÔNG phát việc: lệnh nằm
     lại ở `cho`, dashboard đọc `may` để nói đúng lý do, và khi máy in xong thì lượt hỏi sau tự nhận
     việc. Đây là chỗ chữa gốc chuyện "bấm ép in 4 lần": người dùng không có gì phải bấm lại. */
  var may = prMayDoc_(all);
  if (duLieu && duLieu.may) {
    try { var t = JSON.parse(duLieu.may); if (t && t.chan) return phanHoiJson({ status: 'success', dsLenh: [], mayChan: String(t.chu || ''), xem: prCoNguoiXem_(all) }); } catch (e) {}
  } else if (may.chan) {
    return phanHoiJson({ status: 'success', dsLenh: [], mayChan: may.chu, xem: prCoNguoiXem_(all) });
  }
  var ids = prIds_(all), co = false;
  for (var i = 0; i < ids.length; i++) {
    var o = prLenh_(all, ids[i]);
    if (o && o.tt === 'cho') { co = true; break; }
  }
  if (!co) {
    /* Agent đang rảnh — đây là lúc RẺ NHẤT để ghi sổ lưu những đợt vừa in xong: mở Sheet tốn ~2s
       nhưng không có ai đang đợi. Cố tình KHÔNG ghi ở `pr_xong`, vì lúc đó agent còn phải quay lại
       nhặt lệnh tiếp theo của người khác. */
    return phanHoiJson({ status: 'success', dsLenh: [], daLuu: prGhiSo_(sp, all, ids), xem: prCoNguoiXem_(all) });
  }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(8000)) return phanHoiJson({ status: 'success', dsLenh: [] });
  try {
    all = sp.getProperties(); ids = prIds_(all);
    var ra = [], ghi = {}, nguoiCho = {}, soNguoi = 0;
    for (var j = 0; j < ids.length; j++) {
      var x = prLenh_(all, ids[j]);
      if (x && x.tt === 'cho' && !nguoiCho[String(x.nguoi)]) { nguoiCho[String(x.nguoi)] = 1; soNguoi++; }
    }
    for (var m = 0; m < ids.length && ra.length < 5; m++) {   // mỗi lượt tối đa 5 lệnh, khỏi ôm quá nhiều
      var o2 = prLenh_(all, ids[m]);
      if (!o2 || o2.tt !== 'cho') continue;
      o2.tt = 'dang_in'; o2.nhan = now;
      ghi[PR_P_TIEN + ids[m]] = JSON.stringify(o2);
      var d = [];
      try { d = JSON.parse(String(o2.dong || '[]')); } catch (e) { d = []; }
      ra.push({ id: String(o2.id), nguoi: String(o2.nguoi || ''), soTem: Number(o2.soTem) || 0, dong: d,
        nhieuNguoi: soNguoi > 1, thu: Number(o2.thu) === 1 });
    }
    if (ra.length) sp.setProperties(ghi, false);
    return phanHoiJson({ status: 'success', dsLenh: ra, soNguoiCho: soNguoi, xem: prCoNguoiXem_(all) });
  } finally { lock.releaseLock(); }
}

/** Agent báo kết quả một lệnh: xong hoặc lỗi (kèm lý do để dashboard nói lại cho người bấm).
 *  Chỉ ghi property — sổ lưu để lượt rảnh sau ghi, đừng giữ chân agent ở đây. */
function apiPrXong(duLieu) {
  var id = String(duLieu.id || '');
  if (!id) return phanHoiJson({ status: 'error', message: 'Thiếu id.' });
  var sp = prSP_(), o = prLenh_(sp.getProperties(), id);
  if (!o) return phanHoiJson({ status: 'error', message: 'Không thấy lệnh ' + id });
  o.tt = duLieu.loi ? 'loi' : 'xong';
  o.xongLuc = new Date().getTime();
  o.ghiChu = String(duLieu.loi || duLieu.ghiChu || '').slice(0, 300);
  o.luu = 0;
  sp.setProperty(PR_P_TIEN + id, JSON.stringify(o));
  return phanHoiJson({ status: 'success' });
}

/** Agent trả lệnh về hàng đợi vì máy in chưa sẵn sàng (hết giấy...). KHÔNG phải lỗi: lệnh về lại
 *  `cho` kèm lý do, và sẽ tự in khi máy in xong. Đếm số lần hoãn để còn thấy được nó chờ bao lâu. */
function apiPrHoan(duLieu) {
  var id = String(duLieu.id || '');
  if (!id) return phanHoiJson({ status: 'error', message: 'Thiếu id.' });
  var sp = prSP_(), o = prLenh_(sp.getProperties(), id);
  if (!o) return phanHoiJson({ status: 'error', message: 'Không thấy lệnh ' + id });
  o.tt = 'cho';
  o.nhan = 0;
  o.hoan = (Number(o.hoan) || 0) + 1;
  o.ghiChu = String(duLieu.ly || 'máy in chưa sẵn sàng').slice(0, 200);
  sp.setProperty(PR_P_TIEN + id, JSON.stringify(o));
  return phanHoiJson({ status: 'success', hoan: o.hoan });
}

/** Dashboard hỏi trạng thái lệnh vừa gửi (PUBLIC — chỉ trả đúng dòng theo id). Property trước,
 *  Sheet chỉ khi lệnh đã quá cũ và rời hàng đợi nhanh. */
function apiPrTrangThai(duLieu) {
  var id = String(duLieu.id || '');
  if (!id) return phanHoiJson({ status: 'error', message: 'Thiếu id.' });
  prXemGhi_();                     // đang theo dõi một lệnh cũng là đang xem
  var all = prSP_().getProperties(), o = prLenh_(all, id);
  if (!o) return prTrangThaiSo_(id);
  var tr = prTruocP_(all, prIds_(all), Number(o.ts || 0));
  return phanHoiJson({ status: 'success', id: id, trangThai: String(o.tt), soTem: Number(o.soTem) || 0,
    lucNhan: Number(o.nhan) || 0, lucXong: Number(o.xongLuc) || 0, ghiChu: String(o.ghiChu || ''),
    hoan: Number(o.hoan) || 0, may: prMayDoc_(all),
    truoc: tr.soDot, temTruoc: tr.soTem, nguoiTruoc: tr.nguoi, dangIn: tr.dangIn, agentTre: prAgentTre_(all) });
}
/** Tra lệnh cũ (đã rời hàng đợi nhanh) trong sổ lưu. Chậm hơn nhưng hiếm khi phải dùng. */
function prTrangThaiSo_(id) {
  var sh = prSheet_(), n = sh.getLastRow();
  if (n < 2) return phanHoiJson({ status: 'error', message: 'Không thấy lệnh ' + id });
  var v = sh.getRange(2, 1, n - 1, PR_HEADER.length).getValues();
  for (var i = v.length - 1; i >= 0; i--) {
    if (String(v[i][0]) !== id) continue;
    return phanHoiJson({ status: 'success', id: id, trangThai: String(v[i][3]), soTem: Number(v[i][4]) || 0,
      lucNhan: Number(v[i][6]) || 0, lucXong: Number(v[i][7]) || 0, ghiChu: String(v[i][8] || ''),
      truoc: 0, temTruoc: 0, nguoiTruoc: '', dangIn: null, agentTre: prAgentTre_(null) });
  }
  return phanHoiJson({ status: 'error', message: 'Không thấy lệnh ' + id });
}

/* ── NHỊP TIM AGENT + TÌNH HÌNH HÀNG ĐỢI ────────────────────────────────────────────────────────
 * Bấm "Xác nhận in" xong là người dùng đi tới máy in lấy tem. Nếu agent ở máy trạm đang tắt, hoặc
 * đang chạy đợt của người khác, mà dashboard im lặng thì họ đứng đợi một tờ tem không bao giờ ra.
 * (Đúng cảnh đã xảy ra 20/08/2026: agent chưa bật, lệnh nằm im ở `cho`, người bấm chỉ thấy "đang
 * chờ máy in…".) Nên: mỗi lượt `pr_lay` đóng một dấu thời gian → trễ quá 60 giây là biết máy trạm
 * tắt, và dashboard nói thẳng ngay khi mở pop-up.
 * ─────────────────────────────────────────────────────────────────────────────────────────────── */
/** Đóng dấu nhịp tim vào HAI kho. Vì sao hai: đo 20/08/2026, đọc nhịp từ ảnh chụp
 *  `getProperties()` có lúc trả về RỖNG dù agent vừa gọi cách đó một giây — và dashboard sẽ báo oan
 *  "máy trạm đang tắt agent". Một lời báo động sai kiểu đó đắt hơn nhiều so với một dòng ghi thêm:
 *  người dùng mất tin, rồi lần sau họ đi in bằng máy khác. Cache nhanh nhưng bị đuổi, Property bền
 *  nhưng đọc có lúc lệch → ghi cả hai, đọc lấy cái TƯƠI HƠN. */
function prNhipGhi_() {
  var t = String(new Date().getTime());
  try { prSP_().setProperty(PR_P_NHIP, t); } catch (e) {}
  try { CacheService.getScriptCache().put(PR_P_NHIP, t, 600); } catch (e) {}
}
function prAgentTre_(all) {
  var now = new Date().getTime(), moi = 0;
  try {
    var a = Number((all ? all[PR_P_NHIP] : prSP_().getProperty(PR_P_NHIP)) || 0);
    if (a > moi) moi = a;
  } catch (e) {}
  try {
    var b = Number(CacheService.getScriptCache().get(PR_P_NHIP) || 0);
    if (b > moi) moi = b;
  } catch (e) {}
  return moi ? (now - moi) : -1;                      // -1 = chưa bao giờ thấy agent gọi
}
/** Đếm đợt còn sống gửi TRƯỚC mốc `moc` (moc = 0 → đếm tất cả). */
function prTruocP_(all, ids, moc) {
  var r = { soDot: 0, soTem: 0, nguoi: '', dangIn: null }, now = new Date().getTime();
  for (var i = 0; i < ids.length; i++) {
    var o = prLenh_(all, ids[i]);
    if (!o || (o.tt !== 'cho' && o.tt !== 'dang_in')) continue;
    /* `dang_in` quá lâu = agent chết giữa đợt. Vẫn giữ để truy vết, nhưng KHÔNG tính vào "trước bạn
       còn mấy đợt": tính thì một lệnh treo sẽ vu oan cho mọi người xếp sau nó, mãi mãi. */
    if (o.tt === 'dang_in' && now - Number(o.nhan || o.ts || 0) > PR_TREO) continue;
    if (moc && Number(o.ts || 0) >= moc) continue;
    r.soDot++; r.soTem += Number(o.soTem) || 0;
    if (!r.nguoi) r.nguoi = String(o.nguoi || '');
    if (o.tt === 'dang_in' && !r.dangIn) r.dangIn = { nguoi: String(o.nguoi || ''), soTem: Number(o.soTem) || 0 };
  }
  return r;
}
/** PUBLIC: mở pop-up In tem là biết ngay máy in kho sống hay chết, có ai đang in trước mình, và trần
 *  thật của một lệnh (để dashboard chặn trước chứ không để bị chối sau khi bấm). */
function apiPrHangDoi(duLieu) {
  prXemGhi_();                     // có người mở pop-up -> agent đọc máy in dày lên
  var all = prSP_().getProperties();
  var t = prTruocP_(all, prIds_(all), 0);
  return phanHoiJson({ status: 'success', agentTre: prAgentTre_(all), cho: t.soDot, temCho: t.soTem,
    nguoiCho: t.nguoi, dangIn: t.dangIn, may: prMayDoc_(all), tranSku: PR_TRAN_DONG, tranTem: PR_TRAN_TEM });
}

/** Dọn hàng đợi nhanh: bỏ lệnh đã xong quá 15 phút VÀ đã vào sổ lưu; nếu quá trần thì bỏ tiếp từ cũ
 *  nhất. Không bao giờ bỏ lệnh chưa ghi sổ — mất dấu một đợt in là mất luôn khả năng đối chiếu. */
function prDonNhanh_(all, ids, now) {
  var xoa = [];
  for (var i = ids.length - 1; i >= 0; i--) {
    var o = prLenh_(all, ids[i]);
    if (!o) { ids.splice(i, 1); continue; }
    var roi = (o.tt === 'xong' || o.tt === 'loi');
    if (roi && Number(o.luu) === 1 && now - Number(o.xongLuc || o.ts || 0) > PR_GIU_XONG) {
      xoa.push(PR_P_TIEN + ids[i]); ids.splice(i, 1);
    }
  }
  while (ids.length > PR_TRAN_SONG) { xoa.push(PR_P_TIEN + ids[0]); ids.splice(0, 1); }
  /* QUÉT MỒ CÔI: nếu một lượt ghi bị nửa vời (ghi được `PRQ_` mà mất `PR_IDS`) thì property đó nằm
     lại mãi và gặm dần hạn mức 500KB của kho. Chỉ xoá cái đã quá PR_GIU_XONG để không bao giờ chạm
     vào lệnh đang được ghi song song. */
  var song = {};
  for (var k = 0; k < ids.length; k++) song[PR_P_TIEN + ids[k]] = 1;
  for (var key in all) {
    if (key.indexOf(PR_P_TIEN) !== 0 || song[key]) continue;
    var o2 = null;
    try { o2 = JSON.parse(all[key]); } catch (e) { o2 = null; }
    if (!o2 || now - Number(o2.ts || 0) > PR_GIU_XONG) xoa.push(key);
  }
  return xoa;
}

/** Ghi SỔ LƯU cho các đợt đã in xong mà chưa ghi. Chỉ gọi ở lượt agent rảnh, và cách nhau ít nhất
 *  30 giây, để lượt hỏi rỗng vẫn rẻ. Lỗi ghi sổ KHÔNG được làm vỡ đường in: bọc try/catch, lần rảnh
 *  sau ghi lại (cờ `luu` vẫn 0). */
function prGhiSo_(sp, all, ids) {
  if (new Date().getTime() - Number(all[PR_P_LUU] || 0) < 30000) return 0;
  var can = [];
  for (var i = 0; i < ids.length; i++) {
    var o = prLenh_(all, ids[i]);
    if (o && (o.tt === 'xong' || o.tt === 'loi') && Number(o.luu) !== 1) can.push(o);
  }
  if (!can.length) return 0;
  try {
    var sh = prSheet_(), hang = [], ghi = {};
    for (var j = 0; j < can.length; j++) {
      var o2 = can[j];
      hang.push([o2.id, o2.ts, o2.nguoi, o2.tt, o2.soTem, o2.dong, o2.nhan || '', o2.xongLuc || '', o2.ghiChu || '']);
      o2.luu = 1;
      ghi[PR_P_TIEN + o2.id] = JSON.stringify(o2);
    }
    sh.getRange(sh.getLastRow() + 1, 1, hang.length, PR_HEADER.length).setValues(hang);
    prDon_(sh);
    ghi[PR_P_LUU] = String(new Date().getTime());
    sp.setProperties(ghi, false);
    return hang.length;
  } catch (e) { return 0; }
}

/** Dọn sổ lưu: giữ 7 ngày cho đủ truy vết, xoá phần cũ để tab không phình vô hạn. */
function prDon_(sh) {
  var n = sh.getLastRow();
  if (n < 200) return;                                // chỉ dọn khi tab đã dài
  var moc = new Date().getTime() - PR_GIU_NGAY * 86400000;
  var v = sh.getRange(2, 2, n - 1, 1).getValues();
  var xoa = 0;
  for (var i = 0; i < v.length; i++) { if (Number(v[i][0] || 0) < moc) xoa++; else break; }
  if (xoa > 0) sh.deleteRows(2, xoa);
}
