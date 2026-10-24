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
import { ghiJson } from "./so-ghi.mjs";   // 20/10 ghi sổ JSON an toàn (ghi tạm → đổi tên) + nhật ký ai ghi
const DIR = path.dirname(fileURLToPath(import.meta.url)); process.chdir(DIR);
const A = Object.fromEntries(process.argv.slice(2).map((x) => { const [k, v] = x.replace(/^--/, "").split("="); return [k, v ?? true]; }));
const MAX = Number(A.max || 3), THU = !!A.thu;
/* 23/10 user «lượng clip cắt lớn — CHIA VIỆC + KIỂM TRA KẾT QUẢ sau chia việc của các máy trạm»: 2 phần theo mã phiếu (--phan=i/n hoặc env XM_PHAN
   do chay-xm đặt từ dieu-phoi.json) — phần i chỉ làm phiếu có task_id % n == i−1 (khuôn xac-minh-dem). Phần 1 ghim JE75K38, phần 2 ghim FOQ5T89
   (dự phòng chéo), lịch SO LE 1 giờ ⇒ đầu ghi camera không bị 2 máy tải cùng lúc (05/10 đo: gọi dồn → 400). Mỗi clip ghi dấu máy+phần
   (`may`) để kiem-chia-clip.mjs (laptop) đối soát. Cùng 1 máy gánh cả 2 phần (máy kia tắt) → khoá máy .tim-bang-chung.lock: phần sau CHỜ
   tối đa 40' rồi mới bỏ lượt (không chạy chồng — 2 tiến trình cùng ghi bang-chung-b1.json sẽ mất phần nhau). */
const [PHAN_I, PHAN_N] = String(A.phan || process.env.XM_PHAN || "1/1").split("/").map(Number);
const cuaToi = (id) => !(PHAN_N > 1) || Number(id) % PHAN_N === PHAN_I - 1;
const DAU = (await import("node:os")).hostname() + " · phần " + PHAN_I + "/" + PHAN_N + " · " + new Date().toISOString();
const F_KHOA = path.join(path.dirname(fileURLToPath(import.meta.url)), ".exports", ".tim-bang-chung.lock");
if (!THU) {
  const song = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
  for (let t0 = Date.now(); ;) {
    let k = null; try { k = JSON.parse(fs.readFileSync(F_KHOA, "utf8")); } catch { /* chưa có khoá */ }
    if (!k || !song(k.pid) || Date.now() - k.luc > 3 * 36e5) break;
    /* TBC_CHO_PHUT: bộ thử rút ngắn thời gian chờ */
    if (Date.now() - t0 > (Number(process.env.TBC_CHO_PHUT) || 40) * 60e3) { console.log("⏭ phần " + PHAN_I + "/" + PHAN_N + ": máy đang chạy phần " + k.phan + " quá 40' — bỏ lượt"); process.exit(0); }
    await new Promise((r) => setTimeout(r, process.env.TBC_CHO_PHUT ? 2e3 : 30e3));
  }
  fs.mkdirSync(path.dirname(F_KHOA), { recursive: true }); ghiJson(F_KHOA, { pid: process.pid, luc: Date.now(), phan: PHAN_I + "/" + PHAN_N }, { thut: 0, ai: "tim-bang-chung-b1 khoá máy" });
  process.on("exit", () => { try { const k = JSON.parse(fs.readFileSync(F_KHOA, "utf8")); if (k.pid === process.pid) fs.unlinkSync(F_KHOA); } catch { /* */ } });
}
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
  if (!cuaToi(id)) continue;   // 23/10 chia phần
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
  if (!cuaToi(id)) continue;   // 23/10 chia phần
  if (A.id && String(A.id) !== id) continue; if (daCo.has(id) || kq[id] && (kq[id].nv || []).some((v) => (v.lan || []).length)) continue;
  const luc = String(p.ngayVP || "").slice(0, 19); if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(luc)) continue;
  if (so[id] && (so[id].anh || []).length || so[id] && (so[id].hong || 0) >= 3) continue;
  viec.push({ id, luc: luc.length === 16 ? luc + ":00" : luc, v: {}, x: { bin: p.viTri }, loai: "chup" }); }
