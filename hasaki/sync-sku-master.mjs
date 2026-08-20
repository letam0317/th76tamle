/**
 * sync-sku-master.mjs — DANH MỤC SKU NGUYÊN LIỆU (nguồn cho tab "Nhận diện SKU")
 *  WMS report-management/stock-inventories  →  Google Sheet factory, tab "SKU_MASTER"
 *
 *  6 CỘT — 5 cột đầu là HỢP ĐỒNG với dashboard (đừng đổi thứ tự), cột F là phần thêm 19/08/2026:
 *    A SKU · B PRODUCTNAME · C TYPE (COMBO|NORMAL) · D STATUS (ACTIVE|INACTIVE) · E INVENTORY_QTY
 *    F UNIT (đơn vị tính, xem bên dưới) — chỉ THÊM VÀO CUỐI nên bản dashboard cũ vẫn đọc được.
 *
 *  ── PHẠM VI: CHỈ KHO NGUYÊN LIỆU ─────────────────────────────────────────────────────────────
 *  Tem NCC (chỉ, nút, dây kéo, nhãn…) chỉ xuất hiện ở kho nguyên liệu, nên danh mục chỉ lấy
 *  3 kho đó (~5.600 SKU) thay vì cả factory (~150.000 dòng):
 *    · 1177 WH - MATERIAL - MTG (Mastige 1002) · 1458 NG - MATERIAL - 130 AP CHANH - MTG
 *    · 1339 WH - MATERIAL - GARMENT (Garment 1005)
 *  Lợi ích kép: chỉ ~7 lượt gọi WMS mỗi lượt sync (luật "nhẹ tải upstream") và dashboard chỉ tải
 *  ~700 KB thay vì ~20 MB. Cần rộng hơn thì chạy `--tat-ca` (mọi kho factory) — lúc đó nhớ đo lại
 *  thời gian mở tab trên điện thoại trước khi chốt.
 *
 *  ── TYPE / STATUS lấy ở đâu ──────────────────────────────────────────────────────────────────
 *  · TYPE   : `product_type` của WMS. Combo → COMBO; Normal/Material/khác → NORMAL (hợp đồng
 *             dashboard chỉ có 2 giá trị; tên hàng vẫn giữ tiền tố "(Combo)" của WMS nên không
 *             mất thông tin).
 *  · STATUS : WMS **KHÔNG** có cờ active/inactive trong báo cáo này (đã kiểm 18/08/2026: 18 trường,
 *             không có status/is_active; `last_modified` bị làm tươi liên tục — 100% dòng ≤ 90 ngày
 *             — nên không dùng để suy ra "SKU chết"). STATUS ở đây là SUY RA, hiểu đúng nghĩa:
 *               ACTIVE   = còn dấu hiệu đang dùng: in_stock > 0 hoặc available > 0 hoặc in_coming > 0
 *               INACTIVE = không tồn, không hàng đang về (≈ 2.200/5.600 SKU)
 *             Dashboard mặc định chỉ gợi ý ACTIVE (theo đặc tả) nhưng CÓ công tắc xem cả INACTIVE
 *             — vì SKU vừa nhập lần đầu, chưa có PO ghi nhận, cũng nằm ở nhóm INACTIVE.
 *             Thẻ gợi ý trên dashboard LUÔN hiện chữ ACTIVE/INACTIVE (không chỉ khi chết).
 *  · UNIT   : WMS cũng KHÔNG có trường đơn vị (đã kiểm 19/08/2026: 31 trường, không unit/uom).
 *             Đơn vị nằm ở ĐOẠN CUỐI sau dấu "/" của product_name — "…/mm", "…/mét", "…/gam",
 *             "…/cuộn 5000m". Cột này chép NGUYÊN đoạn đó (không chuẩn hoá) để người đọc Sheet lọc
 *             được; việc xếp hạng "đơn vị nào nhỏ hơn" do lõi NDS_ENGINE của dashboard làm, một
 *             chỗ duy nhất (hàm donVi/khoaHang) nên hai bên không có gì để lệch nhau.
 *             Vì sao cần: 472/5.049 nhóm tên hàng có ≥2 SKU chỉ khác đơn vị (mét↔mm, yard↔mm,
 *             cuộn↔mm). Kiểm kê đếm bằng đơn vị NHỎ NHẤT nên dashboard phải gợi ý đúng SKU đó.
 *
 *  ── PHIÊN WMS ────────────────────────────────────────────────────────────────────────────────
 *  Bước này TUYỆT ĐỐI KHÔNG tự đăng nhập (không mở Edge, không bấm SSO → không đá phiên ai).
 *  Không có token sống thì thoát 75 (hoãn) để lượt cụm/guard sau chạy lại — trong cụm nó đứng sau
 *  sync-stocklocation nên token trong kho luôn còn tươi.
 *
 *  ── BÙ BIẾN THỂ ĐƠN VỊ NHỎ (--bu-bien-the) · 20/08/2026 ──────────────────────────────────────
 *  Sự cố C2080 (xem NHAN-DIEN-SKU.md 5b.10): tem chỉ C2080 chỉ gợi ý được bản "/Cuộn 5000m" vì bản
 *  "/mm" của CÙNG mặt hàng (422304419) chỉ tồn tại ở kho **1178 WH - SEMI PRODUCT - MTG** — ngoài
 *  phạm vi 3 kho nguyên liệu. Kiểm kê đếm bằng đơn vị NHỎ NHẤT nên thiếu nó là thiếu đúng cái cần.
 *  Quy mô: 1.088/5.053 mặt hàng trong danh mục chỉ còn SKU đơn vị GỘP/COMBO còn sống.
 *
 *  Vì endpoint KHÔNG nhận lọc theo category (đã thử category_name/category_names/categories — bị bỏ
 *  qua y như `keyword=`), quét kho 1178 tốn ~128 trang. Nên việc này KHÔNG nằm trong cụm hằng ngày:
 *    · `--bu-bien-the` : chạy TAY (định kỳ dài). Quét mọi kho NGOÀI 3 kho nguyên liệu, giữ lại đúng
 *      những dòng là **biến thể đơn vị NHỎ HƠN của mặt hàng ĐÃ có trong danh mục** rồi lưu ra
 *      `sku-bien-the.json`. Không ghi Sheet.
 *    · Lượt sync thường: đọc file đó và **merge** vào danh mục (SKU nào đã có trong 3 kho nguyên liệu
 *      thì giữ bản của kho nguyên liệu). Vẫn đúng ~7 lượt gọi WMS mỗi ngày.
 *  Dòng bù vào LUÔN mang `INVENTORY_QTY = 0` ⇒ `STATUS = INACTIVE`: tồn của nó nằm ở kho khác, ghi số
 *  đó vào đây là nói dối về kho nguyên liệu. Việc "tồn 0 mà vẫn phải đứng đầu" do NDS_ENGINE xử
 *  (đại diện nhóm ưu tiên bản đơn vị nhỏ khi cả nhóm chỉ còn bản gộp) — một chỗ duy nhất.
 *  `khoaHang`/`donVi` KHÔNG cài lại ở đây: cắt thẳng lõi NDS_ENGINE ra khỏi `factory/index.html` như
 *  2 bộ test vẫn làm, để không bao giờ có 2 định nghĩa "cùng mặt hàng / đơn vị nhỏ hơn".
 *
 *  node sync-sku-master.mjs [--tat-ca] [--dry] [--bu-bien-the]
 */
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { layTokenSongWms, fetchThuLai, ghiMocBuoc, boQuaNeuDaTuoi, hashTab, tabKhongDoi,
  luuHashTab, chamMocTabs, gasPost, thoatTheoLoi, DEFER_EXIT } from "./session-rules.js";
