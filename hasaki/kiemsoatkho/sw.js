/* sw.js — BỘ GIẢI MÃ LUỒNG cho bản dự phòng Xác minh mã hoá (22/10/2026).
 *
 * 22/10 user: «máy gương clip dự phòng phải để cả admin của máy đó cũng KHÔNG xem được clip lẫn dữ liệu Xác minh, mà clip vẫn phát nhanh,
 * tua được như hiện tại (không chấp nhận tải hết rồi mới phát)».
 *  · Máy dự phòng chỉ có BẢN MÃ, tên ẩn (hasaki/guong-ma-hoa.mjs mô tả định dạng). Giải mã từng đoạn: giai-ma-guong.js (dùng chung với
 *    trang — đường lùi khi trình duyệt không chạy được tệp này, vd Safari/iOS). Khoá K chỉ trang có (Apps Script xmKhoaMa, cần phiên tài
 *    khoản có quyền Xác minh) → trang đưa K cho tệp này qua postMessage, KHÔNG lưu đĩa.
 *  · Trang trỏ <video>/<img>/fetch vào đường NỘI BỘ cùng gốc «__giai-ma/k?u=<khoá>[&du=<khoá dự phòng>]». Tệp này chặn đường đó,
 *    tính tên ẩn, hỏi máy dự phòng ĐÚNG các đoạn cần bằng Range (HX_API/ma/<tên>), giải mã WebCrypto từng đoạn 1 MiB rồi trả 206 chuẩn
 *    (Content-Range, Accept-Ranges) ⇒ <video> phát ngay, tua tới đâu kéo đoạn tới đó.
 *  · CHỈ chạm đường «__giai-ma/». Mọi yêu cầu khác: không respondWith, không cache ⇒ trang chạy y như không có service worker.
 *    Laptop bật (không phải bản mã hoá) thì index.html gỡ đăng ký tệp này (hxGuongMa.capNhat).
 *  · Bị trình duyệt tắt khi rảnh → mất K trong bộ nhớ → lượt sau hỏi lại trang đang mở (MessageChannel «xin»). */
"use strict";
importScripts("giai-ma-guong.js");
var G = self.hxGiaiMa, DAU = G.DAU, THE = G.THE, loi = G.loi;
var K = null;              // { goc, phien, kGoc (HKDF), kTen (HMAC) }
var DAU_C = new Map();     // tên ẩn → Promise<thông tin đầu tệp + khoá tệp>
var CHO = null;            // lượt xin khoá đang chờ trang trả

self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener("message", function (e) {
  var d = e.data || {}, port = e.ports && e.ports[0];
  if (d.hxGm === "khoa") datKhoa(d).then(function () { if (port) port.postMessage({ ok: 1 }); }, function (x) { if (port) port.postMessage({ loi: String((x && x.message) || x) }); });
  else if (d.hxGm === "xoa") { K = null; DAU_C.clear(); if (port) port.postMessage({ ok: 1 }); }
});