/* 20/10 HÀNG CHỜ «Cắt thêm clip camera» (bạn chọn ở cột Quyết định → canh-b1 ghi .exports/b1-cho-camera.json) trước nay KHÔNG CÓ cò nào đọc
   (14115619 nằm hàng chờ từ 12/10, bảng còn ghi nhầm «Đã xử lý»). Nay: phiếu trong hàng chờ xếp ĐẦU lượt; có khung/clip rồi thì gỡ khỏi hàng chờ (cuối lượt). */
const F_HANG = path.join(DIR, ".exports", "b1-cho-camera.json"), HANG = doc(F_HANG, {});
viec.sort((a, b) => (HANG[b.id] ? 1 : 0) - (HANG[a.id] ? 1 : 0));
log(`[phần ${PHAN_I}/${PHAN_N}] ${viec.length} phiếu cần tìm khung camera (chạy tối đa ${MAX})${Object.keys(HANG).length ? ` · hàng chờ cắt clip: ${Object.keys(HANG).join(", ")}` : ""}`);
fs.mkdirSync(GOC_BC, { recursive: true });
let lam = 0;
// 14/10 «chạy ra sao, của task nào» → tab Máy trạm (lượt thật)
const TD = THU ? null : await import("./tien-do.mjs");
/* 22/10 user «khi nào xử lý xong»: phiếu trong hàng chờ KHÔNG bị trần MAX chặn — lượt này cắt hết hàng chờ (đã xếp đầu), tối thiểu MAX phiếu */
const dsTD = viec.slice(0, Math.max(MAX, viec.filter((w) => HANG[w.id]).length)); TD?.batDau("tim-bang-chung-b1", "Tìm khung camera cho phiếu B1");
for (const w of dsTD) {
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
    /* 19/10 user (13740905 «7 người châm mà không có clip»): nhánh hỏng từng GHI ĐÈ cả bản ghi → mất anh/clip/lanKho đã cắt (PC không có khung
       f0 của laptop nên chụp lại hỏng rồi gộp về laptop xoá luôn 16 phiếu). Nay nhánh hỏng chỉ cập nhật hong/taiLuc, GIỮ mọi thứ đã có. */
    if (e.status === 2) { so[w.id] = { ...(so[w.id] || {}), luc: w.luc, hong: 3, khongKenh: true, anh: (so[w.id] || {}).anh || [], taiLuc: new Date().toISOString() }; ghiJson(F_RA, so, { thut: 1 }); log("  ✗ không đoán được camera cho vị trí này — cần khai kênh (ban-do-camera-o.json)"); continue; }
    if (e.status === 4) {   // _kenh-luc-chup exit 4 = không kênh nào ra hình (phiên WF591 thêm 05/10) → tính 1 lần hỏng, tối đa 3
      const lan = ((so[w.id] || {}).hong || 0) + 1; so[w.id] = { ...(so[w.id] || {}), luc: w.luc, hong: lan, anh: (so[w.id] || {}).anh || [], taiLuc: new Date().toISOString() };
      ghiJson(F_RA, so, { thut: 1 }); log(`  ✗ không kênh nào ra hình (lần ${lan}/3)`); continue; }
    log("  ✗ chụp khung lỗi:", String(e.stdout || e.message).split("\n").filter(Boolean).slice(-1)[0]); continue; }
  const f = (/→\s*(.+\.jpg)\s*$/m.exec(out) || [])[1];
  if (!f || !fs.existsSync(path.resolve(DIR, f.trim()))) { log("  ✗ không có ảnh ra", out.split("\n").slice(-3).join(" | ")); continue; }
  const kj = doc(path.join(DIR, ".exports", "kenh-luc-chup", w.id + ".json"), {});
  /* 05/10 KIỂM: 14007380 (5L2 kênh 53 lúc 18:09) ra lưới "không có hình" mà vẫn bị tính là bằng chứng → chỉ nhận khi ≥1 kênh
     có khung MỚI chụp trong lượt này (_kenh-luc-chup giữ <id>_<kênh>_<đuôi IP>_f0.jpg); hỏng thì thử lại ở lượt sau, tối đa 3 lần. */
  const coHinh = (kj.kenh || []).filter((k) => { const [h, c] = k.split("/"); const fj = path.join(DIR, ".exports", "kenh-luc-chup", `${w.id}_${c}_${h.split(".").pop()}_f0.jpg`);
    try { return fs.statSync(fj).mtimeMs >= batDau - 5e3; } catch { return false; } }).length;
  if (!coHinh) { const lan = ((so[w.id] || {}).hong || 0) + 1; so[w.id] = { ...(so[w.id] || {}), luc: w.luc, hong: lan, anh: (so[w.id] || {}).anh || [], taiLuc: new Date().toISOString() }; ghiJson(F_RA, so, { thut: 1 });
    log(`  ✗ không kênh nào ra hình (lần ${lan}/3) — ${lan < 3 ? "thử lại lượt sau" : "bỏ, cần chọn kênh tay (--them=)"}`); continue; }
  const ten = `${w.id}_${w.loai === "kho" ? "KHO" : "CHUP"}-${w.luc.replace(/[^0-9]/g, "").slice(4, 12)}.jpg`;
  fs.copyFileSync(path.resolve(DIR, f.trim()), path.join(GOC_BC, ten));
  const cuXm = so[w.id] && so[w.id].nguon === "xac-minh-tu-dong" ? so[w.id] : null;   // 10/10: giữ ảnh + kết luận xác minh máy (trước đây bị ghi đè)
  const cu = so[w.id] || {};   // 19/10: giữ clip từng lượt châm (lanKho) — không phụ thuộc mốc; clip mốc chỉ giữ khi cùng mốc
  so[w.id] = { ...(cu.lanKho ? { lanKho: cu.lanKho } : {}), ...(cu.clip && cu.luc === w.luc ? { clip: cu.clip, clipKenh: cu.clipKenh } : {}), ...(cuXm || {}), anh: [...((cuXm && cuXm.anh) || []).filter((a) => /_XM-/.test(a)), ten], luc: w.luc, loai: cuXm ? cuXm.loai : w.loai, coHinh, kenh: (kj.kenh || []).map((k) => "kênh " + k.split("/")[1]).slice(0, 4).join(", "),
    chu: w.loai === "kho" ? `Khung camera đúng giờ hệ thống kho: ${w.v.ten} (${w.v.code}) châm ${w.v.qty ?? "?"} lúc ${w.luc.slice(5, 16)}` : `Khung camera lúc người kiểm chụp ảnh ${w.luc.slice(5, 16)} — xác định góc nhìn, chưa thấy người làm`, taiLuc: new Date().toISOString() };
  if (cuXm) { const k = so[w.id].chu; so[w.id].chuKho = k; so[w.id].chu = String(cuXm.chu || "").split(" ‖ ")[0] + " ‖ " + k; so[w.id].nguon = "xac-minh-tu-dong"; }
  ghiJson(F_RA, so, { thut: 1 }); lam++;
  log(`  ✓ ${ten} · ${so[w.id].kenh}`);
}
/* 05/10 user: "toàn ảnh, k thấy clip camera" → giữ thêm 1 ĐOẠN CLIP 90 s (−20 s…+70 s quanh giờ kho) của kênh đầu tiên ra hình.
   Chỉ để XEM trên dashboard nội bộ; gắn lên phiếu vẫn bắt buộc clip chuẩn qua _clip-noi.mjs. Bù cả phiếu đã có khung mà chưa có clip. */
