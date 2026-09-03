/**
 * tra-sku-hasaki.mjs — tra cứu sản phẩm hasaki.vn theo mã quét ở form 5S (barcode EAN hoặc SKU 9 số).
 * ================================================================================================
 * Dùng chung cho:
 *   - push-5s-to-workflow.js : ghép "Mã SP quét: …" vào Mô tả (note) khi tạo task mới.
 *   - bo-sung-sku-comment.mjs: bổ sung bình luận cho task cũ đã tạo thiếu mã SP.
 *
 * Cổng tra (dò 03/09/2026 bằng Edge headless — đúng ô tìm kiếm của hasaki.vn, JSON công khai
 * không cần đăng nhập, KHÔNG thuộc nhóm upstream work/wms/hr):
 *   1) https://hasaki.vn/api/v4/main/suggestion?q=<mã>        (autocomplete ô tìm kiếm)
 *   2) https://hasaki.vn/mobile/v1/main/search?keyword=<mã>   (fallback khi (1) rỗng)
 *
 * Cache .exports/sku-hasaki-cache.json: tìm THẤY = giữ vĩnh viễn (tên/ảnh SP không đổi theo ngày);
 * KHÔNG thấy = giữ 7 ngày rồi tra lại (SP mới lên sàn); lỗi mạng = không cache, lượt sau tự thử lại.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const CACHE_FILE = path.join(DIR, ".exports", "sku-hasaki-cache.json");
const TTL_KHONG_THAY_MS = 7 * 24 * 3600 * 1000;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

let _cache = null;
function docCache() {
  if (_cache) return _cache;
  try { _cache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")); } catch { _cache = {}; }
  return _cache;
}
function ghiCache() {
  try { fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true }); fs.writeFileSync(CACHE_FILE, JSON.stringify(_cache)); } catch { /* cache best-effort */ }
}

async function goiJson(url) {
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(10000) });
      if (!r.ok) { if (i === 0) { await new Promise((s) => setTimeout(s, 1500)); continue; } return null; }
      const t = await r.text();
      if (t[0] !== "{") return null;                 // trang lỗi trả HTML — đừng JSON.parse thẳng
      return JSON.parse(t);
    } catch { if (i === 0) await new Promise((s) => setTimeout(s, 1500)); }
  }
  return null;
}

const chonSP = (ds, ma) => (Array.isArray(ds) ? (ds.find((x) => String(x.sku) === ma) || ds[0]) : null) || null;

/**
 * Tra 1 mã → {sku, ten, anh, url} hoặc null (không thấy).
 * Ném không bao giờ — lỗi mạng cũng trả null (nhưng KHÔNG cache để lượt sau thử lại).
 */
export async function traCuuSanPham(ma) {
  ma = String(ma || "").trim();
  if (!ma) return null;
  const cache = docCache();
  const c = cache[ma];
  if (c && (c.sp || Date.now() - c.at < TTL_KHONG_THAY_MS)) return c.sp;

  let sp = null, apiSong = false;
  const j = await goiJson("https://hasaki.vn/api/v4/main/suggestion?q=" + encodeURIComponent(ma));
  if (j && j.data) {
    apiSong = true;
    const p = chonSP(j.data.products, ma);
    if (p) sp = {
      sku: String(p.sku || ""), ten: String(p.title || ""), anh: String(p.image || ""),
      url: p.url ? "https://hasaki.vn/" + String(p.url).replace(/^\/+/, "") : "",
    };
  }
  if (!sp) {
    const m = await goiJson("https://hasaki.vn/mobile/v1/main/search?keyword=" + encodeURIComponent(ma) + "&page=1&size=5");
    if (m && m.data) {
      apiSong = true;
      const p = chonSP(m.data.products, ma);
      if (p) sp = { sku: String(p.sku || ""), ten: String(p.name || ""), anh: String(p.image || ""), url: String(p.product_url || "") };
    }
  }
  if (apiSong) { cache[ma] = { at: Date.now(), sp: sp }; ghiCache(); }
  return sp;
}

/**
 * Dòng chữ chèn vào Mô tả task / bình luận. "Mã SP quét:" là MARKER chống ghi trùng —
 * bo-sung-sku-comment dò chuỗi này trong bình luận cũ để khỏi bổ sung 2 lần. Đổi chữ là vỡ dedupe.
 */
export function dongMoTaSP(ma, sp) {
  let s = "Mã SP quét: " + ma;
  if (sp) {
    if (sp.sku && sp.sku !== String(ma)) s += " → SKU " + sp.sku;
    if (sp.ten) s += " · " + sp.ten;
    if (sp.url) s += " · " + sp.url;
    if (sp.anh) s += " · Ảnh: " + sp.anh;
  } else {
    s += " (không tìm thấy trên hasaki.vn)";
  }
  return s;
}
