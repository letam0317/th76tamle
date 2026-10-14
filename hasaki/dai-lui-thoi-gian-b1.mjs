/**
 * dai-lui-thoi-gian-b1.mjs — DẢI LÙI THỜI GIAN cho phiếu B1 chỉ có camera lúc chụp · 05/10/2026
 *  User 05/10: "camera lúc người kiểm chụp ảnh → phải truy ra được ai tác động". Máy tự lùi + chia đôi (truy-nguoc-b1.mjs)
 *  CHƯA ĐẠT (phiếu biết đáp án 13393784: bắt nhầm đèn bật, rồi bắt nhầm pallet xê dịch) ⇒ bước an toàn trước:
 *  9 khung CÙNG GÓC camera ở T, −1h, −3h, −6h, −12h, −24h, −36h, −48h, −72h (T = giờ người kiểm chụp) ghép 1 ảnh
 *  → nhìn là biết đồ vật xuất hiện trong khoảng nào; khoảng đó máy cắt clip tiếp (bước sau). Không AI, chỉ cắt + ghép.
 *  Ra: Videos/5S-bang-chung/may/<id>_LUI-<MMDDHHmm>.jpg + thêm vào .exports/bang-chung-b1.json (mục chup.anhLui).
 *  node dai-lui-thoi-gian-b1.mjs [--id=…] [--max=5]      Tải: 9 đoạn 15 s/phiếu, chỉ top-review.
 */
import "dotenv/config";   // 14/10: tự nạp .env (BAIXE_DIR…) — chạy thẳng trên PC không qua chay-xm từng ghi bằng chứng vào đường mặc định của laptop
import fs from "node:fs"; import path from "node:path"; import { execFileSync } from "node:child_process"; import { fileURLToPath } from "node:url"; import sharp from "sharp";
const DIR = path.dirname(fileURLToPath(import.meta.url)); process.chdir(DIR);
const A = Object.fromEntries(process.argv.slice(2).map((x) => { const [k, v] = x.replace(/^--/, "").split("="); return [k, v ?? true]; }));
const MAX = Number(A.max || 5), TAM = path.join(DIR, ".exports", ".lui-tam"), GOC = path.join(process.env.BAIXE_DIR ? path.dirname(process.env.BAIXE_DIR) : "C:/Users/lechitam/Videos/5S-bang-chung", "may"),   /* 14/10: PC nội bộ đặt BAIXE_DIR (dieu-phoi.json envCung) — không ghi vào hồ sơ lechitam giả */ F = path.join(DIR, ".exports", "bang-chung-b1.json");
fs.mkdirSync(TAM, { recursive: true });
const log = (...a) => console.log(new Date(Date.now() + 7 * 36e5).toISOString().slice(11, 19), ...a);
const doc = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };
const iso = (ms) => new Date(ms + 7 * 36e5).toISOString().slice(0, 19);
const MOC = [0, 1, 3, 6, 12, 24, 36, 48, 72];
const so = doc(F, {});
/* 05/10 THU HẸP (user bấm khung sớm nhất đã thấy đồ vật trên dashboard): --id --tu=<ISO> --den=<ISO> → 9 khung chia đều trong [tu, den];
   khi den−tu ≤ 3 phút thì KHÔNG dựng dải nữa mà cắt CLIP lúc đồ vật xuất hiện (tu−20 s … den+20 s) → bằng chứng ai tác động. */
