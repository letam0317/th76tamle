/**
 * ============================================================================
 *  doc-chat-phancong.mjs — ĐỌC lịch phân công vệ sinh từ nhóm chat.hasaki.vn
 *  bằng TOKEN BRIDGE (phiên NGƯỜI THẬT do extension wms-bridge bắt & đẩy GAS)
 * ============================================================================
 *  Bối cảnh (user chốt 25/09/2026): nhóm chat nhận lịch phân công vệ sinh MỖI
 *  NGÀY MỖI KHÁC (g-sheet không có) → phải lấy theo dữ liệu thật. chat.hasaki.vn
 *  theo LUẬT 1 PHIÊN như WMS: bot tự đăng nhập là ĐÁ VĂNG phiên người (đã bị bắt
 *  quả tang) ⇒ đường DUY NHẤT là mượn token từ chính phiên đang sống của user.
 *
 *  LUỒNG (KHÔNG mở trình duyệt, KHÔNG đăng nhập, 0 nguy cơ đá phiên):
 *   1) extension wms-bridge (Edge của user) bắt token api.hasakichat.com từ chính
 *      request của app → đẩy GAS (khe kind='chat', BRIDGE_CHAT_TOKEN).  ← phần user tự bật
 *   2) tool này lấy token qua GAS getBridgeToken kind='chat' (SECRET).
 *   3) gọi GET api.hasakichat.com/api/v1/message/scrollLoad?room=<id> (+anchor để
 *      cuộn lùi) — CHỈ ĐỌC. Token chết/không có → thoát êm, KHÔNG tự đăng nhập.
 *
 *  Chạy:
 *    node doc-chat-phancong.mjs            # đọc trang tin mới nhất, in + ghi .exports raw
 *    node doc-chat-phancong.mjs --sau=3    # cuộn lùi thêm 3 trang (xem lịch sử)
 *  Chưa có token bridge → in hướng dẫn bật extension rồi thoát (exit 0, không lỗi).
 * ============================================================================
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { gasPost } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const APPSCRIPT_KEY = process.env.APPSCRIPT_KEY;
const ROOM = process.env.CHAT_ROOM_PHANCONG || "99-1-1-15S1tYTa6t2vqxpqvfxQHT";
const API = "https://api.hasakichat.com/api/v1";
const OUT_RAW = path.join(DIR, ".exports", "chat-phancong-raw.json");
const SAU = Number((process.argv.find((x) => x.startsWith("--sau=")) || "").split("=")[1] || 0);
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);

/* Lấy token chat từ GAS (khe kind='chat') — do extension đẩy lên. Không có/chết → null. */
async function layTokenChat() {
  if (!APPSCRIPT_KEY) { log("✗ thiếu APPSCRIPT_KEY trong .env"); return null; }
  const j = await gasPost({ action: "getBridgeToken", key: APPSCRIPT_KEY, kind: "chat" }, () => {}, "getBridgeToken-chat").catch(() => null);
  if (!j || j.status !== "success") { log("✗ GAS getBridgeToken lỗi: " + (j && j.message || "?")); return null; }
  if (!j.token) {
    log("⚠ CHƯA có token chat sống trên GAS" + (j.coTungCo ? " (đã từng có — phiên chat của bạn có thể vừa đóng/hết hạn)" : "") + ".");
    return null;
  }
  return String(j.token).replace(/^Bearer\s+/i, "");
}

const H = (tok) => ({
  authorization: "Bearer " + tok,
  origin: "https://chat.hasaki.vn",
  referer: "https://chat.hasaki.vn/",
  accept: "application/json",
});

