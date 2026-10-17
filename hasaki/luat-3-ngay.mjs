/**
 * luat-3-ngay.mjs — LUẬT 3 NGÀY KHÔNG BÁO CÁO VỆ SINH (user chốt 29/09/2026) — BẢN DIỄN TẬP
 * ===========================================================================================
 *  Vị trí có 3 NGÀY YÊU CẦU liên tiếp (ngày đã khép, không tính hôm nay) không ai báo cáo vệ sinh
 *  → ứng viên LÊN TASK 5S. Người chịu:
 *    · A8 (bàn đóng gói): packer theo CAMERA của bàn trong ngày (.packer-a8-ngay.json) — người thật
 *      đứng bàn; bàn không có dữ liệu đóng gói ngày đó → rơi xuống phụ trách.
 *    · Còn lại (A1 theo CỤM KỆ = 1 người): phụ trách bảng phân công + CHẤM CÔNG ngày đó.
 *  Chuỗi ≥4 ngày → (khi chạy thật) bình luận nhắc QL trên task như luồng A1 (nhắc 4-5, trừ 6).
 *
 *  0 lượt gọi WMS/HR: chỉ đọc Sheet (VESINH-YEUCAU/PHANCONG/CHAMCONG-NGAY qua GAS readTab) +
 *  sổ máy .packer-a8-ngay.json. BẢN NÀY CHỈ LIỆT KÊ — không tạo task, không bình luận.
 *
 *  node luat-3-ngay.mjs            → in bảng + ghi .exports/luat-3-ngay-dien-tap.md
 *  node luat-3-ngay.mjs --lam      → LẬP PHIẾU THẬT. Task «5S Luat 3 ngay» chạy mỗi sáng 09:45 (17/10/2026 —
 *                                    user: "3 ngày liên tiếp đi làm không báo cáo sao chưa tự ghi nhận"; trước đó
 *                                    script chỉ chạy tay 1 lần 29/09, chưa từng lên lịch).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { docTabGas } from "./session-rules.js";
import { tenPhieu5S } from "./ten-phieu-5s.js";
import { napNguonTruyVet } from "./truy-vet-vesinh.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const NGUONG = Number(process.env.L3_NGUONG || 3);
const log = (...a) => console.log(...a);
const khoaO = (loc) => { const m = String(loc).match(/^F0-A1-(\d{3})-(\d{2})-/); return m ? "F0-A1-" + m[1] + "-" + m[2] : String(loc); };
const homNay = new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10);
const dm = (d) => d.slice(8, 10) + "/" + d.slice(5, 7);

// Bàn ↔ camera: chép từ kiemsoatkho/hasaki-planogram.js CAMERA_BAN (nguồn duy nhất ở dashboard)
const CAMERA_BAN = (() => {
  const s = fs.readFileSync(path.join(DIR, "kiemsoatkho", "hasaki-planogram.js"), "utf8");
  const i = s.indexOf("var CAMERA_BAN = {"), j = s.indexOf("};", i);
  const o = {}; for (const m of s.slice(i, j).matchAll(/"(F0-A8-[^"]+)":\s*"(camera_\d+)/g)) o[m[1]] = m[2];
  return o;
})();
/* 17/10: packer đọc TAB PACKER-A8-NGAY (máy trạm nào chạy sync-packer cũng ghi vào đó) — sổ máy .packer-a8-ngay.json
   chỉ tươi trên máy đang chạy sync-packer; laptop nhường việc đó cho PC từ 14/10 nên sổ máy đứng ở 14/10 và luật
   rớt oan xuống "phụ trách nghỉ" (ca F0-A8-510-05 15/10: camera có Huỳnh Như 221 phiếu). Tab lỗi → rơi về sổ máy. */
