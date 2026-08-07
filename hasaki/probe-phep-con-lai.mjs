/**
 * ============================================================================
 *  probe-phep-con-lai.mjs — READ-ONLY: PHÉP CÒN LẠI của từng nhân viên
 * ============================================================================
 *  Module chính thức của HR ("Quản lý phép năm", route /company/staff/annual-leave-management,
 *  API /hr/staff-annual-remain với cột annual_total / annual_remaining) trả **403** với
 *  quyền hiện có. Nguồn đọc được: `hr/sheet-summary` → `kpi_item`:
 *     • `Remaining_Off`  = phép còn lại
 *     • `Anual_Leave`    = số ngày phép năm đã nghỉ TRONG THÁNG (kiểm chứng khớp 12/12 tháng
 *                          với đơn nghỉ leave_type="A" thật của tài khoản đang dùng)
 *     • `Week_Off` = nghỉ off tuần · `Compensatory_Leave` = nghỉ bù
 *  (Cột annual_remaining ngoài kpi_item đã CHẾT từ 2025-08 — toàn 0, đừng dùng.)
 *
 *  Chạy: node probe-phep-con-lai.mjs [location_id] [--majors=26,71] [--nam=2026]
 *        mặc định location 398 (170 Quốc Lộ 1A), mọi nghiệp vụ, năm 2026.
 * ============================================================================
 */
import path from "node:path"; import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { layTokenSongWork } from "./session-rules.js";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const log = (...a) => console.log(...a);
const OUT = path.join(DIR, ".exports"); fs.mkdirSync(OUT, { recursive: true });
const LOC = process.argv.find(a => /^\d+$/.test(a)) || "398";
const majorsArg = (process.argv.find(a => a.startsWith("--majors=")) || "").split("=")[1];
const NAM = (process.argv.find(a => a.startsWith("--nam=")) || "").split("=")[1] || "2026";
const work = await layTokenSongWork(DIR, () => { });
if (!work) { log("✗ Thiếu token work/hr — dừng."); process.exit(2); }
const HH = { authorization: work, accept: "application/json" };
const V1 = "https://wshr.hasaki.vn/api";
const gj = async (u, ms = 90000) => { const ac = new AbortController(); const to = setTimeout(() => ac.abort(), ms); try { const r = await fetch(u, { headers: HH, signal: ac.signal }); const t = await r.text(); clearTimeout(to); let j = null; try { j = JSON.parse(t); } catch { } return { s: r.status, j }; } catch (e) { clearTimeout(to); return { s: "ERR " + e.name, j: null }; } };
const rows_ = (j) => j?.data?.rows || (Array.isArray(j?.data) ? j.data : []) || [];

const dir = (await gj(`${V1}/news/staff/search-for-dropdown?limit=10000&sort=staff_id`)).j?.data || [];
const tai = dir.filter(s => String(s.staff_loc_id) === LOC || String(s.working_loc_id) === LOC);
const majors = majorsArg ? majorsArg.split(",") : null;
const quet = majors ? tai.filter(s => majors.includes(String(s.major_id))) : tai;
log(`Địa điểm ${LOC}: ${tai.length} NV trong danh bạ · sẽ đọc ${quet.length} NV${majors ? " (nghiệp vụ " + majors.join(",") + ")" : ""} · năm ${NAM}\n`);

const kq = [], loi = [];
for (let i = 0; i < quet.length; i++) {
  const s = quet[i];
  const ss = await gj(`${V1}/hr/sheet-summary?from_date=${NAM}-01-01&to_date=${NAM}-12-31&staff_id=${s.staff_id}&limit=200`);
  if (ss.s !== 200) { loi.push({ s, vi: "HTTP " + ss.s }); continue; }
  const bangs = rows_(ss.j).sort((a, b) => String(b.month).localeCompare(String(a.month)));   // mới nhất trước
  const coRO = bangs.find(b => b.kpi_item && b.kpi_item.Remaining_Off != null);
  const nam = bangs.filter(b => String(b.month).startsWith(NAM));
  const daNghi = nam.reduce((t, b) => t + Number(b.kpi_item?.Anual_Leave || 0), 0);
  kq.push({
    code: s.code, ten: s.staff_name, email: s.staff_email || "", major: s.major_id, majorTen: s.staff_major || "",
    conLai: coRO ? Number(coRO.kpi_item.Remaining_Off) : null,
    mocThang: coRO ? String(coRO.month).slice(0, 7) : null,
    daNghiNam: Math.round(daNghi * 100) / 100,
    nghiBu: coRO ? Number(coRO.kpi_item.Compensatory_Leave || 0) : null,
    soThang: nam.length,
  });
  if ((i + 1) % 40 === 0) log(`  … ${i + 1}/${quet.length}`);
}

const co = kq.filter(x => x.conLai != null).sort((a, b) => b.conLai - a.conLai);
const khong = kq.filter(x => x.conLai == null);
log(`\n═══ PHÉP CÒN LẠI — địa điểm ${LOC}, năm ${NAM} ═══`);
log(`đọc được: ${co.length} NV · không có số liệu: ${khong.length} · lỗi: ${loi.length}\n`);
log("  mã       họ tên                          nghiệp vụ                 phép còn lại  đã nghỉ " + NAM + "  nghỉ bù  (mốc)");
log("  " + "-".repeat(112));
for (const x of co)
  log(`  ${String(x.code).padEnd(8)} ${String(x.ten).padEnd(30)} ${String(x.majorTen || x.major).padEnd(24)} ${String(x.conLai).padStart(12)} ${String(x.daNghiNam).padStart(11)} ${String(x.nghiBu ?? "-").padStart(8)}  ${x.mocThang}`);
const tong = co.reduce((t, x) => t + x.conLai, 0);
log(`\n  Tổng phép còn lại: ${Math.round(tong * 100) / 100} ngày · trung bình ${(tong / (co.length || 1)).toFixed(2)} ngày/NV`);
const nhieu = co.filter(x => x.conLai >= 5);
log(`  Còn ≥ 5 ngày (cần nhắc nghỉ bớt): ${nhieu.length} NV` + (nhieu.length ? " → " + nhieu.map(x => x.ten + " (" + x.conLai + ")").join(", ") : ""));
const het = co.filter(x => x.conLai <= 0);
log(`  Đã hết phép (≤ 0): ${het.length} NV` + (het.length ? " → " + het.map(x => x.ten).join(", ") : ""));
if (khong.length) log(`\n  Không có số liệu Remaining_Off (${khong.length}): ` + khong.slice(0, 25).map(x => x.ten + "/" + x.code).join(", ") + (khong.length > 25 ? " …" : ""));

const csv = ["Ma,Ho ten,Email,Nghiep vu,Phep con lai,Da nghi " + NAM + ",Nghi bu,Moc thang"]
  .concat(co.map(x => [x.code, x.ten, x.email, x.majorTen || x.major, x.conLai, x.daNghiNam, x.nghiBu ?? "", x.mocThang].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")));
fs.writeFileSync(path.join(OUT, `phep-con-lai-${LOC}-${NAM}.csv`), "﻿" + csv.join("\n"), "utf8");
fs.writeFileSync(path.join(OUT, `phep-con-lai-${LOC}-${NAM}.json`), JSON.stringify({ loc: LOC, nam: NAM, luc: new Date().toISOString(), co, khong, loi: loi.map(x => x.s.code) }, null, 1));
log(`\n→ Đã lưu .exports/phep-con-lai-${LOC}-${NAM}.csv (mở được bằng Excel) và .json`);
process.exit(0);
