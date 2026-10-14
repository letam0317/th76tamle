/**
 * ============================================================================
 *  canh-b1.mjs — CÒ CANH B1 "Xác minh lỗi vi phạm" (WF591) cho lỗi NGOÀI vệ sinh hằng ngày
 * ============================================================================
 *  User chốt 01/10/2026: "càng ngày càng hoàn thiện bộ quy tắc xác minh … tiến tới cò canh tự động ở B1
 *  hoàn toàn (tự nhảy B1.1 hoặc dừng điều hướng …); ca nào nghi ngờ thì ghi chú ở g-sheet để t quyết định".
 *
 *  LUẬT ở quy-tac-xac-minh-b1.json (nguồn duy nhất, hiện ở g-sheet tab QUY TẮC XÁC MINH). Script này chỉ
 *  THỰC THI: vệ sinh hằng ngày để canh-b11 ⑤ lo; ở đây là TB-01 · TB-02 (trưng bày/cất hàng — đọc lịch sử
 *  cất vào ô trên WMS), SH-01 (soạn hàng — chỉ ghi sheet), DL-01 (phiếu thiếu dữ liệu), QD-01 (làm theo
 *  cột Quyết định của bạn trên sheet).
 *
 *  Chỉ TỰ LÀM khi luật được bạn duyệt "Cho máy tự làm" (.exports/quy-tac-duyet.json do sheet-b1-treo.py
 *  ghi từ tab QUY TẮC XÁC MINH) VÀ kết luận chắc (đúng 1 người). Mọi ca khác → NGHI NGỜ, ghi sheet.
 *
 *  Tải upstream: danh sách phiếu từ .exports/tasks-cache.json (0 lượt); WMS transfer-bins 1 lượt/phiếu
 *  TB lần đầu, cache vĩnh viễn (dữ liệu quá khứ không đổi) — trần --max=15 lượt/lần chạy.
 *  Ghi: chỉ khi --lam, trong cửa 07:00–18:00 T2–T7 (--force xuyên cửa). Đóng B1 qua
 *  auto-complete-single-task.mjs (khuôn đã kiểm chứng); dừng phiếu theo khuôn canh-b11 (re-create-step −1).
 *
 *  Chạy:  node canh-b1.mjs            # diễn tập: in việc sẽ làm + ghi .exports/canh-b1-ketqua.json
 *         node canh-b1.mjs --lam      # làm thật (luật đã duyệt + quyết định của bạn)
 *         node canh-b1.mjs --qc       # đối chiếu mọi ÁN LỆ trong bộ luật — phải đúng hết
 *  Xong thì chạy `python sheet-b1-treo.py --lam` để đưa kết quả lên sheet.
 * ============================================================================
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chuanTu, chuanTuSau } from "./tu-ngu.mjs";   // TU-01: "châm hàng" không dùng "cất"
import { execFileSync } from "node:child_process";
import { layTokenSongWork, mayDuocChay } from "./session-rules.js";
import { laHangMucVeSinhHangNgay, napNguonTruyVet, traPhanCong } from "./truy-vet-vesinh.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const EXP = path.join(DIR, ".exports");
const V = "https://wshr.hasaki.vn/api";
const WMS = "https://wms-gw.inshasaki.com/api/v1";
const A = process.argv.slice(2);
const LAM = A.includes("--lam"), QC = A.includes("--qc"), FORCE = A.includes("--force");
const MAX_WMS = Number((A.find((x) => x.startsWith("--max=")) || "--max=15").slice(6));
const NGUONG_THUNG = 10;          // TB-01: lệnh cất ≥10 cái = cất số lượng lớn (thùng/pallet)
const CUA_SO_GIO = 72;            // TB: soi lịch sử cất trong 72h trước giờ chụp
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);
const docJ = (f, mac) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return mac; } };
const ghiJ = (f, x) => fs.writeFileSync(f, JSON.stringify(f.endsWith("canh-b1-ketqua.json") ? chuanTuSau(x) : x, null, 1));
const boDau = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/\s+/g, " ").trim();

if (LAM && !FORCE) {
  const d = new Date(), thu = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Ho_Chi_Minh", weekday: "short" }).format(d);
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", hour12: false }).format(d));
  if (thu === "Sun" || h < 7 || h >= 18) { log("ngoài cửa 07:00–18:00 T2–T7 — bỏ lượt (--force để xuyên)."); process.exit(0); }
}
/* 01/10: chia VAI máy (laptop 09:00–17:55 T2–T7 · PC phần bù) — RUNNER_VAI trống = chạy như cũ; --force hàm tự xét.
   Diễn tập/--qc không bị chặn (chỉ in lý do) để còn kiểm luật ngoài giờ. Mẫu từ phiên new-folder-6e, hàm ở session-rules.js. */
