/**
 * dung-clip-agent.mjs — AGENT DỰNG CLIP chạy ngầm trên Desktop-JE75K38 (máy in tem) · 05/10/2026
 * ============================================================================================
 *  User 05/10: "cách 2 đi, vì đang k ở cạnh pc" — laptop đang ở mạng khách (Guest Hasaki), không vào được
 *  mạng nội bộ ⇒ máy in tự NHẬN VIỆC qua Internet giống agent in tem:
 *    laptop ──dc_them──► Apps Script (hàng đợi) ◄──dc_lay── agent này ──► top-review (tải đoạn camera)
 *    → _clip-noi.mjs dựng clip (Edge headless) → dc_xong (gửi file) → laptop dc_tai rồi XOÁ khỏi Drive.
 *  Luật user 02/10 cho máy công cộng: chạy NGẦM (task SYSTEM, không cửa sổ), ĐƯỢC chạy cả giờ làm khi có người,
 *  ưu tiên CPU THẤP, RAM trống < 3 GB thì chờ (BarTender/in tem không bị chậm), 1 việc/lần.
 *  Mỗi lượt hỏi việc gửi kèm cấu hình máy (CPU, RAM, thời gian dựng lần trước) ⇒ đo được CPU mới từ xa.
 *
 *  node dung-clip-agent.mjs            # chạy mãi (task SYSTEM bật lúc khởi động + mỗi 5' nếu chết)
 *  node dung-clip-agent.mjs --mot      # lấy 1 việc rồi thoát (thử)
 *  .env cần: APPSCRIPT_URL, APPSCRIPT_KEY, TOPREVIEW_USER, TOPREVIEW_PASS (EDGE_PATH nếu Edge ở chỗ lạ)
 */
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import { spawn } from "node:child_process"; import { fileURLToPath } from "node:url";
import "dotenv/config";

const DIR = path.dirname(fileURLToPath(import.meta.url)); process.chdir(DIR);
const GAS = process.env.APPSCRIPT_URL, KEY = process.env.APPSCRIPT_KEY, TR = "https://hasaki.top-review.io/api/v1";
const VIEC = path.join(DIR, ".dung-clip-viec"); fs.mkdirSync(VIEC, { recursive: true });
const F_LOG = path.join(DIR, "dung-clip-agent.log"), F_KHOA = path.join(DIR, ".dung-clip-agent.lock"), TOKF = path.join(DIR, ".tr-token.json");
const MOT = process.argv.includes("--mot"), NHIP = 30e3, RAM_TOI_THIEU = 3 * 1024 ** 3;
const log = (...a) => { const s = new Date(Date.now() + 7 * 36e5).toISOString().replace("T", " ").slice(0, 19) + " " + a.join(" "); console.log(s); try { fs.appendFileSync(F_LOG, s + "\n"); } catch { /* */ } };
const nghi = (ms) => new Promise((r) => setTimeout(r, ms));
if (!GAS || !KEY) { log("✗ thiếu APPSCRIPT_URL/APPSCRIPT_KEY trong .env"); process.exit(2); }

// 1 tiến trình duy nhất (task 5' bật lại khi chết — không được chạy chồng)
try { const cu = JSON.parse(fs.readFileSync(F_KHOA, "utf8")); try { process.kill(cu.pid, 0); if (!MOT) { log("đã có agent chạy (pid " + cu.pid + ") — thoát"); process.exit(0); } } catch { /* pid chết */ } } catch { /* chưa có */ }
if (!MOT) fs.writeFileSync(F_KHOA, JSON.stringify({ pid: process.pid, luc: Date.now() }));
try { os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL); } catch { /* */ }

