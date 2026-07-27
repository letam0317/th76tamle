/**
 * ============================================================================
 *  hasaki-pc.js — MODULE DÙNG CHUNG "TẠO LỆNH KIỂM KÊ" cho portal Hasaki
 * ============================================================================
 *  Port từ hệ PC của Audit Factory: tick chọn SKU ở pop-up (Kiểm kê + Tồn kho
 *  bất thường) -> giỏ nổi gom xuyên tab -> modal tạo lệnh (CHỈ tải .xlsx, KHÔNG
 *  ghi thẳng WMS) + nút "Kế hoạch chờ push (WMS)" đọc LIVE (chỉ ĐỌC).
 *
 *  KIẾN TRÚC (theo đúng khuôn factory, xem factory-wms-architecture):
 *   - File .xlsx do GAS action `pc_import` dựng (Google OAuth của script — KHÔNG
 *     đụng token WMS, KHÔNG đá phiên ai). Cần PC_KEY (khóa TOFU nhập 1 lần, lưu
 *     localStorage 'pc-key' — DÙNG CHUNG với factory trên cùng máy).
 *   - Mã kho tra từ sheet "Warehouse code" trên SHEET FACTORY (1eY_oo…) — đã có
 *     entry 2 kho Hasaki (SHOP / WH 170 QL1A). Mã BÁO CÁO ≠ mã IMPORT: chỉ tra
 *     từ sheet này, KHÔNG suy từ warehouse_id báo cáo.
 *   - "Kế hoạch chờ push" đọc GET /wms/counting-plans/type-sku bằng token phiên
 *     operator (extension WMS Token Bridge — content script match github.io) —
 *     read-only, không đá ai; không có extension thì báo rõ.
 *
 *  CÔ LẬP: closure kín, chỉ lộ window.HPC. id/class tiền tố hpc-. CSS bơm 1 lần.
 *  API cho 2 module pop-up gọi:
 *    HPC.headCell()                       -> <th> ô chọn-tất-cả
 *    HPC.cell(wh, sku, pn, type, reason)  -> <td> checkbox 1 dòng
 *    HPC.has(wh, sku)                     -> đã trong giỏ? (cho trạng thái checked)
 *    HPC.wire(containerEl, getRowsFn)     -> gắn delegation (tick dòng + chọn-tất-cả)
 *    HPC.syncAll(containerEl, rows)       -> đồng bộ ô chọn-tất-cả sau render
 *    HPC.refreshChecks()                  -> đồng bộ checkbox theo giỏ (không rebuild)
 * ============================================================================
 */
