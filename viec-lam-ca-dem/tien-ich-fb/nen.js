/**
 * Phần chạy nền của tiện ích.
 * ============================================================================
 * NGUYÊN TẮC (user chốt 15/09/2026):
 *   - KHÔNG đăng nhập hộ, KHÔNG lưu mật khẩu, KHÔNG đọc cookie. Dùng đúng phiên
 *     Facebook bạn đã đăng nhập sẵn trong Edge.
 *   - Chạy trong MỘT CỬA SỔ RIÊNG, thu nhỏ sẵn, không lấy tiêu điểm: cửa sổ bạn đang
 *     làm việc không bị đụng, chuột không bị cướp. Gom xong đóng cả cửa sổ đó.
 *   - Chỉ ĐỌC. Không bấm thích, không bình luận, không đăng, không tham gia nhóm.
 *   - Nhiều nhóm thì XOAY VÒNG: mỗi lượt chỉ đọc một số nhóm rồi lần sau đọc tiếp.
 *
 * HAI BẪY ĐÃ CẮN VÀ CÁCH TRÁNH
 *   1. Cửa sổ thu nhỏ bị trình duyệt hãm đồng hồ — chờ 2 giây trong trang có khi thành cả phút.
 *      Nên MỌI nhịp chờ đếm ở đây (phần nền), trong trang chỉ cuộn một cái rồi trả về ngay.
 *   2. Facebook dùng CÙNG khuôn role="article" cho bài viết lẫn bình luận → phải bỏ khuôn nằm
 *      lồng trong khuôn khác, cắt dòng giao diện, và bỏ đoạn không có dấu hiệu tin tuyển người.
 *      (Rác kiểu "dạ em xin JD job service nha anh / Trả lời / Chia sẻ" đến từ đây.)
 */

const MAC_DINH = {
  bat: false,
  /* Điền sẵn cửa nhận bài của bảng tính — đây không phải bí mật, khoá mới là thứ gác cửa. */
  diaChiGas: 'https://script.google.com/macros/s/AKfycbyJMoDETaBKrmEk75jr20R8GomOUXkyVNdd0ia-qc9Sy9JC_BfrTPLPHCpyi8TgcqvF/exec',
  khoa: '',
  nhom: '',            // link gõ tay, mỗi dòng một link
  nhomChon: [],        // link tick chọn từ danh sách nhóm
  phutMoiLuot: 180,
  soLanCuon: 6,        // Facebook nạp bài theo cuộn: 3 nhịp chỉ ra 5-8 bài, 6 nhịp ra ~15-20
  toiDaMoiNhom: 25,
  nhomMoiLuot: 10,
  songSong: 2,         // số nhóm mở cùng lúc
  cheDoCuaSo: 'goc',   // 'goc' = cửa sổ nhỏ nằm góc màn hình (chắc ăn) · 'thunho' = thu nhỏ hẳn (kín hơn)
  ngheLenh: true,      // nghe lệnh "Cào ngay" bấm từ bảng tính
  moXemThem: true,     // bấm "Xem thêm" để lấy đủ bài (Facebook cắt bài dài)
  docCongTy: true,     // đọc trang tuyển dụng công ty (danh sách lấy từ tab NGUỒN CÔNG TY)
  toiDaMoiCongTy: 10,  // mỗi công ty mở tối đa bao nhiêu việc MỚI một lượt
  congTyMoiLuot: 6,    // mỗi lượt đọc bao nhiêu trang công ty (xoay vòng)
  giayGiuaNhom: 8,     // nghỉ giữa hai đợt
  tuKhoaTim: [
    'việc làm buồng phòng', 'housekeeping khách sạn', 'tuyển buồng phòng',
    'việc làm nhà hàng khách sạn', 'tuyển nhân viên nhà hàng', 'việc làm khách sạn tphcm',
    'việc làm ca đêm tphcm', 'tuyển bảo vệ ca đêm'
  ].join('\n')
};

async function caiDat() {
  const o = await chrome.storage.local.get(Object.keys(MAC_DINH));
  const c = Object.assign({}, MAC_DINH, o);
  /* Đã lưu một lần với ô trống thì trong kho là chuỗi rỗng — vẫn phải rơi về mặc định. */
  if (!c.diaChiGas) c.diaChiGas = MAC_DINH.diaChiGas;
  if (!c.tuKhoaTim) c.tuKhoaTim = MAC_DINH.tuKhoaTim;
  return c;
}

async function ghiNhatKy(dong) {
  const { nhatKy = [] } = await chrome.storage.local.get('nhatKy');
  nhatKy.unshift(new Date().toLocaleString('vi-VN') + ' — ' + dong);
  await chrome.storage.local.set({ nhatKy: nhatKy.slice(0, 80) });
}

chrome.runtime.onInstalled.addListener(datLich);
chrome.runtime.onStartup.addListener(datLich);

async function datLich() {
  const c = await caiDat();
  await chrome.alarms.clearAll();
  if (c.bat) chrome.alarms.create('gom', { periodInMinutes: Math.max(30, Number(c.phutMoiLuot) || 180) });
  /* Hỏi bảng tính mỗi 3 phút xem có ai bấm "Cào ngay" không. Một lượt hỏi là một dòng JSON
     vài chục byte — rẻ hơn nhiều so với bắt user bấm hai nút ở hai nơi. */
  if (c.ngheLenh !== false) chrome.alarms.create('nghe', { periodInMinutes: 3 });
}

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === 'gom') chayMotLuot('theo lịch');
  if (a.name === 'nghe') ngheLenhTuBangTinh();
});
chrome.action.onClicked.addListener(() => chayMotLuot('bấm tay'));