const packer = await (async () => {
  const tab = await docTabGas("PACKER-A8-NGAY", () => {}).catch(() => null);
  if (tab && tab.rows && tab.rows.length) {
    const H = tab.header, c = (t) => H.findIndex((h) => String(h).trim().toLowerCase() === t);
    const iNg = c("ngày"), iCam = c("camera"), iEm = c("email"), iDau = c("phiếu đầu"), iCuoi = c("phiếu cuối"), iSo = c("số phiếu");
    const days = {};
    for (const r of tab.rows) {
      const d = String(r[iNg]).slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
      (days[d] || (days[d] = { rows: [] })).rows.push([String(r[iCam]), String(r[iEm]), String(r[iDau] || ""), String(r[iCuoi] || ""), Number(r[iSo]) || 0]);
    }
    /* GỘP với sổ máy: tab có ngày nào thì tab thắng; ngày tab không có (17/10 đo: tab chỉ còn từ 14/10) lấy sổ máy. */
    let cu = {}; try { cu = JSON.parse(fs.readFileSync(path.join(DIR, ".packer-a8-ngay.json"), "utf8")).days || {}; } catch { /* */ }
    return Object.assign({}, cu, days);
  }
  try { return JSON.parse(fs.readFileSync(path.join(DIR, ".packer-a8-ngay.json"), "utf8")).days || {}; } catch { return {}; }
})();
const danhBa = (() => { try { return JSON.parse(fs.readFileSync(path.join(DIR, ".cache-danhba.json"), "utf8")).data || []; } catch { return []; } })();
const theoEmail = new Map(danhBa.map((x) => [String(x.staff_email || "").toLowerCase(), x]));

const yc = await docTabGas("VESINH-YEUCAU", log);
if (!yc) { log("✗ không đọc được VESINH-YEUCAU"); process.exit(1); }
const nguon = await napNguonTruyVet(log);
const H = yc.header, iN = H.indexOf("Ngày"), iL = H.indexOf("Location"), iS = H.indexOf("Status ID");

// gom khoá → ngày → đã báo cáo? (status 3 Chờ duyệt / 4 Đã duyệt = đã VS, như ycBucket dashboard)
const byK = new Map();
for (const r of yc.rows) {
  const ngay = String(r[iN]).slice(0, 10); if (!ngay || ngay >= homNay) continue;   // chỉ ngày đã khép
  const k = khoaO(r[iL]); if (!byK.has(k)) byK.set(k, new Map());
  const m = byK.get(k); m.set(ngay, (m.get(ngay) || false) || [3, 4].includes(Number(r[iS])));
}
const nguoiA8 = (k, ngay) => {
  const cam = CAMERA_BAN[k]; const d = packer[ngay]; if (!cam || !d) return null;
  const rs = (d.rows || []).filter((x) => x[0] === cam).sort((a, b) => b[4] - a[4]);
  if (!rs.length) return null;
  return rs.map((x) => { const nv = theoEmail.get(String(x[1]).toLowerCase()); return { ten: nv ? nv.staff_name : x[1], code: nv ? String(nv.code) : "", n: x[4], gio: x[2] + "–" + x[3] }; });
};
const BAN_CUA_CAM = Object.fromEntries(Object.entries(CAMERA_BAN).map(([b, c]) => [c, b]));
const daBC = (k, ngay) => !!(byK.get(k) && byK.get(k).get(ngay));
/* 29/09 user: phụ trách có chấm công nhưng ĐÓNG GÓI Ở TRẠM KHÁC → xem trạm đó có báo cáo không; có thì
   KHÔNG ghi nhận cho người đó (vẫn ghi vị trí không báo cáo để báo quản lý). */
const tramKhac = (email, k, ngay) => {
  const d = packer[ngay]; if (!d || !email) return [];
  return (d.rows || []).filter((x) => String(x[1]).toLowerCase() === String(email).toLowerCase() && BAN_CUA_CAM[x[0]] && BAN_CUA_CAM[x[0]] !== k)
    .map((x) => ({ ban: BAN_CUA_CAM[x[0]], bc: daBC(BAN_CUA_CAM[x[0]], ngay), n: x[4] }));
};
const MIEN_NV_MOI = Number(process.env.L3_MIEN_NV_MOI || 3);
const laNVMoi = (code, ngay) => {
  const c = nguon && nguon.cc && nguon.cc.get(String(code)); if (!c || !c.size) return false;
  const ds = [...c.keys()].sort();   // chấm công 60 ngày: ngày đầu nằm trong 50 ngày gần đây = vào làm trong cửa sổ = NV MỚI
  const truoc = ds.filter((d) => d <= ngay).length;   // ngày làm thứ mấy tính tới ngày xét
  return ds[0] > new Date(Date.now() - 50 * 864e5).toISOString().slice(0, 10) && truoc <= MIEN_NV_MOI;
};
const diLam = (code, ngay) => { const c = nguon && nguon.cc && nguon.cc.get(String(code)); return c ? (c.has(ngay) ? "đi làm" : "nghỉ") : "?"; };

