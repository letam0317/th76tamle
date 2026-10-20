// qc-gas-gac.mjs — BẢNG LỆNH–GÁC của Apps Script + bộ kiểm · 20/10/2026
// Đánh giá 20/10: 81 lệnh (action) trong 1 tệp, không chỗ nào ghi rõ lệnh nào gác bằng gì → cửa pcBoCai không gác mà không ai thấy.
// Việc: đọc doPost/doPostGoc_/doGet của google-script*.gs → mỗi lệnh: gác bằng gì (khoá SECRET / PIN / phiên tài khoản / phiên máy trạm /
// khoá thiết bị / mật khẩu / mã máy+OTP / KHÔNG) → sinh `API-GAS.md` (bảng để người đọc) + so với `cai-pc/gas-gac-moc.json`
// (danh sách lệnh KHÔNG gác đã chấp nhận, mỗi lệnh 1 lý do). Lệnh mới KHÔNG gác mà chưa có trong mốc → HỎNG (deploy-gas dừng).
//   node qc-gas-gac.mjs                  kiểm + sinh API-GAS.md
//   node qc-gas-gac.mjs --cap-nhat-moc   chấp nhận mọi lệnh không gác hiện có (chỉ khi chủ ý; nhớ điền lý do vào mốc)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url)), MOC_F = path.join(DIR, "cai-pc", "gas-gac-moc.json"), RA = path.join(DIR, "API-GAS.md");
const A = process.argv.slice(2);
const TEP = fs.readdirSync(DIR).filter((f) => /^google-script.*\.gs$/.test(f) && !/DEPLOY/.test(f)).sort();
const src = TEP.map((f) => fs.readFileSync(path.join(DIR, f), "utf8")).join("\n");

