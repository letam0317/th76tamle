/* tai-khoan.js — ĐĂNG NHẬP + PHÂN QUYỀN dùng chung Audit Retail ⇄ Audit Factory (14/10/2026). SỬA Ở ĐÂY RỒI CHÉP SANG factory/tai-khoan.js.
 * User: «nút cấp ID và mật khẩu; tài khoản tôi là quản lý cao nhất; phân quyền người được cấp ID xem được gì và làm được gì với cái được xem».
 *  · Tài khoản + phiên ở Apps Script (google-script-TaiKhoan.gs, lệnh tk_*) ⇒ máy nào mở audit-dc cũng đăng nhập được.
 *  · Quyền mỗi tab: khong (ẩn tab) · xem (chỉ xem — ẩn nút ghi/sửa của tab) · lam (xem + thao tác). Khách (chưa đăng nhập) cũng có bộ quyền riêng
 *    do quản trị chỉnh (mặc định: như trước — mọi tab, trừ Xác minh).
 *  · Ẩn/tắt ở trang là lớp GIAO DIỆN cho đúng vai; nơi chặn thật: Apps Script (tk_*) và máy chủ Xác minh 8591 (đổi phiên qua /api/dang-nhap-tk).
 *  · Xác minh: đăng nhập ở đây xong, nếu tài khoản có quyền Xác minh thì tự xin phiên máy chủ 8591 (localStorage hx-phien) — 1 lần đăng nhập. */