const kq = [];
for (const [k, m] of byK) {
  const days = [...m.keys()].sort().reverse();
  const chuoi = []; for (const d of days) { if (m.get(d)) break; chuoi.push(d); }
  if (chuoi.length < NGUONG) continue;
  const pt0 = nguon && nguon.pc && nguon.pc.get(k); const pt = pt0 && pt0.code && pt0.ten ? pt0 : null;   // dòng phân công rỗng tên = không có phụ trách
  const ngayTheo = chuoi.slice().reverse().map((d) => {
    const a8 = /^F0-A8-/.test(k) ? nguoiA8(k, d) : null;
    if (a8) return { d, nguon: "camera", chiu: a8[0], ai: a8.map((x) => x.ten + (x.code ? " (" + x.code + ")" : "") + " " + x.n + " phiếu " + x.gio).join("; ") };
    if (pt) {
      const dl = diLam(pt.code, d);
      if (dl === "đi làm") {
        const tk = tramKhac(pt.email, k, d);
        if (tk.some((x) => x.bc)) return { d, nguon: "phân công", chiu: null, tramBC: true,
          ai: pt.ten + " (" + pt.code + ") — đi làm, đóng ở " + tk.map((x) => x.ban.replace("F0-A8-", "") + (x.bc ? " (ĐÃ báo cáo)" : " (chưa báo cáo)")).join(", ") + " → không ghi nhận NV" };
        return { d, nguon: "phân công", chiu: pt, ai: pt.ten + " (" + pt.code + ") — đi làm" + (tk.length ? ", đóng ở " + tk.map((x) => x.ban.replace("F0-A8-", "") + " (chưa báo cáo)").join(", ") : "") };
      }
      return { d, nguon: "phân công", chiu: null, nghi: dl === "nghỉ", ai: pt.ten + " (" + pt.code + ") — " + dl };
    }
    return { d, nguon: "—", ai: "không có phụ trách" + (/^F0-A8-/.test(k) && !CAMERA_BAN[k] ? " · bàn chưa gắn camera" : /^F0-A8-/.test(k) ? " · không có dữ liệu đóng gói" : "") };
  });
  /* PHÂN LOẠI: có người thật (camera) / phụ trách đi làm trong chuỗi → LÊN TASK cho người đó;
     phụ trách nghỉ suốt chuỗi → luồng NGHỈ DÀI (nhắc QL 4-5, trừ QLTT 6); không ai → chỉ nhắc QL. */
  /* 29/09 user chốt: LÊN TASK NV khi người chịu có mặt (camera / đi làm) ≥3 ngày trong chuỗi; phụ trách
     nghỉ ≥3 ngày → luồng NGHỈ DÀI; cả chuỗi không có ai (không camera, không phân công) → GỘP 1 task
     chung bắn QLTT + Bằng; còn lại (vd đóng ở trạm khác đã báo cáo) → task KHÔNG ghi NV, báo quản lý. */
  const nNghi = ngayTheo.filter((t) => t.nghi).length;
  /* 29/09 user: NHÂN VIÊN MỚI được miễn N ngày làm việc đầu (ngày có chấm công đầu tiên trong 60 ngày
     chấm công; ca 13940234 — Huyền Trang vào 22/09, bị ghi đúng 3 ngày đầu, giải trình "chưa nắm"). */
  for (const t of ngayTheo) if (t.chiu && t.chiu.code && laNVMoi(t.chiu.code, t.d)) { t.ai += " · NV MỚI (miễn " + MIEN_NV_MOI + " ngày đầu)"; t.chiu = null; t.moi = true; }
  const coNguoi = ngayTheo.filter((t) => t.chiu);
  const loai = coNguoi.length >= NGUONG ? "task" : nNghi >= NGUONG ? "nghi_dai"
    : ngayTheo.every((t) => t.nguon === "—") ? "khong_nguoi" : "bao_ql";
  const nguoiChiu = [...new Map(coNguoi.map((t) => [t.chiu.code || t.chiu.ten, t.chiu.ten + (t.chiu.code ? " (" + t.chiu.code + ")" : "")])).values()];
  kq.push({ k, n: chuoi.length, tu: chuoi[chuoi.length - 1], den: chuoi[0], ngayTheo, loai, nguoiChiu });
}
kq.sort((a, b) => b.n - a.n || a.k.localeCompare(b.k));

