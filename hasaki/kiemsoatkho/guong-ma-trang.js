/* guong-ma-trang.js — LỚP NỐI TRANG cho bản dự phòng Xác minh MÃ HOÁ (window.hxGuongMa) · 22/10/2026.
 *
 * 22/10 user «máy gương clip dự phòng phải để cả admin của máy đó cũng KHÔNG xem được clip lẫn dữ liệu Xác minh, mà clip vẫn phát nhanh,
 * tua được». Bản dự phòng MÃ HOÁ (ping maHoa:1) chỉ giữ bản mã, tên ẩn. Trang lấy khoá K qua Apps Script xmKhoaMa bằng phiên tài khoản
 * (giữ trong BỘ NHỚ trang, không localStorage).
 *  · Đường CHÍNH: đưa K cho service worker sw.js (postMessage) — sw.js giải mã luồng theo Range ⇒ <video> phát ngay, tua được.
 *    Mọi đường dữ liệu / ảnh / clip của tab Xác minh đổi sang «__giai-ma/k?u=<khoá>» (hasaki-xacminh.js u_/thu_/goi).
 *  · 22/10 user «iPhone: nhiều» — ĐƯỜNG LÙI khi không có service worker (Safari/iOS, http LAN, trình duyệt chặn) hoặc sw.js phát hỏng:
 *    trang tự tải bản mã /ma/<tên ẩn> (kèm phiên), giải từng đoạn bằng WebCrypto (giai-ma-guong.js — dùng chung với sw.js), ghép Blob
 *    đúng loại → blob: URL. Video: <video> báo lỗi, hoặc chưa đủ khung hình sau 6 s → tải trọn (chỉ báo «Đang tải clip x%», trần 150 MB),
 *    giữ vị trí đang xem; blob thu hồi khi phần tử rời trang / đổi clip. Ảnh + dữ liệu /api/* cũng giải trong trang khi cần.
 *    Không có service worker thì đường giải mã là «about:blank#__giai-ma/…» — báo lỗi ngay, không tốn lượt mạng nào.
 *  · Laptop bật (không mã hoá) → quên khoá, gỡ đăng ký sw.js, trang như cũ. Định dạng + cách đặt tên: hasaki/guong-ma-hoa.mjs. */