import { kiemTruocKhiGhi, xacNhanDaGhi } from "./tu-chua.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const APPSCRIPT_KEY = process.env.APPSCRIPT_KEY;
const SHEET_FACTORY = "1eY_oo9fAvWCTXp24x-Z0FXq9mp_jJPlTHg09qdemETs";   // sheet stocklocationfactory
const TAB = "SKU_MASTER";
const API = "https://wms-gw.inshasaki.com/api/v1/wms/report-management/stock-inventories";
const SIZE = 1000, MAX_PAGE = 250, CHUNK = 4000;
const TAT_CA = process.argv.includes("--tat-ca");
const DRY = process.argv.includes("--dry");
const BU = process.argv.includes("--bu-bien-the");
const BU_MAU = process.argv.includes("--bu-kho-mau");
/* File "biến thể đơn vị nhỏ nhặt từ ngoài phạm vi" — xem khối ghi chú BÙ BIẾN THỂ bên dưới. */
const F_BIENTHE = path.join(DIR, "sku-bien-the.json");
/* Kho MẪU (1441 SAMPLE - 130 AP CHANH - MTG) — xem khối ghi chú BÙ KHO MẪU bên dưới. */
const F_KHOMAU = path.join(DIR, "sku-kho-mau.json");
const KHO_MAU = { ten: "SAMPLE - 130 AP CHANH - MTG", company: "1002", warehouses: "1441" };

