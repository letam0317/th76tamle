/**
 * sync-vesinh-ai.mjs — AI XÉT DUYỆT ẢNH BÁO CÁO VỆ SINH (SHOP - 170 QUOC LO 1A)
 * ============================================================================
 *  Chấm tự động từng YÊU CẦU VỆ SINH đang "Chờ duyệt" (status 3) trên planogram:
 *  so ẢNH nhân viên chụp với TIÊU CHUẨN từng ô (standard_image.image_description)
 *  → Kết luận ĐẠT / KHÔNG ĐẠT / CẦN XEM + lý do + ô lỗi, ghi tab VESINH-AI
 *  (sheet PRIVATE) để dashboard hiển thị cạnh từng yêu cầu.
 *
 *  2 NHÀ CUNG CẤP AI (tự chọn theo key trong .env):
 *   - GEMINI_API_KEY    → Google Gemini (aistudio.google.com/apikey — MIỄN PHÍ, không cần thẻ;
 *                         mặc định gemini-2.5-flash, ảnh thu nhỏ 1024px gửi kèm, đi tuần tự
 *                         theo nhịp quota miễn phí ~10 req/phút, hết quota ngày thì tự dừng).
 *   - ANTHROPIC_API_KEY → Claude Opus 4.8 (vision cao cấp nhất, Batch API -50%, trả phí).
 *   - AI_PROVIDER=gemini|claude ép chọn; AI_MODEL đổi model.
 *
 *  THIẾT KẾ CHO ĐỘ CHÍNH XÁC TỐI ĐA:
 *   - Structured output (json_schema/responseSchema) — không bao giờ lệch định dạng.
 *   - CHỐT CỨNG cục bộ (không tốn AI, đúng 100%): ảnh DÙNG LẠI (trùng URL với
 *     request khác / lần trước) → KHÔNG ĐẠT; THIẾU ảnh bắt buộc → KHÔNG ĐẠT.
 *   - Tin cậy < NGUONG_TIN_CAY → ép CẦN XEM (không tự đạt/rớt khi mơ hồ).
 *   - Batch API (rẻ 50%) khi nhiều request; gọi trực tiếp khi ít (≤5) / --live.
 *
 *  AN TOÀN:
 *   - Thiếu ANTHROPIC_API_KEY trong .env → thoát nhẹ nhàng (exit 0, không chặn cụm).
 *   - Token planogram: CHỈ phiên sống (layTokenSongWms) — không login, không đá ai.
 *   - GAS chưa whitelist VESINH-AI → giữ kết quả cục bộ, KHÔNG ghi sheet public.
 *
 *  node sync-vesinh-ai.mjs [--dry] [--live [N]] [--days N] [--limit N] [--wait phút] [--model id]
 *   --dry   : chỉ quét + chốt cứng cục bộ, không gọi Anthropic, không ghi sheet.
 *   --live N: chấm trực tiếp (không batch) tối đa N request — dùng để thử nhanh.
 *   mặc định: gom batch, chờ tối đa --wait (45') — chưa xong thì lần chạy sau tự thu.
 */
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { layTokenSongWms, fetchThuLai, hashTab, tabKhongDoi, luuHashTab, chamMocTabs, gasPost, hamCacheTabs } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const EXPORTS = path.join(DIR, ".exports");
const CACHE_F = path.join(EXPORTS, "ai-vesinh-cache.json");   // kết quả đã chấm + URL ảnh đã thấy
const BATCH_F = path.join(EXPORTS, "ai-vesinh-batch.json");   // batch đang chờ (resume)
const APPSCRIPT_URL = process.env.APPSCRIPT_URL || "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
const APPSCRIPT_KEY = process.env.APPSCRIPT_KEY;
const EXT = "https://wms-gw-external.hasaki.vn/api/v1";
const WAREHOUSE_ID = process.env.PHUTRACH_WH || "863";
const AREA_RE = /^F0-A1|^F0-A8/i;
const TAB_AI = "VESINH-AI";
const HEADER_AI = ["Request ID", "Ngày", "Location", "Executor", "Executed At", "Kết luận", "Điểm", "Tin cậy", "Lý do", "Ảnh lỗi", "Model", "Judged At"];
const NGUONG_TIN_CAY = 75;      // AI tự tin dưới mức này → CẦN XEM (người duyệt quyết)
const GIU_NGAY = 14;            // giữ kết quả trong cache/sheet 14 ngày

