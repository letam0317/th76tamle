/**
 * qc-ghi-nhan-5s-planogram.mjs — BỘ ĐO SÂU cho nút "Ghi nhận 5S" trong pop-up ô ở tab Planogram (17/09/2026, bản 2).
 *
 *  Lời hứa cần đo (đúng lời user, lượt "làm lại" 17/09):
 *   · Hiện trạng 3 dòng: "Yêu cầu planogram #…: <trạng thái>" · "Link: …" · "Phụ trách: Tên (mã) -<tình trạng>"
 *     (+ dòng "Vi phạm luỹ tiến: lần n (…)" khi có đi làm mà không báo cáo — ca A)
 *   · Ca A: hạng mục tự chọn = "Bàn làm việc và khu vực phụ trách…", ảnh = CHỤP TOÀN BỘ POP-UP (Screenshot_…),
 *     và nút chỉ hiện khi đủ 3 lần trong chu kỳ — chưa đủ thì chỉ dòng chữ "Đi làm không báo cáo · lần n/3".
 *   · Ca khác: nút hiện, hạng mục để trống, Mục 5 "Chọn từ ảnh báo cáo" = tick 1 hay nhiều ảnh báo cáo của ngày.
 *   · Không còn thông báo "Đã điền sẵn từ Planogram…".
 *
 *  Đo trên bản NỘI BỘ (localhost:8123 — chạy XEM-BAN-NOI-BO.bat trước) hoặc --live. Dữ liệu THẬT từ GAS: bộ đo tự
 *  tìm một ô ca A và một ô ca khác có ảnh; không có ô nào thì "○ bỏ qua" (không giả vờ đạt). Phần sau-PIN gọi thẳng
 *  các hàm host đứng sau cửa PIN (form.html vốn công khai — không phải đường vòng bảo mật); cửa PIN đo riêng.
 *
 *  node qc-ghi-nhan-5s-planogram.mjs            (localhost:8123)
 *  node qc-ghi-nhan-5s-planogram.mjs --live     (letam0317.github.io/kiemsoatkho)
 *  node qc-ghi-nhan-5s-planogram.mjs --url=http://192.168.1.5:8123/kiemsoatkho/
 */
import path from "node:path"; import fs from "node:fs";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";
import { EDGE_PATH } from "./token-store.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, ".exports", "qc-ghi-nhan-5s"); fs.mkdirSync(OUT, { recursive: true });
const ARG = process.argv.slice(2).join(" ");
const URL_GOC = (ARG.match(/--url=(\S+)/) || [])[1] || (/--live/.test(ARG) ? "https://letam0317.github.io/kiemsoatkho/" : "http://localhost:8123/kiemsoatkho/");
const URL = URL_GOC.replace(/\/?$/, "/") + "?tab=planogram";
const UA_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const RE_HM = /^Bàn làm việc và khu vực phụ trách: .*vệ sinh.*hằng ngày/i;