if (!mayDuocChay(log) && LAM && !QC) process.exit(0);

/* ---- chống chạy chồng (FAIL-CLOSED, khuôn canh-b11): lỗi khi dò khoá → coi như đang chạy ---- */
const F_KHOA = path.join(DIR, ".canh-b1.lock");
try {
  const st = fs.statSync(F_KHOA);
  if (Date.now() - st.mtimeMs < 25 * 60 * 1000) { log("lượt trước còn chạy (khoá " + Math.round((Date.now() - st.mtimeMs) / 60000) + " phút) — bỏ lượt."); process.exit(0); }
} catch (e) { if (e.code !== "ENOENT") { log("không dò được khoá → coi như đang chạy, bỏ."); process.exit(0); } }
fs.writeFileSync(F_KHOA, new Date().toISOString());
process.on("exit", () => { try { fs.unlinkSync(F_KHOA); } catch { /* best-effort */ } });

/* ---- bộ luật + duyệt của bạn ---- */
const BO = JSON.parse(fs.readFileSync(path.join(DIR, "quy-tac-xac-minh-b1.json"), "utf8"));
const LUAT = Object.fromEntries(BO.luat.map((l) => [l.ma, l]));
const DUYET = docJ(path.join(EXP, "quy-tac-duyet.json"), {});      // {ma: "Cho máy tự làm" | …}
const choTuLam = (ma) => (DUYET[ma] || BO.mucTuDong[LUAT[ma]?.macDinh] || "") === BO.mucTuDong["tu-lam"];

/* ---- phiếu B1 đang mở từ tasks-cache (0 lượt gọi) ---- */
const C = JSON.parse(fs.readFileSync(path.join(EXP, "tasks-cache.json"), "utf8"));
const H = C.header, iH = (k) => H.indexOf(k);
const I = { link: 1, st: 3, ngay: iH("Ngày vi phạm:"), loi: iH("Lỗi vi phạm"), bin: iH("Vị trí ghi nhận"),
  b1: iH("B1. Xác minh lỗi vi phạm ▸ Status"), b1giao: iH("B1. Xác minh lỗi vi phạm ▸ Ngày giao") };
const phieu = [];
for (const v of Object.values(C.rows)) {
  const m = /task_id=(\d+)/.exec(v[I.link] || ""); if (!m) continue;
  if (v[I.st] !== "None" || v[I.b1] !== "None") continue;            // chỉ phiếu đang treo ở B1
  phieu.push({ id: m[1], ngay: String(v[I.ngay] || ""), loi: String(v[I.loi] || ""), bin: String(v[I.bin] || "").trim(), giao: v[I.b1giao] });
}

/* ---- danh bạ (cache sẵn của canh-b11, 0 lượt) ---- */
const DB = (docJ(path.join(DIR, ".cache-danhba.json"), { data: [] }).data || []);
const nvTheoEmail = (em) => DB.find((x) => String(x.staff_email || "").toLowerCase() === String(em).toLowerCase());

/* luật đã được user duyệt áp dụng (không còn cờ deXuat) — tự làm hay chỉ ghi sheet vẫn theo cột Bạn duyệt (choTuLam) */
const daDuyet = (ma) => !!LUAT[ma] && !LUAT[ma].deXuat;
/* 10/10 DL-01 vị trí là KHU VỰC (lối đi, băng chuyền, bãi xe…) → kênh camera khớp nhiều chữ nhất với tên kênh SmartPSS (ban-do-camera-o.json tenKenh) */
const TEN_KENH = Object.entries(docJ(path.join(DIR, "ban-do-camera-o.json"), {}).tenKenh || {}).filter(([k]) => /^\d/.test(k));
function kenhKhu(chu) {
  const tu = boDau(chu).replace(/[^a-z0-9 ]/g, " ").split(" ").filter((w) => w.length >= 2 && !["khu", "vuc", "kv", "cua", "va"].includes(w)); if (!tu.length) return "";
  const diem = TEN_KENH.map(([k, v]) => [k, tu.filter((w) => (" " + boDau(v).replace(/[^a-z0-9]/g, " ") + " ").includes(" " + w + " ")).length]);
  const mx = Math.max(0, ...diem.map((d) => d[1])); if (mx < Math.min(2, tu.length)) return "";
  return "kênh " + diem.filter((d) => d[1] === mx).slice(0, 4).map((d) => d[0]).join(", ");
}
let NGUON_PC = null;   // bảng phân công + chấm công (GAS, 0 lượt work/wms/hr) — nạp 1 lần khi có phiếu A1-01
/* 10/10 đo: GAS readTab chập chờn (3/3 lần rỗng) → kết luận A1-01 đổi theo lượt. Giữ bản đọc TỐT gần nhất ở đĩa, dùng lại nếu ≤48h. */
const F_PC = path.join(EXP, ".nguon-phancong-cache.json");
const napPC = async () => {
  if (NGUON_PC) return NGUON_PC;
  const n = await napNguonTruyVet(() => {}).catch(() => null);
  if (n && n.pc.size && n.cc.size) {
    try { fs.writeFileSync(F_PC, JSON.stringify({ luc: Date.now(), pc: [...n.pc], cc: [...n.cc].map(([k, m]) => [k, [...m]]) })); } catch { /* */ }
    return (NGUON_PC = { ...n, nguon: "GAS" });
  }
  const c = docJ(F_PC, null);
  if (c && Date.now() - c.luc < 48 * 36e5) return (NGUON_PC = { pc: new Map(c.pc), cc: new Map(c.cc.map(([k, m]) => [k, new Map(m)])), nguon: "cache " + new Date(c.luc + 7 * 36e5).toISOString().slice(5, 16).replace("T", " ") });
  return (NGUON_PC = { pc: new Map(), cc: new Map(), loi: true });
};

