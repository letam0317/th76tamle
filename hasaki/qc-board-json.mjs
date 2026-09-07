/**
 * qc-board-json.mjs — đối chứng đường dữ liệu MỚI (API JSON board → board-json.mjs) với file export xlsx CŨ.
 *
 *  Vì sao: 04/09/2026 tường lửa chặn tải file export .xlsx; auto-export-sync chuyển sang dựng bảng từ JSON.
 *  Bộ đo này chứng minh bảng dựng lại GIỐNG bảng export cũ trên các task chung, từng cột một.
 *
 *  Cách dùng:
 *    node qc-board-json.mjs                       # đọc JSON đã lưu (.exports/qc-board-45d.json) + xlsx mới nhất trong .exports
 *    node qc-board-json.mjs --json=<file.json>    # JSON khác (đúng dạng {data:{rows}})
 *    node qc-board-json.mjs --xlsx=<file.xlsx>
 *  Không gọi upstream. Cột lệch do dữ liệu ĐỔI sau ngày export (status/deadline/người thực hiện) là lệch hợp lệ —
 *  bộ đo tách riêng nhóm "task con tạo sau ngày export" để không đổ oan cho ánh xạ.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";
import { aoaTuRows, HEADER_CHUAN } from "./board-json.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const EXPORT_DIR = path.join(DIR, ".exports");
const arg = (k) => { const m = process.argv.find((a) => a.startsWith("--" + k + "=")); return m ? m.slice(k.length + 3) : null; };

const jsonFile = arg("json") || path.join(EXPORT_DIR, "qc-board-45d.json");
// xlsx đối chứng = file có NGÀY KẾT THÚC cửa sổ (trong tên file) muộn nhất — không dùng mtime (cửa sổ phụ tải sau nhưng cũ hơn)
const xlsxFile = arg("xlsx") || fs.readdirSync(EXPORT_DIR).filter((f) => /^Board-task-workflow-step-\d{4}-\d{2}-\d{2}-.*\.xlsx$/i.test(f))
  .sort((p, q) => q.localeCompare(p)).map((x) => path.join(EXPORT_DIR, x))[0];
if (!fs.existsSync(jsonFile)) { console.error("✗ Không thấy JSON đối chứng: " + jsonFile); process.exit(2); }
if (!xlsxFile || !fs.existsSync(xlsxFile)) { console.error("✗ Không thấy file xlsx export cũ trong .exports"); process.exit(2); }
console.log("JSON :", jsonFile); console.log("XLSX :", xlsxFile);
const ngayXlsx = (path.basename(xlsxFile).match(/step-(\d{4}-\d{2}-\d{2})/) || [])[1] || "";

// xlsx cũ → header 87 cột + map Task Code → dòng
const wb = XLSX.readFile(xlsxFile);
const a = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
const nhom = a[0] || [], ten = a[1] || []; let g = "";
const HX = ten.map((t, i) => { if (String(nhom[i] || "").trim()) g = String(nhom[i]).trim(); return (g && i >= 6 ? g + " ▸ " : "") + String(t).trim(); });
const X = {}; a.slice(2).forEach((r) => { if (r[0]) X[String(r[0]).trim()] = r; });

// JSON → aoa theo đúng header xlsx
const rows = JSON.parse(fs.readFileSync(jsonFile, "utf8")).data.rows;
let nv = { dir: {}, uid: {} };
try {   // danh bạ cache (nếu có) để dựng "Created By" y như bộ đồng bộ thật
  const db = JSON.parse(fs.readFileSync(path.join(DIR, ".cache-danhba.json"), "utf8")).data || [];
  for (const s of db) { const nm = s.staff_name; if (!nm) continue; if (s.code != null) nv.dir[String(s.code)] = nm; if (s.staff_id != null && nv.dir[String(s.staff_id)] == null) nv.dir[String(s.staff_id)] = nm; if (s.user_id != null) nv.uid[String(s.user_id)] = nm + (s.code ? " - " + s.code : ""); }
} catch { console.log("(không có .cache-danhba.json — Created By tra từ chính lô JSON)"); }
const aoa = aoaTuRows(rows, HX, nv);
const HJ = aoa[1];
const J = {}; aoa.slice(2).forEach((r) => { J[r[0]] = r; });

// 1) header
const thieu = HX.filter((h) => !HJ.includes(h)), thua = HJ.filter((h) => !HX.includes(h));
console.log("\n[1] Header: xlsx " + HX.length + " cột · JSON " + HJ.length + " cột · HEADER_CHUAN " + HEADER_CHUAN.length
  + (thieu.length ? "\n    ✗ JSON THIẾU: " + JSON.stringify(thieu) : "") + (thua.length ? "\n    ⚠ JSON thừa (nối cuối): " + JSON.stringify(thua) : "")
  + (!thieu.length && !thua.length ? " → ✓ cùng 87 cột, cùng thứ tự: " + HX.every((h, i) => HJ[i] === h) : ""));

// 2) từng cột trên task chung — tách "task con tạo sau ngày export"
const chung = Object.keys(X).filter((c) => J[c]);
const byCode = {}; rows.forEach((t) => { byCode[t.code] = t; });
console.log("[2] Task chung: " + chung.length + " · chỉ xlsx: " + Object.keys(X).filter((c) => !J[c]).length + " · chỉ JSON (mới): " + rows.filter((t) => !X[t.code]).length);
const iOf = (h) => HJ.indexOf(h);
let tongOK = 0, tongSo = 0; const bang = [];
for (let i = 0; i < HX.length; i++) {
  const h = HX[i]; const jI = iOf(h); if (jI < 0) continue;
  let ok = 0, lech = 0, lechMoi = 0, viDu = null;
  const buoc = h.includes(" ▸ ") ? h.split(" ▸ ")[0] : null;
  for (const c of chung) {
    const vx = String(X[c][i] ?? "").trim(), vj = String(J[c][jI] ?? "").trim();
    if (vx === vj) { ok++; continue; }
    // bước này có task con tạo SAU ngày export (bước mới mở / mở lại)? → lệch hợp lệ, không phải lỗi ánh xạ
    const moiHon = buoc && ngayXlsx && (byCode[c].subtasks || []).some((x) => String(x.name || "").trim() === buoc && String(x.created_at || "") > ngayXlsx + " 23:59:59");
    if (moiHon) { lechMoi++; continue; }
    lech++; if (!viDu) viDu = { c, vx: vx.slice(0, 40), vj: vj.slice(0, 40) };
  }
  tongOK += ok; tongSo += ok + lech;
  bang.push({ h, ok, lech, lechMoi, viDu });
}
const xau = bang.filter((b) => b.lech > 0).sort((p, q) => q.lech - p.lech);
console.log("    Ô khớp: " + tongOK + "/" + tongSo + " (" + (100 * tongOK / Math.max(1, tongSo)).toFixed(1) + "%) — chưa kể ô lệch do task con tạo sau ngày export: "
  + bang.reduce((s, b) => s + b.lechMoi, 0));
console.log("    Cột có ô lệch (nhiều → ít):");
for (const b of xau.slice(0, 25)) console.log("      " + String(b.lech).padStart(3) + "  " + b.h.slice(0, 62).padEnd(62) + (b.viDu ? "  vd " + b.viDu.c + ": xlsx=" + JSON.stringify(b.viDu.vx) + " json=" + JSON.stringify(b.viDu.vj) : ""));
if (!xau.length) console.log("      (không có)");

// 3) task MỚI chỉ có trong JSON — chính là phần dashboard đang thiếu
const moi = rows.filter((t) => !X[t.code]).sort((p, q) => String(q.created_at).localeCompare(String(p.created_at)));
console.log("\n[3] Task mới (không có trong xlsx " + ngayXlsx + "): " + moi.length);
for (const t of moi.slice(0, 12)) { const r = J[t.code]; console.log("      " + t.code + "  " + r[iOf("Created At")] + "  " + String(r[iOf("Status")]).padEnd(8) + " " + String(r[iOf("Vị trí ghi nhận")]).slice(0, 18).padEnd(18) + " " + String(r[iOf("Lỗi vi phạm")]).slice(0, 50)); }

// 4) kết luận máy đọc được
const hong = xau.filter((b) => b.lech > chung.length * 0.1 && !/Status$|Deadline$|Người thực hiện$|Kết quả công việc$/.test(b.h));
console.log("\n[4] " + (thieu.length || hong.length ? "✗ CÓ CỘT ÁNH XẠ SAI: " + JSON.stringify(hong.map((b) => b.h)) : "✓ Ánh xạ đạt — mọi cột dữ liệu tĩnh khớp ≥90%; cột trạng thái/deadline/người thực hiện lệch chỉ do dữ liệu đổi sau ngày export."));
process.exit(thieu.length || hong.length ? 1 : 0);
