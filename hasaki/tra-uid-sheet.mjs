/**
 * tra-uid-sheet.mjs — MÁY TRẠM phục vụ file Google Sheet "TRA UID - Ton kho WMS".
 *
 *   node tra-uid-sheet.mjs --dien [--loop 5]    điền kho/SKU/tên cho các dòng đang chờ
 *                                               (--loop N: ở lại canh N phút, nhịp 3 giây)
 *   node tra-uid-sheet.mjs --tao-script <ID>    đẩy sheet-tra-uid.gs lên script gắn liền file
 *   node tra-uid-sheet.mjs --nap <ID> uids.txt  nạp sẵn danh sách UID vào cột B
 *   node tra-uid-sheet.mjs --doi-bo-cuc <ID>    xếp lại bảng bị lệch cột về bố cục hiện hành
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
/* BỐ CỤC CỘT (chốt 21/08/2026 — người dùng thêm cột ID ở đầu bảng):
 *   A ID (nhập tay, máy KHÔNG BAO GIỜ đè) · B UID (nhập) · C Location (nhập tay, máy KHÔNG BAO GIỜ
 *   đè) · D SKU (kết quả đầu tiên, cũng là ô báo "⏳ đang tra…") · E Product Name · F Trạng thái ·
 *   G Vị trí (bin) · H Warehouse Name.
 * ⚠ 18/08/2026: có người chèn 1 cột ở đầu bảng mà 2 tệp code vẫn giữ bố cục cũ ⇒ chốt bố cục ở
 *   dưới chặn cứng và bộ điền ĐỨNG IM 3.699 lượt (≈2,5 ngày) mà không ai hay. Đổi bố cục bảng thì
 *   phải sửa CẢ tệp này + sheet-tra-uid.gs (rồi --tao-script để đẩy lại), xong soi tra-uid.log. */
const HEADER = ["ID", "UID", "Location", "SKU", "Product Name", "Trạng thái", "Vị trí (bin)", "Warehouse Name"];
const I_ID = 0, I_UID = 1, I_LOC = 2, I_MOC = 3;   // chỉ số trong mảng dòng (I_MOC = ô SKU = ô báo "đang tra")
const CHO = "⏳ đang tra…";
const KHONG_THAY = "(không thấy)";
const LA_UID = /^VN\d{6,}$/i;   // mọi UID của WMS đều là "VN" + chuỗi số (đối chứng mau-500-uid.txt: 500/500)

/* ĐỪNG TIN DÒNG TIÊU ĐỀ — bài học 21/08/2026 (đã mất dữ liệu thật):
 * Người dùng chèn 1 cột vào đầu bảng rồi TỰ GÕ LẠI tiêu đề "ID | UID | Location", còn dữ liệu bên
 * dưới vẫn lệch phải 1 ô. Chốt bố cục chỉ so tiêu đề nên PASS, lượt điền đọc TÊN KHO ở cột B như
 * thể là UID, WMS không thấy → ghi "(không thấy)" đè lên 639 dòng SKU/tên/trạng thái/bin.
 * ⇒ phải soi CHÍNH DỮ LIỆU: mã VN… phải ở cột B (không phải C), tên kho (có " - ") phải ở cột H. */
