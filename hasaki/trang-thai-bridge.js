/**
 * trang-thai-bridge.js — ĐỌC TRẠNG THÁI CẦU NỐI (extension) TỪ CHÍNH PROFILE EDGE (11/08/2026).
 *
 *  VÌ SAO CÓ FILE NÀY — sự cố 11/08/2026:
 *  Edge đã TẮT extension `factory/wms-bridge` (nạp kiểu unpacked, mà Chế độ nhà phát triển thì
 *  Edge có quyền tắt bất cứ lúc nào). Hệ quả: 13:03 token WMS bị thu hồi → bridge KHÔNG có ai
 *  nghe token → poller quay vòng "chưa có token phiên sống" suốt 5 tiếng. Người chỉ phát hiện khi
 *  mở dashboard thấy giờ cũ. Không một cảm biến nào biết, vì `canh-suc-khoe.js` chỉ đo tuổi mốc
 *  với ngưỡng 26 giờ — trễ 5 tiếng vẫn "ok".
 *
 *  Bài học: cầu nối là mắt xích DUY NHẤT không nằm trong code mình (nó nằm trong trình duyệt của
 *  người dùng), nên phải soi nó từ bên ngoài. Edge ghi trạng thái extension vào file JSON trong
 *  profile — đọc thẳng file đó là biết bật/tắt, không cần trình duyệt hợp tác.
 *
 *  CHỈ ĐỌC — không sửa file profile. `Secure Preferences` có MAC chữ ký: sửa ngoài Edge thì Edge
 *  coi là hỏng và reset luôn entry, hại hơn lợi. Muốn extension không tắt được nữa thì GHIM bằng
 *  policy (xem `factory/wms-bridge/ghim-extension.mjs`), chứ không phải sửa prefs.
 */
import fs from "node:fs";
import path from "node:path";

/* Nhận ra extension của mình: unpacked thì cứ nhìn đường dẫn folder; bản .crx đã ghim thì prefs
 * không còn đường dẫn nguồn nên nhìn tên trong manifest. Khai cả hai để không lệ thuộc kiểu nạp. */
const DAU_HIEU_DUONG_DAN = /wms-bridge/i;
const DAU_HIEU_TEN = /WMS Token Bridge/i;

/* Manifest::Location của Chromium — con số này quyết định "người dùng có tắt được không":
 *   4 = UNPACKED (Load unpacked)            → tắt được, và Edge tự tắt khi dev mode off (bẫy 11/08)
 *   7 = EXTERNAL_POLICY_DOWNLOAD, 9 = EXTERNAL_POLICY → do policy ghim, KHÔNG tắt được bằng tay */
const VT_UNPACKED = 4;
const VT_POLICY = [7, 9];

const docJsonNhe = (f) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } };

/** Các profile Edge trên máy (Default, Profile 1, …). Không có Edge → mảng rỗng. */
function cacHoSo() {
  const goc = process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Microsoft", "Edge", "User Data");
  if (!goc) return [];
  try {
    return fs.readdirSync(goc, { withFileTypes: true })
      .filter((d) => d.isDirectory() && (d.name === "Default" || /^Profile /.test(d.name)))
      .map((d) => path.join(goc, d.name));
  } catch { return []; }
}

/** Tìm entry extension của mình trong một bộ `extensions.settings`. */
function timEntry(settings) {
  if (!settings || typeof settings !== "object") return null;
  for (const [id, v] of Object.entries(settings)) {
    if (!v || typeof v !== "object") continue;
    const duongDan = String(v.path || "");
    const ten = String((v.manifest && v.manifest.name) || "");
    if (DAU_HIEU_DUONG_DAN.test(duongDan) || DAU_HIEU_TEN.test(ten)) return { id, ...v };
  }
  return null;
}

/* Bật/tắt đọc thế nào: `state: 1` = bật, `0` = tắt — NHƯNG bản Edge trên máy này KHÔNG ghi
 * `state` khi extension đang bật (đã kiểm 11/08: lúc bị tắt có `disable_reasons:[1]`, bật lại thì
 * trường đó biến mất). Nên tín hiệu đáng tin là disable_reasons, `state` chỉ dùng để chốt thêm. */
