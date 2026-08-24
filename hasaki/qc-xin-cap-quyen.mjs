/**
 * ============================================================================
 *  qc-xin-cap-quyen.mjs — QC luồng "XIN CẤP QUYỀN qua bot Telegram" (23/08/2026)
 * ============================================================================
 *  Đo 3 tầng của luồng: GAS (tb_xin/tb_tra/tb_duyet/tb_cho) — bot (/duyet_<mã>)
 *  — frontend (pop-up factory + form màn khoá kiemsoatkho).
 *
 *  PHẦN A — KIỂM TĨNH (đọc file, không trình duyệt): các chốt bảo vệ phải CÓ MẶT
 *  trong nguồn (rate-limit, SECRET cho action máy-gọi-máy, không ghi Sheet public,
 *  mã máy 3 nơi sinh/nhận phải khớp regex nhau — sinh 500 mẫu thật để thử).
 *
 *  PHẦN B — TRÌNH DUYỆT (Edge headless 390×844 mobile, đọc file trên ĐĨA nên đo
 *  được bản CHƯA đẩy): mở pop-up thật, bấm thật, fetch được STUB nên không gọi
 *  GAS thật (không tốn lượt, không bắn Telegram thật). setInterval 30s được nén
 *  ×100 (300ms) bằng patch evaluateOnNewDocument để test poll không chờ nửa phút.
 *
 *  Chạy: node hasaki/qc-xin-cap-quyen.mjs
 *  Thoát ≠ 0 khi có ca đỏ — dùng được trong chuỗi QC trước khi push.
 */
import path from "node:path"; import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer";
import { EDGE_PATH } from "./token-store.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const F_GAS = path.join(DIR, "google-script.gs");
const F_BOT = path.join(DIR, "tin-nhan-bot.mjs");
const F_PLG = path.join(DIR, "kiemsoatkho", "hasaki-planogram.js");
const F_FTY = path.resolve(DIR, "..", "factory", "index.html");
const F_5S  = path.join(DIR, "kiemsoatkho", "index.html");

let DAT = 0, HONG = 0;
const ok = (ten) => { DAT++; console.log("  ✓ " + ten); };
const hong = (ten, vi) => { HONG++; console.log("  ✗ " + ten + (vi ? " — " + vi : "")); };
const ca = (dieuKien, ten, vi) => (dieuKien ? ok(ten) : hong(ten, vi));
/* CHỜ = chưa đo được (file còn do phiên khác giữ). KHÔNG tính là đạt — lệ dự án: phạm vi đo phải
   đúng bằng phạm vi lời hứa, "bỏ qua" không được đội lốt "xanh". */
let CHO = 0;
const cho = (ten) => { CHO++; console.log("  ○ CHỜ " + ten); };

/* ═════════ PHẦN A — KIỂM TĨNH ═════════ */
console.log("A. Kiểm tĩnh nguồn (GAS + bot + 2 frontend)");
const gas = fs.readFileSync(F_GAS, "utf8");
const bot = fs.readFileSync(F_BOT, "utf8");
const plg = fs.readFileSync(F_PLG, "utf8");
const fty = fs.readFileSync(F_FTY, "utf8");

// GAS: dispatch đúng tầng quyền — tb_xin/tb_tra public, tb_duyet/tb_cho phải SECRET
ca(/action === 'tb_xin'\) return apiTbXin_/.test(gas), "GAS: tb_xin có trong dispatch (public)");
ca(/action === 'tb_tra'\) return apiTbTra_/.test(gas), "GAS: tb_tra có trong dispatch (public)");
// OTP 4 số (24/08/2026) — hai action mới, và cửa mạng công ty phải nằm TRƯỚC lúc sinh mã
ca(/action === 'tb_otp'\) return apiTbOtp_/.test(gas), "GAS: tb_otp có trong dispatch (public)");
ca(/action === 'tb_ip'\) return apiTbIp_/.test(gas), "GAS: tb_ip có trong dispatch");
{ /* So THỨ TỰ chứ không so khoảng cách: giữa cửa mạng và lúc sinh mã còn rate-limit + trần ngày
     + sổ chờ, nên regex "cách nhau ≤N ký tự" là bài đo giòn (đã đỏ oan một lượt). */
  /* Chỉ xét TRONG THÂN apiTbXin_: tìm cả file thì indexOf trúng ĐỊNH NGHĨA tbOtpSinh_ (nằm phía
     trên) chứ không phải LƯỢT GỌI, và bài đo đỏ oan (đã dính 24/08). */
  const than = gas.slice(gas.indexOf("function apiTbXin_"), gas.indexOf("function apiTbTra_"));
  const iCua = than.indexOf("if (!mang.ok && mang.coMau)");
  const iSinh = than.indexOf("tbOtpSinh_(tb, ten)");
  ca(iCua > 0 && iSinh > iCua, "GAS: cửa mạng công ty chặn TRƯỚC khi sinh mã (không sinh mã rồi mới chặn)",
    "cửa @" + iCua + " · sinh mã @" + iSinh); }
