// Tạm 01/10: tải 1 đoạn ngắn kênh bất kỳ theo giờ VN.  node _cat-doan.mjs <host> <kênh> <YYYY-MM-DDTHH:MM:SS> <giây> <file ra>
import fs from "node:fs";
import "dotenv/config";
const [host, kenh, luc, giay, ra] = process.argv.slice(2);
const B = "https://hasaki.top-review.io/api/v1", TOKF = ".exports/.tr-token.json";
const F = async (u, o) => { for (let i = 0; i < 4; i++) { try { return await fetch(u, o); } catch (e) { if (i == 3) throw e; await new Promise((r) => setTimeout(r, 4000)); } } };
/* 14/10 máy trạm: trước chỉ ĐỌC .tr-token.json (laptop có nhờ canh-bai-xe làm mới) → PC không có tệp ⇒ mọi lượt cắt đoạn hỏng lặng lẽ
   («0 kênh ra hình»). Nay: chưa có / còn < 2' / top-review báo hết hạn → tự đăng nhập bằng TOPREVIEW_USER/PASS (.env), cùng mẫu canh-bai-xe. */
async function trToken(moi = false) {
  if (!moi) try { const c = JSON.parse(fs.readFileSync(TOKF, "utf8")); if (c.token && (!c.exp || c.exp - Date.now() > 120000)) return c.token; } catch { /* chưa có */ }
  const r = await F(B + "/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: process.env.TOPREVIEW_USER, password: process.env.TOPREVIEW_PASS }) });
  const j = await r.json().catch(() => ({})), token = j?.data?.token || j?.token || j?.access_token;
  if (!token) { console.log("✗ đăng nhập top-review lỗi HTTP " + r.status); process.exit(3); }
  let exp = 0; try { exp = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).exp * 1000; } catch { /* không đọc được hạn */ }
  fs.mkdirSync(".exports", { recursive: true }); fs.writeFileSync(TOKF, JSON.stringify({ token, exp })); return token;
}
let H = { authorization: "Bearer " + await trToken() };
const tu = new Date(luc + "+07:00").getTime();
const cat = async () => (await F(`${B}/pickvideo/cat?host=${host}&kenh=${kenh}&tu=${tu}&den=${tu + Number(giay) * 1000}`, { headers: H })).json();
let c = await cat();
if (!c.data && c.code === "token_expired") { H = { authorization: "Bearer " + await trToken(true) }; c = await cat(); }
if (!c.data) { console.log("✗", JSON.stringify(c).slice(0, 200), c.code === "token_expired" ? "→ chạy `node camera-a8.mjs` để đăng nhập lại top-review" : ""); process.exit(c.code === "token_expired" ? 3 : 1); }
const r = await F(B + "/pickvideo/video?f=" + encodeURIComponent(c.data.duong), { headers: H, signal: AbortSignal.timeout(180000) });
if (r.status !== 200) { console.log("✗", r.status, (await r.text()).slice(0, 150)); process.exit(1); }
fs.writeFileSync(ra, Buffer.from(await r.arrayBuffer())); console.log("✓", ra, (fs.statSync(ra).size / 1048576).toFixed(1) + " MB");
