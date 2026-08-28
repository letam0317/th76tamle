/**
 * chuan-toc-do-kiemke.mjs — ĐO BỘ SỐ CHUẨN TỐC ĐỘ KIỂM KÊ từ các đợt kiểm FULL_LOCATION_FACTORY
 * ==============================================================================================
 *  Yêu cầu user 28/08/2026: lấy dữ liệu 2 đợt kiểm làm DỮ LIỆU CHUẨN cho phần "① Máy tự tính"
 *  của pop-up Dự kiến hoàn thành (tab Kiểm kê factory):
 *    · 252161 — FULL_LOCATION_FACTORY kho WH - MATERIAL - MTG     + phiếu SKU_FACTORY có Source code 252161
 *    · 252152 — FULL_LOCATION_FACTORY kho WH - MATERIAL - GARMENT + phiếu SKU_FACTORY có Source code 252152
 *
 *  NGUỒN — 0 lượt gọi WMS (luật nhẹ tải upstream):
 *    · hasaki/.pc-cache.json (fSku / fLoc: ảnh chụp phiếu factory của push-pc-to-sheet, checklist_at tới giây)
 *    · tab kiemke-qtycount (gviz public) — số dòng SKU × vị trí của từng phiếu Full location, để đo
 *      "giây/dòng SKU khi đếm trọn vị trí" (tham khảo, không dùng cho dự báo).
 *
 *  THUẬT TOÁN — xem chú thích mục 3 (đo theo LÔ NỘP + khung giờ thật; số thuần theo phiên chỉ tham chiếu).
 *
 *  Chạy:  node chuan-toc-do-kiemke.mjs                → in bảng đo + khối JS `KK_CHUAN`
 *         node chuan-toc-do-kiemke.mjs --ghi          → ghi khối JS vào factory/index.html giữa 2 mốc
 *                                                        @@KK_CHUAN_BEGIN@@ … @@KK_CHUAN_END@@
 *         node chuan-toc-do-kiemke.mjs 252161:MTG 252152:GARMENT   (đổi đợt/kho — mặc định như trên)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const CACHE = path.join(DIR, ".pc-cache.json");
const INDEX = path.resolve(DIR, "..", "factory", "index.html");
const SHEET_NGUON = "1eY_oo9fAvWCTXp24x-Z0FXq9mp_jJPlTHg09qdemETs";
const ARGS = process.argv.slice(2);
const GHI = ARGS.includes("--ghi");
const DOT = ARGS.filter((a) => /^\d+(:\w+)?$/.test(a)).map((a) => a.split(":"));
if (!DOT.length) DOT.push(["252161", "MTG"], ["252152", "GARMENT"]);
const log = (...a) => console.log(...a);
const nf = (n, d = 1) => (n == null || isNaN(n) ? "—" : Number(n).toFixed(d));

/* ===== 1) Đọc cache phiếu ===== */
const cache = JSON.parse(fs.readFileSync(CACHE, "utf8"));
const fSku = cache.fSku || [], fLoc = cache.fLoc || [];
log("Cache: " + fSku.length + " phiếu SKU factory · " + fLoc.length + " phiếu vị trí factory · chụp lúc " + new Date(cache.fullAt).toLocaleString("vi-VN"));

/* ===== 2) gviz kiemke-qtycount: số dòng SKU của từng phiếu Full location (tham khảo) ===== */
async function gviz(tab, tq) {
  const u = "https://docs.google.com/spreadsheets/d/" + SHEET_NGUON + "/gviz/tq?tqx=out:json;responseHandler:x&sheet=" +
    encodeURIComponent(tab) + "&headers=1&tq=" + encodeURIComponent(tq);
  const t = await (await fetch(u, { signal: AbortSignal.timeout(45000) })).text();
  const m = t.match(/x\(([\s\S]*)\)\s*;?\s*$/); if (!m) throw new Error("gviz không trả JSONP");
  const j = JSON.parse(m[1]);
  const H = (j.table.cols || []).map((c) => String(c.label || "").replace(/\s+/g, " ").trim().toLowerCase());
  const rows = (j.table.rows || []).map((r) => (r.c || []).map((c) => (c && c.v != null ? c.v : "")));
  return { H, rows };
}
const dongSkuTheoPhieu = new Map();   // checklist_id -> số dòng SKU × vị trí
for (const [req] of DOT) {
  try {
    const q = await gviz("kiemke-qtycount", "select A,B,C where C = " + req);
    const iC = q.H.indexOf("checklist id");
    if (iC < 0) { log("  ⚠ kiemke-qtycount không có cột 'Checklist ID' (H=" + q.H.join(",") + ") — bỏ phần giây/dòng SKU."); continue; }
    for (const r of q.rows) { const k = String(r[iC]).replace(/\.0$/, ""); dongSkuTheoPhieu.set(k, (dongSkuTheoPhieu.get(k) || 0) + 1); }
    log("  kiemke-qtycount request " + req + ": " + q.rows.length + " dòng SKU × vị trí.");
  } catch (e) { log("  ⚠ Không đọc được kiemke-qtycount cho " + req + ": " + e.message + " — bỏ phần giây/dòng SKU."); }
}

