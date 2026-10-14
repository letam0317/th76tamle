/**
 * ============================================================================
 *  camera-bao-cao.mjs — CAMERA ĐÚNG GIỜ BÁO CÁO VỆ SINH (user 07/10/2026, luật VS-07)
 * ============================================================================
 *  "Với các việc vệ sinh quầy kệ: kiểm tra camera xem thời gian báo cáo (planogram) nhân viên có vệ sinh
 *   quầy kệ thực tế không; bổ sung camera ở mục Hình ảnh bằng chứng thay cho ảnh lấy từ Hình ảnh vi phạm."
 *
 *  KHÔNG AI — chỉ so điểm ảnh (nền trung vị) như _quet-nguoi-o.mjs / _roi-moc.mjs:
 *    1. Ô kệ (BIN00) → kênh camera theo tên kênh SmartPSS "<dãy>_<tủ a>-<tủ b>" (ban-do-camera-o.json tenKenh).
 *    2. Tải đầu ghi top-review cửa sổ [giờ báo cáo − 12′, + 1′] (đoạn ≤ 10′, không vắt qua mốc giờ chẵn).
 *    3. 1 khung / 5 s → nền = trung vị từng điểm ảnh → mặt nạ "đổi" → VÙNG KỆ (ROI): lấy từ bản đồ (khoá "<ô kệ>|ke")
 *       hoặc TỰ TÌM = cụm ô lưới 16×9 đổi nhiều nhất trong 3′ trước giờ nộp (người đứng tại kệ) → ghi lại bản đồ.
 *    4. Có mặt = tỉ lệ điểm đổi trong ROI ≥ 3 %. Khối có mặt CUỐI (kết thúc ≤ giờ nộp + 60 s, cho hở ≤ 20 s) →
 *       bắt đầu / kết thúc / số giây. Kết luận:
 *         co-thao-tac  TỔNG ≥ CO_THAO_TAC_GIAY (180 s) có người tại kệ trong cửa sổ → có làm việc tại kệ (vệ sinh/sắp xếp) — máy KHÔNG kết tội
 *         chi-chup     TỔNG ≤ CHI_CHUP_GIAY (60 s)       → chỉ ghé chụp ảnh báo cáo, không vệ sinh (chỉ được kết luận khi vùng kệ daKiem)
 *         khong-ro     ở giữa                       → nhờ người xem
 *         khong-thay   không có kênh / không có hình / không ai tới kệ
 *    5. Ảnh 3 mốc (bắt đầu · giữa · lúc nộp) ghép 1 tấm *_ANH-3-MOC.jpg; --clip → clip chuẩn _clip-noi.mjs
 *       (khung VÀNG = vùng kệ, khung ĐỎ nét đứt bám người theo trọng tâm chuyển động mỗi 10 s = điểm neo, nhãn tên NV,
 *       20 s đầu + 25 s cuối tốc độ thật, giữa ×3) → *_BAOCAO_CLIP-CHUAN.webm. Video gốc giữ tới B3 (xoa-video-sau-b3).
 *  Ra: .exports/cam-baocao/<task>/ket-qua.json {ketLuan, coMatGiay, batDau, ketThuc, kenh, roi, anh, clip, …}
 *      canh-b11.mjs ⑤(2) đọc file này: chi-chup → gắn PIC02/video02 + đóng B1; còn lại → nhắc anh Tâm.
 *
 *  node camera-bao-cao.mjs --task=14079520 --luc="2026-10-05 13:19:00" [--req=30318569] [--nv="Lý Thị Hoa Hạ"] [--clip] [--bin=F0-A1-504-10-04-04]
 *  Tải: chỉ đầu ghi top-review (≤ 2 kênh × 13′), 0 lượt work/wms/hr. Thẻ top-review hết hạn → tự chạy camera-a8.mjs 1 lần.
 * ============================================================================
 */
import fs from "node:fs"; import path from "node:path"; import { execFileSync } from "node:child_process"; import { fileURLToPath } from "node:url";
import sharp from "sharp";

const DIR = path.dirname(fileURLToPath(import.meta.url)); process.chdir(DIR);
const A = Object.fromEntries(process.argv.slice(2).map((x) => { const [k, ...v] = x.replace(/^--/, "").split("="); return [k, v.length ? v.join("=") : true]; }));
const ID = String(A.task || ""), LUC = String(A.luc || "").replace("T", " ").slice(0, 19), REQ = String(A.req || ""), NV = String(A.nv || "Nhân viên báo cáo");
const LAM_CLIP = !!A.clip;
/* 08/10/2026 (user: «gán camera mà không thông qua AI»): --khong-ai (hoặc CAM_KHONG_AI=1) = KHÔNG mô hình, KHÔNG so điểm ảnh, KHÔNG kết luận.
   Chỉ dùng dữ liệu cố định: ô → kênh (bản đồ) · giờ nộp báo cáo (planogram) · vùng mặt kệ đã người kiểm (daKiem) → cắt clip đúng cửa sổ,
   khung VÀNG vùng kệ, chữ giờ + tài khoản nộp; ảnh 3 mốc giờ cố định (−6′ · −3′ · lúc nộp). Người xem tự đánh giá; ketLuan = "khong-xet".
   --thu = diễn tập: ghi ket-qua.thu.json + ảnh/clip vào .exports/cam-baocao/<id>/ (không đụng Videos/, không đụng ket-qua.json). */
const KHONG_AI = !!A["khong-ai"] || Number(process.env.CAM_KHONG_AI || 0) === 1, THU = !!A.thu;
/* 08/10 (user: «2 mục này có dùng AI Gemini chạy được không — dạy cho Gemini chạy»): --gemini (hoặc CAM_AI=gemini) = Gemini đọc lô khung 1/5 s
   (_gemini-nguoi-vung.mjs): bbox người + HÀNH ĐỘNG (ve-sinh · sap-xep-hang · chup-anh · dung-yen · di-lai) → người chính tại kệ, khung đỏ bám theo bbox Gemini,
   kết luận theo giây hành động. Gemini không chạy được (quota/mạng) → rơi về đường KHÔNG AI (clip khung vàng, không kết luận). */
