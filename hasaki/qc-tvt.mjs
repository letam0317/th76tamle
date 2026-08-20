/**
 * qc-tvt.mjs — kiểm nhanh mục "Tồn tại vị trí" trong factory/index.html mà KHÔNG cần mở trình duyệt:
 *   1) mọi khối <script> nội tuyến phải PARSE được (bắt lỗi cú pháp ngay khi vừa sửa);
 *   2) mọi id/hàm mà mục mới tham chiếu phải TỒN TẠI (bắt lỗi gõ nhầm tên);
 *   3) chạy thử lõi lọc/gom số của mục trên dữ liệu mẫu, đối chiếu số tay.
 */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import vm from "node:vm";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(DIR, "..", "factory", "index.html");
const html = fs.readFileSync(FILE, "utf8");
let loi = 0;
const ok = (m) => console.log("  ✓ " + m);
const xau = (m) => { loi++; console.log("  ✗ " + m); };

/* 1) cú pháp mọi khối script nội tuyến */
const khoi = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
console.log("① Cú pháp " + khoi.length + " khối <script> nội tuyến");
khoi.forEach((s, i) => {
  try { new vm.Script(s, { filename: "khoi" + (i + 1) + ".js" }); }
  catch (e) { xau("khối " + (i + 1) + ": " + e.message); }
});
if (!loi) ok("tất cả parse sạch");

/* 2) tham chiếu chéo của mục mới */
console.log("② Tham chiếu của mục Tồn tại vị trí");
const idCan = ["tvtWrap", "tvtmodal", "tvtmTitle", "tvtmSub", "tvtmFilters", "tvtmSum", "tvtmBody"];
idCan.forEach((id) => (html.includes('id="' + id + '"') ? null : xau("thiếu phần tử id=" + id)));
const hamCan = ["tvtLoad", "tvtRender", "tvtRowsInScope", "tvtOpenAll", "tvtOpenLoc", "tvtOpenWh",
  "tvtShowModal", "tvtmBuildFilters", "tvtmComboMenu", "tvtmComboInput", "tvtmQuick", "tvtmApply",
  "tvtmRender", "tvtmState", "tvtmQval", "tvtmRowsWith", "tvtmFdef", "tvtmFltThu", "tvtmFltClear",
  "tvtmFltBadge", "tvtmCloseCombos", "closeTvtModal", "tvtReason", "tvtNgay", "tvtNum", "tvtIdx",
  "tvtSetNhom", "tvtNhomBar", "tvtNhan", "tvtGiaiThich", "tvtBoQua", "tvtBoQuaSt", "tvtChuanSt"];
