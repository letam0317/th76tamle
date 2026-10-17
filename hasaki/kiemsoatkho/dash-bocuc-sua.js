/* dash-bocuc-sua.js — BỘ CHỈNH BỐ CỤC dashboard, CHỈ bản QC (localhost:8123) — 13/10/2026, t5 user (khuôn «Bố trí kho Liên Anh»).
 * Bật bằng nút «Chỉnh bố cục» góc dưới phải. Hai cấp:
 *   · TAB (bảng bên phải): đổi tên · đổi nhóm · lên/xuống · ẩn · sao chép · thêm tab mới · xoá (chỉ tab đã thêm/sao chép; tab gốc thì ẩn)
 *   · KHỐI (trong tab đang mở): kéo tay nắm để đổi chỗ · kéo mép phải đổi rộng (bám 12 cột) · kéo mép dưới đổi cao · ẩn · nhân bản (khối tĩnh)
 *     · chuyển sang tab khác · về mặc định
 * Mọi thay đổi tự lưu sau 0,7 s → POST /api/dash/<app>/bocuc (xem-noi-bo.mjs ghi <app>/dash-bocuc.js + sao lưu). «Chốt phát hành» → QC hết rồi mới đẩy.
 * Hoàn tác / làm lại: Ctrl+Z / Ctrl+Y. Không ghi gì khi máy chủ QC không trả lời (báo rõ trên thanh). */
