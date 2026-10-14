/* 09/10/2026 — XÁC MINH 5S BẰNG CAMERA, MÁY CHẠY TẤT ĐỊNH, CHỈ GỌI GEMINI 3 CÂU HỎI NHÌN HẸP (user duyệt 09/10: «phải thực sự cần mới gọi Gemini để tiết kiệm hạn mức»).
 *  node xac-minh-tu-dong.mjs <id> [<id>…] [--model=gemini-3.5-flash] [--ra=thư mục]
 *  Không ghi gì lên phiếu. Dùng khoá GEMINI_API_KEY trong .env (KHÔNG tốn hạn mức agy). Công cụ camera qua cổng chỉ-đọc C:\Users\lechitam\agy-xm.mjs.
 *  Lộ trình (máy = tất định · G = Gemini):
 *   1 máy  đọc phiếu (board cache), luật, cò B1 (ứng viên WMS), phiếu cùng tủ, giải nghĩa ô
 *   2 G1   ảnh vi phạm → đồ vật + chữ/mã đọc được
 *   3 máy  mọi kênh cùng dãy: tải 10 s lúc chụp (tự lệch giờ) → dò người (COCO) → kênh có người
 *   4 G2   khung kênh có người (đánh số người P1.., lưới ô 80 px A1..P9) + ảnh vi phạm → người kiểm là P nào, ô nào chứa đồ vật
 *   5 máy  vùng = các ô G2 chọn → kiem-vung (tầm với người kiểm + độ cao tầng) — SAI thì thử kênh kế
 *   6 máy  tim-moc (so khớp mẫu, chia đôi ≤2′)
 *   7 G3   luoi-goc mọi kênh cùng dãy trong khoảng VẮNG→CÓ → có ai đang đặt/chạm đồ vật không, ở khung nào, mặc gì
 *   8 máy  wms-o ±10′ + cò B1 → lệnh khớp ≤3′ → tên tài khoản
 *   9 máy  kết luận + ĐỘ CHẮC theo tiêu chí; báo cáo đúng MẪU (cham-agy-xm.mjs chấm được) */
import "dotenv/config"; import fs from "node:fs"; import path from "node:path"; import { spawnSync } from "node:child_process"; import { fileURLToPath } from "node:url";
import sharp from "sharp";
const DIR = path.dirname(fileURLToPath(import.meta.url)); process.chdir(DIR);
try { spawnSync(process.execPath, ["don-clip.mjs", "--im"], { cwd: DIR, windowsHide: true, timeout: 120000 }); } catch { }  /* 13/10: van don dia (PC xoa-ngay, laptop no-op) */
const A = process.argv.slice(2); const IDS = A.filter((x) => /^\d{6,}$/.test(x));
const opt = (k, d) => (A.find((x) => x.startsWith("--" + k + "=")) || "").split("=").slice(1).join("=") || d;
const RA = opt("ra", path.join(DIR, ".exports", "xm-tu-dong")); const CONG = "C:\\Users\\lechitam\\agy-xm.mjs"; const XM = path.join(DIR, ".exports", "agy-xm");
const CHUOI = [...new Set([opt("model", "gemini-3.1-flash-lite"), "gemini-3.5-flash-lite"])];   // câu dễ: Flash Lite 500 lượt/ngày (3.5 lite đã bị chấm ảnh vệ sinh dùng 350)   // 09/10: 2.5 đã ngừng cho người dùng mới (404)
const KEY = process.env.GEMINI_API_KEY;
/* 13/10 (user: «gọi API cho cả, mà không phải cài»): tầng Claude dự phòng gọi THẲNG API Anthropic (KHÔNG cần cài agy) —
   PC chỉ cần ANTHROPIC_API_KEY trong .env là chạy được dù laptop tắt. agy vẫn giữ làm lớp cuối (laptop không có khoá API). */
const CLAUDE_KEY = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || "";
const CLAUDE_MODEL = process.env.XM_CLAUDE_MODEL || "claude-sonnet-5-5";
/* 09/10: câu hỏi NHÌN KHÓ (khung bao đồ vật, nhận người) dùng mô hình mạnh — thử tay: 3-flash-preview đúng, 3.5-flash-lite sai; câu dễ (tả đồ vật, chọn người chụp) dùng chuỗi rẻ */
const MOHINH_MANH = ["gemini-3-flash-preview", "gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash"];   // bảng hạn mức 09/10: mỗi model 20 lượt/ngày, 5/phút; hết → agy (xem cuối hoiGemini)
const log = (...a) => console.log(new Date().toTimeString().slice(0, 8), ...a);
const vn = (ms) => new Date(ms + 7 * 36e5).toISOString().slice(0, 19).replace("T", " ");
const msOf = (s) => Date.parse(String(s).replace(" ", "T") + "+07:00");
const cong = (...a) => { const r = spawnSync(process.execPath, [CONG, ...a.map(String)], { cwd: DIR, encoding: "utf8", timeout: 40 * 60e3, maxBuffer: 64 << 20 }); return (r.stdout || "") + (r.stderr || ""); };
const docJ = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };
let soGoiGemini = 0, tokenGemini = 0;

/* ---------- Claude qua API Anthropic (dự phòng khi Gemini API hết hạn mức; KHÔNG cần cài agy) ----------
   Ép JSON đúng schema bằng tool_use (tool_choice bắt buộc) — cùng schema đang truyền cho Gemini. Ảnh base64 như Gemini. */
async function hoiClaudeAPI(cauHoi, anh, schema) {
  if (!CLAUDE_KEY) throw new Error("thiếu ANTHROPIC_API_KEY");
  const content = [{ type: "text", text: cauHoi }];
  for (const a of anh) {
    if (a.chu) content.push({ type: "text", text: a.chu });
    const data = (await sharp(a.f).resize({ width: a.rong || 1280, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer()).toString("base64");
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } });
  }
  const ten = "tra_loi";
  const body = { model: CLAUDE_MODEL, max_tokens: 1024,
    tools: [{ name: ten, description: "Trả về kết quả đúng schema", input_schema: schema }],
    tool_choice: { type: "tool", name: ten },
    messages: [{ role: "user", content }] };
  for (let lan = 0; lan < 3; lan++) {
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST",
      headers: { "x-api-key": CLAUDE_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify(body), signal: AbortSignal.timeout(120000) }).catch((e) => ({ ok: false, status: 0, text: async () => String(e) }));
    if (r.status === 429 || r.status === 529 || r.status === 0) { await new Promise((ok) => setTimeout(ok, 8000 * (lan + 1))); continue; }   // nghẽn/quá tải → chờ rồi thử lại
    if (!r.ok) throw new Error("HTTP " + r.status + " " + String(await r.text()).slice(0, 160));
    const j = await r.json();
    const tu = (j.content || []).find((c) => c.type === "tool_use");
    if (!tu || !tu.input) throw new Error("không có tool_use trong phản hồi");
    const k = tu.input;
    if (typeof k.tin_cay === "number" && k.tin_cay <= 1) k.tin_cay = Math.round(k.tin_cay * 100);
    tokenGemini += (j.usage?.input_tokens || 0) + (j.usage?.output_tokens || 0);
    return k;
  }
  throw new Error("Claude API nghẽn (429/529) sau 3 lần");
}

