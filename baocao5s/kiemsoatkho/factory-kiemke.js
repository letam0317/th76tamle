/**
 * ============================================================================
 *  factory-kiemke.js — MODULE TAB "KIỂM KÊ" (Physical Count) của FACTORY
 * ============================================================================
 *  RÀO CHẮN AN TOÀN (theo Technical Risk Assessment):
 *   - DATABASE RIÊNG: chỉ đọc tab `kiemke-material` — KHÔNG đụng mastige/garment.
 *   - DEV FLAG (?dev=1): bản nháp; tự nạp MOCK khi sheet trống để xem trước UI.
 *   - RAM/DOM: KPI + Diff-by-SKU tính bằng mảng JS; bảng render TỐI ĐA 150 <tr>/lượt.
 *   - CÔ LẬP: closure + 1 global FKIEMKE; id/class tiền tố fk-; CSS neo #pane-fkiemke;
 *     JSONP callback tiền tố fkgv_. Màu theo CSS variables portal (ăn theme).
 *
 *  BỘ CHỌN KHO (Chỉ thị 1): dropdown 2 kho, mặc định kho đầu; đổi kho -> lọc mảng RAM
 *  -> tính lại 4 KPI -> render lại bảng CHỈ 1 kho (không gộp).
 *
 *  10 CỘT WMS (Chỉ thị 2): ID · Warehouse · SKU(+tên) · Diff by location · Diff by SKU
 *  · Inventory · Quantity count · Request code · Type · Status(badge).
 *   - Cột suy ra từ endpoint tồn-vị-trí: Warehouse/SKU/tên/Inventory/Quantity count/
 *     Diff by location; Diff by SKU (gộp theo SKU trong kho); Status (khớp→VERIFIED,
 *     lệch→PROCESSING, chưa đếm→PENDING).
 *   - ID / Request code / Type: endpoint kiểm kê thật chưa capture -> data thật hiện "—",
 *     MOCK điền đủ để xem trọn giao diện. Map thêm sau, UI không đổi.
 * ============================================================================
 */
