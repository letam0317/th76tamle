/* dash-bocuc-ap.js — ÁP BỐ CỤC dashboard (13/10/2026, kế hoạch async-wibbling-haven giai đoạn D · t5 user:
 * «bộ di chuyển/chỉnh sửa vị trí, kích thước hiển thị/bổ sung/xoá/sao chép dashboard ở bản QC trước khi chốt phát hành — như Bố trí kho Liên Anh»).
 * DÙNG CHUNG Audit Retail (kiemsoatkho) + Audit Factory (bản chép factory/dash-bocuc-ap.js — SỬA Ở ĐÂY RỒI CHÉP SANG).
 * Chạy ở CẢ bản thật lẫn bản QC: đọc window.DASH_BOCUC (tệp dash-bocuc.js do bộ chỉnh ghi + chốt) — không có tệp thì KHÔNG đổi gì.
 *
 *   window.DASH_BOCUC = { ver, ngay, chot, tab:[{k, ten, nhom, an, banSaoCua, moi}], khoi:{ "<khoá tab>": [{id, rong, cao, an, sangTab}] } }
 *   khoá tab = data-tab (+":"+data-sub nếu có) · tab sao chép "ban:<n>" · tab mới "moi:<n>"
 *   khối = con cấp 1 của khung tab (đi xuống qua lớp bọc 1 con), id = id sẵn có / data-khoi / tự sinh "<thẻ>.<lớp>@<thứ tự>"
 *
 * Giới hạn có chủ đích: khối mang DỮ LIỆU SỐNG (bảng, sơ đồ — do module vẽ theo id) không nhân bản được, chỉ dời; khối dời sang tab mới
 * chỉ có số liệu sau khi tab gốc đã mở 1 lần (module nạp lười). Điện thoại (≤768px) chỉ áp thứ tự + ẩn, không áp bề rộng/chiều cao. */
