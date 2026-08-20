/**
 * qc-mobile-toan-du-an.mjs — MỞ LINK LIVE bằng máy mô phỏng iOS + Android, rà bố cục TOÀN BỘ
 * dashboard (mọi tab + mọi pop-up mở được), rồi báo cáo chỗ nào vỡ.
 *
 *  VÌ SAO (người dùng chốt 20/08/2026): "QC toàn bộ dự án mô phỏng mở link ở cả android và ios".
 *  Trước đây mỗi lần chỉ ngó đúng chỗ vừa sửa, nên lỗi bố cục ở tab KHÁC không ai biết cho tới khi
 *  người dùng mở điện thoại thật. Tệp này đo BẰNG MÁY, đo HẾT, và đo trên bản ĐANG PHÁT (link live)
 *  chứ không phải file trên đĩa — vì bản live mới là bản người dùng thấy.
 *
 *  KHÁC `qc-tvt-mobile.mjs`: tệp kia đo SÂU một mục (18 ca đặc tả riêng cho pop-up Tồn tại vị trí).
 *  Tệp này đo RỘNG: một bộ luật CHUNG áp cho mọi màn, tự tìm ra phần tử vi phạm — nhờ vậy tab mới
 *  thêm sau này cũng được canh mà không phải viết thêm ca nào.
 *
 *  TÁM LUẬT CHUNG (rút ra từ những lần vỡ thật, xem memory qc-bo-cuc-dien-thoai):
 *    ① Trang KHÔNG được kéo ngang. Cuộn ngang chỉ được phép BÊN TRONG khung tự khai
 *       `overflow-x:auto` (bảng rộng), không được để cả trang trôi.
 *    ② Không phần tử nào tràn khỏi mép phải màn hình (trừ phần tử nằm trong khung cuộn ngang nói trên).
 *    ③ Không "bảng bóp": ô có chữ vỡ ≥4 dòng mà bề rộng <120px — đây là bệnh làm chữ xếp dọc
 *       ("V ả i  s i n g…"), đã gặp thật ở pop-up Tồn tại vị trí (cột tên hàng bị bóp còn 90px).
 *    ④ Vùng chạm của control CHÍNH (nút đóng pop-up, nút bộ lọc, nút chính) ≥40px — đo VÙNG BẤM
 *       THẬT, không đo cái hộp (hộp kiểm gốc 15-22px, CSS không nới được).
 *    ⑤ Không "số mồ côi": trong chế độ THẺ thì thead ẩn, ô thuần số mà không nhãn là số vô nghĩa.
 *    ⑥ Nhãn phải đọc được: chữ <10px là quá nhỏ trên máy cầm tay (bỏ qua phần tử chỉ có ký hiệu).
 *    ⑦ Nhãn KHÔNG bị cắt bởi ellipsis ("TỔ…" thì con số bên cạnh thành vô nghĩa).
 *    ⑧ Cụm control không RĂNG CƯA: thanh điều khiển wrap ≥4 hàng, hoặc chiếm >1/4 màn, là lộn xộn.
 *
 *  node qc-mobile-toan-du-an.mjs                 (mặc định: cả 2 dashboard, 4 máy)
 *  node qc-mobile-toan-du-an.mjs --may=ios       (chỉ iOS · hoặc --may=android)
 *  node qc-mobile-toan-du-an.mjs --trang=factory (chỉ 1 dashboard · hoặc --trang=5s)
 *  node qc-mobile-toan-du-an.mjs --file          (đọc file trên đĩa thay vì link live — soi bản chưa đẩy)
 */
import path from "node:path"; import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer";
import { EDGE_PATH } from "./token-store.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, ".exports", "qc-mobile-toan-du-an");
fs.mkdirSync(OUT, { recursive: true });
const ARG = process.argv.slice(2).join(" ");
const cd = (k) => (ARG.match(new RegExp("--" + k + "=([\\w-]+)")) || [])[1] || "";
const DUNG_FILE = /--file/.test(ARG);
const LOC_MAY = cd("may").toLowerCase(), LOC_TRANG = cd("trang").toLowerCase();

/* ---------- Máy mô phỏng ------------------------------------------------------------------------
 * UA thật quan trọng, không chỉ bề rộng: trang có nhánh rẽ theo `matchMedia`, và Safari iOS xử lý
 * `-webkit-line-clamp` / `100dvh` / sticky khác Chrome Android. Đặt cả `platform` để `navigator`
 * nhất quán (một số thư viện dò iOS bằng platform chứ không bằng UA).
 * Bề rộng chọn theo MÁY THẬT hay gặp, có cả đầu HẸP NHẤT (360px Android, 375px iPhone SE) — chỗ
 * hẹp nhất mới là chỗ vỡ. */