(function(){
"use strict";
if (window.FKIEMKE) return;

/* ===== CẤU HÌNH ===== */
var SHEET_ID = "1eY_oo9fAvWCTXp24x-Z0FXq9mp_jJPlTHg09qdemETs";
var TAB = "kiemke-material";
var APPSCRIPT_URL = "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
var DEV_MODE = /[?&]dev=1/.test(location.search);
var MAX_DOM = 150;
var FETCH_TIMEOUT_MS = 4 * 60 * 1000;

/* ===== MOCK (đủ 10 cột, cả field endpoint thật chưa có: id/req/type) ===== */
var MOCK = [
  // id, sku, pn, loc, wh, inv, cnt, req, type
  ["INV-2026-0001", "422490737", "Thân áo/CMTS0028/82.6% Cotton/205gsm/Trắng/XL", "F1-A2-01-03", "WH - MATERIAL - MTG",     120, 120, "RQ-5521", "Định kỳ"],
  ["INV-2026-0002", "422490812", "Vải chính/CMTS0031/100% Cotton Twill/240gsm/Đen", "F1-A3-02-01", "WH - MATERIAL - MTG",   300, 288, "RQ-5521", "Định kỳ"],
  ["INV-2026-0003", "422491055", "Dây kéo YKK 5VS/56cm/Đồng rêu",                    "F2-B1-04-02", "WH - MATERIAL - MTG",   850, 862, "RQ-5521", "Định kỳ"],
  ["INV-2026-0004", "422491203", "Nút dập 15mm/Antique Brass/Bịch 500 cái",          "F2-B2-01-05", "WH - MATERIAL - MTG",    40, null, "RQ-5530", "Đột xuất"],
  ["INV-2026-0005", "422491374", "Chỉ may Coats Epic 120/5000m/Trắng ngà",           "F3-C1-02-02", "WH - MATERIAL - MTG",   215, 215, "RQ-5521", "Định kỳ"],
  ["INV-2026-0006", "422491055", "Dây kéo YKK 5VS/56cm/Đồng rêu",                    "F2-B1-05-01", "WH - MATERIAL - MTG",   120, 118, "RQ-5521", "Định kỳ"],
  ["INV-2026-0007", "422501854", "Thân chính dưới đã thêu/Bag 12/Cotton Canvas",     "F0-A1-01-01", "WH - MATERIAL - GARMENT", 500, 495, "RQ-6012", "Định kỳ"],
  ["INV-2026-0008", "422501920", "Vải lót/POLY210T/Xám tro/Khổ 1m5",                 "F0-A2-03-04", "WH - MATERIAL - GARMENT", 160, 171, "RQ-6012", "Định kỳ"],
  ["INV-2026-0009", "422502088", "Khoá móc kim loại 25mm/Nickel mờ",                 "F1-B4-02-02", "WH - MATERIAL - GARMENT", 720, 720, "RQ-6012", "Định kỳ"],
  ["INV-2026-0010", "422502135", "Webbing PP 30mm/Đen/Cuộn 50m",                     "F1-B5-01-03", "WH - MATERIAL - GARMENT",  95, null, "RQ-6020", "Đột xuất"],
  ["INV-2026-0011", "422502244", "Mác dệt chính/Logo Bag12/Lô 2026",                "F2-C2-04-01", "WH - MATERIAL - GARMENT", 1000, 998, "RQ-6012", "Định kỳ"],
  ["INV-2026-0012", "422501920", "Vải lót/POLY210T/Xám tro/Khổ 1m5",                 "F0-A2-04-01", "WH - MATERIAL - GARMENT", 140, 140, "RQ-6012", "Định kỳ"],
].map(function(m){
  var inv = m[5], cnt = m[6], dl = cnt == null ? 0 : cnt - inv;
  return { id: m[0], sku: m[1], pn: m[2], loc: m[3], wh: m[4], inv: inv, cnt: cnt, diffLoc: dl, req: m[7], type: m[8] };
});

/* ===== STATE ===== */
var ROWS = [], WHS = [], selWh = "", fStatus = "", _giaLap = false;
var _boot = false, _syncing = false, _lastSyncMs = 0, _deb = null, PANE = null;

var $id = function(s){ return document.getElementById(s); };
function nf(x){ return (x == null ? 0 : x).toLocaleString("en-US"); }
function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
function p2(n){ return (n < 10 ? "0" : "") + n; }
function tsHint(ms){ var d = new Date(ms); return "Mới nhất: " + p2(d.getHours()) + ":" + p2(d.getMinutes()) + " " + p2(d.getDate()) + "/" + p2(d.getMonth() + 1); }
// Trạng thái kiểu WMS suy từ chênh lệch (đến khi có endpoint kiểm kê thật)
function statusOf(r){ if (r.cnt == null) return "PENDING"; return r.diffLoc === 0 ? "VERIFIED" : "PROCESSING"; }

/* ===== CSS ===== */
var CSS = [
"#pane-fkiemke .fk-top{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin:14px 0 12px;}",
"#pane-fkiemke .fk-whsel{position:relative;min-width:260px;}",
"#pane-fkiemke .fk-whsel label{display:block;font-size:10.5px;font-weight:650;color:var(--muted,#9ca3af);text-transform:uppercase;letter-spacing:.05em;margin:0 0 4px 2px;}",
"#pane-fkiemke select.fk-wh{appearance:none;-webkit-appearance:none;width:100%;padding:10px 38px 10px 14px;min-height:44px;",
"  border:1.5px solid var(--line,#d0d7de);border-radius:11px;background:var(--panel,#fff);color:var(--text,#1f2937);",
"  font-size:14px;font-weight:700;cursor:pointer;transition:border-color .18s;}",
"#pane-fkiemke select.fk-wh:focus{outline:0;border-color:var(--accent,#2563eb);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent,#2563eb) 18%,transparent);}",
"#pane-fkiemke .fk-whsel::after{content:'';position:absolute;right:15px;bottom:16px;width:8px;height:8px;border-right:2px solid var(--muted,#6b7280);border-bottom:2px solid var(--muted,#6b7280);transform:rotate(45deg);pointer-events:none;}",
"#pane-fkiemke .fk-sync{margin-left:auto;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:2px;min-height:44px;",
"  background:var(--accent,#1f2937);color:#fff;border:0;border-radius:10px;padding:8px 16px;font-size:12.5px;font-weight:650;cursor:pointer;}",
"#pane-fkiemke .fk-sync:disabled{background:color-mix(in srgb,var(--muted,#9ca3af) 42%,var(--panel,#fff));color:var(--muted,#9ca3af);cursor:not-allowed;}",
"#pane-fkiemke .fk-sync .ts{font-size:10.5px;font-weight:500;color:rgba(255,255,255,.72);white-space:nowrap;}",
"#pane-fkiemke .fk-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:0 0 14px;}",
"@media(max-width:820px){#pane-fkiemke .fk-kpis{grid-template-columns:repeat(2,1fr);}}",
"#pane-fkiemke .fk-kpi{border:1px solid var(--line,#e8ecf1);background:var(--panel,#fff);border-radius:14px;padding:14px 16px;}",
"#pane-fkiemke .fk-kpi .n{font-size:24px;font-weight:780;font-variant-numeric:tabular-nums;line-height:1;}",
"#pane-fkiemke .fk-kpi .t{font-size:11.5px;color:var(--muted,#6b7280);margin-top:6px;font-weight:550;}",
"#pane-fkiemke .fk-kpi.k1 .n{color:#0f9488;} #pane-fkiemke .fk-kpi.k2 .n{color:var(--muted,#6b7280);}",
"#pane-fkiemke .fk-kpi.k3 .n{color:#dc2626;} #pane-fkiemke .fk-kpi.k4 .n{color:#2563eb;}",
"#pane-fkiemke .fk-filters{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:0 0 12px;}",
"#pane-fkiemke .fk-pills{display:inline-flex;gap:2px;background:var(--panel,#fff);border:1.5px solid var(--line,#d0d7de);border-radius:999px;padding:3px;}",
"#pane-fkiemke .fk-pill{border:0;background:transparent;padding:6px 14px;border-radius:999px;font-weight:650;font-size:12px;cursor:pointer;color:var(--muted,#6b7280);min-height:32px;}",
"#pane-fkiemke .fk-pill.active{background:var(--accent,#1f2937);color:#fff;}",
"@media(max-width:640px){#pane-fkiemke .fk-pill{min-height:44px;padding:10px 14px;}}",
"#pane-fkiemke .fk-search{flex:1 1 220px;max-width:340px;padding:9px 12px;border:1px solid var(--line,#d5dbe4);border-radius:9px;background:var(--panel,#fff);color:var(--text,#1f2937);font-size:12.5px;min-height:38px;}",
"#pane-fkiemke .fk-search:focus{outline:0;border-color:var(--accent,#2563eb);}",
"#pane-fkiemke .fk-panel{background:var(--panel,#fff);border:1px solid var(--line,#e8ecf1);border-radius:14px;padding:0;margin-bottom:14px;overflow:hidden;}",
/* Chỉ thị 3: responsive + sticky thead */
"#pane-fkiemke .table-responsive{overflow-x:auto;overflow-y:auto;max-height:70vh;-webkit-overflow-scrolling:touch;}",
"#pane-fkiemke table{width:100%;border-collapse:separate;border-spacing:0;font-size:12.5px;color:var(--text,#1f2937);min-width:1080px;}",
"#pane-fkiemke thead th{position:sticky;top:0;z-index:2;background:var(--accent,#1f2937);color:#fff;padding:11px 12px;text-align:left;",
"  font-size:10.5px;font-weight:650;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;}",
"#pane-fkiemke tbody td{padding:9px 12px;border-top:1px solid var(--line,#e8ecf1);white-space:nowrap;vertical-align:top;}",
"#pane-fkiemke tbody tr:hover{background:color-mix(in srgb,var(--accent,#2563eb) 6%,transparent);}",
"#pane-fkiemke .num{text-align:right;font-variant-numeric:tabular-nums;}",
"#pane-fkiemke .fk-id{font-family:ui-monospace,Consolas,monospace;color:var(--muted,#6b7280);font-size:11.5px;}",
"#pane-fkiemke .fk-loc{font-family:ui-monospace,Consolas,monospace;color:#0f9488;font-size:11.5px;}",
"#pane-fkiemke .fk-skucell b{display:block;font-size:12.5px;} #pane-fkiemke .fk-skucell small{display:block;color:var(--muted,#6b7280);white-space:normal;max-width:320px;line-height:1.35;margin-top:1px;}",
"#pane-fkiemke .d-am{color:#dc2626;font-weight:700;} #pane-fkiemke .d-duong{color:#2563eb;font-weight:700;} #pane-fkiemke .d-khop{color:var(--muted,#9ca3af);}",
"#pane-fkiemke .fk-badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:10.5px;font-weight:750;letter-spacing:.03em;}",
"#pane-fkiemke .fk-badge.verified{background:#d1faf3;color:#0f766e;} #pane-fkiemke .fk-badge.processing{background:#fdecd0;color:#b45309;} #pane-fkiemke .fk-badge.pending{background:color-mix(in srgb,var(--muted,#9ca3af) 22%,transparent);color:var(--muted,#6b7280);}",
"#pane-fkiemke .fk-note{color:var(--muted,#9ca3af);font-size:11.5px;padding:10px 14px;border-top:1px solid var(--line,#e8ecf1);}",
"#pane-fkiemke .fk-state{padding:48px 20px;text-align:center;color:var(--muted,#6b7280);}",
"#pane-fkiemke .fk-spin{width:30px;height:30px;border:3px solid var(--line,#d5dbe4);border-top-color:var(--accent,#2563eb);border-radius:50%;margin:0 auto 14px;animation:fk-sp .8s linear infinite;}",
"@keyframes fk-sp{to{transform:rotate(360deg)}}",
"#pane-fkiemke .fk-gl{color:#b45309;font-weight:700;}",
"#fkToast{position:fixed;left:50%;bottom:28px;transform:translate(-50%,16px);background:#111827;color:#fff;padding:12px 20px;border-radius:12px;font-size:13px;font-weight:600;box-shadow:0 24px 60px rgba(16,24,40,.35);opacity:0;pointer-events:none;z-index:1300;max-width:92vw;text-align:center;transition:opacity .25s,transform .25s;}",
"#fkToast.show{opacity:1;transform:translate(-50%,0);}",
"#fkToast.ok{background:#0f766e;} #fkToast.warn{background:#b45309;} #fkToast.err{background:#b42318;}",
].join("\n");

/* ===== KHUNG (Chỉ thị 1: dropdown kho thay tiêu đề tĩnh gộp) ===== */
var KHUNG =
'<div class="fk-top">' +
'  <div class="fk-whsel"><label for="fkWh">Kho kiểm kê</label>' +
'    <select id="fkWh" class="fk-wh" aria-label="Chọn kho kiểm kê"></select></div>' +
'  <span id="fkInfo" class="fk-note" style="border:0;padding:0"></span>' +
'  <button id="fkSync" class="fk-sync" onclick="FKIEMKE.sync()" aria-label="Đồng bộ dữ liệu kiểm kê từ WMS">' +
'    <span>Đồng bộ WMS (test 2 trang/kho)</span><small class="ts" id="fkSyncTs"></small></button>' +
'</div>' +
'<div class="fk-kpis" id="fkKpis"></div>' +
'<div class="fk-filters">' +
'  <div class="fk-pills" role="tablist" aria-label="Lọc trạng thái">' +
'    <button class="fk-pill active" data-fkst="" role="tab">Tất cả</button>' +
'    <button class="fk-pill" data-fkst="am" role="tab">Lệch âm</button>' +
'    <button class="fk-pill" data-fkst="duong" role="tab">Lệch dương</button>' +
'    <button class="fk-pill" data-fkst="chuadem" role="tab">Chưa đếm</button>' +
'  </div>' +
'  <input id="fkSearch" class="fk-search" placeholder="Tìm SKU / tên / vị trí / mã phiếu…" oninput="FKIEMKE.qfilter()">' +
'</div>' +
'<div class="fk-panel"><div class="table-responsive" id="fkTbl"></div><div class="fk-note" id="fkNote"></div></div>' +
'<div id="fkState" class="fk-state"><div class="fk-spin"></div>Đang tải dữ liệu kiểm kê…</div>';

/* ===== ĐỌC DỮ LIỆU (gviz JSONP) ===== */
function loadData(){
  _giaLap = false;
  $id("fkState").style.display = "block";
  $id("fkState").innerHTML = '<div class="fk-spin"></div>Đang tải dữ liệu kiểm kê…';
  window.fkgv_data = function(resp){
    try{
      if (resp.status === "error") throw new Error("Sheet chưa có tab " + TAB);
      var rows = ((resp.table && resp.table.rows) || []).map(function(r){
        return (r.c || []).map(function(c){ return c ? (c.v == null ? "" : c.v) : ""; });
      });
      if (!rows.length) throw new Error("Tab " + TAB + " đang rỗng");
      napSheet(rows);
    }catch(e){ hienTrong(); }
  };
  var url = "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/gviz/tq?tqx=out:json;responseHandler:fkgv_data" +
    "&sheet=" + encodeURIComponent(TAB) + "&headers=1";
  var old = $id("fk_sc"); if (old) old.remove();
  var sc = document.createElement("script"); sc.id = "fk_sc"; sc.src = url;
  sc.onerror = function(){ hienTrong(); };
  document.body.appendChild(sc);
  loadTs();
}
function loadTs(){
  window.fkgv_ts = function(resp){
    var ts = resp && resp.status === "success" ? Number(resp.ts || 0) : 0;
    if (ts > 0){ _lastSyncMs = ts; $id("fkSyncTs").textContent = tsHint(ts); }
  };
  var sc = document.createElement("script");
  sc.src = APPSCRIPT_URL + "?action=lastSync&tab=" + encodeURIComponent(TAB) + "&callback=fkgv_ts";
  document.body.appendChild(sc); setTimeout(function(){ sc.remove(); }, 15000);
}
/* Sheet 9 cột [SKU,ProductName,Location,Warehouse,SystemQty,CountedQty,Diff,Status,Updated]
   -> object nội bộ; id/req/type endpoint thật chưa có -> để trống (hiện "—"). */
function napSheet(rows){
  ROWS = rows.filter(function(r){ return String(r[0] || "") !== ""; }).map(function(r, i){
    var inv = Number(r[4]) || 0;
    var cnt = (r[5] === "" || r[5] == null) ? null : Number(r[5]) || 0;
    var dl = (r[6] === "" || r[6] == null) ? (cnt == null ? 0 : cnt - inv) : Number(r[6]) || 0;
    return { id: "", sku: String(r[0]), pn: String(r[1] || ""), loc: String(r[2] || ""), wh: String(r[3] || ""),
      inv: inv, cnt: cnt, diffLoc: dl, req: "", type: "" };
  });
  khoiTao();
}
function hienTrong(){
  _giaLap = true;
  ROWS = MOCK.map(function(r){ return r; });
  khoiTao();
  toast("Sheet " + TAB + " chưa có dữ liệu — hiển thị " + MOCK.length + " dòng GIẢ LẬP để xem trước UI.", "warn");
}
/* Dựng dropdown kho (Chỉ thị 1), chọn kho đầu tiên, rồi render */
function khoiTao(){
  WHS = [];
  ROWS.forEach(function(r){ if (r.wh && WHS.indexOf(r.wh) < 0) WHS.push(r.wh); });
  // Thứ tự ưu tiên MTG -> GARMENT (khớp spec); kho lạ khác xếp sau
  var uu = function(w){ return /MTG/i.test(w) ? 0 : /GARMENT/i.test(w) ? 1 : 2; };
  WHS.sort(function(a, b){ return uu(a) - uu(b) || a.localeCompare(b); });
  if (!selWh || WHS.indexOf(selWh) < 0) selWh = WHS[0] || "";
  $id("fkWh").innerHTML = WHS.map(function(w){ return '<option value="' + esc(w) + '"' + (w === selWh ? " selected" : "") + ">" + esc(w) + "</option>"; }).join("");
  $id("fkState").style.display = "none";
  veLai();
}

/* ===== Diff by SKU: gộp lệch theo SKU TRONG KHO đang chọn (tính trên mảng) ===== */
function diffBySku(rowsKho){
  var m = {};
  rowsKho.forEach(function(r){ m[r.sku] = (m[r.sku] || 0) + r.diffLoc; });
  return m;
}
function rowsCuaKho(){ return ROWS.filter(function(r){ return r.wh === selWh; }); }

/* ===== 4 KPI theo kho đang chọn (reduce trên mảng, KHÔNG đụng DOM) ===== */
function renderKpis(rowsKho){
  var k = rowsKho.reduce(function(a, r){
    if (r.cnt == null) a.chuadem++; else a.dadem++;
    if (r.diffLoc < 0) a.am++; else if (r.diffLoc > 0) a.duong++;
    return a;
  }, { dadem: 0, chuadem: 0, am: 0, duong: 0 });
  $id("fkKpis").innerHTML =
    '<div class="fk-kpi k1"><div class="n">' + nf(k.dadem) + '</div><div class="t">SKU đã kiểm đếm (counted)</div></div>' +
    '<div class="fk-kpi k2"><div class="n">' + nf(k.chuadem) + '</div><div class="t">Chưa kiểm đếm (not count)</div></div>' +
    '<div class="fk-kpi k3"><div class="n">' + nf(k.am) + '</div><div class="t">Lệch âm (negative)</div></div>' +
    '<div class="fk-kpi k4"><div class="n">' + nf(k.duong) + '</div><div class="t">Lệch dương (positive)</div></div>';
  $id("fkInfo").innerHTML = "· " + nf(rowsKho.length) + " dòng · kho " + esc(selWh) +
    (_giaLap ? ' · <span class="fk-gl">⚠ DỮ LIỆU GIẢ LẬP</span>' : "");
}

/* ===== Bảng 10 cột, cap MAX_DOM (Chỉ thị 2+3) ===== */
function khopStatus(r){
  if (fStatus === "am") return r.diffLoc < 0;
  if (fStatus === "duong") return r.diffLoc > 0;
  if (fStatus === "chuadem") return r.cnt == null;
  return true;
}
function veLai(){
  var rowsKho = rowsCuaKho();
  renderKpis(rowsKho);
  var dSku = diffBySku(rowsKho);
  var q = ($id("fkSearch").value || "").toLowerCase().trim();
  var loc = rowsKho.filter(function(r){
    if (!khopStatus(r)) return false;
    if (q && (r.sku + " " + r.pn + " " + r.loc + " " + r.req).toLowerCase().indexOf(q) < 0) return false;
    return true;
  });
  var out = [];
  var tdDiff = function(d){ return '<td class="num ' + (d < 0 ? "d-am" : d > 0 ? "d-duong" : "d-khop") + '">' + (d > 0 ? "+" : "") + nf(d) + "</td>"; };
  var badge = function(st){ var c = st === "VERIFIED" ? "verified" : st === "PROCESSING" ? "processing" : "pending"; return '<span class="fk-badge ' + c + '">' + st + "</span>"; };
  for (var i = 0; i < loc.length && out.length < MAX_DOM; i++){ var r = loc[i];
    out.push("<tr>" +
      '<td class="fk-id">' + (r.id ? esc(r.id) : "—") + "</td>" +
      "<td>" + esc(r.wh) + "</td>" +
      '<td class="fk-skucell"><b>' + esc(r.sku) + "</b><small>" + esc(r.pn) + "</small></td>" +
      '<td class="fk-loc">' + esc(r.loc) + "</td>" +
      tdDiff(r.diffLoc) +
      tdDiff(dSku[r.sku] || 0) +
      '<td class="num">' + nf(r.inv) + "</td>" +
      '<td class="num">' + (r.cnt == null ? "—" : nf(r.cnt)) + "</td>" +
      "<td>" + (r.req ? esc(r.req) : "—") + "</td>" +
      "<td>" + (r.type ? esc(r.type) : "—") + "</td>" +
      "<td>" + badge(statusOf(r)) + "</td></tr>");
  }
  var thead = "<thead><tr><th>ID</th><th>Warehouse</th><th>SKU</th><th class='num'>Diff by location</th>" +
    "<th class='num'>Diff by SKU</th><th class='num'>Inventory</th><th class='num'>Quantity count</th>" +
    "<th>Request code</th><th>Type</th><th>Status</th></tr></thead>";
  $id("fkTbl").innerHTML = "<table>" + thead + "<tbody>" +
    (out.join("") || '<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:24px">Không có dòng phù hợp</td></tr>') +
    "</tbody></table>";
  $id("fkNote").textContent = loc.length > out.length
    ? "Hiển thị " + nf(out.length) + " / " + nf(loc.length) + " dòng của kho — lọc/tìm để thu hẹp (trần " + MAX_DOM + " dòng chống giật)."
    : nf(loc.length) + " dòng.";
}

/* ===== ĐỒNG BỘ (giữ nguyên: GAS→WMS bất khả thi do firewall; đây là đường lỗi có kiểm soát) ===== */
function sync(){
  if (_syncing) return;
  _syncing = true;
  var btn = $id("fkSync"); btn.disabled = true; btn.firstElementChild.textContent = "Đang đồng bộ WMS…";
  var ac = new AbortController();
  var to = setTimeout(function(){ ac.abort(); }, FETCH_TIMEOUT_MS);
  fetch(APPSCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "force_sync_kiemke" }), signal: ac.signal })
    .then(function(r){ return r.json(); })
    .then(function(j){
      if (j.status === "success"){ _lastSyncMs = j.at || Date.now(); $id("fkSyncTs").textContent = tsHint(_lastSyncMs);
        toast("Đã đồng bộ kiểm kê (" + nf(j.written || 0) + " dòng).", "ok"); loadData(); }
      else if (j.code === 401) toast("Token WMS đã hết hạn. Đang chờ luồng chạy ngầm cập nhật Token mới.", "err");
      else if (j.code === 429) toast(j.message || "Đồng bộ đang trong thời gian chờ.", "warn");
      else if (j.code === 502) toast("Máy chủ Google không gọi được WMS (firewall nội bộ). Dùng đồng bộ từ máy trạm.", "err");
      else toast("Đồng bộ thất bại: " + (j.message || "?"), "err");
    })
    .catch(function(e){ toast(e.name === "AbortError" ? "Quá 4 phút — đã ngắt request." : "Không gọi được máy chủ (" + e.message + ").", "err"); })
    .finally(function(){ clearTimeout(to); _syncing = false; btn.disabled = false; btn.firstElementChild.textContent = "Đồng bộ WMS (test 2 trang/kho)"; });
}

