/**
 * tu-chua.js — TẦNG TỰ CHỮA LÀNH (thư viện dùng chung, 12/08/2026).
 *
 *  VÌ SAO CÓ FILE NÀY — sự cố mở mắt 27/07→11/08/2026:
 *  bước chấm công (pull-timesheet.js) chết từ 26/07 vì IdP đổi giao diện. Suốt 16 NGÀY:
 *  Task Scheduler vẫn chạy đúng giờ, vẫn báo Result 0 (mã thoát bị .bat/.vbs nuốt),
 *  dashboard vẫn hiện số — nhưng là số CŨ. Không một ai biết.
 *  Bài học: hệ này rất khoẻ ở khoản "không vỡ", nhưng MÙ ở khoản "vỡ rồi thì biết".
 *
 *  Ba việc file này làm, xếp theo giá trị:
 *   1) CHẶN GHI RÁC  — kiemTruocKhiGhi(): số dòng tụt bất thường / sai hợp đồng cột thì
 *      KHÔNG ghi Sheet, giữ nguyên dữ liệu cũ. Ghi đè 2.389 dòng tồn kho bằng 12 dòng rác
 *      tai hại hơn nhiều so với đứng im — đây là luật quan trọng nhất ở đây.
 *   2) BÁO ĐÚNG NGƯỜI — moSuCo()/dongSuCo(): đẩy sự cố lên GAS, GAS soạn thư gửi chính chủ.
 *      Gửi từ GAS chứ không từ máy trạm, vì kịch bản tệ nhất là MÁY TẮT — lúc đó chính nó
 *      không thể gửi thư báo là nó đã tắt (xem nhipTim + tcCanhNhipTim bên GAS).
 *   3) TỰ VÁ ĐƯỢC PHẦN VÁ ĐƯỢC — layTruong() (WMS đổi tên trường) + thuNhieuDiaChi()
 *      (WMS đổi địa chỉ báo cáo): hai kiểu đổi hay gặp nhất mà không cần ai sửa code.
 *
 *  NGUYÊN TẮC: mọi hàm ở đây là BEST-EFFORT — hỏng thì trả về "không kết luận" chứ TUYỆT ĐỐI
 *  không ném lỗi ngược vào luồng sync chính. Tầng giám sát mà làm chết tầng sản xuất là phản tác dụng.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { gasPost } from "./session-rules.js";

const APPSCRIPT_URL = process.env.APPSCRIPT_URL || "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
const APPSCRIPT_KEY = process.env.APPSCRIPT_KEY;

const F_BASELINE = ".baseline-tu-chua.json";   // lịch sử số dòng đã ĐƯỢC CHẤP NHẬN của từng nguồn
const F_DIACHI   = ".dia-chi-hoc.json";        // địa chỉ API đã dò được sau khi WMS đổi endpoint
const SO_MAU_GIU = 14;                         // giữ 14 mẫu ~ 2 tuần: đủ ổn định, đủ bám theo mùa vụ
const SO_MAU_TOI_THIEU = 5;                    // dưới 5 mẫu thì chưa dám kết luận gì
const NGUONG_TUT = 0.5;                        // tụt quá 50% so với trung vị = nghi ngờ
const SAN_KIEM = 20;                           // tab bé hơn 20 dòng thì bỏ qua luật baseline (nhiễu)

/* ══════════════════════ 1. PHÂN LOẠI LỖI ══════════════════════
 * Hiện fetchThuLai chỉ retry 5xx/429 rồi ném — mọi thất bại trông giống hệt nhau trong log,
 * nên không thể biết đang ở kịch bản nào để chọn đối sách. Chuẩn hoá về 1 nhãn duy nhất. */
export const LOI = {
  OK: "OK",
  MAT_MANG: "MAT_MANG",                 // máy vừa boot, mạng chưa lên (bẫy 09:21 ngày 30/07)
  TIMEOUT: "TIMEOUT",
  MAT_QUYEN_401: "MAT_QUYEN_401",       // token chết → đổi nguồn token, KHÔNG phải mất quyền
  MAT_QUYEN_403: "MAT_QUYEN_403",       // mất quyền thật (HR 10/08) → tìm đường thay thế
  KHONG_THAY_404: "KHONG_THAY_404",     // đổi/bỏ endpoint → dò pool địa chỉ
  BI_SIET_429: "BI_SIET_429",           // rate limit → giãn nhịp
  WAF_HTML: "WAF_HTML",                 // 200/403 nhưng trả HTML thay JSON = tường lửa/captcha
  LOI_MAY_CHU: "LOI_MAY_CHU",           // 5xx → thử lại
  RONG_200: "RONG_200"                  // 200 nhưng rỗng/tụt bất thường — NGUY HIỂM NHẤT: không có lỗi nào
};