function lechCot(dong) {
  const b = dong.slice(1);
  const demUid = (i) => b.filter((d) => LA_UID.test(String(d[i] || "").trim())).length;
  const demKho = (i) => b.filter((d) => String(d[i] || "").includes(" - ")).length;
  return demUid(I_LOC) > demUid(I_UID) || demKho(I_UID) > demKho(HEADER.length - 1);
}
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
  const tq = "select count(B) where B is not null and (D is null or D starts with '⏳')";
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
  /* Ô tiêu đề RỖNG thì ĐỪNG kết luận sai: gviz suy kiểu cột từ dữ liệu, cột toàn số (như SKU) trả
     ô tiêu đề = "" dù trong Sheet vẫn ghi "SKU" (đo 21/08/2026). Chốt cứng "phải khớp cả 3" từng
     làm bộ điền đứng im 2,5 ngày, nên nay: chỉ chặn khi có ô tiêu đề ghi KHÁC (dấu hiệu đọc nhầm
     tab), và phải còn ít nhất 1 ô khớp. Bố cục lệch đã có lechCot() canh bằng chính dữ liệu. */
  const oSai = [I_ID, I_UID, I_LOC].filter((i) => th[i] && th[i] !== HEADER[i]);
  const oKhop = [I_ID, I_UID, I_LOC].filter((i) => th[i] === HEADER[i]);
  if (oSai.length || !oKhop.length) {
    throw new Error("bảng đọc được không đúng bố cục cột (thấy: " + th.slice(0, 3).join(" | ") + ") — cần " +
      HEADER.slice(0, 3).join(" | ") + ". Bảng vừa thêm/bớt cột? chạy: node tra-uid-sheet.mjs --doi-bo-cuc <SHEET_ID>");
  }
  if (lechCot(dong)) {
    throw new Error("bảng LỆCH CỘT: mã UID đang ở cột C và/hoặc tên kho ở cột B (tiêu đề đúng nhưng dữ liệu lệch, " +
      "thường do vừa chèn/xoá cột). KHÔNG ghi gì để không xoá mất dữ liệu; chạy: node tra-uid-sheet.mjs --doi-bo-cuc <SHEET_ID>");
  }
  const than = dong.slice(1).map((d) => {
    const r = [];
    for (let i = 0; i < HEADER.length; i++) r.push(String(d[i] == null ? "" : d[i]).trim());
    return r;
  });
  // dòng cần tra: có UID (cột B) và ô mốc (cột D = SKU) còn trống | đang chờ | là câu báo lỗi cũ
  const canTra = [];
  for (const r of than) {
    const uid = r[I_UID].replace(/\s+/g, "").toUpperCase();
    if (!uid) continue;
    /* Ô UID chứa thứ khác (tên kho, ghi chú, tiêu đề dán lẫn…) → KHÔNG hỏi WMS. Bản cũ hỏi tất, nên
       một lần lệch cột là 9 lượt gọi WMS vô ích + 639 dòng bị đóng dấu "(không thấy)". */
    if (!LA_UID.test(uid)) continue;
    const moc = r[I_MOC];
    if (moc === KHONG_THAY) continue;           // đã tra rồi, thật sự không có → đừng hỏi lại mãi
    if (moc && moc !== CHO && !moc.startsWith("(")) continue;
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
    const id = r[I_ID] || "";                   // cột A: nhập tay → luôn giữ
    const loc = r[I_LOC] || "";                 // cột C: nhập tay → luôn giữ
    const uid = r[I_UID].replace(/\s+/g, "").toUpperCase();
    /* DÒNG KHÔNG CÓ UID → GIỮ NGUYÊN. Bản cũ xoá trắng (chỉ chừa Location) vì bảng ngày ấy chỉ có
       dòng tra UID; nay bảng còn hàng trăm dòng người dùng DÁN TAY từ báo cáo WMS (có SKU/kho mà
       không có UID) — xoá trắng là nuốt sạch dữ liệu của họ. */
    if (!uid || !LA_UID.test(uid)) return r;
    const k = map[uid];
    if (k) return [id, r[I_UID], loc, k.sku, k.ten, k.tt, k.vt, k.kho];
    /* CHƯA HỎI ĐƯỢC WMS (401/500) → GIỮ NGUYÊN CẢ DÒNG, đừng xoá. Bản cũ xoá trắng D..H để lượt
       sau tra lại; với bảng có dữ liệu dán tay thì một cú 500 của WMS là mất dữ liệu thật. Ô mốc
       vẫn đang là "⏳" (hoặc trống) nên lượt sau tự tra lại. */
    if (chuaHoiDuoc.has(uid)) return r;
    if (canTra.includes(uid)) return [id, r[I_UID], loc, KHONG_THAY, "", "", "", ""];
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
  console.log("✓ đã nạp " + uids.length + " UID vào cột B.");
}

/* ---------- ĐƯA BẢNG BỊ LỆCH CỘT VỀ BỐ CỤC MỚI (chạy 1 lần, 21/08/2026) ----------
   Bảng đang ở bố cục 17/08 BỊ ĐẨY PHẢI 1 Ô vì có người chèn cột ID vào đầu:
     A ID(mới) · B Warehouse · C UID · D Location · E SKU · F Product · G Trạng thái · H Vị trí
   ⇒ xếp lại thành: A ID · B UID · C Location · D SKU · E Product · F Trạng thái · G Vị trí · H Warehouse.
   Ô "(không thấy)" đang nằm ở cột kho được dời về ô mốc (D) cho đúng nghĩa. ---------- */
if (argv.includes("--doi-bo-cuc")) {
  if (!sheetId || !KEY) { console.error("Thiếu SHEET_ID hoặc APPSCRIPT_KEY"); process.exit(1); }
  const dong = await docSheet(sheetId);
  const th = (dong[0] || []).map((x) => String(x || "").trim());
  if (!lechCot(dong) && th[I_ID] === HEADER[I_ID] && th[I_UID] === HEADER[I_UID] && th[I_LOC] === HEADER[I_LOC]) {
    console.log("… bảng đã ở bố cục mới, không đổi gì.");
  } else {
    const rows = dong.slice(1).map((d) => {
      const g = (i) => String(d[i] == null ? "" : d[i]).trim();
      const kho = g(1), sku = g(4), khongThay = kho === KHONG_THAY;
      return [g(0), g(2), g(3), khongThay && !sku ? KHONG_THAY : sku, g(5), g(6), g(7), khongThay ? "" : kho];
    }).filter((r) => r.some((x) => x));
    if (!rows.length) { console.error("✗ bảng cũ không có dòng nào"); process.exit(2); }
    const coUid = rows.filter((r) => r[I_UID]).length;
    console.log("… xếp lại " + rows.length + " dòng (" + coUid + " dòng có UID) — mẫu dòng đầu: " + JSON.stringify(rows[0]));
    const kq = await gasPost({ action: "syncTasks", key: KEY, sheetId, tab: TAB, header: HEADER, rows }, () => {}, "đổi bố cục");
    if (!kq || kq.status !== "success") { console.error("✗ " + JSON.stringify(kq).slice(0, 300)); process.exit(2); }
    console.log("✓ đã chuyển " + rows.length + " dòng sang bố cục mới (" + HEADER.join(" · ") + ").");
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
  /* 10s thay 3s (audit 23/08/2026): nhịp 3s × 51s/lượt × task mỗi phút ≈ 24.000 lượt hỏi/ngày cho
     một bảng thường TRỐNG. 10s vẫn đủ "gõ UID thấy kết quả trong ~10-15s" — người tra chấp nhận
     được, còn tải nền giảm 3,3×. */
  const NHIP_MS = 10000;
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
