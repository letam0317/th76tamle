/**
 * ============================================================================
 *  sync-phancong.mjs — DỰNG TAB "VESINH-PHANCONG" (sheet PRIVATE bí mật)
 * ============================================================================
 *  Bảng phân công phụ trách vệ sinh theo VỊ TRÍ, luôn có người chịu trách nhiệm:
 *
 *    Location | Responsible by | Code | Name | Nguồn | Bằng chứng | Ghi chú
 *
 *  NGUỒN 1 — ƯU TIÊN: g-sheet phân công gốc của bộ phận (đội tự cập nhật liên tục)
 *    · tab gid 341809457 "Phụ trách quầy kệ"        → kệ F0-A1 + Họ tên + Email + Code
 *    · tab gid 584257479 "Vị trí kệ phụ trách và bàn đóng" → trạm đóng đơn F0-A8 (+ kệ bù)
 *  NGUỒN 2 — DỰ PHÒNG khi g-sheet để TRỐNG người phụ trách của vị trí đó:
 *    · tab PHU-TRACH-QUAY-KE (sync-vesinh-all.js ghi từ planogram) = người BÁO CÁO gần nhất
 *      của chính vị trí đó; CHỈ nhận bằng chứng trong 30 NGÀY tính từ ngày gần nhất có dữ liệu.
 *      Cũ hơn 30 ngày thì bỏ (người có thể đã đổi vị trí/nghỉ) → thà để trống hơn réo nhầm người.
 *
 *  VÌ SAO tách script riêng, KHÔNG gộp vào sync-vesinh-all.js: bộ này chỉ đọc Google
 *  (g-sheet công khai + readTab), KHÔNG cần token WMS → chạy được mọi lúc, không đụng
 *  luật 1-phiên của operator, nên bám được nhịp "g-sheet đổi liên tục".
 *
 *  KHOÁ VỊ TRÍ (phải trùng cách dashboard đánh khoá ô — khoaO trong hasaki-planogram.js):
 *    A1 gom về mức KỆ  "F0-A1-<dãy>-<kệ>"  (1 kệ mang nhiều mã mâm-bin, gom mới khớp ô sơ đồ)
 *    A8 giữ nguyên mã đầy đủ "F0-A8-<dãy>-<ô>-01-01"
 *
 *  CHỐT AN TOÀN PII: tab có email + tên NV → chỉ ghi khi GAS đã deploy whitelist
 *  (SERVE_PRIVATE_TABS có 'VESINH-PHANCONG'). GAS cũ sẽ ghi nhầm sang SHEET PUBLIC nên
 *  probe trước, chưa sẵn sàng thì THOÁT, không ghi gì.
 *
 *  Chạy:  node sync-phancong.mjs           (thật)
 *         node sync-phancong.mjs --dry     (chỉ xuất .exports/VESINH-PHANCONG-out.json)
 * ============================================================================
 */
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { fetchThuLai, hashTab, tabKhongDoi, luuHashTab, chamMocTabs, docTabGas, gasPhucVuTab, gasPost, hamCacheTabs } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const APPSCRIPT_URL = process.env.APPSCRIPT_URL || "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
const APPSCRIPT_KEY = process.env.APPSCRIPT_KEY;
const TAB_OUT = "VESINH-PHANCONG";
const TAB_PT = "PHU-TRACH-QUAY-KE";               // dự phòng: người báo cáo gần nhất (planogram)
const GSHEET_ID = process.env.PC_GSHEET_ID || "1uOQvFN2qzROuGryBk7sKVvToBs1t4o9Yy1OoWOnL_vM";
const GID_KE = process.env.PC_GID_KE || "341809457";     // "Phụ trách quầy kệ" — nguồn gốc
const GID_BAN = process.env.PC_GID_BAN || "584257479";   // "Vị trí kệ phụ trách và bàn đóng"
const NGAY_DU_PHONG = Number(process.env.PC_FALLBACK_DAYS || 30);   // cửa sổ nhận bằng chứng dự phòng
const DRY = process.argv.includes("--dry");

const LOG = [];
function log(s){ const t = new Date().toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }); console.log("[" + t + "] " + s); LOG.push(s); }

