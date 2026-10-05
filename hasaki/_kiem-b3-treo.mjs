/**
 * _kiem-b3-treo.mjs — rà phiếu WF591 đang treo B3.1/B3.2 (05/10/2026, user yêu cầu):
 *   NV vi phạm ở B1 ↔ người cầm B1.1 ↔ ô NV ở B3 có khớp đủ không, B1.1 đã "Lỗi cá nhân" chưa,
 *   có trùng phiếu (cùng NV + cùng lỗi: cùng vị trí trong 7 ngày, hoặc cùng ngày — CH-05) không.
 * Nhận 3 luật user đã duyệt làm HỢP LỆ: ①b máy ghi 72h (sổ so.leo) · ③c quản lý xác nhận hộ ở B1.1
 *   (sổ so.ho hoặc thành viên ngoài NV đã Finished) · ③b NV "Không phải lỗi cá nhân" nhưng mọi kết luận
 *   quản lý B2 (CNF03)/B4 (CNF05) = "Lỗi cá nhân".
 * Chạy:  node _kiem-b3-treo.mjs            # chỉ đọc (1 GET board) → .exports/kiem-b3-treo.json
 *        node _kiem-b3-treo.mjs --dong     # rà rồi ĐÓNG B3 (status=2) các phiếu SẠCH, đọc lại từng bước
 *        node _kiem-b3-treo.mjs --dong --chi=13186674,13394098   # chỉ đóng các id này (vẫn phải sạch)
 * Đóng B3 = trừ KPI thật (Staff History r34/r35) — chỉ chạy --dong khi user bảo.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { layTokenSongWork } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const V = "https://wshr.hasaki.vn/api";
const A = process.argv.slice(2);
const DONG = A.includes("--dong");
const CHI = (A.find((x) => x.startsWith("--chi=")) || "").slice(6).split(",").map((s) => s.trim()).filter(Boolean);
const log = (...a) => console.error(...a);

const token = await layTokenSongWork(DIR, log);
if (!token) { console.error("✗ không có token"); process.exit(1); }
const H = { authorization: token, origin: "https://work.hasaki.vn", referer: "https://work.hasaki.vn/" };

let db = [];
try { db = JSON.parse(fs.readFileSync(path.join(DIR, ".cache-danhba.json"), "utf8")).data || []; } catch {}
const byCode = new Map(db.map((x) => [String(x.code), x]));
const ten = (c) => { const x = byCode.get(String(c)); return x ? x.staff_name : "?"; };
let so = {}; try { so = JSON.parse(fs.readFileSync(path.join(DIR, ".canh-b11.json"), "utf8")); } catch {}
for (const k of ["leo", "ho", "fail"]) if (!so[k]) so[k] = {};

const iso = (d) => d.toISOString().slice(0, 10);
const SO_NGAY = Number(process.env.B11_SO_NGAY || 120);
const from = iso(new Date(Date.now() - SO_NGAY * 864e5)), to = iso(new Date(Date.now() + 864e5));
const r = await fetch(V + "/hr/workflows/detail-workflow-task/591?from_date=" + from + "&to_date=" + to + "&search_type=board", { headers: { authorization: token }, signal: AbortSignal.timeout(120000) });
if (!r.ok) { console.error("✗ board HTTP " + r.status); process.exit(1); }
const rows = ((await r.json()).data || {}).rows || [];
log("board " + rows.length + " task (" + from + " → " + to + ")");

const sub = (t, stepId) => {
  const ds = (t.subtasks || []).filter((s) => String(s.workflow_step_id) === String(stepId)).sort((a, b) => a.id - b.id);
  return ds.filter((s) => Number(s.status) !== 4).pop() || ds.pop();
};
const cfg = (s) => (s && s.data && s.data.configs) || {};
const one = (v) => [].concat(v || [])[0] || "";
const ST = { 0: "None", 1: "Processing", 2: "Finished", 4: "Canceled", 6: "Failed" };
const same = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
const codesB1Cua = (t) => String(cfg(sub(t, 7379)).staff || "").split(",").map((s) => s.trim()).filter(Boolean);
const loaiCua = (t) => String(cfg(t).TYPE00 || "").replace(/\s+/g, " ").trim().toLowerCase();
const binCua = (t) => String(cfg(t).BIN00 || "").replace(/^F0-/i, "").replace(/\s+/g, " ").trim().toUpperCase();
const ngayCua = (t) => String(cfg(t).DATE00 || t.created_at || "").slice(0, 10);
/* phiếu đã khép (huỷ/thất bại/dừng = cha 2 mà không có B3 xong) — khuôn daKhep của canh-b11 */
const daKhep = (t) => [4, 6].includes(Number(t.status)) || !!so.fail[t.id] ||
  (Number(t.status) === 2 && !(t.subtasks || []).some((x) => [7381, 7392].includes(Number(x.workflow_step_id)) && Number(x.status) === 2));
