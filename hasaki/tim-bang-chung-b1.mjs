/**
 * tim-bang-chung-b1.mjs — MÁY TỰ TÌM BẰNG CHỨNG CAMERA cho phiếu B1 (user 05/10/2026: "mục Máy xác minh · quyết định
 * máy phải tìm video/hình ảnh bằng chứng — chưa có thì sao ra quyết định").
 *
 *  Nguồn giờ: .exports/canh-b1-ketqua.json — cò B1 đã tra hệ thống kho, mỗi ứng viên có `lan` = giờ châm hàng vào ô ("MM-DD HH:mm").
 *  Cách làm (KHÔNG AI): với phiếu B1 còn mở có giờ kho → gọi _kenh-luc-chup.mjs <id> --luc=<giờ kho> (chọn kênh theo mã ô từ
 *  ban-do-camera-o.json tenKenh, cắt 40 s mỗi kênh, ghép lưới cùng ảnh ghi nhận) → chép lưới sang
 *  Videos/5S-bang-chung/may/<id>_KHO-<MMDDHHmm>.jpg + ghi .exports/bang-chung-b1.json {id:{anh,chu,kenh,luc}}.
 *  bang-591 đọc file này → dashboard hiện "ảnh mốc" và mở khoá nút Quyết định. KHÔNG gắn gì lên phiếu (gắn clip lên phiếu bắt buộc qua _clip-noi.mjs).
 *
 *  node tim-bang-chung-b1.mjs [--max=3] [--id=13393784] [--thu]
 *  Tải: chỉ đầu ghi top-review (≤16 kênh × 40 s / phiếu, tuần tự, nghỉ 2 s giữa kênh) — 0 lượt gọi work/wms/hr.
 */
import "dotenv/config";   // 14/10: tự nạp .env (BAIXE_DIR…) — chạy thẳng trên PC không qua chay-xm từng ghi bằng chứng vào đường mặc định của laptop
import fs from "node:fs"; import path from "node:path"; import { execFileSync } from "node:child_process"; import { fileURLToPath } from "node:url";
const DIR = path.dirname(fileURLToPath(import.meta.url)); process.chdir(DIR);
const A = Object.fromEntries(process.argv.slice(2).map((x) => { const [k, v] = x.replace(/^--/, "").split("="); return [k, v ?? true]; }));
const MAX = Number(A.max || 3), THU = !!A.thu;
const F_KQ = path.join(DIR, ".exports", "canh-b1-ketqua.json"), F_RA = path.join(DIR, ".exports", "bang-chung-b1.json");
const GOC_BC = path.join(process.env.BAIXE_DIR ? path.dirname(process.env.BAIXE_DIR) : "C:/Users/lechitam/Videos/5S-bang-chung", "may");
const log = (...a) => console.log(new Date().toTimeString().slice(0, 8), ...a);
const doc = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };

const kq = doc(F_KQ, {}), so = doc(F_RA, {});
// phiếu còn mở ở B1: hỏi máy chủ nội bộ (đã gom sẵn), không gọi wshr
let mo = null, PH = [];
try { const j = await (await fetch("http://127.0.0.1:8591/api/du-lieu", { signal: AbortSignal.timeout(15000) })).json(); PH = j.phieu.filter((p) => p.buoc === "B1"); mo = new Set(PH.map((p) => String(p.id))); }
catch { log("⚠ máy chủ 8591 không trả lời — xét mọi phiếu trong canh-b1-ketqua"); }

/* 05/10 user: "đều có góc cam chỉa vào, tìm cho ra" — vị trí _kenh-luc-chup không tự đoán được (chữ tự do / A2-503) → kênh tra từ tenKenh
   (ban-do-camera-o.json): "Tu Loked", "RE IT Shopee", "Bai Xe May", 3 nhóm kênh nhìn dãy 503. */
