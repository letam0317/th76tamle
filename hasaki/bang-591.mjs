/**
 * bang-591.mjs — DASHBOARD NỘI BỘ "Việc 5S · WF591" (chạy trên máy này, KHÔNG public: có mặt người + ảnh cổng bảo vệ).
 *
 *  User 02/10/2026: "xem ở g-sheet khó xem quá, cần có 1 dashboard… gom các việc liên quan đến wf 591, xác minh, treo,
 *  cò canh bãi xe và khu phân loại giấy — chứ k chờ có task rồi mới bắt; trước mắt là nv".
 *
 *  Mục: Nhân viên (mặc định) · Cò camera (bãi xe + khu phân loại giấy) · Phiếu treo WF591.
 *  Nguồn (chỉ ĐỌC, 0 lượt gọi work/wms/hr):
 *    .exports/tasks-cache.json (dây chuyền 5S làm tươi) · .exports/canh-b1-ketqua.json (gợi ý cò xác minh)
 *    <BAIXE_DIR>/<ngày>/ket-qua.json + ảnh (canh-bai-xe.mjs) · .exports/bai-xe-phieu.json (máy đã lập phiếu)
 *    .exports/bai-xe-quyet-dinh.json (quyết định trên g-sheet) · .cache-nv170.json (danh bạ)
 *  Ghi DUY NHẤT: .exports/bang-591-quyet-dinh.json (quyết định bấm trên dashboard) → bai-xe-phieu.mjs làm theo như quyết định sheet.
 *
 *  02/10 (user: "giao diện k ổn… không theo dự án audit hasaki"): giao diện CHÍNH nay là tab «Xác minh & Cò camera» trong
 *  dashboard Kiểm soát kho (kiemsoatkho/hasaki-xacminh.js) — tab đó gọi sang máy chủ này (CORS chỉ cho localhost:8123 + github.io).
 *  Trang bang-591/ cũ giữ làm dự phòng.
 *  API: /api/du-lieu · /api/quy-dinh · /api/nv?q= · /video/<id>/<i> (đoạn video lượt, có tua) · POST /api/quyet-dinh
 *  Chạy:  node bang-591.mjs            → http://127.0.0.1:8591/  (chỉ máy này)
 *         node bang-591.mjs --lan      → nghe cả mạng LAN (cần mã thiết bị: mở 1 lần http://<ip>:8591/#khoa=<BANG591_KHOA>)
 */
import fs from "node:fs"; import path from "node:path"; import http from "node:http"; import os from "node:os"; import { fileURLToPath } from "node:url";
import "dotenv/config";
import { chuanTuSau } from "./tu-ngu.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const EXP = path.join(DIR, ".exports");
const GOC = process.env.BAIXE_DIR || "C:/Users/lechitam/Videos/5S-bang-chung/bai-xe";
const GOC_BC = path.dirname(GOC);   // Videos/5S-bang-chung — bằng chứng từng phiếu (<task_id>_…)
const WEB = path.join(DIR, "bang-591");
const SO_QD = path.join(EXP, "bang-591-quyet-dinh.json");
const PORT = Number(process.env.BANG591_PORT || 8591);
const LAN = process.argv.includes("--lan");
const KHOA = process.env.BANG591_KHOA || "";
const QD = ["Lập phiếu (NV Hasaki)", "Không phải NV Hasaki", "Xe ra / không vi phạm", "Không rõ – bỏ qua"];
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);
const docJ = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };
const BUOC = ["B1. Xác minh lỗi vi phạm", "B1.1 Nhân viên xác nhận lỗi vi phạm", "B2. QLTT xác nhận và giải trình", "B2.1 Hình ảnh khắc phục vi phạm",
  "B3.1 Ghi nhận vi phạm vệ sinh kho tổng", "B3.2 Ghi nhận vi phạm quy định kho tổng", "B3.3 Ghi nhận vi phạm lỗi đóng gói", "B4. Audit kiểm tra và xác nhận",
  "B4.1 Audit kiểm tra khắc phục", "B5.Vận hành xem xét và xác nhận", "Điều hướng"];
const ngan = (b) => (b === "Điều hướng" ? "Điều hướng" : b.split(" ")[0].replace(/\.$/, "").replace("B5.Vận", "B5"));

// ---- danh bạ: mã ↔ tên ↔ email ----
let DB = null;
function danhBa() {
  if (DB && Date.now() - DB.at < 10 * 60e3) return DB;
  const ds = docJ(path.join(DIR, ".cache-nv170.json"), { data: [] }).data || [];
  const theoMa = new Map(), theoTen = new Map();
  for (const x of ds) { if (!x.code) continue; const v = { ma: String(x.code), ten: x.staff_name, email: x.staff_email, chuc: x.staff_title }; theoMa.set(v.ma, v); if (!theoTen.has(x.staff_name)) theoTen.set(x.staff_name, v); }
  DB = { at: Date.now(), theoMa, theoTen }; return DB;
}

// 05/10: lựa chọn quyết định phiếu B1 — GIỐNG HỆT LUA_CHON của sheet-b1-treo.py (canh-b1 QD-01 đọc theo chữ)
const QD_B1 = ["Gán lỗi cho NV máy nghi", "Gán cho người phụ trách kệ", "Fail - trùng lưu trình", "Fail - không xác định được NV",
  "Fail - đã khắc phục/không vi phạm", "Huỷ phiếu (tạo nhầm)", "Cắt thêm clip camera", "Giữ - chờ xác minh tay", "Khác (ghi ở cột Ghi chú)"];
