/* 10/10/2026 — XÁC MINH CAMERA HẰNG TỐI (user: «chạy đi, liên tục cải tiến đến khi đạt mục đích»).
 *  Chọn tối đa N phiếu B1 treo mà canh-b1 cần camera (TB-01/TB-02/TB-03/A1-01: cho-camera hoặc nghi-ngo, vị trí là mã ô F0-…)
 *  → chạy xac-minh-tu-dong.mjs (Gemini API trước → agy Gemini → agy Claude) → kết quả lên bảng nội bộ «Việc 5S».
 *  KHÔNG ghi phiếu, KHÔNG ghi xac-nhan-camera.json (luật TB-* đang «Chỉ ghi sheet để tôi quyết» — user quyết).
 *  Ưu tiên: cho-camera (1 ứng viên WMS, chỉ thiếu camera) → nghi-ngo ít ứng viên → phiếu mới. Bỏ phiếu đã có BAO-CAO.md sau lần canh-b1 gần nhất.
 *  node xac-minh-dem.mjs [--max=5] [--thu]   (--thu = chỉ in danh sách chọn) */
import fs from "node:fs"; import path from "node:path"; import { spawn } from "node:child_process"; import { fileURLToPath } from "node:url";
import { mayDuocChay } from "./session-rules.js";
import { ghiJson } from "./so-ghi.mjs";   // 20/10 ghi sổ JSON an toàn (ghi tạm → đổi tên) + nhật ký ai ghi
const DIR = path.dirname(fileURLToPath(import.meta.url)); process.chdir(DIR);
const A = Object.fromEntries(process.argv.slice(2).filter((x) => x.startsWith("--")).map((x) => { const [k, v] = x.slice(2).split("="); return [k, v ?? "1"]; }));
const MAX = Number(A.max || process.env.XM_MAX || 5);
/* 19/10 user «phiếu nghi ngờ cần chuẩn bị dữ liệu clip/camera để quyết — việc nặng, chia việc để không quá tải máy»: chia phiếu theo
   --phan=i/n (hoặc env XM_PHAN do chay-xm đặt từ dieu-phoi.json) — mỗi máy chỉ soi phiếu có task_id % n == i−1, 2 máy chạy song song
   không trùng phiếu. Không có --phan = soi mọi phiếu (như cũ). */
const [PHAN_I, PHAN_N] = String(A.phan || process.env.XM_PHAN || "1/1").split("/").map(Number);
const dungPhan = (id) => !(PHAN_N > 1) || Number(BigInt(id) % BigInt(PHAN_N)) === PHAN_I - 1;
const TEN_VIEC = process.env.XM_TEN || "xac-minh-camera";
const log = (...a) => console.log(new Date().toTimeString().slice(0, 8), ...a);
const docJ = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };
if (!A.thu && !mayDuocChay(log)) process.exit(0);
const KHOA = path.join(DIR, ".exports", ".xac-minh-dem.lock");
/* 19/10: 2 phần phiếu rơi vào CÙNG 1 máy (máy kia tắt) → phần sau CHỜ phần trước xong (tối đa 60', hỏi lại mỗi 30 s) — không chạy chồng
   cho đỡ quá tải máy, cũng không bỏ lượt mãi (2 phần cùng giờ lịch thì phần thua luôn bị bỏ). Khoá của tiến trình đã chết = khoá rác → lấy. */
const khoaSong = () => { try { const st = fs.statSync(KHOA); if (Date.now() - st.mtimeMs >= 4 * 36e5) return false;
  const pid = Number(fs.readFileSync(KHOA, "utf8")); if (!pid) return true; try { process.kill(pid, 0); return true; } catch (e) { return e.code === "EPERM"; } } catch { return false; } };
if (!A.thu) {
  const t0 = Date.now(); let bao = false;
  while (khoaSong()) {
    if (Date.now() - t0 > 60 * 60e3) { log("⏸ lượt khác vẫn chạy sau 60' chờ — bỏ lượt"); process.exit(0); }
    if (!bao) { log("⏸ đang có lượt khác chạy trên máy này — chờ tới lượt (tối đa 60')"); bao = true; }
    await new Promise((r) => setTimeout(r, 30e3));
  }
  fs.writeFileSync(KHOA, String(process.pid));
}

const KQ = docJ(path.join(DIR, ".exports", "canh-b1-ketqua.json"), {});

const RA = path.join(DIR, ".exports", "xm-tu-dong");
const daLam = (id) => { try { return fs.statSync(path.join(RA, id, "BAO-CAO.md")).mtimeMs; } catch { return 0; } };
/* 19/10: MỌI phiếu nghi ngờ / chờ camera có mã ô (trước chỉ TB-01/02/03, A1-01) — SH-01, CAM-04, KHAC… cũng cần clip/khung người để bạn
   quyết. Bỏ luật không có gì để soi: ảnh trùng / phiếu trùng / vệ sinh (canh-b11 lo). Phiếu đã đóng B1 (theo 8591 nếu trả lời) thì thôi. */
