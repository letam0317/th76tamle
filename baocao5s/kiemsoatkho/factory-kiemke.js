/**
 * ============================================================================
 *  factory-kiemke.js — PHYSICAL COUNT TRACKING DASHBOARD (Factory ▸ Kiểm kê)
 * ============================================================================
 *  CT1 Master filter (sticky): pill SKU/Location · dropdown Kho · Category (suy từ
 *      tên SP: đoạn trước dấu "/") · khoảng ngày.
 *  CT2 Hero: progress bar lớn, %=counted/total, 3 màu VERIFIED(xanh)/PROCESSING(vàng)/
 *      chưa đếm(xám), số "75% (a/b)".
 *  CT3 Widgets grid: Discrepancy (âm/dương), Velocity, Trend 7 ngày, Top SKU, Top Location;
 *      mỗi widget "Xem chi tiết" -> modal bảng chi tiết.
 *  CT4 Deep-link WMS mọi mã (wms-link, icon external, target _blank); responsive stack;
 *      CountUp số KPI; đổi filter fade mờ (không chớp).
 *  Data trường WMS chưa capture -> "—" (mock điền đủ). Cô lập: closure + 1 global FKIEMKE.
 * ============================================================================
 */
(function(){
"use strict";
if (window.FKIEMKE) return;

var SHEET_ID = "1eY_oo9fAvWCTXp24x-Z0FXq9mp_jJPlTHg09qdemETs";
var TAB = "kiemke-material";
var APPSCRIPT_URL = "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
var MODAL_CAP = 400, FETCH_TIMEOUT_MS = 4 * 60 * 1000;
var ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M7 17L17 7M17 7H9M17 7V15"/></svg>';

/* ===== MOCK (đủ trường WMS) ===== */
var MOCK = (function(){
  var A = [
    ["INV-26001","422490737","Vải Chính/CMTS0028/82.6% Cotton/205gsm/Trắng/XL","F1-A2-01-03","WH - MATERIAL - MTG",120,120,"RQ-5521","SRC-01","Định kỳ","Cao","Có","Nguyễn Văn A","Lê Thị B","2026-07-15 09:10","2026-07-16"],
    ["INV-26002","422490812","Vải Chính/CMTS0031/100% Cotton Twill/240gsm/Đen","F1-A3-02-01","WH - MATERIAL - MTG",300,288,"RQ-5521","SRC-01","Định kỳ","Cao","Không","Nguyễn Văn A","Lê Thị B","2026-07-15 09:22","2026-07-16"],
    ["INV-26003","422491055","Dây Kéo/YKK 5VS/56cm/Đồng rêu","F2-B1-04-02","WH - MATERIAL - MTG",850,862,"RQ-5521","SRC-01","Trung bình","Không","Trần C","Phạm D","2026-07-14 15:02","2026-07-15"],
    ["INV-26004","422491203","Phụ Liệu/Nút dập 15mm/Antique Brass","F2-B2-01-05","WH - MATERIAL - MTG",40,null,"RQ-5530","SRC-02","Đột xuất","Thấp","Không","Trần C","","2026-07-13 11:20","2026-07-15"],
    ["INV-26005","422491374","Chỉ May/Coats Epic 120/5000m/Trắng ngà","F3-C1-02-02","WH - MATERIAL - MTG",215,215,"RQ-5521","SRC-01","Trung bình","Không","Nguyễn Văn A","Lê Thị B","2026-07-12 08:40","2026-07-13"],
    ["INV-26006","422491055","Dây Kéo/YKK 5VS/56cm/Đồng rêu","F2-B1-05-01","WH - MATERIAL - MTG",120,118,"RQ-5521","SRC-01","Trung bình","Không","Trần C","Phạm D","2026-07-11 14:05","2026-07-12"],
    ["INV-26007","422501854","Vải Chính/Bag 12/Cotton Canvas","F0-A1-01-01","WH - MATERIAL - GARMENT",500,495,"RQ-6012","SRC-03","Định kỳ","Cao","Có","Vũ E","Đỗ F","2026-07-15 10:01","2026-07-16"],
    ["INV-26008","422501920","Vải Lót/POLY210T/Xám tro/Khổ 1m5","F0-A2-03-04","WH - MATERIAL - GARMENT",160,171,"RQ-6012","SRC-03","Định kỳ","Trung bình","Không","Vũ E","Đỗ F","2026-07-15 10:15","2026-07-16"],
    ["INV-26009","422502088","Phụ Liệu/Khoá móc 25mm/Nickel mờ","F1-B4-02-02","WH - MATERIAL - GARMENT",720,720,"RQ-6012","SRC-03","Thấp","Không","Vũ E","Đỗ F","2026-07-14 16:30","2026-07-15"],
    ["INV-26010","422502135","Phụ Liệu/Webbing PP 30mm/Đen/Cuộn 50m","F1-B5-01-03","WH - MATERIAL - GARMENT",95,null,"RQ-6020","SRC-04","Đột xuất","Cao","Có","Bùi G","","2026-07-10 09:50","2026-07-12"],
    ["INV-26011","422502244","Nhãn Mác/Logo Bag12/Lô 2026","F2-C2-04-01","WH - MATERIAL - GARMENT",1000,998,"RQ-6012","SRC-03","Trung bình","Không","Vũ E","Đỗ F","2026-07-13 13:12","2026-07-14"],
    ["INV-26012","422501920","Vải Lót/POLY210T/Xám tro/Khổ 1m5","F0-A2-04-01","WH - MATERIAL - GARMENT",140,140,"RQ-6012","SRC-03","Trung bình","Không","Vũ E","Đỗ F","2026-07-09 11:00","2026-07-10"],
  ];
  return A.map(function(m, i){
    var inv = m[5], cnt = m[6], dl = cnt == null ? 0 : cnt - inv;
    return { no: i + 1, id: m[0], req: m[7], source: m[8], wh: m[4], sku: m[1], pn: m[2],
      category: m[2].split("/")[0].trim(), type: m[9], vat: m[11] === "Có" ? "Có" : "Không", priority: m[10],
      inv: inv, cnt: cnt, diffLoc: dl, diffSku: null, loc: m[3],
      assignTo: m[12], countedBy: m[13], countedDate: cnt == null ? "" : m[14], updatedAt: m[14], planDate: m[15] };
  });
})();

/* ===== STATE ===== */
var ROWS = [], WHS = [], selWh = "", selCat = "", dateRange = "all", mode = "sku", refDay = 0, _giaLap = false;
var _boot = false, _syncing = false, _lastSyncMs = 0, _deb = null, PANE = null;
var mFilter = { t: "all" }, mTab = "sku", mLabel = "";

var $id = function(s){ return document.getElementById(s); };
function nf(x){ return (x == null ? 0 : x).toLocaleString("en-US"); }
function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
function p2(n){ return (n < 10 ? "0" : "") + n; }
function parseDate(s){
  if (!s) return NaN; s = String(s);
  var m = s.match(/^Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?/); if (m) return Date.UTC(+m[1], +m[2], +m[3], +m[4] || 0, +m[5] || 0);
  m = s.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})/); if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  m = s.match(/(\d{4})-(\d{2})-(\d{2})/); if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return Date.UTC(+m[3], +m[2] - 1, +m[1]);
  var t = Date.parse(s); return isNaN(t) ? NaN : t;
}
function dayKey(ms){ return isNaN(ms) ? NaN : Math.floor(ms / 86400000); }
function fmtDMY(dk){ var d = new Date(dk * 86400000); return p2(d.getUTCDate()) + "/" + p2(d.getUTCMonth() + 1); }
function fmtDate(s, dateOnly){ var ms = parseDate(s); if (isNaN(ms)) return s ? esc(String(s)) : "—"; var d = new Date(ms); var o = p2(d.getUTCDate()) + "/" + p2(d.getUTCMonth() + 1) + "/" + d.getUTCFullYear(); return dateOnly ? o : o + " " + p2(d.getUTCHours()) + ":" + p2(d.getUTCMinutes()); }
function statusOf(r){ if (r.cnt == null) return "PENDING"; return r.diffLoc === 0 ? "VERIFIED" : "PROCESSING"; }
function badgeCls(st){ return st === "VERIFIED" ? "verified" : st === "PROCESSING" ? "processing" : "pending"; }
// CT1: Nhóm hàng dùng trực tiếp key Category; thiếu Category thì suy từ Product Name (đoạn trước "/")
function catOf(r){ var s = String(r.category || "").trim() || String(r.pn || "").split("/")[0].trim(); return s || "(Khác)"; }
// CT1: ngày đếm ưu tiên Counted date, fallback Updated At
function countMs(r){ var d = parseDate(r.countedDate); return isNaN(d) ? parseDate(r.updatedAt) : d; }
function wmsLink(text, tab){ if (text == null || text === "") return "—"; return '<a class="wms-link" href="https://wms.inshasaki.com/physical-count/result/list?current_tab=' + tab + '" target="_blank" rel="noopener">' + esc(text) + ICON + "</a>"; }