/* Kho NGUYÊN LIỆU (mặc định) vs MỌI kho factory (--tat-ca). Id ↔ tên đã đối chiếu 18/08/2026. */
const BO = TAT_CA
  ? [
      { ten: "Mastige", company: "1002", warehouses: "1458,1441,1307,1250,1179,1178,1177,1151" },
      { ten: "Garment", company: "1005", warehouses: "1516,1341,1340,1339,1266" },
    ]
  : [
      { ten: "Mastige · kho nguyên liệu", company: "1002", warehouses: "1177,1458" },
      { ten: "Garment · kho nguyên liệu", company: "1005", warehouses: "1339" },
    ];

const HEADER = ["SKU", "PRODUCTNAME", "TYPE", "STATUS", "INVENTORY_QTY", "UNIT"];
/** Đơn vị tính = đoạn cuối sau dấu "/" của product_name ("…/mm" → "mm"). Tên không có "/" → "". */
const bocDonVi = (pn) => { const i = String(pn).lastIndexOf("/"); return i < 0 ? "" : String(pn).slice(i + 1).trim(); };
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);
const nghi = (ms) => new Promise((r) => setTimeout(r, ms));
const n0 = (v) => { const n = Number(String(v == null ? "" : v).replace(/,/g, "")); return isNaN(n) ? 0 : n; };
if (!APPSCRIPT_KEY && !DRY) { console.error("✗ Thiếu APPSCRIPT_KEY trong .env."); process.exit(3); }

/** Chuẩn hoá 1 dòng WMS → mảnh dùng để gộp theo SKU. */
function bocDong(it) {
  const sku = String(it.sku || it.product_sku || "").trim();
  if (!sku) return null;
  const pn = String(it.product_name || it.name || "").trim();
  const ton = n0(it.in_stock) || n0(it.total);
  const kd = n0(it.available) || n0(it.available_for_sale);
  const den = n0(it.in_coming) + n0(it.in_coming_po);
  return {
    sku, pn,
    combo: /^combo$/i.test(String(it.product_type || "")) || /^\(combo\)/i.test(pn),
    qty: ton,
    song: ton > 0 || kd > 0 || den > 0,
  };
}

/** Cắt lõi NDS_ENGINE ra khỏi dashboard (y như 2 bộ test) — dùng `khoaHang` + `donVi` của CHÍNH nó. */
function napLoi() {
  const f = path.resolve(DIR, "..", "factory", "index.html");
  const html = fs.readFileSync(f, "utf8");
  const i1 = html.indexOf("/*<NDS-ENGINE>*/"), i2 = html.indexOf("/*</NDS-ENGINE>*/");
  if (i1 < 0 || i2 < 0) throw new Error("Không thấy mốc NDS-ENGINE trong " + f);
  return new Function(`${html.slice(i1, i2)}
 return NDS_ENGINE;`)();
}
/** Danh sách kho NGOÀI 3 kho nguyên liệu (id ↔ tên đối chiếu 20/08/2026, kèm số dòng lúc đo). */
const KHO_NGOAI = [
  { ten: "Mastige", company: "1002", warehouses: "1178,1151,1441,1179,1250,1307" },   // SEMI PRODUCT 127k · OFFICE 5,5k · SAMPLE 3,5k · FINISHED 3k · NG-OFFICE 2,3k · GARMENT-MTG 12
  { ten: "Garment", company: "1005", warehouses: "1340,1266,1516,1341" },             // SEMI PRODUCT 2,6k · SHOP 819 · NG 303 · FINISHED 6
];
/** Đọc một file bù → mảng dòng 6 cột (rỗng nếu chưa chạy lượt nhặt tay lần nào). */
function docFileBu(f) {
  try {
    const o = JSON.parse(fs.readFileSync(f, "utf8"));
    return { at: o.at || "", rows: Array.isArray(o.rows) ? o.rows : [] };
  } catch { return { at: "", rows: [] }; }   /* chưa nhặt lần nào: coi như không có gì để bù */
}

