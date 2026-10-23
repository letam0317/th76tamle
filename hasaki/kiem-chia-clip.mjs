/**
 * kiem-chia-clip.mjs — ĐỐI SOÁT KẾT QUẢ CẮT CLIP SAU KHI CHIA VIỆC 2 MÁY TRẠM (laptop, 23/10/2026).
 *
 *  User 23/10: «lượng clip cắt lớn — CẦN CHIA VIỆC / KIỂM TRA KẾT QUẢ SAU CHIA VIỆC của các máy trạm — phân tích các kịch bản có thể xảy ra
 *  để có hướng xử lý». tim-bang-chung-b1 chia 2 phần theo task_id (phần 1 = id lẻ… cụ thể: id % 2 == 0 → phần 1, == 1 → phần 2), phần 1 ghim
 *  JE75K38, phần 2 ghim FOQ5T89, so le 1 giờ; mỗi clip ghi dấu `may` = «<máy> · phần i/n · <giờ chạy>». Bộ này đọc dữ liệu ĐÃ VỀ LAPTOP
 *  (dong-bo-xm dinh-ky kéo «chung» + «ra») — 0 lượt gọi upstream, chỉ đọc đĩa + 8591.
 *
 *  KỊCH BẢN → DẤU HIỆU BẮT → HƯỚNG XỬ LÝ (in kèm mỗi cảnh báo):
 *   K1 Bình thường: mỗi phần do máy ghim của nó làm.                                  → ghi số clip/hỏng theo máy, theo phần.
 *   K2 Máy ghim tắt / mất nhịp → cổng gác giao phần đó cho máy dự phòng.               → phần do máy dự phòng làm (thông tin, không lỗi);
 *      nếu CẢ HAI tắt: lượt cần cắt mà chưa có clip > 6 giờ (TRỄ).                      → bật lại máy / xem tab Máy trạm.
 *   K3 Máy chạy BẢN MÃ CŨ (chưa kéo git — 23/10 14:30 FOQ5T89 đã dính): bản cũ không hiểu XM_PHAN ⇒ làm cả 2 phần, clip KHÔNG có dấu `may`.
 *      → clip mới (tệp tạo sau giờ phát hành) mà không có dấu máy, hoặc 1 máy cắt phiếu của phần kia ⇒ «máy X chạy bản cũ / lệch phần»
 *      → chạy _CAP-NHAT-PC trên máy đó (hoặc chờ lượt cập nhật 2 giờ), kiểm lại.
 *   K4 Đầu ghi camera quá tải / 400 (2 máy tải cùng lúc): lượt hỏng (hong) tăng, hỏng 3 lần thì bỏ hẳn.
 *      → tỉ lệ hỏng theo máy > 30% hoặc lượt bỏ hẳn ⇒ báo; xử lý: giãn lịch (so le hơn) / giảm --max.
 *   K5 Clip đã cắt nhưng TỆP chưa về laptop (đẩy «ra» hỏng / kho Drive chập chờn) → bảng có tên clip mà bấm không phát.
 *      → clip ghi trong bang-chung-b1 mà không có tệp ở @BC/may sau 45' ⇒ «clip chưa về» → chạy `node dong-bo-xm.mjs dinh-ky` trên laptop.
 *   K6 GỘP 3 CHIỀU làm MẤT clip đã cắt (hồi quy đồng bộ): so với lần kiểm trước — clip từng có nay biến mất khỏi bang-chung-b1.
 *      → báo ngay (kèm tên tệp); tệp vẫn còn trên đĩa ⇒ khôi phục bằng tay / sửa gop3.
 *   K7 TRÙNG: cùng 1 lượt (phiếu+giờ+chiều) có ≥2 tệp clip khác máy ⇒ 2 máy làm cùng phiếu (K3) → như K3.
 *   K8 Hàng chờ «Cắt thêm» bị gỡ mà không cắt thêm gì (lỗi cũ 22–23/10): phiếu có themXong n=0 trong khi còn lượt chưa có clip
 *      → đưa lại hàng chờ (b1-cho-camera.json) — bộ này chỉ BÁO, không tự ghi.
 *   K9 LỆCH TẢI: số clip phần 1/phần 2 chênh > 3 lần trong 24 giờ → cân nhắc chia theo số lượt thay vì chẵn/lẻ.
 *  Ra: .exports/kiem-chia-clip.json { luc, tom, theoMay, theoPhan, canhBao:[{ma, muc, phieu?, chu, xuLy}] } + in ra màn.
 *  node kiem-chia-clip.mjs [--phat-hanh=<ISO giờ đẩy bản chia phần>] [--tre=6]
 */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { ghiJson } from "./so-ghi.mjs";
