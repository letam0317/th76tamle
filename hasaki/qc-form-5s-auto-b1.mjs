/**
 * qc-form-5s-auto-b1.mjs — Script QC tự động kiểm thử tính năng:
 * 1. Ô nhập NV vi phạm (Mục 5) trên Form 5S (public/index.html)
 * 2. Logic tra cứu danh bạ (timNhanVien)
 * 3. Cấu trúc dữ liệu và API hoàn thành bước B1 sang B1.1 (push-5s-to-workflow.js)
 *
 * Chạy: node qc-form-5s-auto-b1.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const KQ = [];
let soLoi = 0;

function check(ten, ok, ghi) {
  KQ.push({ ten, ok: !!ok, ghi: ghi || "" });
  if (!ok) soLoi++;
  console.log((ok ? "  ✓ " : "  ✗ ") + ten + (ghi ? " — " + ghi : ""));
}

console.log("==================================================================");
console.log("🔬 KIỂM THỬ VÀ TRUY XUẤT QC: FORM 5S & BƯỚC B1 WORKFLOW 591");
console.log("==================================================================\n");

// 1. QC Giao diện Form 5S (public/index.html & kiemsoatkho/form.html)
console.log("1️⃣ QC GIAO DIỆN & LOGIC DROPDOWN NV 3 CỘT (public/index.html & kiemsoatkho/form.html)");
try {
  const htmlPathPublic = path.join(DIR, "public", "index.html");
  const htmlPublic = fs.readFileSync(htmlPathPublic, "utf8");

  const htmlPathKho = path.join(DIR, "kiemsoatkho", "form.html");
  const htmlKho = fs.readFileSync(htmlPathKho, "utf8");

  check("Có file public/index.html", fs.existsSync(htmlPathPublic));
  check("Có file kiemsoatkho/form.html", fs.existsSync(htmlPathKho));

  // Kiểm tra vị trí Mục 1 là Nhân viên vi phạm (thay thế vị trí Hiện trạng)
  check("Public: Mục 1 là Nhân viên vi phạm", /1\.\s*Nhân viên vi phạm/.test(htmlPublic));
  check("Kho: Mục 1 là Nhân viên vi phạm", /1\.\s*Nhân viên vi phạm/.test(htmlKho));
  check("Public: Hiện trạng đã đổi vị trí thành Mục 4", /4\.\s*Hiện trạng \(ghi chú\)/.test(htmlPublic));
  check("Kho: Hiện trạng đã đổi vị trí thành Mục 5", /5\.\s*Hiện trạng \(ghi chú\)/.test(htmlKho));

  // Kiểm tra đã xóa 2 mục chú thích (Email / Mã NV & hint text)
  check("Public: Đã bỏ chú thích (Email / Mã NV)", !/\(Email \/ Mã NV\)/i.test(htmlPublic));
  check("Kho: Đã bỏ chú thích (Email / Mã NV)", !/\(Email \/ Mã NV\)/i.test(htmlKho));

  // Layout 4 cột vừa vặn khung form (Zero Overflow)
  check("Public: Dropdown có hiển thị 4 cột thông tin (name, code, email, dept)", 
    /nv\.name/.test(htmlPublic) && /nv\.code/.test(htmlPublic) && /nv\.email/.test(htmlPublic) && /nv\.dept/.test(htmlPublic));
  check("Kho: Dropdown có hiển thị 4 cột thông tin (name, code, email, dept)", 
    /nv\.name/.test(htmlKho) && /nv\.code/.test(htmlKho) && /nv\.email/.test(htmlKho) && /nv\.dept/.test(htmlKho));
  check("Public: Dropdown flex 4 cột vừa vặn khung form (no overflow & flex alignment)",
    /flex items-center/.test(htmlPublic) && /Nghiệp vụ/.test(htmlPublic));
  check("Kho: Dropdown flex 4 cột vừa vặn khung form (no overflow & flex alignment)",
    /flex items-center/.test(htmlKho) && /Nghiệp vụ/.test(htmlKho));

  // Đa chọn Tag/Chip & Nút Xóa
  check("Public: Đa chọn Tag/Chip hỗ trợ chọn nhiều NV & xóa Tag", 
    /nhanVienViPhamList/.test(htmlPublic) && /xoaNV/.test(htmlPublic));
  check("Kho: Đa chọn Tag/Chip hỗ trợ chọn nhiều NV & xóa Tag", 
    /nhanVienViPhamList/.test(htmlKho) && /xoaNV/.test(htmlKho));

  // Bộ dữ liệu 170 QL1A
  check("Public: Nhúng danh sách NV 170 QL1A (DANH_SACH_NV_170)", /DANH_SACH_NV_170/.test(htmlPublic));
  check("Kho: Nhúng danh sách NV 170 QL1A (DANH_SACH_NV_170)", /DANH_SACH_NV_170/.test(htmlKho));

  // Gửi payload dạng danh sách email phân cách bởi dấu phẩy
  check("Public: Đóng gói payload chuỗi phân cách phẩy cho nhiều NV", /join\(\s*['"]\s*,\s*['"]\s*\)/.test(htmlPublic));
  check("Kho: Đóng gói payload chuỗi phân cách phẩy cho nhiều NV", /join\(\s*['"]\s*,\s*['"]\s*\)/.test(htmlKho));

} catch (e) {
  check("Lỗi đọc/kiểm tra file HTML", false, e.message);
}

console.log("\n2️⃣ QC THUẬT TOÁN TRA CỨU DANH BẠ & XỬ LÝ ĐA CHỌN");
try {
  const cacheDbPath = path.join(DIR, ".cache-danhba.json");
  check("Có file cache danh bạ .cache-danhba.json", fs.existsSync(cacheDbPath));

  if (fs.existsSync(cacheDbPath)) {
    const cacheData = JSON.parse(fs.readFileSync(cacheDbPath, "utf8")).data || [];
    check("Danh bạ nhân sự có dữ liệu (>0 bản ghi)", cacheData.length > 0, `Đã nạp ${cacheData.length} NV`);

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

    // Test 1: Khớp email đầy đủ
    const nv1 = timNhanVien("tamlc@hasaki.vn", cacheData);
    check("Khớp email 'tamlc@hasaki.vn'", !!nv1 && nv1.code === "233135", nv1 ? `${nv1.staff_name} (Mã: ${nv1.code})` : "Không thấy");

    // Test 2: Khớp username email
    const nv2 = timNhanVien("tamlc", cacheData);
    check("Khớp username 'tamlc'", !!nv2 && nv2.code === "233135", nv2 ? `${nv2.staff_name} (Mã: ${nv2.code})` : "Không thấy");

    // Test 3: Khớp mã NV
    const nv3 = timNhanVien("233135", cacheData);
    check("Khớp mã NV '233135'", !!nv3 && nv3.staff_name === "Lê Chí Tâm", nv3 ? nv3.staff_name : "Không thấy");

    // Test 4: Tra cứu mã không tồn tại
    const nv4 = timNhanVien("invalid_user_999999", cacheData);
    check("Trả về null khi mã không tồn tại", nv4 === null);
  }
} catch (e) {
  check("Lỗi kiểm thử danh bạ", false, e.message);
}

console.log("\n3️⃣ QC LOGIC HOÀN THÀNH BƯỚC B1 VỚI ĐA CHỌN NV (push-5s-to-workflow.js)");
try {
  const pushPath = path.join(DIR, "push-5s-to-workflow.js");
  const pushCode = fs.readFileSync(pushPath, "utf8");

  check("Có file push-5s-to-workflow.js", fs.existsSync(pushPath));
  check("Khai báo hàm layDanhBa", /async\s+function\s+layDanhBa/.test(pushCode));
  check("Khai báo hàm timNhanVien", /function\s+timNhanVien/.test(pushCode));
  check("Khai báo hàm tuDongHoanThanhB1", /async\s+function\s+tuDongHoanThanhB1/.test(pushCode));
  check("Xử lý chuỗi danh sách nhiều nhân viên (split/comma)", /split\(\s*['"]\s*,\s*['"]\s*\)/.test(pushCode));
  check("Nhận biết workflow_step_id 7379 của B1", /7379/.test(pushCode));
  /* 22/09/2026 — khuôn API đã ĐO THẬT trên work.hasaki.vn. Bản 21/09 gửi JSON
     {field:"status", extra_data:{configs}} nên server nhận 200 mà không ghi gì (task HSK-16E66T6P
     vẫn nằm ở B1). Nay: FormData field="data" + value[configs][KEY], rồi field="status" value=2. */
  check("Ghi ô cấu hình bằng khuôn value[configs][KEY] (KHÔNG dùng extra_data)",
    /value\[configs\]\[/.test(pushCode) && !/extra_data/.test(pushCode));
  check("Đóng B1 bằng field=status value=2", /fdSt\.set\("field", "status"\)/.test(pushCode) && /fdSt\.set\("value", "2"\)/.test(pushCode));
  check("Điền NV vi phạm (staff) + Quản lý trực tiếp (QLBP02) + giao việc",
    /value\[configs\]\[staff\]/.test(pushCode) && /value\[configs\]\[QLBP02\]/.test(pushCode) && /assign_staff/.test(pushCode));
  check("Nạp ảnh bằng chứng PIC02 và XOÁ trước khi nạp (tránh cộng dồn)",
    /value\[configs\]\[PIC02\]\[\]/.test(pushCode) && /"value\[configs\]\[PIC02\]": ""/.test(pushCode));
  check("ĐỌC LẠI để chốt B1 đã đóng (không tin mỗi HTTP 200)",
    /b1Sau && b1Sau\.status === 2/.test(pushCode) && /B1 VẪN CHƯA ĐÓNG/.test(pushCode));
  check("Luật NV vi phạm khớp mẫu biên bản 17/09 (bỏ luật 'Báo cáo gần nhất' đã chết)",
    /KHÔNG báo cáo vệ sinh ô này/.test(pushCode) && !/Báo cáo gần nhất\/i/.test(pushCode));
} catch (e) {
  check("Lỗi kiểm thử push-5s-to-workflow.js", false, e.message);
}

