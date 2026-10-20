/* google-script-NghiemThu.gs — tách từ google-script.gs ngày 20/10/2026 (đánh giá: 1 tệp 3.7k dòng / 81 lệnh khó soát).
 * Mục: nghiệm thu checklist kiểm kê (nt_*).
 * Cùng một dự án Apps Script → dùng chung hằng/hàm ở google-script.gs (SECRET, keyBodyOK_, phanHoiJson…). KHÔNG đặt bí mật ở tệp này.
 * deploy-gas.mjs chép sang .clasp-deploy/NghiemThu.js — nhớ chạy qc-gas-gac.mjs (bảng lệnh–gác). */
/* ===== NGHIỆM THU CHECKLIST CHUẨN BỊ KIỂM KÊ (14/10/2026) ============================================
 * Form kiemsoatkho/nghiem-thu.html ghi ảnh/clip/ghi chú vào cột "Phản hồi kết quả nghiệm thu checklist"
 * của sheet NT_SHEET_ID (letam0317 sửa được — GAS chạy dưới tài khoản đó).
 *
 * MỖI LẦN PHẢN HỒI = 1 MỤC {id, luc, ai, ghiChu, tep:[{id,loai}], sua?} lưu ở Script Properties
 * (khoá NT2|<md5 sheetId+nội dung Checklist>) → xem lại / sửa / bổ sung / xoá được từng mục.
 * Ô cột G được DỰNG LẠI từ danh sách mục sau mỗi lần ghi; chữ người khác gõ TAY vào ô (không do form ghi)
 * được giữ nguyên ở đầu ô ("tay") — nhận ra nhờ lưu kèm đoạn chữ form đã dựng lần trước ("dung").
 *   nt_lay : danh sách dòng + mục của từng dòng (1 lượt getProperties — không gọi Drive)
 *   nt_tai : MỘT tệp/lượt lên thư mục NT_THU_MUC → {id, ky}; ky = HMAC(id) để nt_ghi tin tệp mà KHÔNG
 *            phải hỏi Drive (bản cũ getFileById+getParents mỗi tệp ~0,3–0,5 s)
 *   nt_ghi : {dong, checklist, muc:{id, ghiChu, tep}} thêm/sửa theo muc.id · {…, xoa:1} xoá mục; tệp bị bỏ ra
 *            khỏi mục thì chuyển vào Thùng rác Drive (còn khôi phục được 30 ngày).
 * Gác: chưa duyệt (NT_MO=false) chỉ nhận khoá quản trị; duyệt → khoá thiết bị tbOK_ như các lệnh khác. */
var NT_MO = true;   // 14/10 user DUYỆT — form nghiệm thu mở cho máy được cấp quyền (tbOK_)
var NT_SHEET_ID = '1MtXq8zOTZ610BWna-7m1yVY7cDIdlNtCKn9R6gqh9o4';
var NT_GID = 0;
var NT_THU_MUC = 'NGHIEM-THU-CHECKLIST-KIEMKE';
var NT_TRAN_TEP = 38 * 1024 * 1024;   // ~38MB thật ≈ 51MB base64 — sát trần payload doPost

