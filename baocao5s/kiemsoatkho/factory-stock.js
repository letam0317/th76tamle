/**
 * ============================================================================
 *  factory-stock.js — MODULE "TRẠNG THÁI LƯU TRỮ" (Tồn mã vị trí WMS) của FACTORY
 * ============================================================================
 *  Bê nguyên luồng chạy của dashboard stocklocationfactory (đã khai tử link riêng)
 *  vào portal kiemsoatkho dưới dạng 1 tab nội bộ:
 *   - Đọc live Google Sheet (gviz JSONP): tab mastige + garment + Metadata.
 *   - Đồng hồ "cập nhật lúc" lấy TỪ BACKEND (Metadata B1), không dùng giờ local.
 *   - Nút "Tải lại dữ liệu" gọi GAS force_sync_wms (kéo trực tiếp WMS) —
 *     anti-spam 4 giờ/lần: FE khoá nút + BE trả 429.
 *
 *  CÔ LẬP (scoping):
 *   - Toàn bộ biến sống trong closure; CHỈ lộ 1 global: window.FSTOCK (API cho inline onclick).
 *   - Mọi id/class DOM mang tiền tố fs- ; CSS bơm 1 lần, selector neo dưới #pane-fstock
 *     và .fs-modal — không đụng bảng Audit 5S của host.
 *   - Màu sắc dùng CSS variables của portal (--panel/--text/--muted/--line/--accent)
 *     -> tự ăn theo 7 theme sáng/tối sẵn có.
 *
 *  LAZY: file này chỉ được host inject khi người dùng đứng ở Factory ▸ Trạng thái lưu trữ.
 *  API: FSTOCK.init(paneEl) — idempotent; kích hoạt lại sẽ chỉ refresh nếu dữ liệu cũ >5'.
 * ============================================================================
 */
