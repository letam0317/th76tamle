/**
 * ============================================================================
 *  kiem-giai-trinh-ai.mjs — AI KIỂM TRA GIẢI TRÌNH phiếu 5S (WF591) — user chốt 01/10/2026
 * ============================================================================
 *  Ca gốc: 13958704 (A8-506-01, Lê Thị Thu Hương) — NV chốt "Không phải lỗi cá nhân" ở B1.1,
 *  QLTT ghi ở B2 "Nhân viên mới nhận trạm chưa nắm thông tin. Đã hướng dẫn bạn".
 *  User: "cần có AI kiểm tra giải trình, nếu đúng thì dừng điều hướng".
 *
 *  Phiếu được xét: B2 đã xong + CNF03 = "Không phải lỗi cá nhân" + có giải trình + đúng 1 bước còn treo
 *  (B4 / B4.1 / B5 …) + chưa có B3.x hoàn thành (= chưa ghi nhận thật).
 *
 *  AI KHÔNG tin lời giải trình suông: máy gom SỰ THẬT kiểm chứng được rồi mới đưa AI chấm —
 *    · chấm công 60 ngày (ngày làm đầu tiên → NV mới thật không; ngày phiếu có đi làm không),
 *    · lịch sử báo cáo vệ sinh của NV (đã từng báo cáo lần nào chưa),
 *    · camera đóng gói A8 (.packer-a8-ngay.json — đứng bàn nào, ngày nào),
 *    · ảnh bằng chứng NV/QLTT đính kèm (ảnh đen/không liên quan = không có bằng chứng).
 *  Kết luận DUNG + tin cậy ≥ NGUONG → DỪNG điều hướng (re-create-step −1, y nút web) + bình luận lý do.
 *  SAI / CHƯA ĐỦ CĂN CỨ → chỉ bình luận nhận xét 1 lần, để Audit xử như cũ.
 *
 *  Tải upstream: 1 GET board + mỗi phiếu ứng viên 1 GET chi tiết + 1 GET bình luận; ghi chỉ khi --lam.
 *  Nguồn chấm công/lịch sử = tab GAS sẵn có (napNguonTruyVet), camera = file cache — không gọi thêm wms/hr.
 *
 *  Chạy:  node kiem-giai-trinh-ai.mjs                 # DIỄN TẬP: in sự thật + kết luận AI, không ghi
 *         node kiem-giai-trinh-ai.mjs --chi=13958704  # chỉ 1 phiếu
 *         node kiem-giai-trinh-ai.mjs --lam           # làm thật (dừng phiếu / bình luận)
 * ============================================================================
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { layTokenSongWork } from "./session-rules.js";
import { napNguonTruyVet, traPhanCong } from "./truy-vet-vesinh.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const V = "https://wshr.hasaki.vn/api";
const CDN = "https://hr-media.hasaki.vn/production/hr/";
const WF = process.env.WORKFLOW_ID || "591";
const A = process.argv.slice(2);
const LAM = A.includes("--lam");
const CHI = (A.find((x) => x.startsWith("--chi=")) || "").slice(6).split(",").filter(Boolean);
const NGUONG = Number(process.env.GT_NGUONG_TIN_CAY || 80);
const SO_NGAY = Number(process.env.GT_SO_NGAY || 45);
const F_SO = path.join(DIR, ".kiem-giai-trinh.json");
const DAU = "🤖 AI kiểm tra giải trình";
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);
const nghi = (ms) => new Promise((r) => setTimeout(r, ms));
const dm = (d) => d ? d.slice(8, 10) + "/" + d.slice(5, 7) : "?";
const congNgay = (s, d) => { const t = new Date(s + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + d); return t.toISOString().slice(0, 10); };
const boHtml = (s) => String(s || "").replace(/<\/p>|<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\n{2,}/g, "\n").trim();

const B = { B1: 7379, B11: 7826, B2: 7380, B4: 7382, B41: 7456, B31: 7381, B32: 7392 };

/* ===== cổng wshr (khuôn y canh-b11.mjs — đã đo 22/09 & 29/09) ===== */
const H = (token) => ({ authorization: token, origin: "https://work.hasaki.vn", referer: "https://work.hasaki.vn/" });
const docTask = async (token, id) => { try { return (await (await fetch(V + "/hr/projects/task-input/" + id, { headers: { authorization: token, accept: "application/json" }, signal: AbortSignal.timeout(30000) })).json()).data; } catch { return null; } };
async function capNhat(token, id, field, cap) {
  const fd = new FormData(); fd.set("id", String(id)); fd.set("field", field);
  for (const [k, v] of Object.entries(cap)) fd.set(k, v);
  const r = await fetch(V + "/hr/projects/mass-update-field-task-input", { method: "POST", body: fd, headers: H(token), signal: AbortSignal.timeout(30000) });
  let j = null; try { j = JSON.parse(await r.text()); } catch { }
  return { ok: r.status === 200 && j && j.status === 1, http: r.status };
}
async function docBinhLuan(token, id) {
  try {
    const r = await fetch(V + "/v2/task/comment?obj_id=" + id, { headers: { authorization: token }, signal: AbortSignal.timeout(15000) });
    const t = await r.text(); if (!r.ok || t[0] !== "{") return null;
    return (JSON.parse(t).data || []).map((c) => String(c.comment || c.content || "").replace(/\r\n/g, "\n"));
  } catch { return null; }
}
async function guiBinhLuan(token, id, text) {
  for (const them of [{}, { obj_type: "task" }]) {
    const fd = new FormData(); fd.set("obj_id", String(id)); fd.set("comment", text);
    for (const [k, v] of Object.entries(them)) fd.set(k, v);
    try { await fetch(V + "/v2/task/comment", { method: "POST", body: fd, headers: H(token), signal: AbortSignal.timeout(20000) }); } catch { }
    await nghi(800);
    const ds = await docBinhLuan(token, id);
    if (ds && ds.some((x) => x.includes(text))) return true;
  }
  return false;
}
/* DỪNG = nút web "Hủy và điều hướng → Dừng" (memory dung-quy-trinh-dieu-huong): −1 ⇒ huỷ bước + finish cha. */
async function dungPhieu(token, id, lyDo) {
  const d = await docTask(token, id); if (!d) return false;
  const treo = (d.subtasks || []).filter((s) => [0, 1].includes(Number(s.status)));
  if (treo.length !== 1) { log("   ⚠ " + treo.length + " bước treo (cần đúng 1) — bỏ qua, xem tay."); return false; }
  try {
    await fetch(V + "/hr/projects/re-create-step/" + treo[0].id, { method: "POST", signal: AbortSignal.timeout(30000),
      headers: { ...H(token), "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ workflow_step_id: "-1" }) });
  } catch { }
  await nghi(1200);
  const luc = new Date(Date.now() + 7 * 36e5).toISOString().replace("T", " ").slice(0, 19);
  await capNhat(token, treo[0].id, "data", { "value[note_failed]": JSON.stringify([{ note_failed: lyDo, staff_name: "Lê Chí Tâm", staff_code: "233135", created_at: luc }]) });
  const d2 = await docTask(token, id);
  return !!(d2 && Number(d2.status) === 2 && !(d2.subtasks || []).some((s) => [0, 1].includes(Number(s.status))));
}

/* ===== nguồn sự thật tại chỗ (không gọi thêm upstream) ===== */
const CAMERA_BAN = (() => {
  try {
    const s = fs.readFileSync(path.join(DIR, "kiemsoatkho", "hasaki-planogram.js"), "utf8");
    const i = s.indexOf("var CAMERA_BAN = {"), j = s.indexOf("};", i);
    const o = {}; for (const m of s.slice(i, j).matchAll(/"(F0-A8-[^"]+)":\s*"(camera_\d+)/g)) o[m[1]] = m[2];
    return o;
  } catch { return {}; }
})();
const BAN_CUA_CAM = Object.fromEntries(Object.entries(CAMERA_BAN).map(([b, c]) => [c, b]));
const packer = (() => { try { return JSON.parse(fs.readFileSync(path.join(DIR, ".packer-a8-ngay.json"), "utf8")).days || {}; } catch { return {}; } })();
const danhBa = (() => { try { return JSON.parse(fs.readFileSync(path.join(DIR, ".cache-danhba.json"), "utf8")).data || []; } catch { return []; } })();
const byCode = new Map(danhBa.map((x) => [String(x.code || ""), x]));

function suThatNV(n, code, ngayPhieu) {
  const nv = byCode.get(String(code)) || {};
  const out = { code, ten: nv.staff_name || "?" };
  const cc = n.cc.get(String(code));
  if (cc && cc.size) {
    const ds = [...cc.keys()].sort();
    out.ngayLamDau = ds[0];
    out.cuaSoChamCongTu = [...n.cc.values()].flatMap((m) => [...m.keys()]).sort()[0] || "?";
    out.thuTuNgayLamTaiNgayPhieu = ds.filter((d) => d <= ngayPhieu).length;
    out.diLam10NgayTruocPhieu = ds.filter((d) => d < ngayPhieu && d >= congNgay(ngayPhieu, -10)).map((d) => dm(d) + " " + cc.get(d).vao + "-" + cc.get(d).ra);
  } else out.chamCong = "không có dữ liệu chấm công";
  const email = String(nv.staff_email || "").toLowerCase();
  const bc = n.ls.filter((x) => x.code === String(code) || (email && x.email === email)).sort((a, b) => (a.ngay + a.gio).localeCompare(b.ngay + b.gio));
  out.soLanBaoCaoVeSinh = bc.length;
  out.baoCaoDauTien = bc[0] ? dm(bc[0].ngay) + " " + bc[0].khoa : "chưa từng";
  out.baoCaoTruocPhieu = bc.filter((x) => x.ngay < ngayPhieu).slice(-5).map((x) => dm(x.ngay) + " " + x.gio + " " + x.khoa);
  if (email) {
    const cam = [];
    for (const d of Object.keys(packer).sort()) {
      if (d < congNgay(ngayPhieu, -10) || d > ngayPhieu) continue;
      for (const x of packer[d].rows || []) if (String(x[1]).toLowerCase() === email) cam.push(dm(d) + " " + (BAN_CUA_CAM[x[0]] || x[0]).replace("F0-A8-", "bàn ") + " " + x[2] + "–" + x[3] + " " + x[4] + " phiếu");
    }
    out.dongGoiCamera10Ngay = cam.length ? cam : ["không có dữ liệu đóng gói"];
  }
  return out;
}

/* ===== Gemini (khuôn sync-vesinh-ai.mjs: ảnh thu nhỏ inline, chuỗi model dự phòng) ===== */
let _sharp;
async function anhBase64(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(30000) }); if (!r.ok) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  try {
    if (_sharp === undefined) { try { _sharp = (await import("sharp")).default; } catch { _sharp = null; } }
    if (_sharp) return { mime_type: "image/jpeg", data: (await _sharp(buf).rotate().resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 72 }).toBuffer()).toString("base64") };
  } catch { }
  return { mime_type: "image/jpeg", data: buf.toString("base64") };
}
const SYSTEM = `Bạn là kiểm soát viên 5S kho Hasaki. Nhiệm vụ: kiểm tra GIẢI TRÌNH "Không phải lỗi cá nhân" của nhân viên (B1.1) và quản lý trực tiếp (B2) cho một phiếu vi phạm vệ sinh.
Nguyên tắc:
- Chỉ kết luận DUNG khi nội dung giải trình được SỰ THẬT máy cung cấp xác nhận (chấm công, lịch sử báo cáo, camera đóng gói, ảnh). Lời nói suông không có sự thật đi kèm = CHUA_DU_CAN_CU.
- Sự thật mâu thuẫn với giải trình (vd nói "NV mới" nhưng đã làm nhiều tuần và từng báo cáo vệ sinh; nói "nghỉ" nhưng có chấm công) = SAI.
- "NV mới / chưa nắm quy trình" chỉ DUNG khi ngày làm đầu tiên gần ngày phiếu (thường ≤ 14 ngày, và ngày làm đầu tiên không trùng đầu cửa sổ dữ liệu chấm công — trùng thì không biết thật sự vào lúc nào) VÀ NV chưa từng / hầu như chưa báo cáo vệ sinh trước phiếu.
- Ảnh bằng chứng đen, mờ, không liên quan thì coi như không có ảnh — nêu rõ, nhưng không tự nó làm giải trình SAI.
- Trả lời tiếng Việt, ngắn, dễ hiểu cho người không chuyên. ly_do ≤ 2 câu, nêu con số kiểm chứng (ngày vào làm, số lần báo cáo...).`;
const SCHEMA = {
  type: "OBJECT", required: ["ket_luan", "tin_cay", "ly_do", "doi_chieu", "anh"],
  properties: {
    ket_luan: { type: "STRING", enum: ["DUNG", "SAI", "CHUA_DU_CAN_CU"] },
    tin_cay: { type: "INTEGER" }, ly_do: { type: "STRING" },
    doi_chieu: { type: "ARRAY", items: { type: "STRING" } },
    anh: { type: "STRING" },
  },
};
const CHUOI = [...new Set([process.env.GT_AI_MODEL || "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3-flash-preview", "gemini-2.5-flash", "gemini-2.0-flash"])];
async function chamAI(hoSo, anhUrls) {
  const parts = [{ text: "HỒ SƠ PHIẾU (JSON):\n" + JSON.stringify(hoSo, null, 1) }];
  for (const u of anhUrls.slice(0, 3)) { const a = await anhBase64(u).catch(() => null); if (a) { parts.push({ text: "Ảnh bằng chứng: " + u.split("/").pop() }); parts.push({ inline_data: a }); } }
  const body = JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM }] }, contents: [{ role: "user", parts }],
    generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, maxOutputTokens: 2048 } });
  for (const model of CHUOI) {
    for (let lan = 0; lan < 2; lan++) {
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + process.env.GEMINI_API_KEY,
        { method: "POST", headers: { "content-type": "application/json" }, body, signal: AbortSignal.timeout(90000) }).catch((e) => ({ ok: false, status: 0, text: async () => String(e) }));
      if (r.status === 429 || r.status === 503 || r.status === 0) { const t = await r.text(); if (/PerDay|daily/i.test(t) || lan) break; await nghi(30000); continue; }
      if (!r.ok) break;
      const j = await r.json(); const cand = (j.candidates || [])[0];
      try { return { ...JSON.parse(((cand && cand.content && cand.content.parts) || []).map((p) => p.text || "").join("")), model }; } catch { break; }
    }
  }
  return null;
}

