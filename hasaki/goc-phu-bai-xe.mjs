// goc-phu-bai-xe.mjs — GÓC CAMERA PHỤ cho lượt bãi xe · 20/10/2026
// Ghi chú cải tiến của user 19/10 (lượt 2026-10-14_AIBV_074132): «Người đi sang góc khác nên không thấy rõ, nên lấy thêm góc khác cùng
//   thời điểm để xác minh được là ai — camera Sân nhập hàng ở 170 QL1A - 1». Đối chiếu khung 14/10 07:39: kênh 18 «San Nhap Hang 2» của đầu
//   ghi 170 QL1A - 1 (172.16.10.10) nhìn ngược về đúng khu bãi bảo vệ, thấy rõ người dắt xe lúc camera AI Bảo vệ chỉ thấy lờ mờ.
// Mỗi lượt của camera có trong GOC_PHU: cắt 90 s (20 s trước giờ có người → 70 s sau; 20/10 user duyệt nới từ 60 s; 150 s = 40 MB/lượt, quá nặng) ở góc phụ → .exports/.bai-xe-tam/<ngày>/ (giữ 14 ngày
//   như đoạn chính) → ghi lượt.gocPhu = [{ten, host, kenh, file, bd}] vào <BAIXE_DIR>/<ngày>/ket-qua.json. Bảng Xác minh: chip «Góc khác».
// Camera ghi theo chuyển động → cổng agy-xm cat-doan tự thử lệch giờ, bd = giờ THẬT đầu đoạn.
//   node goc-phu-bai-xe.mjs [--ngay=YYYY-MM-DD] [--id=<lượt>] [--max=20] [--ca-da-quyet]   (mặc định: mọi ngày ≤14 ngày, chỉ lượt chưa quyết)
// Tải: chỉ đầu ghi top-review (~24 MB/lượt — kênh 18 bitrate cao). 0 lượt work/wms/hr.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import "dotenv/config";

const DIR = path.dirname(fileURLToPath(import.meta.url));
export const GOC_PHU = {
  AIBV: [{ ten: "San Nhap Hang 2", host: "172.16.10.10", kenh: 18 }],
};
const A = Object.fromEntries(process.argv.slice(2).filter((x) => x.startsWith("--")).map((x) => { const [k, v] = x.slice(2).split("="); return [k, v ?? "1"]; }));
const GOC = process.env.BAIXE_DIR || "C:/Users/lechitam/Videos/5S-bang-chung/bai-xe";
const MAX = Number(A.max || 20);
const log = (...a) => console.log(new Date().toTimeString().slice(0, 8), ...a);
const docJ = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };
const han = new Date(Date.now() + 7 * 36e5 - 14 * 864e5).toISOString().slice(0, 10);
const QD = docJ(path.join(DIR, ".exports", "bai-xe-quyet-dinh.json"), {});
const ms = (ngay, hms) => Date.parse(`${ngay}T${hms}+07:00`);
const gio = (t) => new Date(t + 7 * 36e5).toISOString().slice(11, 19);

const ngays = A.ngay ? [A.ngay] : fs.readdirSync(GOC).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= han).sort().reverse();
let lam = 0, loi = 0;
const ghi = (F, k) => { const tam = F + ".tam"; fs.writeFileSync(tam, JSON.stringify(k, null, 1)); fs.renameSync(tam, F); };   // ghi SAU MỖI lượt — bị dừng giữa chừng không mồ côi tệp
for (const ngay of ngays) {
  const F = path.join(GOC, ngay, "ket-qua.json"), k = docJ(F, null); if (!k) continue;
  let doi = false;
  for (const l of k.luot || []) {
    if (lam >= MAX) break;
    const goc = GOC_PHU[l.ma]; if (!goc || (A.id && l.id !== A.id)) continue;
    if (!A["ca-da-quyet"] && !A.id && QD[l.id]?.qd) continue;                       // đã quyết → không cần thêm góc
    if (l.xeTaiChe && !A.id) continue;                                                // xe tải che bãi → chỉ lưu vết, khỏi cắt
    for (const g of goc) {
      if ((l.gocPhu || []).some((x) => x.host === g.host && x.kenh === g.kenh && fs.existsSync(x.file))) continue;
      const t = ms(ngay, l.gioNguoi || l.tu) - 20e3, ra = path.join(DIR, ".exports", ".bai-xe-tam", ngay, `${l.id.split("_").slice(1).join("-")}-g${g.host.split(".").pop()}-${g.kenh}.mp4`);
      fs.mkdirSync(path.dirname(ra), { recursive: true });
      const r = spawnSync(process.execPath, [path.join(DIR, "agy-xm.mjs"), "cat-doan", g.host, g.kenh, new Date(t + 7 * 36e5).toISOString().slice(0, 19), 90, ra], { cwd: DIR, encoding: "utf8", timeout: 20 * 60e3 });
      const out = String(r.stdout || "") + String(r.stderr || "");
      if (r.status !== 0 || !fs.existsSync(ra)) { loi++; log(`✗ ${l.id} · ${g.ten}: ${out.trim().split("\n").pop().slice(0, 140)}`); continue; }
      const lech = Number((/LỆCH ([+-]?\d+) s/.exec(out) || [])[1] || 0);
      l.gocPhu = (l.gocPhu || []).filter((x) => !(x.host === g.host && x.kenh === g.kenh)).concat([{ ten: g.ten, host: g.host, kenh: g.kenh, file: ra, bd: gio(t + lech * 1000), giay: 90 }]);   /* giay = độ dài đoạn → bảng chỉ hiện mốc nằm trong đoạn */
      doi = true; lam++; ghi(F, k); log(`✓ ${l.id} · ${g.ten} từ ${gio(t + lech * 1000)}${lech ? ` (lệch ${lech} s — camera ghi theo chuyển động)` : ""}`);
    }
  }
  if (lam >= MAX) break;
}
log(`xong: ${lam} đoạn góc phụ${loi ? ` · ${loi} lỗi` : ""}`);
