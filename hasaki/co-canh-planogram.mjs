/**
 * co-canh-planogram.mjs — CÒ CANH LỊCH KHAI BÁO PLANOGRAM (kho 170)
 * ==================================================================
 *  Mục tiêu (user chốt 19/09/2026): theo dõi lịch / chu kỳ / trạng thái / bộ ảnh tiêu chuẩn
 *  trên planogram, đối chiếu với MỐC GỐC là bảng kế hoạch của g-sheet, phát hiện ngay khi
 *  có thay đổi, và gắn hyperlink lịch ngay trong g-sheet.
 *
 *  BỐ CỤC G-SHEET (user chỉnh lần 3, 26/09/2026 "tràn lan đại hải, k biết xem gì"):
 *  `MỤC LỤC` + `BAO-DUONG-170` = bản gốc CỦA USER (không đụng).
 *  `THEO-DOI-PLANOGRAM` = trang CHO NGƯỜI ĐỌC: B4 câu TÌNH TRẠNG · bảng ① ĐIỂM LỆCH A10:G309 ·
 *  bảng ② NHẬT KÝ I10:O509 (tiêu đề tĩnh dòng 8–9, freeze dòng 10, màu theo Mức bằng định dạng
 *  có điều kiện đã cài sẵn). Loại lệch DỊCH sang câu thường (bảng DICH), chữ dài cắt 120 ký tự.
 *  `DU-LIEU-MAY` (tab ẨN) = bảng tiêu chuẩn 302×23 — mốc gốc đọc ở đây, người không phải thấy.
 *  Ghi bằng GAS `vungLenh` (setValues theo vùng, giữ định dạng ô, KHÔNG clear tab).
 *
 *  BA PHÉP SO:
 *    ① so với KẾ HOẠCH (tab gốc)  → mất tiêu chuẩn · lệch chu kỳ · lịch đã đổi mã
 *    ② so với LẦN CANH TRƯỚC      → đổi trạng thái · đổi nhịp · thêm/bớt/sửa ảnh · lịch mới/mất
 *    ③ tự kiểm                    → lịch không còn tiêu chuẩn thật (chỉ "Trực diện")
 *
 *  TẢI UPSTREAM (mục 2 BỘ-CHUẨN): **2 lượt gọi planogram mỗi lượt canh** — đúng 1 endpoint
 *  `location-schedules` size=200 (2 trang cho ~400 lịch của kho 863+874), đã mang sẵn
 *  trạng thái + nhịp + standard_image nên KHÔNG phải gọi detail từng lịch.
 *  Nhịp mặc định 15' trong cửa 07:00–18:00 T2–T7 ⇒ ~44 lượt canh ⇒ **~88 lượt/ngày**.
 *  Mốc gốc g-sheet chỉ tải lại khi Drive báo file đổi (1 lượt metadata, không đụng upstream).
 *  Không đổi gì thì KHÔNG ghi Sheet (hash-skip) và KHÔNG nhắn Telegram.
 *
 *  Chạy:
 *    node co-canh-planogram.mjs                 # một lượt canh (tôn trọng cửa giờ)
 *    node co-canh-planogram.mjs --force         # xuyên cửa giờ (chữa cháy)
 *    node co-canh-planogram.mjs --moc           # đặt lại mốc: coi hiện trạng là "bình thường"
 *    node co-canh-planogram.mjs --thu           # chỉ in, không ghi Sheet, không nhắn
 *    node co-canh-planogram.mjs --sau           # kèm lớp sâu: đọc SKU từng lịch của 38 ô kế hoạch
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { layTokenSongWms, gasPost, phutVN, mayDuocChay } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const EXT = "https://wms-gw-external.hasaki.vn/api/v1";
const SHEET = "1ERdim9g4-BbJspzWhIfy6jWXFMMNya4zhhvWYF59GHc";
const TAB = "THEO-DOI-PLANOGRAM";  // trang cho NGƯỜI: TÌNH TRẠNG B4 + bảng ① A10:G309 + bảng ② I10:O509
const TAB_GOC = "DU-LIEU-MAY";     // tab ẨN chứa bảng tiêu chuẩn — mốc gốc đọc ở đây
const CAP_HT = 300, CAP_NK = 500;  // trần dòng mỗi bảng — ghi đủ trần (đệm "") để tự xoá dòng cũ thừa
const UI = id => `https://planogram.hasaki.vn/asset-management/schedule-of-declaration/details/${id}`;
/* Chu kỳ nghiệp vụ (cột CHU KỲ của g-sheet) → nhịp WMS. Lấy tần suất DÀY NHẤT khi một
   tiêu chuẩn có nhiều chu kỳ (vd "Hàng tuần · Hàng tháng"). WMS không có chu kỳ quý ⇒ 3 tháng/lần
   tạm về ngày 28. Cột "Nhịp lịch WMS" trong sheet là giá trị ghi ngày 16/09, chỉ để tham chiếu. */
