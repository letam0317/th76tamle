/**
 * co-luy-tien.mjs — CÒ TỰ GHI NHẬN LUỸ TIẾN "đi làm mà KHÔNG báo cáo vệ sinh" (user chốt 17/10/2026)
 * ===========================================================================================
 *  User: «cần có cò canh ghi nhận nếu có đi làm, có đóng gói tại vị trí đó mà không báo cáo — hoặc đóng gói tại vị
 *  trí khác (có báo cáo) — chứ sao lại bỏ, hết hạn». Thay vì để lần vi phạm tồn trong sổ chờ người bấm nút (rồi bị
 *  kê ngày từ 2 tháng trước), cò chạy MỖI NGÀY: ai đủ 3 lần chưa ghi nhận → tự lập biên bản −2% KPI.
 *
 *  Chốt với user 17/10:
 *    · CHỈ TÍNH TỪ 17/10/2026 (CLT_TU). Tồn cũ trước đó để nguyên cho nút "Ghi nhận 5S" bấm tay.
 *    · Phần ghi nhận NHÂN VIÊN chỉ do cò này làm (luat-3-ngay bỏ nhánh "task"; giữ nghỉ dài / không người / báo QL).
 *
 *  Sổ đếm = cột "Vi phạm" của tab VESINH-CHAMCONG-NGAY (vipham-vesinh.tinhSoViPham — đã quy trách nhiệm theo CAMERA:
 *  bàn A8 có người đóng gói → người đứng bàn chịu; phụ trách đóng ở bàn khác đã báo cáo → miễn). Mốc đã ghi nhận =
 *  cột "Đã ghi nhận KPI" (đọc từ WMS-5S-AUDIT) ∪ sổ máy .co-luy-tien.json (phiếu cò vừa gửi, sync chưa kịp đọc lại).
 *
 *  Gửi biên bản qua ĐÚNG đường của form Ghi nhận 5S (POST GAS không action → dòng WMS-5S-AUDIT) ⇒ push-5s-to-workflow
 *  tạo phiếu WF591 + đóng B1 cho NV (cột Nhân viên vi phạm) như phiếu bấm tay; sổ đếm tự nhận mốc ⇒ nút tay và cò
 *  không bao giờ trừ trùng. 0 lượt WMS/HR/work: chỉ đọc tab qua GAS + 1 POST/biên bản.
 *
 *  node co-luy-tien.mjs            → DIỄN TẬP: in danh sách biên bản sẽ lập → .exports/co-luy-tien-dien-tap.md
 *  node co-luy-tien.mjs --lam      → gửi thật (task «5S Co luy tien» 10:15 hằng ngày)
 * ===========================================================================================
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { docTabGas, gasPost } from "./session-rules.js";
import { docCotVp, docCotGhi, chuKy, MOI_LAN, HM_VESINH, napCameraVaPacker, lechNgay } from "./vipham-vesinh.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const LAM = process.argv.includes("--lam");
const TU = process.env.CLT_TU || "2026-10-17";              // user 17/10: chỉ tính từ hôm nay
const MAX = Number((process.argv.find((x) => x.startsWith("--max=")) || "").slice(6) || 30);
const F_SO = path.join(DIR, ".co-luy-tien.json");
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Ho_Chi_Minh" }), ...a);
const homNay = new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10);
const homQua = lechNgay(homNay, -1);
const dmy = (d) => d.slice(8, 10) + "/" + d.slice(5, 7) + "/" + d.slice(0, 4);
const dm = (d) => d.slice(8, 10) + "/" + d.slice(5, 7);
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

const so = (() => { try { return JSON.parse(fs.readFileSync(F_SO, "utf8")); } catch { return { phieu: {} }; } })();

const tab = await docTabGas("VESINH-CHAMCONG-NGAY", () => {});
if (!tab || !tab.rows) { log("✗ không đọc được VESINH-CHAMCONG-NGAY — dừng."); process.exit(75); }
const H = tab.header.map((h) => String(h).trim().toLowerCase());
const iCode = H.indexOf("code"), iTen = H.indexOf("name"), iEm = H.indexOf("email"), iCC = H.findIndex((h) => /^chấm công theo ngày/.test(h)),
  iVp = H.findIndex((h) => /^vi phạm/.test(h)), iGhi = H.findIndex((h) => /^đã ghi nhận kpi/.test(h));
if (iVp < 0) { log("✗ tab chưa có cột Vi phạm — dừng."); process.exit(75); }
const { camBan, packer } = await napCameraVaPacker(DIR, docTabGas);

const KH = [];
for (const r of tab.rows) {
  const code = String(r[iCode] || "").replace(/\.0$/, "").trim(); if (!code) continue;
  const vp = docCotVp(r[iVp]), vpTu = {};
  for (const d in vp) if (d >= TU && d <= homQua) vpTu[d] = vp[d];   // chỉ ngày ĐÃ KHÉP từ mốc bắt đầu
  if (Object.keys(vpTu).length < MOI_LAN) continue;
  let ghi = docCotGhi(iGhi >= 0 ? r[iGhi] : "");
  for (const k in so.phieu) if (k.startsWith(code + "|")) ghi.push(k.split("|")[1]);
  const cc = {}; for (const m of String(r[iCC] || "").matchAll(/(\d{4}-\d{2}-\d{2})\s+(\S+?)-(\S+)/g)) cc[m[1]] = m[2] + "–" + m[3];
  const em = String(r[iEm] || "").toLowerCase();
  for (let i = 0; i < 5; i++) {   // nhiều phiếu nợ → lập lần lượt, mỗi phiếu kê 3 ngày cũ nhất
    const k = chuKy(vpTu, ghi, homQua, 0);
    if (!k.du) break;
    const ngay = k.keNay.map((d) => {
      const o = vpTu[d].o, chiTiet = o.map((loc) => {
        const cam = camBan[loc]; const dung = cam && (packer[d] || []).filter((x) => x[0] === cam && String(x[1]).toLowerCase() === em)[0];
        return loc.replace(/^F0-/, "") + (dung ? " (đứng bàn " + cam + ", " + dung[4] + " phiếu " + dung[2] + "–" + dung[3] + ")" : "");
      });
      return { d, o, dong: dm(d) + ": " + chiTiet.join(", ") + " · " + (cc[d] ? "chấm công " + cc[d] : "có mặt theo camera") };
    });
    /* 24/10 user: mô tả kê ĐỦ từng ngày từ lần 1 → lần 3 (vd 15/16 đi làm không báo cáo · 17/18 nghỉ · 19 đi làm không báo cáo)
       để NV thấy ngày nghỉ KHÔNG bị tính — phiếu 14264232 kê 2 ngày nghỉ mà không nói rõ nên NV tưởng bị phạt oan. */
    const lich = [];
    for (let d = k.keNay[0]; d <= k.keNay[MOI_LAN - 1]; d = lechNgay(d, 1)) {
      const x = ngay.find((y) => y.d === d);
      lich.push(x ? x.dong + " → TÍNH 1 lần" : dm(d) + ": " + (cc[d] ? "đi làm " + cc[d] + ", không vi phạm" : "nghỉ") + " → không tính");
    }
    KH.push({ code, ten: String(r[iTen] || ""), em, ngay, lich, d3: k.keNay[MOI_LAN - 1], soPhieu: k.soPhieu, n: k.n });
    ghi = ghi.concat(k.keNay[MOI_LAN - 1]);
  }
}

