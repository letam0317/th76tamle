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
  retail: path.join(GOC, "hasaki", "kiemsoatkho"),   // 13/10: Audit Retail — cùng thư mục, link mới /retail/… (khớp audit-dc.pages.dev/retail/)
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
  ["QC sơ đồ lưới trên điện thoại", ["qc-mat-bang-170.mjs", "--mobile"]],
  ["đẩy lên live", ["deploy-kiemsoatkho.mjs", "--chi", "kho170-3d.html,kho170-bocuc.js,kho170-topview.js,kho170-topview.webp,hasaki-planogram.js,taisan-vitri.js"]],
];
/* ── Kho LIÊN ANH (05/10/2026): cùng khuôn API, đường /api/3d/lienanh/… — CHỈ NỘI BỘ, KHÔNG có bước deploy.
 *   POST /api/3d/lienanh/bocuc {khu, vat, xoa, luat} → kiemsoatkho/lienanh-bocuc.js (gitignore)
 *   POST /api/3d/lienanh/chot  {svg, dxf, png, khu, vat, luat} → ghi .exports/lienanh/<mốc>/ rồi chạy QC 3D + kiểm DXF bằng AutoCAD */
const TEP_BOCUC_LA = path.join(GOC, "hasaki", "kiemsoatkho", "lienanh-bocuc.js");
const THU_MUC_LA = path.join(DIR, ".exports", "lienanh");
const KHO = {
  kho170: { tep: TEP_BOCUC, buoc: () => BUOC_CHOT, than: 2e6 },
  lienanh: { tep: TEP_BOCUC_LA, than: 40e6, buoc: (chot) => [
    ["QC mô phỏng 3D Liên Anh", ["qc-lienanh-3d.mjs", "--url", "http://localhost:" + PORT + "/kiemsoatkho/lienanh-3d.html"]],
    ["kiểm DXF bằng AutoCAD (AUDIT + lưu DWG)", ["kiem-dxf-lienanh.mjs", chot.dxf]],
  ] },
};
const CHOT_DS = { kho170: { chay: false, xong: false, ok: false, buoc: 0, ten: "", loi: "" }, lienanh: { chay: false, xong: false, ok: false, buoc: 0, ten: "", loi: "" },
  "dash-retail": { chay: false, xong: false, ok: false, buoc: 0, ten: "", loi: "" }, "dash-factory": { chay: false, xong: false, ok: false, buoc: 0, ten: "", loi: "" } };

/* ── BỘ CHỈNH DASHBOARD (13/10/2026, t5 user: «di chuyển/chỉnh vị trí, kích thước, bổ sung/xoá/sao chép dashboard ở bản QC trước khi chốt phát hành»)
 * cùng khuôn Liên Anh: GET /api/dash/<retail|factory>/ping · POST …/bocuc {tab, khoi} → <app>/dash-bocuc.js (bản QC, trang thật cũng đọc tệp này)
 * POST …/chot → QC đồng bộ antd + điều hướng + điện thoại, ĐẠT hết mới đẩy (Retail: deploy-kiemsoatkho --chi · Factory: git push repo factory)
 * Sao lưu bản CŨ trước khi ghi: ngay khi bớt tab/khối, còn lại ≥10' một bản, giữ 300 bản (.exports/dash/<app>/). */