/* ===== 3) Thuật toán đo =====
   BẪY (đo 28/08/2026): checklist_at của phiếu SKU_FACTORY là GIỜ NỘP THEO LÔ — 10–100 SKU cùng 1 giây
   (người kiểm gom rồi nộp một lượt), nên thuật toán phiên của dashboard (kkTimingModel: phiên ≥3 phiếu,
   thời lượng >0) bỏ gần hết mẫu (39/1009) và không đại diện. Bộ chuẩn đo theo PHA + NGƯỜI-NGÀY:
     · khung giờ người-ngày = giờ nộp cuối − giờ nộp đầu của 1 người trong 1 ngày (chỉ lấy ≥30');
     · giây/đơn vị HIỆU DỤNG = Σ khung giờ ÷ Σ phiếu nộp trong các người-ngày đó (đã gồm nghỉ tay, di chuyển,
       chờ duyệt) — đi đôi với công suất = người/ngày × phút/người/ngày (TB khung giờ) của ĐÚNG pha đó;
     · pha VỊ TRÍ (phiếu FULL_LOCATION_FACTORY) và pha SKU (phiếu SKU_FACTORY) đo riêng vì nhân sự/khung giờ khác.
   Kiểm chứng: bộ số tái tạo đúng đợt đã đo (MTG 504 vị trí → 2,4 ngày tính / 3 ngày thật; GARMENT 187 vị trí
   → 1,0 / 1). Nhóm hàng (PL/NVL) tách theo tỉ lệ median-lô (chỉ khi nhóm ≥30 mẫu, không thì dùng số chung).
   Kèm số "thuần theo phiên" (đúng kkTimingModel) và giây/dòng SKU trong vị trí để tham chiếu. */
