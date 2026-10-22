// ghi-chu.mjs — SỔ GHI CHÚ CẢI TIẾN (nút «Ghi chú» ở pop-up Xác minh) · 20/10/2026
// User 20/10: «xử lý các ghi chú chưa · mục đã ghi chú rồi phải cải tiến, ghi nhớ cho lần sau · mục đang cải tiến / cải tiến rồi / chờ
//   cải tiến cần có cờ để nhận biết — loại bỏ — làm mờ». Sổ: .exports/ghi-chu-cai-tien.json (máy chủ 8591 ghi khi bấm nút).
// Trạng thái tt: cho = chờ cải tiến · dang = đang cải tiến · xong = đã cải tiến · bo = không làm (kèm lý do). «xong» = câu đã sửa gì / lý do.
// Bảng Xác minh: mục có ghi chú hiện cờ «Ghi chú · <trạng thái>», làm mờ và dồn xuống cuối danh sách.
//
//   node ghi-chu.mjs                       liệt kê ghi chú CHƯA xong (cho / dang) — ĐỌC ĐẦU MỖI PHIÊN làm Xác minh
//   node ghi-chu.mjs --tat-ca              liệt kê tất cả
//   node ghi-chu.mjs dat <id> <at|so> <cho|dang|xong|bo> ["đã sửa gì / lý do"]   (so = số thứ tự ở bảng liệt kê)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ghiJson } from "./so-ghi.mjs";   // 20/10 ghi sổ JSON an toàn (ghi tạm → đổi tên) + nhật ký ai ghi

const F = path.join(path.dirname(fileURLToPath(import.meta.url)), ".exports", "ghi-chu-cai-tien.json");
const TEN = { cho: "chờ cải tiến", dang: "đang cải tiến", xong: "đã cải tiến", bo: "không làm" };
export const ttCua = (g) => g.tt || (g.xong ? "xong" : "cho");
const doc = () => { try { return JSON.parse(fs.readFileSync(F, "utf8")); } catch { return []; } };

if (process.argv[1] && path.basename(process.argv[1]) === "ghi-chu.mjs") {
  const A = process.argv.slice(2), so = doc();
  if (A[0] === "dat") {
    const [, id, khoa, tt, ...cau] = A;
    if (!TEN[tt]) { console.error("trạng thái phải là: " + Object.keys(TEN).join(" | ")); process.exit(2); }
    const g = /^\d+$/.test(khoa) && Number(khoa) <= so.length ? so[Number(khoa) - 1] : so.find((x) => x.id === id && x.at === khoa);
    if (!g || g.id !== id) { console.error("không thấy ghi chú " + id + " / " + khoa); process.exit(1); }
    g.tt = tt; if (cau.length) g.xong = cau.join(" ").slice(0, 600); g.ttLuc = new Date().toISOString();
    ghiJson(F, so, { thut: 1 });
    console.log(`✓ ${id} → ${TEN[tt]}${g.xong ? " · " + g.xong : ""}`);
  } else {
    /* 22/10 user: ghi chú của người khác tamlc phải được DUYỆT (Nhật ký) mới đưa Claude làm — «chờ duyệt» / «không duyệt» không liệt kê (--tat-ca vẫn hiện) */
    const tatCa = A.includes("--tat-ca"); let n = 0, choDuyet = 0;
    so.forEach((g, i) => {
      const tt = ttCua(g); if (!tatCa && (tt === "xong" || tt === "bo")) return;
      if (!tatCa && g.duyet && g.duyet !== "ok") { if (g.duyet === "cho") choDuyet++; return; }
      n++;
      console.log(`#${i + 1} [${TEN[tt]}] ${g.loai} ${g.id} · ${g.tieuDe}\n   ${g.at.slice(0, 16).replace("T", " ")} ${g.boi}: ${String(g.noiDung).replace(/\n/g, " / ")}${g.xong ? "\n   → " + g.xong : ""}`);
    });
    console.log(n ? `— ${n} ghi chú` : "Không còn ghi chú chờ cải tiến.");
    if (choDuyet) console.log(`(${choDuyet} ghi chú của người khác đang CHỜ tamlc duyệt ở Nhật ký — chưa làm)`);
  }
}
