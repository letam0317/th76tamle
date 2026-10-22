/* nap-bi-mat.cjs — GIẢI KHOÁ bí mật .env trên MÁY TRẠM trước khi mã dự án đọc (22/10/2026).
 * User: «cần mã hoá bí mật trên PC … ngay cả quyền admin cũng không đọc được». Sự thật: máy phải TỰ DÙNG khoá (ghi work, gọi Apps Script)
 * thì quản trị viên của chính máy đó luôn lấy được — không cách nào chặn tuyệt đối. Cái chặn được: chép ổ cứng / bản sao lưu / thư mục bị
 * chia sẻ nhầm sang máy khác — vì .env trên PC nay giữ «dpapi:<base64>» khoá bằng DPAPI phạm vi MÁY (chỉ giải được trên chính máy đó).
 * Chốt chặn còn lại là PHÁT HIỆN: GAS báo Telegram khi phiên work bị lấy bất thường (google-script-Bridge.gs bridgeGhiLay_).
 *
 * Nạp: biến môi trường máy NODE_OPTIONS=--require "<dự án>\nap-bi-mat.cjs" (cai-pc/_CAP-NHAT-PC.ps1 đặt). Chạy TRƯỚC `dotenv/config`;
 * dotenv không đè biến đã có ⇒ mã dự án nhận bản rõ, không phải sửa từng tệp. .env không có «dpapi:» (laptop, máy chưa khoá) → không làm gì.
 * Hỏng (PowerShell lỗi…) → giữ nguyên, ghi stderr; việc sẽ báo sai khoá thay vì chạy với khoá rác.
 */
const fs = require("fs"), path = require("path"), cp = require("child_process");
try {
  const thu = [process.cwd(), process.argv[1] ? path.dirname(path.resolve(process.argv[1])) : "", __dirname];
  let tep = ""; for (const d of thu) { if (d && fs.existsSync(path.join(d, ".env"))) { tep = path.join(d, ".env"); break; } }
  const ma = {};
  if (tep) for (const l of fs.readFileSync(tep, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*dpapi:([A-Za-z0-9+\/=]+)\s*$/.exec(l);
    if (m && !process.env[m[1]]) ma[m[1]] = m[2];
  }
  if (Object.keys(ma).length) {
    const ps = "Add-Type -AssemblyName System.Security; $j = [Console]::In.ReadToEnd() | ConvertFrom-Json; $o = @{}; " +
      "foreach ($p in $j.PSObject.Properties) { $o[$p.Name] = [Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($p.Value), $null, 'LocalMachine')) }; " +
      "$o | ConvertTo-Json -Compress";
    const out = cp.execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", ps],
      { input: JSON.stringify(ma), encoding: "utf8", windowsHide: true, timeout: 30000, env: { ...process.env, NODE_OPTIONS: "" } });
    const r = JSON.parse(out);
    for (const k of Object.keys(r)) process.env[k] = r[k];
  }
} catch (e) { try { process.stderr.write("[nap-bi-mat] không giải được khoá .env: " + String(e.message || e).slice(0, 200) + "\n"); } catch (_) { /* */ } }
