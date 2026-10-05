/* 05/10/2026 — luật DL-03 (user duyệt «Giữ sớm, dừng sau»): 2 phiếu TRÙNG HOÀN TOÀN (cùng ảnh + cùng ô + cùng lỗi) → giữ phiếu
 * tạo trước, dừng phiếu sau (re-create-step −1 + note_failed, khuôn canh-b11) + bình luận «Trùng phiếu <link>».
 * node _dung-phieu-trung.mjs <id giữ> <id dừng> [--lam]   (không --lam = diễn tập). Kiểm lại trùng ảnh+ô+lỗi trước khi làm. */
import "dotenv/config"; import sharp from "sharp";
import { layTokenSongWork } from "./session-rules.js";
const V = "https://wshr.hasaki.vn/api"; const [GIU, DUNG] = process.argv.slice(2).filter((x) => !x.startsWith("--")); const LAM = process.argv.includes("--lam");
const t = await layTokenSongWork(process.cwd(), () => {}); const HW = { authorization: t, origin: "https://work.hasaki.vn", referer: "https://work.hasaki.vn/" };
const doc = async (id) => (await (await fetch(V + "/hr/projects/task-input/" + id, { headers: { authorization: t, accept: "application/json" } })).json()).data;
const a = await doc(GIU), b = await doc(DUNG); const ca = a.data.configs, cb = b.data.configs;
/* so NỘI DUNG như DL-02 (_trung-anh.mjs): ảnh xám 16×16, lệch trung bình ≤ 6 = trùng (05/10: so byte md5 từng báo sai) */
const bam = async (p) => sharp(Buffer.from(await (await fetch("https://hr-media.hasaki.vn/production/hr/" + p)).arrayBuffer())).resize(16, 16, { fit: "fill" }).greyscale().raw().toBuffer();
const lech = (x, y) => { let d = 0; for (let i = 0; i < 256; i++) d += Math.abs(x[i] - y[i]); return d / 256; };
const ha = await Promise.all([].concat(ca.IMA00 || []).map(bam)), hb = await Promise.all([].concat(cb.IMA00 || []).map(bam));
const trungAnh = hb.length && hb.every((y) => ha.some((x) => lech(x, y) <= 6)), trungO = String(ca.BIN00).trim() === String(cb.BIN00).trim(), trungLoi = ca.TYPE00 === cb.TYPE00;
console.log("giữ", GIU, a.created_at, "· dừng", DUNG, b.created_at, "| trùng ảnh", trungAnh, "· ô", trungO, "· lỗi", trungLoi);
if (!(trungAnh && trungO && trungLoi)) { console.log("✗ không trùng hoàn toàn — DL-03 không áp, dừng."); process.exit(1); }
if (a.created_at > b.created_at) { console.log("✗ phiếu giữ tạo SAU phiếu dừng — đảo lại tham số."); process.exit(1); }
const treo = (b.subtasks || []).filter((s) => [0, 1].includes(Number(s.status)));
console.log("bước treo của phiếu dừng:", treo.map((s) => s.name.trim()).join(", "));
if (treo.length !== 1) { console.log("✗ cần đúng 1 bước treo — xem tay."); process.exit(1); }
const lyDo = "Trùng phiếu https://work.hasaki.vn/tasks?task_id=" + GIU + " (cùng ảnh, cùng vị trí, cùng lỗi)";
if (!LAM) { console.log("(diễn tập) sẽ dừng", DUNG, "·", lyDo); process.exit(0); }
await fetch(V + "/hr/projects/re-create-step/" + treo[0].id, { method: "POST", headers: { ...HW, "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ workflow_step_id: "-1" }) }).catch(() => {});
await new Promise((r) => setTimeout(r, 1200));
const luc = new Date(Date.now() + 7 * 36e5).toISOString().replace("T", " ").slice(0, 19);
const fd = new FormData(); fd.set("id", String(treo[0].id)); fd.set("field", "data");
fd.set("value[note_failed]", JSON.stringify([{ note_failed: lyDo, staff_name: "Lê Chí Tâm", staff_code: "233135", created_at: luc }]));
await fetch(V + "/hr/projects/mass-update-field-task-input", { method: "POST", body: fd, headers: HW }).catch(() => {});
const fc = new FormData(); fc.set("obj_id", String(DUNG)); fc.set("comment", lyDo);
await fetch(V + "/v2/task/comment", { method: "POST", body: fc, headers: HW }).catch(() => {});
const b2 = await doc(DUNG);
const ok = Number(b2.status) === 2 && !(b2.subtasks || []).some((s) => [0, 1].includes(Number(s.status)));
console.log(ok ? "✓ đã dừng " + DUNG + " (cha status 2, không còn bước treo)" : "✗ đọc lại chưa thấy dừng — xem tay: https://work.hasaki.vn/tasks?task_id=" + DUNG);
