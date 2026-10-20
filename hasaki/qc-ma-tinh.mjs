// qc-ma-tinh.mjs — BỘ KIỂM MÃ TĨNH (lint) cho mã trang kiemsoatkho/ · 20/10/2026
// Đánh giá 20/10: bộ chuẩn cấm màu viết cứng, cấm chép lại hàm tiện ích, cấm dựng lớp bảng/nút/chip mới — nhưng không có máy kiểm nên vẫn lọt
// (~1.200 mã màu cứng, esc khai 9 tệp, 13 lớp bảng). Vì tồn đọng lớn, bộ kiểm chạy kiểu «RĂNG CƯA»: đo từng tệp, so với MỐC đã lưu
// (cai-pc/qc-ma-tinh-moc.json) — con số nào TĂNG là HỎNG (chặn đẩy), GIẢM thì tự hạ mốc. Mục tiêu: không tệ thêm, dần dần sạch.
//   node qc-ma-tinh.mjs                 so với mốc (mã thoát 1 nếu hỏng)
//   node qc-ma-tinh.mjs --cap-nhat-moc  ghi mốc = số hiện tại (chỉ khi chủ ý nhận tồn đọng)
//   node qc-ma-tinh.mjs --chi=index.html,hasaki-xacminh.js
// deploy-kiemsoatkho.mjs gọi bộ này TRƯỚC khi đẩy (bỏ qua bằng --bo-qua-lint, phải nêu lý do trong commit).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url)), KS = path.join(DIR, "kiemsoatkho"), MOC_F = path.join(DIR, "cai-pc", "qc-ma-tinh-moc.json");
const A = Object.fromEntries(process.argv.slice(2).filter((x) => x.startsWith("--")).map((x) => { const [k, v] = x.slice(2).split("="); return [k, v ?? "1"]; }));
export const TEP = ["index.html", "hasaki-xacminh.js", "hasaki-maytram.js", "hasaki-planogram.js", "factory-kiemke.js", "factory-stock.js", "hasaki-kiemke.js", "hasaki-pc.js", "hasaki-tonbatthuong.js", "tai-khoan.js", "bo-loc-ngay.js", "hasaki-giaodien-antd.js", "form.html", "nghiem-thu.html"];
const TIEN_ICH = ["esc", "e_", "$id", "toast", "hm", "ngayVN", "baoOk", "baoLoi", "docJ", "debounce"];
const dem = (s, re) => (s.match(re) || []).length;
const tap = (s, re, i = 1) => new Set([...s.matchAll(re)].map((m) => m[i]));

