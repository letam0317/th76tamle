/** probe-kpi-vesinh-tuchoi.mjs — READ-ONLY: phiếu BỊ TỪ CHỐI (status 5 Failed) có được cộng KPI không?
 *  Tháng 7 chỉ có 1 phiếu Failed (vừa tạo) nên phải soi các tháng TRƯỚC để có ca đã vào bảng KPI. */
import path from "node:path"; import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { layTokenSongWms, layTokenSongWork } from "./session-rules.js";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const log = (...a) => console.log(...a);
const OUT = path.join(DIR, ".exports");
const WH = 863, CTY = 1001;
const wms = await layTokenSongWms(DIR, () => { }), work = await layTokenSongWork(DIR, () => { });
const HW = { authorization: wms, accept: "application/json", "Company-Ids": String(CTY) };
const HH = { authorization: work, accept: "application/json" };
const EX = "https://wms-gw-external.hasaki.vn/api/v1", V1 = "https://wshr.hasaki.vn/api";
const gj = async (u, h, ms = 120000) => { const ac = new AbortController(); const to = setTimeout(() => ac.abort(), ms); try { const r = await fetch(u, { headers: h, signal: ac.signal }); const t = await r.text(); clearTimeout(to); let j = null; try { j = JSON.parse(t); } catch { } return { s: r.status, j, t }; } catch (e) { clearTimeout(to); return { s: "ERR " + e.name, j: null, t: "" }; } };

/* 1) 23932745 — field người báo cáo tên gì? */
log("═══ 1) Chi tiết 23932745 (status 5 Failed) — mọi field không phải object ═══");
const yc = await gj(`${EX}/planogram/schedule-requests/23932745?page=1&size=20&is_schedule_group=false`, HW);
const it = yc.j?.item || {};
for (const k of Object.keys(it)) { const v = it[k]; if (v === null || typeof v !== "object") log(`   ${k} = ${JSON.stringify(v)}`); }

/* 2) Bản ghi 23932745 trong LIST (list có executed_by_name) */
const T0m = new Date("2026-07-31T00:00:00+07:00").getTime(), T1m = new Date("2026-07-31T23:59:59+07:00").getTime();
const ls = await gj(`${EX}/planogram/schedule-requests?company_ids=${CTY}&warehouse_ids=${WH}&from_date=${T0m}&to_date=${T1m}&page=1&size=500`, HW);
const r45 = (ls.j?.records || []).find(x => String(x.request_id) === "23932745");
log("\n═══ 2) 23932745 trong LIST ═══");
log("   " + JSON.stringify(r45 ? Object.fromEntries(Object.entries(r45).filter(([, v]) => v === null || typeof v !== "object")) : "không thấy"));

/* 3) Mọi phiếu Failed (status 5) từ 01/05 → nay, và chủ nhân của chúng */
log("\n═══ 3) Phiếu status 5 (Failed) từ 2026-05-01 → nay ═══");
const A0 = new Date("2026-05-01T00:00:00+07:00").getTime(), A1 = Date.now();
const failed = [];
for (let page = 1; page <= 60; page++) {
  const { s, j } = await gj(`${EX}/planogram/schedule-requests?company_ids=${CTY}&warehouse_ids=${WH}&status_ids=5&from_date=${A0}&to_date=${A1}&page=${page}&size=200`, HW);
  const r = j?.records || []; if (s !== 200) break;
  if (page === 1) log(`   tổng Failed: ${j?.count}`);
  failed.push(...r); if (r.length < 200) break;
}
const theoThang = {};
for (const p of failed) {
  const th = String(p.executed_at || p.request_time || "").slice(0, 7);
  theoThang[th] = theoThang[th] || {};
  const k = String(p.executed_by_name || "(trống)").toLowerCase();
  theoThang[th][k] = (theoThang[th][k] || 0) + 1;
}
for (const th of Object.keys(theoThang).sort()) log(`   ${th}: ` + Object.entries(theoThang[th]).map(([k, n]) => k + "=" + n).join("  "));
fs.writeFileSync(path.join(OUT, "probe-kpi-failed.json"), JSON.stringify(failed, null, 1));