const BAC = { "Hàng ngày": 4, "Hàng tuần": 3, "Hàng tháng": 2, "3 tháng/lần": 1 };
const NHIP = { "Hàng ngày": "Daily", "Hàng tuần": "Mon", "Hàng tháng": "28", "3 tháng/lần": "28" };
const nhipTuChuKy = ck => {
  const cs = Object.keys(BAC).filter(k => String(ck).includes(k));
  if (!cs.length) return null;
  return NHIP[cs.sort((a, b) => BAC[b] - BAC[a])[0]];
};
/* 2 ô cửa cuốn được miễn: user chốt 18/09 giữ 2 lịch theo chu kỳ (hằng ngày + quý) */
const MIEN_NHIP = new Set(["F0-A1-00-CC-00-00", "F0-A2-00-CC-00-00"]);

const F_MOC = path.join(DIR, ".co-canh-moc.json");        // ảnh chụp lần canh trước
const F_GOC = path.join(DIR, ".co-canh-goc.json");        // mốc gốc rút từ g-sheet
const F_LOG = path.join(DIR, ".co-canh-nhat-ky.json");    // nhật ký thay đổi (giữ 500 dòng)
const GIU_LOG = 500;

const A = process.argv.slice(2);
const co = c => A.includes(c);
const THU = co("--thu"), FORCE = co("--force"), DAT_MOC = co("--moc"), SAU = co("--sau");
const nay = () => new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour12: false });
const log = (...x) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false }), ...x);

/* .env — bí mật chỉ sống ở đây (mục 1 BỘ-CHUẨN) */
for (const l of fs.readFileSync(path.join(DIR, ".env"), "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Z_0-9]+)\s*=\s*"?([^"#]*)"?\s*$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

/* ─────────── cửa giờ: ĐẶT Ở ĐẦU để tick ngoài giờ không tốn lượt gọi nào ─────────── */
function trongCuaGio(d = new Date()) {
  const thu = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Ho_Chi_Minh", weekday: "short" })
    .format(d).replace(/Sun/, 0).replace(/Mon/, 1).replace(/Tue/, 2).replace(/Wed/, 3)
    .replace(/Thu/, 4).replace(/Fri/, 5).replace(/Sat/, 6));
  const p = phutVN(d);
  return thu >= 1 && thu <= 6 && p >= 7 * 60 && p < 18 * 60;
}
if (!DAT_MOC && !mayDuocChay(log)) process.exit(0);   // vai máy (laptop/PC) — Phần G
if (!FORCE && !DAT_MOC && !trongCuaGio()) { log("ngoài cửa 07:00–18:00 T2–T7 — bỏ lượt, không gọi upstream."); process.exit(0); }

/* ─────────── chống chạy chồng (FAIL-CLOSED, mục 2 BỘ-CHUẨN) ─────────── */
const F_KHOA = path.join(DIR, ".co-canh.lock");
try {
  const st = fs.statSync(F_KHOA);
  if (Date.now() - st.mtimeMs < 10 * 60 * 1000) { log("lượt canh trước còn đang chạy — bỏ lượt này."); process.exit(0); }
} catch (e) { if (e.code !== "ENOENT") { log("không dò được khoá → coi như đang chạy, bỏ lượt."); process.exit(0); } }
fs.writeFileSync(F_KHOA, new Date().toISOString());
const goKhoa = () => { try { fs.unlinkSync(F_KHOA); } catch { /* best-effort */ } };
process.on("exit", goKhoa);

/* ═══════════ 1. MỐC GỐC từ g-sheet (chỉ tải lại khi file đổi) ═══════════ */
async function tokenClasp() {
  const rc = JSON.parse(fs.readFileSync(path.join(os.homedir(), ".clasprc.json"), "utf8"));
  const t = rc.tokens ? rc.tokens.default : rc.token;
  const j = await (await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: t.client_id, client_secret: t.client_secret, refresh_token: t.refresh_token, grant_type: "refresh_token" }),
    signal: AbortSignal.timeout(20000),
  })).json();
  if (!j.access_token) throw new Error("không làm tươi được token clasp");
  return j.access_token;
}

