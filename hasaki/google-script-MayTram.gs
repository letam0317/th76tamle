/* google-script-MayTram.gs — tách từ google-script.gs ngày 20/10/2026 (đánh giá: 1 tệp 3.7k dòng / 81 lệnh khó soát).
 * Mục: máy trạm: nhịp tim pcNhip, lệnh, bảng, đăng nhập pcDangNhap, bộ cài pcBoCai, gói khoá, đổi khoá, sao lưu sheet.
 * Cùng một dự án Apps Script → dùng chung hằng/hàm ở google-script.gs (SECRET, keyBodyOK_, phanHoiJson…). KHÔNG đặt bí mật ở tệp này.
 * deploy-gas.mjs chép sang .clasp-deploy/MayTram.js — nhớ chạy qc-gas-gac.mjs (bảng lệnh–gác). */
/* ===== MÁY TRẠM — ĐIỀU PHỐI N PC (12/10/2026 dựng, 13/10/2026 thêm lệnh dừng/tiếp tục + chuyển việc) =====
 * Lưu trong Script Properties (không dùng Sheet → rẻ, không thêm tab), mọi ghi trong LockService:
 *   PCNHIP_<máy>  = nhịp tim mới nhất (sức khoẻ + việc đang chạy + bản code). Giữ 7 ngày để dashboard thấy máy đã tắt.
 *   PCLENH_<máy>  = { dung:bool, dungViec:[tên việc], luc, boi } — user bấm trên sub-tab «Máy trạm».
 *   PCLEASE_<việc>= { may, hetHan } — khoá giữ việc (chống 2 máy chạy cùng một việc).
 *   PCCHUYEN_<việc> = { tu, luc, sanSang } — việc bị dừng GIỮA CHỪNG trên máy <tu>; khi máy đó báo đã dừng hẳn
 *                   (sanSang) thì máy được điều phối chọn chạy bù ngay, không chờ lịch kế.
 * Bảng trả về cho điều phối chỉ gồm máy có nhịp ≤ PCNHIP_HET_HAN_PHUT (mặc định 30'), mỗi dòng mang lệnh dừng của máy đó. */
/* 20/10 đổi tên pcJson_ → pcDoc_: trùng tên với pcJson_(obj) (bọc JSON trả về) ở PhysicalCountImport.js — Apps Script tệp sau đè tệp trước, tách tệp làm bản bọc thắng → mọi nhịp tim bị xoá */
function pcDoc_(s) { try { return JSON.parse(s || 'null'); } catch (e) { return null; } }
function pcLenhCua_(all, may) { var l = pcDoc_(all['PCLENH_' + may]) || {}; return { dung: !!l.dung, dungViec: (l.dungViec instanceof Array ? l.dungViec : []), luc: l.luc || '', boi: l.boi || '', capNhat: l.capNhat || '' }; }   // 15/10 capNhat = ISO lúc bấm «Cập nhật ngay» (PC báo capNhatNhan → xoá)
function pcMang_(a, n) { return (a instanceof Array ? a.slice(0, n || 30).map(function (x) { return String(x).slice(0, 60); }) : []); }

