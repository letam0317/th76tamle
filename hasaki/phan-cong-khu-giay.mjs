/**
 * phan-cong-khu-giay.mjs — PHÂN CÔNG KHU GIẤY · RÁC THEO NGÀY (luật PL-01, user chốt 05/10/2026:
 * "quản lý phân công xoay vòng theo ngày" → nguồn = task 5S hằng ngày QL tự tạo từ khuôn suggest 1297
 * «Sắp xếp hàng hóa kho tổng (Áp dụng cho kho tổng)»; ghi chú task liệt kê từng khu + @người).
 *
 *  wshr KHÔNG có API liệt kê task thường (dò >40 route 25/09 + swagger 05/10 chỉ 11 path) ⇒ nạp theo ID:
 *    node phan-cong-khu-giay.mjs --task=13993204,13901730      # thêm task (link hoặc số đều được)
 *    node phan-cong-khu-giay.mjs                               # đọc lại task chưa chốt (hạn chưa qua 1 ngày)
 *  Sổ ID dùng chung với qltt-phancong (.cache-qltt-phancong.json: tasks) + sổ riêng .phan-cong-khu-giay.json.
 *  Ra: .exports/phan-cong-khu-giay.json — { ngay: { tasks:[{id,ql,khu:[{loai,dong,nguoi:[{code,ten,ca,xong,anh}]}]}] } }
 *  Lượt gọi: 1 GET task-input / task chưa chốt / lượt. Task đã qua hạn +1 ngày thì đóng băng, không gọi lại.
 */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import "dotenv/config"; import { layTokenSongWork } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const F_SO = path.join(DIR, ".phan-cong-khu-giay.json"), F_QL = path.join(DIR, ".cache-qltt-phancong.json");
const F_RA = path.join(DIR, ".exports", "phan-cong-khu-giay.json");
const V = "https://wshr.hasaki.vn/api", SUGGEST = 1297;
const log = (...a) => console.log(new Date().toTimeString().slice(0, 8), ...a);
const boDau = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/\s+/g, " ").trim();
const VI_TRI = { KG: { ten: "Kho giấy tái chế", ma: "F0-A4-504-01-01-01" }, PL: { ten: "Phân loại thùng · giấy rác", ma: "F0-A4-506-01-01-01" } };

let so = { tasks: {} }; try { so = { ...so, ...JSON.parse(fs.readFileSync(F_SO, "utf8")) }; } catch { /* lần đầu */ }
const them = (process.argv.find((a) => a.startsWith("--task=")) || "").slice(7).split(",").map((s) => (s.match(/(\d{7,9})/) || [])[1]).filter(Boolean);
try { for (const id of Object.keys(JSON.parse(fs.readFileSync(F_QL, "utf8")).tasks || {})) them.push(id); } catch { /* chưa có sổ QLTT */ }
for (const id of them) so.tasks[id] ||= { chot: false };

/* dòng phân công trong ghi chú: "- <khu>: @A @B" — chỉ phần TRƯỚC "Yêu cầu:" (phía sau là tiêu chuẩn, không phải người) */
function tachKhu(note, nv) {
  const phan = String(note || "").split(/\n\s*y[eê]u c[aầ]u\s*:/i)[0];
  const ra = [];
  for (const dong of phan.split(/\n/)) {
    if (!dong.includes("@")) continue;
    const b = boDau(dong), khuTxt = dong.split("@")[0].replace(/^[\s\-–•+]+/, "").replace(/[:：]\s*$/, "").trim();
    const loai = /kho giay/.test(b) && !/phan loai (thung|giay)/.test(b) ? "KG" : /phan loai/.test(b) && /(giay|rac|thung)/.test(b) ? "PL" : /kho giay/.test(b) ? "KG" : null;
    if (!loai) continue;
    const ca = /ca sang/.test(b) ? "sáng" : /ca toi|ca chieu/.test(b) ? (/ca toi/.test(b) ? "tối" : "chiều") : "";
    const ten = dong.split("@").slice(1).map((x) => x.replace(/[,;]+$/, "").trim()).filter(Boolean);
    const nguoi = ten.map((t) => { const k = boDau(t); const s = nv.find((x) => boDau(x.ten) === k) || nv.find((x) => k.startsWith(boDau(x.ten)));
      return s ? { ...s } : { ten: t, code: "", khongKhop: true }; });
    ra.push({ loai, dong: khuTxt, ca, nguoi, ...VI_TRI[loai] });
  }
  return ra;
}

const homNay = new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10);
const canDoc = Object.entries(so.tasks).filter(([, v]) => !v.chot).map(([id]) => id);
if (canDoc.length) {
  const token = await layTokenSongWork(DIR, log);
  if (!token) { log("✗ Không có token work sống — giữ dữ liệu cũ."); }
  else for (const id of canDoc) {
    let d; try { d = (await (await fetch(`${V}/hr/projects/task-input/${id}`, { headers: { authorization: token, accept: "application/json" }, signal: AbortSignal.timeout(30000) })).json()).data; } catch (e) { log("⚠", id, e.message); continue; }
    if (!d) { log("✗", id, "không đọc được"); continue; }
    if (Number(d.task_suggest_id) !== SUGGEST) { log("✗", id, "không phải task phân công 5S (suggest", d.task_suggest_id + ") — bỏ"); delete so.tasks[id]; continue; }
    const nv = (d.assign_to_user || []).map((u) => ({ code: String(u.code || ""), ten: u.staff_name, staffId: u.staff_id }));
    const bao = {}; for (const s of d.staff || []) { let x = {}; try { x = JSON.parse(s.data || "{}"); } catch { /* */ }
      bao[s.staff_id] = { xong: s.finished_at || null, anh: (x.configs?.virtual_media || []).length, tt: s.status }; }
    const khu = tachKhu(d.note, nv).map((k) => ({ ...k, nguoi: k.nguoi.map((p) => ({ ...p, ...(bao[p.staffId] || { xong: null, anh: 0 }) })) }));
    const ngay = String(d.date_start || d.created_at).slice(0, 10);
    so.tasks[id] = { chot: String(d.date_end || "").slice(0, 10) < homNay && khu.every((k) => k.nguoi.every((p) => p.xong)) || (Date.parse(String(d.date_end).replace(" ", "T") + "+07:00") + 864e5 < Date.now()),
      ngay, ql: d.created_by_user?.staff_name || "?", qlCode: String(d.created_by_user?.code || ""), han: d.date_end, khu, docLuc: new Date().toISOString() };
    log(`✓ ${id} ${ngay} QL ${so.tasks[id].ql}: ${khu.map((k) => k.loai + "=" + k.nguoi.length).join(" ") || "không có dòng khu giấy/rác"}`);
  }
}
fs.writeFileSync(F_SO, JSON.stringify(so, null, 1));
const theoNgay = {};
for (const [id, t] of Object.entries(so.tasks)) if (t.ngay) (theoNgay[t.ngay] ||= { tasks: [] }).tasks.push({ id: Number(id), link: "https://work.hasaki.vn/tasks?task_id=" + id, ql: t.ql, han: t.han, khu: t.khu });
fs.mkdirSync(path.dirname(F_RA), { recursive: true });
fs.writeFileSync(F_RA, JSON.stringify({ capNhat: new Date().toISOString(), viTri: VI_TRI, ngay: theoNgay }, null, 1));
log(`→ ${F_RA}: ${Object.keys(theoNgay).length} ngày, ${Object.keys(so.tasks).length} task`);