const KENH_THEM = [[/t[uủ] ?lock/i, "172.16.10.10/5,172.16.10.11/4"], [/re ?it|shopee/i, "172.16.10.16/12,172.16.10.11/19,172.16.10.10/47,172.16.10.10/48,172.16.10.10/49,172.16.10.12/23"],
  [/bai ?xe|baixe/i, "172.16.10.12/32"], [/s[aạ]c xe n[aâ]ng/i, "172.16.10.16/10,172.16.10.16/8"], /* 05/10: soi lưới 14 kênh lúc chụp 13619200 — kênh A2-501 số 10 thấy xe nâng trắng đỗ cạnh cửa, kệ Mastige phía sau (khớp ảnh) */ [/A2-503/i, "172.16.10.11/21"]   /* 05/10 soi lưới 13569286: chỉ "KE 504 - 505 Truoc" thấy kệ 503 khu A2; .19/5-8 là dãy 502-503 khu A1 */];
const kenhThem = (bin) => (KENH_THEM.find(([re]) => re.test(String(bin || ""))) || [])[1] || "";
const viec = [];
for (const [id, x] of Object.entries(kq)) {
  if (A.id && String(A.id) !== id) continue;
  if (mo && !mo.has(id)) continue;
  const ung = (x.ungVienWms || x.nv || []).filter((v) => (v.lan || []).length);   // 10/10: A1-01 giữ ứng viên WMS riêng
  if (!ung.length) continue;
  const v = ung[0], lan = v.lan[0];                       // ứng viên đầu = người máy nghi nhất, lần châm hàng đầu tiên trong danh sách
  const m = /^(\d{2})-(\d{2}) (\d{2}):(\d{2})/.exec(lan); if (!m) continue;
  const nam = String(x.ngay || "").slice(0, 4) || "2026";
  const luc = `${nam}-${m[1]}-${m[2]} ${m[3]}:${m[4]}:00`;
  if (so[id] && so[id].luc === luc && ((so[id].anh || []).length || (so[id].hong || 0) >= 3)) continue;   // đã có khung đúng giờ này / hỏng đủ 3 lần
  viec.push({ id, luc, v, x, loai: "kho" });
}
/* 05/10 nguồn 2 — phiếu KHÔNG có giờ kho (rác, CCDC, vệ sinh…): chụp camera đúng GIỜ NGƯỜI KIỂM CHỤP ẢNH (ngày VP trên phiếu).
   Chỉ xác định GÓC camera nhìn thấy chỗ vi phạm, CHƯA thấy người làm ⇒ dashboard không mở khoá Quyết định bằng loại này. Xếp SAU nguồn kho. */
const daCo = new Set(viec.map((w) => w.id));
for (const p of PH) { const id = String(p.id);
  if (A.id && String(A.id) !== id) continue; if (daCo.has(id) || kq[id] && (kq[id].nv || []).some((v) => (v.lan || []).length)) continue;
  const luc = String(p.ngayVP || "").slice(0, 19); if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(luc)) continue;
  if (so[id] && (so[id].anh || []).length || so[id] && (so[id].hong || 0) >= 3) continue;
  viec.push({ id, luc: luc.length === 16 ? luc + ":00" : luc, v: {}, x: { bin: p.viTri }, loai: "chup" }); }
