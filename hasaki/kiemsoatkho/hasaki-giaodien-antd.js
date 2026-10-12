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
  var TEN = window.AD_TEN || "Audit Hasaki", LOGO = window.AD_LOGO || "hasaki-logo.png";
  var BONG1 = "0 1px 2px -2px rgba(0,0,0,.16),0 3px 6px 0 rgba(0,0,0,.12),0 5px 12px 4px rgba(0,0,0,.09)";
  var BONG2 = "0 6px 16px 0 rgba(0,0,0,.08),0 3px 6px -4px rgba(0,0,0,.12),0 9px 28px 8px rgba(0,0,0,.05)";
  var VONG = "0 0 0 2px color-mix(in srgb,var(--accent) 18%,transparent)";   // quầng focus của antd, theo màu theme
  var SEG = "#hpWhBar .hp-wb1 .hp-whtab";   // thanh lọc "chọn 1 trong vài" kiểu Segmented (Kiểm kê/Bất thường nay dùng ô chọn)
  var H = "html.ad";
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
    H + " :is(.ov-grid,.hm-grid){display:grid;grid-template-columns:repeat(auto-fill,minmax(272px,1fr));gap:12px;align-items:stretch}",
    H + " :is(.ov-card,.hm-card){display:flex;flex-direction:column;gap:8px;width:100%;height:218px;padding:14px 16px;text-align:left;overflow:hidden;" +
      "border:1px solid var(--ad-chia);border-left:4px solid var(--cc);border-radius:8px;background:var(--surface);color:var(--text);box-shadow:none;transform:none}",
    H + " :is(.ov-card,.hm-card):hover{transform:none;background:var(--surface);box-shadow:" + BONG1 + "}",
    H + " :is(.ov-t,.hm-t){display:flex;align-items:baseline;gap:9px;min-height:48px;font-size:16px;font-weight:600;letter-spacing:0;color:var(--text)}",
    H + " :is(.ov-t,.hm-t) .k{margin-left:auto;font-size:20px;font-weight:600;line-height:28px;color:var(--cc);font-variant-numeric:tabular-nums}",
    H + " :is(.ov-t,.hm-t) .k small{display:block;font-size:12px;font-weight:400;line-height:20px;color:var(--muted);letter-spacing:0}",
    H + " :is(.ov-t,.hm-t) .k.trong{color:var(--muted);font-weight:400}",
    H + " :is(.ov-t,.hm-t) .k.nhan{font-size:12px;font-weight:600;letter-spacing:0;text-transform:none;color:var(--muted)}",
    H + " :is(.ov-d,.hm-d){font-size:14px;line-height:22px;color:var(--muted);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;min-height:66px}",
    H + " :is(.ov-c,.hm-c){display:flex;flex-wrap:wrap;gap:6px;margin-top:auto;max-height:50px;overflow:hidden}",   // chip (22px) tối đa 2 hàng ⇒ MỌI ô cao đúng 218px (tiêu đề 48 + mô tả 3 dòng 66 + chip 50)
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
    H + " #btnSettings{border-color:transparent;box-shadow:none;width:32px;height:32px;padding:0}",
    H + " #btnSettings:hover{background:var(--ad-re);border-color:transparent}",
    H + " #btnSettings .bars," + H + " #btnSettings .bars::before," + H + " #btnSettings .bars::after{background:var(--text);width:16px}",
    H + " #btnSettings.open .bars{background:transparent}",

    /* ---- thanh bên: Menu kiểu antd, rộng 200 ---- */
    H + " #sideNav{width:200px;background:var(--surface);border-right:1px solid var(--ad-chia);padding:64px 4px 16px;gap:0;box-shadow:none}",
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
    H + " #sideNav .s-item .di{display:none}",
    H + " #sideNav .s-item .sn{margin-left:auto;font-size:12px;font-weight:400;color:var(--muted);font-variant-numeric:tabular-nums}",
    H + " #sideNav .s-item{display:flex;align-items:center;gap:8px;white-space:nowrap;padding:0 12px 0 16px}",   // tên dài 1 dòng, số canh phải (Factory "Trạng thái lưu trữ 47,790")
    H + " #sideNav .s-item.on .sn{color:var(--accent)}",
    /* logo đầu thanh bên — trượt cùng thanh bên */
    "#adLogo{display:none}",
    H + " #adLogo{display:flex;align-items:center;gap:8px;position:fixed;top:0;left:0;z-index:61;width:200px;height:56px;padding:0 24px;" +
      "background:var(--surface);border-right:1px solid var(--ad-chia);font-size:16px;font-weight:600;color:var(--text);white-space:nowrap;" +
      "transform:translate3d(-100%,0,0);visibility:hidden;transition:transform .32s var(--ez-apple,ease),visibility 0s linear .32s}",
    H + " #adLogo img{width:24px;height:24px;border-radius:50%;flex:none}",
    H + " body.side-open #adLogo{transform:none;visibility:visible;transition-delay:0s}",   // ẩn hẳn khi đóng — nằm ngoài mép là bộ đo tính tràn
    /* nút đóng/mở thanh bên: nút chữ-biểu-tượng trong đầu trang, không nền màu */
    H + " #sideToggle{top:12px;left:12px;width:32px;height:32px;border-radius:6px;background:transparent;color:var(--text);box-shadow:none}",
    H + " #sideToggle:hover{background:var(--ad-re);box-shadow:none}",
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
    if (!on) { c.innerHTML = "<b>" + esc(TEN) + "</b>"; return; }
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
      lg.innerHTML = '<img src="' + esc(LOGO) + '" alt="" />' + esc(TEN);
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

  /* tệp nạp ĐỒNG BỘ trong <head> ⇒ gắn CSS + lớp html.ad NGAY (khung hình đầu đã đúng kiểu); phần cần DOM chờ DOMContentLoaded */
  var st = document.createElement("style"); st.id = "adCss"; st.textContent = css; (document.head || document.documentElement).appendChild(st);
  document.documentElement.classList.add("ad");
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", dung); else dung();
})();
