/**
 * ============================================================================
 *  factory-kiemke.js — TAB "KIỂM KÊ" của FACTORY: ANALYTICAL DASHBOARD + DRILL-DOWN
 * ============================================================================
 *  - Dropdown chọn kho (MTG mặc định / GARMENT) -> mọi tính toán trên MẢNG RAM của kho đó.
 *  - Dashboard 5 khối: Velocity (đếm hôm nay + %vs hôm qua), Status progress bar
 *    (VERIFIED/PROCESSING), Top SKU lệch, Top Location lệch, CSS bar-chart 7 ngày.
 *  - Bấm khối bất kỳ -> Modal drill-down full-screen, bảng đã áp filter, 2 sub-tab
 *    SKU/Location với đầy đủ cột WMS, deep-link ID/Request code -> wms.inshasaki.com.
 *  - CÔ LẬP: closure + 1 global FKIEMKE; tiền tố fk-; CSS neo #pane-fkiemke/.fk-modal;
 *    màu theo CSS variables portal. Data trường WMS chưa capture -> "—" (mock điền đủ).
 * ============================================================================
 */
(function(){
"use strict";
if (window.FKIEMKE) return;

var SHEET_ID = "1eY_oo9fAvWCTXp24x-Z0FXq9mp_jJPlTHg09qdemETs";
var TAB = "kiemke-material";
var APPSCRIPT_URL = "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
var MODAL_CAP = 400;                                          // trần <tr> trong modal (chống jank)
var FETCH_TIMEOUT_MS = 4 * 60 * 1000;

/* ===== MOCK (đủ trường WMS) — dùng khi sheet trống ===== */
var MOCK = (function(){
  var A = [
    ["INV-26001","422490737","Thân áo/CMTS0028/82.6% Cotton/205gsm/Trắng/XL","F1-A2-01-03","WH - MATERIAL - MTG",120,120,"RQ-5521","SRC-01","Định kỳ","Cao","Có","Nguyễn Văn A","Lê Thị B","2026-07-15 09:10","2026-07-16"],
    ["INV-26002","422490812","Vải chính/CMTS0031/100% Cotton Twill/240gsm/Đen","F1-A3-02-01","WH - MATERIAL - MTG",300,288,"RQ-5521","SRC-01","Định kỳ","Cao","Không","Nguyễn Văn A","Lê Thị B","2026-07-15 09:22","2026-07-16"],
    ["INV-26003","422491055","Dây kéo YKK 5VS/56cm/Đồng rêu","F2-B1-04-02","WH - MATERIAL - MTG",850,862,"RQ-5521","SRC-01","Trung bình","Không","Trần C","Phạm D","2026-07-14 15:02","2026-07-15"],
    ["INV-26004","422491203","Nút dập 15mm/Antique Brass/Bịch 500 cái","F2-B2-01-05","WH - MATERIAL - MTG",40,null,"RQ-5530","SRC-02","Đột xuất","Thấp","Không","Trần C","","2026-07-13 11:20","2026-07-15"],
    ["INV-26005","422491374","Chỉ may Coats Epic 120/5000m/Trắng ngà","F3-C1-02-02","WH - MATERIAL - MTG",215,215,"RQ-5521","SRC-01","Trung bình","Không","Nguyễn Văn A","Lê Thị B","2026-07-12 08:40","2026-07-13"],
    ["INV-26006","422491055","Dây kéo YKK 5VS/56cm/Đồng rêu","F2-B1-05-01","WH - MATERIAL - MTG",120,118,"RQ-5521","SRC-01","Trung bình","Không","Trần C","Phạm D","2026-07-11 14:05","2026-07-12"],
    ["INV-26007","422501854","Thân chính dưới đã thêu/Bag 12/Cotton Canvas","F0-A1-01-01","WH - MATERIAL - GARMENT",500,495,"RQ-6012","SRC-03","Định kỳ","Cao","Có","Vũ E","Đỗ F","2026-07-15 10:01","2026-07-16"],
    ["INV-26008","422501920","Vải lót/POLY210T/Xám tro/Khổ 1m5","F0-A2-03-04","WH - MATERIAL - GARMENT",160,171,"RQ-6012","SRC-03","Định kỳ","Trung bình","Không","Vũ E","Đỗ F","2026-07-15 10:15","2026-07-16"],
    ["INV-26009","422502088","Khoá móc kim loại 25mm/Nickel mờ","F1-B4-02-02","WH - MATERIAL - GARMENT",720,720,"RQ-6012","SRC-03","Thấp","Không","Vũ E","Đỗ F","2026-07-14 16:30","2026-07-15"],
    ["INV-26010","422502135","Webbing PP 30mm/Đen/Cuộn 50m","F1-B5-01-03","WH - MATERIAL - GARMENT",95,null,"RQ-6020","SRC-04","Đột xuất","Cao","Có","Bùi G","","2026-07-10 09:50","2026-07-12"],
    ["INV-26011","422502244","Mác dệt chính/Logo Bag12/Lô 2026","F2-C2-04-01","WH - MATERIAL - GARMENT",1000,998,"RQ-6012","SRC-03","Trung bình","Không","Vũ E","Đỗ F","2026-07-13 13:12","2026-07-14"],
    ["INV-26012","422501920","Vải lót/POLY210T/Xám tro/Khổ 1m5","F0-A2-04-01","WH - MATERIAL - GARMENT",140,140,"RQ-6012","SRC-03","Trung bình","Không","Vũ E","Đỗ F","2026-07-09 11:00","2026-07-10"],
  ];
  var UOMS = ["Mét", "Cái", "Cuộn", "Hộp"], SUB = ["Chờ duyệt", "Đang đếm lại", "Chờ HR"];
  return A.map(function(m, i){
    var inv = m[5], cnt = m[6], dl = cnt == null ? 0 : cnt - inv;
    var st = cnt == null ? "PENDING" : dl === 0 ? "VERIFIED" : "PROCESSING";
    return { id: m[0], no: i + 1, sku: m[1], pn: m[2], loc: m[3], wh: m[4], inv: inv, cnt: cnt, diffLoc: dl,
      req: m[7], source: m[8], type: m[9], priority: m[10], rfid: m[11], assignTo: m[12], countedBy: m[13],
      updatedAt: m[14], planDate: m[15],
      // CT5: 3 trường WMS nâng cao — MOCK điền đủ để xem UI (data thật chưa có -> để trống)
      uom: UOMS[i % UOMS.length], price: (i + 1) * 15000, subStatus: st === "PROCESSING" ? SUB[i % SUB.length] : "" };
  });
})();

/* ===== STATE ===== */
var ROWS = [], WHS = [], selWh = "", refDay = 0, dateRange = "all", _giaLap = false;
var ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M7 17L17 7M17 7H9M17 7V15"/></svg>';
var _boot = false, _syncing = false, _lastSyncMs = 0, _deb = null, PANE = null;
var mFilter = { t: "all" }, mTab = "sku", mLabel = "";

var $id = function(s){ return document.getElementById(s); };
function nf(x){ return (x == null ? 0 : x).toLocaleString("en-US"); }
function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
function p2(n){ return (n < 10 ? "0" : "") + n; }
function parseDate(s){
  if (!s) return NaN; s = String(s);
  // gviz serialize ô datetime của Sheet dạng "Date(2026,6,15,10,21,0)" — THÁNG 0-based
  var m = s.match(/^Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?/); if (m) return Date.UTC(+m[1], +m[2], +m[3], +m[4] || 0, +m[5] || 0);
  m = s.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})/); if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  m = s.match(/(\d{4})-(\d{2})-(\d{2})/); if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return Date.UTC(+m[3], +m[2] - 1, +m[1]);
  var t = Date.parse(s); return isNaN(t) ? NaN : t;
}
function dayKey(ms){ return isNaN(ms) ? NaN : Math.floor(ms / 86400000); }
/* CT1: bóc tách chuỗi Google Date "Date(y,M,d,H,m,s)" (Tháng 0-based) -> "DD/MM/YYYY HH:mm".
   Dùng chung parseDate; dateOnly=true khi chỉ cần ngày (Plan date). Không đọc được -> "—". */
