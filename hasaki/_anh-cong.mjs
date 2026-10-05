// Tạm 01/10 (user: "xác minh từ ảnh ra vào bảo vệ để biết hình dáng NV; ngày ghi nhận không chụp thì tìm ngày trước"):
// node _anh-cong.mjs <ngày YYYY-MM-DD> <mã NV,...> [số ngày lùi tối đa=10]  → ảnh vào cổng gần nhất ≤ ngày đó cho mỗi người
import "dotenv/config"; import fs from "node:fs"; import { layTokenSongWork } from "./session-rules.js";
const [ngay, ma, lui = "10"] = process.argv.slice(2); const codes = ma.split(",");
const token = await layTokenSongWork(process.cwd(), () => {});
const H = { authorization: token, accept: "application/json", origin: "https://hr.hasaki.vn", referer: "https://hr.hasaki.vn/" };
const cong = (d, k) => { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + k); return t.toISOString().slice(0, 10); };
const tu = cong(ngay, -Number(lui)); const rows = [];
for (let p = 1; p <= 15; p++) { const j = await (await fetch(`https://wshr.hasaki.vn/api/hr/history-location?limit=200&page=${p}&location_id=398&from_date=${tu}&to_date=${ngay}&is_staff=1`, { headers: H })).json(); const r = j.data.rows || []; rows.push(...r); if (r.length < 200) break; }
const kq = {};
for (const c of codes) {
  const cua = rows.filter((r) => String(r.staff?.code) === c && (r.images_in || []).length).sort((a, b) => b.created_at.localeCompare(a.created_at));
  kq[c] = cua.slice(0, 3).map((r) => ({ ten: r.staff.staff_name, vao: r.created_at, ra: r.updated_at, ca: (r.schedule || [])[0]?.staffsche_shift, anh: r.images_in[0] }));
  console.log(c, (cua[0]?.staff.staff_name) || "(không có ảnh cổng trong " + lui + " ngày)", "→", kq[c].map((x) => x.vao).join(" | "));
}
fs.writeFileSync(process.env.TEMP + "/anh-cong.json", JSON.stringify(kq, null, 1));