/* ---- phân loại theo từ khoá của bộ luật ---- */
function phanLoai(loi) {
  if (laHangMucVeSinhHangNgay(loi)) return "VS";
  const b = boDau(loi);
  for (const ma of ["TB-01", "TB-02", "SH-01"]) if ((LUAT[ma].tuKhoa || []).some((k) => b.includes(k))) return ma;
  /* 10/10 user duyệt TB-03, CAM-04 (chỉ ghi sheet) → máy áp; A1-01 là nhánh lùi trong TB-01/TB-02 */
  for (const ma of ["TB-03", "CAM-04"]) if (daDuyet(ma) && (LUAT[ma].tuKhoa || []).some((k) => b.includes(k))) return ma;
  return "KHAC";
}
/* Luật ĐỀ XUẤT (deXuat: true) chưa được duyệt → KHÔNG thực thi, chỉ nêu tên ở lý do để bạn thấy luật nào sẽ áp. */
const deXuatCho = (loi) => { const b = boDau(loi); return BO.luat.filter((l) => l.deXuat && (l.tuKhoa || []).some((k) => b.includes(k))).map((l) => l.ma); };
const chuanMa = (s) => { const t = s.toUpperCase().replace(/\s+/g, ""); if (/^F0-[A-Z0-9]+(-[A-Z0-9]+){2,}$/.test(t)) return t;
  if (/^[A-Z0-9]+(-[A-Z0-9]+){2,}$/.test(t) && /\d/.test(t)) return "F0-" + (/^A\d/.test(t) ? "" : "A1-") + t; return null; };
const msVN = (s) => Date.parse(String(s).replace(" ", "T") + "+07:00");

/* ---- kênh camera đầu ghi .19 theo dãy kệ (bảng memory camera-a1-dau-ghi, 29/09) ---- */
function kenhCamera(bin) {
  /* 10/10: kệ A2 KHÔNG thuộc đầu ghi .19 (trước đó A2-507 bị gán «kênh 19» = camera dãy A1-506/507) → tra tên kênh SmartPSS: «A2 - 501», «KE 507 510 SAU» (dãy a–b) */
  const m2 = /^F0-A2-(\d{3})-/.exec(bin || "");
  if (m2) { const d = Number(m2[1]); const k = TEN_KENH.filter(([, v]) => { const t = boDau(v); const a = /^a2 - (\d{3})/.exec(t); if (a) return Number(a[1]) === d;
      const r = /^ke (\d{3})\D+(\d{3})?/.exec(t); return !!r && d >= Number(r[1]) && d <= Number(r[2] || r[1]); }).map(([k]) => k);
    return k.length ? "kênh " + k.slice(0, 4).join(", ") : ""; }
  const m = /F0-A1-(\w+)-(\d+)/.exec(bin || ""); if (!m) return "";
  const day = m[1], o = Number(m[2]);
  const L = { "5L1": [[49, 1, 9], [50, 7, 14], [51, 15, 21], [52, 20, 24]], "5L2": [[53, 1, 10], [54, 7, 19]], "5L3": [[55, 1, 7], [56, 5, 11], [57, 12, 19], [58, 18, 27]] };
  if (L[day]) { const k = L[day].filter(([, a, b]) => o >= a && o <= b).map((x) => x[0]); return k.length ? "kênh " + k.join("/") : ""; }
  const D = { 501: 1, 502: 5, 503: 5, 504: 9, 505: 13, 506: 17, 507: 17, 508: 21, 509: 25, 510: 29, 511: 29, 512: 33, 513: 37, 514: 41, 515: 41, 516: 45 };
  if (!D[day]) return "";
  return "kênh " + (D[day] + (o <= 3 ? 0 : o <= 5 ? 1 : o <= 8 ? 2 : 3));
}

