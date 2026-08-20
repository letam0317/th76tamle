/**
 * ============================================================================
 *  hasaki-kiemke.js — MODULE "KIỂM KÊ" (Physical Count) của công ty HASAKI
 * ============================================================================
 *  Nhân bản tab Kiểm kê của dashboard Audit Factory (2 khối song song SKU |
 *  mã vị trí: dải chỉ số bấm được, thanh trạng thái 100%, chart "đã kiểm theo
 *  ngày" so với ngày kề trước, tiến độ theo kho cross-filter, pop-up chi tiết
 *  combo chain-filter, pop-up DỰ BÁO HOÀN THÀNH + mô phỏng nhân sự) — TRƯỚC MẮT
 *  2 kho: SHOP - 170 QUOC LO 1A · WH - 170 QUOC LO 1A (push-pc-to-sheet.mjs
 *  ghi tab "kiemke-sku-hasaki" / "kiemke-location-hasaki" trên Sheet 5S, cụm 8h40).
 *
 *  KHÁC factory (CÓ CHỦ ĐÍCH):
 *   - Hasaki chưa có nguồn Stock Location -> mẫu số "Tổng" = distinct (kho|mã)
 *     từ CHÍNH dữ liệu phiếu WMS; "Còn lại" = key chưa có phiếu đã kiểm
 *     (anti-join trên phiếu thay vì trên tồn kho). Tổng = Đã kiểm + Còn lại.
 *   - KHÔNG type-filter cứng: 2 tab sheet đã tách SKU/Location từ nguồn
 *     endpoint (type-sku / type-location) — type chỉ dùng hiển thị + lọc pop-up.
 *   - Không giỏ chọn SKU tạo lệnh WMS / kế hoạch push (đúng khuôn hasaki-tonbatthuong).
 *
 *  CÔ LẬP (scoping) — theo đúng khuôn hasaki-tonbatthuong.js:
 *   - Closure kín, CHỈ lộ window.HKIEMKE (API cho inline onclick).
 *   - id/class DOM tiền tố hk- ; CSS bơm 1 lần, neo dưới #pane-kk và .hk-modal.
 *   - Màu dùng CSS variables của portal (--panel/--text/--muted/--line/--accent)
 *     -> tự ăn theo các theme sáng/tối sẵn có.
 *
 *  LAZY: host chỉ inject khi người dùng đứng ở HASAKI ▸ Kiểm kê.
 *  API: HKIEMKE.init(paneEl) — idempotent; gọi lại chỉ refresh nếu dữ liệu cũ >5'.
 * ============================================================================
 */
(function(){
"use strict";
if (window.HKIEMKE) return;

/* ===== CẤU HÌNH ===== */
var SHEET_ID = "1FWffWi75aATbokfqIcqjByEPzkJLQBngTXp5aPOIbLM";   // Sheet 5S (kiemsoatkho)
var SHEET_URL = "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/edit";
/* ?src=1: chỉ quản trị mới thấy link Sheet nguồn — dashboard là trang công khai. */
var SHOW_SRC = /[?&]src=1/.test(location.search);
var TAB_SKU = "kiemke-sku-hasaki", TAB_LOC = "kiemke-location-hasaki";
var APPSCRIPT_URL = "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
var STALE_MS = 5 * 60 * 1000;      // init lại: dữ liệu cũ hơn 5' mới tự refresh
var CAP = 300;                     // trần dòng render bảng phiếu trong pop-up
var CAP_REMAIN = 500;              // trần dòng render bảng "Tổng"/"Còn lại"
var ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M7 17L17 7M17 7H9M17 7V15"/></svg>';

/* Bảng màu trạng thái — CHỮ TIẾNG ANH GỐC từ WMS; key so sánh giữ đúng enum data (CANCELED 1 chữ L).
   Màu hex cố định (không dựa palette factory) để chạy ổn trên mọi theme sáng/tối của portal. */
var ST_META = {
  "VERIFIED":            ["VERIFIED", "#10b981"],
  "APPROVED":            ["APPROVED", "#2563eb"],
  "WAITING FOR APPROVE": ["WAITING FOR APPROVE", "#60a5fa"],
  "PROCESSING":          ["PROCESSING", "#f59e0b"],
  "PENDING":             ["PENDING", "#94a3b8"],
  "NOT COUNT":           ["NOT COUNT", "#cbd5e1"],
  "REJECTED":            ["REJECTED", "#ef4444"],
  "CANCELED":            ["CANCELLED", "#fb7185"]
};
var ST_ORDER = ["VERIFIED", "APPROVED", "WAITING FOR APPROVE", "PROCESSING", "PENDING", "NOT COUNT", "REJECTED", "CANCELED"];
/* Màu kho cố định cho 2 kho trước mắt (đồng bộ hasaki-tonbatthuong); kho mới rơi vào bảng màu chung */
var WH_FIX = { "SHOP - 170 QUOC LO 1A": "#2563eb", "WH - 170 QUOC LO 1A": "#0f766e" };
var PAL = ["#f59e0b", "#8b5cf6", "#ef4444", "#10b981", "#ec4899", "#6366f1", "#0891b2", "#84cc16"];
var NHOM_TEN = { PL: "Phụ liệu", NVL: "Nguyên liệu", KHAC: "Nhóm khác", ALL: "chung" };

/* ===== STATE ===== */
var S = { ok: false, data: { sku: [], loc: [] }, wh: "", lastAt: 0, tsData: 0 };
var MODAL = { kind: null, metric: null, rows: [] };
var FC = { kind: null, fc: null, U: "" };
var FC_DP = { view: { y: 0, m: 0 }, selS: "", selE: "", start: "", end: "" };
var PANE = null, _whColor = {}, _whCi = 0, _deb = null, _debT = null, _fcDpBound = false;

/* ===== HELPERS ===== */
var $id = function(s){ return document.getElementById(s); };
function nf(x){ return (x || 0).toLocaleString("vi-VN"); }
function pct(v){ return Number((v || 0).toFixed(2)) + "%"; }
function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
function p2(n){ return (n < 10 ? "0" : "") + n; }
function fmtTime(ms){ var d = new Date(ms);
  return p2(d.getHours()) + ":" + p2(d.getMinutes()) + " " + p2(d.getDate()) + "/" + p2(d.getMonth() + 1) + "/" + d.getFullYear(); }
function whColor(w){ if (WH_FIX[w]) return WH_FIX[w]; if (!_whColor[w]) _whColor[w] = PAL[_whCi++ % PAL.length]; return _whColor[w]; }
function parseDate(s){
  if (!s) return NaN; s = String(s);
  var m = s.match(/^Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?/);
  if (m) return Date.UTC(+m[1], +m[2], +m[3], +m[4] || 0, +m[5] || 0);
  m = s.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})/);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  var t = Date.parse(s); return isNaN(t) ? NaN : t;
}
function fmtD(ms, dateOnly){
  if (isNaN(ms)) return "—";
  var d = new Date(ms), o = p2(d.getUTCDate()) + "/" + p2(d.getUTCMonth() + 1) + "/" + d.getUTCFullYear();
  return dateOnly ? o : o + " " + p2(d.getUTCHours()) + ":" + p2(d.getUTCMinutes());
}
function countMs(r){ var d = parseDate(r.cdate); return isNaN(d) ? parseDate(r.upd) : d; }
function badgeCls(st){ st = String(st || "").toUpperCase();
  if (st === "VERIFIED" || st === "APPROVED") return "ok";
  if (st === "REJECTED" || st === "CANCELED") return "rej";
  if (st === "NOT COUNT" || st === "PENDING") return "pend";
  return "proc";
}
function evalDiff(inv, cnt){ if (cnt == null || cnt === "") return { d: 0, counted: false }; var d = (Number(cnt) || 0) - (Number(inv) || 0); return { d: d, counted: true }; }
function stKey(r){ return String(r.st || "").trim().toUpperCase() || "NOT COUNT"; }
function stMeta(s){ return ST_META[s] || [s, PAL[s.length % PAL.length]]; }
function dash(v){ return v ? esc(v) : "—"; }
function dcell(d){ return '<td class="num ' + (d < 0 ? "d-am" : d > 0 ? "d-duong" : "d-khop") + '">' + (d > 0 ? "+" : "") + nf(d) + "</td>"; }
function emptyRow(n){ return '<tr><td colspan="' + n + '" style="text-align:center;color:var(--muted,#9ca3af);padding:28px;white-space:normal">Không có dòng phù hợp</td></tr>'; }
/* Định tuyến URL WMS theo ngữ cảnh — location KHÔNG có /detail/, sku CÓ /detail/ (y hệt factory) */
function idLink(id, kind){
  if (!id) return "—";
  var url = (kind === "loc")
    ? "https://wms.inshasaki.com/physical-count/result/location/" + encodeURIComponent(id) + "?page=1&size=20"
    : "https://wms.inshasaki.com/physical-count/result/sku/detail/" + encodeURIComponent(id) + "?page=1&size=20";
  return '<a class="hk-wlink" href="' + url + '" target="_blank" rel="noopener">' + esc(id) + ICON + "</a>";
}
function median(a){ if (!a || !a.length) return null; a = a.slice().sort(function(x, y){ return x - y; }); var m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }
function nhomCat(c){ c = String(c || "").toLowerCase();
  if (/phụ liệu|phu lieu/.test(c)) return "PL";
  if (/nvl|nguyên liệu|nguyen lieu/.test(c)) return "NVL";
  return "KHAC";
}
var VN_OFFSET = 7 * 60 * 60 * 1000;
function vnDate(ms){ return new Date(ms + VN_OFFSET); }   // sau đó CHỈ đọc bằng getUTC* = giờ VN
function todayMsVN(){ var n = vnDate(Date.now()); return Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()); }
function dayStr(ms){ var t = new Date(ms); return t.getUTCFullYear() + "-" + p2(t.getUTCMonth() + 1) + "-" + p2(t.getUTCDate()); }
/* ETA từ NGÀY BẮT ĐẦU tuỳ chọn, Chủ nhật nghỉ */
function etaFrom(startMs, soNgayLam){ var d = startMs, lam = 0; for (var i = 0; i <= 800 && lam < soNgayLam; i++){ d = startMs + i * 86400000; if (new Date(d).getUTCDay() !== 0) lam++; } return d; }
function fcFmt(ms){ var t = new Date(ms), nay = new Date(todayMsVN());
  return p2(t.getUTCDate()) + "/" + p2(t.getUTCMonth() + 1) + (t.getUTCFullYear() !== nay.getUTCFullYear() ? ("/" + t.getUTCFullYear()) : ""); }
function swap(el){ if (!el) return; el.classList.remove("hk-swap"); void el.offsetWidth; el.classList.add("hk-swap"); }