const GEMINI = !!A.gemini || String(process.env.CAM_AI || "").toLowerCase() === "gemini";
const VS_GIAY = Number(process.env.CAM_GM_VESINH_GIAY || 30), SX_GIAY = Number(process.env.CAM_GM_SAPXEP_GIAY || 60), NHAT_QUAN = Number(process.env.CAM_GM_NHAT_QUAN || 0.85);
const CO_THAO_TAC_GIAY = Number(process.env.CAM_CO_THAO_TAC || 180), CHI_CHUP_GIAY = Number(process.env.CAM_CHI_CHUP || 60);   // 07/10 v3: xét TỔNG giây có người trong cửa sổ (14079520: 226 s = có làm việc tại kệ)
const TRUOC_PHUT = Number(process.env.CAM_TRUOC_PHUT || 12), SAU_GIAY = 60, BUOC = 5;
const log = (...a) => console.log(new Date().toTimeString().slice(0, 8), ...a);
const VID = path.join(process.env.BAIXE_DIR ? path.dirname(process.env.BAIXE_DIR) : "C:/Users/lechitam/Videos/5S-bang-chung");
const OUT = path.join(DIR, ".exports", "cam-baocao", ID); fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(VID, { recursive: true });
/* 13/10: VAN DON DIA truoc khi tai luot moi — xoa raw luot truoc (da cat + dinh phieu) + van dia thap. Best-effort; PC moi xoa-ngay, laptop no-op. */
try { execFileSync(process.execPath, ["don-clip.mjs", "--im"], { cwd: DIR, windowsHide: true, stdio: "ignore", timeout: 120000 }); } catch { }
const F_KQ = path.join(OUT, THU ? "ket-qua.thu.json" : "ket-qua.json");
const ghiKQ = (o) => { fs.writeFileSync(F_KQ, JSON.stringify({ id: ID, luc: LUC, req: REQ, nv: NV, taiLuc: new Date().toISOString(), ...o }, null, 1)); return o; };
if (!ID || !/^\d{4}-\d\d-\d\d \d\d:\d\d/.test(LUC)) { console.log("dùng: node camera-bao-cao.mjs --task=<id> --luc=\"YYYY-MM-DD HH:MM:SS\" [--req=] [--nv=] [--clip]"); process.exit(2); }

/* ---- phiếu: ô kệ từ board cache (0 lượt) hoặc --bin ---- */
let bin = String(A.bin || "");
if (!bin) {
  const fb = fs.readdirSync(path.join(DIR, ".exports")).filter((f) => /^board591-live-\d{4}\.json$/.test(f)).sort().pop();
  const rows = fb ? JSON.parse(fs.readFileSync(path.join(DIR, ".exports", fb), "utf8")) : [];
  const x = rows.find((r) => String(r.id) === ID); bin = x ? String((x.data && x.data.configs && x.data.configs.BIN00) || "") : "";
}
if (!bin) { log("✗ không biết ô kệ (không có trong board cache) — truyền --bin="); ghiKQ({ ketLuan: "khong-thay", lyDo: "không có mã ô" }); process.exit(3); }
const khoaKe = (() => { const m = bin.match(/^F0-A1-(\d{3})-(\d{2})/); return m ? "F0-A1-" + m[1] + "-" + m[2] : bin; })();

/* ---- 1) kênh theo ô ---- */
const BD = JSON.parse(fs.readFileSync(path.join(DIR, "ban-do-camera-o.json"), "utf8")); const TK = BD.tenKenh || {};
const m = bin.toUpperCase().match(/(?:F0-)?(?:(A\d+)-)?(5L\d|\d{3})-?(\d{2})?/);
let kenh = [];
if (m && (m[1] || "A1") === "A1") {
  const day = m[2], tu = Number(m[3] || 0);
  for (const [k, t] of Object.entries(TK)) { if (k.startsWith("_") || k === "dauGhi") continue;
    const r = String(t).toUpperCase().match(/^([0-9L-]+)_(\d+)-(\d+)$/); if (!r) continue;
    if (r[1].split("-").includes(day) && tu >= +r[2] && tu <= +r[3]) kenh.push(k); }
}
const roiCu = BD.roi && BD.roi[khoaKe + "|ke"];
if (roiCu && roiCu.kenh) kenh = [roiCu.kenh, ...kenh.filter((k) => k !== roiCu.kenh)];
if (!kenh.length) { log("✗ không có kênh camera cho ô", bin); ghiKQ({ bin, khoaKe, ketLuan: "khong-thay", lyDo: "không có kênh camera trong bản đồ" }); process.exit(0); }
log(ID, "·", bin, "· báo cáo", LUC, "→ kênh", kenh.map((k) => k + " " + TK[k]).join(" | "));

/* ---- 2) tải đoạn (≤10′, không vắt mốc giờ chẵn) ---- */
const msLuc = new Date(LUC.replace(" ", "T") + "+07:00").getTime();
const t0 = msLuc - TRUOC_PHUT * 60e3, t1 = msLuc + SAU_GIAY * 1e3;
const vn = (ms) => new Date(ms + 7 * 36e5).toISOString().slice(0, 19);
const hhmmss = (ms) => vn(ms).slice(11, 19);
const doan = []; for (let a = t0; a < t1;) { const gioChan = Math.floor(a / 36e5) * 36e5 + 36e5; const z = Math.min(t1, a + 600e3, gioChan); doan.push([a, z]); a = z; }
const catDoan = (host, ch, a, z, f) => {
  for (let lan = 0; lan < 2; lan++) {
    try { execFileSync(process.execPath, ["_cat-doan.mjs", host, ch, vn(a), String(Math.round((z - a) / 1000)), f], { windowsHide: true, stdio: "pipe", timeout: 300000 }); return true; }
    catch (e) { if (e.status === 3 && lan === 0) { log("   thẻ top-review hết hạn → đăng nhập lại (camera-a8.mjs)"); try { execFileSync(process.execPath, ["camera-a8.mjs"], { windowsHide: true, stdio: "ignore", timeout: 120000 }); } catch { } continue; } return false; }
  }
  return false;
};
const ngu = (ms) => new Promise((r) => setTimeout(r, ms));
const nguon = {};   // kênh → [{file, a, z}]
for (const k of kenh.slice(0, KHONG_AI ? 1 : 2)) {   // không AI: 1 kênh (kênh có vùng daKiem đứng đầu) — nhẹ đầu ghi hơn
  const [host, ch] = k.split("/"); nguon[k] = [];
  for (const [a, z] of doan) {
    const f = path.join(VID, ID + "_" + khoaKe.replace(/^F0-/, "") + "_ch" + ch + "_" + hhmmss(a).replace(/:/g, "") + ".mp4");
    if (!fs.existsSync(f) || fs.statSync(f).size < 20000) { if (!catDoan(host, ch, a, z, f)) { log("   ⚠ không tải được", path.basename(f)); continue; } await ngu(2000); }
    nguon[k].push({ file: f, a, z });
  }
  log("   kênh " + k + ": " + nguon[k].length + "/" + doan.length + " đoạn");
}

