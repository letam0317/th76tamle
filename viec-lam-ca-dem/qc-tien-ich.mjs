/**
 * QC cho tiện ích Facebook — chạy thẳng 2 hàm chạy-trong-trang của nen.js trên một trang giả,
 * để bắt lỗi lọc link nhóm và lỗi bóc bài mà không cần mở trình duyệt.
 *
 * Chạy:  node qc-tien-ich.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const nguon = fs.readFileSync(path.join(DIR, 'tien-ich-fb', 'nen.js'), 'utf8');

/* nen.js gọi chrome.* ngay lúc nạp — dựng bộ khung giả cho nó chạy được. */
const im = () => {};
globalThis.chrome = {
  runtime: { onInstalled: { addListener: im }, onStartup: { addListener: im }, onMessage: { addListener: im } },
  alarms: { onAlarm: { addListener: im }, create: im, clearAll: async () => {} },
  action: { onClicked: { addListener: im } },
  storage: { local: { get: async () => ({}), set: async () => {} } },
  tabs: { create: async () => ({ id: 1 }), remove: async () => {}, onUpdated: { addListener: im, removeListener: im } },
  windows: { create: async () => ({ id: 9, tabs: [{ id: 1 }] }), get: async () => ({ id: 9 }), remove: async () => {} },
  scripting: { executeScript: async () => [{ result: [] }] }
};

(0, eval)(nguon + '\n;globalThis.__nap = { docDanhSachNhomTrongTrang, docBaiTrongTrang, soTabSongSong_, docLinkViecTrongTrang, docTrangViecCongTy, timLinkTuyenDungTrongTrang };');
const F = globalThis.__nap;

let hong = 0;
const dat = (ten, ok, chiTiet) => {
  console.log(`${ok ? 'DAT ' : 'HONG'} ${ten}${chiTiet ? ' — ' + chiTiet : ''}`);
  if (!ok) hong++;
};

const neo = (href, chu) => ({
  href, innerText: chu, textContent: chu,
  getAttribute: () => null, parentElement: null
});

function dungTrang(ds, tieuDe = 'Nhóm của bạn | Facebook') {
  globalThis.document = {
    title: tieuDe,
    body: {},
    querySelectorAll: () => ds,
    querySelector: () => ds[0] || null
  };
  globalThis.window = { scrollBy: im, innerHeight: 800 };
  globalThis.getComputedStyle = () => ({ overflowY: 'visible' });
}

/* ---- 1. Lọc link nhóm ---- */
console.log('=== 1. Lấy danh sách nhóm đã tham gia ===');
dungTrang([
  neo('https://www.facebook.com/groups/1234567890', 'Việc làm ca đêm TP.HCM'),
  neo('https://www.facebook.com/groups/vieclamhocmon', 'Việc làm Hóc Môn - Củ Chi'),
  neo('https://www.facebook.com/groups/1234567890', 'Việc làm ca đêm TP.HCM'),          // trùng
  neo('https://www.facebook.com/groups/feed/', 'Bảng feed nhóm'),                        // trang hệ thống
  neo('https://www.facebook.com/groups/joins/', 'Nhóm của bạn'),                         // trang hệ thống
  neo('https://www.facebook.com/groups/discover/', 'Khám phá'),                          // trang hệ thống
  neo('https://www.facebook.com/groups/1234567890/posts/999', 'một bài viết'),           // link bài, không phải nhóm
  neo('https://www.facebook.com/marketplace/', 'Chợ'),                                    // không phải nhóm
  neo('https://www.facebook.com/groups/9999', '')                                        // không có tên
]);
const nhom = F.docDanhSachNhomTrongTrang();
dat('Chỉ lấy đúng link nhóm gốc', nhom.length === 2, nhom.map((n) => n.link.split('/').pop()).join(', '));
dat('Bỏ trang hệ thống (feed/joins/discover)', !nhom.some((n) => /feed|joins|discover/.test(n.link)));
dat('Bỏ link bài viết', !nhom.some((n) => n.link.includes('/posts/')));
dat('Không lấy trùng', new Set(nhom.map((n) => n.link)).size === nhom.length);
dat('Có kèm tên nhóm', nhom.every((n) => n.ten && n.ten.length > 2), nhom.map((n) => n.ten).join(' | '));