const L = ["# Diễn tập cò luỹ tiến — " + homNay, "", "Tính từ " + dmy(TU) + " tới " + dmy(homQua) + " (ngày đã khép). Mỗi biên bản = " + MOI_LAN + " lần → KPI −2%.", "",
  "**" + KH.length + " biên bản** sẽ lập" + (LAM ? "" : " (diễn tập — chưa gửi gì)") + ".", ""];
for (const p of KH) { L.push("## " + p.ten + " (" + p.code + ") — " + p.ngay.map((x) => dm(x.d)).join(" · ")); for (const x of p.lich) L.push("- " + x); L.push(""); }
fs.mkdirSync(path.join(DIR, ".exports"), { recursive: true });
fs.writeFileSync(path.join(DIR, ".exports", "co-luy-tien-dien-tap.md"), L.join("\n"));
log("cò luỹ tiến: " + KH.length + " biên bản (" + (LAM ? "LÀM THẬT" : "diễn tập") + "), tính từ " + TU);
for (const p of KH) log("  " + p.ten.padEnd(28) + p.code.padEnd(8) + p.ngay.map((x) => dm(x.d) + "[" + x.o.length + " ô]").join(" "));
if (!LAM || !KH.length) process.exit(0);

/* Ảnh bằng chứng (form/bộ đẩy cần ≥1 ảnh — IMA00 bắt buộc): bảng 3 ngày dựng bằng Edge headless, như luat-3-ngay. */
const { EDGE_PATH } = await import("./token-store.js");
const puppeteer = (await import("puppeteer")).default;
const trinh = await puppeteer.launch({ headless: true, executablePath: EDGE_PATH, args: ["--no-first-run"] });
async function anh(p) {
  const html = "<meta charset=utf-8><style>body{font:14px Arial;margin:16px;color:#111}h2{margin:0 0 4px;font-size:18px}p{margin:0 0 10px;color:#555}table{border-collapse:collapse;width:100%}td,th{border:1px solid #bbb;padding:6px 8px;vertical-align:top}th{background:#fee2e2}</style>" +
    "<h2>" + esc(p.ten) + " (" + esc(p.code) + ") — " + MOI_LAN + " ngày đi làm không báo cáo vệ sinh</h2><p>Cò luỹ tiến tự lập " + dmy(homNay) + " · nguồn: yêu cầu vệ sinh planogram · camera đóng gói A8 · bảng phân công · chấm công</p>" +
    "<table><tr><th>Ngày</th><th>Vị trí không báo cáo · người có mặt</th></tr>" + p.lich.map((x) => "<tr><td>" + x.slice(0, 5) + "</td><td>" + esc(x.slice(7)) + "</td></tr>").join("") + "</table>";
  const pg = await trinh.newPage(); await pg.setViewport({ width: 860, height: 300 }); await pg.setContent(html);
  const b = await pg.screenshot({ fullPage: true, type: "png" }); await pg.close(); return Buffer.from(b).toString("base64");
}
let n = 0;
try {
  for (const p of KH) {
    if (n >= MAX) break;
    const khoa = p.code + "|" + p.d3;
    if (so.phieu[khoa]) continue;
    const hienTrang = ["Cò tự ghi nhận: " + MOI_LAN + " ngày có đi làm nhưng KHÔNG báo cáo vệ sinh vị trí được giao"]
      .concat(p.lich)
      .concat(["Phụ trách: " + p.ten + " (" + p.code + ") -Có đi làm nhưng KHÔNG báo cáo vệ sinh ô này",
        "Vi phạm luỹ tiến: đủ " + MOI_LAN + " lần (" + p.ngay.map((x) => dmy(x.d)).join(" · ") + ") → KPI -2%",
        "Người ghi nhận: Cò luỹ tiến (tự động)"]).join("\n");
    const j = await gasPost({ hienTrang, viTri: p.ngay[MOI_LAN - 1].o[0], maSanPham: "", hangMuc: HM_VESINH, nhanVienViPham: p.code,
      thoiGianViPham: lechNgay(p.d3, 1) + " 07:00:00", key: process.env.APPSCRIPT_KEY, nguoiGui: { ten: "Cò luỹ tiến (tự động)", code: "" },
      hinhAnh: [{ ten: "luy-tien-" + p.code + "-" + p.d3 + ".png", mime: "image/png", base64: await anh(p) }] }, log, "co-luy-tien");
    if (!j || j.status !== "success") { log("✗ " + p.ten + ": GAS trả " + JSON.stringify(j).slice(0, 160)); continue; }
    so.phieu[khoa] = { at: Date.now(), ngay: p.ngay.map((x) => x.d) };
    fs.writeFileSync(F_SO, JSON.stringify(so));
    n++; log("✓ " + p.ten + " (" + p.code + ") " + p.ngay.map((x) => dm(x.d)).join(" · ") + " → WMS-5S-AUDIT (bộ đẩy tạo phiếu lượt kế)");
  }
} finally { await trinh.close().catch(() => {}); }
log("Xong: " + n + " biên bản.");