/* ===== CSS — bơm 1 lần, neo #pane-kk / .hk-modal, token màu theo theme host ===== */
var CSS = [
"#pane-kk .hk-srcbar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:14px 0 10px;font-size:12.5px;}",
/* nguồn/mô tả/Làm mới ĐƯA XUỐNG CHÂN tab — đồng bộ footer với các tab native */
"#pane-kk .hk-srcfoot{margin-top:22px;padding-top:14px;border-top:1px solid var(--border,#e8ecf1);text-align:center;}",
"#pane-kk .hk-srcfoot .hk-srcbar{margin:0 0 6px;justify-content:center;font-size:12px;}",
"#pane-kk .hk-srcfoot .hk-hint{display:inline;}",
"#pane-kk .hk-chip{background:color-mix(in srgb, var(--accent,#326e51) 14%, transparent);color:var(--accent,#326e51);border-radius:999px;padding:4px 13px;font-weight:650;font-size:12px;}",
"#pane-kk .hk-srcbar a{color:var(--accent,#326e51);text-decoration:none;font-weight:600;} #pane-kk .hk-srcbar a:hover{text-decoration:underline;}",
"#pane-kk .hk-hint,.hk-modal .hk-hint{color:var(--muted,#9ca3af);font-size:11.5px;font-weight:400;letter-spacing:0;text-transform:none;}",
"#hkReload{background:var(--accent,#326e51);color:var(--accent-text,#fff);border:0;border-radius:9px;padding:8px 15px;font-size:12.5px;font-weight:650;cursor:pointer;min-height:36px;}",
"#hkReload:disabled{background:color-mix(in srgb, var(--muted,#9ca3af) 42%, var(--surface,#fff));color:var(--muted,#9ca3af);cursor:not-allowed;}",
/* chip lọc kho (cross-filter cấp tab) */
"#pane-kk .hk-whbar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 12px;}",
"#pane-kk .hk-whtab{border:1px solid var(--border,#e8ecf1);background:var(--surface,#fff);color:var(--text,#374151);border-radius:999px;padding:6px 13px;font-size:12px;font-weight:600;cursor:pointer;min-height:32px;display:inline-flex;align-items:center;gap:7px;transition:background .16s ease,border-color .16s ease;}",
"#pane-kk .hk-whtab:hover{background:color-mix(in srgb, var(--accent,#326e51) 8%, transparent);}",
"#pane-kk .hk-whtab.active{background:var(--accent,#326e51);color:var(--accent-text,#fff);border-color:var(--accent,#326e51);}",
"#pane-kk .hk-dot,.hk-modal .hk-dot{display:inline-block;width:9px;height:9px;border-radius:50%;flex:none;vertical-align:middle;}",
/* lưới 2 khối song song + panel */
"#pane-kk .hk-grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;}",
"@media(max-width:1024px){#pane-kk .hk-grid2{grid-template-columns:1fr;}}",
"#pane-kk .hk-panel{background:var(--surface,#fff);border:1px solid var(--border,#e8ecf1);border-radius:14px;padding:14px 16px;display:flex;flex-direction:column;min-width:0;}",
"#pane-kk .hk-span2{grid-column:1/-1;display:block;}",
"@media(max-width:1024px){#pane-kk .hk-span2{grid-column:auto;}}",
"#pane-kk .hk-panel h2{margin:0 0 10px;font-size:14px;font-weight:680;color:var(--text,#374151);display:flex;align-items:center;gap:8px;flex-wrap:wrap;}",
"#pane-kk .hk-scope{background:color-mix(in srgb,var(--accent,#326e51) 14%,transparent);color:var(--accent,#326e51);border-radius:999px;padding:2px 10px;font-size:10.5px;font-weight:750;}",
/* Dải chỉ số — ĐỒNG BỘ mẫu thẻ KPI với planogram/tồn bất thường (thẻ surface, viền trái accent, số đậm) */
"#pane-kk .hk-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:6px 0 16px;}",
"#pane-kk .hk-strip .ks{background:var(--surface,#fff);border:1px solid var(--border,#e8ecf1);border-left:4px solid var(--accent,#326e51);border-radius:10px;padding:9px 12px;cursor:pointer;transition:transform .16s cubic-bezier(.32,.72,0,1),box-shadow .25s ease;}",
"#pane-kk .hk-strip .ks:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(16,24,40,.12);}",
"#pane-kk .hk-strip .v{font-size:20px;font-weight:780;letter-spacing:-.01em;line-height:1;font-variant-numeric:tabular-nums;color:var(--text,#1f2937);}",
"#pane-kk .hk-strip .t{font-size:11px;font-weight:650;letter-spacing:.01em;color:var(--muted,#9ca3af);margin-top:4px;line-height:1.2;white-space:normal;overflow:hidden;text-overflow:ellipsis;}",
"#pane-kk .hk-strip .v.ok{color:#059669;} #pane-kk .hk-strip .v.mut{color:var(--muted,#9ca3af);} #pane-kk .hk-strip .v.neg{color:#dc2626;} #pane-kk .hk-strip .v.pos{color:var(--accent,#326e51);}",
"#pane-kk .hk-strip .v.fce{color:var(--accent,#326e51);font-weight:780;}",
/* Thanh trạng thái 100% + pill trạng thái */
"#pane-kk .hk-stbar{display:flex;height:8px;border-radius:99px;overflow:hidden;background:color-mix(in srgb, var(--muted,#9ca3af) 16%, transparent);margin:2px 0 10px;}",
"#pane-kk .hk-stbar i{display:block;height:100%;min-width:2px;} #pane-kk .hk-stbar i+i{margin-left:2px;}",
"#pane-kk .hk-stchips{display:flex;flex-wrap:wrap;gap:6px;}",
"#pane-kk .hk-stchip{display:inline-flex;align-items:center;gap:6px;border:0;border-radius:99px;padding:4px 11px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;background:color-mix(in srgb,var(--cc) 14%,transparent);color:color-mix(in srgb,var(--cc) 62%,var(--text,#1f2937));transition:background .18s ease;}",
"#pane-kk .hk-stchip:hover{background:color-mix(in srgb,var(--cc) 26%,transparent);}",
"#pane-kk .hk-stchip .dot2{width:7px;height:7px;border-radius:50%;background:var(--cc);flex:none;}",
"#pane-kk .hk-stchip b{font-variant-numeric:tabular-nums;font-weight:750;color:inherit;}",
/* Chart "Đã kiểm theo ngày": cột chồng theo kho + hàng delta so với ngày kề trước */
"#pane-kk .hk-dhead{font-size:12px;font-weight:650;color:var(--text,#374151);margin:14px 0 8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;}",
"#pane-kk .hk-legend{display:inline-flex;flex-wrap:wrap;gap:3px 10px;font-weight:400;font-size:10.5px;color:var(--muted,#6b7280);}",
"#pane-kk .hk-legend .sw{width:9px;height:9px;border-radius:3px;display:inline-block;margin-right:4px;vertical-align:middle;}",
"#pane-kk .hk-daily{min-height:220px;display:flex;flex-direction:column;justify-content:flex-end;margin-top:auto;}",
"#pane-kk .hk-histscroll{overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:2px;}",
"#pane-kk .hk-histchart{display:flex;align-items:flex-end;gap:8px;padding-top:4px;position:relative;}",
"#pane-kk .hk-histchart::after{content:'';position:absolute;left:0;right:0;bottom:30px;border-top:1px solid var(--border,#e8ecf1);}",
"#pane-kk .hk-hcol{flex:0 0 34px;display:flex;flex-direction:column;align-items:center;cursor:default;}",
"#pane-kk .hk-hval{font-size:10px;font-weight:650;color:var(--text,#374151);font-variant-numeric:tabular-nums;line-height:1.2;margin-bottom:2px;min-height:12px;white-space:nowrap;}",
"#pane-kk .hk-hbars{width:22px;height:150px;display:flex;flex-direction:column;justify-content:flex-end;}",
"#pane-kk .hk-hseg{width:100%;min-height:0;transition:height .8s ease;}",
"#pane-kk .hk-hseg.top{border-radius:4px 4px 0 0;} #pane-kk .hk-hseg+.hk-hseg{margin-top:2px;}",
"#pane-kk .hk-hcol:hover .hk-hseg{filter:brightness(1.12);}",
"#pane-kk .hk-hdate{font-size:9.5px;color:var(--muted,#9ca3af);margin-top:4px;white-space:nowrap;}",
"#pane-kk .hk-hdelta{font-size:9.5px;font-weight:750;line-height:1.3;min-height:13px;font-variant-numeric:tabular-nums;}",
/* SÀN CỠ CHỮ ĐIỆN THOẠI: hai dòng này là NGÀY và MỨC LỆCH dưới mỗi cột biểu đồ — nhãn cho biết
   cột đó là ngày nào, lệch bao nhiêu. 9,5px trên máy cầm tay là phải nhíu mắt. Nâng 10,5px ở
   ≤768px, bản máy tính giữ nguyên mật độ. Bộ đo qc-mobile-toan-du-an bắt được (35 + 31 chỗ). */
"@media(max-width:768px){#pane-kk .hk-hdate,#pane-kk .hk-hdelta{font-size:10.5px;}}",
"#pane-kk .hk-histempty{color:var(--muted,#9ca3af);font-size:12px;padding:14px 2px;}",
/* Panel "Tiến độ theo kho" — thẻ kho bấm để lọc chéo toàn tab */
"#pane-kk .hk-whlist{display:grid;grid-template-columns:repeat(auto-fill,minmax(272px,1fr));gap:12px;max-height:400px;overflow-y:auto;padding-right:6px;}",
"@media(max-width:720px){#pane-kk .hk-whlist{grid-template-columns:1fr;}}",
"#pane-kk .hk-whcard{background:var(--surface,#fff);border:1px solid var(--border,#e8ecf1);border-radius:10px;padding:8px 12px;cursor:pointer;transition:box-shadow .2s ease,background .2s ease;}",
"#pane-kk .hk-whcard:hover{box-shadow:0 8px 24px rgba(16,24,40,.12);}",
"#pane-kk .hk-whcard.active{border-color:var(--accent,#326e51);box-shadow:0 0 0 1px var(--accent,#326e51);}",
"#pane-kk .hk-whtop{display:flex;flex-direction:column;align-items:flex-start;gap:2px;font-size:12px;margin-bottom:3px;}",
"#pane-kk .hk-whname{font-weight:600;line-height:1.25;display:flex;align-items:center;gap:7px;color:var(--text,#1f2937);min-width:0;word-break:normal;overflow-wrap:anywhere;}",
"#pane-kk .hk-whnum{color:var(--muted,#6b7280);font-size:11.5px;white-space:nowrap;font-variant-numeric:tabular-nums;} #pane-kk .hk-whnum b{color:var(--text,#1f2937);}",
"#pane-kk .hk-prog{background:color-mix(in srgb, var(--muted,#9ca3af) 16%, transparent);border-radius:99px;height:6px;margin:5px 0 4px;overflow:hidden;}",
"#pane-kk .hk-progf{height:100%;border-radius:99px;width:0;transition:width .9s ease;}",
"#pane-kk .hk-whsub2{font-size:11px;color:var(--muted,#6b7280);margin-top:2px;}",
/* trạng thái tải */
"#pane-kk .hk-state{padding:56px 20px;text-align:center;color:var(--muted,#6b7280);}",
"#pane-kk .hk-spin{width:32px;height:32px;border:3px solid var(--border,#d5dbe4);border-top-color:var(--accent,#326e51);border-radius:50%;margin:0 auto 16px;animation:hk-sp .8s linear infinite;}",
"@keyframes hk-sp{to{transform:rotate(360deg)}}",
".hk-swap{animation:hk-in .3s ease both;}",
"@keyframes hk-in{from{opacity:0;transform:translate3d(0,8px,0)}to{opacity:1;transform:none}}",
"#pane-kk .hk-fade{animation:hk-in .45s cubic-bezier(.32,.72,0,1) both;}",
/* modal — gắn ở body (khuôn ht-modal) */
".hk-modal{display:none;position:fixed;inset:0;background:rgba(17,24,39,.55);backdrop-filter:blur(6px);z-index:1200;align-items:center;justify-content:center;padding:18px;opacity:0;transition:opacity .22s;}",
".hk-modal.show{opacity:1;}",
".hk-modalbox{background:var(--surface,#fff);color:var(--text,#1f2937);border-radius:18px;width:min(1280px,96vw);max-height:90vh;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(16,24,40,.3);transform:translateY(12px) scale(.985);opacity:.6;transition:transform .26s,opacity .26s;will-change:transform;}",
".hk-modal.show .hk-modalbox{transform:none;opacity:1;}",
".hk-modalbox.fcbox{width:min(1080px,96vw);}",
".hk-modalhd{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--border,#e8ecf1);}",
".hk-modalhd .mt{font-weight:700;font-size:15.5px;} .hk-modalhd .mtsub{font-size:11.5px;color:var(--muted,#9ca3af);margin-top:2px;}",
".hk-mclose{background:0;border:0;font-size:24px;line-height:1;cursor:pointer;color:var(--muted,#9ca3af);padding:6px 10px;border-radius:8px;min-width:44px;min-height:40px;}",
".hk-mclose:hover{color:#ef4444;background:color-mix(in srgb,#ef4444 12%,transparent);}",
".hk-mfilters{display:flex;flex-wrap:wrap;gap:6px 8px;padding:12px 20px;border-bottom:1px solid var(--border,#e8ecf1);}",
".hk-mfilters .fld{flex:1 1 190px;min-width:170px;display:flex;flex-direction:column;gap:3px;}",
".hk-mfilters .fld.q{flex:2 1 250px;}",
".hk-mfilters label{font-size:10px;font-weight:650;color:var(--muted,#9ca3af);text-transform:uppercase;letter-spacing:.04em;}",
".hk-mfilters input{padding:9px 10px;border:1px solid var(--border,#d5dbe4);border-radius:9px;font-size:12.5px;background:var(--surface,#fff);color:var(--text,#1f2937);width:100%;min-height:38px;}",
".hk-mfilters input:focus{outline:0;border-color:var(--accent,#326e51);}",
".hk-combo{position:relative;}",
".hk-combo-menu{position:absolute;top:calc(100% + 5px);left:0;right:0;z-index:40;background:var(--surface,#fff);border:1px solid var(--border,#e8ecf1);border-radius:11px;box-shadow:0 24px 60px rgba(16,24,40,.28);max-height:250px;overflow-y:auto;overscroll-behavior:contain;padding:5px;opacity:0;visibility:hidden;transform:translateY(-6px);transition:.16s;}",
".hk-combo-menu.show{opacity:1;visibility:visible;transform:none;}",
".hk-combo-item{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 11px;border-radius:8px;font-size:12.5px;cursor:pointer;color:var(--text,#1f2937);white-space:nowrap;overflow:hidden;}",
".hk-combo-item .nm{overflow:hidden;text-overflow:ellipsis;} .hk-combo-item .c{color:var(--muted,#9ca3af);font-size:11px;flex:none;}",
".hk-combo-item:hover{background:color-mix(in srgb, var(--accent,#326e51) 10%, transparent);color:var(--accent,#326e51);}",
".hk-combo-item.all{border-bottom:1px solid var(--border,#e8ecf1);font-weight:600;}",
".hk-combo-empty{padding:12px;font-size:12px;color:var(--muted,#9ca3af);text-align:center;}",
".hk-msum{padding:9px 20px;font-size:12px;color:var(--muted,#6b7280);border-bottom:1px solid var(--border,#e8ecf1);font-variant-numeric:tabular-nums;}",
".hk-modalbody{overflow:auto;padding:12px 20px 20px;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;}",
"#hkKkBody{transition:opacity .3s ease-in;} #hkKkBody.is-filtering{opacity:.5;pointer-events:none;}",
/* bảng trong pop-up: sticky header, CẤM cuộn ngang — cột dài tự bẻ dòng (khuôn #kkmodal factory) */
".hk-wrap{max-height:62vh;overflow:auto;overflow-x:hidden;border:1px solid var(--border,#e8ecf1);border-radius:8px;}",
".hk-wrap table{width:100%;border-collapse:collapse;font-size:12px;min-width:0;color:var(--text,#1f2937);}",
".hk-wrap thead th{position:sticky;top:0;z-index:2;background:var(--accent,#326e51);color:var(--accent-text,#fff);font-size:11px;font-weight:600;text-align:left;padding:9px 11px;white-space:nowrap;}",
".hk-wrap tbody td{padding:8px 11px;border-bottom:1px solid var(--border,#f1f4f8);white-space:normal;word-wrap:break-word;vertical-align:top;}",
".hk-wrap tbody tr:hover td{background:color-mix(in srgb, var(--accent,#326e51) 6%, transparent);}",
".hk-wrap .pn2{white-space:normal;min-width:140px;max-width:280px;color:var(--muted,#6b7280);line-height:1.35;font-size:11.5px;}",
".hk-wrap .num{text-align:right!important;font-variant-numeric:tabular-nums;white-space:nowrap;}",
".hk-wrap .d-am{color:#ef4444;font-weight:700;} .hk-wrap .d-duong{color:#2563eb;font-weight:700;} .hk-wrap .d-khop{color:var(--muted,#9ca3af);}",
".hk-badge{display:inline-block;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:650;white-space:nowrap;}",
".hk-badge.ok{background:color-mix(in srgb,#10b981 16%,transparent);color:#059669;} .hk-badge.proc{background:color-mix(in srgb,#f59e0b 18%,transparent);color:#b45309;}",
".hk-badge.pend{background:color-mix(in srgb,#94a3b8 20%,transparent);color:#64748b;} .hk-badge.rej{background:color-mix(in srgb,#ef4444 15%,transparent);color:#b91c1c;}",
".hk-wlink{color:var(--accent,#326e51);text-decoration:none;font-weight:600;display:inline-flex;align-items:center;gap:3px;}",
".hk-wlink:hover{text-decoration:underline;} .hk-wlink svg{width:11px;height:11px;}",
".hk-note{padding:8px 2px 0;font-size:11.5px;color:var(--muted,#9ca3af);}",
/* Pop-up Dự báo hoàn thành: 2 tầng ① máy tự tính | ② người chọn cạnh nhau */
".hk-fcwrap{padding:16px 22px 22px;display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start;overflow:auto;}",
".hk-fcwrap.one{grid-template-columns:1fr;}",
"@media(max-width:820px){.hk-fcwrap{grid-template-columns:1fr;}}",
".hk-fcsec{border:1px solid var(--border,#e8ecf1);border-radius:12px;padding:14px 16px;background:color-mix(in srgb, var(--muted,#9ca3af) 6%, var(--surface,#fff));margin:0;}",
".hk-fcsec h3{margin:0 0 10px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted,#9ca3af);font-weight:750;}",
".hk-fchero{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;}",
".hk-fchero .d{font-size:26px;font-weight:800;color:var(--accent,#326e51);font-variant-numeric:tabular-nums;letter-spacing:-.02em;}",
".hk-fchero .d.bad{color:#ef4444;} .hk-fchero .d.ok{color:#10b981;}",
".hk-fchero .n{font-size:12.5px;color:var(--text,#374151);}",
".hk-fcfacts{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-top:12px;}",
".hk-fcfact{background:var(--surface,#fff);border:1px solid var(--border,#e8ecf1);border-radius:9px;padding:8px 11px;}",
".hk-fcfact b{display:block;font-size:14px;font-variant-numeric:tabular-nums;color:var(--text,#1f2937);}",
".hk-fcfact span{font-size:9.5px;color:var(--muted,#9ca3af);text-transform:uppercase;letter-spacing:.04em;}",
".hk-fcctl{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:2px 0 12px;}",
"@media(max-width:560px){.hk-fcctl{grid-template-columns:1fr;}}",
".hk-fcctl label{display:flex;flex-direction:column;gap:5px;font-size:10px;font-weight:750;letter-spacing:.06em;text-transform:uppercase;color:var(--muted,#9ca3af);}",
".hk-fcctl input{padding:8px 10px;border:1px solid var(--border,#d5dbe4);border-radius:9px;background:var(--surface,#fff);color:var(--text,#1f2937);font-size:13px;font-family:inherit;}",
".hk-fccombo{position:relative;text-transform:none;letter-spacing:0;font-weight:400;}",
".hk-fccombo input{cursor:pointer;width:100%;padding-right:28px;text-overflow:ellipsis;}",
".hk-fccombo::after{content:\"\";position:absolute;right:12px;top:50%;width:7px;height:7px;margin-top:-5px;border-right:1.6px solid var(--muted,#9ca3af);border-bottom:1.6px solid var(--muted,#9ca3af);transform:rotate(45deg);pointer-events:none;transition:transform .2s ease;}",
".hk-fccombo.open::after{transform:rotate(-135deg);margin-top:-1px;}",
".hk-fcgroups{display:flex;gap:6px;flex-wrap:wrap;}",
".hk-fcg{border:1px solid var(--border,#d5dbe4);background:var(--surface,#fff);border-radius:999px;padding:5px 13px;font-size:12px;font-weight:650;cursor:pointer;color:var(--text,#374151);font-family:inherit;transition:background .15s ease,color .15s ease;}",
".hk-fcg.on{background:var(--accent,#326e51);border-color:var(--accent,#326e51);color:var(--accent-text,#fff);}",
".hk-fcneed{font-size:12.5px;color:var(--text,#1f2937);margin-top:8px;font-weight:600;}",
/* Bộ chọn KHOẢNG NGÀY (bắt đầu → hạn chót) — bê pattern "Ngày ghi nhận" kiemsoatkho */
".hk-fcdate{position:relative;text-transform:none;letter-spacing:0;font-weight:400;display:block;}",
".hk-fcdate .date-btn{width:100%;text-align:left;cursor:pointer;padding:8px 30px 8px 10px;border:1px solid var(--border,#d5dbe4);border-radius:9px;background:var(--surface,#fff);color:var(--text,#1f2937);font-size:13px;font-family:inherit;}",
".hk-fcdate .date-btn:hover{border-color:var(--accent,#326e51);}",
".hk-fcdate::after{content:\"\";position:absolute;right:12px;top:19px;width:7px;height:7px;margin-top:-5px;border-right:1.6px solid var(--muted,#9ca3af);border-bottom:1.6px solid var(--muted,#9ca3af);transform:rotate(45deg);pointer-events:none;transition:transform .2s ease;}",
".hk-fcdate.open::after{transform:rotate(-135deg);margin-top:-1px;}",
".hk-datepop{position:fixed;z-index:1300;background:var(--surface,#fff);border:1px solid var(--border,#e8ecf1);border-radius:12px;box-shadow:0 24px 60px rgba(16,24,40,.3);padding:12px;width:max-content;max-width:96vw;overflow:auto;color:var(--text,#1f2937);}",
".hk-datepop.hidden{display:none;}",
".hk-datepop button{border:1px solid var(--border,#d5dbe4);background:var(--surface,#fff);color:var(--text,#1f2937);border-radius:8px;cursor:pointer;font-family:inherit;font-size:12px;padding:5px 12px;font-weight:500;}",
".hk-datepop button:hover{border-color:var(--accent,#326e51);}",
".hk-datepop button.primary{background:var(--accent,#326e51);border-color:var(--accent,#326e51);color:var(--accent-text,#fff);font-weight:650;}",
".hk-datepop .dp-presets{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;} .hk-datepop .dp-presets button{border-radius:16px;padding:5px 10px;}",
".hk-datepop .dp-nav{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px;}",
".hk-datepop .dp-months{display:flex;gap:20px;}",
".hk-datepop .dp-mtitle{text-align:center;font-size:12.5px;font-weight:700;margin-bottom:6px;}",
".hk-datepop .dp-grid{display:grid;grid-template-columns:repeat(7,32px);gap:2px;}",
".hk-datepop .dp-dow{font-size:10px;color:var(--muted,#9ca3af);text-align:center;height:22px;line-height:22px;font-weight:600;}",
".hk-datepop .dp-day{height:32px;display:flex;align-items:center;justify-content:center;font-size:12px;border-radius:7px;cursor:pointer;user-select:none;}",
".hk-datepop .dp-day:hover{background:color-mix(in srgb, var(--accent,#326e51) 10%, transparent);}",
".hk-datepop .dp-day.out{opacity:.35;}",
".hk-datepop .dp-day.in-range{background:color-mix(in srgb,var(--accent,#326e51) 14%,transparent);}",
".hk-datepop .dp-day.edge{background:var(--accent,#326e51);color:var(--accent-text,#fff);font-weight:700;}",
".hk-datepop .dp-day.today{box-shadow:inset 0 0 0 1px var(--accent,#326e51);}",
".hk-datepop .dp-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:10px;border-top:1px solid var(--border,#e8ecf1);padding-top:10px;}",
".hk-datepop .dp-foot .dpsel{font-size:12px;color:var(--muted,#9ca3af);} .hk-datepop .dp-foot button{margin-left:6px;}",
"@media(max-width:640px){.hk-datepop .dp-months{flex-direction:column;gap:14px;}}",
/* mobile: modal tràn màn hình, touch ≥44px */
"@media(max-width:768px){.hk-modal{padding:0;align-items:stretch;justify-content:stretch;}.hk-modalbox{width:100vw!important;max-height:100vh!important;height:100vh;border-radius:0;}.hk-mclose{font-size:30px;min-width:48px;min-height:48px;}.hk-mfilters input{min-height:44px;}#pane-kk .hk-whtab{min-height:44px;}#hkReload{min-height:44px;width:100%;}}"
].join("\n");

