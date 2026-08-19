/**
 * qc-loi-cu-moi.mjs — ĐỐI CHỨNG LÕI CŨ (lấy từ git) VỚI LÕI MỚI trên CÙNG một bộ chữ đã đọc
 * ===========================================================================================
 *  Đây là cách duy nhất kết luận được "sửa lõi làm tốt hơn hay xấu hơn". Vì sao không so bằng hai
 *  lần chạy bộ qc-ocr-doi-chung: sửa `bocTen` là đổi luôn bộ SKU mẫu (bộ đó lọc bằng bocTen), nên
 *  hai lần chạy là hai BỘ ĐỀ khác nhau — bẫy này đã cắn 19/08/2026, ra 17% và tưởng lõi vỡ.
 *
 *  Cách chạy: đọc lại `.exports/qc-ocr-dem.json` (chữ mà OCR/AI đã đọc, khoá theo SKU đáp án) rồi
 *  chấm bằng HAI lõi: bản HEAD của repo factory và bản đang sửa trong cây làm việc. 0 lượt gọi mạng.
 *
 *  node qc-loi-cu-moi.mjs [--rev HEAD] [--chi-tiet]
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const F_HTML = path.join(DIR, "..", "factory", "index.html");
const F_DEM = path.join(DIR, ".exports", "qc-ocr-dem.json");
const REV = process.argv.includes("--rev") ? process.argv[process.argv.indexOf("--rev") + 1] : "HEAD";
const CHI_TIET = process.argv.includes("--chi-tiet");

if (!fs.existsSync(F_DEM)) { console.error("✗ Chưa có " + F_DEM + " — chạy `node qc-ocr-doi-chung.mjs --so 24 --duong DE` trước."); process.exit(2); }

const catLoi = (html, ten) => {
  const i = html.indexOf("/*<NDS-ENGINE>*/"), j = html.indexOf("/*</NDS-ENGINE>*/");
  if (i < 0 || j < 0) { console.error("✗ Không thấy dấu mốc NDS-ENGINE trong " + ten); process.exit(2); }
  return new Function(html.slice(i, j) + "\n return NDS_ENGINE;")();
};
const htmlCu = execFileSync("git", ["show", REV + ":index.html"], { cwd: path.join(DIR, "..", "factory"), maxBuffer: 64 * 1024 * 1024, encoding: "utf8" });
const CU = catLoi(htmlCu, "bản " + REV);
const MOI = catLoi(fs.readFileSync(F_HTML, "utf8"), "cây làm việc");

const dsFile = path.join(DIR, ".sku-master-dry.json");
const rows = JSON.parse(fs.readFileSync(dsFile, "utf8")).rows;
const lam = (E) => {
  const ds = rows.map((r) => ({ sku: String(r[0]), pn: r[1], type: r[2], status: r[3], qty: Number(r[4]) || 0 }));
  return { E, cm: E.dungChiMuc(ds) };
};
const cu = lam(CU), moi = lam(MOI);
/* Đo TÁCH RIÊNG phần IDF: cùng lõi mới, chỉ bật/tắt trọng số IDF. Không tách ra thì không biết cái
   nào mang lại thay đổi — bản vá lỗi hay trọng số mới. */
const coIdf = typeof MOI.batIdf === "function";
console.log("✓ Lõi CŨ (" + REV + ") + lõi MỚI, cùng danh mục " + rows.length + " SKU");

const dem = JSON.parse(fs.readFileSync(F_DEM, "utf8"));
const ca = Object.keys(dem).map((k) => {
  const [nguon, sku] = k.split(":");
  const o = dem[k];
  const chu = nguon === "ocr" ? String(o.txt || o.text || "") : String((o.kq && o.kq.raw_text) || "");
  return { nguon, sku, chu, ai: nguon === "ai" ? (o.kq || null) : null };
}).filter((x) => x.chu.length > 10);
console.log("✓ " + ca.length + " lượt đọc trong kho đệm (" + ca.filter((x) => x.nguon === "ocr").length + " OCR / " + ca.filter((x) => x.nguon === "ai").length + " AI)\n");

/* Lõi CŨ không có tuVanBan (nó là cái mới). Để so ĐÚNG cái người dùng gặp, mỗi bên chạy đúng đường
   mà bản đó có: bản cũ tách chữ bằng bocTen rồi tin vai theo hình dạng (y như ô "dán chữ trên tem"
   của bản cũ làm), bản mới dùng tuVanBan. Đây chính là hai hành vi thật của hai bản. */
