/* Tạm 01/10: THAY bằng chứng B1 theo QC-01 + luật "rà việc cũ" (BO-CHUAN mục 0 bước 6, mục 11).
 * node _thay-bang-chung-b1.mjs <cau-hinh.json> [--lam]
 *   cấu hình: { id, video:[đường dẫn], anh:[đường dẫn], binhLuan:"nội dung mới", dauCu:"CLIP BẰNG CHỨNG" }
 * Chặn: TASK CHA đã xong (2 không kèm bước treo / 4 / 6) → để nguyên. Còn lại: xoá trắng video02 + PIC02 của B1
 * → nạp đủ bộ mới → đọc lại; đăng bình luận mới → đọc lại thấy → mới xoá bình luận bằng chứng cũ. */
import "dotenv/config";
import fs from "node:fs"; import path from "node:path"; import https from "node:https";
import { layTokenSongWork } from "./session-rules.js";
import { chuanTuSau } from "./tu-ngu.mjs";
const V = "https://wshr.hasaki.vn/api";
const C = chuanTuSau(JSON.parse(fs.readFileSync(process.argv[2], "utf8")));   // TU-01: chú thích/bình luận qua bộ lọc từ ngữ const LAM = process.argv.includes("--lam");
const token = await layTokenSongWork(process.cwd(), () => {});
const H = { authorization: token, origin: "https://work.hasaki.vn", referer: "https://work.hasaki.vn/" };
const docTask = async (id) => (await (await fetch(V + "/hr/projects/task-input/" + id, { headers: { ...H, accept: "application/json" } })).json()).data;
const docCmt = async (id) => ((await (await fetch(V + "/v2/task/comment?obj_id=" + id, { headers: H })).json()).data || []);
async function capNhat(id, cap, files = []) {
  const fd = new FormData(); fd.set("id", String(id)); fd.set("field", "data");
  for (const [k, v] of Object.entries(cap)) fd.set(k, v);
  for (const [k, f] of files) fd.append(k, new Blob([fs.readFileSync(f)], { type: f.endsWith(".jpg") ? "image/jpeg" : f.endsWith(".webm") ? "video/webm" : "video/mp4" }), path.basename(f));
  /* 02/10: fetch của Node tự ngắt sau 300 s chờ header (clip lớn server xử lý lâu) → https thuần, chờ tới 20 phút */
  const rq = new Response(fd); const body = Buffer.from(await rq.arrayBuffer());
  const r = await new Promise((ok, no) => { const q = https.request(V + "/hr/projects/mass-update-field-task-input", { method: "POST", headers: { ...H, "content-type": rq.headers.get("content-type"), "content-length": body.length } }, (s) => { let t = ""; s.on("data", (c) => (t += c)); s.on("end", () => ok({ status: s.statusCode, t })); });
    q.setTimeout(1200000, () => q.destroy(new Error("hết 20 phút"))); q.on("error", no); q.end(body); });
  const t = r.t; let j = null; try { j = JSON.parse(t); } catch { }
  return { ok: r.status === 200 && j && j.status === 1, http: r.status, t: t.slice(0, 200) };
}
const d = await docTask(C.id);
const treo = (d.subtasks || []).filter((s) => [0, 1].includes(Number(s.status)));
const xong = [4, 6].includes(Number(d.status)) || (Number(d.status) === 2 && !treo.length);
console.log("phiếu", C.id, "cha st", d.status, "· bước treo:", treo.map((s) => s.name).join(", ") || "—");
if (xong) { console.log("→ TASK đã hoàn thành — để nguyên (luật rà việc cũ)."); process.exit(0); }
const b1 = (d.subtasks || []).filter((s) => Number(s.workflow_step_id) === 7379 && Number(s.status) !== 4).sort((a, b) => a.id - b.id).pop();
const cfg = (b1.data && b1.data.configs) || {};
console.log("B1", b1.id, "st", b1.status, "\n  video02 cũ:", JSON.stringify(cfg.video02), "\n  PIC02 cũ:", JSON.stringify(cfg.PIC02));
const cu = (await docCmt(C.id)).filter((x) => String(x.comment || "").includes(C.dauCu || "CLIP BẰNG CHỨNG"));
console.log("  bình luận bằng chứng cũ:", cu.map((x) => x.id + " " + x.created_at).join(" | ") || "—");
for (const f of [...C.video, ...C.anh]) if (!fs.existsSync(f)) { console.log("✗ thiếu file", f); process.exit(1); }
console.log("  sẽ nạp:", C.video.map((f) => path.basename(f) + " " + (fs.statSync(f).size / 1048576).toFixed(1) + "MB").join(", "), "+", C.anh.map((f) => path.basename(f)).join(", "));
if (!LAM) { console.log("(diễn tập — thêm --lam để làm thật)"); process.exit(0); }

let r = await capNhat(b1.id, { "value[configs][video02]": "", "value[configs][PIC02]": "" }); console.log("  xoá trắng:", r.ok, r.http);
r = await capNhat(b1.id, {}, C.video.map((f) => ["value[configs][video02][]", f])); console.log("  nạp clip:", r.ok, r.http, r.ok ? "" : r.t);
r = await capNhat(b1.id, {}, C.anh.map((f) => ["value[configs][PIC02][]", f])); console.log("  nạp ảnh:", r.ok, r.http, r.ok ? "" : r.t);
const d2 = await docTask(C.id); const b2 = d2.subtasks.find((s) => s.id === b1.id); const c2 = (b2.data && b2.data.configs) || {};
const okV = Array.isArray(c2.video02) && c2.video02.length === C.video.length, okA = Array.isArray(c2.PIC02) && c2.PIC02.length === C.anh.length;
console.log("  đọc lại video02:", JSON.stringify(c2.video02), okV ? "✓" : "✗", "\n  đọc lại PIC02:", JSON.stringify(c2.PIC02), okA ? "✓" : "✗", "· B1 st", b2.status);
if (!okV || !okA) { console.log("✗ nạp chưa đủ — KHÔNG đụng bình luận, xem tay."); process.exit(1); }

const fd = new FormData(); fd.set("obj_id", String(C.id)); fd.set("comment", C.binhLuan);
await fetch(V + "/v2/task/comment", { method: "POST", body: fd, headers: H }).catch(() => {});
await new Promise((s) => setTimeout(s, 1000));
/* 02/10: bản cũ trùng 80 ký tự đầu từng bị nhận nhầm là "mới" → chỉ nhận bình luận có id CHƯA nằm trong danh sách cũ */
const idCu = new Set(cu.map((x) => x.id));
const sau = await docCmt(C.id); const moi = sau.find((x) => !idCu.has(x.id) && String(x.comment || "").replace(/\r\n/g, "\n").includes(C.binhLuan.slice(0, 80)));
if (!moi) { console.log("✗ không thấy bình luận mới — giữ bình luận cũ."); process.exit(1); }
console.log("  ✓ bình luận mới", moi.id);
for (const x of cu) { const rr = await fetch(V + "/v2/task/comment/" + x.id, { method: "DELETE", headers: H }); console.log("  xoá bình luận cũ", x.id, rr.status); }
