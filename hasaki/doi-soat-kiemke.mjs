/**
 * doi-soat-kiemke.mjs — ĐỐI SOÁT KẾT QUẢ KIỂM KÊ: BÙ TRỪ QUA LẠI RỒI CHỈ RA THIẾU/THỪA THẬT
 * =============================================================================================
 *  Câu hỏi nghiệp vụ: sau khi bù trừ số lượng qua lại giữa các SKU, rốt cuộc SKU nào THIẾU,
 *  SKU nào THỪA, và phải đi kiểm tra ở ĐÂU.
 *
 *  Dữ liệu SKU không nằm ở danh sách phiếu mà ở tầng TRACKING của từng phiếu
 *  (sku · bin_location · qty_by_sys · qty_diff · exp_by_user/exp_by_sys chứa UID group).
 *  Số đã đếm KHÔNG có sẵn: counted = qty_by_sys + qty_diff.
 *
 *  BA TẦNG BÙ TRỪ (thứ tự quan trọng — bù sai tầng là kết luận sai):
 *   1) Cùng SKU, khác vị trí  → hàng ĐỂ SAI CHỖ. Tổng kho vẫn đủ, chỉ cần dời hàng.
 *   2) Khác SKU, cùng vị trí  → nghi NHẦM MÃ khi đếm/dán tem. Phải ra tận vị trí đối chiếu.
 *   3) Còn lại sau 2 tầng trên → THIẾU/THỪA THẬT, mới là thứ phải truy nguyên nhân.
 *
 *  CHỈ tính dòng đã đếm thật (status_id = 4) thuộc phiếu đã đếm xong. Phiếu PENDING/PROCESSING
 *  có qty_diff = -qty_by_sys nhưng đó là "chưa đếm", KHÔNG phải thiếu — gộp vào sẽ ra thiếu ảo.
 *
 *  Chạy:  node doi-soat-kiemke.mjs
 *  Tham số qua .env / dòng lệnh:
 *    DS_WH=1339                 kho (mặc định WH - MATERIAL - GARMENT)
 *    DS_FROM_MS / DS_TO_MS      khoảng PLAN DATE (epoch ms) — mặc định 20/07→27/07/2026
 *    DS_WRITE=0                 chỉ phân tích, không ghi Google Sheet
 *    DS_SHEET=<id>              sheet đích (mặc định sheet factory)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { layTokenSongWms, fetchThuLai } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const APPSCRIPT_URL = process.env.APPSCRIPT_URL || "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
const APPSCRIPT_KEY = process.env.APPSCRIPT_KEY;
const SHEET_ID = process.env.DS_SHEET || "1eY_oo9fAvWCTXp24x-Z0FXq9mp_jJPlTHg09qdemETs";
const GW = "https://wms-gw.inshasaki.com/api/v1/wms/counting-plan/checklists";
const GW_TRACKING = "https://wms-gw.inshasaki.com/api/v1/wms/counting-plan/checklist/tracking";
const CACHE_FILE = path.join(DIR, ".doi-soat-cache.json");

const WH = process.env.DS_WH || "1339";
const FROM_MS = process.env.DS_FROM_MS || "1784480400000";   // 00:00 20/07/2026 (giờ VN)
const TO_MS = process.env.DS_TO_MS || "1785171599999";       // 23:59 27/07/2026
const WRITE = String(process.env.DS_WRITE ?? "1") === "1";
const CHUNK = 4000;

const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);
const nghi = (ms) => new Promise((r) => setTimeout(r, ms));
const getRecs = (j) => j.records || (j.data && (j.data.records || j.data.rows || j.data.content)) || j.rows || [];
const n0 = (v) => Number(v) || 0;

/* Phiếu ĐÃ đếm xong — chỉ những trạng thái này mới đưa vào bài toán thiếu/thừa.
   Danh sách bám status_name thật của WMS; trạng thái lạ sẽ được liệt kê ở console để bổ sung. */
const TT_DA_DEM = new Set(["APPROVED", "WAITING FOR APPROVE", "COUNTED", "DONE", "COMPLETED"]);
const TT_BO_QUA = new Set(["CANCELLED", "CANCELED", "REJECTED"]);

