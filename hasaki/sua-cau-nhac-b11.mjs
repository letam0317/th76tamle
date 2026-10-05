/* Sửa bình luận nhắc B1.1 ĐÃ ĐĂNG sang câu mới (user 29/09). Mặc định chạy thử; --ghi để sửa thật.
 * Sửa = POST /v2/task/comment/<comment_id> (khuôn 26/09 nối câu 72h). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { layTokenSongWork } from "./session-rules.js";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const V = "https://wshr.hasaki.vn/api";
const GHI = process.argv.includes("--ghi");
const log = (...a) => console.log(...a);
const so = JSON.parse(fs.readFileSync(path.join(DIR, ".canh-b11.json"), "utf8"));
const token = await layTokenSongWork(DIR, log);
const H = { authorization: token, origin: "https://work.hasaki.vn", referer: "https://work.hasaki.vn/" };
const doi = (s) => s
  .replace("xác nhận lỗi vi phạm ở bước B1.1", "phản hồi Có lỗi cá nhân hoặc Không phải lỗi cá nhân ở bước B1.1")
  .replace("nếu người vi phạm không phản hồi,", "nếu không có phản hồi gì,")
  .replace(/h\)\. Sau (\d+)h kể từ/, "h).\nSau $1h kể từ");
const docCmt = async (id) => { const j = await (await fetch(V + "/v2/task/comment?obj_id=" + id, { headers: H })).json(); return Array.isArray(j.data) ? j.data : []; };
let n = 0;
for (const id of Object.keys(so.nhac || {})) {
  const ds = await docCmt(id);
  for (const c of ds) {
    const cu = String(c.comment || c.content || "");
    if (!cu.includes("xác nhận lỗi vi phạm ở bước B1.1")) continue;
    const moi = doi(cu); n++;
    log("task " + id + " · cmt " + c.id + (GHI ? "" : "\n  CŨ: " + cu + "\n  MỚI: " + moi));
    if (!GHI) continue;
    const fd = new FormData(); fd.set("comment", moi); fd.set("obj_id", String(id));
    const r = await fetch(V + "/v2/task/comment/" + c.id, { method: "POST", body: fd, headers: H });
    await new Promise((r) => setTimeout(r, 600));
    const ok = (await docCmt(id)).some((x) => String(x.comment || x.content || "") === moi);
    log("  → HTTP " + r.status + (ok ? " ✓ đã sửa" : " ⚠ chưa xác nhận"));
  }
}
log("Tổng " + n + " bình luận câu cũ" + (GHI ? "" : " (chạy thử — thêm --ghi để sửa)"));
