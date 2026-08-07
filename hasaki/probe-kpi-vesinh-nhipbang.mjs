/** probe-kpi-vesinh-nhipbang.mjs — READ-ONLY: bảng KPI cập nhật lúc nào (updated_at) + giá trị T14 hiện tại.
 *  Dùng để chốt câu "phiếu bị từ chối có bị trừ lại không" sau khi bảng chạy lại. */
import path from "node:path"; import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { layTokenSongWork } from "./session-rules.js";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const log = (...a) => console.log(...a);
const OUT = path.join(DIR, ".exports");
const THANG = process.argv[2] || "2026-07";
const AI = process.argv.slice(3).length ? process.argv.slice(3) : ["vannnt@hasaki.vn", "nhanttc@hasaki.vn", "duonglt@hasaki.vn", "khangtd1@hasaki.vn", "banghtt@hasaki.vn"];
const work = await layTokenSongWork(DIR, () => { });
if (!work) { log("✗ Thiếu token work/hr."); process.exit(2); }
const HH = { authorization: work, accept: "application/json" };
const V1 = "https://wshr.hasaki.vn/api";
const gj = async (u, ms = 90000) => { const ac = new AbortController(); const to = setTimeout(() => ac.abort(), ms); try { const r = await fetch(u, { headers: HH, signal: ac.signal }); const t = await r.text(); clearTimeout(to); let j = null; try { j = JSON.parse(t); } catch { } return { s: r.status, j }; } catch (e) { clearTimeout(to); return { s: "ERR " + e.name, j: null }; } };
const dir = (await gj(`${V1}/news/staff/search-for-dropdown?limit=10000&sort=staff_id`)).j?.data || [];
const byEmail = {}; for (const s of dir) if (s.staff_email) byEmail[String(s.staff_email).toLowerCase()] = s;

log(`Giờ hiện tại: ${new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} · tháng ${THANG}\n`);
const kq = {};
for (const e of AI) {
  const s = byEmail[e.toLowerCase()]; if (!s) { log(`  ${e}: không có trong danh bạ`); continue; }
  const ss = await gj(`${V1}/hr/sheet-summary?from_date=${THANG}-01&to_date=${THANG}-31&staff_id=${s.staff_id}&limit=50`);
  const b = (ss.j?.data?.rows || []).filter(r => String(r.month || "").startsWith(THANG))[0];
  if (!b) { log(`  ${e.padEnd(22)} không có bảng KPI tháng ${THANG}`); continue; }
  const t14 = b.kpis?.["COS-KPI-007-T14"];
  const giay = Number(t14?.value?.Asset_Schedule_Declaration_Time_Personal || 0);
  kq[e] = giay;
  log(`  ${e.padEnd(22)} T14 = ${String(giay).padStart(6)}s (${t14 ? t14.kpi : 0}h) · bảng cập nhật ${b.updated_at} · final_kpi ${b.final_kpi}`);
}
/* so với ảnh chụp trước */
try {
  const cu = JSON.parse(fs.readFileSync(path.join(OUT, `probe-kpi-3buoc-${THANG}.json`), "utf8"));
  log(`\nSo với ảnh chụp ${new Date(cu.luc).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}:`);
  for (const e in kq) {
    const r = cu.bang.find(x => x.email === e); if (!r) continue;
    const d = kq[e] - r.kpiGiay;
    log(`  ${e.padEnd(22)} ${String(r.kpiGiay).padStart(6)}s → ${String(kq[e]).padStart(6)}s  ${d === 0 ? "(không đổi)" : (d > 0 ? "+" : "") + d + "s"}`);
  }
} catch { }
process.exit(0);