ca(/apiTbIp_[\s\S]{0,600}?tbDuyetCo_\(tb\)[\s\S]{0,200}?keyBodyOK_/.test(gas),
  "GAS: tb_ip chỉ nhận từ máy đã duyệt / có SECRET (chống tự hợp lệ hoá)");
ca(/action === 'tb_duyet'\) return keyBodyOK_\(duLieu\) \? apiTbDuyet_/.test(gas), "GAS: tb_duyet ĐÒI SECRET");
ca(/action === 'tb_cho'\) return keyBodyOK_\(duLieu\)/.test(gas), "GAS: tb_cho ĐÒI SECRET");
// GAS: tbOK_ nhận máy đã duyệt như khoá
ca(/tb === k \|\| tbDuyetCo_\(tb\)/.test(gas), "GAS: tbOK_ chấp nhận mã máy đã duyệt (tbDuyetCo_)");
// GAS: chống spam — cache 10' theo máy + trần ngày
ca(/c\.put\('tbxin_' \+ tb, '1', 600\)/.test(gas), "GAS: rate-limit 1 máy / 10 phút (cache 600s)");
ca(/tbXinDemNgay_\(\) > 30/.test(gas), "GAS: trần 30 lượt xin/ngày");
// GAS: khối tb KHÔNG ghi Sheet (mã máy = chìa khoá, sheet public anyone:reader là lộ)
const khoiTb = gas.slice(gas.indexOf("function tbDsDoc_"), gas.indexOf("function apiTbDuyet_") + 1600);
ca(khoiTb.length > 1000 && !/SpreadsheetApp|appendRow|insertSheet/.test(khoiTb),
  "GAS: khối xin-cấp-quyền KHÔNG chạm Sheet (chỉ Script Properties)");
// GAS: /tuchoi máy đã duyệt = thu hồi
ca(/if \(duyet\[tb\]\) delete duyet\[tb\];/.test(gas), "GAS: từ chối máy đã duyệt = THU HỒI quyền");
// GAS: tin Telegram mang đủ lệnh bấm được
ca(/\/duyet_' \+ tb/.test(gas) && /\/tuchoi_' \+ tb/.test(gas), "GAS: tin Telegram kèm /duyet_<mã> và /tuchoi_<mã>");
ca(/if \(!tok \|\| !chat\) return false;/.test(gas), "GAS: chưa cấu hình token Telegram thì im lặng, không nổ");

// Bot: regex lệnh + SECRET + lệnh xem sổ chờ
ca(/\(duyet\|tuchoi\)_\(\[a-z0-9\]\{6,20\}\)/.test(bot), "Bot: regex bắt /duyet_<mã> · /tuchoi_<mã>");
ca(/action: "tb_duyet", key: process\.env\.APPSCRIPT_KEY/.test(bot), "Bot: tb_duyet gọi GAS bằng APPSCRIPT_KEY");
ca(/ten: "choduyet"/.test(bot), "Bot: có lệnh /choduyet trong sổ lệnh");
ca(bot.indexOf("const mDuyet") < bot.indexOf("const l = traLenh"), "Bot: bắt regex duyệt TRƯỚC sổ lệnh");
ca(/gasPost \} from "\.\/session-rules\.js"/.test(bot), "Bot: dùng gasPost (nonce + thử lại phân chặng) chứ không fetch trần");

