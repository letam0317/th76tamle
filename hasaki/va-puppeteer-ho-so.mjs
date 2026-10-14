/**
 * va-puppeteer-ho-so.mjs — chặn "Edge ngầm làm khoá tài khoản Windows" (10/10/2026).
 *
 *  Gốc: Edge/Chrome (lõi Chromium) tự thử đăng nhập Windows bằng MẬT KHẨU RỖNG để biết máy có đặt mật khẩu không,
 *  rồi nhớ kết quả trong "Local State" (password_manager.os_password_blank / os_password_last_changed).
 *  puppeteer mỗi lần launch tạo hồ sơ tạm TRỐNG → lần nào cũng thử lại → 1 lần sai (Security 4625, msedge.exe).
 *  ~280 lần/ngày → vượt ngưỡng khoá 10 lần/10 phút → tài khoản lechitam bị khoá 26 lần/ngày, gõ đúng mật khẩu cũng bị từ chối.
 *
 *  Vá: ngay sau khi puppeteer tạo hồ sơ tạm, ghi sẵn "Local State" chép mục password_manager từ Edge/Chrome thật
 *  (luôn đúng kể cả khi đổi mật khẩu) → Chromium không thử nữa. Đo: hồ sơ trống +1 lần sai, hồ sơ đã ghi +0.
 *
 *  Chạy:  node va-puppeteer-ho-so.mjs          (tự chạy lại sau npm install qua "postinstall")
 *         node va-puppeteer-ho-so.mjs --kiem   (chỉ báo, không sửa; thoát 1 nếu còn bản chưa vá)
 */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const KIEM = process.argv.includes("--kiem");
const DAU = "/*VA-HO-SO-OS-PASSWORD*/";
const GOC = { esm: "chromeArguments.push(`--user-data-dir=${await mkdtemp(this.getProfilePath())}`);",
              cjs: "chromeArguments.push(`--user-data-dir=${await (0, promises_1.mkdtemp)(this.getProfilePath())}`);" };
const taoDir = { esm: "await mkdtemp(this.getProfilePath())", cjs: "await (0, promises_1.mkdtemp)(this.getProfilePath())" };
const MOI = (k) => `${DAU}{ const __d = ${taoDir[k]};
            try { const __fs = await import('node:fs'), __p = await import('node:path'); let __pm = null;
                for (const __n of [['Microsoft', 'Edge'], ['Google', 'Chrome']]) { try { __pm = JSON.parse(__fs.readFileSync(__p.join(process.env.LOCALAPPDATA || '', ...__n, 'User Data', 'Local State'), 'utf8')).password_manager; } catch { } if (__pm && 'os_password_blank' in __pm) break; __pm = null; }
                if (__pm) __fs.writeFileSync(__p.join(__d, 'Local State'), JSON.stringify({ password_manager: { os_password_blank: __pm.os_password_blank, os_password_last_changed: __pm.os_password_last_changed } })); } catch { }
            chromeArguments.push(\`--user-data-dir=\${__d}\`); }`;

// mọi bản puppeteer-core trong hasaki (kể cả gói con như _GOI-DUNG-CLIP)
const timBan = (goc, sau = 0, kq = []) => {
  if (sau > 5) return kq;
  for (const e of fs.readdirSync(goc, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name === ".git") continue;
    const p = path.join(goc, e.name);
    if (e.name === "puppeteer-core" && path.basename(goc) === "node_modules") kq.push(p);
    else if (e.name === "node_modules" || !goc.includes("node_modules")) timBan(p, sau + 1, kq);
  }
  return kq;
};

let chuaVa = 0, daVa = 0, moiVa = 0;
for (const ban of timBan(DIR)) {
  for (const k of ["esm", "cjs"]) {
    const f = path.join(ban, "lib", k, "puppeteer", "node", "ChromeLauncher.js");
    if (!fs.existsSync(f)) continue;
    const t = fs.readFileSync(f, "utf8");
    if (t.includes(DAU)) { daVa++; continue; }
    if (!t.includes(GOC[k])) { console.log(`⚠ không thấy dòng gốc (puppeteer đổi phiên bản?): ${path.relative(DIR, f)}`); chuaVa++; continue; }
    if (KIEM) { console.log(`✗ chưa vá: ${path.relative(DIR, f)}`); chuaVa++; continue; }
    fs.writeFileSync(f, t.replace(GOC[k], MOI(k)));
    console.log(`✓ đã vá: ${path.relative(DIR, f)}`); moiVa++;
  }
}
console.log(`Tổng: ${daVa} đã vá sẵn · ${moiVa} vừa vá · ${chuaVa} còn thiếu`);
process.exit(chuaVa ? 1 : 0);
