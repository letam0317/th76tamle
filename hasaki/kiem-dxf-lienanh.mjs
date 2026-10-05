#!/usr/bin/env node
/**
 * kiem-dxf-lienanh.mjs — KIỂM tệp DXF do lienanh-3d.html xuất bằng AutoCAD THẬT (accoreconsole, chạy nền, không bật giao diện).
 *
 *   node hasaki/kiem-dxf-lienanh.mjs <tep.dxf> [--khong-autocad]
 *
 * Bước 1 (không cần AutoCAD): đọc lại DXF bằng LIENANH_XUAT.docDxf — đủ SECTION, có EOF, không trùng handle, toàn ASCII,
 *         đếm LWPOLYLINE lớp LA-KHU, polyline tường bao đúng 0…108 000 × 0…80 000 mm (sai số 1 mm).
 * Bước 2 (AutoCAD 2022+): chép DXF sang thư mục tạm KHÔNG có dấu cách (script .scr không nhận đường dẫn có dấu cách),
 *         kịch bản: FILEDIA 0 → _.DXFIN → _.AUDIT Y → LISP đếm entity theo lớp → _.SAVEAS 2018 <dwg> → QUIT N.
 *         ĐẠT khi AUDIT "Total errors found 0", số LA-KHU khớp bước 1, tệp .dwg được sinh; .dwg chép về cạnh tệp .dxf.
 * Thoát mã 0 = đạt, 1 = lỗi (để xem-noi-bo.mjs dừng chuỗi Chốt), 2 = sai cách gọi.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import vm from "node:vm";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const tep = argv.find((a) => !a.startsWith("--"));
const khongAutocad = argv.includes("--khong-autocad");
if (!tep || !fs.existsSync(tep)) { console.error("Thiếu / không thấy tệp DXF.\n  node hasaki/kiem-dxf-lienanh.mjs <tep.dxf> [--khong-autocad]"); process.exit(2); }
const ACCORE = ["C:/Program Files/Autodesk/AutoCAD 2022/accoreconsole.exe", "C:/Program Files/Autodesk/AutoCAD 2023/accoreconsole.exe",
  "C:/Program Files/Autodesk/AutoCAD 2024/accoreconsole.exe", "C:/Program Files/Autodesk/AutoCAD 2025/accoreconsole.exe"].find((p) => fs.existsSync(p));

const ok = [], loi = [];
const bao = (d, t, c) => (d ? ok : loi).push(`${d ? "ĐẠT " : "LỖI "} · ${t}${c ? " — " + c : ""}`);

/* ── 1. Đọc lại bằng mô-đun thuần ── */
const w = {}; const ctx = vm.createContext({ window: w, globalThis: w, module: undefined });
vm.runInContext(fs.readFileSync(path.join(DIR, "kiemsoatkho", "lienanh-xuat.js"), "utf8"), ctx, { filename: "lienanh-xuat.js" });
const X = w.LIENANH_XUAT;
const txt = fs.readFileSync(tep, "utf8");
const d = X.docDxf(txt);
const soKhu = (d.theoLop["LA-KHU"] || {}).LWPOLYLINE || 0;
bao(/\r?\n\s*2\r?\nHEADER/.test(txt) && /\r?\n\s*2\r?\nTABLES/.test(txt) && /\r?\n\s*2\r?\nENTITIES/.test(txt) && d.coEOF, "DXF đủ SECTION HEADER/TABLES/ENTITIES + EOF");
bao(d.trung === 0, "không trùng handle", d.trung + " trùng");
bao(!d.nonAscii, "toàn ASCII (chữ Việt đã mã hoá \\U+XXXX)");
bao(soKhu > 0, "có vùng khu vực lớp LA-KHU (polyline vàng)", soKhu + " khu");
bao(((d.theoLop["LA-KHU-CHU"] || {}).TEXT || 0) >= soKhu * 2, "mỗi khu có tên + diện tích m² (lớp LA-KHU-CHU)", ((d.theoLop["LA-KHU-CHU"] || {}).TEXT || 0) + " chữ");
/* tường bao: polyline LA-TUONG đầu tiên = 0…tongX × 0…tongY */
(function () {
  const i = txt.indexOf("LA-TUONG", txt.indexOf("ENTITIES")); if (i < 0) { bao(false, "có tường bao lớp LA-TUONG"); return; }
  const het = txt.indexOf("\n  0\r\n", i); const doan = txt.slice(i, het > 0 ? het : i + 600);     // chỉ entity LA-TUONG đầu tiên (mặt trong tường)
  const xs = [...doan.matchAll(/\r?\n\s*10\r?\n([-\d.]+)/g)].map((m) => +m[1]), ys = [...doan.matchAll(/\r?\n\s*20\r?\n([-\d.]+)/g)].map((m) => +m[1]);
  const W = Math.max(...xs) - Math.min(...xs), H = Math.max(...ys) - Math.min(...ys);
  bao(Math.abs(W - 108000) <= 1 && Math.abs(H - 80000) <= 1, "tường bao đúng 108 000 × 80 000 mm", W + " × " + H);
})();