/* ---- ghép ảnh 3 mốc (dùng chung): mocs = [{ms, f, nhan}], khungVang = [x,y,w,h] | null ---- */
async function ghepAnh3Moc(mocs, khungVang, raF) {
  const comp = []; const Wt = 640, Ht = 360;
  for (const [i, x] of mocs.entries()) {
    let goc = await sharp(x.f).resize(1280, 720, { fit: "fill" }).toBuffer();
    if (khungVang) { const [rx, ry, rw, rh] = khungVang;
      const svgV = Buffer.from(`<svg width="1280" height="720"><rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="none" stroke="#ffd400" stroke-width="6"/></svg>`);
      goc = await sharp(goc).composite([{ input: svgV, left: 0, top: 0 }]).toBuffer(); }   // sharp: resize luôn chạy trước composite trong 1 chuỗi → ghép xong rồi mới thu nhỏ
    const img = await sharp(goc).resize(Wt, Ht).toBuffer();
    const svg = Buffer.from(`<svg width="${Wt}" height="30"><rect width="${Wt}" height="30" fill="black"/><text x="6" y="21" font-size="17" font-family="Arial" fill="yellow">${hhmmss(x.ms)} ${vn(x.ms).slice(8, 10)}/${vn(x.ms).slice(5, 7)} · ${String(x.nhan).replace(/[<&]/g, "")}</text></svg>`);
    comp.push({ input: img, left: i * Wt, top: 30 }, { input: svg, left: i * Wt, top: 0 }); }
  await sharp({ create: { width: Wt * mocs.length, height: Ht + 30, channels: 3, background: "#000" } }).composite(comp).jpeg({ quality: 82 }).toFile(raF);
}

/* ============================================================================
 *  KHÔNG AI (08/10/2026) — chỉ cắt đúng kênh · đúng cửa sổ giờ nộp; không đếm, không kết luận
 *    · vùng kệ: CHỈ lấy từ bản đồ khi đã người kiểm (daKiem) → khung VÀNG; chưa có thì không vẽ, chú thích nói rõ
 *    · ảnh 3 mốc giờ cố định: −6′ · −3′ · lúc nộp (ảnh thật từ video, không chọn theo "có người")
 *    · clip: [đầu cửa sổ → nộp − 90 s] tua ×5 (nhãn ▶▶ x5) + [nộp − 90 s → nộp + 30 s] tốc độ thật; không khung đỏ, không dán tên lên người
 *    · ketLuan = "khong-xet" → canh-b11 (B11_CAM_KHONG_AI=1) gắn PIC02/video02 vào B1, KHÔNG đóng B1, nhờ anh Tâm xem
 * ============================================================================ */
async function chayKhongAI(lyDoAI) {
  const k = Object.keys(nguon).find((x) => nguon[x].length);
  if (!k) { log("✗ không tải được hình từ đầu ghi"); ghiKQ({ bin, khoaKe, kenh, ketLuan: "khong-thay", lyDo: "không tải được hình từ đầu ghi", khongAI: true, lyDoAI }); process.exit(0); }
  const ds = nguon[k], ch = k.split("/")[1], keNgan = khoaKe.replace(/^F0-/, "");
  const roi = roiCu && roiCu.kenh === k && roiCu.daKiem ? roiCu.khung : null;
  const tim = (ms) => ds.find((d) => ms >= d.a && ms < d.z);
  const OUT_F = THU ? OUT : VID;
  log("   không AI · kênh " + k + " " + TK[k] + " · vùng kệ " + (roi ? JSON.stringify(roi) + " (bản đồ, đã kiểm)" : "CHƯA có trong bản đồ → không vẽ khung"));
  /* ảnh 3 mốc */
  const nhanMoc = ["6 phút trước lúc nộp báo cáo", "3 phút trước lúc nộp báo cáo", "Lúc nộp báo cáo " + LUC.slice(11, 16)];
  const mocs = [];
  for (const [i, lech] of [-360e3, -180e3, 0].entries()) {
    const ms = Math.max(ds[0].a, Math.min(msLuc + lech, ds[ds.length - 1].z - 1500)); const d = tim(ms); if (!d) continue;
    const tien = path.join(OUT, "moc" + i + "_ch" + ch), f = tien + "_f0.jpg";
    if (!fs.existsSync(f)) try { execFileSync(process.execPath, ["_khung.mjs", d.file, tien, String(Math.max(0, Math.round((ms - d.a) / 1000)))], { windowsHide: true, stdio: "ignore", timeout: 300000, env: { ...process.env, DON: "1" } }); } catch { }
    if (fs.existsSync(f)) mocs.push({ ms, f, nhan: nhanMoc[i] });
  }
  let anhF = "";
  if (mocs.length) { anhF = path.join(OUT_F, ID + "_" + keNgan + "_BAOCAO_ANH-3-MOC.jpg"); await ghepAnh3Moc(mocs, roi, anhF); log("   ảnh 3 mốc → " + path.basename(anhF)); }
  else log("   ⚠ không trích được ảnh mốc");
  /* clip */
  let clipF = "";
  if (LAM_CLIP) {
    const THAT = Number(process.env.CAM_KHONG_AI_THAT_GIAY || 90) * 1000, TOC = Number(process.env.CAM_KHONG_AI_TOC || 5);
    const a0 = ds[0].a, z0 = Math.min(msLuc + 30e3, ds[ds.length - 1].z - 1000);
    const chuKe = "Kệ " + keNgan + (roi ? "" : " — vùng kệ chưa đánh dấu trên camera, xem nhãn tủ trên kệ");
    const moc = [];
    if (msLuc - THAT - a0 > 15000) moc.push([a0, msLuc - THAT, TOC, chuKe + " trước lúc nộp báo cáo (tua nhanh)"]);
    moc.push([Math.max(a0, msLuc - THAT), z0, 1, LUC.slice(11, 19) + " tài khoản " + NV + " nộp báo cáo vệ sinh" + (REQ ? " (Yêu cầu " + REQ + ")" : "") + "\n" + chuKe]);
    const ng = {}; ds.forEach((d, i) => { ng["d" + i] = { file: d.file, bd: hhmmss(d.a) }; });
    const dsDoan = [];
    for (const [a, z, toc, chu] of moc) { let t = a; while (t < z) { const i = ds.findIndex((d) => t >= d.a && t < d.z); if (i < 0) break; const d = ds[i]; const zz = Math.min(z, d.z - 500);
      if (zz - t >= 1500) dsDoan.push({ n: "d" + i, tu: hhmmss(t), den: hhmmss(zz), toc, chu, ...(roi ? { khung: roi } : {}) }); t = zz + 500; } }
    clipF = path.join(OUT_F, ID + "_" + keNgan + "_BAOCAO_CLIP-CAMERA.webm");
    const cfg = { ra: clipF, tieuDe: bin + " · báo cáo vệ sinh " + LUC.slice(11, 16) + " " + LUC.slice(8, 10) + "/" + LUC.slice(5, 7) + "/" + LUC.slice(0, 4) + " · camera " + TK[k], kbps: 1400, nguon: ng, doan: dsDoan };
    const cfgF = path.join(OUT, "cau-hinh-clip-khong-ai.json"); fs.writeFileSync(cfgF, JSON.stringify(cfg, null, 1));
    const lock = path.join(DIR, ".exports", ".dung-clip.lock");
    try { if (fs.existsSync(clipF) && fs.statSync(clipF).size >= 50000) log("   clip đã có → dùng lại " + path.basename(clipF));   // lượt thử lại (bình luận trượt) không dựng lại 4′
      else if (fs.existsSync(lock) && Date.now() - fs.statSync(lock).mtimeMs < 30 * 60e3) { log("   máy đang dựng clip khác (khoá .dung-clip.lock) — bỏ clip lượt này"); clipF = ""; }
      else { fs.writeFileSync(lock, ID); try { execFileSync(process.execPath, ["_clip-noi.mjs", cfgF], { windowsHide: true, stdio: "pipe", timeout: 40 * 60e3 }); } finally { try { fs.unlinkSync(lock); } catch { } }
        if (!fs.existsSync(clipF) || fs.statSync(clipF).size < 50000) { log("   ⚠ clip không dựng được"); clipF = ""; } else log("   clip → " + path.basename(clipF) + " " + (fs.statSync(clipF).size / 1048576).toFixed(1) + " MB"); } }
    catch (e) { log("   ⚠ dựng clip: " + String(e.message).slice(0, 120)); clipF = ""; }
  }
  ghiKQ({ bin, khoaKe, kenh: k, tenKenh: TK[k], roi, roiTuTim: false, roiDaKiem: !!roi, cachDo: "không AI (cắt theo giờ nộp, không kết luận)" + (lyDoAI ? " — " + lyDoAI : ""), ketLuan: "khong-xet", khongAI: true, lyDoAI,
    anh: anhF, clip: clipF, video: ds.map((d) => d.file) });
  log("XONG không AI · khong-xet · kênh " + k + " · ảnh " + (anhF ? path.basename(anhF) : "-") + (clipF ? " · clip " + path.basename(clipF) : "") + (lyDoAI ? " · " + lyDoAI : "") + (THU ? " (diễn tập → " + OUT + ")" : ""));
  process.exit(0);
}
if (KHONG_AI) await chayKhongAI();