chrome.runtime.onMessage.addListener((m, _s, traLoi) => {
  if (!m || !m.lenh) return;
  if (m.lenh === 'chay-ngay') { chayMotLuot('bấm tay').then(() => traLoi({ xong: true })); return true; }
  if (m.lenh === 'dat-lich') { datLich().then(() => traLoi({ xong: true })); return true; }
  if (m.lenh === 'lay-nhom') { layDanhSachNhom().then((ds) => traLoi({ xong: true, so: ds.length })); return true; }
  if (m.lenh === 'tim-nhom') { timNhomCongKhai().then((ds) => traLoi({ xong: true, so: ds.length })); return true; }
  if (m.lenh === 'thu-noi') { thuNoiBangTinh().then(traLoi); return true; }
});

const nghi = (ms) => new Promise((r) => setTimeout(r, ms));

/* Trần 20 tab cùng lúc. Mở nhiều hơn nữa thì máy hết RAM trước khi Facebook kịp trả lời,
   và cụm 20 lượt tải bật lên trong một giây trông đúng kiểu máy chứ không phải người. */
function soTabSongSong_(n) { return Math.min(20, Math.max(1, Number(n) || 2)); }

/* Mở lệch nhau một nhịp ngắn thay vì bật cùng một lúc: nhẹ máy hơn và bớt lộ. */
const GIAN_MO_TAB_MS = 600;

/**
 * GIỮ CHO PHẦN NỀN KHỎI BỊ NGỦ.
 * Tiện ích đời mới (Manifest V3) bị trình duyệt tắt sau khoảng 30 giây "rảnh" — đang chờ giữa
 * hai nhóm mà bị tắt thì đứt gánh giữa đường. Cứ 20 giây gọi một lệnh vặt để báo là còn làm việc.
 */
let dongHoSong = null;
function giuSong(bat) {
  if (bat && !dongHoSong) dongHoSong = setInterval(() => chrome.runtime.getPlatformInfo(() => {}), 20000);
  if (!bat && dongHoSong) { clearInterval(dongHoSong); dongHoSong = null; }
}

/* ====================== CỬA SỔ RIÊNG ====================== */

let cuaSoId = null;

/** Cửa sổ riêng, thu nhỏ sẵn, không lấy tiêu điểm — cửa sổ đang làm việc của bạn không bị đụng. */
async function moCuaSoRieng(url, cheDo) {
  if (cuaSoId !== null) {
    try {
      await chrome.windows.get(cuaSoId);
      return await chrome.tabs.create({ url, windowId: cuaSoId, active: false });
    } catch (e) { cuaSoId = null; }   // cửa sổ đã bị đóng tay
  }
  /* BẪY 15/09/2026: cửa sổ THU NHỎ thì trình duyệt không vẽ trang, mà Facebook chỉ dựng bài khi
     trang được vẽ → mở kiểu đó đọc ra 0 bài. Nên mặc định là cửa sổ NHỎ NẰM GÓC: có vẽ, không
     lấy tiêu điểm, không cướp chuột. Ai thích kín hơn thì chọn 'thunho' trong Tuỳ chọn. */
  const dat = (cheDo === 'thunho')
    ? { url, focused: false, state: 'minimized', type: 'normal' }
    : { url, focused: false, type: 'normal', width: 560, height: 720, left: 20, top: 20 };
  const cs = await chrome.windows.create(dat);
  cuaSoId = cs.id;
  return (cs.tabs && cs.tabs[0]) || null;
}

async function dongCuaSoRieng() {
  if (cuaSoId === null) return;
  try { await chrome.windows.remove(cuaSoId); } catch (e) { /* đã đóng rồi */ }
  cuaSoId = null;
}

/**
 * Hỏi bảng tính xem có lệnh "Cào ngay" mới không. Có thì gom Facebook rồi báo lại để bảng tính
 * gộp vào — user chỉ bấm MỘT nút bên bảng tính, không phải chạy hai nơi.
 */
async function ngheLenhTuBangTinh() {
  const c = await caiDat();
  if (c.ngheLenh === false || !c.diaChiGas || !c.khoa) return;
  let yc = 0;
  try {
    const tra = await fetch(c.diaChiGas + '?khoa=' + encodeURIComponent(c.khoa) + '&hoi=1');
    const j = JSON.parse(await tra.text());
    if (!j.ok) { await ghiNhatKy('hỏi lệnh: ' + (j.loi || '?')); return; }
    yc = Number(j.yc || 0);
  } catch (e) { return; }                       // mạng chập chờn thì im lặng, 3 phút sau hỏi lại
  if (!yc) return;

  const { lenhDaLam = 0 } = await chrome.storage.local.get('lenhDaLam');
  if (yc <= lenhDaLam) return;                  // lệnh cũ, đã làm rồi
  await chrome.storage.local.set({ lenhDaLam: yc });
  await ghiNhatKy('nhận lệnh "Cào ngay" từ bảng tính');
  await chayMotLuot('lệnh từ bảng tính');
  await baoDaXong(c);
}

/** Báo bảng tính gộp lại (chỉ dựng lại bảng từ bộ nhớ + bài Facebook, không cào lại trang nào). */
async function baoDaXong(c) {
  try {
    const tra = await fetch(c.diaChiGas, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ khoa: c.khoa, lenh: 'xong-fb' })
    });
    const j = JSON.parse(await tra.text());
    await ghiNhatKy(j.ok ? 'bảng tính đã gộp lại: ' + (j.gopLai || 0) + ' việc' : 'gộp lại hỏng: ' + (j.loi || '?'));
  } catch (e) {
    await ghiNhatKy('báo bảng tính gộp lại lỗi: ' + e);
  }
}

