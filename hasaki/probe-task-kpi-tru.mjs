/**
 * probe-task-kpi-tru.mjs — READ-ONLY (chỉ GET, không đăng nhập, không đá phiên)
 *  CÂU HỎI: task work.hasaki.vn #12850765 (HSK-21N4O12Y, 5S Kho Tổng, vi phạm 09/07/2026,
 *  bước B3.1 "Ghi nhận vi phạm vệ sinh kho tổng" Finished 22/07) đã ghi nhận TRỪ KPI cho
 *  Nguyễn Nguyệt Quỳnh #220830 và Bùi Văn Non #251215 bên HR chưa?
 *  Chạy: node probe-task-kpi-tru.mjs [code1,code2] [YYYY-MM,...]
 *
 *  KẾT QUẢ CHẠY 10/08/2026 — CHƯA TRẢ LỜI ĐƯỢC PHÍA HR, vì 2 rào cùng lúc:
 *   1) hr.hasaki.vn KHÔNG kết nối được từ máy này (TCP timeout 3 lượt, không có proxy;
 *      31/07 còn tải được bundle 16,7MB) ⇒ không mint được token do chính app HR cấp.
 *   2) Token work (bridge) bị 403 "Have no permission to access!" ở đúng những endpoint giữ
 *      bảng KPI: /hr/sheet-summary (kể cả staff_id của CHÍNH MÌNH), /hr/staff, /hr/location,
 *      /hr/skill, /hr/kpi/items. Trong khi /hr/timesheet, /hr/task, /hr/kpi, /hr/categories,
 *      /hr/excel-io, /v2/task/* vẫn 200 ⇒ token còn sống, đây là quyền theo endpoint.
 *      Đối chiếu: 31/07 probe-kpi-vesinh-quet.mjs quét 289 NV qua sheet-summary, 0 lỗi.
 *      ⇒ quyền đọc bảng KPI đã bị siết trong khoảng 31/07 → 10/08.
 *  Phía workflow thì ĐÃ ghi nhận: xem probe-task-12850765-raw.mjs (bước B3.2 Finished 28/07,
 *  staff32 = "220830,251215", VP32=1, rea32=35, skill32=4475, loc32=398).
 */
import path from "node:path"; import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { layTokenSongWork } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, ".exports"); fs.mkdirSync(OUT, { recursive: true });
const CODES = (process.argv[2] || "220830,251215").split(",").map(s => s.trim());
const THANGS = (process.argv[3] || "2026-07,2026-08").split(",");
const SKILL = "4475";        // "Skill liên quan" ghi ở bước B3.1
const log = (...a) => console.log(...a);
const luu = (t, o) => fs.writeFileSync(path.join(OUT, "task-kpi-" + t + ".json"), typeof o === "string" ? o : JSON.stringify(o, null, 1));

const work = await layTokenSongWork(DIR, log);
if (!work) { log("✗ Thiếu token work/hr sống — dừng."); process.exit(2); }
const HH = { authorization: work, accept: "application/json", origin: "https://work.hasaki.vn", referer: "https://work.hasaki.vn/" };
const V = "https://wshr.hasaki.vn/api";
const gj = async (u, ms = 90000) => {
  const ac = new AbortController(); const to = setTimeout(() => ac.abort(), ms);
  try { const r = await fetch(u, { headers: HH, signal: ac.signal }); const t = await r.text(); clearTimeout(to); let j = null; try { j = JSON.parse(t); } catch { } return { s: r.status, j, t }; }
  catch (e) { clearTimeout(to); return { s: "ERR " + e.name, j: null, t: "" }; }
};

/* ═══ 1) DANH BẠ ═══ */
const dir = (await gj(`${V}/news/staff/search-for-dropdown?limit=10000&sort=staff_id`)).j?.data || [];
const nguoi = CODES.map(c => dir.find(s => String(s.code) === c) || { code: c });
for (const p of nguoi) log(`#${p.code} → ${p.staff_name || "KHÔNG THẤY"} · staff_id ${p.staff_id} · ${p.staff_email} · major ${p.major_id} (${p.staff_major}) · loc ${p.staff_loc_id}`);