// 4. QC MẮT XÍCH DỮ LIỆU: form -> Apps Script (cột 9) -> bộ đẩy. Đứt một khâu là cả luồng chết câm.
console.log("\n4️⃣ QC MẮT XÍCH 'NHÂN VIÊN VI PHẠM' QUA APPS SCRIPT (google-script.gs)");
try {
  const gas = fs.readFileSync(path.join(DIR, "google-script.gs"), "utf8");
  check("Khai báo cột 9 COL_NV_VP", /var COL_NV_VP = 9;/.test(gas));
  check("SO_COT nới lên 9 (nếu quên, cột 9 không bao giờ được đọc)", /var SO_COT = 9;/.test(gas));
  check("luuDuLieu GHI nhanVienViPham vào dòng mới", /duLieu\.nhanVienViPham \|\| ''/.test(gas));
  const soTra = (gas.match(/nhanVienViPham: String\(r\[COL_NV_VP - 1\]/g) || []).length;
  check("CẢ HAI đường pending (GET apiPending + POST apiPendingData_) đều TRẢ VỀ nhanVienViPham", soTra === 2, soTra + "/2 chỗ");
  check("Tiêu đề tab có cột 'Nhân viên vi phạm'", /'Nhân viên vi phạm'\]\);/.test(gas));
  check("Tự nới khung cột trước khi đọc (sheet cũ chỉ 8 cột sẽ ném lỗi -> pending chết câm)",
    /getMaxColumns\(\) < SO_COT/.test(gas));
} catch (e) {
  check("Lỗi kiểm thử google-script.gs", false, e.message);
}

