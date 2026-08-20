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
 *  CHỈ tính dòng đã ghi nhận (có qty_by_user / qty_diff / date_added) thuộc phiếu đã đếm xong.
 *  Phiếu PENDING/PROCESSING bị loại từ tầng phiếu — gộp vào sẽ ra thiếu ảo. Lưu ý status_id dòng
 *  KHÔNG phải dấu "đã đếm" với plan FULL_LOCATION_FACTORY (dòng lệch mang status_id = 2).
 *
 *  Chạy:  node doi-soat-kiemke.mjs
 *  Tham số qua .env / dòng lệnh:
 *    DS_WH=1339                 kho (mặc định WH - MATERIAL - GARMENT)
 *    DS_PLAN=243605             đối soát 1 KẾ HOẠCH kiểm kê cụ thể (Request code) — bỏ khoảng plan date
 *    DS_FROM_MS / DS_TO_MS      khoảng PLAN DATE (epoch ms) — mặc định 20/07→27/07/2026
 *    DS_WRITE=0                 chỉ phân tích, không ghi Google Sheet
 *    DS_SHEET=<id>              sheet đích (mặc định sheet factory) — GAS phải MỞ ĐƯỢC sheet đó
 *    DS_CSV=<path>              xuất thêm CSV (tạo file Google Sheet MỚI: import/convert CSV này —
 *                               GAS không mở được file ngoài tài khoản của nó)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { layTokenSongWms, fetchThuLai, gasPost } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const APPSCRIPT_URL = process.env.APPSCRIPT_URL || "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