/* ===== CSS ===== */
var CSS = [
/* CT1 master filter sticky */
"#pane-fkiemke .fk-filter{position:sticky;top:0;z-index:20;display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;",
"  padding:14px 4px;margin:0 -4px 16px;background:color-mix(in srgb,var(--bg,#f5f7fa) 92%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--line,#e8ecf1);}",
"#pane-fkiemke .fk-fld{display:flex;flex-direction:column;gap:4px;} #pane-fkiemke .fk-fld label{font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--muted,#9ca3af);padding-left:2px;}",
"#pane-fkiemke select.fk-sel{appearance:none;-webkit-appearance:none;padding:9px 34px 9px 13px;min-height:42px;border:1.5px solid var(--line,#d0d7de);border-radius:10px;background:var(--panel,#fff);color:var(--text,#1f2937);font-size:13px;font-weight:650;cursor:pointer;min-width:180px;}",
"#pane-fkiemke select.fk-sel:focus{outline:0;border-color:var(--accent,#2563eb);}",
"#pane-fkiemke .fk-selwrap{position:relative;} #pane-fkiemke .fk-selwrap::after{content:'';position:absolute;right:14px;bottom:16px;width:7px;height:7px;border-right:2px solid var(--muted,#6b7280);border-bottom:2px solid var(--muted,#6b7280);transform:rotate(45deg);pointer-events:none;}",
"#pane-fkiemke .fk-modes{display:inline-flex;gap:2px;background:var(--panel,#fff);border:1.5px solid var(--line,#d0d7de);border-radius:999px;padding:3px;height:42px;}",
"#pane-fkiemke .fk-mode{border:0;background:transparent;padding:0 18px;border-radius:999px;font-weight:700;font-size:12.5px;cursor:pointer;color:var(--muted,#6b7280);transition:background .25s,color .2s;}",
"#pane-fkiemke .fk-mode.active{background:var(--accent,#1f2937);color:#fff;}",
"#pane-fkiemke .fk-sync{margin-left:auto;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:2px;min-height:42px;background:var(--accent,#1f2937);color:#fff;border:0;border-radius:10px;padding:6px 15px;font-size:12px;font-weight:650;cursor:pointer;}",
"#pane-fkiemke .fk-sync:disabled{opacity:.55;cursor:not-allowed;} #pane-fkiemke .fk-sync .ts{font-size:10px;font-weight:500;color:rgba(255,255,255,.72);white-space:nowrap;}",
"@media(max-width:760px){#pane-fkiemke .fk-filter{gap:10px;} #pane-fkiemke select.fk-sel{min-width:0;width:100%;} #pane-fkiemke .fk-fld{flex:1 1 45%;} #pane-fkiemke .fk-sync{margin-left:0;flex-basis:100%;min-height:46px;align-items:center;}}",
/* fade */
"#pane-fkiemke .fk-anim{animation:fk-in .4s cubic-bezier(.32,.72,0,1);} @keyframes fk-in{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:none;}}",
/* CT2 hero */
"#pane-fkiemke .fk-hero{background:var(--panel,#fff);border:1px solid var(--line,#e8ecf1);border-radius:18px;padding:22px 24px;margin-bottom:16px;}",
"#pane-fkiemke .fk-herotop{display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:10px;margin-bottom:14px;}",
"#pane-fkiemke .fk-hlabel{font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--muted,#9ca3af);}",
"#pane-fkiemke .fk-hpct{font-size:44px;font-weight:820;line-height:.9;font-variant-numeric:tabular-nums;color:var(--text,#1f2937);}",
"#pane-fkiemke .fk-hsub{font-size:13px;color:var(--muted,#6b7280);font-weight:600;}",
"#pane-fkiemke .fk-hbar{display:flex;height:16px;border-radius:999px;overflow:hidden;background:color-mix(in srgb,var(--muted,#9ca3af) 18%,transparent);}",
"#pane-fkiemke .fk-hbar i{display:block;height:100%;transition:width 1s cubic-bezier(.4,0,.2,1);}",
"#pane-fkiemke .fk-hbar .v{background:linear-gradient(90deg,#0f766e,#14b8a6);} #pane-fkiemke .fk-hbar .p{background:linear-gradient(90deg,#d97706,#f59e0b);}",
"#pane-fkiemke .fk-hleg{display:flex;flex-wrap:wrap;gap:16px;margin-top:12px;}",
"#pane-fkiemke .fk-hleg span{display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--text,#374151);cursor:pointer;padding:2px 4px;border-radius:6px;}",
"#pane-fkiemke .fk-hleg span:hover{background:color-mix(in srgb,var(--accent,#2563eb) 8%,transparent);}",
"#pane-fkiemke .fk-hleg .dot{width:10px;height:10px;border-radius:3px;} #pane-fkiemke .fk-hleg b{font-variant-numeric:tabular-nums;}",
/* CT3 widgets grid */
"#pane-fkiemke .fk-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:14px;}",
"#pane-fkiemke .fk-w{background:var(--panel,#fff);border:1px solid var(--line,#e8ecf1);border-radius:16px;padding:16px 18px;display:flex;flex-direction:column;}",
"#pane-fkiemke .fk-w-disc{grid-column:span 4;} #pane-fkiemke .fk-w-vel{grid-column:span 4;} #pane-fkiemke .fk-w-trend{grid-column:span 4;} #pane-fkiemke .fk-w-sku{grid-column:span 6;} #pane-fkiemke .fk-w-loc{grid-column:span 6;}",
"@media(max-width:900px){#pane-fkiemke .fk-grid{grid-template-columns:1fr;} #pane-fkiemke .fk-w{grid-column:1/-1 !important;}}",
"#pane-fkiemke .fk-wh{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;}",
"#pane-fkiemke .fk-wt{font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--muted,#9ca3af);}",
"#pane-fkiemke .fk-see{background:transparent;border:1px solid var(--line,#d0d7de);color:var(--accent,#2563eb);border-radius:8px;padding:4px 10px;font-size:11px;font-weight:650;cursor:pointer;}",
"#pane-fkiemke .fk-see:hover{background:color-mix(in srgb,var(--accent,#2563eb) 8%,transparent);}",
/* CT2: Card Chênh lệch — 2 hàng ngang space-between (thay 2 ô màu khổng lồ) */
"#pane-fkiemke .fk-discrows{display:flex;flex-direction:column;gap:12px;flex:1;justify-content:center;}",
"#pane-fkiemke .fk-discrows .row{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding-bottom:12px;border-bottom:1px solid var(--line,#eef1f5);}",
"#pane-fkiemke .fk-discrows .row:last-child{border-bottom:0;padding-bottom:0;}",
"#pane-fkiemke .fk-discrows .lbl{font-size:13px;color:var(--text,#374151);} #pane-fkiemke .fk-discrows .lbl b{font-size:22px;font-weight:800;margin-right:5px;font-variant-numeric:tabular-nums;}",
"#pane-fkiemke .fk-discrows .val{font-size:12.5px;font-weight:700;white-space:nowrap;}",
/* CT2: Card Tốc độ — căn giữa dọc, số cực đại + badge delta */
"#pane-fkiemke .fk-velbody{flex:1;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;gap:10px;}",
"#pane-fkiemke .fk-velnum{font-size:3.5rem;font-weight:700;line-height:1;font-variant-numeric:tabular-nums;color:var(--text,#1f2937);}",
"#pane-fkiemke .fk-velbadge{padding:5px 13px;border-radius:999px;font-size:12px;font-weight:700;}",
"#pane-fkiemke .fk-velbadge.fk-up{background:#d1faf3;color:#0f766e;} #pane-fkiemke .fk-velbadge.fk-down{background:#fdecea;color:#b42318;} #pane-fkiemke .fk-velbadge.fk-flat{background:color-mix(in srgb,var(--muted,#9ca3af) 20%,transparent);color:var(--muted,#6b7280);}",
/* CT4: empty-state tích cực */
"#pane-fkiemke .empty-state{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:26px 14px;text-align:center;min-height:150px;}",
"#pane-fkiemke .empty-state svg{width:42px;height:42px;} #pane-fkiemke .empty-state p{margin:0;color:var(--muted,#9ca3af);font-style:italic;font-size:13px;}",
"#pane-fkiemke .fk-big{font-size:34px;font-weight:800;line-height:1;font-variant-numeric:tabular-nums;color:var(--text,#1f2937);}",
"#pane-fkiemke .fk-sub{font-size:12px;margin-top:8px;font-weight:600;} #pane-fkiemke .fk-up{color:#0f9488;} #pane-fkiemke .fk-down{color:#dc2626;} #pane-fkiemke .fk-flat{color:var(--muted,#9ca3af);}",
"#pane-fkiemke .fk-chart{display:flex;align-items:flex-end;gap:7px;height:96px;margin-top:auto;padding-top:6px;}",
"#pane-fkiemke .fk-col{flex:1;display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer;height:100%;justify-content:flex-end;}",
"#pane-fkiemke .fk-colbar{width:70%;min-height:3px;background:linear-gradient(180deg,#5eead4,#2dd4bf);border-radius:4px 4px 0 0;transition:height .7s cubic-bezier(.4,0,.2,1);}",
"#pane-fkiemke .fk-col:hover .fk-colbar{filter:brightness(1.12);} #pane-fkiemke .fk-collab{font-size:9.5px;color:var(--muted,#9ca3af);} #pane-fkiemke .fk-colval{font-size:10px;font-weight:700;color:var(--text,#374151);}",
"#pane-fkiemke .fk-mini{overflow-x:auto;-webkit-overflow-scrolling:touch;} #pane-fkiemke .fk-mini table{width:100%;border-collapse:collapse;font-size:12.5px;min-width:320px;}",
"#pane-fkiemke .fk-mini td{padding:7px 8px;border-top:1px solid var(--line,#eef1f5);white-space:nowrap;} #pane-fkiemke .fk-mini tr{cursor:pointer;} #pane-fkiemke .fk-mini tr:hover td{background:color-mix(in srgb,var(--accent,#2563eb) 6%,transparent);}",
"#pane-fkiemke .fk-mini .rank{color:var(--muted,#9ca3af);width:20px;} #pane-fkiemke .fk-mini .pn{color:var(--muted,#6b7280);max-width:150px;overflow:hidden;text-overflow:ellipsis;} #pane-fkiemke .fk-mini .num{text-align:right;font-variant-numeric:tabular-nums;font-weight:700;}",
"#pane-fkiemke .d-am{color:#dc2626;} #pane-fkiemke .d-duong{color:#2563eb;} #pane-fkiemke .d-khop{color:var(--muted,#9ca3af);}",
"#pane-fkiemke .fk-state{padding:48px 20px;text-align:center;color:var(--muted,#6b7280);} #pane-fkiemke .fk-spin{width:30px;height:30px;border:3px solid var(--line,#d5dbe4);border-top-color:var(--accent,#2563eb);border-radius:50%;margin:0 auto 14px;animation:fk-sp .8s linear infinite;} @keyframes fk-sp{to{transform:rotate(360deg)}}",
"#pane-fkiemke .fk-gl{color:#b45309;font-weight:700;}",
/* wms-link + modal (giữ như v4) */
".wms-link{color:#0056b3;text-decoration:none;font-weight:600;display:inline-flex;align-items:center;gap:3px;} .wms-link:hover{text-decoration:underline;} .wms-link svg{width:12px;height:12px;opacity:.85;flex:none;}",
".fk-modal{display:none;position:fixed;inset:0;z-index:1250;align-items:center;justify-content:center;padding:clamp(10px,3vw,40px);background:rgba(17,24,39,.55);backdrop-filter:blur(6px);opacity:0;transition:opacity .22s;}",
".fk-modal.show{opacity:1;} .fk-modal .fk-mbox{background:var(--panel,#fff);color:var(--text,#1f2937);border-radius:18px;width:min(1400px,100%);max-height:92vh;display:flex;flex-direction:column;box-shadow:0 30px 70px rgba(16,24,40,.35);transform:translateY(14px) scale(.985);opacity:.6;transition:transform .26s,opacity .26s;overflow:hidden;}",
".fk-modal.show .fk-mbox{transform:none;opacity:1;}",
".fk-mhead{display:flex;align-items:center;gap:14px;padding:16px 20px;border-bottom:1px solid var(--line,#e8ecf1);} .fk-mtitle{font-weight:750;font-size:16px;} .fk-mtitle small{display:block;font-size:11.5px;color:var(--muted,#9ca3af);font-weight:500;margin-top:2px;}",
".fk-mclose{margin-left:auto;background:0;border:0;font-size:24px;line-height:1;cursor:pointer;color:var(--muted,#9ca3af);min-width:44px;min-height:44px;border-radius:10px;} .fk-mclose:hover{color:#ef4444;background:color-mix(in srgb,#ef4444 12%,transparent);}",
".fk-mctrl{display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:12px 20px;border-bottom:1px solid var(--line,#e8ecf1);}",
".fk-mpills{display:inline-flex;gap:2px;background:color-mix(in srgb,var(--muted,#9ca3af) 12%,transparent);border-radius:999px;padding:3px;} .fk-mpill{border:0;background:transparent;padding:7px 16px;border-radius:999px;font-weight:650;font-size:12.5px;cursor:pointer;color:var(--muted,#6b7280);min-height:36px;} .fk-mpill.active{background:var(--accent,#1f2937);color:#fff;}",
".fk-msearch{flex:1 1 200px;max-width:320px;padding:9px 12px;border:1px solid var(--line,#d5dbe4);border-radius:9px;background:var(--panel,#fff);color:var(--text,#1f2937);font-size:12.5px;min-height:38px;}",
".fk-mwrap{overflow:auto;-webkit-overflow-scrolling:touch;flex:1;} .fk-mtbl{border-collapse:separate;border-spacing:0;font-size:12.5px;width:100%;min-width:900px;}",
".fk-mtbl th,.fk-mtbl td{padding:9px 12px;border-bottom:1px solid var(--line,#eef1f5);white-space:nowrap;text-align:left;vertical-align:top;} .fk-mtbl thead th{position:sticky;top:0;z-index:3;background:var(--accent,#1f2937);color:#fff;font-size:10.5px;font-weight:650;text-transform:uppercase;letter-spacing:.03em;}",
".fk-mtbl th.stick,.fk-mtbl td.stick{position:sticky;left:0;z-index:2;background:var(--panel,#fff);} .fk-mtbl thead th.stick{z-index:4;background:var(--accent,#1f2937);}",
".fk-mtbl tbody tr:hover td{background:color-mix(in srgb,var(--accent,#2563eb) 6%,transparent);} .fk-mtbl tbody tr:hover td.stick{background:color-mix(in srgb,var(--accent,#2563eb) 10%,var(--panel,#fff));}",
".fk-mtbl .num{text-align:right;font-variant-numeric:tabular-nums;} .fk-mtbl .skucell .pn{display:block;white-space:normal;max-width:300px;color:var(--muted,#6b7280);line-height:1.35;margin-top:2px;} .fk-mtbl .loc{font-family:ui-monospace,Consolas,monospace;color:#0f9488;}",
".fk-mnote{padding:10px 20px;font-size:11.5px;color:var(--muted,#9ca3af);border-top:1px solid var(--line,#e8ecf1);}",
".fk-badge{display:inline-block;padding:2px 9px;border-radius:999px;font-size:10px;font-weight:750;} .fk-badge.verified{background:#d1faf3;color:#0f766e;} .fk-badge.processing{background:#fdecd0;color:#b45309;} .fk-badge.pending{background:color-mix(in srgb,#9ca3af 22%,transparent);color:#6b7280;}",
"#fkToast{position:fixed;left:50%;bottom:28px;transform:translate(-50%,16px);background:#111827;color:#fff;padding:12px 20px;border-radius:12px;font-size:13px;font-weight:600;box-shadow:0 24px 60px rgba(16,24,40,.35);opacity:0;pointer-events:none;z-index:1400;max-width:92vw;text-align:center;transition:opacity .25s,transform .25s;} #fkToast.show{opacity:1;transform:translate(-50%,0);} #fkToast.ok{background:#0f766e;} #fkToast.warn{background:#b45309;} #fkToast.err{background:#b42318;}",
].join("\n");

