const O = ['bat', 'ngheLenh', 'moXemThem', 'diaChiGas', 'khoa', 'nhom', 'phutMoiLuot', 'soLanCuon', 'toiDaMoiNhom', 'nhomMoiLuot', 'songSong', 'giayGiuaNhom', 'cheDoCuaSo', 'tuKhoaTim'];
const MAC_DINH = {
  bat: false, ngheLenh: true, moXemThem: true, diaChiGas: 'https://script.google.com/macros/s/AKfycbyJMoDETaBKrmEk75jr20R8GomOUXkyVNdd0ia-qc9Sy9JC_BfrTPLPHCpyi8TgcqvF/exec', khoa: '', nhom: '',
  phutMoiLuot: 180, soLanCuon: 3, toiDaMoiNhom: 25, nhomMoiLuot: 10, songSong: 2, giayGiuaNhom: 8, cheDoCuaSo: 'goc',
  tuKhoaTim: [
    'việc làm buồng phòng', 'housekeeping khách sạn', 'tuyển buồng phòng',
    'việc làm nhà hàng khách sạn', 'tuyển nhân viên nhà hàng', 'việc làm khách sạn tphcm',
    'việc làm ca đêm tphcm', 'tuyển bảo vệ ca đêm'
  ].join('\n')
};

/* Nhóm user muốn ưu tiên (chốt 15/09/2026): buồng phòng, nhà hàng, khách sạn. */
const CHU_UU_TIEN = ['buong phong', 'housekeeping', 'room attendant', 'nha hang', 'khach san',
  'hotel', 'restaurant', 'resort', 'phuc vu', 'bep', 'f&b', 'le tan', 'tap vu'];
/* Nhóm việc làm nói chung. */
const CHU_VIEC = ['viec lam', 'viec', 'tuyen dung', 'tuyen', 'tim viec', 'lao dong', 'nhan su',
  'part time', 'parttime', 'ca dem', 'lam them', 'job', 'recruit', 'thoi vu', 'bao ve'];

const el = (id) => document.getElementById(id);
const khongDau = (s) => String(s || '').toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
const laUuTien = (ten) => CHU_UU_TIEN.some((k) => khongDau(ten).includes(k));
const laViec = (ten) => CHU_VIEC.some((k) => khongDau(ten).includes(k));

let dsNhom = [];
let daChon = new Set();
let hongLienTiep = {};

async function nap() {
  const o = Object.assign({}, MAC_DINH, await chrome.storage.local.get(O));
  if (!o.diaChiGas) o.diaChiGas = MAC_DINH.diaChiGas;
  if (!o.tuKhoaTim) o.tuKhoaTim = MAC_DINH.tuKhoaTim;
  O.forEach((k) => {
    const n = el(k);
    if (!n) return;
    if (n.type === 'checkbox') n.checked = !!o[k];
    else n.value = o[k];
  });
  const kho = await chrome.storage.local.get(['dsNhomCuaToi', 'nhomChon', 'hongLienTiep']);
  dsNhom = kho.dsNhomCuaToi || [];
  daChon = new Set(kho.nhomChon || []);
  hongLienTiep = kho.hongLienTiep || {};
  veDanhSach();
  napNhatKy();
}

/** Nhóm ưu tiên lên đầu, rồi tới nhóm việc làm, rồi còn lại — trong mỗi bậc xếp theo tên. */
function xepDanhSach(ds) {
  const bac = (n) => (laUuTien(n.ten) ? 0 : (laViec(n.ten) ? 1 : 2));
  return ds.slice().sort((a, b) => (bac(a) - bac(b)) || a.ten.localeCompare(b.ten, 'vi'));
}

