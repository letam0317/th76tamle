/**
 * ============================================================================
 *  canh-b11.mjs — BỘ CANH B1.1 / B3.x của workflow 5S (591) — user chốt 24-25/09/2026
 * ============================================================================
 *  Sáu luật, chạy trên MỘT lượt GET board (mặc định 120 ngày từ 26/09) — ③ áp cả B3.2, ④ chỉ ghép Mô tả,
 *  ①b (26/09): quá 72h sau thông báo nhắc mà NV không phản hồi → tự ghi "Lỗi cá nhân" + đóng B1.1,
 *  ⑤ phán xử B1 treo (fail trùng/nghỉ ngắn · nghỉ dài: nhắc QLTT ngày 4, 5 → trừ QLTT ngày 6 ·
 *     luật 7 ngày (29/09, thay 14): 1 vị trí + 1 người + 1 lỗi chỉ ghi nhận 1 lần/7 ngày — xem khối ⑤):
 *
 *  ① B1.1 TREO >48h → TAG QUẢN LÝ TRỰC TIẾP (đã nhập ở B1, ô QLBP02) vào bình luận
 *     task, nhờ nhắc NV xác nhận. CHỈ tag khi NV vi phạm thuộc nghiệp vụ
 *     "Phát triển cửa hàng" hoặc "Đóng gói" TẠI KHO 170 (working_loc_id 398) —
 *     tra từ danh bạ wshr. Mention khuôn thật đã soi từ bình luận người dùng:
 *         @[Tên](user_id:<user_id danh bạ>)
 *     Mỗi task CHỈ NHẮC MỘT LẦN: sổ .canh-b11.json + soát marker trong bình luận
 *     trước khi đăng (chống trùng 2 lớp, giống bo-sung-sku-comment.mjs).
 *
 *  ② B1 xác minh ≥2 NV vi phạm → B1.1 bật "MỖI THÀNH VIÊN" (không làm-chung-nhóm):
 *     - gán đủ MỌI NV vi phạm vào B1.1 (assign_staff),
 *     - đặt field `sub_type` = 1 — SỐ ĐO TỪ VÍ DỤ THẬT của user 24/09: task 13818654
 *       sau khi user bật đúng chế độ mong muốn trên panel Nhân sự có type=2, sub_type=1
 *       (mọi task khác sub_type=0). ĐỪNG dùng type=3 — suy đoán i18n ban đầu đã sai.
 *     Chỉ đụng khi B1.1 còn MỞ (status 0).
 *
 *  ③ B1.1 xong VÀ NV xác nhận "LỖI CÁ NHÂN" → TỰ ĐIỀN "Nhân viên vi phạm" (NVVP04)
 *     vào B3.1 rồi CHỈ LƯU (không đóng bước — B3.1 là việc của người ghi nhận).
 *     Gate đủ 3 điều (user chốt 24/09 chiều):
 *       · ô `xacnhan11` ("Xác nhận lỗi:") của B1.1 = "Lỗi cá nhân" — giá trị khác
 *         ("Không phải lỗi cá nhân") thì KHÔNG điền, để người ghi nhận tự xử;
 *       · B1.1 status 2;
 *       · MỌI thành viên đều status 2 (nhiều NV thì đợi đủ từng người — đi đôi với ②).
 *     NVVP04 = mã NV từ B1 (configs.staff), phẩy — khuôn y các phiếu user đã điền tay.
 *     ③b (05/10, user "theo quản lý chốt"): NV chọn "Không phải lỗi cá nhân" mà B3 vẫn mở ⇒ mọi kết luận
 *         quản lý ở B2 (CNF03)/B4 (CNF05) = "Lỗi cá nhân" → điền NV; B2 "Không" + B4 "Có" → log nhờ người.
 *     ③c (05/10, user "hợp lệ"): quản lý tự vào B1.1 điền "Lỗi cá nhân" + đóng hộ NV → miễn gate đủ-từng-người
 *         (nhận diện người ghi ô xacnhan11 ∉ NV ở B1; sổ so.ho).
 *
 *  Tải upstream: 1 GET board/lượt + vài GET/POST đúng lúc có việc (~11 lượt canh/ngày
 *  trong cửa 07:00–18:00 T2–T7 — xem LICH-VA-DU-PHONG.md A2 "5S Canh B1.1").
 *
 *  Chạy:  node canh-b11.mjs --thu     # DIỄN TẬP: chỉ in việc sẽ làm
 *         node canh-b11.mjs           # làm thật (tôn trọng cửa giờ)
 *         node canh-b11.mjs --force   # xuyên cửa giờ
 * ============================================================================
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { layTokenSongWork, phutVN, mayDuocChay, laTokenGhiDuoc } from "./session-rules.js";
import { napNguonTruyVet, truyVet, laHangMucVeSinhHangNgay, DAU_TRUY_VET, cauNhacBui, DAU_NHAC_BUI, CUA_SO_BUI_GIO } from "./truy-vet-vesinh.mjs";
import { docSoQLTT, chonQLTTCanBang, ghiLuot } from "./qltt.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const V = "https://wshr.hasaki.vn/api";
const WF = process.env.WORKFLOW_ID || "591";
const TREO_GIO = Number(process.env.B11_TREO_GIO || 48);
const LOC_KHO170 = "398";
const MAJOR_OK = ["phat trien cua hang", "dong goi"];   // so KHÔNG DẤU, lowercase
const F_SO = path.join(DIR, ".canh-b11.json");
/* Nhận diện bình luận nhắc đã đăng (dedupe lớp 2 khi sổ local mất) — user 24/09 chiều yêu cầu BỎ
 * đuôi marker "(auto-nhắc B1.1)" khỏi nội dung, nên nhận diện bằng chính câu nhắc. */
const DAU_HIEU = "phản hồi Có lỗi cá nhân hoặc Không phải lỗi cá nhân ở bước B1.1";
/* User 29/09 đổi câu nhắc — vẫn nhận câu cũ để không nhắc trùng task đã nhắc trước đó. */
const DAU_HIEU_CU = ["xác nhận lỗi vi phạm ở bước B1.1"];
const coDauHieu = (x) => [DAU_HIEU, ...DAU_HIEU_CU].some((d) => x.includes(d));
/* ①b (user chốt 26/09): quá 72h sau thông báo nhắc mà NV không phản hồi → tự ghi "Lỗi cá nhân". */
const PHAT_GIO = Number(process.env.B11_PHAT_GIO || 72);
const CAU_72H = "Sau " + PHAT_GIO + "h kể từ thông báo nhắc trễ hạn này, nếu không có phản hồi gì, " +
  "hệ thống sẽ tự động ghi nhận LỖI CÁ NHÂN cho nhân sự được xác minh ở bước B1.";
const A = process.argv.slice(2);
const THU = A.includes("--thu"), FORCE = A.includes("--force");
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);

/* ---- cửa giờ 07:00–18:00 T2–T7 (đầu main — tick ngoài giờ 0 lượt gọi) ---- */
function trongCua(d = new Date()) {
  const thu = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Ho_Chi_Minh", weekday: "short" }).format(d);
  const p = phutVN(d);
  return thu !== "Sun" && p >= 7 * 60 && p < 18 * 60;
}
if (!mayDuocChay(log) && !THU) process.exit(0);      // vai máy (laptop/PC) — Phần G; --force đã được hàm xét
if (!FORCE && !THU && !trongCua()) { log("ngoài cửa 07:00–18:00 T2–T7 — bỏ lượt."); process.exit(0); }

/* ---- chống chạy chồng (FAIL-CLOSED) ---- */
const F_KHOA = path.join(DIR, ".canh-b11.lock");
try {
  const st = fs.statSync(F_KHOA);
  if (Date.now() - st.mtimeMs < 20 * 60 * 1000) { log("lượt trước còn chạy — bỏ lượt."); process.exit(0); }
} catch (e) { if (e.code !== "ENOENT") { log("không dò được khoá → coi như đang chạy, bỏ."); process.exit(0); } }
fs.writeFileSync(F_KHOA, new Date().toISOString());
process.on("exit", () => { try { fs.unlinkSync(F_KHOA); } catch { /* best-effort */ } });

const boDau = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/\s+/g, " ").trim();

/* ---- % trừ theo hạng mục từ tab QUY-DINH (gviz public, nạp lười 1 lần/lượt chạy) ----
 * So khớp KHÔNG DẤU + bỏ cụm "và báo cáo" (tab đổi câu giữa chừng) + khớp 45 ký tự đầu —
 * cùng họ với matcher kpiTheoLoi của dashboard. Trả "2"/"5"/"3"/"" (không tra được). */
