/**
 * qltt-phancong.mjs — SỔ "QLTT theo TASK PHÂN CÔNG VỆ SINH" (user chốt 25/09/2026).
 * ============================================================================================
 *  Nguồn CHUẨN NHẤT cho ô "Quản lý trực tiếp": các task hằng ngày sinh từ khuôn mẫu
 *  suggest 1297 "Sắp xếp hàng hóa kho tổng (Áp dụng cho kho tổng)" — NGƯỜI TẠO task chính là
 *  QLTT của mọi nhân viên trong danh sách được giao (đo 25/09: task 13901730 do Hà Trọng Thúc
 *  Bằng tạo cho 16 NV; task 13899765 do Diệp Quốc Hải tạo cho 11 NV — cả hai nhóm đều major
 *  Phát triển cửa hàng).
 *
 *  Vì wshr KHÔNG có API liệt kê task thường (đã dò >40 route 25/09 — chỉ có board workflow),
 *  sổ này nuôi bằng ID TASK NẠP TAY/nạp dần:
 *      node qltt-phancong.mjs --task=13901730,13899765     # nạp thêm task
 *      node qltt-phancong.mjs                              # in sổ + đối chiếu danh bạ
 *  Task nạp rồi lưu vĩnh viễn trong .cache-qltt-phancong.json (map NV→QLTT: lần MỚI hơn thắng).
 *  qltt.js đọc sổ này với ưu tiên CAO NHẤT (trên cả chat).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { layTokenSongWork } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const F_SO = path.join(DIR, ".cache-qltt-phancong.json");
const V = "https://wshr.hasaki.vn/api";
const SUGGEST_ID = 1297;
const log = (...a) => console.log(...a);
const boDau = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/\s+/g, " ").trim();

let so = { tasks: {}, map: {} };
try { so = { ...so, ...JSON.parse(fs.readFileSync(F_SO, "utf8")) }; } catch { /* lần đầu */ }

const doc = (ten) => { const a = process.argv.find((x) => x.startsWith("--" + ten + "=")); return a ? a.split("=").slice(1).join("=") : ""; };
const idsMoi = doc("task").split(",").map((s) => s.trim().replace(/\D/g, "")).filter(Boolean).filter((id) => !so.tasks[id]);

if (idsMoi.length) {
  const token = await layTokenSongWork(DIR, log);
  if (!token) { log("✗ Không có token work sống."); process.exit(1); }
  for (const id of idsMoi) {
    const d = (await (await fetch(V + "/hr/projects/task-input/" + id, { headers: { authorization: token, accept: "application/json" }, signal: AbortSignal.timeout(30000) })).json()).data;
    if (!d) { log("✗ " + id + ": không đọc được — bỏ."); continue; }
    if (Number(d.task_suggest_id) !== SUGGEST_ID && !/Sắp xếp hàng hóa kho tổng/i.test(String(d.name || ""))) {
      log("✗ " + id + " (" + String(d.name || "").slice(0, 50) + "): KHÔNG phải task phân công vệ sinh (suggest " + d.task_suggest_id + ") — bỏ.");
      continue;
    }
    const ql = d.created_by_user || {};
    const tenQL = ql.staff_name || ql.name || "?";
    const ngay = String(d.created_at || "").slice(0, 10);
    const members = (d.staff || []).map((x) => ({ code: String((x.info && x.info.code) || ""), ten: (x.info && x.info.staff_name) || "" })).filter((x) => x.code);
    so.tasks[id] = { ngay, qltt: tenQL, qlttCode: String(ql.code || ""), soNV: members.length };
    for (const m of members) {
      const cu = so.map[m.code];
      if (!cu || ngay > cu.ngay) so.map[m.code] = { ten: m.ten, qltt: tenQL, qlttCode: String(ql.code || ""), ngay, taskId: Number(id) };
    }
    log("✓ " + id + " (" + ngay + "): QLTT " + tenQL + " ← " + members.length + " NV.");
  }
  fs.writeFileSync(F_SO, JSON.stringify(so, null, 1), "utf8");
}

/* ---- in sổ + đối chiếu danh bạ (PTCH + Đóng gói, kho 170, còn làm) ---- */
const theoQL = new Map();
for (const [ma, x] of Object.entries(so.map)) {
  if (!theoQL.has(x.qltt)) theoQL.set(x.qltt, []);
  theoQL.get(x.qltt).push(ma + " " + x.ten);
}
log("\nSỔ QLTT THEO TASK PHÂN CÔNG — " + Object.keys(so.tasks).length + " task · " + Object.keys(so.map).length + " NV:");
for (const [ql, ds] of theoQL) log("  " + ql + " (" + ds.length + "): " + ds.join(" · "));

try {
  const db = JSON.parse(fs.readFileSync(path.join(DIR, ".cache-danhba.json"), "utf8")).data;
  const dsNV = db.filter((x) => String(x.working_loc_id) === "398" && Number(x.staff_status) === 1 &&
    ["phat trien cua hang", "dong goi"].includes(boDau(x.staff_major)) && Number(x.position_id) >= 6);
  const thieu = dsNV.filter((x) => !so.map[String(x.code)]);
  log("\nĐỐI CHIẾU danh bạ (PTCH + Đóng gói kho 170, staff còn làm): " + dsNV.length + " người · " +
    (dsNV.length - thieu.length) + " đã có trong phân công · THIẾU " + thieu.length + ":");
  for (const x of thieu) log("  · " + x.code + " " + x.staff_name + " (" + x.staff_major + ")");
} catch { log("(không đọc được danh bạ để đối chiếu)"); }