/** Gán 1 nhãn cho một lượt gọi API. `text` là body thô (nếu đã đọc) — để bắt ca trả HTML. */
export function phanLoaiLoi({ res, text, err } = {}) {
  if (err) {
    const m = String(err && err.message || err);
    if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ENETUNREACH|fetch failed/i.test(m)) return LOI.MAT_MANG;
    if (/timeout|ETIMEDOUT|aborted/i.test(m)) return LOI.TIMEOUT;
    return LOI.MAT_MANG;
  }
  if (!res) return LOI.MAT_MANG;
  if (typeof text === "string" && /^\s*<(!doctype|html)/i.test(text)) return LOI.WAF_HTML;
  if (res.status === 401) return LOI.MAT_QUYEN_401;
  if (res.status === 403) return LOI.MAT_QUYEN_403;
  if (res.status === 404 || res.status === 400) return LOI.KHONG_THAY_404;
  if (res.status === 429) return LOI.BI_SIET_429;
  if (res.status >= 500) return LOI.LOI_MAY_CHU;
  return res.ok ? LOI.OK : LOI.LOI_MAY_CHU;
}

/* ══════════════════════ 2. BASELINE SỐ DÒNG ══════════════════════
 * Bắt kịch bản E (HTTP 200 nhưng dữ liệu rỗng/tụt) — kịch bản duy nhất không sinh ra lỗi nào,
 * nên không có cách nào khác để phát hiện ngoài so với chính mình mấy ngày trước.
 *
 * CHỐT QUAN TRỌNG: chỉ ghi mẫu khi lượt đó ĐƯỢC CHẤP NHẬN. Nếu ghi cả lượt tụt thì trung vị
 * trôi dần xuống theo, vài ngày sau 12 dòng thành "bình thường" và cảm biến tự vô hiệu hoá. */
function docJson(DIR, ten) { try { return JSON.parse(fs.readFileSync(path.join(DIR, ten), "utf8")); } catch { return {}; } }
function ghiJson(DIR, ten, o) { try { fs.writeFileSync(path.join(DIR, ten), JSON.stringify(o)); } catch { /* best-effort */ } }

function trungVi(ds) {
  const a = ds.slice().sort((x, y) => x - y);
  const g = Math.floor(a.length / 2);
  return a.length % 2 ? a[g] : Math.round((a[g - 1] + a[g]) / 2);
}

/** Lượt này có bất thường so với 14 lượt trước không? → { nghiNgo, trungVi, nguong, soMau } */
export function kiemSoDong(DIR, nguon, soDong) {
  const kho = docJson(DIR, F_BASELINE);
  const mau = (kho[nguon] || []).map(Number).filter((n) => Number.isFinite(n));
  if (mau.length < SO_MAU_TOI_THIEU) return { nghiNgo: false, soMau: mau.length, lyDo: "chưa đủ mẫu" };
  const tv = trungVi(mau);
  if (tv < SAN_KIEM) return { nghiNgo: false, trungVi: tv, soMau: mau.length, lyDo: "nguồn nhỏ, bỏ qua luật" };
  const nguong = Math.floor(tv * NGUONG_TUT);
  return { nghiNgo: soDong < nguong, trungVi: tv, nguong, soMau: mau.length };
}

/** Ghi nhận 1 lượt ĐẠT vào baseline. Chỉ gọi sau khi đã quyết định ghi Sheet. */
export function ghiMauBaseline(DIR, nguon, soDong) {
  const kho = docJson(DIR, F_BASELINE);
  kho[nguon] = [...(kho[nguon] || []), Number(soDong)].slice(-SO_MAU_GIU);
  ghiJson(DIR, F_BASELINE, kho);
}

/* ══════════════════════ 3. HỢP ĐỒNG CỘT ══════════════════════
 * HEADER_* trong từng script vốn đã là hợp đồng dữ liệu — chỉ là chưa ai kiểm nó trước khi ghi. */
export function kiemHopDong(header, rows, { cotSo = [] } = {}) {
  if (!Array.isArray(header) || !header.length) return { dat: false, lyDo: "thiếu header" };
  if (!Array.isArray(rows) || !rows.length) return { dat: false, lyDo: "không có dòng nào" };
  const lech = rows.findIndex((r) => !Array.isArray(r) || r.length !== header.length);
  if (lech >= 0) return { dat: false, lyDo: "dòng " + (lech + 1) + " có " + (rows[lech] || []).length + " ô, header cần " + header.length };
  for (const c of cotSo) {
    const xau = rows.findIndex((r) => r[c] !== "" && r[c] != null && !Number.isFinite(Number(r[c])));
    if (xau >= 0) return { dat: false, lyDo: "cột " + (header[c] || c) + " ở dòng " + (xau + 1) + " không phải số" };
  }
  return { dat: true };
}