const APPSCRIPT_KEY = process.env.APPSCRIPT_KEY;
const SHEET_ID = process.env.DS_SHEET || "1eY_oo9fAvWCTXp24x-Z0FXq9mp_jJPlTHg09qdemETs";
const GW = "https://wms-gw.inshasaki.com/api/v1/wms/counting-plan/checklists";
const GW_TRACKING = "https://wms-gw.inshasaki.com/api/v1/wms/counting-plan/checklist/tracking";
const PLAN_ID = String(process.env.DS_PLAN || "").trim();
const CACHE_FILE = path.join(DIR, PLAN_ID ? ".doi-soat-cache-plan" + PLAN_ID + ".json" : ".doi-soat-cache.json");

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
  const dieuKien = PLAN_ID
    ? "plan_id=" + PLAN_ID + "&warehouse_ids=" + WH
    : "from_plan_date=" + FROM_MS + "&to_plan_date=" + TO_MS + "&warehouse_ids=" + WH;
  for (let page = 1; page <= 50; page++) {
    const j = await layJson(GW + "/type-location?" + dieuKien + "&page=" + page + "&size=200");
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
  let cache = {}; try { cache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")); } catch {}
  token = await layTokenSongWms(DIR, log);

  log(PLAN_ID
    ? "Kho " + WH + " · request code " + PLAN_ID + " (đối soát riêng 1 kế hoạch kiểm kê)"
    : "Kho " + WH + " · plan " + new Date(Number(FROM_MS)).toLocaleDateString("vi-VN") + " → " + new Date(Number(TO_MS)).toLocaleDateString("vi-VN"));

  /* KHÔNG có token sống (operator vừa đăng nhập WMS — 1 phiên/tài khoản): TUYỆT ĐỐI không
     tự đăng nhập trong giờ làm. Vẫn dựng lại được báo cáo từ dữ liệu đã kéo:
       · danh sách phiếu  ← .doi-soat-cache.json (__phieu) hoặc .pc-cache.json của push-pc-to-sheet
       · tracking từng phiếu ← .doi-soat-cache.json
     Chỉ thiếu phiếu phát sinh sau lần kéo cuối — có cảnh báo mốc giờ để người đọc tự cân nhắc. */
  let phieu = null, ngoaiTuyen = false, mocCache = 0;
  if (token) {
    phieu = await keoPhieu();
    cache.__phieu = { at: Date.now(), list: phieu };
  } else {
    if (cache.__phieu && cache.__phieu.list) { phieu = cache.__phieu.list; mocCache = cache.__phieu.at; }
    else {
      try {   // đường lùi 2: mượn danh sách phiếu của bộ push-pc-to-sheet (cùng kho, cùng nguồn API)
        const pc = JSON.parse(fs.readFileSync(path.join(DIR, ".pc-cache.json"), "utf8"));
        const trongKhoang = (d) => { const t = Date.parse(String(d || "") + "T00:00:00+07:00"); return t >= Number(FROM_MS) && t <= Number(TO_MS); };
        phieu = (pc.fLoc || []).filter((r) => String(r.warehouse_id) === String(WH) && (PLAN_ID ? String(r.plan_id) === PLAN_ID : trongKhoang(r.plan_date)));
        mocCache = pc.fullAt || 0;
      } catch { phieu = null; }
    }
    if (!phieu || !phieu.length) { log("✗ Không có token WMS sống và cũng không có cache để dựng lại. Chạy lại sau 18h."); process.exit(2); }
    ngoaiTuyen = true;
    log("⚠ CHẠY NGOÀI TUYẾN: token WMS đã bị đá (operator đang dùng) — KHÔNG đăng nhập mới.");
    log("  Dựng báo cáo từ cache lúc " + (mocCache ? new Date(mocCache).toLocaleString("vi-VN") : "?") + " — phiếu phát sinh sau mốc này chưa có.");
  }
  if (PLAN_ID) phieu = phieu.filter((p) => String(p.plan_id) === PLAN_ID);   // phòng API trả lẫn plan khác
  const boiCanh = phieu[0] || {};
  if (PLAN_ID) log("  Kế hoạch: type " + (boiCanh.plan_type || "?") + " · kho " + (boiCanh.warehouse_name || "?"));
  const tt = {}; phieu.forEach((p) => { tt[p.status_name || "?"] = (tt[p.status_name || "?"] || 0) + 1; });
  log("✓ " + phieu.length + " phiếu vị trí — trạng thái: " + JSON.stringify(tt));

  const dung = phieu.filter((p) => TT_DA_DEM.has(String(p.status_name || "").toUpperCase()));
  const boQua = phieu.filter((p) => !TT_DA_DEM.has(String(p.status_name || "").toUpperCase()));
  const laLa = [...new Set(boQua.map((p) => p.status_name).filter((s) => !TT_BO_QUA.has(String(s || "").toUpperCase())))];
  log("  → đưa vào đối soát: " + dung.length + " phiếu đã đếm; bỏ qua " + boQua.length + " phiếu chưa đếm/huỷ."
    + (laLa.length ? "  ⚠ trạng thái chưa phân loại: " + laLa.join(", ") : ""));

  const canKeo = dung.filter((p) => !(cache[p.checklist_id] && cache[p.checklist_id].u === String(p.updated_at || "")));
  if (ngoaiTuyen) {
    const thieu = dung.filter((p) => !cache[p.checklist_id]).length;
    log("  Ngoài tuyến: dùng tracking trong cache cho " + (dung.length - thieu) + "/" + dung.length + " phiếu"
      + (thieu ? " — THIẾU " + thieu + " phiếu chưa từng kéo, không có trong báo cáo này." : "."));
  } else {
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
  }

  /* ---------------- 3) Dựng bảng dòng chi tiết ---------------- */
  const tho = [], chuaDem = [];
  for (const p of dung) {
    const c = cache[p.checklist_id]; if (!c) continue;
    for (const r of c.recs) {
      const sys = n0(r.qty_by_sys);
      const user = r.qty_by_user == null ? null : n0(r.qty_by_user);
      /* FULL_LOCATION_FACTORY (đo plan 243605, 29/07/2026): status_id KHÔNG còn là dấu "đã đếm" —
         dòng lệch nằm ở st2 (qty_diff = user−sys; hoặc = −sys khi SKU không tìm thấy, user null).
         Kiểm chứng: quy tắc diff = qty_diff ?? (user−sys) khớp cờ is_diff của WMS 179/181 phiếu
         APPROVED (2 phiếu lệch tầng UID-group, tổng SKU vẫn khớp). Dòng "đã ghi nhận" = có user
         hoặc qty_diff hoặc date_added trong exp_by_user; dòng không dấu vết nào mới là chưa đếm. */
      const diff = r.qty_diff != null ? n0(r.qty_diff) : (user != null ? user - sys : null);
      const daGhiNhan = r.status_id === 4 || diff != null || ujParse(r.exp_by_user).some((e) => e && e.date_added);
      const factor = (r.combo_factors && r.combo_factors[0] && n0(r.combo_factors[0].factor)) || 1;
      const base = {
        cid: p.checklist_id, plan: p.plan_id, ngay: p.plan_date || "", ttPhieu: p.status_name || "",
        loc: r.bin_location || p.plan_object_code || "", sku: String(r.sku || ""), ten: r.product_name || "",
        sys, factor, nguoi: p.checklist_by_name || "", gio: p.checklist_at || "",
        moc: String(p.checklist_at || p.updated_at || p.plan_date || ""),
        uidU: uidList(r.exp_by_user), uidS: uidList(r.exp_by_sys),
      };
      if (!daGhiNhan) { chuaDem.push({ ...base, ttDong: r.status_id === 2 ? "Count cancelled" : "Not counted" }); continue; }
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
  const skuTatCa = [...theoSku.values()].map((o) => {
    const net = o.cnt - o.sys;
    const tThieu = o.thieu.reduce((s, d) => s + (-d.diff), 0);
    const tThua = o.thua.reduce((s, d) => s + d.diff, 0);
    const buTruViTri = Math.min(tThieu, tThua);   // phần tự triệt tiêu giữa các vị trí của CÙNG sku
    let ketLuan;
    if (tThieu === 0 && tThua === 0) ketLuan = "Khớp";
    else if (net < 0) ketLuan = buTruViTri > 0 ? "THIẾU thật (đã trừ phần sai vị trí)" : "THIẾU thật";
    else ketLuan = buTruViTri > 0 ? "THỪA thật (đã trừ phần sai vị trí)" : "THỪA thật";
    const typo = o.thieu.concat(o.thua).map((d) => nghiTypo(d.sys, d.cnt)).find(Boolean) || "";
    return { ...o, net, netQd: qd(net, o.factor), tThieu, tThua, buTruViTri, ketLuan, typo };
  }).filter((o) => o.tThieu || o.tThua)
    .sort((a, b) => Math.abs(b.netQd) - Math.abs(a.netQd) || Math.abs(b.net) - Math.abs(a.net));

  /* QUY TẮC 27/07 (chỉ thị nghiệp vụ): CÙNG SKU thiếu chỗ này – thừa chỗ khác ĐÚNG BẰNG NHAU
     thì hàng vẫn còn nguyên trong kho, chỉ nằm sai ô → COI NHƯ KHÔNG LỆCH, không đưa vào báo cáo.
     Chỉ giữ phần dư sau khi đã bù trừ hết (net ≠ 0) — đó mới là thứ phải đi tìm. */
  const skuBuTruHet = skuTatCa.filter((o) => o.net === 0);
  const sku = skuTatCa.filter((o) => o.net !== 0);
  const conLech = new Set(sku.map((o) => o.sku));
  const lechGhi = lech.filter((d) => conLech.has(d.sku));

  const dsVt = (arr) => arr.sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff)).slice(0, 6).map((d) => d.loc + " (" + (d.diff > 0 ? "+" : "") + d.diff + ")").join(" · ");
  const noiKiem = (o) => {
    if (o.net === 0) return "Dời hàng: lấy ở " + dsVt(o.thua) + " bù về " + dsVt(o.thieu);
    if (o.net < 0) return "Kiểm vị trí thiếu: " + dsVt(o.thieu) + (o.thua.length ? " · đã bù từ " + dsVt(o.thua) : "");
    return "Kiểm vị trí thừa: " + dsVt(o.thua) + (o.thieu.length ? " · đã bù cho " + dsVt(o.thieu) : "");
  };

  /* ---------------- 7) Tổng kết ra console ---------------- */
  const tThieuThat = sku.filter((o) => o.net < 0), tThuaThat = sku.filter((o) => o.net > 0);
  const nghiTypoDs = sku.filter((o) => o.typo);
  log("");
  log("══ KẾT QUẢ ĐỐI SOÁT ══");
  log("  SKU đã đếm                  : " + theoSku.size + " · có chênh lệch thô: " + skuTatCa.length);
  log("  → BÙ TRỪ HẾT, coi như KHÔNG LỆCH: " + skuBuTruHet.length + " SKU (thiếu chỗ này = thừa chỗ khác, chỉ dời hàng)");
  log("  → CÒN LỆCH THẬT             : " + sku.length + " SKU  |  THIẾU " + tThieuThat.length + " · THỪA " + tThuaThat.length);
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
  const apiAt = Date.now();
  async function ghiTab(tab, header, rows) {
    if (!rows.length) { log("  (⚠ " + tab + ": 0 dòng — bỏ qua)"); return; }
    for (let i = 0; i < rows.length; i += CHUNK) {
      const body = JSON.stringify({ action: "syncTasks", key: APPSCRIPT_KEY, tab, sheetId: SHEET_ID, header, rows: rows.slice(i, i + CHUNK), append: i > 0, apiAt });
      const j = await gasPost(body, log, tab + " gói " + (i / CHUNK + 1));   // nonce chặn ghi trùng khi thử lại
      if (j.status !== "success") throw new Error(tab + ": " + (j.message || "?"));
    }
    log("  ✓ " + tab + ": " + rows.length + " dòng.");
  }

  /* ---- MỘT TAB DUY NHẤT, ƯU TIÊN THEO SKU, VỊ TRÍ LỒNG BÊN TRONG ----
     Cấu trúc: [dòng bối cảnh] → mục LỆCH DƯƠNG → mục LỆCH ÂM.
     Mỗi SKU 1 dòng tổng (đã bù trừ hết các vị trí), ngay dưới là các vị trí CÓ LỆCH
     của chính SKU đó (thừa xếp trước, thiếu xếp sau) để thấy A bù cho B ra sao.
     Số hiển thị là SỐ GỐC ĐÚNG NHƯ WMS để người đi kiểm đối chiếu thẳng trên màn hình;
     cột quy đổi chỉ điền khi SKU có hệ số (cuộn/kiện). */
  const HEADER1 = ["Nhóm", "SKU", "Tên sản phẩm", "Vị trí", "Đơn vị", "Tồn HT", "Đã đếm", "LỆCH", "Hệ số", "Lệch quy đổi", "Ghi chú"];
  const trong = (n) => Array(n).fill("");
  const duong = sku.filter((o) => o.net > 0).sort((a, b) => b.net - a.net);
  const am = sku.filter((o) => o.net < 0).sort((a, b) => a.net - b.net);
  const rows1 = [];
  const nhanPhamVi = PLAN_ID
    ? "Request code " + PLAN_ID + " · " + (boiCanh.plan_type || "?") + " · " + (boiCanh.warehouse_name || "kho " + WH)
    : "kho " + WH + " · plan " + new Date(Number(FROM_MS)).toLocaleDateString("vi-VN") + "–" + new Date(Number(TO_MS)).toLocaleDateString("vi-VN");
  rows1.push(["ĐỐI SOÁT KIỂM KÊ · " + nhanPhamVi + " · " + dung.length + " phiếu đã đếm · " + theoSku.size + " SKU" +
    " · QUY TẮC: SKU thiếu ở bin A mà thừa ĐÚNG BẰNG NHAU ở bin B ⇒ KHÔNG lệch (" + skuBuTruHet.length + " SKU đã loại)",
    ...trong(10)]);
  /* Khối THỐNG KÊ — chốt các con số tổng ngay đầu tab để người đọc không phải tự đếm lại */
  rows1.push([...trong(11)]);
  rows1.push(["■ THỐNG KÊ", ...trong(10)]);
  const dongTk = (nhan, gt, ghiChu) => rows1.push(["", nhan, gt, "", "", "", "", "", "", "", ghiChu || ""]);
  dongTk("Phiếu vị trí trong kế hoạch", phieu.length, Object.entries(tt).map(([k, v]) => k + ": " + v).join(" · "));
  dongTk("Phiếu đưa vào đối soát (đã đếm)", dung.length, "bỏ qua " + boQua.length + " phiếu chưa đếm/huỷ");
  dongTk("SKU đã đếm", theoSku.size, "");
  dongTk("SKU có chênh lệch thô", skuTatCa.length, "trước khi bù trừ giữa các vị trí");
  dongTk("SKU bù trừ hết → KHÔNG lệch", skuBuTruHet.length, "thiếu chỗ này = thừa chỗ khác, chỉ cần dời hàng");
  dongTk("SKU CÒN LỆCH THẬT (sau bù trừ)", sku.length, "THIẾU " + tThieuThat.length + " SKU · THỪA " + tThuaThat.length + " SKU");
  dongTk("Cặp nghi NHẦM MÃ cùng vị trí", cap.length, cap.filter((c) => c.khop).length + " cặp khớp đúng số lượng");
  dongTk("SKU nghi LỖI GÕ SỐ 0", nghiTypoDs.length, "sửa số liệu, không phải mất hàng");
  dongTk("Vị trí trong kế hoạch CHƯA ĐẾM", boQua.filter((p) => !TT_BO_QUA.has(String(p.status_name || "").toUpperCase())).length, "vùng mù — lệch thật có thể thay đổi khi đếm nốt");
  for (const [u, v] of Object.entries(theoDv))
    dongTk("Lệch ròng đơn vị " + u, (v.thieu ? "thiếu " + Math.round(v.thieu) : "") + (v.thieu && v.thua ? " · " : "") + (v.thua ? "thừa +" + Math.round(v.thua) : ""), v.n + " SKU — số đã quy đổi hệ số, KHÔNG cộng gộp khác đơn vị");
  for (const [nhan, ds] of [["LỆCH DƯƠNG", duong], ["LỆCH ÂM", am]]) {
    rows1.push([...trong(11)]);
    rows1.push(["■ " + nhan + " — " + ds.length + " SKU (tổng lệch mọi vị trí " + (nhan === "LỆCH DƯƠNG" ? "> 0" : "< 0") + ")", ...trong(10)]);
    for (const o of ds) {
      rows1.push([nhan, "'" + o.sku, o.ten, o.soVt + " vị trí lệch", donViCua(o.ten), o.sys, o.cnt, o.net,
        o.factor > 1 ? o.factor : "", o.factor > 1 ? o.netQd : "",
        o.ketLuan + (o.typo ? " · " + o.typo : "") + (o.buTruViTri > 0 ? " · đã bù trừ " + o.buTruViTri + " giữa các vị trí" : "")]);
      for (const d of o.thua.concat(o.thieu).sort((a, b) => b.diff - a.diff))
        rows1.push(["", "", "", "    └ " + d.loc, "", d.sys, d.cnt, d.diff, "", "",
          (d.diff > 0 ? "thừa tại bin này" : "thiếu tại bin này") + (d.soLanDem > 1 ? " · đếm lại " + d.soLanDem + " lần, lấy lần mới nhất " + d.gio : "")]);
    }
  }
  /* CSV: cho luồng "xuất ra file Sheet MỚI" — dấu nháy ép-text bỏ đi vì import CSV không hiểu nó */
  const CSV_PATH = String(process.env.DS_CSV || "");
  if (CSV_PATH) {
    const oCsv = (v) => { let s = String(v ?? ""); if (s.startsWith("'")) s = s.slice(1); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const bom = String.fromCharCode(0xfeff);   // Excel mở CSV tiếng Việt không vỡ font
    fs.writeFileSync(CSV_PATH, bom + [HEADER1, ...rows1].map((r) => r.map(oCsv).join(",")).join("\r\n"), "utf8");
    log("✓ Xuất CSV: " + CSV_PATH + " (" + rows1.length + " dòng).");
  }
  if (!WRITE) { log("\n(DS_WRITE=0 — không ghi Google Sheet.)"); process.exit(0); }
  log("\nGhi Google Sheet...");
  await ghiTab("DOI-SOAT-LECH", HEADER1, rows1);

  log("✓ HOÀN TẤT — tab DOI-SOAT-LECH trên Sheet " + SHEET_ID + (ngoaiTuyen ? "  (dữ liệu từ cache, không phải vừa kéo)" : ""));
  process.exit(0);
})().catch((e) => { log("✗ " + (e && e.message ? e.message : e)); process.exit(2); });
