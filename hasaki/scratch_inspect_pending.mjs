import path from "node:path";
import "dotenv/config";
import { fileURLToPath } from "node:url";
import { gasPost } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const APPSCRIPT_KEY = process.env.APPSCRIPT_KEY;

const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);

(async () => {
  if (!APPSCRIPT_KEY) {
    log("✗ Thiếu APPSCRIPT_KEY");
    process.exit(1);
  }

  log("🔍 Fetching pending rows from Apps Script...");
  const j = await gasPost({ action: "pending", key: APPSCRIPT_KEY }, log, "pending");
  if (j.status !== "success" || !Array.isArray(j.rows)) {
    log("✗ Lỗi pending:", j);
    process.exit(1);
  }

  const rows = j.rows;
  log(`📌 Số lượng rows pending: ${rows.length}\n`);

  for (const r of rows) {
    log(`------------------------------------------------------------------`);
    log(`Hàng: ${r.row}`);
    log(`  Ngày: ${r.ngay || r.thoiGianViPham || 'N/A'}`);
    log(`  Vị trí: ${r.viTri || 'N/A'}`);
    log(`  Hạng mục: "${r.hangMuc || ''}"`);
    log(`  Hiện trạng (ghi chú): "${r.hienTrang || ''}"`);
    log(`  Mã sản phẩm: "${r.maSanPham || ''}"`);
    log(`  Nhân viên vi phạm: "${r.nhanVienViPham || r.nvViPham || ''}"`);
    log(`  Ảnh IDs:`, r.anhIds);
    
    // Test layAnhTheoDong metadata check
    const ids = (r.anhIds || []).slice(0, 8);
    if (!ids.length) {
      log(`  ❌ KẾT LUẬN: Không có file media/ảnh nào được đính kèm (anhIds rỗng).`);
    } else {
      try {
        const metaJ = await gasPost({ action: "anh", key: APPSCRIPT_KEY, ids, chiMeta: 1 }, log, "anh-meta");
        if (metaJ && Array.isArray(metaJ.files)) {
          log(`  Files Metadata:`, metaJ.files);
          const hasImage = metaJ.files.some(f => !f.loi && /^image\//i.test(f.mime || ''));
          if (!hasImage) {
            log(`  ❌ KẾT LUẬN: Không có ẢNH hợp lệ (chỉ có video hoặc file lỗi/quá nặng >12MB). IMA00 trên Hasaki Workflow bắt buộc phải có ít nhất 1 ẢNH.`);
          } else {
            log(`  ✅ Đủ điều kiện ảnh.`);
          }
        } else {
          log(`  ⚠️ Metadata check trả về:`, metaJ);
        }
      } catch (e) {
        log(`  Lỗi check meta:`, e.message);
      }
    }
  }
})();
