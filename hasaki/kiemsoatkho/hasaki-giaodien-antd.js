/* hasaki-giaodien-antd.js — LỚP GIAO DIỆN THỬ theo bộ quy chuẩn Ant Design (12/10/2026, user: "làm theo ant design thử").
 * Nguồn số: github.com/ant-design/ant-design/tree/master/docs/spec (layout · font · colors · shadow · buttons · copywriting)
 * + token mặc định của thư viện antd v5 (bo góc 6, control cao 32, thanh bên 200, đầu trang 56).
 *
 * Chỉ là lớp ÁO: không đụng dữ liệu, không gọi mạng, không sửa logic tab. 12/10 LIVE mặc định (user "theo ant design chưa live").
 * Tắt trong Cài đặt → tải lại trang (về y bản cũ, nhớ theo máy: localStorage ad-giaodien=cu).
 *
 * Bộ token đã chốt (đừng thêm số ngoài bộ này):
 *   · lưới 8: khoảng cách 8 / 16 / 24 · chữ 12 / 14 / 16 / 20 / 24, chữ gốc 14 dòng 22 · độ đậm 400 / 500 / 600
 *   · màu: chính #1677ff (rê #4096ff, nền chọn #e6f4ff) · chữ rgba(0,0,0,.88) · phụ rgba(0,0,0,.45)
 *     viền control #d9d9d9 · vạch chia #f0f0f0 · nền trang #f5f5f5 · đầu bảng #fafafa
 *     thành công #52c41a · cảnh báo #faad14 · lỗi #ff4d4f
 *   · bo góc: control 6 · thẻ / pop-up 8 · nhãn 4
 *   · bóng 4 tầng: 0 = không (ô nhập, thẻ đứng yên) · 1 = khi rê thẻ bấm được · 2 = danh sách thả · 3 = hộp thoại
 *   · CẤM: nền chuyển màu, kính mờ, bóng thường trực, nhấc thẻ khi rê
 * Luật dự án vẫn thắng luật Ant Design: điện thoại vùng chạm ≥40px (antd 32px chỉ áp máy tính), không emoji. */
