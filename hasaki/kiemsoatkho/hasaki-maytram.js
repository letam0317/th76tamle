/* hasaki-maytram.js — tab «Máy trạm» (Kiểm soát kho · HASAKI), module LAZY như hasaki-tonbatthuong.js.
 *
 *  User 13/10/2026: «tạo 1 sub-tab Máy trạm: các PC + nhịp tim, sức khoẻ (% RAM / CPU / ổ C còn lại), công việc PC đó chạy;
 *  yêu cầu dừng hoặc tiếp tục … khi dừng thì điều phối chuyển việc sang PC khác». Tối 13/10: «chưa thấy mục Máy trạm trên điện
 *  thoại» ⇒ tách khỏi Xác minh (Xác minh chỉ mở trên máy quản lý vì có ảnh người) thành tab riêng xem được ở mọi máy.
 *
 *  2 nguồn:
 *   · Máy quản lý (có máy chủ 8591 + đã đăng nhập Xác minh): /api/may-tram (đầy đủ) + nút Dừng / Tiếp tục / Gỡ (/api/may-tram/lenh).
 *   · Máy khác (điện thoại…): Apps Script action=pcBangTb (JSONP, khoá thiết bị như readTab) — CHỈ XEM. Lệnh dừng KHÔNG mở ra
 *     ngoài vì khoá thiết bị cấp cả cho máy nhân viên.
 *  Việc mỗi PC được giao: PC tự tính bằng dieu-phoi.mjs và gửi kèm nhịp tim (viecGiao) ⇒ màn này không tự suy luật.
 *  Luật nhẹ tải: 0 lượt gọi work/wms/hr — chỉ Apps Script (Script Properties), làm mới 30 s khi tab đang mở.
 */