function pcChayLuc_(o) {   // 14/10 làm sạch { tenViec: ISO } — tối đa 40 việc, tên ≤ 60 ký tự, chỉ giữ ngày giờ hợp lệ
  var r = {}, n = 0; if (!o || typeof o !== 'object') return r;
  for (var k in o) { if (n >= 40) break; var t = Date.parse(o[k]); if (!isNaN(t)) { r[String(k).slice(0, 60)] = new Date(t).toISOString(); n++; } }
  return r;
}
function apiPcNhip_(duLieu) {
  var nhip = duLieu && duLieu.nhip;
  if (!nhip || !nhip.may) return phanHoiJson({ status: 'error', message: 'Thieu nhip.may' });
  var lock = LockService.getScriptLock();
  try { lock.waitLock(5000); } catch (e) { return phanHoiJson({ status: 'error', message: 'Ban (lock)' }); }
  try {
    var props = PropertiesService.getScriptProperties();
    var hetHan = Number(props.getProperty('PCNHIP_HET_HAN_PHUT') || 30) * 60000;
    var now = new Date().getTime();
    // lúc đóng dấu bằng GIỜ MÁY CHỦ (không tin đồng hồ máy trạm)
    var g = { may: String(nhip.may).slice(0, 60), ramTrongPct: Number(nhip.ramTrongPct) || 0, cpuPct: Number(nhip.cpuPct) || 0, yeu: !!nhip.yeu, diem: Number(nhip.diem) || 0,
      nhan: Number(nhip.nhan) || 0, ramTongGB: Number(nhip.ramTongGB) || 0, diaTrongGB: (nhip.diaTrongGB == null ? null : Number(nhip.diaTrongGB)),
      coKhoa: pcMang_(nhip.coKhoa, 20), dangChay: pcMang_(nhip.dangChay, 30), ban: String(nhip.ban || '').slice(0, 12),
      viecGiao: pcMang_(nhip.viecGiao, 30), tatCaViec: pcMang_(nhip.tatCaViec, 40), viecNang: pcMang_(nhip.viecNang, 40),
      congLuc: ('congLuc' in nhip) ? (isNaN(Date.parse(nhip.congLuc)) ? null : new Date(Date.parse(nhip.congLuc)).toISOString()) : undefined,   // 14/10 cổng gác còn sống (null = chưa từng chạy) → điều phối bỏ máy cổng chết
      capGan: nhip.capGan instanceof Array ? nhip.capGan.slice(-6).map(function (s) { return String(s).slice(0, 160); }) : undefined,   // 14/10 nhật ký bộ cập nhật PC (xem từ xa: đã nhận bản chưa, tự chữa task)
      taskDP: nhip.taskDP instanceof Array ? nhip.taskDP.slice(0, 40).map(function (s) { return String(s).slice(0, 120); }) : undefined,   // 14/10 trạng thái task việc (xem từ xa) · 19/10 20 → 40 (máy FOQ đã 19 lịch)
      congGan: nhip.congGan instanceof Array ? nhip.congGan.slice(-8).map(function (s) { return String(s).slice(0, 180); }) : undefined,   // 14/10 nhật ký cổng gác (xem từ xa)
      chayLuc: nhip.chayLuc ? pcChayLuc_(nhip.chayLuc) : undefined,   // PC bản cũ không gửi → bỏ trường (đừng báo sai «chưa chạy»). 14/10 { viec: ISO } lần chạy gần nhất (cổng gác cho CHẠY) → «chạy lúc …» trên Máy trạm
      oDia: (nhip.oDia instanceof Array ? nhip.oDia.slice(0, 8).map(function (x) { return { o: String(x && x.o || '').slice(0, 1).toUpperCase(), trong: Number(x && x.trong) || 0, tong: Number(x && x.tong) || 0 }; }).filter(function (x) { return /^[A-Z]$/.test(x.o); }) : []),   // 14/10 mọi ổ đĩa
      xmHam: /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(String(nhip.xmHam || '')) ? String(nhip.xmHam) : undefined,   // 19/10 máy chủ Xác minh DỰ PHÒNG trên PC (laptop tắt → điện thoại xem qua đây; trả chỉ qua pcBangPh có phiên)
      goiBam: /^[0-9a-f]{0,16}$/.test(String(nhip.goiBam || '')) ? String(nhip.goiBam || '') : '',   // 20/10 băm gói khoá máy đã áp (đổi khoá: biết máy nào đã nhận)
      luc: new Date().toISOString() };   // 13/10: PC tự tính việc được giao (dieu-phoi.mjs) → điện thoại xem không cần máy chủ 8591
    props.setProperty('PCNHIP_' + g.may, JSON.stringify(g));
    var all = props.getProperties(), bang = [], chuyen = [];
    for (var k in all) {
      if (k.indexOf('PCNHIP_') === 0 && k !== 'PCNHIP_HET_HAN_PHUT') {
        var v = pcDoc_(all[k]); if (!v || !v.luc) { props.deleteProperty(k); continue; }
        var tuoi = now - new Date(v.luc).getTime();
        if (tuoi > 7 * 864e5) { props.deleteProperty(k); continue; }       // máy im 7 ngày → bỏ khỏi danh sách
        if (tuoi <= hetHan) { var l = pcLenhCua_(all, v.may); v.dung = l.dung; v.dungViec = l.dungViec; bang.push(v); }
      } else if (k.indexOf('PCCHUYEN_') === 0) {
        var c = pcDoc_(all[k]), viec = k.slice(9);
        if (!c || now - Number(c.luc || 0) > 3 * 36e5) { props.deleteProperty(k); continue; }   // quá 3 giờ không ai nhận → bỏ (lịch kế lo)
        // máy nguồn báo nhịp mới không còn việc đó (đã dừng hẳn) hoặc im > 3' → mới cho máy khác chạy bù (chống chạy đôi)
        if (!c.sanSang) { var src = pcDoc_(all['PCNHIP_' + c.tu]); if (!src || (src.dangChay || []).indexOf(viec) < 0 || now - new Date(src.luc).getTime() > 3 * 60000) { c.sanSang = true; props.setProperty(k, JSON.stringify(c)); } }
        if (c.sanSang) chuyen.push({ viec: viec, tu: c.tu, luc: c.luc });
      }
    }
    (nhip.daNhan instanceof Array ? nhip.daNhan : []).forEach(function (vc) { props.deleteProperty('PCCHUYEN_' + String(vc)); });   // máy nhận đã chạy bù → xoá
    var lenhToi = pcLenhCua_(all, g.may);
    if (lenhToi.capNhat && String(nhip.capNhatNhan || '') >= lenhToi.capNhat) {   // 15/10 PC đã nhận lệnh «Cập nhật ngay» → gỡ lệnh
      lenhToi.capNhat = ''; if (!lenhToi.dung && !lenhToi.dungViec.length) props.deleteProperty('PCLENH_' + g.may); else props.setProperty('PCLENH_' + g.may, JSON.stringify(lenhToi)); }
    // KHOÁ GIỮ VIỆC (atomic): máy đang bị dừng (cả máy hoặc riêng việc) thì không được giữ
    var giuOK = null;
    if (nhip.giuViec) {
      var tv = String(nhip.giuViec), lk = 'PCLEASE_' + tv, ttl = Number(nhip.giuTTL || 600) * 1000;
      var cur = pcDoc_(props.getProperty(lk));
      if (lenhToi.dung || lenhToi.dungViec.indexOf(tv) >= 0) giuOK = false;
      else if (!cur || cur.may === g.may || now >= Number(cur.hetHan || 0)) { props.setProperty(lk, JSON.stringify({ may: g.may, hetHan: now + ttl })); giuOK = true; }
      else giuOK = false;
    }
    if (nhip.traViec) { var tk = 'PCLEASE_' + String(nhip.traViec); var c2 = pcDoc_(props.getProperty(tk)); if (c2 && c2.may === g.may) props.deleteProperty(tk); }
    /* 20/10 ĐỔI KHOÁ không cài lại: máy gọi bằng khoá CŨ → trả khoaMoi (nhip-pc ghi vào .env); goiBam = băm gói khoá hiện hành (khác băm máy đã áp → máy gọi pcLayGoi) */
    return phanHoiJson({ status: 'success', bang: bang, giuOK: giuOK, srvNow: now, lenh: lenhToi, chuyen: chuyen, khoaMoi: keyLaCu_(duLieu) ? SECRET : undefined, goiBam: pcGoiBam_() });
  } finally { lock.releaseLock(); }
}

