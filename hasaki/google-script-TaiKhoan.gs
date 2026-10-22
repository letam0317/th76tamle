/* =============================================================================================
 * TÀI KHOẢN + PHÂN QUYỀN DASHBOARD audit-dc (14/10/2026, user: «nút cấp ID và mật khẩu; tài khoản tôi là quản lý cao nhất;
 * phân quyền người được cấp ID xem được gì và làm được gì với cái được xem»).
 * Tệp riêng (deploy-gas.mjs chép thành .clasp-deploy/TaiKhoan.js) — google-script.gs chỉ có 1 dòng chuyển action tk_* sang tkApi_.
 *
 *  Lưu ở Script Properties `TK_DS` = { <id>: { ten, muoi, bam, vaiTro:'quantri'|'nguoidung', quyen:{<tab>:'khong'|'xem'|'lam'}, khoa, luc } }
 *  và `TK_KHACH` = quyền của người CHƯA đăng nhập (quản trị chỉnh được; mặc định = như trước: xem + thao tác mọi tab, trừ Xác minh).
 *  · ID ngắn kiểu «tamlc» (bỏ phần @… nếu gõ kèm), chữ thường.
 *  · Mật khẩu KHÔNG lưu dạng chữ: muối 16 byte + SHA-256 lặp 300 lần (GAS không có scrypt; 2.000 lần làm đăng nhập mất 18 s). Sai 5 lần/10' → khoá 10'.
 *  · Phiên = 32 byte ngẫu nhiên, CacheService giữ BĂM của phiên 6 giờ (trần của CacheService); hết hạn thì đăng nhập lại.
 *  · Ẩn tab / tắt nút ở trang là lớp GIAO DIỆN; nơi kiểm thật là máy chủ: các lệnh tk_* ở đây và máy chủ Xác minh 8591 (hỏi tk_toi).
 *
 *  Lệnh (POST JSON, action):
 *    tk_khach                         → quyền khách (không cần đăng nhập)
 *    tk_dangnhap {id, mk}             → {phien, nguoi}
 *    tk_toi {phien}                   → {nguoi}                    (máy chủ 8591 cũng gọi lệnh này)
 *    tk_dangxuat {phien}
 *    tk_doimk {phien, mkCu, mkMoi}
 *    tk_ds {phien}                    → quản trị: danh sách (không có băm) + quyền khách
 *    tk_luu {phien, tk:{id, ten, mk?, vaiTro, quyen, khoa}}   → quản trị: thêm / sửa
 *    tk_xoa {phien, id}               → quản trị
 *    tk_luukhach {phien, quyen}       → quản trị
 *    tk_khoitao {key, id, ten, mk}    → chỉ máy (SECRET): tạo/đặt lại tài khoản QUẢN TRỊ (lần đầu, quên mật khẩu)
 * ============================================================================================= */
var TK_LAP = 300, TK_PHIEN_GIAY = 21600;
var TK_TAB = ['r.tong', 'r.task', 'r.hangmuc', 'r.planogram', 'r.htonbat', 'r.kk', 'r.xacminh', 'r.xm.treo', 'r.xm.cam', 'r.maytram', 'r.xm.tg', 'f.stock', 'f.kk', 'f.abn', 'f.plg', 'f.sku', 'f.cd', 'f.tem'];
/* 22/10 mục con của Xác minh (cùng luật tai-khoan.js): con chưa từng lưu → theo cha cũ; cha = mức cao nhất của con (máy chủ 8591 hỏi r.xacminh) */
var TK_CHA = { 'r.xm.treo': 'r.xacminh', 'r.xm.cam': 'r.xacminh', 'r.maytram': 'r.xacminh', 'r.xm.tg': 'r.xacminh' };
var TK_KHACH_MAC_DINH = (function () { var q = {}; TK_TAB.forEach(function (t) { q[t] = t === 'r.xacminh' || TK_CHA[t] ? 'khong' : 'lam'; }); return q; })();