function apiNghiemThu_(d) {
  try {
    /* sheetId khác chỉ cho KHOÁ QUẢN TRỊ — để QC ghi thử vào sheet nháp, không đụng sheet thật. */
    var id = (d.sheetId && keyBodyOK_(d)) ? String(d.sheetId) : NT_SHEET_ID;
    if (d.action === 'nt_lay') { try { ntTuDinhDang_(id); } catch (eD) { } return ntLay_(id); }   // bảng có dòng mới → trình bày lại trước khi đọc
    if (d.action === 'nt_tu_dinh_dang') return ntTuDinhDang_(id);
    if (d.action === 'nt_tai') return ntTai_(d);
    if (d.action === 'nt_dung_lai') return ntDungLai_(id);
    if (d.action === 'nt_dinh_dang') { var dd = ntDinhDang_(id); if (!d.chiDinhDang) dd.o = ntDungLai_(id).so; return dd; }   // trình bày cả bảng rồi tô lại ô G (định dạng cả bảng xoá kiểu từng đoạn)
    return ntGhi_(d, id);
  } catch (e) { return { status: 'error', message: String((e && e.message) || e) }; }
}
function ntTab_(id) {
  var ss = SpreadsheetApp.openById(id), ds = ss.getSheets();
  if (id === NT_SHEET_ID) for (var i = 0; i < ds.length; i++) if (ds[i].getSheetId() === NT_GID) return ds[i];
  return ds[0];
}
/* Tìm cột theo TIÊU ĐỀ (dòng 1) — người dùng thêm/đổi thứ tự cột thì form vẫn ghi đúng chỗ. */
function ntCot_(tieuDe) {
  var tim = function (re, mac) { for (var i = 0; i < tieuDe.length; i++) if (re.test(String(tieuDe[i]))) return i + 1; return mac; };
  return {
    stt: tim(/^\s*STT\s*$/i, 1), cv: tim(/^\s*Công việc/i, 2), ck: tim(/^\s*Checklist/i, 4),
    td: tim(/phản hồi tiến độ/i, 5), yc: tim(/bốc mẫu/i, 6), ph: tim(/Phản hồi kết quả nghiệm thu/i, 7)
  };
}
function ntKhoa_(id, ck) {
  return 'NT2|' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, id + '|' + String(ck).trim(), Utilities.Charset.UTF_8)).slice(0, 22);
}
function ntKy_(fileId) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(String(fileId), 'nt|' + SECRET)).slice(0, 16);
}
function ntDocBan_(raw) { try { var o = JSON.parse(raw || '{}'); return { muc: o.muc || [], dung: o.dung || '' }; } catch (e) { return { muc: [], dung: '' }; } }
/* Chú thích riêng 1 tệp: chỉ giữ ô có chữ, cắt độ dài (ghi chú 500, mã 300). */
function ntMetaTep_(t) {
  var o = {}, g = String(t.ghiChu || '').replace(/\s+/g, ' ').trim().slice(0, 500), v = String(t.viTri || '').trim().slice(0, 800), m = String(t.ma || '').trim().slice(0, 800);
  if (g) o.ghiChu = g; if (v) o.viTri = v; if (m) o.ma = m; return o;
}
function ntLink_(t) { return 'https://drive.google.com/file/d/' + t.id + '/view'; }
/* Phần chữ form dựng cho ô G. 15/10 user: «ghi chú và ảnh/clip của ghi chú đó nằm cùng nhau; ảnh/ghi chú khác
 * nhau phải tách biệt» → mỗi lần phản hồi = 1 KHỐI, các khối cách nhau bằng vạch mờ; trong khối mỗi ảnh/clip
 * 1 dòng riêng «▸ Ảnh n — ghi chú của chính ảnh đó», mã vị trí/UIDgr của ảnh xuống dòng ngay dưới (chữ xám).
 * 15/10 user bỏ dòng đầu khối «giờ · người · (sửa …)» là thừa — giờ/người vẫn lưu ở mục, form vẫn hiện.
 * kieu = [đầu, cuối, tên kiểu] để ntVietO_ tô. */
