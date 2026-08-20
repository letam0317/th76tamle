/**
 * tra-uid-sheet.mjs — MÁY TRẠM phục vụ file Google Sheet "TRA UID - Ton kho WMS".
 *
 *   node tra-uid-sheet.mjs --dien [--loop 5]    điền kho/SKU/tên cho các dòng đang chờ
 *                                               (--loop N: ở lại canh N phút, nhịp 3 giây)
 *   node tra-uid-sheet.mjs --tao-script <ID>    đẩy sheet-tra-uid.gs lên script gắn liền file
 *   node tra-uid-sheet.mjs --nap <ID> uids.txt  nạp sẵn danh sách UID vào cột B
 *   node tra-uid-sheet.mjs --doi-bo-cuc <ID>    chuyển bảng cũ (UID ở cột A) sang bố cục mới
 *
 * VÌ SAO PHẢI CÓ MÁY TRẠM: WMS chặn IP ngoài mạng công ty → Apps Script gọi thẳng WMS trả
 * "Địa chỉ không khả dụng" (đo 17/08/2026). Script trong Sheet chỉ đánh dấu "⏳ đang tra…",
 * việc hỏi WMS phải chạy ở đây. Nhờ vậy token WMS không cần nằm trong file Sheet.
 *
 * ĐỌC Sheet: gviz `tq` kèm Bearer (lấy đúng tab theo TÊN), hỏng thì rơi về Drive export CSV.
 * GHI Sheet: qua GAS chính (action syncTasks, sheetId ngoài) — GAS là chủ file nên ghi thoải mái.
 * Sheets API (đường nhanh nhất) KHÔNG dùng được: chưa bật trên project OAuth của clasp, và bật
 * bằng Service Usage API bị 403 "Permission denied to enable service" (thử 17/08/2026).
 *
 * ===== TỐC ĐỘ — đo thật 17/08/2026, gõ UID → thấy kết quả =====
 *   Bản đầu: 18,2 / 61,6 / 54,5 giây      →   Bản này: 6,3 / 5,0 / 5,0 giây
 *   Bốn chỗ đã sửa, theo thứ tự đóng góp:
 *   1. Đánh hơi việc bằng `modifiedTime` của Drive là SAI: metadata Drive trễ hàng chục giây sau
 *      khi ô đổi → vòng canh ngủ tiếp, phải chờ nhịp task sau. Nay hỏi thẳng Sheet bằng truy vấn
 *      đếm gviz `select count(A) where A is not null and (B is null or B starts with '⏳')`
 *      (~0,2 KB / 0,6s) mỗi 3 giây.
 *   2. Đọc bảng: Drive export CSV 7–12s (chậm nhất là ngay sau một lượt ghi) → gviz 0,4–0,9s.
 *   3. Token Google + token WMS: trước mỗi lượt đều đi làm tươi/kiểm get-me (~1–1,6s) → giữ lại
 *      trong tiến trình (45' / 5').
 *   4. Nhịp task 2 phút → 1 phút, mỗi lượt ở lại canh 51 giây nên các lượt nối đuôi nhau.
 *   Còn lại là sàn không hạ được: ghi Sheet qua Apps Script ~2,4–2,6s (2 chặng của Google) và
 *   WMS 0,7–2,3s. Vì thế đừng kỳ vọng dưới ~4 giây.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { layTokenSongWms, gasPost } from "./session-rules.js";
import { traWms, thanhBang } from "./tra-uid-core.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const GHI_NHO = path.join(DIR, ".tra-uid-sheet.json");
const NGUON_GS = path.join(DIR, "sheet-tra-uid.gs");
const TAB = "TRA-UID";
/* BỐ CỤC CỘT (chốt 17/08/2026 theo yêu cầu người dùng):
 *   A Warehouse Name (máy điền + ô báo "⏳ đang tra…") · B UID (nhập) · C Location (nhập tay,
 *   máy KHÔNG BAO GIỜ đè) · D SKU · E Product Name · F Trạng thái · G Vị trí (bin). */