function veDanhSach() {
  const tim = khongDau(el('loc').value.trim());
  const hop = xepDanhSach(dsNhom).filter((n) => !tim || khongDau(n.ten + ' ' + n.link).includes(tim));
  const khung = el('dsNhom');
  khung.textContent = '';

  if (!dsNhom.length) {
    const p = document.createElement('div');
    p.className = 'mot';
    p.textContent = 'Chưa có danh sách. Bấm "Lấy danh sách nhóm của tôi" hoặc "Tìm nhóm công khai theo từ khoá".';
    khung.appendChild(p);
  }

  hop.forEach((n) => {
    const d = document.createElement('div');
    d.className = 'mot';

    const o = document.createElement('input');
    o.type = 'checkbox';
    o.checked = daChon.has(n.link);
    o.onchange = () => { o.checked ? daChon.add(n.link) : daChon.delete(n.link); capNhatDem(); };

    const t = document.createElement('div');
    t.className = 'ten';
    t.textContent = n.ten;

    const the = (chu, lop) => {
      const s = document.createElement('span');
      s.className = 'the ' + lop;
      s.textContent = chu;
      t.appendChild(s);
    };
    if (laUuTien(n.ten)) the('ưu tiên', 'uu');
    the(n.nguon === 'đã tham gia' ? 'đã tham gia' : 'tìm thấy', n.nguon === 'đã tham gia' ? 'tg' : 'tim');
    if ((hongLienTiep[n.link] || 0) >= 3) the('đang bỏ qua', 'bo');

    const a = document.createElement('span');
    a.className = 'link';
    a.textContent = n.link + (n.tuKhoa ? '  ·  tìm bằng: ' + n.tuKhoa : '');
    t.appendChild(a);

    d.appendChild(o);
    d.appendChild(t);
    khung.appendChild(d);
  });
  capNhatDem();
}

function capNhatDem() {
  const uuTien = dsNhom.filter((n) => laUuTien(n.ten)).length;
  el('dem').textContent = dsNhom.length
    ? 'đã chọn ' + daChon.size + '/' + dsNhom.length + ' nhóm · ' + uuTien + ' nhóm ưu tiên'
    : '';
  const moiLuot = Number(el('nhomMoiLuot').value) || 10;
  const goTay = String(el('nhom').value || '').split('\n').filter((s) => s.trim().startsWith('http')).length;
  const tong = daChon.size + goTay;
  const ss = Math.min(20, Math.max(1, Number(el('songSong').value) || 2));
  const gg = Math.max(2, Number(el('giayGiuaNhom').value) || 8);
  /* Mỗi tab tốn ~12 giây, nhưng mở cùng lúc nhiều thì mỗi tab chậm thêm chút vì tranh máy
     và tranh mạng; cộng cả nhịp mở lệch 0,6 giây mỗi tab. */
  const moiDot = 12 + ss * 1.4 + ss * 0.6 + gg;
  const uocGiay = Math.ceil(Math.min(moiLuot, tong) / ss) * moiDot;
  el('giaiThichXoay').textContent = tong
    ? 'Mỗi lượt đọc ' + Math.min(moiLuot, tong) + ' nhóm (mở ' + ss + ' nhóm cùng lúc) — ước chừng ' +
      Math.ceil(uocGiay / 60) + ' phút mỗi lượt; ' + tong + ' nhóm cần khoảng ' +
      Math.ceil(tong / moiLuot) + ' lượt để đi hết một vòng.'
    : '';

  const cb = el('canhBaoTab');
  if (ss >= 12) {
    cb.textContent = 'Mở ' + ss + ' nhóm cùng lúc: ăn khoảng ' + (ss * 0.3).toFixed(1) +
      ' GB RAM và bật một loạt lượt tải trong vài giây — nhanh nhất, nhưng dễ bị Facebook hỏi lại mật khẩu nhất. Nên để dành cho lúc bạn ngồi trước máy.';
  } else if (ss >= 6) {
    cb.textContent = 'Mở ' + ss + ' nhóm cùng lúc: nhanh gấp ' + Math.round(ss / 2) +
      ' lần mức mặc định, máy vẫn chịu được; đây là mức cân bằng.';
  } else {
    cb.textContent = '';
  }
}

el('loc').oninput = veDanhSach;
el('nhomMoiLuot').oninput = capNhatDem;
el('songSong').oninput = capNhatDem;
el('giayGiuaNhom').oninput = capNhatDem;
el('nhom').oninput = capNhatDem;

async function napLaiDanhSach() {
  const kho = await chrome.storage.local.get(['dsNhomCuaToi', 'hongLienTiep']);
  dsNhom = kho.dsNhomCuaToi || [];
  hongLienTiep = kho.hongLienTiep || {};
  veDanhSach();
  napNhatKy();
}