const UA_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const UA_AND = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const MAY = [
  { ten: "iPhone SE (375×667)", he: "ios", w: 375, h: 667, dsf: 2, ua: UA_IOS, plat: "iPhone" },
  { ten: "iPhone 14 (390×844)", he: "ios", w: 390, h: 844, dsf: 3, ua: UA_IOS, plat: "iPhone" },
  { ten: "Android hẹp (360×800)", he: "android", w: 360, h: 800, dsf: 3, ua: UA_AND, plat: "Linux armv8l" },
  { ten: "Pixel 7 (412×915)", he: "android", w: 412, h: 915, dsf: 2.6, ua: UA_AND, plat: "Linux armv8l" },
].filter((m) => !LOC_MAY || m.he === LOC_MAY);

/* ---------- Trang + các màn phải đi qua --------------------------------------------------------
 * `moMan` chạy TRONG trang: trả về true nếu mở được màn đó, false nếu màn không có dữ liệu để mở
 * (vd chưa có UID sai vị trí thì không có pop-up nào) — false thì BỎ QUA, không tính là lỗi.
 * `dong` đóng lại để về trạng thái sạch cho màn kế. */
const TRANG = [
  {
    ma: "factory", ten: "Audit Factory",
    live: "https://letam0317.github.io/stocklocationfactory/",
    file: path.resolve(DIR, "..", "factory", "index.html"),
    sanSang: "() => typeof showTab === 'function' && typeof HOME_MUC !== 'undefined'",
    man: [
      /* `sanSangMan` = điều kiện "tab này đã VẼ XONG dữ liệu thật". BẮT BUỘC phải có, không thì bộ đo
         chụp đúng lúc tab còn là skeleton — mà skeleton thì luật nào cũng đạt (không chữ nên không
         cắt, không control nên không răng cưa). Đây là lý do lượt trước bộ đo báo tab Kiểm kê SẠCH
         trong khi thanh lọc thật đang vỡ 6 hàng cao 222px.
         ⚠ Điều kiện phải bám CON SỐ THẬT, không bám sự tồn tại của phần tử: skeleton dùng CHÍNH
         class thật (`.ks`, `.card`, `.abntile`) nên "đếm phần tử > 0" vẫn đúng khi màn còn xám —
         đã dính đúng bẫy này ở bản trước. Nên điều kiện là "có ô nào chứa CHỮ SỐ". */
      { ten: "Tổng quan", mo: "() => { showTab('home'); return true; }",
        sanSangMan: "() => document.querySelectorAll('#viewHome .hm-t').length > 0" },
      { ten: "Trạng thái lưu trữ", mo: "() => { showTab('stock'); return true; }",
        sanSangMan: "() => [...document.querySelectorAll('#viewStock .card .k')].some(x => /\\d/.test(x.textContent))" },
      { ten: "Kiểm kê", mo: "() => { showTab('kk'); return true; }",
        /* Phải chờ ĐỦ BA thứ: dải chỉ số, ô lọc, VÀ chip kho. Bản trước thiếu chip kho nên đo lúc
           thanh còn ngắn ⇒ tab báo ĐẠT trong khi cùng thanh đó bị pop-up bắt là 215px/5 hàng. Cùng
           một thanh mà hai kết luận trái nhau thì lỗi ở điều kiện chờ, không ở thanh. */
        sanSangMan: "() => [...document.querySelectorAll('#viewKK .kkstrip .ks .v')].some(x => /\\d/.test(x.textContent)) && document.querySelectorAll('#kkFilters .fld').length > 0 && document.querySelectorAll('#kkWhBar .kktab').length > 0" },
      { ten: "Tồn kho bất thường", mo: "() => { showTab('abn'); return true; }",
        sanSangMan: "() => [...document.querySelectorAll('#viewAbn .abntile .k')].some(x => /\\d/.test(x.textContent))" },
      { ten: "Planogram", mo: "() => { showTab('plg'); return true; }",
        sanSangMan: "() => document.querySelectorAll('#viewPlg .pg-whbar *').length > 0" },
      { ten: "Nhận diện SKU", mo: "() => { showTab('sku'); return true; }",
        sanSangMan: "() => !!document.getElementById('ndsMa')" },
      { ten: "Pop-up Kiểm kê (theo SKU)", cho: "#kkmodal.show",
        mo: "() => { showTab('kk'); const t=document.querySelector('#kkWrap .ks,.ks'); if(!t) return false; t.click(); return true; }",
        dong: "() => { try{ closeKkModal(); }catch(e){} }" },
      { ten: "Pop-up Bất thường (tất cả SKU)", cho: "#abnmodal.show",
        mo: "() => { showTab('abn'); if(typeof ABN==='undefined'||!ABN.ok) return false; abnOpenAll(); return true; }",
        dong: "() => { try{ closeAbnModal(); }catch(e){} }" },
      { ten: "Pop-up Bất thường (1 kho)", cho: "#abnmodal.show",
        mo: "() => { showTab('abn'); if(typeof ABN==='undefined'||!ABN.ok||!ABN.rows.length) return false; abnOpenWh(ABN.rows[0].wh); return true; }",
        dong: "() => { try{ closeAbnModal(); }catch(e){} }" },
      { ten: "Pop-up Tồn tại vị trí", cho: "#tvtmodal.show",
        mo: "() => { showTab('abn'); if(typeof TVT==='undefined'||!TVT.ok) return false; const d={}; tvtRowsInScope().forEach(r=>d[r.loc]=(d[r.loc]||0)+1); const k=Object.keys(d).sort((a,b)=>d[b]-d[a])[0]; if(!k) return false; tvtOpenLoc(k); return true; }",
        dong: "() => { try{ closeTvtModal(); }catch(e){} }" },
    ],
  },
  {
    ma: "5s", ten: "Kiểm soát kho 5S",
    live: "https://letam0317.github.io/kiemsoatkho/",
    file: path.resolve(DIR, "kiemsoatkho", "index.html"),
    sanSang: "() => typeof setTab === 'function' && typeof TAB_DEFS !== 'undefined'",
    /* Tab của dashboard 5S render ĐỘNG theo công ty đang chọn (Dynamic Contextual Tabs) nên KHÔNG
       khai cứng danh sách: đọc thẳng `.tab[data-tab]` đang có trên thanh, ai thêm tab mới thì bộ đo
       tự đi qua. `viTri` là chỉ số nút trên thanh. */
    manDong: "() => [...document.querySelectorAll('#tabsNav .tab[data-tab]')].map(b => b.getAttribute('data-tab') + '|' + b.textContent.trim())",
    /* POP-UP của dashboard 5S — BỔ SUNG 21/08/2026 sau khi người dùng chỉ ra pop-up "Tồn kho bất
       thường" bên Audit Hasaki còn nguyên bảng 12 cột. Lỗ hổng gốc: bộ đo chỉ đi các TAB của
       dashboard này (manDong) và KHÔNG BAO GIỜ mở pop-up nào — nên cả một nửa giao diện chưa từng
       được đo, mà tôi vẫn báo "sạch toàn dự án". Nay pop-up nào mở được bằng API của module thì phải
       đi qua. `man` chạy SAU danh sách tab động. */
    man: [
      { ten: "Pop-up Bất thường (tất cả SKU)", cho: "#htModal.show",
        mo: "() => { setTab('htonbat'); if (!window.HTONBAT || typeof HTONBAT.openAll !== 'function') return false; HTONBAT.openAll(); return true; }",
        sanSangMan: "() => [...document.querySelectorAll('#htMBody td')].some(x => /\\d/.test(x.textContent))",
        dong: "() => { try { HTONBAT.closeModal(); } catch(e) { const m=document.getElementById('htModal'); if(m) m.classList.remove('show'); } }" },
      { ten: "Pop-up Bất thường (1 loại)", cho: "#htModal.show",
        mo: "() => { setTab('htonbat'); if (!window.HTONBAT || typeof HTONBAT.openType !== 'function') return false; HTONBAT.openType('uid_temp'); return true; }",
        sanSangMan: "() => [...document.querySelectorAll('#htMBody td')].some(x => /\\d/.test(x.textContent))",
        dong: "() => { try { HTONBAT.closeModal(); } catch(e) { const m=document.getElementById('htModal'); if(m) m.classList.remove('show'); } }" },
    ],
  },
].filter((t) => !LOC_TRANG || t.ma === LOC_TRANG);