const HEADER = ["Warehouse Name", "UID", "Location", "SKU", "Product Name", "Trạng thái", "Vị trí (bin)"];
const I_KHO = 0, I_UID = 1, I_LOC = 2;   // chỉ số trong mảng dòng
const CHO = "⏳ đang tra…";
const KHONG_THAY = "(không thấy)";
const KEY = process.env.APPSCRIPT_KEY;

const argv = process.argv.slice(2);
const lay = (t) => { const i = argv.indexOf(t); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : null; };
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);
const nghi = (ms) => new Promise((r) => setTimeout(r, ms));

const nho = fs.existsSync(GHI_NHO) ? JSON.parse(fs.readFileSync(GHI_NHO, "utf8")) : {};
const luuNho = () => fs.writeFileSync(GHI_NHO, JSON.stringify(nho, null, 1));
const sheetId = lay("--tao-script") || lay("--dien") || lay("--nap") || nho.sheetId || "";

/* Token Google (clasp) — GIỮ LẠI TRONG TIẾN TRÌNH. Trước đây mỗi lượt hỏi Sheet đều đi làm tươi
   token = thêm 1 vòng HTTP (~0,3-0,6s) cho mỗi nhịp canh, hoàn toàn thừa vì token sống 1 giờ. */
let _at = null, _atLuc = 0;
async function tokenClasp() {
  if (_at && Date.now() - _atLuc < 45 * 60 * 1000) return _at;
  const rc = JSON.parse(fs.readFileSync(path.join(os.homedir(), ".clasprc.json"), "utf8"));
  const t = rc.tokens ? rc.tokens.default : rc.token;
  const tk = await (await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: t.client_id, client_secret: t.client_secret, refresh_token: t.refresh_token, grant_type: "refresh_token" }),
  })).json();
  if (!tk.access_token) throw new Error("không làm tươi được token clasp");
  _at = tk.access_token; _atLuc = Date.now();
  return _at;
}

/* Token WMS — GIỮ LẠI 5 PHÚT trong tiến trình. `layTokenSongWms` kiểm get-me mỗi lần gọi
   (~1s); trong một lượt canh dài, hỏi lại mỗi lần điền là phí. Hết hạn/chết thì lượt sau tự lấy
   lại (mọi UID trả "không thấy" cũng ép làm mới — xem chỗ gọi). */
let _wms = null, _wmsLuc = 0;
async function tokenWms(epMoi = false) {
  if (!epMoi && _wms && Date.now() - _wmsLuc < 5 * 60 * 1000) return _wms;
  _wms = await layTokenSongWms(DIR, () => {});
  _wmsLuc = Date.now();
  return _wms;
}

/* ĐẾM DÒNG ĐANG CHỜ — nhịp canh chỉ hỏi câu này: gviz cho phép truy vấn kiểu SQL nên chỉ tải về
 * ~0,2 KB / ~0,6s thay vì cả bảng.
 * ĐỪNG DÙNG mốc `modifiedTime` của Drive để đánh hơi thay đổi: đo 17/08 cho thấy metadata Drive
 * CẬP NHẬT TRỄ hàng chục giây sau khi ô đổi → vòng canh ngủ tiếp, end-to-end vọt lên 55–62 giây. */
async function demCho(id) {
  const at = await tokenClasp();
  const tq = "select count(B) where B is not null and (A is null or A starts with '⏳')";
  const r = await fetch("https://docs.google.com/spreadsheets/d/" + id +
    "/gviz/tq?tqx=out:json&headers=1&sheet=" + encodeURIComponent(TAB) + "&tq=" + encodeURIComponent(tq),
    { headers: { authorization: "Bearer " + at } });
  if (!r.ok) return -1;                       // hỏi không được → coi như "có thể có việc"
  const txt = await r.text();
  try {
    const j = JSON.parse(txt.slice(txt.indexOf("{"), txt.lastIndexOf("}") + 1));
    const c = (((j.table || {}).rows || [])[0] || {}).c;
    return c && c[0] && c[0].v != null ? Number(c[0].v) : 0;
  } catch { return -1; }
}