/* ---- WMS: lịch sử cất vào ô (cache vĩnh viễn) ---- */
const F_CACHE = path.join(DIR, ".cache-canh-b1.json");
const CACHE = docJ(F_CACHE, {});
let wmsToken = null, nWms = 0;
async function lichSuCat(bin, pt) {
  const k = bin + "|" + pt;
  if (CACHE[k]) return CACHE[k];
  if (nWms >= MAX_WMS) return null;                                     // hết trần lượt gọi — lượt sau
  if (!wmsToken) wmsToken = (await layTokenSongWork(DIR, () => {})).replace(/^Bearer /, "");
  nWms++;
  const to = msVN(pt), q = { page: 1, size: 100, warehouse_id: /-A2-/.test(bin) ? 874 : 863, bin_in: bin,   /* 05/10: kệ A2 = kho WMS 874 (863 trả 0 lệnh) */ from_date: to - CUA_SO_GIO * 36e5, to_date: to };
  try {
    const r = await fetch(WMS + "/wms/transfer-bins?" + new URLSearchParams(q), { headers: { authorization: "Bearer " + wmsToken, "Company-Ids": "1001", "user-agent-type": "web" }, signal: AbortSignal.timeout(150000) });
    const j = await r.json();
    const rec = (j.records || []).filter((x) => x.bin_in === bin && Number(x.status) === 3)
      .map((x) => ({ at: x.created_at, xong: x.updated_at, loai: x.transfer_type, qty: Number(x.quantity) || 0, email: x.created_user_name }));
    CACHE[k] = { rec, luc: new Date().toISOString() }; ghiJ(F_CACHE, CACHE);
    return CACHE[k];
  } catch (e) { log("   ⚠ WMS " + bin + ": " + String(e.message).slice(0, 80)); return null; }
}
const nguoi = (em) => { const x = nvTheoEmail(em); return x ? { ten: x.staff_name, code: String(x.code), email: em } : { ten: em, code: "", email: em }; };