/** Gửi thử một bài giả để kiểm riêng khâu "nối với bảng tính", không dính gì tới Facebook. */
async function thuNoiBangTinh() {
  const c = await caiDat();
  if (!c.diaChiGas) return { ok: false, loi: 'chưa điền địa chỉ nhận bài' };
  if (!c.khoa) return { ok: false, loi: 'chưa điền khoá' };
  const bai = [{
    id: 'thu-noi-' + Date.now(),
    link: 'https://www.facebook.com/groups/0/posts/0',
    tacGia: 'Bài thử của tiện ích',
    luc: new Date().toISOString(),
    chu: 'BÀI THỬ NỐI BẢNG TÍNH\nTUYỂN BẢO VỆ CA ĐÊM\nCa 22h - 6h sáng\nLương 8.000.000/tháng\nĐịa chỉ: Hóc Môn\nBài này do nút "Thử nối bảng tính" tạo ra, xoá được.',
    nhom: 'thử nối'
  }];
  try {
    const tra = await fetch(c.diaChiGas, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ khoa: c.khoa, nhom: 'thử nối', bai })
    });
    const chu = (await tra.text()).slice(0, 300);
    await ghiNhatKy('thử nối bảng tính: HTTP ' + tra.status + ' · ' + chu);
    return { ok: tra.ok, ma: tra.status, chu };
  } catch (e) {
    await ghiNhatKy('thử nối bảng tính LỖI: ' + e);
    return { ok: false, loi: String(e) };
  }
}

/* ====================== LẤY DANH SÁCH NHÓM ====================== */

async function layDanhSachNhom() {
  giuSong(true);
  try { return await layDanhSachNhom_(); } finally { giuSong(false); await dongCuaSoRieng(); }
}

async function layDanhSachNhom_() {
  const diaChi = ['https://www.facebook.com/groups/joins/', 'https://www.facebook.com/groups/feed/'];
  let gom = {};
  for (const url of diaChi) {
    try {
      const ra = await quetMotTrang(url, 12, docDanhSachNhomTrongTrang);
      ra.forEach((n) => { gom[n.link] = n; });
      await ghiNhatKy('quét ' + url.replace('https://www.facebook.com', '') + ': tổng cộng ' + Object.keys(gom).length + ' nhóm');
    } catch (e) {
      await ghiNhatKy('quét danh sách nhóm lỗi: ' + e);
    }
    if (Object.keys(gom).length >= 30) break;
  }
  const ds = await gopVaoDanhSach(Object.values(gom).map((n) => Object.assign({ nguon: 'đã tham gia' }, n)));
  await chrome.storage.local.set({ layNhomLuc: new Date().toLocaleString('vi-VN') });
  await ghiNhatKy('lấy được ' + Object.keys(gom).length + ' nhóm đã tham gia');
  return ds;
}

async function timNhomCongKhai() {
  giuSong(true);
  try { return await timNhomCongKhai_(); } finally { giuSong(false); await dongCuaSoRieng(); }
}

async function timNhomCongKhai_() {
  const c = await caiDat();
  const tuKhoa = String(c.tuKhoaTim || '').split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 12);
  if (!tuKhoa.length) { await ghiNhatKy('chưa có từ khoá tìm nhóm'); return []; }

  let gom = {};
  for (let i = 0; i < tuKhoa.length; i++) {
    const url = 'https://www.facebook.com/search/groups/?q=' + encodeURIComponent(tuKhoa[i]);
    try {
      const ra = await quetMotTrang(url, 6, docDanhSachNhomTrongTrang);
      ra.forEach((n) => { gom[n.link] = Object.assign({ nguon: 'tìm thấy', tuKhoa: tuKhoa[i] }, n); });
      await ghiNhatKy('tìm "' + tuKhoa[i] + '": ' + ra.length + ' nhóm');
    } catch (e) {
      await ghiNhatKy('tìm "' + tuKhoa[i] + '" lỗi: ' + e);
    }
    if (i < tuKhoa.length - 1) await nghi(6000);
  }
  const ds = await gopVaoDanhSach(Object.values(gom));
  await chrome.storage.local.set({ timNhomLuc: new Date().toLocaleString('vi-VN') });
  await ghiNhatKy('tìm xong: thêm vào danh sách, tổng cộng ' + ds.length + ' nhóm');
  return ds;
}

async function gopVaoDanhSach(themVao) {
  const { dsNhomCuaToi = [] } = await chrome.storage.local.get('dsNhomCuaToi');
  const map = {};
  dsNhomCuaToi.forEach((n) => { map[n.link] = n; });
  themVao.forEach((n) => {
    const cu = map[n.link];
    map[n.link] = Object.assign({}, cu || {}, n, {
      nguon: (cu && cu.nguon === 'đã tham gia') ? 'đã tham gia' : n.nguon
    });
  });
  const ds = Object.values(map).sort((a, b) => a.ten.localeCompare(b.ten, 'vi'));
  await chrome.storage.local.set({ dsNhomCuaToi: ds });
  return ds;
}

/* ====================== GOM BÀI ====================== */

async function chayMotLuot(kieu) {
  giuSong(true);
  try { await chayMotLuot_(kieu); } finally { giuSong(false); await dongCuaSoRieng(); }
}

