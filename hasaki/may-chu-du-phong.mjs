/**
 * MÁY CHỦ XÁC MINH DỰ PHÒNG trên PC (19/10 user: «laptop tắt thì điện thoại phải xem được Theo tác vụ / Theo máy / Nhật ký»).
 *
 *  Việc «may-chu-xm-du-phong» của bộ điều phối (ghim QLIT, dự phòng FOQ5T89), task 5' một lần. Mỗi lượt:
 *   1) có bin/cloudflared.exe chưa → tải bản chính thức từ GitHub cloudflare/cloudflared (1 lần).
 *   2) máy chủ 8591 chưa chạy → bật bang-591.mjs ở chế độ DỰ PHÒNG (XM_DU_PHONG=1: CHỈ CHO XEM, lệnh ghi trả 503 — quyết định
 *      chỉ ghi ở laptop ⇒ không trùng, không mất).
 *   3) đường hầm chưa chạy → bật duong-ham-591.mjs (XM_DU_PHONG=1): địa chỉ không ghi GitHub (đó là chỗ của laptop) mà ghi
 *      .duong-ham-591.url → nhip-pc.mjs gửi kèm nhịp tim (xmHam) → trang (hxDoMayChu) hỏi Apps Script pcBangPh khi laptop không trả lời.
 *   4) mỗi 15' kéo dữ liệu Xác minh từ kho Drive (dong-bo-xm keo vao,chung,ra — chỉ kéo, không đẩy, không xoá kho).
 *  Laptop KHÔNG chạy tệp này (thoát ngay khi không phải RUNNER_VAI=pc). Log: may-chu-du-phong.log
 */
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import "dotenv/config";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const LOG = path.join(DIR, "may-chu-du-phong.log");
const log = (...a) => { const d = new Date().toLocaleString("vi-VN", { hour12: false }) + " " + a.join(" "); console.log(d); try { fs.appendFileSync(LOG, d + "\n"); } catch { /* */ } };
if (String(process.env.RUNNER_VAI || "").toLowerCase() !== "pc" && !process.argv.includes("--thu")) { log("không phải PC — bỏ qua (laptop có máy chủ chính)"); process.exit(0); }

const EXE = path.join(DIR, "bin", "cloudflared.exe");
const PORT = Number(process.env.BANG591_PORT || 8591);
const KEO_F = path.join(DIR, ".du-phong-keo");
const ENV = { ...process.env, XM_DU_PHONG: "1" };

function nen(tep, logTen) {   // tiến trình chạy nền, sống tiếp sau khi lượt này thoát
  const fd = fs.openSync(path.join(DIR, logTen), "a");
  const c = spawn(process.execPath, [tep], { cwd: DIR, env: ENV, detached: true, windowsHide: true, stdio: ["ignore", fd, fd] });
  c.unref(); log("bật", tep, "pid", c.pid);
}
const song = (pidF) => { try { const p = Number(fs.readFileSync(path.join(DIR, pidF), "utf8")); process.kill(p, 0); return true; } catch { return false; } };

// 1) cloudflared
if (!fs.existsSync(EXE)) {
  try {
    log("tải cloudflared…");
    const r = await fetch("https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe", { signal: AbortSignal.timeout(180000) });
    if (!r.ok) throw new Error("HTTP " + r.status);
    fs.mkdirSync(path.dirname(EXE), { recursive: true });
    fs.writeFileSync(EXE + ".tam", Buffer.from(await r.arrayBuffer())); fs.renameSync(EXE + ".tam", EXE);
    log("✓ đã tải cloudflared", Math.round(fs.statSync(EXE).size / 1e6) + " MB");
  } catch (e) { log("✗ không tải được cloudflared:", e.message); }
}

// 2) máy chủ 8591 (bản dự phòng)
const ping = await fetch(`http://127.0.0.1:${PORT}/api/ping`, { signal: AbortSignal.timeout(3000) }).then((r) => r.ok ? r.json() : null, () => null);
if (!ping) nen("bang-591.mjs", "du-phong-591.out");
else if (!ping.duPhong) log("8591 đang chạy bản KHÔNG dự phòng — để nguyên");

// 3) đường hầm
if (fs.existsSync(EXE) && !song(".duong-ham-591.pid")) nen("duong-ham-591.mjs", "du-phong-ham.out");

// 4) dữ liệu (15' một lần)
let keoLuc = 0; try { keoLuc = Number(fs.readFileSync(KEO_F, "utf8")) || 0; } catch { /* lần đầu */ }
if (Date.now() - keoLuc >= 15 * 60e3) {
  fs.writeFileSync(KEO_F, String(Date.now()));
  const k = spawnSync(process.execPath, ["dong-bo-xm.mjs", "keo", "--nhom=vao,chung,ra"], { cwd: DIR, env: process.env, windowsHide: true, timeout: 12 * 60e3, encoding: "utf8" });
  log("kéo dữ liệu Xác minh: mã", k.status, String(k.stdout || "").trim().split(/\r?\n/).slice(-1)[0] || "");
}
