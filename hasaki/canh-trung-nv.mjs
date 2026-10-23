/* 05/10/2026 — 2 luật user chốt cho phiếu WF591 (tất định, không AI):
 *  CH-05: cùng NV + cùng lỗi (TYPE00) + cùng ngày ghi nhận (DATE00) nhưng KHÁC vị trí → chỉ trừ 1 lần ở phiếu ghi nhận ĐẦU TIÊN;
 *         các phiếu sau: dừng (không trừ) + bình luận nhắc NV và tag QLTT.
 *  CH-06: 1 NV trong 1 THÁNG (theo ngày ghi nhận) có ≥3 lỗi (bất kỳ) → ở lỗi thứ 4 (và các lỗi sau) bình luận tag QLTT nhắc tính tuân thủ.
 *  "Phiếu của NV" = B1 đã đóng có staff = mã NV (đã qua xác minh). Phiếu đã bị CH-05 gộp thì không đếm cho CH-06.
 *  DL-03 (quét lùi, 23/10): cùng ô + cùng lỗi + cùng giờ vi phạm + ảnh giống = 1 vi phạm lập 2 phiếu → dừng phiếu thừa.
 *  node canh-trung-nv.mjs [--lam]   — 1 lượt board (120 ngày) + sổ .canh-trung-nv.json chống làm lại. */
