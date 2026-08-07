/**
 * ============================================================================
 *  probe-kpi-vesinh.mjs — READ-ONLY (chỉ GET, không đăng nhập, không đá phiên)
 * ============================================================================
 *  CÂU HỎI (31/07/2026): 1 yêu cầu vệ sinh quầy kệ trên planogram (duration 600s)
 *  thì hệ HR có CỘNG KPI cho người báo cáo hay không?
 *
 *  KẾT LUẬN (đã kiểm chứng thật — xem README ở cuối file):
 *    CÓ cơ chế cộng KPI, qua mục  COS-KPI-007-T14 "Thời gian vệ sinh cửa hàng"
 *    (KPIs Thưởng; biến đầu vào `Asset_Schedule_Declaration_Time_Personal` = tổng
 *     SỐ GIÂY các phiếu vệ sinh NV đã BÁO CÁO trong tháng — không cần được duyệt).
 *    NHƯNG mục này chỉ có trên bảng KPI của nghiệp vụ **Đóng gói (major 26)**.
 *    Riêng banghtt@hasaki.vn thuộc **major 103 – Quản lý đóng gói** nên bảng KPI
 *    của anh (73 mục) KHÔNG có mục T14 ⇒ phiếu 23932743 KHÔNG cộng KPI cho anh.
 *    ⇒ Muốn biết cả kho ai được cộng: chạy `probe-kpi-vesinh-quet.mjs`.
 *
 *  Chạy:  node probe-kpi-vesinh.mjs [request_id] [email]
 *         (mặc định 23932743 / banghtt@hasaki.vn)
 * ============================================================================
 */
import path from "node:path"; import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { layTokenSongWms, layTokenSongWork } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const RID = process.argv[2] || "23932743";
const EMAIL = (process.argv[3] || "banghtt@hasaki.vn").toLowerCase();
const OUT = path.join(DIR, ".exports"); fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);
const luu = (ten, o) => fs.writeFileSync(path.join(OUT, "probe-kpi-" + ten + ".json"), typeof o === "string" ? o : JSON.stringify(o, null, 1));

const wms = await layTokenSongWms(DIR, log);
const work = await layTokenSongWork(DIR, log);
if (!wms || !work) { log("✗ Thiếu token sống (WMS hoặc work/hr) — dừng, KHÔNG đăng nhập mới."); process.exit(2); }
const HW = { authorization: wms, accept: "application/json", "Company-Ids": "1001" };
const HH = { authorization: work, accept: "application/json" };
const gj = async (u, h) => { try { const r = await fetch(u, { headers: h }); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch { } return { s: r.status, j, t }; } catch (e) { return { s: "ERR", t: e.message, j: null }; } };
const EX = "https://wms-gw-external.hasaki.vn/api/v1";
const WS = "https://wshr.hasaki.vn/api";
const bang = (j) => j?.records || j?.data?.rows || (Array.isArray(j?.data) ? j.data : []) || [];

/* ══ 1) YÊU CẦU + LỊCH: duration nằm ở đâu, có field KPI nào không ══ */
log("\n═══ 1) Yêu cầu " + RID + " (planogram) ═══");
const yc = await gj(`${EX}/planogram/schedule-requests/${RID}?page=1&size=20&is_schedule_group=false`, HW);
const it = yc.j?.item || yc.j?.data?.item || {};
luu("req-" + RID, yc.t || "");
log(`[${yc.s}] status=${it.status_id} (${it.status_name}) · executed_by=${it.executed_by_name} @ ${it.executed_at}`
  + ` · duyệt bởi ${it.updated_by_name} @ ${it.updated_at} · vị trí ${it.location_description} · ${it.purpose_type_name}`);
log("   field có KPI/duration trong bản ghi yêu cầu: "
  + (Object.keys(it).filter(k => /kpi|point|score|dura|công/i.test(k)).join(", ") || "KHÔNG CÓ"));
const sc = await gj(`${EX}/planogram/schedule/location-schedules/detail/${it.schedule_id}`, HW);
const si = sc.j?.item || {};
log(`[${sc.s}] Lịch ${it.schedule_id}: duration=${si.duration}s (${Math.round((si.duration || 0) / 60)}') · ${si.schedule_detail}`
  + ` · khung ${si.registration_period_from}–${si.registration_period_to}  ⇒ duration là THUỘC TÍNH CỦA LỊCH, không phải công được cộng.`);
