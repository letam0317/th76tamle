/**
 * xem-noi-bo.mjs — TRANG DUYỆT BẢN NỘI BỘ trước khi push live (yêu cầu user 23/08/2026:
 * "hoàn tất cải tiến thì cho xem bản nội bộ trước khi push live / commit lên link").
 *
 * Phục vụ THẲNG file trên đĩa (bản đã sửa, CHƯA push) qua HTTP nội bộ:
 *   · máy này  : http://localhost:8123/factory/          (Audit Factory)
 *                http://localhost:8123/kiemsoatkho/      (Kiểm soát kho 5S)
 *   · điện thoại (cùng Wi-Fi): thay localhost bằng IP LAN in ra bên dưới.
 * gviz + Apps Script gọi được bình thường (JSONP/CORS *), nên trang nội bộ chạy với DỮ LIỆU THẬT.
 * Service worker chỉ đăng ký trên localhost/https — xem qua IP LAN thì SW không chạy (đúng chủ đích,
 * bản duyệt không được cache đè bản live).
 *
 * Chạy: node xem-noi-bo.mjs   (Ctrl+C để tắt — hoặc dùng XEM-BAN-NOI-BO.bat)
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const DIR = path.dirname(fileURLToPath(import.meta.url));      // hasaki/
const GOC = path.resolve(DIR, "..");                            // thư mục dự án
const PORT = Number(process.env.NOIBO_PORT || 8123);
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".pdf": "application/pdf" };

// Phục vụ các thư mục dashboard và form nội bộ
const CHO_PHEP = {
  factory: path.join(GOC, "factory"),
  kiemsoatkho: path.join(GOC, "hasaki", "kiemsoatkho"),
  "form-5s": path.join(GOC, "hasaki", "public"),
  public: path.join(GOC, "hasaki", "public")
};

/* ── API chế độ Chỉnh sửa bố cục trang 3D kho 170 (user 29/09) ──
 * CHỈ nhận từ chính máy này (127.0.0.1) — điện thoại cùng Wi-Fi xem được nhưng KHÔNG ghi/chốt được.
 *   GET  /api/3d/ping   → {ok, chay}
 *   POST /api/3d/bocuc  {vat:[…]} → ghi kiemsoatkho/kho170-bocuc.js (bản QC)
 *   POST /api/3d/chot   → chạy nền 4 bước: chụp sơ đồ lưới → QC 3D → QC sơ đồ → đẩy lên live (chỉ 4 tệp 3D)
 *   GET  /api/3d/chot   → tiến độ {chay, xong, ok, buoc, ten, loi}
 */
