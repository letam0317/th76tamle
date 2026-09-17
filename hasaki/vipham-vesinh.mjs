/**
 * vipham-vesinh.mjs — SỔ VI PHẠM LUỸ TIẾN "đi làm mà KHÔNG báo cáo vệ sinh" (17/09/2026, user yêu cầu)
 * ============================================================================================
 *  Luật user chốt: cứ MỖI 3 LẦN một người có chấm công nhưng không báo cáo vệ sinh ô mình phụ
 *  trách (hạng mục "Bàn làm việc và khu vực phụ trách: phải được vệ sinh và báo cáo hằng ngày
 *  vào cuối mỗi ca") thì pop-up ô trên tab Planogram mới hiện nút "Ghi nhận 5S" để lập biên bản
 *  trừ KPI 2%. Hai lần đầu chỉ đếm, không có nút.
 *
 *  Vì sao đếm ở MÁY TRẠM (bộ sync) chứ không ở trình duyệt: dashboard chỉ giữ 7 ngày yêu cầu
 *  (VESINH-YEUCAU) nên không đếm được người vi phạm rải rác; máy trạm quét 8 ngày mỗi 15' và 45
 *  ngày lúc 8h40, cộng dồn được như VESINH-CHAMCONG-NGAY. Sổ này KHÔNG thêm tab Sheet mới (khỏi
 *  deploy GAS): ghi thêm 2 cột vào chính tab VESINH-CHAMCONG-NGAY mà pop-up đã nạp sẵn.
 *
 *  Một LẦN = một NGÀY (đã khép, < hôm nay) mà người P: (1) có chấm công ngày đó, (2) có ≥1 ô
 *  phụ trách (bảng phân công) mang yêu cầu vệ sinh ngày đó mà KHÔNG AI báo cáo (không executor,
 *  không Waiting/Approved). Ô do người khác làm thay thì ô sạch → không tính (khớp luật màu đỏ
 *  của sơ đồ). Hôm nay chưa khép → dashboard tự xét trực tiếp, sổ không ghi.
 *
 *  Ngày trong cửa sổ lấy lại chấm công (CC_LAY, 7 ngày) được TÍNH LẠI mỗi lượt (chấm công còn
 *  sửa muộn); ngày cũ hơn đã có trong sổ thì GIỮ NGUYÊN (phân công có đổi cũng không viết lại
 *  quá khứ — bằng chứng đã chốt). Ngày quá `giuNgay` (60) bị xoá.
 *
 *  "ĐÃ GHI NHẬN KPI": đọc tab WMS-5S-AUDIT (gviz công khai, 0 lượt GAS) → dòng hạng mục vệ sinh
 *  → mã NV từ Hiện trạng "Phụ trách: Tên (mã)" (biên bản lập từ pop-up), không có thì suy từ chủ
 *  vị trí của ô ghi nhận. Ngày MỐC = ngày cuối trong "Vi phạm luỹ tiến: … (dd/mm/yyyy · …)" nếu
 *  có, không thì ngày lập biên bản. Chu kỳ mới = các lần SAU mốc đó.
 *  Cùng một phép tính `chuKy()` được chép nguyên sang hasaki-planogram.js (luyTien) — sửa một
 *  bên phải sửa bên kia; qc-vipham-luytien.mjs kiểm bản này.
 * ============================================================================================
 */
export const HM_VESINH = "Bàn làm việc và khu vực phụ trách: phải được vệ sinh và báo cáo hằng ngày vào cuối mỗi ca.";
export const HM_VESINH_RE = /^\s*Bàn làm việc và khu vực phụ trách/i;
export const COT_VP = "Vi phạm (ngày:số ô:ô)";
export const COT_GHI = "Đã ghi nhận KPI (ngày)";
export const MOI_LAN = 3;   // đủ 3 lần mới hiện nút

export function khoaO(loc){ const m = String(loc || "").match(/^F0-A1-(\d{3})-(\d{2})-/); return m ? `F0-A1-${m[1]}-${m[2]}` : String(loc || "").trim().toUpperCase(); }

