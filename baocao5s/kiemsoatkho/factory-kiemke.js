/**
 * ============================================================================
 *  factory-kiemke.js — MODULE TAB "KIỂM KÊ" (Physical Count) của FACTORY
 * ============================================================================
 *  RÀO CHẮN AN TOÀN (theo Technical Risk Assessment đã chốt):
 *   - DATABASE RIÊNG: chỉ đọc/ghi tab `kiemke-material` — KHÔNG đụng mastige/garment.
 *   - DEV FLAG (?dev=1): môi trường bản nháp; có nút "Nạp dữ liệu mẫu" để dựng UI
 *     không cần backend. (Nút đồng bộ kiểm kê vẫn dùng được ở dev vì nó CHỈ ghi
 *     tab test kiemke-material; luồng force_sync_wms production bị chặn ở module fstock.)
 *   - CHỐNG TREO: fetch gọi GAS bọc AbortController, timeout 4 phút.
 *   - RAM/DOM: KPI tính bằng Array.reduce trên mảng JS; bảng render TỐI ĐA 150 <tr>
 *     theo filter hiện tại (không nhồi ngàn dòng vào DOM).
 *   - CÔ LẬP: closure + 1 global FKIEMKE; id/class tiền tố fk-; CSS neo #pane-fkiemke;
 *     JSONP callback tiền tố fkgv_. Màu theo CSS variables của portal (ăn theme).
 * ============================================================================
 */
