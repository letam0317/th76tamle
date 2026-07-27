/**
 * ============================================================================
 *  hasaki-tonbatthuong.js — MODULE "TỒN KHO BẤT THƯỜNG" của công ty HASAKI
 * ============================================================================
 *  Bê nguyên thiết kế tab 3 dashboard factory (stock-inventory-beta) sang portal
 *  kiemsoatkho cho công ty Hasaki Vietnam — TRƯỚC MẮT chỉ 2 kho:
 *  SHOP - 170 QUOC LO 1A · WH - 170 QUOC LO 1A (bộ sync-tonbatthuong.js ghi
 *  tab "stock-inventory-hasaki" trên Google Sheet 5S, cụm 7h mỗi ngày).
 *
 *  Chỉ tính SKU có Product Type = Normal và có ÍT NHẤT 1 loại > 0:
 *  Conflict · UID Temp · Not Found · Unsuitable product · Committed · Committed Outbound.
 *
 *  CÔ LẬP (scoping) — theo đúng khuôn factory-stock.js:
 *   - Closure kín, CHỈ lộ window.HTONBAT (API cho inline onclick).
 *   - id/class DOM tiền tố ht- ; CSS bơm 1 lần, neo dưới #pane-htonbat và .ht-modal.
 *   - Màu dùng CSS variables của portal (--panel/--text/--muted/--line/--accent)
 *     -> tự ăn theo các theme sáng/tối sẵn có.
 *
 *  LAZY: host chỉ inject khi người dùng đứng ở HASAKI ▸ Tồn kho bất thường.
 *  API: HTONBAT.init(paneEl) — idempotent; gọi lại chỉ refresh nếu dữ liệu cũ >5'.
 * ============================================================================
 */