/** Sổ vi phạm từ lượt quét.
 *  reqNgay : [{ n:'yyyy-mm-dd', l:location, e:email executor (thường) hoặc '', st:status_id }]
 *  pcBy    : { khoáÔ: { em, code, ten } }             (VESINH-PHANCONG)
 *  ccNv    : { code: { em, ten, d: { 'yyyy-mm-dd': 'hh:mm-hh:mm' } } }   (kho chấm công 60 ngày)
 *  byEmail : { emailLower: { code, name } }            (danh bạ — vá mã khi phân công thiếu)
 *  vpCu    : sổ cũ { nv: { code: { em, ten, d: { ngày: { so, o:[] } } } } } hoặc null
 */
export function tinhSoViPham({ reqNgay, pcBy, ccNv, byEmail = {}, today, mocLay, vpCu, giuNgay = 60 }){
  const nv = {};
  if (vpCu && vpCu.nv) for (const code in vpCu.nv){ const o = vpCu.nv[code]; nv[code] = { em: o.em || "", ten: o.ten || "", d: Object.assign({}, o.d || {}) }; }
  const reqByDay = {};
  for (const q of reqNgay || []){ if (!q || !q.n || q.n >= today) continue; (reqByDay[q.n] || (reqByDay[q.n] = [])).push(q); }
  const ngayDaCo = new Set(); for (const code in nv) for (const d in nv[code].d) ngayDaCo.add(d);
  let nTinhLai = 0, nGiu = 0, nMoi = 0;
  for (const d of Object.keys(reqByDay).sort()){
    const trongCuaSo = d >= mocLay;
    if (!trongCuaSo && ngayDaCo.has(d)){ nGiu++; continue; }   // ngày cũ đã chốt — không viết lại quá khứ
    for (const code in nv) delete nv[code].d[d];
    const chuaBC = {};   // khoá ô -> location: có yêu cầu mà KHÔNG AI báo cáo
    for (const q of reqByDay[d]){ if (q.e || q.st === 3 || q.st === 4) continue; chuaBC[khoaO(q.l)] = q.l; }
    const theoNV = {};
    for (const kk in chuaBC){
      const p = pcBy[kk]; if (!p || !p.em) continue;
      const code = String(p.code || (byEmail[String(p.em).toLowerCase()] || {}).code || "").replace(/\.0$/, "").trim();
      if (!code) continue;
      (theoNV[code] || (theoNV[code] = { em: p.em, ten: p.ten || (byEmail[p.em] || {}).name || "", o: [] })).o.push(kk);
    }
    for (const code in theoNV){
      const cc = ccNv[code];
      if (!cc || !cc.d || !cc.d[d]) continue;                  // hôm đó không chấm công → lỗi bố trí, không phải lỗi người
      const o = nv[code] || (nv[code] = { em: theoNV[code].em, ten: theoNV[code].ten, d: {} });
      if (!o.em) o.em = theoNV[code].em; if (!o.ten) o.ten = theoNV[code].ten || cc.ten || "";
      o.d[d] = { so: theoNV[code].o.length, o: theoNV[code].o.sort() };
      nMoi++;
    }
    if (trongCuaSo) nTinhLai++;
  }
  const mocGiu = lechNgay(today, -(giuNgay - 1));
  let nXoa = 0;
  for (const code in nv){
    for (const d in nv[code].d) if (d < mocGiu){ delete nv[code].d[d]; nXoa++; }
    if (!Object.keys(nv[code].d).length) delete nv[code];
  }
  return { nv, thongKe: { nguoi: Object.keys(nv).length, lan: Object.values(nv).reduce((s, o) => s + Object.keys(o.d).length, 0), ngayTinhLai: nTinhLai, ngayGiu: nGiu, oMoi: nMoi, xoaQuaHan: nXoa, mocGiu } };
}