const msVN = (s) => { const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) : NaN; };
const ngayCua = (ms) => new Date(ms).toISOString().slice(0, 10);
const nhomCat = (c) => { c = String(c || "").toLowerCase(); if (/phụ liệu|phu lieu/.test(c)) return "PL"; if (/nvl|nguyên liệu|nguyen lieu/.test(c)) return "NVL"; return "KHAC"; };
const median = (a) => { if (!a || !a.length) return null; a = a.slice().sort((x, y) => x - y); const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
const gomNguoiNgay = (phieu) => { const byPD = {}; for (const p of phieu) { if (isNaN(p.ms)) continue; const k = (p.by || "?") + "|" + ngayCua(p.ms); (byPD[k] = byPD[k] || []).push(p); } return byPD; };
/* Đo 1 PHA: phieu=[{ms,by,g,id}] → giây/đơn vị hiệu dụng + công suất + tỉ lệ nhóm + tham chiếu */
function doPha(phieu, laySkuDong) {
  const byPD = gomNguoiNgay(phieu), dayStaff = {}, spans = [];
  let sumSpan = 0, units = 0, dongSku = 0;
  for (const k of Object.keys(byPD)) {
    const [by, d] = k.split("|"); (dayStaff[d] = dayStaff[d] || new Set()).add(by);
    let mn = Infinity, mx = -Infinity; for (const p of byPD[k]) { if (p.ms < mn) mn = p.ms; if (p.ms > mx) mx = p.ms; }
    const sp = (mx - mn) / 60000; if (sp < 30) continue;   // người-ngày chỉ nộp 1 lô → không đo được khung giờ
    spans.push(sp); sumSpan += sp; units += byPD[k].length;
    if (laySkuDong) for (const p of byPD[k]) dongSku += laySkuDong(p.id) || 0;
  }
  const days = Object.keys(dayStaff).sort();
  const nguoiTB = days.length ? days.reduce((s, d) => s + dayStaff[d].size, 0) / days.length : 0;
  const phutNguoi = spans.length ? sumSpan / spans.length : 0;
  const sec = units ? sumSpan * 60 / units : null;
  // tỉ lệ nhóm theo median LÔ (giờ nộp lô − giờ nộp lô trước ÷ số phiếu trong lô, bỏ khoảng >3h)
  const rateLo = {};
  for (const pd of Object.keys(byPD)) {
    const lo = {}; for (const p of byPD[pd]) (lo[p.ms] = lo[p.ms] || []).push(p);
    const ts = Object.keys(lo).map(Number).sort((x, y) => x - y);
    for (let i = 1; i < ts.length; i++) { const gap = ts[i] - ts[i - 1], n = lo[ts[i]].length; if (gap <= 0 || gap > 3 * 3600 * 1000) continue; for (const p of lo[ts[i]]) (rateLo[p.g] = rateLo[p.g] || []).push(gap / 1000 / n); }
  }
  const allLo = Object.values(rateLo).flat(), medAll = median(allLo);
  const nhom = {}; for (const g of ["PL", "NVL", "KHAC"]) { const a = rateLo[g] || []; nhom[g] = { n: a.length, sec: (sec != null && medAll && a.length >= 30) ? sec * median(a) / medAll : sec }; }
  // thuần theo phiên (kkTimingModel) — tham chiếu
  const thuan = [];
  for (const pd of Object.keys(byPD)) {
    const a = byPD[pd].sort((x, y) => x.ms - y.ms); let s = 0;
    while (s < a.length) { let e = s; while (e + 1 < a.length && a[e + 1].ms - a[e].ms <= 15 * 60 * 1000) e++; const n = e - s + 1;
      if (n >= 3 && a[e].ms > a[s].ms) { const spm = Math.max(60000, a[e].ms - a[s].ms) / 1000 / n; for (let i = 0; i < n; i++) thuan.push(spm); }
      s = e + 1; }
  }
  return { sec, units, unitsAll: phieu.length, nguoiNgay: Object.keys(byPD).length, nguoiNgayDo: spans.length, days, nguoiTB, phutNguoi, capNgay: nguoiTB * phutNguoi * 60,
    soNguoi: new Set(Object.keys(byPD).map((k) => k.split("|")[0])).size, nhom, thuan: median(thuan), nThuan: thuan.length, dongSku: dongSku ? sumSpan * 60 / dongSku : null, nDong: dongSku };
}

/* ===== 4) Đo từng đợt ===== */
const KQ = {};   // tenKho -> bộ số
for (const [req, nhan] of DOT) {
  const sk = fSku.filter((x) => String(x.source_code) === req && x.plan_type === "SKU_FACTORY");
  const lc = fLoc.filter((x) => String(x.plan_id) === req && x.plan_type === "FULL_LOCATION_FACTORY");
  if (!sk.length && !lc.length) { log("✗ Đợt " + req + ": cache không có phiếu — chạy push-pc-to-sheet trước."); continue; }
  const kho = (lc[0] || sk[0]).warehouse_name;
  const hopLe = (x) => x.checklist_at && !/REJECTED|CANCEL/i.test(x.status_name || "");
  const pS = sk.filter(hopLe).map((x) => ({ ms: msVN(x.checklist_at), by: x.checklist_by_name, g: nhomCat(x.category_name), id: String(x.checklist_id) }));
  const pL = lc.filter(hopLe).map((x) => ({ ms: msVN(x.checklist_at), by: x.checklist_by_name, g: "ALL", id: String(x.checklist_id) }));
  const S = doPha(pS), L = doPha(pL, (id) => dongSkuTheoPhieu.get(id));
  const ngays = [...new Set(S.days.concat(L.days))].sort();
  KQ[kho] = { req, nhan, kho, S, L, ngayDau: ngays[0], ngayCuoi: ngays[ngays.length - 1], soNguoi: new Set(pS.concat(pL).map((p) => p.by)).size, phieuSku: sk.length, phieuLoc: lc.length };
  const taiTao = (P) => (P.sec && P.capNgay ? (P.unitsAll * P.sec / P.capNgay).toFixed(1) : "—");
  log("\n══ Đợt " + req + " · " + kho + " (" + nhan + ") · " + ngays[0] + " → " + ngays[ngays.length - 1] + " · " + KQ[kho].soNguoi + " người tham gia ══");
  log("  PHA VỊ TRÍ — phiếu FULL_LOCATION_FACTORY plan " + req + ": " + lc.length + " (đã đếm " + pL.length + " · đo " + L.units + " phiếu trong " + L.nguoiNgayDo + "/" + L.nguoiNgay + " người-ngày · " + L.days.length + " ngày)");
  log("    giây/vị trí hiệu dụng " + nf(L.sec, 0) + "s (≈" + nf(L.sec / 60) + " phút) · thuần theo phiên " + nf(L.thuan, 0) + "s (n=" + L.nThuan + ") · giây/dòng SKU trong vị trí " + nf(L.dongSku, 0) + "s (n=" + L.nDong + ")");
  log("    công suất " + nf(L.nguoiTB) + " người/ngày × " + nf(L.phutNguoi, 0) + " phút/người/ngày = " + nf(L.capNgay / 60, 0) + " phút/ngày → tái tạo " + pL.length + " vị trí ≈ " + taiTao(L) + " ngày (thật " + L.days.length + ") · ≈" + nf(L.phutNguoi * 60 / L.sec, 0) + " vị trí/người/ngày");
  log("  PHA SKU — phiếu SKU_FACTORY Source code " + req + ": " + sk.length + " (hợp lệ " + pS.length + " · đo " + S.units + " phiếu trong " + S.nguoiNgayDo + "/" + S.nguoiNgay + " người-ngày · " + S.days.length + " ngày)");
  log("    giây/SKU hiệu dụng " + nf(S.sec, 0) + "s · theo nhóm: PL " + nf(S.nhom.PL.sec, 0) + "s (lô n=" + S.nhom.PL.n + ") · NVL " + nf(S.nhom.NVL.sec, 0) + "s (n=" + S.nhom.NVL.n + ") · Khác " + nf(S.nhom.KHAC.sec, 0) + "s (n=" + S.nhom.KHAC.n + ")");
  log("    công suất " + nf(S.nguoiTB) + " người/ngày × " + nf(S.phutNguoi, 0) + " phút/người/ngày = " + nf(S.capNgay / 60, 0) + " phút/ngày → tái tạo " + pS.length + " SKU ≈ " + taiTao(S) + " ngày (thật " + S.days.length + ") · ≈" + nf(S.phutNguoi * 60 / S.sec, 0) + " SKU/người/ngày");
}

/* ===== 5) Bộ số CHUNG (gộp 2 đợt theo trọng số số phiếu đo) + khối JS ===== */
const khos = Object.keys(KQ);
if (!khos.length) { console.error("✗ Không đo được đợt nào."); process.exit(2); }
function gop(lay, layN) { let s = 0, n = 0; for (const k of khos) { const v = lay(KQ[k]), m = layN(KQ[k]); if (v != null && m > 0) { s += v * m; n += m; } } return n ? s / n : null; }
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10), r0 = (v) => (v == null ? null : Math.round(v));
const boPha = (P) => ({ sec: r0(P.sec), n: P.units, nguoiTB: r1(P.nguoiTB), phutNguoi: r0(P.phutNguoi), capNgay: r0(P.capNgay), ngay: P.days.length });
const boSo = (o) => ({
  req: o.req, kho: o.kho || "", ngayDau: o.ngayDau || "", ngayCuoi: o.ngayCuoi || "",
  sku: Object.assign(boPha(o.S), { PL: r0(o.S.nhom.PL.sec), NVL: r0(o.S.nhom.NVL.sec), KHAC: r0(o.S.nhom.KHAC.sec) }),
  loc: Object.assign(boPha(o.L), { thuan: r0(o.L.thuan), dongSku: r0(o.L.dongSku) }),
});
const CH = { req: khos.map((k) => KQ[k].req).join("+"), kho: "", ngayDau: khos.map((k) => KQ[k].ngayDau).sort()[0], ngayCuoi: khos.map((k) => KQ[k].ngayCuoi).sort().slice(-1)[0] };
for (const ph of ["S", "L"]) {
  const wN = (o) => o[ph].units, wD = (o) => o[ph].days.length;
  CH[ph] = { sec: gop((o) => o[ph].sec, wN), units: khos.reduce((s, k) => s + KQ[k][ph].units, 0), days: { length: khos.reduce((s, k) => s + KQ[k][ph].days.length, 0) },
    nguoiTB: gop((o) => o[ph].nguoiTB, wD), phutNguoi: gop((o) => o[ph].phutNguoi, wD), capNgay: gop((o) => o[ph].capNgay, wD),
    nhom: { PL: { sec: gop((o) => o[ph].nhom.PL.sec, wN) }, NVL: { sec: gop((o) => o[ph].nhom.NVL.sec, wN) }, KHAC: { sec: gop((o) => o[ph].nhom.KHAC.sec, wN) } },
    thuan: gop((o) => o[ph].thuan, (o) => o[ph].nThuan), dongSku: gop((o) => o[ph].dongSku, (o) => o[ph].nDong) };
}
const KK_CHUAN = { doDuoc: new Date().toISOString().slice(0, 10), kho: {}, chung: boSo(CH) };
for (const k of khos) KK_CHUAN.kho[k] = boSo(KQ[k]);
for (const b of [...Object.values(KK_CHUAN.kho), KK_CHUAN.chung]) for (const g of ["PL", "NVL", "KHAC"]) if (b.sku[g] == null) b.sku[g] = b.sku.sec;
log("\n══ Bộ số CHUNG (gộp theo trọng số) ══  giây/SKU " + nf(CH.S.sec, 0) + " (PL " + nf(CH.S.nhom.PL.sec, 0) + " · NVL " + nf(CH.S.nhom.NVL.sec, 0) + ") · " + nf(CH.S.nguoiTB) + " người × " + nf(CH.S.phutNguoi, 0) + "' · giây/vị trí " + nf(CH.L.sec, 0) + " · " + nf(CH.L.nguoiTB) + " người × " + nf(CH.L.phutNguoi, 0) + "'");