function fmtDate(s, dateOnly){
  var ms = parseDate(s); if (isNaN(ms)) return s ? esc(String(s)) : "—";
  var d = new Date(ms), out = p2(d.getUTCDate()) + "/" + p2(d.getUTCMonth() + 1) + "/" + d.getUTCFullYear();
  return dateOnly ? out : out + " " + p2(d.getUTCHours()) + ":" + p2(d.getUTCMinutes());
}
function fmtTien(v){ return v == null || isNaN(v) ? "—" : (v > 0 ? "+" : "") + Math.round(v).toLocaleString("vi-VN") + " đ"; }
/* CT3: deep-link kiểu WMS — SKU (tab=sku) / Location (tab=location). Rỗng -> "—". */
function wmsLink(text, tab){
  if (text == null || text === "") return "—";
  return '<a class="wms-link" href="https://wms.inshasaki.com/physical-count/result/list?current_tab=' + tab +
    '" target="_blank" rel="noopener">' + esc(text) + ICON + "</a>";
}
function fmtDMY(dk){ var d = new Date(dk * 86400000); return p2(d.getUTCDate()) + "/" + p2(d.getUTCMonth() + 1); }
function statusOf(r){ if (r.cnt == null) return "PENDING"; return r.diffLoc === 0 ? "VERIFIED" : "PROCESSING"; }
function badgeCls(st){ return st === "VERIFIED" ? "verified" : st === "PROCESSING" ? "processing" : "pending"; }

