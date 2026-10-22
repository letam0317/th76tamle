/**
 * qc-nv-mo-ta.mjs — QC chốt chặn «[NF]/[ĐG] giao đúng NV ghi ở Mô tả» (22/10 user: «phải ghi nhớ bắn đúng tránh bắn nhầm»).
 * Ca thật: 14223350 (Vũ, máy từng giao Tú) · 14218546 (Bình + Hoan, máy từng giao Minh). 0 lượt gọi mạng (danh bạ cache).
 *   node qc-nv-mo-ta.mjs     → exit 0 khi mọi ca đúng
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { nvTheoMoTa, khopMoTa } from "./nv-mo-ta.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const DB = JSON.parse(fs.readFileSync(path.join(DIR, ".cache-danhba.json"), "utf8")).data || [];
const NF1 = "<p>Ghi chú người kiểm: Vũ bắn hệ thống 48 nhưng hàng thực tế là 18</p><p>Nhân viên vi phạm: Nguyễn Tấn Vũ (đẩy hàng)</p><p>Người kiểm: admin</p>";
const NF2 = "<p>Nhân viên vi phạm: Trương Thanh Bình (đẩy hàng), Đỗ Minh Hoan (đẩy hàng)</p>";
const DG = "<p>Nhân viên đóng gói: Ma Nguyễn Thanh Vân (vanmnt@hasaki.vn)</p>";
const CA = [
  ["14223350 giao Tú (lỗi cũ) → chặn", NF1, ["221959"], false],
  ["14223350 giao Vũ → cho ghi", NF1, ["262253"], true],
  ["14218546 giao Minh (lỗi cũ) → chặn", NF2, ["242485"], false],
  ["14218546 giao thiếu 1 người → chặn", NF2, ["251308"], false],
  ["14218546 giao Bình + Hoan → cho ghi", NF2, ["251308", "253397"], true],
  ["[ĐG] đúng người đóng gói → cho ghi", DG, ["254393"], true],
  ["[ĐG] giao người khác → chặn", DG, ["221959"], false],
  ["tên không có trong danh bạ → chặn", "<p>Nhân viên vi phạm: Không Có Ai Tên Này</p>", ["221959"], false],
];
let sai = 0;
for (const [ten, note, giao, muon] of CA) {
  const mt = nvTheoMoTa(note, DB), ra = !!mt && khopMoTa(mt, giao);
  if (ra !== muon) sai++;
  console.log((ra === muon ? "đạt  " : "SAI  ") + ten + (mt ? " · Mô tả → " + mt.ds.map((n) => n.code).join(",") + (mt.thieu.length ? " thiếu: " + mt.thieu.join(", ") : "") : " · không đọc được dòng"));
}
if (nvTheoMoTa("<p>Ghi chú: không ghi người</p>", DB) !== null) { sai++; console.log("SAI  Mô tả không có dòng NV phải trả null (không xét)"); }
console.log("QC NV ở Mô tả: " + (CA.length + 1 - sai) + "/" + (CA.length + 1) + " đạt");
process.exit(sai ? 1 : 0);