/* ---- 3) khung 1/5 s → xám 320×180 ---- */
async function khungCua(k) {
  const ds = nguon[k]; if (!ds || !ds.length) return [];
  const kh = [];
  for (const d of ds) {
    const tien = path.join(OUT, "k" + k.split("/")[1] + "_" + hhmmss(d.a).replace(/:/g, ""));
    const ts = []; for (let t = 0; t < (d.z - d.a) / 1000 - 1; t += BUOC) ts.push(String(t));
    const thieu = ts.some((_, i) => !fs.existsSync(tien + "_f" + i + ".jpg"));
    if (thieu) try { execFileSync(process.execPath, ["_khung.mjs", d.file, tien, ...ts], { windowsHide: true, stdio: "ignore", timeout: 600000, env: { ...process.env, DON: "1" } }); } catch { }
    for (const [i, t] of ts.entries()) { const f = tien + "_f" + i + ".jpg"; if (fs.existsSync(f)) kh.push({ ms: d.a + Number(t) * 1000, f }); }
  }
  for (const x of kh) x.g = new Uint8Array(await sharp(x.f).resize(320, 180, { fit: "fill" }).grayscale().raw().toBuffer());
  return kh.sort((p, q) => p.ms - q.ms);
}
const W = 320, H = 180, NGUONG = 28;
const nenTrungVi = (kh) => { const bg = new Uint8Array(W * H), col = new Uint8Array(kh.length);
  for (let i = 0; i < W * H; i++) { for (let j = 0; j < kh.length; j++) col[j] = kh[j].g[i]; col.sort(); bg[i] = col[kh.length >> 1]; } return bg; };
const matNa = (g, bg) => { const mk = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) mk[i] = Math.abs(g[i] - bg[i]) > NGUONG ? 1 : 0; return mk; };

