// sao-luu-du-lieu.mjs — SAO LƯU HẰNG NGÀY sổ sách của mọi cò + Google Sheet · 20/10/2026
// Đánh giá 20/10: 369+ tệp JSON (.exports + sổ gốc .*.json) chỉ có 1 bản trên laptop, không sao lưu; Sheet 5S/riêng/phụ cũng không có bản chép.
// Làm gì (task «5S Sao luu du lieu» 02:00 hằng ngày, laptop):
//   1. Nén .exports/**/*.json + sổ gốc .*.json + cai-pc/*.json (KHÔNG video/ảnh/clip, bỏ tệp > 60 MB) → <OneDrive>\Sao lưu Audit\audit-YYYY-MM-DD.zip
//      (OneDrive tự đưa lên mây = bản ngoài máy). Giữ GIU_NGAY bản gần nhất.
//   2. Gọi Apps Script `saoLuuSheet` (có khoá): chép 4 sheet (5S công khai, sheet riêng, tồn kho factory, nghiệm thu) vào thư mục Drive
//      «Sao lưu Audit (không chia sẻ)», giữ GIU_NGAY bản.
//   3. Ghi .exports/sao-luu-gan-nhat.json {luc, zip, MB, soTep, sheet:[…]} — bộ đo/đồng hồ sức khoẻ đọc ở đây.
//   node sao-luu-du-lieu.mjs [--thu] [--khong-sheet] [--giu=14]     (--thu: chỉ liệt kê, không nén, không gọi GAS)
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { ghiJson } from "./so-ghi.mjs";   // 20/10 ghi sổ JSON an toàn (ghi tạm → đổi tên) + nhật ký ai ghi

const DIR = path.dirname(fileURLToPath(import.meta.url));
const A = Object.fromEntries(process.argv.slice(2).filter((x) => x.startsWith("--")).map((x) => { const [k, v] = x.slice(2).split("="); return [k, v ?? "1"]; }));
const GIU = Math.max(3, Number(A.giu || process.env.SAO_LUU_GIU_NGAY || 14)), TRAN_MB = 60;
const log = (...a) => { const d = new Date().toTimeString().slice(0, 8) + " " + a.join(" "); console.log(d); try { fs.appendFileSync(path.join(DIR, "sao-luu-du-lieu.log"), d + "\n"); } catch { /* */ } };
const homNay = new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10);

function thuMucSaoLuu() {
  const od = process.env.SAO_LUU_DIR || [path.join(os.homedir(), "OneDrive"), path.join(os.homedir(), "OneDrive - Hasaki")].find((p) => fs.existsSync(p));
  if (!od) throw new Error("không thấy thư mục OneDrive (đặt SAO_LUU_DIR trong .env nếu muốn nơi khác)");
  const d = process.env.SAO_LUU_DIR ? od : path.join(od, "Sao lưu Audit"); fs.mkdirSync(d, { recursive: true }); return d;
}
// Danh sách tệp cần giữ: chỉ JSON (sổ, cache, quyết định), bỏ video/ảnh — đường tương đối từ hasaki/
function danhSachTep() {
  const ds = [];
  const di = (rel) => { const abs = path.join(DIR, rel); let st; try { st = fs.statSync(abs); } catch { return; }
    if (st.isDirectory()) { if (/node_modules|\.git$|\.bai-xe-tam|\.cache-model|agy-xm|xm-tu-dong|cam-baocao|kenh-luc-chup|cf[\\/]dist/.test(rel)) return; for (const c of fs.readdirSync(abs)) di(rel + "/" + c); return; }
    if (!/\.json$/i.test(rel)) return; if (st.size > TRAN_MB * 1048576) { log("bỏ (quá " + TRAN_MB + " MB): " + rel); return; }
    if (/token|[-_.]phien|phien[-_.]|bridge|khoa-?b64|secret/i.test(path.basename(rel))) return;   // KHÔNG đưa token/phiên/khoá vào bản sao lưu (OneDrive)
    ds.push({ rel, co: st.size }); };
  di(".exports"); di("cai-pc");
  for (const f of fs.readdirSync(DIR)) if (/^\.[\w.-]+\.json$/.test(f)) di(f);   // sổ gốc .canh-*.json, .cache-*.json, .nhip-*.json…
  return ds;
}
async function saoLuuSheet() {
  const { gasPost } = await import("./session-rules.js");
  const j = await gasPost({ action: "saoLuuSheet", key: process.env.APPSCRIPT_KEY, giu: GIU }, () => {}, "saoLuuSheet");
  if (!j || j.status !== "success") throw new Error((j && j.message) || "GAS không trả");
  return j;
}

