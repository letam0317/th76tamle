/* google-script-XacMinh.gs — tách từ google-script.gs ngày 20/10/2026 (đánh giá: 1 tệp 3.7k dòng / 81 lệnh khó soát).
 * Mục: dựng clip từ xa (dc_*) + kho dữ liệu xác minh trên Drive (xm_*).
 * Cùng một dự án Apps Script → dùng chung hằng/hàm ở google-script.gs (SECRET, keyBodyOK_, phanHoiJson…). KHÔNG đặt bí mật ở tệp này.
 * deploy-gas.mjs chép sang .clasp-deploy/XacMinh.js — nhớ chạy qc-gas-gac.mjs (bảng lệnh–gác). */
/* ==============================================================================================
 *  DỰNG CLIP TỪ XA — hàng đợi cho Desktop-JE75K38 (máy in tem) · 05/10/2026
 * ----------------------------------------------------------------------------------------------
 *  User 05/10: "cách 2 đi, vì đang k ở cạnh pc" — laptop (mạng khách, không vào được mạng nội bộ)
 *  đẩy việc dựng clip bằng chứng 5S lên đây; agent dung-clip-agent.mjs trên máy in tự lấy việc,
 *  tải video từ top-review (Internet), dựng clip, gửi file về; laptop tải về rồi XOÁ khỏi Drive.
 *  Cùng khuôn với hàng đợi in tem (pr_*): mọi lệnh đòi SECRET; 1 việc / 1 thuộc tính; lấy việc trong LockService.
 *  Clip có mặt người ⇒ thư mục Drive riêng của chủ script, KHÔNG chia sẻ, file bị xoá ngay khi laptop tải xong.
 * ============================================================================================== */
var DC_P_IDS = 'DC_IDS', DC_P_MAY = 'DC_MAY', DC_P_THU = 'DC_THU_MUC', DC_TRE_DANG = 90 * 60000;
function dcSP_() { return PropertiesService.getScriptProperties(); }
function dcIds_() { try { return JSON.parse(dcSP_().getProperty(DC_P_IDS) || '[]') || []; } catch (e) { return []; } }
function dcDoc_(id) { try { return JSON.parse(dcSP_().getProperty('DC_J_' + id) || 'null'); } catch (e) { return null; } }
function dcGhi_(o) { dcSP_().setProperty('DC_J_' + o.id, JSON.stringify(o)); }
function dcThuMuc_() {
  var sp = dcSP_(), id = sp.getProperty(DC_P_THU);
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* bị xoá → tạo lại */ } }
  var f = DriveApp.createFolder('AuditHasaki-clip-tam (không chia sẻ)'); sp.setProperty(DC_P_THU, f.getId()); return f;
}
/* ===== KHO DỮ LIỆU XÁC MINH (14/10/2026, user «làm, qc, cải tiến — lặp đến khi đạt»: máy trạm chạy được 4 cò xác minh) =====
 * 4 cò (canh-b11, canh-b1, tìm bằng chứng, camera tối) cần .exports/* chỉ có trên laptop (gitignore). Kho = thư mục Drive riêng
 * (không chia sẻ), MỖI TỆP 1 file Drive, mục lục ở Script Properties XMF_<băm tên> = {ten, id, luc, h, co, may}.
 *   xm_ds                          → mục lục (không nội dung)
 *   xm_tai  {ten:[...]}             → nội dung base64 (≤ 25 MB/lượt — client chia lượt)
 *   xm_gui  {ten, b64, luc, h}      → ghi nếu luc MỚI HƠN bản kho (hoặc ep) — bản cũ hơn bị từ chối (trả 'cu')
 *   xm_khoa {may, giu|tra, ttl}     → KHOÁ CHUNG «chỉ 1 máy chạy cò xác minh 1 lúc» (atomic, hết hạn tự nhả)
 * Tên tệp = đường dẫn tương đối từ thư mục hasaki, chỉ nhận .exports/… hoặc .canh-*.json/.cache-*.json ở gốc (không cho ghi bừa). */
