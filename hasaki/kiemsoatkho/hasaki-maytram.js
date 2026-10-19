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
  var MT_MO = {};   // 17/10 điện thoại: máy nào đang xổ «Việc đảm nhận» (giữ qua lượt vẽ lại 30 s)
  "use strict";
  var API = window.HX_API || "http://127.0.0.1:8591";   // 19/10: dongMayChu cập nhật theo hxDoMayChu (laptop hoặc đường hầm)
  var GAS = "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
  var HET_HAN_GIAY = 180;   // = hetHanPhut 3' của cai-pc/dieu-phoi.json: nhịp cũ hơn ⇒ máy coi như im
  var PANE = null, MTD = null, MT_LOI = "", DIEU_KHIEN = false, H = null;
  var TEN_VIEC = { "canh-b11": "Cò canh B1.1", "canh-xac-minh-b1": "Cò xác minh B1", "tim-bang-chung-b1": "Tìm bằng chứng B1",
    "canh-bai-xe-sang": "Canh bãi xe sáng", "canh-bai-xe-chieu": "Canh bãi xe chiều", "canh-bai-xe-toi": "Canh bãi xe tối", "xac-minh-camera": "Soi camera B1 (phần 1)", "xac-minh-camera-2": "Soi camera B1 (phần 2)",
    "co-canh-planogram": "Cò canh planogram", "dong-bo-dashboard": "Đồng bộ dashboard", "packer-a8-sang": "Packer A8 sáng", "packer-a8-chieu": "Packer A8 chiều",
    "cham-cong": "Chấm công", "watchdog-ton-kho": "Canh tồn kho", "lam-tuoi-vesinh": "Làm tươi vệ sinh 15'" };   // 19/10 nhịp sync-poller sang PC
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
      ".mt-dg{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 8px;font-size:12px;padding:5px 8px;border-radius:6px;border:1px solid var(--border)}.mt-dg b{font-weight:600}.mt-dg small{font-size:11px;color:var(--muted)}" +
      ".mt-dg.tot{border-color:color-mix(in srgb,var(--good) 45%,transparent);background:color-mix(in srgb,var(--good) 8%,transparent)}.mt-dg.tot b{color:var(--good)}" +
      ".mt-dg.chu-y{border-color:color-mix(in srgb,var(--warn) 50%,transparent);background:color-mix(in srgb,var(--warn) 9%,transparent)}.mt-dg.chu-y b{color:var(--warn)}" +
      ".mt-dg.kem{border-color:color-mix(in srgb,var(--bad,#dc2626) 45%,transparent);background:color-mix(in srgb,var(--bad,#dc2626) 8%,transparent)}.mt-dg.kem b{color:var(--bad,#dc2626)}" +
      ".mt-hn{font-size:12.5px;padding:6px 10px;border-radius:8px;background:color-mix(in srgb,var(--good) 8%,transparent);color:var(--text)}.mt-hn b{font-weight:600}.mt-hn.trong{background:var(--surface2);color:var(--muted)}" +
      ".mt-dc{display:flex;flex-direction:column;gap:3px;padding:7px 10px;border-radius:8px;border:1px solid color-mix(in srgb,var(--good) 40%,transparent);background:color-mix(in srgb,var(--good) 7%,transparent)}.mt-dc-dau{display:flex;align-items:center;gap:7px;font-size:13px}.mt-dc-dau small{font-size:11px;color:var(--muted)}.mt-dc-bc{font-size:12px;overflow-wrap:anywhere}.mt-dc-bc a{color:var(--accent)}.mt-dc>small{font-size:11px;color:var(--muted)}.mt-dc-thanh{display:block;height:5px;border-radius:3px;background:var(--surface2);overflow:hidden}.mt-dc-thanh b{display:block;height:100%;background:var(--good);transition:width .4s}.mt-cham{flex:none;width:9px;height:9px;border-radius:50%;background:var(--good);animation:dfPulse 1.8s ease-out infinite}@media(prefers-reduced-motion:reduce){.mt-cham{animation:none}}.mt-chua{margin:4px 0 12px}.mt-hang{display:flex;flex-direction:column;gap:8px}",
      ".mt-o{display:grid;grid-template-columns:minmax(300px,1.25fr) minmax(0,1.4fr) minmax(0,1fr);gap:0;min-width:0;padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface);transition:opacity .2s}",
      /* 15/10 user «chia ra 3 mục ngang hàng: Thông tin máy, sức khoẻ / Việc đảm nhận / Việc đang làm và kết quả — canh cho đồng đều»:
         mọi hàng máy + hàng tiêu đề dùng CÙNG khuôn cột → 3 mục thẳng cột từ trên xuống; vạch ngăn giữa các mục */
      ".mt-o>div{padding:0 14px}.mt-o>div:first-child{padding-left:0}.mt-o>div:last-child{padding-right:0}.mt-o>div+div{border-left:1px solid var(--border)}" +
        ".mt-tde{display:grid;grid-template-columns:minmax(300px,1.25fr) minmax(0,1.4fr) minmax(0,1fr);padding:0 13px;font-size:11.5px;font-weight:600;color:var(--muted)}.mt-tde>span{padding:0 14px;border-left:1px solid transparent}.mt-tde>span:first-child{padding-left:0;border-left:0}" +
        ".mt-ct{display:none;font-size:11px;font-weight:600;color:var(--muted)}",
      ".mt-trai,.mt-phai,.mt-ket{display:flex;flex-direction:column;gap:5px;min-width:0}.mt-phai,.mt-ket{gap:6px}.mt-phai .ds{display:flex;flex-wrap:wrap;gap:4px;align-items:center}",
      /* cột Việc đảm nhận: Nặng trên, Nhẹ dưới, nhãn cùng 1 cột trái → chip 2 nhóm thẳng lề */
      ".mt-o .mt-nn{flex-direction:column;gap:6px}.mt-o .mt-nhom{flex:none;width:100%}.mt-o .mt-nh{min-width:38px}" +
        ".mt-c .sang{font-size:11px;font-weight:500;color:var(--muted);white-space:nowrap}.mt-c .sang.chua{color:var(--warn)}",
      ".mt-o.mo{background:var(--surface2)}.mt-o.mo .mt-dau,.mt-o.mo .mt-sk,.mt-o.mo .mt-phu,.mt-o.mo .mt-phai,.mt-o.mo .mt-ket{opacity:.45}",   // máy dừng/mất nhịp: mờ — riêng nút «Cho chạy lại» vẫn sáng
      ".mt-dau{display:flex;align-items:flex-start;gap:4px 6px;justify-content:space-between;flex-wrap:wrap}.mt-dau b{font-size:13px;line-height:17px;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}.mt-dau .hx-tag{flex:none;margin:0}",
      ".mt-sk{display:grid;grid-template-columns:repeat(auto-fill,minmax(62px,1fr));gap:4px 10px}.mt-sk .r{display:grid;grid-template-columns:auto minmax(0,1fr);grid-template-areas:'l s' 'b b';gap:2px 4px;align-items:baseline;font-size:11px;color:var(--muted)}.mt-sk .r>span{grid-area:l}.mt-sk .r>em{grid-area:s;text-align:right}.mt-sk .r>i{grid-area:b;display:block}" +
        /* 17/10 đầu thẻ: tên trái · chip sức khoẻ phải; lý do 1 dòng nhỏ; mỗi phiên 1 dòng (tên · trình duyệt · kênh · tuổi | Ghi/Chỉ đọc) */
        ".mt-the{display:flex;gap:4px;flex:none}.mt-ly{font-size:11.5px;line-height:15px}.mt-ly.kem{color:var(--bad,#dc2626)}.mt-ly.chu-y{color:var(--warn)}" +
        ".mt-ph{display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:12px;min-width:0}.mt-ph>span:first-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mt-ph b{font-weight:600}.mt-ph small{font-size:11px;color:var(--muted)}.mt-ph .hx-tag{flex:none;margin:0}",
      ".mt-sk .r i{height:5px;border-radius:3px;background:var(--surface2);overflow:hidden}.mt-sk .r i b{display:block;height:100%;background:var(--good)}.mt-sk .r i b.warn{background:var(--warn)}.mt-sk .r i b.bad{background:var(--bad,#dc2626)}",
      ".mt-sk .r em{font-style:normal;font-weight:600;color:var(--text);font-variant-numeric:tabular-nums}",
      ".mt-phu{font-size:11px;color:var(--muted)}.mt-trong{font-size:12px;color:var(--muted)}",
      ".mt-viec{display:flex;flex-wrap:wrap;gap:4px}.mt-c{font:inherit;font-size:11px;line-height:16px;padding:2px 7px;border-radius:4px;border:1px solid var(--border);background:var(--surface2);color:var(--text);max-width:100%;overflow-wrap:anywhere;text-align:left;display:inline-flex;align-items:center}",
      ".mt-x{font:inherit;font-size:14px;line-height:16px;border:0;background:none;color:var(--muted);cursor:pointer;padding:0 0 0 5px;margin-right:-3px}.mt-x:hover{color:var(--bad,#dc2626)}.mt-x:focus-visible{outline:2px solid var(--accent);outline-offset:1px;border-radius:4px}",
      ".mt-c.chay{border-color:color-mix(in srgb,var(--good) 45%,transparent);background:color-mix(in srgb,var(--good) 12%,transparent)}.mt-c.cho{border-color:color-mix(in srgb,var(--info,var(--accent)) 40%,transparent);background:color-mix(in srgb,var(--info,var(--accent)) 9%,transparent)}",
      ".mt-c.dung{border-color:color-mix(in srgb,var(--warn) 50%,transparent);background:color-mix(in srgb,var(--warn) 12%,transparent);}.mt-c.dung .ten{text-decoration:line-through}",
      ".mt-nh{font-size:11px;font-weight:600;color:var(--muted);align-self:center;min-width:34px}.mt-nh.nang{color:var(--bad,#dc2626)}.hx-mt-ly .ds+.ds{margin-top:4px}",
      /* 15/10 user «chip vừa khớp chữ, đồng bộ nhau; Nặng chốt TRÁI, Nhẹ chốt PHẢI ngang hàng Nặng»: chip rộng theo chữ (không kéo giãn),
         cùng cao/cỡ chữ/đệm; 2 nhóm cùng 1 hàng, nhóm Nhẹ dồn phải — chỉ khi có cả Nặng (khối chỉ có Nhẹ thì vẫn chốt trái) */
      ".mt-nn{display:flex;align-items:flex-start;gap:8px 24px}.mt-nhom{display:flex;align-items:flex-start;gap:8px;min-width:0;flex:1 1 0}.mt-nn>.mt-nhom:only-child{flex:1 1 auto}" +
        ".mt-nhom.phai{justify-content:flex-end}.mt-nhom.phai .mt-luoi{justify-content:flex-end}.mt-nh{flex:none;min-width:0;line-height:28px;align-self:flex-start}" +
        ".mt-luoi{display:flex;flex-wrap:wrap;gap:6px;min-width:0}" +
        ".mt-luoi>.mt-c,.mt-luoi>.hx-tag{display:inline-flex;align-items:center;gap:4px;flex:none;width:auto;max-width:100%;height:28px;box-sizing:border-box;padding:0 10px;border-radius:4px;margin:0;font-size:12px;font-weight:500;line-height:1;white-space:nowrap}" +
        ".mt-luoi>.mt-c .ten{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}.mt-luoi .mt-x{flex:none;margin:0 -6px 0 0;padding:0 2px}",
      ".mt-cot{flex:1 1 0;min-width:0;display:flex;flex-direction:column;gap:4px}.mt-cot.phai{align-items:flex-end;text-align:right}.mt-cot.phai .mt-luoi{justify-content:flex-end}.mt-cot>.ly{font-size:12px;color:var(--muted);margin-top:2px}.mt-luoi>.mt-nh{line-height:28px;align-self:center}.hx-mt-ly .mt-luoi>.mt-nh{line-height:24px}" +
        "@media(max-width:560px){.mt-cot{flex:none;width:100%}.mt-cot.phai{align-items:flex-start;text-align:left}.mt-cot.phai .mt-luoi{justify-content:flex-start}}",
      ".mt-nut{margin-top:auto;display:flex;gap:6px}.mt-nut .hx-nut{flex:1 1 0;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-height:28px;font-size:12px;padding:0 8px;border-radius:6px}",
      /* 17/10 điện thoại: «Việc đảm nhận · Nặng N · Nhẹ M ▾» — bấm xổ chi tiết (hiệu ứng popIn sẵn có, mũi tên xoay như ô chọn .cs) */
      "@media(max-width:560px){.mt-xo{display:flex!important;align-items:center;gap:8px;width:100%;min-height:44px;margin:0;padding:0;border:0;background:transparent;color:var(--muted);font:inherit;font-size:11px;font-weight:600;text-align:left;cursor:pointer}" +
        ".mt-xo .so{margin-left:auto;color:var(--text);font-size:13px;font-weight:600}.mt-xo-mui{flex:none;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid var(--muted);transition:transform .25s cubic-bezier(.4,0,.2,1)}" +
        ".mt-phai.mo .mt-xo-mui{transform:rotate(180deg)}.mt-phai:has(>.mt-xo) .mt-xo-ct{display:none}.mt-phai.mo .mt-xo-ct{display:block;transform-origin:top;animation:popIn .18s var(--ez-spring,ease)}" +
        ".mt-xo:focus-visible{outline:0;box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 25%,transparent);border-radius:6px}}",
      "@media(max-width:560px){.mt-tde{display:none}.mt-ct{display:block}.mt-o>div,.mt-o>div:first-child,.mt-o>div:last-child{padding:0}.mt-o>div+div{border-left:0;border-top:1px solid var(--border);padding-top:8px}}",
      "@media(max-width:560px){.mt-hang{gap:6px}.mt-o{grid-template-columns:minmax(0,1fr);gap:8px;padding:8px}.mt-c{min-height:40px}.mt-x{min-width:40px;min-height:40px;justify-content:center;display:inline-flex;align-items:center;padding:0;margin:-2px -7px -2px 0}.mt-nn{flex-direction:column;gap:8px}.mt-nhom,.mt-nn>.mt-nhom:only-child{flex:none;width:100%}.mt-nhom.phai,.mt-nhom.phai .mt-luoi{justify-content:flex-start}.mt-luoi>.mt-c{height:40px}.mt-luoi .mt-x{min-width:40px;min-height:40px;margin:0 -10px 0 0}.mt-nh{line-height:40px;min-width:34px}.hx-mt-ly .mt-nh{line-height:24px}.hx-mt-ly .mt-luoi{gap:4px}.hx-mt-ly .mt-luoi>.hx-tag{height:24px;padding:0 8px}.hx-mt-ly{padding:8px 12px}.mt-nut .hx-nut{min-height:40px}}",
      ".hx-mt-xin{margin:4px 0 14px;border-color:color-mix(in srgb,var(--warn) 55%,var(--border))}.hx-mt-xin .ma{font-family:ui-monospace,Consolas,monospace;font-size:14px;letter-spacing:2px;color:var(--text)}",
      ".hx-mt-ly{padding:10px 16px;border-top:1px solid var(--border)}.hx-mt-ly .ly{font-size:13px;color:var(--muted);margin-bottom:6px}.hx-mt-ly .ds{display:flex;flex-wrap:wrap;gap:6px}.hx-mt-ly .hx-tag{margin:0;font-weight:500;font-size:12px;color:var(--text)}",
      ".hx-mt-v{display:flex;align-items:center;gap:8px;min-height:44px;padding:6px 16px;border-top:1px solid var(--border)}.hx-mt-v .ten{flex:1;min-width:0;font-size:13.5px}.hx-mt-v .ten small{display:block;color:var(--muted);font-size:12px}",
      ".hx-mt-v .hx-nut{min-height:34px;padding:0 12px;font-size:13px;background:var(--surface);color:var(--text);border-color:var(--border)}.hx-mt-v .hx-nut:hover{border-color:var(--accent);color:var(--accent)}",
      "@media(max-width:560px){.hx-mt-v .hx-nut,.hx-mt-dau .hx-nut,#mtDangXuat{min-height:44px}}",   // 14/10: bỏ xếp dọc panel-head (số «13» rơi xuống dòng riêng, phí chỗ)
      /* form đăng nhập — cùng khuôn .hx-dn của Xác minh */
      ".mt-dn{max-width:400px;margin:24px auto}.mt-dn form{display:flex;flex-direction:column;gap:12px;padding:16px}.mt-dn label{display:flex;flex-direction:column;gap:4px}.mt-dn input{min-height:44px;font-size:16px}",
      ".mt-st.loi{margin-top:4px;font-size:13px;padding:8px 12px;border-radius:10px;background:color-mix(in srgb,var(--bad) 10%,transparent);color:var(--bad)}",
      /* 19/10 user «nhìn vào là biết khung nào ở máy nào»: khung riêng từng máy — viền rõ, vạch màu SỨC KHOẺ bên trái, THANH TÊN MÁY ngang đầu khung
         (nền riêng, chữ 15px đậm, chấm màu), mọi khung CAO BẰNG NHAU (grid-auto-rows:1fr) + cách nhau 12px. Hàng tiêu đề cột đặt NGOÀI lưới
         (để không bị kéo cao theo 1fr) và lề trái/phải khớp lề nội dung khung (viền 4 + đệm 12 · đệm 12 + viền 1). */
      ".mt-hang{display:grid;grid-template-columns:minmax(0,1fr);grid-auto-rows:1fr;gap:12px}" +
        ".mt-o{position:relative;grid-template-rows:auto 1fr;padding:0 12px 10px;border:1px solid color-mix(in srgb,var(--text) 16%,var(--border));border-left:4px solid var(--muted);border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,.05)}" +
        ".mt-o.sk-tot{border-left-color:var(--good)}.mt-o.sk-chu-y{border-left-color:var(--warn)}.mt-o.sk-kem{border-left-color:var(--bad,#dc2626)}" +
        ".mt-o>.mt-trai{padding-left:0}.mt-tde{padding:0 13px 0 16px;margin-bottom:6px}" +
        ".mt-o>.mt-tieu{position:static;z-index:auto;backdrop-filter:none;-webkit-backdrop-filter:none;grid-column:1/-1;display:flex;align-items:center;justify-content:flex-start;flex-wrap:nowrap;gap:8px;margin:0 -12px 10px;padding:8px 12px;background:var(--surface2);border-bottom:1px solid var(--border);border-radius:0 9px 0 0}" +
        ".mt-o>.mt-tieu b{font-size:15px;font-weight:700;line-height:20px;color:var(--text)}.mt-o>.mt-tieu .mt-the{margin-left:auto}" +
        ".mt-den{flex:none;width:10px;height:10px;border-radius:50%;background:var(--muted)}.sk-tot .mt-den{background:var(--good)}.sk-chu-y .mt-den{background:var(--warn)}.sk-kem .mt-den{background:var(--bad,#dc2626)}",
      /* 19/10 user «chip việc nặng/nhẹ to cả web/điện thoại»: 1 dòng tóm tắt (mọi cỡ màn) + bảng chip NỔI khi bấm — khung máy không đổi cỡ.
         Vị trí tĩnh của phần tử absolute = ngay dưới nút (không đặt top) → bảng nổi mở XUỐNG sát nút.
         BẪY: cột đang là flex → vị trí tĩnh của con absolute = ĐẦU cột (đè lên nút) ⇒ cột có nút xổ chuyển display:block. */
      ".mt-phai{position:relative}.mt-phai:has(>.mt-xo){display:block}.mt-phai>.mt-xo{display:flex;align-items:center;flex-wrap:wrap;gap:4px 8px;width:100%;min-height:32px;margin:0;padding:4px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font:inherit;font-size:12px;text-align:left;cursor:pointer}" +
        ".mt-phai>.mt-xo:hover{border-color:var(--accent)}.mt-phai>.mt-xo .nhan{display:none}.mt-phai>.mt-xo .so{margin:0;font-size:12.5px;font-weight:600;color:var(--text)}" +
        ".mt-xo .phu{font-size:11px;font-weight:500;color:var(--muted)}.mt-xo .phu.chay{color:var(--good)}.mt-xo .phu.tat{color:var(--warn)}.mt-phai>.mt-xo .mt-xo-mui{margin-left:auto}" +
        ".mt-xo-mui{flex:none;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid var(--muted);transition:transform .25s cubic-bezier(.4,0,.2,1)}.mt-phai.mo .mt-xo-mui,.mt-chua.mo .mt-xo-mui{transform:rotate(180deg)}" +
        ".mt-phai>.mt-xo:focus-visible,.mt-chua-dau:focus-visible{outline:0;box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 25%,transparent)}" +
        ".mt-phai:has(>.mt-xo)>.mt-xo-ct{display:none;position:absolute;left:8px;right:8px;z-index:40;margin-top:4px;padding:6px 10px 10px;background:var(--surface);border:1px solid var(--border);border-radius:10px;box-shadow:0 10px 28px rgba(0,0,0,.16);max-height:min(60vh,420px);overflow:auto}" +
        ".mt-phai.mo:has(>.mt-xo)>.mt-xo-ct{display:block;transform-origin:top;animation:popIn .18s var(--ez-spring,ease)}.mt-o.mo .mt-phai.mo{opacity:1}" +
        ".mt-xo-dau{display:flex;align-items:center;gap:8px;margin-bottom:6px}.mt-xo-dau b{flex:1;min-width:0;font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
        ".mt-xo-dong{flex:none;width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:6px;background:transparent;color:var(--muted);font:inherit;font-size:14px;cursor:pointer}.mt-xo-dong:hover{background:var(--surface2);color:var(--bad,#dc2626)}" +
        ".mt-xo-ct .mt-luoi{gap:4px}.mt-xo-ct .mt-luoi>.mt-c{height:24px;padding:0 8px;font-size:11.5px}.mt-xo-ct .mt-nh{line-height:24px}.mt-o .mt-xo-ct .mt-nn{gap:6px}",
      /* 19/10 «Việc chưa có máy nhận» gọn: 1 dòng (tên · Nặng N · Nhẹ M · lý do chung ▾), bấm mới xổ chip */
      ".mt-chua-dau{display:flex!important;align-items:center;flex-wrap:wrap;gap:4px 10px;width:100%;margin:0;font:inherit;text-align:left;cursor:pointer;background:transparent;border:0;border-radius:inherit;color:var(--text)}" +
        ".mt-chua .mt-chua-dau{padding:10px 16px;min-height:40px;height:auto;font-size:14px;line-height:20px;box-shadow:none;transform:none;border-bottom:1px solid var(--border)}.mt-chua .mt-chua-dau:hover{background:var(--hover)}.mt-chua:not(.mo) .mt-chua-dau{border-bottom:0}.mt-chua-dau .ten{font-weight:600}.mt-chua-dau .so{font-size:13px;font-weight:600;color:var(--bad,#dc2626)}.mt-chua-dau .ly1{font-size:12px;color:var(--muted)}.mt-chua-dau .mt-xo-mui{margin-left:auto}" +
        ".mt-chua:not(.mo)>.hx-mt-ly{display:none}.mt-chua.mo>.hx-mt-ly{transform-origin:top;animation:popIn .18s var(--ez-spring,ease)}.mt-chua{margin-bottom:12px}",
      "@media(max-width:560px){.mt-hang{gap:10px;grid-auto-rows:auto}.mt-xo-ct .mt-nhom{flex-direction:column;gap:4px}.mt-xo-ct .mt-nh{line-height:18px!important}.mt-tde{display:none}.mt-o{padding:0 10px 10px}.mt-o>.mt-tieu{margin:0 -10px 8px;padding:8px 10px}.mt-o>.mt-tieu b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}" +
        ".mt-phai>.mt-xo{min-height:44px;padding:4px 10px}.mt-phai>.mt-xo .nhan{display:inline;font-size:11px;font-weight:600;color:var(--muted)}.mt-phai:has(>.mt-xo)>.mt-xo-ct{left:0;right:0}" +
        ".mt-xo-dong{width:44px;height:44px;margin:-8px -8px -8px 0}.mt-xo-ct .mt-luoi{gap:8px 6px}.mt-xo-ct .mt-luoi>.mt-c{height:32px;min-height:0;font-size:12px}.mt-xo-ct .mt-nh{line-height:32px}" +
        ".mt-xo-ct .mt-luoi .mt-x{min-width:40px;min-height:40px;margin:-4px -10px -4px -6px}.mt-chua .mt-chua-dau{min-height:44px;padding:8px 12px}.mt-chua{margin-bottom:10px}}",
      /* 19/10 chiều user (máy tính): cột «Thông tin máy · sức khoẻ» HẸP ĐI 40% (1.25fr → .75fr), phần dư chia ĐỀU 2 cột còn lại (1.45fr mỗi cột);
         nút Cập nhật ngay / Dừng máy gọn vừa cột; RAM·CPU / các ổ 2 ô mỗi hàng. Việc đảm nhận + «Việc chưa có máy nhận» HIỆN THẲNG danh sách
         (không nút ẩn/hiện) — chỉ điện thoại mới có dòng tóm tắt + mũi tên. Danh sách dài thì chip xuống dòng trong cột; khung vẫn cao bằng nhau. */
      "@media(min-width:561px){.mt-o,.mt-tde{grid-template-columns:minmax(170px,.75fr) minmax(0,1.45fr) minmax(0,1.45fr)}" +
        ".mt-o .mt-sk{grid-template-columns:repeat(2,minmax(0,1fr))}.mt-nut{gap:4px}.mt-nut .hx-nut{min-height:26px;font-size:11.5px;padding:0 6px}" +
        ".mt-phai>.mt-xo{display:none}.mt-xo-dau{display:none}" +
        ".mt-phai:has(>.mt-xo)>.mt-xo-ct,.mt-phai.mo:has(>.mt-xo)>.mt-xo-ct{display:block;position:static;margin:0;padding:0;border:0;border-radius:0;background:none;box-shadow:none;max-height:none;overflow:visible;animation:none}" +
        ".mt-chua .mt-chua-dau{pointer-events:none;cursor:default}.mt-chua-dau .mt-xo-mui{display:none}.mt-chua:not(.mo)>.hx-mt-ly{display:block}.mt-chua:not(.mo) .mt-chua-dau{border-bottom:1px solid var(--border)}}"
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
    return { srvNow: now, may: may, viec: tatCa.map(function (t) { return { ten: t, may: chu[t] || null, canKhoa: [] }; }), chuyen: j.chuyen || [], bridge: j.bridge || [] };   // 17/10: điện thoại cũng thấy phiên trên thẻ máy
  }
  // Máy quản lý? Thanh bên dò 8591 bất đồng bộ (~1,5 s) — mở thẳng ?tab=maytram thì module chạy TRƯỚC ⇒ tự dò, đừng chờ.
  var MAY_CHU = false, CAN_DN = false;
  function dongMayChu() {
    if (typeof window.hxDoMayChu === "function") return window.hxDoMayChu().then(function (co) { if (co) API = window.HX_API;
      /* 19/10 điện thoại qua đường hầm: chưa đổi được phiên 8591 thì đi đường Apps Script cũ (không bày ô đăng nhập riêng) */
      if (!co || !window.__HX_QUA_HAM || phien() || typeof window.tkDoiPhienXm !== "function") return co;
      return window.tkDoiPhienXm().then(function () { return !!phien(); }); });
    if (window.__HX_MAY_CHU) return Promise.resolve(true);
    if (window.__HX_KHONG_MAY) return Promise.resolve(false);   // 15/10: điện thoại → chỉ đọc qua Apps Script, không gọi 127.0.0.1
    var ctl = new AbortController(), h = setTimeout(function () { ctl.abort(); }, 1500);
    return fetch(API + "/api/ping", { signal: ctl.signal }).then(function (r) { clearTimeout(h); return r.ok; }).catch(function () { return false; });
  }
  function tai() {
    return dongMayChu().then(function (co) {
      MAY_CHU = co;
      // 14/10: trang có HỆ TÀI KHOẢN → bắt buộc đăng nhập ở đó (phiên Xác minh cũ hx-phien còn sót trên laptop KHÔNG đủ)
      if (window.TK && !phienTk()) { CAN_DN = true; DIEU_KHIEN = false; return null; }
      if (co) {   // máy quản lý: cần phiên Xác minh (8591) — đầy đủ + nút điều khiển
        /* 15/10 user thấy «Tài khoản «Lê Chí Tâm» chưa có quyền Xác minh» dù là quản trị: phiên 8591 (hx-phien) mất/hết hạn (máy chủ
           khởi động lại) → 401 → báo nhầm thiếu quyền. Nay: đổi lại phiên tài khoản → phiên 8591 MỘT lần rồi thử lại, hỏng mới hỏi đăng nhập. */
        var doiLai = function () { return typeof window.tkDoiPhienXm === "function" && window.TK ? window.tkDoiPhienXm() : Promise.resolve(false); };
        var lay = function (lan) {
          if (!phien()) return lan ? (CAN_DN = true, null) : doiLai().then(function () { return lay(1); });
          return goi591("/api/may-tram").then(function (j) { DIEU_KHIEN = true; CAN_DN = false; return j; })
            .catch(function (e) { if (e.ma === 401) { try { localStorage.removeItem("hx-phien"); } catch (x) {} return lay(lan); } throw e; });
        };
        return lay(0);
      }
      /* 14/10 trưa: dùng phiên HỆ TÀI KHOẢN MỚI (tai-khoan.js, nút «Đăng nhập» thanh bên) nếu có quyền Xác minh — 1 lần đăng nhập */
      var tkPh = phienTk(), mp = mtPhien(), ph = tkPh || (mp && mp.ph);
      if (!ph) { CAN_DN = true; return null; }
      return postGas({ action: "pcBangPh", ph: ph }).then(function (j) {
        if (j.status !== "success") { if (j.code === 401) { if (!tkPh) try { localStorage.removeItem("mt-phien"); } catch (x) {} CAN_DN = true; return null; } throw new Error(j.message || "Apps Script trả lỗi"); }
        // 14/10 user «nút dừng chạy của máy trạm đâu»: tài khoản quyền «làm» ở Xác minh → có nút (lệnh qua GAS pcLenhPh); quyền «xem» → chỉ xem
        DIEU_KHIEN = !!(tkPh && typeof window.tkCo === "function" && window.tkCo("r.xacminh", "lam")); CAN_DN = false; return chuanGas(j); });
    }).then(function (d) { MTD = d; MT_LOI = "";
      if (d && window.tqGhi) tqGhi("mt", { song: d.may.filter(function (m) { return m.song && !m.dung; }).length, tong: d.may.length });
      if (d && typeof window.soThanhBen === "function") window.soThanhBen(); })   // 14/10: thanh bên từng giữ số cũ (0/1 khi đã có 2 máy)
      .catch(function (e) { MT_LOI = e.name === "AbortError" ? "Máy chủ không trả lời sau 45 giây" : e.message; });
  }
  function phienTk() { var T = window.TK; return T && T.nguoi && T.phien && (typeof window.tkCo !== "function" || window.tkCo("r.xacminh")) ? T.phien : ""; }
  function veDangNhap(thongBao) {
    if (typeof window.tkMoDangNhap === "function") {   // có hệ tài khoản chung → dùng ĐÚNG ô đăng nhập của nó, không ô riêng
      PANE.innerHTML = '<div class="panel mt-dn"><div class="panel-head"><span>Đăng nhập để xem Máy trạm</span></div><div style="padding:16px;display:flex;flex-direction:column;gap:12px">' +
        (window.TK && window.TK.nguoi ? '<div class="mt-st loi">' + (typeof window.tkCo === "function" && !window.tkCo("r.xacminh")
          ? "Tài khoản «" + e_(window.TK.nguoi.ten || window.TK.nguoi.id) + "» chưa có quyền Xác minh."
          : "Phiên đăng nhập đã hết — bấm Đăng nhập để vào lại.") + "</div>" : "") +   // 15/10: chỉ báo thiếu quyền khi THẬT SỰ thiếu
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
    /* 14/10 khuya user «chip việc nặng nhẹ hiển thị cẩu thả, k theo thứ tự, cái to cái nhỏ lộn xộn»:
       · nhãn «Nặng:/Nhẹ:» thành CỘT TRÁI cố định — hàng chip thứ 2 không còn thụt dưới nhãn
       · chip vào LƯỚI ô rộng bằng nhau, cao bằng nhau, chữ 1 dòng (dài thì «…», rê chuột xem đủ)
       · thứ tự CỐ ĐỊNH: hang(t) (đang chạy → chờ → chạy dở → đã dừng) rồi tên A→Z — cùng màu đứng cạnh nhau */
    /* doc: Nặng trên / Nhẹ dưới (cột Việc đảm nhận) — nhãn cả 2 nhóm cùng cột trái */
    var chiaNang = function (ds, ve1, hang, doc) { var n = ds.filter(function (t) { return nangCua[t] === true; }), h = ds.filter(function (t) { return nangCua[t] === false; }), k = ds.filter(function (t) { return !(t in nangCua); });
      var xep = function (a) { return a.slice().sort(function (x, y) { return ((hang ? hang(x) : 0) - (hang ? hang(y) : 0)) || tenV(x).localeCompare(tenV(y), "vi"); }); };
      var g = [[n, "Nặng", " nang"], [h.concat(k), "Nhẹ", ""]].filter(function (x) { return x[0].length; });
      return '<div class="mt-nn">' + g.map(function (x, i) { var phai = !doc && i && g.length > 1, nhan = '<span class="mt-nh' + x[2] + '">' + x[1] + ":</span>";   // nhóm phải: nhãn đi LIỀN chip đầu (không lơ lửng giữa hàng)
        return '<div class="mt-nhom' + (phai ? " phai" : "") + '">' + (phai ? "" : nhan) + '<div class="mt-luoi">' + (phai ? nhan : "") + xep(x[0]).map(ve1).join("") + "</div></div>"; }).join("") + "</div>"; };
    var coMayKhac = function (m) { return MTD.may.some(function (x) { return x.may !== m.may && x.song && !x.dung; }); };
    var tenBoi = function (b) { return /^bo cai/.test(b) ? "bộ cài (máy quản lý)" : b; };   // nhãn ASCII do bộ cài gửi → tiếng Việt
    var gioPhut = function (ms) { var d = new Date(ms); return (d.getHours() < 10 ? "0" : "") + d.getHours() + ":" + (d.getMinutes() < 10 ? "0" : "") + d.getMinutes() + (Date.now() - ms > 864e5 ? " " + d.getDate() + "/" + (d.getMonth() + 1) : ""); };
    /* 14/10 chiều user «thêm trạng thái đang chạy việc gì, chạy ra sao, của task nào vào từng máy pc trạm»: mỗi việc đang chạy của MÁY NÀY —
       tên việc · bước đang làm · phiếu đang soát (link work) · thanh i/n · từ mấy giờ, bao lâu · cập nhật cách đây. Tiến độ do tien-do.mjs
       (cò gửi GAS pcPhu ≥15 s/lần); PC bản cũ / cò chưa gắn tiến độ → chỉ tên việc + giờ bắt đầu. */
    /* «Hôm nay đã làm N việc · gần nhất: X lúc HH:MM (… trước)» — từ chayLuc (lần chạy gần nhất mỗi việc). Chưa làm gì hôm nay → nói rõ. */
    var homNay = function (m) {
      if (!m.chayLuc) return "";
      var dau = new Date(); dau.setHours(0, 0, 0, 0);
      var ds = Object.keys(m.chayLuc).map(function (t) { return { t: t, x: Date.parse(m.chayLuc[t]) }; }).filter(function (o) { return o.x >= dau.getTime(); }).sort(function (a, b) { return b.x - a.x; });
      if (!ds.length) return '<div class="mt-hn trong">Hôm nay chưa làm việc nào</div>';
      return '<div class="mt-hn"><b>Hôm nay đã làm ' + ds.length + " việc</b> · gần nhất: " + e_(tenV(ds[0].t)) + " lúc " + gioPhut(ds[0].x) + " (" + tuoiChu(Math.round((Date.now() - ds[0].x) / 1000)) + ")</div>";
    };
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
    /* 14/10 user «hiển thị đánh giá sức khoẻ của máy trạm»: 1 kết luận Tốt / Cần chú ý / Kém + LÝ DO cụ thể (không lặp số trên thanh RAM/CPU/ổ).
       Kém: mất nhịp · RAM ≥ 85% · CPU ≥ 90% · ổ còn < 3 GB · task việc không khởi chạy (congLuc trống/im > 3 giờ).
       Cần chú ý: RAM ≥ 70% · CPU ≥ 70% · ổ còn < 10 GB · task việc báo lỗi · bản mã cũ (chưa nhận cập nhật). */
    var danhGia = function (m) {
      var kem = [], chuY = [];
      if (!m.song) kem.push("mất nhịp " + tuoiChu(m.tuoiGiay));
      var ram = Math.round(100 - (m.ramTrongPct || 0)), cpu = Math.round(m.cpuPct || 0);
      if (m.song) { if (ram >= 85) kem.push("RAM đầy " + ram + "%"); else if (ram >= 70) chuY.push("RAM " + ram + "%");
        if (cpu >= 90) kem.push("CPU " + cpu + "%"); else if (cpu >= 70) chuY.push("CPU " + cpu + "%"); }
      /* 15/10 user «sao Yếu mà sức khoẻ Tốt»: máy tự cắm cờ yeu khi RAM trống < 30% và chỉ gỡ khi trống lại ≥ 40% (chống bật tắt) —
         RAM đang hạ (60–70%) thì cờ còn mà ngưỡng 70% ở đây chưa báo ⇒ lệch. Nay cờ yeu luôn hiện thành lý do. */
      if (m.song && m.yeu) chuY.push("tạm ngưng việc nặng" + (ram < 70 ? " (RAM " + ram + "%, chờ xuống 60%)" : ""));
      (m.oDia && m.oDia.length ? m.oDia : m.diaTrongGB != null ? [{ o: "C", trong: m.diaTrongGB }] : []).forEach(function (x) {   // CÙNG ngưỡng màu thanh ổ (đỏ ≥ 95% / vàng ≥ 85%) — thanh đỏ mà ghi «Tốt» là lệch
        var dung = x.tong ? Math.round((x.tong - x.trong) / x.tong * 100) : 0, ten = "ổ " + x.o + (dung ? " đầy " + dung + "%" : "") + ", còn " + Math.round(x.trong) + " GB";
        if (x.trong < 3) kem.push(ten); else if (x.trong < 10 || dung >= 85) chuY.push(ten); });
      if (m.song && !m.duPhong && ("congLuc" in m) && (!m.congLuc || Date.now() - Date.parse(m.congLuc) > 3 * 3600e3)) kem.push("task việc không khởi chạy");
      /* 14/10 21:52 tìm ra gốc QLIT: chỉ có 4/13 task «5S DP» (lần cài đầu đăng ký lỗi, bộ cập nhật không tạo lại) → hiện thẳng trên thẻ */
      var soTask = (m.taskDP || []).filter(function (d) { return /^5S DP /.test(String(d)); }).length, canTask = (m.tatCaViec || []).length;
      if (!m.duPhong && (m.taskDP || []).length && canTask && soTask < canTask) kem.push("thiếu " + (canTask - soTask) + "/" + canTask + " task việc");
      (m.taskDP || []).forEach(function (d) { var p = String(d).split("|"), ma = Number(p[3]);   // 267011 chưa chạy lần nào · 267009 đang chạy · 0 tốt
        if (p[0] && /^5S DP /.test(p[0]) && ma && ma !== 267011 && ma !== 267009) chuY.push(p[0].replace(/^5S DP /, "") + " lỗi mã " + ma); });
      if (m.song && !m.duPhong && !("chayLuc" in m)) chuY.push("bản mã cũ, chưa nhận cập nhật");
      return kem.length ? { muc: "kem", chu: "Kém", ly: kem.concat(chuY) } : chuY.length ? { muc: "chu-y", chu: "Cần chú ý", ly: chuY } : { muc: "tot", chu: "Tốt", ly: [] };
    };
    /* 17/10 user «ở máy nào thì điền vào máy đó luôn»: phiên bridge ghi vào đúng thẻ máy — extension 1.6.5 kèm tên máy (policy ghim-bridge.ps1); không có tên = laptop (ghim HKCU) */
    /* 17/10 user «tại sao 1 máy lại có 2 phiên»: phiên không kèm tên máy (laptop, ghim HKCU) từng gắn vào MỌI máy có cờ duPhong — mà cờ này bật ở
       cả PC (tien-do.mjs máy nào chạy cũng báo pcPhu) ⇒ phiên laptop hiện trên QLIT. Nay chỉ gắn vào máy dự phòng ĐANG DỪNG = laptop. */
    var mayLaptop = (MTD.may.filter(function (x) { return x.duPhong && x.dung; })[0] || {}).may;
    var phienCua = function (m) { var g = {}, ds = [];
      (MTD.bridge || []).forEach(function (b) { if ((b.may || mayLaptop) !== m.may || !b.tuoi) return; var k = b.email || ("mã " + b.sub);
        if (!g[k]) { g[k] = { k: k, ten: b.ten || "", td: b.td || "", tamlc: b.tamlc, kenh: [], at: 0 }; ds.push(g[k]); }
        g[k].kenh.push(b.kind === "wshr" ? "work/hr" : b.kind === "wms" ? "WMS" : b.kind); g[k].at = Math.max(g[k].at, b.at || 0); });
      /* 17/10 user «có theo máy rồi thì hiển thị thêm mục Phiên bridge làm gì»: bỏ khối riêng — nhãn Ghi/Chỉ đọc dời vào dòng phiên trên thẻ; email ở chú thích */
      return ds.map(function (o) { return '<div class="mt-ph" title="' + e_(o.k) + '"><span>Phiên: <b>' + e_(o.ten || o.k) + "</b> <small>" +
        e_((o.td ? o.td + " · " : "") + o.kenh.join(", ") + " · " + tuoiChu(Math.round((Date.now() - o.at) / 1000))) + "</small></span>" +
        '<span class="hx-tag ' + (o.tamlc ? "good" : "info") + '">' + (o.tamlc ? "Ghi + đọc" : "Chỉ đọc") + "</span></div>"; }).join(""); };
    var the = function (m) {
      /* 14/10 laptop = MÁY DỰ PHÒNG (bị «Dừng» trong điều phối nhưng vẫn chạy cò gốc khi PC chưa nhận — GAS PCPHU gộp vào dangChay/duPhong) */
      var lamThay = m.dung && m.duPhong && (m.dangChay || []).length > 0;
      var ramDung = Math.round(100 - (m.ramTrongPct || 0)), cpu = Math.round(m.cpuPct || 0), dia = m.diaTrongGB;
      var chiLap = m.duPhong ? (MTD.viec || []).filter(function (v) { return v.chiLaptop; }).map(function (v) { return v.ten; }) : [];   // laptop: việc chỉ chạy được ở đây
      var viec = []; (m.viecGiao || []).concat(chiLap, m.dangChay || [], m.dungViec || []).forEach(function (t) { if (viec.indexOf(t) < 0) viec.push(t); });
      var veChip = function (t) {
        var dung = (m.dungViec || []).indexOf(t) >= 0, chay = (m.dangChay || []).indexOf(t) >= 0, sang = mayCua[t];
        var lop = dung ? "dung" : chay ? "chay" : (m.viecGiao || []).indexOf(t) >= 0 || chiLap.indexOf(t) >= 0 ? "cho" : "do";
        var nghia = dung ? "Đã dừng ở máy này" + (sang && sang !== m.may ? " → " + sang + " làm thay" : "") : chay ? "Đang chạy" : lop === "cho" ? "Được giao · chờ tới giờ" + ((m.chayLuc || {})[t] ? " · chạy gần nhất " + gioPhut(Date.parse(m.chayLuc[t])) : " · chưa chạy lần nào trên máy này") : "Đang chạy dở (đã giao máy khác)";
        /* 14/10 «chip việc có dấu x bên phải — máy nặng quá thì tắt, bộ điều phối chuyển việc sang máy khác»; việc đã tắt → ↺ bật lại */
        var x = DIEU_KHIEN && !m.dung ? '<button class="mt-x" data-may="' + e_(m.may) + '" data-viec="' + e_(t) + '" data-dung="' + (dung ? "0" : "1") + '" title="' + e_(dung ? "Bật lại việc này trên máy này" : "Tắt việc này trên máy này — chuyển sang máy khác") + '" aria-label="' + e_((dung ? "Bật lại " : "Tắt ") + tenV(t)) + '">' + (dung ? "↺" : "×") + "</button>" : "";
        /* 15/10 user «hiển thị ai nhận các việc nặng đã dừng»: chip việc đã tắt ghi thẳng máy đang làm thay (trước chỉ có trong chú thích rê chuột) */
        var nhanThay = !dung ? "" : sang && sang !== m.may ? '<small class="sang">→ ' + e_(sang) + "</small>"
          : '<small class="sang chua">→ ' + (dangChuyen[t] ? "chờ máy chạy bù" : "chưa máy nào nhận") + "</small>";
        return '<span class="mt-c ' + lop + '" title="' + e_(tenV(t) + " — " + nghia) + '"><span class="ten">' + e_(tenV(t)) + "</span>" + nhanThay + x + "</span>";
      };
      var hangChip = function (t) { return (m.dungViec || []).indexOf(t) >= 0 ? 3 : (m.dangChay || []).indexOf(t) >= 0 ? 0 : (m.viecGiao || []).indexOf(t) >= 0 || chiLap.indexOf(t) >= 0 ? 1 : 2; };
      var chip = (viec.length ? chiaNang(viec, veChip, hangChip, true) : "") || '<div class="mt-trong">' + (m.dung ? (m.duPhong ? "Dự phòng — chỉ làm thay khi PC chưa nhận việc." : coMayKhac(m) ? "Đang dừng — việc do máy khác làm." : "Đang dừng — không nhận việc.")
        : m.song ? "Chưa được giao việc." : (coMayKhac(m) ? "Mất nhịp — việc đã sang máy khác." : "Mất nhịp.")) + "</div>";
      var nutMay = !DIEU_KHIEN ? "" : !m.song && !m.dung ? '<button class="hx-nut phu" data-may="' + e_(m.may) + '" data-xoa="1">Gỡ</button>'   // máy im: chỉ còn gỡ
        : '<button class="hx-nut' + (m.dung ? "" : " phu") + '" data-may="' + e_(m.may) + '" data-dung="' + (m.dung ? "0" : "1") + '">' + (m.dung ? "Cho chạy lại" : "Dừng máy") + "</button>";
      /* 15/10 user «tìm cách quản lý các máy»: «Cập nhật ngay» — nhịp tim PC (SYSTEM, mỗi phút) nhận lệnh qua Apps Script → chạy bộ cập nhật ngay, bỏ chờ 2 giờ.
         Đã gửi mà máy chưa nhận → nút khoá «Chờ máy nhận lệnh…» (lệnh tự gỡ khi PC báo đã nhận). */
      if (DIEU_KHIEN && m.song) nutMay = (m.capNhatYc ? '<button class="hx-nut phu" disabled title="Gửi lúc ' + e_(gioPhut(Date.parse(m.capNhatYc))) + ' — máy nhận trong ~1 phút">Chờ máy nhận lệnh…</button>'
        : '<button class="hx-nut phu" data-may="' + e_(m.may) + '" data-capnhat="1" title="' + e_("Lấy bản mới nhất ngay (không chờ lượt 2 giờ) · " + ((m.capGan || []).slice(-1)[0] || "")) + '">Cập nhật ngay</button>') + nutMay;
      /* 14/10 user «thông tin ở nút máy trạm đang lộn xộn, lặp lại»: thông tin phụ (nhân, RAM, điểm, bản, nhịp, dừng bởi) dồn vào chú thích tên máy;
         thẻ chỉ còn: tên · trạng thái · SỨC KHOẺ (kết luận + lý do) · thanh RAM/CPU/ổ · nút. Bỏ dòng «13 việc · 2 chạy · 10 chờ» (trùng màu chip + khối Đang chạy). */
      var dg = danhGia(m);
      var tip = (m.nhan || "?") + " nhân · " + (m.ramTongGB || "?") + " GB RAM · điểm " + (m.diem || 0) + (m.ban ? " · bản " + m.ban : "") + " · nhịp tim " + tuoiChu(m.tuoiGiay) +
        ((m.coKhoa || []).indexOf("TOPREVIEW_USER") < 0 ? " · không có khoá camera" : "") + (m.dung && m.lenhBoi ? " · dừng bởi " + tenBoi(m.lenhBoi) : "");
      /* 17/10 user «thay chip Rảnh bằng Sức khoẻ»: chip đầu thẻ = kết luận sức khoẻ (lý do dòng nhỏ dưới); Đang làm việc/Rảnh đã thấy ở cột «Việc đang làm»;
         chỉ giữ thêm nhãn khi máy bị Dừng/Dự phòng (mất nhịp đã nằm trong lý do «Kém»). */
      var chipSk = { tot: ["Sức khoẻ tốt", "good"], "chu-y": ["Cần chú ý", "warn"], kem: ["Sức khoẻ kém", "bad"] }[dg.muc];
      /* 19/10 user «nhìn trang Máy trạm chưa phân biệt máy nào là máy nào — khung chưa tách biệt, chưa chốt kích thước»: mỗi máy 1 KHUNG riêng
         (viền + vạch màu sức khoẻ bên trái), THANH TÊN MÁY chạy ngang đầu khung (chữ to, nền riêng), mọi khung cao bằng nhau (.mt-hang grid 1fr) */
      var nangSo = viec.filter(function (t) { return nangCua[t] === true; }).length, tatSo = viec.filter(function (t) { return (m.dungViec || []).indexOf(t) >= 0; }).length,
        chaySo = viec.filter(function (t) { return (m.dangChay || []).indexOf(t) >= 0; }).length;
      return '<div class="mt-o sk-' + dg.muc + (m.song ? "" : " cu") + (!m.song || (m.dung && !lamThay) ? " mo" : "") + '"><header class="mt-dau mt-tieu"><i class="mt-den" aria-hidden="true"></i><b title="' + e_(tip) + '">' + e_(m.may) + "</b>" +
        '<span class="mt-the"><span class="hx-tag ' + chipSk[1] + '">' + chipSk[0] + "</span>" + (m.dung ? '<span class="hx-tag ' + (m.duPhong ? 'info">Dự phòng' : 'warn">Đã dừng') + "</span>" : "") + "</span></header><div class=\"mt-trai\">" +
        (dg.ly.length ? '<div class="mt-ly ' + dg.muc + '">' + e_(dg.ly.join(" · ")) + "</div>" : "") + phienCua(m) +
        /* 17/10 user «làm rộng cột thông tin máy để giảm chiều dọc»: RAM · CPU · các ổ chung 1 hàng (chữ trên, thanh dưới) thay vì 2 hàng */
        '<div class="mt-sk">' + dong("RAM", ramDung + "%", ramDung, mucDo(ramDung, 70, 85)) + dong("CPU", cpu + "%", cpu, mucDo(cpu, 70, 90)) +
        /* 14/10 user «ổ C ít quá, cần liệt kê thêm ổ mà máy trạm có»: mỗi ổ 1 ô — thanh = phần ĐÃ DÙNG, số = còn trống. PC bản cũ (chưa gửi oDia) → ổ C như trước */
        ((m.oDia && m.oDia.length) ? m.oDia.map(function (x) { var dung = x.tong ? Math.round((x.tong - x.trong) / x.tong * 100) : 0;
            return '<div class="r" title="' + e_("Ổ " + x.o + ": còn " + x.trong + " / " + x.tong + " GB") + '"><span>' + e_(x.o) + ':</span><i><b class="' + (x.trong < 3 || dung >= 95 ? "bad" : x.trong < 10 || dung >= 85 ? "warn" : "") + '" style="width:' + dung + '%"></b></i><em>' + Math.round(x.trong) + " GB</em></div>"; }).join("")
          : dong("Ổ C", dia == null ? "—" : Math.round(dia) + " GB", dia == null ? 0 : Math.min(100, dia / 0.5), dia == null ? "" : dia < 3 ? "bad" : dia < 10 ? "warn" : "")) + "</div>" +
        (nutMay ? '<div class="mt-nut">' + nutMay + "</div>" : "") + "</div>" +
        /* 17/10 user «chỉ ở điện thoại: việc nặng nhẹ mặc định ghi SỐ LƯỢNG việc, ẩn chi tiết; cần xem thì ấn mũi tên bên cạnh — xổ xuống»:
           nút đầu cột (chỉ hiện ≤560px, máy tính giữ nguyên chip) · trạng thái mở nhớ theo máy qua lượt làm mới 30 s (MT_MO) */
        /* 19/10 user «chip việc nặng/nhẹ hiển thị to cả web/điện thoại — làm cách khác»: CẢ web lẫn điện thoại chỉ 1 dòng «Nặng N · Nhẹ M ▾»
           (+ đang chạy / đã tắt nếu có); bấm → bảng chip NỔI (popIn, có ✕, bấm ra ngoài đóng) đè lên trang — khung máy không đổi cỡ */
        '<div class="mt-phai' + (MT_MO[m.may] ? " mo" : "") + '">' + (viec.length ? '<button type="button" class="mt-ct mt-xo" data-xo="' + e_(m.may) + '" aria-expanded="' + !!MT_MO[m.may] + '"><span class="nhan">Việc đảm nhận</span>' +
          '<span class="so">' + [[nangSo, "Nặng"], [viec.length - nangSo, "Nhẹ"]].filter(function (x) { return x[0]; }).map(function (x) { return x[1] + " " + x[0]; }).join(" · ") + "</span>" +
          (chaySo ? '<span class="phu chay">' + chaySo + " đang chạy</span>" : "") + (tatSo ? '<span class="phu tat">' + tatSo + " đã tắt</span>" : "") +
          '<span class="mt-xo-mui" aria-hidden="true"></span></button>' : '<span class="mt-ct">Việc đảm nhận</span>') +
          (viec.length ? '<div class="mt-xo-ct" role="dialog" aria-label="' + e_("Việc đảm nhận — " + m.may) + '"><div class="mt-xo-dau"><b>' + e_(m.may) + '</b><button type="button" class="mt-xo-dong" data-xo-dong="' + e_(m.may) + '" aria-label="Đóng">✕</button></div>' + chip + "</div>" : '<div class="mt-xo-ct">' + chip + "</div>") + "</div>" +
        '<div class="mt-ket"><span class="mt-ct">Việc đang làm và kết quả</span>' + ((dangChayMay(m) + homNay(m)) || '<div class="mt-trong">Chưa ghi nhận lượt chạy nào.</div>') + "</div></div>";
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
      /* 19/10 user «khi chưa có máy nào nhận việc cũng cần gọn — trên điện thoại bảng này chiếm phần lớn khung trang»: mặc định 1 DÒNG
         «Việc chưa có máy nhận · Nặng N · Nhẹ M ▾» (+ lý do khi chỉ 1 lý do); bấm mới xổ chip (popIn), nhớ trạng thái qua lượt làm mới */
      var nChua = chuaCo.filter(function (v) { return nangCua[v.ten] === true; }).length, moChua = !!MT_MO["_chua_"];
      h += '<div class="panel mt-chua' + (moChua ? " mo" : "") + '"><button type="button" class="mt-chua-dau" data-xo-chua="1" aria-expanded="' + moChua + '"><span class="ten">Việc chưa có máy nhận</span>' +
        '<span class="so">' + [[nChua, "Nặng"], [chuaCo.length - nChua, "Nhẹ"]].filter(function (x) { return x[0]; }).map(function (x) { return x[1] + " " + x[0]; }).join(" · ") + "</span>" +
        (nhom.length === 1 ? '<span class="ly1">' + e_(nhom[0]) + "</span>" : "") + '<span class="mt-xo-mui" aria-hidden="true"></span></button>' +
        /* 15/10 user: Nặng chốt TRÁI, Nhẹ chốt PHẢI NGANG HÀNG — dữ liệu thật chia nhiều lý do (khoá camera / khoá AI / cần PC) nên trước đây
           Nhẹ rơi xuống hàng riêng. Nay 2 CỘT: Nặng (mọi lý do) trái · Nhẹ (mọi lý do) phải; lý do ghi nhỏ trong cột, nhãn Nặng/Nhẹ 1 lần. */
        (function () {
          var tag = function (t) { return '<span class="hx-tag">' + e_(tenV(t)) + "</span>"; };
          var mot = nhom.length === 1;   // 1 lý do chung → ghi 1 LẦN trên cùng (luật không lặp), cột chỉ còn chip
          var cot = function (laNang) { var dau = true, nhan = '<span class="mt-nh' + (laNang ? " nang" : "") + '">' + (laNang ? "Nặng" : "Nhẹ") + ":</span>";
            var phan = nhom.map(function (ly) { var ds = theo[ly].filter(function (t) { return (nangCua[t] === true) === laNang; }).sort(function (x, y) { return tenV(x).localeCompare(tenV(y), "vi"); });
              if (!ds.length) return ""; var h1 = (mot ? "" : '<div class="ly">' + e_(ly) + "</div>") + '<div class="mt-luoi">' + (dau ? nhan : "") + ds.map(tag).join("") + "</div>"; dau = false; return h1; }).join("");
            return phan ? '<div class="mt-cot' + (laNang ? "" : " phai") + '">' + phan + "</div>" : ""; };
          var n = cot(true), l = cot(false);
          return '<div class="hx-mt-ly">' + '<div class="mt-nn">' + n + (n ? l : l.replace("mt-cot phai", "mt-cot")) + "</div></div>"; })() + "</div>";
    }
    /* 15/10 user «máy nào không chạy đưa xuống dưới, ủn máy đang chạy/còn sống lên trên»: đang làm việc → sống chờ việc → sống nhưng Dừng → mất nhịp; cùng hạng theo điểm */
    // 15/10 chiều: laptop Dừng nhưng ĐANG LÀM THAY từng bị xếp dưới 2 máy rảnh → hạng theo ĐÚNG nhãn trên thẻ: «Đang làm việc» (kể cả làm thay) lên đầu
    var hangMay = function (m) { return !m.song ? 3 : (m.dangChay || []).length ? 0 : m.dung ? 2 : 1; };
    var mayXep = MTD.may.slice().sort(function (a, b) { return (hangMay(a) - hangMay(b)) || ((b.diem || 0) - (a.diem || 0)) || String(a.may).localeCompare(String(b.may)); });
    h += MTD.may.length ? '<div class="mt-tde"><span>Thông tin máy · sức khoẻ</span><span>Việc đảm nhận</span><span>Việc đang làm và kết quả</span></div><div class="mt-hang">' + mayXep.map(the).join("") + "</div>"
      : '<div class="panel"><div class="hx-trong">Chưa PC nào gửi nhịp tim. Cài bằng nút «Tải bộ cài PC» ở trang Tổng quan; PC gửi nhịp mỗi phút.</div></div>';
    if (!MAY_CHU && !phienTk() && mtPhien()) h += '<div style="text-align:center;margin:14px 0"><button type="button" class="hx-nut phu" id="mtDangXuat">Đăng xuất</button></div>';
    PANE.innerHTML = h;
    var dx = document.getElementById("mtDangXuat");
    if (dx) dx.onclick = function () { var mp = mtPhien(); try { localStorage.removeItem("mt-phien"); } catch (e) {} MTD = null; CAN_DN = true;
      if (mp) postGas({ action: "pcDangXuat", ph: mp.ph }).catch(function () {}); veDangNhap(); };
    /* 19/10 bảng việc nổi: mở 1 máy thì đóng máy khác; ✕ / bấm ra ngoài / Esc đóng (bắt ở document, gắn 1 lần — xem init) */
    var datMo = function (o, mo) { var n = o.querySelector(":scope > .mt-xo"); o.classList.toggle("mo", mo); if (n) { n.setAttribute("aria-expanded", String(mo)); if (mo) MT_MO[n.dataset.xo] = 1; else delete MT_MO[n.dataset.xo]; } };
    PANE.querySelectorAll("button[data-xo]").forEach(function (n) { n.onclick = function () { var o = n.closest(".mt-phai"), mo = !o.classList.contains("mo");
      PANE.querySelectorAll(".mt-phai.mo").forEach(function (k) { if (k !== o) datMo(k, false); }); datMo(o, mo); }; });
    PANE.querySelectorAll("button[data-xo-dong]").forEach(function (n) { n.onclick = function () { var o = n.closest(".mt-phai"); datMo(o, false); var b = o.querySelector(":scope > .mt-xo"); if (b) b.focus(); }; });
    var dc = PANE.querySelector("button[data-xo-chua]");
    if (dc) dc.onclick = function () { var o = dc.closest(".mt-chua"), mo = !o.classList.contains("mo"); o.classList.toggle("mo", mo); dc.setAttribute("aria-expanded", String(mo)); if (mo) MT_MO["_chua_"] = 1; else delete MT_MO["_chua_"]; };
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
        var dung = n.dataset.dung === "1", xoa = n.dataset.xoa === "1", capNhat = n.dataset.capnhat === "1", viec = n.dataset.viec || "", cu = n.textContent;
        if (dung && !window.confirm((viec ? "Tắt «" + tenV(viec) + "» trên " : "Dừng cả máy ") + n.dataset.may + "?" + (viec ? " Bộ điều phối sẽ chuyển việc này sang máy khác." : " Mọi việc của máy này sẽ chuyển sang máy khác."))) return;
        n.disabled = true; n.textContent = n.classList.contains("mt-x") ? "…" : "Đang gửi…";
        (MAY_CHU ? goi591("/api/may-tram/lenh", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ may: n.dataset.may, viec: viec, dung: dung, xoa: xoa, capNhat: capNhat }) })
          /* 14/10: không có 8591 (trình duyệt chặn gọi máy nội bộ / máy khác) → lệnh qua GAS bằng phiên tài khoản có quyền «làm» Xác minh */
          : postGas({ action: "pcLenhPh", ph: phienTk(), may: n.dataset.may, viec: viec, dung: dung, xoa: xoa, capNhat: capNhat }).then(function (j) { if (j.status !== "success") throw new Error(j.message || "Apps Script từ chối"); return j; }))
          .then(function (j) {
            if (typeof toast === "function") toast(capNhat ? "Đã gửi lệnh cập nhật — " + n.dataset.may + " tự lấy bản mới trong ~1–2 phút" : xoa ? "Đã gỡ " + n.dataset.may + " khỏi danh sách" : (dung ? (viec ? "Đã tắt " : "Đã dừng ") : (viec ? "Đã bật lại " : "Đã cho chạy lại ")) + (viec ? tenV(viec) + " trên " : "") + n.dataset.may + (j.daChuyen && j.daChuyen.length ? " — đang chuyển " + j.daChuyen.map(tenV).join(", ") + " sang máy khác" : ""), "ok");
            return tai().then(ve);
          })
          .catch(function (e) { if (typeof toast === "function") toast("Không gửi được lệnh: " + e.message, "loi"); })
          .finally(function () { if (document.body.contains(n)) { n.disabled = false; n.textContent = cu; } });
      };
    });
  }

  function dongNoi(ev) {   // 19/10: bấm ra ngoài bảng việc nổi / Esc → đóng
    if (!PANE) return;
    PANE.querySelectorAll(".mt-phai.mo").forEach(function (o) {
      if (ev.type === "keydown" ? ev.key !== "Escape" : o.contains(ev.target)) return;
      o.classList.remove("mo"); var n = o.querySelector(":scope > .mt-xo"); if (n) { n.setAttribute("aria-expanded", "false"); delete MT_MO[n.dataset.xo]; if (ev.type === "keydown") n.focus(); } });
  }
  document.addEventListener("click", dongNoi, true); document.addEventListener("keydown", dongNoi);
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
  window.HMAYTRAM = { init: init, coDuLieu: function () { return !!MTD; }, veLai: function () { if (MTD) ve(); } };   // veLai: vẽ lại như nhịp 30 s (bộ đo X3)
})();