function datKhoa(d) {
  if (!/^https?:\/\//.test(String(d.goc || ""))) return Promise.reject(new Error("thiếu địa chỉ máy dự phòng"));
  return G.nhapKhoa(d.khoa).then(function (kk) { DAU_C.clear(); K = { goc: String(d.goc).replace(/\/$/, ""), phien: String(d.phien || ""), kGoc: kk.kGoc, kTen: kk.kTen }; return K; });
}

/* Mất K (trình duyệt tắt service worker khi rảnh) → hỏi trang đã gửi yêu cầu (hoặc mọi trang đang mở) qua MessageChannel. */
function coKhoa(clientId) {
  if (K) return Promise.resolve(K);
  if (CHO) return CHO;
  CHO = (clientId ? self.clients.get(clientId) : Promise.resolve(null)).then(function (c) { return c ? [c] : self.clients.matchAll({ type: "window" }); })
    .then(function (ds) {
      return new Promise(function (ok, hong) {
        var con = ds.length, xong = false;
        if (!con) return hong(loi("Không có trang nào giữ khoá giải mã — mở lại tab Xác minh.", 503));
        var h = setTimeout(function () { if (!xong) { xong = true; hong(loi("Trang chưa trả khoá giải mã (Apps Script chậm) — thử lại.", 503)); } }, 50000);
        ds.forEach(function (c) {
          var ch = new MessageChannel();
          ch.port1.onmessage = function (ev) {
            var d = ev.data || {}; if (xong) return;
            if (d.khoa) { xong = true; clearTimeout(h); datKhoa(d).then(ok, hong); }
            else if (!--con) { xong = true; clearTimeout(h); hong(loi(d.loi || "Không lấy được khoá giải mã.", 503)); }
          };
          c.postMessage({ hxGm: "xin" }, [ch.port2]);
        });
      });
    });
  var p = CHO; p.then(function () { CHO = null; }, function () { CHO = null; });
  return p;
}

function hoi(ten, a, b, sig) {   // Range tới máy dự phòng; phiên qua tham số (khỏi tiêu đề riêng ⇒ ít preflight)
  return fetch(K.goc + "/ma/" + ten + "?phien=" + encodeURIComponent(K.phien), { headers: { range: "bytes=" + a + "-" + (b == null ? "" : b) },
    signal: sig, cache: "no-store", credentials: "omit", mode: "cors" });
}
function layDau(ten, khoa) {
  var p = DAU_C.get(ten); if (p) return p;
  p = hoi(ten, 0, DAU - 1).then(function (r) {
    if (r.status === 401) throw loi("Cần đăng nhập", 401);
    if (r.status === 404) throw loi("Máy dự phòng chưa có tệp này (laptop chưa đẩy sang, hoặc khoá giải mã không khớp).", 404);
    if (!r.ok) throw loi("Máy dự phòng trả " + r.status, 502);
    return r.arrayBuffer();
  }).then(function (ab) { return G.docDau(new Uint8Array(ab).slice(0, DAU), khoa, K); });
  DAU_C.set(ten, p); p.catch(function () { DAU_C.delete(ten); });
  return p;
}

/* Luồng bản rõ [a..b] (đã kẹp trong cỡ tệp): 1 yêu cầu Range tới máy dự phòng phủ các đoạn i0..i1, giải mã đoạn nào đủ byte là đẩy ra ngay
   (kéo theo nhu cầu của trình phát — pull); người xem tua đi thì trình duyệt huỷ luồng → huỷ luôn yêu cầu tới máy dự phòng. */
function luong(t, a, b) {
  var d = t.d, S = d.doan, CS = S + THE, i0 = Math.floor(a / S), i1 = Math.floor(b / S);
  var tu = DAU + i0 * CS, den = Math.min(d.tong - 1, DAU + (i1 + 1) * CS - 1);
  var ctl = new AbortController(), doc = null, boQua = 0, gom = G.boGom(), i = i0;
  return new ReadableStream({
    pull: function (c) {
      var mo = doc ? Promise.resolve() : hoi(t.ten, tu, den, ctl.signal).then(function (r) {
        if (r.status === 401) throw loi("Cần đăng nhập", 401);
        if (r.status !== 206 && r.status !== 200) throw loi("Máy dự phòng trả " + r.status, 502);
        boQua = r.status === 200 ? tu : 0; doc = r.body.getReader();
      });
      return mo.then(function lap() {
        var coR = Math.min(S, d.coRo - i * S), can = coR + THE;
        if (gom.dai() >= can) return G.giaiDoan(d, i, gom.lay(can)).then(function (ro) {
          var x0 = i * S, ca = Math.max(a, x0) - x0, cb = Math.min(b, x0 + coR - 1) - x0 + 1;
          c.enqueue(new Uint8Array(ro, ca, cb - ca)); i++;
          if (i > i1) { c.close(); try { doc.cancel(); } catch (x) {} }
        });
        return doc.read().then(function (r) {
          if (r.done) throw loi("Bản mã bị cụt khi tải.", 502);
          var m = r.value; if (boQua) { var bo = Math.min(boQua, m.length); boQua -= bo; m = m.subarray(bo); }
          gom.day(m);
          return lap();
        });
      }).catch(function (x) { ctl.abort(); c.error(x); });
    },
    cancel: function () { ctl.abort(); }
  }, { highWaterMark: 0 });
}

function traLoi(req, t) {
  var d = t.d, co = d.coRo;
  var h = { "Content-Type": d.ct, "Accept-Ranges": "bytes", "Cache-Control": "no-store" };
  var rg = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.get("range") || "").trim());
  if (!co) { h["Content-Length"] = "0"; return new Response(null, { status: 200, headers: h }); }
  var a = 0, b = co - 1;
  if (rg && (rg[1] !== "" || rg[2] !== "")) {
    if (rg[1] === "") a = Math.max(0, co - Number(rg[2]));
    else { a = Number(rg[1]); if (rg[2] !== "") b = Math.min(Number(rg[2]), co - 1);
      /* hỏi mở «bytes=a-» (trình phát luôn hỏi kiểu này): trả tối đa 4 đoạn (4 MiB) — trình phát tự hỏi tiếp; tua thì yêu cầu cũ đã khép, đường hầm
         không còn bị luồng cũ (kéo tới cuối tệp) chiếm băng thông. Đo 22/10 qua hầm: tua Theo máy 29 s → 1,1 s. */
      else b = Math.min(co - 1, (Math.floor(a / d.doan) + 4) * d.doan - 1); }
    if (a >= co || a > b) return new Response(null, { status: 416, headers: { "Content-Range": "bytes */" + co } });
    h["Content-Range"] = "bytes " + a + "-" + b + "/" + co;
  }
  h["Content-Length"] = String(b - a + 1);
  return new Response(luong(t, a, b), { status: h["Content-Range"] ? 206 : 200, headers: h });
}
function traLoiLoi(x) {
  var ma = (x && x.ma) || 500;
  var o = { loi: (x && x.message) || "Lỗi giải mã" }; if (ma === 401) o.canDangNhap = 1; if (ma === 503) o.khongKhoa = 1;
  return new Response(JSON.stringify(o), { status: ma, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
function moTep(khoa) { return G.tenAn(K, khoa).then(function (ten) { return layDau(ten, khoa).then(function (d) { return { ten: ten, d: d }; }); }); }

self.addEventListener("fetch", function (e) {
  var req = e.request; if (req.method !== "GET") return;
  var u; try { u = new URL(req.url); } catch (x) { return; }
  if (u.origin !== self.location.origin || u.pathname.indexOf("/__giai-ma/") < 0) return;   // mọi đường khác: đi thẳng mạng như chưa có SW
  var khoa = u.searchParams.get("u") || "", du = u.searchParams.get("du") || "";
  if (!/^(tep|thu|api):\//.test(khoa)) return e.respondWith(traLoiLoi(loi("Đường giải mã sai.", 400)));
  e.respondWith(coKhoa(e.clientId)
    .then(function () { return moTep(khoa).catch(function (x) { if (du && x && x.ma === 404) return moTep(du); throw x; }); })
    .then(function (t) { return traLoi(req, t); }, traLoiLoi));
});