/** Đo 1 tệp → {hex, tienIch:{ten:n}, lopBang:[…], lopNut:[…], lopChip:[…], media:[…], dongDai, cdnKhongGhim} */
export function doTep(ten) {
  const s = fs.readFileSync(path.join(KS, ten), "utf8");
  const tienIch = {}; for (const fn of TIEN_ICH) { const q = fn.replace("$", "\\$"); const n = dem(s, new RegExp("(?:^|[\\s;{(])(?:function " + q + "\\s*\\(|(?:var|const|let) " + q + "\\s*=)", "g")); if (n) tienIch[fn] = n; }
  return {
    hex: dem(s, /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b(?![\w-])/g),                               // mã màu viết cứng (cả trong CSS lẫn JS)
    tienIch,
    lopBang: [...tap(s, /<table[^>]*class=\\?"([a-zA-Z0-9_-]+)/g)].sort(),
    lopNut: [...tap(s, /<button[^>]*class=\\?"([a-zA-Z0-9_-]+)/g)].sort(),
    lopChip: [...tap(s, /class=\\?"[^"\\]*?(?:^|\s)([a-z0-9-]*(?:tag|badge|chip|pill)[a-z0-9-]*)(?=[\s"\\])/g)].sort(),
    media: [...tap(s, /@(?:media|container)[^{]*\((?:max|min)-width:\s*([0-9]+)px/g)].map(Number).sort((a, b) => a - b),
    dongDai: s.split(/\r?\n/).filter((l) => l.length > 250).length,
    cdnKhongGhim: dem(s, /src="https:\/\/(?:unpkg\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|cdn\.tailwindcss\.com)\/[^"@]*(?:@[0-9]+\.x\.x|@latest)?"/g)   // CDN không có @phiên bản chính xác
      + dem(s, /src="https:\/\/cdn\.tailwindcss\.com"/g),
  };
}
const soSanh = (ten, moc, nay) => {   // → danh sách lỗi (TĂNG so với mốc) + danh sách giảm
  const loi = [], giam = [];
  const so = (nhan, a, b) => { if (b > a) loi.push(`${ten}: ${nhan} ${a} → ${b}`); else if (b < a) giam.push(`${ten}: ${nhan} ${a} → ${b}`); };
  so("mã màu viết cứng", moc.hex, nay.hex); so("dòng >250 ký tự", moc.dongDai, nay.dongDai); so("CDN không ghim bản", moc.cdnKhongGhim, nay.cdnKhongGhim);
  for (const fn of new Set([...Object.keys(moc.tienIch || {}), ...Object.keys(nay.tienIch)])) so("khai lại tiện ích " + fn, (moc.tienIch || {})[fn] || 0, nay.tienIch[fn] || 0);
  for (const k of ["lopBang", "lopNut", "lopChip"]) { const them = nay[k].filter((x) => !(moc[k] || []).includes(x)); if (them.length) loi.push(`${ten}: ${k === "lopBang" ? "lớp BẢNG mới" : k === "lopNut" ? "lớp NÚT mới" : "lớp CHIP mới"} ${them.join(", ")} — tái dùng lớp sẵn có`); }
  const mediaThem = nay.media.filter((x) => !(moc.media || []).includes(x)); if (mediaThem.length) loi.push(`${ten}: điểm gãy bố cục mới ${mediaThem.join(", ")}px — dùng ngưỡng đã có (${(moc.media || []).join(", ")})`);
  return { loi, giam };
};

if (process.argv[1] && path.basename(process.argv[1]) === "qc-ma-tinh.mjs") {
  const ten = A.chi ? A.chi.split(",") : TEP.filter((t) => fs.existsSync(path.join(KS, t)));
  const nay = {}; for (const t of ten) nay[t] = doTep(t);
  let moc = {}; try { moc = JSON.parse(fs.readFileSync(MOC_F, "utf8")); } catch { /* chưa có mốc */ }
  if (A["cap-nhat-moc"] || !Object.keys(moc).length) { const m = { ...moc, ...nay, _luc: new Date().toISOString() }; fs.writeFileSync(MOC_F, JSON.stringify(m, null, 1)); console.log("✓ đã ghi mốc " + Object.keys(nay).length + " tệp → " + path.relative(DIR, MOC_F)); process.exit(0); }
  let loiTong = [], giamTong = [];
  for (const t of ten) { if (!moc[t]) { loiTong.push(`${t}: chưa có mốc — chạy --cap-nhat-moc`); continue; } const r = soSanh(t, moc[t], nay[t]); loiTong.push(...r.loi); giamTong.push(...r.giam); }
  const tong = (o) => Object.values(o).filter((x) => x && typeof x === "object" && "hex" in x).reduce((a, x) => a + x.hex, 0);
  console.log(`mã màu cứng: ${tong(nay)} (mốc ${tong(moc)}) · tệp đo: ${ten.length}`);
  if (giamTong.length) { console.log("  GIẢM (tốt, hạ mốc): " + giamTong.join(" · ")); const m = { ...moc }; for (const t of ten) m[t] = nay[t]; m._luc = new Date().toISOString(); fs.writeFileSync(MOC_F, JSON.stringify(m, null, 1)); }
  if (loiTong.length) { console.log("  HỎNG (" + loiTong.length + "):\n   - " + loiTong.join("\n   - ")); process.exit(1); }
  console.log("  ĐẠT — không tệ thêm so với mốc."); process.exit(0);
}