/**
 * `--bu-kho-mau`: chụp NGUYÊN kho MẪU (1441) ra `sku-kho-mau.json`. 4 lượt gọi, chạy TAY.
 *
 *  Vì sao cần (ca 20/08/2026): thủ kho chụp **thẻ thông tin mẫu** nội bộ (mã sản phẩm SMPA01) —
 *  tab gợi ý ra 3 SKU vải/chỉ chỉ khớp mấy chữ chung "87%/13%/đen". Tra WMS thì SMPA01 CÓ THẬT,
 *  2 SKU, nhưng cả hai nằm ở kho MẪU nên hoàn toàn ngoài phạm vi danh mục.
 *  Vì sao KHÔNG đưa vào cụm hằng ngày: user chốt giữ tải upstream. Mẫu sinh mới liên tục nên bản
 *  chụp sẽ cũ dần — cần thì chạy lại, đúng 4 lượt gọi.
 *  Tồn ở đây là TỒN THẬT CỦA KHO MẪU (1.793/3.485 dòng có tồn > 0) chứ không để 0 như file biến
 *  thể: món mẫu nằm ĐÚNG trong kho mẫu, đó là chỗ người ta đếm nó. Dòng tồn 0 vẫn tra được nhờ
 *  luật "định danh thắng phạm vi" của lõi (mã tem khớp tuyệt đối thì INACTIVE vẫn hiện).
 */
async function buKhoMau(token) {
  const rows = [];
  let trang = 0;
  for (let page = 1; page <= MAX_PAGE; page++) {
    const u = API + "?company_ids=" + KHO_MAU.company + "&warehouse_ids=" + KHO_MAU.warehouses +
      "&page=" + page + "&size=" + SIZE;
    const r = await fetchThuLai(u, { headers: { authorization: token, "Company-Ids": KHO_MAU.company } }).catch(() => null);
    if (!r || !r.ok) { log("  ⚠ kho mẫu trang " + page + ": " + (r ? "HTTP " + r.status : "lỗi mạng") + " — dừng."); break; }
    const j = await r.json().catch(() => null); if (!j) break;
    const recs = (j.records || (j.data && j.data.records)) || [];
    if (!recs.length) break;
    trang++;
    for (const it of recs) {
      const d = bocDong(it); if (!d) continue;
      rows.push([d.sku, d.pn, d.combo ? "COMBO" : "NORMAL", d.song ? "ACTIVE" : "INACTIVE", Math.round(d.qty), bocDonVi(d.pn)]);
    }
    if (recs.length < SIZE) break;
    await nghi(300);
  }
  rows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  fs.writeFileSync(F_KHOMAU, JSON.stringify({
    at: new Date().toISOString(),
    moTa: "Bản chụp NGUYÊN kho 1441 SAMPLE - 130 AP CHANH - MTG (tồn là tồn thật của kho mẫu). " +
      "Chạy lại khi cần: node sync-sku-master.mjs --bu-kho-mau",
    trang, rows,
  }, null, 1));
  const soActive = rows.filter((r) => r[3] === "ACTIVE").length;
  log("✓ Bù kho mẫu: " + trang + " trang → " + rows.length + " SKU (" + soActive + " có tồn). Lưu: " + F_KHOMAU);
  log("  → chạy `node sync-sku-master.mjs` để đẩy danh mục đã gộp lên tab " + TAB + ".");
}

