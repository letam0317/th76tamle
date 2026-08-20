/**
 * ton-vitri.mjs — "TỒN TẠI VỊ TRÍ": bắt UID VẢI nguyên liệu CHƯA khai báo UID group mà lại
 * nằm ngoài vị trí chờ khai báo F0-A0-00-00-00-00.
 *
 *  LUẬT NGHIỆP VỤ (người dùng chốt 19/08/2026):
 *    SKU vải nguyên liệu BẮT BUỘC phải khai báo UIDgr code. UID nào chưa khai báo
 *    (trên WMS hiện "Group UID / RFID mapping: 0", "RFID mapping: N/A") thì BUỘC phải
 *    đang nằm ở vị trí F0-A0-00-00-00-00 (bãi chờ). Nằm ở vị trí khác F0-A0 ⇒ BẤT THƯỜNG.
 *
 *  PHẠM VI (người dùng chốt cùng ngày, sau lượt chạy đầu): CHỈ SKU **vải** (xem `nhomVai`),
 *  CHỈ 2 kho **WH - MATERIAL - MTG** + **WH - MATERIAL - GARMENT** (xem `BO_TVT`), và **TRỪ** các
 *  vị trí tiền tố **F0-KHO-HM** (xem `VT_BO_QUA`). Lượt đầu quét cả danh mục 463 ở 13 kho ra
 *  2.039 dòng, nhưng 1.500 trong đó là "Chỉ Lenio" — chỉ/sợi không chịu luật UIDgr nên là nhiễu.
 *  Thu phạm vi: 2.039 → 446 (chỉ vải, 2 kho) → **337** (trừ F0-KHO-HM).
 *
 *  NGUỒN: GET /api/v1/wms/report-management/report-inventories  (bản ghi mức UID)
 *    · header BẮT BUỘC `Company-Ids` (thiếu → 400 "Company not authenticated")
 *    · tham số dùng ở đây (bóc từ bundle SPA màn hình inventory/list-beta, 19/08/2026):
 *        warehouse_ids · category_ids · location_description (KHỚP CHÍNH XÁC, không phải tiền tố)
 *        · sort_by · order_by · page · size (trần 1000)
 *
 *  VÌ SAO KHÔNG QUÉT SẠCH (ràng buộc "nhẹ tải upstream"): riêng kho WH - MATERIAL - MTG đã
 *  2,43 triệu dòng UID; quét hết là ~2.400 lượt gọi mỗi ngày. Cách làm ở đây chỉ tốn ~65 lượt:
 *    ① đếm 2 lần (tổng · và riêng vị trí F0-A0-00-00-00-00) ⇒ biết CHÍNH XÁC còn bao nhiêu
 *       dòng nằm ngoài F0-A0 — chỉ 2 lượt gọi size=1;
 *    ② sắp GIẢM DẦN theo location_description: mọi dòng NGOÀI F0-A0 dồn lên đầu (F0-A0-… là
 *       chuỗi nhỏ nhất đang có trong kho), lấy đúng chừng ấy dòng rồi dừng — vài lượt size=1000;
 *    ③ (chốt an toàn) còn thiếu thì quét thêm chiều TĂNG DẦN để nhặt các vị trí sắp TRƯỚC
 *       F0-A0 (hiện chưa gặp, nhưng WMS đổi mã vị trí lúc nào không báo).
 *  Đo thật 19/08/2026 trên 2 kho trong phạm vi: 7.887 dòng ngoài F0-A0 ⇒ ~65 lượt gọi, ~1,5 phút.
 */
import { fetchThuLai } from "./session-rules.js";

