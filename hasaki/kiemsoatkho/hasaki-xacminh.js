/* hasaki-xacminh.js — tab «Xác minh & Cò camera» (Kiểm soát kho · HASAKI), module LAZY như hasaki-planogram.js.
 *
 *  User 02/10/2026: "xem ở g-sheet khó xem quá, cần có 1 dashboard… gom các việc liên quan đến wf 591, xác minh, treo,
 *  cò canh bãi xe và khu phân loại giấy — chứ k chờ có task rồi mới bắt; trước mắt là nv" → bản đầu (trang riêng) bị chê
 *  "giao diện k ổn, không chuyên nghiệp, không theo dự án audit hasaki" + "ảnh hiển thị gì thì bộ chọn hiển thị theo ảnh…
 *  ghi chú nv vi phạm là ai, vi phạm gì ở đâu" + "cần có thêm clip… biết vật thể/đối tượng từ đâu ra, di chuyển từ hướng nào".
 *  ⇒ tab này DÙNG LẠI khuôn của host: .kpi-band/.kb-tile · .filters + enhanceSelect · .panel/.table-wrap/.cardlist(.cl-item)
 *     · #modal (hienModal) · openLB · .badge. Không tự chế control.
 *
 *  DỮ LIỆU KHÔNG đi qua GitHub/GAS: chỉ đọc từ máy chủ nội bộ bang-591.mjs trên máy quản lý (http://127.0.0.1:8591) vì có mặt
 *  người + ảnh cổng bảo vệ. Máy khác mở trang công khai → tab chỉ báo "chỉ xem được trên máy quản lý", không lộ gì.
 *  API: HXACMINH.init(paneEl) — idempotent.
 */