/* ══════════════════════ 4. CỔNG TRƯỚC KHI GHI ══════════════════════
 * Gọi ngay trước khi POST syncTasks. Trả { ghi:false } là DỪNG — giữ nguyên dữ liệu cũ trên Sheet. */
export async function kiemTruocKhiGhi(DIR, { nguon, tenHienThi, header, rows, cotSo = [], log = () => {} }) {
  const hd = kiemHopDong(header, rows, { cotSo });
  if (!hd.dat) {
    log("  ⛔ " + nguon + ": SAI HỢP ĐỒNG CỘT (" + hd.lyDo + ") — KHÔNG ghi, giữ dữ liệu cũ.");
    await moSuCo({ ma: "LECH-" + nguon, loai: "DU_LIEU_LECH", nguon: tenHienThi || nguon,
      soLieu: { docDuoc: rows.length, kyVong: 0 }, chiTiet: hd.lyDo });
    return { ghi: false, ma: "SAI_HOP_DONG" };
  }
  const bl = kiemSoDong(DIR, nguon, rows.length);
  if (bl.nghiNgo) {
    log("  ⛔ " + nguon + ": chỉ " + rows.length + " dòng, mọi ngày ~" + bl.trungVi + " — KHÔNG ghi, giữ dữ liệu cũ.");
    await moSuCo({ ma: "TUT-" + nguon, loai: "DU_LIEU_LECH", nguon: tenHienThi || nguon,
      soLieu: { docDuoc: rows.length, kyVong: bl.trungVi },
      chiTiet: "đọc được " + rows.length + " dòng, trung vị " + bl.soMau + " lượt gần nhất là " + bl.trungVi });
    return { ghi: false, ma: LOI.RONG_200 };
  }
  return { ghi: true };
}

/** Gọi SAU khi ghi Sheet thành công: ghi mẫu baseline + đóng sự cố nếu trước đó có mở. */
export async function xacNhanDaGhi(DIR, nguon, soDong) {
  ghiMauBaseline(DIR, nguon, soDong);
  await dongSuCo("TUT-" + nguon);
  await dongSuCo("LECH-" + nguon);
}

/* ══════════════════════ 5. GIẢI TRƯỜNG MỀM ══════════════════════
 * WMS đổi tên trường (qty → quantity → so_luong) là kiểu đổi rẻ nhất để chống: khai sẵn
 * các tên đã từng đúng, khớp tên nào cũng chạy, khỏi ai phải sửa code. */
export function layTruong(obj, ...tenCoThe) {
  if (!obj) return undefined;
  for (const t of tenCoThe.flat()) {
    if (obj[t] !== undefined && obj[t] !== null) return obj[t];
    const khoa = Object.keys(obj).find((k) => k.toLowerCase() === String(t).toLowerCase());
    if (khoa && obj[khoa] !== undefined && obj[khoa] !== null) return obj[khoa];
  }
  return undefined;
}

/* ══════════════════════ 6. POOL ĐỊA CHỈ ══════════════════════
 * WMS deploy đổi đường dẫn (v3 → v4, đổi path) → 404 hàng loạt. Khai 2-3 biến thể từng đúng,
 * dò lần lượt, cái nào qua được bài kiểm thì NHỚ LẠI vào .dia-chi-hoc.json và dùng tiếp.
 * `hopLe(json)` do bên gọi cung cấp — không có nó thì chỉ cần HTTP 200 là nhận, dễ nhận nhầm. */
export async function thuNhieuDiaChi(DIR, khoa, dsUrl, opt, hopLe = () => true, log = () => {}) {
  const hoc = docJson(DIR, F_DIACHI);
  const uuTien = hoc[khoa] ? [hoc[khoa], ...dsUrl.filter((u) => u !== hoc[khoa])] : dsUrl;
  let loiCuoi = null;
  for (const u of uuTien) {
    try {
      const r = await fetch(u, opt);
      if (!r.ok) { loiCuoi = "HTTP " + r.status; continue; }
      const j = await r.json().catch(() => null);
      if (!j || !hopLe(j)) { loiCuoi = "dữ liệu không qua bài kiểm"; continue; }
      if (hoc[khoa] !== u) { hoc[khoa] = u; ghiJson(DIR, F_DIACHI, hoc); log("  ✓ Đã dò được địa chỉ mới cho " + khoa + " — nhớ lại để dùng tiếp."); }
      return { ok: true, url: u, json: j };
    } catch (e) { loiCuoi = String(e && e.message || e); }
  }
  return { ok: false, lyDo: loiCuoi };
}