function toast(msg, type){
  var el = $id("fkToast"); el.className = type || ""; el.textContent = msg;
  requestAnimationFrame(function(){ el.classList.add("show"); });
  clearTimeout(toast._t); toast._t = setTimeout(function(){ el.classList.remove("show"); }, 6000);
}

/* ===== INIT (idempotent) ===== */
function init(pane){
  PANE = pane;
  if (!_boot){
    _boot = true;
    var style = document.createElement("style"); style.id = "fkStyle"; style.textContent = CSS;
    document.head.appendChild(style);
    pane.innerHTML = KHUNG;
    var t = document.createElement("div"); t.id = "fkToast"; document.body.appendChild(t);
    // Đổi kho (Chỉ thị 1): lọc lại mảng RAM -> KPI + bảng của riêng kho, không gộp
    $id("fkWh").addEventListener("change", function(e){ selWh = e.target.value; veLai(); });
    // Lọc trạng thái
    pane.addEventListener("click", function(e){
      var s = e.target.closest("[data-fkst]"); if (!s) return;
      fStatus = s.getAttribute("data-fkst");
      pane.querySelectorAll("[data-fkst]").forEach(function(x){ x.classList.toggle("active", x === s); });
      veLai();
    });
    loadData();
    return;
  }
  if (!ROWS.length) loadData(); else loadTs();
}

window.FKIEMKE = {
  init: init,
  sync: sync,
  qfilter: function(){ clearTimeout(_deb); _deb = setTimeout(veLai, 120); },
};
})();