/* ---------- đọc tab TRA-UID bằng Drive export CSV ---------- */
function tachCsv(txt) {
  const dong = [];
  let o = [], ô = "", trongNhay = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (trongNhay) {
      if (c === '"' && txt[i + 1] === '"') { ô += '"'; i++; }
      else if (c === '"') trongNhay = false;
      else ô += c;
    } else if (c === '"') trongNhay = true;
    else if (c === ",") { o.push(ô); ô = ""; }
    else if (c === "\n") { o.push(ô); dong.push(o); o = []; ô = ""; }
    else if (c !== "\r") ô += c;
  }
  if (ô !== "" || o.length) { o.push(ô); dong.push(o); }
  return dong;
}
/* ĐỌC BẢNG — hai đường, đo 17/08/2026:
 *   · gviz `tq` kèm Bearer  : ~0,6s, LẤY ĐÚNG TAB THEO TÊN (khỏi lo ai kéo tab khác lên đầu)
 *   · Drive export CSV      : ~1,0–1,4s, và chỉ trả TAB ĐẦU TIÊN
 * ⇒ dùng gviz trước, hỏng thì mới rơi về export. (Sheets API — đường nhanh nhất — vẫn không dùng
 *   được: project OAuth của clasp chưa bật, và bật bằng Service Usage API bị 403 "Permission
 *   denied to enable service", đã thử 17/08.) */
async function docSheet(id) {
  const at = await tokenClasp();
  try {
    const r = await fetch("https://docs.google.com/spreadsheets/d/" + id +
      "/gviz/tq?tqx=out:json&headers=0&sheet=" + encodeURIComponent(TAB), { headers: { authorization: "Bearer " + at } });
    if (r.ok) {
      const txt = await r.text();
      const i = txt.indexOf("{"), j = txt.lastIndexOf("}");
      if (i >= 0 && j > i) {
        const j2 = JSON.parse(txt.slice(i, j + 1));
        const bang = ((j2.table || {}).rows || []).map((rw) =>
          (rw.c || []).map((c) => (c && c.v != null ? String(c.f != null ? c.f : c.v) : "")));
        if (bang.length) return bang;
      }
    }
  } catch { /* gviz trục trặc → dùng export */ }
  const r2 = await fetch("https://www.googleapis.com/drive/v3/files/" + id + "/export?mimeType=text/csv",
    { headers: { authorization: "Bearer " + at } });
  if (!r2.ok) throw new Error("đọc Sheet lỗi HTTP " + r2.status + ": " + (await r2.text()).slice(0, 200));
  return tachCsv(await r2.text());
}