const L = ["# Diễn tập luật 3 ngày không báo cáo — " + homNay, "",
  "Ngày xét: các ngày đã khép trong 7 ngày của VESINH-YEUCAU (không tính hôm nay). Chuỗi = số ngày có yêu cầu liên tiếp gần nhất không ai báo cáo.", "",
  "Phân loại: **LÊN TASK NV** " + kq.filter((x) => x.loai === "task").length + " · **NGHỈ DÀI** (nhắc QL 4-5, trừ QLTT 6) " + kq.filter((x) => x.loai === "nghi_dai").length + " · **BÁO QL, không ghi NV** " + kq.filter((x) => x.loai === "bao_ql").length + " · **KHÔNG CÓ NGƯỜI** (gộp 1 task → QLTT + Bằng) " + kq.filter((x) => x.loai === "khong_nguoi").length + ".", "",
  "**" + kq.length + " vị trí** đạt ngưỡng ≥" + NGUONG + " ngày (A1: " + kq.filter((x) => /^F0-A1/.test(x.k)).length + " · A8: " + kq.filter((x) => /^F0-A8/.test(x.k)).length + ").", ""];
for (const x of kq) {
  L.push("## " + x.k + " — " + x.n + " ngày (" + dm(x.tu) + " → " + dm(x.den) + ") · " + ({ task: "LÊN TASK: " + x.nguoiChiu.join(", "), nghi_dai: "NGHỈ DÀI", bao_ql: "BÁO QL (không ghi NV)", khong_nguoi: "KHÔNG CÓ NGƯỜI → task chung" })[x.loai] + (x.n >= NGUONG + 1 ? " · ngày 4+ → nhắc QL" : ""));
  for (const t of x.ngayTheo) L.push("- " + dm(t.d) + " · " + t.nguon + ": " + t.ai);
  L.push("");
}
fs.writeFileSync(path.join(DIR, ".exports", "luat-3-ngay-dien-tap.md"), L.join("\n"));
log(L.slice(0, 5).join("\n"));
for (const x of kq) log(x.k.padEnd(20), x.n + " ngày", dm(x.tu) + "→" + dm(x.den), "|", x.loai.padEnd(11), x.nguoiChiu.join(", "));

/* ═════════════════ PHẦN LẬP PHIẾU (29/09/2026) — mặc định DIỄN TẬP, --lam mới ghi ═════════════════
 *  Gom MỖI NGƯỜI 1 PHIẾU (canh-b11 luật ⑤① "trùng": cùng ngày + cùng phụ trách chỉ giữ phiếu sớm nhất):
 *   · task     → phiếu cho NV chịu, đóng B1 với NV đó (auto-complete-single-task.mjs), chuỗi ≥4 → nhắc QLTT.
 *   · nghi_dai → phiếu theo PHỤ TRÁCH, để B1 mở → canh-b11 ⑤(4) tự chạy chuỗi nhắc 4-5 / trừ QLTT 6.
 *   · bao_ql (có phụ trách) → phiếu KHÔNG ghi NV, tag QLTT + Bằng.
 *   · khong_nguoi (không ai phụ trách) → GỘP 1 phiếu chung, tag QLTT đóng gói + Bằng.
 *  Chống trùng: sổ .luat-3-ngay.json (vị trí|ngày đầu chuỗi) + phiếu 5S còn mở cùng vị trí trên board.
 *  Ảnh bằng chứng (IMA00 bắt buộc): bảng ngày-yêu-cầu-không-báo-cáo, dựng bằng Edge headless.
 *  Lượt gọi work: board 1 + mỗi phiếu ~6-10 (tạo + đóng B1 + bình luận). 0 lượt WMS/HR. */
