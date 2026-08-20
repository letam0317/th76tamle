/**
 * deploy-gas.mjs — SINH BẢN DEPLOY CỦA APPS SCRIPT RỒI ĐẨY LÊN, AN TOÀN VỚI BÍ MẬT.
 * ============================================================================================
 *  Vì sao có file này (bài học 20/08/2026, mất một lượt sửa gấp):
 *  `google-script.gs` là bản GIT-SAFE — ba hằng bí mật để placeholder (`DAT_MA_BI_MAT_RIENG_O_DAY`…).
 *  Bản chạy thật là `.clasp-deploy/sa.js` (đã .gitignore, chứa giá trị thật). Tôi từng `cp` thẳng
 *  nguồn → sa.js rồi push: mọi endpoint đòi SECRET lập tức thành "Sai key", và cả hai PIN của form
 *  5S cũng mất. Phải `clasp pull --versionNumber <cũ>` mới lấy lại được.
 *  Nên từ nay: KHÔNG copy tay. Script này đọc nguồn, chèn bí mật từ `.env`, rồi push + deploy.
 *
 *  CÁCH DÙNG
 *    node deploy-gas.mjs            # sinh sa.js + clasp push (chưa đổi bản người dùng đang gọi)
 *    node deploy-gas.mjs --deploy   # push xong deploy luôn vào ĐÚNG deployment đang dùng (URL không đổi)
 *
 *  Cần trong hasaki/.env: APPSCRIPT_KEY (= SECRET), SYNC_PIN, SYNC_PIN_DATA, APPSCRIPT_URL.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import "dotenv/config";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const NGUON = path.join(DIR, "google-script.gs");
const DICH = path.join(DIR, ".clasp-deploy", "sa.js");

/* Ba hằng bí mật: tên hằng trong .gs → biến trong .env. Thiếu bất kỳ cái nào là DỪNG, không đẩy bản
   nửa vời lên — đúng chỗ đã cắn hôm nay. */
const BIMAT = [
  ["SECRET", "APPSCRIPT_KEY"],
  ["SYNC_PIN", "SYNC_PIN"],
  ["SYNC_PIN_DATA", "SYNC_PIN_DATA"],
];

let src = fs.readFileSync(NGUON, "utf8");
const thieu = [];
for (const [hang, env] of BIMAT) {
  const v = process.env[env];
  if (!v) { thieu.push(env); continue; }
  const re = new RegExp("^var " + hang + " = '[^']*';", "m");
  if (!re.test(src)) { thieu.push(hang + " (không thấy trong google-script.gs)"); continue; }
  src = src.replace(re, "var " + hang + " = '" + v.replace(/'/g, "\\'") + "';");
}
if (thieu.length) {
  console.error("✗ Thiếu bí mật, KHÔNG đẩy gì cả: " + thieu.join(", "));
  console.error("  Điền vào hasaki/.env rồi chạy lại.");
  process.exit(2);
}
/* Chốt lại: bản sinh ra KHÔNG được còn placeholder nào — nếu còn thì thà dừng còn hơn deploy hỏng. */
const con = src.match(/^var [A-Z_]+ = '(DAT_|THAY_|XXX)[^']*';/m);
if (con) { console.error("✗ Vẫn còn placeholder: " + con[0]); process.exit(2); }

src = src.replace(
  " *  BẢN GIT-SAFE (secret đã thay bằng placeholder)",
  " *  BẢN DEPLOY (SINH TỰ ĐỘNG bởi deploy-gas.mjs — đừng sửa tay ở đây, sửa google-script.gs)\n *  BẢN GIT-SAFE (secret đã thay bằng placeholder)"
);
fs.writeFileSync(DICH, src);
console.log("✓ Sinh " + path.relative(DIR, DICH) + " (" + (src.length / 1024).toFixed(0) + " KB) — đã chèn " + BIMAT.length + " hằng bí mật từ .env");

/* shell:false + mô tả KHÔNG có khoảng trắng: với shell:true trên Windows, chuỗi mô tả nhiều từ bị
   cắt thành nhiều tham số và clasp báo "too many arguments" (đã cắn 20/08/2026). */
/* Trên Windows, `npx.cmd` không spawn được bằng execFileSync (EINVAL) mà `shell:true` lại cắt mô tả
   nhiều từ thành nhiều tham số (clasp báo "too many arguments"). Cách chạy được cả hai: dùng shell
   nhưng ghép sẵn câu lệnh, và mô tả đã bị thay khoảng trắng bằng "_" ở dưới. */
const clasp = (args) => execFileSync("npx --yes @google/clasp " + args.join(" "),
  { cwd: path.join(DIR, ".clasp-deploy"), encoding: "utf8", windowsHide: true, shell: true });

console.log(clasp(["push", "--force"]).trim());

if (process.argv.includes("--deploy")) {
  /* Deploy vào ĐÚNG deployment mà dashboard đang gọi (lấy id từ APPSCRIPT_URL trong .env) nên URL
     không đổi — người dùng không phải sửa gì ở dashboard. */
  const m = String(process.env.APPSCRIPT_URL || "").match(/\/s\/([^/]+)\/exec/);
  if (!m) { console.error("✗ Không đọc được deployment id từ APPSCRIPT_URL"); process.exit(3); }
  const ghi = process.argv[process.argv.indexOf("--deploy") + 1];
  /* Mô tả deployment: thay khoảng trắng bằng "_" cho khỏi vỡ tham số dòng lệnh của clasp. */
  const mota = ((ghi && !ghi.startsWith("--")) ? ghi : "deploy-gas.mjs").replace(/\s+/g, "_").slice(0, 90);
  console.log(clasp(["deploy", "-i", m[1], "-d", mota]).trim());
  console.log("→ URL không đổi: " + process.env.APPSCRIPT_URL);
}
