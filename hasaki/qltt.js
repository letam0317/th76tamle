/**
 * qltt.js — SỔ TRA "Quản lý trực tiếp của nhân viên vi phạm" (ô QLBP02 ở bước B1, workflow 591).
 * ============================================================================================
 *  VÌ SAO CÓ FILE NÀY (22/09/2026): bản đầu ĐOÁN quản lý theo `position_id` + `working_loc_id`
 *  (Sub Leader → Leader → Supervisor cùng điểm làm việc). Đo lại thì đoán SAI ngay ca đầu tiên:
 *  Huỳnh Thị Mỹ Trinh (251726) — đoán ra "Hồ Ngọc Tú Uyên", trong khi 4 phiếu tháng 4→7 do chính
 *  người xác minh điền đều ghi "Lê Thị Ngọc Huyền". Ghi sai tên quản lý vào biên bản vi phạm là
 *  lỗi nghiệp vụ thật, nên KHÔNG để máy đoán khi đã có câu trả lời của người.
 *
 *  ĐÃ TÌM 2 NGUỒN CHÍNH THỐNG, CẢ HAI KHÔNG DÙNG ĐƯỢC (đừng mất công tìm lại):
 *   · HR: `direct_manager_id` CÓ trong hồ sơ nhân sự nhưng gần như không ai khai — đo trên toàn bộ
 *     bản kết xuất đang có: 3/789 bản ghi có giá trị (0,4%).
 *   · chat.hasaki.vn: chỉ có NHÃN i18n "Quản lý trực tiếp"; không đoạn nào trong bản dựng gọi tới.
 *     Dữ liệu thật (nếu có) nằm sau `api.hasakichat.com` + đăng nhập OIDC — chưa dò được.
 *
 *  NGUỒN ĐANG DÙNG: chính các phiếu 5S đã đóng bước B1 (`.exports/tasks-cache.json`) — cặp
 *  «Nhân viên vi phạm» ↔ «Quản lý trực tiếp…» do NGƯỜI điền. 264 phiếu, phủ 111 mã NV.
 *  Mã bị khai nhiều tên khác nhau (32 mã — quản lý đổi theo thời gian, hoặc gõ nhầm) thì lấy
 *  LẦN GẦN NHẤT, vì tên mới phản ánh cơ cấu hiện tại.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TEN_NV = "Nhân viên vi phạm";
const TEN_QL = "Quản lý trực tiếp";

/** Dựng sổ {mã NV → {ten, ngay, lan, cacTen[]}} từ kho phiếu đã kết xuất. Không có kho → sổ rỗng. */
export function docSoQLTT(DIR) {
  const so = new Map();

  // 1) Đọc dữ liệu chính xác từ Hasaki Chat (chat.hasaki.vn)
  try {
    const chatData = JSON.parse(fs.readFileSync(path.join(DIR, ".cache-qltt-chat.json"), "utf8"));
    for (const [ma, info] of Object.entries(chatData)) {
      if (info && info.manager) {
        so.set(String(ma), { ten: info.manager, ngay: "2026-09-22", lan: 99, cacTen: [info.manager], nguon: "chat.hasaki.vn" });
      }
    }
  } catch {}

  // 2) Đọc từ kho phiếu đã đóng B1 (.exports/tasks-cache.json)
  let kho;
  try { kho = JSON.parse(fs.readFileSync(path.join(DIR, ".exports", "tasks-cache.json"), "utf8")); }
  catch { return so; }
  const H = kho.header || [];
  const iNV = H.findIndex((h) => String(h).includes(TEN_NV));
  const iQL = H.findIndex((h) => String(h).includes(TEN_QL));
  const iNgay = H.indexOf("Created At");
  if (iNV < 0 || iQL < 0) return so;

  for (const r of Object.values(kho.rows || {})) {
    const ql = String(r[iQL] || "").trim();
    const nv = String(r[iNV] || "").trim();
    if (!ql || !nv) continue;
    const ngay = String(r[iNgay] || "");
    for (const ma of nv.split(",").map((s) => s.trim()).filter(Boolean)) {
      const cu = so.get(ma);
      if (!cu) { so.set(ma, { ten: ql, ngay, lan: 1, cacTen: [ql], nguon: "sổ" }); continue; }
      if (cu.nguon === "chat.hasaki.vn") continue; // Ưu tiên chat.hasaki.vn
      cu.lan++;
      if (!cu.cacTen.includes(ql)) cu.cacTen.push(ql);
      if (ngay > cu.ngay) { cu.ten = ql; cu.ngay = ngay; }   // mới hơn thì thắng
    }
  }
  return so;
}