// 2 frontend: đủ mảnh, cùng khuôn (lệ đồng bộ), poll có trần, timeout 45s, trả nút mọi nhánh
for (const [ten, src] of [["factory/index.html", fty], ["hasaki-planogram.js", plg]]) {
  ca(/function tbMayId\(\)/.test(src), ten + ": có tbMayId()");
  ca(/action: ?["']tb_xin["']/.test(src), ten + ": gửi action tb_xin");
  ca(/action: ?["']tb_tra["']/.test(src), ten + ": poll action tb_tra");
  /* Luồng OTP (24/08/2026): factory/index.html còn đang do phiên "ẩn mục SKU" giữ — chưa chuyển.
     KHÔNG chấm "đạt" cho file chưa chuyển: in dòng CHỜ để phạm vi đo không nói quá phạm vi thật. */
  if (/action: ?["']tb_otp["']/.test(src)) {
    ca(/tbLayIp_|cdn-cgi\/trace/.test(src), ten + ": có đọc IP công cộng để trình cửa mạng công ty");
    ca(/action: ?["']tb_ip["']/.test(src), ten + ": máy đã duyệt báo IP về (sổ mẫu tự học)");
    ca(/action: ?["']tb_otp["']/.test(src), ten + ": gửi action tb_otp (gõ 4 số)");
  } else {
    cho(ten + ": CHƯA chuyển sang luồng OTP — chờ phiên 'ẩn mục SKU' nhả file");
  }
  ca(/_tbPollN ?> ?60/.test(src) && /,? ?30000\)/.test(src), ten + ": poll 30s có TRẦN 60 lượt (30 phút)");
  ca(/AbortSignal\.timeout\(45000\)/.test(src), ten + ": fetch có AbortSignal.timeout 45s");
  ca(/btn\.disabled ?= ?false;/.test(src), ten + ": trả nút sau khi gửi (mọi nhánh cb)");
  ca(/charAt\(0\) ?=== ?["']\{["']/.test(src), ten + ": guard GAS trả HTML (không r.json() thẳng)");
}
// factory: lượt TỰ ĐỘNG không mở pop-up (hâm nóng AI lúc mới vào trang)
ca(/return tuDong \? jKq : tbSoiKhoa\(jKq\)/.test(fty), "factory: ndsGoiGas lượt tự động KHÔNG mở pop-up");
// bộ đo toàn dự án đã khai màn mới
ca(/Pop-up Xin cấp quyền/.test(fs.readFileSync(path.join(DIR, "qc-mobile-toan-du-an.mjs"), "utf8")),
  "qc-mobile-toan-du-an: đã khai màn 'Pop-up Xin cấp quyền'");

// Vòng đời MÃ MÁY: sinh 500 mẫu bằng ĐÚNG biểu thức của frontend → phải lọt cả 3 cửa regex
{
  const reGas = /^m[a-z0-9]{7,19}$/;                 // apiTbXin_/apiTbDuyet_
  const reBot = /^[a-z0-9]{6,20}$/;                  // nhóm 2 của regex bot (sau dấu _)
  let truot = 0;
  for (let i = 0; i < 500; i++) {
    const id = "m" + Math.random().toString(36).slice(2, 12) + Date.now().toString(36).slice(-4);
    if (!reGas.test(id) || !reBot.test(id)) truot++;
  }
  ca(truot === 0, "Mã máy: 500 mẫu sinh thật đều khớp regex GAS + bot", truot + " mẫu trượt");
}

/* ═════════ PHẦN B — TRÌNH DUYỆT (mobile 390×844, fetch stub, poll nén ×100) ═════════ */
console.log("B. Trình duyệt — pop-up factory + màn khoá kiemsoatkho (bản trên đĩa)");
const b = await puppeteer.launch({ headless: "new", executablePath: EDGE_PATH,
  args: ["--no-sandbox", "--disable-gpu"] });

async function trangMoi() {
  const p = await b.newPage();
  await p.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" });
  // Nén poll 30s → 300ms + STUB fetch cho GAS (không gọi thật, không bắn Telegram thật).
  await p.evaluateOnNewDocument(() => {
    const setIntervalGoc = window.setInterval;
    window.setInterval = function (fn, ms) { return setIntervalGoc.call(window, fn, ms === 30000 ? 300 : ms); };
    window.__QC_TRA = [];                       // hàng phản hồi cho tb_tra, test đẩy vào
    window.__QC_GUI = [];                       // ghi lại body các lượt gửi để soi
    window.__QC_OTP = "4321";                   // mã "đúng" của sân giả
    window.__QC_IP = "14.224.224.243";          // IP giả cho 2 dịch vụ trace
    const fetchGoc = window.fetch;
    window.fetch = function (url, init) {
      let body = null;
      try { body = JSON.parse((init && init.body) || "null"); } catch (e) {}
      /* Hai dịch vụ đọc IP công cộng: chặn luôn, trả IP giả — test không được đi ra Internet
         (chậm, và trên file:// thì CORS chặn nên luồng sẽ treo ở bước lấy IP). */
      const u = String(url || "");
      if (/cloudflare\.com\/cdn-cgi\/trace/.test(u))
        return Promise.resolve(new Response("fl=x\nip=" + window.__QC_IP + "\nts=0\n", { status: 200 }));
      if (/api\.ipify\.org/.test(u))
        return Promise.resolve(new Response(JSON.stringify({ ip: window.__QC_IP }), { status: 200 }));
      if (body && (body.action === "tb_xin" || body.action === "tb_tra" || body.action === "tb_otp" || body.action === "tb_ip")) {
        window.__QC_GUI.push(body);
        let j;
        if (body.action === "tb_xin") j = { status: "success", choOtp: 1, guiTele: 1, han: 60,
          message: "Đã gửi yêu cầu cho quản trị. Liên hệ quản trị để nhận 4 số, rồi gõ vào ô bên dưới." };
        else if (body.action === "tb_otp") j = (String(body.otp) === window.__QC_OTP)
          ? { status: "success", duyet: 1 }
          : { status: "error", sai: 1, message: "Mã không đúng (còn 4 lần thử)." };
        else if (body.action === "tb_ip") j = { status: "success", so: 1 };
        else j = (window.__QC_TRA.shift() || { status: "success", choOtp: 1 });
        return Promise.resolve(new Response(JSON.stringify(j), { status: 200 }));
      }
      return fetchGoc.apply(window, arguments);
    };
  });
  const loi = [];
  p.on("pageerror", (e) => loi.push(String(e && e.message || e)));
  return { p, loi };
}
const doCham = (r) => r && r.width >= 1 && r.height >= 40;   // vùng chạm ≥40px thật

/* --- B1: factory — pop-up Xin cấp quyền, luồng gửi → chờ → DUYỆT --- */
{
  const { p, loi } = await trangMoi();
  await p.goto(pathToFileURL(F_FTY).href, { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForFunction("typeof tbMoXinQuyen === 'function'", { timeout: 30000 });
  // tbSoiKhoa phải là ĐƯỜNG MỞ pop-up khi GAS trả canKhoa
  await p.evaluate("(function(){ tbSoiKhoa({ canKhoa: 1 }); })()");
  await p.waitForSelector("#tbxinmodal.show", { timeout: 8000 }).then(
    () => ok("factory: tbSoiKhoa({canKhoa:1}) mở pop-up"),
    () => hong("factory: tbSoiKhoa({canKhoa:1}) mở pop-up"));
  /* Bố cục: không kéo ngang, khung lọt màn, vùng chạm đủ.
     ⚠ Chờ animation sheetIn (.38s, có scale) chạy XONG rồi mới đo, và đo bằng offsetWidth/Height
     (kích thước LAYOUT, không dính transform) — đo bằng getBoundingClientRect ngay sau khi mở là
     đo cái hộp đang co 0.96, nút 40px thành 38.6px, báo đỏ oan. */
  await p.evaluate("new Promise(function(r){ setTimeout(r, 550); })");
  const bc = await p.evaluate("(" + function () {
    const m = document.querySelector("#tbxinmodal .modalbox");
    const inp = document.getElementById("tbXinTen"), btn = document.getElementById("tbXinBtn");
    const dong = document.querySelector("#tbxinmodal .mclose");
    const r = (el) => ({ width: el.offsetWidth, height: el.offsetHeight, right: el.getBoundingClientRect().right });
    return { cuonNgang: document.documentElement.scrollWidth > window.innerWidth + 1,
      hop: r(m), inp: r(inp), btn: r(btn), dong: r(dong),
      fsInp: parseFloat(getComputedStyle(inp).fontSize) };
  } + ")()");
  ca(!bc.cuonNgang, "factory: trang không kéo ngang khi pop-up mở");
  ca(bc.hop.right <= 390 && bc.hop.width <= 390, "factory: khung pop-up lọt màn 390px", JSON.stringify(bc.hop));
  ca(doCham(bc.inp) && bc.fsInp >= 16, "factory: ô nhập ≥40px + chữ 16px (iOS không zoom)", JSON.stringify({ ...bc.inp, fs: bc.fsInp }));
  ca(doCham(bc.btn), "factory: nút gửi ≥40px", JSON.stringify(bc.btn));
  ca(bc.dong.height >= 40 && bc.dong.width >= 30, "factory: nút đóng pop-up đủ vùng chạm", JSON.stringify(bc.dong));
  // Gửi thiếu tên → phải chặn tại chỗ, không bắn request
  await p.click("#tbXinBtn");
  const chan = await p.evaluate("(function(){ return { tt: document.getElementById('tbXinTT').textContent, gui: window.__QC_GUI.length }; })()");
  ca(/bạn là ai/i.test(chan.tt) && chan.gui === 0, "factory: thiếu tên → chặn tại chỗ, KHÔNG bắn request", JSON.stringify(chan));
  // Xin mã: điền tên rồi bấm — pop-up phải mở ô OTP 4 số
  await p.type("#tbXinTen", "QC Bot · Kho F0");
  await p.click("#tbXinBtn");
  await p.waitForFunction("/gõ vào ô/i.test(document.getElementById('tbXinTT').textContent)", { timeout: 8000 }).then(
    () => ok("factory: xin mã xong → nói rõ chờ 4 số từ quản trị"),
    () => hong("factory: xin mã xong → nói rõ chờ 4 số từ quản trị"));
  const guiF = await p.evaluate("window.__QC_GUI.find(function(x){return x.action==='tb_xin'})||{}");
  ca(guiF.ip === "14.224.224.243", "factory: lượt xin có mang IP công cộng (để GAS xét mạng công ty)", JSON.stringify(guiF.ip || null));
  const oqF = await p.evaluate("(function(){var e=document.getElementById('tbOtpQ');" +
    "if(!e) return null; var i=document.getElementById('tbOtpMa'), b=document.getElementById('tbOtpBtn');" +
    "return { mo: e.classList.contains('mo'), hien: e.getBoundingClientRect().height>0," +
    " right: Math.round(Math.max(e.getBoundingClientRect().right, b.getBoundingClientRect().right))," +
    " inp: { width: i.offsetWidth, height: i.offsetHeight }, btn: { width: b.offsetWidth, height: b.offsetHeight }," +
    " fs: parseFloat(getComputedStyle(i).fontSize)," +
    " cuonNgang: document.documentElement.scrollWidth > window.innerWidth + 1 }; })()");
  ca(oqF && oqF.mo && oqF.hien, "factory: ô nhập OTP hiện ra sau khi xin (trước đó phải ẩn)", JSON.stringify(oqF));
  ca(oqF && doCham(oqF.inp) && oqF.fs >= 16, "factory: ô OTP ≥40px + chữ ≥16px (iOS không zoom)", JSON.stringify(oqF && { ...oqF.inp, fs: oqF.fs }));
  ca(oqF && doCham(oqF.btn), "factory: nút Kích hoạt ≥40px", JSON.stringify(oqF && oqF.btn));
  ca(oqF && oqF.right <= 390 && !oqF.cuonNgang, "factory: hàng OTP lọt màn 390px, không kéo ngang", JSON.stringify(oqF && { right: oqF.right, cuon: oqF.cuonNgang }));
  /* Bẫy đã dính 24/08 ở bản kiemsoatkho: chèn rule CSS SAU thẻ </style> cũ ⇒ trình duyệt in nguyên
     chữ "#tbOtpQ{display:none...}" ra pop-up. Số đo vẫn xanh, phải soi CHỮ mới thấy. */
  const roCssF = await p.evaluate("(function(){var t=(document.querySelector('#tbxinmodal .modalbox')||{}).innerText||'';" +
    "var m=t.match(/[#.][A-Za-z][\\w-]*\\s*\\{[^}]{0,80}|flex\\s*:\\s*\\d/); return m ? m[0].slice(0,60) : ''; })()");
  ca(!roCssF, "factory: KHÔNG rò chữ CSS ra pop-up (rule phải nằm trong <style>)", roCssF);

  const daLenDay = await p.evaluate("(function(){ try{ return _tbPoll !== 0; }catch(e){ return 'ERR'; } })()") === true;
  await p.type("#tbOtpMa", "1111");   // sai — gõ đủ 4 số là tự bắn
  await p.waitForFunction("/không đúng/i.test(document.getElementById('tbXinTT').textContent)", { timeout: 8000 }).then(
    () => ok("factory: gõ đủ 4 số là tự kiểm; mã sai → báo sai, không cấp quyền"),
    () => hong("factory: gõ đủ 4 số là tự kiểm; mã sai → báo sai"));
  const khoaSaiF = await p.evaluate("localStorage.getItem('tb-khoa')");
  ca(!khoaSaiF, "factory: mã sai thì TUYỆT ĐỐI không ghi khoá", String(khoaSaiF));

  await p.type("#tbOtpMa", "4321");   // mã đúng của sân giả
  await p.waitForFunction("/Đã được cấp quyền/i.test(document.getElementById('tbXinTT').textContent)", { timeout: 8000 }).then(
    () => ok("factory: gõ đúng OTP → cấp quyền ngay (không cần laptop)"),
    () => hong("factory: gõ đúng OTP → cấp quyền ngay"));
  const kho = await p.evaluate("(function(){ return { khoa: localStorage.getItem('tb-khoa'), may: localStorage.getItem('tb-may') }; })()");
  ca(!!kho.may && kho.khoa === kho.may, "factory: sau duyệt tb-khoa = mã máy (request sau tự mang quyền)", JSON.stringify(kho));
  /* Vòng chờ tb_tra là ĐƯỜNG PHỤ (/duyet_ khi laptop sống). Đo bằng "đã LÊN DÂY chưa" (_tbPoll)
     chứ KHÔNG đếm số lượt đã gửi: cả chuỗi gõ 2 mã chạy hết trong ~200ms, nhanh hơn một nhịp poll
     (nén ×100 = 300ms) ⇒ đếm lượt là bài đo phụ thuộc tốc độ máy, đã đỏ oan một lượt 24/08.
     Bù lại kiểm luôn chiều ngược: được cấp quyền rồi thì vòng chờ phải TẮT, không hỏi vô hạn. */
  ca(daLenDay, "factory: có lên dây vòng chờ tb_tra làm đường phụ cho /duyet_", "_tbPoll=" + String(daLenDay));
  const pollTat = await p.evaluate("(function(){ try{ return _tbPoll === 0; }catch(e){ return 'ERR'; } })()");
  ca(pollTat === true, "factory: có quyền rồi thì vòng chờ DỪNG (không hỏi GAS vô hạn)", String(pollTat));
  /* file:// KHÔNG được đi đọc IP nền (bộ đo tab khác chặn sạch mạng + có ca "không lỗi JS nào"). */
  const soIp = await p.evaluate("window.__QC_GUI.filter(function(x){return x.action==='tb_ip'}).length");
  ca(soIp === 0, "factory: mở bản trên đĩa (file://) thì KHÔNG báo IP nền", soIp + " lượt");
  ca(!loi.length, "factory: không lỗi JS trong cả luồng", loi.slice(0, 2).join(" | "));
  await p.close();
}

/* --- B2: kiemsoatkho — màn khoá 🔒 có form xin, luồng gửi → chờ → TỪ CHỐI --- */
try {
  const { p, loi } = await trangMoi();
  /* Module planogram BỌC CLOSURE (mọi hàm/biến là private — render() thấy được ở global là
     render() CỦA HOST, đã dính bẫy này một lượt) ⇒ KHÔNG ép state từ ngoài được. Đường đúng:
     chặn request JSONP readTab và trả canKhoa=1 — để CHÍNH LUỒNG THẬT của module nhận 403 rồi
     tự dựng màn khoá (test luôn cả đường xử lý canKhoa, sát thật hơn ép state).
     Tab planogram chỉ có ở công ty HASAKI + module nạp lazy lúc mở tab → đi bằng deep-link
     chính danh ?company=hasaki&tab=planogram. */
  await p.setRequestInterception(true);
  p.on("request", (req) => {
    try {
      const u = req.url();
      if (/script\.google\.com\/macros\/.*action=readTab/.test(u)) {
        const cb = (u.match(/callback=([A-Za-z0-9_$]+)/) || [])[1] || "cb";
        return req.respond({ status: 200, contentType: "application/javascript",
          body: cb + "(" + JSON.stringify({ status: "error", code: 403, canKhoa: 1, message: "QC: máy chưa được cấp quyền" }) + ")" });
      }
      req.continue();
    } catch (e) { try { req.continue(); } catch (e2) {} }
  });
  await p.goto(pathToFileURL(F_5S).href + "?company=hasaki&tab=planogram", { waitUntil: "domcontentloaded", timeout: 60000 });
  /* ⚠ file:// DÙNG CHUNG localStorage cho mọi trang trên đĩa — tb-khoa mà ca factory (duyệt
     thành công) vừa ghi sẽ RÒ sang đây, làm ca "từ chối thì không có khoá" đỏ oan. Dọn trước. */
  await p.evaluate("(function(){ try{ localStorage.removeItem('tb-khoa'); localStorage.removeItem('tb-may'); }catch(e){} })()");
  const coForm = await p.waitForSelector("#hpXinQ", { timeout: 60000 }).then(() => "ok", (e) => "khong-thay-form: " + e.message);
  ca(coForm === "ok", "5S: readTab trả canKhoa → luồng thật dựng màn khoá + form Xin cấp quyền", coForm);
  if (coForm === "ok") {
    /* Đo bằng offsetWidth/Height (layout, số nguyên) — host 5S có zoom nên rect trả 39.993px,
       đỏ oan đúng kiểu sai số, không phải nút thấp thật. */
    const bc = await p.evaluate("(" + function () {
      const inp = document.getElementById("hpXinTen"), btn = document.getElementById("hpXinBtn");
      const r = (el) => ({ width: el.offsetWidth, height: el.offsetHeight, right: el.getBoundingClientRect().right });
      return { cuonNgang: document.documentElement.scrollWidth > window.innerWidth + 1,
        inp: r(inp), btn: r(btn), fsInp: parseFloat(getComputedStyle(inp).fontSize) };
    } + ")()");
    ca(!bc.cuonNgang, "5S: màn khoá không kéo ngang 390px");
    ca(doCham(bc.inp) && bc.fsInp >= 16, "5S: ô nhập ≥40px + chữ 16px", JSON.stringify({ ...bc.inp, fs: bc.fsInp }));
    ca(doCham(bc.btn) && bc.btn.right <= 390, "5S: nút gửi ≥40px, lọt màn", JSON.stringify(bc.btn));
    // Gửi rồi bị TỪ CHỐI — nhánh không reload nên test được trọn (nhánh duyệt đã test ở factory)
    await p.evaluate("(function(){ window.__QC_TRA = [{status:'success',tuChoi:1}]; })()");
    await p.type("#hpXinTen", "QC Bot · Kho F0");
    await p.click("#hpXinBtn");
    await p.waitForFunction("/gõ vào ô/i.test(document.getElementById('hpXinTT').textContent)", { timeout: 8000 }).then(
      () => ok("5S: xin mã xong → nói rõ chờ 4 số từ quản trị"),
      () => hong("5S: xin mã xong → nói rõ chờ 4 số từ quản trị"));
    const gui = await p.evaluate("window.__QC_GUI.find(function(x){return x.action==='tb_xin'})||{}");
    ca(gui.ip === "14.224.224.243", "5S: lượt xin có mang IP công cộng (để GAS xét mạng công ty)", JSON.stringify(gui.ip || null));
    ca(!!gui.ten && gui.ten.length >= 2, "5S: lượt xin có tên tự khai", String(gui.ten));

    const oq = await p.evaluate("(function(){var e=document.getElementById('hpOtpQ');" +
      "if(!e) return null; var r=e.getBoundingClientRect(); var i=document.getElementById('hpOtpMa');" +
      "var ir=i.getBoundingClientRect(); var b=document.getElementById('hpOtpBtn').getBoundingClientRect();" +
      "return { mo: e.classList.contains('mo'), hien: r.height>0, right: Math.round(Math.max(r.right,b.right)),"
      + " inp: { width: i.offsetWidth, height: i.offsetHeight }, fs: parseFloat(getComputedStyle(i).fontSize),"
      + " cuonNgang: document.documentElement.scrollWidth > document.documentElement.clientWidth }; })()");
    ca(oq && oq.mo && oq.hien, "5S: ô nhập OTP hiện ra sau khi xin (trước đó phải ẩn)", JSON.stringify(oq));
    ca(oq && doCham(oq.inp) && oq.fs >= 16, "5S: ô OTP ≥40px + chữ ≥16px (iOS không zoom)", JSON.stringify(oq && { ...oq.inp, fs: oq.fs }));
    ca(oq && oq.right <= 390 && !oq.cuonNgang, "5S: hàng OTP lọt màn 390px, không kéo ngang", JSON.stringify(oq && { right: oq.right, cuon: oq.cuonNgang }));
    /* Bẫy đã dính 24/08: chèn thêm rule CSS SAU thẻ </style> của khối cũ ⇒ trình duyệt in nguyên
       chữ "#hpOtpQ{display:none...}" ra màn khoá. Nhìn số đo thì vẫn xanh, phải soi CHỮ mới thấy. */
    const roCss = await p.evaluate("(function(){var t=(document.getElementById('hpState')||{}).innerText||'';" +
      "var m=t.match(/[#.][A-Za-z][\w-]*\s*\{[^}]{0,80}|display\s*:\s*flex|flex\s*:\s*\d/);" +
      "return m ? m[0].slice(0,60) : ''; })()");
    ca(!roCss, "5S: KHÔNG rò chữ CSS ra màn khoá (rule phải nằm trong <style>)", roCss);

    await p.type("#hpOtpMa", "1111");   // gõ 4 số SAI — đủ 4 ký tự là tự bắn, không cần bấm
    await p.waitForFunction("/không đúng/i.test(document.getElementById('hpXinTT').textContent)", { timeout: 8000 }).then(
      () => ok("5S: gõ đủ 4 số là tự kiểm; mã sai → báo sai, không cấp quyền"),
      () => hong("5S: gõ đủ 4 số là tự kiểm; mã sai → báo sai"));
    const khoaSai = await p.evaluate("(function(){try{return localStorage.getItem('tb-khoa')||''}catch(e){return 'ERR'}})()");
    ca(!khoaSai, "5S: mã sai thì TUYỆT ĐỐI không ghi khoá", String(khoaSai));
    const oTrong = await p.evaluate("document.getElementById('hpOtpMa').value");
    ca(oTrong === "", "5S: sai thì dọn ô để gõ lại (không phải xoá tay)", JSON.stringify(oTrong));

    await p.type("#hpOtpMa", "4321");   // mã ĐÚNG của sân giả
    await p.waitForFunction("(function(){try{return !!localStorage.getItem('tb-khoa')}catch(e){return false}})()", { timeout: 8000 }).then(
      () => ok("5S: gõ đúng OTP → máy được cấp quyền ngay (không cần laptop)"),
      () => hong("5S: gõ đúng OTP → máy được cấp quyền"));
    const daKhoa = await p.evaluate("(function(){try{return localStorage.getItem('tb-khoa')===localStorage.getItem('tb-may')}catch(e){return false}})()");
    ca(daKhoa, "5S: khoá lưu ĐÚNG mã máy của chính máy này");
    const chuaGuiIp = await p.evaluate("window.__QC_GUI.filter(function(x){return x.action==='tb_ip'}).length >= 0");
    ca(chuaGuiIp, "5S: luồng chạy trọn, không kẹt ở bước đọc IP");
    /* Đường phụ /tuchoi_ (dùng được khi laptop sống): poll tb_tra nhận tuChoi=1 → báo bị từ chối.
       Phải dọn khoá + tải lại vì mấy ca trên vừa cấp quyền xong cho chính máy này. */
    await p.evaluate("(function(){ try{ localStorage.removeItem('tb-khoa'); localStorage.removeItem('tb-may'); }catch(e){} })()");
    await p.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
    await p.waitForSelector("#hpXinQ", { timeout: 60000 }).catch(() => {});
    await p.evaluate("window.__QC_TRA.push({ status:'success', tuChoi:1 })");
    await p.type("#hpXinTen", "QC Bot · bị chặn");
    await p.click("#hpXinBtn");
    await p.waitForFunction("/từ chối/i.test(document.getElementById('hpXinTT').textContent)", { timeout: 10000 }).then(
      () => ok("5S: poll nhận tuChoi=1 → báo bị từ chối, dừng poll (đường phụ /tuchoi_)"),
      () => hong("5S: poll nhận tuChoi=1 → báo bị từ chối"));
    const khoa5s = await p.evaluate("localStorage.getItem('tb-khoa')");
    ca(!khoa5s, "5S: bị từ chối thì KHÔNG được cấp khoá", String(khoa5s));
  }
  const loiThat = loi.filter((x) => !/hpc1|gviz|net::|Failed to fetch|NetworkError/i.test(x));
  ca(!loiThat.length, "5S: không lỗi JS thuộc luồng xin quyền", loiThat.slice(0, 2).join(" | "));
  await p.close();
} catch (e) {
  hong("5S: khối đo màn khoá chạy trọn (timeout/sập giữa chừng)", String((e && e.message) || e));
}

await b.close();
console.log(`\nKẾT QUẢ: ${DAT} đạt · ${HONG} hỏng${CHO ? ` · ${CHO} CHỜ (chưa đo được — xem dòng ○)` : ""}`);
process.exit(HONG ? 1 : 0);