/* ===== CSS ===== */
var CSS = [
"#pane-fkiemke .fk-top{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin:14px 0 14px;}",
"#pane-fkiemke .fk-whsel{position:relative;min-width:260px;}",
"#pane-fkiemke .fk-whsel label{display:block;font-size:10.5px;font-weight:650;color:var(--muted,#9ca3af);text-transform:uppercase;letter-spacing:.05em;margin:0 0 4px 2px;}",
"#pane-fkiemke select.fk-wh{appearance:none;-webkit-appearance:none;width:100%;padding:10px 38px 10px 14px;min-height:44px;border:1.5px solid var(--line,#d0d7de);border-radius:11px;background:var(--panel,#fff);color:var(--text,#1f2937);font-size:14px;font-weight:700;cursor:pointer;}",
"#pane-fkiemke select.fk-wh:focus{outline:0;border-color:var(--accent,#2563eb);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent,#2563eb) 18%,transparent);}",
"#pane-fkiemke .fk-whsel::after{content:'';position:absolute;right:15px;bottom:16px;width:8px;height:8px;border-right:2px solid var(--muted,#6b7280);border-bottom:2px solid var(--muted,#6b7280);transform:rotate(45deg);pointer-events:none;}",
"#pane-fkiemke .fk-rangesel{min-width:160px;}",
"#pane-fkiemke .fk-info{font-size:11.5px;color:var(--muted,#6b7280);}",
"#pane-fkiemke .fk-gl{color:#b45309;font-weight:700;}",
"#pane-fkiemke .fk-sync{margin-left:auto;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:2px;min-height:44px;background:var(--accent,#1f2937);color:#fff;border:0;border-radius:10px;padding:8px 16px;font-size:12.5px;font-weight:650;cursor:pointer;}",
"#pane-fkiemke .fk-sync:disabled{background:color-mix(in srgb,var(--muted,#9ca3af) 42%,var(--panel,#fff));color:var(--muted,#9ca3af);cursor:not-allowed;}",
"#pane-fkiemke .fk-sync .ts{font-size:10.5px;font-weight:500;color:rgba(255,255,255,.72);white-space:nowrap;}",
/* Dashboard grid */
"#pane-fkiemke .fk-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:14px;}",
"#pane-fkiemke .fk-card{background:var(--panel,#fff);border:1px solid var(--line,#e8ecf1);border-radius:16px;padding:16px 18px;transition:box-shadow .2s,transform .2s;}",
"#pane-fkiemke .fk-card.click{cursor:pointer;} #pane-fkiemke .fk-card.click:hover{box-shadow:0 10px 28px rgba(16,24,40,.1);transform:translateY(-2px);}",
"#pane-fkiemke .fk-c-vel{grid-column:span 3;} #pane-fkiemke .fk-c-sta{grid-column:span 5;} #pane-fkiemke .fk-c-trend{grid-column:span 4;}",
"#pane-fkiemke .fk-c-sku{grid-column:span 6;} #pane-fkiemke .fk-c-loc{grid-column:span 6;}",
"@media(max-width:900px){#pane-fkiemke .fk-grid{grid-template-columns:1fr;} #pane-fkiemke .fk-card{grid-column:1/-1 !important;}}",
"#pane-fkiemke .fk-h{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted,#9ca3af);margin:0 0 10px;}",
"#pane-fkiemke .fk-big{font-size:34px;font-weight:800;line-height:1;font-variant-numeric:tabular-nums;color:var(--text,#1f2937);}",
"#pane-fkiemke .fk-sub{font-size:12px;margin-top:8px;font-weight:600;}",
"#pane-fkiemke .fk-up{color:#0f9488;} #pane-fkiemke .fk-down{color:#dc2626;} #pane-fkiemke .fk-flat{color:var(--muted,#9ca3af);}",
/* progress bar */
"#pane-fkiemke .fk-bar{display:flex;height:12px;border-radius:999px;overflow:hidden;background:color-mix(in srgb,var(--muted,#9ca3af) 20%,transparent);margin:6px 0 12px;}",
"#pane-fkiemke .fk-bar i{display:block;height:100%;transition:width .8s cubic-bezier(.4,0,.2,1);}",
"#pane-fkiemke .fk-bar .v{background:#14b8a6;} #pane-fkiemke .fk-bar .p{background:#f59e0b;}",
"#pane-fkiemke .fk-leg{display:flex;flex-wrap:wrap;gap:14px;}",
"#pane-fkiemke .fk-leg span{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--text,#374151);cursor:pointer;padding:2px 4px;border-radius:6px;}",
"#pane-fkiemke .fk-leg span:hover{background:color-mix(in srgb,var(--accent,#2563eb) 8%,transparent);}",
"#pane-fkiemke .fk-leg .dot{width:10px;height:10px;border-radius:3px;} #pane-fkiemke .fk-leg b{font-variant-numeric:tabular-nums;}",
/* mini tables */
"#pane-fkiemke .fk-mini{overflow-x:auto;-webkit-overflow-scrolling:touch;}",
"#pane-fkiemke .fk-mini table{width:100%;border-collapse:collapse;font-size:12.5px;min-width:340px;}",
"#pane-fkiemke .fk-mini td{padding:7px 8px;border-top:1px solid var(--line,#eef1f5);white-space:nowrap;cursor:pointer;}",
"#pane-fkiemke .fk-mini tr:hover td{background:color-mix(in srgb,var(--accent,#2563eb) 6%,transparent);}",
"#pane-fkiemke .fk-mini .rank{color:var(--muted,#9ca3af);width:20px;} #pane-fkiemke .fk-mini .pn{color:var(--muted,#6b7280);max-width:170px;overflow:hidden;text-overflow:ellipsis;}",
"#pane-fkiemke .fk-mini .num{text-align:right;font-variant-numeric:tabular-nums;font-weight:700;}",
"#pane-fkiemke .d-am{color:#dc2626;} #pane-fkiemke .d-duong{color:#2563eb;} #pane-fkiemke .d-khop{color:var(--muted,#9ca3af);}",
"#pane-fkiemke .fk-loc{font-family:ui-monospace,Consolas,monospace;color:#0f9488;}",
/* 7-day chart */
"#pane-fkiemke .fk-chart{display:flex;align-items:flex-end;gap:8px;height:120px;padding-top:6px;}",
"#pane-fkiemke .fk-col{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;height:100%;justify-content:flex-end;}",
"#pane-fkiemke .fk-colbar{width:70%;min-height:3px;background:linear-gradient(180deg,var(--accent,#2563eb),color-mix(in srgb,var(--accent,#2563eb) 55%,#14b8a6));border-radius:5px 5px 0 0;transition:height .7s cubic-bezier(.4,0,.2,1);}",
"#pane-fkiemke .fk-col:hover .fk-colbar{filter:brightness(1.1);}",
"#pane-fkiemke .fk-collab{font-size:10px;color:var(--muted,#9ca3af);} #pane-fkiemke .fk-colval{font-size:10.5px;font-weight:700;color:var(--text,#374151);}",
"#pane-fkiemke .fk-badge{display:inline-block;padding:2px 9px;border-radius:999px;font-size:10px;font-weight:750;letter-spacing:.03em;}",
"#pane-fkiemke .fk-badge.verified,.fk-modal .fk-badge.verified{background:#d1faf3;color:#0f766e;} #pane-fkiemke .fk-badge.processing,.fk-modal .fk-badge.processing{background:#fdecd0;color:#b45309;} #pane-fkiemke .fk-badge.pending,.fk-modal .fk-badge.pending{background:color-mix(in srgb,var(--muted,#9ca3af) 22%,transparent);color:var(--muted,#6b7280);}",
"#pane-fkiemke .fk-state{padding:48px 20px;text-align:center;color:var(--muted,#6b7280);}",
"#pane-fkiemke .fk-spin{width:30px;height:30px;border:3px solid var(--line,#d5dbe4);border-top-color:var(--accent,#2563eb);border-radius:50%;margin:0 auto 14px;animation:fk-sp .8s linear infinite;}",
"@keyframes fk-sp{to{transform:rotate(360deg)}}",
/* ===== MODAL ===== */
".fk-modal{display:none;position:fixed;inset:0;z-index:1250;align-items:center;justify-content:center;padding:clamp(10px,3vw,40px);background:rgba(17,24,39,.55);backdrop-filter:blur(6px);opacity:0;transition:opacity .22s;}",
".fk-modal.show{opacity:1;} .fk-modal .fk-mbox{background:var(--panel,#fff);color:var(--text,#1f2937);border-radius:18px;width:min(1400px,100%);max-height:92vh;display:flex;flex-direction:column;box-shadow:0 30px 70px rgba(16,24,40,.35);transform:translateY(14px) scale(.985);opacity:.6;transition:transform .26s,opacity .26s;overflow:hidden;}",
".fk-modal.show .fk-mbox{transform:none;opacity:1;}",
".fk-mhead{display:flex;align-items:center;gap:14px;padding:16px 20px;border-bottom:1px solid var(--line,#e8ecf1);}",
".fk-mtitle{font-weight:750;font-size:16px;} .fk-mtitle small{display:block;font-size:11.5px;color:var(--muted,#9ca3af);font-weight:500;margin-top:2px;}",
".fk-mclose{margin-left:auto;background:0;border:0;font-size:24px;line-height:1;cursor:pointer;color:var(--muted,#9ca3af);min-width:44px;min-height:44px;border-radius:10px;}",
".fk-mclose:hover{color:#ef4444;background:color-mix(in srgb,#ef4444 12%,transparent);}",
".fk-mctrl{display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:12px 20px;border-bottom:1px solid var(--line,#e8ecf1);}",
".fk-mpills{display:inline-flex;gap:2px;background:color-mix(in srgb,var(--muted,#9ca3af) 12%,transparent);border-radius:999px;padding:3px;}",
".fk-mpill{border:0;background:transparent;padding:7px 16px;border-radius:999px;font-weight:650;font-size:12.5px;cursor:pointer;color:var(--muted,#6b7280);min-height:36px;}",
".fk-mpill.active{background:var(--accent,#1f2937);color:#fff;}",
".fk-msearch{flex:1 1 200px;max-width:320px;padding:9px 12px;border:1px solid var(--line,#d5dbe4);border-radius:9px;background:var(--panel,#fff);color:var(--text,#1f2937);font-size:12.5px;min-height:38px;}",
".fk-mwrap{overflow:auto;-webkit-overflow-scrolling:touch;flex:1;}",
".fk-mtbl{border-collapse:separate;border-spacing:0;font-size:12.5px;width:100%;min-width:900px;}",
".fk-mtbl th,.fk-mtbl td{padding:9px 12px;border-bottom:1px solid var(--line,#eef1f5);white-space:nowrap;text-align:left;vertical-align:top;}",
".fk-mtbl thead th{position:sticky;top:0;z-index:3;background:var(--accent,#1f2937);color:#fff;font-size:10.5px;font-weight:650;text-transform:uppercase;letter-spacing:.03em;}",
/* cột đầu ghim trái */
".fk-mtbl th.stick,.fk-mtbl td.stick{position:sticky;left:0;z-index:2;background:var(--panel,#fff);}",
".fk-mtbl thead th.stick{z-index:4;background:var(--accent,#1f2937);}",
".fk-mtbl tbody tr:hover td{background:color-mix(in srgb,var(--accent,#2563eb) 6%,transparent);}",
".fk-mtbl tbody tr:hover td.stick{background:color-mix(in srgb,var(--accent,#2563eb) 10%,var(--panel,#fff));}",
".fk-mtbl .num{text-align:right;font-variant-numeric:tabular-nums;}",
".fk-mtbl .pn{white-space:normal;max-width:260px;line-height:1.35;color:var(--muted,#6b7280);}",   // Chỉ thị 2: tên SP rớt dòng
".fk-mtbl .loc{font-family:ui-monospace,Consolas,monospace;color:#0f9488;}",
".fk-link{color:#2563eb;text-decoration:none;font-weight:600;display:inline-flex;align-items:center;gap:3px;}",
".fk-link:hover{text-decoration:underline;} .fk-link svg{width:11px;height:11px;opacity:.8;}",
/* CT3: deep-link WMS — xanh dương #0056b3, hover gạch chân, icon external 12px */
".wms-link{color:#0056b3;text-decoration:none;font-weight:600;display:inline-flex;align-items:center;gap:3px;}",
".wms-link:hover{text-decoration:underline;} .wms-link svg{width:12px;height:12px;opacity:.85;flex:none;}",
".fk-mtbl .skucell b{font-weight:700;} .fk-mtbl .skucell .pn{display:block;white-space:normal;max-width:300px;color:var(--muted,#6b7280);line-height:1.35;margin-top:2px;}",
".fk-mnote{padding:10px 20px;font-size:11.5px;color:var(--muted,#9ca3af);border-top:1px solid var(--line,#e8ecf1);}",
"#fkToast{position:fixed;left:50%;bottom:28px;transform:translate(-50%,16px);background:#111827;color:#fff;padding:12px 20px;border-radius:12px;font-size:13px;font-weight:600;box-shadow:0 24px 60px rgba(16,24,40,.35);opacity:0;pointer-events:none;z-index:1400;max-width:92vw;text-align:center;transition:opacity .25s,transform .25s;}",
"#fkToast.show{opacity:1;transform:translate(-50%,0);} #fkToast.ok{background:#0f766e;} #fkToast.warn{background:#b45309;} #fkToast.err{background:#b42318;}",
].join("\n");