/* 24/10 GỐC RỄ «soạn hàng chưa có clip»: ảnh lưới <id>_<kênh>_<đuôi IP>_f0.jpg thuộc nhóm «ra» của dong-bo-xm → về laptop rồi XOÁ khỏi kho,
   máy trạm (nhất là máy nhận phần sau khi chia 2 phần) không còn ảnh ⇒ mọi vòng cắt clip «continue» im lặng, 0 clip từ 23/10 chiều.
   Kênh coi là đã ra hình khi còn ảnh f0 HOẶC sổ bang-chung-b1 (đồng bộ chung) đã ghi kênh đó cho phiếu. */
const raHinh = (id, y) => { const [h, c] = y.split("/"); if (fs.existsSync(path.join(DIR, ".exports", "kenh-luc-chup", `${id}_${c}_${h.split(".").pop()}_f0.jpg`))) return true;
  const v = so[id] || {}, kn = "kênh " + c;
  return v.kenh === kn || v.clipKenh === kn || (v.lanKho || []).some((z) => z.kenh === kn) || (v.clipThem || []).some((z) => z.kenh === kn); };
/* 24/10 user «các clip cắt thêm 30s VỀ TRƯỚC so với các clip hiện tại — cắt thêm, không phải dời»: mọi clip bắt đầu sớm hơn 30 s, điểm cuối GIỮ
   nguyên (độ dài +30 s). Mỗi clip ghi lui = số giây trước mốc lúc bắt đầu ⇒ bang-591/hasaki-xacminh tính giờ camera đúng cho cả clip cũ lẫn mới. */
