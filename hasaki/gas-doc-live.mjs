/**
 * gas-doc-live.mjs — ĐỌC (chỉ đọc) nội dung LIVE của project Apps Script bằng token clasp:
 * liệt kê tệp + in manifest, để biết chắc trước khi `clasp push` (push xoá tệp remote không có ở local).
 * node gas-doc-live.mjs [--manifest]
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const scriptId = JSON.parse(fs.readFileSync(path.join(process.cwd(), ".clasp-deploy", ".clasp.json"), "utf8")).scriptId;
const rc = JSON.parse(fs.readFileSync(path.join(os.homedir(), ".clasprc.json"), "utf8"));
const t = rc.tokens ? rc.tokens.default : rc.token;
const tk = await (await fetch("https://oauth2.googleapis.com/token", {
  method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ client_id: t.client_id, client_secret: t.client_secret, refresh_token: t.refresh_token, grant_type: "refresh_token" }),
})).json();
if (!tk.access_token) { console.error("✗ không làm tươi được token clasp"); process.exit(2); }

const r = await fetch("https://script.googleapis.com/v1/projects/" + scriptId + "/content", { headers: { authorization: "Bearer " + tk.access_token } });
const j = await r.json();
if (!j.files) { console.error("✗ " + r.status + " " + JSON.stringify(j).slice(0, 300)); process.exit(2); }
console.log("scriptId " + scriptId + " — " + j.files.length + " tệp:");
for (const f of j.files) console.log("  " + String(f.type).padEnd(10) + f.name.padEnd(28) + (f.source || "").length + " ký tự");
const man = j.files.find((f) => f.name === "appsscript");
if (man) console.log("\n--- appsscript.json LIVE ---\n" + man.source);
