// Tạm 01/10 (rút từ ca 13393074 = ảnh 13393072): so NỘI DUNG ảnh IMA00 giữa các phiếu WF591 còn mở — hash byte + hash thu nhỏ 16×16 xám (chịu được nén lại).
import fs from "node:fs"; import crypto from "node:crypto"; import sharp from "sharp";
const CDN = "https://hr-media.hasaki.vn/production/hr/";
const j = JSON.parse(fs.readFileSync(".exports/board591-150d.json", "utf8")); const rows = j.rows || j.data?.rows || j;
const mo = rows.filter((x) => ![2, 4, 6].includes(Number(x.status)) && x.data?.configs?.IMA00);
const anh = []; for (const x of mo) for (const im of [].concat(x.data.configs.IMA00)) anh.push({ id: x.id, bin: x.data.configs.BIN00, ngay: String(x.data.configs.DATE00 || "").slice(0, 16), im });
console.log("phiếu mở:", mo.length, "· ảnh:", anh.length);
const cache = ".exports/.hash-ima00.json"; let H = {}; try { H = JSON.parse(fs.readFileSync(cache, "utf8")); } catch { }
let n = 0;
for (const a of anh) {
  if (H[a.im]) continue;
  try { const buf = Buffer.from(await (await fetch(CDN + a.im, { signal: AbortSignal.timeout(30000) })).arrayBuffer());
    const sha = crypto.createHash("sha1").update(buf).digest("hex").slice(0, 16);
    const px = await sharp(buf).rotate().greyscale().resize(16, 16, { fit: "fill" }).raw().toBuffer(); const mean = px.reduce((s, v) => s + v, 0) / px.length;
    const ph = [...px].map((v) => (v > mean ? "1" : "0")).join(""); H[a.im] = { sha, ph, size: buf.length }; n++;
  } catch (e) { H[a.im] = { loi: String(e).slice(0, 60) }; }
}
fs.writeFileSync(cache, JSON.stringify(H)); console.log("tải mới", n);
const ham = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++; return d; };
const cap = [];
for (let i = 0; i < anh.length; i++) for (let k = i + 1; k < anh.length; k++) {
  const A = H[anh[i].im], B = H[anh[k].im]; if (!A?.ph || !B?.ph || anh[i].id === anh[k].id) continue;
  const d = ham(A.ph, B.ph); if (A.sha === B.sha || d <= 6) cap.push({ a: anh[i], b: anh[k], sha: A.sha === B.sha, d });
}
console.log("CẶP ẢNH TRÙNG/GẦN TRÙNG (khác phiếu):", cap.length);
for (const c of cap) console.log(" ", c.a.id, c.a.bin, c.a.ngay, "⇄", c.b.id, c.b.bin, c.b.ngay, c.sha ? "GIỐNG HỆT byte" : "gần giống (lệch " + c.d + "/256)");
fs.writeFileSync(".exports/trung-anh-ima00.json", JSON.stringify(cap, null, 1));