log(`${viec.length} phiếu cần tìm khung camera (chạy tối đa ${MAX})`);
fs.mkdirSync(GOC_BC, { recursive: true });
let lam = 0;
// 14/10 «chạy ra sao, của task nào» → tab Máy trạm (lượt thật)
const TD = THU ? null : await import("./tien-do.mjs");
const dsTD = viec.slice(0, MAX); TD?.batDau("tim-bang-chung-b1", "Tìm khung camera cho phiếu B1");
for (const w of viec.slice(0, MAX)) {
  TD?.tienDo({ buoc: "Tìm khung camera cho phiếu B1", task: w.id, i: dsTD.indexOf(w) + 1, n: dsTD.length, chiTiet: String(w.x && w.x.bin || "") });
  log(w.loai === "kho" ? `▶ ${w.id} · ${w.x.bin} · ${w.v.ten} (${w.v.code}) châm ${w.v.qty ?? "?"} lúc ${w.luc}` : `▶ ${w.id} · ${w.x.bin} · lúc chụp ảnh ${w.luc}`);
  if (THU) continue;
  let out = ""; const batDau = Date.now();
  /* 05/10 KIỂM: gọi dồn 50 phiếu liền → đầu ghi .19 trả "400 Bad Request" (lỗi TẠM — thử lại sau 15–30 s đều cắt được) ⇒ nghỉ 6 s giữa phiếu, 0 kênh ra hình thì chờ 25 s thử lại 1 lần */
  await new Promise((r) => setTimeout(r, 6000));
  /* 05/10 KIỂM thêm: đầu ghi .19 trả 400 cho RIÊNG một số cửa sổ (09:53:56–09:54:36 hỏng, 09:53:30 / 09:54:16 được) — không phải quá tải
     ⇒ 0 kênh ra hình thì thử lại với mốc lệch −30 s rồi +25 s (giờ kho/giờ chụp vẫn nằm trong đoạn 40 s) */
  const them = kenhThem(w.x.bin);
  const chay = (lech) => execFileSync(process.execPath, ["_kenh-luc-chup.mjs", w.id, "--luc=" + new Date(Date.parse(w.luc.replace(" ", "T") + "+07:00") + lech * 1000 + 7 * 36e5).toISOString().slice(0, 19)].concat(them ? ["--them=" + them] : []), { encoding: "utf8", windowsHide: true, timeout: 20 * 60e3 });
  try { let loiCuoi = null; for (const lech of [0, -30, 25]) { try { out = chay(lech); loiCuoi = null; break; } catch (e1) { if (e1.status !== 4) throw e1; loiCuoi = e1; log(`  … 0 kênh ra hình (lệch ${lech} s) — thử mốc khác`); await new Promise((r) => setTimeout(r, 8000)); } } if (loiCuoi) throw loiCuoi; }
  catch (e) {
    if (e.status === 2) { so[w.id] = { luc: w.luc, hong: 3, khongKenh: true, anh: [], taiLuc: new Date().toISOString() }; fs.writeFileSync(F_RA, JSON.stringify(so, null, 1)); log("  ✗ không đoán được camera cho vị trí này — cần khai kênh (ban-do-camera-o.json)"); continue; }
    if (e.status === 4) {   // _kenh-luc-chup exit 4 = không kênh nào ra hình (phiên WF591 thêm 05/10) → tính 1 lần hỏng, tối đa 3
      const lan = ((so[w.id] || {}).hong || 0) + 1; so[w.id] = { luc: w.luc, hong: lan, anh: [], taiLuc: new Date().toISOString() };
      fs.writeFileSync(F_RA, JSON.stringify(so, null, 1)); log(`  ✗ không kênh nào ra hình (lần ${lan}/3)`); continue; }
    log("  ✗ chụp khung lỗi:", String(e.stdout || e.message).split("\n").filter(Boolean).slice(-1)[0]); continue; }
  const f = (/→\s*(.+\.jpg)\s*$/m.exec(out) || [])[1];
  if (!f || !fs.existsSync(path.resolve(DIR, f.trim()))) { log("  ✗ không có ảnh ra", out.split("\n").slice(-3).join(" | ")); continue; }
  const kj = doc(path.join(DIR, ".exports", "kenh-luc-chup", w.id + ".json"), {});
  /* 05/10 KIỂM: 14007380 (5L2 kênh 53 lúc 18:09) ra lưới "không có hình" mà vẫn bị tính là bằng chứng → chỉ nhận khi ≥1 kênh
     có khung MỚI chụp trong lượt này (_kenh-luc-chup giữ <id>_<kênh>_<đuôi IP>_f0.jpg); hỏng thì thử lại ở lượt sau, tối đa 3 lần. */
  const coHinh = (kj.kenh || []).filter((k) => { const [h, c] = k.split("/"); const fj = path.join(DIR, ".exports", "kenh-luc-chup", `${w.id}_${c}_${h.split(".").pop()}_f0.jpg`);
    try { return fs.statSync(fj).mtimeMs >= batDau - 5e3; } catch { return false; } }).length;
  if (!coHinh) { const lan = ((so[w.id] || {}).hong || 0) + 1; so[w.id] = { luc: w.luc, hong: lan, anh: [], taiLuc: new Date().toISOString() }; fs.writeFileSync(F_RA, JSON.stringify(so, null, 1));
    log(`  ✗ không kênh nào ra hình (lần ${lan}/3) — ${lan < 3 ? "thử lại lượt sau" : "bỏ, cần chọn kênh tay (--them=)"}`); continue; }
  const ten = `${w.id}_${w.loai === "kho" ? "KHO" : "CHUP"}-${w.luc.replace(/[^0-9]/g, "").slice(4, 12)}.jpg`;
  fs.copyFileSync(path.resolve(DIR, f.trim()), path.join(GOC_BC, ten));
  const cuXm = so[w.id] && so[w.id].nguon === "xac-minh-tu-dong" ? so[w.id] : null;   // 10/10: giữ ảnh + kết luận xác minh máy (trước đây bị ghi đè)
  so[w.id] = { ...(cuXm || {}), anh: [...((cuXm && cuXm.anh) || []).filter((a) => /_XM-/.test(a)), ten], luc: w.luc, loai: cuXm ? cuXm.loai : w.loai, coHinh, kenh: (kj.kenh || []).map((k) => "kênh " + k.split("/")[1]).slice(0, 4).join(", "),
    chu: w.loai === "kho" ? `Khung camera đúng giờ hệ thống kho: ${w.v.ten} (${w.v.code}) châm ${w.v.qty ?? "?"} lúc ${w.luc.slice(5, 16)}` : `Khung camera lúc người kiểm chụp ảnh ${w.luc.slice(5, 16)} — xác định góc nhìn, chưa thấy người làm`, taiLuc: new Date().toISOString() };
  if (cuXm) { const k = so[w.id].chu; so[w.id].chuKho = k; so[w.id].chu = String(cuXm.chu || "").split(" ‖ ")[0] + " ‖ " + k; so[w.id].nguon = "xac-minh-tu-dong"; }
  fs.writeFileSync(F_RA, JSON.stringify(so, null, 1)); lam++;
  log(`  ✓ ${ten} · ${so[w.id].kenh}`);
}
/* 05/10 user: "toàn ảnh, k thấy clip camera" → giữ thêm 1 ĐOẠN CLIP 90 s (−20 s…+70 s quanh giờ kho) của kênh đầu tiên ra hình.
   Chỉ để XEM trên dashboard nội bộ; gắn lên phiếu vẫn bắt buộc clip chuẩn qua _clip-noi.mjs. Bù cả phiếu đã có khung mà chưa có clip. */