/* ===== KHUNG ===== */
var KHUNG =
'<div class="fk-top">' +
'  <div class="fk-whsel"><label for="fkWh">Kho kiểm kê</label><select id="fkWh" class="fk-wh" aria-label="Chọn kho kiểm kê"></select></div>' +
'  <div class="fk-whsel fk-rangesel"><label for="fkRange">Khoảng ngày</label><select id="fkRange" class="fk-wh" aria-label="Lọc theo khoảng ngày">' +
'    <option value="all">Tất cả</option><option value="today">Hôm nay</option><option value="7d">7 ngày qua</option><option value="30d">30 ngày qua</option></select></div>' +
'  <span id="fkInfo" class="fk-info"></span>' +
'  <button id="fkSync" class="fk-sync" onclick="FKIEMKE.sync()"><span>Đồng bộ WMS (test 2 trang/kho)</span><small class="ts" id="fkSyncTs"></small></button>' +
'</div>' +
'<div id="fkDash"></div>' +
'<div id="fkState" class="fk-state"><div class="fk-spin"></div>Đang tải dữ liệu kiểm kê…</div>';

var MODAL =
'<div id="fkModal" class="fk-modal">' +
'  <div class="fk-mbox">' +
'    <div class="fk-mhead"><div class="fk-mtitle" id="fkMTitle"></div>' +
'      <button class="fk-mclose" onclick="FKIEMKE.closeModal()" aria-label="Đóng">&times;</button></div>' +
'    <div class="fk-mctrl">' +
'      <div class="fk-mpills"><button class="fk-mpill active" data-mtab="sku" onclick="FKIEMKE.setTab(\'sku\')">Theo SKU</button>' +
'        <button class="fk-mpill" data-mtab="loc" onclick="FKIEMKE.setTab(\'loc\')">Theo Location</button></div>' +
'      <input id="fkMSearch" class="fk-msearch" placeholder="Tìm trong kết quả…" oninput="FKIEMKE.msearch()">' +
'    </div>' +
'    <div class="fk-mwrap" id="fkMWrap"></div>' +
'    <div class="fk-mnote" id="fkMNote"></div>' +
'  </div>' +
'</div>';