const khoiJS = "/*@@KK_CHUAN_BEGIN@@*/\n" +
  "/* Bộ số CHUẨN tốc độ kiểm kê — đo từ đợt " + khos.map((k) => KQ[k].req + " (" + KQ[k].nhan + ")").join(" + ") +
  " bằng hasaki/chuan-toc-do-kiemke.mjs (" + KK_CHUAN.doDuoc + "). sku = pha SKU_FACTORY có Source code = đợt; loc = pha FULL_LOCATION_FACTORY.\n" +
  "   sec = giây/đơn vị HIỆU DỤNG (Σ khung giờ người-ngày ÷ Σ phiếu nộp, đã gồm nghỉ tay) đi đôi với capNgay = nguoiTB × phutNguoi × 60 của cùng pha.\n" +
  "   ĐỪNG sửa tay — chạy lại script với --ghi. */\n" +
  "var KK_CHUAN=" + JSON.stringify(KK_CHUAN) + ";\n" +
  "/*@@KK_CHUAN_END@@*/";
log("\n" + khoiJS);

if (GHI) {
  let html = fs.readFileSync(INDEX, "utf8");
  const crlf = /\r\n/.test(html); if (crlf) html = html.replace(/\r\n/g, "\n");
  const re = /\/\*@@KK_CHUAN_BEGIN@@\*\/[\s\S]*?\/\*@@KK_CHUAN_END@@\*\//;
  if (!re.test(html)) { console.error("✗ factory/index.html chưa có mốc @@KK_CHUAN_BEGIN/END@@ — chèn mốc trước rồi chạy lại."); process.exit(3); }
  html = html.replace(re, () => khoiJS);
  fs.writeFileSync(INDEX, crlf ? html.replace(/\n/g, "\r\n") : html);
  log("\n✓ Đã ghi khối KK_CHUAN vào " + INDEX);
}
