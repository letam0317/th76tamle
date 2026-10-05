import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { layTokenSongWork } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const V = "https://wshr.hasaki.vn/api";
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);

export function cleanMoTaSP(note) {
  if (!note || !note.includes("Mã SP quét:")) return note;

  return note.replace(/Mã SP quét:\s*([^\n·()]+?)(?:\s*→\s*SKU\s*([0-9a-zA-Z_-]+))?\s*(?:·|\(|https?:\/\/|$)[^\n]*/g, (match, ma, sku) => {
    let clean = "Mã SP quét: " + ma.trim();
    if (sku) {
      clean += " → SKU " + sku.trim();
    }
    return clean;
  });
}

async function run() {
  console.log("==================================================================");
  console.log("🔍 RÀ SOÁT & LÀM SẠCH MÔ TẢ TẤT CẢ TASK TRONG WORKFLOW 591");
  console.log("==================================================================\n");

  const token = await layTokenSongWork(DIR, log);
  if (!token) {
    console.log("✗ Không lấy được token work.hasaki.vn.");
    return;
  }

  const tuDate = "2026-08-01";
  const denDate = new Date().toISOString().slice(0, 10);
  const url = `${V}/hr/workflows/detail-workflow-task/591?from_date=${tuDate}&to_date=${denDate}&search_type=boa`;

  log(`🔍 Đang lấy danh sách task workflow 591...`);
  const r = await fetch(url, { headers: { authorization: token, accept: "application/json" } });
  const j = await r.json().catch(() => ({}));

  if (!j) {
    log("✗ Không đọc được dữ liệu workflow 591");
    return;
  }

  const allTasks = [];
  (function walk(o) {
    if (Array.isArray(o)) return o.forEach(walk);
    if (o && typeof o === "object") {
      if (/^HSK-/i.test(o.code || "") && o.id) {
        allTasks.push(o);
      }
      for (const k in o) walk(o[k]);
    }
  })(j);

  log(`📌 Tìm thấy tổng cộng ${allTasks.length} task(s) trong workflow 591.`);

  // Parse task-91 log file to get original notes if any task was prematurely truncated
  const logFile = path.join(process.env.USERPROFILE || "C:\\Users\\lechitam", ".gemini\\antigravity-cli\\brain\\b10b53c5-e22f-432b-bde3-1da540c7d5f7\\.system_generated\\tasks\\task-91.log");
  const oldNotesMap = new Map();
  if (fs.existsSync(logFile)) {
    try {
      const logContent = fs.readFileSync(logFile, "utf8");
      const blocks = logContent.split(/\[#\d+\] ID: /g).slice(1);
      for (const b of blocks) {
        const idMatch = b.match(/^(\d+) \| Code: ([^\n]+)/);
        const oldMatch = b.match(/Mô tả CŨ:\s*\n([\s\S]*?)\n\s*Mô tả MỚI:/);
        if (idMatch && oldMatch) {
          const id = idMatch[1];
          const oldNote = oldMatch[1].split("\n").map(l => l.trim()).join("\n");
          oldNotesMap.set(id, oldNote);
        }
      }
      log(`✓ Đã nạp ${oldNotesMap.size} ghi chú gốc từ log task-91.`);
    } catch (e) {
      log("⚠ Lỗi nạp log task-91:", e.message);
    }
  }

  const tasksNeedClean = [];

  const BATCH_SIZE = 25;
  for (let i = 0; i < allTasks.length; i += BATCH_SIZE) {
    const batch = allTasks.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (t) => {
      let note = t.note || "";
      if (!note) {
        try {
          const resDetail = await fetch(`${V}/hr/projects/task-input/${t.id}`, { headers: { authorization: token, accept: "application/json" } });
          const jDetail = await resDetail.json().catch(() => ({}));
          note = (jDetail && jDetail.data && jDetail.data.note) || "";
        } catch {}
      }

      // If task note was truncated by previous test run, restore from oldNotesMap
      if (oldNotesMap.has(String(t.id))) {
        const origNote = oldNotesMap.get(String(t.id));
        if (origNote && origNote.includes("Mã SP quét:")) {
          note = origNote;
        }
      }

      if (note && note.includes("Mã SP quét:")) {
        const newNote = cleanMoTaSP(note);
        if (newNote !== note) {
          tasksNeedClean.push({
            id: t.id,
            code: t.code,
            name: t.name,
            oldNote: note,
            newNote: newNote
          });
        }
      }
    }));
  }

  console.log(`\n=================== PHÁT HIỆN ${tasksNeedClean.length} TASK CẦN LÀM SẠCH MÔ TẢ ===================`);
  tasksNeedClean.forEach((item, idx) => {
    console.log(`\n[#${idx + 1}] ID: ${item.id} | Code: ${item.code}`);
    console.log(`  Name: ${item.name}`);
    console.log(`  Mô tả CŨ:\n    ${item.oldNote.replace(/\n/g, "\n    ")}`);
    console.log(`  Mô tả MỚI:\n    ${item.newNote.replace(/\n/g, "\n    ")}`);
  });

  if (tasksNeedClean.length === 0) {
    console.log("✓ Tất cả task đều đã sạch hoặc không có mô tả chứa thông tin sản phẩm thừa.");
    return;
  }

  const doUpdate = process.argv.includes("--do-update");
  if (!doUpdate) {
    console.log("\n⚠️ Tìm thấy " + tasksNeedClean.length + " task cần làm sạch. Thêm cờ `--do-update` để thực hiện cập nhật thật lên hệ thống.");
    return;
  }

  console.log("\n🚀 Đang tiến hành cập nhật Mô tả mới cho các task...");
  let okCount = 0, failCount = 0;

  for (const item of tasksNeedClean) {
    try {
      const res = await fetch(`${V}/hr/projects/mass-update-field-task-input`, {
        method: "POST",
        headers: { authorization: token, accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({ id: item.id, field: "note", value: item.newNote }),
      });
      const jRes = await res.json().catch(() => ({}));
      if (res.ok && (jRes.status === 1 || jRes.code === 200 || jRes.data !== false)) {
        okCount++;
        log(`  ✓ Đã cập nhật task ${item.code} (${item.id})`);
      } else {
        const fd = new FormData();
        fd.set("id", String(item.id));
        fd.set("field", "note");
        fd.set("value", item.newNote);
        const resFd = await fetch(`${V}/hr/projects/mass-update-field-task-input`, {
          method: "POST",
          headers: { authorization: token, origin: "https://work.hasaki.vn", referer: "https://work.hasaki.vn/" },
          body: fd,
        });
        const jFd = await resFd.json().catch(() => ({}));
        if (resFd.ok && (jFd.status === 1 || jFd.code === 200 || jFd.data !== false)) {
          okCount++;
          log(`  ✓ Đã cập nhật task ${item.code} (${item.id}) [via FormData]`);
        } else {
          failCount++;
          log(`  ✗ Lỗi cập nhật task ${item.code} (${item.id}):`, JSON.stringify(jRes || jFd));
        }
      }
    } catch (err) {
      failCount++;
      log(`  ✗ Lỗi task ${item.code}:`, err.message);
    }
  }

  console.log(`\nHOÀN TẤT: Cập nhật thành công ${okCount} task | Thất bại ${failCount} task.`);
}

run();