function tkHex_(b) { return b.map(function (x) { return ('0' + ((x + 256) % 256).toString(16)).slice(-2); }).join(''); }
function tkBam_(mk, muoi) {
  var h = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, muoi + ':' + mk, Utilities.Charset.UTF_8);
  for (var i = 1; i < TK_LAP; i++) h = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h.concat(Utilities.newBlob(muoi).getBytes()));
  return tkHex_(h);
}
function tkNgauNhien_(n) { var s = ''; while (s.length < n * 2) s += Utilities.getUuid().replace(/-/g, ''); return s.slice(0, n * 2); }
function tkId_(id) { return String(id || '').trim().toLowerCase().replace(/@.*$/, '').replace(/[^a-z0-9._-]/g, '').slice(0, 40); }
function tkDoc_(k, macDinh) { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(k) || 'null') || macDinh; } catch (e) { return macDinh; } }
function tkGhi_(k, v) { PropertiesService.getScriptProperties().setProperty(k, JSON.stringify(v)); }
function tkSach_(q) {
  var r = {}, bac = { khong: 0, xem: 1, lam: 2 };
  TK_TAB.forEach(function (t) { var v = q && q[t]; if (v == null && q && TK_CHA[t]) v = q[TK_CHA[t]]; r[t] = v === 'lam' || v === 'xem' ? v : 'khong'; });
  Object.keys(TK_CHA).forEach(function (c) { var p = TK_CHA[c]; if (r[p + '#']) { if (bac[r[c]] > bac[r[p]]) r[p] = r[c]; } else { r[p + '#'] = 1; r[p] = r[c]; } });
  Object.keys(r).forEach(function (k) { if (k.slice(-1) === '#') delete r[k]; });
  return r;
}
function tkNguoi_(id, t) { return { id: id, ten: t.ten || id, vaiTro: t.vaiTro, quyen: t.vaiTro === 'quantri' ? tkTatCa_() : tkSach_(t.quyen) }; }
function tkTatCa_() { var q = {}; TK_TAB.forEach(function (t) { q[t] = 'lam'; }); return q; }
function tkKhach_() { return tkSach_(tkDoc_('TK_KHACH', TK_KHACH_MAC_DINH)); }
function tkBamPhien_(p) { return tkHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(p), Utilities.Charset.UTF_8)); }
function tkPhien_(phien) {
  if (!phien || String(phien).length < 32) return null;
  var id = CacheService.getScriptCache().get('TKP:' + tkBamPhien_(phien)); if (!id) return null;
  var t = tkDoc_('TK_DS', {})[id]; if (!t || t.khoa) return null;
  return tkNguoi_(id, t);
}
function tkLoi_(m, code) { return phanHoiJson({ status: 'error', message: m, code: code || 400 }); }