/* ===== ĐỌC g-sheet qua gviz (khoá bằng GID — gid KHÔNG đổi khi đội đổi tên tab) ===== */
async function docGid(gid){
  const url = `https://docs.google.com/spreadsheets/d/${GSHEET_ID}/gviz/tq?tqx=out:json&gid=${encodeURIComponent(gid)}&headers=1`;
  const txt = await (await fetchThuLai(url)).text();
  const i = txt.indexOf("{"), j = txt.lastIndexOf("}");
  if (i < 0 || j < i) throw new Error("gviz gid=" + gid + ": không phải JSON (sheet đổi quyền chia sẻ?)");
  const o = JSON.parse(txt.slice(i, j + 1));
  if (o.status === "error") throw new Error("gviz gid=" + gid + ": " + JSON.stringify(o.errors || []));
  const cols = (o.table?.cols || []).map(c => String(c?.label || "").trim());
  const rows = (o.table?.rows || []).map(r => (r.c || []).map(c => (c && c.v != null) ? String(c.v) : ""));
  return { cols, rows };
}
/* Nhận cột theo NHÃN (đội hay đổi thứ tự/thêm cột) — hết cách mới lấy theo vị trí */
function timCot(cols, ten, mac){
  const hl = cols.map(c => c.replace(/\s+/g, " ").trim().toLowerCase());
  for (const t of ten){ const i = hl.findIndex(h => h.includes(t)); if (i >= 0) return i; }
  return mac;
}
/* ===== SOÁT MAIL ↔ HỌ TÊN (g-sheet do người gõ tay, KHÔNG phải lúc nào cũng đúng) =====
 * Quy tắc đặt mail Hasaki: <tên gọi><chữ cái đầu của các từ còn lại, đúng thứ tự><số thứ tự
 * nếu chuỗi chữ đó đã có người dùng trước>. Ví dụ Trần Thị Cẩm Hồng → hong + t,t,c = "hongttc",
 * trùng thì thành hongttc1. Đã kiểm trên 15 mẫu thật + toàn bộ danh bạ wshr: khớp 100%.
 * Dùng để BÁO ĐỘNG, không tự sửa: mail sai làm dashboard tra chấm công trượt → người đang đi
 * làm bị hiện thành "nghỉ", nhắc trượt người mà không ai biết. (Phát hiện thật 30/07/2026:
 * tab gốc ghi Trần Thị Cẩm Hồng = thaont22@ — giải mã ra là người tên Thảo, không phải Hồng.) */
const MAIL_HOP_LE = /^[a-z0-9._%+-]+@hasaki\.vn$/i;
function boDau(s){
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim();
}
function tienToMail(hoTen){
  const t = boDau(hoTen).replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);
  if (t.length < 2) return t[0] || "";
  return t[t.length - 1] + t.slice(0, -1).map(w => w[0]).join("");
}
function chuCuaMail(em){ const lp = String(em || "").toLowerCase().split("@")[0]; const m = lp.match(/^([a-z]+?)(\d*)$/); return m ? m[1] : lp; }
/** null = khớp quy tắc (hoặc không đủ dữ liệu để kết luận); ngược lại trả chuỗi mô tả sai lệch */
function mailLech(hoTen, em){
  if (!hoTen || !em) return null;
  const mong = tienToMail(hoTen); if (!mong) return null;
  return chuCuaMail(em) === mong ? null : ("mail không khớp tên — " + hoTen + " phải là " + mong + "<số>, đang ghi " + String(em).split("@")[0]);
}

const KHOA_A1 = /F0-A1-(\d{3})-(\d{2})/gi;
const KHOA_A8 = /F0-A8-\d{3}-\d{2}-\d{2}-\d{2}/gi;
function viTriTrong(s){
  const out = [];
  for (const m of String(s || "").matchAll(KHOA_A1)) out.push(`F0-A1-${m[1]}-${m[2]}`);
  for (const m of String(s || "").matchAll(KHOA_A8)) out.push(m[0].toUpperCase());
  return out;
}