const TRUOC_THEM = 30;
let clipMoi = 0;
for (const [id, v] of Object.entries(so)) {
  if (!cuaToi(id)) continue;   // 23/10 chia phần
  if (clipMoi >= MAX || THU || !(v.anh || []).length || v.clip || (v.hongClip || 0) >= 3) continue;
  if (A.id && String(A.id) !== id) continue;
  const kj = doc(path.join(DIR, ".exports", "kenh-luc-chup", id + ".json"), {});
  const k = (kj.kenh || []).find((x) => raHinh(id, x));
  if (!k) continue;
  const [host, ch] = k.split("/"), luiS = (v.loai === "chup" ? 80 : 20) + TRUOC_THEM, t0 = Date.parse(v.luc.replace(" ", "T") + "+07:00") - luiS * 1e3, iso = new Date(t0 + 7 * 36e5).toISOString().slice(0, 19);
  const ten = `${id}_${v.loai === "chup" ? "CHUP" : "KHO"}-${v.luc.replace(/[^0-9]/g, "").slice(4, 12)}_ch${ch}.mp4`, ra = path.join(GOC_BC, ten);
  try { execFileSync(process.execPath, ["_cat-doan.mjs", host, ch, iso, String(90 + TRUOC_THEM), ra], { stdio: "ignore", windowsHide: true, timeout: 240000 }); } catch { /* xét file bên dưới */ }
  if (fs.existsSync(ra) && fs.statSync(ra).size > 50e3) { v.clip = ten; v.clipKenh = "kênh " + ch; v.clipMay = DAU; v.clipLui = luiS; clipMoi++; log(`  ▶ clip ${ten} (${(fs.statSync(ra).size / 1048576).toFixed(1)} MB)`); }
  else { v.hongClip = (v.hongClip || 0) + 1; try { fs.unlinkSync(ra); } catch { /* */ } log(`  ✗ ${id}: cắt clip kênh ${ch} hỏng (lần ${v.hongClip}/3)`); }
  ghiJson(F_RA, so, { thut: 1 }); await new Promise((r) => setTimeout(r, 2000));
}
/* 12/10 user (F0-A1-510-07-04-05 19/09 09:04): "dữ liệu có tới 5 người châm nhưng sao chỉ có 1 clip … hiển thị theo thứ tự gần thời gian
   ghi nhận nhất về trước để xác định lỗi" ⇒ MỖI lượt châm vào ô (WMS, đã có sẵn trong .cache-canh-b1.json — 0 lượt gọi WMS) một clip 90 s,
   lượt gần giờ ghi nhận nhất trước, tối đa 8 lượt/phiếu. Mốc = giờ TẠO lệnh (created_at), −20 s…+70 s.
   KIỂM 12/10 trên 13808708 kênh 31: lúc tạo lệnh 15:10 có 3 người đang châm vào ô 07; lúc hoàn tất 15:27 dãy trống ⇒ KHÔNG dùng giờ hoàn tất.
   Kênh = kênh đã ra hình của lưới phía trên. Ghi so[id].lanKho = [{at, xong, email, qty, loai, clip | hong}]. */