const DASH = {
  retail: { tep: path.join(GOC, "hasaki", "kiemsoatkho", "dash-bocuc.js"), trang: "5s", buoc: () => [
    ["QC đồng bộ Ant Design (máy tính)", ["qc-dong-bo-antd.mjs"]],
    ["QC đồng bộ Ant Design (điện thoại)", ["qc-dong-bo-antd.mjs", "--w=390"]],
    ["QC điều hướng + Tổng quan", ["qc-dieu-huong.mjs"]],
    ["QC bố cục điện thoại", ["qc-mobile-toan-du-an.mjs", "--file", "--trang=5s", "--may=android"]],
    ["đẩy lên live", ["deploy-kiemsoatkho.mjs", "--chi", "dash-bocuc.js,dash-bocuc-ap.js"]],
  ] },
  factory: { tep: path.join(GOC, "factory", "dash-bocuc.js"), trang: "factory", buoc: () => [
    ["QC đồng bộ Ant Design (máy tính)", ["qc-dong-bo-antd.mjs", "--trang=factory"]],
    ["QC điều hướng + Tổng quan", ["qc-dieu-huong.mjs"]],
    ["QC bố cục điện thoại", ["qc-mobile-toan-du-an.mjs", "--file", "--trang=factory", "--may=android"]],
    ["đẩy lên live", ["day-bocuc-factory.mjs"]],
  ] },
};
function docBoCucDash(tep) { try { const t = fs.readFileSync(tep, "utf8"); return JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1)); } catch (e) { return {}; } }
const saoLuuDashLuc = {};
function ghiBoCucDash(app, j, chot) {
  const K = DASH[app];
  if (!Array.isArray(j.tab) || typeof j.khoi !== "object" || !j.khoi) throw new Error("thiếu tab/khoi");
  j.tab.forEach((t) => { if (!t || typeof t.k !== "string") throw new Error("tab thiếu khoá k"); });
  Object.keys(j.khoi).forEach((k) => { if (!Array.isArray(j.khoi[k])) throw new Error("khối của " + k + " phải là danh sách");
    j.khoi[k].forEach((b) => { if (!b || typeof b.id !== "string") throw new Error("khối thiếu id"); if (b.rong != null && !(b.rong >= 1 && b.rong <= 12)) throw new Error("khối " + b.id + " rộng ngoài 1–12"); }); });
  const cu = docBoCucDash(K.tep);
  const tb = j.thanhBen && typeof j.thanhBen === "object" && !Array.isArray(j.thanhBen) ? j.thanhBen : (cu.thanhBen || {});   // 17/10 bố cục thanh bên theo khung (Xác minh)
  Object.keys(tb).forEach((k) => { if (!tb[k] || !Array.isArray(tb[k].khung)) throw new Error("thanh bên " + k + " thiếu danh sách khung"); });
  const o = { ver: (cu.ver | 0) + 1, ngay: new Date().toISOString(), tab: j.tab, khoi: j.khoi, thanhBen: tb, chot: chot ? { ngay: new Date().toISOString(), ver: (cu.ver | 0) + 1 } : (cu.chot || null) };
  try {
    const dem = (x) => (x.tab || []).filter((t) => !t.an).length + Object.values(x.khoi || {}).reduce((a, d) => a + d.filter((b) => !b.an).length, 0);
    const giam = dem(o) < dem(cu);
    if (fs.existsSync(K.tep) && (giam || Date.now() - (saoLuuDashLuc[app] || 0) >= 10 * 60e3)) {
      const thu = path.join(DIR, ".exports", "dash", app); fs.mkdirSync(thu, { recursive: true });
      fs.copyFileSync(K.tep, path.join(thu, "dash-bocuc-v" + (cu.ver | 0) + "-" + new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + (giam ? "-truoc-khi-giam" : "") + ".js"));
      saoLuuDashLuc[app] = Date.now();
      const ds = fs.readdirSync(thu).map((f) => [f, fs.statSync(path.join(thu, f)).mtimeMs]).sort((a, b) => a[1] - b[1]);
      ds.slice(0, Math.max(0, ds.length - 300)).forEach((f) => fs.unlinkSync(path.join(thu, f[0])));
    }
  } catch (e) { console.log("sao lưu bố cục dashboard lỗi:", e.message); }
  fs.writeFileSync(K.tep, "/* dash-bocuc.js — BỐ CỤC dashboard " + (app === "retail" ? "Audit Retail" : "Audit Factory") + " (tab thanh bên + khối trong tab).\n" +
    " * Ghi bởi bộ Chỉnh bố cục ở bản QC (xem-noi-bo.mjs → /api/dash/" + app + "/bocuc). Đừng sửa tay. Áp bởi dash-bocuc-ap.js. */\n" +
    "window.DASH_BOCUC = " + JSON.stringify(o, null, 1) + ";\n", "utf8");
  return o;
}
async function apiDash(req, res, u) {
  if (!laMayNay(req)) return traJson(res, 403, { ok: false, loi: "chỉ máy chạy bản QC mới được sửa/chốt bố cục" });
  const m = u.match(/^\/api\/dash\/(retail|factory)\/(ping|bocuc|chot)$/);
  if (!m) return traJson(res, 404, { ok: false, loi: "không có đường này" });
  const app = m[1], lenh = m[2], kho = "dash-" + app;
  if (lenh === "ping") return traJson(res, 200, { ok: true, app, chay: CHOT_DS[kho].chay, ver: docBoCucDash(DASH[app].tep).ver || 0 });
  if (lenh === "bocuc" && req.method === "POST") {
    try { const o = ghiBoCucDash(app, JSON.parse(await docThan(req, 2e6)), false); return traJson(res, 200, { ok: true, ver: o.ver, ngay: o.ngay }); }
    catch (e) { return traJson(res, 400, { ok: false, loi: e.message }); }
  }
  if (lenh === "chot" && req.method === "POST") {
    if (CHOT_DS[kho].chay) return traJson(res, 409, { ok: false, loi: "đang chốt dở — chờ xong" });
    try { const cu = docBoCucDash(DASH[app].tep); if (cu.tab) ghiBoCucDash(app, cu, true); } catch (e) { return traJson(res, 400, { ok: false, loi: e.message }); }
    CHOT_DS[kho] = { chay: true, xong: false, ok: false, buoc: 0, ten: "", loi: "" }; chayBuoc(kho, 0, DASH[app].buoc());
    return traJson(res, 200, { ok: true });
  }
  if (lenh === "chot") return traJson(res, 200, CHOT_DS[kho]);
  return traJson(res, 404, { ok: false, loi: "không có đường này" });
}
const laMayNay = (req) => /^(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$/.test(req.socket.remoteAddress || "");
const traJson = (res, code, j) => { res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(JSON.stringify(j)); };
function docThan(req, tran) {
  tran = tran || 2e6;
  return new Promise((ok, loi) => { let b = ""; req.on("data", (c) => { b += c; if (b.length > tran) req.destroy(); }); req.on("end", () => ok(b)); req.on("error", loi); });
}
function ghiBoCuc(vat, xoa) {
  if (!Array.isArray(vat)) throw new Error("thiếu danh sách vat");
  const sach = vat.map((v) => {
    if (!v || typeof v.id !== "string" || typeof v.loai !== "string") throw new Error("món thiếu id/loai");
    ["x", "z", "w", "d"].forEach((k) => { if (!isFinite(+v[k])) throw new Error("món " + v.id + " sai số " + k); });
    return v;
  });
  const j = { ver: 1, ngay: new Date().toISOString(), vat: sach, xoa: Array.isArray(xoa) ? xoa.filter((x) => typeof x === "string") : [] };
  fs.writeFileSync(TEP_BOCUC, "/* kho170-bocuc.js — BỐ CỤC ĐỒ ĐẠC dời được của trang 3D kho 170.\n" +
    " * Ghi bởi chế độ Chỉnh sửa bố cục (bản QC, xem-noi-bo.mjs). Đừng sửa tay — mở bản QC mà kéo thả. */\n" +
    "window.KHO170_BOCUC = " + JSON.stringify(j, null, 1) + ";\n", "utf8");
}
/* 08/10: SAO LƯU tệp bố cục Liên Anh trước khi ghi đè — mất bố trí 08/10 vì tệp chỉ có 1 bản (bị ghi đè trạng thái gốc).
 * Lưu bản CŨ khi: lần ghi mới làm GIẢM khu đã đặt / giảm số món / tăng món bị xoá (ngay), hoặc cách lần sao lưu trước ≥ 10 phút. Giữ 300 bản mới nhất. */
const SAO_LUU_LA = path.join(GOC, "hasaki", ".exports", "lienanh", "sao-luu-bocuc"); let saoLuuLuc = 0;
function saoLuuBoCucLA(cu, moi) {
  try {
    if (!fs.existsSync(TEP_BOCUC_LA)) return; const dat = (k) => (k || []).filter((q) => q && !q.trongKhay && !q.anSan).length;
    const giam = dat(moi.khu) < dat(cu.khu) || (moi.vat || []).length < (cu.vat || []).length || (moi.xoa || []).length > (cu.xoa || []).length;
    if (!giam && Date.now() - saoLuuLuc < 10 * 60e3) return; fs.mkdirSync(SAO_LUU_LA, { recursive: true });
    const ten = "lienanh-bocuc-v" + (cu.ver | 0) + "-" + new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + (giam ? "-truoc-khi-giam" : "") + ".js";
    fs.copyFileSync(TEP_BOCUC_LA, path.join(SAO_LUU_LA, ten)); saoLuuLuc = Date.now();
    const ds = fs.readdirSync(SAO_LUU_LA).filter((f) => f.startsWith("lienanh-bocuc-v")).map((f) => [f, fs.statSync(path.join(SAO_LUU_LA, f)).mtimeMs]).sort((a, b) => a[1] - b[1]);
    ds.slice(0, Math.max(0, ds.length - 300)).forEach((f) => fs.unlinkSync(path.join(SAO_LUU_LA, f[0])));
  } catch (e) { console.log("sao lưu bố cục Liên Anh lỗi:", e.message); }
}
function ghiBoCucLA(j, chot) {
  if (!Array.isArray(j.khu) || !Array.isArray(j.vat)) throw new Error("thiếu khu/vat");
  j.khu.forEach((k) => { if (!k || typeof k.id !== "string") throw new Error("khu thiếu id"); ["x", "z", "w", "d"].forEach((q) => { if (!isFinite(+k[q])) throw new Error("khu " + k.id + " sai số " + q); }); });
  j.vat.forEach((v) => { if (!v || typeof v.id !== "string" || typeof v.loai !== "string") throw new Error("món thiếu id/loai"); ["rx", "rz"].forEach((q) => { if (!isFinite(+v[q])) throw new Error("món " + v.id + " sai số " + q); }); });
  const cu = (() => { try { const t = fs.readFileSync(TEP_BOCUC_LA, "utf8"); return JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1)); } catch (e) { return {}; } })();
  const o = { ver: (cu.ver | 0) + 1, ngay: new Date().toISOString(), khu: j.khu, vat: j.vat, xoa: Array.isArray(j.xoa) ? j.xoa.filter((x) => typeof x === "string") : [],
    luat: j.luat && typeof j.luat === "object" ? j.luat : {}, chot: chot ? { ngay: new Date().toISOString(), ver: (cu.ver | 0) + 1 } : (cu.chot || null) };
  saoLuuBoCucLA(cu, o);
  fs.writeFileSync(TEP_BOCUC_LA, "/* lienanh-bocuc.js — BỐ CỤC kho Liên Anh (khu vực + đồ bên trong) — GITIGNORE, mang mặt bằng kho mới.\n" +
    " * Ghi bởi lienanh-3d.html qua xem-noi-bo.mjs. Đừng sửa tay — mở BO-TRI-LIEN-ANH.bat mà kéo thả. */\n" +
    "window.LIENANH_BOCUC = " + JSON.stringify(o, null, 1) + ";\n", "utf8");
  return o;
}
function chayBuoc(kho, i, buoc) {
  if (i >= buoc.length) { CHOT_DS[kho] = { ...CHOT_DS[kho], chay: false, xong: true, ok: true }; console.log("✓ Chốt bố cục 3D (" + kho + ") xong"); return; }
  const [ten, args] = buoc[i];
  CHOT_DS[kho] = { ...CHOT_DS[kho], buoc: i + 1, tong: buoc.length, ten };
  console.log("… chốt bố cục 3D (" + kho + ") · bước " + (i + 1) + "/" + buoc.length + ": " + ten);
  let duoi = "";
  const p = spawn(process.execPath, args, { cwd: DIR, env: process.env });
  const ghi = (c) => { duoi = (duoi + c).slice(-4000); };
  p.stdout.on("data", ghi); p.stderr.on("data", ghi);
  p.on("close", (code) => {
    if (code === 0) return chayBuoc(kho, i + 1, buoc);
    const dong = duoi.split(/\r?\n/).filter((l) => /SAI|✗|lỗi|Error|KHÔNG ĐẠT/i.test(l)).slice(-3).join(" · ");
    CHOT_DS[kho] = { ...CHOT_DS[kho], chay: false, xong: true, ok: false, loi: (dong || duoi.trim().split(/\r?\n/).pop() || "mã thoát " + code).slice(0, 400) };
    console.log("✗ Chốt (" + kho + ") dừng ở bước " + (i + 1) + ": " + CHOT_DS[kho].loi);
  });
}
async function api3d(req, res, u) {
  if (!laMayNay(req)) return traJson(res, 403, { ok: false, loi: "chỉ máy chạy bản QC mới được sửa/chốt" });
  const m = u.match(/^\/api\/3d\/(?:(lienanh)\/)?(ping|bocuc|chot)$/);
  if (!m) return traJson(res, 404, { ok: false, loi: "không có đường này" });
  const kho = m[1] || "kho170", lenh = m[2], K = KHO[kho];
  if (lenh === "ping") return traJson(res, 200, { ok: true, kho, chay: CHOT_DS[kho].chay });
  if (lenh === "bocuc" && req.method === "POST") {
    try { const j = JSON.parse(await docThan(req, K.than)); if (kho === "lienanh") ghiBoCucLA(j, false); else ghiBoCuc(j.vat, j.xoa); return traJson(res, 200, { ok: true }); }
    catch (e) { return traJson(res, 400, { ok: false, loi: e.message }); }
  }
  if (lenh === "chot" && req.method === "POST") {
    if (CHOT_DS[kho].chay) return traJson(res, 409, { ok: false, loi: "đang chốt dở — chờ xong" });
    let chot = {};
    if (kho === "lienanh") {
      try {
        const j = JSON.parse(await docThan(req, K.than));
        const moc = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
        const thuMuc = path.join(THU_MUC_LA, moc); fs.mkdirSync(thuMuc, { recursive: true });
        const goc = path.join(thuMuc, "LIENANH-" + moc);
        if (typeof j.svg === "string") fs.writeFileSync(goc + ".svg", j.svg, "utf8");
        if (typeof j.dxf === "string") fs.writeFileSync(goc + ".dxf", j.dxf, "utf8");
        if (typeof j.png === "string" && j.png.startsWith("data:image/png;base64,")) fs.writeFileSync(goc + ".png", Buffer.from(j.png.slice(22), "base64"));
        if (Array.isArray(j.khu) && Array.isArray(j.vat)) { const o = ghiBoCucLA(j, true); fs.writeFileSync(goc + "-bocuc.json", JSON.stringify(o, null, 1), "utf8"); }
        chot = { dxf: goc + ".dxf", thuMuc };
      } catch (e) { return traJson(res, 400, { ok: false, loi: e.message }); }
    }
    CHOT_DS[kho] = { chay: true, xong: false, ok: false, buoc: 0, ten: "", loi: "", thuMuc: chot.thuMuc || "" }; chayBuoc(kho, 0, K.buoc(chot));
    return traJson(res, 200, { ok: true });
  }
  if (lenh === "chot") return traJson(res, 200, CHOT_DS[kho]);
  return traJson(res, 404, { ok: false, loi: "không có đường này" });
}

