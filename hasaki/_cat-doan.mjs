// Tạm 01/10: tải 1 đoạn ngắn kênh bất kỳ theo giờ VN.  node _cat-doan.mjs <host> <kênh> <YYYY-MM-DDTHH:MM:SS> <giây> <file ra>
import fs from "node:fs";
const [host, kenh, luc, giay, ra] = process.argv.slice(2);
const tok = JSON.parse(fs.readFileSync(".exports/.tr-token.json", "utf8")).token, H = { authorization: "Bearer " + tok }, B = "https://hasaki.top-review.io/api/v1";
const F = async (u, o) => { for (let i = 0; i < 4; i++) { try { return await fetch(u, o); } catch (e) { if (i == 3) throw e; await new Promise((r) => setTimeout(r, 4000)); } } };
const tu = new Date(luc + "+07:00").getTime();
const c = await (await F(`${B}/pickvideo/cat?host=${host}&kenh=${kenh}&tu=${tu}&den=${tu + Number(giay) * 1000}`, { headers: H })).json();
if (!c.data) { console.log("✗", JSON.stringify(c).slice(0, 200), c.code === "token_expired" ? "→ chạy `node camera-a8.mjs` để đăng nhập lại top-review" : ""); process.exit(c.code === "token_expired" ? 3 : 1); }
const r = await F(B + "/pickvideo/video?f=" + encodeURIComponent(c.data.duong), { headers: H, signal: AbortSignal.timeout(180000) });
if (r.status !== 200) { console.log("✗", r.status, (await r.text()).slice(0, 150)); process.exit(1); }
fs.writeFileSync(ra, Buffer.from(await r.arrayBuffer())); console.log("✓", ra, (fs.statSync(ra).size / 1048576).toFixed(1) + " MB");