function nhanCu(E, chu) {
  const b = E.bocTen(chu);
  return { code: b.code, spec: b.spec, color: b.color, brand: b.brand };
}
function nhanMoi(E, cm, chu) { return E.tuVanBan(chu, cm); }

const dung = (b, sku, chu) => {
  const khoaDap = b.E.khoaHang((rows.find((r) => String(r[0]) === sku) || [])[1] || "");
  const nhan = b === cu ? nhanCu(b.E, chu) : nhanMoi(b.E, b.cm, chu);
  const top = b.E.timTop(nhan, b.cm, { soLuong: 3, chiActive: true });
  const khoa = top.map((x) => b.E.khoaHang(x.pn));
  return { top1: khoa[0] === khoaDap, top3: khoa.indexOf(khoaDap) >= 0, coMa: !!top.coMaKhop, sku1: (top[0] || {}).sku, pct: (top[0] || {}).pct };
};

let tot = 0, xau = 0, nhu = 0;
const d = { cu: { t1: 0, t3: 0, ma: 0 }, khongIdf: { t1: 0, t3: 0, ma: 0 }, moi: { t1: 0, t3: 0, ma: 0 } };
for (const x of ca) {
  const a = dung(cu, x.sku, x.chu);
  let k = null;
  if (coIdf) { MOI.batIdf(false); k = dung(moi, x.sku, x.chu); MOI.batIdf(true); }
  const b = dung(moi, x.sku, x.chu);
  d.cu.t1 += a.top1 ? 1 : 0; d.cu.t3 += a.top3 ? 1 : 0; d.cu.ma += a.coMa ? 1 : 0;
  if (k) { d.khongIdf.t1 += k.top1 ? 1 : 0; d.khongIdf.t3 += k.top3 ? 1 : 0; d.khongIdf.ma += k.coMa ? 1 : 0; }
  d.moi.t1 += b.top1 ? 1 : 0; d.moi.t3 += b.top3 ? 1 : 0; d.moi.ma += b.coMa ? 1 : 0;
  const diem = (r) => (r.top1 ? 2 : 0) + (r.top3 ? 1 : 0);
  const cham = diem(b) - diem(a);
  if (cham > 0) tot++; else if (cham < 0) xau++; else nhu++;
  if (CHI_TIET || cham !== 0) {
    console.log((cham > 0 ? "  ↑ TỐT HƠN " : (cham < 0 ? "  ↓ XẤU HƠN " : "  = ")) + x.nguon + " · đáp án " + x.sku +
      "  |  cũ: " + a.sku1 + "/" + a.pct + "%" + (a.top1 ? " ✓" : (a.top3 ? " ~" : " ✗")) + (a.coMa ? "" : " [chưa khớp mã]") +
      "  →  mới: " + b.sku1 + "/" + b.pct + "%" + (b.top1 ? " ✓" : (b.top3 ? " ~" : " ✗")) + (b.coMa ? "" : " [chưa khớp mã]"));
  }
}
const pc = (v) => String(Math.round((v / ca.length) * 100)).padStart(3) + "%";
console.log("\n════ " + ca.length + " lượt đọc, chấm bằng 2 lõi ════");
console.log("  lõi          Top-1        Top-3        khớp được mã");
console.log("  CŨ (" + REV + ")   " + pc(d.cu.t1) + " (" + d.cu.t1 + ")    " + pc(d.cu.t3) + " (" + d.cu.t3 + ")    " + pc(d.cu.ma));
if (coIdf) console.log("  MỚI, tắt IDF " + pc(d.khongIdf.t1) + " (" + d.khongIdf.t1 + ")    " + pc(d.khongIdf.t3) + " (" + d.khongIdf.t3 + ")    " + pc(d.khongIdf.ma));
console.log("  MỚI          " + pc(d.moi.t1) + " (" + d.moi.t1 + ")    " + pc(d.moi.t3) + " (" + d.moi.t3 + ")    " + pc(d.moi.ma));
console.log("\n  Đổi kết quả: " + tot + " lượt TỐT HƠN · " + xau + " lượt XẤU HƠN · " + nhu + " lượt y như cũ");
process.exit(xau > tot ? 1 : 0);
