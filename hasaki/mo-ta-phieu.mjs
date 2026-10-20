/**
 * mo-ta-phieu.mjs — sổ «Mô tả» (trường note) của phiếu WF591 đang mở → .exports/mo-ta-phieu.json { id: { note, at } }.
 *  20/10 user: dòng «Ghi chú» dưới Ảnh ghi nhận (thanh bên Theo tác vụ) phải là Mô tả của phiếu (vd 13808708 «Hàng hoá sắp xếp lộn xộn»).
 *  Danh sách board (detail-workflow-task) KHÔNG trả note ⇒ đọc task-input/<id> — CHỈ phiếu chưa có trong sổ (Mô tả ít khi đổi),
 *  tối đa MAX lượt/lần (nhẹ tải work — memory uu-tien-nhe-tai-upstream). canh-b1.mjs gọi cuối mỗi lượt; bang-591 đọc sổ (0 lượt gọi).
 *  Sổ nằm nhóm «chung» của dong-bo-xm (máy nào chạy cò thì đẩy, máy kia kéo) ⇒ bản dự phòng PC cũng có.
 *  Chạy tay: node mo-ta-phieu.mjs [--max=200]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const DIR = path.dirname(fileURLToPath(import.meta.url)), EXP = path.join(DIR, ".exports"), F = path.join(EXP, "mo-ta-phieu.json");
const docJ = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };

export async function capNhatMoTa(token, { max = 40, log = () => {} } = {}) {
  const c = docJ(path.join(EXP, "tasks-cache.json"), { header: [], rows: {} }), H = c.header || [], iS = H.indexOf("Status"), iL = H.indexOf("Link Task");
  const mo = Object.values(c.rows || {}).filter((r) => r[iS] === "None").map((r) => String(r[iL] || "").split("=")[1]).filter(Boolean);
  const so = docJ(F, {}), thieu = mo.filter((id) => !so[id]).slice(0, max);
  if (!thieu.length) return 0;
  const au = /^Bearer /.test(token) ? token : "Bearer " + token; let n = 0;
  for (const id of thieu) {
    try {
      const d = (await (await fetch("https://wshr.hasaki.vn/api/hr/projects/task-input/" + id, { headers: { authorization: au, accept: "application/json" }, signal: AbortSignal.timeout(30000) })).json()).data;
      if (!d) continue; so[id] = { note: String(d.note || "").trim(), at: new Date().toISOString() }; n++;
    } catch { /* lượt sau thử lại */ }
  }
  if (n) { fs.writeFileSync(F, JSON.stringify(so, null, 1)); log("mô tả phiếu: +" + n + " (sổ " + Object.keys(so).length + ")"); }
  return n;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { layTokenSongWork } = await import("./session-rules.js");
  const m = /--max=(\d+)/.exec(process.argv.join(" "));
  const t = await layTokenSongWork(DIR, () => {}); if (!t) { console.log("không có token work"); process.exit(1); }
  console.log("thêm", await capNhatMoTa(t, { max: m ? +m[1] : 200, log: console.log }), "phiếu");
}