const arg = (k, dflt) => { const i = process.argv.indexOf(k); return i >= 0 ? (process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : true) : dflt; };
const DRY = process.argv.includes("--dry");
const LIVE = process.argv.includes("--live") ? Number(arg("--live", 0)) || 9999 : 0;
const DAYS = Number(arg("--days", 3));
const LIMIT = Number(arg("--limit", 400));
const WAIT_MIN = Number(arg("--wait", 45));
const PROVIDER = String(arg("--provider", process.env.AI_PROVIDER || (process.env.GEMINI_API_KEY ? "gemini" : "claude"))).toLowerCase();
const MODEL = String(arg("--model", process.env.AI_MODEL || (PROVIDER === "gemini" ? "gemini-3.5-flash" : "claude-opus-4-8")));

const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);
const nghi = (ms) => new Promise((r) => setTimeout(r, ms));
const docJson = (f, dflt) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return dflt; } };
const ghiJson = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(v, null, 1)); };

/* ===== 0. GUARD API KEY — thiếu thì thoát nhẹ (không chặn cụm đồng bộ); --dry không cần key ===== */
if (!DRY && PROVIDER === "gemini" && !process.env.GEMINI_API_KEY) {
  log("⚠ Chưa có GEMINI_API_KEY trong .env — BỎ QUA bước AI xét duyệt (không lỗi).");
  log("  → Lấy key MIỄN PHÍ ở aistudio.google.com/apikey, thêm dòng GEMINI_API_KEY=... vào hasaki/.env");
  process.exit(0);
}
if (!DRY && PROVIDER !== "gemini" && !process.env.ANTHROPIC_API_KEY) {
  log("⚠ Chưa có ANTHROPIC_API_KEY (hoặc GEMINI_API_KEY miễn phí) trong .env — BỎ QUA bước AI xét duyệt.");
  process.exit(0);
}
let client = null;
if (!DRY && PROVIDER !== "gemini") { const { default: Anthropic } = await import("@anthropic-ai/sdk"); client = new Anthropic(); }
if (!DRY) log("Nhà cung cấp AI: " + PROVIDER + " · model " + MODEL);