/* ---------- Gemini: 1 câu hỏi hẹp, ảnh inline, JSON schema, chuỗi model dự phòng ---------- */
async function hoiGemini(cauHoi, anh, schema, chuoi = CHUOI, agyThuTu = ["gemini-3.8-flash-low", "gemini-3.7-flash-low", "gemini-3.6-flash-low", "claude-sonnet-5-5-low"]) {
  if (!KEY) throw new Error("thiếu GEMINI_API_KEY");
  const parts = [{ text: cauHoi }];
  for (const a of anh) { if (a.chu) parts.push({ text: a.chu }); parts.push({ inlineData: { mimeType: "image/jpeg", data: (await sharp(a.f).resize({ width: a.rong || 1280, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer()).toString("base64") } }); }
  for (const model of (process.env.XM_BO_API === "1" ? [] : chuoi)) for (let lan = 0; lan < 4; lan++) {   // XM_BO_API=1: thử thẳng nhánh agy
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + KEY, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.1, maxOutputTokens: 2048 } }), signal: AbortSignal.timeout(120000) }).catch((e) => ({ ok: false, status: 0, text: async () => String(e) }));
    if (r.status === 429) { const t = await r.text(); if (/PerDay|per day|daily/i.test(t) || lan >= 3) break; await new Promise((ok) => setTimeout(ok, 20000 * (lan + 1))); continue; }   // 429 theo PHÚT → chờ rồi thử lại; chỉ bỏ model khi hết hạn mức NGÀY
    if (r.status === 503 || r.status === 0) { await new Promise((ok) => setTimeout(ok, 8000)); continue; }
    if (!r.ok) break;   // 404 model ngừng → model kế
    const j = await r.json(); soGoiGemini++; tokenGemini += j.usageMetadata?.totalTokenCount || 0;
    { const fSo = path.join(DIR, ".exports", "xm-dem-goi.json"); const so = docJ(fSo, {}); const ngay = vn(Date.now()).slice(0, 10); so[ngay] = so[ngay] || {}; so[ngay]["api:" + model] = (so[ngay]["api:" + model] || 0) + 1; fs.writeFileSync(fSo, JSON.stringify(so, null, 1)); }
    const txt = (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join(""); try { const k = JSON.parse(txt); if (typeof k.tin_cay === "number" && k.tin_cay <= 1) k.tin_cay = Math.round(k.tin_cay * 100); return { model, ...k }; } catch { continue; }   // tin_cay lúc 0–1 lúc 0–100
  }
  // Gemini API hết hạn mức -> gọi THẲNG API Anthropic (Claude). KHÔNG cần cài agy: PC có ANTHROPIC_API_KEY là chạy được dù laptop tắt.
  if (CLAUDE_KEY && process.env.XM_BO_CLAUDE_API !== "1") {
    try {
      const k = await hoiClaudeAPI(cauHoi, anh, schema); soGoiGemini++;
      const fSo = path.join(DIR, ".exports", "xm-dem-goi.json"); const so = docJ(fSo, {}); const ngay = vn(Date.now()).slice(0, 10); so[ngay] = so[ngay] || {}; so[ngay]["api:" + CLAUDE_MODEL] = (so[ngay]["api:" + CLAUDE_MODEL] || 0) + 1; try { fs.writeFileSync(fSo, JSON.stringify(so, null, 1)); } catch { }
      return { model: "api:" + CLAUDE_MODEL, ...k };
    } catch (e) { log("   Claude API: " + String(e.message).slice(0, 140) + " -> thử agy"); }
  }
  /* 09/10 (user: «cho phép Claude tham gia CÓ GIỚI HẠN sau khi Gemini hết lượt») — DỰ PHÒNG QUA agy (gói Pro, KHÔNG phải khoá API):
     ① agy Gemini 3.8/3.7/3.6 Flash (hạn mức tuần gói Pro) → ② agy Claude Sonnet 5.5, trần AGY_CLAUDE_TOI_DA lượt/ngày (mặc định 20).
     Câu hỏi hẹp, ảnh chép vào C:/Users/lechitam/agy-hoi/anh (thư mục trống: không nạp skill/luật) — thử tay: đúng, ~10–26k token/lần. */
  const AGY = path.join(process.env.LOCALAPPDATA || "C:/Users/lechitam/AppData/Local", "agy", "bin", "agy.exe"), WSH = "C:/Users/lechitam/agy-hoi";
  const fSo = path.join(DIR, ".exports", "xm-dem-goi.json"); const so = docJ(fSo, {}); const ngay = vn(Date.now()).slice(0, 10); so[ngay] = so[ngay] || {};
  const TRAN_CLAUDE = Number(process.env.AGY_CLAUDE_TOI_DA || 20);
  const duongAnh = []; fs.mkdirSync(path.join(WSH, "anh"), { recursive: true });
  for (const [i, a] of anh.entries()) { const p = path.join(WSH, "anh", Date.now() + "_" + i + ".jpg"); await sharp(a.f).resize({ width: a.rong || 1280, withoutEnlargement: true }).jpeg({ quality: 85 }).toFile(p); /* giữ đúng độ phân giải câu hỏi yêu cầu (ảnh ghép góc 2400 px) */ duongAnh.push((a.chu || "Ảnh " + (i + 1) + ":") + " " + p); }
  const khoa = Object.keys(schema.properties || {}).join(", ");
  const de = cauHoi + "\nMở và xem các ảnh theo đường dẫn: " + duongAnh.join(" · ") + "\nChỉ trả về MỘT đối tượng JSON với các khoá: " + khoa + ". Không chạy lệnh nào, chỉ xem ảnh.";
  for (const m of agyThuTu) {
    if (/claude/.test(m) && (so[ngay][m] || 0) >= TRAN_CLAUDE) { log("   Claude đã dùng " + so[ngay][m] + "/" + TRAN_CLAUDE + " lượt hôm nay — không gọi thêm"); continue; }
    const r = spawnSync(AGY, ["-p", de, "--model", m, "--output-format", "json", "--print-timeout", "300s"], { cwd: WSH, encoding: "utf8", timeout: 6 * 60e3, windowsHide: true, maxBuffer: 16 << 20 });
    const out = (r.stdout || "").trim().split(String.fromCharCode(10)).pop().trim(); let j = null; try { j = JSON.parse(out); } catch { }
    if (!j || j.status !== "SUCCESS") { log("   agy " + m + ": " + String(j?.error || out || r.stderr || "").slice(0, 120)); continue; }
    const t = String(j.response || "").replace(/^[\s\S]*?\{/, "{").replace(/\}[^}]*$/, "}"); let k; try { k = JSON.parse(t); } catch { continue; }
    for (const [kk, dn] of Object.entries(schema.properties || {})) {   // agy không ép kiểu như API → chuẩn hoá theo schema
      if (dn.type === "array" && !Array.isArray(k[kk])) k[kk] = k[kk] == null || k[kk] === "" ? [] : String(k[kk]).split(/[,;]/).map((v) => v.trim()).filter(Boolean).map((v) => dn.items?.type === "integer" ? Number(v.replace(/[^0-9.-]/g, "")) : v);
      if (dn.type === "integer" && typeof k[kk] !== "number") k[kk] = Number(String(k[kk] ?? "").replace(/[^0-9.-]/g, "")) || 0;
      if (dn.type === "boolean" && typeof k[kk] !== "boolean") k[kk] = /true|có|yes/i.test(String(k[kk])); }
    if (typeof k.tin_cay === "number" && k.tin_cay <= 1) k.tin_cay = Math.round(k.tin_cay * 100);
    so[ngay][m] = (so[ngay][m] || 0) + 1; fs.writeFileSync(fSo, JSON.stringify(so, null, 1)); soGoiGemini++; tokenGemini += j.usage?.total_tokens || 0;
    for (const p of duongAnh) try { fs.unlinkSync(p.split(" ").pop()); } catch { }
    return { model: "agy:" + m, ...k };
  }
  throw new Error("Không nguồn AI nào trả lời được (API Gemini + agy Gemini + agy Claude đều hết/lỗi)");
}

