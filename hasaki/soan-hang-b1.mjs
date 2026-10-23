/**
 * soan-hang-b1.mjs — LƯỢT SOẠN HÀNG (PICK theo đơn) tại ô của phiếu B1 kệ A1, nguồn REDASH — 0 lượt gọi API WMS (23/10/2026).
 *
 *  User 23/10: «bổ sung soạn (pick/picking/picked) hàng» → «làm» + «có cách nào clip vẫn có sẵn theo dữ liệu soạn hàng wms nhưng k cần gọi
 *  wms quá nhiều k» + «truy vấn Redash cái này t cũng có quyền truy cập». Đo 23/10:
 *   - Redash dash-report.inshasaki.com nối thẳng WMS-DB-PROD; khoá cá nhân (REDASH_API_KEY, .env — TỐI MẬT, không in/không commit) chỉ
 *     XEM nguồn ⇒ KHÔNG chạy được câu SQL tự viết, nhưng CHẠY ĐƯỢC truy vấn đã lưu có tham số số/ngày.
 *   - Truy vấn 188 «863. Điều tra NF — tra cứu một SKU» (ducnq) nhánh loai='PICK': mọi lượt pick 30 ngày của 1 SKU — bin · created_at
 *     (giờ lấy) · quantity_transfered · cart_code · source_type «PG <nhóm soạn>» · created_by · created_by_name. ~6 s/lượt chạy.
 *     Khớp y hệt API WMS picking-group (phiếu 14246906: 5/5 lượt cùng giờ, cùng giỏ).
 *   - SKU của ô: lượt CHÂM vào ô (canh-b1 transfer-bins, nay giữ `sku`) + sổ nguon-cham-b1 + «SKU …» trong Mô tả phiếu.
 *  Đệm: .exports/redash-188/<sku>_<ngày>.json — ngày đã qua thì bất biến ⇒ mỗi cặp SKU+ngày chạy 1 lần duy nhất (dùng chung mọi phiếu).
 *  Ra: .exports/soan-hang-b1.json { "<ô>|<giờ ghi nhận>": { luc, sku:[…], ds:[{at, ten, maWms, qty, gio, nhom, sku}] } } — lượt soạn ĐÚNG ô
 *      trong 72 giờ trước giờ ghi nhận (cùng cửa sổ lượt châm). Laptop sinh, 2 PC kéo (dong-bo-xm «vao») để tim-bang-chung-b1 cắt clip.
 *  Tải: chỉ Redash (DB WMS), trần --max lượt chạy mới/lần (mặc định 20), nghỉ 1,5 s giữa lượt. 0 lượt work/wms API/hr.
 *
 *  node soan-hang-b1.mjs [--max=20] [--id=<phiếu>] [--thu]   (--thu: in kế hoạch, không chạy Redash, không ghi)
 */
import "dotenv/config";
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { ghiJson } from "./so-ghi.mjs";
const DIR = path.dirname(fileURLToPath(import.meta.url)); process.chdir(DIR);
const A = Object.fromEntries(process.argv.slice(2).map((x) => { const [k, v] = x.replace(/^--/, "").split("="); return [k, v ?? true]; }));
const MAX = Number(A.max || 20), THU = !!A.thu, CUA_SO_GIO = 72;
const EXP = path.join(DIR, ".exports"), DEM = path.join(EXP, "redash-188"), F_RA = path.join(EXP, "soan-hang-b1.json");
const RD = "https://dash-report.inshasaki.com/api", KHOA = process.env.REDASH_API_KEY || "";
const log = (...a) => console.log(new Date().toTimeString().slice(0, 8), ...a);
const doc = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };
const ms = (s) => Date.parse(String(s).replace(" ", "T").slice(0, 19) + "+07:00");
if (!KHOA && !THU) { log("✗ thiếu REDASH_API_KEY trong .env (chỉ laptop có) — dừng"); process.exit(2); }

/* chạy truy vấn đã lưu 188 với tham số; /api/jobs/<id> trả 500 với khoá cá nhân ⇒ gửi lại cùng tham số, max_age cho lấy kết quả vừa xong */
async function chay188(sku, ngay) {
  const H = { Authorization: "Key " + KHOA, "Content-Type": "application/json" }, than = JSON.stringify({ parameters: { sku: Number(sku), date: ngay }, max_age: 3600 });
  for (let i = 0; i < 45; i++) {
    const r = await fetch(RD + "/queries/188/results", { method: "POST", headers: H, body: than, signal: AbortSignal.timeout(60000) });
    const j = await r.json().catch(() => ({}));
    if (j.query_result) return j.query_result.data.rows.filter((x) => x.loai === "PICK")
      .map((x) => ({ bin: x.bin, at: String(x.created_at).replace("T", " ").slice(0, 19), qty: Number(x.quantity_transfered) || 0, gio: x.cart_code || "", nhom: String(x.source_type || "").replace(/^PG /, ""), maWms: x.created_by, ten: x.created_by_name || "" }));
    if (j.job && j.job.status === 4) throw new Error("Redash: " + String(j.job.error).slice(0, 120));
    if (!j.job) throw new Error("Redash HTTP " + r.status + " " + JSON.stringify(j).slice(0, 120));
    await new Promise((x) => setTimeout(x, 2000));
  }
  throw new Error("Redash quá 90 s");
}