/* ===== 1. SCHEMA + RUBRIC (structured output — không lệch định dạng) ===== */
const SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["ket_luan", "diem", "tin_cay", "ly_do", "anh_loi"],
  properties: {
    ket_luan: { type: "string", enum: ["DAT", "KHONG_DAT", "CAN_XEM"], description: "Kết luận xét duyệt tổng thể của yêu cầu vệ sinh" },
    diem: { type: "integer", description: "Điểm chất lượng vệ sinh 0-100 (100 = hoàn hảo theo tiêu chuẩn)" },
    tin_cay: { type: "integer", description: "Bạn tự tin bao nhiêu % vào kết luận (0-100). Ảnh mờ/thiếu thông tin → tự tin thấp." },
    ly_do: { type: "string", description: "1-2 câu tiếng Việt tóm tắt căn cứ kết luận, nêu ô lỗi nếu có" },
    anh_loi: {
      type: "array", description: "Các ô ảnh KHÔNG đạt tiêu chuẩn (rỗng nếu tất cả đạt)",
      items: { type: "object", additionalProperties: false, required: ["o", "van_de"],
        properties: { o: { type: "string", description: "image_name của ô lỗi" }, van_de: { type: "string", description: "vấn đề cụ thể nhìn thấy trong ảnh" } } }
    }
  }
};
const SYSTEM = [
  "Bạn là kiểm soát viên kho của Hasaki, xét duyệt BÁO CÁO VỆ SINH quầy kệ / không gian làm việc dựa trên ảnh nhân viên chụp sau khi vệ sinh.",
  "Mỗi yêu cầu gồm nhiều Ô; mỗi ô có TIÊU CHUẨN riêng (trưng bày / vệ sinh / báo cáo) kèm ngay trước ảnh của ô đó.",
  "CÁCH CHẤM TỪNG ẢNH:",
  "- Ảnh phải chụp ĐÚNG đối tượng của ô (kệ hàng / sàn / khu vực nêu trong tiêu chuẩn), rõ nét, đủ sáng, thấy được toàn cảnh ô.",
  "- Vệ sinh: không bụi bẩn rõ, không rác, không thùng carton rỗng vứt bừa, sàn sạch.",
  "- Trưng bày (với quầy kệ): hàng xếp gọn, cùng loại gom cụm, không đè/che khuất, không đổ ngã.",
  "- KHÔNG ĐẠT khi: ảnh không liên quan (trần nhà, chân, màn hình, ảnh chụp lại màn hình), quá mờ/tối không đánh giá được nhưng cố tình nộp, kệ/sàn bẩn rõ ràng, rác/thùng rỗng, hàng đổ bừa.",
  "- CHỈ bắt lỗi những gì NHÌN THẤY trong ảnh. Không suy diễn thứ ảnh không thể hiện.",
  "- Nếu ảnh không đủ thông tin để kết luận chắc chắn → dùng CAN_XEM và nói rõ vì sao, KHÔNG đoán bừa.",
  "- Có mục 'CẢNH BÁO HỆ THỐNG' thì phải cân nhắc nó trong kết luận.",
  "Kết luận tổng thể: mọi ô đạt → DAT; có ô lỗi rõ ràng → KHONG_DAT; mơ hồ/thiếu dữ kiện → CAN_XEM.",
  "Trả về đúng JSON theo schema, ly_do bằng tiếng Việt, ngắn gọn, nêu tên ô lỗi."
].join("\n");

/* ===== 2. QUÉT PLANOGRAM — các yêu cầu CHỜ DUYỆT (status 3) trong cửa sổ --days ===== */
const token = await layTokenSongWms(DIR, log);
if (!token) { log("⚠ Không có token phiên sống — bỏ qua lượt này (chạy lại sau khi operator online)."); process.exit(0); }
const HX = { authorization: token, "Company-Ids": "1001", accept: "application/json" };
const DAY = 86400000, now = Date.now();
const from = new Date(new Date().setHours(0, 0, 0, 0) - (DAYS - 1) * DAY).getTime();
const listUrl = `${EXT}/planogram/schedule-requests?company_ids=1001&warehouse_ids=${WAREHOUSE_ID}&from_date=${from}&to_date=${now}&status_ids=3&page=1&size=500`;
const rl = await fetchThuLai(listUrl, { headers: HX });
if (!rl.ok) { log("✗ planogram HTTP " + rl.status); process.exit(2); }
const records = ((await rl.json()).records || []).filter((it) => AREA_RE.test(String(it.location_description || "")));
log(`✓ Quét planogram: ${records.length} yêu cầu Chờ duyệt (${DAYS} ngày, F0-A1/F0-A8).`);

/* ===== 3. CACHE + CHỐT CỨNG CỤC BỘ (đúng 100%, không tốn AI) ===== */
const cache = docJson(CACHE_F, { judged: {}, urls: {} });   // judged: id@executed_at -> row; urls: url -> id
const key = (it) => it.request_id + "@" + (it.executed_at || "");
const homNay = new Date().toISOString().slice(0, 10);

