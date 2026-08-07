/**
 * tao-sheet-moi.mjs — TẠO 1 FILE GOOGLE SHEET MỚI dưới tài khoản chủ GAS (letam0317@gmail.com)
 * ============================================================================================
 *  Vì sao cần: GAS (apiSyncTasks) chỉ mở được sheet mà TÀI KHOẢN CHẠY GAS có quyền — file do
 *  tài khoản khác tạo sẽ dính "Bạn không có quyền truy cập". Token clasp (~/.clasprc.json)
 *  là chính chủ GAS và có scope drive.file → tạo file ở đây thì GAS ghi được ngay.
 *
 *  Chạy:  node tao-sheet-moi.mjs "Tên file" [email1,email2,...]   (email được cấp quyền SỬA)
 *  In ra: SHEET_ID=<id> và URL — dùng id đó làm DS_SHEET cho doi-soat-kiemke.mjs v.v.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ten = process.argv[2];
const emails = String(process.argv[3] || "").split(",").map((s) => s.trim()).filter(Boolean);
if (!ten) { console.error("Cách dùng: node tao-sheet-moi.mjs \"Tên file\" [email1,email2]"); process.exit(1); }

const rc = JSON.parse(fs.readFileSync(path.join(os.homedir(), ".clasprc.json"), "utf8"));
const t = rc.tokens ? rc.tokens.default : rc.token;
const tk = await (await fetch("https://oauth2.googleapis.com/token", {
  method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ client_id: t.client_id, client_secret: t.client_secret, refresh_token: t.refresh_token, grant_type: "refresh_token" }),
})).json();
if (!tk.access_token) { console.error("✗ Không làm tươi được token clasp: " + JSON.stringify(tk).slice(0, 200)); process.exit(2); }
const H = { authorization: "Bearer " + tk.access_token, "content-type": "application/json" };

const f = await (await fetch("https://www.googleapis.com/drive/v3/files", {
  method: "POST", headers: H,
  body: JSON.stringify({ name: ten, mimeType: "application/vnd.google-apps.spreadsheet" }),
})).json();
if (!f.id) { console.error("✗ Tạo file thất bại: " + JSON.stringify(f).slice(0, 300)); process.exit(2); }

for (const email of emails) {
  const p = await (await fetch("https://www.googleapis.com/drive/v3/files/" + f.id + "/permissions?sendNotificationEmail=false", {
    method: "POST", headers: H,
    body: JSON.stringify({ type: "user", role: "writer", emailAddress: email }),
  })).json();
  console.log(p.id ? "✓ chia sẻ SỬA cho " + email : "⚠ không chia sẻ được cho " + email + ": " + JSON.stringify(p).slice(0, 200));
}

console.log("SHEET_ID=" + f.id);
console.log("URL=https://docs.google.com/spreadsheets/d/" + f.id + "/edit");
