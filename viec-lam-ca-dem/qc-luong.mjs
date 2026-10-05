/**
 * QC TOÀN LUỒNG — chạy đúng trình tự của Apps Script ngay trên máy, bấm giờ từng chặng và
 * chấm điểm chất lượng từng cột. Dùng để so trước/sau mỗi lần sửa, không nói cảm tính.
 *
 * Chạy:  node qc-luong.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const nguon = fs.readFileSync(path.join(DIR, 'Code.js'), 'utf8');

const keo = (url) => {
  try {
    return execFileSync('curl', ['-sL', '--max-time', '40', '-A',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', url],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch { return ''; }
};
const traLoi = (body) => ({ getResponseCode: () => (body ? 200 : 599), getContentText: () => body });
globalThis.UrlFetchApp = { fetch: (u) => traLoi(keo(u)), fetchAll: (ycs) => ycs.map((y) => traLoi(keo(y.url))) };
const kho = {};
globalThis.PropertiesService = {
  getScriptProperties: () => ({
    getProperty: (k) => (k in kho ? kho[k] : null),
    setProperty: (k, v) => { kho[k] = v; },
    deleteProperty: (k) => { delete kho[k]; },
    getKeys: () => Object.keys(kho)
  })
};
globalThis.Utilities = { formatDate: (d) => d.toISOString(), sleep: () => {}, getUuid: () => 'uuid' };
globalThis.LanguageApp = { translate: (t) => t };
globalThis.Maps = null;

(0, eval)(nguon + `
;globalThis.__nap = { taiNhieu_, phanTichVl24hDanhSach_, chuanHoaVl24h_, phanTichHoteljob_,
  phanTichCareerviet_, phanTichJobsgo_, phanTichTgdd_, layChiTietHangLoat_, locVaXep_, xepThuTu_, apBanKinh_,
  khongDauGach_, laTelesale_, xenKeTenMien_, phanTichChotot_, urlChotot_, chonTinMoHo_, tomTatDaDang_, loaiViec_, laCaDem_,
  viTriMwgHangLoat_, URL_MWG };`);
const F = globalThis.__nap;

const cfg = {
  tuKhoa: ['ca đêm', 'làm đêm', 'trực đêm', 'ca tối'],
  soTrang: 2, toiDa: 40, banKinh: 20, noiThem: 5, telesale: 'bo', tinTrongNgay: 45, soTrangTgdd: 8, soTrangChotot: 9, trangChototLongAn: 2,
  tuKhoaNghe: ['bảo vệ', 'an ninh', 'giám sát', 'kho', 'phân loại hàng', 'lễ tân', 'tạp vụ', 'tài xế']
};
const goc = { ten: 'Hóc Môn', lat: 10.8860463, lng: 106.5927134 };
const giay = (t) => ((Date.now() - t) / 1000).toFixed(1) + 's';

/* ---- 1. Tải danh sách ---- */
const t0 = Date.now();
const yeuCau = [];
cfg.tuKhoa.forEach((kw) => {
  for (let p = 1; p <= cfg.soTrang; p++) {
    yeuCau.push({ ng: 'vl24h', url: 'https://vieclam24h.vn/tim-kiem-viec-lam-nhanh?q=' + encodeURIComponent(kw) + (p > 1 ? '&page=' + p : '') });
  }
  yeuCau.push({ ng: 'hoteljob', url: 'https://www.hoteljob.vn/tim-viec?keyword=' + encodeURIComponent(kw) });
  yeuCau.push({ ng: 'careerviet', url: 'https://careerviet.vn/viec-lam/' + F.khongDauGach_(kw) + '-k-vi.html' });
  yeuCau.push({ ng: 'jobsgo', url: 'https://jobsgo.vn/viec-lam-' + F.khongDauGach_(kw) + '.html' });
});
cfg.tuKhoaNghe.forEach((kw) => {
  yeuCau.push({ ng: 'vl24h', url: 'https://vieclam24h.vn/tim-kiem-viec-lam-nhanh?q=' + encodeURIComponent(kw) });
  yeuCau.push({ ng: 'careerviet', url: 'https://careerviet.vn/viec-lam/' + F.khongDauGach_(kw) + '-k-vi.html' });
});
for (let p = 1; p <= cfg.soTrangTgdd; p++) {
  yeuCau.push({ ng: 'tgdd', url: F.URL_MWG + (p > 1 ? '?page=' + p : '') });
}
for (let p = 1; p <= cfg.soTrangChotot - cfg.trangChototLongAn; p++) yeuCau.push({ ng: 'chotot', url: F.urlChotot_('ca đêm', p, 13000) });
for (let p = 1; p <= cfg.trangChototLongAn; p++) yeuCau.push({ ng: 'chotot', url: F.urlChotot_('ca đêm', p, 5032) });

const tTai = Date.now();
const tra = F.taiNhieu_(yeuCau.map((y) => y.url));
const giayTai = giay(tTai);

const boc = { vl24h: F.phanTichVl24hDanhSach_, hoteljob: F.phanTichHoteljob_, careerviet: F.phanTichCareerviet_, jobsgo: F.phanTichJobsgo_, tgdd: F.phanTichTgdd_, chotot: F.phanTichChotot_ };
const dem = {};
let viec = [];
tra.forEach((r, i) => {
  const ng = yeuCau[i].ng;
  dem[ng] = dem[ng] || { goi: 0, ok: 0, tin: 0, ma: {} };
  dem[ng].goi++;
  dem[ng].ma[r.ma] = (dem[ng].ma[r.ma] || 0) + 1;
  if (r.ma !== 200) return;
  dem[ng].ok++;
  let ds = boc[ng](r.noiDung);
  if (ng === 'vl24h') ds = ds.map(F.chuanHoaVl24h_);
  dem[ng].tin += ds.length;
  viec = viec.concat(ds);
});

