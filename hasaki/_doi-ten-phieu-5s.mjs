/**
 * _doi-ten-phieu-5s.mjs — đổi tên phiếu WF591 ĐANG MỞ sang khuôn mới «[5S] A1-503-10 - <hạng mục>» (ten-phieu-5s.js).
 * 13/10/2026 user + luật ra-viec-cu-sau-thay-doi: task CHA đã xong (2 / 4 / 6) thì để nguyên, chưa xong thì ghi đè.
 *   node _doi-ten-phieu-5s.mjs              # diễn tập: in tên cũ → mới, KHÔNG ghi
 *   node _doi-ten-phieu-5s.mjs --ghi [--chi=<id>]   # ghi thật qua mass-update-field-task-input (field=name), đọc lại để xác nhận
 * Nguồn danh sách: máy chủ nội bộ bang-591 (/api/du-lieu) — 0 lượt gọi wshr để liệt kê; mỗi phiếu 1 lượt đọc + (khi ghi) 1 lượt ghi + 1 lượt đọc lại.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { layTokenSongWork, fetchThuLai } from "./session-rules.js";
import { phienQC } from "./xacminh-dang-nhap.mjs";
import { tenPhieu5S } from "./ten-phieu-5s.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const V = "https://wshr.hasaki.vn/api";
const GHI = process.argv.includes("--ghi");
const CHI = (process.argv.find((a) => a.startsWith("--chi=")) || "").slice(6);
const D = await (await fetch("http://127.0.0.1:8591/api/du-lieu", { headers: { "x-hx-phien": phienQC() } })).json();
const ds = (D.phieu || []).filter((p) => !CHI || String(p.id) === CHI);
/* chữ hạng mục lấy NGUYÊN VĂN từ Quy định (tab QUY-DINH qua bang-591) — trường loi trên phiếu là option WF đã BỎ DẤU PHẨY */
const QD = await (await fetch("http://127.0.0.1:8591/api/quy-dinh", { headers: { "x-hx-phien": phienQC() } })).json().catch(() => []);
const chuan = (x) => String(x || "").toLowerCase().normalize("NFC").replace(/[^\p{L}\p{N}]+/gu, "");
const theoQD = (loi) => { const k = chuan(loi).slice(0, 40); if (!k) return ""; const q = QD.find((x) => chuan(x.cau).startsWith(k)); return q ? q.cau : ""; };
const work = await layTokenSongWork(DIR, () => {});
if (!work) { console.log("✗ Không có token work còn sống."); process.exit(2); }
const H = { authorization: work, accept: "application/json" };
const doc = async (id) => (await (await fetchThuLai(`${V}/hr/projects/task-input/${id}`, { headers: H })).json().catch(() => null))?.data || null;

let doi = 0, giu = 0, xong = 0, loi = 0;
for (const p of ds) {
  const d = await doc(p.id);
  if (!d) { console.log(`#${p.id}: không đọc được`); loi++; continue; }
  if ([2, 4, 6].includes(Number(d.status))) { xong++; continue; }   // task cha đã xong → để nguyên
  if (!/^\[5S\] /.test(String(d.name || ""))) { giu++; continue; }   // tên do NGƯỜI đặt (không theo khuôn máy) → không đụng
  const hangMuc = theoQD(p.loi) || String(d.name || "").replace(/^\[5S\] .*? - /, "");
  const moi = tenPhieu5S((p.lsKho && p.lsKho.bin) || p.viTri, hangMuc);
  if (moi === d.name) { giu++; continue; }
  console.log(`#${p.id}\n   cũ: ${d.name}\n   mới: ${moi}`);
  if (!GHI) { doi++; continue; }
  const r = await fetch(`${V}/hr/projects/mass-update-field-task-input`, { method: "POST", headers: { ...H, "content-type": "application/json" }, body: JSON.stringify({ id: Number(p.id), field: "name", value: moi }) });
  const j = await r.json().catch(() => null);
  const sau = await doc(p.id);
  if (sau && sau.name === moi) { doi++; console.log("   ✓ đã đổi"); } else { loi++; console.log(`   ✗ HTTP ${r.status} · ${JSON.stringify(j).slice(0, 140)} · đọc lại: ${sau && sau.name}`); }
  await new Promise((r) => setTimeout(r, 400));
}
console.log(`\nRà ${ds.length} phiếu · ${GHI ? "đã đổi" : "sẽ đổi"} ${doi} · đúng tên sẵn ${giu} · task đã xong (để nguyên) ${xong} · lỗi ${loi}`);
