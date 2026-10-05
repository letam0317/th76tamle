/**
 * co-dang-nhap.mjs — CÒ ĐĂNG NHẬP: nghe tiếng "có người vừa đăng nhập" rồi ép làm tươi NGAY.
 * ============================================================================
 *  Extension wms-bridge (v1.5.0) sau khi bắt được token MỚI và đã XÁC THỰC còn sống sẽ bắn
 *  1 POST vào đây. Cò gọi ep-tuoi → sync-poller EP_TUOI=1. Từ lúc người bấm đăng nhập tới lúc
 *  bộ đồng bộ bắt đầu chạy: ~3-5 giây (thay vì chờ tới 2 phút của tick canh, rồi còn phải qua
 *  cửa nhịp 15'/30'/45' của poller).
 *
 *  Chỉ nghe 127.0.0.1 — không mở ra mạng, không nhận token, không có bí mật nào đi qua đây
 *  (payload chỉ là {kind, exp}). Máy tắt / cò chết thì KHÔNG mất tính năng: đường dự phòng
 *  trong watch-login-request.js vẫn bắt được phiên mới ở tick 2'.
 *
 *  Chạy thường trú: Task Scheduler "Factory co dang nhap" (xem LICH-VA-DU-PHONG.md).
 *  Chạy tay:  node co-dang-nhap.mjs
 *  Thử tay:   curl -X POST http://127.0.0.1:8790/dang-nhap -d "{\"kind\":\"wshr\"}"
 * ============================================================================
 */
import "dotenv/config";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { epNeuCan, BUOC_THEO_KHE } from "./ep-tuoi.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.CO_DANGNHAP_PORT || 8790);
const log = (...a) => console.log(new Date().toLocaleString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" }), ...a);

let dangChay = false;   // đơn lượt: nhiều tab cùng mint token → chỉ 1 lượt ép đang bay

async function xuLy(khe, nguon) {
  if (dangChay) { log("· (" + khe + ") bỏ qua — lượt ép trước còn đang chạy."); return "dang-chay"; }
  dangChay = true;
  try { const kq = await epNeuCan(DIR, khe, nguon, log); return kq.ep ? "da-ep" : "bo-qua"; }
  catch (e) { log("✗ lỗi ép: " + (e && e.message ? e.message : e)); return "loi"; }
  finally { dangChay = false; }
}

const server = http.createServer((req, res) => {
  // CORS cho service worker của extension (origin chrome-extension://…)
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-headers", "content-type");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  if (req.method !== "POST") { res.writeHead(200); return res.end("co-dang-nhap OK · port " + PORT); }
  let body = "";
  req.on("data", (c) => { body += c; if (body.length > 4096) req.destroy(); });
  req.on("end", () => {
    let ev = {}; try { ev = JSON.parse(body || "{}"); } catch { /* payload rác → coi như wms */ }
    const khe = BUOC_THEO_KHE[ev.kind] ? ev.kind : "wms";
    log("● nghe tiếng đăng nhập: khe " + khe + (ev.exp ? " (token hạn " + new Date(ev.exp).toLocaleTimeString("vi-VN") + ")" : ""));
    res.writeHead(200, { "content-type": "text/plain" }); res.end("nhan");   // trả lời NGAY, ép chạy nền
    xuLy(khe, "extension");
  });
});

server.on("error", (e) => {
  // Cò khác đang giữ cổng (task chạy chồng) → rút lui im lặng, không giết bản đang chạy.
  if (e && e.code === "EADDRINUSE") { log("· cổng " + PORT + " đã có cò khác giữ — thoát."); process.exit(0); }
  log("✗ server lỗi: " + (e && e.message ? e.message : e)); process.exit(2);
});
server.listen(PORT, "127.0.0.1", () => log("Cò đăng nhập trực ở http://127.0.0.1:" + PORT + " — chờ extension báo phiên mới."));