async function napGoc() {
  let cu = null; try { cu = JSON.parse(fs.readFileSync(F_GOC, "utf8")); } catch { /* lần đầu */ }
  const tk = await tokenClasp();
  const H = { authorization: "Bearer " + tk };
  const meta = await (await fetch(`https://www.googleapis.com/drive/v3/files/${SHEET}?fields=modifiedTime`, { headers: H, signal: AbortSignal.timeout(20000) })).json();
  if (cu && cu.modifiedTime === meta.modifiedTime) { log(`mốc gốc: dùng lại (g-sheet chưa đổi từ ${cu.modifiedTime})`); return cu; }

  const XLSX = (await import("xlsx")).default ?? (await import("xlsx"));
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${SHEET}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, { headers: H, signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error("export g-sheet HTTP " + r.status);
  const wb = XLSX.read(Buffer.from(await r.arrayBuffer()), { type: "buffer" });
  const sh = wb.Sheets[TAB_GOC];
  if (!sh) throw new Error(`g-sheet không có tab ${TAB_GOC}`);
  const rows = XLSX.utils.sheet_to_json(sh, { header: 1 });
  /* Tiêu đề dò ĐỘNG theo ô "Bin location" ở cột B — sau lần gộp tab 19/09 tiêu đề nằm ở
     dòng 1, cách đọc cứng "từ dòng 5" cũ bỏ sót 3 dòng kế hoạch đầu. Tab ẩn xuất xlsx
     vẫn đọc bình thường; dừng khi hết dòng Bin location F0-…. */
  const dau = rows.findIndex(r => String((r || [])[1] ?? "").trim() === "Bin location");
  if (dau < 0) throw new Error(`tab ${TAB_GOC} không thấy dòng tiêu đề (cột B = "Bin location")`);
  const ds = [];
  for (let i = dau + 1; i < rows.length; i++) {
    const x = rows[i] || [];
    const bin = String(x[1] || "").trim().toUpperCase();
    const ten = String(x[3] || "").trim();
    if (!/^F0-/.test(bin) || !ten) { if (ds.length && !/^F0-/.test(bin)) break; continue; }
    /* Chỉ tiêu chuẩn ĐÃ NHẬP planogram mới là mốc (cột J). Từ lần gộp 19/09 bảng có thêm 156
       việc bảo trì "chưa nhập" — đem ra so thì đẻ 61/65 báo động giả (đo 26/09). */
    if (String(x[9] || "").trim() !== "đã nhập") continue;
    const chuKy = String(x[6] || "").trim();
    ds.push({ dong: i + 1, kho: String(x[0] || "").trim(), bin, lichGoc: String(x[2] || "").trim(),
      ten, moTa: String(x[4] || "").trim(), hangMuc: String(x[5] || "").trim(),
      chuKy, nhipGhi: String(x[7] || "").trim(), nhipDich: nhipTuChuKy(chuKy) });
  }
  /* Bản gốc của user (tab BAO-DUONG-170): 1 dòng = 1 đầu việc Ở ĐÚNG 1 TẦN SUẤT — thước đo tần suất
     (bảng máy gộp mọi tần suất của 1 tiêu chuẩn làm một nên che mất việc quý nằm trong lịch hằng ngày). */
  const bg = [];
  const shG = wb.Sheets["BAO-DUONG-170"];
  if (shG) {
    const rg = XLSX.utils.sheet_to_json(shG, { header: 1, defval: "" });
    const s = v => String(v ?? "").replace(/\s+/g, " ").trim();
    const d0 = rg.findIndex(r => s(r[2]).toUpperCase() === "TẦN SUẤT");
    for (let i = d0 + 1; d0 >= 0 && i < rg.length; i++) {
      const r = rg[i]; if (!s(r[1]) || !NHIP[s(r[2])]) continue;
      const tc = s(r[6]) ? [s(r[6])] : String(r[3]).split(/\r?\n/).map(s).filter(Boolean);
      const ma = String(r[12]).split(/\r?\n/).map(x => s(x).toUpperCase()).filter(x => /^F0-/.test(x));
      if (tc.length && ma.length) bg.push({ dong: i + 1, hm: s(r[1]), ts: s(r[2]), tc, ma });
    }
  }
  const goc = { modifiedTime: meta.modifiedTime, lay: new Date().toISOString(), ds, bg };
  fs.writeFileSync(F_GOC, JSON.stringify(goc));
  log(`mốc gốc: nạp lại từ g-sheet — ${ds.length} dòng tiêu chuẩn (${new Set(ds.map(d => d.bin)).size} ô)`);
  return goc;
}

/* ═══════════ 2. CHỤP LIVE planogram — 2 lượt gọi ═══════════ */
async function chupLive() {
  const token = await layTokenSongWms(DIR, () => {});
  const H = { authorization: token, accept: "application/json" };
  const out = []; let goi = 0;
  for (let p = 1; p <= 10; p++) {
    const r = await fetch(`${EXT}/planogram/schedule/location-schedules?page=${p}&size=200&warehouse_ids=863,874`, { headers: H, signal: AbortSignal.timeout(45000) });
    goi++;
    const t = await r.text();
    if (!r.ok) throw new Error(`location-schedules HTTP ${r.status} — ${t.slice(0, 160)}`);
    const j = JSON.parse(t);
    out.push(...(j.records || []));
    if (out.length >= (j.count || 0)) break;
  }
  const m = {};
  for (const s of out) m[s.schedule_id] = {
    id: s.schedule_id, bin: String(s.location_description || "").toUpperCase(),
    kho: s.warehouse_name, nhip: String(s.schedule_detail ?? ""), tt: s.loc_sched_status_id_name,
    tu: s.registration_period_from, den: s.registration_period_to, phut: s.duration, sl: s.quantity,
    anh: (s.standard_image || []).map(a => ({ ten: a.image_name, mo: String(a.image_description || "") })),
  };
  return { luc: new Date().toISOString(), goi, lich: m };
}

/* lớp sâu (tuỳ chọn): SKU của từng lịch trên các ô có trong mốc gốc */
async function chupSau(live, binGoc) {
  const token = await layTokenSongWms(DIR, () => {});
  const H = { authorization: token, accept: "application/json" };
  let goi = 0;
  for (const s of Object.values(live.lich)) {
    if (!binGoc.has(s.bin)) continue;
    const r = await fetch(`${EXT}/planogram/schedule/location-schedules/detail/${s.id}?page=1&size=200`, { headers: H, signal: AbortSignal.timeout(45000) });
    goi++;
    if (!r.ok) continue;
    const j = JSON.parse(await r.text());
    s.sku = [...new Set((j.details?.records || []).map(x => String(x.sku)))].sort();
  }
  live.goi += goi;
  log(`lớp sâu: đọc SKU ${goi} lịch`);
}

/* ═══════════ 3. SO SÁNH ═══════════ */
const kyAnh = a => a.map(x => x.ten + "¦" + x.mo).sort().join("‖");
const tenAnh = a => a.map(x => x.ten).filter(t => t !== "Trực diện" && t !== "Trực diện toàn cảnh");

function soVoiTruoc(live, truoc) {
  const ra = [];
  if (!truoc) return ra;
  const A = truoc.lich || {}, B = live.lich || {};
  for (const id of Object.keys(B)) {
    const b = B[id], a = A[id];
    if (!a) { ra.push({ loai: "LỊCH MỚI", bin: b.bin, id, cu: "", moi: `${b.tt} · nhịp ${b.nhip} · ${b.anh.length} ảnh`, muc: "tin" }); continue; }
    if (a.tt !== b.tt) ra.push({ loai: "ĐỔI TRẠNG THÁI", bin: b.bin, id, cu: a.tt, moi: b.tt, muc: b.tt === "Reject" ? "nang" : "canh" });
    if (a.nhip !== b.nhip) ra.push({ loai: "ĐỔI CHU KỲ", bin: b.bin, id, cu: a.nhip, moi: b.nhip, muc: "nang" });
    if (kyAnh(a.anh) !== kyAnh(b.anh)) {
      const ta = new Set(a.anh.map(x => x.ten)), tb = new Set(b.anh.map(x => x.ten));
      const mat = [...ta].filter(t => !tb.has(t)), them = [...tb].filter(t => !ta.has(t));
      const suaMoTa = b.anh.filter(x => ta.has(x.ten) && (a.anh.find(y => y.ten === x.ten)?.mo ?? "") !== x.mo).map(x => x.ten);
      if (mat.length) ra.push({ loai: "MẤT ẢNH TIÊU CHUẨN", bin: b.bin, id, cu: mat.join(" · "), moi: "", muc: "nang" });
      if (them.length) ra.push({ loai: "THÊM ẢNH TIÊU CHUẨN", bin: b.bin, id, cu: "", moi: them.join(" · "), muc: "canh" });
      if (suaMoTa.length) ra.push({ loai: "SỬA NỘI DUNG KIỂM TRA", bin: b.bin, id, cu: "", moi: suaMoTa.join(" · "), muc: "nang" });
    }
    if (a.tu !== b.tu || a.den !== b.den || a.phut !== b.phut)
      ra.push({ loai: "ĐỔI GIỜ BÁO CÁO", bin: b.bin, id, cu: `${a.tu}–${a.den} (${a.phut}′)`, moi: `${b.tu}–${b.den} (${b.phut}′)`, muc: "canh" });
    if (a.sku && b.sku && a.sku.join(",") !== b.sku.join(","))
      ra.push({ loai: "ĐỔI DANH SÁCH THIẾT BỊ", bin: b.bin, id, cu: `${a.sku.length} SKU`, moi: `${b.sku.length} SKU`, muc: "canh" });
  }
  for (const id of Object.keys(A)) if (!B[id])
    ra.push({ loai: "LỊCH BIẾN MẤT", bin: A[id].bin, id, cu: `${A[id].tt} · nhịp ${A[id].nhip} · ${A[id].anh.length} ảnh`, moi: "", muc: "nang" });
  return ra;
}

/** Gom các điểm lệch trùng nhau thành một dòng — một ô lệch chu kỳ thì báo 1 lần,
 *  không báo lặp theo từng tấm ảnh (luật 14 mục 6: không dựng dòng đơn trị lặp). */
function gomLech(ds) {
  const m = new Map();
  for (const x of ds) {
    const khoa = `${x.loai}|${x.bin}|${x.loai === "THIẾU SO VỚI KẾ HOẠCH" ? "" : x.id}|${x.loai === "LỆCH CHU KỲ SO VỚI KẾ HOẠCH" ? x.cu : ""}`;
    if (!m.has(khoa)) m.set(khoa, { ...x, _ten: [] });
    const g = m.get(khoa);
    if (x.loai === "THIẾU SO VỚI KẾ HOẠCH" || x.loai === "NỘI DUNG KIỂM TRA KHÁC G-SHEET") g._ten.push(x.cu);
  }
  return [...m.values()].map(g => {
    if (!g._ten.length) { delete g._ten; return g; }
    const n = [...new Set(g._ten)];
    const o = { ...g, cu: n.join(" · ") + (n.length > 1 ? ` (${n.length} tiêu chuẩn)` : "") };
    if (g.loai === "THIẾU SO VỚI KẾ HOẠCH") o.id = "";     // lịch cũ đã chết, liên kết vô nghĩa
    delete o._ten; return o;
  });
}

/* Nhịp WMS → chữ thường cho người đọc */
function nhipDe(n) {
  n = String(n ?? "");
  if (n === "Daily") return "Hàng ngày";
  const thu = { Mon: "Thứ 2", Tue: "Thứ 3", Wed: "Thứ 4", Thu: "Thứ 5", Fri: "Thứ 6", Sat: "Thứ 7", Sun: "Chủ nhật" };
  if (thu[n]) return `${thu[n]} hằng tuần`;
  const ng = n.split(",").map(Number).filter(Number.isFinite);
  if (ng.length > 15) { const thieu = []; for (let i = 1; i <= 31; i++) if (!ng.includes(i)) thieu.push(i); return `Hàng ngày trừ ngày ${thieu.join(", ")}`; }
  if (ng.length) return `Ngày ${ng.join(", ")} hằng tháng`;
  return n;
}

/* PCCC (user chốt 26/09/2026): ảnh nhân theo số lượng từng SKU, tên "<tên thiết bị> · i/n", mỗi tần suất
   một lịch đúng bản gốc (_pccc-dung-theo-tan-suat.mjs) ⇒ ảnh đánh số tính là mang tiêu chuẩn nhóm.
   KHÔNG nới lệch tần suất: user chỉ nhận "đúng tiêu chí / tần suất / tiêu chuẩn của hạng mục". */
const ALIAS = {
  "Bình chữa cháy": ["Bình "], "Đèn exit & đèn khẩn cấp": ["Đèn exit"],
  "Đầu dò khói & đầu dò nhiệt": ["Đầu dò", "Đầu báo nhiệt"], "Chuông & loa báo cháy": ["Chuông"],
};
const khopTen = (tenAnh, ten) => tenAnh === ten ||
  (ALIAS[ten] || []).some(p => tenAnh.startsWith(p) && /· \d+\/\d+$/.test(tenAnh));

function soVoiKeHoach(live, goc) {
  const ra = [];
  const theoBin = {};
  for (const s of Object.values(live.lich)) (theoBin[s.bin] ??= []).push(s);
  for (const d of goc.ds) {
    const ds = theoBin[d.bin] || [];
    const mang = ds.filter(s => s.anh.some(a => khopTen(a.ten, d.ten)));
    if (!mang.length) { ra.push({ loai: "THIẾU SO VỚI KẾ HOẠCH", bin: d.bin, id: d.lichGoc, cu: d.ten, moi: "không lịch nào ở ô còn tiêu chuẩn này", muc: "nang" }); continue; }
    /* nội dung kiểm tra (mô tả tiêu chuẩn) bị sửa so với g-sheet */
    /* Lệch = WMS THIẾU hạng mục kế hoạch. WMS nhiều hơn (gom việc ngày + quý vào một tiêu chuẩn
       theo luật 19/09) là đúng thiết kế, không báo. Tiêu chuẩn có nhiều tần suất (bình PCCC: tuần
       ngoại quan + tháng trọng lượng) tách ra nhiều lịch ⇒ xét HỢP nội dung mọi lịch mang nó. */
    const hm = t => { const m = /Hạng mục kiểm tra:\s*([^]*?)(?:\s2\.\s|$)/.exec(t.replace(/\s+/g, " "));
      return (m ? m[1] : t).split(";").map(s => s.trim()).filter(Boolean); };
    if (d.moTa) { const tr = mang.map(s => s.anh.find(a => khopTen(a.ten, d.ten))?.mo || "").filter(Boolean);
      const hop = tr.join(" ").replace(/\s+/g, " ");
      if (tr.length && !hm(d.moTa).every(i => hop.includes(i)))
        ra.push({ loai: "NỘI DUNG KIỂM TRA KHÁC G-SHEET", bin: d.bin, id: mang[0].id, cu: d.ten, moi: tr[0].slice(0, 90), muc: "canh" }); }
  }
  /* Chỉ báo lịch TỪNG mang tiêu chuẩn (có mặt ở cột Schedule Id của g-sheet) mà nay trống —
     lịch của bàn/ghế/máy giặt… vốn ngoài kế hoạch bảo dưỡng thì không phải lỗi, đừng báo. */
  const tungCo = new Set(goc.ds.map(d => String(d.lichGoc)).filter(Boolean));
  for (const s of Object.values(live.lich)) {
    if (!tungCo.has(String(s.id))) continue;
    if (!tenAnh(s.anh).length) ra.push({ loai: "LỊCH MẤT HẾT TIÊU CHUẨN", bin: s.bin, id: s.id, cu: "từng có tiêu chuẩn (theo g-sheet)", moi: `chỉ còn ${s.anh.map(a => a.ten).join(",") || "rỗng"}`, muc: "nang" });
  }
  /* TẦN SUẤT theo bản gốc: mỗi đầu việc phải có lịch ĐÚNG NHỊP mang tiêu chuẩn của nó ở từng ô.
     Tuần = thứ nào cũng được; tháng/quý = 1 ngày cố định (WMS không có chu kỳ quý). Gom theo
     (ô · hạng mục · tần suất) cho gọn. Cùng thước với .exports/_doi-soat-bao-duong-planogram.mjs. */
  const dungNhip = (n, ts) => { n = String(n); const d = NHIP[ts];
    return n === d || (d === "Mon" && /^[A-Z][a-z]{2}$/.test(n)) || (d === "28" && /^\d{1,2}$/.test(n)); };
  const nhom = new Map();
  for (const r of goc.bg || []) for (const ma of r.ma) {
    if (MIEN_NHIP.has(ma)) continue;
    const mang = (theoBin[ma] || []).filter(s => s.anh.some(a => r.tc.some(t => khopTen(a.ten.replace(/\s+/g, " ").trim(), t))));
    if (!mang.length || mang.some(s => dungNhip(s.nhip, r.ts))) continue;
    const k = `${ma}|${r.hm}|${r.ts}`;
    if (!nhom.has(k)) nhom.set(k, { bin: ma, hm: r.hm, ts: r.ts, id: mang[0].id, n: 0, dang: new Set() });
    const g = nhom.get(k); g.n++; mang.forEach(s => g.dang.add(nhipDe(s.nhip)));
  }
  for (const g of nhom.values()) ra.push({ loai: "LỆCH CHU KỲ SO VỚI KẾ HOẠCH", bin: g.bin, id: g.id,
    cu: `${g.hm}: ${g.n} việc ${g.ts}`, moi: `Đang nằm trong lịch ${[...g.dang].join(" / ")}`, muc: "canh" });
  return ra;
}

/* ═══════════ 4. GHI G-SHEET + TELEGRAM ═══════════ */
const lienKet = id => (id && /^\d+$/.test(String(id))) ? `=HYPERLINK("${UI(id)}";"${id}")` : String(id || "");

/* Loại lệch nội bộ (khoá của gomLech, GIỮ NGUYÊN trong logic) → câu thường cho người đọc. */
const DICH = {
  "THIẾU SO VỚI KẾ HOẠCH": "Kế hoạch có nhưng WMS không còn lịch giữ tiêu chuẩn",
  "LỆCH CHU KỲ SO VỚI KẾ HOẠCH": "Tần suất chạy khác kế hoạch",
  "NỘI DUNG KIỂM TRA KHÁC G-SHEET": "Nội dung kiểm tra trên WMS khác kế hoạch",
  "LỊCH MẤT HẾT TIÊU CHUẨN": "Lịch không còn tiêu chuẩn nào để kiểm",
  "LỊCH MỚI": "Có lịch mới xuất hiện",
  "LỊCH BIẾN MẤT": "Lịch biến mất khỏi WMS",
  "ĐỔI TRẠNG THÁI": "Lịch đổi trạng thái",
  "ĐỔI CHU KỲ": "Lịch đổi tần suất chạy",
  "MẤT ẢNH TIÊU CHUẨN": "Lịch bị bớt ảnh tiêu chuẩn",
  "THÊM ẢNH TIÊU CHUẨN": "Lịch được thêm ảnh tiêu chuẩn",
  "SỬA NỘI DUNG KIỂM TRA": "Lịch bị sửa nội dung kiểm tra",
  "ĐỔI GIỜ BÁO CÁO": "Lịch đổi khung giờ báo cáo",
  "ĐỔI DANH SÁCH THIẾT BỊ": "Lịch đổi danh sách thiết bị",
};
const dich = l => DICH[l] || l;
const CAN_LAM = {
  "THIẾU SO VỚI KẾ HOẠCH": "Mở lịch ở ô này, thêm lại ảnh tiêu chuẩn đang thiếu",
  "LỆCH CHU KỲ SO VỚI KẾ HOẠCH": "Tách các việc này ra một lịch riêng đúng tần suất ở ô này (không để chung lịch khác nhịp)",
  "NỘI DUNG KIỂM TRA KHÁC G-SHEET": "Bấm mã lịch → bổ sung hạng mục kiểm tra còn thiếu",
  "LỊCH MẤT HẾT TIÊU CHUẨN": "Bấm mã lịch → gắn lại bộ ảnh tiêu chuẩn",
};
const NGAY_NK = 3;   // nhật ký trên sheet chỉ hiện 3 ngày gần nhất (bản đủ 500 dòng ở .co-canh-nhat-ky.json)
const tuoiNgay = luc => {   // "hh:mm:ss d/m/yyyy" (vi-VN) → số ngày đã qua
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(luc));
  return m ? (Date.now() - new Date(+m[3], +m[2] - 1, +m[1]).getTime()) / 864e5 : 0;
};
const catGon = s => { s = String(s ?? ""); return s.length > 120 ? s.slice(0, 119) + "…" : s; };