/* ===== KHUNG HTML ===== */
var KHUNG =
'<div class="hk-whbar" id="hkWhBar"></div>' +
'<div class="hk-grid2" id="hkGrid" style="display:none">' +
'  <section class="hk-panel">' +
'    <h2>Kiểm kê theo SKU <span class="hk-hint">(type SKU)</span> <span class="hk-scope" id="hkScope-sku" hidden></span></h2>' +
'    <div class="hk-strip" id="hkStrip-sku"></div>' +
'    <div id="hkStatus-sku"></div>' +
'    <div class="hk-dhead">Đã kiểm theo ngày <span class="hk-legend" id="hkLegend-sku"></span></div>' +
'    <div class="hk-daily" id="hkHist-sku"></div>' +
'  </section>' +
'  <section class="hk-panel">' +
'    <h2>Kiểm kê theo mã vị trí <span class="hk-hint">(type Location · Full location)</span> <span class="hk-scope" id="hkScope-loc" hidden></span></h2>' +
'    <div class="hk-strip" id="hkStrip-loc"></div>' +
'    <div id="hkStatus-loc"></div>' +
'    <div class="hk-dhead">Đã kiểm theo ngày <span class="hk-legend" id="hkLegend-loc"></span></div>' +
'    <div class="hk-daily" id="hkHist-loc"></div>' +
'  </section>' +
'  <section class="hk-panel hk-span2"><h2>Tiến độ theo kho</h2><div class="hk-whlist" id="hkWhList"></div></section>' +
'</div>' +
'<div id="hkState" class="hk-state"><div class="hk-spin"></div>Đang tải dữ liệu kiểm kê…</div>' +
'<div class="hk-srcfoot">' +
'  <div class="hk-srcbar">' +
'    <span class="hk-chip">Kiểm kê (Physical Count) — Hasaki Vietnam · SHOP + WH 170 QL1A</span>' +
(SHOW_SRC ? '    <a href="' + SHEET_URL + '" target="_blank" rel="noopener">Mở Google Sheet</a>' : '') +
'    <span id="hkLoadinfo" class="hk-hint"></span>' +
'    <button id="hkReload" onclick="HKIEMKE.reload()" title="Đọc lại dữ liệu mới nhất từ Google Sheet">Làm mới</button>' +
'  </div>' +
'  <p class="hk-hint" style="margin:0">Dữ liệu phiếu <b>physical-count</b> WMS (type SKU + type Location) — cụm đồng bộ 8h40 ghi tab <code>' + TAB_SKU + '</code> / <code>' + TAB_LOC + '</code>. "Tổng" = distinct (kho|mã) trong phiếu · "Còn lại" = mã chưa có phiếu đã kiểm · bấm số để xem danh sách chi tiết.</p>' +
'</div>';

var MODAL_HTML =
/* Pop-up chi tiết (drill-down): bảng CHỈ dựng DOM lúc bấm — lazy như factory */
'<div id="hkKkModal" class="hk-modal">' +
'  <div class="hk-modalbox">' +
'    <div class="hk-modalhd"><div><div class="mt" id="hkKkTitle"></div><div class="mtsub" id="hkKkSub"></div></div>' +
'      <button class="hk-mclose" onclick="HKIEMKE.closeModal()">&times;</button></div>' +
'    <div class="hk-mfilters" id="hkKkFilters"></div>' +
'    <div class="hk-msum" id="hkKkSum"></div>' +
'    <div class="hk-modalbody" id="hkKkBody"></div>' +
'  </div>' +
'</div>' +
/* Pop-up Dự báo hoàn thành: ① máy tự tính từ quá khứ, ② người chọn mô phỏng nhân sự/nhóm hàng */
'<div id="hkFcModal" class="hk-modal">' +
'  <div class="hk-modalbox fcbox">' +
'    <div class="hk-modalhd"><div><div class="mt" id="hkFcTitle"></div><div class="mtsub" id="hkFcSub"></div></div>' +
'      <button class="hk-mclose" onclick="HKIEMKE.closeFc()">&times;</button></div>' +
'    <div class="hk-fcwrap" id="hkFcBody"></div>' +
'  </div>' +
'</div>';

