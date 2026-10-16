/* hasaki-giaodien-antd.js — GIAO DIỆN theo bộ quy chuẩn Ant Design cho dashboard Audit Hasaki (12/10/2026).
 * Nguồn số: github.com/ant-design/ant-design/tree/master/docs/spec (layout · font · colors · shadow · buttons · copywriting)
 * + token mặc định của thư viện antd v5 (bo góc 6, control cao 32, thanh bên 200, đầu trang 56).
 *
 * 12/10 chiều (user: "cần áp dụng được theme ở antdesign và loại bỏ luôn giao diện cũ"):
 *   · Đây là giao diện DUY NHẤT — bỏ nút "về giao diện cũ" (khoá localStorage ad-giaodien không còn nghĩa).
 *   · Lớp này chỉ giữ KHUÔN Ant Design (kích thước, bo góc, bóng, khoảng cách, thanh bên, đầu trang, Segmented…);
 *     MÀU đi hết qua biến theme (--bg/--surface/--surface2/--border/--text/--muted/--accent…) ⇒ đổi theme trong Cài đặt là
 *     cả giao diện đổi theo, kể cả theme tối. Theme "Ant Design" (#1677ff, khai ở index.html) là mặc định.
 *   · Màu phái sinh tính bằng color-mix từ biến theme: vạch chia, nền mục đang chọn, rãnh Segmented, nền rê chuột.
 *
 * Bộ khuôn đã chốt (đừng thêm số ngoài bộ này):
 *   · lưới 8: khoảng cách 8 / 16 / 24 · chữ 12 / 14 / 16 / 20 / 24, chữ gốc 14 dòng 22 · độ đậm 400 / 500 / 600
 *   · bo góc: control 6 · thẻ / pop-up 8 · nhãn 4
 *   · bóng 4 tầng: 0 = không (ô nhập, thẻ đứng yên) · 1 = khi rê thẻ bấm được · 2 = danh sách thả · 3 = hộp thoại
 *   · CẤM: nền chuyển màu, kính mờ, bóng thường trực, nhấc thẻ khi rê
 * Luật dự án vẫn thắng luật Ant Design: điện thoại vùng chạm ≥40px (antd 32px chỉ áp máy tính), không emoji. */