hamCan.forEach((h) => (new RegExp("function\\s+" + h + "\\s*\\(").test(html) ? null : xau("thiếu hàm " + h + "()")));
// mọi onclick/oninput trong khối mục mới phải trỏ vào hàm có thật
const dungHam = [...html.matchAll(/\b(tvt[A-Za-z]*)\s*\(/g)].map((m) => m[1]);
[...new Set(dungHam)].forEach((h) => {
  if (/^(tvtLoad|tvtRender|tvtRowsInScope|tvtOpen|tvtShow|tvtm|closeTvt|tvtReason|tvtNgay|tvtNum|tvtIdx|tvtGiaiThich)/.test(h) &&
      !new RegExp("function\\s+" + h + "\\s*\\(").test(html)) xau("gọi hàm chưa định nghĩa: " + h + "()");
});
if (!loi) ok("id + hàm khớp hết");

/* 3) chạy thử lõi: nạp đúng đoạn mã của mục vào sandbox rồi kiểm số */
console.log("③ Lõi lọc/gom số");
const mo = html.indexOf("var TVT_TAB='ton-vitri';");
const het = html.indexOf("/* ---------- Pop-up danh sách UID");
if (mo < 0 || het < 0) { xau("không cắt được lõi TVT trong index.html"); }
else {
  const nguon = html.slice(mo, het);
  const ctx = {
    ABN: { company: "", wh: "" },
    abnCompanyOf: (w) => (/GARMENT/i.test(w) ? "Garment" : /MTG/i.test(w) ? "Mastige" : "Khác"),
    abnColor: () => "#000", nf: (x) => String(x || 0), esc: (s) => String(s),
    document: { getElementById: () => null }, cacheGet: () => null, cacheSet: () => {},
    gvizP: async () => null, requestAnimationFrame: () => {}, window: {}, console,
    /* mượn đúng 2 hàm ngày của tab Kiểm kê (cắt từ chính index.html) — kiểm luôn là chúng còn ở đó */
    kkParseDate: null, kkFmtD: null, kkP2: (n) => (n < 10 ? "0" : "") + n,
  };
  vm.createContext(ctx);
  const moD = html.indexOf("function kkParseDate(");
  const hetD = html.indexOf("function kkDayKey(");
  const moF = html.indexOf("function kkFmtD("), hetF = html.indexOf("function kkCountMs(");
  if (moD < 0 || hetD < 0 || moF < 0 || hetF < 0) xau("không cắt được kkParseDate/kkFmtD — mục Tồn tại vị trí đang mượn 2 hàm này");
  else new vm.Script(html.slice(moD, hetD) + html.slice(moF, hetF), { filename: "kk-date.js" }).runInContext(ctx);
  try {
    new vm.Script(nguon, { filename: "tvt-core.js" }).runInContext(ctx);
    ctx.TVT.ok = true;
    ctx.TVT.rows = [
      { wh: "WH - MATERIAL - MTG", loc: "F0-KHO-501-01-01-01", uid: "U1", sku: "S1", qty: 10, cat: "", brand: "", pn: "", nhom: "Vải", grp: "0", st: "", upd: "" },
      { wh: "WH - MATERIAL - MTG", loc: "F0-KHO-501-01-01-01", uid: "U2", sku: "S2", qty: 5, cat: "", brand: "", pn: "", nhom: "NVL khác", grp: "0", st: "", upd: "" },
      { wh: "WH - MATERIAL - GARMENT", loc: "F0-VR-00-00-00-00", uid: "U3", sku: "S1", qty: 7, cat: "", brand: "", pn: "", nhom: "Vải", grp: "0", st: "", upd: "" },
    ];
    const tong = ctx.tvtRowsInScope().length;
    if (tong !== 3) xau("không lọc: mong 3 dòng, được " + tong); else ok("không lọc → 3 dòng");
    ctx.ABN.company = "Garment";
    const g = ctx.tvtRowsInScope();
    if (g.length !== 1 || g[0].uid !== "U3") xau("lọc công ty Garment sai: " + JSON.stringify(g.map((r) => r.uid)));
    else ok("lọc công ty Garment → 1 dòng (U3)");
    ctx.ABN.company = ""; ctx.ABN.wh = "WH - MATERIAL - MTG";
    if (ctx.tvtRowsInScope().length !== 2) xau("lọc theo kho sai"); else ok("lọc theo kho → 2 dòng");
    // ngày: WMS trả chuỗi "2026-08-13 09:24:58"
    if (ctx.tvtNgay("2026-08-13 09:24:58") !== "13/08/2026 09:24") xau("tvtNgay chuỗi WMS sai: " + ctx.tvtNgay("2026-08-13 09:24:58"));
    else ok("tvtNgay '2026-08-13 09:24:58' → 13/08/2026 09:24");
    /* gviz trả cột ngày thành chuỗi "Date(y,m,d,…)" với THÁNG ĐẾM TỪ 0 — bẫy đã bắt được ở lượt
       QC live 19/08 (bảng in nguyên "Date(2026,5,5,14,23,57)"). */
    if (ctx.tvtNgay("Date(2026,5,5,14,23,57)") !== "05/06/2026 14:23") xau("tvtNgay dạng gviz sai: " + ctx.tvtNgay("Date(2026,5,5,14,23,57)"));
    else ok("tvtNgay 'Date(2026,5,5,14,23,57)' → 05/06/2026 14:23 (tháng 0-based)");
    if (ctx.tvtNgay("") !== "") xau("tvtNgay ô rỗng phải ra chuỗi rỗng");
    if (ctx.tvtNum("1,502,390") !== 1502390) xau("tvtNum sai: " + ctx.tvtNum("1,502,390")); else ok("tvtNum '1,502,390' → 1502390");
    // chip Nhóm: lọc đúng, và số đếm trên chip KHÔNG co lại theo chính bộ lọc nhóm
    ctx.ABN.wh = ""; ctx.TVT.nhom = "Vải";
    const v = ctx.tvtRowsInScope();
    if (v.length !== 2 || v.some((r) => r.nhom !== "Vải")) xau("lọc nhóm Vải sai: " + v.length + " dòng");
    else ok("lọc nhóm Vải → 2 dòng");
    if (ctx.tvtRowsInScope(true).length !== 3) xau("chip nhóm tự co theo chính nó (phải bỏ qua bộ lọc nhóm)");
    else ok("số đếm chip nhóm giữ nguyên 3 dòng khi đang lọc");
    const bar = ctx.tvtNhomBar();
    if (!/Vải/.test(bar) || !/NVL khác/.test(bar)) xau("tvtNhomBar thiếu chip"); else ok("tvtNhomBar dựng đủ 2 chip + Tất cả");
    ctx.TVT.nhom = "";
    /* Khu + trạng thái MIỄN TRỪ: chốt phòng hờ phía dashboard (bộ sync đã cắt từ đầu). Hai danh sách
       này phải TRÙNG với VT_BO_QUA/ST_BO_QUA bên ton-vitri.mjs — qc-tvt-quet canh phía sync. */
    const bq = [["F0-KHO-HM-01-04-01", true], ["F0-KHO-HM", true], ["F0-AJ-00-00-00-00", true], ["F0-AJ", true],
      ["F0-KHO-503-09-04-01", false], ["F0-KHO-507-01-03-01", false], ["F0-A0-00-00-00-00", false]];
    bq.forEach(([v, mong]) => { if (ctx.tvtBoQua(v) !== mong) xau("tvtBoQua('" + v + "') = " + ctx.tvtBoQua(v) + ", mong " + mong); });
    ok("tvtBoQua: F0-KHO-HM* + F0-AJ* bị loại, F0-KHO khác giữ nguyên");
    const bqs = [["Adjustment - shipped", true], ["Adjustment - Shipped", true], ["ADJUSTMENT-SHIPPED", true],
      ["In-BIN", false], ["Returned supplier", false], ["Removed", false], ["Not found", false], ["", false]];
    bqs.forEach(([v, mong]) => { if (ctx.tvtBoQuaSt(v) !== mong) xau("tvtBoQuaSt('" + v + "') = " + ctx.tvtBoQuaSt(v) + ", mong " + mong); });
    ok("tvtBoQuaSt: Adjustment - shipped bị loại (mọi biến thể), trạng thái khác giữ nguyên");
  } catch (e) { xau("chạy lõi lỗi: " + e.message); }
}

console.log(loi ? "\n✗ " + loi + " lỗi" : "\n✓ QC Tồn tại vị trí: đạt");
process.exit(loi ? 1 : 0);