var XM_P_THU = 'XM_THU_MUC';
function xmThuMuc_() {
  var sp = PropertiesService.getScriptProperties(), id = sp.getProperty(XM_P_THU);
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* bị xoá → tạo lại */ } }
  var f = DriveApp.createFolder('AuditHasaki-xac-minh-du-lieu (không chia sẻ)'); sp.setProperty(XM_P_THU, f.getId()); return f;
}
function xmKhoaTen_(ten) { return 'XMF_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, ten)).replace(/=+$/, ''); }
function xmTenHopLe_(ten) { return /^(\.exports\/[\w.\-\/]+|@BC\/[\w.\-\/]+|\.(canh|cache)-[\w.\-]+\.json)$/.test(ten) && ten.indexOf('..') < 0 && ten.length <= 200; }   // @BC = thư mục bằng chứng
function apiXm(d) {
  var a = String(d.action), sp = PropertiesService.getScriptProperties(), now = new Date().getTime();
  if (a === 'xm_ds') {
    var all = sp.getProperties(), ds = [];
    for (var k in all) if (k.indexOf('XMF_') === 0) { try { var m = JSON.parse(all[k]); ds.push({ ten: m.ten, luc: m.luc, h: m.h, co: m.co, may: m.may }); } catch (e) {} }
    return phanHoiJson({ status: 'success', ds: ds, srvNow: now });
  }
  if (a === 'xm_tai') {
    var ten = (d.ten instanceof Array ? d.ten : [d.ten]).slice(0, 200), ra = [], tong = 0;
    for (var i = 0; i < ten.length; i++) {
      var mm = null; try { mm = JSON.parse(sp.getProperty(xmKhoaTen_(String(ten[i]))) || 'null'); } catch (e) {}
      if (!mm) { ra.push({ ten: ten[i], thieu: true }); continue; }
      if (tong + (mm.co || 0) > 25e6 && ra.length) break;                      // phần còn lại: client gọi lượt sau
      var b = DriveApp.getFileById(mm.id).getBlob().getBytes(); tong += b.length;
      ra.push({ ten: mm.ten, luc: mm.luc, h: mm.h, b64: Utilities.base64Encode(b) });
    }
    return phanHoiJson({ status: 'success', tep: ra });
  }
  if (a === 'xm_gui' && d.tep instanceof Array) {   // 14/10 GỬI NHIỀU TỆP 1 LƯỢT (1 lượt/tệp quá chậm: 150 tệp > 10')
    var kqs = [];
    for (var ig = 0; ig < d.tep.length && ig < 200; ig++) {
      var r1 = JSON.parse(apiXm({ action: 'xm_gui', ten: d.tep[ig].ten, b64: d.tep[ig].b64, luc: d.tep[ig].luc, h: d.tep[ig].h, may: d.may, ep: d.ep }).getContent());
      kqs.push({ ten: d.tep[ig].ten, kq: r1.kq || 'loi', loi: r1.status === 'success' ? '' : r1.message });
    }
    return phanHoiJson({ status: 'success', kqs: kqs });
  }
  if (a === 'xm_gui') {
    /* 14/10 «thời gian chờ khoá»: ghi Drive (~1 s/tệp) TRONG khoá chung làm nghẽn nhịp tim PC (chờ 5 s) ⇒ ghi Drive NGOÀI khoá,
       khoá chỉ giữ tích tắc để so phiên bản + ghi mục lục; thua cuộc đua (kho vừa có bản mới hơn) → bỏ tệp vừa ghi. */
    var t = String(d.ten || ''), luc = Number(d.luc) || now, h = String(d.h || '').slice(0, 64);
    if (!xmTenHopLe_(t)) return phanHoiJson({ status: 'error', message: 'Tên tệp không hợp lệ: ' + t });
    var k2 = xmKhoaTen_(t), cu = null; try { cu = JSON.parse(sp.getProperty(k2) || 'null'); } catch (e) {}
    if (cu && cu.h === h) return phanHoiJson({ status: 'success', kq: 'giong' });
    if (cu && Number(cu.luc) > luc && !d.ep) return phanHoiJson({ status: 'success', kq: 'cu', luc: cu.luc, may: cu.may });   // kho có bản MỚI hơn → không đè
    var blob = Utilities.newBlob(Utilities.base64Decode(String(d.b64 || '')), 'application/octet-stream', t.replace(/\//g, '__'));
    var fileId = xmThuMuc_().createFile(blob).getId(), boId = '', kqGui = 'ghi';
    var lk = LockService.getScriptLock(); lk.waitLock(20000);
    try {
      var cu2 = null; try { cu2 = JSON.parse(sp.getProperty(k2) || 'null'); } catch (e) {}
      if (cu2 && Number(cu2.luc) > luc && !d.ep) { boId = fileId; kqGui = 'cu'; }
      else { boId = cu2 && cu2.id ? cu2.id : ''; sp.setProperty(k2, JSON.stringify({ ten: t, id: fileId, luc: luc, h: h, co: blob.getBytes().length, may: String(d.may || '').slice(0, 60) })); }
    } finally { lk.releaseLock(); }
    if (boId) { try { DriveApp.getFileById(boId).setTrashed(true); } catch (e) {} }
    return phanHoiJson({ status: 'success', kq: kqGui });
  }
  if (a === 'xm_xoa') {   // laptop đã kéo «ra» về → xoá khỏi kho (Drive + mục lục)
    var dsx = (d.ten instanceof Array ? d.ten : [d.ten]).slice(0, 200), nx = 0;
    for (var ix = 0; ix < dsx.length; ix++) {
      var kx = xmKhoaTen_(String(dsx[ix])), mx = null; try { mx = JSON.parse(sp.getProperty(kx) || 'null'); } catch (e) {}
      if (!mx) continue; try { DriveApp.getFileById(mx.id).setTrashed(true); } catch (e) {} sp.deleteProperty(kx); nx++;
    }
    return phanHoiJson({ status: 'success', xoa: nx });
  }
  if (a === 'xm_khoa') {
    var lk2 = LockService.getScriptLock(); lk2.waitLock(20000);
    try {
      var may = String(d.may || '').slice(0, 60), cur = null; try { cur = JSON.parse(sp.getProperty('XM_KHOA') || 'null'); } catch (e) {}
      if (d.tra) { if (cur && cur.may === may && (!d.viec || cur.viec === d.viec)) sp.deleteProperty('XM_KHOA'); return phanHoiJson({ status: 'success', kq: 'tra' }); }
      if (cur && cur.may !== may && now < Number(cur.hetHan || 0)) {
        /* 14/10: PC tắt máy theo ca GIỮA LÚC chạy cò xác minh → khoá chung kẹt tới 1,5 giờ, laptop không làm thay được.
           Máy giữ khoá mất nhịp tim > 5 phút = khoá chết → cho máy khác tiếp quản (ghi lại ai bị tiếp quản). */
        var hbGiu = pcDoc_(sp.getProperty('PCNHIP_' + cur.may)), chetGiu = !hbGiu || !hbGiu.luc || now - new Date(hbGiu.luc).getTime() > 5 * 60000;
        if (!chetGiu) return phanHoiJson({ status: 'success', kq: 'ban', may: cur.may, viec: cur.viec, hetHan: cur.hetHan });
        d.tiepQuan = cur.may;
      }
      var ttl = Math.min(Number(d.ttl) || 3600, 5 * 3600) * 1000;
      sp.setProperty('XM_KHOA', JSON.stringify({ may: may, viec: String(d.viec || '').slice(0, 60), hetHan: now + ttl, luc: now }));
      return phanHoiJson({ status: 'success', kq: 'giu', tiepQuan: d.tiepQuan || '' });   // tiepQuan: máy giữ khoá cũ đã mất nhịp
    } finally { lk2.releaseLock(); }
  }
  return phanHoiJson({ status: 'error', message: 'Lệnh xm lạ' });
}

function apiDc(duLieu) {
  var a = String(duLieu.action), now = new Date().getTime(), lock = LockService.getScriptLock();
  if (a === 'dc_them') {
    var id = String(duLieu.id || '').replace(/[^\w-]/g, '').slice(0, 60), cfg = String(duLieu.cfg || '');
    if (!id || !cfg) return phanHoiJson({ status: 'error', message: 'Thiếu id/cfg' });
    if (cfg.length > 8500) return phanHoiJson({ status: 'error', message: 'Cấu hình quá dài (' + cfg.length + ' > 8500 ký tự)' });
    lock.waitLock(20000);
    try { var ids = dcIds_(); if (ids.indexOf(id) < 0) ids.push(id); dcSP_().setProperty(DC_P_IDS, JSON.stringify(ids.slice(-60)));
      dcGhi_({ id: id, ts: now, tt: 'cho', cfg: cfg }); } finally { lock.releaseLock(); }
    return phanHoiJson({ status: 'success', id: id });
  }
  if (a === 'dc_lay') {
    if (duLieu.may) { try { dcSP_().setProperty(DC_P_MAY, JSON.stringify({ tt: String(duLieu.may).slice(0, 2000), luc: now })); } catch (e) {} }
    if (duLieu.chiBao) return phanHoiJson({ status: 'success', viec: null });   // máy đang thiếu RAM: chỉ báo tình trạng, KHÔNG nhận việc
    lock.waitLock(20000);
    try { var ds = dcIds_(), chon = null;
      for (var i = 0; i < ds.length && !chon; i++) { var o = dcDoc_(ds[i]); if (!o) continue;
        if (o.tt === 'cho' || (o.tt === 'dang' && now - Number(o.nhan || 0) > DC_TRE_DANG)) { o.tt = 'dang'; o.nhan = now; dcGhi_(o); chon = o; } }
      return phanHoiJson({ status: 'success', viec: chon ? { id: chon.id, cfg: chon.cfg } : null });
    } finally { lock.releaseLock(); }
  }
  if (a === 'dc_xong') {
    var o2 = dcDoc_(String(duLieu.id || '')); if (!o2) return phanHoiJson({ status: 'error', message: 'Không thấy việc' });
    if (duLieu.b64) { var blob = Utilities.newBlob(Utilities.base64Decode(String(duLieu.b64)), String(duLieu.mime || 'video/webm'), String(duLieu.ten || (o2.id + '.webm')));
      var f = dcThuMuc_().createFile(blob); o2.file = f.getId(); o2.tt = 'xong'; o2.co = blob.getBytes().length; }
    else { o2.tt = 'loi'; o2.loi = String(duLieu.loi || 'không rõ').slice(0, 500); }
    o2.xong = now; o2.nhatKy = String(duLieu.nhatKy || '').slice(0, 1500); dcGhi_(o2);
    return phanHoiJson({ status: 'success' });
  }
  if (a === 'dc_trangthai') {
    var m = null; try { m = JSON.parse(dcSP_().getProperty(DC_P_MAY) || 'null'); } catch (e) {}
    var o3 = duLieu.id ? dcDoc_(String(duLieu.id)) : null;
    return phanHoiJson({ status: 'success', may: m ? { tt: m.tt, tre: now - Number(m.luc) } : null,
      viec: o3 ? { id: o3.id, tt: o3.tt, loi: o3.loi || '', co: o3.co || 0, nhan: o3.nhan || 0, xong: o3.xong || 0, nhatKy: o3.nhatKy || '' } : null,
      hang: dcIds_().map(function (x) { var y = dcDoc_(x); return y ? x + ':' + y.tt : x + ':?'; }) });
  }
  if (a === 'dc_tai') {
    var o4 = dcDoc_(String(duLieu.id || '')); if (!o4 || !o4.file) return phanHoiJson({ status: 'error', message: 'Chưa có file' });
    var fl = DriveApp.getFileById(o4.file), bl = fl.getBlob();
    var kq = { status: 'success', ten: fl.getName(), mime: bl.getContentType(), b64: Utilities.base64Encode(bl.getBytes()) };
    if (duLieu.xoa) { fl.setTrashed(true); o4.file = ''; o4.tt = 'da-tai'; dcGhi_(o4); }
    return phanHoiJson(kq);
  }
  return phanHoiJson({ status: 'error', message: 'Lệnh dc lạ' });
}
