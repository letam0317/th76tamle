// doi-khoa.mjs — ĐỔI KHOÁ / MẬT KHẨU KHÔNG CÀI LẠI MÁY TRẠM · 20/10/2026
// Đánh giá an ninh 20/10: gói khoá (APPSCRIPT_KEY, TOPREVIEW_USER/PASS, GEMINI_API_KEY) từng lấy được không cần phiên → phải đổi được nhanh.
// Đường đi: laptop .env là NGUỒN → 8591 khởi động đẩy gói (pcDatGoi) → GAS trả goiBam ở mỗi nhịp tim → máy trạm thấy băm khác → pcLayGoi → ghi .env.
// Riêng APPSCRIPT_KEY: GAS giữ thêm SECRET_CU (khoá cũ) trong thời gian chuyển; máy còn gọi bằng khoá cũ được trả khoaMoi ngay ở nhịp tim.
//
//   node doi-khoa.mjs appscript            đổi APPSCRIPT_KEY: sinh khoá mới, .env (KEY mới + KEY_CU = khoá cũ), deploy GAS, khởi động lại 8591
//   node doi-khoa.mjs day                  (sau khi bạn tự sửa TOPREVIEW_PASS / GEMINI_API_KEY trong .env) khởi động lại 8591 để đẩy gói mới
//   node doi-khoa.mjs xem                  máy nào đã nhận gói mới (goiBam từng máy so với gói laptop)
//   node doi-khoa.mjs xong                 khi mọi máy đã nhận: xoá APPSCRIPT_KEY_CU khỏi .env + deploy GAS (khoá cũ hết hiệu lực)
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import "dotenv/config";

const DIR = path.dirname(fileURLToPath(import.meta.url)), ENV_F = path.join(DIR, ".env");
const LENH = process.argv[2] || "xem";
const log = (...a) => console.log(new Date().toTimeString().slice(0, 8), ...a);
function ghiEnv(cap) {   // cùng khuôn nhip-pc.ghiEnv: thay/thêm dòng, giữ dòng khác; giá trị null = xoá dòng
  let dong = fs.readFileSync(ENV_F, "utf8").split(/\r?\n/);
  for (const [k, v] of Object.entries(cap)) { const i = dong.findIndex((l) => l.replace(/^\s*/, "").startsWith(k + "=")); if (v == null) { if (i >= 0) dong.splice(i, 1); continue; } if (i >= 0) dong[i] = k + "=" + v; else dong.push(k + "=" + v); process.env[k] = v; }
  const tam = ENV_F + ".tam"; fs.writeFileSync(tam, dong.join("\r\n").replace(/(\r\n)+$/, "") + "\r\n"); fs.renameSync(tam, ENV_F);
}
function deployGas() { const r = spawnSync(process.execPath, [path.join(DIR, "deploy-gas.mjs"), "--deploy"], { cwd: DIR, encoding: "utf8", timeout: 400e3 }); const ra = (r.stdout || "") + (r.stderr || ""); if (r.status) throw new Error("deploy GAS lỗi: " + ra.slice(-300)); log("GAS: " + (ra.match(/Deployed [^\n]*/) || [""])[0]); }
function khoiDongLai8591() {   // 8591 đọc .env lúc khởi động và đẩy gói khoá (dayGoiGas) → gói mới lên GAS
  try { execSync(`powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='node.exe'\\" | Where-Object { $_.CommandLine -match 'bang-591' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }; Start-ScheduledTask -TaskName '5S Bang xac minh (8591)'"`, { stdio: "ignore", timeout: 60e3 }); } catch (e) { log("khởi động lại 8591: " + e.message); }
  const t0 = Date.now(); return new Promise((r) => { const th = async () => { try { const x = await fetch("http://127.0.0.1:8591/api/ping", { signal: AbortSignal.timeout(3000) }); if (x.ok) return r(true); } catch { /* */ } if (Date.now() - t0 > 60e3) return r(false); setTimeout(th, 2000); }; setTimeout(th, 3000); });
}
async function xem() {
  const { gasPost } = await import("./session-rules.js");
  const g = await gasPost({ action: "pcLayGoi", key: process.env.APPSCRIPT_KEY }, () => {}, "pcLayGoi");
  const bamGoi = g && g.goiBam ? g.goiBam : "?";
  const j = await gasPost({ action: "pcBang", key: process.env.APPSCRIPT_KEY }, () => {}, "pcBang");
  console.log("gói trên GAS: băm " + bamGoi + (g && g.luc ? " · đẩy lúc " + g.luc : ""));
  let du = 0; for (const h of (j.bang || j.may || [])) { const ok = h.goiBam && h.goiBam === bamGoi; if (ok) du++; console.log("  " + h.may.padEnd(26) + " bản " + (h.ban || "?") + " · gói " + (h.goiBam || "(chưa báo)") + (ok ? " ✓ đã nhận" : " … chưa")); }
  return { du, tong: (j.bang || j.may || []).length };
}

if (LENH === "appscript") {
  const cu = process.env.APPSCRIPT_KEY; if (!cu) throw new Error("thiếu APPSCRIPT_KEY trong .env");
  const moi = "hsk5s-" + new Date().toISOString().slice(0, 10) + "-" + crypto.randomBytes(12).toString("hex");
  ghiEnv({ APPSCRIPT_KEY: moi, APPSCRIPT_KEY_CU: cu }); log("đã ghi .env: APPSCRIPT_KEY mới, APPSCRIPT_KEY_CU = khoá cũ (còn hiệu lực tới khi chạy «xong»)");
  deployGas(); log("8591 khởi động lại: " + (await khoiDongLai8591() ? "OK" : "chưa trả lời — kiểm tay")); log("Theo dõi: node doi-khoa.mjs xem · khi đủ máy: node doi-khoa.mjs xong");
} else if (LENH === "day") {
  log("8591 khởi động lại: " + (await khoiDongLai8591() ? "OK (gói mới đã đẩy lên GAS)" : "chưa trả lời — kiểm tay")); await xem();
} else if (LENH === "xong") {
  if (!process.env.APPSCRIPT_KEY_CU) { log("không có APPSCRIPT_KEY_CU — không có gì để kết thúc"); } else { const r = await xem(); if (r.du < r.tong && !process.argv.includes("--ep")) { log(`mới ${r.du}/${r.tong} máy nhận gói — chưa tắt khoá cũ (thêm --ep để ép)`); process.exit(1); } ghiEnv({ APPSCRIPT_KEY_CU: null }); deployGas(); log("đã tắt khoá cũ"); }
} else await xem();