// ---- gom dữ liệu (đệm 30 s) ----
let DEM = null;
function gom() {
  if (DEM && Date.now() - DEM.at < 30e3) return DEM.data;
  const db = danhBa(), now = Date.now();
  const c = docJ(path.join(EXP, "tasks-cache.json"), { header: [], rows: {} });
  const H = c.header, ix = (n) => H.indexOf(n), g = (r, n) => r[ix(n)] || "";
  const nvMa = c.nvCodes || {}, nvTen = c.nvNames || {};
  const goiY = docJ(path.join(EXP, "canh-b1-ketqua.json"), {});
  const XM = docJ(path.join(EXP, "b1-treo-cap-nhat.json"), {}), QDS = docJ(path.join(EXP, "b1-quyet-dinh.json"), {}), QDW = docJ(path.join(EXP, "b1-quyet-dinh-web.json"), {});
  const tenTheoMa = (m) => db.theoMa.get(String(m))?.ten || nvTen[m] || "";
  const t = (s) => (s ? Date.parse(String(s).replace(" ", "T") + "+07:00") : NaN);

  // 1) phiếu WF591 đang mở + bước đang treo
  const phieu = [];
  for (const r of Object.values(c.rows || {})) {
    if (g(r, "Status") !== "None") continue;
    const id = String(g(r, "Link Task")).split("=")[1];
    let dang = null;
    for (const b of BUOC) {
      const st = g(r, `${b} ▸ Status`), giao = g(r, `${b} ▸ Ngày giao`);
      if (st && !["Finished", "Canceled", "Failed"].includes(st) && giao) { if (!dang || t(giao) >= t(dang.giao)) dang = { buoc: ngan(b), tenBuoc: b, giao, nguoi: g(r, `${b} ▸ Người thực hiện`), han: g(r, `${b} ▸ Deadline`) }; }
    }
    const nvRaw = String(g(r, "B1. Xác minh lỗi vi phạm ▸ Nhân viên vi phạm")).split(",").filter(Boolean);
    const nv = nvRaw.map((x) => { const ma = nvMa[x] || x; return { ma, ten: tenTheoMa(ma) || tenTheoMa(x) }; });
    const gy = goiY[id];
    phieu.push({ id, code: g(r, "Task Code"), link: g(r, "Link Task"), ngayVP: g(r, "Ngày vi phạm:"), loi: g(r, "Lỗi vi phạm"), viTri: g(r, "Vị trí ghi nhận"),
      nguoiGhi: String(g(r, "Created By")).replace(/ - \d+$/, ""), anh: String(g(r, "Hình ảnh vi phạm")).split("\n").filter(Boolean)[0] || "",
      buoc: dang?.buoc || "?", tenBuoc: dang?.tenBuoc || "", nguoiBuoc: dang?.nguoi || "", giao: dang?.giao || "",
      treoGio: dang?.giao ? Math.round((now - t(dang.giao)) / 36e5) : null, nv,
      giaiTrinh: g(r, "B1.1 Nhân viên xác nhận lỗi vi phạm ▸ Giải trình:"), xacNhan: g(r, "B1.1 Nhân viên xác nhận lỗi vi phạm ▸ Xác nhận lỗi:"),
      goiY: gy ? { luat: gy.luat, ketLuan: gy.ketLuan, lyDo: gy.lyDo } : null,
      /* 05/10 user "kết quả đã ghi sheet → đưa lên dashboard": kết quả xác minh camera/WMS + quyết định B1 */
      xm: (() => { const v = XM[id]; if (!v) return null; const g = (k) => String(v[Object.keys(v).find((x) => x.includes(k)) || ""] || "");
        return { nghi: g("NV nghi"), goiY: g("Gợi ý"), camera: g("Camera"), daXuLy: g("Đã xử lý"), clip: g("Clip") }; })(),
      qdB1: QDW[id] || QDS[id] || null });
  }
  phieu.sort((a, b) => (b.treoGio ?? -1) - (a.treoGio ?? -1));

  // 2) cò camera (bãi xe + phân loại giấy)
  const qdSheet = docJ(path.join(EXP, "bai-xe-quyet-dinh.json"), {}), qdWeb = docJ(SO_QD, {}), da = docJ(path.join(EXP, "bai-xe-phieu.json"), {});
  const luot = [];
  const ngays = fs.existsSync(GOC) ? fs.readdirSync(GOC).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse().slice(0, 14) : [];
  for (const d of ngays) {
    const k = docJ(path.join(GOC, d, "ket-qua.json"), null);
    for (const l of k?.luot || []) {
      if (!l.id) continue;
      const w = qdWeb[l.id], s = qdSheet[l.id];
      const q = w || (s && s.qd ? { ...s, ma: (String(s.ma || "").match(/(?:^|[^\d:])(\d{5,7})(?![\d:])/) || [])[1] || s.ma, nguon: "sheet" } : null);
      // 05/10 user: "người có phân loại bóng và thùng giấy thì nghi ngờ/bắt làm gì?" — máy chưa phân biệt được phân loại đúng/đổ lẫn
      // (đo màu trắng vùng carton: lượt đúng −3,0 · vụ vi phạm thật 14010729 −2,6 ⇒ không tách được) ⇒ khu phân loại = CHỈ LƯU VẾT, không hỏi
      const chiLuu = (l.loai || "bai-xe") === "phan-loai";
      luot.push({ id: l.id, ngay: k.ngay, loai: l.loai || "bai-xe", chiLuu, camera: l.camera, vung: l.vung, tu: l.tu, den: l.den, gioNguoi: l.gioNguoi,
        video: (l.nguon || []).map((n, i) => ({ url: `/video/${l.id}/${i}`, bd: n.bd })), doanNguoi: l.doanNguoi || [], vung: l.vung, roi: l.roiPx || null,
        anh: `/anh/${d}/${l.anh}`, buocAnh: (l.buocAnh || []).map((x) => ({ ...x, anh: `/anh/${d}/${x.file}` })), khongThayNguoi: !!l.khongThayNguoi,
        chamCong: l.chamCong || [], cong: l.cong || [], goiY: l.goiY || null, soNguoi: l.soNguoi || [],
        qd: q ? { qd: q.qd, ma: q.ma || "", nguoi: q.nguoi || null, gc: q.gc || "", nguon: q.nguon || "web", luc: q.luc || "" } : null, may: da[l.id] || null });
    }
  }

  // 3) theo NHÂN VIÊN
  const NV = new Map();
  const lay = (ma, ten) => { ma = String(ma || ""); const k = ma || "ten:" + ten; if (!NV.has(k)) { const d = db.theoMa.get(ma); NV.set(k, { ma, ten: d?.ten || ten || "", chuc: d?.chuc || "", viec: [] }); } return NV.get(k); };
  for (const p of phieu) {
    for (const v of p.nv) lay(v.ma, v.ten).viec.push({ loai: "vi-pham", muc: p.buoc === "B1.1" ? 3 : 2, id: p.id, link: p.link, tieuDe: p.loi, viTri: p.viTri, buoc: p.buoc, treoGio: p.treoGio,
      chu: p.buoc === "B1.1" ? `Chờ chính NV xác nhận lỗi (B1.1) · treo ${p.treoGio ?? "?"} giờ` : `Phiếu ghi NV vi phạm · đang ở ${p.buoc}` });
    for (const nguoi of String(p.nguoiBuoc || "").split(/\s*,\s*/).filter(Boolean)) {
      if (p.nv.some((v) => v.ten === nguoi) || p.buoc === "B1.1") continue;
      const d = db.theoTen.get(nguoi);
      lay(d?.ma, nguoi).viec.push({ loai: "dang-giu", muc: (p.treoGio || 0) > 48 ? 2 : 1, id: p.id, link: p.link, tieuDe: p.loi, viTri: p.viTri, buoc: p.buoc, treoGio: p.treoGio,
        chu: `Đang giữ bước ${p.buoc} · treo ${p.treoGio ?? "?"} giờ${(p.treoGio || 0) > 48 ? " — QUÁ 48h" : ""}` });
    }
  }
  for (const l of luot) {
    if (l.qd?.qd === QD[0] && l.qd.ma) for (const ma1 of String(l.qd.ma).split(",")) lay(ma1, "").viec.push({ loai: "cam-da-gan", muc: 3, id: l.id, tieuDe: `${l.loai === "phan-loai" ? "Khu phân loại giấy" : "Bãi xe NCC"} · ${l.camera}`, gio: `${l.ngay} ${l.gioNguoi || l.den}`,
      chu: l.may?.trangThai === "xong" ? `Đã lập phiếu ${l.may.phieu} → B1.1` : "Bạn đã gán — máy đang lập phiếu" });
    else if (!l.qd && l.goiY && !l.chiLuu) lay(l.goiY, "").viec.push({ loai: "cam-nghi", muc: 1, id: l.id, tieuDe: `${l.loai === "phan-loai" ? "Khu phân loại giấy" : "Bãi xe NCC"} · ${l.camera}`, gio: `${l.ngay} ${l.gioNguoi || l.den}`,
      chu: "Máy nghi (khớp giờ vào cổng nhất) — chờ bạn xem ảnh" });
  }
  luot.sort((a, b) => (a.ngay === b.ngay ? Number(a.khongThayNguoi) - Number(b.khongThayNguoi) || String(b.den).localeCompare(String(a.den)) : b.ngay.localeCompare(a.ngay)));
  const nhanVien = [...NV.values()].map((x) => ({ ...x, diem: x.viec.reduce((s, v) => s + v.muc, 0) })).sort((a, b) => b.diem - a.diem || a.ten.localeCompare(b.ten));

  // 4) NHẮC QLTT (05/10 user: cần nhắc · đã nhắc · nhắc ai · ở đâu · kết quả sau nhắc) — đọc sổ canh-b11 + ảnh chụp B1.1 (0 lượt gọi)
  const nhac = (() => {
    const so = docJ(path.join(DIR, ".canh-b11.json"), {}), ac = docJ(path.join(EXP, "b11-anh-chup.json"), { b11: [] }), tn = docJ(path.join(DIR, ".canh-trung-nv.json"), { gop: {}, tag06: {} });
    const NHAC = so.nhac || {}, LEO = so.leo || {}, TREO_H = 48, PHAT_H = 72;
    const moi = new Map(); for (const b of ac.b11 || []) { const k = String(b.id); if (!moi.has(k) || b.b11 > moi.get(k).b11) moi.set(k, b); }
    const ten = (ma) => String(ma || "").split(",").filter(Boolean).map((m) => tenTheoMa(m.trim()) || m.trim()).join(", ");
    const ds = [];
    for (const [id, b] of moi) {
      if ([4, 6].includes(Number(b.cha)) && !NHAC[id]) continue;
      const giao = t(b.giao), xong = b.xong ? t(b.xong) : null, nhacMs = NHAC[id] || null, tuoiH = Math.round((now - giao) / 36e5);
      let tt;
      if (LEO[id]) tt = "tu-phat";
      else if (nhacMs && Number(b.st) === 2) tt = "phan-hoi";
      else if (nhacMs && Number(b.st) === 4) tt = "huy";
      else if (nhacMs) tt = "cho";
      else if (Number(b.st) === 0 && tuoiH > TREO_H) tt = "can-nhac";
      else continue;   // chưa tới hạn nhắc / đã xong trước hạn — không liệt kê
      ds.push({ id, link: "https://work.hasaki.vn/tasks?task_id=" + id, viTri: b.bin, loi: b.loi, nv: ten(b.nv) || (b.cam || []).join(", "), ql: b.ql,
        lyDo: tt === "can-nhac" ? (!b.nv ? "B1 chưa ghi nhân viên vi phạm — máy không biết nhắc ai" : !b.ql ? "B1 chưa có QLTT" : "Chờ lượt cò kế (mỗi giờ)") : "", giao: b.giao, tuoiH,
        nhac: nhacMs ? new Date(nhacMs + 7 * 36e5).toISOString().slice(0, 16).replace("T", " ") : "", tt,
        ketQua: tt === "phan-hoi" ? (b.xn || "đã đóng") + (b.gt ? " · " + b.gt : "") : tt === "tu-phat" ? "Máy ghi Lỗi cá nhân (quá 72h)" : tt === "huy" ? "Phiếu đã huỷ" : "",
        sauNhacH: tt === "phan-hoi" && xong && nhacMs ? Math.round(((xong - nhacMs) / 36e5) * 10) / 10 : null,
        conLaiH: tt === "cho" ? Math.max(0, Math.round(PHAT_H - (now - nhacMs) / 36e5)) : null });
    }
    const ph = ds.filter((x) => x.tt === "phan-hoi" && x.sauNhacH != null).map((x) => x.sauNhacH).sort((a, b) => a - b);
    const daNhac = ds.filter((x) => x.nhac).length;
    const tk = { daNhac, phanHoi: ds.filter((x) => x.tt === "phan-hoi").length, tuPhat: ds.filter((x) => x.tt === "tu-phat").length, cho: ds.filter((x) => x.tt === "cho").length,
      canNhac: ds.filter((x) => x.tt === "can-nhac").length, trungViH: ph.length ? ph[ph.length >> 1] : null, trongNgay: ph.filter((h) => h <= 8).length };
    const tag = [...Object.entries(tn.gop || {}).map(([id, v]) => ({ id, loai: "CH-05", chu: "Gộp vào phiếu " + v.vao, luc: v.luc })),
      ...Object.entries(tn.tag06 || {}).map(([id, v]) => ({ id, loai: "CH-06", chu: "Lỗi thứ " + v.thu + " trong tháng", luc: v.luc }))];
    ds.sort((a, b) => ["can-nhac", "cho", "tu-phat", "phan-hoi", "huy"].indexOf(a.tt) - ["can-nhac", "cho", "tu-phat", "phan-hoi", "huy"].indexOf(b.tt) || b.tuoiH - a.tuoiH);
    return { ds, tk, tag, anhChup: ac.luc || null };
  })();

  // 05/10 luật PL-01/PL-03: khu giấy · rác — phân công theo task 5S hằng ngày của QL (phan-cong-khu-giay.mjs) + ảnh mốc camera 12:00/18:30 (canh-bai-xe)
  /* 05/10 user: "máy phải tìm video/hình ảnh bằng chứng — chưa có thì sao ra quyết định" → gắn bằng chứng ĐÃ CÓ trên máy vào từng phiếu.
     Nguồn 1: Videos/5S-bang-chung/<task_id>_* (clip chuẩn khung vàng/đỏ + ảnh mốc; bỏ NOI-BO, KIEM-*, đoạn thô ch*_*.mp4).
     Nguồn 2: .exports/bang-chung-b1.json do tim-bang-chung-b1.mjs dựng (khung camera đúng giờ châm hàng). */
  const BC = (() => { const m = {};
    try { for (const f of fs.readdirSync(GOC_BC)) { const k = /^(\d{8})_(.+)$/.exec(f); if (!k || /NOI-BO|KIEM-|cau-hinh|_ch\d+_|^\d{8}_\d|\.json$/i.test(f)) continue;
      const o = (m[k[1]] ||= { clip: [], anh: [] });
      if (/\.(webm|mp4)$/i.test(f) && /CLIP/i.test(f)) o.clip.push(f); else if (/\.jpg$/i.test(f) && /ANH|MOC/i.test(f)) o.anh.push(f); } } catch { /* chưa có thư mục */ }
    const tu = docJ(path.join(EXP, "bang-chung-b1.json"), {});
    /* 05/10 user: "k ghi chú lên khung hình của clip thì cũng nên chạy dạng phụ đề bên dưới clip … bạn xác minh bằng cách nhận diện gì"
       ⇒ mỗi clip máy dựng kèm clipInfo {batDau, suKien:[{t, chu}], cach} — dashboard chạy phụ đề theo giờ camera */
    const lui = (t, giay) => new Date(Date.parse(String(t).replace(" ", "T") + "+07:00") - giay * 1000 + 7 * 36e5).toISOString().slice(0, 19);
    for (const [id, v] of Object.entries(tu)) { const o = (m[id] ||= { clip: [], anh: [] });
      if (v.loai === "chup") { if ((v.anh || []).length) o.chup = { anh: v.anh.map((a) => "may/" + a), clip: v.clip ? "may/" + v.clip : "", chu: v.chu || "", lui: v.anhLui ? "may/" + v.anhLui : "", luiMoc: v.luiMoc || null, luiCo: v.luiCo || null, luc: v.luc,
          clipInfo: { batDau: lui(v.luc, 80), suKien: [{ t: lui(v.luc, 0), chu: "Người kiểm chụp ảnh ghi nhận vi phạm ở đây" }] + (v.kenh || "") + "). Chỉ để biết góc nhìn — người trong clip là người kiểm, CHƯA phải người vi phạm." } };
        if (v.truy && v.truy.clip) { o.clipMay = "may/" + v.truy.clip; o.truy = v.truy; o.clipInfo = { batDau: lui(String(v.truy.tu).replace("T", " "), 20), suKien: [{ t: String(v.truy.tu).replace("T", " "), chu: "Mốc cuối CHƯA có đồ vật (bạn chọn trên dải)" }, { t: String(v.truy.den).replace("T", " "), chu: "Mốc đầu ĐÃ có đồ vật" }] }; o.chu = `Clip lúc đồ vật xuất hiện ${String(v.truy.tu).slice(5, 16).replace("T", " ")}–${String(v.truy.den).slice(11, 16)} (${v.truy.kenh})`; }   // 05/10: thu hẹp xong = BẰNG CHỨNG ai tác động
        continue; }   // lúc chụp ảnh: chỉ góc nhìn, KHÔNG phải bằng chứng người làm
      (v.anh || []).forEach((a) => o.anh.push("may/" + a)); if (v.chu) o.chu = v.chu; if (v.kenh) o.kenh = v.kenh; if (v.clip) o.clipMay = "may/" + v.clip;
      if (v.clip && v.luc) o.clipInfo = { batDau: lui(v.luc, 20), suKien: [{ t: lui(v.luc, 0), chu: "Hệ thống kho ghi nhận: " + String(v.chu || "").replace(/^Khung camera đúng giờ hệ thống kho: /, "") }] }; }
    for (const o of Object.values(m)) { o.clip.sort((a, b) => (/CHUAN|NOI/.test(b) - /CHUAN|NOI/.test(a)) || b.localeCompare(a)); o.clip = o.clip.slice(0, 1); o.anh = o.anh.slice(0, 4); }
    return m; })();
  for (const p of phieu) { const b = BC[p.id]; const enc = (f) => "/bc/" + f.split("/").map(encodeURIComponent).join("/");
    if (b && b.chup) p.bcChup = { clipInfo: b.chup.clipInfo, anh: b.chup.anh.map(enc), clip: b.chup.clip ? enc(b.chup.clip) : "", chu: b.chup.chu, lui: b.chup.lui ? enc(b.chup.lui) : "", luiMoc: b.chup.luiMoc, luiCo: b.chup.luiCo, luc: b.chup.luc };
    if (b && (b.clip.length || b.anh.length || b.clipMay)) p.bc = { clip: (b.clip.length ? b.clip : b.clipMay ? [b.clipMay] : []).map((f) => "/bc/" + f.split("/").map(encodeURIComponent).join("/")), clipTho: !b.clip.length && !!b.clipMay, truy: b.truy || null, clipInfo: !b.clip.length ? b.clipInfo || null : null, anh: b.anh.map((f) => "/bc/" + f.split("/").map(encodeURIComponent).join("/")), chu: b.chu || "", kenh: b.kenh || "" }; }

  const phanCong = (() => {
    const pc = docJ(path.join(EXP, "phan-cong-khu-giay.json"), { ngay: {} }), ra = [];
    const ccMap = {};   // chấm công theo ngày: lấy từ ket-qua.json cò camera (đã gọi HR sẵn, không gọi thêm)
    for (const d of ngays) for (const l of docJ(path.join(GOC, d, "ket-qua.json"), {}).luot || []) for (const c of l.chamCong || []) (ccMap[d] ||= {})[c.code] = c;
    const tatCaNgay = [...new Set([...Object.keys(pc.ngay || {}), ...ngays])].sort().reverse().slice(0, 14);
    for (const d of tatCaNgay) {
      const kq = docJ(path.join(GOC, d, "ket-qua.json"), {});
      const moc = (kq.mocChup || []).map((m) => ({ ...m, url: `/anh/${d}/${m.anh}` }));
      const tasks = (pc.ngay?.[d]?.tasks || []).map((tk) => ({ ...tk, khu: (tk.khu || []).map((k) => ({ ...k, nguoi: (k.nguoi || []).map((x) => {
        const xong = x.xong ? t(x.xong) : null, han = t(d + " 23:59:59");
        return { code: x.code, ten: x.ten || tenTheoMa(x.code), xong: x.xong, anh: x.anh || 0, khongKhop: !!x.khongKhop,
          tt: x.xong ? (xong > han ? "tre" : "xong") : (Date.now() > han ? "khong" : "cho") }; }) })) }));
      ra.push({ ngay: d, tasks, moc, coTask: tasks.length > 0 });
    }
    return { ds: ra, capNhat: pc.capNhat || null, viTri: pc.viTri || {} };
  })();

  const tuoi = (f) => { try { return fs.statSync(f).mtimeMs; } catch { return 0; } };
  const data = { capNhat: new Date().toISOString(), nguon: { tasks: c.updatedAt || null, camera: ngays[0] || null, goiY: tuoi(path.join(EXP, "canh-b1-ketqua.json")) || null },
    QD, QD_B1, phieu, luot, nhanVien, nhac, phanCong };
  DEM = { at: Date.now(), data }; return data;
}