/* 4) Với tháng CÓ Failed đã chốt (không phải tháng này), đối soát KPI của chủ phiếu */
const CACHE = path.join(OUT, "probe-kpi-duration-cache.json");
let dur = {}; try { dur = JSON.parse(fs.readFileSync(CACHE, "utf8")); } catch { }
const giay = (p) => dur[p.schedule_id] ?? null;
const dirNS = (await gj(`${V1}/news/staff/search-for-dropdown?limit=10000&sort=staff_id`, HH)).j?.data || [];
const byEmail = {}; for (const s of dirNS) if (s.staff_email) byEmail[String(s.staff_email).toLowerCase()] = s;

for (const TH of Object.keys(theoThang).filter(t => /^\d{4}-\d{2}$/.test(t) && t !== "2026-07").sort()) {
  log(`\n═══ 4) Đối soát tháng ${TH} (có phiếu Failed) ═══`);
  const B0 = new Date(TH + "-01T00:00:00+07:00").getTime();
  const bd = new Date(B0); const B1 = new Date(bd.getFullYear(), bd.getMonth() + 1, 1).getTime() - 1;
  const phieu = [];
  for (let page = 1; page <= 200; page++) {
    const { s, j } = await gj(`${EX}/planogram/schedule-requests?company_ids=${CTY}&warehouse_ids=${WH}&from_date=${B0}&to_date=${B1}&page=${page}&size=200`, HW);
    const r = j?.records || []; if (s !== 200) break; phieu.push(...r); if (r.length < 200) break;
  }
  const can = [...new Set(phieu.map(p => p.schedule_id))].filter(id => dur[id] == null);
  for (const id of can) { const { j } = await gj(`${EX}/planogram/schedule/location-schedules/detail/${id}`, HW, 45000); dur[id] = Number(j?.item?.duration || 0); }
  fs.writeFileSync(CACHE, JSON.stringify(dur));
  const G = (p) => dur[p.schedule_id] || 360;
  const ai = [...new Set(failed.filter(p => String(p.executed_at || "").startsWith(TH)).map(p => String(p.executed_by_name || "").toLowerCase()))].filter(Boolean);
  for (const e of ai) {
    const cua = phieu.filter(p => String(p.executed_by_name || "").toLowerCase() === e);
    const s3 = cua.filter(p => Number(p.status_id) === 3), s4 = cua.filter(p => Number(p.status_id) === 4), s5 = cua.filter(p => Number(p.status_id) === 5);
    const tong = (a) => a.reduce((t, p) => t + G(p), 0);
    const st = byEmail[e];
    let kpiGiay = null, coMuc = false;
    if (st) {
      const ss = await gj(`${V1}/hr/sheet-summary?from_date=${TH}-01&to_date=${TH}-31&staff_id=${st.staff_id}&limit=50`, HH);
      const b = (ss.j?.data?.rows || []).filter(r => String(r.month || "").startsWith(TH))[0];
      const t14 = b?.kpis?.["COS-KPI-007-T14"]; coMuc = !!t14;
      kpiGiay = Number(t14?.value?.Asset_Schedule_Declaration_Time_Personal || 0);
    }
    log(`   ${e} (${st?.staff_name || "?"}) chờ duyệt ${s3.length}p=${tong(s3)}s · duyệt ${s4.length}p=${tong(s4)}s · FAILED ${s5.length}p=${tong(s5)}s`);
    log(`      KPI thật = ${kpiGiay}s ${coMuc ? "" : "(không có mục)"}`);
    log(`      → 3+4 = ${tong(s3) + tong(s4)}s ${kpiGiay === tong(s3) + tong(s4) ? "✓ KHỚP ⇒ phiếu Failed KHÔNG được cộng" : ""}`);
    log(`      → 3+4+5 = ${tong(s3) + tong(s4) + tong(s5)}s ${kpiGiay === tong(s3) + tong(s4) + tong(s5) ? "✓ KHỚP ⇒ phiếu Failed VẪN được cộng" : ""}`);
  }
}
process.exit(0);