function tkApi_(d) {
  var a = d.action;
  if (a === 'tk_khach') return phanHoiJson({ status: 'success', quyen: tkKhach_(), tab: TK_TAB });
  if (a === 'tk_khoitao') {
    if (!keyBodyOK_(d)) return tkLoi_('Sai key', 403);
    var id0 = tkId_(d.id); if (!id0 || String(d.mk || '').length < 4) return tkLoi_('Thiếu ID / mật khẩu');
    var ds0 = tkDoc_('TK_DS', {}), m0 = tkNgauNhien_(16);
    ds0[id0] = { ten: String(d.ten || id0).slice(0, 60), muoi: m0, bam: tkBam_(String(d.mk), m0), vaiTro: 'quantri', quyen: tkTatCa_(), khoa: false, luc: new Date().toISOString() };
    tkGhi_('TK_DS', ds0); return phanHoiJson({ status: 'success', id: id0 });
  }
  if (a === 'tk_dangnhap') {
    var id = tkId_(d.id), c = CacheService.getScriptCache(), kSai = 'TKSAI:' + id, sai = Number(c.get(kSai) || 0);
    if (sai >= 5) return tkLoi_('Sai quá 5 lần — thử lại sau 10 phút', 429);
    var t = tkDoc_('TK_DS', {})[id];
    if (!t || t.khoa || tkBam_(String(d.mk || ''), t.muoi) !== t.bam) { c.put(kSai, String(sai + 1), 600); return tkLoi_('Sai tài khoản hoặc mật khẩu', 401); }
    c.remove(kSai);
    var phien = tkNgauNhien_(32); c.put('TKP:' + tkBamPhien_(phien), id, TK_PHIEN_GIAY);
    return phanHoiJson({ status: 'success', phien: phien, han: TK_PHIEN_GIAY, nguoi: tkNguoi_(id, t) });
  }
  var nguoi = tkPhien_(d.phien);
  if (!nguoi) return tkLoi_('Phiên đăng nhập đã hết — đăng nhập lại', 401);
  if (a === 'tk_toi') return phanHoiJson({ status: 'success', nguoi: nguoi });
  if (a === 'tk_dangxuat') { CacheService.getScriptCache().remove('TKP:' + tkBamPhien_(d.phien)); return phanHoiJson({ status: 'success' }); }
  if (a === 'tk_doimk') {
    var ds1 = tkDoc_('TK_DS', {}), t1 = ds1[nguoi.id];
    if (tkBam_(String(d.mkCu || ''), t1.muoi) !== t1.bam) return tkLoi_('Mật khẩu cũ không đúng', 401);
    if (String(d.mkMoi || '').length < 4) return tkLoi_('Mật khẩu mới tối thiểu 4 ký tự');
    t1.muoi = tkNgauNhien_(16); t1.bam = tkBam_(String(d.mkMoi), t1.muoi); t1.luc = new Date().toISOString(); tkGhi_('TK_DS', ds1);
    return phanHoiJson({ status: 'success' });
  }
  if (nguoi.vaiTro !== 'quantri') return tkLoi_('Chỉ tài khoản quản trị', 403);
  if (a === 'tk_ds') {
    var ds2 = tkDoc_('TK_DS', {});
    return phanHoiJson({ status: 'success', tab: TK_TAB, khach: tkKhach_(), ds: Object.keys(ds2).sort().map(function (k) { var x = ds2[k]; return { id: k, ten: x.ten, vaiTro: x.vaiTro, quyen: tkSach_(x.quyen), khoa: !!x.khoa, luc: x.luc }; }) });
  }
  if (a === 'tk_luu') {
    var tk = d.tk || {}, id3 = tkId_(tk.id); if (!id3) return tkLoi_('ID không hợp lệ (chỉ chữ thường, số, . _ -)');
    var ds3 = tkDoc_('TK_DS', {}), cu = ds3[id3];
    if (!cu && String(tk.mk || '').length < 4) return tkLoi_('Tài khoản mới cần mật khẩu tối thiểu 4 ký tự');
    if (id3 === nguoi.id && (tk.vaiTro !== 'quantri' || tk.khoa)) return tkLoi_('Không tự hạ quyền / khoá chính mình');
    var x = cu || { luc: new Date().toISOString() };
    x.ten = String(tk.ten || id3).slice(0, 60); x.vaiTro = tk.vaiTro === 'quantri' ? 'quantri' : 'nguoidung'; x.quyen = tkSach_(tk.quyen); x.khoa = !!tk.khoa;
    if (tk.mk) { x.muoi = tkNgauNhien_(16); x.bam = tkBam_(String(tk.mk), x.muoi); x.luc = new Date().toISOString(); }
    ds3[id3] = x; tkGhi_('TK_DS', ds3); return phanHoiJson({ status: 'success', id: id3 });
  }
  if (a === 'tk_xoa') {
    var id4 = tkId_(d.id); if (id4 === nguoi.id) return tkLoi_('Không tự xoá chính mình');
    var ds4 = tkDoc_('TK_DS', {}); delete ds4[id4]; tkGhi_('TK_DS', ds4); return phanHoiJson({ status: 'success' });
  }
  if (a === 'tk_luukhach') { tkGhi_('TK_KHACH', tkSach_(d.quyen)); return phanHoiJson({ status: 'success', quyen: tkKhach_() }); }
  return tkLoi_('Lệnh tài khoản lạ');
}
