/**
 * _quet-task-treo.mjs — PROBE CHỈ ĐỌC: quét task hằng ngày (sổ tay task-hangngay.mjs) còn treo.
 *   node _quet-task-treo.mjs [--ngay=35] [--json]
 * Đường đi: notifications?limit=1000 (object_type=4) → task-input/{id} → trạng thái dòng CỦA TÔI.
 * Treo = status 0 (chưa làm) · 1 (đang làm) · 3 (trễ) · null (không có dòng của tôi dù sub_type=1).
 * KHÔNG ghi gì lên wshr.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { layTokenSongWork, fetchThuLai, moTaLoiMang } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const V = "https://wshr.hasaki.vn/api";
const TOI = Number(process.env.STAFF_ID_WORK || 17312);
const SO_NGAY = Number((process.argv.find((a) => a.startsWith("--ngay=")) || "--ngay=35").slice(7));
const JSON_OUT = process.argv.includes("--json");

const SO_TAY = [
  /^Kiểm kê SKU/i, /^Kiểm kê Location/i, /Kiểm kê theo vị trí.*full location/i, /Kiểm tra 5S kho tổng/i,
  /bất thường.*MATERIAL - MTG/i, /bất thường.*MATERIAL - GARMENT/i, /Sắp xếp hàng hóa trong kho/i,
  /^\s*Sắp xếp hàng hóa tại kho tổng\s*$/i, /Dán tem QC Fail/i,
];
const TT = { 0: "chưa làm", 1: "đang làm", 2: "Finished", 3: "trễ", 4: "huỷ", 5: "chờ duyệt", 6: "thất bại" };
const log = (s) => { if (!JSON_OUT) console.log(s); };

const work = await layTokenSongWork(DIR, log);
if (!work) { console.log("✗ Không có token work còn sống."); process.exit(2); }
const H = { headers: { authorization: work, accept: "application/json" } };

const r = await fetchThuLai(`${V}/news/notifications?limit=1000`, H);
const j = await r.json().catch(() => null);
const rows = j?.data?.rows || [];
const moc = new Date(Date.now() - SO_NGAY * 86400000).toISOString().slice(0, 10);
const thay = new Map();
for (const n of rows) {
  if (n.object_type !== 4) continue;
  const ngay = String(n.created_at || "").slice(0, 10);
  if (ngay < moc) continue;
  if (!thay.has(n.object_id)) thay.set(n.object_id, { id: n.object_id, ten: String(n.title || "").replace(/^Task:\s*/i, ""), ngay });
}
const ds = [...thay.values()].sort((a, b) => a.ngay.localeCompare(b.ngay) || a.id - b.id);
log(`${rows.length} thông báo · ${ds.length} task giao từ ${moc} (object_type=4) · đọc chi tiết từng task…`);

async function chiTiet(id) {
  try { const rr = await fetchThuLai(`${V}/hr/projects/task-input/${id}`, H); const jj = await rr.json().catch(() => null); return jj?.data || null; }
  catch (e) { return { loi: moTaLoiMang(e) }; }
}
const ket = [];
let i = 0;
async function worker() {
  while (i < ds.length) {
    const t = ds[i++];
    const d = await chiTiet(t.id);
    if (!d || d.loi) { ket.push({ ...t, loi: d?.loi || "không đọc được" }); continue; }
    const sub = Number(d.sub_type);
    const me = sub === 1 ? (d.staff || []).find((s) => Number(s.staff_id) === TOI) : null;
    const st = sub === 1 ? (me ? Number(me.status) : null) : Number(d.status);
    ket.push({
      ...t, ten: d.name || t.ten, sub, st, ttCha: Number(d.status), soTay: SO_TAY.some((re) => re.test(d.name || t.ten)),
      is_lated: me?.is_lated ?? d.is_lated ?? null, old_finished_at: me?.old_finished_at ?? d.old_finished_at ?? null,
      finished_at: me?.finished_at ?? d.finished_at ?? null, deadline: d.deadline || d.finished_at_plan || null,
      nguoiGiao: d.created_by_user?.name || d.created_by_name || null,
    });
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
ket.sort((a, b) => a.ngay.localeCompare(b.ngay) || a.id - b.id);

const treo = ket.filter((k) => !k.loi && (k.st === null || [0, 1, 3].includes(k.st)));
if (JSON_OUT) { console.log(JSON.stringify({ moc, tong: ket.length, treo, loi: ket.filter((k) => k.loi) }, null, 2)); process.exit(0); }

const bang = (ds) => ds.forEach((k) => console.log(
  `  ${k.ngay} · https://work.hasaki.vn/tasks?task_id=${k.id} · ${k.ten} · tôi: ${k.st === null ? "KHÔNG CÓ DÒNG" : TT[k.st] ?? k.st}` +
  ` · cha: ${TT[k.ttCha] ?? k.ttCha}` + (k.is_lated ? " · trễ" : "") + (k.old_finished_at ? ` · old_finished_at=${k.old_finished_at}` : "")));
console.log(`\n=== TASK SỔ TAY CÒN TREO: ${treo.filter((k) => k.soTay).length} ===`); bang(treo.filter((k) => k.soTay));
console.log(`\n=== TASK NGOÀI SỔ TAY (workflow/khác) CÒN TREO: ${treo.filter((k) => !k.soTay).length} ===`); bang(treo.filter((k) => !k.soTay));
const loi = ket.filter((k) => k.loi); if (loi.length) { console.log(`\n=== KHÔNG ĐỌC ĐƯỢC: ${loi.length} ===`); loi.forEach((k) => console.log(`  ${k.ngay} · #${k.id} · ${k.ten} · ${k.loi}`)); }
console.log(`\nTổng ${ket.length} task · đã xong/chờ duyệt ${ket.length - treo.length - loi.length} · treo ${treo.length}`);