const isoHomNay = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const KQ = []; let soLoi = 0, soBoQua = 0;
function ca(ten, ok, ghi){ KQ.push({ ten, ok: !!ok, ghi: ghi || "" }); if (!ok) soLoi++; console.log((ok ? "  ✓ " : "  ✗ ") + ten + (ghi ? "  — " + ghi : "")); }
function boQua(ten, ly){ soBoQua++; KQ.push({ ten, ok: null, ghi: ly }); console.log("  ○ " + ten + " — bỏ qua: " + ly); }
function coTran(p, ms, nhan){ return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("TREO quá " + ms / 1000 + "s ở bước: " + nhan)), ms))]); }
async function choDen(page, fn, ms, nhan, arg){
  const t0 = Date.now();
  while (Date.now() - t0 < ms){
    let v = null; try { v = await coTran(page.evaluate(fn, arg), 15000, nhan); } catch (e) { if (/TREO/.test(String(e.message))) throw e; }
    if (v) return v;
    await new Promise(r => setTimeout(r, 400));
  }
  return null;
}
async function moTrang(b, may){
  const page = await b.newPage();
  page.on("dialog", d => { console.log("  (dialog) " + d.message()); d.dismiss().catch(() => {}); });
  page.on("pageerror", e => console.log("  (lỗi JS trang) " + String(e.message || e).slice(0, 200)));
  if (may === "mobile"){ await page.setUserAgent(UA_IOS); await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); }
  else await page.setViewport({ width: 1280, height: 900 });
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  return page;
}
/* Chờ đủ nguồn pop-up cần: yêu cầu + phân công + chấm công theo ngày + ảnh (bậc 3, mở 1 pop-up để kích nạp). */
async function choNguon(page){
  const loc0 = await choDen(page, () => { if (!window.HPLANOGRAM || !HPLANOGRAM._S.yc.ok) return null; const a = document.querySelector("#hpMap [data-l]"); return a && a.getAttribute("data-l"); }, 60000, "chờ sơ đồ");
  if (!loc0) return null;
  await page.evaluate(l => HPLANOGRAM.openViTri(l), loc0);
  await choDen(page, () => { const S = HPLANOGRAM._S; return (S.pc.ok || !S.pc.dang) && (S.ccn.ok || !S.ccn.dang) && (S.anh.ok || !S.anh.dang) ? 1 : null; }, 40000, "chờ PHU-TRACH/CHAMCONG-NGAY/ANH");
  await page.evaluate(() => HPLANOGRAM.closeVt());
  return loc0;
}
/* Phân loại mọi ô theo _soan5S: ca A (đi làm không báo cáo) · ca B có ảnh · ca B thường. */
async function phanLoai(page){
  return await page.evaluate(() => {
    const S = HPLANOGRAM._S, d = S.dDen || S.yc.ngay;
    const locs = [...new Set([...document.querySelectorAll("#hpMap [data-l]")].map(a => a.getAttribute("data-l")))];
    const kq = { d, A: null, Banh: null, B: null, soA: 0, soBanh: 0, coVp: !!(S.ccn.ok && S.ccn.coVp), ccnOk: !!S.ccn.ok, pcOk: !!S.pc.ok, anhOk: !!S.anh.ok };
    for (const l of locs){
      const du = HPLANOGRAM._soan5S(l, d);
      if (du.caseA){ kq.soA++; if (!kq.A) kq.A = l; }
      else if (du.anhBaoCao.length){ kq.soBanh++; if (!kq.Banh) kq.Banh = l; }
      else if (!kq.B) kq.B = l;
    }
    return kq;
  });
}
async function moPopup(page, loc){
  await page.evaluate(l => HPLANOGRAM.openViTri(l), loc);
  return !!(await choDen(page, () => document.querySelector("#hpVtModal.show") && document.getElementById("hpVtGhi") ? 1 : null, 8000, "chờ pop-up ô"));
}
async function docNut(page){
  return await page.evaluate(() => {
    const b = document.getElementById("hpVtGhi"), a = document.getElementById("hpVtPg"), tx = document.getElementById("hpVtLt"), x = document.querySelector("#hpVtModal .hp-mclose");
    const hien = b && getComputedStyle(b).display !== "none";
    const rb = b.getBoundingClientRect(), ra = a.getBoundingClientRect(), rx = x && x.getBoundingClientRect();
    const cs = getComputedStyle(b);
    return { hien, text: b.textContent.trim(), title: b.title, color: cs.color, fw: cs.fontWeight, disabled: b.disabled,
      duoiLink: rb.top >= ra.bottom - 2, canhPhai: Math.abs(rb.right - ra.right) <= 2, benTraiX: rx ? rb.right <= rx.left + 1 : true,
      lt: tx ? tx.textContent.trim() : "", ltTitle: tx ? tx.title : "", ltHien: tx ? getComputedStyle(tx).display !== "none" : false, linkText: a.textContent.trim(), w: Math.round(rb.width), h: Math.round(rb.height) };
  });
}
/* Đường SAU-PIN của host: nạp du vào iframe form rồi đọc lại trạng thái Alpine (chép trường nguyên thuỷ — Proxy qua CDP thành {}). */
async function napVaoForm(page, du){
  await page.evaluate(d => { _gmNapSan = d; napFormTruoc(); hienModal("ghiModal"); _gmGuiNapSan(); }, du);
  return await choDen(page, (vt) => {
    if (!document.querySelector("#ghiModal.show")) return null;
    const fr = document.getElementById("gmFrame"), w = fr && fr.contentWindow; if (!w || !w.Alpine) return null;
    const el = w.document.querySelector("[x-data]"); if (!el) return null;
    let dt; try { dt = w.Alpine.$data(el); } catch (e) { return null; }
    if (!dt || !dt.form || dt.form.viTri !== vt) return null;
    const lb = w.document.querySelector("label[for], form label.cursor-pointer, form label.border-dashed");
    return { viTri: dt.form.viTri, hangMuc: dt.form.hangMuc, hienTrang: dt.form.hienTrang, maSP: dt.form.maSanPham,
      tb: { loai: dt.thongBao.loai, noiDung: dt.thongBao.noiDung }, ds: (dt.dsHangMuc || []).length,
      files: (dt.files || []).map(f => ({ ten: f.ten, loai: f.loai, mime: f.mime, kb: Math.round(String(f.base64 || "").length * 3 / 4 / 1024), napSan: !!f.napSan })),
      thuVien: (dt.thuVienBC || []).length, nguoiBC: dt.nguoiBC, ngayBC: dt.ngayBC, hangDong: dt.hangDong,
      nhanThuVien: (lb ? lb.textContent : w.document.body.textContent).replace(/\s+/g, " ") };
  }, 30000, "chờ iframe form nhận bản nạp sẵn", du.viTri);
}
function kiemHienTrang(L, caseA){
  ca("Dòng 1: 'Yêu cầu planogram #…: <trạng thái>' (hoặc nói rõ không có yêu cầu)", /^Yêu cầu planogram #\d+: .+$/.test(L[0]) || /không có yêu cầu vệ sinh/.test(L[0]), L[0]);
  ca("Dòng 2: 'Link: https://planogram.hasaki.vn/…'", /^Link: https:\/\/planogram\.hasaki\.vn\//.test(L[1]), L[1]);
  ca("Dòng 3: 'Phụ trách: Tên (mã) -<tình trạng>' (hoặc 'chưa có trong bảng phân công')", /^Phụ trách: .+ \(\d+\) -.+$/.test(L[2]) || /^Phụ trách: chưa có trong bảng phân công$/.test(L[2]), L[2]);
  if (caseA){
    ca("Ca A: tình trạng đúng chữ 'Có đi làm nhưng KHÔNG báo cáo vệ sinh ô này'", /-Có đi làm nhưng KHÔNG báo cáo vệ sinh ô này$/.test(L[2]));
    /* Luật 17/09: đủ 3 → "đủ 3 lần (3 ngày) → KPI -2%" (kê ĐÚNG 3 ngày, không kê cả chu kỳ);
       chưa đủ → "lần n/3 … chưa đủ để trừ KPI". Nhiều phiếu nợ thì có thêm dòng "Tồn đọng: …". */
    const duLT = /^Vi phạm luỹ tiến: đủ 3 lần \(\d{2}\/\d{2}\/\d{4} · \d{2}\/\d{2}\/\d{4} · \d{2}\/\d{2}\/\d{4}\) → KPI -2%$/.test(L[3] || "");
    const chuaDu = /^Vi phạm luỹ tiến: lần [0-2]\/3( \(.+\))? — chưa đủ để trừ KPI$/.test(L[3] || "");
    ca("Ca A: dòng 4 luỹ tiến đúng khuôn (đủ 3 kê đúng 3 ngày · hoặc nói rõ chưa đủ)", duLT || chuaDu, L[3]);
    if (L[4] && /^Tồn đọng:/.test(L[4]))
      ca("Ca A: dòng Tồn đọng nêu số phiếu còn nợ + lần lẻ", /^Tồn đọng: \d+ lần chưa ghi nhận.* ⇒ còn \d+ phiếu -2% nữa/.test(L[4]), L[4]);
  } else {
    ca("Ca khác: KHÔNG có dòng luỹ tiến, không nói 'KHÔNG báo cáo'", !L.some(x => /^Vi phạm luỹ tiến/.test(x)) && !/KHÔNG báo cáo vệ sinh ô này/.test(L[2]));
  }
  ca("Không dòng 'Người ghi nhận' khi chưa đăng nhập · không undefined/null", !L.some(x => /^Người ghi nhận/.test(x)) && !/undefined|null|NaN/.test(L.join("\n")) && L.every(x => x.trim()));
  ca("Không còn các dòng cũ (Vệ sinh planogram —, Chấm công:, Báo cáo gần nhất:, AI xét duyệt:)", !L.some(x => /^(Vệ sinh planogram —|Chấm công:|Báo cáo gần nhất:|AI xét duyệt:|Cảnh báo:)/.test(x)));
}

async function doDesktop(b){
  console.log("\n══ MÁY TÍNH (1280×900) ══");
  const page = await moTrang(b, "desktop");
  const loc0 = await choNguon(page);
  ca("Sơ đồ planogram có dữ liệu", !!loc0, loc0 || "GAS chưa về?");
  if (!loc0){ await page.close(); return; }
  const PL = await phanLoai(page);
  console.log("  · ngày " + PL.d + " · ô ca A (đi làm không báo cáo): " + PL.soA + " · ô ca khác có ảnh: " + PL.soBanh + " · sổ vi phạm: " + (PL.coVp ? "CÓ" : "chưa có cột") + " · ccn=" + PL.ccnOk + " pc=" + PL.pcOk + " anh=" + PL.anhOk);
  const z = await page.evaluate(() => ({ vt: +getComputedStyle(document.getElementById("hpVtModal")).zIndex, pin: +getComputedStyle(document.getElementById("pinModal")).zIndex, ghi: +getComputedStyle(document.getElementById("ghiModal")).zIndex }));
  ca("z-index: PIN + modal form nổi trên pop-up ô", z.pin > z.vt && z.ghi > z.vt, JSON.stringify(z));

  /* ===== CA A — có đi làm mà không báo cáo ===== */
  if (!PL.A) boQua("Ca A (đi làm không báo cáo)", "hôm nay không có ô nào ở tình trạng này");
  else {
    console.log("  ── Ca A · ô " + PL.A);
    ca("[A] Mở pop-up", await moPopup(page, PL.A));
    const info = await page.evaluate(l => { const S = HPLANOGRAM._S, d = S.dDen || S.yc.ngay; const du = HPLANOGRAM._soan5S(l, d);
      const pc = S.pc.by[Object.keys(S.pc.by).find(k => l.indexOf(k) === 0)]; const lt = HPLANOGRAM._luyTien(pc, d, true);
      return { du, lt, pcEm: pc && pc.em }; }, PL.A);
    const L = String(info.du.hienTrang).split("\n"); console.log("  ── Hiện trạng:"); L.forEach(x => console.log("     │ " + x));
    kiemHienTrang(L, true);
    ca("[A] Hạng mục tự chọn = luật vệ sinh hằng ngày (nguyên văn QUY-DINH)", RE_HM.test(info.du.hangMuc), info.du.hangMuc.slice(0, 60) + "…");
    ca("[A] Không đưa thư viện ảnh báo cáo (ô chưa ai báo cáo)", info.du.anhBaoCao.length === 0);
    /* LUẬT 17/09: HÔM NAY KHÔNG TÍNH (ca chưa khép). Ô ca A đang soi là ngày hôm nay ⇒ ngày đó KHÔNG
       được có mặt trong danh sách lần đã cộng; n phải bằng số phiếu×3 + lẻ, và phiếu kê đúng 3 ngày cũ nhất. */
    ca("[A] Hôm nay KHÔNG được cộng vào sổ (chỉ tính ngày đã khép)", PL.d !== isoHomNay() || !info.lt.ngay.includes(PL.d), "ngày xem " + PL.d + " · các lần: " + info.lt.ngay.join(","));
    ca("[A] Số học luỹ tiến khớp: n = phiếu×3 + lẻ, phiếu = floor(n/3)", info.lt.n === info.lt.ngay.length && info.lt.soPhieu === Math.floor(info.lt.n / 3) && info.lt.duLai === info.lt.n % 3 && info.lt.keNay.length === (info.lt.soPhieu ? 3 : 0), JSON.stringify({ n: info.lt.n, phieu: info.lt.soPhieu, le: info.lt.duLai, ke: info.lt.keNay }));
    const nut = await docNut(page);
    if (!info.lt.co){
      ca("[A] Sổ chưa có cột → không nút, dòng chữ 'chưa đếm được luỹ tiến'", !nut.hien && /chưa đếm được luỹ tiến/.test(nut.lt), nut.lt);
    } else if (info.lt.du){
      const nhanDung = info.lt.soPhieu > 1 ? "Ghi nhận 5S · còn " + info.lt.soPhieu + " phiếu" : "Ghi nhận 5S · lần 3/3";
      ca("[A] " + info.lt.n + " lần = " + info.lt.soPhieu + " phiếu (−" + info.lt.soPhieu * 2 + "%) → nút '" + nhanDung + "'", nut.hien && nut.text === nhanDung, nut.text);
      ca("[A] Tooltip nút nêu đủ: số lần, số phiếu × −2%, 3 ngày của phiếu này", new RegExp(info.lt.n + " lần").test(nut.title) && new RegExp(info.lt.soPhieu + " phiếu × −2%").test(nut.title) && /Phiếu này kê 3 ngày cũ nhất/.test(nut.title), nut.title.slice(0, 150));
    } else if (info.lt.n === 0){
      ca("[A] Hôm nay đỏ nhưng chưa có lần nào đã khép → dòng 'hôm nay chưa tính'", !nut.hien && /hôm nay chưa tính/.test(nut.lt), nut.lt);
    } else {
      ca("[A] Chưa đủ (" + info.lt.n + "/3) → KHÔNG nút, chỉ dòng 'Đi làm không báo cáo · lần n/3'", !nut.hien && nut.ltHien && new RegExp("^Đi làm không báo cáo · lần " + info.lt.n + "/3$").test(nut.lt), nut.lt);
      ca("[A] Dòng đếm có tooltip kê các ngày + luật 3 lần", /lần/.test(nut.ltTitle) && /\d{2}\/\d{2}/.test(nut.ltTitle) && /3 lần/.test(nut.ltTitle), nut.ltTitle.slice(0, 120));
    }
    { /* clip phải dương — pop-up vừa vẽ lại có thể trả rect 0 trong 1 khung hình → rơi về chụp cả trang (bẫy run 4) */
      const c = await page.evaluate(() => { const b = document.querySelector("#hpVtModal .hp-modalbox"); if (!b) return null; const r = b.getBoundingClientRect();
        return { x: Math.max(0, r.left), y: Math.max(0, r.top), width: Math.min(r.width, innerWidth - Math.max(0, r.left)), height: Math.min(200, r.height) }; });
      await page.screenshot(Object.assign({ path: path.join(OUT, "caseA-popup.png") }, (c && c.width > 0 && c.height > 0) ? { clip: c } : {})); }

    /* ÉP SỐ LẦN THEO KỊCH BẢN: tiêm thẳng sổ trong RAM (chỉ trang đo) để dựng đủ các mốc user hỏi —
       3 lần (1 phiếu), 6 lần (2 phiếu), 9 lần (3 phiếu) — rồi kiểm nhãn nút + dòng biên bản + số % cho TỪNG mốc. */
    const tiem = async (soLan) => await page.evaluate(({ l, soLan }) => {
      const S = HPLANOGRAM._S, d = S.dDen || S.yc.ngay, pc = S.pc.by[Object.keys(S.pc.by).find(k => l.indexOf(k) === 0)];
      const em = String(pc.em).toLowerCase(); let o = S.ccn.em[em] || S.ccn.code[pc.code];
      if (!o){ o = { code: pc.code, em: em, ten: pc.ten, d: {}, n: 0, vp: {}, ghi: [] }; S.ccn.em[em] = o; }
      if (!window.__qcVpCu) window.__qcVpCu = { vp: o.vp, ghi: o.ghi, coVp: S.ccn.coVp, em };
      const lui = (n) => { const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/); return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] - n)).toISOString().slice(0, 10); };
      const vp = {}; for (let k = 1; k <= soLan; k++) vp[lui(k + 10)] = { so: 1, o: [l] };   // toàn ngày ĐÃ KHÉP
      o.vp = vp; o.ghi = []; S.ccn.coVp = true;
      HPLANOGRAM.openViTri(l);
      const k = HPLANOGRAM._luyTien(pc, d, true);
      return { n: k.n, phieu: k.soPhieu, le: k.duLai, ke: k.keNay };
    }, { l: PL.A, soLan });
    let nut3 = null, du3 = null;
    for (const soLan of [3, 6, 9]){
      const k = await tiem(soLan);
      await new Promise(r => setTimeout(r, 350));
      const nut = await docNut(page);
      const phieu = Math.floor(soLan / 3);
      const nhanDung = phieu > 1 ? "Ghi nhận 5S · còn " + phieu + " phiếu" : "Ghi nhận 5S · lần 3/3";
      ca("[A·" + soLan + " lần] sổ đếm đúng " + soLan + " lần = " + phieu + " phiếu (−" + phieu * 2 + "%)", k.n === soLan && k.phieu === phieu && k.le === 0, JSON.stringify(k));
      ca("[A·" + soLan + " lần] nút '" + nhanDung + "', đỏ, đậm, dưới link, không đè ×", nut.hien && nut.text === nhanDung && nut.color === "rgb(220, 38, 38)" && +nut.fw >= 700 && nut.duoiLink && nut.canhPhai && nut.benTraiX, nut.text + " · " + nut.color);
      const du = await page.evaluate(l => { const S = HPLANOGRAM._S; return HPLANOGRAM._soan5S(l, S.dDen || S.yc.ngay); }, PL.A);
      const Ls = du.hienTrang.split("\n"), dongLT = Ls[3] || "", dongTon = Ls[4] || "";
      ca("[A·" + soLan + " lần] biên bản kê ĐÚNG 3 ngày cũ nhất → KPI -2% (một phiếu, không gộp)",
        /^Vi phạm luỹ tiến: đủ 3 lần \(\d{2}\/\d{2}\/\d{4} · \d{2}\/\d{2}\/\d{4} · \d{2}\/\d{2}\/\d{4}\) → KPI -2%$/.test(dongLT) &&
        k.ke.every(x => dongLT.includes(x.slice(8, 10) + "/" + x.slice(5, 7))), dongLT);
      if (phieu > 1) ca("[A·" + soLan + " lần] có dòng Tồn đọng: còn " + (phieu - 1) + " phiếu -2% nữa",
        new RegExp("^Tồn đọng: " + soLan + " lần chưa ghi nhận.*⇒ còn " + (phieu - 1) + " phiếu -2% nữa").test(dongTon), dongTon);
      else ca("[A·3 lần] KHÔNG có dòng Tồn đọng (vừa đủ 1 phiếu)", !/^Tồn đọng:/.test(dongTon), dongTon || "(không có)");
      nut3 = nut; du3 = du;
    }
    /* Lập phiếu LIÊN TIẾP trên giao diện: sau khi ghi nhận 1 phiếu (mốc = ngày thứ 3), nút phải còn cho phiếu kế */
    const tiep = await page.evaluate((l) => {
      const S = HPLANOGRAM._S, d = S.dDen || S.yc.ngay, pc = S.pc.by[Object.keys(S.pc.by).find(k => l.indexOf(k) === 0)];
      const o = S.ccn.em[String(pc.em).toLowerCase()] || S.ccn.code[pc.code];
      const buoc = [];
      for (let i = 0; i < 4; i++){
        const k = HPLANOGRAM._luyTien(pc, d, true);
        if (!k.du) { buoc.push({ n: k.n, phieu: 0 }); break; }
        buoc.push({ n: k.n, phieu: k.soPhieu, ke: k.keNay });
        o.ghi = [...o.ghi, k.keNay[k.keNay.length - 1]];   // như biên bản vừa lập (mốc = ngày thứ 3)
      }
      return buoc;
    }, PL.A);
    ca("[A] 9 lần → lập LIÊN TIẾP đúng 3 phiếu (−6%), hết thì dừng", tiep.length === 4 && tiep[0].phieu === 3 && tiep[1].phieu === 2 && tiep[2].phieu === 1 && tiep[3].phieu === 0 && tiep[3].n === 0, JSON.stringify(tiep.map(b => b.n + "→" + b.phieu)));
    await tiem(3); await new Promise(r => setTimeout(r, 350));   // về lại kịch bản 1 phiếu để chụp + PIN
    nut3 = await docNut(page);
    du3 = await page.evaluate(l => { const S = HPLANOGRAM._S; return HPLANOGRAM._soan5S(l, S.dDen || S.yc.ngay); }, PL.A);
    ca("[A] Tooltip nút nói KPI 2% + sẽ chụp pop-up", /−2% KPI/.test(nut3.title) && /chụp/.test(nut3.title), nut3.title.slice(0, 130));

    /* Bấm nút thật: chụp pop-up (html2canvas) rồi hỏi PIN; nút tạm đổi nhãn/khoá; Huỷ → về lại */
    await page.evaluate(() => document.getElementById("hpVtGhi").click());
    const pin = await choDen(page, () => { const m = document.querySelector("#pinModal.show"); if (!m) return null; return { desc: document.getElementById("pinDesc").textContent, disabled: document.getElementById("hpVtGhi").disabled }; }, 40000, "chờ chụp + PIN");
    ca("[A] Bấm nút ⇒ chụp pop-up rồi hỏi PIN (không mở form trần)", !!pin, pin && pin.desc);
    ca("[A] Trong lúc hỏi PIN, nút tạm khoá", pin && pin.disabled === true);
    await page.evaluate(() => document.getElementById("pinCancel").click());
    const sauHuy = await choDen(page, (nhan) => !document.querySelector("#pinModal.show") && !document.getElementById("hpVtGhi").disabled && document.getElementById("hpVtGhi").textContent.trim() === nhan ? 1 : null, 5000, "chờ huỷ PIN", nut3.text);
    ca("[A] Huỷ PIN ⇒ đóng PIN, nút mở lại đúng nhãn, form không mở", !!sauHuy && !(await page.evaluate(() => !!document.querySelector("#ghiModal.show"))));

    /* Sau PIN: chụp thật + nạp vào form → 1 file Screenshot_…jpg, hạng mục vệ sinh, không thông báo, không thư viện */
    const anh = await coTran(page.evaluate(() => HPLANOGRAM._chup().then(a => ({ ten: a.ten, mime: a.mime, kb: Math.round(a.base64.length * 3 / 4 / 1024), w: a.w, h: a.h, b64: a.base64 }))), 60000, "chụp pop-up");
    ca("[A] Ảnh chụp pop-up: tên kiểu Screenshot_d-m-yyyy_HHMMSS_host.jpg, JPEG ≥ 20 KB, cao hơn rộng", /^Screenshot_\d{1,2}-\d{1,2}-\d{4}_\d{6}_[\w.-]+\.jpg$/.test(anh.ten) && anh.mime === "image/jpeg" && anh.kb >= 20 && anh.h > anh.w * 0.6, anh.ten + " · " + anh.kb + " KB · " + anh.w + "×" + anh.h);
    fs.writeFileSync(path.join(OUT, "caseA-chup-popup.jpg"), Buffer.from(anh.b64.split(",")[1], "base64"));
    du3.anh = [{ ten: anh.ten, mime: anh.mime, base64: anh.b64, tg: Date.now() }];
    const f = await napVaoForm(page, du3);
    ca("[A] Form nhận vị trí + hiện trạng nguyên văn", f && f.viTri === PL.A && f.hienTrang === du3.hienTrang);
    ca("[A] Form khớp hạng mục vệ sinh vào danh sách QUY-DINH", f && RE_HM.test(f.hangMuc), f && ("ds=" + f.ds + " · " + String(f.hangMuc).slice(0, 60)));
    ca("[A] Form có đúng 1 ảnh = ảnh chụp pop-up (đánh dấu nạp sẵn)", f && f.files.length === 1 && /^Screenshot_/.test(f.files[0].ten) && f.files[0].napSan, f && JSON.stringify(f.files));
    ca("[A] KHÔNG còn thông báo 'Đã điền sẵn…'", f && f.tb.noiDung === "", f && f.tb.noiDung);
    ca("[A] Không có thư viện ảnh báo cáo · ô Hiện trạng nới ≥ 5 dòng", f && f.thuVien === 0 && f.hangDong >= 5, f && ("thuVien=" + f.thuVien + " hangDong=" + f.hangDong));
    await page.screenshot({ path: path.join(OUT, "caseA-form.png") });
    /* Mở TAY sau đó (host gửi xoa) khi chưa sửa gì ⇒ trắng hết, kể cả ảnh chụp */
    const xoa = await page.evaluate(async () => { const fr = document.getElementById("gmFrame"), w = fr.contentWindow, dt = w.Alpine.$data(w.document.querySelector("[x-data]"));
      _gmGuiForm({ type: "ghi5s-xoa-nap-san" }); await new Promise(r => setTimeout(r, 300));
      return { viTri: dt.form.viTri, hangMuc: dt.form.hangMuc, files: dt.files.length, thuVien: dt.thuVienBC.length, tb: dt.thongBao.noiDung }; });
    ca("[A] Mở tay khi chưa sửa ⇒ form trắng, ảnh chụp bị gỡ", xoa.viTri === "" && xoa.hangMuc === "" && xoa.files === 0 && xoa.thuVien === 0 && xoa.tb === "", JSON.stringify(xoa));
    await page.evaluate(() => { dongGhiNhan(); const S = HPLANOGRAM._S; const c = window.__qcVpCu; for (const em in S.ccn.em){ const o = S.ccn.em[em]; if (o && o.vp && c && o.vp === o.vp){} } });
    // trả sổ về như cũ cho ca sau (ô B không dùng người này, nhưng vẫn dọn)
    await page.evaluate(l => { const S = HPLANOGRAM._S, pc = S.pc.by[Object.keys(S.pc.by).find(k => l.indexOf(k) === 0)]; const o = S.ccn.em[String(pc.em).toLowerCase()] || S.ccn.code[pc.code]; const c = window.__qcVpCu; if (o && c){ o.vp = c.vp; o.ghi = c.ghi; } S.ccn.coVp = c ? c.coVp : S.ccn.coVp; HPLANOGRAM.closeVt(); }, PL.A);
  }

  /* ===== CA KHÁC — có ảnh báo cáo ===== */
  const locB = PL.Banh || PL.B;
  if (!locB) boQua("Ca khác", "không có ô nào");
  else {
    console.log("  ── Ca khác · ô " + locB + (PL.Banh ? " (có ảnh báo cáo)" : " (không có ảnh)"));
    ca("[B] Mở pop-up", await moPopup(page, locB));
    const nutB = await docNut(page);
    ca("[B] Nút 'Ghi nhận 5S' hiện (không luỹ tiến), đỏ đậm dưới link, không dòng đếm", nutB.hien && nutB.text === "Ghi nhận 5S" && nutB.color === "rgb(220, 38, 38)" && +nutB.fw >= 700 && nutB.duoiLink && nutB.canhPhai && nutB.lt === "", nutB.text + " · lt=" + JSON.stringify(nutB.lt));
    const duB = await page.evaluate(l => { const S = HPLANOGRAM._S; return HPLANOGRAM._soan5S(l, S.dDen || S.yc.ngay); }, locB);
    const LB = String(duB.hienTrang).split("\n"); console.log("  ── Hiện trạng:"); LB.forEach(x => console.log("     │ " + x));
    kiemHienTrang(LB, false);
    ca("[B] Hạng mục ĐỂ TRỐNG (tuỳ chọn)", duB.hangMuc === "");
    if (PL.Banh){
      ca("[B] Thư viện ảnh báo cáo của ngày có ảnh (url + vị trí con + nhóm)", duB.anhBaoCao.length > 0 && duB.anhBaoCao.every(a => /^https:\/\//.test(a.url) && a.vt && /^(o|khac)$/.test(a.nhom)), duB.anhBaoCao.length + " ảnh · " + (duB.anhBaoCao[0] && duB.anhBaoCao[0].vt));
      /* Ảnh nhỏ chỉ có sau khi pop-up đã vẽ ảnh (nạp lười theo tầm nhìn) — người thật mở pop-up rồi mới bấm nút nên
         thường có; bộ đo soạn ngay lúc mở nên đợi 2 s rồi soạn lại. Vẫn 0 thumb = bộ chọn dùng ảnh gốc, không phải lỗi → ○. */
      await new Promise(r => setTimeout(r, 2000));
      const duB2 = await page.evaluate(l => { const S = HPLANOGRAM._S; return HPLANOGRAM._soan5S(l, S.dDen || S.yc.ngay); }, locB);
      const soThumb = duB2.anhBaoCao.filter(a => /^data:image/.test(a.thumb)).length;
      if (soThumb) ca("[B] Có ảnh nhỏ sẵn cho bộ chọn (thumb data:image)", true, soThumb + "/" + duB2.anhBaoCao.length + " thumb");
      else boQua("[B] Ảnh nhỏ sẵn cho bộ chọn", "0/" + duB2.anhBaoCao.length + " thumb sau 2 s — bộ chọn sẽ dùng ảnh gốc (đúng thiết kế rơi về)");
    }
    const fB = await napVaoForm(page, duB);
    ca("[B] Form nhận vị trí, hạng mục trống, 0 ảnh, không thông báo", fB && fB.viTri === locB && fB.hangMuc === "" && fB.files.length === 0 && fB.tb.noiDung === "", fB && JSON.stringify({ hm: fB.hangMuc, files: fB.files.length, tb: fB.tb }));
    if (PL.Banh){
      ca("[B] Form nhận thư viện ảnh báo cáo + tên người báo cáo + ngày", fB && fB.thuVien === duB.anhBaoCao.length && fB.nguoiBC && fB.ngayBC === PL.d, fB && (fB.thuVien + " ảnh · " + fB.nguoiBC + " · " + fB.ngayBC));
      ca("[B] Nhãn Mục 5 đổi thành 'Chọn từ ảnh báo cáo' + số ảnh", fB && /Chọn từ ảnh báo cáo/.test(fB.nhanThuVien) && /tick chọn/.test(fB.nhanThuVien), fB && fB.nhanThuVien.slice(0, 80));
      /* Mở bộ chọn, tick ảnh đầu, Thêm → tải ảnh gốc từ CDN, đi qua đường ảnh thư viện → files = 1 */
      /* BẤM THẬT, KHÔNG gọi hàm (bài học 17/09: bản đo cũ gọi `dt.tickBC(0)` nên báo XANH GIẢ trong khi người dùng
         chạm mãi không được — nút mang `disabled` nên trình duyệt nuốt luôn sự kiện click). Mọi bước dưới đây đều
         đi qua .click() của chính phần tử người dùng chạm: nhãn Mục 5 → ô ảnh → nút "Thêm N ảnh". */
      const them = await coTran(page.evaluate(async () => {
        const cho = (ms) => new Promise(r => setTimeout(r, ms));
        const fr = document.getElementById("gmFrame"), w = fr.contentWindow, d = w.document, dt = w.Alpine.$data(d.querySelector("[x-data]"));
        const lb = [...d.querySelectorAll("label")].find(l => /Chọn từ ảnh báo cáo|Chọn từ thư viện/.test(l.textContent));
        if (lb) lb.click(); else dt.moBC = true;
        await cho(500);
        const moTuNhan = !!lb && dt.moBC === true;
        const nut = [...d.querySelectorAll("[x-show='moBC'] button.h-24")];
        const o0 = nut[0], cs0 = o0 ? getComputedStyle(o0) : null;
        const bamDuoc = !!o0 && !o0.disabled && !o0.hasAttribute("disabled") && cs0.pointerEvents !== "none";
        if (o0) o0.click(); await cho(200);
        const soChon = dt.soChonBC(), tickHien = o0 ? /✓/.test(o0.textContent) : false;
        const nutThem = [...d.querySelectorAll("[x-show='moBC'] button")].find(b => /Thêm/.test(b.textContent));
        const themBamDuoc = !!nutThem && !nutThem.disabled;
        if (nutThem) nutThem.click();
        const t0 = Date.now(); while (Date.now() - t0 < 25000 && dt.files.length < 1) await cho(200);
        return { oGrid: nut.length, moTuNhan, bamDuoc, soChon, tickHien, themBamDuoc,
          files: dt.files.map(f => ({ ten: f.ten, loai: f.loai, kb: Math.round(String(f.base64).length * 3 / 4 / 1024) })),
          daThem: !!dt.daThemBC[0], moBC: dt.moBC, tb: dt.thongBao.noiDung };
      }), 70000, "bộ chọn ảnh báo cáo");
      ca("[B] Bộ chọn hiện đủ ô ảnh (1 nút/ảnh)", them.oGrid === duB.anhBaoCao.length, them.oGrid + "/" + duB.anhBaoCao.length);
      ca("[B] Bấm NHÃN Mục 5 mở được bộ chọn (thao tác thật)", them.moTuNhan);
      ca("[B] Ô ảnh BẤM ĐƯỢC THẬT (không disabled, không chặn con trỏ)", them.bamDuoc);
      ca("[B] Chạm ô ảnh ⇒ tick lên 1 và hiện dấu ✓ trên ô", them.soChon === 1 && them.tickHien, "soChon=" + them.soChon + " ✓=" + them.tickHien);
      ca("[B] Nút 'Thêm N ảnh' bật khi đã chọn", them.themBamDuoc);
      ca("[B] Thêm ⇒ tải ảnh gốc vào files (JPEG thu nhỏ), đánh dấu đã thêm, đóng bộ chọn", them.files.length === 1 && them.files[0].loai === "image" && them.files[0].kb > 30 && them.daThem && !them.moBC && !them.tb, JSON.stringify({ files: them.files, daThem: them.daThem, moBC: them.moBC, tb: them.tb }));
      await page.screenshot({ path: path.join(OUT, "caseB-form.png") });
    }
    await page.evaluate(() => { _gmGuiForm({ type: "ghi5s-xoa-nap-san" }); dongGhiNhan(); HPLANOGRAM.closeVt(); });
  }
  await page.close();
}

async function doMobile(b, locB){
  console.log("\n══ ĐIỆN THOẠI (iPhone 14 · 390×844) ══");
  const page = await moTrang(b, "mobile");
  const loc0 = await choNguon(page);
  ca("[mobile] Sơ đồ có dữ liệu", !!loc0);
  if (!loc0){ await page.close(); return; }
  const PL = await phanLoai(page);
  const loc = PL.Banh || PL.B || loc0;
  ca("[mobile] Mở pop-up ô ca khác (nút hiện)", await moPopup(page, loc), loc);
  const th = await page.evaluate(() => {
    const b = document.getElementById("hpVtGhi"), a = document.getElementById("hpVtPg"), hd = document.querySelector("#hpVtModal .hp-modalhd");
    const rb = b.getBoundingClientRect(), ra = a.getBoundingClientRect(), rh = hd.getBoundingClientRect();
    const tieuDe = hd.firstElementChild.getBoundingClientRect(), cum = b.closest(".hp-vtacts").getBoundingClientRect();
    return { hien: getComputedStyle(b).display !== "none", cham: Math.round(Math.min(rb.width, rb.height)), duoiLink: rb.top >= ra.bottom - 2, right: Math.round(rb.right), vw: innerWidth,
      hdCao: Math.round(rh.height), tieuDe: Math.round(tieuDe.height), cum: Math.round(cum.height), cuonNgang: document.documentElement.scrollWidth > innerWidth + 1, fs: getComputedStyle(b).fontSize };
  });
  if (!th.hien) boQua("[mobile] vùng chạm nút", "ô này không hiện nút (ca A chưa đủ 3 lần)");
  else {
    ca("[mobile] Vùng chạm nút ≥ 40px (luật ④)", th.cham >= 40, th.cham + "px");
    ca("[mobile] Nằm dưới link Yêu cầu, không tràn mép phải", th.duoiLink && th.right <= th.vw, "right=" + th.right + " vw=" + th.vw);
  }
  ca("[mobile] Trang không kéo ngang (luật ①)", !th.cuonNgang);
  ca("[mobile] Cụm link+nút thấp hơn khối tiêu đề — đầu pop-up không cao thêm", th.cum <= th.tieuDe && th.hdCao <= th.tieuDe + 36, "đầu=" + th.hdCao + " tiêu đề=" + th.tieuDe + " cụm=" + th.cum);
  ca("[mobile] Cỡ chữ nút ≥ 10,5px (luật ⑥)", parseFloat(th.fs) >= 10.5, th.fs);
  await page.screenshot({ path: path.join(OUT, "popup-mobile.png") });
  if (PL.A){
    await page.evaluate(() => HPLANOGRAM.closeVt());
    ca("[mobile] Mở pop-up ô ca A", await moPopup(page, PL.A));
    const t2 = await page.evaluate(() => { const tx = document.getElementById("hpVtLt"), b = document.getElementById("hpVtGhi"); const r = (tx.textContent ? tx : b).getBoundingClientRect();
      return { lt: tx.textContent.trim(), nut: getComputedStyle(b).display !== "none", right: Math.round(r.right), vw: innerWidth, fs: parseFloat(getComputedStyle(tx).fontSize) }; });
    ca("[mobile][A] Dòng đếm hoặc nút hiện đúng 1 trong 2, không tràn mép", (!!t2.lt) !== t2.nut && t2.right <= t2.vw, JSON.stringify(t2));
    await page.screenshot({ path: path.join(OUT, "popup-mobile-caseA.png") });
  }
  await page.close();
}

/* ===== MÀN MỚI: BỘ CHỌN ẢNH BÁO CÁO trong form (iframe) trên ĐIỆN THOẠI =====================
 * Bộ chuẩn mục 6: màn/pop-up mới phải vào bộ đo. Màn này nằm trong iframe nên qc-mobile (đo page
 * chính) không với tới → đo tại đây, bám đúng 5 luật hay vỡ nhất: không kéo ngang · vùng chạm ≥40px
 * (ô ảnh + nút Thêm) · chữ ≥10,5px · không tràn mép phải · modal không cao quá màn. */
async function doMobileForm(b){
  console.log("\n══ ĐIỆN THOẠI · BỘ CHỌN ẢNH BÁO CÁO (trong form) ══");
  const page = await moTrang(b, "mobile");
  const loc0 = await choNguon(page);
  if (!loc0){ ca("[mobile-form] Sơ đồ có dữ liệu", false); await page.close(); return; }
  const PL = await phanLoai(page);
  if (!PL.Banh){ boQua("[mobile-form] Bộ chọn ảnh báo cáo", "hôm nay không có ô nào kèm ảnh báo cáo"); await page.close(); return; }
  ca("[mobile-form] Mở pop-up ô có ảnh", await moPopup(page, PL.Banh), PL.Banh);
  const duB = await page.evaluate(l => { const S = HPLANOGRAM._S; return HPLANOGRAM._soan5S(l, S.dDen || S.yc.ngay); }, PL.Banh);
  const f = await napVaoForm(page, duB);
  ca("[mobile-form] Form nhận thư viện ảnh", !!f && f.thuVien > 0, f && (f.thuVien + " ảnh"));
  const do1 = await coTran(page.evaluate(async () => {
    const fr = document.getElementById("gmFrame"), w = fr.contentWindow, d = w.document;
    const dt = w.Alpine.$data(d.querySelector("[x-data]"));
    const lb = [...d.querySelectorAll("label")].find(l => /Chọn từ ảnh báo cáo|Chọn từ thư viện/.test(l.textContent));
    if (lb) lb.click(); else dt.moBC = true;                      // mở bằng CHẠM thật như người dùng
    await new Promise(r => setTimeout(r, 500));
    const hop = d.querySelector("[x-show='moBC'] > div");
    const o = [...d.querySelectorAll("[x-show='moBC'] button.h-24")];
    const nutThem = [...d.querySelectorAll("[x-show='moBC'] button")].find(b => /Thêm/.test(b.textContent));
    /* CHẠM THẬT vào ô ảnh đầu — luật ⑤: vùng chạm phải BẤM ĐƯỢC thật, không chỉ đủ 40px */
    let chamAn = false;
    if (o[0]){ o[0].click(); await new Promise(r => setTimeout(r, 200)); chamAn = dt.soChonBC() === 1 && /✓/.test(o[0].textContent); o[0].click(); await new Promise(r => setTimeout(r, 120)); }
    const nho = (el) => { const r = el.getBoundingClientRect(); return Math.round(Math.min(r.width, r.height)); };
    const chuNho = [...d.querySelectorAll("[x-show='moBC'] *")].filter(el => el.children.length === 0 && el.textContent.trim())
      .map(el => ({ t: el.textContent.trim().slice(0, 24), px: parseFloat(getComputedStyle(el).fontSize) })).filter(x => x.px < 10.5);
    const rh = hop ? hop.getBoundingClientRect() : null;
    dt.moBC = false;
    return { soO: o.length, chamO: o.length ? Math.min(...o.map(nho)) : 0, chamThem: nutThem ? nho(nutThem) : 0, chamAn,
      tranPhai: o.some(el => el.getBoundingClientRect().right > w.innerWidth + 1) || (rh ? rh.right > w.innerWidth + 1 : false),
      keoNgang: d.documentElement.scrollWidth > w.innerWidth + 1, caoHop: rh ? Math.round(rh.height) : 0, vh: w.innerHeight,
      chuNho: chuNho.slice(0, 3) };
  }), 40000, "bộ chọn ảnh trên điện thoại");
  ca("[mobile-form] Lưới ảnh hiện đủ ô", do1.soO > 0, do1.soO + " ô");
  ca("[mobile-form] Vùng chạm ô ảnh ≥ 40px (luật ④)", do1.chamO >= 40, do1.chamO + "px");
  ca("[mobile-form] CHẠM THẬT vào ô ảnh là tick được (luật ⑤ — bấm được thật, không chỉ đủ to)", do1.chamAn);
  ca("[mobile-form] Nút 'Thêm N ảnh' ≥ 40px", do1.chamThem >= 40, do1.chamThem + "px");
  ca("[mobile-form] Không tràn mép phải · không kéo ngang (luật ①②)", !do1.tranPhai && !do1.keoNgang, JSON.stringify({ tran: do1.tranPhai, keo: do1.keoNgang }));
  ca("[mobile-form] Hộp chọn không cao quá màn", do1.caoHop <= do1.vh, do1.caoHop + "px / " + do1.vh + "px");
  ca("[mobile-form] Mọi nhãn ≥ 10,5px (luật ⑥)", do1.chuNho.length === 0, JSON.stringify(do1.chuNho));
  await page.evaluate(async () => { const fr = document.getElementById("gmFrame"), w = fr.contentWindow, dt = w.Alpine.$data(w.document.querySelector("[x-data]")); dt.moBC = true; await new Promise(r => setTimeout(r, 300)); });
  await page.screenshot({ path: path.join(OUT, "bochon-anh-mobile.png") });
  await page.evaluate(() => { const fr = document.getElementById("gmFrame"), w = fr.contentWindow; w.Alpine.$data(w.document.querySelector("[x-data]")).moBC = false; _gmGuiForm({ type: "ghi5s-xoa-nap-san" }); dongGhiNhan(); });
  await page.close();
}

const b = await puppeteer.launch({ headless: "new", executablePath: EDGE_PATH, args: ["--no-sandbox", "--allow-file-access-from-files"] });
console.log("QC nút Ghi nhận 5S trong pop-up ô (bản 2 — luỹ tiến 3 lần · chụp pop-up · chọn ảnh báo cáo) · " + URL);
try { await coTran(doDesktop(b), 420000, "toàn bộ ca máy tính"); } catch (e) { ca("Ca máy tính chạy trọn", false, String(e.message || e)); }
try { await coTran(doMobile(b), 180000, "toàn bộ ca điện thoại"); } catch (e) { ca("Ca điện thoại chạy trọn", false, String(e.message || e)); }
try { await coTran(doMobileForm(b), 180000, "ca bộ chọn ảnh trên điện thoại"); } catch (e) { ca("Ca bộ chọn ảnh (điện thoại) chạy trọn", false, String(e.message || e)); }
await b.close();
fs.writeFileSync(path.join(OUT, "bao-cao.json"), JSON.stringify({ luc: new Date().toISOString(), url: URL, ca: KQ }, null, 2));
const soCa = KQ.filter(k => k.ok !== null).length;
console.log("\n═════ TỔNG KẾT: " + (soCa - soLoi) + "/" + soCa + " ca đạt" + (soLoi ? " · ✗ " + soLoi + " ca hỏng" : " · ✓ sạch") + (soBoQua ? " · ○ " + soBoQua + " bỏ qua (không có dữ liệu phù hợp)" : "") + " · ảnh + bao-cao.json: " + OUT);
process.exit(soLoi ? 1 : 0);