luu("sched", sc.t || "");

/* ══ 2) CHẤM CÔNG HR: có field KPI nào không ══ */
log("\n═══ 2) Chấm công hr.hasaki.vn (wshr/api/hr/timesheet) ═══");
const dir = (await gj(`${WS}/news/staff/search-for-dropdown?limit=10000&sort=staff_id`, HH)).j?.data || [];
const me = dir.find(s => String(s.staff_email || "").toLowerCase() === EMAIL) || {};
log(`   ${EMAIL} → ${me.staff_name} · code ${me.code} · staff_id ${me.staff_id} · major_id ${me.major_id} (${me.staff_major}) · dept ${me.staff_dept_id} · loc ${me.staff_loc_id}`);
const ngay = String(it.executed_at || "").slice(0, 10) || new Date().toISOString().slice(0, 10);
const ts = await gj(`${WS}/hr/timesheet?department_id=121&location_id=398&from_date=${ngay}&to_date=${ngay}&limit=2000&offset=0`, HH);
const rows = bang(ts.j);
const mine = rows.filter(r => String(r.staff_code) === String(me.code));
log(`[${ts.s}] rows=${rows.length}; field: ${rows[0] ? Object.keys(rows[0]).join(",") : "-"}`);
log("   ⚑ field KPI trong timesheet: " + (rows[0] ? (Object.keys(rows[0]).filter(k => /kpi|point|score/i.test(k)).join(",") || "KHÔNG CÓ — timesheet chỉ có giờ vào/ra") : "-"));
mine.forEach(r => log(`   ${me.staff_name}: vào ${r.check_in ? new Date(r.check_in * 1000).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "-"} · ra ${r.check_out ? new Date(r.check_out * 1000).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "chưa"} · status ${r.status}`));

/* ══ 3) BẢNG KPI THÁNG (hr/sheet-summary) — nơi KPI thật sự sống ══ */
log("\n═══ 3) Bảng KPI tháng của " + EMAIL + " (hr/sheet-summary) ═══");
const thang = ngay.slice(0, 7);
const ss = await gj(`${WS}/hr/sheet-summary?from_date=${thang}-01&to_date=${ngay}&staff_id=${me.staff_id}&limit=50`, HH);
const bangKPI = bang(ss.j).filter(r => String(r.month || "").startsWith(thang))[0];
if (!bangKPI) { log(`[${ss.s}] ✗ Không lấy được bảng tháng ${thang}.`); }
else {
  luu("bang-" + me.code, bangKPI);
  log(`[${ss.s}] tháng ${bangKPI.month}: final_kpi=${bangKPI.final_kpi} · efficiency=${bangKPI.efficiency} · Tổng giờ KPIs=${bangKPI.kpis?.["KPI-001-06-01"]?.kpi}`
    + ` · total_task=${bangKPI.total_task}/finished ${bangKPI.total_task_finished} · timing_daily_task=${bangKPI.timing_daily_task}`);
  const bien = new Set();
  for (const v of Object.values(bangKPI.kpis || {})) if (v?.value && typeof v.value === "object" && !Array.isArray(v.value)) Object.keys(v.value).forEach(k => bien.add(k));
  Object.keys(bangKPI.kpi_item || {}).forEach(k => bien.add(k));
  const vs = [...bien].filter(k => /clean|sinh|planogram|shelf|counter|declar/i.test(k));
  log(`   ${Object.keys(bangKPI.kpis || {}).length} mục KPI · ${bien.size} biến đầu vào`);
  log("   ⚑ biến đầu vào liên quan VỆ SINH/PLANOGRAM: " + (vs.length ? vs.join(", ") : "KHÔNG CÓ"));
  log("   mục daily-task: " + JSON.stringify(bangKPI.kpis?.["COS-KPI-008-T02"]) + "  ⇒ không nhận gì từ khai báo planogram.");
  /* Kỹ năng: chỗ DUY NHẤT "vệ sinh quầy kệ" chạm KPI — thưởng kỹ năng CỐ ĐỊNH, không theo lượt */
  const kn = Object.entries(bangKPI.skill_revenue_logs || {}).filter(([, v]) => /v[eệ] sinh.*(qu[aầ]y|k[eệ])/i.test(String(v?.name)));
  log(`   skill_revenue=${bangKPI.skill_revenue}đ; kỹ năng "vệ sinh quầy kệ": ` + (kn.length ? kn.map(([k, v]) => `#${k} ${v.code} "${v.name.trim()}" = ${v.cost}đ (cấp ${String(v.date).slice(0, 10)})`).join(" | ") : "không có"));
}