(function () {
  if (window.__DASH_AP) return; window.__DASH_AP = 1;
  var D = function () { return window.DASH_BOCUC || null; };
  var DT = function () { return window.matchMedia("(max-width:768px)").matches; };
  var nav = function () { return document.getElementById("sideNav"); };
  var dangAp = false, dangMo = "";   // dangMo = khoá tab ảo (ban:/moi:) đang mở

  /* ---------- CSS lưới 12 cột (chỉ gắn khi tab có bố cục riêng) ---------- */
  var st = document.createElement("style"); st.id = "dashBocucCss";
  st.textContent = [
    /* 13/10 BẪY: display:grid!important đè thuộc tính hidden của tab → rời tab Kiểm kê mà khung vẫn hiện ở mọi tab. Ẩn luôn thắng. */
    ".dash-luoi[hidden],[data-khoi][hidden]{display:none!important}",
    "@media(min-width:769px){.dash-luoi:not([hidden]){display:grid!important;grid-template-columns:repeat(12,minmax(0,1fr));gap:12px;align-items:start}",
    ".dash-luoi>[data-khoi]{grid-column:span var(--dash-rong,12);min-width:0;margin:0!important}",
    ".dash-luoi>[data-khoi][data-dash-cao]{height:var(--dash-cao);overflow:auto}}",
    "[data-dash-an]{display:none!important}",
    ".dash-tab-moi{min-height:240px}",
    ".dash-trong{display:grid;place-items:center;min-height:200px;border:1px dashed var(--border);border-radius:8px;color:var(--muted);font-size:14px}"
  ].join("");
  (document.head || document.documentElement).appendChild(st);

  /* ---------- VÙNG + KHỐI (13/10 chiều, user: «pop-up không kéo/chỉnh được» · «không kéo hạng mục bên trong Phiếu đang mở») ----------
     Vùng gốc = khung tab đang mở, HOẶC pop-up đang mở (pop-up đứng trên tab). Mỗi khối lại có thể là 1 VÙNG CON (các mục bên trong nó):
     khoá vùng con = khoá cha + "|" + id khối  (vd "xacminh:treo|div.panel@1", "pop:modal:hx-qd|hx-qd-ben@1"). */
  var POP_SEL = "#modal.show,#statModal.show,#hmModal.show,#ghiModal.show,.hk-modal.show,.ht-modal.show,.hp-modal.show,[id$=modal].show,[id$=Modal].show,.modal.show,.modal-bg.show";
  function khungDangMo() {
    if (dangMo) { var v = document.getElementById("dashPane-" + dangMo.replace(/\W/g, "_")); if (v) return v; }
    var ds = [].slice.call(document.querySelectorAll("[id^=pane-],[id^=view]")).filter(function (x) { return x.offsetParent !== null && !x.closest(".modal-box,[id$=modal],[id$=Modal]"); });
    return ds[0] || null;
  }
  function popDangMo() {
    var ms = [].slice.call(document.querySelectorAll(POP_SEL)).filter(function (m) { return getComputedStyle(m).display !== "none" && m.getBoundingClientRect().height > 0 && !m.closest("#dashBang"); });
    return ms.length ? ms[ms.length - 1] : null;
  }
  function thanPop(m) {   // thân pop-up: bỏ phần đầu (tiêu đề + nút Đóng), lấy phần nội dung
    var box = m.querySelector(".modal-box,[class*='-box']") || m;
    var con = [].slice.call(box.children).filter(function (c) { return !/head|hdr|title/i.test((c.id || "") + " " + (c.className || "")) && !/^(SCRIPT|STYLE|BUTTON)$/.test(c.tagName); });
    return vungKhoi(con.length === 1 ? con[0] : box);
  }
  function laKhungBoc(el) { var k = [].slice.call(el.children).filter(function (c) { return !/^(SCRIPT|STYLE|TEMPLATE)$/.test(c.tagName) && !c.classList.contains("dash-sua-ui"); }); return k.length === 1 && !k[0].hasAttribute("data-khoi") ? k[0] : null; }
  function vungKhoi(el) { var v = el, n = 0, c; while (n++ < 3 && (c = laKhungBoc(v))) v = c; return v; }
  function dsKhoiVung(v) {
    var dem = {};
    return [].slice.call(v.children).filter(function (c) { return !/^(SCRIPT|STYLE|TEMPLATE|DATALIST)$/.test(c.tagName) && !c.classList.contains("dash-sua-ui"); }).map(function (c) {
      if (!c.dataset.khoi) { var g = c.id || (c.tagName.toLowerCase() + "." + (String(c.className || "").trim().split(/\s+/).filter(function (x) { return !/^dash-/.test(x); })[0] || "x")); dem[g] = (dem[g] || 0) + 1; c.dataset.khoi = c.id ? c.id : g + "@" + dem[g]; }
      return c;
    });
  }
  function dsKhoi(pane) { return dsKhoiVung(vungKhoi(pane)); }
  function khoaTab() {
    if (dangMo) return dangMo;
    var on = document.querySelector("#sideNav .s-item.on"); if (!on) return "";
    return on.dataset.dash || (on.dataset.tab + (on.dataset.sub ? ":" + on.dataset.sub : ""));
  }
  function vungGoc() {   // pop-up đang mở thắng tab
    var m = popDangMo();
    if (m) { var t = thanPop(m), f = t.firstElementChild; return { el: t, key: "pop:" + (m.id || "pop") + ":" + (f ? (f.id || String(f.className || "").split(/\s+/)[0] || f.tagName.toLowerCase()) : "x"), pop: true }; }
    var p = khungDangMo(); return p ? { el: vungKhoi(p), key: khoaTab(), pop: false } : null;
  }
  function timVung(key) {   // phần tử của vùng theo khoá (gốc hoặc con)
    var g = vungGoc(); if (!g || (key !== g.key && key.indexOf(g.key + "|") !== 0)) return null;
    var el = g.el, duong = key === g.key ? [] : key.slice(g.key.length + 1).split("|");
    for (var i = 0; i < duong.length; i++) { dsKhoiVung(el); var c = [].slice.call(el.children).find(function (x) { return x.dataset.khoi === duong[i]; }); if (!c) return null; el = vungKhoi(c); }
    return el;
  }
  function dsCfg(cfg, k) { if (!cfg || !cfg.khoi) return null; if (cfg.khoi[k]) return cfg.khoi[k]; var t = tabCfg(k.split("|")[0]); return t && t.banSaoCua ? cfg.khoi[[t.banSaoCua].concat(k.split("|").slice(1)).join("|")] || null : null; }
  function apVung(vung, k, ds, laGocTab) {
    var cfg = D();
    if (laGocTab && cfg && cfg.khoi) Object.keys(cfg.khoi).forEach(function (kk) { if (kk.indexOf("|") >= 0) return; (cfg.khoi[kk] || []).forEach(function (b) {
      if (b.sangTab === k && kk !== k) { var el = document.querySelector('[data-khoi="' + b.id.replace(/"/g, "") + '"]'); if (el && el.parentNode !== vung) { el.dataset.dashGoc = el.dataset.dashGoc || kk; vung.appendChild(el); } } }); });
    dsKhoiVung(vung);
    (ds || []).forEach(function (b) {   // khối NHÂN BẢN (chỉ khối tĩnh): dựng lại từ khối gốc mỗi lần áp — bỏ id để không đụng chỗ module vẽ
      if (!b.banSaoCua || [].slice.call(vung.children).some(function (x) { return x.dataset.khoi === b.id; })) return;
      var g = [].slice.call(vung.children).find(function (x) { return x.dataset.khoi === b.banSaoCua; }); if (!g) return;
      var c = g.cloneNode(true); c.removeAttribute("id"); [].slice.call(c.querySelectorAll("[id],.dash-sua-ui")).forEach(function (x) { if (x.classList.contains("dash-sua-ui")) x.remove(); else x.removeAttribute("id"); });
      c.dataset.khoi = b.id; vung.appendChild(c);
    });
    var khoi = dsKhoiVung(vung);
    if (!ds || !ds.length) { vung.classList.remove("dash-luoi"); khoi.forEach(datLai); var tr = vung.querySelector(".dash-trong"); if (tr && khoi.length > 1) tr.remove(); return; }
    vung.classList.add("dash-luoi");
    var thu = {}; ds.forEach(function (b, i) { thu[b.id] = i; });
    khoi.forEach(function (el) {
      var b = ds[thu[el.dataset.khoi]]; datLai(el);
      el.style.order = b ? String(thu[el.dataset.khoi]) : String(900 + khoi.indexOf(el));
      if (!b) return;
      if (b.an || (laGocTab && b.sangTab && b.sangTab !== k)) el.setAttribute("data-dash-an", "");
      if (!DT()) { el.style.setProperty("--dash-rong", Math.max(1, Math.min(12, b.rong || 12))); if (b.cao) { el.setAttribute("data-dash-cao", ""); el.style.setProperty("--dash-cao", b.cao + "px"); } }
    });
  }
  function apKhoi() {
    var cfg = D(), g = vungGoc(); if (!g) return;
    apVung(g.el, g.key, dsCfg(cfg, g.key), !g.pop);
    if (!cfg || !cfg.khoi) return;
    var goc = g.pop ? g.key : g.key.split("|")[0], banSao = tabCfg(goc) && tabCfg(goc).banSaoCua;
    Object.keys(cfg.khoi).forEach(function (k) {   // vùng con: khoá của chính tab, hoặc của tab gốc nếu đây là tab sao chép
      var k2 = k.indexOf(g.key + "|") === 0 ? k : (banSao && k.indexOf(banSao + "|") === 0 ? g.key + k.slice(banSao.length) : null);
      if (!k2) return; var v = timVung(k2); if (v) apVung(v, k2, cfg.khoi[k2] || cfg.khoi[k], false);
    });
  }
  function datLai(el) { el.removeAttribute("data-dash-an"); el.removeAttribute("data-dash-cao"); el.style.removeProperty("--dash-rong"); el.style.removeProperty("--dash-cao"); el.style.order = ""; }

  /* ---------- tab (thanh bên) ---------- */
  function tabCfg(k) { var c = D(); return c && c.tab ? c.tab.find(function (t) { return t.k === k; }) : null; }
  function khoaItem(it) { return it.dataset.dash || (it.dataset.tab + (it.dataset.sub ? ":" + it.dataset.sub : "")); }
  function nhomCua(it) { var s = it.closest(".s-sub"), g = s && s.previousElementSibling; return g && g.classList.contains("s-grp") ? g.textContent.trim() : ""; }
  function datTen(it, ten) { var tn = [].slice.call(it.childNodes).find(function (n) { return n.nodeType === 3 && n.textContent.trim(); }); if (tn) tn.textContent = ten; else it.insertBefore(document.createTextNode(ten), it.querySelector(".sn")); }
  function hopNhom(n, ten) {   // .s-sub của nhóm theo tên (tạo nếu chưa có)
    var gs = [].slice.call(n.querySelectorAll(".s-grp")); var g = gs.find(function (x) { return x.textContent.trim() === ten; });
    if (g && g.nextElementSibling && g.nextElementSibling.classList.contains("s-sub")) return g.nextElementSibling;
    if (!ten) { var d = n.querySelector(".s-sub.s-dau"); if (d) return d; }
    g = document.createElement("div"); g.className = "s-grp"; g.textContent = ten; var sb = document.createElement("div"); sb.className = "s-sub";
    n.appendChild(g); n.appendChild(sb); return sb;
  }
  function tenHien(it) { var c = it.cloneNode(true); [].slice.call(c.querySelectorAll(".sn,.di")).forEach(function (x) { x.remove(); }); return c.textContent.trim(); }
  function apTab() {
    var cfg = D(), n = nav(); if (!cfg || !cfg.tab || !cfg.tab.length || !n || !n.querySelector(".s-item")) return;
    dangAp = true;
    try {
      var items = {}; [].slice.call(n.querySelectorAll(".s-item")).forEach(function (it) { items[khoaItem(it)] = it; });
      var nhomMuon = [];   // [khung nhóm, [mục theo thứ tự mong muốn]]
      cfg.tab.forEach(function (t) {
        var it = items[t.k];
        if (!it && (t.banSaoCua || t.moi)) {   // tab ảo: sao chép / tab mới
          it = document.createElement("div"); it.className = "s-item"; it.dataset.dash = t.k; it.innerHTML = '<span class="di"></span>' + "x" + '<span class="sn"></span>';
          it.addEventListener("click", function () { moTabAo(t.k); }); items[t.k] = it;
        }
        if (!it) return;   // tab gốc chưa có trên thanh bên (vd Xác minh chưa đăng nhập) — để lần dựng sau
        var ten = t.ten || (it.dataset.dash ? "Tab mới" : ""); if (ten && tenHien(it) !== ten) datTen(it, ten);
        var dich = hopNhom(n, t.nhom != null ? t.nhom : nhomCua(it));
        var g = nhomMuon.find(function (x) { return x[0] === dich; }); if (!g) nhomMuon.push(g = [dich, []]); g[1].push(it);
        if (!!t.an !== it.hasAttribute("data-dash-an")) { if (t.an) it.setAttribute("data-dash-an", ""); else it.removeAttribute("data-dash-an"); }
      });
      /* 13/10 chiều user «thanh bên cứ 2s giật 1 lần»: trước đây MỖI lần số đếm đổi đều gỡ-gắn lại cả thanh bên ⇒ nay so thứ tự từng nhóm, ĐÚNG rồi thì không đụng */
      nhomMuon.forEach(function (g) { var dang = [].slice.call(g[0].children).filter(function (c) { return g[1].indexOf(c) >= 0; });
        if (dang.length !== g[1].length || dang.some(function (c, i) { return c !== g[1][i]; })) g[1].forEach(function (it) { g[0].appendChild(it); }); });
      [].slice.call(n.querySelectorAll(".s-sub")).forEach(function (sb) { var g = sb.previousElementSibling; var co = [].slice.call(sb.children).some(function (c) { return !c.hasAttribute("data-dash-an"); });
        sb.style.display = co ? "" : "none"; if (g && g.classList.contains("s-grp")) g.style.display = co ? "" : "none"; });
      if (dangMo) [].slice.call(n.querySelectorAll(".s-item")).forEach(function (it) { it.classList.toggle("on", it.dataset.dash === dangMo); });
    } finally { setTimeout(function () { dangAp = false; }, 0); }
  }
  function moTabAo(k) {
    var t = tabCfg(k); if (!t) return;
    if (t.banSaoCua) {   // sao chép: mở tab gốc (đúng đường của app), rồi đánh dấu tab sao chép + áp bố cục của nó
      var g = [].slice.call(nav().querySelectorAll(".s-item")).find(function (it) { return !it.dataset.dash && khoaItem(it) === t.banSaoCua; });
      dangMo = ""; anKhungAo(); if (g) g.click(); dangMo = k;
    } else {   // tab mới: khung riêng, ẩn khung đang mở của app
      dangMo = k; var v = khungAo(k);
      [].slice.call(v.parentNode.children).forEach(function (x) { if (x !== v && (/^pane-|^view/.test(x.id || "")) ) {
        if (x.dataset.dashTruoc == null) x.dataset.dashTruoc = (x.hidden ? "h" : "") + (x.classList.contains("hidden") ? "c" : "");   // nhớ đúng trạng thái app đã đặt
        x.classList.add("hidden"); x.hidden = true; } });
      v.hidden = false; v.classList.remove("hidden");
    }
    [].slice.call(nav().querySelectorAll(".s-item")).forEach(function (it) { it.classList.toggle("on", it.dataset.dash === k); });
    setTimeout(apKhoi, 60);
  }
  function khungAo(k) {
    var id = "dashPane-" + k.replace(/\W/g, "_"), v = document.getElementById(id); if (v) return v;
    var mau = document.querySelector("[id^=pane-],[id^=view]"); v = document.createElement(mau && mau.tagName === "SECTION" ? "section" : "div");
    v.id = id; v.className = (mau && mau.classList.contains("pane") ? "pane " : "") + "dash-tab-moi"; v.hidden = true;
    v.innerHTML = '<div class="dash-trong">Tab mới — kéo khối từ tab khác vào (bản QC · Chỉnh bố cục)</div>';
    (mau ? mau.parentNode : document.body).appendChild(v); return v;
  }
  function anKhungAo() {
    [].slice.call(document.querySelectorAll("[id^=dashPane-]")).forEach(function (v) { v.hidden = true; v.classList.add("hidden"); });
    /* trả khung của app về ĐÚNG trạng thái trước khi mở tab mới — app đổi tab bằng lớp "hidden" (Retail) hoặc thuộc tính hidden (Factory) */
    [].slice.call(document.querySelectorAll("[data-dash-truoc]")).forEach(function (x) { var t = x.dataset.dashTruoc; x.hidden = t.indexOf("h") >= 0; x.classList.toggle("hidden", t.indexOf("c") >= 0); delete x.dataset.dashTruoc; });
  }
  /* bấm mục THẬT của app → rời tab ảo, trả khung app về như cũ */
  document.addEventListener("click", function (e) {
    var it = e.target.closest && e.target.closest("#sideNav .s-item"); if (!it || it.dataset.dash || !dangMo) return;
    dangMo = ""; anKhungAo();
  }, true);

  /* ---------- nhịp áp: thanh bên dựng lại / đổi tab / đổi cỡ màn ---------- */
  var hen = null; function henAp() { if (hen) return; hen = setTimeout(function () { hen = null; apTab(); apKhoi(); }, 40); }
  function batDau() {
    /* bỏ qua thay đổi SỐ ĐẾM (.sn) — app cập nhật số 2–4 giây/lần, không phải lý do áp lại bố cục */
    var n = nav(); if (n) new MutationObserver(function (ms) { if (dangAp) return; if (ms.every(function (m) { var t = m.target.nodeType === 3 ? m.target.parentNode : m.target; return t && t.closest && t.closest(".sn"); })) return; henAp(); })
      .observe(n, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    window.addEventListener("resize", henAp); henAp();
    /* module vẽ lại khung (lười / làm mới) → khối mới cần áp lại */
    new MutationObserver(function (ms) { if (dangAp) return; var c = D(); if (!c || !c.khoi || !Object.keys(c.khoi).length) return;   // không có bố cục khối → không tốn gì
      if (ms.some(function (m) { var t = m.target; return (t.id && /^(pane-|view|hxBody|content|plgTop|hpTop|mBody|statBody)/.test(t.id)) || (t.closest && t.closest(".modal-box") && m.addedNodes.length); })) { henAp(); setTimeout(henAp, 320); } })   // pop-up: lớp "show" gắn SAU khi đổ nội dung
      .observe(document.body, { childList: true, subtree: true });
  }
  window.DASH_AP = { apDung: function () { apTab(); apKhoi(); }, dsKhoi: function () { var p = khungDangMo(); return p ? dsKhoi(p) : []; }, khungDangMo: khungDangMo, khoaTab: khoaTab, khoaItem: khoaItem, nhomCua: nhomCua, moTabAo: moTabAo,
    vungGoc: vungGoc, timVung: timVung, dsKhoiVung: dsKhoiVung, popDangMo: popDangMo };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", batDau); else batDau();
})();
