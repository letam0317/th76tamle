/**
 * tim-vat-xuat-hien.mjs — MÁY TỰ TÌM LÚC ĐỒ VẬT VI PHẠM XUẤT HIỆN trên camera (thay việc người dò dải 9 khung) · 24/10/2026
 * ============================================================================================
 *  User 24/10: dải 72 giờ bắt người tự nhìn «khung cũ nhất còn đồ vật» — «sao t biết được» → «làm đi».
 *  Bài học truy-nguoc-b1 (05/10, phiếu mẫu 13393784): so CẢ KHUNG HÌNH thì bắt nhầm đèn bật / pallet khác xê dịch.
 *  Nay chỉ so ĐÚNG VÙNG đồ vật, 2 tín hiệu độc lập:
 *   ① KHOANH VÙNG: Gemini xem ảnh người kiểm chụp (điện thoại, cận cảnh) + khung camera lúc chụp → bbox đồ vật trên camera.
 *      Không chắc (tin cậy < 60 / không thấy) → DỪNG «chưa xác định vùng» (người kéo ô 1 lần: --vung=x,y,w,h px 1280×720).
 *   ② SO TỪNG KHUNG trong vùng: Gemini trả co / khong / bi_che (người, xe che, tối) — bỏ qua đổi sáng tối;
 *      kèm đo ĐƯỜNG NÉT điểm ảnh (tương quan gradient, không theo độ sáng) để đối chiếu. Hai bên vênh mạnh → khung đó «không rõ».
 *   ③ DÒ: mốc T, −1, −3, −6, −12, −24, −36, −48, −72 giờ → tìm chỗ «có» (mới) → «không» (cũ) gần T nhất → 9 khung chia đều
 *      trong khoảng đó, lặp tới khi ≤ 3 phút → cắt clip (−20 s … +20 s) + ảnh TRƯỚC/SAU có khoanh vùng.
 *   ④ KHÔNG ĐOÁN: vùng bị che suốt, camera mất hình, kết quả vênh → «chưa xác định được» + lý do.
 *  Ra: .exports/tim-vat/<id>.json (mọi bước, để kiểm) · Videos/5S-bang-chung/may/<id>_TRUY-…mp4 + _TV-TRUOC/_TV-SAU.jpg + _LUI-TV….jpg
 *      --ghi: gắn vào .exports/bang-chung-b1.json (truy = clip máy tìm, anhLui = dải vòng cuối) → trang Xác minh hiện như bằng chứng.
 *
 *  node tim-vat-xuat-hien.mjs --id=13393784 [--luc="2026-08-21 14:05:14"] [--kenh=172.16.10.19/52] [--vung=x,y,w,h] [--ghi]
 *  Tải: ~30–45 đoạn 12 s/phiếu từ đầu ghi top-review + ~6–8 lượt Gemini; 0 lượt work/wms/hr (giờ + ảnh lấy từ tasks-cache).
 */
import "dotenv/config";
import fs from "node:fs"; import path from "node:path"; import { execFileSync } from "node:child_process"; import { fileURLToPath } from "node:url";
import sharp from "sharp"; import puppeteer from "puppeteer"; import { EDGE_PATH } from "./token-store.js"; import { ghiJson } from "./so-ghi.mjs";
const DIR = path.dirname(fileURLToPath(import.meta.url)); process.chdir(DIR);
const A = Object.fromEntries(process.argv.slice(2).map((x) => { const [k, ...v] = x.replace(/^--/, "").split("="); return [k, v.length ? v.join("=") : true]; }));
/* --tu-dong: lượt nền (sau dai-lui trong _TIM-BANG-CHUNG-B1.vbs) — phiếu «chup» đã có ảnh, chưa có timVat/truy, chia phần XM_PHAN
   như dai-lui (2 máy không làm trùng), mỗi phiếu 1 tiến trình con --ghi; tối đa --max (mặc định 3) phiếu/lượt */