/* ---- 2. Bóc bài trong nhóm: chỉ lấy tin tuyển dụng, bỏ bình luận ---- */
console.log('\n=== 2. Bóc bài trong nhóm ===');
const baiThat = ['Nguyễn Văn A', '3 giờ', 'TUYỂN BẢO VỆ CA ĐÊM',
  'Ca 18h - 6h sáng, lương 7.500.000/tháng', 'Địa chỉ: 12 Quang Trung, Gò Vấp',
  'Liên hệ Zalo 090xxxx để được tư vấn thêm nhé cả nhà', 'Thích', 'Trả lời', 'Chia sẻ', '12 bình luận'].join('\n');
const binhLuan = ['Bảo Ngọc', '11 giờ', 'dạ em xin JD job service nha anh.', 'Trả lời', 'Chia sẻ'].join('\n');
const tanGau = ['Trần Thị B', '2 giờ', 'Hôm nay trời đẹp quá cả nhà ơi, ai đi cà phê không nào, mình rảnh cả buổi chiều nay nhé', 'Thích'].join('\n');

const theBai = (chu, href, trongBai) => {
  const o = {
    innerText: chu,
    querySelector: () => (href ? neo(href, 'xem bài') : null),
    parentElement: null
  };
  if (trongBai) o.parentElement = { closest: (sel) => (sel === 'div[role="article"]' ? {} : null) };
  else o.parentElement = { closest: () => null };
  return o;
};

globalThis.document = {
  title: 'Việc làm ca đêm TP.HCM | Facebook',
  body: {},
  querySelectorAll: () => [
    theBai(baiThat, 'https://www.facebook.com/groups/123/posts/555?comment_id=1', false),
    theBai(binhLuan, 'https://www.facebook.com/groups/123/posts/555', true),    // bình luận: lồng trong bài
    theBai(binhLuan, 'https://www.facebook.com/groups/123/posts/777', false),   // ngắn + không giống tin
    theBai(tanGau, 'https://www.facebook.com/groups/123/posts/888', false)      // tán gẫu: đủ dài nhưng không phải tin
  ],
  querySelector: () => null
};
globalThis.window = { scrollBy: im, innerHeight: 800 };
const kq = F.docBaiTrongTrang(25);
const bai = kq.bai;
dat('Chỉ giữ đúng tin tuyển dụng', bai.length === 1, bai.length + ' tin, bỏ ' + kq.bo + ' đoạn');
dat('Bỏ bình luận lồng trong bài', !bai.some((b) => /xin JD/.test(b.chu)));
dat('Bỏ đoạn tán gẫu không phải tin tuyển', !bai.some((b) => /cà phê/.test(b.chu)));
dat('Cắt dòng giao diện Thích / Trả lời / Chia sẻ',
  bai[0] && !/(^|\n)(Thích|Trả lời|Chia sẻ|12 bình luận)(\n|$)/.test(bai[0].chu));
dat('Bỏ luôn dòng tên người đăng khỏi nội dung', bai[0] && !bai[0].chu.startsWith('Nguyễn Văn A'));
dat('Có đếm lý do bỏ (bình luận / quá ngắn / không phải tin)', kq.lyDo && kq.lyDo.longNhau === 1 && (kq.lyDo.ngan + kq.lyDo.khongTuyen) === 2,
  JSON.stringify(kq.lyDo));