export const GW_RPT = "https://wms-gw.inshasaki.com/api/v1/wms/report-management/report-inventories";
export const VT_CHO = "F0-A0-00-00-00-00";        // vị trí "chờ khai báo UID group" (bãi tập kết)
export const VT_CHO_TIEN_TO = "F0-A0";            // người dùng phát biểu luật theo TIỀN TỐ F0-A0
/* Vị trí MIỄN TRỪ (người dùng chốt 19/08/2026): khu `F0-KHO-HM` không tính là sai chỗ dù UID chưa
   khai báo UID group. Khai theo TIỀN TỐ để phủ hết ô con (F0-KHO-HM-01-01-01, -01-04-01…).
   Đổi bằng biến môi trường TVT_VITRI_BO_QUA (ngăn cách bằng dấu phẩy) nếu kho phát sinh khu khác. */
export const VT_BO_QUA = String(process.env.TVT_VITRI_BO_QUA || "F0-KHO-HM")
  .split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
export const SIZE = 1000;                          // trần server (2000 → 400 "size must be less than 1000")
export const MAX_TRANG = 60;                       // chốt chặn: 60 × 1000 = 60k dòng/kho là quá thừa
export const MAX_HOI_VT = 40;                      // trần số vị trí đem đi đối chiếu mỗi vòng vá (chặn kho có hàng trăm vị trí lẻ)

/* Danh mục "nguyên liệu vải" — category_id 463 = "Thời Trang (NVL)" (tra master-data/common/categories).
   Để ở một chỗ, đổi bằng biến môi trường TVT_CATEGORY_IDS nếu WMS thêm danh mục NVL mới. */
export const CATEGORY_IDS = process.env.TVT_CATEGORY_IDS || "463";

/* PHẠM VI (người dùng chốt 19/08/2026): CHỈ 2 kho nguyên liệu — nơi vải cây nằm chờ khai báo.
 * Các kho khác (bán thành phẩm, sample, NG, office…) không xét: hàng ở đó đã qua cắt/phối nên
 * luật "chưa khai báo UIDgr thì phải ở bãi chờ" không áp dụng.
 * `khoTen` là tên kho MONG ĐỢI ứng với id — WMS đánh id kho theo hệ thống chung, đổi ánh xạ lúc nào
 * không báo; quét xong đối chiếu tên, lệch thì bỏ kho đó chứ không âm thầm báo cáo nhầm kho. */
export const BO_TVT = [
  { ten: "Mastige", company: "1002", warehouses: ["1177"], khoTen: "WH - MATERIAL - MTG" },
  { ten: "Garment", company: "1005", warehouses: ["1339"], khoTen: "WH - MATERIAL - GARMENT" },
];

export const TVT_TAB = "ton-vitri";
export const TVT_HEADER = ["No.", "Company", "Warehouse Name", "Location", "UID", "SKU", "Product Name",
  "Category Name", "Nhóm", "Brand Name", "Qty", "UOM", "Status", "Group UID", "Updated At"];

/* CHỈ GIỮ SKU VẢI (người dùng chốt 19/08/2026). Danh mục 463 "Thời Trang (NVL)" còn có chỉ, sợi,
 * phụ liệu — những thứ đó KHÔNG bắt buộc khai báo UIDgr nên không phải bất thường.
 * Nhận diện bằng TÊN SẢN PHẨM chứ không bằng brand: brand "Vải" vẫn lẫn sợi (vd "40's/2 … Raw White
 * Yarn"), còn vải thật thì rải khắp chục brand (Bách Hợp, Trang Nhã, XYX, Suzhou…).
 * Đã đối chiếu trên dữ liệu thật 19/08 ở 2 kho nguyên liệu: "tên BẮT ĐẦU bằng Vải" và "tên CÓ CHỨA
 * chữ vải" cho CÙNG 446 dòng ⇒ luật này không bỏ sót và cũng không quét thừa.
 * Cột "Nhóm" giữ lại trong bảng để nhìn là biết dòng đã qua bộ lọc nào. */
export function nhomVai(tenSp) {
  return /^\(?\s*(combo\)\s*)?vải\b/i.test(String(tenSp || "")) ? "Vải" : "NVL khác";
}
export function laVai(tenSp) { return nhomVai(tenSp) === "Vải"; }

