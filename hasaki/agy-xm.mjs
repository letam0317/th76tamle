/* 09/10/2026 — CỔNG LỆNH CHỈ-ĐỌC cho Gemini agy khi xác minh 5S bằng camera (skill xac-minh-camera-5s).
 * Đặt ở đường dẫn KHÔNG dấu cách để khai quyền agy: "command(node C:\Users\lechitam\agy-xm.mjs)".
 * Chỉ chạy công cụ trong DS (đọc / tải video / trích khung / vẽ lên ảnh trong .exports). CHẶN mọi đối số --lam và mọi công cụ ghi phiếu.
 *   node C:\Users\lechitam\agy-xm.mjs <lệnh> [đối số…]
 * Lệnh: doc-phieu <id> · tai-anh <url hr-media> [tên] · kenh-luc-chup <id> [--them=ip/kênh] [--luc=…] · cat-doan <host> <kênh> <YYYY-MM-DDTHH:MM:SS> <giây> <tên tệp.mp4>
 *       khung <video> <tiền tố> <giây…> · luoi <ảnh> [x,y,w,h …] · cat-anh <ảnh> <x,y,w,h> [phóng=2] · wms-o <ô> <từ ISO> <đến ISO>
 *       roi-moc <khoá> <chuẩn ISO> <xa ISO> [--chia] [--bin=] · anh-cong <ngày> <mã,…> [lùi] · tim-tac-dong <cấu hình.json>
 *       nguoi-trong-vung <cấu hình.json> · quet-nguoi-o <khoá> <từ> <đến> · ban-do <khoá hoặc ô> · khuon <tên khuôn> · luat <mã luật>
 * Tệp ra mặc định: C:\Users\lechitam\New folder\hasaki\.exports\agy-xm\ (tên tệp trần → đặt vào đây). */
import { spawnSync } from "node:child_process"; import fs from "node:fs"; import path from "node:path"; import os from "node:os"; import { fileURLToPath } from "node:url";   // 14/10 bản trong dự án
/* 14/10: bản TRONG DỰ ÁN (cho máy trạm) — đường dẫn tự tính theo nơi đặt tệp; bản gốc C:/Users/lechitam/agy-xm.mjs giữ cho quyền agy trên laptop */
const HASAKI = path.dirname(fileURLToPath(import.meta.url)); const OUT = path.join(HASAKI, ".exports", "agy-xm"); fs.mkdirSync(OUT, { recursive: true });
/* 09/10: quyền agy chỉ khớp NGUYÊN CÂU lệnh (đo thật: "command(node C:/Users/lechitam/agy-xm.mjs)" không cho "… luat VS-06").
   ⇒ agy ghi lệnh vào HÀNG ĐỢI C:\Users\lechitam\agy-xm-lenh.txt (mỗi dòng 1 lệnh, KHÔNG có chữ node/đường dẫn, vd «doc-phieu 14081936»)
   rồi chạy đúng câu cố định `node C:/Users/lechitam/agy-xm.mjs` → cổng chạy lần lượt từng dòng, in kết quả, xoá trắng hàng đợi. */