async function ghiTab(tab, header, rows){
  if (DRY){
    fs.mkdirSync(path.join(DIR, ".exports"), { recursive: true });
    fs.writeFileSync(path.join(DIR, ".exports", tab + "-out.json"), JSON.stringify({ header, rows }, null, 2));
    log("  (DRY) " + tab + ": " + rows.length + " dòng → .exports/" + tab + "-out.json");
    return;
  }
  if (!rows.length){ log("  ⚠ " + tab + ": 0 dòng — BỎ QUA (giữ dữ liệu cũ)."); return; }
  const hash = hashTab(header, rows);
  if (tabKhongDoi(DIR, tab, hash)){
    log("  = " + tab + ": không đổi — bỏ qua ghi (" + rows.length + " dòng).");
    await chamMocTabs([tab], Date.now(), log);
    return;
  }
  const body = JSON.stringify({ action: "syncTasks", key: APPSCRIPT_KEY, tab, header, rows, apiAt: Date.now() });
  /* gasPost thay cho fetch().json(): Apps Script chập chờn trả 404/trang HTML (12/08), .json() nổ
     "Unexpected token '<'" là chết cả bước. Xem gasPost trong session-rules.js. */
  const j = await gasPost(body, log);
  if (j.status !== "success") throw new Error("Ghi " + tab + " lỗi: " + (j.message || "?"));
  luuHashTab(DIR, tab, hash);
  log("  ✓ " + tab + ": ghi " + (j.written || rows.length) + " dòng.");
  await hamCacheTabs([tab], log);   // bảng phân công là nguồn bậc 1 (tên người phụ trách ở tooltip/pop-up)
}

