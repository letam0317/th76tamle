/**
 * tra-vesinh-vitri.mjs — TRA 1 VỊ TRÍ: vì sao không có yêu cầu vệ sinh ngày X? (planogram.hasaki.vn)
 * =====================================================================================================
 *  Sinh 28/08/2026 từ câu hỏi "F0-A8-504-03-01-01 không có yêu cầu kiểm kê ngày 27/28-08". Chỉ GET WMS
 *  (token phiên sống — không đăng nhập mới), 3 lượt: yêu cầu của vị trí (mọi thời điểm) · lịch gốc đang
 *  sống của kho (lọc client — tham số location_description bị bỏ qua trên endpoint này) · chi tiết từng
 *  lịch liên quan (`is_view_schedule=true` tra được cả lịch đã huỷ).
 *  Luật đã kiểm chứng (memory a8-mat-lich-vesinh): CHỈ lịch Approved (loc_sched_status_id=3) mới sinh yêu
 *  cầu hằng ngày (job ~02:30); rớt về 2/1/6 là tắt ngay và XOÁ luôn yêu cầu New của ngày đó.
 *
 *  Chạy: node tra-vesinh-vitri.mjs F0-A8-504-03-01-01 [--kho=863] [--cty=1001] [--tu=2026-08-15]
 */
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { layTokenSongWms, fetchThuLai } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ARGS = process.argv.slice(2);
const LOC = (ARGS.find((a) => !a.startsWith("--")) || "").trim().toUpperCase();
const opt = (k, d) => { const a = ARGS.find((x) => x.startsWith("--" + k + "=")); return a ? a.slice(k.length + 3) : d; };
const WH = Number(opt("kho", 863)), CTY = Number(opt("cty", 1001)), TU = opt("tu", "");
if (!LOC) { console.error("Cách dùng: node tra-vesinh-vitri.mjs <mã vị trí> [--kho=863] [--cty=1001] [--tu=YYYY-MM-DD]"); process.exit(1); }
const log = (...a) => console.log(...a);
const EXT = "https://wms-gw-external.hasaki.vn/api/v1";
const ST_LICH = { 1: "Draft", 2: "Waiting for approve", 3: "Approved", 4: "Rejected", 5: "Expired", 6: "Canceled" };

const token = await layTokenSongWms(DIR, log);
if (!token) { log("✗ Không có token phiên sống — chạy lại khi operator online."); process.exit(2); }
const HX = { authorization: token, "Company-Ids": String(CTY), accept: "application/json" };
const getJ = async (u) => (await fetchThuLai(u, { headers: HX })).json();
const homNay = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });

/* 1) Mọi yêu cầu của vị trí */
const yc = [];
for (let p = 1; p <= 50; p++) {
  const j = await getJ(`${EXT}/planogram/schedule-requests?company_ids=${CTY}&warehouse_ids=${WH}&keyword_type=sku_or_barcode&location_description=${encodeURIComponent(LOC)}&page=${p}&size=100`);
  yc.push(...(j.records || []).filter((r) => String(r.location_description || "").toUpperCase() === LOC));
  if ((j.records || []).length < 100) break;
}
yc.sort((a, b) => String(b.request_time).localeCompare(String(a.request_time)));
log(`\n══ ${LOC} · kho ${WH} · hôm nay ${homNay} ══`);
log(`Yêu cầu vệ sinh từng có: ${yc.length}` + (yc.length ? ` · gần nhất ${yc[0].request_time} (#${yc[0].request_id}, ${yc[0].status_name}, lịch #${yc[0].schedule_id})` : ""));
const tu = TU || (yc.length ? String(yc[0].request_time).slice(0, 10) : homNay);
const theoNgay = {};
yc.forEach((r) => { const d = String(r.request_time).slice(0, 10); if (d >= tu) (theoNgay[d] = theoNgay[d] || []).push(r); });
log(`\nNhật ký theo ngày từ ${tu} (yêu cầu sinh lúc ~02:30 hoặc lượt chạy bù):`);
for (let d = new Date(tu + "T00:00:00Z"); d.toISOString().slice(0, 10) <= homNay; d = new Date(d.getTime() + 86400000)) {
  const k = d.toISOString().slice(0, 10), rs = theoNgay[k] || [];
  const dow = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][d.getUTCDay()];
  log(`  ${k} (${dow}): ` + (rs.length ? rs.map((r) => `#${r.request_id} ${String(r.request_time).slice(11, 19)} · ${r.status_name} · lịch #${r.schedule_id} · ảnh chuẩn ${(r.standard_image || []).filter((x) => String(x.image || "").trim()).length}`).join(" | ") : "— không có yêu cầu"));
}