/* Nới 15/09 tối: bài ngắn kiểu nhóm + bài không có link vẫn phải lấy được */
globalThis.location = { href: 'https://www.facebook.com/groups/123?ref=x' };
globalThis.document = {
  title: 'Việc làm ca đêm TP.HCM | Facebook', body: {},
  querySelectorAll: () => [
    theBai(['Lê C', '2 giờ', 'Cần 2 bảo vệ ca đêm Q12, 7tr, LH 0909123456'].join('\n'), null, false),     // ngắn 43 chữ, KHÔNG có link
    theBai(['Trần D', '1 giờ', 'Tìm phục vụ ca tối 18h-23h quán Gò Vấp, bao ăn, lương 25k/giờ, ib zalo'].join('\n'), null, false)
  ],
  querySelector: () => null
};
const kqNgan = F.docBaiTrongTrang(25);
dat('Bài ngắn kiểu nhóm ("Cần 2 bảo vệ…", "Tìm phục vụ…") vẫn được lấy', kqNgan.bai.length === 2, kqNgan.bai.length + ' bài, lý do bỏ: ' + JSON.stringify(kqNgan.lyDo));
dat('Không có link thì dựng mã tạm trỏ về nhóm, không vứt bài',
  kqNgan.bai.every((b) => b.link.startsWith('https://www.facebook.com/groups/123#bai-')) && kqNgan.lyDo.khongLink === 2);
dat('Mã tạm hai bài khác nhau', new Set(kqNgan.bai.map((b) => b.id)).size === 2);
dat('Link bỏ được đuôi tham số', bai[0] && bai[0].link === 'https://www.facebook.com/groups/123/posts/555', bai[0] && bai[0].link);
dat('Lấy đúng tên người đăng', bai[0] && bai[0].tacGia === 'Nguyễn Văn A');
const lech = bai[0] && bai[0].luc ? Math.abs((Date.now() - Date.parse(bai[0].luc)) / 3600000 - 3) : 99;
dat('Đổi "3 giờ" thành mốc thời gian đúng', lech < 0.05, bai[0] && bai[0].luc);
dat('Giữ nguyên nội dung tin', bai[0] && bai[0].chu.includes('7.500.000'));
dat('Lấy tên nhóm từ tiêu đề trang', bai[0] && bai[0].nhom === 'Việc làm ca đêm TP.HCM');


/* ---- 2b. Ba dòng rác thật user gửi 15/09/2026 ---- */
console.log('\n=== 2b. Ba ca rác thật ===');
const caRac = [
  ['bình luận xin JD', 'dạ em xin JD job service nha anh. Trả lời Chia sẻ dạ em cảm ơn anh nhiều ạ, em mong được phản hồi sớm'],
  ['bình luận hỏi zalo', 'E k rep đc ạ ib zl0383154301 Thích Trả lời Chia sẻ em nhắn tin mãi mà không thấy trả lời gì hết ạ'],
  ['bài người đi xin việc', 'mình học quản trị khách sạn tốt nghiệp cũng loại ổn ổn, đợt đó đi xin việc khách sạn A giấu tên lương cơ bản 8tr cùng chế độ đãi ngộ khá ổn nhưng mà mình thấy công việc hơi áp lực']
];
caRac.push(['câu hỏi có chữ "tuyển" của người xin việc', 'ai biết chỗ nào tuyển bảo vệ đêm không ạ, em cần việc gấp lắm, ai biết chỉ em với']);
const caThat = [
  ['tin tuyển bảo vệ', 'TUYỂN BẢO VỆ CA ĐÊM làm việc tại Gò Vấp, ca 18h-6h sáng, lương 7.500.000/tháng, bao cơm một bữa, liên hệ Zalo 090xxx'],
  ['tin cần 2 bạn phục vụ', 'Cần 2 bạn phục vụ ca tối 17h-23h nhà hàng quận 1, 25k/giờ, bao ăn, ib zalo 0909xxx để phỏng vấn ngay trong tuần này'],
  ['tin tuyển buồng phòng', 'Khách sạn cần tuyển gấp nhân viên buồng phòng housekeeping ca đêm, lương 8-9 triệu, bao ăn ở, làm việc tại quận 3']
];
const doLoc = (chu) => {
  globalThis.document = {
    title: 'Nhóm thử | Facebook', body: {},
    querySelectorAll: () => [{
      innerText: 'Người Đăng' + String.fromCharCode(10) + '3 giờ' + String.fromCharCode(10) + chu,
      querySelector: () => neo('https://www.facebook.com/groups/1/posts/2', 'x'),
      parentElement: { closest: () => null }
    }],
    querySelector: () => null
  };
  return F.docBaiTrongTrang(25).bai.length;
};
caRac.forEach(([ten, chu]) => dat('Loại: ' + ten, doLoc(chu) === 0));
caThat.forEach(([ten, chu]) => dat('Giữ: ' + ten, doLoc(chu) === 1));