import "dotenv/config"; import fs from "node:fs"; import sharp from "sharp";
import { layTokenSongWork, layTokenGhiWork } from "./session-rules.js";
const V = "https://wshr.hasaki.vn/api"; const LAM = process.argv.includes("--lam"); const F_SO = ".canh-trung-nv.json";
/* cửa giờ 07–18 T2–T7 (như canh-b1/canh-b11) + khoá chống chạy chồng */
{ const h = new Date(Date.now() + 7 * 36e5); if (LAM && !process.argv.includes("--force") && (h.getUTCDay() === 0 || h.getUTCHours() < 7 || h.getUTCHours() >= 18)) { console.log("ngoài cửa 07–18 T2–T7 — thôi"); process.exit(0); } }
const KHOA = ".canh-trung-nv.lock";
if (fs.existsSync(KHOA) && Date.now() - fs.statSync(KHOA).mtimeMs < 30 * 60e3) { console.log("đang có lượt khác chạy — thôi"); process.exit(0); }
fs.writeFileSync(KHOA, String(process.pid)); process.on("exit", () => { try { fs.unlinkSync(KHOA); } catch { } });
const so = (() => { try { return JSON.parse(fs.readFileSync(F_SO, "utf8")); } catch { return { gop: {}, tag06: {} }; } })();
/* 16/10 khoá ghi: --lam (bình luận/dừng phiếu) chỉ bằng phiên tamlc; chạy thử chỉ đọc thì phiên nào cũng được */
const t = LAM ? await layTokenGhiWork(process.cwd(), () => {}) : await layTokenSongWork(process.cwd(), () => {});
if (!t) { console.log(LAM ? "không có phiên tamlc sống — bỏ lượt (phiên mượn chỉ được đọc)" : "không có token work"); process.exit(LAM ? 75 : 1); } const HW = { authorization: t, origin: "https://work.hasaki.vn", referer: "https://work.hasaki.vn/" };
const iso = (d) => d.toISOString().slice(0, 10);
const rows = (((await (await fetch(V + "/hr/workflows/detail-workflow-task/591?from_date=" + iso(new Date(Date.now() - 120 * 864e5)) + "&to_date=" + iso(new Date(Date.now() + 864e5)) + "&search_type=board", { headers: { authorization: t }, signal: AbortSignal.timeout(180000) })).json()).data || {}).rows || []);
const DB = (JSON.parse(fs.readFileSync(".cache-danhba.json", "utf8")).data || []); const nvMa = (m) => DB.find((d) => String(d.code) === String(m));
const tag = (n) => (n && n.user_id ? "@[" + n.staff_name + "](user_id:" + n.user_id + ")" : (n && n.staff_name) || "");
const link = (id) => "https://work.hasaki.vn/tasks?task_id=" + id;
/* phiếu đã xác minh ra NV: B1 xong (st 2) có configs.staff; bỏ phiếu cha bị dừng/huỷ (status 4/6) */
const P = [];
for (const x of rows) {
  if ([4, 6].includes(+x.status)) continue;
  const b1 = (x.subtasks || []).filter((s) => +s.workflow_step_id === 7379 && +s.status === 2).pop(); if (!b1) continue;
  const c = x.data.configs || {}, nv = String((b1.data && b1.data.configs && b1.data.configs.staff) || "").split(",").map((s) => s.trim()).filter(Boolean);
  const ql = (b1.data && b1.data.configs && b1.data.configs.QLBP02) || "";
  const treo = (x.subtasks || []).filter((s) => [0, 1].includes(+s.status));
  for (const m of nv) P.push({ id: x.id, nv: m, loi: String(c.TYPE00 || "").trim(), ngay: String(c.DATE00 || "").slice(0, 10), luc: String(c.DATE00 || ""), bin: String(c.BIN00 || "").trim(), cha: +x.status, treo, ql });
}
const QL = (p) => DB.find((d) => d.staff_name === p.ql);
let viec = 0;
/* dừng phiếu (re-create-step −1 + note_failed + bình luận), đọc lại để chắc đã dừng — dùng chung DL-03/CH-05 */
async function dungPhieu(id, buocId, ly, bl) {
  await fetch(V + "/hr/projects/re-create-step/" + buocId, { method: "POST", headers: { ...HW, "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ workflow_step_id: "-1" }) }).catch(() => {});
  await new Promise((r) => setTimeout(r, 1200));
  const luc = new Date(Date.now() + 7 * 36e5).toISOString().replace("T", " ").slice(0, 19);
  const fd = new FormData(); fd.set("id", String(buocId)); fd.set("field", "data");
  fd.set("value[note_failed]", JSON.stringify([{ note_failed: ly, staff_name: "Lê Chí Tâm", staff_code: "233135", created_at: luc }]));
  await fetch(V + "/hr/projects/mass-update-field-task-input", { method: "POST", body: fd, headers: HW }).catch(() => {});
  const fc = new FormData(); fc.set("obj_id", String(id)); fc.set("comment", bl); await fetch(V + "/v2/task/comment", { method: "POST", body: fc, headers: HW }).catch(() => {});
  const d2 = (await (await fetch(V + "/hr/projects/task-input/" + id, { headers: { authorization: t, accept: "application/json" } })).json()).data;
  return +d2.status === 2 && !(d2.subtasks || []).some((s) => [0, 1].includes(+s.status));
}
/* ---- DL-03 QUÉT LÙI ----
   23/10: 7 cặp trùng 17/09–05/10 do form gửi đúp. Chặn tại nguồn (push-5s, 05/10) không dọn phiếu cũ, sổ ảnh lại RIÊNG từng máy
   (laptop ban ngày · PC ngoài giờ) → 4 cặp nằm cả tháng; cặp 19/09 phiếu SAU đã đi hết B3 mà phiếu TRƯỚC còn treo B1 = nguy cơ trừ 2 lần.
   Cùng ô + cùng lỗi + cùng giờ vi phạm (tới giây) + ảnh giống (xám 16×16, lệch ≤ 6 như _dung-phieu-trung) ⇒ 1 vi phạm.
   Giữ phiếu đã qua B1 nếu có, không thì phiếu tạo trước; chỉ dừng phiếu còn lại khi nó MỚI treo ở B1. Cả 2 đã qua B1 → in ra, xem tay. */
const B1 = 7379; so.dl03 ||= {};
const b1Cua = (x) => (x.subtasks || []).filter((s) => +s.workflow_step_id === B1).pop();
const conTreo = (x) => (x.subtasks || []).some((s) => [0, 1].includes(+s.status));
const bamAnh = async (x) => Promise.all([].concat(x.data.configs.IMA00 || []).map(async (p) => sharp(Buffer.from(await (await fetch("https://hr-media.hasaki.vn/production/hr/" + p)).arrayBuffer())).resize(16, 16, { fit: "fill" }).greyscale().raw().toBuffer()));
const lechAnh = (a, b) => { let d = 0; for (let i = 0; i < 256; i++) d += Math.abs(a[i] - b[i]); return d / 256; };
const nhomDL = {};
for (const x of rows) {
  if ([4, 6].includes(+x.status)) continue;
  const b = b1Cua(x), c = (x.data && x.data.configs) || {}; if (!b || +b.status === 4 || !c.DATE00) continue;   // B1 st 4 = đã bị dừng
  (nhomDL[[String(c.BIN00 || "").trim(), c.TYPE00, c.DATE00].join("|")] ||= []).push(x);
}
for (const ds of Object.values(nhomDL)) {
  if (ds.length < 2) continue;
  ds.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) || a.id - b.id);
  const quaB1 = ds.filter((x) => +b1Cua(x).status === 2);
  if (quaB1.length > 1) { if (quaB1.some(conTreo)) console.log("DL-03 ⚠ trùng nhưng", quaB1.length, "phiếu đã qua B1 — xem tay:", quaB1.map((x) => link(x.id)).join(" ")); continue; }
  const giu = quaB1[0] || ds[0];
  for (const x of ds) {
    if (x === giu || so.dl03[x.id] || !conTreo(x)) continue;   // RA-01: phiếu đã xong → để nguyên
    const treo = (x.subtasks || []).filter((s) => [0, 1].includes(+s.status));
    if (treo.length !== 1 || +treo[0].workflow_step_id !== B1) { console.log("DL-03 ⚠", x.id, "trùng", giu.id, "nhưng không chỉ treo B1 — xem tay"); continue; }
    const ha = await bamAnh(giu), hb = await bamAnh(x);
    if (!(hb.length && hb.every((y) => ha.some((z) => lechAnh(y, z) <= 6)))) continue;   // ảnh khác → 2 vi phạm thật
    const ly = "Trùng phiếu " + link(giu.id) + " (cùng ảnh, cùng vị trí, cùng lỗi, cùng giờ vi phạm)";
    console.log("DL-03", x.id, "→ trùng", giu.id, "·", String(x.data.configs.BIN00).trim(), "·", x.data.configs.DATE00); viec++;
    if (!LAM) continue;
    const ok = await dungPhieu(x.id, treo[0].id, ly, ly + " — đã dừng phiếu này, xử lý ở phiếu giữ.");
    console.log("  ", ok ? "✓ đã dừng" : "✗ đọc lại chưa thấy dừng — xem tay " + link(x.id));
    if (ok) { so.dl03[x.id] = { giu: giu.id, luc: new Date().toISOString() }; fs.writeFileSync(F_SO, JSON.stringify(so, null, 1)); }
  }
}
/* ---- CH-07 (user chốt 23/10, ca 13774184/13774186: 1 thùng chụp cách 1,5′ ghi thành 2 lỗi khác nhau) ----
   Cùng ô + giờ vi phạm cách ≤ 15′ + KHÁC lỗi = 1 lần đi kiểm → chỉ tính 1: giữ phiếu đã qua B1 nếu có, không thì phiếu ghi nhận
   sớm nhất; dừng phiếu còn lại khi nó MỚI treo ở B1. Bỏ giờ tròn HH:00:00 (cò tự động đặt giờ, không phải giờ chụp). */
so.ch07 ||= {};
const cumO = {};
for (const ds of Object.values(nhomDL)) for (const x of ds) { const c = x.data.configs; if (!/:00:00$/.test(c.DATE00)) (cumO[String(c.BIN00 || "").trim()] ||= []).push(x); }
for (const [o, ds0] of Object.entries(cumO)) {
  const ds = [...new Map(ds0.map((x) => [x.id, x])).values()].sort((a, b) => a.data.configs.DATE00.localeCompare(b.data.configs.DATE00) || a.id - b.id);
  const ms = (x) => Date.parse(x.data.configs.DATE00.replace(" ", "T"));
  for (let i = 0; i < ds.length;) {
    let j = i + 1; while (j < ds.length && ms(ds[j]) - ms(ds[i]) <= 15 * 60e3) j++;
    const cum = ds.slice(i, j); i = j;
    if (cum.length < 2 || new Set(cum.map((x) => x.data.configs.TYPE00)).size < 2) continue;   // cùng lỗi → DL-03 lo
    const giu = cum.find((x) => +b1Cua(x).status === 2) || cum[0];
    for (const x of cum) {
      if (x === giu || x.data.configs.TYPE00 === giu.data.configs.TYPE00 || so.ch07[x.id] || so.dl03[x.id] || !conTreo(x)) continue;
      const treo = (x.subtasks || []).filter((s) => [0, 1].includes(+s.status));
      if (treo.length !== 1 || +treo[0].workflow_step_id !== B1) { console.log("CH-07 ⚠", x.id, "cùng lượt với", giu.id, "nhưng đã qua B1 — xem tay"); continue; }
      const ly = "Gộp vào phiếu " + link(giu.id) + " (cùng ô " + o + ", cùng lượt ghi nhận — 1 lần kiểm chỉ tính 1 lỗi)";
      console.log("CH-07", x.id, "→ gộp vào", giu.id, "·", o, "·", x.data.configs.DATE00, "vs", giu.data.configs.DATE00); viec++;
      if (!LAM) continue;
      const ok = await dungPhieu(x.id, treo[0].id, ly, ly + " — đã dừng phiếu này.");
      console.log("  ", ok ? "✓ đã dừng" : "✗ đọc lại chưa thấy dừng — xem tay " + link(x.id));
      if (ok) { so.ch07[x.id] = { vao: giu.id, luc: new Date().toISOString() }; fs.writeFileSync(F_SO, JSON.stringify(so, null, 1)); }
    }
  }
}
/* ---- CH-05 ---- */
const nhom = {}; for (const p of P) (nhom[p.nv + "|" + p.loi + "|" + p.ngay] ||= []).push(p);
for (const ds of Object.values(nhom)) {
  if (ds.length < 2) continue; ds.sort((a, b) => a.luc.localeCompare(b.luc) || a.id - b.id);
  const dau = ds[0];
  for (const p of ds.slice(1)) {
    if (p.bin === dau.bin) continue;                       // cùng vị trí → CH-01/DL-03 lo
    if (so.gop[p.id]) continue;
    if (!p.treo.length) continue;                        // RA-01: phiếu đã xong → để nguyên
    const nv = nvMa(p.nv), ql = QL(p);
    const ly = "Gộp vào phiếu " + link(dau.id) + " (cùng nhân viên, cùng lỗi, cùng ngày)";
    const bl = (ql ? tag(ql) + " " : "") + "Nhờ anh/chị nhắc " + tag(nv) + ": lặp lại cùng lỗi tại " + p.bin + " trong cùng ngày " + p.ngay.split("-").reverse().join("/") + " (đã ghi nhận ở phiếu " + link(dau.id) + ").";
    console.log("CH-05", p.id, "→ gộp vào", dau.id, "·", nv ? nv.staff_name : p.nv, "·", p.bin, "| treo:", p.treo.map((s) => s.name.trim()).join(","));
    viec++;
    if (!LAM) continue;
    if (p.treo.length !== 1) { console.log("  ⚠ cần đúng 1 bước treo để dừng — xem tay"); continue; }
    const ok = await dungPhieu(p.id, p.treo[0].id, ly, bl);
    console.log("  ", ok ? "✓ đã dừng + nhắc/tag QLTT" : "✗ đọc lại chưa thấy dừng — xem tay " + link(p.id));
    if (ok) { so.gop[p.id] = { vao: dau.id, luc: new Date().toISOString() }; fs.writeFileSync(F_SO, JSON.stringify(so, null, 1)); }
  }
}
/* ---- CH-06 ---- */
/* CH-05 gộp (kể cả phiếu cũ cùng NV+lỗi+ngày) chỉ tính 1 lỗi */
const daGop = new Set(); for (const ds of Object.values(nhom)) { ds.sort((a, b) => a.luc.localeCompare(b.luc) || a.id - b.id); for (const p of ds.slice(1)) if (p.bin !== ds[0].bin) daGop.add(p.id); }
const thang = {}; for (const p of P) if (!so.gop[p.id] && !daGop.has(p.id)) (thang[p.nv + "|" + p.ngay.slice(0, 7)] ||= []).push(p);
for (const [k, ds] of Object.entries(thang)) {
  const uniq = [...new Map(ds.map((p) => [p.id, p])).values()].sort((a, b) => a.luc.localeCompare(b.luc) || a.id - b.id);
  if (uniq.length < 4) continue;
  for (const [i, p] of uniq.entries()) {
    if (i < 3 || so.tag06[p.id] || p.cha === 2) continue;   // từ lỗi thứ 4; phiếu đã xong thì thôi
    const nv = nvMa(p.nv), ql = QL(p);
    const bl = (ql ? tag(ql) + " " : "") + "Nhờ anh/chị nhắc nhở " + tag(nv) + " về tính tuân thủ: đây là lỗi thứ " + (i + 1) + " trong tháng " + p.ngay.slice(5, 7) + "/" + p.ngay.slice(0, 4) + " (" + uniq.slice(0, i).map((x) => link(x.id)).join(", ") + ").";
    console.log("   các lỗi trước:", uniq.slice(0, i).map((x) => x.id + " " + x.ngay + " " + x.bin).join(" | "));
    console.log("CH-06", p.id, "·", nv ? nv.staff_name : p.nv, "· lỗi thứ", i + 1, "tháng", k.split("|")[1]); viec++;
    if (!LAM) continue;
    const fc = new FormData(); fc.set("obj_id", String(p.id)); fc.set("comment", bl); await fetch(V + "/v2/task/comment", { method: "POST", body: fc, headers: HW }).catch(() => {});
    so.tag06[p.id] = { thu: i + 1, luc: new Date().toISOString() }; fs.writeFileSync(F_SO, JSON.stringify(so, null, 1)); console.log("   ✓ đã tag QLTT");
  }
}
console.log(viec ? "" : "Không có việc CH-05/CH-06.", LAM ? "" : "(diễn tập — thêm --lam để làm)");