/* ═══ 2) BẢNG KPI THÁNG: soi mọi dấu vết trừ/vi phạm ═══ */
for (const p of nguoi) {
  if (!p.staff_id) continue;
  for (const thang of THANGS) {
    const cuoi = new Date(Number(thang.slice(0, 4)), Number(thang.slice(5, 7)), 0).getDate();
    const ss = await gj(`${V}/hr/sheet-summary?from_date=${thang}-01&to_date=${thang}-${cuoi}&staff_id=${p.staff_id}&limit=50`);
    const b = (ss.j?.data?.rows || ss.j?.records || []).filter(r => String(r.month || "").startsWith(thang))[0];
    log(`\n═══ ${p.staff_name} (#${p.code}) · tháng ${thang} ═══  [HTTP ${ss.s}]`);
    if (!b) { log("   ✗ không có bảng KPI tháng này"); continue; }
    luu(`bang-${p.code}-${thang}`, b);
    log(`   final_kpi=${b.final_kpi} · efficiency=${b.efficiency} · total_task=${b.total_task}/HT ${b.total_task_finished} · skill_revenue=${b.skill_revenue}`);
    log(`   khoá cấp cao nhất: ${Object.keys(b).join(", ")}`);

    /* a) mọi khoá/giá trị nhắc tới vi phạm / phạt / trừ */
    const veti = [];
    (function quet(o, dg) {
      if (o == null) return;
      if (typeof o === "object") { for (const k in o) { if (/violat|penalt|punish|deduct|minus|fine|vi.?pham|tru_|_tru/i.test(k)) veti.push(`${dg}.${k} = ${JSON.stringify(o[k]).slice(0, 200)}`); quet(o[k], dg + "." + k); } return; }
      if (typeof o === "string" && /vi ph[aạ]m|ph[aạ]t|tr[uừ] KPI/i.test(o)) veti.push(`${dg} = ${o.slice(0, 150)}`);
    })(b, "");
    log("   ⚑ dấu vết vi phạm/phạt: " + (veti.length ? "\n     " + veti.slice(0, 25).join("\n     ") : "KHÔNG CÓ"));

    /* b) skill 4475 trong log kỹ năng */
    const sk = b.skill_revenue_logs || {};
    const s4475 = sk[SKILL] || Object.entries(sk).find(([k]) => k === SKILL);
    log(`   kỹ năng #${SKILL}: ` + (s4475 ? JSON.stringify(s4475).slice(0, 300) : `không có trong ${Object.keys(sk).length} kỹ năng đang hưởng`));

    /* c) mục KPI có điểm âm / trừ */
    const am = Object.entries(b.kpis || {}).filter(([, v]) => Number(v?.kpi) < 0);
    log("   mục KPI ÂM: " + (am.length ? am.map(([k, v]) => `${k}=${v.kpi} ${JSON.stringify(v.value).slice(0, 120)}`).join(" | ") : "không có"));
  }
}

/* ═══ 3) DÒ endpoint vi phạm/kỷ luật của HR ═══ */
log("\n═══ 3) Endpoint vi phạm/kỷ luật ═══");
const q = nguoi.filter(p => p.staff_id);
const US = [];
for (const p of q) US.push(
  `/hr/violation?staff_id=${p.staff_id}`, `/hr/violations?staff_id=${p.staff_id}`,
  `/hr/staff-violation?staff_id=${p.staff_id}`, `/hr/kpi-violation?staff_id=${p.staff_id}`,
  `/hr/discipline?staff_id=${p.staff_id}`, `/hr/staff/violation?staff_id=${p.staff_id}`,
  `/v2/violation?staff_id=${p.staff_id}`, `/hr/skill-log?staff_id=${p.staff_id}`,
  `/hr/staff-skill?staff_id=${p.staff_id}`, `/hr/skill?staff_id=${p.staff_id}`,
  `/hr/sheet-detail?staff_id=${p.staff_id}&from_date=2026-07-01&to_date=2026-07-31`,
);
for (const u of [...new Set(US)]) {
  const r = await gj(V + u, 30000);
  log(`  [${r.s}] ${u}  ${r.t.replace(/\s+/g, " ").slice(0, 140)}`);
}
process.exit(0);