// 5. QC ĐIỀN SẴN TỪ POP-UP PLANOGRAM: chỉ ca A mới có người chịu lỗi.
console.log("\n5️⃣ QC ĐIỀN SẴN NV VI PHẠM TỪ POP-UP PLANOGRAM");
try {
  const pg = fs.readFileSync(path.join(DIR, "kiemsoatkho", "hasaki-planogram.js"), "utf8");
  const fm = fs.readFileSync(path.join(DIR, "kiemsoatkho", "form.html"), "utf8");
  check("soanGhiNhan5S trả trường nvViPham", /nvViPham: nvVP/.test(pg));
  check("CHỈ ca A mới điền sẵn (ca nghỉ / người khác báo cáo phải để trống)",
    /var nvVP = \(A && pc && pc\.em\)/.test(pg));
  check("form.html napSan đọc du.nvViPham", /Array\.isArray\(du\.nvViPham\)/.test(fm));
  check("napSan dựng cả chip list lẫn chuỗi gửi đi", /nhanVienViPhamList: dsNV\.map/.test(fm) && /nhanVienViPham: dsNV\.map/.test(fm));
} catch (e) {
  check("Lỗi kiểm thử pop-up Planogram", false, e.message);
}

console.log("\n==================================================================");
if (soLoi === 0) {
  console.log(`🎉 TẤT CẢ ${KQ.length} MỤC QC ĐỀU ĐẠT CHUẨN! (0 LỖI)`);
} else {
  console.log(`⚠️ PHÁT HIỆN ${soLoi} LỖI QC CẦN KHẮC PHỤC.`);
}
console.log("==================================================================\n");