/* Gọi scrollLoad 1 trang. anchor rỗng = tin mới nhất; có anchor = cuộn theo direction. */
async function trang(tok, anchor) {
  const qs = "room=" + encodeURIComponent(ROOM) + (anchor ? "&anchor=" + encodeURIComponent(anchor) + "&direction=up" : "");
  const r = await fetch(API + "/message/scrollLoad?" + qs, { headers: H(tok), signal: AbortSignal.timeout(30000) });
  const t = await r.text();
  if (r.status === 401 || r.status === 403) { const e = new Error("token chat chết (HTTP " + r.status + ")"); e.dead = true; throw e; }
  if (!r.ok) throw new Error("scrollLoad HTTP " + r.status + ": " + t.slice(0, 120));
  if (t[0] !== "{" && t[0] !== "[") throw new Error("scrollLoad không trả JSON: " + t.slice(0, 100));
  return JSON.parse(t);
}

/* Bóc mảng tin nhắn từ nhiều hình dạng response có thể gặp (chưa xác minh cấu trúc thật). */
function bocList(j) {
  const d = j && j.data !== undefined ? j.data : j;
  if (Array.isArray(d)) return d;
  for (const k of ["list", "messages", "items", "records", "data"]) if (d && Array.isArray(d[k])) return d[k];
  return [];
}
function motTin(m) {
  const tu = m.from_name || m.sender_name || m.user_name || m.name || (m.sender && (m.sender.name || m.sender.staff_name)) || "";
  const luc = m.created_at || m.createdAt || m.time || m.sent_at || m.timestamp || "";
  const nd = String(m.content || m.message || m.text || m.body || "").replace(/<[^>]+>/g, "").trim();
  const id = m.id || m.message_id || m._id || "";
  return { id, tu, luc, nd };
}

(async () => {
  const tok = await layTokenChat();
  if (!tok) {
    console.log("\n── ĐỂ TOOL NÀY CHẠY: cần extension wms-bridge bắt token chat từ Edge của bạn ──");
    console.log("  1) Mở/đang mở tab https://chat.hasaki.vn trong Edge (phiên bạn đang dùng — KHÔNG cần đăng nhập lại).");
    console.log("  2) Bật khe chat cho extension wms-bridge (thêm host hasakichat.com — theo mẫu wms-main-hook.js).");
    console.log("  3) Extension tự đẩy token lên GAS; chạy lại lệnh này.");
    process.exit(0);
  }
  log("✓ có token chat sống (đuôi …" + tok.slice(-8) + ")");

  let anchor = "", tatCa = [], raw = [];
  for (let i = 0; i <= SAU; i++) {
    let j;
    try { j = await trang(tok, anchor); }
    catch (e) { log(e.dead ? "✗ " + e.message + " — chờ bạn thao tác lại trên chat để extension bắt token mới." : "✗ " + e.message); break; }
    raw.push(j);
    const list = bocList(j).map(motTin);
    tatCa = list.concat(tatCa);
    log("  trang " + (i + 1) + ": " + list.length + " tin");
    // anchor cho trang lùi kế: id tin CŨ nhất của trang này (nếu API dùng anchor theo id)
    const cu = bocList(j)[0];
    anchor = cu && (cu.id || cu.message_id || cu._id) || "";
    if (!anchor || !list.length) break;
    await new Promise((s) => setTimeout(s, 400));
  }

  fs.mkdirSync(path.dirname(OUT_RAW), { recursive: true });
  fs.writeFileSync(OUT_RAW, JSON.stringify({ luc: new Date().toISOString(), room: ROOM, soTrang: raw.length, raw }, null, 1), "utf8");
  log("→ raw đầy đủ: " + path.relative(DIR, OUT_RAW) + " (" + tatCa.length + " tin)");
  console.log("\n── " + tatCa.length + " tin gần nhất (mới → cũ) ──");
  for (const m of tatCa.slice(-15).reverse()) {
    console.log("[" + (m.luc || "?") + "] " + (m.tu || "?") + ": " + (m.nd || "(không có text — ảnh/tệp?)").slice(0, 200));
  }
  console.log("\n(Xem cấu trúc thật trong " + path.basename(OUT_RAW) + " để tôi viết bộ BÓC bảng phân công + ghi tab.)");
})().catch((e) => { log("LỖI:", e.message); process.exitCode = 1; });