/* ===== TẢI DỮ LIỆU (gviz JSONP — callback tiền tố hkgv_, không đụng host) ===== */
function gvizP(sheet, cb){
  return new Promise(function(res){
    window[cb] = function(resp){ res(resp); };
    var old = $id("hk_sc_" + cb); if (old) old.remove();
    var s = document.createElement("script"); s.id = "hk_sc_" + cb;
    s.src = "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/gviz/tq?tqx=out:json;responseHandler:" + cb + "&sheet=" + encodeURIComponent(sheet) + "&headers=1";
    s.onerror = function(){ res(null); };
    document.body.appendChild(s);
  });
}
function idxOf(H, names){ for (var i = 0; i < names.length; i++){ var j = H.indexOf(names[i].toLowerCase()); if (j >= 0) return j; } return -1; }
/* Mapping cột theo header — Y HỆT factory (2 tab do push-pc-to-sheet.mjs ghi cùng HEADER) */
function mapRows(kind, H, rows){
  var g = function(r, i){ return i >= 0 && r[i] != null ? r[i] : ""; };
  if (kind === "sku"){
    var c = { id: idxOf(H, ["ID"]), req: idxOf(H, ["Request code"]), wh: idxOf(H, ["Warehouse"]), sku: idxOf(H, ["SKU"]), pn: idxOf(H, ["Product Name"]), cat: idxOf(H, ["Category"]), type: idxOf(H, ["Type"]), inv: idxOf(H, ["Inventory"]), cnt: idxOf(H, ["Quantity Count"]), by: idxOf(H, ["Counted by"]), cdate: idxOf(H, ["Counted date"]), upd: idxOf(H, ["Updated At"]), plan: idxOf(H, ["Plan Date"]), st: idxOf(H, ["Status"]) };
    if (c.sku < 0 || c.wh < 0) return null;   // tab chưa có / sai nguồn
    return rows.filter(function(r){ return String(g(r, c.sku)) !== ""; }).map(function(r){ return { id: String(g(r, c.id)), req: String(g(r, c.req)), wh: String(g(r, c.wh)), sku: String(g(r, c.sku)), pn: String(g(r, c.pn)), cat: String(g(r, c.cat)), type: String(g(r, c.type)), inv: Number(g(r, c.inv)) || 0, cnt: (g(r, c.cnt) === "" ? null : Number(g(r, c.cnt)) || 0), by: String(g(r, c.by)), cdate: String(g(r, c.cdate)), upd: String(g(r, c.upd)), plan: String(g(r, c.plan)), st: String(g(r, c.st)) }; });
  }
  var d = { id: idxOf(H, ["ID"]), req: idxOf(H, ["Request code"]), wh: idxOf(H, ["Warehouse"]), type: idxOf(H, ["Type"]), loc: idxOf(H, ["Location"]), pri: idxOf(H, ["Priority"]), diff: idxOf(H, ["Diff"]), by: idxOf(H, ["Counted by"]), cdate: idxOf(H, ["Counted date"]), upd: idxOf(H, ["Updated At"]), plan: idxOf(H, ["Plan Date"]), st: idxOf(H, ["Status"]) };
  if (d.loc < 0 || d.wh < 0) return null;
  return rows.filter(function(r){ return String(g(r, d.loc)) !== ""; }).map(function(r){ return { id: String(g(r, d.id)), req: String(g(r, d.req)), wh: String(g(r, d.wh)), type: String(g(r, d.type)), loc: String(g(r, d.loc)), pri: String(g(r, d.pri)), diff: Number(g(r, d.diff)) || 0, by: String(g(r, d.by)), cdate: String(g(r, d.cdate)), upd: String(g(r, d.upd)), plan: String(g(r, d.plan)), st: String(g(r, d.st)) }; });
}
function parseResp(kind, resp){
  try{
    if (!resp || resp.status === "error") return null;
    var H = ((resp.table && resp.table.cols) || []).map(function(c){ return String((c && c.label) || "").replace(/\s+/g, " ").trim().toLowerCase(); });
    var rows = ((resp.table && resp.table.rows) || []).map(function(r){ return (r.c || []).map(function(c){ return c ? (c.v == null ? "" : c.v) : ""; }); });
    return mapRows(kind, H, rows);
  }catch(e){ return null; }
}
function loadData(){
  var st = $id("hkState"); if (!st) return;
  var btn = $id("hkReload"); if (btn) btn.disabled = true;
  st.style.display = "block";
  st.innerHTML = '<div class="hk-spin"></div>Đang tải dữ liệu kiểm kê…';
  $id("hkGrid").style.display = "none"; $id("hkWhBar").innerHTML = "";
  S.lastAt = Date.now();
  Promise.all([gvizP(TAB_SKU, "hkgv_sku"), gvizP(TAB_LOC, "hkgv_loc")]).then(function(res){
    var sku = parseResp("sku", res[0]), loc = parseResp("loc", res[1]);
    S.ok = !!(sku || loc);
    S.data = { sku: sku || [], loc: loc || [] };
    render();
  });
  loadMeta();
}
/* Chip giờ dữ liệu: hỏi GAS lastSync (mốc apiAt lúc bộ sync LẤY từ WMS) — JSONP */
function loadMeta(){
  window.hkgv_last = function(j){ try{ if (j && j.status === "success" && Number(j.ts) > 0){ S.tsData = Number(j.ts); capNhatInfo(); } }catch(e){} };
  var old = $id("hk_sc_meta"); if (old) old.remove();
  var sc = document.createElement("script"); sc.id = "hk_sc_meta";
  sc.src = APPSCRIPT_URL + "?action=lastSync&tab=" + encodeURIComponent(TAB_SKU) + "&callback=hkgv_last";
  sc.onerror = function(){};
  document.body.appendChild(sc);
}
function capNhatInfo(){
  var el = $id("hkLoadinfo"); if (!el) return;
  var n = S.data.sku.length + S.data.loc.length;
  el.textContent = (n ? nf(S.data.sku.length) + " phiếu SKU · " + nf(S.data.loc.length) + " phiếu vị trí" : "") +
    (S.tsData ? (n ? " · " : "") + "dữ liệu WMS lúc " + fmtTime(S.tsData) : "");
}

/* ===== MÔ HÌNH DỮ LIỆU (cross-filter kho + khử trùng phiếu — port từ factory) ===== */
function rowsScope(kind){ var rs = S.data[kind]; return S.wh ? rs.filter(function(r){ return r.wh === S.wh; }) : rs; }
function keyOf(kind, r){ return r.wh + "|" + ((kind === "sku") ? r.sku : r.loc); }
/* "Đã kiểm" (cấp phiếu) = có Counted Date HOẶC Status thực (khác rỗng/NOT COUNT) */
function isChecked(r){ return !isNaN(parseDate(r.cdate)) || stKey(r) !== "NOT COUNT"; }
/* 1 dòng có được tính "đã kiểm" không (đồng nhất giữa dải số, chart và pop-up) */
function isCounted(kind, r){
  if (kind === "loc"){ var st = stKey(r); return st !== "NOT COUNT" && st !== "PENDING"; }
  var e = evalDiff(r.inv, r.cnt);
  return e.counted && stKey(r) !== "NOT COUNT";
}
function diffOf(kind, r){
  if (kind === "loc") return isCounted(kind, r) ? (Number(r.diff) || 0) : null;
  var e = evalDiff(r.inv, r.cnt); return e.counted ? e.d : null;   // null = chưa kiểm
}
/* KHỬ TRÙNG PHIẾU: 1 mã có thể được kiểm NHIỀU LẦN — mỗi (kho|mã) chỉ lấy 1 PHIẾU ĐẠI DIỆN:
   phiếu đã kiểm MỚI NHẤT (Counted date, fallback Updated At); phiếu hợp lệ thắng REJECTED/CANCELED */
function latestByKey(kind){
  var map = {};
  rowsScope(kind).forEach(function(r){
    if (!isChecked(r)) return;
    var k = keyOf(kind, r);
    var st = stKey(r), bad = (st === "REJECTED" || st === "CANCELED");
    var t = countMs(r); if (isNaN(t)) t = 0;
    var cur = map[k];
    if (!cur){ map[k] = { r: r, t: t, bad: bad }; return; }
    if (cur.bad !== bad){ if (!bad) map[k] = { r: r, t: t, bad: bad }; return; }
    if (t >= cur.t) map[k] = { r: r, t: t, bad: bad };
  });
  return map;
}
/* MẪU SỐ HASAKI: distinct (kho|mã) từ CHÍNH dữ liệu phiếu (không có Stock Location) */
function uniSet(kind){
  var u = new Set();
  rowsScope(kind).forEach(function(r){ u.add(keyOf(kind, r)); });
  return u;
}
/* "Còn lại" = key CHƯA có phiếu đã kiểm — mỗi key lấy 1 phiếu đại diện (Updated At mới nhất) */
function remainRows(kind){
  var latest = latestByKey(kind), map = {};
  rowsScope(kind).forEach(function(r){
    var k = keyOf(kind, r);
    if (latest[k]) return;
    var t = parseDate(r.upd); if (isNaN(t)) t = 0;
    var cur = map[k];
    if (!cur || t >= cur.t) map[k] = { r: r, t: t };
  });
  return Object.keys(map).map(function(k){
    var r = map[k].r;
    return { wh: r.wh, sku: r.sku || "", loc: r.loc || "", pn: r.pn || "", cat: r.cat || "", type: r.type || "", qty: (kind === "sku") ? (Number(r.inv) || 0) : null, chk: false, st: "Chưa kiểm" };
  });
}
/* "Tổng" = toàn bộ universe (kèm cờ đã kiểm) -> Tổng = Đã kiểm + Còn lại KHỚP 1:1 */
function totalRows(kind){
  var latest = latestByKey(kind);
  var out = Object.keys(latest).map(function(k){
    var r = latest[k].r;
    return { wh: r.wh, sku: r.sku || "", loc: r.loc || "", pn: r.pn || "", cat: r.cat || "", type: r.type || "", qty: (kind === "sku") ? (Number(r.inv) || 0) : null, chk: true, st: "Đã kiểm" };
  });
  return out.concat(remainRows(kind));
}
function setWh(w){ if (S.wh === w) w = ""; S.wh = w; render(); }   // bấm lại kho đang chọn = bỏ lọc