/* 14/10 user «đang chạy công việc gì cũng cần hiển thị»: laptop (máy dự phòng) chạy cò gốc qua _LAPTOP-NHUONG.vbs — nhịp tim của nó
   gửi từ bản cài C:/AuditFactory nên không thấy các việc này. Cổng nhường báo thẳng: PCPHU_<máy> = { dangChay: {việc: ISO bắt đầu}, chayLuc: {việc: ISO} }.
   Chỉ dùng cho HIỂN THỊ (pcBang/pcBangPh) — không vào bảng điều phối. Việc «đang chạy» quá 3 giờ coi như đã chết (máy tắt giữa chừng). */
function apiPcPhu_(d) {
  var may = String(d.may || '').slice(0, 60), viec = String(d.viec || '').slice(0, 60);
  if (!may || !viec) return phanHoiJson({ status: 'error', message: 'Thieu may/viec' });
  var lock = LockService.getScriptLock(); try { lock.waitLock(5000); } catch (e) { return phanHoiJson({ status: 'error', message: 'Ban (lock)' }); }
  try {
    var props = PropertiesService.getScriptProperties(), k = 'PCPHU_' + may, p = pcDoc_(props.getProperty(k)) || {}, nay = new Date().toISOString();
    p.dangChay = p.dangChay || {}; p.chayLuc = p.chayLuc || {}; p.tienDo = p.tienDo || {};
    if (d.xong) { delete p.dangChay[viec]; delete p.tienDo[viec]; }
    else if (d.tienDo && typeof d.tienDo === 'object') {   // tien-do.mjs: bước · phiếu đang soát · i/n — làm mới mỗi ≥15 s, nhắc lại mỗi 60 s
      var t = d.tienDo;
      if (!p.dangChay[viec]) { p.dangChay[viec] = nay; p.chayLuc[viec] = nay; }
      p.tienDo[viec] = { buoc: String(t.buoc || '').slice(0, 80), task: String(t.task || '').replace(/[^0-9]/g, '').slice(0, 20),
        i: Number(t.i) || 0, n: Number(t.n) || 0, chiTiet: String(t.chiTiet || '').slice(0, 140), luc: nay };
    }
    else { p.dangChay[viec] = nay; p.chayLuc[viec] = nay; }
    props.setProperty(k, JSON.stringify(p));
    return phanHoiJson({ status: 'success' });
  } finally { lock.releaseLock(); }
}
function pcPhuGop_(all, v, now) {   // gộp việc làm thay vào dòng máy (chỉ hiển thị)
  var p = pcDoc_(all['PCPHU_' + v.may]); if (!p) return v;
  v.duPhong = true; v.dangChay = (v.dangChay || []).slice(); v.chayLuc = v.chayLuc || {}; v.batDau = v.batDau || {};
  v.tienDo = {};
  for (var t in (p.dangChay || {})) {
    var bd = Date.parse(p.dangChay[t]), td = (p.tienDo || {})[t], tdLuc = td ? Date.parse(td.luc) : NaN;
    if (isNaN(bd) || now - bd >= 3 * 36e5) continue;                    // quá 3 giờ: máy tắt giữa chừng
    if (td && !isNaN(tdLuc) && now - tdLuc > 5 * 60000) continue;       // có báo tiến độ mà im > 5' (nhắc mỗi 60 s): cò đã chết
    if (v.dangChay.indexOf(t) < 0) v.dangChay.push(t); v.batDau[t] = p.dangChay[t]; if (td) v.tienDo[t] = td;
  }
  for (var t2 in (p.chayLuc || {})) if (!v.chayLuc[t2] || Date.parse(p.chayLuc[t2]) > Date.parse(v.chayLuc[t2])) v.chayLuc[t2] = p.chayLuc[t2];
  return v;
}
// Bảng cho dashboard — CHỈ ĐỌC: mọi máy (kể cả đã im), lệnh, khoá giữ việc, việc đang chờ chuyển.
function apiPcBang_() {
  var props = PropertiesService.getScriptProperties(), all = props.getProperties(), now = new Date().getTime();
  var may = [], khoa = {}, chuyen = [], xin = [];
  for (var k in all) {
    if (k.indexOf('PCNHIP_') === 0 && k !== 'PCNHIP_HET_HAN_PHUT') { var v = pcDoc_(all[k]); if (v && v.may) { var l = pcLenhCua_(all, v.may); v.dung = l.dung; v.dungViec = l.dungViec; v.lenhLuc = l.luc; v.lenhBoi = l.boi; v.capNhatYc = l.capNhat; may.push(pcPhuGop_(all, v, now)); } }
    else if (k.indexOf('PCLEASE_') === 0) { var c = pcDoc_(all[k]); if (c && Number(c.hetHan) > now) khoa[k.slice(8)] = c; }
    else if (k.indexOf('PCCHUYEN_') === 0) { var c3 = pcDoc_(all[k]); if (c3) chuyen.push({ viec: k.slice(9), tu: c3.tu, luc: c3.luc, sanSang: !!c3.sanSang }); }
    else if (k.indexOf('PCXIN_') === 0) { var x5 = pcDoc_(all[k]); if (x5 && now - Number(x5.luc || 0) <= 30 * 60000) xin.push({ may: k.slice(6), maXN: x5.maXN, luc: x5.luc, daDuyet: !!x5.goi }); }   // 14/10 PC xin khoá (không trả gói)
  }
  return phanHoiJson({ status: 'success', may: may, khoa: khoa, chuyen: chuyen, xin: xin, bridge: bridgeDs_(), srvNow: now, hetHanPhut: Number(props.getProperty('PCNHIP_HET_HAN_PHUT') || 30) });
}