const QD_SHEET = "1FWffWi75aATbokfqIcqjByEPzkJLQBngTXp5aPOIbLM";
let _qdRows = null;
async function layPhanTramQD(loi, log = () => {}) {
  try {
    if (!_qdRows) {
      const r = await fetch("https://docs.google.com/spreadsheets/d/" + QD_SHEET + "/gviz/tq?tqx=out:json&sheet=QUY-DINH", { signal: AbortSignal.timeout(45000) });
      const t = await r.text();
      const j = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
      _qdRows = j.table.rows.map((x) => (x.c || []).map((c) => (c ? (c.f !== undefined ? c.f : c.v) : "")))
        .filter((x) => /^\d+$/.test(String(x[0]).trim()));
    }
    const bo = (s) => boDau(s).replace(/\bva bao cao\b/g, " ").replace(/[.,;:!?()"'“”‘’–—]/g, " ").replace(/\s+/g, " ").trim();
    const n = bo(loi);
    if (!n) return "";
    const row = _qdRows.find((x) => { const q = bo(x[1]); return q === n || q.slice(0, 45) === n.slice(0, 45); });
    return row ? String(row[3]).trim() : "";
  } catch (e) { log("   ⚠ không đọc được QUY-DINH: " + String(e.message).slice(0, 80)); return ""; }
}

/* ---- danh bạ (cache 12h, khuôn push-5s) ---- */
const CACHE_DB = path.join(DIR, ".cache-danhba.json");
async function layDanhBa(token) {
  try {
    const c = JSON.parse(fs.readFileSync(CACHE_DB, "utf8"));
    if (Date.now() - c.at < 12 * 3600 * 1000 && Array.isArray(c.data) && c.data.length) return c.data;
  } catch { /* chưa có */ }
  try {
    const j = await (await fetch(V + "/news/staff/search-for-dropdown?limit=10000&sort=staff_id", { headers: { authorization: token }, signal: AbortSignal.timeout(60000) })).json();
    const data = j.data || j.rows || [];
    if (data.length) try { fs.writeFileSync(CACHE_DB, JSON.stringify({ at: Date.now(), data })); } catch { /* best-effort */ }
    return data;
  } catch { try { return JSON.parse(fs.readFileSync(CACHE_DB, "utf8")).data || []; } catch { return []; } }
}

/* ---- API con ---- */
const H = (token) => ({ authorization: token, origin: "https://work.hasaki.vn", referer: "https://work.hasaki.vn/" });
async function capNhat(token, id, field, cap) {   // mass-update-field (khuôn FormData đã đo 22/09)
  const fd = new FormData();
  fd.set("id", String(id)); fd.set("field", field);
  for (const [k, v] of Object.entries(cap)) fd.set(k, v);
  const r = await fetch(V + "/hr/projects/mass-update-field-task-input", { method: "POST", body: fd, headers: H(token), signal: AbortSignal.timeout(30000) });
  let j = null; try { j = JSON.parse(await r.text()); } catch { /* HTML lỗi */ }
  return { ok: r.status === 200 && j && j.status === 1, http: r.status };
}
/* 05/10: B1.1 BẮT BUỘC ảnh bangchung11 — thiếu thì đóng bị 422 "Vui lòng cập nhật dữ liệu cấu hình!" (3 phiếu kẹt 26/09–05/10).
   User 05/10: bằng chứng khắc phục khi máy tự ghi lỗi = ẢNH CHỤP BÌNH LUẬN NHẮC (người nhắc, giờ nhắc, nội dung). */
const fmtVN = (ms) => { const d = new Date(ms + 7 * 36e5).toISOString(); return d.slice(8, 10) + "/" + d.slice(5, 7) + "/" + d.slice(0, 4) + " " + d.slice(11, 16); };
export async function anhBinhLuanNhac(token, taskId) {
  let ds = []; try { ds = (((await (await fetch(V + "/v2/task/comment?obj_id=" + taskId, { headers: { authorization: token }, signal: AbortSignal.timeout(20000) })).json()).data) || []); } catch { return null; }
  const c = ds.find((x) => coDauHieu(String(x.comment || "").replace(/\r\n/g, "\n"))); if (!c) return null;
  const esc = (x) => String(x).replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[m]);
  const txt = esc(String(c.comment).replace(/@\[([^\]]+)\]\(user_id:\d+\)/g, "@$1")).replace(/\r?\n/g, "<br>");
  const ten = esc((c.user && c.user.name) || "Lê Chí Tâm"), m = String(c.created_at || "").match(/^(\d{4})-(\d\d)-(\d\d) (\d\d:\d\d)/), luc = (String(c.comment).match(/nhắc lúc ([0-9/]+ [0-9:]+)\)/) || [])[1] || (m ? m[3] + "/" + m[2] + "/" + m[1] + " " + m[4] : "");   // 05/10: ưu tiên GIỜ NHẮC GỐC ghi trong câu
  const html = '<meta charset=utf-8><body style="margin:0;background:#fff;font:15px Arial;color:#111"><div style="padding:16px 18px;width:760px">' +
    '<div style="font-weight:bold;font-size:16px;margin-bottom:6px">Trao đổi · bình luận nhắc</div><div style="border:1px solid #ddd;border-radius:8px;padding:12px 14px">' +
    '<div><b>' + ten + '</b> <span style="color:#666">· ' + luc + '</span></div><div style="margin-top:8px;line-height:1.5">' + txt + '</div></div>' +
    '<div style="color:#666;font-size:12px;margin-top:8px">https://work.hasaki.vn/tasks?task_id=' + taskId + '</div></div></body>';
  const { EDGE_PATH } = await import("./token-store.js"); const puppeteer = (await import("puppeteer")).default;
  const b = await puppeteer.launch({ headless: true, executablePath: EDGE_PATH });
  try { const pg = await b.newPage(); await pg.setViewport({ width: 800, height: 300 }); await pg.setContent(html); return await pg.screenshot({ fullPage: true, type: "png" }); }
  finally { await b.close().catch(() => {}); }
}
async function napBangChung11(token, b11id, taskId) {
  const png = await anhBinhLuanNhac(token, taskId).catch(() => null); if (!png) return false;
  const fd = new FormData(); fd.set("id", String(b11id)); fd.set("field", "data");
  fd.append("value[configs][bangchung11][]", new Blob([png], { type: "image/png" }), "binh-luan-nhac-" + taskId + ".png");
  const r = await fetch(V + "/hr/projects/mass-update-field-task-input", { method: "POST", body: fd, headers: H(token), signal: AbortSignal.timeout(120000) });
  let j = null; try { j = JSON.parse(await r.text()); } catch { } return r.status === 200 && j && j.status === 1;
}
/* DỪNG PHIẾU đúng như nút web "Hủy và điều hướng → Dừng" (user chốt 29/09; đánh cha status 6 là SAI —
 * bước con vẫn treo, cha kẹt Failed không trả về được). Đo 29/09: POST re-create-step/{bước treo}
 * {"workflow_step_id":"-1"} ⇒ huỷ bước (4) + finish cha (2), không sinh bước mới ("0" thì SINH bước kế — cấm).
 * Rồi ghi lý do vào lịch sử (data.note_failed) như web. Trả true khi đọc lại: cha 2 + không còn bước treo. */