const BO_LUAT = new Set(["DL-02", "DL-03", "CH-05", "CH-06", "VS"]);
let moB1 = null;
try { const j = await (await fetch("http://127.0.0.1:8591/api/du-lieu", { signal: AbortSignal.timeout(15000) })).json(); moB1 = new Set(j.phieu.filter((p) => p.buoc === "B1").map((p) => String(p.id))); }
catch { /* máy trạm không có 8591 → xét mọi phiếu trong canh-b1-ketqua (canh-b1 chỉ giữ phiếu đang treo) */ }
const ds = Object.entries(KQ).filter(([id, v]) => !BO_LUAT.has(v.luat) && ["cho-camera", "nghi-ngo"].includes(v.ketLuan) && /^F0-A\d+-/.test(String(v.bin || ""))
  && dungPhan(id) && (!moB1 || moB1.has(id)) && !daLam(id))   // đã xác minh rồi thì thôi — phiếu chỉ đổi khi user/NV tác động, chạy lại tốn hạn mức
  .map(([id, v]) => ({ id, v, uu: (v.ketLuan === "cho-camera" ? 0 : 1) * 100 + Math.min(99, (v.nv || []).length || 50) }))
  .sort((a, b) => a.uu - b.uu || b.id.localeCompare(a.id)).slice(0, MAX);
log(`${ds.length} phiếu chọn (tối đa ${MAX}${PHAN_N > 1 ? ` · phần ${PHAN_I}/${PHAN_N}` : ""}): ` + ds.map((x) => `${x.id} ${x.v.luat}·${x.v.ketLuan}`).join(" | "));
if (A.thu) process.exit(0);
/* 14/10 «chạy ra sao, của task nào» → tab Máy trạm: spawn KHÔNG chặn (spawnSync chặn cả nhịp «còn sống» của tien-do), theo dõi
   BAO-CAO.md từng phiếu mỗi 20 s → báo đang soi phiếu nào, xong mấy/tổng. Tràn 3,5 giờ thì dừng như cũ. */
const TD = await import("./tien-do.mjs"), bdXM = Date.now();
if (ds.length) TD.batDau(TEN_VIEC, "Soi camera phiếu B1");
const baoXM = () => { const tiep = ds.find((x) => !(daLam(x.id) > bdXM)), nXong = ds.filter((x) => daLam(x.id) > bdXM).length;
  TD.tienDo({ buoc: "Soi camera phiếu B1", task: tiep ? tiep.id : "", i: nXong + (tiep ? 1 : 0), n: ds.length, chiTiet: tiep ? tiep.v.luat + " · " + tiep.v.bin : "đang tổng hợp" }); };
const r = !ds.length ? { status: "-" } : await new Promise((res) => {
  baoXM();
  const c = spawn(process.execPath, ["xac-minh-tu-dong.mjs", ...ds.map((x) => x.id)], { cwd: DIR, stdio: "inherit" });
  const het = setTimeout(() => c.kill(), 3.5 * 36e5), theo = setInterval(baoXM, 20000);
  c.on("close", (code) => { clearTimeout(het); clearInterval(theo); res({ status: code }); });
  c.on("error", (e) => { clearTimeout(het); clearInterval(theo); res({ status: "lỗi " + e.message }); });
});
log("xong · mã thoát " + r.status);
/* 10/10 nối luật 05/10 (user: «tra camera đúng giờ châm … đúng thì chuyển B1.1 ngay»): báo cáo «ĐỘ CHẮC: chắc» (camera thấy người đặt + lệnh WMS khớp ≤3′)
   VÀ người đó nằm trong ứng viên WMS của canh-b1 → ghi .exports/xac-nhan-camera.json (đánh dấu may:true). canh-b1 lượt sau ra «B1.1 · CAO»;
   có tự chuyển hay chỉ ghi sheet vẫn theo cột «Bạn duyệt» của luật (TB-01/TB-02 hiện «Chỉ ghi sheet»). */
const FXN = path.join(DIR, ".exports", "xac-nhan-camera.json"), XN = docJ(FXN, {}); let them = 0;
for (const id of fs.readdirSync(RA).filter((d) => /^\d+$/.test(d))) { const v = KQ[id]; if (!v) continue;   // mọi báo cáo, không chỉ lượt này
  let t = ""; try { t = fs.readFileSync(path.join(RA, id, "BAO-CAO.md"), "utf8"); } catch { continue; }
  const ma = (/NGƯỜI: .*?\((\d{5,6})\)/.exec(t) || [])[1], chac = /ĐỘ CHẮC: chắc/.test(t), ungVien = (v.ungVienWms || v.nv || []).map((n) => String(n.code));
  if (!ma || !chac) continue;
  if (!ungVien.includes(ma)) { log(`  ${id}: camera+WMS ra ${ma} nhưng không nằm trong ứng viên canh-b1 (${ungVien.join(",") || "trống"}) — để người quyết`); continue; }
  if (XN[id]) continue;
  XN[id] = { nv: [ma], luc: new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10), ghiChu: "máy xac-minh-tu-dong: " + ((/HỆ THỐNG: (.*)/.exec(t) || [])[1] || "").slice(0, 120), may: true }; them++;
  log(`  ${id}: ✓ ghi xác nhận camera (máy) → ${ma}`);
}
if (them) ghiJson(FXN, XN, { thut: 1 });
fs.rmSync(KHOA, { force: true });
await TD.xong();