const LAM = process.argv.includes("--lam");
const CHI = (process.argv.find((x) => x.startsWith("--chi=")) || "").slice(6).split(",").filter(Boolean);   // giới hạn theo mã vị trí
const MAX = Number((process.argv.find((x) => x.startsWith("--max=")) || "").slice(6) || 99);
const V = "https://wshr.hasaki.vn/api";
const F_SO = path.join(DIR, ".luat-3-ngay.json");
const so = (() => { try { return JSON.parse(fs.readFileSync(F_SO, "utf8")); } catch { return { phieu: {} }; } })();
const TYPE00 = "Bàn làm việc và khu vực phụ trách: phải được vệ sinh hằng ngày vào cuối mỗi ca.";
const BANG = "Hà Trọng Thúc Bằng", POOL_DG = ["Hồ Ngọc Tú Uyên", "Lê Thị Ngọc Huyền"];

// 1) Gom nhóm → danh sách PHIẾU dự kiến
const nhom = new Map();
for (const x of kq) {
  if (CHI.length && !CHI.includes(x.k)) continue;
  /* 17/10/2026 user chốt: phần ghi nhận NHÂN VIÊN (có người có mặt ≥3 ngày) chỉ do co-luy-tien.mjs làm — đếm 3 lần
     liên tiếp hay rải rác đều tính, cùng sổ với nút Ghi nhận ⇒ không trừ trùng. Luật 3 ngày giữ phần theo VỊ TRÍ. */
  if (x.loai === "task" && !process.argv.includes("--ca-task")) { log("  → " + x.k + ": có người có mặt — để cò luỹ tiến ghi nhận NV"); continue; }
  const ptX = nguon.pc.get(x.k); const ptOk = ptX && ptX.code && ptX.ten ? ptX : null;
  let khoa, loai = x.loai, nguoi = null;
  if (loai === "task") { const c = x.ngayTheo.find((t) => t.chiu).chiu; nguoi = c; khoa = "task|" + (c.code || c.ten); }
  else if (loai === "nghi_dai") { nguoi = ptOk; khoa = "nghi|" + (ptOk ? ptOk.code : x.k); }
  else if (ptOk) { nguoi = ptOk; loai = "bao_ql"; khoa = "baoql|" + ptOk.code; }
  else { loai = "khong_nguoi"; khoa = "chung"; }
  if (!nhom.has(khoa)) nhom.set(khoa, { loai, nguoi, vt: [] });
  nhom.get(khoa).vt.push(x);
}
const daCo = (x) => so.phieu[x.k + "|" + x.tu];

// 2) Phiếu 5S còn mở cùng vị trí (board 14 ngày, 1 lượt gọi) — có rồi thì KHÔNG lập thêm
let tokenW = null, board = [];
{
  /* LÀM THẬT chỉ ghi bằng phiên tamlc (layTokenGhiWork — phiên mượn của người khác chỉ được đọc, 16/10). */
  const { layTokenSongWork, layTokenGhiWork } = await import("./session-rules.js");
  tokenW = process.argv.includes("--lam") ? await layTokenGhiWork(DIR, log) : await layTokenSongWork(DIR, () => {});
  if (tokenW) {
    const iso = (d) => d.toISOString().slice(0, 10);
    const r = await fetch(V + "/hr/workflows/detail-workflow-task/591?from_date=" + iso(new Date(Date.now() - 14 * 864e5)) + "&to_date=" + iso(new Date(Date.now() + 864e5)) + "&search_type=board", { headers: { authorization: tokenW }, signal: AbortSignal.timeout(120000) }).catch(() => null);
    board = r && r.ok ? (((await r.json()).data || {}).rows || []) : [];
  }
}
const binCua = (t) => { const b = String(((t.data && t.data.configs) || {}).BIN00 || "").trim(); return khoaO(/^F0-/.test(b) ? b : "F0-" + b); };
/* Chống trùng = LUẬT 7 NGÀY (user 29/09): chỉ chặn khi đã có phiếu CÙNG vị trí + CÙNG LỖI (vệ sinh hằng
   ngày) với ngày vi phạm trong vòng 7 ngày (ngày 1…7 ⇒ chênh < 7). Phiếu lỗi khác (vd trưng bày che
   khuất — 13808721) hoặc cũ hơn 7 ngày KHÔNG chặn. Phiếu đã huỷ/dừng không tính. */
