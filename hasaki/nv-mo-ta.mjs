/**
 * nv-mo-ta.mjs — đọc NV vi phạm do NGƯỜI KIỂM ghi trong Mô tả phiếu (22/10 user: «[NF], [ĐG] đã có NV vi phạm
 * → phải bắn đúng, tránh bắn nhầm»). Dòng «Nhân viên vi phạm: Tên (ghi chú), Tên…» hoặc «Nhân viên đóng gói: Tên (email)».
 * Tên tra bằng timTheoTenAnToan (bẫy trùng tên); email trong ngoặc thắng tên. Nguồn duy nhất cho canh-b1 (chọn người)
 * và auto-complete-single-task (chốt chặn trước khi ghi).
 */
import { timTheoTenAnToan } from "./qltt.js";

/** note (HTML) → null khi không có dòng; ngược lại { chu, ds: [{ ten, code, email }], thieu: [chữ không tra được] } */
export function nvTheoMoTa(note, danhBa) {
  const chu = String(note || "").replace(/<[^>]+>/g, "\n");
  const dong = [...chu.matchAll(/Nhân viên (?:vi phạm|đóng gói):\s*([^\n]+)/g)].map((m) => m[1].trim());
  if (!dong.length) return null;
  const ds = [], thieu = [];
  for (const s of dong.join(",").split(/,|;| và /).map((x) => x.trim()).filter(Boolean)) {
    const em = /\(([^()\s]+@[^()\s]+)\)/.exec(s)?.[1]?.toLowerCase(), ten = s.replace(/\([^)]*\)/g, "").trim();
    const x = em ? (danhBa || []).find((d) => String(d.staff_email || "").toLowerCase() === em) : timTheoTenAnToan(ten, danhBa);
    if (!x) { thieu.push(s); continue; }
    if (!ds.some((n) => n.code === String(x.code))) ds.push({ ten: x.staff_name, code: String(x.code), email: x.staff_email });
  }
  return { chu: dong.join(" | "), ds, thieu };
}

/** Tập mã giao (--nv) có trùng ĐÚNG tập người ghi ở Mô tả không. */
export const khopMoTa = (mt, maGiao) => !mt.thieu.length && [...mt.ds.map((n) => n.code)].sort().join(",") === [...new Set(maGiao.map(String))].sort().join(",");