if (A["tu-dong"]) {
  const so = JSON.parse(fs.readFileSync(path.join(DIR, ".exports", "bang-chung-b1.json"), "utf8"));
  const [PI, PN] = String(A.phan || process.env.XM_PHAN || "1/1").split("/").map(Number);
  const ds = Object.entries(so).filter(([id, e]) => e.loai === "chup" && (e.anh || []).length && !e.timVat && !e.truy && (!(PN > 1) || Number(id) % PN === PI - 1))
    .sort((a, b) => String(b[1].luc).localeCompare(String(a[1].luc))).slice(0, Number(A.max || 3));
  console.log(new Date(Date.now() + 7 * 36e5).toISOString().slice(11, 19), `tìm đồ vật tự động: ${ds.length} phiếu`);
  for (const [id] of ds) { try { console.log(execFileSync(process.execPath, [fileURLToPath(import.meta.url), "--id=" + id, "--ghi"], { encoding: "utf8", windowsHide: true, timeout: 30 * 60e3 }).split("\n").filter((l) => /✓|✗/.test(l)).join("\n")); } catch (e) { console.log("✗ " + id + ": " + String(e.message).slice(0, 120)); } }
  process.exit(0);
}
const ID = String(A.id || ""); if (!/^\d{7,9}$/.test(ID)) { console.log("cần --id=<task_id> hoặc --tu-dong"); process.exit(2); }
const EXP = path.join(DIR, ".exports"), TAM = path.join(EXP, ".tim-vat-tam", ID), RA_DIR = path.join(EXP, "tim-vat");
const GOC = path.join(process.env.BAIXE_DIR ? path.dirname(process.env.BAIXE_DIR) : "C:/Users/lechitam/Videos/5S-bang-chung", "may");
for (const d of [TAM, RA_DIR, GOC]) fs.mkdirSync(d, { recursive: true });
const log = (...a) => console.log(new Date(Date.now() + 7 * 36e5).toISOString().slice(11, 19), ...a);
const doc = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };
const iso = (ms) => new Date(ms + 7 * 36e5).toISOString().slice(0, 19), hm = (ms) => iso(ms).slice(5, 16).replace("T", " "), msVN = (s) => Date.parse(String(s).replace(" ", "T") + "+07:00");
const ngu = (ms) => new Promise((r) => setTimeout(r, ms));
const W = 1280, H = 720, NGUONG_PHUT = 3, MOC = [0, 1, 3, 6, 12, 24, 36, 48, 72];