/* ══════════════════════ 7. ĐƯỜNG LÊN GAS ══════════════════════
 * BẮT BUỘC probe caps trước: GAS bản CŨ gặp action lạ sẽ rơi vào nhánh appendRow mặc định
 * và GHI RÁC vào sheet 5S (luật đã ghi trong session-rules.js). Chưa deploy → im lặng bỏ qua. */
let _capTuChua = null;
async function gasCoTuChua() {
  if (_capTuChua != null) return _capTuChua;
  if (!APPSCRIPT_KEY) return (_capTuChua = false);
  try {
    const j = await gasPost({ action: "caps", key: APPSCRIPT_KEY }, () => {}, "caps");
    _capTuChua = !!(j && j.tuChua);
  } catch { _capTuChua = false; }
  return _capTuChua;
}

/* Qua gasPost: 404 chập chờn của Google từng làm tầng tự chữa TƯỞNG gửi thất bại. Với action suCo
 * (appendRow sổ sự cố) và thư cảnh báo thì thử lại mà không có chốt sẽ ghi 2 dòng / gửi 2 thư —
 * nonce của gasPost khiến GAS trả lại phản hồi cũ thay vì làm lại. */
async function guiGas(payload) {
  if (!await gasCoTuChua()) return null;
  try { return await gasPost({ ...payload, key: APPSCRIPT_KEY }, () => {}, payload.action || "tuChua"); }
  catch { return null; }   // best-effort: mất mạng thì thôi, tick sau báo lại
}

/* ══ CÔNG TẮC THƯ (15/08/2026, theo yêu cầu: NGƯNG gửi mail cảnh báo) ══════════════════════
 * `CANH_GUI_THU=0` trong .env ⇒ mọi lời gọi moSuCo/dongSuCo im lặng, KHÔNG chạm GAS.
 * Vì sao chặn ngay tại đây chứ không sửa GAS: đây là cửa DUY NHẤT máy trạm đẩy thư (đã soát —
 * `apiAlert` trong google-script.gs không còn script Node nào gọi), nên tắt 1 chỗ là tắt hết,
 * không phải deploy lại web app đang là đường ghi Sheet của cả dự án.
 *
 * CỐ Ý KHÔNG tắt `nhipTim`: nhịp tim là thứ NGĂN thư, không phải thứ gửi thư — bên GAS
 * `tcCanhNhipTim` gửi "máy trạm im" khi nhịp tim tắt lịm. Chặn nhịp tim = tự chuốc thư.
 *
 * Các cảm biến VẪN chạy và vẫn in ⛔ ra log (canh-suc-khoe.js / sync-guard.log) — chỉ mất đường
 * thư. Muốn xem hiện trạng bất cứ lúc nào: `node canh-suc-khoe.js --xem`. */
const GUI_THU = String(process.env.CANH_GUI_THU ?? "1") !== "0";
export const guiThuDangBat = () => GUI_THU;

/**
 * Mở sự cố → GAS quyết định có gửi thư không (1 thư/sự cố/ngày, nhắc ngày 3 và ngày 7).
 *  ma    : chữ ký sự cố, dùng để chống spam và để đóng đúng sự cố đó
 *  loai  : MAY_TRAM_IM | DANG_NHAP_TAY | BUOC_DUNG | DU_LIEU_LECH | MAT_QUYEN | CHO_CAP_PHEP
 *  nguon : tên tiếng Việt người non-tech đọc hiểu ("Tồn kho bất thường")
 */
export async function moSuCo({ ma, loai, nguon, soLieu = {}, chiTiet = "" }) {
  if (!GUI_THU) return null;
  return guiGas({ action: "suCo", viec: "mo", ma, loai, nguon, soLieu, chiTiet });
}

/** Đóng sự cố → GAS gửi thư xanh "đã chảy lại". Chưa từng mở thì GAS tự im, gọi thoải mái. */
export async function dongSuCo(ma) {
  if (!GUI_THU) return null;
  return guiGas({ action: "suCo", viec: "dong", ma });
}

/**
 * Nhịp tim: máy trạm báo "tôi còn sống" mỗi lượt sync.
 * GAS canh nhịp này bằng trigger mỗi giờ — im quá 3 tiếng trong giờ làm thì GAS TỰ gửi thư.
 * Đây là đường DUY NHẤT bắt được kịch bản máy trạm tắt, vì lúc đó máy không thể tự tố cáo mình.
 */
export async function nhipTim(buoc = "") {
  return guiGas({ action: "heartbeat", buoc });
}