console.log('=== 1. Tải danh sách (' + yeuCau.length + ' trang, ' + giayTai + ') ===');
Object.keys(dem).forEach((k) => {
  const ma = Object.keys(dem[k].ma).map((m) => m + '×' + dem[k].ma[m]).join(' ');
  console.log(`  ${k.padEnd(11)} ${String(dem[k].ok + '/' + dem[k].goi).padEnd(6)} [${ma}]  ${dem[k].tin} tin`);
});

/* ---- 2. Chi tiết cho nguồn cần đọc trước khi lọc ---- */
const tCt1 = Date.now();
F.layChiTietHangLoat_(viec.filter((v) => v.nguon === 'hoteljob.vn' || v.nguon === 'thegioididong.com'), Date.now());
const giayCt1 = giay(tCt1);

/* ---- 2a2. Hỏi nơi làm thật của việc MWG ca đêm (18/09/2026) ---- */
const canViTri = viec.filter((v) => v.nguon === 'thegioididong.com' && !v.lat && F.laCaDem_(v));
const coViTri = F.viTriMwgHangLoat_(canViTri, goc, Date.now());

/* ---- 2b. Đọc kỹ tin mơ hồ (16/09/2026) — tiêu đề không có chữ đêm nhưng ở gần, không telesale ---- */
const tMoHo = Date.now();
const moHo = F.chonTinMoHo_(viec, cfg, goc).slice(0, 60);
F.layChiTietHangLoat_(moHo, Date.now());
const moHoDem = moHo.filter((v) => v.daChiTiet && F.laCaDem_(v));
const giayMoHo = giay(tMoHo);

/* ---- 3. Lọc ---- */
const tho = viec.length;
let giu = F.locVaXep_(viec, cfg, goc);
const boTele = giu.boTelesale || 0;
const sauLoc = giu.length;
giu = giu.slice(0, cfg.toiDa);

const tCt2 = Date.now();
F.layChiTietHangLoat_(giu.filter((v) => !v.daChiTiet), Date.now());
const giayCt2 = giay(tCt2);
giu.forEach((v) => { if (!v.gioLam) v.gioLam = ''; });
F.xepThuTu_(giu, cfg);

console.log('\n=== 2. Phễu lọc ===');
console.log(`  thô ${tho} tin → bỏ ${boTele} telesale → qua lọc ${sauLoc} → ghi ${giu.length}`);
{
  const demBK = {};
  const sauBK = F.apBanKinh_(giu.slice(), cfg, demBK);
  console.log(`  bán kính ${cfg.banKinh} km (nới ${cfg.noiThem}): giữ ${sauBK.length} · bỏ ${demBK.bo} tin quá ${cfg.banKinh + cfg.noiThem} km · ${demBK.ria} ở rìa · ${demBK.chuaRo} chưa đo được (trên máy không gọi được Maps nên phần lớn rơi vào nhóm này)`);
}
console.log(`  đọc kỹ ${moHo.filter((v) => v.daChiTiet).length}/${moHo.length} tin mơ hồ trong ${giayMoHo} → thêm ${moHoDem.length} việc ca đêm`);
console.log(`  MWG ${cfg.soTrangTgdd} trang: ${viec.filter((v) => v.nguon === 'thegioididong.com').length} tin · ca đêm ${canViTri.length} · hỏi được nơi làm thật ${coViTri}`);
console.log('  ' + F.tomTatDaDang_(giu));
console.log(`  thời gian: tải ${giayTai} · chi tiết đợt 1 ${giayCt1} · chi tiết đợt 2 ${giayCt2} · TỔNG ${giay(t0)}`);

/* ---- 4. Chấm điểm từng cột ---- */
const co = (f) => giu.filter(f).length;
const pc = (n) => Math.round(100 * n / Math.max(1, giu.length)) + '%';
console.log('\n=== 3. Cột nào đủ thông tin ===');
const bang = [
  ['Giờ làm việc', co((v) => v.gioLam && v.gioLam !== '—')],
  ['Mức lương (có số)', co((v) => v.luong && !/thoả thuận|thỏa thuận|cạnh tranh/i.test(v.luong))],
  ['Địa chỉ', co((v) => (v.diaChi || '').length > 5)],
  ['Ngày đăng', co((v) => v.dangLuc > 0)],
  ['Chi tiết công việc', co((v) => (v.chiTiet || '').length > 60)],
  ['Yêu cầu công việc', co((v) => (v.yeuCau || '').length > 20)],
  ['Toạ độ để đo đường', co((v) => v.lat && v.lng)]
];
bang.forEach(([ten, n]) => console.log(`  ${ten.padEnd(22)} ${String(n).padStart(3)}/${giu.length}  ${pc(n).padStart(4)}`));

console.log('\n=== 4. Còn sót telesale không ===');
const sot = giu.filter(F.laTelesale_);
console.log('  ' + (sot.length ? 'CÒN ' + sot.length + ': ' + sot.slice(0, 3).map((v) => v.ten.slice(0, 40)).join(' | ') : 'sạch'));

console.log('\n=== 5. Năm việc đầu bảng ===');
giu.slice(0, 5).forEach((v, i) => {
  console.log(`  ${i + 1}. [${v.nguon}] ${v.ten.slice(0, 52)}`);
  console.log(`     giờ: ${v.gioLam || '—'} · lương: ${(v.luong || '').slice(0, 28)} · đăng: ${v.dangLuc ? new Date(v.dangLuc * 1000).toLocaleString('vi') : '—'}`);
});
