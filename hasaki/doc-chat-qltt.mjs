/**
 * doc-chat-qltt.mjs — Đọc QUẢN LÝ TRỰC TIẾP của NV từ chat.hasaki.vn bằng token bridge.
 *  Nguồn: GET /room/getRoomAttributes?room_id=1-1-1-<user_id NV>-<user_id mình>
 *         → list_management (tên ĐẦU chuỗi = quản lý trực tiếp). Đây là chỗ 23/09 lấy 16 QLTT.
 *  GIỚI HẠN đã biết: chat chỉ trả list_management cho người CHUNG NHÓM chat → không phải ai cũng ra.
 *
 *  Chạy:  node doc-chat-qltt.mjs --thu=5    # thử 5 NV đầu (thăm dò, nhẹ)
 *         node doc-chat-qltt.mjs            # chạy hết danh bạ kho 170 (throttle 300ms)
 *  Chưa có token chat → thoát êm.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { gasPost } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const KEY = process.env.APPSCRIPT_KEY;
const API = "https://api.hasakichat.com/api/v1";
const THU = Number((process.argv.find((x) => x.startsWith("--thu=")) || "").split("=")[1] || 0);
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);

async function tokenChat() {
  const g = async (kind) => { const j = await gasPost({ action: "getBridgeToken", key: KEY, kind }, () => {}, "gb-" + kind).catch(() => null); return (j && j.status === "success" && j.token) ? String(j.token).replace(/^Bearer\s+/i, "") : null; };
  const access = await g("chat"), auth = await g("chatauth");
  return access && auth ? { access, auth } : null;
}
function selfId(tk) {
  try { const p = JSON.parse(Buffer.from(tk.access.split(".")[1], "base64url").toString("utf8")); return p.partner_user_id || p.user_id || p.uid || p.sub || p.id || ""; }
  catch { return ""; }
}
const H = (tk) => ({ authorization: "Bearer " + tk.access, "auth-token": tk.auth, origin: "https://chat.hasaki.vn", referer: "https://chat.hasaki.vn/", accept: "application/json" });

async function qlttCua(tok, self, uid) {
  const room = "1-1-1-" + uid + "-" + self;
  const r = await fetch(API + "/room/getRoomAttributes?room_id=" + encodeURIComponent(room), { headers: H(tok), signal: AbortSignal.timeout(20000) });
  if (r.status === 401 || r.status === 403) { const e = new Error("token chết"); e.dead = true; throw e; }
  if (!r.ok) return { loi: "HTTP " + r.status };
  const t = await r.text(); if (t[0] !== "{") return { loi: "không JSON" };
  const j = JSON.parse(t);
  const ec = j && j.status && j.status.error_code;
  if (ec === 401 || ec === 403) { const e = new Error("token chết (body " + ec + ")"); e.dead = true; throw e; }
  const d = j.data || j;
  const lm = d.list_management || d.management || (d.room && d.room.list_management) || [];
  const ten = Array.isArray(lm) && lm.length ? (lm[0].name || lm[0].staff_name || lm[0]) : "";
  return { qltt: ten, so: Array.isArray(lm) ? lm.length : 0, chuoi: Array.isArray(lm) ? lm.map((x) => x.name || x.staff_name || x).join(" ← ") : "" };
}

(async () => {
  const tok = await tokenChat();
  if (!tok) { log("⚠ chưa có token chat trên GAS — mở nhóm chat trong Edge (v1.6.0) rồi chạy lại."); process.exit(0); }
  const self = selfId(tok);
  log("✓ 2 token chat OK · user_id mình = " + (self || "(không đọc được từ JWT — thử vẫn chạy)"));

  const db = JSON.parse(fs.readFileSync(path.join(DIR, ".cache-danhba.json"), "utf8")).data;
  let nv = db.filter((x) => String(x.working_loc_id) === "398" && x.user_id && x.staff_status === 1);
  if (THU) nv = nv.slice(0, THU);
  log("Dò QLTT cho " + nv.length + " NV kho 170…");

  const out = [];
  for (const x of nv) {
    try {
      const r = await qlttCua(tok, self, x.user_id);
      if (r.qltt) { out.push({ code: x.code, ten: x.staff_name, qltt: r.qltt, chuoi: r.chuoi }); log("  ✓ " + x.staff_name + " (" + x.code + ") → " + r.qltt + (r.so > 1 ? "  [" + r.chuoi + "]" : "")); }
    } catch (e) { if (e.dead) { log("✗ token chết giữa chừng — dừng, mở lại chat để bắt token mới."); break; } }
    await new Promise((s) => setTimeout(s, 300));
  }
  fs.writeFileSync(path.join(DIR, ".exports", "chat-qltt.json"), JSON.stringify({ luc: new Date().toISOString(), out }, null, 1), "utf8");
  log("XONG: lấy được QLTT cho " + out.length + "/" + nv.length + " NV → .exports/chat-qltt.json");
})().catch((e) => { log("LỖI:", e.message); process.exitCode = 1; });
