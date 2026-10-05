// Nhắc 1 lần sáng 06/10/2026 qua Telegram (user 05/10: "mai nhắc lại t" — cài gói dựng clip lên máy in). Task tự xoá sau khi gửi.
import "dotenv/config"; import { execFileSync } from "node:child_process";
const t = process.env.TELEGRAM_BOT_TOKEN, c = process.env.TELEGRAM_CHAT_ID;
const chu = "Nhắc việc hôm nay: cần 1 người ở máy in (Desktop-JE75K38) chép thư mục hasaki\_GOI-DUNG-CLIP (189 MB) bằng USB, bấm phải CAI-DUNG-CLIP.bat → Run as administrator. Cài xong máy in tự dựng clip bằng chứng và báo CPU mới.";
const r = await fetch(`https://api.telegram.org/bot${t}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: c, text: chu }) });
console.log(r.status);
if (r.ok) try { execFileSync("schtasks", ["/Delete", "/TN", "5S Nhac cai may in", "/F"], { stdio: "ignore" }); } catch { /* */ }