/* 13/10 tối user: «Máy trạm ở mục Xác minh, dưới cùng — BUỘC PHẢI CÓ MẬT KHẨU mới xem được» (cả điện thoại, nơi không có máy chủ 8591).
 * Mật khẩu = mật khẩu Xác minh. GAS KHÔNG giữ mật khẩu: mỗi lần đăng nhập Xác minh thành công trên laptop, bang-591 gửi
 * {email, muối, băm SHA-256 lặp PC_VONG lần} qua pcDatMk (cần SECRET). Điện thoại đăng nhập → pcDangNhap kiểm băm → phiên 12 giờ
 * (Script Properties chỉ giữ BĂM của phiên). Sai 5 lần / 10 phút / email → khoá 10 phút. Bảng chỉ trả qua pcBangPh (phải có phiên). */
function pcBamMk_(mk, muoi, vong) {
  var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, muoi + ':' + mk, Utilities.Charset.UTF_8);
  var sb = Utilities.newBlob(muoi).getBytes();
  for (var i = 0; i < vong; i++) b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, b.concat(sb));
  return b.map(function (x) { return ('0' + (x & 255).toString(16)).slice(-2); }).join('');
}
function pcHex_(s) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8).map(function (x) { return ('0' + (x & 255).toString(16)).slice(-2); }).join(''); }
function apiPcDatMk_(d) {   // SECRET (chỉ bang-591)
  var email = String(d.email || '').trim().toLowerCase(), vong = Number(d.vong) || 0;
  if (d.xoa) { var p0 = PropertiesService.getScriptProperties(), d0 = pcDoc_(p0.getProperty('PCMK_DS')) || {}; delete d0[email]; p0.setProperty('PCMK_DS', JSON.stringify(d0)); return phanHoiJson({ status: 'success', daXoa: email }); }
  if (!/^[^@\s]+@[^@\s]+$/.test(email) || !/^[0-9a-f]{32}$/.test(String(d.muoi || '')) || !/^[0-9a-f]{64}$/.test(String(d.bam || '')) || vong < 1000 || vong > 20000)
    return phanHoiJson({ status: 'error', message: 'Thiếu/sai dữ liệu băm' });
  var props = PropertiesService.getScriptProperties(), ds = pcDoc_(props.getProperty('PCMK_DS')) || {};
  ds[email] = { muoi: String(d.muoi), bam: String(d.bam), vong: vong, luc: new Date().toISOString() };
  props.setProperty('PCMK_DS', JSON.stringify(ds));
  return phanHoiJson({ status: 'success' });
}
function apiPcDangNhap_(d) {
  var email = String(d.email || '').trim().toLowerCase(), mk = String(d.mk || '');
  var cache = CacheService.getScriptCache(), kSai = 'pcmk_sai_' + pcHex_(email).slice(0, 16), sai = Number(cache.get(kSai) || 0);
  if (sai >= 5) return phanHoiJson({ status: 'error', code: 429, message: 'Sai quá 5 lần — thử lại sau 10 phút' });
  var props = PropertiesService.getScriptProperties(), tk = (pcDoc_(props.getProperty('PCMK_DS')) || {})[email];
  if (!tk) { cache.put(kSai, String(sai + 1), 600); return phanHoiJson({ status: 'error', code: 401, message: 'Sai email hoặc mật khẩu' + (Object.keys(pcDoc_(props.getProperty('PCMK_DS')) || {}).length ? '' : ' (chưa đồng bộ: đăng nhập Xác minh trên laptop 1 lần)') }); }
  if (pcBamMk_(mk, tk.muoi, tk.vong) !== tk.bam) { cache.put(kSai, String(sai + 1), 600); return phanHoiJson({ status: 'error', code: 401, message: 'Sai email hoặc mật khẩu' }); }
  cache.remove(kSai);
  var ph = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''), now = new Date().getTime(), het = now + 12 * 36e5, all = props.getProperties();
  for (var k in all) if (k.indexOf('PCPHIEN_') === 0) { var p = pcDoc_(all[k]); if (!p || Number(p.het) < now) props.deleteProperty(k); }   // dọn phiên hết hạn
  props.setProperty('PCPHIEN_' + pcHex_(ph), JSON.stringify({ email: email, het: het }));
  return phanHoiJson({ status: 'success', ph: ph, het: het, email: email });
}
function pcPhienOK_(ph) {
  if (!/^[0-9a-f]{64}$/.test(String(ph || ''))) return null;
  var p = pcDoc_(PropertiesService.getScriptProperties().getProperty('PCPHIEN_' + pcHex_(String(ph))));
  return p && Number(p.het) > new Date().getTime() ? p : null;
}
function apiPcDangXuat_(d) { if (/^[0-9a-f]{64}$/.test(String(d.ph || ''))) PropertiesService.getScriptProperties().deleteProperty('PCPHIEN_' + pcHex_(String(d.ph))); return phanHoiJson({ status: 'success' }); }