/** Ngày ± n theo lịch VN (chuỗi yyyy-mm-dd → yyyy-mm-dd). */
export function lechNgay(iso, n){
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/); if (!m) return iso;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + n));
  return d.toISOString().slice(0, 10);
}

/** Ngày gviz "Date(2026,8,17,8,40,21)" / "2026-09-17 08:40" / Date → 'yyyy-mm-dd' (tháng gviz đếm từ 0). */
export function ngayIso(v){
  if (v instanceof Date) return v.toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
  const s = String(v || "");
  let m = s.match(/^Date\((\d{4}),(\d{1,2}),(\d{1,2})/); if (m) return `${m[1]}-${String(+m[2] + 1).padStart(2, "0")}-${String(+m[3]).padStart(2, "0")}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return "";
}

/** Đọc biên bản KPI đã lập → { code: ['yyyy-mm-dd' mốc chu kỳ, …] }.
 *  auditRows: [{ ngay, hienTrang, viTri, hangMuc }] (đã lọc hay chưa đều được). */
export function gopGhiNhanKpi(auditRows, pcBy = {}, byEmail = {}){
  const ghi = {};
  for (const r of auditRows || []){
    if (!HM_VESINH_RE.test(String(r.hangMuc || ""))) continue;
    const ht = String(r.hienTrang || "");
    let code = (ht.match(/Phụ trách:[^\n]*?\((\d{3,8})\)/) || [])[1] || "";
    if (!code){ const p = pcBy[khoaO(r.viTri)]; if (p) code = String(p.code || (byEmail[String(p.em || "").toLowerCase()] || {}).code || ""); }
    code = String(code).replace(/\.0$/, "").trim(); if (!code) continue;
    /* mốc = ngày cuối trong dòng luỹ tiến (dd/mm/yyyy) — biên bản lập muộn vẫn khép đúng các lần đã kê */
    let moc = "";
    const mLT = ht.match(/Vi phạm luỹ tiến:[^\n]*/);
    if (mLT){ for (const m of mLT[0].matchAll(/(\d{2})\/(\d{2})\/(\d{4})/g)){ const iso = `${m[3]}-${m[2]}-${m[1]}`; if (iso > moc) moc = iso; } }
    if (!moc) moc = ngayIso(r.ngay);
    if (!moc) continue;
    (ghi[code] || (ghi[code] = new Set())).add(moc);
  }
  const out = {}; for (const c in ghi) out[c] = [...ghi[c]].sort().reverse();
  return out;
}

/** Kéo tab WMS-5S-AUDIT qua gviz công khai (0 lượt GAS). Lỗi → ném; người gọi giữ sổ cũ. */
export async function docAuditGviz(sheetId, tab = "WMS-5S-AUDIT", fetchImpl = globalThis.fetch){
  const url = "https://docs.google.com/spreadsheets/d/" + sheetId + "/gviz/tq?sheet=" + encodeURIComponent(tab) + "&headers=1&tqx=out:json";
  let r = null, loi = null;
  for (let i = 0; i < 3 && !r; i++){
    try { r = await fetchImpl(url, { signal: AbortSignal.timeout(45000) }); if (!r.ok){ loi = new Error("HTTP " + r.status); r = null; } }
    catch (e) { loi = e; }
    if (!r && i < 2) await new Promise(res => setTimeout(res, 2000 * (i * 2 + 1)));
  }
  if (!r) throw new Error("gviz " + tab + ": " + (loi && loi.message));
  const t = await r.text();
  const j = JSON.parse(t.slice(t.indexOf("(") + 1, t.lastIndexOf(")")));
  const lb = (j.table.cols || []).map(c => String(c.label || "").toLowerCase());
  const iN = lb.findIndex(h => h.startsWith("ngày giờ")), iH = lb.findIndex(h => h.startsWith("hiện trạng")),
        iV = lb.findIndex(h => h.startsWith("vị trí")), iM = lb.findIndex(h => h.startsWith("hạng mục"));
  if (iM < 0) throw new Error("gviz " + tab + ": không thấy cột Hạng mục (" + lb.join(", ") + ")");
  const v = (rw, i) => (i >= 0 && rw.c && rw.c[i] && rw.c[i].v != null) ? rw.c[i].v : "";
  return (j.table.rows || []).map(rw => ({ ngay: ngayIso(v(rw, iN)), hienTrang: String(v(rw, iH)), viTri: String(v(rw, iV)), hangMuc: String(v(rw, iM)) }));
}

/** Chuỗi 2 cột cho tab VESINH-CHAMCONG-NGAY (mới nhất trước). */
export function chuoiCot(o, ghiDates){
  const vp = o && o.d ? Object.keys(o.d).sort().reverse().map(d => d + ":" + o.d[d].so + ":" + (o.d[d].o || []).join(",")).join(" | ") : "";
  const ghi = (ghiDates || []).slice().sort().reverse().slice(0, 12).join(" | ");
  return { vp, ghi };
}
/** Đọc lại 2 cột đó (dashboard dùng cùng hàm này — chép nguyên sang hasaki-planogram.js: docCotVp/docCotGhi). */
export function docCotVp(s){
  const d = {};
  for (const ph of String(s || "").split("|")){
    const m = ph.trim().match(/^(\d{4}-\d{2}-\d{2}):(\d+)(?::(.*))?$/); if (!m) continue;
    d[m[1]] = { so: +m[2], o: m[3] ? m[3].split(",").filter(Boolean) : [] };
  }
  return d;
}
export function docCotGhi(s){ return String(s || "").split("|").map(x => x.trim()).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x)).sort().reverse(); }

/** CHU KỲ đang đếm tới ngày `den` (yyyy-mm-dd, thường = ngày pop-up đang xem).
 *
 *  LUẬT (user chốt 17/09/2026): **cứ mỗi 3 lần thì bắn MỘT task ghi nhận (−2%)**; phần lẻ chưa đủ 3
 *  **vẫn nằm trong sổ** chờ cộng tiếp, không mất, không bị "tiêu thụ" oan. Vì vậy:
 *    · 6 lần chưa ghi nhận = **2 phiếu** (−2% mỗi phiếu), 9 lần = 3 phiếu, 12 lần = 4 phiếu…
 *    · 7 lần = 2 phiếu + **dư 1** chuyển sang chu kỳ sau.
 *  Mỗi phiếu kê ĐÚNG 3 ngày cũ nhất (`keNay`) → mốc ghi nhận rơi vào ngày thứ 3, các lần sau còn
 *  nguyên ⇒ lập xong phiếu này, nút vẫn hiện cho phiếu kế tiếp. (Bản đầu kê hết mọi ngày nên mốc
 *  nhảy tới ngày cuối, "nuốt" cả phần dư: 9 lần chỉ bị trừ 2% — lỗ hổng do chính user hỏi mà lộ ra.)
 *
 *  `den` = hôm nay thì HÔM NAY KHÔNG được tính (user chốt: chỉ tính ngày đã khép) — sổ vốn chỉ ghi
 *  ngày đã khép nên điều kiện này tự thoả; hàm không tự thêm ngày nào.
 *
 *  → { n, ngay, moc, soPhieu, keNay, duLai, du }
 *     n = số lần chưa ghi nhận · ngay = các ngày đó · moc = mốc ghi nhận gần nhất
 *     soPhieu = số phiếu CÒN NỢ (floor(n/3)) · keNay = 3 ngày của phiếu sắp lập · duLai = lần lẻ còn giữ
 */
export function chuKy(vpD, ghiDates, den){
  const moc = (ghiDates || []).filter(g => g <= den).sort().pop() || "";
  const ngay = Object.keys(vpD || {}).filter(d => d > moc && d <= den).sort();
  const n = ngay.length, soPhieu = Math.floor(n / MOI_LAN);
  return { n, ngay, moc, soPhieu, keNay: soPhieu ? ngay.slice(0, MOI_LAN) : [], duLai: n - soPhieu * MOI_LAN, du: soPhieu >= 1 };
}