/** UID coi như CHƯA khai báo UID group: WMS trả "0" (hoặc rỗng/N/A tuỳ màn hình). */
export function chuaKhaiBao(v) {
  const s = String(v == null ? "" : v).trim();
  return s === "" || s === "0" || /^n\/?a$/i.test(s);
}
/** Vị trí hợp lệ cho UID chưa khai báo = bãi chờ F0-A0 (luật phát biểu theo tiền tố). */
export function laBaiCho(loc) {
  return String(loc || "").toUpperCase().startsWith(VT_CHO_TIEN_TO);
}
/** Vị trí nằm trong danh sách miễn trừ (F0-KHO-HM…) ⇒ không đưa vào danh sách sai chỗ. */
export function boQuaViTri(loc) {
  const s = String(loc || "").toUpperCase();
  return VT_BO_QUA.some((p) => s.startsWith(p));
}

function url(wh, them) {
  const u = new URL(GW_RPT);
  u.searchParams.set("warehouse_ids", wh);
  if (CATEGORY_IDS) u.searchParams.set("category_ids", CATEGORY_IDS);
  for (const [k, v] of Object.entries(them || {})) u.searchParams.set(k, String(v));
  return u.toString();
}

async function goi(u, cty, token) {
  const r = await fetchThuLai(u, { headers: { authorization: token, "Company-Ids": cty, "user-agent-type": "web" } }, 3);
  const t = await r.text();
  if (!r.ok) throw new Error("HTTP " + r.status + ": " + t.slice(0, 160));
  let j; try { j = JSON.parse(t); } catch { throw new Error("phản hồi không phải JSON"); }
  return { count: j.count == null ? null : Number(j.count), records: j.records || [] };
}

/** Đếm nhanh (size=1) — biết trước cần lấy bao nhiêu dòng, khỏi quét mò. */
async function dem(cty, wh, token, loc) {
  const j = await goi(url(wh, loc ? { page: 1, size: 1, location_description: loc } : { page: 1, size: 1 }), cty, token);
  return j.count || 0;
}

/**
 * Lấy MỌI dòng UID của 1 kho đang nằm NGOÀI vị trí chờ F0-A0-00-00-00-00.
 * Trả { rows, soGoi, tongNgoai, duCanh } — duCanh=false nghĩa là chưa gom đủ số đã đếm.
 *
 * ⚠ BẪY ĐÃ ĐO (19/08/2026): phân trang của WMS KHÔNG ổn định khi khoá sắp bị TRÙNG NHIỀU.
 *   Quét 9 trang × 1000 theo `location_description` hai lần liên tiếp trên cùng kho 1177:
 *   lần 1 gom 7.777 dòng, lần 2 gom 7.778, mỗi lần dính 8x dòng TRÙNG và mỗi lần lại thiếu
 *   ~64 dòng khác nhau — đúng kiểu ElasticSearch xáo thứ tự giữa các dòng bằng điểm nhau.
 *   `sort_by=location_description,uid` thì hết trùng nhưng WMS bỏ luôn thứ tự đã yêu cầu.
 *   ⇒ KHÔNG tin một lượt quét. Ở đây quét xong thì ĐỐI CHIẾU với số đếm, thiếu bao nhiêu thì
 *   VÁ THEO TỪNG VỊ TRÍ: `location_description=<vị trí>` khớp tuyệt đối + sắp theo `uid`
 *   (khoá DUY NHẤT ⇒ phân trang không xáo được) nên vá xong là đủ, và biết chắc mình đủ.
 */
