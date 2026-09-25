/**
 * ============================================================================
 *  truy-vet-vesinh.mjs — KHỐI "TRUY VẾT VỆ SINH" cho task 5S (user duyệt 25/09/2026)
 * ============================================================================
 *  Áp cho lỗi "Bàn làm việc và khu vực phụ trách: phải được vệ sinh hằng ngày
 *  vào cuối mỗi ca" — MỌI VỊ TRÍ. Ghép vào Mô tả task (dưới dòng Mã sản phẩm):
 *
 *      Phụ trách kệ (bảng phân công): <Tên> (<mã>)
 *      Ngày <d>/<m>: CÓ/KHÔNG đi làm · ĐÃ/KHÔNG báo cáo vệ sinh vị trí này.
 *      Báo cáo 2 ngày gần nhất:
 *      · 21/09 13:17 — Trần Ngọc Hương Trà → Yêu cầu 29082437   (hyperlink)
 *      Đánh giá AI: 21/09 ĐẠT (100/100) · …
 *
 *  NGÀY XÉT (user chốt): luôn = ngày ghi nhận − 1; NGOẠI LỆ: nếu giờ ghi nhận
 *  SAU giờ chấm công RA của phụ trách trong ngày ghi nhận → xét chính ngày ghi nhận.
 *
 *  Nguồn (4 tab GAS readTab, nạp 1 lần/lượt, CHỈ khi có task thuộc hạng mục):
 *    VESINH-PHANCONG (chủ vị trí) · VESINH-LICHSU (60 ngày) ·
 *    VESINH-CHAMCONG-NGAY (vào-ra 60 ngày) · VESINH-AI (kết luận theo request).
 *
 *  Người dùng: push-5s-to-workflow.js (phiếu MỚI — kèm suy NV vi phạm khi
 *  "đi làm mà KHÔNG báo cáo") + canh-b11.mjs luật ④ (bổ sung task CŨ còn mở).
 * ============================================================================
 */
import { docTabGas } from "./session-rules.js";

const PG_URL = (id) => "https://planogram.hasaki.vn/asset-management/request-of-declaration/details/" + id;

/* Hạng mục áp dụng — so KHÔNG DẤU để miễn nhiễm khác biệt gõ dấu giữa form/planogram. */
const boDau = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/\s+/g, " ").trim();
export function laHangMucVeSinhHangNgay(type00) {
  const t = boDau(type00);
  return t.includes("ve sinh") && t.includes("hang ngay") && t.includes("cuoi moi ca");
}

/* Khoá vị trí: A1 gom mức KỆ (1 kệ nhiều mã mâm-bin), nơi khác giữ mã đầy đủ — trùng khoaO dashboard. */
const khoaO = (loc) => { const m = String(loc).match(/^F0-A1-(\d{3})-(\d{2})-/); return m ? "F0-A1-" + m[1] + "-" + m[2] : String(loc).trim(); };

/* ---- nạp 4 tab nguồn (gọi 1 lần mỗi lượt chạy) ---- */
export async function napNguonTruyVet(log = () => {}) {
  const [pc, ls, ccn, ai] = await Promise.all([
    docTabGas("VESINH-PHANCONG", log), docTabGas("VESINH-LICHSU", log),
    docTabGas("VESINH-CHAMCONG-NGAY", log), docTabGas("VESINH-AI", log),
  ]);
  const n = {
    pc: new Map(),    // khoá ô → {ten, code, email}
    ls: [],           // {ngay, gio, khoa, email, code, ten, req}
    cc: new Map(),    // code → Map(ngày → {vao, ra})
    ai: new Map(),    // request id → {kq, diem}
    du: !!(pc && ls), // đủ 2 nguồn cốt lõi mới dựng khối
  };
  for (const r of (pc && pc.rows) || []) n.pc.set(String(r[0]).trim(), { email: r[1], code: String(r[2] || "").replace(/\.0$/, ""), ten: r[3] });
  for (const r of (ls && ls.rows) || []) n.ls.push({ ngay: r[0], gio: r[1], khoa: khoaO(r[2]), email: String(r[3] || "").toLowerCase(), code: String(r[4] || ""), ten: r[5] || "", req: String(r[6] || "") });
  for (const r of (ccn && ccn.rows) || []) {
    const code = String(r[0] || "").replace(/\.0$/, ""), d = new Map();
    let m; const re = /(\d{4}-\d{2}-\d{2})\s+(\S+?)-(\S+)/g, txt = String(r[4] || "");
    while ((m = re.exec(txt)) !== null) d.set(m[1], { vao: m[2], ra: m[3] });
    if (code) n.cc.set(code, d);
  }
  for (const r of (ai && ai.rows) || []) n.ai.set(String(r[0] || ""), { kq: String(r[5] || ""), diem: r[6] });
  return n;
}