// Bảng máy trạm cho dashboard — PHẢI có phiên (pcDangNhap). Không trả tên khoá .env (coKhoa) — chỉ cờ coCamera.
// Dừng/tiếp tục KHÔNG có ở đây (vẫn chỉ qua máy chủ 8591 + đăng nhập Xác minh).
function apiPcBangPh_(d) {
  /* 14/10 trưa: nhận cả phiên HỆ TÀI KHOẢN MỚI (TaiKhoan.gs tkPhien_) nếu tài khoản có quyền Xác minh → 1 lần đăng nhập (nút «Đăng nhập»
     thanh bên) là xem được Máy trạm, không đăng nhập lần 2. Phiên riêng pcDangNhap cũ vẫn nhận (máy chưa có hệ tài khoản). */
  var nTk = (typeof tkPhien_ === 'function') ? tkPhien_(d.ph) : null;
  var duocTk = !!(nTk && nTk.quyen && nTk.quyen['r.xacminh'] && nTk.quyen['r.xacminh'] !== 'khong');
  if (!duocTk && !pcPhienOK_(d.ph)) return phanHoiJson({ status: 'error', code: 401, message: 'Phiên đăng nhập đã hết — đăng nhập lại.' });
  var all = PropertiesService.getScriptProperties().getProperties(), now = new Date().getTime(), may = [], chuyen = [];
  for (var k in all) {
    if (k.indexOf('PCNHIP_') === 0 && k !== 'PCNHIP_HET_HAN_PHUT') {
      var v = pcDoc_(all[k]); if (!v || !v.may) continue; var l = pcLenhCua_(all, v.may);
      may.push(pcPhuGop_(all, { may: v.may, luc: v.luc, ramTrongPct: v.ramTrongPct, cpuPct: v.cpuPct, diaTrongGB: v.diaTrongGB, yeu: v.yeu, diem: v.diem, nhan: v.nhan, ramTongGB: v.ramTongGB, ban: v.ban,
        coCamera: (v.coKhoa || []).indexOf('TOPREVIEW_USER') >= 0, dangChay: v.dangChay || [], viecGiao: v.viecGiao || [], tatCaViec: v.tatCaViec || [], viecNang: v.viecNang || [], chayLuc: v.chayLuc, congLuc: v.congLuc, taskDP: v.taskDP, coKhoa: v.coKhoa || [], oDia: v.oDia || [], dung: l.dung, dungViec: l.dungViec, lenhBoi: l.dung ? l.boi : '', capNhatYc: l.capNhat, capGan: v.capGan || [], xmHam: v.xmHam || '' }, now));
    } else if (k.indexOf('PCCHUYEN_') === 0) { var c = pcDoc_(all[k]); if (c) chuyen.push({ viec: k.slice(9), tu: c.tu, luc: c.luc, sanSang: !!c.sanSang }); }
  }
  return phanHoiJson({ status: 'success', may: may, chuyen: chuyen, bridge: bridgeDs_(), srvNow: now });
}

