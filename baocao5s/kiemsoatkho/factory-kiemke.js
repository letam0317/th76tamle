/**
 * ============================================================================
 *  factory-kiemke.js — PHYSICAL COUNT DASHBOARD (kiến trúc KÉP SKU/Location)
 * ============================================================================
 *  CT1 Mảng kép: rawSkuData (tab kiemke-sku) + rawLocationData (tab kiemke-location),
 *      2 nguồn tách biệt; nav tab trỏ Data Model sang đúng mảng (không lẫn cấu trúc cột).
 *  CT2 Nav tab chuẩn WMS 100%: Location count result / SKU / Daily checklist / RFID /
 *      Asset reconciliation (3 tab sau tạm '#'). Status filter 8 giá trị chuẩn WMS.
 *  CT3 evaluateDiff(inv, qty): diff=qty-inv -> Lệch âm/dương/Khớp (loại NOT COUNT);
 *      KPI + chart dùng hàm này, KHÔNG dựa field string tĩnh.
 *  CT4 Custom dropdown (Kho/Nhóm hàng/Status) mượt: opacity+translateY, hover xám, ✓ chọn.
 * ============================================================================
 */
(function(){
"use strict";
if (window.FKIEMKE) return;

var SHEET_ID = "1eY_oo9fAvWCTXp24x-Z0FXq9mp_jJPlTHg09qdemETs";
var TAB_SKU = "kiemke-sku", TAB_SKU_FB = "kiemke-material", TAB_LOC = "kiemke-location";
var APPSCRIPT_URL = "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
var MODAL_CAP = 400, FETCH_TIMEOUT_MS = 4 * 60 * 1000;
var ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M7 17L17 7M17 7H9M17 7V15"/></svg>';
// CT2: 8 trạng thái chuẩn WMS
var STATUSES = ["PENDING", "CANCELED", "PROCESSING", "VERIFIED", "REJECTED", "APPROVED", "NOT COUNT", "WAITING FOR APPROVE"];
// CT4: Loại kiểm kê (Physical Count Type) chuẩn WMS
var TYPES = ["Location", "Full location", "SKU", "Daily", "Location - Factory", "Full location - Factory", "SKU - Factory"];
// CT2: nav tab chuẩn WMS (loc/sku có tính năng; 3 tab sau '#')
var NAVTABS = [
  { k: "loc", label: "Location count result", on: true },
  { k: "sku", label: "SKU", on: true },
];

/* ===== MOCK (đủ key, status chuẩn WMS) ===== */
var MOCK_SKU = (function(){
  var A = [
    ["INV-26001","422490737","Vải Chính/CMTS0028/Trắng/XL","F1-A2-01-03","WH - MATERIAL - MTG",120,120,"RQ-5521","SRC-01","Định kỳ","Cao","Có","Nguyễn Văn A","Lê Thị B","2026-07-15 09:10","2026-07-16","VERIFIED"],
    ["INV-26002","422490812","Vải Chính/CMTS0031/Đen","F1-A3-02-01","WH - MATERIAL - MTG",300,288,"RQ-5521","SRC-01","Định kỳ","Cao","Không","Nguyễn Văn A","Lê Thị B","2026-07-15 09:22","2026-07-16","PROCESSING"],
    ["INV-26003","422491055","Dây Kéo/YKK 5VS/Đồng rêu","F2-B1-04-02","WH - MATERIAL - MTG",850,862,"RQ-5521","SRC-01","Trung bình","Không","Trần C","Phạm D","2026-07-14 15:02","2026-07-15","APPROVED"],
    ["INV-26004","422491203","Phụ Liệu/Nút dập 15mm","F2-B2-01-05","WH - MATERIAL - MTG",40,null,"RQ-5530","SRC-02","Đột xuất","Thấp","Không","Trần C","","2026-07-13 11:20","2026-07-15","NOT COUNT"],
    ["INV-26005","422491374","Chỉ May/Coats Epic 120","F3-C1-02-02","WH - MATERIAL - MTG",215,215,"RQ-5521","SRC-01","Trung bình","Không","Nguyễn Văn A","Lê Thị B","2026-07-12 08:40","2026-07-13","VERIFIED"],
    ["INV-26006","422491055","Dây Kéo/YKK 5VS/Đồng rêu","F2-B1-05-01","WH - MATERIAL - MTG",120,118,"RQ-5521","SRC-01","Trung bình","Không","Trần C","Phạm D","2026-07-11 14:05","2026-07-12","WAITING FOR APPROVE"],
    ["INV-26007","422501854","Vải Chính/Bag 12/Canvas","F0-A1-01-01","WH - MATERIAL - GARMENT",500,495,"RQ-6012","SRC-03","Định kỳ","Cao","Có","Vũ E","Đỗ F","2026-07-15 10:01","2026-07-16","PROCESSING"],
    ["INV-26008","422501920","Vải Lót/POLY210T/Xám tro","F0-A2-03-04","WH - MATERIAL - GARMENT",160,171,"RQ-6012","SRC-03","Định kỳ","Trung bình","Không","Vũ E","Đỗ F","2026-07-15 10:15","2026-07-16","REJECTED"],
    ["INV-26009","422502088","Phụ Liệu/Khoá móc 25mm","F1-B4-02-02","WH - MATERIAL - GARMENT",720,720,"RQ-6012","SRC-03","Thấp","Không","Vũ E","Đỗ F","2026-07-14 16:30","2026-07-15","VERIFIED"],
    ["INV-26010","422502135","Phụ Liệu/Webbing PP 30mm","F1-B5-01-03","WH - MATERIAL - GARMENT",95,null,"RQ-6020","SRC-04","Đột xuất","Cao","Có","Bùi G","","2026-07-10 09:50","2026-07-12","PENDING"],
    ["INV-26011","422502244","Nhãn Mác/Logo Bag12","F2-C2-04-01","WH - MATERIAL - GARMENT",1000,998,"RQ-6012","SRC-03","Trung bình","Không","Vũ E","Đỗ F","2026-07-13 13:12","2026-07-14","APPROVED"],
    ["INV-26012","422501920","Vải Lót/POLY210T/Xám tro","F0-A2-04-01","WH - MATERIAL - GARMENT",140,140,"RQ-6012","SRC-03","Trung bình","Không","Vũ E","Đỗ F","2026-07-09 11:00","2026-07-10","CANCELED"],
  ];
  return A.map(function(m, i){
    return { no: i + 1, id: m[0], req: m[7], source: m[8], wh: m[4], sku: m[1], pn: m[2], category: m[2].split("/")[0].trim(),
      type: m[9], vat: m[11] === "Có" ? "Có" : "Không", priority: m[10], inv: m[5], cnt: m[6], diffLoc: m[6] == null ? 0 : m[6] - m[5],
      diffSku: null, loc: m[3], assignTo: m[12], countedBy: m[13], countedDate: m[6] == null ? "" : m[14], updatedAt: m[14], planDate: m[15], status: m[16] };
  });
})();

/* ===== STATE (CT1: 2 mảng riêng) ===== */
var rawSkuData = [], rawLocationData = [], activeTab = "sku";
var WHS = [], selWh = "", selCat = "", selStatus = "", selType = "", refDay = 0, _giaLap = false;
var dateFrom = null, dateTo = null, _fp = null;   // CT2: khoảng ngày THẬT (Date) từ Flatpickr; null = Tất cả
var _boot = false, _syncing = false, _loaded = 0, _lastSyncMs = 0, _deb = null, PANE = null, _openDD = null;
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
function catOf(r){ return String(r.category || "").trim() || String(r.pn || "").split("/")[0].trim() || "(Khác)"; }
function normType(s){ return String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }   // CT1: chuẩn hoá so khớp Type
function countMs(r){ var d = parseDate(r.countedDate); return isNaN(d) ? parseDate(r.updatedAt) : d; }
function badgeClsStatus(st){ st = String(st || "").toUpperCase();
  if (st === "VERIFIED" || st === "APPROVED") return "verified";
  if (st === "REJECTED" || st === "CANCELED") return "reject";
  if (st === "NOT COUNT" || st === "PENDING") return "pending";
  return "processing"; }
/* CT4: DEEP-LINK QUA ID — chìa khoá định tuyến DUY NHẤT (không dùng SKU/Request code).
   SKU: .../result/sku/detail/{ID}?page=1&size=20 · Location: .../result/location/detail/{ID}?... */
function idLink(id, kind){
  if (id == null || id === "") return "—";
  var seg = kind === "loc" ? "location" : "sku";
  return '<a class="wms-link" href="https://wms.inshasaki.com/physical-count/result/' + seg + '/detail/' + encodeURIComponent(id) + '?page=1&size=20" target="_blank" rel="noopener">' + esc(id) + ICON + "</a>";
}

/* ===== CT3: ĐÁNH GIÁ CHÊNH LỆCH (độc lập với Status) ===== */
function evaluateDiff(inventory, qtyCount){
  if (qtyCount == null || qtyCount === "") return { diff: 0, label: "none" };   // chưa đếm -> không đánh giá
  var diff = (Number(qtyCount) || 0) - (Number(inventory) || 0);
  return { diff: diff, label: diff < 0 ? "am" : diff > 0 ? "duong" : "khop" };
}
// Chuẩn hoá 1 dòng (SKU hoặc Location) -> {diff, label, counted} dùng chung cho KPI/chart
function metric(r){
  var st = String(r.status || "").toUpperCase();
  if (activeTab === "loc"){
    var d = Number(r.diff) || 0;
    var counted = st && st !== "NOT COUNT" && st !== "PENDING" && st !== "CANCELED";
    return { diff: d, label: counted ? (d < 0 ? "am" : d > 0 ? "duong" : "khop") : "none", counted: counted };
  }
  var e = evaluateDiff(r.inv, r.cnt);
  var c = r.cnt != null && st !== "NOT COUNT";   // loại NOT COUNT khỏi "đã đếm"
  return { diff: e.diff, label: c ? e.label : "none", counted: c };
}

/* ===== CSS ===== */
var CSS = [
/* nav tabs WMS */
"#pane-fkiemke .fk-nav{display:flex;gap:4px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;border-bottom:1px solid var(--line,#e8ecf1);margin:12px 0 14px;}",
"#pane-fkiemke .fk-nav::-webkit-scrollbar{display:none;}",
"#pane-fkiemke .fk-navt{flex:0 0 auto;border:0;background:transparent;padding:11px 16px;font-size:13.5px;font-weight:650;color:var(--muted,#9ca3af);cursor:pointer;border-bottom:2.5px solid transparent;white-space:nowrap;transition:color .18s,border-color .18s;}",
"#pane-fkiemke .fk-navt:hover{color:var(--text,#374151);} #pane-fkiemke .fk-navt.active{color:var(--accent,#1f2937);border-bottom-color:var(--accent,#2563eb);}",
"#pane-fkiemke .fk-navt.off{opacity:.5;} #pane-fkiemke .fk-navt.off::after{content:' •';color:var(--muted,#9ca3af);}",
/* filter row */
"#pane-fkiemke .fk-filter{position:sticky;top:0;z-index:20;display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;padding:12px 4px;margin:0 -4px 16px;background:color-mix(in srgb,var(--bg,#f5f7fa) 92%,transparent);backdrop-filter:blur(8px);}",
"#pane-fkiemke .fk-fld{display:flex;flex-direction:column;gap:4px;} #pane-fkiemke .fk-fld label{font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--muted,#9ca3af);padding-left:2px;}",
"#pane-fkiemke .fk-sync{margin-left:auto;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:2px;min-height:44px;background:var(--accent,#1f2937);color:#fff;border:0;border-radius:10px;padding:6px 15px;font-size:12px;font-weight:650;cursor:pointer;}",
"#pane-fkiemke .fk-sync:disabled{opacity:.55;cursor:not-allowed;} #pane-fkiemke .fk-sync .ts{font-size:10px;font-weight:500;color:rgba(255,255,255,.72);white-space:nowrap;}",
/* CT4 custom dropdown */
"#pane-fkiemke .custom-dropdown{position:relative;min-width:190px;} @media(max-width:760px){#pane-fkiemke .custom-dropdown{min-width:0;flex:1 1 45%;}}",
"#pane-fkiemke .dropdown-header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px;min-height:44px;border:1.5px solid var(--line,#d0d7de);border-radius:10px;background:var(--panel,#fff);color:var(--text,#1f2937);font-size:13px;font-weight:650;cursor:pointer;user-select:none;transition:border-color .18s;}",
"#pane-fkiemke .custom-dropdown.open .dropdown-header{border-color:var(--accent,#2563eb);}",
"#pane-fkiemke .dropdown-header .chev{width:7px;height:7px;border-right:2px solid var(--muted,#6b7280);border-bottom:2px solid var(--muted,#6b7280);transform:rotate(45deg);transition:transform .2s;flex:none;}",
"#pane-fkiemke .custom-dropdown.open .dropdown-header .chev{transform:rotate(-135deg);}",
"#pane-fkiemke .dropdown-list{position:absolute;top:calc(100% + 6px);left:0;z-index:40;list-style:none;margin:0;padding:5px;background:var(--panel,#fff);border:1px solid var(--line,#e8ecf1);border-radius:11px;box-shadow:0 16px 40px rgba(16,24,40,.18);max-height:280px;overflow-y:auto;white-space:nowrap;min-width:max-content;overflow-x:hidden;opacity:0;visibility:hidden;transform:translateY(-10px);transition:all .2s ease;}",
"#pane-fkiemke .custom-dropdown.open .dropdown-list{opacity:1;visibility:visible;transform:translateY(0);}",
"#pane-fkiemke .dropdown-list li{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 11px;border-radius:8px;font-size:12.5px;color:var(--text,#1f2937);cursor:pointer;white-space:nowrap;}",
"#pane-fkiemke .dropdown-list li:hover{background:#f3f4f6;} #pane-fkiemke .dropdown-list li.sel{font-weight:750;color:var(--accent,#2563eb);} #pane-fkiemke .dropdown-list li .ck{opacity:0;} #pane-fkiemke .dropdown-list li.sel .ck{opacity:1;}",
"#pane-fkiemke .dropdown-list li .cnt{color:var(--muted,#9ca3af);font-size:11px;font-variant-numeric:tabular-nums;}",
"[data-theme] #pane-fkiemke .dropdown-list li:hover{background:color-mix(in srgb,var(--accent,#2563eb) 12%,transparent);}",
/* CT3: Hasaki date picker component */
"#pane-fkiemke .hasaki-date-picker .dropdown-header.hasaki-head{gap:8px;border:1px solid #d9d9d9;border-radius:4px;padding:4px 11px;min-height:44px;background:#fff;color:#1f2937;font-weight:500;}",
"#pane-fkiemke .hasaki-date-picker .hasaki-head .cal{width:16px;height:16px;color:#8c8c8c;flex:none;}",
"#pane-fkiemke .hasaki-date-picker .hasaki-head .lbl{flex:1;font-size:13px;font-variant-numeric:tabular-nums;}",
"#pane-fkiemke .hasaki-date-picker .hasaki-head:hover{border-color:#2f9e6e;} #pane-fkiemke .hasaki-date-picker.open .dropdown-header.hasaki-head{border-color:#2f9e6e;}",
"[data-theme='hasaki'] #pane-fkiemke .hasaki-date-picker .hasaki-head:hover,[data-theme='hasaki'] #pane-fkiemke .hasaki-date-picker.open .hasaki-head{border-color:#326e51;}",
/* CT2: Flatpickr — quick-select (top) + footer + theme Hasaki override */
".flatpickr-calendar.fk-fp,.flatpickr-calendar{box-shadow:0 16px 44px rgba(16,24,40,.22);border-radius:12px;}",
".fk-fp-top{display:flex;flex-wrap:wrap;gap:8px;padding:12px 12px 4px;}",
".fk-pill-q{background:#fff;border:1px solid #d9d9d9;border-radius:999px;padding:6px 14px;font-size:12.5px;font-weight:600;color:#374151;cursor:pointer;transition:border-color .18s,color .18s;}",
".fk-pill-q:hover{border-color:#2f7a55;color:#2f7a55;}",
".fk-fp-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;border-top:1px solid #eef1f5;margin-top:4px;}",
".fk-fp-sel{font-size:12.5px;color:#6b7280;font-variant-numeric:tabular-nums;}",
".fk-fp-btns{display:flex;gap:8px;}",
".fk-fp-clear{background:#fff;border:1px solid #d9d9d9;border-radius:8px;padding:7px 16px;font-size:12.5px;font-weight:600;color:#374151;cursor:pointer;} .fk-fp-clear:hover{border-color:#b42318;color:#b42318;}",
".fk-fp-apply{background:#2f7a55;border:1px solid #2f7a55;border-radius:8px;padding:7px 18px;font-size:12.5px;font-weight:700;color:#fff;cursor:pointer;} .fk-fp-apply:hover{background:#276646;}",
/* ngày chọn / range = xanh Hasaki */
".flatpickr-day.selected,.flatpickr-day.startRange,.flatpickr-day.endRange{background:#2f7a55!important;border-color:#2f7a55!important;color:#fff!important;}",
".flatpickr-day.inRange{background:#e3f2ea!important;border-color:#e3f2ea!important;box-shadow:-5px 0 0 #e3f2ea,5px 0 0 #e3f2ea!important;}",
".flatpickr-day.today{border-color:#2f7a55;} .flatpickr-day:hover{background:#eef4f0;}",
".flatpickr-months .flatpickr-month{color:#1f2937;} .flatpickr-current-month .flatpickr-monthDropdown-months,.flatpickr-current-month input.cur-year{font-weight:700;}",
/* nút Prev/Next dạng viền bo góc */
".flatpickr-prev-month,.flatpickr-next-month{top:8px!important;padding:0!important;width:30px;height:26px;border:1px solid #d9d9d9;border-radius:6px;display:flex;align-items:center;justify-content:center;margin:0 8px;}",
".flatpickr-prev-month:hover,.flatpickr-next-month:hover{border-color:#2f7a55;} .flatpickr-prev-month svg,.flatpickr-next-month svg{fill:#374151;width:11px;}",
/* fade */
"#pane-fkiemke .fk-anim{animation:fk-in .4s cubic-bezier(.32,.72,0,1);} @keyframes fk-in{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:none;}}",
/* hero */
"#pane-fkiemke .fk-hero{background:var(--panel,#fff);border:1px solid var(--line,#e8ecf1);border-radius:18px;padding:22px 24px;margin-bottom:16px;}",
"#pane-fkiemke .fk-herotop{display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:10px;margin-bottom:14px;}",
"#pane-fkiemke .fk-hlabel{font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--muted,#9ca3af);}",
"#pane-fkiemke .fk-hpct{font-size:44px;font-weight:820;line-height:.9;font-variant-numeric:tabular-nums;color:var(--text,#1f2937);}",
"#pane-fkiemke .fk-hsub{font-size:13px;color:var(--muted,#6b7280);font-weight:600;}",
"#pane-fkiemke .fk-hbar{display:flex;height:16px;border-radius:999px;overflow:hidden;background:color-mix(in srgb,var(--muted,#9ca3af) 18%,transparent);}",
"#pane-fkiemke .fk-hbar i{display:block;height:100%;transition:width 1s cubic-bezier(.4,0,.2,1);}",
"#pane-fkiemke .fk-hbar .v{background:linear-gradient(90deg,#0f766e,#14b8a6);} #pane-fkiemke .fk-hbar .p{background:linear-gradient(90deg,#d97706,#f59e0b);}",
"#pane-fkiemke .fk-hleg{display:flex;flex-wrap:wrap;gap:16px;margin-top:12px;} #pane-fkiemke .fk-hleg span{display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--text,#374151);} #pane-fkiemke .fk-hleg .dot{width:10px;height:10px;border-radius:3px;} #pane-fkiemke .fk-hleg b{font-variant-numeric:tabular-nums;}",
/* widgets */
"#pane-fkiemke .fk-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:14px;}",
"#pane-fkiemke .fk-w{background:var(--panel,#fff);border:1px solid var(--line,#e8ecf1);border-radius:16px;padding:16px 18px;display:flex;flex-direction:column;}",
"#pane-fkiemke .fk-w-cov{grid-column:span 3;} #pane-fkiemke .fk-w-disc{grid-column:span 3;} #pane-fkiemke .fk-w-vel{grid-column:span 3;} #pane-fkiemke .fk-w-trend{grid-column:span 3;} #pane-fkiemke .fk-w-top{grid-column:span 12;}",
"#pane-fkiemke .fk-covnum{font-size:24px;font-weight:800;color:var(--text,#1f2937);font-variant-numeric:tabular-nums;margin-bottom:10px;} #pane-fkiemke .fk-covnum b{color:#2563eb;}",
"#pane-fkiemke .fk-covbar{height:10px;border-radius:999px;overflow:hidden;background:color-mix(in srgb,var(--muted,#9ca3af) 18%,transparent);margin-bottom:8px;} #pane-fkiemke .fk-covbar i{display:block;height:100%;background:linear-gradient(90deg,#2563eb,#0ea5e9);transition:width 1s cubic-bezier(.4,0,.2,1);}",
"#pane-fkiemke .fk-covpct{font-size:12px;font-weight:650;color:var(--muted,#6b7280);}",
"@media(max-width:900px){#pane-fkiemke .fk-grid{grid-template-columns:1fr;} #pane-fkiemke .fk-w{grid-column:1/-1 !important;}}",
"#pane-fkiemke .fk-wh{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;} #pane-fkiemke .fk-wt{font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--muted,#9ca3af);}",
"#pane-fkiemke .fk-see{background:transparent;border:1px solid var(--line,#d0d7de);color:var(--accent,#2563eb);border-radius:8px;padding:4px 10px;font-size:11px;font-weight:650;cursor:pointer;} #pane-fkiemke .fk-see:hover{background:color-mix(in srgb,var(--accent,#2563eb) 8%,transparent);}",
"#pane-fkiemke .fk-discrows{display:flex;flex-direction:column;gap:12px;flex:1;justify-content:center;} #pane-fkiemke .fk-discrows .row{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding-bottom:12px;border-bottom:1px solid var(--line,#eef1f5);} #pane-fkiemke .fk-discrows .row:last-child{border-bottom:0;padding-bottom:0;}",
"#pane-fkiemke .fk-discrows .lbl{font-size:13px;color:var(--text,#374151);} #pane-fkiemke .fk-discrows .lbl b{font-size:22px;font-weight:800;margin-right:5px;font-variant-numeric:tabular-nums;} #pane-fkiemke .fk-discrows .val{font-size:12.5px;font-weight:700;white-space:nowrap;}",
"#pane-fkiemke .fk-velbody{flex:1;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;gap:10px;} #pane-fkiemke .fk-velnum{font-size:3.5rem;font-weight:700;line-height:1;font-variant-numeric:tabular-nums;color:var(--text,#1f2937);}",
"#pane-fkiemke .fk-velbadge{padding:5px 13px;border-radius:999px;font-size:12px;font-weight:700;} #pane-fkiemke .fk-velbadge.fk-up{background:#d1faf3;color:#0f766e;} #pane-fkiemke .fk-velbadge.fk-down{background:#fdecea;color:#b42318;} #pane-fkiemke .fk-velbadge.fk-flat{background:color-mix(in srgb,var(--muted,#9ca3af) 20%,transparent);color:var(--muted,#6b7280);}",
"#pane-fkiemke .fk-chart{display:flex;align-items:flex-end;gap:7px;height:96px;margin-top:auto;padding-top:6px;} #pane-fkiemke .fk-col{flex:1;display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer;height:100%;justify-content:flex-end;}",
"#pane-fkiemke .fk-colbar{width:70%;min-height:3px;background:linear-gradient(180deg,#5eead4,#2dd4bf);border-radius:4px 4px 0 0;transition:height .7s cubic-bezier(.4,0,.2,1);} #pane-fkiemke .fk-collab{font-size:9.5px;color:var(--muted,#9ca3af);} #pane-fkiemke .fk-colval{font-size:10px;font-weight:700;color:var(--text,#374151);}",
"#pane-fkiemke .fk-mini{overflow-x:auto;-webkit-overflow-scrolling:touch;} #pane-fkiemke .fk-mini table{width:100%;border-collapse:collapse;font-size:12.5px;min-width:340px;} #pane-fkiemke .fk-mini td{padding:7px 8px;border-top:1px solid var(--line,#eef1f5);white-space:nowrap;} #pane-fkiemke .fk-mini tr{cursor:pointer;} #pane-fkiemke .fk-mini tr:hover td{background:color-mix(in srgb,var(--accent,#2563eb) 6%,transparent);} #pane-fkiemke .fk-mini .rank{color:var(--muted,#9ca3af);width:20px;} #pane-fkiemke .fk-mini .pn{color:var(--muted,#6b7280);max-width:150px;overflow:hidden;text-overflow:ellipsis;} #pane-fkiemke .fk-mini .num{text-align:right;font-variant-numeric:tabular-nums;font-weight:700;}",
"#pane-fkiemke .d-am{color:#dc2626;} #pane-fkiemke .d-duong{color:#2563eb;} #pane-fkiemke .d-khop{color:var(--muted,#9ca3af);}",
"#pane-fkiemke .empty-state{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:26px 14px;text-align:center;min-height:150px;} #pane-fkiemke .empty-state svg{width:42px;height:42px;} #pane-fkiemke .empty-state p{margin:0;color:var(--muted,#9ca3af);font-style:italic;font-size:13px;}",
"#pane-fkiemke .fk-ph{padding:60px 20px;text-align:center;color:var(--muted,#9ca3af);} #pane-fkiemke .fk-ph b{display:block;font-size:15px;color:var(--text,#374151);margin-bottom:6px;}",
"#pane-fkiemke .fk-state{padding:48px 20px;text-align:center;color:var(--muted,#6b7280);} #pane-fkiemke .fk-spin{width:30px;height:30px;border:3px solid var(--line,#d5dbe4);border-top-color:var(--accent,#2563eb);border-radius:50%;margin:0 auto 14px;animation:fk-sp .8s linear infinite;} @keyframes fk-sp{to{transform:rotate(360deg)}}",
"#pane-fkiemke .fk-gl{color:#b45309;font-weight:700;}",
/* wms-link + modal + badge */
".wms-link{color:#0056b3;text-decoration:none;font-weight:600;display:inline-flex;align-items:center;gap:3px;} .wms-link:hover{text-decoration:underline;} .wms-link svg{width:12px;height:12px;opacity:.85;flex:none;}",
".fk-modal{display:none;position:fixed;inset:0;z-index:1250;align-items:center;justify-content:center;padding:clamp(10px,3vw,40px);background:rgba(17,24,39,.55);backdrop-filter:blur(6px);opacity:0;transition:opacity .22s;} .fk-modal.show{opacity:1;}",
".fk-modal .fk-mbox{background:var(--panel,#fff);color:var(--text,#1f2937);border-radius:18px;width:min(1400px,100%);max-height:92vh;display:flex;flex-direction:column;box-shadow:0 30px 70px rgba(16,24,40,.35);transform:translateY(14px) scale(.985);opacity:.6;transition:transform .26s,opacity .26s;overflow:hidden;} .fk-modal.show .fk-mbox{transform:none;opacity:1;}",
".fk-mhead{display:flex;align-items:center;gap:14px;padding:16px 20px;border-bottom:1px solid var(--line,#e8ecf1);} .fk-mtitle{font-weight:750;font-size:16px;} .fk-mtitle small{display:block;font-size:11.5px;color:var(--muted,#9ca3af);font-weight:500;margin-top:2px;} .fk-mclose{margin-left:auto;background:0;border:0;font-size:24px;cursor:pointer;color:var(--muted,#9ca3af);min-width:44px;min-height:44px;border-radius:10px;} .fk-mclose:hover{color:#ef4444;background:color-mix(in srgb,#ef4444 12%,transparent);}",
".fk-mctrl{display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:12px 20px;border-bottom:1px solid var(--line,#e8ecf1);} .fk-mpills{display:inline-flex;gap:2px;background:color-mix(in srgb,var(--muted,#9ca3af) 12%,transparent);border-radius:999px;padding:3px;} .fk-mpill{border:0;background:transparent;padding:7px 16px;border-radius:999px;font-weight:650;font-size:12.5px;cursor:pointer;color:var(--muted,#6b7280);min-height:36px;} .fk-mpill.active{background:var(--accent,#1f2937);color:#fff;}",
".fk-msearch{flex:1 1 200px;max-width:320px;padding:9px 12px;border:1px solid var(--line,#d5dbe4);border-radius:9px;background:var(--panel,#fff);color:var(--text,#1f2937);font-size:12.5px;min-height:38px;}",
".fk-mwrap{overflow:auto;-webkit-overflow-scrolling:touch;flex:1;} .fk-mtbl{border-collapse:separate;border-spacing:0;font-size:12.5px;width:100%;min-width:900px;} .fk-mtbl th,.fk-mtbl td{padding:9px 12px;border-bottom:1px solid var(--line,#eef1f5);white-space:nowrap;text-align:left;vertical-align:top;} .fk-mtbl thead th{position:sticky;top:0;z-index:3;background:var(--accent,#1f2937);color:#fff;font-size:10.5px;font-weight:650;text-transform:uppercase;} .fk-mtbl th.stick,.fk-mtbl td.stick{position:sticky;left:0;z-index:2;background:var(--panel,#fff);} .fk-mtbl thead th.stick{z-index:4;background:var(--accent,#1f2937);} .fk-mtbl tbody tr:hover td{background:color-mix(in srgb,var(--accent,#2563eb) 6%,transparent);} .fk-mtbl .num{text-align:right;font-variant-numeric:tabular-nums;} .fk-mtbl .skucell .pn{display:block;white-space:normal;max-width:300px;color:var(--muted,#6b7280);line-height:1.35;margin-top:2px;} .fk-mtbl .loc{font-family:ui-monospace,Consolas,monospace;color:#0f9488;}",
".fk-mnote{padding:10px 20px;font-size:11.5px;color:var(--muted,#9ca3af);border-top:1px solid var(--line,#e8ecf1);}",
".fk-badge{display:inline-block;padding:2px 9px;border-radius:999px;font-size:10px;font-weight:750;white-space:nowrap;} .fk-badge.verified{background:#d1faf3;color:#0f766e;} .fk-badge.processing{background:#fdecd0;color:#b45309;} .fk-badge.pending{background:color-mix(in srgb,#9ca3af 22%,transparent);color:#6b7280;} .fk-badge.reject{background:#fdecea;color:#b42318;}",
"#fkToast{position:fixed;left:50%;bottom:28px;transform:translate(-50%,16px);background:#111827;color:#fff;padding:12px 20px;border-radius:12px;font-size:13px;font-weight:600;box-shadow:0 24px 60px rgba(16,24,40,.35);opacity:0;pointer-events:none;z-index:1400;max-width:92vw;text-align:center;transition:opacity .25s,transform .25s;} #fkToast.show{opacity:1;transform:translate(-50%,0);} #fkToast.ok{background:#0f766e;} #fkToast.warn{background:#b45309;} #fkToast.err{background:#b42318;}",
].join("\n");

var KHUNG =
'<nav class="fk-nav" id="fkNav"></nav>' +
'<div class="fk-filter">' +
'  <div class="fk-fld"><label>Kho</label><div class="custom-dropdown" id="ddWh"></div></div>' +
'  <div class="fk-fld"><label>Loại kiểm kê</label><div class="custom-dropdown" id="ddType"></div></div>' +
'  <div class="fk-fld" id="fldCat"><label>Nhóm hàng</label><div class="custom-dropdown" id="ddCat"></div></div>' +
'  <div class="fk-fld"><label>Trạng thái</label><div class="custom-dropdown" id="ddStatus"></div></div>' +
'  <div class="fk-fld"><label>Khoảng ngày</label><div class="custom-dropdown hasaki-date-picker" id="ddDate"></div></div>' +
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

/* ===== TẢI 2 NGUỒN ===== */
function loadData(){
  _giaLap = false; _loaded = 0;
  $id("fkState").style.display = "block"; $id("fkState").innerHTML = '<div class="fk-spin"></div>Đang tải dữ liệu kiểm kê…'; $id("fkBody").innerHTML = "";
  taiSheet(TAB_SKU, function(h, r){ if (!r.length){ taiSheet(TAB_SKU_FB, function(h2, r2){ rawSkuData = mapSku(h2, r2); xong(); }, function(){ rawSkuData = []; xong(); }); } else { rawSkuData = mapSku(h, r); xong(); } }, function(){ taiSheet(TAB_SKU_FB, function(h2, r2){ rawSkuData = mapSku(h2, r2); xong(); }, function(){ rawSkuData = []; xong(); }); });
  taiSheet(TAB_LOC, function(h, r){ rawLocationData = r.length ? mapLoc(h, r) : []; xong(); }, function(){ rawLocationData = []; xong(); });
  loadTs();
}
function taiSheet(tab, ok, fail){
  var cb = "fkgv_" + tab.replace(/[^a-z0-9]/gi, "");
  window[cb] = function(resp){
    try{ if (resp.status === "error") return fail();
      var header = ((resp.table && resp.table.cols) || []).map(function(c){ return String((c && c.label) || "").trim(); });
      var rows = ((resp.table && resp.table.rows) || []).map(function(r){ return (r.c || []).map(function(c){ return c ? (c.v == null ? "" : c.v) : ""; }); });
      ok(header, rows);
    }catch(e){ fail(); }
  };
  var sc = document.createElement("script"); sc.src = "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/gviz/tq?tqx=out:json;responseHandler:" + cb + "&sheet=" + encodeURIComponent(tab) + "&headers=1";
  sc.onerror = fail; document.body.appendChild(sc); setTimeout(function(){ sc.remove(); }, 20000);
}
function xong(){ if (++_loaded < 2) return;
  if (!rawSkuData.length && !rawLocationData.length){ _giaLap = true; rawSkuData = MOCK_SKU.slice(); rawLocationData = deriveLoc(rawSkuData); toast("Sheet chưa có dữ liệu — hiển thị GIẢ LẬP.", "warn"); }
  else if (!rawLocationData.length) rawLocationData = deriveLoc(rawSkuData);   // suy Location từ SKU nếu chưa có sheet loc
  khoiTao();
}
// CT1: khớp cột theo tên đã CHUẨN HOÁ (bỏ khoảng trắng thừa + thường hoá) -> bắt mọi biến thể "ID"/"id"/"ID "/" Id"
function idx(header, names){
  var H = header.map(function(h){ return String(h || "").replace(/\s+/g, " ").trim().toLowerCase(); });
  for (var i = 0; i < names.length; i++){ var key = String(names[i]).replace(/\s+/g, " ").trim().toLowerCase(); var j = H.indexOf(key); if (j >= 0) return j; }
  return -1;
}
function mapSku(header, rows){
  var c = { no: idx(header, ["No.", "No", "STT"]), id: idx(header, ["ID"]), req: idx(header, ["Request code"]), source: idx(header, ["Source code"]),
    wh: idx(header, ["Warehouse"]), sku: idx(header, ["SKU"]), pn: idx(header, ["Product Name", "ProductName"]), category: idx(header, ["Category", "CategoryName"]),
    type: idx(header, ["Type"]), vat: idx(header, ["Required VAT"]), priority: idx(header, ["Priority"]),
    dloc: idx(header, ["Diff By Location", "Diff"]), dsku: idx(header, ["Diff By Sku", "Diff By SKU"]), inv: idx(header, ["Inventory", "SystemQty"]),
    cnt: idx(header, ["Quantity Count", "CountedQty"]), assign: idx(header, ["Assign to"]), by: idx(header, ["Counted by"]),
    cdate: idx(header, ["Counted date"]), upd: idx(header, ["Updated At", "Updated"]), plan: idx(header, ["Plan Date"]), st: idx(header, ["Status"]), loc: idx(header, ["Location", "LocationDescription"]) };
  var g = function(r, i){ return i >= 0 && r[i] != null ? r[i] : ""; };
  var num = function(v){ return v === "" || v == null ? null : (Number(v) || 0); };
  return rows.filter(function(r){ return String(g(r, c.sku) || "") !== ""; }).map(function(r, i){
    var inv = num(g(r, c.inv)) || 0, cnt = num(g(r, c.cnt));
    var dl = c.dloc >= 0 && g(r, c.dloc) !== "" ? (Number(g(r, c.dloc)) || 0) : (cnt == null ? 0 : cnt - inv);
    var ds = c.dsku >= 0 && g(r, c.dsku) !== "" ? (Number(g(r, c.dsku)) || 0) : null;
    return { no: c.no >= 0 ? g(r, c.no) : i + 1, id: String(g(r, c.id) || ""), req: String(g(r, c.req) || ""), source: String(g(r, c.source) || ""),
      wh: String(g(r, c.wh) || ""), sku: String(g(r, c.sku) || ""), pn: String(g(r, c.pn) || ""), category: String(g(r, c.category) || ""),
      type: String(g(r, c.type) || ""), vat: String(g(r, c.vat) || ""), priority: String(g(r, c.priority) || ""), inv: inv, cnt: cnt, diffLoc: dl, diffSku: ds,
      loc: String(g(r, c.loc) || ""), assignTo: String(g(r, c.assign) || ""), countedBy: String(g(r, c.by) || ""), countedDate: String(g(r, c.cdate) || ""),
      updatedAt: String(g(r, c.upd) || ""), planDate: String(g(r, c.plan) || ""), status: String(g(r, c.st) || "") };
  });
}
function mapLoc(header, rows){
  var c = { no: idx(header, ["No.", "No"]), id: idx(header, ["ID"]), req: idx(header, ["Request code"]), source: idx(header, ["Source code"]),
    wh: idx(header, ["Warehouse"]), type: idx(header, ["Type"]), loc: idx(header, ["Location", "LocationDescription"]), priority: idx(header, ["Priority"]),
    diff: idx(header, ["Diff", "Diff By Location"]), assign: idx(header, ["Assign to"]), by: idx(header, ["Counted by"]), cdate: idx(header, ["Counted date"]),
    upd: idx(header, ["Updated At", "Updated"]), plan: idx(header, ["Plan Date"]), st: idx(header, ["Status"]) };
  var g = function(r, i){ return i >= 0 && r[i] != null ? r[i] : ""; };
  return rows.filter(function(r){ return String(g(r, c.loc) || "") !== ""; }).map(function(r, i){
    return { no: c.no >= 0 ? g(r, c.no) : i + 1, id: String(g(r, c.id) || ""), req: String(g(r, c.req) || ""), source: String(g(r, c.source) || ""),
      wh: String(g(r, c.wh) || ""), type: String(g(r, c.type) || ""), loc: String(g(r, c.loc) || ""), priority: String(g(r, c.priority) || ""),
      diff: Number(g(r, c.diff)) || 0, assignTo: String(g(r, c.assign) || ""), countedBy: String(g(r, c.by) || ""), countedDate: String(g(r, c.cdate) || ""),
      updatedAt: String(g(r, c.upd) || ""), planDate: String(g(r, c.plan) || ""), status: String(g(r, c.st) || "") };
  });
}
// Suy Location từ SKU (gom theo vị trí) khi chưa có sheet kiemke-location
function deriveLoc(sku){
  var g = {}; sku.forEach(function(r){ var o = g[r.loc] || (g[r.loc] = { loc: r.loc, wh: r.wh, diff: 0, upd: r.updatedAt, cdate: r.countedDate, allCounted: true }); o.diff += r.diffLoc; if (r.cnt == null) o.allCounted = false; });
  return Object.keys(g).map(function(k, i){ var o = g[k];
    return { no: i + 1, id: "", req: "", source: "", wh: o.wh, type: "", loc: o.loc, priority: "", diff: o.diff, assignTo: "", countedBy: "",
      countedDate: o.cdate, updatedAt: o.upd, planDate: "", status: o.allCounted ? (o.diff === 0 ? "VERIFIED" : "PROCESSING") : "NOT COUNT" }; });
}
function loadTs(){ window.fkgv_ts = function(resp){ var ts = resp && resp.status === "success" ? Number(resp.ts || 0) : 0; if (ts > 0){ _lastSyncMs = ts; var d = new Date(ts); $id("fkSyncTs").textContent = "Mới nhất: " + p2(d.getHours()) + ":" + p2(d.getMinutes()) + " " + p2(d.getDate()) + "/" + p2(d.getMonth() + 1); } };
  var sc = document.createElement("script"); sc.src = APPSCRIPT_URL + "?action=lastSync&tab=" + encodeURIComponent(TAB_SKU) + "&callback=fkgv_ts"; document.body.appendChild(sc); setTimeout(function(){ sc.remove(); }, 15000); }

/* ===== active array + filters ===== */
function rawActive(){ return activeTab === "loc" ? rawLocationData : rawSkuData; }
/* CT3: GỘP cho KPI Dashboard — 1 SKU/Location kiểm nhiều lần trong khoảng ngày -> giữ BẢN GHI MỚI NHẤT
   (theo Counted date/Updated At). Dùng cho hero/velocity/discrepancy/chart/top. Modal KHÔNG gọi hàm này. */
function dedupLatest(rows, kind){
  var m = {}; rows.forEach(function(r){
    var k = kind === "loc" ? r.loc : r.sku; if (!k) return;
    var t = countMs(r); t = isNaN(t) ? -Infinity : t;
    if (!m[k] || t >= m[k]._t){ r._t = t; m[k] = r; }
  });
  return Object.keys(m).map(function(k){ return m[k]; });   // mỗi SKU/Location DUY NHẤT 1 dòng (mới nhất)
}
function rowsKho(arr){ return arr.filter(function(r){ return r.wh === selWh; }); }
// CT2: lọc theo khoảng ngày THẬT (Counted date). null = Tất cả.
function trongKhoang(r){
  if (!dateFrom && !dateTo) return true;
  var t = countMs(r); if (isNaN(t)) return false;
  if (dateFrom && t < dateFrom.getTime()) return false;
  if (dateTo && t > dateTo.getTime()) return false;
  return true;
}
function dayStart(d){ var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function dayEnd(d){ var x = new Date(d); x.setHours(23, 59, 59, 999); return x; }
function rowsBase(kind){
  var arr = kind === "loc" ? rawLocationData : rawSkuData;
  return rowsKho(arr).filter(function(r){
    if (selStatus && String(r.status || "").toUpperCase() !== selStatus) return false;
    // CT1: khớp Type BỎ hoa/thường + BỎ dấu phân cách ("sku - factory" == "SKU - Factory" == "SKU_FACTORY")
    if (selType && normType(r.type) !== normType(selType)) return false;
    if (kind !== "loc" && selCat && catOf(r) !== selCat) return false;
    return trongKhoang(r);
  });
}
function khoiTao(){
  WHS = []; rawSkuData.concat(rawLocationData).forEach(function(r){ if (r.wh && WHS.indexOf(r.wh) < 0) WHS.push(r.wh); });
  var uu = function(w){ return /MTG/i.test(w) ? 0 : /GARMENT/i.test(w) ? 1 : 2; };
  WHS.sort(function(a, b){ return uu(a) - uu(b) || a.localeCompare(b); });
  if (!selWh || WHS.indexOf(selWh) < 0) selWh = WHS[0] || "";
  renderNav(); buildDropdowns();
  $id("fkState").style.display = "none";
  veLai();
}

/* ===== CT2 nav tabs ===== */
function renderNav(){ $id("fkNav").innerHTML = NAVTABS.map(function(t){ return '<button class="fk-navt' + (t.k === activeTab ? " active" : "") + (t.on ? "" : " off") + '" data-nav="' + t.k + '">' + esc(t.label) + "</button>"; }).join(""); }

/* ===== CT4 custom dropdowns ===== */
function buildDropdowns(){
  var whOpts = WHS.map(function(w){ return { v: w, label: w }; });
  ddRender("ddWh", whOpts, selWh, function(v){ selWh = v; selCat = ""; veLai(); });
  // CT4: Loại kiểm kê
  var typeOpts = [{ v: "", label: "Tất cả" }].concat(TYPES.map(function(t){ return { v: t, label: t }; }));
  ddRender("ddType", typeOpts, selType, function(v){ selType = v; veLai(); if ($id("fkModal").classList.contains("show")) renderModal(); });
  // Category: theo SKU của kho đang chọn
  var cats = {}; rowsKho(rawSkuData).forEach(function(r){ var c = catOf(r); cats[c] = (cats[c] || 0) + 1; });
  var catOpts = [{ v: "", label: "Tất cả nhóm" }].concat(Object.keys(cats).sort().map(function(c){ return { v: c, label: c, cnt: cats[c] }; }));
  ddRender("ddCat", catOpts, selCat, function(v){ selCat = v; veLai(); });
  var stOpts = [{ v: "", label: "Tất cả trạng thái" }].concat(STATUSES.map(function(s){ return { v: s, label: s }; }));
  ddRender("ddStatus", stOpts, selStatus, function(v){ selStatus = v; veLai(); if ($id("fkModal").classList.contains("show")) renderModal(); });
  setupDatePicker();
  $id("fldCat").style.display = activeTab === "loc" ? "none" : "";   // Location không lọc theo nhóm hàng
}
function fmtD(d){ return p2(d.getDate()) + "/" + p2(d.getMonth() + 1) + "/" + d.getFullYear(); }
function dateLabel(){ if (!dateFrom && !dateTo) return "Tất cả"; return (dateFrom ? fmtD(dateFrom) : "…") + " - " + (dateTo ? fmtD(dateTo) : "…"); }

/* CT2: Advanced Date Range Picker (Flatpickr) — dual calendar + quick-select + footer, theme Hasaki */
function loadFlatpickr(cb){
  if (window.flatpickr) return cb();
  if (!document.getElementById("fp-css")){ var l = document.createElement("link"); l.id = "fp-css"; l.rel = "stylesheet"; l.href = "https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css"; document.head.appendChild(l); }
  var s = document.getElementById("fp-js");
  if (s){ s.addEventListener("load", cb); return; }
  s = document.createElement("script"); s.id = "fp-js"; s.src = "https://cdn.jsdelivr.net/npm/flatpickr"; s.onload = cb; s.onerror = function(){ log && 0; };
  document.body.appendChild(s);
}
function setupDatePicker(){
  var el = $id("ddDate"); if (!el) return;
  // header kiểu Hasaki + input ẩn cho flatpickr
  el.innerHTML = '<div class="dropdown-header hasaki-head" id="fkDateHead"><svg class="cal" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/></svg><span class="lbl" id="fkDateLbl">' + esc(dateLabel()) + '</span><span class="chev"></span></div><input id="fkDateInput" type="text" style="position:absolute;opacity:0;pointer-events:none;width:1px;height:1px;bottom:0;left:0">';
  loadFlatpickr(function(){ initFlatpickr(); });
  $id("fkDateHead").onclick = function(){ if (_fp) _fp.open(); };
}
function applyRange(from, to){   // from/to là Date (hoặc null)
  dateFrom = from ? dayStart(from) : null;
  dateTo = to ? dayEnd(to) : null;
  var lbl = $id("fkDateLbl"); if (lbl) lbl.textContent = dateLabel();
  veLai(); if ($id("fkModal").classList.contains("show")) renderModal();
}
function initFlatpickr(){
  if (!window.flatpickr) return;
  if (_fp){ try { _fp.destroy(); } catch (e) {} _fp = null; }
  _fp = window.flatpickr($id("fkDateInput"), {
    mode: "range", showMonths: 2, dateFormat: "Y-m-d", locale: { rangeSeparator: " - " },
    defaultDate: (dateFrom && dateTo) ? [dateFrom, dateTo] : null, clickOpens: false, closeOnSelect: false,
    onReady: function(sel, str, fp){ dungKhungHasaki(fp); },
    onChange: function(sel, str, fp){ capNhatFooter(fp); },
  });
}
function quickRange(kind){
  var today = new Date(); var from = new Date(), to = new Date();
  if (kind === "today"){ from = today; to = today; }
  else if (kind === "7d"){ from = new Date(today.getTime() - 7 * 86400000); to = today; }
  else if (kind === "30d"){ from = new Date(today.getTime() - 30 * 86400000); to = today; }
  else if (kind === "month"){ from = new Date(today.getFullYear(), today.getMonth(), 1); to = today; }
  else { from = null; to = null; }   // Tất cả
  return { from: from, to: to };
}
function capNhatFooter(fp){
  var box = fp.calendarContainer.querySelector(".fk-fp-sel"); if (!box) return;
  var d = fp.selectedDates;
  box.textContent = d.length === 2 ? (fmtD(d[0]) + " → " + fmtD(d[1])) : d.length === 1 ? (fmtD(d[0]) + " → …") : "Chưa chọn";
}
function dungKhungHasaki(fp){
  var c = fp.calendarContainer; if (c.querySelector(".fk-fp-top")) return;
  // Quick-select (top)
  var top = document.createElement("div"); top.className = "fk-fp-top";
  var quicks = [["today", "Hôm nay"], ["7d", "7 ngày"], ["30d", "30 ngày"], ["month", "Tháng này"], ["all", "Tất cả"]];
  top.innerHTML = quicks.map(function(q){ return '<button type="button" class="fk-pill-q" data-q="' + q[0] + '">' + q[1] + "</button>"; }).join("");
  top.addEventListener("click", function(e){ var b = e.target.closest("[data-q]"); if (!b) return; var r = quickRange(b.getAttribute("data-q")); if (r.from) fp.setDate([r.from, r.to], true); else fp.clear(); capNhatFooter(fp); });
  c.insertBefore(top, c.firstChild);
  // Footer
  var ft = document.createElement("div"); ft.className = "fk-fp-foot";
  ft.innerHTML = '<span class="fk-fp-sel">Chưa chọn</span><span class="fk-fp-btns"><button type="button" class="fk-fp-clear">Xoá</button><button type="button" class="fk-fp-apply">Áp dụng</button></span>';
  ft.querySelector(".fk-fp-clear").onclick = function(){ fp.clear(); applyRange(null, null); fp.close(); };
  ft.querySelector(".fk-fp-apply").onclick = function(){ var d = fp.selectedDates; applyRange(d[0] || null, d[1] || d[0] || null); fp.close(); };
  c.appendChild(ft);
  capNhatFooter(fp);
}
function ddRender(mountId, opts, cur, cb){
  var el = $id(mountId); if (!el) return;
  var curLabel = (opts.filter(function(o){ return o.v === cur; })[0] || opts[0] || { label: "" }).label;
  el.innerHTML = '<div class="dropdown-header"><span class="lbl">' + esc(curLabel) + '</span><span class="chev"></span></div>' +
    '<ul class="dropdown-list">' + opts.map(function(o){ return '<li data-v="' + esc(o.v) + '" class="' + (o.v === cur ? "sel" : "") + '"><span>' + esc(o.label) + (o.cnt != null ? ' <span class="cnt">(' + o.cnt + ')</span>' : "") + '</span><span class="ck">✓</span></li>'; }).join("") + "</ul>";
  el._cb = cb;
}

/* ===== COUNTUP / FADE ===== */
function countUp(el){ var to = Number(el.getAttribute("data-count")) || 0, dec = el.getAttribute("data-dec") === "1", suf = el.getAttribute("data-suf") || ""; var t0 = performance.now(), dur = 750;
  function step(t){ var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3), v = to * e; el.textContent = (dec ? v.toFixed(1) : Math.round(v).toLocaleString("en-US")) + suf; if (k < 1) requestAnimationFrame(step); } requestAnimationFrame(step); }
function runCount(){ PANE.querySelectorAll("[data-count]").forEach(countUp); }

/* ===== DASHBOARD ===== */
function veLai(){
  // tab placeholder
  var nav = NAVTABS.filter(function(t){ return t.k === activeTab; })[0];
  if (nav && !nav.on){ $id("fkBody").innerHTML = '<div class="fk-ph"><b>' + esc(nav.label) + '</b>Tính năng đang phát triển — sẽ bổ sung khi WMS mở API.</div>'; return; }

  var kind = activeTab === "loc" ? "loc" : "sku";
  var all = rowsKho(kind === "loc" ? rawLocationData : rawSkuData);
  refDay = 0; all.forEach(function(r){ var d = dayKey(countMs(r)); if (!isNaN(d) && d > refDay) refDay = d; });
  if (!refDay) refDay = Math.floor(Date.now() / 86400000);
  var rows = dedupLatest(rowsBase(kind), kind);   // CT3: KPI dashboard GỘP unique (modal dùng raw)

  // CT2 ĐỘ PHỦ (Coverage): Total = SKU/Location DUY NHẤT thuộc Kho+Nhóm+Loại (KHÔNG lọc status/ngày);
  // Counted = số DUY NHẤT có Status ≠ NOT COUNT hoặc đã có Quantity Count.
  var arrCov = kind === "loc" ? rawLocationData : rawSkuData;
  var covRows = rowsKho(arrCov).filter(function(r){ if (selType && String(r.type || "") !== selType) return false; if (kind !== "loc" && selCat && catOf(r) !== selCat) return false; return true; });
  var totSet = {}, cntSet = {};
  covRows.forEach(function(r){ var k = kind === "loc" ? r.loc : r.sku; if (!k) return; totSet[k] = 1; var st = String(r.status || "").toUpperCase(); if (r.cnt != null || (st !== "" && st !== "NOT COUNT")) cntSet[k] = 1; });
  var covTot = Object.keys(totSet).length, covCnt = Object.keys(cntSet).length, covPct = covTot ? covCnt / covTot * 100 : 0;
  var covUnit = kind === "loc" ? "Location" : "SKU";

  // KPI qua metric() (CT3)
  var v = 0, p = 0, pd = 0, neg = 0, pos = 0, sNeg = 0, sPos = 0;
  rows.forEach(function(r){ var m = metric(r); if (!m.counted) pd++; else if (m.label === "khop") v++; else p++;
    if (m.counted && m.label === "am"){ neg++; sNeg += m.diff; } if (m.counted && m.label === "duong"){ pos++; sPos += m.diff; } });
  var tot = rows.length, counted = v + p, pct = tot ? counted / tot * 100 : 0, pV = tot ? v / tot * 100 : 0, pP = tot ? p / tot * 100 : 0;
  var unit = kind === "loc" ? "Location" : "bản ghi SKU";

  var demT = 0, demY = 0; rows.forEach(function(r){ if (!metric(r).counted) return; var d = dayKey(countMs(r)); if (d === refDay) demT++; else if (d === refDay - 1) demY++; });
  var delta = demY ? (demT - demY) / demY * 100 : (demT ? 100 : 0);
  var dTxt = demY ? ((delta >= 0 ? "▲ +" : "▼ ") + Math.abs(delta).toFixed(0) + "% so với hôm qua") : (demT ? "▲ mới có hôm nay" : "—");
  var dCls = !demY ? "fk-flat" : delta > 0 ? "fk-up" : delta < 0 ? "fk-down" : "fk-flat";

  var days = [], maxD = 1; for (var i = 6; i >= 0; i--){ var dk = refDay - i, c = 0; rows.forEach(function(r){ if (metric(r).counted && dayKey(countMs(r)) === dk) c++; }); days.push({ dk: dk, c: c }); if (c > maxD) maxD = c; }
  var chart = days.map(function(d){ var h = Math.round(d.c / maxD * 100); return '<div class="fk-col" data-drill="day" data-v="' + d.dk + '" title="' + fmtDMY(d.dk) + ': ' + d.c + '"><div class="fk-colval">' + (d.c || "") + '</div><div class="fk-colbar" style="height:' + h + '%"></div><div class="fk-collab">' + fmtDMY(d.dk) + '</div></div>'; }).join("");

  // Top (SKU tab -> theo SKU; Location tab -> theo Location)
  var topHtml, topTitle, topDrill;
  var EMPTY = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="#0f9488" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12.5l2.5 2.5 5-5.5"/></svg><p>Tuyệt vời! Không phát hiện sai lệch nào.</p></div>';
  if (kind === "sku"){
    topTitle = "Top 10 SKU lệch"; topDrill = "allsku";
    var agg = {}, pnBy = {}; rows.forEach(function(r){ agg[r.sku] = (agg[r.sku] || 0) + r.diffLoc; if (!pnBy[r.sku]) pnBy[r.sku] = r.pn; });
    var top = Object.keys(agg).map(function(k){ return { sku: k, pn: pnBy[k], d: agg[k] }; }).filter(function(x){ return x.d !== 0; }).sort(function(a, b){ return Math.abs(b.d) - Math.abs(a.d); }).slice(0, 10);
    topHtml = top.length ? '<div class="fk-mini"><table><tbody>' + top.map(function(x, i){ return '<tr data-drill="sku" data-v="' + esc(x.sku) + '"><td class="rank">' + (i + 1) + '</td><td><b>' + esc(x.sku) + '</b></td><td class="pn">' + esc(x.pn) + '</td><td class="num ' + (x.d < 0 ? "d-am" : "d-duong") + '">' + (x.d > 0 ? "+" : "") + nf(x.d) + '</td></tr>'; }).join("") + "</tbody></table></div>" : EMPTY;
  } else {
    topTitle = "Top 10 Location lệch"; topDrill = "allloc";
    var top2 = rows.filter(function(r){ return (Number(r.diff) || 0) !== 0; }).sort(function(a, b){ return Math.abs(b.diff) - Math.abs(a.diff); }).slice(0, 10);
    topHtml = top2.length ? '<div class="fk-mini"><table><tbody>' + top2.map(function(x, i){ return '<tr data-drill="loc" data-v="' + esc(x.loc) + '"><td class="rank">' + (i + 1) + '</td><td class="loc">' + esc(x.loc) + '</td><td class="num ' + (x.diff < 0 ? "d-am" : "d-duong") + '">' + (x.diff > 0 ? "+" : "") + nf(x.diff) + '</td></tr>'; }).join("") + "</tbody></table></div>" : EMPTY;
  }

  $id("fkBody").innerHTML =
    '<div class="fk-anim">' +
    '<div class="fk-hero"><div class="fk-herotop"><div><div class="fk-hlabel">Tiến độ kiểm kê · ' + unit + '</div>' +
      '<div class="fk-hpct"><span data-count="' + pct.toFixed(1) + '" data-dec="1" data-suf="%">0%</span></div></div>' +
      '<div class="fk-hsub">Đã đếm <b>' + nf(counted) + '</b> / ' + nf(tot) + ' ' + unit + (_giaLap ? ' · <span class="fk-gl">⚠ GIẢ LẬP</span>' : "") + '</div></div>' +
      '<div class="fk-hbar"><i class="v" style="width:' + pV.toFixed(1) + '%"></i><i class="p" style="width:' + pP.toFixed(1) + '%"></i></div>' +
      '<div class="fk-hleg"><span><i class="dot" style="background:#14b8a6"></i>Khớp <b>' + nf(v) + '</b> · ' + pV.toFixed(0) + '%</span>' +
      '<span><i class="dot" style="background:#f59e0b"></i>Có lệch <b>' + nf(p) + '</b> · ' + pP.toFixed(0) + '%</span>' +
      '<span><i class="dot" style="background:#9ca3af"></i>Chưa đếm <b>' + nf(pd) + '</b></span></div></div>' +
    '<div class="fk-grid">' +
    // CT2: thẻ Độ phủ kiểm kê (Coverage)
    '<div class="fk-w fk-w-cov"><div class="fk-wh"><span class="fk-wt">Độ phủ kiểm kê (Coverage)</span></div>' +
      '<div class="fk-covnum"><b><span data-count="' + covCnt + '">0</span></b> / ' + nf(covTot) + ' ' + covUnit + '</div>' +
      '<div class="fk-covbar"><i style="width:' + covPct.toFixed(1) + '%"></i></div>' +
      '<div class="fk-covpct"><span data-count="' + covPct.toFixed(1) + '" data-dec="1" data-suf="%">0%</span> đã kiểm kê</div></div>' +
    '<div class="fk-w fk-w-disc"><div class="fk-wh"><span class="fk-wt">Chênh lệch (evaluateDiff)</span><button class="fk-see" data-drill="lech">Xem chi tiết</button></div>' +
      '<div class="fk-discrows"><div class="row"><span class="lbl"><b class="d-am"><span data-count="' + neg + '">0</span></b> Lệch âm</span><span class="val d-am">Tổng SL lệch: ' + nf(sNeg) + '</span></div>' +
      '<div class="row"><span class="lbl"><b class="d-duong"><span data-count="' + pos + '">0</span></b> Lệch dương</span><span class="val d-duong">Tổng SL lệch: ' + (sPos > 0 ? "+" : "") + nf(sPos) + '</span></div></div></div>' +
    '<div class="fk-w fk-w-vel"><div class="fk-wh"><span class="fk-wt">Tốc độ · ' + fmtDMY(refDay) + '</span><button class="fk-see" data-drill="today">Xem chi tiết</button></div>' +
      '<div class="fk-velbody"><div class="fk-velnum"><span data-count="' + demT + '">0</span></div><span class="fk-velbadge ' + dCls + '">' + dTxt + '</span></div></div>' +
    '<div class="fk-w fk-w-trend"><div class="fk-wh"><span class="fk-wt">Số dòng đếm · 7 ngày</span></div><div class="fk-chart">' + chart + '</div></div>' +
    '<div class="fk-w fk-w-top"><div class="fk-wh"><span class="fk-wt">' + topTitle + '</span><button class="fk-see" data-drill="' + topDrill + '">Xem tất cả</button></div>' + topHtml + '</div>' +
    '</div></div>';
  requestAnimationFrame(runCount);
}

/* ===== MODAL ===== */
function locFiltered(kind){
  var rows = rowsBase(kind), f = mFilter;
  if (f.t === "today") return rows.filter(function(r){ return dayKey(countMs(r)) === refDay; });
  if (f.t === "day") return rows.filter(function(r){ return dayKey(countMs(r)) === Number(f.v); });
  if (f.t === "lech") return rows.filter(function(r){ return metric(r).counted && metric(r).label !== "khop"; });
  if (f.t === "sku") return rows.filter(function(r){ return r.sku === f.v; });
  if (f.t === "loc") return rows.filter(function(r){ return r.loc === f.v; });
  return rows;
}
function openModal(f, label, tab){ mFilter = f || { t: "all" }; mLabel = label || "Tất cả"; mTab = tab || (activeTab === "loc" ? "loc" : "sku");
  $id("fkMSearch").value = ""; document.querySelectorAll(".fk-mpill").forEach(function(x){ x.classList.toggle("active", x.getAttribute("data-mtab") === mTab); });
  renderModal(); var m = $id("fkModal"); m.style.display = "flex"; requestAnimationFrame(function(){ m.classList.add("show"); }); }
function closeModal(){ var m = $id("fkModal"); m.classList.remove("show"); setTimeout(function(){ m.style.display = "none"; }, 240); }
function setTab(t){ mTab = t; document.querySelectorAll(".fk-mpill").forEach(function(x){ x.classList.toggle("active", x.getAttribute("data-mtab") === t); }); renderModal(); }
function renderModal(){
  var q = ($id("fkMSearch").value || "").toLowerCase().trim();
  var dcell = function(v){ return '<td class="num ' + (v < 0 ? "d-am" : v > 0 ? "d-duong" : "d-khop") + '">' + (v > 0 ? "+" : "") + nf(v) + "</td>"; };
  var html, n;
  if (mTab === "sku"){
    var base = locFiltered("sku"), agg = {}; rowsBase("sku").forEach(function(r){ agg[r.sku] = (agg[r.sku] || 0) + r.diffLoc; });
    var rows = base.filter(function(r){ return !q || (r.sku + " " + r.pn + " " + r.loc + " " + r.req + " " + r.assignTo).toLowerCase().indexOf(q) >= 0; });
    n = rows.length;
    var body = rows.slice(0, MODAL_CAP).map(function(r){ var ds = r.diffSku != null ? r.diffSku : (agg[r.sku] || 0);
      return "<tr><td class='stick'>" + idLink(r.id, "sku") + "</td>" +
        '<td class="skucell"><b>' + esc(r.sku) + '</b><small class="pn">' + esc(r.pn) + "</small></td>" +
        "<td>" + (catOf(r) || "—") + "</td>" + dcell(r.diffLoc) + dcell(ds) + '<td class="num">' + nf(r.inv) + '</td><td class="num">' + (r.cnt == null ? "—" : nf(r.cnt)) + "</td>" +
        "<td>" + (r.no || "—") + "</td><td>" + (r.req ? esc(r.req) : "—") + "</td><td>" + (r.source ? esc(r.source) : "—") + "</td><td>" + (r.type ? esc(r.type) : "—") + "</td>" +
        "<td>" + (r.vat ? esc(r.vat) : "—") + "</td><td>" + (r.priority ? esc(r.priority) : "—") + "</td><td>" + (r.assignTo ? esc(r.assignTo) : "—") + "</td><td>" + (r.countedBy ? esc(r.countedBy) : "—") + "</td>" +
        "<td>" + fmtDate(r.countedDate) + "</td><td>" + fmtDate(r.updatedAt) + "</td><td>" + fmtDate(r.planDate, true) + "</td><td><span class='fk-badge " + badgeClsStatus(r.status) + "'>" + (r.status ? esc(r.status) : "—") + "</span></td></tr>";
    }).join("");
    html = '<table class="fk-mtbl"><thead><tr><th class="stick">ID</th><th>SKU</th><th>Category</th><th class="num">Diff By Location</th><th class="num">Diff By Sku</th><th class="num">Inventory</th><th class="num">Quantity Count</th><th>No.</th><th>Request code</th><th>Source code</th><th>Type</th><th>Required VAT</th><th>Priority</th><th>Assign to</th><th>Counted by</th><th>Counted date</th><th>Updated At</th><th>Plan Date</th><th>Status</th></tr></thead><tbody>' +
      (body || '<tr><td colspan="19" style="text-align:center;color:var(--muted);padding:24px">Không có dòng phù hợp</td></tr>') + "</tbody></table>";
  } else {
    var baseL = locFiltered("loc").filter(function(r){ return !q || (r.loc + " " + r.req + " " + r.assignTo).toLowerCase().indexOf(q) >= 0; }).sort(function(a, b){ return Math.abs(b.diff) - Math.abs(a.diff); });
    n = baseL.length;
    var body2 = baseL.slice(0, MODAL_CAP).map(function(r){
      return "<tr><td class='stick'>" + idLink(r.id, "location") + "</td><td>" + (r.req ? esc(r.req) : "—") + "</td><td>" + (r.source ? esc(r.source) : "—") + "</td><td>" + (r.type ? esc(r.type) : "—") + "</td>" +
        '<td class="loc">' + esc(r.loc) + "</td><td>" + (r.priority ? esc(r.priority) : "—") + "</td>" + dcell(r.diff) +
        "<td>" + (r.assignTo ? esc(r.assignTo) : "—") + "</td><td>" + (r.countedBy ? esc(r.countedBy) : "—") + "</td><td>" + fmtDate(r.countedDate) + "</td><td>" + fmtDate(r.updatedAt) + "</td><td>" + fmtDate(r.planDate, true) + "</td>" +
        "<td><span class='fk-badge " + badgeClsStatus(r.status) + "'>" + (r.status ? esc(r.status) : "—") + "</span></td></tr>";
    }).join("");
    html = '<table class="fk-mtbl"><thead><tr><th class="stick">ID</th><th>Request code</th><th>Source code</th><th>Type</th><th>Location</th><th>Priority</th><th class="num">Diff</th><th>Assign to</th><th>Counted by</th><th>Counted date</th><th>Updated At</th><th>Plan Date</th><th>Status</th></tr></thead><tbody>' +
      (body2 || '<tr><td colspan="13" style="text-align:center;color:var(--muted);padding:24px">Không có dòng phù hợp</td></tr>') + "</tbody></table>";
  }
  $id("fkMWrap").innerHTML = html;
  $id("fkMTitle").innerHTML = "Chi tiết kiểm kê — " + esc(selWh) + "<small>Lọc: " + esc(mLabel) + " · " + (mTab === "sku" ? "theo SKU" : "theo Location") + (selStatus ? " · Status " + esc(selStatus) : "") + "</small>";
  $id("fkMNote").textContent = n > MODAL_CAP ? ("Hiển thị " + nf(MODAL_CAP) + " / " + nf(n) + " dòng — tìm để thu hẹp.") : (nf(n) + " dòng.");
}

/* ===== SYNC / TOAST / INIT ===== */
function sync(){
  if (_syncing) return; _syncing = true; var btn = $id("fkSync"); btn.disabled = true; btn.firstElementChild.textContent = "Đang đồng bộ…";
  var ac = new AbortController(), to = setTimeout(function(){ ac.abort(); }, FETCH_TIMEOUT_MS);
  fetch(APPSCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "force_sync_kiemke" }), signal: ac.signal })
    .then(function(r){ return r.json(); })
    .then(function(j){ if (j.status === "success"){ toast("Đã đồng bộ (" + nf(j.written || 0) + " dòng).", "ok"); loadData(); }
      else if (j.code === 401) toast("Token WMS đã hết hạn. Đang chờ luồng chạy ngầm cập nhật Token mới.", "err");
      else if (j.code === 429) toast(j.message || "Đang trong thời gian chờ.", "warn");
      else if (j.code === 502) toast("Máy chủ Google không gọi được WMS (firewall). Đồng bộ từ máy trạm.", "err");
      else toast("Đồng bộ thất bại: " + (j.message || "?"), "err"); })
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
    pane.addEventListener("click", function(e){
      // nav tab
      var nv = e.target.closest("[data-nav]");
      if (nv){ activeTab = nv.getAttribute("data-nav"); renderNav(); buildDropdowns(); veLai(); return; }
      // custom dropdown: header toggle / option pick
      var head = e.target.closest(".dropdown-header");
      if (head){ var dd = head.parentNode; var wasOpen = dd.classList.contains("open"); dongDD(); if (!wasOpen){ dd.classList.add("open"); _openDD = dd; } return; }
      var li = e.target.closest(".dropdown-list li");
      if (li){ var dd2 = li.closest(".custom-dropdown"); dongDD(); if (dd2 && dd2._cb){ dd2._cb(li.getAttribute("data-v")); buildDropdowns(); } return; }
      if (e.target.closest(".wms-link")) return;
      var el = e.target.closest("[data-drill]"); if (!el) return;
      var t = el.getAttribute("data-drill"), val = el.getAttribute("data-v");
      if (t === "today") openModal({ t: "today" }, "Đã đếm " + fmtDMY(refDay));
      else if (t === "day") openModal({ t: "day", v: val }, "Ngày " + fmtDMY(Number(val)));
      else if (t === "lech") openModal({ t: "lech" }, "Có chênh lệch");
      else if (t === "sku") openModal({ t: "sku", v: val }, "SKU " + val, "sku");
      else if (t === "loc") openModal({ t: "loc", v: val }, "Location " + val, "loc");
      else if (t === "allsku") openModal({ t: "all" }, "Tất cả", "sku");
      else if (t === "allloc") openModal({ t: "all" }, "Tất cả", "loc");
    });
    document.addEventListener("click", function(e){ if (_openDD && !e.target.closest(".custom-dropdown")) dongDD(); });
    $id("fkModal").addEventListener("click", function(e){ if (e.target === $id("fkModal")) closeModal(); });
    document.addEventListener("keydown", function(e){ if (e.key === "Escape"){ if ($id("fkModal").classList.contains("show")) closeModal(); else dongDD(); } });
    loadData();
    return;
  }
  if (!rawSkuData.length && !rawLocationData.length) loadData(); else loadTs();
}
function dongDD(){ if (_openDD){ _openDD.classList.remove("open"); _openDD = null; } PANE.querySelectorAll(".custom-dropdown.open").forEach(function(d){ d.classList.remove("open"); }); }

window.FKIEMKE = { init: init, sync: sync, closeModal: closeModal, setTab: setTab, msearch: function(){ clearTimeout(_deb); _deb = setTimeout(renderModal, 130); } };
})();
