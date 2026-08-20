/**
 * gas-nap-khoa-gemini.mjs — nạp GEMINI_API_KEY từ hasaki/.env vào BẢN DEPLOY của Apps Script
 * (`.clasp-deploy/sa.js`, biến `SV_KHOA_CUNG`) để tab "Nhận diện SKU" đọc được tem sau khi push.
 *
 *  Vì sao cần: bản git-safe `google-script.gs` LUÔN để trống chuỗi khoá. Bản deploy thì đã gitignore
 *  và vốn chứa SECRET + PIN thật, nên khoá nằm ở đó là đúng chỗ — và đỡ phải vào editor Apps Script
 *  gõ tay mỗi lần dựng máy mới.
 *  Đường ưu tiên vẫn là Script Properties (`datKhoaGemini()` trong editor); SV_KHOA_CUNG là dự phòng.
 *
 *  node gas-nap-khoa-gemini.mjs [--xoa]     (--xoa: gỡ khoá khỏi bản deploy)
 *  Sau đó: cd .clasp-deploy && npx @google/clasp push -f && npx @google/clasp deploy -i <id> -d "..."
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const F = path.join(DIR, ".clasp-deploy", "sa.js");
const XOA = process.argv.includes("--xoa");

if (!fs.existsSync(F)) { console.error("✗ Không thấy " + F + " (chưa có bản deploy — clasp pull trước)."); process.exit(2); }
const khoa = XOA ? "" : String(process.env.GEMINI_API_KEY || "").trim();
if (!XOA && !khoa) { console.error("✗ .env chưa có GEMINI_API_KEY (lấy miễn phí ở aistudio.google.com/apikey)."); process.exit(3); }

let s = fs.readFileSync(F, "utf8");
const re = /^var SV_KHOA_CUNG = '[^']*';$/m;
if (!re.test(s)) { console.error("✗ Không thấy dòng `var SV_KHOA_CUNG = '...';` trong sa.js — bản deploy quá cũ?"); process.exit(2); }
const cu = (s.match(re) || [""])[0].replace(/^var SV_KHOA_CUNG = '|';$/g, "");
s = s.replace(re, "var SV_KHOA_CUNG = '" + khoa + "';");
fs.writeFileSync(F, s);
console.log(XOA
  ? "✓ Đã gỡ khoá khỏi .clasp-deploy/sa.js (trước đó " + (cu ? cu.length + " ký tự" : "vốn đã trống") + ")."
  : "✓ Đã nạp khoá " + khoa.length + " ký tự vào .clasp-deploy/sa.js" + (cu ? " (thay khoá cũ " + cu.length + " ký tự)." : "."));
console.log("  Nhớ push + deploy để lên production: cd .clasp-deploy && npx @google/clasp push -f");