/* 14/10 user cài thử trên PC bằng bộ cài tải NGAY TRÊN PC (bản công khai, không khoá) → «.env CON TRONG». Luồng XIN KHOÁ – DUYỆT:
 *  PC (không khoá) → pcXinKhoa {may, ma(32 hex ngẫu nhiên PC tự sinh)} → lưu PCXIN_<máy> = {bamMa, luc}; màn PC hiện MÃ XÁC NHẬN = 4 ký tự
 *  đầu của sha256(ma). Laptop (mục Máy trạm, qua 8591 + SECRET) thấy yêu cầu + cùng mã → bấm Duyệt → pcDuyetKhoa {may, goi(base64 .env)}.
 *  PC hỏi pcLayKhoa {may, ma} mỗi 10 s: sha256(ma) khớp mới trả gói rồi XOÁ ngay. Hết hạn 30' tự bỏ. Không ai lấy được gói nếu không có ma. */
/* 14/10 user: «tôi tải ngay trên nút ở audit-dc về cài — tóm gọn trong 1 lần cài». Nút trên máy KHÔNG phải laptop: đăng nhập
 * (pcDangNhap, cùng mật khẩu Xác minh) → pcBoCai {ph} trả gói khoá → trang chèn vào CAI-PC-1LAN.bat → tải về, chạy 1 lần là xong.
 * Gói do bang-591 (laptop) gửi lên qua pcDatGoi (SECRET) lúc khởi động + mỗi lần đăng nhập Xác minh — luôn theo .env laptop. */
function apiPcDatGoi_(d) {   // SECRET
  if (!/^[A-Za-z0-9+\/=]{20,4000}$/.test(String(d.goi || ''))) return phanHoiJson({ status: 'error', message: 'Gói khoá hỏng' });
  PropertiesService.getScriptProperties().setProperty('PCGOI', JSON.stringify({ goi: String(d.goi), luc: new Date().toISOString() }));
  return phanHoiJson({ status: 'success' });
}
function pcGoiBam_() { var g = pcDoc_(PropertiesService.getScriptProperties().getProperty('PCGOI')); return g && g.goi ? pcHex_(String(g.goi)).slice(0, 16) : ''; }
function apiPcLayGoi_() {   // SECRET — máy trạm (đã đủ khoá) lấy gói khoá hiện hành để cập nhật .env khi gói đổi
  var g = pcDoc_(PropertiesService.getScriptProperties().getProperty('PCGOI'));
  if (!g || !g.goi) return phanHoiJson({ status: 'error', code: 404, message: 'Chưa có gói khoá' });
  return phanHoiJson({ status: 'success', goi: g.goi, goiBam: pcHex_(String(g.goi)).slice(0, 16), luc: g.luc });
}
/* 20/10 SAO LƯU SHEET (đánh giá: 0 bản sao lưu): chép 4 sheet vào thư mục Drive riêng «Sao lưu Audit (không chia sẻ)», giữ `giu` bản gần nhất mỗi sheet.
   Không dùng trigger thời gian (scope scriptapp chưa cấp) — laptop gọi mỗi ngày (sao-luu-du-lieu.mjs). */
