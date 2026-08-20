/**
 * tra-uid-core.mjs — LÕI DÙNG CHUNG: tra danh sách UID (hoặc SKU) trên WMS.
 * Dùng bởi `tra-uid-ton.mjs` (dòng lệnh) và `tra-uid-sheet.mjs` (điền vào Google Sheet).
 *
 * Endpoint: GET /api/v1/wms/report-management/report-inventories?uids=<CSV>
 *   Header BẮT BUỘC `Company-Ids` (thiếu → 400 "Company not authenticated").
 * Trần đo 17/08/2026: `size` ≤ 1000 · URL ≤ 8 KB (8.093 OK / 8.413 → 414)
 *   · điểm ngọt lô ~200 mã × 3 lô song song (500 UID ≈ 3 lượt gọi, 6–12 s).
 *
 * ⚠ CHỈ GỌI ĐƯỢC TỪ MÁY TRONG MẠNG CÔNG TY: WMS chặn IP ngoài (Apps Script gọi thẳng
 *   sẽ nhận "Địa chỉ không khả dụng" — xem sheet-tra-uid.gs).
 */
import { fetchThuLai } from "./session-rules.js";

export const GW_RPT = "https://wms-gw.inshasaki.com/api/v1/wms/report-management/report-inventories";
export const URL_MAX = 7500;      // ngân sách độ dài URL, dưới mép 414 (~8.192)
export const SIZE_MAX = 1000;     // trần server

/** Chia lô theo CẢ số mã lẫn độ dài URL. */
export function chiaLo(ds, nMax = 200) {
  const lo = [], nen = GW_RPT.length + 60;
  let cur = [], len = nen;
  for (const m of ds) {
    const them = m.length + 1;
    if (cur.length >= nMax || len + them > URL_MAX) { lo.push(cur); cur = []; len = nen; }
    cur.push(m); len += them;
  }
  if (cur.length) lo.push(cur);
  return lo;
}

/**
 * Tra WMS. Trả { records, soGoi, thieu, thatBai }.
 *   `thatBai` = các mã nằm trong lô BỎ CUỘC (414/500/lỗi mạng sau khi đã chẻ đôi + thử lại).
 *   Người gọi PHẢI phân biệt "hỏi được, không có" (⇒ ghi "không thấy") với "chưa hỏi được"
 *   (⇒ để nguyên, thử lại sau) — nếu gộp chung thì một cú 500 chập chờn của ES sẽ đóng dấu
 *   "không thấy" vĩnh viễn cho cả bảng.
 *   ma      : mảng UID (hoặc SKU nếu theoSku)
 *   token   : "Bearer …" (token WMS sống)
 *   opt     : { theoSku, cty:['1002',…], lo:200, song:3, log }
 */
export async function traWms(ma, token, opt = {}) {
  const theoSku = !!opt.theoSku;
  const CTY = opt.cty || ["1002", "1001", "1005"];
  const LO = opt.lo || 200, SONG = opt.song || 3;
  const log = opt.log || (() => {});
  const truong = theoSku ? "skus" : "uids";
  let soGoi = 0;
  const thatBai = new Set();   // mã trong lô BỎ CUỘC — chưa hỏi được, đừng kết luận "không thấy"

  async function goiLo(dsMa, company, sau = 0) {
    const ket = [];
    let page = 1;
    for (;;) {
      const u = new URL(GW_RPT);
      u.searchParams.set("page", String(page));
      u.searchParams.set("size", String(Math.min(SIZE_MAX, Math.max(50, dsMa.length * 2))));
      u.searchParams.set(truong, dsMa.join(","));
      let r, body = "";
      soGoi++;
      try {
        r = await fetchThuLai(u.toString(), { headers: { authorization: token, "Company-Ids": company, "user-agent-type": "web" } }, 3);
        body = await r.text();
      } catch (e) {
        if (dsMa.length > 25 && sau < 4) return ket.concat(await cheDoi(dsMa, company, sau, "lỗi mạng: " + e.message));
        log("  ⚠ bỏ lô " + dsMa.length + " mã (lỗi mạng: " + e.message + ")");
        dsMa.forEach((x) => thatBai.add(x));
        return ket;
      }
      if (r.status === 414 || r.status >= 500) {
        if (dsMa.length > 25 && sau < 4) return ket.concat(await cheDoi(dsMa, company, sau, "HTTP " + r.status));
        log("  ⚠ bỏ lô " + dsMa.length + " mã (HTTP " + r.status + ")");
        dsMa.forEach((x) => thatBai.add(x));
        return ket;
      }
      if (!r.ok) { log("  ⚠ HTTP " + r.status + ": " + body.slice(0, 160)); dsMa.forEach((x) => thatBai.add(x)); return ket; }
      let j; try { j = JSON.parse(body); } catch { log("  ⚠ phản hồi không phải JSON"); dsMa.forEach((x) => thatBai.add(x)); return ket; }
      const recs = j.records || [];
      ket.push(...recs);
      const tong = j.count == null ? recs.length : j.count;
      if (ket.length >= tong || !recs.length) break;    // count > records ⇒ có mã nhiều dòng → sang trang
      page++;
    }
    return ket;
  }
  async function cheDoi(dsMa, company, sau, vi) {
    const giua = Math.ceil(dsMa.length / 2);
    log("  … chẻ lô " + dsMa.length + " → " + giua + "+" + (dsMa.length - giua) + " (" + vi + ")");
    const a = await goiLo(dsMa.slice(0, giua), company, sau + 1);
    const b = await goiLo(dsMa.slice(giua), company, sau + 1);
    return a.concat(b);
  }

  const records = [];
  let thieu = ma.slice();
  for (const cty of CTY) {
    if (!thieu.length) break;
    const lo = chiaLo(thieu, LO);
    const ra = [];
    for (let i = 0; i < lo.length; i += SONG) {
      const kq = await Promise.all(lo.slice(i, i + SONG).map((l) => goiLo(l, cty)));
      kq.forEach((k) => ra.push(...k));
    }
    records.push(...ra);
    const thay = new Set(ra.map((x) => String(theoSku ? x.sku : x.uid)));
    thieu = thieu.filter((m) => !thay.has(m));
  }
  return { records, soGoi, thieu, thatBai: [...thatBai] };
}

/** records → { UID: {sku, ten, kho, tt, vt} } (bản ghi đầu tiên thắng) */
export function thanhBang(records) {
  const map = {};
  for (const x of records) {
    const u = String(x.uid || "").toUpperCase();
    if (!u || map[u]) continue;
    map[u] = {
      sku: String(x.sku || ""), ten: String(x.product_name || ""), kho: String(x.warehouse_name || ""),
      tt: String(x.status_name || ""), vt: String(x.location_description || ""),
    };
  }
  return map;
}