/** Ghi câu TÌNH TRẠNG + 2 bảng vào trang người đọc bằng `vungLenh` — mỗi bảng ghi ĐỦ TRẦN
 *  dòng (phần thiếu đệm "") nên lượt sau tự xoá dòng cũ thừa; tiêu đề/định dạng là tĩnh. */
async function ghiKhoi(tomTat, rowsHT, rowsNK) {
  const pad = (rows, cap) => {
    const m = rows.slice(0, cap).map(r => Array.from({ length: 7 }, (_, j) => r[j] == null ? "" : String(r[j])));
    while (m.length < cap) m.push(Array(7).fill(""));
    return m;
  };
  const lenh = [
    { loai: "noiRong", dong: CAP_NK + 9, cot: 15 },
    { loai: "ghi", vung: "B4", values: [[tomTat]] },
    { loai: "ghi", vung: "G9", values: [["Cần làm gì"]] },
    { loai: "ghi", vung: `A10:G${CAP_HT + 9}`, values: pad(rowsHT, CAP_HT) },
    { loai: "ghi", vung: `I10:O${CAP_NK + 9}`, values: pad(rowsNK, CAP_NK) },
  ];
  const j = await gasPost({ action: "vungLenh", key: process.env.APPSCRIPT_KEY, sheetId: SHEET, tab: TAB, lenh, apiAt: Date.now() }, () => {}, "vungLenh cò canh");
  if (!j || j.status === "error" || j.error) throw new Error(`vungLenh: GAS trả ${JSON.stringify(j).slice(0, 200)}`);
}

