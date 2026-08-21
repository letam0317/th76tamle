/**
 * qc-moc-lo-trinh.mjs — SO NHIỀU BẢN LÕI TRÊN CÙNG MỘT ĐƯỜNG ĐỌC
 * ===========================================================================================
 *  Vì sao cần thêm file này khi đã có `qc-loi-cu-moi.mjs`: file kia cố ý cho hai bên đi HAI
 *  ĐƯỜNG KHÁC NHAU — bên "cũ" tách chữ bằng `bocTen` trần (hành vi trước 19/08), bên "mới" dùng
 *  `tuVanBan`. Nó trả lời câu "đường tuVanBan có hơn đường cũ không", KHÔNG trả lời câu "bản vá
 *  hôm nay có hơn bản hôm qua không" — chỉ `--rev` mà đọc số của nó là **gán sai công** (đã dính
 *  21/08/2026: mọi rev đều ra 80% vì `nhanCu` bỏ qua hết phần mới).
 *
 *  File này giữ ĐƯỜNG ĐỌC CỐ ĐỊNH (`tuVanBan` + `timTop`) rồi thay LÕI theo từng mốc git, nên
 *  chênh lệch đọc được đúng là công của bản vá.
 *
 *  node qc-moc-lo-trinh.mjs <rev> [<rev> …] [--chi-tiet]
 *    ví dụ: node qc-moc-lo-trinh.mjs fb5a47d 0764902     (cây làm việc luôn được thêm vào cuối)
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const F_HTML = path.join(DIR, "..", "factory", "index.html");
const F_DEM = path.join(DIR, ".exports", "qc-ocr-dem.json");
const CHI_TIET = process.argv.includes("--chi-tiet");
const REVS = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!REVS.length) { console.error("✗ Cần ít nhất một mốc git. Ví dụ: node qc-moc-lo-trinh.mjs fb5a47d"); process.exit(2); }
if (!fs.existsSync(F_DEM)) { console.error("✗ Chưa có " + F_DEM + " — chạy qc-ocr-doi-chung trước."); process.exit(2); }

const catLoi = (html, ten) => {
  const i = html.indexOf("/*<NDS-ENGINE>*/"), j = html.indexOf("/*</NDS-ENGINE>*/");
  if (i < 0 || j < 0) { console.error("✗ Không thấy mốc NDS-ENGINE trong " + ten); process.exit(2); }
  return new Function(html.slice(i, j) + "\n return NDS_ENGINE;")();
};

const rows = JSON.parse(fs.readFileSync(path.join(DIR, ".sku-master-dry.json"), "utf8")).rows;
/* MỖI lõi phải có BỘ HÀNG RIÊNG: dungChiMuc gắn `_b` (kết quả bocTen) vào từng dòng, dùng chung
   một mảng là lõi thứ hai ăn lại cách tách token của lõi thứ nhất — đúng cái bẫy đã ghi ở đầu
   qc-loi-cu-moi.mjs. */
const lam = (E, ten) => {
  const ds = rows.map((r) => ({ sku: String(r[0]), pn: r[1], type: r[2], status: r[3], qty: Number(r[4]) || 0 }));
  return { E, ten, cm: E.dungChiMuc(ds) };
};

const ban = [];
for (const rev of REVS) {
  const html = execFileSync("git", ["show", rev + ":index.html"],
    { cwd: path.join(DIR, "..", "factory"), maxBuffer: 64 * 1024 * 1024, encoding: "utf8" });
  ban.push(lam(catLoi(html, rev), rev));
}
ban.push(lam(catLoi(fs.readFileSync(F_HTML, "utf8"), "cây làm việc"), "cây làm việc"));
console.log("✓ " + ban.length + " bản lõi · danh mục " + rows.length + " SKU · đường đọc CỐ ĐỊNH (tuVanBan → timTop)");

const dem = JSON.parse(fs.readFileSync(F_DEM, "utf8"));
const ca = Object.keys(dem).map((k) => {
  const [nguon, sku] = k.split(":");
  const o = dem[k];
  return { nguon, sku, chu: nguon === "ocr" ? String(o.txt || o.text || "") : String((o.kq && o.kq.raw_text) || "") };
}).filter((x) => x.chu.length > 10);
console.log("✓ " + ca.length + " lượt đọc trong kho đệm\n");

const chay = (b, sku, chu) => {
  const khoaDap = b.E.khoaHang((rows.find((r) => String(r[0]) === sku) || [])[1] || "");
  const top = b.E.timTop(b.E.tuVanBan(chu, b.cm), b.cm, { soLuong: 3, chiActive: true });
  const khoa = top.map((x) => b.E.khoaHang(x.pn));
  return { top1: khoa[0] === khoaDap, top3: khoa.indexOf(khoaDap) >= 0, coMa: !!top.coMaKhop,
    sku1: (top[0] || {}).sku, pct: (top[0] || {}).pct };
};

const d = ban.map(() => ({ t1: 0, t3: 0, ma: 0 }));
const doi = [];
for (const x of ca) {
  const r = ban.map((b) => chay(b, x.sku, x.chu));
  r.forEach((v, i) => { d[i].t1 += v.top1 ? 1 : 0; d[i].t3 += v.top3 ? 1 : 0; d[i].ma += v.coMa ? 1 : 0; });
  const diem = (v) => (v.top1 ? 2 : 0) + (v.top3 ? 1 : 0);
  const cham = diem(r[r.length - 1]) - diem(r[0]);
  if (cham !== 0 || CHI_TIET) {
    doi.push((cham > 0 ? "  ↑ TỐT HƠN " : (cham < 0 ? "  ↓ XẤU HƠN " : "  = ")) + x.nguon + " · đáp án " + x.sku + "  |  " +
      r.map((v, i) => ban[i].ten + ": " + v.sku1 + "/" + v.pct + "%" + (v.top1 ? "✓" : (v.top3 ? "~" : "✗"))).join("  →  "));
  }
}
doi.forEach((s) => console.log(s));
const pc = (v) => String(Math.round((v / ca.length) * 100)).padStart(3) + "%";
console.log("\n════ " + ca.length + " lượt đọc, CÙNG đường đọc, khác LÕI ════");
console.log("  " + "lõi".padEnd(16) + "Top-1        Top-3        khớp được mã");
ban.forEach((b, i) => console.log("  " + b.ten.padEnd(16) + pc(d[i].t1) + " (" + d[i].t1 + ")    " +
  pc(d[i].t3) + " (" + d[i].t3 + ")    " + pc(d[i].ma)));