/* ---- 4) ROI + có mặt ---- */
function timROI(kh, mks) {   // cụm ô lưới 16×9 (20×20 px) đổi nhiều nhất trong 3′ trước giờ nộp (+30 s)
  const chon = kh.map((x, i) => [x, i]).filter(([x]) => x.ms >= msLuc - 180e3 && x.ms <= msLuc + 30e3).map(([, i]) => i);
  if (!chon.length) return null;
  const diem = new Float32Array(16 * 9);
  for (const i of chon) { const mk = mks[i]; for (let cy = 0; cy < 9; cy++) for (let cx = 0; cx < 16; cx++) { let n = 0; for (let y = cy * 20; y < cy * 20 + 20; y++) for (let x = cx * 20; x < cx * 20 + 20; x++) n += mk[y * W + x]; diem[cy * 16 + cx] += n / 400; } }
  let max = 0, imax = -1; for (let i = 0; i < diem.length; i++) { diem[i] /= chon.length; if (diem[i] > max) { max = diem[i]; imax = i; } }
  if (max < 0.08) return null;   // chẳng có gì đổi quanh giờ nộp
  /* lan từ ô max sang các ô kề có điểm ≥ 35 % max (cụm người đứng) */
  const trong = new Set([imax]); const hang = [imax];
  while (hang.length) { const i = hang.pop(); const cx = i % 16, cy = (i / 16) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= 16 || ny >= 9) continue; const j = ny * 16 + nx;
      if (!trong.has(j) && diem[j] >= max * 0.35) { trong.add(j); hang.push(j); } } }
  let x0 = 16, y0 = 9, x1 = -1, y1 = -1; for (const i of trong) { const cx = i % 16, cy = (i / 16) | 0; x0 = Math.min(x0, cx); y0 = Math.min(y0, cy); x1 = Math.max(x1, cx); y1 = Math.max(y1, cy); }
  if ((x1 - x0 + 1) * (y1 - y0 + 1) > 60) { x0 = Math.max(0, imax % 16 - 1); x1 = Math.min(15, imax % 16 + 1); y0 = Math.max(0, ((imax / 16) | 0) - 2); y1 = Math.min(8, ((imax / 16) | 0) + 2); }
  return { khung: [x0 * 80, y0 * 80, (x1 - x0 + 1) * 80, (y1 - y0 + 1) * 80], diem: Math.round(max * 100) / 100, tuTim: true };
}
function doCoMat(kh, mks, roi) {
  const [rx, ry, rw, rh] = roi.khung.map((v) => v / 4); const x0 = Math.max(0, rx | 0), y0 = Math.max(0, ry | 0), x1 = Math.min(W, (rx + rw) | 0), y1 = Math.min(H, (ry + rh) | 0);
  const dt = (x1 - x0) * (y1 - y0) || 1;
  return kh.map((x, i) => { const mk = mks[i]; let n = 0, sx = 0, sy = 0; for (let y = y0; y < y1; y++) for (let x2 = x0; x2 < x1; x2++) if (mk[y * W + x2]) { n++; sx += x2; sy += y; }
    return { ms: x.ms, f: x.f, ti: n / dt, co: n / dt >= 0.03, cx: n ? sx / n * 4 : null, cy: n ? sy / n * 4 : null }; });
}
function khoiCuoi(cm) {   // khối có mặt cuối cùng kết thúc ≤ giờ nộp + 60 s; hở ≤ 20 s vẫn nối. tong = MỌI giây có mặt trong cửa sổ (NV đi dọc tủ, có khoảng rời)
  const co = cm.filter((x) => x.co && x.ms <= msLuc + SAU_GIAY * 1e3); if (!co.length) return null;
  const buocThat = cm.length > 1 ? Math.max(1, Math.round((cm[cm.length - 1].ms - cm[0].ms) / 1000 / (cm.length - 1))) : BUOC;
  const tong = co.length * buocThat;
  let z = co[co.length - 1], a = z;
  for (let i = co.length - 2; i >= 0; i--) { if (a.ms - co[i].ms <= 20e3) a = co[i]; else break; }
  if (msLuc - z.ms > 90e3) return null;   // người rời kệ quá lâu trước lúc nộp → không phải lượt báo cáo
  return { a: a.ms, z: Math.max(z.ms, Math.min(msLuc, z.ms + buocThat * 1000)), giay: Math.round((Math.max(z.ms, msLuc) - a.ms) / 1000), tong, buocThat, dauTien: co[0].ms, ds: co.filter((x) => x.ms >= a.ms) };
}

/* 07/10 (bài học 14079520): so điểm ảnh đếm cả xe đẩy/thùng/pallet đổi chỗ → có mặt GIẢ (205 s mà vùng trống).
   Đo CHÍNH = NGƯỜI thật trong vùng (COCO-SSD qua _nguoi-trong-vung.mjs, 1 khung/2 s, không nhận mặt); điểm ảnh chỉ để TỰ TÌM vùng + dự phòng. */
async function doNguoi(k, roi) {
  const ds = nguon[k]; if (!ds || !ds.length) return null;
  const cfg = { doan: ds.map((d) => ({ file: d.file, batDau: hhmmss(d.a) })), vung: roi.khung, buoc: 2, noi: 40, ra: path.join(OUT, "nguoi_k" + k.split("/")[1] + ".json") };
  const cf = path.join(OUT, "cau-hinh-nguoi_k" + k.split("/")[1] + ".json"); fs.writeFileSync(cf, JSON.stringify(cfg));
  if (!fs.existsSync(cfg.ra)) try { execFileSync(process.execPath, ["_nguoi-trong-vung.mjs", cf], { windowsHide: true, stdio: "pipe", timeout: 30 * 60e3 }); } catch (e) { log("   ⚠ dò người: " + String(e.message).slice(0, 100)); return null; }
  let kq; try { kq = JSON.parse(fs.readFileSync(cfg.ra, "utf8")); } catch { return null; }
  return kq.map((x) => { const d = ds[x.doan]; const ms = d.a + x.ms; const nv = x.trong[0] || null;
    return { ms, f: null, co: x.trong.length > 0, cx: nv ? nv[0] + nv[2] / 2 : null, cy: nv ? nv[1] + nv[3] / 2 : null, k: nv }; }).sort((p, q) => p.ms - q.ms);
}
/* 08/10 GEMINI: lô 8 khung/5 s → _gemini-nguoi-vung.mjs → người chính tại kệ (nhiều khung trong vùng nhất, ưu tiên có mặt ±60 s quanh giờ nộp)
   → cm cùng khuôn với doNguoi (co = người chính tại kệ, k = bbox Gemini) + gm {hanhDongGiay, nhatQuan, dinhDanh}. Không gửi tên NV cho Gemini. */