/* ===== KHUNG ===== */
var KHUNG =
'<div class="fk-filter">' +
'  <div class="fk-fld"><label>Chế độ</label><div class="fk-modes"><button class="fk-mode active" data-mode="sku">Kiểm kê SKU</button><button class="fk-mode" data-mode="loc">Kiểm kê Location</button></div></div>' +
'  <div class="fk-fld"><label>Kho</label><div class="fk-selwrap"><select id="fkWh" class="fk-sel"></select></div></div>' +
'  <div class="fk-fld"><label>Nhóm hàng</label><div class="fk-selwrap"><select id="fkCat" class="fk-sel"></select></div></div>' +
'  <div class="fk-fld"><label>Khoảng ngày</label><div class="fk-selwrap"><select id="fkRange" class="fk-sel"><option value="all">Tất cả</option><option value="today">Hôm nay</option><option value="7d">7 ngày qua</option><option value="30d">30 ngày qua</option></select></div></div>' +
'  <button id="fkSync" class="fk-sync" onclick="FKIEMKE.sync()"><span>Đồng bộ WMS</span><small class="ts" id="fkSyncTs"></small></button>' +
'</div>' +
'<div id="fkBody"></div>' +
'<div id="fkState" class="fk-state"><div class="fk-spin"></div>Đang tải dữ liệu kiểm kê…</div>';