/* ===== RENDER ===== */
function render(){
  var st = $id("hkState"), grid = $id("hkGrid");
  if (!st || !grid) return;
  var btn = $id("hkReload"); if (btn) btn.disabled = false;
  if (!S.ok){
    grid.style.display = "none"; $id("hkWhBar").innerHTML = "";
    st.style.display = "block";
    st.innerHTML = '<div style="max-width:720px;margin:0 auto;text-align:left;line-height:1.75;color:var(--muted,#6b7280)">' +
      '<b style="color:var(--text,#1f2937)">Chưa có dữ liệu kiểm kê trong Google Sheet.</b><br>' +
      'Tab này đọc từ sheet <code>' + esc(TAB_SKU) + '</code> và <code>' + esc(TAB_LOC) + '</code> — bộ đồng bộ <code>push-pc-to-sheet.mjs</code> ' +
      '(cụm 8h40) sẽ ghi phiếu <code>physical-count</code> WMS của công ty Hasaki Vietnam (kho SHOP + WH 170 QUOC LO 1A) vào đó.</div>';
    capNhatInfo();
    return;
  }
  st.style.display = "none"; grid.style.display = "";
  renderWhBar();
  renderPanel("sku");
  renderPanel("loc");
  renderWh();
  capNhatInfo();
}
/* Thanh chip lọc kho đầu tab: "Tất cả kho" + từng kho (chấm màu đồng bộ thẻ kho) */
function renderWhBar(){
  var el = $id("hkWhBar"); if (!el) return;
  var set = {}; ["sku", "loc"].forEach(function(k){ S.data[k].forEach(function(r){ if (r.wh) set[r.wh] = 1; }); });
  var ws = Object.keys(set).sort();
  if (!ws.length){ el.innerHTML = ""; return; }
  el.innerHTML = '<span class="hk-hint" style="font-weight:650">Trạng thái kiểm kê theo kho:</span>' +
    '<button class="hk-whtab' + (S.wh ? "" : " active") + '" onclick="HKIEMKE.setWh(\'\')">Tất cả kho</button>' +
    ws.map(function(w){ return '<button class="hk-whtab' + (S.wh === w ? " active" : "") + '" data-w="' + esc(w) + '" onclick="HKIEMKE.setWh(this.getAttribute(\'data-w\'))"><span class="hk-dot" style="background:' + whColor(w) + '"></span>' + esc(w) + "</button>"; }).join("");
}
function renderPanel(kind){
  var U = (kind === "loc") ? "vị trí" : "SKU";
  var rs = rowsScope(kind), stc = {};
  rs.forEach(function(r){ var s = stKey(r); stc[s] = (stc[s] || 0) + 1; });   // chip trạng thái = số PHIẾU
  /* Lệch âm/dương + Đã kiểm: đếm theo PHIẾU ĐẠI DIỆN mới nhất của từng (kho|mã) */
  var latest = latestByKey(kind);
  var neg = 0, pos = 0;
  Object.keys(latest).forEach(function(k){
    var d = diffOf(kind, latest[k].r);
    if (d != null){ if (d < 0) neg++; else if (d > 0) pos++; }
  });
  var denom = uniSet(kind).size, counted = Object.keys(latest).length;
  var notc = Math.max(0, denom - counted), rate = denom ? counted / denom * 100 : 0;
  /* Tầng 1: dải 5 số bấm được + ô Dự kiến hoàn thành */
  function it(metric, cls, val, lab){
    return '<div class="ks" data-k="' + kind + '" data-m="' + metric + '" onclick="HKIEMKE.open(this.getAttribute(\'data-k\'),this.getAttribute(\'data-m\'))" title="Bấm xem danh sách chi tiết"><div class="v ' + cls + '">' + nf(val) + '</div><div class="t">' + lab + "</div></div>";
  }
  var fc = forecastInfo(kind, notc), fcHtml;
  function fcMoTa(f){
    if (f.mode === "effort"){
      var arr = []; for (var g in f.secG){ if (f.nhom[g]) arr.push(NHOM_TEN[g] + " ≈" + Math.round(f.secG[g]) + "s/mã × " + nf(f.nhom[g]) + " còn lại"); }
      return "Mô hình thời gian thực đo: " + arr.join(" · ") + " ⇒ khối lượng ≈" + (f.effort != null ? (f.effort / 3600).toFixed(1) : "?") + " giờ công. " +
        "Công suất đo được ≈" + Math.round(f.capNgay / 60) + " phút kiểm/ngày làm việc (TB 7 ngày làm việc gần nhất) → ≈" + nf(f.ngay) + " ngày làm việc. Chủ nhật nghỉ — ETA đã bỏ qua CN. Tự tính lại theo kho đang lọc.";
    }
    return "Chưa đủ dữ liệu giờ kiểm để đo giây/mã — dùng mô hình độ phủ: Còn lại (" + nf(notc) + " " + U + ") ÷ tốc độ phủ " + (f.dung7 ? "TB 7 ngày gần nhất" : "TB toàn kỳ") + " ≈" + f.pace.toFixed(1) + " " + U + "/ngày làm việc. Chủ nhật nghỉ — ETA đã bỏ qua CN.";
  }
  var fcOpenAttr = ' data-k="' + kind + '" onclick="HKIEMKE.fcOpen(this.getAttribute(\'data-k\'))"';
  if (fc.done)      fcHtml = '<div class="ks fc"' + fcOpenAttr + ' title="Toàn bộ ' + U + ' trong phạm vi đã được kiểm."><div class="v ok">✓</div><div class="t">Hoàn thành 100%</div></div>';
  else if (fc.none) fcHtml = '<div class="ks fc"' + fcOpenAttr + ' title="Chưa có phiếu kiểm kèm ngày để tính tốc độ — dự báo sẽ tự hiện khi có dữ liệu."><div class="v mut">—</div><div class="t">Dự kiến xong · chưa đủ dữ liệu</div></div>';
  else if (fc.slow) fcHtml = '<div class="ks fc"' + fcOpenAttr + ' title="' + esc(fcMoTa(fc)) + ' Với nhịp hiện tại cần ≈' + nf(fc.ngay) + ' ngày làm việc. Bấm để mô phỏng phương án nhân sự."><div class="v neg">&gt;6 tháng</div><div class="t">Dự kiến xong · nhịp quá chậm</div></div>';
  else              fcHtml = '<div class="ks fc"' + fcOpenAttr + ' title="' + esc(fcMoTa(fc)) + ' Bấm để xem chi tiết &amp; mô phỏng phương án nhân sự."><div class="v fce">' + fc.eta + '</div><div class="t">Dự kiến xong · ≈' + nf(fc.ngay) + " ngày làm việc</div></div>";
  var strip = $id("hkStrip-" + kind);
  strip.innerHTML =
    it("total", "", denom, "Tổng " + U + " (phiếu WMS)") +
    it("counted", "ok", counted, "Đã kiểm · " + pct(rate)) +
    it("notcount", "mut", notc, "Còn lại") +
    it("negative", "neg", neg, "Lệch âm") +
    it("positive", "pos", pos, "Lệch dương") +
    fcHtml;
  swap(strip);
  /* Tầng 2: thanh trạng thái 100% + chips đếm theo PHIẾU */
  var keys = ST_ORDER.filter(function(s){ return stc[s]; })
    .concat(Object.keys(stc).filter(function(s){ return ST_ORDER.indexOf(s) < 0; }).sort());
  var segs = keys.map(function(s){
    var m = stMeta(s), w = rs.length ? stc[s] / rs.length * 100 : 0;
    return '<i style="width:' + w.toFixed(2) + "%;background:" + m[1] + '" title="' + esc(m[0]) + ": " + nf(stc[s]) + " (" + pct(w) + ')"></i>';
  }).join("");
  var chips = keys.map(function(s){
    var m = stMeta(s);
    return '<button class="hk-stchip" style="--cc:' + m[1] + '" data-k="' + kind + '" data-m="st:' + esc(s) + '" onclick="HKIEMKE.open(this.getAttribute(\'data-k\'),this.getAttribute(\'data-m\'))"><span class="dot2"></span>' + esc(m[0]) + " <b>" + nf(stc[s]) + "</b></button>";
  }).join("");
  var stEl = $id("hkStatus-" + kind);
  stEl.innerHTML = rs.length
    ? '<div class="hk-stbar">' + segs + '</div><div class="hk-stchips">' + chips + "</div>"
    : '<div class="hk-histempty">Kho đang chọn chưa có phiếu kiểm kê loại này.</div>';
  swap(stEl);
  /* Chip phạm vi: panel đang tính theo kho nào (cross-filter) */
  var sc = $id("hkScope-" + kind);
  if (sc){ sc.hidden = !S.wh; sc.textContent = S.wh ? ("Kho: " + S.wh) : ""; }
  /* Tầng 3: chart mini "Đã kiểm theo ngày" */
  renderDaily(kind);
}
/* Chart "Đã đếm theo ngày" — cột chồng theo KHO từ Counted date, so sánh ngày kề trước */
function renderDaily(kind){
  var el = $id("hkHist-" + kind); if (!el) return;
  var rs = rowsScope(kind), U = (kind === "loc") ? "vị trí" : "SKU";
  var days = {}, khoAll = {};
  rs.forEach(function(r){
    if (!isCounted(kind, r)) return;
    var ms = countMs(r); if (isNaN(ms)) return;
    var d = dayStr(ms);
    if (!days[d]) days[d] = { tot: 0, kho: {} };
    days[d].tot++; days[d].kho[r.wh] = (days[d].kho[r.wh] || 0) + 1;
    khoAll[r.wh] = 1;
  });
  var ds = Object.keys(days).sort().slice(-60);
  var khos = Object.keys(khoAll).sort();
  var lg = $id("hkLegend-" + kind);
  if (lg) lg.innerHTML = khos.map(function(w){ return '<span><span class="sw" style="background:' + whColor(w) + '"></span>' + esc(w) + "</span>"; }).join("");
  if (!ds.length){ el.innerHTML = '<div class="hk-histempty">Chưa có dòng nào được kiểm (theo bộ lọc hiện tại).</div>'; return; }
  var max = 1; ds.forEach(function(d){ if (days[d].tot > max) max = days[d].tot; });
  var H = 150;   // khớp .hk-hbars trong CSS
  var html = ds.map(function(d, i){
    var v = days[d], prev = i > 0 ? days[ds[i - 1]].tot : null;
    var delta = (prev == null) ? null : (v.tot - prev);
    var parts = [];
    khos.slice().reverse().forEach(function(w){   // đảo để kho đầu legend nằm ĐÁY cột
      var n = v.kho[w] || 0; if (!n) return;
      parts.push({ h: Math.max(2, Math.round(n / max * H)), c: whColor(w) });
    });
    var segs = parts.map(function(pt, j){ return '<div class="hk-hseg' + (j === 0 ? " top" : "") + '" style="height:' + pt.h + "px;background:" + pt.c + '"></div>'; }).join("");
    var tip = "Ngày " + d.slice(8, 10) + "/" + d.slice(5, 7) + "/" + d.slice(0, 4) + " | " + khos.map(function(w){ return w + ": " + nf(v.kho[w] || 0); }).join(" | ") + " | Tổng: " + nf(v.tot) + " " + U + (delta == null ? "" : " | " + (delta >= 0 ? "+" : "") + nf(delta) + " so với ngày trước");
    var lab = nf(v.tot);   // luôn hiện số lượng của TỪNG ngày trên cột (trước chỉ hiện ≤20 ngày/cột cao nhất/cột cuối)
    var dHtml = '<div class="hk-hdelta" style="color:' + (delta > 0 ? "#10b981" : delta < 0 ? "#ef4444" : "var(--muted,#9ca3af)") + '">' + (delta == null ? "&nbsp;" : (delta > 0 ? "+" : "") + nf(delta)) + "</div>";
    return '<div class="hk-hcol" title="' + esc(tip) + '"><div class="hk-hval">' + lab + '</div><div class="hk-hbars">' + segs + '</div><div class="hk-hdate">' + d.slice(8, 10) + "/" + d.slice(5, 7) + "</div>" + dHtml + "</div>";
  }).join("");
  el.innerHTML = '<div class="hk-histscroll"><div class="hk-histchart">' + html + "</div></div>";
  swap(el);
  var sc = el.querySelector(".hk-histscroll"); if (sc) sc.scrollLeft = sc.scrollWidth;
}
/* Panel "Tiến độ theo kho" — mẫu số mỗi kho = distinct mã trong PHIẾU của kho đó */
function renderWh(){
  var el = $id("hkWhList"); if (!el) return;
  var agg = {};
  ["sku", "loc"].forEach(function(kind){
    S.data[kind].forEach(function(r){   // dùng DỮ LIỆU GỐC (bỏ qua cross-filter) để liệt kê đủ các kho
      var w = r.wh || "(trống)";
      if (!agg[w]) agg[w] = { sku: { uni: new Set(), chk: new Set() }, loc: { uni: new Set(), chk: new Set() } };
      var a = agg[w][kind], code = (kind === "sku") ? r.sku : r.loc;
      a.uni.add(code);
      if (isChecked(r)) a.chk.add(code);
    });
  });
  var ws = Object.keys(agg).sort();
  el.innerHTML = ws.map(function(w){
    var a = agg[w];
    var totS = a.sku.uni.size, cntS = a.sku.chk.size, totL = a.loc.uni.size, cntL = a.loc.chk.size;
    var rs = totS ? cntS / totS * 100 : 0, rl = totL ? cntL / totL * 100 : 0;
    return '<div class="hk-whcard' + (S.wh === w ? " active" : "") + '" data-w="' + esc(w) + '" onclick="HKIEMKE.setWh(this.getAttribute(\'data-w\'))" title="Bấm để lọc toàn tab Kiểm kê theo kho này (bấm lại để bỏ lọc)">' +
      '<div class="hk-whtop"><span class="hk-whname"><span class="hk-dot" style="background:' + whColor(w) + '"></span>' + esc(w) + "</span>" +
      '<span class="hk-whnum">SKU <b>' + nf(cntS) + "</b>/" + nf(totS) + " · VT <b>" + nf(cntL) + "</b>/" + nf(totL) + "</span></div>" +
      '<div class="hk-prog"><div class="hk-progf" style="width:' + rs.toFixed(1) + "%;background:" + whColor(w) + '"></div></div>' +
      '<div class="hk-whsub2">SKU đã kiểm ' + pct(rs) + "</div>" +
      '<div class="hk-prog"><div class="hk-progf" style="width:' + rl.toFixed(1) + "%;background:color-mix(in srgb," + whColor(w) + ' 55%,var(--surface,#fff))"></div></div>' +
      '<div class="hk-whsub2">Mã vị trí đã kiểm ' + pct(rl) + "</div></div>";
  }).join("") || '<div class="hk-histempty">Chưa có dữ liệu kiểm kê.</div>';
  swap(el);
}

/* ===== DỰ BÁO HOÀN THÀNH — mô hình EFFORT + lịch làm việc (CN nghỉ), port nguyên từ factory =====
   1) Đo GIÂY/MÃ: gom phiếu theo (người đếm | ngày), cắt PHIÊN (gap ≤15'), phiên ≥3 mã mới tin;
      median riêng từng nhóm hàng. 2) Khối lượng còn lại = Σ (mã chưa kiểm của nhóm × giây/mã nhóm).
   3) Công suất = tổng giờ kiểm ÷ ngày LÀM VIỆC (TB 7 ngày làm việc gần nhất). 4) ETA né Chủ nhật.
   Thiếu dữ liệu giờ -> fallback mô hình độ phủ. */
function timingModel(kind){
  var byPD = {};
  rowsScope(kind).forEach(function(r){
    if (!isChecked(r)) return;
    var ms = parseDate(r.cdate); if (isNaN(ms)) return;   // cần giờ phút THẬT của Counted date
    var pd = (r.by || "?") + "|" + dayStr(ms);
    (byPD[pd] = byPD[pd] || []).push({ ms: ms, g: (kind === "sku") ? nhomCat(r.cat) : "ALL" });
  });
  var rate = {}, dayEffort = {}, persEff = {};
  Object.keys(byPD).forEach(function(pd){
    var a = byPD[pd].sort(function(x, y){ return x.ms - y.ms; }), day = pd.split("|")[1];
    var s = 0;
    while (s < a.length){
      var e = s;
      while (e + 1 < a.length && a[e + 1].ms - a[e].ms <= 15 * 60 * 1000) e++;
      var n = e - s + 1;
      if (n >= 3){
        var dur = Math.max(60000, a[e].ms - a[s].ms), spm = dur / 1000 / n;
        var gc = {}; for (var i = s; i <= e; i++) gc[a[i].g] = (gc[a[i].g] || 0) + 1;
        for (var g in gc) for (var j = 0; j < gc[g]; j++) (rate[g] = rate[g] || []).push(spm);
        dayEffort[day] = (dayEffort[day] || 0) + dur / 1000;
        persEff[pd] = (persEff[pd] || 0) + dur / 1000;
      }
      s = e + 1;
    }
  });
  return { rate: rate, dayEffort: dayEffort, persEff: persEff };
}
function forecastInfo(kind, conLai){
  if (!conLai) return { done: true };
  var todayMs = todayMsVN(), namNay = vnDate(Date.now()).getUTCFullYear();
  function fmt(ms){ var t = new Date(ms); return p2(t.getUTCDate()) + "/" + p2(t.getUTCMonth() + 1) + (t.getUTCFullYear() !== namNay ? ("/" + t.getUTCFullYear()) : ""); }
  function etaSkipCN(soNgayLam){
    var d = todayMs, lam = 0;
    for (var i = 1; i <= 800 && lam < soNgayLam; i++){ d = todayMs + i * 86400000; if (new Date(d).getUTCDay() !== 0) lam++; }
    return d;
  }
  /* ---- Mô hình EFFORT (ưu tiên) ---- */
  var tm = timingModel(kind);
  var allSamples = []; for (var g0 in tm.rate) allSamples = allSamples.concat(tm.rate[g0]);
  var secAll = median(allSamples);
  if (secAll){
    var remain = remainRows(kind), nhom = {};
    remain.forEach(function(m){ var g = (kind === "sku") ? nhomCat(m.cat) : "ALL"; nhom[g] = (nhom[g] || 0) + 1; });
    var nhomTong = {};   // tổng mã theo nhóm (kể cả đã kiểm) — cho mô phỏng "Toàn bộ / kiểm lại từ đầu"
    totalRows(kind).forEach(function(m){ var g = (kind === "sku") ? nhomCat(m.cat) : "ALL"; nhomTong[g] = (nhomTong[g] || 0) + 1; });
    var effort = 0, secG = {};
    for (var gT in nhomTong) secG[gT] = median(tm.rate[gT]) || secAll;   // giây/mã cho MỌI nhóm (tránh NaN khi tính toàn bộ)
    for (var g1 in nhom) effort += nhom[g1] * secG[g1];   // ① effort vẫn tính theo CÒN LẠI
    var dayStaff = {}; Object.keys(tm.persEff).forEach(function(k){ var p = k.split("|"); dayStaff[p[1]] = (dayStaff[p[1]] || 0) + 1; });
    var cap = 0, nWin = 0, sSum = 0;
    for (var i = 1; nWin < 7 && i <= 21; i++){ var dm = todayMs - i * 86400000;
      if (new Date(dm).getUTCDay() === 0) continue;
      nWin++; var dk = dayStr(dm);
      cap += tm.dayEffort[dk] || 0; sSum += dayStaff[dk] || 0;
    }
    if (!cap){   // 7 ngày làm việc gần nhất im ắng -> trung bình toàn kỳ
      var days = Object.keys(tm.dayEffort).sort(), tot = 0, sTot = 0;
      days.forEach(function(d){ tot += tm.dayEffort[d]; sTot += dayStaff[d] || 0; });
      if (days.length){ var wd = 0;
        for (var ms2 = Date.parse(days[0] + "T00:00:00Z"); ms2 <= todayMs; ms2 += 86400000) if (new Date(ms2).getUTCDay() !== 0) wd++;
        cap = tot; nWin = Math.max(1, wd); sSum = sTot;
      }
    }
    var capNgay = nWin ? cap / nWin : 0;
    if (capNgay > 0){
      var soLam = Math.ceil(effort / capNgay);
      var out = { mode: "effort", ngay: soLam, secG: secG, nhom: nhom, nhomTong: nhomTong, capNgay: capNgay, effort: effort };
      out.nguoiTB = nWin ? sSum / nWin : 0;
      out.phutNguoi = out.nguoiTB > 0 ? (capNgay / 60) / out.nguoiTB : capNgay / 60;
      if (soLam > 150){ out.slow = true; return out; }
      out.eta = fmt(etaSkipCN(soLam));
      return out;
    }
  }
  /* ---- Fallback: mô hình ĐỘ PHỦ (không có giờ kiểm chi tiết) ---- */
  var univ = uniSet(kind), first = {};
  rowsScope(kind).forEach(function(r){
    if (!isChecked(r)) return;
    var k = keyOf(kind, r);
    if (univ.size && !univ.has(k)) return;
    var ms = countMs(r); if (isNaN(ms)) return;
    if (!(k in first) || ms < first[k]) first[k] = ms;
  });
  var keys = Object.keys(first);
  if (!keys.length) return { none: true };
  var d7 = 0, minDay = Infinity;
  keys.forEach(function(k){ var day = Math.floor(first[k] / 86400000) * 86400000;
    if (day < minDay) minDay = day;
    if (todayMs - day < 7 * 86400000) d7++;
  });
  var wdAll = 0; for (var ms3 = minDay; ms3 <= todayMs; ms3 += 86400000) if (new Date(ms3).getUTCDay() !== 0) wdAll++;
  var pace = (d7 > 0) ? (d7 / 6) : (keys.length / Math.max(1, wdAll));   // 7 ngày lịch ≈ 6 ngày làm việc
  if (!(pace > 0)) return { none: true };
  var soLam2 = Math.ceil(conLai / pace);
  var out2 = { mode: "phu", ngay: soLam2, pace: pace, dung7: d7 > 0 };
  if (soLam2 > 150){ out2.slow = true; return out2; }
  out2.eta = fmt(etaSkipCN(soLam2));
  return out2;
}