/* ---------- 1 lượt điền ---------- */
async function motLuot() {
  const tDoc = Date.now();
  const dong = await docSheet(sheetId);
  const msDoc = Date.now() - tDoc;
  if (!dong.length) return { cho: 0 };
  /* Drive export CSV chỉ trả TAB ĐẦU TIÊN. Nếu ai đó kéo tab khác lên đầu thì ta sẽ đọc nhầm bảng
     rồi ghi đè lên tab TRA-UID → dừng ngay, đừng đoán. */
  const th = (dong[0] || []).map((x) => String(x || "").trim());
  if (th[I_KHO] !== HEADER[I_KHO] || th[I_UID] !== HEADER[I_UID]) {
    throw new Error("bảng đọc được không đúng bố cục cột (thấy: " + th.slice(0, 3).join(" | ") + ") — cần " + HEADER.slice(0, 3).join(" | ") + ".");
  }
  const than = dong.slice(1).map((d) => {
    const r = [];
    for (let i = 0; i < HEADER.length; i++) r.push(String(d[i] == null ? "" : d[i]).trim());
    return r;
  });
  // dòng cần tra: có UID (cột B) và cột A còn trống | đang chờ | là câu báo lỗi cũ
  const canTra = [];
  for (const r of than) {
    const uid = r[I_UID].replace(/\s+/g, "").toUpperCase();
    if (!uid) continue;
    const kho = r[I_KHO];
    if (kho === KHONG_THAY) continue;           // đã tra rồi, thật sự không có → đừng hỏi lại mãi
    if (kho && kho !== CHO && !kho.startsWith("(")) continue;
    if (!canTra.includes(uid)) canTra.push(uid);
  }
  if (!canTra.length) return { cho: 0 };

  const token = await tokenWms();
  if (!token) { log("⚠ Không có token WMS sống — bỏ lượt này (không đăng nhập mới)."); return { cho: canTra.length, loi: true }; }
  const tWms = Date.now();
  let { records, soGoi, thieu, thatBai } = await traWms(canTra, token, { log: () => {} });
  /* Lô BỎ CUỘC (401 token chết / 500 ES chập chờn) → lấy token mới rồi thử lại ĐÚNG MỘT LẦN.
     Điều kiện là `thatBai`, KHÔNG phải "records rỗng": UID gõ sai cũng cho records rỗng, mà lúc
     đó đi xin token + hỏi lại là nhân đôi lượt gọi WMS một cách vô ích. */
  if (thatBai.length) {
    const tk2 = await tokenWms(true);
    if (tk2 && tk2 !== token) {
      const l2 = await traWms(thatBai, tk2, { log: () => {} });
      records = records.concat(l2.records); soGoi += l2.soGoi;
      const thay2 = new Set(l2.records.map((x) => String(x.uid)));
      thieu = thieu.filter((m) => !thay2.has(m));
      thatBai = l2.thatBai;
    }
  }
  const msWms = Date.now() - tWms;
  const map = thanhBang(records);
  const chuaHoiDuoc = new Set(thatBai);   // để nguyên ô, KHÔNG đóng dấu "(không thấy)"

  const rows = than.map((r) => {
    const loc = r[I_LOC] || "";                 // cột C: nhập tay → luôn giữ
    const uid = r[I_UID].replace(/\s+/g, "").toUpperCase();
    if (!uid) return ["", "", loc, "", "", "", ""];
    const k = map[uid];
    if (k) return [k.kho, r[I_UID], loc, k.sku, k.ten, k.tt, k.vt];
    if (chuaHoiDuoc.has(uid)) return ["", r[I_UID], loc, "", "", "", ""];   // chưa hỏi được → để trống, lượt sau tra lại
    if (canTra.includes(uid)) return [KHONG_THAY, r[I_UID], loc, "", "", "", ""];
    return r;                                   // dòng đã có kết quả từ trước: giữ nguyên
  });
  const tGhi = Date.now();
  const kq = await gasPost({ action: "syncTasks", key: KEY, sheetId, tab: TAB, header: HEADER, rows }, () => {}, "ghi TRA-UID");
  if (!kq || kq.status !== "success") { log("✗ ghi Sheet lỗi: " + JSON.stringify(kq).slice(0, 200)); return { cho: canTra.length, loi: true }; }
  const msGhi = Date.now() - tGhi;
  log("✓ điền " + canTra.length + " UID (" + (canTra.length - thieu.length) + " thấy, " +
    (thieu.length - chuaHoiDuoc.size) + " không thấy" + (chuaHoiDuoc.size ? ", " + chuaHoiDuoc.size + " CHƯA HỎI ĐƯỢC" : "") + ") · " +
    soGoi + " lượt WMS · tổng " + ((Date.now() - tDoc) / 1000).toFixed(1) + "s " +
    "(đọc Sheet " + (msDoc / 1000).toFixed(1) + "s · WMS " + (msWms / 1000).toFixed(1) + "s · ghi Sheet " + (msGhi / 1000).toFixed(1) + "s)");
  return { cho: canTra.length, loi: chuaHoiDuoc.size > 0 };
}