/* ===== ĐỌC DỮ LIỆU ===== */
function loadData(){
  _giaLap = false;
  $id("fkState").style.display = "block"; $id("fkState").innerHTML = '<div class="fk-spin"></div>Đang tải dữ liệu kiểm kê…';
  $id("fkDash").innerHTML = "";
  window.fkgv_data = function(resp){
    try{
      if (resp.status === "error") throw 0;
      var rows = ((resp.table && resp.table.rows) || []).map(function(r){ return (r.c || []).map(function(c){ return c ? (c.v == null ? "" : c.v) : ""; }); });
      if (!rows.length) throw 0;
      napSheet(rows);
    }catch(e){ hienTrong(); }
  };
  var url = "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/gviz/tq?tqx=out:json;responseHandler:fkgv_data&sheet=" + encodeURIComponent(TAB) + "&headers=1";
  var old = $id("fk_sc"); if (old) old.remove();
  var sc = document.createElement("script"); sc.id = "fk_sc"; sc.src = url; sc.onerror = function(){ hienTrong(); };
  document.body.appendChild(sc); loadTs();
}
function loadTs(){
  window.fkgv_ts = function(resp){ var ts = resp && resp.status === "success" ? Number(resp.ts || 0) : 0; if (ts > 0){ _lastSyncMs = ts; $id("fkSyncTs").textContent = "Mới nhất: " + p2(new Date(ts).getHours()) + ":" + p2(new Date(ts).getMinutes()) + " " + p2(new Date(ts).getDate()) + "/" + p2(new Date(ts).getMonth() + 1); } };
  var sc = document.createElement("script"); sc.src = APPSCRIPT_URL + "?action=lastSync&tab=" + encodeURIComponent(TAB) + "&callback=fkgv_ts";
  document.body.appendChild(sc); setTimeout(function(){ sc.remove(); }, 15000);
}
/* Sheet 9 cột -> object; trường WMS chưa capture để trống (hiện "—"); giữ updatedAt (dùng tính Velocity/Trend) */
function napSheet(rows){
  ROWS = rows.filter(function(r){ return String(r[0] || "") !== ""; }).map(function(r, i){
    var inv = Number(r[4]) || 0, cnt = (r[5] === "" || r[5] == null) ? null : Number(r[5]) || 0;
    var dl = (r[6] === "" || r[6] == null) ? (cnt == null ? 0 : cnt - inv) : Number(r[6]) || 0;
    return { id: "", no: i + 1, sku: String(r[0]), pn: String(r[1] || ""), loc: String(r[2] || ""), wh: String(r[3] || ""),
      inv: inv, cnt: cnt, diffLoc: dl, req: "", source: "", type: "", priority: "", rfid: "", assignTo: "", countedBy: "",
      updatedAt: String(r[8] || ""), planDate: "",
      uom: "", price: null, subStatus: "" };   // CT5: chỗ trống chờ endpoint kiểm kê thật
  });
  khoiTao();
}
function hienTrong(){ _giaLap = true; ROWS = MOCK.slice(); khoiTao(); toast("Sheet " + TAB + " chưa có dữ liệu — hiển thị " + MOCK.length + " dòng GIẢ LẬP.", "warn"); }
function khoiTao(){
  WHS = []; ROWS.forEach(function(r){ if (r.wh && WHS.indexOf(r.wh) < 0) WHS.push(r.wh); });
  var uu = function(w){ return /MTG/i.test(w) ? 0 : /GARMENT/i.test(w) ? 1 : 2; };
  WHS.sort(function(a, b){ return uu(a) - uu(b) || a.localeCompare(b); });
  if (!selWh || WHS.indexOf(selWh) < 0) selWh = WHS[0] || "";
  $id("fkWh").innerHTML = WHS.map(function(w){ return '<option value="' + esc(w) + '"' + (w === selWh ? " selected" : "") + ">" + esc(w) + "</option>"; }).join("");
  $id("fkState").style.display = "none";
  veLai();
}
function rowsKho(){ return ROWS.filter(function(r){ return r.wh === selWh; }); }
function diffBySku(rows){ var m = {}; rows.forEach(function(r){ m[r.sku] = (m[r.sku] || 0) + r.diffLoc; }); return m; }
/* CT4: khoảng ngày (neo theo refDay = ngày mới nhất trong dữ liệu). Dùng cho CẢ dashboard + modal. */
function trongKhoang(r){
  if (dateRange === "all") return true;
  var dk = dayKey(parseDate(r.updatedAt)); if (isNaN(dk)) return false;
  if (dateRange === "today") return dk === refDay;
  if (dateRange === "7d") return dk >= refDay - 6;
  if (dateRange === "30d") return dk >= refDay - 29;
  return true;
}
function rowsBase(){ return rowsKho().filter(trongKhoang); }

