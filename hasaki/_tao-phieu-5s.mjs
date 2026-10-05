/* Tạm 02/10: lập 1 phiếu WF591 (5S) bằng tay từ bằng chứng camera — node _tao-phieu-5s.mjs <cau-hinh.json> [--lam]
 * cấu hình: {ngay:"YYYY-MM-DD HH:MM:SS", bin, type00 (chuỗi option ĐÃ BỎ DẤU PHẨY), tenNgan, anh:[file], video:[file], moTa:[dòng]}
 * Mô tả: web work.hasaki bỏ qua <br> → mỗi dòng 1 <p>. Không có --lam = diễn tập. */
import "dotenv/config"; import fs from "node:fs"; import path from "node:path"; import https from "node:https";
import { layTokenSongWork } from "./session-rules.js";
import { chuanTuSau } from "./tu-ngu.mjs";
const V = "https://wshr.hasaki.vn/api";
const C = chuanTuSau(JSON.parse(fs.readFileSync(process.argv[2], "utf8")));   // TU-01: chú thích/bình luận qua bộ lọc từ ngữ const LAM = process.argv.includes("--lam");
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const mime = (f) => f.endsWith(".jpg") || f.endsWith(".jpeg") ? "image/jpeg" : f.endsWith(".png") ? "image/png" : f.endsWith(".webm") ? "video/webm" : "video/mp4";
for (const f of [...C.anh, ...C.video]) if (!fs.existsSync(f)) { console.log("✗ thiếu", f); process.exit(1); }
const ten = ("[5S] " + C.bin + " - " + C.tenNgan).slice(0, 90);
console.log("tên:", ten, "\nngày vi phạm:", C.ngay, "· vị trí:", C.bin, "\nhạng mục:", C.type00.slice(0, 80) + "…");
console.log("ảnh:", C.anh.map((f) => path.basename(f)).join(", "), "\nclip:", C.video.map((f) => path.basename(f) + " " + (fs.statSync(f).size / 1048576).toFixed(1) + "MB").join(", "));
console.log("mô tả:\n  " + C.moTa.join("\n  "));
if (!LAM) { console.log("(diễn tập — thêm --lam để lập thật)"); process.exit(0); }
const token = await layTokenSongWork(process.cwd(), () => {});
if (!token) { console.log("✗ không có token work"); process.exit(75); }
const H = { authorization: token, origin: "https://work.hasaki.vn", referer: "https://work.hasaki.vn/" };
const fd = new FormData(); const ngay = C.ngay.slice(0, 10);
fd.set("name", ten); fd.set("amount_of_work", "0"); fd.set("type", "2"); fd.set("staff_id", process.env.STAFF_ID || "17312");
fd.set("date_start", ngay); fd.set("date_end", ngay + " 23:59:00"); fd.set("planned_hours", "0"); fd.set("piority", "0"); fd.set("workflow_id", "591");
fd.set("data[configs][DATE00]", C.ngay); fd.set("data[configs][TYPE00]", C.type00); fd.set("data[configs][BIN00]", C.bin);
fd.set("note", C.moTa.map((s) => "<p>" + esc(s) + "</p>").join(""));
for (const f of C.anh) fd.append("data[configs][IMA00][]", new Blob([fs.readFileSync(f)], { type: mime(f) }), path.basename(f));
for (const f of C.video) fd.append("data[configs][VID01][]", new Blob([fs.readFileSync(f)], { type: mime(f) }), path.basename(f));
/* fetch của Node tự ngắt sau 300 s chờ header (server xử lý clip lâu) → gửi bằng https thuần, chờ tới 20 phút */
const rq = new Response(fd); const body = Buffer.from(await rq.arrayBuffer());
const r = await new Promise((ok, no) => { const q = https.request(V + "/hr/projects/create-task-workflow", { method: "POST", headers: { ...H, "content-type": rq.headers.get("content-type"), "content-length": body.length } }, (s) => { let t = ""; s.on("data", (c) => (t += c)); s.on("end", () => ok({ status: s.statusCode, t })); });
  q.setTimeout(1200000, () => q.destroy(new Error("hết 20 phút"))); q.on("error", no); q.end(body); });
const t = r.t; let j = {}; try { j = JSON.parse(t); } catch { }
const id = j.data && j.data.id;
if (!id) { console.log("✗ lập phiếu trượt", r.status, t.slice(0, 300)); process.exit(1); }
const d = (await (await fetch(V + "/hr/projects/task-input/" + id, { headers: { ...H, accept: "application/json" } })).json()).data || {};
const cf = (d.data && d.data.configs) || {};
console.log("✓ phiếu", id, j.data.code || "", "\n  link: https://work.hasaki.vn/tasks?task_id=" + id, "\n  đọc lại IMA00:", (cf.IMA00 || []).length, "· VID01:", (cf.VID01 || []).length, "· BIN00:", cf.BIN00);