let clipMoi = 0;
for (const [id, v] of Object.entries(so)) {
  if (clipMoi >= MAX || THU || !(v.anh || []).length || v.clip || (v.hongClip || 0) >= 3) continue;
  if (A.id && String(A.id) !== id) continue;
  const kj = doc(path.join(DIR, ".exports", "kenh-luc-chup", id + ".json"), {});
  const k = (kj.kenh || []).find((x) => { const [h, c] = x.split("/"); return fs.existsSync(path.join(DIR, ".exports", "kenh-luc-chup", `${id}_${c}_${h.split(".").pop()}_f0.jpg`)); });
  if (!k) continue;
  const [host, ch] = k.split("/"), t0 = Date.parse(v.luc.replace(" ", "T") + "+07:00") - (v.loai === "chup" ? 80e3 : 20e3), iso = new Date(t0 + 7 * 36e5).toISOString().slice(0, 19);
  const ten = `${id}_${v.loai === "chup" ? "CHUP" : "KHO"}-${v.luc.replace(/[^0-9]/g, "").slice(4, 12)}_ch${ch}.mp4`, ra = path.join(GOC_BC, ten);
  try { execFileSync(process.execPath, ["_cat-doan.mjs", host, ch, iso, "90", ra], { stdio: "ignore", windowsHide: true, timeout: 240000 }); } catch { /* xét file bên dưới */ }
  if (fs.existsSync(ra) && fs.statSync(ra).size > 50e3) { v.clip = ten; v.clipKenh = "kênh " + ch; clipMoi++; log(`  ▶ clip ${ten} (${(fs.statSync(ra).size / 1048576).toFixed(1)} MB)`); }
  else { v.hongClip = (v.hongClip || 0) + 1; try { fs.unlinkSync(ra); } catch { /* */ } log(`  ✗ ${id}: cắt clip kênh ${ch} hỏng (lần ${v.hongClip}/3)`); }
  fs.writeFileSync(F_RA, JSON.stringify(so, null, 1)); await new Promise((r) => setTimeout(r, 2000));
}
/* 12/10 user (F0-A1-510-07-04-05 19/09 09:04): "dữ liệu có tới 5 người châm nhưng sao chỉ có 1 clip … hiển thị theo thứ tự gần thời gian
   ghi nhận nhất về trước để xác định lỗi" ⇒ MỖI lượt châm vào ô (WMS, đã có sẵn trong .cache-canh-b1.json — 0 lượt gọi WMS) một clip 90 s,
   lượt gần giờ ghi nhận nhất trước, tối đa 8 lượt/phiếu. Mốc = giờ TẠO lệnh (created_at), −20 s…+70 s.
   KIỂM 12/10 trên 13808708 kênh 31: lúc tạo lệnh 15:10 có 3 người đang châm vào ô 07; lúc hoàn tất 15:27 dãy trống ⇒ KHÔNG dùng giờ hoàn tất.
   Kênh = kênh đã ra hình của lưới phía trên. Ghi so[id].lanKho = [{at, xong, email, qty, loai, clip | hong}]. */