function chotCung(it, urlDot) {
  const reqImgs = (it.request_image || []).filter((x) => x && x.image);
  const stds = (it.standard_image || []);
  // (a) THIẾU ảnh bắt buộc
  const coAnh = new Set(reqImgs.map((x) => String(x.image_name || "")));
  const thieu = stds.filter((s) => s.is_required && !coAnh.has(String(s.image_name || ""))).map((s) => s.image_name);
  if (!reqImgs.length) return { ket_luan: "KHONG_DAT", diem: 0, tin_cay: 99, ly_do: "Không đính kèm ảnh nào.", anh_loi: [] };
  if (thieu.length) return { ket_luan: "KHONG_DAT", diem: 20, tin_cay: 97, ly_do: "Thiếu " + thieu.length + " ảnh bắt buộc: " + thieu.slice(0, 4).join(", ") + (thieu.length > 4 ? "…" : ""), anh_loi: thieu.map((o) => ({ o: String(o), van_de: "thiếu ảnh" })) };
  // (b0) Ảnh trùng NGAY TRONG 1 request — cùng 1 URL nộp cho nhiều ô khác nhau (gian lận phổ biến)
  const urlTrong = {};
  for (const x of reqImgs) (urlTrong[x.image] = urlTrong[x.image] || []).push(String(x.image_name || "?"));
  const oTrung = Object.values(urlTrong).filter((os) => os.length > 1);
  if (oTrung.length) return { ket_luan: "KHONG_DAT", diem: 15, tin_cay: 99,
    ly_do: "Nộp CÙNG MỘT ảnh cho nhiều ô khác nhau: " + oTrung.map((os) => os.join(" = ")).slice(0, 3).join("; ") + " — nghi báo cáo đối phó.",
    anh_loi: oTrung.flat().map((o) => ({ o, van_de: "ảnh trùng trong cùng yêu cầu" })) };
  // (b) Ảnh DÙNG LẠI — trùng URL với request KHÁC (đã chấm trước đó HOẶC trong cùng đợt quét)
  const trung = [];
  for (const x of reqImgs) {
    const chu = cache.urls[x.image];
    if (chu && String(chu) !== String(it.request_id)) { trung.push({ o: String(x.image_name || "?"), van_de: "ảnh dùng lại từ yêu cầu #" + chu }); continue; }
    const cungDot = (urlDot && urlDot[x.image] || []).filter((id) => id !== String(it.request_id));
    if (cungDot.length) trung.push({ o: String(x.image_name || "?"), van_de: "ảnh trùng với yêu cầu #" + cungDot[0] + " cùng đợt" });
  }
  if (trung.length) return { ket_luan: "KHONG_DAT", diem: 10, tin_cay: 99, ly_do: "Ảnh nộp trùng với yêu cầu khác (" + trung.length + " ảnh) — nghi dùng lại ảnh cũ.", anh_loi: trung };
  return null;   // không có lỗi cứng → đưa AI chấm
}

/* ===== 4. DỰNG PROMPT 1 REQUEST (ảnh URL công khai — API tự tải) ===== */
function dungMessages(it, canhBao) {
  const stds = {}; (it.standard_image || []).forEach((s) => { stds[String(s.image_name || "")] = String(s.image_description || ""); });
  const content = [{
    type: "text",
    text: `YÊU CẦU VỆ SINH #${it.request_id} — vị trí ${it.location_description} (${/^F0-A8/i.test(it.location_description) ? "không gian làm việc" : "quầy kệ"}), báo cáo lúc ${it.executed_at}. Gồm ${(it.request_image || []).length} ảnh dưới đây.` +
      (canhBao.length ? "\nCẢNH BÁO HỆ THỐNG:\n- " + canhBao.join("\n- ") : "")
  }];
  for (const x of (it.request_image || [])) {
    if (!x || !x.image) continue;
    const tc = stds[String(x.image_name || "")];
    content.push({ type: "text", text: `--- Ô "${x.image_name}"${tc ? " — TIÊU CHUẨN: " + tc : ""}` });
    content.push({ type: "image", source: { type: "url", url: x.image } });
  }
  content.push({ type: "text", text: "Chấm toàn bộ các ô trên và trả về JSON kết luận." });
  return [{ role: "user", content }];
}
const PARAMS_CHUNG = {
  model: MODEL, max_tokens: 8000,
  thinking: { type: "adaptive" },
  system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
  output_config: { format: { type: "json_schema", schema: SCHEMA } },
};