const CWMS = doc(path.join(DIR, ".cache-canh-b1.json"), {}), MAX_LAN = Number(A.maxLan || 24);   // ~8 s/clip ⇒ 24 lượt ≈ 3–4 phút, dưới trần 50 phút của lịch
let clipLan = 0; const THEM = {};   // 23/10 số clip cắt theo yêu cầu «Cắt thêm» trong lượt này
/* 22/10 user «toàn châm hàng, không thấy lấy hàng»: cắt cả lượt RÚT RA khỏi ô (CWMS[k].ra — cò B1 bin_out, PICK_MASTER ô → xe/giỏ).
   Mốc ra = created_at, −60 s…+30 s (người rút hàng thường đã đứng ở ô trước khi tạo lệnh); châm GIỮ −20…+70 s. Trần 8 lượt gần nhất/phiếu
   GỘP CHUNG cả vào lẫn ra. Tệp `_RA-` (châm `_LAN-`), lanKho ghi chieu:"ra". --thu: chỉ in lượt sẽ cắt, không cắt/không ghi. */
for (const [id, x] of Object.entries(kq).sort((a, b) => (HANG[b[0]] ? 1 : 0) - (HANG[a[0]] ? 1 : 0))) {   // 23/10 hàng chờ «Cắt thêm» trước
  if (!cuaToi(id)) continue;   // 23/10 chia phần
  if (clipLan >= MAX_LAN && !HANG[id]) break;
  if (A.id && String(A.id) !== id) continue;
  if (mo && !mo.has(id)) continue;
  /* 12/10: gợi ý cò B1 cũ ghi bin NGẮN ("507-03-04-02") còn khoá bộ đệm là mã đầy đủ ("F0-A1-507-03-04-02") ⇒ ghép theo đuôi mã */
  const khoa = CWMS[x.bin + "|" + x.ngay] ? x.bin + "|" + x.ngay : Object.keys(CWMS).find((k) => { const [b0, n0] = k.split("|"); return n0 === x.ngay && b0.endsWith("-" + x.bin); });
  const cw = (khoa && CWMS[khoa]) || {};
  const rec = (cw.rec || []).map((r) => ({ ...r, chieu: "vao" })).concat((cw.ra || []).map((r) => ({ ...r, chieu: "ra" })))
    .sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, HANG[id] ? 16 : 8);   // 23/10 phiếu bạn chọn «Cắt thêm»: trần 16 lượt
  const v = so[id]; if (!rec.length || !v) continue;
  const kj = doc(path.join(DIR, ".exports", "kenh-luc-chup", id + ".json"), {});
  const k = (kj.kenh || []).find((y) => raHinh(id, y));
  if (!k) continue;
  const [host, ch] = k.split("/");
  if (THU) { log(`  (thử) ${id} kênh ${ch}: ${rec.map((r) => (r.chieu === "ra" ? "RA " : "VÀO ") + String(r.at).slice(5, 16) + (((v.lanKho || []).find((z) => !z.phu && z.chieu !== "soan" && z.at === r.at && (z.chieu === "ra") === (r.chieu === "ra")) || {}).clip ? " (đã có clip)" : "")).join(" · ")}`); continue; }
  v.lanKho ||= [];
  for (const r of rec) {
    if (clipLan >= MAX_LAN && !HANG[id]) break;
    const laRa = r.chieu === "ra";
    let e = v.lanKho.find((z) => !z.phu && z.chieu !== "soan" && z.at === r.at && (z.chieu === "ra") === laRa);   // phu = góc camera cắt thêm (23/10)
    if (!e) { e = { at: r.at, xong: r.xong || r.at, email: r.email, qty: r.qty, loai: r.loai, ...(laRa ? { chieu: "ra", toi: r.toi || "" } : {}) }; v.lanKho.push(e); }
    if (e.clip || (e.hong || 0) >= 3) continue;
    const luiS = (laRa ? 60 : 20) + TRUOC_THEM, moc = Date.parse(String(e.at).replace(" ", "T") + "+07:00"), iso = new Date(moc - luiS * 1e3 + 7 * 36e5).toISOString().slice(0, 19);
    const ten = `${id}_${laRa ? "RA" : "LAN"}-${String(e.at).replace(/[^0-9]/g, "").slice(4, 14)}_ch${ch}.mp4`, ra = path.join(GOC_BC, ten);
    try { execFileSync(process.execPath, ["_cat-doan.mjs", host, ch, iso, String(90 + TRUOC_THEM), ra], { stdio: "ignore", windowsHide: true, timeout: 240000 }); } catch { /* xét file bên dưới */ }
    if (fs.existsSync(ra) && fs.statSync(ra).size > 50e3) { e.clip = ten; e.kenh = "kênh " + ch; e.may = DAU; e.lui = luiS; if (HANG[id]) { e.themYC = HANG[id].luc; THEM[id] = (THEM[id] || 0) + 1; } clipLan++; log(`  ▶ ${id} lượt ${laRa ? "rút ra" : "châm"} ${String(e.at).slice(5, 16)} ${e.email} → ${ten}`); }
    else { e.hong = (e.hong || 0) + 1; try { fs.unlinkSync(ra); } catch { /* */ } log(`  ✗ ${id} lượt ${String(e.at).slice(5, 16)}: cắt clip hỏng (lần ${e.hong}/3)`); }
    ghiJson(F_RA, so, { thut: 1 }); await new Promise((r2) => setTimeout(r2, 2000));
  }
}
log(`xong: ${lam} phiếu có khung mới · ${clipMoi} clip mới · ${clipLan} clip lượt châm → ${F_RA}`);
/* 23/10 user «bổ sung soạn hàng (pick)» → «làm»: lượt SOẠN theo đơn đúng ô (sổ .exports/soan-hang-b1.json — laptop dựng từ Redash truy vấn 188,
   0 lượt API WMS; dong-bo-xm kéo về PC) → clip 6 lượt gần giờ ghi nhận nhất, đoạn −45 s…+15 s quanh giờ lấy (rút từ trang soi-video pick của
   top-review: người soạn thao tác TRƯỚC mốc 10–40 s, rời ô ≤20 s sau). Tệp `_SOAN-`, lanKho chieu:"soan". Trần MAX_LAN chung với lượt châm/rút. */