/* ── 2. AutoCAD thật ── */
async function autocad() {
  if (khongAutocad) { console.log("• Bỏ qua AutoCAD (--khong-autocad)."); return; }
  if (!ACCORE) { bao(false, "có accoreconsole.exe (AutoCAD 2022+)", "không thấy — cài AutoCAD hoặc chạy --khong-autocad"); return; }
  const tam = path.join(os.tmpdir(), "kiem-dxf-lienanh"); fs.mkdirSync(tam, { recursive: true });
  const ten = path.basename(tep).replace(/\.dxf$/i, "").replace(/[^\w.-]/g, "_");
  const dxfTam = path.join(tam, ten + ".dxf"), dwgTam = path.join(tam, ten + ".dwg"), scr = path.join(tam, ten + ".scr"), log = path.join(tam, ten + ".log");
  fs.copyFileSync(tep, dxfTam); [dwgTam, log].forEach((f) => { try { fs.unlinkSync(f); } catch (e) {} });
  const dem = (lop) => `(princ (strcat "\\nDEM-${lop}=" (itoa (if (setq ss (ssget "_X" '((8 . "${lop}")))) (sslength ss) 0))))`;
  fs.writeFileSync(scr, ["FILEDIA", "0", "_.DXFIN", dxfTam.replace(/\\/g, "/"), "_.AUDIT", "Y", dem("LA-KHU"), dem("LA-KHU-CHU"), dem("LA-TUONG"),
    "_.SAVEAS", "2018", dwgTam.replace(/\\/g, "/"), "QUIT", "N", ""].join("\n"), "ascii");
  console.log("• AutoCAD nền: DXFIN → AUDIT → đếm → SAVEAS 2018 (≈ 20–60 s)…");
  let out = Buffer.alloc(0);
  const code = await new Promise((res) => {
    const p = spawn(ACCORE, ["/s", scr, "/l", log], { windowsHide: true });
    p.stdout.on("data", (c) => { out = Buffer.concat([out, c]); }); p.stderr.on("data", (c) => { out = Buffer.concat([out, c]); });
    const t = setTimeout(() => { try { p.kill(); } catch (e) {} res(-1); }, 180000);
    p.on("exit", (c) => { clearTimeout(t); res(c); }); p.on("error", () => { clearTimeout(t); res(-2); });
  });
  /* accoreconsole in UTF-16LE (có byte 0) hoặc ASCII tuỳ bản */
  let s = out.includes(0) ? out.toString("utf16le") : out.toString("latin1");
  if (fs.existsSync(log)) { const b = fs.readFileSync(log); s += "\n" + (b.includes(0) ? b.toString("utf16le") : b.toString("latin1")); }
  const logCanh = tep.replace(/\.dxf$/i, "") + ".autocad.log"; fs.writeFileSync(logCanh, s, "utf8");          // để soi lỗi AUDIT
  const audit = s.match(/Total errors found\s+(\d+)/i);
  bao(!/drawing discarded|Invalid or incomplete DXF/i.test(s), "AutoCAD DXFIN nạp được tệp (không 'drawing discarded')", (s.match(/Error in [A-Z]+ Table|Invalid or incomplete DXF[^\r\n]*/i) || [""])[0]);
  const khuAC = s.match(/DEM-LA-KHU=(\d+)/), chuAC = s.match(/DEM-LA-KHU-CHU=(\d+)/), tuongAC = s.match(/DEM-LA-TUONG=(\d+)/);
  bao(code === 0 || code === -1 && fs.existsSync(dwgTam), "accoreconsole chạy xong", "mã thoát " + code);
  bao(audit && +audit[1] === 0, "AUDIT: 0 lỗi", audit ? audit[1] + " lỗi" : "không thấy dòng Total errors (log: " + s.replace(/\s+/g, " ").slice(-240) + ")");
  bao(khuAC && +khuAC[1] === soKhu, "AutoCAD đếm LA-KHU = bước 1", (khuAC ? khuAC[1] : "?") + " / " + soKhu);
  bao(chuAC && +chuAC[1] >= soKhu * 2, "AutoCAD đếm chữ LA-KHU-CHU ≥ 2 × khu", chuAC ? chuAC[1] : "?");
  bao(tuongAC && +tuongAC[1] >= 1, "AutoCAD thấy tường bao LA-TUONG", tuongAC ? tuongAC[1] : "?");
  if (fs.existsSync(dwgTam)) { const dwg = tep.replace(/\.dxf$/i, "") + ".dwg"; fs.copyFileSync(dwgTam, dwg); bao(true, "đã lưu DWG 2018 cạnh tệp DXF", dwg + " (" + fs.statSync(dwg).size + " B)"); }
  else bao(false, "sinh được .dwg", "AutoCAD không ghi tệp — log: " + s.replace(/\s+/g, " ").slice(-240));
}
await autocad();
console.log(ok.join("\n"));
if (loi.length) { console.log("\n" + "-".repeat(64) + "\n" + loi.join("\n") + "\n" + "-".repeat(64) + `\nKẾT QUẢ: ${ok.length} đạt · ${loi.length} LỖI`); process.exit(1); }
console.log(`\nKẾT QUẢ: ĐẠT toàn bộ ${ok.length} ca.`);