/* ===== 4b. NHÁNH GEMINI (miễn phí — aistudio.google.com/apikey) =====
 *  Gemini không nhận ảnh theo URL → tải về + THU NHỎ 1024px (sharp) rồi gửi inline base64.
 *  Structured output qua responseSchema; đi TUẦN TỰ theo nhịp quota miễn phí (~10 req/phút);
 *  429 RESOURCE_EXHAUSTED (hết quota ngày) → dừng êm, phần còn lại chấm ở lượt sau. */
const SCHEMA_GEMINI = {
  type: "OBJECT", required: ["ket_luan", "diem", "tin_cay", "ly_do", "anh_loi"],
  properties: {
    ket_luan: { type: "STRING", enum: ["DAT", "KHONG_DAT", "CAN_XEM"] },
    diem: { type: "INTEGER" }, tin_cay: { type: "INTEGER" }, ly_do: { type: "STRING" },
    anh_loi: { type: "ARRAY", items: { type: "OBJECT", required: ["o", "van_de"], properties: { o: { type: "STRING" }, van_de: { type: "STRING" } } } }
  }
};
let _sharp;
async function anhBase64(url) {
  const buf = Buffer.from(await (await fetchThuLai(url)).arrayBuffer());
  try {
    if (_sharp === undefined) { try { _sharp = (await import("sharp")).default; } catch { _sharp = null; } }
    if (_sharp) {
      const out = await _sharp(buf).rotate().resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 72 }).toBuffer();
      return { mime_type: "image/jpeg", data: out.toString("base64") };
    }
  } catch { /* hỏng resize → gửi nguyên gốc */ }
  return { mime_type: /\.png(\?|$)/i.test(url) ? "image/png" : "image/jpeg", data: buf.toString("base64") };
}
/* Chuỗi model DỰ PHÒNG: mỗi model Gemini có quota miễn phí RIÊNG theo ngày —
 * hết quota model trước thì tự chuyển model sau, backlog vẫn được chấm 0 đồng. */
const CHUOI_GEMINI = [...new Set([MODEL, "gemini-3.5-flash-lite", "gemini-3-flash-preview", "gemini-2.5-flash-lite", "gemini-2.0-flash"])];
async function goiGemini(it, model) {
  // Chuyển content khuôn Claude → parts khuôn Gemini (text giữ nguyên, ảnh tải + thu nhỏ)
  const parts = [];
  for (const b of dungMessages(it, [])[0].content) {
    if (b.type === "text") parts.push({ text: b.text });
    else if (b.type === "image") parts.push({ inline_data: await anhBase64(b.source.url) });
  }
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: "user", parts }],
    generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA_GEMINI, maxOutputTokens: 4096 }
  });
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + process.env.GEMINI_API_KEY;
  for (let lan = 0; lan < 3; lan++) {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body });
    if (r.status === 429 || r.status === 503) {
      const txt = await r.text();
      if (/PerDay|daily/i.test(txt)) { const e = new Error("Hết quota NGÀY của bậc miễn phí"); e.daily = true; throw e; }
      if (lan < 2) { log("  … quota phút/quá tải (HTTP " + r.status + ") — nghỉ 35s thử lại"); await nghi(35000); continue; }
      const e = new Error("HTTP " + r.status + " sau 3 lần"); e.daily = r.status === 429; throw e;
    }
    if (!r.ok) throw new Error("Gemini HTTP " + r.status + ": " + (await r.text()).slice(0, 200));
    const j = await r.json();
    const um = j.usageMetadata || {};
    usage.in += um.promptTokenCount || 0; usage.out += um.candidatesTokenCount || 0;
    const cand = (j.candidates || [])[0];
    if (cand && /SAFETY|PROHIBITED/i.test(cand.finishReason || "")) return { ket_luan: "CAN_XEM", diem: 0, tin_cay: 0, ly_do: "AI từ chối đánh giá — cần người xem.", anh_loi: [] };
    let kq = null; try { kq = JSON.parse((cand.content.parts || []).map((p) => p.text || "").join("")); } catch { }
    if (!kq) return { ket_luan: "CAN_XEM", diem: 0, tin_cay: 0, ly_do: "Không đọc được kết quả AI — cần người xem.", anh_loi: [] };
    if (kq.tin_cay < NGUONG_TIN_CAY && kq.ket_luan !== "CAN_XEM") { kq.ly_do = "[Tin cậy thấp] " + kq.ly_do; kq.ket_luan = "CAN_XEM"; }
    return kq;
  }
}