const DIR = path.dirname(fileURLToPath(import.meta.url)); process.chdir(DIR);
const A = Object.fromEntries(process.argv.slice(2).map((x) => { const [k, v] = x.replace(/^--/, "").split("="); return [k, v ?? true]; }));
const EXP = path.join(DIR, ".exports"), BC = path.join(process.env.BAIXE_DIR ? path.dirname(process.env.BAIXE_DIR) : "C:/Users/lechitam/Videos/5S-bang-chung", "may");
const doc = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };
const ms = (s) => Date.parse(String(s).replace(" ", "T").slice(0, 19) + "+07:00");
const now = Date.now(), TRE = Number(A.tre || 6) * 36e5;
const CFG = doc(path.join(DIR, "cai-pc", "dieu-phoi.json"), {}), V1 = (CFG.viec || []).find((v) => v.ten === "tim-bang-chung-b1") || {};
const N = Number(String((V1.env || {}).XM_PHAN || "1/1").split("/")[1]) || 1;
const PHAT = A["phat-hanh"] ? Date.parse(A["phat-hanh"]) : doc(path.join(EXP, ".kiem-chia-clip-moc.json"), {}).phatHanh || 0;
const phanCua = (id) => (Number(id) % N) + 1, mayGhim = (p) => (p === 1 ? V1.uuTien : ((CFG.viec || []).find((v) => v.ten === "tim-bang-chung-b1-" + p) || {}).uuTien || [])[0] || "?";
const so = doc(path.join(EXP, "bang-chung-b1.json"), {}), kq = doc(path.join(EXP, "canh-b1-ketqua.json"), {}), CW = doc(path.join(DIR, ".cache-canh-b1.json"), {});
const SOAN = doc(path.join(EXP, "soan-hang-b1.json"), {}), HANG = doc(path.join(EXP, "b1-cho-camera.json"), {});
let mo = null; if (!process.env.KIEM_KHONG_8591) try { const j = await (await fetch("http://127.0.0.1:8591/api/du-lieu", { signal: AbortSignal.timeout(20000) })).json(); mo = new Set(j.phieu.filter((p) => p.buoc === "B1").map((p) => String(p.id))); } catch { /* 8591 tắt → xét mọi phiếu */ }
const canhBao = [], bao = (ma, muc, chu, xuLy, phieu) => canhBao.push({ ma, muc, ...(phieu ? { phieu } : {}), chu, xuLy });
const theoMay = {}, theoPhan = {}, cong = (o, k, f) => { (o[k] ||= { clip: 0, hong: 0, bo: 0, clip24h: 0 })[f]++; };
const tep = (f) => { try { return fs.statSync(path.join(BC, f)); } catch { return null; } };
const truoc = doc(path.join(EXP, ".kiem-chia-clip-truoc.json"), { clip: {} }), nay = { clip: {} };
const trung = new Map();
let tre = 0, chuaVe = 0;
for (const [id, v] of Object.entries(so)) {
  const p = phanCua(id), mGhim = mayGhim(p);
  const muc = [...(v.lanKho || []).map((e) => ({ ...e, loai: e.chieu || "vao" })), ...(v.clip ? [{ clip: v.clip, may: v.clipMay, loai: "moc", at: v.luc }] : []), ...(v.clipThem || []).map((e) => ({ ...e, loai: "them" }))];
  for (const e of muc) {
    if (e.clip) {
      const st = tep(e.clip), may = String(e.may || "").split(" · ")[0] || "", t = st ? st.mtimeMs : 0;
      nay.clip[id + "|" + e.clip] = 1;
      cong(theoMay, may || "(không dấu)", "clip"); cong(theoPhan, "phần " + p, "clip"); if (t && now - t < 864e5) { theoMay[may || "(không dấu)"].clip24h++; theoPhan["phần " + p].clip24h++; }
      if (!st) { const luc = e.may ? Date.parse(String(e.may).split(" · ")[2] || "") : 0; if (!luc || now - luc > 45 * 60e3) chuaVe++; if (chuaVe <= 20 && (!luc || now - luc > 45 * 60e3)) bao("K5", "vua", `clip ${e.clip} ghi trong bảng nhưng tệp chưa về laptop`, "chạy `node dong-bo-xm.mjs dinh-ky` trên laptop; vẫn thiếu thì xem nhật ký máy " + (may || "?"), id); }
      if (PHAT && t > PHAT && !e.may) bao("K3", "cao", `clip ${e.clip} cắt SAU giờ phát hành mà không có dấu máy ⇒ máy chạy bản mã cũ (làm cả 2 phần)`, "chạy _CAP-NHAT-PC trên máy trạm đó / chờ lượt cập nhật, rồi chạy lại bộ này", id);
      if (e.may && N > 1 && !new RegExp("phần " + p + "/").test(e.may)) bao("K3", "cao", `phiếu thuộc phần ${p} nhưng ${may} cắt với dấu «${String(e.may).split(" · ")[1]}»`, "máy lệch phần: kiểm env XM_PHAN trong dieu-phoi.json / bản mã máy", id);
      if (e.may && mGhim !== "?" && may && may !== mGhim) cong(theoPhan, "phần " + p + " do dự phòng", "clip");   // K2 thông tin
      const kt = id + "|" + e.loai + "|" + e.at; if (e.at && e.loai !== "them" && !e.phu) { const ds = trung.get(kt) || new Set(); ds.add(e.clip); trung.set(kt, ds); }
    } else if (e.hong) { cong(theoMay, "(chưa biết)", "hong"); cong(theoPhan, "phần " + p, "hong"); if (e.hong >= 3) { cong(theoPhan, "phần " + p, "bo"); bao("K4", "vua", `lượt ${e.loai} ${e.at} hỏng 3 lần — đã BỎ (đầu ghi không trả đoạn)`, "xem lượt khác cùng kênh; nhiều lượt bỏ cùng giờ ⇒ giãn lịch 2 phần / giảm --max", id); } }
  }
  /* K2/K8: phiếu còn mở có lượt (châm/rút ≤8 gần nhất, soạn ≤6) mà chưa clip lâu > TRE */
  if (mo && !mo.has(id)) continue;
  const x = kq[id]; if (!x) continue;
  const khoa = CW[x.bin + "|" + x.ngay] ? x.bin + "|" + x.ngay : Object.keys(CW).find((k) => { const [b0, n0] = k.split("|"); return n0 === x.ngay && b0.endsWith("-" + x.bin); });
  const cw = (khoa && CW[khoa]) || {};
  const can = (cw.rec || []).map((r) => ({ at: r.at, loai: "vao" })).concat((cw.ra || []).filter((r) => r.loai !== "SOAN_DON").map((r) => ({ at: r.at, loai: "ra" }))).sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 8)
    .concat(((khoa && SOAN[khoa]) || { ds: [] }).ds.slice(0, 6).map((r) => ({ at: r.at, loai: "soan" })));
  const kenhOk = fs.existsSync(path.join(EXP, "kenh-luc-chup", id + ".json")) && (v.anh || []).length;
  if (!kenhOk) continue;
  const thieu = can.filter((c) => !(v.lanKho || []).some((e) => e.at === c.at && (e.chieu || "vao") === c.loai && (e.clip || (e.hong || 0) >= 3)));
  /* tuổi tính từ lúc DỮ LIỆU của lượt có mặt: châm/rút = lần cò B1 tra (x.luc, ISO) / khung camera (v.taiLuc, ISO); soạn = sổ soan-hang-b1 (luc) */
  const cuKho = Math.max(Date.parse(v.taiLuc || "") || 0, Date.parse(x.luc || "") || 0), cuSoan = Date.parse(((khoa && SOAN[khoa]) || {}).luc || "") || 0;
  const treDs = thieu.filter((c) => { const cu = c.loai === "soan" ? cuSoan : cuKho; return cu && now - cu > TRE; }), cu = Math.min(...treDs.map((c) => (c.loai === "soan" ? cuSoan : cuKho)));
  if (treDs.length) { const thieu = treDs; tre++; if (tre <= 25) bao("K2", "vua", `${thieu.length} lượt (${[...new Set(thieu.map((t) => t.loai))].join("/")}) chưa có clip sau ${Math.round((now - cu) / 36e5)} giờ — phần ${p} (máy ghim ${mGhim})`, "xem tab Máy trạm: máy ghim + dự phòng còn sống? bản mã mới chưa? nhật ký .exports/nhat-ky-may/", id); }
  if (v.themXong && !v.themXong.n && thieu.some((c) => c.loai !== "soan" && Date.parse(v.themXong.luc) > (Date.parse(x.luc || "") || 0))) bao("K8", "vua", `«Cắt thêm» đã gỡ khỏi hàng chờ với 0 clip mà còn ${thieu.length} lượt chưa cắt`, "đưa lại phiếu vào .exports/b1-cho-camera.json", id);
}
for (const [k, ds] of trung) if (ds.size > 1) bao("K7", "cao", `lượt ${k.split("|").slice(1).join(" ")} có ${ds.size} tệp clip: ${[...ds].join(", ")}`, "2 máy làm cùng phiếu ⇒ xử lý như K3", k.split("|")[0]);
for (const k of Object.keys(truoc.clip)) if (!nay.clip[k]) { const [id, f] = k.split("|"); bao("K6", "cao", `clip ${f} có ở lần kiểm trước nay MẤT khỏi bang-chung-b1.json${tep(f) ? " (tệp vẫn còn trên đĩa)" : ""}`, "gộp 3 chiều / ghi đè làm mất — khôi phục mục lanKho từ .exports/.dbxm-goc hoặc bản sao lưu, báo lại để sửa gop3", id); }
for (const [m, s] of Object.entries(theoMay)) if (s.hong + s.clip >= 10 && s.hong / (s.hong + s.clip) > 0.3) bao("K4", "vua", `máy ${m}: hỏng ${s.hong}/${s.hong + s.clip} lượt`, "giãn lịch 2 phần / giảm --max");
const p1 = (theoPhan["phần 1"] || {}).clip24h || 0, p2 = (theoPhan["phần 2"] || {}).clip24h || 0;
if (N > 1 && Math.max(p1, p2) >= 12 && Math.max(p1, p2) > 3 * Math.max(1, Math.min(p1, p2))) bao("K9", "thap", `24 giờ qua: phần 1 cắt ${p1} clip, phần 2 cắt ${p2} clip — lệch tải`, "cân nhắc chia theo số lượt cần cắt thay vì chẵn/lẻ mã phiếu");
if (chuaVe > 20) bao("K5", "vua", `tổng ${chuaVe} clip chưa về laptop (chỉ liệt kê 20)`, "chạy `node dong-bo-xm.mjs dinh-ky`");
if (tre > 25) bao("K2", "vua", `tổng ${tre} phiếu có lượt trễ (chỉ liệt kê 25)`, "xem tab Máy trạm");
const tom = { phieu: Object.keys(so).length, clip: Object.values(theoMay).reduce((a, s) => a + s.clip, 0), cao: canhBao.filter((c) => c.muc === "cao").length, vua: canhBao.filter((c) => c.muc === "vua").length, phatHanh: PHAT ? new Date(PHAT).toISOString() : "" };
ghiJson(path.join(EXP, "kiem-chia-clip.json"), { luc: new Date().toISOString(), tom, theoMay, theoPhan, canhBao }, { thut: 1, ai: "kiem-chia-clip" });
ghiJson(path.join(EXP, ".kiem-chia-clip-truoc.json"), nay, { thut: 0, ai: "kiem-chia-clip" });
if (A["phat-hanh"]) ghiJson(path.join(EXP, ".kiem-chia-clip-moc.json"), { phatHanh: PHAT }, { thut: 0 });
console.log(`ĐỐI SOÁT CHIA VIỆC CLIP — ${tom.clip} clip / ${tom.phieu} phiếu · cảnh báo: ${tom.cao} cao · ${tom.vua} vừa`);
for (const [m, s] of Object.entries(theoMay)) console.log(`  máy ${m.padEnd(22)} clip ${s.clip} (24h: ${s.clip24h}) · hỏng ${s.hong}`);
for (const [m, s] of Object.entries(theoPhan)) console.log(`  ${m.padEnd(26)} clip ${s.clip} (24h: ${s.clip24h}) · hỏng ${s.hong} · bỏ ${s.bo}`);
for (const c of canhBao.slice(0, 40)) console.log(`  [${c.ma} ${c.muc}] ${c.phieu ? c.phieu + " · " : ""}${c.chu}\n        → ${c.xuLy}`);
process.exit(canhBao.some((c) => c.muc === "cao") ? 4 : 0);