async function gas(body) {
  for (let i = 0; i < 3; i++) {
    try { const r = await fetch(GAS, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ ...body, key: KEY }), redirect: "follow", signal: AbortSignal.timeout(300000) });
      const t = (await r.text()).trim(); if (t.startsWith("{")) return JSON.parse(t); }
    catch { /* thử lại */ }
    await nghi(3000 * (i + 1));
  }
  return null;
}
async function trToken(moi = false) {
  if (!moi) try { const c = JSON.parse(fs.readFileSync(TOKF, "utf8")); if (c.token && (!c.exp || c.exp - Date.now() > 120000)) return c.token; } catch { /* */ }
  const r = await fetch(TR + "/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: process.env.TOPREVIEW_USER, password: process.env.TOPREVIEW_PASS }) });
  const j = await r.json(); const token = j?.data?.token || j?.token; if (!token) throw new Error("top-review đăng nhập lỗi " + r.status);
  let exp = 0; try { exp = JSON.parse(Buffer.from(token.split(".")[1], "base64url")).exp * 1000; } catch { /* */ }
  fs.writeFileSync(TOKF, JSON.stringify({ token, exp })); return token;
}
/* tải 1 đoạn camera — lỗi bước cắt là TẠM (đo 05/10: 400 Bad Request ở vài cửa sổ) ⇒ thử lại, lệch điểm đầu ±20 s */
async function taiDoan(n, ra) {
  let tok = await trToken(), tu = Date.parse(n.tu + "+07:00"); const den = tu + Number(n.giay) * 1000;
  for (let k = 0; k < 5; k++) {
    try {
      const c = await (await fetch(`${TR}/pickvideo/cat?host=${n.host}&kenh=${n.kenh}&tu=${tu}&den=${den}`, { headers: { authorization: "Bearer " + tok } })).json();
      if (c?.code === "token_expired" || c?.statusCode === 401) { tok = await trToken(true); continue; }
      if (c?.data?.duong) { const r = await fetch(TR + "/pickvideo/video?f=" + encodeURIComponent(c.data.duong), { headers: { authorization: "Bearer " + tok }, signal: AbortSignal.timeout(240000) });
        if (r.status === 200) { fs.writeFileSync(ra, Buffer.from(await r.arrayBuffer())); return true; } }
    } catch { /* thử lại */ }
    await nghi(6000); if (k === 2) tu -= 20000;
  }
  return false;
}
function cauHinhMay(them) {
  const c = os.cpus();
  return JSON.stringify({ ten: os.hostname(), cpu: c[0] ? c[0].model.trim() : "?", nhan: c.length, ramGB: +(os.totalmem() / 1024 ** 3).toFixed(1),
    ramTrongGB: +(os.freemem() / 1024 ** 3).toFixed(1), os: os.release(), node: process.version, ...them });
}
let lanTruoc = null;
async function lamViec(v) {
  const t0 = Date.now(), thu = path.join(VIEC, v.id.replace(/[^\w-]/g, "")); fs.rmSync(thu, { recursive: true, force: true }); fs.mkdirSync(thu, { recursive: true });
  let nk = [];
  try {
    const C = JSON.parse(v.cfg); const nguon = {};
    for (const [ten, n] of Object.entries(C.nguonCam || {})) {
      const f = path.join(thu, ten + ".mp4"); log(`  tải ${ten}: ${n.host}/${n.kenh} ${n.tu} · ${n.giay}s`);
      if (!(await taiDoan(n, f))) throw new Error(`không tải được đoạn ${ten} (${n.host}/${n.kenh} ${n.tu})`);
      nguon[ten] = { file: f, bd: n.bd }; nk.push(`${ten} ${(fs.statSync(f).size / 1048576).toFixed(1)}MB`);
    }
    const tTai = Date.now() - t0, ra = path.join(thu, path.basename(C.ra || v.id + ".webm"));
    const cfgF = path.join(thu, "cau-hinh.json"); fs.writeFileSync(cfgF, JSON.stringify({ ...C, nguonCam: undefined, nguon, ra }));
    const t1 = Date.now();
    await new Promise((ok, loi) => { const p = spawn(process.execPath, [path.join(DIR, "_clip-noi.mjs"), cfgF], { cwd: DIR, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
      try { os.setPriority(p.pid, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch { /* */ }
      let duoi = ""; p.stdout.on("data", (d) => { duoi = (duoi + d).slice(-600); }); p.stderr.on("data", (d) => { duoi = (duoi + d).slice(-600); });
      const h = setTimeout(() => { p.kill(); loi(new Error("dựng clip quá 60 phút")); }, 3600e3);
      p.on("exit", (c) => { clearTimeout(h); c === 0 && fs.existsSync(ra) ? ok() : loi(new Error("_clip-noi thoát " + c + ": " + duoi.split("\n").filter(Boolean).slice(-2).join(" | "))); }); });
    const tDung = Date.now() - t1, buf = fs.readFileSync(ra);
    if (buf.length > 35 * 1048576) throw new Error("clip " + (buf.length / 1048576).toFixed(1) + " MB > 35 MB — giảm kbps/độ dài");
    lanTruoc = { id: v.id, taiGiay: Math.round(tTai / 1000), dungGiay: Math.round(tDung / 1000), MB: +(buf.length / 1048576).toFixed(1) };
    nk.push(`tải ${lanTruoc.taiGiay}s · dựng ${lanTruoc.dungGiay}s · ${lanTruoc.MB}MB`);
    const kq = await gas({ action: "dc_xong", id: v.id, b64: buf.toString("base64"), ten: path.basename(ra), mime: ra.endsWith(".mp4") ? "video/mp4" : "video/webm", nhatKy: nk.join(" · ") });
    if (!kq || kq.status !== "success") throw new Error("gửi file lỗi: " + JSON.stringify(kq).slice(0, 120));
    log(`✓ ${v.id}: ${nk.join(" · ")}`);
  } catch (e) {
    log(`✗ ${v.id}: ${e.message}`); await gas({ action: "dc_xong", id: v.id, loi: e.message, nhatKy: nk.join(" · ") });
  } finally { fs.rmSync(thu, { recursive: true, force: true }); }   // clip/đoạn có mặt người — không giữ trên máy công cộng
}

log(`agent dựng clip bật · ${os.hostname()} · ${os.cpus()[0]?.model?.trim()} · ${os.cpus().length} nhân · RAM ${(os.totalmem() / 1024 ** 3).toFixed(1)} GB`);
for (;;) {
  const trong = os.freemem();
  const kq = await gas({ action: "dc_lay", may: cauHinhMay({ lanTruoc, choRam: trong < RAM_TOI_THIEU }) , ...(trong < RAM_TOI_THIEU ? { chiBao: 1 } : {}) });
  const v = trong >= RAM_TOI_THIEU && kq && kq.viec;
  if (v) { log(`▶ việc ${v.id}`); await lamViec(v); }
  if (MOT) break;
  await nghi(v ? 2000 : NHIP);
}
try { fs.unlinkSync(F_KHOA); } catch { /* */ }