/* ---- xét 1 phiếu → kết quả ---- */
async function xet(p) {
  const loai = phanLoai(p.loi), bin = chuanMa(p.bin), cam = kenhCamera(bin);
  if (loai === "VS") return { luat: "VS", ketLuan: "canh-b11", lyDo: "Lỗi vệ sinh hằng ngày — canh-b11 luật ⑤ xử" };
  if ((loai === "CAM-04" || !bin) && daDuyet("CAM-04") && /^\d{4}-\d\d-\d\d \d\d:\d\d/.test(p.ngay)) {   // 10/10 user: DL-01 khu vực xử như CAM-04
    const kc = cam || kenhKhu(p.bin);
    return { luat: "CAM-04", ketLuan: "nghi-ngo", camera: kc, lyDo: "Lỗi hành vi tại «" + p.bin + "» — không có lệnh WMS; người chịu = người camera thấy làm ở đó lúc/trước giờ ghi nhận " + String(p.ngay).slice(5, 16) + (kc ? " (" + kc + ")" : " (chưa khớp được kênh camera theo tên khu)") + ". Máy cắt khung camera giờ ghi nhận ở tab Xác minh; bạn nhận người" };
  }
  if (!bin || !/^\d{4}-\d\d-\d\d \d\d:\d\d/.test(p.ngay))
    return { luat: "DL-01", ketLuan: "nghi-ngo", lyDo: !bin ? "Vị trí «" + p.bin + "» không phải mã ô — không tra được ai tác động" : "Phiếu thiếu giờ ghi nhận" };
  if (loai === "SH-01") return { luat: "SH-01", ketLuan: "nghi-ngo", camera: cam, lyDo: "Lỗi soạn hàng — chưa tự tra người lấy (tốn 47–54 lượt WMS/phiếu). Chọn «Cắt thêm clip camera» nếu cần" + (cam ? " · " + cam : "") };
  if (loai === "KHAC") {
    const dx = deXuatCho(p.loi);
    return { luat: "KHAC", ketLuan: "nghi-ngo", camera: cam, deXuat: dx,
      lyDo: dx.length ? "Có luật ĐỀ XUẤT " + dx.join(", ") + " cho hạng mục này — bạn duyệt ở tab QUY TẮC XÁC MINH thì lần sau máy áp; nay bạn quyết tay"
        : "Chưa có luật cho hạng mục này — bạn quyết, quyết định sẽ thành án lệ cho luật mới" };
  }
  const ls = await lichSuCat(bin, p.ngay);
  if (!ls) return { luat: loai, ketLuan: "cho-wms", lyDo: "Chưa đọc được lịch sử WMS (trần lượt gọi/lỗi mạng) — lượt sau" };
  if (loai === "TB-03") {   // 10/10 user duyệt (mục 28): người chịu = người tác động hàng vào ô GẦN NHẤT trước ảnh (WMS bin_in — chưa tính lệnh lấy RA khỏi ô)
    const r = ls.rec.filter((x) => x.loai !== "REPUSH_ORDER_CANCEL_PUSH").sort((a, b) => (a.at < b.at ? 1 : -1));
    if (!r.length) return { luat: "TB-03", ketLuan: "nghi-ngo", camera: cam, lyDo: "Mục 28: không có lệnh châm hàng vào ô trong " + CUA_SO_GIO + "h trước ảnh — người tác động gần nhất ở xa hơn; xem camera" + (cam ? " " + cam : "") };
    const g = { ...nguoi(r[0].email), qty: r[0].qty, lan: [r[0].at.slice(5, 16)] };
    return { luat: "TB-03", ketLuan: "B1.1", nv: [g], doChac: "VỪA", camera: cam, lyDo: "Mục 28 (thực tế lệch hệ thống): người tác động hàng vào ô gần nhất trước ảnh = " + g.ten + (g.code ? " (" + g.code + ")" : "") + " châm " + g.qty + " cái lúc " + g.lan[0] + " — WMS, chưa đối chiếu camera" };
  }
  const cat = ls.rec.filter((x) => x.loai !== "REPUSH_ORDER_CANCEL_PUSH" && (loai === "TB-02" || x.qty >= NGUONG_THUNG));
  const gom = {};
  for (const x of cat) { (gom[x.email] ||= { ...nguoi(x.email), qty: 0, lan: [] }); gom[x.email].qty += x.qty; gom[x.email].lan.push(x.at.slice(5, 16)); }
  let ds = Object.values(gom).sort((a, b) => (a.lan[0] < b.lan[0] ? -1 : 1));
  /* TB-01b (05/10, user «trỏ ngược về theo người châm lớn»): nhiều người châm ≥10 → chỉ giữ người có 1 lượt châm CỠ PALLET
     (≥ 1/3 lượt lớn nhất trong cửa sổ). 14007579: Bình 48 + Phi 1.318 → Phi (camera xác nhận). 13393072: Minh 900 + Phi 432 → giữ cả 2. */
  if (loai === "TB-01" && ds.length > 1) {
    const maxL = Math.max(...cat.map((x) => x.qty)), lon = new Set(cat.filter((x) => x.qty >= maxL / 3).map((x) => x.email));
    const loc = ds.filter((n) => lon.has(n.email)); if (loc.length) ds = loc;
  }
  const tom = ds.map((n) => n.ten + (n.code ? " (" + n.code + ")" : "") + " châm " + n.qty + " cái lúc " + n.lan.join(", ")).join("; ");
  /* 05/10 user: WMS chỉ cho ỨNG VIÊN — phải tra camera đúng giờ châm xem người đó có chuyển pallet tới vị trí không; đúng mới B1.1.
     Xác nhận camera ghi ở .exports/xac-nhan-camera.json {phieu: {nv:[mã], luc, ghiChu}} (người/máy soi xong mới ghi). */
  const XN = docJ(path.join(EXP, "xac-nhan-camera.json"), {});
  /* 10/10: camera đã xác nhận (người hoặc máy xac-minh-dem «chắc») người nằm TRONG các ứng viên WMS → chốt đúng người đó dù WMS có nhiều người châm */
  const xnNv = (XN[p.id]?.nv || []).map(String), chot = ds.filter((n) => xnNv.includes(String(n.code)));
  if (ds.length > 1 && chot.length)
    return { luat: loai, ketLuan: "B1.1", nv: chot, doChac: "CAO", camera: cam, lyDo: "Camera xác nhận " + chot.map((n) => n.ten + " (" + n.code + ")").join(", ") + " đặt hàng vào ô (" + (XN[p.id].may ? "máy: camera + lệnh WMS khớp ≤3′" : "người soi") + ") trong " + ds.length + " người châm 72h: " + tom };
  if (ds.length === 1 && ds[0].code && !(XN[p.id] && (XN[p.id].nv || []).includes(String(ds[0].code))))
    return { luat: loai, ketLuan: "cho-camera", nv: ds, camera: cam, lyDo: "WMS: chỉ 1 người châm" + (loai === "TB-01" ? " số lượng lớn" : "") + " trong " + CUA_SO_GIO + "h: " + tom + " — CHỜ đối chiếu camera đúng giờ châm" + (cam ? " (" + cam + ")" : "") };
  if (ds.length === 1 && ds[0].code)
    return { luat: loai, ketLuan: "B1.1", nv: ds, doChac: "CAO", camera: cam, lyDo: "Chỉ 1 người châm hàng " + (loai === "TB-01" ? "số lượng lớn " : "") + "vào ô trong " + CUA_SO_GIO + "h trước ảnh: " + tom };
  /* 10/10 user duyệt A1-01: WMS không chỉ ra đúng 1 người → gán người PHỤ TRÁCH kệ (bảng phân công) nếu người đó đi làm ngày ghi nhận */
  let ghiA101 = "";
  if (daDuyet("A1-01") && /^F0-A1-/.test(bin)) {
    const n = await napPC(), tra = traPhanCong(n, bin), pt = tra.pt, ngay = String(p.ngay).slice(0, 10), cc = pt && n.cc.get(String(pt.code))?.get(ngay);
    if (pt && cc) return { luat: "A1-01", ketLuan: "B1.1", nv: [{ ten: pt.ten, code: String(pt.code), email: pt.email }], ungVienWms: ds, doChac: "VỪA", camera: cam,
      lyDo: "WMS " + (ds.length ? ds.length + " người châm" : "không ai châm") + " trong " + CUA_SO_GIO + "h → gán phụ trách kệ " + tra.khoa + ": " + pt.ten + " (" + pt.code + "), đi làm " + ngay.slice(5) + " " + cc.vao + "–" + cc.ra + (ds.length ? " · ứng viên WMS: " + tom : "") };
    ghiA101 = n.loi ? "A1-01: chưa đọc được bảng phân công (Apps Script lỗi, không có bản lưu ≤48h) — lượt sau · " : pt ? "A1-01: phụ trách kệ " + pt.ten + " (" + pt.code + ") không có chấm công ngày " + ngay.slice(5) + " · " : tra.nhieuKhop ? "A1-01: ô khớp nhiều người phụ trách · " : "A1-01: ô chưa có trong bảng phân công · ";
  }
  return { luat: loai, ketLuan: "nghi-ngo", nv: ds, camera: cam,
    lyDo: ghiA101 + (ds.length ? ds.length + " người châm hàng vào ô trong " + CUA_SO_GIO + "h trước ảnh: " + tom + " — xem camera" + (cam ? " " + cam : "") + " để chốt ai/những ai"
      : "Không ai châm hàng " + (loai === "TB-01" ? "≥" + NGUONG_THUNG + " cái " : "") + "vào ô trong " + CUA_SO_GIO + "h trước ảnh — hàng có thể đã châm từ trước nữa") };
}

