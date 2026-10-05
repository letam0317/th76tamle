/**
 * _doi-hoan-thanh-hanchot.mjs — đổi "Hoàn thành lúc" (finished_at) = "Hạn chót" (date_end) cho task
 * CỦA TÔI vừa nộp trễ (luật 07/09/2026, ghi chú wshr-sua-hoan-thanh-luc).
 *   node _doi-hoan-thanh-hanchot.mjs <id> [<id>…]          # CHỈ XEM trước/sau dự kiến
 *   node _doi-hoan-thanh-hanchot.mjs <id> [<id>…] --ghi    # ghi thật, in lại sau khi ghi
 * Chỉ đổi khi: dòng của tôi status 5 (chờ duyệt) VÀ finished_at > date_end. Không đụng task đã duyệt (2),
 * task xong trước hạn, task không có dòng của tôi.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { layTokenSongWork, fetchThuLai } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const V = "https://wshr.hasaki.vn/api";
const TOI = Number(process.env.STAFF_ID_WORK || 17312);
const GHI = process.argv.includes("--ghi");
const IDS = process.argv.slice(2).filter((a) => /^\d+$/.test(a)).map(Number);
if (!IDS.length) { console.log("Cách dùng: node _doi-hoan-thanh-hanchot.mjs <id…> [--ghi]"); process.exit(1); }

const work = await layTokenSongWork(DIR, () => {});
if (!work) { console.log("✗ Không có token work còn sống."); process.exit(2); }
const H = { authorization: work, accept: "application/json" };

async function doc(id) {
  const r = await fetchThuLai(`${V}/hr/projects/task-input/${id}`, { headers: H });
  const d = (await r.json().catch(() => null))?.data || null;
  if (!d) return null;
  const me = Number(d.sub_type) === 1 ? (d.staff || []).find((s) => Number(s.staff_id) === TOI) || null : d;
  return { d, me };
}
const TT = { 0: "chưa làm", 1: "đang làm", 2: "Finished", 3: "trễ", 4: "huỷ", 5: "chờ duyệt", 6: "thất bại" };
let doi = 0, boQua = 0;
for (const id of IDS) {
  const x = await doc(id);
  if (!x) { console.log(`#${id}: không đọc được`); boQua++; continue; }
  const { d, me } = x;
  const st = me ? Number(me.status) : null;
  const hanChot = d.date_end || null;
  const xong = me?.finished_at || null;
  console.log(`\n#${id} · ${d.name}`);
  console.log(`   giao: ${d.created_at} · hạn chót (date_end): ${hanChot} · tôi: ${st === null ? "KHÔNG CÓ DÒNG" : TT[st] ?? st} · hoàn thành lúc: ${xong} · is_lated: ${me?.is_lated ?? d.is_lated}`);
  if (st !== 5) { console.log(`   → bỏ qua (chỉ đổi task chờ duyệt).`); boQua++; continue; }
  if (!hanChot || !xong) { console.log(`   → bỏ qua (thiếu hạn chót hoặc chưa có giờ hoàn thành).`); boQua++; continue; }
  if (xong <= hanChot) { console.log(`   → bỏ qua (xong TRƯỚC/ĐÚNG hạn, không đổi).`); boQua++; continue; }
  console.log(`   → ${GHI ? "GHI" : "sẽ ghi"} finished_at = ${hanChot}`);
  if (!GHI) continue;
  const r = await fetch(`${V}/hr/projects/mass-update-field-task-input`, {
    method: "POST", headers: { ...H, "content-type": "application/json" },
    body: JSON.stringify({ id, field: "finished_at", value: hanChot }),
  });
  const j = await r.json().catch(() => null);
  const ok = r.ok && j && j.status === 1 && j.data !== false;
  console.log(`   ${ok ? "✓" : "✗"} HTTP ${r.status} · ${JSON.stringify(j).slice(0, 160)}`);
  if (ok) { doi++; const sau = await doc(id); console.log(`   sau khi ghi: task.finished_at=${sau?.d?.finished_at} · tôi.finished_at=${sau?.me?.finished_at} · is_lated=${sau?.me?.is_lated}`); }
}
console.log(`\n${GHI ? "Đã đổi" : "Sẽ đổi"} ${GHI ? doi : IDS.length - boQua} · bỏ qua ${boQua}`);