async function chayMotLuot_(kieu) {
  const c = await caiDat();
  const goTay = String(c.nhom || '').split('\n').map((s) => s.trim()).filter((s) => s.startsWith('http'));
  /* Facebook page của các công ty theo dõi (tab NGUỒN CÔNG TY) đọc chung một đường với nhóm:
     page công khai nên không cần theo dõi, cùng khuôn bài, cùng bộ lọc. */
  let fbPages = [];
  if (c.docCongTy !== false && c.diaChiGas && c.khoa) {
    try { fbPages = (await hoiBangTinh(c)).fbPages; } catch (e) { /* không lấy được thì thôi */ }
  }
  let tatCa = [...new Set([...(c.nhomChon || []), ...goTay, ...fbPages])];

  if (!c.diaChiGas || !c.khoa) { await ghiNhatKy('thiếu địa chỉ nhận bài hoặc khoá — vào Tuỳ chọn điền giúp'); return; }
  if (!tatCa.length) { await ghiNhatKy('chưa chọn nhóm nào'); return; }

  /* Nhóm riêng tư chưa tham gia thì đọc mãi cũng 0 bài — hụt 3 lượt liền thì bỏ qua. */
  const { hongLienTiep = {} } = await chrome.storage.local.get('hongLienTiep');
  const boQua = tatCa.filter((u) => (hongLienTiep[u] || 0) >= 3);
  tatCa = tatCa.filter((u) => (hongLienTiep[u] || 0) < 3);
  if (boQua.length) await ghiNhatKy('bỏ qua ' + boQua.length + ' nhóm không đọc được bài (nhiều khả năng là nhóm riêng tư chưa tham gia)');
  if (!tatCa.length) { await ghiNhatKy('mọi nhóm đã chọn đều không đọc được — xem lại danh sách'); return; }

  const moiLuot = Math.max(1, Number(c.nhomMoiLuot) || 10);
  const { viTriXoay = 0 } = await chrome.storage.local.get('viTriXoay');
  const bd = viTriXoay % tatCa.length;
  const luot = [];
  for (let i = 0; i < Math.min(moiLuot, tatCa.length); i++) luot.push(tatCa[(bd + i) % tatCa.length]);
  await chrome.storage.local.set({ viTriXoay: (bd + luot.length) % tatCa.length });

  const songSong = soTabSongSong_(c.songSong);
  const batDau = Date.now();
  await ghiNhatKy('bắt đầu (' + kieu + '): ' + luot.length + '/' + tatCa.length + ' nhóm, mở ' + songSong + ' nhóm cùng lúc');

  let tong = 0, moi = 0, rac = 0;
  for (let i = 0; i < luot.length; i += songSong) {
    const dot = luot.slice(i, i + songSong);
    const kq = await Promise.all(dot.map(async (url, k) => {
      try {
        await nghi(k * GIAN_MO_TAB_MS);          // mở lệch nhau cho nhẹ máy
        const g = await gomMotNhom(url, c);
        return { url, bai: g.bai, bo: g.bo, thay: g.thay, lyDo: g.lyDo, thuTu: bd + i + k + 1 };
      } catch (e) {
        await ghiNhatKy('nhóm ' + (bd + i + k + 1) + ' lỗi: ' + e);
        return { url, bai: [], bo: 0, thay: 0, thuTu: bd + i + k + 1 };
      }
    }));

    for (const r of kq) {
      tong += r.bai.length;
      rac += r.bo;
      if (r.bai.length) moi += await guiVeSheet(c, r.url, r.bai);
      hongLienTiep[r.url] = r.bai.length ? 0 : (hongLienTiep[r.url] || 0) + 1;
      /* Ghi cả số KHUÔN BÀI trang trả về: "thấy 0 khuôn" = trang không dựng bài (cửa sổ không được
         vẽ, hoặc nhóm riêng tư); "thấy nhiều mà lấy 0" = bộ lọc siết quá. Hai bệnh khác hẳn nhau. */
      const ld = r.lyDo || {};
      const viSao = [ld.longNhau ? ld.longNhau + ' bình luận' : '', ld.ngan ? ld.ngan + ' quá ngắn' : '',
        ld.khongTuyen ? ld.khongTuyen + ' không phải tin tuyển' : ''].filter(Boolean).join(', ');
      await ghiNhatKy('nhóm ' + r.thuTu + ': thấy ' + r.thay + ' khuôn bài → lấy ' + r.bai.length +
        ' tin tuyển dụng, bỏ ' + r.bo + (viSao ? ' (' + viSao + ')' : '') +
        (ld.khongLink ? ' · ' + ld.khongLink + ' bài không có link, đã dựng mã tạm' : '') +
        (r.bai.length ? '' : ' (hụt lần ' + hongLienTiep[r.url] + '/3' +
          (r.thay === 0 ? ' — trang không dựng bài, thử đổi Cách chạy sang "cửa sổ góc"' : '') + ')'));
    }
    await chrome.storage.local.set({ hongLienTiep });
    if (i + songSong < luot.length) await nghi(Math.max(2, Number(c.giayGiuaNhom) || 8) * 1000);
  }

  /* Trang tuyển dụng công ty — đọc bằng trình duyệt thật vì phần lớn là web chạy JavaScript,
     máy chủ Google chỉ tải được cái vỏ (Kingfoodmart: 121 chữ, không có việc nào). */
  if (c.docCongTy !== false) {
    try { moi += await docTrangCongTy(c); } catch (e) { await ghiNhatKy('trang công ty lỗi: ' + e); }
  }

  const giay = Math.round((Date.now() - batDau) / 1000);
  await ghiNhatKy('xong sau ' + giay + ' giây: lấy ' + tong + ' tin, gửi mới ' + moi + ', bỏ ' + rac + ' đoạn rác');
  await chrome.storage.local.set({ lanCuoi: new Date().toLocaleString('vi-VN') });
}