/* ---------- Bộ rà bố cục (chạy trong trang) ----------------------------------------------------
 * HÀM THẬT, KHÔNG PHẢI CHUỖI. Bản đầu viết dạng template literal và dính bẫy nặng: trong template
 * literal, `\d` `\s` `\p{L}` bị rụng dấu gạch chéo ⇒ regex `/^[\d.,%\-\s]+$/` tới trình duyệt
 * thành `/^[d.,%-s]+$/`, mà `%-s` là DẢI ký tự 0x25→0x73 trùm cả chữ số lẫn chữ cái — nên "In-BIN"
 * cũng bị coi là "ô thuần số" và bộ đo báo mồ côi hàng loạt ô đang có nhãn tử tế.
 * puppeteer nhận thẳng hàm cho page.evaluate, nên truyền hàm là hết cả họ lỗi này, lại được
 * `node --check` soi cú pháp và dùng backtick trong ghi chú thoải mái.
 * Dùng chung cho mọi màn, mọi máy.
 * Điểm quan trọng: BỎ QUA phần tử nằm trong khung tự khai `overflow-x:auto/scroll` — bảng rộng
 * cuộn ngang trong khung là cách chữa HỢP LỆ (pop-up Kiểm kê đang đi đường này), không phải lỗi.
 * Nếu không trừ, bộ rà sẽ báo hàng trăm "tràn" giả và thành vô dụng. */