function dangBat(e) {
  if (!e) return false;
  if (Array.isArray(e.disable_reasons) && e.disable_reasons.length) return false;
  if (e.state === 0) return false;
  return true;
}

/* disable_reasons là cờ bit của Chromium — dịch mấy mã hay gặp để thư gửi người non-tech đọc hiểu. */
const LY_DO = { 1: "bị tắt bằng tay (hoặc Edge tắt vì Chế độ nhà phát triển đã off)", 2: "chờ chấp nhận quyền mới", 4: "cần Reload", 128: "file extension bị hỏng", 4096: "bị policy chặn" };
const dichLyDo = (ds) => (Array.isArray(ds) ? ds : []).map((n) => LY_DO[n] || "mã " + n).join("; ");

/**
 * Trạng thái cầu nối, đọc từ profile Edge.
 *
 * @returns {{coEdge:boolean, coCai:boolean, bat:boolean, ghim:boolean, unpacked:boolean,
 *            devMode:boolean, id:string, hoSo:string, duongDan:string, prefsLuc:number,
 *            lyDoTat:string, on:boolean, vi:string}}
 *   `on`  = cầu nối đang thực sự chạy được (đã cài + đang bật) — cảm biến chỉ cần nhìn cờ này.
 *   `vi`  = một câu tiếng Việt để nhét thẳng vào log/thư.
 */
export function docTrangThaiExt() {
  const hoSos = cacHoSo();
  if (!hoSos.length) {
    return { coEdge: false, coCai: false, bat: false, ghim: false, unpacked: false, devMode: false, id: "", hoSo: "", duongDan: "", prefsLuc: 0, lyDoTat: "", on: false, vi: "không thấy profile Edge trên máy — không kết luận được" };
  }

  const thay = [];
  for (const hs of hoSos) {
    const devMode = !!((docJsonNhe(path.join(hs, "Preferences")) || {}).extensions?.ui?.developer_mode);
    for (const ten of ["Secure Preferences", "Preferences"]) {
      const f = path.join(hs, ten);
      const j = docJsonNhe(f);
      const e = timEntry(j && j.extensions && j.extensions.settings);
      if (!e) continue;
      let prefsLuc = 0;
      try { prefsLuc = fs.statSync(f).mtimeMs; } catch { /* không quan trọng */ }
      const viTri = Number(e.location || 0);
      thay.push({
        coEdge: true, coCai: true, bat: dangBat(e), ghim: VT_POLICY.includes(viTri), unpacked: viTri === VT_UNPACKED,
        devMode, id: e.id, hoSo: path.basename(hs), duongDan: String(e.path || ""), prefsLuc,
        lyDoTat: dichLyDo(e.disable_reasons),
      });
    }
  }

  if (!thay.length) {
    return { coEdge: true, coCai: false, bat: false, ghim: false, unpacked: false, devMode: false, id: "", hoSo: "", duongDan: "", prefsLuc: 0, lyDoTat: "", on: false, vi: "CHƯA CÀI vào Edge — không ai nghe token phiên" };
  }

  // Nhiều profile/nhiều bản ghi: bản ĐANG BẬT là bản nói thật (chỉ cần một chỗ chạy là bridge có).
  const tt = thay.find((x) => x.bat && x.ghim) || thay.find((x) => x.bat) || thay[0];
  tt.on = tt.bat;
  tt.vi = tt.bat
    ? "đang bật" + (tt.ghim ? " và ĐÃ GHIM bằng policy (Edge không tắt được)" : tt.unpacked ? " nhưng nạp kiểu unpacked — Edge có thể tự tắt lại (nên ghim)" : "")
    : "ĐANG BỊ TẮT" + (tt.lyDoTat ? " — " + tt.lyDoTat : "");
  return tt;
}

/** Một dòng gọn cho log. */
export function moTaExt(tt = docTrangThaiExt()) {
  return "cầu nối WMS: " + tt.vi + (tt.hoSo ? " (profile " + tt.hoSo + ")" : "");
}
