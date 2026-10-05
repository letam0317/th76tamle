/* runner-gio.mjs — cửa "vai máy" cho các .bat (laptop 09:00–17:55 · PC phần còn lại; xem session-rules mayDuocChay).
 * Dùng ở đầu .bat:   node runner-gio.mjs >> runner-gio.log 2>&1 || exit /b 0
 * exit 0 = máy này được chạy (không in gì) · exit 75 = máy kia đang trực (in 1 dòng lý do). */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mayDuocChay, DEFER_EXIT } from "./session-rules.js";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), path.basename(process.argv[2] || ""), ...a);
process.exit(mayDuocChay(log) ? 0 : DEFER_EXIT);