(function () {
  "use strict";
  var KHOA = "", CHO = null, KK = null, LIB = null, SW_OK = false;
  var SW = "serviceWorker" in navigator && navigator.serviceWorker ? navigator.serviceWorker : null;
  var TRAN_CLIP = 150 * 1048576, TRAN_ANH = 30 * 1048576;
  var goc = function () { try { return localStorage.getItem("hx-api") || window.HX_API; } catch (e) { return window.HX_API; } };
  var phien = function () { try { return localStorage.getItem("hx-phien") || ""; } catch (e) { return ""; } };
  var goiKhoa = function () { return { hxGm: "khoa", khoa: KHOA, goc: goc(), phien: phien() }; };
  var hoiCho = function (p, ms, chu) { return Promise.race([p, new Promise(function (o, h) { setTimeout(function () { h(new Error(chu)); }, ms); })]); };
  var loi = function (chu, ma) { var e = new Error(chu); e.ma = ma; return e; };

  function layKhoa() {
    var T = window.TK;
    if (!T || !T.phien || typeof window.tkGoi !== "function") return Promise.reject(new Error("Chưa đăng nhập tài khoản — không lấy được khoá giải mã."));
    return hoiCho(window.tkGoi("xmKhoaMa", { phien: T.phien }), 45000, "Apps Script không trả khoá sau 45 giây")
      .then(function (j) { if (!/^[A-Za-z0-9+\/]{43}=$/.test(String(j.khoa || ""))) throw new Error("Apps Script trả khoá hỏng"); return j.khoa; });
  }
  function napLib() {   // giai-ma-guong.js — chỉ nạp khi đang ở bản dự phòng mã hoá
    if (window.hxGiaiMa) return Promise.resolve(window.hxGiaiMa);
    if (LIB) return LIB;
    LIB = new Promise(function (ok, hong) {
      var s = document.createElement("script"); s.src = new URL("giai-ma-guong.js?v=20261022a", document.baseURI).href;
      s.onload = function () { ok(window.hxGiaiMa); }; s.onerror = function () { LIB = null; hong(new Error("Không tải được bộ giải mã — tải lại trang.")); };
      document.head.appendChild(s);
    });
    return LIB;
  }
  function guiSW() {
    var ch = new MessageChannel(), c = SW && SW.controller; if (!c) return Promise.reject(new Error("Bộ giải mã chưa chạy"));
    var p = new Promise(function (o, h) { ch.port1.onmessage = function (ev) { (ev.data || {}).ok ? o() : h(new Error((ev.data || {}).loi || "Bộ giải mã từ chối khoá")); }; });
    c.postMessage(goiKhoa(), [ch.port2]); return hoiCho(p, 10000, "Bộ giải mã không trả lời");
  }
  function dangKy() {   // → true khi sw.js điều khiển trang + đã nhận khoá; mọi trục trặc → false (dùng đường lùi, không báo lỗi)
    if (!SW) return Promise.resolve(false);
    return hoiCho(SW.register("sw.js").then(function () { if (SW.controller) return;
      return new Promise(function (o) { SW.addEventListener("controllerchange", o, { once: true }); }); }), 8000, "sw chậm")
      .then(guiSW).then(function () { return true; }, function () { return false; });
  }
  function sanSang() {
    if (CHO) return CHO;
    CHO = layKhoa().then(function (k) { KHOA = k; return Promise.all([dangKy(), napLib().then(function (G) { return G.nhapKhoa(k); })]); })
      .then(function (r) { SW_OK = r[0]; KK = r[1]; return true; });
    CHO.catch(function () { CHO = null; });
    return CHO;
  }
  if (SW) SW.addEventListener("message", function (ev) {   /* sw.js bị trình duyệt tắt khi rảnh → mất khoá → hỏi lại trang */
    var d = ev.data || {}, port = ev.ports && ev.ports[0]; if (d.hxGm !== "xin" || !port) return;
    if (!window.__HX_MA_HOA) return port.postMessage({ loi: "trang không ở chế độ bản dự phòng mã hoá" });
    sanSang().then(function () { port.postMessage(goiKhoa()); }, function (e) { port.postMessage({ loi: e.message }); });
  });
  window.addEventListener("hx-phien", function () { if (KHOA && SW && SW.controller) guiSW().catch(function () {}); });

  var khoaDuong = function (p) { var s = String(p || "").split("?")[0]; try { return decodeURIComponent(s); } catch (e) { return s; } };
  var url = function (k, du) {
    var q = "?u=" + encodeURIComponent(k) + (du ? "&du=" + encodeURIComponent(du) : "");
    return SW_OK ? new URL("__giai-ma/k", document.baseURI).href + q : "about:blank#__giai-ma/k" + q;   // không SW: lỗi ngay → đường lùi blob
  };
  var thamSo = function (src) { var m = /__giai-ma\/k\?(.*)$/.exec(String(src || "")); if (!m) return null; var q = new URLSearchParams(m[1]); return { k: q.get("u") || "", du: q.get("du") || "" }; };
  var duongCua = function (u, api) {   /* url bất kỳ trang đang cầm → đường dẫn gốc (/bc/…) hoặc "" nếu là ảnh ngoài (hr-media) */
    u = String(u || ""); var t = thamSo(u);
    if (t) return /^(tep|thu):/.test(t.k) ? t.k.slice(4) : "";
    if (api && u.indexOf(api) === 0) u = u.slice(api.length);
    return u.charAt(0) === "/" ? u : "";
  };

  /* ---- giải trong trang (đường lùi) ---- */
  function hoiMa(k) {
    return sanSang().then(function () { return window.hxGiaiMa.tenAn(KK, k); }).then(function (ten) {
      return fetch(String(goc()).replace(/\/$/, "") + "/ma/" + ten + "?phien=" + encodeURIComponent(phien()), { cache: "no-store", credentials: "omit" });
    }).then(function (r) {
      if (r.status === 401) { var e = loi("Phiên đăng nhập đã hết — đăng nhập lại.", 401); e.canDangNhap = 1; throw e; }
      if (r.status === 404) throw loi("Máy dự phòng chưa có tệp này (laptop chưa đẩy sang, hoặc khoá giải mã không khớp).", 404);
      if (!r.ok) throw loi("Máy dự phòng trả " + r.status, 502);
      return r;
    });
  }
  /** khoá (và khoá dự phòng du) → { blob, d } giải trọn trong trang */
  function taiBlob(k, du, tran, tienDo) {
    var mo = function (x) { return hoiMa(x).then(function (r) { return window.hxGiaiMa.docTron(r, x, KK, { tran: tran, tienDo: tienDo }); }); };
    return mo(k).catch(function (e) { if (du && e && e.ma === 404) return mo(du); throw e; })
      .then(function (x) { return { blob: new Blob(x.phan, { type: x.d.ct }), d: x.d }; });
  }
  var ANH = new Map(), anhTong = 0;   // ảnh đã giải: khoá → Promise<blob url> (≤ 60 MB, ảnh dùng lại nhiều chỗ)
  function urlAnh(k, du) {
    if (ANH.has(k)) return ANH.get(k);
    var p = taiBlob(k, du, TRAN_ANH).then(function (x) {
      var u = URL.createObjectURL(x.blob); if (anhTong + x.blob.size > 60 * 1048576) { ANH.delete(k); return { u: u, tam: 1 }; }
      anhTong += x.blob.size; return { u: u }; });
    ANH.set(k, p); p.catch(function () { ANH.delete(k); });
    return p;
  }
  var TREO = [];   // blob gắn vào phần tử: { el, url } — thu hồi khi phần tử rời trang hoặc đổi nguồn
  function giu(el, u) { TREO.push({ el: el, url: u }); }
  setInterval(function () {
    TREO = TREO.filter(function (x) { if (x.el && document.contains(x.el) && x.el.src === x.url) return true; try { URL.revokeObjectURL(x.url); } catch (e) { /* */ } return false; });
  }, 8000);

  function luiAnh(img) {
    var p = thamSo(img.getAttribute("src")); if (!p || img.__gmK === p.k) return;
    img.__gmK = p.k;
    urlAnh(p.k, p.du).then(function (x) { if (img.__gmK !== p.k) return; img.src = x.u; if (x.tam) giu(img, x.u); }, function () { /* ảnh thiếu: để khung trống như trước */ });
  }
  function chiBao(v) {
    var o = v.__gmChi; if (o && o.isConnected) return o;
    var cha = v.parentNode; if (!cha) return null;
    if (getComputedStyle(cha).position === "static") cha.style.position = "relative";
    o = document.createElement("div"); o.className = "hx-gm-tai";
    o.style.cssText = "position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);padding:6px 12px;border-radius:999px;font-size:13px;font-weight:650;" +
      "background:color-mix(in srgb,var(--surface,Canvas) 88%,transparent);color:var(--text,CanvasText);pointer-events:none;z-index:3;white-space:nowrap";
    cha.appendChild(o); v.__gmChi = o; return o;
  }
  function luiVideo(v) {
    var p = thamSo(v.currentSrc || v.getAttribute("src")); if (!p || v.__gmK === p.k) return;
    v.__gmK = p.k;
    var t = v.currentTime || 0, chay = v.autoplay || !v.paused, o = chiBao(v);
    if (o) o.textContent = "Đang tải clip 0%";
    taiBlob(p.k, p.du, TRAN_CLIP, function (nhan, tong) { if (o && tong) o.textContent = "Đang tải clip " + Math.min(99, Math.floor(nhan / tong * 100)) + "%"; })
      .then(function (x) {
        if (v.__gmK !== p.k) return;   // người xem đã đổi clip trong lúc tải
        var u = URL.createObjectURL(x.blob); giu(v, u);
        if (t) v.addEventListener("loadedmetadata", function () { try { v.currentTime = t; } catch (e) { /* */ } }, { once: true });
        v.src = u; if (chay) v.play().catch(function () {});
        if (o) o.remove();
      }, function (e) { if (o && v.__gmK === p.k) o.textContent = "Không tải được clip: " + ((e && e.message) || "lỗi"); });
  }
  /* bắt lỗi ảnh/clip trên đường giải mã (sự kiện không nổi bọt → nghe ở pha bắt) + clip chưa ra khung hình sau 6 s */
  document.addEventListener("error", function (e) {
    var el = e.target; if (!window.__HX_MA_HOA || !el || !el.tagName) return;
    if (el.tagName === "IMG") luiAnh(el); else if (el.tagName === "VIDEO") luiVideo(el);
  }, true);
  document.addEventListener("loadstart", function (e) {
    var v = e.target; if (!window.__HX_MA_HOA || !v || v.tagName !== "VIDEO") return;
    var src = v.currentSrc || v.getAttribute("src"); if (!thamSo(src)) return;
    setTimeout(function () { if ((v.currentSrc || v.getAttribute("src")) === src && v.readyState < 2 && document.contains(v)) luiVideo(v); }, 6000);
  }, true);

  function apiTrang(p) {
    return taiBlob("api:" + p, "", 64 * 1048576).then(function (x) { return x.blob.text(); })
      .then(function (t) { try { return JSON.parse(t); } catch (e) { throw new Error("Dữ liệu giải mã hỏng"); } });
  }
  function apiSW(p) {
    return fetch(url("api:" + p), { cache: "no-store" }).then(function (r) { return r.text().then(function (t) {
      var j = null; try { j = JSON.parse(t); } catch (e) { throw loi("Bộ giải mã trả dữ liệu hỏng", 502); }
      if (!r.ok) { var e = loi(j.loi || ("HTTP " + r.status), r.status); e.canDangNhap = j.canDangNhap; throw e; }
      return j; }); });
  }
  window.hxGuongMa = {
    sanSang: sanSang,
    coSW: function () { return SW_OK; },
    tep: function (p) { return url("tep:" + khoaDuong(p)); },
    thu: function (u, api) { var p = duongCua(u, api); if (!p) return u; var k = khoaDuong(p); return url("thu:" + k, "tep:" + k); },
    api: function (path) {   /* bản chụp GET /api/* (laptop chụp sẵn); ghi-chu?id= lọc tại trang; nv?q= không chụp được → rỗng */
      var q = new URL(path, "http://x"), p = q.pathname, id = q.searchParams.get("id");
      if (p === "/api/nv") return Promise.resolve([]);
      if (!/^\/api\/(du-lieu|quy-dinh|ghi-chu)$/.test(p)) return Promise.reject(new Error("Bản dự phòng mã hoá không có mục " + p));
      return sanSang().then(function () {
        if (!SW_OK) return apiTrang(p);
        return apiSW(p).catch(function (e) { if (e && (e.ma === 401 || e.ma === 404)) throw e; return apiTrang(p); });   // sw.js hỏng → giải trong trang
      }).then(function (j) { return p === "/api/ghi-chu" && id ? (j || []).filter(function (x) { return x.id === id; }) : j; });
    },
    capNhat: function () {   /* sau mỗi lần dò máy chủ: không mã hoá → quên khoá + gỡ sw.js (trang y như cũ) */
      if (window.__HX_MA_HOA) return;
      KHOA = ""; CHO = null; KK = null; SW_OK = false;
      if (SW && SW.controller && /\/sw\.js$/.test(SW.controller.scriptURL)) SW.getRegistration().then(function (r) { if (r) r.unregister(); }).catch(function () {});
    }
  };
})();