const THU_HEP = A.id && A.tu && A.den;
const viec = Object.entries(so).filter(([id, e]) => e.loai === "chup" && (e.anh || []).length && (THU_HEP || !e.anhLui) && (!A.id || A.id === id)).slice(0, MAX);
log(`${viec.length} phiếu dựng dải lùi thời gian`);
for (const [id, e] of viec) {
  const kj = doc(path.join(DIR, ".exports", "kenh-luc-chup", id + ".json"), {});
  const k = (kj.kenh || []).find((x) => { const [h, c] = x.split("/"); return fs.existsSync(path.join(DIR, ".exports", "kenh-luc-chup", `${id}_${c}_${h.split(".").pop()}_f0.jpg`)); });
  if (!k) { log(`✗ ${id}: không có kênh ra hình`); continue; }
  const [host, ch] = k.split("/"), T = Date.parse(e.luc.replace(" ", "T") + "+07:00"), o = [];
  const tu = THU_HEP ? Date.parse(A.tu.replace(" ", "T") + "+07:00") : 0, den = THU_HEP ? Date.parse(A.den.replace(" ", "T") + "+07:00") : 0;
  if (THU_HEP && den - tu <= 180e3) {
    const ten = `${id}_TRUY-${iso(tu).replace(/[^0-9]/g, "").slice(4, 12)}_ch${ch}.mp4`, ra = path.join(GOC, ten);
    let ok = false; for (const lech of [0, -20, 20]) { try { execFileSync(process.execPath, ["_cat-doan.mjs", host, ch, iso(tu - 20000 + lech * 1000), String(Math.round((den - tu) / 1000) + 40), ra], { stdio: "ignore", windowsHide: true, timeout: 240000 }); } catch { /* */ } if (fs.existsSync(ra) && fs.statSync(ra).size > 50e3) { ok = true; break; } }
    const moi = doc(F, {}); if (ok) moi[id] = { ...moi[id], truy: { clip: ten, tu: iso(tu), den: iso(den), kenh: "kênh " + ch, luc: new Date().toISOString() } };
    fs.writeFileSync(F, JSON.stringify(moi, null, 1)); log(ok ? `✓ ${id} → clip lúc đồ vật xuất hiện ${ten}` : `✗ ${id}: cắt clip hỏng`); continue;
  }
  const MOCMS = THU_HEP ? Array.from({ length: 9 }, (_, i) => Math.round(den - (den - tu) * i / 8)) : MOC.map((h) => T - h * 36e5 - 34000);
  for (const [i, tm] of MOCMS.entries()) { const h = THU_HEP ? i : MOC[i];
    let buf = null;
    for (const lech of [0, 30, -30, 90]) {   // đầu ghi trả 400 cho riêng vài cửa sổ / ghi theo chuyển động
      const t = tm - 6000 + lech * 1000, mp = path.join(TAM, `${id}_${h}.mp4`), jp = path.join(TAM, `${id}_${h}`);
      try { execFileSync(process.execPath, ["_cat-doan.mjs", host, ch, iso(t), "12", mp], { stdio: "ignore", windowsHide: true, timeout: 180000 }); } catch { /* lệch */ }
      if (!fs.existsSync(mp) || fs.statSync(mp).size < 30e3) continue;
      try { execFileSync(process.execPath, ["_khung.mjs", path.resolve(mp), path.resolve(jp), "6"], { stdio: "ignore", windowsHide: true, timeout: 120000, env: { ...process.env, DON: "1" } }); } catch { /* */ }
      const fj = [jp + "_f0.jpg", jp + "_1.jpg"].find((x) => fs.existsSync(x));
      /* 05/10: trước đây cắt góc 640×360 của khung 1280×720 → chỉ thấy 1/4 cảnh ⇒ thu nhỏ cả khung */
      if (fj) { buf = await sharp(fj).resize(640, 360, { fit: "contain", background: "#000" }).toBuffer().catch(() => fs.readFileSync(fj)); for (const x of [mp, jp + "_f0.jpg", jp + "_1.jpg"]) try { fs.unlinkSync(x); } catch { /* */ } break; }
      try { fs.unlinkSync(mp); } catch { /* */ }
    }
    o.push({ h, tm, buf }); log(`  ${id} ${iso(tm).slice(5, 16)} ${buf ? "✓" : "✗"}`);
  }
  if (o.filter((x) => x.buf).length < 4) { log(`✗ ${id}: quá ít khung ra hình`); continue; }
  const W = 640, H = 360, cap = 32, comp = [];
  for (const [i, x] of o.entries()) {
    const left = (i % 3) * W, top = Math.floor(i / 3) * (H + cap);
    const nhan = (i + 1) + ". " + (THU_HEP ? iso(x.tm).slice(5, 19).replace("T", " ") : x.h ? `−${x.h} giờ · ${iso(x.tm).slice(5, 16).replace("T", " ")}` : `LÚC CHỤP · ${iso(x.tm).slice(5, 16).replace("T", " ")}`);
    comp.push({ input: Buffer.from(`<svg width="${W}" height="${cap}"><rect width="${W}" height="${cap}" fill="black"/><text x="8" y="23" font-size="20" font-family="Arial" font-weight="bold" fill="${i ? "yellow" : "#7CFC00"}">${nhan}${x.buf ? "" : " — không có hình"}</text></svg>`), left, top });
    comp.push({ input: x.buf ? await sharp(x.buf).resize(W, H, { fit: "contain", background: "#000" }).toBuffer() : await sharp({ create: { width: W, height: H, channels: 3, background: "#222" } }).png().toBuffer(), left, top: top + cap });
  }
  const ten = `${id}_LUI-${THU_HEP ? iso(den).replace(/[^0-9]/g, "").slice(4, 14) : e.luc.replace(/[^0-9]/g, "").slice(4, 12)}_ch${ch}.jpg`;
  await sharp({ create: { width: W * 3, height: 3 * (H + cap), channels: 3, background: "#000" } }).composite(comp).jpeg({ quality: 80 }).toFile(path.join(GOC, ten));
  const moi = doc(F, {}); moi[id] = { ...moi[id], anhLui: ten, kenhLui: "kênh " + ch, luiMoc: o.map((x) => iso(x.tm)), luiCo: o.map((x) => !!x.buf) }; fs.writeFileSync(F, JSON.stringify(moi, null, 1));
  log(`✓ ${id} → ${ten}`);
}