const daGhiNhan = (t) => !daKhep(t) && codesB1Cua(t).length && (() => { const b11 = sub(t, 7826); const xn = String(one(cfg(b11).xacnhan11)).trim(); return !(b11 && Number(b11.status) === 2 && xn && xn !== "Lỗi cá nhân" && !(t.subtasks || []).some((x) => [7381, 7392].includes(Number(x.workflow_step_id)) && [0, 1, 2].includes(Number(x.status)))); })();
const trongNgay = (a, b, n) => Math.abs((new Date(a) - new Date(b)) / 864e5) < n;

const out = [];
for (const t of rows) {
  if ([4, 6].includes(Number(t.status))) continue;
  const b31 = sub(t, 7381), b32 = sub(t, 7392);
  const treo = [["B3.1", b31, "NVVP04"], ["B3.2", b32, "staff32"]].filter(([, b]) => b && [0, 1].includes(Number(b.status)));
  if (!treo.length) continue;
  const b1 = sub(t, 7379), b11 = sub(t, 7826), cc = cfg(t), c1 = cfg(b1), c11 = cfg(b11);
  const codesB1 = codesB1Cua(t);
  const memB11 = (b11 && b11.staff || []).map((x) => ({ code: String((x.info && x.info.code) || ""), ten: (x.info && x.info.staff_name) || "", st: Number(x.status) }));
  const codesB11 = memB11.map((m) => m.code).filter(Boolean);
  const xn = String(one(c11.xacnhan11)).trim();
  const ketLuanQL = (t.subtasks || []).filter((s) => [7380, 7382].includes(Number(s.workflow_step_id)) && Number(s.status) === 2).sort((a, b) => a.id - b.id)
    .map((s) => ({ buoc: Number(s.workflow_step_id) === 7380 ? "B2" : "B4", kl: String(one(cfg(s).CNF03 || cfg(s).CNF05)).trim() })).filter((x) => x.kl);
  const rec = {
    id: t.id, code: t.code, link: "https://work.hasaki.vn/tasks?task_id=" + t.id, cha: ST[t.status] || t.status,
    bin: cc.BIN00 || "", loi: cc.TYPE00 || "", ngayVP: cc.DATE00 || "", tao: (t.created_at || "").slice(0, 16),
    b1: b1 ? { id: b1.id, st: ST[b1.status] || b1.status, nv: codesB1.map((c) => c + " " + ten(c)), ql: c1.QLBP02 || "" } : null,
    b11: b11 ? { id: b11.id, st: ST[b11.status] || b11.status, xn, giaiTrinh: String(one(c11.giaitrinh11)).slice(0, 80), giao: (b11.created_at || "").slice(0, 16), xong: (b11.finished_at || "").slice(0, 16),
      mem: memB11.map((m) => m.code + " " + m.ten + " [" + (ST[m.st] || m.st) + "]"), sub_type: b11.sub_type } : null,
    ketLuanQL: ketLuanQL.map((x) => x.buoc + "=" + x.kl),
    b3: treo.map(([tenB, b, key]) => ({ buoc: tenB, id: b.id, st: ST[b.status] || b.status, nv: String(one(cfg(b)[key]) || "").trim(), giao: (b.created_at || "").slice(0, 16),
      camBoi: (b.staff || []).map((x) => (x.info && x.info.staff_name) || "").filter(Boolean) })),
    canCu: [], loiKiem: [],
  };
  // --- kiểm B1 / B1.1 ---
  if (!b1) rec.loiKiem.push("B1: không có bước");
  else if (Number(b1.status) !== 2) rec.loiKiem.push("B1 chưa đóng (" + rec.b1.st + ")");
  if (!codesB1.length) rec.loiKiem.push("B1: ô NV vi phạm TRỐNG");
  if (!b11) rec.loiKiem.push("B1.1: không có bước");
  else {
    if (Number(b11.status) !== 2) rec.loiKiem.push("B1.1 chưa đóng (" + rec.b11.st + ")");
    const thieu = codesB1.filter((c) => !codesB11.includes(c));
    if (thieu.length) rec.loiKiem.push("B1.1 thiếu NV của B1: " + thieu.join(","));
    const memNgoai = memB11.filter((m) => m.code && !codesB1.includes(m.code));
    const chuaXong = memB11.filter((m) => codesB1.includes(m.code) && m.st !== 2).map((m) => m.code);
    // gate "Lỗi cá nhân": NV tự chốt, hoặc ③b mọi kết luận quản lý = Lỗi cá nhân
    let quaGate = xn === "Lỗi cá nhân";
    if (quaGate) rec.canCu.push("NV chốt Lỗi cá nhân");
    else if (xn && ketLuanQL.length && ketLuanQL.every((x) => x.kl === "Lỗi cá nhân")) { quaGate = true; rec.canCu.push("③b " + ketLuanQL.map((x) => x.buoc).join("+") + " quản lý chốt Lỗi cá nhân (NV nói «" + xn + "»)"); }
    else if (xn && ketLuanQL.length) rec.loiKiem.push("NV «" + xn + "», quản lý chốt lẫn lộn: " + rec.ketLuanQL.join(", ") + " — chưa có luật");
    else rec.loiKiem.push("B1.1 Xác nhận lỗi = «" + (xn || "trống") + "»");
    if (Number(b11.status) === 2 && chuaXong.length) {
      if (so.leo[t.id]) rec.canCu.push("①b máy ghi Lỗi cá nhân sau 72h im lặng (" + chuaXong.join(",") + " không tự bấm)");
      else if (quaGate && (so.ho[t.id] || memNgoai.some((m) => m.st === 2))) rec.canCu.push("③c quản lý " + (so.ho[t.id] ? so.ho[t.id].boi : memNgoai.filter((m) => m.st === 2).map((m) => m.code + " " + m.ten).join(",")) + " xác nhận hộ ở B1.1");
      else rec.loiKiem.push("B1.1 đóng nhưng NV chưa tự xong: " + chuaXong.join(",") + " (không phải máy 72h, không có QL xác nhận hộ)");
    }
    if (memNgoai.length && !memNgoai.some((m) => m.st === 2)) rec.loiKiem.push("B1.1 có người ngoài danh sách NV: " + memNgoai.map((m) => m.code).join(","));
    if (codesB1.length >= 2 && Number(b11.sub_type) !== 1) rec.loiKiem.push("≥2 NV nhưng B1.1 chưa bật 'Mỗi thành viên' (sub_type=" + b11.sub_type + ")");
  }
  // --- kiểm B3 ---
  for (const x of rec.b3) {
    const codesB3 = x.nv.split(",").map((s) => s.trim()).filter(Boolean);
    if (!codesB3.length) rec.loiKiem.push(x.buoc + ": ô NV vi phạm TRỐNG");
    else if (codesB1.length && !same(codesB1, codesB3)) rec.loiKiem.push(x.buoc + ": NV (" + codesB3.join(",") + ") ≠ B1 (" + codesB1.join(",") + ")");
  }
  if (b31 && b32 && [0, 1, 2].includes(Number(b31.status)) && [0, 1, 2].includes(Number(b32.status))) rec.loiKiem.push("MỞ CẢ 2 NHÁNH B3.1+B3.2");
  // --- trùng: cùng NV + cùng lỗi, phiếu SỚM HƠN còn được ghi nhận: cùng vị trí trong 7 ngày (luật 7 ngày) hoặc cùng ngày (CH-05) ---
  const nT = ngayCua(t), lT = loaiCua(t), bT = binCua(t);
  for (const u of rows) {
    if (u.id === t.id || !daGhiNhan(u)) continue;
    const nU = ngayCua(u);
    if (!(nU < nT || (nU === nT && u.id < t.id))) continue;
    if (loaiCua(u) !== lT || !codesB1Cua(u).some((c) => codesB1.includes(c))) continue;
    const cungVT = bT && binCua(u) === bT && trongNgay(nT, nU, 7), cungNgay = nU === nT;
    if (cungVT || cungNgay) rec.loiKiem.push("TRÙNG " + (cungVT ? "cùng vị trí trong 7 ngày" : "cùng ngày (CH-05)") + " với phiếu sớm hơn https://work.hasaki.vn/tasks?task_id=" + u.id + " (" + nU + ")");
  }
  out.push(rec);
}
out.sort((a, b) => (a.ngayVP || a.tao).localeCompare(b.ngayVP || b.tao));
const sach = out.filter((x) => !x.loiKiem.length), loi = out.filter((x) => x.loiKiem.length);
log("tổng treo B3: " + out.length + " · sạch: " + sach.length + " · có vấn đề: " + loi.length);