function raSoat() {
  const de = document.documentElement, W = de.clientWidth;
  const thay = (el) => { const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden'; };
  const trongKhungCuon = (el) => { for (let p = el.parentElement; p && p !== de; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX; if (ox === 'auto' || ox === 'scroll') return true; } return false; };
  const ten = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
    (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  /* Số dòng chữ THẬT: gom rect của Range theo tâm dọc. Hai bẫy đã dính (giữ lại để đừng đo lại
     kiểu cũ): (a) chiều cao ô / line-height là đo chiều cao HÀNG vì td vertical-align:top;
     (b) đếm số rect thì sai vì 1 dòng sinh nhiều rect khi ô có phần tử con. */
  const soDong = (el) => { if (!el || !el.firstChild) return 0;
    const r = document.createRange(); r.selectNodeContents(el);
    const rc = [...r.getClientRects()].filter((x) => x.height > 1 && x.width > 1);
    if (!rc.length) return 0;
    const tam = rc.map((x) => x.top + x.height / 2).sort((a, b) => a - b);
    const cao = Math.max(...rc.map((x) => x.height));
    let n = 1; for (let i = 1; i < tam.length; i++) if (tam[i] - tam[i - 1] > cao * 0.7) n++;
    return n; };

  const tran = [], bop = [], cham = [], chuNho = [];
  /* ② Tràn mép phải/trái màn hình */
  for (const el of document.querySelectorAll('body *')) {
    if (!thay(el)) continue;
    const r = el.getBoundingClientRect();
    if ((r.right > W + 1 || r.left < -1) && !trongKhungCuon(el) && r.width <= W * 3)
      tran.push({ el: ten(el), phai: Math.round(r.right - W), trai: Math.round(r.left), rong: Math.round(r.width) });
  }
  /* ③ "Bảng bóp": ô hẹp mà chữ vỡ nhiều dòng. Chỉ xét ô bảng + ô thẻ có chữ. */
  for (const el of document.querySelectorAll('td,th,.pn,.pn2')) {
    if (!thay(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width >= 120) continue;
    const txt = (el.textContent || '').trim();
    if (txt.length < 12) continue;                       // ô ngắn (số, mã) hẹp là bình thường
    const n = soDong(el);
    if (n >= 4) bop.push({ el: ten(el), rong: Math.round(r.width), dong: n, chu: txt.slice(0, 26) });
  }
  /* ④ Vùng chạm của control CHÍNH. Chip lọc nhỏ là cố ý (mật độ thông tin), nên chỉ soi nhóm
     "bắt buộc bấm được": nút đóng pop-up, nút mở bộ lọc, nút hành động chính, ô tick trong bảng.
     ⚠ ĐO VÙNG BẤM THẬT, KHÔNG ĐO CÁI HỘP: hộp kiểm gốc luôn 15-22px và CSS không nới được, nên với
     .pcr/.pcall thì vùng bấm thật là Ô '.pcc' chứa nó — với điều kiện ô đó CÓ bắt chạm (listener
     pcCellTap). Nếu đo cái input thì mọi dashboard trên đời đều "đỏ" và bộ đo thành vô dụng; nếu đo
     ô mà ô không bắt chạm thì lại "xanh" giả. Nên: lấy ô, và chỉ lấy khi ô thật sự bấm được. */
  const oBamDuoc = (el) => { const td = el.closest && el.closest('td.pcc,th.pcc,label');
    if (!td) return null;
    if (/^(TD|TH)$/.test(td.tagName) && !document.body.dataset.pccTap) return null;
    return td; };
  const CT = '.modalhd .mclose, .mfbtn, .mfok, .prfoot button, .pcall, td .pcr, .pin-acts button';
  for (const el of document.querySelectorAll(CT)) {
    if (!thay(el)) continue;
    const dich = (el.matches('.pcr,.pcall') && oBamDuoc(el)) || el;
    const r = dich.getBoundingClientRect();
    const c = Math.round(Math.min(r.width, r.height));
    if (c < 40) cham.push({ el: ten(el) + (dich !== el ? ' (vùng ' + ten(dich) + ')' : ''), co: c });
  }
  /* ⑤ SỐ MỒ CÔI trong thẻ: khi dòng bảng đã đổi sang THẺ thì 'thead' ẩn, nên ô chỉ chứa con số mà
     không có nhãn nào (::before rỗng, không có phần tử nhãn bên trong) là con số KHÔNG AI BIẾT LÀ GÌ.
     Đã gặp thật 2 lần: pop-up in tem (ô Số lượng trống nhãn) và thẻ Bất thường (ô "Tồn" hiện số 0
     trần ở góc phải). Số đo bố cục KHÔNG bắt được lỗi này — phải soi ảnh mới thấy — nên đưa thành
     luật ở đây để lần sau máy bắt hộ. */
  const moCoi = [];
  for (const tr of document.querySelectorAll('.modal tbody tr')) {
    if (!thay(tr)) continue;
    const d = getComputedStyle(tr).display;
    if (d !== 'flex' && d !== 'grid' && d !== 'block') continue;    // chỉ xét chế độ THẺ
    /* Ô TIÊU ĐỀ THẺ (chữ to nhất hàng) được MIỄN: nó là cái tên của thẻ — SKU/UID — nhìn là biết,
       dán thêm nhãn "SKU" lên chữ 15px chỉ làm rối. Chỉ những con số PHỤ mới cần nhãn. */
    const cos = [...tr.children].filter((x) => thay(x)).map((x) => parseFloat(getComputedStyle(x).fontSize) || 0);
    const coMax = Math.max.apply(null, cos.concat([0]));
    for (const td of tr.children) {
      if (!thay(td) || td.hasAttribute('colspan')) continue;
      const t = (td.textContent || '').trim();
      if (!t || !/^[\d.,%\-\s]+$/.test(t)) continue;                 // chỉ xét ô THUẦN SỐ
      if ((parseFloat(getComputedStyle(td).fontSize) || 0) >= coMax) continue;   // ô tiêu đề thẻ
      /* getComputedStyle KHÔNG phân giải attr() trong 'content' — Chrome trả nguyên chuỗi
         'attr(data-lb) " "'. Bản đầu vì thế báo mồ côi cả những ô ĐANG CÓ nhãn (abav, abty).
         Phải tự thay attr(x) bằng giá trị thuộc tính rồi mới xét có chữ hay không. */
      let truoc = getComputedStyle(td, '::before').content || '';
      truoc = truoc.replace(/attr\(([^)]+)\)/g, (m, a) => td.getAttribute(a.trim()) || '');
      const coNhan = (truoc && truoc !== 'none' && truoc !== 'normal' && /[\p{L}]/u.test(truoc)) ||
        !!td.querySelector('label,.lb') ||
        /[\p{L}]/u.test((td.previousElementSibling && td.previousElementSibling.textContent) || '');
      if (!coNhan) moCoi.push({ el: ten(td), chu: t.slice(0, 14) });
    }
  }
  /* ⑧ NHÃN BỊ CẮT: `text-overflow:ellipsis` làm chữ mất đuôi. Con số còn đó mà nhãn thành "TỔ…"
     thì không ai biết nó là số gì — ĐO THẬT ở dải 6 chỉ số tab Kiểm kê trên màn 375px. Luật cũ không
     bắt được: không tràn, không bóp, và vẫn "có nhãn" nên không tính là mồ côi.
     Nhận diện: phần tử có ellipsis mà scrollWidth vượt clientWidth quá 8px ⇒ chữ thật sự bị cắt. */
  const cat = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!thay(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.textOverflow !== 'ellipsis') continue;
    if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') continue;
    const t = (el.textContent || '').trim();
    if (t.length < 4) continue;
    const thieu = el.scrollWidth - el.clientWidth;
    if (thieu > 8) cat.push({ el: ten(el), thieu, chu: t.slice(0, 22) });
  }
  /* ⑨ CỤM CONTROL RĂNG CƯA: một thanh điều khiển wrap thành nhiều hàng với các món lệch bề rộng
     nhìn ra một đống lộn xộn, và ăn hết phần đầu màn trước khi thấy số liệu. ĐO THẬT: thanh lọc tab
     Kiểm kê cao 222px / 6 hàng trên màn 375px.
     Nhận diện: thanh có >=4 món nhìn thấy xếp thành >=4 HÀNG (đếm số mốc `top` khác nhau), hoặc cao
     hơn 1/4 màn hình. Ngưỡng 4 hàng để 2-3 hàng ngay ngắn (kiểu 2 cột) vẫn được coi là ổn. */
  const rangCua = [];
  for (const bar of document.querySelectorAll('.kkbar,.mfilters,.pg-whbar,.nds-ctl')) {
    if (!thay(bar)) continue;
    const con = [...bar.querySelectorAll(':scope > *')].filter((x) => thay(x) &&
      getComputedStyle(x).display !== 'contents');
    /* `display:contents` không có hộp riêng ⇒ phải lấy CHÁU làm món thật, không thì đếm ra 1 con. */
    const mon = con.length >= 4 ? con : [...bar.querySelectorAll('.kktab,.fld,.mfbtn,button')].filter(thay);
    if (mon.length < 4) continue;
    const tops = [...new Set(mon.map((x) => Math.round(x.getBoundingClientRect().top / 6)))];
    const cao = Math.round(bar.getBoundingClientRect().height);
    if (tops.length >= 4 || cao > de.clientHeight / 4)
      rangCua.push({ el: ten(bar), hang: tops.length, cao, mon: mon.length,
        phanTramMan: Math.round(cao / de.clientHeight * 100) });
  }
  /* Chữ quá nhỏ để đọc trên điện thoại. Gom theo SELECTOR (không liệt kê từng phần tử) để sửa được
     bằng một rule, và bỏ qua phần tử ẩn/không có chữ thật. */
  const dem = {};
  for (const el of document.querySelectorAll('body *')) {
    if (!thay(el)) continue;
    if (!el.firstChild || el.firstChild.nodeType !== 3) continue;
    const txt2 = (el.textContent || '').trim();
    /* Chỉ tính CHỮ ĐỂ ĐỌC. Bỏ qua phần tử chỉ chứa ký hiệu (mũi tên ▼ của nút xổ, dấu ×, chấm •):
       một cái caret 9px không phải lỗi đọc được — bản đầu báo nó thành lỗi và suýt làm to caret lên
       cho vừa lòng bộ đo, tức sửa giao diện để test xanh chứ không phải để người dùng dễ đọc. */
    if (!/[\p{L}\p{N}]/u.test(txt2) || txt2.length < 2) continue;
    const fs2 = parseFloat(getComputedStyle(el).fontSize);
    if (!fs2 || fs2 >= 10) continue;
    const k = ten(el) + ' @' + fs2 + 'px';
    dem[k] = (dem[k] || 0) + 1;
  }
  Object.keys(dem).sort((a, b) => dem[b] - dem[a]).forEach((k) => chuNho.push({ el: k, n: dem[k] }));
  const gon = (a, n) => a.slice(0, n);
  const mcU = [...new Map(moCoi.map((x) => [x.el, x])).values()];
  const catU = [...new Map(cat.map((x) => [x.el, x])).values()];
  return { keoTrang: de.scrollWidth - W, W,
    cat: catU.slice(0, 6), nCat: catU.length,
    rangCua: rangCua.slice(0, 4), nRangCua: rangCua.length,
    tran: gon(tran, 6), nTran: tran.length,
    bop: gon(bop, 6), nBop: bop.length,
    cham: gon(cham, 6), nCham: cham.length,
    moCoi: gon(mcU, 5), nMoCoi: mcU.length,
    chuNho: gon(chuNho, 8), nChuNho: chuNho.length };
};

/* ---------- Chạy --------------------------------------------------------------------------------- */
let tongLoi = 0, tongMan = 0;
const bangKe = [];
const nghi = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await puppeteer.launch({ headless: "new", executablePath: EDGE_PATH,
  args: ["--no-sandbox", "--allow-file-access-from-files"] });

for (const may of MAY) {
  console.log("\n════ " + may.ten + "  [" + may.he.toUpperCase() + "] ════");
  for (const trang of TRANG) {
    const url = DUNG_FILE ? pathToFileURL(trang.file).href : trang.live;
    const p = await b.newPage();
    await p.setUserAgent(may.ua);
    await p.setViewport({ width: may.w, height: may.h, deviceScaleFactor: may.dsf, isMobile: true, hasTouch: true });
    await p.evaluateOnNewDocument((plat) => {
      try { Object.defineProperty(navigator, "platform", { get: () => plat }); } catch (e) { /* bỏ qua */ }
    }, may.plat);
    const conLoi = [];
    p.on("console", (m) => { if (m.type() === "error") conLoi.push(m.text().slice(0, 120)); });
    p.on("pageerror", (e) => conLoi.push("pageerror: " + e.message.slice(0, 120)));

    console.log("  ── " + trang.ten + "  (" + (DUNG_FILE ? "file" : "live") + ")");
    try {
      await p.goto(url, { waitUntil: "networkidle2", timeout: 90000 });
      /* ⚠ BẪY NẶNG NHẤT CỦA CẢ BỘ ĐO (phát hiện 20/08/2026): truyền CHUỖI NGUỒN arrow function cho
         waitForFunction thì Puppeteer đánh giá chuỗi đó như một BIỂU THỨC — kết quả là một object
         hàm, mà object thì luôn truthy ⇒ lệnh chờ TRẢ VỀ NGAY, không chờ gì cả. Hậu quả: bộ đo chụp
         và đo lúc trang còn skeleton, rồi báo ĐẠT — xanh giả toàn bộ. Phải bọc "(fn)()" để nó GỌI
         hàm, đúng như cách làm với man.mo ở dưới. */
      await p.waitForFunction('(' + trang.sanSang + ')()', { timeout: 60000 });
    } catch (e) {
      console.log("     ✗ không mở được: " + e.message.split("\n")[0]);
      tongLoi++; await p.close(); continue;
    }
    await nghi(2500);   // chờ gviz nạp xong (dashboard đọc Google Sheet)

    let dsMan = trang.man;
    if (trang.manDong) {
      /* Tab động: hỏi trang xem đang có tab nào rồi mới dựng danh sách màn. Nhờ vậy dashboard 5S
         thêm/bớt tab theo công ty mà bộ đo không phải sửa. */
      let tabs = [];
      try { tabs = await p.evaluate("(" + trang.manDong + ")()"); } catch (e) { tabs = []; }
      dsMan = tabs.map((t) => { const [ma, ten] = String(t).split("|");
        return { ten: "Tab " + (ten || ma), mo: "() => { setTab('" + ma + "'); return true; }" }; });
      if (!dsMan.length) dsMan = [{ ten: "Màn mở đầu", mo: "() => true" }];
      console.log("     · " + dsMan.length + " tab: " + dsMan.map((m) => m.ten.replace(/^Tab /, "")).join(", "));
      /* Nối các pop-up khai tĩnh vào SAU danh sách tab động — tab đi trước cho dữ liệu nạp xong, rồi
         mới mở pop-up (pop-up nào không mở được thì bước `mo` trả false và bị bỏ qua, không tính lỗi). */
      dsMan = dsMan.concat(trang.man || []);
    }
    for (const man of dsMan) {
      let mo = false;
      try { mo = await p.evaluate("(" + man.mo + ")()"); } catch (e) { mo = false; }
      if (!mo) { console.log("     ○ " + man.ten + " — bỏ qua (không mở được / chưa có dữ liệu)"); continue; }
      if (man.cho) {
        try { await p.waitForSelector(man.cho, { timeout: 15000 }); } catch (e) {
          console.log("     ○ " + man.ten + " — bỏ qua (pop-up không hiện)"); continue; }
      }
      if (man.sanSangMan) {
        /* Chờ tab vẽ xong DỮ LIỆU THẬT. Hết thời gian mà vẫn skeleton thì BÁO RÕ và bỏ qua — thà
           nói "không đo được" còn hơn đo một cái skeleton rồi kết luận "đạt". */
        try { await p.waitForFunction('(' + man.sanSangMan + ')()', { timeout: 40000 }); }
        catch (e) { console.log("     ○ " + man.ten + " — BỎ QUA: tab chưa vẽ xong dữ liệu (còn skeleton)"); continue; }
      }
      await nghi(900);
      const r = await p.evaluate(raSoat);
      tongMan++;
      const xau = [];
      if (r.keoTrang > 1) xau.push("TRANG KÉO NGANG " + r.keoTrang + "px");
      if (r.nTran) xau.push(r.nTran + " phần tử tràn mép");
      if (r.nBop) xau.push(r.nBop + " ô bị bóp (chữ xếp dọc)");
      if (r.nCham) xau.push(r.nCham + " control chạm <40px");
      if (r.nMoCoi) xau.push(r.nMoCoi + " ô số MỒ CÔI (không nhãn)");
      if (r.nCat) xau.push(r.nCat + " nhãn BỊ CẮT chữ");
      if (r.nRangCua) xau.push(r.nRangCua + " cụm control RĂNG CƯA");
      if (r.nChuNho) xau.push(r.nChuNho + " kiểu chữ <10px");
      if (!xau.length) console.log("     ✓ " + man.ten);
      else {
        tongLoi++;
        console.log("     ✗ " + man.ten + " — " + xau.join(" · "));
        r.tran.forEach((x) => console.log("        tràn  " + x.el + "  rộng " + x.rong + "px, vượt phải " + x.phai + "px"));
        r.bop.forEach((x) => console.log("        bóp   " + x.el + "  rộng " + x.rong + "px → " + x.dong + " dòng  \"" + x.chu + "…\""));
        r.cham.forEach((x) => console.log("        chạm  " + x.el + "  " + x.co + "px"));
        r.moCoi.forEach((x) => console.log("        mồ côi " + x.el + "  = \"" + x.chu + "\" (không nhãn)"));
        r.cat.forEach((x) => console.log("        cắt   " + x.el + "  thiếu " + x.thieu + "px  \"" + x.chu + "\""));
        r.rangCua.forEach((x) => console.log("        răng cưa " + x.el + "  " + x.mon + " món / " + x.hang +
          " hàng · cao " + x.cao + "px (" + x.phanTramMan + "% màn)"));
        r.chuNho.forEach((x) => console.log("        chữ   " + x.el + "   ×" + x.n));
      }
      bangKe.push({ may: may.ten, he: may.he, trang: trang.ten, man: man.ten, ...r, xau });
      const anh = (may.he + "-" + may.w + "-" + trang.ma + "-" + man.ten).replace(/[^\w-]+/g, "_") + ".png";
      await p.screenshot({ path: path.join(OUT, anh) }).catch(() => {});
      if (man.dong) await p.evaluate("(" + man.dong + ")()").catch(() => {});
      await nghi(300);
    }
    if (conLoi.length) { tongLoi++; console.log("     ✗ console đỏ: " + [...new Set(conLoi)].slice(0, 3).join(" | ")); }
    await p.close();
  }
}
await b.close();

/* ---------- Tổng kết ----------------------------------------------------------------------------- */
console.log("\n═════════ TỔNG KẾT ═════════");
const theoMan = {};
bangKe.forEach((x) => { const k = x.trang + " › " + x.man;
  (theoMan[k] = theoMan[k] || []).push(x); });
Object.keys(theoMan).forEach((k) => {
  const ds = theoMan[k], hong = ds.filter((x) => x.xau.length);
  if (!hong.length) { console.log("  ✓ " + k); return; }
  /* Vỡ ở MỌI máy là lỗi CSS chung; vỡ ở vài máy là lỗi theo bề rộng — phân biệt để biết chữa ở đâu. */
  const dienRong = hong.length === ds.length ? "mọi máy" : hong.map((x) => x.may.replace(/ \(.*/, "")).join(", ");
  console.log("  ✗ " + k + "  [" + dienRong + "]  " + [...new Set(hong.flatMap((x) => x.xau.map((s) => s.replace(/^\d+ /, ""))))].join(" · "));
});
fs.writeFileSync(path.join(OUT, "bao-cao.json"), JSON.stringify(bangKe, null, 1));
console.log("\nẢnh + bao-cao.json: " + OUT);
console.log(tongLoi ? "✗ " + tongLoi + " màn/hạng mục có vấn đề (đã đi qua " + tongMan + " màn)"
  : "✓ Bố cục điện thoại toàn dự án: đạt (" + tongMan + " màn × " + MAY.length + " máy)");
process.exit(tongLoi ? 1 : 0);
