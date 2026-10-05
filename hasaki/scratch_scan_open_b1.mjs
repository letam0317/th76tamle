import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { layTokenSongWork } from "./session-rules.js";
import { docSoQLTT, timQLTT } from "./qltt.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const V = "https://wshr.hasaki.vn/api";
const WORKFLOW_ID = "591";
const CACHE_DB = path.join(DIR, ".cache-nv170.json");

const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);

async function layDanhBa(token) {
  try {
    const c = JSON.parse(fs.readFileSync(CACHE_DB, "utf8"));
    if (Date.now() - c.at < 12 * 3600 * 1000 && Array.isArray(c.data) && c.data.length) return c.data;
  } catch {}
  try {
    const res = await fetch(V + "/news/staff/search-for-dropdown?limit=10000&sort=staff_id", { headers: { authorization: token } });
    const j = await res.json();
    const data = j.data || j.rows || [];
    if (data.length) try { fs.writeFileSync(CACHE_DB, JSON.stringify({ at: Date.now(), data })); } catch {}
    return data;
  } catch {
    try { return JSON.parse(fs.readFileSync(CACHE_DB, "utf8")).data || []; } catch { return []; }
  }
}

function timNhanVien(q, db) {
  if (!q || !db.length) return null;
  const s = String(q).trim().toLowerCase(), user = s.includes("@") ? s.split("@")[0] : s;
  return db.find((x) => {
    const em = String(x.staff_email || "").toLowerCase();
    return em === s || (em.includes("@") ? em.split("@")[0] : em) === user ||
      String(x.code || "").toLowerCase() === s || String(x.staff_id || "") === s ||
      String(x.staff_name || "").toLowerCase() === s;
  }) || null;
}

(async () => {
  log("🔍 Đang lấy token và danh sách task từ Workflow 591...");
  const token = await layTokenSongWork(DIR, log);
  if (!token) { log("✗ Không lấy được token."); process.exit(1); }

  const db = await layDanhBa(token);
  log(`✓ Đã nạp danh bạ (${db.length} nhân viên).`);

  // Quét 60 ngày gần đây
  const tu = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
  const den = new Date().toISOString().slice(0, 10);
  const url = `${V}/hr/workflows/detail-workflow-task/${WORKFLOW_ID}?from_date=${tu}&to_date=${den}&search_type=board`;

  const r = await fetch(url, { headers: { authorization: token }, signal: AbortSignal.timeout(30000) });
  const j = await r.json();

  const allTasks = [];
  (function walk(o) {
    if (Array.isArray(o)) return o.forEach(walk);
    if (o && typeof o === "object") {
      if (Array.isArray(o.subtasks) && /^HSK-/.test(o.code || "")) allTasks.push(o);
      for (const k in o) walk(o[k]);
    }
  })(j);

  log(`📌 Tổng số task tìm thấy trong Workflow 591: ${allTasks.length}`);

  const openB1Tasks = [];

  for (const cha of allTasks) {
    const b1 = (cha.subtasks || []).find((s) => String(s.workflow_step_id) === "7379" || /B1\./i.test(s.name || ""));
    // B1 status: 0 (Pending), 1 (In Progress). Status 2, 4, 6 are finished/closed/cancelled
    if (b1 && (b1.status === 0 || b1.status === 1)) {
      openB1Tasks.push({ cha, b1 });
    }
  }

  log(`📌 Số task ĐANG MỞ (pending/in progress) ở bước B1: ${openB1Tasks.length}\n`);

  if (!openB1Tasks.length) {
    log("🎉 Không có task nào đang treo mở ở bước B1!");
    return;
  }

  const readyToProcess = [];

  for (const { cha, b1 } of openB1Tasks) {
    log(`------------------------------------------------------------------`);
    log(`Task Code: ${cha.code} | Task ID: ${cha.id} | B1 Subtask ID: ${b1.id} | B1 Status: ${b1.status}`);
    log(`Tiêu đề: ${cha.name}`);

    // Đọc chi tiết task-input
    const detailRes = await fetch(`${V}/hr/projects/task-input/${cha.id}`, { headers: { authorization: token } });
    const detailJson = await detailRes.json();
    const d = detailJson && detailJson.data;

    const configs = (d && d.data && d.data.configs) || {};
    const staff = configs.staff || "";
    const description = d.description || (d.data && d.data.hienTrang) || "";
    
    log(`  [Data configs] staff: "${staff}"`);
    
    let qNV = staff;
    if (!String(qNV).trim()) {
      const dongPT = String(description).split("\n").map((l) => l.trim())
        .find((l) => /^Phụ trách:/i.test(l) && /KHÔNG báo cáo vệ sinh ô này/i.test(l));
      const maPT = dongPT && dongPT.match(/\((\d{4,})\)/);
      if (maPT) {
        qNV = maPT[1];
        log(`  [Dò description] Thấy dòng Phụ trách: ${dongPT}`);
      }
    }

    if (qNV && String(qNV).trim()) {
      const nvQueries = String(qNV).split(",").map(s => s.trim()).filter(Boolean);
      const ds = nvQueries.map(q => timNhanVien(q, db)).filter(Boolean);
      log(`  ✅ ĐỦ ĐIỀU KIỆN TỰ ĐỘNG CHUYỂN B1.1! NV Vi Phạm: ${ds.map(x => `${x.staff_name} (${x.code})`).join(", ") || qNV}`);
      readyToProcess.push({ taskId: cha.id, code: cha.code, qNV, ds });
    } else {
      log(`  ❌ CHƯA THỎA ĐIỀU KIỆN: Chưa có thông tin NV vi phạm trong task configs hoặc Phụ trách chưa báo cáo.`);
    }
  }

  log(`\n==================================================================`);
  log(`TỔNG KẾT: ${readyToProcess.length} task đủ điều kiện tự động đóng B1 -> chuyển B1.1`);
  log(`==================================================================`);
  for (const item of readyToProcess) {
    log(` - Task ${item.code} (${item.taskId}): NV = ${item.qNV}`);
  }
})();