function timLuot(id) {
  const m = /^(\d{4}-\d{2}-\d{2})_/.exec(String(id || "")); if (!m) return null;
  return (docJ(path.join(GOC, m[1], "ket-qua.json"), {}).luot || []).find((l) => l.id === id) || null;
}
let QDC = null;
async function quyDinh() {
  if (QDC && Date.now() - QDC.at < 3600e3) return QDC.ds;
  try {
    const t = await (await fetch("https://docs.google.com/spreadsheets/d/1FWffWi75aATbokfqIcqjByEPzkJLQBngTXp5aPOIbLM/gviz/tq?tqx=out:csv&sheet=QUY-DINH")).text();
    const hang = []; let cur = [], o = "", nh = false;
    for (let i = 0; i < t.length; i++) { const c = t[i];
      if (nh) { if (c === '"' && t[i + 1] === '"') { o += '"'; i++; } else if (c === '"') nh = false; else o += c; }
      else if (c === '"') nh = true; else if (c === ",") { cur.push(o); o = ""; } else if (c === "\n") { cur.push(o); hang.push(cur); cur = []; o = ""; } else if (c !== "\r") o += c; }
    if (o || cur.length) { cur.push(o); hang.push(cur); }
    const ds = hang.filter((h) => /^\d+$/.test(String(h[0]).trim()) && h[1]).map((h) => ({ muc: Number(h[0]), cau: String(h[1]).trim(), tru: String(h[3] || "").trim(), xuLy: String(h[5] || "").trim() }));
    QDC = { at: Date.now(), ds }; return ds;
  } catch { return QDC?.ds || []; }
}