const SOAN = doc(path.join(DIR, ".exports", "soan-hang-b1.json"), {});
for (const [id, x] of Object.entries(kq).sort((a, b) => (HANG[b[0]] ? 1 : 0) - (HANG[a[0]] ? 1 : 0))) {
  if (!cuaToi(id)) continue;   // 23/10 chia phần
  if (clipLan >= MAX_LAN || THU) break;
  if (A.id && String(A.id) !== id) continue;
  if (mo && !mo.has(id)) continue;
  const khoa = CWMS[x.bin + "|" + x.ngay] ? x.bin + "|" + x.ngay : Object.keys(CWMS).find((k) => { const [b0, n0] = k.split("|"); return n0 === x.ngay && b0.endsWith("-" + x.bin); });
  const sh = khoa && SOAN[khoa], v = so[id]; if (!sh || !(sh.ds || []).length || !v) continue;
  const kj = doc(path.join(DIR, ".exports", "kenh-luc-chup", id + ".json"), {});
  const k = (kj.kenh || []).find((y) => raHinh(id, y));
  if (!k) continue;
  const [host, ch] = k.split("/"); v.lanKho ||= [];
  for (const r of sh.ds.slice(0, 6)) {
    if (clipLan >= MAX_LAN) break;
    let e = v.lanKho.find((z) => z.chieu === "soan" && z.at === r.at);
    if (!e) { e = { at: r.at, xong: r.at, chieu: "soan", ten: r.ten, qty: r.qty, gio: r.gio, nhom: r.nhom, sku: r.sku }; v.lanKho.push(e); }
    if (e.clip || (e.hong || 0) >= 3) continue;
    const luiS = 45 + TRUOC_THEM, iso = new Date(Date.parse(String(r.at).replace(" ", "T") + "+07:00") - luiS * 1e3 + 7 * 36e5).toISOString().slice(0, 19);
    const ten = `${id}_SOAN-${String(r.at).replace(/[^0-9]/g, "").slice(4, 14)}_ch${ch}.mp4`, ra = path.join(GOC_BC, ten);
    try { execFileSync(process.execPath, ["_cat-doan.mjs", host, ch, iso, String(60 + TRUOC_THEM), ra], { stdio: "ignore", windowsHide: true, timeout: 240000 }); } catch { /* xét file bên dưới */ }
    if (fs.existsSync(ra) && fs.statSync(ra).size > 50e3) { e.clip = ten; e.kenh = "kênh " + ch; e.may = DAU; e.lui = luiS; if (HANG[id]) { e.themYC = HANG[id].luc; THEM[id] = (THEM[id] || 0) + 1; } clipLan++; log(`  ▶ ${id} lượt soạn ${String(r.at).slice(5, 16)} ${r.ten} → ${ten}`); }
    else { e.hong = (e.hong || 0) + 1; try { fs.unlinkSync(ra); } catch { /* */ } log(`  ✗ ${id} lượt soạn ${String(r.at).slice(5, 16)}: cắt clip hỏng (lần ${e.hong}/3)`); }
    ghiJson(F_RA, so, { thut: 1 }); await new Promise((r2) => setTimeout(r2, 2000));
  }
}
/* 23/10 user «Cắt thêm clip camera > đã cắt theo yêu cầu thì gắn cờ đoạn nào là cắt thêm». KIỂM 23/10: hàng chờ cũ gỡ phiếu ngay khi phiếu
   ĐÃ CÓ clip từ trước ⇒ 4 phiếu chọn «Cắt thêm» hôm 22/10 bị gỡ mà không cắt thêm đoạn nào. Nay mỗi yêu cầu (HANG[id].luc) phải ra clip MỚI:
   ① lượt WMS chưa có clip (trần nâng 8 → 16, ở vòng trên); ② chưa ra gì thì cắt GÓC CAMERA KHÁC (kênh đã ra hình ở lưới, chưa dùng), tối đa 2 kênh —
   lượt gần giờ ghi nhận nhất (lanKho phu:1) hoặc mốc chụp/kho (clipThem). Mọi clip cắt theo yêu cầu mang themYC = giờ yêu cầu → dashboard gắn cờ «Cắt thêm».
   Hết đoạn để cắt (không còn lượt/kênh) cũng gỡ, ghi so[id].themXong để bảng nói thật «không còn đoạn nào để cắt thêm». */