/* ===== DASHBOARD (Chỉ thị 1) ===== */
function veLai(){
  // refDay = ngày mới nhất trong TOÀN kho (mốc "hôm nay" theo dữ liệu) — tính TRƯỚC khi lọc khoảng
  refDay = 0; rowsKho().forEach(function(r){ var d = dayKey(parseDate(r.updatedAt)); if (!isNaN(d) && d > refDay) refDay = d; });
  if (!refDay) refDay = Math.floor(Date.now() / 86400000);
  var rows = rowsBase();   // CT4: dashboard phản ứng ngay theo khoảng ngày

  // Velocity: đếm hôm nay vs hôm qua (dòng đã có count & updatedAt thuộc ngày đó)
  var demToday = 0, demYest = 0;
  rows.forEach(function(r){ if (r.cnt == null) return; var d = dayKey(parseDate(r.updatedAt)); if (d === refDay) demToday++; else if (d === refDay - 1) demYest++; });
  var delta = demYest ? ((demToday - demYest) / demYest * 100) : (demToday ? 100 : 0);
  var deltaTxt = demYest ? ((delta >= 0 ? "▲ +" : "▼ ") + Math.abs(delta).toFixed(0) + "% so với hôm qua") : (demToday ? "▲ mới có dữ liệu hôm nay" : "—");
  var deltaCls = !demYest ? "fk-flat" : delta > 0 ? "fk-up" : delta < 0 ? "fk-down" : "fk-flat";

  // Status
  var nV = 0, nP = 0, nPd = 0;
  rows.forEach(function(r){ var s = statusOf(r); if (s === "VERIFIED") nV++; else if (s === "PROCESSING") nP++; else nPd++; });
  var tot = rows.length || 1, pV = nV / tot * 100, pP = nP / tot * 100;

  // Top SKU theo |diff by sku|
  var dS = diffBySku(rows), pnBy = {}; rows.forEach(function(r){ if (!pnBy[r.sku]) pnBy[r.sku] = r.pn; });
  var topSku = Object.keys(dS).map(function(k){ return { sku: k, pn: pnBy[k], d: dS[k] }; })
    .filter(function(x){ return x.d !== 0; }).sort(function(a, b){ return Math.abs(b.d) - Math.abs(a.d); }).slice(0, 10);

  // Top Location theo SỐ phiếu lệch
  var locAgg = {}; rows.forEach(function(r){ if (r.diffLoc === 0) return; var g = locAgg[r.loc] || (locAgg[r.loc] = { n: 0, d: 0 }); g.n++; g.d += r.diffLoc; });
  var topLoc = Object.keys(locAgg).map(function(k){ return { loc: k, n: locAgg[k].n, d: locAgg[k].d }; }).sort(function(a, b){ return b.n - a.n; }).slice(0, 5);

  // 7-ngày: số dòng đếm mỗi ngày
  var days = [], maxD = 1;
  for (var i = 6; i >= 0; i--){ var dk = refDay - i, c = 0; rows.forEach(function(r){ if (r.cnt != null && dayKey(parseDate(r.updatedAt)) === dk) c++; }); days.push({ dk: dk, c: c }); if (c > maxD) maxD = c; }

  var miniSku = topSku.length ? topSku.map(function(x, i){ var cl = x.d < 0 ? "d-am" : "d-duong";
    return '<tr data-drill="sku" data-v="' + esc(x.sku) + '"><td class="rank">' + (i + 1) + '</td><td><b>' + esc(x.sku) + '</b></td><td class="pn">' + esc(x.pn) + '</td><td class="num ' + cl + '">' + (x.d > 0 ? "+" : "") + nf(x.d) + '</td></tr>'; }).join("") : '<tr><td colspan="4" style="color:var(--muted);padding:14px;text-align:center">Không có SKU lệch</td></tr>';
  var miniLoc = topLoc.length ? topLoc.map(function(x, i){ return '<tr data-drill="loc" data-v="' + esc(x.loc) + '"><td class="rank">' + (i + 1) + '</td><td class="fk-loc">' + esc(x.loc) + '</td><td class="num">' + x.n + ' phiếu</td><td class="num ' + (x.d < 0 ? "d-am" : x.d > 0 ? "d-duong" : "d-khop") + '">' + (x.d > 0 ? "+" : "") + nf(x.d) + '</td></tr>'; }).join("") : '<tr><td colspan="4" style="color:var(--muted);padding:14px;text-align:center">Không có location lệch</td></tr>';
  var chart = days.map(function(d){ var h = Math.round(d.c / maxD * 100); return '<div class="fk-col" data-drill="day" data-v="' + d.dk + '" title="' + fmtDMY(d.dk) + ': ' + d.c + ' dòng"><div class="fk-colval">' + (d.c || "") + '</div><div class="fk-colbar" style="height:' + h + '%"></div><div class="fk-collab">' + fmtDMY(d.dk) + '</div></div>'; }).join("");

  $id("fkDash").innerHTML =
    '<div class="fk-grid">' +
    '<div class="fk-card click fk-c-vel" data-drill="today"><div class="fk-h">Tốc độ kiểm đếm</div>' +
      '<div class="fk-big">' + nf(demToday) + '</div><div class="fk-sub ' + deltaCls + '">' + deltaTxt + '</div>' +
      '<div class="fk-info" style="margin-top:8px">SKU/Location đã đếm ngày ' + fmtDMY(refDay) + '</div></div>' +
    '<div class="fk-card fk-c-sta"><div class="fk-h">Tiến độ xác minh</div>' +
      '<div class="fk-bar"><i class="v" style="width:' + pV.toFixed(1) + '%"></i><i class="p" style="width:' + pP.toFixed(1) + '%"></i></div>' +
      '<div class="fk-leg">' +
        '<span data-drill="status" data-v="VERIFIED"><i class="dot" style="background:#14b8a6"></i>VERIFIED <b>' + nf(nV) + '</b> · ' + pV.toFixed(0) + '%</span>' +
        '<span data-drill="status" data-v="PROCESSING"><i class="dot" style="background:#f59e0b"></i>PROCESSING <b>' + nf(nP) + '</b> · ' + pP.toFixed(0) + '%</span>' +
        (nPd ? '<span data-drill="status" data-v="PENDING"><i class="dot" style="background:#9ca3af"></i>PENDING <b>' + nf(nPd) + '</b></span>' : "") +
      '</div></div>' +
    '<div class="fk-card fk-c-trend"><div class="fk-h">Số dòng đếm · 7 ngày</div><div class="fk-chart">' + chart + '</div></div>' +
    '<div class="fk-card fk-c-sku"><div class="fk-h">Top SKU lệch nhiều nhất</div><div class="fk-mini"><table><tbody>' + miniSku + '</tbody></table></div></div>' +
    '<div class="fk-card fk-c-loc"><div class="fk-h">Top Location nhiều phiếu lệch</div><div class="fk-mini"><table><tbody>' + miniLoc + '</tbody></table></div></div>' +
    '</div>';
  $id("fkInfo").innerHTML = "· " + nf(rows.length) + " dòng · kho " + esc(selWh) + (_giaLap ? ' · <span class="fk-gl">⚠ GIẢ LẬP</span>' : "");
}

