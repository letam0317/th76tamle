/* 09/10/2026 — ĐẨY KẾT QUẢ xac-minh-tu-dong.mjs LÊN BẢNG NỘI BỘ «Việc 5S» (bang-591, localhost:8591). KHÔNG ghi lên work.hasaki.
 *  User 09/10: «sao ở đây vẫn trống, các phiếu xác minh chưa cập nhật lên» — bảng đọc .exports/bang-chung-b1.json + ảnh trong Videos/5S-bang-chung/may/.
 *  node day-xm-len-bang.mjs [thư mục kết quả …]  (mặc định mọi .exports/xm-tu-dong*; lấy bản MỚI NHẤT của mỗi phiếu)
 *  Mỗi phiếu: chép ảnh MỐC (trước/sau), ẢNH GHÉP CÁC GÓC lúc đặt đồ vật, ẢNH KHOANH VÙNG → may/<id>_XM-*.jpg; ghi bang-chung-b1.json[id] = {anh, chu, kenh, luc, nguon:"xac-minh-tu-dong"}. */
import "dotenv/config";   // 14/10: tự nạp .env (BAIXE_DIR…) — chạy thẳng trên PC không qua chay-xm từng ghi bằng chứng vào đường mặc định của laptop
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const DIR = path.dirname(fileURLToPath(import.meta.url)); const EXP = path.join(DIR, ".exports"), XM = path.join(EXP, "agy-xm"); fs.mkdirSync(XM, { recursive: true });   /* 14/10 PC mới chưa có thư mục này */
const MAY = path.join(process.env.BAIXE_DIR ? path.dirname(process.env.BAIXE_DIR) : "C:/Users/lechitam/Videos/5S-bang-chung", "may");   // 14/10 máy trạm: theo BAIXE_DIR như các script khác fs.mkdirSync(MAY, { recursive: true });
const goc = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(EXP).filter((d) => /^xm-tu-dong/.test(d) && fs.statSync(path.join(EXP, d)).isDirectory()).map((d) => path.join(EXP, d));
const ban = {}; for (const r of goc) for (const id of fs.readdirSync(r).filter((x) => /^\d{6,}$/.test(x))) { const f = path.join(r, id, "BAO-CAO.md"); if (!fs.existsSync(f)) continue; const t = fs.statSync(f).mtimeMs; if (!ban[id] || ban[id].t < t) ban[id] = { t, d: path.join(r, id) }; }
const F = path.join(EXP, "bang-chung-b1.json"); const bc = (() => { try { return JSON.parse(fs.readFileSync(F, "utf8")); } catch { return {}; } })();
let n = 0;
for (const [id, { d }] of Object.entries(ban)) {
  const bao = fs.readFileSync(path.join(d, "BAO-CAO.md"), "utf8"); const dong = (k) => (bao.match(new RegExp("^" + k + ":\\s*(.*)$", "m")) || [])[1] || "";
  const anh = []; const chep = (src, ten) => { if (src && fs.existsSync(src)) { const ra = id + "_XM-" + ten + ".jpg"; fs.copyFileSync(src, path.join(MAY, ra)); anh.push(ra); } };
  /* ảnh mốc (trước/sau) từ tim-moc.txt */
  let tm = ""; try { tm = fs.readFileSync(path.join(d, "tim-moc.txt"), "utf8"); } catch { }
  chep((tm.match(/ảnh mốc: (.*MOC\.jpg)/) || [])[1]?.trim(), "MOC");
  /* ảnh ghép các góc quanh giây đặt (7a) */
  const g7 = bao.match(/7a giây đặt[^:]*: (\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d)/); if (g7) { const hau = g7[2] + g7[3] + g7[4] + g7[5]; const dd = fs.readdirSync(XM).filter((x) => x.startsWith("goc_") && x.endsWith("_" + hau)).sort((a, b) => fs.statSync(path.join(XM, b)).mtimeMs - fs.statSync(path.join(XM, a)).mtimeMs)[0]; if (dd) chep(path.join(XM, dd, "LUOI-GOC.jpg"), "GOC"); }
  /* ảnh khoanh vùng (khung đỏ người chụp) */
  const kz = bao.match(/VÙNG: \[[^\]]+\] trên kênh \S+\/(\d+)/); if (kz) chep(path.join(d, "g2b_" + kz[1] + ".jpg"), "VUNG");
  const ketLuan = dong("KẾT LUẬN"), nguoi = dong("NGƯỜI"), moc = (bao.match(/^- (\d{4}-\d\d-\d\d \d\d:\d\d:\d\d) người đặt\/chạm[^\n]*/m) || bao.match(/^- (\d{4}-\d\d-\d\d \d\d:\d\d:\d\d) CÓ[^\n]*/m) || [])[0] || "";
  const kenh = (dong("GÓC CAMERA").match(/(\d+\.\d+\.\d+\.\d+\/\d+)/) || [])[1] || "";
  const giay = g7 ? g7[1] + "-" + g7[2] + "-" + g7[3] + " " + g7[4] + ":" + g7[5] : (dong("PHIẾU").match(/ghi nhận (\S+ \S+)/) || [])[1] || "";
  const chu = "Máy xác minh tự động (camera, không ghi phiếu): " + ketLuan.replace(/ · CẦN USER.*$/, "") + (nguoi && !/^chưa định danh$/.test(nguoi) ? " · Người: " + nguoi.replace(/^chưa định danh — /, "") : "") + (moc ? " · Mốc: " + moc.replace(/^- /, "").replace(/\(nguồn[^)]*\)/, "").trim() : "");
  const cu = bc[id] || {};
  /* 10/10 user: bằng chứng + xác minh phải CỘNG DỒN — trước đây 2 script ghi đè nhau (tim-bang-chung xoá ảnh XM) */
  const anhCu = (cu.anh || []).filter((a) => !/_XM-/.test(a)), chuKho = cu.chuKho || (cu.nguon === "xac-minh-tu-dong" ? "" : cu.chu || "");
  bc[id] = { ...cu, anh: [...anh, ...anhCu].slice(0, 6), chu: chu + (chuKho ? " ‖ " + chuKho : ""), chuKho, kenh: kenh ? "kênh " + kenh.split("/")[1] : cu.kenh, luc: giay || cu.luc, loai: anh.length ? "xm" : cu.loai, nguon: "xac-minh-tu-dong", taiLuc: new Date().toISOString(), xm: { ketLuan, nguoi, doChac: (ketLuan.match(/ĐỘ CHẮC: (\S+)/) || [])[1] || "" } };
  n++; console.log("✓", id, anh.length + " ảnh ·", chu.slice(0, 150));
}
fs.writeFileSync(F, JSON.stringify(bc, null, 1)); console.log("đã đẩy " + n + " phiếu lên bảng Việc 5S (bang-chung-b1.json)");