/* 2) Lịch gốc đang sống của kho (list chỉ trả lịch chưa huỷ; lọc client theo vị trí) */
const schs = [];
for (let p = 1; p <= 30; p++) {
  const j = await getJ(`${EXT}/planogram/schedule/location-schedules?page=${p}&size=100&company_ids=${CTY}&warehouse_ids=${WH}`);
  schs.push(...(j.records || []));
  if (schs.length >= (j.count || 0) || !(j.records || []).length) break;
}
const lichSong = schs.filter((s) => String(s.location_description || "").toUpperCase() === LOC);
log(`\nLịch gốc ĐANG SỐNG của vị trí (list location-schedules, ${schs.length} lịch toàn kho): ${lichSong.length}`);
lichSong.forEach((s) => log(`  #${s.schedule_id} · trạng thái ${s.loc_sched_status_id} ${ST_LICH[s.loc_sched_status_id] || s.loc_sched_status_name || ""} · hiệu lực ${String(s.start_at || "").slice(0, 10)} → ${String(s.end_at || "").slice(0, 10)} · tạo ${s.created_at} bởi ${s.created_by_name || s.created_by} · sửa ${s.updated_at} bởi ${s.updated_by_name || s.updated_by}`));

/* 3) Chi tiết từng lịch liên quan (kể cả đã huỷ) */
const ids = [...new Set([...lichSong.map((s) => s.schedule_id), ...yc.slice(0, 40).map((r) => r.schedule_id)].filter(Boolean))];
log(`\nChi tiết lịch liên quan (${ids.length}):`);
for (const id of ids) {
  try {
    const j = await getJ(`${EXT}/planogram/schedule/location-schedules/detail/${id}?page=1&size=20&is_view_schedule=true`);
    const it = j && j.item; if (!it) { log(`  #${id}: không đọc được`); continue; }
    const muc = it.location_schedule_details || it.details || it.items || [];
    const nAnh = (Array.isArray(muc) ? muc : []).reduce((s, m) => s + ((m.standard_image || m.images || []).filter((x) => String((x && (x.image || x.url)) || "").trim()).length), 0);
    const ycLich = yc.filter((r) => r.schedule_id === id);
    log(`  #${id}: ${it.loc_sched_status_id} ${ST_LICH[it.loc_sched_status_id] || it.loc_sched_status_name || ""} · hiệu lực ${String(it.start_at || "").slice(0, 10)} → ${String(it.end_at || "").slice(0, 10)} · ${Array.isArray(muc) ? muc.length : "?"} mục / ${nAnh} ảnh · tạo ${it.created_at} (${it.created_by_name || it.created_by}) · sửa ${it.updated_at} (${it.updated_by_name || it.updated_by})` +
      (ycLich.length ? ` · đã sinh ${ycLich.length} yêu cầu, gần nhất ${ycLich[0].request_time}` : " · chưa sinh yêu cầu nào"));
    const khac = Object.keys(it).filter((k) => /status|approve|reject|cancel|reason|note/i.test(k) && it[k] != null && typeof it[k] !== "object");
    if (khac.length) log("     " + khac.map((k) => k + "=" + JSON.stringify(it[k])).join(" · "));
  } catch (e) { log(`  #${id}: lỗi ${e.message}`); }
}

/* 4) Kết luận máy */
const approved = lichSong.filter((s) => Number(s.loc_sched_status_id) === 3);
const ycHomNay = theoNgay[homNay] || [];
log("\nKẾT LUẬN:");
if (!lichSong.length) log("  ✗ Vị trí KHÔNG còn lịch gốc nào sống (mọi lịch đã Canceled/Expired) → không thể sinh yêu cầu. Cần dựng lại lịch và duyệt.");
else if (!approved.length) log(`  ✗ Lịch còn sống nhưng KHÔNG ở trạng thái Approved (${lichSong.map((s) => "#" + s.schedule_id + "=" + (ST_LICH[s.loc_sched_status_id] || s.loc_sched_status_id)).join(", ")}) → job đêm bỏ qua. Chỉ cần DUYỆT lại lịch (không dựng mới).`);
else if (!ycHomNay.length) log(`  ⚠ Có lịch Approved (${approved.map((s) => "#" + s.schedule_id).join(", ")}) nhưng hôm nay chưa có yêu cầu — xem hiệu lực start/end của lịch, ngày sửa gần nhất (rớt trạng thái rồi duyệt lại thì job chỉ bù khi chạy tay), hoặc job đêm của kho chưa chạy.`);
else log(`  ✓ Lịch Approved và hôm nay đã có yêu cầu (${ycHomNay.map((r) => "#" + r.request_id).join(", ")}).`);