function apiSaoLuuSheet_(d) {
  var props = PropertiesService.getScriptProperties(), giu = Math.max(3, Math.min(60, Number(d.giu) || 14)), ngay = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd');
  var thu = null, idThu = props.getProperty('SAO_LUU_THU_MUC');
  if (idThu) { try { thu = DriveApp.getFolderById(idThu); } catch (e) { thu = null; } }
  if (!thu) { thu = DriveApp.createFolder('Sao lưu Audit (không chia sẻ)'); props.setProperty('SAO_LUU_THU_MUC', thu.getId()); }
  var nguon = [], ss0 = SpreadsheetApp.getActiveSpreadsheet(); if (ss0) nguon.push(ss0.getId());
  [props.getProperty('PRIVATE_SHEET_ID'), (typeof STOCKLOC_SHEET_ID !== 'undefined' ? STOCKLOC_SHEET_ID : ''), (typeof NT_SHEET_ID !== 'undefined' ? NT_SHEET_ID : '')].forEach(function (id) { if (id && nguon.indexOf(id) < 0) nguon.push(id); });
  var ds = [];
  nguon.forEach(function (id) {
    try { var f = DriveApp.getFileById(id), ten = f.getName(); var daCo = thu.getFilesByName(ten + ' · sao lưu ' + ngay); if (daCo.hasNext()) { ds.push({ ten: ten, ngay: ngay, trung: true }); return; }
      var c = f.makeCopy(ten + ' · sao lưu ' + ngay, thu); ds.push({ ten: ten, ngay: ngay, id: c.getId() });
      var cu = []; var it = thu.getFiles(); while (it.hasNext()) { var x = it.next(); var m = /^(.*) · sao lưu (\d{4}-\d{2}-\d{2})$/.exec(x.getName()); if (m && m[1] === ten) cu.push({ f: x, ngay: m[2] }); }
      cu.sort(function (a, b) { return a.ngay < b.ngay ? 1 : -1; }); cu.slice(giu).forEach(function (x) { x.f.setTrashed(true); });
    } catch (e) { ds.push({ id: id, loi: String(e.message || e).slice(0, 120) }); }
  });
  return phanHoiJson({ status: 'success', ds: ds, thuMuc: thu.getId() });
}
function apiPcBoCai_(d) {
  /* 14/10 user chọn «bỏ hẳn đăng nhập» → 20/10 đánh giá an ninh: cửa này trả TRỌN GÓI KHOÁ cho bất kỳ ai POST (đã thử) ⇒ user «xử lý hết»:
     GÁC LẠI bằng phiên tài khoản có quyền Xác minh (tkPhien_) hoặc phiên Máy trạm (pcDangNhap). Không phiên → 401, không trả gì. */
  var nTk = (typeof tkPhien_ === 'function') ? tkPhien_(d.ph) : null;
  var duocTk = !!(nTk && nTk.quyen && nTk.quyen['r.xacminh'] === 'lam');
  if (!duocTk && !pcPhienOK_(d.ph)) return phanHoiJson({ status: 'error', code: 401, message: 'Cần đăng nhập tài khoản có quyền Xác minh (làm) rồi bấm lại.' });
  var g = pcDoc_(PropertiesService.getScriptProperties().getProperty('PCGOI'));
  if (!g || !g.goi) return phanHoiJson({ status: 'error', code: 404, message: 'Chưa có gói khoá — mở máy chủ Xác minh trên laptop 1 lần.' });
  return phanHoiJson({ status: 'success', goi: g.goi });
}
function apiPcXinKhoa_(d) {
  var may = String(d.may || '').slice(0, 60), ma = String(d.ma || '');
  if (!/^[\w.-]{1,60}$/.test(may) || !/^[0-9a-f]{32}$/.test(ma)) return phanHoiJson({ status: 'error', message: 'Thiếu tên máy / mã' });
  var props = PropertiesService.getScriptProperties(), all = props.getProperties(), now = new Date().getTime(), dem = 0;
  for (var k in all) if (k.indexOf('PCXIN_') === 0) { var x = pcDoc_(all[k]); if (!x || now - Number(x.luc || 0) > 30 * 60000) props.deleteProperty(k); else dem++; }
  if (dem >= 10 && !all['PCXIN_' + may]) return phanHoiJson({ status: 'error', message: 'Quá nhiều yêu cầu đang chờ' });
  var bam = pcHex_(ma);
  props.setProperty('PCXIN_' + may, JSON.stringify({ bamMa: bam, maXN: bam.slice(0, 4).toUpperCase(), luc: now }));
  return phanHoiJson({ status: 'success', maXN: bam.slice(0, 4).toUpperCase() });
}
function apiPcDuyetKhoa_(d) {   // SECRET (8591, người bấm Duyệt / Từ chối trên Máy trạm)
  var may = String(d.may || ''), props = PropertiesService.getScriptProperties(), x = pcDoc_(props.getProperty('PCXIN_' + may));
  if (!x) return phanHoiJson({ status: 'error', message: 'Không còn yêu cầu của máy này (hết hạn 30 phút?)' });
  if (!d.dongY) { props.deleteProperty('PCXIN_' + may); return phanHoiJson({ status: 'success', tuChoi: true }); }
  if (!/^[A-Za-z0-9+\/=]{20,4000}$/.test(String(d.goi || ''))) return phanHoiJson({ status: 'error', message: 'Gói khoá hỏng' });
  x.goi = String(d.goi); x.duyetLuc = new Date().getTime(); props.setProperty('PCXIN_' + may, JSON.stringify(x));
  return phanHoiJson({ status: 'success' });
}
function apiPcLayKhoa_(d) {
  var may = String(d.may || ''), props = PropertiesService.getScriptProperties(), x = pcDoc_(props.getProperty('PCXIN_' + may));
  if (!x || !/^[0-9a-f]{32}$/.test(String(d.ma || '')) || pcHex_(String(d.ma)) !== x.bamMa) return phanHoiJson({ status: 'error', code: 404, message: 'Không có yêu cầu khớp' });
  if (new Date().getTime() - Number(x.luc || 0) > 30 * 60000) { props.deleteProperty('PCXIN_' + may); return phanHoiJson({ status: 'error', code: 410, message: 'Yêu cầu hết hạn 30 phút' }); }
  if (!x.goi) return phanHoiJson({ status: 'success', cho: true });
  props.deleteProperty('PCXIN_' + may);   // lấy 1 lần rồi xoá
  return phanHoiJson({ status: 'success', goi: x.goi });
}