(function () {
  "use strict";
  var API = "http://127.0.0.1:8591";
  var GAS = "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
  var HET_HAN_GIAY = 180;   // = hetHanPhut 3' của cai-pc/dieu-phoi.json: nhịp cũ hơn ⇒ máy coi như im
  var PANE = null, MTD = null, MT_LOI = "", DIEU_KHIEN = false, H = null;
  var TEN_VIEC = { "canh-b11": "Cò canh B1.1", "canh-xac-minh-b1": "Cò xác minh B1", "tim-bang-chung-b1": "Tìm bằng chứng B1",
    "canh-bai-xe-sang": "Canh bãi xe sáng", "canh-bai-xe-chieu": "Canh bãi xe chiều", "canh-bai-xe-toi": "Canh bãi xe tối", "xac-minh-camera": "Xác minh camera tối",
    "co-canh-planogram": "Cò canh planogram", "dong-bo-dashboard": "Đồng bộ dashboard", "packer-a8-sang": "Packer A8 sáng", "packer-a8-chieu": "Packer A8 chiều",
    "cham-cong": "Chấm công", "watchdog-ton-kho": "Canh tồn kho" };
  var tenV = function (t) { return TEN_VIEC[t] || t; };
  var e_ = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var phien = function () { try { return localStorage.getItem("hx-phien") || ""; } catch (e) { return ""; } };

  function napCss() {
    if (document.getElementById("mt-css")) return;
    var c = [
      /* nhãn + nút dùng lại khuôn Xác minh (chép đúng luật để tab này đứng một mình được khi Xác minh không nạp) */
      ".hx-tag{display:inline-block;font-size:11px;font-weight:600;border-radius:20px;padding:2px 8px;margin:0 4px 2px 0;border:1px solid var(--border);background:var(--surface2);color:var(--muted);white-space:nowrap}",
      ".hx-tag.bad{color:var(--bad);border-color:color-mix(in srgb,var(--bad) 40%,transparent);background:color-mix(in srgb,var(--bad) 9%,transparent)}",
      ".hx-tag.warn{color:var(--warn);border-color:color-mix(in srgb,var(--warn) 40%,transparent);background:color-mix(in srgb,var(--warn) 10%,transparent)}",
      ".hx-tag.good{color:var(--good);border-color:color-mix(in srgb,var(--good) 40%,transparent);background:color-mix(in srgb,var(--good) 9%,transparent)}",
      ".hx-tag.info{color:var(--info,var(--accent));border-color:color-mix(in srgb,var(--info,var(--accent)) 35%,transparent)}",
      ".hx-trong{padding:28px 18px;text-align:center;color:var(--muted)}",
      ".hx-nut{min-height:40px;border-radius:10px;border:1px solid var(--accent);background:var(--accent);color:var(--accent-text,#fff);font-weight:600;padding:0 14px;cursor:pointer}.hx-nut[disabled]{opacity:.55;cursor:not-allowed}",
      ".hx-nut.phu{background:var(--surface);color:var(--text);border-color:var(--border)}.hx-nut.phu:hover{border-color:var(--bad,#dc2626);color:var(--bad,#dc2626)}",
      ".hx-mt{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px;align-items:start;margin-top:4px}@media(max-width:560px){.hx-mt{grid-template-columns:minmax(0,1fr)}}",
      ".hx-mt .panel{margin:0}.hx-mt .panel-head{display:block}.hx-mt-cu .hx-mt-sk{opacity:.45}.hx-mt-dau{display:flex;align-items:center;gap:8px;flex-wrap:nowrap;width:100%}.hx-mt-dau b{font-size:15px;min-width:0;flex:0 1 auto;overflow-wrap:anywhere;line-height:20px}.hx-mt-dau .hx-tag{flex:none;margin:0}.hx-mt-dau .hx-nut{margin-left:auto;flex:none}",   // 14/10: tên máy dài từng đẩy nút xuống dòng 2
      ".hx-mt-sk{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;padding:12px 16px 4px}.hx-mt-sk .lbl{font-size:12px;color:var(--muted)}.hx-mt-sk .so{font-size:18px;font-weight:600;font-variant-numeric:tabular-nums}",
      ".hx-mt-thanh{height:6px;border-radius:3px;background:var(--surface2);overflow:hidden;margin-top:4px}.hx-mt-thanh i{display:block;height:100%;background:var(--good)}.hx-mt-thanh i.warn{background:var(--warn)}.hx-mt-thanh i.bad{background:var(--bad,#dc2626)}",
      ".hx-mt-phu{padding:2px 16px 8px;font-size:12px;color:var(--muted)}",
      /* 14/10 hàng thẻ máy gọn */
      /* 14/10 chiều user «đổi hiển thị từ ngang sang dọc… máy k chạy thì làm mờ… chip việc từ trái sang phải, kê bên phải chip máy trạm» */
      ".mt-dc{display:flex;flex-direction:column;gap:3px;padding:7px 10px;border-radius:8px;border:1px solid color-mix(in srgb,var(--good) 40%,transparent);background:color-mix(in srgb,var(--good) 7%,transparent)}.mt-dc-dau{display:flex;align-items:center;gap:7px;font-size:13px}.mt-dc-dau small{font-size:11px;color:var(--muted)}.mt-dc-bc{font-size:12px;overflow-wrap:anywhere}.mt-dc-bc a{color:var(--accent)}.mt-dc>small{font-size:11px;color:var(--muted)}.mt-dc-thanh{display:block;height:5px;border-radius:3px;background:var(--surface2);overflow:hidden}.mt-dc-thanh b{display:block;height:100%;background:var(--good);transition:width .4s}.mt-cham{flex:none;width:9px;height:9px;border-radius:50%;background:var(--good);animation:dfPulse 1.8s ease-out infinite}@media(prefers-reduced-motion:reduce){.mt-cham{animation:none}}.mt-chua{margin:4px 0 12px}.mt-hang{display:flex;flex-direction:column;gap:8px}",
      ".mt-o{display:grid;grid-template-columns:220px minmax(0,1fr);gap:14px;min-width:0;padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface);transition:opacity .2s}",
      ".mt-trai,.mt-phai{display:flex;flex-direction:column;gap:5px;min-width:0}.mt-phai{gap:6px}.mt-phai .ds{display:flex;flex-wrap:wrap;gap:4px;align-items:center}",
      ".mt-o.mo{background:var(--surface2)}.mt-o.mo .mt-dau,.mt-o.mo .mt-sk,.mt-o.mo .mt-phu,.mt-o.mo .mt-phai{opacity:.45}",   // máy dừng/mất nhịp: mờ — riêng nút «Cho chạy lại» vẫn sáng
      ".mt-dau{display:flex;align-items:flex-start;gap:6px;justify-content:space-between}.mt-dau b{font-size:13px;line-height:17px;min-width:0;overflow-wrap:anywhere}.mt-dau .hx-tag{flex:none;margin:0}",
      ".mt-sk{display:flex;flex-direction:column;gap:3px}.mt-sk .r{display:grid;grid-template-columns:30px minmax(0,1fr) auto;gap:6px;align-items:center;font-size:11px;color:var(--muted)}",
      ".mt-sk .r i{height:5px;border-radius:3px;background:var(--surface2);overflow:hidden}.mt-sk .r i b{display:block;height:100%;background:var(--good)}.mt-sk .r i b.warn{background:var(--warn)}.mt-sk .r i b.bad{background:var(--bad,#dc2626)}",
      ".mt-sk .r em{font-style:normal;font-weight:600;color:var(--text);font-variant-numeric:tabular-nums}",
      ".mt-phu{font-size:11px;color:var(--muted)}.mt-trong{font-size:12px;color:var(--muted)}",
      ".mt-viec{display:flex;flex-wrap:wrap;gap:4px}.mt-c{font:inherit;font-size:11px;line-height:16px;padding:2px 7px;border-radius:12px;border:1px solid var(--border);background:var(--surface2);color:var(--text);max-width:100%;overflow-wrap:anywhere;text-align:left;display:inline-flex;align-items:center}",
      ".mt-x{font:inherit;font-size:14px;line-height:16px;border:0;background:none;color:var(--muted);cursor:pointer;padding:0 0 0 5px;margin-right:-3px}.mt-x:hover{color:var(--bad,#dc2626)}.mt-x:focus-visible{outline:2px solid var(--accent);outline-offset:1px;border-radius:4px}",
      ".mt-c.chay{border-color:color-mix(in srgb,var(--good) 45%,transparent);background:color-mix(in srgb,var(--good) 12%,transparent)}.mt-c.cho{border-color:color-mix(in srgb,var(--info,var(--accent)) 40%,transparent);background:color-mix(in srgb,var(--info,var(--accent)) 9%,transparent)}",
      ".mt-c.dung{border-color:color-mix(in srgb,var(--warn) 50%,transparent);background:color-mix(in srgb,var(--warn) 12%,transparent);}.mt-c.dung .ten{text-decoration:line-through}",
      ".mt-nh{font-size:11px;font-weight:600;color:var(--muted);align-self:center;min-width:34px}.mt-nh.nang{color:var(--bad,#dc2626)}.hx-mt-ly .ds+.ds{margin-top:4px}",
      ".mt-nut{margin-top:auto}.mt-nut .hx-nut{width:100%;min-height:28px;font-size:12px;padding:0 8px;border-radius:6px}",
      ".mt-tom{font-size:11.5px;color:var(--muted);display:flex;align-items:center;gap:3px;flex-wrap:wrap}.mt-tom b{color:var(--text)}",
      ".mt-gan{order:2;flex-basis:100%;font-size:11px;color:var(--muted)}" +
      ".mt-tom i.d{display:inline-block;width:7px;height:7px;border-radius:50%;margin-left:2px}.mt-tom i.d.chay{background:var(--good)}.mt-tom i.d.dung{background:var(--warn)}.mt-tom i.d.cho{background:var(--info,var(--accent))}",
      "@media(max-width:560px){.mt-hang{gap:6px}.mt-o{grid-template-columns:minmax(0,1fr);gap:8px;padding:8px}.mt-sk .r{grid-template-columns:24px minmax(0,1fr) auto;gap:4px}.mt-c{min-height:40px}.mt-x{min-width:40px;min-height:40px;justify-content:center;display:inline-flex;align-items:center;padding:0;margin:-2px -7px -2px 0}.mt-nut .hx-nut{min-height:40px}}",
      ".hx-mt-xin{margin:4px 0 14px;border-color:color-mix(in srgb,var(--warn) 55%,var(--border))}.hx-mt-xin .ma{font-family:ui-monospace,Consolas,monospace;font-size:14px;letter-spacing:2px;color:var(--text)}",
      ".hx-mt-ly{padding:10px 16px;border-top:1px solid var(--border)}.hx-mt-ly .ly{font-size:13px;color:var(--muted);margin-bottom:6px}.hx-mt-ly .ds{display:flex;flex-wrap:wrap;gap:6px}.hx-mt-ly .hx-tag{margin:0;font-weight:600;font-size:12px;color:var(--text)}",
      ".hx-mt-v{display:flex;align-items:center;gap:8px;min-height:44px;padding:6px 16px;border-top:1px solid var(--border)}.hx-mt-v .ten{flex:1;min-width:0;font-size:13.5px}.hx-mt-v .ten small{display:block;color:var(--muted);font-size:12px}",
      ".hx-mt-v .hx-nut{min-height:34px;padding:0 12px;font-size:13px;background:var(--surface);color:var(--text);border-color:var(--border)}.hx-mt-v .hx-nut:hover{border-color:var(--accent);color:var(--accent)}",
      "@media(max-width:560px){.hx-mt-v .hx-nut,.hx-mt-dau .hx-nut,#mtDangXuat{min-height:44px}}",   // 14/10: bỏ xếp dọc panel-head (số «13» rơi xuống dòng riêng, phí chỗ)
      /* form đăng nhập — cùng khuôn .hx-dn của Xác minh */
      ".mt-dn{max-width:400px;margin:24px auto}.mt-dn form{display:flex;flex-direction:column;gap:12px;padding:16px}.mt-dn label{display:flex;flex-direction:column;gap:4px}.mt-dn input{min-height:44px;font-size:16px}",
      ".mt-st.loi{margin-top:4px;font-size:13px;padding:8px 12px;border-radius:10px;background:color-mix(in srgb,var(--bad) 10%,transparent);color:var(--bad)}"
    ].join("\n");
    var st = document.createElement("style"); st.id = "mt-css"; st.textContent = c; document.head.appendChild(st);
  }

  /* ---------- tải dữ liệu ---------- */
  function goi591(duong, opt) {
    opt = Object.assign({}, opt || {}); opt.headers = Object.assign({}, opt.headers || {}, { "x-hx-phien": phien() });
    var ctl = new AbortController(), h = setTimeout(function () { ctl.abort(); }, 45000);
    return fetch(API + duong, Object.assign({ signal: ctl.signal }, opt)).then(function (r) { clearTimeout(h);
      return r.text().then(function (t) { var j = {}; try { j = JSON.parse(t); } catch (e) {} if (!r.ok) { var er = new Error(j.loi || ("HTTP " + r.status)); er.ma = r.status; throw er; } return j; }); });
  }
  // 13/10 tối user: «buộc phải có mật khẩu mới xem được». Máy không có 8591 (điện thoại) đăng nhập qua GAS bằng CÙNG mật khẩu Xác minh
  // (bang-591 đồng bộ băm lên GAS mỗi lần đăng nhập Xác minh) → phiên 12 giờ lưu ở localStorage «mt-phien».
  function mtPhien() { try { var o = JSON.parse(localStorage.getItem("mt-phien") || "null"); return o && o.ph && o.het > Date.now() ? o : null; } catch (e) { return null; } }
  function postGas(body) {   // POST text/plain (không preflight) — cùng khuôn hasaki-pc.js; GAS lỗi trả HTML → kiểm '{' (bộ chuẩn mục 3)
    var ctl = new AbortController(), h = setTimeout(function () { ctl.abort(); }, 45000);
    return fetch(GAS, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body), signal: ctl.signal })
      .then(function (r) { return r.text(); }).then(function (t) { clearTimeout(h); if (t.trim()[0] !== "{") throw new Error("Apps Script trả lỗi — thử lại"); return JSON.parse(t); })
      .catch(function (e) { clearTimeout(h); throw e.name === "AbortError" ? new Error("Apps Script không trả lời sau 45 giây") : e; });
  }
  // dữ liệu GAS (thô) → cùng hình với /api/may-tram: may[{…, song, tuoiGiay, viecGiao}], viec[{ten, may}], chuyen
  function chuanGas(j) {
    var now = j.srvNow || Date.now(), tatCa = [];
    var may = (j.may || []).map(function (m) { var tg = Math.round((now - Date.parse(m.luc)) / 1000); (m.tatCaViec || []).forEach(function (t) { if (tatCa.indexOf(t) < 0) tatCa.push(t); });
      return Object.assign({}, m, { tuoiGiay: tg, song: tg <= HET_HAN_GIAY, coKhoa: m.coCamera ? ["TOPREVIEW_USER"] : [] }); });
    may.sort(function (a, b) { return (b.song - a.song) || (b.diem || 0) - (a.diem || 0); });
    var chu = {}; may.forEach(function (m) { if (m.song && !m.dung) (m.viecGiao || []).forEach(function (t) { if (!(m.dungViec || []).includes(t)) chu[t] = m.may; }); });
    return { srvNow: now, may: may, viec: tatCa.map(function (t) { return { ten: t, may: chu[t] || null, canKhoa: [] }; }), chuyen: j.chuyen || [] };
  }
  // Máy quản lý? Thanh bên dò 8591 bất đồng bộ (~1,5 s) — mở thẳng ?tab=maytram thì module chạy TRƯỚC ⇒ tự dò, đừng chờ.
  var MAY_CHU = false, CAN_DN = false;
  function dongMayChu() {
    if (window.__HX_MAY_CHU) return Promise.resolve(true);
    var ctl = new AbortController(), h = setTimeout(function () { ctl.abort(); }, 1500);
    return fetch(API + "/api/ping", { signal: ctl.signal }).then(function (r) { clearTimeout(h); return r.ok; }).catch(function () { return false; });
  }
  function tai() {
    return dongMayChu().then(function (co) {
      MAY_CHU = co;
      // 14/10: trang có HỆ TÀI KHOẢN → bắt buộc đăng nhập ở đó (phiên Xác minh cũ hx-phien còn sót trên laptop KHÔNG đủ)
      if (window.TK && !phienTk()) { CAN_DN = true; DIEU_KHIEN = false; return null; }
      if (co) {   // máy quản lý: cần phiên Xác minh (8591) — đầy đủ + nút điều khiển
        if (!phien()) { CAN_DN = true; return null; }
        return goi591("/api/may-tram").then(function (j) { DIEU_KHIEN = true; CAN_DN = false; return j; })
          .catch(function (e) { if (e.ma === 401) { try { localStorage.removeItem("hx-phien"); } catch (x) {} CAN_DN = true; return null; } throw e; });
      }
      /* 14/10 trưa: dùng phiên HỆ TÀI KHOẢN MỚI (tai-khoan.js, nút «Đăng nhập» thanh bên) nếu có quyền Xác minh — 1 lần đăng nhập */
      var tkPh = phienTk(), mp = mtPhien(), ph = tkPh || (mp && mp.ph);
      if (!ph) { CAN_DN = true; return null; }
      return postGas({ action: "pcBangPh", ph: ph }).then(function (j) {
        if (j.status !== "success") { if (j.code === 401) { if (!tkPh) try { localStorage.removeItem("mt-phien"); } catch (x) {} CAN_DN = true; return null; } throw new Error(j.message || "Apps Script trả lỗi"); }
        DIEU_KHIEN = false; CAN_DN = false; return chuanGas(j); });
    }).then(function (d) { MTD = d; MT_LOI = "";
      if (d && window.tqGhi) tqGhi("mt", { song: d.may.filter(function (m) { return m.song && !m.dung; }).length, tong: d.may.length });
      if (d && typeof window.soThanhBen === "function") window.soThanhBen(); })   // 14/10: thanh bên từng giữ số cũ (0/1 khi đã có 2 máy)
      .catch(function (e) { MT_LOI = e.name === "AbortError" ? "Máy chủ không trả lời sau 45 giây" : e.message; });
  }
  function phienTk() { var T = window.TK; return T && T.nguoi && T.phien && (typeof window.tkCo !== "function" || window.tkCo("r.xacminh")) ? T.phien : ""; }
  function veDangNhap(thongBao) {
    if (typeof window.tkMoDangNhap === "function") {   // có hệ tài khoản chung → dùng ĐÚNG ô đăng nhập của nó, không ô riêng
      PANE.innerHTML = '<div class="panel mt-dn"><div class="panel-head"><span>Đăng nhập để xem Máy trạm</span></div><div style="padding:16px;display:flex;flex-direction:column;gap:12px">' +
        (window.TK && window.TK.nguoi ? '<div class="mt-st loi">Tài khoản «' + e_(window.TK.nguoi.ten || window.TK.nguoi.id) + '» chưa có quyền Xác minh.</div>' : "") +
        '<button type="button" class="hx-nut" id="mtMoTk">Đăng nhập</button></div></div>';
      document.getElementById("mtMoTk").onclick = function () { window.tkMoDangNhap(); };
      return;
    }
    var em = ""; try { em = localStorage.getItem("hx-email") || ""; } catch (e) {}
    PANE.innerHTML = '<div class="panel mt-dn"><div class="panel-head"><span>Đăng nhập để xem Máy trạm</span></div>' +
      '<form id="mtDnForm" autocomplete="on"><label><span class="lbl">Email</span><input id="mtDnEm" type="email" autocomplete="username" required value="' + e_(em) + '"></label>' +
      '<label><span class="lbl">Mật khẩu</span><input id="mtDnMk" type="password" autocomplete="current-password" required></label>' +
      '<button type="submit" class="hx-nut" id="mtDnNut">Đăng nhập</button><div id="mtDnSt"' + (thongBao ? ' class="mt-st loi">' + e_(thongBao) : ">") + "</div></form></div>";
    var f = document.getElementById("mtDnForm");
    f.onsubmit = function (ev) {
      ev.preventDefault(); var nut = document.getElementById("mtDnNut"), st = document.getElementById("mtDnSt");
      var email = document.getElementById("mtDnEm").value.trim(), mk = document.getElementById("mtDnMk").value;
      nut.disabled = true; st.className = ""; st.textContent = "Đang kiểm tra…";
      var p = MAY_CHU
        ? goi591("/api/dang-nhap", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: email, matKhau: mk }) })
            .then(function (j) { if (!j.phien) throw new Error(j.loi || "Đăng nhập lỗi"); try { localStorage.setItem("hx-phien", j.phien); } catch (e) {} try { window.dispatchEvent(new CustomEvent("hx-phien")); } catch (e) {} })
        : postGas({ action: "pcDangNhap", email: email, mk: mk })
            .then(function (j) { if (j.status !== "success") throw new Error(j.message || "Đăng nhập lỗi"); try { localStorage.setItem("mt-phien", JSON.stringify({ ph: j.ph, het: j.het, email: j.email })); } catch (e) {} });
      p.then(function () { try { localStorage.setItem("hx-email", email); } catch (e) {} PANE.innerHTML = ""; return tai().then(ve); })
        .catch(function (e) { st.className = "mt-st loi"; st.textContent = e.message; var m = document.getElementById("mtDnMk"); if (m) m.select(); })
        .finally(function () { if (document.body.contains(nut)) nut.disabled = false; });
    };
    (em ? document.getElementById("mtDnMk") : document.getElementById("mtDnEm")).focus();
  }

  /* ---------- vẽ ---------- */
  function tuoiChu(s) { if (s == null || isNaN(s)) return "—"; if (s < 60) return s + " giây trước"; if (s < 3600) return Math.round(s / 60) + " phút trước"; if (s < 86400) return Math.round(s / 3600) + " giờ trước"; return Math.round(s / 86400) + " ngày trước"; }
  function ve() {
    if (!PANE) return;
    if (CAN_DN) { if (!document.getElementById("mtDnForm")) veDangNhap(); return; }   // đang gõ thì không vẽ đè form
    if (!MTD) { PANE.innerHTML = '<div class="panel" style="margin-top:4px"><div class="hx-trong">Chưa đọc được bảng máy trạm: ' + e_(MT_LOI || "không rõ lỗi") + " — tự thử lại sau 30 giây.</div></div>"; return; }
    var dangChuyen = {}; (MTD.chuyen || []).forEach(function (c) { dangChuyen[c.viec] = c; });
    var mayCua = {}; (MTD.viec || []).forEach(function (v) { mayCua[v.ten] = v.may; });
    var mucDo = function (pct, vang, doo) { return pct >= doo ? "bad" : pct >= vang ? "warn" : ""; };
    /* 14/10 user: «Việc chưa có máy nhận đưa lên trên cùng; các máy trạm bên dưới, từ trái qua phải NGANG HÀNG, làm chip gọn để có bao nhiêu
       máy cũng vừa ngang màn hình» ⇒ 1 hàng N cột đều nhau (grid repeat(N)); thẻ gọn: tên · trạng thái · RAM/CPU/ổ C 3 dòng nhỏ · nhịp tim ·
       việc = CHIP màu (bấm chip = dừng/tiếp tục việc đó, hỏi lại trước khi gửi). */
    var dong = function (lbl, so, pct, lop) { return '<div class="r"><span>' + lbl + '</span><i><b class="' + lop + '" style="width:' + Math.max(0, Math.min(100, pct)) + '%"></b></i><em>' + so + "</em></div>"; };
    var nangCua = {}; (MTD.viec || []).forEach(function (v) { if (v.nang != null) nangCua[v.ten] = !!v.nang; });
    MTD.may.forEach(function (m) { (m.viecNang || []).forEach(function (t) { nangCua[t] = true; }); (m.tatCaViec || []).forEach(function (t) { if (!(t in nangCua)) nangCua[t] = false; }); });
    /* 14/10 «thêm nhãn nặng nhẹ»: chia việc thành hàng «Nặng:» / «Nhẹ:» — nhãn ghi 1 LẦN mỗi hàng, không gắn vào từng việc (luật không lặp) */
    var chiaNang = function (ds, ve1) { var n = ds.filter(function (t) { return nangCua[t] === true; }), h = ds.filter(function (t) { return nangCua[t] === false; }), k = ds.filter(function (t) { return !(t in nangCua); });
      return [[n, "Nặng", " nang"], [h, "Nhẹ", ""], [k, "", ""]].filter(function (x) { return x[0].length; })
        .map(function (x) { return '<div class="ds">' + (x[1] ? '<span class="mt-nh' + x[2] + '">' + x[1] + ":</span>" : "") + x[0].map(ve1).join("") + "</div>"; }).join(""); };
    var coMayKhac = function (m) { return MTD.may.some(function (x) { return x.may !== m.may && x.song && !x.dung; }); };
    var tenBoi = function (b) { return /^bo cai/.test(b) ? "bộ cài (máy quản lý)" : b; };   // nhãn ASCII do bộ cài gửi → tiếng Việt
    var tomTat = function (m, viec) {
      var chay = viec.filter(function (t) { return (m.dangChay || []).indexOf(t) >= 0; }).length, dung = viec.filter(function (t) { return (m.dungViec || []).indexOf(t) >= 0; }).length;
      /* 14/10 user «13 chờ chứ chưa chạy» + «không thấy phân loại nặng nhẹ»: tóm tắt ghi số nặng/nhẹ + giờ chạy gần nhất (chayLuc do cổng gác PC ghi) */
      var nNang = viec.filter(function (t) { return nangCua[t] === true; }).length, nNhe = viec.length - nNang;
      var gan = 0; viec.forEach(function (t) { var x = Date.parse((m.chayLuc || {})[t] || ""); if (x > gan) gan = x; });
      return "<b>" + viec.length + " việc</b>" + (chay ? ' · <i class="d chay"></i>' + chay + " chạy" : "") + (dung ? ' · <i class="d dung"></i>' + dung + " dừng" : "") + (viec.length - chay - dung ? ' · <i class="d cho"></i>' + (viec.length - chay - dung) + " chờ" : "") +
        '<span class="mt-gan">' + [nNang ? nNang + " nặng" : "", nNhe ? nNhe + " nhẹ" : "", gan ? "chạy gần nhất " + gioPhut(gan) : m.chayLuc ? "chưa chạy việc nào" : ""].filter(Boolean).join(" · ") + "</span>";
    };
    var gioPhut = function (ms) { var d = new Date(ms); return (d.getHours() < 10 ? "0" : "") + d.getHours() + ":" + (d.getMinutes() < 10 ? "0" : "") + d.getMinutes() + (Date.now() - ms > 864e5 ? " " + d.getDate() + "/" + (d.getMonth() + 1) : ""); };
    /* 14/10 chiều user «thêm trạng thái đang chạy việc gì, chạy ra sao, của task nào vào từng máy pc trạm»: mỗi việc đang chạy của MÁY NÀY —
       tên việc · bước đang làm · phiếu đang soát (link work) · thanh i/n · từ mấy giờ, bao lâu · cập nhật cách đây. Tiến độ do tien-do.mjs
       (cò gửi GAS pcPhu ≥15 s/lần); PC bản cũ / cò chưa gắn tiến độ → chỉ tên việc + giờ bắt đầu. */
    var dangChayMay = function (m) {
      if (!m.song || !(m.dangChay || []).length) return "";
      return (m.dangChay || []).map(function (t) {
        var td = (m.tienDo || {})[t] || null, bd = Date.parse((m.batDau || {})[t] || (m.chayLuc || {})[t] || ""), pct = td && td.n ? Math.min(100, Math.round(td.i / td.n * 100)) : -1;
        var dong2 = td ? e_(td.buoc || "Đang chạy") + (td.task ? ' · phiếu <a href="https://work.hasaki.vn/tasks?task_id=' + encodeURIComponent(td.task) + '" target="_blank" rel="noopener">' + e_(td.task) + "</a>" : "") +
            (td.n ? " (" + td.i + "/" + td.n + ")" : "") + (td.chiTiet ? " · " + e_(td.chiTiet) : "") : "Đang chạy";
        var cn = td && td.luc ? Math.max(0, Math.round((Date.now() - Date.parse(td.luc)) / 1000)) : null;
        return '<div class="mt-dc"><div class="mt-dc-dau"><i class="mt-cham"></i><b>' + e_(tenV(t)) + "</b>" + (m.dung && m.duPhong ? "<small>làm thay</small>" : "") + "</div>" +
          '<div class="mt-dc-bc">' + dong2 + "</div>" + (pct >= 0 ? '<i class="mt-dc-thanh"><b style="width:' + pct + '%"></b></i>' : "") +
          "<small>" + (bd ? "từ " + gioPhut(bd) + " · " + lau(bd) : "") + (cn != null ? (bd ? " · " : "") + "cập nhật " + tuoiChu(cn) : "") + "</small></div>";
      }).join("");
    };
    var the = function (m) {
      /* 14/10 laptop = MÁY DỰ PHÒNG (bị «Dừng» trong điều phối nhưng vẫn chạy cò gốc khi PC chưa nhận — GAS PCPHU gộp vào dangChay/duPhong) */
      var lamThay = m.dung && m.duPhong && (m.dangChay || []).length > 0;
      var tt = !m.song ? ["Mất nhịp", "bad"] : m.dung ? (m.duPhong ? ["Dự phòng", "info"] : ["Đã dừng", "warn"]) : m.yeu ? ["Yếu", "warn"] : ["Đang chạy", "good"];
      var ramDung = Math.round(100 - (m.ramTrongPct || 0)), cpu = Math.round(m.cpuPct || 0), dia = m.diaTrongGB;
      var chiLap = m.duPhong ? (MTD.viec || []).filter(function (v) { return v.chiLaptop; }).map(function (v) { return v.ten; }) : [];   // laptop: việc chỉ chạy được ở đây
      var viec = []; (m.viecGiao || []).concat(chiLap, m.dangChay || [], m.dungViec || []).forEach(function (t) { if (viec.indexOf(t) < 0) viec.push(t); });
      var veChip = function (t) {
        var dung = (m.dungViec || []).indexOf(t) >= 0, chay = (m.dangChay || []).indexOf(t) >= 0, sang = mayCua[t];
        var lop = dung ? "dung" : chay ? "chay" : (m.viecGiao || []).indexOf(t) >= 0 || chiLap.indexOf(t) >= 0 ? "cho" : "do";
        var nghia = dung ? "Đã dừng ở máy này" + (sang && sang !== m.may ? " → " + sang + " làm thay" : "") : chay ? "Đang chạy" : lop === "cho" ? "Được giao · chờ tới giờ" + ((m.chayLuc || {})[t] ? " · chạy gần nhất " + gioPhut(Date.parse(m.chayLuc[t])) : " · chưa chạy lần nào trên máy này") : "Đang chạy dở (đã giao máy khác)";
        /* 14/10 «chip việc có dấu x bên phải — máy nặng quá thì tắt, bộ điều phối chuyển việc sang máy khác»; việc đã tắt → ↺ bật lại */
        var x = DIEU_KHIEN && !m.dung ? '<button class="mt-x" data-may="' + e_(m.may) + '" data-viec="' + e_(t) + '" data-dung="' + (dung ? "0" : "1") + '" title="' + e_(dung ? "Bật lại việc này trên máy này" : "Tắt việc này trên máy này — chuyển sang máy khác") + '" aria-label="' + e_((dung ? "Bật lại " : "Tắt ") + tenV(t)) + '">' + (dung ? "↺" : "×") + "</button>" : "";
        return '<span class="mt-c ' + lop + '" title="' + e_(nghia) + '"><span class="ten">' + e_(tenV(t)) + "</span>" + x + "</span>";
      };
      var chip = (viec.length ? chiaNang(viec, veChip) : "") || '<div class="mt-trong">' + (m.dung ? (m.duPhong ? "Dự phòng — chỉ làm thay khi PC chưa nhận việc." : coMayKhac(m) ? "Đang dừng — việc do máy khác làm." : "Đang dừng — không nhận việc.")
        : m.song ? "Chưa được giao việc." : (coMayKhac(m) ? "Mất nhịp — việc đã sang máy khác." : "Mất nhịp.")) + "</div>";
      var nutMay = !DIEU_KHIEN ? "" : !m.song && !m.dung ? '<button class="hx-nut phu" data-may="' + e_(m.may) + '" data-xoa="1">Gỡ</button>'   // máy im: chỉ còn gỡ
        : '<button class="hx-nut' + (m.dung ? "" : " phu") + '" data-may="' + e_(m.may) + '" data-dung="' + (m.dung ? "0" : "1") + '">' + (m.dung ? "Cho chạy lại" : "Dừng máy") + "</button>";
      return '<div class="mt-o' + (m.song ? "" : " cu") + (!m.song || (m.dung && !lamThay) ? " mo" : "") + '"><div class="mt-trai"><div class="mt-dau"><b title="' + e_(m.may) + '">' + e_(m.may) + '</b><span class="hx-tag ' + tt[1] + '">' + tt[0] + "</span></div>" +
        '<div class="mt-sk">' + dong("RAM", ramDung + "%", ramDung, mucDo(ramDung, 70, 85)) + dong("CPU", cpu + "%", cpu, mucDo(cpu, 70, 90)) +
        /* 14/10 user «ổ C ít quá, cần liệt kê thêm ổ mà máy trạm có»: mỗi ổ 1 dòng — thanh = phần ĐÃ DÙNG, số = còn trống. PC bản cũ (chưa gửi oDia) → ổ C như trước */
        ((m.oDia && m.oDia.length) ? m.oDia.map(function (x) { var dung = x.tong ? Math.round((x.tong - x.trong) / x.tong * 100) : 0;
            return '<div class="r" title="' + e_("Ổ " + x.o + ": còn " + x.trong + " / " + x.tong + " GB") + '"><span>' + e_(x.o) + ':</span><i><b class="' + (x.trong < 3 || dung >= 95 ? "bad" : x.trong < 10 || dung >= 85 ? "warn" : "") + '" style="width:' + dung + '%"></b></i><em>' + Math.round(x.trong) + " GB</em></div>"; }).join("")
          : dong("Ổ C", dia == null ? "—" : Math.round(dia) + " GB", dia == null ? 0 : Math.min(100, dia / 0.5), dia == null ? "" : dia < 3 ? "bad" : dia < 10 ? "warn" : "")) + "</div>" +
        '<div class="mt-phu" title="' + e_((m.nhan || "?") + " nhân · " + (m.ramTongGB || "?") + " GB RAM · điểm xếp hạng " + (m.diem || 0) + (m.ban ? " · bản " + m.ban : "") + (m.dung && m.lenhBoi ? " · dừng bởi " + tenBoi(m.lenhBoi) : "")) + '">' +
          e_(tuoiChu(m.tuoiGiay)) + ((m.coKhoa || []).indexOf("TOPREVIEW_USER") < 0 ? " · không khoá camera" : "") + "</div>" +
        (nutMay ? '<div class="mt-nut">' + nutMay + "</div>" : "") + "</div>" +
        '<div class="mt-phai">' + dangChayMay(m) + (viec.length ? '<div class="mt-tom">' + tomTat(m, viec) + "</div>" : "") + chip + "</div></div>";
    };
    var chuaCo = (MTD.viec || []).filter(function (v) { return !v.may && !v.chiLaptop; });   // 14/10: việc ghim laptop (cần dữ liệu .exports) không phải «chưa có máy»
    /* 14/10: PC cài bằng bộ cài không khoá xin khoá + MÃ XÁC NHẬN trên màn PC — chỉ máy quản lý duyệt (so mã trước khi bấm). */
    var xin = (MTD.xin || []).filter(function (x) { return !x.daDuyet; });
    var h = DIEU_KHIEN && xin.length ? '<div class="panel hx-mt-xin"><div class="panel-head"><span>PC xin khoá</span><span>' + xin.length + "</span></div>" +
      xin.map(function (x) { return '<div class="hx-mt-v"><div class="ten"><b>' + e_(x.may) + "</b><small>Mã xác nhận <b class=\"ma\">" + e_(x.maXN) + "</b> · xin " + e_(tuoiChu(Math.round((Date.now() - x.luc) / 1000))) + " · so với mã trên màn hình PC</small></div>" +
        '<button class="hx-nut phu" data-xin="' + e_(x.may) + '" data-dongy="0">Từ chối</button><button class="hx-nut" data-xin="' + e_(x.may) + '" data-dongy="1">Duyệt</button></div>'; }).join("") + "</div>" : "";
    /* 14/10 chiều user «khối Đang chạy … vào từng máy pc trạm»: khối chung trên cùng đã bỏ — mỗi thẻ máy tự hiện việc đang chạy (the() → dangChayMay) */
    var lau = function (bd) { var p = Math.max(0, Math.round((Date.now() - bd) / 60000)); return p < 1 ? "vừa bắt đầu" : p < 60 ? p + " phút" : Math.floor(p / 60) + " giờ " + (p % 60) + " phút"; };
    /* gom theo lý do (luật không lặp thông tin) — LÊN TRÊN CÙNG (14/10) */
    if (chuaCo.length) {
      var conMay = MTD.may.some(function (m) { return m.song && !m.dung; }), nhom = [], theo = {};
      chuaCo.forEach(function (v) { var c = dangChuyen[v.ten], k = (v.canKhoa || []);
        var ly = c ? "Bị dừng giữa chừng ở " + c.tu + " — chờ máy khác chạy bù" : !conMay ? "Chưa có PC nào đang chạy"
          : k.indexOf("TOPREVIEW_USER") >= 0 ? "Cần PC có khoá camera" + (k.indexOf("GEMINI_API_KEY") >= 0 ? " và khoá AI" : "") : "Cần PC đang chạy";
        if (!theo[ly]) { theo[ly] = []; nhom.push(ly); } theo[ly].push(v.ten); });
      h += '<div class="panel mt-chua"><div class="panel-head"><span>Việc chưa có máy nhận</span><span>' + chuaCo.length + "</span></div>" +
        nhom.map(function (ly) { return '<div class="hx-mt-ly"><div class="ly">' + e_(ly) + "</div>" + chiaNang(theo[ly], function (t) { return '<span class="hx-tag">' + e_(tenV(t)) + "</span>"; }) + "</div>"; }).join("") + "</div>";
    }
    h += MTD.may.length ? '<div class="mt-hang">' + MTD.may.map(the).join("") + "</div>"
      : '<div class="panel"><div class="hx-trong">Chưa PC nào gửi nhịp tim. Cài bằng nút «Tải bộ cài PC» ở trang Tổng quan; PC gửi nhịp mỗi phút.</div></div>';    if (!MAY_CHU && !phienTk() && mtPhien()) h += '<div style="text-align:center;margin:14px 0"><button type="button" class="hx-nut phu" id="mtDangXuat">Đăng xuất</button></div>';
    PANE.innerHTML = h;
    var dx = document.getElementById("mtDangXuat");
    if (dx) dx.onclick = function () { var mp = mtPhien(); try { localStorage.removeItem("mt-phien"); } catch (e) {} MTD = null; CAN_DN = true;
      if (mp) postGas({ action: "pcDangXuat", ph: mp.ph }).catch(function () {}); veDangNhap(); };
    if (!DIEU_KHIEN) return;
    PANE.querySelectorAll("button[data-xin]").forEach(function (n) {
      n.onclick = function () {
        var dongY = n.dataset.dongy === "1", cu = n.textContent; n.disabled = true; n.textContent = "Đang gửi…";
        goi591("/api/may-tram/duyet-khoa", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ may: n.dataset.xin, dongY: dongY }) })
          .then(function () { if (typeof toast === "function") toast(dongY ? "Đã duyệt — " + n.dataset.xin + " tự nhận khoá trong ~10 giây rồi cài tiếp" : "Đã từ chối " + n.dataset.xin, "ok"); return tai().then(ve); })
          .catch(function (e) { if (typeof toast === "function") toast("Không gửi được: " + e.message, "loi"); })
          .finally(function () { if (document.body.contains(n)) { n.disabled = false; n.textContent = cu; } });
      };
    });
    PANE.querySelectorAll("button[data-may]").forEach(function (n) {
      n.onclick = function () {
        var dung = n.dataset.dung === "1", xoa = n.dataset.xoa === "1", viec = n.dataset.viec || "", cu = n.textContent;
        if (dung && !window.confirm((viec ? "Tắt «" + tenV(viec) + "» trên " : "Dừng cả máy ") + n.dataset.may + "?" + (viec ? " Bộ điều phối sẽ chuyển việc này sang máy khác." : " Mọi việc của máy này sẽ chuyển sang máy khác."))) return;
        n.disabled = true; n.textContent = n.classList.contains("mt-x") ? "…" : "Đang gửi…";
        goi591("/api/may-tram/lenh", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ may: n.dataset.may, viec: viec, dung: dung, xoa: xoa }) })
          .then(function (j) {
            if (typeof toast === "function") toast(xoa ? "Đã gỡ " + n.dataset.may + " khỏi danh sách" : (dung ? (viec ? "Đã tắt " : "Đã dừng ") : (viec ? "Đã bật lại " : "Đã cho chạy lại ")) + (viec ? tenV(viec) + " trên " : "") + n.dataset.may + (j.daChuyen && j.daChuyen.length ? " — đang chuyển " + j.daChuyen.map(tenV).join(", ") + " sang máy khác" : ""), "ok");
            return tai().then(ve);
          })
          .catch(function (e) { if (typeof toast === "function") toast("Không gửi được lệnh: " + e.message, "loi"); })
          .finally(function () { if (document.body.contains(n)) { n.disabled = false; n.textContent = cu; } });
      };
    });
  }

  function init(pane) {
    PANE = pane; napCss();
    if (!MTD || CAN_DN) pane.innerHTML = '<div class="hx-mt">' + '<div class="panel"><div style="padding:18px 16px"><div class="sk sk-line" style="width:60%"></div><div class="sk sk-line" style="width:86%"></div><div class="sk sk-line" style="width:70%"></div></div></div>'.repeat(2) + "</div>";
    else ve();
    tai().then(ve);
    clearInterval(H);
    H = setInterval(function () { if (!PANE || PANE.classList.contains("hidden")) { clearInterval(H); return; } if (!document.hidden) tai().then(ve); }, 30e3);
  }
  document.addEventListener("tk-doi", function () { MTD = null; CAN_DN = false; if (PANE && !PANE.classList.contains("hidden")) { PANE.innerHTML = ""; tai().then(ve); } });   // đăng nhập / đăng xuất hệ tài khoản
  window.addEventListener("hx-phien", function () {   // đăng xuất Xác minh trên máy quản lý → khoá lại ngay
    if (MAY_CHU && !phien()) { MTD = null; CAN_DN = true; DIEU_KHIEN = false; if (PANE && !PANE.classList.contains("hidden")) ve(); }
  });
  window.HMAYTRAM = { init: init, coDuLieu: function () { return !!MTD; } };
})();