async function nhanTelegram(text) {
  const tok = process.env.TELEGRAM_BOT_TOKEN, chat = String(process.env.TELEGRAM_CHAT_ID || "").split(",")[0];
  if (!tok || !chat) return "chua-bat";
  const r = await fetch(`https://api.telegram.org/bot${tok}/sendMessage`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(20000),
  });
  return r.ok ? "ok" : "HTTP " + r.status;
}

/* ═══════════ MAIN ═══════════ */
let buocHong = "";
try {
  buocHong = "nạp mốc gốc";
  const goc = await napGoc();
  const binGoc = new Set(goc.ds.map(d => d.bin));

  buocHong = "chụp planogram";
  const live = await chupLive();
  if (SAU) { buocHong = "chụp lớp sâu"; await chupSau(live, binGoc); }
  log(`chụp live: ${Object.keys(live.lich).length} lịch · ${live.goi} lượt gọi upstream`);

  let truoc = null; try { truoc = JSON.parse(fs.readFileSync(F_MOC, "utf8")); } catch { /* lần đầu */ }

  if (DAT_MOC) { fs.writeFileSync(F_MOC, JSON.stringify(live)); log("đã đặt lại mốc — coi hiện trạng là bình thường."); process.exit(0); }

  buocHong = "so sánh";
  const doi = soVoiTruoc(live, truoc);
  const lech = gomLech(soVoiKeHoach(live, goc));
  log(`so với lần trước: ${doi.length} thay đổi · so với kế hoạch: ${lech.length} điểm lệch`);

  /* nhật ký: chỉ nối thêm các THAY ĐỔI theo thời gian (điểm lệch kế hoạch nằm ở tab hiện trạng) */
  let nk = []; try { nk = JSON.parse(fs.readFileSync(F_LOG, "utf8")); } catch { /* lần đầu */ }
  if (doi.length) { nk = [...doi.map(x => ({ ...x, luc: nay() })), ...nk].slice(0, GIU_LOG); if (!THU) fs.writeFileSync(F_LOG, JSON.stringify(nk)); }

  /* hash-skip: hiện trạng không đổi thì không ghi Sheet (mục 2 BỘ-CHUẨN) */
  const soNang = lech.filter(x => x.muc === "nang").length;
  const tomTat = lech.length
    ? `⚠ Có ${lech.length} lịch cần sửa trên planogram (${soNang} NẶNG · ${lech.length - soNang} cảnh báo) — xem bảng ① bên dưới · máy canh lúc ${nay()}`
    : `✓ Tất cả khớp kế hoạch (${goc.ds.length} tiêu chuẩn trên ${binGoc.size} ô) — máy canh lúc ${nay()}`;
  const H_HT = ["Mức", "Chuyện gì", "Ở ô vị trí", "Lịch (bấm mở)", "Theo kế hoạch", "Thực tế trên WMS", "Cần làm gì"];
  const rowsHT = [
    ...lech.map(x => [x.muc === "nang" ? "⚠ NẶNG" : "CẢNH BÁO", dich(x.loai), x.bin, lienKet(x.id), catGon(x.cu), catGon(x.moi), CAN_LAM[x.loai] || ""]),
    ...(lech.length ? [] : [["✓", "Tất cả khớp kế hoạch", "", "", "", `${goc.ds.length} tiêu chuẩn trên ${binGoc.size} ô đều đúng`, "Không cần làm gì"]]),
  ];
  const H_NK = ["Lúc", "Mức", "Thay đổi gì", "Ở ô vị trí", "Lịch (bấm mở)", "Trước", "Sau"];
  const nkGan = nk.filter(x => tuoiNgay(x.luc) <= NGAY_NK);
  const rowsNK = nkGan.length
    ? nkGan.map(x => [x.luc, x.muc === "nang" ? "⚠ NẶNG" : x.muc === "tin" ? "tin" : "CẢNH BÁO", dich(x.loai), x.bin, lienKet(x.id), catGon(x.cu), catGon(x.moi)])
    : [["", "✓", `Không có thay đổi nào trong ${NGAY_NK} ngày qua`, "", "", "", ""]];

  const bam = crypto.createHash("sha1").update(JSON.stringify([rowsHT.map(r => r.slice(0, 6)), rowsNK.length])).digest("hex");
  const F_BAM = path.join(DIR, ".co-canh-bam");
  let bamCu = ""; try { bamCu = fs.readFileSync(F_BAM, "utf8"); } catch { /* lần đầu */ }

  if (THU) {
    log("--thu: KHÔNG ghi Sheet, KHÔNG nhắn.");
    console.log("\n" + H_HT.join(" | ")); rowsHT.slice(0, 12).forEach(r => console.log(r.join(" | ")));
    console.log("\n" + H_NK.join(" | ")); rowsNK.slice(0, 12).forEach(r => console.log(r.join(" | ")));
  } else if (bam === bamCu && !doi.length) {
    log("không có gì đổi — bỏ ghi Sheet (hash-skip), không nhắn.");
  } else {
    buocHong = "ghi g-sheet";
    await ghiKhoi(tomTat, rowsHT, rowsNK);
    fs.writeFileSync(F_BAM, bam);
    log(`đã ghi tab ${TAB}: điểm lệch ${rowsHT.length} dòng · nhật ký ${rowsNK.length} dòng`);

    const nang = [...doi, ...lech].filter(x => x.muc === "nang");
    if (nang.length) {
      buocHong = "nhắn Telegram";
      const tin = `⚠ Planogram kho 170 — ${nang.length} thay đổi cần xem (${nay()})\n` +
        nang.slice(0, 8).map(x => `• ${dich(x.loai)} — ${x.bin} lịch ${x.id}\n  ${catGon(x.cu) || "—"} → ${catGon(x.moi) || "—"}`).join("\n") +
        (nang.length > 8 ? `\n… và ${nang.length - 8} mục nữa` : "") +
        `\nXem: https://docs.google.com/spreadsheets/d/${SHEET}/edit`;
      log("Telegram: " + await nhanTelegram(tin));
    }
  }

  if (!THU) fs.writeFileSync(F_MOC, JSON.stringify(live));
  buocHong = "";
  /* nhịp tim MANG số bước hỏng (mục 5 BỘ-CHUẨN) */
  fs.writeFileSync(path.join(DIR, ".co-canh-nhiptim.json"), JSON.stringify({
    luc: new Date().toISOString(), lich: Object.keys(live.lich).length, goiUpstream: live.goi,
    thayDoi: doi.length, lechKeHoach: lech.length, buocHong: "",
  }));
  log(`xong — ${live.goi} lượt gọi upstream.`);
} catch (e) {
  fs.writeFileSync(path.join(DIR, ".co-canh-nhiptim.json"), JSON.stringify({
    luc: new Date().toISOString(), buocHong, loi: String(e.message || e).slice(0, 300),
  }));
  log(`✗ hỏng ở bước "${buocHong}": ${e.message}`);
  try { await nhanTelegram(`✗ Cò canh planogram hỏng ở bước "${buocHong}": ${String(e.message).slice(0, 200)}`); } catch { /* kênh lỗi thì thôi */ }
  process.exitCode = 1;
}