(function(){
"use strict";
if (window.FSTOCK) return;   // đã nạp rồi thì thôi (inject 2 lần vô hại)

/* ===== CẤU HÌNH (độc lập với host) ===== */
var SHEET_ID = "1eY_oo9fAvWCTXp24x-Z0FXq9mp_jJPlTHg09qdemETs";
var SHEET_URL = "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/edit";
var TABS = [{ sheet: "mastige", div: "Mastige" }, { sheet: "garment", div: "Garment" }];
var DIV_ORDER = ["Mastige", "Garment"];
var APPSCRIPT_URL = "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
var META_TAB = "Metadata";
var COOLDOWN_MS = 4 * 60 * 60 * 1000;        // anti-spam: chỉ được gọi WMS 4 giờ/lần
var DEV_MODE = /[?&]dev=1/.test(location.search);   // ?dev=1: bản nháp — CHẶN sync thật (không đốt cooldown production)
var FETCH_TIMEOUT_MS = 4 * 60 * 1000;        // AbortController: ngắt request GAS sau 4 phút (chống nút treo vĩnh viễn)
var PAL = ["#2563eb", "#0ea5e9", "#14b8a6", "#f59e0b", "#8b5cf6", "#ef4444", "#10b981", "#ec4899", "#6366f1", "#f43f5e", "#0891b2", "#84cc16"];

/* ===== STATE (đóng trong closure — không rò ra global) ===== */
var LAST_SYNC_MS = 0, _syncing = false, _rowCount = 0, _unlockTimer = null, _toastTimer = null;
var WH_DATA = {}, WH_COLOR = {}, curWh = null, curTab = "shelf", CUR_CATS = [], _deb = null;
var _raw = [], _pending = 0, _failed = 0, _lastLoadAt = 0, _boot = false;
var PANE = null;

var $id = function(s){ return document.getElementById(s); };
function nf(x){ return (x || 0).toLocaleString("en-US"); }
function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
function isShelf(loc){ var s = (loc || "").toString().trim().toUpperCase(); return !(s.indexOf("F0-A0") === 0 || s.indexOf("F00-A00") === 0); }
function fmtTime(ms){ var d = new Date(ms); function p(n){ return (n < 10 ? "0" : "") + n; }
  return p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds()) + " " + p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear(); }

/* ===== CSS — bơm 1 lần, neo dưới #pane-fstock / .fs-modal, màu theo theme host ===== */
var CSS = [
"#pane-fstock .fs-srcbar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:14px 0 6px;font-size:12.5px;}",
"#pane-fstock .fs-chip{background:color-mix(in srgb, var(--accent,#2563eb) 14%, transparent);color:var(--accent,#1e40af);border-radius:999px;padding:4px 13px;font-weight:650;font-size:12px;}",
"#pane-fstock .fs-srcbar a{color:var(--accent,#2563eb);text-decoration:none;font-weight:600;} #pane-fstock .fs-srcbar a:hover{text-decoration:underline;}",
"#pane-fstock .fs-hint{color:var(--muted,#9ca3af);font-size:11.5px;font-weight:400;}",
"#fsReload{background:var(--accent,#1f2937);color:#fff;border:0;border-radius:9px;padding:8px 15px;font-size:12.5px;font-weight:650;cursor:pointer;min-height:36px;}",
"#fsReload:disabled{background:color-mix(in srgb, var(--muted,#9ca3af) 42%, var(--panel,#fff));color:var(--muted,#9ca3af);cursor:not-allowed;transform:none;}",
"@media(max-width:640px){#fsReload{min-height:44px;padding:10px 16px;}}",
"#pane-fstock .fs-cards{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin:16px 0 12px;}",
"@media(max-width:820px){#pane-fstock .fs-cards{grid-template-columns:repeat(2,1fr)!important;}}",
"#pane-fstock .fs-card{color:#fff;border-radius:14px;padding:16px 18px;box-shadow:0 1px 2px rgba(16,24,40,.05),0 4px 16px rgba(16,24,40,.06);}",
"#pane-fstock .fs-card .k{font-size:25px;font-weight:780;line-height:1;font-variant-numeric:tabular-nums;}",
"#pane-fstock .fs-card .l{font-size:11.5px;opacity:.94;margin-top:7px;font-weight:500;}",
"#pane-fstock .fs-c1{background:linear-gradient(135deg,#0f766e,#14b8a6);} #pane-fstock .fs-c2{background:linear-gradient(135deg,#b45309,#f59e0b);}",
"#pane-fstock .fs-c3{background:linear-gradient(135deg,#1e40af,#3b82f6);} #pane-fstock .fs-c4{background:linear-gradient(135deg,#6d28d9,#8b5cf6);} #pane-fstock .fs-c5{background:linear-gradient(135deg,#9f1239,#f43f5e);}",
"#pane-fstock .fs-ratewrap{margin:4px 0 18px;} #pane-fstock .fs-ratehdr{display:flex;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:6px;}",
"#pane-fstock .fs-tag{font-size:12px;font-weight:650;padding:4px 12px;border-radius:999px;}",
"#pane-fstock .fs-tag.sh{background:#d1faf3;color:#0f766e;} #pane-fstock .fs-tag.rem{background:#fdf0d5;color:#b45309;}",
"#pane-fstock .fs-ratebar{display:flex;background:color-mix(in srgb, var(--muted,#9ca3af) 22%, transparent);border-radius:10px;height:28px;overflow:hidden;}",
"#pane-fstock .fs-ratef,#pane-fstock .fs-ratefr{height:100%;color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;min-width:0;width:0;transition:width 1s cubic-bezier(.4,0,.2,1);white-space:nowrap;overflow:hidden;}",
"#pane-fstock .fs-ratef{background:linear-gradient(90deg,#0f766e,#14b8a6);} #pane-fstock .fs-ratefr{background:linear-gradient(90deg,#f59e0b,#fbbf24);}",
"#pane-fstock .fs-panel{background:var(--panel,#fff);border:1px solid var(--line,#e8ecf1);border-radius:14px;padding:18px 20px;margin-bottom:14px;}",
"#pane-fstock .fs-panel h2{margin:0 0 14px;font-size:14.5px;font-weight:680;color:var(--text,#374151);display:flex;align-items:center;gap:8px;flex-wrap:wrap;}",
"#pane-fstock .fs-whlist{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;}",
"@media(max-width:720px){#pane-fstock .fs-whlist{grid-template-columns:1fr;}}",
"#pane-fstock .fs-whcard{background:color-mix(in srgb, var(--panel,#fbfcfe) 92%, var(--text,#000) 2%);border:1px solid var(--line,#e8ecf1);border-radius:12px;padding:12px 14px;}",
"#pane-fstock .fs-whtop{display:flex;justify-content:space-between;align-items:center;font-size:12px;gap:10px;}",
"#pane-fstock .fs-whname{font-weight:600;max-width:56%;color:var(--text,#1f2937);}",
"#pane-fstock .fs-whnum{background:#ecfdf6;border:1px solid #a7f3d0;color:#0f766e;border-radius:9px;padding:6px 12px;font-size:12px;cursor:pointer;white-space:nowrap;font-weight:600;min-height:32px;}",
"#pane-fstock .fs-whnum b{font-size:14px;font-variant-numeric:tabular-nums;}",
"#pane-fstock .fs-whnum:hover{background:#0f766e;color:#fff;border-color:#0f766e;}",
"@media(max-width:640px){#pane-fstock .fs-whtop{flex-direction:column;align-items:stretch;gap:9px;} #pane-fstock .fs-whname{max-width:100%;} #pane-fstock .fs-whnum{width:100%;text-align:center;min-height:44px;}}",
"#pane-fstock .fs-prog{background:color-mix(in srgb, var(--muted,#9ca3af) 22%, transparent);border-radius:6px;height:8px;margin:9px 0 6px;overflow:hidden;}",
"#pane-fstock .fs-progf{height:100%;border-radius:6px;width:0;transition:width .9s cubic-bezier(.4,0,.2,1);}",
"#pane-fstock .fs-whsub{font-size:11px;color:var(--muted,#6b7280);} #pane-fstock .fs-whsub b{color:#d97706;}",
"#pane-fstock .fs-dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:7px;vertical-align:middle;}",
"#pane-fstock .fs-acc{border:1px solid var(--line,#e8ecf1);border-radius:14px;overflow:hidden;background:var(--panel,#fff);margin-bottom:12px;}",
"#pane-fstock .fs-acchd{width:100%;display:flex;justify-content:space-between;align-items:center;gap:14px;background:transparent;border:0;padding:15px 18px;cursor:pointer;text-align:left;}",
"#pane-fstock .fs-acctitle{font-weight:700;font-size:15px;color:var(--text,#1f2937);display:flex;align-items:center;gap:11px;}",
"#pane-fstock .fs-chev{width:9px;height:9px;border-right:2px solid var(--muted,#9ca3af);border-bottom:2px solid var(--muted,#9ca3af);transform:rotate(-45deg);transition:transform .28s;flex:none;}",
"#pane-fstock .fs-acc.open .fs-chev{transform:rotate(45deg);}",
"#pane-fstock .fs-accmeta{font-size:12px;color:var(--muted,#6b7280);white-space:nowrap;text-align:right;}",
"#pane-fstock .fs-accmeta b{color:#0f9488;font-variant-numeric:tabular-nums;} #pane-fstock .fs-accmeta b.q{color:var(--text,#1f2937);}",
"@media(max-width:640px){#pane-fstock .fs-accmeta{white-space:normal;line-height:1.4;max-width:150px;}}",
"#pane-fstock .fs-accbody{display:grid;grid-template-rows:0fr;transition:grid-template-rows .3s cubic-bezier(.4,0,.2,1);}",
"#pane-fstock .fs-acc.open .fs-accbody{grid-template-rows:1fr;}",
"#pane-fstock .fs-accinner{overflow:hidden;min-height:0;}",
"#pane-fstock .fs-tblscroll{overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:thin;}",
"#pane-fstock .fs-wtbl{width:100%;border-collapse:collapse;font-size:13px;color:var(--text,#1f2937);}",
"#pane-fstock .fs-wtbl th,#pane-fstock .fs-wtbl td{padding:10px 16px;text-align:left;border-top:1px solid var(--line,#e8ecf1);}",
"#pane-fstock .fs-wtbl thead th{color:var(--muted,#9ca3af);font-size:10.5px;font-weight:650;text-transform:uppercase;letter-spacing:.04em;}",
"#pane-fstock .fs-wtbl tbody tr{cursor:pointer;} #pane-fstock .fs-wtbl tbody tr:hover{background:color-mix(in srgb, var(--accent,#2563eb) 7%, transparent);}",
"#pane-fstock .fs-num{text-align:right!important;font-variant-numeric:tabular-nums;} #pane-fstock .fs-pend{color:#d97706;font-weight:600;}",
"#pane-fstock .fs-go{color:var(--accent,#2563eb);font-weight:600;font-size:12px;opacity:0;} #pane-fstock .fs-wtbl tbody tr:hover .fs-go{opacity:1;}",
"#pane-fstock .fs-barrow{display:grid;grid-template-columns:180px 1fr 104px;align-items:center;gap:12px;margin-bottom:11px;}",
"#pane-fstock .fs-blab{font-size:11.5px;line-height:1.3;text-align:right;color:var(--text,#374151);} #pane-fstock .fs-blab small{color:var(--muted,#9ca3af);font-size:10px;display:block;}",
"#pane-fstock .fs-btrack{background:color-mix(in srgb, var(--muted,#9ca3af) 22%, transparent);border-radius:7px;height:20px;overflow:hidden;display:flex;}",
"#pane-fstock .fs-bfill{height:100%;width:0;transition:width .9s cubic-bezier(.4,0,.2,1);} #pane-fstock .fs-bfill.sh{background:#14b8a6;} #pane-fstock .fs-bfill.pe{background:#f7c07a;}",
"#pane-fstock .fs-bval{font-weight:700;font-size:12.5px;text-align:right;font-variant-numeric:tabular-nums;line-height:1.2;color:var(--text,#1f2937);}",
"#pane-fstock .fs-bval b{color:#0f9488;} #pane-fstock .fs-bval small{display:block;color:#d97706;font-size:10px;font-weight:600;}",
"@media(max-width:640px){#pane-fstock .fs-barrow{grid-template-columns:1fr auto;grid-template-areas:'lab val' 'bar bar';gap:5px 10px;margin-bottom:14px;} #pane-fstock .fs-blab{grid-area:lab;text-align:left;} #pane-fstock .fs-btrack{grid-area:bar;} #pane-fstock .fs-bval{grid-area:val;white-space:nowrap;}}",
"#pane-fstock .fs-state{padding:56px 20px;text-align:center;color:var(--muted,#6b7280);}",
"#pane-fstock .fs-spin{width:32px;height:32px;border:3px solid var(--line,#d5dbe4);border-top-color:var(--accent,#2563eb);border-radius:50%;margin:0 auto 16px;animation:fs-sp .8s linear infinite;}",
"@keyframes fs-sp{to{transform:rotate(360deg)}}",
"#pane-fstock .fs-fade{animation:fs-in .45s cubic-bezier(.32,.72,0,1) both;}",
"@keyframes fs-in{from{opacity:0;transform:translate3d(0,12px,0)}to{opacity:1;transform:none}}",
/* modal — gắn ở body nên neo theo class riêng */
".fs-modal{display:none;position:fixed;inset:0;background:rgba(17,24,39,.55);backdrop-filter:blur(6px);z-index:1200;align-items:center;justify-content:center;padding:18px;opacity:0;transition:opacity .22s;}",
".fs-modal.show{opacity:1;}",
".fs-modalbox{background:var(--panel,#fff);color:var(--text,#1f2937);border-radius:18px;width:min(1280px,96vw);max-height:90vh;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(16,24,40,.3);transform:translateY(12px) scale(.985);opacity:.6;transition:transform .26s,opacity .26s;}",
".fs-modal.show .fs-modalbox{transform:none;opacity:1;}",
".fs-modalhd{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--line,#e8ecf1);}",
".fs-modalhd .mt{font-weight:700;font-size:15.5px;} .fs-modalhd .mtsub{font-size:11.5px;color:var(--muted,#9ca3af);margin-top:2px;}",
".fs-mclose{background:0;border:0;font-size:24px;line-height:1;cursor:pointer;color:var(--muted,#9ca3af);padding:6px 10px;border-radius:8px;min-width:44px;min-height:40px;}",
".fs-mclose:hover{color:#ef4444;background:color-mix(in srgb,#ef4444 12%,transparent);}",
".fs-tabs{display:flex;gap:8px;padding:12px 20px 0;}",
".fs-tab{border:1px solid var(--line,#e8ecf1);background:transparent;border-radius:10px 10px 0 0;padding:9px 18px;cursor:pointer;font-size:13px;font-weight:600;color:var(--muted,#6b7280);min-height:38px;}",
".fs-tab.active{background:var(--accent,#1f2937);color:#fff;border-color:var(--accent,#1f2937);}",
".fs-mfilters{display:grid;grid-template-columns:1.3fr 1fr 1fr 1.6fr;gap:8px;padding:12px 20px;border-bottom:1px solid var(--line,#e8ecf1);border-top:1px solid var(--line,#e8ecf1);}",
"@media(max-width:720px){.fs-mfilters{grid-template-columns:1fr 1fr;}}",
".fs-mfilters .fld{display:flex;flex-direction:column;gap:3px;}",
".fs-mfilters label{font-size:10px;font-weight:650;color:var(--muted,#9ca3af);text-transform:uppercase;letter-spacing:.04em;}",
".fs-mfilters input{padding:9px 10px;border:1px solid var(--line,#d5dbe4);border-radius:9px;font-size:12.5px;background:var(--panel,#fff);color:var(--text,#1f2937);width:100%;min-height:38px;}",
".fs-mfilters input:focus{outline:0;border-color:var(--accent,#2563eb);}",
".fs-combo{position:relative;}",
".fs-combo-menu{position:absolute;top:calc(100% + 5px);left:0;right:0;z-index:40;background:var(--panel,#fff);border:1px solid var(--line,#e8ecf1);border-radius:11px;box-shadow:0 24px 60px rgba(16,24,40,.28);max-height:250px;overflow-y:auto;overscroll-behavior:contain;padding:5px;opacity:0;visibility:hidden;transform:translateY(-6px);transition:.16s;}",
".fs-combo-menu.show{opacity:1;visibility:visible;transform:none;}",
".fs-combo-item{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 11px;border-radius:8px;font-size:12.5px;cursor:pointer;color:var(--text,#1f2937);white-space:nowrap;overflow:hidden;}",
".fs-combo-item .nm{overflow:hidden;text-overflow:ellipsis;} .fs-combo-item .c{color:var(--muted,#9ca3af);font-size:11px;flex:none;}",
".fs-combo-item:hover{background:color-mix(in srgb, var(--accent,#2563eb) 10%, transparent);color:var(--accent,#2563eb);}",
".fs-combo-item.all{border-bottom:1px solid var(--line,#e8ecf1);font-weight:600;}",
".fs-combo-empty{padding:12px;font-size:12px;color:var(--muted,#9ca3af);text-align:center;}",
".fs-msum{padding:9px 20px;font-size:12px;color:var(--muted,#6b7280);border-bottom:1px solid var(--line,#e8ecf1);font-variant-numeric:tabular-nums;}",
".fs-modalbody{overflow:auto;padding:0 20px 20px;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;}",
".fs-mtbl{width:100%;border-collapse:collapse;font-size:12.5px;color:var(--text,#1f2937);}",
".fs-mtbl thead th{position:sticky;top:0;background:var(--accent,#1f2937);color:#fff;padding:9px 11px;text-align:left;font-weight:600;font-size:11px;z-index:1;white-space:nowrap;}",
".fs-mtbl td{padding:8px 11px;border-bottom:1px solid var(--line,#f1f4f8);vertical-align:top;white-space:nowrap;}",
".fs-mtbl .empty{text-align:center;color:var(--muted,#9ca3af);padding:28px;}",
".fs-mtbl .pn{color:var(--muted,#6b7280);white-space:normal;min-width:320px;word-break:break-word;}",
".fs-loc{font-family:ui-monospace,Consolas,monospace;color:#0f9488;font-size:12px;}",
"#fsToast{position:fixed;left:50%;bottom:28px;transform:translate(-50%,16px);background:#111827;color:#fff;padding:12px 20px;border-radius:12px;font-size:13px;font-weight:600;box-shadow:0 24px 60px rgba(16,24,40,.35);opacity:0;pointer-events:none;z-index:1300;max-width:92vw;text-align:center;transition:opacity .25s,transform .25s;}",
"#fsToast.show{opacity:1;transform:translate(-50%,0);}",
"#fsToast.ok{background:#0f766e;} #fsToast.warn{background:#b45309;} #fsToast.err{background:#b42318;}",
].join("\n");

/* ===== KHUNG HTML của tab (bơm vào pane) ===== */
var KHUNG =
'<div class="fs-srcbar">' +
'  <span class="fs-chip">Tồn mã vị trí — WMS Factory</span>' +
'  <a href="' + SHEET_URL + '" target="_blank" rel="noopener">Mở Google Sheet</a>' +
'  <span id="fsLoadinfo" class="fs-hint"></span>' +
'  <button id="fsReload" onclick="FSTOCK.syncWms()" title="Kéo dữ liệu mới trực tiếp từ WMS">Tải lại dữ liệu</button>' +
'</div>' +
'<div id="fsContent"></div>' +
'<div id="fsState" class="fs-state"><div class="fs-spin"></div>Đang tải dữ liệu trực tiếp từ Google Sheet…</div>';

var MODAL =
'<div id="fsModal" class="fs-modal">' +
'  <div class="fs-modalbox">' +
'    <div class="fs-modalhd"><div><div class="mt" id="fsMtitle"></div><div class="mtsub">Chi tiết SKU theo mã vị trí — lọc theo từng cột bên dưới</div></div>' +
'      <button class="fs-mclose" onclick="FSTOCK.closeModal()">&times;</button></div>' +
'    <div class="fs-tabs">' +
'      <button id="fsTabShelf" class="fs-tab active" onclick="FSTOCK.setTab(\'shelf\')">Đã lên kệ (<span id="fsCShelf">0</span>)</button>' +
'      <button id="fsTabPend" class="fs-tab" onclick="FSTOCK.setTab(\'pend\')">Chưa lên kệ (<span id="fsCPend">0</span>)</button>' +
'    </div>' +
'    <div class="fs-mfilters">' +
'      <div class="fld"><label>CategoryName</label><div class="fs-combo" id="fsCatCombo"><input id="fsFCat" autocomplete="off" placeholder="Tất cả category…" oninput="FSTOCK.onCatInput()" onfocus="FSTOCK.renderCatMenu()"><div class="fs-combo-menu" id="fsCatMenu"></div></div></div>' +
'      <div class="fld"><label>Mã vị trí</label><input id="fsFLoc" oninput="FSTOCK.qfilter()" placeholder="Lọc vị trí…"></div>' +
'      <div class="fld"><label>SKU</label><input id="fsFSku" oninput="FSTOCK.qfilter()" placeholder="Lọc SKU…"></div>' +
'      <div class="fld"><label>ProductName</label><input id="fsFName" oninput="FSTOCK.qfilter()" placeholder="Lọc tên sản phẩm…"></div>' +
'    </div>' +
'    <div class="fs-msum" id="fsMsum"></div>' +
'    <div class="fs-modalbody"><table class="fs-mtbl"><thead><tr>' +
'      <th>CategoryName</th><th>Mã vị trí</th><th>SKU</th><th>ProductName</th><th class="fs-num">Số lượng</th>' +
'    </tr></thead><tbody id="fsMbody"></tbody></table></div>' +
'  </div>' +
'</div>' +
'<div id="fsToast"></div>';

/* ===== TẢI DỮ LIỆU (gviz JSONP — callback mang tiền tố fsgv_, không đụng host) ===== */
function loadData(){
  $id("fsReload").disabled = true;
  var st = $id("fsState"); st.style.display = "block";
  st.innerHTML = '<div class="fs-spin"></div>Đang tải dữ liệu trực tiếp từ Google Sheet…';
  $id("fsContent").innerHTML = "";
  _raw = []; _pending = TABS.length; _failed = 0; _lastLoadAt = Date.now();
  TABS.forEach(function(t, i){
    var cb = "fsgv_" + i;
    window[cb] = function(resp){ onTab(resp, t.div); };
    var url = "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/gviz/tq?tqx=out:json;responseHandler:" + cb +
      "&sheet=" + encodeURIComponent(t.sheet) + "&tq=" + encodeURIComponent("select A,C,D,F,G,M");
    var old = $id("fs_sc_" + i); if (old) old.remove();
    var sc = document.createElement("script"); sc.id = "fs_sc_" + i; sc.src = url;
    sc.onerror = function(){ _failed++; _pending--; checkDone(); };
    document.body.appendChild(sc);
  });
  loadMeta();
}
function onTab(resp, div){
  try{
    var rows = (resp && resp.table && resp.table.rows) || [];
    for (var i = 0; i < rows.length; i++){ var c = rows[i].c; if (c) _raw.push([c, div]); }
  }catch(e){ _failed++; }
  _pending--; checkDone();
}
function checkDone(){
  if (_pending > 0) return;
  if (_raw.length === 0){
    $id("fsState").innerHTML = "⚠ Không tải được dữ liệu. Kiểm tra quyền chia sẻ Google Sheet rồi thử lại.";
    capNhatNut(); return;
  }
  aggregate();
  capNhatNut();
}
/* Mốc "cập nhật lúc" TỪ BACKEND (Metadata B1 do GAS/Node ghi) — không dùng new Date() local */
function loadMeta(){
  window.fsgv_meta = function(resp){
    try{
      var c = resp.table.rows[0].c;
      var ms = (c[1] && c[1].v != null) ? Number(c[1].v) : 0;
      if (ms > 0) LAST_SYNC_MS = ms;
    }catch(e){ /* chưa có Metadata */ }
    capNhatThongTin(); capNhatNut();
  };
  var url = "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/gviz/tq?tqx=out:json;responseHandler:fsgv_meta" +
    "&sheet=" + encodeURIComponent(META_TAB) + "&headers=0&range=A1:B1";
  var old = $id("fs_sc_meta"); if (old) old.remove();
  var sc = document.createElement("script"); sc.id = "fs_sc_meta"; sc.src = url;
  sc.onerror = function(){ capNhatThongTin(); capNhatNut(); };
  document.body.appendChild(sc);
}

/* ===== GOM NHÓM + RENDER (nguyên thuật toán parse của stocklocationfactory) ===== */
function aggregate(){
  var agg = {}, detail = {}, whset = {}, whDiv = {};
  for (var i = 0; i < _raw.length; i++){
    var c = _raw[i][0], div = _raw[i][1];
    var sku = (c[0] && c[0].v != null) ? String(c[0].v) : "";
    var pn = (c[1] && c[1].v != null) ? String(c[1].v) : "";
    var loc = (c[2] && c[2].v != null) ? String(c[2].v) : "";
    var cat = (c[3] && c[3].v != null) ? String(c[3].v) : "(trống)";
    var wh = (c[4] && c[4].v != null) ? String(c[4].v) : "";
    var tot = (c[5] && c[5].v != null) ? Number(c[5].v) : 0;
    if (sku === "" && loc === "" && wh === "") continue;
    if (!agg[wh]) agg[wh] = {};
    if (!agg[wh][cat]) agg[wh][cat] = { sh: {}, pe: {}, ts: 0, tp: 0 };
    if (!detail[wh]) detail[wh] = { shelf: [], pend: [] };
    whset[wh] = 1; whDiv[wh] = div;
    var a = agg[wh][cat];
    if (isShelf(loc)){ a.sh[sku] = 1; a.ts += tot; detail[wh].shelf.push([sku, pn, loc, cat, tot]); }
    else{ a.pe[sku] = 1; a.tp += tot; detail[wh].pend.push([sku, pn, loc, cat, tot]); }
  }
  var groups = [];
  for (var w in agg){ for (var ct in agg[w]){ var g = agg[w][ct];
    groups.push([w, ct, Object.keys(g.sh).length, g.ts, Object.keys(g.pe).length, g.tp]); } }
  groups.sort(function(x, y){ if (x[0] < y[0]) return -1; if (x[0] > y[0]) return 1; return y[2] - x[2]; });
  WH_DATA = detail;
  var ci = 0; Object.keys(whset).forEach(function(w){ WH_COLOR[w] = PAL[ci++ % PAL.length]; });
  render(groups, whDiv);
  _rowCount = _raw.length;
  capNhatThongTin();
}

function render(groups, whDiv){
  $id("fsState").style.display = "none";
  var wh = {};
  groups.forEach(function(d){
    if (!wh[d[0]]) wh[d[0]] = [0, 0, 0, 0, 0, whDiv[d[0]]];
    wh[d[0]][0] += d[2]; wh[d[0]][1] += d[3]; wh[d[0]][2] += d[4]; wh[d[0]][3] += 1; wh[d[0]][4] += d[5];
  });
  var gSh = 0, gPe = 0; groups.forEach(function(d){ gSh += d[2]; gPe += d[4]; });
  var rate = (gSh + gPe) ? gSh / (gSh + gPe) * 100 : 0;

  var top = groups.slice().filter(function(d){ return d[2] > 0; }).sort(function(a, b){ return b[2] - a[2]; }).slice(0, 12);
  var bars = top.map(function(d){
    var tot = d[2] + d[4], g = tot ? d[2] / tot * 100 : 0, a = tot ? d[4] / tot * 100 : 0;
    return '<div class="fs-barrow"><div class="fs-blab" title="' + esc(d[0]) + '">' + esc(d[1]) + '<small>' + esc(d[0]) + '</small></div>' +
      '<div class="fs-btrack" title="Đã lên kệ ' + nf(d[2]) + ' / ' + nf(tot) + '">' +
      '<div class="fs-bfill sh" data-fsw="' + g.toFixed(2) + '"></div><div class="fs-bfill pe" data-fsw="' + a.toFixed(2) + '"></div></div>' +
      '<div class="fs-bval"><b>' + nf(d[2]) + '</b> / ' + nf(tot) + '<small>còn ' + nf(d[4]) + '</small></div></div>';
  }).join("");

  var whKeys = Object.keys(wh).sort(function(a, b){ return wh[b][0] - wh[a][0]; });
  var whchips = whKeys.map(function(w){
    var v = wh[w], rt = (v[0] + v[2]) ? v[0] / (v[0] + v[2]) * 100 : 0;
    return '<div class="fs-whcard"><div class="fs-whtop"><span class="fs-whname"><span class="fs-dot" style="background:' + WH_COLOR[w] + '"></span>' + esc(w) + '</span>' +
      '<button class="fs-whnum" data-fswh="' + esc(w) + '"><b>' + nf(v[0]) + '</b> / ' + nf(v[0] + v[2]) + ' SKU</button></div>' +
      '<div class="fs-prog"><div class="fs-progf" data-fsw="' + rt.toFixed(1) + '" style="background:' + WH_COLOR[w] + '"></div></div>' +
      '<div class="fs-whsub">' + v[3] + ' nhóm · còn <b>' + nf(v[2]) + '</b> SKU cần lên kệ · lên kệ ' + rt.toFixed(0) + '%</div></div>';
  }).join("");

  var acc = "";
  DIV_ORDER.forEach(function(div){
    var members = whKeys.filter(function(w){ return wh[w][5] === div; });
    if (!members.length) return;
    var dSh = 0, dPe = 0, dQty = 0;
    members.forEach(function(w){ var v = wh[w]; dSh += v[0]; dPe += v[2]; dQty += v[1] + v[4]; });
    var rows = members.map(function(w){
      var v = wh[w], rt = (v[0] + v[2]) ? v[0] / (v[0] + v[2]) * 100 : 0, qty = v[1] + v[4];
      return '<tr data-fswh="' + esc(w) + '">' +
        '<td><span class="fs-dot" style="background:' + WH_COLOR[w] + '"></span><b>' + esc(w) + '</b></td>' +
        '<td class="fs-num">' + nf(v[0]) + ' / ' + nf(v[0] + v[2]) + '</td>' +
        '<td class="fs-num fs-pend">' + nf(v[2]) + '</td>' +
        '<td class="fs-num"><b>' + nf(qty) + '</b></td>' +
        '<td class="fs-num">' + rt.toFixed(0) + '% <span class="fs-go">Xem chi tiết →</span></td></tr>';
    }).join("");
    acc += '<div class="fs-acc open"><button class="fs-acchd" onclick="this.parentNode.classList.toggle(\'open\')">' +
      '<span class="fs-acctitle"><span class="fs-chev"></span>' + esc(div) + '</span>' +
      '<span class="fs-accmeta">' + members.length + ' kho · <b>' + nf(dSh) + '</b> SKU lên kệ · còn ' + nf(dPe) + ' · Total <b class="q">' + nf(dQty) + '</b></span></button>' +
      '<div class="fs-accbody"><div class="fs-accinner"><div class="fs-tblscroll"><table class="fs-wtbl"><thead><tr>' +
      '<th>Kho (stock)</th><th class="fs-num">SKU lên kệ / tổng</th><th class="fs-num">Còn cần lên kệ</th><th class="fs-num">Số lượng Total</th><th class="fs-num">Tỷ lệ</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div></div></div></div>';
  });

  $id("fsContent").innerHTML =
    '<div class="fs-fade">' +
    '<section class="fs-cards">' +
    '<div class="fs-card fs-c1"><div class="k">' + nf(gSh) + '</div><div class="l">SKU đã lên kệ</div></div>' +
    '<div class="fs-card fs-c2"><div class="k">' + nf(gPe) + '</div><div class="l">SKU còn cần lên kệ</div></div>' +
    '<div class="fs-card fs-c3"><div class="k">' + rate.toFixed(1) + '%</div><div class="l">Tỷ lệ đã lên kệ</div></div>' +
    '<div class="fs-card fs-c4"><div class="k">' + whKeys.length + '</div><div class="l">Kho (warehouse)</div></div>' +
    '<div class="fs-card fs-c5"><div class="k">' + groups.length + '</div><div class="l">Nhóm Kho × Cate</div></div>' +
    '</section>' +
    '<div class="fs-ratewrap"><div class="fs-ratehdr">' +
    '<span class="fs-tag sh">Đã lên kệ ' + rate.toFixed(1) + '% (' + nf(gSh) + ' SKU)</span>' +
    '<span class="fs-tag rem">Còn lại ' + (100 - rate).toFixed(1) + '% (' + nf(gPe) + ' SKU)</span></div>' +
    '<div class="fs-ratebar"><div class="fs-ratef" data-fsw="' + rate.toFixed(1) + '">' + rate.toFixed(0) + '%</div>' +
    '<div class="fs-ratefr" data-fsw="' + (100 - rate).toFixed(1) + '">' + (100 - rate).toFixed(0) + '%</div></div></div>' +
    '<section class="fs-panel"><h2>Bảng chi tiết <span class="fs-hint">(bấm từng kho để xem chi tiết &amp; total)</span></h2>' + acc + '</section>' +
    '<section class="fs-panel"><h2>Tiến độ lên kệ theo Warehouse <span class="fs-hint">(bấm số SKU để xem chi tiết)</span></h2><div class="fs-whlist">' + whchips + '</div></section>' +
    '<section class="fs-panel"><h2>Top Category theo số SKU đã lên kệ</h2>' + bars + '</section>' +
    '</div>';
  requestAnimationFrame(function(){ requestAnimationFrame(function(){
    PANE.querySelectorAll("[data-fsw]").forEach(function(el){ el.style.width = el.getAttribute("data-fsw") + "%"; });
  }); });
}

/* ===== MODAL CHI TIẾT ===== */
function fillCatOptions(){
  var rows = WH_DATA[curWh][curTab], cnt = {};
  for (var i = 0; i < rows.length; i++){ var c = rows[i][3]; cnt[c] = (cnt[c] || 0) + 1; }
  CUR_CATS = Object.keys(cnt).sort().map(function(c){ return { name: c, n: cnt[c] }; });
}
function renderCatMenu(){
  var q = $id("fsFCat").value.toLowerCase();
  var items = CUR_CATS.filter(function(c){ return !q || c.name.toLowerCase().indexOf(q) >= 0; });
  var html = '<div class="fs-combo-item all" data-fsv=""><span class="nm">Tất cả category</span><span class="c">' + CUR_CATS.length + ' nhóm</span></div>';
  html += items.map(function(c){ return '<div class="fs-combo-item" data-fsv="' + esc(c.name) + '"><span class="nm">' + esc(c.name) + '</span><span class="c">' + nf(c.n) + '</span></div>'; }).join("");
  if (!items.length) html += '<div class="fs-combo-empty">Không có nhóm phù hợp</div>';
  var m = $id("fsCatMenu"); m.innerHTML = html; m.classList.add("show");
}
function closeCat(){ var m = $id("fsCatMenu"); if (m) m.classList.remove("show"); }
function openModal(w){
  if (!WH_DATA[w]) return;
  curWh = w; curTab = "shelf";
  $id("fsMtitle").textContent = w;
  $id("fsCShelf").textContent = nf(WH_DATA[w].shelf.length);
  $id("fsCPend").textContent = nf(WH_DATA[w].pend.length);
  $id("fsFLoc").value = ""; $id("fsFSku").value = ""; $id("fsFName").value = "";
  setModalTab("shelf");
  var m = $id("fsModal"); m.style.display = "flex";
  requestAnimationFrame(function(){ m.classList.add("show"); });
}
function closeModal(){
  var m = $id("fsModal"); m.classList.remove("show");
  setTimeout(function(){ m.style.display = "none"; }, 240);
}
function setModalTab(t){
  curTab = t;
  $id("fsTabShelf").classList.toggle("active", t === "shelf");
  $id("fsTabPend").classList.toggle("active", t === "pend");
  fillCatOptions();
  $id("fsFCat").value = ""; closeCat();
  renderRows();
}
function renderRows(){
  var fc = $id("fsFCat").value.toLowerCase(), fl = $id("fsFLoc").value.toLowerCase();
  var fss = $id("fsFSku").value.toLowerCase(), fn = $id("fsFName").value.toLowerCase();
  var rows = WH_DATA[curWh][curTab], out = [], cnt = 0, qsum = 0;
  for (var i = 0; i < rows.length; i++){ var r = rows[i];
    if (fc && r[3].toLowerCase().indexOf(fc) < 0) continue;
    if (fl && r[2].toLowerCase().indexOf(fl) < 0) continue;
    if (fss && r[0].toLowerCase().indexOf(fss) < 0) continue;
    if (fn && r[1].toLowerCase().indexOf(fn) < 0) continue;
    cnt++; qsum += r[4];
    if (out.length < 4000)
      out.push('<tr><td>' + esc(r[3]) + '</td><td class="fs-loc">' + esc(r[2]) + '</td><td>' + esc(r[0]) + '</td><td class="pn">' + esc(r[1]) + '</td><td class="fs-num">' + nf(r[4]) + '</td></tr>');
  }
  if (cnt > 4000) out.push('<tr><td colspan="5" class="empty">Hiển thị 4.000 / ' + nf(cnt) + ' dòng — dùng bộ lọc để thu hẹp.</td></tr>');
  $id("fsMbody").innerHTML = out.length ? out.join("") : '<tr><td colspan="5" class="empty">Không có dữ liệu phù hợp</td></tr>';
  $id("fsMsum").textContent = nf(cnt) + " dòng · tổng số lượng " + nf(qsum);
}

/* ===== ĐỒNG HỒ CẬP NHẬT + ANTI-SPAM 4H + TOAST ===== */
function capNhatThongTin(){
  var t = "";
  if (_rowCount) t = "· " + nf(_rowCount) + " dòng";
  if (LAST_SYNC_MS) t += (t ? " " : "") + "· cập nhật " + fmtTime(LAST_SYNC_MS);
  if (_failed) t += " · " + _failed + " tab lỗi";
  var el = $id("fsLoadinfo"); if (el) el.textContent = t;
}
function capNhatNut(){
  var btn = $id("fsReload"); if (!btn) return;
  if (_syncing){ btn.disabled = true; btn.textContent = "Đang đồng bộ WMS..."; btn.title = "Đang kéo dữ liệu từ WMS — có thể mất 1–3 phút."; return; }
  btn.textContent = "Tải lại dữ liệu";
  var remain = LAST_SYNC_MS ? (LAST_SYNC_MS + COOLDOWN_MS - Date.now()) : 0;
  if (remain > 0){
    btn.disabled = true;
    btn.title = "Chỉ có thể tải lại dữ liệu sau mỗi 4 giờ. Mở khoá lúc " + fmtTime(LAST_SYNC_MS + COOLDOWN_MS) + ".";
    clearTimeout(_unlockTimer);
    _unlockTimer = setTimeout(capNhatNut, Math.min(remain + 1000, 2147000000));
  } else { btn.disabled = false; btn.title = "Kéo dữ liệu mới trực tiếp từ WMS"; }
}
function toast(msg, type){
  var el = $id("fsToast");
  el.className = type || ""; el.textContent = msg;
  requestAnimationFrame(function(){ el.classList.add("show"); });
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function(){ el.classList.remove("show"); }, 6000);
}
function syncWms(){
  if (_syncing) return;
  // DEV FLAG: bản nháp tuyệt đối không kích hoạt sync production (đốt lượt cooldown 4h của cả phòng ban)
  if (DEV_MODE){ toast("Chế độ Dev: Đã chặn sync thật (force_sync_wms).", "warn"); return; }
  var remain = LAST_SYNC_MS ? (LAST_SYNC_MS + COOLDOWN_MS - Date.now()) : 0;
  if (remain > 0){ toast("Chỉ có thể tải lại dữ liệu sau mỗi 4 giờ. Còn " + Math.ceil(remain / 60000) + " phút nữa.", "warn"); capNhatNut(); return; }
  _syncing = true; capNhatNut();
  var ac = new AbortController();
  var to = setTimeout(function(){ ac.abort(); }, FETCH_TIMEOUT_MS);
  fetch(APPSCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "force_sync_wms" }), signal: ac.signal })
    .then(function(r){ clearTimeout(to); return r.json(); })
    .then(function(j){
      _syncing = false;
      if (j.status === "success"){
        LAST_SYNC_MS = j.at || LAST_SYNC_MS;
        toast("Đã đồng bộ WMS thành công!", "ok");
        loadData();
      } else if (j.code === 401){
        toast("Token WMS đã hết hạn. Đang chờ luồng chạy ngầm cập nhật Token mới.", "err");
      } else if (j.code === 429){
        if (j.lastSync) LAST_SYNC_MS = j.lastSync;
        toast(j.message || "Chỉ có thể tải lại dữ liệu sau mỗi 4 giờ.", "warn");
      } else {
        toast("Đồng bộ thất bại: " + (j.message || "lỗi không xác định."), "err");
      }
      capNhatThongTin(); capNhatNut();
    })
    .catch(function(e){
      clearTimeout(to); _syncing = false;
      toast(e.name === "AbortError" ? "Quá 4 phút chưa xong — đã ngắt request (GAS/WMS đang nghẽn?)." : "Không gọi được máy chủ đồng bộ (" + e.message + ").", "err");
      capNhatNut();
    });
}