/**
 * Mở một trang trong cửa sổ riêng, cuộn vài nhịp rồi đọc.
 * MỌI nhịp chờ đếm ở đây chứ không đếm trong trang — cửa sổ thu nhỏ bị hãm đồng hồ,
 * chờ trong trang sẽ lâu gấp nhiều lần.
 */
async function quetMotTrang(url, soVongCuon, hamDoc, thamSo, cheDo, moXemThem) {
  const tab = await moCuaSoRieng(url, cheDo);
  if (!tab) throw new Error('không mở được cửa sổ riêng');
  try {
    /* Mở nhiều tab thì trình duyệt hay "xả" bớt tab nền để lấy RAM — xả giữa chừng là mất trắng
       công tải. Cờ này giữ tab sống tới lúc đọc xong. */
    try { await chrome.tabs.update(tab.id, { autoDiscardable: false }); } catch (e) { /* bản cũ không có */ }
    await doiTaiXong(tab.id, 60000);
    await nghi(1500);
    for (let i = 0; i < soVongCuon; i++) {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: cuonMotNhip });
      await nghi(1200);
    }
    /* Facebook cắt bài dài ở "Xem thêm" — không mở ra thì chỉ đọc được ~100 chữ đầu, mất luôn
       phần giờ ca và địa chỉ, tin coi như vô dụng. Ca đã cắn 15/09/2026: bài "TUYỂN BẢO VỆ …
       Xem thêm" về tới Sheet nhưng bị loại vì trong phần đọc được không có chữ nào nói ca đêm. */
    if (moXemThem) {
      try {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: bamXemThem });
        await nghi(900);
      } catch (e) { /* trang không có nút nào thì thôi */ }
    }
    const kq = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: hamDoc,
      args: thamSo === undefined ? [] : [thamSo]
    });
    return (kq && kq[0] && kq[0].result) || [];
  } finally {
    try { await chrome.tabs.remove(tab.id); } catch (e) { /* tab đã đóng */ }
  }
}

function cuonMotNhip() { window.scrollBy(0, window.innerHeight * 0.92); }

/** Bấm mọi nút "Xem thêm" để bài dài hiện đủ chữ. Chỉ mở chữ, không thích/bình luận/đăng gì. */
function bamXemThem() {
  var so = 0;
  document.querySelectorAll('div[role="button"], span[role="button"]').forEach(function (n) {
    if (so >= 30) return;
    var chu = (n.innerText || '').trim().toLowerCase();
    if (chu === 'xem thêm' || chu === 'see more' || chu === '… xem thêm' || chu === '…xem thêm') {
      try { n.click(); so++; } catch (e) { /* nút khuất thì bỏ qua */ }
    }
  });
  return so;
}

async function gomMotNhom(url, c) {
  const ra = await quetMotTrang(url, Number(c.soLanCuon) || 3, docBaiTrongTrang,
    Number(c.toiDaMoiNhom) || 25, c.cheDoCuaSo, c.moXemThem !== false);
  return { bai: (ra && ra.bai) || [], bo: (ra && ra.bo) || 0, thay: (ra && ra.thay) || 0, lyDo: (ra && ra.lyDo) || {} };
}

function doiTaiXong(tabId, hanMs) {
  return new Promise((ok, hong) => {
    const dongHo = setTimeout(() => { chrome.tabs.onUpdated.removeListener(nghe); hong(new Error('tải quá lâu')); }, hanMs);
    function nghe(id, info) {
      if (id === tabId && info.status === 'complete') {
        clearTimeout(dongHo);
        chrome.tabs.onUpdated.removeListener(nghe);
        ok();
      }
    }
    chrome.tabs.onUpdated.addListener(nghe);
  });
}