/* ---- --dong: đóng B3 các phiếu sạch (status=2), đọc lại từng bước ---- */
const ketQuaDong = [];
if (DONG) {
  const docTask = async (id) => { try { return (await (await fetch(V + "/hr/projects/task-input/" + id, { headers: { ...H, accept: "application/json" }, signal: AbortSignal.timeout(30000) })).json()).data; } catch { return null; } };
  const dongBuoc = async (id) => {
    const fd = new FormData(); fd.set("id", String(id)); fd.set("field", "status"); fd.set("value", "2");
    const rr = await fetch(V + "/hr/projects/mass-update-field-task-input", { method: "POST", body: fd, headers: H, signal: AbortSignal.timeout(30000) });
    let j = null; const txt = await rr.text(); try { j = JSON.parse(txt); } catch {}
    return { http: rr.status, msg: (j && j.message) || txt.slice(0, 120) };
  };
  const ds = sach.filter((p) => !CHI.length || CHI.includes(String(p.id)));
  log("--dong: " + ds.length + " phiếu sạch sẽ đóng B3" + (CHI.length ? " (lọc --chi)" : ""));
  for (const p of ds) {
    for (const x of p.b3) {
      const w = await dongBuoc(x.id);
      await new Promise((r) => setTimeout(r, 700));
      const d = await docTask(x.id);
      const st = d ? Number(d.status) : NaN;
      const ok = st === 2;
      ketQuaDong.push({ id: p.id, link: p.link, buoc: x.buoc, b3id: x.id, nv: x.nv, ok, st: ST[st] || st, http: w.http, msg: w.msg });
      log((ok ? "✓ " : "✗ ") + p.link + " " + x.buoc + " " + x.id + " → " + (ST[st] || st) + " (HTTP " + w.http + (ok ? "" : " " + w.msg) + ")");
    }
  }
  log("đóng xong: " + ketQuaDong.filter((k) => k.ok).length + "/" + ketQuaDong.length + " bước");
}
fs.writeFileSync(path.join(DIR, ".exports", "kiem-b3-treo.json"), JSON.stringify({ luc: new Date().toISOString(), n: out.length, phieu: out, dong: ketQuaDong }, null, 1));
for (const p of out) {
  console.log((p.loiKiem.length ? "✗ " : "✓ ") + p.link + " | " + p.ngayVP.slice(0, 10) + " | " + p.bin + " | " + (p.b1 ? p.b1.nv.join("; ") : "-") + " | " + p.b3.map((x) => x.buoc + " nv=" + x.nv + " cầm=" + x.camBoi.join(",")).join("; "));
  if (p.canCu.length) console.log("   căn cứ: " + p.canCu.join(" | "));
  if (p.loiKiem.length) console.log("   !! " + p.loiKiem.join(" | "));
}
