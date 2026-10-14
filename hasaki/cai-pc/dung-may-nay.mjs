// dung-may-nay.mjs — bấm «Dừng máy» cho CHÍNH máy này trên mục Máy trạm (GAS pcLenh), dùng khi cài bộ cò lên MÁY QUẢN LÝ (laptop).
// 14/10/2026 user: «chỉ chạy thử xem làm ăn ra sao thôi, ở mục Máy trạm có nút xoá pc/laptop mà» ⇒ không chặn cài trên laptop nữa,
// nhưng laptop vào bảng ở trạng thái DỪNG: hiện để xem, KHÔNG nhận việc (laptop đang chạy cò gốc — nhận nữa là chạy trùng).
// Muốn cho chạy: bấm «Cho chạy lại» trên mục Máy trạm. Chạy trong thư mục dự án (đọc .env): node cai-pc/dung-may-nay.mjs
import os from "node:os";
const { gasPost } = await import("../session-rules.js");
const key = process.env.APPSCRIPT_KEY;
if (!key) { console.log("KHONG co APPSCRIPT_KEY trong .env - khong dat duoc lenh dung"); process.exit(1); }
const j = await gasPost({ action: "pcLenh", key, may: os.hostname(), viec: "", dung: true, boi: "bo cai (may quan ly)" }, () => {}, "pcLenh");
console.log(j && j.status === "success" ? "DA DUNG " + os.hostname() + " tren muc May tram" : "LOI dat lenh dung: " + JSON.stringify(j).slice(0, 160));
process.exit(j && j.status === "success" ? 0 : 1);