var NT_VACH = '──────────';
function ntDung_(muc) {
  var txt = '', link = [], kieu = [];
  var them = function (s, k) { if (k) kieu.push([txt.length, txt.length + s.length, k]); txt += s; };
  /* 15/10 user: link dán vào ghi chú/ô mã → chữ gọn «Link WMS» (trang khác: «Link») mang hyperlink như «Ảnh n». */
  var themChu = function (s, k) {
    String(s).split(/(https?:\/\/[^\s,;]+)/).forEach(function (p, j) {
      if (!p) return;
      if (j % 2) { var nh = /(^|\.)(inshasaki|hasaki)\.(com|vn)\//i.test(p.replace(/^https?:\/\//, '')) ? (/wms\./i.test(p) ? 'Link WMS' : 'Link Hasaki') : 'Link';
        link.push([txt.length, txt.length + nh.length, p]); them(nh, 'link'); }
      else them(p, k);
    });
  };
  var laLink = function (s) { return /^https?:\/\/\S+$/.test(String(s).trim()); };
  muc.forEach(function (m, i) {
    var dau = txt.length;
    if (i) them('\n' + NT_VACH, 'vach');
    var xuong = function () { if (txt.length > dau || i) them('\n'); };
    if (m.ghiChu) { xuong(); themChu(m.ghiChu); }
    var a = 0, c = 0;
    (m.tep || []).forEach(function (t) {
      xuong(); them('▸ ', 'mui');
      var nhan = t.loai === 'video' ? 'Clip ' + (++c) : 'Ảnh ' + (++a);
      link.push([txt.length, txt.length + nhan.length, ntLink_(t)]); them(nhan, 'link');
      if (t.ghiChu) { them(' — '); themChu(t.ghiChu); }
      /* ô mã chỉ chứa 1 link → bỏ nhãn «Vị trí»/«UIDgr» (vô nghĩa trước 1 đường link) */
      var ma = [t.viTri ? (laLink(t.viTri) ? '' : 'Vị trí ') + t.viTri : '', t.ma ? (laLink(t.ma) ? '' : 'UIDgr ') + t.ma : ''].filter(String).join(' · ');
      if (ma) { them('\n    ', 'phu'); themChu(ma, 'phu'); }
    });
  });
  return { txt: txt, link: link, kieu: kieu };
}
function ntKieu_() {
  var k = function () { return SpreadsheetApp.newTextStyle(); };
  return {
    goc: k().setBold(false).setItalic(false).setUnderline(false).setForegroundColor('#202124').build(),   // nền: chặn kiểu link lây sang chữ thường
    dau: k().setBold(true).setForegroundColor('#0f5132').build(),
    phu: k().setItalic(true).setForegroundColor('#6b7280').build(),
    vach: k().setForegroundColor('#c7ccd3').build(),
    mui: k().setForegroundColor('#0f5132').build(),
    link: k().setBold(true).setUnderline(true).setForegroundColor('#1a73e8').build()
  };
}
/* Ghi 1 ô G: chữ gõ tay (nếu có) giữ ở đầu + đoạn dựng từ các mục. Trả về {dung, tay}. */
function ntVietO_(o, ban, st, boTay) {
  var rt = o.getRichTextValue(), cuText = rt ? rt.getText() : String(o.getDisplayValue() || '');
  var tach = boTay ? { tay: "", dau: true } : ntTachTay_(cuText, ban.dung), dung = ntDung_(ban.muc), noi = tach.tay && dung.txt ? '\n' + NT_VACH + '\n' : '', lech = tach.tay.length + noi.length;
  var b = SpreadsheetApp.newRichTextValue().setText(tach.tay + noi + dung.txt);
  if (rt && tach.tay && tach.dau) rt.getRuns().forEach(function (run) {   // giữ định dạng + link phần gõ tay
    var s = run.getStartIndex(), e = Math.min(run.getEndIndex(), tach.tay.length);
    if (e <= s) return;
    b.setTextStyle(s, e, run.getTextStyle()); if (run.getLinkUrl()) b.setLinkUrl(s, e, run.getLinkUrl());
  });
  st = st || ntKieu_();
  if (noi) b.setTextStyle(tach.tay.length, lech, st.vach);   // vạch ngăn chữ gõ tay ↔ phần form ghi
  if (dung.txt) b.setTextStyle(lech, lech + dung.txt.length, st.goc);
  dung.kieu.forEach(function (k) { b.setTextStyle(lech + k[0], lech + k[1], st[k[2]]); });
  dung.link.forEach(function (l) { b.setLinkUrl(lech + l[0], lech + l[1], l[2]); });
  o.setRichTextValue(b.build());
  if (dung.txt) o.setWrap(true).setVerticalAlignment('top');   // chỉ ô form ghi — nhiều dòng phải xuống dòng mới đọc được
  return { dung: dung.txt, tay: tach.tay };
}
/* nt_dinh_dang (15/10 user «chỉnh cho tất cả các cột»): trình bày CẢ BẢNG — chỉ đổi định dạng, KHÔNG đổi chữ,
 * không thêm/xoá cột/dòng, không đụng màu chữ/đậm user tự tô (trừ dòng tiêu đề, cột STT + Công việc).
 * Tiêu đề nền xanh chữ trắng + cố định dòng 1; mọi ô xuống dòng, canh trên; mỗi NHÓM việc (từ dòng có STT tới
 * trước STT kế) 1 màu nền xen kẽ + vạch đậm ở đầu nhóm; cột rộng theo nội dung; «OK» ở cột tiến độ chữ xanh. */