/* ===== KHỞI TẠO (idempotent) — host gọi mỗi lần mở tab; chỉ dựng DOM 1 lần ===== */
function init(pane){
  PANE = pane;
  if (!_boot){
    _boot = true;
    var style = document.createElement("style"); style.id = "fsStyle"; style.textContent = CSS;
    document.head.appendChild(style);
    pane.innerHTML = KHUNG;
    var wrap = document.createElement("div"); wrap.id = "fsOverlays"; wrap.innerHTML = MODAL;
    document.body.appendChild(wrap);
    // Sự kiện uỷ quyền TRONG pane (bảng + thẻ kho -> mở modal); không gắn gì lên host
    pane.addEventListener("click", function(e){
      var el = e.target.closest("[data-fswh]");
      if (el) openModal(el.getAttribute("data-fswh"));
    });
    $id("fsModal").addEventListener("click", function(e){ if (e.target === $id("fsModal")) closeModal(); });
    $id("fsCatMenu").addEventListener("click", function(e){
      var it = e.target.closest(".fs-combo-item"); if (!it) return;
      $id("fsFCat").value = it.getAttribute("data-fsv") || ""; closeCat(); renderRows();
    });
    document.addEventListener("keydown", function(e){
      if (e.key !== "Escape") return;
      var m = $id("fsCatMenu");
      if (m && m.classList.contains("show")) closeCat();
      else if ($id("fsModal").classList.contains("show")) closeModal();
    });
    document.addEventListener("click", function(e){
      var combo = $id("fsCatCombo");
      if (combo && !combo.contains(e.target)) closeCat();
    });
    loadData();
    return;
  }
  // Kích hoạt lại: dữ liệu cũ >5 phút thì làm mới nhẹ (đọc Sheet, KHÔNG đụng WMS)
  if (Date.now() - _lastLoadAt > 5 * 60 * 1000 && !_syncing) loadData();
  else capNhatNut();
}

/* API công khai — DUY NHẤT 1 global */
window.FSTOCK = {
  init: init,
  syncWms: syncWms,
  openModal: openModal,
  closeModal: closeModal,
  setTab: setModalTab,
  onCatInput: function(){ renderCatMenu(); if (_deb) clearTimeout(_deb); _deb = setTimeout(renderRows, 110); },
  renderCatMenu: renderCatMenu,
  qfilter: function(){ if (_deb) clearTimeout(_deb); _deb = setTimeout(renderRows, 110); },
};
})();