/* ---- 3. Trang kết quả tìm nhóm công khai ---- */
console.log('\n=== 3. Tìm nhóm công khai theo từ khoá ===');
dungTrang([
  neo('https://www.facebook.com/groups/501122334455/?ref=group_browse', 'Việc làm Buồng phòng - Housekeeping TP.HCM'),
  neo('https://www.facebook.com/groups/nhahangkhachsanhcm/', 'Tuyển dụng Nhà hàng - Khách sạn Sài Gòn'),
  neo('https://www.facebook.com/groups/501122334455?ref=search', 'Việc làm Buồng phòng - Housekeeping TP.HCM'),
  neo('https://www.facebook.com/search/groups/?q=buong+phong', 'kết quả tìm kiếm'),
  neo('https://www.facebook.com/groups/create/', 'Tạo nhóm mới')
], 'Tìm kiếm | Facebook');
const timThay = F.docDanhSachNhomTrongTrang();
dat('Lấy được nhóm từ trang tìm kiếm', timThay.length === 2, timThay.map((n) => n.ten.slice(0, 32)).join(' | '));
dat('Link có đuôi ?ref= vẫn nhận đúng', timThay.some((n) => n.link === 'https://www.facebook.com/groups/501122334455'));
dat('Bỏ link trang tìm kiếm và trang tạo nhóm', !timThay.some((n) => /search|create/.test(n.link)));

/* ---- 4. Xếp ưu tiên buồng phòng / nhà hàng ---- */
console.log('\n=== 4. Ưu tiên buồng phòng · nhà hàng · khách sạn ===');
const nguonTC = fs.readFileSync(path.join(DIR, 'tien-ich-fb', 'tuychon.js'), 'utf8');
const dauTC = nguonTC.slice(0, nguonTC.indexOf('let dsNhom'));
globalThis.document = { getElementById: () => null };
(0, eval)(dauTC + '\n;globalThis.__tc = { laUuTien, laViec };');
const T = globalThis.__tc;
dat('Nhận nhóm buồng phòng', T.laUuTien('Việc làm Buồng phòng - Housekeeping TP.HCM') === true);
dat('Nhận nhóm nhà hàng / khách sạn', T.laUuTien('Tuyển dụng Nhà hàng - Khách sạn Sài Gòn') === true);
dat('Nhận nhóm housekeeping viết tiếng Anh', T.laUuTien('HOUSEKEEPING JOBS VIETNAM') === true);
dat('Nhóm việc làm chung không bị coi là ưu tiên',
  T.laUuTien('Việc làm thời vụ TP.HCM') === false && T.laViec('Việc làm thời vụ TP.HCM') === true);
dat('Nhóm không liên quan bị bỏ ra rìa',
  T.laUuTien('Hội yêu mèo Sài Gòn') === false && T.laViec('Hội yêu mèo Sài Gòn') === false);

/* ---- 5. Trần số tab mở cùng lúc ---- */
console.log('\n=== 5. Trần số tab mở cùng lúc ===');
dat('Để trống thì về mặc định 2', F.soTabSongSong_('') === 2 && F.soTabSongSong_(0) === 2);
dat('Giữ nguyên số hợp lệ', F.soTabSongSong_(15) === 15);
dat('Chặn trần ở 20', F.soTabSongSong_(200) === 20, 'gõ 200 → ' + F.soTabSongSong_(200));
dat('Số âm hoặc chữ vẫn an toàn', F.soTabSongSong_(-5) === 1 && F.soTabSongSong_('abc') === 2);