(function(){
"use strict";
if (window.HTONBAT) return;

/* ===== CẤU HÌNH ===== */
var SHEET_ID = "1FWffWi75aATbokfqIcqjByEPzkJLQBngTXp5aPOIbLM";   // Sheet 5S (kiemsoatkho)
var SHEET_URL = "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/edit";
var TAB = "stock-inventory-hasaki";
var APPSCRIPT_URL = "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
var STALE_MS = 5 * 60 * 1000;      // init lại: dữ liệu cũ hơn 5' mới tự refresh
var CAP = 500;                     // giới hạn dòng render bảng pop-up (đồng bộ CAP các pop-up khác)

/* Thứ tự loại bất thường (quyết định thẻ chỉ số, chú giải, đoạn chart, cột pop-up) — Y HỆT factory */
var TYPES = [
  { k: "conflict",           lb: "Conflict",           c: "#d97706" },
  { k: "uid_temp",           lb: "UID Temp",           c: "#8b5cf6" },
  { k: "not_found",          lb: "Not Found",          c: "#e11d48" },
  { k: "unsuitable_product", lb: "Unsuitable product", c: "#c0392b" },
  { k: "committed",          lb: "Committed",          c: "#2563eb" },
  { k: "committed_outbound", lb: "Committed Outbound", c: "#0891b2" }
];
/* Nhận diện cột theo NHÃN header (chấp nhận snake_case / có dấu cách / tiếng Việt) */
var COLS = {
  sku: ["sku", "mã sku", "ma sku"],
  pn: ["product_name", "productname", "product name", "tên sản phẩm", "ten san pham", "sản phẩm"],
  brand: ["brand_name", "brandname", "brand", "thương hiệu", "thuong hieu"],
  cat: ["category_name", "categoryname", "category name", "category", "ngành hàng", "nganh hang", "danh mục", "nhóm hàng"],
  wh: ["warehouse_name", "warehousename", "warehouse", "warehouse name", "kho"],
  ptype: ["product_type", "producttype", "product type", "loại sản phẩm", "loai san pham", "phân loại", "classifyname", "classify name"],
  in_stock: ["in_stock", "instock", "in stock", "tồn kho", "tồn", "ton"],
  available: ["available", "có sẵn", "kha dung", "khả dụng"],
  committed: ["committed", "đang giữ", "dang giu"],
  committed_outbound: ["committed_outbound", "committedoutbound", "committed outbound"],
  unsuitable_product: ["unsuitable_product", "unsuitableproduct", "unsuitable product", "unsuitable", "hàng không phù hợp", "sp lỗi"],
  uid_temp: ["uid_temp", "uidtemp", "uid temp"],
  conflict: ["conflict", "xung đột", "xung dot"],
  not_found: ["not_found", "notfound", "not found", "không tìm thấy", "khong tim thay"]
};
/* Màu kho cố định cho 2 kho trước mắt; kho mới (mở rộng sau) rơi vào bảng màu chung */
var WH_FIX = { "SHOP - 170 QUOC LO 1A": "#2563eb", "WH - 170 QUOC LO 1A": "#0f766e" };
var PAL = ["#f59e0b", "#8b5cf6", "#ef4444", "#10b981", "#ec4899", "#6366f1", "#0891b2", "#84cc16"];

/* ===== STATE ===== */
var S = { ok: false, hasPtype: false, all: [], rows: [], wh: "", lastAt: 0, tsData: 0 };
var MODAL = { base: [], preset: null };
var PANE = null, _whColor = {}, _whCi = 0, _deb = null, _debT = null;

var $id = function(s){ return document.getElementById(s); };
function nf(x){ return (x || 0).toLocaleString("vi-VN"); }
function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
function fmtTime(ms){ var d = new Date(ms); function p(n){ return (n < 10 ? "0" : "") + n; }
  return p(d.getHours()) + ":" + p(d.getMinutes()) + " " + p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear(); }
function whColor(w){ if (WH_FIX[w]) return WH_FIX[w]; if (!_whColor[w]) _whColor[w] = PAL[_whCi++ % PAL.length]; return _whColor[w]; }
function typeOf(k){ for (var i = 0; i < TYPES.length; i++) if (TYPES[i].k === k) return TYPES[i]; return null; }
function typeByLb(lb){ for (var i = 0; i < TYPES.length; i++) if (TYPES[i].lb === lb) return TYPES[i]; return null; }
function typeOrder(lb){ for (var i = 0; i < TYPES.length; i++) if (TYPES[i].lb === lb) return i; return 99; }
function idxOf(H, aliases){ for (var i = 0; i < aliases.length; i++){ var j = H.indexOf(aliases[i]); if (j >= 0) return j; } return -1; }
function num(v){ if (v == null || v === "") return 0; var n = Number(String(v).replace(/,/g, "")); return isNaN(n) ? 0 : n; }
function whTot(o){ var s = 0; TYPES.forEach(function(t){ s += (o[t.k] || 0); }); return s; }
/* Lý do chọn (ghi vào giỏ HPC lúc tick) — liệt kê loại bất thường >0 của SKU */
function abnReasonStr(r){ var a = []; TYPES.forEach(function(t){ if (r[t.k] > 0) a.push(t.lb + " " + nf(r[t.k])); }); return a.length ? ("Bất thường: " + a.join(" · ")) : "Bất thường"; }

/* ===== CSS — bơm 1 lần, neo #pane-htonbat / .ht-modal, token màu theo theme host ===== */
var CSS = [
"#pane-htonbat .ht-srcbar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:14px 0 10px;font-size:12.5px;}",
/* nguồn/mô tả/Làm mới ĐƯA XUỐNG CHÂN tab — đồng bộ footer với các tab native */
"#pane-htonbat .ht-srcfoot{margin-top:22px;padding-top:14px;border-top:1px solid var(--border,#e8ecf1);text-align:center;}",
"#pane-htonbat .ht-srcfoot .ht-srcbar{margin:0 0 6px;justify-content:center;font-size:12px;}",
"#pane-htonbat .ht-srcfoot .ht-hint{display:inline;}",
"#pane-htonbat .ht-chip{background:color-mix(in srgb, var(--accent,#326e51) 14%, transparent);color:var(--accent,#326e51);border-radius:999px;padding:4px 13px;font-weight:650;font-size:12px;}",
"#pane-htonbat .ht-srcbar a{color:var(--accent,#326e51);text-decoration:none;font-weight:600;} #pane-htonbat .ht-srcbar a:hover{text-decoration:underline;}",
"#pane-htonbat .ht-hint{color:var(--muted,#9ca3af);font-size:11.5px;font-weight:400;}",
"#htReload{background:var(--accent,#326e51);color:var(--accent-text,#fff);border:0;border-radius:9px;padding:8px 15px;font-size:12.5px;font-weight:650;cursor:pointer;min-height:36px;}",
"#htReload:disabled{background:color-mix(in srgb, var(--muted,#9ca3af) 42%, var(--surface,#fff));color:var(--muted,#9ca3af);cursor:not-allowed;}",
/* chip lọc kho */
"#pane-htonbat .ht-whbar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 12px;}",
"#pane-htonbat .ht-whtab{border:1px solid var(--border,#e8ecf1);background:var(--surface,#fff);color:var(--text,#374151);border-radius:999px;padding:6px 13px;font-size:12px;font-weight:600;cursor:pointer;min-height:32px;display:inline-flex;align-items:center;gap:7px;transition:background .16s ease,border-color .16s ease;}",
"#pane-htonbat .ht-whtab:hover{background:color-mix(in srgb, var(--accent,#326e51) 8%, transparent);}",
"#pane-htonbat .ht-whtab.active{background:var(--accent,#326e51);color:var(--accent-text,#fff);border-color:var(--accent,#326e51);}",
"#pane-htonbat .ht-whtab b{font-variant-numeric:tabular-nums;}",
"#pane-htonbat .ht-dot,.ht-modal .ht-dot{display:inline-block;width:9px;height:9px;border-radius:50%;flex:none;vertical-align:middle;}",
/* thẻ chỉ số */
"#pane-htonbat .ht-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(136px,1fr));gap:8px;margin:4px 0 12px;}",
"#pane-htonbat .ht-tile{--cc:var(--accent,#326e51);background:var(--surface,#fff);border:1px solid var(--border,#e8ecf1);border-left:4px solid var(--cc);border-radius:10px;padding:9px 12px;cursor:pointer;transition:transform .16s cubic-bezier(.32,.72,0,1),box-shadow .25s ease;animation:ht-in .3s ease both;}",
"#pane-htonbat .ht-tile:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(16,24,40,.12);}",
"#pane-htonbat .ht-tile .k{font-size:20px;font-weight:780;font-variant-numeric:tabular-nums;line-height:1;color:var(--cc);}",
"#pane-htonbat .ht-tile.tot .k{color:var(--text,#1f2937);}",
"#pane-htonbat .ht-tile .l{font-size:11px;color:var(--text,#374151);margin-top:4px;font-weight:650;line-height:1.2;}",
"#pane-htonbat .ht-tile .s{font-size:10px;color:var(--muted,#9ca3af);margin-top:1px;}",
/* 2 chart cạnh nhau */
"#pane-htonbat .ht-grid2{display:grid;grid-template-columns:1.55fr 1fr;gap:12px;}",
"@media(max-width:1024px){#pane-htonbat .ht-grid2{grid-template-columns:1fr;}}",
"#pane-htonbat .ht-panel{background:var(--surface,#fff);border:1px solid var(--border,#e8ecf1);border-radius:14px;padding:14px 16px;}",
"#pane-htonbat .ht-panel h2{margin:0 0 12px;font-size:14px;font-weight:680;color:var(--text,#374151);display:flex;align-items:center;gap:8px;flex-wrap:wrap;}",
"#pane-htonbat .ht-legend{display:inline-flex;flex-wrap:wrap;gap:3px 10px;font-weight:400;font-size:10.5px;color:var(--muted,#6b7280);}",
"#pane-htonbat .ht-legend span{display:inline-flex;align-items:center;gap:5px;}",
"#pane-htonbat .ht-legend i{width:9px;height:9px;border-radius:3px;display:inline-block;flex:none;}",
"#pane-htonbat .ht-chart{display:flex;flex-direction:column;gap:1px;max-height:330px;overflow-y:auto;padding-right:6px;}",
"#pane-htonbat .ht-row{display:grid;grid-template-columns:210px 1fr 92px;align-items:center;gap:10px;padding:5px 6px;border-radius:8px;cursor:pointer;transition:background .16s ease;}",
"#pane-htonbat .ht-row:hover{background:color-mix(in srgb, var(--accent,#326e51) 7%, transparent);}",
"#pane-htonbat .ht-rl{font-size:11.5px;font-weight:600;color:var(--text,#1f2937);white-space:normal;word-break:break-word;line-height:1.3;display:flex;align-items:center;gap:7px;}",
"#pane-htonbat .ht-track{background:color-mix(in srgb, var(--muted,#9ca3af) 20%, transparent);border-radius:6px;height:16px;overflow:hidden;}",
"#pane-htonbat .ht-fill{height:100%;display:flex;width:0;border-radius:6px;overflow:hidden;transition:width .85s cubic-bezier(.4,0,.2,1);}",
"#pane-htonbat .ht-fill i{display:block;height:100%;min-width:1px;}",
"#pane-htonbat .ht-rv{text-align:right;font-variant-numeric:tabular-nums;font-size:12px;line-height:1.15;}",
"#pane-htonbat .ht-rv b{font-size:13px;color:var(--text,#1f2937);} #pane-htonbat .ht-rv small{display:block;color:var(--muted,#9ca3af);font-size:10px;font-weight:500;}",
"@media(max-width:640px){#pane-htonbat .ht-row{grid-template-columns:1fr 84px;grid-template-areas:'l l' 't v';row-gap:5px;gap:8px;padding:7px 6px;}#pane-htonbat .ht-rl{grid-area:l;}#pane-htonbat .ht-track{grid-area:t;}#pane-htonbat .ht-rv{grid-area:v;}}",
"#pane-htonbat .ht-empty{color:var(--muted,#9ca3af);font-size:12.5px;padding:18px 2px;text-align:center;}",
"#pane-htonbat .ht-state{padding:56px 20px;text-align:center;color:var(--muted,#6b7280);}",
"#pane-htonbat .ht-spin{width:32px;height:32px;border:3px solid var(--border,#d5dbe4);border-top-color:var(--accent,#326e51);border-radius:50%;margin:0 auto 16px;animation:ht-sp .8s linear infinite;}",
"@keyframes ht-sp{to{transform:rotate(360deg)}}",
"#pane-htonbat .ht-fade{animation:ht-in .45s cubic-bezier(.32,.72,0,1) both;}",
"@keyframes ht-in{from{opacity:0;transform:translate3d(0,12px,0)}to{opacity:1;transform:none}}",
/* modal — gắn ở body, neo class riêng (khuôn fs-modal) */
".ht-modal{display:none;position:fixed;inset:0;background:rgba(17,24,39,.55);backdrop-filter:blur(6px);z-index:1200;align-items:center;justify-content:center;padding:18px;opacity:0;transition:opacity .22s;}",
".ht-modal.show{opacity:1;}",
".ht-modalbox{background:var(--surface,#fff);color:var(--text,#1f2937);border-radius:18px;width:min(1280px,96vw);max-height:90vh;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(16,24,40,.3);transform:translateY(12px) scale(.985);opacity:.6;transition:transform .26s,opacity .26s;}",
".ht-modal.show .ht-modalbox{transform:none;opacity:1;}",
".ht-modalhd{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--border,#e8ecf1);}",
".ht-modalhd .mt{font-weight:700;font-size:15.5px;} .ht-modalhd .mtsub{font-size:11.5px;color:var(--muted,#9ca3af);margin-top:2px;}",
".ht-mclose{background:0;border:0;font-size:24px;line-height:1;cursor:pointer;color:var(--muted,#9ca3af);padding:6px 10px;border-radius:8px;min-width:44px;min-height:40px;}",
".ht-mclose:hover{color:#ef4444;background:color-mix(in srgb,#ef4444 12%,transparent);}",
".ht-mfilters{display:grid;grid-template-columns:1.3fr 1fr 1fr 1.6fr;gap:8px;padding:12px 20px;border-bottom:1px solid var(--border,#e8ecf1);}",
"@media(max-width:720px){.ht-mfilters{grid-template-columns:1fr 1fr;}}",
".ht-mfilters .fld{display:flex;flex-direction:column;gap:3px;}",
".ht-mfilters label{font-size:10px;font-weight:650;color:var(--muted,#9ca3af);text-transform:uppercase;letter-spacing:.04em;}",
".ht-mfilters input{padding:9px 10px;border:1px solid var(--border,#d5dbe4);border-radius:9px;font-size:12.5px;background:var(--surface,#fff);color:var(--text,#1f2937);width:100%;min-height:38px;}",
".ht-mfilters input:focus{outline:0;border-color:var(--accent,#326e51);}",
".ht-combo{position:relative;}",
".ht-combo-menu{position:absolute;top:calc(100% + 5px);left:0;right:0;z-index:40;background:var(--surface,#fff);border:1px solid var(--border,#e8ecf1);border-radius:11px;box-shadow:0 24px 60px rgba(16,24,40,.28);max-height:250px;overflow-y:auto;overscroll-behavior:contain;padding:5px;opacity:0;visibility:hidden;transform:translateY(-6px);transition:.16s;}",
".ht-combo-menu.show{opacity:1;visibility:visible;transform:none;}",
".ht-combo-item{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 11px;border-radius:8px;font-size:12.5px;cursor:pointer;color:var(--text,#1f2937);white-space:nowrap;overflow:hidden;}",
".ht-combo-item .nm{overflow:hidden;text-overflow:ellipsis;} .ht-combo-item .c{color:var(--muted,#9ca3af);font-size:11px;flex:none;}",
".ht-combo-item:hover{background:color-mix(in srgb, var(--accent,#326e51) 10%, transparent);color:var(--accent,#326e51);}",
".ht-combo-item.all{border-bottom:1px solid var(--border,#e8ecf1);font-weight:600;}",
".ht-combo-empty{padding:12px;font-size:12px;color:var(--muted,#9ca3af);text-align:center;}",
".ht-msum{padding:9px 20px;font-size:12px;color:var(--muted,#6b7280);border-bottom:1px solid var(--border,#e8ecf1);font-variant-numeric:tabular-nums;}",
".ht-modalbody{overflow:auto;padding:0 20px 20px;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;}",
".ht-mtbl{width:100%;border-collapse:collapse;font-size:12.5px;color:var(--text,#1f2937);}",
".ht-mtbl thead th{position:sticky;top:0;background:var(--accent,#326e51);color:var(--accent-text,#fff);padding:9px 11px;text-align:left;font-weight:600;font-size:11px;z-index:1;white-space:nowrap;}",
".ht-mtbl td{padding:8px 11px;border-bottom:1px solid var(--border,#f1f4f8);vertical-align:top;white-space:nowrap;}",
".ht-mtbl .empty{text-align:center;color:var(--muted,#9ca3af);padding:28px;}",
".ht-mtbl .pn{color:var(--muted,#6b7280);white-space:normal;min-width:190px;max-width:300px;word-break:break-word;}",
".ht-mtbl .num{text-align:right!important;font-variant-numeric:tabular-nums;}",
".ht-mtbl .cell0{color:var(--muted,#9ca3af);}",
".ht-mtbl tbody.is-filtering{opacity:.45;transition:opacity .12s;}",
/* mobile: modal tràn màn hình, touch ≥44px */
"@media(max-width:768px){.ht-modal{padding:0;align-items:stretch;justify-content:stretch;}.ht-modalbox{width:100vw!important;max-height:100vh!important;height:100vh;border-radius:0;}.ht-mclose{font-size:30px;min-width:48px;min-height:48px;}.ht-mfilters input{min-height:44px;}#pane-htonbat .ht-whtab{min-height:44px;}#htReload{min-height:44px;width:100%;}}",
].join("\n");

/* ===== KHUNG HTML ===== */
var KHUNG =
'<div class="ht-whbar" id="htWhBar"></div>' +
'<div id="htContent"></div>' +
'<div id="htState" class="ht-state"><div class="ht-spin"></div>Đang tải dữ liệu tồn kho bất thường…</div>' +
'<div class="ht-srcfoot">' +
'  <div class="ht-srcbar">' +
'    <span class="ht-chip">Tồn kho bất thường — Hasaki Vietnam · SHOP + WH 170 QL1A</span>' +
'    <a href="' + SHEET_URL + '" target="_blank" rel="noopener">Mở Google Sheet</a>' +
'    <span id="htLoadinfo" class="ht-hint"></span>' +
'    <button id="htReload" onclick="HTONBAT.reload()" title="Đọc lại dữ liệu mới nhất từ Google Sheet">Làm mới</button>' +
'  </div>' +
'  <p class="ht-hint" style="margin:0">Chỉ số "bất thường" đọc từ báo cáo <b>stock-inventory</b> WMS (cụm đồng bộ 7h) — chỉ SKU có <b>Product Type = Normal</b> và có ít nhất 1 loại &gt; 0: Conflict · UID Temp · Not Found · Unsuitable product · Committed · Committed Outbound.</p>' +
'</div>';

var MODAL_HTML =
'<div id="htModal" class="ht-modal">' +
'  <div class="ht-modalbox">' +
'    <div class="ht-modalhd"><div><div class="mt" id="htMtitle"></div><div class="mtsub" id="htMsub"></div></div>' +
'      <button class="ht-mclose" onclick="HTONBAT.closeModal()">&times;</button></div>' +
'    <div class="ht-mfilters" id="htMFilters"></div>' +
'    <div class="ht-msum" id="htMSum"></div>' +
'    <div class="ht-modalbody"><table class="ht-mtbl"><thead><tr>' +
'      <th class="hpc-cc"><input type="checkbox" class="hpc-all" title="Chọn/bỏ tất cả dòng đang lọc (kể cả ngoài số dòng hiển thị)"></th><th>Kho</th><th>SKU</th><th class="pn">Tên sản phẩm</th><th>Category</th>' +
'      <th class="num">In Stock</th><th class="num">Available</th>' +
TYPES.map(function(t){ return '<th class="num">' + t.lb + '</th>'; }).join('') +
'    </tr></thead><tbody id="htMBody"></tbody></table></div>' +
'  </div>' +
'</div>';

/* ===== TẢI DỮ LIỆU (gviz JSONP — callback tiền tố htgv_, không đụng host) ===== */
function loadData(){
  var st = $id("htState"); if (!st) return;
  var btn = $id("htReload"); if (btn) btn.disabled = true;
  st.style.display = "block";
  st.innerHTML = '<div class="ht-spin"></div>Đang tải dữ liệu tồn kho bất thường…';
  $id("htContent").innerHTML = ""; $id("htWhBar").innerHTML = "";
  S.lastAt = Date.now();
  window.htgv_data = function(resp){ onData(resp); };
  var url = "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/gviz/tq?tqx=out:json;responseHandler:htgv_data" +
    "&sheet=" + encodeURIComponent(TAB) + "&headers=1";
  var old = $id("ht_sc_data"); if (old) old.remove();
  var sc = document.createElement("script"); sc.id = "ht_sc_data"; sc.src = url;
  sc.onerror = function(){ S.ok = false; render(); };
  document.body.appendChild(sc);
  loadMeta();
}
function onData(resp){
  var out = { ok: false, rows: [], hasPtype: false };
  try{
    if (!resp || resp.status === "error") throw 0;
    var H = ((resp.table && resp.table.cols) || []).map(function(c){ return String((c && c.label) || "").replace(/\s+/g, " ").trim().toLowerCase(); });
    var idx = {}; Object.keys(COLS).forEach(function(k){ idx[k] = idxOf(H, COLS[k]); });
    var anyType = TYPES.some(function(t){ return idx[t.k] >= 0; });
    if (idx.sku < 0 || idx.wh < 0 || !anyType) throw 0;   // tab chưa có/không đúng nguồn
    var rows = (resp.table && resp.table.rows) || [], arr = [];
    rows.forEach(function(r){
      var c = r.c || [];
      function gv(i){ return (i >= 0 && c[i] && c[i].v != null) ? c[i].v : ""; }
      var sku = String(gv(idx.sku)).trim(); if (!sku) return;
      var o = { sku: sku, pn: String(gv(idx.pn)),
        cat: String(gv(idx.cat) || "").trim(), wh: String(gv(idx.wh)),   // rỗng = "" (không ép "(trống)"): pop-up hiện "—", combo lọc bỏ qua
        ptype: String(gv(idx.ptype)).trim(),
        in_stock: num(gv(idx.in_stock)), available: num(gv(idx.available)) };
      var s = 0; TYPES.forEach(function(t){ o[t.k] = num(gv(idx[t.k])); s += o[t.k]; });
      o._abn = s; arr.push(o);
    });
    out = { ok: true, rows: arr, hasPtype: idx.ptype >= 0 };
  }catch(e){ out = { ok: false, rows: [], hasPtype: false }; }
  S.ok = out.ok; S.hasPtype = out.hasPtype;
  var norm = out.rows;
  if (out.ok && out.hasPtype) norm = out.rows.filter(function(r){ return /^normal$/i.test(r.ptype) || r.ptype === "1"; });
  S.all = norm;
  S.rows = norm.filter(function(r){ return r._abn > 0; });
  render();
}
/* Chip giờ dữ liệu: hỏi GAS lastSync (mốc apiAt lúc bộ sync LẤY từ WMS) — JSONP */
function loadMeta(){
  window.htgv_last = function(j){ try{ if (j && j.status === "success" && Number(j.ts) > 0){ S.tsData = Number(j.ts); capNhatInfo(); } }catch(e){} };
  var old = $id("ht_sc_meta"); if (old) old.remove();
  var sc = document.createElement("script"); sc.id = "ht_sc_meta";
  sc.src = APPSCRIPT_URL + "?action=lastSync&tab=" + encodeURIComponent(TAB) + "&callback=htgv_last";
  sc.onerror = function(){};
  document.body.appendChild(sc);
}
function capNhatInfo(){
  var el = $id("htLoadinfo"); if (!el) return;
  el.textContent = (S.rows.length ? nf(S.rows.length) + " SKU bất thường" : "") +
    (S.tsData ? (S.rows.length ? " · " : "") + "dữ liệu WMS lúc " + fmtTime(S.tsData) : "");
}

/* ===== LỌC + RENDER ===== */
function rowsInScope(){ return S.rows.filter(function(r){ return !S.wh || r.wh === S.wh; }); }
function setWh(w){ if (S.wh === w) w = ""; S.wh = w; render(); }
function renderWhBar(){
  var el = $id("htWhBar"); if (!el) return;
  var ws = {}; S.rows.forEach(function(r){ if (r.wh) ws[r.wh] = (ws[r.wh] || 0) + 1; });
  var keys = Object.keys(ws).sort();
  if (!keys.length){ el.innerHTML = ""; return; }
  el.innerHTML = '<span class="ht-hint" style="font-weight:650">Lọc kho:</span>' +
    '<button class="ht-whtab' + (S.wh ? "" : " active") + '" onclick="HTONBAT.setWh(\'\')">Tất cả</button>' +
    keys.map(function(w){
      return '<button class="ht-whtab' + (S.wh === w ? " active" : "") + '" data-w="' + esc(w) + '" title="' + esc(w) + '" ' +
        'onclick="HTONBAT.setWh(this.getAttribute(\'data-w\'))"><span class="ht-dot" style="background:' + whColor(w) + '"></span>' + esc(w) + ' <b>' + nf(ws[w]) + '</b></button>';
    }).join("");
}
function render(){
  var st = $id("htState"), cont = $id("htContent");
  if (!st || !cont) return;
  var btn = $id("htReload"); if (btn) btn.disabled = false;
  if (!S.ok){
    $id("htWhBar").innerHTML = ""; cont.innerHTML = "";
    st.style.display = "block";
    st.innerHTML = '<div style="max-width:720px;margin:0 auto;text-align:left;line-height:1.75;color:var(--muted,#6b7280)">' +
      '<b style="color:var(--text,#1f2937)">Chưa có dữ liệu tồn kho bất thường trong Google Sheet.</b><br>' +
      'Tab này đọc từ sheet <code>' + esc(TAB) + '</code> — bộ đồng bộ <code>sync-tonbatthuong.js</code> (cụm 7h) sẽ ghi báo cáo ' +
      '<code>/wms/report-management/stock-inventories</code> của công ty Hasaki Vietnam (kho SHOP + WH 170 QUOC LO 1A) vào đó.</div>';
    capNhatInfo();
    return;
  }
  st.style.display = "none";
  renderWhBar();
  var rows = rowsInScope();
  var tot = {}, cnt = {}; TYPES.forEach(function(t){ tot[t.k] = 0; cnt[t.k] = 0; });
  var byWh = {};
  rows.forEach(function(r){
    if (!byWh[r.wh]) byWh[r.wh] = { n: 0 };
    byWh[r.wh].n++;
    TYPES.forEach(function(t){ if (r[t.k] > 0){ tot[t.k] += r[t.k]; cnt[t.k]++; byWh[r.wh][t.k] = (byWh[r.wh][t.k] || 0) + r[t.k]; } });
  });
  var nSku = rows.length, nWh = Object.keys(byWh).length;

  var tiles = '<div class="ht-tile tot" onclick="HTONBAT.openAll()" title="Xem tất cả SKU bất thường">' +
      '<div class="k">' + nf(nSku) + '</div><div class="l">SKU bất thường</div><div class="s">Product Type = Normal · ' + nf(nWh) + ' kho</div></div>' +
    TYPES.map(function(t){
      return '<div class="ht-tile" style="--cc:' + t.c + '" data-k="' + t.k + '" onclick="HTONBAT.openType(this.getAttribute(\'data-k\'))" title="Xem SKU có ' + t.lb + '">' +
        '<div class="k">' + nf(tot[t.k]) + '</div><div class="l">' + t.lb + '</div><div class="s">' + nf(cnt[t.k]) + ' SKU</div></div>';
    }).join("");
  var legend = TYPES.map(function(t){ return '<span><i style="background:' + t.c + '"></i>' + t.lb + '</span>'; }).join("");

  var html = '<div class="ht-tiles">' + tiles + '</div>';
  if (!nSku){
    html += '<section class="ht-panel"><div class="ht-empty">Không có SKU bất thường (Product Type = Normal) trong phạm vi' + (S.wh ? (' kho “' + esc(S.wh) + '”') : ' này') + '.</div></section>';
    cont.innerHTML = html; capNhatInfo(); return;
  }
  // Chart 1 — theo kho: thanh ngang xếp chồng (độ dài = tổng SL bất thường, màu = loại)
  var whKeys = Object.keys(byWh).sort(function(a, b){ return whTot(byWh[b]) - whTot(byWh[a]); });
  var maxWh = 1; whKeys.forEach(function(w){ maxWh = Math.max(maxWh, whTot(byWh[w])); });
  var whBars = whKeys.map(function(w){
    var o = byWh[w], t = whTot(o), wp = t / maxWh * 100;
    var segs = TYPES.map(function(ty){ var v = o[ty.k] || 0; if (!v || !t) return ""; return '<i style="width:' + (v / t * 100).toFixed(3) + '%;background:' + ty.c + '" title="' + ty.lb + ': ' + nf(v) + '"></i>'; }).join("");
    return '<div class="ht-row" data-w="' + esc(w) + '" onclick="HTONBAT.openWh(this.getAttribute(\'data-w\'))" title="Bấm xem chi tiết SKU của kho ' + esc(w) + '">' +
      '<span class="ht-rl"><span class="ht-dot" style="background:' + whColor(w) + '"></span>' + esc(w) + '</span>' +
      '<span class="ht-track"><span class="ht-fill" data-w="' + wp.toFixed(2) + '">' + segs + '</span></span>' +
      '<span class="ht-rv"><b>' + nf(t) + '</b><small>' + nf(o.n) + ' SKU</small></span></div>';
  }).join("");
  // Chart 2 — theo loại
  var maxT = 1; TYPES.forEach(function(t){ maxT = Math.max(maxT, tot[t.k]); });
  var typeBars = TYPES.map(function(t){
    var wp = tot[t.k] / maxT * 100;
    return '<div class="ht-row" data-k="' + t.k + '" onclick="HTONBAT.openType(this.getAttribute(\'data-k\'))" title="Bấm xem SKU có ' + t.lb + '">' +
      '<span class="ht-rl"><span class="ht-dot" style="background:' + t.c + '"></span>' + t.lb + '</span>' +
      '<span class="ht-track"><span class="ht-fill" data-w="' + wp.toFixed(2) + '" style="background:' + t.c + '"></span></span>' +
      '<span class="ht-rv"><b>' + nf(tot[t.k]) + '</b><small>' + nf(cnt[t.k]) + ' SKU</small></span></div>';
  }).join("");

  html += '<div class="ht-grid2 ht-fade">' +
    '<section class="ht-panel"><h2>Theo kho <span class="ht-hint">(độ dài = tổng SL · màu = loại · bấm để xem SKU)</span> <span class="ht-legend">' + legend + '</span></h2><div class="ht-chart">' + whBars + '</div></section>' +
    '<section class="ht-panel"><h2>Theo loại <span class="ht-hint">(bấm để xem SKU)</span></h2><div class="ht-chart">' + typeBars + '</div></section>' +
  '</div>';
  cont.innerHTML = html;
  requestAnimationFrame(function(){ requestAnimationFrame(function(){
    cont.querySelectorAll(".ht-fill").forEach(function(f){ f.style.width = f.getAttribute("data-w") + "%"; });
  }); });
  capNhatInfo();
}

/* ===== MODAL DRILL-DOWN — combo chain-filter (khuôn pop-up factory/kiemke) ===== */
var FDEF = [
  { k: "wh",  lb: "Kho (Warehouse)", vals: function(r){ return r.wh ? [r.wh] : []; } },
  { k: "cat", lb: "Category",        vals: function(r){ return r.cat ? [r.cat] : []; } },
  { k: "type", lb: "Loại bất thường", vals: function(r){ var a = []; TYPES.forEach(function(t){ if (r[t.k] > 0) a.push(t.lb); }); return a; } }
];
function fdefOf(k){ for (var i = 0; i < FDEF.length; i++) if (FDEF[i].k === k) return FDEF[i]; return null; }
function openAll(){ showModal(rowsInScope(), "Tất cả SKU bất thường" + (S.wh ? (" · " + S.wh) : ""), null); }
function openWh(w){ showModal(S.rows.filter(function(r){ return r.wh === w; }), "Bất thường tại kho: " + w, null); }
function openType(k){ var ty = typeOf(k); if (!ty) return; showModal(rowsInScope(), "SKU có " + ty.lb + (S.wh ? (" · " + S.wh) : ""), { k: "type", raw: ty.lb }); }
function showModal(base, title, preset){
  MODAL.base = base || []; MODAL.preset = preset || null;
  $id("htMtitle").textContent = title;
  $id("htMsub").textContent = nf(MODAL.base.length) + " dòng (kho | SKU) — combo lọc sinh động, gõ để lọc, đếm số dòng";
  buildFilters();
  $id("htMSum").textContent = "";
  $id("htMBody").innerHTML = '<tr><td colspan="' + (7 + TYPES.length) + '" class="empty">Đang hiển thị…</td></tr>';
  var m = $id("htModal"); m.style.display = "flex";
  requestAnimationFrame(function(){ m.classList.add("show"); setTimeout(mRender, 60); });
}
function closeModal(){
  var m = $id("htModal"); m.classList.remove("show");
  setTimeout(function(){ m.style.display = "none"; $id("htMFilters").innerHTML = ""; $id("htMBody").innerHTML = ""; }, 240);
}
function buildFilters(){
  var rows = MODAL.base, html = "";
  FDEF.forEach(function(d){
    var uniq = new Set();
    rows.forEach(function(r){ d.vals(r).forEach(function(v){ if (v) uniq.add(v); }); });
    if (uniq.size > 1){
      html += '<div class="fld"><label>' + esc(d.lb) + '</label><div class="ht-combo" data-fk="' + d.k + '" data-lb="' + esc(d.lb) + '">' +
        '<input data-fk="' + d.k + '" autocomplete="off" placeholder="Tất cả…" oninput="HTONBAT.comboInput(this)" onfocus="HTONBAT.comboMenu(this.parentNode)">' +
        '<div class="ht-combo-menu"></div></div></div>';
    }
  });
  html += '<div class="fld q"><label>Tìm nhanh</label><input id="htMQ" autocomplete="off" placeholder="SKU / tên sản phẩm / thương hiệu…" oninput="HTONBAT.quick()"></div>';
  $id("htMFilters").innerHTML = html;
  if (MODAL.preset){
    var p = MODAL.preset, inp = $id("htMFilters").querySelector('.ht-combo[data-fk="' + p.k + '"] input');
    if (inp){ inp.value = p.raw; inp.setAttribute("data-exact", "1"); }
  }
}
function qval(){ return (($id("htMQ") || {}).value || "").trim().toLowerCase(); }
function fstate(){
  return Array.prototype.slice.call(document.querySelectorAll("#htMFilters .ht-combo input")).map(function(inp){
    var v = inp.value.trim();
    return { k: inp.getAttribute("data-fk"), raw: v, v: v.toLowerCase(), exact: !!inp.getAttribute("data-exact") };
  });
}
function rowsWith(excludeK, state, q){
  return MODAL.base.filter(function(r){
    for (var i = 0; i < state.length; i++){ var f = state[i];
      if (f.k === excludeK || !f.v) continue;
      var vs = fdefOf(f.k).vals(r).map(String);
      if (f.exact){ if (vs.indexOf(f.raw) < 0) return false; }
      else if (!vs.some(function(v){ return v.toLowerCase().indexOf(f.v) >= 0; })) return false;
    }
    if (q && ((r.sku + " " + r.pn + " " + r.cat).toLowerCase().indexOf(q) < 0)) return false;
    return true;
  });
}
function comboMenu(combo){
  var k = combo.getAttribute("data-fk"), lb = combo.getAttribute("data-lb");
  var inp = combo.querySelector("input"), menu = combo.querySelector(".ht-combo-menu");
  var uniq = new Set(), cnt = {};
  rowsWith(k, fstate(), qval()).forEach(function(r){ fdefOf(k).vals(r).forEach(function(v){ if (!v) return; uniq.add(v); cnt[v] = (cnt[v] || 0) + 1; }); });
  var typed = inp.getAttribute("data-exact") ? "" : inp.value.trim().toLowerCase();
  var items = Array.from(uniq).filter(function(v){ return !typed || v.toLowerCase().indexOf(typed) >= 0; });
  items.sort(k === "type" ? function(a, b){ return typeOrder(a) - typeOrder(b); } : function(a, b){ return a < b ? -1 : a > b ? 1 : 0; });
  var html = '<div class="ht-combo-item all" data-v=""><span class="nm">Tất cả ' + esc(lb) + '</span><span class="c">' + uniq.size + ' mục</span></div>';
  html += items.map(function(v){ return '<div class="ht-combo-item" data-v="' + esc(v) + '"><span class="nm">' + esc(v) + '</span><span class="c">' + nf(cnt[v]) + '</span></div>'; }).join("");
  if (!items.length) html += '<div class="ht-combo-empty">Không có mục phù hợp</div>';
  menu.innerHTML = html;
  closeCombos(combo);
  menu.classList.add("show");
}
function comboInput(inp){ inp.removeAttribute("data-exact"); comboMenu(inp.parentNode); quick(); }
function closeCombos(except){
  document.querySelectorAll("#htMFilters .ht-combo-menu.show").forEach(function(m){ if (!except || m.parentNode !== except) m.classList.remove("show"); });
}
function quick(){ clearTimeout(_deb); _deb = setTimeout(applyF, 120); }
function applyF(){ var b = $id("htMBody"); if (b) b.classList.add("is-filtering"); clearTimeout(_debT); _debT = setTimeout(function(){ mRender(); if (b) b.classList.remove("is-filtering"); }, 150); }
function mRender(){
  var state = fstate(), q = qval();
  var rows = rowsWith(null, state, q);
  var tk = null; state.forEach(function(f){ if (f.k === "type" && f.exact && f.raw){ var ty = typeByLb(f.raw); if (ty) tk = ty.k; } });
  rows = rows.slice().sort(function(a, b){ return tk ? (b[tk] - a[tk]) : (b._abn - a._abn); });
  var NCOL = 7 + TYPES.length, out = [];   // +1 cột checkbox chọn tạo lệnh (HPC)
  var sums = { in_stock: 0, available: 0 }; TYPES.forEach(function(t){ sums[t.k] = 0; });
  for (var i = 0; i < rows.length; i++){ var r = rows[i];
    sums.in_stock += r.in_stock; sums.available += r.available; TYPES.forEach(function(t){ sums[t.k] += r[t.k]; });
    if (out.length < CAP){
      var tds = TYPES.map(function(t){ var v = r[t.k]; return v > 0 ? ('<td class="num" style="color:' + t.c + ';font-weight:700">' + nf(v) + '</td>') : '<td class="num cell0">0</td>'; }).join("");
      out.push('<tr>' + (window.HPC ? HPC.cell(r.wh, r.sku, r.pn, 1, abnReasonStr(r)) : "") +
        '<td><span class="ht-dot" style="background:' + whColor(r.wh) + '"></span> ' + esc(r.wh) + '</td>' +
        '<td>' + esc(r.sku) + '</td><td class="pn">' + esc(r.pn) + '</td><td>' + (r.cat ? esc(r.cat) : "—") + '</td>' +
        '<td class="num">' + nf(r.in_stock) + '</td><td class="num">' + nf(r.available) + '</td>' + tds + '</tr>');
    }
  }
  if (rows.length > CAP) out.push('<tr><td colspan="' + NCOL + '" class="empty">Hiển thị ' + nf(CAP) + ' / ' + nf(rows.length) + ' dòng — dùng bộ lọc để thu hẹp.</td></tr>');
  $id("htMBody").innerHTML = out.length ? out.join("") : '<tr><td colspan="' + NCOL + '" class="empty">Không có dòng phù hợp</td></tr>';
  if (window.HPC) HPC.syncAll($id("htModal"), rows);
  var nAct = state.filter(function(f){ return f.v; }).length + (q ? 1 : 0);
  var parts = TYPES.map(function(t){ return t.lb + ": " + nf(sums[t.k]); });
  $id("htMSum").textContent = nf(rows.length) + " / " + nf(MODAL.base.length) + " dòng" + (nAct ? (" · " + nAct + " bộ lọc đang áp dụng") : "") + " · Tồn " + nf(sums.in_stock) + " · " + parts.join(" · ");
}

/* ===== INIT (host gọi mỗi lần mở tab — idempotent) ===== */
var _booted = false;
function init(pane){
  PANE = pane;
  if (!_booted){
    _booted = true;
    var style = document.createElement("style"); style.id = "ht-css"; style.textContent = CSS;
    document.head.appendChild(style);
    var wrap = document.createElement("div"); wrap.innerHTML = MODAL_HTML;
    while (wrap.firstChild) document.body.appendChild(wrap.firstChild);
    $id("htModal").addEventListener("click", function(e){ if (e.target === this) closeModal(); });
    document.addEventListener("keydown", function(e){
      if (e.key !== "Escape") return;
      var lb = document.getElementById("lightbox"); if (lb && lb.classList.contains("show")) return;
      if ($id("htModal") && $id("htModal").classList.contains("show")) closeModal();
    });
    // Delegation 1 lần: chọn mục trong combo (innerHTML rebuild không mất listener)
    $id("htMFilters").addEventListener("click", function(e){
      var it = e.target.closest(".ht-combo-item"); if (!it) return;
      var inp = it.closest(".ht-combo").querySelector("input");
      inp.value = it.getAttribute("data-v") || "";
      if (inp.value) inp.setAttribute("data-exact", "1"); else inp.removeAttribute("data-exact");
      closeCombos(); applyF();
    });
    document.addEventListener("click", function(e){ if (!e.target.closest("#htMFilters .ht-combo")) closeCombos(); });
    // Giỏ chọn tạo lệnh kiểm kê (module HPC dùng chung) — chọn-tất-cả theo tập ĐANG LỌC
    if (window.HPC) HPC.wire($id("htModal"), function(){ return rowsWith(null, fstate(), qval()).map(function(r){ return { wh: r.wh, sku: r.sku, pn: r.pn, t: 1, src: abnReasonStr(r) }; }); });
    pane.innerHTML = KHUNG;
    loadData();
    return;
  }
  if (!pane.querySelector("#htContent")){ pane.innerHTML = KHUNG; render(); capNhatInfo(); }
  if (Date.now() - S.lastAt > STALE_MS) loadData();
}

window.HTONBAT = {
  init: init, reload: loadData, setWh: setWh,
  openAll: openAll, openWh: openWh, openType: openType, closeModal: closeModal,
  comboInput: comboInput, comboMenu: comboMenu, quick: quick
};
})();