(function(){
"use strict";
if (window.HPC) return;

var APPSCRIPT_URL = "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
var WHCODE_SHEET = "1eY_oo9fAvWCTXp24x-Z0FXq9mp_jJPlTHg09qdemETs";   // sheet factory chứa tab "Warehouse code"
var PC_WMS_BASE = "https://wms-gw.inshasaki.com/api/v1";
var PC_LIMIT = 3000;
var HASAKI_WH = ["SHOP - 170 QUOC LO 1A", "WH - 170 QUOC LO 1A"];   // lọc kế hoạch về đúng kho Hasaki

var PC = { sel: {}, whcode: null, mails: null };
var PL = { rows: [], at: 0, st: "" };
var WMSEXT = { ok: false };
var _pcBusy = false, _pcTok = "", _booted = false;
var _wireMap = [];   // [{el, getRows}] để refreshChecks/syncAll biết vùng nào

/* khôi phục giỏ đã chọn từ phiên trước */
try { PC.sel = JSON.parse(sessionStorage.getItem("hpc-sel") || "{}") || {}; } catch (e) { PC.sel = {}; }

var $id = function(s){ return document.getElementById(s); };
function nf(x){ return (x || 0).toLocaleString("vi-VN"); }
function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
function p2(n){ return (n < 10 ? "0" : "") + n; }
function toast(msg){ try { console.log("[HPC] " + msg); } catch (e) {} }   // portal không có toast riêng -> log; thông báo hiện trong modal

/* ===== CSS ===== */
var CSS = [
/* giỏ nổi */
"#hpcbar{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:1250;display:flex;align-items:center;gap:8px;background:#1f2937;color:#fff;border-radius:999px;padding:8px 10px 8px 16px;box-shadow:0 12px 34px rgba(16,24,40,.34);font-size:13px;animation:hpc-in .22s cubic-bezier(.34,1.56,.64,1);}",   /* pill nổi: nền tối CỐ ĐỊNH mọi theme (không theo surface) */
"#hpcbar.hidden{display:none;}",
"#hpcbar b{color:#fbbf24;font-variant-numeric:tabular-nums;}",
"#hpcbar button{border:0;border-radius:999px;padding:7px 14px;font-size:12.5px;font-weight:650;cursor:pointer;font-family:inherit;min-height:34px;}",
"#hpcbar .go{background:#f59e0b;color:#111827;} #hpcbar .go:hover{background:#fbbf24;}",
"#hpcbar .rm{background:rgba(255,255,255,.14);color:#fff;} #hpcbar .rm:hover{background:rgba(255,255,255,.26);}",
"body.hpcm-open #hpcbar{display:none;}",
/* preview giỏ */
"#hpcprev{position:fixed;left:50%;bottom:62px;transform:translateX(-50%);z-index:1251;width:min(760px,94vw);max-height:60vh;display:flex;flex-direction:column;background:var(--surface,#fff);color:var(--text,#1f2937);border:1px solid var(--border,#e8ecf1);border-radius:14px;box-shadow:0 24px 60px rgba(16,24,40,.32);overflow:hidden;animation:hpc-in .2s cubic-bezier(.34,1.56,.64,1);}",
"#hpcprev.hidden{display:none;}",
"#hpcprev .ph{display:flex;align-items:center;gap:8px;padding:11px 15px;border-bottom:1px solid var(--border,#e8ecf1);font-size:13px;font-weight:650;}",
"#hpcprev .ph b{color:var(--accent,#326e51);} #hpcprev .ph .sp{flex:1;}",
"#hpcprev .pcx{border:0;background:color-mix(in srgb,#ef4444 12%,transparent);color:#ef4444;border-radius:8px;width:26px;height:26px;font-size:17px;line-height:1;cursor:pointer;}",
"#hpcprev .pb{overflow:auto;} #hpcprev table{width:100%;border-collapse:collapse;font-size:12px;}",
"#hpcprev th,#hpcprev td{padding:7px 11px;border-bottom:1px solid var(--border,#f1f4f8);text-align:left;vertical-align:top;}",
"#hpcprev thead th{position:sticky;top:0;background:var(--surface,#fff);color:var(--muted,#6b7280);font-size:10.5px;text-transform:uppercase;letter-spacing:.03em;}",
"#hpcprev .pcrsn{color:var(--muted,#6b7280);font-size:11px;} #hpcprev .pn3{color:var(--muted,#6b7280);max-width:230px;}",
"#hpcprev .hpc-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;vertical-align:middle;}",
/* ô checkbox trong bảng pop-up */
".hpc-cc{width:34px;text-align:center!important;} .hpc-cc input{width:16px;height:16px;cursor:pointer;accent-color:var(--accent,#326e51);}",
/* modal chung (khuôn ht-modal) */
".hpc-modal{display:none;position:fixed;inset:0;background:rgba(17,24,39,.55);backdrop-filter:blur(6px);z-index:1300;align-items:center;justify-content:center;padding:18px;opacity:0;transition:opacity .22s;}",
".hpc-modal.show{opacity:1;}",
".hpc-box{background:var(--surface,#fff);color:var(--text,#1f2937);border-radius:18px;width:min(1180px,96vw);max-height:90vh;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(16,24,40,.3);transform:translateY(12px) scale(.985);opacity:.6;transition:transform .26s,opacity .26s;will-change:transform;}",
".hpc-modal.show .hpc-box{transform:none;opacity:1;}",
".hpc-hd{display:flex;justify-content:space-between;align-items:flex-start;padding:15px 20px;border-bottom:1px solid var(--border,#e8ecf1);gap:10px;}",
".hpc-hd .mt{font-weight:700;font-size:15px;} .hpc-hd .mtsub{font-size:11.5px;color:var(--muted,#9ca3af);margin-top:2px;}",
".hpc-close{background:0;border:0;font-size:24px;line-height:1;cursor:pointer;color:var(--muted,#9ca3af);padding:6px 10px;border-radius:8px;min-width:44px;min-height:40px;}",
".hpc-close:hover{color:#ef4444;background:color-mix(in srgb,#ef4444 12%,transparent);}",
".hpc-filters{display:flex;flex-wrap:wrap;gap:8px;padding:12px 20px;border-bottom:1px solid var(--border,#e8ecf1);}",
".hpc-filters .fld{display:flex;flex-direction:column;gap:3px;flex:1 1 180px;min-width:150px;}",
".hpc-filters label{font-size:10px;font-weight:650;color:var(--muted,#9ca3af);text-transform:uppercase;letter-spacing:.04em;}",
".hpc-filters input{padding:9px 10px;border:1px solid var(--border,#d5dbe4);border-radius:9px;font-size:12.5px;background:var(--surface,#fff);color:var(--text,#1f2937);width:100%;min-height:38px;}",
".hpc-filters input:focus{outline:0;border-color:var(--accent,#326e51);}",
".hpc-combo{position:relative;}",
".hpc-combo-menu{position:absolute;top:calc(100% + 5px);left:0;right:0;z-index:40;background:var(--surface,#fff);border:1px solid var(--border,#e8ecf1);border-radius:11px;box-shadow:0 24px 60px rgba(16,24,40,.28);max-height:280px;overflow-y:auto;padding:5px;opacity:0;visibility:hidden;transform:translateY(-6px);transition:.16s;}",
".hpc-combo-menu.show{opacity:1;visibility:visible;transform:none;}",
".hpc-combo-item{display:flex;justify-content:space-between;gap:10px;padding:9px 11px;border-radius:8px;font-size:12.5px;cursor:pointer;}",
".hpc-combo-item:hover{background:color-mix(in srgb,var(--accent,#326e51) 10%,transparent);color:var(--accent,#326e51);}",
".hpc-combo-item.all{border-bottom:1px solid var(--border,#e8ecf1);font-weight:600;}",
".hpc-combo-item .c{color:var(--muted,#9ca3af);font-size:11px;flex:none;}",
".hpc-combo-head{padding:6px 11px;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted,#9ca3af);}",
".hpc-combo-empty{padding:12px;font-size:12px;color:var(--muted,#9ca3af);text-align:center;}",
".hpc-combo.open .hpc-combo-menu{opacity:1;visibility:visible;transform:none;}",
".hpc-sum{padding:8px 20px;font-size:12px;color:var(--muted,#6b7280);border-bottom:1px solid var(--border,#e8ecf1);font-variant-numeric:tabular-nums;}",
".hpc-body{overflow:auto;padding:0 20px;}",
".hpc-tbl{border-collapse:collapse;font-size:12px;min-width:900px;}",   /* bỏ width:100% -> cột theo nội dung, .hpc-body cuộn ngang, hết cảnh chữ đè lên nhau */
".hpc-tbl thead th{position:sticky;top:0;background:var(--accent,#326e51);color:var(--accent-text,#fff);padding:9px 11px;text-align:left;font-size:11px;font-weight:600;white-space:nowrap;z-index:1;}",
".hpc-tbl td{padding:7px 10px;border-bottom:1px solid var(--border,#f1f4f8);vertical-align:top;white-space:nowrap;}",   /* mặc định nowrap; 2 cột dài override bên dưới */
".hpc-tbl .num{text-align:right;font-variant-numeric:tabular-nums;}",
".hpc-tbl .pn{color:var(--muted,#6b7280);white-space:normal;word-break:break-word;max-width:240px;min-width:150px;}",
".hpc-tbl .rsn{color:var(--muted,#6b7280);white-space:normal;word-break:break-word;max-width:230px;min-width:150px;font-size:11px;line-height:1.4;}",
".hpc-tbl .hpc-x{width:40px;min-width:40px;text-align:center;padding-left:4px;padding-right:4px;}",   /* cột nút × ghim bề rộng -> không hút khoảng dư, không trôi lệch ô */
".hpc-tbl .whn{color:var(--accent,#326e51);font-weight:650;} .hpc-tbl .codebad{color:#ef4444;font-weight:650;}",
".hpc-tbl .empty{text-align:center;color:var(--muted,#9ca3af);padding:26px;}",
".hpc-tbl .pcx{border:0;background:color-mix(in srgb,#ef4444 12%,transparent);color:#ef4444;border-radius:7px;width:24px;height:24px;font-size:16px;cursor:pointer;}",
".hpc-warn{margin:10px 20px 0;padding:10px 13px;border-radius:10px;font-size:12px;line-height:1.5;display:none;background:color-mix(in srgb,#f59e0b 14%,transparent);color:#92400e;}",
".hpc-warn.show{display:block;} .hpc-warn.bad{background:color-mix(in srgb,#ef4444 13%,transparent);color:#b91c1c;} .hpc-warn.ok{background:color-mix(in srgb,#10b981 14%,transparent);color:#047857;}",
".hpc-steps{margin:10px 20px 0;font-size:12px;color:var(--text,#374151);line-height:1.6;}",
".hpc-steps a{color:var(--accent,#326e51);font-weight:600;}",
".hpc-foot{display:flex;align-items:center;gap:10px;padding:14px 20px;border-top:1px solid var(--border,#e8ecf1);flex-wrap:wrap;}",
".hpc-foot .sp{flex:1;} .hpc-foot .hint{font-size:11.5px;color:var(--muted,#9ca3af);}",
".hpc-btn{border:1px solid var(--border,#d5dbe4);background:var(--surface,#fff);color:var(--text,#1f2937);border-radius:9px;padding:9px 16px;font-size:12.5px;font-weight:650;cursor:pointer;font-family:inherit;min-height:38px;}",
".hpc-btn.primary{background:var(--accent,#326e51);border-color:var(--accent,#326e51);color:var(--accent-text,#fff);}",
".hpc-btn:disabled{opacity:.5;cursor:not-allowed;}",
".hpc-chip{display:inline-flex;align-items:center;gap:6px;border:0;border-radius:999px;padding:4px 11px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit;background:color-mix(in srgb,var(--muted,#9ca3af) 18%,transparent);color:var(--text,#374151);}",
".hpc-chip.on{background:var(--accent,#326e51);color:var(--accent-text,#fff);}",
".hpc-spin{width:26px;height:26px;border:3px solid var(--border,#d5dbe4);border-top-color:var(--accent,#326e51);border-radius:50%;margin:8px auto;animation:hpc-sp .8s linear infinite;}",
"@keyframes hpc-in{from{opacity:0;transform:translate3d(-50%,8px,0) scale(.98)}to{opacity:1;transform:translate3d(-50%,0,0)}}",   /* giữ phép định tâm -50% trong keyframes — tránh lỗi lệch phải rồi nhảy vào giữa */
"@keyframes hpc-sp{to{transform:rotate(360deg)}}",
"@media(max-width:768px){.hpc-modal{padding:0;}.hpc-box{width:100vw!important;height:100vh;max-height:100vh!important;border-radius:0;}#hpcbar{width:calc(100vw - 24px);justify-content:center;}#hpcprev{width:calc(100vw - 16px);}}"
].join("\n");

/* ===== HTML (giỏ + preview + 2 modal), gắn vào body 1 lần ===== */
var HTML =
'<div id="hpcbar" class="hidden"><span>Đã chọn <b id="hpcbarN">0</b> SKU</span>' +
'  <button class="rm" onclick="HPC.previewToggle()" title="Xem lại SKU đã chọn + lý do">Xem</button>' +
'  <button class="go" onclick="HPC.open()">Tạo lệnh kiểm kê</button>' +
'  <button class="rm" onclick="HPC.clear()" title="Bỏ chọn tất cả">Xoá</button></div>' +
'<div id="hpcprev" class="hidden"><div class="ph">Đã chọn <b id="hpcprevN">0</b> SKU — xem lại trước khi tạo lệnh<span class="sp"></span>' +
'  <button class="pcx" onclick="HPC.previewToggle(false)" title="Đóng">&times;</button></div>' +
'  <div class="pb"><table><thead><tr><th>Kho</th><th>SKU</th><th>Tên sản phẩm</th><th>Lý do chọn</th><th></th></tr></thead><tbody id="hpcprevB"></tbody></table></div></div>' +
/* modal tạo lệnh */
'<div id="hpcmodal" class="hpc-modal">' +
'  <div class="hpc-box">' +
'    <div class="hpc-hd"><div><div class="mt">Tạo lệnh kiểm kê WMS <span style="font-weight:400;color:var(--muted,#9ca3af);font-size:11.5px">(template CHECKLIST_SKU · mỗi SKU 1 dòng)</span></div><div class="mtsub" id="hpcSub"></div></div>' +
'      <button class="hpc-close" onclick="HPC.closeModal()">&times;</button></div>' +
'    <div class="hpc-filters" id="hpcFilters">' +
'      <div class="fld"><label>Kho kiểm</label><div class="hpc-combo"><input id="hpcWh" autocomplete="off" placeholder="Tất cả kho nguồn…" oninput="HPC.whInput(this)" onfocus="HPC.whMenu()"><div class="hpc-combo-menu" id="hpcWhMenu"></div></div></div>' +
'      <div class="fld"><label>Plan date</label><input type="date" id="hpcDate" onchange="HPC.render()"></div>' +
'      <div class="fld"><label>Executed By</label><div class="hpc-combo"><input id="hpcBy" autocomplete="off" placeholder="— Để trống —" oninput="HPC.byInput(this)" onfocus="HPC.byMenu()"><div class="hpc-combo-menu" id="hpcByMenu"></div></div></div>' +
'    </div>' +
'    <div class="hpc-warn" id="hpcWarn"></div>' +
'    <div class="hpc-sum" id="hpcSum"></div>' +
'    <div class="hpc-body"><table class="hpc-tbl"><thead><tr><th>Warehouse Code</th><th class="num">Type</th><th>Sku</th><th class="pn">Tên sản phẩm</th><th>Kho nguồn</th><th>Lý do chọn</th><th>Plan Date</th><th>Executed By</th><th class="hpc-x"></th></tr></thead><tbody id="hpcTBody"></tbody></table></div>' +
'    <div class="hpc-steps" id="hpcSteps"><b>Cách tạo lệnh (ghi đúng tên bạn):</b> ① Bấm <b>Tải file .xlsx</b> → ② vào <a href="https://wms.inshasaki.com/physical-count/request/import/sku" target="_blank" rel="noopener">trang Import SKU của WMS ↗</a> (đang đăng nhập bằng tài khoản của bạn) → ③ thả file vừa tải vào. Lệnh sẽ mang tên <b>chính bạn</b>.</div>' +
'    <div class="hpc-foot"><span class="hint" id="hpcStatus"></span><span class="sp"></span>' +
'      <button class="hpc-chip" onclick="HPC.planOpen()" title="Lệnh kiểm kê tạo từ dashboard nằm ở \'sổ kế hoạch\' WMS trước khi thành phiếu — Pending = chờ push · Processing = đã push · đọc trực tiếp từ WMS">Kế hoạch chờ push (WMS)</button>' +
'      <button class="hpc-btn primary" id="hpcBtnFile" onclick="HPC.submit()" title="Dựng file template chuẩn để bạn tự import trong WMS">Tải file .xlsx</button></div>' +
'  </div>' +
'</div>' +
/* modal kế hoạch chờ push */
'<div id="hplmodal" class="hpc-modal">' +
'  <div class="hpc-box">' +
'    <div class="hpc-hd"><div><div class="mt">Kế hoạch kiểm kê trên WMS <span style="font-weight:400;color:var(--muted,#9ca3af);font-size:11.5px">(counting plan · type SKU · 2 kho Hasaki)</span></div><div class="mtsub">Pending = chờ WMS push thành phiếu · Processing = đã push · đọc trực tiếp từ WMS</div></div>' +
'      <button class="hpc-close" onclick="HPC.planClose()">&times;</button></div>' +
'    <div class="hpc-filters"><div class="fld" style="flex:1 1 100%"><label>Tìm nhanh</label><input id="hplQ" autocomplete="off" placeholder="SKU / tên / kho / người push / ngày…" oninput="HPC.planRender()"></div>' +
'      <div class="fld" style="flex:0 0 auto;justify-content:flex-end"><label>&nbsp;</label><button class="hpc-chip" onclick="HPC.planLoad()">⟳ Làm mới từ WMS</button></div></div>' +
'    <div class="hpc-sum" id="hplSum"></div>' +
'    <div class="hpc-body"><table class="hpc-tbl"><thead><tr><th>SKU</th><th class="pn">Tên sản phẩm</th><th>Kho</th><th>Plan date</th><th>Trạng thái</th><th>Người push</th><th>Lúc push</th></tr></thead><tbody id="hplBody"></tbody></table></div>' +
'  </div>' +
'</div>';

/* ===== GIỎ CHỌN ===== */
function key(w, s){ return w + "|" + s; }
function has(w, s){ return !!PC.sel[key(w, s)]; }
function count(){ return Object.keys(PC.sel).length; }
function save(){ try { sessionStorage.setItem("hpc-sel", JSON.stringify(PC.sel)); } catch (e) {} }
function rows(){ return Object.keys(PC.sel).sort().map(function(k){ return PC.sel[k]; }); }
function put(w, s, pn, t, src){
  var k = key(w, s), old = PC.sel[k], moi = !old, nsrc = String(src || "");
  if (old && old.src) nsrc = (nsrc && old.src.indexOf(nsrc) < 0) ? (old.src + " + " + nsrc) : old.src;
  if (nsrc.length > 150) nsrc = nsrc.slice(0, 147) + "…";
  PC.sel[k] = { wh: w, sku: s, pn: pn || (old && old.pn) || "", t: (Number(t) || 0) || (old && old.t) || 0, src: nsrc };
  return moi;
}
function add(w, s, pn, t, src){
  if (!w || !s) return;
  if (!has(w, s) && count() >= PC_LIMIT) return;
  put(w, s, pn, t, src); save(); syncBar();
}
function del(w, s){ delete PC.sel[key(w, s)]; save(); syncBar(); }
function clear(){ PC.sel = {}; save(); syncBar(); refreshChecks(); if ($id("hpcmodal").classList.contains("show")) render(); }
function bulk(items, on){
  if (on){ var room = PC_LIMIT - count();
    items.forEach(function(r){ if (!PC.sel[key(r.wh, r.sku)] && room <= 0) return; if (put(r.wh, r.sku, r.pn, r.t, r.src)) room--; });
  } else items.forEach(function(r){ delete PC.sel[key(r.wh, r.sku)]; });
  save(); syncBar(); refreshChecks();
}
function syncBar(){
  var n = count();
  if ($id("hpcbarN")) $id("hpcbarN").textContent = nf(n);
  if ($id("hpcbar")) $id("hpcbar").classList.toggle("hidden", !n);
  var p = $id("hpcprev");
  if (p && !p.classList.contains("hidden")){ if (!n) p.classList.add("hidden"); else previewRender(); }
}
function refreshChecks(){
  document.querySelectorAll(".hpc-r").forEach(function(c){ c.checked = has(c.getAttribute("data-w"), c.getAttribute("data-s")); });
  if (!count()) document.querySelectorAll(".hpc-all").forEach(function(a){ a.checked = false; });
}
function syncAll(container, rs){
  var all = container && container.querySelector(".hpc-all"); if (!all) return;
  var r2 = (rs || []).filter(function(r){ return r.sku; });
  all.checked = r2.length > 0 && r2.every(function(r){ return has(r.wh, r.sku); });
}

/* ===== Ô CHECKBOX + WIRE ===== */
function headCell(){ return '<th class="hpc-cc"><input type="checkbox" class="hpc-all" title="Chọn/bỏ chọn tất cả dòng đang lọc (kể cả ngoài số dòng hiển thị)"></th>'; }
function cell(w, s, pn, t, src){
  return '<td class="hpc-cc"><input type="checkbox" class="hpc-r" data-w="' + esc(w) + '" data-s="' + esc(s) + '" data-p="' + esc(pn || "") + '" data-t="' + (t || 0) + '" data-r="' + esc(src || "") + '"' + (has(w, s) ? " checked" : "") + "></td>";
}
function wire(container, getRows){
  if (!container) return;
  _wireMap.push({ el: container, getRows: getRows });
  container.addEventListener("change", function(e){
    var t = e.target; if (!t || !t.classList) return;
    if (t.classList.contains("hpc-r")){
      if (t.checked) add(t.getAttribute("data-w"), t.getAttribute("data-s"), t.getAttribute("data-p"), t.getAttribute("data-t"), t.getAttribute("data-r"));
      else del(t.getAttribute("data-w"), t.getAttribute("data-s"));
    } else if (t.classList.contains("hpc-all")){
      bulk((getRows && getRows()) || [], t.checked);
    }
  });
}

/* ===== PREVIEW GIỎ ===== */
function previewToggle(force){
  var p = $id("hpcprev");
  var show = (force != null) ? force : p.classList.contains("hidden");
  if (show && !count()) return;
  p.classList.toggle("hidden", !show);
  if (show) previewRender();
}
function previewRender(){
  var rs = rows();
  $id("hpcprevN").textContent = nf(rs.length);
  $id("hpcprevB").innerHTML = rs.map(function(r){
    return "<tr><td style=\"white-space:nowrap\">" + esc(r.wh) + "</td><td><b>" + esc(r.sku) + '</b></td><td class="pn3">' + esc(r.pn) + '</td><td class="pcrsn">' + esc(r.src || "—") + '</td><td><button class="pcx" data-w="' + esc(r.wh) + '" data-s="' + esc(r.sku) + '" title="Bỏ SKU này">&times;</button></td></tr>';
  }).join("") || '<tr><td colspan="5" style="text-align:center;color:var(--muted,#9ca3af);padding:16px">Giỏ trống</td></tr>';
}

/* ===== DANH MỤC MÃ KHO (sheet "Warehouse code" trên sheet factory) ===== */
function gvizWhcode(){
  return new Promise(function(res){
    var cb = "hpcwhgv";
    window[cb] = function(resp){ res(resp); };
    var old = $id("hpc_sc_wh"); if (old) old.remove();
    var s = document.createElement("script"); s.id = "hpc_sc_wh";
    s.src = "https://docs.google.com/spreadsheets/d/" + WHCODE_SHEET + "/gviz/tq?tqx=out:json;responseHandler:" + cb + "&sheet=" + encodeURIComponent("Warehouse code") + "&headers=1";
    s.onerror = function(){ res(null); };
    document.body.appendChild(s);
  });
}
function fetchWhcode(){
  if (PC.whcode) return Promise.resolve(PC.whcode);
  return gvizWhcode().then(function(resp){
    var list = [];
    try {
      var H = ((resp.table && resp.table.cols) || []).map(function(c){ return String((c && c.label) || "").replace(/\s+/g, " ").trim().toLowerCase(); });
      var ic = H.indexOf("warehouse code"), inm = H.indexOf("warehouse name"), it = H.indexOf("type"), icy = H.indexOf("city name");
      if (ic < 0 || inm < 0) throw 0;
      ((resp.table && resp.table.rows) || []).forEach(function(r){
        var c = r.c || []; function gv(i){ return (i >= 0 && c[i] && c[i].v != null) ? String(c[i].v).trim() : ""; }
        var code = gv(ic), name = gv(inm); if (!code || !name) return;
        list.push({ code: code, name: name, type: gv(it), city: gv(icy) });
      });
    } catch (e) { list = []; }
    PC.whcode = list; return list;
  });
}
function norm(s){ return String(s || "").toUpperCase().replace(/\s+/g, " ").trim(); }
function codeByName(name){
  var n = norm(name), L = PC.whcode || [];
  for (var i = 0; i < L.length; i++) if (norm(L[i].name) === n) return L[i].code;
  return "";
}
/* Executed By: email từ module Kiểm kê Hasaki nếu đã nạp (window.HKIEMKE) */
function loadMails(){
  var cnt = {};
  try {
    var S = window.HKIEMKE && window.HKIEMKE._data && window.HKIEMKE._data();
    ["sku", "loc"].forEach(function(k){ (S && S[k] || []).forEach(function(r){ var b = String(r.by || "").trim(); if (b) cnt[b] = (cnt[b] || 0) + 1; }); });
  } catch (e) {}
  return Object.keys(cnt).sort(function(a, b){ return cnt[b] - cnt[a]; }).map(function(m){ return { mail: m, n: cnt[m] }; });
}

/* ===== MODAL TẠO LỆNH ===== */
function whPick(){ return $id("hpcWh").getAttribute("data-wh") || ""; }
function whManual(){ var inp = $id("hpcWh"); if (inp.getAttribute("data-wh")) return ""; var v = inp.value.trim(); return /^\d{2,}$/.test(v) ? v : ""; }
function open(){
  if (!count()) return;
  $id("hpcprev").classList.add("hidden");
  document.body.classList.add("hpcm-open");
  var m = $id("hpcmodal"); m.style.display = "flex";
  requestAnimationFrame(function(){ m.classList.add("show"); });
  var d = $id("hpcDate");
  if (!d.value){ var t = new Date(); t.setDate(t.getDate() + 1); d.value = t.getFullYear() + "-" + p2(t.getMonth() + 1) + "-" + p2(t.getDate()); }
  render();
  fetchWhcode().then(function(){ render(); });
  PC.mails = loadMails();
}
function closeModal(){ document.body.classList.remove("hpcm-open"); closeCombos(); var m = $id("hpcmodal"); m.classList.remove("show"); setTimeout(function(){ m.style.display = "none"; }, 240); }
function whInput(inp){ inp.removeAttribute("data-wh"); whMenu(); render(); }
function whMenu(){
  var menu = $id("hpcWhMenu"), inp = $id("hpcWh");
  var typed = inp.getAttribute("data-wh") ? "" : inp.value.trim().toLowerCase();
  var hit = function(s){ return !typed || String(s).toLowerCase().indexOf(typed) >= 0; };
  var rs = rows(), byWh = {}; rs.forEach(function(r){ byWh[r.wh] = (byWh[r.wh] || 0) + 1; });
  var html = '<div class="hpc-combo-item all" data-v=""><span class="nm">— Tất cả kho nguồn (mỗi SKU theo kho phát sinh) —</span><span class="c">' + nf(rs.length) + " dòng</span></div>";
  var out1 = [];
  Object.keys(byWh).sort(function(a, b){ return byWh[b] - byWh[a]; }).forEach(function(w){
    var code = codeByName(w); if (!hit(w) && !hit(code)) return;
    out1.push(code
      ? '<div class="hpc-combo-item" data-wh="' + esc(w) + '" data-lb="' + esc(code + " · " + w) + '"><span class="nm">' + esc(code) + " · " + esc(w) + '</span><span class="c">' + nf(byWh[w]) + " SKU</span></div>"
      : '<div class="hpc-combo-item" data-wh="' + esc(w) + '" data-lb="' + esc(w) + '"><span class="nm">' + esc(w) + ' — <b>chưa có mã</b></span><span class="c">' + nf(byWh[w]) + " SKU</span></div>");
  });
  if (out1.length) html += '<div class="hpc-combo-head">Kho nguồn của SKU đã chọn</div>' + out1.join("");
  else html += '<div class="hpc-combo-empty">Không khớp</div>';
  menu.innerHTML = html; closeCombos(menu.parentNode); menu.classList.add("show");
}
function byInput(inp){ byMenu(); render(); }
function byMenu(){
  var menu = $id("hpcByMenu"), inp = $id("hpcBy"), typed = inp.value.trim().toLowerCase();
  var html = '<div class="hpc-combo-item all" data-v=""><span class="nm">— Để trống —</span><span class="c">WMS tự phân công</span></div>';
  (PC.mails || []).forEach(function(e2){ if (typed && e2.mail.toLowerCase().indexOf(typed) < 0) return;
    html += '<div class="hpc-combo-item" data-v="' + esc(e2.mail) + '" data-lb="' + esc(e2.mail) + '"><span class="nm">' + esc(e2.mail) + '</span><span class="c">' + nf(e2.n) + " phiếu</span></div>";
  });
  if (!(PC.mails || []).length) html += '<div class="hpc-combo-empty">Chưa có lịch sử — gõ trực tiếp email</div>';
  menu.innerHTML = html; closeCombos(menu.parentNode); menu.classList.add("show");
}
function closeCombos(except){ document.querySelectorAll("#hpcFilters .hpc-combo-menu.show").forEach(function(m){ if (!except || m.parentNode !== except) m.classList.remove("show"); }); }
function render(){
  var rs = rows(), pick = whPick(), manual = whManual(), plan = $id("hpcDate").value, by = $id("hpcBy").value.trim();
  var out = [], miss = 0, whs = {}, excl = 0, inc = 0;
  rs.forEach(function(r){
    if (pick && r.wh !== pick){ excl++; return; }
    inc++;
    var code = codeByName(r.wh) || manual, ty = String(r.t || 1);
    if (!code) miss++; else whs[code] = 1;
    out.push("<tr><td class=\"" + (code ? "whn" : "codebad") + "\">" + (code ? esc(code) : "✗ chưa có mã") + '</td><td class="num">' + esc(ty) + "</td><td><b>" + esc(r.sku) + '</b></td><td class="pn">' + esc(r.pn) + "</td><td>" + esc(r.wh) + '</td><td class="rsn">' + esc(r.src || "—") + "</td><td>" + esc(plan || "—") + "</td><td>" + (by ? esc(by) : '<span style="color:var(--muted,#9ca3af)">(trống)</span>') + '</td><td class="hpc-x"><button class="pcx" data-w="' + esc(r.wh) + '" data-s="' + esc(r.sku) + '" title="Bỏ SKU">&times;</button></td></tr>');
  });
  $id("hpcTBody").innerHTML = out.join("") || '<tr><td colspan="9" class="empty">' + (rs.length ? ("Giỏ không có SKU nào phát sinh tại kho “" + esc(pick) + "”.") : "Giỏ trống — tick chọn SKU từ pop-up Kiểm kê / Tồn kho bất thường.") + "</td></tr>";
  $id("hpcSub").textContent = nf(rs.length) + " SKU đã chọn · lệnh tạo theo KHO NGUỒN · mỗi SKU 1 dòng";
  $id("hpcSum").textContent = nf(inc) + " dòng vào lệnh · " + nf(Object.keys(whs).length) + " mã kho" + (miss ? (" · " + nf(miss) + " dòng CHƯA có mã kho") : "") + (excl ? (" · " + nf(excl) + " SKU kho khác chờ lệnh sau") : "");
  var w = $id("hpcWarn"); w.className = "hpc-warn"; w.textContent = "";
  if (inc && !(PC.whcode && PC.whcode.length) && !manual){ w.className = "hpc-warn show"; w.textContent = "Chưa tải được danh mục mã kho (sheet Warehouse code) — thử lại, hoặc gõ MÃ SỐ kho vào ô Kho kiểm."; }
  else if (miss){ w.className = "hpc-warn bad show"; w.textContent = nf(miss) + " dòng chưa tra được mã kho (tên kho chưa có trong sheet Warehouse code) — gõ MÃ SỐ kho vào ô Kho kiểm để điền."; }
  $id("hpcBtnFile").disabled = !inc || !plan || miss > 0;
}

/* ===== GỬI GAS DỰNG .xlsx (pc_import dryRun) — KHÔNG đụng token WMS ===== */
function pcGas(body){ return fetch(APPSCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) }).then(function(r){ return r.json(); }); }
function keyGet(){
  var k = ""; try { k = localStorage.getItem("pc-key") || ""; } catch (e) {}
  if (!k){ k = (prompt("Nhập khóa tạo lệnh kiểm kê (PC_KEY — do quản trị cấp).\nDán NGUYÊN VĂN, không thừa khoảng trắng:") || "").trim(); if (k){ try { localStorage.setItem("pc-key", k); } catch (e) {} } }
  return k;
}
function keyForget(){ try { localStorage.removeItem("pc-key"); } catch (e) {} }
function downloadB64(b64, name){
  var bin = atob(b64 || ""), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  var a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([u], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  a.download = name; document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 800);
}
function submit(){
  if (_pcBusy) return;
  var rs = rows(), pick = whPick(), manual = whManual(), plan = $id("hpcDate").value, by = $id("hpcBy").value.trim(), list = [], miss = 0, used = [];
  rs.forEach(function(r){ if (pick && r.wh !== pick) return; var code = codeByName(r.wh) || manual; if (!code){ miss++; return; } list.push({ code: code, type: String(r.t || 1), sku: r.sku, plan: plan, by: by }); used.push(key(r.wh, r.sku)); });
  if (!list.length || miss || !plan){ render(); return; }
  var khoa = keyGet(); if (!khoa){ setWarn("bad", "Cần khóa PC_KEY để dựng file lệnh."); return; }
  _pcBusy = true; $id("hpcBtnFile").disabled = true;
  var st = $id("hpcStatus");
  function done(cls, html, tt){ setWarn(cls, html); st.textContent = tt || ""; _pcBusy = false; render(); }
  st.textContent = "Đang dựng file template…";
  pcGas({ action: "pc_import", dryRun: true, key: khoa, rows: list }).then(function(jf){
    if (!jf || jf.status !== "file"){ if (jf && jf.code === 403) keyForget(); return done("bad", "Lỗi dựng file (" + esc((jf && jf.stage) || "?") + "): " + esc((jf && jf.message) || "không rõ") + ((jf && jf.code === 403) ? " — khóa đã xoá, bấm lại để nhập." : ""), "Thất bại"); }
    var ten = jf.fileName || "WMS_INVENTORY_KEY_TEMPLATE_CP_CHECKLIST_SKU.xlsx";
    downloadB64(jf.fileB64, ten);
    used.forEach(function(k){ delete PC.sel[k]; }); save(); syncBar(); refreshChecks();
    var conlai = count();
    done("ok", "✓ Đã tải <b>" + esc(ten) + "</b> (" + nf(list.length) + " dòng). Mở <a href=\"https://wms.inshasaki.com/physical-count/request/import/sku\" target=\"_blank\" rel=\"noopener\">trang Import SKU của WMS ↗</a> (đăng nhập bằng tài khoản bạn) và thả file vào — lệnh ghi tên <b>chính bạn</b>." + (conlai ? ("<br>Giỏ còn " + nf(conlai) + " SKU kho khác — chọn kho nguồn tiếp để xuất file tiếp.") : ""), "Đã tải file");
  }).catch(function(e){ done("bad", "Không gọi được máy chủ dựng file (" + esc(String(e && e.message || e)) + ").", "Thất bại"); });
}
function setWarn(cls, html){ var w = $id("hpcWarn"); w.className = "hpc-warn " + (cls || "") + " show"; w.innerHTML = html; }