let token = null;
async function lamTuoiToken() {
  for (let i = 1; i <= 3; i++) {
    await nghi(15000 * i);
    const t = await layTokenSongWms(DIR, log);
    if (t) { token = t; return true; }
  }
  return false;
}
async function layJson(url) {
  let r = await fetchThuLai(url, { headers: { authorization: token } });
  if (r.status === 401 || r.status === 403) {
    log("  … token bị đá — chờ mượn token phiên mới (KHÔNG đăng nhập mới)...");
    if (!(await lamTuoiToken())) throw new Error("Mất token sống giữa chừng, không mượn lại được.");
    r = await fetchThuLai(url, { headers: { authorization: token } });
  }
  if (r.status !== 200) throw new Error(url.slice(0, 90) + " → HTTP " + r.status);
  return await r.json();
}

/* ---------------- 1) Danh sách phiếu theo VỊ TRÍ trong khoảng plan date ---------------- */
async function keoPhieu() {
  const out = [];
  for (let page = 1; page <= 50; page++) {
    const j = await layJson(GW + "/type-location?from_plan_date=" + FROM_MS + "&to_plan_date=" + TO_MS +
      "&warehouse_ids=" + WH + "&page=" + page + "&size=200");
    const recs = getRecs(j);
    if (!recs.length) break;
    out.push(...recs);
    const total = j.count ?? j.total ?? null;
    if (recs.length < 200 || (total != null && out.length >= Number(total))) break;
    await nghi(300);
  }
  return out;
}

/* ---------------- 2) Tracking từng phiếu (cache theo checklist_id|updated_at) ---------------- */
async function keoTracking(cid) {
  const all = [];
  for (let page = 1; page <= 20; page++) {
    const j = await layJson(GW_TRACKING + "?checklist_id=" + cid + "&page=" + page + "&size=200");
    const recs = getRecs(j);
    if (!recs.length) break;
    all.push(...recs);
    const total = j.count ?? (j.data && j.data.count) ?? null;
    if (recs.length < 200 || (total != null && all.length >= Number(total))) break;
  }
  return all;
}

const ujParse = (s) => { try { const a = JSON.parse(s || "[]"); return Array.isArray(a) ? a : []; } catch { return []; } };
const uidList = (s) => {
  const t = ujParse(s).map((e) => (e && e.group_uid_code != null && e.group_uid_code !== "" ? String(e.group_uid_code) : "")).filter(Boolean);
  return [...new Set(t)].join(", ");
};
const donViCua = (ten) => { const p = String(ten || "").split("/"); return (p[p.length - 1] || "").trim(); };