/* ================================ CÁC LỆNH ================================ */
if (argv.includes("--tao-script")) {
  if (!sheetId) { console.error("Thiếu SHEET_ID"); process.exit(1); }
  const at = await tokenClasp();
  const H = { authorization: "Bearer " + at, "content-type": "application/json" };
  const MANIFEST = {
    timeZone: "Asia/Ho_Chi_Minh", dependencies: {}, exceptionLogging: "STACKDRIVER", runtimeVersion: "V8",
    oauthScopes: [
      "https://www.googleapis.com/auth/spreadsheets.currentonly",   // chỉ chính file này
      "https://www.googleapis.com/auth/script.scriptapp",           // cài trigger onEdit
    ],
  };
  let scriptId = nho.scriptId || "";
  if (!scriptId) {
    const r = await fetch("https://script.googleapis.com/v1/projects", {
      method: "POST", headers: H, body: JSON.stringify({ title: "TRA UID — script gắn liền", parentId: sheetId }),
    });
    const j = await r.json();
    if (!j.scriptId) { console.error("✗ tạo script thất bại: " + JSON.stringify(j).slice(0, 400)); process.exit(2); }
    scriptId = j.scriptId; console.log("✓ đã tạo script gắn liền: " + scriptId);
  } else console.log("… script đã có: " + scriptId + " — cập nhật nội dung");
  const source = fs.readFileSync(NGUON_GS, "utf8");
  const r2 = await fetch("https://script.googleapis.com/v1/projects/" + scriptId + "/content", {
    method: "PUT", headers: H,
    body: JSON.stringify({ files: [
      { name: "appsscript", type: "JSON", source: JSON.stringify(MANIFEST, null, 2) },
      { name: "TraUid", type: "SERVER_JS", source },
    ] }),
  });
  const j2 = await r2.json();
  if (!j2.files) { console.error("✗ đẩy nội dung thất bại: " + JSON.stringify(j2).slice(0, 400)); process.exit(2); }
  nho.sheetId = sheetId; nho.scriptId = scriptId; luuNho();
  console.log("✓ đã đẩy " + j2.files.length + " tệp (" + source.length + " ký tự).");
  console.log("  https://docs.google.com/spreadsheets/d/" + sheetId + "/edit");
}

if (argv.includes("--nap")) {
  const tep = argv[argv.indexOf("--nap") + 2] || argv[argv.indexOf("--nap") + 1];
  if (!sheetId || !tep || !KEY) { console.error("Cách dùng: --nap <SHEET_ID> <tệp UID> (cần APPSCRIPT_KEY)"); process.exit(1); }
  const uids = fs.readFileSync(path.isAbsolute(tep) ? tep : path.join(DIR, tep), "utf8")
    .split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
  const kq = await gasPost({ action: "syncTasks", key: KEY, sheetId, tab: TAB, header: HEADER,
    rows: uids.map((u) => HEADER.map((_, i) => (i === I_UID ? u : ""))) }, () => {}, "nạp UID");
  if (!kq || kq.status !== "success") { console.error("✗ " + JSON.stringify(kq).slice(0, 300)); process.exit(2); }
  nho.sheetId = sheetId; luuNho();
  console.log("✓ đã nạp " + uids.length + " UID vào cột A.");
}

/* ---------- chuyển bảng CŨ (A=UID, B=SKU, C=Product, D=Warehouse, E=Trạng thái, F=Vị trí,
   G=Mã thùng) sang bố cục MỚI. Chạy 1 lần khi đổi bố cục, sau đó không cần nữa. ---------- */
if (argv.includes("--doi-bo-cuc")) {
  if (!sheetId || !KEY) { console.error("Thiếu SHEET_ID hoặc APPSCRIPT_KEY"); process.exit(1); }
  const dong = await docSheet(sheetId);
  const th = (dong[0] || []).map((x) => String(x || "").trim());
  if (th[0] === HEADER[0]) { console.log("… bảng đã ở bố cục mới, không đổi gì."); }
  else {
    const rows = dong.slice(1).map((d) => {
      const g = (i) => String(d[i] == null ? "" : d[i]).trim();
      return [g(3), g(0), g(6), g(1), g(2), g(4), g(5)];   // kho, uid, location(cũ: mã thùng), sku, tên, tt, vị trí
    }).filter((r) => r.some((x) => x));
    if (!rows.length) { console.error("✗ bảng cũ không có dòng nào"); process.exit(2); }
    const kq = await gasPost({ action: "syncTasks", key: KEY, sheetId, tab: TAB, header: HEADER, rows }, () => {}, "đổi bố cục");
    if (!kq || kq.status !== "success") { console.error("✗ " + JSON.stringify(kq).slice(0, 300)); process.exit(2); }
    console.log("✓ đã chuyển " + rows.length + " dòng sang bố cục mới (Warehouse · UID · Location · SKU · Product · Trạng thái · Vị trí).");
  }
}