/** `--bu-bien-the`: quét kho ngoài phạm vi, lưu những biến thể ĐƠN VỊ NHỎ HƠN còn thiếu. */
async function buBienThe(token, goc) {
  const E = napLoi();
  /* Mỗi mặt hàng (khoaHang) của danh mục hiện có: đơn vị nhỏ nhất đang biết + các đơn vị đã có. */
  const ho = new Map();
  for (const o of goc.values()) {
    const k = E.khoaHang(o.pn), q = E.donVi(o.pn).q;
    const cu = ho.get(k);
    if (!cu) ho.set(k, { qNho: q, dv: new Set([E.donVi(o.pn).raw.toLowerCase()]) });
    else { cu.qNho = Math.min(cu.qNho, q); cu.dv.add(E.donVi(o.pn).raw.toLowerCase()); }
  }
  log("Bù biến thể: " + ho.size + " mặt hàng trong danh mục nguyên liệu · quét " +
    KHO_NGOAI.reduce((n, b) => n + b.warehouses.split(",").length, 0) + " kho ngoài phạm vi.");

  const nhat = new Map();
  let quet = 0, trang = 0;
  for (const cfg of KHO_NGOAI) {
    for (let page = 1; page <= MAX_PAGE; page++) {
      const u = API + "?company_ids=" + cfg.company + "&warehouse_ids=" + encodeURIComponent(cfg.warehouses) +
        "&page=" + page + "&size=" + SIZE;
      const r = await fetchThuLai(u, { headers: { authorization: token, "Company-Ids": cfg.company } }).catch(() => null);
      if (!r || !r.ok) { log("  ⚠ " + cfg.ten + " trang " + page + ": " + (r ? "HTTP " + r.status : "lỗi mạng") + " — dừng bộ này."); break; }
      const j = await r.json().catch(() => null); if (!j) break;
      const recs = (j.records || (j.data && j.data.records)) || [];
      if (!recs.length) break;
      quet += recs.length; trang++;
      for (const it of recs) {
        const d = bocDong(it); if (!d || goc.has(d.sku) || nhat.has(d.sku)) continue;
        const h = ho.get(E.khoaHang(d.pn)); if (!h) continue;             // không phải mặt hàng của kho nguyên liệu
        const dv = E.donVi(d.pn);
        if (dv.q >= h.qNho || h.dv.has(dv.raw.toLowerCase())) continue;   // không nhỏ hơn / đã có đơn vị này
        nhat.set(d.sku, { sku: d.sku, pn: d.pn, combo: d.combo, dv: dv.raw });
      }
      if (recs.length < SIZE) break;
      if (trang % 20 === 0) log("  … đã quét " + trang + " trang / " + quet + " dòng, nhặt được " + nhat.size + " biến thể.");
      await nghi(300);
    }
  }
  const rows = [...nhat.values()]
    .sort((a, b) => (a.sku < b.sku ? -1 : a.sku > b.sku ? 1 : 0))
    .map((o) => [o.sku, o.pn, o.combo ? "COMBO" : "NORMAL", "INACTIVE", 0, bocDonVi(o.pn)]);
  fs.writeFileSync(F_BIENTHE, JSON.stringify({
    at: new Date().toISOString(),
    moTa: "Biến thể ĐƠN VỊ NHỎ HƠN của các mặt hàng trong 3 kho nguyên liệu, nhặt từ kho ngoài phạm vi " +
      "(chủ yếu WH - SEMI PRODUCT). Tồn để 0 vì tồn thật nằm ở kho khác. Chạy lại: node sync-sku-master.mjs --bu-bien-the",
    trang, quet, rows,
  }, null, 1));
  log("✓ Bù biến thể: quét " + trang + " trang / " + quet + " dòng → " + rows.length + " SKU biến thể đơn vị nhỏ. Lưu: " + F_BIENTHE);
  log("  → chạy `node sync-sku-master.mjs` để đẩy danh mục đã gộp lên tab " + TAB + ".");
}