/** cách gác đọc được từ 1 đoạn mã (dòng điều phối hoặc thân hàm) */
function docGac(t) {
  if (/keyBodyOK_\(|=== SECRET\b|keyLaCu_\(/.test(t)) return "khoá SECRET (máy trạm/laptop)";
  if (/pcKeyOK_\(/.test(t)) return "khoá PC_KEY (PhysicalCountImport)";
  if (/SYNC_PIN_DATA/.test(t)) return "PIN tải dữ liệu";
  if (/SYNC_PIN\b|pinBiKhoa_\(|ghiNhanSaiPin_\(|duLieu\.pin\b/.test(t)) return "PIN";
  if (/tkPhien_\(/.test(t) && /pcPhienOK_\(/.test(t)) return "phiên tài khoản (quyền Xác minh) hoặc phiên Máy trạm";
  if (/tkPhien_\(/.test(t)) return "phiên tài khoản (TaiKhoan.gs)";
  if (/pcPhienOK_\(/.test(t)) return "phiên Máy trạm (pcDangNhap)";
  if (/tbOK_\(/.test(t)) return "khoá thiết bị (tb)";
  if (/pcBamMk_\(/.test(t)) return "mật khẩu (chính lệnh đăng nhập)";
  if (/tkBamMk_\(|tk_dangnhap|tkDangNhap_\(/.test(t)) return "mật khẩu (chính lệnh đăng nhập)";
  if (/tbDuyetCo_\(|tbKhoaCauHinh_\(/.test(t) && /otp/.test(t)) return "mã máy + OTP 4 số";
  if (/tbDuyetCo_\(|tbKhoaCauHinh_\(/.test(t)) return "mã máy (chỉ trả trạng thái chờ/duyệt)";
  if (/PCXIN_/.test(t)) return "mã PC tự sinh (xin/lấy khoá, duyệt cần SECRET)";
  if (/XM_KHOA|xmKhoa_\(/.test(t)) return "khoá kho xác minh";
  return "";
}
/** thân hàm (40 dòng đầu) */
function thanHam(ten) {
  const m = new RegExp("^function " + ten.replace(/\$/g, "\\$") + "\\s*\\([^)]*\\)\\s*\\{([\\s\\S]{0,4000})", "m").exec(src);
  return m ? m[1].split("\n").slice(0, 40).join("\n") : "";
}
const ds = [];
for (const ham of ["doPost", "doPostGoc_", "doGet"]) {
  const m = new RegExp("^function " + ham + "\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)^\\}", "m").exec(src); if (!m) continue;
  const L = m[1].split("\n");
  for (let i = 0; i < L.length; i++) {
    const a = /action === '([A-Za-z_]+)'/.exec(L[i]); if (!a) continue;
    if (ds.some((d) => d.ten === a[1])) continue;
    // nhánh nhiều dòng: gom tới khi gặp lệnh kế tiếp hoặc hết 8 dòng
    let doan = L[i]; for (let k = i + 1; k < L.length && k < i + 8 && !/action === '/.test(L[k]); k++) doan += "\n" + L[k];
    let gac = docGac(doan.replace(/action === '[A-Za-z_]+'/, ""));
    let goi = "";
    if (!gac) { const h = /(?:return|=)\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/.exec(doan.replace(/action === '[A-Za-z_]+'/, "").replace(/phanHoiJsonp?\(/g, "")); if (h) { goi = h[1]; gac = docGac(thanHam(h[1])); if (gac) gac += " (trong " + h[1] + ")"; } }
    const ghi = (/\/\/\s*(.*)$/.exec(L[i]) || [])[1] || "";
    ds.push({ ten: a[1], kieu: ham === "doGet" ? "GET" : "POST", gac, goi, ghi: ghi.trim().slice(0, 120) });
  }
}
let moc = { khongGac: {} }; try { moc = JSON.parse(fs.readFileSync(MOC_F, "utf8")); } catch { /* chưa có */ }
const khongGac = ds.filter((d) => !d.gac);
if (A.includes("--cap-nhat-moc")) { for (const d of khongGac) moc.khongGac[d.ten] = moc.khongGac[d.ten] || "(chưa ghi lý do — điền vào cai-pc/gas-gac-moc.json)"; for (const k of Object.keys(moc.khongGac)) if (!khongGac.some((d) => d.ten === k)) delete moc.khongGac[k]; moc._luc = new Date().toISOString(); fs.writeFileSync(MOC_F, JSON.stringify(moc, null, 1)); console.log("✓ mốc: " + Object.keys(moc.khongGac).length + " lệnh không gác được chấp nhận"); }
const md = ["# Bảng lệnh Apps Script và cách gác", "", "Sinh tự động bởi `qc-gas-gac.mjs` (chạy trong `deploy-gas.mjs`) — **đừng sửa tay**. Lệnh KHÔNG gác phải có lý do trong `cai-pc/gas-gac-moc.json`, nếu không deploy dừng.", "",
  `Cập nhật: ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC · ${ds.length} lệnh · ${khongGac.length} không gác (có chủ đích) · nguồn: ${TEP.join(", ")}`, "",
  "| Lệnh | Kiểu | Gác bằng | Ghi chú / lý do không gác |", "|---|---|---|---|",
  ...ds.slice().sort((x, y) => (x.gac ? 1 : 0) - (y.gac ? 1 : 0) || x.ten.localeCompare(y.ten)).map((d) => `| \`${d.ten}\` | ${d.kieu} | ${d.gac || "**KHÔNG**"} | ${(d.gac ? d.ghi : (moc.khongGac[d.ten] || "⚠ chưa có lý do")).replace(/\|/g, "\\|")} |`)];
fs.writeFileSync(RA, md.join("\n") + "\n");
const la = khongGac.filter((d) => !(d.ten in moc.khongGac));
console.log(`${ds.length} lệnh · ${khongGac.length} không gác · ${la.length} KHÔNG gác và CHƯA được chấp nhận` + (la.length ? ": " + la.map((d) => d.ten).join(", ") : ""));
console.log("→ " + path.relative(DIR, RA));
if (la.length) { console.log("HỎNG — gác lệnh lại, hoặc thêm vào cai-pc/gas-gac-moc.json kèm lý do."); process.exit(1); }
console.log("ĐẠT");