/* ══ 4) HAI HỆ CÓ NỐI NHAU KHÔNG — bundle JS của hr.hasaki.vn ══ */
log("\n═══ 4) hr.hasaki.vn có đọc planogram không? (quét bundle JS, không cần auth) ═══");
try {
  const html = await (await fetch("https://hr.hasaki.vn/")).text();
  const src = (html.match(/src="([^"]+main[^"]*\.js)"/) || [])[1];
  const js = await (await fetch("https://hr.hasaki.vn" + src)).text();
  const dem = (w) => { let n = 0, i = js.indexOf(w); while (i > -1) { n++; i = js.indexOf(w, i + 1); } return n; };
  log(`   ${src} (${Math.round(js.length / 1024)} KB): `
    + ["planogram", "vệ sinh", "schedule-request"].map(w => `"${w}"=${dem(w)}`).join("  ")
    + "  ⇒ 0 tất cả = HR không hề đọc dữ liệu planogram.");
  const api = [...new Set([...js.matchAll(/["'`](\/hr\/[\w/{}$.-]*(?:kpi|task|sheet)[\w/{}$.-]*)["'`]/g)].map(m => m[1]))].sort();
  log("   endpoint KPI/task mà UI HR gọi: " + api.join(" "));
} catch (e) { log("   (không tải được bundle: " + e.message + ")"); }

/* ══ 5) ĐƯỜNG KPI VỆ SINH THẬT trong HR = daily task, không phải planogram ══ */
log("\n═══ 5) Định nghĩa daily-task vệ sinh của kho 398 (hr/task) ═══");
const defs = bang((await gj(`${WS}/hr/task?limit=500&offset=0`, HH)).j);
for (const r of defs.filter(x => (Array.isArray(x.location_id) ? x.location_id.includes("398") : String(x.location_id) === "398") && /v[eệ] sinh/i.test(x.name))) {
  log(`   #${r.id} "${r.name}" code=${r.code} wf=${r.workflow} dept=${r.department_id} major=${JSON.stringify(r.major_id)} khung ${r.time_start}–${r.time_end} report_to=${r.report_to}`);
}
log(`   ⇒ muốn vệ sinh được tính KPI thì báo cáo qua daily task này (major 26), không phải khai báo planogram (${me.staff_name} thuộc major ${me.major_id}).`);

/* ══ 6) Đối chiếu khối lượng hôm nay ══ */
log("\n═══ 6) Khai báo vệ sinh SHOP-170 ngày " + ngay + " ═══");
const t0 = new Date(ngay + "T00:00:00+07:00").getTime(), t1 = new Date(ngay + "T23:59:59+07:00").getTime();
const pg = await gj(`${EX}/planogram/schedule-requests?company_ids=1001&warehouse_ids=863&from_date=${t0}&to_date=${t1}&page=1&size=500`, HW);
const yeu = bang(pg.j);
const theoNguoi = {}, theoTT = {};
for (const x of yeu) { if (x.executed_by_name) theoNguoi[x.executed_by_name] = (theoNguoi[x.executed_by_name] || 0) + 1; theoTT[x.status_name] = (theoTT[x.status_name] || 0) + 1; }
log(`[${pg.s}] tổng ${yeu.length} yêu cầu · trạng thái ${JSON.stringify(theoTT)}`);
log("   đã báo cáo: " + (Object.entries(theoNguoi).map(([k, v]) => k + "=" + v).join("  ") || "chưa ai"));
process.exit(0);

/* ════════════════════════════════════════════════════════════════════════════
 *  ⚠ CẬP NHẬT 31/07/2026 (sau khi có ảnh cấu hình KPI của HR) — MẠCH THẬT:
 *    planogram: NV chụp ảnh báo cáo → phiếu sang status 3 (Waiting For Approve)
 *      → HR "Bin Location Report" (/company/daily-task/sku-checklist-daily,
 *        API GET https://wshr.hasaki.vn/api/v2/task/sku-daily-checklist, khớp bằng
 *        `schedule_request_code`; bảng 3,25 triệu dòng → lọc theo bin/mã phiếu 502 timeout)
 *      → KPI **COS-KPI-007-T14 "Thời gian vệ sinh cửa hàng"** (KPIs Thưởng),
 *        biến `Asset_Schedule_Declaration_Time_Personal` = TỔNG GIÂY trong tháng.
 *    Đối soát tháng 7/2026 (probe-kpi-vesinh-kho.mjs): 20/41 người khớp tuyệt đối;
 *    phần lệch đều giải thích được (lịch trả duration=0 nhưng KPI tính 360s/lượt;
 *    và bảng KPI là ẢNH CHỤP nên phiếu báo cáo trong ngày chưa kịp vào).
 *    ⇒ KPI cộng khi NV **BÁO CÁO**, KHÔNG chờ duyệt.
 *  Các mục 2–6 dưới đây vẫn đúng về phần "chấm công không chứa KPI" và
 *  "banghtt không có mục T14", nhưng KHÔNG còn đúng khi kết luận "HR không nối planogram".
 *
 *  KẾT QUẢ CHẠY 31/07/2026:
 *
 *  1. Yêu cầu 23932743: Approved, executed_by banghtt@hasaki.vn 13:21, tamlc duyệt 13:24.
 *     Bản ghi yêu cầu KHÔNG có field kpi/công/duration. `duration:600` là của LỊCH 508195
 *     (thời lượng cho phép khai báo, lịch Daily, khung 08:00–23:00) — không phải công được cộng.
 *  2. hr/timesheet có đúng 17 field (check_in/check_out/status/…) — KHÔNG có field KPI nào.
 *     ⚠ URL đang xem lọc major_id=26 nhưng banghtt thuộc major 103 (Quản lý đóng gói) → không
 *     bao giờ hiện trong danh sách đó.
 *  3. KPI thật = bảng tháng hr/sheet-summary. Tháng 7/2026 của banghtt: 70 mục KPI, mọi biến
 *     đầu vào là nghiệp vụ WMS (nhận IT/PO, pick/pack, transfer, hàng trả, băng chuyền) hoặc
 *     giờ công/kỹ năng. Mục daily-task COS-KPI-008-T02 → Timing_Dailytask=null ⇒ kpi 0.
 *     KHÔNG có biến nào nhận dữ liệu từ planogram.
 *  4. Bundle hr.hasaki.vn (16,7 MB): "planogram"=0, "vệ sinh"=0, "schedule-request"=0.
 *  5. Chỗ duy nhất "vệ sinh quầy kệ" chạm KPI của banghtt: KỸ NĂNG #4226 HSK-016-001-009
 *     " Vệ sinh tủ quầy kệ kho" = 6.670đ, cấp 18/10/2023 — thưởng kỹ năng CỐ ĐỊNH hằng tháng
 *     (trong skill_revenue 1.052.635đ), KHÔNG tăng theo từng lần khai báo.
 *  6. Đường HR để công vệ sinh kho được tính: daily task #441 COS-CL-014-001 "Báo cáo công việc
 *     vệ sinh (Kho Tổng)", workflow 551, dept 121, major 26, kho 398, khung 08:00–21:00.
 *
 *  ⚠ GIỚI HẠN QUYỀN: /hr/kpi/configs, /hr/kpi/items, /hr/task-daily trả 403 với token hiện có
 *    → không đọc được nhãn/công thức cấu hình KPI. Kết luận dựa trên bảng KPI ĐÃ TÍNH (biến đầu
 *    vào thật). Riêng mục COS-KPI-008-T01=202.04 có value rỗng nên không thấy nguồn; nhưng
 *    202.04 + 5.61 + 1.7 + 1.51 + 0.4 = 211.26 = đúng "Tổng giờ KPIs", và tháng 6 là 190.02
 *    (bám số ngày công), nên nó không phải kênh của khai báo vệ sinh.
 * ════════════════════════════════════════════════════════════════════════════ */