if (!THU && Object.keys(HANG).length) {
  for (const id of Object.keys(HANG)) {
  if (!cuaToi(id)) continue;   // 23/10 chia phần
    if (A.id && String(A.id) !== id) continue;
    const v = so[id], yc = HANG[id].luc; if (!v || (mo && !mo.has(id)) || THEM[id]) continue;
    const kj = doc(path.join(DIR, ".exports", "kenh-luc-chup", id + ".json"), {});
    const kenhRa = (kj.kenh || []).filter((y) => raHinh(id, y));
    const lan0 = (v.lanKho || []).filter((z) => !z.phu && z.chieu !== "soan" && z.clip).sort((a, b) => String(b.at).localeCompare(String(a.at)))[0];   // lượt gần giờ ghi nhận nhất
    const daDung = new Set([lan0 ? lan0.kenh : v.clipKenh].concat(lan0 ? (v.lanKho || []).filter((z) => z.phu && z.at === lan0.at).map((z) => z.kenh) : (v.clipThem || []).map((z) => z.kenh)));
    for (const y of kenhRa) {
      if ((THEM[id] || 0) >= 2) break;
      const [host, ch] = y.split("/"); if (daDung.has("kênh " + ch)) continue;
      const laRa = lan0 && lan0.chieu === "ra", moc = lan0 ? Date.parse(String(lan0.at).replace(" ", "T") + "+07:00") : Date.parse(String(v.luc).replace(" ", "T") + "+07:00");
      const luiS = (lan0 ? (laRa ? 60 : 20) : (v.loai === "chup" ? 80 : 20)) + TRUOC_THEM, iso = new Date(moc - luiS * 1e3 + 7 * 36e5).toISOString().slice(0, 19);
      const ten = lan0 ? `${id}_${laRa ? "RA" : "LAN"}-${String(lan0.at).replace(/[^0-9]/g, "").slice(4, 14)}_THEM_ch${ch}.mp4` : `${id}_${v.loai === "chup" ? "CHUP" : "KHO"}-${String(v.luc).replace(/[^0-9]/g, "").slice(4, 12)}_THEM_ch${ch}.mp4`, ra = path.join(GOC_BC, ten);
      try { execFileSync(process.execPath, ["_cat-doan.mjs", host, ch, iso, String(90 + TRUOC_THEM), ra], { stdio: "ignore", windowsHide: true, timeout: 240000 }); } catch { /* xét file bên dưới */ }
      if (!(fs.existsSync(ra) && fs.statSync(ra).size > 50e3)) { try { fs.unlinkSync(ra); } catch { /* */ } log(`  ✗ ${id}: cắt thêm kênh ${ch} hỏng`); continue; }
      if (lan0) v.lanKho.push({ at: lan0.at, xong: lan0.xong, email: lan0.email, qty: lan0.qty, loai: lan0.loai, ...(laRa ? { chieu: "ra", toi: lan0.toi || "" } : {}), clip: ten, kenh: "kênh " + ch, phu: 1, themYC: yc, may: DAU, lui: luiS });
      else (v.clipThem ||= []).push({ clip: ten, kenh: "kênh " + ch, themYC: yc, may: DAU, lui: luiS });
      THEM[id] = (THEM[id] || 0) + 1; log(`  ▶ ${id} cắt thêm góc kênh ${ch} → ${ten}`);
      ghiJson(F_RA, so, { thut: 1 }); await new Promise((r2) => setTimeout(r2, 2000));
    }
  }
  /* 23/10: còn lượt SOẠN (6 gần nhất) chưa cắt thì CHƯA gỡ — chạm trần MAX_LAN giữa chừng thì lượt sau cắt tiếp vẫn mang cờ «Cắt thêm» */
  const conSoan = (id) => { const x = kq[id]; if (!x || !so[id]) return false;
    const k = CWMS[x.bin + "|" + x.ngay] ? x.bin + "|" + x.ngay : Object.keys(CWMS).find((k0) => { const [b0, n0] = k0.split("|"); return n0 === x.ngay && b0.endsWith("-" + x.bin); });
    return ((k && SOAN[k]) || { ds: [] }).ds.slice(0, 6).some((r) => !(so[id].lanKho || []).some((e) => e.chieu === "soan" && e.at === r.at && (e.clip || (e.hong || 0) >= 3))); };
  const go = Object.keys(HANG).filter(cuaToi).filter((id) => !A.id || String(A.id) === id).filter((id) => (mo && !mo.has(id)) || THEM[id] || (so[id] && !conSoan(id) && !(so[id].lanKho || []).some((z) => !z.phu && z.chieu !== "soan" && !z.clip && (z.hong || 0) < 3)));
  for (const id of go) if (so[id] && !(mo && !mo.has(id))) so[id].themXong = { yc: HANG[id].luc, luc: new Date().toISOString(), n: THEM[id] || 0 };
  if (go.length) { ghiJson(F_RA, so, { thut: 1 }); const h = doc(F_HANG, {}); go.forEach((id) => delete h[id]); ghiJson(F_HANG, h, { thut: 1 }); log(`hàng chờ cắt clip: xong ${go.map((id) => id + " (" + (THEM[id] || 0) + " clip thêm)").join(", ")}`); }
}
await TD?.xong();