/* ---------- vẽ lưới ô 80 px (A..P × 1..9) + khung người đánh số ---------- */
const COT = "ABCDEFGHIJKLMNOP";
async function veLuoiNguoi(f, nguoi, ra) {
  let s = '<svg width="1280" height="720">';
  for (let c = 0; c < 16; c++) for (let r = 0; r < 9; r++) s += `<rect x="${c * 80}" y="${r * 80}" width="80" height="80" fill="none" stroke="#00e5ff" stroke-opacity="0.55"/><text x="${c * 80 + 3}" y="${r * 80 + 14}" font-size="13" font-family="Arial" fill="#00e5ff">${COT[c]}${r + 1}</text>`;
  nguoi.forEach((n, i) => { s += `<rect x="${n[0]}" y="${n[1]}" width="${n[2]}" height="${n[3]}" fill="none" stroke="#ff2a2a" stroke-width="4"/><rect x="${n[0]}" y="${Math.max(0, n[1] - 26)}" width="40" height="24" fill="#ff2a2a"/><text x="${n[0] + 5}" y="${Math.max(18, n[1] - 8)}" font-size="18" font-weight="bold" font-family="Arial" fill="#fff">P${i + 1}</text>`; });
  await sharp(await sharp(f).resize(1280, 720, { fit: "fill" }).toBuffer()).composite([{ input: Buffer.from(s + "</svg>"), left: 0, top: 0 }]).jpeg({ quality: 85 }).toFile(ra); return ra;
}
const oSangVung = (ds) => { const xy = ds.map((o) => ({ c: COT.indexOf(String(o)[0].toUpperCase()), r: Number(String(o).slice(1)) - 1 })).filter((p) => p.c >= 0 && p.r >= 0 && p.r < 9);
  if (!xy.length) return null; const x0 = Math.min(...xy.map((p) => p.c)), x1 = Math.max(...xy.map((p) => p.c)), y0 = Math.min(...xy.map((p) => p.r)), y1 = Math.max(...xy.map((p) => p.r));
  return [x0 * 80, y0 * 80, (x1 - x0 + 1) * 80, (y1 - y0 + 1) * 80]; };

