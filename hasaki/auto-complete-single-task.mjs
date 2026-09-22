import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { layTokenSongWork } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);
const CACHE_DB = path.join(DIR, ".cache-nv170.json");
const STAFF_API = "https://wshr.hasaki.vn/api/news/staff/search-for-dropdown?limit=10000&sort=staff_id";

async function layDanhBa(token) {
  try {
    const c = JSON.parse(fs.readFileSync(CACHE_DB, "utf8"));
    if (Date.now() - c.at < 12 * 3600 * 1000 && Array.isArray(c.data) && c.data.length) return c.data;
  } catch {}
  try {
    const res = await fetch(STAFF_API, { headers: { authorization: token } });
    const j = await res.json();
    const data = j.data || j.rows || [];
    if (data.length) try { fs.writeFileSync(CACHE_DB, JSON.stringify({ at: Date.now(), data })); } catch {}
    return data;
  } catch (e) {
    try { return JSON.parse(fs.readFileSync(CACHE_DB, "utf8")).data || []; } catch {}
    return [];
  }
}

function timNhanVien(query, danhBa) {
  if (!query || !danhBa || !danhBa.length) return null;
  const q = String(query).trim().toLowerCase();
  const qUser = q.includes("@") ? q.split("@")[0] : q;
  return danhBa.find((s) => {
    const email = String(s.staff_email || "").toLowerCase();
    const emailUser = email.includes("@") ? email.split("@")[0] : email;
    const code = String(s.code || "").toLowerCase();
    const name = String(s.staff_name || "").toLowerCase();
    const staffId = String(s.staff_id || "");
    return email === q || emailUser === qUser || code === q || staffId === q || name === q;
  }) || null;
}

async function run() {
  console.log("==================================================================");
  console.log("🚀 KÍCH HOẠT TỰ ĐỘNG HOÀN THÀNH BƯỚC B1 CHO TASK HSK-16E66T6P (13829903)");
  console.log("==================================================================\n");

  const token = await layTokenSongWork(DIR, log);
  if (!token) {
    console.log("✗ Không lấy được token work.hasaki.vn.");
    return;
  }

  const danhBa = await layDanhBa(token);
  log(`✓ Danh bạ nhân viên: ${danhBa.length} nhân sự.`);

  const taskId = "13829903"; // Task #HSK-16E66T6P
  const queryNV = "trinhhtm3@hasaki.vn"; // Huỳnh Thị Mỹ Trinh (251726)

  const nvQueries = String(queryNV).split(',').map(s => s.trim()).filter(Boolean);
  const danhSachNv = nvQueries.map(q => timNhanVien(q, danhBa)).filter(Boolean);

  if (!danhSachNv.length) {
    log("✗ Không tìm thấy NV vi phạm trong danh bạ.");
    return;
  }

  const nv = danhSachNv[0];
  const allCodes = danhSachNv.map(x => String(x.code || x.staff_id)).join(',');
  log(`✓ Tìm thấy Nhân viên vi phạm: ${nv.staff_name} | Mã: ${nv.code || nv.staff_id} | Email: ${nv.staff_email}`);

  // 1. Đọc chi tiết subtasks
  const resDetail = await fetch("https://wshr.hasaki.vn/api/hr/projects/task-input/" + taskId, {
    headers: { authorization: token, accept: "application/json" },
  });
  const jDetail = await resDetail.json();
  const taskData = jDetail && jDetail.data;

  if (!taskData || !Array.isArray(taskData.subtasks)) {
    log("✗ Không lấy được chi tiết subtasks của task " + taskId);
    return;
  }

  const subtaskB1 = taskData.subtasks.find((s) => String(s.workflow_step_id) === "7379" || /B1\./i.test(s.name || ""));
  if (!subtaskB1) {
    log("✗ Không tìm thấy subtask B1 trong task " + taskId);
    return;
  }

  log(`✓ Tìm thấy Subtask B1 (ID: ${subtaskB1.id}, Trạng thái hiện tại: ${subtaskB1.status})`);

  // Tìm quản lý trực tiếp
  let qlttName = nv.staff_dept || "Quản lý kho";
  if (nv.working_loc_id && danhBa.length) {
    const locId = nv.working_loc_id;
    const cungDiem = danhBa.filter(s => s.working_loc_id === locId);
    let ql = cungDiem.find(s => s.position_id === 7 || /sub leader/i.test(s.staff_title));
    if (!ql) ql = cungDiem.find(s => s.position_id === 5 || /leader/i.test(s.staff_title));
    if (!ql) ql = cungDiem.find(s => s.position_id === 8 || s.position_id === 17 || /supervisor|manager/i.test(s.staff_title));
    if (ql && ql.staff_name) qlttName = ql.staff_name;
  }
  log(`✓ Quản lý trực tiếp suy đoán: ${qlttName}`);

  // Gán NV vi phạm và Hoàn thành B1 (Status 2)
  const bodyStatus = {
    id: subtaskB1.id,
    field: "status",
    value: 2,
    extra_data: {
      configs: {
        staff: allCodes,
        NVVP02: String(nv.code || nv.staff_id),
        QLBP02: qlttName
      }
    }
  };

  const resStatus = await fetch("https://wshr.hasaki.vn/api/hr/projects/mass-update-field-task-input", {
    method: "POST",
    headers: { authorization: token, accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify(bodyStatus),
  });
  const jStatus = await resStatus.json().catch(() => ({}));

  // Gán NV xử lý subtask B1 (Assign staff)
  await fetch("https://wshr.hasaki.vn/api/hr/projects/mass-update-field-task-input", {
    method: "POST",
    headers: { authorization: token, accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ id: subtaskB1.id, field: "assign_staff", value: nv.staff_id }),
  }).catch(() => {});

  if (resStatus.ok && (jStatus.status === 1 || jStatus.data !== false)) {
    log("==================================================================");
    log(`🎉 THÀNH CÔNG! ĐÃ TỰ ĐỘNG HOÀN THÀNH BƯỚC B1 CHO TASK #${taskData.code || taskId}`);
    log(`👉 Đã gán NV vi phạm: ${nv.staff_name} (${nv.code || nv.staff_id})`);
    log(`👉 Đã gán Quản lý trực tiếp: ${qlttName}`);
    log(`👉 Trạng thái B1: Hoàn thành (Status = 2) → Task tự động chuyển sang B1.1 (NV xác nhận)`);
    log("==================================================================");
  } else {
    log("✗ Cập nhật thất bại: " + JSON.stringify(jStatus));
  }
}

run();