// Lệnh từ dashboard: { may, viec?(bỏ trống = cả máy), dung:true|false, boi }
// Dừng → nhả khoá giữ việc của máy đó (máy khác nhận ngay) + đánh dấu chuyển các việc nó ĐANG chạy.
function apiPcLenh_(duLieu) {
  var may = String(duLieu.may || '').slice(0, 60), viec = String(duLieu.viec || '').slice(0, 60), dung = !!duLieu.dung;
  if (!may) return phanHoiJson({ status: 'error', message: 'Thieu may' });
  var lock = LockService.getScriptLock();
  try { lock.waitLock(5000); } catch (e) { return phanHoiJson({ status: 'error', message: 'Ban (lock)' }); }
  try {
    var props = PropertiesService.getScriptProperties(), all = props.getProperties(), now = new Date().getTime();
    if (duLieu.xoa) {   // gỡ máy đã ngừng hẳn khỏi danh sách (máy còn sống gửi nhịp kế là tự hiện lại)
      props.deleteProperty('PCNHIP_' + may); props.deleteProperty('PCLENH_' + may);
      return phanHoiJson({ status: 'success', daXoa: may });
    }
    var l = pcLenhCua_(all, may);
    if (duLieu.capNhat) {   // 15/10 user «tìm cách quản lý các máy» — «Cập nhật ngay»: nhịp tim PC (SYSTEM, 1') thấy lệnh → chạy bộ cập nhật ngay, bỏ chờ canary
      l.capNhat = new Date().toISOString(); l.boi = String(duLieu.boi || '').slice(0, 80); props.setProperty('PCLENH_' + may, JSON.stringify(l));
      return phanHoiJson({ status: 'success', lenh: l, daChuyen: [] });
    }
    if (viec) { var i = l.dungViec.indexOf(viec); if (dung && i < 0) l.dungViec.push(viec); if (!dung && i >= 0) l.dungViec.splice(i, 1); }
    else l.dung = dung;
    l.luc = new Date().toISOString(); l.boi = String(duLieu.boi || '').slice(0, 80);
    if (!l.dung && !l.dungViec.length && !l.capNhat) props.deleteProperty('PCLENH_' + may); else props.setProperty('PCLENH_' + may, JSON.stringify(l));
    var daChuyen = [];
    if (dung) {
      var hb = pcDoc_(all['PCNHIP_' + may]) || {};
      for (var k in all) {
        if (k.indexOf('PCLEASE_') !== 0) continue;
        var tv = k.slice(8), c = pcDoc_(all[k]);
        if (c && c.may === may && (!viec || viec === tv)) props.deleteProperty(k);
      }
      (hb.dangChay || []).forEach(function (tv) {
        if (viec && viec !== tv) return;
        props.setProperty('PCCHUYEN_' + tv, JSON.stringify({ tu: may, luc: now, sanSang: false })); daChuyen.push(tv);
      });
    } else {
      // tiếp tục: huỷ việc chờ chuyển từ máy này (nếu chưa ai nhận) — để lịch tự nhiên quyết
      for (var k2 in all) { if (k2.indexOf('PCCHUYEN_') !== 0) continue; var c4 = pcDoc_(all[k2]); if (c4 && c4.tu === may && (!viec || k2.slice(9) === viec)) props.deleteProperty(k2); }
    }
    return phanHoiJson({ status: 'success', lenh: l, daChuyen: daChuyen });
  } finally { lock.releaseLock(); }
}function testQuyenFetch() {
  var r = UrlFetchApp.fetch('https://www.google.com');
  Logger.log('HTTP ' + r.getResponseCode());
}