/* ===== EXTENSION TOKEN (đọc kế hoạch) ===== */
window.addEventListener("message", function(e){
  if (e.source !== window || !e.data) return;
  if (e.data.__wmsbridge === "hello") WMSEXT.ok = true;
});
function extToken(){
  return new Promise(function(res){
    if (!WMSEXT.ok){ res(""); return; }
    var done = false;
    function on(e){ if (e.source !== window || !e.data || e.data.__wmsbridge !== "resp") return; done = true; window.removeEventListener("message", on); res(e.data.token || ""); }
    window.addEventListener("message", on);
    window.postMessage({ __wmsbridge: "req" }, "*");
    setTimeout(function(){ if (!done){ window.removeEventListener("message", on); res(""); } }, 1500);
  });
}
function wmsTokenViaKey(khoa){
  if (_pcTok) return Promise.resolve(_pcTok);
  return pcGas({ action: "pc_token", key: khoa }).then(function(j){ if (j.status !== "success" || !j.token) throw { pc: 1, j: j }; _pcTok = j.token; return _pcTok; });
}

/* ===== KẾ HOẠCH CHỜ PUSH (đọc live, read-only) ===== */
function planOpen(){ var m = $id("hplmodal"); m.style.display = "flex"; requestAnimationFrame(function(){ m.classList.add("show"); }); if (PL.rows.length && Date.now() - PL.at < 120000){ planRender(); return; } planLoad(); }
function planClose(){ var m = $id("hplmodal"); m.classList.remove("show"); setTimeout(function(){ m.style.display = "none"; }, 240); }
function planLoad(){
  var body = $id("hplBody");
  body.innerHTML = '<tr><td colspan="7" class="empty"><div class="hpc-spin"></div>Đang tải sổ kế hoạch từ WMS…</td></tr>';
  $id("hplSum").textContent = "";
  (async function(){
    try {
      var tok = await extToken();
      if (!tok){ var khoa = keyGet(); if (!khoa){ body.innerHTML = '<tr><td colspan="7" class="empty">Cần extension WMS Token Bridge (mở 1 tab WMS đang đăng nhập), hoặc khóa PC_KEY để đọc.</td></tr>'; return; } try { tok = await wmsTokenViaKey(khoa); } catch (e){ body.innerHTML = '<tr><td colspan="7" class="empty">Không lấy được token: ' + esc((e.j && e.j.message) || "") + "</td></tr>"; return; } }
      var all = [], SIZE = 200, MAXP = 5;
      for (var page = 1; page <= MAXP; page++){
        var r = await fetch(PC_WMS_BASE + "/wms/counting-plans/type-sku?page=" + page + "&size=" + SIZE, { headers: { Authorization: "Bearer " + tok } });
        if (r.status === 401){ _pcTok = ""; throw new Error("Token WMS đang bị chiếm phiên — mở lại WMS rồi thử lại."); }
        if (!r.ok) throw new Error("WMS trả HTTP " + r.status);
        var j = await r.json(), d = j.data || j, recs = d.records || [];
        all = all.concat(recs); if (recs.length < SIZE) break;
      }
      PL.rows = all; PL.at = Date.now(); planRender();
    } catch (e){ body.innerHTML = '<tr><td colspan="7" class="empty">' + esc(String(e && e.message || e)) + "</td></tr>"; }
  })();
}
function plField(x, keys){ for (var i = 0; i < keys.length; i++){ if (x[keys[i]] != null && x[keys[i]] !== "") return x[keys[i]]; } return ""; }
function planRender(){
  var q = (($id("hplQ") || {}).value || "").trim().toLowerCase();
  var out = [], shown = 0;
  var list = PL.rows.filter(function(x){
    var wh = String(plField(x, ["warehouse_name", "warehouseName", "warehouse"]) || "");
    // chỉ giữ kế hoạch của 2 kho Hasaki (nếu có trường kho); không có trường -> giữ
    if (wh && !HASAKI_WH.some(function(w){ return norm(wh).indexOf(norm(w)) >= 0 || norm(w).indexOf(norm(wh)) >= 0; })) return false;
    return true;
  });
  list.forEach(function(x){
    var sku = plField(x, ["plan_object_code", "sku", "product_code"]), pn = plField(x, ["product_name", "productName"]);
    var wh = plField(x, ["warehouse_name", "warehouseName", "warehouse"]), plan = plField(x, ["plan_date", "planDate"]);
    var stt = plField(x, ["status_name", "statusName", "status"]), who = plField(x, ["created_by_name", "createdByName", "created_by"]), at = plField(x, ["created_at", "createdAt", "updated_at"]);
    var hay = (sku + " " + pn + " " + wh + " " + who + " " + plan + " " + stt).toLowerCase();
    if (q && hay.indexOf(q) < 0) return;
    shown++;
    if (out.length < 500) out.push("<tr><td><b>" + esc(sku) + '</b></td><td class="pn">' + esc(pn) + "</td><td>" + esc(wh) + "</td><td>" + esc(String(plan).slice(0, 10)) + "</td><td>" + esc(stt) + "</td><td>" + esc(who) + "</td><td>" + esc(String(at).slice(0, 16).replace("T", " ")) + "</td></tr>");
  });
  $id("hplBody").innerHTML = out.join("") || '<tr><td colspan="7" class="empty">Không có kế hoạch phù hợp (2 kho Hasaki).</td></tr>';
  $id("hplSum").textContent = nf(shown) + " kế hoạch" + (PL.rows.length ? (" · đọc " + nf(PL.rows.length) + " bản ghi mới nhất từ WMS") : "");
}