/* ===== 5. PARSE + CHUẨN HOÁ 1 KẾT QUẢ ===== */
function docKetQua(message) {
  if (message.stop_reason === "refusal") return { ket_luan: "CAN_XEM", diem: 0, tin_cay: 0, ly_do: "AI từ chối đánh giá — cần người xem.", anh_loi: [] };
  const tb = (message.content || []).find((b) => b.type === "text");
  let j = null; try { j = JSON.parse(tb ? tb.text : ""); } catch { }
  if (!j) return { ket_luan: "CAN_XEM", diem: 0, tin_cay: 0, ly_do: "Không đọc được kết quả AI — cần người xem.", anh_loi: [] };
  if (j.tin_cay < NGUONG_TIN_CAY && j.ket_luan !== "CAN_XEM") { j.ly_do = "[Tin cậy thấp] " + j.ly_do; j.ket_luan = "CAN_XEM"; }
  return j;
}
function luu(it, kq, model) {
  cache.judged[key(it)] = {
    id: String(it.request_id), ngay: String(it.request_time || "").slice(0, 10), loc: it.location_description,
    exec: it.executed_by_name || "", at: it.executed_at || "",
    kl: kq.ket_luan, diem: kq.diem, tincay: kq.tin_cay, lydo: kq.ly_do,
    anhloi: (kq.anh_loi || []).map((a) => a.o + ": " + a.van_de).join(" | "),
    model: model || "rule", judgedAt: new Date().toISOString()
  };
  for (const x of (it.request_image || [])) if (x && x.image && !cache.urls[x.image]) cache.urls[x.image] = String(it.request_id);
}

/* ===== 6. THU BATCH CŨ (nếu có) → chọn việc mới → chấm ===== */
const usage = { in: 0, out: 0 };
function congUsage(u) { if (u) { usage.in += (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0); usage.out += u.output_tokens || 0; } }
const banGhi = {}; records.forEach((it) => { banGhi[String(it.request_id)] = it; });

async function thuBatch(batchInfo, choToiDa) {
  const t0 = Date.now();
  let b = await client.messages.batches.retrieve(batchInfo.batch_id);
  while (b.processing_status !== "ended" && Date.now() - t0 < choToiDa) {
    log(`  … batch ${b.id}: ${b.processing_status} (xong ${b.request_counts.succeeded}/${batchInfo.n}) — chờ 30s`);
    await nghi(30000); b = await client.messages.batches.retrieve(batchInfo.batch_id);
  }
  if (b.processing_status !== "ended") { log("  ⏳ Batch chưa xong sau " + Math.round(choToiDa / 60000) + "' — giữ lại, lần chạy sau tự thu."); return false; }
  let nOk = 0, nErr = 0;
  for await (const res of await client.messages.batches.results(b.id)) {
    const it = banGhi[res.custom_id] || batchInfo.items[res.custom_id];
    if (!it) continue;
    if (res.result.type === "succeeded") { congUsage(res.result.message.usage); luu(it, docKetQua(res.result.message), MODEL); nOk++; }
    else { luu(it, { ket_luan: "CAN_XEM", diem: 0, tin_cay: 0, ly_do: "Lỗi batch (" + res.result.type + ") — cần người xem.", anh_loi: [] }, MODEL); nErr++; }
  }
  log(`✓ Thu batch ${b.id}: ${nOk} kết quả` + (nErr ? `, ${nErr} lỗi→CẦN XEM` : "") + ".");
  try { fs.unlinkSync(BATCH_F); } catch { }
  return true;
}

