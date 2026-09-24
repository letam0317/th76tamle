/**
 * ============================================================================
 *  canh-b11.mjs — BỘ CANH B1.1 / B3.1 của workflow 5S (591) — user chốt 24/09/2026
 * ============================================================================
 *  Ba luật, chạy trên MỘT lượt GET board (45 ngày):
 *
 *  ① B1.1 TREO >48h → TAG QUẢN LÝ TRỰC TIẾP (đã nhập ở B1, ô QLBP02) vào bình luận
 *     task, nhờ nhắc NV xác nhận. CHỈ tag khi NV vi phạm thuộc nghiệp vụ
 *     "Phát triển cửa hàng" hoặc "Đóng gói" TẠI KHO 170 (working_loc_id 398) —
 *     tra từ danh bạ wshr. Mention khuôn thật đã soi từ bình luận người dùng:
 *         @[Tên](user_id:<user_id danh bạ>)
 *     Mỗi task CHỈ NHẮC MỘT LẦN: sổ .canh-b11.json + soát marker trong bình luận
 *     trước khi đăng (chống trùng 2 lớp, giống bo-sung-sku-comment.mjs).
 *
 *  ② B1 xác minh ≥2 NV vi phạm → B1.1 phải là "Làm việc nhóm · MỖI THÀNH VIÊN":
 *     - gán đủ MỌI NV vi phạm vào B1.1 (assign_staff),
 *     - đặt field `type` = 3 (đo thật 24/09: mass-update-field field=type nhận 2↔3;
 *       ánh xạ theo bộ ba i18n single/teamWork/everyMember = 1/2/3 của web).
 *     Chỉ đụng khi B1.1 còn MỞ (status 0).
 *
 *  ③ B1.1 xong → TỰ ĐIỀN "Nhân viên vi phạm" (NVVP04) vào B3.1 rồi CHỈ LƯU
 *     (không đóng bước — B3.1 là việc của người ghi nhận). "Xong" theo đúng luật
 *     user: MỌI thành viên của B1.1 đều status 2 (nhiều NV thì đợi đủ từng người);
 *     B1.1 bị đóng hộ mà thành viên chưa xong thì KHÔNG điền, chỉ ghi log.
 *     NVVP04 = mã NV từ B1 (configs.staff), phẩy — khuôn y các phiếu user đã điền tay.
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
import { layTokenSongWork, phutVN } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const V = "https://wshr.hasaki.vn/api";
const WF = process.env.WORKFLOW_ID || "591";
const TREO_GIO = Number(process.env.B11_TREO_GIO || 48);
const LOC_KHO170 = "398";
const MAJOR_OK = ["phat trien cua hang", "dong goi"];   // so KHÔNG DẤU, lowercase
const F_SO = path.join(DIR, ".canh-b11.json");
const MARKER = "(auto-nhắc B1.1)";
const A = process.argv.slice(2);
const THU = A.includes("--thu"), FORCE = A.includes("--force");
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);

/* ---- cửa giờ 07:00–18:00 T2–T7 (đầu main — tick ngoài giờ 0 lượt gọi) ---- */
function trongCua(d = new Date()) {
  const thu = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Ho_Chi_Minh", weekday: "short" }).format(d);
  const p = phutVN(d);
  return thu !== "Sun" && p >= 7 * 60 && p < 18 * 60;
}
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
const docTask = async (token, id) => { try { return (await (await fetch(V + "/hr/projects/task-input/" + id, { headers: { authorization: token, accept: "application/json" }, signal: AbortSignal.timeout(30000) })).json()).data; } catch { return null; } };
async function docBinhLuan(token, id) {
  try {
    const r = await fetch(V + "/v2/task/comment?obj_id=" + id, { headers: { authorization: token }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    const t = await r.text(); if (t[0] !== "{") return null;
    const j = JSON.parse(t);
    return (Array.isArray(j.data) ? j.data : []).map((c) => String(c.comment || c.content || ""));
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
    if (ds && ds.some((x) => x.includes(MARKER))) return true;
  }
  return false;
}

(async () => {
  const token = await layTokenSongWork(DIR, log);
  if (!token) { log("✗ Không có token work sống — dừng."); process.exitCode = 1; return; }
  const db = await layDanhBa(token);
  const byCode = new Map(), byTen = new Map();
  for (const x of db) { if (x.code) byCode.set(String(x.code), x); if (x.staff_name) byTen.set(boDau(x.staff_name), x); }

  let so = { nhac: {}, nhom: {}, b31: {} };
  try { so = { ...so, ...JSON.parse(fs.readFileSync(F_SO, "utf8")) }; } catch { /* lần đầu */ }

  const iso = (d) => d.toISOString().slice(0, 10);
  const from = iso(new Date(Date.now() - 45 * 864e5)), to = iso(new Date(Date.now() + 864e5));
  const r = await fetch(V + "/hr/workflows/detail-workflow-task/" + WF + "?from_date=" + from + "&to_date=" + to + "&search_type=board", { headers: { authorization: token }, signal: AbortSignal.timeout(120000) });
  if (!r.ok) { log("✗ board HTTP " + r.status); process.exitCode = 1; return; }
  const rows = ((await r.json()).data || {}).rows || [];
  log("board: " + rows.length + " task (" + from + " → " + to + ")" + (THU ? " — DIỄN TẬP" : ""));

  const sub = (t, stepId) => (t.subtasks || []).find((s) => String(s.workflow_step_id) === String(stepId));
  const now = Date.now();
  let nNhac = 0, nNhom = 0, nB31 = 0;

  for (const t of rows) {
    const b1 = sub(t, 7379), b11 = sub(t, 7826), b31 = sub(t, 7381);
    const cfgB1 = (b1 && b1.data && b1.data.configs) || {};
    const codes = String(cfgB1.staff || "").split(",").map((s) => s.trim()).filter(Boolean);
    const nvs = codes.map((c) => byCode.get(c)).filter(Boolean);

    /* ═══ ② ≥2 NV → B1.1 "mỗi thành viên" + gán đủ người (chỉ khi B1.1 còn mở) ═══ */
    if (b11 && b11.status === 0 && codes.length >= 2 && !so.nhom[t.id]) {
      const dangCam = (b11.staff || []).map((x) => String((x.info && x.info.code) || "")).filter(Boolean);
      const thieu = codes.filter((c) => !dangCam.includes(c));
      const canType = Number(b11.type) !== 3;
      if (thieu.length || canType) {
        nNhom++;
        log("② " + t.code + " (B1.1 " + b11.id + "): " + codes.length + " NV" + (thieu.length ? " · gán thêm " + thieu.join(",") : "") + (canType ? " · type " + b11.type + "→3 (mỗi thành viên)" : ""));
        if (!THU) {
          if (thieu.length) {
            const ids = nvs.map((x) => String(x.staff_id)).filter(Boolean).join(",");
            if (ids) await capNhat(token, b11.id, "assign_staff", { value: ids });
          }
          if (canType) await capNhat(token, b11.id, "type", { value: "3" });
          const d2 = await docTask(token, b11.id);   // đọc lại để chốt (bài học 21/09: 200 mà không ghi)
          if (d2 && Number(d2.type) === 3) { so.nhom[t.id] = Date.now(); log("   ✓ B1.1 đã ở chế độ nhóm-mỗi-thành-viên, " + (d2.staff || []).length + " người."); }
          else log("   ⚠ đọc lại type=" + (d2 && d2.type) + " — chưa chốt được, sẽ thử lượt sau.");
        }
      } else so.nhom[t.id] = Date.now();
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
              " xác nhận lỗi vi phạm ở bước B1.1 — đã treo " + Math.round(tuoiH / 24) + " ngày (quá hạn " + TREO_GIO + "h). " + MARKER;
            nNhac++;
            log("① " + t.code + " (task " + t.id + "): treo " + Math.round(tuoiH) + "h → tag " + ql.staff_name + " nhắc " + nvOk.map((x) => x.staff_name).join(", "));
            if (THU) log("   [thư nháp] " + text);
            else {
              const cu = await docBinhLuan(token, t.id);
              if (cu && cu.some((x) => x.includes(MARKER))) { so.nhac[t.id] = Date.now(); log("   = đã có bình luận nhắc từ trước — chỉ ghi sổ."); }
              else if (await guiBinhLuan(token, t.id, text)) { so.nhac[t.id] = Date.now(); log("   ✓ đã đăng bình luận tag QLTT."); }
              else log("   ⚠ đăng bình luận không xác nhận được — sẽ thử lượt sau.");
            }
          }
        }
      }
    }

    /* ═══ ③ B1.1 xong (đủ TỪNG thành viên) → điền NVVP04 vào B3.1 rồi CHỈ LƯU ═══ */
    if (b31 && b31.status === 0 && b11 && b11.status === 2 && codes.length && !so.b31[t.id]) {
      const daCo = String((b31.data && b31.data.configs && b31.data.configs.NVVP04) || "").trim();
      if (daCo) { so.b31[t.id] = Date.now(); continue; }
      const mem = new Map((b11.staff || []).map((x) => [String((x.info && x.info.code) || ""), x.status]));
      const chuaXong = codes.filter((c) => mem.get(c) !== 2);
      if (chuaXong.length) { log("③ " + t.code + ": B3.1 chờ vì " + chuaXong.length + "/" + codes.length + " NV chưa tự hoàn thành B1.1 (" + chuaXong.join(",") + ") — theo luật đợi đủ từng người."); continue; }
      nB31++;
      log("③ " + t.code + " (B3.1 " + b31.id + "): điền NVVP04 = " + codes.join(",") + " (chỉ lưu, không đóng bước)");
      if (!THU) {
        const rW = await capNhat(token, b31.id, "data", { "value[configs][NVVP04]": codes.join(",") });
        const d2 = await docTask(token, b31.id);
        const sau = String((d2 && d2.data && d2.data.configs && d2.data.configs.NVVP04) || "");
        if (rW.ok && sau === codes.join(",")) { so.b31[t.id] = Date.now(); log("   ✓ đã lưu Nhân viên vi phạm vào B3.1."); }
        else log("   ⚠ ghi xong đọc lại NVVP04=«" + sau + "» — chưa chốt, thử lượt sau.");
      }
    }
  }

  if (!THU) fs.writeFileSync(F_SO, JSON.stringify(so), "utf8");
  log("XONG — ①tag " + nNhac + " · ②nhóm " + nNhom + " · ③điền B3.1 " + nB31 + (THU ? " (diễn tập, chưa ghi gì)" : ""));
})().catch((e) => { log("LỖI:", e.message); process.exitCode = 1; });
