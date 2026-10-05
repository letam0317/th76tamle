/**
 * QC cho Code.js — chạy ĐÚNG các hàm bóc dữ liệu của Apps Script ngay trên máy,
 * trước khi đẩy lên Google. Mạng thật, dữ liệu thật; chỉ thay những thứ chỉ Google mới có:
 * UrlFetchApp (thay bằng curl), PropertiesService, Maps, Sheet.
 *
 * Chạy:  node qc-cao.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const nguon = fs.readFileSync(path.join(DIR, 'Code.js'), 'utf8');

/* ---- Giả lập môi trường Apps Script ---- */
const keo = (url) => {
  try {
    return execFileSync('curl', ['-sL', '--max-time', '45', '-A',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', url],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch { return ''; }
};
const traLoi = (body) => ({ getResponseCode: () => (body ? 200 : 599), getContentText: () => body });
globalThis.UrlFetchApp = {
  fetch: (url) => traLoi(keo(url)),
  fetchAll: (ycs) => ycs.map((y) => traLoi(keo(y.url)))   // GAS gọi song song, ở đây gọi lần lượt
};
const kho = {};
globalThis.PropertiesService = {
  getScriptProperties: () => ({
    getProperty: (k) => (k in kho ? kho[k] : null),
    setProperty: (k, v) => { kho[k] = v; },
    deleteProperty: (k) => { delete kho[k]; },
    getKeys: () => Object.keys(kho)
  })
};
globalThis.Utilities = { formatDate: (d) => d.toISOString(), sleep: () => {}, getUuid: () => 'uuid-thu' };
globalThis.Maps = null;
globalThis.LanguageApp = { translate: (t) => '[DICH] ' + t };   // QC không gọi dịch thật

(0, eval)(nguon + `
;globalThis.__nap = { taiNhieu_, phanTichVl24hDanhSach_, chuanHoaVl24h_, phanTichHoteljob_,
  phanTichCareerviet_, phanTichTopcv_, phanTichJobsgo_, phanTichTrangCongTy_, layChiTietHangLoat_, locVaXep_,
  xepThuTu_, timGioLam_, docMuc_, dinhDangLuong_, khongDau_, khongDauGach_, chuTruocSangGiay_,
  ngayVnSangGiay_, tai_, buTuBoNho_, laTinTuyenDung_, locDongGiaoDien_, laTelesale_, kieuTelesale_, laGioDem_, laXoayCa_, yeuCauTheoTenCongTy_, motLuotTai_, phanTichTgdd_, timLuongTrongChu_, timDiaChiTrongChu_, laCaDem_, chuanDiaChi_, gachDauDong_, boHtmlDong_, laTiengAnh_, dichSangViet_, kepMoc_,
  phanTichChotot_, urlChotot_, loaiViec_, chonTinMoHo_, tomTatDaDang_, oGan_, tachYeuCau_,
  viTriMwgHangLoat_, thuongHieuMwg_, khoangCachChim_, URL_MWG,
  linkViecTrongHtml_, noiUrl_, tachUrl_, khuonDuong_, idCongTy_, diemLinkViec_, VUNG_GAN,
  quetTrangCongTy_, capNhatNguonCongTy, NGUONCT_SUA_, NGUONCT_THEM_, cauCoDem_, MAC_DINH,
  conGioTai_, vungBaiDang_, raoTuKhoa_,
  apBanKinh_, diaChiMoHo_, nhan_, CHOTOT_HCM, CHOTOT_LONG_AN,
  TIEU_DE, RONG_COT, COT_LINK, COT_NGAYDANG, COT_CACHDAY, COT_GIO, COT_LUONG, COT_KM };`);
const F = globalThis.__nap;

let hong = 0;
const dat = (ten, ok, chiTiet) => {
  console.log(`${ok ? 'DAT ' : 'HONG'} ${ten}${chiTiet ? ' — ' + chiTiet : ''}`);
  if (!ok) hong++;
};
const t0 = Date.now();
const goc0 = { ten: 'Hóc Môn', lat: 10.8860463, lng: 106.5927134 };

/* ---- 0. Không có hàm nào gọi mà chưa viết ---- */
console.log('=== 0. Soi tĩnh mã nguồn ===');
const dinhNghia = new Set([...nguon.matchAll(/function\s+([A-Za-z0-9_]+)\s*\(/g)].map((m) => m[1]));
const duocGoi = new Set([...nguon.matchAll(/(?:^|[^A-Za-z0-9_.])([a-zA-Z][A-Za-z0-9]*_)\s*\(/gm)].map((m) => m[1]));
const thieu = [...duocGoi].filter((t) => !dinhNghia.has(t));
dat('Mọi hàm được gọi đều đã được viết', thieu.length === 0, thieu.join(', ') || 'không thiếu hàm nào');

/* ---- 1. Bốn nguồn danh sách ---- */
console.log('=== 1. Tải 4 trang danh sách ===');
const urls = [
  'https://vieclam24h.vn/tim-kiem-viec-lam-nhanh?q=' + encodeURIComponent('ca đêm'),
  'https://www.hoteljob.vn/tim-viec?keyword=' + encodeURIComponent('ca đêm') + '&city_id=3',
  'https://careerviet.vn/viec-lam/ca-dem-k-vi.html',
  'https://jobsgo.vn/viec-lam-ca-dem-tai-ho-chi-minh.html'
];
const tra = F.taiNhieu_(urls);
tra.forEach((r, i) => dat('HTTP 200 — ' + urls[i].split('/')[2], r.ma === 200,
  r.ma + ', ' + Math.round(r.noiDung.length / 1024) + ' KB'));

const vl = F.phanTichVl24hDanhSach_(tra[0].noiDung).map(F.chuanHoaVl24h_);
const hj = F.phanTichHoteljob_(tra[1].noiDung);
const cv = F.phanTichCareerviet_(tra[2].noiDung);
const tc = F.phanTichJobsgo_(tra[3].noiDung);

console.log('\n=== 2. Bóc tin từng nguồn ===');
dat('vieclam24h', vl.length >= 10, vl.length + ' tin · ví dụ: ' + (vl[0] || {}).ten);
dat('hoteljob', hj.length >= 5, hj.length + ' tin · ví dụ: ' + (hj[0] || {}).ten);
dat('careerviet', cv.length >= 5, cv.length + ' tin · ví dụ: ' + (cv[0] || {}).ten);
dat('jobsgo', tc.length >= 5, tc.length + ' tin · ví dụ: ' + (tc[0] || {}).ten);
[['careerviet', cv], ['jobsgo', tc]].forEach(([ten, ds]) => {
  const d = ds[0] || {};
  console.log(`   ${ten}: ${JSON.stringify({ luong: d.luong, noi: d.diaChi, ntd: (d.ntd || '').slice(0, 34), dang: d.dangLuc ? new Date(d.dangLuc * 1000).toLocaleDateString('vi') : 0, link: (d.link || '').slice(0, 70) })}`);
});
dat('Nguồn nào cũng có link mở được', [...vl, ...hj, ...cv, ...tc].every((v) => /^https?:\/\//.test(v.link || '')));
dat('Nguồn nào cũng có ngày đăng (trừ hoteljob lấy ở trang chi tiết)',
  [...vl, ...cv, ...tc].filter((v) => v.dangLuc > 0).length >= (vl.length + cv.length + tc.length) * 0.7,
  [...vl, ...cv, ...tc].filter((v) => v.dangLuc > 0).length + '/' + (vl.length + cv.length + tc.length) + ' tin có ngày đăng');

/* ---- 2b. Nguồn trang tuyển dụng Thế Giới Di Động ---- */
console.log('\n=== 2b. thegioididong.com (tin user hỏi 15/09) ===');
const tgTra = F.taiNhieu_(['https://vieclam.thegioididong.com/tuyen-dung?kv=thanh-pho-ho-chi-minh']);
const tg = F.phanTichTgdd_(tgTra[0].noiDung);
dat('Bóc được tin', tg.length >= 5, tg.length + ' tin · ví dụ: ' + ((tg[0] || {}).ten || ''));
dat('Tiêu đề đọc được (không còn mã &#x)', tg.every((v) => !/&#/.test(v.ten || '')));
const anNinh = {
  nguon: 'thegioididong.com', id: 'tgdd-428', ten: 'Cộng tác viên Giám Sát Camera An Ninh',
  chiTiet: '', yeuCau: '', gioLam: '', diaChi: 'Thành phố Hồ Chí Minh', lat: null, lng: null,
  dangLuc: 0, luongMin: 0, kmOto: null,
  link: 'https://vieclam.thegioididong.com/tuyen-dung/cong-tac-vien-giam-sat-an-ninh-the-gioi-di-dong-428'
};
F.layChiTietHangLoat_([anNinh], Date.now());
dat('Đọc được mô tả tin giám sát an ninh', (anNinh.chiTiet || '').length > 60,
  'giờ làm đọc ra: ' + anNinh.gioLam);
dat('Nhận ra là ca đêm dù tin không viết chữ "đêm"', F.laCaDem_(anNinh) === true);
dat('Không nhận nhầm ca hành chính là ca đêm',
  F.laCaDem_({ ten: 'Nhân viên kho', chiTiet: 'Làm việc 08:00 - 17:00 thứ 2 đến thứ 6', gioLam: '08:00 - 17:00' }) === false);

/* Tin user bắt được 15/09: tổng đài Điện Máy Xanh, "xoay ca" nhưng Ca 1 8h-17h, Ca 2 12h-21h. */
const tongDai = {
  nguon: 'thegioididong.com', id: 'tgdd-511', ten: 'Nhân viên Tổng Đài Tư Vấn Dịch Vụ Điện Máy Xanh',
  chiTiet: '', yeuCau: '', gioLam: '', diaChi: 'Thành phố Hồ Chí Minh', lat: null, lng: null,
  dangLuc: 0, luongMin: 0, kmOto: null,
  link: 'https://vieclam.thegioididong.com/tuyen-dung/nhan-vien-tong-dai-tu-van-ban-dich-vu-tho-dien-may-xanh-511'
};
F.layChiTietHangLoat_([tongDai], Date.now());
dat('Loại tin tổng đài xoay ca ban ngày (8h-17h / 12h-21h)', F.laCaDem_(tongDai) === false,
  'giờ đọc ra: ' + tongDai.gioLam);
dat('Vẫn giữ tin ghi rõ ca đêm trong mô tả',
  F.laCaDem_({ ten: 'Nhân viên bảo vệ', chiTiet: 'Trực ca đêm tại nhà máy, không nêu giờ cụ thể', gioLam: '' }) === true);

/* ---- 2b2. Cổng MWG: phải đọc HẾT các trang, không chỉ trang 1 (bài học 18/09/2026) ----
   Tin "Nhân viên Giám sát Camera An ninh Bách Hoá Xanh" (ca 21h-6h, Tân Bình) nằm ở TRANG 2;
   bản cũ chỉ đọc trang 1 nên không bao giờ thấy. Đo: 1 trang → 1 việc ca đêm · 8 trang → 8 việc. */
console.log('\n=== 2b2. Cổng MWG nhiều trang + nơi làm thật ===');
const mwgTra = F.taiNhieu_([F.URL_MWG, F.URL_MWG + '?page=2']);
const mwg1 = mwgTra[0].ma === 200 ? F.phanTichTgdd_(mwgTra[0].noiDung) : [];
const mwg2 = mwgTra[1].ma === 200 ? F.phanTichTgdd_(mwgTra[1].noiDung) : [];
dat('Trang 2 của cổng MWG cũng bóc được tin', mwg2.length >= 5, mwg1.length + ' tin trang 1 · ' + mwg2.length + ' tin trang 2');
dat('Trang 2 là tin KHÁC trang 1',
  mwg2.every((v) => !mwg1.some((u) => u.id === v.id)));
dat('Thương hiệu suy từ tên việc, không dán cứng TGDĐ',
  F.thuongHieuMwg_('Nhân Viên Giám Sát Camera An Ninh Bách Hóa Xanh') === 'Bách Hoá Xanh (MWG)' &&
  F.thuongHieuMwg_('Nhân viên Kho Dược Nhà Thuốc An Khang') === 'Nhà thuốc An Khang (MWG)' &&
  F.thuongHieuMwg_('Giám Sát Camera An Ninh Thế Giới Di Động') === 'Thế Giới Di Động (MWG)');

/* Nơi làm thật: cổng có cửa JSON /job/getpositions kèm toạ độ từng nơi. */
const mwgViec = {
  nguon: 'thegioididong.com', id: 'tgdd-138', ten: 'Nhân Viên Giám Sát Camera An Ninh Bách Hóa Xanh',
  chiTiet: '', yeuCau: '', gioLam: '', diaChi: 'Hồ Chí Minh và 1 tỉnh...', lat: null, lng: null,
  dangLuc: 0, luongMin: 0, kmOto: null,
  link: F.URL_MWG + '/nhan-vien-giam-sat-an-ninh-bach-hoa-xanh-138'
};
const soViTri = F.viTriMwgHangLoat_([mwgViec], goc0, Date.now());
dat('Hỏi được nơi làm thật (có toạ độ)', soViTri === 1 && !!mwgViec.lat && !!mwgViec.lng,
  mwgViec.diaChi + ' · ' + (mwgViec.lat ? mwgViec.lat.toFixed(4) + ',' + mwgViec.lng.toFixed(4) : '—') +
  (mwgViec.soDiaDiem ? ' (1 trong ' + mwgViec.soDiaDiem + ' nơi)' : ''));
dat('Khoảng cách ra số THẬT, không phải 9,3 km giả',
  mwgViec.lat ? Math.abs(F.khoangCachChim_(goc0.lat, goc0.lng, mwgViec.lat, mwgViec.lng) - 9.3) > 1 : false,
  mwgViec.lat ? F.khoangCachChim_(goc0.lat, goc0.lng, mwgViec.lat, mwgViec.lng).toFixed(1) + ' km chim bay' : '—');
F.layChiTietHangLoat_([mwgViec], Date.now());
dat('Đọc ra ca 21h-6h và nhận là ca đêm', F.laCaDem_(mwgViec) === true, 'giờ: ' + mwgViec.gioLam);
dat('Địa chỉ "Hồ Chí Minh và 1 tỉnh..." bị coi là mơ hồ (không đem đi đo)',
  F.diaChiMoHo_('Hồ Chí Minh và 1 tỉnh...') === true && F.diaChiMoHo_('Toàn quốc') === true);
dat('Địa chỉ thật của nơi làm thì vẫn đo được',
  F.diaChiMoHo_('112 Hoàng Hoa Thám, Phường Bảy Hiền, Thành phố Hồ Chí Minh') === false);

/* ---- 2b3. Máy chủ tự quét trang tuyển dụng công ty (18/09/2026) ----
   Trước đây kênh này chỉ chạy khi user bấm tay + Edge đang mở, nên lượt tự động mỗi giờ không
   ngó công ty nào. Nay máy chủ tự quét bằng MỘT nguyên tắc chung; web JavaScript vẫn để tiện ích. */
console.log('\n=== 2b3. Máy chủ tự quét trang công ty ===');
dat('Nối đường dẫn tương đối (Apps Script không có lớp URL)',
  F.noiUrl_('https://a.vn/tuyen-dung/', '/viec-lam/x') === 'https://a.vn/viec-lam/x' &&
  F.noiUrl_('https://a.vn/tuyen-dung/ds.html', 'chi-tiet-1') === 'https://a.vn/tuyen-dung/chi-tiet-1' &&
  F.noiUrl_('https://a.vn/x', 'https://b.vn/y') === 'https://b.vn/y' &&
  F.noiUrl_('https://a.vn/x', 'javascript:;') === '');
dat('Khuôn đường dẫn', F.khuonDuong_('/jobs/nhan-vien-kho') === '/jobs/*' &&
  F.khuonDuong_('/tuyen-dung/abc/xyz') === '/tuyen-dung/abc/*');
dat('Tin đáng ngờ được xếp đọc trước',
  F.diemLinkViec_({ ten: 'Nhân viên kho ca đêm', link: 'https://a.vn/jobs/kho-ca-dem' }) >
  F.diemLinkViec_({ ten: 'Nhân viên kho', link: 'https://a.vn/jobs/kho' }) &&
  F.diemLinkViec_({ ten: 'Nhân viên kho', link: 'https://a.vn/jobs/kho' }) >
  F.diemLinkViec_({ ten: 'Kế toán tổng hợp', link: 'https://a.vn/jobs/ke-toan' }));

const ctTra = F.taiNhieu_(['https://mmvietnam.com/tuyen-dung/', 'https://tuyendung.kingfoodmart.com/']);
const ctLink = ctTra[0].ma === 200 ? F.linkViecTrongHtml_(ctTra[0].noiDung, 'https://mmvietnam.com/tuyen-dung/') : [];
dat('Nhặt được link tin việc trên web thường (MM Mega Market)', ctLink.length >= 5,
  ctLink.length + ' link · khuôn ' + ((ctLink[0] || {}).khuon || '—'));
dat('Link nhặt ra là TIN VIỆC, không phải danh mục/ảnh/CSS',
  ctLink.every((o) => !/\.(css|js|png|jpg|svg)$/i.test(o.link)) &&
  ctLink.length === ctLink.filter((o) => o.khuon === ctLink[0].khuon).length);
const ctJs = ctTra[1].ma === 200 ? F.linkViecTrongHtml_(ctTra[1].noiDung, 'https://tuyendung.kingfoodmart.com/') : [];
dat('Web chạy JavaScript thì ra 0 link (để tiện ích Edge lo, không báo hỏng)', ctJs.length === 0);
dat('Mã tin trang công ty ổn định theo đường dẫn',
  F.idCongTy_('https://a.vn/jobs/x') === F.idCongTy_('https://a.vn/jobs/x') &&
  F.idCongTy_('https://a.vn/jobs/x') !== F.idCongTy_('https://a.vn/jobs/y'));
dat('Tin trang công ty đọc ra nơi làm ở xa thì KHÔNG giữ',
  F.oGan_({ nguon: 'trang công ty', ten: 'Nhân viên kho', diaChi: 'Khu công nghiệp Đồng Văn, Hà Nam' }, { banKinh: 20, noiThem: 5 }, goc0) === false);
dat('Tin trang công ty chưa đọc ra nơi làm thì vẫn giữ (xếp cuối)',
  F.oGan_({ nguon: 'trang công ty', ten: 'Nhân viên kho ca đêm', diaChi: '' }, { banKinh: 20, noiThem: 5 }, goc0) === true);
dat('Tin trang công ty ở gần thì giữ',
  F.oGan_({ nguon: 'trang công ty', ten: 'Bảo vệ', diaChi: '112 Hoàng Hoa Thám, Tân Bình, TP.HCM' }, { banKinh: 20, noiThem: 5 }, goc0) === true);

/* Chạy THẬT quetTrangCongTy_ với một tab NGUỒN CÔNG TY giả — đây là chỗ dễ vỡ khi lên Google
   (đọc Sheet, xoay vòng, gọi mạng), node --check không thấy. */
{
  const dongTab = [
    ['Tên công ty', 'Trang tuyển dụng', 'Facebook page', 'Ghi chú'],
    ['MM Mega Market', 'https://mmvietnam.com/tuyen-dung/', '', ''],
    ['Kingfoodmart (vỏ JS)', 'https://tuyendung.kingfoodmart.com/', '', ''],
    ['Bỏ qua vì có nguồn riêng', 'https://vieclam.thegioididong.com/tuyen-dung', '', '']
  ];
  const shGia = {
    getLastRow: () => dongTab.length,
    getRange: (d1, c1, sd, sc) => ({
      getValues: () => dongTab.slice(d1 - 1, d1 - 1 + sd).map((r) => r.slice(c1 - 1, c1 - 1 + sc)),
      setValue: () => {}, setValues: () => {}
    }),
    getDataRange: () => ({ getValues: () => dongTab })
  };
  const ssGia = { getSheetByName: () => shGia, insertSheet: () => shGia };
  const cfgGia = { congTyCaoMoiLuot: 3, tinMoiCongTy: 4, banKinh: 20, noiThem: 5 };
  let raCt = [], loi = '';
  try { raCt = F.quetTrangCongTy_(ssGia, cfgGia, {}, Date.now()); } catch (e) { loi = String(e); }
  dat('quetTrangCongTy_ chạy trọn vẹn, không ném lỗi', !loi, loi || raCt.length + ' tin đọc được');
  dat('Đọc ra tin có nội dung + đường dẫn', raCt.length >= 2 &&
    raCt.every((v) => v.link && v.id && (v.chiTiet || '').length > 40),
    (raCt[0] || {}).ten ? String(raCt[0].ten).slice(0, 50) : '—');
  dat('Không quét lại cổng MWG (đã có nguồn riêng)',
    raCt.every((v) => String(v.link).indexOf('thegioididong.com') < 0));
  dat('Tin đã đọc lượt trước thì KHÔNG đọc lại',
    F.quetTrangCongTy_(ssGia, cfgGia, (() => {
      const nho = {}; raCt.forEach((v) => { nho[v.id] = { id: v.id }; }); return nho;
    })(), Date.now()).every((v) => !raCt.some((u) => u.id === v.id)));
  dat('Bảng sửa/thêm danh sách công ty hợp lệ',
    F.NGUONCT_SUA_.every((r) => r.length === 2) && F.NGUONCT_THEM_.every((r) => r.length === 4 && /^https?:/.test(r[1])));
}

/* ---- 2b4. Câu "ca đêm" nằm SÂU trong bài (19/09/2026) ----
   Tin "NHÂN VIÊN GIÁM SÁT AN NINH & KIỂM SOÁT NỘI BỘ (AUDIT)" của BEST Logistics ghi
   "(Đối với Audit tại SC bắt buộc Làm việc ca đêm)" ở khoảng chữ thứ 4.000 — ngoài tầm cắt của
   chiTiet (600) và yeuCau (320) nên bản cũ loại thẳng. Bản mới soi cả trang rồi kẹp câu đó vào
   đầu phần chi tiết để vừa lọt bộ lọc vừa cho người đọc thấy bằng chứng. */
console.log('\n=== 2b4. Bằng chứng ca đêm nằm sâu trong bài ===');
const sauBai = {
  nguon: 'careerviet.vn', id: 'cv-35C87A02', ten: 'NHÂN VIÊN GIÁM SÁT AN NINH & KIỂM SOÁT NỘI BỘ (AUDIT)',
  chiTiet: '', yeuCau: '', gioLam: '', diaChi: 'Hồ Chí Minh, Bắc Ninh', lat: null, lng: null,
  dangLuc: 0, luongMin: 0, kmOto: null,
  link: 'https://careerviet.vn/vi/tim-viec-lam/nhan-vien-giam-sat-an-ninh-kiem-soat-noi-bo-audit.35C87A02.html'
};
F.layChiTietHangLoat_([sauBai], Date.now());
dat('Đọc được nội dung tin', (sauBai.chiTiet || '').length > 80);
dat('Nhận ra ca đêm dù câu nằm ngoài đoạn trích', F.laCaDem_(sauBai) === true);
dat('Có kẹp câu bằng chứng vào phần chi tiết', /⚑/.test(sauBai.chiTiet || '') &&
  /ca đêm/i.test(String(sauBai.chiTiet).split('—')[0]),
  String(sauBai.chiTiet).split('—')[0].replace('⚑', '').trim().slice(0, 90));
dat('Câu bằng chứng lấy trọn dòng, không cụt đầu chữ',
  !/^⚑ [a-zàâăêôơưđ]/.test(String(sauBai.chiTiet)));
dat('Không có chữ ca đêm thì KHÔNG bịa bằng chứng',
  F.cauCoDem_('Làm việc giờ hành chính từ thứ 2 đến thứ 6, nghỉ trưa 1 tiếng.') === '');

dat('Đọc giờ viết bằng dấu chấm "22.00 – 07.00"', F.timGioLam_('Ca đêm: 22.00 – 07.00') === '22:00 - 07:00 (hôm sau)');
dat('Không nhầm khoảng LƯƠNG thành giờ làm',
  F.timGioLam_('Lương 9.5 - 12 triệu/tháng') === '—' && F.timGioLam_('Thu nhập 10.00 - 15.00 triệu') === '—');

dat('Có dòng cấu hình "từ khoá NGHỀ"',
  F.MAC_DINH.some((r) => /Từ khoá NGHỀ/.test(String(r[0]))) &&
  F.MAC_DINH.some((r) => /Số dòng tối đa trong BỘ NHỚ/.test(String(r[0]))));

/* ---- 2b5. Ngân sách thời gian (19/09/2026) ----
   Lượt chạy 6 phút của Google bị vỡ ⇒ mất trắng cả lượt (không ghi bảng, không ghi BỘ NHỚ) nên
   lượt sau lặp lại y hệt. Nay quá 210 giây là ngừng tải thêm, phần còn lại trả mã 0 để bù từ bộ nhớ. */
console.log('\n=== 2b5. Ngân sách thời gian ===');
{
  const luuMoc = globalThis.MOC_CHAY_;
  dat('Còn giờ thì vẫn tải bình thường', F.conGioTai_() === true);
  (0, eval)('MOC_CHAY_ = Date.now() - 999000');   // giả vờ đã chạy 999 giây
  dat('Hết ngân sách thì báo dừng', F.conGioTai_() === false);
  const tra = F.taiNhieu_(['https://vieclam.thegioididong.com/tuyen-dung', 'https://careerviet.vn/viec-lam/ca-dem-k-vi.html']);
  dat('Hết giờ thì KHÔNG gọi mạng nữa, trả mã 0', tra.length === 2 && tra.every((r) => r.ma === 0),
    tra.map((r) => r.ma).join(','));
  (0, eval)('MOC_CHAY_ = 0');
  dat('Trả lại mốc thì tải lại được', F.conGioTai_() === true);
}

/* ---- 2c. Bài Facebook do tiện ích gửi về ---- */
console.log('\n=== 2c. Xử lý bài Facebook ===');
const baiFb = [
  'TUYỂN BẢO VỆ CA ĐÊM - LÀM NGAY',
  'Ca làm: 18h00 - 06h00 sáng hôm sau',
  'Lương 7.500.000/tháng, bao cơm 1 bữa',
  'Địa chỉ: 123 Quang Trung, phường 8, Gò Vấp',
  'Ai cần liên hệ Zalo 09xx'
].join('\n');
const tinFb = {
  nguon: 'facebook', id: 'fb-thu-1', ten: 'TUYỂN BẢO VỆ CA ĐÊM - LÀM NGAY',
  chiTiet: F.gachDauDong_(baiFb), yeuCau: '', gioLam: '',
  diaChi: F.timDiaChiTrongChu_(baiFb), luong: F.timLuongTrongChu_(baiFb),
  lat: null, lng: null, dangLuc: 0, luongMin: 0, kmOto: null
};
dat('Đọc ra mức lương trong bài', /7[.,]500[.,]000/.test(tinFb.luong), tinFb.luong);
dat('Đọc ra địa chỉ trong bài (không dính câu sau)',
  /Gò Vấp/i.test(tinFb.diaChi) && !/Zalo/i.test(tinFb.diaChi), tinFb.diaChi);
dat('Nhận là ca đêm', F.laCaDem_(tinFb) === true, 'giờ đọc ra: ' + F.timGioLam_(baiFb));
dat('Bài được xuống dòng gạch đầu dòng', tinFb.chiTiet.split('\n').length >= 4);
const fbQuaLoc = F.locVaXep_([tinFb], { banKinh: 35, toiDa: 40, telesaleXuongCuoi: true }, goc0);
dat('Lọt qua bộ lọc khu vực nhờ soi cả nội dung', fbQuaLoc.length === 1);
const fbXa = Object.assign({}, tinFb, { id: 'fb-thu-2', diaChi: '', chiTiet: F.gachDauDong_('TUYỂN BẢO VỆ CA ĐÊM\nLàm 18h-6h tại Đà Nẵng') });
dat('Bài ngoài khu vực bị loại', F.locVaXep_([fbXa], { banKinh: 35, toiDa: 40, telesaleXuongCuoi: true }, goc0).length === 0);

/* ---- 2d. Nguồn hỏng thì bù bằng tin cũ ---- */
console.log('\n=== 2d. Nguồn hỏng thì bù từ bộ nhớ ===');
const nhoGia = {
  'vl24h-1': { id: 'vl24h-1', nguon: 'vieclam24h.vn', ten: 'Bảo vệ ca đêm quận 12', ntd: 'Cty A',
    luong: '8.000.000 đ/tháng', diaChi: 'Quận 12', lat: 10.86, lng: 106.63, km: 5.4,
    dangLuc: Math.round(Date.now() / 1000) - 86400, gioLam: '22:00 - 06:00', chiTiet: '• Trực đêm',
    yeuCau: '', link: 'https://vieclam24h.vn/viec-lam/x-c1p122id1.html', lanThay: new Date() },
  'vl24h-cu': { id: 'vl24h-cu', nguon: 'vieclam24h.vn', ten: 'Tin quá cũ', ntd: '', luong: '', diaChi: '',
    lat: '', lng: '', km: '', dangLuc: 0, gioLam: '', chiTiet: '', yeuCau: '', link: 'https://vieclam24h.vn/x',
    lanThay: new Date(Date.now() - 30 * 86400000) },
  'htj-1': { id: 'htj-1', nguon: 'hoteljob.vn', ten: 'Lễ tân ca đêm', ntd: '', luong: '', diaChi: '',
    lat: '', lng: '', km: '', dangLuc: 0, gioLam: '', chiTiet: '', yeuCau: '', link: 'https://www.hoteljob.vn/x',
    lanThay: new Date() }
};
const bu = F.buTuBoNho_(nhoGia, 'vieclam24h.vn', 7);
dat('Bù đúng tin của nguồn đang hỏng', bu.length === 1 && bu[0].id === 'vl24h-1', bu.map((v) => v.id).join(', '));
dat('Không bù tin quá hạn 7 ngày', !bu.some((v) => v.id === 'vl24h-cu'));
dat('Không đụng tin của nguồn khác', !bu.some((v) => v.nguon !== 'vieclam24h.vn'));
dat('Tin bù giữ nguyên toạ độ và nội dung', bu[0] && bu[0].lat === 10.86 && bu[0].chiTiet.includes('Trực đêm'));


/* ---- 2e. Lớp gác thứ hai ở Sheet: chỉ nhận tin TUYỂN NGƯỜI ---- */
console.log('\n=== 2e. Gác rác Facebook ở phía Sheet ===');
const racThat = [
  'dạ em xin JD job service nha anh. Trả lời Chia sẻ dạ em cảm ơn anh nhiều ạ, em mong được phản hồi sớm',
  'E k rep đc ạ ib zl0383154301 Thích Trả lời Chia sẻ em nhắn tin mãi mà không thấy trả lời gì hết ạ',
  'mình học quản trị khách sạn tốt nghiệp cũng loại ổn ổn, đợt đó đi xin việc khách sạn A giấu tên lương cơ bản 8tr cùng chế độ đãi ngộ khá ổn'
];
const tinThat = [
  'TUYỂN BẢO VỆ CA ĐÊM làm việc tại Gò Vấp, ca 18h-6h sáng, lương 7.500.000/tháng, bao cơm một bữa, liên hệ Zalo 090xxx',
  'Khách sạn cần tuyển gấp nhân viên buồng phòng housekeeping ca đêm, lương 8-9 triệu, bao ăn ở, làm việc tại quận 3'
];
racThat.forEach((c, i) => dat('Sheet loại rác ' + (i + 1), F.laTinTuyenDung_(c) === false));
tinThat.forEach((c, i) => dat('Sheet giữ tin thật ' + (i + 1), F.laTinTuyenDung_(c) === true));
dat('Sheet giữ tin ngắn kiểu nhóm "Cần 2 bảo vệ ca đêm Q12, 7tr, LH 0909…"', F.laTinTuyenDung_('Cần 2 bảo vệ ca đêm Q12, 7tr, LH 0909123456 gấp') === true);
dat('Sheet giữ tin "Tìm phục vụ ca tối… ib zalo"', F.laTinTuyenDung_('Tìm phục vụ ca tối 18h-23h quán Gò Vấp, bao ăn, lương 25k/giờ, ib zalo') === true);
dat('Vẫn loại câu hỏi ngắn "ai biết chỗ nào tuyển bảo vệ đêm không"', F.laTinTuyenDung_('ai biết chỗ nào tuyển bảo vệ đêm không ạ, em cần việc gấp lắm') === false);
dat('Cắt dòng giao diện lẫn trong bài',
  !/Trả lời|Chia sẻ/.test(F.locDongGiaoDien_('TUYỂN BẢO VỆ' + String.fromCharCode(10) + 'Trả lời' + String.fromCharCode(10) + 'Chia sẻ')));

/* ---- 2f. Luật giờ 19h-8h · xoay ca · việc mới lên đầu ---- */
console.log('\n=== 2f. Luật giờ 19h→8h, xoay ca, thứ tự mới-lên-đầu ===');
[[22, 6, true], [19, 7, true], [19, 3, true], [18, 2, true], [0, 8, true], [16, 3, true],
 [17, 23, false], [18, 22, false], [6, 8, false], [8, 17, false], [12, 21, false]]
  .forEach(([a, b, m]) => dat(`Giờ ${String(a).padStart(2)}h-${String(b).padStart(2)}h → ${m ? 'ca đêm' : 'không'}`, F.laGioDem_(a, b) === m));
dat('Kingfoodmart "Ca 3: 22h-6h, xoay ca, tối đa 2 ca đêm/tuần" → xoay ca',
  F.laXoayCa_({ ten: 'Security - Nhân viên an ninh', chiTiet: 'Ca 3: 22h-6h. Ứng viên Nam làm xoay ca (tối đa 2 ca đêm/ tuần).' }) === true);
dat('Bảo vệ "trực cố định 22h-6h" → không phải xoay ca',
  F.laXoayCa_({ ten: 'Bảo vệ ca đêm', chiTiet: 'Trực cố định 22h-6h, nghỉ 4 ngày/tháng' }) === false);
{
  const nay = Math.round(Date.now() / 1000), ngay = 86400;
  const ds = [
    { ten: 'đăng 3 ngày', dangLuc: nay - 3 * ngay, lanDau: new Date(Date.now() - 5 * ngay * 1000) },
    { ten: 'đăng 21 ngày, cò mới thấy hôm nay', dangLuc: nay - 21 * ngay, lanDau: new Date() },   // ca user bắt được
    { ten: 'đăng hôm nay', dangLuc: nay - 3600, lanDau: new Date() },
    { ten: 'không rõ ngày đăng, cò thấy hôm nay', dangLuc: 0, lanDau: new Date() }
  ];
  F.xepThuTu_(ds, { telesale: 'bo' });
  const thuTu = ds.map((v) => v.ten);
  dat('Xếp theo NGÀY ĐĂNG mới nhất — tin 21 ngày không được lên đầu', thuTu[0] === 'đăng hôm nay' && thuTu[thuTu.length - 1] === 'đăng 21 ngày, cò mới thấy hôm nay',
    thuTu.join(' > '));
  dat('Tin không rõ ngày đăng xếp dưới tin đăng hôm nay, trên tin cũ', thuTu[1] === 'không rõ ngày đăng, cò thấy hôm nay' && thuTu[2] === 'đăng 3 ngày');
}

/* ---- 2g. Tìm theo TÊN công ty theo dõi ---- */
console.log('\n=== 2g. Công ty theo dõi: dựng địa chỉ tìm theo tên ===');
{
  /* bảng NGUỒN CÔNG TY: Tên | Trang tuyển dụng | Facebook page */
  const dong = [['Highlands Coffee', '', 'https://www.facebook.com/highlandscoffeevietnam'], ['GS25', '', ''], ['', '', ''], ['Phúc Long', 'https://x.vn/tuyen-dung', '']];
  const shGia = { getLastRow: () => dong.length + 1, getRange: () => ({ getValues: () => dong, setValues: () => ({ setBackground: () => ({ setFontColor: () => ({ setFontWeight: () => {} }) }) }), setValue: () => {} }), setColumnWidth: () => {} };
  const ssGia = { getSheetByName: () => shGia, insertSheet: () => shGia };
  const yc = F.yeuCauTheoTenCongTy_(ssGia, { congTyMoiLuot: 2 });
  dat('Mỗi tên ra 3 địa chỉ (vieclam24h, careerviet, hoteljob)', yc.length === 6, yc.length + ' địa chỉ cho ' + (yc.tenChon || []).join(', '));
  dat('Bỏ dòng trống', !(yc.tenChon || []).includes(''));
  dat('Tên có dấu thành đường dẫn careerviet đúng', yc.some((y) => y.url === 'https://careerviet.vn/viec-lam/highlands-coffee-k-vi.html'));
  dat('Có gắn tên công ty để dán nhãn', yc.every((y) => y.congTy));
  const yc2 = F.yeuCauTheoTenCongTy_(ssGia, { congTyMoiLuot: 2 });
  dat('Lượt sau xoay sang tên kế', (yc2.tenChon || [])[0] === 'Phúc Long', (yc2.tenChon || []).join(', '));
}

/* ---- 2h. Đa dạng (16/09/2026): Chợ Tốt · đọc kỹ tin mơ hồ · cột Loại việc ---- */
console.log('\n=== 2h. Chợ Tốt, tin mơ hồ, loại việc (user: "chưa đa dạng") ===');
{
  const ctTra = F.taiNhieu_([F.urlChotot_('ca đêm', 1)]);
  dat('Chợ Tốt trả HTTP 200', ctTra[0].ma === 200, ctTra[0].ma + ', ' + Math.round(ctTra[0].noiDung.length / 1024) + ' KB');
  const ct = F.phanTichChotot_(ctTra[0].noiDung);
  dat('Bóc được ≥ 30 tin/trang', ct.length >= 30, ct.length + ' tin · ví dụ: ' + ((ct[0] || {}).ten || ''));
  dat('Tin nào cũng có toạ độ (để đo đường)', ct.length > 0 && ct.every((v) => v.lat && v.lng));
  dat('Tin nào cũng có ngày đăng', ct.length > 0 && ct.every((v) => v.dangLuc > 0));
  dat('Link đúng khuôn vieclamtot.com/viec-lam-<quận>-tp-ho-chi-minh/<id>.htm',
    ct.every((v) => /^https:\/\/www\.vieclamtot\.com\/viec-lam-[a-z0-9-]+-tp-ho-chi-minh\/\d+\.htm$/.test(v.link) || /^https:\/\/www\.chotot\.com\/\d+\.htm$/.test(v.link)),
    (ct[0] || {}).link);
  dat('Có toàn văn ngay ở danh sách (không phải mở từng tin)', ct.filter((v) => (v.chiTiet || '').length > 40).length >= ct.length * 0.8);
  dat('Đọc ra giờ ca ở ≥ 60% tin', ct.filter((v) => v.gioLam && v.gioLam !== '—').length >= ct.length * 0.6,
    ct.filter((v) => v.gioLam && v.gioLam !== '—').length + '/' + ct.length);
  const ctGiu = F.locVaXep_(ct, { banKinh: 35, toiDa: 100, telesale: 'bo', tinTrongNgay: 45 }, goc0);
  dat('Qua bộ lọc ca đêm + bán kính còn ≥ 20 tin', ctGiu.length >= 20, ctGiu.length + '/' + ct.length + ' · bỏ ' + (ctGiu.boTelesale || 0) + ' telesale');
  const nhom = {}; ctGiu.forEach((v) => { const l = F.loaiViec_(v); nhom[l] = (nhom[l] || 0) + 1; });
  dat('Riêng Chợ Tốt đã ra ≥ 4 nhóm nghề', Object.keys(nhom).length >= 4, Object.keys(nhom).map((k) => k + ' ' + nhom[k]).join(' · '));
  dat('Lương đọc từ chữ sẵn của trang ("Đến 8 triệu/tháng" / "Thoả thuận")',
    ct.every((v) => /triệu|đ\/|Thoả thuận|\d/.test(v.luong || '')), (ct[0] || {}).luong);

  /* "Yêu cầu:" nằm cùng dòng không được mất */
  const yc = F.tachYeuCau_('Mô tả: phục vụ quán\nYêu cầu: có kinh nghiệm, nhanh nhẹn\nQuyền lợi: bao ăn');
  dat('Cắt đúng đoạn Yêu cầu trong tin viết một mạch', /có kinh nghiệm/.test(yc) && !/bao ăn/.test(yc), JSON.stringify(yc));

  /* Loại việc — so trọn từ, đúng thứ tự ưu tiên */
  [['Nhân viên bảo vệ ca đêm', 'Bảo vệ · giữ xe'], ['Có sức khoẻ tốt, nhanh nhẹn', 'Khác'], ['Nhân viên kho', 'Kho · giao nhận'],
   ['Nhân Viên Kỹ Thuật - Ca Đêm -Tại Siêu Thị', 'Kỹ thuật · bảo trì'], ['Nhân viên Chia hàng Ca Đêm Bách Hóa Xanh', 'Kho · giao nhận'],
   ['Tuyển nam lấy rác ca đêm', 'Vệ sinh · tạp vụ'], ['Giáo Viên Tiếng Anh Ca Tối', 'Giáo dục'], ['HRIS Specialist - Night Shift', 'Văn phòng · CSKH'],
   ['Nhân Viên Phục Vụ Quán Bar - Nữ', 'Nhà hàng · quán · bar'], ['Nhân Viên QC (Đi Ca)', 'Sản xuất · công nhân'],
   ['[Silverland Yen ] - Bellman Night Shift', 'Khách sạn · lễ tân'], ['Quản lý vận hành ca đêm kho Củ Chi', 'Kho · giao nhận'],
   ['Night Duty Manager', 'Khách sạn · lễ tân'], ['Chuyên viên kế hoạch', 'Văn phòng · CSKH']]
    .forEach(([t, mong]) => { const ra = F.loaiViec_({ ten: t }); dat('Loại việc "' + t.slice(0, 38) + '" → ' + mong, ra === mong, ra); });
  dat('Tiêu đề không nói gì thì xét mô tả', F.loaiViec_({ ten: 'Tuyển nhân viên làm ca đêm', chiTiet: '• Pha lóc, đóng gói thực phẩm' }) === 'Sản xuất · công nhân');
  dat('hoteljob không rõ thì mặc định Khách sạn', F.loaiViec_({ ten: 'Nhân viên thời vụ', nguon: 'hoteljob.vn' }) === 'Khách sạn · lễ tân');

  /* Tin mơ hồ: chọn đúng loại, xếp mới trước */
  const nay = Math.round(Date.now() / 1000);
  const mh = F.chonTinMoHo_([
    { id: 'a', nguon: 'vieclam24h.vn', ten: 'Nhân viên bảo vệ', diaChi: 'Quận 12, Hồ Chí Minh', link: 'https://x', dangLuc: nay - 3600 },
    { id: 'b', nguon: 'vieclam24h.vn', ten: 'Lễ tân ca đêm', diaChi: 'Quận 12, Hồ Chí Minh', link: 'https://x', dangLuc: nay },
    { id: 'c', nguon: 'vieclam24h.vn', ten: 'Nhân viên kho', diaChi: 'Hà Nội', link: 'https://x', dangLuc: nay },
    { id: 'd', nguon: 'careerviet.vn', ten: 'Telesale', diaChi: 'Hồ Chí Minh', link: 'https://x', dangLuc: nay },
    { id: 'e', nguon: 'careerviet.vn', ten: 'Phục vụ', diaChi: 'Hồ Chí Minh', link: 'https://x', dangLuc: nay - 60 * 86400 },
    { id: 'f', nguon: 'careerviet.vn', ten: 'Phục vụ', diaChi: 'Hồ Chí Minh', link: 'https://x', dangLuc: nay - 7200, daChiTiet: true },
    { id: 'g', nguon: 'careerviet.vn', ten: 'Phụ bếp', diaChi: 'Hồ Chí Minh', link: 'https://x', dangLuc: nay - 600 },
    { id: 'h', nguon: 'facebook', ten: 'Cần người', diaChi: 'Hồ Chí Minh', link: 'https://x', dangLuc: nay }
  ], { banKinh: 35, tinTrongNgay: 45 }, goc0).map((v) => v.id).join(',');
  dat('Tin mơ hồ: bỏ tiêu đề có "đêm", bỏ xa, bỏ telesale, bỏ quá cũ, bỏ đã có chi tiết, bỏ Facebook; mới trước', mh === 'g,a', mh);
  {
    /* Bộ đo 16/09 bắt được: xếp theo ngày chung thì jobsgo (mốc "vừa đăng", toàn việc ngày) nuốt hết 60 suất. */
    const ds2 = [];
    for (let i = 0; i < 5; i++) ds2.push({ id: 'j' + i, nguon: 'jobsgo.vn', ten: 'Kiến trúc sư ' + i, diaChi: 'Hồ Chí Minh', link: 'https://x', dangLuc: nay - i });
    for (let i = 0; i < 5; i++) ds2.push({ id: 'v' + i, nguon: 'vieclam24h.vn', ten: 'Công nhân ' + i, diaChi: 'Hồ Chí Minh', link: 'https://x', dangLuc: nay - 3600 - i });
    const xen = F.chonTinMoHo_(ds2, { banKinh: 35, tinTrongNgay: 45 }, goc0).slice(0, 6).map((v) => v.id).join(',');
    dat('Suất đọc kỹ chia đều theo nguồn (xen kẽ), không để một nguồn nuốt hết', xen === 'j0,v0,j1,v1,j2,v2', xen);
    dat('Bỏ ký tự CR (\\r) của jobsgo khi gạch đầu dòng', F.gachDauDong_('\r\n- Theo dõi\r\n- Quản lý') === '• Theo dõi\n• Quản lý', JSON.stringify(F.gachDauDong_('\r\n- Theo dõi\r\n- Quản lý')));
  }

  /* Cột bảng: số cột khớp, hằng số trỏ đúng tên cột */
  dat('Số cột tiêu đề = số bề rộng', F.TIEU_DE.length === F.RONG_COT.length, F.TIEU_DE.length + ' cột');
  dat('Có cột "Loại việc" ngay sau Nguồn', F.TIEU_DE[1] === 'Loại việc');
  dat('COT_LINK trỏ đúng cột Link', F.TIEU_DE[F.COT_LINK - 1] === 'Link');
  dat('COT_NGAYDANG / COT_CACHDAY trỏ đúng', F.TIEU_DE[F.COT_NGAYDANG - 1] === 'Ngày đăng' && F.TIEU_DE[F.COT_CACHDAY - 1] === 'Đăng cách đây');
  dat('COT_GIO / COT_LUONG / COT_KM trỏ đúng', F.TIEU_DE[F.COT_GIO - 1] === 'Thời gian làm việc' && F.TIEU_DE[F.COT_LUONG - 1] === 'Mức lương' && F.TIEU_DE[F.COT_KM - 1] === 'Khoảng cách ô tô');
  dat('Tóm tắt đa dạng có số nhóm + theo nguồn', /^\d+ nhóm nghề: .+ \| theo nguồn: /.test(F.tomTatDaDang_(ctGiu.slice(0, 5))), F.tomTatDaDang_(ctGiu.slice(0, 5)).slice(0, 90));
}

/* ---- 3. Lọc + telesale ---- */
console.log('\n=== 3. Lọc ca đêm, bán kính, telesale ===');
const goc = goc0;
const cfg = { banKinh: 35, toiDa: 40, telesale: 'bo' };
const giu = F.locVaXep_([...vl, ...hj, ...cv, ...tc], cfg, goc);
dat('Có việc qua lọc', giu.length > 0, giu.length + '/' + (vl.length + hj.length + cv.length + tc.length) + ' tin');
dat('Không lọt tin ngoài bán kính', giu.every((v) => v.kmChim == null || v.kmChim <= cfg.banKinh));
dat('Đã loại sạch việc telesale', giu.filter((v) => v.telesale).length === 0,
  'bỏ ' + (giu.boTelesale || 0) + ' việc telesale');
F.xepThuTu_(giu, cfg);
{
  /* chỉ so các tin CÓ ngày đăng; tin không rõ ngày được chèn theo lần cò thấy nên bỏ qua */
  const coNgay = giu.filter((v) => v.dangLuc > 0);
  dat('Tin có ngày đăng xếp mới → cũ', coNgay.every((v, i) => i === 0 || coNgay[i - 1].dangLuc >= v.dangLuc),
    'trên cùng: ' + (coNgay[0] ? new Date(coNgay[0].dangLuc * 1000).toLocaleString('vi') : '—') + ' · ' + coNgay.length + '/' + giu.length + ' tin có ngày');
}
dat('Không tin nào có ngày đăng ở tương lai', giu.every((v) => (v.dangLuc || 0) <= Math.round(Date.now() / 1000) + 1));

console.log('\n=== 3b. Nhận diện telesale ===');
const laTele = (ten, ntd, ct, nguon) => F.laTelesale_({ ten, ntd: ntd || '', chiTiet: ct || '', nguon: nguon || 'vieclam24h.vn' });
dat('Khách sạn (hoteljob) "Chăm sóc Khách hàng — Ca đêm" KHÔNG phải telesale',
  laTele('Nhân viên Chăm sóc Khách hàng — Ca đêm', 'CIRCADIAN', 'Đón khách quốc tế ban đêm', 'hoteljob.vn') === false);
dat('Cùng tên đó trên vieclam24h thì vẫn là telesale',
  laTele('Nhân viên Chăm sóc Khách hàng — Ca đêm', 'Công ty X', 'Gọi điện tư vấn') === true);
dat('Hoteljob vẫn bắt bậc chắc: "Telesale ca đêm"', laTele('Nhân viên Telesale ca đêm', 'Hotel Y', '', 'hoteljob.vn') === true);
[['Nhân Viên Telesale Ca Đêm'], ['Tổng đài viên CSKH ca đêm'], ['Nhân viên chăm sóc khách hàng ban đêm'],
 ['Nhân viên tư vấn bảo hiểm qua điện thoại'], ['Nhân viên trực đêm', '', 'Công việc chính là gọi điện thoại chốt đơn cho khách']]
  .forEach(([a, b, c]) => dat('Nhận ra telesale: ' + a, laTele(a, b, c) === true));
[['Bảo vệ ca đêm'], ['Nhân viên buồng phòng khách sạn'], ['Lễ tân ca đêm'], ['Phụ bếp ca tối'],
 ['Nhân viên kho ca đêm', '', 'Nhận hàng, kiểm đếm, sắp xếp kho ban đêm']]
  .forEach(([a, b, c]) => dat('Không bắt nhầm: ' + a, laTele(a, b, c) === false));
dat('Đọc đúng lựa chọn trong CẤU HÌNH',
  F.kieuTelesale_('Loại bỏ') === 'bo' && F.kieuTelesale_('Xuống cuối') === 'cuoi' && F.kieuTelesale_('Giữ') === 'giu');

/* ---- 4. Lấy chi tiết song song, mỗi nguồn 1 tin ---- */
console.log('\n=== 4. Lấy chi tiết (mỗi nguồn 1 tin) ===');
const mau = [];
['vieclam24h.vn', 'hoteljob.vn', 'careerviet.vn', 'jobsgo.vn'].forEach((ng) => {
  const v = giu.find((x) => x.nguon === ng);
  if (v) mau.push(v);
});
const tCt = Date.now();
F.layChiTietHangLoat_(mau, Date.now());
mau.forEach((v) => dat(v.nguon + ' · ' + v.ten.slice(0, 40), (v.chiTiet || '').length > 40,
  'mô tả ' + (v.chiTiet || '').length + ' ký tự, yêu cầu ' + (v.yeuCau || '').length + ', giờ làm ' + v.gioLam));
console.log('   (lấy ' + mau.length + ' trang chi tiết mất ' + Math.round((Date.now() - tCt) / 1000) + 's)');
if (mau[0]) console.log('   trích: ' + (mau[0].chiTiet || '').slice(0, 120) + '…');
dat('Mô tả không dính CSS/JS', mau.every((v) => !/text-decoration|function\s*\(|\{\s*color/.test(v.chiTiet || '')));

/* ---- 4b. Xuống dòng, gạch đầu dòng, dịch, mốc thời gian ---- */
console.log('\n=== 4b. Trình bày nội dung ===');
const coDong = mau.filter((v) => (v.chiTiet || '').indexOf('\n') >= 0).length;
dat('Chi tiết xuống dòng theo gạch đầu dòng', coDong >= Math.ceil(mau.length / 2),
  coDong + '/' + mau.length + ' tin có nhiều dòng');
const mauDong = ((mau.find((v) => (v.chiTiet || '').indexOf('\n') >= 0) || {}).chiTiet || '').split('\n').slice(0, 3);
mauDong.forEach((d) => console.log('     ' + d.slice(0, 90)));
dat('Dòng nào cũng mở đầu bằng gạch đầu dòng', mauDong.every((d) => d.indexOf('• ') === 0));
{
  /* ca user bắt 15/09 tối: dấu • chèn giữa một câu dài phải được cắt thành từng dòng */
  const lien = F.gachDauDong_('• Nam, Có sức khỏe tốt, sẵn sàng di chuyển, làm ca đêm • Có xe gắn máy, bằng lái xe còn hiệu lực ✔ Bao ăn ca');
  const dong = lien.split('\n');
  dat('Dấu • chèn giữa câu được cắt thành từng dòng', dong.length === 3, dong.length + ' dòng: ' + dong.map((x) => x.slice(0, 22)).join(' | '));
  dat('Chạy lặp không đổi kết quả (an toàn khi áp lên tin cũ trong bộ nhớ)', F.gachDauDong_(lien) === lien);
  dat('Khoảng giờ "22h - 6h" không bị cắt nhầm', F.gachDauDong_('Ca làm 22h - 6h sáng, lương 8tr').split('\n').length === 1);
}
dat('Nhận ra tiếng Anh', F.laTiengAnh_('Supervise and coordinate all night shift operations of the hotel') === true);
dat('Không nhầm tiếng Việt là tiếng Anh', F.laTiengAnh_('Trực đêm, chào đón khách, làm thủ tục check-in') === false);
dat('Không nhầm tiếng Việt không dấu', F.laTiengAnh_('Truc dem tai kho, kiem hang va ghi so luong') === false);
dat('Mốc thời gian tương lai bị kéo về hiện tại',
  F.kepMoc_(Math.round(Date.now() / 1000) + 40000) <= Math.round(Date.now() / 1000) + 1);

/* ---- 5. Hàm phụ ---- */
console.log('\n=== 5. Hàm phụ ===');
dat('Giờ "22:00 - 06:30"', F.timGioLam_('ca đêm 22:00 - 06:30 hôm sau').startsWith('22:00 - 06:30'));
dat('Giờ "20h đến 5h"', F.timGioLam_('trực 20h đến 5h sáng').startsWith('20:00 - 05:00'));
dat('Không có giờ thì "—"', F.timGioLam_('không nói giờ') === '—');
const g2 = F.chuTruocSangGiay_('2 tuần trước');
dat('Đổi "2 tuần trước" ra ngày', Math.abs((Date.now() / 1000 - g2) / 86400 - 14) < 0.1,
  new Date(g2 * 1000).toLocaleDateString('vi'));
const g3 = F.ngayVnSangGiay_(['09', '09', '2026']);
dat('Đổi "09-09-2026" ra ngày', new Date(g3 * 1000).getMonth() === 8 && new Date(g3 * 1000).getDate() === 9);
dat('Lương', F.dinhDangLuong_(7000000, 10000000) === '7.000.000 - 10.000.000 đ/tháng');
dat('Từ khoá thành đường dẫn', F.khongDauGach_('ca đêm') === 'ca-dem', F.khongDauGach_('ca đêm'));

/* ---- 6. Luật bán kính 20 km nới ±5 (chốt 18/09/2026) ---- */
console.log('\n=== 6. Luat ban kinh ===');
{
  const cfgBK = { banKinh: 20, noiThem: 5 };
  const ds = [{ id: 'gan', kmOto: 9.3 }, { id: 'ria', kmOto: 22.6 }, { id: 'xa', kmOto: 28 },
    { id: 'fb', kmOto: null, kmChim: null }, { id: 'chim', kmChim: 24.9 }];
  const demBK = {};
  const giuBK = F.apBanKinh_(ds, cfgBK, demBK).map((v) => v.id).join(',');
  dat('Giữ gần + rìa + chưa đo, bỏ tin quá 25 km', giuBK === 'gan,ria,fb,chim', giuBK + ' · bỏ ' + demBK.bo);
  dat('Tin ở rìa gắn nhãn "Hơi xa"', ds[1].hoiXa === true && ds[4].hoiXa === true && demBK.ria === 2,
    'rìa ' + demBK.ria + ' (22,6 km ô tô + 24,9 km chim bay)');
  dat('Tin không đo được KHÔNG bị xoá', ds[3].chuaRoKm === true && demBK.chuaRo === 1);
  dat('Nhãn hiện đúng chữ', F.nhan_({ chuaRoKm: true }, new Date()).indexOf('Chưa đo được') >= 0 &&
    F.nhan_({ hoiXa: true }, new Date()).indexOf('Hơi xa') >= 0);
  dat('Bán kính 0 nới 0 thì vẫn giữ tin chưa đo', F.apBanKinh_([{ id: 'x' }], { banKinh: 0 }, {}).length === 1);
  dat('Địa chỉ chỉ có tên tỉnh/thành = mơ hồ',
    F.diaChiMoHo_('Hồ Chí Minh') && F.diaChiMoHo_('TP.HCM') && F.diaChiMoHo_('HCMC') && F.diaChiMoHo_(''));
  dat('Địa chỉ có phường/quận/số nhà thì đo được',
    !F.diaChiMoHo_('Phường Thạnh Xuân, Quận 12, TP.HCM') &&
    !F.diaChiMoHo_('232 Đường TX52, Thạnh Xuân, Quận 12, HCM') &&
    !F.diaChiMoHo_('Xã Đức Hòa Đông, Huyện Đức Hòa, Long An'));
  const uHCM = F.urlChotot_('ca đêm', 1), uLA = F.urlChotot_('ca đêm', 1, F.CHOTOT_LONG_AN);
  dat('Chợ Tốt hỏi theo vùng, không hỏi cả nước',
    uHCM.indexOf('region_v2=13000') > 0 && uLA.indexOf('region_v2=5032') > 0);
}

console.log('\nTổng thời gian QC: ' + Math.round((Date.now() - t0) / 1000) + 's (trên máy gọi lần lượt; Apps Script gọi song song nên nhanh hơn nhiều)');
console.log(hong ? 'KET QUA: HONG ' + hong + ' muc' : 'KET QUA: TAT CA DAT');
process.exit(hong ? 1 : 0);