async function doNguoiGemini(k, roi, kh) {
  const tuSo = (bin.match(/^F0-A1-(\d{3}|5L\d)-(\d{2})/) || []);
  const cfg = { khung: kh.map((x) => ({ f: x.f, gio: hhmmss(x.ms), ms: x.ms })), vung: roi && roi.khung ? roi.khung : null, tu: tuSo[2] ? "tủ " + tuSo[2] + " dãy " + tuSo[1] : khoaKe, lo: 8, ra: path.join(OUT, "gemini_k" + k.split("/")[1] + ".json") };
  const cf = path.join(OUT, "cau-hinh-gemini_k" + k.split("/")[1] + ".json"); fs.writeFileSync(cf, JSON.stringify(cfg));
  if (!fs.existsSync(cfg.ra)) try { execFileSync(process.execPath, ["_gemini-nguoi-vung.mjs", cf], { windowsHide: true, stdio: "pipe", timeout: 40 * 60e3 }); } catch (e) { log("   ⚠ Gemini: " + String(e.message).slice(0, 120)); return null; }
  let g; try { g = JSON.parse(fs.readFileSync(cfg.ra, "utf8")); } catch { return null; }
  if (!g.khung || g.khung.length < 10) { log("   ⚠ Gemini: " + (g.loi || "quá ít khung")); try { fs.unlinkSync(cfg.ra); } catch { } return null; }
  if (g.loi) log("   ⚠ Gemini dừng giữa chừng (" + g.loi + ") — dùng " + g.khung.length + "/" + kh.length + " khung");
  /* người chính */
  const diem = {}; const quanAo = {};
  for (const x of g.khung) for (const p of x.nguoi) if (p.trong) { diem[p.ma] = (diem[p.ma] || 0) + 1 + (Math.abs(x.ms - msLuc) <= 60e3 ? 3 : 0); quanAo[p.ma] = p.quanAo; }
  const nguoiChinh = Object.entries(diem).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  if (!nguoiChinh) { log("   Gemini: không ai đứng tại kệ trong cửa sổ"); }
  const buoc = g.khung.length > 1 ? Math.max(1, Math.round((g.khung[g.khung.length - 1].ms - g.khung[0].ms) / 1000 / (g.khung.length - 1))) : BUOC;
  const hanhDongGiay = { "ve-sinh": 0, "sap-xep-hang": 0, "chup-anh": 0, "dung-yen": 0, "di-lai": 0, "khong-ro": 0 };
  let nhay = 0, chuyen = 0, truoc = null, nguoiKhacGan = false, coGanNop = false;
  const cm = g.khung.map((x) => { const p = nguoiChinh ? x.nguoi.find((n) => n.ma === nguoiChinh) : null; const co = !!(p && p.trong);
    if (co) { hanhDongGiay[p.hanhDong in hanhDongGiay ? p.hanhDong : "khong-ro"] += buoc; if (Math.abs(x.ms - msLuc) <= 60e3) coGanNop = true; }
    if (Math.abs(x.ms - msLuc) <= 60e3 && x.nguoi.some((n) => n.trong && n.ma !== nguoiChinh)) nguoiKhacGan = true;
    if (p && truoc) { chuyen++; if (Math.hypot(p.k[0] + p.k[2] / 2 - truoc[0], p.k[1] + p.k[3] / 2 - truoc[1]) > 300) nhay++; }
    truoc = p ? [p.k[0] + p.k[2] / 2, p.k[1] + p.k[3] / 2] : null;
    return { ms: x.ms, f: x.f, co, cx: p ? p.k[0] + p.k[2] / 2 : null, cy: p ? p.k[1] + p.k[3] / 2 : null, k: p ? p.k.slice() : null, hd: p ? p.hanhDong : null, nguoiKhac: x.nguoi.filter((n) => n.trong && n.ma !== nguoiChinh).length }; });
  cm.gm = { model: g.model, tokens: g.tokens || 0, giay: g.giay || 0, nguoiChinh, quanAo: nguoiChinh ? quanAo[nguoiChinh] : "", hanhDongGiay, nhatQuan: chuyen ? Math.round((1 - nhay / chuyen) * 100) / 100 : 1, dinhDanh: coGanNop && !nguoiKhacGan, soNguoi: Object.keys(diem).length, loi: g.loi || "" };
  log("   Gemini " + g.model + ": " + g.khung.length + " khung · " + cm.gm.soNguoi + " người từng tại kệ · người chính " + (nguoiChinh || "-") + " (" + cm.gm.quanAo + ") · giây: " + Object.entries(hanhDongGiay).filter(([, v]) => v).map(([a, v]) => a + " " + v).join(", ") + " · nhất quán " + cm.gm.nhatQuan + " · định danh " + (cm.gm.dinhDanh ? "được (có mặt ±60 s, không ai khác)" : "KHÔNG"));
  return cm;
}
let tot = null;
for (const k of Object.keys(nguon)) {
  const kh = await khungCua(k); if (kh.length < 10) { log("   kênh " + k + ": thiếu hình (" + kh.length + " khung)"); continue; }
  const bg = nenTrungVi(kh), mks = kh.map((x) => matNa(x.g, bg));
  const roi = (roiCu && roiCu.kenh === k) ? { khung: roiCu.khung, tuTim: false, daKiem: !!roiCu.daKiem } : (timROI(kh, mks) || (GEMINI ? { khung: null, tuTim: false, daKiem: false } : null));   // Gemini: không có vùng vẫn chạy (Gemini đọc nhãn tủ)
  if (!roi) { log("   kênh " + k + ": không thấy ai đổi quanh giờ nộp"); continue; }
  let cm = A.pixel ? null : GEMINI ? await doNguoiGemini(k, roi, kh) : await doNguoi(k, roi); let cach = GEMINI ? "Gemini" : "người (mô hình)";
  if (!cm && GEMINI) { log("   Gemini không chạy được → rơi về đường KHÔNG AI"); await chayKhongAI("Gemini không chạy được"); }
  if (!cm) { cm = doCoMat(kh, mks, roi); cach = "điểm ảnh (dự phòng)"; roi.daKiem = false; }   // dự phòng không được kết tội
  if (cm.gm) cach = "Gemini " + cm.gm.model;
  if (!cm.gm) for (const x of cm) { x.f = kh.reduce((p, q) => Math.abs(q.ms - x.ms) < Math.abs(p.ms - x.ms) ? q : p).f; }   // khung ảnh gần nhất để ghép ảnh mốc (Gemini đã có f)
  roi.cach = cach;
  const kc = khoiCuoi(cm);
  log("   kênh " + k + ": ROI " + JSON.stringify(roi.khung) + (roi.tuTim ? " (tự tìm, điểm " + roi.diem + ")" : roi.daKiem ? " (bản đồ, đã kiểm)" : roi.khung ? " (bản đồ, CHƯA kiểm)" : " (không vùng)") + " · đo bằng " + roi.cach + " · có mặt khối cuối " + (kc ? kc.giay + " s từ " + hhmmss(kc.a) + " · tổng cửa sổ " + kc.tong + " s từ " + hhmmss(kc.dauTien) : "0 s"));
  if (kc && (!tot || kc.giay > tot.kc.giay)) tot = { k, kh, roi, cm, kc };
}
if (!tot) { log("✗ không kênh nào thấy người tại kệ quanh giờ nộp"); ghiKQ({ bin, khoaKe, kenh, ketLuan: "khong-thay", lyDo: "không thấy người tại vùng kệ quanh giờ nộp", ai: GEMINI ? "gemini" : "coco" }); process.exit(0); }
const { k, roi, kc, cm } = tot, giay = kc.giay;
/* 07/10 bài học 14079520: vùng kệ TỰ TÌM bắt trúng lối đi/pallet → đếm cả người khác, khung đỏ bám pallet. Vì vậy:
   «chi-chup» (kết tội) CHỈ khi vùng kệ đã được NGƯỜI kiểm (ban-do roi.daKiem = true); vùng tự tìm → tối đa «khong-ro» + nhờ anh Tâm.
   Số giây dùng TỔNG có mặt trong cửa sổ (NV đi dọc tủ, có khoảng rời) cho «co-thao-tac»; khối cuối cho «chi-chup». */