/* 14/10: form Nghiệm thu checklist (kiemsoatkho/nghiem-thu.html) — bản nội bộ gọi lệnh nt_* qua đây:
 * chuyển tới bản GAS HEAD (code vừa clasp push, CHƯA deploy) bằng token chủ của clasp, kèm khoá quản trị
 * + sheetId của SHEET NHÁP (bản sao nội dung thật) → duyệt thử thoải mái, sheet thật không bị ghi. */
const NT_GAS_HEAD = "https://script.google.com/macros/s/AKfycbwRdzYMDJ_UPjWSZ6AdpmOiuAagwEk8x36pdH4Nl_lA/exec";
const NT_SHEET_NHAP = "1-BiLmA2uJx9XTbgVf9NcqUgxTtRCR7lFbmPNO4wXWt4";
let ntTk = { v: "", het: 0 };
async function ntTokenChu() {
  if (ntTk.v && Date.now() < ntTk.het) return ntTk.v;
  const rc = JSON.parse(fs.readFileSync(path.join(os.homedir(), ".clasprc.json"), "utf8")), t = rc.tokens ? rc.tokens.default : rc.token;
  const j = await (await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: t.client_id, client_secret: t.client_secret, refresh_token: t.refresh_token, grant_type: "refresh_token" }) })).json();
  if (!j.access_token) throw new Error("không làm tươi được token clasp");
  ntTk = { v: j.access_token, het: Date.now() + 45 * 60e3 }; return ntTk.v;
}
function ntKhoa() {
  try { const m = fs.readFileSync(path.join(DIR, ".env"), "utf8").match(/^APPSCRIPT_KEY\s*=\s*"?([^"\r\n]+)"?/m); return m ? m[1].trim() : ""; } catch (e) { return ""; }
}
async function apiNtThu(req, res) {
  if (!laMayNay(req) || req.method !== "POST") return traJson(res, 403, { status: "error", message: "chỉ máy chạy bản QC" });
  const d = JSON.parse(await docThan(req, 60e6));
  if (!/^nt_(lay|tai|ghi)$/.test(String(d.action || ""))) return traJson(res, 400, { status: "error", message: "lệnh lạ" });
  d.key = ntKhoa(); d.sheetId = NT_SHEET_NHAP;
  const r = await fetch(NT_GAS_HEAD, { method: "POST", headers: { "Content-Type": "text/plain", Authorization: "Bearer " + await ntTokenChu() }, body: JSON.stringify(d) });
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(await r.text());
}

