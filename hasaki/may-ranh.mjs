// may-ranh.mjs — người dùng có đang dùng máy không? (luật 15/10 «không chạy lệnh lớn khi người dùng đang dùng») · 21/10/2026
// Đêm 20→21/10 laptop tắt lúc 02:00 nên QC đêm + sao lưu chạy bù lúc 08:44 khi user đang làm. Việc nặng (bộ đo puppeteer) gọi
// choMayRanh() trước khi chạy: trong giờ làm (06:00–23:00) chờ tới khi máy KHÔNG có phím/chuột ≥ 10 phút (hỏi 60 s/lần, chờ tối đa 3 giờ).
//   import { giayRanh, choMayRanh } from "./may-ranh.mjs";
//   node may-ranh.mjs            → in số giây rảnh
import { execFileSync } from "node:child_process";

const PS = `Add-Type @"
using System; using System.Runtime.InteropServices;
public class NhapLieu { [StructLayout(LayoutKind.Sequential)] public struct LII { public uint cbSize; public uint dwTime; }
 [DllImport("user32.dll")] public static extern bool GetLastInputInfo(ref LII plii);
 public static uint Giay() { LII l = new LII(); l.cbSize = (uint)Marshal.SizeOf(l); if (!GetLastInputInfo(ref l)) return 0; return ((uint)Environment.TickCount - l.dwTime) / 1000; } }
"@; [NhapLieu]::Giay()`;

/** số giây từ lần gõ phím/chuột cuối; −1 nếu không đo được (chạy dưới SYSTEM/phiên khác) */
export function giayRanh() {
  try { const r = execFileSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", PS], { encoding: "utf8", timeout: 20000, windowsHide: true }).trim(); const n = Number(r.split(/\r?\n/).pop()); return Number.isFinite(n) ? n : -1; }
  catch { return -1; }
}
/** chờ tới khi máy rảnh ≥ phutRanh phút (chỉ trong khung giờ làm); trả về true nếu rảnh, false nếu hết thời gian chờ */
export async function choMayRanh({ phutRanh = 10, toiDaPhut = 180, log = () => {} } = {}) {
  const gio = new Date().getHours(); if (gio < 6 || gio >= 23) return true;   // đêm: chạy luôn
  const t0 = Date.now(); let daBao = false;
  while (Date.now() - t0 < toiDaPhut * 60e3) {
    const g = giayRanh(); if (g < 0 || g >= phutRanh * 60) return true;
    if (!daBao) { log(`người dùng đang dùng máy (rảnh ${g} s) — chờ rảnh ≥ ${phutRanh} phút, tối đa ${toiDaPhut} phút`); daBao = true; }
    await new Promise((r) => setTimeout(r, 60e3));
  }
  log("hết thời gian chờ máy rảnh"); return false;
}
if (process.argv[1] && /may-ranh\.mjs$/.test(process.argv[1])) console.log("rảnh " + giayRanh() + " giây");
