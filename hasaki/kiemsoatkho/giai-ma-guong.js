/* giai-ma-guong.js — PHẦN GIẢI MÃ DÙNG CHUNG cho sw.js (importScripts) và trang (index.html hxGuongMa) · 22/10/2026.
 *
 * 22/10 user: «iPhone: nhiều» — Safari/iOS có thể không chạy sw.js / không phát video qua service worker ⇒ trang phải tự giải mã được
 * (đường lùi blob). Định dạng tệp + cách đặt tên ẩn: hasaki/guong-ma-hoa.mjs (đổi ở đó thì đổi ở đây).
 *   đầu 36 byte "XMGM" · bản 1 · loại · salt 16 · cỡ bản rõ uint64 · cỡ đoạn uint32; đoạn i ở 36 + i·(đoạn+16), AES-256-GCM,
 *   khoá tệp = HKDF(K, salt, "xm-guong-tep"), nonce = [cờ cuối,0,0,0, i uint64], AAD = 36 byte đầu + khoá (chuỗi) UTF-8.
 *   tên ẩn = hex HMAC-SHA256(HKDF(K, rỗng, "xm-guong-ten"), khoá).
 * Chỉ WebCrypto, không thư viện ngoài. Gắn vào self.hxGiaiMa (trang: window, service worker: self). */
(function (g) {
  "use strict";
  var DAU = 36, THE = 16;
  var LOAI_CT = ["application/octet-stream", "video/mp4", "video/webm", "image/jpeg", "image/png", "application/json; charset=utf-8"];
  var utf8 = function (s) { return new TextEncoder().encode(String(s)); };
  var hex = function (ab) { return Array.prototype.map.call(new Uint8Array(ab), function (x) { return ("0" + x.toString(16)).slice(-2); }).join(""); };
  function loi(chu, ma) { var e = new Error(chu); e.ma = ma; return e; }
  function tuB64(s) { var b = atob(String(s || "")), r = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) r[i] = b.charCodeAt(i); return r; }

  /** K (base64 hoặc 32 byte) → { kGoc: khoá HKDF, kTen: khoá HMAC đặt tên } */
  function nhapKhoa(k) {
    var raw = typeof k === "string" ? tuB64(k) : new Uint8Array(k || []);
    if (raw.length !== 32) return Promise.reject(loi("khoá giải mã sai cỡ", 400));
    return crypto.subtle.importKey("raw", raw, "HKDF", false, ["deriveKey", "deriveBits"]).then(function (kGoc) {
      return crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: utf8("xm-guong-ten") }, kGoc, 256)
        .then(function (bits) { return crypto.subtle.importKey("raw", bits, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); })
        .then(function (kTen) { return { kGoc: kGoc, kTen: kTen }; });
    });
  }
  function tenAn(kk, khoa) { return crypto.subtle.sign("HMAC", kk.kTen, utf8(khoa)).then(hex); }

  /** 36 byte đầu → thông tin tệp + khoá tệp (Promise) */
  function docDau(h, khoa, kk) {
    if (!h || h.length < DAU || String.fromCharCode(h[0], h[1], h[2], h[3]) !== "XMGM") return Promise.reject(loi("Tệp trên máy dự phòng không đúng định dạng mã hoá.", 502));
    if (h[4] !== 1) return Promise.reject(loi("Phiên bản định dạng lạ: " + h[4], 502));
    var v = new DataView(h.buffer, h.byteOffset, DAU), coRo = v.getUint32(24) * 4294967296 + v.getUint32(28), doan = v.getUint32(32);
    if (!(doan >= 4096 && doan <= 16777216)) return Promise.reject(loi("Đầu tệp hỏng.", 502));
    var n = Math.max(1, Math.ceil(coRo / doan)), kb = utf8(khoa), ad = new Uint8Array(DAU + kb.length);
    ad.set(h.subarray(0, DAU), 0); ad.set(kb, DAU);
    return crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: h.slice(8, 24), info: utf8("xm-guong-tep") }, kk.kGoc, { name: "AES-GCM", length: 256 }, false, ["decrypt"])
      .then(function (kTep) { return { loai: h[5], ct: LOAI_CT[h[5]] || LOAI_CT[0], coRo: coRo, doan: doan, n: n, tong: DAU + coRo + THE * n, ad: ad, kTep: kTep }; });
  }
  function nonce(i, cuoi) { var n = new Uint8Array(12), v = new DataView(n.buffer); n[0] = cuoi ? 1 : 0; v.setUint32(4, Math.floor(i / 4294967296)); v.setUint32(8, i >>> 0); return n; }
  /** giải đoạn i (bản mã + thẻ) → ArrayBuffer bản rõ */
  function giaiDoan(d, i, ct) {
    return crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce(i, i === d.n - 1), additionalData: d.ad, tagLength: 128 }, d.kTep, ct)
      .catch(function () { throw loi("Không giải mã được — khoá sai hoặc tệp hỏng.", 500); });
  }
  /** bộ gom mảnh: đẩy Uint8Array vào, lấy ra đúng n byte đầu */
  function boGom() {
    var phan = [], dai = 0;
    return { dai: function () { return dai; }, day: function (m) { if (m.length) { phan.push(m); dai += m.length; } },
      lay: function (n) { var ra = new Uint8Array(n), o = 0;
        while (o < n) { var m = phan[0], can = n - o; if (m.length <= can) { ra.set(m, o); o += m.length; phan.shift(); } else { ra.set(m.subarray(0, can), o); phan[0] = m.subarray(can); o += can; } }
        dai -= n; return ra; } };
  }
  /** Đọc TRỌN phản hồi /ma/<tên> (từ byte 0) và giải từng đoạn ngay khi đủ byte. o.tienDo(daNhan, tong) · o.tran (byte bản rõ tối đa).
   *  → { d, phan: [ArrayBuffer…] } (ghép Blob/JSON ở nơi gọi). */
  function docTron(r, khoa, kk, o) {
    o = o || {};
    var doc = r.body.getReader(), gom = boGom(), d = null, i = 0, nhan = 0, ra = [];
    return (function lap() {
      if (!d && gom.dai() >= DAU) return docDau(gom.lay(DAU), khoa, kk).then(function (x) {
        d = x; if (o.tran && d.coRo > o.tran) { try { doc.cancel(); } catch (e) { /* */ } throw loi("Clip quá lớn để tải trọn trên máy này (" + Math.round(d.coRo / 1048576) + " MB).", 413); }
        return lap(); });
      if (d && i < d.n) { var coR = Math.min(d.doan, d.coRo - i * d.doan); if (gom.dai() >= coR + THE) return giaiDoan(d, i, gom.lay(coR + THE)).then(function (ro) { ra.push(ro); i++; return lap(); }); }
      if (d && i >= d.n) { try { doc.cancel(); } catch (e) { /* */ } return { d: d, phan: ra }; }
      return doc.read().then(function (x) {
        if (x.done) throw loi("Bản mã bị cụt khi tải.", 502);
        gom.day(x.value); nhan += x.value.length; if (o.tienDo) try { o.tienDo(nhan, d ? d.tong : 0); } catch (e) { /* */ }
        return lap();
      });
    })();
  }
  g.hxGiaiMa = { DAU: DAU, THE: THE, LOAI_CT: LOAI_CT, loi: loi, nhapKhoa: nhapKhoa, tenAn: tenAn, docDau: docDau, giaiDoan: giaiDoan, boGom: boGom, docTron: docTron };
})(typeof self !== "undefined" ? self : this);