/* ===== INIT ===== */
function init(){
  if (_booted) return; _booted = true;
  var style = document.createElement("style"); style.id = "hpc-css"; style.textContent = CSS; document.head.appendChild(style);
  var wrap = document.createElement("div"); wrap.innerHTML = HTML; while (wrap.firstChild) document.body.appendChild(wrap.firstChild);
  // combo tạo lệnh (delegation 1 lần)
  $id("hpcFilters").addEventListener("click", function(e){
    var it = e.target.closest(".hpc-combo-item"); if (!it) return;
    var inp = it.closest(".hpc-combo").querySelector("input");
    inp.value = it.getAttribute("data-lb") || it.getAttribute("data-v") || "";
    if (inp.id === "hpcWh"){ var wv = it.getAttribute("data-wh"); if (wv) inp.setAttribute("data-wh", wv); else inp.removeAttribute("data-wh"); }
    closeCombos(); render();
  });
  document.addEventListener("click", function(e){ if (!e.target.closest("#hpcFilters .hpc-combo")) closeCombos(); });
  // bỏ dòng trong modal tạo lệnh + preview
  $id("hpcTBody").addEventListener("click", function(e){ var b = e.target.closest(".pcx"); if (!b) return; del(b.getAttribute("data-w"), b.getAttribute("data-s")); refreshChecks(); render(); });
  $id("hpcprevB").addEventListener("click", function(e){ var b = e.target.closest(".pcx"); if (!b) return; del(b.getAttribute("data-w"), b.getAttribute("data-s")); refreshChecks(); previewRender(); });
  // click ra ngoài -> đóng preview
  document.addEventListener("click", function(e){ var p = $id("hpcprev"); if (p && !p.classList.contains("hidden") && !e.target.closest("#hpcprev") && !e.target.closest("#hpcbar")) p.classList.add("hidden"); });
  $id("hpcmodal").addEventListener("click", function(e){ if (e.target === this) closeModal(); });
  $id("hplmodal").addEventListener("click", function(e){ if (e.target === this) planClose(); });
  syncBar();
  // báo extension có mặt (nếu content script chưa gửi 'hello' trước init)
  try { window.postMessage({ __wmsbridge: "req" }, "*"); } catch (e) {}
}

window.HPC = {
  init: init, headCell: headCell, cell: cell, has: has, wire: wire, syncAll: syncAll, refreshChecks: refreshChecks,
  open: open, closeModal: closeModal, clear: clear, render: render,
  whInput: whInput, whMenu: whMenu, byInput: byInput, byMenu: byMenu, submit: submit,
  previewToggle: previewToggle, planOpen: planOpen, planClose: planClose, planLoad: planLoad, planRender: planRender
};
})();