(function () {
  if (window.__DASH_SUA || !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return; window.__DASH_SUA = 1;
  var APP = window.DASH_APP || "retail", API = "/api/dash/" + APP + "/";
  var $ = function (q, r) { return (r || document).querySelector(q); }, $$ = function (q, r) { return [].slice.call((r || document).querySelectorAll(q)); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var CFG = JSON.parse(JSON.stringify(window.DASH_BOCUC || { ver: 0, tab: [], khoi: {} })); CFG.tab = CFG.tab || []; CFG.khoi = CFG.khoi || {};
  var LUI = [], TOI = [], BAT = false, MAY_CHU = false, hLuu = null;

  var css = document.createElement("style"); css.textContent = [
    "#dashNut{position:fixed;right:16px;bottom:16px;z-index:96;min-height:40px;padding:0 16px;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--text);font:inherit;font-size:14px;cursor:pointer;box-shadow:0 6px 16px rgba(0,0,0,.08)}",
    "#dashNut.on{background:var(--accent);border-color:var(--accent);color:var(--accent-text,#fff)}",
    /* 13/10 chiều user «chuyển lên đầu — như Bố trí Liên Anh»: THANH CÔNG CỤ NGANG trên cùng (tên · BẢN NỘI BỘ · menu Tab ▾ · thao tác · trạng thái),
       danh sách tab là bảng xổ dưới nút «Tab ▾»; trang + thanh bên lùi xuống nhường chỗ (không còn bảng bên phải che nội dung). */
    "#dashBang{position:fixed;top:0;left:0;right:0;z-index:97;display:none;flex-direction:column;background:var(--surface);border-bottom:1px solid var(--border);box-shadow:0 1px 4px rgba(0,21,41,.08);font-size:14px}",
    "body.dash-sua #dashBang{display:flex}body.dash-sua #dashNut{display:none}",
    "#dashBang .dh{display:flex;align-items:center;gap:8px;padding:8px 16px;min-height:52px;box-sizing:border-box;flex-wrap:wrap}",
    "#dashBang .dh .ten{font-weight:600}#dashBang .noibo{padding:0 8px;border-radius:4px;background:var(--bad,#dc2626);color:#fff;font-size:12px;line-height:20px;font-weight:600}",
    "#dashBang .vach{width:1px;align-self:stretch;margin:6px 4px;background:var(--border)}",
    "#dashBang .dd{display:flex;align-items:center;gap:8px;min-width:0;font-size:13px;color:var(--muted)}#dashBang .dd b{color:var(--text);font-weight:600}",
    "#dashBang .dd span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:360px}",
    "#dashBang .tt{margin-left:auto;font-size:12px;color:var(--muted);white-space:nowrap}",
    "#dashBang button{min-height:32px;padding:0 12px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font:inherit;font-size:14px;cursor:pointer;white-space:nowrap}",
    "#dashBang button:hover{border-color:var(--accent);color:var(--accent)}#dashBang button.chinh{background:var(--accent);border-color:var(--accent);color:var(--accent-text,#fff)}#dashBang button.on{border-color:var(--accent);color:var(--accent)}",
    "#dashBang button[disabled]{opacity:.5;cursor:not-allowed}",
    "#dashBang .dt{position:absolute;top:calc(100% + 4px);left:16px;width:380px;max-height:70vh;overflow:auto;padding:8px 12px;background:var(--surface);border:1px solid var(--border);border-radius:8px;box-shadow:0 6px 16px rgba(0,0,0,.08),0 9px 28px 8px rgba(0,0,0,.05);animation:popIn .18s var(--ez-apple,ease)}",
    "#dashBang .dt[hidden]{display:none}",
    "#dashBang .tr{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 6px;align-items:center;padding:6px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px}",
    "#dashBang .tr.an{opacity:.55}#dashBang .tr.on{border-color:var(--accent)}",
    "#dashBang .tr input{min-width:0;min-height:32px;padding:0 8px;border:1px solid var(--border);border-radius:6px;font:inherit;font-size:13px;background:var(--surface);color:var(--text)}",
    "#dashBang .tr .bt{display:flex;gap:4px;grid-column:1 / -1;flex-wrap:wrap}#dashBang .tr .bt button{min-height:28px;padding:0 8px;font-size:12px}",
    "#dashBang .tr .k{grid-column:1 / -1;font-size:11px;color:var(--muted)}",
    "body.dash-sua{padding-top:52px}body.dash-sua :is(#sideNav,#adLogo){top:52px!important}body.dash-sua #sideToggle{top:64px!important}body.dash-sua .wrap>header{top:52px}",
    "@media(max-width:768px){#dashBang .dd span{max-width:160px}#dashBang .dt{left:8px;right:8px;width:auto}}",
    "body.dash-sua .dash-vung{outline:2px dashed color-mix(in srgb,var(--accent) 35%,transparent);outline-offset:6px}",
    "body.dash-sua [data-khoi]{position:relative;outline:1px dashed color-mix(in srgb,var(--accent) 55%,transparent);outline-offset:2px}",
    "body.dash-sua [data-khoi].dash-chon{outline:2px solid var(--accent)}",
    "body.dash-sua [data-khoi][data-dash-an]{display:block!important;opacity:.35}",
    ".dash-tbk{position:absolute;top:4px;right:4px;z-index:20;display:flex;gap:4px;padding:4px;border-radius:6px;background:var(--surface);border:1px solid var(--border);box-shadow:0 3px 6px rgba(0,0,0,.12);font-size:12px}",
    ".dash-tbk{flex-wrap:wrap;justify-content:flex-end;max-width:calc(100% - 8px)}.dash-tbk button{white-space:nowrap}.dash-tbk select{max-width:130px}",
    "body .dash-tbk button,body .dash-tbk select{min-height:26px!important;height:26px!important;padding:0 6px!important;font-size:12px!important;line-height:24px!important;border-radius:4px!important;font-weight:400!important}",   // pop-up có luật nút 40px riêng — thanh công cụ khối luôn gọn
    ".dash-tbk button,.dash-tbk select{min-height:26px;padding:0 6px;border:1px solid var(--border);border-radius:4px;background:var(--surface);color:var(--text);font:inherit;font-size:12px;cursor:pointer}",
    ".dash-tbk .keo{cursor:grab}.dash-tbk .ten{align-self:center;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted);padding:0 4px}",
    ".dash-mep{position:absolute;z-index:19;background:color-mix(in srgb,var(--accent) 35%,transparent)}",
    ".dash-mep.p{top:0;right:0;width:8px;height:100%;cursor:ew-resize}.dash-mep.d{left:0;bottom:0;height:8px;width:100%;cursor:ns-resize}",
    ".dash-cho{outline:3px solid var(--accent)!important}",
    /* 17/10 thanh bên kiểu khung: khung chừa đầu 52px cho thanh «⠿ Khung», thành phần chừa đầu 40px cho «⠿ tên» — không che nội dung */
    "body.dash-sua .hx-tb-khung{position:relative;padding-top:52px!important;outline:2px dashed color-mix(in srgb,var(--accent) 45%,transparent);outline-offset:-4px}",
    "body.dash-sua #modal.hx-ben .hx-tb-khung[data-trong]{display:grid;min-height:140px}",
    "body.dash-sua .hx-tb-tp{position:relative;padding-top:40px;min-height:64px;outline:1px dashed color-mix(in srgb,var(--accent) 55%,transparent);outline-offset:2px}",
    "body.dash-sua #modal.hx-ben .hx-tb-tp[data-tb-an]{display:block;opacity:.4}",
    "body.dash-sua #modal.hx-ben .hx-tb-luoi>.hx-tb-khung>.hx-tb-tp{padding-top:40px!important;position:relative!important}",   // Quyết định dính đáy (sticky) — lúc chỉnh thì thôi dính, chừa đầu cho tay nắm
    ".dash-tb-k{top:8px!important;left:8px;right:auto!important}.dash-tb-p{top:0!important;left:0;right:auto!important}",
    ".dash-tb-dangkeo{opacity:.45}.dash-cho-truoc{box-shadow:inset 4px 0 0 var(--accent),inset 0 4px 0 var(--accent)!important}.dash-cho-sau{box-shadow:inset -4px 0 0 var(--accent),inset 0 -4px 0 var(--accent)!important}",
    ".dash-tb-bong{position:fixed;z-index:200;pointer-events:none;padding:4px 10px;border-radius:6px;background:var(--accent);color:var(--accent-text,#fff);font-size:12px;box-shadow:0 6px 16px rgba(0,0,0,.18)}"
  ].join("\n"); document.head.appendChild(css);

  /* ---------- trạng thái ---------- */
  function chup() { LUI.push(JSON.stringify(CFG)); if (LUI.length > 80) LUI.shift(); TOI = []; }
  function doi() { window.DASH_BOCUC = CFG; if (window.DASH_AP) window.DASH_AP.apDung(); if (window.hxTB) window.hxTB.ap(); veBang(); veKhoi(); luuSau(); }
  function luuSau() { trangThai("Đang lưu…"); clearTimeout(hLuu); hLuu = setTimeout(luu, 700); }
  function luu() {
    if (!MAY_CHU) { trangThai("Máy chủ QC không trả lời — CHƯA lưu"); return; }
    fetch(API + "bocuc", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tab: CFG.tab, khoi: CFG.khoi, thanhBen: CFG.thanhBen || {} }) })
      .then(function (r) { return r.json(); }).then(function (j) { if (!j.ok) throw new Error(j.loi); CFG.ver = j.ver; trangThai("Đã lưu bản QC v" + j.ver + " · " + new Date().toTimeString().slice(0, 5)); })
      .catch(function (e) { trangThai("Lỗi lưu: " + e.message); });
  }
  function trangThai(t) { var x = $("#dashBang .tt"); if (x) x.textContent = t; }
  function hoanTac(lui) { var a = lui ? LUI : TOI, b = lui ? TOI : LUI; if (!a.length) return; b.push(JSON.stringify(CFG)); CFG = JSON.parse(a.pop()); doi(); }

  /* ---------- TAB ---------- */
  function khoaTabDangMo() { return window.DASH_AP ? window.DASH_AP.khoaTab() : ""; }
  function damBaoTab() {   // lần đầu: lấy danh sách tab đúng như thanh bên đang hiện
    var co = {}; CFG.tab.forEach(function (t) { co[t.k] = 1; });
    $$("#sideNav .s-item").forEach(function (it) { var k = window.DASH_AP.khoaItem(it); if (co[k]) return; co[k] = 1;
      CFG.tab.push({ k: k, ten: tenItem(it), nhom: window.DASH_AP.nhomCua(it) }); });
  }
  function tenItem(it) { var c = it.cloneNode(true); $$(".sn,.di", c).forEach(function (x) { x.remove(); }); return c.textContent.trim(); }
  function veBang() {
    var b = $("#dashBang"); if (!b || !BAT) return;
    var on = khoaTabDangMo(), nhom = {}; CFG.tab.forEach(function (t) { nhom[t.nhom || ""] = 1; });
    var dl = '<datalist id="dashNhom">' + Object.keys(nhom).filter(Boolean).map(function (g) { return '<option value="' + esc(g) + '">'; }).join("") + "</datalist>";
    $(".dt", b).innerHTML = dl + CFG.tab.map(function (t, i) {
      var ao = t.banSaoCua || t.moi;
      return '<div class="tr' + (t.an ? " an" : "") + (t.k === on ? " on" : "") + '" data-i="' + i + '">' +
        '<input data-f="ten" value="' + esc(t.ten || "") + '" aria-label="Tên tab" placeholder="Tên tab">' +
        '<input data-f="nhom" list="dashNhom" value="' + esc(t.nhom || "") + '" aria-label="Nhóm" placeholder="(không nhóm)" style="width:110px">' +
        '<div class="bt"><button data-a="len" title="Lên">↑</button><button data-a="xuong" title="Xuống">↓</button>' +
        '<button data-a="an">' + (t.an ? "Hiện" : "Ẩn") + '</button><button data-a="sao">Sao chép</button>' +
        (ao ? '<button data-a="xoa">Xoá</button>' : "") + '<button data-a="mo">Mở</button></div>' +
        '<div class="k">' + esc(t.k) + (t.banSaoCua ? " · bản sao của " + esc(t.banSaoCua) : t.moi ? " · tab mới" : "") + "</div></div>";
    }).join("");
  }
  function suaTab(i, f, v) { chup(); CFG.tab[i][f] = v; doi(); }
  function hanhDongTab(i, a) {
    var t = CFG.tab[i]; chup();
    if (a === "len" && i > 0) { CFG.tab.splice(i - 1, 0, CFG.tab.splice(i, 1)[0]); }
    else if (a === "xuong" && i < CFG.tab.length - 1) { CFG.tab.splice(i + 1, 0, CFG.tab.splice(i, 1)[0]); }
    else if (a === "an") t.an = !t.an;
    else if (a === "sao") { var k = "ban:" + Date.now().toString(36); CFG.tab.splice(i + 1, 0, { k: k, ten: (t.ten || "Tab") + " (bản sao)", nhom: t.nhom, banSaoCua: t.banSaoCua || t.k });
      if (CFG.khoi[t.k]) CFG.khoi[k] = JSON.parse(JSON.stringify(CFG.khoi[t.k])); }
    else if (a === "xoa" && (t.banSaoCua || t.moi)) { CFG.tab.splice(i, 1); delete CFG.khoi[t.k]; var it = $('#sideNav .s-item[data-dash="' + t.k + '"]'); if (it) it.remove(); }
    else if (a === "mo") { LUI.pop(); var x = $$("#sideNav .s-item").find(function (y) { return window.DASH_AP.khoaItem(y) === t.k; }); if (x) x.click(); setTimeout(function () { veBang(); veKhoi(); }, 400); return; }
    else { LUI.pop(); return; }
    doi();
  }
  function themTab() { chup(); var k = "moi:" + Date.now().toString(36); CFG.tab.push({ k: k, ten: "Tab mới", nhom: "", moi: true }); doi(); }

  /* ---------- KHỐI theo VÙNG (13/10 chiều: chỉnh cả pop-up + mục BÊN TRONG khối — «Vào trong» / «Ra ngoài») ---------- */
  var TANG = [], GOC_CU = "", GOC_TB = false;   // TANG = đường đi từ vùng gốc vào vùng con (id khối)
  function vungHienTai() {
    var g = window.DASH_AP.vungGoc(); if (!g) return null;
    if (g.key !== GOC_CU) { GOC_CU = g.key; TANG = []; }   // đổi tab / mở-đóng pop-up → về vùng gốc
    var key = g.key + (TANG.length ? "|" + TANG.join("|") : ""), el = TANG.length ? window.DASH_AP.timVung(key) : g.el;
    if (!el) { TANG = []; key = g.key; el = g.el; }
    return { key: key, el: el, goc: g, laGocTab: !g.pop && !TANG.length };
  }
  function dsHien(el) { return window.DASH_AP.dsKhoiVung(el).filter(function (x) { return x.hasAttribute("data-dash-an") || x.getBoundingClientRect().width > 0; }); }
  function dsKhoiCfg(k, el) {   // danh sách khối của vùng (lần đầu chụp theo thứ tự đang hiện)
    var ds = window.DASH_AP.dsKhoiVung(el);
    if (!CFG.khoi[k]) CFG.khoi[k] = ds.map(function (x) { return { id: x.dataset.khoi, rong: 12 }; });
    ds.forEach(function (x) { if (!CFG.khoi[k].some(function (b) { return b.id === x.dataset.khoi; })) CFG.khoi[k].push({ id: x.dataset.khoi, rong: 12 }); });
    return CFG.khoi[k];
  }
  function laKhoiSong(el) { return !!(el.id || el.querySelector("[id],canvas,svg,table,video")); }   // module vẽ theo id ⇒ không nhân bản được
  function coVungCon(el) { var v = el; for (var n = 0; n < 3; n++) { var k = [].slice.call(v.children).filter(function (c) { return !c.classList.contains("dash-sua-ui") && c.getBoundingClientRect().width > 0; }); if (k.length >= 2) return true; if (k.length !== 1) return false; v = k[0]; } return false; }
  function veDuong(v) {
    var d = $("#dashBang .dd"); if (!d) return;
    var ten = v ? (v.goc.pop ? "Pop-up" : "Tab " + (tenTab(v.goc.key) || v.goc.key)) + TANG.map(function (x) { return " › " + x; }).join("") : "—";
    d.innerHTML = '<span>Đang chỉnh: <b>' + esc(ten) + "</b></span>" + (TANG.length ? '<button data-a="ra">Ra ngoài</button>' : "");
  }
  function tenTab(k) { var t = CFG.tab.find(function (x) { return x.k === k; }); return t ? t.ten : ""; }
  function veKhoi() {
    $$(".dash-sua-ui").forEach(function (x) { x.remove(); }); $$(".dash-vung").forEach(function (x) { x.classList.remove("dash-vung"); });
    if (!BAT) return;
    var tl = tbLuoi(); if (tl) { veTB(tl); return; }   // 17/10 thanh bên kiểu khung: chỉnh riêng (veTB)
    var v = vungHienTai(); veDuong(v); if (!v) return;
    v.el.classList.add("dash-vung");
    var tabs = v.laGocTab ? CFG.tab.filter(function (t) { return t.k !== v.key; }) : [];
    dsHien(v.el).forEach(function (el) {
      var id = el.dataset.khoi, song = laKhoiSong(el), con = coVungCon(el);
      var tb = document.createElement("div"); tb.className = "dash-tbk dash-sua-ui"; tb.title = "Giữ chuột vào thanh này rồi kéo để đổi chỗ";
      tb.innerHTML = '<button class="keo" data-a="keo">Kéo</button><button data-a="len" title="Lên trước">↑</button><button data-a="xuong" title="Xuống sau">↓</button>' +
        '<span class="ten" title="' + esc(id) + '">' + esc(id) + "</span>" +
        (con ? '<button data-a="vao" title="Chỉnh các mục bên trong khối này">Vào trong</button>' : "") +
        '<button data-a="an">Ẩn/Hiện</button><button data-a="ban"' + (song ? ' disabled title="Khối có dữ liệu sống (bảng/sơ đồ) — chỉ dời được, không nhân bản"' : "") + ">Nhân bản</button>" +
        (tabs.length ? '<select data-a="sang" aria-label="Chuyển sang tab"><option value="">Chuyển sang tab…</option>' + tabs.map(function (t) { return '<option value="' + esc(t.k) + '">' + esc(t.ten || t.k) + "</option>"; }).join("") + "</select>" : "") +
        '<button data-a="goc" title="Về mặc định (bỏ bố cục riêng của vùng này)">Mặc định</button>';
      var p = document.createElement("div"); p.className = "dash-mep p dash-sua-ui"; p.title = "Kéo để đổi bề rộng (12 cột)";
      var d = document.createElement("div"); d.className = "dash-mep d dash-sua-ui"; d.title = "Kéo để đổi chiều cao";
      if (el.getBoundingClientRect().height < 80) tb.style.top = "-38px";   // khối thấp (thanh lọc 32px): thanh công cụ nằm TRÊN khối
      el.appendChild(tb); el.appendChild(p); el.appendChild(d);
      tb.addEventListener("click", function (e) { var a = e.target.dataset.a; if (!a || a === "keo" || a === "sang") return; e.stopPropagation(); e.preventDefault(); hanhDongKhoi(id, a); });
      var sl = tb.querySelector("select"); if (sl) sl.addEventListener("change", function (e) { if (e.target.value) hanhDongKhoi(id, "sang", e.target.value); });
      keoDoiCho(tb, el); keoMep(p, el, "p"); keoMep(d, el, "d");
    });
  }
  function hanhDongKhoi(id, a, val) {
    var v = vungHienTai(); if (!v) return;
    if (a === "vao") { TANG.push(id); veKhoi(); return; }
    chup(); var ds = dsKhoiCfg(v.key, v.el), b = ds.find(function (x) { return x.id === id; }), i = ds.indexOf(b);
    if (a === "an") b.an = !b.an;
    else if (a === "len" || a === "xuong") {   // bỏ qua khối đang ẩn theo cỡ màn khi tìm chỗ kế bên
      var hien = dsHien(v.el).map(function (x) { return x.dataset.khoi; }), j = i;
      do { j += a === "len" ? -1 : 1; } while (j >= 0 && j < ds.length && hien.indexOf(ds[j].id) < 0);
      if (j < 0 || j >= ds.length) { LUI.pop(); return; } ds.splice(i, 1); ds.splice(j, 0, b);
    }
    else if (a === "ban") { ds.splice(i + 1, 0, { id: "ban:" + id + ":" + Date.now().toString(36), rong: b.rong, cao: b.cao, banSaoCua: id }); }
    else if (a === "sang") { b.sangTab = val; var t = CFG.khoi[val] || (CFG.khoi[val] = []); if (!t.some(function (x) { return x.id === id; })) t.push({ id: id, rong: 12 }); }
    else if (a === "goc") { delete CFG.khoi[v.key]; }
    doi();
  }
  function keoDoiCho(tay, el) {
    tay.addEventListener("pointerdown", function (e) {
      if (e.target.closest("button:not(.keo),select")) return;   // bấm nút trên thanh thì không kéo
      e.preventDefault(); var v = vungHienTai(), dich = null;
      function di(ev) { $$(".dash-cho").forEach(function (x) { x.classList.remove("dash-cho"); });
        var t = document.elementFromPoint(ev.clientX, ev.clientY), c = t && t.closest && t.closest("[data-khoi]");
        while (c && c.parentNode !== v.el) c = c.parentNode && c.parentNode.closest ? c.parentNode.closest("[data-khoi]") : null;   // khối CÙNG vùng
        dich = c && c !== el ? c : null; if (dich) dich.classList.add("dash-cho"); }
      function tha(ev) { document.removeEventListener("pointermove", di); document.removeEventListener("pointerup", tha); $$(".dash-cho").forEach(function (x) { x.classList.remove("dash-cho"); });
        if (!dich) return; chup(); var ds = dsKhoiCfg(v.key, v.el), a = ds.findIndex(function (x) { return x.id === el.dataset.khoi; });
        if (a < 0 || !ds.some(function (x) { return x.id === dich.dataset.khoi; })) { LUI.pop(); return; }
        var r = dich.getBoundingClientRect(), vr = v.el.getBoundingClientRect(),
          sau = r.width >= vr.width * 0.9 ? ev.clientY > r.top + r.height / 2 : ev.clientX > r.left + r.width / 2;   // khối rộng hết hàng: xét trên/dưới · khối cùng hàng: xét trái/phải
        var m = ds.splice(a, 1)[0], b = ds.findIndex(function (x) { return x.id === dich.dataset.khoi; }); ds.splice(sau ? b + 1 : b, 0, m); doi(); }
      document.addEventListener("pointermove", di); document.addEventListener("pointerup", tha);
    });
  }
  function keoMep(m, el, huong) {
    m.addEventListener("pointerdown", function (e) {
      e.preventDefault(); e.stopPropagation(); var v = vungHienTai(), vr = v.el.getBoundingClientRect(), r0 = el.getBoundingClientRect(), y0 = e.clientY;
      chup(); var b = dsKhoiCfg(v.key, v.el).find(function (x) { return x.id === el.dataset.khoi; });
      if (!v.el.classList.contains("dash-luoi")) { window.DASH_BOCUC = CFG; window.DASH_AP.apDung(); }
      function di(ev) {
        if (huong === "p") { var cot = Math.round((ev.clientX - r0.left) / (vr.width / 12)); b.rong = Math.max(1, Math.min(12, cot)); el.style.setProperty("--dash-rong", b.rong); }
        else { b.cao = Math.max(40, Math.round((r0.height + ev.clientY - y0) / 8) * 8); el.setAttribute("data-dash-cao", ""); el.style.setProperty("--dash-cao", b.cao + "px"); }
      }
      function tha() { document.removeEventListener("pointermove", di); document.removeEventListener("pointerup", tha); doi(); }
      document.addEventListener("pointermove", di); document.addEventListener("pointerup", tha);
    });
  }

  /* ---------- THANH BÊN theo KHUNG (17/10 user «mục chỉnh sửa ở bản QC không kéo được các chi tiết khung nhỏ bên trong — rã tất cả thành phần để t tự di chuyển») ----------
     Thanh bên có .hx-tb-luoi[data-tb] (Xác minh) thì chỉnh RIÊNG kiểu khung: kéo «⠿» thành phần thả vào BẤT KỲ khung nào (trước/sau thành phần khác, hoặc chỗ trống của khung),
     kéo «⠿ Khung» đổi chỗ khung, kéo mép phải đổi rộng (12 cột — của thanh với khung, của khung với thành phần), Ẩn/Hiện, + Khung mới, Xoá khung trống, Về mặc định.
     Lưu vào CFG.thanhBen[<khoá>] = {khung:[{id, rong, ds:[{id, rong, an}]}]}; hxTB.ap() (hasaki-xacminh.js) xếp lại tại chỗ. */
  var TB_TEN_KHOA = { may: "Theo máy", tacvu: "Theo tác vụ" };
  function tbLuoi() { var x = $("#modal.show .hx-tb-luoi[data-tb]"); return x && x.getBoundingClientRect().width ? x : null; }
  function tbRong(el) { return Math.max(1, Math.min(12, parseInt(el.style.getPropertyValue("--tb-rong"), 10) || 12)); }
  function tbDoc(luoi) {   // bố cục ĐANG HIỆN → cấu hình
    return $$(".hx-tb-khung", luoi).filter(function (f) { return f.parentNode === luoi; }).map(function (f) {
      return { id: f.dataset.tbk, rong: tbRong(f), ds: $$(".hx-tb-tp", f).map(function (x) { var b = { id: x.dataset.tp, rong: tbRong(x) }; if (x.hasAttribute("data-tb-an")) b.an = true; return b; }) };
    });
  }
  function tbGhi(luoi, khung) { chup(); CFG.thanhBen = CFG.thanhBen || {}; CFG.thanhBen[luoi.dataset.tb] = { khung: khung }; doi(); }
  function veTB(luoi) {
    var k = luoi.dataset.tb, ten = (window.hxTB && window.hxTB.ten) || {}, d = $("#dashBang .dd");
    if (d) d.innerHTML = '<span>Đang chỉnh: <b>Thanh bên · ' + esc(TB_TEN_KHOA[k] || k) + '</b></span><button data-a="tbmoi">+ Khung mới</button><button data-a="tbgoc" title="Bỏ bố cục riêng, về bố cục máy đặt sẵn">Về mặc định</button>';
    luoi.classList.add("dash-vung");
    $$(".hx-tb-khung", luoi).forEach(function (f, i) {
      var trong = !$(".hx-tb-tp", f);
      var tb = document.createElement("div"); tb.className = "dash-tbk dash-tb-k dash-sua-ui";
      tb.innerHTML = '<button class="keo" data-a="keo" title="Giữ rồi kéo để đổi chỗ khung">⠿ Khung ' + (i + 1) + '</button><span class="ten">' + tbRong(f) + '/12 cột</span>' + (trong ? '<button data-a="xoa">Xoá khung</button>' : "");
      var p = document.createElement("div"); p.className = "dash-mep p dash-sua-ui"; p.title = "Kéo để đổi bề rộng khung (12 cột của thanh)";
      f.appendChild(tb); f.appendChild(p);
      tb.addEventListener("click", function (e) { if (e.target.dataset.a !== "xoa") return; e.stopPropagation(); tbGhi(luoi, tbDoc(luoi).filter(function (x) { return x.id !== f.dataset.tbk; })); });
      tbKeo(tb.querySelector(".keo"), f, luoi, "khung"); tbMep(p, f, luoi);
    });
    $$(".hx-tb-tp", luoi).forEach(function (x) {
      var tb = document.createElement("div"); tb.className = "dash-tbk dash-tb-p dash-sua-ui";
      tb.innerHTML = '<button class="keo" data-a="keo" title="Giữ rồi kéo sang chỗ khác — thả vào bất kỳ khung nào">⠿ ' + esc(ten[x.dataset.tp] || x.dataset.tp) + '</button><span class="ten">' + tbRong(x) + '/12</span>' +
        '<button data-a="an">' + (x.hasAttribute("data-tb-an") ? "Hiện" : "Ẩn") + '</button>';
      var p = document.createElement("div"); p.className = "dash-mep p dash-sua-ui"; p.title = "Kéo để đổi bề rộng trong khung (12 cột của khung)";
      x.insertBefore(tb, x.firstChild); x.appendChild(p);
      tb.addEventListener("click", function (e) { if (e.target.dataset.a !== "an") return; e.stopPropagation(); x.toggleAttribute("data-tb-an"); tbGhi(luoi, tbDoc(luoi)); });
      tbKeo(tb.querySelector(".keo"), x, luoi, "tp"); tbMep(p, x, x.parentNode);
    });
  }
  function tbKeo(tay, el, luoi, loai) {
    tay.addEventListener("pointerdown", function (e) {
      e.preventDefault(); var dich = null, sau = false, vao = null;
      var bong = document.createElement("div"); bong.className = "dash-tb-bong"; bong.textContent = tay.textContent; document.body.appendChild(bong);
      el.classList.add("dash-tb-dangkeo");
      var xoaCho = function () { $$(".dash-cho,.dash-cho-truoc,.dash-cho-sau").forEach(function (x) { x.classList.remove("dash-cho", "dash-cho-truoc", "dash-cho-sau"); }); };
      function di(ev) {
        bong.style.left = ev.clientX + 12 + "px"; bong.style.top = ev.clientY + 12 + "px"; xoaCho();
        var t = document.elementFromPoint(ev.clientX, ev.clientY); dich = null; vao = null; if (!t || !t.closest || !luoi.contains(t)) return;
        if (loai === "tp") {
          var c = t.closest(".hx-tb-tp"), f = t.closest(".hx-tb-khung");
          if (c && c !== el && !el.contains(c)) { dich = c; var r = c.getBoundingClientRect(), rf = c.parentNode.getBoundingClientRect();
            sau = r.width >= rf.width * 0.8 ? ev.clientY > r.top + r.height / 2 : ev.clientX > r.left + r.width / 2; c.classList.add(sau ? "dash-cho-sau" : "dash-cho-truoc"); }
          else if (f && !c) { vao = f; f.classList.add("dash-cho"); }   // chỗ trống của khung → thả vào cuối khung
        } else {
          var g = t.closest(".hx-tb-khung"); if (g && g !== el) { dich = g; var r2 = g.getBoundingClientRect(), rl = luoi.getBoundingClientRect();
            sau = r2.width >= rl.width * 0.8 ? ev.clientY > r2.top + r2.height / 2 : ev.clientX > r2.left + r2.width / 2; g.classList.add(sau ? "dash-cho-sau" : "dash-cho-truoc"); }
        }
      }
      function tha() {
        document.removeEventListener("pointermove", di); document.removeEventListener("pointerup", tha); bong.remove(); el.classList.remove("dash-tb-dangkeo"); xoaCho();
        if (dich) dich.parentNode.insertBefore(el, sau ? dich.nextSibling : dich); else if (vao) vao.appendChild(el); else return;
        tbGhi(luoi, tbDoc(luoi));
      }
      document.addEventListener("pointermove", di); document.addEventListener("pointerup", tha);
    });
  }
  function tbMep(m, el, cha) {   // đổi rộng theo 12 cột của phần tử cha (thanh với khung, khung với thành phần)
    m.addEventListener("pointerdown", function (e) {
      e.preventDefault(); e.stopPropagation(); var luoi = el.closest(".hx-tb-luoi"), rc = cha.getBoundingClientRect(), r0 = el.getBoundingClientRect();
      var cs = getComputedStyle(cha), trong = rc.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      function di(ev) { var cot = Math.max(1, Math.min(12, Math.round((ev.clientX - r0.left) / (trong / 12)))); el.style.setProperty("--tb-rong", cot); }
      function tha() { document.removeEventListener("pointermove", di); document.removeEventListener("pointerup", tha); tbGhi(luoi, tbDoc(luoi)); }
      document.addEventListener("pointermove", di); document.addEventListener("pointerup", tha);
    });
  }

  /* ---------- chốt phát hành ---------- */
  function chot() {
    if (!confirm("Chốt bố cục và phát hành?\nMáy sẽ chạy QC (đồng bộ antd · điều hướng · điện thoại) — ĐẠT hết mới đẩy lên link thật.")) return;
    clearTimeout(hLuu); luu();
    setTimeout(function () {
      fetch(API + "chot", { method: "POST" }).then(function (r) { return r.json(); }).then(function (j) { if (!j.ok) throw new Error(j.loi); hoiChot(); })
        .catch(function (e) { trangThai("Chốt lỗi: " + e.message); });
    }, 900);
  }
  function hoiChot() {
    fetch(API + "chot").then(function (r) { return r.json(); }).then(function (s) {
      if (s.chay) { trangThai("Chốt · bước " + s.buoc + "/" + (s.tong || "?") + ": " + s.ten); setTimeout(hoiChot, 2500); return; }
      if (s.xong) trangThai(s.ok ? "✓ Đã chốt + phát hành" : "✗ Dừng ở «" + s.ten + "»: " + s.loi);
    }).catch(function () { setTimeout(hoiChot, 4000); });
  }

  /* ---------- khung ---------- */
  function dung() {
    var nut = document.createElement("button"); nut.id = "dashNut"; nut.type = "button"; nut.textContent = "Chỉnh bố cục"; document.body.appendChild(nut);
    var b = document.createElement("aside"); b.id = "dashBang"; b.setAttribute("aria-label", "Chỉnh bố cục dashboard");
    b.innerHTML = '<div class="dh"><span class="ten">Chỉnh bố cục ' + (APP === "factory" ? "Audit Factory" : "Audit Retail") + '</span><span class="noibo">BẢN NỘI BỘ</span><span class="vach"></span>' +
      '<button data-a="mtab" aria-expanded="false">Tab ▾</button><button data-a="them">+ Thêm tab</button><span class="vach"></span>' +
      '<button data-a="lui" title="Ctrl+Z">Hoàn tác</button><button data-a="toi" title="Ctrl+Y">Làm lại</button><span class="vach"></span>' +
      '<div class="dd"></div><span class="tt">…</span>' +
      '<button class="chinh" data-a="chot">Chốt phát hành</button><button data-a="xong">Xong chỉnh</button></div><div class="dt" hidden></div>';
    document.body.appendChild(b);
    nut.addEventListener("click", function () { BAT = !BAT; document.body.classList.toggle("dash-sua", BAT); nut.classList.toggle("on", BAT); nut.textContent = BAT ? "Xong chỉnh" : "Chỉnh bố cục";
      if (BAT) { damBaoTab(); veBang(); } veKhoi(); });
    b.addEventListener("click", function (e) { var a = e.target.dataset.a; if (!a) return; var tr = e.target.closest(".tr");
      if (tr) return hanhDongTab(+tr.dataset.i, a);
      if (a === "ra") { TANG.pop(); veKhoi(); return; }
      if (a === "tbmoi" || a === "tbgoc") { var tl = tbLuoi(); if (!tl) return;
        if (a === "tbgoc") { chup(); if (CFG.thanhBen) delete CFG.thanhBen[tl.dataset.tb]; doi(); return; }
        var c = tbDoc(tl); c.push({ id: "k" + Date.now().toString(36), rong: 6, ds: [] }); tbGhi(tl, c); return; }
      if (a === "mtab") { var dt = $("#dashBang .dt"); dt.hidden = !dt.hidden; e.target.classList.toggle("on", !dt.hidden); e.target.setAttribute("aria-expanded", String(!dt.hidden)); return; }
      if (a === "xong") { $("#dashNut").click(); return; }
      if (a === "them") themTab(); else if (a === "lui") hoanTac(true); else if (a === "toi") hoanTac(false); else if (a === "chot") chot(); });
    b.addEventListener("change", function (e) { var f = e.target.dataset.f, tr = e.target.closest(".tr"); if (f && tr) suaTab(+tr.dataset.i, f, e.target.value.trim()); });
    document.addEventListener("keydown", function (e) { if (!BAT || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.ctrlKey && e.key.toLowerCase() === "z") { e.preventDefault(); hoanTac(true); } else if (e.ctrlKey && e.key.toLowerCase() === "y") { e.preventDefault(); hoanTac(false); } });
    /* đổi tab khi đang chỉnh → vẽ lại tay nắm khối + đánh dấu tab đang mở */
    var n = $("#sideNav"); if (n) n.addEventListener("click", function () { if (BAT) setTimeout(function () { veBang(); veKhoi(); }, 500); });
    setInterval(function () { if (!BAT || !window.DASH_AP) return; var tl = tbLuoi(); if (tl ? !$(".dash-sua-ui", tl) : GOC_TB) { GOC_TB = !!tl; veKhoi(); return; } var g = window.DASH_AP.vungGoc(); if (g && g.key !== GOC_CU) veKhoi(); }, 600);   // thanh bên dựng lại (đổi lượt) → vẽ lại tay nắm   // mở / đóng pop-up, đổi tab bằng cách khác
    fetch(API + "ping").then(function (r) { return r.json(); }).then(function (j) { MAY_CHU = !!j.ok; trangThai("Bản QC v" + (j.ver || 0) + (j.chay ? " · đang chốt" : "")); if (j.chay) hoiChot(); })
      .catch(function () { trangThai("Máy chủ QC không trả lời — sẽ KHÔNG lưu"); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", dung); else dung();
})();