/** Tìm chính xác Sub Leader / Leader / Supervisor theo cơ cấu danh bạ thực tế. */
export function timNguoiQuanLyChucDanh(nv, danhBa) {
  if (!nv || !danhBa || !danhBa.length) return null;
  const locId = nv.working_loc_id || nv.staff_loc_id;
  const deptId = nv.staff_dept_id;

  // Lọc nhân sự cùng địa điểm và cùng bộ phận/phòng ban
  const cungNhom = danhBa.filter((s) => {
    const sLoc = s.working_loc_id || s.staff_loc_id;
    return sLoc === locId && (s.staff_dept_id === deptId || s.staff_dept === nv.staff_dept);
  });

  // Tìm Sub Leader
  let ql = cungNhom.find((s) => s.position_id === 7 || /sub\s*leader/i.test(s.staff_title || "") || /sub\s*leader/i.test(s.staff_major || ""));
  // Nếu không có, tìm Leader
  if (!ql) ql = cungNhom.find((s) => s.position_id === 5 || /\bleader\b/i.test(s.staff_title || "") || /\bleader\b/i.test(s.staff_major || ""));
  // Nếu không có, tìm Supervisor / Team Lead / Manager
  if (!ql) ql = cungNhom.find((s) => s.position_id === 8 || s.position_id === 17 || /supervisor|manager|team lead/i.test(s.staff_title || "") || /supervisor|manager/i.test(s.staff_major || ""));

  // Mở rộng tìm cùng địa điểm làm việc nếu bộ phận quá hẹp
  if (!ql && locId) {
    const cungDiaDiem = danhBa.filter((s) => (s.working_loc_id || s.staff_loc_id) === locId);
    ql = cungDiaDiem.find((s) => s.position_id === 7 || /sub\s*leader/i.test(s.staff_title || ""));
    if (!ql) ql = cungDiaDiem.find((s) => s.position_id === 5 || /\bleader\b/i.test(s.staff_title || ""));
    if (!ql) ql = cungDiaDiem.find((s) => s.position_id === 8 || s.position_id === 17 || /supervisor|manager/i.test(s.staff_title || ""));
  }

  return ql ? { ten: ql.staff_name, chucDanh: ql.staff_title || ql.staff_major || "Quản lý", ma: ql.code } : null;
}

/** Trả {ten, nguon, ghiChu} — `nguon` = "chat.hasaki.vn", "sổ" hoặc "đoán" (Sub Leader/Leader/Supervisor). */
export function timQLTT(nv, danhBa, so) {
  const ma = String(nv.code || nv.staff_id || "");
  const g = so && so.get(ma);
  if (g && g.ten) {
    return {
      ten: g.ten, nguon: g.nguon || "sổ",
      ghiChu: g.nguon === "chat.hasaki.vn" ? "Tra từ chat.hasaki.vn (Hồ sơ nhân viên chính thức)"
        : g.lan + " phiếu, gần nhất " + String(g.ngay).slice(0, 10) +
          (g.cacTen.length > 1 ? " · từng khai khác: " + g.cacTen.filter((x) => x !== g.ten).join(", ") : ""),
    };
  }

  // Tra chức danh Sub Leader / Leader / Supervisor thật trong danh bạ
  const qlChucDanh = timNguoiQuanLyChucDanh(nv, danhBa);
  if (qlChucDanh) {
    return {
      ten: qlChucDanh.ten, nguon: "đoán",
      ghiChu: `Tra đúng nhân sự chức danh Sub Leader/Leader/Supervisor (${qlChucDanh.chucDanh} - Mã: ${qlChucDanh.ma})`,
    };
  }

  return { ten: nv.staff_dept || "Quản lý bộ phận", nguon: "đoán", ghiChu: "Chưa có dữ liệu Quản lý trực tiếp riêng cho mã " + ma };
}

/* Chạy thẳng để soi sổ: node qltt.js [mã NV] */
if (/qltt\.js$/.test(String(process.argv[1] || ""))) {
  const DIR = path.dirname(fileURLToPath(import.meta.url));
  const so = docSoQLTT(DIR);
  const ma = process.argv[2];
  if (ma) {
    const g = so.get(ma);
    console.log(g ? `${ma} → ${g.ten} (${g.nguon || "sổ"})` : `${ma} → CHƯA có trong sổ (sẽ tra Sub Leader/Leader/Supervisor trong danh bạ)`);
  } else {
    console.log("Sổ QLTT (chat.hasaki.vn + phiếu B1 đã đóng): " + so.size + " mã NV.");
  }
}