/* ---------- 1 phiếu ---------- */
async function xacMinh(id) {
  const OUT = path.join(RA, id); fs.mkdirSync(OUT, { recursive: true }); const nk = []; const ghiNk = (s) => { nk.push(s); log("  " + s); };
  const t0 = Date.now(); soGoiGemini = 0; tokenGemini = 0;
  /* 1 */
  const fb = fs.readdirSync(path.join(DIR, ".exports")).filter((f) => /^board591-live-\d{4}\.json$/.test(f)).sort((p, q) => fs.statSync(path.join(DIR, ".exports", q)).mtimeMs - fs.statSync(path.join(DIR, ".exports", p)).mtimeMs);
  let x = null; for (const f of fb) { x = docJ(path.join(DIR, ".exports", f), []).find((r) => String(r.id) === id); if (x) break; }
  // 10/10: bản chụp board591-live-* không tự làm mới → dựng từ tasks-cache.json (cột 6 ảnh · 8 ngày · 9 lỗi · 10 vị trí)
  if (!x) { const r = Object.values(docJ(path.join(DIR, ".exports", "tasks-cache.json"), {}).rows || {}).find((v) => String(v[1] || "").endsWith("task_id=" + id));
    if (r) x = { id, data: { configs: { BIN00: r[10], DATE00: r[8], TYPE00: r[9], IMA00: String(r[6] || "").split(/[\s,]+/).filter((u) => /^http/.test(u)).map((u) => u.replace(/^https:\/\/hr-media\.hasaki\.vn\/production\/hr\//, "")) } } }; }
  if (!x) return { id, loi: "không có phiếu trong board cache" };
  const c = x.data?.configs || {}; const bin = String(c.BIN00 || ""); const luc = String(c.DATE00 || "").slice(0, 19); const p = bin.split("-"); const tang = Number(p[4]);
  const cb = docJ(path.join(DIR, ".exports", "canh-b1-ketqua.json"), {})[id] || {}; const LUAT = docJ(path.join(DIR, "quy-tac-xac-minh-b1.json"), { luat: [] }).luat;
  const maLuat = cb.luat && cb.luat !== "KHAC" ? cb.luat : (cb.deXuat || [])[0] || "?"; const L = LUAT.find((l) => l.ma === maLuat) || {};
  const tuKhoa = p.slice(0, 4).join("-"); const cungTu = fb.length ? docJ(path.join(DIR, ".exports", fb[0]), []).filter((r) => r.id !== x.id && String(r.data?.configs?.BIN00 || "").startsWith(tuKhoa) && Math.abs(msOf(String(r.data?.configs?.DATE00).slice(0, 19)) - msOf(luc)) <= 2 * 864e5).map((r) => r.id + " · " + r.data.configs.BIN00) : [];
  ghiNk("1 phiếu " + id + " · " + bin + " · " + luc + " · luật " + maLuat + " (" + (L.macDinh || "?") + ") · tầng " + tang + (tang >= 20 ? " (pallet cao)" : ""));
  /* 2 G1 */
  const CDN = "https://hr-media.hasaki.vn/production/hr/"; const anhVP = [];
  for (const [i, s] of [].concat(c.IMA00 || []).slice(0, 2).entries()) { const f = path.join(OUT, "vp" + i + ".jpg"); if (!fs.existsSync(f)) fs.writeFileSync(f, Buffer.from(await (await fetch(CDN + s)).arrayBuffer())); anhVP.push(f); }
  if (!anhVP.length) return { id, loi: "phiếu không có ảnh vi phạm" };
  const g1 = await hoiGemini("Ảnh chụp vi phạm 5S trong kho, hạng mục: «" + String(c.TYPE00 || "").slice(0, 160) + "». Trả lời NGẮN: đồ vật vi phạm là gì (1 câu, không đoán người), chữ/mã đọc được trên đồ vật (mã SKU số, thương hiệu), màu chủ đạo, đồ vật nằm ở tầng kệ sát sàn / tầng giữa / tầng cao (pallet). Không đọc được thì để trống, KHÔNG bịa.",
    anhVP.map((f) => ({ f, rong: 900 })), { type: "object", properties: { do_vat: { type: "string" }, chu_ma: { type: "array", items: { type: "string" } }, mau: { type: "string" }, do_cao: { type: "string" } }, required: ["do_vat", "chu_ma", "mau"] });
  ghiNk("2 [Gemini] đồ vật: " + g1.do_vat + " · chữ/mã: " + (g1.chu_ma || []).join(", ") + " · màu " + g1.mau);
  /* 3 */
  const TK = docJ(path.join(DIR, "ban-do-camera-o.json"), {}).tenKenh || {}; const day = p[2];
  const kenh = Object.entries(TK).filter(([k, v]) => !k.startsWith("_") && k !== "dauGhi" && String(v).includes(day)).map(([k]) => k);
  const coNguoi = [];
  /* 09/10 thử 14079514: khung lấy ở lúc chụp +3 s thì người kiểm đã rời khung, xe đẩy xa bị dò nhầm là người (0,3) ⇒
     tải từ lúc chụp −6 s (12 s), dò người ở 0/3/6/9 s, chọn MỐC có người GẦN lúc chụp nhất, chỉ đánh dấu người điểm ≥0,45; kênh tổng quan («KE …») chỉ dùng sau cùng */
  const tChup = msOf(luc);
  for (const k of kenh) { const [host, ch] = k.split("/"); const vf = path.join(OUT, "chup_" + ch + ".mp4");
    if (!fs.existsSync(vf)) { const o = cong("cat-doan", host, ch, vn(tChup - 6000).replace(" ", "T"), 12, vf); if (!fs.existsSync(vf)) { ghiNk("3 kênh " + k + " " + TK[k] + ": không có hình"); continue; } if (/LỆCH/.test(o)) ghiNk("3 kênh " + k + ": " + (o.match(/LỆCH[^\n]*/) || [""])[0]); }
    cong("nguoi", vf, "0,3,6,9"); const nj = docJ(path.join(XM, path.basename(vf).replace(/\.mp4$/, "_nguoi.json")), []);   // cổng lưu kết quả dò người ở .exports/agy-xm
    const theoT = nj.map((q) => ({ t: q.t, ng: q.nguoi.filter((n) => n[4] >= 0.3 && n[3] >= 50 && n[3] < 420 && n[2] < 400) })).filter((q) => q.ng.length).sort((a, b) => Math.abs(a.t - 6) - Math.abs(b.t - 6));
    if (!theoT.length) { ghiNk("3 kênh " + k + " " + TK[k] + ": 0 người"); continue; }
    const tt = theoT[0]; spawnSync(process.execPath, ["_khung.mjs", vf, vf.replace(/\.mp4$/, "_t" + tt.t), String(tt.t)], { cwd: DIR, timeout: 180e3, env: { ...process.env, DON: "1" } });
    ghiNk("3 kênh " + k + " " + TK[k] + ": " + tt.ng.length + " người ở giây " + (tt.t - 6) + " so lúc chụp");
    coNguoi.push({ k, ch, vf, f: vf.replace(/\.mp4$/, "_t" + tt.t) + "_f0.jpg", nguoi: tt.ng.slice(0, 6), tongQuan: /^KE |TRUOC|SAU/i.test(String(TK[k])) }); }
  if (!coNguoi.length) return baoCao({ id, OUT, nk, x, c, bin, luc, maLuat, L, cungTu, g1, cb, ketLuan: "camera không thấy người kiểm ở kênh nào lúc chụp → giữ kết luận hệ thống", doChac: "thấp", t0 });
  /* 4 G2 + 5 kiem-vung: kênh soi dãy trước, người to nhất trước; tối đa 3 kênh */
  coNguoi.sort((a, b) => (a.tongQuan - b.tongQuan) || (Math.max(...b.nguoi.map((n) => n[3])) - Math.max(...a.nguoi.map((n) => n[3]))));
  const ungVien = coNguoi.some((k) => !k.tongQuan) ? coNguoi.filter((k) => !k.tongQuan) : coNguoi;   // kênh tổng quan quá thô để đặt vùng
  let chon = null;
  /* 10/10 HỌC VÙNG (mục tiêu «không phụ thuộc AI»): vùng ô đã ĐẠT kiem-vung ở lần trước → ban-do-camera-o.json roi["<ô>|o"] — dùng lại, KHÔNG gọi Gemini 4a/4b.
     Vẫn chạy kiem-vung tất định trên video lúc chụp lần này; SAI thì rơi xuống đường AI như cũ. */
  const BDF = path.join(DIR, "ban-do-camera-o.json"), hoc = (docJ(BDF, {}).roi || {})[bin + "|o"];
  const knHoc = hoc && coNguoi.find((k) => k.k === hoc.kenh);
  if (knHoc) { const kv = cong("kiem-vung", knHoc.vf, hoc.khung.join(","), bin); const dat = /KIỂM VÙNG: ĐẠT/.test(kv);
    ghiNk("4 [bản đồ, không AI] vùng đã học " + JSON.stringify(hoc.khung) + " trên kênh " + hoc.kenh + " (nguồn " + hoc.nguon + "): kiem-vung " + (dat ? "ĐẠT" : "SAI → hỏi Gemini"));
    if (dat) chon = { ...knHoc, vung: hoc.khung, g2: { nguoi_chup: "-", o: ["bản đồ"], model: "ban-do" }, luoi: knHoc.f }; }
  for (const kn of chon ? [] : ungVien.slice(0, 3)) { if (!fs.existsSync(kn.f)) continue;
    /* 09/10 v4 — G2 TÁCH 2 CÂU (QC v3: chọn ô cả khung không ổn định, lúc ra ô người đứng, lúc ra sàn lối đi):
       4a: chỉ hỏi NGƯỜI nào đang chụp (dễ, ổn định). 4b: máy CẮT + PHÓNG vùng quanh người đó (tầm với), lưới 40 px → hỏi ô đồ vật trên ảnh phóng → đổi về toạ độ khung gốc. */
    const luoi = await veLuoiNguoi(kn.f, kn.nguoi, path.join(OUT, "g2_" + kn.ch + ".jpg"));
    const g2a = await hoiGemini("Ảnh 1: ảnh vi phạm chụp bằng điện thoại (đồ vật: " + g1.do_vat + "). Ảnh 2: khung camera kho đúng lúc chụp ảnh 1, khung đỏ đánh số người P1, P2… do máy dò (có thể có khung nhầm vào xe đẩy/thùng)." +
      " Người nào là NGƯỜI ĐANG CHỤP ảnh 1 (cầm/giơ điện thoại hướng vào kệ)? Không ai thì để trống. tin_cay 0–100.",
      [{ f: anhVP[0], rong: 512, chu: "Ảnh 1:" }, { f: luoi, chu: "Ảnh 2 (camera " + kn.k + "):" }],
      { type: "object", properties: { nguoi_chup: { type: "string" }, tin_cay: { type: "integer" } }, required: ["nguoi_chup", "tin_cay"] });
    const nChup = kn.nguoi[Number(String(g2a.nguoi_chup || "").replace(/[^0-9]/g, "")) - 1];
    ghiNk("4a [Gemini] kênh " + kn.k + ": người chụp " + (g2a.nguoi_chup || "-") + (nChup ? " [" + nChup.slice(0, 4).join(",") + "]" : "") + " · tin cậy " + g2a.tin_cay);
    if (!nChup || g2a.tin_cay < 40) continue;
    /* vùng cắt = tầm với người chụp (2 bề ngang mỗi bên, 0,6 cao trên/dưới), tối thiểu 320×240 */
    const [px, py, pw, ph] = nChup; let cx0 = Math.max(0, Math.round(px - 2 * pw)), cy0 = Math.max(0, Math.round(py - 0.6 * ph));
    let cw = Math.min(1280 - cx0, Math.max(320, Math.round(pw * 5))), chh = Math.min(720 - cy0, Math.max(240, Math.round(ph * 2.2)));
    cw = Math.round(cw / 40) * 40 || 40; chh = Math.round(chh / 40) * 40 || 40; if (cx0 + cw > 1280) cx0 = 1280 - cw; if (cy0 + chh > 720) cy0 = 720 - chh;
    const K = Math.min(4, 1100 / cw, 800 / chh); const nc = cw / 40, nr = chh / 40; const ten = (c, r) => String.fromCharCode(65 + c) + (r + 1);
    /* 09/10 v5 — 4b KHUNG BAO (box_2d) trên ảnh phóng SẠCH (thử tay: ô lưới sai/không ổn định; box_2d + gemini-3-flash-preview đúng 4/4 lần trên 2 phiếu có đáp án; flash-lite sai 4/4) */
    const sv = `<svg width="${Math.round(cw * K)}" height="${Math.round(chh * K)}"><rect x="${(px - cx0) * K}" y="${(py - cy0) * K}" width="${pw * K}" height="${ph * K}" fill="none" stroke="#ff2a2a" stroke-width="4" stroke-dasharray="12,8"/></svg>`;
    const zoomF = path.join(OUT, "g2b_" + kn.ch + ".jpg");
    await sharp(await sharp(await sharp(kn.f).resize(1280, 720, { fit: "fill" }).toBuffer()).extract({ left: cx0, top: cy0, width: cw, height: chh }).resize(Math.round(cw * K), Math.round(chh * K)).toBuffer())
      .composite([{ input: Buffer.from(sv), left: 0, top: 0 }]).jpeg({ quality: 90 }).toFile(zoomF);
    const hoiG2b = (them) => hoiGemini("Ảnh 1: ảnh vi phạm chụp gần bằng điện thoại (đồ vật: " + g1.do_vat + "; chữ/mã: " + (g1.chu_ma || []).join(", ") + "; màu " + g1.mau + "). Ảnh 2: ảnh camera kho PHÓNG TO quanh người đang chụp ảnh 1 (khung đỏ nét đứt = người chụp)." +
      " Tìm trong ảnh 2 CHÍNH đồ vật/khu vực kệ của ảnh 1 (đối chiếu chữ, màu, hình thùng, vị trí so với người chụp; " + (tang >= 20 ? "tầng pallet cao" : tang <= 2 ? "tầng thấp sát sàn" : "tầng giữa") + "; nằm trên mặt kệ, KHÔNG phải sàn/lối đi/người/xe đẩy). Trả box_2d [ymin,xmin,ymax,xmax] thang 0–1000 của ảnh 2, ôm sát đồ vật. Không thấy thì tin_cay=0. KHÔNG đoán." + (them || ""),
      [{ f: anhVP[0], rong: 640, chu: "Ảnh 1:" }, { f: zoomF, rong: 1200, chu: "Ảnh 2:" }],
      { type: "object", properties: { box_2d: { type: "array", items: { type: "integer" } }, ly_do: { type: "string" }, tin_cay: { type: "integer" } }, required: ["box_2d", "tin_cay"] }, MOHINH_MANH);
    const veToaDo = (bx) => { if (!Array.isArray(bx) || bx.length !== 4) return null; const [y1, x1, y2, x2] = bx.map(Number); if (!(x2 > x1 && y2 > y1)) return null;
      const v = [Math.round(cx0 + x1 / 1000 * cw), Math.round(cy0 + y1 / 1000 * chh), Math.round((x2 - x1) / 1000 * cw), Math.round((y2 - y1) / 1000 * chh)];
      v[2] = Math.max(40, Math.min(v[2], 1280 - v[0])); v[3] = Math.max(40, Math.min(v[3], 720 - v[1])); return v; };
    let g2 = await hoiG2b(); let vung = veToaDo(g2.box_2d);
    /* kiểm tất định: vùng trùng quá nửa với khung người chụp ⇒ hỏi lại 1 lần */
    const trung = (v) => { if (!v) return 0; const ix = Math.max(0, Math.min(v[0] + v[2], px + pw) - Math.max(v[0], px)), iy = Math.max(0, Math.min(v[1] + v[3], py + ph) - Math.max(v[1], py)); return (ix * iy) / (v[2] * v[3]); };
    if (trung(vung) > 0.5) { ghiNk("4b khung " + JSON.stringify(vung) + " trùng người chụp → hỏi lại"); g2 = await hoiG2b(" LƯU Ý: lần trước khung bạn trả trùng chỗ NGƯỜI đang đứng (khung đỏ) — đó không phải đồ vật."); vung = veToaDo(g2.box_2d); if (trung(vung) > 0.5) { ghiNk("4b hỏi lại vẫn trùng người chụp → bỏ kênh này"); vung = null; } }
    g2.o = [JSON.stringify(g2.box_2d)];
    g2.nguoi_chup = g2a.nguoi_chup;
    ghiNk("4b [Gemini " + g2.model + "] khung " + (g2.o || []).join(",") + " → vùng " + JSON.stringify(vung) + " · tin cậy " + g2.tin_cay + " · " + String(g2.ly_do || "").slice(0, 120));
    if (!vung || g2.tin_cay < 40) continue;
    /* 09/10 QC 14081920: vùng 40×40 quá ít chi tiết → so khớp mẫu dao động quanh ngưỡng ⇒ nới tối thiểu 80×80 quanh tâm */
    if (vung[2] < 80 || vung[3] < 80) { const cxv = vung[0] + vung[2] / 2, cyv = vung[1] + vung[3] / 2, W2 = Math.max(80, vung[2]), H2 = Math.max(80, vung[3]); vung = [Math.max(0, Math.min(1280 - W2, Math.round(cxv - W2 / 2))), Math.max(0, Math.min(720 - H2, Math.round(cyv - H2 / 2))), W2, H2]; ghiNk("4b vùng nhỏ → nới " + JSON.stringify(vung)); }
    const kv = cong("kiem-vung", kn.vf, vung.join(","), bin, "nguoi=" + nChup.slice(0, 4).join(",")); const dat = /KIỂM VÙNG: ĐẠT/.test(kv); ghiNk("5 kiem-vung " + vung.join(",") + ": " + (dat ? "ĐẠT" : "SAI"));
    if (dat) { chon = { ...kn, vung, g2, luoi };
      /* 10/10: KHÔNG ghi bản đồ ở đây — kiem-vung còn dễ dãi (14079499 ĐẠT ở tủ 08 cho ô tủ 10). Chỉ học khi kết luận «chắc» (camera + WMS ≤3′) — xem hocVung() ở baoCao */
      break; } }
  if (!chon) return baoCao({ id, OUT, nk, x, c, bin, luc, maLuat, L, cungTu, g1, cb, coNguoi, ketLuan: "không đặt được vùng đồ vật đạt kiểm (đồ vật không thấy rõ trên camera) → giữ kết luận hệ thống", doChac: "thấp", t0 });
  /* 6 tim-moc */
  /* 09/10 chạy loạt 7 phiếu: so với khung ĐÚNG lúc chụp thì «thay đổi» tìm ra là NGƯỜI KIỂM đang che/mở thùng (14081936, 14081920) ⇒ trạng thái chuẩn = 150 s TRƯỚC lúc chụp (lúc người kiểm chưa tới) */
  const tChuan = msOf(luc) - 150e3; ghiNk("6 trạng thái chuẩn lấy lúc " + vn(tChuan) + " (trước khi người kiểm tới)");
  const tm = cong("tim-moc", chon.k, chon.vung.join(","), vn(tChuan), vn(msOf(luc) - 4 * 864e5)); fs.writeFileSync(path.join(OUT, "tim-moc.txt"), tm);
  const mk = tm.match(/trong khoảng (\S+ \S+) → (\S+ \S+)/); const coTuTruoc = /CÓ từ trước (\S+ \S+)/.exec(tm);
  /* 09/10 QC 14081920: điểm khớp hai đầu mốc chênh < 0,15 (0,61→0,66) = MỐC MỜ → kết luận không chắc */
  let mocMo = false; if (mk) { const kOf = (t) => { const l = tm.split(/\n/).find((x) => x.includes(t)); const m2 = l && l.match(/khớp mẫu ([0-9.]+)/); return m2 ? +m2[1] : null; }; const a1 = kOf(mk[1]), a2 = kOf(mk[2]); if (a1 != null && a2 != null && a2 - a1 < 0.15) mocMo = true; }
  const anhMoc = (tm.match(/ảnh mốc: (.*MOC\.jpg)/) || [])[1];
  ghiNk("6 tim-moc: " + (mk ? (mocMo ? "MỐC MỜ " : "") + "VẮNG " + mk[1] + " → CÓ " + mk[2] : coTuTruoc ? "có từ trước " + coTuTruoc[1] : "không rõ"));
  if (!mk) return baoCao({ id, OUT, nk, x, c, bin, luc, maLuat, L, cungTu, g1, cb, chon, anhMoc, ketLuan: "đồ vật ở đúng trạng thái lúc chụp từ trước " + (coTuTruoc ? coTuTruoc[1] : "mốc xa nhất") + " → chưa tìm được lúc đặt, chưa định danh", doChac: "thấp", t0 });
  /* 7 G3 */
  const tV = msOf(mk[1]), tC = msOf(mk[2]);
  /* 7a máy: GIÂY ĐẶT trên kênh chính — trích khung mỗi 2 s trong [VẮNG, CÓ], so vùng với khung cuối (trạng thái CÓ); giây đặt = khung đầu tiên mà từ đó trở đi đều gần trạng thái CÓ */
  let giua = Math.round((tV + tC) / 2);
  { const [host, ch] = chon.k.split("/"); const vf = path.join(OUT, "khoang_" + ch + ".mp4"); const dai = Math.min(600, Math.round((tC - tV) / 1000) + 6);
    cong("cat-doan", host, ch, vn(tV - 3000).replace(" ", "T"), dai, vf);
    if (fs.existsSync(vf)) { const ts = []; for (let t = 0; t <= dai - 1; t += 2) ts.push(t);
      spawnSync(process.execPath, ["_khung.mjs", vf, vf.replace(/\.mp4$/, ""), ...ts.map(String)], { cwd: DIR, timeout: 600e3, env: { ...process.env, DON: "1" } });
      const [x0, y0, w0, h0] = chon.vung; const xam = async (f) => new Uint8Array(await sharp(await sharp(await sharp(f).resize(1280, 720, { fit: "fill" }).toBuffer()).extract({ left: x0, top: y0, width: w0, height: h0 }).toBuffer()).resize(48, 48, { fit: "fill" }).grayscale().raw().toBuffer());
      const ds = []; for (const [i, t] of ts.entries()) { const f = vf.replace(/\.mp4$/, "") + "_f" + i + ".jpg"; if (fs.existsSync(f)) ds.push({ t, g: await xam(f) }); }
      if (ds.length > 3) { const cuoi = ds[ds.length - 1].g; const d = ds.map((q) => { let s = 0; for (let i = 0; i < cuoi.length; i++) s += Math.abs(q.g[i] - cuoi[i]); return s / cuoi.length; });
        const nguong = (Math.max(...d) + Math.min(...d)) / 2; let k = d.length - 1; while (k > 0 && d[k - 1] <= nguong) k--;
        giua = tV - 3000 + ds[k].t * 1000; ghiNk("7a giây đặt (máy, kênh " + chon.k + "): " + vn(giua) + " (chênh tới trạng thái CÓ: " + d.map((v) => v.toFixed(0)).join(" ") + ")"); } } }
  const lech = "-10,-6,-3,0,3"; const kenhSoi = [chon.k, ...kenh.filter((k) => k !== chon.k)].slice(0, 5);
  const lg = cong("luoi-goc", kenhSoi.join(","), vn(giua), lech, "vung=" + chon.vung.join(",")); const anhGoc = (lg.match(/→ (.*LUOI-GOC\.jpg)/) || [])[1];
  let g3 = { co_nguoi: false };
  if (anhGoc && fs.existsSync(anhGoc)) {
    g3 = await hoiGemini("Ảnh 1: ảnh vi phạm (đồ vật: " + g1.do_vat + "). Ảnh 2: lưới khung các camera cùng dãy kệ (mỗi hàng 1 kênh, ghi tên kênh + độ lệch giây so " + vn(giua).slice(11) + " " + vn(giua).slice(8, 10) + "/" + vn(giua).slice(5, 7) + ") trong khoảng đồ vật vừa được đặt vào kệ " + bin + "." +
      " Trả lời: có người nào đang ĐẶT / CHẠM / BÊ đúng loại đồ vật đó vào kệ không; nếu có: kênh nào, độ lệch giây nào (ghi đúng nhãn cột), mô tả người (màu áo, áo phản quang, khẩu trang, mũ, dáng) — KHÔNG đoán tên. Người chỉ đi ngang / cầm máy quét không chạm kệ thì không tính." + (Math.abs(giua - msOf(luc)) < 15 * 60e3 ? " BỎ QUA người đang giơ điện thoại chụp ảnh kệ ngay lúc ghi nhận (đó là người kiểm)." : "") + " Khung VÀNG ở hàng đầu (kênh " + chon.k + ") là CHỖ đồ vật; ưu tiên xem ai thò tay/đặt hàng vào đúng khung vàng (người cầm máy quét/điện thoại soạn hàng VẪN tính nếu tay chạm vào chỗ đó). Không chắc thì co_nguoi=false.",
      [{ f: anhVP[0], rong: 520, chu: "Ảnh 1:" }, { f: anhGoc, rong: 2400, chu: "Ảnh 2:" }],
      { type: "object", properties: { co_nguoi: { type: "boolean" }, kenh: { type: "string" }, lech_giay: { type: "integer" }, mo_ta: { type: "string" }, tin_cay: { type: "integer" } }, required: ["co_nguoi", "tin_cay"] }, MOHINH_MANH, ["claude-sonnet-5-5-low"]);   /* 09/10 thử: nhận người qua agy — Gemini 3.8 nhận NHẦM người áo phản quang, Claude Sonnet ĐÚNG (áo xanh, khẩu trang, kênh 20) */ }
  const tNguoi = g3.co_nguoi && Number.isFinite(g3.lech_giay) ? giua + g3.lech_giay * 1000 : null;
  ghiNk("7 [Gemini] " + (g3.co_nguoi ? "thấy người: " + g3.mo_ta + " · kênh " + g3.kenh + " · " + (tNguoi ? vn(tNguoi) : "?") + " · tin cậy " + g3.tin_cay : "không thấy ai đặt/chạm rõ"));
  /* 8 WMS */
  const w = cong("wms-o", bin, vn(tV - 10 * 60e3).replace(" ", "T"), vn(tC + 10 * 60e3).replace(" ", "T"));
  const dongW = w.split("\n").filter((l) => /^\d\d-\d\d \d\d:\d\d/.test(l.trim()));
  const tMoc = tNguoi || giua;
  const khop = dongW.map((l) => { const m = l.trim().match(/^(\d\d)-(\d\d) (\d\d):(\d\d)/); const t = msOf("2026-" + m[1] + "-" + m[2] + " " + m[3] + ":" + m[4] + ":00"); return { l: l.trim(), lech: Math.abs(t - tMoc) / 60e3 }; }).filter((q) => q.lech <= 3);
  let ten = ""; if (khop.length) { const nv = (cb.nv || []).find((n) => (n.lan || []).some((s) => { const m = s.match(/(\d\d)-(\d\d) (\d\d):(\d\d)/); return m && Math.abs(msOf("2026-" + m[1] + "-" + m[2] + " " + m[3] + ":" + m[4] + ":00") - tMoc) <= 3 * 60e3; }));
    ten = nv ? nv.ten + " (" + nv.code + ")" : "tài khoản " + (khop[0].l.split("·")[1] || "").trim(); }
  ghiNk("8 WMS ±10′: " + dongW.length + " lệnh · khớp ≤3′: " + (khop.length ? khop.map((q) => q.l + " (lệch " + q.lech.toFixed(1) + "′)").join(" | ") : "không"));
  /* 14/10 user «bạn xem xác minh qua cam thấy thì ghi lại, k phải t làm»: camera thấy người đặt/chạm mà KHÔNG có lệnh WMS khớp ≤3′
     ⇒ MÁY ghi lượt «tác động không qua hệ thống» (sổ tac-dong-vat-ly.json, nguon:"may") kèm clip khoảng VẮNG→CÓ — người không phải ghi tay */
  if (g3.co_nguoi && tNguoi && !khop.length) try {
    const { ghiTacDongMay } = await import("./ghi-tac-dong-may.mjs");
    if (ghiTacDongMay({ id, tNguoi, tDauClip: tV - 3000, clipFile: path.join(OUT, "khoang_" + chon.k.split("/")[1] + ".mp4"), kenh: chon.k, moTa: g3.mo_ta, doChac: (g3.tin_cay || 0) >= 70 ? "vừa" : "thấp" }))
      ghiNk("8b đã ghi «tác động không qua hệ thống» (máy) lúc " + vn(tNguoi));
  } catch (e) { ghiNk("8b ghi tác động không qua hệ thống lỗi: " + e.message); }
  /* 9 */
  const loiSoan = /^SH-/.test(maLuat);
  const doChac = mocMo ? "thấp" : ten && g3.co_nguoi && (g3.tin_cay || 0) >= 70 ? "chắc" : g3.co_nguoi ? "vừa" : "thấp";
  const ketLuan = ten ? "đề xuất " + ten + " (lệnh WMS khớp ≤3′ với lúc camera thấy người đặt đồ vật)" : g3.co_nguoi ? "camera thấy người đặt/chạm đồ vật nhưng không có lệnh WMS khớp → định danh theo NV-01 (ca làm, giờ chấm ra) — CẦN USER" : "có mốc đồ vật xuất hiện nhưng không thấy rõ người → chưa định danh";
  return baoCao({ id, OUT, nk, x, c, bin, luc, maLuat, L, cungTu, g1, cb, chon, anhMoc, mk, g3, tNguoi, anhGoc, dongW, khop, ten, ketLuan: ketLuan + (loiSoan ? " · lỗi SOẠN hàng: người soạn cần picking-group — CẦN USER" : ""), doChac, t0 });
}

function baoCao(o) {
  const { id, OUT, nk, bin, luc, maLuat, L, cungTu, g1 } = o; const rel = (f) => (f ? path.basename(f) : "-");
  /* 10/10 HỌC VÙNG: chỉ khi «chắc» (camera thấy người đặt + lệnh WMS khớp ≤3′ — 2 tín hiệu độc lập) mới ghi vùng ô vào bản đồ → lần sau cùng ô bỏ qua Gemini 4a/4b */
  if (o.chon && o.chon.g2?.model !== "ban-do" && o.doChac === "chắc") try {
    const BDF = path.join(DIR, "ban-do-camera-o.json"), bd = docJ(BDF, {}); bd.roi ||= {};
    if (!bd.roi[bin + "|o"]) { bd.roi[bin + "|o"] = { kenh: o.chon.k, khung: o.chon.vung, moTa: "máy học (chắc): " + String(g1?.do_vat || "").slice(0, 60), nguon: id, may: true, luc: vn(Date.now()) };
      fs.writeFileSync(BDF, JSON.stringify(bd, null, 1)); nk.push("đã học vùng " + bin + " trên kênh " + o.chon.k + " vào bản đồ (lần sau không cần AI)"); } } catch { /* */ }
  const moc = []; if (o.mk) { moc.push("- " + o.mk[1] + " VẮNG/khác trạng thái (nguồn: " + rel(o.anhMoc) + ")"); moc.push("- " + o.mk[2] + " CÓ đúng trạng thái lúc chụp (nguồn: " + rel(o.anhMoc) + ")"); }
  if (o.tNguoi) moc.push("- " + vn(o.tNguoi) + " người đặt/chạm đồ vật: " + o.g3.mo_ta + " (nguồn: " + rel(o.anhGoc) + ")");
  const bao = ["PHIẾU: https://work.hasaki.vn/tasks?task_id=" + id + " · ô " + bin + " · ghi nhận " + luc,
    "ĐỒ VẬT: " + (g1?.do_vat || "-") + (g1?.chu_ma?.length ? " · chữ/mã: " + g1.chu_ma.join(", ") : ""),
    "LUẬT/KHUÔN: " + maLuat + " · macDinh " + (L.macDinh || "?"),
    "GÓC CAMERA: " + (o.chon ? o.chon.k + " (người kiểm " + o.chon.g2.nguoi_chup + ")" : (o.coNguoi || []).map((k) => k.k).join(", ") || "không kênh nào thấy người kiểm"),
    "VÙNG: " + (o.chon ? "[" + o.chon.vung.join(",") + "] trên kênh " + o.chon.k + " · kiem-vung ĐẠT · ô " + (o.chon.g2.o || []).join(",") + " (nguồn: " + rel(o.chon.luoi) + ")" : "chưa đặt được"),
    "PHIẾU CÙNG TỦ: " + (cungTu.length ? cungTu.join("; ") : "không có"),
    "MỐC:", ...(moc.length ? moc : ["- chưa tìm được"]),
    "HỆ THỐNG: " + (o.dongW ? (o.dongW.length ? o.dongW.join(" | ") : "không có lệnh WMS châm/chuyển ±10′") : "chưa tra") + (o.khop?.length ? " · KHỚP ≤3′: " + o.khop.map((q) => q.l.slice(0, 11)).join(", ") : ""),
    "NGƯỜI: " + (o.ten || (o.g3?.co_nguoi ? "chưa định danh — " + o.g3.mo_ta : "chưa định danh")),
    "KẾT LUẬN: " + o.ketLuan + " · ĐỘ CHẮC: " + o.doChac + " · CẦN USER: " + (L.macDinh === "hoi" ? "quyết gán lỗi (luật hỏi)" : "kiểm lại trước khi gán"),
    "CHƯA LÀM / KHÔNG LÀM ĐƯỢC: chưa dựng clip; máy không ghi gì lên phiếu",
    "GEMINI: " + soGoiGemini + " lần gọi · " + tokenGemini + " token · " + Math.round((Date.now() - o.t0) / 1000) + " s",
    "", "NHẬT KÝ MÁY:", ...nk.map((s) => "  " + s)].join("\n");
  fs.writeFileSync(path.join(OUT, "BAO-CAO.md"), bao);
  /* luồng giả cho cham-agy-xm.mjs (V1: kiem-vung ĐẠT trước tim-moc) */
  fs.writeFileSync(path.join(OUT, "stream.jsonl"), (o.chon ? "KIỂM VÙNG: ĐẠT\n" : "") + (o.mk || /tim-moc/.test(nk.join()) ? "agy-xm.mjs tim-moc\n" : ""));
  return { id, ketLuan: o.ketLuan, doChac: o.doChac, gemini: soGoiGemini, token: tokenGemini };
}

const tong = [];
for (const id of IDS) { log("▶ " + id); try { const r = await xacMinh(id); tong.push(r); log("  ✓ " + id + " · " + (r.loi || r.ketLuan) + " · Gemini " + (r.gemini ?? 0) + " lần / " + (r.token ?? 0) + " token"); }
  catch (e) { log("  ✗ " + id + " " + String(e.message).slice(0, 200)); tong.push({ id, loi: e.message }); } }
fs.writeFileSync(path.join(RA, "lan-chay-" + new Date().toISOString().slice(0, 16).replace(/[:T]/g, "") + ".json"), JSON.stringify(tong, null, 1));
/* 09/10 user: «các phiếu xác minh chưa cập nhật lên» → đẩy kết quả lên bảng nội bộ Việc 5S ngay sau mỗi lượt (KHÔNG ghi work.hasaki) */
spawnSync(process.execPath, [path.join(DIR, "day-xm-len-bang.mjs"), RA], { cwd: DIR, stdio: "inherit", timeout: 120e3 });