let ketLuan = kc.tong >= CO_THAO_TAC_GIAY ? "co-thao-tac" : kc.tong <= CHI_CHUP_GIAY ? "chi-chup" : "khong-ro";   // v3: cả 2 ngưỡng đều xét TỔNG (khối cuối 76 s từng cho «chỉ chụp» sai dù NV ở kệ 226 s)
/* 08/10 GEMINI: kết luận theo GIÂY HÀNH ĐỘNG của người chính tại kệ (không chỉ theo giây có mặt):
   ve-sinh ≥ VS_GIAY → «co-ve-sinh» (có lau dọn thật) · không lau & tổng có mặt ≤ CHI_CHUP → «chi-chup» · sap-xep-hang ≥ SX_GIAY → «co-thao-tac» (làm việc tại kệ nhưng không lau) · còn lại «khong-ro». */
if (cm.gm) { const g = cm.gm.hanhDongGiay;
  ketLuan = g["ve-sinh"] >= VS_GIAY ? "co-ve-sinh" : (g["ve-sinh"] === 0 && kc.tong <= CHI_CHUP_GIAY) ? "chi-chup" : g["sap-xep-hang"] >= SX_GIAY ? "co-thao-tac" : "khong-ro";
  log("   Gemini kết luận " + ketLuan + " (lau " + g["ve-sinh"] + " s · xếp hàng " + g["sap-xep-hang"] + " s · chụp " + g["chup-anh"] + " s · đứng " + g["dung-yen"] + " s · có mặt tổng " + kc.tong + " s)"); }
if (ketLuan === "chi-chup" && !roi.daKiem) { ketLuan = "khong-ro"; log("   vùng kệ chưa được người kiểm → không kết luận «chỉ chụp», để anh Tâm xem."); }
/* bản đồ ô → kênh → ROI (chỉ ghi khi tự tìm; nguồn = phiếu) */
if (roi.tuTim && roi.khung) { BD.roi = BD.roi || {}; BD.roi[khoaKe + "|ke"] = { kenh: k, khung: roi.khung, moTa: "vùng người đứng tại kệ " + khoaKe + " lúc nộp báo cáo vệ sinh (tự tìm, camera-bao-cao)", nguon: ID + " (" + LUC + ")" };
  BD.kenh = BD.kenh || {}; if (!BD.kenh[k]) BD.kenh[k] = { nhan: TK[k], o: [khoaKe], nguon: ID + " (camera-bao-cao " + LUC + ")" };
  fs.writeFileSync(path.join(DIR, "ban-do-camera-o.json"), JSON.stringify(BD, null, 1)); }

/* ---- 5) ảnh 3 mốc (chỉ làm BẰNG CHỨNG khi vùng kệ đã kiểm; chưa kiểm → ảnh soi nội bộ _SOI-3-MOC, không gắn phiếu) ---- */
const [host, ch] = k.split("/");
const DA_KIEM = !!roi.daKiem;
/* CAM-06: bằng chứng chạy từ LẦN CÓ MẶT ĐẦU trong cửa sổ (NV đi dọc tủ) tới lúc nộp — không chỉ khối cuối */
const coTat = cm.filter((x) => x.co && x.ms <= msLuc + SAU_GIAY * 1e3);
/* 08/10 GEMINI: clip được dựng khi khung đỏ = bbox Gemini nhất quán (≥ NHAT_QUAN, ≥ 6 khung có người chính) dù vùng kệ chưa daKiem; nhãn tên chỉ khi định danh được */
const GM_OK = !!(cm.gm && cm.gm.nguoiChinh && coTat.length >= 6 && cm.gm.nhatQuan >= NHAT_QUAN);
const CLIP_OK = DA_KIEM || GM_OK;
const NHAN_NV = cm.gm ? (cm.gm.dinhDanh ? NV : "Người tại kệ") : NV;
const OUT_F = THU ? OUT : VID;
const mocs = [coTat[0], coTat[coTat.length >> 1], cm.reduce((p, q) => Math.abs(q.ms - msLuc) < Math.abs(p.ms - msLuc) ? q : p)];
const nhanMoc = ["Bắt đầu có mặt tại kệ", "Giữa lượt", "Lúc nộp báo cáo " + LUC.slice(11, 16)];
const anhF = path.join(CLIP_OK ? OUT_F : OUT, ID + "_" + khoaKe.replace(/^F0-/, "") + (CLIP_OK ? "_BAOCAO_ANH-3-MOC.jpg" : "_SOI-3-MOC.jpg"));
{ const comp = []; const Wt = 640, Ht = 360;
  for (const [i, x] of mocs.entries()) {
    let goc = await sharp(x.f).resize(1280, 720, { fit: "fill" }).toBuffer();
    if (roi.khung) { const [rx, ry, rw, rh] = roi.khung;
      const svgV = Buffer.from(`<svg width="1280" height="720"><rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="none" stroke="#ffd400" stroke-width="6"/></svg>`);
      /* sharp: resize LUÔN chạy trước composite trong 1 chuỗi → ghép xong (1280×720) rồi mới thu nhỏ ở lệnh thứ 2 */
      goc = await sharp(goc).composite([{ input: svgV, left: 0, top: 0 }]).toBuffer(); }
    if (cm.gm && x.k) { const [px, py, pw, ph] = x.k;   // Gemini: khung đỏ người chính trên ảnh mốc
      const svgP = Buffer.from(`<svg width="1280" height="720"><rect x="${px - 8}" y="${py - 8}" width="${pw + 16}" height="${ph + 16}" fill="none" stroke="#ff1f1f" stroke-width="5" stroke-dasharray="14,9"/></svg>`);
      goc = await sharp(goc).composite([{ input: svgP, left: 0, top: 0 }]).toBuffer(); }
    const img = await sharp(goc).resize(Wt, Ht).toBuffer();
    const svg = Buffer.from(`<svg width="${Wt}" height="30"><rect width="${Wt}" height="30" fill="black"/><text x="6" y="21" font-size="17" font-family="Arial" fill="yellow">${hhmmss(x.ms)} ${vn(x.ms).slice(8, 10)}/${vn(x.ms).slice(5, 7)} · ${nhanMoc[i].replace(/[<&]/g, "")}</text></svg>`);
    comp.push({ input: img, left: i * Wt, top: 30 }, { input: svg, left: i * Wt, top: 0 }); }
  await sharp({ create: { width: Wt * 3, height: Ht + 30, channels: 3, background: "#000" } }).composite(comp).jpeg({ quality: 82 }).toFile(anhF); }