const congNgay = (s, d) => { const t = new Date(s + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + d); return t.toISOString().slice(0, 10); };
const dmy = (iso) => iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) : "?";
const escH = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Dựng khối truy vết. thoiDiem = "YYYY-MM-DD HH:MM[:SS]" (ưu tiên giờ chụp ảnh DATE00).
 * Trả { html, text, suyNV } — suyNV = mã NV phụ trách CHỈ KHI "đi làm mà KHÔNG báo cáo"
 * (đúng luật buộc tội đã chốt 17/09; các ca khác suyNV = "").
 */
export function truyVet(n, viTri, thoiDiem) {
  if (!n || !n.du) return null;
  const khoa = khoaO(viTri);
  const ngayGN = String(thoiDiem || "").slice(0, 10), gioGN = String(thoiDiem || "").slice(11, 16);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ngayGN)) return null;
  const pt = n.pc.get(khoa) || null;

  /* ngày xét: −1; ngoại lệ ghi nhận SAU giờ RA của phụ trách trong ngày ghi nhận */
  let ngayXet = congNgay(ngayGN, -1);
  const ccGN = pt ? (n.cc.get(pt.code) || new Map()).get(ngayGN) : null;
  if (ccGN && ccGN.ra && !/[?]/.test(ccGN.ra) && gioGN > ccGN.ra) ngayXet = ngayGN;

  /* đi làm + báo cáo của NGÀY XÉT */
  const bcKe = n.ls.filter((x) => x.khoa === khoa);
  const bcNgayXet = bcKe.filter((x) => x.ngay === ngayXet);
  const bcPtNgayXet = pt ? bcNgayXet.filter((x) => x.code === pt.code || x.email === String(pt.email || "").toLowerCase()) : [];
  const ccXet = pt ? (n.cc.get(pt.code) || new Map()).get(ngayXet) : null;
  let diLam, coDiLam = null;
  if (ccXet) { diLam = "CÓ đi làm (vào " + ccXet.vao + " · ra " + ccXet.ra + ")"; coDiLam = true; }
  else if (bcPtNgayXet.length) { diLam = "CÓ đi làm"; coDiLam = true; }
  else if (pt && n.cc.has(pt.code)) { diLam = "KHÔNG đi làm"; coDiLam = false; }   // có hồ sơ chấm công mà ngày đó trống
  else { diLam = "không rõ đi làm (thiếu chấm công)"; coDiLam = null; }
  const daBC = bcPtNgayXet.length > 0;
  const bcKhac = !daBC && bcNgayXet.length ? bcNgayXet[0] : null;   // người KHÁC báo cáo thay
  /* PHÂN LOẠI (user chốt 25/09): khối này chỉ dựng khi PHIẾU VI PHẠM tồn tại (đã có ảnh bẩn),
     nên "đã báo cáo" ≠ vô can — đó là ca VỆ SINH CHƯA ĐẠT (báo cáo rồi mà hôm sau vẫn bẩn),
     phân biệt rạch ròi với KHÔNG BÁO CÁO. Cả hai ca (miễn CÓ đi làm) đều thuộc trách nhiệm
     phụ trách khu vực → suyNV trả mã phụ trách. */
  const dongBc = daBC ? "ĐÃ báo cáo (" + (bcPtNgayXet[0].gio || "?") + ") nhưng vẫn ghi nhận bẩn → VỆ SINH CHƯA ĐẠT"
    : bcKhac ? "KHÔNG tự báo cáo (người khác báo cáo: " + (bcKhac.ten || bcKhac.email) + ") — vẫn ghi nhận bẩn"
    : "KHÔNG báo cáo vệ sinh vị trí này";

  /* 2 báo cáo gần nhất TRƯỚC thời điểm ghi nhận */
  const truoc = bcKe.filter((x) => (x.ngay + " " + x.gio) <= (ngayGN + " " + gioGN))
    .sort((a, b) => (b.ngay + b.gio).localeCompare(a.ngay + a.gio)).slice(0, 2);
  const aiCua = (req) => { const a = n.ai.get(String(req)); if (!a || !a.kq) return null;
    return (boDau(a.kq) === "dat" ? "ĐẠT" : a.kq) + (a.diem != null && a.diem !== "" ? " (" + a.diem + "/100)" : ""); };

  /* Renderer của work.hasaki NUỐT <br> trong <p> (đo thật 25/09: cả khối dồn 1 hàng)
     → MỖI DÒNG MỘT THẺ <p> riêng, tuyệt đối không dựa vào <br>. */
  const dongPT = pt ? pt.ten + " (" + pt.code + ")" : "chưa có trong bảng phân công";
  const T = [], H = [];
  T.push("―――");
  T.push("Phụ trách kệ (bảng phân công): " + dongPT);
  T.push("Ngày " + dmy(ngayXet) + ": " + diLam + " · " + dongBc + ".");
  H.push("<p>―――</p>");
  H.push("<p>Phụ trách kệ (bảng phân công): <b>" + escH(dongPT) + "</b></p>");
  H.push("<p>Ngày " + dmy(ngayXet) + ": " + escH(diLam) + " · " + escH(dongBc) + ".</p>");
  /* Khuôn dòng báo cáo (user chỉnh 25/09): KHÔNG họ tên; đánh giá AI đứng CÙNG HÀNG sau link.
     Web bóp méo <a> có target="_blank" (render href + "(opens in new tab)" rồi xả phần còn lại
     ra chữ thô) → chỉ dùng <a href> TRẦN, không thuộc tính nào khác. */
  if (truoc.length) {
    T.push("Báo cáo 2 ngày gần nhất:");
    H.push("<p>Báo cáo 2 ngày gần nhất:</p>");
    for (const x of truoc) {
      const ai = aiCua(x.req);
      T.push("· " + dmy(x.ngay) + " " + x.gio + " — Yêu cầu " + x.req + ": " + PG_URL(x.req) + (ai ? " · " + ai : ""));
      H.push("<p>· " + dmy(x.ngay) + " " + x.gio + ' — <a href="' + PG_URL(x.req) + '">Yêu cầu ' + escH(x.req) + "</a>" + (ai ? " · " + escH(ai) : "") + "</p>");
    }
  } else { T.push("Chưa có báo cáo nào của vị trí này trong 60 ngày."); H.push("<p>Chưa có báo cáo nào của vị trí này trong 60 ngày.</p>"); }

  /* suyNV (user chốt 25/09): phụ trách CÓ đi làm ngày xét là chịu trách nhiệm — cả ca
     KHÔNG BÁO CÁO lẫn ca VỆ SINH CHƯA ĐẠT (có báo cáo mà vẫn bẩn). Nghỉ/không rõ → không buộc. */
  const suyNV = (pt && coDiLam === true) ? pt.code : "";
  const ketLuan = !pt ? "khong_phan_cong" : coDiLam !== true ? (coDiLam === false ? "nghi" : "khong_ro")
    : daBC ? "chua_dat" : "khong_bao_cao";
  return { text: T.join("\n"), html: H.join(""), suyNV, ketLuan, ngayXet, phuTrach: pt };
}

/* Dấu nhận biết khối đã ghi (chống ghi trùng khi chạy lại) */
export const DAU_TRUY_VET = "Phụ trách kệ (bảng phân công)";
