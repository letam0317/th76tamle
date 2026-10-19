// chay-xm.mjs — BỘ CHẠY VIỆC sau cổng gác (PC: _DP-CHAY.vbs · laptop: _LAPTOP-NHUONG.vbs), 14/10/2026.
//   node chay-xm.mjs <tenViec> <vbsThat>
// Việc thường: chạy <vbsThat> rồi thoát khi vbs thoát (y như trước).
// Việc «dongBoXm» (4 cò xác minh — cần .exports/* chung giữa các máy):
//   1) KHOÁ CHUNG xm_khoa (chỉ 1 máy chạy cò xác minh 1 lúc) — máy khác đang giữ → BỎ LƯỢT (lịch sau chạy)
//   2) KÉO «vao» + «chung» mới nhất từ kho Drive
//   3) chạy <vbsThat> và CHỜ CẢ CÂY TIẾN TRÌNH xong (vài vbs bật cò rồi thoát ngay) — giữ khoá gia hạn mỗi 10'
//   4) ĐẨY «chung» đã đổi; máy trạm đẩy thêm «ra» (tệp kết quả MỚI TẠO trong lượt: báo cáo, ảnh/clip bằng chứng)
//   5) NHẢ khoá (kể cả khi lỗi). Kho lỗi ở bước 1/2 → KHÔNG chạy (thiếu dữ liệu mà chạy = soát sai / ghi trùng).
import fs from "node:fs";
import path from "node:path";
import { spawn, execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const [tenViec, vbsThat] = process.argv.slice(2);
if (!tenViec || !vbsThat) { console.error("node chay-xm.mjs <tenViec> <vbsThat>"); process.exit(2); }
const cfg = JSON.parse(fs.readFileSync(process.env.CHAY_XM_CFG || path.join(DIR, "cai-pc", "dieu-phoi.json"), "utf8"));   // CHAY_XM_CFG: QC dùng cấu hình thử
const viec = (cfg.viec || []).find((v) => v.ten === tenViec) || {};
const vbs = path.join(DIR, vbsThat);

function chayVbs() {   // → { pid, xong: Promise<code> }
  const c = spawn("wscript.exe", ["//nologo", vbs], { cwd: DIR, windowsHide: true, stdio: "ignore" });
  return { pid: c.pid, xong: new Promise((r) => { c.on("exit", (code) => r(code)); c.on("error", () => r(-1)); }) };
}

// 14/10: PC cài bằng bộ cài không có mô hình dò người (.cache-model, ngoài git) → bãi xe / camera hỏng ở bước dò người. Thiếu thì tải (có rồi: 0 lượt mạng).
try { await (await import("./dam-bao-mo-hinh.mjs")).damBaoMoHinh(); } catch (e) { console.error("mô hình dò người: " + e.message); }

if (!viec.dongBoXm) { const c = chayVbs(); process.exit(await c.xong); }

// ---- việc xác minh: khoá · kéo · chạy · đẩy · nhả ----
const X = await import("./dong-bo-xm.mjs");
const nk = (s) => X.log(`[${tenViec}] ${s}`);
const ttl = Math.max(3600, Number(viec.giuTTL) || 3600) + 1800;

/* 19/10 user «tập trung máy trạm chia việc xác minh B1»: 2 máy B1 tranh khoá → máy đến sau BỎ CẢ LƯỢT (canh-b11 trễ 1 giờ vì máy kia
   đang tìm bằng chứng). Nay XẾP HÀNG: hỏi lại mỗi 30 s, tối đa XM_CHO_PHUT (15') rồi mới bỏ lượt. GAS hỏng vẫn bỏ lượt ngay. */
const CHO_MS = (Number(process.env.XM_CHO_PHUT) || 15) * 60e3, tCho = Date.now();
let k, baoCho = false;
for (;;) {
  try { k = await X.khoa(tenViec, ttl); } catch (e) { nk("không giữ được khoá chung (" + e.message + ") — bỏ lượt"); process.exit(0); }
  if (k.kq === "giu") break;
  if (Date.now() - tCho >= CHO_MS) { nk(`${k.may} vẫn chạy «${k.viec}» sau ${Math.round(CHO_MS / 60e3)}' chờ — bỏ lượt (lịch sau chạy)`); process.exit(0); }
  if (!baoCho) { nk(`${k.may} đang chạy «${k.viec}» — xếp hàng chờ tối đa ${Math.round(CHO_MS / 60e3)}'`); baoCho = true; }
  await new Promise((r) => setTimeout(r, 30e3));
}
if (baoCho) nk(`tới lượt sau ${Math.round((Date.now() - tCho) / 60e3)}' chờ`);

let ma = 0;
try {
  try { await X.keo(["vao", "chung"]); }
  catch (e) { nk("kéo dữ liệu lỗi (" + e.message + ") — KHÔNG chạy (thiếu dữ liệu)"); throw e; }
  const t0 = Date.now(); nk("bắt đầu chạy");
  const c = chayVbs();
  const giaHan = setInterval(() => { X.khoa(tenViec, ttl).catch(() => {}); }, 10 * 60e3);
  await c.xong;
  await choCayXong(c.pid, t0);
  clearInterval(giaHan);
  nk(`xong sau ${Math.round((Date.now() - t0) / 60000)} phút — đẩy dữ liệu`);
  await X.day(["chung"]);
  if (String(process.env.RUNNER_VAI || "").toLowerCase() === "pc") await X.day(["ra"], { tu: t0 - 5000 });
} catch (e) { ma = 1; nk("LỖI: " + e.message); }
finally { try { await X.tra(tenViec); } catch { /* hết hạn tự nhả */ } }
process.exit(ma);

// Chờ mọi tiến trình con/cháu của vbs (tạo SAU t0) thoát. Giữ PID đã thấy (cha chết vẫn còn ParentProcessId).
async function dsTienTrinh() {
  const ps = "Get-CimInstance Win32_Process | ForEach-Object { '' + $_.ProcessId + ',' + $_.ParentProcessId + ',' + $_.CreationDate.ToUniversalTime().ToString('o') }";
  const out = await new Promise((r) => execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ps], { windowsHide: true, timeout: 30000, maxBuffer: 8 << 20 }, (e, so) => r(e ? null : String(so))));
  if (out == null) return null;
  const m = new Map();
  for (const d of out.split(/\r?\n/)) { const [a, b, t] = d.split(","); if (a) m.set(+a, { ppid: +b, t: Date.parse(t) || 0 }); }
  return m;
}
async function choCayXong(goc, t0) {
  const cay = new Set([goc]), het = Date.now() + 5 * 3600e3;
  while (Date.now() < het) {
    const pt = await dsTienTrinh();
    if (pt) {
      let them = true; while (them) { them = false; for (const [pid, p] of pt) if (!cay.has(pid) && cay.has(p.ppid) && p.t >= t0 - 5000) { cay.add(pid); them = true; } }
      if (![...cay].some((pid) => pt.has(pid) && pt.get(pid).t >= t0 - 5000)) return;
    }
    await new Promise((r) => setTimeout(r, 15000));
  }
  nk("quá 5 giờ vẫn chưa xong — thôi chờ");
}