(function(){
"use strict";
if (window.FKIEMKE) return;

/* ===== CẤU HÌNH ===== */
var SHEET_ID = "1eY_oo9fAvWCTXp24x-Z0FXq9mp_jJPlTHg09qdemETs";
var TAB = "kiemke-material";                    // DATABASE RIÊNG cho Kiểm kê — không đụng mastige/garment
var APPSCRIPT_URL = "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
var DEV_MODE = /[?&]dev=1/.test(location.search);
var MAX_DOM = 150;                              // trần số <tr> render mỗi lượt (chống jank)
var FETCH_TIMEOUT_MS = 4 * 60 * 1000;           // AbortController: ngắt request GAS sau 4 phút

/* ===== STATE (closure) =====
   ROWS: [sku, productName, location, warehouse, sysQty, countedQty, diff, status, updated] */
var ROWS = [], _boot = false, _syncing = false, _lastSyncMs = 0, _deb = null, PANE = null;
var view = "location";                          // sub-tab: 'location' | 'sku'
var fStatus = "";                               // '', 'am', 'duong', 'chuadem'

var $id = function(s){ return document.getElementById(s); };
function nf(x){ return (x || 0).toLocaleString("en-US"); }
function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
function p2(n){ return (n < 10 ? "0" : "") + n; }
function tsHint(ms){ var d = new Date(ms); return "Mới nhất: " + p2(d.getHours()) + ":" + p2(d.getMinutes()) + " " + p2(d.getDate()) + "/" + p2(d.getMonth() + 1); }

/* ===== CSS — neo #pane-fkiemke, biến theme host ===== */
var CSS = [
"#pane-fkiemke .fk-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:14px 0 12px;}",
"#pane-fkiemke .fk-chip{background:color-mix(in srgb, var(--accent,#2563eb) 14%, transparent);color:var(--accent,#1e40af);border-radius:999px;padding:4px 13px;font-weight:650;font-size:12px;}",
"#pane-fkiemke .fk-hint{color:var(--muted,#9ca3af);font-size:11.5px;}",
/* HM2: nút hành động = flex space-between, timestamp là <small> xám mờ căn phải, nowrap */
"#pane-fkiemke .fk-actbtn{display:flex;justify-content:space-between;align-items:center;gap:12px;min-height:38px;",
"  background:var(--accent,#1f2937);color:#fff;border:0;border-radius:9px;padding:8px 14px;font-size:12.5px;font-weight:650;cursor:pointer;}",
"#pane-fkiemke .fk-actbtn:disabled{background:color-mix(in srgb, var(--muted,#9ca3af) 42%, var(--panel,#fff));color:var(--muted,#9ca3af);cursor:not-allowed;}",
"#pane-fkiemke .fk-actbtn .timestamp-hint{color:rgba(255,255,255,.72);font-size:10.5px;font-weight:500;white-space:nowrap;}",
"#pane-fkiemke .fk-actbtn:disabled .timestamp-hint{color:var(--muted,#9ca3af);}",
"@media(max-width:640px){#pane-fkiemke .fk-actbtn{min-height:44px;width:100%;}}",
/* 4 thẻ KPI */
"#pane-fkiemke .fk-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:0 0 14px;}",
"@media(max-width:820px){#pane-fkiemke .fk-kpis{grid-template-columns:repeat(2,1fr);}}",
"#pane-fkiemke .fk-kpi{border:1px solid var(--line,#e8ecf1);background:var(--panel,#fff);border-radius:14px;padding:14px 16px;}",
"#pane-fkiemke .fk-kpi .n{font-size:24px;font-weight:780;font-variant-numeric:tabular-nums;line-height:1;}",
"#pane-fkiemke .fk-kpi .t{font-size:11.5px;color:var(--muted,#6b7280);margin-top:6px;font-weight:550;}",
"#pane-fkiemke .fk-kpi.k1 .n{color:#0f9488;} #pane-fkiemke .fk-kpi.k2 .n{color:var(--muted,#6b7280);}",
"#pane-fkiemke .fk-kpi.k3 .n{color:#dc2626;} #pane-fkiemke .fk-kpi.k4 .n{color:#2563eb;}",
/* Pills sub-tab + filter */
"#pane-fkiemke .fk-pills{display:inline-flex;gap:2px;background:var(--panel,#fff);border:1.5px solid var(--line,#d0d7de);border-radius:999px;padding:3px;}",
"#pane-fkiemke .fk-pill{border:0;background:transparent;padding:6px 14px;border-radius:999px;font-weight:650;font-size:12px;cursor:pointer;color:var(--muted,#6b7280);min-height:32px;}",
"#pane-fkiemke .fk-pill.active{background:var(--accent,#1f2937);color:#fff;}",
"@media(max-width:640px){#pane-fkiemke .fk-pill{min-height:44px;padding:10px 14px;}}",
"#pane-fkiemke .fk-filters{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:0 0 12px;}",
"#pane-fkiemke .fk-search{flex:1 1 220px;max-width:340px;padding:9px 12px;border:1px solid var(--line,#d5dbe4);border-radius:9px;background:var(--panel,#fff);color:var(--text,#1f2937);font-size:12.5px;min-height:38px;}",
"#pane-fkiemke .fk-search:focus{outline:0;border-color:var(--accent,#2563eb);}",
/* Bảng (cap 150 dòng) */
"#pane-fkiemke .fk-panel{background:var(--panel,#fff);border:1px solid var(--line,#e8ecf1);border-radius:14px;padding:16px 18px;margin-bottom:14px;}",
"#pane-fkiemke .fk-tblwrap{overflow-x:auto;-webkit-overflow-scrolling:touch;}",
"#pane-fkiemke table{width:100%;border-collapse:collapse;font-size:12.5px;color:var(--text,#1f2937);}",
"#pane-fkiemke th,#pane-fkiemke td{padding:9px 12px;text-align:left;border-top:1px solid var(--line,#e8ecf1);white-space:nowrap;}",
"#pane-fkiemke thead th{color:var(--muted,#9ca3af);font-size:10.5px;font-weight:650;text-transform:uppercase;letter-spacing:.04em;border-top:0;}",
"#pane-fkiemke .num{text-align:right!important;font-variant-numeric:tabular-nums;}",
"#pane-fkiemke .fk-loc{font-family:ui-monospace,Consolas,monospace;color:#0f9488;font-size:12px;}",
"#pane-fkiemke .fk-pn{white-space:normal;min-width:240px;color:var(--muted,#6b7280);}",
"#pane-fkiemke .d-am{color:#dc2626;font-weight:700;} #pane-fkiemke .d-duong{color:#2563eb;font-weight:700;} #pane-fkiemke .d-khop{color:#0f9488;}",
"#pane-fkiemke .fk-note{color:var(--muted,#9ca3af);font-size:11.5px;margin-top:8px;}",
"#pane-fkiemke .fk-state{padding:48px 20px;text-align:center;color:var(--muted,#6b7280);}",
"#pane-fkiemke .fk-spin{width:30px;height:30px;border:3px solid var(--line,#d5dbe4);border-top-color:var(--accent,#2563eb);border-radius:50%;margin:0 auto 14px;animation:fk-sp .8s linear infinite;}",
"@keyframes fk-sp{to{transform:rotate(360deg)}}",
"#pane-fkiemke .fk-devbtn{background:transparent;border:1.5px dashed var(--muted,#9ca3af);color:var(--muted,#6b7280);border-radius:9px;padding:8px 14px;font-size:12px;font-weight:600;cursor:pointer;min-height:38px;}",
"#fkToast{position:fixed;left:50%;bottom:28px;transform:translate(-50%,16px);background:#111827;color:#fff;padding:12px 20px;border-radius:12px;font-size:13px;font-weight:600;box-shadow:0 24px 60px rgba(16,24,40,.35);opacity:0;pointer-events:none;z-index:1300;max-width:92vw;text-align:center;transition:opacity .25s,transform .25s;}",
"#fkToast.show{opacity:1;transform:translate(-50%,0);}",
"#fkToast.ok{background:#0f766e;} #fkToast.warn{background:#b45309;} #fkToast.err{background:#b42318;}",
].join("\n");

/* ===== KHUNG ===== */
var KHUNG =
'<div class="fk-bar">' +
'  <span class="fk-chip">Kiểm kê Material — WH MTG &amp; GARMENT</span>' +
'  <span id="fkInfo" class="fk-hint"></span>' +
'  <span style="flex:1"></span>' +
'  <button id="fkSync" class="fk-actbtn" onclick="FKIEMKE.sync()" aria-label="Đồng bộ dữ liệu kiểm kê từ WMS">' +
'    <span>Đồng bộ WMS (test 2 trang/kho)</span><small class="timestamp-hint" id="fkSyncTs"></small></button>' +
'</div>' +
'<div class="fk-kpis" id="fkKpis"></div>' +
'<div class="fk-filters">' +
'  <div class="fk-pills" role="tablist" aria-label="Kiểu xem">' +
'    <button class="fk-pill active" data-fkview="location" role="tab">Theo Location</button>' +
'    <button class="fk-pill" data-fkview="sku" role="tab">Theo SKU</button>' +
'  </div>' +
'  <div class="fk-pills" role="tablist" aria-label="Lọc trạng thái">' +
'    <button class="fk-pill active" data-fkst="" role="tab">Tất cả</button>' +
'    <button class="fk-pill" data-fkst="am" role="tab">Lệch âm</button>' +
'    <button class="fk-pill" data-fkst="duong" role="tab">Lệch dương</button>' +
'    <button class="fk-pill" data-fkst="chuadem" role="tab">Chưa đếm</button>' +
'  </div>' +
'  <input id="fkSearch" class="fk-search" placeholder="Tìm SKU / tên / vị trí…" oninput="FKIEMKE.qfilter()">' +
'</div>' +
'<div class="fk-panel"><div class="fk-tblwrap" id="fkTbl"></div><div class="fk-note" id="fkNote"></div></div>' +
'<div id="fkState" class="fk-state"><div class="fk-spin"></div>Đang tải dữ liệu kiểm kê…</div>';

/* ===== ĐỌC DỮ LIỆU (gviz JSONP — miễn nhiễm CORS, chạy được cả localhost) ===== */
function loadData(){
  $id("fkState").style.display = "block";
  $id("fkState").innerHTML = '<div class="fk-spin"></div>Đang tải dữ liệu kiểm kê…';
  window.fkgv_data = function(resp){
    try{
      if (resp.status === "error") throw new Error("Sheet chưa có tab " + TAB);
      var rows = ((resp.table && resp.table.rows) || []).map(function(r){
        return (r.c || []).map(function(c){ return c ? (c.v == null ? "" : c.v) : ""; });
      });
      napRows(rows);
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
function loadTs(){   // mốc "Mới nhất" từ backend (Script Properties, qua lastSync JSONP) — không dùng giờ local
  window.fkgv_ts = function(resp){
    var ts = resp && resp.status === "success" ? Number(resp.ts || 0) : 0;
    if (ts > 0){ _lastSyncMs = ts; $id("fkSyncTs").textContent = tsHint(ts); }
  };
  var sc = document.createElement("script");
  sc.src = APPSCRIPT_URL + "?action=lastSync&tab=" + encodeURIComponent(TAB) + "&callback=fkgv_ts";
  document.body.appendChild(sc); setTimeout(function(){ sc.remove(); }, 15000);
}
function napRows(rows){
  // Cột: 0 SKU,1 ProductName,2 Location,3 Warehouse,4 SystemQty,5 CountedQty,6 Diff,7 Status,8 Updated
  ROWS = rows.filter(function(r){ return String(r[0] || "") !== ""; }).map(function(r){
    var sys = Number(r[4]) || 0, dem = (r[5] === "" || r[5] == null) ? null : Number(r[5]) || 0;
    var diff = (r[6] === "" || r[6] == null) ? (dem == null ? 0 : dem - sys) : Number(r[6]) || 0;
    return [String(r[0]), String(r[1] || ""), String(r[2] || ""), String(r[3] || ""), sys, dem, diff, String(r[7] || ""), String(r[8] || "")];
  });
  if (!ROWS.length){ hienTrong(); return; }
  $id("fkState").style.display = "none";
  renderKpis(); renderTable();
}
function hienTrong(){
  $id("fkState").style.display = "block";
  $id("fkState").innerHTML = "Chưa có dữ liệu kiểm kê (tab <code>" + TAB + "</code> chưa được đồng bộ lần nào).<br>" +
    'Bấm <b>"Đồng bộ WMS (test 2 trang/kho)"</b> phía trên để kéo dữ liệu.' +
    (DEV_MODE ? '<br><br><button class="fk-devbtn" onclick="FKIEMKE.mock()">⚙ DEV: Nạp dữ liệu mẫu (không gọi mạng)</button>' : "");
  $id("fkKpis").innerHTML = ""; $id("fkTbl").innerHTML = ""; $id("fkNote").textContent = "";
}

/* ===== KPI: TÍNH TRÊN MẢNG JS (reduce) — không đụng DOM khi tính ===== */
function renderKpis(){
  var k = ROWS.reduce(function(a, r){
    var dem = r[5], diff = r[6];
    if (dem == null || dem === 0) a.chuadem++; else a.dadem++;
    if (diff < 0) a.am++; else if (diff > 0) a.duong++;
    return a;
  }, { dadem: 0, chuadem: 0, am: 0, duong: 0 });
  $id("fkKpis").innerHTML =
    '<div class="fk-kpi k1"><div class="n">' + nf(k.dadem) + '</div><div class="t">SKU đã kiểm đếm (counted)</div></div>' +
    '<div class="fk-kpi k2"><div class="n">' + nf(k.chuadem) + '</div><div class="t">Chưa kiểm đếm (not count)</div></div>' +
    '<div class="fk-kpi k3"><div class="n">' + nf(k.am) + '</div><div class="t">Lệch âm (negative)</div></div>' +
    '<div class="fk-kpi k4"><div class="n">' + nf(k.duong) + '</div><div class="t">Lệch dương (positive)</div></div>';
  $id("fkInfo").textContent = "· " + nf(ROWS.length) + " dòng";
}

/* ===== BẢNG: lọc trên mảng, render TỐI ĐA MAX_DOM dòng ===== */
function khopStatus(r){
  if (fStatus === "am") return r[6] < 0;
  if (fStatus === "duong") return r[6] > 0;
  if (fStatus === "chuadem") return r[5] == null || r[5] === 0;
  return true;
}
function renderTable(){
  var q = ($id("fkSearch").value || "").toLowerCase().trim();
  var loc = ROWS.filter(function(r){
    if (!khopStatus(r)) return false;
    if (q && (r[0] + " " + r[1] + " " + r[2]).toLowerCase().indexOf(q) < 0) return false;
    return true;
  });
  var out = [], tong = 0, html;
  var tdDiff = function(d){ return '<td class="num ' + (d < 0 ? "d-am" : d > 0 ? "d-duong" : "d-khop") + '">' + (d > 0 ? "+" : "") + nf(d) + "</td>"; };
  if (view === "location"){
    tong = loc.length;
    for (var i = 0; i < loc.length && out.length < MAX_DOM; i++){ var r = loc[i];
      out.push("<tr><td><b>" + esc(r[0]) + '</b></td><td class="fk-pn">' + esc(r[1]) + '</td><td class="fk-loc">' + esc(r[2]) + "</td><td>" + esc(r[3]) +
        '</td><td class="num">' + nf(r[4]) + '</td><td class="num">' + (r[5] == null ? "—" : nf(r[5])) + "</td>" + tdDiff(r[6]) + "<td>" + esc(r[7]) + "</td></tr>");
    }
    html = "<table><thead><tr><th>SKU</th><th>ProductName</th><th>Vị trí</th><th>Kho</th>" +
      '<th class="num">Hệ thống</th><th class="num">Đã đếm</th><th class="num">Lệch</th><th>Trạng thái</th></tr></thead><tbody>' +
      (out.join("") || '<tr><td colspan="8" style="text-align:center;color:var(--muted)">Không có dòng phù hợp</td></tr>') + "</tbody></table>";
  } else {
    // GOM THEO SKU: aggregate trên mảng (Map), render sau khi gom — vẫn cap MAX_DOM
    var m = new Map();
    loc.forEach(function(r){
      var g = m.get(r[0]); if (!g){ g = { pn: r[1], nLoc: 0, sys: 0, dem: 0, diff: 0 }; m.set(r[0], g); }
      g.nLoc++; g.sys += r[4]; g.dem += (r[5] || 0); g.diff += r[6];
    });
    var arr = [...m.entries()].sort(function(a, b){ return Math.abs(b[1].diff) - Math.abs(a[1].diff); });
    tong = arr.length;
    for (var j = 0; j < arr.length && out.length < MAX_DOM; j++){ var e = arr[j], g2 = e[1];
      out.push("<tr><td><b>" + esc(e[0]) + '</b></td><td class="fk-pn">' + esc(g2.pn) + '</td><td class="num">' + nf(g2.nLoc) +
        '</td><td class="num">' + nf(g2.sys) + '</td><td class="num">' + nf(g2.dem) + "</td>" + tdDiff(g2.diff) + "</tr>");
    }
    html = "<table><thead><tr><th>SKU</th><th>ProductName</th><th class=\"num\">Số vị trí</th>" +
      '<th class="num">Hệ thống</th><th class="num">Đã đếm</th><th class="num">Lệch</th></tr></thead><tbody>' +
      (out.join("") || '<tr><td colspan="6" style="text-align:center;color:var(--muted)">Không có dòng phù hợp</td></tr>') + "</tbody></table>";
  }
  $id("fkTbl").innerHTML = html;
  $id("fkNote").textContent = tong > out.length
    ? "Hiển thị " + nf(out.length) + " / " + nf(tong) + " dòng — dùng ô tìm kiếm hoặc pill lọc để thu hẹp (trần " + MAX_DOM + " dòng chống giật lag)."
    : nf(tong) + " dòng.";
}

/* ===== ĐỒNG BỘ WMS (qua GAS proxy) — AbortController 4 phút, không white-screen ===== */
function sync(){
  if (_syncing) return;
  _syncing = true;
  var btn = $id("fkSync"); btn.disabled = true;
  btn.firstElementChild.textContent = "Đang đồng bộ WMS…";
  var ac = new AbortController();
  var to = setTimeout(function(){ ac.abort(); }, FETCH_TIMEOUT_MS);
  fetch(APPSCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "force_sync_kiemke" }), signal: ac.signal })
    .then(function(r){ return r.json(); })
    .then(function(j){
      if (j.status === "success"){
        _lastSyncMs = j.at || Date.now();
        $id("fkSyncTs").textContent = tsHint(_lastSyncMs);
        toast("Đã đồng bộ kiểm kê (" + nf(j.written || 0) + " dòng" + (j.capped ? ", CAP TEST " + j.maxPage + " trang/kho" : "") + ").", "ok");
        loadData();
      } else if (j.code === 401){ toast("Token WMS đã hết hạn. Đang chờ luồng chạy ngầm cập nhật Token mới.", "err"); }
      else if (j.code === 429){ toast(j.message || "Đồng bộ kiểm kê đang trong thời gian chờ — thử lại sau.", "warn"); }
      else { toast("Đồng bộ thất bại: " + (j.message || "backend chưa hỗ trợ force_sync_kiemke (chưa redeploy GAS?)."), "err"); }
    })
    .catch(function(e){
      toast(e.name === "AbortError" ? "Quá 4 phút chưa xong — đã ngắt request (GAS/WMS đang nghẽn?)." : "Không gọi được máy chủ (" + e.message + ").", "err");
    })
    .finally(function(){
      clearTimeout(to); _syncing = false;
      btn.disabled = false; btn.firstElementChild.textContent = "Đồng bộ WMS (test 2 trang/kho)";
    });
}

/* ===== DEV: dữ liệu mẫu để dựng UI không cần mạng/backend ===== */
function mock(){
  var khoList = ["WH - MATERIAL - MTG", "WH - MATERIAL - GARMENT"];
  var rows = [];
  for (var i = 0; i < 2400; i++){
    var sys = (i * 37) % 900 + 1;
    var dem = i % 7 === 0 ? null : (i % 11 === 0 ? sys - ((i % 5) + 1) : (i % 13 === 0 ? sys + ((i % 4) + 1) : sys));
    var diff = dem == null ? 0 : dem - sys;
    rows.push(["4225" + String(10000 + i), "Vải mẫu " + (i % 40) + "/CMTS00" + (i % 90) + "/Cotton demo", "F" + (i % 9) + "-A" + (i % 30) + "-0" + (i % 4),
      khoList[i % 2], sys, dem == null ? "" : dem, diff, dem == null ? "Chưa đếm" : diff === 0 ? "Khớp" : diff < 0 ? "Lệch âm" : "Lệch dương", "2026-07-15 08:00:00"]);
  }
  napRows(rows);
  toast("DEV: đã nạp 2.400 dòng dữ liệu mẫu (không gọi mạng).", "warn");
}

function toast(msg, type){
  var el = $id("fkToast");
  el.className = type || ""; el.textContent = msg;
  requestAnimationFrame(function(){ el.classList.add("show"); });
  clearTimeout(toast._t);
  toast._t = setTimeout(function(){ el.classList.remove("show"); }, 6000);
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
    // Pills: uỷ quyền trong pane — đổi view / filter trạng thái rồi render lại từ mảng (không re-fetch)
    pane.addEventListener("click", function(e){
      var v = e.target.closest("[data-fkview]");
      if (v){ view = v.getAttribute("data-fkview");
        pane.querySelectorAll("[data-fkview]").forEach(function(x){ x.classList.toggle("active", x === v); });
        renderTable(); return; }
      var s = e.target.closest("[data-fkst]");
      if (s){ fStatus = s.getAttribute("data-fkst");
        pane.querySelectorAll("[data-fkst]").forEach(function(x){ x.classList.toggle("active", x === s); });
        renderTable(); }
    });
    loadData();
    return;
  }
  if (!ROWS.length) loadData(); else loadTs();
}

window.FKIEMKE = {
  init: init,
  sync: sync,
  mock: mock,
  qfilter: function(){ clearTimeout(_deb); _deb = setTimeout(renderTable, 120); },
};
})();