var MODAL =
'<div id="fkModal" class="fk-modal"><div class="fk-mbox">' +
'  <div class="fk-mhead"><div class="fk-mtitle" id="fkMTitle"></div><button class="fk-mclose" onclick="FKIEMKE.closeModal()" aria-label="Đóng">&times;</button></div>' +
'  <div class="fk-mctrl"><div class="fk-mpills"><button class="fk-mpill" data-mtab="sku" onclick="FKIEMKE.setTab(\'sku\')">Theo SKU</button><button class="fk-mpill" data-mtab="loc" onclick="FKIEMKE.setTab(\'loc\')">Theo Location</button></div>' +
'    <input id="fkMSearch" class="fk-msearch" placeholder="Tìm trong kết quả…" oninput="FKIEMKE.msearch()"></div>' +
'  <div class="fk-mwrap" id="fkMWrap"></div><div class="fk-mnote" id="fkMNote"></div>' +
'</div></div>';

/* ===== ĐỌC DỮ LIỆU ===== */
function loadData(){
  _giaLap = false;
  $id("fkState").style.display = "block"; $id("fkState").innerHTML = '<div class="fk-spin"></div>Đang tải dữ liệu kiểm kê…'; $id("fkBody").innerHTML = "";
  window.fkgv_data = function(resp){
    try{ if (resp.status === "error") throw 0;
      var header = ((resp.table && resp.table.cols) || []).map(function(c){ return String((c && c.label) || "").trim(); });
      var rows = ((resp.table && resp.table.rows) || []).map(function(r){ return (r.c || []).map(function(c){ return c ? (c.v == null ? "" : c.v) : ""; }); });
      if (!rows.length) throw 0; napSheet(header, rows);
    }catch(e){ hienTrong(); }
  };
  var url = "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/gviz/tq?tqx=out:json;responseHandler:fkgv_data&sheet=" + encodeURIComponent(TAB) + "&headers=1";
  var old = $id("fk_sc"); if (old) old.remove();
  var sc = document.createElement("script"); sc.id = "fk_sc"; sc.src = url; sc.onerror = function(){ hienTrong(); };
  document.body.appendChild(sc); loadTs();
}
function loadTs(){
  window.fkgv_ts = function(resp){ var ts = resp && resp.status === "success" ? Number(resp.ts || 0) : 0; if (ts > 0){ _lastSyncMs = ts; var d = new Date(ts); $id("fkSyncTs").textContent = "Mới nhất: " + p2(d.getHours()) + ":" + p2(d.getMinutes()) + " " + p2(d.getDate()) + "/" + p2(d.getMonth() + 1); } };
  var sc = document.createElement("script"); sc.src = APPSCRIPT_URL + "?action=lastSync&tab=" + encodeURIComponent(TAB) + "&callback=fkgv_ts"; document.body.appendChild(sc); setTimeout(function(){ sc.remove(); }, 15000);
}
/* CT1: MAP THEO TÊN CỘT (khớp 100% key WMS thật; alias để tương thích sheet 9-cột cũ).
   Key WMS: No. / ID / Request code / Source code / Warehouse / SKU / Product Name / Category /
   Type / Required VAT / Priority / Diff By Location / Diff By Sku / Inventory / Quantity Count /
   Assign to / Counted by / Counted date / Updated At / Plan Date / Status. */