/* 14/10 tài khoản + phân quyền: bản QC (8123) gọi lệnh tk_* qua HEAD (bản thật chưa deploy) — chỉ máy này, chỉ lệnh tk_*, KHÔNG chèn SECRET
   (tk_khoitao cần SECRET nên không đi đường này). Kho tài khoản (Script Properties) là kho THẬT dùng chung HEAD/bản thật. */
async function apiTkThu(req, res) {
  if (!laMayNay(req) || req.method !== "POST") return traJson(res, 403, { status: "error", message: "chỉ máy chạy bản QC" });
  const d = JSON.parse(await docThan(req, 1e5));
  if (!/^(tk_(khach|dangnhap|toi|dangxuat|doimk|ds|luu|xoa|luukhach)|xmKhoaMa)$/.test(String(d.action || "")))   /* 22/10 + xmKhoaMa: khoá giải mã bản dự phòng (chỉ đọc, gác bằng phiên) */ return traJson(res, 400, { status: "error", message: "lệnh lạ" });
  const r = await fetch(NT_GAS_HEAD, { method: "POST", headers: { "Content-Type": "text/plain", Authorization: "Bearer " + await ntTokenChu() }, body: JSON.stringify(d) });
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(await r.text());
}

const server = http.createServer((req, res) => {
  try {
    const u = decodeURIComponent((req.url || "/").split("?")[0]);
    if (u === "/api/tk-thu") return void apiTkThu(req, res).catch((e) => traJson(res, 500, { status: "error", message: e.message }));
    if (u === "/api/nt-thu") return void apiNtThu(req, res).catch((e) => traJson(res, 500, { status: "error", message: e.message }));
    if (u.startsWith("/api/3d/")) return void api3d(req, res, u).catch((e) => traJson(res, 500, { ok: false, loi: e.message }));
    if (u.startsWith("/api/dash/")) return void apiDash(req, res, u).catch((e) => traJson(res, 500, { ok: false, loi: e.message }));
    const m = u.match(/^\/(factory|kiemsoatkho|retail|form-5s|public)(\/.*)?$/);
    if (!m) {
      res.writeHead(302, { Location: "/factory/" });
      return res.end();
    }
    /* 13/10: "/kiemsoatkho?tab=…" (thiếu "/") thì script tương đối hasaki-xacminh.js… rơi về gốc "/" → nhận HTML → "Unexpected token '<'",
       mục Xác minh không dựng được ô đăng nhập. Chuyển sang "/kiemsoatkho/?…" như GitHub Pages. */
    if (!m[2]) { const q = (req.url || "").indexOf("?"); res.writeHead(301, { Location: "/" + m[1] + "/" + (q >= 0 ? req.url.slice(q) : "") }); return res.end(); }
    const goc = CHO_PHEP[m[1]];
    let rel = (m[2] || "/").replace(/\/+$/, "/");
    if (rel === "/" || rel === "") rel = "/index.html";
    const file = path.normalize(path.join(goc, rel));
    if (!file.startsWith(goc)) { res.writeHead(403); return res.end("403"); }   // chặn ../
    /* 13/10: ảnh nhỏ thu/*.webp chỉ có trên GitHub Pages (anh-nho-pages) — bản nội bộ chuyển sang link thật thay vì 404
       (404 làm bộ đo điện thoại báo "console đỏ" ở mọi máy dù link thật không lỗi) */
    /* 13/10 link theo tab (t4): đường dẫn sâu không có đuôi tệp (/retail/tonkho/batthuong) → trả index.html của app, như _redirects 200 trên Cloudflare */
    if (/^(kiemsoatkho|retail|factory)$/.test(m[1]) && !fs.existsSync(file) && !/\.[a-z0-9]{1,6}$/i.test(rel)) {
      res.writeHead(200, { "Content-Type": MIME[".html"], "Cache-Control": "no-store" }); return fs.createReadStream(path.join(goc, "index.html")).pipe(res); }
    /* tệp tải ĐÓN TRƯỚC theo đường dẫn sâu (trình duyệt quét trước khi <base> kịp ăn): /retail/tonkho/hasaki-logo.png → tệp ở gốc app */
    if (/^(kiemsoatkho|retail|factory)$/.test(m[1]) && !fs.existsSync(file) && /^\/[^/]+\/.+\.[a-z0-9]{1,6}$/i.test(rel)) {
      const tepGoc = path.join(goc, rel.replace(/^\/[^/]+(?:\/[^/]+)*?\/(?=[^/]+$)/, "/"));
      if (tepGoc.startsWith(goc) && fs.existsSync(tepGoc) && !fs.statSync(tepGoc).isDirectory()) { res.writeHead(200, { "Content-Type": MIME[path.extname(tepGoc).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" }); return fs.createReadStream(tepGoc).pipe(res); } }
    if (/^(kiemsoatkho|retail)$/.test(m[1]) && /^\/thu\/[0-9a-f]+\.webp$/.test(rel) && !fs.existsSync(file)) { res.writeHead(302, { Location: "https://letam0317.github.io/kiemsoatkho" + rel }); return res.end(); }
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
  console.log("  5) Bố trí kho LIÊN ANH (nội bộ)  : http://localhost:" + PORT + "/kiemsoatkho/lienanh-3d.html");
  ips.forEach((ip) => console.log("  Điện thoại (Wi-Fi)                : http://" + ip + ":" + PORT + "/form-5s/"));
});