(function () {
  if (window.__TK) return; window.__TK = 1;
  var GAS = location.port === "8123" && /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? "/api/tk-thu"   // bản QC: qua máy chủ nội bộ → HEAD
    : "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
  var APP = /factory|stocklocation/.test(location.pathname) ? "f" : "r";
  var API_XM = function () { try { return localStorage.getItem("hx-api") || window.HX_API || "http://127.0.0.1:8591"; } catch (e) { return window.HX_API || "http://127.0.0.1:8591"; } };   // 19/10 hàm: HX_API đổi sau khi dò đường hầm
  /* 22/10 user «phải hiển thị hạng mục con bên trong: theo tác vụ/theo máy,…»: bảng quyền theo đúng thanh bên — mục có mục con = [khoá cha|null, tên, [con…], tab thanh bên].
     Khoá cha (r.xacminh) = mức cao nhất của các con (máy chủ 8591 vẫn hỏi r.xacminh); con chưa từng lưu thì thừa hưởng quyền cha cũ. Cùng luật ở google-script-TaiKhoan.gs. */
  var NHOM = [
    ["Audit Retail", [["r.tong", "Tổng kết"], ["r.task", "Vi phạm"], ["r.hangmuc", "Quy định"], ["r.planogram", "Planogram"],
      [null, "Tồn kho chính xác", [["r.kk", "Kiểm kê"], ["r.htonbat", "Bất thường"]], "kk"],
      ["r.xacminh", "Xác minh", [["r.xm.treo", "Theo tác vụ"], ["r.xm.cam", "Theo máy"], ["r.maytram", "Máy trạm"], ["r.xm.tg", "Nhật ký"]], "xacminh"]]],
    ["Audit Factory", [["f.stock", "Trạng thái lưu trữ"], [null, "Tồn kho chính xác", [["f.kk", "Kiểm kê"], ["f.abn", "Bất thường"]], "kk"],
      ["f.plg", "Planogram"], ["f.sku", "Nhận diện SKU"], ["f.cd", "Chuyển đổi cân"], ["f.tem", "Tem vị trí"]]]
  ];
  /* chỗ ẩn của từng mục con khi «Không» (mặc định: mục cùng tên ở thanh bên) */
  var AN_CON = { "r.xm.treo": "#sideNav .s-item[data-tab='xacminh'][data-sub='treo']", "r.xm.cam": "#sideNav .s-item[data-tab='xacminh'][data-sub='cam']",
    "r.xm.tg": "#sideNav .s-item[data-tab='xacminh'][data-sub='tg']", "r.kk": "#pane-kk", "r.htonbat": "#pane-htonbat", "f.kk": "#viewKK", "f.abn": "#viewAbn" };
  var MUC = [], CHA = {};   // MUC: mọi mục lá [khoá, tên, mục cha]; CHA: khoá con → khoá cha
  NHOM.forEach(function (g) { g[1].forEach(function (t) { if (!t[2]) return MUC.push([t[0], t[1], null]);
    t[2].forEach(function (c) { MUC.push([c[0], c[1], t]); if (t[0]) CHA[c[0]] = t[0]; }); }); });
  var BAC = { khong: 0, xem: 1, lam: 2 };
  function chuanQ(q) {   // con thiếu → theo cha cũ; cha = mức cao nhất của con
    q = Object.assign({}, q || {});
    MUC.forEach(function (m) { if (q[m[0]] == null && CHA[m[0]]) q[m[0]] = q[CHA[m[0]]]; });
    NHOM.forEach(function (g) { g[1].forEach(function (t) { if (!t[0] || !t[2]) return;
      q[t[0]] = t[2].reduce(function (a, c) { return BAC[q[c[0]]] > BAC[a] ? q[c[0]] : a; }, "khong"); }); });
    return q;
  }
  /* «Thao tác» của từng tab = nút ghi/sửa dữ liệu. Quyền «xem» ẩn các nút này. [bộ chọn, tab sở hữu, chỉ khi đang ở tab đó] */
  var THAO_TAC = {
    r: [["#btnGhiNhan,.hp-vtghi", "r.task"], [".bb-up", "r.task"], ["#hpcbar,#hpcprev", "r.kk", 1], ["#hpcbar,#hpcprev", "r.htonbat", 1]],
    f: [["#pcbar,#pcprev,#hdrKkPlan", "f.kk", 1], ["#pcbar,#pcprev,#hdrKkPlan", "f.abn", 1], ["#prbar", "f.sku"], ["#tmvBtnIn", "f.tem"]]
  };
  /* 22/10 (clip user: chưa đăng nhập thấy Planogram/Tồn kho/Xác minh 1–2 giây rồi mới mất): quyền khách MẶC ĐỊNH trên trang = đúng bộ đang đặt ở máy chủ
     (Retail chỉ Tổng kết · Vi phạm · Quy định; Factory đủ) — máy chủ trả về sau chỉ chỉnh lại nếu quản trị đổi, không còn chớp mục. */
  var KHACH_GOC = (function () { var q = {}; MUC.forEach(function (m) { q[m[0]] = m[0].charAt(0) === "f" || /^r\.(tong|task|hangmuc)$/.test(m[0]) ? "lam" : "khong"; }); return chuanQ(q); })();
  var e_ = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var ls = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} } };

  var TK = window.TK = { phien: ls.get("tk-phien") || "", nguoi: null, quyen: null };
  try { var c0 = JSON.parse(ls.get("tk-nho") || "null"); if (c0 && Date.now() - c0.ts < 6 * 3600e3) { TK.nguoi = c0.nguoi || null; TK.quyen = chuanQ(c0.quyen); } } catch (e) {}
  if (!TK.quyen) TK.quyen = KHACH_GOC;

  function goi(action, d) {
    d = d || {}; d.action = action;
    return fetch(GAS, { method: "POST", body: JSON.stringify(d), redirect: "follow" }).then(function (r) { return r.json(); }).then(function (j) {
      if (j.status !== "success") { var e = new Error(j.message || "Lỗi"); e.code = j.code; throw e; } return j; });
  }
  function nho() { ls.set("tk-nho", JSON.stringify({ ts: Date.now(), nguoi: TK.nguoi, quyen: TK.quyen })); }
  function datNguoi(n, phien) {
    TK.nguoi = n; if (phien != null) { TK.phien = phien; ls.set("tk-phien", phien || null); }
    if (n) { window.HSK_NGUOI_DUNG = { ten: n.ten, code: n.id, email: n.id }; ls.set("hsk-nguoi-dung", JSON.stringify(window.HSK_NGUOI_DUNG)); }
    else { delete window.HSK_NGUOI_DUNG; ls.set("hsk-nguoi-dung", null); }
  }
  window.tkCo = function (tab, muc) { var v = (TK.quyen || {})[tab] || "khong"; return muc === "lam" ? v === "lam" : v !== "khong"; };

  /* ---------- áp quyền lên trang ---------- */
  var stQ = document.createElement("style"); stQ.id = "tkQuyenCss"; (document.head || document.documentElement).appendChild(stQ);
  function tabDangMo() { var on = document.querySelector("#sideNav .s-item.on"); return on ? APP + "." + on.dataset.tab : ""; }
  function apQuyen() {
    var q = TK.quyen || {}, css = [], cur = tabDangMo();
    var an = function (k) { return (q[k] || "khong") === "khong"; };
    NHOM.forEach(function (g) { g[1].forEach(function (t) { if ((t[0] || t[2][0][0]).charAt(0) !== APP) return;
      if (t[0] === "r.xacminh" && !TK.nguoi) return;   // 14/10 user: chưa đăng nhập vẫn thấy mục «Xác minh» (bấm → đăng nhập), chỉ ẩn mục con
      if (!t[2]) { if (an(t[0])) css.push("#sideNav .s-item[data-tab='" + t[0].slice(2) + "']{display:none!important}"); return; }
      /* mục có mục con: con nào «Không» thì ẩn phần đó; mọi con «Không» thì ẩn luôn mục ở thanh bên */
      if (t[2].every(function (c) { return an(c[0]); })) { css.push("#sideNav .s-item[data-tab='" + t[3] + "']{display:none!important}"); return; }
      t[2].forEach(function (c) { if (an(c[0])) css.push((AN_CON[c[0]] || "#sideNav .s-item[data-tab='" + c[0].slice(2) + "']") + "{display:none!important}"); }); }); });
    /* 22/10 user: khách (chưa đăng nhập) ở Retail không thấy nút chuyển sang Audit Factory — Factory chỉ vào bằng link riêng /factory/ */
    if (APP === "r" && !TK.nguoi) css.push("#adChuyen a{display:none!important}");
    /* 22/10 (clip user «chưa đăng nhập vẫn thấy mục Xác minh?»): khách không có quyền Xác minh → ẩn cả tiêu đề khoá ở thanh bên lẫn thẻ khoá ở Tổng quan
       (đăng nhập bằng nút «Đăng nhập» ở chân thanh bên). Thay luật 14/10 «khách vẫn thấy Xác minh để bấm đăng nhập». */
    if (APP === "r" && !TK.nguoi && (q["r.xacminh"] || "khong") === "khong") css.push("#sideNav .s-grp.s-khoa,.tq-gkhoa{display:none!important}");
    (THAO_TAC[APP] || []).forEach(function (x) { if (x[2] ? (cur === x[1] && q[x[1]] !== "lam") : q[x[1]] !== "lam") css.push(x[0] + "{display:none!important}"); });
    stQ.textContent = css.join("\n");
    /* tiêu đề nhóm thanh bên: ẩn khi mọi mục trong nhóm bị ẩn */
    [].slice.call(document.querySelectorAll("#sideNav .s-grp:not(.s-khoa)")).forEach(function (h) {   // 15/10 tiêu đề có khoá (Xác minh chưa đăng nhập) luôn hiện
      /* 22/10 (ảnh tult1): tính theo MỤC thấy được — khung .s-sub luôn hiện dù mọi mục bên trong đã ẩn ⇒ tiêu đề «Tồn kho»/«Xác minh» trơ trọi */
      var co = false; for (var n = h.nextElementSibling; n && !n.classList.contains("s-grp"); n = n.nextElementSibling)
        [].slice.call(n.matches(".s-item") ? [n] : n.querySelectorAll(".s-item")).forEach(function (x) { if (getComputedStyle(x).display !== "none" && getComputedStyle(n).display !== "none") co = true; });
      h.classList.toggle("tk-an", !co); });   // lớp riêng (!important) — dash-bocuc-ap.js tự ghi style.display của tiêu đề nhóm, đè mất kiểu ẩn inline
    /* đang đứng ở tab bị cấm → về Tổng quan */
    /* mục con bị cấm (vd Theo tác vụ) → sang mục con khác cùng nhóm còn quyền; không còn thì về Tổng quan */
    var on = document.querySelector("#sideNav .s-item.on");
    veQC();
    if (cur && on && getComputedStyle(on).display === "none" && !(cur === "r.xacminh" && !TK.nguoi)) {
      var ke = on.dataset.sub ? [].slice.call(on.parentNode.querySelectorAll(".s-item[data-sub]")).filter(function (x) { return getComputedStyle(x).display !== "none"; })[0] : null;
      var home = ke || document.querySelector("#sideNav .s-item[data-tab='home']"); if (home) home.click(); }
    veNut();
  }
  window.tkApQuyen = apQuyen;

  /* ---------- nút ở chân thanh bên ---------- */
  var ICON_NG = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/></svg>';
  function veNut() {
    var ch = document.getElementById("adChuyen"); if (!ch) return;
    var b = document.getElementById("tkNut");
    if (!b) { b = document.createElement("button"); b.id = "tkNut"; b.type = "button"; ch.insertBefore(b, ch.firstChild); b.onclick = function (ev) { ev.stopPropagation(); TK.nguoi ? moMenu(b) : moDangNhap(); }; }
    b.innerHTML = ICON_NG + '<span class="t">' + (TK.nguoi ? e_(TK.nguoi.id) + (TK.nguoi.vaiTro === "quantri" ? '<small>Quản trị</small>' : "") : "Đăng nhập") + "</span>";
    b.title = TK.nguoi ? "Tài khoản " + TK.nguoi.id : "Đăng nhập tài khoản";
  }
  function moMenu(b) {
    dongMenu(); var m = document.createElement("div"); m.id = "tkMenu";
    m.innerHTML = (TK.nguoi.vaiTro === "quantri" ? '<button data-a="ql">Quản lý tài khoản</button>' : "") + '<button data-a="mk">Đổi mật khẩu</button><button data-a="dx">Đăng xuất</button>';
    document.body.appendChild(m); var r = b.getBoundingClientRect(); m.style.left = r.left + "px"; m.style.bottom = (innerHeight - r.top + 4) + "px"; m.style.minWidth = r.width + "px";
    m.onclick = function (ev) { var a = ev.target.dataset.a; dongMenu(); if (a === "ql") moQuanLy(); if (a === "mk") moDoiMk(); if (a === "dx") dangXuat(); };
    setTimeout(function () { document.addEventListener("click", dongMenu, { once: true }); }, 0);
  }
  function dongMenu() { var m = document.getElementById("tkMenu"); if (m) m.remove(); }

  /* ---------- hộp thoại dùng chung (khuôn Modal antd, popIn sẵn có) ---------- */
  function hop(tieuDe, than, rong) {
    dongHop(); var o = document.createElement("div"); o.id = "tkHop";
    o.innerHTML = '<div class="tk-box" role="dialog" aria-modal="true" style="max-width:' + (rong || 400) + 'px"><div class="tk-hd"><b>' + e_(tieuDe) + '</b><button type="button" class="tk-x" aria-label="Đóng">×</button></div><div class="tk-bd">' + than + "</div></div>";
    document.body.appendChild(o); o.querySelector(".tk-x").onclick = dongHop; o.onclick = function (ev) { if (ev.target === o) dongHop(); };
    document.addEventListener("keydown", escDong); return o;
  }
  function escDong(ev) { if (ev.key === "Escape") dongHop(); }
  var sauDong = null;   // 1 lần: hộp OTP «+ Ghi nhận» cần biết hộp đã đóng (huỷ / đăng nhập xong)
  function dongHop() { var o = document.getElementById("tkHop"); if (o) o.remove(); document.removeEventListener("keydown", escDong); var f = sauDong; sauDong = null; if (f) f(); }
  function trangThai(o, cls, txt) { var s = o.querySelector(".tk-st"); s.className = "tk-st " + cls; s.textContent = txt; }

  /* ---------- 22/10 BẢN QC (qc.audit-dc.pages.dev): chỉ quản trị dùng; dấu chìm «QC» phủ toàn màn hình ----------
     User: «tài khoản được cấp chỉ thao tác/xem được trên bản chính audit-dc.pages.dev — không thao tác/xem/chỉnh sửa bố cục được ở bản qc»
     và «bản QC nên có dấu chìm QC ở toàn màn hình». Bản chính = audit-dc.pages.dev (không tên phụ). */
  var QC = /\.audit-dc\.pages\.dev$/.test(location.hostname);
  var laQT = function () { return !!(TK.nguoi && TK.nguoi.vaiTro === "quantri"); };
  function veQC() {
    if (!QC || !document.body) return;
    if (!document.getElementById("tkDauChim")) { var dc = document.createElement("div"); dc.id = "tkDauChim"; dc.setAttribute("aria-hidden", "true"); document.body.appendChild(dc); }
    var c = document.getElementById("tkCanQC");
    if (laQT()) { if (c) c.remove(); return; }
    if (!c) { c = document.createElement("div"); c.id = "tkCanQC"; document.body.appendChild(c); }
    var chinh = "https://audit-dc.pages.dev" + location.pathname + location.search + location.hash;
    c.innerHTML = '<div class="tk-box" role="dialog" aria-modal="true"><div class="tk-hd"><b>Bản QC — chỉ dành cho quản trị</b></div>' +
      '<div class="tk-bd"><div class="tk-f">' +
      '<div>' + (TK.nguoi ? "Tài khoản <b>" + e_(TK.nguoi.id) + "</b> chỉ dùng được trên bản chính."
        : "Bản này để kiểm thử trước khi phát hành. Tài khoản được cấp xem và thao tác trên bản chính.") + "</div>" +
      '<div class="tk-nut"><a class="tk-chinh tk-lk" href="' + e_(chinh) + '">Mở bản chính</a>' +
      (TK.nguoi ? '<button type="button" class="tk-chinh tk-phu" data-a="dx">Đăng xuất</button>' : '<button type="button" class="tk-chinh tk-phu" data-a="dn">Đăng nhập quản trị</button>') + "</div></div></div></div>";
    c.onclick = function (ev) { var a = ev.target.dataset && ev.target.dataset.a; if (a === "dn") moDangNhap(); if (a === "dx") dangXuat(); };
  }
  if (QC) { if (document.body) veQC(); else document.addEventListener("DOMContentLoaded", veQC); }

  function dangNhap(id, mk) {
    /* 17/10 user điện thoại «Cannot read properties of undefined (reading 'quyen')»: Apps Script chập chờn từng trả «success» mà THIẾU nguoi
       (cùng họ lỗi gas-chap-chon-404) → thử lại 1 lần; vẫn thiếu thì báo câu dễ hiểu, không để lỗi kỹ thuật rơi ra ô đăng nhập. */
    var lan = function (k) { return goi("tk_dangnhap", { id: id, mk: mk }).then(function (j) {
      if (!j.nguoi || !j.phien) { if (k) return lan(0); throw new Error("Máy chủ trả thiếu thông tin tài khoản — bấm Đăng nhập lại"); }
      if (QC && j.nguoi.vaiTro !== "quantri") { goi("tk_dangxuat", { phien: j.phien }).catch(function () {}); throw new Error("Tài khoản này chỉ dùng được trên bản chính audit-dc.pages.dev"); }
      datNguoi(j.nguoi, j.phien); TK.quyen = chuanQ(j.nguoi.quyen); nho(); apQuyen(); doiPhienXm(); bao(); return j.nguoi; }); };
    return lan(1);
  }
  window.tkDangNhap = dangNhap;
  /* ---------- 22/10 «+ Ghi nhận 5S»: bỏ PIN chung → đã đăng nhập (có quyền Vi phạm «thao tác») hoặc máy đã duyệt OTP thì mở luôn;
     khách trên máy lạ xin OTP 4 số (GAS tb_xin tự nhắn Telegram cho quản trị) — cùng đường cấp quyền máy của Planogram/Factory. ---------- */
  function mayId() {
    try { var id = localStorage.getItem("tb-may");
      if (!id || !/^m[a-z0-9]{7,19}$/.test(id)) { id = "m" + Math.random().toString(36).slice(2, 12) + Date.now().toString(36).slice(-4); localStorage.setItem("tb-may", id); }
      return id; } catch (e) { return ""; }
  }
  function layIp(cb) {
    var nho = ""; try { nho = sessionStorage.getItem("tb-ip") || ""; } catch (e) {} if (nho) return cb(nho);
    var tra = function (ip) { ip = String(ip || "").trim(); if (ip) try { sessionStorage.setItem("tb-ip", ip); } catch (e) {} cb(ip); };
    fetch("https://www.cloudflare.com/cdn-cgi/trace").then(function (r) { return r.text(); }).then(function (t) { var m = /^ip=(.+)$/m.exec(t); if (!m) throw 0; tra(m[1]); })
      .catch(function () { fetch("https://api.ipify.org?format=json").then(function (r) { return r.json(); }).then(function (j) { tra(j && j.ip); }).catch(function () { tra(""); }); });
  }
  /* 22/10 user: quyền từ OTP Ghi nhận chỉ 43 phút (tb-het, máy chủ cũng tự hết hạn) — máy duyệt lâu dài (không có tb-het) giữ như cũ */
  var duocGhi = function () {
    if (TK.nguoi) return window.tkCo("r.task", "lam");
    var het = Number(ls.get("tb-het") || 0);
    if (het && Date.now() >= het) { ls.set("tb-khoa", null); ls.set("tb-het", null); return false; }
    return !!ls.get("tb-khoa");
  };
  function moOtpGhiNhan() {
    return new Promise(function (xong) {
      var o = hop("Ghi nhận vi phạm 5S", '<form class="tk-f"><div class="tk-goiy">Máy này chưa được cấp quyền ghi nhận. Khai tên rồi bấm «Xin mã OTP» — quản trị báo bạn 4 số. Mã chỉ dùng cho đúng máy này, phải gõ trong 5 phút; gõ đúng thì được ghi nhận trong 43 phút. Chỉ xin được khi dùng Wi-Fi công ty.</div>' +
        '<label>Bạn là ai?<input name="ten" maxlength="60" required placeholder="tên · bộ phận" value="' + e_(ls.get("tb-ten") || "") + '"></label><button type="submit" class="tk-chinh">Xin mã OTP</button>' +
        '<label class="tk-otp" hidden>Mã OTP 4 số<input name="otp" inputmode="numeric" autocomplete="one-time-code" maxlength="4" pattern="[0-9]{4}"></label><button type="button" class="tk-chinh tk-otp" data-a="kich" hidden>Kích hoạt</button>' +
        '<div class="tk-goiy">Đã được cấp tài khoản? <button type="button" class="tk-chinh tk-lk2" data-a="dn">Đăng nhập</button> — không cần OTP.</div><div class="tk-st"></div></form>');
      sauDong = function () { xong(duocGhi()); };
      var f = o.querySelector("form"); f.ten.focus();
      var goiGas = function (d) { return fetch(GAS, { method: "POST", body: JSON.stringify(d), redirect: "follow" }).then(function (r) { return r.text(); })
        .then(function (t) { t = String(t).trim(); if (t.charAt(0) !== "{") throw new Error("Máy chủ chập chờn — bấm lại"); return JSON.parse(t); }); };
      f.onsubmit = function (ev) { ev.preventDefault(); var id = mayId(); if (!id) return trangThai(o, "loi", "Trình duyệt đang chặn lưu trữ (cửa sổ riêng tư?) — mở cửa sổ thường rồi thử lại.");
        ls.set("tb-ten", f.ten.value.trim()); trangThai(o, "", "Đang gửi yêu cầu…");
        layIp(function (ip) { goiGas({ action: "tb_xin", muc: "ghi5s", tb: id, ten: f.ten.value.trim(), ip: ip, trang: "kiemsoatkho", ua: (navigator.userAgent || "").slice(0, 160) })
          .then(function (j) { if (j.status !== "success") throw new Error(j.message || "Không xin được mã");
            if (j.duyet) { ls.set("tb-khoa", id); return dongHop(); }   // máy đã được duyệt lâu dài
            [].slice.call(o.querySelectorAll(".tk-otp")).forEach(function (x) { x.hidden = false; }); f.otp.focus(); trangThai(o, "ok", j.lai ? j.message : "Đã gửi — liên hệ quản trị lấy 4 số, gõ vào ô trên trong 5 phút."); })
          .catch(function (e) { trangThai(o, "loi", e.message); }); }); };
      o.querySelector('[data-a="kich"]').onclick = function () { if (!/^\d{4}$/.test(f.otp.value.trim())) return trangThai(o, "loi", "Gõ đủ 4 số");
        trangThai(o, "", "Đang kiểm…");
        goiGas({ action: "tb_otp", muc: "ghi5s", tb: mayId(), otp: f.otp.value.trim() }).then(function (j) { if (j.status !== "success") throw new Error(j.message || "Sai OTP");
          ls.set("tb-khoa", mayId()); ls.set("tb-het", j.het ? String(j.het) : null); dongHop(); }).catch(function (e) { trangThai(o, "loi", e.message); }); };
      o.querySelector('[data-a="dn"]').onclick = function () { sauDong = null; moDangNhap(); sauDong = function () { xong(duocGhi()); }; };
    });
  }
  /* bọc hộp hỏi PIN của trang (index.html hoiPin) — CHỈ khung «Ghi nhận vi phạm 5S»; các chỗ khác vẫn hỏi PIN như cũ */
  function bocHoiPin() {
    if (APP !== "r" || typeof window.hoiPin !== "function" || window.hoiPin.__tk) return;
    var goc = window.hoiPin;
    window.hoiPin = function (tieuDe) {
      if (tieuDe !== "Ghi nhận vi phạm 5S") return goc.apply(this, arguments);
      if (duocGhi()) return Promise.resolve("ok");
      if (TK.nguoi) { if (typeof window.toast === "function") window.toast("Tài khoản " + TK.nguoi.id + " chưa có quyền ghi nhận — nhờ quản trị cấp «Vi phạm: Xem + thao tác».", "loi"); return Promise.resolve(null); }
      return moOtpGhiNhan().then(function (ok) { return ok ? "ok" : null; });
    };
    window.hoiPin.__tk = 1;
    var nut = document.getElementById("btnGhiNhan"); if (nut) nut.title = "Ghi nhận vi phạm 5S";
  }

  function moDangNhap(sau) {
    var o = hop("Đăng nhập", '<form class="tk-f" autocomplete="on"><label>Tài khoản<input name="id" autocomplete="username" required placeholder="vd: tamlc" value="' + e_(ls.get("tk-id") || "") + '"></label>' +
      '<label>Mật khẩu<input name="mk" type="password" autocomplete="current-password" required></label><button type="submit" class="tk-chinh">Đăng nhập</button><div class="tk-st"></div></form>');
    var f = o.querySelector("form"); (f.id.value ? f.mk : f.id).focus();
    f.onsubmit = function (ev) { ev.preventDefault(); var nut = f.querySelector("button"); nut.disabled = true; trangThai(o, "", "Đang kiểm tra…");
      dangNhap(f.id.value, f.mk.value).then(function () {
        ls.set("tk-id", f.id.value.trim().toLowerCase().replace(/@.*$/, ""));
        dongHop();
        if (typeof window.adHuyLinkCho === "function") window.adHuyLinkCho();   // 22/10 không để link sâu cũ kéo sang mục khác sau khi về Tổng quan
        if (sau) { try { sau(); } catch (e) {} }
        try {
          if (typeof window.setTab === "function") window.setTab("home");
          else if (typeof window.showTab === "function") window.showTab("home");
        } catch (e) {}
      })
        .catch(function (e) { trangThai(o, "loi", e.message); nut.disabled = false; f.mk.select(); }); };
  }
  window.tkMoDangNhap = moDangNhap;
  function dangXuat() {
    var p = TK.phien; if (p) goi("tk_dangxuat", { phien: p }).catch(function () {});
    /* 16/10 user «đăng xuất rồi mà vẫn thấy mục con Xác minh»: 1 lần đăng xuất = thu hồi CẢ phiên máy chủ Xác minh 8591 (trước chỉ xoá ở máy) */
    var hx = ls.get("hx-phien"); if (APP === "r" && hx) fetch(API_XM() + "/api/dang-xuat", { method: "POST", headers: { "x-hx-phien": hx } }).catch(function () {});
    datNguoi(null, ""); TK.quyen = null; ls.set("tk-nho", null); ls.set("hx-phien", null);
    try { window.dispatchEvent(new Event("hx-phien")); } catch (e) {}
    apQuyen(); bao();   // dựng lại thanh bên NGAY (không chờ Apps Script trả quyền khách)
    taiKhach().then(function () { apQuyen(); bao(); });
  }
  window.tkDangXuat = dangXuat;
  function moDoiMk() {
    var o = hop("Đổi mật khẩu", '<form class="tk-f"><label>Mật khẩu hiện tại<input name="cu" type="password" autocomplete="current-password" required></label>' +
      '<label>Mật khẩu mới<input name="moi" type="password" autocomplete="new-password" minlength="4" required></label><button type="submit" class="tk-chinh">Lưu</button><div class="tk-st"></div></form>');
    var f = o.querySelector("form"); f.cu.focus();
    f.onsubmit = function (ev) { ev.preventDefault(); goi("tk_doimk", { phien: TK.phien, mkCu: f.cu.value, mkMoi: f.moi.value }).then(function () { trangThai(o, "ok", "Đã đổi mật khẩu."); setTimeout(dongHop, 900); }).catch(function (e) { trangThai(o, "loi", e.message); }); };
  }

  /* ---------- Quản lý tài khoản (chỉ quản trị) ---------- */
  var QL = null;
  function moQuanLy() {
    var o = hop("Quản lý tài khoản", '<div class="tk-ql"><div class="tk-ds"><div class="tk-st">Đang tải…</div></div><div class="tk-sua"></div></div>', 980);
    goi("tk_ds", { phien: TK.phien }).then(function (j) { QL = j; veDs(o); suaTk(o, null); }).catch(function (e) { trangThai(o, "loi", e.message); });
  }
  function nhanVT(x) { return x.vaiTro === "quantri" ? "Quản trị" : "Người dùng"; }
  function veDs(o) {
    var el = o.querySelector(".tk-ds");
    el.innerHTML = '<button type="button" class="tk-chinh tk-them">+ Thêm tài khoản</button><div class="tk-dong tk-khach" data-id=""><b>Khách</b><span>chưa đăng nhập</span></div>' +
      QL.ds.map(function (x) { return '<div class="tk-dong" data-id="' + e_(x.id) + '"><b>' + e_(x.id) + '</b><span>' + e_(x.ten !== x.id ? x.ten + " · " : "") + nhanVT(x) + (x.khoa ? " · đã khoá" : "") + "</span></div>"; }).join("");
    el.querySelector(".tk-them").onclick = function () { suaTk(o, { id: "", ten: "", vaiTro: "nguoidung", quyen: {}, moi: 1 }); };
    [].slice.call(el.querySelectorAll(".tk-dong")).forEach(function (d) { d.onclick = function () {
      var id = d.dataset.id; suaTk(o, id ? QL.ds.find(function (x) { return x.id === id; }) : { khach: 1, quyen: QL.khach }); }; });
  }
  function bangQuyen(q, khoa) {
    q = chuanQ(khoa ? MUC.reduce(function (a, m) { a[m[0]] = "lam"; return a; }, {}) : q);   // quản trị: hiện đủ «Xem + thao tác»
    return '<table class="tk-q"><thead><tr><th>Mục</th><th>Không</th><th>Xem</th><th>Xem + thao tác</th></tr></thead><tbody>' +
      NHOM.map(function (g) { return '<tr class="tk-qg"><td colspan="4">' + e_(g[0]) + "</td></tr>" + g[1].map(function (t, i) {
        var o = function (ten, ten2, v, cls) { return '<tr' + (cls ? ' class="' + cls + '"' : "") + "><td>" + e_(ten2) + "</td>" + ["khong", "xem", "lam"].map(function (m) {
          return '<td><input type="radio" name="' + ten + '" value="' + m + '"' + (v === m ? " checked" : "") + (khoa ? " disabled" : "") + ' aria-label="' + e_(ten2) + " — " + m + '"></td>'; }).join("") + "</tr>"; };
        if (!t[2]) return o("q:" + t[0], t[1], q[t[0]] || "khong");
        /* hàng cha: chọn 1 lần cho mọi mục con; con lệch nhau thì hàng cha để trống */
        var vs = t[2].map(function (c) { return q[c[0]] || "khong"; });
        return o("qc:" + g[0].charAt(6) + i, t[1], vs.every(function (v) { return v === vs[0]; }) ? vs[0] : "", "tk-qcha") +
          t[2].map(function (c, j) { return o("q:" + c[0], c[1], vs[j], "tk-qcon"); }).join(""); }).join(""); }).join("") + "</tbody></table>";
  }
  function noiQuyen(f) {   // bấm hàng cha → áp cho các con; bấm con → hàng cha theo
    f.onchange = function (ev) { var r = ev.target; if (r.type !== "radio") return; var tr = r.closest("tr");
      if (tr.classList.contains("tk-qcha")) { for (var n = tr.nextElementSibling; n && n.classList.contains("tk-qcon"); n = n.nextElementSibling) n.querySelector('input[value="' + r.value + '"]').checked = true; return; }
      if (!tr.classList.contains("tk-qcon")) return;
      var c = tr; while (!c.classList.contains("tk-qcha")) c = c.previousElementSibling;
      var vs = []; for (n = c.nextElementSibling; n && n.classList.contains("tk-qcon"); n = n.nextElementSibling) vs.push((n.querySelector("input:checked") || {}).value);
      [].slice.call(c.querySelectorAll("input")).forEach(function (x) { x.checked = vs.every(function (v) { return v === x.value; }); }); };
  }
  function suaTk(o, x) {
    var el = o.querySelector(".tk-sua");
    [].slice.call(o.querySelectorAll(".tk-dong")).forEach(function (d) { d.classList.toggle("on", !!x && (x.khach ? d.dataset.id === "" : d.dataset.id === (x.id || "-"))); });
    if (!x) { el.innerHTML = '<div class="tk-goiy">Chọn một tài khoản ở bên trái, hoặc «+ Thêm tài khoản».</div>'; return; }
    var qt = x.vaiTro === "quantri";
    el.innerHTML = '<form class="tk-f">' + (x.khach ? '<div class="tk-tieu">Quyền của khách (người chưa đăng nhập)</div>' :
      '<div class="tk-hai"><label>ID đăng nhập<input name="id" required pattern="[a-zA-Z0-9._\\-]+" value="' + e_(x.id) + '"' + (x.moi ? "" : " readonly") + ' placeholder="vd: nguyenvana"></label>' +
      '<label>Tên hiển thị<input name="ten" value="' + e_(x.ten || "") + '"></label></div>' +
      '<div class="tk-hai"><label>' + (x.moi ? "Mật khẩu" : "Mật khẩu mới (để trống = giữ)") + '<input name="mk" type="password" autocomplete="new-password"' + (x.moi ? " required minlength=\"4\"" : "") + '></label>' +
      '<label>Vai trò<select name="vaiTro"><option value="nguoidung"' + (qt ? "" : " selected") + '>Người dùng</option><option value="quantri"' + (qt ? " selected" : "") + ">Quản trị (toàn quyền)</option></select></label></div>" +
      '<label class="tk-chk"><input type="checkbox" name="khoa"' + (x.khoa ? " checked" : "") + "> Khoá tài khoản (không đăng nhập được)</label>") +
      '<div class="tk-qwrap">' + bangQuyen(qt ? null : x.quyen, qt) + (qt ? '<div class="tk-goiy">Quản trị luôn có toàn quyền.</div>' : "") + "</div>" +
      '<div class="tk-nut"><button type="submit" class="tk-chinh">Lưu</button>' + (!x.khach && !x.moi && x.id !== (TK.nguoi || {}).id ? '<button type="button" class="tk-xoa">Xoá tài khoản</button>' : "") + '</div><div class="tk-st"></div></form>';
    var f = el.querySelector("form");
    if (f.vaiTro) f.vaiTro.onchange = function () { var q = f.vaiTro.value === "quantri"; f.querySelector(".tk-qwrap").innerHTML = bangQuyen(q ? null : x.quyen, q) + (q ? '<div class="tk-goiy">Quản trị luôn có toàn quyền.</div>' : ""); };
    noiQuyen(f);
    var layQ = function () { var q = {}; [].slice.call(f.querySelectorAll("input[type=radio][name^='q:']:checked")).forEach(function (r) { q[r.name.slice(2)] = r.value; }); return chuanQ(q); };
    f.onsubmit = function (ev) { ev.preventDefault();
      var p = x.khach ? goi("tk_luukhach", { phien: TK.phien, quyen: layQ() })
        : goi("tk_luu", { phien: TK.phien, tk: { id: f.id.value, ten: f.ten.value, mk: f.mk.value, vaiTro: f.vaiTro.value, quyen: layQ(), khoa: f.khoa.checked } });
      trangThai(f, "", "Đang lưu…");
      p.then(function () { return goi("tk_ds", { phien: TK.phien }); }).then(function (j) { QL = j; veDs(o); trangThai(f, "ok", "Đã lưu."); }).catch(function (e) { trangThai(f, "loi", e.message); }); };
    var xb = f.querySelector(".tk-xoa");
    if (xb) xb.onclick = function () { if (!confirm("Xoá tài khoản «" + x.id + "»?")) return;
      goi("tk_xoa", { phien: TK.phien, id: x.id }).then(function () { return goi("tk_ds", { phien: TK.phien }); }).then(function (j) { QL = j; veDs(o); suaTk(o, null); }).catch(function (e) { trangThai(f, "loi", e.message); }); };
  }

  /* ---------- Xác minh: đổi phiên tài khoản → phiên máy chủ 8591 (chỉ Retail, chỉ khi có quyền) ---------- */
  function doiPhienXm() {
    if (APP !== "r" || !TK.phien || !window.tkCo("r.xacminh")) return Promise.resolve(false);
    /* 19/10: điện thoại đi qua đường hầm — chờ dò máy chủ (index.html hxDoMayChu); không có máy chủ thì thôi */
    var do_ = typeof window.hxDoMayChu === "function" ? window.hxDoMayChu() : Promise.resolve(!window.__HX_KHONG_MAY);
    return do_.then(function (co) { if (!co) return false; return doiPhienXm_(); });
  }
  function doiPhienXm_() {
    return fetch(API_XM() + "/api/dang-nhap-tk", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phienTk: TK.phien }) })
      .then(function (r) { return r.json(); }).then(function (j) { if (!j.phien) return false; ls.set("hx-phien", j.phien); try { window.dispatchEvent(new Event("hx-phien")); } catch (e) {} return true; })
      .catch(function () { return false; });
  }
  window.tkDoiPhienXm = doiPhienXm;
  window.tkGoi = goi;   // 22/10 dùng chung cho index.html hxGuongMa (xmKhoaMa — khoá giải mã bản dự phòng) — cùng địa chỉ GAS / bản QC
  function bao() { try { document.dispatchEvent(new CustomEvent("tk-doi")); } catch (e) {} if (typeof window.homeRender === "function") try { window.homeRender(); } catch (e) {} }

  /* ---------- nạp: khách / kiểm phiên (1 lượt gọi Apps Script mỗi lần mở trang; nhớ 6 giờ để vẽ ngay) ---------- */
  function taiKhach() { return goi("tk_khach").then(function (j) { if (!TK.nguoi) { TK.quyen = chuanQ(j.quyen); nho(); } }).catch(function () {}); }
  function kiem() {
    if (!TK.phien) return taiKhach().then(function () { datNguoi(null); apQuyen(); bao(); });
    return goi("tk_toi", { phien: TK.phien }).then(function (j) { if (!j.nguoi) return; datNguoi(j.nguoi); TK.quyen = chuanQ(j.nguoi.quyen); nho(); apQuyen(); bao(); if (!ls.get("hx-phien")) doiPhienXm(); })
      .catch(function (e) { if (e.code === 401) { datNguoi(null, ""); TK.quyen = null; return taiKhach().then(function () { apQuyen(); bao(); }); } });
  }

  /* CSS (token antd + biến theme; popIn sẵn có của trang) */
  var st = document.createElement("style"); st.id = "tkCss";
  st.textContent = [
    "html.ad #adChuyen{flex-direction:column;align-items:stretch;gap:8px}html.ad #sideNav{padding-bottom:124px!important}",
    "#tkNut{display:flex;align-items:center;gap:8px;min-height:40px;padding:0 12px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font:inherit;font-size:14px;cursor:pointer;text-align:left}",
    "#tkNut:hover{border-color:var(--accent);color:var(--accent)}#tkNut svg{flex:none}#tkNut .t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#tkNut small{margin-left:6px;font-size:12px;color:var(--muted)}",
    "@media(min-width:769px){html.ad body:not(.side-open) #tkNut{justify-content:center;padding:0}html.ad body:not(.side-open) #tkNut .t{display:none}}",
    "#tkMenu{position:fixed;z-index:1300;display:flex;flex-direction:column;padding:4px;background:var(--surface);border-radius:8px;box-shadow:0 6px 16px rgba(0,0,0,.08),0 3px 6px -4px rgba(0,0,0,.12),0 9px 28px 8px rgba(0,0,0,.05);animation:popIn .18s ease}",
    "#tkMenu button{min-height:32px;padding:5px 12px;border:0;border-radius:4px;background:none;color:var(--text);font:inherit;font-size:14px;text-align:left;cursor:pointer}#tkMenu button:hover{background:var(--ad-nen2,var(--surface2))}",
    "#tkHop{position:fixed;inset:0;z-index:1400;display:flex;align-items:flex-start;justify-content:center;padding:80px 16px 16px;background:rgba(0,0,0,.45);overflow:auto}",
    "#tkHop .tk-box{width:100%;background:var(--surface);color:var(--text);border-radius:8px;box-shadow:0 6px 16px rgba(0,0,0,.08),0 9px 28px 8px rgba(0,0,0,.05);animation:popIn .2s ease}",
    "#tkHop .tk-hd{display:flex;align-items:center;justify-content:space-between;padding:16px 24px;border-bottom:1px solid var(--border)}#tkHop .tk-hd b{font-size:16px;font-weight:600}",
    "#tkHop .tk-x{width:32px;height:32px;border:0;border-radius:6px;background:none;color:var(--muted);font-size:20px;cursor:pointer}#tkHop .tk-x:hover{background:var(--ad-nen2,var(--surface2))}",
    "#tkHop .tk-bd{padding:16px 24px 24px}",
    ".tk-f{display:flex;flex-direction:column;gap:12px}.tk-f label{display:flex;flex-direction:column;gap:4px;font-size:14px;color:var(--text)}",
    ".tk-f input:not([type=radio]):not([type=checkbox]),.tk-f select{height:32px;padding:4px 11px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font:inherit;font-size:14px}",
    ".tk-f input:focus,.tk-f select:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 18%,transparent)}.tk-f input[readonly]{background:var(--ad-nen2,var(--surface2));color:var(--muted)}",
    ".tk-f .tk-chk{flex-direction:row;align-items:center;gap:8px}",
    ".tk-chinh{min-height:32px;padding:0 15px;border:1px solid var(--accent);border-radius:6px;background:var(--accent);color:var(--accent-text,#fff);font:inherit;font-size:14px;cursor:pointer}.tk-chinh:disabled{opacity:.6;cursor:wait}",
    ".tk-xoa{min-height:32px;padding:0 15px;border:1px solid var(--bad,#ff4d4f);border-radius:6px;background:var(--surface);color:var(--bad,#ff4d4f);font:inherit;font-size:14px;cursor:pointer}",
    ".tk-nut{display:flex;gap:8px}.tk-st{font-size:13px;min-height:20px;color:var(--muted)}.tk-st.loi{color:var(--bad,#ff4d4f)}.tk-st.ok{color:var(--good,#52c41a)}",
    ".tk-ql{display:grid;grid-template-columns:240px minmax(0,1fr);gap:16px;align-items:start}",
    ".tk-ds{display:flex;flex-direction:column;gap:4px}.tk-ds .tk-them{margin-bottom:8px}",
    ".tk-dong{display:flex;flex-direction:column;padding:8px 12px;border:1px solid var(--border);border-radius:6px;cursor:pointer}.tk-dong:hover{border-color:var(--accent)}",
    ".tk-dong.on{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 8%,var(--surface))}.tk-dong b{font-weight:600;font-size:14px}.tk-dong span{font-size:12px;color:var(--muted)}",
    ".tk-hai{display:grid;grid-template-columns:1fr 1fr;gap:12px}.tk-tieu{font-weight:600}.tk-goiy{font-size:13px;color:var(--muted)}",
    ".tk-qwrap{max-height:46vh;overflow:auto;border:1px solid var(--border);border-radius:6px}",
    ".tk-q{width:100%;border-collapse:collapse;font-size:14px}.tk-q th{position:sticky;top:0;background:var(--ad-nen2,var(--surface2));font-weight:600;padding:8px 12px;text-align:center;border-bottom:1px solid var(--border)}",
    ".tk-q th:first-child,.tk-q td:first-child{text-align:left}.tk-q td{padding:6px 12px;text-align:center;border-bottom:1px solid var(--ad-chia,var(--border))}",
    ".tk-q .tk-qg td{font-size:12px;font-weight:600;color:var(--muted);background:var(--surface)}.tk-q input{width:16px;height:16px;accent-color:var(--accent);cursor:pointer}",
    "#sideNav .s-grp.tk-an{display:none!important}",
    ".tk-f [hidden]{display:none!important}.tk-f .tk-lk2{min-height:0;padding:0;border:0;background:none;color:var(--accent);font-weight:600;text-decoration:underline}",
    ".tk-q .tk-qcha td:first-child{font-weight:600}.tk-q .tk-qcon td:first-child{padding-left:28px;color:var(--muted)}",
    /* bản QC: chắn = nền trang phủ kín (dưới hộp đăng nhập #tkHop 1400); dấu chìm trên cùng, không bắt chuột */
    "#tkCanQC{position:fixed;inset:0;z-index:1350;display:flex;align-items:flex-start;justify-content:center;padding:80px 16px 16px;background:var(--bg,var(--surface));overflow:auto}",
    "#tkCanQC .tk-box{width:100%;max-width:440px;background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:8px;animation:popIn .2s ease}",
    "#tkCanQC .tk-hd{padding:16px 24px;border-bottom:1px solid var(--border);font-size:16px}#tkCanQC .tk-bd{padding:16px 24px 24px;font-size:14px}",
    "#tkCanQC .tk-lk{display:inline-flex;align-items:center;text-decoration:none}#tkCanQC .tk-phu{background:var(--surface);color:var(--text);border-color:var(--border)}",
    "#tkDauChim{position:fixed;inset:0;z-index:2147483000;pointer-events:none;background-repeat:repeat;background-size:280px 200px;" +
      "background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='280' height='200'%3E" +
      "%3Ctext x='140' y='110' text-anchor='middle' transform='rotate(-30 140 100)' font-family='Arial,sans-serif' font-size='72' font-weight='700'" +
      " fill='rgba(128,128,128,0.14)'%3EQC%3C/text%3E%3C/svg%3E\")}",
    "@media(max-width:768px){.tk-ql,.tk-hai{grid-template-columns:minmax(0,1fr)}#tkHop{padding-top:16px}#tkHop .tk-bd{padding:12px 16px 16px}.tk-q input{width:20px;height:20px}.tk-q td{padding:8px}}"
  ].join("\n");
  (document.head || document.documentElement).appendChild(st);

  /* chờ khung (thanh bên + nút chuyển) dựng xong; áp lại khi mục đang mở đổi */
  var lan = 0, t0 = setInterval(function () { if (document.getElementById("adChuyen") || ++lan > 100) { clearInterval(t0); apQuyen(); kiem(); bocHoiPin(); } }, 100);
  new MutationObserver(function (ms) { if (ms.some(function (m) { return m.attributeName === "class" && m.target.classList && m.target.classList.contains("s-item"); })) apQuyen(); })
    .observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ["class"] });
  /* 22/10: thanh bên dựng lại (đăng nhập/xuất, bố cục, dò máy chủ) ⇒ áp quyền lại để ẩn tiêu đề nhóm trống (trước chỉ áp khi đổi mục đang mở) */
  var hAp = 0, t1 = setInterval(function () { var sn = document.getElementById("sideNav"); if (!sn) return; clearInterval(t1);
    new MutationObserver(function () { clearTimeout(hAp); hAp = setTimeout(apQuyen, 0); }).observe(sn, { childList: true }); }, 100);
})();