function napSheet(header, rows){
  var H = header.map(function(h){ return String(h || "").toLowerCase().trim(); });
  var col = function(){ for (var i = 0; i < arguments.length; i++){ var j = H.indexOf(String(arguments[i]).toLowerCase()); if (j >= 0) return j; } return -1; };
  var IX = {
    no: col("No.", "No", "STT"), id: col("ID"), req: col("Request code"), source: col("Source code"),
    wh: col("Warehouse"), sku: col("SKU"), pn: col("Product Name", "ProductName"), category: col("Category", "CategoryName"),
    type: col("Type"), vat: col("Required VAT"), priority: col("Priority"),
    diffLoc: col("Diff By Location", "Diff"), diffSku: col("Diff By Sku", "Diff By SKU"),
    inv: col("Inventory", "SystemQty"), cnt: col("Quantity Count", "CountedQty"),
    assignTo: col("Assign to"), countedBy: col("Counted by"), countedDate: col("Counted date"),
    updatedAt: col("Updated At", "Updated"), planDate: col("Plan Date"), status: col("Status"),
  };
  var g = function(r, i){ return i >= 0 && r[i] != null ? r[i] : ""; };
  var num = function(v){ return v === "" || v == null ? null : (Number(v) || 0); };
  ROWS = rows.filter(function(r){ return String(g(r, IX.sku) || "") !== "" || String(g(r, IX.loc) || "") !== ""; }).map(function(r, i){
    var inv = num(g(r, IX.inv)) || 0, cnt = num(g(r, IX.cnt));
    var dl = IX.diffLoc >= 0 && g(r, IX.diffLoc) !== "" ? (Number(g(r, IX.diffLoc)) || 0) : (cnt == null ? 0 : cnt - inv);
    var ds = IX.diffSku >= 0 && g(r, IX.diffSku) !== "" ? (Number(g(r, IX.diffSku)) || 0) : null;
    return {
      no: IX.no >= 0 ? g(r, IX.no) : i + 1, id: String(g(r, IX.id) || ""), req: String(g(r, IX.req) || ""),
      source: String(g(r, IX.source) || ""), wh: String(g(r, IX.wh) || ""), sku: String(g(r, IX.sku) || ""),
      pn: String(g(r, IX.pn) || ""), loc: String(g(r, col("Location", "LocationDescription")) || ""),
      category: String(g(r, IX.category) || ""), type: String(g(r, IX.type) || ""), vat: String(g(r, IX.vat) || ""),
      priority: String(g(r, IX.priority) || ""), inv: inv, cnt: cnt, diffLoc: dl, diffSku: ds,
      assignTo: String(g(r, IX.assignTo) || ""), countedBy: String(g(r, IX.countedBy) || ""),
      countedDate: String(g(r, IX.countedDate) || ""), updatedAt: String(g(r, IX.updatedAt) || ""), planDate: String(g(r, IX.planDate) || ""),
    };
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
  napCategory();
  $id("fkState").style.display = "none";
  veLai();
}
function napCategory(){
  var cats = {}; rowsKho().forEach(function(r){ var c = catOf(r); cats[c] = (cats[c] || 0) + 1; });
  var list = Object.keys(cats).sort();
  if (selCat && list.indexOf(selCat) < 0) selCat = "";
  $id("fkCat").innerHTML = '<option value="">Tất cả nhóm</option>' + list.map(function(c){ return '<option value="' + esc(c) + '"' + (c === selCat ? " selected" : "") + ">" + esc(c) + " (" + cats[c] + ")</option>"; }).join("");
}
function rowsKho(){ return ROWS.filter(function(r){ return r.wh === selWh; }); }
function trongKhoang(r){ if (dateRange === "all") return true; var dk = dayKey(countMs(r)); if (isNaN(dk)) return false; if (dateRange === "today") return dk === refDay; if (dateRange === "7d") return dk >= refDay - 6; if (dateRange === "30d") return dk >= refDay - 29; return true; }
function rowsBase(){ return rowsKho().filter(function(r){ return (!selCat || catOf(r) === selCat) && trongKhoang(r); }); }
function diffBySku(rows){ var m = {}; rows.forEach(function(r){ m[r.sku] = (m[r.sku] || 0) + r.diffLoc; }); return m; }
// Gom theo Location -> trạng thái + tổng lệch (dùng cho mode Location + hero)
function aggLoc(rows){
  var g = {}; rows.forEach(function(r){ var o = g[r.loc] || (g[r.loc] = { loc: r.loc, d: 0, pend: false, n: 0 }); o.d += r.diffLoc; if (r.cnt == null) o.pend = true; o.n++; });
  return Object.keys(g).map(function(k){ var o = g[k]; o.st = o.pend ? "PENDING" : o.d === 0 ? "VERIFIED" : "PROCESSING"; return o; });
}

/* ===== COUNTUP + FADE ===== */
function countUp(el){
  var to = Number(el.getAttribute("data-count")) || 0, dec = el.getAttribute("data-dec") === "1", suf = el.getAttribute("data-suf") || "";
  var t0 = performance.now(), dur = 750;
  function step(t){ var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3), v = to * e;
    el.textContent = (dec ? v.toFixed(1) : Math.round(v).toLocaleString("en-US")) + suf; if (k < 1) requestAnimationFrame(step); }
  requestAnimationFrame(step);
}
function runCount(){ PANE.querySelectorAll("[data-count]").forEach(countUp); }

/* ===== DASHBOARD ===== */
function veLai(){
  refDay = 0; rowsKho().forEach(function(r){ var d = dayKey(countMs(r)); if (!isNaN(d) && d > refDay) refDay = d; });
  if (!refDay) refDay = Math.floor(Date.now() / 86400000);
  var rows = rowsBase();

  // CT2 Hero — theo mode: đơn vị = bản ghi SKU HAY Location
  var v, p, pd, tot, unit;
  if (mode === "sku"){ unit = "bản ghi SKU"; tot = rows.length; v = 0; p = 0; pd = 0; rows.forEach(function(r){ var s = statusOf(r); if (s === "VERIFIED") v++; else if (s === "PROCESSING") p++; else pd++; }); }
  else { unit = "Location"; var la = aggLoc(rows); tot = la.length; v = 0; p = 0; pd = 0; la.forEach(function(o){ if (o.st === "VERIFIED") v++; else if (o.st === "PROCESSING") p++; else pd++; }); }
  var counted = v + p, pct = tot ? counted / tot * 100 : 0;
  var pV = tot ? v / tot * 100 : 0, pP = tot ? p / tot * 100 : 0;

  // Discrepancy (theo bản ghi)
  var neg = 0, pos = 0, sNeg = 0, sPos = 0; rows.forEach(function(r){ if (r.diffLoc < 0){ neg++; sNeg += r.diffLoc; } else if (r.diffLoc > 0){ pos++; sPos += r.diffLoc; } });

  // Velocity (theo Counted date, fallback Updated At)
  var demT = 0, demY = 0; rows.forEach(function(r){ if (r.cnt == null) return; var d = dayKey(countMs(r)); if (d === refDay) demT++; else if (d === refDay - 1) demY++; });
  var delta = demY ? (demT - demY) / demY * 100 : (demT ? 100 : 0);
  var dTxt = demY ? ((delta >= 0 ? "▲ +" : "▼ ") + Math.abs(delta).toFixed(0) + "% so với hôm qua") : (demT ? "▲ mới có hôm nay" : "—");
  var dCls = !demY ? "fk-flat" : delta > 0 ? "fk-up" : delta < 0 ? "fk-down" : "fk-flat";

  // Top SKU / Location
  var dS = diffBySku(rows), pnBy = {}; rows.forEach(function(r){ if (!pnBy[r.sku]) pnBy[r.sku] = r.pn; });
  var topSku = Object.keys(dS).map(function(k){ return { sku: k, pn: pnBy[k], d: dS[k] }; }).filter(function(x){ return x.d !== 0; }).sort(function(a, b){ return Math.abs(b.d) - Math.abs(a.d); }).slice(0, 5);
  var laAll = aggLoc(rows); var topLoc = laAll.filter(function(o){ return o.d !== 0; }).sort(function(a, b){ return Math.abs(b.d) - Math.abs(a.d); }).slice(0, 5);

  // 7 ngày
  var days = [], maxD = 1; for (var i = 6; i >= 0; i--){ var dk = refDay - i, c = 0; rows.forEach(function(r){ if (r.cnt != null && dayKey(countMs(r)) === dk) c++; }); days.push({ dk: dk, c: c }); if (c > maxD) maxD = c; }

  var EMPTY = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="#0f9488" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12.5l2.5 2.5 5-5.5"/></svg><p>Tuyệt vời! Không phát hiện sai lệch nào.</p></div>';
  var miniSku = topSku.length ? '<div class="fk-mini"><table><tbody>' + topSku.map(function(x, i){ return '<tr data-drill="sku" data-v="' + esc(x.sku) + '"><td class="rank">' + (i + 1) + '</td><td>' + wmsLink(x.sku, "sku") + '</td><td class="pn">' + esc(x.pn) + '</td><td class="num ' + (x.d < 0 ? "d-am" : "d-duong") + '">' + (x.d > 0 ? "+" : "") + nf(x.d) + '</td></tr>'; }).join("") + '</tbody></table></div>' : EMPTY;
  var miniLoc = topLoc.length ? '<div class="fk-mini"><table><tbody>' + topLoc.map(function(x, i){ return '<tr data-drill="loc" data-v="' + esc(x.loc) + '"><td class="rank">' + (i + 1) + '</td><td>' + wmsLink(x.loc, "location") + '</td><td class="num">' + x.n + '</td><td class="num ' + (x.d < 0 ? "d-am" : "d-duong") + '">' + (x.d > 0 ? "+" : "") + nf(x.d) + '</td></tr>'; }).join("") + '</tbody></table></div>' : EMPTY;
  var chart = days.map(function(d){ var h = Math.round(d.c / maxD * 100); return '<div class="fk-col" data-drill="day" data-v="' + d.dk + '" title="' + fmtDMY(d.dk) + ': ' + d.c + '"><div class="fk-colval">' + (d.c || "") + '</div><div class="fk-colbar" style="height:' + h + '%"></div><div class="fk-collab">' + fmtDMY(d.dk) + '</div></div>'; }).join("");

  $id("fkBody").innerHTML =
    '<div class="fk-anim">' +
    // HERO
    '<div class="fk-hero"><div class="fk-herotop"><div><div class="fk-hlabel">Tiến độ kiểm kê · ' + unit + '</div>' +
      '<div class="fk-hpct"><span data-count="' + pct.toFixed(1) + '" data-dec="1" data-suf="%">0%</span></div></div>' +
      '<div class="fk-hsub">Đã đếm <b>' + nf(counted) + '</b> / ' + nf(tot) + ' ' + unit + (_giaLap ? ' · <span class="fk-gl">⚠ GIẢ LẬP</span>' : "") + '</div></div>' +
      '<div class="fk-hbar"><i class="v" style="width:' + pV.toFixed(1) + '%"></i><i class="p" style="width:' + pP.toFixed(1) + '%"></i></div>' +
      '<div class="fk-hleg">' +
        '<span data-drill="status" data-v="VERIFIED"><i class="dot" style="background:#14b8a6"></i>VERIFIED <b>' + nf(v) + '</b> · ' + pV.toFixed(0) + '%</span>' +
        '<span data-drill="status" data-v="PROCESSING"><i class="dot" style="background:#f59e0b"></i>PROCESSING <b>' + nf(p) + '</b> · ' + pP.toFixed(0) + '%</span>' +
        '<span data-drill="status" data-v="PENDING"><i class="dot" style="background:#9ca3af"></i>Chưa đếm <b>' + nf(pd) + '</b></span>' +
      '</div></div>' +
    // WIDGETS
    '<div class="fk-grid">' +
    // CT2: Card Chênh lệch = 2 hàng ngang (số | tổng), text rõ ràng
    '<div class="fk-w fk-w-disc"><div class="fk-wh"><span class="fk-wt">Chênh lệch</span><button class="fk-see" data-drill="lech">Xem chi tiết</button></div>' +
      '<div class="fk-discrows"><div class="row"><span class="lbl"><b class="d-am"><span data-count="' + neg + '">0</span></b> bản ghi Lệch âm</span><span class="val d-am">Tổng SL lệch: ' + nf(sNeg) + '</span></div>' +
      '<div class="row"><span class="lbl"><b class="d-duong"><span data-count="' + pos + '">0</span></b> bản ghi Lệch dương</span><span class="val d-duong">Tổng SL lệch: ' + (sPos > 0 ? "+" : "") + nf(sPos) + '</span></div></div></div>' +
    // CT2: Card Tốc độ = căn giữa dọc, số cực đại + badge delta
    '<div class="fk-w fk-w-vel"><div class="fk-wh"><span class="fk-wt">Tốc độ · ' + fmtDMY(refDay) + '</span><button class="fk-see" data-drill="today">Xem chi tiết</button></div>' +
      '<div class="fk-velbody"><div class="fk-velnum"><span data-count="' + demT + '">0</span></div><span class="fk-velbadge ' + dCls + '">' + dTxt + '</span></div></div>' +
    '<div class="fk-w fk-w-trend"><div class="fk-wh"><span class="fk-wt">Số dòng đếm · 7 ngày</span></div><div class="fk-chart">' + chart + '</div></div>' +
    '<div class="fk-w fk-w-sku"><div class="fk-wh"><span class="fk-wt">Top 5 SKU lệch</span><button class="fk-see" data-drill="allsku">Xem tất cả</button></div>' + miniSku + '</div>' +
    '<div class="fk-w fk-w-loc"><div class="fk-wh"><span class="fk-wt">Top 5 Location lệch</span><button class="fk-see" data-drill="allloc">Xem tất cả</button></div>' + miniLoc + '</div>' +
    '</div></div>';
  requestAnimationFrame(runCount);
}

/* ===== MODAL (giữ 20 cột SKU / 14 cột Location, deep-link, sticky) ===== */
function locFiltered(){
  var rows = rowsBase(), f = mFilter;
  if (f.t === "today") return rows.filter(function(r){ return dayKey(countMs(r)) === refDay; });
  if (f.t === "day") return rows.filter(function(r){ return dayKey(countMs(r)) === Number(f.v); });
  if (f.t === "status") return rows.filter(function(r){ return statusOf(r) === f.v; });
  if (f.t === "lech") return rows.filter(function(r){ return r.diffLoc !== 0; });
  if (f.t === "sku") return rows.filter(function(r){ return r.sku === f.v; });
  if (f.t === "loc") return rows.filter(function(r){ return r.loc === f.v; });
  return rows;
}
function openModal(f, label, tab){
  mFilter = f || { t: "all" }; mLabel = label || "Tất cả"; mTab = tab || mode;
  $id("fkMSearch").value = "";
  document.querySelectorAll(".fk-mpill").forEach(function(x){ x.classList.toggle("active", x.getAttribute("data-mtab") === mTab); });
  renderModal();
  var m = $id("fkModal"); m.style.display = "flex"; requestAnimationFrame(function(){ m.classList.add("show"); });
}
function closeModal(){ var m = $id("fkModal"); m.classList.remove("show"); setTimeout(function(){ m.style.display = "none"; }, 240); }
function setTab(t){ mTab = t; document.querySelectorAll(".fk-mpill").forEach(function(x){ x.classList.toggle("active", x.getAttribute("data-mtab") === t); }); renderModal(); }
function renderModal(){
  var base = locFiltered(), q = ($id("fkMSearch").value || "").toLowerCase().trim(), dS = diffBySku(rowsBase());
  var dcell = function(v){ return '<td class="num ' + (v < 0 ? "d-am" : v > 0 ? "d-duong" : "d-khop") + '">' + (v > 0 ? "+" : "") + nf(v) + "</td>"; };
  var html, n;
  if (mTab === "sku"){
    var rows = base.filter(function(r){ return !q || (r.sku + " " + r.pn + " " + r.loc + " " + r.req + " " + r.assignTo).toLowerCase().indexOf(q) >= 0; });
    n = rows.length;
    var body = rows.slice(0, MODAL_CAP).map(function(r){
      var st = statusOf(r), ds = r.diffSku != null ? r.diffSku : (dS[r.sku] || 0);
      return "<tr><td class='stick'>" + (r.id ? esc(r.id) : "—") + "</td>" +
        '<td class="skucell">' + wmsLink(r.sku, "sku") + '<small class="pn">' + esc(r.pn) + "</small></td>" +
        "<td>" + (catOf(r) || "—") + "</td>" + dcell(r.diffLoc) + dcell(ds) +
        '<td class="num">' + nf(r.inv) + '</td><td class="num">' + (r.cnt == null ? "—" : nf(r.cnt)) + "</td>" +
        "<td>" + (r.no || "—") + "</td><td>" + (r.req ? esc(r.req) : "—") + "</td><td>" + (r.source ? esc(r.source) : "—") + "</td>" +
        "<td>" + (r.type ? esc(r.type) : "—") + "</td><td>" + (r.vat ? esc(r.vat) : "—") + "</td><td>" + (r.priority ? esc(r.priority) : "—") + "</td>" +
        "<td>" + (r.assignTo ? esc(r.assignTo) : "—") + "</td><td>" + (r.countedBy ? esc(r.countedBy) : "—") + "</td>" +
        "<td>" + fmtDate(r.countedDate) + "</td><td>" + fmtDate(r.updatedAt) + "</td><td>" + fmtDate(r.planDate, true) + "</td>" +
        "<td><span class='fk-badge " + badgeCls(st) + "'>" + st + "</span></td></tr>";
    }).join("");
    html = '<table class="fk-mtbl"><thead><tr><th class="stick">ID</th><th>SKU</th><th>Category</th><th class="num">Diff By Location</th><th class="num">Diff By Sku</th><th class="num">Inventory</th><th class="num">Quantity Count</th><th>No.</th><th>Request code</th><th>Source code</th><th>Type</th><th>Required VAT</th><th>Priority</th><th>Assign to</th><th>Counted by</th><th>Counted date</th><th>Updated At</th><th>Plan Date</th><th>Status</th></tr></thead><tbody>' +
      (body || '<tr><td colspan="19" style="text-align:center;color:var(--muted);padding:24px">Không có dòng phù hợp</td></tr>') + "</tbody></table>";
  } else {
    var g = {}; base.forEach(function(r){ var o = g[r.loc] || (g[r.loc] = { loc: r.loc, d: 0, rep: r, n: 0 }); o.d += r.diffLoc; o.n++; });
    var arr = Object.keys(g).map(function(k){ return g[k]; }).filter(function(o){ return !q || (o.loc + " " + o.rep.req + " " + o.rep.assignTo).toLowerCase().indexOf(q) >= 0; }).sort(function(a, b){ return Math.abs(b.d) - Math.abs(a.d); });
    n = arr.length;
    var body2 = arr.slice(0, MODAL_CAP).map(function(o){
      var r = o.rep, st = o.d === 0 ? (r.cnt == null ? "PENDING" : "VERIFIED") : "PROCESSING";
      return "<tr><td class='stick'>" + (r.id ? esc(r.id) : "—") + "</td><td>" + (r.req ? esc(r.req) : "—") + "</td><td>" + (r.source ? esc(r.source) : "—") + "</td><td>" + (r.type ? esc(r.type) : "—") + "</td>" +
        "<td>" + wmsLink(o.loc, "location") + "</td><td>" + (r.priority ? esc(r.priority) : "—") + "</td>" + dcell(o.d) +
        "<td>" + (r.assignTo ? esc(r.assignTo) : "—") + "</td><td>" + (r.countedBy ? esc(r.countedBy) : "—") + "</td><td>" + fmtDate(r.countedDate) + "</td><td>" + fmtDate(r.updatedAt) + "</td><td>" + fmtDate(r.planDate, true) + "</td>" +
        "<td><span class='fk-badge " + badgeCls(st) + "'>" + st + "</span></td></tr>";
    }).join("");
    html = '<table class="fk-mtbl"><thead><tr><th class="stick">ID</th><th>Request code</th><th>Source code</th><th>Type</th><th>Location</th><th>Priority</th><th class="num">Diff</th><th>Assign to</th><th>Counted by</th><th>Counted date</th><th>Updated At</th><th>Plan Date</th><th>Status</th></tr></thead><tbody>' +
      (body2 || '<tr><td colspan="13" style="text-align:center;color:var(--muted);padding:24px">Không có dòng phù hợp</td></tr>') + "</tbody></table>";
  }
  $id("fkMWrap").innerHTML = html;
  $id("fkMTitle").innerHTML = "Chi tiết kiểm kê — " + esc(selWh) + "<small>Lọc: " + esc(mLabel) + " · " + (mTab === "sku" ? "theo SKU" : "theo Location") + "</small>";
  $id("fkMNote").textContent = n > MODAL_CAP ? ("Hiển thị " + nf(MODAL_CAP) + " / " + nf(n) + " dòng — tìm để thu hẹp.") : (nf(n) + " dòng.");
}

/* ===== SYNC / TOAST / INIT ===== */
function sync(){
  if (_syncing) return; _syncing = true;
  var btn = $id("fkSync"); btn.disabled = true; btn.firstElementChild.textContent = "Đang đồng bộ…";
  var ac = new AbortController(), to = setTimeout(function(){ ac.abort(); }, FETCH_TIMEOUT_MS);
  fetch(APPSCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "force_sync_kiemke" }), signal: ac.signal })
    .then(function(r){ return r.json(); })
    .then(function(j){
      if (j.status === "success"){ toast("Đã đồng bộ (" + nf(j.written || 0) + " dòng).", "ok"); loadData(); }
      else if (j.code === 401) toast("Token WMS đã hết hạn. Đang chờ luồng chạy ngầm cập nhật Token mới.", "err");
      else if (j.code === 429) toast(j.message || "Đang trong thời gian chờ.", "warn");
      else if (j.code === 502) toast("Máy chủ Google không gọi được WMS (firewall). Đồng bộ từ máy trạm.", "err");
      else toast("Đồng bộ thất bại: " + (j.message || "?"), "err");
    })
    .catch(function(e){ toast(e.name === "AbortError" ? "Quá 4 phút — đã ngắt." : "Không gọi được máy chủ (" + e.message + ").", "err"); })
    .finally(function(){ clearTimeout(to); _syncing = false; btn.disabled = false; btn.firstElementChild.textContent = "Đồng bộ WMS"; });
}
function toast(msg, type){ var el = $id("fkToast"); el.className = type || ""; el.textContent = msg; requestAnimationFrame(function(){ el.classList.add("show"); }); clearTimeout(toast._t); toast._t = setTimeout(function(){ el.classList.remove("show"); }, 6000); }