const ds = danhSachTep(), tongMB = ds.reduce((a, x) => a + x.co, 0) / 1048576;
log(`${ds.length} tệp JSON · ${tongMB.toFixed(0)} MB cần sao lưu`);
if (A.thu) { console.log(ds.slice(0, 10).map((x) => "  " + x.rel).join("\n") + "\n  …"); process.exit(0); }

const KQ = { luc: new Date().toISOString(), ngay: homNay, soTep: ds.length, MB: +tongMB.toFixed(1), zip: "", zipMB: 0, sheet: null, loi: [] };
try {
  const thu = thuMucSaoLuu(), zip = path.join(thu, `audit-${homNay}.zip`), dsTep = path.join(DIR, ".exports", ".sao-luu-ds.txt");
  fs.writeFileSync(dsTep, ds.map((x) => x.rel).join("\n"));
  // tar (GNU, có sẵn trong Windows 10) tạo zip theo danh sách; -C hasaki để đường trong zip là tương đối
  try { fs.unlinkSync(zip); } catch { /* */ }
  // bsdtar của Windows (System32) mới tạo được .zip; «tar» trong PATH của Git Bash là GNU tar, không nén zip → gọi đích danh
  // bsdtar không mở được đường có dấu tiếng Việt («Sao lưu Audit») → nén ra tệp tạm đường ASCII rồi Node chuyển sang OneDrive
  const TAR = fs.existsSync("C:/Windows/System32/tar.exe") ? "C:/Windows/System32/tar.exe" : "tar", zipTam = path.join(DIR, ".exports", "sao-luu-tam.zip");
  try { fs.unlinkSync(zipTam); } catch { /* */ }
  execFileSync(TAR, ["-a", "-cf", zipTam, "-C", DIR, "-T", dsTep], { stdio: ["ignore", "ignore", "pipe"], timeout: 20 * 60e3 });
  fs.copyFileSync(zipTam, zip); fs.unlinkSync(zipTam);
  KQ.zip = zip; KQ.zipMB = +(fs.statSync(zip).size / 1048576).toFixed(1); log(`đã nén → ${zip} (${KQ.zipMB} MB)`);
  // giữ GIU bản gần nhất
  const cu = fs.readdirSync(thu).filter((f) => /^audit-\d{4}-\d{2}-\d{2}\.zip$/.test(f)).sort();
  for (const f of cu.slice(0, Math.max(0, cu.length - GIU))) { fs.unlinkSync(path.join(thu, f)); log("xoá bản cũ " + f); }
} catch (e) { KQ.loi.push("zip: " + e.message); log("LỖI nén: " + e.message); }
/* 21/10 user «chép Sheet có cần không?» → KHÔNG: Google Sheets tự giữ lịch sử phiên bản (Tệp › Lịch sử phiên bản), chép thêm chỉ tốn Drive.
   Mặc định bỏ; cần thì chạy tay `--sheet`. Bản đã chép 20–21/10 nằm ở Drive «Sao lưu Audit (không chia sẻ)» — xoá tay nếu muốn. */
if (A.sheet) {
  try { const j = await saoLuuSheet(); KQ.sheet = j.ds || j; log("Sheet: " + JSON.stringify(j.ds || j).slice(0, 300)); }
  catch (e) { KQ.loi.push("sheet: " + e.message); log("LỖI sao lưu Sheet: " + e.message); }
}
ghiJson(path.join(DIR, ".exports", "sao-luu-gan-nhat.json"), KQ, { thut: 1 });
log(KQ.loi.length ? "xong, có lỗi: " + KQ.loi.join(" | ") : "xong");
process.exit(KQ.loi.length ? 1 : 0);