/* ===== POP-UP DỰ BÁO: ① máy tự tính + ② người chọn (mô phỏng nhân sự/nhóm hàng/hạn chót) ===== */
function fcOpen(kind){
  var latest = latestByKey(kind), counted = Object.keys(latest).length;
  var denom = uniSet(kind).size;
  var notc = Math.max(0, denom - counted);
  var fc = forecastInfo(kind, notc);
  var U = (kind === "loc") ? "mã vị trí" : "SKU";
  FC = { kind: kind, fc: fc, U: U };
  $id("hkFcTitle").textContent = "Dự báo hoàn thành kiểm kê · " + U;
  $id("hkFcSub").textContent = (S.wh ? ("Kho " + S.wh) : "Toàn bộ kho") + " · còn lại " + nf(notc) + " " + U + " chưa kiểm · lịch làm việc bỏ qua Chủ nhật";
  var htmlA = "", htmlB = "";
  if (fc.done){
    htmlA = '<div class="hk-fcsec"><h3>Trạng thái</h3><div class="hk-fchero"><span class="d ok">✓ 100%</span><span class="n">Toàn bộ ' + U + " trong phạm vi đã được kiểm.</span></div></div>";
  }else if (fc.mode === "effort"){
    var gList = ""; for (var g in fc.secG){ if (fc.nhom[g]) gList += '<div class="hk-fcfact"><b>≈' + Math.round(fc.secG[g]) + "s/mã · " + nf(fc.nhom[g]) + " mã</b><span>" + NHOM_TEN[g] + " còn lại</span></div>"; }
    htmlA = '<div class="hk-fcsec"><h3>① Máy tự tính — đo từ dữ liệu quá khứ</h3>' +
      '<div class="hk-fchero"><span class="d' + (fc.slow ? " bad" : "") + '">' + (fc.slow ? "&gt;6 tháng" : fc.eta) + '</span><span class="n">≈' + nf(fc.ngay) + " ngày làm việc theo nhịp hiện tại (đã né Chủ nhật)</span></div>" +
      '<div class="hk-fcfacts">' + gList +
      '<div class="hk-fcfact"><b>≈' + (fc.effort / 3600).toFixed(1) + " giờ công</b><span>khối lượng còn lại</span></div>" +
      '<div class="hk-fcfact"><b>≈' + Math.round(fc.capNgay / 60) + " phút/ngày</b><span>công suất đo được (TB 7 ngày làm việc)</span></div>" +
      '<div class="hk-fcfact"><b>≈' + fc.nguoiTB.toFixed(1) + " người/ngày</b><span>nhân sự kiểm TB (ngày có kiểm)</span></div>" +
      '<div class="hk-fcfact"><b>≈' + Math.round(fc.phutNguoi) + " phút/người</b><span>thời lượng kiểm TB 1 người/ngày</span></div>" +
      "</div></div>";
    var nMac = Math.min(10, Math.max(1, Math.round(fc.nguoiTB) || 1));
    var nItems = []; for (var i = 1; i <= 10; i++) nItems.push({ v: i, t: i + " người" });
    var hDo = Math.max(60, Math.round(fc.phutNguoi * 60));
    var hItems = [{ v: hDo, t: "Như thực đo · ≈" + Math.round(fc.phutNguoi) + " phút/người/ngày" },
      { v: 7200, t: "2 giờ / người / ngày" }, { v: 14400, t: "4 giờ / người / ngày" }, { v: 21600, t: "6 giờ / người / ngày" }, { v: 28800, t: "8 giờ / người / ngày" }];
    var homNay = (function(){ var t = new Date(todayMsVN()); return t.getUTCFullYear() + "-" + p2(t.getUTCMonth() + 1) + "-" + p2(t.getUTCDate()); })();
    var gChips = ""; for (var g2 in fc.nhomTong){ if (fc.nhomTong[g2]) gChips += '<button class="hk-fcg on" data-g="' + g2 + '" onclick="this.classList.toggle(\'on\');HKIEMKE.fcSim()">' + NHOM_TEN[g2] + " · " + nf(fc.nhom[g2] || 0) + "</button>"; }
    var baseItems = [{ v: "conlai", t: "Còn lại chưa kiểm" }, { v: "tong", t: "Toàn bộ — kiểm lại từ đầu" }];
    htmlB = '<div class="hk-fcsec"><h3>② Người chọn — mô phỏng phương án nhân sự</h3>' +
      '<div class="hk-fcctl">' +
      "<label>Số nhân sự kiểm" + fcComboHtml("fcN", nItems, nMac) + "</label>" +
      "<label>Thời lượng kiểm / người / ngày" + fcComboHtml("fcH", hItems, hDo) + "</label>" +
      "</div>" +
      '<div class="hk-fcctl" style="grid-template-columns:1fr"><label>Tính trên (phạm vi mô phỏng)' + fcComboHtml("fcBase", baseItems, "conlai") + "</label></div>" +
      '<div class="hk-fcctl" style="grid-template-columns:1fr"><label>Thời gian đợt kiểm — bắt đầu → hạn chót (bấm ngày 1 = bắt đầu, ngày 2 = hạn)' +
      '<span class="hk-fcdate" id="hkFcDateWrap">' +
        '<button type="button" class="date-btn" id="hkFcDateBtn">' + homNay + "</button>" +
        '<span class="hk-datepop hidden" id="hkFcDatePop"></span>' +
      "</span></label></div>" +
      '<div class="hk-fcctl" style="grid-template-columns:1fr"><label>Nhóm hàng đưa vào đợt kiểm<span class="hk-fcgroups" id="hkFcG">' + gChips + "</span></label></div>" +
      '<div class="hk-fchero" id="hkFcSimOut"></div><div class="hk-fcneed" id="hkFcNeed"></div></div>';
  }else if (fc.none){
    htmlA = '<div class="hk-fcsec"><h3>① Máy tự tính</h3><div class="hk-fchero"><span class="d">—</span><span class="n">Chưa có phiếu kiểm kèm ngày giờ để dự báo.</span></div></div>';
  }else{
    htmlA = '<div class="hk-fcsec"><h3>① Máy tự tính — mô hình độ phủ (chưa có giờ kiểm chi tiết)</h3>' +
      '<div class="hk-fchero"><span class="d' + (fc.slow ? " bad" : "") + '">' + (fc.slow ? "&gt;6 tháng" : fc.eta) + '</span><span class="n">≈' + nf(fc.ngay) + " ngày làm việc · tốc độ ≈" + fc.pace.toFixed(1) + " " + U + "/ngày làm việc</span></div></div>";
  }
  if (!htmlB && !fc.done) htmlB = '<div class="hk-fcsec"><h3>② Người chọn — mô phỏng</h3><div class="hk-fchero"><span class="n">Chưa đủ dữ liệu giờ kiểm (Counted date có giờ phút) để đo giây/mã — mô phỏng sẽ mở khi có dữ liệu.</span></div></div>';
  var fcb = $id("hkFcBody");
  fcb.className = "hk-fcwrap" + (htmlB ? "" : " one");
  fcb.innerHTML = htmlA + htmlB;
  FC_DP = { view: { y: 0, m: 0 }, selS: "", selE: "", start: fcTodayISO(), end: "" };   // mỗi lần mở: bắt đầu = hôm nay
  fcUpdateDateBtn();
  if (fc.mode === "effort" && !fc.done) fcSim();
  var m = $id("hkFcModal"); m.style.display = "flex";
  requestAnimationFrame(function(){ m.classList.add("show"); });
}
/* Combo kiểu dự án (thay <select> trần): input readonly + combo-menu dùng chung CSS module */
function fcComboHtml(id, items, selV){
  var sel = null; items.forEach(function(o){ if (String(o.v) === String(selV)) sel = o; }); sel = sel || items[0];
  return '<div class="hk-combo hk-fccombo" data-id="' + id + '">' +
    '<input readonly data-v="' + esc(String(sel.v)) + '" value="' + esc(sel.t) + '" onclick="HKIEMKE.fcToggle(this.parentNode)">' +
    '<div class="hk-combo-menu">' + items.map(function(o){ return '<div class="hk-combo-item" data-v="' + esc(String(o.v)) + '"><span class="nm">' + esc(o.t) + "</span></div>"; }).join("") + "</div></div>";
}
function fcCloseMenus(except){
  document.querySelectorAll("#hkFcBody .hk-combo-menu.show").forEach(function(m){
    if (!except || m.parentNode !== except){ m.classList.remove("show"); m.parentNode.classList.remove("open"); }
  });
}
function fcToggle(combo){
  var m = combo.querySelector(".hk-combo-menu"), dang = m.classList.contains("show");
  fcCloseMenus();
  if (!dang){ m.classList.add("show"); combo.classList.add("open"); }
}
function fcComboV(id){ var inp = document.querySelector('#hkFcBody .hk-fccombo[data-id="' + id + '"] input'); return inp ? Number(inp.getAttribute("data-v")) : NaN; }
function fcBaseVal(){ var inp = document.querySelector('#hkFcBody .hk-fccombo[data-id="fcBase"] input'); return (inp && inp.getAttribute("data-v")) || "conlai"; }
function fcSim(){
  var fc = FC.fc; if (!fc || fc.mode !== "effort") return;
  var out = $id("hkFcSimOut"), need = $id("hkFcNeed");
  if (!out) return;
  var base = fcBaseVal(), cnt = (base === "tong") ? (fc.nhomTong || {}) : (fc.nhom || {});   // ② mô phỏng trên CÒN LẠI hoặc TOÀN BỘ
  document.querySelectorAll("#hkFcG .hk-fcg").forEach(function(x){ var g = x.getAttribute("data-g"); x.textContent = NHOM_TEN[g] + " · " + nf(cnt[g] || 0); });   // đổi phạm vi -> cập nhật số mã trên chip
  var N = fcComboV("fcN") || 1;
  var secNguoi = fcComboV("fcH") || Math.max(60, fc.phutNguoi * 60);
  var load = 0, nMa = 0;
  document.querySelectorAll("#hkFcG .hk-fcg.on").forEach(function(x){ var g = x.getAttribute("data-g"); load += (cnt[g] || 0) * (fc.secG[g] || 0); nMa += cnt[g] || 0; });
  if (!nMa){ out.innerHTML = '<span class="n">Chọn ít nhất 1 nhóm hàng để mô phỏng.</span>'; need.textContent = ""; return; }
  var startMs = FC_DP.start ? Date.parse(FC_DP.start + "T00:00:00Z") : todayMsVN(); if (isNaN(startMs)) startMs = todayMsVN();
  var soLam = Math.ceil(load / (N * secNguoi));
  var endMs = etaFrom(startMs, soLam);
  out.innerHTML = '<span class="d">' + fcFmt(endMs) + '</span><span class="n">kết thúc dự kiến · bắt đầu ' + fcFmt(startMs) + " → ≈" + nf(soLam) + " ngày làm việc (né CN) · " + nf(nMa) + " mã ≈" + (load / 3600).toFixed(1) + " giờ công · " + N + " người × " + Math.round(secNguoi / 60) + " phút/ngày · phạm vi: " + (base === "tong" ? "TOÀN BỘ (kiểm lại từ đầu)" : "còn lại chưa kiểm") + "</span>";
  var txt = "";
  if (FC_DP.end){
    var tms = Date.parse(FC_DP.end + "T00:00:00Z"), wd = 0;
    for (var ms = startMs; ms <= tms; ms += 86400000) if (new Date(ms).getUTCDay() !== 0) wd++;
    txt = (isNaN(tms) || wd <= 0) ? "Hạn chót phải sau ngày bắt đầu kiểm."
      : ("→ Để xong trước " + fcFmtVN(FC_DP.end) + " (" + wd + " ngày làm việc kể từ ngày bắt đầu): cần ≈ " + Math.ceil(load / (wd * secNguoi)) + " người với thời lượng đã chọn.");
  }
  need.textContent = txt;
}
/* ===== BỘ CHỌN KHOẢNG NGÀY (bắt đầu → hạn chót): click 1 = bắt đầu, click 2 = hạn; Áp dụng mới chốt ===== */
function fcIsoOf(y, m, d){ return y + "-" + p2(m + 1) + "-" + p2(d); }
function fcTodayISO(){ var t = new Date(todayMsVN()); return fcIsoOf(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()); }
function fcFmtVN(iso){ return iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4) : ""; }
function fcDpRange(){ var a = FC_DP.selS || FC_DP.start, b = FC_DP.selE || FC_DP.end || ""; if (a && b && a > b){ var t = a; a = b; b = t; } return [a, b]; }
function fcMonthHTML(y, m){
  var first = Date.UTC(y, m, 1), dow = (new Date(first).getUTCDay() + 6) % 7, start = first - dow * 86400000, g = "";
  for (var i = 0; i < 42; i++){ var dt = new Date(start + i * 86400000);
    var iso = fcIsoOf(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
    g += '<span class="dp-day' + (dt.getUTCMonth() !== m ? " out" : "") + '" data-iso="' + iso + '">' + dt.getUTCDate() + "</span>";
  }
  var dows = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map(function(x){ return '<span class="dp-dow">' + x + "</span>"; }).join("");
  return '<span class="dp-month"><span class="dp-mtitle" style="display:block">Th' + (m + 1) + " " + y + '</span><span class="dp-grid">' + dows + g + "</span></span>";
}
function fcRenderCal(){
  var y = FC_DP.view.y, m = FC_DP.view.m, y2 = (m === 11) ? y + 1 : y, m2 = (m + 1) % 12;
  var el = $id("hkFcDpMonths"); if (!el) return;
  el.innerHTML = fcMonthHTML(y, m) + fcMonthHTML(y2, m2);
  fcPaintSel();
  fcPositionDatePop();   // canh lại sau khi đổi tháng (kích thước có thể đổi)
}
/* Định vị lịch (position:fixed) bám nút, tự lật lên/né mép. .hk-modalbox có will-change:transform
   -> là containing block của phần tử fixed, phải trừ offset của .hk-modalbox */
function fcPositionDatePop(){
  var pop = $id("hkFcDatePop"), btn = $id("hkFcDateBtn");
  if (!pop || !btn || pop.classList.contains("hidden")) return;
  pop.style.maxHeight = "";
  var r = btn.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight, M = 8;
  var pw = pop.offsetWidth, ph = pop.offsetHeight;
  var leftVp = Math.max(M, Math.min(r.left, vw - pw - M));
  var below = vh - r.bottom - M, above = r.top - M, topVp;
  if (ph <= below || below >= above){ topVp = r.bottom + 6; if (ph > below) pop.style.maxHeight = Math.max(160, below - 6) + "px"; }
  else { var h = Math.min(ph, above - 6); pop.style.maxHeight = Math.max(160, h) + "px"; topVp = Math.max(M, r.top - 6 - h); }
  var box = btn.closest(".hk-modalbox"), ox = 0, oy = 0;
  if (box){ var mr = box.getBoundingClientRect(); ox = mr.left; oy = mr.top; }
  pop.style.left = Math.round(leftVp - ox) + "px";
  pop.style.top = Math.round(topVp - oy) + "px";
}
function fcBindReposition(on){
  if (on && !_fcDpBound){ window.addEventListener("resize", fcPositionDatePop); window.addEventListener("scroll", fcPositionDatePop, true); _fcDpBound = true; }
  else if (!on && _fcDpBound){ window.removeEventListener("resize", fcPositionDatePop); window.removeEventListener("scroll", fcPositionDatePop, true); _fcDpBound = false; }
}
function fcPaintSel(){
  var r = fcDpRange(), a = r[0], b = r[1], today = fcTodayISO();
  document.querySelectorAll("#hkFcDpMonths .dp-day").forEach(function(el){
    var iso = el.getAttribute("data-iso");
    el.classList.remove("in-range", "edge");
    el.classList.toggle("today", iso === today);
    if (a && b){ if (iso === a || iso === b) el.classList.add("edge"); else if (iso > a && iso < b) el.classList.add("in-range"); }
    else if (a && iso === a) el.classList.add("edge");
  });
  var s = document.querySelector("#hkFcDatePop .dpsel");
  if (s) s.textContent = a ? (b && b !== a ? fcFmtVN(a) + " → " + fcFmtVN(b) : fcFmtVN(a) + " → (không hạn)") : "Chưa chọn";
}
function fcUpdateDateBtn(){
  var b = $id("hkFcDateBtn"); if (!b) return;
  b.textContent = FC_DP.start ? (FC_DP.end ? fcFmtVN(FC_DP.start) + " → " + fcFmtVN(FC_DP.end) : fcFmtVN(FC_DP.start) + " → (không hạn)") : "Hôm nay";
}
function fcOpenDatePop(){
  var base = FC_DP.start || fcTodayISO();
  FC_DP.view = { y: Number(base.slice(0, 4)), m: Number(base.slice(5, 7)) - 1 };
  /* chỉ coi là ĐÃ có dải khi user từng chốt hạn — start mặc định "hôm nay" không tính */
  FC_DP.selS = FC_DP.end ? FC_DP.start : ""; FC_DP.selE = FC_DP.end;
  var pop = $id("hkFcDatePop");
  pop.innerHTML =
    '<span class="dp-presets" style="display:flex">' +
      '<button type="button" data-preset="today">Hôm nay</button>' +
      '<button type="button" data-preset="7">+7 ngày</button>' +
      '<button type="button" data-preset="14">+14 ngày</button>' +
      '<button type="button" data-preset="30">+30 ngày</button>' +
      '<button type="button" data-preset="month">Hết tháng</button>' +
    "</span>" +
    '<span class="dp-nav" style="display:flex"><button type="button" id="hkFcDpPrev">‹ Trước</button><span></span><button type="button" id="hkFcDpNext">Sau ›</button></span>' +
    '<span class="dp-months" id="hkFcDpMonths" style="display:flex"></span>' +
    '<span class="dp-foot" style="display:flex"><span class="dpsel">Chưa chọn</span><span><button type="button" id="hkFcDpClear">Xoá</button><button type="button" class="primary" id="hkFcDpApply">Áp dụng</button></span></span>';
  pop.classList.remove("hidden");
  $id("hkFcDateWrap").classList.add("open");
  fcRenderCal();
  fcBindReposition(true);
}
function fcCloseDatePop(){
  var pop = $id("hkFcDatePop");
  if (pop && !pop.classList.contains("hidden")){ pop.classList.add("hidden"); pop.innerHTML = ""; pop.style.maxHeight = ""; }
  var w = $id("hkFcDateWrap"); if (w) w.classList.remove("open");
  fcBindReposition(false);
}
function fcPreset(p){
  var t = fcTodayISO(), tm = Date.parse(t + "T00:00:00Z");
  function plus(n){ var d = new Date(tm + n * 86400000); return fcIsoOf(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); }
  FC_DP.selS = t;
  if (p === "today") FC_DP.selE = "";
  else if (p === "month"){ var d = new Date(tm); FC_DP.selE = fcIsoOf(d.getUTCFullYear(), d.getUTCMonth() + 1, 0); }
  else FC_DP.selE = plus(Number(p));
  FC_DP.view = { y: Number(FC_DP.selS.slice(0, 4)), m: Number(FC_DP.selS.slice(5, 7)) - 1 };
  fcRenderCal();   // preset chỉ TÔ dải, bấm Áp dụng mới chốt
}
function fcCommitDate(){
  var r = fcDpRange();
  FC_DP.start = r[0] || fcTodayISO(); FC_DP.end = (r[1] && r[1] !== r[0]) ? r[1] : "";
  fcUpdateDateBtn(); fcCloseDatePop(); fcSim();
}
function fcClearDate(){
  FC_DP.selS = FC_DP.selE = ""; FC_DP.start = fcTodayISO(); FC_DP.end = "";
  fcUpdateDateBtn(); fcCloseDatePop(); fcSim();
}
function closeFc(){
  fcBindReposition(false);
  var m = $id("hkFcModal"); m.classList.remove("show");
  setTimeout(function(){ m.style.display = "none"; $id("hkFcBody").innerHTML = ""; }, 240);
}

/* ===== POP-UP CHI TIẾT (drill-down) — bảng lazy + combo chain-filter (khuôn factory) ===== */
var METRIC_LABEL = { total: "tổng", counted: "đã kiểm", notcount: "còn lại (chưa kiểm)", negative: "lệch âm", positive: "lệch dương" };
function metricRows(kind, metric){
  var rs = rowsScope(kind);
  if (metric === "total") return rs;
  if (metric.indexOf("st:") === 0){ var s = metric.slice(3); return rs.filter(function(r){ return stKey(r) === s; }); }
  var latest = latestByKey(kind), out = [];
  Object.keys(latest).forEach(function(k){
    var r = latest[k].r, d = diffOf(kind, r);
    if (metric === "counted"){ out.push(r); return; }
    if (metric === "negative" && d != null && d < 0) out.push(r);
    if (metric === "positive" && d != null && d > 0) out.push(r);
  });
  return out;
}
/* Bảng PHIẾU kiểm kê (metric counted/negative/positive/st:*) */
/* HPC: loại SKU (SKU=1 / SKU_FACTORY=2, mặc định 1) + lý do chọn ghi vào giỏ tạo lệnh */
function pcType(t){ var k = String(t || "").toUpperCase().replace(/[^A-Z]+/g, "_").replace(/^_+|_+$/g, ""); return k === "SKU_FACTORY" ? 2 : 1; }
function reasonKk(r){ var m = MODAL.metric || ""; if (m === "notcount") return "Còn lại chưa kiểm"; if (m === "total") return r.chk ? "Có phiếu · đã kiểm" : "Chưa kiểm"; if (m.indexOf("st:") === 0) return "Trạng thái " + m.slice(3); return "Kiểm kê: " + (METRIC_LABEL[m] || m); }
var _hpc = function(){ return window.HPC; };   // gọn: HPC nếu đã nạp
function tablePhieu(kind, rs){
  var out = [];
  if (kind === "sku"){
    for (var i = 0; i < rs.length && out.length < CAP; i++){ var r = rs[i], e = evalDiff(r.inv, r.cnt);
      out.push("<tr>" + (_hpc() ? HPC.cell(r.wh, r.sku, r.pn, pcType(r.type), reasonKk(r)) : "") + "<td>" + idLink(r.id, "sku") + "</td><td><b>" + esc(r.sku) + '</b><div class="pn2">' + esc(r.pn) + "</div></td><td>" + dash(r.cat) + "</td>" +
        dcell(r.cnt == null ? 0 : e.d) + '<td class="num">' + nf(r.inv) + '</td><td class="num">' + (r.cnt == null ? "—" : nf(r.cnt)) + "</td><td>" + dash(r.type) + "</td><td>" + dash(r.req) + "</td><td>" + dash(r.by) + "</td><td>" + fmtD(parseDate(r.cdate)) + "</td><td>" + fmtD(parseDate(r.plan), true) + '</td><td><span class="hk-badge ' + badgeCls(r.st) + '">' + (r.st ? esc(r.st) : "—") + "</span></td></tr>");
    }
    return '<div class="hk-wrap"><table><thead><tr>' + (_hpc() ? HPC.headCell() : "") + '<th>ID</th><th>SKU</th><th>Category</th><th class="num">Diff</th><th class="num">Inventory</th><th class="num">Qty count</th><th>Type</th><th>Request</th><th>Counted by</th><th>Counted date</th><th>Plan date</th><th>Status</th></tr></thead><tbody>' + (out.join("") || emptyRow(_hpc() ? 13 : 12)) + "</tbody></table></div>" +
      '<div class="hk-note">' + (rs.length > CAP ? ("Hiển thị " + nf(CAP) + " / " + nf(rs.length) + " dòng — lọc để thu hẹp.") : (nf(rs.length) + " dòng.")) + "</div>";
  }
  for (var j = 0; j < rs.length && out.length < CAP; j++){ var l = rs[j];
    out.push("<tr><td>" + idLink(l.id, "loc") + "</td><td><b>" + esc(l.loc) + "</b></td><td>" + dash(l.wh) + "</td><td>" + dash(l.type) + "</td><td>" + dash(l.pri) + "</td>" + dcell(l.diff) + "<td>" + dash(l.req) + "</td><td>" + dash(l.by) + "</td><td>" + fmtD(parseDate(l.cdate)) + "</td><td>" + fmtD(parseDate(l.plan), true) + '</td><td><span class="hk-badge ' + badgeCls(l.st) + '">' + (l.st ? esc(l.st) : "—") + "</span></td></tr>");
  }
  return '<div class="hk-wrap"><table><thead><tr><th>ID</th><th>Location</th><th>Warehouse</th><th>Type</th><th>Priority</th><th class="num">Diff</th><th>Request</th><th>Counted by</th><th>Counted date</th><th>Plan date</th><th>Status</th></tr></thead><tbody>' + (out.join("") || emptyRow(11)) + "</tbody></table></div>" +
    '<div class="hk-note">' + (rs.length > CAP ? ("Hiển thị " + nf(CAP) + " / " + nf(rs.length) + " dòng — lọc để thu hẹp.") : (nf(rs.length) + " dòng.")) + "</div>";
}
/* Bảng DANH SÁCH MÃ distinct (kho|mã) — metric total (coKiem=true, kèm cột trạng thái) & notcount */
function tableRemain(kind, rs, coKiem){
  var out = [];
  var cot = function(m){ return coKiem ? ('<td><span class="hk-badge ' + (m.chk ? "ok" : "pend") + '">' + (m.chk ? "ĐÃ KIỂM" : "CHƯA KIỂM") + "</span></td>") : ""; };
  var ckSku = (kind === "sku" && _hpc());   // chỉ khối SKU có ô tick tạo lệnh
  for (var i = 0; i < rs.length && out.length < CAP_REMAIN; i++){ var m = rs[i];
    out.push(kind === "sku"
      ? "<tr>" + (ckSku ? HPC.cell(m.wh, m.sku, m.pn, pcType(m.type), reasonKk(m)) : "") + "<td><b>" + esc(m.sku) + '</b></td><td class="pn2">' + esc(m.pn) + "</td><td>" + dash(m.cat) + "</td><td>" + esc(m.wh) + '</td><td class="num">' + nf(m.qty) + "</td>" + cot(m) + "</tr>"
      : "<tr><td><b>" + esc(m.loc) + "</b></td><td>" + esc(m.wh) + "</td><td>" + dash(m.type) + "</td>" + cot(m) + "</tr>");
  }
  var head = (ckSku ? HPC.headCell() : "") + (kind === "sku"
    ? '<th>SKU</th><th>Tên sản phẩm</th><th>Category</th><th>Kho</th><th class="num">Tồn (theo phiếu)</th>'
    : "<th>Mã vị trí</th><th>Kho</th><th>Type</th>") + (coKiem ? "<th>Kiểm kê</th>" : "");
  var nCol = (kind === "sku" ? 5 : 3) + (coKiem ? 1 : 0) + (ckSku ? 1 : 0);
  return '<div class="hk-wrap"><table><thead><tr>' + head + "</tr></thead><tbody>" + (out.join("") || emptyRow(nCol)) + "</tbody></table></div>" +
    '<div class="hk-note">' + (rs.length > CAP_REMAIN ? ("Hiển thị " + nf(CAP_REMAIN) + " / " + nf(rs.length) + " dòng — lọc để thu hẹp.") : (nf(rs.length) + (coKiem ? " dòng — distinct (kho|mã) từ phiếu WMS." : " dòng chưa kiểm."))) + "</div>";
}
function openModal(kind, metric){
  /* "Tổng" = toàn bộ universe (kèm cờ đã kiểm) — khớp 1:1 số trên dải;
     "Còn lại" = anti-join key chưa kiểm; metric khác lọc trên phiếu */
  var rows = (metric === "total") ? totalRows(kind)
          : (metric === "notcount") ? remainRows(kind)
          : metricRows(kind, metric);
  MODAL = { kind: kind, metric: metric, rows: rows };
  var U = (kind === "loc") ? "Mã vị trí" : "SKU";
  var lab = (metric.indexOf("st:") === 0) ? ("trạng thái " + stMeta(metric.slice(3))[0]) : METRIC_LABEL[metric];
  $id("hkKkTitle").textContent = U + " · " + lab + (S.wh ? (" · kho " + S.wh) : "") + " — " + nf(rows.length) + " dòng";
  $id("hkKkSub").textContent = (S.wh ? ("Đang lọc theo kho " + S.wh + " · ") : "") + (metric === "total"
    ? "Mẫu số: distinct (kho|mã) từ toàn bộ phiếu kiểm kê WMS — 1 mã nhiều phiếu chỉ tính 1, kèm cột trạng thái kiểm kê"
    : metric === "notcount"
    ? "Anti-join: distinct (kho|mã) trong phiếu WMS TRỪ tập đã kiểm — đây là phần chưa được đụng tới"
    : (metric === "counted" || metric === "negative" || metric === "positive")
    ? "Đã khử trùng phiếu: mỗi (kho|mã) chỉ tính 1 phiếu đã kiểm MỚI NHẤT (ưu tiên phiếu không bị từ chối/huỷ) · bấm ID để mở WMS"
    : "Bấm ID để mở WMS");
  buildFilters();
  mRender();
  var m = $id("hkKkModal"); m.style.display = "flex";
  requestAnimationFrame(function(){ m.classList.add("show"); });
}
/* Thanh lọc TỰ SINH từ dữ liệu bảng — chỉ sinh combo khi cột có >1 giá trị thực */
function buildFilters(){
  var rows = MODAL.rows;
  var defs = [{ k: "wh", lb: "Warehouse" }, { k: "cat", lb: "Category" }, { k: "type", lb: "Type" }, { k: "st", lb: "Trạng thái" }, { k: "by", lb: "Counted by" }];
  var html = "";
  defs.forEach(function(d){
    var uniq = new Set();
    rows.forEach(function(r){ var v = String(r[d.k] || "").trim(); if (v) uniq.add(v); });
    if (uniq.size > 1){
      html += '<div class="fld"><label>' + esc(d.lb) + '</label><div class="hk-combo" data-fk="' + d.k + '" data-lb="' + esc(d.lb) + '">' +
        '<input data-fk="' + d.k + '" autocomplete="off" placeholder="Tất cả…" oninput="HKIEMKE.comboInput(this)" onfocus="HKIEMKE.comboMenu(this.parentNode)">' +
        '<div class="hk-combo-menu"></div></div></div>';
    }
  });
  html += '<div class="fld q"><label>Tìm nhanh</label><input id="hkKkQ" autocomplete="off" placeholder="SKU / tên / vị trí / kho…" oninput="HKIEMKE.quick()"></div>';
  $id("hkKkFilters").innerHTML = html;
}
function qval(){ return (($id("hkKkQ") || {}).value || "").trim().toLowerCase(); }
function fstate(){
  return Array.prototype.slice.call(document.querySelectorAll("#hkKkFilters .hk-combo input")).map(function(inp){
    var v = inp.value.trim();
    return { k: inp.getAttribute("data-fk"), raw: v, v: v.toLowerCase(), exact: !!inp.getAttribute("data-exact") };
  });
}
/* CHỌN từ menu = khớp chính xác; GÕ TAY = khớp chứa */
function rowsWith(excludeK, state, q){
  return MODAL.rows.filter(function(r){
    for (var i = 0; i < state.length; i++){
      var f = state[i];
      if (f.k === excludeK || !f.v) continue;
      var cell = String(r[f.k] || "").trim();
      if (f.exact){ if (cell !== f.raw) return false; }
      else if (cell.toLowerCase().indexOf(f.v) < 0) return false;
    }
    if (q && ((r.sku || "") + " " + (r.pn || "") + " " + (r.loc || "") + " " + (r.wh || "")).toLowerCase().indexOf(q) < 0) return false;
    return true;
  });
}
/* CHAIN-FILTERING: menu mỗi combo sinh từ dòng đã lọc bởi các bộ lọc CÒN LẠI + đếm số dòng */
function comboMenu(combo){
  var k = combo.getAttribute("data-fk"), lb = combo.getAttribute("data-lb");
  var inp = combo.querySelector("input"), menu = combo.querySelector(".hk-combo-menu");
  var uniq = new Set(), cnt = {};
  rowsWith(k, fstate(), qval()).forEach(function(r){ var v = String(r[k] || "").trim(); if (!v) return; uniq.add(v); cnt[v] = (cnt[v] || 0) + 1; });
  var typed = inp.getAttribute("data-exact") ? "" : inp.value.trim().toLowerCase();
  var items = Array.from(uniq).sort().filter(function(v){ return !typed || v.toLowerCase().indexOf(typed) >= 0; });
  var html = '<div class="hk-combo-item all" data-v=""><span class="nm">Tất cả ' + esc(lb) + '</span><span class="c">' + uniq.size + " mục</span></div>";
  html += items.map(function(v){ return '<div class="hk-combo-item" data-v="' + esc(v) + '"><span class="nm">' + esc(v) + '</span><span class="c">' + nf(cnt[v]) + "</span></div>"; }).join("");
  if (!items.length) html += '<div class="hk-combo-empty">Không có mục phù hợp</div>';
  menu.innerHTML = html;
  closeCombos(combo);
  menu.classList.add("show");
}
function comboInput(inp){ inp.removeAttribute("data-exact"); comboMenu(inp.parentNode); quick(); }
function closeCombos(except){
  document.querySelectorAll("#hkKkFilters .hk-combo-menu.show").forEach(function(m){ if (!except || m.parentNode !== except) m.classList.remove("show"); });
}
function quick(){ clearTimeout(_deb); _deb = setTimeout(applyF, 120); }
function applyF(){
  var b = $id("hkKkBody");
  if (b) b.classList.add("is-filtering");
  clearTimeout(_debT);
  _debT = setTimeout(function(){ mRender(); if (b) b.classList.remove("is-filtering"); }, 150);
}
function mRender(){
  var state = fstate(), q = qval();
  var rs = rowsWith(null, state, q);
  var nAct = state.filter(function(f){ return f.v; }).length + (q ? 1 : 0);
  $id("hkKkSum").textContent = nf(rs.length) + " / " + nf(MODAL.rows.length) + " dòng" + (nAct ? " · " + nAct + " bộ lọc đang áp dụng" : "");
  var body = $id("hkKkBody");
  body.innerHTML = (MODAL.metric === "notcount") ? tableRemain(MODAL.kind, rs)
    : (MODAL.metric === "total") ? tableRemain(MODAL.kind, rs, true)
    : tablePhieu(MODAL.kind, rs);
  swap(body);
  if (window.HPC && MODAL.kind === "sku") HPC.syncAll($id("hkKkModal"), rs);
}
function closeModal(){
  var m = $id("hkKkModal"); m.classList.remove("show");
  setTimeout(function(){ m.style.display = "none"; $id("hkKkBody").innerHTML = ""; $id("hkKkFilters").innerHTML = ""; $id("hkKkSum").textContent = ""; }, 240);
}

/* ===== INIT (host gọi mỗi lần mở tab — idempotent) ===== */
var _booted = false;
function init(pane){
  PANE = pane;
  if (!_booted){
    _booted = true;
    var style = document.createElement("style"); style.id = "hk-css"; style.textContent = CSS;
    document.head.appendChild(style);
    var wrap = document.createElement("div"); wrap.innerHTML = MODAL_HTML;
    while (wrap.firstChild) document.body.appendChild(wrap.firstChild);
    $id("hkKkModal").addEventListener("click", function(e){ if (e.target === this) closeModal(); });
    $id("hkFcModal").addEventListener("click", function(e){ if (e.target === this) closeFc(); });
    document.addEventListener("keydown", function(e){
      if (e.key !== "Escape") return;
      var lb = document.getElementById("lightbox"); if (lb && lb.classList.contains("show")) return;
      if ($id("hkFcModal") && $id("hkFcModal").classList.contains("show")) closeFc();
      else if ($id("hkKkModal") && $id("hkKkModal").classList.contains("show")) closeModal();
    });
    /* Delegation 1 lần: chọn mục trong combo pop-up chi tiết (innerHTML rebuild không mất listener) */
    $id("hkKkFilters").addEventListener("click", function(e){
      var it = e.target.closest(".hk-combo-item"); if (!it) return;
      var inp = it.closest(".hk-combo").querySelector("input");
      inp.value = it.getAttribute("data-v") || "";
      if (inp.value) inp.setAttribute("data-exact", "1"); else inp.removeAttribute("data-exact");
      closeCombos(); applyF();
    });
    // Giỏ chọn tạo lệnh kiểm kê (HPC dùng chung) — chỉ khối SKU; chọn-tất-cả theo tập ĐANG LỌC
    if (window.HPC) HPC.wire($id("hkKkModal"), function(){ if (MODAL.kind !== "sku") return []; return rowsWith(null, fstate(), qval()).filter(function(r){ return r.sku; }).map(function(r){ return { wh: r.wh, sku: r.sku, pn: r.pn, t: pcType(r.type), src: reasonKk(r) }; }); });
    /* Delegation pop-up dự báo: bộ chọn khoảng ngày + combo (mọi nhánh preventDefault — control trong <label>) */
    $id("hkFcBody").addEventListener("click", function(e){
      if (e.target.closest("#hkFcDateBtn")){ e.preventDefault();
        var mo = $id("hkFcDatePop").classList.contains("hidden");
        fcCloseMenus(); if (mo) fcOpenDatePop(); else fcCloseDatePop(); return; }
      var day = e.target.closest(".dp-day");
      if (day){ e.preventDefault();
        var iso = day.getAttribute("data-iso");
        if (!FC_DP.selS || (FC_DP.selS && FC_DP.selE)){ FC_DP.selS = iso; FC_DP.selE = ""; }        // bắt đầu dải MỚI
        else if (iso < FC_DP.selS){ FC_DP.selE = FC_DP.selS; FC_DP.selS = iso; }                    // chọn ngược -> hoán đổi
        else FC_DP.selE = iso;                                                                       // chốt hạn chót
        fcPaintSel(); return; }
      var pr = e.target.closest(".dp-presets button"); if (pr){ e.preventDefault(); fcPreset(pr.getAttribute("data-preset")); return; }
      if (e.target.closest("#hkFcDpPrev")){ e.preventDefault(); var v = FC_DP.view, m = v.m - 1, y = v.y; if (m < 0){ m = 11; y--; } FC_DP.view = { y: y, m: m }; fcRenderCal(); return; }
      if (e.target.closest("#hkFcDpNext")){ e.preventDefault(); var v2 = FC_DP.view, m2 = v2.m + 1, y2 = v2.y; if (m2 > 11){ m2 = 0; y2++; } FC_DP.view = { y: y2, m: m2 }; fcRenderCal(); return; }
      if (e.target.closest("#hkFcDpApply")){ e.preventDefault(); fcCommitDate(); return; }
      if (e.target.closest("#hkFcDpClear")){ e.preventDefault(); fcClearDate(); return; }
      if (e.target.closest("#hkFcDatePop")){ e.preventDefault(); return; }   // click nền lịch: không forward
      var it = e.target.closest(".hk-combo-item"); if (!it) return;
      e.preventDefault();   // combo nằm trong <label>: chặn label forward click
      var inp = it.closest(".hk-combo").querySelector("input");
      inp.value = it.textContent; inp.setAttribute("data-v", it.getAttribute("data-v"));
      fcCloseMenus(); fcSim();
    });
    document.addEventListener("click", function(e){
      if (!e.target.closest("#hkKkFilters .hk-combo")) closeCombos();
      if (!e.target.closest("#hkFcBody .hk-combo")) fcCloseMenus();
      if (!e.target.closest("#hkFcDateWrap")) fcCloseDatePop();
    });
    pane.innerHTML = KHUNG;
    loadData();
    return;
  }
  if (!pane.querySelector("#hkGrid")){ pane.innerHTML = KHUNG; render(); capNhatInfo(); }
  if (Date.now() - S.lastAt > STALE_MS) loadData();
}

window.HKIEMKE = {
  init: init, reload: loadData, setWh: setWh,
  open: openModal, closeModal: closeModal,
  comboInput: comboInput, comboMenu: comboMenu, quick: quick,
  fcOpen: fcOpen, closeFc: closeFc, fcToggle: fcToggle, fcSim: fcSim,
  _data: function(){ return S.data; }   // HPC đọc email "Counted by" cho ô Executed By
};
})();