function ntDinhDang_(id) {
  var sh = ntTab_(id), n = sh.getLastRow(), m = sh.getLastColumn();
  if (n < 2) return { status: 'success', dong: 0 };
  var v = sh.getRange(1, 1, n, m).getDisplayValues(), c = ntCot_(v[0]);
  var ht = 0; for (var j = 0; j < m; j++) if (/^\s*Hiện trạng/i.test(v[0][j])) ht = j + 1;
  var rong = {}; rong[c.stt] = 48; rong[c.cv] = 150; rong[c.ck] = 300; rong[c.td] = 240; rong[c.yc] = 220; rong[c.ph] = 380; if (ht) rong[ht] = 230;
  for (var k in rong) if (+k <= m) sh.setColumnWidth(+k, rong[k]);
  var bang = sh.getRange(1, 1, n, m);
  bang.setFontFamily('Arial').setFontSize(10).setWrap(true).setVerticalAlignment('top')
    .setBorder(true, true, true, true, true, true, '#d5dbe1', SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange(1, 1, 1, m).setBackground('#0f5132').setFontColor('#ffffff').setFontWeight('bold')
    .setVerticalAlignment('middle').setHorizontalAlignment('center');
  sh.setRowHeight(1, 48); sh.setFrozenRows(1);
  sh.getRange(2, c.stt, n - 1, 1).setHorizontalAlignment('center').setFontWeight('bold');
  sh.getRange(2, c.cv, n - 1, 1).setFontWeight('bold');
  /* Nhóm việc: dòng có STT mở nhóm mới; nền xen kẽ trắng / xanh rất nhạt. */
  var nen = [], le = true, dauNhom = [];
  for (var r = 1; r < n; r++) {
    if (String(v[r][c.stt - 1]).trim()) { le = !le; dauNhom.push(r + 1); }
    var mau = le ? '#f3f8f5' : '#ffffff', hang = []; for (var x = 0; x < m; x++) hang.push(mau); nen.push(hang);
  }
  sh.getRange(2, 1, n - 1, m).setBackgrounds(nen);
  dauNhom.forEach(function (d) { if (d > 2) sh.getRange(d, 1, 1, m).setBorder(true, null, null, null, null, null, '#7fa392', SpreadsheetApp.BorderStyle.SOLID_MEDIUM); });
  /* «OK» ở cột tiến độ: luật định dạng có điều kiện (ô đổi chữ sau này vẫn đúng) — thêm 1 lần, không nhân bản. */
  var vung = sh.getRange(2, c.td, Math.max(n, 200) - 1, 1), luat = sh.getConditionalFormatRules();
  var daCo = luat.some(function (l) { var b = l.getBooleanCondition(); return b && b.getCriteriaType() === SpreadsheetApp.BooleanCriteria.TEXT_EQUAL_TO && String(b.getCriteriaValues()[0]) === 'OK' && l.getRanges().some(function (g) { return g.getColumn() === c.td; }); });
  if (!daCo) { luat.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('OK').setFontColor('#137333').setBold(true).setRanges([vung]).build()); sh.setConditionalFormatRules(luat); }
  SpreadsheetApp.flush();
  sh.autoResizeRows(2, n - 1);
  return { status: 'success', dong: n, nhom: dauNhom.length };
}
/* 15/10 user «tự trình bày lại khi có dòng mới»: dấu vân bảng = số dòng/cột + cột STT + dòng nào có Checklist.
 * Đổi → ntDinhDang_ (chỉ định dạng, KHÔNG cần khoá: không đụng Script Properties/ô G; kiểu từng đoạn ô G vẫn
 * giữ vì chỉ đặt phông/cỡ chữ). Gọi từ nt_lay (form mở) + lệnh nt_tu_dinh_dang (lịch 15' DAY-BAO-CAO-5S.bat).
 * Không dùng trigger onChange: cần scope script.scriptapp → bắt cấp phép lại cả web app. */