(async () => {
  if (!BU && boQuaNeuDaTuoi(DIR, "skumaster", log)) process.exit(0);
  const token = await layTokenSongWms(DIR, log);
  if (!token) {
    log("⏸ Chưa có token WMS sống — bước này KHÔNG tự đăng nhập (tránh đá phiên người đang làm).");
    log("  → hoãn: lượt cụm/watchdog sau (sau sync-stocklocation) sẽ chạy lại.");
    process.exit(DEFER_EXIT);
  }

  /* Chụp kho mẫu KHÔNG cần danh mục nguyên liệu → chạy ngay, đúng 4 lượt gọi (đặt sau vòng quét
     dưới thì tốn thêm 7 lượt vô ích — đã cắn 20/08/2026 ở lượt chạy đầu). */
  if (BU_MAU) { await buKhoMau(token); process.exit(0); }

  /* Gộp theo SKU: 1 SKU có thể nằm ở nhiều kho nguyên liệu → INVENTORY_QTY là TỔNG các kho
     trong phạm vi (hợp đồng 5 cột không có cột kho; dashboard ghi rõ điều này ở chú thích tab). */
  const gom = new Map();
  let quet = 0, thieu = [];
  for (const cfg of BO) {
    let total = null, seen = 0;
    for (let page = 1; page <= MAX_PAGE; page++) {
      const u = API + "?company_ids=" + cfg.company + "&warehouse_ids=" + encodeURIComponent(cfg.warehouses) +
        "&page=" + page + "&size=" + SIZE;
      const r = await fetchThuLai(u, { headers: { authorization: token, "Company-Ids": cfg.company } }).catch(() => null);
      if (!r || !r.ok) { log("  ⚠ " + cfg.ten + " trang " + page + ": " + (r ? "HTTP " + r.status : "lỗi mạng") + " — dừng bộ này."); break; }
      /* ⚠ 20/08/2026 — LỖI THẬT: chỗ này `if (!j) break;` KHÔNG log gì. Một lượt trả về không phải
         JSON là vòng quét dừng ÊM ở trang 2 và bản ghi lên Sheet thiếu 3.820 SKU nguyên liệu mà
         không dòng log nào bất thường — tổng số dòng chỉ tụt 4% (phần bù kho mẫu che mất) nên cổng
         chặn ghi rác `kiemTruocKhiGhi` cũng cho qua. Nay: LOG + đánh dấu bộ này là THIẾU. */
      const j = await r.json().catch(() => null);
      if (!j) { log("  ⚠ " + cfg.ten + " trang " + page + ": phản hồi không phải JSON — dừng bộ này."); break; }
      if (total === null) total = j.count ?? j.total ?? (j.data && (j.data.count ?? j.data.total)) ?? null;
      const recs = (j.records || (j.data && j.data.records)) || [];
      if (!recs.length) break;
      seen += recs.length; quet += recs.length;
      for (const it of recs) {
        const d = bocDong(it); if (!d) continue;
        const o = gom.get(d.sku);
        if (!o) { gom.set(d.sku, d); continue; }
        // Trùng SKU giữa các kho: cộng tồn, giữ tên dài hơn (tên WMS đôi khi bị cắt), OR dấu hiệu sống
        o.qty += d.qty;
        o.song = o.song || d.song;
        if (d.pn.length > o.pn.length) o.pn = d.pn;
        o.combo = o.combo || d.combo;
      }
      if ((total != null && seen >= total) || recs.length < SIZE) break;
      await nghi(300);
    }
    const du = total == null || seen >= total;
    if (!du) thieu.push(cfg.ten + " (" + seen + "/" + total + ")");
    log((du ? "  ✓ " : "  ⚠ ") + cfg.ten + ": quét " + seen + " dòng" + (total != null ? " / " + total : "") + (du ? "." : " — THIẾU."));
  }
  /* QUÉT THIẾU THÌ KHÔNG ĐƯỢC GHI (vá 20/08/2026, sau khi đã ghi hụt một lượt). Danh mục là nguồn
     DUY NHẤT của tab Nhận diện SKU: ghi bản thiếu lên là tem của mấy nghìn SKU bị mất kia đều ra
     "không tìm thấy" mà không ai biết vì sao. Thoát 75 (hoãn) để lượt cụm/watchdog sau chạy lại. */
  if (thieu.length) {
    log("✗ Quét THIẾU: " + thieu.join(" · ") + " — GIỮ dữ liệu cũ, KHÔNG ghi.");
    process.exit(DEFER_EXIT);
  }

  if (BU) { await buBienThe(token, gom); process.exit(0); }

  /* GỘP FILE BÙ BIẾN THỂ (xem khối ghi chú BÙ BIẾN THỂ đầu file). SKU nào đã có ở kho nguyên liệu thì
     giữ bản của kho nguyên liệu — file bù chỉ THÊM cái còn thiếu, không bao giờ đè. */
  for (const bu of [
    { ten: "biến thể đơn vị nhỏ", f: F_BIENTHE, co: "--bu-bien-the", giuTon: false },
    { ten: "kho mẫu (SAMPLE)", f: F_KHOMAU, co: "--bu-kho-mau", giuTon: true },
  ]) {
    const bt = docFileBu(bu.f);
    if (!bt.rows.length) { log("  · Chưa có file bù " + bu.ten + " — chạy `node sync-sku-master.mjs " + bu.co + "` khi cần."); continue; }
    let soBu = 0;
    for (const r of bt.rows) {
      const sku = String(r[0] || "").trim(); if (!sku || gom.has(sku)) continue;
      /* `giuTon`: dòng kho mẫu mang TỒN THẬT của kho mẫu (món mẫu nằm đúng ở đó); dòng biến thể đơn
         vị nhỏ thì tồn nằm ở kho khác nên phải để 0, ghi số đó vào đây là nói dối về kho nguyên liệu. */
      const qty = bu.giuTon ? (Number(r[4]) || 0) : 0;
      gom.set(sku, { sku, pn: String(r[1] || ""), combo: String(r[2]).toUpperCase() === "COMBO",
        qty, song: bu.giuTon ? qty > 0 : false });
      soBu++;
    }
    log("  + Bù " + bu.ten + ": " + soBu + "/" + bt.rows.length + " SKU (file chụp " +
      String(bt.at).slice(0, 10) + (bt.rows.length - soBu ? "; " + (bt.rows.length - soBu) + " cái đã có sẵn trong phạm vi" : "") + ").");
  }

  /* Sắp xếp CỐ ĐỊNH theo SKU: hash tab mới ổn định giữa các lượt (không thì ngày nào cũng ghi lại). */
  const rows = [...gom.values()]
    .sort((a, b) => (a.sku < b.sku ? -1 : a.sku > b.sku ? 1 : 0))
    .map((o) => [o.sku, o.pn, o.combo ? "COMBO" : "NORMAL", o.song ? "ACTIVE" : "INACTIVE", Math.round(o.qty), bocDonVi(o.pn)]);

  const soActive = rows.filter((r) => r[3] === "ACTIVE").length;
  const soCombo = rows.filter((r) => r[2] === "COMBO").length;
  const soKhongDv = rows.filter((r) => !r[5]).length;
  log("Tổng: quét " + quet + " dòng → " + rows.length + " SKU khác nhau (" +
    soActive + " ACTIVE / " + (rows.length - soActive) + " INACTIVE · " + soCombo + " COMBO · " +
    new Set(rows.map((r) => r[5]).filter(Boolean)).size + " đơn vị tính khác nhau" +
    (soKhongDv ? ", " + soKhongDv + " dòng tên không có dấu '/'" : "") + ").");

  if (DRY) {
    const f = path.join(DIR, ".sku-master-dry.json");
    fs.writeFileSync(f, JSON.stringify({ header: HEADER, rows }, null, 1));
    log("(--dry) Không ghi Sheet. Đã lưu bản nháp: " + f);
    process.exit(0);
  }
  if (!rows.length) { log("⚠ 0 SKU — bỏ qua ghi (giữ dữ liệu cũ trên tab)."); process.exit(2); }

  // Cổng chặn ghi rác (tu-chua): tụt số dòng bất thường thì GIỮ dữ liệu cũ + mở sự cố
  const cong = await kiemTruocKhiGhi(DIR, { nguon: TAB, tenHienThi: "Danh mục SKU (Nhận diện SKU)", header: HEADER, rows, cotSo: [4], log });
  if (!cong.ghi) process.exit(2);

  const apiAt = Date.now();
  const hash = hashTab(HEADER, rows);
  if (tabKhongDoi(DIR, TAB, hash)) {
    log("  = " + TAB + ": không đổi — bỏ qua ghi (" + rows.length + " SKU).");
    await chamMocTabs([TAB], apiAt, log); await xacNhanDaGhi(DIR, TAB, rows.length);
    ghiMocBuoc(DIR, "skumaster");
    process.exit(0);
  }
  for (let i = 0; i < rows.length; i += CHUNK) {
    const phan = rows.slice(i, i + CHUNK);
    const body = JSON.stringify({ action: "syncTasks", key: APPSCRIPT_KEY, tab: TAB, sheetId: SHEET_FACTORY,
      header: HEADER, rows: phan, append: i > 0, apiAt });
    const j = await gasPost(body, log, TAB + " gói " + (i / CHUNK + 1));
    if (j.status !== "success") { log("✗ Ghi " + TAB + " lỗi: " + (j.message || "?")); process.exit(2); }
    log("  ✓ " + TAB + ": ghi " + Math.min(i + CHUNK, rows.length) + "/" + rows.length + (i === 0 ? " (xoá data cũ trước)" : " (nối tiếp)"));
  }
  luuHashTab(DIR, TAB, hash);
  await xacNhanDaGhi(DIR, TAB, rows.length);
  ghiMocBuoc(DIR, "skumaster");
  log("✓ HOÀN TẤT — tab " + TAB + " đã có danh mục mới.");
  process.exit(0);
})().catch((e) => { thoatTheoLoi(e, log, 2); });