export async function quetNgoaiBaiCho(cty, wh, token, log = () => {}) {
  let soGoi = 0;
  const tong = await dem(cty, wh, token); soGoi++;
  if (!tong) return { rows: [], soGoi, tongNgoai: 0, duCanh: true };
  const oBai = await dem(cty, wh, token, VT_CHO); soGoi++;
  const tongNgoai = Math.max(0, tong - oBai);
  if (!tongNgoai) return { rows: [], soGoi, tongNgoai: 0, duCanh: true };

  const thay = new Map();   // inventory_id -> record
  const nhan = (it) => { if (String(it.location_description || "") !== VT_CHO) thay.set(String(it.inventory_id || it.uid), it); };
  const demTheoVt = () => {                            // vị trí -> số dòng ĐANG có trong tay
    const m = new Map();
    for (const it of thay.values()) { const k = String(it.location_description || ""); m.set(k, (m.get(k) || 0) + 1); }
    return m;
  };

  /* ① Quét theo location_description GIẢM DẦN: F0-A0-… là chuỗi nhỏ nhất đang có trong kho nên
        mọi dòng "ngoài bãi" dồn lên đầu — chỉ vài trang là qua hết vùng cần lấy. */
  async function quet(chieu) {
    for (let page = 1; page <= MAX_TRANG && thay.size < tongNgoai; page++) {
      const j = await goi(url(wh, { page, size: SIZE, sort_by: "location_description", order_by: chieu }), cty, token);
      soGoi++;
      if (!j.records.length) break;
      let cham = 0;   // số dòng ĐÃ ở bãi chờ trong trang này
      for (const it of j.records) { if (String(it.location_description || "") === VT_CHO) cham++; else nhan(it); }
      if (cham === j.records.length) break;          // trang toàn bãi chờ ⇒ đã đi hết vùng "ngoài"
      if (j.records.length < SIZE) break;            // hết dữ liệu
    }
  }
  /* ② Vá TỪNG VỊ TRÍ: lọc `location_description` khớp tuyệt đối nên truy vấn rất hẹp — đo 19/08:
        đếm 1 vị trí ~0,4s so với 3–4s một trang size=1000 quét cả kho.
        Đi từ vị trí ĐANG GIỮ NHIỀU DÒNG NHẤT: dòng rơi vãi luôn nằm ở mép trang, mà chỉ khối lớn
        mới trải qua mép trang — nhờ vậy thường vá 2–3 vị trí là đủ số rồi dừng, khỏi rà cả trăm
        vị trí lẻ (kho bán thành phẩm có rất nhiều vị trí 1–2 dòng, rà hết là mất chục phút). */
  async function vaTheoViTri(daHoi) {
    const dsVt = [...demTheoVt().entries()].filter(([k]) => k).sort((a, b) => b[1] - a[1]);
    let hoi = 0;
    for (const [vt, co] of dsVt) {
      if (thay.size >= tongNgoai || hoi >= MAX_HOI_VT) break;
      if (daHoi.has(vt)) continue;
      daHoi.add(vt); hoi++;
      const can = await dem(cty, wh, token, vt); soGoi++;
      if (can <= co) continue;                        // vị trí này đã đủ dòng
      for (let page = 1; page <= MAX_TRANG; page++) {
        const j = await goi(url(wh, { page, size: SIZE, location_description: vt, sort_by: "uid", order_by: "asc" }), cty, token);
        soGoi++;
        if (!j.records.length) break;
        j.records.forEach(nhan);
        if (j.records.length < SIZE || page * SIZE >= can) break;
      }
    }
  }
  await quet("desc");
  await quet("asc");   /* 1 lượt gọi: chiều tăng dần mà trang đầu KHÔNG toàn F0-A0 nghĩa là WMS đã
                          sinh mã vị trí sắp TRƯỚC bãi chờ — lúc đó nó tự quét tiếp; còn bình thường
                          trang đầu toàn F0-A0 nên dừng ngay, gần như không tốn gì. */
  const daHoi = new Set();
  for (let vong = 0; vong < 2 && thay.size < tongNgoai; vong++) {
    await vaTheoViTri(daHoi);
    if (thay.size < tongNgoai) await quet("desc");    // còn thiếu ⇒ có thể sót hẳn một vị trí, quét lại để lộ ra
  }
  const duCanh = thay.size >= tongNgoai;
  if (!duCanh) log("  ⚠ kho " + wh + ": gom " + thay.size + "/" + tongNgoai + " dòng ngoài " + VT_CHO +
    " (chênh " + (tongNgoai - thay.size) + " — hàng đang chạy trong lúc quét hoặc WMS xáo trang).");
  return { rows: [...thay.values()], soGoi, tongNgoai, duCanh };
}