async function dungPhieu(token, id, lyDo) {
  const d = await docTask(token, id);
  if (!d) return false;
  const treo = (d.subtasks || []).filter((s) => [0, 1].includes(Number(s.status)));
  if (treo.length !== 1) { log("   ⚠ dừng phiếu: " + treo.length + " bước treo (cần đúng 1) — bỏ qua, xem tay."); return false; }
  const b = treo[0];
  try {
    await fetch(V + "/hr/projects/re-create-step/" + b.id, { method: "POST", signal: AbortSignal.timeout(30000),
      headers: { ...H(token), "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ workflow_step_id: "-1" }) });
  } catch { /* xác nhận bằng đọc lại */ }
  await new Promise((r) => setTimeout(r, 1200));
  const luc = new Date(Date.now() + 7 * 36e5).toISOString().replace("T", " ").slice(0, 19);
  await capNhat(token, b.id, "data", { "value[note_failed]": JSON.stringify([{ note_failed: lyDo, staff_name: "Lê Chí Tâm", staff_code: "233135", created_at: luc }]) });
  const d2 = await docTask(token, id);
  return !!(d2 && Number(d2.status) === 2 && !(d2.subtasks || []).some((s) => [0, 1].includes(Number(s.status))));
}
const docTask = async (token, id) => { try { return (await (await fetch(V + "/hr/projects/task-input/" + id, { headers: { authorization: token, accept: "application/json" }, signal: AbortSignal.timeout(30000) })).json()).data; } catch { return null; } };
async function docBinhLuan(token, id) {
  try {
    const r = await fetch(V + "/v2/task/comment?obj_id=" + id, { headers: { authorization: token }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    const t = await r.text(); if (t[0] !== "{") return null;
    const j = JSON.parse(t);
    // máy chủ lưu xuống dòng thành \r\n → chuẩn về \n để so khớp câu vừa gửi (không thì tưởng hỏng, đăng lại)
    return (Array.isArray(j.data) ? j.data : []).map((c) => String(c.comment || c.content || "").replace(/\r\n/g, "\n"));
  } catch { return null; }
}
async function guiBinhLuan(token, id, text) {     // dạng "form obj_id+comment" + xác nhận GET (khuôn bo-sung-sku-comment)
  for (const them of [{}, { obj_type: "task" }]) {
    const fd = new FormData();
    fd.set("obj_id", String(id)); fd.set("comment", text);
    for (const [k, v] of Object.entries(them)) fd.set(k, v);
    try { await fetch(V + "/v2/task/comment", { method: "POST", body: fd, headers: H(token), signal: AbortSignal.timeout(20000) }); } catch { /* xác nhận bằng GET */ }
    await new Promise((r) => setTimeout(r, 800));
    const ds = await docBinhLuan(token, id);
    if (ds && ds.some((x) => x.includes(text))) return true;   // xác nhận bằng CHÍNH câu vừa gửi
  }
  return false;
}

(async () => {
  // 14/10 «chạy ra sao, của task nào» → tab Máy trạm (lượt thật)
  const TD = THU ? null : await import("./tien-do.mjs");
  TD?.batDau("canh-b11", "Đọc board phiếu 5S");
  const token = await layTokenSongWork(DIR, log);
  if (!token) { log("✗ Không có token work sống — dừng."); process.exitCode = 1; return; }
  // KHOÁ GHI: cò này ĐÓNG B1.1 (ghi) → chỉ chạy khi token là tamlc; token mượn người khác → dừng (không ghi nhầm tên).
  if (!laTokenGhiDuoc(token)) { log("⛔ Token KHÔNG phải tamlc (mượn phiên người khác) — DỪNG để không ghi nhầm danh tính."); process.exitCode = 75; return; }
  const db = await layDanhBa(token);
  const byCode = new Map(), byTen = new Map();
  for (const x of db) { if (x.code) byCode.set(String(x.code), x); if (x.staff_name) byTen.set(boDau(x.staff_name), x); }

  let so = { nhac: {}, nhom: {}, b31: {}, b32: {}, tv: {}, dgB1: {}, fail: {}, qltt: {}, b3huy: {} };
  try { so = { ...so, ...JSON.parse(fs.readFileSync(F_SO, "utf8")) }; } catch { /* lần đầu */ }
  for (const k of ["tv", "dgB1", "b32", "fail", "qltt", "b3huy", "hen72", "leo", "chuoi", "ghiPhat", "nhacGoc", "ho", "bui", "cam"]) if (!so[k]) so[k] = {};
  let nguonTV = null;   // 4 tab GAS — chỉ nạp khi thật sự có task cần truy vết

  const iso = (d) => d.toISOString().slice(0, 10);
  /* 26/09: mặc định 120 ngày — thẻ treo dashboard đọc cả task già hơn 45 ngày (3 task 06→07/2026
     chưa từng lọt board 45 ngày nên không được nhắc); vẫn 1 lượt GET, chỉ payload to hơn. */
  const SO_NGAY = Number(process.env.B11_SO_NGAY || 120);
  const from = iso(new Date(Date.now() - SO_NGAY * 864e5)), to = iso(new Date(Date.now() + 864e5));
  const r = await fetch(V + "/hr/workflows/detail-workflow-task/" + WF + "?from_date=" + from + "&to_date=" + to + "&search_type=board", { headers: { authorization: token }, signal: AbortSignal.timeout(120000) });
  if (!r.ok) { log("✗ board HTTP " + r.status); process.exitCode = 1; return; }
  const rows = ((await r.json()).data || {}).rows || [];
  log("board: " + rows.length + " task (" + from + " → " + to + ")" + (THU ? " — DIỄN TẬP" : ""));
  /* 05/10: ảnh chụp gọn B1.1 cho dashboard "Nhắc QLTT" (0 lượt gọi thêm — dùng board vừa đọc) */
  try {
    const anh = [];
    for (const t of rows) {
      const ds = (t.subtasks || []).filter((s) => Number(s.workflow_step_id) === 7826); if (!ds.length) continue;
      const b1 = (t.subtasks || []).filter((s) => Number(s.workflow_step_id) === 7379).pop() || {};
      const c1 = (b1.data && b1.data.configs) || {}, cc = (t.data && t.data.configs) || {};
      for (const b of ds) { const c = (b.data && b.data.configs) || {};
        anh.push({ id: t.id, code: t.code, cha: t.status, bin: cc.BIN00 || "", loi: cc.TYPE00 || "", ngayVP: cc.DATE00 || "", b11: b.id, st: b.status, giao: b.created_at, xong: b.finished_at || "",
          xn: [].concat(c.xacnhan11 || [])[0] || "", gt: [].concat(c.giaitrinh11 || [])[0] || "", nv: String(c1.staff || ""), ql: c1.QLBP02 || "",
          cam: (b.staff || []).map((x) => (x.info && x.info.staff_name) || "").filter(Boolean) }); }
    }
    fs.writeFileSync(path.join(DIR, ".exports", "b11-anh-chup.json"), JSON.stringify({ luc: new Date().toISOString(), b11: anh }));
  } catch (e) { log("⚠ ghi ảnh chụp B1.1: " + e.message); }

  /* Vòng B1→B1.1 có thể LẶP (B1.1 bị huỷ → engine mở lại B1): lấy bản MỚI NHẤT chưa huỷ,
   * không phải bản đầu — bản đầu có thể là B1.1 đã huỷ/B1 không ghi staff làm ③ câm
   * (đo thật 26/09: task 13569058, B3.1 13903599 phải điền tay). */
  const sub = (t, stepId) => {
    const ds = (t.subtasks || []).filter((s) => String(s.workflow_step_id) === String(stepId)).sort((a, b) => a.id - b.id);
    return ds.filter((s) => Number(s.status) !== 4).pop() || ds.pop();
  };
  const now = Date.now();

  /* LUẬT 14 NGÀY — CHỐT Ở ③ (user chốt 28/09): KPI trừ thật phát sinh khi B3.x có tên NV, nên chặn
     cả ở đây (phiếu đóng B1 tay / trước luật cũng bị bắt). Phiếu vệ sinh hằng ngày: đã có phiếu SỚM
     HƠN cùng vị trí + cùng NV trong 14 ngày được ghi nhận (B1 có NV, cha chưa huỷ/fail, B1.1 không chốt
     "Không phải lỗi cá nhân") → KHÔNG điền B3, fail phiếu sau kèm link phiếu đầu. */
  const khoaCache = new Map();
  const khoaCua = async (t) => {
    if (!khoaCache.has(t.id)) {
      if (!nguonTV) nguonTV = await napNguonTruyVet(log).catch(() => null);
      const c = (t.data && t.data.configs) || {};
      const kq = nguonTV && truyVet(nguonTV, c.BIN00, c.DATE00 || t.created_at || "");
      khoaCache.set(t.id, (kq && kq.khoa) || String(c.BIN00 || "").trim());
    }
    return khoaCache.get(t.id);
  };
  /* Phiếu ĐÃ KHÉP: Huỷ/Thất bại, HOẶC bị DỪNG (29/09: dừng ⇒ cha status 2 "Finished" mà KHÔNG có B3.1/B3.2
     hoàn thành — không phải ghi nhận thật). Mọi luật (14 ngày, truy vết, nhắc, B3) phải coi như phiếu chết. */
  const daKhep = (t) => [4, 6].includes(Number(t.status)) || !!so.fail[t.id] ||
    (Number(t.status) === 2 && !(t.subtasks || []).some((x) => [7381, 7392].includes(Number(x.workflow_step_id)) && Number(x.status) === 2));
  /* 29/09 user sửa LUẬT 14 NGÀY → 7 NGÀY + thêm CÙNG LỖI: cùng vị trí + cùng người + cùng lỗi (hạng mục) chỉ
     ghi nhận 1 lần trong vòng 7 ngày (ngày ghi nhận = ngày 1 … ngày 7 ⇒ chênh < 7); sang ngày thứ 8 mà vẫn
     sai phạm (chưa chia việc / chưa báo cáo / vẫn dơ) thì GHI NHẬN LẠI. Lý do: nghỉ dài nhắc ngày 4, 5,
     trừ KPI ngày 6, ngày 7 ngưng — không trừ nhiều lần cho cùng 1 vấn đề trong 1 tuần. */
  const CUA_SO = Number(process.env.B11_CUA_SO || 7);
  const trongCuaSo = (a, b) => Math.abs((new Date(a) - new Date(b)) / 864e5) < CUA_SO;
  const loaiCua = (t) => String(((t.data && t.data.configs) || {}).TYPE00 || "").replace(/\s+/g, " ").trim().toLowerCase();
  const DAU_CS = "không ghi nhận lại trong " + CUA_SO + " ngày", DAU_CS_CU = ["không ghi nhận lại trong 14 ngày"];
  const ngayCua = (t) => String(((t.data && t.data.configs) || {}).DATE00 || t.created_at || "").slice(0, 10);
  const truocDo14 = async (t, codesT) => {
    const cT = (t.data && t.data.configs) || {};
    if (!laHangMucVeSinhHangNgay(cT.TYPE00) || !cT.BIN00) return null;
    const kT = await khoaCua(t), nT = ngayCua(t);
    for (const u of rows) {
      if (u.id === t.id || daKhep(u)) continue;
      const cU = (u.data && u.data.configs) || {};
      if (!laHangMucVeSinhHangNgay(cU.TYPE00) || !cU.BIN00) continue;
      const nU = ngayCua(u);
      if (!(nU < nT || (nU === nT && u.id < t.id)) || !trongCuaSo(nT, nU) || loaiCua(u) !== loaiCua(t)) continue;
      const b1U = sub(u, 7379), b11U = sub(u, 7826);
      if (!(b1U && b1U.status === 2)) continue;
      const cdU = String((b1U.data && b1U.data.configs && b1U.data.configs.staff) || "").split(",").map((s) => s.trim());
      if (!codesT.some((c) => cdU.includes(c))) continue;
      const xnU = String((b11U && b11U.data && b11U.data.configs && b11U.data.configs.xacnhan11) || "").trim();
      if (b11U && b11U.status === 2 && xnU && xnU !== "Lỗi cá nhân") continue;
      if (await khoaCua(u) === kT) return { id: u.id, ngay: nU };
    }
    return null;
  };
  let nNhac = 0, nNhom = 0, nB31 = 0, nTV = 0, nFail = 0, nQLTT = 0, nDongB1 = 0, nHuyB3 = 0, nLeo = 0;
  const dsVeSinh = [];   // mọi phiếu "vệ sinh hằng ngày cuối ca" chưa Canceled/Failed — nguyên liệu luật ⑤

  let iTD = 0;
  for (const t of rows) {
    TD?.tienDo({ buoc: "Soát phiếu 5S (B1.1 · B3 · vệ sinh)", task: t.id, i: ++iTD, n: rows.length, chiTiet: String(t.code || "") });
    const b1 = sub(t, 7379), b11 = sub(t, 7826), b31 = sub(t, 7381);

    /* ═══ ④ TRUY VẾT VỆ SINH cho task CŨ còn mở (user duyệt 25/09 — xem truy-vet-vesinh.mjs) ═══
       Lỗi "vệ sinh hằng ngày cuối ca" (mọi vị trí): B1/B1.1 đang mở + Mô tả chưa có khối
       → ghép khối truy vết vào Mô tả. (Phần buộc trách nhiệm/đóng B1 đã chuyển xuống luật ⑤.) */
    const cfgCha = (t.data && t.data.configs) || {};
    if (laHangMucVeSinhHangNgay(cfgCha.TYPE00) && cfgCha.BIN00 && !daKhep(t))
      dsVeSinh.push({ t, b1, b11 });
    if (laHangMucVeSinhHangNgay(cfgCha.TYPE00) && cfgCha.BIN00 && Number(t.status) === 0 &&
        ((b1 && b1.status === 0) || (b11 && b11.status === 0))) {
      let kq = null;
      const layKq = async () => {
        if (kq) return kq;
        if (!nguonTV) nguonTV = await napNguonTruyVet(log).catch(() => null);
        kq = nguonTV && truyVet(nguonTV, cfgCha.BIN00, cfgCha.DATE00 || t.created_at || "");
        return kq;
      };
      /* (a) khối Mô tả */
      if (!so.tv[t.id]) {
        const dChiTiet = await docTask(token, t.id);
        const noteCu = String((dChiTiet && dChiTiet.note) || "");
        if (noteCu.includes(DAU_TRUY_VET)) { so.tv[t.id] = Date.now(); }
        else if (await layKq()) {
          nTV++;
          log("④ " + t.code + ": ghép truy vết vệ sinh vào Mô tả (vị trí " + cfgCha.BIN00 + ", ngày xét " + kq.ngayXet + ")");
          if (!THU) {
            const rN = await capNhat(token, t.id, "note", { value: noteCu + kq.html });
            const d2 = await docTask(token, t.id);
            if (rN.ok && String((d2 && d2.note) || "").includes(DAU_TRUY_VET)) { so.tv[t.id] = Date.now(); log("   ✓ đã ghi Mô tả."); }
            else log("   ⚠ ghi Mô tả chưa chốt được (HTTP " + rN.http + ") — thử lượt sau.");
          }
        }
      }
    }
    /* Cha Canceled/Failed = phiếu đã khép (28/09: fail hồi tố 4 phiếu, máy chủ chặn huỷ B1.1 con
       → B1.1 còn "mở" mồ côi). Không nhắc / phạt 72h / giao lại / điền B3 trên phiếu đã khép. */
    if (daKhep(t)) continue;
    const cfgB1 = (b1 && b1.data && b1.data.configs) || {};
    const codes =String(cfgB1.staff || "").split(",").map((s) => s.trim()).filter(Boolean);
    const nvs = codes.map((c) => byCode.get(c)).filter(Boolean);

    /* ═══ ② ≥2 NV → B1.1 "mỗi thành viên" + gán đủ người (chỉ khi B1.1 còn mở) ═══ */
    if (b11 && b11.status === 0 && codes.length >= 2 && !so.nhom[t.id]) {
      const dangCam = (b11.staff || []).map((x) => String((x.info && x.info.code) || "")).filter(Boolean);
      const thieu = codes.filter((c) => !dangCam.includes(c));
      const canMode = Number(b11.sub_type) !== 1;
      if (thieu.length || canMode) {
        nNhom++;
        log("② " + t.code + " (B1.1 " + b11.id + "): " + codes.length + " NV" + (thieu.length ? " · gán thêm " + thieu.join(",") : "") + (canMode ? " · sub_type " + b11.sub_type + "→1 (mỗi thành viên)" : ""));
        if (!THU) {
          if (thieu.length) {
            const ids = nvs.map((x) => String(x.staff_id)).filter(Boolean).join(",");
            if (ids) await capNhat(token, b11.id, "assign_staff", { value: ids });
          }
          if (canMode) await capNhat(token, b11.id, "sub_type", { value: "1" });
          const d2 = await docTask(token, b11.id);   // đọc lại để chốt (bài học 21/09: 200 mà không ghi)
          if (d2 && Number(d2.sub_type) === 1) { so.nhom[t.id] = Date.now(); log("   ✓ B1.1 đã bật Mỗi thành viên, " + (d2.staff || []).length + " người."); }
          else log("   ⚠ đọc lại sub_type=" + (d2 && d2.sub_type) + " — chưa chốt được, sẽ thử lượt sau.");
        }
      } else so.nhom[t.id] = Date.now();
    }

    /* ═══ ②b B1.1 PHẢI NẰM TRONG TAY NV VI PHẠM (user chốt 28/09) ═══
       Engine work giao B1.1 cho QUẢN LÝ của NV (đo thật: 13889960 NV Phương → B1.1 ở tay Huyền).
       B1.1 còn mở mà người cầm ≠ danh sách NV vi phạm ở B1 → giao lại đúng NV (assign_staff THAY
       danh sách, đã đo 28/09), đọc lại chốt. Mốc phạt 72h (nếu có) tính lại từ lúc giao đúng. */
    if (b11 && b11.status === 0 && codes.length && nvs.length === codes.length) {
      const dangCam = (b11.staff || []).map((x) => String((x.info && x.info.code) || "")).filter(Boolean);
      const lech = dangCam.some((c) => !codes.includes(c)) || codes.some((c) => !dangCam.includes(c));
      if (lech) {
        log("②b " + t.code + " (B1.1 " + b11.id + "): đang ở tay " + (b11.staff || []).map((x) => x.info && x.info.staff_name).join(", ") +
          " ≠ NV vi phạm " + nvs.map((x) => x.staff_name).join(", ") + " → giao lại");
        if (!THU) {
          await capNhat(token, b11.id, "assign_staff", { value: nvs.map((x) => String(x.staff_id)).join(",") });
          const d2 = await docTask(token, b11.id);
          const sau = ((d2 && d2.staff) || []).map((x) => String((x.info && x.info.code) || ""));
          if (sau.length === codes.length && codes.every((c) => sau.includes(c))) {
            b11.staff = d2.staff;
            if (so.hen72[t.id]) so.hen72[t.id] = Date.now();
            log("   ✓ B1.1 đã về tay đúng NV vi phạm.");
          } else log("   ⚠ đọc lại chưa đúng (" + sau.join(",") + ") — thử lượt sau.");
        }
      }
    }

    /* ═══ ① B1.1 treo >48h → tag QLTT (chỉ nghiệp vụ PTCH/Đóng gói kho 170) ═══ */
    if (b11 && b11.status === 0 && !so.nhac[t.id]) {
      const tuoiH = (now - new Date(String(b11.created_at).replace(" ", "T") + "+07:00").getTime()) / 36e5;
      if (tuoiH > TREO_GIO) {
        const nvOk = nvs.filter((x) => String(x.working_loc_id) === LOC_KHO170 && MAJOR_OK.includes(boDau(x.staff_major)));
        if (!nvs.length) { /* B1 không ghi NV — không biết nhắc ai, để yên */ }
        else if (!nvOk.length) log("① " + t.code + ": treo " + Math.round(tuoiH) + "h nhưng NV (" + nvs.map((x) => x.staff_major).join(",") + ") KHÔNG thuộc PTCH/Đóng gói kho 170 — không tag.");
        else {
          const qlttTen = String(cfgB1.QLBP02 || "").trim();
          const ql = qlttTen ? byTen.get(boDau(qlttTen)) : null;
          if (!ql || !ql.user_id) log("① " + t.code + ": treo " + Math.round(tuoiH) + "h, QLTT «" + (qlttTen || "trống") + "» không tra được user_id — không tag, cần xem tay.");
          else {
            const mNV = nvOk.map((x) => "@[" + x.staff_name + "](user_id:" + x.user_id + ")").join(", ");
            const text = "@[" + ql.staff_name + "](user_id:" + ql.user_id + ") Nhờ anh/chị nhắc " + mNV +
              " " + DAU_HIEU + " (nhắc lúc " + fmtVN(now) + ") — đã treo " + Math.round(tuoiH / 24) + " ngày (quá hạn " + TREO_GIO + "h).\n" + CAU_72H;   // 05/10 user: ghi giờ nhắc để sửa/ghi đè về sau vẫn đối chiếu được
            nNhac++;
            log("① " + t.code + " (task " + t.id + "): treo " + Math.round(tuoiH) + "h → tag " + ql.staff_name + " nhắc " + nvOk.map((x) => x.staff_name).join(", "));
            if (THU) log("   [thư nháp] " + text);
            else {
              const cu = await docBinhLuan(token, t.id);
              if (cu && cu.some(coDauHieu)) { so.nhac[t.id] = so.hen72[t.id] = Date.now(); so.nhacGoc[t.id] ||= Date.now(); log("   = đã có bình luận nhắc từ trước — chỉ ghi sổ."); }
              else if (await guiBinhLuan(token, t.id, text)) { so.nhac[t.id] = so.hen72[t.id] = Date.now(); so.nhacGoc[t.id] ||= Date.now(); log("   ✓ đã đăng bình luận tag QLTT."); }
              else log("   ⚠ đăng bình luận không xác nhận được — sẽ thử lượt sau.");
            }
          }
        }
      }
    }

    /* ═══ ①b QUÁ 72h SAU NHẮC mà NV không phản hồi → TỰ GHI "Lỗi cá nhân" + đóng B1.1 (user chốt 26/09) ═══
       Mốc = so.hen72 (lúc câu cảnh báo 72h có mặt trong bình luận; task nhắc trước 26/09 được bổ sung
       câu cảnh báo + đặt mốc tay). Đọc TƯƠI B1.1 trước khi ghi: NV đã điền xacnhan11 (kể cả "Không
       phải lỗi cá nhân") hoặc đã đóng = CÓ phản hồi → không đụng, xoá mốc để im lặng. */
    if (b11 && b11.status === 0 && so.hen72[t.id] && !so.leo[t.id] && nvs.length) {
      if (now - so.hen72[t.id] > PHAT_GIO * 3600e3) {
        const dT = await docTask(token, b11.id);
        const xnTuoi = String((dT && dT.data && dT.data.configs && dT.data.configs.xacnhan11) || "").trim();
        if (!dT) log("①b " + t.code + ": không đọc được B1.1 " + b11.id + " — thử lượt sau.");
        else if (Number(dT.status) !== 0 || (xnTuoi && !so.ghiPhat[t.id])) { delete so.hen72[t.id]; log("①b " + t.code + ": NV đã phản hồi (status " + dT.status + ", xác nhận «" + xnTuoi + "») — không tự ghi."); }
        else {
          nLeo++;
          const mNV = nvs.map((x) => x.user_id ? "@[" + x.staff_name + "](user_id:" + x.user_id + ")" : x.staff_name).join(", ");
          const vet = "Quá " + PHAT_GIO + "h sau nhắc lúc " + fmtVN(so.nhacGoc[t.id] || so.nhac[t.id] || so.hen72[t.id]) + " không phản hồi: ghi nhận Lỗi cá nhân cho " + mNV + ".";
          log("①b " + t.code + " (B1.1 " + b11.id + "): quá " + Math.round((now - so.hen72[t.id]) / 36e5) + "h không phản hồi → tự ghi Lỗi cá nhân + đóng B1.1 cho " + nvs.map((x) => x.staff_name).join(", "));
          if (THU) log("   [thử] " + vet);
          else {
            so.ghiPhat[t.id] = Date.now();   // dấu "máy ghi" — lượt sau thấy xacnhan11 thì biết là của máy, đóng tiếp chứ không coi là NV phản hồi
            const rX = await capNhat(token, b11.id, "data", { "value[configs][xacnhan11]": "Lỗi cá nhân" });
            const coAnh = [].concat((dT.data && dT.data.configs && dT.data.configs.bangchung11) || []).length;
            if (!coAnh && !(await napBangChung11(token, b11.id, t.id))) log("   ⚠ nạp ảnh bình luận nhắc (bằng chứng B1.1) trượt");
            await capNhat(token, b11.id, "status", { value: "2" });
            const d2 = await docTask(token, b11.id);
            const xn2 = String((d2 && d2.data && d2.data.configs && d2.data.configs.xacnhan11) || "").trim();
            if (d2 && Number(d2.status) === 2 && xn2 === "Lỗi cá nhân") {
              so.leo[t.id] = Date.now();
              log("   ✓ đã ghi Lỗi cá nhân + đóng B1.1.");
              const cu = await docBinhLuan(token, t.id);
              if (!(cu && cu.some((x) => x.includes("tự động ghi nhận LỖI CÁ NHÂN") || x.includes("sau nhắc không phản hồi: ghi nhận Lỗi cá nhân"))) &&
                  !(await guiBinhLuan(token, t.id, vet))) log("   ⚠ bình luận ghi vết không xác nhận được (B1.1 vẫn đã đóng).");
            } else log("   ⚠ chưa chốt (đọc lại status=" + (d2 && d2.status) + ", xacnhan11=«" + xn2 + "», HTTP ghi " + rX.http + ") — thử lượt sau.");
          }
        }
      }
    }

    /* ═══ ③ B1.1 xong (đủ TỪNG thành viên) → điền "Nhân viên vi phạm" vào B3.1/B3.2 rồi CHỈ LƯU ═══
       25/09: B3.2 (step 7392 "Ghi nhận vi phạm quy định kho tổng") có schema Y HỆT B3.1 — cùng 5 ô,
       4 ô auto, chỉ ô staff nhập tay và khác tên khoá (staff32 thay NVVP04) → áp CHUNG một luật. */
    const b32 = sub(t, 7392);
    let cacB3 = [[b31, "NVVP04", "b31", "B3.1"], [b32, "staff32", "b32", "B3.2"]]
      .filter(([b, , sk]) => b && b.status === 0 && !so[sk][t.id]);
    /* NHÁNH ĐÚP (đo thật 25/09 — task 13162758 bị trừ 2+5 cho 1 lỗi 2%): vài hạng mục (STT06)
       làm engine mở CẢ B3.1 lẫn B3.2. User chốt 25/09 (đã báo quản trị wf, đây là lưới đỡ tạm):
       chọn nhánh ĐÚNG theo % tab QUY-DINH — lỗi 2% → điền B3.1, lỗi 5% → điền B3.2 — và HUỶ nhánh
       SAI còn mở. Huỷ nhánh B3 không hại luồng (2 phiếu lịch sử: B4.1 vẫn chạy, cha vẫn XONG);
       máy chủ có cầu dao riêng ("Không thể cancel task!") → huỷ trượt thì log nhờ người huỷ tay.
       % khác 2/5 hoặc không tra được → không tự xử. */
    let dongLuonId = null;   // phiếu bug 2 nhánh: nhánh ĐÚNG được phép TỰ ĐÓNG sau khi điền (user chốt 25/09 chiều)
    if (b31 && b32 && b31.status !== 4 && b32.status !== 4) {
      const pc = await layPhanTramQD(cfgCha.TYPE00, log);
      const dungLa31 = pc === "2", dungLa32 = pc === "5";
      if (!dungLa31 && !dungLa32) {
        log("③ " + t.code + ": mở cả B3.1+B3.2 nhưng %QUY-DINH của hạng mục = «" + (pc || "không tra được") + "» — không tự xử, cần người chọn nhánh.");
        cacB3 = [];
      } else {
        const sai = dungLa31 ? b32 : b31, saiTen = dungLa31 ? "B3.2" : "B3.1";
        dongLuonId = (dungLa31 ? b31 : b32).id;
        cacB3 = cacB3.filter(([b]) => b !== sai);
        if (sai.status === 2) {
          /* bác bản ghi thừa: POST /hr/staff/history/save {id, rejected_at, rejected_by} (đo 26/09,
             khuôn nút reject của hr.hasaki.vn) — bác xong ghi sổ b3huy[sai.id] để im các lượt sau. */
          if (!so.b3huy[sai.id]) log("③ " + t.code + ": ⚠ CẢ HAI nhánh B3 đã đóng — ĐÃ TRỪ ĐÚP, cần bác bản ghi thừa ở Staff History (không tự xử được).");
        } else if (sai.status === 0 && !so.b3huy[sai.id]) {
          log("③ " + t.code + ": hạng mục " + pc + "% → nhánh đúng " + (dungLa31 ? "B3.1" : "B3.2") + " · HUỶ nhánh thừa " + saiTen + " (id " + sai.id + ")");
          if (!THU) {
            const rH = await capNhat(token, sai.id, "status", { value: "4" });
            const d2 = await docTask(token, sai.id);
            if (d2 && Number(d2.status) === 4) { so.b3huy[sai.id] = Date.now(); nHuyB3++; log("   ✓ đã huỷ " + saiTen + "."); }
            else log("   ⚠ huỷ bị chặn (đọc lại status=" + (d2 && d2.status) + ", HTTP " + rH.http + ") — cầu dao máy chủ, cần người huỷ tay trên web.");
          }
        }
      }
    }
    /* chốt 14 ngày chạy NGAY khi NV chốt "Lỗi cá nhân" ở B1.1 (trước B2/B3 — đỡ QLTT giải trình phiếu thừa), hoặc khi B3 đã mở (QLTT ở B2 xác nhận lỗi thay NV) */
    const xnB11 = String((b11 && b11.data && b11.data.configs && b11.data.configs.xacnhan11) || "").trim();
    let g14 = null;
    if (b11 && b11.status === 2 && (xnB11 === "Lỗi cá nhân" || cacB3.length) && codes.length && !so.fail[t.id] &&
        !(b31 && b31.status === 2) && !(b32 && b32.status === 2) && (g14 = await truocDo14(t, codes))) {
        nB31++;
        const txt = "Vị trí này đã ghi nhận vi phạm ngày " + g14.ngay.slice(8, 10) + "/" + g14.ngay.slice(5, 7) +
          ": https://work.hasaki.vn/tasks?task_id=" + g14.id + " — " + DAU_CS + " (cùng vị trí, cùng người, cùng lỗi).";
        log("③ " + t.code + " (task " + t.id + "): TRÙNG " + CUA_SO + " ngày với task " + g14.id + " (cùng vị trí + cùng NV + cùng lỗi) → KHÔNG điền B3, fail phiếu");
        if (!THU) {
          const cu = await docBinhLuan(token, t.id);
          if ((cu && cu.some((x) => [DAU_CS, ...DAU_CS_CU].some((d) => x.includes(d)))) || await guiBinhLuan(token, t.id, txt)) {
            if (await dungPhieu(token, t.id, txt)) { so.fail[t.id] = Date.now(); log("   ✓ đã DỪNG phiếu (luật " + CUA_SO + " ngày)."); }
            else log("   ⚠ dừng phiếu chưa chốt — thử lượt sau.");
          } else log("   ⚠ bình luận lý do chưa xác nhận — chưa fail, thử lượt sau.");
        }
      continue;
    }
    if (cacB3.length && b11 && b11.status === 2 && codes.length) {
      /* GATE "LỖI CÁ NHÂN" (user chốt 24/09 chiều): ô xacnhan11 của B1.1. Giá trị khác
         ("Không phải lỗi cá nhân") → không điền, ghi sổ để im lặng các lượt sau. */
      const xacNhan = String((b11.data && b11.data.configs && b11.data.configs.xacnhan11) || "").trim();
      const mem = new Map((b11.staff || []).map((x) => [String((x.info && x.info.code) || ""), x.status]));
      let chuaXong = codes.filter((c) => mem.get(c) !== 2);
      /* 05/10 LUẬT ③b "THEO QUẢN LÝ CHỐT" (user): NV chọn "Không phải lỗi cá nhân" mà B3 VẪN MỞ ⇒ quản lý đã chốt
         ngược ở B2 (ô CNF03) / B4 (ô CNF05). MỌI kết luận quản lý = "Lỗi cá nhân" → điền NV như thường (ca 13394098:
         B2 Bằng chốt Lỗi cá nhân). B2 "Không" rồi B4 đảo "Có" → KHÔNG tự xử, log nhờ người (2 ca 05/10 user chọn
         dừng phiếu «Nhắc nhở»). Không có kết luận quản lý nào → giữ luật cũ 24/09: người ghi nhận tự xử. */
      const ketLuanQL = (t.subtasks || []).filter((s) => [7380, 7382].includes(Number(s.workflow_step_id)) && Number(s.status) === 2)
        .sort((a, b) => a.id - b.id)
        .map((s) => { const c = (s.data && s.data.configs) || {}; return { buoc: Number(s.workflow_step_id) === 7380 ? "B2" : "B4", kl: String([].concat(c.CNF03 || c.CNF05 || [])[0] || "").trim() }; })
        .filter((x) => x.kl);
      let quaGate = xacNhan === "Lỗi cá nhân", nguon = "NV xác nhận";
      if (!quaGate && xacNhan && ketLuanQL.length) {
        if (ketLuanQL.every((x) => x.kl === "Lỗi cá nhân")) { quaGate = true; nguon = ketLuanQL.map((x) => x.buoc).join("+") + " quản lý chốt Lỗi cá nhân"; }
        else { for (const [, , sk] of cacB3) so[sk][t.id] = Date.now(); log("③b " + t.code + ": NV «" + xacNhan + "», quản lý chốt lẫn lộn (" + ketLuanQL.map((x) => x.buoc + "=" + x.kl).join(", ") + ") — KHÔNG tự điền, người ghi nhận quyết (điền NV hay dừng «Nhắc nhở»)."); }
      }
      /* 05/10 LUẬT ③c "QUẢN LÝ XÁC NHẬN HỘ = HỢP LỆ" (user): quản lý tự thêm mình vào B1.1, điền "Lỗi cá nhân" rồi đóng
         bước thay NV (ca 13186674: Bằng, log xacnhan11 mang mã 230442 ∉ NV) ⇒ miễn gate đủ-từng-người. Nhận diện bằng
         NGƯỜI GHI ô xacnhan11 (data.logs — 1 GET task-input, nhớ sổ so.ho) không nằm trong danh sách NV ở B1; thiếu log
         thì nhận khi có thành viên ngoài danh sách NV đã Finished. */
      if (quaGate && chuaXong.length && !so.leo[t.id] && !so.ho[t.id]) {
        const dB11 = await docTask(token, b11.id);
        const lg = dB11 && dB11.data && dB11.data.logs && dB11.data.logs.xacnhan11;
        const nguoiGhi = String((lg && lg.staff_code) || "");
        const memNgoai = ((dB11 && dB11.staff) || b11.staff || []).find((x) => !codes.includes(String((x.info && x.info.code) || "")) && Number(x.status) === 2);
        if (nguoiGhi && !codes.includes(nguoiGhi)) so.ho[t.id] = { boi: nguoiGhi + " " + ((lg && lg.staff_name) || ""), luc: Date.now() };
        else if (!nguoiGhi && memNgoai) so.ho[t.id] = { boi: String((memNgoai.info && memNgoai.info.code) || "") + " " + ((memNgoai.info && memNgoai.info.staff_name) || ""), luc: Date.now() };
      }
      if (quaGate && chuaXong.length && so.ho[t.id]) { chuaXong = []; nguon = "quản lý " + so.ho[t.id].boi + " xác nhận hộ ở B1.1"; }
      if (!quaGate) {
        if (xacNhan && !ketLuanQL.length) { for (const [, , sk] of cacB3) so[sk][t.id] = Date.now(); log("③ " + t.code + ": NV xác nhận «" + xacNhan + "» (không phải lỗi cá nhân), chưa có kết luận quản lý — KHÔNG tự điền B3.x, để người ghi nhận xử."); }
        else if (!xacNhan) log("③ " + t.code + ": B1.1 đóng nhưng ô Xác nhận lỗi còn trống — chờ.");
      } else if (chuaXong.length && !so.leo[t.id]) {   // ①b đóng hộ sau 72h im lặng → miễn gate từng-người
        log("③ " + t.code + ": B3.x chờ vì " + chuaXong.length + "/" + codes.length + " NV chưa tự hoàn thành B1.1 (" + chuaXong.join(",") + ") — theo luật đợi đủ từng người.");
      } else for (const [b3, key, sk, ten] of cacB3) {
        const daCo = String((b3.data && b3.data.configs && b3.data.configs[key]) || "").trim();
        if (daCo) { so[sk][t.id] = Date.now(); continue; }
        nB31++;
        log("③ " + t.code + " (" + ten + " " + b3.id + "): điền " + key + " = " + codes.join(",") + " (chỉ lưu, không đóng bước) · căn cứ: " + nguon);
        if (!THU) {
          const rW = await capNhat(token, b3.id, "data", { ["value[configs][" + key + "]"]: codes.join(",") });
          const d2 = await docTask(token, b3.id);
          const sau = String((d2 && d2.data && d2.data.configs && d2.data.configs[key]) || "");
          if (rW.ok && sau === codes.join(",")) {
            so[sk][t.id] = Date.now(); log("   ✓ đã lưu Nhân viên vi phạm vào " + ten + ".");
            /* phiếu bug 2 nhánh: nhánh đúng TỰ ĐÓNG luôn để khép luồng, khỏi chờ người
               (user chốt 25/09 chiều: "đã biết lỗi này rồi thì để nó tự đóng"). */
            if (String(b3.id) === String(dongLuonId)) {
              await capNhat(token, b3.id, "status", { value: "2" });
              const d3 = await docTask(token, b3.id);
              if (d3 && Number(d3.status) === 2) log("   ✓ đã TỰ ĐÓNG " + ten + " (phiếu 2 nhánh — đã biết lỗi).");
              else log("   ⚠ tự đóng " + ten + " chưa chốt (status=" + (d3 && d3.status) + ") — người ghi nhận đóng giúp.");
            }
          }
          else log("   ⚠ ghi xong đọc lại " + key + "=«" + sau + "» — chưa chốt, thử lượt sau.");
        }
      }
    }
  }

  /* ═══ ⑤ PHÁN XỬ B1 TREO — lỗi "vệ sinh hằng ngày cuối ca" (user chốt 25/09 chiều) ═══
     Chạy SAU vòng chính, trên dsVeSinh (mọi phiếu hạng mục này chưa Canceled/Failed):
     (1) TRÙNG LƯU TRÌNH: cùng NGÀY ghi nhận + cùng PHỤ TRÁCH kệ → giữ phiếu SỚM NHẤT, các phiếu
         sau còn mở FAIL với lý do đúng khuôn user (không thêm không bớt):
         «Trùng lưu trình khai báo vi phạm trước đó <link phiếu đầu>».
     (2) Phụ trách CÓ đi làm ngày xét → đóng B1 → B1.1 (luật ④b cũ chuyển về đây).
     (3) Nghỉ NGẮN (1–2 ngày) + KHÔNG ai báo cáo vị trí trong ngày xét → FAIL:
         «Nhân sự phụ trách vệ sinh quầy kệ không đi làm ngày dd/MM».
     (4) Nghỉ DÀI (≥3 ngày liên tiếp) / ĐÃ NGHỈ VIỆC (≥14 ngày không quay lại) → ghi nhận vi phạm
         cho QUẢN LÝ TRỰC TIẾP (không chia nhân sự vệ sinh kịp thời) — B1 đóng với NV vi phạm = QLTT,
         QLBP02 = cấp trên của QLTT (sub-leader đóng gói → Hà Trọng Thúc Bằng, truyền --qltt).
     FAIL task = bình luận lý do + dungPhieu() (29/09: KHÔNG còn set cha status 6) — luôn đọc lại chốt. */
  const dmyVN = (isoD) => isoD ? isoD.slice(8, 10) + "/" + isoD.slice(5, 7) : "?";
  const congNgay = (s, d) => { const x = new Date(s + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };
  const cachNgay = (a, b) => Math.round((new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / 864e5);
  const homNay = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);   // ngày VN
  /* Lý do KHÔNG điền vào Mô tả — điền ở BÌNH LUẬN (user chốt 25/09 chiều, sau khi phiếu fail
     không xem được Mô tả). Link trong nội dung workflow hiển thị bằng CHÍNH URL, cấm mã HSK-…. */
  const failTask = async (t, dau, lyDoBinhLuan, lyDoLog) => {
    log("⑤ " + t.code + " (task " + t.id + "): FAIL — " + lyDoLog);
    if (THU) { log("   [thử] chưa ghi gì."); return false; }
    const cu = await docBinhLuan(token, t.id);
    if (cu && cu.some((x) => x.includes(dau))) { /* đã có bình luận lý do */ }
    else if (!(await guiBinhLuan(token, t.id, lyDoBinhLuan))) {
      log("   ⚠ đăng bình luận lý do không xác nhận được — chưa fail, thử lượt sau.");
      return false;
    }
    if (!(await dungPhieu(token, t.id, lyDoBinhLuan))) {
      log("   ⚠ dừng phiếu chưa chốt — thử lượt sau.");
      return false;
    }
    so.fail[t.id] = Date.now(); log("   ✓ đã DỪNG phiếu (Hủy & điều hướng → Dừng, cha finish) + bình luận lý do.");
    return true;
  };
  const dongB1Bang = async (t, maNV, qlttOverride) => {   // đóng B1 bằng tool đã kiểm chứng
    try {
      const { execFileSync } = await import("node:child_process");
      const args = [path.join(DIR, "auto-complete-single-task.mjs"), "--task=" + t.id, "--nv=" + maNV];
      if (qlttOverride) args.push("--qltt=" + qlttOverride);
      args.push("--lam");
      const out = execFileSync(process.execPath, args, { cwd: DIR, timeout: 180000, encoding: "utf8" });
      log("   " + out.trim().split(/\r?\n/).slice(-2).join(" | ").slice(0, 180));
      return /ĐÓNG B1 XONG/.test(out);
    } catch (e) { log("   ⚠ đóng B1 trượt: " + String(e.message).slice(0, 120) + " — thử lượt sau."); return false; }
  };

  /* 07/10 — VS-07: gọi camera-bao-cao.mjs (tải đầu ghi top-review, không AI) cho phiếu có báo cáo trong 8h; tối đa CAM_MAX phiếu/lượt. */
  const CAM_MAX = Number(process.env.B11_CAM_MAX || 2);
  let nCam = 0, nBui = 0;
  const camBaoCao = async (t, kq) => {
    try {
      const { execFileSync } = await import("node:child_process");
      const bc = kq.bcPtGanNhat;
      const args = [path.join(DIR, "camera-bao-cao.mjs"), "--task=" + t.id, "--luc=" + bc.ngay + " " + bc.gio + ":00", "--req=" + bc.req, "--nv=" + kq.phuTrach.ten];
      /* 08/10 (user: «gán camera mà không thông qua AI»): B11_CAM_KHONG_AI=1 → camera-bao-cao --khong-ai --clip: cắt đúng kênh + cửa sổ giờ nộp,
         không mô hình, không kết luận → gắn PIC02/video02 vào B1 (KHÔNG đóng B1), anh Tâm xem clip rồi quyết. Ưu tiên hơn B11_CAM_TU_DONG. */
      /* 08/10 B11_CAM_AI = khong | gemini | (trống = mô hình COCO như 07/10). B11_CAM_KHONG_AI=1 là tên cũ của "khong".
         gemini: Gemini đọc lô khung → khung đỏ bám bbox Gemini + kết luận theo giây hành động; gắn ảnh/clip vào B1 (không đóng) trừ khi «chỉ chụp» + B11_CAM_TU_DONG=1. */
      const CAM_AI = String(process.env.B11_CAM_AI || (Number(process.env.B11_CAM_KHONG_AI || 0) === 1 ? "khong" : "")).toLowerCase();
      if (CAM_AI === "khong") args.push("--khong-ai", "--clip");
      else if (CAM_AI === "gemini") args.push("--gemini", "--clip");
      else if (Number(process.env.B11_CAM_TU_DONG || 0) === 1) args.push("--clip");   // 07/10: clip chỉ dựng khi máy được phép gắn (QC 14079520: khung đỏ dán nhầm người đi ngang)
      const out = execFileSync(process.execPath, args, { cwd: DIR, timeout: 25 * 60e3, encoding: "utf8", windowsHide: true });
      log("   " + out.trim().split(/\r?\n/).slice(-2).join(" | ").slice(0, 200));
    } catch (e) { log("   ⚠ camera-bao-cao: " + String(e.message).slice(0, 160)); }
    try { return JSON.parse(fs.readFileSync(path.join(DIR, ".exports", "cam-baocao", String(t.id), "ket-qua.json"), "utf8")); } catch { return null; }
  };
  const ganBangChungB1 = async (b1id, taskId, kc) => {   // QC-01: xoá trắng rồi nạp, đọc lại thấy đủ mới tin
    try {
      const { execFileSync } = await import("node:child_process");
      for (const [key, f] of [["PIC02", kc.anh], ["video02", kc.clip]]) {
        const out = execFileSync(process.execPath, [path.join(DIR, "_thay-file-phieu.mjs"), String(b1id), key, f, "--lam"], { cwd: DIR, timeout: 22 * 60e3, encoding: "utf8", windowsHide: true });
        log("   " + out.trim().split(/\r?\n/).pop().slice(0, 160));
      }
      const d = await docTask(token, taskId); const b = ((d && d.subtasks) || []).find((s) => String(s.id) === String(b1id)); const cf = (b && b.data && b.data.configs) || {};
      return [].concat(cf.PIC02 || []).some((x) => /ANH-3-MOC/.test(x)) && [].concat(cf.video02 || []).some((x) => /CLIP-(CHUAN|CAMERA)/.test(x));   // CLIP-CAMERA = bản không AI (08/10)
    } catch (e) { log("   ⚠ gắn bằng chứng: " + String(e.message).slice(0, 120)); return false; }
  };
  const cauCamTam = (kc, bc, bin) => {
    /* 07/10 user: luật ngầm (camera giờ báo cáo, số phút có người) KHÔNG ghi lên phiếu — số đo chỉ ở dashboard nội bộ (vesinh-xet.json + cam-baocao). */
    return "@[Lê Chí Tâm](user_id:18811) " + DAU_NHAC_BUI + " " + bin + " trước khi xác minh.";
  };

  const canXuLy = dsVeSinh.filter((x) => x.b1 && x.b1.status === 0 && Number(x.t.status) === 0 &&
    !so.fail[x.t.id] && !so.dgB1[x.t.id] && !so.qltt[x.t.id]);
  if (canXuLy.length) {
    if (!nguonTV) nguonTV = await napNguonTruyVet(log).catch(() => null);
    if (!nguonTV) log("⑤ không nạp được nguồn truy vết — bỏ lượt phán xử.");
    else {
      const kqCua = new Map();
      const layKQ = (x) => {
        if (!kqCua.has(x.t.id)) {
          const c = (x.t.data && x.t.data.configs) || {};
          kqCua.set(x.t.id, truyVet(nguonTV, c.BIN00, c.DATE00 || x.t.created_at || ""));
        }
        return kqCua.get(x.t.id);
      };
      /* (1) nhóm trùng: xét trên MỌI phiếu vệ sinh (kể cả B1 đã đóng — phiếu đầu có thể đã xử) */
      const nhomTrung = new Map();
      for (const x of dsVeSinh) {
        const kq = layKQ(x);
        if (!kq || !kq.phuTrach) continue;
        const c = (x.t.data && x.t.data.configs) || {};
        const td = String(c.DATE00 || x.t.created_at || "");
        const k = td.slice(0, 10) + "|" + kq.phuTrach.code;
        if (!nhomTrung.has(k)) nhomTrung.set(k, []);
        nhomTrung.get(k).push({ ...x, td, kq });
      }
      const daThuFail = new Set();   // đã THỬ fail lượt này (kể cả trượt) → không rơi xuống nhánh khác
      for (const [k, ds] of nhomTrung) {
        if (ds.length < 2) continue;
        ds.sort((a, b) => a.td.localeCompare(b.td) || a.t.id - b.t.id);
        const dau = ds[0];
        for (const x of ds.slice(1)) {
          if (!(x.b1 && x.b1.status === 0 && Number(x.t.status) === 0) || so.fail[x.t.id]) continue;
          nFail++; daThuFail.add(x.t.id);
          const link = "https://work.hasaki.vn/tasks?task_id=" + dau.t.id;
          await failTask(x.t, "Trùng lưu trình khai báo vi phạm trước đó",
            "Trùng lưu trình khai báo vi phạm trước đó " + link,
            "trùng với task " + dau.t.id + " (cùng ngày " + k.slice(0, 10) + ", cùng phụ trách " + x.kq.phuTrach.ten + ")");
        }
      }
      /* LUẬT 14 NGÀY (user chốt 28/09): cùng VỊ TRÍ + cùng NGƯỜI CHỊU chỉ ghi nhận KPI trừ 1 lần
         trong 14 ngày (tính theo ngày vi phạm) — mục đích: không trừ nhiều lần cho 1 vấn đề liên tiếp.
         "Đã ghi nhận" = phiếu vệ sinh B1 đã đóng có NV (kể cả người đóng tay), trừ ca B1.1 đã chốt
         "Không phải lỗi cá nhân" (không bị trừ thật thì không được che phiếu sau).
         Vị trí = khoá truy vết (A1 gom mức KỆ, như bảng phân công). */
      const ngayVP = (x) => String(((x.t.data && x.t.data.configs) || {}).DATE00 || x.t.created_at || "").slice(0, 10);
      const ghiNhan = [];   // {khoa, code, ngay, id}
      for (const x of dsVeSinh) {
        if (!(x.b1 && x.b1.status === 2)) continue;
        const xn = String((x.b11 && x.b11.data && x.b11.data.configs && x.b11.data.configs.xacnhan11) || "").trim();
        if (x.b11 && x.b11.status === 2 && xn && xn !== "Lỗi cá nhân") continue;
        const kq = layKQ(x);
        const khoa = (kq && kq.khoa) || String(((x.t.data && x.t.data.configs) || {}).BIN00 || "").trim();
        for (const code of String(((x.b1.data && x.b1.data.configs) || {}).staff || "").split(",").map((s) => s.trim()).filter(Boolean))
          ghiNhan.push({ khoa, code, ngay: ngayVP(x), id: x.t.id, loai: loaiCua(x.t) });
      }
      const daGhiNhan14 = (khoa, code, ngay, id, loai) => ghiNhan.find((g) => g.khoa === khoa && g.code === String(code) &&
        g.id !== id && g.loai === loai && Math.abs(cachNgay(g.ngay, ngay)) < CUA_SO);
      const DAU_14 = DAU_CS;
      const fail14 = (x, g) => failTask(x.t, DAU_14,
        "Vị trí này đã ghi nhận vi phạm ngày " + dmyVN(g.ngay) + ": https://work.hasaki.vn/tasks?task_id=" + g.id + " — " + DAU_14 + ".",
        "đã ghi nhận cùng vị trí + cùng người + cùng lỗi ngày " + g.ngay + " (task " + g.id + ") — luật " + CUA_SO + " ngày");

      /* 07/10: ẢNH CHỤP XÉT VỆ SINH cho dashboard Xác minh (bang-591 đọc .exports/vesinh-xet.json — 0 lượt gọi thêm):
         từng phiếu B1 còn mở: phụ trách · báo cáo gần nhất · cách bao nhiêu giờ · trong/ngoài cửa sổ bụi · máy đã làm gì (bui/cam/dgB1/fail/qltt) */
      const XET = {};
      const ghiXet = (x, kq, hanhDong, them) => { const c = (x.t.data && x.t.data.configs) || {}; const bc = kq && kq.bcPtGanNhat;
        XET[x.t.id] = Object.assign({ code: x.t.code, bin: c.BIN00 || "", ngayVP: c.DATE00 || "", loi: c.TYPE00 || "", phuTrach: kq && kq.phuTrach ? { ma: kq.phuTrach.code, ten: kq.phuTrach.ten } : null,
          ketLuan: kq ? kq.ketLuan : "", ngayXet: kq ? kq.ngayXet : "", bc: bc ? { ngay: bc.ngay, gio: bc.gio, req: bc.req } : null, cachGioBc: kq && kq.cachGioBc != null ? Math.round(kq.cachGioBc * 10) / 10 : null,
          trongCuaSoBui: !!(kq && kq.trongCuaSoBui), cuaSoGio: CUA_SO_BUI_GIO, hanhDong, bui: so.bui[x.t.id] || null, cam: so.cam[x.t.id] || null, dgB1: so.dgB1[x.t.id] || null }, them || {}); };
      const luuXet = () => { try { fs.writeFileSync(path.join(DIR, ".exports", "vesinh-xet.json"), JSON.stringify({ luc: new Date().toISOString(), thu: THU, phieu: XET })); } catch (e) { log("⚠ ghi vesinh-xet: " + e.message); } };
      /* (2)(3)(4) từng phiếu còn mở chưa bị fail trùng */
      const soQL = docSoQLTT(DIR);
      const QL_CAP_TREN = new Map([["ho ngoc tu uyen", "Hà Trọng Thúc Bằng"], ["le thi ngoc huyen", "Hà Trọng Thúc Bằng"]]);
      for (const x of canXuLy) {
        if (so.fail[x.t.id] || so.dgB1[x.t.id] || so.qltt[x.t.id] || daThuFail.has(x.t.id)) continue;
        const kq = layKQ(x), c = (x.t.data && x.t.data.configs) || {};
        if (!kq) continue;
        if (!kq.phuTrach) { ghiXet(x, kq, "khong-phan-cong"); log("⑤ " + x.t.code + ": vị trí «" + c.BIN00 + "» không tra được phụ trách — để người xác minh."); continue; }
        ghiXet(x, kq, kq.suyNV ? (kq.trongCuaSoBui ? "camera" : kq.ketLuan === "chua_dat" ? "bui" : "dong-b1") : kq.ketLuan);
        if (kq.suyNV) {   /* (2) đi làm mà không báo cáo / vệ sinh chưa đạt */
          const nhan = kq.ketLuan === "chua_dat" ? "VỆ SINH CHƯA ĐẠT (có báo cáo mà vẫn bẩn)" : "KHÔNG báo cáo";
          const g14 = daGhiNhan14(kq.khoa, kq.suyNV, ngayVP(x), x.t.id, loaiCua(x.t));
          if (g14) { nFail++; await fail14(x, g14); continue; }
          /* ═══ 07/10 (user) — CỬA SỔ BỤI 8h + CAMERA GIỜ BÁO CÁO (chỉ khi phụ trách CÓ báo cáo) ═══
             VS-07: báo cáo gần nhất của phụ trách trong 8h trước ghi nhận → camera-bao-cao.mjs tra đúng giờ báo cáo:
                    «chi-chup» (có mặt tại kệ ngắn, chỉ chụp ảnh) → gắn ảnh 3 mốc + clip chuẩn vào B1 rồi đóng B1 → B1.1;
                    «co-thao-tac» / không thấy / chưa rõ → bình luận nhờ anh Tâm kiểm tra thực tế (sổ so.cam), phiếu ở lại B1.
             VS-06: có báo cáo (ngày xét) nhưng cách ghi nhận > 8h → kho bụi, không buộc máy → bình luận nhờ anh Tâm (sổ so.bui).
             Không báo cáo (VS-02) → giữ luật cũ: đóng B1 với ảnh vi phạm. */
          if (kq.trongCuaSoBui) {
            const bc = kq.bcPtGanNhat;
            if (so.cam[x.t.id] && (so.cam[x.t.id].xong || (so.cam[x.t.id].ketLuan && so.cam[x.t.id].ketLuan !== "chi-chup"))) continue;   // đã xử / đã nhắc anh Tâm
            if (nCam >= CAM_MAX) { log("⑤ " + x.t.code + ": báo cáo " + bc.ngay + " " + bc.gio + " trong " + CUA_SO_BUI_GIO + "h — chờ lượt sau (đã chạy " + nCam + " camera)."); continue; }
            nCam++;
            log("⑤ " + x.t.code + " (task " + x.t.id + "): phụ trách " + kq.phuTrach.ten + " báo cáo " + bc.ngay + " " + bc.gio + " cách ghi nhận " + Math.round(kq.cachGioBc * 10) / 10 + "h (trong " + CUA_SO_BUI_GIO + "h) → camera giờ báo cáo (VS-07)");
            if (THU) { log("   [thử] sẽ chạy camera-bao-cao.mjs --task=" + x.t.id); continue; }
            const kc = await camBaoCao(x.t, kq);
            if (!kc) { log("   ⚠ camera-bao-cao không ra kết quả — thử lượt sau."); continue; }
            so.cam[x.t.id] = { ...(so.cam[x.t.id] || {}), ketLuan: kc.ketLuan, luc: Date.now(), coMat: kc.coMatGiay || 0 };
            /* ═══ 08/10 KHÔNG AI (user: «gán camera mà không thông qua AI») ═══
               kc.khongAI: ảnh 3 mốc + clip cắt theo giờ nộp (không mô hình, không kết luận) → thay PIC02/video02 của B1 (Hình ảnh bằng chứng = camera,
               đúng yêu cầu 07/10), phiếu Ở LẠI B1, bình luận nhờ anh Tâm xem clip. Máy không đóng B1 trong nhánh này. */
            const dongDuoc = kc.ketLuan === "chi-chup" && kc.anh && kc.clip && Number(process.env.B11_CAM_TU_DONG || 0) === 1;
            /* 08/10 Gemini: cùng cách gắn như không AI (ảnh 3 mốc + clip khung đỏ bám bbox Gemini) khi không được tự đóng; không có clip (bám chưa nhất quán) → chỉ nhờ anh Tâm. */
            if ((kc.khongAI || kc.ai === "gemini") && !dongDuoc) {
              if (kc.khongAI && !(kc.anh && kc.clip)) { log("   ⚠ chưa có ảnh/clip camera (không AI) — thử lượt sau."); delete so.cam[x.t.id]; continue; }
              if (kc.anh && kc.clip && !so.cam[x.t.id].ganB1) {
                const ok = await ganBangChungB1(x.b1.id, x.t.id, kc);
                if (!ok) { log("   ⚠ chưa gắn được ảnh/clip camera lên B1 — thử lượt sau."); delete so.cam[x.t.id]; continue; }
                so.cam[x.t.id].ganB1 = Date.now(); log("   ✓ đã gắn ảnh 3 mốc + clip camera lúc nộp báo cáo vào B1 (" + (kc.khongAI ? "không AI" : "Gemini " + kc.ketLuan) + ", không đóng B1).");
              } else if (!kc.clip) log("   Gemini " + kc.ketLuan + " nhưng không có clip (bám người chưa nhất quán) → chỉ nhờ anh Tâm.");
              const cau = cauCamTam(kc, bc, c.BIN00) + (so.cam[x.t.id].ganB1 ? " Đã gắn clip camera lúc báo cáo vệ sinh vào bước B1." : "");
              const cu = await docBinhLuan(token, x.t.id);
              if (cu && cu.some((y) => y.includes(DAU_NHAC_BUI))) { log("   = đã có bình luận nhờ anh Tâm — chỉ ghi sổ."); continue; }
              if (await guiBinhLuan(token, x.t.id, cau)) log("   ✓ đã bình luận nhờ anh Tâm xem clip camera.");
              else { log("   ⚠ bình luận không xác nhận được — thử lượt sau (ảnh/clip đã gắn, không gắn lại)."); so.cam[x.t.id].ketLuan = ""; }
              continue;
            }
            /* 07/10: cổng B11_CAM_TU_DONG (mặc định 0) — máy CHƯA được tự đóng B1 theo «chỉ chụp» cho tới khi có ≥3 án lệ camera đúng
               (ca đầu 14079520: đo điểm ảnh ra 205 s mà vùng trống). Chưa bật → cũng nhờ anh Tâm, kèm số giây máy đo. */
            if (kc.ketLuan === "chi-chup" && kc.anh && kc.clip && Number(process.env.B11_CAM_TU_DONG || 0) === 1) {
              const ok = await ganBangChungB1(x.b1.id, x.t.id, kc);
              if (!ok) { log("   ⚠ chưa gắn được ảnh/clip camera lên B1 — không đóng, thử lượt sau."); delete so.cam[x.t.id]; continue; }
              nDongB1++;
              log("   camera: NV chỉ có mặt " + kc.coMatGiay + " s tại kệ lúc nộp báo cáo → đóng B1 mở B1.1 (bằng chứng = camera)");
              if (await dongB1Bang(x.t, kq.suyNV)) { so.dgB1[x.t.id] = Date.now(); so.cam[x.t.id].xong = true; }
              else delete so.cam[x.t.id];
              ghiNhan.push({ khoa: kq.khoa, code: String(kq.suyNV), ngay: ngayVP(x), id: x.t.id });
              continue;
            }
            const cau = cauCamTam(kc, bc, c.BIN00);
            const cu = await docBinhLuan(token, x.t.id);
            if (cu && cu.some((y) => y.includes(DAU_NHAC_BUI))) { log("   = đã có bình luận nhờ anh Tâm — chỉ ghi sổ."); continue; }
            if (await guiBinhLuan(token, x.t.id, cau)) log("   ✓ đã bình luận nhờ anh Tâm kiểm tra thực tế (" + kc.ketLuan + ", " + (kc.coMatGiay || 0) + " s).");
            else { log("   ⚠ bình luận không xác nhận được — thử lượt sau."); delete so.cam[x.t.id]; }
            continue;
          }
          if (kq.ketLuan === "chua_dat") {
            if (so.bui[x.t.id]) continue;
            nBui++;
            const cau = cauNhacBui(kq, c.BIN00, c.DATE00 || x.t.created_at || "");
            log("⑤ " + x.t.code + " (task " + x.t.id + "): báo cáo gần nhất " + kq.bcPtGanNhat.ngay + " " + kq.bcPtGanNhat.gio + " cách ghi nhận " + Math.round(kq.cachGioBc) + "h (quá " + CUA_SO_BUI_GIO + "h, kho bụi) → KHÔNG chuyển B1.1, nhờ anh Tâm kiểm tra thực tế (VS-06)");
            if (THU) { log("   [thư nháp] " + cau); continue; }
            const cu = await docBinhLuan(token, x.t.id);
            if (cu && cu.some((y) => y.includes(DAU_NHAC_BUI))) { so.bui[x.t.id] = Date.now(); log("   = đã có bình luận nhờ anh Tâm — chỉ ghi sổ."); }
            else if (await guiBinhLuan(token, x.t.id, cau)) { so.bui[x.t.id] = Date.now(); log("   ✓ đã bình luận tag anh Tâm."); }
            else log("   ⚠ bình luận không xác nhận được — thử lượt sau.");
            continue;
          }
          nDongB1++;
          log("⑤ " + x.t.code + ": phụ trách " + kq.suyNV + " đi làm ngày " + kq.ngayXet + " — " + nhan + " → đóng B1 mở B1.1" +
            (kq.khopMo ? " (mã «" + c.BIN00 + "» khớp mờ → " + kq.khoa + ")" : ""));
          if (!THU) { if (await dongB1Bang(x.t, kq.suyNV)) so.dgB1[x.t.id] = Date.now(); else continue; }
          ghiNhan.push({ khoa: kq.khoa, code: String(kq.suyNV), ngay: ngayVP(x), id: x.t.id });   // phiếu sau trong lượt này cũng thấy
          continue;
        }
        if (kq.ketLuan === "nghi_ngan") {   /* (3) nghỉ ngắn */
          if (kq.coBaoCaoNgayXet) { log("⑤ " + x.t.code + ": phụ trách nghỉ " + kq.nghi.run + " ngày nhưng CÓ người khác báo cáo ngày xét — để người xác minh."); continue; }
          const lyDo = "Nhân sự phụ trách vệ sinh quầy kệ không đi làm ngày " + dmyVN(kq.ngayXet);
          nFail++;
          await failTask(x.t, "không đi làm ngày " + dmyVN(kq.ngayXet), lyDo,
            lyDo + " (" + kq.phuTrach.ten + " nghỉ " + kq.nghi.run + " ngày)");
          continue;
        }
        if (kq.ketLuan === "nghi_dai" || kq.ketLuan === "nghi_viec") {   /* (4) QLTT — nhắc ngày 4, 5 · trừ ngày 6 */
          /* CHUỖI NGHỈ (user chốt 28/09, sửa mốc 4-5-6 cùng ngày): tính từ ngày nghỉ đầu S của phụ trách, trên VỊ TRÍ (không
             phải từng phiếu). Chưa ai báo cáo vị trí từ S (KỂ CẢ người ngoài bảng phân công):
               ngày 4 → bình luận tag QLTT · ngày 5 → nhắc lần 2 · ngày 6 → ghi nhận KPI trừ QLTT.
             Mốc sau cách mốc trước ≥1 ngày (chuỗi phát hiện muộn vẫn đủ 2 lần nhắc trước khi trừ).
             Có người báo cáo, hoặc phụ trách đi làm lại trước ngày 6 → phiếu fail như nghỉ ngắn, không trừ.
             Nhiều phiếu cùng chuỗi: chỉ phiếu SỚM NHẤT còn mở nhận bình luận/trừ; sổ so.chuoi theo chuỗi. */
          const dauNghi = (k) => k.nghi.lamCuoi ? congNgay(k.nghi.lamCuoi, 1) : k.ngayXet;
          const S = dauNghi(kq), ngay6 = congNgay(S, 5), ck = kq.khoa + "|" + S;
          const nhanPT = kq.phuTrach.ten + " (" + kq.phuTrach.code + ") " + (kq.ketLuan === "nghi_viec" ? "đã nghỉ việc" : "nghỉ");
          const coBC = nguonTV.ls.some((b) => b.khoa === kq.khoa && b.ngay >= S && b.ngay <= homNay);
          const daVe = kq.nghi.lamLai && kq.nghi.lamLai <= ngay6;
          if (coBC || daVe) {
            if (kq.coBaoCaoNgayXet) { log("⑤ " + x.t.code + ": phụ trách nghỉ nhưng CÓ người khác báo cáo ngày xét — để người xác minh."); continue; }
            const lyDo = "Nhân sự phụ trách vệ sinh quầy kệ không đi làm ngày " + dmyVN(kq.ngayXet);
            nFail++;
            await failTask(x.t, "không đi làm ngày " + dmyVN(kq.ngayXet), lyDo, lyDo + " (" + nhanPT + " từ " + dmyVN(S) + "; " +
              (coBC ? "đã có người báo cáo vị trí" : "đi làm lại " + dmyVN(kq.nghi.lamLai)) + " trước mốc trừ — không trừ QLTT)");
            continue;
          }
          const cungChuoi = canXuLy.filter((y) => { const k = layKQ(y); return k && k.khoa === kq.khoa && k.nghi &&
            ["nghi_dai", "nghi_viec"].includes(k.ketLuan) && dauNghi(k) === S && !so.fail[y.t.id] && !daThuFail.has(y.t.id); })
            .sort((a, b) => ngayVP(a).localeCompare(ngayVP(b)) || a.t.id - b.t.id);
          if (cungChuoi.length && cungChuoi[0].t.id !== x.t.id) { log("⑤ " + x.t.code + ": cùng chuỗi nghỉ với task " + cungChuoi[0].t.id + " — chờ phiếu đầu chuỗi."); continue; }
          const ch = so.chuoi[ck] || {};
          const ngayThu = cachNgay(S, homNay) + 1;
          const nvPT = byCode.get(String(kq.phuTrach.code)) || { code: kq.phuTrach.code, staff_name: kq.phuTrach.ten };
          let q = ch.ql ? { ten: ch.qten, pool: ch.chia ? [1, 2] : [] } : chonQLTTCanBang(nvPT, db, soQL, DIR, false, "tru");   // chốt QLTT từ lần nhắc 1 — sổ lượt RIÊNG cho trừ QLTT
          let ql = ch.ql ? byCode.get(String(ch.ql)) : q && q.ten ? byTen.get(boDau(q.ten)) : null;
          if (!ch.ql && (!ql || !ql.code)) {
            /* NV nghỉ việc thường rơi khỏi sổ/danh bạ → MƯỢN QLTT của các phụ trách CÙNG DÃY KỆ
               (vd F0-A1-502-*) khi mọi hàng xóm map được đều về CHUNG 1 tổ quản lý. */
            const day = String(kq.khoa || "").split("-").slice(0, 3).join("-");
            const cacPool = new Map();
            if (day.includes("-") && nguonTV && nguonTV.pc) for (const [kO, ptO] of nguonTV.pc) {
              if (!kO.startsWith(day + "-") || String(ptO.code) === String(kq.phuTrach.code)) continue;
              const nvO = byCode.get(String(ptO.code)) || { code: ptO.code, staff_name: ptO.ten };
              const qO = chonQLTTCanBang(nvO, db, soQL, DIR, false, "tru");
              if (qO && qO.nhom) cacPool.set(qO.pool.join("|"), qO);   // chỉ nhận hàng xóm map được TỔ thật
            }
            if (cacPool.size === 1) {
              q = [...cacPool.values()][0];
              ql = byTen.get(boDau(q.ten));
              if (ql) log("   (không có sổ QLTT cho " + kq.phuTrach.code + " — mượn tổ quản lý theo dãy " + day + ": " + q.ten + ")");
            }
          }
          if (!ql || !ql.code) { log("⑤ " + x.t.code + ": phụ trách " + kq.phuTrach.ten + " " + (kq.ketLuan === "nghi_viec" ? "đã nghỉ việc" : "nghỉ dài") + " nhưng không tra được mã QLTT («" + ((q && q.ten) || "?") + "») — cần xử tay."); continue; }
          /* bình luận nhắc — gãy gọn, tag QLTT, luôn kèm câu cảnh báo trừ KPI */
          /* 28/09 (user): mọi lần nhắc tag CẢ leader cấp trên của QLTT (Uyên/Huyền → Bằng) */
          const tag = (nv) => nv.user_id ? "@[" + nv.staff_name + "](user_id:" + nv.user_id + ")" : nv.staff_name;
          const lead = byTen.get(boDau(QL_CAP_TREN.get(boDau(ql.staff_name)) || ""));
          const mQL = tag(ql) + (lead && String(lead.code) !== String(ql.code) ? " " + tag(lead) : "");
          const cauTru = (han) => "Nếu đến " + dmyVN(han) + " vẫn không có ai báo cáo, hệ thống sẽ ghi nhận KPI trừ cho Quản lý trực tiếp.";
          const maxNgay = (a, b) => (a > b ? a : b);
          const nhac = async (lan, dau, text) => {
            log("⑤ " + x.t.code + " (task " + x.t.id + "): nghỉ từ " + S + " (ngày thứ " + ngayThu + "), chưa ai báo cáo → nhắc lần " + lan + " " + ql.staff_name);
            if (THU) { log("   [thư nháp] " + text); return; }
            const cu = await docBinhLuan(token, x.t.id);
            if (!(cu && cu.some((b) => b.includes(dau))) && !(await guiBinhLuan(token, x.t.id, text))) { log("   ⚠ đăng bình luận không xác nhận được — thử lượt sau."); return; }
            ch["n" + lan] = homNay;
            if (!ch.ql) {   // chuỗi GIAO cho 1 QLTT từ lần nhắc 1 → cộng lượt ngay để chuỗi kế tiếp sang người kia (chia đều)
              ch.ql = String(ql.code); ch.qten = ql.staff_name; ch.chia = !!(q && q.pool && q.pool.length > 1);
              if (ch.chia) ghiLuot(DIR, ql.staff_name, "tru");
            }
            so.chuoi[ck] = ch; log("   ✓ đã đăng nhắc lần " + lan + ".");
          };
          if (!ch.n1) {
            if (ngayThu < 4) { log("⑤ " + x.t.code + ": " + nhanPT + " từ " + dmyVN(S) + " (ngày thứ " + ngayThu + ") — chờ mốc ngày 4."); continue; }
            const dau = "Vị trí " + kq.khoa + " chưa có ai báo cáo vệ sinh từ " + dmyVN(S);
            nQLTT++;
            await nhac(1, dau, mQL + " " + dau + " (phụ trách " + nhanPT + "). Nhờ anh/chị chia người vệ sinh và báo cáo. " +
              cauTru(maxNgay(ngay6, congNgay(homNay, 2))));
            continue;
          }
          if (!ch.n2) {
            if (ngayThu < 5 || cachNgay(ch.n1, homNay) < 1) { log("⑤ " + x.t.code + ": đã nhắc lần 1 ngày " + dmyVN(ch.n1) + " — chờ mốc nhắc lần 2."); continue; }
            const dau = "Nhắc lần 2: vị trí " + kq.khoa + " vẫn chưa có ai báo cáo vệ sinh từ " + dmyVN(S);
            nQLTT++;
            await nhac(2, dau, mQL + " " + dau + " (phụ trách " + nhanPT + "). " + cauTru(maxNgay(ngay6, congNgay(homNay, 1))));
            continue;
          }
          if (homNay < ngay6 || cachNgay(ch.n2, homNay) < 1) { log("⑤ " + x.t.code + ": đã nhắc lần 2 ngày " + dmyVN(ch.n2) + " — chờ mốc trừ KPI."); continue; }
          const g14 = daGhiNhan14(kq.khoa, ql.code, ngayVP(x), x.t.id, loaiCua(x.t));
          if (g14) { nFail++; await fail14(x, g14); continue; }
          const lyDo = "Ghi nhận cho Quản lý trực tiếp " + ql.staff_name + ": không chia nhân sự vệ sinh kịp thời — vị trí " + kq.khoa +
            " không có ai báo cáo từ " + dmyVN(S) + " đến " + dmyVN(congNgay(homNay, -1)) + " (phụ trách " + nhanPT + "), đã nhắc 2 lần.";
          nQLTT++;
          log("⑤ " + x.t.code + ": " + lyDo + " → đóng B1 với NV vi phạm = " + ql.staff_name + " (" + ql.code + ")");
          if (!THU) {
            /* lý do đăng ở BÌNH LUẬN, không đụng Mô tả (user chốt 25/09 chiều) */
            const cu = await docBinhLuan(token, x.t.id);
            if (!(cu && cu.some((b) => b.includes("không chia nhân sự vệ sinh kịp thời"))) &&
                !(await guiBinhLuan(token, x.t.id, lyDo))) log("   ⚠ đăng bình luận lý do không xác nhận được.");
            const capTren = QL_CAP_TREN.get(boDau(ql.staff_name)) || "";
            if (await dongB1Bang(x.t, String(ql.code), capTren)) {
              so.qltt[x.t.id] = Date.now(); ch.tru = homNay; so.chuoi[ck] = ch;
              ghiNhan.push({ khoa: kq.khoa, code: String(ql.code), ngay: ngayVP(x), id: x.t.id });
            }
          }
          continue;
        }
        log("⑤ " + x.t.code + ": " + kq.ketLuan + " (phụ trách " + kq.phuTrach.ten + ") — để người xác minh.");
      }
      luuXet();
    }
  }

  if (!THU) fs.writeFileSync(F_SO, JSON.stringify(so), "utf8");
  log("XONG — ①tag " + nNhac + " · ①b phạt 72h " + nLeo + " · ②nhóm " + nNhom + " · ③điền B3.x " + nB31 + " / huỷ nhánh thừa " + nHuyB3 +
    " · ④truy vết " + nTV + " · ⑤đóng B1 " + nDongB1 + " / fail " + nFail + " / QLTT " + nQLTT + " / bụi 8h " + nBui + " / camera " + nCam + (THU ? " (diễn tập, chưa ghi gì)" : ""));
  await TD?.xong();
})().catch((e) => { log("LỖI:", e.message); process.exitCode = 1; });
