/**
 * lay-token-hr-bridge.mjs — READ-ONLY: lấy token wshr từ KÊNH BRIDGE (extension nghe phiên
 * đang sống của người dùng), so với token trong kho rồi thử ngay /hr/sheet-summary.
 * Dùng khi cần token do app HR mint mà KHÔNG được phép đăng nhập mới (đang có phiên người sống,
 * cầu dao IdP đang ngắt). Cách dùng: mở https://hr.hasaki.vn trên trình duyệt có extension
 * wms-bridge → chạy script này.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { layBridgeTokenWshr } from "./session-rules.js";
import { docTokenCu, luuToken } from "./token-store.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const log = (...a) => console.log(...a);
const doc = (tk) => { try { return JSON.parse(Buffer.from(String(tk).replace(/^Bearer\s+/i, "").split(".")[1], "base64").toString()); } catch { return {}; } };

/* --cho[=phút]: chờ extension đẩy token MỚI (khác token đang có trong kho) rồi mới thử — dùng khi
   người dùng sắp mở hr.hasaki.vn; khỏi phải canh tay. */
const choArg = process.argv.find(a => a.startsWith("--cho"));
const CHO_MS = choArg ? Number((choArg.split("=")[1] || 5)) * 60000 : 0;
const cu = (docTokenCu(DIR, "work") || {}).token || "";
let bridge = await layBridgeTokenWshr(log);
if (CHO_MS) {
  const het = Date.now() + CHO_MS;
  while (Date.now() < het && (!bridge || bridge.trim() === String(cu).trim())) {
    await new Promise(r => setTimeout(r, 15000));
    bridge = await layBridgeTokenWshr(() => { });
    log(`  … chờ token mới (${Math.round((het - Date.now()) / 1000)}s còn lại)`);
  }
}
if (!bridge) { log("✗ Kênh bridge không có token wshr sống (extension chưa đẩy / GAS chưa phục vụ)."); process.exit(2); }
const p = doc(bridge);
log(`token bridge: sub=${p.sub} aud=${p.aud} jti=${p.jti} iat=${p.iat ? new Date(p.iat * 1000).toLocaleString("vi-VN") : "?"}`);
log("khác token 'work' trong kho? " + (bridge.trim() !== String(cu).trim() ? "CÓ (token mới)" : "KHÔNG (vẫn là token cũ)"));

const H = { authorization: bridge, accept: "application/json" };
const V = "https://wshr.hasaki.vn/api";
for (const u of ["/hr/sheet-summary?from_date=2026-07-01&to_date=2026-07-31&staff_id=7672&limit=5", "/hr/staff?limit=2", "/hr/skill?limit=2"]) {
  const r = await fetch(V + u, { headers: H });
  log(`[${r.status}] ${u.slice(0, 55)}  ${(await r.text()).replace(/\s+/g, " ").slice(0, 90)}`);
  if (r.status === 200 && u.startsWith("/hr/sheet-summary")) luuToken(DIR, "hr", bridge, "bridge");
}