const TEP_BOCUC = path.join(GOC, "hasaki", "kiemsoatkho", "kho170-bocuc.js");
const BUOC_CHOT = [
  ["chụp lại sơ đồ lưới (top-view)", ["xuat-topview-kho170.mjs"]],
  ["QC mô phỏng 3D", ["qc-kho170-3d.mjs"]],
  ["QC sơ đồ lưới tab Planogram", ["qc-mat-bang-170.mjs"]],
  ["đẩy lên live", ["deploy-kiemsoatkho.mjs", "--chi", "kho170-3d.html,kho170-bocuc.js,kho170-topview.js,kho170-topview.webp"]],
];
let CHOT = { chay: false, xong: false, ok: false, buoc: 0, ten: "", loi: "" };
const laMayNay = (req) => /^(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$/.test(req.socket.remoteAddress || "");
const traJson = (res, code, j) => { res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(JSON.stringify(j)); };
function docThan(req) {
  return new Promise((ok, loi) => { let b = ""; req.on("data", (c) => { b += c; if (b.length > 2e6) req.destroy(); }); req.on("end", () => ok(b)); req.on("error", loi); });
}
function ghiBoCuc(vat) {
  if (!Array.isArray(vat)) throw new Error("thiếu danh sách vat");
  const sach = vat.map((v) => {
    if (!v || typeof v.id !== "string" || typeof v.loai !== "string") throw new Error("món thiếu id/loai");
    ["x", "z", "w", "d"].forEach((k) => { if (!isFinite(+v[k])) throw new Error("món " + v.id + " sai số " + k); });
    return v;
  });
  const j = { ver: 1, ngay: new Date().toISOString(), vat: sach };
  fs.writeFileSync(TEP_BOCUC, "/* kho170-bocuc.js — BỐ CỤC ĐỒ ĐẠC dời được của trang 3D kho 170.\n" +
    " * Ghi bởi chế độ Chỉnh sửa bố cục (bản QC, xem-noi-bo.mjs). Đừng sửa tay — mở bản QC mà kéo thả. */\n" +
    "window.KHO170_BOCUC = " + JSON.stringify(j, null, 1) + ";\n", "utf8");
}
function chayBuoc(i) {
  if (i >= BUOC_CHOT.length) { CHOT = { ...CHOT, chay: false, xong: true, ok: true }; console.log("✓ Chốt bố cục 3D xong — đã lên live"); return; }
  const [ten, args] = BUOC_CHOT[i];
  CHOT = { ...CHOT, buoc: i + 1, ten };
  console.log("… chốt bố cục 3D · bước " + (i + 1) + "/" + BUOC_CHOT.length + ": " + ten);
  let duoi = "";
  const p = spawn(process.execPath, args, { cwd: DIR, env: process.env });
  const ghi = (c) => { duoi = (duoi + c).slice(-4000); };
  p.stdout.on("data", ghi); p.stderr.on("data", ghi);
  p.on("close", (code) => {
    if (code === 0) return chayBuoc(i + 1);
    const dong = duoi.split(/\r?\n/).filter((l) => /SAI|✗|lỗi|Error|KHÔNG ĐẠT/i.test(l)).slice(-3).join(" · ");
    CHOT = { ...CHOT, chay: false, xong: true, ok: false, loi: (dong || duoi.trim().split(/\r?\n/).pop() || "mã thoát " + code).slice(0, 400) };
    console.log("✗ Chốt dừng ở bước " + (i + 1) + ": " + CHOT.loi);
  });
}
async function api3d(req, res, u) {
  if (!laMayNay(req)) return traJson(res, 403, { ok: false, loi: "chỉ máy chạy bản QC mới được sửa/chốt" });
  if (u === "/api/3d/ping") return traJson(res, 200, { ok: true, chay: CHOT.chay });
  if (u === "/api/3d/bocuc" && req.method === "POST") {
    try { ghiBoCuc(JSON.parse(await docThan(req)).vat); return traJson(res, 200, { ok: true }); }
    catch (e) { return traJson(res, 400, { ok: false, loi: e.message }); }
  }
  if (u === "/api/3d/chot" && req.method === "POST") {
    if (CHOT.chay) return traJson(res, 409, { ok: false, loi: "đang chốt dở — chờ xong" });
    CHOT = { chay: true, xong: false, ok: false, buoc: 0, ten: "", loi: "" }; chayBuoc(0);
    return traJson(res, 200, { ok: true });
  }
  if (u === "/api/3d/chot") return traJson(res, 200, CHOT);
  return traJson(res, 404, { ok: false, loi: "không có đường này" });
}

const server = http.createServer((req, res) => {
  try {
    const u = decodeURIComponent((req.url || "/").split("?")[0]);
    if (u.startsWith("/api/3d/")) return void api3d(req, res, u).catch((e) => traJson(res, 500, { ok: false, loi: e.message }));
    const m = u.match(/^\/(factory|kiemsoatkho|form-5s|public)(\/.*)?$/);
    if (!m) {
      res.writeHead(302, { Location: "/factory/" });
      return res.end();
    }
    const goc = CHO_PHEP[m[1]];
    let rel = (m[2] || "/").replace(/\/+$/, "/");
    if (rel === "/" || rel === "") rel = "/index.html";
    const file = path.normalize(path.join(goc, rel));
    if (!file.startsWith(goc)) { res.writeHead(403); return res.end("403"); }   // chặn ../
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end("404 " + rel); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store" });   // bản duyệt LUÔN đọc từ đĩa — sửa file là F5 thấy ngay
    fs.createReadStream(file).pipe(res);
  } catch (e) { res.writeHead(500); res.end(String(e && e.message || e)); }
});

server.listen(PORT, () => {
  const ips = Object.values(os.networkInterfaces()).flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal).map((i) => i.address);
  console.log("BẢN NỘI BỘ đang phục vụ (Ctrl+C để tắt):");
  console.log("  1) Form 5S (Có Mục 5 NV vi phạm) : http://localhost:" + PORT + "/form-5s/");
  console.log("  2) Form Audit pop-up              : http://localhost:" + PORT + "/kiemsoatkho/form.html");
  console.log("  3) Dashboard Kiểm soát kho 5S     : http://localhost:" + PORT + "/kiemsoatkho/");
  console.log("  4) Dashboard Factory              : http://localhost:" + PORT + "/factory/");
  ips.forEach((ip) => console.log("  Điện thoại (Wi-Fi)                : http://" + ip + ":" + PORT + "/form-5s/"));
});