// ---- máy chủ ----
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json" };
const guiJ = (s, code, o) => { s.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); s.end(JSON.stringify(o)); };
const hopLe = (q) => !LAN || !KHOA || q.socket.remoteAddress === "127.0.0.1" || q.socket.remoteAddress === "::1" || q.headers["x-khoa"] === KHOA ||
  new URL(q.url, "http://x").searchParams.get("khoa") === KHOA;
const NGUON_OK = /^(https:\/\/letam0317\.github\.io|http:\/\/(localhost|127\.0\.0\.1):\d+)$/;
const sv = http.createServer(async (q, s) => {
  const goc = q.headers.origin || "";
  /* 05/10 user: "trang chỉ mình t coi được" — chỉ nhận trang của chính dự án. BỎ origin "null"/file:// (trang web lạ dựng được
     origin "null" bằng iframe sandbox ⇒ đọc lén được dữ liệu); bộ đo --file nay đọc qua localhost:8123.
     Chặn luôn yêu cầu từ trang khác gửi tới (kể cả loại không cần CORS như <img>, form POST) — trước đây POST lạ vẫn được xử lý. */
  let gocRef = ""; try { gocRef = q.headers.referer ? new URL(q.headers.referer).origin : ""; } catch { /* */ }   // <img>/<video> không gửi Origin, chỉ gửi Referer
  const lai = (goc && !NGUON_OK.test(goc)) || (q.headers["sec-fetch-site"] === "cross-site" && !NGUON_OK.test(goc || gocRef));
  if (lai && q.url !== "/" ) { s.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" }); return s.end("chỉ trang Audit Hasaki của chủ máy được đọc"); }
  if (NGUON_OK.test(goc)) {
 s.setHeader("Access-Control-Allow-Origin", goc); s.setHeader("Vary", "Origin"); s.setHeader("Access-Control-Allow-Headers", "content-type,x-khoa"); s.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS"); }
  if (q.headers["access-control-request-private-network"]) s.setHeader("Access-Control-Allow-Private-Network", "true");
  if (q.method === "OPTIONS") { s.writeHead(204); return s.end(); }
  try {
    const u = new URL(q.url, "http://x"), p = decodeURIComponent(u.pathname);
    if (p.startsWith("/api/") || p.startsWith("/anh/") || p.startsWith("/video/") || p.startsWith("/bc/") || p === "/thu") { if (!hopLe(q)) return guiJ(s, 403, { loi: "thiết bị chưa được cấp quyền" }); }
    if (p === "/api/ping") return guiJ(s, 200, { ok: 1 });   // trang dashboard dò máy chủ để hiện/giấu tab Xác minh
    if (p === "/api/du-lieu") return guiJ(s, 200, chuanTuSau(gom()));   // TU-01: mọi chữ ra dashboard qua bộ lọc từ ngữ
    if (p === "/api/quy-dinh") return guiJ(s, 200, await quyDinh());
    if (p === "/api/nv") {
      const k = String(u.searchParams.get("q") || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const bo = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const ds = k.length < 2 ? [] : [...danhBa().theoMa.values()].filter((x) => x.ma.includes(k) || bo(x.ten).includes(k) || bo(x.email).startsWith(k)).slice(0, 20);
      return guiJ(s, 200, ds.map((x) => ({ ma: x.ma, ten: x.ten, chuc: String(x.chuc || "").split("/").slice(-1)[0].trim() })));
    }
    if (p.startsWith("/m/")) {   // mô hình COCO-SSD tải sẵn (.cache-model) cho trình phát clip dò "người" (không nhận mặt)
      const mf = path.join(DIR, ".cache-model", "ssd_mobilenet_v2", path.basename(p));
      if (!fs.existsSync(mf)) { s.writeHead(404); return s.end(); }
      s.writeHead(200, { "Content-Type": mf.endsWith(".json") ? "application/json" : "application/octet-stream", "Cache-Control": "max-age=86400" }); return fs.createReadStream(mf).pipe(s);
    }
    if (p.startsWith("/video/")) {   // /video/<id lượt>/<i> — đoạn video đã tải từ đầu ghi (giữ 14 ngày)
      const [, , id, i] = p.split("/"); const l = timLuot(id); const f = l && (l.nguon || [])[Number(i)]?.file;
      if (!f || !fs.existsSync(f)) { s.writeHead(404); return s.end(); }
      const st = fs.statSync(f), rg = /bytes=(\d+)-(\d*)/.exec(q.headers.range || "");
      if (rg) { const a = +rg[1], z = rg[2] ? +rg[2] : st.size - 1; s.writeHead(206, { "Content-Type": "video/mp4", "Accept-Ranges": "bytes", "Content-Range": `bytes ${a}-${z}/${st.size}`, "Content-Length": z - a + 1 }); return fs.createReadStream(f, { start: a, end: z }).pipe(s); }
      s.writeHead(200, { "Content-Type": "video/mp4", "Content-Length": st.size, "Accept-Ranges": "bytes" }); return fs.createReadStream(f).pipe(s);
    }
    if (p === "/api/phan-cong-task" && q.method === "POST") {   // dán link task phân công 5S → đọc ngay (1 lượt gọi wshr)
      let b = ""; for await (const ch of q) { b += ch; if (b.length > 2e3) return guiJ(s, 413, { loi: "quá lớn" }); }
      const id = (String(JSON.parse(b || "{}").link || "").match(/(\d{7,9})/) || [])[1];
      if (!id) return guiJ(s, 400, { loi: "Không thấy số task trong link" });
      const { execFile } = await import("node:child_process");
      const out = await new Promise((r) => execFile(process.execPath, [path.join(DIR, "phan-cong-khu-giay.mjs"), "--task=" + id], { cwd: DIR, timeout: 90e3 }, (e, so, se) => r(String(so || "") + String(se || ""))));
      DEM = null;
      const loi = /✗ .*(không phải|không đọc được)/.exec(out) || /Không có token/.exec(out);
      return guiJ(s, loi ? 400 : 200, loi ? { loi: out.split(String.fromCharCode(10)).find((x) => /✗/.test(x))?.slice(9) || "Không đọc được task" } : { ok: true, id });
    }
    if (p === "/api/quyet-dinh-b1" && q.method === "POST") {   // 05/10: quyết định phiếu B1 từ web → canh-b1 QD-01 (gộp với sheet, web thắng)
      let b = ""; for await (const ch of q) { b += ch; if (b.length > 2e4) return guiJ(s, 413, { loi: "quá lớn" }); }
      const o = JSON.parse(b || "{}");
      if (!/^\d{6,10}$/.test(String(o.id || ""))) return guiJ(s, 400, { loi: "thiếu mã phiếu" });
      if (o.qd && !QD_B1.includes(o.qd)) return guiJ(s, 400, { loi: "quyết định lạ" });
      const F = path.join(EXP, "b1-quyet-dinh-web.json"), so = docJ(F, {});
      if (!o.qd) delete so[o.id]; else so[o.id] = { qd: o.qd, gc: String(o.gc || "").slice(0, 300), luc: new Date().toISOString(), nguon: "web" };
      fs.writeFileSync(F, JSON.stringify(so, null, 1)); DEM = null;
      return guiJ(s, 200, { ok: true, qdB1: so[o.id] || null });
    }
    if (p === "/api/quyet-dinh" && q.method === "POST") {
      let b = ""; for await (const ch of q) { b += ch; if (b.length > 1e5) return guiJ(s, 413, { loi: "quá lớn" }); }
      const o = JSON.parse(b || "{}");
      if (!o.id || !/^[\w-]+$/.test(o.id)) return guiJ(s, 400, { loi: "thiếu mã lượt" });
      if (o.qd && !QD.includes(o.qd)) return guiJ(s, 400, { loi: "quyết định lạ" });
      const db = danhBa();
      let nguoi = Array.isArray(o.nguoi) ? o.nguoi.slice(0, 6).map((x, i) => ({ so: Number(x.so) || i + 1, ma: String(x.ma || "").trim(), khong: !!x.khong,
        muc: Number(x.muc) || null, cau: String(x.cau || "").slice(0, 400), viTri: String(x.viTri || "").slice(0, 120) })) : null;
      let ma = String(o.ma || "").trim();
      if (o.qd === QD[0]) {
        if (!nguoi) nguoi = [{ so: 1, ma, khong: false }];
        const vp = nguoi.filter((x) => !x.khong);
        if (!vp.length) return guiJ(s, 400, { loi: "chưa có người nào được ghi là vi phạm" });
        for (const x of vp) {
          if (!/^\d{4,7}$/.test(x.ma)) return guiJ(s, 400, { loi: `Người nghi ${x.so}: chưa chọn nhân viên` });
          if (!db.theoMa.has(x.ma)) return guiJ(s, 400, { loi: `Người nghi ${x.so}: không có mã NV ${x.ma} trong danh bạ` });
          x.ten = db.theoMa.get(x.ma).ten;
        }
        ma = vp.map((x) => x.ma).join(",");
      }
      const so = docJ(SO_QD, {});
      if (!o.qd) delete so[o.id]; else so[o.id] = { qd: o.qd, ma, nguoi: o.qd === QD[0] ? nguoi : null, gc: String(o.gc || "").slice(0, 300), luc: new Date().toISOString(), nguon: "web" };
      fs.writeFileSync(SO_QD, JSON.stringify(so, null, 1)); DEM = null;
      log("quyết định", o.id, o.qd || "(bỏ)", ma);
      return guiJ(s, 200, { ok: true, ten: ma ? ma.split(",").map((m) => danhBa().theoMa.get(m)?.ten).join(", ") : null });
    }
    if (p === "/api/thu-hep" && q.method === "POST") {   // 05/10: user bấm khung sớm nhất đã thấy đồ vật → máy chụp 9 khung dày hơn trong khoảng đó (≤3 phút thì cắt clip)
      let b = ""; for await (const ch of q) { b += ch; if (b.length > 2e3) return guiJ(s, 413, { loi: "quá lớn" }); }
      const o = JSON.parse(b || "{}"), ok = (x) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(String(x || ""));
      if (!/^\d{7,9}$/.test(String(o.id || "")) || !ok(o.tu) || !ok(o.den) || o.tu >= o.den) return guiJ(s, 400, { loi: "khoảng thời gian không hợp lệ" });
      const { spawn } = await import("node:child_process");
      spawn(process.execPath, [path.join(DIR, "dai-lui-thoi-gian-b1.mjs"), "--id=" + o.id, "--tu=" + o.tu, "--den=" + o.den], { cwd: DIR, detached: true, stdio: "ignore", windowsHide: true }).unref();
      DEM = null; return guiJ(s, 200, { ok: true, cat: (Date.parse(o.den) - Date.parse(o.tu)) <= 180e3 });
    }
    if (p === "/thu") {   // 05/10 user "dashboard quá lag khi cuộn": ẢNH NHỎ cho bảng (rộng 320) — đo trước sửa: 168 ảnh gốc vài MB + 126 video → 4 long task 340 ms
      const nguon = String(u.searchParams.get("u") || ""), cache = path.join(EXP, ".thu-cache"); fs.mkdirSync(cache, { recursive: true });
      const khoa = Buffer.from(nguon).toString("base64url").slice(-120), f = path.join(cache, khoa + ".jpg");
      if (!fs.existsSync(f)) {
        let buf = null;
        if (/^https:\/\/hr-media\.hasaki\.vn\//.test(nguon)) { try { const r = await fetch(nguon, { signal: AbortSignal.timeout(20000) }); if (r.ok) buf = Buffer.from(await r.arrayBuffer()); } catch { /* */ } }
        else if (nguon.startsWith("/bc/")) { const g = path.resolve(GOC_BC, decodeURIComponent(nguon.slice(4))); if (g.startsWith(path.resolve(GOC_BC)) && fs.existsSync(g) && /\.jpg$/i.test(g)) buf = fs.readFileSync(g); }
        else if (nguon.startsWith("/anh/")) { const g = path.resolve(GOC, decodeURIComponent(nguon.slice(5))); if (g.startsWith(path.resolve(GOC)) && fs.existsSync(g)) buf = fs.readFileSync(g); }
        if (!buf) { s.writeHead(404); return s.end(); }
        try { const sharp = (await import("sharp")).default; await sharp(buf).rotate().resize(320, 200, { fit: "cover" }).jpeg({ quality: 72 }).toFile(f); } catch { s.writeHead(415); return s.end(); }
      }
      s.writeHead(200, { "Content-Type": "image/jpeg", "Cache-Control": "max-age=86400" }); return fs.createReadStream(f).pipe(s);
    }
    if (p.startsWith("/bc/")) {   // bằng chứng phiếu trong Videos/5S-bang-chung (clip có tua · ảnh)
      const f = path.resolve(GOC_BC, p.slice(4)); if (!f.startsWith(path.resolve(GOC_BC)) || !fs.existsSync(f) || !/\.(webm|mp4|jpg)$/i.test(f)) { s.writeHead(404); return s.end(); }
      const st = fs.statSync(f), ct = /\.jpg$/i.test(f) ? "image/jpeg" : /\.webm$/i.test(f) ? "video/webm" : "video/mp4", rg = /bytes=(\d+)-(\d*)/.exec(q.headers.range || "");
      if (rg) { const a = +rg[1], z = rg[2] ? +rg[2] : st.size - 1; s.writeHead(206, { "Content-Type": ct, "Accept-Ranges": "bytes", "Content-Range": `bytes ${a}-${z}/${st.size}`, "Content-Length": z - a + 1 }); return fs.createReadStream(f, { start: a, end: z }).pipe(s); }
      s.writeHead(200, { "Content-Type": ct, "Content-Length": st.size, "Accept-Ranges": "bytes", "Cache-Control": "max-age=300" }); return fs.createReadStream(f).pipe(s);
    }
    if (p.startsWith("/anh/")) {
      const f = path.resolve(GOC, p.slice(5)); if (!f.startsWith(path.resolve(GOC)) || !fs.existsSync(f) || !/\.jpg$/.test(f)) { s.writeHead(404); return s.end(); }
      s.writeHead(200, { "Content-Type": "image/jpeg", "Cache-Control": "max-age=300" }); return fs.createReadStream(f).pipe(s);
    }
    // 02/10: giao diện chính = tab trong dashboard Kiểm soát kho (đúng khuôn Audit Hasaki); trang cũ còn ở /cu/
    if (p === "/" || p === "/index.html") { s.writeHead(302, { Location: process.env.BANG591_TAB_URL || "http://localhost:8123/kiemsoatkho/?tab=xacminh" }); return s.end(); }
    const f = path.resolve(WEB, "." + (p === "/cu/" ? "/index.html" : p));
    if (!f.startsWith(path.resolve(WEB)) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end("không có"); }
    s.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-cache" }); fs.createReadStream(f).pipe(s);
  } catch (e) { log("lỗi", e.message); guiJ(s, 500, { loi: e.message }); }
});
sv.listen(PORT, LAN ? "0.0.0.0" : "127.0.0.1", () => {
  log(`Bảng WF591: http://127.0.0.1:${PORT}/`);
  if (LAN) for (const a of Object.values(os.networkInterfaces()).flat()) if (a.family === "IPv4" && !a.internal) log(`  LAN: http://${a.address}:${PORT}/${KHOA ? "#khoa=" + KHOA : ""}`);
});
