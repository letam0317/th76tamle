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

/* Tra phụ trách CHỊU ĐƯỢC mã gõ thiếu (user chốt 25/09/2026): mã thiếu "F0-"/thiếu khu
 * ("A1-506-08-03-01", "509-06", "504-04-03-02"…) thì so PHẦN TỬ với danh mục phân công:
 *   · khớp đúng 1 vị trí → gán luôn vị trí đó;
 *   · khớp NHIỀU vị trí nhưng tất cả cùng 1 phụ trách → vẫn gán cho người đó;
 *   · khớp nhiều vị trí KHÁC phụ trách → không đoán (trả pt=null).
 * Vị trí tự do ("Bãi giấy rọc", "IT WH"…) không có dạng mã-gạch-nối → bỏ qua ngay. */
export function traPhanCong(n, viTri) {
  const khoa = khoaO(viTri);
  const chinh = n.pc.get(khoa);
  if (chinh) return { pt: chinh, khoa };
  const b = boDau(khoa).replace(/^f0-/, "");
  if (!/^[a-z0-9]+(-[a-z0-9]+)+$/.test(b)) return { pt: null, khoa };
  const ung = [];
  for (const [k, v] of n.pc) {
    const kb = boDau(k).replace(/^f0-/, "");
    let khop = kb === b || kb.endsWith("-" + b) || b.startsWith(kb + "-") || kb.includes("-" + b + "-");
    if (!khop) {                     // đuôi của khoá phân công khớp ĐẦU của mã gõ: "a1-504-04" ↔ "504-04-03-02"
      const seg = kb.split("-");
      for (let i = 1; i < seg.length && !khop; i++) {
        const duoi = seg.slice(i).join("-");
        if (duoi.split("-").length >= 2 && (b === duoi || b.startsWith(duoi + "-") || duoi.startsWith(b + "-"))) khop = true;
      }
    }
    if (khop) ung.push({ khoa: k, pt: v });
  }
  if (!ung.length) return { pt: null, khoa };
  const cungNguoi = new Set(ung.map((u) => String(u.pt.code))).size === 1;
  if (ung.length === 1 || cungNguoi) return { pt: ung[0].pt, khoa: ung[0].khoa, mo: true, soKhop: ung.length };
  return { pt: null, khoa, nhieuKhop: ung.length };   // mơ hồ giữa nhiều người — để người xác minh
}

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
  const tra = traPhanCong(n, viTri);        // 25/09: chịu được mã gõ thiếu F0-/thiếu khu
  const khoa = tra.khoa;
  const ngayGN = String(thoiDiem || "").slice(0, 10), gioGN = String(thoiDiem || "").slice(11, 16);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ngayGN)) return null;
  const pt = tra.pt;

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
  /* Nhãn "AI đánh giá" thay cho chữ ĐẠT trần (user chỉnh 25/09); kết luận KHÔNG ĐẠT vẫn ghi rõ chữ.
     Tab VESINH-AI lưu mã thô (DAT/KHONG_DAT/CAN_XEM) → đổi sang chữ đọc được. */
  const TEN_KQ_AI = { dat: "", khong_dat: "KHÔNG ĐẠT", can_xem: "CẦN XEM" };
  const aiCua = (req) => { const a = n.ai.get(String(req)); if (!a || !a.kq) return null;
    const diem = (a.diem != null && a.diem !== "") ? " (" + a.diem + "/100)" : "";
    const kq = TEN_KQ_AI[boDau(a.kq).replace(/\s+/g, "_")];
    return kq === "" ? "AI đánh giá" + diem : "AI đánh giá: " + (kq || a.kq) + diem; };

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

  /* PHÂN LOẠI NGHỈ (user chốt 25/09 chiều) — đo CHUỖI ngày không chấm công chứa ngày xét:
   *   nghi_ngan  (1–2 ngày)   → phiếu fail "Nhân sự phụ trách … không đi làm ngày …"
   *   nghi_dai   (≥3 ngày)    → trách nhiệm QLTT (không chia nhân sự vệ sinh kịp thời)
   *   nghi_viec  (≥14 ngày tính đến ngày xét VÀ không đi lại) → như nghỉ dài, nhãn nghỉ việc */
  let nghi = null;
  if (coDiLam === false) {
    const ngays = [...(n.cc.get(pt.code) || new Map()).keys()].sort();
    const dTruoc = ngays.filter((x) => x < ngayXet), dSau = ngays.filter((x) => x > ngayXet);
    const cach = (a, b) => Math.round((new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / 864e5);
    const gapTruoc = dTruoc.length ? cach(dTruoc[dTruoc.length - 1], ngayXet) : 999;
    const gapSau = dSau.length ? cach(ngayXet, dSau[0]) : Math.max(1, cach(ngayXet, new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)));
    const run = Math.min(999, gapTruoc + gapSau - 1);
    nghi = { run, loai: (!dSau.length && gapTruoc >= 14) ? "nghi_viec" : run >= 3 ? "nghi_dai" : "nghi_ngan",
      lamCuoi: dTruoc.length ? dTruoc[dTruoc.length - 1] : "", lamLai: dSau.length ? dSau[0] : "" };
  }
  const ketLuan = !pt ? "khong_phan_cong" : coDiLam !== true ? (coDiLam === false ? nghi.loai : "khong_ro")
    : daBC ? "chua_dat" : "khong_bao_cao";
  return { text: T.join("\n"), html: H.join(""), suyNV, ketLuan, ngayXet, phuTrach: pt,
    nghi, coBaoCaoNgayXet: bcNgayXet.length > 0, khoa, khopMo: !!tra.mo };
}

/* Dấu nhận biết khối đã ghi (chống ghi trùng khi chạy lại) */
export const DAU_TRUY_VET = "Phụ trách kệ (bảng phân công)";
