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
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { ghiJson } from "./so-ghi.mjs";   // 20/10 ghi sổ JSON an toàn

const DIR = path.dirname(fileURLToPath(import.meta.url));
const NGUON = path.join(DIR, "google-script.gs");
const DICH = path.join(DIR, ".clasp-deploy", "sa.js");

/* Các hằng bí mật: tên hằng trong .gs → biến trong .env. Thiếu bất kỳ cái nào là DỪNG, không đẩy bản
   nửa vời lên — đúng chỗ đã cắn hôm nay. */
const BIMAT = [
  ["SECRET", "APPSCRIPT_KEY"],
  ["SYNC_PIN", "SYNC_PIN"],
  ["SYNC_PIN_DATA", "SYNC_PIN_DATA"],
  /* 24/08/2026: GAS tự bắn Telegram (mã OTP cấp quyền máy mới) nên cần token ngay trong bản deploy
     — không phải đặt tay Script Properties nữa. Properties vẫn THẮNG nếu đã đặt (xem tbBaoTele_). */
  ["TELE_TOKEN", "TELEGRAM_BOT_TOKEN"],
  ["TELE_CHAT", "TELEGRAM_CHAT_ID"],
  /* 29/08/2026: KHOÁ GEMINI đi theo deploy luôn. Bẫy đã cắn HAI lần (21/08 ghi nhận, 24/08 tái phát
     và không ai thấy tới 29/08): deploy-gas sinh lại sa.js từ nguồn git-safe (SV_KHOA_CUNG = '') nên
     mỗi lượt deploy là cổng sku_vision trả "chưa có khoá AI" → tab Nhận diện SKU rớt xuống OCR
     (chậm ~2×, kém chính xác hơn) mà không báo lỗi gì ra mặt người dùng. gas-nap-khoa-gemini.mjs
     là bước tay nên bị quên; nay chèn thẳng ở đây, thiếu GEMINI_API_KEY trong .env là DỪNG deploy. */
  ["SV_KHOA_CUNG", "GEMINI_API_KEY"],
];
/* 20/10 ĐỔI KHOÁ: khoá CŨ còn nhận trong thời gian chuyển — tuỳ chọn, .env không có thì chèn '' (tắt) */
const BIMAT_TUY_CHON = [["SECRET_CU", "APPSCRIPT_KEY_CU"]];

let src = fs.readFileSync(NGUON, "utf8");
for (const [hang, env] of BIMAT_TUY_CHON) { const v = process.env[env] || ""; src = src.replace(new RegExp("^var " + hang + " = '[^']*';", "m"), "var " + hang + " = '" + v.replace(/'/g, "\\'") + "';"); }
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
/* 14/10: tệp Apps Script phụ không chứa bí mật — chép nguồn git-safe sang thư mục clasp (TaiKhoan = tài khoản + phân quyền audit-dc) */
/* 20/10: google-script.gs tách theo mục nghiệp vụ → MỌI google-script-*.gs (trừ DEPLOY = bản cũ có bí mật, TuChua = bản .clasp-deploy
   đang lệch nguồn, chưa đối chiếu) chép sang .clasp-deploy/<Ten>.js. Tệp tách KHÔNG được chứa placeholder bí mật. */
const PHU = fs.readdirSync(DIR).filter((f) => /^google-script-.+\.gs$/.test(f) && !/-(DEPLOY|TuChua)\.gs$/.test(f)).sort();
for (const nguon of PHU) {
  const ab = path.join(DIR, nguon), dich = nguon.replace(/^google-script-/, "").replace(/\.gs$/, ".js"), nd = fs.readFileSync(ab, "utf8");
  if (/DAT_[A-Z_]+_O_DAY/.test(nd)) { console.error("✗ " + nguon + " có placeholder bí mật — bí mật chỉ được ở google-script.gs"); process.exit(2); }
  fs.copyFileSync(ab, path.join(path.dirname(DICH), dich)); console.log("✓ Chép " + nguon + " → " + dich);
}
/* 20/10 TAI NẠN sau khi tách: Apps Script nạp tệp theo THỨ TỰ ĐẨY, hàm trùng tên thì tệp SAU thắng. pcJson_ (MayTram: parse chuỗi) trùng
   pcJson_ (PhysicalCountImport.js bản 08/2026: bọc JSON trả về) — trước đây sa.js đứng cuối nên thắng; tách ra MayTram.js đứng TRƯỚC
   PhysicalCountImport.js → bản cũ thắng → mọi PCNHIP_* bị coi hỏng và XOÁ (bảng máy trạm trống 20:05–20:30 20/10).
   Chốt: (1) .clasp.json filePushOrder đẩy PhysicalCountImport/TuChua/TaiKhoan TRƯỚC, các tệp tách sau; (2) hàm trùng tên ngoài danh sách
   chấp nhận → KHÔNG đẩy. */
{
  const CD = path.dirname(DICH), TRUNG_CHAP_NHAN = { doPost: "PhysicalCountImport.js cũ (sa.js đứng sau nên thắng)" };   // pcJson_ bản parse đã đổi tên pcDoc_ (MayTram/XacMinh) — không còn trùng
  const CLASP_F = path.join(CD, ".clasp.json"), cl = JSON.parse(fs.readFileSync(CLASP_F, "utf8"));
  if (!(cl.filePushOrder || [])[0] || cl.filePushOrder[0] !== "PhysicalCountImport.js") {   // .clasp-deploy không vào git (có bí mật) → máy mới clasp pull sẽ thiếu → tự thêm
    cl.filePushOrder = ["PhysicalCountImport.js", "TuChua.js", "TaiKhoan.js"]; ghiJson(CLASP_F, cl, { thut: 2 }); console.log("✓ .clasp.json: thêm filePushOrder (tệp cũ nạp trước, tệp tách sau — thứ tự quyết định hàm trùng tên nào thắng)");
  }
  const dinh = {};
  for (const f of fs.readdirSync(CD).filter((x) => x.endsWith(".js"))) for (const m of fs.readFileSync(path.join(CD, f), "utf8").matchAll(/^function ([A-Za-z0-9_$]+)/gm)) (dinh[m[1]] = dinh[m[1]] || []).push(f);
  const trung = Object.entries(dinh).filter(([, fs2]) => fs2.length > 1 && !TRUNG_CHAP_NHAN[fs2[0] && Object.keys(dinh).find((k) => dinh[k] === fs2)]);
  const trungLa = Object.entries(dinh).filter(([k, fs2]) => fs2.length > 1 && !TRUNG_CHAP_NHAN[k]);
  if (trungLa.length) { console.error("✗ Hàm trùng tên giữa các tệp Apps Script (tệp sau đè tệp trước): " + trungLa.map(([k, fs2]) => k + " [" + fs2.join(", ") + "]").join(" · ") + " — đổi tên rồi đẩy."); process.exit(5); }
  void trung;
}
/* 20/10: bảng lệnh–gác (API-GAS.md) — lệnh KHÔNG gác mà chưa có lý do trong cai-pc/gas-gac-moc.json thì KHÔNG đẩy (--bo-qua-gac để ép, phải nêu lý do). */
if (!process.argv.includes("--bo-qua-gac")) {
  const g = spawnSync(process.execPath, [path.join(DIR, "qc-gas-gac.mjs")], { cwd: DIR, encoding: "utf8" });
  process.stdout.write((g.stdout || "").split("\n").map((l) => "  gác│ " + l).join("\n") + "\n");
  if (g.status) { console.error("✗ qc-gas-gac HỎNG — không đẩy."); process.exit(4); }
}

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