/* ===== MODAL (Chỉ thị 2+3) ===== */
function locFiltered(){
  var rows = rowsBase();   // CT4: modal cũng tôn trọng khoảng ngày đang chọn
  var f = mFilter;
  if (f.t === "today") return rows.filter(function(r){ return dayKey(parseDate(r.updatedAt)) === refDay; });
  if (f.t === "day") return rows.filter(function(r){ return dayKey(parseDate(r.updatedAt)) === Number(f.v); });
  if (f.t === "status") return rows.filter(function(r){ return statusOf(r) === f.v; });
  if (f.t === "sku") return rows.filter(function(r){ return r.sku === f.v; });
  if (f.t === "loc") return rows.filter(function(r){ return r.loc === f.v; });
  return rows;
}
function openModal(f, label){
  mFilter = f || { t: "all" }; mLabel = label || "Tất cả"; mTab = "sku";
  $id("fkMSearch").value = "";
  document.querySelectorAll(".fk-mpill").forEach(function(x){ x.classList.toggle("active", x.getAttribute("data-mtab") === "sku"); });
  renderModal();
  var m = $id("fkModal"); m.style.display = "flex"; requestAnimationFrame(function(){ m.classList.add("show"); });
}
function closeModal(){ var m = $id("fkModal"); m.classList.remove("show"); setTimeout(function(){ m.style.display = "none"; }, 240); }
function setTab(t){ mTab = t; document.querySelectorAll(".fk-mpill").forEach(function(x){ x.classList.toggle("active", x.getAttribute("data-mtab") === t); }); renderModal(); }
function renderModal(){
  var base = locFiltered();
  var q = ($id("fkMSearch").value || "").toLowerCase().trim();
  var dS = diffBySku(rowsBase());
  var dcell = function(v){ return '<td class="num ' + (v < 0 ? "d-am" : v > 0 ? "d-duong" : "d-khop") + '">' + (v > 0 ? "+" : "") + nf(v) + "</td>"; };
  var tien = function(v){ return '<td class="num ' + (v < 0 ? "d-am" : v > 0 ? "d-duong" : "d-khop") + '">' + fmtTien(v) + "</td>"; };
  var html, n;
  if (mTab === "sku"){
    // CT2: BỎ cột Warehouse (đã có ở tiêu đề). CT5: thêm UOM, Discrepancy Value, Sub-status. CT3: SKU deep-link.
    var rows = base.filter(function(r){ return !q || (r.sku + " " + r.pn + " " + r.loc + " " + r.req + " " + r.assignTo).toLowerCase().indexOf(q) >= 0; });
    n = rows.length;
    var body = rows.slice(0, MODAL_CAP).map(function(r){
      var st = statusOf(r), ds = dS[r.sku] || 0;
      var disc = r.price == null ? null : r.diffLoc * r.price;
      return "<tr>" +
        '<td class="stick">' + (r.id ? esc(r.id) : "—") + "</td>" +
        '<td class="skucell">' + wmsLink(r.sku, "sku") + '<small class="pn">' + esc(r.pn) + "</small></td>" +
        dcell(r.diffLoc) + dcell(ds) +
        '<td class="num">' + nf(r.inv) + '</td><td class="num">' + (r.cnt == null ? "—" : nf(r.cnt)) + "</td>" +
        "<td>" + (r.uom ? esc(r.uom) : "—") + "</td>" + tien(disc) +
        "<td>" + (r.no || "—") + "</td><td>" + (r.req ? esc(r.req) : "—") + "</td><td>" + (r.type ? esc(r.type) : "—") + "</td>" +
        "<td>" + (r.source ? esc(r.source) : "—") + "</td><td>" + (r.priority ? esc(r.priority) : "—") + "</td>" +
        "<td>" + (r.rfid ? esc(r.rfid) : "—") + "</td><td>" + (r.assignTo ? esc(r.assignTo) : "—") + "</td>" +
        "<td>" + (r.countedBy ? esc(r.countedBy) : "—") + "</td><td>" + fmtDate(r.updatedAt) + "</td>" +
        "<td>" + fmtDate(r.planDate, true) + "</td><td><span class='fk-badge " + badgeCls(st) + "'>" + st + "</span></td>" +
        "<td>" + (r.subStatus ? esc(r.subStatus) : "—") + "</td></tr>";
    }).join("");
    html = '<table class="fk-mtbl"><thead><tr><th class="stick">ID</th><th>SKU</th><th class="num">Diff by location</th>' +
      '<th class="num">Diff by SKU</th><th class="num">Inventory</th><th class="num">Quantity count</th><th>UOM</th><th class="num">Discrepancy Value</th>' +
      '<th>No</th><th>Request code</th><th>Type</th><th>Source code</th><th>Priority</th><th>Is Required RFID</th>' +
      '<th>Assign to</th><th>Counted by</th><th>Updated At</th><th>Plan date</th><th>Status</th><th>Sub-status</th></tr></thead><tbody>' +
      (body || '<tr><td colspan="20" style="text-align:center;color:var(--muted);padding:24px">Không có dòng phù hợp</td></tr>') + "</tbody></table>";
  } else {
    // Gom theo Location. CT2: bỏ Warehouse. CT5: Discrepancy + Sub-status. CT3: Location deep-link.
    var g = {}; base.forEach(function(r){ var o = g[r.loc] || (g[r.loc] = { loc: r.loc, d: 0, disc: 0, hasP: false, rep: r, n: 0 }); o.d += r.diffLoc; if (r.price != null){ o.disc += r.diffLoc * r.price; o.hasP = true; } o.n++; });
    var arr = Object.keys(g).map(function(k){ return g[k]; }).filter(function(o){ return !q || (o.loc + " " + o.rep.req + " " + o.rep.assignTo).toLowerCase().indexOf(q) >= 0; }).sort(function(a, b){ return Math.abs(b.d) - Math.abs(a.d); });
    n = arr.length;
    var body2 = arr.slice(0, MODAL_CAP).map(function(o){
      var r = o.rep, st = o.d === 0 ? (r.cnt == null ? "PENDING" : "VERIFIED") : "PROCESSING";
      return "<tr>" +
        '<td class="stick">' + (r.id ? esc(r.id) : "—") + "</td><td>" + (r.req ? esc(r.req) : "—") + "</td>" +
        "<td>" + (r.source ? esc(r.source) : "—") + "</td><td>" + (r.type ? esc(r.type) : "—") + "</td>" +
        "<td>" + wmsLink(o.loc, "location") + "</td><td>" + (r.priority ? esc(r.priority) : "—") + "</td>" +
        dcell(o.d) + tien(o.hasP ? o.disc : null) +
        "<td>" + (r.assignTo ? esc(r.assignTo) : "—") + "</td><td>" + (r.countedBy ? esc(r.countedBy) : "—") + "</td>" +
        "<td>" + fmtDate(r.updatedAt) + "</td><td>" + fmtDate(r.planDate, true) + "</td>" +
        "<td><span class='fk-badge " + badgeCls(st) + "'>" + st + "</span></td><td>" + (r.subStatus ? esc(r.subStatus) : "—") + "</td></tr>";
    }).join("");
    html = '<table class="fk-mtbl"><thead><tr><th class="stick">ID</th><th>Request code</th><th>Source code</th><th>Type</th>' +
      '<th>Location</th><th>Priority</th><th class="num">Diff</th><th class="num">Discrepancy Value</th><th>Assign to</th><th>Counted by</th><th>Updated At</th><th>Plan date</th><th>Status</th><th>Sub-status</th></tr></thead><tbody>' +
      (body2 || '<tr><td colspan="14" style="text-align:center;color:var(--muted);padding:24px">Không có dòng phù hợp</td></tr>') + "</tbody></table>";
  }
  $id("fkMWrap").innerHTML = html;
  $id("fkMTitle").innerHTML = "Chi tiết kiểm kê — " + esc(selWh) + "<small>Lọc: " + esc(mLabel) + " · " + (mTab === "sku" ? "theo SKU" : "theo Location") + "</small>";
  $id("fkMNote").textContent = n > MODAL_CAP ? ("Hiển thị " + nf(MODAL_CAP) + " / " + nf(n) + " dòng — tìm kiếm để thu hẹp.") : (nf(n) + " dòng.");
}