(function () {
  if (window.__AD_GD) return; window.__AD_GD = 1;
  try { localStorage.removeItem("ad-giaodien"); } catch (e) {}   // khoá bật/tắt cũ — giao diện cũ đã bỏ

  /* Dùng CHUNG cho Audit Hasaki (kiemsoatkho) và Audit Factory (stocklocationfactory, bản chép giaodien-antd.js — SỬA Ở ĐÂY RỒI CHÉP SANG).
     Trang đặt window.AD_TEN / window.AD_LOGO trước khi nạp để đổi tên + logo đầu thanh bên. */
  var TEN = window.AD_TEN || "Audit Retail", LOGO = window.AD_LOGO || "hasaki-logo.png";   // 13/10 user: «Audit Hasaki chuyển thành Audit Retail»
  /* 13/10 user: cuối thanh bên có nút sang dashboard kia (Retail ⇄ Factory). Trang khai window.AD_CHUYEN={ten, app:"retail"|"factory"} */
  var CHUYEN = window.AD_CHUYEN || null;
  var BONG1 = "0 1px 2px -2px rgba(0,0,0,.16),0 3px 6px 0 rgba(0,0,0,.12),0 5px 12px 4px rgba(0,0,0,.09)";
  var BONG2 = "0 6px 16px 0 rgba(0,0,0,.08),0 3px 6px -4px rgba(0,0,0,.12),0 9px 28px 8px rgba(0,0,0,.05)";
  var VONG = "0 0 0 2px color-mix(in srgb,var(--accent) 18%,transparent)";   // quầng focus của antd, theo màu theme
  var SEG = "#hpWhBar .hp-wb1 .hp-whtab";   // thanh lọc "chọn 1 trong vài" kiểu Segmented (Kiểm kê/Bất thường nay dùng ô chọn)
  var H = "html.ad", B = "html.ad body";
  /* 16/10 nhịp chuyển dùng chung: khung tab chạy lại paneIn (đổi mục con trong tab — vd Xác minh Theo tác vụ ⇄ Theo máy) */
  window.nhipTab = function (el) { if (!el) return; el.style.animation = "none"; void el.offsetWidth; el.style.animation = ""; };
  function seg(suf) { return SEG.split(",").map(function (x) { return H + " " + x + suf; }).join(","); }
  var W = ":where(html.ad)";                    // chỉ dùng cho luật THẺ GỐC (button/input…) để không đè class riêng của từng mục
  var css = [
    /* ---- màu phái sinh từ theme ---- */
    H + "{--ad-chia:color-mix(in srgb,var(--border) 55%,var(--surface));--ad-chon:color-mix(in srgb,var(--accent) 12%,var(--surface));" +
      "--ad-ray:color-mix(in srgb,var(--text) 7%,var(--bg));--ad-re:color-mix(in srgb,var(--text) 6%,transparent);" +
      "--ad-nen2:color-mix(in srgb,var(--text) 3%,var(--surface));--border-radius:6px;--input-height:32px}",
    H + " body{background:var(--bg) !important;color:var(--text);font-size:14px;line-height:1.5714;" +
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,'Noto Sans',sans-serif}",
    H + " #hskMark{display:none !important}",
    H + " .muted{color:var(--muted)}",
    /* bỏ hẳn giao diện cũ: kiểu tiêu đề thương hiệu (8 kiểu) không còn chỗ hiện ⇒ ẩn ô chọn trong Cài đặt */
    H + " .set-field:has(#titleSel)," + H + " .set-field:has(#hstyleCombo){display:none}",

    /* ---- khung: đầu trang 56px dính đỉnh ---- */
    H + " .wrap{padding:0 24px 24px}",
    H + " .wrap>header{margin:0 -24px 24px;padding:12px 24px 12px 56px;min-height:56px;align-items:center;background:var(--surface);" +
      "backdrop-filter:none;-webkit-backdrop-filter:none;box-shadow:0 1px 4px rgba(0,21,41,.08)}",
    H + " #brandTitle{display:none}",
    "#adCrumb{display:none}",
    H + " #adCrumb{display:flex;align-items:center;gap:8px;min-width:0;font-size:14px;line-height:22px;white-space:nowrap;overflow:hidden}",
    H + " #adCrumb .g{color:var(--muted);overflow:hidden;text-overflow:ellipsis}",
    H + " #adCrumb .s{color:var(--muted)}",
    H + " #adCrumb b{font-weight:600;font-size:16px;color:var(--text);overflow:hidden;text-overflow:ellipsis}",

    /* ---- thẻ gốc: nút / ô nhập (specificity thấp — class riêng của từng mục vẫn thắng) ---- */
    W + " button{border:1px solid var(--border);border-radius:6px;padding:4px 15px;font-weight:400;line-height:22px;box-shadow:0 2px 0 rgba(0,0,0,.02)}",
    W + " button:hover{background:var(--surface);color:var(--accent-hover,var(--accent));border-color:var(--accent-hover,var(--accent))}",
    W + " button:active{transform:none}",
    W + " button:focus-visible{outline:none;box-shadow:" + VONG + "}",
    H + " button.primary," + H + " #btnGhiNhan{background:var(--accent);border-color:var(--accent);color:var(--accent-text);font-weight:400;box-shadow:0 2px 0 color-mix(in srgb,var(--accent) 10%,transparent)}",
    H + " button.primary:hover," + H + " #btnGhiNhan:hover{background:var(--accent-hover,var(--accent));border-color:var(--accent-hover,var(--accent));color:var(--accent-text)}",
    W + " select," + W + " input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]){border:1px solid var(--border);border-radius:6px;padding:4px 11px;line-height:22px}",
    W + " select:hover," + W + " input:not([type=checkbox]):not([type=radio]):hover{border-color:var(--accent-hover,var(--accent))}",
    W + " select:focus," + W + " input:focus{border-color:var(--accent);box-shadow:" + VONG + "}",
    H + " .lbl{font-size:12px;color:var(--muted)}",
    /* ô lọc chung (nút lịch · trigger dropdown · ô tìm) */
    H + " .date-btn," + H + " .cs-trigger," + H + " .filters input{font-size:14px;font-weight:400;padding:4px 11px;line-height:22px;border-radius:6px;border-color:var(--border)}",
    H + " .date-btn:focus," + H + " .cs-trigger:focus," + H + " .cs.show .cs-trigger," + H + " .filters input:focus{border-color:var(--accent);box-shadow:" + VONG + "}",
    H + " .cs-list{border:0;border-radius:8px;box-shadow:" + BONG2 + ";padding:4px}",
    H + " .cs-opt{border-radius:4px;padding:5px 12px;font-size:14px;line-height:22px}",
    H + " .cs-opt:hover{background:var(--ad-re)}",
    H + " .cs-opt.sel{background:var(--ad-chon);color:var(--text);font-weight:600}",
    H + " .filters{border:1px solid var(--ad-chia);border-radius:8px;box-shadow:none;padding:16px}",

    /* ---- thẻ / khung (tầng 0: viền mảnh, không bóng) ---- */
    H + " .panel{border:1px solid var(--ad-chia);border-radius:8px;box-shadow:none}",
    H + " .panel-head{min-height:56px;padding:8px 24px;border-bottom:1px solid var(--ad-chia);font-size:16px;font-weight:600;line-height:24px}",
    H + " .panel-head #dem{font-size:14px;color:var(--muted)}",
    /* 12/10 user: "đồng bộ kích thước giữa các nhãn hạng mục (Nhân viên ngày 11/10 · Sơ đồ · Cần xử lý…) cho toàn bộ dự án" —
       MỌI tiêu đề thẻ (host .panel-head, module .hp/.hk/.ht-panel > h2, Factory .panel > h2) = Card title antd 16px/600/24px;
       tiêu đề trang (Xác minh .hx-muc h2) = 20px/600. !important vì luật module viết theo #pane-… (id thắng lớp). */
    H + " :is(.panel,.hp-panel,.hk-panel,.ht-panel) > h2," + H + " .panel-head{font-size:16px !important;font-weight:600 !important;line-height:24px !important;letter-spacing:0 !important}",
    H + " .hx-muc h2{font-size:20px !important;font-weight:600 !important;line-height:28px}",
    H + " .card{border:1px solid var(--ad-chia);border-radius:8px;box-shadow:none;padding:16px 24px}",
    H + " .card .num{font-size:24px;font-weight:500;line-height:32px;font-variant-numeric:tabular-nums}",
    H + " .card .cap{font-size:12px;color:var(--muted);margin-top:4px}",
    H + " .kb-tile{border:1px solid var(--ad-chia);border-left:1px solid var(--ad-chia);border-radius:8px;box-shadow:none;background:var(--surface)}",
    H + " .kb-num{font-size:20px;font-weight:500;color:var(--bad);line-height:28px}",
    /* tầng 1: chỉ thẻ BẤM ĐƯỢC mới nổi bóng khi rê — không nhấc, không phóng */
    H + " .card:hover," + H + " .kb-tile:hover{transform:none;box-shadow:none}",
    H + " .card.clickable:hover," + H + " .kb-tile[data-tile]:hover{transform:none;border-color:transparent;box-shadow:" + BONG1 + "}",
    H + " .btn-cards{border-radius:8px}",
    H + " .kb-lbl{font-size:12px;font-weight:400;letter-spacing:0;text-transform:none;color:var(--muted)}",
    /* Tổng kết: bỏ khối nền đen viền đỏ + bóng dày (nền chuyển màu + bóng thường trực = 2 thứ bị cấm) */
    H + " #pane-tong{background:none;border:0;border-radius:0;padding:0;box-shadow:none}",
    H + " #pane-tong .foot{color:var(--muted)}" + H + " #pane-tong .foot b{color:var(--text)}",
    H + " #pane-tong .btn-cards{color:var(--text);border-color:var(--ad-chia);background:var(--surface)}",
    H + " #pane-tong .btn-cards:hover{color:var(--accent-hover,var(--accent));border-color:var(--accent-hover,var(--accent))}",
    /* chữ IN HOA giãn cách → chữ thường (copywriting antd: tránh in hoa cả cụm) */
    H + " #kpiPanel .panel-head{font-size:16px;font-weight:600;letter-spacing:0;text-transform:none}",
    H + " #kpiPanel .panel-head>span:first-child{border-left:0;padding-left:0}",
    H + " .kpi-wrap thead th{font-size:14px;font-weight:600;letter-spacing:0;text-transform:none;color:var(--text);background:var(--ad-nen2)}",
    H + " .kpi-wrap tbody td{border-top-color:var(--ad-chia)}",
    H + " .kpi-ten{font-weight:500}" + H + " .kpi-rank{font-weight:500}",
    H + " .kpi-sep td{font-weight:600;letter-spacing:0;font-size:14px;border-top:1px solid var(--ad-chia);background:var(--ad-nen2)}",

    /* ---- thanh lọc "chọn 1 trong vài" → Segmented của antd: rãnh bo 8, mục đang chọn = viên nền thẻ bo 6 thụt 2px
       (vẽ bằng ::before để mục kề nhau liền một rãnh). Rãnh đậm hơn nền trang 1 nấc — cùng màu nền thì mất hút. */
    seg("") + "{position:relative;isolation:isolate;border:0;border-radius:0;background:var(--ad-ray);box-shadow:none;" +
      "color:var(--muted);font-size:14px;font-weight:400;padding:3px 13px;min-height:32px;gap:6px}",
    SEG.split(",").map(function (x) { return H + " " + x + "+" + x.split(" ").pop(); }).join(",") + "{margin-left:-6px}",
    seg(":first-of-type") + "{border-radius:8px 0 0 8px}",
    seg(":last-of-type") + "{border-radius:0 8px 8px 0}",
    seg(":only-of-type") + "{border-radius:8px}",
    seg(":hover") + "," + seg(".active") + "{background:var(--ad-ray);color:var(--text);border:0}",
    seg(".active::before") + "{content:'';position:absolute;inset:2px;z-index:-1;background:var(--surface);border-radius:6px;" +
      "box-shadow:0 1px 2px 0 rgba(0,0,0,.03),0 1px 6px -1px rgba(0,0,0,.02),0 2px 4px 0 rgba(0,0,0,.02)}",
    seg(":focus-visible") + "{outline:none;box-shadow:inset " + VONG + "}",
    seg(" b") + "{font-weight:400;color:var(--muted);font-variant-numeric:tabular-nums}",
    H + " :is(.hp-dot,.hk-dot,.ht-dot){width:6px;height:6px}",
    /* ô ngày → DatePicker: biểu tượng lịch đứng cuối ô (xám giữa — đọc được cả theme sáng lẫn tối) */
    H + " .date-btn{padding-right:36px;background:var(--surface) url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' " +
      "stroke='%23999' stroke-width='1.8' stroke-linecap='round'%3E%3Crect x='3.5' y='5' width='17' height='15.5' rx='2'/%3E%3Cpath d='M3.5 10h17M8 3v4M16 3v4'/%3E%3C/svg%3E\") no-repeat right 11px center/16px}",

    /* ---- Ô TRANG TỔNG QUAN — CHUNG 2 dự án (Hasaki .ov-* · Factory .hm-*), 12/10 user: "đồng bộ kích thước các ô, sửa cho cả Audit Factory".
       MỌI ô cao cố định 218px (khác hàng cũng bằng nhau), mô tả kẹp 3 dòng, chip tối đa 2 hàng ở đáy ⇒ mọi ô cùng một khuôn. ---- */
    H + " :is(.ov-grid,.hm-grid){display:grid;grid-template-columns:repeat(auto-fill,minmax(272px,1fr));gap:12px;align-items:start}",   // 13/10 user: gọn chiều dọc, mỗi ô vừa nội dung
    H + " :is(.ov-card,.hm-card){display:flex;flex-direction:column;gap:8px;width:100%;height:auto;min-height:0;padding:14px 16px;text-align:left;overflow:hidden;" +
      "border:1px solid var(--ad-chia);border-radius:8px;background:var(--surface);color:var(--text);box-shadow:none;transform:none}",   // 13/10 AD-01: bỏ viền nhấn trái
    H + " :is(.ov-card,.hm-card):hover{transform:none;background:var(--surface);box-shadow:" + BONG1 + "}",
    H + " :is(.ov-t,.hm-t){display:flex;align-items:baseline;gap:9px;min-height:0;font-size:20px;line-height:28px;font-weight:600;letter-spacing:0;color:var(--text)}",   // 13/10 user: tên ô phải to hơn hẳn mô tả (14) + chip (12) — cỡ tiêu đề cấp 4 antd
    H + " :is(.ov-t,.hm-t) .k{margin-left:auto;font-size:20px;font-weight:600;line-height:28px;color:var(--cc);font-variant-numeric:tabular-nums}",
    H + " :is(.ov-t,.hm-t) .k small{display:block;font-size:12px;font-weight:400;line-height:20px;color:var(--muted);letter-spacing:0}",
    H + " :is(.ov-t,.hm-t) .k.trong{color:var(--muted);font-weight:400}",
    H + " :is(.ov-t,.hm-t) .k.nhan{font-size:12px;font-weight:600;letter-spacing:0;text-transform:none;color:var(--muted)}",
    H + " :is(.ov-d,.hm-d){font-size:14px;line-height:22px;color:var(--muted);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;min-height:0}",
    H + " :is(.ov-c,.hm-c){display:flex;flex-wrap:wrap;gap:6px;margin-top:0;max-height:50px;overflow:hidden}",   // chip (22px) tối đa 2 hàng ⇒ MỌI ô cao đúng 218px (tiêu đề 48 + mô tả 3 dòng 66 + chip 50)
    H + " .hm-c .pg-chip," + H + " .ov-c span{font-size:12px;line-height:20px;padding:0 8px;border-radius:4px;background:var(--surface2);color:var(--muted);border:1px solid var(--border);font-weight:400}",
    H + " .hm-c .pg-chip b{color:var(--cc);font-weight:600}",
    H + " :is(.ov-h,.hm-h){font-size:14px;font-weight:600;color:var(--text)}",
    H + " :is(.ov-h,.hm-h)::before{width:10px;height:10px;border-radius:3px}",

    /* ---- bảng ---- */
    H + " thead th{background:var(--ad-nen2);color:var(--text);font-weight:600;border-bottom:1px solid var(--ad-chia)}",
    H + " tbody td{border-color:var(--ad-chia)}",
    H + " tbody tr:hover{background:var(--ad-nen2)}",
    H + " .badge{font-size:12px;line-height:20px;padding:0 7px;border-radius:4px;background:var(--ad-nen2);border:1px solid var(--border);color:var(--text)}",
    H + " .foot{font-size:12px;color:var(--muted)}",

    /* ---- tầng 2 / 3: pop-up cài đặt + hộp thoại ---- */
    H + " .settings-pop{border:0;border-radius:8px;box-shadow:" + BONG2 + ";padding:16px;gap:16px}",
    H + " .set-h{font-size:12px;letter-spacing:0;text-transform:none;font-weight:600;color:var(--muted)}",
    H + " .modal-box{border:0;border-radius:8px;box-shadow:" + BONG2 + "}",
    /* 12/10 user: pop-up bị thanh bên đè — mọi pop-up (host z 50, module z 1200) phải NẰM TRÊN thanh bên (60/61) */
    H + " :is(#modal,#statModal,#hmModal,#ghiModal,#pinModal){z-index:90}" + H + " #lightbox{z-index:95}",   // ảnh phóng mở TỪ pop-up thì phải nằm trên pop-up
    H + " #btnSettings{border-color:transparent;box-shadow:none;width:32px;height:32px;padding:0}",
    H + " #btnSettings:hover{background:var(--ad-re);border-color:transparent}",
    H + " #btnSettings .bars," + H + " #btnSettings .bars::before," + H + " #btnSettings .bars::after{background:var(--text);width:16px}",
    H + " #btnSettings.open .bars{background:transparent}",

    /* ---- thanh bên: Menu kiểu antd, rộng 200 ---- */
    H + " #sideNav{width:216px;background:var(--surface);border-right:1px solid var(--ad-chia);padding:64px 4px 16px;gap:0;box-shadow:none}",
    H + " body.side-open #sideNav{box-shadow:none}",
    H + " #sideNav .s-grp{font-size:12px;font-weight:400;color:var(--muted);opacity:1;padding:16px 16px 8px;letter-spacing:0}",
    H + " #sideNav .s-grp::before{display:none}",
    H + " #sideNav .s-sub{margin:0;padding:0;border-left:0;gap:4px}",
    H + " #sideNav .s-sub.s-mot{margin-top:8px}",
    H + " #sideNav .s-sub.s-dau{margin-top:0}",
    H + " #sideNav .s-sub.s-mot{padding-left:0;border-left:0}",
    H + " #sideNav .s-item{height:40px;padding:0 16px 0 24px;margin:0 4px;border-radius:8px;border-left:0;font-size:14px;font-weight:400;" +
      "color:var(--text);opacity:1;box-shadow:none}",
    H + " #sideNav .s-item:hover{background:var(--ad-re)}",
    H + " #sideNav .s-item.on{background:var(--ad-chon);color:var(--accent);font-weight:400;box-shadow:none}",
    /* 13/10 user «tìm icon bổ sung cho thanh bên» — bộ Material Design Icons (@mdi/js, giấy phép Apache-2.0) = CÙNG BỘ thanh bên WMS (wms.inshasaki.com dùng @mdi/react) */
    H + " #sideNav .s-item .di{display:inline-flex;flex:none;width:18px;height:18px;align-items:center;justify-content:center;opacity:1;background:none;border:0;box-shadow:none;margin:0}",
    H + " #sideNav .s-item .di svg{width:18px;height:18px;fill:currentColor}" + H + " #sideNav .s-item .di:empty{display:none}",
    H + " #adChuyen a > span:nth-child(2){flex:1}" + H + " #adChuyen a .ic{display:inline-flex;width:18px;height:18px}" + H + " #adChuyen a .ic svg{width:18px;height:18px;fill:currentColor}",
    H + " #sideNav .s-item .sn{margin-left:auto;font-size:12px;font-weight:400;color:var(--muted);font-variant-numeric:tabular-nums}",
    H + " #sideNav .s-item{display:flex;align-items:center;gap:6px;white-space:nowrap;padding:0 8px 0 12px}",   // 13/10 user «số bị tràn»: «Tồn kho bất thường 3,613» cần 201px > 199px ô — nén lề/khe
    H + " #sideNav .s-item .sn{flex:none;padding-left:2px}",   // tên dài 1 dòng, số canh phải (Factory "Trạng thái lưu trữ 47,790")
    H + " #sideNav .s-item.on .sn{color:var(--accent)}",
    /* logo đầu thanh bên — trượt cùng thanh bên */
    "#adLogo{display:none}",
    H + " #adLogo{display:flex;align-items:center;gap:8px;position:fixed;top:0;left:0;z-index:61;width:216px;height:56px;padding:0 24px;" +
      "background:var(--surface);border-right:1px solid var(--ad-chia);font-size:16px;font-weight:600;color:var(--text);white-space:nowrap;" +
      "transform:translate3d(-100%,0,0);visibility:hidden;transition:transform .32s var(--ez-apple,ease),visibility 0s linear .32s}",
    H + " #adLogo img{width:24px;height:24px;border-radius:50%;flex:none}",
    H + " body.side-open #adLogo{transform:none;visibility:visible;transition-delay:0s}",
    "#adChuyen{display:none}",
    H + " #adChuyen{display:flex;align-items:center;position:fixed;left:0;bottom:0;z-index:61;width:216px;padding:8px;box-sizing:border-box;" +
      "background:var(--surface);border-right:1px solid var(--ad-chia);border-top:1px solid var(--ad-chia);" +
      "transform:translate3d(-100%,0,0);visibility:hidden;transition:transform .32s var(--ez-apple,ease),visibility 0s linear .32s}",
    H + " body.side-open #adChuyen{transform:none;visibility:visible;transition-delay:0s}",
    H + " #adChuyen a{flex:1;display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:40px;padding:0 12px;border:1px solid var(--border);border-radius:6px;" +
      "color:var(--text);text-decoration:none;font-size:14px;white-space:nowrap}",
    H + " #adChuyen a:hover{border-color:var(--accent);color:var(--accent)}",
    H + " #adChuyen a:focus-visible{outline:none;box-shadow:" + VONG + "}",
    H + " #adChuyen .mt{color:var(--muted)}",
    H + " #sideNav{padding-bottom:72px!important}",   // mục cuối thanh bên không bị nút chuyển che   // ẩn hẳn khi đóng — nằm ngoài mép là bộ đo tính tràn
    /* nút đóng/mở thanh bên: nút chữ-biểu-tượng trong đầu trang, không nền màu */
    H + " #sideToggle{top:12px;left:12px;width:32px;height:32px;border-radius:6px;background:transparent;color:var(--text);box-shadow:none}",
    H + " #sideToggle:hover{background:var(--ad-re);box-shadow:none}",
    H + " #sideToggle:focus-visible{box-shadow:" + VONG + "}",
    "@media(min-width:769px){" +
      H + " body.side-open .wrap{padding-left:240px}" +
      H + " body.side-open #sideToggle{translate:216px 0}" +
    "}",
    /* 14/10 user: «nút thu gọn/mở rộng thanh bên dính liền với thanh bên — lòi ra 2/3 kích thước nút, 1/3 còn lại dính vào thanh bên» (máy tính).
       Nút 32px: left 0 + translate = mép thanh bên − 11px (mở 216 → 205 · thu gọn 72 → 61); có nền + viền để thấy rõ gắn vào mép. */
    "@media(min-width:769px){" +
      H + " #sideToggle{left:0;top:16px;border-radius:999px;background:var(--surface);border:1px solid var(--ad-chia,var(--border));box-shadow:0 2px 6px rgba(0,0,0,.08)}" +
      H + " #sideToggle:hover{background:var(--surface);border-color:var(--accent);color:var(--accent);box-shadow:0 2px 8px rgba(0,0,0,.12)}" +
      H + " body.side-open #sideToggle{translate:205px 0!important}" + H + " body:not(.side-open) #sideToggle{translate:61px 0!important}" +
    "}",
    /* ---- 12/10 user: "thanh bên khi thu gọn thì chuyển tên các sub-tab thành nhãn" — máy tính: thu gọn = DẢI 72px (Sider collapsed của antd),
       mỗi mục là nhãn chữ nhỏ 2 dòng canh giữa, nhóm thành vạch ngăn, logo chỉ còn hình. Điện thoại giữ ngăn kéo (không đủ chỗ cho dải). ---- */
    "@media(min-width:769px){" +
      H + " body:not(.side-open) #sideNav{transform:none;width:72px;padding:64px 4px 16px;overflow-x:hidden}" +
      H + " body:not(.side-open) #sideNav .s-grp{font-size:0;height:1px;padding:0;margin:8px 12px;background:var(--ad-chia)}" +
      H + " body:not(.side-open) #sideNav .s-sub{gap:2px}" +
      H + " body:not(.side-open) #sideNav .s-item{flex-direction:column;justify-content:center;gap:0;height:auto;min-height:48px;padding:6px 2px;margin:0 2px;" +
        "font-size:11px;line-height:14px;text-align:center;white-space:normal;overflow-wrap:anywhere}" +
      H + " body:not(.side-open) #sideNav .s-item .sn{display:none}" +
      H + " body:not(.side-open) #sideNav .s-item .di{width:20px;height:20px;margin:0 0 4px}" + H + " body:not(.side-open) #sideNav .s-item .di svg{width:20px;height:20px}" +
      H + " body:not(.side-open) #adLogo{transform:none;visibility:visible;width:72px;padding:0;justify-content:center;font-size:0;gap:0}" +
      H + " body:not(.side-open) #adChuyen{transform:none;visibility:visible;width:72px;padding:8px 4px}" +
      H + " body:not(.side-open) #adChuyen a{flex-direction:column;justify-content:center;gap:0;padding:4px 2px;font-size:11px;line-height:14px;text-align:center;white-space:normal}" +
      H + " body:not(.side-open) #adChuyen .mt{display:none}" +
      H + " body:not(.side-open) .wrap{padding-left:96px}" +
      H + " body:not(.side-open) #sideToggle{translate:72px 0}" +
    "}",


    /* ==== 13/10/2026 ĐỒNG BỘ TOÀN DỰ ÁN THEO KHUÔN XÁC MINH (bộ luật hasaki/LUAT-DONG-BO-ANTD.md, đo bằng qc-dong-bo-antd.mjs) ====
       user: «Hạng mục 5S / Tồn kho / Xác minh cần đồng bộ thiết kế/màu sắc theo tab Xác minh — ant design».
       Tiền tố "html.ad body" (+ !important ở thuộc tính tranh chấp) vì CSS module nạp SAU lớp này và viết theo #pane-… */
    /* AD-01 không viền nhấn một cạnh — thẻ số Kiểm kê / Bất thường */
    B + " :is(#pane-kk .ks,#pane-htonbat .ht-tile){border:1px solid var(--ad-chia)!important;box-shadow:none!important}",
    /* AD-03 bo góc: thẻ/khung 8 · nút/ô nhập 6 · nhãn (Tag) 4 */
    B + " :is(.hp-panel,.hk-panel,.ht-panel,.hk-whcard,.hm-legend,.hm-lg-card,.tkq-card,.hp-tile,#pane-kk .ks,#pane-htonbat .ht-tile){border-radius:8px!important}",
    B + " :is(.hp-h2btn,.hp-whtab,.hx-nut,.cn,.hp-ccsearch,.kktab,.pg-whtab,.pg-search){border-radius:6px!important}",   // 15/10 Factory: nút/chip viên thuốc 999px → nút antd 6px
    /* 15/10 user «Kế hoạch chờ push (WMS) bo góc có đúng antd?» — nút đầu trang = Button mặc định antd: cao 32 · đệm 4×15 · chữ 14 thường · bo 6 */
    B + " #hdrKkPlan{height:32px;padding:4px 15px;font-size:14px;font-weight:400;line-height:22px;color:var(--text);border:1px solid var(--border);background:var(--surface);box-shadow:none}",
    B + " #hdrKkPlan:hover{color:var(--accent);border-color:var(--accent)}",
    B + " :is(.hx-tag,.kpi-pill,.hk-stchip,.hp-legchip,.hp-legcnt,#pane-planogram .hp-tdrow .n){border-radius:4px!important}",
    /* nút "i" chú thích: hình tròn thật (rộng = cao) */
    B + " .h2tip{width:16px!important;height:16px!important;min-height:16px!important;padding:0!important;line-height:14px!important;display:inline-grid;place-items:center}",
    /* Tag kiểu antd: chữ 12/20, đậm thường, viền mảnh — dùng chung cho nhãn trạng thái mọi tab */
    B + " :is(.hx-tag,.kpi-pill,.hk-stchip){font-size:12px!important;line-height:20px;font-weight:400!important;padding:0 7px!important;letter-spacing:0!important}",
    /* AD-02 không IN HOA */
    B + " :is(.hp-maphdr,.cn-lb,.tkq-cap,.hm-lg-h,.hk-stchip,.kpi-sep td){text-transform:none!important;letter-spacing:0!important}",
    /* AD-06 đậm tối đa 600 (antd 400/600) */
    B + " [id^=pane-] :is(b,strong,.hx-vt,.tg-tao,.kpi-neg,.kpi-down,.kpi-pill,.tkq-cap,.tkn-summary,.hm-lg-h,.hm-lg-t,.hk-dhead,.hp-maphdr,.hp-h2btn)," +
      B + " #pane-kk .ks .t," + B + " #pane-htonbat .ht-tile .l," + B + " #pane-planogram :is(.hp-tile .l,.go,.av,.hp-tdrow .n)," + B + " .hx-bc-chu span:first-child," + B + " :is(.tkq-num,.hp-nvmore)," + B + " [id^=pane-] .st.bad," +
      B + " #modal :is(b,strong){font-weight:600!important}",
    B + " :is(.hx-nut,.hx-nut.nho,.hx-tag){font-weight:400!important}",
    /* 13/10 chiều user (tab Bất thường Factory): «thiết kế/màu sắc không đúng ant design — chưa đồng bộ bộ luật dự án».
       Ô SỐ = Statistic của antd, CHUNG mọi ô số 2 dự án (.abntile Factory dùng ở Bất thường / Tồn tại vị trí / Tem / Chuyển đổi cân · .ht-tile Retail):
       nhãn xám 14 ĐỨNG TRÊN, số 24/600 màu chữ thường, màu loại chỉ còn ở CHẤM trước nhãn (khớp chú giải biểu đồ) — bỏ cầu vồng số + viền màu trái + chữ 10–11px. */
    B + " :is(.abntile,.ht-tile){display:flex!important;flex-direction:column;border:1px solid var(--ad-chia)!important;border-radius:8px!important;padding:16px!important;box-shadow:none!important;background:var(--surface)!important}",
    B + " :is(.abntile,.ht-tile):hover{border-color:var(--accent)!important}",
    B + " :is(.abntile,.ht-tile) > .l{order:-1;display:flex;align-items:center;gap:8px;margin:0 0 4px!important;font-size:14px!important;font-weight:400!important;line-height:22px!important;color:var(--muted)!important}",
    /* 13/10: nhãn ô dài xuống 2 dòng làm số lệch hàng → mọi ô trong 1 hàng dùng CHUNG dòng nhãn/số/phụ (subgrid) — số luôn thẳng 1 đường */
    B + " .abntiles > .abntile{grid-row:span 3;display:grid!important;grid-template-rows:subgrid;align-content:start}",
    B + " .abntiles > .abntile > .l{align-items:flex-start}",
    B + " .abntiles > .abntile > .l::before{margin-top:8px}",
    B + " :is(.abntile,.ht-tile) > .l::before{content:'';flex:none;width:6px;height:6px;border-radius:50%;background:var(--cc,var(--accent))}",
    B + " :is(.abntile,.ht-tile) > .k{font-size:24px!important;font-weight:600!important;line-height:32px!important;color:var(--text)!important;letter-spacing:0}",
    B + " :is(.abntile,.ht-tile) > .s{font-size:12px!important;line-height:20px;color:var(--muted)!important;margin-top:4px!important}",
    B + " :is(#viewAbn,#pane-htonbat) :is(small,.v small,.sub){font-size:12px!important}",
    B + " :is(.abnrl,.ht-rl){font-size:14px!important;line-height:22px}" + B + " :is(#viewAbn,#pane-htonbat) h2 span:not(.h2tip):not(.dot){font-size:12px!important}" + B + " .cn-lb{font-size:12px!important;font-weight:600!important}" + B + " #toast{border-radius:8px!important}",   // 15/10 AD-06/AD-03 (Factory Tổng quan)
    /* 13/10 user (tab Kiểm kê, Retail + Factory): «6 ô số sao không nằm thẳng cùng 1 hàng» — 2 khung SKU / vị trí xếp CHỒNG (mỗi khung hết bề ngang),
       dải 6 ô = 6 cột bằng nhau 1 hàng (điện thoại 2 cột); ô = Statistic antd: nhãn xám 14 TRÊN, số 24/600 dưới (giữ màu NGHĨA: lệch âm đỏ, đạt xanh) */
    B + " #pane-kk .hk-grid2," + B + " #viewKK .grid2.even{grid-template-columns:minmax(0,1fr)!important}",
    B + " :is(#pane-kk .hk-strip,#viewKK .kkstrip){display:grid!important;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px!important;margin:8px 0 16px!important}",
    B + " :is(#pane-kk .hk-strip,#viewKK .kkstrip) .ks{display:flex!important;flex-direction:column;min-width:0;padding:16px!important;border:1px solid var(--ad-chia)!important;border-radius:8px!important;background:var(--surface)!important;box-shadow:none!important;transform:none!important}",
    B + " :is(#pane-kk .hk-strip,#viewKK .kkstrip) .ks:hover{border-color:var(--accent)!important;background:var(--surface)!important}",
    B + " :is(#pane-kk .hk-strip,#viewKK .kkstrip) .ks .t{order:-1;margin:0 0 4px!important;font-size:14px!important;font-weight:400!important;line-height:22px!important;letter-spacing:0!important;text-transform:none!important;color:var(--muted)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis}",
    B + " :is(#pane-kk .hk-strip,#viewKK .kkstrip) .ks .s{margin-top:4px;font-size:12px;line-height:20px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    B + " :is(#pane-kk .hk-strip,#viewKK .kkstrip) .ks .v{font-size:24px!important;font-weight:600!important;line-height:32px!important;letter-spacing:0!important}",
    B + " :is(#pane-kk .hk-strip,#viewKK .kkstrip) .ks .v b{font-weight:600!important}",
    /* 15/10 user: HÀNG 2 = [Kiểm kê theo SKU] [Kiểm kê theo mã vị trí] NGANG HÀNG; 6 ô số VẪN 1 hàng ⇒ ô gọn (đệm 8×10, nhãn 12 tối đa 2 dòng, số 20/600).
       Màn < 1280 (khung nội dung < ~1000px) giữ xếp chồng — 6 ô trong nửa khung sẽ quá hẹp để đọc. */
    "@media(min-width:1280px){" + B + " #pane-kk .hk-grid2," + B + " #viewKK .grid2.even{grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important}" +
      B + " :is(#pane-kk .hk-strip,#viewKK .kkstrip){gap:8px!important}" +
      B + " :is(#pane-kk .hk-strip,#viewKK .kkstrip) .ks{padding:8px 10px!important}" +
      B + " :is(#pane-kk .hk-strip,#viewKK .kkstrip) .ks .t{font-size:12px!important;line-height:18px!important;white-space:normal!important;overflow:visible!important;min-height:36px}" +
      B + " :is(#pane-kk .hk-strip,#viewKK .kkstrip) .ks .v{font-size:20px!important;line-height:28px!important;white-space:nowrap}" +
      B + " :is(#pane-kk .hk-strip,#viewKK .kkstrip) .ks .s{white-space:normal;font-size:12px;line-height:16px}" +
      /* 15/10 user «2 thanh tiến độ SKU / mã vị trí lệch, không ngang hàng»: ô 2 khung cao khác nhau (nhãn 1–3 dòng, có/không dòng phụ)
         ⇒ CHỐT khuôn ô: nhãn đúng 2 dòng · số 28 · dòng phụ đúng 2 dòng ⇒ mọi ô cao 120px ở cả 2 khung; tiêu đề khung cao cố định 28 */
      B + " :is(#pane-kk .hk-strip,#viewKK .kkstrip) .ks{height:120px;box-sizing:border-box;overflow:hidden}" +
      B + " :is(#pane-kk .hk-strip,#viewKK .kkstrip) .ks .t{height:36px;min-height:0!important;overflow:hidden!important;display:-webkit-box!important;-webkit-line-clamp:2;-webkit-box-orient:vertical}" +
      B + " :is(#pane-kk .hk-strip,#viewKK .kkstrip) .ks .s{max-height:32px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}" +
      B + " :is(#pane-kk .hk-grid2 > .hk-panel,#viewKK .grid2.even > .panel) > h2{min-height:28px;margin-bottom:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}",
    "@media(max-width:768px){" + B + " :is(#pane-kk .hk-strip,#viewKK .kkstrip){grid-template-columns:repeat(3,minmax(0,1fr));gap:8px!important}" + B + " :is(#pane-kk .hk-strip,#viewKK .kkstrip) .ks{padding:8px 10px!important}" + B + " :is(#pane-kk .hk-strip,#viewKK .kkstrip) .ks .t{font-size:12px!important;line-height:18px!important;white-space:normal!important}" + B + " :is(#pane-kk .hk-strip,#viewKK .kkstrip) .ks .v{font-size:20px!important;line-height:28px!important}}",   // 15/10 điện thoại 3 cột × 2 hàng (6 ô 1 hàng không đọc được ở 390px)
    /* 15/10 user «dùng ant design QC lại khung Kiểm kê/Bất thường — nhiều khung, không chuyên nghiệp»: đo được 3 tầng viền lồng nhau
       (khung phần → thẻ khối → ô số). Chuẩn antd: 1 Card / phần; bên trong KHÔNG lồng Card — khối là vùng phẳng ngăn bằng vạch ngang
       (Divider), ô số là Statistic không viền ngăn bằng vạch dọc; thẻ kho (Tiến độ theo kho) = nền xám nhạt, không viền. */
    B + " :is(#pane-kk,#pane-htonbat,#viewKK,#viewAbn) :is(.panel,.hk-panel,.ht-panel){border:0!important;border-top:1px solid var(--ad-chia)!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;padding:20px 0!important;margin:-1px 0 0!important;min-height:0}",
    B + " :is(#pane-kk,#pane-htonbat,#viewKK,#viewAbn) :is(.panel,.hk-panel,.ht-panel) :is(.panel,.hk-panel,.ht-panel){border-top:0!important;padding:0!important;margin:0!important}",
    B + " :is(#pane-kk,#pane-htonbat,#viewKK,#viewAbn) :is(.hk-grid2,.hk-hang1,.grid2,.kktop,.kkphai,.ht-grid2){gap:0 32px!important;margin:0!important;align-items:stretch}",
    B + " :is(#pane-kk,#pane-htonbat,#viewKK,#viewAbn) .kkphai{gap:0!important}",
    B + " :is(#pane-kk,#pane-htonbat,#viewKK,#viewAbn) :is(.panel,.hk-panel,.ht-panel) > h2{margin:0 0 12px!important;font-size:14px!important;line-height:22px!important}",   // 16/10 antd: tiêu đề khung 16/600, khối bên trong 14/600 — trước cùng 16 nên không phân cấp
    B + " :is(#pane-kk,#pane-htonbat,#viewKK,#viewAbn) :is(.hk-strip,.kkstrip,.ht-tiles,.abntiles){gap:0!important;margin:12px 0!important}",
    B + " :is(#pane-kk,#pane-htonbat,#viewKK,#viewAbn) :is(.hk-strip,.kkstrip,.ht-tiles,.abntiles) > :is(.ks,.ht-tile,.abntile){border:0!important;border-left:1px solid var(--ad-chia)!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;padding:4px 16px!important}",
    B + " :is(#pane-kk,#pane-htonbat,#viewKK,#viewAbn) :is(.hk-strip,.kkstrip,.ht-tiles,.abntiles) > :is(.ks,.ht-tile,.abntile):first-child{border-left:0!important;padding-left:0!important}",
    B + " :is(#pane-kk,#pane-htonbat,#viewKK,#viewAbn) :is(.hk-strip,.kkstrip,.ht-tiles,.abntiles) > :is(.ks,.ht-tile,.abntile):hover{background:var(--ad-re)!important}",
    B + " :is(#pane-kk,#pane-htonbat,#viewKK,#viewAbn) :is(#tvtWrap .abntiles > .abntile){padding:4px 16px!important}",
    B + " :is(#pane-kk,#pane-htonbat,#viewKK,#viewAbn) :is(.whcard,.hk-whcard){border:0!important;background:color-mix(in srgb,var(--text) 3%,var(--surface))!important;box-shadow:none!important}",
    B + " :is(#pane-kk,#pane-htonbat,#viewKK,#viewAbn) :is(.whcard,.hk-whcard).active{box-shadow:inset 0 0 0 1px var(--accent)!important}",
    /* 16/10 user «animation chuyển sub-tab/hạng mục chưa đồng bộ» (cả 2 dự án): đo được Retail chỉ trượt KHUNG TAB (paneIn .5s), Factory trượt khung
       rồi từng thẻ con lại fadeUp .32s lệch nhịp (+ ô số, lưới, thẻ kho tự có keyframe riêng). Chuẩn chung: đổi tab / mục con = MỘT nhịp paneIn của
       khung tab; khối bên trong hiện cùng lúc. Giữ .swap (đổi bộ lọc — kkSwap), xoay chờ, khung xương, menu popIn. */
    H + " :is(.pane,.vfade) :is(.panel,.card,.cards,.abntile,.ht-tile,.ht-grid2,.kb-tile,#hkWhList,#ndsCards,.nds-tools):not(.swap){animation:none!important;will-change:auto!important}",
    /* 16/10 user «bộ lọc Planogram/Kiểm kê Factory bị khung khác đè»: thẻ đang mở menu/lịch phải nổi trên thẻ đứng sau (luật chung, không vá từng thẻ) */
    H + " :is(.panel,.hp-panel,.hk-panel,.ht-panel):has(.combo-menu.show,.date-pop:not(.hidden),.date-pop.show){position:relative;z-index:40}",
    "@media(max-width:768px){" + B + " :is(#pane-kk,#pane-htonbat,#viewKK,#viewAbn) :is(.hk-strip,.kkstrip,.ht-tiles,.abntiles) > :is(.ks,.ht-tile,.abntile){padding:4px 10px!important}" + B + " :is(#pane-kk,#pane-htonbat,#viewKK,#viewAbn) :is(.hk-strip,.kkstrip,.ht-tiles,.abntiles) > :is(.ks,.ht-tile,.abntile):nth-child(3n+1){border-left:0!important;padding-left:0!important}}",
    /* 13/10 QC «vừa chiều ngang»: bảng Task vi phạm (Retail) rộng 1.342px trong khung 1.159px ở màn 1440 → phải kéo ngang.
       Tên NV / quản lý được xuống dòng (bỏ min 22ch), nhãn cột «Tần suất vi phạm» xuống dòng — bảng vừa khung, không cuộn ngang */
    "@media(min-width:769px){" + B + " :is(thead th,tbody td):is(.c-nv,.c-ql){min-width:0!important;white-space:normal!important}" + B + " thead th:is(.c-freq,.c-nv,.c-ql){white-space:normal!important}}",
    "@media(min-width:769px) and (max-width:1366px){" + B + " :is(thead th,tbody td).c-vitri{width:17ch!important;min-width:17ch!important;max-width:17ch!important}" + B + " tbody td.c-freq{white-space:normal!important}}",
    /* 13/10 Tổng quan phương án B (tqVe) — token antd: thẻ viền 1px bo 8, số 30/600 (ô chỉ số) · 24/600 (thẻ), mô tả 14 xám 2 dòng */
    ".tq{display:flex;flex-direction:column}",
    /* 13/10 tối user: «mục Tổng quan ở cả 2 dự án làm nhỏ lại — LUÔN VỪA VỚI KHUNG màn hình». Bậc 1 (mặc định) gọn hơn bản cũ;
       tqVuaKhung() nâng .tq[data-bac] 2 → 3 rồi mới zoom tới khi trang không còn cuộn. */
    ".tq-cs{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin:0 0 16px}",
    ".tq-o{padding:12px 16px;border:1px solid var(--ad-chia);border-radius:8px;background:var(--surface);min-width:0}",
    /* 14/10 user: «làm nổi bật các ô chỉ số so với các thẻ còn lại ở Tổng quan» — nền + viền nhạt theo MÀU NGHĨA của ô (--cc), nhãn đậm 500,
       số 28/600. Không bóng thường trực, không viền nhấn trái (luật AD). Thẻ chức năng bên dưới giữ nền trắng ⇒ hàng chỉ số tách hẳn. */
    ".tq-o{--cc:var(--accent);background:color-mix(in srgb,var(--cc) 7%,var(--surface))!important;border-color:color-mix(in srgb,var(--cc) 32%,var(--surface))!important}",
    ".tq-o .n{font-weight:500;color:color-mix(in srgb,var(--cc) 55%,var(--text))!important}.tq-o .v{font-size:28px;line-height:36px}",
    ".tq-o .p{border-top-color:color-mix(in srgb,var(--cc) 22%,var(--surface))!important}",
    ".tq-o .n{font-size:13px;line-height:20px;color:var(--muted)}.tq-o .v{font-size:24px;line-height:32px;font-weight:600;margin-top:2px;color:var(--text);font-variant-numeric:tabular-nums}",
    ".tq-o .p{margin-top:6px;padding-top:6px;border-top:1px solid var(--ad-chia);font-size:12px;line-height:18px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".tq-bar{height:6px;margin-top:8px;border-radius:100px;background:var(--ad-ray);overflow:hidden}.tq-bar i{display:block;height:100%;border-radius:100px;background:var(--accent)}",
    ".tq-g{display:flex;align-items:center;gap:8px;margin:0 0 8px;font-size:15px;line-height:22px;font-weight:600;color:var(--text)}",
    ".tq-gkhoa{width:100%;border:1px solid var(--ad-chia);border-radius:8px;background:var(--surface);padding:12px 16px;margin:0 0 16px;cursor:pointer;font:inherit;font-size:16px;font-weight:600;color:var(--text);text-align:left}.tq-gkhoa:hover{border-color:var(--accent)}",
    ".tq-khoa{display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:400;color:var(--muted)}.tq-khoa svg{width:14px;height:14px;fill:currentColor}",
    ".tq-luoi{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:0 0 16px}",
    ".tq-the{display:flex;flex-direction:column;align-items:stretch;min-width:0;padding:12px 16px;border:1px solid var(--ad-chia);border-radius:8px;background:var(--surface);color:var(--text);font:inherit;text-align:left;cursor:pointer;transition:box-shadow .2s,border-color .2s}",
    ".tq-the:hover{box-shadow:" + BONG1 + ";border-color:transparent}.tq-the:focus-visible{outline:none;box-shadow:" + VONG + "}",
    ".tq-the .h{display:flex;align-items:center;gap:10px;min-width:0}.tq-the .t{font-size:15px;line-height:20px;font-weight:600;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}",
    ".tq-the .av{flex:none;width:30px;height:30px;border-radius:8px;display:grid;place-items:center;background:var(--ad-chon);color:var(--accent)}.tq-the .av svg{width:18px;height:18px;fill:currentColor}",
    ".tq-the .m{margin-top:6px;font-size:13px;line-height:20px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".tq-the .ft{margin-top:auto;padding-top:8px;display:flex;align-items:flex-end;justify-content:space-between;gap:12px}",
    ".tq-the .sv{flex:1;min-width:0}.tq-the .sv b{font-size:20px;line-height:28px;font-weight:600;font-variant-numeric:tabular-nums}.tq-the .sv small{margin-left:6px;font-size:12px;color:var(--muted)}",
    ".tq-the .sv .tq-bar{margin-top:6px}.tq-the .mo{flex:none;font-size:13px;color:var(--accent);white-space:nowrap}",
    "@media(max-width:768px){.tq-cs{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:12px}.tq-luoi{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:12px}}",
    "@media(max-width:480px){.tq-luoi{grid-template-columns:minmax(0,1fr)}}",
    /* bậc 2: bỏ dòng mô tả + dòng phụ ô chỉ số */
    ".tq[data-bac='2'] .tq-the .m,.tq[data-bac='3'] .tq-the .m,.tq[data-bac='2'] .tq-o .p,.tq[data-bac='3'] .tq-o .p{display:none}",
    /* bậc 3: mỗi thẻ 1 HÀNG (icon · tên · số · →); ô chỉ số dồn 1 dòng; lưới 2 cột trên điện thoại */
    ".tq[data-bac='3'] .tq-cs{grid-template-columns:repeat(auto-fit,minmax(78px,1fr));gap:8px;margin-bottom:10px}.tq[data-bac='3'] .tq-o{padding:8px 10px}",
    ".tq[data-bac='3'] .tq-o .n{font-size:12px;line-height:16px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.tq[data-bac='3'] .tq-o .v{font-size:18px;line-height:24px}.tq[data-bac='3'] .tq-o .tq-bar{height:4px;margin-top:4px}",
    ".tq[data-bac='3'] .tq-g{font-size:13px;line-height:18px;margin-bottom:6px}.tq[data-bac='3'] .tq-luoi{gap:6px;margin-bottom:10px}",
    /* lưới «icon | tên (≤2 dòng) + số dưới tên | →» — .h/.ft display:contents để con của chúng thành ô lưới; số KHÔNG chiếm chỗ của tên (QC 13/10: «Trạng…», «Tồn kh…» bị cắt) */
    ".tq[data-bac='3'] .tq-the{display:grid;grid-template-columns:26px minmax(0,1fr) auto;grid-template-areas:'av t mo' 'av sv mo';column-gap:8px;align-items:center;align-content:center;padding:6px 10px;min-height:44px}",
    ".tq[data-bac='3'] .tq-the .h,.tq[data-bac='3'] .tq-the .ft{display:contents}.tq[data-bac='3'] .tq-the .av{grid-area:av;width:26px;height:26px}.tq[data-bac='3'] .tq-the .av svg{width:16px;height:16px}",
    ".tq[data-bac='3'] .tq-the .t{grid-area:t;font-size:13.5px;line-height:17px;white-space:normal;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}",
    ".tq[data-bac='3'] .tq-the .sv{grid-area:sv;line-height:0}.tq[data-bac='3'] .tq-the .sv:empty{display:none}.tq[data-bac='3'] .tq-the .sv b{font-size:14px;line-height:18px}.tq[data-bac='3'] .tq-the .sv small,.tq[data-bac='3'] .tq-the .sv .tq-bar{display:none}",
    ".tq[data-bac='3'] .tq-the .mo{grid-area:mo;font-size:0}.tq[data-bac='3'] .tq-the .mo::after{content:'→';font-size:14px}",
    "@media(max-width:480px){.tq[data-bac='3'] .tq-luoi{grid-template-columns:repeat(2,minmax(0,1fr))}}",
    /* pop-up (Modal antd): đầu hộp bo theo hộp 8px · khối con 8 · nút 6 · chip giờ (Tag) 4 · đậm ≤600 · không in hoa */
    B + " .modal-head{border-radius:8px 8px 0 0!important}",
    B + " #modal :is(.step-body,.cmt-sec,.hx-qd-khung,.hx-lan,.hx-vwrap,.hx-hoi,.hx-ng,.hx-chot){border-radius:8px!important}",
    B + " #modal :is(button.chinh,.hx-act button){border-radius:6px!important}" + B + " #modal .hx-act button{font-weight:400!important}" + B + " #modal .hx-act button.chinh{font-weight:600!important}" + B + " #modal .hx-tlg button{border-radius:4px!important}",
    B + " #modal :is(#mTitle,.step-title,.cmt-sec-h,.hx-qd-nguon button.on,#hxGio,figcaption,.hx-hoi,.ten,button.chinh,.hx-tlg button,.modal-head a)," + B + " #mTitle{font-weight:600!important}",
    B + " #modal .cmt-sec-h{text-transform:none!important;letter-spacing:0!important}",

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
      H + " #adLogo{width:min(72vw,264px)}" + H + " #adChuyen{width:min(72vw,264px)}" +
      H + " #sideNav{width:72vw;max-width:264px}" +
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
    if (!on) { c.innerHTML = "<b>" + esc(TEN) + "</b>"; if (document.title !== TEN) document.title = TEN; return; }
    var ten = on.cloneNode(true); ten.querySelectorAll(".sn,.di").forEach(function (x) { x.remove(); });
    var sub = on.closest(".s-sub"), grp = sub && sub.previousElementSibling;
    var g = grp && grp.classList.contains("s-grp") ? grp.textContent.trim() : "";
    c.innerHTML = (g ? '<span class="g">' + esc(g) + '</span><span class="s">/</span>' : "") + "<b>" + esc(ten.textContent.trim()) + "</b>";
    /* 13/10 user: tiêu đề cửa sổ = tên tab / mục con đang mở (vd «Vi phạm»); Tổng quan (mục không nhóm, đầu thanh bên) giữ tên dashboard */
    var tieuDe = (on.dataset.tab === "home" && !g) ? TEN : ten.textContent.trim();
    if (document.title !== tieuDe) document.title = tieuDe;
  }

  /* ===== 13/10 ĐƯỜNG DẪN APP + LINK THEO TAB (t4) =====
     Gốc app theo nơi chạy: pages.dev /retail/ /factory/ · github.io /kiemsoatkho/ /stocklocationfactory/ · bản nội bộ 8123 /kiemsoatkho/ /factory/.
     Link theo tab CHỈ bật ở nơi trả được trang cho đường dẫn sâu (pages.dev + bản nội bộ); github.io giữ kiểu ?tab= như cũ. */
  var GOC_RE = /^\/(retail|kiemsoatkho|factory|stocklocationfactory)(\/|$)/;
  function gocApp() { var m = GOC_RE.exec(location.pathname); return m ? "/" + m[1] + "/" : location.pathname.replace(/[^/]*$/, ""); }
  function gocCua(app) {
    var h = location.hostname, pd = /\.pages\.dev$/.test(h), gh = /\.github\.io$/.test(h);
    if (app === "factory") return pd ? "/factory/" : gh ? "/stocklocationfactory/" : "/factory/";
    return pd ? "/retail/" : "/kiemsoatkho/";
  }
  var LINK_SAU = !/\.github\.io$/.test(location.hostname) && GOC_RE.test(location.pathname);
  function boDau(x) { return String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/[^a-z0-9]+/g, ""); }
  function tenMuc(it) { var c = it.cloneNode(true); c.querySelectorAll(".sn,.di").forEach(function (x) { x.remove(); }); return c.textContent.trim(); }
  function nhomMuc(it) { var sub = it.closest(".s-sub"), g = sub && sub.previousElementSibling; return g && g.classList.contains("s-grp") ? g.textContent.trim() : ""; }
  /* Tổng quan (mục không thuộc nhóm) = gốc app; mục khác = /<nhóm>/<mục> bỏ dấu — sinh TỰ ĐỘNG từ thanh bên, tab mới không phải khai */
  function duongMuc(it) { var g = nhomMuc(it); return gocApp() + (g ? boDau(g) + "/" + boDau(tenMuc(it)) : (it.dataset.tab === "home" ? "" : boDau(tenMuc(it)))); }
  function mucTheoDuong(p) {
    var ds = [].slice.call(document.querySelectorAll("#sideNav .s-item"));
    for (var i = 0; i < ds.length; i++) if (duongMuc(ds[i]).replace(/\/$/, "") === p.replace(/\/$/, "")) return ds[i];
    /* 15/10 BÍ DANH link cũ khi gộp/đổi tên mục: window.AD_BI_DANH = { "<nhóm>/<mục cũ>": "<data-tab>[#id khối cần cuộn tới]" } */
    var bd = (window.AD_BI_DANH || {})[p.replace(gocApp(), "").replace(/\/$/, "")];
    if (bd) { var x = document.querySelector('#sideNav .s-item[data-tab="' + bd.split("#")[0] + '"]'); if (x) { x.__cuon = bd.split("#")[1] || ""; return x; } }
    return null;
  }
  var choMo = LINK_SAU ? location.pathname : "", dangPop = false, hetCho = Date.now() + 15000;
  function dongBoLink() {
    if (!LINK_SAU) return;
    if (choMo) {   // mở thẳng link sâu: chờ thanh bên có mục khớp (mục Xác minh đến muộn — đợi ping máy chủ + đăng nhập) rồi bấm như người dùng bấm
      if (choMo.replace(/\/$/, "") + "/" === gocApp()) { choMo = ""; }
      else { var it = mucTheoDuong(choMo); if (it) { var p0 = choMo; choMo = ""; var cuon = it.__cuon; it.__cuon = "";
        if (cuon) setTimeout(function () { var k = document.getElementById(cuon); if (k) k.scrollIntoView({ block: "start" }); }, 1500);
        if (!it.classList.contains("on")) { it.click(); return; } } else if (Date.now() < hetCho) return; else choMo = ""; }
    }
    var on = document.querySelector("#sideNav .s-item.on"); if (!on) return;
    var dich = duongMuc(on); if (dich === location.pathname) return;
    var u = new URL(location.href); u.pathname = dich; u.searchParams.delete("tab"); u.searchParams.delete("company");
    if (dangPop) { history.replaceState(null, "", u); dangPop = false; } else history.pushState(null, "", u);
  }
  window.addEventListener("popstate", function () {
    if (!LINK_SAU) return; var it = mucTheoDuong(location.pathname); dangPop = true;
    if (it && !it.classList.contains("on")) it.click(); else dangPop = false;
  });
  window.adDuongMuc = function (it) { return duongMuc(it); };   // cho bộ đo qc-dieu-huong

  /* ===== ICON THANH BÊN — khoá = data-tab (+":"+data-sub). Mục nào trùng nghĩa với WMS thì dùng ĐÚNG icon WMS đang dùng
     (Dashboard=gauge · Inventory=warehouse · Physical count=format-list-checkbox · Location management=store-marker · Audit log=history) ===== */
  var ICON = {"mdiMonitor": "M21,16H3V4H21M21,2H3C1.89,2 1,2.89 1,4V16A2,2 0 0,0 3,18H10V20H8V22H16V20H14V18H21A2,2 0 0,0 23,16V4C23,2.89 22.1,2 21,2Z", "mdiLockOutline": "M12,17C10.89,17 10,16.1 10,15C10,13.89 10.89,13 12,13A2,2 0 0,1 14,15A2,2 0 0,1 12,17M18,20V10H6V20H18M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6C4.89,22 4,21.1 4,20V10C4,8.89 4.89,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z", "mdiPackageVariantClosedRemove": "M13 12.6L19 9.2V13C19.7 13 20.4 13.1 21 13.4V7.5C21 7.1 20.8 6.8 20.5 6.6L12.6 2.2C12.4 2.1 12.2 2 12 2S11.6 2.1 11.4 2.2L3.5 6.6C3.2 6.8 3 7.1 3 7.5V16.5C3 16.9 3.2 17.2 3.5 17.4L11.4 21.8C11.6 21.9 11.8 22 12 22S12.4 21.9 12.6 21.8L13.5 21.3C13.2 20.7 13.1 20 13 19.3M12 4.2L18 7.5L16 8.6L10.1 5.2L12 4.2M11 19.3L5 15.9V9.2L11 12.6V19.3M12 10.8L6 7.5L8 6.3L14 9.8L12 10.8M16.9 15.5L19 17.6L21.1 15.5L22.5 16.9L20.4 19L22.5 21.1L21.1 22.5L19 20.4L16.9 22.5L15.5 21.1L17.6 19L15.5 16.9L16.9 15.5Z", "mdiGauge": "M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12C20,14.4 19,16.5 17.3,18C15.9,16.7 14,16 12,16C10,16 8.2,16.7 6.7,18C5,16.5 4,14.4 4,12A8,8 0 0,1 12,4M14,5.89C13.62,5.9 13.26,6.15 13.1,6.54L11.81,9.77L11.71,10C11,10.13 10.41,10.6 10.14,11.26C9.73,12.29 10.23,13.45 11.26,13.86C12.29,14.27 13.45,13.77 13.86,12.74C14.12,12.08 14,11.32 13.57,10.76L13.67,10.5L14.96,7.29L14.97,7.26C15.17,6.75 14.92,6.17 14.41,5.96C14.28,5.91 14.15,5.89 14,5.89M10,6A1,1 0 0,0 9,7A1,1 0 0,0 10,8A1,1 0 0,0 11,7A1,1 0 0,0 10,6M7,9A1,1 0 0,0 6,10A1,1 0 0,0 7,11A1,1 0 0,0 8,10A1,1 0 0,0 7,9M17,9A1,1 0 0,0 16,10A1,1 0 0,0 17,11A1,1 0 0,0 18,10A1,1 0 0,0 17,9Z", "mdiChartBoxOutline": "M9 17H7V10H9V17M13 17H11V7H13V17M17 17H15V13H17V17M19 19H5V5H19V19.1M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3Z", "mdiAlertCircleOutline": "M11,15H13V17H11V15M11,7H13V13H11V7M12,2C6.47,2 2,6.5 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20Z", "mdiClipboardListOutline": "M19 3H14.82C14.4 1.84 13.3 1 12 1S9.6 1.84 9.18 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3M12 3C12.55 3 13 3.45 13 4S12.55 5 12 5 11 4.55 11 4 11.45 3 12 3M7 7H17V5H19V19H5V5H7V7M12 17V15H17V17H12M12 11V9H17V11H12M8 12V9H7V8H9V12H8M9.25 14C9.66 14 10 14.34 10 14.75C10 14.95 9.92 15.14 9.79 15.27L8.12 17H10V18H7V17.08L9 15H7V14H9.25", "mdiStoreMarkerOutline": "M20 6H4V4H20V6M14.3 12C13.5 12.96 13 14.18 13 15.5C13 16.64 13.43 17.86 14 19V20H4V14H3V12L4 7H20L20.7 10.5C20.04 10.18 19.32 10 18.56 10L18.36 9H5.64L5.04 12H14.3M12 14H6V18H12V14M22 15.5C22 18.1 18.5 22 18.5 22S15 18.1 15 15.5C15 13.6 16.6 12 18.5 12S22 13.6 22 15.5M19.7 15.6C19.7 15 19.1 14.4 18.5 14.4S17.3 14.9 17.3 15.6C17.3 16.2 17.8 16.8 18.5 16.8S19.8 16.2 19.7 15.6Z", "mdiFormatListCheckbox": "M21,19V17H8V19H21M21,13V11H8V13H21M8,7H21V5H8V7M4,5V7H6V5H4M3,5A1,1 0 0,1 4,4H6A1,1 0 0,1 7,5V7A1,1 0 0,1 6,8H4A1,1 0 0,1 3,7V5M4,11V13H6V11H4M3,11A1,1 0 0,1 4,10H6A1,1 0 0,1 7,11V13A1,1 0 0,1 6,14H4A1,1 0 0,1 3,13V11M4,17V19H6V17H4M3,17A1,1 0 0,1 4,16H6A1,1 0 0,1 7,17V19A1,1 0 0,1 6,20H4A1,1 0 0,1 3,19V17Z", "mdiAlertOctagonOutline": "M8.27,3L3,8.27V15.73L8.27,21H15.73C17.5,19.24 21,15.73 21,15.73V8.27L15.73,3M9.1,5H14.9L19,9.1V14.9L14.9,19H9.1L5,14.9V9.1M11,15H13V17H11V15M11,7H13V13H11V7", "mdiPlaylistCheck": "M14 10H3V12H14V10M14 6H3V8H14V6M3 16H10V14H3V16M21.5 11.5L23 13L16 20L11.5 15.5L13 14L16 17L21.5 11.5Z", "mdiCctv": "M6.03 12.03L8.03 15.5L5.5 18.68L2 12.62L6.03 12.03M17 18V15.29C17.88 14.9 18.5 14.03 18.5 13C18.5 12.43 18.3 11.9 17.97 11.5L19.94 10.35C20.95 9.76 21.3 8.47 20.71 7.46L19.33 5.06C18.74 4.05 17.45 3.7 16.44 4.28L8.31 9C7.36 9.53 7.03 10.75 7.58 11.71L9.08 14.31C9.63 15.26 10.86 15.59 11.81 15.04L13.69 13.96C13.94 14.55 14.41 15.03 15 15.29V18C15 19.1 15.9 20 17 20H22V18H17Z", "mdiHistory": "M13.5,8H12V13L16.28,15.54L17,14.33L13.5,12.25V8M13,3A9,9 0 0,0 4,12H1L4.96,16.03L9,12H6A7,7 0 0,1 13,5A7,7 0 0,1 20,12A7,7 0 0,1 13,19C11.07,19 9.32,18.21 8.06,16.94L6.64,18.36C8.27,20 10.5,21 13,21A9,9 0 0,0 22,12A9,9 0 0,0 13,3", "mdiWarehouse": "M6 19H8V21H6V19M12 3L2 8V21H4V13H20V21H22V8L12 3M8 11H4V9H8V11M14 11H10V9H14V11M20 11H16V9H20V11M6 15H8V17H6V15M10 15H12V17H10V15M10 19H12V21H10V19M14 19H16V21H14V19Z", "mdiBarcodeScan": "M4,6H6V18H4V6M7,6H8V18H7V6M9,6H12V18H9V6M13,6H14V18H13V6M16,6H18V18H16V6M19,6H20V18H19V6M2,4V8H0V4A2,2 0 0,1 2,2H6V4H2M22,2A2,2 0 0,1 24,4V8H22V4H18V2H22M2,16V20H6V22H2A2,2 0 0,1 0,20V16H2M22,20V16H24V20A2,2 0 0,1 22,22H18V20H22Z", "mdiScaleBalance": "M12,3C10.73,3 9.6,3.8 9.18,5H3V7H4.95L2,14C1.53,16 3,17 5.5,17C8,17 9.56,16 9,14L6.05,7H9.17C9.5,7.85 10.15,8.5 11,8.83V20H2V22H22V20H13V8.82C13.85,8.5 14.5,7.85 14.82,7H17.95L15,14C14.53,16 16,17 18.5,17C21,17 22.56,16 22,14L19.05,7H21V5H14.83C14.4,3.8 13.27,3 12,3M12,5A1,1 0 0,1 13,6A1,1 0 0,1 12,7A1,1 0 0,1 11,6A1,1 0 0,1 12,5M5.5,10.25L7,14H4L5.5,10.25M18.5,10.25L20,14H17L18.5,10.25Z", "mdiTagOutline": "M21.41 11.58L12.41 2.58A2 2 0 0 0 11 2H4A2 2 0 0 0 2 4V11A2 2 0 0 0 2.59 12.42L11.59 21.42A2 2 0 0 0 13 22A2 2 0 0 0 14.41 21.41L21.41 14.41A2 2 0 0 0 22 13A2 2 0 0 0 21.41 11.58M13 20L4 11V4H11L20 13M6.5 5A1.5 1.5 0 1 1 5 6.5A1.5 1.5 0 0 1 6.5 5Z", "mdiSwapHorizontal": "M21,9L17,5V8H10V10H17V13M7,11L3,15L7,19V16H14V14H7V11Z", "mdiShieldCheckOutline": "M21,11C21,16.55 17.16,21.74 12,23C6.84,21.74 3,16.55 3,11V5L12,1L21,5V11M12,21C15.75,20 19,15.54 19,11.22V6.3L12,3.18L5,6.3V11.22C5,15.54 8.25,20 12,21M10,17L6,13L7.41,11.59L10,14.17L16.59,7.58L18,9", "mdiFileDocumentOutline": "M6,2A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2H6M6,4H13V9H18V20H6V4M8,12V14H16V12H8M8,16V18H13V16H8Z"};
  var ICON_TAB = { home: "mdiGauge", tong: "mdiChartBoxOutline", task: "mdiAlertCircleOutline", hangmuc: "mdiClipboardListOutline", planogram: "mdiStoreMarkerOutline", plg: "mdiStoreMarkerOutline",
    kk: "mdiFormatListCheckbox", htonbat: "mdiPackageVariantClosedRemove", abn: "mdiPackageVariantClosedRemove", xacminh: "mdiShieldCheckOutline", "xacminh:treo": "mdiPlaylistCheck", "xacminh:cam": "mdiCctv", "xacminh:tg": "mdiHistory", maytram: "mdiMonitor",
    stock: "mdiWarehouse", sku: "mdiBarcodeScan", cd: "mdiScaleBalance", tem: "mdiTagOutline" };
  function svgIcon(ten) { var d = ICON[ten]; return d ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + d + '"/></svg>' : ""; }
  function ganIcon() {
    [].slice.call(document.querySelectorAll("#sideNav .s-item")).forEach(function (it) {
      var di = it.querySelector(".di"); if (!di) { di = document.createElement("span"); di.className = "di"; it.insertBefore(di, it.firstChild); }
      var k = it.dataset.dash || (it.dataset.tab + (it.dataset.sub ? ":" + it.dataset.sub : ""));
      if (/^ban:/.test(k)) { var t = ((window.DASH_BOCUC || {}).tab || []).find(function (x) { return x.k === k; }); k = t && t.banSaoCua || k; }   // tab sao chép: icon của tab gốc
      var ten = ICON_TAB[k] || (/^moi:/.test(k) ? "mdiFileDocumentOutline" : "");
      if (di.dataset.ic !== ten) { di.dataset.ic = ten; di.innerHTML = svgIcon(ten); }
    });
  }
  window.adIcon = svgIcon;

  /* ===== 13/10 TỔNG QUAN PHƯƠNG ÁN B (user chọn cho cả 2 dự án): hàng 4 ô chỉ số + mỗi nhóm 1 lưới thẻ chức năng
     (icon · tên · mô tả 2 dòng · số chính + thanh tiến độ · «Mở →»). Bỏ chip.
     Số của tab NẶNG (Kiểm kê, Planogram) KHÔNG tự tải ở Tổng quan (luật nhẹ tải): module vẽ xong thì gọi tqGhi(khoá, số),
     số lưu kèm giờ trên máy này (localStorage, ≤12 giờ) ⇒ lần mở sau Tổng quan vẫn có số; quá hạn thì ẩn ô. ===== */
  var TQ_APP = /factory|stocklocation/.test(location.pathname) ? "factory" : "retail";
  window.tqGhi = function (k, o) {
    try { var all = JSON.parse(localStorage.getItem("tq-so-" + TQ_APP) || "{}"); o.ts = Date.now(); all[k] = o; localStorage.setItem("tq-so-" + TQ_APP, JSON.stringify(all)); } catch (e) {}
    (window.TQ_SO = window.TQ_SO || {})[k] = o;
    try { document.dispatchEvent(new CustomEvent("tq-so", { detail: k })); } catch (e) {}
  };
  window.tqDoc = function (k) {
    var o = (window.TQ_SO || {})[k];
    if (!o) { try { o = JSON.parse(localStorage.getItem("tq-so-" + TQ_APP) || "{}")[k]; } catch (e) { o = null; } }
    return o && Date.now() - (o.ts || 0) < 12 * 3600e3 ? o : null;
  };
  window.adIconTab = function (k) { return svgIcon(ICON_TAB[k] || ICON_TAB[String(k).split(":")[0]] || "mdiFileDocumentOutline"); };
  var escT = function (x) { return String(x == null ? "" : x).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var thanh = function (p, mau) { return '<div class="tq-bar"><i style="width:' + Math.max(0, Math.min(100, p)).toFixed(1) + '%' + (mau ? ";background:" + mau : "") + '"></i></div>'; };
  /* cfg = { chiSo:[{nhan, so, phu, tien, mau}|null], nhom:[{ten, khoa, muc:[{k (khoá icon), ten, mo, so, dv, mauSo, tien, bam:fn}]}] } */
  window.tqVe = function (el, cfg) {
    if (!el) return;
    /* 14/10 phân quyền (tai-khoan.js): thẻ / ô chỉ số của tab bị «Không» thì không hiện; nhóm hết mục thì bỏ cả nhóm */
    var coQ = function (k) { return typeof window.tkCo !== "function" || !k || k === "home" || window.tkCo((TQ_APP === "factory" ? "f." : "r.") + String(k).split(":")[0]); };
    var cs = (cfg.chiSo || []).filter(function (c) { return c && (!c.tab || coQ(c.tab)); });
    cfg = { chiSo: cfg.chiSo, nhom: (cfg.nhom || []).map(function (g) { var g2 = {}; for (var k in g) g2[k] = g[k]; g2.muc = g.khoa && !(window.TK && window.TK.nguoi) ? (g.muc || []) : (g.muc || []).filter(function (m) { return coQ(m.k); }); return g2; }).filter(function (g) { return g.muc.length; }) };
    var h = cs.length ? '<div class="tq-cs n' + cs.length + '">' + cs.map(function (c) {
      return '<div class="tq-o"' + (c.mau ? ' style="--cc:' + c.mau + '"' : '') + '><div class="n">' + escT(c.nhan) + '</div><div class="v"' + (c.tien == null && c.mau ? ' style="color:' + c.mau + '"' : "") + ">" + escT(c.so) + "</div>" +
        (c.tien != null ? thanh(c.tien, c.mau) : "") + (c.phu ? '<div class="p">' + escT(c.phu) + "</div>" : "") + "</div>"; }).join("") + "</div>" : "";
    var ds = [];
    (cfg.nhom || []).forEach(function (g) {
      /* 14/10 user: nhóm KHOÁ (Xác minh chưa đăng nhập) chỉ hiện 1 dòng tên nhóm — không bày các mục con; bấm dòng = mở mục đầu (ra màn đăng nhập) */
      if (g.khoa) { if (g.muc[0]) ds.push(g.muc[0]); h += '<button type="button" class="tq-g tq-gkhoa"' + (g.muc[0] ? ' data-tqi="' + (ds.length - 1) + '"' : "") + ' title="Đăng nhập để xem ' + escT(g.ten) + '">' + escT(g.ten) + ' <span class="tq-khoa">' + svgIcon("mdiLockOutline") + "Cần đăng nhập</span></button>"; return; }
      h += '<h3 class="tq-g">' + escT(g.ten) + '</h3><div class="tq-luoi">';
      g.muc.forEach(function (m) {
        ds.push(m);
        h += '<button type="button" class="tq-the" data-tqi="' + (ds.length - 1) + '" title="Mở ' + escT(m.ten) + '"><span class="h"><span class="av">' + window.adIconTab(m.k) + '</span><span class="t">' + escT(m.ten) + "</span></span>" +
          '<span class="m">' + escT(m.mo) + "</span>" +
          '<span class="ft"><span class="sv">' + (m.so != null && m.so !== "" ? '<b' + (m.mauSo ? ' style="color:' + m.mauSo + '"' : "") + ">" + escT(m.so) + "</b>" + (m.dv ? "<small>" + escT(m.dv) + "</small>" : "") + (m.tien != null ? thanh(m.tien) : "") : "") + '</span><span class="mo">Mở →</span></span></button>';
      });
      h += "</div>";
    });
    el.innerHTML = '<div class="tq" data-bac="1">' + h + "</div>";
    [].slice.call(el.querySelectorAll(".tq-the,.tq-gkhoa[data-tqi]")).forEach(function (b) { b.onclick = function () { var m = ds[+b.dataset.tqi]; if (m && m.bam) m.bam(); window.scrollTo({ top: 0 }); }; });
    tqVuaKhung();
  };

  /* 13/10 tối user: «LUÔN VỪA VỚI KHUNG màn hình». Thước đo = TRANG KHÔNG CUỘN (scrollHeight ≤ innerHeight). Nâng bậc gọn 1 → 2 → 3;
     còn tràn (màn quá thấp) mới zoom đúng phần thiếu. Đo lại khi đổi cỡ màn / đóng-mở thanh bên / Tổng quan vẽ lại. */
  function tqVuaKhung() {
    var tq = [].slice.call(document.querySelectorAll(".tq")).filter(function (x) { return x.offsetParent !== null; })[0];
    if (!tq) return;
    var de = document.documentElement, vua = function () { return de.scrollHeight <= window.innerHeight + 1; };
    tq.style.zoom = "";
    for (var bac = 1; bac <= 3; bac++) { tq.dataset.bac = bac; if (vua()) return; }
    var cao = tq.getBoundingClientRect().height, z = Math.max(0.6, Math.floor((cao - (de.scrollHeight - window.innerHeight)) / cao * 100) / 100);
    tq.style.zoom = z;
    for (var i = 0; i < 12 && !vua() && z > 0.6; i++) { z = Math.round((z - 0.02) * 100) / 100; tq.style.zoom = z; }
  }
  var henVK = null; function henVuaKhung() { clearTimeout(henVK); henVK = setTimeout(tqVuaKhung, 120); }
  window.tqVuaKhung = tqVuaKhung;
  window.addEventListener("resize", henVuaKhung);
  var ganMO = function () { try { new MutationObserver(henVuaKhung).observe(document.body, { attributes: true, attributeFilter: ["class"] }); } catch (e) {} };   // đóng/mở thanh bên đổi bề ngang
  if (document.body) ganMO(); else document.addEventListener("DOMContentLoaded", ganMO);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(henVuaKhung);

  /* 13/10 chiều user: «kích thước các ô Tổng quan phải BẰNG NHAU — dữ liệu có thể khác — cho cả 2 dự án» (sáng đã bỏ 218px cố định cho gọn).
     Mọi ô (cả các nhóm) cao = ô có nội dung dài nhất ⇒ bằng nhau mà vẫn gọn nhất có thể; đo lại khi ô đổi nội dung / đổi cỡ màn. */
  var henO = null;
  function canOTongQuan() {
    henO = null;
    var ds = [].slice.call(document.querySelectorAll(".ov-card,.hm-card")).filter(function (c) { return c.offsetParent !== null; });
    if (!ds.length) return;
    ds.forEach(function (c) { c.style.height = ""; });
    var max = Math.max.apply(null, ds.map(function (c) { return Math.ceil(c.getBoundingClientRect().height); }));
    ds.forEach(function (c) { c.style.height = max + "px"; });
  }
  function henCanO() { if (!henO) henO = setTimeout(canOTongQuan, 60); }
  window.adCanOTongQuan = canOTongQuan;

  function dung() {
    var bt = document.getElementById("brandTitle");
    if (bt && !document.getElementById("adCrumb")) { var c = document.createElement("div"); c.id = "adCrumb"; bt.after(c); }
    if (!document.getElementById("adLogo")) {
      var lg = document.createElement("div"); lg.id = "adLogo";
      lg.innerHTML = '<img src="' + esc(LOGO) + '" alt="" />' + esc(TEN);
      document.body.insertBefore(lg, document.body.firstChild);
      /* 13/10 user (Factory): «chuyển màu "Audit Factory" như màu logo» — trang khai window.AD_TEN_MAU; theme TỐI thì dùng trắng cho đọc được */
      if (window.AD_TEN_MAU) {
        var toMau = function () { var m = getComputedStyle(document.body).backgroundColor.match(/\d+/g) || [255, 255, 255];
          var toi = (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) < 128; lg.style.color = toi ? "#fff" : window.AD_TEN_MAU; };
        toMau(); try { new MutationObserver(toMau).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] }); } catch (e) {}
      }
    }
    if (CHUYEN && !document.getElementById("adChuyen")) {   // nút sang dashboard kia — giữ nguyên tên miền nên khoá máy / theme / phiên dùng chung
      var ch = document.createElement("nav"); ch.id = "adChuyen"; ch.setAttribute("aria-label", "Chuyển dashboard");
      ch.innerHTML = '<a href="' + esc(gocCua(CHUYEN.app)) + '" title="Sang ' + esc(CHUYEN.ten) + '"><span>' + esc(CHUYEN.ten) + '</span><span class="mt" aria-hidden="true">→</span></a>';
      ch.querySelector("a").insertAdjacentHTML("afterbegin", '<span class="ic">' + svgIcon("mdiSwapHorizontal") + "</span>");
      document.body.appendChild(ch);
    }
    capNhatCrumb(); dongBoLink(); henCanO(); ganIcon();
    try { new MutationObserver(function (ms) { for (var i = 0; i < ms.length; i++) { var t = ms[i].target; if (t.closest && t.closest(".ov-grid,.hm-grid,#pane-home,#viewHome")) { henCanO(); return; } } })
      .observe(document.body, { childList: true, subtree: true, characterData: true }); } catch (e) {}
    window.addEventListener("resize", henCanO);
    var nav = document.getElementById("sideNav");
    if (nav) try { new MutationObserver(function () { capNhatCrumb(); dongBoLink(); henCanO(); ganIcon(); }).observe(nav, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] }); } catch (e) {}
    /* máy tính rộng (≥992, mốc lg của antd): ghim thanh bên ngay khi vào, như bố cục trái–phải của antd */
    if (window.matchMedia("(min-width:992px)").matches && !document.body.classList.contains("side-open")) {
      /* 15/10 user «thanh bên giật, nhảy chữ»: mở SẴN không hiệu ứng (cờ moNgay) — trước đây chạy nhịp trượt-vào đúng lúc thanh bên đang dựng lại */
      var tg = document.getElementById("sideToggle"); if (tg) { document.body.dataset.moNgay = "1"; tg.click(); delete document.body.dataset.moNgay; }
    }
  }

  /* tệp nạp ĐỒNG BỘ trong <head> ⇒ gắn CSS + lớp html.ad NGAY (khung hình đầu đã đúng kiểu); phần cần DOM chờ DOMContentLoaded */
  var st = document.createElement("style"); st.id = "adCss"; st.textContent = css; (document.head || document.documentElement).appendChild(st);
  document.documentElement.classList.add("ad");
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", dung); else dung();
})();