const CWMS = doc(path.join(DIR, ".cache-canh-b1.json"), {}), MAX_LAN = Number(A.maxLan || 24);   // ~8 s/clip ⇒ 24 lượt ≈ 3–4 phút, dưới trần 50 phút của lịch
let clipLan = 0;
for (const [id, x] of Object.entries(kq)) {
  if (THU || clipLan >= MAX_LAN) break;
  if (A.id && String(A.id) !== id) continue;
  if (mo && !mo.has(id)) continue;
  /* 12/10: gợi ý cò B1 cũ ghi bin NGẮN ("507-03-04-02") còn khoá bộ đệm là mã đầy đủ ("F0-A1-507-03-04-02") ⇒ ghép theo đuôi mã */
  const khoa = CWMS[x.bin + "|" + x.ngay] ? x.bin + "|" + x.ngay : Object.keys(CWMS).find((k) => { const [b0, n0] = k.split("|"); return n0 === x.ngay && b0.endsWith("-" + x.bin); });
  const rec = (((khoa && CWMS[khoa]) || {}).rec || []).slice().sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 8);
  const v = so[id]; if (!rec.length || !v) continue;
  const kj = doc(path.join(DIR, ".exports", "kenh-luc-chup", id + ".json"), {});
  const k = (kj.kenh || []).find((y) => { const [h, c] = y.split("/"); return fs.existsSync(path.join(DIR, ".exports", "kenh-luc-chup", `${id}_${c}_${h.split(".").pop()}_f0.jpg`)); });
  if (!k) continue;
  const [host, ch] = k.split("/");
  v.lanKho ||= [];
  for (const r of rec) {
    if (clipLan >= MAX_LAN) break;
    let e = v.lanKho.find((z) => z.at === r.at);
    if (!e) { e = { at: r.at, xong: r.xong || r.at, email: r.email, qty: r.qty, loai: r.loai }; v.lanKho.push(e); }
    if (e.clip || (e.hong || 0) >= 3) continue;
    const moc = Date.parse(String(e.at).replace(" ", "T") + "+07:00"), iso = new Date(moc - 20e3 + 7 * 36e5).toISOString().slice(0, 19);
    const ten = `${id}_LAN-${String(e.at).replace(/[^0-9]/g, "").slice(4, 14)}_ch${ch}.mp4`, ra = path.join(GOC_BC, ten);
    try { execFileSync(process.execPath, ["_cat-doan.mjs", host, ch, iso, "90", ra], { stdio: "ignore", windowsHide: true, timeout: 240000 }); } catch { /* xét file bên dưới */ }
    if (fs.existsSync(ra) && fs.statSync(ra).size > 50e3) { e.clip = ten; e.kenh = "kênh " + ch; clipLan++; log(`  ▶ ${id} lượt châm ${String(e.at).slice(5, 16)} ${e.email} → ${ten}`); }
    else { e.hong = (e.hong || 0) + 1; try { fs.unlinkSync(ra); } catch { /* */ } log(`  ✗ ${id} lượt ${String(e.at).slice(5, 16)}: cắt clip hỏng (lần ${e.hong}/3)`); }
    fs.writeFileSync(F_RA, JSON.stringify(so, null, 1)); await new Promise((r2) => setTimeout(r2, 2000));
  }
}
log(`xong: ${lam} phiếu có khung mới · ${clipMoi} clip mới · ${clipLan} clip lượt châm → ${F_RA}`);
await TD?.xong();