/* ---- 6. Trang tuyển dụng công ty: gom link việc + đọc trang việc ---- */
console.log('\n=== 6. Trang tuyển dụng công ty (đọc bằng trình duyệt) ===');
globalThis.location = { origin: 'https://tuyendung.kingfoodmart.com', href: 'https://tuyendung.kingfoodmart.com/' };
const a = (href, chu) => ({ getAttribute: () => href, innerText: chu });
globalThis.document = {
  querySelectorAll: () => [
    a('/chi-tiet-viec-lam/2/security-nhan-vien-an-ninh-sieu-thi-668e4b85', 'Security - Nhân viên an ninh siêu thị'),
    a('/chi-tiet-viec-lam/5/nhan-vien-thu-ngan-ca-toi-7712aa', 'Nhân viên thu ngân ca tối'),
    a('/chi-tiet-viec-lam/2/security-nhan-vien-an-ninh-sieu-thi-668e4b85?utm=x', 'Xem chi tiết'),  // trùng, chỉ khác đuôi
    a('/', 'Trang chủ'),
    a('/dang-nhap', 'Đăng nhập'),
    a('/tuyen-dung?page=2', 'Trang 2'),
    a('https://www.facebook.com/kingfoodmart', 'Facebook'),
    a('/tin-tuc/khai-truong-sieu-thi-moi', 'Khai trương siêu thị mới')                  // tin tức, không phải việc
  ],
  querySelector: () => null, title: 'x', body: { innerText: '' }
};
const linkViec = F.docLinkViecTrongTrang();
dat('Gom đúng 2 link việc', linkViec.length === 2, linkViec.map((l) => l.link.split('/').pop().slice(0, 30)).join(' | '));
dat('Bỏ trang chủ, đăng nhập, phân trang, Facebook, tin tức',
  !linkViec.some((l) => /dang-nhap|page=|facebook|tin-tuc/.test(l.link) || l.link === location.origin));
dat('Link trùng khác đuôi ?utm chỉ tính một lần', new Set(linkViec.map((l) => l.link)).size === linkViec.length);
dat('Giữ tên việc dễ đọc thay cho "Xem chi tiết"', linkViec.some((l) => /an ninh siêu thị/i.test(l.ten)));

globalThis.document = {
  querySelector: (sel) => (sel === 'h1' ? { innerText: ' Security - Nhân viên an ninh siêu thị ' } : (sel.startsWith('main') ? { innerText: 'Mô tả\nCa 3: 22h-6h\n\n\nỨng viên Nam làm xoay ca (tối đa 2 ca đêm/tuần).\nx' } : null)),
  title: 'Security | Kingfoodmart', body: { innerText: '' }
};
const trangViec = F.docTrangViecCongTy();
dat('Lấy tên việc từ h1', trangViec.ten === 'Security - Nhân viên an ninh siêu thị', trangViec.ten);
dat('Lấy chữ chính, bỏ dòng trống', trangViec.chu.includes('22h-6h') && !/\n\n/.test(trangViec.chu));

/* ---- 7. Trang chủ công ty: tự dò nút "Tuyển dụng" ---- */
console.log('\n=== 7. Tự dò nút Tuyển dụng trên trang chủ ===');
globalThis.location = { origin: 'https://www.highlandscoffee.com.vn', href: 'https://www.highlandscoffee.com.vn/vn/' };
globalThis.document = {
  querySelectorAll: () => [
    a('/vn/', 'Trang chủ'),
    a('/vn/thuc-don.html', 'Thực đơn'),
    a('/vn/co-hoi-nghe-nghiep.html', 'Cơ hội nghề nghiệp'),
    a('https://www.facebook.com/highlandscoffeevietnam', 'Tuyển dụng trên Facebook'),   // mạng xã hội: bỏ
    a('/vn/lien-he.html', 'Liên hệ')
  ],
  querySelector: () => null, title: 'x', body: { innerText: '' }
};
const cua = F.timLinkTuyenDungTrongTrang();
dat('Tìm ra đúng nút tuyển dụng', cua[0] === 'https://www.highlandscoffee.com.vn/vn/co-hoi-nghe-nghiep.html', cua.join(' | '));
dat('Không đi lạc sang Facebook/Zalo', !cua.some((u) => /facebook|zalo/.test(u)));
dat('Không trả về chính trang đang xem', !cua.some((u) => u.replace(/\/$/, '') === 'https://www.highlandscoffee.com.vn/vn'));

console.log('\n' + (hong ? 'KET QUA: HONG ' + hong + ' muc' : 'KET QUA: TAT CA DAT'));
process.exit(hong ? 1 : 0);
