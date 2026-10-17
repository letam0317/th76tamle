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
  var API_XM = (function () { try { return localStorage.getItem("hx-api") || "http://127.0.0.1:8591"; } catch (e) { return "http://127.0.0.1:8591"; } })();
  var NHOM = [
    ["Audit Retail", [["r.tong", "Tổng kết"], ["r.task", "Vi phạm"], ["r.hangmuc", "Quy định"], ["r.planogram", "Planogram"], ["r.htonbat", "Bất thường"], ["r.kk", "Kiểm kê"], ["r.xacminh", "Xác minh"]]],
    ["Audit Factory", [["f.stock", "Trạng thái lưu trữ"], ["f.kk", "Kiểm kê"], ["f.abn", "Tồn kho bất thường"], ["f.plg", "Planogram"], ["f.sku", "Nhận diện SKU"], ["f.cd", "Chuyển đổi cân"], ["f.tem", "Tem vị trí"]]]
  ];
  /* «Thao tác» của từng tab = nút ghi/sửa dữ liệu. Quyền «xem» ẩn các nút này. [bộ chọn, tab sở hữu, chỉ khi đang ở tab đó] */
  var THAO_TAC = {
    r: [["#btnGhiNhan,.hp-vtghi", "r.task"], [".bb-up", "r.task"], ["#btnSync,#btnSyncTS", "r.tong"], ["#hpcbar,#hpcprev", "r.kk", 1], ["#hpcbar,#hpcprev", "r.htonbat", 1]],
    f: [["#pcbar,#pcprev,#hdrKkPlan", "f.kk", 1], ["#pcbar,#pcprev,#hdrKkPlan", "f.abn", 1], ["#prbar", "f.sku"], ["#tmvBtnIn", "f.tem"]]
  };
  var KHACH_GOC = (function () { var q = {}; NHOM.forEach(function (g) { g[1].forEach(function (t) { q[t[0]] = t[0] === "r.xacminh" ? "khong" : "lam"; }); }); return q; })();
  var e_ = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var ls = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} } };

  var TK = window.TK = { phien: ls.get("tk-phien") || "", nguoi: null, quyen: null };
  try { var c0 = JSON.parse(ls.get("tk-nho") || "null"); if (c0 && Date.now() - c0.ts < 6 * 3600e3) { TK.nguoi = c0.nguoi || null; TK.quyen = c0.quyen; } } catch (e) {}
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
    NHOM.forEach(function (g) { g[1].forEach(function (t) { if (t[0].charAt(0) !== APP || q[t[0]] !== "khong") return;
      if (t[0] === "r.xacminh" && !TK.nguoi) return;   // 14/10 user: chưa đăng nhập vẫn thấy mục «Xác minh» (bấm → đăng nhập), chỉ ẩn mục con
      var k = t[0].slice(2); css.push("#sideNav .s-item[data-tab='" + k + "']{display:none!important}"); }); });
    (THAO_TAC[APP] || []).forEach(function (x) { if (x[2] ? (cur === x[1] && q[x[1]] !== "lam") : q[x[1]] !== "lam") css.push(x[0] + "{display:none!important}"); });
    stQ.textContent = css.join("\n");
    /* tiêu đề nhóm thanh bên: ẩn khi mọi mục trong nhóm bị ẩn */
    [].slice.call(document.querySelectorAll("#sideNav .s-grp:not(.s-khoa)")).forEach(function (h) {   // 15/10 tiêu đề có khoá (Xác minh chưa đăng nhập) luôn hiện
      var co = false; for (var n = h.nextElementSibling; n && !n.classList.contains("s-grp"); n = n.nextElementSibling) if (n.matches(".s-item,.s-sub") && getComputedStyle(n).display !== "none") co = true;
      h.style.display = co ? "" : "none"; });
    /* đang đứng ở tab bị cấm → về Tổng quan */
    if (cur && q[cur] === "khong" && !(cur === "r.xacminh" && !TK.nguoi)) { var home = document.querySelector("#sideNav .s-item[data-tab='home']"); if (home) home.click(); }
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
  function dongHop() { var o = document.getElementById("tkHop"); if (o) o.remove(); document.removeEventListener("keydown", escDong); }
  function trangThai(o, cls, txt) { var s = o.querySelector(".tk-st"); s.className = "tk-st " + cls; s.textContent = txt; }

  function dangNhap(id, mk) {
    /* 17/10 user điện thoại «Cannot read properties of undefined (reading 'quyen')»: Apps Script chập chờn từng trả «success» mà THIẾU nguoi
       (cùng họ lỗi gas-chap-chon-404) → thử lại 1 lần; vẫn thiếu thì báo câu dễ hiểu, không để lỗi kỹ thuật rơi ra ô đăng nhập. */
    var lan = function (k) { return goi("tk_dangnhap", { id: id, mk: mk }).then(function (j) {
      if (!j.nguoi || !j.phien) { if (k) return lan(0); throw new Error("Máy chủ trả thiếu thông tin tài khoản — bấm Đăng nhập lại"); }
      datNguoi(j.nguoi, j.phien); TK.quyen = j.nguoi.quyen || {}; nho(); apQuyen(); doiPhienXm(); bao(); return j.nguoi; }); };
    return lan(1);
  }
  window.tkDangNhap = dangNhap;
  function moDangNhap(sau) {
    var o = hop("Đăng nhập", '<form class="tk-f" autocomplete="on"><label>Tài khoản<input name="id" autocomplete="username" required placeholder="vd: tamlc" value="' + e_(ls.get("tk-id") || "") + '"></label>' +
      '<label>Mật khẩu<input name="mk" type="password" autocomplete="current-password" required></label><button type="submit" class="tk-chinh">Đăng nhập</button><div class="tk-st"></div></form>');
    var f = o.querySelector("form"); (f.id.value ? f.mk : f.id).focus();
    f.onsubmit = function (ev) { ev.preventDefault(); var nut = f.querySelector("button"); nut.disabled = true; trangThai(o, "", "Đang kiểm tra…");
      dangNhap(f.id.value, f.mk.value).then(function () { ls.set("tk-id", f.id.value.trim().toLowerCase().replace(/@.*$/, "")); dongHop(); if (sau) sau(); })
        .catch(function (e) { trangThai(o, "loi", e.message); nut.disabled = false; f.mk.select(); }); };
  }
  window.tkMoDangNhap = moDangNhap;
  function dangXuat() {
    var p = TK.phien; if (p) goi("tk_dangxuat", { phien: p }).catch(function () {});
    /* 16/10 user «đăng xuất rồi mà vẫn thấy mục con Xác minh»: 1 lần đăng xuất = thu hồi CẢ phiên máy chủ Xác minh 8591 (trước chỉ xoá ở máy) */
    var hx = ls.get("hx-phien"); if (APP === "r" && hx) fetch(API_XM + "/api/dang-xuat", { method: "POST", headers: { "x-hx-phien": hx } }).catch(function () {});
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
    return '<table class="tk-q"><thead><tr><th>Mục</th><th>Không</th><th>Xem</th><th>Xem + thao tác</th></tr></thead><tbody>' +
      NHOM.map(function (g) { return '<tr class="tk-qg"><td colspan="4">' + e_(g[0]) + "</td></tr>" + g[1].map(function (t) {
        var v = (q || {})[t[0]] || "khong";
        return "<tr><td>" + e_(t[1]) + "</td>" + ["khong", "xem", "lam"].map(function (m) { return '<td><input type="radio" name="q:' + t[0] + '" value="' + m + '"' + (v === m ? " checked" : "") + (khoa ? " disabled" : "") + ' aria-label="' + e_(t[1]) + " — " + m + '"></td>'; }).join("") + "</tr>"; }).join(""); }).join("") + "</tbody></table>";
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
    var layQ = function () { var q = {}; [].slice.call(f.querySelectorAll("input[type=radio]:checked")).forEach(function (r) { q[r.name.slice(2)] = r.value; }); return q; };
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
    if (APP !== "r" || !TK.phien || !window.tkCo("r.xacminh") || window.__HX_KHONG_MAY) return Promise.resolve(false);   // 15/10: điện thoại không có máy chủ 8591
    return fetch(API_XM + "/api/dang-nhap-tk", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phienTk: TK.phien }) })
      .then(function (r) { return r.json(); }).then(function (j) { if (!j.phien) return false; ls.set("hx-phien", j.phien); try { window.dispatchEvent(new Event("hx-phien")); } catch (e) {} return true; })
      .catch(function () { return false; });
  }
  window.tkDoiPhienXm = doiPhienXm;
  function bao() { try { document.dispatchEvent(new CustomEvent("tk-doi")); } catch (e) {} if (typeof window.homeRender === "function") try { window.homeRender(); } catch (e) {} }

  /* ---------- nạp: khách / kiểm phiên (1 lượt gọi Apps Script mỗi lần mở trang; nhớ 6 giờ để vẽ ngay) ---------- */
  function taiKhach() { return goi("tk_khach").then(function (j) { if (!TK.nguoi) { TK.quyen = j.quyen; nho(); } }).catch(function () {}); }
  function kiem() {
    if (!TK.phien) return taiKhach().then(function () { datNguoi(null); apQuyen(); bao(); });
    return goi("tk_toi", { phien: TK.phien }).then(function (j) { if (!j.nguoi) return; datNguoi(j.nguoi); TK.quyen = j.nguoi.quyen || {}; nho(); apQuyen(); bao(); if (!ls.get("hx-phien")) doiPhienXm(); })
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
    "@media(max-width:768px){.tk-ql,.tk-hai{grid-template-columns:minmax(0,1fr)}#tkHop{padding-top:16px}#tkHop .tk-bd{padding:12px 16px 16px}.tk-q input{width:20px;height:20px}.tk-q td{padding:8px}}"
  ].join("\n");
  (document.head || document.documentElement).appendChild(st);

  /* chờ khung (thanh bên + nút chuyển) dựng xong; áp lại khi mục đang mở đổi */
  var lan = 0, t0 = setInterval(function () { if (document.getElementById("adChuyen") || ++lan > 100) { clearInterval(t0); apQuyen(); kiem(); } }, 100);
  new MutationObserver(function (ms) { if (ms.some(function (m) { return m.attributeName === "class" && m.target.classList && m.target.classList.contains("s-item"); })) apQuyen(); })
    .observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ["class"] });
})();