/* ---- dừng phiếu (khuôn canh-b11: re-create-step −1 + note_failed + đọc lại) ---- */
const HW = (t) => ({ authorization: t, origin: "https://work.hasaki.vn", referer: "https://work.hasaki.vn/" });
const docTask = async (t, id) => { try { return (await (await fetch(V + "/hr/projects/task-input/" + id, { headers: { authorization: t, accept: "application/json" }, signal: AbortSignal.timeout(30000) })).json()).data; } catch { return null; } };
async function binhLuan(t, id, text) {
  text = chuanTu(text);   // TU-01
  const fd = new FormData(); fd.set("obj_id", String(id)); fd.set("comment", text);
  try { await fetch(V + "/v2/task/comment", { method: "POST", body: fd, headers: HW(t), signal: AbortSignal.timeout(20000) }); } catch { /* xác nhận bằng GET */ }
  await new Promise((r) => setTimeout(r, 800));
  try { const j = await (await fetch(V + "/v2/task/comment?obj_id=" + id, { headers: HW(t) })).json();
    return (j.data || []).some((c) => String(c.comment || "").replace(/\r\n/g, "\n").includes(text)); } catch { return false; }
}
async function dungPhieu(t, id, lyDo) {
  lyDo = chuanTu(lyDo);   // TU-01
  const d = await docTask(t, id); if (!d) return false;
  const treo = (d.subtasks || []).filter((s) => [0, 1].includes(Number(s.status)));
  if (treo.length !== 1) { log("   ⚠ " + treo.length + " bước treo (cần đúng 1) — xem tay."); return false; }
  try { await fetch(V + "/hr/projects/re-create-step/" + treo[0].id, { method: "POST", signal: AbortSignal.timeout(30000),
    headers: { ...HW(t), "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ workflow_step_id: "-1" }) }); } catch { /* đọc lại */ }
  await new Promise((r) => setTimeout(r, 1200));
  const luc = new Date(Date.now() + 7 * 36e5).toISOString().replace("T", " ").slice(0, 19);
  const fd = new FormData(); fd.set("id", String(treo[0].id)); fd.set("field", "data");
  fd.set("value[note_failed]", JSON.stringify([{ note_failed: lyDo, staff_name: "Lê Chí Tâm", staff_code: "233135", created_at: luc }]));
  try { await fetch(V + "/hr/projects/mass-update-field-task-input", { method: "POST", body: fd, headers: HW(t), signal: AbortSignal.timeout(30000) }); } catch { /* đọc lại */ }
  const d2 = await docTask(t, id);
  return !!(d2 && Number(d2.status) === 2 && !(d2.subtasks || []).some((s) => [0, 1].includes(Number(s.status))));
}
function dongB1(id, nv) {
  try {
    const out = execFileSync(process.execPath, [path.join(DIR, "auto-complete-single-task.mjs"), "--task=" + id, "--nv=" + nv, "--lam"], { windowsHide: true, cwd: DIR, timeout: 180000, encoding: "utf8" });
    log("   " + out.trim().split(/\r?\n/).slice(-2).join(" | ").slice(0, 200));
    return /ĐÓNG B1 XONG|B1 đã đóng sẵn/.test(out);
  } catch (e) { log("   ⚠ đóng B1 trượt: " + String(e.message).slice(0, 120)); return false; }
}

/* ═══ chạy ═══ */
const F_SO = path.join(DIR, ".canh-b1.json");
const SO = docJ(F_SO, { lam: {}, qd: {} });
const F_KQ = path.join(EXP, "canh-b1-ketqua.json");
const KQ = docJ(F_KQ, {});
const F_CN = path.join(EXP, "b1-treo-cap-nhat.json");
const CN = docJ(F_CN, {});
const COT_XL = "29/09 · Đã xử lý";
const ghiDaLam = (id, cau) => { CN[id] ||= {}; const cu = CN[id][COT_XL] ? CN[id][COT_XL] + " · " : ""; if (!String(CN[id][COT_XL] || "").includes(cau)) CN[id][COT_XL] = cu + cau; };
const AN_LE = path.join(EXP, "an-le-b1.json");

if (QC) {
  let ok = 0, sai = 0;
  for (const l of BO.luat) for (const a of (l.anLe || [])) {
    if (!a.ketLuan || typeof a.ketLuan !== "object") continue;
    const v = Object.values(C.rows).find((r) => (r[I.link] || "").includes("task_id=" + a.phieu));
    if (!v) { log("QC " + l.ma + " " + a.phieu + ": không có trong tasks-cache — bỏ"); continue; }
    const kq = await xet({ id: a.phieu, ngay: String(v[I.ngay]), loi: String(v[I.loi]), bin: String(v[I.bin]).trim() });
    const ma = (kq.nv || []).map((n) => n.code).sort().join(","), muon = [...a.ketLuan.nv].sort().join(",");
    const dung = kq.luat === l.ma && kq.ketLuan === a.ketLuan.loai && ma === muon;
    dung ? ok++ : sai++;
    log("QC " + l.ma + " án lệ " + a.phieu + ": " + (dung ? "✓" : "✗ máy ra " + kq.luat + "/" + kq.ketLuan + " [" + ma + "], án lệ " + a.ketLuan.loai + " [" + muon + "]"));
  }
  log("QC án lệ: " + ok + " đúng · " + sai + " sai"); process.exit(sai ? 3 : 0);
}

log("Phiếu treo B1: " + phieu.length + (LAM ? "" : " (diễn tập — chưa ghi gì lên work.hasaki)"));
const dem = {};
// 14/10 «chạy ra sao, của task nào» → tab Máy trạm (chỉ lượt thật, không diễn tập/QC)
const TD = LAM && !QC ? await import("./tien-do.mjs") : null;
TD?.batDau("canh-xac-minh-b1", "Soát phiếu B1 theo luật");
let iTD = 0;
for (const p of phieu) {
  TD?.tienDo({ buoc: "Soát phiếu B1 theo luật", task: p.id, i: ++iTD, n: phieu.length });
  const kq = await xet(p);
  KQ[p.id] = { ...kq, bin: p.bin, ngay: p.ngay, luc: new Date().toISOString() };
  dem[kq.luat + "·" + kq.ketLuan] = (dem[kq.luat + "·" + kq.ketLuan] || 0) + 1;
  if (kq.ketLuan === "canh-b11") continue;
  log(p.id + " " + kq.luat + " → " + kq.ketLuan + " · " + kq.lyDo.slice(0, 160));
  if (kq.ketLuan === "B1.1" && !SO.lam[p.id]) {
    if (!choTuLam(kq.luat)) { KQ[p.id].choDuyet = true; log("   (luật " + kq.luat + " chưa được duyệt «Cho máy tự làm» — chỉ ghi sheet)"); continue; }
    if (!LAM) { log("   [thử] sẽ đóng B1 → B1.1 cho " + kq.nv[0].ten); continue; }
    if (dongB1(p.id, kq.nv[0].email)) { SO.lam[p.id] = { luat: kq.luat, nv: kq.nv[0].code, luc: new Date().toISOString() }; ghiDaLam(p.id, "Máy (" + kq.luat + ") chuyển B1.1 cho " + kq.nv[0].ten + " (" + kq.nv[0].code + ")"); }
  }
}
ghiJ(F_KQ, KQ);

/* ═══ QD-01: làm theo cột Quyết định của bạn (sheet-b1-treo.py xuất .exports/b1-quyet-dinh.json) ═══ */
const QD = { ...docJ(path.join(EXP, "b1-quyet-dinh.json"), {}), ...docJ(path.join(EXP, "b1-quyet-dinh-web.json"), {}) };   // 05/10: quyết định từ dashboard (web) thắng sheet
const RAW = docJ(path.join(EXP, "b1-treo-raw.json"), {});          // {id: {NV nghi, Phụ trách kệ}} cũng do sheet-b1-treo.py xuất
let token = null;
for (const [id, { qd, gc }] of Object.entries(QD)) {
  if (!qd || SO.qd[id + "|" + qd]) continue;
  TD?.tienDo({ buoc: "Làm theo quyết định của bạn", task: id, i: 0, n: 0, chiTiet: qd });
  const maTrong = (s) => [...new Set(String(s || "").match(/\b\d{6}\b/g) || [])];
  let viec = null;
  if (qd === "Gán lỗi cho NV máy nghi") {
    const m = maTrong(gc).length ? maTrong(gc) : (KQ[id]?.nv || []).map((n) => n.code).filter(Boolean).length === 1 ? [(KQ[id].nv[0].code)] : maTrong(RAW[id]?.nghi);
    viec = m.length === 1 ? { loai: "b11", nv: m[0] } : { loai: "hoi", lyDo: m.length ? "Có " + m.length + " NV nghi (" + m.join(", ") + ") — ghi mã người chịu ở cột «Ghi chú của bạn» (nhiều người ngăn bằng dấu phẩy)" : "Không có mã NV nghi — ghi mã ở cột Ghi chú" };
    if (m.length > 1 && maTrong(gc).length > 1) viec = { loai: "b11", nv: m.join(",") };
  } else if (qd === "Gán cho người phụ trách kệ") {
    const m = maTrong(RAW[id]?.phuTrach); viec = m.length === 1 ? { loai: "b11", nv: m[0] } : { loai: "hoi", lyDo: "Không tra được mã người phụ trách kệ" };
  } else if (/^Fail|^Huỷ phiếu/.test(qd)) {
    viec = { loai: "dung", lyDo: (gc && gc.trim()) || qd.replace(/^Fail - /, "").replace(/^Huỷ phiếu \(tạo nhầm\)/, "Phiếu tạo nhầm") };
  } else if (qd === "Cắt thêm clip camera") viec = { loai: "camera" };
  if (!viec) continue;
  log("QD " + id + " «" + qd + "» → " + viec.loai + (viec.nv ? " " + viec.nv : "") + (viec.lyDo ? " · " + viec.lyDo : ""));
  if (viec.loai === "hoi") { KQ[id] = { ...(KQ[id] || {}), canBan: viec.lyDo }; continue; }
  if (viec.loai === "camera") { const f = path.join(EXP, "b1-cho-camera.json"), q = docJ(f, {}); q[id] ||= { luc: new Date().toISOString(), camera: KQ[id]?.camera || "" }; ghiJ(f, q); SO.qd[id + "|" + qd] = Date.now(); ghiDaLam(id, "Đã đưa vào hàng chờ cắt clip camera"); continue; }
  if (!LAM) { log("   [thử] chưa làm."); continue; }
  token ||= await layTokenSongWork(DIR, () => {});
  let xong = false;
  if (viec.loai === "b11") { xong = dongB1(id, viec.nv); if (xong) ghiDaLam(id, "Theo quyết định của bạn: chuyển B1.1 cho " + viec.nv); }
  else if (viec.loai === "dung") {
    if (await binhLuan(token, id, viec.lyDo)) xong = await dungPhieu(token, id, viec.lyDo);
    if (xong) ghiDaLam(id, "Theo quyết định của bạn: đã dừng phiếu — «" + viec.lyDo + "»");
  }
  if (xong) {
    SO.qd[id + "|" + qd] = Date.now();
    const al = docJ(AN_LE, []); al.push({ phieu: id, luat: KQ[id]?.luat || "", quyetDinh: qd, ghiChu: gc || "", mayDeXuat: KQ[id]?.ketLuan || "", luc: new Date().toISOString() }); ghiJ(AN_LE, al);
  }
}
ghiJ(F_KQ, KQ); ghiJ(F_SO, SO); ghiJ(F_CN, CN);
log("Tổng: " + Object.entries(dem).map(([k, n]) => k + " " + n).join(" · ") + " · WMS " + nWms + " lượt");
await TD?.xong();