/* ===== CHẠY ===== */
(async () => {
  if (!DRY && !APPSCRIPT_KEY) throw new Error("Thiếu APPSCRIPT_KEY trong .env — không ghi được sheet.");
  if (!DRY && !(await gasPhucVuTab(TAB_OUT))){
    log("⛔ GAS chưa phục vụ tab " + TAB_OUT + " → DỪNG, không ghi (tránh đổ email/tên vào SHEET PUBLIC).");
    log("   Cần: thêm '" + TAB_OUT + "' vào SERVE_PRIVATE_TABS trong google-script.gs rồi deploy lại,");
    log("   hoặc chạy thử bằng: node sync-phancong.mjs --dry");
    process.exit(0);
  }

  /* --- 1) g-sheet phân công gốc --- */
  const giao = new Map();   // viTri -> { em, code, ten, gid, dong }
  const trung = new Map();  // viTri -> [tên người bị giao trùng]
  function nap(viTri, em, code, ten, nhan, dong){
    em = String(em || "").trim().toLowerCase();
    /* Chặn dòng tiêu đề lặp giữa bảng + ô gõ sai: g-sheet có dòng "Họ và tên | email" nằm
       lẫn trong dữ liệu, không lọc thì nó thành một "người phụ trách" tên là "Họ và tên". */
    if (!viTri || !MAIL_HOP_LE.test(em)) return;
    const cu = giao.get(viTri);
    if (!cu){ giao.set(viTri, { em, code: String(code || "").trim(), ten: String(ten || "").trim(), nhan, dong }); return; }
    if (cu.em !== em){   // cùng 1 vị trí giao cho 2 người — giữ người của tab GỐC, ghi chú người sau
      /* LUÔN kèm email: có ca 2 dòng TRÙNG TÊN nhưng khác email (vd "Trần Thị Cẩm Hồng"),
         chỉ ghi tên thì đọc ra như xung đột với chính mình, không lần ra được dòng nào sai. */
      const a = trung.get(viTri) || [];
      if (!a.some(x => x.em === em)) a.push({ em, ten: String(ten || "").trim() || em });
      trung.set(viTri, a);
    }
  }
  // 1a) tab gốc "Phụ trách quầy kệ": Location | Họ và tên | Email | Code
  const ke = await docGid(GID_KE);
  const cK = { loc: timCot(ke.cols, ["kệ", "location", "vị trí"], 0), ten: timCot(ke.cols, ["họ và tên", "tên"], 1),
    em: timCot(ke.cols, ["email", "mail"], 2), code: timCot(ke.cols, ["code", "msnv", "mã"], 3) };
  let nK = 0;
  ke.rows.forEach((r, i) => {
    const vs = viTriTrong(r[cK.loc]); if (!vs.length) return;
    vs.forEach(v => { nap(v, r[cK.em], r[cK.code], r[cK.ten], "g-sheet · Phụ trách quầy kệ", i + 2); nK++; });
  });
  log("✓ g-sheet gid=" + GID_KE + " (Phụ trách quầy kệ): " + nK + " lượt vị trí.");
  // 1b) tab "Vị trí kệ phụ trách và bàn đóng": thêm TRẠM ĐÓNG ĐƠN (A8) + kệ bù
  let nB = 0;
  try {
    const ban = await docGid(GID_BAN);
    const cB = { ten: timCot(ban.cols, ["tên", "họ"], 2), em: timCot(ban.cols, ["email", "mail"], 3),
      code: timCot(ban.cols, ["msnv", "code", "mã nv"], 1),
      keCol: timCot(ban.cols, ["kệ phụ trách", "kệ"], 4), tram: timCot(ban.cols, ["trạm đóng đơn", "trạm", "bàn"], 5) };
    ban.rows.forEach((r, i) => {
      const em = r[cB.em]; if (!em) return;
      [...viTriTrong(r[cB.tram]), ...viTriTrong(r[cB.keCol])].forEach(v => { nap(v, em, r[cB.code], r[cB.ten], "g-sheet · bàn đóng đơn", i + 2); nB++; });
    });
    log("✓ g-sheet gid=" + GID_BAN + " (bàn đóng đơn): " + nB + " lượt vị trí.");
  } catch (e) { log("  ⚠ Không đọc được tab bàn đóng đơn (" + e.message + ") — bỏ qua, vẫn dựng bảng từ tab gốc."); }

  /* --- 2) dự phòng: người báo cáo gần nhất trong NGAY_DU_PHONG ngày (planogram) --- */
  const pt = await docTabGas(TAB_PT);
  const duPhong = new Map();   // viTri -> { em, code, ten, ngay }
  const viTriPT = new Set();   // MỌI vị trí planogram phát yêu cầu trong 45 ngày (kể cả chưa ai làm)
  let mocMoiNhat = "";
  if (!pt) log("  ⚠ Không đọc được " + TAB_PT + " — bảng sẽ chỉ có phần g-sheet.");
  else {
    const hl = pt.header.map(h => String(h).replace(/\s+/g, " ").trim().toLowerCase());
    const iLoc = hl.findIndex(h => h.includes("location") || h.includes("vị trí"));
    const iEm = hl.findIndex(h => h.includes("executed by") || h === "email");
    const iCode = hl.findIndex(h => h === "code" || h.includes("msnv"));
    const iTen = hl.findIndex(h => h === "name" || h.includes("tên"));
    const iAt = hl.findIndex(h => h.includes("executed at"));
    pt.rows.forEach(r => { const at = String(r[iAt] || "").slice(0, 10); if (at > mocMoiNhat) mocMoiNhat = at; });
    const gioiHan = mocMoiNhat ? new Date(new Date(mocMoiNhat + "T00:00:00Z").getTime() - NGAY_DU_PHONG * 86400000).toISOString().slice(0, 10) : "";
    pt.rows.forEach(r => {
      /* Ghi nhận vị trí TRƯỚC khi lọc người: có ô planogram vẫn phát yêu cầu nhưng g-sheet
         chưa phân công VÀ chưa ai từng báo cáo (vd F0-A8-503-03-01-01) — không gom vào đây thì
         ô đó vắng hẳn khỏi bảng, dashboard hiện "không có trong bảng phân công" mà không rõ vì sao. */
      viTriTrong(r[iLoc]).forEach(v => viTriPT.add(v));
      const em = String(r[iEm] || "").trim().toLowerCase(); if (!em) return;
      const at = String(r[iAt] || "").slice(0, 10); if (!at || at < gioiHan) return;   // quá cũ → không dùng
      viTriTrong(r[iLoc]).forEach(v => {
        const cu = duPhong.get(v);
        if (!cu || at > cu.ngay) duPhong.set(v, { em, code: String(r[iCode] || "").trim(), ten: String(r[iTen] || "").trim(), ngay: at });
      });
    });
    log("✓ " + TAB_PT + ": mốc gần nhất " + (mocMoiNhat || "?") + ", cửa sổ dự phòng ≥ " + (gioiHan || "?") +
      " → " + duPhong.size + " vị trí có người báo cáo để bù.");
  }

  /* --- 3) danh bạ email → Code/Name: vá ô trống của nguồn này bằng nguồn kia
         (g-sheet có dòng bỏ trống MSNV; PHU-TRACH lấy Code/Name từ danh bạ wshr nên đủ hơn) --- */
  const danhBa = new Map();
  function ghiNho(em, code, ten){
    em = String(em || "").trim().toLowerCase(); if (!em) return;
    const o = danhBa.get(em) || { code: "", ten: "" };
    if (!o.code && code) o.code = String(code).trim();
    if (!o.ten && ten) o.ten = String(ten).trim();
    danhBa.set(em, o);
  }
  duPhong.forEach(d => ghiNho(d.em, d.code, d.ten));
  giao.forEach(g => ghiNho(g.em, g.code, g.ten));
  /* Danh bạ wshr (qua PHU-TRACH) là nguồn ĐÚNG để gợi ý mail thật: tên ở đó do hệ thống HR
     trả về, không phải người gõ tay — đã soát toàn bộ, khớp quy tắc 100%. */
  const mailTheoTen = new Map();
  duPhong.forEach(d => { if (!d.ten || !d.em) return; const k = boDau(d.ten); const s = mailTheoTen.get(k) || new Set(); s.add(d.em); mailTheoTen.set(k, s); });
  function vaThieu(o){ const d = danhBa.get(o.em) || {}; return { ...o, code: o.code || d.code || "", ten: o.ten || d.ten || "" }; }

  /* --- 4) gộp: g-sheet trước, thiếu thì lấy dự phòng; hàng = mọi vị trí của CẢ HAI nguồn --- */
  const moiViTri = [...new Set([...giao.keys(), ...duPhong.keys(), ...viTriPT])].sort();
  const header = ["Location", "Responsible by", "Code", "Name", "Nguồn", "Bằng chứng", "Ghi chú"];
  let nGoc = 0, nBu = 0, nTrong = 0;
  const canhBaoMail = new Map();   // "tên|mail" -> { mota, goiY, viTri: [] } — lệch mà KHÔNG chữa được
  const suaTheoPG = [];            // các dòng đã tự chữa nhờ bằng chứng báo cáo planogram
  function soatMail(ten, em, v){
    const mota = mailLech(ten, em); if (!mota) return "";
    const k = ten + "|" + em, cu = canhBaoMail.get(k);
    const goiY = [...(mailTheoTen.get(boDau(ten)) || [])].filter(e => e !== em);
    if (cu) cu.viTri.push(v); else canhBaoMail.set(k, { mota, goiY, viTri: [v] });
    return "⚠ " + mota + (goiY.length ? " — danh bạ đang có " + goiY.join(", ") : "");
  }
  const rows = moiViTri.map(v => {
    const g0 = giao.get(v), d0 = duPhong.get(v);
    let g = g0 && vaThieu(g0);
    const d = d0 && vaThieu(d0);
    const gc = [];
    if (g){
      nGoc++;
      /* TỰ CHỮA THEO PLANOGRAM khi tên và mail của g-sheet ĐÁ NHAU.
       * Trọng tài là MAIL ĐANG BÁO CÁO ở chính vị trí đó — bằng chứng người thật đã làm,
       * mạnh hơn ô người gõ tay. Mail báo cáo trùng MỘT trong hai vế đang mâu thuẫn thì chốt
       * theo planogram và lấy luôn Name/Code từ danh bạ wshr (nguồn HR, đã soát khớp 100%):
       *   · trùng MAIL g-sheet  → mail đúng, TÊN sai  → thay tên theo danh bạ
       *   · trùng TÊN g-sheet   → tên đúng, MAIL sai  → thay mail bằng mail đang báo cáo
       * Không trùng vế nào (người thứ ba) → KHÔNG đoán, giữ nguyên và chỉ cảnh báo. */
      const mota = mailLech(g.ten, g.em);
      if (mota){
        const theoMail = d && d.em === g.em;                                 // planogram xác nhận MAIL
        const theoTen = d && chuCuaMail(d.em) === tienToMail(g.ten);         // planogram xác nhận TÊN
        if (d && (theoMail || theoTen)){
          const truoc = g.ten + " <" + g.em + ">";
          g = { ...g, em: d.em, ten: d.ten || g.ten, code: d.code || g.code, nhan: g.nhan + " + chữa theo planogram" };
          const sau = g.ten + " <" + g.em + ">";
          suaTheoPG.push({ v, truoc, sau, ngay: d.ngay, ve: theoMail ? "mail" : "tên", mota });
          gc.push("ĐÃ CHỮA theo planogram (báo cáo " + d.ngay + "): g-sheet ghi " + truoc + " — " + mota);
        } else {
          gc.push(soatMail(g.ten, g.em, v));
        }
      }
      /* Ghi chú "giao trùng" dựng SAU khi chữa và bỏ người có cùng mail với dòng đã chốt —
         không thì đọc ra thành "trùng với chính mình" (ca 516 vừa chữa xong). */
      const khac = (trung.get(v) || []).filter(x => x.em !== g.em);
      if (khac.length) gc.push("GIAO TRÙNG với: " + khac.map(x => x.ten + " <" + x.em + ">").join(", "));
      if (d && d.em !== g.em) gc.push("người báo cáo gần nhất khác: " + (d.ten || d.em) + " <" + d.em + "> " + d.ngay);
      return [v, g.em, g.code, g.ten, g.nhan, "", gc.join(" · ")];
    }
    if (d){
      nBu++;
      gc.unshift("g-sheet chưa phân công vị trí này");
      return [v, d.em, d.code, d.ten, "planogram · báo cáo gần nhất (≤" + NGAY_DU_PHONG + " ngày)", d.ngay, gc.join(" · ")];
    }
    nTrong++;
    return [v, "", "", "", "chưa có nguồn nào", "", "KHÔNG xác định được người phụ trách"];
  });
  log("→ Bảng " + TAB_OUT + ": " + rows.length + " vị trí | từ g-sheet " + nGoc + " · bù từ planogram " + nBu + " · còn trống " + nTrong);
  const nA1 = rows.filter(r => /^F0-A1/.test(r[0])).length, nA8 = rows.filter(r => /^F0-A8/.test(r[0])).length;
  /* Đếm giao trùng THẬT SỰ CÒN LẠI (sau khi chữa theo planogram), không đếm xung đột thô —
     3 vị trí 516 vốn "trùng" chỉ vì g-sheet ghi sai mail của cùng một người. */
  const nTrung = rows.filter(r => /GIAO TRÙNG/.test(r[6])).length;
  log("   (quầy kệ A1: " + nA1 + " · bàn đóng đơn A8: " + nA8 + " · giao trùng còn lại: " + nTrung + ")");
  /* Báo động mail lệch quy tắc — in RA LOG mỗi lượt cho tới khi g-sheet được sửa, vì hậu quả
     âm thầm: mail sai thì tra chấm công trượt, người đang đi làm bị hiện "nghỉ" và không ai nhắc. */
  if (suaTheoPG.length){
    const theoVT = new Map();
    suaTheoPG.forEach(s => { const k = s.truoc + "→" + s.sau; const o = theoVT.get(k) || { ...s, vt: [] }; o.vt.push(s.v); theoVT.set(k, o); });
    log("🔧 ĐÃ CHỮA " + suaTheoPG.length + " dòng theo bằng chứng báo cáo planogram (g-sheet gốc vẫn nên sửa lại):");
    theoVT.forEach(o => log("   • " + o.truoc + "  →  " + o.sau + "   [planogram xác nhận " + o.ve + ", báo cáo " + o.ngay +
      "] (" + o.vt.length + " vị trí: " + o.vt.slice(0, 4).join(", ") + (o.vt.length > 4 ? "…" : "") + ")"));
  }
  if (canhBaoMail.size){
    log("⚠ " + canhBaoMail.size + " MAIL LỆCH QUY TẮC mà planogram KHÔNG xác nhận được vế nào — giữ nguyên, sửa tay ở g-sheet:");
    canhBaoMail.forEach(c => log("   • " + c.mota + (c.goiY.length ? "  → danh bạ có: " + c.goiY.join(", ") : "  → chưa thấy mail đúng nào trong danh bạ") +
      "  (" + c.viTri.length + " vị trí: " + c.viTri.slice(0, 4).join(", ") + (c.viTri.length > 4 ? "…" : "") + ")"));
  } else log("✓ Mail ↔ họ tên: khớp quy tắc toàn bộ.");
  await ghiTab(TAB_OUT, header, rows);
  log("XONG.");
})().catch(e => { console.error("✗ " + e.message); process.exit(1); });