if (argv.includes("--dien")) {
  if (!sheetId || !KEY) { console.error("Thiếu SHEET_ID hoặc APPSCRIPT_KEY"); process.exit(1); }
  /* KHOÁ CHỐNG CHẠY CHỒNG: bộ canh gọi mỗi 2 phút mà lượt canh ấm kéo dài tới 3 phút → hai lượt
     có thể giẫm chân nhau (đọc cùng lúc, ghi đè kết quả của nhau). Khoá cũ hơn 6 phút coi như
     tiến trình đã chết (máy tắt giữa chừng) thì bỏ qua. */
  const KHOA = path.join(DIR, ".tra-uid.lock");
  try {
    if (fs.existsSync(KHOA) && Date.now() - fs.statSync(KHOA).mtimeMs < 6 * 60 * 1000) process.exit(0);
  } catch { /* không đọc được khoá → cứ chạy */ }
  try { fs.writeFileSync(KHOA, String(process.pid)); } catch { /* best-effort */ }
  const goKhoa = () => { try { fs.rmSync(KHOA, { force: true }); } catch { /* best-effort */ } };
  process.on("exit", goKhoa);
  process.on("SIGINT", () => { goKhoa(); process.exit(0); });
  nho.sheetId = sheetId; luuNho();
  /* NHỊP CANH (đo & chỉnh 17/08/2026 — xem chú thích "tốc độ" đầu tệp):
     · Lượt đầu luôn đọc bảng thật (không có mốc để so).
     · Các nhịp sau chỉ hỏi MỐC SỬA ĐỔI của file (~0,2s); mốc y nguyên ⇒ chưa ai gõ ⇒ ngủ tiếp.
       Nhờ vậy nhịp rút từ 15 giây xuống 4 giây mà vẫn nhẹ hơn trước.
     · Ở lại tới hết --loop phút RỒI THOÁT (không thoát sớm khi rảnh): Task Scheduler gọi lại mỗi
       phút nên các lượt nối đuôi nhau → gần như canh liên tục, người gõ UID thấy kết quả sau ~5s
       thay vì phải chờ tới nhịp task kế tiếp. Thoát trước nhịp kế (0.85' = 51s) để khoá không
       chặn lượt mới. */
  const phut = Number(lay("--loop") || 0);
  const hetLuc = Date.now() + phut * 60000;
  const NHIP_MS = 3000;
  for (;;) {
    let kq = null;
    try { kq = await motLuot(); }
    catch (e) { log("✗ " + (e && e.message ? e.message : e)); kq = { loi: true }; }
    if (!phut || Date.now() >= hetLuc) break;
    /* LỖI (không có token sống / WMS bỏ cuộc) → NGHỈ DÀI 60 giây. Không có nhánh này thì dòng vẫn
       "đang chờ" ⇒ vòng canh 3 giây lại gọi WMS ngay ⇒ 20 lượt/phút đập vào WMS suốt lúc hệ thống
       đang sự cố — đúng thứ phải tránh nhất. Nghỉ 60s > 51s tuổi của một lượt canh, nên thực tế là
       "thôi, để nhịp task sau lo": tối đa 1 lượt thử/phút khi đang lỗi. */
    if (kq && kq.loi) {
      log("… tạm nghỉ 60 giây trước khi thử lại (chưa hỏi được WMS).");
      const den = Date.now() + 60000;
      while (Date.now() < den && Date.now() < hetLuc) await nghi(3000);
      if (Date.now() >= hetLuc) break;
      continue;
    }
    for (;;) {                                  // ngủ + đếm dòng chờ, thấy việc là bật dậy
      await nghi(NHIP_MS);
      if (Date.now() >= hetLuc) break;
      let n = 0;
      try { n = await demCho(sheetId); } catch { n = -1; }
      if (n !== 0) break;                       // >0 = có việc · -1 = hỏi lỗi, cứ đọc bảng cho chắc
    }
    if (Date.now() >= hetLuc) break;
  }
  process.exit(0);
}

if (!argv.length) console.log("node tra-uid-sheet.mjs --dien [--loop 5] | --tao-script <ID> | --nap <ID> <tệp>");