/** Chạy BÊN TRONG trang Facebook — phải tự chứa, không gọi ra ngoài được. */
function docDanhSachNhomTrongTrang() {
  const CAM = ['feed', 'joins', 'discover', 'create', 'browse', 'search', 'your_groups',
    'notifications', 'invites', 'category', 'suggestions', 'about', 'members', 'media', 'files'];
  const ra = {};
  document.querySelectorAll('a[href*="/groups/"]').forEach((a) => {
    const m = (a.href || '').match(/^https:\/\/www\.facebook\.com\/groups\/([^/?#]+)\/?(?:\?.*)?$/);
    if (!m) return;
    const ma = m[1];
    if (CAM.indexOf(ma) >= 0) return;
    const ten = (a.innerText || a.getAttribute('aria-label') || '').split('\n')[0].trim();
    if (!ten || ten.length < 2) return;
    ra['https://www.facebook.com/groups/' + ma] = {
      link: 'https://www.facebook.com/groups/' + ma, ten: ten.substring(0, 120)
    };
  });
  return Object.values(ra);
}

/**
 * Đọc BÀI VIẾT trong nhóm — và chỉ bài viết.
 * Facebook dùng chung khuôn role="article" cho cả bình luận, nên:
 *   - khuôn nào nằm LỒNG trong khuôn khác là bình luận → bỏ;
 *   - cắt các dòng giao diện (Thích, Trả lời, Chia sẻ, Xem thêm…);
 *   - đoạn nào không có dấu hiệu tin tuyển người → bỏ, và đếm lại để báo trong nhật ký.
 */
function docBaiTrongTrang(toiDa) {
  const RAC = /^(thích|like|trả lời|chia sẻ|bình luận|xem thêm|xem bản dịch|tất cả cảm xúc|đã thích|theo dõi|tham gia|ẩn|báo cáo|dịch|viết bình luận|đang hoạt động|quản trị viên|thành viên mới|tác giả)$/i;
  const DONG_SO = /^\d+\s*(bình luận|lượt chia sẻ|người|phút|giờ|ngày|tuần|tháng|năm)?$/i;

  /* Phải có ĐỘNG TỪ TUYỂN mới nhận. Lọc cũ chỉ hỏi "có dính tới việc làm không" nên bài của
     người ĐI XIN VIỆC ("mình học quản trị khách sạn… đi xin việc… lương 8tr") vẫn lọt. */
  const boDau = (s) => String(s || '').toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
  /* Động từ tuyển — nới 15/09/2026 tối: nhóm Facebook viết cộc "Cần 2 bảo vệ", "Tìm phục vụ ca tối",
     "Nhận tạp vụ đêm" — bản cũ chỉ bắt "tuyển/cần người" nên rơi gần hết. */
  const TUYEN = /(tuyen|can tuyen|can nguoi|can gap|can them|dang can|can \d+|can nam|can nu|can ban|nhan nguoi|nhan nhan vien|tim nguoi lam|tim nguoi|hiring|recruit|tuyen dung|can tim|(can|tim|nhan|bo sung)\s+(\d+\s+)?(ban|nam|nu|nguoi|nhan vien|bao ve|phuc vu|tap vu|le tan|buong phong|thu ngan|kho|giao hang|tai xe|shipper|phu bep|bep|pha che|giu xe|ve sinh|cong nhan|lao dong)|luong .{0,40}(lien he|lh|zalo|inbox|ib)|(lien he|lh|zalo)\s*:?\s*0\d{8,10})/;
  const DI_XIN = /(xin viec|tim viec|em xin|minh xin|cho em hoi|cho minh hoi|xin hoi|minh hoc|em hoc|moi ra truong|co ai biet|ai biet cho nao|review cong ty|tam su|em can viec|minh can viec|xin jd)/;
  const laTinTuyen = (chu) => {
    const s = boDau(chu);
    if (s.length < 30 || !TUYEN.test(s)) return false;     // 80 → 30: "Cần 2 bảo vệ ca đêm Q12, 7tr, LH 09…" là 43 chữ
    /* Giọng người đi xin việc ("ai biết chỗ nào…", "em cần việc…") → loại, dù trong câu có chữ
       "tuyển" — trừ khi bài MỞ ĐẦU bằng động từ tuyển (chính chủ đang tuyển). */
    const dau = s.substring(0, 160);
    const moDauTuyen = /^\W*(tuyen|can\b|tim\b|nhan\b|dang can|bo sung|hiring|recruit)/.test(s);
    return !(DI_XIN.test(dau) && !moDauTuyen);
  };

  const doiGioTuongDoi = (chu) => {
    const s = (chu || '').toLowerCase();
    const m = s.match(/(\d+)\s*(phút|giờ|ngày|tuần|tháng|năm)/);
    const nay = Date.now();
    if (m) {
      const n = Number(m[1]);
      const heSo = { 'phút': 60000, 'giờ': 3600000, 'ngày': 86400000, 'tuần': 604800000, 'tháng': 2592000000, 'năm': 31536000000 }[m[2]];
      return nay - n * heSo;
    }
    if (/vừa xong|mới đây/.test(s)) return nay;
    const d = Date.parse(chu);
    return isNaN(d) ? 0 : d;
  };

  const ra = [];
  let bo = 0;
  const lyDo = { longNhau: 0, ngan: 0, khongTuyen: 0, khongLink: 0 };   // bài chết ở cửa nào
  const tenNhom = document.title.replace(/\s*\|\s*Facebook\s*$/i, '').trim();
  const khuon = document.querySelectorAll('div[role="article"]');

  khuon.forEach((the) => {
    if (ra.length >= toiDa) return;

    /* Bình luận là article nằm lồng trong article của bài — bỏ thẳng. */
    if (the.parentElement && the.parentElement.closest('div[role="article"]')) { bo++; lyDo.longNhau++; return; }

    /* Link bài: thử nhiều kiểu Facebook hay dùng. KHÔNG còn vứt bài vì thiếu link — Facebook đời mới
       hay để href="#" ở mốc giờ cho tới khi rê chuột; tin thật rơi vì thế (15/09/2026). Không có link
       thì tự dựng mã từ người đăng + 60 chữ đầu, link tạm trỏ về nhóm. */
    const neo = the.querySelector('a[href*="/posts/"], a[href*="permalink"], a[href*="/videos/"], a[href*="story_fbid"], a[href*="/reel/"], a[href*="multi_permalinks"]');
    let link = neo ? neo.href.split('?')[0] : '';

    const dongTho = (the.innerText || '').split('\n').map((d) => d.trim());
    const tacGia = (dongTho[0] || '').substring(0, 80);

    let luc = 0;
    for (const d of dongTho.slice(0, 6)) {
      const t = doiGioTuongDoi(d);
      if (t) { luc = t; break; }
    }

    /* Bỏ dòng giao diện, dòng mốc thời gian, giữ lại phần nội dung thật. */
    const dong = dongTho.filter((d, i) => {
      if (i === 0) return false;                 // dòng đầu là tên người đăng
      if (!d || d.length < 2) return false;
      if (RAC.test(d) || DONG_SO.test(d)) return false;
      if (d === '·' || d === '...') return false;
      return true;
    });
    const chu = dong.join('\n').trim();

    if (chu.length < 30) { bo++; lyDo.ngan++; return; }
    if (!laTinTuyen(chu)) { bo++; lyDo.khongTuyen++; return; }
    if (!link) {
      lyDo.khongLink++;
      const goc = boDau(tacGia + '|' + chu.substring(0, 60)).replace(/[^a-z0-9]+/g, '-');
      link = location.href.split('?')[0].replace(/\/$/, '') + '#bai-' + goc.substring(0, 80);
    }

    ra.push({
      id: link, link: link, tacGia: tacGia,
      luc: luc ? new Date(luc).toISOString() : '',
      chu: chu.substring(0, 3000),
      nhom: tenNhom
    });
  });

  return { bai: ra, bo: bo, thay: khuon.length, lyDo: lyDo };
}

/* ====================== TRANG TUYỂN DỤNG CÔNG TY ====================== */

/** Hỏi bảng tính: danh sách trang công ty (tab NGUỒN CÔNG TY) + có lệnh Cào ngay mới không. */
async function hoiBangTinh(c) {
  const tra = await fetch(c.diaChiGas + '?khoa=' + encodeURIComponent(c.khoa) + '&hoi=1');
  const j = JSON.parse(await tra.text());
  if (!j.ok) throw new Error(j.loi || 'bảng tính từ chối');
  return {
    yc: Number(j.yc || 0),
    congTy: Array.isArray(j.congTy) ? j.congTy : [],
    fbPages: Array.isArray(j.fbPages) ? j.fbPages : []     // Facebook page của công ty theo dõi
  };
}

/**
 * Trang danh sách không thấy link việc nào → tìm nút "Tuyển dụng / Cơ hội nghề nghiệp / Careers"
 * trên trang đó và đi theo một bước. Đỡ phải đoán đúng địa chỉ (15/09/2026 tôi đoán sai 8 trang).
 */
function timLinkTuyenDungTrongTrang() {
  const goc = location.origin;
  const CHU = /(tuyển dụng|tuyen dung|cơ hội nghề nghiệp|co hoi nghe nghiep|việc làm|viec lam|careers?|jobs?|join us|gia nhập|recruit)/i;
  const ra = [];
  document.querySelectorAll('a[href]').forEach((a) => {
    let href = '';
    try { href = new URL(a.getAttribute('href'), location.href).href; } catch (e) { return; }
    const chu = (a.innerText || a.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
    if (!CHU.test(chu) && !CHU.test(href)) return;
    if (/facebook|linkedin|zalo|youtube|instagram/i.test(href)) return;
    const sach = href.replace(/[#].*$/, '');
    if (sach.replace(/\/$/, '') === location.href.replace(/[#?].*$/, '').replace(/\/$/, '')) return;
    ra.push({ link: sach, chu, cungMien: href.startsWith(goc) ? 1 : 0 });
  });
  /* Ưu tiên link cùng tên miền có chữ "tuyển dụng" trong tên. */
  ra.sort((x, y) => (y.cungMien - x.cungMien) || (CHU.test(y.chu) - CHU.test(x.chu)));
  return ra.slice(0, 3).map((r) => r.link);
}

/**
 * Với từng trang DANH SÁCH việc của công ty: mở lên, gom link từng việc, mở những việc CHƯA
 * từng đọc, lấy nguyên văn trang việc gửi về bảng tính. Bảng tính tự lọc ca 20h-8h, telesale,
 * xoay ca — tiện ích không phán xét, chỉ đưa chữ về. Link đã gửi được nhớ 30 ngày để lượt sau
 * chỉ mở việc mới, không mở lại.
 */
async function docTrangCongTy(c) {
  let dsCongTy = [];
  try { dsCongTy = (await hoiBangTinh(c)).congTy; }
  catch (e) { await ghiNhatKy('không lấy được danh sách trang công ty: ' + e); return 0; }
  if (!dsCongTy.length) return 0;

  const { daGuiCongTy = {} } = await chrome.storage.local.get('daGuiCongTy');
  const han = Date.now() - 30 * 86400000;
  Object.keys(daGuiCongTy).forEach((k) => { if (daGuiCongTy[k] < han) delete daGuiCongTy[k]; });

  /* Xoay vòng như nhóm Facebook: mỗi lượt chỉ đọc vài công ty, lượt sau đọc tiếp — danh sách
     vài chục công ty không biến một lượt thành vài trăm tab. */
  const moiLuot = Math.max(1, Number(c.congTyMoiLuot) || 6);
  const { viTriXoayCongTy = 0 } = await chrome.storage.local.get('viTriXoayCongTy');
  const bd = dsCongTy.length ? viTriXoayCongTy % dsCongTy.length : 0;
  const luot = [];
  for (let i = 0; i < Math.min(moiLuot, dsCongTy.length); i++) luot.push(dsCongTy[(bd + i) % dsCongTy.length]);
  await chrome.storage.local.set({ viTriXoayCongTy: (bd + luot.length) % dsCongTy.length });
  await ghiNhatKy('trang công ty: đọc ' + luot.length + '/' + dsCongTy.length + ' trang, từ trang thứ ' + (bd + 1));

  let tongMoi = 0;
  for (const trang of luot) {
    const host = trang.replace(/^https?:\/\//, '').split('/')[0];
    let links = [];
    try {
      links = await quetMotTrang(trang, 2, docLinkViecTrongTrang, undefined, c.cheDoCuaSo, false);
      /* Không thấy việc nào (trang chủ, hoặc địa chỉ tuyển dụng đã đổi) → dò nút "Tuyển dụng" đi tiếp 1 bước. */
      if (!links.length) {
        const cua = await quetMotTrang(trang, 0, timLinkTuyenDungTrongTrang, undefined, c.cheDoCuaSo, false);
        for (const u of (cua || []).slice(0, 2)) {
          links = await quetMotTrang(u, 2, docLinkViecTrongTrang, undefined, c.cheDoCuaSo, false);
          if (links.length) { await ghiNhatKy('web ' + host + ': trang gốc không có việc, đi theo nút Tuyển dụng → ' + u.replace(/^https?:\/\//, '')); break; }
        }
      }
    } catch (e) { await ghiNhatKy('web ' + host + ': không mở được (' + e + ')'); continue; }

    const chuaDoc = links.filter((l) => !daGuiCongTy[l.link]).slice(0, Math.max(1, Number(c.toiDaMoiCongTy) || 10));
    const bai = [];
    for (let i = 0; i < chuaDoc.length; i += 2) {
      const dot = chuaDoc.slice(i, i + 2);
      const kq = await Promise.all(dot.map(async (l, k) => {
        await nghi(k * GIAN_MO_TAB_MS);
        try { return { l, trangViec: await quetMotTrang(l.link, 1, docTrangViecCongTy, undefined, c.cheDoCuaSo, false) }; }
        catch (e) { return { l, trangViec: null }; }
      }));
      kq.forEach(({ l, trangViec }) => {
        daGuiCongTy[l.link] = Date.now();
        if (!trangViec || !trangViec.chu || trangViec.chu.length < 60) return;
        bai.push({
          id: l.link, link: l.link, tacGia: host, luc: '',
          chu: ((trangViec.ten || l.ten || '') + '\n' + trangViec.chu).substring(0, 3000),
          nhom: 'web: ' + host
        });
      });
      if (i + 2 < chuaDoc.length) await nghi(2000);
    }
    await chrome.storage.local.set({ daGuiCongTy });

    let guiMoi = 0;
    if (bai.length) guiMoi = await guiVeSheet(c, 'web: ' + host, bai);
    tongMoi += guiMoi;
    await ghiNhatKy('web ' + host + ': thấy ' + links.length + ' link việc, mở ' + chuaDoc.length + ' việc chưa đọc, gửi ' + bai.length + ' (mới ' + guiMoi + ')');
  }
  return tongMoi;
}

/** Chạy TRONG trang danh sách: gom link cùng tên miền trông giống một tin việc. */
function docLinkViecTrongTrang() {
  const goc = location.origin;
  const hienTai = location.href.replace(/[#?].*$/, '').replace(/\/$/, '');
  const DAU = /(tuyen-?dung|viec-?lam|jobs?|career|chi-?tiet|recruit|position|vi-?tri|co-?hoi|opening|vacanc)/i;
  const BO = /(login|dang-?nhap|register|dang-?ky|ung-?tuyen|apply|page=|\/tag|\/category|\/danh-?muc|facebook|zalo|linkedin|\.pdf$|\.jpg$|\.png$)/i;
  const thay = {};
  document.querySelectorAll('a[href]').forEach((a) => {
    let href = '';
    try { href = new URL(a.getAttribute('href'), location.href).href; } catch (e) { return; }
    if (!href.startsWith(goc)) return;
    const sach = href.replace(/[#?].*$/, '').replace(/\/$/, '');
    if (!sach || sach === hienTai || sach === goc) return;
    if (BO.test(sach)) return;
    const duong = sach.substring(goc.length);
    const chu = (a.innerText || a.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
    /* Tin việc: đường dẫn có dấu hiệu việc làm VÀ sâu hơn trang danh sách, hoặc tên link đủ dài
       và nhắc tới nhân viên/tuyển/ca/vị trí. */
    const giongViec = (DAU.test(duong) && duong.split('/').filter(Boolean).length >= 2) ||
      (chu.length >= 12 && /(nhân viên|tuyển|ca |vị trí|chuyên viên|giám sát|security|staff|cộng tác viên|bảo vệ|thu ngân|kho)/i.test(chu));
    if (!giongViec) return;
    if (!thay[sach] || (chu.length > (thay[sach].ten || '').length)) thay[sach] = { link: sach, ten: chu.substring(0, 150) };
  });
  return Object.values(thay).slice(0, 60);
}

/** Chạy TRONG trang một việc: lấy tên việc + toàn bộ chữ chính của trang. */
function docTrangViecCongTy() {
  const h1 = document.querySelector('h1');
  const ten = (h1 && h1.innerText.trim()) || document.title.replace(/\s*[|\-–].*$/, '').trim();
  const khung = document.querySelector('main, article, [class*="detail"], [class*="content"], [id*="content"]') || document.body;
  const chu = (khung.innerText || document.body.innerText || '')
    .split('\n').map((d) => d.trim()).filter((d) => d.length > 1).join('\n');
  return { ten, chu: chu.substring(0, 4000) };
}

/** Gửi về cửa nhận bài của Apps Script. Apps Script trả lời qua 2 chặng nên đọc lỏng tay. */
async function guiVeSheet(c, urlNhom, bai) {
  const tra = await fetch(c.diaChiGas, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ khoa: c.khoa, nhom: urlNhom, bai })
  });
  const chu = await tra.text();
  try {
    const j = JSON.parse(chu);
    if (!j.ok) { await ghiNhatKy('Sheet từ chối (HTTP ' + tra.status + '): ' + (j.loi || '?')); return 0; }
    return j.moi || 0;
  } catch (e) {
    await ghiNhatKy('gửi xong nhưng không đọc được trả lời (' + tra.status + ')');
    return 0;
  }
}