/**
 * Quét 2 kho nguyên liệu → danh sách dòng BẤT THƯỜNG: SKU **vải**, chưa khai báo UID group,
 * mà đang nằm ngoài bãi chờ F0-A0.
 * Trả { rows, soGoi, thongKe:[{ten,wh,ngoai,chuaKb,bt}], duCanh }.
 */
export async function quetTonViTri(token, log = () => {}) {
  const rows = [], thongKe = [];
  let soGoi = 0, duCanh = true;
  for (const bo of BO_TVT) {
    for (const wh of bo.warehouses) {
      let kq; const t0 = Date.now();
      try { kq = await quetNgoaiBaiCho(bo.company, wh, token, log); }
      catch (e) { log("  ⚠ " + bo.ten + " kho " + wh + ": " + e.message); duCanh = false; continue; }
      soGoi += kq.soGoi;
      if (!kq.duCanh) duCanh = false;
      if (!kq.rows.length) continue;
      const ten = kq.rows[0].warehouse_name || wh;
      if (bo.khoTen && ten !== bo.khoTen) {   // WMS đổi ánh xạ id↔kho ⇒ dừng kho này, đừng báo cáo nhầm
        log("  ⚠ kho id " + wh + " của " + bo.ten + " nay là “" + ten + "”, không phải “" + bo.khoTen + "” — BỎ QUA, cần rà lại id kho.");
        duCanh = false; continue;
      }
      /* Lọc 3 nhịp, đếm từng nhịp để log đọc ra ngay dòng nào rụng vì lý do gì. */
      const chuaKb = kq.rows.filter((it) => chuaKhaiBao(it.group_uid) && !laBaiCho(it.location_description));
      const vai = chuaKb.filter((it) => laVai(it.product_name));                    // chỉ SKU vải
      const bt = vai.filter((it) => !boQuaViTri(it.location_description));          // trừ khu miễn trừ
      thongKe.push({ ten: bo.ten, wh: ten, ngoai: kq.tongNgoai, chuaKb: chuaKb.length, vai: vai.length, bt: bt.length });
      log("    · " + ten + ": " + kq.tongNgoai + " ngoài bãi chờ → " + chuaKb.length + " chưa khai báo → " +
        vai.length + " là vải → " + bt.length + " sau khi trừ " + VT_BO_QUA.join("/") +
        " (" + kq.soGoi + " lượt, " + ((Date.now() - t0) / 1000).toFixed(0) + "s)");
      for (const it of bt) rows.push({ cty: bo.ten, it });
    }
  }
  return { rows, soGoi, thongKe, duCanh };
}

/** Dòng Sheet — thứ tự đúng TVT_HEADER. Sắp: kho → vị trí → SKU để người đi kho đọc theo tuyến. */
export function dungBangTvt(ds) {
  const sx = ds.slice().sort((a, b) => {
    const A = a.it, B = b.it;
    return String(A.warehouse_name || "").localeCompare(String(B.warehouse_name || "")) ||
      String(A.location_description || "").localeCompare(String(B.location_description || "")) ||
      String(A.sku || "").localeCompare(String(B.sku || ""));
  });
  return sx.map((o, i) => {
    const it = o.it;
    return [i + 1, o.cty, it.warehouse_name || "", it.location_description || "", it.uid || "", String(it.sku || ""),
      it.product_name || "", it.category_name || "", nhomVai(it.product_name), it.brand_name || "",
      Number(it.qty) || 0, it.uom || "", it.status_name || "",
      String(it.group_uid == null ? "" : it.group_uid), it.updated_at || it.created_at || ""];
  });
}