(function () {
  if (window.__AD_GD) return; window.__AD_GD = 1;
  var KEY = "ad-giaodien";
  function bat() { try { return localStorage.getItem(KEY) !== "cu"; } catch (e) { return true; } }
  function dat(v) { try { localStorage.setItem(KEY, v ? "moi" : "cu"); } catch (e) {} }

  var BONG1 = "0 1px 2px -2px rgba(0,0,0,.16),0 3px 6px 0 rgba(0,0,0,.12),0 5px 12px 4px rgba(0,0,0,.09)";
  var BONG2 = "0 6px 16px 0 rgba(0,0,0,.08),0 3px 6px -4px rgba(0,0,0,.12),0 9px 28px 8px rgba(0,0,0,.05)";
  var VONG = "0 0 0 2px rgba(5,145,255,.1)";   // quầng focus của antd
  var SEG = "#hpWhBar .hp-wb1 .hp-whtab,#hkWhBar .hk-whtab,#htWhBar .ht-whtab";   // 3 thanh lọc kiểu Segmented
  var H = "html.ad";
  function seg(suf) { return SEG.split(",").map(function (x) { return H + " " + x + suf; }).join(","); }
  var W = ":where(html.ad)";                    // chỉ dùng cho luật THẺ GỐC (button/input…) để không đè class riêng của từng mục
  var css = [
    /* ---- token: đè 7 theme cũ khi lớp này bật (lớp này chỉ có bản sáng) ---- */
    H + "[data-theme]{--bg:#f5f5f5;--surface:#fff;--surface2:#fafafa;--border:#d9d9d9;--text:rgba(0,0,0,.88);--muted:rgba(0,0,0,.45);" +
      "--accent:#1677ff;--accent-hover:#4096ff;--accent-text:#fff;--hover:#fafafa;--brand:#1677ff;--brand-on:#fff;" +
      "--good:#52c41a;--info:#1677ff;--warn:#faad14;--bad:#ff4d4f;--overlay:rgba(0,0,0,.45);--skeleton:#f0f0f0;--skeleton-hi:#fafafa;" +
      "--shadow:none;--primary-color:#1677ff;--primary-hover:#4096ff;--border-color:#d9d9d9;--border-radius:6px;--input-height:32px;" +
      "--ad-chia:#f0f0f0;--ad-chon:#e6f4ff;color-scheme:light}",
    H + " body{background:#f5f5f5 !important;color:rgba(0,0,0,.88);font-size:14px;line-height:1.5714;" +
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,'Noto Sans',sans-serif}",
    H + " #hskMark{display:none !important}",
    H + " .muted{color:rgba(0,0,0,.45)}",

    /* ---- khung: đầu trang trắng 56px dính đỉnh ---- */
    H + " .wrap{padding:0 24px 24px}",
    H + " .wrap>header{margin:0 -24px 24px;padding:12px 24px 12px 56px;min-height:56px;background:#fff;" +
      "backdrop-filter:none;-webkit-backdrop-filter:none;box-shadow:0 1px 4px rgba(0,21,41,.08)}",
    H + " #brandTitle{display:none}",
    "#adCrumb{display:none}",
    H + " #adCrumb{display:flex;align-items:center;gap:8px;min-width:0;font-size:14px;line-height:22px;white-space:nowrap;overflow:hidden}",
    H + " #adCrumb .g{color:rgba(0,0,0,.45);overflow:hidden;text-overflow:ellipsis}",
    H + " #adCrumb .s{color:rgba(0,0,0,.45)}",
    H + " #adCrumb b{font-weight:600;font-size:16px;color:rgba(0,0,0,.88);overflow:hidden;text-overflow:ellipsis}",

    /* ---- thẻ gốc: nút / ô nhập (specificity thấp — class riêng của từng mục vẫn thắng) ---- */
    W + " button{border:1px solid #d9d9d9;border-radius:6px;padding:4px 15px;font-weight:400;line-height:22px;box-shadow:0 2px 0 rgba(0,0,0,.02)}",
    W + " button:hover{background:#fff;color:#4096ff;border-color:#4096ff}",
    W + " button:active{transform:none}",
    W + " button:focus-visible{outline:none;box-shadow:" + VONG + "}",
    H + " button.primary," + H + " #btnGhiNhan{background:#1677ff;border-color:#1677ff;color:#fff;font-weight:400;box-shadow:0 2px 0 rgba(5,145,255,.1)}",
    H + " button.primary:hover," + H + " #btnGhiNhan:hover{background:#4096ff;border-color:#4096ff;color:#fff}",
    W + " select," + W + " input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]){border:1px solid #d9d9d9;border-radius:6px;padding:4px 11px;line-height:22px}",
    W + " select:hover," + W + " input:not([type=checkbox]):not([type=radio]):hover{border-color:#4096ff}",
    W + " select:focus," + W + " input:focus{border-color:#1677ff;box-shadow:" + VONG + "}",
    H + " .lbl{font-size:12px;color:rgba(0,0,0,.45)}",
    /* ô lọc chung (nút lịch · trigger dropdown · ô tìm) */
    H + " .date-btn," + H + " .cs-trigger," + H + " .filters input{font-size:14px;font-weight:400;padding:4px 11px;line-height:22px;border-radius:6px;border-color:#d9d9d9}",
    H + " .date-btn:focus," + H + " .cs-trigger:focus," + H + " .cs.show .cs-trigger," + H + " .filters input:focus{border-color:#1677ff;box-shadow:" + VONG + "}",
    H + " .cs-list{border:0;border-radius:8px;box-shadow:" + BONG2 + ";padding:4px}",
    H + " .cs-opt{border-radius:4px;padding:5px 12px;font-size:14px;line-height:22px}",
    H + " .cs-opt:hover{background:rgba(0,0,0,.04)}",
    H + " .cs-opt.sel{background:var(--ad-chon);color:rgba(0,0,0,.88);font-weight:600}",
    H + " .filters{border:1px solid var(--ad-chia);border-radius:8px;box-shadow:none;padding:16px}",

    /* ---- thẻ / khung (tầng 0: viền mảnh, không bóng) ---- */
    H + " .panel{border:1px solid var(--ad-chia);border-radius:8px;box-shadow:none}",
    H + " .panel-head{min-height:56px;padding:8px 24px;border-bottom:1px solid var(--ad-chia);font-size:16px;font-weight:600;line-height:24px}",
    H + " .panel-head #dem{font-size:14px;color:rgba(0,0,0,.45)}",
    H + " .card{border:1px solid var(--ad-chia);border-radius:8px;box-shadow:none;padding:16px 24px}",
    H + " .card .num{font-size:24px;font-weight:500;line-height:32px;font-variant-numeric:tabular-nums}",
    H + " .card .cap{font-size:12px;color:rgba(0,0,0,.45);margin-top:4px}",
    H + " .kb-tile{border:1px solid var(--ad-chia);border-left:1px solid var(--ad-chia);border-radius:8px;box-shadow:none;background:#fff}",
    H + " .kb-num{font-size:20px;font-weight:500;color:#ff4d4f;line-height:28px}",
    /* tầng 1: chỉ thẻ BẤM ĐƯỢC mới nổi bóng khi rê — không nhấc, không phóng */
    H + " .card:hover," + H + " .kb-tile:hover{transform:none;box-shadow:none}",
    H + " .card.clickable:hover," + H + " .kb-tile[data-tile]:hover{transform:none;border-color:transparent;box-shadow:" + BONG1 + "}",
    H + " .btn-cards{border-radius:8px}",
    H + " .kb-lbl{font-size:12px;font-weight:400;letter-spacing:0;text-transform:none;color:rgba(0,0,0,.45)}",
    /* Tổng quan: bỏ khối nền đen viền đỏ + bóng dày (nền chuyển màu + bóng thường trực = 2 thứ bị cấm) */
    H + " #pane-tong{background:none;border:0;border-radius:0;padding:0;box-shadow:none}",
    H + " #pane-tong .foot{color:rgba(0,0,0,.45)}" + H + " #pane-tong .foot b{color:rgba(0,0,0,.88)}",
    H + " #pane-tong .btn-cards{color:rgba(0,0,0,.88);border-color:var(--ad-chia);background:#fff}",
    H + " #pane-tong .btn-cards:hover{color:#4096ff;border-color:#4096ff}",
    /* chữ IN HOA giãn cách → chữ thường (copywriting antd: tránh in hoa cả cụm) */
    H + " #kpiPanel .panel-head{font-size:16px;font-weight:600;letter-spacing:0;text-transform:none}",
    H + " #kpiPanel .panel-head>span:first-child{border-left:0;padding-left:0}",
    H + " .kpi-wrap thead th{font-size:14px;font-weight:600;letter-spacing:0;text-transform:none;color:rgba(0,0,0,.88);background:#fafafa}",
    H + " .kpi-wrap tbody td{border-top-color:var(--ad-chia)}",
    H + " .kpi-ten{font-weight:500}" + H + " .kpi-rank{font-weight:500}",
    H + " .kpi-sep td{font-weight:600;letter-spacing:0;font-size:14px;border-top:1px solid var(--ad-chia);background:#fafafa}",

    /* ---- thanh lọc "chọn 1 trong vài" → Segmented của antd (12/10: Planogram Khu · Kiểm kê kho · Tồn bất thường kho) ----
       rãnh xám #ebebeb bo 8 (thanh nằm trên nền trang #f5f5f5 — rãnh cùng màu nền thì mất hút), mục đang chọn = viên trắng bo 6 thụt 2px (vẽ bằng ::before để mục kề nhau liền một rãnh).
       Nhãn đứng ngoài rãnh như nhãn Form; số đếm xám nhạt sau tên. */
    seg("") + "{position:relative;isolation:isolate;border:0;border-radius:0;background:#ebebeb;box-shadow:none;" +
      "color:rgba(0,0,0,.65);font-size:14px;font-weight:400;padding:3px 13px;min-height:32px;gap:6px}",
    SEG.split(",").map(function (x) { return H + " " + x + "+" + x.split(" ").pop(); }).join(",") + "{margin-left:-6px}",
    seg(":first-of-type") + "{border-radius:8px 0 0 8px}",
    seg(":last-of-type") + "{border-radius:0 8px 8px 0}",
    seg(":only-of-type") + "{border-radius:8px}",
    seg(":hover") + "," + seg(".active") + "{background:#ebebeb;color:rgba(0,0,0,.88);border:0}",
    seg(".active::before") + "{content:'';position:absolute;inset:2px;z-index:-1;background:#fff;border-radius:6px;" +
      "box-shadow:0 1px 2px 0 rgba(0,0,0,.03),0 1px 6px -1px rgba(0,0,0,.02),0 2px 4px 0 rgba(0,0,0,.02)}",
    seg(":focus-visible") + "{outline:none;box-shadow:inset " + VONG + "}",
    seg(" b") + "{font-weight:400;color:rgba(0,0,0,.45);font-variant-numeric:tabular-nums}",
    H + " :is(.hp-dot,.hk-dot,.ht-dot){width:6px;height:6px}",
    H + " :is(#hkWhBar .hk-hint,#htWhBar .ht-hint){font-size:14px;font-weight:400 !important;color:rgba(0,0,0,.88);margin-right:8px}",
    /* ô ngày → DatePicker: biểu tượng lịch đứng cuối ô */
    H + " .date-btn{padding-right:36px;background:#fff url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' " +
      "stroke='rgba(0,0,0,.25)' stroke-width='1.8' stroke-linecap='round'%3E%3Crect x='3.5' y='5' width='17' height='15.5' rx='2'/%3E%3Cpath d='M3.5 10h17M8 3v4M16 3v4'/%3E%3C/svg%3E\") no-repeat right 11px center/16px}",

    /* ---- bảng ---- */
    H + " thead th{background:#fafafa;color:rgba(0,0,0,.88);font-weight:600;border-bottom:1px solid var(--ad-chia)}",
    H + " tbody td{border-color:var(--ad-chia)}",
    H + " tbody tr:hover{background:#fafafa}",
    H + " .badge{font-size:12px;line-height:20px;padding:0 7px;border-radius:4px;background:#fafafa;border:1px solid #d9d9d9;color:rgba(0,0,0,.88)}",
    H + " .foot{font-size:12px;color:rgba(0,0,0,.45)}",

    /* ---- tầng 2 / 3: pop-up cài đặt + hộp thoại ---- */
    H + " .settings-pop{border:0;border-radius:8px;box-shadow:" + BONG2 + ";padding:16px;gap:16px}",
    H + " .set-h{font-size:12px;letter-spacing:0;text-transform:none;font-weight:600;color:rgba(0,0,0,.45)}",
    H + " .modal-box{border:0;border-radius:8px;box-shadow:" + BONG2 + "}",
    H + " #btnSettings{border-color:transparent;box-shadow:none;width:32px;height:32px;padding:0}",
    H + " #btnSettings:hover{background:rgba(0,0,0,.06);border-color:transparent}",
    H + " #btnSettings .bars," + H + " #btnSettings .bars::before," + H + " #btnSettings .bars::after{background:rgba(0,0,0,.88);width:16px}",
    H + " #btnSettings.open .bars{background:transparent}",

    /* ---- thanh bên: Menu sáng kiểu antd, rộng 200 ---- */
    H + " #sideNav{width:200px;background:#fff;border-right:1px solid rgba(5,5,5,.06);padding:64px 4px 16px;gap:0;box-shadow:none}",
    H + " body.side-open #sideNav{box-shadow:none}",
    H + " #sideNav .s-grp{font-size:12px;font-weight:400;color:rgba(0,0,0,.45);opacity:1;padding:16px 16px 8px;letter-spacing:0}",
    H + " #sideNav .s-grp::before{display:none}",
    H + " #sideNav .s-sub{margin:0;padding:0;border-left:0;gap:4px}",
    H + " #sideNav .s-sub.s-mot{margin-top:8px}",
    H + " #sideNav .s-item{height:40px;padding:0 16px 0 24px;margin:0 4px;border-radius:8px;border-left:0;font-size:14px;font-weight:400;" +
      "color:rgba(0,0,0,.88);opacity:1;box-shadow:none}",
    H + " #sideNav .s-item:hover{background:rgba(0,0,0,.06)}",
    H + " #sideNav .s-item.on{background:var(--ad-chon);color:#1677ff;font-weight:400;box-shadow:none}",
    H + " #sideNav .s-item .di{display:none}",
    H + " #sideNav .s-item .sn{font-size:12px;font-weight:400;color:rgba(0,0,0,.45)}",
    H + " #sideNav .s-item.on .sn{color:#1677ff}",
    /* logo đầu thanh bên — trượt cùng thanh bên */
    "#adLogo{display:none}",
    H + " #adLogo{display:flex;align-items:center;gap:8px;position:fixed;top:0;left:0;z-index:61;width:200px;height:56px;padding:0 24px;" +
      "background:#fff;border-right:1px solid rgba(5,5,5,.06);font-size:16px;font-weight:600;color:rgba(0,0,0,.88);white-space:nowrap;" +
      "transform:translate3d(-100%,0,0);visibility:hidden;transition:transform .32s var(--ez-apple,ease),visibility 0s linear .32s}",
    H + " #adLogo img{width:24px;height:24px;border-radius:50%;flex:none}",
    H + " body.side-open #adLogo{transform:none;visibility:visible;transition-delay:0s}",   // ẩn hẳn khi đóng — nằm ngoài mép là bộ đo tính tràn
    /* nút đóng/mở thanh bên: nút chữ-biểu-tượng trong đầu trang, không nền màu */
    H + " #sideToggle{top:12px;left:12px;width:32px;height:32px;border-radius:6px;background:transparent;color:rgba(0,0,0,.88);box-shadow:none}",
    H + " #sideToggle:hover{background:rgba(0,0,0,.06);box-shadow:none}",
    H + " #sideToggle:focus-visible{box-shadow:" + VONG + "}",
    "@media(min-width:769px){" +
      H + " body.side-open .wrap{padding-left:224px}" +
      H + " body.side-open #sideToggle{translate:200px 0}" +
    "}",

    /* ---- máy tính: kích thước control 32px + bảng cỡ vừa (antd size="middle") ---- */
    "@media(min-width:769px){" +
      W + " button{min-height:32px}" +
      H + " thead th{padding:12px 8px}" +
      H + " tbody td{padding-top:12px;padding-bottom:12px}" +
    "}",
    /* ---- điện thoại: luật dự án thắng — vùng chạm ≥40px, lề 16 ---- */
    "@media(max-width:768px){" +
      H + " .wrap{padding:0 16px 16px}" +
      H + " .wrap>header{margin:0 -16px 16px;padding:8px 16px 8px 56px;min-height:56px;flex-wrap:nowrap}" +
      /* đầu trang điện thoại 1 hàng: chỉ còn tên mục (nhóm đã thấy trong thanh bên) — chặn luật 13 rác đầu màn */
      H + " #adCrumb .g," + H + " #adCrumb .s{display:none}" +
      H + " #adCrumb{white-space:normal}" + H + " #adCrumb b{font-size:14px;line-height:20px}" +   // máy hẹp 360px: tên dài xuống 2 dòng, không cắt chữ
      H + " #adLogo{width:min(80vw,300px)}" +
      H + " #sideNav{width:80vw;max-width:300px}" +
      H + " #sideToggle{width:40px;height:40px;top:8px;left:8px}" +
      H + " #btnSettings{width:40px;height:40px}" +
      H + " #btnGhiNhan{min-height:40px}" +
      H + " .panel-head{min-height:48px;padding:8px 16px}" +
      H + " .card{padding:12px 16px}" +
      H + " .kpi-sep td{font-size:12px}" +
      seg("") + "{min-height:40px}" +
    "}"
  ].join("\n");

  /* đường dẫn đầu trang: "Nhóm / Mục đang mở" đọc từ thanh bên — thêm tab mới vẫn chỉ khai ở HM như cũ */
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function capNhatCrumb() {
    var c = document.getElementById("adCrumb"); if (!c) return;
    var on = document.querySelector("#sideNav .s-item.on");
    if (!on) { c.innerHTML = "<b>Audit Hasaki</b>"; return; }
    var ten = on.cloneNode(true); ten.querySelectorAll(".sn,.di").forEach(function (x) { x.remove(); });
    var sub = on.closest(".s-sub"), grp = sub && sub.previousElementSibling;
    var g = grp && grp.classList.contains("s-grp") ? grp.textContent.trim() : "";
    c.innerHTML = (g ? '<span class="g">' + esc(g) + '</span><span class="s">/</span>' : "") + "<b>" + esc(ten.textContent.trim()) + "</b>";
  }

  function dung() {
    var bt = document.getElementById("brandTitle");
    if (bt && !document.getElementById("adCrumb")) { var c = document.createElement("div"); c.id = "adCrumb"; bt.after(c); }
    if (!document.getElementById("adLogo")) {
      var lg = document.createElement("div"); lg.id = "adLogo";
      lg.innerHTML = '<img src="hasaki-logo.png" alt="" />Audit Hasaki';
      document.body.insertBefore(lg, document.body.firstChild);
    }
    capNhatCrumb();
    var nav = document.getElementById("sideNav");
    if (nav) try { new MutationObserver(capNhatCrumb).observe(nav, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] }); } catch (e) {}
    /* máy tính rộng (≥992, mốc lg của antd): ghim thanh bên ngay khi vào, như bố cục trái–phải của antd */
    if (window.matchMedia("(min-width:992px)").matches && !document.body.classList.contains("side-open")) {
      var tg = document.getElementById("sideToggle"); if (tg) tg.click();
    }
  }

  /* nút bật/tắt trong menu Cài đặt (ở giao diện cũ vẫn có để bật lại) */
  function nutCaiDat() {
    var pop = document.getElementById("settingsPop"); if (!pop || document.getElementById("adSet")) return;
    var sec = document.createElement("div"); sec.className = "set-sec"; sec.id = "adSet";
    sec.innerHTML = '<div class="set-h">Giao diện Ant Design</div>' +
      '<button type="button" class="dropdown-action-btn" id="adSetBtn"><span class="act">' + (bat() ? "Đang bật — bấm để về giao diện cũ" : "Đang tắt — bấm để bật") + "</span></button>";
    pop.insertBefore(sec, pop.firstChild);
    document.getElementById("adSetBtn").addEventListener("click", function () { dat(!bat()); location.reload(); });
  }

  /* 12/10 LIVE: tệp nạp ĐỒNG BỘ trong <head> ⇒ gắn CSS + lớp html.ad NGAY (khung hình đầu đã là Ant Design, không chớp giao diện cũ);
     phần cần DOM (đường dẫn, logo, nút Cài đặt) chờ DOMContentLoaded. */
  if (/[?&]giaodien=antd/.test(location.search)) dat(true);   // link có ?giaodien=antd = luôn BẬT lại
  if (bat()) {
    var st = document.createElement("style"); st.id = "adCss"; st.textContent = css; (document.head || document.documentElement).appendChild(st);
    document.documentElement.classList.add("ad");
  }
  function chay() { nutCaiDat(); if (bat()) dung(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", chay); else chay();
})();