/* ---- 6) clip chuẩn (_clip-noi.mjs, chiNeo: neo = bbox Gemini / trọng tâm chuyển động trong ROI) ---- */
let clipF = "";
if (LAM_CLIP && !CLIP_OK) log(cm.gm ? "   Gemini bám người chưa nhất quán (" + cm.gm.nhatQuan + ", " + coTat.length + " khung) → không dựng clip." : "   vùng kệ chưa kiểm → không dựng clip (khung đỏ dễ bám nhầm vật/người khác).");
if (LAM_CLIP && CLIP_OK) {
  const ng = {}; for (const [i, d] of nguon[k].entries()) ng["d" + i] = { file: d.file, bd: hhmmss(d.a) };
  const tim = (ms) => nguon[k].findIndex((d) => ms >= d.a && ms < d.z);
  const neoTai = (ms) => { const gan = coTat.filter((x) => x.cx != null && Math.abs(x.ms - ms) <= 7000).sort((p, q) => Math.abs(p.ms - ms) - Math.abs(q.ms - ms))[0];
    if (gan && gan.k) return gan.k.slice();   // khung người thật từ mô hình / Gemini
    const [rx, ry, rw, rh] = roi.khung || [540, 230, 200, 260]; const cx = gan ? gan.cx : rx + rw / 2, cy = gan ? gan.cy : ry + rh / 2;
    const w = Math.min(110, rw), h = Math.min(260, rh + 60); return [Math.max(0, Math.round(cx - w / 2)), Math.max(0, Math.round(cy - h / 2)), w, h]; };
  const a0 = Math.max(kc.dauTien - 5000, nguon[k][0].a), z0 = Math.min(msLuc + 10000, nguon[k][nguon[k].length - 1].z - 1000);
  const moc = [[a0, Math.min(a0 + 20000, z0), 1, hhmmss(kc.dauTien) + " " + NHAN_NV + " có mặt tại kệ " + khoaKe.replace(/^F0-/, "")]];
  if (z0 - 25000 > moc[0][1]) { moc.push([moc[0][1], z0 - 25000, 3, "Tại kệ " + khoaKe.replace(/^F0-/, "") + " (tua nhanh)"]); }
  moc.push([Math.max(moc[moc.length - 1][1], z0 - 25000), z0, 1, LUC.slice(11, 19) + " nộp báo cáo vệ sinh" + (REQ ? " (Yêu cầu " + REQ + ")" : "")]);
  const ds = [];
  for (const [a, z, toc, chu] of moc) {   // tách theo file nguồn
    let t = a; while (t < z) { const i = tim(t); if (i < 0) break; const d = nguon[k][i]; const zz = Math.min(z, d.z - 500);
      const neo = []; for (let u = t; u <= zz; u += 4000) neo.push([hhmmss(u), neoTai(u)]); neo.push([hhmmss(zz), neoTai(zz)]);
      ds.push({ n: "d" + i, tu: hhmmss(t), den: hhmmss(zz), toc, chu, ...(roi.khung ? { khung: roi.khung } : {}), theo: neoTai(t), chiNeo: true, neo, nhan: NHAN_NV }); t = zz + 500; }
  }
  clipF = path.join(OUT_F, ID + "_" + khoaKe.replace(/^F0-/, "") + "_BAOCAO_CLIP-CHUAN.webm");
  const cfg = { ra: clipF, tieuDe: bin + " · báo cáo vệ sinh " + LUC.slice(11, 16) + " " + LUC.slice(8, 10) + "/" + LUC.slice(5, 7) + "/" + LUC.slice(0, 4) + " · camera " + TK[k], kbps: 1600, nguon: ng, doan: ds };
  const cfgF = path.join(OUT, "cau-hinh-clip.json"); fs.writeFileSync(cfgF, JSON.stringify(cfg, null, 1));
  const lock = path.join(DIR, ".exports", ".dung-clip.lock");
  try { if (fs.existsSync(lock) && Date.now() - fs.statSync(lock).mtimeMs < 30 * 60e3) { log("   máy đang dựng clip khác (khoá .dung-clip.lock) — bỏ clip lượt này"); clipF = ""; }
    else { fs.writeFileSync(lock, ID); try { execFileSync(process.execPath, ["_clip-noi.mjs", cfgF], { windowsHide: true, stdio: "pipe", timeout: 40 * 60e3 }); } finally { try { fs.unlinkSync(lock); } catch { } }
      if (!fs.existsSync(clipF) || fs.statSync(clipF).size < 50000) { log("   ⚠ clip không dựng được"); clipF = ""; } } }
  catch (e) { log("   ⚠ dựng clip: " + String(e.message).slice(0, 120)); clipF = ""; }
}
const kq = ghiKQ({ bin, khoaKe, kenh: k, tenKenh: TK[k], roi: roi.khung, roiTuTim: !!roi.tuTim, roiDaKiem: DA_KIEM, cachDo: roi.cach, coMatGiay: giay, tongCoMatGiay: kc.tong, coMatTu: hhmmss(kc.dauTien), batDau: hhmmss(kc.a), ketThuc: hhmmss(kc.z), ketLuan,
  ai: cm.gm ? "gemini" : "coco", gemini: cm.gm || undefined, nhanClip: NHAN_NV,
  nguong: { coThaoTac: CO_THAO_TAC_GIAY, chiChup: CHI_CHUP_GIAY }, anh: anhF, clip: clipF, video: nguon[k].map((d) => d.file) });
log("KẾT LUẬN " + ketLuan + " · khối cuối " + giay + " s (" + hhmmss(kc.a) + "→" + hhmmss(kc.z) + ") · tổng " + kc.tong + " s · kênh " + k + " · ảnh " + path.basename(anhF) + (clipF ? " · clip " + path.basename(clipF) : ""));