function init(pane){
  PANE = pane;
  if (!_boot){
    _boot = true;
    var style = document.createElement("style"); style.id = "fkStyle"; style.textContent = CSS; document.head.appendChild(style);
    pane.innerHTML = KHUNG;
    var ov = document.createElement("div"); ov.id = "fkOverlays"; ov.innerHTML = MODAL + '<div id="fkToast"></div>'; document.body.appendChild(ov);
    $id("fkWh").addEventListener("change", function(e){ selWh = e.target.value; selCat = ""; napCategory(); veLai(); });
    $id("fkCat").addEventListener("change", function(e){ selCat = e.target.value; veLai(); });
    $id("fkRange").addEventListener("change", function(e){ dateRange = e.target.value; veLai(); if ($id("fkModal").classList.contains("show")) renderModal(); });
    // Chế độ SKU/Location
    pane.addEventListener("click", function(e){
      var md = e.target.closest("[data-mode]");
      if (md){ mode = md.getAttribute("data-mode"); pane.querySelectorAll("[data-mode]").forEach(function(x){ x.classList.toggle("active", x === md); }); veLai(); return; }
      if (e.target.closest(".wms-link")) return;   // để deep-link mở tab mới, không drill
      var el = e.target.closest("[data-drill]"); if (!el) return;
      var t = el.getAttribute("data-drill"), v = el.getAttribute("data-v");
      if (t === "today") openModal({ t: "today" }, "Đã đếm " + fmtDMY(refDay));
      else if (t === "status") openModal({ t: "status", v: v }, "Trạng thái " + v);
      else if (t === "sku") openModal({ t: "sku", v: v }, "SKU " + v, "sku");
      else if (t === "loc") openModal({ t: "loc", v: v }, "Location " + v, "loc");
      else if (t === "day") openModal({ t: "day", v: v }, "Ngày " + fmtDMY(Number(v)));
      else if (t === "lech") openModal({ t: "lech" }, "Có chênh lệch");
      else if (t === "allsku") openModal({ t: "all" }, "Tất cả", "sku");
      else if (t === "allloc") openModal({ t: "all" }, "Tất cả", "loc");
    });
    $id("fkModal").addEventListener("click", function(e){ if (e.target === $id("fkModal")) closeModal(); });
    document.addEventListener("keydown", function(e){ if (e.key === "Escape" && $id("fkModal") && $id("fkModal").classList.contains("show")) closeModal(); });
    loadData();
    return;
  }
  if (!ROWS.length) loadData(); else loadTs();
}

window.FKIEMKE = { init: init, sync: sync, closeModal: closeModal, setTab: setTab, msearch: function(){ clearTimeout(_deb); _deb = setTimeout(renderModal, 130); } };
})();
