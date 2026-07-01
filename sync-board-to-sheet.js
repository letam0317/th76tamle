/**
 * ============================================================================
 *  BỘ ĐỒNG BỘ (từ file EXPORT của workflow) ──► tab "5S-TASKS" (cho dashboard)
 * ============================================================================
 *  Đọc file Excel mới nhất "Board-task-workflow-step-*-591-*.xlsx" trong Downloads
 *  (xuất từ nút Export trên work.hasaki.vn), đổi path ảnh/clip thành URL hr-media
 *  xem được, rồi ghi đè tab 5S-TASKS qua Apps Script (action=syncTasks).
 *
 *  Quy trình: bấm Export trên workflow 591 → chạy: node sync-board-to-sheet.js
 *  (hoặc bấm DONG-BO-TASK.bat)
 * ============================================================================
 */
import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";
import "dotenv/config";

const APPSCRIPT_URL = process.env.APPSCRIPT_URL || "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
const APPSCRIPT_KEY = process.env.APPSCRIPT_KEY;
const DOWNLOADS = process.env.DOWNLOADS_DIR || "C:/Users/lechitam/Downloads";
const MEDIA_BASE = "https://hr-media.hasaki.vn/production/hr/";
const WORKFLOW_ID = process.env.WORKFLOW_ID || "591";

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
if (!APPSCRIPT_KEY) { console.error("✗ Thiếu APPSCRIPT_KEY trong .env."); process.exit(3); }

// Path media -> URL hr-media (giữ nguyên nếu không phải media)
function convMedia(v) {
  if (typeof v !== "string" || !/task_wf(step)?config\//.test(v)) return v;
  return v.split(/[\s,]+/).filter(Boolean)
    .map(p => /task_wf(step)?config\//.test(p) ? MEDIA_BASE + p.replace(/^\/+/, "") : p)
    .join("\n");
}

// Chọn file export mới nhất
function fileExportMoiNhat() {
  const re = new RegExp("Board-task-workflow-step.*" + WORKFLOW_ID + ".*\\.xlsx$", "i");
  const files = fs.readdirSync(DOWNLOADS).filter(f => re.test(f))
    .map(f => ({ f, t: fs.statSync(path.join(DOWNLOADS, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  if (!files.length) throw new Error("Không thấy file Board-task-workflow-step-*-" + WORKFLOW_ID + "-*.xlsx trong " + DOWNLOADS + ". Hãy bấm Export trên workflow trước.");
  return path.join(DOWNLOADS, files[0].f);
}

(async () => {
  const file = fileExportMoiNhat();
  log("Đọc file export: " + path.basename(file));
  const wb = XLSX.readFile(file);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  if (aoa.length < 2) throw new Error("File export rỗng.");

  // Hàng 0 = nhóm bước (ô gộp -> forward fill); Hàng 1 = tên cột; từ hàng 2 = dữ liệu
  const nhom = aoa[0] || [], ten = aoa[1] || [];
  const soCot = Math.max(nhom.length, ten.length, ...aoa.slice(2).map(r => r.length));
  let nhomHienTai = "";
  const header = [];
  for (let i = 0; i < soCot; i++) {
    if (String(nhom[i] || "").trim()) nhomHienTai = String(nhom[i]).trim();
    const t = String(ten[i] || "").trim();
    header.push(nhomHienTai && i >= 6 ? (nhomHienTai + " ▸ " + t) : t);   // 6 cột đầu là thông tin chung
  }

  const rows = aoa.slice(2)
    .filter(r => String(r[0] || "").trim())   // bỏ dòng trống (không có Task Code)
    .map(r => {
      const out = [];
      for (let i = 0; i < soCot; i++) out.push(convMedia(r[i] != null ? r[i] : ""));
      return out;
    });

  log("→ " + rows.length + " task, " + header.length + " cột. Đang ghi tab 5S-TASKS...");
  const res = await fetch(APPSCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "syncTasks", key: APPSCRIPT_KEY, header, rows }),
  });
  let j = {}; try { j = JSON.parse(await res.text()); } catch {}
  if (j.status === "success") log("✓ Đã ghi " + j.written + " dòng vào tab 5S-TASKS lúc " + j.at);
  else log("✗ Ghi tab thất bại: " + JSON.stringify(j).slice(0, 200));
  process.exit(0);
})().catch(e => { log("✗ " + e.message); process.exit(2); });