(async () => {
  // 6a. Batch treo từ lần trước → thu trước
  const pending = docJson(BATCH_F, null);
  if (pending && pending.batch_id && !DRY) await thuBatch(pending, WAIT_MIN * 60000);

  // 6b. Ứng viên mới: chưa chấm (theo id@executed_at — NV nộp lại thì chấm lại)
  const candidates = records.filter((it) => !cache.judged[key(it)]).slice(0, LIMIT);
  log(`→ ${candidates.length} yêu cầu chưa chấm.`);

  // 6c. Chốt cứng cục bộ trước (dựng bảng URL của cả đợt để bắt ảnh trùng chéo)
  const urlDot = {};
  for (const it of candidates) for (const x of (it.request_image || [])) if (x && x.image) (urlDot[x.image] = urlDot[x.image] || []).push(String(it.request_id));
  const canAI = [];
  for (const it of candidates) {
    const cc = chotCung(it, urlDot);
    if (cc) { luu(it, cc, "rule"); log(`  ▪ #${it.request_id} ${it.location_description}: ${cc.ket_luan} (chốt cứng) — ${cc.ly_do}`); }
    else canAI.push(it);
  }
  log(`→ Chốt cứng: ${candidates.length - canAI.length} · cần AI chấm: ${canAI.length}.`);

  if (DRY) {
    ghiJson(path.join(EXPORTS, "ai-vesinh-dry.json"), { canAI: canAI.map((x) => ({ id: x.request_id, loc: x.location_description, nAnh: (x.request_image || []).length })), judged: cache.judged });
    ghiJson(CACHE_F, cache);
    log("(DRY) Không gọi Anthropic. Xem .exports/ai-vesinh-dry.json"); return;
  }

  // 6d. Chấm: GEMINI → tuần tự theo nhịp quota miễn phí; CLAUDE → trực tiếp (ít) / Batch API (nhiều)
  if (canAI.length && PROVIDER === "gemini") {
    const lo = LIVE ? canAI.slice(0, LIVE) : canAI;
    let daXong = 0, iModel = 0;
    for (const it of lo) {
      let xong = false;
      while (!xong && iModel < CHUOI_GEMINI.length) {
        try {
          const kq = await goiGemini(it, CHUOI_GEMINI[iModel]);
          luu(it, kq, CHUOI_GEMINI[iModel]); daXong++; xong = true;
          log(`  ✓ #${it.request_id} ${it.location_description}: ${kq.ket_luan} (điểm ${kq.diem}, tin cậy ${kq.tin_cay}) [${CHUOI_GEMINI[iModel]}] — ${kq.ly_do}`);
        } catch (e) {
          if (e.daily) {
            iModel++;
            if (iModel < CHUOI_GEMINI.length) { log("  ⏳ Hết quota ngày của model — CHUYỂN sang " + CHUOI_GEMINI[iModel]); continue; }
            log("  ⏳ Hết quota ngày của TOÀN BỘ chuỗi model miễn phí — đã chấm " + daXong + "/" + lo.length + ", phần còn lại tự chấm ở lượt sau.");
          } else { log(`  ✗ #${it.request_id}: ${e.message}`); xong = true; }
        }
      }
      if (iModel >= CHUOI_GEMINI.length) break;
      await nghi(6500);   // nhịp ~9 req/phút — nằm trong quota miễn phí
    }
  } else if (canAI.length) {
    const truVe = (it) => dungMessages(it, []);
    if (LIVE || canAI.length <= 5) {
      const lo = canAI.slice(0, LIVE || 5);
      for (const it of lo) {
        try {
          const msg = await client.messages.create({ ...PARAMS_CHUNG, messages: truVe(it) });
          congUsage(msg.usage);
          const kq = docKetQua(msg);
          luu(it, kq, MODEL);
          log(`  ✓ #${it.request_id} ${it.location_description}: ${kq.ket_luan} (điểm ${kq.diem}, tin cậy ${kq.tin_cay}) — ${kq.ly_do}`);
        } catch (e) {
          if (e && e.status === 429) { log("  ⚠ Chạm rate limit — dừng lượt live, còn lại để lần sau."); break; }
          log(`  ✗ #${it.request_id}: ${e.message}`);
        }
      }
    } else {
      const reqs = canAI.map((it) => ({ custom_id: String(it.request_id), params: { ...PARAMS_CHUNG, messages: truVe(it) } }));
      const batch = await client.messages.batches.create({ requests: reqs });
      const items = {}; canAI.forEach((it) => { items[String(it.request_id)] = it; });
      ghiJson(BATCH_F, { batch_id: batch.id, n: reqs.length, at: new Date().toISOString(), items });
      log(`✓ Đã gửi batch ${batch.id} (${reqs.length} yêu cầu, Batch API -50% chi phí) — chờ kết quả…`);
      await thuBatch({ batch_id: batch.id, n: reqs.length, items }, WAIT_MIN * 60000);
    }
  }

  // 6e. Dọn cache quá GIU_NGAY + lưu
  const han = new Date(Date.now() - GIU_NGAY * DAY).toISOString().slice(0, 10);
  for (const k of Object.keys(cache.judged)) if ((cache.judged[k].ngay || "") < han) delete cache.judged[k];
  ghiJson(CACHE_F, cache);
  if (usage.in) log(`Σ tokens: ${usage.in.toLocaleString()} vào / ${usage.out.toLocaleString()} ra (${MODEL}).`);

  // 6f. Ghi sheet VESINH-AI (guard PII: GAS phải đã whitelist)
  const rows = Object.values(cache.judged)
    .sort((a, b) => String(b.ngay).localeCompare(String(a.ngay)) || String(a.loc).localeCompare(String(b.loc)))
    .map((r) => [r.id, r.ngay, r.loc, r.exec, r.at, r.kl, r.diem, r.tincay, r.lydo, r.anhloi, r.model, r.judgedAt]);
  if (!rows.length) { log("Không có kết quả nào để ghi."); return; }
  // Nhịp poller 30': không có yêu cầu mới thì payload y hệt — so hash, giống thì khỏi ghi (đỡ GAS).
  const hash = hashTab(HEADER_AI, rows);
  if (tabKhongDoi(DIR, TAB_AI, hash)) { log("= " + TAB_AI + ": không đổi (" + rows.length + " dòng) — bỏ qua ghi."); await chamMocTabs([TAB_AI], Date.now(), log); return; }
  const probe = await fetchThuLai(APPSCRIPT_URL + "?action=readTab&tab=" + TAB_AI + "&callback=cb").then((r) => r.text()).catch(() => "");
  if (/không được phục vụ/i.test(probe)) { log("⚠ GAS chưa whitelist " + TAB_AI + " — kết quả giữ ở cache cục bộ, CHƯA ghi sheet (tránh lộ PII). Deploy google-script.gs mới rồi chạy lại."); return; }
  if (!APPSCRIPT_KEY) { log("⚠ Thiếu APPSCRIPT_KEY — không ghi sheet."); return; }
  const body = JSON.stringify({ action: "syncTasks", key: APPSCRIPT_KEY, tab: TAB_AI, header: HEADER_AI, rows, apiAt: Date.now() });
  /* gasPost thay cho fetch().json(): 12/08 Apps Script trả trang HTML lỗi giữa lượt ghi, .json()
     nổ "Unexpected token '<'" → mất trắng công AI vừa chấm. Xem gasPost trong session-rules.js. */
  const j = await gasPost(body, log);
  if (j.status !== "success") throw new Error("Ghi " + TAB_AI + " lỗi: " + (j.message || "?"));
  luuHashTab(DIR, TAB_AI, hash);
  log(`✓ ${TAB_AI}: ghi ${rows.length} dòng.`);
  await hamCacheTabs([TAB_AI], log);   // tab bậc 1 của panel danh sách — để lượt dựng cache không rơi vào người dùng
})().catch((e) => { console.error("✗", e.message); process.exit(2); });