(async () => {
  if (WRITE && !APPSCRIPT_KEY) { console.error("✗ Thiếu APPSCRIPT_KEY trong .env (hoặc chạy DS_WRITE=0)."); process.exit(3); }
  token = await layTokenSongWms(DIR, log);
  if (!token) { log("✗ Không có token WMS còn sống. Trong giờ làm KHÔNG tự đăng nhập (tránh đá phiên) — chạy lại sau 18h hoặc mở WMS trên trình duyệt trước."); process.exit(2); }

  log("Kho " + WH + " · plan " + new Date(Number(FROM_MS)).toLocaleDateString("vi-VN") + " → " + new Date(Number(TO_MS)).toLocaleDateString("vi-VN"));
  const phieu = await keoPhieu();
  const tt = {}; phieu.forEach((p) => { tt[p.status_name || "?"] = (tt[p.status_name || "?"] || 0) + 1; });
  log("✓ " + phieu.length + " phiếu vị trí — trạng thái: " + JSON.stringify(tt));

  const dung = phieu.filter((p) => TT_DA_DEM.has(String(p.status_name || "").toUpperCase()));
  const boQua = phieu.filter((p) => !TT_DA_DEM.has(String(p.status_name || "").toUpperCase()));
  const laLa = [...new Set(boQua.map((p) => p.status_name).filter((s) => !TT_BO_QUA.has(String(s || "").toUpperCase())))];
  log("  → đưa vào đối soát: " + dung.length + " phiếu đã đếm; bỏ qua " + boQua.length + " phiếu chưa đếm/huỷ."
    + (laLa.length ? "  ⚠ trạng thái chưa phân loại: " + laLa.join(", ") : ""));

  let cache = {}; try { cache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")); } catch {}
  const canKeo = dung.filter((p) => !(cache[p.checklist_id] && cache[p.checklist_id].u === String(p.updated_at || "")));
  log("Kéo tracking: " + canKeo.length + " phiếu mới/đổi (cache dùng lại " + (dung.length - canKeo.length) + ")...");

  let idx = 0, xong = 0;
  const worker = async () => {
    for (;;) {
      const i = idx++; if (i >= canKeo.length) return;
      const p = canKeo[i];
      cache[p.checklist_id] = { u: String(p.updated_at || ""), recs: await keoTracking(p.checklist_id) };
      if (++xong % 50 === 0) log("  … " + xong + "/" + canKeo.length);
      await nghi(120);
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, canKeo.length) }, worker));
  try { fs.writeFileSync(CACHE_FILE, JSON.stringify(cache)); } catch (e) { log("  ⚠ không lưu được cache: " + e.message); }

  /* ---------------- 3) Dựng bảng dòng chi tiết ---------------- */
  const tho = [], chuaDem = [];
  for (const p of dung) {
    const c = cache[p.checklist_id]; if (!c) continue;
    for (const r of c.recs) {
      const sys = n0(r.qty_by_sys);
      const diff = r.qty_diff == null ? null : n0(r.qty_diff);
      const factor = (r.combo_factors && r.combo_factors[0] && n0(r.combo_factors[0].factor)) || 1;
      const base = {
        cid: p.checklist_id, plan: p.plan_id, ngay: p.plan_date || "", ttPhieu: p.status_name || "",
        loc: r.bin_location || p.plan_object_code || "", sku: String(r.sku || ""), ten: r.product_name || "",
        sys, factor, nguoi: p.checklist_by_name || "", gio: p.checklist_at || "",
        moc: String(p.checklist_at || p.updated_at || p.plan_date || ""),
        uidU: uidList(r.exp_by_user), uidS: uidList(r.exp_by_sys),
      };
      if (r.status_id !== 4) { chuaDem.push({ ...base, ttDong: r.status_id === 2 ? "Count cancelled" : "Not counted" }); continue; }
      tho.push({ ...base, cnt: sys + (diff || 0), diff: diff || 0, ttDong: "Counted" });
    }
  }

  /* KHỬ ĐẾM TRÙNG — bắt buộc: 1 vị trí thường được đếm lại ở nhiều phiếu trong cùng cửa sổ ngày
     (đo 27/07: 389/720 cặp (vị trí,SKU) lặp ở ≥2 phiếu). Cộng dồn cả hai lần = nhân đôi số liệu.
     Giữ lần đếm MỚI NHẤT theo mốc checklist_at; các lần trước chỉ dùng để đếm số lần kiểm. */
  const uniq = new Map();
  for (const d of tho) {
    const k = d.loc + "|" + d.sku;
    const cu = uniq.get(k);
    if (!cu) { uniq.set(k, { ...d, soLanDem: 1 }); continue; }
    cu.soLanDem++;
    if (d.moc > cu.moc) { uniq.set(k, { ...d, soLanDem: cu.soLanDem }); }
  }
  const dong = [...uniq.values()];
  const lech = dong.filter((d) => d.diff !== 0);
  log("✓ Dòng tracking thô: " + tho.length + " → khử đếm trùng còn " + dong.length + " cặp (vị trí,SKU) — lấy lần đếm mới nhất.");
  log("  Dòng LỆCH: " + lech.length + " · dòng chưa đếm trong phiếu đã xong: " + chuaDem.length);

  /* ---------------- 4) TẦNG 1 — bù trừ CÙNG SKU giữa các vị trí ---------------- */
  const theoSku = new Map();
  for (const d of dong) {
    const o = theoSku.get(d.sku) || { sku: d.sku, ten: d.ten, factor: d.factor, sys: 0, cnt: 0, thieu: [], thua: [], soVt: 0 };
    o.sys += d.sys; o.cnt += d.cnt;
    if (d.diff < 0) o.thieu.push(d);
    if (d.diff > 0) o.thua.push(d);
    if (d.diff !== 0) o.soVt++;
    if (!o.ten && d.ten) o.ten = d.ten;
    theoSku.set(d.sku, o);
  }

  /* ---------------- 5) TẦNG 2 — bù trừ KHÁC SKU trong CÙNG vị trí (nghi nhầm mã) ---------------- */
  const theoVt = new Map();
  for (const d of lech) {
    const o = theoVt.get(d.loc) || { loc: d.loc, ds: [], ngay: d.ngay, ttPhieu: d.ttPhieu, nguoi: d.nguoi };
    o.ds.push(d); theoVt.set(d.loc, o);
  }
  const cap = [];
  for (const [loc, o] of theoVt) {
    const am = o.ds.filter((d) => d.diff < 0).map((d) => ({ ...d, con: -d.diff })).sort((a, b) => b.con - a.con);
    const duong = o.ds.filter((d) => d.diff > 0).map((d) => ({ ...d, con: d.diff })).sort((a, b) => b.con - a.con);
    // Ghép ưu tiên CÙNG SỐ LƯỢNG (dấu hiệu nhầm mã rõ nhất), sau đó ghép phần dư lớn-với-lớn
    for (const pass of [1, 2]) {
      for (const a of am) {
        if (a.con <= 0) continue;
        for (const b of duong) {
          if (b.con <= 0) continue;
          if (pass === 1 && a.con !== b.con) continue;
          const q = Math.min(a.con, b.con);
          cap.push({ loc, thieu: a, thua: b, q, khop: a.con === b.con && pass === 1 });
          a.con -= q; b.con -= q;
          if (a.con <= 0) break;
        }
      }
    }
    o.tongThieu = o.ds.filter((d) => d.diff < 0).reduce((s, d) => s + (-d.diff), 0);
    o.tongThua = o.ds.filter((d) => d.diff > 0).reduce((s, d) => s + d.diff, 0);
    o.trietTieu = Math.min(o.tongThieu, o.tongThua);
    o.rong = o.tongThua - o.tongThieu;
  }

  /* ---------------- 6) TẦNG 3 — kết luận còn lại ----------------
     ĐƠN VỊ: mỗi SKU có combo_factor riêng (đo 27/07: 1.000 · 32.000 · 3.000.000 · 8.000.000) —
     đó là số đơn vị gốc trên 1 đơn vị đếm (cuộn/kiện). CỘNG SỐ THÔ GIỮA CÁC SKU LÀ VÔ NGHĨA
     (chính là nguồn con số "lệch 1,28 tỷ" ở lượt chạy đầu). Mọi tổng hợp liên-SKU dùng qty ÷ factor. */
  const qd = (v, f) => Math.round((v / (f || 1)) * 1000) / 1000;
  /* Nghi GÕ NHẦM SỐ 0: tỉ lệ đếm/tồn đúng bằng luỹ thừa 10 → gần như chắc chắn lỗi nhập liệu,
     không phải mất hàng. Tách riêng để người kiểm không đi tìm 900 triệu mm vải. */
  const nghiTypo = (sys, cnt) => {
    if (!sys || !cnt) return "";
    const t = cnt / sys;
    for (const [k, nhan] of [[10, "dư 1 số 0"], [100, "dư 2 số 0"], [0.1, "thiếu 1 số 0"], [0.01, "thiếu 2 số 0"]])
      if (Math.abs(t - k) < k * 0.001) return "Nghi gõ " + nhan;
    return "";
  };
  const sku = [...theoSku.values()].map((o) => {
    const net = o.cnt - o.sys;
    const tThieu = o.thieu.reduce((s, d) => s + (-d.diff), 0);
    const tThua = o.thua.reduce((s, d) => s + d.diff, 0);
    const buTruViTri = Math.min(tThieu, tThua);   // phần tự triệt tiêu giữa các vị trí của CÙNG sku
    let ketLuan;
    if (tThieu === 0 && tThua === 0) ketLuan = "Khớp";
    else if (net === 0) ketLuan = "Chỉ SAI VỊ TRÍ (tổng kho khớp)";
    else if (net < 0) ketLuan = buTruViTri > 0 ? "THIẾU thật (đã trừ phần sai vị trí)" : "THIẾU thật";
    else ketLuan = buTruViTri > 0 ? "THỪA thật (đã trừ phần sai vị trí)" : "THỪA thật";
    const typo = o.thieu.concat(o.thua).map((d) => nghiTypo(d.sys, d.cnt)).find(Boolean) || "";
    return { ...o, net, netQd: qd(net, o.factor), tThieu, tThua, buTruViTri, ketLuan, typo };
  }).filter((o) => o.tThieu || o.tThua)
    .sort((a, b) => Math.abs(b.netQd) - Math.abs(a.netQd) || Math.abs(b.net) - Math.abs(a.net));

  const dsVt = (arr) => arr.sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff)).slice(0, 6).map((d) => d.loc + " (" + (d.diff > 0 ? "+" : "") + d.diff + ")").join(" · ");
  const noiKiem = (o) => {
    if (o.net === 0) return "Dời hàng: lấy ở " + dsVt(o.thua) + " bù về " + dsVt(o.thieu);
    if (o.net < 0) return "Kiểm vị trí thiếu: " + dsVt(o.thieu) + (o.thua.length ? " · đã bù từ " + dsVt(o.thua) : "");
    return "Kiểm vị trí thừa: " + dsVt(o.thua) + (o.thieu.length ? " · đã bù cho " + dsVt(o.thieu) : "");
  };

  /* ---------------- 7) Tổng kết ra console ---------------- */
  const tThieuThat = sku.filter((o) => o.net < 0), tThuaThat = sku.filter((o) => o.net > 0), tSaiVt = sku.filter((o) => o.net === 0);
  const nghiTypoDs = sku.filter((o) => o.typo);
  log("");
  log("══ KẾT QUẢ ĐỐI SOÁT ══");
  log("  SKU đã đếm                  : " + theoSku.size + " · có lệch: " + sku.length);
  log("  → chỉ SAI VỊ TRÍ (net = 0)  : " + tSaiVt.length + " SKU — bù trừ giữa các vị trí là hết, chỉ cần dời hàng");
  log("  → THIẾU thật                : " + tThieuThat.length + " SKU");
  log("  → THỪA thật                 : " + tThuaThat.length + " SKU");
  log("  Cặp nghi NHẦM MÃ cùng vị trí: " + cap.filter((c) => c.khop).length + " cặp khớp số lượng / " + cap.length + " cặp bù trừ");
  log("  Nghi LỖI GÕ SỐ 0            : " + nghiTypoDs.length + " SKU (sửa số liệu, không phải mất hàng)");
  log("  Vị trí trong kế hoạch CHƯA ĐẾM: " + boQua.filter((p) => !TT_BO_QUA.has(String(p.status_name || "").toUpperCase())).length + " (vùng mù)");
  log("");
  /* KHÔNG cộng gộp lệch giữa các SKU khác đơn vị (đo 27/07: 634 dòng đơn vị gốc mm/cái,
     363 dòng hệ số 1.000, 103 dòng hệ số tới 8.000.000). Một con số tổng là con số sai. */
  const theoDv = {};
  for (const o of sku) { const u = donViCua(o.ten) || "?"; (theoDv[u] = theoDv[u] || { n: 0, thieu: 0, thua: 0 }); theoDv[u].n++; if (o.net < 0) theoDv[u].thieu += o.netQd; else theoDv[u].thua += o.netQd; }
  log("  Lệch ròng TÁCH THEO ĐƠN VỊ (không cộng gộp — mỗi SKU một hệ số quy đổi):");
  for (const [u, v] of Object.entries(theoDv))
    log("    " + (u + " ").padEnd(8, ".") + " " + String(v.n).padStart(3) + " SKU · thiếu " + Math.round(v.thieu) + " · thừa +" + Math.round(v.thua));
  log("");
  log("  TOP 12 cần kiểm tra:");
  for (const o of sku.filter((x) => x.net !== 0).slice(0, 12))
    log("   " + (o.netQd > 0 ? "+" : "") + String(o.netQd).padStart(10) + " " + (donViCua(o.ten) || "").padEnd(3) + " " + o.sku + "  " + o.ketLuan +
      (o.typo ? "  [" + o.typo + "]" : "") + "  → " + noiKiem(o).slice(0, 85));

  /* ---------------- 8) Ghi Google Sheet ---------------- */
  if (!WRITE) { log("\n(DS_WRITE=0 — không ghi Sheet.)"); process.exit(0); }
  const apiAt = Date.now();
  async function ghiTab(tab, header, rows) {
    if (!rows.length) { log("  (⚠ " + tab + ": 0 dòng — bỏ qua)"); return; }
    for (let i = 0; i < rows.length; i += CHUNK) {
      const body = JSON.stringify({ action: "syncTasks", key: APPSCRIPT_KEY, tab, sheetId: SHEET_ID, header, rows: rows.slice(i, i + CHUNK), append: i > 0, apiAt });
      const j = await (await fetchThuLai(APPSCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body })).json();
      if (j.status !== "success") throw new Error(tab + ": " + (j.message || "?"));
    }
    log("  ✓ " + tab + ": " + rows.length + " dòng.");
  }

  log("\nGhi Google Sheet...");
  await ghiTab("DS-TongHopSKU",
    ["No.", "SKU", "Tên sản phẩm", "Đơn vị gốc", "Hệ số quy đổi", "Số vị trí lệch",
      "Tồn HT (đv đếm)", "Đã đếm (đv đếm)", "LỆCH RÒNG (đv đếm)", "Lệch ròng (số gốc)",
      "Tổng thiếu (đv đếm)", "Tổng thừa (đv đếm)", "Bù trừ giữa các vị trí (đv đếm)",
      "KẾT LUẬN", "Cảnh báo", "KIỂM TRA Ở ĐÂU"],
    sku.map((o, i) => [i + 1, "'" + o.sku, o.ten, donViCua(o.ten), o.factor, o.soVt,
      qd(o.sys, o.factor), qd(o.cnt, o.factor), o.netQd, o.net,
      qd(o.tThieu, o.factor), qd(o.tThua, o.factor), qd(o.buTruViTri, o.factor),
      o.ketLuan, o.typo, noiKiem(o)]));

  await ghiTab("DS-ChiTietLech",
    ["No.", "Checklist", "Plan", "Ngày plan", "Trạng thái phiếu", "Vị trí", "SKU", "Tên sản phẩm", "Hệ số",
      "Tồn HT (đv đếm)", "Đã đếm (đv đếm)", "LỆCH (đv đếm)", "Lệch (số gốc)", "Số lần đếm lại",
      "UID group đếm", "UID group hệ thống", "Người đếm", "Giờ đếm"],
    lech.sort((a, b) => Math.abs(qd(b.diff, b.factor)) - Math.abs(qd(a.diff, a.factor))).map((d, i) =>
      [i + 1, d.cid, d.plan, d.ngay, d.ttPhieu, d.loc, "'" + d.sku, d.ten, d.factor,
        qd(d.sys, d.factor), qd(d.cnt, d.factor), qd(d.diff, d.factor), d.diff, d.soLanDem,
        d.uidU ? "'" + d.uidU : "", d.uidS ? "'" + d.uidS : "", d.nguoi, d.gio]));

  await ghiTab("DS-CapNghiNhamMa",
    ["No.", "Vị trí", "SKU thiếu", "Tên SKU thiếu", "SKU thừa", "Tên SKU thừa", "SL bù trừ", "Khớp đúng số lượng?", "Ghi chú"],
    cap.sort((a, b) => (b.khop ? 1 : 0) - (a.khop ? 1 : 0) || b.q - a.q).map((c, i) =>
      [i + 1, c.loc, "'" + c.thieu.sku, c.thieu.ten, "'" + c.thua.sku, c.thua.ten, c.q, c.khop ? "CÓ — nghi nhầm mã" : "Một phần",
        c.khop ? "Ra vị trí đối chiếu tem 2 mã này" : "Bù trừ một phần, cần xem cả vị trí"]));

  await ghiTab("DS-TheoViTri",
    ["No.", "Vị trí", "Số dòng lệch", "Tổng thiếu", "Tổng thừa", "Tự triệt tiêu trong vị trí", "Lệch ròng còn lại", "Ngày plan", "Trạng thái phiếu", "Người đếm"],
    [...theoVt.values()].sort((a, b) => Math.abs(b.rong) - Math.abs(a.rong) || b.trietTieu - a.trietTieu).map((o, i) =>
      [i + 1, o.loc, o.ds.length, o.tongThieu, o.tongThua, o.trietTieu, o.rong, o.ngay, o.ttPhieu, o.nguoi]));

  if (chuaDem.length) await ghiTab("DS-ChuaDem",
    ["No.", "Checklist", "Ngày plan", "Trạng thái phiếu", "Vị trí", "SKU", "Tên sản phẩm", "Tồn HT", "Trạng thái dòng"],
    chuaDem.map((d, i) => [i + 1, d.cid, d.ngay, d.ttPhieu, d.loc, "'" + d.sku, d.ten, d.sys, d.ttDong]));

  /* Vị trí NẰM TRONG KẾ HOẠCH NHƯNG CHƯA ĐẾM — cũng là câu trả lời cho "kiểm tra ở đâu":
     chưa đếm thì không thể kết luận đủ/thiếu, đây là vùng mù của đợt kiểm kê. */
  const vtChuaDem = boQua.filter((p) => !TT_BO_QUA.has(String(p.status_name || "").toUpperCase()));
  if (vtChuaDem.length) await ghiTab("DS-ViTriChuaDem",
    ["No.", "Checklist", "Plan", "Ngày plan", "Vị trí", "Trạng thái", "Người tạo", "Cập nhật lúc"],
    vtChuaDem.map((p, i) => [i + 1, p.checklist_id, p.plan_id, p.plan_date || "", p.plan_object_code || "",
      p.status_name || "", p.created_by_name || "", p.updated_at || ""]));

  log("✓ HOÀN TẤT — mở Sheet " + SHEET_ID + " xem 4-5 tab DS-*");
  process.exit(0);
})().catch((e) => { log("✗ " + (e && e.message ? e.message : e)); process.exit(2); });