const { laHangMucVeSinhHangNgay } = await import("./truy-vet-vesinh.mjs");
const chenhNgay = (a, b) => Math.round((new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / 864e5);
const phieuMo = (k) => board.find((t) => {
  const c = (t.data && t.data.configs) || {};
  if ([4, 6].includes(Number(t.status)) || binCua(t) !== k || !laHangMucVeSinhHangNgay(c.TYPE00)) return false;
  return chenhNgay(String(c.DATE00 || t.created_at).slice(0, 10), homNay) < 7;
});

const tenNV = (n) => n ? n.ten + (n.code ? " (" + n.code + ")" : "") : "";
const KH = [];
for (const [khoa, g] of nhom) {
  /* Người đã có phiếu mở / đã lập cho BẤT KỲ vị trí nào trong nhóm → KHÔNG lập thêm (1 đợt = 1 phiếu,
     tránh trừ QLTT 2 lần cho cùng đợt nghỉ). Phiếu chung (không phụ trách) thì lọc từng bàn. */
  const coSan = g.loai !== "khong_nguoi" && g.vt.some((x) => daCo(x) || phieuMo(x.k));
  const moi = coSan ? [] : g.vt.filter((x) => !daCo(x) && !phieuMo(x.k));
  const bo = g.vt.filter((x) => coSan || daCo(x) || phieuMo(x.k)).map((x) => x.k.replace("F0-", "") + (daCo(x) ? " (đã lập " + daCo(x).id + ")" : phieuMo(x.k) ? " (có phiếu " + phieuMo(x.k).id + " trong 7 ngày)" : " (cùng người đã có phiếu)"));
  KH.push({ khoa, ...g, moi, bo });
}
L.push("", "# KẾ HOẠCH LẬP PHIẾU" + (LAM ? "" : " (diễn tập — chưa ghi gì)"), "", "Board 14 ngày: " + board.length + " phiếu (để chống trùng).", "");
for (const p of KH) {
  L.push("- **" + ({ task: "GHI NHẬN NV", nghi_dai: "NGHỈ DÀI", bao_ql: "BÁO QL", khong_nguoi: "PHIẾU CHUNG" })[p.loai] + "** · " + (tenNV(p.nguoi) || "không phụ trách") +
    " · lập mới: " + (p.moi.map((x) => x.k.replace("F0-", "") + " (" + x.n + " ngày)").join(", ") || "—") + (p.bo.length ? " · bỏ qua: " + p.bo.join(", ") : ""));
}
fs.writeFileSync(path.join(DIR, ".exports", "luat-3-ngay-dien-tap.md"), L.join("\n"));
log("\n── KẾ HOẠCH (" + (LAM ? "LÀM THẬT" : "diễn tập") + "): " + KH.filter((p) => p.moi.length).length + " phiếu · board " + board.length);
for (const p of KH) log("  " + p.loai.padEnd(11), (tenNV(p.nguoi) || "—").padEnd(34), "mới:", p.moi.map((x) => x.k.replace("F0-", "")).join(", ") || "—", p.bo.length ? "| bỏ: " + p.bo.join(", ") : "");
if (!LAM) process.exit(0);

// 3) LÀM THẬT
if (!tokenW) { log("✗ không có token work — dừng."); process.exit(75); }
const { EDGE_PATH } = await import("./token-store.js");
const puppeteer = (await import("puppeteer")).default;
const { docSoQLTT, chonQLTTCanBang, chonItLuot, ghiLuot } = await import("./qltt.js");
const { execFileSync } = await import("node:child_process");
const HW = { authorization: tokenW, origin: "https://work.hasaki.vn", referer: "https://work.hasaki.vn/" };
const byTen = (ten) => danhBa.find((d) => String(d.staff_name || "").trim().toLowerCase() === String(ten).trim().toLowerCase());
const tag = (ten) => { const d = byTen(ten); return d && d.user_id ? "@[" + d.staff_name + "](user_id:" + d.user_id + ")" : ten; };
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

async function anhBangChung(p) {
  const hang = p.moi.map((x) => "<tr><td class=k rowspan=" + x.ngayTheo.length + ">" + esc(x.k) + "<br><small>" + x.n + " ngày liên tiếp</small></td>" +
    x.ngayTheo.map((t, i) => (i ? "<tr>" : "") + "<td class=nw>" + dm(t.d) + "</td><td class=nw>Có yêu cầu · KHÔNG báo cáo</td><td>" + esc(t.nguon + ": " + t.ai) + "</td></tr>").join("")).join("");
  const html = "<meta charset=utf-8><style>body{font:14px Arial;margin:16px;color:#111}h2{margin:0 0 4px;font-size:18px}p{margin:0 0 10px;color:#555}table{border-collapse:collapse;width:100%}td,th{border:1px solid #bbb;padding:6px 8px;vertical-align:top}th{background:#fee2e2}.k{font-weight:bold;background:#f9fafb;white-space:nowrap}.nw{white-space:nowrap}</style>" +
    "<h2>Vị trí không báo cáo vệ sinh ≥" + NGUONG + " ngày yêu cầu liên tiếp</h2><p>Nguồn: yêu cầu vệ sinh planogram · camera đóng gói A8 · bảng phân công · chấm công — lập tự động " + dm(homNay) + "/" + homNay.slice(0, 4) + "</p>" +
    "<table><tr><th>Vị trí</th><th>Ngày</th><th>Trạng thái</th><th>Người tại vị trí</th></tr>" + hang + "</table>";
  const b = await puppeteer.launch({ headless: true, executablePath: EDGE_PATH, args: ["--no-first-run"] });
  try { const pg = await b.newPage(); await pg.setViewport({ width: 900, height: 400 }); await pg.setContent(html); return await pg.screenshot({ fullPage: true, type: "png" }); }
  finally { await b.close().catch(() => {}); }
}
async function binhLuan(id, text) {
  const fd = new FormData(); fd.set("obj_id", String(id)); fd.set("comment", text);
  await fetch(V + "/v2/task/comment", { method: "POST", body: fd, headers: HW, signal: AbortSignal.timeout(20000) }).catch(() => {});
}
const SO_QL = docSoQLTT(DIR);
let n = 0;
for (const p of KH) {
  if (!p.moi.length || n >= MAX) continue;
  n++;
  const x0 = p.moi[0];
  const bin = p.loai === "khong_nguoi" ? p.moi.length + " bàn A8 không phụ trách: " + p.moi.map((x) => x.k.replace("F0-A8-", "")).join(", ") : x0.k;
  // Mô tả: web work.hasaki BỎ QUA <br> (đo 29/09 phiếu 13958704) — mỗi dòng phải là 1 <p>.
  const moTa = ["<p><b>Lập tự động — luật " + NGUONG + " ngày không báo cáo vệ sinh</b> (" + dm(homNay) + ").</p>"]
    .concat(p.moi.map((x) => "<p>• <b>" + esc(x.k) + "</b>: " + x.n + " ngày yêu cầu liên tiếp không có báo cáo (" + dm(x.tu) + " → " + dm(x.den) + ")</p>" + x.ngayTheo.map((t) => "<p>&nbsp;&nbsp;&nbsp;&nbsp;" + dm(t.d) + " · " + esc(t.nguon + ": " + t.ai) + "</p>").join(""))).join("");
  const png = await anhBangChung(p);
  const fd = new FormData();
  fd.set("name", tenPhieu5S(bin, TYPE00)); fd.set("amount_of_work", "0"); fd.set("type", "2");
  fd.set("staff_id", process.env.STAFF_ID || "17312"); fd.set("date_start", homNay); fd.set("date_end", homNay + " 23:59:00");
  fd.set("planned_hours", "0"); fd.set("piority", "0"); fd.set("workflow_id", "591");
  fd.set("data[configs][DATE00]", homNay + " 07:00:00"); fd.set("data[configs][TYPE00]", TYPE00); fd.set("data[configs][BIN00]", bin);
  fd.set("note", moTa);
  fd.append("data[configs][IMA00][]", new Blob([png], { type: "image/png" }), "bang-chung-3-ngay.png");
  const r = await fetch(V + "/hr/projects/create-task-workflow", { method: "POST", body: fd, headers: HW, signal: AbortSignal.timeout(60000) });
  let j = {}; try { j = JSON.parse(await r.text()); } catch { /* HTML */ }
  const id = j.data && j.data.id;
  if (!id) { log("✗ tạo phiếu trượt (" + r.status + "): " + JSON.stringify(j).slice(0, 160)); continue; }
  log("✓ lập phiếu " + id + " · " + p.loai + " · " + bin);
  for (const x of p.moi) so.phieu[x.k + "|" + x.tu] = { id, at: Date.now(), loai: p.loai };
  fs.writeFileSync(F_SO, JSON.stringify(so));
  const nMax = Math.max(...p.moi.map((x) => x.n));
  if (p.loai === "task") {
    try { log("  " + execFileSync(process.execPath, [path.join(DIR, "auto-complete-single-task.mjs"), "--task=" + id, "--nv=" + (p.nguoi.code || p.nguoi.ten), "--lam"], { encoding: "utf8", timeout: 180000 }).trim().split("\n").slice(-2).join(" | ")); }
    catch (e) { log("  ⚠ đóng B1 lỗi: " + String(e.message).slice(0, 120)); }
    /* Engine giao B1.1 cho QUẢN LÝ của NV (đo lại 29/09 trên phiếu mẫu 13958704) → giao lại đúng NV. */
    try {
      await new Promise((r2) => setTimeout(r2, 1500));
      const dT = await (await fetch(V + "/hr/projects/task-input/" + id, { headers: { authorization: tokenW, accept: "application/json" } })).json();
      const b11 = ((dT.data && dT.data.subtasks) || []).find((s2) => String(s2.workflow_step_id) === "7826");
      const nvDB = danhBa.find((d2) => String(d2.code) === String(p.nguoi.code));
      if (b11 && nvDB) {
        const fdG = new FormData(); fdG.set("id", String(b11.id)); fdG.set("field", "assign_staff"); fdG.set("value", String(nvDB.staff_id));
        await fetch(V + "/hr/projects/mass-update-field-task-input", { method: "POST", body: fdG, headers: HW, signal: AbortSignal.timeout(30000) });
        log("  · B1.1 giao lại cho " + nvDB.staff_name);
      }
    } catch (e) { log("  ⚠ giao lại B1.1 lỗi: " + String(e.message).slice(0, 80)); }
    if (nMax >= NGUONG + 1) {
      const nv = byTen(p.nguoi.ten) || { staff_name: p.nguoi.ten, code: p.nguoi.code };
      const q = chonQLTTCanBang(nv, danhBa, SO_QL, DIR, false);
      await binhLuan(id, tag(q.ten) + " " + tag(BANG) + " Nhờ anh/chị nhắc " + tag(p.nguoi.ten) + ": vị trí " + p.moi.map((x) => x.k).join(", ") + " đã " + nMax + " ngày yêu cầu liên tiếp không có báo cáo vệ sinh (NV có đi làm / đóng gói tại vị trí).");
    }
  } else if (p.loai === "bao_ql" || p.loai === "khong_nguoi") {
    const ql = p.nguoi ? chonQLTTCanBang(byTen(p.nguoi.ten) || { staff_name: p.nguoi.ten, code: p.nguoi.code }, danhBa, SO_QL, DIR, false).ten : chonItLuot(POOL_DG, DIR, "tru");
    await binhLuan(id, tag(ql) + " " + tag(BANG) + " Thông báo: " + (p.loai === "khong_nguoi" ? p.moi.length + " bàn A8 chưa có người phụ trách trong bảng phân công và " : "vị trí ") +
      "không có báo cáo vệ sinh " + nMax + " ngày yêu cầu liên tiếp: " + p.moi.map((x) => x.k.replace("F0-", "")).join(", ") + ". Nhờ anh/chị chia người vệ sinh và cập nhật bảng phân công.");
    if (!p.nguoi) ghiLuot(DIR, ql, "tru");
  } // nghi_dai: để B1 mở — canh-b11 luật ⑤(4) tự nhắc ngày 4-5 và trừ QLTT ngày 6.
  log("  → https://work.hasaki.vn/tasks?task_id=" + id);
}
log("Xong: " + n + " phiếu.");