const HANG = path.join(os.homedir(), "agy-xm-lenh.txt");
const SELF = fileURLToPath(import.meta.url);
if (process.argv.length <= 2) {
  const dong = (fs.existsSync(HANG) ? fs.readFileSync(HANG, "utf8") : "").split(/\r?\n/).map((x) => x.trim()).filter((x) => x && !x.startsWith("#"));
  if (!dong.length) { console.log(fs.readFileSync(SELF, "utf8").split("*/")[0]); console.log("(hàng đợi trống — ghi lệnh vào " + HANG + ")"); process.exit(0); }
  const tach = (t) => (t.match(/"[^"]*"|\S+/g) || []).map((x) => x.replace(/^"|"$/g, ""));
  for (const d of dong) { console.log("\n▶ " + d); const p = tach(d); if (p[0] === "node") p.splice(0, 2); spawnSync(process.execPath, [SELF, ...p], { stdio: "inherit", timeout: 40 * 60e3 }); }
  fs.writeFileSync(HANG, ""); process.exit(0);
}
const [lenh, ...a] = process.argv.slice(2);
if (a.some((x) => /^--lam\b/.test(x))) { console.log("✗ CHẶN: cổng agy-xm chỉ-đọc, không nhận --lam. Lệnh ghi phiếu phải để user chạy."); process.exit(2); }
const raTep = (f) => (!f ? f : path.isAbsolute(f) ? f : path.join(OUT, f));
const node = (tep, args, env = {}) => { const r = spawnSync(process.execPath, [tep, ...args], { cwd: HASAKI, stdio: "inherit", timeout: 40 * 60e3, env: { ...process.env, ...env } }); process.exit(r.status ?? 1); };
const docJ = (f) => JSON.parse(fs.readFileSync(path.join(HASAKI, f), "utf8"));
import { createRequire } from "node:module";
const sharp = async () => createRequire(path.join(HASAKI, "package.json"))("sharp");   // 09/10: sharp mới để ở dist/index.cjs — nạp theo node_modules của hasaki
switch (lenh) {
  case "doc-phieu": {
    const ds = fs.readdirSync(path.join(HASAKI, ".exports")).filter((f) => /^board591-live-\d{4}\.json$/.test(f)).sort((p, q) => fs.statSync(path.join(HASAKI, ".exports", q)).mtimeMs - fs.statSync(path.join(HASAKI, ".exports", p)).mtimeMs);
    for (const f of ds) { const x = docJ(".exports/" + f).find((r) => String(r.id) === String(a[0])); if (!x) continue;
      const c = x.data?.configs || {}; const CDN = "https://hr-media.hasaki.vn/production/hr/";
      console.log(JSON.stringify({ nguon: f, id: x.id, link: "https://work.hasaki.vn/tasks?task_id=" + x.id, ten: x.name, trangThai: x.status, o: c.BIN00, gioGhiNhan: c.DATE00, hangMuc: c.TYPE00,
        anhViPham: [].concat(c.IMA00 || []).map((s) => CDN + s), moTa: String(x.description || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 800),
        buoc: (x.subtasks || []).map((s) => ({ id: s.id, ten: s.name, trangThai: s.status })) }, null, 1));
      /* 09/10 QC 14081940: agy đặt vùng ở SÀN trong khi ô là tầng 20 (pallet trên cao) → giải nghĩa mã ô sẵn */
      { const p = String(c.BIN00 || "").split("-"); const tang = Number(p[4]);
        console.log("GIẢI NGHĨA Ô: khu " + p[1] + " · dãy " + p[2] + " · tủ " + p[3] + " · tầng " + p[4] + " · ô " + p[5] +
          (tang >= 20 ? " → TẦNG PALLET CAO (trên cùng, xe nâng/thang mới tới): vùng phải ở PHẦN TRÊN khung camera, người kiểm thường đứng THANG" : tang ? " → tầng kệ thấp số " + tang + " (đếm từ dưới lên, tầng 01 sát sàn)" : "")); }
      let cb = {}; try { cb = docJ(".exports/canh-b1-ketqua.json")[String(a[0])] || {}; } catch { }
      console.log("CÒ B1 (hệ thống kho, ứng viên WMS):", JSON.stringify(cb, null, 1));
      /* 09/10 QC vòng 1: agy không kiểm phiếu cùng tủ (513-03 có 4 phiếu sáng 06/10) → in sẵn phiếu cùng TỦ ±2 ngày để xét DL-02/DL-03 */
      const tu = String(c.BIN00 || "").split("-").slice(0, 4).join("-"), t0 = Date.parse(String(c.DATE00).replace(" ", "T"));
      const cung = docJ(".exports/" + f).filter((r) => r.id !== x.id && String(r.data?.configs?.BIN00 || "").startsWith(tu) && Math.abs(Date.parse(String(r.data?.configs?.DATE00).replace(" ", "T")) - t0) <= 2 * 864e5)
        .map((r) => r.id + " · " + r.data.configs.BIN00 + " · " + r.data.configs.DATE00 + " · " + String(r.data.configs.TYPE00 || "").slice(0, 60) + " · trạng thái " + r.status);
      console.log("PHIẾU CÙNG TỦ " + tu + " (±2 ngày) — xét trùng DL-02/DL-03 trước khi làm:", cung.length ? "\n  " + cung.join("\n  ") : "không có"); process.exit(0); }
    console.log("✗ không có phiếu trong board cache"); process.exit(1);
  }
  case "tai-anh": {   // tải ảnh vi phạm (hr-media) về .exports/agy-xm/<tên>
    const u = a[0]; if (!String(u).startsWith("https://hr-media.hasaki.vn/")) { console.log("✗ chỉ tải ảnh hr-media.hasaki.vn"); process.exit(2); }
    const ra = raTep(a[1] || path.basename(u.split("?")[0])); fs.writeFileSync(ra, Buffer.from(await (await fetch(u)).arrayBuffer())); console.log("✓", ra); break; }
  case "kenh-luc-chup": {   // 09/10 QC 14048783: agy chỉ thử 1 kênh → cổng TỰ THÊM mọi kênh cùng dãy (tên kênh chứa số dãy) khi chưa có --them
    let them = a.find((x) => x.startsWith("--them="));
    if (!them) { let bin = ""; for (const f of fs.readdirSync(path.join(HASAKI, ".exports")).filter((f) => /^board591-live-\d{4}\.json$/.test(f))) { const x = docJ(".exports/" + f).find((r) => String(r.id) === String(a[0])); if (x) { bin = String(x.data?.configs?.BIN00 || ""); break; } }
      const day = (bin.match(/^F0-A\d+-(\d{3}|5L\d)/) || [])[1];
      if (day) { const ds = Object.entries(docJ("ban-do-camera-o.json").tenKenh || {}).filter(([k, v]) => !k.startsWith("_") && k !== "dauGhi" && String(v).includes(day)).map(([k]) => k);
        if (ds.length) { a.push("--them=" + ds.join(",")); console.log("(cổng tự thêm " + ds.length + " kênh cùng dãy " + day + ": " + ds.join(", ") + ")"); } } }
    node("_kenh-luc-chup.mjs", a); break; }
  case "cat-doan": {   /* 09/10 QC 14079499: NVR trả 400 = camera KHÔNG GHI đúng lúc đó (ghi theo chuyển động) → agy bỏ cả phần camera.
       Cổng tự thử lệch 0, +90, −90, +180, −180, +300 s; thẻ top-review hết hạn (mã 3) → tự đăng nhập lại (camera-a8.mjs) 1 lần. In GIỜ THẬT đã lấy. */
    const vnS = (ms) => new Date(ms + 7 * 36e5).toISOString().slice(0, 19); const t0 = Date.parse(String(a[2]).replace(" ", "T") + "+07:00"); let dangNhap = false;
    for (const l of [0, 90, -90, 180, -180, 300]) { const tg = vnS(t0 + l * 1000);
      let r = spawnSync(process.execPath, ["_cat-doan.mjs", a[0], a[1], tg, a[3], raTep(a[4])], { cwd: HASAKI, encoding: "utf8", timeout: 300e3 });
      if (r.status === 3 && !dangNhap) { dangNhap = true; console.log("  (thẻ camera hết hạn → đăng nhập lại)"); spawnSync(process.execPath, ["camera-a8.mjs"], { cwd: HASAKI, timeout: 120e3 }); r = spawnSync(process.execPath, ["_cat-doan.mjs", a[0], a[1], tg, a[3], raTep(a[4])], { cwd: HASAKI, encoding: "utf8", timeout: 300e3 }); }
      if (r.status === 0) { console.log((r.stdout || "").trim() + (l ? "  ⚠ LỆCH " + (l > 0 ? "+" : "") + l + " s: đoạn bắt đầu " + tg.replace("T", " ") + " (giờ xin " + String(a[2]).replace("T", " ") + " camera không ghi)" : "")); process.exit(0); }
      console.log("  " + tg.replace("T", " ") + ": " + ((r.stdout || "").trim().split("\n").pop() || "lỗi").slice(0, 120)); }
    console.log("✗ không có hình quanh " + String(a[2]) + " (±5 phút) ở kênh " + a[0] + "/" + a[1] + " → thử kênh kề (kenh-luc-chup tự liệt kê)"); process.exit(1); }
  case "khung": node("_khung.mjs", [raTep(a[0]), raTep(a[1]), ...a.slice(2)], { DON: "1" }); break;   // ra <tiền tố>_f0.jpg, _f1.jpg … theo thứ tự giây
  case "wms-o": node("_wms-o.mjs", a); break;
  case "roi-moc": node("_roi-moc.mjs", a); break;
  case "anh-cong": node("_anh-cong.mjs", a); break;
  case "tim-tac-dong": node("_tim-tac-dong.mjs", [raTep(a[0])]); break;
  case "nguoi-trong-vung": node("_nguoi-trong-vung.mjs", [raTep(a[0])]); break;
  case "quet-nguoi-o": node("_quet-nguoi-o.mjs", a); break;
  case "ban-do": { const b = docJ("ban-do-camera-o.json"); const q = String(a[0] || "");
    for (const [k, v] of Object.entries(b.roi || {})) if (k.includes(q)) console.log("roi", k, JSON.stringify(v));
    for (const [k, v] of Object.entries(b.tenKenh || {})) if (String(v).includes(q.replace(/^F0-A1-/, "").slice(0, 3))) console.log("kênh", k, v);
    break; }
  case "khuon": { const j = docJ("kinh-nghiem-xac-minh.json"); console.log(JSON.stringify(j.khuon[a[0]] || Object.keys(j.khuon), null, 1)); break; }
  case "luat": { const j = docJ("quy-tac-xac-minh-b1.json"); console.log(JSON.stringify(j.luat.find((l) => l.ma === a[0]) || j.luat.map((l) => l.ma + " " + l.ten), null, 1)); break; }
  case "luoi": {   // lưới 80 px có số + các khung [x,y,w,h] màu vàng → <ảnh>_LUOI.jpg (1280×720)
    const S = await sharp(); const f = raTep(a[0]); let s = '<svg width="1280" height="720">';
    for (let x = 0; x <= 1280; x += 80) s += `<line x1="${x}" y1="0" x2="${x}" y2="720" stroke="#00e5ff" opacity="0.7"/><text x="${x + 3}" y="14" font-size="13" fill="#00e5ff" font-family="Arial">${x}</text>`;
    for (let y = 0; y <= 720; y += 80) s += `<line x1="0" y1="${y}" x2="1280" y2="${y}" stroke="#00e5ff" opacity="0.7"/><text x="3" y="${y - 3}" font-size="13" fill="#00e5ff" font-family="Arial">${y}</text>`;
    for (const k of a.slice(1)) { const [x, y, w, h] = k.split(",").map(Number); s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#ffd400" stroke-width="5"/>`; }
    const g = await S(f).resize(1280, 720, { fit: "fill" }).toBuffer(); const ra = path.join(OUT, path.basename(f).replace(/\.\w+$/, "") + "_LUOI.jpg");
    await S(g).composite([{ input: Buffer.from(s + "</svg>"), left: 0, top: 0 }]).jpeg({ quality: 85 }).toFile(ra); console.log("✓", ra); break; }
  case "cat-anh": {   // cắt vùng x,y,w,h (toạ độ 1280×720) rồi phóng → <ảnh>_CAT_x_y.jpg
    const S = await sharp(); const f = raTep(a[0]); const [x, y, w, h] = a[1].split(",").map(Number); const k = Number(a[2] || 2);
    const g = await S(f).resize(1280, 720, { fit: "fill" }).toBuffer(); const ra = path.join(OUT, path.basename(f).replace(/\.\w+$/, "") + `_CAT_${x}_${y}.jpg`);
    await S(await S(g).extract({ left: x, top: y, width: w, height: h }).toBuffer()).resize(Math.round(w * k), Math.round(h * k)).jpeg({ quality: 90 }).toFile(ra); console.log("✓", ra); break; }
  case "tu-choi": {   // do agy-hook viết lại lệnh ngoài cổng — in lời từ chối để agent làm tiếp, không huỷ lượt
    console.log("✗ LỆNH BỊ TỪ CHỐI (ngoài cổng chỉ-đọc): " + a.join(" "));
    console.log("Cách đúng: gọi thẳng `node C:/Users/lechitam/agy-xm.mjs <lệnh> <đối số>` (1 lệnh/lần, không nối &&, không >, không |).");
    console.log("Liệt kê tệp: `node C:/Users/lechitam/agy-xm.mjs ds [lọc] [thư mục con .exports]`. Xem ảnh: dùng công cụ đọc tệp. Danh sách lệnh: `node C:/Users/lechitam/agy-xm.mjs help`.");
    break; }
  case "tim-moc": {   /* 09/10 — TÌM MỐC ĐỒ VẬT XUẤT HIỆN, TẤT ĐỊNH (không AI): tim-moc <ip/kênh> <x,y,w,h> <giờ CÓ ISO (lúc chụp)> [giờ xa nhất ISO, mặc định −4 ngày]
       Khung chuẩn = lúc CÓ. Lùi −30′ −1h −2h −4h −8h −16h −1d −2d −3d −4d tới khi vùng KHÁC chuẩn (>15) = VẮNG → chia đôi khoảng VẮNG↔CÓ tới ≤2′.
       Mỗi mốc: tải 15 s, khung giây 3. Không có hình (camera ghi theo chuyển động) → thử +90 s. Cả khung đổi sáng mạnh (ngoài vùng >25) → ghi «đổi sáng», không tin mốc đó.
       Ra: bảng giờ → số đo + ảnh ghép so-sanh các mốc then chốt → .exports/agy-xm/timmoc_<kênh>_<giờ>/ */
    { let dsk = []; try { dsk = JSON.parse(fs.readFileSync(path.join(OUT, "kiem-vung-dat.json"), "utf8")); } catch { }
      if (!dsk.includes(String(a[1])) && !a.includes("--bo-kiem")) { console.log("✗ CHẶN: vùng [" + a[1] + "] CHƯA qua kiem-vung (ĐẠT). Chạy: kiem-vung <video lúc chụp> " + a[1] + " <mã ô> trước. (Vùng có sẵn trong bản đồ daKiem thì thêm --bo-kiem.)"); process.exit(2); } }
    const S = await sharp(); const [host, ch] = String(a[0]).split("/"); const [x, y, w, h] = String(a[1]).split(",").map(Number);
    const vn = (ms) => new Date(ms + 7 * 36e5).toISOString().slice(0, 19); const msOf = (s) => Date.parse(String(s).replace(" ", "T") + (String(s).length <= 19 ? "+07:00" : ""));
    const tCo = msOf(a[2]), tXa = a[3] ? msOf(a[3]) : tCo - 4 * 864e5;
    const D = path.join(OUT, "timmoc_" + ch + "_" + vn(tCo).replace(/[-:T]/g, "").slice(4, 12)); fs.mkdirSync(D, { recursive: true });
    const layKhung = (ms) => { for (const lech of [0, 90e3, -90e3]) { const t = ms + lech, tg = vn(t), f = path.join(D, tg.replace(/[-:T]/g, "").slice(4, 12));
        if (fs.existsSync(f + "_f0.jpg")) return { ms: t, f: f + "_f0.jpg" };
        if (new Date(t + 7 * 36e5).getUTCMinutes() === 59 && new Date(t + 7 * 36e5).getUTCSeconds() > 40) continue;   // không vắt giờ chẵn
        const r1 = spawnSync(process.execPath, ["_cat-doan.mjs", host, ch, tg, "15", f + ".mp4"], { cwd: HASAKI, encoding: "utf8", timeout: 180e3 });
        if (r1.status === 3) spawnSync(process.execPath, ["camera-a8.mjs"], { cwd: HASAKI, timeout: 120e3 });
        if (!fs.existsSync(f + ".mp4") || fs.statSync(f + ".mp4").size < 20000) continue;
        spawnSync(process.execPath, ["_khung.mjs", f + ".mp4", f, "3"], { cwd: HASAKI, timeout: 180e3, env: { ...process.env, DON: "1" } });
        try { fs.unlinkSync(f + ".mp4"); } catch { }
        if (fs.existsSync(f + "_f0.jpg")) return { ms: t, f: f + "_f0.jpg" }; } return null; };
    const xam = async (f, vung) => { const g = await S(f).resize(1280, 720, { fit: "fill" }).toBuffer(); const [vx, vy, vw, vh] = vung; return new Uint8Array(await S(await S(g).extract({ left: vx, top: vy, width: vw, height: vh }).toBuffer()).resize(64, 64, { fit: "fill" }).grayscale().raw().toBuffer()); };
    const chenh = (p, q) => { let s = 0; for (let i = 0; i < p.length; i++) s += Math.abs(p[i] - q[i]); return s / p.length; };
    const ngoai = [x > 640 ? 0 : 1280 - 320, y > 360 ? 0 : 720 - 180, 320, 180];   // ô tham chiếu xa vùng để đo đổi sáng
    const chuan = layKhung(tCo); if (!chuan) { console.log("✗ không lấy được khung lúc CÓ"); process.exit(1); }
    const R = { roi: await xam(chuan.f, [x, y, w, h]), ng: await xam(chuan.f, ngoai), ca: await xam(chuan.f, [0, 0, 1280, 720]) };
    /* 09/10 QC 14081920 v6: đo «đổi sáng» bằng số ô đổi làm khung BAN NGÀY 03–04/10 bị loại (kho xếp lại hàng) ⇒ dấu hiệu đúng bản chất:
       đêm = camera HỒNG NGOẠI → MẤT MÀU (độ bão hoà toàn khung < 35 % khung chuẩn) · hoặc độ sáng TB toàn khung lệch > 25 (bật/tắt đèn) */
    const mau = async (f) => { const b = await S(await S(f).resize(1280, 720, { fit: "fill" }).toBuffer()).resize(64, 36, { fit: "fill" }).removeAlpha().raw().toBuffer(); let s2 = 0, l = 0; for (let i = 0; i < b.length; i += 3) { const mx = Math.max(b[i], b[i + 1], b[i + 2]), mn = Math.min(b[i], b[i + 1], b[i + 2]); s2 += mx - mn; l += (b[i] + b[i + 1] + b[i + 2]) / 3; } const n = b.length / 3; return { bh: s2 / n, sang: l / n }; };
    const MC = await mau(chuan.f);
    const doiSang = async (f) => { const m = await mau(f); return (MC.bh > 6 && m.bh < MC.bh * 0.35) || Math.abs(m.sang - MC.sang) > 25 ? 99 : 0; };
    /* 09/10 QC 14079514: chênh điểm ảnh không phân biệt VẮNG với BỊ XÔ LỆCH (thùng Closeup có ở cả 3 khung nhưng bị đánh VẮNG).
       ⇒ SO KHỚP MẪU (NCC): mẫu = vùng ở khung chuẩn (½ độ phân giải), dò trong vùng nới ±MG px; điểm ≥0,55 = CÓ (kể cả xê dịch), <0,55 = VẮNG. */
    const MG = 64, HS = 2;
    const xamVung = async (f, vx, vy, vw, vh) => { const g = await S(f).resize(1280, 720, { fit: "fill" }).toBuffer(); const W2 = Math.round(vw / HS), H2 = Math.round(vh / HS);
      return { W: W2, H: H2, p: new Float32Array(await S(await S(g).extract({ left: vx, top: vy, width: vw, height: vh }).toBuffer()).resize(W2, H2, { fit: "fill" }).grayscale().raw().toBuffer()) }; };
    const sx = Math.max(0, x - MG), sy = Math.max(0, y - MG), sw = Math.min(1280, x + w + MG) - sx, sh = Math.min(720, y + h + MG) - sy;
    const MAU = await xamVung(chuan.f, x, y, w, h);
    { let m = 0; for (const v of MAU.p) m += v; m /= MAU.p.length; let sd = 0; for (let i = 0; i < MAU.p.length; i++) { MAU.p[i] -= m; sd += MAU.p[i] ** 2; } MAU.sd = Math.sqrt(sd) || 1; }
    const ncc = async (f) => { const V = await xamVung(f, sx, sy, sw, sh); let best = -1, bx = 0, by = 0; const n = MAU.p.length;
      for (let oy = 0; oy + MAU.H <= V.H; oy++) for (let ox = 0; ox + MAU.W <= V.W; ox++) { let s1 = 0, s2 = 0;
        for (let j = 0; j < MAU.H; j++) { const r = (oy + j) * V.W + ox; for (let i = 0; i < MAU.W; i++) { const v = V.p[r + i]; s1 += v; s2 += v * v; } }
        const mean = s1 / n, sd = Math.sqrt(Math.max(1e-6, s2 - n * mean * mean)); let c = 0;
        for (let j = 0; j < MAU.H; j++) { const r = (oy + j) * V.W + ox, rm = j * MAU.W; for (let i = 0; i < MAU.W; i++) c += MAU.p[rm + i] * (V.p[r + i] - mean); }
        c /= MAU.sd * sd; if (c > best) { best = c; bx = ox; by = oy; } }
      return { diem: best, lech: [Math.round(sx + bx * HS - x), Math.round(sy + by * HS - y)] }; };
    const oDoi = (p, q) => { const o = new Array(9).fill(0); for (let i = 0; i < 4096; i++) o[Math.min(2, Math.floor((i >> 6) / 21.34)) * 3 + Math.min(2, Math.floor((i & 63) / 21.34))] += Math.abs(p[i] - q[i]); return o.map((v) => v / 455); };
    const TEN9 = ["trên-trái", "trên-giữa", "trên-phải", "giữa-trái", "chính giữa", "giữa-phải", "dưới-trái", "dưới-giữa", "dưới-phải"];
    const do1 = async (k) => { const g = await xam(k.f, [x, y, w, h]); const o = oDoi(R.roi, g); const nh = o.indexOf(Math.max(...o)); const tren8 = o.filter((v) => v > 15).length;
      const m = await ncc(k.f); return { ...k, d: chenh(R.roi, g), sang: await doiSang(k.f), oNhieu: TEN9[nh] + " " + o[nh].toFixed(0), soO: tren8, khop: m.diem, lech: m.lech }; };
    const VANG = (k) => k.khop < 0.65, TIN = (k) => k.sang <= 25 || k.khop >= 0.7;   // đêm/đổi sáng mà vẫn khớp mẫu ≥0,7 thì vẫn tin là CÓ
    const bang = [{ ...chuan, d: 0, sang: 0 }]; const ghi = (k, nhan) => console.log("  " + vn(k.ms).replace("T", " ") + "  vùng " + k.d.toFixed(1).padStart(5) + "  ngoài " + k.sang.toFixed(1).padStart(5) + (k.khop != null ? "  khớp mẫu " + k.khop.toFixed(2) + (k.lech && (Math.abs(k.lech[0]) + Math.abs(k.lech[1]) > 8) ? " (lệch " + k.lech.join(",") + " px)" : "") : "") + "  " + nhan + (k.oNhieu ? "  · đổi nhiều nhất " + k.oNhieu + " · " + k.soO + "/9 ô đổi >15" : ""));
    console.log("TÌM MỐC kênh " + a[0] + " vùng [" + a[1] + "] · CÓ lúc " + vn(tCo).replace("T", " ") + " (khớp mẫu ≥0,65 = CÓ đúng trạng thái lúc chụp (kể cả xê dịch) · 0,45–0,65 = khác trạng thái · ≤0,45 = VẮNG; ngoài >25 = đổi sáng)");
    let co = { ...chuan, d: 0 }, vang = null;
    for (const lui of [0.5, 1, 2, 4, 8, 16, 24, 48, 72, 96].map((hh) => hh * 36e5)) { const t = tCo - lui; if (t < tXa) break;
      const k0 = layKhung(t); if (!k0) { console.log("  " + vn(t).replace("T", " ") + "  (không có hình)"); continue; }
      const k = await do1(k0); bang.push(k); const vg = VANG(k) && TIN(k); ghi(k, !TIN(k) ? "đổi sáng — bỏ qua" : vg ? (k.khop > 0.45 ? "KHÁC TRẠNG THÁI (giống một phần — vật có thể đã có nhưng ở tư thế/vị trí khác)" : "VẮNG") : (k.d > 15 ? "CÓ nhưng bị xô/che một phần" : "CÓ (giống chuẩn)"));
      if (!TIN(k)) continue; if (vg) { vang = k; break; } co = k; }
    if (!vang) { console.log("KẾT QUẢ: đồ vật CÓ từ trước " + vn(co.ms).replace("T", " ") + " (mốc xa nhất đã lùi) — chưa tìm được lúc xuất hiện."); }
    else { let lan = 0;
      /* đêm/đèn tắt (camera hồng ngoại) → khung giữa «đổi sáng»: thử lệch về 2 phía (¼ ¾ ⅛ ⅞ …) để tìm khung ban ngày trong khoảng */
      const PH = [0.5, 0.25, 0.75, 0.125, 0.875, 0.0625, 0.9375, 0.03, 0.97];
      while (co.ms - vang.ms > 120e3 && lan++ < 20) { let xong = false;
        for (const p of PH) { const k0 = layKhung(Math.round(vang.ms + (co.ms - vang.ms) * p)); if (!k0 || k0.ms <= vang.ms || k0.ms >= co.ms) continue;
          const k = await do1(k0); bang.push(k); if (!TIN(k)) { ghi(k, "đổi sáng — thử điểm khác"); continue; }
          if (VANG(k)) { vang = k; ghi(k, k.khop > 0.45 ? "KHÁC TRẠNG THÁI (giống một phần)" : "VẮNG"); } else { co = k; ghi(k, k.d > 15 ? "CÓ nhưng bị xô/che một phần" : "CÓ"); } xong = true; break; }
        if (!xong) { console.log("  (cả khoảng còn lại đều đổi sáng/không có hình — dừng chia)"); break; } }
      console.log("KẾT QUẢ: đồ vật ở ĐÚNG trạng thái lúc chụp bắt đầu trong khoảng " + vn(vang.ms).replace("T", " ") + " → " + vn(co.ms).replace("T", " ") + " (kênh " + a[0] + ")."); console.log("Bước tiếp: cat-doan quanh khoảng này rồi khung từng 1–2 s để soi người tác động. Nếu chỉ 1–2/9 ô đổi ở MÉP vùng → có thể là vật bên cạnh lấn vào, thu vùng sát đồ vật rồi chạy lại."); }
    const moc = [vang, co, chuan].filter(Boolean); const W = Math.min(420, w * 2), H = Math.round(h * W / w); const comp = [];
    for (const [i, k] of moc.entries()) { const g = await S(k.f).resize(1280, 720, { fit: "fill" }).toBuffer();
      comp.push({ input: await S(await S(g).extract({ left: x, top: y, width: w, height: h }).toBuffer()).resize(W, H).toBuffer(), left: i * (W + 8), top: 28 },
        { input: Buffer.from(`<svg width="${W}" height="26"><rect width="${W}" height="26" fill="black"/><text x="4" y="19" font-size="15" fill="yellow" font-family="Arial">${vn(k.ms).replace("T", " ")} ${i === 0 && vang ? (vang.khop > 0.45 ? "KHÁC " : "VẮNG ") + vang.khop.toFixed(2) : "CÓ" + (k.khop != null ? " " + k.khop.toFixed(2) : "")}</text></svg>`), left: i * (W + 8), top: 0 }); }
    const anh = path.join(D, "MOC.jpg"); await S({ create: { width: moc.length * (W + 8), height: H + 28, channels: 3, background: "#000" } }).composite(comp).jpeg({ quality: 88 }).toFile(anh);
    fs.writeFileSync(path.join(D, "ket-qua.json"), JSON.stringify({ kenh: a[0], vung: [x, y, w, h], co: chuan.ms, vang: vang && vn(vang.ms), coSom: vn(co.ms), bang: bang.map((k) => ({ gio: vn(k.ms), d: +k.d.toFixed(1), sang: +k.sang.toFixed(1), khop: k.khop != null ? +k.khop.toFixed(2) : 1 })) }, null, 1));
    console.log("✓ ảnh mốc:", anh); break; }
  case "luoi-goc": {   /* luoi-goc <dãy vd 506 | ip/kênh,ip/kênh…> <giờ ISO> [lệch giây, mặc định -6,0,+6] → mọi kênh cùng dãy × 3 thời điểm ghép 1 tấm (soi AI ĐANG TÁC ĐỘNG ở góc nào) */
    const S = await sharp(); const TK = docJ("ban-do-camera-o.json").tenKenh || {}; const q = String(a[0]);
    const kenh = q.includes("/") ? q.split(",") : Object.entries(TK).filter(([k, v]) => !k.startsWith("_") && k !== "dauGhi" && String(v).includes(q)).map(([k]) => k);
    const t0 = Date.parse(String(a[1]).replace(" ", "T") + (String(a[1]).length <= 19 ? "+07:00" : "")); const lech = (a[2] || "-6,0,6").split(",").map(Number);
    const vungK1 = (a.find((v) => String(v).startsWith("vung=")) || "").slice(5).split(",").map(Number);   // 09/10: khung vàng đồ vật trên hàng kênh ĐẦU
    const vn = (ms) => new Date(ms + 7 * 36e5).toISOString().slice(0, 19); const D = path.join(OUT, "goc_" + q.replace(/[^\w]/g, "") + "_" + vn(t0).replace(/[-:T]/g, "").slice(4, 12)); fs.mkdirSync(D, { recursive: true });
    const comp = []; let hang = 0;
    for (const k of kenh) { const [host, ch] = k.split("/"); const f = path.join(D, "k" + ch); const bd = t0 + Math.min(...lech) * 1000 - 2000;
      spawnSync(process.execPath, ["_cat-doan.mjs", host, ch, vn(bd), String(Math.max(...lech) - Math.min(...lech) + 5), f + ".mp4"], { cwd: HASAKI, timeout: 180e3 });
      if (!fs.existsSync(f + ".mp4")) { console.log("  " + k + " " + (TK[k] || "") + ": không có hình"); continue; }
      spawnSync(process.execPath, ["_khung.mjs", f + ".mp4", f, ...lech.map((l) => String((t0 + l * 1000 - bd) / 1000))], { cwd: HASAKI, timeout: 180e3, env: { ...process.env, DON: "1" } });
      for (const [j] of lech.entries()) { const fj = f + "_f" + j + ".jpg"; if (!fs.existsSync(fj)) continue; let g = await S(fj).resize(1280, 720, { fit: "fill" }).toBuffer();
        if (hang === 0 && vungK1.length === 4) g = await S(g).composite([{ input: Buffer.from(`<svg width="1280" height="720"><rect x="${vungK1[0]}" y="${vungK1[1]}" width="${vungK1[2]}" height="${vungK1[3]}" fill="none" stroke="#ffd400" stroke-width="8"/></svg>`), left: 0, top: 0 }]).toBuffer();
        comp.push({ input: await S(g).resize(480, 270).toBuffer(), left: j * 484, top: hang * 300 + 26 }); }
      comp.push({ input: Buffer.from(`<svg width="${lech.length * 484}" height="24"><rect width="100%" height="24" fill="black"/><text x="4" y="18" font-size="16" fill="yellow" font-family="Arial">${k} ${String(TK[k] || "").replace(/[<&]/g, "")} · ${lech.map((l) => (l >= 0 ? "+" : "") + l + "s").join(" | ")}</text></svg>`), left: 0, top: hang * 300 });
      hang++; }
    const ra = path.join(D, "LUOI-GOC.jpg"); await S({ create: { width: lech.length * 484, height: Math.max(1, hang) * 300, channels: 3, background: "#000" } }).composite(comp).jpeg({ quality: 82 }).toFile(ra);
    console.log("✓ " + hang + " kênh × " + lech.length + " thời điểm →", ra); break; }
  case "nguoi": {   /* nguoi <video.mp4> [giây,…] → dò NGƯỜI (COCO-SSD, không nhận mặt) ở các giây → toạ độ khung người (1280×720). Dùng: người kiểm đứng đâu lúc chụp. */
    const f = raTep(a[0]); const ts = (a[1] || "0,3").split(",").map(Number); const ra = path.join(OUT, path.basename(f).replace(/\.\w+$/, "") + "_nguoi.json");
    const cfg = path.join(OUT, "_cfg_nguoi.json"); fs.writeFileSync(cfg, JSON.stringify({ doan: [{ file: f, batDau: "00:00:00" }], vung: [0, 0, 1280, 720], buoc: Math.max(1, (ts[1] || 3) - ts[0]), noi: 0, ra }));
    spawnSync(process.execPath, ["_nguoi-trong-vung.mjs", cfg], { cwd: HASAKI, timeout: 600e3, stdio: "ignore" });
    let kq = []; try { kq = JSON.parse(fs.readFileSync(ra, "utf8")); } catch { }
    for (const x of kq.filter((x) => ts.some((t) => Math.abs(x.t - t) < 0.6))) console.log("  giây " + x.t + ": " + (x.nguoi.length ? x.nguoi.map((n) => "người [" + n.slice(0, 4).join(",") + "] điểm " + n[4]).join(" · ") : "không thấy người"));
    if (!kq.length) console.log("  ✗ không dò được (video hỏng?)"); break; }
  case "kiem-vung": {   /* 09/10 QC vòng 5 (14081920: vùng tầng 2–3 gần camera trong khi người kiểm ngồi xổm cuối lối với tay vào tầng 01) — KIỂM TẤT ĐỊNH:
       kiem-vung <video lúc chụp> <x,y,w,h> [mã ô] → dò người kiểm (COCO) ở giây 0 và 3 → TẦM VỚI = khung người nới 1,5×rộng mỗi bên, 0,6×cao trên/dưới.
       Tâm vùng phải nằm trong tầm với của ÍT NHẤT 1 người; tầng 01–02 → tâm vùng không được cao hơn đỉnh đầu người; tầng ≥20 → không thấp hơn vai. */
    const f = raTep(a[0]); const [x, y, w, h] = String(a[1]).split(",").map(Number); const cx = x + w / 2, cy = y + h / 2; const tang = Number(String(a[2] || "").split("-")[4] || 0);
    const ra = path.join(OUT, path.basename(f).replace(/\.\w+$/, "") + "_nguoi.json");
    if (!fs.existsSync(ra)) { const cfg = path.join(OUT, "_cfg_nguoi.json"); fs.writeFileSync(cfg, JSON.stringify({ doan: [{ file: f, batDau: "00:00:00" }], vung: [0, 0, 1280, 720], buoc: 3, noi: 0, ra })); spawnSync(process.execPath, ["_nguoi-trong-vung.mjs", cfg], { cwd: HASAKI, timeout: 600e3, stdio: "ignore" }); }
    let kq = []; try { kq = JSON.parse(fs.readFileSync(ra, "utf8")); } catch { }
    let ng = kq.filter((q) => q.t <= 10.5).flatMap((q) => q.nguoi).filter((n) => n[4] >= 0.3 && n[3] < 420 && n[2] < 400);
    /* 09/10 QC v3 14081940: vùng tầng 20 lọt kiểm nhờ NGƯỜI KHÁC đứng thấp ⇒ nguoi=x,y,w,h: chỉ kiểm theo đúng người chụp */
    const chiNguoi = (a.find((v) => String(v).startsWith("nguoi=")) || "").slice(6).split(",").map(Number);
    if (chiNguoi.length === 4) ng = [[...chiNguoi, 1]];
    if (!ng.length) { console.log("KIỂM VÙNG: KHÔNG RÕ — không dò thấy người kiểm trong video lúc chụp (thử kênh khác hoặc video khác giờ ±10 s)."); break; }
    let hop = false; for (const [px, py, pw, ph, d] of ng) { const tx = px - 2 * pw, ty = py - 0.6 * ph, tw = pw * 5, th = ph * 2.2;
      const trong = cx >= tx && cx <= tx + tw && cy >= ty && cy <= ty + th;
      const caoOk = !tang ? true : tang <= 2 ? cy >= py : tang >= 20 ? cy <= py + ph * 0.35 : true;
      console.log("  người [" + [px, py, pw, ph].join(",") + "] điểm " + d + " → tầm với [" + [tx, ty, tw, th].map(Math.round).join(",") + "] · tâm vùng (" + Math.round(cx) + "," + Math.round(cy) + ") " + (trong ? "TRONG" : "NGOÀI") + " tầm với" + (tang ? " · độ cao so tầng " + tang + ": " + (caoOk ? "hợp" : "KHÔNG hợp") : ""));
      if (trong && caoOk) hop = true; }
    if (hop) { const fk = path.join(OUT, "kiem-vung-dat.json"); let dsk = []; try { dsk = JSON.parse(fs.readFileSync(fk, "utf8")); } catch { } dsk.push(String(a[1])); fs.writeFileSync(fk, JSON.stringify([...new Set(dsk)])); }
    console.log(hop ? "KIỂM VÙNG: ĐẠT — vùng nằm trong tầm với người kiểm lúc chụp." : "KIỂM VÙNG: SAI — vùng KHÔNG nằm trong tầm với người kiểm. Đặt lại vùng sát chỗ người kiểm với tay/chĩa điện thoại (và đúng độ cao tầng)."); break; }
  case "de-xuat-vung": {   // de-xuat-vung <khoá ô|loại> <ip/kênh> <x,y,w,h> <mô tả…> → ghi .exports/agy-xm/DE-XUAT-VUNG.json CHỜ USER DUYỆT (không đụng ban-do-camera-o.json)
    const f = path.join(OUT, "DE-XUAT-VUNG.json"); let ds = []; try { ds = JSON.parse(fs.readFileSync(f, "utf8")); } catch { }
    ds.push({ khoa: a[0], kenh: a[1], khung: String(a[2] || "").split(",").map(Number), moTa: a.slice(3).join(" "), luc: new Date().toISOString(), trangThai: "cho-duyet" });
    fs.writeFileSync(f, JSON.stringify(ds, null, 1)); console.log("✓ đã ghi đề xuất vùng (chờ user duyệt) →", f); break; }
  case "help": console.log(fs.readFileSync(SELF, "utf8").split("*/")[0]); break;
  case "ds": {   // 09/10: liệt kê tệp trong .exports/agy-xm (agy từng gõ `dir` → bị chặn → hỏng cả lượt)
    const q = String(a[0] || "").toLowerCase(); const extra = a[1] ? path.join(HASAKI, ".exports", a[1]) : OUT;
    for (const f of fs.readdirSync(extra).filter((x) => x.toLowerCase().includes(q)).sort()) { const st = fs.statSync(path.join(extra, f)); console.log((st.size / 1024).toFixed(0).padStart(7) + " KB  " + path.join(extra, f)); }
    break; }
  case "so-sanh": {   // 09/10 QC vòng 1: cắt CÙNG vùng x,y,w,h ở nhiều khung, ghép NGANG có nhãn tên tệp → <tên>.jpg. Bắt buộc trước khi nói «có / vắng / đổi».
    const S = await sharp(); const [x, y, w, h] = a[0].split(",").map(Number); const ds = a.slice(1).filter((s) => !s.startsWith("ra=")); const ten = (a.find((s) => s.startsWith("ra=")) || "ra=SO-SANH.jpg").slice(3);
    const k = Math.min(3, 420 / w), W = Math.round(w * k), H = Math.round(h * k); const comp = [];
    for (const [i, f] of ds.entries()) { const g = await S(raTep(f)).resize(1280, 720, { fit: "fill" }).toBuffer();
      comp.push({ input: await S(await S(g).extract({ left: x, top: y, width: w, height: h }).toBuffer()).resize(W, H).toBuffer(), left: i * (W + 8), top: 28 },
        { input: Buffer.from(`<svg width="${W}" height="26"><rect width="${W}" height="26" fill="black"/><text x="4" y="19" font-size="15" fill="yellow" font-family="Arial">${path.basename(f).replace(/[<&]/g, "")}</text></svg>`), left: i * (W + 8), top: 0 }); }
    const ra = raTep(ten); await S({ create: { width: ds.length * (W + 8), height: H + 28, channels: 3, background: "#000" } }).composite(comp).jpeg({ quality: 88 }).toFile(ra); console.log("✓", ra);
    /* 09/10 QC vòng 3 (14081936: agy nói «13:36 chưa có tấm bìa» khi ảnh cho thấy ĐÃ có) → in SỐ đo tất định: chênh xám trung bình vùng giữa các khung
       (0 = y hệt; <8 coi như KHÔNG đổi; >15 đổi rõ) + ô lưới 4×4 đổi nhiều nhất ⇒ biết phần NÀO của vùng đổi, không chỉ «có đổi». */
    const xam = async (f) => { const g = await S(raTep(f)).resize(1280, 720, { fit: "fill" }).toBuffer(); return new Uint8Array(await S(await S(g).extract({ left: x, top: y, width: w, height: h }).toBuffer()).resize(64, 64, { fit: "fill" }).grayscale().raw().toBuffer()); };
    const X = []; for (const f of ds) X.push(await xam(f));
    const chenh = (p, q) => { let s = 0; const o = new Array(16).fill(0); for (let i = 0; i < 4096; i++) { const d = Math.abs(p[i] - q[i]); s += d; o[((i >> 6) >> 4) * 4 + ((i & 63) >> 4)] += d; } return { tb: s / 4096, o: o.map((v) => v / 256) }; };
    const viTri = (k) => ["trên", "trên", "dưới", "dưới"][k >> 2].replace(/^/, "") + "-" + ["trái", "giữa trái", "giữa phải", "phải"][k & 3];
    console.log("SỐ ĐO VÙNG [" + a[0] + "] (chênh xám TB 0–255; <8 = KHÔNG đổi · 8–15 = đổi nhẹ · >15 = đổi rõ):");
    for (let i = 1; i < X.length; i++) { const c = chenh(X[i - 1], X[i]), c0 = chenh(X[0], X[i]); const k = c.o.indexOf(Math.max(...c.o));
      console.log("  " + path.basename(ds[i - 1]) + " → " + path.basename(ds[i]) + ": " + c.tb.toFixed(1) + (c.tb < 8 ? " KHÔNG đổi" : c.tb > 15 ? " ĐỔI RÕ" : " đổi nhẹ") + " · đổi nhiều nhất ô " + viTri(k) + " (" + c.o[k].toFixed(0) + ")" + (i > 1 ? " · so khung đầu: " + c0.tb.toFixed(1) : "")); }
    break; }
  default: console.log("✗ lệnh không có trong cổng chỉ-đọc:", lenh); process.exit(2);
}