function ntTuDinhDang_(id) {
  var sh = ntTab_(id), n = sh.getLastRow(), m = sh.getLastColumn();
  var v = sh.getRange(1, 1, Math.max(n, 1), m).getDisplayValues(), c = ntCot_(v[0]);
  var van = n + '|' + m + '|' + v.map(function (r) { return String(r[c.stt - 1]).trim() + (String(r[c.ck - 1]).trim() ? '+' : '-'); }).join(',');
  van = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, van, Utilities.Charset.UTF_8));
  var sp = PropertiesService.getScriptProperties(), khoa = 'NT_DD|' + id;
  if (sp.getProperty(khoa) === van) return { status: 'success', doi: false };
  var cache = CacheService.getScriptCache();
  if (cache.get(khoa)) return { status: 'success', doi: false, dangChay: true };   // lượt khác đang trình bày
  cache.put(khoa, '1', 120);
  try { var r = ntDinhDang_(id); sp.setProperty(khoa, van); r.doi = true; return r; } finally { cache.remove(khoa); }
}
/* nt_dung_lai: dựng lại MỌI ô G đang có mục theo khuôn hiện tại (đổi khuôn xong chạy 1 lần). */
function ntDungLai_(id) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sh = ntTab_(id), n = sh.getLastRow(), c = ntCot_(sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0]);
    var ck = sh.getRange(1, c.ck, n, 1).getDisplayValues(), sp = PropertiesService.getScriptProperties(), all = sp.getProperties(), st = ntKieu_(), so = 0;
    for (var r = 1; r < n; r++) {
      var noi = String(ck[r][0]).trim(); if (!noi) continue;
      var khoa = ntKhoa_(id, noi), ban = ntDocBan_(all[khoa]); if (!ban.muc.length) continue;
      ban.dung = ntVietO_(sh.getRange(r + 1, c.ph), ban, st).dung;
      sp.setProperty(khoa, JSON.stringify(ban)); so++;   // KHÔNG sửa all[khoa]: checklist trùng chữ ở 2 dòng → dòng sau vẫn tách bằng đoạn CŨ
    }
    SpreadsheetApp.flush();
    return { status: 'success', so: so };
  } finally { lock.releaseLock(); }
}
/* Chữ gõ tay trong ô = ô hiện tại bỏ đi đoạn form dựng lần trước. */
function ntTachTay_(cuText, dung) {
  var r = ntTachTay0_(cuText, dung); r.tay = r.tay.replace(/\n*─+\s*$/, '');   // bỏ vạch ngăn do form chèn sau chữ tay
  return r;
}
function ntTachTay0_(cuText, dung) {
  if (!dung) return { tay: cuText, dau: true };
  if (cuText === dung) return { tay: '', dau: true };
  var k = cuText.lastIndexOf(dung);
  if (k >= 0 && k + dung.length === cuText.length) return { tay: cuText.slice(0, k).replace(/\n+$/, ''), dau: true };
  if (k >= 0) return { tay: (cuText.slice(0, k) + cuText.slice(k + dung.length)).replace(/^\n+|\n+$/g, ''), dau: false };
  return { tay: cuText, dau: true };   // ai đó sửa tay cả đoạn form → giữ nguyên làm chữ tay, không mất gì
}
function ntLay_(id) {
  var sh = ntTab_(id), n = sh.getLastRow(), m = sh.getLastColumn();
  if (n < 2) return { status: 'success', ten: sh.getParent().getName(), dong: [] };
  var v = sh.getRange(1, 1, n, m).getDisplayValues(), c = ntCot_(v[0]), out = [], stt = '', cv = '';
  var all = PropertiesService.getScriptProperties().getProperties();
  for (var r = 1; r < n; r++) {
    var row = v[r], ck = String(row[c.ck - 1] || '').trim(), cvDong = String(row[c.cv - 1] || '').trim();
    if (String(row[c.stt - 1] || '').trim()) { stt = String(row[c.stt - 1]).trim(); cv = cvDong; }
    else if (cvDong) cv = cvDong;
    if (!ck) continue;   // dòng không có nội dung checklist thì không có gì để nghiệm thu (và nội dung là khoá)
    var b = ntDocBan_(all[ntKhoa_(id, ck)]), ph = String(row[c.ph - 1] || '').trim();
    out.push({ dong: r + 1, stt: stt, congViec: cv, checklist: ck, tienDo: String(row[c.td - 1] || '').trim(),
      yeuCau: String(row[c.yc - 1] || '').trim(), muc: b.muc, tay: ntTachTay_(ph, b.dung).tay });
  }
  return { status: 'success', ten: sh.getParent().getName(), dong: out };
}
function ntThuMuc_() {
  var sp = PropertiesService.getScriptProperties(), id = sp.getProperty('NT_THU_MUC_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* bị xoá → tìm/tạo lại */ } }
  var it = DriveApp.getFoldersByName(NT_THU_MUC), f = it.hasNext() ? it.next() : DriveApp.createFolder(NT_THU_MUC);
  sp.setProperty('NT_THU_MUC_ID', f.getId()); return f;
}
function ntTai_(d) {
  var mime = String(d.mime || '').split(';')[0];
  if (!/^(image|video)\//.test(mime)) return { status: 'error', message: 'Chỉ nhận ảnh hoặc clip (' + mime + ')' };
  var b64 = String(d.base64 || ''), k = b64.indexOf('base64,');
  if (k >= 0) b64 = b64.slice(k + 7);
  if (!b64) return { status: 'error', message: 'Tệp rỗng' };
  if (b64.length * 3 / 4 > NT_TRAN_TEP) return { status: 'error', message: 'Tệp vượt ' + Math.round(NT_TRAN_TEP / 1048576) + 'MB' };
  var dong = Math.max(0, parseInt(d.dong, 10) || 0);
  var ten = Utilities.formatDate(new Date(), 'GMT+7', 'yyyyMMdd_HHmmss') + '_dong' + dong + '_' + String(d.ten || 'tep').replace(/[^\w.\-]+/g, '_').slice(-60);
  var f = ntThuMuc_().createFile(Utilities.newBlob(Utilities.base64Decode(b64), mime, ten));
  /* Cùng khuôn bằng chứng 5S: ai có link mới xem được — người đọc sheet không có quyền Drive của letam0317. */
  try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { }
  return { status: 'success', id: f.getId(), ky: ntKy_(f.getId()), loai: /^video/.test(mime) ? 'video' : 'image' };
}
function ntGhi_(d, id) {
  var ckGui = String(d.checklist || '').trim(), mu = d.muc || {}, mid = String(mu.id || '').slice(0, 40);
  if (!ckGui) return { status: 'error', message: 'Thiếu nội dung checklist' };
  if (!/^[\w-]{6,40}$/.test(mid)) return { status: 'error', message: 'Thiếu mã mục' };
  var lock = LockService.getScriptLock(); lock.waitLock(60000);   // 15/10: 20s hụt khi nt_dinh_dang/nt_dung_lai giữ khoá → dòng 25 mất bước ghi (7 tệp đã lên Drive)
  try {
    var sp = PropertiesService.getScriptProperties(), khoa = ntKhoa_(id, ckGui), ban = ntDocBan_(sp.getProperty(khoa));
    var vt = -1; for (var i = 0; i < ban.muc.length; i++) if (ban.muc[i].id === mid) vt = i;
    var cu = vt >= 0 ? ban.muc[vt] : null, tepCu = {}, boTep = [];
    (cu ? cu.tep : []).forEach(function (t) { tepCu[t.id] = t; });
    if (d.xoa) {
      if (!cu) return ntTraVe_(d, id, ckGui, ban);   // đã xoá rồi (thử lại) → coi như xong
      boTep = cu.tep.map(function (t) { return t.id; }); ban.muc.splice(vt, 1);
    } else {
      var ghiChu = String(mu.ghiChu || '').trim().slice(0, 2000), tep = [];
      (mu.tep || []).slice(0, 30).forEach(function (t) {
        var fid = String(t.id || '');
        var meta = ntMetaTep_(t);   // 14/10: ghi chú + mã vị trí + UIDgr RIÊNG từng ảnh/clip
        if (tepCu[fid]) { var gi = { id: tepCu[fid].id, loai: tepCu[fid].loai }; for (var kk in meta) gi[kk] = meta[kk]; tep.push(gi); delete tepCu[fid]; return; }
        /* Tệp MỚI phải mang chữ ký do nt_tai cấp — không cho mượn form gắn link Drive bất kỳ vào sheet. */
        if (!fid || String(t.ky || '') !== ntKy_(fid)) throw new Error('Tệp không do form tải lên');
        var moi = { id: fid, loai: t.loai === 'video' ? 'video' : 'image' }; for (var km in meta) moi[km] = meta[km]; tep.push(moi);
      });
      if (!ghiChu && !tep.length) return { status: 'error', message: 'Chưa có ghi chú hay ảnh/clip nào' };
      boTep = Object.keys(tepCu);
      var gio = Utilities.formatDate(new Date(), 'GMT+7', 'dd/MM HH:mm');
      if (cu) { cu.ghiChu = ghiChu; cu.tep = tep; if (cu.luc !== gio) cu.sua = gio; }
      else {
        var tenMay = '';
        try { var dd = JSON.parse(propsMemo_().TB_DUYET || '{}') || {}; tenMay = dd[String(d.tb || '')] ? String(dd[String(d.tb)].ten || '') : ''; } catch (e) { }
        var ng = d.nguoiGui || {};
        ban.muc.push({ id: mid, luc: gio, ai: String(ng.ten || '').trim().slice(0, 60) || tenMay || 'không rõ', ghiChu: ghiChu, tep: tep });
      }
    }
    /* Ô G: chữ gõ tay (nếu có) + đoạn dựng từ các mục. Chỉ đọc/ghi ĐÚNG 1 ô cần đổi. */
    var sh = ntTab_(id), n = sh.getLastRow(), c = ntCot_(sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0]);
    var ck = sh.getRange(1, c.ck, n, 1).getDisplayValues(), dong = parseInt(d.dong, 10) || 0;
    if (!(dong >= 2 && dong <= n && String(ck[dong - 1][0]).trim() === ckGui)) {
      dong = 0;
      for (var r = 1; r < n; r++) if (String(ck[r][0]).trim() === ckGui) { dong = r + 1; break; }
    }
    if (!dong) return { status: 'error', message: 'Không còn thấy dòng checklist này trên sheet (đã bị sửa/xoá?) — tải lại danh sách.' };
    var viet = ntVietO_(sh.getRange(dong, c.ph), ban, null, !!(d.boTay && keyBodyOK_(d))), tach = { tay: viet.tay };
    ban.dung = viet.dung;
    if (ban.muc.length) sp.setProperty(khoa, JSON.stringify(ban)); else sp.deleteProperty(khoa);
    SpreadsheetApp.flush();
    lock.releaseLock(); lock = null;
    boTep.forEach(function (fid) { try { DriveApp.getFileById(fid).setTrashed(true); } catch (e) { } });   // ngoài khoá — chậm nhưng không chặn ai
    return { status: 'success', dong: dong, muc: ban.muc, tay: tach.tay };
  } finally { if (lock) lock.releaseLock(); }
}
function ntTraVe_(d, id, ck, ban) { return { status: 'success', dong: parseInt(d.dong, 10) || 0, muc: ban.muc, tay: null }; }