el('layNhom').onclick = async () => {
  el('layNhom').disabled = true;
  el('layNhom').textContent = 'Đang mở Facebook ở tab nền…';
  const tra = await chrome.runtime.sendMessage({ lenh: 'lay-nhom' });
  await napLaiDanhSach();
  el('layNhom').disabled = false;
  el('layNhom').textContent = 'Lấy danh sách nhóm của tôi' + (tra && tra.so ? ' (tổng ' + tra.so + ')' : '');
};

el('timNhom').onclick = async () => {
  const so = String(el('tuKhoaTim').value || '').split('\n').filter((s) => s.trim()).length;
  if (!so) { alert('Điền ít nhất một từ khoá đã.'); return; }
  await chrome.storage.local.set({ tuKhoaTim: el('tuKhoaTim').value });
  el('timNhom').disabled = true;
  el('timNhom').textContent = 'Đang tìm ' + so + ' từ khoá (mỗi từ cách nhau 20 giây)…';
  const tra = await chrome.runtime.sendMessage({ lenh: 'tim-nhom' });
  await napLaiDanhSach();
  el('timNhom').disabled = false;
  el('timNhom').textContent = 'Tìm nhóm công khai theo từ khoá' + (tra && tra.so ? ' (tổng ' + tra.so + ')' : '');
};

el('thuNoi').onclick = async () => {
  await chrome.storage.local.set({ diaChiGas: el('diaChiGas').value.trim(), khoa: el('khoa').value.trim() });
  el('thuNoi').disabled = true;
  el('ketQuaNoi').textContent = 'đang gửi…';
  const tra = await chrome.runtime.sendMessage({ lenh: 'thu-noi' });
  el('thuNoi').disabled = false;
  if (tra && tra.chu && tra.chu.indexOf('"ok":true') >= 0) {
    el('ketQuaNoi').textContent = 'ĐƯỢC — bảng tính nhận được (bài thử không lưu, không lên bảng)';
  } else {
    el('ketQuaNoi').textContent = 'HỎNG — ' + ((tra && (tra.loi || tra.chu)) || 'không rõ');
  }
  napNhatKy();
};

el('chonUuTien').onclick = () => {
  dsNhom.forEach((n) => { if (laUuTien(n.ten)) daChon.add(n.link); });
  veDanhSach();
};

el('chonViec').onclick = () => {
  dsNhom.forEach((n) => { if (laUuTien(n.ten) || laViec(n.ten)) daChon.add(n.link); });
  veDanhSach();
};

el('boChon').onclick = () => { daChon.clear(); veDanhSach(); };

el('batLai').onclick = async () => {
  hongLienTiep = {};
  await chrome.storage.local.set({ hongLienTiep: {} });
  veDanhSach();
};

el('luu').onclick = async () => {
  const o = { nhomChon: [...daChon] };
  O.forEach((k) => {
    const n = el(k);
    if (!n) return;
    o[k] = n.type === 'checkbox' ? n.checked : (n.type === 'number' ? Number(n.value) : n.value.trim());
  });
  await chrome.storage.local.set(o);
  await chrome.runtime.sendMessage({ lenh: 'dat-lich' });
  el('luu').textContent = 'Đã lưu';
  setTimeout(() => { el('luu').textContent = 'Lưu'; }, 1500);
};

el('chay').onclick = async () => {
  el('chay').disabled = true;
  el('chay').textContent = 'Đang chạy…';
  await chrome.runtime.sendMessage({ lenh: 'chay-ngay' });
  el('chay').disabled = false;
  el('chay').textContent = 'Chạy thử ngay';
  napLaiDanhSach();
};

el('xoaLog').onclick = async () => {
  await chrome.storage.local.set({ nhatKy: [] });
  napNhatKy();
};

async function napNhatKy() {
  const k = await chrome.storage.local.get(['nhatKy', 'lanCuoi', 'layNhomLuc', 'timNhomLuc']);
  const dau = [];
  if (k.lanCuoi) dau.push('Lượt gom gần nhất: ' + k.lanCuoi);
  if (k.layNhomLuc) dau.push('Lấy nhóm đã tham gia lúc: ' + k.layNhomLuc);
  if (k.timNhomLuc) dau.push('Tìm nhóm công khai lúc: ' + k.timNhomLuc);
  el('nhatKy').textContent = (dau.length ? dau.join('\n') + '\n\n' : '') +
    ((k.nhatKy || []).length ? k.nhatKy.join('\n') : 'chưa chạy lần nào');
}

chrome.storage.onChanged.addListener(napNhatKy);
nap();