/* ===== chính ===== */
(async () => {
  if (!process.env.GEMINI_API_KEY) { log("✗ thiếu GEMINI_API_KEY trong .env — dừng."); process.exitCode = 1; return; }
  const token = await layTokenSongWork(DIR, log);
  if (!token) { log("✗ Không có token work sống — dừng."); process.exitCode = 1; return; }
  let so = {}; try { so = JSON.parse(fs.readFileSync(F_SO, "utf8")); } catch { }

  const iso = (d) => d.toISOString().slice(0, 10);
  const r = await fetch(V + "/hr/workflows/detail-workflow-task/" + WF + "?from_date=" + iso(new Date(Date.now() - SO_NGAY * 864e5)) + "&to_date=" + iso(new Date(Date.now() + 864e5)) + "&search_type=board",
    { headers: { authorization: token }, signal: AbortSignal.timeout(120000) });
  if (!r.ok) { log("✗ board HTTP " + r.status); process.exitCode = 1; return; }
  const rows = ((await r.json()).data || {}).rows || [];
  const cuoi = (t, step) => (t.subtasks || []).filter((s) => Number(s.workflow_step_id) === step && Number(s.status) !== 4).sort((a, b) => a.id - b.id).pop();
  const cfg = (s) => (s && s.data && s.data.configs) || {};
  const ungVien = rows.filter((t) => {
    if (CHI.length && !CHI.includes(String(t.id))) return false;
    if ([4, 6].includes(Number(t.status))) return false;
    const b2 = cuoi(t, B.B2);
    if (!b2 || Number(b2.status) !== 2 || !/không phải lỗi cá nhân/i.test(String(cfg(b2).CNF03 || ""))) return false;
    if ((t.subtasks || []).some((s) => [B.B31, B.B32].includes(Number(s.workflow_step_id)) && Number(s.status) === 2)) return false;
    return (t.subtasks || []).filter((s) => [0, 1].includes(Number(s.status))).length === 1;
  });
  log("board: " + rows.length + " phiếu · ứng viên (B2 'Không phải lỗi cá nhân', còn 1 bước treo): " + ungVien.length + (LAM ? "" : " — DIỄN TẬP"));
  if (!ungVien.length) return;

  const n = await napNguonTruyVet(log);
  if (!n || !n.du) { log("✗ không nạp được chấm công / lịch sử vệ sinh — dừng (không chấm khi thiếu sự thật)."); process.exitCode = 1; return; }

  for (const t0 of ungVien) {
    const t = (await docTask(token, t0.id)) || t0;
    const c = cfg(t), b1 = cuoi(t, B.B1), b11 = cuoi(t, B.B11), b2 = cuoi(t, B.B2), b4 = cuoi(t, B.B4);
    const treo = (t.subtasks || []).find((s) => [0, 1].includes(Number(s.status)));
    const gt11 = String(cfg(b11).giaitrinh11 || "").trim(), gt2 = String(cfg(b2).DT03 || "").trim();
    const khoaGT = [gt11, gt2, cfg(b4).CNF05 || ""].join("|");
    if (so[t.id] && so[t.id].khoaGT === khoaGT && !CHI.length) continue;   // đã chấm, giải trình không đổi

    const ngayPhieu = String(c.DATE00 || t.created_at || "").slice(0, 10);
    const codes = String(cfg(b1).staff || "").split(/[,\s]+/).filter(Boolean);
    const ptc = traPhanCong(n, c.BIN00);
    const binhLuan = (await docBinhLuan(token, t.id)) || [];
    if (binhLuan.some((x) => x.includes(DAU)) && !CHI.length) { so[t.id] = { khoaGT, luc: Date.now(), kq: "da_co_binh_luan" }; continue; }
    const hoSo = {
      phieu: t.id, viTri: c.BIN00, loiViPham: c.TYPE00, ngayGhiNhan: c.DATE00 || t.created_at,
      moTaPhieu: boHtml(t.description).slice(0, 1500),
      binhLuanTrenPhieu: binhLuan.map((x) => boHtml(x).slice(0, 400)).slice(0, 6),
      phuTrachTheoBangPhanCong: ptc && ptc.pt ? ptc.pt.ten + " (" + ptc.pt.code + ")" : "không có",
      nhanVienViPham: codes.map((k) => suThatNV(n, k, ngayPhieu)),
      B1_1_nhanVien: { xacNhan: cfg(b11).xacnhan11 || "", giaiTrinh: gt11 },
      B2_quanLy: { xacNhan: cfg(b2).CNF03 || "", giaiTrinh: gt2 },
      B4_audit: b4 ? { xacNhan: cfg(b4).CNF05 || "", ghiChu: cfg(b4).GT05 || "" } : "chưa tới",
      buocDangTreo: treo ? treo.name : "?",
    };
    const anh = [...[].concat(cfg(b11).bangchung11 || []), ...[].concat(cfg(b2).BC03 || [])].filter(Boolean).map((p) => /^https?:/.test(p) ? p : CDN + p);

    log("── " + t.id + " · " + c.BIN00 + " · treo: " + hoSo.buocDangTreo);
    log("   giải trình NV: " + (gt11 || "—") + " | QLTT: " + (gt2 || "—"));
    for (const x of hoSo.nhanVienViPham) log("   sự thật " + x.ten + " (" + x.code + "): làm đầu " + (x.ngayLamDau || "?") + " (cửa sổ CC từ " + (x.cuaSoChamCongTu || "?") + ") · ngày làm thứ " + (x.thuTuNgayLamTaiNgayPhieu ?? "?") + " tại ngày phiếu · báo cáo VS " + x.soLanBaoCaoVeSinh + " lần (đầu: " + x.baoCaoDauTien + ")");
    const kq = await chamAI(hoSo, anh);
    if (!kq) { log("   ⚠ AI không trả lời (quota/mạng) — để lượt sau."); continue; }
    const dat = kq.ket_luan === "DUNG" && Number(kq.tin_cay) >= NGUONG;
    log("   AI [" + kq.model + "]: " + kq.ket_luan + " · tin cậy " + kq.tin_cay + "% — " + kq.ly_do);
    for (const x of kq.doi_chieu || []) log("     · " + x);
    if (kq.anh) log("     · ảnh: " + kq.anh);
    log("   ⇒ " + (dat ? "DỪNG điều hướng (bước " + hoSo.buocDangTreo + ")" : "giữ nguyên cho Audit, bình luận nhận xét"));

    const nhan = { DUNG: "ĐÚNG", SAI: "KHÔNG ĐÚNG", CHUA_DU_CAN_CU: "CHƯA ĐỦ CĂN CỨ" }[kq.ket_luan] || kq.ket_luan;
    const cmt = DAU + ": " + nhan + " (tin cậy " + kq.tin_cay + "%)\n" + kq.ly_do + "\nĐối chiếu:\n" + (kq.doi_chieu || []).map((x) => "- " + x).join("\n") +
      (kq.anh ? "\nẢnh bằng chứng: " + kq.anh : "") + "\n→ " + (dat ? "Máy dừng điều hướng, phiếu kết thúc không ghi nhận vi phạm." : "Giữ nguyên phiếu để Audit xem xét.");
    if (!LAM) { so[t.id] = so[t.id] || null; continue; }
    const okCmt = await guiBinhLuan(token, t.id, cmt);
    log("   " + (okCmt ? "✓" : "✗") + " bình luận");
    let okDung = null;
    if (dat) { okDung = await dungPhieu(token, t.id, "AI xác minh giải trình đúng: " + kq.ly_do); log("   " + (okDung ? "✓ đã DỪNG phiếu" : "✗ dừng phiếu không thành — xem tay")); }
    so[t.id] = { khoaGT, luc: Date.now(), kq: kq.ket_luan, tin_cay: kq.tin_cay, dung: okDung };
    await nghi(4000);
  }
  if (LAM) fs.writeFileSync(F_SO, JSON.stringify(so, null, 1));
})();
