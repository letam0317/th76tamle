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
      if (!cu) { so.set(ma, { ten: ql, ngay, lan: 1, cacTen: [ql] }); continue; }
      cu.lan++;
      if (!cu.cacTen.includes(ql)) cu.cacTen.push(ql);
      if (ngay > cu.ngay) { cu.ten = ql; cu.ngay = ngay; }   // mới hơn thì thắng
    }
  }
  return so;
}

/** Đoán quản lý theo cơ cấu danh bạ — CHỈ dùng khi sổ chưa có mã đó. */
export function doanQuanLy(nv, danhBa) {
  const mac = nv.staff_dept || "Quản lý kho";
  if (!nv.working_loc_id || !danhBa || !danhBa.length) return mac;
  const cung = danhBa.filter((s) => s.working_loc_id === nv.working_loc_id);
  let ql = cung.find((s) => s.position_id === 7 || /sub leader/i.test(s.staff_title));
  if (!ql) ql = cung.find((s) => s.position_id === 5 || /leader/i.test(s.staff_title));
  if (!ql) ql = cung.find((s) => s.position_id === 8 || s.position_id === 17 || /supervisor|manager/i.test(s.staff_title));
  return (ql && ql.staff_name) ? ql.staff_name : mac;
}

/** Trả {ten, nguon, ghiChu} — `nguon` = "sổ" (người đã điền) hoặc "đoán" (cơ cấu danh bạ). */
export function timQLTT(nv, danhBa, so) {
  const ma = String(nv.code || nv.staff_id || "");
  const g = so && so.get(ma);
  if (g && g.ten) {
    return {
      ten: g.ten, nguon: "sổ",
      ghiChu: g.lan + " phiếu, gần nhất " + String(g.ngay).slice(0, 10) +
        (g.cacTen.length > 1 ? " · từng khai khác: " + g.cacTen.filter((x) => x !== g.ten).join(", ") : ""),
    };
  }
  return { ten: doanQuanLy(nv, danhBa), nguon: "đoán", ghiChu: "chưa có phiếu nào khai cho mã " + ma };
}

/* Chạy thẳng để soi sổ: node qltt.js [mã NV] */
if (/qltt\.js$/.test(String(process.argv[1] || ""))) {
  const DIR = path.dirname(fileURLToPath(import.meta.url));
  const so = docSoQLTT(DIR);
  const ma = process.argv[2];
  if (ma) {
    const g = so.get(ma);
    console.log(g ? `${ma} → ${g.ten}  (${g.lan} phiếu, gần nhất ${String(g.ngay).slice(0, 10)}${g.cacTen.length > 1 ? ", từng khai: " + g.cacTen.join(" | ") : ""})`
                  : `${ma} → CHƯA có trong sổ (sẽ phải đoán theo danh bạ)`);
  } else {
    const nhieu = [...so.entries()].filter(([, g]) => g.cacTen.length > 1);
    console.log("Sổ QLTT dựng từ phiếu đã đóng B1: " + so.size + " mã NV · " + nhieu.length + " mã từng khai nhiều tên (lấy lần gần nhất).");
    const dem = new Map();
    for (const [, g] of so) dem.set(g.ten, (dem.get(g.ten) || 0) + 1);
    [...dem.entries()].sort((a, b) => b[1] - a[1]).forEach(([t, n]) => console.log("   " + String(n).padStart(3) + " NV  ← " + t));
  }
}