(function () {
  "use strict";
  var API = (function () { try { return localStorage.getItem("hx-api") || window.HX_API || "http://127.0.0.1:8591"; } catch (e) { return window.HX_API || "http://127.0.0.1:8591"; } })();   // 19/10 HX_API = laptop hoặc đường hầm (index.html hxDoMayChu)
  var D = null, QDL = null, PANE = null, SUB = "nv", TIM = "", LOC = { khu: "", tt: "cho", ngay: "", buoc: "", treo: "" }, EV = null;
  try { var l0 = JSON.parse(localStorage.getItem("hx-loc") || "null"); if (l0) { SUB = l0.SUB || SUB; Object.assign(LOC, l0.LOC || {}); } } catch (e) {}
  if (!/^(treo|cam|tg)$/.test(SUB)) SUB = "treo";   // 12/10 user bỏ Khu giấy · rác, Nhắc QLTT, Nhân viên — máy còn nhớ mục cũ thì về Theo tác vụ
  function luu() { try { localStorage.setItem("hx-loc", JSON.stringify({ SUB: SUB, LOC: LOC })); } catch (e) {} }
  var $id = function (i) { return document.getElementById(i); };
  var e_ = function (s) { return (typeof esc === "function") ? esc(s) : String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  /* 12/10 user: "riêng phần xác minh cần cấp id và mật khẩu mới vô được" — phiên do máy chủ 8591 cấp sau khi đăng nhập
     (xacminh-dang-nhap.mjs). Gửi kèm MỌI yêu cầu: dữ liệu qua tiêu đề x-hx-phien, ảnh/clip qua tham số ?phien= (thẻ <img>/<video>
     không gửi được tiêu đề). Máy chủ trả 401 canDangNhap → về màn đăng nhập. */
  var PHIEN = (function () { try { return localStorage.getItem("hx-phien") || ""; } catch (e) { return ""; } })();
  window.addEventListener("hx-phien", function () { try { PHIEN = localStorage.getItem("hx-phien") || ""; } catch (e) {} });   // 13/10: đăng nhập ở tab Máy trạm cũng mở Xác minh
  var datPhien = function (v) { PHIEN = v || ""; try { if (PHIEN) localStorage.setItem("hx-phien", PHIEN); else localStorage.removeItem("hx-phien"); } catch (e) {} try { window.dispatchEvent(new CustomEvent("hx-phien")); } catch (e) {} };
  var u_ = function (p) { return p && p.charAt(0) === "/" ? API + p + (/^\/(anh|video|bc|cs)\//.test(p) ? (p.indexOf("?") < 0 ? "?" : "&") + "phien=" + PHIEN : "") : p; };
  var QD = ["Lập phiếu (NV Hasaki)", "Không phải NV Hasaki", "Xe ra / không vi phạm", "Không rõ – bỏ qua"];
  var tenLoai = function (l) { return l === "phan-loai" ? "Khu phân loại giấy" : "Bãi xe NCC"; };
  var ngayChu = function (s) { return String(s == null ? "" : s).replace(/\b(0[1-9]|1[0-2])-([0-3]\d)(?= \d{2}:\d{2})/g, "$2/$1"); };   // 13/10 chữ máy ghi "08-18 13:59" → "18/08 13:59" như mọi chỗ khác
  var soVN = function (n) { return String(n).replace(".", ","); };
  var hm = function (s) { return String(s || "").slice(0, 5); };
  var ngayVN = function (d) { var p = String(d || "").split("-"); return p.length === 3 ? p[2] + "/" + p[1] : d; };
  var giay = function (s) { var p = String(s || "0:0:0").split(":").map(Number); return p[0] * 3600 + p[1] * 60 + (p[2] || 0); };
  var hms = function (n) { n = Math.max(0, Math.round(n)); return [Math.floor(n / 3600), Math.floor(n / 60) % 60, n % 60].map(function (v) { return String(v).padStart(2, "0"); }).join(":"); };

  /* ---------- CSS: chỉ phần riêng của tab; mọi màu/khối qua token host (--surface/--border/--accent/--bad/--warn/--good) ---------- */
  function napCss() {
    if ($id("hx-css")) return;
    var c = [
      /* 10/10 GIẬT LAG: dòng/thẻ ngoài màn hình không tính kiểu + bố cục (đo máy chậm ×4: đổi mục 579 → 385 ms) */
      "#pane-xacminh tbody tr,#pane-xacminh .cl-item{content-visibility:auto;contain-intrinsic-size:auto 120px}",
      ".hx-muc{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:flex-end;justify-content:space-between;margin:4px 0 12px}",
      ".hx-muc h2{margin:0;font-size:20px;font-weight:800;color:var(--text)}",
      ".hx-dn{max-width:400px;margin:24px auto}.hx-dn form{display:flex;flex-direction:column;gap:12px;padding:16px}",
      ".hx-dn label{display:flex;flex-direction:column;gap:4px}.hx-dn input{min-height:40px;font-size:16px}",
      ".hx-dx{min-height:40px;font-size:13px;padding:0 14px;align-self:center}",
      ".hx-muc .muted{font-size:13px}",
      ".hx-chuyen{display:flex;flex-direction:column;gap:3px;min-width:220px}",
      "body.side-open .hx-chuyen{display:none}",
      "@media(max-width:900px){body.side-open .hx-chuyen{display:flex}.hx-chuyen{width:100%}}",
      ".hx-seg{display:flex;gap:6px;flex-wrap:wrap;margin:2px 0 12px}",
      ".hx-seg button{border:1px solid var(--border);background:var(--surface);color:var(--muted);border-radius:999px;padding:7px 16px;min-height:40px;font-weight:650;font-size:13px;cursor:pointer;transition:.18s var(--ease,ease)}",
      ".hx-seg button.on{background:var(--accent);border-color:var(--accent);color:var(--accent-text,#fff)}",
      ".hx-seg button .n{margin-left:6px;font-variant-numeric:tabular-nums;opacity:.8}",
      ".hx-th{width:120px;height:68px;border-radius:8px;object-fit:cover;border:1px solid var(--border);display:block;background:var(--surface2)}",
      ".hx-tag{display:inline-block;font-size:11px;font-weight:700;border-radius:20px;padding:2px 8px;margin:0 4px 2px 0;border:1px solid var(--border);background:var(--surface2);color:var(--muted);white-space:nowrap}",
      ".hx-tag.bad{color:var(--bad);border-color:color-mix(in srgb,var(--bad) 40%,transparent);background:color-mix(in srgb,var(--bad) 9%,transparent)}",
      ".hx-tag.warn{color:var(--warn);border-color:color-mix(in srgb,var(--warn) 40%,transparent);background:color-mix(in srgb,var(--warn) 10%,transparent)}",
      ".hx-tag.good{color:var(--good);border-color:color-mix(in srgb,var(--good) 40%,transparent);background:color-mix(in srgb,var(--good) 9%,transparent)}",
      /* 20/10 user «mục đã ghi chú (chờ / đang / đã cải tiến) cần cờ nhận biết — loại bỏ — làm mờ»: hàng mờ, dồn cuối danh sách, rê chuột/chạm thì rõ lại */
      ".hx-gc-mo{opacity:.5;transition:opacity .15s}.hx-gc-mo:hover,.hx-gc-mo:focus-within{opacity:1}.hx-gc-co{margin-top:4px}",
      ".hx-tag.info{color:var(--info,var(--accent));border-color:color-mix(in srgb,var(--info,var(--accent)) 35%,transparent)}",
      ".hx-l2{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}",
      "#pane-xacminh tbody tr{cursor:pointer}",
      ".hx-trong{padding:28px 18px;text-align:center;color:var(--muted)}",
      /* pop-up lượt camera */
      ".hx-ev{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:16px;align-items:start}",
      "@media(max-width:900px){.hx-ev{grid-template-columns:minmax(0,1fr)}}",
      ".hx-ev>div{min-width:0}",
      ".hx-vwrap{position:relative;background:#000;border-radius:12px;overflow:hidden;aspect-ratio:16/9}",
      ".hx-vwrap video,.hx-vwrap canvas{position:absolute;inset:0;width:100%;height:100%}",
      ".hx-vwrap canvas{pointer-events:none}",
      ".hx-vbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px}",
      ".hx-vbar .gio{font-variant-numeric:tabular-nums;font-weight:700;min-width:74px}",
      ".hx-vbar button{border:1px solid var(--border);background:var(--surface);color:var(--text);border-radius:8px;min-height:40px;padding:0 12px;cursor:pointer;font-size:13px}",
      ".hx-vbar button.on{background:var(--accent);border-color:var(--accent);color:var(--accent-text,#fff)}",
      ".hx-tl{position:relative;height:30px;margin-top:8px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;cursor:pointer;overflow:hidden}",
      ".hx-tl .dn{position:absolute;top:0;bottom:0;background:color-mix(in srgb,var(--bad) 30%,transparent);border-left:2px solid var(--bad)}",
      ".hx-tl .mk{position:absolute;top:3px;width:2px;bottom:3px;background:var(--accent)}",
      ".hx-tl .cur{position:absolute;top:0;bottom:0;width:2px;background:var(--text)}",
      ".hx-tlg{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}",
      ".hx-tlg button{border:1px solid color-mix(in srgb,var(--bad) 40%,transparent);background:color-mix(in srgb,var(--bad) 8%,transparent);color:var(--bad);border-radius:999px;min-height:36px;padding:0 12px;font-size:12px;font-weight:650;cursor:pointer}",
      ".hx-buoc{display:flex;gap:8px;overflow-x:auto;margin-top:10px;padding-bottom:4px}",
      ".hx-buoc figure{flex:0 0 150px;margin:0;cursor:pointer}",
      ".hx-buoc img{width:150px;height:84px;object-fit:cover;border-radius:8px;border:1px solid var(--border);display:block}",
      ".hx-buoc figcaption{font-size:11px;color:var(--muted);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".hx-buoc figure.ng figcaption{color:var(--bad);font-weight:700}",
      ".hx-hoi{font-weight:700;font-size:14px;padding:10px 12px;border-radius:10px;background:color-mix(in srgb,var(--warn) 12%,transparent);border:1px solid color-mix(in srgb,var(--warn) 35%,transparent);margin-bottom:10px}",
      ".hx-ng{display:grid;grid-template-columns:92px minmax(0,1fr);gap:10px;padding:10px;border:1px solid var(--border);border-radius:12px;background:var(--surface);margin-bottom:10px}",
      ".hx-ng.khong{opacity:.55}",
      ".hx-crop{width:92px;height:122px;border-radius:8px;border:2px dashed var(--bad);background-repeat:no-repeat;background-color:var(--surface2);cursor:zoom-in}",
      ".hx-ng .ten{font-weight:800;color:var(--bad);font-size:13px;margin-bottom:6px}",
      ".hx-f{display:block;margin-bottom:8px}",
      ".hx-f .lbl{display:block;font-size:11px;color:var(--muted);margin-bottom:3px}",
      ".hx-f textarea{width:100%;box-sizing:border-box;min-height:40px;border:1px solid var(--border);border-radius:8px;padding:8px 10px;background:var(--surface);color:var(--text);font:inherit;font-size:13.5px;line-height:1.4;resize:none;overflow:hidden}",
      ".hx-f input[type=text]{width:100%;min-height:40px;border:1px solid var(--border);border-radius:8px;padding:0 10px;background:var(--surface);color:var(--text)}",
      ".hx-cau{font-size:12px;color:var(--muted);margin-top:4px;line-height:1.35}",
      ".hx-chk{display:flex!important;flex-direction:row!important;align-items:center;justify-content:flex-start;gap:10px;min-height:40px;font-size:13px;cursor:pointer;text-align:left;margin:0}",
      ".hx-chk input{width:20px;height:20px;flex:none;margin:0}",
      ".hx-cb{position:relative}",
      ".hx-cb .menu{position:absolute;top:calc(100% + 4px);left:0;right:0;z-index:80;background:var(--surface);border:1px solid var(--border);border-radius:11px;box-shadow:0 24px 60px rgba(16,24,40,.28);max-height:300px;overflow-y:auto;padding:5px;display:none}",
      ".hx-cb.show .menu{display:block;animation:popIn .18s var(--ez-spring,ease)}",
      ".hx-it{display:flex;gap:9px;align-items:center;padding:6px 8px;border-radius:8px;cursor:pointer;min-height:44px}",
      ".hx-it:hover{background:color-mix(in srgb,var(--accent) 10%,transparent)}",
      ".hx-it img{width:34px;height:46px;border-radius:6px;object-fit:cover;flex:none;background:var(--surface2)}",
      ".hx-it .t{font-size:13px;font-weight:650;line-height:1.25}",
      ".hx-it .s{font-size:11px;color:var(--muted)}",
      ".hx-it .star{color:var(--warn);font-weight:800}",
      ".hx-it.h{font-size:11px;font-weight:700;color:var(--muted);min-height:0;cursor:default;padding:6px 8px 2px}",
      ".hx-it.h:hover{background:none}",
      ".hx-chot{border:1px solid var(--border);border-radius:12px;padding:10px 12px;background:var(--surface2);font-size:13px;margin:4px 0 10px}",
      ".hx-chot b{color:var(--text)} .hx-chot .r{margin:3px 0}",
      ".hx-act{display:grid;grid-template-columns:1fr 1fr;gap:8px}",
      ".hx-act button{min-height:44px;border-radius:10px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-weight:650;cursor:pointer;font-size:13px}",
      ".hx-act button.chinh{background:var(--accent);border-color:var(--accent);color:var(--accent-text,#fff);grid-column:1/-1}",
      ".hx-act button.on{box-shadow:inset 0 0 0 2px var(--accent)}",
      ".hx-act button[disabled]{opacity:.5;cursor:default}",
      ".hx-st{margin-top:10px;font-size:13px;padding:8px 12px;border-radius:10px;background:var(--surface2)}",
      ".hx-st.ok{background:color-mix(in srgb,var(--good) 12%,transparent);color:var(--good)}",
      ".hx-st.loi{background:color-mix(in srgb,var(--bad) 10%,transparent);color:var(--bad)}",
      ".hx-viec{padding:10px 0;border-top:1px solid var(--border);display:flex;gap:10px;align-items:flex-start}",
      ".hx-viec:first-child{border-top:0}",
      ".hx-viec .noi{flex:1;min-width:0}",
      ".hx-viec a,.hx-viec button{flex:none}",
      /* 05/10 tab con Khu giấy · rác (luật PL-01/PL-03) */
      ".hx-khu{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(340px,100%),1fr));gap:14px;margin-bottom:14px}",
      ".hx-khu .panel-head .ma{font-size:12px;color:var(--muted);font-weight:500;font-variant-numeric:tabular-nums}",
      ".hx-moc{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:12px 16px 4px}",
      ".hx-moc figure{margin:0}",
      ".hx-moc img,.hx-moc .trong{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:8px;border:1px solid var(--border);display:block;background:var(--surface2);cursor:zoom-in}",
      ".hx-moc .trong{display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--muted);cursor:default;text-align:center;padding:6px;box-sizing:border-box}",
      ".hx-moc figcaption{font-size:12px;color:var(--muted);margin-top:3px}",
      ".hx-ngu{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 12px;align-items:center;padding:9px 16px;border-top:1px solid var(--border)}",
      ".hx-ngu .s{font-size:12px;color:var(--muted)}",
      ".hx-ngu .dong{grid-column:1/-1;font-size:12px;color:var(--muted)}",
      ".hx-them{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;padding:12px 16px}",
      ".hx-them label{display:flex;flex-direction:column;gap:3px;flex:1 1 260px;min-width:0}",
      ".hx-them input{min-height:40px;border:1px solid var(--border);border-radius:8px;padding:0 10px;background:var(--surface);color:var(--text)}",
      ".hx-them button{min-height:40px;border-radius:10px;border:1px solid var(--accent);background:var(--accent);color:var(--accent-text,#fff);font-weight:650;padding:0 16px;cursor:pointer}",
      ".hx-chung{table-layout:fixed;width:100%;min-width:0}.hx-chung td{vertical-align:top}",
      /* 12/10 user: "căn khoảng cách giữa các cột… không bị khoảng trống, lãng phí không gian" — trên máy tính bỏ chia cột % cố định:
         bảng tự chia theo nội dung (cột ngắn như Mã/Lúc/Phiếu/Task vừa khít chữ, cột chữ dài như Lỗi/Việc đang có/Nội dung nhận phần dư).
         Điện thoại giữ nguyên (thẻ). */
      "@media(min-width:769px){#pane-xacminh .table-wrap>table{table-layout:auto!important}#pane-xacminh .table-wrap>table>thead th{width:auto!important;white-space:nowrap}" +
        /* cột mã · tên · giờ · số phiếu giữ 1 dòng (mã vị trí F0-A1-5L2-… bị bẻ ở dấu gạch thành 3 dòng); chỉ máy tính nên dùng vị trí cột được */
        ".hx-chung td{overflow-wrap:break-word}.hx-chung .hx-vt{white-space:nowrap}" +
        ".hx-t-nv td:nth-child(2),.hx-t-nv td:nth-child(4)," +
        ".hx-t-nhac td:nth-child(1),.hx-t-nhac td:nth-child(2),.hx-t-nhac td:nth-child(5),.hx-t-nhac td:nth-child(7)," +
        ".hx-t-tg td:nth-child(1),.hx-t-tg td:nth-child(2),.hx-t-tg td:nth-child(3),.hx-t-tg td:nth-child(4){white-space:nowrap!important}}",   // !important: ô Nhắc QLTT có style viết thẳng white-space:normal
      ".hx-chung td{white-space:normal;overflow-wrap:anywhere}.hx-chung .hx-tag{white-space:normal;max-width:100%}.hx-bc{display:flex;flex-direction:column;gap:6px;min-width:0}.hx-bc .hx-th{width:100%;max-width:150px;height:auto;aspect-ratio:16/10;cursor:zoom-in}.hx-bc>div{display:flex;flex-wrap:wrap;gap:4px;min-width:0}",
      ".hx-vthumb{position:relative;display:block;width:100%;max-width:170px;aspect-ratio:16/9;border:1px solid var(--border);border-radius:8px;overflow:hidden;background:#000;padding:0;cursor:pointer}.hx-vthumb video{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}.hx-vthumb .pl{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:26px;text-shadow:0 2px 8px rgba(0,0,0,.7)}.hx-mini{width:56px;height:40px;object-fit:cover;border-radius:6px;border:1px solid var(--border);cursor:zoom-in}",
      ".hx-tra{list-style:none;margin:6px 0 10px;padding:0;display:grid;gap:4px}.hx-tra li{display:grid;grid-template-columns:20px minmax(0,1fr);gap:2px 8px;font-size:13px;padding:6px 8px;border-radius:8px;background:var(--surface2)}.hx-tra li::before{content:\"–\";grid-row:span 2;color:var(--muted);font-weight:800;text-align:center}.hx-tra li.co::before{content:\"✓\";color:var(--good)}.hx-tra li span{grid-column:2;color:var(--muted);font-size:12px}",
      ".hx-qd{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:16px;align-items:start}@media(max-width:900px){.hx-qd{grid-template-columns:minmax(0,1fr)}}",
      /* 16/10 user (video 13.10.48 — khung việc HasakiWork): Quyết định phiếu Theo tác vụ = THANH BÊN PHẢI trượt ra/ẩn vô, KHÔNG phủ nền —
         khi thanh đang mở vẫn bấm được dòng khác bên trái (đổi nội dung tại chỗ), không phải đóng rồi mới chọn. */
      /* 16/10 (2) user «còn nhiều khoảng trống — xấu», «tăng kích thước ra bên trái thêm», «hạ cỡ chữ giống work.hasaki»: mép trái thanh chỉ chừa
         cột «Ở đâu · lúc» + đầu cột Lỗi để bấm dòng; danh sách «Ai tác động» xuống DƯỚI video (lấp chỗ trống); chữ 11–12,5px như khung việc work */
      /* vỏ thanh bên (#modal.hx-ben: trượt, không phủ nền, đầu thanh, tô dòng) đã chuyển lên index.html dùng chung với Vi phạm — 16/10 */
      "#modal.hx-ben .hx-qd{display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:0;padding:0!important;align-items:stretch}" +
        "#modal.hx-ben .hx-cot{display:flex;flex-direction:column;min-width:0}#modal.hx-ben .hx-cot-phai{border-left:1px solid var(--ad-chia,var(--border))}" +
        "#modal.hx-ben .hx-qd-xem{padding:16px 24px 0;min-width:0}#modal.hx-ben .hx-qd-anh{padding:16px 24px 0}#modal.hx-ben .hx-qd-ls{padding:20px 24px 24px;min-width:0}" +
        /* Quyết định dưới video: hàng ngang Quyết định · Gán người khác · Lưu (luật ngang hàng khi còn chỗ), rồi vạch + Lỗi / Máy gợi ý */
        "#modal.hx-ben .hx-qd-ben{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto;align-items:end;gap:8px 12px;padding:12px 24px 16px}" +
        /* 16/10 (6) user «làm gọn — khoảng cách dòng để trống nhiều»: Lỗi / Máy gợi ý = Descriptions NGANG (nhãn trái 80px), dòng sát nhau */
        "#modal.hx-ben .hx-qd-ben>div.hx-qd-o{display:grid;grid-template-columns:80px minmax(0,1fr);gap:8px;align-items:baseline}#modal.hx-ben .hx-qd-ben>div.hx-qd-o>.lbl{margin:0}" +
        "#modal.hx-ben .hx-qd-ben>#qdLuu+#qdMsg+*{padding-top:10px!important}#modal.hx-ben .hx-qd-ben .hx-qd-form .lbl{margin-bottom:2px}" +
        "#modal.hx-ben .hx-lan .ai,#modal.hx-ben .hx-lan .ai small{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#modal.hx-ben .hx-lan{min-height:44px;padding:4px 8px}" +
        "#modal.hx-ben .hx-visao:not(.mo){-webkit-line-clamp:2}#modal.hx-ben .hx-qd-loi:not(.mo){display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;cursor:pointer}#modal.hx-ben .hx-qd-loi{cursor:pointer}@media(min-width:761px){#modal.hx-ben .hx-qd-khung video,#modal.hx-ben .hx-qd-khung>img{max-height:max(240px,calc(100vh - 470px))}#modal.hx-ben .hx-lui{max-width:calc(max(240px,calc(100vh - 470px)) * 1.633);margin:0 auto}}" +
        "#modal.hx-ben .hx-xdau{margin:8px 0 0!important}#modal.hx-ben .hx-qd-ls .hx-lans{overflow-y:auto!important;overscroll-behavior:auto}" +
        "#modal.hx-ben .hx-qd-ben>*{grid-column:1/-1}#modal.hx-ben .hx-qd-form{display:contents}#modal.hx-ben .hx-qd-form>.hx-qd-o:first-child{grid-column:1}#modal.hx-ben .hx-qd-form>.hx-qd-o:nth-child(2){grid-column:2}" +
        "#modal.hx-ben .hx-qd-ben>#qdLuu{grid-column:3;width:auto!important;padding:0 16px;white-space:nowrap}" +
        /* Ảnh ghi nhận cột phải: ảnh vừa khung, bấm phóng to */
        "#modal.hx-ben .hx-qd-anh{position:relative;margin:16px 24px 0;padding:0!important;border-radius:8px;overflow:hidden;background:var(--ad-nen2,#f5f5f5)}" +
        "#modal.hx-ben .hx-qd-anh .lbl{position:absolute;top:8px;left:8px;z-index:1;margin:0;padding:2px 8px;border-radius:4px;background:color-mix(in srgb,#000 60%,transparent);color:#fff!important;font-size:12px!important;font-weight:400}" +
        "#modal.hx-ben .hx-qd-anh.khoa img{height:100%;max-height:none}#modal.hx-ben .hx-qd-anh:not(.khoa){min-height:160px}" +
        "#modal.hx-ben .hx-qd-anh img{display:block;width:100%;max-height:300px;object-fit:contain;cursor:zoom-in}" +
        /* Theo máy trong thanh bên: điều khiển dưới clip, mốc 1 hàng cuộn ngang; vạch ngăn trước Lỗi */
        "#modal.hx-ben .hx-qd-luot .hx-qd-anh{min-height:0!important;background:transparent}#modal.hx-ben .hx-qd-luot .hx-qd-anh img{max-height:none;height:auto;aspect-ratio:16/9;object-fit:contain;background:#000}#modal.hx-ben .hx-qd-luot .hx-qd-nguoi{padding-top:12px}" +
        /* 16/10 (8) user «hiển thị lại cho gọn — các nút quá rộng»: điều khiển + mốc 1 hàng (ngang hàng khi còn chỗ); nút quyết cỡ theo chữ, 1 hàng */
        "#modal.hx-ben .hx-qd-luot #lvClip{display:flex;flex-wrap:wrap;align-items:center;gap:8px}#modal.hx-ben .hx-qd-luot #lvClip>.hx-vwrap,#modal.hx-ben .hx-qd-luot #lvClip>.hx-tl{flex:0 0 100%;margin:0}" +
        "#modal.hx-ben .hx-qd-luot #lvClip>.hx-xdau{flex:0 0 auto;margin:0!important}#modal.hx-ben .hx-qd-luot #lvClip>.hx-mocs{flex:0 1 auto;max-width:100%;margin:0!important;padding:0}" +
        "#modal.hx-ben .hx-qd-luot .hx-qd-nut{display:grid!important;grid-template-columns:80px minmax(0,1fr);gap:8px;align-items:center}#modal.hx-ben .hx-qd-luot .hx-qd-nut>.lbl{margin:0!important}" +
        "#modal.hx-ben .hx-qd-luot .hx-act{display:flex!important;flex-wrap:wrap;gap:8px}#modal.hx-ben .hx-qd-luot .hx-act button{flex:none;width:auto;min-height:32px;padding:0 12px;border-radius:6px;font-weight:400;grid-column:auto!important}#modal.hx-ben .hx-qd-luot .hx-act button.chinh{font-weight:600}" +
        "@media(max-width:760px){#modal.hx-ben .hx-qd-luot .hx-act button{min-height:44px}}#modal.hx-ben .hx-vwrap{border-radius:8px}@media(min-width:761px){#modal.hx-ben .hx-qd-luot #lvClip{max-width:calc(max(240px,calc(100vh - 470px)) * 16 / 9);margin:0 auto}}#modal.hx-ben .hx-qd-luot .hx-chot{margin:0 0 8px!important;padding:6px 10px;border:0;border-radius:6px}#modal.hx-ben .hx-qd-luot .hx-hoi{font-size:13px!important;font-weight:400;padding:6px 10px;margin:0 0 8px;border:0;border-radius:6px}#modal.hx-ben .hx-qd-luot .hx-tl{margin:8px 0 0}#modal.hx-ben .hx-qd-luot .hx-mocs{margin:8px 0 0}" +
        "#modal.hx-ben .hx-chia{border-top:1px solid var(--ad-chia,var(--border));padding-top:10px}#modal.hx-ben .hx-qd-luot .hx-chot{margin:0}" +
        "#modal.hx-ben .hx-ds-ng{overflow-y:auto;overflow-x:hidden;overscroll-behavior:auto}#modal.hx-ben .hx-qd-luot .hx-qd-nut{display:block}#modal.hx-ben .hx-qd-luot .hx-qd-nut>.lbl{margin-bottom:4px}" +
        /* Segmented chọn nguồn xem (chọn 1 trong vài — đúng khuôn SEG của lớp antd, KHÔNG phải điều hướng) */
        "#modal.hx-ben .hx-xdau{margin-bottom:12px;gap:12px}#modal.hx-ben .hx-qd-nguon{margin:0;gap:2px;padding:2px;border-radius:6px;background:color-mix(in srgb,var(--text) 7%,var(--surface));flex-wrap:wrap}" +
        "#modal.hx-ben .hx-qd-nguon button{border:0;background:transparent;border-radius:4px!important;padding:0 12px;color:var(--muted);box-shadow:none;font-weight:400}" +
        "#modal.hx-ben .hx-qd-nguon button:hover{color:var(--text)}#modal.hx-ben .hx-qd-nguon button.on{background:var(--surface);color:var(--text);font-weight:600!important;box-shadow:0 1px 2px color-mix(in srgb,#000 12%,transparent)}" +
        "#modal.hx-ben .hx-qd-khung{border-radius:8px}" +
        /* List lượt: hàng phẳng, vạch ngang 1px, chọn = nền --ad-chon (như hàng chọn của Table antd) */
        "#modal.hx-ben .hx-qd-ls .lbl{font-size:14px!important;font-weight:600;color:var(--text);margin-bottom:8px}#modal .hx-ng-chung{font-weight:400;color:var(--muted);font-size:12px}" +
        "#modal.hx-ben .hx-qd-ls .hx-lans{max-height:none;overflow:visible;display:flex;flex-direction:column;gap:0;border-top:1px solid var(--ad-chia,var(--border))}" +
        "#modal.hx-ben .hx-lan{border:0;border-bottom:1px solid var(--ad-chia,var(--border));border-radius:0!important;background:transparent;min-height:48px;padding:6px 8px}" +
        "#modal.hx-ben .hx-lan:hover{background:var(--ad-nen2,transparent)}#modal.hx-ben .hx-lan.on{background:var(--ad-chon)}#modal.hx-ben .hx-lan.vl{background:color-mix(in srgb,var(--warn) 8%,var(--surface))}" +
        "#modal.hx-ben .hx-lan .gio{font-weight:600;min-width:88px}#modal.hx-ben .hx-lan .pl{width:24px;height:24px;font-size:10px}" +
        /* Form dọc + Descriptions */
        "#modal.hx-ben .hx-qd-o .lbl{margin-bottom:4px}#modal.hx-ben .hx-qd-nguon:empty,#modal.hx-ben .hx-qd-khung[hidden]{display:none}" +
        "#modal.hx-ben #qdMsg{min-height:0;margin-top:-4px}#modal.hx-ben #qdMsg:empty{display:none}" +
        "#modal.hx-ben .hx-qd-ben>#qdLuu+#qdMsg:empty+*,#modal.hx-ben .hx-qd-ben>#qdLuu+#qdMsg:not(:empty)+*{border-top:1px solid var(--ad-chia,var(--border));padding-top:16px}" +
        "#modal.hx-ben .hx-qd-tt{font-weight:400;border-radius:8px}" +
      /* 17/10 bố cục thanh bên theo KHUNG (tbAp): lưới 12 cột khung, vạch ngăn giữa khung; trong khung lưới 12 cột thành phần */
      "#modal.hx-ben .hx-tb-luoi{display:grid!important;grid-template-columns:repeat(12,minmax(0,1fr));gap:0;padding:0!important;align-items:stretch}" +
        "#modal.hx-ben .hx-tb-khung{grid-column:span var(--tb-rong,12);min-width:0;display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:10px 12px;align-content:start;align-items:start;padding:16px 24px}" +
        "#modal.hx-ben .hx-tb-khung.tb-trai{border-left:1px solid var(--ad-chia,var(--border))}#modal.hx-ben .hx-tb-khung.tb-tren{border-top:1px solid var(--ad-chia,var(--border))}#modal.hx-ben .hx-tb-khung[data-trong]{display:none}" +
        "#modal.hx-ben .hx-tb-tp{grid-column:span var(--tb-rong,12);min-width:0}#modal.hx-ben .hx-tb-tp:empty,#modal.hx-ben .hx-tb-tp[data-tb-an]{display:none}" +
        "#modal.hx-ben .hx-tb-luoi .hx-qd-anh{margin:0}#modal.hx-ben .hx-tb-luoi .hx-qd-nguoi{padding:0}#modal.hx-ben .hx-tb-luoi .hx-xdau{margin:0!important}#modal.hx-ben .hx-tb-luoi .hx-mocs{flex-wrap:wrap;overflow:visible;margin:0!important;padding:0}" +
        "#modal.hx-ben .hx-tb-luoi .hx-tb-mt{display:grid;grid-template-columns:80px minmax(0,1fr);gap:8px;align-items:baseline}#modal.hx-ben .hx-tb-luoi .hx-tb-mt>.lbl{margin:0}" +
        "#modal.hx-ben .hx-tb-luoi .hx-qd-nguoi>.lbl{font-size:14px!important;font-weight:600;color:var(--text);margin-bottom:8px}#modal.hx-ben .hx-tb-luoi .hx-st{margin:0}" +
        /* 17/10 (2) Quyết định: nhãn trên, 3 chip ngang hàng chia đều, «Lưu · lập phiếu» cả hàng ở dưới; thanh thời gian cao hơn, đoạn có người đỏ rõ, mốc số tròn */
        "#modal.hx-ben .hx-qd-luot.hx-tb-luoi .hx-qd-nut{display:block!important}#modal.hx-ben .hx-qd-luot.hx-tb-luoi .hx-qd-nut>.lbl{display:block;margin:0 0 6px!important}" +
        "#modal.hx-ben .hx-qd-luot.hx-tb-luoi .hx-act{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}" +
        "#modal.hx-ben .hx-qd-luot.hx-tb-luoi .hx-act button{width:100%;min-width:0;padding:4px 2px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px!important}#modal.hx-ben .hx-qd-luot.hx-tb-luoi .hx-act button.chinh,#modal.hx-ben .hx-qd-luot.hx-tb-luoi .hx-act button[data-qd='-1']{grid-column:1/-1!important}" +
        "#modal.hx-ben .hx-qd-luot.hx-tb-luoi .hx-act button.chinh{min-height:36px}" +
        "#modal.hx-ben .hx-tb-luoi .hx-tl{height:22px!important;overflow:visible}#modal.hx-ben .hx-tb-luoi .hx-tl .dn{background:color-mix(in srgb,var(--bad) 55%,transparent);border-left:0;border-radius:2px}" +
        "#modal.hx-ben .hx-tb-luoi .hx-tl .mk{top:0;bottom:0;width:1px;background:color-mix(in srgb,var(--text) 45%,transparent)}" +
        "#modal.hx-ben .hx-tb-luoi .hx-tl .mkn{position:absolute;top:50%;z-index:2;transform:translate(-50%,-50%);width:18px;height:18px;min-height:0!important;padding:0;border-radius:50%;border:1px solid var(--surface);background:var(--text);color:var(--surface);font-size:11px;line-height:16px;font-weight:600;cursor:pointer}" +
        "#modal.hx-ben .hx-tb-luoi .hx-tl .mkn.ng{background:var(--bad);color:#fff}#modal.hx-ben .hx-tb-luoi .hx-tl .cur{z-index:1}" +
        /* 17/10 (3) thanh thời gian + điều khiển GỌN cùng 1 hàng (điều khiển bên phải) */
        "#modal.hx-ben .hx-tb-luoi .hx-tl-hang{flex:0 0 100%;display:flex;align-items:center;gap:8px;min-width:0;flex-wrap:wrap}#modal.hx-ben .hx-tb-luoi .hx-tl-hang>.hx-tl{flex:1 1 160px;margin:0!important;min-width:120px}" +
        "#modal.hx-ben .hx-tb-luoi .hx-tl-hang .hx-xdau{flex:none;margin:0!important;gap:0}#modal.hx-ben .hx-tb-luoi .hx-tl-hang .hx-vbar{gap:6px;padding:0;border:0;background:transparent}" +
        "#modal.hx-ben .hx-tb-luoi .hx-tl-hang .hx-vbar button,#modal.hx-ben .hx-tb-luoi .hx-tl-hang .hx-toc button{min-height:24px!important;height:24px;padding:0 6px!important;font-size:12px!important;line-height:22px}" +
        "#modal.hx-ben .hx-tb-luoi .hx-tl-hang #hxPlay{width:24px;padding:0!important;border-radius:4px}#modal.hx-ben .hx-tb-luoi .hx-tl-hang .gio{font-size:12px!important;font-variant-numeric:tabular-nums;min-width:56px}" +
        "#modal.hx-ben .hx-tb-luoi .hx-tl-hang .hx-toc{border-radius:4px}" +
        /* 17/10 (3) Lỗi / Máy gợi ý hiện như chữ thường, bấm vào mới thành ô chọn (khung + menu) */
        "#modal.hx-ben .hx-ng-gon{display:flex!important;flex-direction:column;gap:6px;padding:0;border:0;background:transparent;grid-template-columns:none}#modal.hx-ben .hx-ng-gon+.hx-ng-gon{border-top:1px solid var(--ad-chia,var(--border));padding-top:10px;margin-top:4px}" +
        "#modal.hx-ben .hx-ng-gon>.ten{display:flex;flex-wrap:wrap;align-items:center;gap:4px 12px;font-size:13px;font-weight:600}#modal.hx-ben .hx-ng-gon>.ten .hx-chk{margin:0;font-weight:400}" +
        "#modal.hx-ben .hx-o-an{margin:0;align-items:start!important}#modal.hx-ben .hx-o-an>.lbl{padding-top:4px}#modal.hx-ben .hx-o-an .hx-cb{min-width:0}" +
        "#modal.hx-ben .hx-o-an :is(input,textarea){display:block;width:100%;min-height:28px!important;padding:3px 6px!important;margin:0;border:1px solid transparent!important;background:transparent!important;box-shadow:none!important;resize:none;font:inherit;font-size:13px!important;color:var(--text);cursor:pointer;overflow:hidden;box-sizing:border-box;max-width:100%}#modal.hx-ben .hx-o-an textarea{width:100%}" +
        "#modal.hx-ben .hx-o-an :is(input,textarea):hover{background:var(--ad-nen2,#f5f5f5)!important}#modal.hx-ben .hx-o-an :is(input,textarea):focus{border-color:var(--accent)!important;background:var(--surface)!important;cursor:text;outline:0;box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 18%,transparent)!important}" +
        "#modal.hx-ben .hx-o-an .hx-cb{position:relative}#modal.hx-ben .hx-o-an .hx-cb:has(>input){width:fit-content;max-width:100%}#modal.hx-ben .hx-o-an:has(.hx-cb-xoa) :is(input,textarea){padding-right:26px!important}" +
        "#modal.hx-ben .hx-cb-xoa{position:absolute;top:3px;right:0;z-index:2;width:22px;height:22px;min-height:0!important;padding:0;border:0;border-radius:50%;background:transparent;color:var(--muted);font-size:12px;line-height:22px;cursor:pointer}" +
        "#modal.hx-ben .hx-cb-xoa:hover{background:var(--hover,var(--ad-nen2));color:var(--text)}#modal.hx-ben .hx-cb:has(>:is(input,textarea):placeholder-shown)>.hx-cb-xoa{display:none}" +
        "#modal.hx-ben .hx-o-an input{font-weight:600;field-sizing:content;min-width:120px;width:auto}#modal.hx-ben .hx-ai-phu{grid-column:2;margin-top:-6px;min-height:16px}#modal.hx-ben .hx-ai-phu{align-self:center;font-size:12px;color:var(--muted)}#modal.hx-ben .hx-ai-phu:empty{display:block}" +
        /* 17/10 (4) Quyết định dính đáy thanh · Sẽ ghi nhận canh giữa phần còn lại của khung Ảnh ghi nhận · Theo tác vụ trong khung */
        "#modal.hx-ben .hx-tb-luoi>.hx-tb-khung>[data-tp=quyetdinh]{position:sticky;bottom:0;z-index:6;background:var(--surface);padding:12px 0 4px;box-shadow:0 -1px 0 var(--ad-chia,var(--border))}" +
        "#modal.hx-ben .hx-tb-luoi>.hx-tb-khung:has(>[data-tp=quyetdinh]){padding-bottom:12px}" +
        "#modal.hx-ben .hx-tb-luoi>.hx-tb-khung:has(>[data-tp=quyetdinh]){display:flex;flex-direction:column;align-items:stretch;gap:10px}" +
        "#modal.hx-ben .hx-tb-luoi>.hx-tb-khung:has(>[data-tp=quyetdinh])>.hx-tb-tp{width:calc(var(--tb-rong,12) * 100% / 12);align-self:flex-start}#modal.hx-ben .hx-tb-luoi>.hx-tb-khung>[data-tp=quyetdinh]{margin-top:auto}" +
        /* clip: ô 16:9 kín bề rộng khung, cùng 1 cỡ ở Theo máy (video + lớp khung đỏ) và Theo tác vụ (video / ảnh camera) */
        "#modal.hx-ben .hx-qd-luot.hx-tb-luoi #lvClip{max-width:none!important;margin:0!important}#modal.hx-ben .hx-tb-luoi .hx-vwrap{width:100%;aspect-ratio:16/9;background:#000}" +
        "#modal.hx-ben .hx-tb-luoi .hx-vwrap>video{width:100%;height:100%;object-fit:contain}" +
        "#modal.hx-ben .hx-tb-luoi #qdKhung{min-height:0;border-radius:8px}#modal.hx-ben .hx-tb-luoi #qdKhung>:is(video,img){width:100%;height:auto;aspect-ratio:16/9;max-height:none!important;object-fit:contain;background:#000}" +
        "#modal.hx-ben .hx-tb-luoi .hx-qd-xem>.hx-xdau{margin:8px 0 0!important}#modal.hx-ben .hx-tb-luoi .hx-qd-anh img{width:100%;height:auto;max-height:none;aspect-ratio:16/9;object-fit:contain;background:#000}" +
        /* 17/10 (6) user «thu hẹp khung Ảnh ghi nhận lại 68%» */
        /* 17/10 (7) «ảnh ghi nhận phải vừa với khung»: khung ÔM tấm ảnh theo đúng tỉ lệ ảnh (ảnh ngang/dọc đều không còn viền đen) — rộng ≤ 68% cột, cao ≤ min(300px, 36vh) */
        /* 17/10 (8) user «ảnh ghi nhận vẫn chưa khít với khung»: khung = KÍN bề rộng cột (thẳng mép với «Sẽ ghi nhận», Lỗi…), ảnh phủ kín khung không viền;
           ảnh ngang hiện đủ, ảnh dọc cao quá min(300px,36vh) thì cắt giữa (bấm ảnh xem đủ) */
        "#modal.hx-ben .hx-tb-luoi .hx-qd-anh{width:100%;max-width:none;min-height:0!important;background:transparent!important;line-height:0;border-radius:8px;overflow:hidden}" +
        /* 19/10 «mở thanh giật khung»: ảnh ghi nhận GIỮ CHỖ 16:9 trước khi tải xong (auto 16/9 = tải xong theo tỉ lệ thật) — phần dưới không bị đẩy */
        "#modal.hx-ben .hx-tb-luoi .hx-qd-anh img{display:block;width:100%!important;height:auto!important;max-width:none;max-height:min(300px,36vh)!important;aspect-ratio:auto 16/9!important;object-fit:cover;background:transparent!important;border-radius:0}" +
        /* đầu thanh đảo: nút (Ghi chú · Mở task · Đóng) bên TRÁI, tiêu đề bên PHẢI — chỉ thanh Xác minh */
        "#modal.hx-ben:has(#mBody .hx-tb-luoi) .modal-head{flex-wrap:nowrap!important}#modal.hx-ben:has(#mBody .hx-tb-luoi) .modal-head>#mTitle{order:-1;flex:1 1 auto;min-width:0;margin:0!important;text-align:left;display:flex!important;flex-direction:row!important;flex-wrap:nowrap!important;align-items:baseline!important;justify-content:flex-start!important;column-gap:8px;overflow:hidden}#modal.hx-ben:has(#mBody .hx-tb-luoi) #mTitle .hx-mt1{flex:0 1 auto;min-width:64px;white-space:nowrap!important;overflow:hidden;text-overflow:ellipsis}#modal.hx-ben:has(#mBody .hx-tb-luoi) #mTitle .hx-mt2{flex:0 1 auto;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#modal.hx-ben:has(#mBody .hx-tb-luoi) .modal-head>:not(#mTitle){flex:none;margin-left:0!important;margin-right:0!important}#modal.hx-ben:has(#mBody .hx-tb-luoi) .modal-head>#hxMoTask{order:1}#modal.hx-ben:has(#mBody .hx-tb-luoi) .modal-head>#gcNut{order:2}#modal.hx-ben:has(#mBody .hx-tb-luoi) .modal-head>#mClose{order:3}" +   // 19/10 user đổi ý: TRÁI = tiêu đề + giờ (1 hàng, dài thì cắt …), PHẢI = Mở task · Ghi chú · Đóng (Đóng ngoài cùng) — thay 17/10 (9) «Đóng bên trái»
        "#modal.hx-ben .hx-pd-duoi{margin-top:6px;border-radius:6px}#modal.hx-ben .hx-tb-luoi .hx-tl-hang[hidden]{display:none!important}#modal.hx-ben .hx-tb-luoi .hx-qd-xem>.hx-tl-hang{margin-top:8px}" +
        /* hàng dưới clip Theo tác vụ: chữ «Máy soi camera…» bên trái, nút nguồn sát phải; thiếu chỗ thì XUỐNG HÀNG (không cắt chữ/nút) */
        "#modal.hx-ben .hx-tb-luoi .hx-qd-xem>.hx-xdau{display:flex;flex-wrap:wrap!important;align-items:center;gap:6px 8px}#modal.hx-ben .hx-tb-luoi .hx-qd-xem>.hx-xdau>.hx-vl-tt{flex:1 1 200px!important;min-width:0;white-space:normal!important}" +
        "#modal.hx-ben .hx-tb-luoi .hx-qd-xem>.hx-xdau>.hx-qd-nguon{flex:0 1 auto;flex-wrap:wrap!important;overflow:visible;min-width:0;margin-left:auto}#modal.hx-ben .hx-tb-luoi .hx-qd-nguon button{white-space:nowrap}" +
        "#modal.hx-ben .hx-tb-luoi .hx-qd-ben{grid-template-columns:minmax(0,1fr) auto!important}#modal.hx-ben .hx-tb-luoi .hx-qd-form>.hx-qd-o:first-child{grid-column:1/-1!important}" +
        "#modal.hx-ben .hx-tb-luoi .hx-qd-form>.hx-qd-o:nth-child(2){grid-column:1!important}#modal.hx-ben .hx-tb-luoi .hx-qd-ben>#qdLuu{grid-column:2!important;align-self:end}" +
        "#modal.hx-ben .hx-tb-luoi :is(.hx-qd-xem,.hx-qd-ls){padding:0}#modal.hx-ben .hx-tb-luoi .hx-qd-ben{padding:0}#modal.hx-ben .hx-tb-luoi .hx-qd-anh{margin:0}" +
        "#modal.hx-ben .hx-tb-luoi .hx-qd-ben>#qdLuu+#qdMsg:empty+*,#modal.hx-ben .hx-tb-luoi .hx-qd-ben>#qdLuu+#qdMsg:not(:empty)+*{border-top:0;padding-top:0}" +
        "#modal.hx-ben .hx-toc button.dang:not(.on){background:color-mix(in srgb,var(--accent) 16%,var(--surface));color:var(--accent)}#modal.hx-ben .hx-tb-luoi .hx-chot{margin:0!important;overflow-y:auto;overscroll-behavior:auto}" +
        "@container (max-width:820px){#modal.hx-ben .hx-tb-luoi>.hx-tb-khung:has(>[data-tp=clip]){order:-1}#modal.hx-ben .hx-tb-luoi .hx-tb-khung,#modal.hx-ben .hx-tb-luoi .hx-tb-tp{grid-column:1/-1}#modal.hx-ben .hx-tb-khung{padding:12px 16px}}" +
        /* 19/10 user (video điện thoại): Quyết định BỎ dính đáy — cuộn theo nội dung, 2 thanh như nhau · khung clip DÍNH TRÊN (dưới đầu thanh), mục khác cuộn bên dưới */
        "#modal.hx-ben .hx-tb-luoi>.hx-tb-khung>[data-tp=quyetdinh]{position:static!important;box-shadow:none!important}" +
        "#modal.hx-ben .hx-tb-luoi>.hx-tb-khung>[data-tp=clip]{position:sticky;top:var(--hx-dau,0px);z-index:5;background:var(--surface);padding-bottom:6px}" +
        /* điện thoại / thanh hẹp: bỏ vỏ khung để clip dính suốt cả thanh (không chỉ trong khung của nó); thứ tự clip → ai tác động → phần còn lại */
        "@container (max-width:820px){#modal.hx-ben .hx-tb-luoi{row-gap:10px;padding-bottom:16px!important}#modal.hx-ben .hx-tb-luoi>.hx-tb-khung{display:contents!important}" +
          "#modal.hx-ben .hx-tb-luoi>.hx-tb-khung>.hx-tb-tp{grid-column:1/-1!important;width:auto!important;align-self:stretch;padding-left:16px;padding-right:16px;margin:0!important}" +
          "#modal.hx-ben .hx-tb-luoi>.hx-tb-khung>[data-tp=clip]{order:-2;padding-top:8px;padding-bottom:8px;box-shadow:0 1px 0 var(--ad-chia,var(--border))}#modal.hx-ben .hx-tb-luoi>.hx-tb-khung>[data-tp=aitacdong]{order:-1}" +
          /* thanh thời gian + ▶ giờ + Tự động/×1/×2/×3 CÙNG 1 HÀNG như web; nút gọn 24px, vùng chạm nới bằng ::after (≥40px thật) */
          "#modal.hx-ben .hx-tb-luoi .hx-tl-hang{flex-wrap:nowrap!important;gap:6px}#modal.hx-ben .hx-tb-luoi .hx-tl-hang>.hx-tl{flex:1 1 auto!important;min-width:48px!important}" +
          "#modal.hx-ben .hx-tb-luoi .hx-tl-hang .hx-vbar{gap:4px}#modal.hx-ben .hx-tb-luoi .hx-tl-hang .gio{min-width:50px;font-size:11px!important}" +
          "#modal.hx-ben .hx-tb-luoi .hx-tl-hang .hx-toc{overflow:visible}#modal.hx-ben .hx-tb-luoi .hx-tl-hang .hx-toc button{padding:0 5px!important;font-size:11px!important}" +
          "#modal.hx-ben .hx-tb-luoi .hx-tl-hang :is(.hx-toc button,#hxPlay){position:relative}#modal.hx-ben .hx-tb-luoi .hx-tl-hang :is(.hx-toc button,#hxPlay)::after{content:'';position:absolute;left:0;right:0;top:-8px;bottom:-8px}" +
          /* phụ đề theo thời gian + hàng «Máy soi camera…» + nút Clip camera giờ kho / Khung camera: chữ 12px, nút 28px (chạm 40px) */
          "#modal.hx-ben .hx-tb-luoi .hx-pd{font-size:12px!important;line-height:1.4;padding:6px 8px!important}#modal.hx-ben .hx-tb-luoi .hx-pd :is(span,.gio,b){font-size:12px!important}" +
          "#modal.hx-ben .hx-tb-luoi .hx-vl-tt{font-size:12px!important}#modal.hx-ben .hx-tb-luoi .hx-qd-xem>.hx-xdau{gap:4px 8px}" +
          "#modal.hx-ben .hx-tb-luoi .hx-qd-nguon button{position:relative;min-height:28px!important;height:28px;padding:0 10px!important;font-size:12px!important}#modal.hx-ben .hx-tb-luoi .hx-qd-nguon button::after{content:'';position:absolute;left:0;right:0;top:-6px;bottom:-6px}}" +
        /* đầu thanh trên điện thoại: Mở task / Ghi chú / Đóng gọn 30px (chạm 44px) bên phải, tiêu đề + giờ 1 hàng bên trái (chữ nhỏ, dài thì cắt …) */
        "#modal.hx-ben:has(#mBody .hx-tb-luoi) .modal-head{z-index:8}" +
        /* 19/10 (4) C: hàng đầu thanh THẤP 1 hàng (web 40px, chip 28px) — trái tiêu đề + giờ, phải Mở task · Ghi chú · Đóng */
        "@media(min-width:761px){#modal.hx-ben:has(#mBody .hx-tb-luoi) .modal-head{min-height:0!important;padding:6px 16px!important;flex-shrink:0}" +
          "#modal.hx-ben:has(#mBody .hx-tb-luoi) .modal-head :is(#mClose,.hx-gc-nut,.hx-motask){min-height:28px!important;height:28px;padding:0 10px!important}}" +
        /* 19/10 (4) B — CHỈ điện thoại: thanh bên Xác minh MỞ thì đầu trang (☰ thanh trái, tên mục, cài đặt) trượt lên ẩn, thanh bên dùng luôn phần cao đó;
           ĐÓNG thì trượt về — cùng nhịp .32s var(--ez-apple) của thanh bên/ngăn kéo (tái dùng, không thêm hiệu ứng mới) */
        "@media(max-width:768px){body:has(#modal.hx-ben.show #mBody .hx-tb-luoi){--pop-tren:0px}" +
          "#modal.hx-ben{transition:top .32s var(--ez-apple),visibility 0s .3s!important}#modal.hx-ben.show{transition:top .32s var(--ez-apple)!important}" +
          "body>header,.main>header,header{transition:translate .32s var(--ez-apple)}body:has(#modal.hx-ben.show #mBody .hx-tb-luoi) header{translate:0 -100%;pointer-events:none}" +
          "body:has(#modal.hx-ben.show #mBody .hx-tb-luoi) #sideToggle{translate:0 -72px!important;opacity:0!important;pointer-events:none!important}}" +
        /* 19/10 (4) A: hàng nguồn Theo tác vụ 1 hàng trái→phải; «Không qua WMS» xám khi máy không thấy lượt nào; Ảnh ghi nhận (bật/tắt) ngay dưới clip */
        "#modal.hx-ben .hx-tb-luoi .hx-tb-tp[hidden]{display:none!important}#modal.hx-ben .hx-tb-luoi .hx-qd-xem>.hx-xdau.hx-ng-hang{justify-content:flex-start}" +
        "#modal.hx-ben .hx-tb-luoi .hx-qd-xem>.hx-xdau.hx-ng-hang>.hx-qd-nguon{margin-left:0!important;flex:0 1 auto;width:auto!important;max-width:100%;min-width:0;flex-wrap:nowrap!important;overflow:visible!important;gap:6px;justify-content:flex-start}#modal.hx-ben .hx-tb-luoi .hx-ng-hang>.hx-qd-nguon>button{flex:0 1 auto;min-width:0;white-space:nowrap;overflow:clip;overflow-clip-margin:8px;text-overflow:ellipsis}@container (max-width:820px){#modal.hx-ben .hx-tb-luoi .hx-qd-xem>.hx-xdau.hx-ng-hang{margin-top:14px!important}#modal.hx-ben .hx-tb-luoi .hx-ng-hang>.hx-qd-nguon{gap:4px}#modal.hx-ben .hx-tb-luoi .hx-ng-hang>.hx-qd-nguon>button{padding:0 7px!important;font-size:12px!important}#modal.hx-ben .hx-lan .ai small{white-space:normal!important;overflow:visible;text-overflow:clip}}" +
        "#modal.hx-ben .hx-ng-hang button:disabled{opacity:.5;cursor:default}#modal.hx-ben .hx-ng-so{display:inline-block;min-width:16px;margin-left:4px;padding:0 4px;border-radius:8px;background:#d46b08;color:#fff;font-size:11px;line-height:16px;text-align:center}" +
        "@container (max-width:820px){#modal.hx-ben .hx-tb-luoi>.hx-tb-khung>[data-tp=anh]{order:-1}}" +
        /* 20/10 user (CHỈ WEB): khối thông tin Theo tác vụ dời xuống SÁT TRÊN Quyết định (ảnh ghi nhận được rộng chỗ); khung ảnh CHỐT 9:16 dọc, ảnh contain nền tối — đổi ảnh không làm các mục dưới nhảy */
        "@container (min-width:821px){#modal.hx-ben [data-tb=tacvu]>.hx-tb-khung>[data-tp=thongtin]{margin-top:auto!important}#modal.hx-ben [data-tb=tacvu]>.hx-tb-khung>[data-tp=quyetdinh]{margin-top:0!important}" +
          "#modal.hx-ben [data-tb=tacvu] [data-tp=anh] .hx-qd-anh{width:100%;height:320px;aspect-ratio:auto!important;margin:0;background:#111!important}" +
          "#modal.hx-ben [data-tb=tacvu] [data-tp=anh] .hx-qd-anh img{width:100%!important;height:100%!important;max-height:none!important;aspect-ratio:auto!important;object-fit:contain!important}" +
          "#modal.hx-ben [data-tb=tacvu] [data-tp=anh] .hx-anh-day{justify-content:center}}" +
        /* 20/10 user CHỐT (chỉ WEB, khổ >820): đầu thanh — «Đóng» sát TRÁI, kế «Ghi chú», «Mở task»; tiêu đề (tên task / sự việc + giờ) sát PHẢI, căn phải, dài cắt … · điện thoại giữ tên trái, nút phải */
        "@container (min-width:821px){#modal.hx-ben:has(#mBody .hx-tb-luoi) .modal-head>#mClose{order:-3}#modal.hx-ben:has(#mBody .hx-tb-luoi) .modal-head>#gcNut{order:-2}#modal.hx-ben:has(#mBody .hx-tb-luoi) .modal-head>#hxMoTask{order:-1}" +
          "#modal.hx-ben:has(#mBody .hx-tb-luoi) .modal-head>#mTitle{order:1;justify-content:flex-end!important;text-align:right}}" +
        /* 20/10 khối thông tin Theo tác vụ (Ngày ghi nhận / Vị trí / Ghi chú / Thuộc lỗi / Máy gợi ý): mỗi mục = nhãn nhỏ màu phụ (cột 88px) + giá trị, nhãn→giá trị 12px, giữa các mục 8px (khung cách 10px ⇒ phần loi/goiy −2px) — gọn chiều cao để web 1366×768 không phải cuộn cả thanh (khung đã cách 10px ⇒ phần loi/goiy thêm 2px), cùng cỡ chữ, cùng lề */
        "#modal.hx-ben [data-tb=tacvu]>.hx-tb-khung>[data-tp=thongtin] .hx-qd-o,#modal.hx-ben [data-tb=tacvu]>.hx-tb-khung>[data-tp=loi] .hx-qd-o,#modal.hx-ben [data-tb=tacvu]>.hx-tb-khung>[data-tp=goiy] .hx-qd-o{display:grid!important;grid-template-columns:88px minmax(0,1fr)!important;column-gap:12px;row-gap:0;align-items:baseline!important;margin:0!important;padding:0!important}" +
        "#modal.hx-ben [data-tb=tacvu]>.hx-tb-khung>[data-tp=thongtin] .hx-qd-o>.lbl,#modal.hx-ben [data-tb=tacvu]>.hx-tb-khung>[data-tp=loi] .hx-qd-o>.lbl,#modal.hx-ben [data-tb=tacvu]>.hx-tb-khung>[data-tp=goiy] .hx-qd-o>.lbl{font-size:12px!important;line-height:20px;color:var(--muted)!important;font-weight:400!important;padding:0!important;margin:0!important;width:auto!important;white-space:nowrap}" +
        "#modal.hx-ben [data-tb=tacvu]>.hx-tb-khung>[data-tp=thongtin] .hx-qd-o>div,#modal.hx-ben [data-tb=tacvu]>.hx-tb-khung>[data-tp=loi] .hx-qd-o>div,#modal.hx-ben [data-tb=tacvu]>.hx-tb-khung>[data-tp=goiy] .hx-qd-o>div{font-size:13px!important;line-height:20px;margin:0!important;padding:0!important}" +
        "#modal.hx-ben [data-tb=tacvu]>.hx-tb-khung>[data-tp=thongtin]{display:flex;flex-direction:column;gap:8px}#modal.hx-ben [data-tb=tacvu]>.hx-tb-khung>[data-tp=loi],#modal.hx-ben [data-tb=tacvu]>.hx-tb-khung>[data-tp=goiy]{margin-top:-2px!important}" +
        /* 20/10 nhiều ảnh: số «i/N» góc phải ảnh to; dãy ảnh nhỏ cao cố định 48px (giữ chỗ, cuộn ngang trong khung nếu nhiều) */
        "#modal.hx-ben .hx-nv.tt-active{color:#389e0d}#modal.hx-ben .hx-nv.tt-pending{color:#9254de}#modal.hx-ben .hx-nv.tt-inactive{color:var(--muted)}#modal.hx-ben .hx-nv b{color:inherit;font-weight:600}#modal.hx-ben .hx-lan .ai small.hx-lan-hang{display:block;white-space:normal!important;overflow:visible;text-overflow:clip}#modal.hx-ben .hx-lan .ai small.hx-lan-o{display:block;white-space:normal!important;overflow:visible;text-overflow:clip;color:var(--muted);font-size:11px;line-height:15px}#modal.hx-ben .hx-qd-mota:not(.mo){display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}#modal.hx-ben .hx-qd-mota{cursor:pointer;white-space:pre-line}#modal.hx-ben .hx-qd-anh.nhieu{position:relative}#modal.hx-ben .hx-anh-so{position:absolute;top:8px;right:8px;z-index:1;padding:1px 8px;border-radius:10px;background:color-mix(in srgb,#000 60%,transparent);color:#fff;font-size:12px;line-height:18px}" +
        "#modal.hx-ben .hx-anh-day{display:flex;gap:6px;height:48px;margin-top:6px;overflow-x:auto;overflow-y:hidden}#modal.hx-ben .hx-anh-day button{flex:0 0 auto;width:64px;height:48px;min-height:0!important;padding:0;border:2px solid transparent;border-radius:6px;overflow:hidden;background:var(--ad-nen2,#f5f5f5);cursor:pointer}#modal.hx-ben .hx-anh-day button.on{border-color:var(--accent)}#modal.hx-ben .hx-anh-day img{width:100%;height:100%;object-fit:cover;display:block}" +
        /* 20/10 Theo tác vụ điện thoại: clip → (ảnh) → Ngày/Vị trí/Ghi chú → Thuộc lỗi → Máy gợi ý → ai tác động → tình trạng → Quyết định */
        "@container (max-width:820px){#modal.hx-ben [data-tb=tacvu]>.hx-tb-khung>[data-tp=clip]{order:-6}#modal.hx-ben [data-tb=tacvu]>.hx-tb-khung>[data-tp=anh]{order:-5}#modal.hx-ben [data-tb=tacvu]>.hx-tb-khung>[data-tp=thongtin]{order:-4}#modal.hx-ben [data-tb=tacvu]>.hx-tb-khung>[data-tp=loi]{order:-3}#modal.hx-ben [data-tb=tacvu]>.hx-tb-khung>[data-tp=goiy]{order:-2}#modal.hx-ben [data-tb=tacvu]>.hx-tb-khung>[data-tp=aitacdong]{order:-1}}" +
        /* 19/10 (7) ảnh ghi nhận bật bằng chip: hiện ra bằng hiệu ứng paneIn sẵn có; hàng chip Theo máy cùng kiểu Theo tác vụ */
        "#modal.hx-ben .hx-tb-luoi>.hx-tb-khung>[data-tp=anh].hx-hien-mo{animation:paneIn .26s var(--ez-apple)}#modal.hx-ben .hx-tb-luoi .hx-xem-may{display:none;padding:0!important;margin:0}#modal.hx-ben .hx-tb-luoi .hx-xem-may>.hx-xdau.hx-ng-hang{margin-top:8px}" +
        "#modal.hx-ben .hx-tb-luoi .hx-ng-hang .hx-ng-anh{display:none}@container (max-width:820px){#modal.hx-ben .hx-tb-luoi .hx-ng-hang .hx-ng-anh{display:inline-flex}#modal.hx-ben .hx-tb-luoi .hx-xem-may{display:block}#modal.hx-ben .hx-tb-luoi>.hx-tb-khung>.hx-tb-tp.an-dt{display:none!important}}" +
        /* 20/10 chip «Góc khác» (góc camera phụ) hiện ở CẢ web: web hàng chip chỉ mở khi lượt có góc phụ, chip Ảnh ghi nhận web vẫn ẩn (ảnh ở cột phải) */
        "#modal.hx-ben .hx-tb-luoi .hx-xem-may:has([data-gocphu]){display:block}#modal.hx-ben .hx-tb-luoi .hx-ng-hang [data-gocphu]{display:inline-flex}#modal.hx-ben #lvGocPhu video{max-height:42vh}" +
        /* 19/10 (6) lọc danh sách ai tác động theo chip đang chọn */
        "#modal.hx-ben .hx-qd-ls[data-che=wms] .hx-lan.vl,#modal.hx-ben .hx-qd-ls[data-che=vl] .hx-lan:not(.vl),#modal.hx-ben .hx-qd-ls:not([data-che=wms]) [data-trong=wms]{display:none!important}" +   // đầu thanh nằm TRÊN clip dính (clip z 5)
        "@media(max-width:760px){#modal.hx-ben:has(#mBody .hx-tb-luoi) .modal-head{padding:8px 12px!important;gap:6px!important;flex-shrink:0;min-height:0!important}" +
          "#modal.hx-ben:has(#mBody .hx-tb-luoi) .modal-head :is(#mClose,.hx-gc-nut,.hx-motask){position:relative;min-height:28px!important;height:28px;padding:0 8px!important;font-size:13px!important;border-radius:6px}" +
          "#modal.hx-ben:has(#mBody .hx-tb-luoi) .modal-head :is(#mClose,.hx-gc-nut,.hx-motask)::after{content:'';position:absolute;left:-1px;right:-1px;top:-9px;bottom:-9px}" +
          "#modal.hx-ben:has(#mBody .hx-tb-luoi) #mTitle .hx-mt1{font-size:13px!important;line-height:16px}" +
          "#modal.hx-ben:has(#mBody .hx-tb-luoi) #mTitle .hx-mt2{font-size:11px!important;line-height:14px}}" +
      /* 1 cột (thanh hẹp / điện thoại): bỏ vỏ cột, xếp video → ảnh ghi nhận → quyết định → ai tác động */
      "@container (max-width:820px){#modal.hx-ben .hx-qd{display:flex;flex-direction:column}#modal.hx-ben .hx-cot{display:contents}" +
        "#modal.hx-ben .hx-qd-xem{order:1}#modal.hx-ben .hx-qd-anh{order:2}#modal.hx-ben .hx-qd-ben{order:3;grid-template-columns:minmax(0,1fr)}#modal.hx-ben .hx-qd-ls{order:4}" +
        "#modal.hx-ben .hx-qd-form>.hx-qd-o:nth-child(n),#modal.hx-ben .hx-qd-ben>#qdLuu{grid-column:1/-1}#modal.hx-ben .hx-qd-ben>#qdLuu{width:100%!important}" +
        "#modal.hx-ben :is(.hx-qd-xem,.hx-qd-anh,.hx-qd-ben,.hx-qd-ls){padding-left:16px;padding-right:16px}#modal.hx-ben .hx-qd-ben{border-top:1px solid var(--ad-chia,var(--border));margin-top:16px}#modal.hx-ben .hx-qd-nguon{flex-wrap:nowrap;overflow-x:auto}}" +
      "" +
      "@media(min-width:761px){#modal.hx-ben #mTitle .hx-mt1{font-size:16px}" +
        "#modal.hx-ben :is(.hx-qd-o>div,.hx-qd-o b,.hx-qd-ls div,.hx-pd span,.cs-lab,.hx-gc-nut,.hx-motask,.hx-motask span,#mClose,.hx-qd-nguon button,.hx-vl-tt,.hx-qd-o input,.hx-qd-o select,.hx-qd-tt,.hx-lan b,.hx-lan .muted,.hx-lan .gio,#qdLuu){font-size:13px!important}" +
        "#modal.hx-ben :is(.hx-qd-ben .lbl,.hx-mt2,.hx-tag,.hx-lan small,#qdMsg){font-size:12px!important}#modal.hx-ben .hx-pd .gio{font-size:13px!important}" +
        "#modal.hx-ben :is(.hx-gc-nut,.hx-motask,#mClose,.hx-vl-tt){min-height:32px;padding-top:0;padding-bottom:0}#modal.hx-ben #qdLuu{min-height:32px}#modal.hx-ben .hx-qd-o :is(input,.cs-trigger){min-height:32px}#modal.hx-ben .hx-qd-nguon button{min-height:28px}}" +
      ".hx-qd-khung{background:#000;border-radius:12px;overflow:hidden;min-height:200px;display:block}.hx-qd-khung video,.hx-qd-khung>img{width:100%;max-height:68vh;object-fit:contain;display:block}",
      ".hx-qd-nguon{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.hx-qd-nguon button{border:1px solid var(--border);background:var(--surface);color:var(--text);border-radius:8px;min-height:36px;padding:0 12px;font-size:13px;cursor:pointer}.hx-qd-nguon button.on{border-color:var(--accent);box-shadow:inset 0 -2px 0 var(--accent);font-weight:700}",
      ".hx-lans{display:flex;flex-direction:column;gap:4px;max-height:300px;overflow-y:auto}.hx-lan{display:flex;align-items:center;gap:10px;min-height:44px;padding:6px 10px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text);text-align:left;cursor:pointer;font:inherit}.hx-lan:hover,.hx-lan.on{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 8%,var(--surface))}.hx-lan.khong{cursor:default;opacity:.7}.hx-lan .gio{min-width:84px;font-variant-numeric:tabular-nums;font-weight:700;font-size:13px}.hx-lan small{display:block;font-weight:400;font-size:11.5px;color:var(--muted)}.hx-lan .ai{flex:1;min-width:0;font-size:13.5px}.hx-lan .pl{flex:none;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:color-mix(in srgb,var(--accent) 14%,transparent);color:var(--accent);font-size:12px}",
      ".hx-qd-ben{display:flex;flex-direction:column;gap:12px}.hx-qd-tt{padding:10px 12px;border-radius:10px;background:color-mix(in srgb,var(--warn) 12%,transparent);font-weight:650;font-size:14px}.hx-qd-tt.co{background:color-mix(in srgb,var(--good) 12%,transparent)}.hx-qd-o .lbl{display:block;font-size:12px;color:var(--muted)}",
      ".hx-lui{position:relative;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr)}.hx-lui img{position:absolute;inset:0;width:100%;height:100%;object-fit:fill}.hx-lui{aspect-ratio:1920/1176;width:100%}.hx-lui button{position:relative;border:2px solid transparent;background:transparent;cursor:pointer}.hx-lui button:hover{border-color:#f1c40f;background:rgba(241,196,15,.12)}",
      ".hx-chung td{padding-top:10px;padding-bottom:10px}.hx-vt{display:block;word-break:break-word;font-size:13px}",
      ".hx-bc{flex-direction:row!important;align-items:center;gap:10px!important}.hx-bc .hx-vthumb,.hx-bc .hx-th{flex:0 0 112px;width:112px!important;max-width:112px;height:63px!important;aspect-ratio:auto}",
      ".hx-bc-chu{display:flex;flex-direction:column;gap:2px;font-size:12px;line-height:1.3;min-width:0}.hx-bc-chu span:first-child{font-weight:650;color:var(--text)}",
      ".hx-nut.nho{min-height:34px;padding:0 12px;font-size:13px}",
      /* 10/10 QC giao diện cũ (qc-xacminh-cu.mjs): điện thoại — vùng chạm ≥44px (luật qc-bo-cuc-dien-thoai), đầu bảng 2 vế xếp dọc */
      "@media(max-width:560px){#pane-xacminh .btn-filter,#pane-xacminh .hx-nut,#pane-xacminh .hx-nut.nho,#modal .hx-nut,#modal .hx-qd-nguon button,#modal .hx-vbar button,#modal .hx-tlg button,#modal .cs-trigger,#pane-xacminh .cs-trigger{min-height:44px}" +
        "#modal .hx-chk{min-height:44px;display:flex;align-items:center;gap:10px}#modal .hx-chk input{width:22px;height:22px;flex:none}" +
        "#pane-xacminh .panel-head{flex-direction:column;align-items:flex-start;gap:2px}#pane-xacminh .panel-head>span:last-child{font-size:13px;color:var(--muted);font-weight:500}}",
      /* 13/10 QC pop-up quyết định theo antd: thân có lề 24/16 (trước dính sát mép) · thanh nguồn điện thoại 1 hàng cuộn ngang · form 2 cột không khung */
      "#modal .hx-qd{padding:16px 24px 24px}@media(max-width:560px){#modal .hx-qd{padding:12px 16px 16px}#modal .hx-qd-nguon{flex-wrap:nowrap;overflow-x:auto;min-width:0;padding-bottom:2px}#modal .hx-qd-nguon button{flex:0 0 auto}}",
      /* 13/10 user: nguồn KHOÁ ở trên, clip dưới · tiêu đề 2 dòng (mã ô / ngày giờ) · «Mở task» cạnh trái nút Đóng · tác động vật lý tô cam nổi */
      ".hx-qd-nguon{margin:0 0 8px!important;justify-content:flex-end}#mTitle .hx-mt1{display:block;font-size:16px;font-weight:600;line-height:24px}#mTitle .hx-mt2{display:block;font-size:12px;font-weight:400;color:var(--muted);line-height:20px}",
      ".hx-motask{margin-left:auto;display:inline-flex;align-items:center;gap:4px;min-height:32px;padding:0 12px;border:1px solid var(--border);border-radius:6px;color:var(--accent);text-decoration:none;font-size:14px;white-space:nowrap}.hx-motask:hover{border-color:var(--accent)}.hx-motask .ps{display:none}",
      "@media(max-width:560px){.hx-motask{min-height:44px}.hx-motask .pt{display:none}.hx-motask .ps{display:inline}}",
      ".hx-lan.vl{border-color:color-mix(in srgb,var(--warn) 70%,transparent);background:color-mix(in srgb,var(--warn) 10%,var(--surface))}.hx-tag.vl{margin-right:4px;font-size:11.5px;line-height:18px;padding:0 6px;background:#d46b08;color:#fff;border-color:#d46b08;font-weight:600}",
      ".hx-vl-go{flex:none;min-height:32px;padding:0 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--muted);font:inherit;font-size:12px;cursor:pointer}.hx-vl-go:hover{color:var(--bad,#d4380d);border-color:currentColor}",
      ".hx-pd .vl{background:#d46b08;color:#fff;padding:1px 8px;border-radius:4px;font-weight:700}",
      "#mTitle{flex:1 1 auto;min-width:0}#mTitle .hx-mt1{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}@media(max-width:560px){#mTitle .hx-mt1{font-size:15px}}@media(max-width:400px){#modal .modal-head{padding-left:12px;padding-right:12px;gap:8px}#mTitle .hx-mt1{font-size:14px}.hx-motask{padding:0 10px}}",
      ".hx-vl-mo{background:var(--surface)!important;color:var(--text)!important;border-color:var(--border)!important;font-weight:500!important}.hx-vl-mo:hover{border-color:var(--accent)!important;color:var(--accent)!important}#qdMsg:empty{min-height:0!important;margin-top:-8px}",
      ".hx-lans>*{flex:none}",
      ".hx-tg-nhom{cursor:pointer}.hx-tg-nhom:hover td{background:var(--ad-nen2,var(--surface2))}",
      ".hx-tg-ct{padding:16px 24px 24px}@media(max-width:560px){.hx-tg-ct{padding:12px 16px 16px}}",
      ".hx-tg-bang td{vertical-align:top;white-space:normal;overflow-wrap:anywhere}",
      ".hx-cu{background:color-mix(in srgb,var(--bad,#dc2626) 14%,transparent);color:var(--bad,#dc2626);text-decoration:line-through;border-radius:2px}",
      ".hx-moi{background:color-mix(in srgb,var(--good,#16a34a) 16%,transparent);color:var(--good,#15803d);border-radius:2px}",
      ".hx-chung.an-loi .c-loi{display:none}#pane-xacminh table.hx-chung.an-loi>thead th.c-bc{width:auto!important}",
      "@media(min-width:769px) and (max-width:1200px){html #pane-xacminh table.hx-chung>thead th.c-o{width:156px!important}html #pane-xacminh table.hx-chung>thead th.c-bc{width:136px!important}.hx-chung .hx-bc-chu{display:none!important}.hx-chung .hx-nut.nho{white-space:nowrap;padding:0 10px}}",
      ".hx-lui-nh{position:absolute;left:4px;top:4px;padding:1px 6px;border-radius:4px;background:rgba(0,0,0,.62);color:#fff;font-size:11px;line-height:16px;pointer-events:none}.hx-lui-chu{font-size:13px;color:#dfe8e2;padding:8px 10px;background:#111}",
      "@media(min-width:769px){#pane-xacminh .table-wrap>table.hx-chung{table-layout:fixed!important;width:100%}" +
        "#pane-xacminh table.hx-chung>thead th.c-o{width:184px!important}#pane-xacminh table.hx-chung>thead th.c-bc{width:26%!important}#pane-xacminh table.hx-chung>thead th.c-ai{width:17%!important}#pane-xacminh table.hx-chung>thead th.c-viec{width:15%!important}#pane-xacminh table.hx-chung>thead th.c-loi{width:auto!important}" +
        ".hx-chung tbody tr{height:92px}.hx-chung tbody td{vertical-align:top;padding-top:10px!important;padding-bottom:10px!important}.hx-chung .hx-o{max-height:72px;overflow:hidden}" +
        ".hx-chung .hx-o .hx-l2{-webkit-line-clamp:3;line-height:20px}.hx-chung .hx-o>div.muted{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}" +
        ".hx-chung .hx-bc-chu{display:-webkit-box!important;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;line-height:17px}.hx-chung .hx-bc-chu span{display:inline}.hx-chung .hx-bc-chu span+span::before{content:' · '}" +
        ".hx-chung .hx-o>b:first-child{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.hx-chung .hx-tag:not([style]){white-space:nowrap!important}}",
      ".hx-vl-ghi[hidden],.hx-vl-form[hidden]{display:none!important}.hx-vl-ghi{margin-top:8px}.hx-vl-form{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px}.hx-vl-form input{width:130px}.hx-vl-form .cs{flex:0 0 220px;width:220px}.hx-vl-luc{font-size:13px}",
      "@media(max-width:560px){.hx-vl-ghi .hx-vl-mo{width:100%}.hx-vl-form>*{flex:1 1 calc(50% - 4px)}.hx-vl-form .cs{min-width:0;width:auto}#vlForm>.cs{order:1;flex:1 1 100%!important;width:auto!important}#vlForm>input{order:2;flex:1 1 0!important;width:auto!important;min-width:0!important}#vlForm>#vlLuu{order:3;flex:0 0 96px!important}#vlForm>#vlMsg{order:4;flex:1 1 100%!important}#vlForm>#vlMsg:empty{display:none}.hx-vl-form input{width:auto}.hx-vl-form .hx-vl-luc{flex-basis:100%}.hx-vl-go{min-height:40px}}",
      ".hx-qd-form{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}.hx-qd-form .lbl{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:4px}.hx-qd-form input,.hx-qd-form select{width:100%}",
      ".hx-visao{font-size:13px;line-height:1.45;color:var(--text);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;cursor:pointer}.hx-visao.mo{display:block}",
      ".hx-sx{border:0;background:none;padding:0;font:inherit;font-weight:inherit;color:inherit;cursor:pointer;text-align:left}.hx-sx:hover,.hx-sx.on{color:var(--accent)}",
      ".hx-pd{display:flex;gap:10px;align-items:baseline;padding:8px 12px;background:#111;color:#e6efe9;font-size:14px;min-height:22px}.hx-pd .gio{font-variant-numeric:tabular-nums;font-weight:700;color:#9fd3b5;flex:none}.hx-pd .ngay{color:#ffd54f;font-weight:700}.hx-pd .sap{color:#cfd8d3}",
      ".hx-pd-cach{padding:8px 12px;background:#1b1b1b;color:#cfd8d3;font-size:13px;line-height:1.45;border-top:1px solid #333}.hx-pd-cach b{color:#fff}",
      ".hx-nut[disabled]{opacity:.55;cursor:not-allowed;background:var(--surface2);border-color:var(--border);color:var(--muted)}",
      ".hx-nut{min-height:40px;border-radius:10px;border:1px solid var(--accent);background:var(--accent);color:var(--accent-text,#fff);font-weight:650;padding:0 14px;cursor:pointer}",
      /* 14/10 nút Ghi chú dưới tiêu đề pop-up + khung ghi chú đầu thân */
      /* 14/10 user: ngày giờ NGANG HÀNG bên phải tên chỗ · Ghi chú cạnh trái nút Đóng · 3 nút phụ 1 hàng dưới nút Lưu */
      "#mTitle{display:flex;flex-wrap:wrap;align-items:baseline;column-gap:10px}#mTitle .hx-mt1,#mTitle .hx-mt2{display:inline-block!important}#mTitle .hx-mt1{min-width:0;max-width:100%}@media(max-width:560px){#mTitle .hx-mt1{white-space:normal!important;overflow-wrap:anywhere;line-height:20px}}",
      ".hx-gc-nut{flex:none;display:inline-flex;align-items:center;min-height:32px;padding:0 12px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font:inherit;font-size:14px;cursor:pointer;white-space:nowrap}.hx-gc-nut:hover,.hx-gc-nut[aria-expanded=true]{color:var(--accent);border-color:var(--accent)}.hx-gc-nut+.hx-motask{margin-left:0}@media(max-width:560px){.hx-gc-nut{min-height:44px;padding:0 10px}}",
      "#modal .hx-qd .hx-act{grid-template-columns:repeat(3,minmax(0,1fr))}#modal .hx-qd .hx-act button{padding:4px 6px;line-height:1.25}#modal .hx-qd .hx-act button[data-qd='-1']{grid-column:1/-1}",
      "@media(min-width:561px){.hx-qd-xem>.hx-xdau{flex-wrap:nowrap}.hx-qd-xem>.hx-xdau>.hx-vl-tt{flex:none;white-space:nowrap}.hx-qd-xem>.hx-xdau>.hx-qd-nguon{flex:0 1 auto;min-width:0;overflow-x:auto;padding-bottom:2px;justify-content:flex-start!important}.hx-qd-xem>.hx-xdau>.hx-qd-nguon button{flex:none}}",
      ".hx-vl-tt{font-size:13px;min-width:0}button.hx-vl-tt{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:0 10px;border:1px solid color-mix(in srgb,#d46b08 55%,transparent);border-radius:8px;background:color-mix(in srgb,#d46b08 8%,var(--surface));color:var(--text);font:inherit;font-size:13px;cursor:pointer}button.hx-vl-tt .hx-tag.vl{margin:0}@media(max-width:560px){button.hx-vl-tt{min-height:44px}}",
      "#lvAnh[hidden],#lvClip[hidden]{display:none!important}.hx-gc-nut.cho{border-color:var(--warn);color:var(--warn)}" +
        ".hx-gcp{position:fixed;inset:0;z-index:55;background:var(--overlay,rgba(0,0,0,.45));display:flex;align-items:center;justify-content:center;padding:16px}" +
        ".hx-gcp-hop{width:min(560px,100%);max-height:calc(100vh - 32px);display:flex;flex-direction:column;background:var(--surface);border-radius:12px;box-shadow:0 24px 60px rgba(16,24,40,.3);animation:popIn .18s var(--ez-spring,ease)}" +
        ".hx-gcp-dau{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;border-bottom:1px solid var(--border)}.hx-gcp-dau .hx-mt1{font-size:16px;font-weight:600;line-height:24px}.hx-gcp-dau .hx-mt2{font-size:12px;color:var(--muted);overflow-wrap:anywhere}" +
        ".hx-gcp-than{padding:16px 18px 18px;overflow-y:auto;display:flex;flex-direction:column;gap:10px}.hx-gcp-than textarea{width:100%;box-sizing:border-box;min-height:96px;border:1px solid var(--border);border-radius:8px;padding:8px 10px;background:var(--surface);color:var(--text);font:inherit;font-size:14px;resize:vertical}" +
        ".hx-gc-hang{display:flex;gap:10px;align-items:center}.hx-gcp-quy{font-size:12px;line-height:1.45}.hx-gc-dong{font-size:13px;padding:8px 0;border-top:1px solid var(--border)}.hx-gc-dong .nd{white-space:pre-wrap;overflow-wrap:anywhere;margin-top:2px}.hx-gc-dong .xong{margin-top:4px;color:var(--good);font-size:12.5px}" +
        "@media(max-width:560px){.hx-gcp{padding:12px;align-items:flex-end}.hx-gcp .hx-nut.nho,.hx-gcp .hx-gc-nut{min-height:44px}}",
      ".hx-xdau{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:6px}.hx-xdau .hx-vbar{margin:0;gap:6px;flex-wrap:nowrap}.hx-xdau .hx-qd-nguon{margin:0!important;flex-wrap:nowrap}" +
        ".hx-xdau .hx-vbar button,.hx-xdau .hx-qd-nguon button{min-height:32px;padding:0 10px;font-size:13px}#hxPlay{min-width:40px;font-size:14px}.hx-xdau .gio{min-width:0;font-size:13px;white-space:nowrap}.hx-xdau button{white-space:nowrap}" +
        ".hx-toc{display:inline-flex;border:1px solid var(--border);border-radius:8px;overflow:hidden}.hx-toc button{border:0!important;border-radius:0!important;min-height:30px!important;padding:0 8px!important}.hx-toc button+button{border-left:1px solid var(--border)!important}" +
        ".hx-mocs{display:flex;gap:6px;overflow-x:auto;margin-bottom:6px;padding-bottom:2px}.hx-mocs button{flex:none;min-height:28px;padding:0 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--muted);font:inherit;font-size:12px;cursor:pointer;white-space:nowrap}.hx-mocs button b{color:var(--text);font-weight:600;font-variant-numeric:tabular-nums}.hx-mocs button.ng{border-color:color-mix(in srgb,var(--bad) 45%,transparent);color:var(--bad)}.hx-mocs button.ng b{color:var(--bad)}.hx-mocs button:hover{border-color:var(--accent)}" +
        "#modal .hx-qd .hx-tl{height:14px;margin:0 0 6px}@media(max-width:560px){.hx-xdau .hx-vbar button,.hx-xdau .hx-qd-nguon button,.hx-mocs button{min-height:44px}.hx-toc button{min-height:42px!important}.hx-xdau{gap:6px}.hx-xdau .hx-qd-nguon{width:100%;justify-content:flex-start}}",
      "@media(max-width:560px){.hx-ng{grid-template-columns:74px minmax(0,1fr)}.hx-crop{width:74px;height:100px}.hx-buoc figure{flex-basis:128px}.hx-buoc img{width:128px;height:72px}}"
    ].join("\n");
    var st = document.createElement("style"); st.id = "hx-css"; st.textContent = c; document.head.appendChild(st);
  }

  /* ---------- tải dữ liệu ---------- */
  function goi(path, opt) {
    opt = Object.assign({}, opt || {});
    var ctl = new AbortController(); var h = setTimeout(function () { ctl.abort(); }, opt.tg || 8000); delete opt.tg;   // tg: trần riêng (gọi qua Apps Script = 45 s, bộ chuẩn mục 3)
    opt.headers = Object.assign({}, opt.headers || {}, PHIEN ? { "x-hx-phien": PHIEN } : {});
    return fetch(API + path, Object.assign({ signal: ctl.signal }, opt)).then(function (r) { clearTimeout(h); return r.json().then(function (j) {
      if (r.status === 401 && j.canDangNhap) { datPhien(""); D = null; veDangNhap("Phiên đăng nhập đã hết — đăng nhập lại."); var e = new Error(j.loi); e.dangNhap = 1; throw e; }
      if (!r.ok) throw new Error(j.loi || ("HTTP " + r.status)); return j; }); });
  }
  /* 10/10 QC: máy bận → gói 420 KB quá 8 s → báo nhầm «chỉ mở được trên máy quản lý». Thử lại 2 lần (3 s, 6 s) trước khi báo. */
  function tai(im, lan) {
    lan = lan || 0;
    /* 19/10: đã đăng nhập tài khoản audit-dc (điện thoại qua đường hầm) mà chưa có phiên máy chủ → đổi phiên trước, khỏi hiện ô đăng nhập riêng */
    if (!PHIEN && window.TK && window.TK.phien && typeof window.tkDoiPhienXm === "function" && !tai._doi) { tai._doi = 1;
      return window.tkDoiPhienXm().then(function (ok) { if (ok) { PHIEN = localStorage.getItem("hx-phien") || ""; return tai(im, lan); }
        if (window.__HX_KHONG_MAY && typeof setTab === "function") { tai._doi = 0; if (typeof toast === "function") toast("Chưa mở được Xác minh cho tài khoản này — thử đăng xuất rồi đăng nhập lại.", "loi"); setTab("maytram"); return; }   // điện thoại: không bày ô đăng nhập riêng (lặp 17/10)
        veDangNhap(); }); }
    if (!PHIEN) { veDangNhap(); return Promise.resolve(); }
    if (lan < 2) return taiMot(im).catch(function (e) { if (e && e.dangNhap) return; return new Promise(function (r) { setTimeout(r, 3000 * (lan + 1)); }).then(function () { return tai(im, lan + 1); }); });
    return taiMot(im, true);
  }
  var QDX = null;   // Quy định (QUY-DINH) qua bang-591 — tải 1 lần, dùng cho cột Lỗi của Theo máy
  function napQD() { if (QDX) return Promise.resolve(); return goi("/api/quy-dinh").then(function (j) { QDX = Array.isArray(j) ? j : []; }).catch(function () { QDX = null; }); }
  function taiMot(im, cuoi) {
    if (!cuoi) return Promise.all([goi("/api/du-lieu"), napQD()]).then(function (k) { taiXong(k[0], im); });
    /* 10/10 GIẬT LAG: nhịp 2' trước đây dựng lại CẢ tab dù dữ liệu y nguyên (capNhat đổi mỗi lần gọi) → chỉ vẽ khi nội dung đổi */
    return goi("/api/du-lieu").then(function (j) { taiXong(j, im); })
      .catch(function (e) { if (e && e.dangNhap) return; try { console.error("[xác minh] tải/vẽ lỗi:", e && e.stack || e); } catch (x) {} if (D && PANE.querySelector("#hxBody")) return;   /* đang có dữ liệu cũ (lượt tự tải lại hỏng) → giữ màn, không xoá trắng */
        D = null; PANE.innerHTML = '<div class="panel" style="margin-top:14px"><div class="hx-trong"><b>Tab này chỉ mở được trên máy quản lý.</b><br>Dữ liệu xác minh có hình người và ảnh cổng bảo vệ nên không đưa lên mạng — máy chủ nội bộ chưa chạy hoặc bạn đang mở từ máy khác.</div></div>'; });
  }
  function taiXong(j, im) { var ky = ""; try { ky = JSON.stringify(Object.assign({}, j, { capNhat: 0 })); } catch (e) {}
    if (D && ky && ky === tai._ky) { D.capNhat = j.capNhat; return; } tai._ky = ky; D = j; GIU = {}; if (!im) ve(); }
  function taiQD() { return QDL ? Promise.resolve(QDL) : goi("/api/quy-dinh").then(function (j) { QDL = j || []; return QDL; }).catch(function () { QDL = []; return QDL; }); }

  /* ---------- khung tab ---------- */
  /* 10/10 GIẬT LAG: đổi mục con trước đây luôn dựng lại từ đầu (0,4–0,8 s trên máy chậm). Giữ cây DOM của mục vừa rời,
     khoá = dữ liệu (tai đặt lại GIU) + bộ lọc + ô tìm lúc RỜI mục ⇒ quay lại y trạng thái thì gắn lại, không dựng. */
  var GIU = {}, SUB_DANG = null;
  var khoaGiu = function () { return JSON.stringify(LOC) + "|" + TIM; };
  function ve() {
    if (!D || !PANE) return;
    var bCu = $id("hxBody"); if (bCu && SUB_DANG && SUB_DANG !== SUB) GIU[SUB_DANG] = { k: khoaGiu(), n: bCu };
    var choCam = D.luot.filter(function (l) { return !l.qd && !l.chiLuu; }).length;
    var qua48 = D.phieu.filter(function (p) { return (p.treoGio || 0) > 48; }).length;
    var nvCo = D.nhanVien.filter(function (x) { return x.viec.some(function (v) { return v.loai !== "dang-giu"; }); });
    var daLap = D.luot.filter(function (l) { return l.may && l.may.trangThai === "xong"; }).length;
    /* 05/10 QC (skill frontend-design): BỎ dải 4 ô số chung — số không thuộc mục đang mở, chữ in hoa, chiếm nửa màn điện thoại; số của từng mục đã nằm ở thanh bên + dòng mô tả mục */
    var h = "";
    /* 05/10 user chán dải chip → kiểu A: các mục con nằm ở THANH BÊN TRÁI của dashboard (nhóm "Xác minh", index.html đọc window.__HX_MUC).
       Trong trang chỉ còn tiêu đề mục; khi thanh bên đang đóng (hoặc điện thoại) có 1 ô chọn "Chuyển mục" theo khuôn bộ lọc host. */
    /* 12/10 user: chỉ còn 3 mục — bỏ Nhắc QLTT (đã có trong Nhật ký, lọc ở đó) + Nhân viên */
    var MUC = [["treo", "Theo tác vụ", D.phieu.length, D.phieu.length + " phiếu WF591 đang mở, " + qua48 + " phiếu treo quá 48 giờ"],
      ["cam", "Theo máy", choCam, choCam + " sự việc chờ bạn quyết · đã lập " + daLap + " phiếu trong 14 ngày"],
      ["tg", "Nhật ký", tgHomNay(), "Phiếu, bình luận, ảnh do máy tạo bằng tài khoản của bạn trong 14 ngày: bộ nào làm, chạy từ đâu. Chỉ máy này xem được, không ghi lên phiếu"]];
    window.__HX_MUC = { cur: SUB, ds: MUC.map(function (x) { return { k: x[0], ten: x[1], n: x[2] }; }) };
    try { window.dispatchEvent(new CustomEvent("hx-muc")); } catch (e) {}
    var m = MUC.find(function (x) { return x[0] === SUB; }) || MUC[0];
    /* 13/10 user: tiêu đề mục LẶP đường dẫn đầu trang («Xác minh / Theo tác vụ») → bỏ (luật AD-05); Đăng xuất lên ĐẦU TRANG, đúng chỗ nút
       «+ Ghi nhận 5S» (nút đó nay chỉ ở Tổng quan) — index.html nutDauTrang() đọc body.dataset.hxPhien */
    datNutDX(true);
    h += '<div id="hxBody"></div>';
    PANE.innerHTML = h;
    var g = GIU[SUB], vuaRoi = SUB_DANG; SUB_DANG = SUB;
    if (g && vuaRoi !== SUB && g.k === khoaGiu()) { var bm = $id("hxBody"); bm.parentNode.replaceChild(g.n, bm); return; }
    delete GIU[SUB];

    if (SUB === "cam") veCam(); else if (SUB === "treo") veTreo(); else if (SUB === "nhac") veNhac(); else if (SUB === "khu") veKhu(); else if (SUB === "tg") veTG(); else veNV();
  }
  /* 19/10 user: «bộ lọc ngày ở Planogram làm CHUẨN toàn dự án» — trường {ngay:1} trong boLoc dựng 1 bản taoBoLocNgay (bo-loc-ngay.js)
     thay ô chọn "Ngày" kiểu danh sách; giá trị = [từ, đến] ISO ("" = không lọc). Cấu hình giữ ở NGAY_CFG cho ganLoc dựng sau. */
  var NGAY_CFG = {};
  var trongKhoang = function (iso, v) { if (typeof v === "string") v = v ? [v, v] : ""; return !v || !v[0] || (iso >= v[0] && iso <= (v[1] || v[0])); };
  function boLoc(o) {   // .filters + label.lbl + select → enhanceSelect (khuôn host)
    // khuôn host (tab Task vi phạm): điện thoại gấp bộ lọc sau nút "Bộ lọc — chạm để mở" (luật ⑨ cụm control răng cưa)
    var coLoc = o.some(function (f) { return f.k === "khuNgay" ? false : f.ngay ? !!(f.v && f.v[0]) : f.input ? f.v : f.v && f.v !== (f.opt[0] || [])[0]; });
    var h = '<button class="btn-filter" id="hxBtnLoc">' + (coLoc ? "Bộ lọc · đang lọc ▾" : "Bộ lọc ▾") + '</button>' +
      '<div class="filters collapsed" id="hxFilters" data-mb-rangcua="luoi-1-cot-gap-mac-dinh">' + o.map(function (f) {
      if (f.ngay) { NGAY_CFG[f.k] = f; return '<div class="date-filter" data-ngay="' + f.k + '"><span class="lbl">' + f.lbl + '</span></div>'; }
      if (f.input) return '<label><span class="lbl">' + f.lbl + '</span><input type="text" data-k="' + f.k + '" placeholder="' + e_(f.ph || "") + '" value="' + e_(f.v || "") + '"></label>';
      return '<label><span class="lbl">' + f.lbl + '</span><select data-k="' + f.k + '">' + f.opt.map(function (x) { return '<option value="' + e_(x[0]) + '"' + (String(f.v) === String(x[0]) ? " selected" : "") + '>' + e_(x[1]) + '</option>'; }).join("") + '</select></label>';
    }).join("") + '</div>';
    return h;
  }
  function ganLoc(cb) {
    var f = $id("hxFilters"); if (!f) return;
    var bt = $id("hxBtnLoc"), coLoc = !!(bt && /đang lọc/.test(bt.textContent));   // 19/10: coLoc chỉ có trong boLoc — thiếu ở đây làm ganLoc văng lỗi khi giữ bộ lọc mở (điện thoại)
    if (bt) bt.onclick = function () { var dong = f.classList.toggle("collapsed"); bt.textContent = (coLoc ? "Bộ lọc · đang lọc " : "Bộ lọc ") + (dong ? "▾" : "▴"); };
    if (ganLoc.mo) { f.classList.remove("collapsed"); if (bt) bt.textContent = (coLoc ? "Bộ lọc · đang lọc " : "Bộ lọc ") + "▴"; }
    f.querySelectorAll("[data-ngay]").forEach(function (r) { var c = NGAY_CFG[r.dataset.ngay]; if (!c || typeof window.taoBoLocNgay !== "function") return;
      var v = typeof c.v === "string" ? (c.v ? [c.v, c.v] : []) : (c.v || []);
      window.taoBoLocNgay({ root: r, presets: c.presets, coDuLieu: c.coDuLieu, nhan: c.nhan,
        onApply: function (a, b) { ganLoc.mo = !f.classList.contains("collapsed"); cb(r.dataset.ngay, a ? [a, b || a] : ""); ganLoc.mo = false; } }).dat(v[0] || "", v[1] || ""); });
    f.querySelectorAll("select").forEach(function (s) { if (typeof enhanceSelect === "function") enhanceSelect(s); s.addEventListener("change", function () { ganLoc.mo = !f.classList.contains("collapsed"); cb(s.dataset.k, s.value); ganLoc.mo = false; }); });
    f.querySelectorAll("input").forEach(function (i) { var h; i.addEventListener("input", function () { clearTimeout(h); h = setTimeout(function () { ganLoc.mo = !f.classList.contains("collapsed"); cb(i.dataset.k, i.value, true); ganLoc.mo = false; }, 160); }); });
  }

  /* ---------- 1) THEO NHÂN VIÊN ---------- */
  var NHAN = { "vi-pham": ["bad", "Vi phạm"], "cam-da-gan": ["bad", "Camera · đã gán"], "cam-nghi": ["warn", "Camera · nghi"], "dang-giu": ["info", "Đang giữ phiếu"] };
  function veNV() {
    var giu = LOC.nvLoai === "giu";
    var ds = D.nhanVien.filter(function (x) { return x.viec.some(function (v) { return giu ? v.loai === "dang-giu" : v.loai !== "dang-giu"; }); })
      .filter(function (x) { return !TIM || (x.ten + " " + x.ma).toLowerCase().indexOf(TIM.toLowerCase()) >= 0; });
    var vc = function (x) { return x.viec.filter(function (v) { return giu ? v.loai === "dang-giu" : v.loai !== "dang-giu"; }); };
    var h = boLoc([{ k: "nvLoai", lbl: "Xem", v: LOC.nvLoai || "", opt: [["", "NV vi phạm / bị nghi"], ["giu", "Người đang giữ phiếu"]] }, { k: "tim", lbl: "Tìm (tên / mã NV)", input: 1, v: TIM, ph: "Nguyễn… / 2519…" }]);
    h += '<div class="panel"><div class="panel-head"><span>' + (giu ? "Người đang giữ phiếu" : "Nhân viên có việc") + '</span><span>' + ds.length + ' người</span></div>' +
      '<div class="table-wrap"><table class="hx-t-nv" style="table-layout:fixed;width:100%;min-width:0"><thead><tr><th style="width:24%">Nhân viên</th><th style="width:9%">Mã</th><th>Việc đang có</th><th style="width:12%">Treo lâu nhất</th></tr></thead><tbody>' +
      (ds.map(function (x, i) { var v = vc(x), max = Math.max.apply(null, v.map(function (y) { return y.treoGio || 0; }).concat([0]));
        return '<tr data-nv="' + i + '"><td><b>' + e_(x.ten || "(chưa rõ tên)") + '</b><div class="muted" style="font-size:12px">' + e_(String(x.chuc || "").split("/").slice(-1)[0].trim()) + '</div></td><td>' + e_(x.ma || "—") + '</td>' +
          '<td style="white-space:normal">' + demTag(v) + '<div class="muted hx-l2" style="font-size:12px;margin-top:2px">' + e_(v[0] ? v[0].tieuDe : "") + '</div></td><td>' + (max ? treoTag(max) : "—") + '</td></tr>'; }).join("") ||
        '<tr><td colspan="4"><div class="empty-row">Không có ai.</div></td></tr>') + '</tbody></table></div>' +
      '<div class="cardlist">' + ds.map(function (x, i) { var v = vc(x);
        return '<div class="cl-item" data-nv="' + i + '"><div class="cl-body"><div class="cl-top">' + demTag(v) + '</div><div class="cl-loi"><b>' + e_(x.ten || "(chưa rõ tên)") + '</b></div>' +
          '<div class="cl-kv">Mã: <b>' + e_(x.ma || "—") + '</b></div><div class="cl-kv hx-l2">' + e_(v[0] ? v[0].tieuDe : "") + '</div></div></div>'; }).join("") + '</div></div>';
    $id("hxBody").innerHTML = h;
    ganLoc(function (k, v, go) { if (k === "tim") TIM = v; else LOC[k] = v; luu(); veNV(); if (go) { var i = $id("hxFilters").querySelector("input"); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } } });
    $id("hxBody").querySelectorAll("[data-nv]").forEach(function (r) { r.onclick = function () { moNV(ds[Number(r.dataset.nv)], giu); }; });
  }
  function demTag(v) { var c = {}; v.forEach(function (y) { c[y.loai] = (c[y.loai] || 0) + 1; });
    return Object.keys(c).map(function (k) { return '<span class="hx-tag ' + NHAN[k][0] + '">' + NHAN[k][1] + ' · ' + c[k] + '</span>'; }).join(""); }
  function treoTag(h) { return h == null ? "" : '<span class="hx-tag ' + (h > 48 ? "bad" : "warn") + '">treo ' + (h > 72 ? Math.round(h / 24) + " ngày" : h + "h") + '</span>'; }
  function moNV(x, giu) {
    var v = x.viec.filter(function (y) { return giu ? y.loai === "dang-giu" : y.loai !== "dang-giu"; }).sort(function (a, b) { return b.muc - a.muc || (b.treoGio || 0) - (a.treoGio || 0); });
    $id("mTitle").innerHTML = e_(x.ten || "(chưa rõ tên)") + (x.ma ? ' <span class="stat-sub">mã ' + e_(x.ma) + '</span>' : "");
    $id("mBody").innerHTML = '<div class="panel" style="padding:4px 14px">' + v.map(function (y) {
      return '<div class="hx-viec"><div class="noi"><span class="hx-tag ' + NHAN[y.loai][0] + '">' + NHAN[y.loai][1] + '</span>' + (y.buoc ? '<span class="hx-tag info">' + e_(y.buoc) + '</span>' : "") + treoTag(y.treoGio) +
        '<div class="hx-l2" style="margin-top:4px">' + e_(y.tieuDe) + '</div><div class="muted" style="font-size:12px">' + e_(y.viTri || y.gio || "") + ' · ' + e_(y.chu) + '</div></div>' +
        (y.link ? '<a class="badge-link" href="' + e_(y.link) + '" target="_blank" rel="noopener">mở task</a>' : '<button class="badge-link" data-ev="' + e_(y.id) + '">xem lượt</button>') + '</div>'; }).join("") + '</div>';
    $id("mBody").querySelectorAll("[data-ev]").forEach(function (b) { b.onclick = function () { var l = D.luot.find(function (z) { return z.id === b.dataset.ev; }); if (l) moLuot(l); }; });
    boThanhBen(); hienModal("modal");
  }

  /* ---------- 2) CÒ CAMERA ---------- */
  function ttLuot(l) { return l.may && l.may.trangThai === "xong" ? "xong" : l.qd ? "da" : l.chiLuu ? "luu" : "cho"; }
  function nguoiChot(l) {   // tên các NV bạn đã chốt
    var q = l.qd || {}; if (q.qd !== QD[0]) return "";
    if (q.nguoi && q.nguoi.length) return q.nguoi.filter(function (x) { return !x.khong; }).map(function (x) { return (x.ten || x.ma); }).join(", ");
    return q.ma || "";
  }
  function anhNguoi(l) { var b = (l.buocAnh || []).find(function (x) { return x.doNguoi && x.kieu; }) || (l.buocAnh || []).find(function (x) { return x.doNguoi; }) || (l.buocAnh || [])[0]; return b ? u_(b.anh) : u_(l.anh); }
  function veCam() {
    var ngays = Array.from(new Set(D.luot.map(function (l) { return l.ngay; }))).sort().reverse();
    var ds = D.luot.filter(function (l) { return (!LOC.khu || l.loai === LOC.khu) && trongKhoang(l.ngay, LOC.ngay) && (!LOC.tt || (LOC.tt === "gc" ? !!gcCua(l.id) : ttLuot(l) === LOC.tt)) &&
      (!TIM || (l.camera + " " + nguoiChot(l) + " " + (l.chamCong || []).concat(l.cong || []).map(function (c) { return c.code + " " + c.ten; }).join(" ")).toLowerCase().indexOf(TIM.toLowerCase()) >= 0); });
    taiGC(veCam); ds = donGC(ds, function (l) { return l.id; });   // 20/10 mục có ghi chú dồn cuối, làm mờ
    var h = boLoc([
      { k: "tt", lbl: "Trạng thái", v: LOC.tt, opt: [["cho", "Chờ bạn quyết"], ["da", "Đã quyết · máy đang làm"], ["xong", "Đã lập phiếu"], ["luu", "Chỉ lưu vết (khu phân loại · xe tải che bãi)"], ["gc", "Có ghi chú (mọi trạng thái)"], ["", "Tất cả"]] },
      { k: "khu", lbl: "Khu", v: LOC.khu, opt: [["", "Mọi khu"], ["bai-xe", "Bãi xe NCC / bảo vệ"], ["phan-loai", "Khu phân loại giấy"]] },
      { k: "ngay", lbl: "Ngày", ngay: 1, v: LOC.ngay, coDuLieu: function (iso) { return ngays.indexOf(iso) >= 0; }, nhan: function (a, b) { return a ? "" : "14 ngày gần nhất"; },
        presets: [{ k: "today", lb: "Hôm nay" }, { k: "yesterday", lb: "Hôm qua" }, { k: "3", lb: "3 ngày" }, { k: "7", lb: "7 ngày" }, { k: "all", lb: "Tất cả" }] },
      { k: "tim", lbl: "Tìm (camera / tên / mã NV)", input: 1, v: TIM, ph: "AI Bao Ve / 2519…" }]);
    var cot = function (l) {
      var ng = (l.buocAnh || []).reduce(function (m, b) { return Math.max(m, (b.hop || []).length); }, 0);
      var gy = (l.cong || []).find(function (c) { return c.code === l.goiY; });
      return { ng: l.khongThayNguoi ? '<span class="hx-tag warn">không thấy người</span>' : (ng ? ng + " người nghi" : "có cử động"),
        uv: gy ? '<b>' + e_(gy.ten) + '</b><div class="muted" style="font-size:12px">' + e_(gy.code) + ' · cổng ' + hm(gy.gio) + '</div>' : ((l.chamCong || []).length ? (l.chamCong.length + " NV " + (l.loai === "phan-loai" ? "trong ca" : "chấm công gần giờ")) : '<span class="muted">Chưa có ứng viên</span>'),
        tt: ttLuot(l) === "xong" ? '<span class="hx-tag good">Đã lập phiếu</span><div style="font-size:12px">' + e_(nguoiChot(l)) + '</div>'
          : ttLuot(l) === "da" ? '<span class="hx-tag info">' + e_(l.qd.qd) + '</span>' + (nguoiChot(l) ? '<div style="font-size:12px">' + e_(nguoiChot(l)) + '</div>' : "")
          : ttLuot(l) === "luu" ? '<span class="hx-tag">Chỉ lưu vết</span><div class="muted" style="font-size:12px">' + e_(l.lyDoLuu || "tra khi có báo lỗi phân loại") + '</div>'
          : '<span class="hx-tag warn">Chờ bạn quyết</span>' };
    };
    /* 05/10: cùng bộ cột với Theo phiếu — khác cột cuối: CHƯA có task → "Mở để quyết · lập phiếu" */
    /* 13/10 user: «truy vấn ở Quy định xem để sai bãi xe thì lỗi gì — hiển thị cột Lỗi, CHO ĐỒNG BỘ» → nguyên văn QUY-DINH:
       bãi xe = mục 25 (luật BX-01 bạn chốt 02/10) · phân loại rác/giấy = mục 8. Chưa tải được Quy định thì dùng câu ngắn dự phòng. */
    /* 13/10 luật không lặp: mọi dòng cùng một lỗi (cùng khu) → lỗi lên đầu khung, ẩn cột Lỗi */
    var loiDon = "";   // 13/10 user: GIỮ cột Lỗi (ẩn cột làm cột Bằng chứng phình ra, lãng phí) — đồng bộ với Theo tác vụ
    h += '<div class="panel"><div class="panel-head"><span>Sự việc camera bắt được — ' + (LOC.khu ? tenLoai(LOC.khu) : "mọi khu") + (loiDon ? '<span class="muted" style="font-weight:400;font-size:14px"> · ' + e_(loiDon) + '</span>' : "") + '</span><span>' + ds.length + ' sự việc</span></div>' +
      '<div class="table-wrap"><table class="hx-chung' + (loiDon ? " an-loi" : "") + '" style="table-layout:fixed;width:100%;min-width:0"><thead><tr>' + COT_CHUNG + '</tr></thead><tbody>' +
      (ds.map(function (l, i) { var c = cot(l);
        return '<tr data-l="' + i + '" data-lid="' + e_(l.id) + '"' + (gcCua(l.id) ? ' class="hx-gc-mo"' : "") + '><td><b class="hx-vt">' + e_(tenLoai(l.loai)) + '</b><div class="muted" style="font-size:12px">' + ngayVN(l.ngay) + ' ' + hm(l.gioNguoi || l.tu) + ' · ' + e_(l.camera) + '</div>' + coGC(l.id) + '</td>' +
          '<td class="c-loi" style="white-space:normal"><div class="hx-l2">' + e_(loiCam(l)) + '</div></td>' +
          '<td><div class="hx-bc"><span class="hx-vthumb"><img loading="lazy" src="' + e_(anhNguoi(l)) + '" alt="Clip camera" style="width:100%;height:100%;object-fit:cover;display:block"><span class="pl">▶</span></span><div class="hx-bc-chu"><span>Clip camera</span>' + ((l.chamCong || []).length || (l.cong || []).length ? '<span class="muted">' + [(l.chamCong || []).length ? "chấm công" : "", (l.cong || []).length ? "sổ cổng" : ""].filter(Boolean).join(" · ") + '</span>' : "") + '</div></div></td>' +
          '<td style="white-space:normal">' + (/<\/div>$/.test(c.uv) ? c.uv.replace(/<\/div>$/, " · " + c.ng.replace(/<[^>]+>/g, "") + "</div>") : c.uv + '<div class="muted" style="font-size:12px">' + c.ng.replace(/<[^>]+>/g, "") + '</div>') + '</td>' +   // 1 dòng phụ: mã · giờ cổng · số người nghi
          '<td>' + (ttLuot(l) === "cho" ? '<button class="hx-nut nho" data-mo="' + i + '">Mở để quyết</button><div class="muted" style="font-size:12px;margin-top:4px">chưa có task</div>' : c.tt) + '</td></tr>'; }).join("") ||
        '<tr><td colspan="5"><div class="empty-row">' + (LOC.tt === "cho" ? "Không còn sự việc nào chờ bạn quyết." : "Không có sự việc khớp bộ lọc.") + '</div></td></tr>') + '</tbody></table></div>' +
      '<div class="cardlist">' + ds.map(function (l, i) { var c = cot(l);
        return '<div class="cl-item' + (gcCua(l.id) ? " hx-gc-mo" : "") + '" data-l="' + i + '" data-lid="' + e_(l.id) + '"><img class="cl-img" loading="lazy" src="' + e_(anhNguoi(l)) + '" alt=""><div class="cl-body"><div class="cl-top">' + c.tt.split("</span>")[0] + '</span></div>' +
          '<div class="cl-loi hx-l2">' + e_(loiCam(l)) + '</div>' + coGC(l.id) + '<div class="cl-kv">Ở đâu: <b>' + e_(tenLoai(l.loai)) + '</b> · ' + ngayVN(l.ngay) + ' ' + hm(l.gioNguoi || l.tu) + '</div>' +
          '<div class="cl-kv">Máy gợi ý: <b>' + (l.goiY ? c.uv.replace(/<div[\s\S]*$/, "").replace(/<[^>]+>/g, "") : "chưa có ứng viên") + '</b> · ' + c.ng.replace(/<[^>]+>/g, "") + '</div></div></div>'; }).join("") + '</div></div>';
    $id("hxBody").innerHTML = h; khoaHang($id("hxBody"));
    ganLoc(function (k, v, go) { if (k === "tim") TIM = v; else LOC[k] = v; luu(); veCam(); if (go) { var i = $id("hxFilters").querySelector("input"); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } } });
    $id("hxBody").querySelectorAll("[data-l]").forEach(function (r) { r.onclick = function () { moLuot(ds[Number(r.dataset.l)]); }; });
    danhDauDangXem();
  }

  /* cột Lỗi của Theo máy (bảng + pop-up) — bãi xe = mục 25 (luật BX-01) · phân loại rác/giấy = mục 8 */
  var MUC_CAM = { "phan-loai": [8, "Rác / giấy chưa phân loại đúng nơi"], "bai-xe": [25, "Gửi xe ở khu vực không được phép"] };
  var loiCam = function (l) { var m = MUC_CAM[l.loai === "phan-loai" ? "phan-loai" : "bai-xe"], q = (QDX || []).find(function (x) { return Number(x.muc) === m[0]; });
    return (q ? q.cau : m[1]) + " (mục " + m[0] + ")"; };
  /* ---- pop-up lượt: CLIP (tua ×3 khúc trống, ×1 lúc có người) + bộ chọn THEO ẢNH (mỗi "Người nghi" 1 dòng: ai · vi phạm gì · ở đâu) ---- */
  function nguoiTrongAnh(l) {
    var bs = (l.buocAnh || []).filter(function (b) { return b.doNguoi; });
    var tot = bs.filter(function (b) { return b.kieu === "nguoi"; }).sort(function (a, b) { return (b.hop || []).length - (a.hop || []).length; })[0] || bs.find(function (b) { return b.kieu === "vung"; }) || bs[0];
    if (!tot) return [{ so: 1, anh: u_(l.anh), hop: null, luc: l.gioNguoi || l.tu, kieu: "" }];
    var hop = (tot.hop && tot.hop.length) ? tot.hop : [null];
    return hop.map(function (h, i) { return { so: i + 1, anh: u_(tot.anh), hop: h, luc: tot.luc || l.gioNguoi, kieu: tot.kieu, nhan: tot.nhan }; });
  }
  function cropStyle(anh, h) {
    if (!h) return "background-image:url('" + anh + "');background-size:cover;background-position:center";
    var pad = 0.03, x0 = Math.max(0, h[0] - pad), y0 = Math.max(0, h[1] - pad), x1 = Math.min(1, h[2] + pad), y1 = Math.min(1, h[3] + pad), w = x1 - x0, hh = y1 - y0;
    return "background-image:url('" + anh + "');background-size:" + (100 / w) + "% " + (100 / hh) + "%;background-position:" + (w >= 1 ? 0 : x0 / (1 - w) * 100) + "% " + (hh >= 1 ? 0 : y0 / (1 - hh) * 100) + "%";
  }
  function mucMacDinh(l) { return l.loai === "phan-loai" ? 8 : 25; }
  function moLuot(l) {
    var TB = moThanhBen(String(l.id));   // 16/10 (7) user: Theo máy đổi sang THANH BÊN như Theo tác vụ
    EV = { l: l, ng: nguoiTrongAnh(l) };
    var q = l.qd || {}, cu = (q.nguoi || []);
    EV.ng.forEach(function (n, i) { var c = cu.find(function (x) { return x.so === n.so; }) || (i === 0 && q.ma && !cu.length ? { ma: q.ma.split(",")[0] } : null);
      n.ma = c ? c.ma : ""; n.ten = c ? (c.ten || "") : ""; n.khong = c ? !!c.khong : false; n.muc = c && c.muc ? c.muc : mucMacDinh(l); n.viTri = c && c.viTri ? c.viTri : (l.loai === "phan-loai" ? l.camera : "Bãi xe NCC/bảo vệ · " + l.camera); });
    var khoa = l.may && l.may.trangThai && l.may.trangThai !== "lỗi";
    var PL = l.loai === "phan-loai";
    /* 17/10 (3) user «Máy gợi ý … nhấn vào thì chọn được người khác như ô Là ai»: người máy gợi ý = lựa chọn SẴN của người nghi 1 (chưa ai chọn thì điền), đổi được */
    var gy0 = (l.cong || []).find(function (c) { return c.code === l.goiY; });
    if (gy0 && EV.ng[0] && !EV.ng[0].ma && !cu.length && !q.ma) { EV.ng[0].ma = gy0.code; EV.ng[0].ten = gy0.ten; }
    /* 14/10 user: pop-up Theo máy ĐỒNG BỘ vị trí với Theo tác vụ — tiêu đề 2 dòng (chỗ / ngày giờ) + Ghi chú · trái: nguồn + khung xem ·
       phải: Quyết định → Lỗi → Máy gợi ý → danh sách người (như «Ai tác động ô») */
    var nd = String(l.ngay || "").split("-"), gioL = hm(l.gioNguoi || l.tu);
    $id("mTitle").innerHTML = '<span class="hx-mt1">' + e_(tenLoai(l.loai)) + " · " + e_(l.camera) + '</span><span class="hx-mt2">' + (nd.length === 3 ? nd[2] + "/" + nd[1] + "/" + nd[0] : e_(l.ngay)) + " " + gioL + '</span>';
    if (l.may && l.may.phieu) ganMoTask("https://work.hasaki.vn/tasks?task_id=" + encodeURIComponent(l.may.phieu)); else { var mt0 = $id("hxMoTask"); if (mt0) mt0.remove(); }
    var gy = (l.cong || []).find(function (c) { return c.code === l.goiY; });
    var dn = (l.doanNguoi || []).map(function (d) { return [giay(d[0]), giay(d[1])]; });
    /* 17/10 user «rã tất cả thành phần/khung ở thanh bên phải để t tự di chuyển ở bản QC»: mỗi thành phần 1 khối rời [data-tp],
       hxTB.ap() xếp vào các KHUNG theo bố cục (DASH_BOCUC.thanhBen.may — bộ Chỉnh bố cục ghi; chưa có thì TB_MAC).
       Mặc định: hàng trên = clip + Ảnh ghi nhận; DƯỚI cả hàng clip = 2 khung chia đôi thanh: điều khiển/mốc/Quyết định/Lỗi/Gợi ý | Người trong khung đỏ. */
    var tp = function (id, noi) { return '<div class="hx-tb-tp" data-tp="' + id + '">' + noi + '</div>'; };
    /* 17/10 (3) user: điều khiển clip GỌN, nằm bên phải NGANG HÀNG thanh thời gian · gộp Lỗi / Máy gợi ý / Quyết định / người nghi thành 1 khung:
       Lỗi (bấm = ô chọn hạng mục như «Vi phạm gì») → Máy gợi ý (bấm = chọn người khác như «Là ai») → Quyết định; bỏ tiêu đề «Người trong khung đỏ», câu hỏi, ảnh cắt nhỏ.
       ≥2 người nghi: mỗi người 1 cụm Lỗi / Là ai có dòng tên «Người nghi N · giờ» + ô tích không vi phạm. */
    var nhieu = EV.ng.length >= 2;
    var h = '<div class="hx-qd hx-qd-luot hx-tb-luoi" data-tb="may">' +
      tp("clip", '<div id="lvClip"><div class="hx-vwrap" data-khung><video id="hxV" playsinline muted preload="auto"></video><canvas id="hxOv" width="1280" height="720"></canvas></div>' +
        '<div class="hx-tl-hang"><div class="hx-tl" id="hxTl"></div><div class="hx-xdau"><span class="hx-vbar" id="lvCtl"><button id="hxPlay" aria-label="Phát / dừng">▶</button><span class="gio" id="hxGio">--:--:--</span>' +
        '<span class="hx-toc"><button data-toc="auto" class="on">Tự động</button><button data-toc="1">×1</button><button data-toc="2">×2</button><button data-toc="3">×3</button></span></span></div></div></div>' +
        /* 19/10 (7) user: «Ảnh ghi nhận» thành CHIP cùng hàng/kiểu với Theo tác vụ, ngay dưới clip — ảnh mặc định ẩn, bấm hiện DƯỚI clip (clip vẫn chạy) */
        '<div class="hx-qd-xem hx-xem-may"><div class="hx-xdau hx-ng-hang"><span class="hx-qd-nguon"><button type="button" class="hx-ng-anh" data-anhgn aria-pressed="false">Ảnh ghi nhận</button>' +
        /* 20/10 ghi chú user (lượt 14/10 07:38): «người đi sang góc khác nên không thấy rõ — lấy thêm góc khác cùng thời điểm». Chip «Góc khác · <kênh>»
           như chip Ảnh ghi nhận: mặc định ẩn, bấm hiện 1 khung video RIÊNG dưới clip (clip chính giữ nguyên), tua sẵn tới trước giờ có người 5 s. */
        (l.gocPhu || []).map(function (g, i) { return '<button type="button" class="hx-ng-anh" data-gocphu="' + i + '" aria-pressed="false" title="Camera ' + e_(g.ten) + ' cùng lúc, từ ' + e_(g.bd) + '">Góc khác · ' + e_(g.ten) + '</button>'; }).join("") +
        '</span></div><div id="lvGocPhu" hidden></div></div>') +
      tp("anh", '<div class="hx-qd-anh"><span class="lbl">Ảnh ghi nhận</span><img id="lvAnhGN" src="' + e_(anhNguoi(l)) + '" alt="Ảnh ghi nhận" decoding="async"></div>') +
      tp("seghi", '<div class="hx-chot" id="hxChot"></div>') +
      /* người nghi: 4–5 người thì khối này cao — cuộn riêng (lapCotPhai), không đẩy dài cả thanh */
      tp("dsnguoi", '<div class="hx-qd-nguoi"><div class="hx-ds-ng">' + EV.ng.map(function (n) { return '<div class="hx-ng hx-ng-gon' + (n.khong ? " khong" : "") + '" data-so="' + n.so + '">' +
        (nhieu ? '<div class="ten">' + (n.kieu === "vung" ? "Chỗ có người cử động" : "Người nghi " + n.so) + ' <span class="muted" style="font-weight:400">· ' + hm(n.luc) + (n.luc && n.luc.length > 5 ? n.luc.slice(5) : "") + '</span>' +
          '<label class="hx-chk"><input type="checkbox" data-kh="' + n.so + '"' + (n.khong ? " checked" : "") + (khoa ? " disabled" : "") + '><span>' + (PL ? "Người này không vi phạm" : "Không phải NV Hasaki / không vi phạm") + '</span></label></div>' : "") +
        '<label class="hx-qd-o hx-tb-mt hx-o-an"><span class="lbl">Lỗi</span><div class="hx-cb"><textarea rows="1" autocomplete="off" data-mcb="' + n.so + '" spellcheck="false" placeholder="Bấm để chọn hạng mục vi phạm"' + (khoa ? " disabled" : "") + '>Mục ' + n.muc + '</textarea>' + (khoa ? "" : '<button type="button" class="hx-cb-xoa" data-xoa-muc="' + n.so + '" title="Xoá để chọn lại hạng mục" aria-label="Xoá để chọn lại hạng mục">✕</button>') + '<div class="menu"></div></div></label>' +
        '<label class="hx-qd-o hx-tb-mt hx-o-an"><span class="lbl" data-nhan-ai="' + n.so + '">Là ai</span><div class="hx-cb"><input type="text" autocomplete="off" data-cb="' + n.so + '" placeholder="' + (n.so === EV.ng[0].so && !gy0 ? ((l.chamCong || []).length ? l.chamCong.length + " NV " + (PL ? "trong ca" : "chấm công gần giờ") + " — bấm để chọn" : "Chưa có ứng viên — bấm để chọn / gõ tên, mã NV") : "Bấm để chọn ứng viên hoặc gõ tên / mã NV") + '" value="' + e_(n.ma ? (n.ten ? n.ten + " · " : "") + n.ma : "") + '"' + (khoa ? " disabled" : "") + '>' + (khoa ? "" : '<button type="button" class="hx-cb-xoa" data-xoa-ai="' + n.so + '" title="Xoá để chọn lại người" aria-label="Xoá để chọn lại người">✕</button>') + '<div class="menu"></div></div>' +
          '<span class="hx-ai-phu" data-ai-phu="' + n.so + '"></span></label>' +
        '</div>'; }).join("") + '</div></div>') +
      tp("trangthai", stLuot(l)) +
      /* 17/10 (2) user: 3 chip Xe ra · Không phải NV · Không rõ NGANG HÀNG, «Lưu · lập phiếu» ở dưới 3 chip */
      tp("quyetdinh", '<div class="hx-qd-o hx-qd-nut"><span class="lbl">Quyết định</span><div class="hx-act">' +
        /* 17/10 (6) user «rút gọn chip» — câu đầy đủ ở title (rê chuột) */
        '<button data-qd="2" title="' + (PL ? "Không vi phạm" : "Xe ra / không vi phạm") + '"' + (khoa ? " disabled" : "") + '>Không vi phạm</button><button data-qd="1" title="Không phải NV Hasaki"' + (khoa ? " disabled" : "") + '>Không phải NV</button>' +
        '<button data-qd="3" title="Không rõ – bỏ qua"' + (khoa ? " disabled" : "") + '>Không rõ</button>' + (q.qd && !khoa ? '<button data-qd="-1">Bỏ quyết định</button>' : "") +
        '<button class="chinh" data-qd="0"' + (khoa ? " disabled" : "") + '>Lưu · lập phiếu & chuyển B1.1</button></div></div>') + '</div>';
    $id("mBody").innerHTML = h;
    tbAp();
    ganGhiChu("luot", String(l.id), tenLoai(l.loai) + " · " + l.camera + " · " + (nd.length === 3 ? nd[2] + "/" + nd[1] + "/" + nd[0] : l.ngay) + " " + gioL);
    var lvXem = function () {};   // 16/10 (7) ảnh ghi nhận đứng riêng ở cột phải — không còn đổi qua lại clip/ảnh
    $id("lvAnhGN").onclick = function () { openLB([{ url: anhNguoi(l), title: "Ảnh ghi nhận", sub: l.camera }], 0); };
    ganNutAnh();   // 19/10 (7) chip Ảnh ghi nhận (mặc định ẩn ảnh)
    $id("mBody").querySelectorAll("[data-gocphu]").forEach(function (n) { n.onclick = function () {
      var o = $id("lvGocPhu"), g = l.gocPhu[Number(n.dataset.gocphu)], mo = n.getAttribute("aria-pressed") !== "true";
      $id("mBody").querySelectorAll("[data-gocphu]").forEach(function (x) { x.classList.remove("on"); x.setAttribute("aria-pressed", "false"); });
      var cu = o.querySelector("video"); if (cu) { cu.pause(); cu.removeAttribute("src"); cu.load(); }
      o.innerHTML = ""; o.hidden = !mo; if (!mo) { lapCotPhai(); return; }
      n.classList.add("on"); n.setAttribute("aria-pressed", "true");
      o.innerHTML = '<div class="muted" style="font-size:12px;margin:6px 0 4px">' + e_(g.ten) + ' · cùng thời điểm (đoạn từ ' + e_(g.bd) + ')</div><video controls playsinline muted preload="metadata" style="width:100%;border-radius:8px;background:#000"></video>';
      var v2 = o.querySelector("video"); v2.src = u_(g.url);
      v2.onloadedmetadata = function () { v2.currentTime = Math.max(0, giay(l.gioNguoi || l.tu) - giay(g.bd) - 5); v2.play().catch(function () {}); };
      o.classList.add("hx-hien-mo"); setTimeout(function () { o.classList.remove("hx-hien-mo"); }, 320); lapCotPhai(); }; });
    xongThanhBen(TB);
    var huy = function () { [$id("hxV"), $id("lvGocPhu") && $id("lvGocPhu").querySelector("video")].forEach(function (v) { if (v) { v.pause(); v.removeAttribute("src"); v.load(); } }); };
    $id("mClose").addEventListener("click", huy, { once: true });
    ganVideo(l, dn);
    /* 14/10 user: ô Vi phạm gì ghi RÕ hạng mục (câu QUY-ĐỊNH), gõ để tìm, mục máy gợi ý đánh ★ — như ô «Là ai» */
    taiQD().then(function (ds) { $id("mBody").querySelectorAll("[data-mcb]").forEach(function (t) { ganMucCombo(t, ds, l); }); veChot(); });
    $id("mBody").querySelectorAll("[data-vt]").forEach(function (i) { i.addEventListener("input", function () { EV.ng.find(function (n) { return n.so === Number(i.dataset.vt); }).viTri = i.value; veChot(); }); });
    $id("mBody").querySelectorAll("[data-kh]").forEach(function (c) { c.addEventListener("change", function () { var n = EV.ng.find(function (x) { return x.so === Number(c.dataset.kh); }); n.khong = c.checked; c.closest(".hx-ng").classList.toggle("khong", c.checked); veChot(); }); });
    $id("mBody").querySelectorAll("[data-cb]").forEach(function (i) { ganCombo(i, l); });
    /* 17/10 (8) user «đã chọn NV thì không có dấu xoá ra để chọn lại»: ✕ xoá lựa chọn rồi mở lại danh sách để chọn */
    $id("mBody").querySelectorAll("[data-xoa-ai]").forEach(function (x) { x.onmousedown = function (ev) { ev.preventDefault(); };
      x.onclick = function (ev) { ev.preventDefault(); ev.stopPropagation(); var n = EV.ng.find(function (y) { return y.so === Number(x.dataset.xoaAi); }), i = $id("mBody").querySelector('[data-cb="' + x.dataset.xoaAi + '"]');
        n.ma = ""; n.ten = ""; i.value = ""; veChot(); i.focus(); }; });
    $id("mBody").querySelectorAll("[data-xoa-muc]").forEach(function (x) { x.onmousedown = function (ev) { ev.preventDefault(); };
      x.onclick = function (ev) { ev.preventDefault(); ev.stopPropagation(); var t = $id("mBody").querySelector('[data-mcb="' + x.dataset.xoaMuc + '"]'); t.focus(); if (t._xoa) t._xoa(); }; });
    $id("mBody").querySelectorAll("[data-zoom]").forEach(function (z) { z.onclick = function () { var n = EV.ng[Number(z.dataset.zoom) - 1]; openLB([{ url: n.anh, title: (n.kieu === "vung" ? "Chỗ có người cử động" : "Người nghi " + n.so), sub: l.camera + " · " + n.luc }], 0); }; });
    $id("mBody").querySelectorAll(".hx-mocs [data-b]").forEach(function (f) { f.onclick = function () { var b = l.buocAnh[Number(f.dataset.b)]; lvXem("clip"); tuaToi(giay(b.luc)); }; });
    $id("mBody").querySelectorAll("[data-qd]").forEach(function (b) { b.onclick = function () { luuQD(l, Number(b.dataset.qd)); }; });
    veChot();
  }
  function stLuot(l) {
    var m = l.may, q = l.qd;
    if (m && m.trangThai === "xong") return '<div class="hx-st ok">✓ Đã lập phiếu · B1.1 → ' + e_(m.nv || "") + ' · <a href="https://work.hasaki.vn/tasks?task_id=' + e_(m.phieu) + '" target="_blank" rel="noopener">mở task ' + e_(m.phieu) + '</a></div>';
    if (m && m.trangThai) return '<div class="hx-st ' + (/lỗi|kiểm/.test(m.trangThai) ? "loi" : "") + '">' + e_(m.trangThai) + (m.loi ? ": " + e_(m.loi) : "") + '</div>';
    if (q && q.qd) return '<div class="hx-st">' + (q.qd === QD[0] ? "Đã lưu — máy lập phiếu trong ≤30 phút" : "Đã ghi: " + e_(q.qd)) + ' · ' + (q.nguon === "sheet" ? "từ g-sheet" : "từ dashboard") + '</div>';
    return "";
  }
  function veChot() {
    var el = $id("hxChot"); if (!el || !EV) return;
    var cao0 = el.getBoundingClientRect().height;   // 17/10 (10) chống nhảy: «Sẽ ghi nhận» không co lại khi chữ ngắn đi (chỉ giữ trong lượt đang mở)
    EV.ng.forEach(function (n) { var nh = $id("mBody").querySelector('[data-nhan-ai="' + n.so + '"]'), ph = $id("mBody").querySelector('[data-ai-phu="' + n.so + '"]'); if (!nh) return;
      var c = n.ma ? (EV.l.cong || []).find(function (x) { return x.code === n.ma; }) : null, laGY = !!n.ma && n.ma === EV.l.goiY;
      nh.textContent = laGY ? "Máy gợi ý" : "Là ai"; if (ph) ph.textContent = c ? "vào cổng " + hm(c.gio) : ""; });
    var l = EV.l, mucTen = function (m) { var x = (QDL || []).find(function (y) { return y.muc === m; }); return x ? "mục " + m + " «" + x.cau.slice(0, 60) + (x.cau.length > 60 ? "…" : "") + "»" : "mục " + m; };
    /* lần đầu vẽ của lượt: giữ sẵn chỗ bằng câu DÀI NHẤT có thể (tên dài + câu mục 60 ký tự) ⇒ chọn người/lỗi sau đó không đẩy hàng dưới; chỉ khi 1 người nghi
       (≥2 người thì khối này cuộn riêng — lapCotPhai) */
    if (el._luot !== EV.l.id || (QDL && !el._coQDL)) { el._luot = EV.l.id; el._coQDL = !!QDL; el.style.minHeight = ""; cao0 = 0;   // danh mục quy định nạp sau → giữ chỗ lại 1 lần theo câu thật
      if (EV.ng.length === 1) { var n0 = EV.ng[0], gm = n0.ma, gt = n0.ten, gc = n0.muc, gk = n0.khong; n0.ma = "000000"; n0.ten = "Nguyễn Thị Ngọc Huyền Trang"; n0.khong = false;
        n0.muc = (QDL || []).reduce(function (a, y) { return !a || String(y.cau).length > String(a.cau).length ? y : a; }, null); n0.muc = n0.muc ? n0.muc.muc : gc; veChot();
        cao0 = el.getBoundingClientRect().height; n0.ma = gm; n0.ten = gt; n0.muc = gc; n0.khong = gk; el._luot = EV.l.id; el.style.minHeight = Math.ceil(cao0) + "px";
        veChot(); return; } }   // vẽ lại bằng dữ liệu THẬT (nhãn Máy gợi ý/Là ai + «vào cổng» — lượt đo giữ chỗ vừa ghi đè)
    else if (EV.ng.length === 1) setTimeout(function () { if (cao0 > el.getBoundingClientRect().height) el.style.minHeight = Math.ceil(cao0) + "px"; }, 0);
    el.innerHTML = '<div class="lbl" style="font-size:11px;color:var(--muted);margin-bottom:4px">Sẽ ghi nhận</div>' + EV.ng.map(function (n) {
      var ai = n.kieu === "vung" ? "Chỗ có người cử động" : "Người nghi " + n.so;
      if (n.khong) return '<div class="r">' + ai + ': <b>không vi phạm</b></div>';
      return '<div class="r">' + ai + ': <b>' + (n.ma ? e_((n.ten || "") + " (" + n.ma + ")") : '<span style="color:var(--bad)">chưa chọn NV</span>') + '</b> · vi phạm <b>' + (n.muc ? e_(mucTen(n.muc)) : '<span style="color:var(--bad)">chưa chọn lỗi</span>') + '</b> · tại <b>' + e_(n.viTri) + '</b> · lúc <b>' + ngayVN(l.ngay) + " " + e_(n.luc || "") + '</b></div>';
    }).join("");
  }
  /* 17/10 (2) user «nhấn ô Vi phạm gì thì trường phải thả lên chứ thả xuống phải cuộn xuống để chọn — khi nhấn/gõ thì thả lên và cuộn ở đó, còn lại các khung khoá cứng»:
     trong thanh bên, menu ô chọn đặt CỐ ĐỊNH theo ô (thoát vùng cuộn thẻ người), mở LÊN trên ô (chỉ mở xuống khi phía trên quá chật), cao vừa chỗ, cuộn RIÊNG;
     menu đang mở thì lăn chuột / vuốt ở chỗ khác trong thanh bị chặn — không khung nào trôi. */
  function datMenu(box) {
    var M = $id("modal"), menu = box.querySelector(".menu"); if (!menu || !M.classList.contains("hx-ben") || !box.classList.contains("show")) return;
    /* 17/10 (8) user «dưới còn khoảng trống thì thả lên làm gì · hiệu ứng thả xuống tao nói bao nhiêu lần rồi»: theo khuôn ô chọn của dự án (.cs-list) —
       MỞ XUỐNG ngay dưới ô (cách 6px); chỉ lật LÊN khi phía dưới không đủ chỗ cho menu (dưới < min(menu, 240px)) mà phía trên rộng hơn; hiệu ứng popIn sẵn có. */
    var bx = M.querySelector(".modal-box").getBoundingClientRect(), r = box.getBoundingClientRect(), tren = r.top - bx.top - 12, duoi = bx.bottom - r.bottom - 12;
    var dauMo = !box._daMo; box._daMo = 1;
    menu.style.cssText = "position:fixed;left:0;top:0;right:auto;bottom:auto;animation:none;overscroll-behavior:contain;max-height:none;width:" + Math.round(Math.min(Math.max(r.width, 360), bx.right - r.left - 12)) + "px";
    var can = Math.min(menu.scrollHeight, 360), len = duoi < Math.min(can, 240) && tren > duoi, h = Math.max(120, Math.min(360, len ? tren : duoi));
    menu.style.maxHeight = Math.floor(h) + "px";
    var o = menu.getBoundingClientRect(), mh = Math.min(menu.scrollHeight, h);   // o = gốc toạ độ thật (hộp thanh bên trượt bằng transform)
    menu.style.left = Math.round(r.left - o.left) + "px"; menu.style.top = Math.round((len ? r.top - 6 - mh : r.bottom + 6) - o.top) + "px";
    menu.style.transformOrigin = len ? "bottom" : "top";
    menu.style.animation = dauMo ? "popIn .18s var(--ez-spring,ease)" : "none";   // chỉ lần MỞ mới chạy hiệu ứng — gõ lọc không nháy lại
    khoaCuon(true);
  }
  function boMenu(box) { var menu = box.querySelector(".menu"); if (menu) menu.style.cssText = ""; box._daMo = 0; if (!document.querySelector("#modal .hx-cb.show")) khoaCuon(false); }
  function khoaCuon(bat) {
    var M = $id("modal"); if (!!M._khoaCuon === bat) return;
    if (!bat) { ["wheel", "touchmove"].forEach(function (k) { M.removeEventListener(k, M._khoaCuon, true); }); M._khoaCuon = null; return; }
    M._khoaCuon = function (e) { if (!(e.target.closest && e.target.closest(".hx-cb.show .menu"))) e.preventDefault(); };
    ["wheel", "touchmove"].forEach(function (k) { M.addEventListener(k, M._khoaCuon, { capture: true, passive: false }); });
  }
  function ganCombo(inp, l) {
    var so = Number(inp.dataset.cb), n = EV.ng.find(function (x) { return x.so === so; }), box = inp.parentNode, menu = box.querySelector(".menu"), hT, boLoc = false;
    var item = function (c, nhom) { return '<div class="hx-it" data-ma="' + e_(c.ma || c.code) + '" data-ten="' + e_(c.ten) + '">' + (c.anh ? '<img src="' + e_(c.anh) + '" alt="" referrerpolicy="no-referrer">' : "") +
      '<div><div class="t">' + (c.sao ? '<span class="star">★ </span>' : "") + e_(c.ten) + '</div><div class="s">' + e_(c.ma || c.code) + (c.s ? " · " + e_(c.s) : "") + '</div></div></div>'; };
    var ve2 = function (ds2) {
      var k = boLoc ? "" : inp.value.trim().toLowerCase(), h = "";   // vừa bấm vào (ô đang mang tên đã chọn) → hiện đủ ứng viên, chưa lọc
      var cong = (l.cong || []).filter(function (c) { return !k || (c.ten + " " + c.code).toLowerCase().indexOf(k) >= 0; });
      var cc = (l.chamCong || []).filter(function (c) { return !(l.cong || []).some(function (x) { return x.code === c.code; }) && (!k || (c.ten + " " + c.code).toLowerCase().indexOf(k) >= 0); });
      if (cong.length) h += '<div class="hx-it h">Vào cổng bảo vệ ngay sau (so trang phục)</div>' + cong.map(function (c) { return item({ ma: c.code, ten: c.ten, anh: c.anh, sao: c.code === l.goiY, s: "vào cổng " + hm(c.gio) + (c.phut != null ? " · " + (c.phut >= 0 ? "+" : "") + c.phut + " phút" : "") }); }).join("");
      if (cc.length) h += '<div class="hx-it h">' + (l.loai === "phan-loai" ? "NV PTCH đang trong ca" : "Chấm công gần giờ") + '</div>' + cc.slice(0, 20).map(function (c) { return item({ ma: c.code, ten: c.ten, s: l.loai === "phan-loai" ? "ra " + hm(c.ra || "") : "chấm công " + hm(c.gio) }); }).join("");
      if (ds2 && ds2.length) h += '<div class="hx-it h">Danh bạ</div>' + ds2.map(function (c) { return item({ ma: c.ma, ten: c.ten, s: c.chuc }); }).join("");
      if (!h) h = '<div class="hx-it h">' + (k.length < 2 ? "Gõ ≥2 ký tự để tìm trong danh bạ" : "Không tìm thấy") + '</div>';
      menu.innerHTML = h;
      menu.querySelectorAll("[data-ma]").forEach(function (it) { it.onmousedown = function (ev) { ev.preventDefault(); n.ma = it.dataset.ma; n.ten = it.dataset.ten; inp.value = n.ten + " · " + n.ma; box.classList.remove("show"); boMenu(box); veChot(); }; });
      datMenu(box);
    };
    inp.addEventListener("focus", function () { box.classList.add("show"); boLoc = !!inp.value.trim(); inp.select(); ve2(); });   // ve2() gọi datMenu — menu thả lên
    inp.addEventListener("blur", function () { setTimeout(function () { box.classList.remove("show"); boMenu(box); }, 150);
      var m = inp.value.match(/(?:^|[^\d:])(\d{5,7})(?![\d:])/); if (m && m[1] !== n.ma) { n.ma = m[1]; n.ten = ""; veChot(); } if (!inp.value.trim()) { n.ma = ""; n.ten = ""; veChot(); } });
    inp.addEventListener("input", function () { boLoc = false; ve2(); clearTimeout(hT); var k = inp.value.trim(); if (k.length >= 2) hT = setTimeout(function () { goi("/api/nv?q=" + encodeURIComponent(k)).then(ve2).catch(function () {}); }, 220); });
  }
  function ganMucCombo(inp, ds, l) {
    var n = EV.ng.find(function (x) { return x.so === Number(inp.dataset.mcb); }), box = inp.parentNode, menu = box.querySelector(".menu"), gy = mucMacDinh(l);
    var bo = function (t) { return String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d"); };
    var cauCua = function (m) { var x = ds.find(function (y) { return y.muc === m; }); return x ? x.cau : "Mục " + m; };
    var dat = function () { inp.value = n.muc ? cauCua(n.muc) + " (mục " + n.muc + ")" : ""; inp.title = n.muc ? "Mục " + n.muc + " — bấm để đổi hạng mục" : "Chưa chọn hạng mục";
      inp.style.height = "44px"; };   // 17/10 (10) chống nhảy: ô Lỗi LUÔN cao đúng 2 dòng (mục ngắn/dài, đang gõ hay không)   // 17/10 (10) user «chọn thông tin thì các hàng bị nhảy»: ô Lỗi CỐ ĐỊNH ≤ 2 dòng — bấm/gõ không giãn
    inp._xoa = function () { n.muc = 0; inp.value = ""; veChot(); ve(""); };   // 17/10 (9) user «bấm ✕ ở Lỗi không xoá dữ liệu đã chọn cũ»
    var item = function (x) { return '<div class="hx-it" data-m="' + x.muc + '"><div style="min-width:0"><div class="t">' + (x.muc === gy ? '<span class="star">★ </span>' : "") + e_(x.cau) + '</div>' +
      '<div class="s">Mục ' + x.muc + (x.tru ? " · trừ " + e_(x.tru) + "%" : "") + (x.muc === gy ? " · máy gợi ý" : "") + '</div></div></div>'; };
    var ve = function (k) { k = bo(k); var hop = ds.filter(function (x) { return !k || bo(x.cau + " muc " + x.muc).indexOf(k) >= 0; }), g = hop.filter(function (x) { return x.muc === gy; }), con = hop.filter(function (x) { return x.muc !== gy; });
      menu.innerHTML = (g.length ? '<div class="hx-it h">Máy gợi ý</div>' + g.map(item).join("") : "") + (con.length ? '<div class="hx-it h">' + (k ? "Khớp" : "Mọi hạng mục") + '</div>' + con.map(item).join("") : "") || '<div class="hx-it h">Không thấy hạng mục khớp</div>';
      menu.querySelectorAll("[data-m]").forEach(function (it) { it.onmousedown = function (ev) { ev.preventDefault(); n.muc = Number(it.dataset.m); dat(); box.classList.remove("show"); boMenu(box); inp.blur(); veChot(); }; }); datMenu(box); };
    dat();
    inp.addEventListener("focus", function () { box.classList.add("show"); inp.select(); ve(""); });   // ve() gọi datMenu — menu thả lên
    inp.addEventListener("input", function () { ve(inp.value); });
    inp.addEventListener("keydown", function (ev) { if (ev.key === "Enter") { ev.preventDefault(); var a = menu.querySelector("[data-m]"); if (a) a.dispatchEvent(new MouseEvent("mousedown")); } });
    inp.addEventListener("blur", function () { setTimeout(function () { box.classList.remove("show"); boMenu(box); dat(); }, 150); });
  }
  function luuQD(l, k) {
    var body;
    if (k === -1) body = { id: l.id, qd: "" };
    else if (k === 0) {
      var thieu = EV.ng.find(function (n) { return !n.khong && !n.ma; });
      if (thieu) return baoLoi((thieu.kieu === "vung" ? "Chỗ có người cử động" : "Người nghi " + thieu.so) + ": chưa chọn nhân viên (hoặc tích «không vi phạm»)");
      var thieuMuc = EV.ng.find(function (n) { return !n.khong && !n.muc; });
      if (thieuMuc) return baoLoi((thieuMuc.kieu === "vung" ? "Chỗ có người cử động" : "Người nghi " + thieuMuc.so) + ": chưa chọn lỗi (hạng mục vi phạm)");
      var mucs = QDL || [];
      body = { id: l.id, qd: QD[0], nguoi: EV.ng.map(function (n) { var x = mucs.find(function (y) { return y.muc === n.muc; }); return { so: n.so, ma: n.ma, khong: n.khong, muc: n.muc, cau: x ? x.cau : "", viTri: n.viTri }; }) };
    } else body = { id: l.id, qd: QD[k] };
    goi("/api/quyet-dinh", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
      .then(function (j) { baoOk(k === -1 ? "Đã bỏ quyết định" : k === 0 ? "Đã lưu — máy lập phiếu cho " + (j.ten || "") + " trong ≤30 phút" : "Đã lưu: " + QD[k]);
        return tai(true).then(function () { var l2 = D.luot.find(function (x) { return x.id === l.id; }); if (l2) { var st = $id("mBody").querySelector(".hx-st"); var moi = stLuot(l2); if (st) st.outerHTML = moi || ""; else $id("mBody").querySelector(".hx-act").insertAdjacentHTML("afterend", moi); } if (SUB === "cam") veCam(); }); })
      .catch(function (e) { baoLoi(e.message); });
  }
  function baoOk(t) { if (typeof toast === "function") toast(t, "ok"); else if (typeof showToast === "function") showToast(t); else alert(t); }
  function baoLoi(t) { if (typeof toast === "function") toast(t, "loi"); else if (typeof showToast === "function") showToast(t); else alert(t); }

  /* clip: phát nối các đoạn đã tải từ đầu ghi; "Tự động" = tua ×3 khúc trống, ×1 lúc có người (−4…+10 s).
     05/10 user: "tại sao các clip trên k thấy khung vạch đứt di chuyển theo người khi người di chuyển, cái chỗ thể hiện tên trên khung đó đâu"
     ⇒ DÒ NGƯỜI LIÊN TỤC khi phát (COCO-SSD, ~5 lần/giây, chỉ phát hiện "người", KHÔNG nhận mặt) + bám theo (ghép khung theo độ chồng);
     camera nhìn từ trên không dò ra người → khung bám CHỖ CỬ ĐỘNG trong vùng. Nhãn = "Người nghi N" (khớp khung người ở ảnh mốc)
     → đổi thành TÊN · MÃ NV ngay khi bạn chọn ở ô "Là ai". */
  var MH = null;
  /* 10/10 GIẬT LAG: nạp TF.js + mô hình trên LUỒNG CHÍNH chặn trang 0,8–16 s (đo máy chậm ×4) → chạy trong Web Worker.
     Trả về {detect(video) → Promise<[{class,score,bbox}]> theo khung 640×360}. Worker hỏng → quay về cách cũ trên luồng chính.
     Đo trên Edge THẬT có GPU: mô hình chạy WebGL (luồng chính hay worker) tranh GPU với bộ giải mã video → clip KẸT (rs2) tới khi mô hình xong;
     backend CPU trong worker: clip chạy đều 1 s/s, dò chậm hơn (~1 lượt/1–2 s) nhưng chỉ là khung bám hỗ trợ. */
  function napMoHinhWorker() {
    if (!window.Worker || !window.createImageBitmap) return Promise.resolve(null);
    var code = "importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js','https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js');" +
      "var M=null;onmessage=function(e){var d=e.data;if(d.nap){tf.setBackend('cpu').then(function(){return cocoSsd.load({base:'mobilenet_v2',modelUrl:d.nap});}).then(function(m){M=m;postMessage({san:1,be:tf.getBackend()});},function(x){postMessage({loi:String(x)});});return;}" +
      "if(!M){d.bm&&d.bm.close();postMessage({id:d.id,ds:[]});return;}var t;try{t=tf.browser.fromPixels(d.bm);}catch(x){d.bm.close();postMessage({id:d.id,ds:[],loi:String(x)});return;}" +
      "M.detect(t,20,0.3).then(function(ds){t.dispose();d.bm.close();postMessage({id:d.id,ds:ds});},function(x){t.dispose();d.bm.close();postMessage({id:d.id,ds:[],loi:String(x)});});};";
    return new Promise(function (ok) {
      var w; try { w = new Worker(URL.createObjectURL(new Blob([code], { type: "text/javascript" }))); } catch (e) { ok(null); return; }
      var cho = {}, so = 0, xong = false, het = setTimeout(function () { if (!xong) { xong = true; try { w.terminate(); } catch (e) {} ok(null); } }, 90000);
      w.onerror = function () { if (!xong) { xong = true; clearTimeout(het); ok(null); } };
      w.onmessage = function (e) { var d = e.data;
        if (d.san || d.loi && d.id == null) { if (xong) return; xong = true; clearTimeout(het); ok(d.san ? { detect: function (v) { var id = ++so;
          return createImageBitmap(v, { resizeWidth: 640, resizeHeight: 360 }).then(function (bm) { return new Promise(function (r) { cho[id] = r; w.postMessage({ id: id, bm: bm }, [bm]); }); }); } } : null); return; }
        if (cho[d.id]) { cho[d.id](d.ds || []); delete cho[d.id]; } };
      w.postMessage({ nap: API + "/m/model.json" });
    });
  }
  function napMoHinh() {
    if (MH) return MH;
    return (MH = napMoHinhWorker().then(function (wk) { return wk || napMoHinhChinh(); }));
  }
  function napMoHinhChinh() {   // cách cũ (luồng chính) — chỉ khi Worker không chạy được
    var MH;
    var nap = function (src) { return new Promise(function (r, j) { var s = document.createElement("script"); s.src = src; s.onload = r; s.onerror = j; document.head.appendChild(s); }); };
    MH = (window.cocoSsd ? Promise.resolve() : nap("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js").then(function () { return nap("https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js"); }))
      .then(function () { return cocoSsd.load({ base: "mobilenet_v2", modelUrl: API + "/m/model.json" }); })
      .then(function (m) { var c = document.createElement("canvas"); c.width = 640; c.height = 360; var g = c.getContext("2d");
        return { detect: function (v) { g.drawImage(v, 0, 0, 640, 360); return m.detect(c, 20, 0.3); } }; }).catch(function () { return null; });
    return MH;
  }
  function ganVideo(l, dn) {
    var v = $id("hxV"), ov = $id("hxOv"), g = ov.getContext("2d"), src = l.video || [], idx = 0, toc = "auto", tocTo = null;
    if (!src.length) { v.parentNode.innerHTML = '<div class="hx-trong" style="color:#ccc">Không còn video của lượt này (đầu ghi chỉ giữ đoạn đã tải 14 ngày).</div>'; return; }
    var S = giay(src[0].bd), E = giay(l.den) + 3, tong = Math.max(1, E - S);
    var tl = $id("hxTl"); tl.innerHTML = dn.map(function (d) { return '<div class="dn" style="left:' + ((d[0] - S) / tong * 100) + '%;width:' + Math.max(0.6, (d[1] - d[0] + 4) / tong * 100) + '%"></div>'; }).join("") +
      (l.buocAnh || []).map(function (b, i) { var x = Math.max(1.5, Math.min(98.5, (giay(b.luc) - S) / tong * 100));
        return '<div class="mk" style="left:' + x + '%"></div><button class="mkn' + (b.doNguoi ? " ng" : "") + '" data-tmk="' + i + '" style="left:' + x + '%" title="' + e_(b.nhan) + ' — bấm để tua tới">' + (i + 1) + '</button>'; }).join("") + '<div class="cur" id="hxCur"></div>';
    /* 17/10 (2) user «① trước ② sau này là gì — hiển thị ở thanh thời gian clip luôn»: mốc = các ảnh máy chụp (trước / lúc gửi xe / sau) → số tròn trên thanh, bấm tua tới */
    tl.querySelectorAll("[data-tmk]").forEach(function (m) { m.onclick = function (ev) { ev.stopPropagation(); tuaToi(giay(l.buocAnh[Number(m.dataset.tmk)].luc)); }; });
    v.crossOrigin = "anonymous";   // video từ máy chủ 127.0.0.1:8591 (khác nguồn) — thiếu dòng này canvas bị khoá, không dò được người
    var nap = function (i, t) { idx = i; v.src = u_(src[i].url); v.onloadedmetadata = function () { if (t != null) v.currentTime = Math.max(0, t - giay(src[i].bd)); v.play().catch(function () {}); }; };
    var bayGio = function () { return giay(src[idx].bd) + (v.currentTime || 0); };
    var trongNguoi = function (t) { return dn.some(function (d) { return t >= d[0] - 4 && t <= d[1] + 10; }); };
    window.__hxTua = function (t) { var i = 0; for (var k = 0; k < src.length; k++) if (giay(src[k].bd) <= t) i = k; tracks = []; prevXam = null;
      if (i !== idx || !v.src) nap(i, t); else { v.currentTime = Math.max(0, t - giay(src[i].bd)); v.play().catch(function () {}); } };
    var roi = l.roi || null, R = roi ? [roi[0] - 90, roi[1] - 110, roi[2] + 90, roi[3] + 40] : [0, 0, 1280, 720];   // vùng xét rộng hơn khung vàng một chút
    /* 10/10 GIẬT LAG: nạp TF.js + mô hình ngay lúc mở pop-up chặn luồng chính 0,8 s (có lần 14 s ở máy chậm) → đợi pop-up vẽ xong + trình duyệt rảnh */
    var model = null, henMH = function () { napMoHinh().then(function (m) { model = m; }); };
    if (window.requestIdleCallback) requestIdleCallback(function () { setTimeout(henMH, 600); }, { timeout: 2500 }); else setTimeout(henMH, 1200);
    var off = document.createElement("canvas"); off.width = 640; off.height = 360; var og = off.getContext("2d");   // 10/10: mô hình đọc qua WebGL — không ép canvas về CPU (willReadFrequently chỉ cho canvas nhỏ đọc điểm ảnh)
    var nho = document.createElement("canvas"); nho.width = 160; nho.height = 90; var ng2 = nho.getContext("2d", { willReadFrequently: true });
    var tracks = [], soMoi = 1, ban = false, lanCuoi = 0, prevXam = null;
    var iou = function (a, b) { var x1 = Math.max(a[0], b[0]), y1 = Math.max(a[1], b[1]), x2 = Math.min(a[2], b[2]), y2 = Math.min(a[3], b[3]); var i = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
      return i / ((a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - i || 1); };
    var trongR = function (b) { var cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2; return cx > R[0] && cx < R[2] && cy > R[1] && cy < R[3]; };
    function vungCuDong(nguon) {   // khung bao chỗ đổi điểm ảnh so với lần dò trước, chỉ trong vùng xét
      ng2.drawImage(nguon, 0, 0, 160, 90); var d = ng2.getImageData(0, 0, 160, 90).data, xam = new Uint8Array(160 * 90);
      for (var i = 0; i < xam.length; i++) xam[i] = (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 3;
      var p = prevXam; prevXam = xam; if (!p) return null;
      var a = 160, b = 90, c = -1, e = -1, n = 0;
      for (var y = 0; y < 90; y++) for (var x = 0; x < 160; x++) { var X = x * 8, Y = y * 8; if (X < R[0] || X > R[2] || Y < R[1] || Y > R[3]) continue;
        if (Math.abs(xam[y * 160 + x] - p[y * 160 + x]) > 28) { n++; if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > e) e = y; } }
      return n >= 14 ? [a * 8, b * 8, (c + 1) * 8, (e + 1) * 8] : null;
    }
    function ganTen(tr, t) {   // khớp khung đang bám với khung "Người nghi N" ở ảnh mốc gần nhất → biết đây là Người nghi số mấy
      if (tr.so) return;
      (l.buocAnh || []).forEach(function (b) { if (tr.so || !b.hop || !b.hop.length || Math.abs(giay(b.luc) - t) > 2.5) return;
        b.hop.forEach(function (h, i) { if (!tr.so && iou(tr.box, [h[0] * 1280, h[1] * 720, h[2] * 1280, h[3] * 720]) > 0.15) tr.so = i + 1; }); });
    }
    function nhan(tr) {
      if (tr.kieu === "vung" && !tr.so) return "Chỗ cử động";
      var n = tr.so && EV && EV.ng ? EV.ng.find(function (x) { return x.so === tr.so; }) : null;
      if (n && n.ma) return (n.ten || "NV") + " · " + n.ma;
      return tr.so ? "Người nghi " + tr.so : "Người trong vùng";
    }
    function xongVung(dong, t) {
      var hop = dong ? [dong] : [];
      hop.forEach(function (b) { var tot = null, s = 0; tracks.forEach(function (tr) { var o = iou(tr.box, b); if (o > s) { s = o; tot = tr; } });
        if (tot && s > 0.12) { tot.box = tot.box.map(function (v0, k) { return v0 * 0.35 + b[k] * 0.65; }); tot.luc = t; tot.kieu = "vung"; }
        else tracks.push({ id: soMoi++, box: b.slice(), luc: t, kieu: "vung" }); });
      tracks = tracks.filter(function (tr) { return Math.abs(t - tr.luc) < 1.6; }); tracks.forEach(function (tr) { ganTen(tr, t); }); veOv();
    }
    function doTim() {
      if (ban || !v.videoWidth) return; ban = true; var t = bayGio();
      if (!model) { var d0 = vungCuDong(v); ban = false; xongVung(d0, t); return; }   // 10/10 GIẬT LAG: chưa có mô hình → chỉ chép khung 160×90 (trước: chép 640×360 mỗi lượt)

      var xong = function (hop, kieu) {
        hop.forEach(function (b) { var tot = null, s = 0; tracks.forEach(function (tr) { var o = iou(tr.box, b); if (o > s) { s = o; tot = tr; } });
          if (tot && s > 0.12) { tot.box = tot.box.map(function (v0, k) { return v0 * 0.35 + b[k] * 0.65; }); tot.luc = t; tot.kieu = kieu; }
          else tracks.push({ id: soMoi++, box: b.slice(), luc: t, kieu: kieu }); });
        tracks = tracks.filter(function (tr) { return Math.abs(t - tr.luc) < 1.6; });
        tracks.forEach(function (tr) { ganTen(tr, t); }); ban = false; veOv();
      };
      var dong = vungCuDong(v);
      model.detect(v).then(function (ds) { var dm = window.__hxDem || (window.__hxDem = { lan: 0, nguoi: 0 }); dm.lan++; if (ds.some(function (d) { return d.class === "person"; })) dm.nguoi++;   // bộ đếm cho qc-xacminh-cu
        var ng = ds.filter(function (d) { return d.class === "person"; }).map(function (d) { return [d.bbox[0] * 2, d.bbox[1] * 2, (d.bbox[0] + d.bbox[2]) * 2, (d.bbox[1] + d.bbox[3]) * 2]; }).filter(trongR);
        if (ng.length) xong(ng, "nguoi"); else xong(dong ? [dong] : [], "vung");
      }).catch(function () { ban = false; });
    }
    function veOv() {
      g.clearRect(0, 0, 1280, 720); var t = bayGio();
      if (roi) { g.strokeStyle = "#f1c40f"; g.lineWidth = 4; g.setLineDash([]); g.strokeRect(roi[0], roi[1], roi[2] - roi[0], roi[3] - roi[1]); }
      var daVe = [];   // nhãn đã vẽ — nhãn sau chồng lên thì dời lên trên (2 người đứng sát nhau)
      tracks.forEach(function (tr) { var b = tr.box;
        g.strokeStyle = "#e74c3c"; g.lineWidth = 5; g.setLineDash([16, 9]); g.lineDashOffset = -((Date.now() / 40) % 25); g.strokeRect(b[0], b[1], b[2] - b[0], b[3] - b[1]); g.setLineDash([]);
        var chu = nhan(tr); g.font = "bold 24px Arial"; var w = g.measureText(chu).width + 16, x = Math.min(b[0], 1280 - w), y = Math.max(0, b[1] - 36);
        for (var lap = 0; lap < 6 && daVe.some(function (o) { return x < o[0] + o[2] && x + w > o[0] && y < o[1] + 32 && y + 32 > o[1]; }); lap++) y = y >= 36 ? y - 36 : y + 36 + lap * 36;
        daVe.push([x, y, w]);
        if (y + 32 < b[1] - 4) { g.strokeStyle = "#e74c3c"; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 14, y + 32); g.lineTo(Math.max(b[0], Math.min(b[2], x + 14)), b[1]); g.stroke(); }   // vạch nối nhãn bị dời lên với khung
        g.fillStyle = "#e74c3c"; g.fillRect(x, y, w, 32); g.fillStyle = "#fff"; g.fillText(chu, x + 8, y + 24); });
      if (toc === "auto") { var r = trongNguoi(t) ? 1 : 3; if (v.playbackRate !== r) v.playbackRate = r; }
      $id("hxGio").textContent = hms(t);   // 17/10 (2) user «có sẵn ×1 ×2 ×3 rồi hiện thêm ×3 làm gì — tô màu nút»: tốc độ đang chạy = nút được tô
      var dang = toc === "auto" && !v.paused ? String(v.playbackRate) : ""; if (dang !== tocTo) { tocTo = dang; document.querySelectorAll(".hx-vbar [data-toc]").forEach(function (x) { x.classList.toggle("dang", x.dataset.toc === dang); }); }
      var cur = $id("hxCur"); if (cur) cur.style.left = ((t - S) / tong * 100) + "%";
    }
    (function vong() { if (!document.body.contains(v)) return;   // 10/10 GIẬT LAG: dò 2,5 lần/giây (trước 5), video dừng thì KHÔNG vẽ lại lớp khung mỗi khung hình
      if (!v.paused) { if (performance.now() - lanCuoi > 400) { lanCuoi = performance.now(); doTim(); } veOv(); } requestAnimationFrame(vong); })();
    v.addEventListener("seeked", function () { prevXam = null; doTim(); });
    v.addEventListener("play", function () { $id("hxPlay").textContent = "⏸"; }); v.addEventListener("pause", function () { $id("hxPlay").textContent = "▶"; veOv(); });
    v.addEventListener("ended", function () { if (idx + 1 < src.length) nap(idx + 1, giay(src[idx + 1].bd)); });
    $id("hxPlay").onclick = function () { if (!v.src) nap(0, dn.length ? Math.max(S, dn[0][0] - 6) : S); else if (v.paused) v.play(); else v.pause(); };
    document.querySelectorAll(".hx-vbar [data-toc]").forEach(function (b) { b.onclick = function () { toc = b.dataset.toc; document.querySelectorAll(".hx-vbar [data-toc]").forEach(function (x) { x.classList.toggle("on", x === b); }); if (toc !== "auto") v.playbackRate = Number(toc); veOv(); }; });
    tl.onclick = function (ev) { var r = tl.getBoundingClientRect(); window.__hxTua(S + (ev.clientX - r.left) / r.width * tong); };
    document.querySelectorAll(".hx-tlg [data-tua]").forEach(function (b) { b.onclick = function () { window.__hxTua(Number(b.dataset.tua) - 4); }; });
    nap(0, dn.length ? Math.max(S, dn[0][0] - 6) : S);
  }
  function tuaToi(t) { if (window.__hxTua) window.__hxTua(t - 2); }

  /* ---------- 3) PHIẾU TREO ---------- */
  /* 05/10 QC: thay mã luật (KHAC/TB-02…) bằng MỨC MÁY BIẾT viết thường — đúng Hướng 1 user duyệt (chắc chắn → bấm là xong; cần chọn; đang tra; chưa tra được).
     Mã luật vẫn còn trong tooltip cho chủ máy tra sổ luật. */
  var MUC_MAY = { chac: ["Máy chắc chắn", "good"], vua: ["Máy gợi ý · cần bạn xem", "warn"], chon: ["Cần bạn quyết", "warn"], tam: ["Nhờ anh Tâm kiểm tra thực tế", "warn"], cam: ["Máy tra camera giờ báo cáo", "info"], tudong: ["Máy tự xử theo luật vệ sinh", "info"], tra: ["Chờ camera xác nhận", "info"], khong: ["Máy đang tìm bằng chứng", ""], quyet: ["Bạn đã quyết · chờ máy làm", "info"], xong: ["Đã xử lý", "good"] };
  function mucMay(p) {
    var x = p.xm || {}, g = p.goiY;
    /* 20/10 user «14115619 ghi Đã xử lý mà vẫn treo B1»: cột «Đã xử lý» = «Đã đưa vào hàng chờ cắt clip camera» (12/10) bị coi là XONG.
       Câu hàng chờ / đang làm KHÔNG phải xong → xét tiếp như phiếu thường (bằng chứng + gợi ý của máy). */
    if (x.daXuLy && !/hàng chờ|đang /i.test(x.daXuLy)) return "xong"; if (p.qdB1 && !/^Cắt thêm clip/.test(p.qdB1.qd || "")) return "quyet";
    /* 07/10 luật vệ sinh VS-06/VS-07 (canh-b11 ⑤ ghi vesinh-xet.json): kho bụi quá 8h / camera đã đo → nhờ anh Tâm; báo cáo trong 8h → máy tra camera lượt kế; còn lại máy tự xử */
    var vs = p.vs; if (vs) { if (vs.bui || vs.camSo || vs.cam) return "tam"; if (vs.hanhDong === "camera") return "cam"; if (vs.hanhDong === "dong-b1" || /^nghi_/.test(vs.hanhDong || "")) return "tudong"; }
    if (!g || (typeof coBC === "function" && !coBC(p))) return "khong";
    if (g.doChac === "CAO" || (g.ketLuan === "B1.1" && !g.doChac)) return "chac";   // 10/10 QC: B1.1 độ chắc VỪA (A1-01 phụ trách kệ, TB-03 người châm gần nhất) KHÔNG được gọi «chắc chắn»
    if (g.ketLuan === "B1.1") return "vua";
    if (/^cho-/.test(g.ketLuan || "") || g.ketLuan === "canh-b11") return "tra";
    if (g.ketLuan === "nghi-ngo" || (g.nv || []).length) return "chon";   // máy đã tra, còn nghi ngờ → bạn quyết
    return "khong";
  }
  function veTreo() {
    var thuTu = ["B1", "B1.1", "B2", "B2.1", "B3.1", "B3.2", "B3.3", "B4", "B4.1", "B5", "Điều hướng"], dem = {}, demM = {}, THU = ["chac", "vua", "chon", "tam", "cam", "tudong", "tra", "quyet", "khong", "xong"];
    D.phieu.forEach(function (p) { dem[p.buoc] = (dem[p.buoc] || 0) + 1; var m = mucMay(p); demM[m] = (demM[m] || 0) + 1; });
    var ds = D.phieu.filter(function (p) { return (!LOC.buoc || p.buoc === LOC.buoc) && (!LOC.treo || (p.treoGio || 0) > 48) && (!LOC.mucMay || (LOC.mucMay === "gc" ? !!gcCua(p.id) : mucMay(p) === LOC.mucMay)) &&
      (!TIM || (p.code + " " + p.viTri + " " + p.loi + " " + p.nguoiBuoc + " " + p.nv.map(function (v) { return v.ten + " " + v.ma; }).join(" ")).toLowerCase().indexOf(TIM.toLowerCase()) >= 0); })
      .sort(function (a, b) { var sx = LOC.sxTreo; if (sx && sx.k) { var v = function (p) { return sx.k === "luc" ? String(p.ngayVP || "") : sx.k === "treo" ? (p.treoGio || 0) : sx.k === "ai" ? (aiPhieu(p) ? 0 : 1) + aiPhieu(p) : (coBC(p) ? 0 : 1); };
        var x = v(a), y = v(b); if (x !== y) return (x > y ? 1 : -1) * sx.d; } return THU.indexOf(mucMay(a)) - THU.indexOf(mucMay(b)) || (b.treoGio || 0) - (a.treoGio || 0); });
    var h = boLoc([{ k: "mucMay", lbl: "Máy đã biết tới đâu", v: LOC.mucMay || "", opt: [["", "Tất cả (" + D.phieu.length + ")"]].concat(THU.filter(function (k) { return demM[k]; }).map(function (k) { return [k, MUC_MAY[k][0] + " (" + demM[k] + ")"]; }))
        .concat((function () { var n = D.phieu.filter(function (p) { return gcCua(p.id); }).length; return n || LOC.mucMay === "gc" ? [["gc", "Có ghi chú (" + n + ")"]] : []; })()) },
      { k: "buoc", lbl: "Đang ở bước", v: LOC.buoc, opt: [["", "Mọi bước (" + D.phieu.length + ")"]].concat(thuTu.filter(function (b) { return dem[b]; }).map(function (b) { return [b, b + " (" + dem[b] + ")"]; })) },
      { k: "treo", lbl: "Thời gian treo", v: LOC.treo, opt: [["", "Tất cả"], ["48", "Quá 48 giờ"]] },
      { k: "tim", lbl: "Tìm (vị trí / tên NV)", input: 1, v: TIM, ph: "F0-A1 / Nguyễn…" }]);
    /* 05/10 user: cột Theo phiếu ↔ Máy tự bắt phải ĐỒNG BỘ (Lúc · Ở đâu · Lỗi · Bằng chứng · Máy gợi ý là ai · Việc tiếp theo);
       chỉ khác cột cuối (phiếu đã có task → Chuyển/Quyết; máy tự bắt chưa có task → Lập phiếu). Chưa có bằng chứng thì KHÔNG cho quyết. */
    /* 05/10 lag cuộn: hiện 30 phiếu/lần (đo trước sửa: 3.864 phần tử trang, 4 long task 340 ms khi cuộn) */
    taiGC(veTreo); ds = donGC(ds, function (p) { return p.id; });   // 20/10 phiếu có ghi chú dồn cuối, làm mờ
    var SO = Math.max(30, Number(LOC.soHienTreo) || 30), dsHien = ds.slice(0, SO);
    h += '<div class="panel"><div class="panel-head"><span>Phiếu đang mở</span><span>' + (ds.length > dsHien.length ? '1–' + dsHien.length + ' / ' + ds.length : '') + '</span></div>' +
      '<div class="table-wrap"><table class="hx-chung" style="table-layout:fixed;width:100%;min-width:0"><thead><tr>' + cotSx(LOC.sxTreo) + '</tr></thead><tbody>' +
      (dsHien.map(function (p) { var b = bcPhieu(p), ai = aiPhieu(p), mm = MUC_MAY[mucMay(p)] || ["", ""];
        return '<tr data-p="' + e_(p.id) + '"' + (gcCua(p.id) ? ' class="hx-gc-mo"' : "") + '>' +
          '<td><b class="hx-vt">' + e_((p.lsKho && p.lsKho.bin) || p.viTri || "—") + '</b><div class="muted" style="font-size:12px">' + e_(String(p.ngayVP || "").slice(8, 10) + "/" + String(p.ngayVP || "").slice(5, 7) + " " + String(p.ngayVP || "").slice(11, 16)) + (b.kenh ? " · " + e_(b.kenh) : "") + '</div>' + coGC(p.id) + '</td>' +
          '<td style="white-space:normal" title="' + e_(p.loi) + '"><div class="hx-l2">' + e_(p.loi) + '</div></td>' +
          '<td>' + oBC(b, p.id) + '</td>' +
          '<td style="white-space:normal">' + (ai ? '<b>' + e_(ai) + '</b>' : '<span class="muted">Chưa có ứng viên</span>') + '<div style="margin-top:3px"><span class="hx-tag ' + mm[1] + '"' + (p.goiY ? ' title="Luật ' + e_(p.goiY.luat) + '"' : "") + '>' + e_(String(mm[0]).replace(/^Máy gợi ý · /, "")) + '</span></div>' + taoBoi(p) + '</td>' +
          '<td>' + viecPhieu(p, b) + '</td></tr>'; }).join("") ||
        '<tr><td colspan="5"><div class="empty-row">Không có phiếu khớp bộ lọc.</div></td></tr>') + '</tbody></table></div>' +
      '<div class="cardlist">' + dsHien.map(function (p) { var b = bcPhieu(p), ai = aiPhieu(p), mm = MUC_MAY[mucMay(p)] || ["", ""];
        return '<div class="cl-item' + (gcCua(p.id) ? " hx-gc-mo" : "") + '" data-p="' + e_(p.id) + '"><div class="cl-body">' + coGC(p.id) + '<div class="cl-top"><span class="hx-tag ' + mm[1] + '">' + e_(String(mm[0]).replace(/^Máy gợi ý · /, "")) + '</span>' + treoTag(p.treoGio) + '</div>' +
          '<div class="cl-loi hx-l2">' + e_(p.loi) + '</div><div class="cl-kv">Ở đâu: <b>' + e_((p.lsKho && p.lsKho.bin) || p.viTri || "—") + '</b> · ' + e_(String(p.ngayVP || "").slice(8, 10) + "/" + String(p.ngayVP || "").slice(5, 7)) + '</div>' +
          '<div class="cl-kv">' + oBC(b, p.id) + '</div><div class="cl-kv">Máy gợi ý: <b>' + e_(ai || "chưa có ứng viên") + '</b></div>' + taoBoi(p) + '<div class="cl-kv" style="margin-top:6px">' + viecPhieu(p, b).replace(/ · treo [^·<]+ · /, " · ") + '</div></div></div>'; }).join("") + '</div>' + (ds.length > dsHien.length ? '<div style="padding:12px 16px;text-align:center"><button class="hx-nut" id="hxThem">Xem thêm ' + Math.min(30, ds.length - dsHien.length) + ' phiếu (còn ' + (ds.length - dsHien.length) + ')</button></div>' : "") + '</div>';
    $id("hxBody").innerHTML = h; khoaHang($id("hxBody"));
    if ($id("hxThem")) $id("hxThem").onclick = function () { LOC.soHienTreo = SO + 30; veTreo(); };
    $id("hxBody").querySelectorAll("[data-sx]").forEach(function (b) { b.onclick = function (ev) { ev.stopPropagation(); var k = b.dataset.sx, c = LOC.sxTreo;
      LOC.sxTreo = c && c.k === k ? (c.d > 0 ? { k: k, d: -1 } : null) : { k: k, d: k === "treo" ? -1 : 1 }; LOC.soHienTreo = 30; luu(); veTreo(); }; });
    $id("hxBody").querySelectorAll("[data-qd]").forEach(function (b) { b.onclick = function (ev) { ev.stopPropagation(); var p = D.phieu.find(function (x) { return x.id === b.dataset.qd; }); if (p) moQD(p); }; });
    $id("hxBody").querySelectorAll("[data-phat]").forEach(function (b) { b.onclick = function (ev) { ev.stopPropagation(); var p = D.phieu.find(function (x) { return x.id === b.dataset.phat; }); if (p) moQD(p); }; });
    $id("hxBody").querySelectorAll("[data-bcanh]").forEach(function (im) { im.onclick = function (ev) { ev.stopPropagation(); if (typeof openLB === "function") openLB((im.dataset.ds ? im.dataset.ds.split("|") : [im.dataset.bcanh]).map(function (u) { return { url: u, title: im.alt || "Bằng chứng" }; }), 0); else window.open(im.dataset.bcanh, "_blank", "noopener"); }; });
    ganLoc(function (k, v, go) { if (k === "tim") TIM = v; else LOC[k] = v; LOC.soHienTreo = 30; luu(); veTreo(); if (go) { var i = $id("hxFilters").querySelector("input"); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } } });
    $id("hxBody").querySelectorAll("tr[data-p], .cl-item[data-p]").forEach(function (r) { r.onclick = function (ev) { if (ev.target.closest("a,button,img")) return; var p = D.phieu.find(function (x) { return x.id === r.dataset.p; }); if (p) moQD(p); }; });
    danhDauDangXem();
  }
  /* 16/10 vỏ thanh bên dùng CHUNG ở index.html (window.hskThanhBen) — đây chỉ gắn khoá + bộ chọn dòng của Xác minh (phiếu data-p / sự việc data-lid) */
  var CSSe = function (v) { return window.CSS && CSS.escape ? CSS.escape(v) : String(v).replace(/["\\]/g, "\\$&"); };
  function danhDauDangXem() { if (window.hskThanhBen) hskThanhBen.toDam(); }
  function moThanhBen(khoa) { return hskThanhBen.mo(khoa, '#hxBody [data-p="' + CSSe(khoa) + '"], #hxBody [data-lid="' + CSSe(khoa) + '"]'); }
  /* 16/10 (6)(7) cột phải: phần DỮ LIỆU dưới ảnh (Ai tác động · Người trong khung đỏ) cuộn RIÊNG, cao vừa chỗ còn lại tới đáy thanh —
     không bắt cuộn cả thanh. «Ai tác động» tối đa 5 dòng (đo thật, đo 2 lần vì thanh cuộn làm dòng hẹp lại). Xếp chồng (hẹp/điện thoại) thì để tự nhiên. */
  function lapCotPhai(daLang) { var bx = $id("modal").querySelector(".modal-box"), C = $id("mBody").querySelector(".hx-qd-ls .hx-lans, .hx-qd-nguoi .hx-ds-ng");
    var hd0 = bx && bx.querySelector(".modal-head"), M1 = $id("modal");   // 19/10 clip dính ngay dưới đầu thanh (đầu thanh cũng dính) — bám cao đầu thanh khi tiêu đề đổi
    if (hd0) { M1.style.setProperty("--hx-dau", hd0.offsetHeight + "px"); if (!M1._roDau && window.ResizeObserver) { M1._roDau = new ResizeObserver(function () { M1.style.setProperty("--hx-dau", hd0.offsetHeight + "px"); }); M1._roDau.observe(hd0); } }
    var imA0 = $id("mBody").querySelector(".hx-tb-luoi .hx-qd-anh img"); if (imA0) imA0.style.removeProperty("max-height");
    /* 19/10 user «clip dính rồi mà cuộn xuống không ăn, cuộn 3–5 lần chỉ động đậy»: thanh hẹp/điện thoại xếp 1 cột, clip dính trên ⇒ KHÔNG còn vùng cuộn lồng
       (danh sách Ai tác động / người nghi / Sẽ ghi nhận cao tự nhiên, cả thanh cuộn). Trước đây danh sách bị kẹp 5 dòng + overscroll contain ⇒ lăn trúng nó là kẹt. */
    if (bx.clientWidth <= 820) { [C, $id("hxChot")].forEach(function (e) { if (e) e.style.maxHeight = ""; }); qdDay(bx, $id("mBody").querySelector('.hx-tb-luoi>.hx-tb-khung>[data-tp="quyetdinh"]')); return; }
    var qdTp = $id("mBody").querySelector('.hx-tb-luoi>.hx-tb-khung>[data-tp="quyetdinh"]'); if (qdTp) { qdTp.style.marginTop = "0px"; qdTp.style.marginBottom = ""; qdTp.closest(".hx-tb-luoi").style.minHeight = ""; }   // đo khi CHƯA đẩy đáy
    /* 17/10 (2) «Sẽ ghi nhận» dưới Ảnh ghi nhận, đứng CẠNH clip: nhiều người nghi thì cuộn riêng tới đáy clip — không đẩy cao cả hàng clip (cả thanh phải cuộn) */
    var sg = $id("hxChot"), kc = $id("mBody").querySelector('[data-tp="clip"]');
    if (sg && kc) { sg.style.maxHeight = ""; var rs = sg.getBoundingClientRect(), rc = kc.getBoundingClientRect(); if (rs.left >= rc.right - 1 && rs.bottom > rc.bottom + 1) sg.style.maxHeight = Math.max(72, Math.floor(rc.bottom - rs.top)) + "px"; }
    if (!C) { qdDay(bx, qdTp); return; }
    var cot = C.closest(".hx-cot-phai"), kh = C.closest(".hx-tb-khung"), haiCot = kh ? kh.getBoundingClientRect().width < kh.parentNode.getBoundingClientRect().width - 20 : cot && getComputedStyle(cot).display !== "contents";   // 17/10 khung thanh bên: khung đứng cạnh khung khác = cuộn riêng
    var mot1 = C.classList.contains("hx-ds-ng") && EV && EV.ng && EV.ng.length === 1;   // 17/10 (10) user «không làm cuộn khung này»
    for (var k = 0; k < 2; k++) { C.style.maxHeight = "";
      var c = [].filter.call(C.children, function (z) { return z.offsetParent !== null; }), nam =C.classList.contains("hx-lans") && c.length > 5 ? c[5].getBoundingClientRect().top - c[0].getBoundingClientRect().top : Infinity;
      /* 17/10 (3) khung thanh bên (cả khi rộng hết thanh): vùng người nghi cuộn riêng, chừa chỗ cho phần đứng SAU nó trong khung (trạng thái, Quyết định) */
      var tpC = kh && C.closest(".hx-tb-tp"), sau = tpC ? kh.getBoundingClientRect().bottom - tpC.getBoundingClientRect().bottom : 0;
      var con = haiCot || (kh && window.innerWidth > 760) ? bx.getBoundingClientRect().bottom - C.getBoundingClientRect().top - 24 - sau : Infinity;
      var kcl = kh && $id("mBody").querySelector('[data-tp="clip"]'), rcl = kcl && kcl.getBoundingClientRect(), rC = C.getBoundingClientRect();   // 17/10 (4) danh sách đứng CẠNH clip: không dài quá đáy clip
      if (rcl && rC.left >= rcl.right - 1 && rC.top < rcl.bottom) con = Math.min(con, rcl.bottom - rC.top);
      var h = Math.min(nam, Math.max(120, con)); C.style.maxHeight = mot1 ? "" : isFinite(h) && C.scrollHeight > h + 1 ? Math.floor(h) + "px" : ""; }   // 1 người nghi: KHÔNG giới hạn (không cuộn)
    /* 17/10 (4) đo thật: cả thanh vẫn tràn (vd phiếu không có camera — Ai tác động 5 dòng + ảnh cao hơn hàng trên) → bớt đúng phần tràn ở danh sách (sàn 120px) */
    var tran = bx.scrollHeight - bx.clientHeight;
    /* 17/10 (10) 1 người nghi mà vẫn thiếu vài px (vd lượt đã có dòng trạng thái — đo thật 13/10 BXM 13:50): thu CHIỀU CAO ẢNH ghi nhận (ảnh cắt giữa, bấm xem đủ)
       — không cuộn vùng người nghi, không đụng chỗ giữ của «Sẽ ghi nhận» (chọn Lỗi/người sau đó không làm hàng nhảy — J1) */
    var imA = $id("mBody").querySelector(".hx-tb-luoi .hx-qd-anh img");
    if (imA && tran > 1 && mot1) { imA.style.setProperty("max-height", Math.max(100, Math.floor(imA.getBoundingClientRect().height - tran)) + "px", "important"); tran = bx.scrollHeight - bx.clientHeight; }
    if (kh && tran > 1 && window.innerWidth > 760 && C.clientHeight > 100 && !mot1) C.style.maxHeight = Math.max(100, Math.floor(C.clientHeight - tran)) + "px";
    /* 17/10 (7) cột trái hẹp: 4–5 người nghi thì «Sẽ ghi nhận» cao ~450px → còn tràn thì bớt nốt ở đây (cuộn riêng, sàn 72px) */
    tran = bx.scrollHeight - bx.clientHeight; if (sg && kh && tran > 1 && window.innerWidth > 760 && sg.clientHeight > 72 && EV && EV.ng && EV.ng.length >= 2) sg.style.maxHeight = Math.max(72, Math.floor(sg.clientHeight - tran)) + "px";   // 17/10 (9) user «không làm cuộn khung này»: 1 người thì không bao giờ cuộn
    qdDay(bx, qdTp); }
  /* 17/10 (4) user «Quyết định chốt cứng phía dưới thanh bên phải»: còn chỗ trống dưới cùng thì đẩy khối Quyết định xuống sát đáy; thanh dài phải cuộn thì
     khối dính đáy (position:sticky) — luôn thấy, không trôi. 19/10 user BỎ dính đáy (cuộn theo nội dung, 2 thanh như nhau); thanh hẹp/điện thoại không kéo xuống đáy. */
  var QD_CACH_DAY = 37;   // 17/10 (6) lên 3 cm (113px) → 17/10 (8) user «di chuyển xuống 2cm» (−76px) ⇒ cách đáy ~1 cm
  function qdDay(bx, qd) {
    if (!qd || !bx) return; qd.style.marginTop = "";   // trả về margin-top:auto (CSS) — trong khung cột, Quyết định tự xuống đáy khung
    var L = qd.closest(".hx-tb-luoi"), pb = parseFloat(getComputedStyle($id("mBody")).paddingBottom) || 0; L.style.minHeight = "";
    if (bx.clientWidth <= 820) { qd.style.marginBottom = ""; return; }
    coAnhTV(bx, qd);   // 19/10 thanh hẹp/điện thoại: Quyết định nằm ngay sau nội dung, không kéo xuống đáy
    var rL = L.getBoundingClientRect(), du = bx.getBoundingClientRect().bottom - rL.bottom - pb;
    du -= QD_CACH_DAY;   // 17/10 (6) user «cụm Quyết định di chuyển lên trên 3cm»
    if (bx.scrollHeight <= bx.clientHeight + 1 && du > 2) L.style.minHeight = Math.floor(rL.height + du) + "px";   // lưới giãn → khung giãn → Quyết định cách đáy thanh QD_CACH_DAY
    /* cột bên kia dài tới đáy (Theo tác vụ: Ai tác động) → lưới không giãn được; nhấc Quyết định lên bằng phần trống phía trên nó (margin-top:auto) — 2 thanh cùng 1 chỗ */
    qd.style.marginBottom = ""; var dich = bx.getBoundingClientRect().bottom - QD_CACH_DAY - 16, lo = qd.getBoundingClientRect().bottom - dich, trong = parseFloat(getComputedStyle(qd).marginTop) || 0;
    if (lo > 1 && trong > 1) qd.style.marginBottom = Math.floor(Math.min(lo, trong)) + "px";
  }
  function xongThanhBen(tb) { khoaAnhGN(); lapCotPhai(); requestAnimationFrame(lapCotPhai); hskThanhBen.xong(tb);
    /* 17/10 (5) đo thật: đổi lượt khi thanh đang mở — lúc dựng xong nội dung cũ/ảnh chưa ổn định nên chưa đẩy được Quyết định xuống đáy → tính lại sau khi lắng */
    var M0 = $id("modal"); clearTimeout(M0._henLap); clearTimeout(M0._henLap2); M0._henLap = setTimeout(lapCotPhai, 350); M0._henLap2 = setTimeout(function () { lapCotPhai(true); }, 1200); }
  /* 16/10 (7) user «kích thước ảnh ghi nhận buộc bằng chiều cao khung camera — khoá cứng, bên dưới là dữ liệu»: khung camera đánh dấu [data-khung];
     ảnh cột phải lấy ĐÚNG chiều cao đó (bám theo khi khung đổi cỡ). Chỉ khi 2 cột đứng cạnh nhau — xếp chồng (hẹp/điện thoại) thì trả về cỡ tự nhiên. */
  function khoaAnhGN() { var M0 = $id("modal"); if (M0._roAnh) { M0._roAnh.disconnect(); M0._roAnh = null; }
    var a = $id("mBody").querySelector(".hx-qd-anh"), k = $id("mBody").querySelector("[data-khung]"); if (!a) return;
    if (a.closest(".hx-qd-luot,.hx-tb-luoi")) { a.style.height = ""; a.classList.remove("khoa"); var im = a.querySelector("img"); if (im && !im.complete) im.addEventListener("load", lapCotPhai, { once: true }); return; }   // 16/10 (8) Theo máy: ảnh camera NGANG → khối vừa khít ảnh, không dải xám; mục người sát dưới
    var dat = function () { var rk = k && !k.hidden ? k.getBoundingClientRect() : null, ra = a.getBoundingClientRect();
      a.style.height = rk && rk.height > 40 && ra.left >= rk.right - 1 ? Math.round(rk.height) + "px" : ""; a.classList.toggle("khoa", !!a.style.height); lapCotPhai(); };
    dat(); if (k && window.ResizeObserver) { M0._roAnh = new ResizeObserver(dat); M0._roAnh.observe(k); M0._roAnh.observe(a.parentNode); } }
  /* 17/10 BỐ CỤC THANH BÊN theo khung (user «rã tất cả thành phần/khung ở thanh bên phải để t tự di chuyển ở bản QC»):
     thanh = lưới 12 cột các KHUNG (vạch ngăn giữa khung), mỗi khung = lưới 12 cột các THÀNH PHẦN [data-tp].
     Bố cục = DASH_BOCUC.thanhBen[<khoá>].khung = [{id, rong, ds:[{id, rong, an}]}] — bộ Chỉnh bố cục (dash-bocuc-sua.js, chỉ bản QC) ghi.
     Thành phần chưa có trong bố cục (thêm về sau) rơi vào khung cuối; khung không còn thành phần nào thì ẩn (bản chỉnh vẫn hiện để thả vào). */
  /* 17/10 (2) user: «Sẽ ghi nhận» dưới Ảnh ghi nhận · Quyết định xuống dưới Máy gợi ý · mốc ①②③ nằm trên thanh thời gian clip (bỏ hàng mốc riêng) */
  /* 17/10 (5) user «làm lại thanh bên: dưới clip là Ai tác động ô (Theo máy không có thì để trống) · Lỗi / Máy gợi ý / Quyết định chuyển xuống dưới
     Ảnh ghi nhận · đồng bộ vị trí/kích thước clip và các khung ở CẢ 2 thanh Theo máy + Theo tác vụ»: 2 khung y hệt nhau — trái 7/12 · phải 5/12. */
  /* 17/10 (7) user «khung Ảnh ghi nhận và clip đổi vị trí cho nhau (kể cả Ghi chú/Đóng ⇄ tiêu đề) · clip tăng kích thước cho vừa thanh»:
     TRÁI 4/12 = Ảnh ghi nhận → … → Lỗi → Máy gợi ý → Quyết định · PHẢI 8/12 = clip (+ Ai tác động dưới clip) */
  var TB_MAC = { may: [{ id: "k2", rong: 4, ds: [{ id: "anh" }, { id: "seghi" }, { id: "dsnguoi" }, { id: "trangthai" }, { id: "quyetdinh" }] }, { id: "k1", rong: 8, ds: [{ id: "clip" }] }],   // 20/10 user đính chính: WEB giữ ảnh ở cột phải như cũ; chip + ảnh dưới clip CHỈ điện thoại (CSS @container ≤820)
    tacvu: [{ id: "k2", rong: 4, ds: [{ id: "anh" }, { id: "tinhtrang" }, { id: "thongtin" }, { id: "loi" }, { id: "goiy" }, { id: "quyetdinh" }] }, { id: "k1", rong: 8, ds: [{ id: "clip" }, { id: "aitacdong" }] }] };   // 20/10 user: web Theo tác vụ ảnh ở cột phải như cũ; chip ảnh CHỈ điện thoại   // 19/10 (4) Ảnh ghi nhận DƯỚI clip (bật bằng nút) · (5) danh sách ai tác động giữ, chỉ bỏ dòng tiêu đề
  var TB_TEN = { clip: "Camera / clip", anh: "Ảnh ghi nhận", thongtin: "Ngày · Vị trí · Ghi chú", quyetdinh: "Quyết định", trangthai: "Trạng thái phiếu", seghi: "Sẽ ghi nhận", dsnguoi: "Lỗi · Máy gợi ý (người nghi)", aitacdong: "Ai tác động ô", tinhtrang: "Tình trạng bằng chứng", loi: "Lỗi", goiy: "Máy gợi ý" };
  var tbCot = function (v) { v = Math.round(Number(v) || 12); return Math.max(1, Math.min(12, v)); };
  function tbCfg(k) { var c = window.DASH_BOCUC && window.DASH_BOCUC.thanhBen && window.DASH_BOCUC.thanhBen[k]; return c && c.khung && c.khung.length ? c.khung : (TB_MAC[k] || []); }
  /* 19/10 (7) chip «Ảnh ghi nhận» dùng chung 2 thanh: ảnh mặc định ẨN, bấm hiện ngay DƯỚI clip (hiệu ứng paneIn sẵn có), bấm lại ẩn; clip giữ nguyên chỗ, vẫn chạy */
  /* 20/10 user đính chính: Theo máy — chip + ẩn ảnh CHỈ trên điện thoại (lớp .an-dt chỉ có tác dụng trong @container ≤820); web ảnh hiện sẵn ở cột phải như cũ */
  /* 20/10 user (WEB Theo tác vụ): cả cột phải «ảnh → khối thông tin → Quyết định» VỪA 1 màn — khung ảnh cao = phần còn lại của cột
     (trần 9:16 theo bề ngang cột, sàn 160px; chạm sàn mới phải cuộn). Tính khi mở phiếu / đổi cỡ (lapCotPhai gọi qua qdDay); đổi ảnh KHÔNG tính lại ⇒ khung giữ nguyên. */
  function coAnhTV(bx, qd) {
    var A = $id("mBody").querySelector('.hx-tb-luoi[data-tb="tacvu"] [data-tp="anh"] .hx-qd-anh'); if (!A || !A.offsetWidth) return;
    var tran = A.closest(".hx-tb-khung"), cuoi = qd.getBoundingClientRect(), tren = Math.floor(A.offsetWidth * 16 / 9);
    A.style.height = tren + "px";
    var du = qd.getBoundingClientRect().bottom - (bx.getBoundingClientRect().bottom - 16);
    A.style.height = Math.max(160, Math.min(tren, Math.floor(tren - Math.max(0, du)))) + "px"; }
  function ganNutAnh(hienSan) { var a = $id("mBody").querySelector(".hx-tb-luoi [data-tp=\"anh\"]"), n = $id("mBody").querySelector("[data-anhgn]"); if (!a || !n) return;
    /* 20/10 Theo tác vụ: chip «Ghi nhận» bật/tắt cả ảnh + khối thông tin (Ngày/Vị trí/SKU/Ghi chú/Thuộc lỗi/Máy gợi ý) — chỉ điện thoại (.an-dt ≤820) */
    var ds = [a].concat([].slice.call($id("mBody").querySelectorAll('.hx-tb-luoi[data-tb="tacvu"] [data-tp="thongtin"], .hx-tb-luoi[data-tb="tacvu"] [data-tp="loi"], .hx-tb-luoi[data-tb="tacvu"] [data-tp="goiy"]')));
    var dt = true, an = function () { return a.classList.contains("an-dt"); };
    var dat = function (mo) { ds.forEach(function (e) { e.classList.toggle("an-dt", !mo); }); n.classList.toggle("on", mo); n.setAttribute("aria-pressed", String(mo)); };
    dat(!!hienSan); n.onclick = function () { var mo = an(); dat(mo); if (mo) { a.classList.add("hx-hien-mo"); setTimeout(function () { a.classList.remove("hx-hien-mo"); }, 320); } lapCotPhai(); }; }
  function tbAp(luoi) {
    luoi = luoi || ($id("mBody") && $id("mBody").querySelector(".hx-tb-luoi")); if (!luoi) return;
    var tps = {}, dung = {}, khung = [];
    luoi.querySelectorAll(".hx-tb-tp").forEach(function (x) { tps[x.dataset.tp] = x; });
    var cu = [].slice.call(luoi.children).filter(function (x) { return x.classList.contains("hx-tb-khung"); });
    tbCfg(luoi.dataset.tb).forEach(function (kh) {
      var f = document.createElement("div"); f.className = "hx-tb-khung"; f.dataset.tbk = kh.id || ("k" + khung.length); f.style.setProperty("--tb-rong", tbCot(kh.rong));
      (kh.ds || []).forEach(function (b) { var x = tps[b.id]; if (!x || dung[b.id]) return; dung[b.id] = 1; x.style.setProperty("--tb-rong", tbCot(b.rong)); x.toggleAttribute("data-tb-an", !!b.an); f.appendChild(x); });
      khung.push(f);
    });
    if (!khung.length) { var f0 = document.createElement("div"); f0.className = "hx-tb-khung"; f0.dataset.tbk = "k1"; khung.push(f0); }
    Object.keys(tps).forEach(function (id) { if (dung[id]) return; var x = tps[id]; x.style.setProperty("--tb-rong", 12); x.removeAttribute("data-tb-an"); khung[khung.length - 1].appendChild(x); });
    khung.forEach(function (f) { f.toggleAttribute("data-trong", ![].slice.call(f.children).some(function (x) { return x.classList.contains("hx-tb-tp") && !x.hasAttribute("data-tb-an") && x.childElementCount; })); luoi.appendChild(f); });
    cu.forEach(function (x) { x.remove(); });
    tbVach(luoi);
    var M0 = $id("modal"); if (M0._roTb) M0._roTb.disconnect(); if (window.ResizeObserver) { M0._roTb = new ResizeObserver(function (ds) { tbVach(luoi); if (ds.some(function (d) { return d.target !== luoi; })) lapCotPhai(); }); M0._roTb.observe(luoi);
      var kc = luoi.querySelector('[data-tp="clip"]'); if (kc) M0._roTb.observe(kc); }   // clip nạp xong mới đủ cao → tính lại chỗ cuộn
  }
  function tbVach(luoi) {   // vạch ngăn: khung không đứng đầu hàng có vạch trái, khung không ở hàng đầu có vạch trên (đo thật vị trí, không đoán theo số cột)
    var r0 = luoi.getBoundingClientRect();
    [].slice.call(luoi.children).forEach(function (f) { if (!f.classList.contains("hx-tb-khung")) return; var r = f.getBoundingClientRect(); if (!r.width) return;
      f.classList.toggle("tb-trai", r.left > r0.left + 4); f.classList.toggle("tb-tren", r.top > r0.top + 4); });
  }
  window.hxTB = { ap: function () { tbAp(); lapCotPhai(); }, ten: TB_TEN, mac: TB_MAC };
  function boThanhBen() { if (window.hskThanhBen) hskThanhBen.boc(); }
  /* ---- dùng chung cho Theo phiếu + Máy tự bắt ---- */
  var COT_CHUNG = '<th class="c-o">Ở đâu · lúc</th><th class="c-loi">Lỗi</th><th class="c-bc">Bằng chứng</th><th class="c-ai">Máy gợi ý là ai</th><th class="c-viec">Việc tiếp theo</th>';
  function cotSx(sx) {   // tiêu đề bảng Theo phiếu có nút sắp xếp (▲▼ hiện chiều đang sắp)
    var th = function (k, ten, w) { var on = sx && sx.k === k; return '<th class="' + w + '"><button class="hx-sx' + (on ? " on" : "") + '" data-sx="' + k + '">' + ten + (on ? (sx.d > 0 ? " ▲" : " ▼") : "") + '</button></th>'; };
    return th("luc", "Ở đâu · lúc", "c-o") + '<th class="c-loi">Lỗi</th>' + th("bc", "Bằng chứng", "c-bc") + th("ai", "Máy gợi ý là ai", "c-ai") + th("treo", "Việc tiếp theo", "c-viec");
  }
  function bcPhieu(p) {   // gom bằng chứng của 1 phiếu: ảnh ghi nhận (luôn có) + clip/ảnh mốc trên máy + dòng kho + phiếu trùng
    var x = p.xm || {}, g = p.goiY || {}, b = p.bc || {}, chu = (x.nghi || "") + " " + (g.lyDo || "");
    var vid = /Video:\s*\S+\.(mp4|webm)/i.test(x.camera || "");
    var ch = p.bcChup || {};
    return { anh: p.anh || "", clipInfo: b.clipInfo || null, chupInfo: ch.clipInfo || null, clip: (b.clip || [])[0] || "", clipTho: !!b.clipTho, truy: !!b.truy, moc: b.anh || [], chupClip: ch.clip || "", chupAnh: (ch.lui ? [ch.lui] : []).concat(ch.anh || []), chupLui: ch.lui || "", kenh: b.kenh || ((/kênh\s*\d+/i.exec(x.camera || "") || /ch(\d+)/i.exec(x.camera || "") || [""])[0].replace(/^ch/i, "kênh ")),
      kho: /(cất|châm|soạn|lấy) [\d.,]+ (cái|EA)|người (DUY NHẤT|duy nhất) châm|\d+ người (cất|soạn)/i.test(chu), trung: /TRÙNG/i.test(chu), veSinh: g.ketLuan === "canh-b11" || !!p.vs, vs: p.vs || null, vidTho: vid, ls: p.lsKho || null };
  }
  /* 13/10 user: «cột Lỗi chiếm nhiều chỗ … khoá kích thước, quá thì xuống dòng — NHƯNG khoá chiều dọc của hàng để đồng bộ».
     Mọi ô bảng .hx-chung (Theo tác vụ + Theo máy) bọc vào .hx-o cao tối đa; chữ bị khuất vẫn đọc được qua title (máy tính) / mở pop-up. */
  function khoaHang(root) {
    /* 19/10 user «Theo tác vụ → Theo máy LAG/TREO»: đo CDP ra 23 s ở đây — ghi DOM rồi đọc innerText XEN KẼ từng ô ⇒ ép dựng lại bố cục cả trang
       ~650 lần (thanh bên đang mở càng nặng). Nay tách 3 lượt: bọc hết (ghi) → đọc chữ hết (1 lần dựng bố cục) → gán title (ghi). */
    var ds = [].slice.call((root || document).querySelectorAll("table.hx-chung tbody td:not([colspan])")).filter(function (td) { return !(td.firstElementChild && td.firstElementChild.classList.contains("hx-o")); });
    var os = ds.map(function (td) { var o = document.createElement("div"); o.className = "hx-o"; while (td.firstChild) o.appendChild(td.firstChild); td.appendChild(o); return o; });
    /* title chỉ dùng khi rê chuột → tính lúc rảnh (sau khi bảng đã vẽ), không chặn lượt chuyển mục */
    var ganTitle = function () { if (!ds[0] || !ds[0].isConnected) return; var chu = ds.map(function (td, i) { return td.title ? null : os[i].innerText; });
      ds.forEach(function (td, i) { if (chu[i] != null) td.title = chu[i].replace(/\s*\n\s*/g, " · ").trim(); }); };
    if (window.requestIdleCallback) requestIdleCallback(ganTitle, { timeout: 1500 }); else setTimeout(ganTitle, 200);
  }
  function coBC(p) { var b = bcPhieu(p); return !!(b.clip || b.moc.length || b.kho || b.trung || b.veSinh || (b.ls && b.ls.ds.some(function (x) { return x.clip; }))); }   // video thô KHÔNG tính — chưa dựng clip chuẩn thì chưa xem được
  var thu_ = function (url) { return url ? API + "/thu?u=" + encodeURIComponent(String(url).replace(API, "").replace(/[?&]phien=[0-9a-f]*/, "")) + "&phien=" + PHIEN : ""; };   // 05/10 lag cuộn: ảnh nhỏ 320 px thay ảnh gốc
  function oBC(b, id) {   // 05/10 user "toàn ảnh, k thấy clip": có clip → khung VIDEO bấm là phát (mở hộp quyết định); ảnh ghi nhận nhỏ bên cạnh, bấm phóng to
    var ds = [b.anh].concat((b.moc || []).concat(b.chupAnh || []).concat((b.vs && b.vs.cam && b.vs.cam.soi) || []).map(u_)).filter(Boolean), dsA = e_(ds.join("|"));
    var vid = b.clip || b.chupClip, poster = b.moc.length ? u_(b.moc[0]) : (b.chupAnh || []).length ? u_(b.chupAnh[b.chupLui && b.chupAnh.length > 1 ? 1 : 0]) : b.anh;
    var h = '<div class="hx-bc">';
    if (vid) h += '<button class="hx-vthumb" data-phat="' + e_(id || "") + '" aria-label="Phát clip camera"><img loading="lazy" decoding="async" alt="Clip camera" src="' + e_(thu_(poster)) + '" style="width:100%;height:100%;object-fit:cover;display:block"><span class="pl">▶</span></button>';
    else h += (ds.length ? '<img class="hx-th" loading="lazy" decoding="async" src="' + e_(thu_(ds[ds.length > 1 ? 1 : 0])) + '" alt="' + (ds.length > 1 ? "Khung camera" : "Ảnh ghi nhận") + '" data-bcanh="' + e_(ds[0]) + '" data-ds="' + dsA + '">' : "");
    var c = [];
    if (!b.clip && b.chupClip) c.push('<span class="hx-tag">Camera lúc chụp (chưa thấy người làm)</span>');
    var lsW = b.ls ? b.ls.ds.filter(function (x) { return !x.vatLy; }) : [], lsV = b.ls ? b.ls.ds.length - lsW.length : 0;   // 19/10 (6) đếm riêng lượt WMS / lượt không qua WMS (khớp 2 chip ở thanh bên)
    var demLoai = {}; lsW.forEach(function (x) { var k = loaiGon(x); demLoai[k] = (demLoai[k] || 0) + 1; });   // 19/10 (7) đếm THEO LOẠI (vd 3 châm hàng · 4 trả hàng đơn huỷ), không gộp thành «lượt châm»
    if (lsW.length) c.push('<span class="hx-tag info" title="Lịch sử tác động vào ô trên WMS — mở phiếu để xem từng lượt, gần giờ ghi nhận nhất trước">WMS ' + Object.keys(demLoai).sort(function (a, z) { return demLoai[z] - demLoai[a]; }).map(function (k) { return demLoai[k] + ' ' + k; }).join(' · ') + ' · ' + b.ls.nguoi + ' người' + (lsW.filter(function (x) { return x.clip; }).length ? " · có clip" : "") + '</span>');
    if (lsV) c.push('<span class="hx-tag vl">Không qua WMS ' + lsV + ' lượt</span>');
    if (b.chupLui) c.push('<span class="hx-tag info">Dải 72 giờ</span>');
    if (b.clip) c.push('<span class="hx-tag good">' + (b.truy ? "Clip lúc đồ vật xuất hiện" : "Tác động WMS")   /* 19/10 (6) cùng tên chip ở thanh bên */ + '</span>');
    if (b.vidTho && !b.clip) c.push('<span class="hx-tag">Có video thô — máy chưa dựng clip</span>');
    if (b.kho) c.push('<span class="hx-tag info">Dòng hệ thống kho</span>');
    if (b.trung) c.push('<span class="hx-tag info">Phiếu trùng</span>');
    if (b.veSinh) c.push('<span class="hx-tag info">Chấm công + báo cáo</span>');
    /* 07/10: báo cáo gần nhất của phụ trách ↔ cửa sổ bụi 8h; camera lúc nộp báo cáo (đếm người, chưa định danh) */
    if (b.vs && b.vs.bc) c.push('<span class="hx-tag ' + (b.vs.trongCuaSoBui ? "info" : "warn") + '">Báo cáo ' + e_(b.vs.bc.gio + " " + String(b.vs.bc.ngay).slice(8, 10) + "/" + String(b.vs.bc.ngay).slice(5, 7)) + ' · cách ' + e_(String(Math.round(b.vs.cachGioBc || 0))) + ' giờ' + (b.vs.trongCuaSoBui ? "" : " (quá " + e_(String(b.vs.cuaSoGio || 8)) + " giờ, kho bụi)") + '</span>');
    if (b.vs && b.vs.cam) c.push('<span class="hx-tag info">Camera lúc nộp: có người tại kệ ' + e_(String(Math.max(1, Math.round((b.vs.cam.tong || 0) / 60)))) + ' phút' + (b.vs.cam.daKiem ? "" : " (vùng kệ chưa kiểm)") + '</span>');
    return h + '<div class="hx-bc-chu">' + (c.length ? c.map(function (x) { return x.replace(/<[^>]+>/g, ""); }).map(function (x, i) { return '<span class="' + (i ? "muted" : "") + '">' + x + '</span>'; }).join("") : '<span class="muted">Chỉ có ảnh ghi nhận</span>') + '</div></div>';
  }
  /* 05/10 (bản thiết kế 1.2): "Máy đã tra theo thứ tự" — mỗi bước có / chưa có, để thấy còn thiếu bằng chứng gì */
  function buocTra(p, bc) {
    var g = p.goiY || {}, kho = (/(cất|châm|soạn|lấy) [\d.,]+ (cái|EA)[^;—]*/i.exec((p.xm || {}).nghi || g.lyDo || "") || [""])[0];
    var B = [["Ảnh ghi nhận", !!bc.anh, bc.anh ? "có trên phiếu" : "không có"],
      ["Hệ thống kho — ai chạm ô trước lúc chụp", bc.kho, bc.kho ? (aiPhieu(p) ? aiPhieu(p) + " · " : "") + kho : "lỗi này không để lại dấu trong hệ thống kho"],
      ["Camera đúng giờ châm hàng", !!(bc.clip || bc.moc.length), bc.clip ? (bc.clipTho ? "đoạn gốc 90 s" : "clip đã khoanh") + (bc.kenh ? " · " + bc.kenh : "") : "chưa có"],
      ["Camera lúc người kiểm chụp", !!(bc.chupClip || (bc.chupAnh || []).length), bc.chupClip || (bc.chupAnh || []).length ? "có — chỉ để xác định góc nhìn" : "chưa có"],
      ["Dải lùi thời gian 72 giờ (cùng góc camera)", !!bc.chupLui, bc.chupLui ? "có — xem đồ vật xuất hiện giữa 2 khung nào" : "chưa có"],
      ["Clip lúc đồ vật xuất hiện — ai tác động", false, "chưa có — máy chưa tự tìm được chính xác, cần thêm bước"]];
    return '<ol class="hx-tra">' + B.map(function (x) { return '<li class="' + (x[1] ? "co" : "") + '"><b>' + e_(x[0]) + '</b><span>' + e_(x[2]) + '</span></li>'; }).join("") + '</ol>';
  }
  function aiPhieu(p) {
    if (p.goiY && p.goiY.ketLuan === "B1.1" && (p.goiY.nv || []).length) return p.goiY.nv.map(function (v) { return v.ten + " · " + v.ma; }).join(", ");   // 10/10
    if (p.nv && p.nv.length) return p.nv.map(function (v) { return (v.ten || "") + (v.ma ? " · " + v.ma : ""); }).join(", ");
    if (p.vs && p.vs.phuTrach && p.vs.phuTrach.ma) return (p.vs.phuTrach.ten || "") + " · " + p.vs.phuTrach.ma + " (phụ trách kệ)";   // 07/10 luật vệ sinh
    var t = ((p.xm || {}).nghi || "") + " " + ((p.goiY || {}).lyDo || ""), m = /([A-ZĐÀ-Ỹ][a-zà-ỹđ]+(?: [A-ZĐÀ-Ỹ][a-zà-ỹđ]+){1,4}) \((\d{6})[,)]/.exec(t);   // 05/10: nhận cả "Tên (mã, …)"
    return m ? m[1] + " · " + m[2] : "";
  }
  function viecPhieu(p, b) {
    var x = p.xm || {}, q = p.qdB1, bc = !!(b.clip || b.moc.length || b.kho || b.trung || b.veSinh);
    var vs = p.vs, duoi = '<div class="muted" style="font-size:12px;margin-top:4px">' + e_(p.buoc) + ' · ' + treoTag(p.treoGio).replace(/<[^>]+>/g, "") + ' · <a class="status-link" href="' + e_(p.link) + '" target="_blank" rel="noopener">Mở task</a></div>';
    if (vs && p.buoc === "B1" && !x.daXuLy && !q) {   // 07/10 luật vệ sinh VS-06/VS-07: nói rõ máy đã làm gì / sẽ làm gì
      var phut = vs.cam ? Math.max(1, Math.round((vs.cam.tong || 0) / 60)) : 0;
      var vsChu = vs.bui ? "Đã bình luận nhờ anh Tâm kiểm tra thực tế" + (vs.buiLuc ? " (" + vs.buiLuc.slice(11) + " " + vs.buiLuc.slice(8, 10) + "/" + vs.buiLuc.slice(5, 7) + ")" : "")
        : (vs.camSo || vs.cam) ? "Camera lúc nộp báo cáo: có người tại kệ " + phut + " phút — đã nhờ anh Tâm kiểm tra thực tế"
        : vs.hanhDong === "camera" ? "Báo cáo trong " + (vs.cuaSoGio || 8) + " giờ — máy tra camera lúc nộp báo cáo ở lượt canh kế (mỗi giờ)"
        : vs.hanhDong === "dong-b1" ? "Không báo cáo — máy đóng B1 → B1.1 ở lượt canh kế"
        : vs.hanhDong === "nghi_ngan" ? "Phụ trách nghỉ ngắn — máy dừng phiếu ở lượt canh kế"
        : /^nghi_/.test(vs.hanhDong || "") ? "Phụ trách nghỉ dài — máy nhắc QLTT theo mốc ngày 4 · 5 · 6" : "";
      if (vsChu) return '<span class="hx-tag ' + (vs.bui || vs.camSo || vs.cam ? "warn" : "info") + '" style="white-space:normal">' + e_(vsChu) + '</span>' + (bc ? ' <button class="hx-nut nho" data-qd="' + e_(p.id) + '">Quyết định</button>' : "") + duoi;
    }
    var dau = x.daXuLy ? '<span class="hx-tag good" style="white-space:normal">' + e_(String(x.daXuLy).slice(0, 60)) + '</span>'
      : q ? '<span class="hx-tag info">' + e_(q.qd) + '</span>' + (p.buoc === "B1" ? ' <button class="badge-link" data-qd="' + e_(p.id) + '">Đổi quyết định</button>' : "")
      : p.buoc !== "B1" ? '<span class="muted" style="font-size:12px">Đã qua B1</span>'
      : bc ? '<button class="hx-nut nho" data-qd="' + e_(p.id) + '">Quyết định</button>'
      : '<span class="muted" style="font-size:13px">Chưa quyết được — chờ bằng chứng</span>';
    return dau + '<div class="muted" style="font-size:12px;margin-top:4px">' + e_(p.buoc) + ' · ' + treoTag(p.treoGio).replace(/<[^>]+>/g, "") + ' · <a class="status-link" href="' + e_(p.link) + '" target="_blank" rel="noopener">Mở task</a></div>';
  }

  /* 05/10 user "kết quả đã ghi sheet (chờ bạn quyết) → đưa lên dashboard": ô kết quả xác minh + nút quyết định (POST /api/quyet-dinh-b1 → canh-b1 QD-01) */
  function oXM(p) {
    var x = p.xm, q = p.qdB1, g = p.goiY;
    var noi = x && x.nghi ? '<div class="hx-l2" style="font-size:13px" title="' + e_(x.nghi) + '">' + e_(x.nghi) + '</div>'
      : g ? '<div class="muted hx-l2" style="font-size:12px">' + e_(g.luat === "KHAC" ? "Chưa có luật tự áp cho lỗi này — bạn quyết tay" : g.ketLuan === "canh-b11" ? "Lỗi vệ sinh hằng ngày — cò B1.1 tự xử mỗi giờ theo luật vệ sinh" : (g.lyDo || "")) + '</div>' : "";
    var mm = MUC_MAY[mucMay(p)] || ["", ""]; noi = '<span class="hx-tag ' + mm[1] + '"' + (g ? ' title="Luật ' + e_(g.luat) + '"' : "") + '>' + e_(mm[0]) + '</span>' + noi;
    if (p.vs && p.vs.bc) noi += '<div class="muted" style="font-size:12px">Báo cáo gần nhất ' + e_(p.vs.bc.gio + " " + String(p.vs.bc.ngay).slice(8, 10) + "/" + String(p.vs.bc.ngay).slice(5, 7)) + ' · cách lúc ghi nhận ' + e_(String(Math.round(p.vs.cachGioBc || 0))) + ' giờ' + (p.vs.cam ? ' · camera lúc nộp: có người tại kệ ' + e_(String(Math.max(1, Math.round((p.vs.cam.tong || 0) / 60)))) + ' phút' : "") + '</div>';   // 07/10
    var tt = x && x.daXuLy ? '<span class="hx-tag good">' + e_(x.daXuLy.slice(0, 40)) + '</span>' : q ? '<span class="hx-tag info">' + e_(q.qd) + '</span>' : "";
    return noi + '<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">' + tt +
      (p.buoc === "B1" && !(x && x.daXuLy) ? '<button class="badge-link" data-qd="' + e_(p.id) + '">' + (q ? "Đổi quyết định" : "Quyết định") + '</button>' : "") + '</div>';
  }
  /* 05/10 user "QC lại cách hiển thị, k hợp ý t": hộp quyết định GỌN — trái 1 khung xem lớn + hàng nút đổi nguồn;
     phải: 1 dòng tình trạng bằng chứng · lỗi · máy gợi ý · quyết định. Dải 72 giờ BẤM ĐƯỢC: bấm khung SỚM NHẤT đã có đồ vật
     → máy chụp 9 khung dày hơn trong khoảng đó; ≤ 3 phút thì máy cắt clip lúc đồ vật xuất hiện (= bằng chứng ai tác động). */
  var MOC_LUI = [0, 1, 3, 6, 12, 24, 36, 48, 72];
  function mocLui(p) { var c = p.bcChup || {}; if (c.luiMoc && c.luiMoc.length) return c.luiMoc;
    var T = Date.parse(String(c.luc || p.ngayVP).replace(" ", "T") + "+07:00"); return MOC_LUI.map(function (h) { return new Date(T - h * 36e5 - 34000 + 7 * 36e5).toISOString().slice(0, 19); }); }
  /* 12/10: khối «Ai tác động ô này trước giờ ghi nhận» — phụ trách kệ + từng lượt châm (WMS), gần giờ ghi nhận nhất trước */
  /* 13/10 user: «tác động vật lý mà KHÔNG thao tác hệ thống» phải ghi lại + gắn nhãn nổi — lượt vatLy (sổ tac-dong-vat-ly.json) tô cam, có nút Gỡ */
  var VIEC_VL = ["Lấy hàng ra khỏi ô", "Đặt hàng vào ô", "Xếp / dời hàng trong ô", "Chạm / lục hàng", "Khác"];
  function cumNV(ten, email, tt) { tt = tt || "Inactive"; return '<span class="hx-nv tt-' + e_(tt.toLowerCase()) + '" title="' + e_(tt === "Active" ? "Đang làm" : tt === "Pending" ? "Nghỉ thai sản" : "Đã nghỉ / không còn trong danh bạ") + '"><b>' + e_(ten) + '</b> [' + e_(email) + '|' + e_(tt) + ']</span>'; }
  function oLsKho(LS, idx, ai) {
    if (!LS) return "";
    var pt = (LS.phuTrach || []).filter(function (n) { return !(ai && n.ma && ai.indexOf(n.ma) >= 0); })   // 13/10 luật không lặp: phụ trách kệ = người máy gợi ý thì bỏ
      .map(function (n) { return e_(n.ten) + (n.ma ? " (" + e_(n.ma) + ")" : ""); }).join(", ");
    var demL = {}; LS.ds.forEach(function (x) { if (!x.vatLy) demL[x.loai] = (demL[x.loai] || 0) + 1; });
    var loaiChinh = Object.keys(demL).sort(function (a, b) { return demL[b] - demL[a]; })[0] || "";
    /* 16/10 user «1 cái đó từ đâu»: dòng ghi NGUỒN hàng (bang-591 gắn x.nguon từ sổ nguon-cham-b1) thay cho loại lệnh; mọi dòng cùng 1 nguồn
       thì đưa lên tiêu đề 1 lần (luật không lặp) */
    var chuNg = function (x) { return x.nguon ? x.nguon.chu + (x.nguon.tu ? " · " + x.nguon.tu : "") : ""; };
    var thuong = LS.ds.filter(function (x) { return !x.vatLy; }), ngChung = thuong.length > 1 && thuong.every(function (x) { return x.nguon && chuNg(x) === chuNg(thuong[0]); }) ? chuNg(thuong[0]) : "";   // loại lặp ở mọi dòng thì KHÔNG ghi ở dòng (13/10 user bỏ dòng đếm lượt) — chỉ ghi loại KHÁC
    var dong = LS.ds.map(function (x, j) { var co = idx[j] >= 0, vl = !!x.vatLy;
      return '<div role="button" tabindex="0" class="hx-lan' + (co ? "" : " khong") + (vl ? " vl" : "") + '" data-lan="' + idx[j] + '"' + (co ? "" : ' aria-disabled="true" title="Chưa cắt được clip lượt này"') + '>' +
        '<span class="gio">' + e_(x.at.slice(8, 10) + "/" + x.at.slice(5, 7) + " " + x.at.slice(11, 16)) + '<small>trước ' + e_(x.truocGio < 24 ? soVN(x.truocGio) + " giờ" : soVN(Math.round(x.truocGio / 24 * 10) / 10) + " ngày") + '</small></span>' +
        /* 20/10 user: tên NV luôn «Họ tên [email|Trạng thái]», cả cụm tô màu theo trạng thái (Active xanh · Pending tím · Inactive xám) — tra theo email/mã ở máy chủ */
        '<span class="ai">' + (x.email ? cumNV(x.ten, x.email, x.ttNv) : '<b>' + e_(x.ten) + '</b>' + (x.ma ? ' <span class="muted">' + e_(x.ma) + '</span>' : "")) +
          (vl ? '<small><span class="hx-tag vl">Không qua hệ thống</span> ' + e_(x.loai) + (x.nguonVL === "may" ? " · máy soi camera" + (x.moTa ? " · " + e_(x.moTa.slice(0, 90)) + (x.moTa.length > 90 ? "…" : "") : "") : "") + '</small>'
            /* 20/10 user: 1 HÀNG trái→phải Số lượng · Loại điều chuyển · Vị trí nguồn · Ghi chú (ô TF = xe/giỏ trung chuyển ⇒ vị trí nguồn = ô gốc thật; ghi mã ô ĐẦY ĐỦ — user 20/10 đính chính, không rút gọn) */
            : (function () { var o = /^F0-TF-/.test(x.oNguon || "") && x.goc ? x.goc : (x.oNguon || x.goc || ""), oDu = String(o).replace(/ [(][0-9]+[)]$/, "");
                return '<small class="hx-nguon-lan hx-lan-hang"' + (x.nguon ? ' title="' + e_(x.nguon.chiTiet) + '"' : "") + '><span class="sl">' + e_(x.qty) + ' cái</span> · <span class="ldc" title="' + e_(x.tt || "") + '">' + e_(loaiGon(x)) + '</span>' +
                  (oDu ? ' · <span class="vtn" title="' + e_(oDu) + '">' + e_(oDu) + '</span>' : "") + (x.oGhiChu ? ' · <span class="gc">' + e_(x.oGhiChu) + '</span>' : "") + '</small>'; })()) + '</span>' +
        (vl && x.nguonVL !== "may" ? '<button class="hx-vl-go" data-vlgo="' + e_(x.at) + '|' + e_(x.ma) + '" aria-label="Gỡ ghi nhận">Gỡ</button>' : "") +
        '<span class="pl">' + (co ? "▶" : "–") + '</span></div>'; }).join("");
    /* 19/10 (5) user: BỎ dòng chữ «Ai tác động ô trước giờ ghi nhận · WMS 72 giờ» — danh sách ai tác động (bấm phát clip, nút Gỡ) giữ nguyên */
    return '<div class="hx-qd-o">' +
      (pt ? '<div style="margin:2px 0 6px">Phụ trách kệ: <b>' + pt + '</b></div>' : "") +
      (LS.ds.length ? '<div class="hx-lans">' + dong + '</div>' : "") +
      /* 19/10 (6) danh sách lọc theo chip (data-che trên .hx-qd-ls): không có lượt WMS nào thì báo ở chế độ «Tác động WMS» */
      (thuong.length ? "" : '<div class="muted hx-lan-trong" data-trong="wms">Không có lượt WMS nào vào ô trong ' + LS.gioCuaSo + ' giờ trước giờ ghi nhận.</div>') + '</div>';
  }
  /* phụ đề «giờ · ai · làm gì» cho MỌI clip: gom mọi lượt (hệ thống kho + vật lý) rơi trong khung clip, bỏ mốc trùng ±90 s */
  /* 19/10 (4) user D «điện thoại không thấy loại tác động cạnh số lượng»: gọi đúng tên nghiệp vụ (TU-01: châm hàng, không «cất») theo khu nguồn WMS —
     châm hàng (IT, PO/kho tổng, pallet, ô khác) · soạn hàng (pick) · hàng hoàn (bin RT) · hàng dư (bin PA)
     19/10 (7) user DUYỆT tách «trả hàng đơn huỷ» (lệnh WMS REPUSH_ORDER_CANCEL_PUSH = loai «Trả hàng đơn huỷ», đưa thẳng từ giỏ F0-PA) khỏi châm hàng / hàng dư —
     xét LOẠI LỆNH trước khu nguồn (13740905: 3 châm hàng + 4 trả hàng đơn huỷ). Tên chuẩn ở sổ từ ngữ tu-ngu.mjs (LOAI_TAC_DONG). */
  function loaiTD(x) {
    var c = (x.nguon && x.nguon.chu) || "", l = String(x.loai || "");
    if (/trả hàng đơn (huỷ|hủy)|REPUSH_ORDER_CANCEL/i.test(l)) return "trả hàng đơn huỷ";
    if (/^Nhận hàng IT/.test(c)) return "châm hàng (IT)";
    if (/^Hàng hoàn/.test(c)) return "hàng hoàn (bin RT)";
    if (/^Hàng trả không phù hợp/.test(c)) return "hàng hoàn (bin NG)";
    if (/^Đơn huỷ trả kệ/.test(c)) return "hàng dư (bin PA)";   // giỏ F0-PA nhưng KHÔNG phải lệnh trả đơn huỷ (pick dư trả kệ)
    if (/^Từ pallet/.test(c)) return "châm hàng (hàng soạn từ " + (x.goc || c.replace(/^Từ /, "")) + ")";   // 20/10 «pallet 304» = ô pallet F0-PL-00-00-00-304 nơi hàng được soạn lên xe trước khi châm
    if (/^Chuyển từ ô khác/.test(c)) return "châm hàng (từ ô " + (x.goc || x.nguon.tu || "khác").replace(/ [(][0-9]+[)]$/, "") + ")";
    if (/^Từ xe khác/.test(c)) return "châm hàng (từ xe khác)";
    if (/soạn|pick/i.test(l)) return "soạn hàng (pick)";
    if (/kho tổng|PUSH_MASTER/i.test(l)) return "châm hàng (PO/kho tổng)";
    return "châm hàng";
  }
  function loaiGon(x) { return loaiTD(x).replace(/ \(.*\)$/, ""); }   // tên loại không kèm ngoặc — để đếm theo loại
  function suKienClip(LS, bdMs, goc) {   // 19/10 suKien của clip có lúc không phải mảng (dữ liệu 8591) ⇒ trước đây văng lỗi, mở phiếu hỏng
    var sk = (Array.isArray(goc) ? goc : []).map(function (x) { return { t: Date.parse(String(x.t).replace(" ", "T") + "+07:00"), chu: ngayChu(x.chu), vl: !!x.vl }; });
    /* phụ đề máy chủ ghi «… châm 40 lúc …» → thay bằng «40 cái · <loại tác động>» của đúng lượt WMS đó (±90 s); không khớp lượt nào thì «40 cái · châm hàng» */
    sk.forEach(function (y) { if (y.vl) return; var x = LS && LS.ds.find(function (z) { return !z.vatLy && Math.abs(Date.parse(String(z.at).replace(" ", "T") + "+07:00") - y.t) < 9e4; });
      y.chu = String(y.chu).replace(/châm (\d+|\?)( cái)?/, function (m0, so) { if (so === "?") so = x && x.qty != null ? x.qty : "?"; return so + " cái · " + (x ? loaiTD(x) : "châm hàng"); }); });
    if (!LS || !bdMs) return sk;
    LS.ds.forEach(function (x) { var t = Date.parse(String(x.at).replace(" ", "T") + "+07:00"); if (!(t >= bdMs - 5e3 && t <= bdMs + 6e5)) return;
      if (!x.vatLy && sk.some(function (y) { return !y.vl && Math.abs(y.t - t) < 9e4; })) return;
      sk.push({ t: t, vl: !!x.vatLy, chu: x.at.slice(11, 16) + " · " + x.ten + (x.ma ? " (" + x.ma + ")" : "") + " · " + (x.vatLy ? x.loai.charAt(0).toLowerCase() + x.loai.slice(1) + " — không qua WMS" : x.qty + " cái · " + loaiTD(x) + " (WMS)") }); });
    return sk.sort(function (a, b) { return a.t - b.t; });
  }
  /* 13/10: «Mở task» lên đầu pop-up, cạnh trái nút Đóng — chỉ sống khi pop-up quyết định đang mở */
  function ganMoTask(link) {
    var cu = $id("hxMoTask"); if (cu) cu.remove();
    var a = document.createElement("a"); a.id = "hxMoTask"; a.className = "hx-motask"; a.href = link || "#"; a.target = "_blank"; a.rel = "noopener";
    a.innerHTML = '<span class="pt">Mở task trên work.hasaki</span><span class="ps">Mở task</span> ↗';
    $id("mClose").parentNode.insertBefore(a, $id("mClose"));
    var md = $id("modal"); if (md && !md.__hxMoTask) { md.__hxMoTask = 1;
      var hien1 = md.classList.contains("show");   // 17/10 như Ghi chú: chỉ gỡ khi vừa đóng thanh, không gỡ lúc đang mở lại
      new MutationObserver(function () { var dang = md.classList.contains("show"), vuaDong = hien1 && !dang; hien1 = dang; if (!vuaDong) return; var z = $id("hxMoTask"); if (z) z.remove(); }).observe(md, { attributes: true, attributeFilter: ["class"] }); }
  }
  /* 14/10 user: nút «Ghi chú» cạnh nút Đóng (Theo tác vụ + Theo máy) mở POP-UP ghi chú — ghi điều cần cải tiến; máy chủ lưu .exports/ghi-chu-cai-tien.json.
     Mỗi ghi chú có trạng thái: «Chờ Claude đọc» → (Claude đọc đầu phiên, sửa, QC, ghi lại `xong`) → «Đã cải tiến» + dòng «đã sửa gì». */
  /* 20/10 user: CỜ GHI CHÚ trên danh sách Theo máy / Theo tác vụ. Trạng thái tt: cho · dang · xong · bo (dòng cũ: có «xong» = xong, trống = cho).
     Mục có ghi chú: nhãn «Ghi chú · …» + làm mờ + dồn cuối danh sách (không lẫn với việc cần quyết). Sổ tải 1 lần, lưu ghi chú thì tải lại. */
  var GC = null, GC_TEN = { cho: "chờ cải tiến", dang: "đang cải tiến", xong: "đã cải tiến", bo: "không làm" }, GC_MAU = { cho: "warn", dang: "info", xong: "good", bo: "" };
  function ttGC(g) { return g.tt || (g.xong ? "xong" : "cho"); }
  function gcCua(id) { var ds = GC && GC[String(id)]; if (!ds) return ""; var th = ["cho", "dang", "xong", "bo"]; return ds.map(ttGC).sort(function (a, b) { return th.indexOf(a) - th.indexOf(b); })[0]; }
  function coGC(id) { var t = gcCua(id); return t ? '<div><span class="hx-tag ' + GC_MAU[t] + ' hx-gc-co" title="Mục này đã có ghi chú cải tiến — mở để xem">Ghi chú · ' + GC_TEN[t] + '</span></div>' : ""; }
  function donGC(ds, idCua) { if (!GC) return ds; return ds.filter(function (x) { return !gcCua(idCua(x)); }).concat(ds.filter(function (x) { return gcCua(idCua(x)); })); }
  function taiGC(veLai) { if (GC) return; GC = {}; goi("/api/ghi-chu").then(function (ds) { var m = {}; (ds || []).forEach(function (g) { (m[g.id] = m[g.id] || []).push(g); }); GC = m; if (veLai) veLai(); }).catch(function () {}); }
  function ganGhiChu(loai, id, tieuDe) {
    var gc0 = $id("gcNut"); if (gc0) gc0.remove();
    var gcN = document.createElement("button"); gcN.type = "button"; gcN.className = "hx-gc-nut"; gcN.id = "gcNut"; gcN.setAttribute("aria-haspopup", "dialog"); gcN.textContent = "Ghi chú";
    $id("mClose").parentNode.insertBefore(gcN, $id("hxMoTask") || $id("mClose"));   // 14/10 user: Ghi chú bên trái, ngang hàng nút Đóng
    var md0 = $id("modal"); if (md0 && !md0.__hxGc) { md0.__hxGc = 1;
      /* 17/10 BẪY user bắt «Ghi chú / Mở task Theo tác vụ không có»: trước đây gỡ nút mỗi khi lớp đổi mà CHƯA có «show» — lúc MỞ LẠI thanh (gắn hx-ben trước, show sau)
         cũng bị gỡ ⇒ từ lần mở thứ 2 mất nút. Nay chỉ gỡ khi vừa chuyển ĐANG HIỆN → ĐÓNG. */
      var hien0 = md0.classList.contains("show");
      new MutationObserver(function () { var dang = md0.classList.contains("show"), vuaDong = hien0 && !dang; hien0 = dang; if (!vuaDong) return; var z = $id("gcNut"); if (z) z.remove(); dongGC(); }).observe(md0, { attributes: true, attributeFilter: ["class"] }); }
    var DS = [];
    var dem = function () { var cho = DS.filter(function (g) { var t = ttGC(g); return t === "cho" || t === "dang"; }).length; gcN.textContent = DS.length ? "Ghi chú (" + DS.length + ")" : "Ghi chú"; gcN.classList.toggle("cho", cho > 0); };
    goi("/api/ghi-chu?id=" + encodeURIComponent(id)).then(function (ds) { DS = ds || []; dem(); }).catch(function () {});
    gcN.onclick = function () {
      dongGC();
      var o = document.createElement("div"); o.id = "hxGcPop"; o.className = "hx-gcp"; o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true"); o.setAttribute("aria-labelledby", "gcTieuDe");
      o.innerHTML = '<div class="hx-gcp-hop"><div class="hx-gcp-dau"><div style="min-width:0"><div class="hx-mt1" id="gcTieuDe">Ghi chú cải tiến</div><div class="hx-mt2">' + e_(tieuDe) + '</div></div><button type="button" class="hx-gc-nut" id="gcDong">Đóng</button></div>' +
        '<div class="hx-gcp-than"><textarea id="gcChu" rows="4" placeholder="Điều cần cải tiến ở pop-up này / cách máy xác minh việc này…" aria-label="Ghi chú cải tiến"></textarea>' +
        '<div class="hx-gc-hang"><button type="button" class="hx-nut nho" id="gcLuu">Lưu ghi chú</button><span id="gcMsg" class="muted"></span></div>' +
        '<div class="hx-gcp-quy muted">Sau khi lưu: Claude đọc ghi chú ở phiên làm việc kế tiếp → sửa → chạy QC → ghi lại «đã sửa gì» ngay dưới ghi chú này.</div><div id="gcDs"></div></div></div>';
      ($id("modal") || document.body).appendChild(o);   // #modal nằm ở lớp trên cùng (showModal) — gắn vào trong mới nổi lên trên
      var veDs = function () { $id("gcDs").innerHTML = DS.slice().reverse().map(function (g) { var d = new Date(g.at);
        return '<div class="hx-gc-dong"><div class="muted">' + ("0" + d.getDate()).slice(-2) + "/" + ("0" + (d.getMonth() + 1)).slice(-2) + " " + ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2) +
          ' · <span class="hx-tag ' + GC_MAU[ttGC(g)] + '">' + GC_TEN[ttGC(g)].replace(/^./, function (c) { return c.toUpperCase(); }) + '</span></div><div class="nd">' + e_(g.noiDung) + '</div>' +
          (g.xong && g.xong !== true ? '<div class="xong">↳ ' + e_(g.xong) + '</div>' : "") + '</div>'; }).join(""); };
      veDs();
      o.onclick = function (ev) { if (ev.target === o) dongGC(); };
      o.onkeydown = function (ev) { if (ev.key === "Escape") { ev.stopPropagation(); dongGC(); } };
      $id("gcDong").onclick = dongGC; $id("gcChu").focus();
      $id("gcLuu").onclick = function () { var nd = $id("gcChu").value.trim(), b = this; if (!nd) { $id("gcMsg").textContent = "Chưa gõ nội dung"; return; }
        b.disabled = true; $id("gcMsg").textContent = "Đang lưu…";
        goi("/api/ghi-chu", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ loai: loai, id: id, tieuDe: tieuDe, noiDung: nd }) })
          .then(function (j) { DS = j.ds || []; dem(); if (GC) GC[String(id)] = DS.slice(); $id("gcChu").value = ""; $id("gcMsg").textContent = ""; veDs(); baoOk("Đã lưu ghi chú"); })
          .catch(function (e) { $id("gcMsg").textContent = "Lỗi: " + e.message; }).then(function () { b.disabled = false; }); };
    };
  }
  function dongGC() { var o = $id("hxGcPop"); if (o) { o.remove(); var n = $id("gcNut"); if (n) n.focus(); } }
  function moQD(p) {
    var TB = moThanhBen(String(p.id));
    var x = p.xm || {}, q = p.qdB1 || {}, ds = D.QD_B1 || [], bc = bcPhieu(p), co = coBC(p), ai = aiPhieu(p);
    var LS = p.lsKho || null, lui20 = function (s0) { return new Date(Date.parse(String(s0).replace(" ", "T") + "+07:00") - 20e3 + 7 * 36e5).toISOString().slice(0, 19).replace("T", " "); };
    var nguon = [];
    /* 19/10 (4) user: hàng nguồn gom 1 hàng «Tác động WMS» (clip giờ kho — đổi tên từ «Clip camera giờ kho») / «Không qua WMS» / «Ảnh ghi nhận»; bỏ nút «Khung camera N» */
    if (bc.clip) nguon.push({ k: "clip", ten: bc.truy ? "Clip lúc đồ vật xuất hiện" : "Tác động WMS", url: u_(bc.clip), video: 1, info: bc.clipInfo });
    if (bc.chupLui) nguon.push({ k: "lui", ten: "Dải 72 giờ", url: u_(bc.chupLui) });
    /* 16/10 (4) user: Ảnh ghi nhận LÔI RA khỏi thanh nguồn, đứng riêng trên «Ai tác động» — xem camera và đối chiếu ảnh CÙNG LÚC (không lặp thành nút) */
    ((bc.vs && bc.vs.cam && bc.vs.cam.soi) || []).forEach(function (a) { nguon.push({ k: "soi", ten: "Camera lúc nộp báo cáo (ảnh soi)", url: u_(a) }); });   // 07/10
    bc.moc.forEach(function (a, i) { nguon.push({ k: "moc" + i, an: 1, ten: "Khung camera " + (i + 1), url: u_(a) }); });   // 19/10 (4) không còn nút — chỉ làm hình dự phòng khi phiếu không có clip
    if (bc.chupClip && !bc.clip) nguon.push({ k: "chup", ten: "Clip lúc người kiểm chụp", url: u_(bc.chupClip), video: 1, info: bc.chupInfo });
    /* 12/10 user: lịch sử châm vào ô (WMS) gần giờ ghi nhận nhất trước, mỗi lượt 1 clip — KHÔNG thành nút trên thanh nguồn (8 nút làm răng cưa),
       bấm ở danh sách bên phải để phát */
    var lanIdx = (LS ? LS.ds : []).map(function (x) { if (!x.clip) return -1;
      var bd = x.vatLy && x.tgClip != null ? new Date(Date.parse(String(x.at).replace(" ", "T") + "+07:00") - x.tgClip * 1e3 + 7 * 36e5).toISOString().slice(0, 19).replace("T", " ") : lui20(x.at);
      nguon.push({ k: "lan", an: 1, ten: x.ten + " " + x.at.slice(11, 16), url: u_(x.clip), video: 1, tua: x.vatLy && x.tgClip != null ? Math.max(0, x.tgClip - 3) : null, info: { batDau: bd, suKien: [] } });
      return nguon.length - 1; });
    var coCam = nguon.some(function (n) { return n.video; });
    /* tình trạng chỉ hiện khi CHƯA đủ / cần chú ý — "Đủ bằng chứng để quyết" trùng với nút Lưu đang bật nên bỏ */
    var tt = bc.vs && (bc.vs.bui || bc.vs.camSo || bc.vs.cam) ? "Kho bụi / camera giờ báo cáo — đã nhờ anh Tâm kiểm tra thực tế, xem rồi quyết" : co ? ""
      : bc.chupLui ? "Chưa biết đồ vật xuất hiện lúc nào — chọn khung sớm nhất đã thấy đồ vật trên Dải 72 giờ" : "Chưa có bằng chứng camera — máy đang tìm";
    var nvp = String(p.ngayVP || "");   // 13/10 user: mã ô dòng trên · ngày giờ dòng dưới
    var nvpChu = nvp.length >= 16 ? nvp.slice(8, 10) + "/" + nvp.slice(5, 7) + "/" + nvp.slice(0, 4) + " " + nvp.slice(11, 16) : nvp, viTriChu = (LS && LS.bin) || p.viTri || "";
    /* 20/10 user: dòng «SKU / Mã SP» dưới Vị trí — tách từ Mô tả «Mã SP quét: <mã vạch> → SKU <sku>» / «Mã SP quét: <sku>»; dòng đó bỏ khỏi Ghi chú (không lặp) */
    var skuDs = [], moTa = String(p.ghiChu || "").split(String.fromCharCode(10)).filter(function (d) { var m = /Mã SP quét:\s*([0-9A-Za-z]+)(?:\s*→\s*SKU\s*([0-9]+))?/i.exec(d); if (!m) return true;
      skuDs.push(m[2] ? m[2] + " (mã vạch " + m[1] + ")" : m[1]); return false; }).join(String.fromCharCode(10)).trim();
    /* 20/10 user: đầu thanh = TÊN phiếu WF (1 dòng, dài cắt …); mã vị trí + ngày giờ dời xuống khối thông tin dưới Ảnh ghi nhận */
    $id("mTitle").innerHTML = '<span class="hx-mt1" title="' + e_(p.ten || "") + '">' + e_(p.ten || viTriChu || "Phiếu") + '</span>';
    ganMoTask(p.link);
    var vlMay = (LS ? LS.ds : []).map(function (x, j) { return { x: x, i: lanIdx[j] }; }).filter(function (o) { return o.x.vatLy && o.x.nguonVL === "may"; });
    /* 19/10 (6) user: «Không qua WMS» = MỌI lượt tác động không có lệnh WMS (máy soi + người ghi); không có lượt nào thì ẨN HẲN chip (không làm mờ) */
    var vlDs = (LS ? LS.ds : []).map(function (x, j) { return { x: x, i: lanIdx[j] }; }).filter(function (o) { return o.x.vatLy; }), vlDau = vlDs.filter(function (o) { return o.i >= 0; })[0];
    var vlTT = vlDs.length ? '<button type="button" class="hx-ng-vl co" data-vlchip data-vlmay="' + (vlDau ? vlDau.i : -1) + '" title="' + e_(vlDs.map(function (o) { return o.x.at.slice(11, 16) + " " + o.x.at.slice(8, 10) + "/" + o.x.at.slice(5, 7) + " · " + (o.x.moTa || o.x.ten); }).join("\n")) + '">Không qua WMS <span class="hx-ng-so">' + vlDs.length + '</span></button>' : "";
    /* 20/10 user: phiếu nhiều ảnh thì hiện ĐỦ — ảnh đầu to + số «1/N» + dãy ảnh nhỏ (cao cố định, giữ chỗ sẵn); bấm ảnh nhỏ đổi ảnh to, bấm ảnh to xem phóng */
    var anhDs = (p.anhDs && p.anhDs.length ? p.anhDs : [bc.anh]).filter(Boolean);
    var anhGN = anhDs.length ? '<div class="hx-qd-anh' + (anhDs.length > 1 ? " nhieu" : "") + '"><span class="lbl">Ảnh ghi nhận</span><img id="qdAnhGN" src="' + e_(anhDs[0]) + '" alt="Ảnh ghi nhận" decoding="async">' +
      (anhDs.length > 1 ? '<span class="hx-anh-so" id="qdAnhSo">1/' + anhDs.length + '</span></div><div class="hx-anh-day">' + anhDs.map(function (u, i) { return '<button type="button" data-anhi="' + i + '"' + (i ? "" : ' class="on"') + ' aria-label="Ảnh ' + (i + 1) + '/' + anhDs.length + '"><img src="' + e_(thu_(u) || u) + '" alt="" loading="lazy" decoding="async"></button>'; }).join("") + '</div>' : '</div>') : "";
    /* 16/10 (4) user: Quyết định ⇄ «Ai tác động ô…» đổi chỗ — cột TRÁI = bằng chứng camera + Quyết định; cột PHẢI = Ảnh ghi nhận + Ai tác động */
    /* 17/10 (4) user «làm thử cho Theo tác vụ»: rã thành phần + KHUNG như Theo máy (bộ Chỉnh bố cục kéo được) — mặc định TB_MAC.tacvu:
       [camera + nguồn xem 8] [Ảnh ghi nhận + Ai tác động 4] · [12: tình trạng → Lỗi → Máy gợi ý → Quyết định (chốt cứng đáy thanh)] */
    var tp = function (id, noi) { return '<div class="hx-tb-tp" data-tp="' + id + '">' + noi + '</div>'; };
    $id("mBody").innerHTML = '<div class="hx-qd hx-tb-luoi" data-tb="tacvu">' +
      /* 14/10 user: MÁY (xac-minh-tu-dong bước 7+8) ghi người tác động không qua hệ thống; ở đây chỉ báo kết quả máy soi + nút nguồn, DƯỚI clip (16/10 (6)) */
      tp("clip", '<div class="hx-qd-xem"><div id="qdKhung" class="hx-qd-khung" data-khung></div>' +
        /* 17/10 (6) user «thanh thời gian ở Máy và ở Tác vụ không khớp»: cùng 1 hàng thanh thời gian (mốc số = lượt tác động) + ▶ giờ · Tự động ×1 ×2 ×3 */
        '<div class="hx-tl-hang" id="qdTlHang" hidden><div class="hx-tl" id="hxTl"></div><div class="hx-xdau"><span class="hx-vbar"><button id="hxPlay" aria-label="Phát / dừng">▶</button><span class="gio" id="hxGio">--:--:--</span>' +
        '<span class="hx-toc"><button data-toc="auto" class="on">Tự động</button><button data-toc="1">×1</button><button data-toc="2">×2</button><button data-toc="3">×3</button></span></span></div></div>' +
        /* 19/10 (4) 1 hàng ngang trái→phải: Tác động WMS · Không qua WMS · Ảnh ghi nhận (bật/tắt ảnh DƯỚI clip, clip vẫn chạy) — bỏ khối «Ai tác động ô trước giờ ghi nhận» */
        /* 20/10 user (điện thoại): chip «Ghi nhận» (ảnh + khối thông tin) đứng ĐẦU hàng: Ghi nhận · Tác động WMS · Không qua WMS */
        '<div class="hx-xdau hx-ng-hang"><span class="hx-qd-nguon">' + (anhGN ? '<button type="button" class="hx-ng-anh" data-anhgn aria-pressed="false">Ghi nhận</button>' : "") +
          nguon.map(function (n, i) { return n.an || n.k !== "clip" ? "" : '<button data-ng="' + i + '" class="on">' + e_(n.ten) + '</button>'; }).join("") + vlTT +
          nguon.map(function (n, i) { return n.an || n.k === "clip" ? "" : '<button data-ng="' + i + '">' + e_(n.ten) + '</button>'; }).join("") + '</span></div></div>') +
      (anhGN ? tp("anh", anhGN) : "") +
      (LS ? tp("aitacdong", '<div class="hx-qd-ls">' + oLsKho(LS, lanIdx, ai) + '</div>') : "") +   // 19/10 (5) user: khôi phục danh sách ai tác động (chỉ bỏ dòng tiêu đề)
      /* 20/10 user: khối thông tin dưới Ảnh ghi nhận — Ngày ghi nhận / Vị trí / Ghi chú (có mới hiện) → Thuộc lỗi → Máy gợi ý (2 thành phần sẵn có, không nhân đôi) */
      tp("thongtin", '<div class="hx-qd-o hx-tb-mt"><span class="lbl">Ngày ghi nhận</span><div>' + e_(nvpChu) + '</div></div>' + (viTriChu ? '<div class="hx-qd-o hx-tb-mt"><span class="lbl">Vị trí</span><div>' + e_(viTriChu) + '</div></div>' : "") +
        (skuDs.length ? '<div class="hx-qd-o hx-tb-mt"><span class="lbl">SKU / Mã SP</span><div>' + e_(skuDs.join(" · ")) + '</div></div>' : "") +
        (moTa ? '<div class="hx-qd-o hx-tb-mt"><span class="lbl">Ghi chú</span><div class="hx-qd-mota" title="' + e_(moTa) + '">' + e_(moTa) + '</div></div>' : "")) +
      tp("tinhtrang", tt ? '<div class="hx-qd-tt">' + e_(tt) + '</div>' : "") +
      tp("loi", '<div class="hx-qd-o hx-tb-mt"><span class="lbl">Thuộc lỗi</span><div class="hx-qd-loi" title="' + e_(p.loi) + '">' + e_(p.loi) + '</div></div>') +
      tp("goiy", '<div class="hx-qd-o hx-tb-mt"><span class="lbl">Máy gợi ý</span><div>' + (p.goiY && p.goiY.nv && p.goiY.nv.length && p.goiY.nv[0].email ? p.goiY.nv.map(function (n) { return cumNV(n.ten, n.email, n.ttNv); }).join(", ") : '<b>' + e_(ai || "Chưa có ứng viên") + '</b>') + (p.goiY ? ' <span class="hx-tag ' + (MUC_MAY[mucMay(p)] || ["", ""])[1] + '">' + e_(String((MUC_MAY[mucMay(p)] || [""])[0]).replace(/^Máy gợi ý · /, "")) + '</span>' : "") + '</div></div>' +
        /* 13/10 user: đã có dữ liệu camera thì KHÔNG hiện đoạn «Vì sao» — ai/lúc nào/làm gì đã chạy thành phụ đề dưới clip từng người */
        (!coCam && p.goiY && p.goiY.lyDo ? '<div class="hx-qd-o hx-tb-mt"><span class="lbl">Vì sao · luật ' + e_(p.goiY.luat || "") + '</span><div class="hx-visao" title="Bấm để xem hết">' + e_(ngayChu(p.goiY.lyDo)) + '</div></div>' : "")) +
      tp("quyetdinh", '<div class="hx-qd-ben">' +
        '<div class="hx-qd-form"><label class="hx-qd-o"><span class="lbl">Quyết định</span><select id="qdSel"><option value="">— chưa quyết —</option>' +
          ds.map(function (o) { return '<option' + (o === q.qd ? " selected" : "") + '>' + e_(o) + '</option>'; }).join("") + '</select></label>' +
          '<label class="hx-qd-o"><span class="lbl">Gán người khác (mã NV)</span><input id="qdGc" inputmode="numeric" autocomplete="off" value="' + e_(q.gc || "") + '" placeholder="vd 260189"></label></div>' +
        '<button class="hx-nut" id="qdLuu" style="width:100%">Lưu quyết định</button><div id="qdMsg" class="muted" style="font-size:12px;min-height:16px"></div></div>') + '</div>';
    tbAp();
    var aGN = $id("qdAnhGN"), anhI = 0;
    if (aGN) aGN.onclick = function () { if (typeof openLB === "function") openLB(anhDs.map(function (u, i) { return { url: u, title: "Ảnh ghi nhận " + (i + 1) + "/" + anhDs.length }; }), anhI); };
    $id("mBody").querySelectorAll("[data-anhi]").forEach(function (b) { b.onclick = function () { anhI = Number(b.dataset.anhi); aGN.src = anhDs[anhI]; $id("qdAnhSo").textContent = (anhI + 1) + "/" + anhDs.length;
      $id("mBody").querySelectorAll("[data-anhi]").forEach(function (z) { z.classList.toggle("on", z === b); }); }; });
    ganGhiChu("phieu", String(p.id), ((LS && LS.bin) || p.viTri || "") + " · " + (nvp.length >= 16 ? nvp.slice(8, 10) + "/" + nvp.slice(5, 7) + "/" + nvp.slice(0, 4) + " " + nvp.slice(11, 16) : nvp));
    var vs0 = $id("mBody").querySelector(".hx-visao"); if (vs0) vs0.onclick = function () { vs0.classList.toggle("mo"); };
    var loi0 = $id("mBody").querySelector(".hx-qd-loi"); if (loi0) loi0.onclick = function () { loi0.classList.toggle("mo"); };
    var mt0 = $id("mBody").querySelector(".hx-qd-mota"); if (mt0) mt0.onclick = function () { mt0.classList.toggle("mo"); };   // 20/10 Mô tả dài: 3 dòng rồi «…», bấm xem đủ   // 16/10 câu lỗi dài kẹp 2 dòng, bấm mở hết
    var dangXem = null;
    /* 17/10 (6) thanh thời gian Theo tác vụ: đoạn quanh mỗi lượt tác động tô đỏ, mốc số tròn bấm tua; Tự động = ×1 quanh lượt tác động, ×3 chỗ trống
       (không có mốc thì ×1); tốc độ đang chạy = nút tô nhạt — cùng khuôn ganVideo của Theo máy. */
    function tlTacVu(v, bd, sk) {
      var th = $id("qdTlHang"), tl = $id("hxTl"); if (!th || !tl) return; th.hidden = false;
      var pd = $id("qdPd"); if (pd) { th.after(pd); pd.classList.add("hx-pd-duoi"); }   // phụ đề xuống DƯỚI thanh thời gian — thanh thời gian sát dưới video như Theo máy
      var toc = "auto", tocTo = null, gs = function (x) { return (x.t - bd) / 1000; };
      var moc = bd ? (sk || []).filter(function (x) { return x.t >= bd; }) : [];
      var hms2 = function (t) { return bd ? new Date(bd + t * 1000 + 7 * 36e5).toISOString().slice(11, 19) : String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(Math.floor(t % 60)).padStart(2, "0"); };
      var gan = function (t) { return moc.some(function (x) { return t >= gs(x) - 6 && t <= gs(x) + 10; }); };
      var ve = function () { var D2 = v.duration; if (!isFinite(D2) || !D2) return;
        moc = moc.filter(function (x) { return gs(x) <= D2; });   // lượt tác động sau đuôi clip thì không vẽ (đo thật 13774186: đoạn đỏ tràn ra ngoài thanh)
        tl.innerHTML = moc.map(function (x) { var a = Math.max(0, gs(x) - 3), b2 = Math.min(D2, gs(x) + 8); return '<div class="dn" style="left:' + (a / D2 * 100) + '%;width:' + Math.max(0.6, (b2 - a) / D2 * 100) + '%"></div>'; }).join("") +
          moc.map(function (x, j) { var xx = Math.max(1.5, Math.min(98.5, gs(x) / D2 * 100)); return '<div class="mk" style="left:' + xx + '%"></div><button class="mkn' + (x.vl ? " ng" : "") + '" data-tmk="' + j + '" style="left:' + xx + '%" title="' + e_(x.chu) + ' — bấm để tua tới">' + (j + 1) + '</button>'; }).join("") + '<div class="cur" id="hxCur"></div>';
        tl.querySelectorAll("[data-tmk]").forEach(function (m) { m.onclick = function (ev) { ev.stopPropagation(); v.currentTime = Math.max(0, gs(moc[Number(m.dataset.tmk)]) - 2); v.play().catch(function () {}); }; }); };
      var cap = function () { var t = v.currentTime || 0, D2 = v.duration;
        if (toc === "auto") { var r = !moc.length || gan(t) ? 1 : 3; if (v.playbackRate !== r) v.playbackRate = r; }
        $id("hxGio").textContent = hms2(t); var cur = $id("hxCur"); if (cur && D2) cur.style.left = (t / D2 * 100) + "%";
        var dang = toc === "auto" && !v.paused ? String(v.playbackRate) : ""; if (dang !== tocTo) { tocTo = dang; th.querySelectorAll("[data-toc]").forEach(function (x) { x.classList.toggle("dang", x.dataset.toc === dang); }); } };
      v.addEventListener("loadedmetadata", ve); if (v.readyState >= 1) ve();
      v.addEventListener("timeupdate", cap); v.addEventListener("seeked", cap);
      v.addEventListener("play", function () { $id("hxPlay").textContent = "⏸"; cap(); }); v.addEventListener("pause", function () { $id("hxPlay").textContent = "▶"; cap(); });
      $id("hxPlay").onclick = function () { if (v.paused) v.play().catch(function () {}); else v.pause(); };
      th.querySelectorAll("[data-toc]").forEach(function (b) { b.onclick = function () { toc = b.dataset.toc; th.querySelectorAll("[data-toc]").forEach(function (x) { x.classList.toggle("on", x === b); }); if (toc !== "auto") v.playbackRate = Number(toc); cap(); }; });
      tl.onclick = function (ev) { var r = tl.getBoundingClientRect(), D2 = v.duration; if (D2) v.currentTime = Math.max(0, Math.min(D2, (ev.clientX - r.left) / r.width * D2)); };
      v.onclick = function () { if (v.paused) v.play().catch(function () {}); else v.pause(); };
    }
    function xem(i) {
      var n = nguon[i], k = $id("qdKhung"); dangXem = null; k.hidden = false; var th0 = $id("qdTlHang"); if (th0) th0.hidden = true; var pd0 = $id("qdPd"); if (pd0) pd0.remove();
      if (!n) { k.innerHTML = ""; k.hidden = true; khoaAnhGN(); return; }   // không có hình camera: ẩn khung — dòng tình trạng ở cột Quyết định đã nói (không lặp)
      $id("mBody").querySelectorAll(".hx-qd-nguon [data-ng]").forEach(function (b) { b.classList.toggle("on", Number(b.dataset.ng) === i); });
      $id("mBody").querySelectorAll(".hx-qd-nguon [data-vlmay]").forEach(function (b) { b.classList.toggle("on", Number(b.dataset.vlmay) === i); });   // nút «Ảnh ghi nhận» là bật/tắt riêng — không đụng
      if (n.video) {   /* 05/10 user: "nên chạy dạng phụ đề bên dưới clip, chứ xem k hiểu đang xem gì, bạn xác minh bằng cách nhận diện gì" */
        var I = n.info || {}, bd = I.batDau ? Date.parse(I.batDau.replace(" ", "T") + "+07:00") : 0, sk = suKienClip(LS, bd, I.suKien);
        k.innerHTML = '<video autoplay muted playsinline preload="metadata" src="' + e_(n.url) + '"></video>' + (bd ? '<div class="hx-pd" id="qdPd" aria-live="polite"></div>' : "");   // 05/10 user bác dòng "Máy tìm ra bằng cách nào" (không yêu cầu) — chỉ giữ phụ đề
        var v = k.querySelector("video"); if (n.tua != null) v.addEventListener("loadedmetadata", function () { v.currentTime = n.tua; }, { once: true });
        dangXem = { n: n, v: v, bd: bd }; tlTacVu(v, bd, sk);
        if (bd) { var pd = $id("qdPd"), hm2 = function (t) { return new Date(t + 7 * 36e5).toISOString().slice(11, 19); };
          var cap = function () { var now = bd + (v.currentTime || 0) * 1000, cur = null, toi = null;
            sk.forEach(function (x) { if (x.t <= now + 500 && now - x.t < 12000) cur = x; if (x.t > now && (!toi || x.t < toi.t)) toi = x; });
            pd.innerHTML = '<span class="gio">' + hm2(now) + '</span>' + (cur ? '<span class="ngay' + (cur.vl ? " vl" : "") + '">' + e_(cur.chu) + '</span>' : toi ? '<span class="sap' + (toi.vl ? " vl" : "") + '">còn ' + Math.ceil((toi.t - now) / 1000) + ' giây tới: ' + e_(toi.chu) + '</span>' : '<span class="sap">đã qua các mốc — xem tiếp diễn biến sau đó</span>'); };
          v.addEventListener("timeupdate", cap); v.addEventListener("seeked", cap); cap(); }
        return; }
      if (n.k !== "lui") { k.innerHTML = '<img src="' + e_(n.url) + '" alt="' + e_(n.ten) + '" style="cursor:zoom-in">'; k.querySelector("img").onclick = function () { if (typeof openLB === "function") openLB([{ url: n.url, title: n.ten }], 0); }; return; }
      var moc = mocLui(p);
      k.innerHTML = '<div class="hx-lui"><img src="' + e_(n.url) + '" alt="Dải 72 giờ">' + moc.map(function (m, j) { var ph = Math.round((Date.parse(moc[0]) - Date.parse(m)) / 6e4), nh = !j ? "Lúc chụp" : ph < 60 ? ph + " phút trước" : (Math.round(ph / 6) / 10 + "").replace(".", ",") + " giờ trước";
          /* ảnh dải đã in sẵn «LÚC CHỤP / −1 giờ …» trên từng khung → không dán nhãn lặp.
             16/10 BẪY đã dính: chú thích «//» từng chèn GIỮA biểu thức này, nuốt mất «.join("") + '</div>'» → 9 nút nối dấu phẩy («,,,,,,,,»),
             khung không đóng, #qdLuiChu không có (bấm khung lỗi ngầm). Chú thích chỉ đặt trên dòng riêng. */
          return '<button data-o="' + j + '" title="' + e_(nh + " · " + m.replace("T", " ").slice(5, 16)) + '" aria-label="' + e_(nh) + '"></button>'; }).join("") + '</div>' +
        '<div class="hx-pd hx-lui-pd"><span class="sap">9 khung camera ô này: khung 1 = lúc chụp ảnh ghi nhận, các khung sau lùi dần tới 72 giờ trước</span></div>' +
        '<div class="hx-lui-chu" id="qdLuiChu" hidden></div>';
      k.querySelectorAll("[data-o]").forEach(function (b) { b.onclick = function () {
        var j = Number(b.dataset.o), chu = $id("qdLuiChu"); chu.hidden = false;
        if (j >= moc.length - 1) { chu.innerHTML = "Đồ vật có từ trước khung cuối — quá 72 giờ, máy chưa lùi xa hơn được."; return; }
        var tu = moc[j + 1], den = moc[j]; chu.textContent = "Máy đang chụp thêm trong khoảng " + tu.slice(5, 16).replace("T", " ") + " → " + den.slice(5, 16).replace("T", " ") + " (khoảng 1 phút)…";
        goi("/api/thu-hep", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: p.id, tu: tu, den: den }) })
          .then(function (r) { var lan = 0, cu = (p.bcChup || {}).lui, h = setInterval(function () { lan++; tai(true).then(function () { var p2 = D.phieu.find(function (y) { return y.id === p.id; });
              if (p2 && (((p2.bcChup || {}).lui !== cu) || (p2.bc && p2.bc.truy))) { clearInterval(h); if (document.querySelector("#modal.show")) moQD(p2); if (typeof toast === "function") toast(r.cat ? "Đã có clip lúc đồ vật xuất hiện" : "Đã chụp dải mới, bấm tiếp để thu hẹp", "ok"); }
              else if (lan > 12) { clearInterval(h); chu.textContent = "Máy chưa trả kết quả sau 4 phút — thử lại sau."; } }); }, 20000); })
          .catch(function (e) { chu.textContent = "Lỗi: " + e.message; }); }; });
    }
    /* 19/10 (6) user: danh sách ai tác động lọc THEO CHIP — «Tác động WMS» chỉ lượt có lệnh WMS; «Không qua WMS» chỉ lượt ngoài hệ thống (kèm nút Gỡ) */
    var lsKhoi = $id("mBody").querySelector(".hx-qd-ls"), nutVL = $id("mBody").querySelector("[data-vlchip]");
    var che = function (k) { if (lsKhoi) lsKhoi.dataset.che = k; if (nutVL) nutVL.classList.toggle("on", k === "vl");
      if (k === "vl") $id("mBody").querySelectorAll(".hx-qd-nguon [data-ng]").forEach(function (b) { b.classList.remove("on"); }); };
    che("wms");
    $id("mBody").querySelectorAll(".hx-qd-nguon [data-ng]").forEach(function (b) { b.onclick = function () { xem(Number(b.dataset.ng)); che("wms"); }; });
    /* 19/10 (4) «Ảnh ghi nhận»: bật/tắt ảnh ngay DƯỚI clip — clip vẫn chạy nguồn đang chọn, không thay chỗ */
    var anhTp = $id("mBody").querySelector('.hx-tb-luoi [data-tp="anh"]'), nutA = $id("mBody").querySelector("[data-anhgn]");
    ganNutAnh();
    $id("mBody").querySelectorAll("[data-lan]").forEach(function (b) { var chay = function (ev) { if (ev.target.closest("[data-vlgo]")) return; var i = Number(b.dataset.lan); if (i < 0) return;
      $id("mBody").querySelectorAll("[data-lan]").forEach(function (z) { z.classList.toggle("on", z === b); }); xem(i); $id("qdKhung").scrollIntoView({ block: "nearest", behavior: "smooth" }); };
      b.onclick = chay; b.onkeydown = function (ev) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); chay(ev); } }; });
    /* ghi / gỡ người tác động vật lý — lưu xong nạp lại để lượt mới hiện trong danh sách + phụ đề */
    var napLai = function () { return tai(true).then(function () { var p2 = D.phieu.find(function (y) { return y.id === p.id; }); if (p2 && document.querySelector("#modal.show")) moQD(p2); if (SUB === "treo") veTreo(); }); };
    if (nutVL) nutVL.onclick = function () { var i = Number(nutVL.dataset.vlmay);
      if (i >= 0) { $id("mBody").querySelectorAll("[data-lan]").forEach(function (z) { z.classList.toggle("on", Number(z.dataset.lan) === i); }); xem(i); }
      che("vl"); };
    $id("mBody").querySelectorAll("[data-vlgo]").forEach(function (g) { g.onclick = function (ev) { ev.stopPropagation(); var pr = g.dataset.vlgo.split("|");
      g.disabled = true; goi("/api/tac-dong-vat-ly", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: p.id, at: pr[0], ma: pr[1], xoa: true }) }).then(napLai).catch(function () { g.disabled = false; }); }; });
    xem(bc.truy ? 0 : (!co && bc.chupLui ? nguon.findIndex(function (n) { return n.k === "lui"; }) : 0));
    /* phiếu không có hình camera: ảnh ghi nhận hiện sẵn (nút Ảnh ghi nhận đang bật) */
    if ($id("qdKhung").hidden && nutA && anhTp && anhTp.classList.contains("an-dt")) nutA.click();
    if (typeof enhanceSelect === "function") enhanceSelect($id("qdSel"));
    if (!co) { $id("qdLuu").disabled = true; $id("qdLuu").textContent = "Chưa đủ bằng chứng để quyết"; }
    $id("qdLuu").onclick = function () {
      var b = $id("qdLuu"); b.disabled = true; $id("qdMsg").textContent = "Đang lưu…";
      goi("/api/quyet-dinh-b1", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: p.id, qd: $id("qdSel").value, gc: $id("qdGc").value }) })
        .then(function () { $id("qdMsg").textContent = "Đã lưu — máy làm ở lượt cò kế (mỗi 2 giờ)."; return tai(true).then(function () { if (SUB === "treo") veTreo(); }); })
        .catch(function (e) { $id("qdMsg").textContent = "Lỗi: " + e.message; }).then(function () { b.disabled = false; });
    };
    xongThanhBen(TB);
  }

  /* 05/10 user: "dashboard để biết cái gì cần nhắc, đã nhắc cái gì, nhắc ai, ở đâu, kết quả sau khi được nhắc" — nguồn: sổ canh-b11 (bang-591 gom().nhac) */
  var TT_NHAC = { "can-nhac": ["Cần nhắc", "bad"], "cho": ["Đã nhắc · chờ", "warn"], "tu-phat": ["Quá 72h · máy ghi lỗi", "bad"], "phan-hoi": ["Đã phản hồi", "good"], "huy": ["Đã huỷ", "info"] };
  function veNhac() {
    var N = D.nhac || { ds: [], tk: {}, tag: [] }, tk = N.tk || {}, dem = {};
    N.ds.forEach(function (x) { dem[x.tt] = (dem[x.tt] || 0) + 1; });
    var ds = N.ds.filter(function (x) { return (!LOC.nhac || x.tt === LOC.nhac) && (!TIM || (x.id + " " + x.viTri + " " + x.nv + " " + x.ql).toLowerCase().indexOf(TIM.toLowerCase()) >= 0); });
    var h = '<div class="panel" style="margin-bottom:12px"><div style="padding:12px 16px;line-height:1.7">' +
      'Đã nhắc <b>' + (tk.daNhac || 0) + '</b> phiếu · <b>' + (tk.phanHoi || 0) + '</b> phản hồi sau nhắc (' + (tk.daNhac ? Math.round(100 * (tk.phanHoi || 0) / tk.daNhac) : 0) + '%)' +
      (tk.trungViH != null ? ' · trung vị <b>' + tk.trungViH + ' giờ</b> sau nhắc · ' + (tk.trongNgay || 0) + ' phiếu ≤ 8 giờ' : '') +
      ' · <b>' + (tk.tuPhat || 0) + '</b> quá 72h máy tự ghi lỗi · <b>' + (tk.cho || 0) + '</b> đang chờ · <b>' + (tk.canNhac || 0) + '</b> cần nhắc</div></div>';
    h += boLoc([{ k: "nhac", lbl: "Trạng thái", v: LOC.nhac, opt: [["", "Tất cả (" + N.ds.length + ")"]].concat(Object.keys(TT_NHAC).filter(function (k) { return dem[k]; }).map(function (k) { return [k, TT_NHAC[k][0] + " (" + dem[k] + ")"]; })) },
      { k: "tim", lbl: "Tìm (vị trí / tên)", input: 1, v: TIM, ph: "F0-A1 / Nguyễn…" }]);
    var tag = function (x) { var t = TT_NHAC[x.tt] || [x.tt, "info"]; return '<span class="hx-tag ' + t[1] + '">' + e_(t[0]) + '</span>'; };
    var kq = function (x) { return x.tt === "phan-hoi" ? e_(x.ketQua) + (x.sauNhacH != null ? '<div class="muted" style="font-size:12px">sau nhắc ' + e_(x.sauNhacH) + ' giờ</div>' : "")
      : x.tt === "cho" ? 'Còn <b>' + e_(x.conLaiH) + ' giờ</b> tới hạn 72h' : x.tt === "can-nhac" ? e_(x.lyDo || "") : e_(x.ketQua); };
    h += '<div class="panel"><div class="panel-head"><span>Nhắc QLTT (B1.1 treo quá 48 giờ)</span><span>' + ds.length + ' phiếu</span></div>' +
      '<div class="table-wrap"><table class="hx-t-nhac" style="table-layout:fixed;width:100%;min-width:0"><thead><tr><th style="width:14%">Trạng thái</th><th style="width:17%">Ở đâu</th><th style="width:17%">Nhắc ai (NV)</th><th style="width:14%">QLTT được tag</th><th style="width:10%">Lúc nhắc</th><th style="width:20%">Kết quả</th><th style="width:8%">Task</th></tr></thead><tbody>' +
      (ds.map(function (x) { return '<tr data-l="' + e_(x.link) + '"><td>' + tag(x) + ((x.tt === "can-nhac" || x.tt === "cho") ? '<div class="muted" style="font-size:12px">treo ' + e_(x.tuoiH) + ' giờ</div>' : "") + '</td><td style="white-space:normal;word-break:break-word">' + e_(x.viTri || "—") + '</td>' +
        '<td style="white-space:normal;overflow-wrap:anywhere" title="' + e_(x.nv || "") + '">' + (function (s) { var a = String(s || "").split(/,\s*/).filter(Boolean); return a.length ? e_(a.slice(0, 3).join(", ")) + (a.length > 3 ? ' <span class="muted">+' + (a.length - 3) + ' người</span>' : "") : "—"; })(x.nv) + '</td><td style="white-space:normal">' + e_(x.ql || "—") + '</td><td>' + e_(x.nhac ? x.nhac.slice(8, 10) + "/" + x.nhac.slice(5, 7) + " " + x.nhac.slice(11, 16) : "—") + '</td>' +
        '<td style="white-space:normal">' + kq(x) + '</td><td><a class="status-link" href="' + e_(x.link) + '" target="_blank" rel="noopener">' + e_(x.id) + '</a></td></tr>'; }).join("") ||
        '<tr><td colspan="7"><div class="empty-row">Không có phiếu khớp bộ lọc.</div></td></tr>') + '</tbody></table></div>' +
      '<div class="cardlist">' + ds.map(function (x) { return '<div class="cl-item"><div class="cl-body"><div class="cl-top">' + tag(x) + '</div>' +
        '<div class="cl-kv">Ở đâu: <b>' + e_(x.viTri || "—") + '</b></div><div class="cl-kv">Nhắc: <b>' + e_(x.nv || "—") + '</b> · QLTT <b>' + e_(x.ql || "—") + '</b></div>' +
        '<div class="cl-kv">Lúc nhắc: <b>' + e_(x.nhac || "—") + '</b></div><div class="cl-kv">Kết quả: ' + kq(x) + '</div>' +
        '<div class="cl-kv" style="margin-top:6px"><a class="status-link" href="' + e_(x.link) + '" target="_blank" rel="noopener">Mở task ' + e_(x.id) + '</a></div></div></div>'; }).join("") + '</div></div>';
    if ((N.tag || []).length) h += '<div class="panel" style="margin-top:12px"><div class="panel-head"><span>Tag QLTT khác (gộp lỗi trùng · tái phạm trong tháng)</span><span>' + N.tag.length + '</span></div><div style="padding:10px 16px;line-height:1.8">' +
      N.tag.map(function (t) { return '<div><span class="hx-tag info">' + e_(t.loai === "CH-05" ? "Gộp lỗi trùng" : "Tái phạm") + '</span> <a class="status-link" href="https://work.hasaki.vn/tasks?task_id=' + e_(t.id) + '" target="_blank" rel="noopener">' + e_(t.id) + '</a> · ' + e_(t.chu) + '</div>'; }).join("") + '</div></div>';
    $id("hxBody").innerHTML = h;
    ganLoc(function (k, v, go) { if (k === "tim") TIM = v; else LOC[k] = v; luu(); veNhac(); if (go) { var i = $id("hxFilters").querySelector("input"); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } } });
    $id("hxBody").querySelectorAll("tr[data-l]").forEach(function (r) { r.onclick = function (ev) { if (ev.target.closest("a")) return; window.open(r.dataset.l, "_blank", "noopener"); }; });
  }

  /* 12/10 user: "mọi task đều để tên t là người tạo — do bộ cò tạo từ tài khoản của t; cải tiến để t biết task/hình ảnh đó do ai tạo
     (dữ liệu này chỉ t coi được)". Nguồn: sổ tác giả (so-tac-gia.mjs) trên máy này, qua máy chủ 8591 — trang công khai không có. */
  function taoBoi(p) { return p.mayTao ? '<div class="muted" style="font-size:12px;margin-top:3px">Phiếu do <b>' + e_(p.mayTao) + '</b> tạo' + (p.nguoiGui ? ' · người gửi <b>' + e_(p.nguoiGui) + '</b>' : "") + '</div>' : ""; }
  function tgHomNay() { var hn = new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10); return ((D.tacGia || {}).ds || []).filter(function (x) { return x.t.slice(0, 10) === hn; }).length; }
  var HD_TAG = { "Tạo phiếu": "info", "Dừng phiếu": "bad", "Xoá bình luận": "bad", "Bình luận + tệp": "warn" };
  var NHOM_TG = [];
  /* tô phần KHÁC NHAU giữa trước / sau — so THEO TỪ (dãy con chung dài nhất): chỉ tô từ bị bỏ (cũ, gạch đỏ) / từ thêm (mới, nền xanh) */
  function khacBiet(a, b) {
    var A = String(a == null ? "" : a).split(/(\s+)/), B = String(b == null ? "" : b).split(/(\s+)/), n = A.length, m = B.length, L = [];
    for (var x = 0; x <= n; x++) { L.push(new Array(m + 1).fill(0)); }
    for (x = n - 1; x >= 0; x--) for (var y = m - 1; y >= 0; y--) L[x][y] = A[x] === B[y] ? L[x + 1][y + 1] + 1 : Math.max(L[x + 1][y], L[x][y + 1]);
    var ra = "", rb = "", u = 0, v = 0, to = function (t, lop) { return /^\s+$/.test(t) ? e_(t) : '<span class="' + lop + '">' + e_(t) + "</span>"; };
    while (u < n && v < m) { if (A[u] === B[v]) { ra += e_(A[u]); rb += e_(B[v]); u++; v++; } else if (L[u + 1][v] >= L[u][v + 1]) { ra += to(A[u++], "hx-cu"); } else { rb += to(B[v++], "hx-moi"); } }
    while (u < n) ra += to(A[u++], "hx-cu"); while (v < m) rb += to(B[v++], "hx-moi");
    return [ra, rb];
  }
  var TEN_TRUONG = { name: "Tên phiếu", finished_at: "Hoàn thành lúc", date_end: "Hạn chót", date_start: "Ngày bắt đầu", status: "Trạng thái", data: "Dữ liệu phiếu", description: "Mô tả" };
  function moNhomTG(g) {
    if (!g) return; var x0 = g.ds[0], coTS = g.ds.some(function (x) { return x.truong; });
    var lk = function (id) { return id ? '<a class="status-link" href="https://work.hasaki.vn/tasks?task_id=' + e_(id) + '" target="_blank" rel="noopener">' + e_(id) + "</a>" : '<span class="muted">—</span>'; };
    $id("mTitle").innerHTML = e_(x0.ten) + ' <span class="stat-sub">' + e_(x0.hd) + " · " + g.ds.length + " lượt</span>";
    $id("mBody").innerHTML = '<div class="hx-tg-ct"><div class="muted" style="margin:0 0 12px">' + e_(x0.cach) + " · " + e_(x0.may) + (x0.chuoi.indexOf(" › ") > 0 ? " · gọi từ " + e_(x0.chuoi.split(" › ").slice(0, -1).join(" › ")) : "") + "</div>" +
      '<div class="table-wrap"><table class="mbcard hx-tg-bang"><thead><tr><th style="width:110px">Lúc</th><th style="width:100px">Phiếu</th>' + (coTS ? '<th style="width:90px">Trường</th><th>Trước khi điều chỉnh</th><th>Sau khi điều chỉnh</th>' : "<th>Nội dung · ảnh</th>") + "</tr></thead><tbody>" +
      g.ds.slice().reverse().map(function (x) { var k = coTS ? khacBiet(x.truoc, x.sau) : null;
        return "<tr><td data-lb=\"Lúc\">" + e_(x.t.slice(8, 10) + "/" + x.t.slice(5, 7) + " " + x.t.slice(11, 19)) + '</td><td class="mb-hd">' + lk(x.phieu) + "</td>" +
          (coTS ? '<td data-lb="Trường">' + e_(TEN_TRUONG[x.truong] || x.truong || "—") + '</td><td class="mb-full" data-lb="Trước">' + (x.truoc != null ? k[0] : '<span class="muted">chưa ghi (lượt trước 13/10)</span>') + '</td><td class="mb-full" data-lb="Sau">' + (x.sau != null ? k[1] : '<span class="muted">—</span>') + "</td>"
            : '<td class="mb-full" data-lb="Nội dung">' + (x.nd ? e_(x.nd) : "") + (x.tep.length ? '<div class="muted">Tệp: ' + e_(x.tep.join(", ")) + "</div>" : "") + (!x.nd && !x.tep.length ? '<span class="muted">—</span>' : "") + "</td>") + "</tr>"; }).join("") +
      "</tbody></table></div></div>";
    boThanhBen(); hienModal("modal");
  }
  function veTG() {
    var all = (D.tacGia || {}).ds || [], demB = {}, demH = {};
    all.forEach(function (x) { demB[x.ten] = (demB[x.ten] || 0) + 1; demH[x.hd] = (demH[x.hd] || 0) + 1; });
    var q = (TIM || "").toLowerCase();
    /* 12/10 user: bỏ mục Nhắc QLTT vì "ở Nhật ký có lưu rồi — chỉ cần thêm trường lọc" ⇒ thêm lọc Ngày (lượt nhắc = Bộ «Cò canh B1.1» · Làm gì «Bình luận») */
    if (LOC.tgNgay && !Array.isArray(LOC.tgNgay)) LOC.tgNgay = "";   // 19/10 bộ lọc ngày chuẩn: bỏ giá trị cũ kiểu "số ngày lùi"
    var ngayCo = {}; all.forEach(function (x) { ngayCo[String(x.t).slice(0, 10)] = 1; });
    var ds = all.filter(function (x) { return (!LOC.tgBo || x.ten === LOC.tgBo) && (!LOC.tgHd || x.hd === LOC.tgHd) && trongKhoang(String(x.t).slice(0, 10), LOC.tgNgay) &&
      (!q || (x.phieu + " " + x.ten + " " + x.chuoi + " " + (x.nguoi || "") + " " + x.nd + " " + x.tep.join(" ")).toLowerCase().indexOf(q) >= 0); });
    var h = boLoc([{ k: "tgBo", lbl: "Bộ nào làm", v: LOC.tgBo || "", opt: [["", "Tất cả (" + all.length + ")"]].concat(Object.keys(demB).sort(function (a, b) { return demB[b] - demB[a]; }).map(function (k) { return [k, k + " (" + demB[k] + ")"]; })) },
      { k: "tgHd", lbl: "Làm gì", v: LOC.tgHd || "", opt: [["", "Tất cả"]].concat(Object.keys(demH).sort(function (a, b) { return demH[b] - demH[a]; }).map(function (k) { return [k, k + " (" + demH[k] + ")"]; })) },
      { k: "tgNgay", lbl: "Ngày", ngay: 1, v: LOC.tgNgay || "", coDuLieu: function (iso) { return !!ngayCo[iso]; }, nhan: function (a, b) { return a ? "" : "14 ngày"; },
        presets: [{ k: "today", lb: "Hôm nay" }, { k: "yesterday", lb: "Hôm qua" }, { k: "3", lb: "3 ngày" }, { k: "7", lb: "7 ngày" }, { k: "all", lb: "Tất cả" }] },
      { k: "tim", lbl: "Tìm (mã phiếu / người gửi / tên ảnh)", input: 1, v: TIM, ph: "14082801 / Nguyễn… / bang-chung…" }]);
    var link = function (id) { return "https://work.hasaki.vn/tasks?task_id=" + id; };
    var oPhieu = function (x) { return x.phieu ? '<a class="status-link" href="' + e_(link(x.phieu)) + '" target="_blank" rel="noopener">' + e_(x.phieu) + '</a>' + (x.doan ? ' <span class="muted" title="Máy suy ra từ phiếu vừa đọc trước đó">(suy ra)</span>' : "") : '<span class="muted">—</span>'; };
    var oBo = function (x) { return '<b>' + e_(x.ten) + '</b>' + (x.chuoi.indexOf(" › ") > 0 ? '<div class="muted" style="font-size:12px">gọi từ ' + e_(x.chuoi.split(" › ").slice(0, -1).join(" › ")) + '</div>' : "") +
      (x.nguoi ? '<div style="font-size:13px;margin-top:2px">Người gửi: <b>' + e_(x.nguoi) + '</b></div>' : "") +
      '<div class="muted" style="font-size:12px">' + e_(x.cach) + ' · ' + e_(x.may) + '</div>'; };
    var oViec = function (x) { return '<span class="hx-tag ' + (HD_TAG[x.hd] || "") + '">' + e_(x.hd) + '</span>' + (x.ok ? "" : ' <span class="hx-tag bad">lỗi</span>'); };
    var oNd = function (x) { return (x.nd ? '<div class="hx-l2" title="' + e_(x.nd) + '">' + e_(x.nd) + '</div>' : "") + (x.tep.length ? '<div class="muted" style="font-size:12px">Tệp: ' + e_(x.tep.join(", ")) + '</div>' : "") || '<span class="muted">—</span>'; };
    var luc = function (x) { return x.t.slice(8, 10) + "/" + x.t.slice(5, 7) + " " + x.t.slice(11, 16); };
    /* 13/10 user: «cùng 1 thông tin trong 1 khoảng thời gian liên tiếp thì GOM NHÓM, bấm vào ra pop-up chi tiết; hiển thị TRƯỚC VÀ SAU KHI ĐIỀU CHỈNH».
       Gom = các lượt LIỀN NHAU cùng bộ · việc · máy · cách chạy · kết quả, lượt sau cách lượt trước ≤ 10 phút. */
    var khoaNhom = function (x) { return [x.ten, x.chuoi, x.hd, x.may, x.cach, x.ok, x.nguoi || ""].join("|"); };
    var ms = function (x) { return Date.parse(String(x.t).replace(" ", "T") + "+07:00"); };
    var nhom = []; ds.forEach(function (x) { var g = nhom[nhom.length - 1];
      if (g && khoaNhom(g.ds[0]) === khoaNhom(x) && ms(g.ds[g.ds.length - 1]) - ms(x) <= 10 * 60e3) g.ds.push(x); else nhom.push({ ds: [x] }); });
    var SO = LOC.soHienTG || 60, nhomHien = nhom.slice(0, SO);
    NHOM_TG = nhom;
    var lucNhom = function (g) { var a = g.ds[g.ds.length - 1], b = g.ds[0]; return luc(a) + (a.t.slice(0, 16) !== b.t.slice(0, 16) ? "–" + b.t.slice(11, 16) : ""); };
    var phieuNhom = function (g) { var ps = []; g.ds.forEach(function (x) { if (x.phieu && ps.indexOf(x.phieu) < 0) ps.push(x.phieu); }); return ps.length === 1 ? oPhieu(g.ds[0]) : ps.length ? "<b>" + ps.length + "</b> phiếu" : '<span class="muted">—</span>'; };
    var ndNhom = function (g) { if (g.ds.length === 1) return oNd(g.ds[0]);
      var co = g.ds.filter(function (x) { return x.truong; }).length;
      var tr = g.ds.find(function (x) { return x.truong; }); return (co ? '<div>Đổi <b>' + e_((TEN_TRUONG[tr.truong] || tr.truong).toLowerCase()) + "</b> · " + co + " phiếu có trước / sau</div>" : oNd(g.ds[0])); };
    h += '<div class="panel"><div class="panel-head"><span>Nhật ký máy ghi lên work.hasaki.vn</span><span>' + ds.length + " lượt · " + nhom.length + " nhóm</span></div>" +
      '<div class="table-wrap"><table class="hx-t-tg" style="table-layout:fixed;width:100%;min-width:0"><thead><tr><th style="width:12%">Lúc</th><th style="width:24%">Bộ nào làm</th><th style="width:16%">Làm gì</th><th style="width:12%">Phiếu</th><th>Nội dung · ảnh</th></tr></thead><tbody>' +
      (nhomHien.map(function (g, i) { var x = g.ds[0];
        return '<tr class="hx-tg-nhom" data-tg="' + i + '" title="Xem chi tiết từng lượt"><td>' + e_(lucNhom(g)) + '</td><td style="white-space:normal">' + oBo(x) + "</td><td>" + oViec(x) + (g.ds.length > 1 ? ' <span class="hx-tag">× ' + g.ds.length + "</span>" : "") +
          "</td><td>" + phieuNhom(g) + '</td><td style="white-space:normal;overflow-wrap:anywhere">' + ndNhom(g) + "</td></tr>"; }).join("") ||
        '<tr><td colspan="5"><div class="empty-row">' + (all.length ? "Không có lượt khớp bộ lọc." : "Chưa có lượt nào — sổ bắt đầu ghi từ 12/10/2026.") + "</div></td></tr>") + "</tbody></table></div>" +
      '<div class="cardlist">' + nhomHien.map(function (g, i) { var x = g.ds[0]; return '<div class="cl-item hx-tg-nhom" data-tg="' + i + '"><div class="cl-body"><div class="cl-top">' + oViec(x) + (g.ds.length > 1 ? ' <span class="hx-tag">× ' + g.ds.length + "</span>" : "") + ' <span class="muted">' + e_(lucNhom(g)) + "</span></div>" +
        '<div class="cl-kv">' + oBo(x) + '</div><div class="cl-kv">Phiếu: ' + phieuNhom(g) + '</div><div class="cl-kv">' + ndNhom(g) + "</div></div></div>"; }).join("") + "</div>" +
      (nhom.length > nhomHien.length ? '<div style="padding:12px 16px;text-align:center"><button class="hx-nut" id="hxThemTG">Xem thêm ' + Math.min(60, nhom.length - nhomHien.length) + " nhóm (còn " + (nhom.length - nhomHien.length) + ")</button></div>" : "") + "</div>";
    $id("hxBody").innerHTML = h;
    if ($id("hxThemTG")) $id("hxThemTG").onclick = function () { LOC.soHienTG = SO + 60; veTG(); };
    $id("hxBody").querySelectorAll(".hx-tg-nhom").forEach(function (r) { r.onclick = function (ev) { if (ev.target.closest("a")) return; moNhomTG(NHOM_TG[+r.dataset.tg]); }; });
    ganLoc(function (k, v, go) { if (k === "tim") TIM = v; else LOC[k] = v; LOC.soHienTG = 60; luu(); veTG(); if (go) { var i = $id("hxFilters").querySelector("input"); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } } });
  }

  /* 05/10 user: "đưa lên dashboard luôn" — phân công khu giấy · rác theo ngày (luật PL-01): nguồn = task 5S hằng ngày QL tạo
     (khuôn «Sắp xếp hàng hóa kho tổng»), đọc bằng phan-cong-khu-giay.mjs; ảnh mốc camera 12:00 · 18:30 (PL-03).
     wshr không có API liệt kê task thường ⇒ task mới vào bằng ô "Dán link task". */
  var TT_KHU = { xong: ["Đã báo cáo", "good"], tre: ["Báo cáo trễ", "warn"], cho: ["Chưa báo cáo", "warn"], khong: ["Không báo cáo", "bad"] };
  function khuChua() { var P = D && D.phanCong, d = P && P.ds && P.ds[0]; if (!d) return 0; var n = 0;
    d.tasks.forEach(function (t) { t.khu.forEach(function (k) { k.nguoi.forEach(function (x) { if (x.tt !== "xong") n++; }); }); }); return n; }
  function veKhu() {
    var P = D.phanCong || { ds: [] }, ds = P.ds || [];
    if (!LOC.khuNgay || !ds.some(function (d) { return d.ngay === LOC.khuNgay; })) LOC.khuNgay = (ds.find(function (d) { return d.coTask; }) || ds[0] || {}).ngay || "";
    var d = ds.find(function (x) { return x.ngay === LOC.khuNgay; }) || { tasks: [], moc: [] };
    var thu = function (n) { var t = new Date(n + "T00:00:00+07:00").getDay(); return (t === 0 ? "CN" : "T" + (t + 1)) + " " + ngayVN(n); };
    var h = boLoc([{ k: "khuNgay", lbl: "Ngày", v: LOC.khuNgay, opt: ds.map(function (x) { return [x.ngay, thu(x.ngay) + (x.coTask ? "" : " · chưa có task")]; }) }]);
    var khu = { KG: [], PL: [] };   // một ngày có thể có 2 QL, mỗi QL 1 task
    d.tasks.forEach(function (t) { t.khu.forEach(function (k) { (khu[k.loai] = khu[k.loai] || []).push({ t: t, k: k }); }); });
    var VT = P.viTri || {}, CAM = { KG: "KGC", PL: "PLR" };
    var moc = function (ma) { var m = d.moc.filter(function (x) { return x.ma === ma; });
      return ["12:00", "18:30"].map(function (g) { var x = m.find(function (y) { return y.gio === g; });
        return '<figure>' + (x ? '<img src="' + e_(u_(x.url)) + '" alt="Camera ' + g + '" loading="lazy" data-lb="' + e_(u_(x.url)) + '">' : '<div class="trong">Chưa có ảnh mốc ' + g + '</div>') + '<figcaption>Camera ' + g + '</figcaption></figure>'; }).join(""); };
    h += '<div class="hx-khu">' + ["KG", "PL"].map(function (L) {
      var ng = [], dongs = []; khu[L].forEach(function (o) { dongs.push(o.k.dong + " · QL " + o.t.ql); o.k.nguoi.forEach(function (x) { ng.push({ x: x, ca: o.k.ca }); }); });
      var chua = ng.filter(function (o) { return o.x.tt !== "xong"; }).length;
      var tt = !d.tasks.length ? '<span class="hx-tag">Chưa có task</span>' : !ng.length ? '<span class="hx-tag warn">QL không giao khu này</span>' : chua ? '<span class="hx-tag warn">' + chua + ' người chưa</span>' : '<span class="hx-tag good">Đủ báo cáo</span>';
      return '<div class="panel"><div class="panel-head"><span>' + e_((VT[L] || {}).ten || L) + ' <span class="ma">' + e_((VT[L] || {}).ma || "") + '</span></span>' + tt + '</div>' +
        (d.moc.some(function (x) { return x.ma === CAM[L]; }) ? '<div class="hx-moc">' + moc(CAM[L]) + '</div>' : '<div class="muted" style="font-size:12px;padding:10px 16px 0">Ngày này chưa có ảnh camera 12:00 · 18:30 (máy chụp từ 05/10).</div>') +
        (ng.length ? ng.map(function (o) { var t = TT_KHU[o.x.tt] || [o.x.tt, "info"], xg = String(o.x.xong || "");
          return '<div class="hx-ngu"><div><b>' + e_(o.x.ten || "?") + '</b> <span class="s">' + e_(o.x.code || "chưa khớp mã") + (o.ca ? " · ca " + e_(o.ca) : "") + '</span>' +
            '<div class="s">' + (xg ? "Gửi lúc " + e_(xg.slice(11, 16)) + (xg.slice(0, 10) !== d.ngay ? " ngày " + e_(ngayVN(xg.slice(0, 10))) : "") + " · " + e_(o.x.anh) + " ảnh" : "Chưa gửi ảnh") + '</div></div>' +
            '<span class="hx-tag ' + t[1] + '">' + e_(t[0]) + '</span></div>'; }).join("") +
          '<div class="hx-ngu"><div class="dong">' + dongs.map(e_).join("<br>") + ' · <a class="status-link" href="' + e_(khu[L][0].t.link) + '" target="_blank" rel="noopener">Mở task</a></div></div>'
          : '<div class="hx-trong">' + (d.tasks.length ? "Task ngày này không có dòng giao khu này." : "Chưa có task phân công của ngày này — dán link ở ô bên dưới.") + '</div>') + '</div>'; }).join("") + '</div>';
    h += '<div class="panel" style="margin-bottom:14px"><div class="panel-head"><span>Thêm task phân công</span></div>' +
      '<div class="hx-them"><label><span class="lbl">Link task 5S hằng ngày của QL (work.hasaki chưa cho máy tự tìm)</span><input type="text" id="hxPcLink" placeholder="https://work.hasaki.vn/tasks?task_id=…"></label><button id="hxPcThem">Thêm</button></div><div id="hxPcSt" style="padding:0 16px 12px"></div></div>';
    var dem = function (x, L) { var n = 0, ok = 0; x.tasks.forEach(function (t) { t.khu.forEach(function (k) { if (L && k.loai !== L) return; k.nguoi.forEach(function (p) { n++; if (p.tt === "xong") ok++; }); }); }); return [n, ok]; };
    var qls = function (x) { return x.tasks.map(function (t) { return t.ql; }).join(" · "); };
    h += '<div class="panel"><div class="panel-head"><span>14 ngày gần nhất</span><span>' + ds.filter(function (x) { return x.coTask; }).length + ' ngày có task</span></div>' +
      '<div class="table-wrap"><table style="table-layout:fixed;width:100%;min-width:0"><thead><tr><th style="width:16%">Ngày</th><th style="width:26%">QL phân công</th><th style="width:14%">Kho giấy</th><th style="width:16%">Phân loại thùng · rác</th><th style="width:14%">Báo cáo</th><th style="width:14%">Ảnh mốc</th></tr></thead><tbody>' +
      ds.map(function (x) { var a = dem(x);
        return '<tr data-ng="' + e_(x.ngay) + '"><td><b>' + e_(thu(x.ngay)) + '</b></td><td>' + (x.coTask ? e_(qls(x)) : '<span class="muted">Chưa có task</span>') + '</td>' +
          '<td>' + (x.coTask ? dem(x, "KG")[0] + " người" : "—") + '</td><td>' + (x.coTask ? dem(x, "PL")[0] + " người" : "—") + '</td><td>' + (x.coTask ? a[1] + "/" + a[0] : "—") + '</td><td>' + (x.moc.length ? x.moc.length + " ảnh" : "—") + '</td></tr>'; }).join("") +
      '</tbody></table></div><div class="cardlist">' + ds.map(function (x) { var a = dem(x);
        return '<div class="cl-item" data-ng="' + e_(x.ngay) + '"><div class="cl-body"><div class="cl-loi"><b>' + e_(thu(x.ngay)) + '</b></div><div class="cl-kv">' + (x.coTask ? "QL: <b>" + e_(qls(x)) + "</b> · báo cáo <b>" + a[1] + "/" + a[0] + "</b>" : "Chưa có task phân công") + '</div><div class="cl-kv">Ảnh mốc camera: ' + (x.moc.length || 0) + '</div></div></div>'; }).join("") + '</div></div>';
    $id("hxBody").innerHTML = h;
    ganLoc(function (k, v) { LOC[k] = v; luu(); veKhu(); });
    $id("hxBody").querySelectorAll("[data-ng]").forEach(function (r) { r.onclick = function () { LOC.khuNgay = r.dataset.ng; luu(); veKhu(); PANE.scrollIntoView({ behavior: "smooth" }); }; });
    $id("hxBody").querySelectorAll("img[data-lb]").forEach(function (im) { im.onclick = function () { if (typeof openLB === "function") openLB([{ url: im.dataset.lb, title: im.alt || "Ảnh camera" }], 0); else window.open(im.dataset.lb, "_blank", "noopener"); }; });
    $id("hxPcThem").onclick = function () { var b = this, v = $id("hxPcLink").value.trim(), st = $id("hxPcSt"); if (!v) return;
      b.disabled = true; b.textContent = "Đang đọc…";
      goi("/api/phan-cong-task", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ link: v }) })
        .then(function (j) { st.innerHTML = '<div class="hx-st ok">Đã thêm task ' + e_(j.id) + '.</div>'; return tai(true).then(function () { veKhu(); if (typeof toast === "function") toast("Đã thêm task phân công", "ok"); }); })
        .catch(function (e) { st.innerHTML = '<div class="hx-st loi">' + e_(e.message) + '</div>'; b.disabled = false; b.textContent = "Thêm"; }); };
  }

  /* ---------- đăng nhập (12/10) ---------- */
  function datNutDX(co) { document.body.dataset.hxPhien = co ? "1" : ""; if (typeof window.nutDauTrang === "function") window.nutDauTrang(); }
  function veDangNhap(thongBao) {
    if (!PANE) return; datNutDX(false);
    var em = ""; try { em = localStorage.getItem("hx-email") || ""; } catch (e) {}
    PANE.innerHTML = '<div class="panel hx-dn"><div class="panel-head"><span>Đăng nhập phần Xác minh</span></div>' +
      '<form id="hxDnForm" autocomplete="on"><label><span class="lbl">Tài khoản</span><input id="hxDnEm" type="text" autocomplete="username" required placeholder="vd: tamlc" value="' + e_(em.replace(/@.*$/, "")) + '"></label>' +
      '<label><span class="lbl">Mật khẩu</span><input id="hxDnMk" type="password" autocomplete="current-password" required></label>' +
      '<button type="submit" class="hx-nut" id="hxDnNut">Đăng nhập</button><div id="hxDnSt"' + (thongBao ? ' class="hx-st loi">' + e_(thongBao) : '>') + '</div></form></div>';
    var f = $id("hxDnForm"); (em ? $id("hxDnMk") : $id("hxDnEm")).focus();
    f.onsubmit = function (ev) {
      ev.preventDefault(); var nut = $id("hxDnNut"), st = $id("hxDnSt"), email = $id("hxDnEm").value.trim();
      nut.disabled = true; st.className = ""; st.textContent = "Đang kiểm tra…";
      var ctl = new AbortController(), hh = setTimeout(function () { ctl.abort(); }, 15000);
      /* 14/10: đăng nhập bằng TÀI KHOẢN CHUNG audit-dc (tai-khoan.js → Apps Script) rồi đổi sang phiên máy chủ; Apps Script không gọi được
         thì rơi về tài khoản nội bộ của máy chủ 8591 như cũ. */
      var mk = $id("hxDnMk").value;
      var noiBo = function () { return fetch(API + "/api/dang-nhap", { method: "POST", headers: { "content-type": "application/json" }, signal: ctl.signal, body: JSON.stringify({ email: email, matKhau: mk }) })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok || !j.phien) throw new Error(j.loi || ("HTTP " + r.status)); return j; }); }); };
      (typeof window.tkDangNhap === "function"
        ? window.tkDangNhap(email, mk).then(function () { return window.tkDoiPhienXm(); }, function (e) { if (e.code) throw e; return noiBo(); })
            .then(function (x) { if (x && x.phien) return x; var ph = ""; try { ph = localStorage.getItem("hx-phien") || ""; } catch (e2) {} if (!ph) throw new Error("Tài khoản chưa được cấp quyền Xác minh, hoặc máy chủ Xác minh chưa chạy"); return { phien: ph }; })
        : noiBo())
        .then(function (j) { datPhien(j.phien); try { localStorage.setItem("hx-email", email); } catch (e) {} D = null; init(PANE); })
        .catch(function (e) { st.className = "hx-st loi"; st.textContent = e.name === "AbortError" ? "Máy chủ Xác minh không trả lời — thử lại." : e.message; $id("hxDnMk").select(); })
        .finally(function () { clearTimeout(hh); nut.disabled = false; });
    };
  }
  function dangXuat() {
    /* 16/10 user «đăng xuất rồi nhưng vẫn hiện các mục con cần đăng nhập»: nút Đăng xuất ở đây trước chỉ xoá phiên máy chủ 8591, tài khoản
       chung (tai-khoan.js) vẫn đăng nhập ⇒ thanh bên vẫn bày Theo tác vụ/Theo máy/Máy trạm/Nhật ký. Có hệ tài khoản ⇒ đăng xuất CẢ hai. */
    if (window.TK && window.TK.nguoi && typeof window.tkDangXuat === "function") { D = null; GIU = {}; window.tkDangXuat(); return; }
    var ph = PHIEN; datPhien(""); D = null; GIU = {};
    fetch(API + "/api/dang-xuat", { method: "POST", headers: { "x-hx-phien": ph } }).catch(function () {});
    veDangNhap();
  }
  document.addEventListener("click", function (e) { if (e.target && (e.target.id === "hxDangXuat" || e.target.id === "hdrDangXuat")) dangXuat(); });

  function init(pane) {
    PANE = pane; napCss();
    if (!PHIEN && !(window.TK && window.TK.phien && typeof window.tkDoiPhienXm === "function")) { veDangNhap(); return; }   // 19/10: có tài khoản audit-dc → tai() đổi phiên trước
    if (!D) pane.innerHTML = '<div class="kpi-band">' + '<div class="kb-tile"><div class="sk sk-line" style="width:60%"></div></div>'.repeat(4) + '</div><div class="panel" style="margin-top:14px"><div style="padding:18px 16px"><div class="sk sk-line" style="width:86%"></div><div class="sk sk-line" style="width:70%"></div><div class="sk sk-line" style="width:78%"></div></div></div>';
    tai(); clearInterval(init._h); init._h = setInterval(function () { if (!document.hidden && PANE && !PANE.classList.contains("hidden") && !document.querySelector("#modal.show")) tai(); }, 120e3);
  }
  // bộ đo qc-mobile-toan-du-an gọi các hàm này để mở đúng màn (mục 7 bộ chuẩn: phạm vi đo = phạm vi lời hứa)
  window.HXACMINH = { init: init, coDuLieu: function () { return !!D; },
    sub: function (k) { if (!/^(treo|cam|tg)$/.test(k)) k = "treo"; if (typeof dongMoiPopup === "function") dongMoiPopup(); SUB = k; TIM = ""; if (k === "cam") LOC.tt = "cho"; luu(); ve();
      if (PANE && window.nhipTab) window.nhipTab(PANE);   // 16/10 đổi mục con = cùng nhịp chuyển tab (paneIn), không bật thô
      return true; },
    moLuotDau: function () { var l = D && (D.luot.find(function (x) { return (x.buocAnh || []).some(function (b) { return (b.hop || []).length; }); }) || D.luot[0]); if (!l) return false; moLuot(l); return true; },
    moPhieuId: function (id) { var p = D && D.phieu.find(function (x) { return String(x.id) === String(id); }); if (!p) return false; moQD(p); return true; },
    moLuotId: function (id) { var l = D && D.luot.find(function (x) { return x.id === id; }); if (!l) return false; moLuot(l); return true; },
    moNVDau: function () { var x = D && D.nhanVien.find(function (y) { return y.viec.some(function (v) { return v.loai !== "dang-giu"; }); }); if (!x) return false; moNV(x, false); return true; } };
})();