const kq = doc(path.join(EXP, "canh-b1-ketqua.json"), {}), CW = doc(path.join(DIR, ".cache-canh-b1.json"), {}), NG = doc(path.join(EXP, "nguon-cham-b1.json"), { lan: {} }).lan || {};
const MOTA = doc(path.join(EXP, "mo-ta-phieu.json"), {});
let mo = null;
try { const j = await (await fetch("http://127.0.0.1:8591/api/du-lieu", { signal: AbortSignal.timeout(20000) })).json(); mo = new Set(j.phieu.filter((p) => p.buoc === "B1").map((p) => String(p.id))); }
catch { log("⚠ 8591 không trả lời — xét mọi phiếu trong canh-b1-ketqua"); }
const RA = doc(F_RA, {}); fs.mkdirSync(DEM, { recursive: true });
let chayMoi = 0, viec = 0;
for (const [id, x] of Object.entries(kq)) {
  if (A.id && String(A.id) !== id) continue;
  if (mo && !mo.has(id)) continue;
  if (!x.bin || !x.ngay) continue;
  /* gợi ý cũ ghi ô NGẮN ("507-03-04-02") ⇒ ghép theo đuôi mã với khoá bộ đệm đầy đủ — cùng cách tim-bang-chung-b1 */
  const khoa = CW[x.bin + "|" + x.ngay] ? x.bin + "|" + x.ngay : Object.keys(CW).find((k) => { const [b0, n0] = k.split("|"); return n0 === x.ngay && b0.endsWith("-" + x.bin); });
  const o = khoa ? khoa.split("|")[0] : (/^F0-/.test(x.bin) ? x.bin : "");
  if (!/^F0-A1-/.test(o)) continue;   // user 23/10: kệ A1 trước
  const cw = (khoa && CW[khoa]) || {};
  const sku = new Set((cw.rec || []).map((r) => r.sku).filter(Boolean));
  Object.entries(NG).forEach(([k, v]) => { if (k.startsWith(o + "|") && v && v.sku) sku.add(String(v.sku)); });
  (String((MOTA[id] || {}).note || "").match(/SKU\s*([0-9]{6,})/g) || []).forEach((m) => sku.add(m.replace(/\D/g, "")));
  const k = o + "|" + x.ngay, ngay = x.ngay.slice(0, 10), ghi = ms(x.ngay);
  if (!sku.size) { RA[k] = { luc: new Date().toISOString(), sku: [], ds: [], lyDo: "chưa biết SKU của ô (không có lượt châm 72 giờ)" }; continue; }
  viec++;
  const ds = [];
  let du = true;
  for (const s of sku) {
    const f = path.join(DEM, s + "_" + ngay + ".json");
    let rows = doc(f, null);
    if (!rows) {
      if (THU) { log(`(thử) ${id} ${o} SKU ${s} ngày ${ngay} — sẽ chạy Redash`); du = false; continue; }
      if (chayMoi >= MAX) { du = false; continue; }
      try { rows = await chay188(s, ngay); chayMoi++; } catch (e) { log(`  ✗ ${id} SKU ${s}: ${e.message}`); du = false; continue; }
      if (Date.now() - ms(ngay + " 23:59:59") > 2 * 36e5) ghiJson(f, rows, { thut: 0 });   // ngày đã qua hẳn mới đệm vĩnh viễn
      await new Promise((r) => setTimeout(r, 1500));
    }
    rows.filter((r) => r.bin === o && ms(r.at) <= ghi && ghi - ms(r.at) <= CUA_SO_GIO * 36e5).forEach((r) => ds.push({ ...r, sku: s }));
  }
  if (THU) continue;
  ds.sort((a, b) => (a.at < b.at ? 1 : -1));
  RA[k] = { luc: new Date().toISOString(), sku: [...sku], ds, ...(du ? {} : { thieu: 1 }) };
  log(`▶ ${id} ${o} · ${sku.size} SKU · ${ds.length} lượt soạn đúng ô (72 h)${du ? "" : " · còn SKU chưa tra (lượt sau)"}`);
}
if (!THU) ghiJson(F_RA, RA, { thut: 1, ai: "soan-hang-b1" });
log(`xong: ${viec} phiếu A1 có SKU · ${chayMoi} lượt Redash mới · 0 lượt API WMS → ${F_RA}`);