/* ---- 0) đầu vào: giờ chụp + ảnh người kiểm (tasks-cache, 0 lượt) · kênh camera lúc chụp (kenh-luc-chup) ---- */
const tc = doc(path.join(EXP, "tasks-cache.json"), { rows: [] });
const dong = (Array.isArray(tc.rows) ? tc.rows : Object.values(tc.rows || {})).find((r) => String(r[1]).includes("task_id=" + ID));
const T = msVN(A.luc || (dong && dong[8]) || "");
if (!T) { log("✗ không có giờ ghi nhận (tasks-cache) — truyền --luc"); process.exit(2); }
const anhKiem = String((dong && dong[6]) || "").split(/\s+/).filter((u) => /^https:\/\/hr-media\.hasaki\.vn\//.test(u));
const kj = doc(path.join(EXP, "kenh-luc-chup", ID + ".json"), {});
const KENH = String(A.kenh || (kj.kenh || [])[0] || ""); const [HOST, CH] = KENH.split("/");
if (!HOST || !CH) { log("✗ chưa biết kênh camera — chạy _kenh-luc-chup.mjs hoặc truyền --kenh=host/kênh"); process.exit(2); }
const LOI = String((dong && dong[9]) || ""), BIN = String((dong && dong[10]) || "");
const KQ = { id: ID, bin: BIN, loi: LOI, lucChup: iso(T), kenh: KENH, vong: [], luc: new Date().toISOString() };
const ghiKQ = (them) => { Object.assign(KQ, them); ghiJson(path.join(RA_DIR, ID + ".json"), KQ); };
log(`phiếu ${ID} · ${BIN} · chụp ${hm(T)} · camera ${KENH} · ${anhKiem.length} ảnh người kiểm`);

/* ---- 1) lấy khung camera: đoạn 12 s quanh mốc → khung giữa (1 trình duyệt dùng chung). Đầu ghi theo chuyển động → thử lệch ---- */
const trinh = await puppeteer.launch({ headless: true, executablePath: EDGE_PATH, args: ["--allow-file-access-from-files"] });
const trang = await trinh.newPage(); await trang.setViewport({ width: W, height: H });
await trang.goto("file:///" + TAM.split(path.sep).join("/") + "/");   // trang about:blank không được nạp video file:// — đứng ở gốc file trước (như _khung.mjs)
const cacheKhung = new Map();
async function layKhung(ms) {
  const k = Math.round(ms / 1000); if (cacheKhung.has(k)) return cacheKhung.get(k);
  let kq = null;
  /* 24/10 đo: cùng một mốc đầu ghi lúc trả hình lúc 400 (bận) → thử lại sau 3 s rồi mới lệch giờ */
  for (const [lan, lech] of [0, 0, 20, -20, 45, -45, 90, -90].entries()) {
    if (lan === 1) await ngu(3000);
    const t = ms + lech * 1000, mp = path.join(TAM, `k_${Math.round(t / 1000)}.mp4`);
    try { execFileSync(process.execPath, ["_cat-doan.mjs", HOST, CH, iso(t - 6000), "12", mp], { stdio: "ignore", windowsHide: true, timeout: 120000 }); } catch { /* đầu ghi không có đoạn này */ }
    if (!fs.existsSync(mp) || fs.statSync(mp).size < 30e3) { try { fs.unlinkSync(mp); } catch { /* */ } continue; }
    try {
      const url = "file:///" + mp.split(path.sep).join("/");
      await trang.setContent('<body style="margin:0;background:#000"><video id=v src="' + url + '" muted style="width:1280px;height:720px"></video></body>');
      await trang.waitForFunction(() => document.getElementById("v").readyState >= 1, { timeout: 30000 });
      await trang.evaluate(() => new Promise((r) => { const v = document.getElementById("v"); v.onseeked = () => r(); v.currentTime = Math.min(6, Math.max(0, v.duration - 0.5)); }));
      await ngu(300);
      kq = { ms: t, buf: Buffer.from(await trang.screenshot({ type: "jpeg", quality: 85 })) };
    } catch { /* hỏng tệp */ }
    try { fs.unlinkSync(mp); } catch { /* */ }
    if (kq) break;
  }
  cacheKhung.set(k, kq); return kq;
}

/* ---- Gemini (chuỗi model dự phòng, mỗi model quota riêng — cùng khuôn _gemini-nguoi-vung) ---- */
const KEY = process.env.GEMINI_API_KEY;
const CHUOI = [...new Set([process.env.GEMINI_MODEL_CAMERA || "gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-3.5-flash", "gemini-3-flash-preview"])];
let iModel = 0;
async function gemini(parts, schema) {
  if (!KEY) throw new Error("thiếu GEMINI_API_KEY");
  while (iModel < CHUOI.length) {
    const model = CHUOI[iModel];
    for (let lan = 0; lan < 3; lan++) {
      let r; try { r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${KEY}`, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.1, maxOutputTokens: 4096 } }), signal: AbortSignal.timeout(150000) }); }
      catch { await ngu(8000); continue; }
      if (r.status === 404 || (r.status === 429 && /PerDay|daily|quota/i.test(await r.clone().text()))) break;   // model hết hạn / hết quota ngày → model sau
      if (r.status === 429 || r.status === 503) { await ngu(30000); continue; }
      const j = await r.json().catch(() => null), t = j && j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts.map((p) => p.text || "").join("");
      if (r.ok && t) { try { return { model, ...JSON.parse(t) }; } catch { /* JSON hỏng → thử lại */ } }
      await ngu(4000);
    }
    iModel++;
  }
  throw new Error("Gemini: hết chuỗi model");
}
const b64 = (buf) => ({ inline_data: { mime_type: "image/jpeg", data: buf.toString("base64") } });
const txt = (text) => ({ text });

/* sharp: resize + extract trong 1 chuỗi bị «bad extract area» (đo 24/10) → chuẩn 1280×720 ở bước riêng */
const chuan = (buf) => sharp(buf).resize(W, H, { fit: "fill" }).toBuffer();
/* vùng mở rộng quanh bbox (ngữ cảnh) + khung vàng → ảnh gửi Gemini / dải */
const vungRong = (v) => { const px = v[2] * 0.6, py = v[3] * 0.6; const x = Math.max(0, Math.round(v[0] - px)), y = Math.max(0, Math.round(v[1] - py));
  return [x, y, Math.min(W - x, Math.round(v[2] + 2 * px)), Math.min(H - y, Math.round(v[3] + 2 * py))]; };
async function catVung(buf, v, rong = 512) {
  const r = vungRong(v), img = await sharp(await chuan(buf)).extract({ left: r[0], top: r[1], width: r[2], height: r[3] }).toBuffer();
  const svg = Buffer.from(`<svg width="${r[2]}" height="${r[3]}"><rect x="${v[0] - r[0]}" y="${v[1] - r[1]}" width="${v[2]}" height="${v[3]}" fill="none" stroke="#ffd400" stroke-width="3"/></svg>`);
  /* composite + resize cùng chuỗi → sharp thu nhỏ TRƯỚC rồi mới vẽ khung (khung lệch lên đầu người kiểm — đo 24/10) ⇒ 2 bước */
  const coKhung = await sharp(img).composite([{ input: svg, left: 0, top: 0 }]).toBuffer();
  return sharp(coKhung).resize(rong, null).jpeg({ quality: 82 }).toBuffer();
}

/* ---- đo ĐƯỜNG NÉT trong vùng: tương quan gradient (chuẩn hoá) giữa mẫu và khung — ít nhạy với đèn bật/tắt ---- */
async function netVung(buf, v) {
  const N = 64, c = await sharp(await chuan(buf)).extract({ left: v[0], top: v[1], width: v[2], height: v[3] }).toBuffer(), g = await sharp(c).greyscale().resize(N, N, { fit: "fill" }).raw().toBuffer();
  const o = new Float64Array(N * N);
  for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) { const p = (yy, xx) => g[yy * N + xx];
    const gx = p(y - 1, x + 1) + 2 * p(y, x + 1) + p(y + 1, x + 1) - p(y - 1, x - 1) - 2 * p(y, x - 1) - p(y + 1, x - 1);
    const gy = p(y + 1, x - 1) + 2 * p(y + 1, x) + p(y + 1, x + 1) - p(y - 1, x - 1) - 2 * p(y - 1, x) - p(y - 1, x + 1);
    o[y * N + x] = Math.hypot(gx, gy); }
  return o;
}
function tuongQuan(a, b) { let ma = 0, mb = 0; for (let i = 0; i < a.length; i++) { ma += a[i]; mb += b[i]; } ma /= a.length; mb /= b.length;
  let s = 0, sa = 0, sb = 0; for (let i = 0; i < a.length; i++) { const x = a[i] - ma, y = b[i] - mb; s += x * y; sa += x * x; sb += y * y; } return sa && sb ? s / Math.sqrt(sa * sb) : 0; }

try {
  /* ---- 2) KHOANH VÙNG ---- */
  const kT = await layKhung(T);
  if (!kT) { ghiKQ({ ketLuan: "chua-xac-dinh", lyDo: "camera không có hình lúc chụp" }); throw new Error("dừng"); }
  fs.writeFileSync(path.join(TAM, "T.jpg"), kT.buf);
  let VUNG = null, MO_TA = "";
  if (A.vung) { VUNG = String(A.vung).split(",").map(Number); MO_TA = String(A["mo-ta"] || "đồ vật trong ô người kiểm kéo"); }
  else {
    const kTruoc = await layKhung(T - 4 * 60e3);   // người kiểm thường đứng che đồ vật đúng lúc chụp → thêm khung 4 phút trước
    const anh = [];
    for (const u of anhKiem.slice(0, 3)) { try { const r = await fetch(u, { signal: AbortSignal.timeout(30000) }); if (r.ok) anh.push(await sharp(Buffer.from(await r.arrayBuffer())).resize(768, 768, { fit: "inside" }).jpeg({ quality: 80 }).toBuffer()); } catch { /* */ } }
    if (!anh.length) { ghiKQ({ ketLuan: "chua-xac-dinh", lyDo: "không tải được ảnh người kiểm chụp" }); throw new Error("dừng"); }
    const cam = [kT.buf].concat(kTruoc ? [kTruoc.buf] : []);
    const SCH = { type: "object", properties: { thay_tren_camera: { type: "boolean" }, mo_ta: { type: "string" }, bbox: { type: "array", items: { type: "integer" } }, anh_camera: { type: "integer" }, tin_cay: { type: "integer" }, ly_do: { type: "string" } },
      required: ["thay_tren_camera", "mo_ta", "bbox", "anh_camera", "tin_cay", "ly_do"] };
    const parts = [txt(`Kiểm soát kho. Lỗi vi phạm: «${LOI}». Vị trí: ${BIN}. ${anh.length} ảnh ĐIỆN THOẠI đầu là ảnh người kiểm chụp cận cảnh đồ vật vi phạm.`)]
      .concat(anh.map(b64)).concat([txt(`Tiếp theo là ${cam.length} ảnh CAMERA cố định (1280×720) cùng khu vực: ảnh camera 1 = đúng lúc chụp (người kiểm có thể đang đứng che), ảnh camera 2 = 4 phút trước.`)])
      .concat(cam.map(b64)).concat([txt("Tìm trên ảnh camera ĐỒ VẬT VI PHẠM CHÍNH trong ảnh điện thoại (đồ vật nổi bật, không phải người). Trả bbox [ymin,xmin,ymax,xmax] thang 0–1000 ôm sát đồ vật trên ảnh camera nhìn rõ nhất (anh_camera = 1 hoặc 2), mo_ta ngắn tiếng Việt (vd «pallet hàng Nivea quấn màng nằm ở lối đi»). Không chắc đó là cùng đồ vật → thay_tren_camera=false. tin_cay 0–100.")]);
    const g = await gemini(parts, SCH);
    KQ.khoanh = g;
    if (!g.thay_tren_camera || g.tin_cay < 60 || (g.bbox || []).length !== 4) { ghiKQ({ ketLuan: "chua-xac-dinh", lyDo: "máy chưa khoanh chắc được đồ vật trên camera (" + g.ly_do + ") — cần kéo ô 1 lần" }); throw new Error("dừng"); }
    const [y0, x0, y1, x1] = g.bbox; VUNG = [Math.round(x0 * W / 1000), Math.round(y0 * H / 1000), Math.round((x1 - x0) * W / 1000), Math.round((y1 - y0) * H / 1000)]; MO_TA = g.mo_ta;
  }
  VUNG = [Math.max(0, VUNG[0]), Math.max(0, VUNG[1]), Math.max(16, Math.min(W - VUNG[0], VUNG[2])), Math.max(16, Math.min(H - VUNG[1], VUNG[3]))];
  ghiKQ({ vung: VUNG, moTa: MO_TA });
  log(`vùng ${VUNG.join(",")} · ${MO_TA}`);
  /* 24/10 đo: ban đêm tắt đèn (02:05) Gemini + đường nét đều ra «không» → dò nhầm vào lúc BẬT ĐÈN 05:51 (đúng bẫy 05/10).
     Độ sáng cả khung < 65% khung mẫu = «tối» → không rõ, không làm mốc. */
  const sang = async (buf) => (await sharp(buf).greyscale().stats()).channels[0].mean;
  /* 24/10 đo tiếp: ban đêm camera sang HỒNG NGOẠI ĐEN TRẮNG (05:52 xám → 05:56 màu, pallet vẫn ở đó) — cả Gemini lẫn đường nét
     coi là «khác» ⇒ dò nhầm vào lúc đổi chế độ. Độ màu trung bình |R−G|+|G−B| (ảnh thu 64×36): mẫu có màu mà khung gần 0 → không rõ. */
  const doMau = async (buf) => { const { data, info } = await sharp(buf).resize(64, 36, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let t = 0; for (let i = 0; i < data.length; i += info.channels) t += Math.abs(data[i] - data[i + 1]) + Math.abs(data[i + 1] - data[i + 2]); return t / (data.length / info.channels); };
  const mauNet = await netVung(kT.buf, VUNG), mauCat = await catVung(kT.buf, VUNG), mauSang = await sang(kT.buf), mauMau = await doMau(kT.buf);

  /* ---- 3) PHÁN TỪNG KHUNG: Gemini co/khong/bi_che + đường nét ---- */
  const SCH2 = { type: "object", properties: { khung: { type: "array", items: { type: "object", properties: { anh: { type: "integer" }, trang_thai: { type: "string", enum: ["co", "khong", "bi_che"] }, tin_cay: { type: "integer" }, ly_do: { type: "string" } }, required: ["anh", "trang_thai", "tin_cay", "ly_do"] } } }, required: ["khung"] };
  async function phan(ds) {   // ds: [{ms, buf}] → gắn tt
    const cat = await Promise.all(ds.map((x) => catVung(x.buf, VUNG)));
    if (A.soi) { const sd = path.join(RA_DIR, "soi", ID); fs.mkdirSync(sd, { recursive: true }); fs.writeFileSync(path.join(sd, "mau.jpg"), mauCat);   // --soi: lưu đúng ảnh đã gửi Gemini để người kiểm
      ds.forEach((x, i) => { fs.writeFileSync(path.join(sd, iso(x.ms).replace(/[^0-9]/g, "").slice(4, 12) + ".jpg"), cat[i]); fs.writeFileSync(path.join(sd, iso(x.ms).replace(/[^0-9]/g, "").slice(4, 12) + "_full.jpg"), x.buf); }); }
    const parts = [txt(`Ảnh MẪU (lúc người kiểm chụp): trong khung VÀNG là «${MO_TA}».`), b64(mauCat),
      txt(`Sau đây ${ds.length} ảnh cùng camera, cùng vùng (khung vàng cùng chỗ), ở các thời điểm KHÁC, đánh số 1..${ds.length}.`)];
    cat.forEach((c, i) => { parts.push(txt("Ảnh " + (i + 1) + ":")); parts.push(b64(c)); });
    parts.push(txt("Với TỪNG ảnh: đồ vật trong mẫu có đang nằm ĐÚNG chỗ trong khung vàng không? co = cùng đồ vật đó (cùng loại hàng, cùng kiểu xếp/quấn) đang ở đó; khong = chỗ đó trống hoặc là đồ vật KHÁC; bi_che = người, xe nâng, XE ĐẨY, thùng hay đồ khác đặt CHẮN PHÍA TRƯỚC che một phần đồ vật, hoặc quá tối/nhoè, không nhìn được (bị che KHÔNG phải là «khong»). BỎ QUA khác biệt ánh sáng, bóng đổ, người đi ngang không che. tin_cay 0–100, ly_do ngắn tiếng Việt."));
    const g = await gemini(parts, SCH2);
    for (const [i, x] of ds.entries()) {
      const k = (g.khung || []).find((z) => z.anh === i + 1) || { trang_thai: "bi_che", tin_cay: 0, ly_do: "Gemini không trả" };
      x.net = Math.round(tuongQuan(mauNet, await netVung(x.buf, VUNG)) * 100) / 100;
      x.toi = (await sang(x.buf)) < mauSang * 0.65 || (mauMau > 8 && (await doMau(x.buf)) < mauMau * 0.3);   // tối hoặc hồng ngoại đen trắng
      x.gm = k.trang_thai; x.tc = k.tin_cay; x.lyDo = k.ly_do;
    }
    /* NGƯỠNG ĐƯỜNG NÉT riêng từng phiếu (canh ở vòng đầu): giữa trung vị «co» và «khong» Gemini chắc tay. Đo 24/10 phiếu 13393784:
       Gemini lite phán lẫn (cùng khung 14:33 vòng trước «co» vòng sau «khong») trong khi đường nét ổn định 0,49 vs 0,1 ⇒
       VÊNH mà đường nét cách ngưỡng ≥ 0,12 → theo đường nét (ghi x.theoNet, hạ độ chắc); vênh sát ngưỡng → không rõ. */
    if (NG.thr == null) {
      const tv = (a) => { const s = a.slice().sort((p, q) => p - q); return s.length ? s[Math.floor(s.length / 2)] : null; };
      const co = tv(ds.slice(1).filter((x) => !x.toi && x.gm === "co" && x.tc >= 70).map((x) => x.net)), kh = tv(ds.slice(1).filter((x) => !x.toi && x.gm === "khong" && x.tc >= 70).map((x) => x.net));
      if (co != null && kh != null && co - kh >= 0.2) NG.thr = Math.round((co + kh) / 2 * 100) / 100;
      KQ.nguongNet = NG.thr ?? null;
    }
    for (const x of ds) {
      if (x.toi || x.tc < 55 || x.gm === "bi_che") { x.tt = "khong-ro"; continue; }
      const t = NG.thr;
      if (t == null) { x.tt = x.gm === "co" && x.net < 0.15 ? "khong-ro" : x.gm === "khong" && x.net > 0.9 ? "khong-ro" : x.gm; continue; }
      const venh = (x.gm === "co" && x.net < t) || (x.gm === "khong" && x.net > t);
      if (!venh) { x.tt = x.gm; continue; }
      if (Math.abs(x.net - t) >= 0.12) { x.tt = x.net > t ? "co" : "khong"; x.theoNet = true; NG.venh++; } else x.tt = "khong-ro";
    }
    return g.model;
  }
  const NG = { thr: null, venh: 0 };

  /* ---- 4) DÒ: tìm «có» (mới) → «không» (cũ) gần T nhất, thu hẹp tới ≤ 3 phút ---- */
  async function dungVong(moc, nhan) {   // moc: ms giảm dần (mới → cũ), moc[0] đã biết «co»
    const ds = [];
    for (const m of moc) { const k = await layKhung(m); ds.push(k ? { ms: k.ms, buf: k.buf, xin: m } : { ms: m, buf: null, xin: m }); log(`  ${nhan} ${hm(m)} ${k ? "✓" : "✗ không hình"}`); }
    const coHinh = ds.filter((x) => x.buf);
    const model = coHinh.length ? await phan(coHinh) : "";
    for (const x of ds) if (!x.buf) x.tt = "khong-hinh";
    KQ.vong.push({ nhan, model, khung: ds.map((x) => ({ t: iso(x.ms), tt: x.tt, toi: x.toi || undefined, chapChon: x.chapChon || undefined, theoNet: x.theoNet || undefined, gm: x.gm, tc: x.tc, net: x.net, lyDo: x.lyDo })) }); ghiKQ({});
    log("   " + ds.map((x) => hm(x.ms).slice(6) + ":" + x.tt + (x.net != null ? "(" + x.net + ")" : "")).join(" · "));
    return ds;
  }
  let ds = await dungVong(MOC.map((h) => T - h * 36e5), "mốc 72h");
  let dai = ds, xongClip = null, lyDoDung = "", truoc = null, khongHep = false;
  for (let vong = 0; vong < 8; vong++) {
    /* mốc mới nhất là T (đồ vật có lúc chụp). Tìm khung «khong» đầu tiên từ mới → cũ; «co» rõ gần nhất phía mới hơn */
    /* «không» CHẬP CHỜN: khung «không» mà ≤ 20 phút trước đó lại «có» = bị che tạm (đo 24/10: xe đẩy đỏ đặt chắn trước pallet
       14:44–14:46 ngày 19/08, Gemini phán «không») → bỏ qua, dò tiếp về trước */
    const chapChon = (j) => ds.some((y, k) => k > j && y.tt === "co" && ds[j].ms - y.ms <= 20 * 60e3);
    for (const [j, x] of ds.entries()) if (j > 0 && x.tt === "khong" && chapChon(j)) { x.tt = "khong-ro"; x.chapChon = true; }
    const iKhong = ds.findIndex((x, i) => i > 0 && x.tt === "khong");
    if (iKhong < 0) { lyDoDung = ds.slice(1).every((x) => x.tt === "co") ? "co-tu-truoc" : "khong-ro"; break; }
    let iCo = -1; for (let i = iKhong - 1; i >= 0; i--) if (ds[i].tt === "co" || i === 0) { iCo = i; break; }
    /* giữa «co» và «khong» còn khung «không rõ» → vẫn thu hẹp trong cả khoảng (khung không rõ không dùng làm mốc) */
    const den = ds[iCo].ms, tu = ds[iKhong].ms;
    if (den - tu <= NGUONG_PHUT * 60e3) { xongClip = { tu, den }; break; }
    /* vòng trước không thu hẹp được (khung giữa đều «không hình» — đầu ghi chỉ ghi khi có chuyển động ⇒ không ai động vào lúc đó,
       hoặc «không rõ»): khoảng ≤ 10 phút → cắt clip cả khoảng; dài hơn → dừng, không đoán */
    if (vong > 0 && ((iCo === 0 && iKhong === ds.length - 1) || (truoc && truoc.tu === tu && truoc.den === den))) {
      khongHep = true;
      if (den - tu <= 10 * 60e3) { xongClip = { tu, den }; break; }
      lyDoDung = "khong-ro"; break;
    }
    truoc = { tu, den };
    const moc = [den].concat(Array.from({ length: 7 }, (_, i) => Math.round(den - (den - tu) * (i + 1) / 8))).concat([tu]);
    ds = await dungVong(moc, "thu hẹp " + hm(tu) + "→" + hm(den).slice(6));
    /* 2 đầu khoảng đã phán ở vòng trước (cùng khung — cache theo giây) → giữ kết luận cũ, chỉ phán 7 khung giữa */
    if (ds[0].tt !== "co" || ds[ds.length - 1].tt !== "khong") KQ.vong[KQ.vong.length - 1].venhDau = [ds[0].tt, ds[ds.length - 1].tt];
    ds[0].tt = "co"; ds[ds.length - 1].tt = "khong";
    dai = ds;
  }

  /* ---- 5) KẾT QUẢ: clip + ảnh trước/sau + dải vòng cuối ---- */
  const dai9 = async (ds2, ten) => {
    const Wn = 640, Hn = 360, cap = 32, comp = [];
    for (const [i, x] of ds2.slice(0, 9).entries()) {
      const left = (i % 3) * Wn, top = Math.floor(i / 3) * (Hn + cap), mau = { co: "#7CFC00", khong: "#ff5a5a" }[x.tt] || "#cccccc";
      const nhan = (i + 1) + ". " + iso(x.ms).slice(5, 19).replace("T", " ") + " · " + ({ co: "CÓ", khong: "KHÔNG", "khong-ro": "không rõ", "khong-hinh": "không hình" }[x.tt] || x.tt);
      comp.push({ input: Buffer.from(`<svg width="${Wn}" height="${cap}"><rect width="${Wn}" height="${cap}" fill="black"/><text x="8" y="23" font-size="20" font-family="Arial" font-weight="bold" fill="${mau}">${nhan}</text></svg>`), left, top });
      let im = x.buf ? await sharp(x.buf).resize(W, H, { fit: "fill" }).toBuffer() : await sharp({ create: { width: W, height: H, channels: 3, background: "#222" } }).jpeg().toBuffer();
      im = await sharp(im).composite([{ input: Buffer.from(`<svg width="${W}" height="${H}"><rect x="${VUNG[0]}" y="${VUNG[1]}" width="${VUNG[2]}" height="${VUNG[3]}" fill="none" stroke="${mau}" stroke-width="6"/></svg>`), left: 0, top: 0 }]).toBuffer();
      comp.push({ input: await sharp(im).resize(Wn, Hn).toBuffer(), left, top: top + cap });
    }
    await sharp({ create: { width: Wn * 3, height: 3 * (Hn + cap), channels: 3, background: "#000" } }).composite(comp).jpeg({ quality: 80 }).toFile(path.join(GOC, ten));
    return ten;
  };
  const tenLui = await dai9(dai, `${ID}_LUI-TV-${iso(Date.now() - 7 * 36e5).replace(/[^0-9]/g, "").slice(4, 12)}_ch${CH}.jpg`);
  if (!xongClip) {
    const lyDo = lyDoDung === "co-tu-truoc" ? "đồ vật đã có ở mọi khung tới 72 giờ trước — có từ trước đó, máy chưa lùi xa hơn" : "khung camera không đủ rõ để kết luận (bị che / mất hình / hai cách đo vênh nhau)";
    ghiKQ({ ketLuan: lyDoDung === "co-tu-truoc" ? "co-tu-truoc-72h" : "chua-xac-dinh", lyDo, anhLui: tenLui });
    log("✗ " + lyDo);
  } else {
    const { tu, den } = xongClip, tenClip = `${ID}_TRUY-${iso(tu).replace(/[^0-9]/g, "").slice(4, 12)}_ch${CH}.mp4`;
    let ok = false; for (const lech of [0, -20, 20]) { try { execFileSync(process.execPath, ["_cat-doan.mjs", HOST, CH, iso(tu - 20000 + lech * 1000), String(Math.round((den - tu) / 1000) + 40), path.join(GOC, tenClip)], { stdio: "ignore", windowsHide: true, timeout: 240000 }); } catch { /* */ }
      if (fs.existsSync(path.join(GOC, tenClip)) && fs.statSync(path.join(GOC, tenClip)).size > 50e3) { ok = true; break; } }
    const kTu = await layKhung(tu), kDen = await layKhung(den), anhTS = {};
    for (const [nh, k] of [["TRUOC", kTu], ["SAU", kDen]]) if (k) { const ten = `${ID}_TV-${nh}_ch${CH}.jpg`;
      await sharp(k.buf).resize(W, H, { fit: "fill" }).composite([{ input: Buffer.from(`<svg width="${W}" height="${H}"><rect x="${VUNG[0]}" y="${VUNG[1]}" width="${VUNG[2]}" height="${VUNG[3]}" fill="none" stroke="#ffd400" stroke-width="6"/><rect width="560" height="44" fill="black"/><text x="10" y="31" font-size="26" font-family="Arial" font-weight="bold" fill="#ffd400">${nh === "TRUOC" ? "TRƯỚC — chưa có" : "SAU — đã có"} · ${hm(k.ms)}</text></svg>`), left: 0, top: 0 }]).jpeg({ quality: 82 }).toFile(path.join(GOC, ten)); anhTS[nh] = ten; }
    /* độ chắc: cao khi 2 cách đo khớp ở cả 2 mốc chốt và vòng đầu không có khung «co» nào cũ hơn mốc «khong» (đồ vật không ra vào nhiều lần) */
    const vong0 = KQ.vong[0].khung, iK0 = vong0.findIndex((x, i) => i > 0 && x.tt === "khong"), raVao = vong0.slice(iK0 + 1).some((x) => x.tt === "co");
    const doChac = !ok ? "thap" : raVao || NG.venh || khongHep ? "vua" : "cao";
    ghiKQ({ ketLuan: "tim-thay", xuatHien: { tu: iso(tu), den: iso(den) }, clip: ok ? tenClip : "", anhTruoc: anhTS.TRUOC || "", anhSau: anhTS.SAU || "", anhLui: tenLui, doChac,
      venhGemini: NG.venh, khongHep, ghiChu: raVao ? "đồ vật từng có mặt ở mốc cũ hơn — có thể ra vào nhiều lần; clip là lần xuất hiện gần lúc chụp nhất" : "" });
    log(`✓ ${MO_TA} xuất hiện ${hm(tu)} → ${hm(den).slice(6)} · clip ${ok ? tenClip : "HỎNG"} · độ chắc ${doChac}`);
  }
} catch (e) { if (e.message !== "dừng") { log("✗ lỗi: " + e.message); ghiKQ({ ketLuan: KQ.ketLuan || "loi", lyDo: KQ.lyDo || e.message }); } else log("✗ " + KQ.lyDo); }
finally { await trinh.close().catch(() => {}); try { fs.rmSync(TAM, { recursive: true, force: true }); } catch { /* */ } }
/* --ghi: gắn vào sổ bằng chứng → trang Xác minh (bang-591 đọc .truy / .anhLui / .timVat). Ghi cả kết luận «chưa xác định» để lượt tự động
   không làm lại mãi; riêng «loi» (Gemini hết lượt, mạng) KHÔNG ghi → lượt sau thử lại. */
if (A.ghi && KQ.ketLuan && KQ.ketLuan !== "loi") {
  const F = path.join(EXP, "bang-chung-b1.json"), so = doc(F, {}), e = so[ID] || {}, cuoi = KQ.vong[KQ.vong.length - 1];
  if (KQ.anhLui && cuoi) { e.anhLui = KQ.anhLui; e.luiMoc = cuoi.khung.map((x) => x.t); e.luiCo = cuoi.khung.map((x) => x.tt !== "khong-hinh"); }
  e.timVat = { ketLuan: KQ.ketLuan, moTa: KQ.moTa || "", vung: KQ.vung || null, xuatHien: KQ.xuatHien || null, doChac: KQ.doChac || "", lyDo: KQ.lyDo || "", luc: KQ.luc };
  if (KQ.ketLuan === "tim-thay" && KQ.clip) e.truy = { clip: KQ.clip, tu: KQ.xuatHien.tu, den: KQ.xuatHien.den, kenh: "kênh " + CH, luc: KQ.luc, may: true, moTa: KQ.moTa, doChac: KQ.doChac };
  so[ID] = e; ghiJson(F, so); log("→ đã gắn vào bang-chung-b1.json");
}
