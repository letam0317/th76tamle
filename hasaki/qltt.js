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

/* ============================ CHIA ĐỀU 0,2% GIỮA QUẢN LÝ CÙNG CẤP ============================
 * User chốt 23/09/2026: mỗi vi phạm trừ 0,2% KPI của quản lý trực tiếp; tổ nào có NHIỀU quản lý
 * cùng cấp thì phải CHIA ĐỀU lượt bị liên đới, không dồn 1 người (sổ phiếu lâu nay dồn hết cho
 * Lê Thị Ngọc Huyền dù Hồ Ngọc Tú Uyên cùng cấp). Đếm từ 0 (không bù quá khứ) — luân phiên 50/50.
 *
 * TỔ QUẢN LÝ suy từ danh bạ 23/09 (Sub Leader pos_id=7 tại loc 398, gom theo mảng phụ trách):
 *   · đóng gói           : pool {Hồ Ngọc Tú Uyên, Lê Thị Ngọc Huyền}  ← chia đều
 *   · phát triển cửa hàng: pool {Diệp Quốc Hải}                        ← 1 người, không chia
 * `tuyen` = cả tuyến (Sub Leader → Leader → Manager) chỉ để NHẬN DIỆN tổ từ tên đã ghi trong
 * sổ/chat; QLBP02 thật LUÔN lấy ở tầng `pool` (quản lý trực tiếp), kể cả khi sổ ghi nhầm lên Leader. */
export const TO_QUANLY = [
  { ten: "đóng gói", pool: ["Hồ Ngọc Tú Uyên", "Lê Thị Ngọc Huyền"],
    tuyen: ["Hồ Ngọc Tú Uyên", "Lê Thị Ngọc Huyền", "Hà Trọng Thúc Bằng", "Nguyễn Quang Đức"] },
  { ten: "phát triển cửa hàng", pool: ["Diệp Quốc Hải"],
    tuyen: ["Diệp Quốc Hải", "Võ Văn Đức", "Mai Thị Duyên"] },
];

/** Nhận diện tổ của NV từ tập tên quản lý đã ghi (chat chain + các tên trong sổ). Khớp đúng 1 tổ → tổ đó;
 *  0 hoặc ≥2 tổ → null (chưa map được, để người xác nhận). */
export function nhanDienTo(tenDaGhi) {
  const co = TO_QUANLY.filter((t) => tenDaGhi.some((n) => t.tuyen.includes(n)));
  return co.length === 1 ? co[0] : null;
}

/** Gom mọi tên quản lý từng gắn với mã NV (chat chain nếu có + cacTen của sổ). */
function tenQuanLyCua(ma, so) {
  const g = so && so.get(String(ma));
  if (!g) return [];
  const s = new Set(g.cacTen || (g.ten ? [g.ten] : []));
  if (Array.isArray(g.chain)) g.chain.forEach((x) => s.add(x));
  return [...s];
}

/* Sổ lượt bị-tính-QLTT (đếm từ 0) — để chọn người ít lượt nhất. Best-effort: hỏng thì coi như 0. */
const FILE_LUOT = ".cache-qltt-luot.json";
export function docLuot(DIR) { try { return JSON.parse(fs.readFileSync(path.join(DIR, FILE_LUOT), "utf8")); } catch { return {}; } }
export function ghiLuot(DIR, ten) {
  if (!ten) return;
  try { const o = docLuot(DIR); o[ten] = (o[ten] || 0) + 1; fs.writeFileSync(path.join(DIR, FILE_LUOT), JSON.stringify(o, null, 1)); }
  catch { /* mất 1 lượt đếm không chặn việc ghi biên bản */ }
}

/** Chọn người bị tính ít lượt nhất trong pool (hoà → theo thứ tự pool). KHÔNG ghi sổ (peek). */
export function chonItLuot(pool, DIR) {
  const luot = docLuot(DIR);
  let ten = pool[0], min = luot[pool[0]] || 0;
  for (const p of pool) { const c = luot[p] || 0; if (c < min) { min = c; ten = p; } }
  return ten;
}

/** Giải ra tổ + pool quản lý trực tiếp của NV. Không map được tổ → rơi về timQLTT (1 tên) như cũ. */
export function giaiTo(nv, danhBa, so) {
  const ma = String(nv.code || nv.staff_id || "");
  const to = nhanDienTo(tenQuanLyCua(ma, so));
  if (to) return { pool: to.pool, nhom: to.ten, nguon: "tổ (" + to.ten + ")",
    ghiChu: "Chia đều 0,2% giữa " + to.pool.length + " quản lý cùng cấp: " + to.pool.join(", ") };
  const q = timQLTT(nv, danhBa, so);          // chưa map tổ → giữ hành vi cũ, pool 1 người
  return { pool: [q.ten], nhom: null, nguon: q.nguon, ghiChu: q.ghiChu + " (chưa map được tổ để chia đều)" };
}

/** DÙNG KHI GHI BIÊN BẢN THẬT: trả tên QLTT đã CÂN BẰNG. ghi=true thì cộng 1 lượt cho người được chọn.
 *  Trả {ten, pool, nhom, nguon, ghiChu}. Dry-run gọi ghi=false để xem ai SẼ bị tính mà không đụng sổ. */
export function chonQLTTCanBang(nv, danhBa, so, DIR, ghi = false) {
  const g = giaiTo(nv, danhBa, so);
  const ten = chonItLuot(g.pool, DIR);
  if (ghi) ghiLuot(DIR, ten);
  const chia = g.pool.length > 1;
  return { ten, pool: g.pool, nhom: g.nhom, nguon: g.nguon,
    ghiChu: g.ghiChu + (chia ? " · lượt này → " + ten : "") };
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

