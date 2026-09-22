import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { gasPost } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const APPSCRIPT_KEY = process.env.APPSCRIPT_KEY;

const cacheDbPath = path.join(DIR, ".cache-danhba.json");
let danhBa = [];
if (fs.existsSync(cacheDbPath)) {
  try { danhBa = JSON.parse(fs.readFileSync(cacheDbPath, "utf8")).data || []; } catch {}
}

function timNhanVien(query, db) {
  if (!query || !db || !db.length) return null;
  const q = String(query).trim().toLowerCase();
  const qUser = q.includes("@") ? q.split("@")[0] : q;
  return db.find((s) => {
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
  console.log("🔍 KIỂM TRA BÁO CÁO 5S TỒN ĐỌN & ĐỦ ĐIỀU KIỆN TỰ ĐỘNG CHUYỂN B1.1");
  console.log("==================================================================\n");

  if (!APPSCRIPT_KEY) {
    console.error("✗ Thiếu APPSCRIPT_KEY trong .env");
    process.exit(1);
  }

  try {
    const j = await gasPost({ action: "pending", key: APPSCRIPT_KEY }, console.log, "pending");
    if (j.status !== "success" || !Array.isArray(j.rows)) {
      console.error("✗ Lỗi đọc Apps Script pending:", j);
      process.exit(1);
    }

    const rows = j.rows;
    console.log(`📌 Tổng số báo cáo 5S đang chờ đẩy: ${rows.length} báo cáo.\n`);

    const readyB1 = [];
    const noEmployee = [];

    for (const r of rows) {
      const qNV = r.nhanVienViPham || r.nvViPham || "";
      if (qNV && String(qNV).trim()) {
        const nvQueries = String(qNV).split(",").map(s => s.trim()).filter(Boolean);
        const danhSachNv = nvQueries.map(q => timNhanVien(q, danhBa)).filter(Boolean);
        readyB1.push({
          row: r.row,
          ngay: r.ngay || r.thoiGianViPham || "N/A",
          viTri: r.viTri || "?",
          hangMuc: r.hangMuc || "?",
          rawNv: qNV,
          danhSachNv: danhSachNv.length ? danhSachNv : [{ staff_name: qNV, code: "?", staff_email: qNV }]
        });
      } else {
        noEmployee.push(r);
      }
    }

    console.log("------------------------------------------------------------------");
    console.log(`✅ DANH SÁCH BÁO CÁO ĐỦ ĐIỀU KIỆN TỰ ĐỘNG CHUYỂN SANG BƯỚC B1.1 (${readyB1.length} BÁO CÁO):`);
    console.log("------------------------------------------------------------------");

    if (readyB1.length === 0) {
      console.log("  (Hiện không có báo cáo tồn đọng nào có thông tin Nhân viên vi phạm)\n");
    } else {
      readyB1.forEach((item, idx) => {
        console.log(`[#${idx + 1}] Hàng ${item.row} | Ngày: ${item.ngay} | Vị trí: ${item.viTri}`);
        console.log(`     Hạng mục: ${item.hangMuc}`);
        console.log(`     Nhân viên vi phạm: ${item.danhSachNv.map(x => `${x.staff_name} (Mã: ${x.code || '?'}, Mail: ${x.staff_email || '?'})`).join(', ')}`);
        console.log(`     👉 Điều kiện: Tự động hoàn thành B1 -> Chuyển thẳng B1.1 (NV xác nhận)\n`);
      });
    }

    console.log("------------------------------------------------------------------");
    console.log(`ℹ️ DANH SÁCH BÁO CÁO CHƯA CÓ THÔNG TIN NV VI PHẠM (${noEmployee.length} BÁO CÁO):`);
    console.log("------------------------------------------------------------------");
    if (noEmployee.length === 0) {
      console.log("  (Tất cả báo cáo tồn đọng đều đã có thông tin Nhân viên vi phạm)\n");
    } else {
      noEmployee.forEach((item, idx) => {
        console.log(`  - Hàng ${item.row} | Vị trí: ${item.viTri || '?'} | Hạng mục: ${item.hangMuc || '?'}`);
      });
      console.log("  👉 Các báo cáo này khi tạo task sẽ giữ ở bước B1 (Cần xác minh lỗi).\n");
    }

  } catch (e) {
    console.error("✗ Lỗi kiểm tra:", e.message);
  }
}

run();