/* ===== SYNC / TOAST / INIT ===== */
function sync(){
  if (_syncing) return; _syncing = true;
  var btn = $id("fkSync"); btn.disabled = true; btn.firstElementChild.textContent = "Đang đồng bộ WMS…";
  var ac = new AbortController(), to = setTimeout(function(){ ac.abort(); }, FETCH_TIMEOUT_MS);
  fetch(APPSCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "force_sync_kiemke" }), signal: ac.signal })
    .then(function(r){ return r.json(); })
    .then(function(j){
      if (j.status === "success"){ toast("Đã đồng bộ kiểm kê (" + nf(j.written || 0) + " dòng).", "ok"); loadData(); }
      else if (j.code === 401) toast("Token WMS đã hết hạn. Đang chờ luồng chạy ngầm cập nhật Token mới.", "err");
      else if (j.code === 429) toast(j.message || "Đang trong thời gian chờ.", "warn");
      else if (j.code === 502) toast("Máy chủ Google không gọi được WMS (firewall). Đồng bộ từ máy trạm.", "err");
      else toast("Đồng bộ thất bại: " + (j.message || "?"), "err");
    })
    .catch(function(e){ toast(e.name === "AbortError" ? "Quá 4 phút — đã ngắt." : "Không gọi được máy chủ (" + e.message + ").", "err"); })
    .finally(function(){ clearTimeout(to); _syncing = false; btn.disabled = false; btn.firstElementChild.textContent = "Đồng bộ WMS (test 2 trang/kho)"; });
}
function toast(msg, type){ var el = $id("fkToast"); el.className = type || ""; el.textContent = msg; requestAnimationFrame(function(){ el.classList.add("show"); }); clearTimeout(toast._t); toast._t = setTimeout(function(){ el.classList.remove("show"); }, 6000); }

function init(pane){
  PANE = pane;
  if (!_boot){
    _boot = true;
    var style = document.createElement("style"); style.id = "fkStyle"; style.textContent = CSS; document.head.appendChild(style);
    pane.innerHTML = KHUNG;
    var ov = document.createElement("div"); ov.id = "fkOverlays"; ov.innerHTML = MODAL + '<div id="fkToast"></div>'; document.body.appendChild(ov);
    $id("fkWh").addEventListener("change", function(e){ selWh = e.target.value; veLai(); });
    // CT4: đổi khoảng ngày -> dashboard + modal (nếu đang mở) phản ứng ngay
    $id("fkRange").addEventListener("change", function(e){ dateRange = e.target.value; veLai(); if ($id("fkModal").classList.contains("show")) renderModal(); });
    // Drill-down: click khối/dòng -> mở modal đã áp filter
    pane.addEventListener("click", function(e){
      var el = e.target.closest("[data-drill]"); if (!el) return;
      var t = el.getAttribute("data-drill"), v = el.getAttribute("data-v");
      if (t === "today") openModal({ t: "today" }, "Đã đếm ngày " + fmtDMY(refDay));
      else if (t === "status") openModal({ t: "status", v: v }, "Trạng thái " + v);
      else if (t === "sku") openModal({ t: "sku", v: v }, "SKU " + v);
      else if (t === "loc") openModal({ t: "loc", v: v }, "Location " + v);
      else if (t === "day") openModal({ t: "day", v: v }, "Ngày " + fmtDMY(Number(v)));
    });
    $id("fkModal").addEventListener("click", function(e){ if (e.target === $id("fkModal")) closeModal(); });
    document.addEventListener("keydown", function(e){ if (e.key === "Escape" && $id("fkModal") && $id("fkModal").classList.contains("show")) closeModal(); });
    loadData();
    return;
  }
  if (!ROWS.length) loadData(); else loadTs();
}

window.FKIEMKE = {
  init: init, sync: sync, closeModal: closeModal, setTab: setTab,
  msearch: function(){ clearTimeout(_deb); _deb = setTimeout(renderModal, 130); },
};
})();
