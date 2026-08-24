/**
 * qc-otp-cap-quyen.mjs — KIỂM LUỒNG CẤP QUYỀN BẰNG OTP 4 SỐ (24/08/2026)
 * ==========================================================================================
 *  Cách làm: CẮT nguyên khối `tb*` từ `hasaki/google-script.gs` rồi chạy trong Node với
 *  PropertiesService/CacheService/UrlFetchApp/Utilities GIẢ — test và bản chạy thật dùng CHUNG
 *  một bản mã, không có bản sao nào để lệch nhau (cùng lối với qc-in-tem.mjs).
 *
 *  Vì sao phải có bộ này: OTP 4 số = 10.000 khả năng. Toàn bộ an toàn nằm ở mấy cái chốt nhỏ —
 *  mã gắn ĐÚNG một máy, dùng MỘT LẦN, 5 lần sai là chết, 10' mới xin lại, trần ngày, cửa mạng
 *  công ty. Sai một chốt là mở cửa cho người ngoài. Không có cái nào kiểm được bằng mắt.
 *
 *  Chạy: node hasaki/qc-otp-cap-quyen.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const NGUON = fs.readFileSync(path.join(DIR, "google-script.gs"), "utf8");

/* ── Cắt khối thật: từ tbKhoaCauHinh_ đến hết apiTbDuyet_ ─────────────────────────────────── */
const iBatDau = NGUON.indexOf("function tbKhoaCauHinh_()");
const iKetThuc = NGUON.indexOf("// Chống brute-force PIN");
if (iBatDau < 0 || iKetThuc < 0 || iKetThuc < iBatDau) {
  console.error("✗ Không cắt được khối tb* trong google-script.gs (mốc đã đổi?) — sửa bộ đo này.");
  process.exit(2);
}
const KHOI = NGUON.slice(iBatDau, iKetThuc);

/* ── Sân giả cho Apps Script ─────────────────────────────────────────────────────────────── */
function dungSan(tele) {   // tele = { token, chat } — hằng do deploy-gas.mjs chèn; mặc định là placeholder
  /* Mặc định CÓ cấu hình Telegram để mọi ca đều soi được nội dung tin; ca "chưa cấu hình" tự xoá. */
  const props = { TELEGRAM_BOT_TOKEN: "tok-gia", TELEGRAM_CHAT_ID: "999" };
  const cache = {};
  const teleGui = [];
  const PropertiesService = {
    getScriptProperties: () => ({
      getProperty: (k) => (k in props ? props[k] : null),
      setProperty: (k, v) => { props[k] = String(v); },
    }),
  };
  const CacheService = {
    getScriptCache: () => ({
      get: (k) => (k in cache ? cache[k] : null),
      put: (k, v) => { cache[k] = String(v); },
      remove: (k) => { delete cache[k]; },
    }),
  };
  const UrlFetchApp = {
    fetch: (url, opt) => { teleGui.push({ url, text: String((opt && opt.payload && opt.payload.text) || "") }); return { getContentText: () => "{}" }; },
  };
  /* formatDate GIẢ phải tôn trọng khuôn: 'yyyyMMdd' là KHOÁ NGÀY của 2 bộ đếm trần (TB_XIN_DEM,
     TB_OTP_SAI_NGAY). Stub trả hằng "12:00 24/08" cho mọi khuôn thì khoá ngày không khớp ⇒ bộ đếm
     tự reset mỗi lượt và bài đo trần ngày thành vô nghĩa (đã dính 24/08). */
  const NGAY_GIA = "20260824";
  const Utilities = { formatDate: (d, tz, khuon) => (khuon === "yyyyMMdd" ? NGAY_GIA : "12:00 24/08") };
  const phanHoiJson = (o) => o;                       // trả thẳng object cho dễ soi
  const keyBodyOK_ = (d) => String((d && d.key) || "") === "SECRET-GIA";

  /* TELE_TOKEN/TELE_CHAT khai ở ĐẦU google-script.gs (ngoài khối tb*), nên phải truyền vào sân giả.
     Không truyền thì `tbBaoTele_` ném ReferenceError, bị try/catch của chính nó ăn mất và trả false
     — bài đo "chưa cấu hình thì im lặng" sẽ XANH VÌ LÝ DO SAI. Đã dính đúng chỗ này 24/08. */
  const T = tele || {};
  const fn = new Function(
    "PropertiesService", "CacheService", "UrlFetchApp", "Utilities", "phanHoiJson", "keyBodyOK_",
    "TELE_TOKEN", "TELE_CHAT",
    KHOI + "\nreturn { tbOK_, tbTuChoi_, tbDuyetCo_, tbIpDuocPhep_, apiTbIp_, apiTbXin_, apiTbTra_, apiTbOtp_, apiTbDuyet_, tbOtpSinh_ };"
  );
  const api = fn(PropertiesService, CacheService, UrlFetchApp, Utilities, phanHoiJson, keyBodyOK_,
    T.token || "DAT_TELEGRAM_BOT_TOKEN_O_DAY", T.chat || "DAT_TELEGRAM_CHAT_ID_O_DAY");
  const doc = (k) => { try { return JSON.parse(props[k] || "{}"); } catch { return {}; } };
  const ghi = (k, v) => { props[k] = JSON.stringify(v); };
  return { api, props, cache, teleGui, doc, ghi };
}

/* ── Khung chấm ──────────────────────────────────────────────────────────────────────────── */
let dat = 0, hong = 0;
const ktra = (ten, dung, gc = "") => {
  if (dung) { console.log("  ✓ " + ten + (gc ? "  — " + gc : "")); dat++; }
  else { console.log("  ✗ " + ten + (gc ? "  — " + gc : "")); hong++; }
};
const MAY = "m" + "abc123xyz";          // hợp định dạng ^m[a-z0-9]{7,19}$
const MAY2 = "m" + "def456uvw";
const IP_KHO = "14.224.224.243";
const IP_LA = "203.0.113.77";
const layOtp = (teleGui) => {
  const t = teleGui.map((x) => x.text).reverse().find((x) => /MÃ OTP CẤP QUYỀN|Mã: \d{4}/.test(x)) || "";
  const m = t.match(/Mã: (\d{4})|Mã: (\d{4})/);
  return m ? (m[1] || m[2]) : "";
};

/* =========================================================================================
   A. CỬA MẠNG CÔNG TY
   ========================================================================================= */
console.log("A. Cửa mạng công ty (chỉ Wi-Fi công ty mới xin được mã)");
{
  const s = dungSan();
  s.props.DEVICE_KEY = "KHOA-CHUNG-123";
  const r = s.api.apiTbXin_({ tb: MAY, ten: "Tâm · kho", ip: IP_LA, trang: "factory" });
  ktra("Chưa có IP mẫu nào (ngày đầu rollout) → VẪN cho xin, không dead-end", r.choOtp === 1, JSON.stringify(r.status));
  ktra("…nhưng tin Telegram phải ĐÁNH DẤU chưa đối chiếu được mạng",
    /CHƯA ĐỐI CHIẾU|CHƯA ĐỐI CHIẾU/.test(s.teleGui.map((x) => x.text).join("|")));
}
{
  const s = dungSan();
  s.props.DEVICE_KEY = "K"; s.props.WIFI_IP_ALLOW = IP_KHO;
  const ok = s.api.apiTbXin_({ tb: MAY, ten: "A · kho", ip: IP_KHO });
  ktra("WIFI_IP_ALLOW khớp CHÍNH XÁC → cho xin", ok.choOtp === 1);
  ktra("…tin Telegram ghi ✓ mạng công ty", /mạng công ty|mạng công ty/.test(s.teleGui[0].text));
}
{
  const s = dungSan();
  s.props.DEVICE_KEY = "K"; s.props.WIFI_IP_ALLOW = "14.224.";
  const ok = s.api.apiTbXin_({ tb: MAY, ten: "A · kho", ip: IP_KHO });
  ktra("WIFI_IP_ALLOW kiểu TIỀN TỐ '14.224.' → khớp (IP nhà mạng đổi động vẫn sống)", ok.choOtp === 1);
}
{
  const s = dungSan();
  s.props.DEVICE_KEY = "K"; s.props.WIFI_IP_ALLOW = IP_KHO;
  const r = s.api.apiTbXin_({ tb: MAY, ten: "Người lạ", ip: IP_LA });
  ktra("Có mẫu mà IP LẠ (4G/ở nhà) → TỪ CHỐI", r.ngoaiMang === 1 && r.status === "error", r.message);
  ktra("…và KHÔNG bắn tin cho quản trị (khỏi spam)", s.teleGui.length === 0, s.teleGui.length + " tin");
  ktra("…và KHÔNG sinh mã nào", Object.keys(s.doc("TB_OTP")).length === 0);
}
{
  const s = dungSan();
  s.props.DEVICE_KEY = "K"; s.props.WIFI_IP_ALLOW = IP_KHO;
  const r = s.api.apiTbXin_({ tb: MAY, ten: "A · kho", ip: "" });
  ktra("Trang không đọc được IP mà đang có mẫu → TỪ CHỐI (không cho lách bằng bỏ trống)", r.ngoaiMang === 1);
}
{
  const s = dungSan();
  s.props.DEVICE_KEY = "K";
  s.ghi("TB_IP_OK", { [IP_KHO]: { luc: new Date().toISOString(), tb: "mabc1234" } });
  const r = s.api.apiTbXin_({ tb: MAY2, ten: "B · kho", ip: IP_KHO });
  ktra("Sổ IP TỰ HỌC: máy mới cùng IP với máy đã duyệt → cho xin", r.choOtp === 1);
  const r2 = s.api.apiTbXin_({ tb: MAY, ten: "C · nhà", ip: IP_LA });
  ktra("…IP khác sổ → từ chối", r2.ngoaiMang === 1);
}
{
  const s = dungSan();
  s.props.DEVICE_KEY = "K";
  const cu = new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString();
  s.ghi("TB_IP_OK", { [IP_KHO]: { luc: cu, tb: "mabc1234" } });
  const r = s.api.apiTbXin_({ tb: MAY, ten: "A · kho", ip: IP_KHO });
  ktra("IP trong sổ nhưng CŨ hơn 14 ngày → hết hiệu lực, từ chối", r.ngoaiMang === 1, "luc=" + cu.slice(0, 10));
}

/* =========================================================================================
   B. SỔ IP TỰ HỌC (action tb_ip)
   ========================================================================================= */
console.log("\nB. Sổ IP tự học — chống kẻ lạ tự hợp lệ hoá chính mình");
{
  const s = dungSan();
  s.props.DEVICE_KEY = "K";
  const r = s.api.apiTbIp_({ tb: MAY, ip: IP_LA });
  ktra("Máy CHƯA duyệt gọi tb_ip → 403", r.code === 403, r.message);
  ktra("…sổ IP không hề đổi", Object.keys(s.doc("TB_IP_OK")).length === 0);
}
{
  const s = dungSan();
  s.props.DEVICE_KEY = "K";
  s.ghi("TB_DUYET", { [MAY]: { ten: "A", luc: new Date().toISOString() } });
  const r = s.api.apiTbIp_({ tb: MAY, ip: IP_KHO });
  ktra("Máy ĐÃ duyệt gọi tb_ip → ghi vào sổ", r.status === "success" && !!s.doc("TB_IP_OK")[IP_KHO]);
  const r2 = s.api.apiTbIp_({ tb: "KHONG-PHAI-MAY", key: "SECRET-GIA", ip: "1.2.3.4" });
  ktra("Máy trạm (có SECRET) cũng ghi được", r2.status === "success" && !!s.doc("TB_IP_OK")["1.2.3.4"]);
  const r3 = s.api.apiTbIp_({ tb: MAY, ip: "khong-phai-ip!!" });
  ktra("IP rác → từ chối, không nhồi vào sổ", r3.status === "error" && !s.doc("TB_IP_OK")["khong-phai-ip!!"]);
}
{
  const s = dungSan();
  s.props.DEVICE_KEY = "K";
  s.ghi("TB_DUYET", { [MAY]: { ten: "A", luc: new Date().toISOString() } });
  for (let i = 0; i < 25; i++) s.api.apiTbIp_({ tb: MAY, ip: "10.0.0." + i });
  const so = s.doc("TB_IP_OK");
  ktra("Sổ IP có TRẦN 20 (không phình Script Properties)", Object.keys(so).length === 20, Object.keys(so).length + " IP");
  ktra("…và rụng IP CŨ NHẤT, giữ mới nhất", !so["10.0.0.0"] && !!so["10.0.0.24"]);
}

/* =========================================================================================
   C. OTP: sinh · dùng một lần · gắn đúng máy · chống dò
   ========================================================================================= */
console.log("\nC. OTP 4 số");
{
  const s = dungSan();
  s.props.DEVICE_KEY = "K"; s.props.WIFI_IP_ALLOW = IP_KHO;
  const r = s.api.apiTbXin_({ tb: MAY, ten: "Lê Chí Tâm · kho", ip: IP_KHO, trang: "kiemsoatkho" });
  const otp = layOtp(s.teleGui);
  ktra("Xin mã → có bắn Telegram và tin CHỨA mã 4 số", /^\d{4}$/.test(otp), "mã = " + otp);
  ktra("…GAS gọi ĐÚNG api.telegram.org (không qua laptop)", /api\.telegram\.org/.test(s.teleGui[0].url));
  ktra("…phản hồi cho trang là choOtp + guiTele=1", r.choOtp === 1 && r.guiTele === 1);
  const g = s.doc("TB_OTP")[MAY];
  ktra("…mã lưu kèm hạn 60' và bộ đếm sai = 0", !!g && g.sai === 0 && g.het - Date.now() > 55 * 60 * 1000);

  const sai = s.api.apiTbOtp_({ tb: MAY, otp: otp === "0000" ? "1111" : "0000" });
  ktra("Gõ sai → báo còn mấy lần thử, KHÔNG cấp quyền", sai.sai === 1 && !s.api.tbDuyetCo_(MAY), sai.message);

  const dung = s.api.apiTbOtp_({ tb: MAY, otp });
  ktra("Gõ ĐÚNG → cấp quyền ngay cho đúng máy đó", dung.duyet === 1 && s.api.tbDuyetCo_(MAY));
  ktra("…mã bị xoá (DÙNG MỘT LẦN)", !s.doc("TB_OTP")[MAY]);
  ktra("…sổ chờ hết dòng của máy này", !s.doc("TB_CHO")[MAY]);
  ktra("…có bắn tin 'đã kích hoạt' để quản trị biết", /KÍCH HOẠT|KÍCH HOẠT/.test(s.teleGui.map((x) => x.text).join("|")));

  const lai = s.api.apiTbOtp_({ tb: MAY2, otp });
  ktra("Mã đã dùng → máy KHÁC gõ lại không được", lai.duyet !== 1 && !s.api.tbDuyetCo_(MAY2), lai.message);
}
{
  const s = dungSan();
  s.props.DEVICE_KEY = "K";
  s.api.apiTbXin_({ tb: MAY, ten: "A · kho", ip: IP_KHO });
  const otp = layOtp(s.teleGui);
  const cheo = s.api.apiTbOtp_({ tb: MAY2, otp });
  ktra("Mã của máy A KHÔNG dùng được cho máy B (gắn đúng một máy)", cheo.duyet !== 1 && cheo.hetHan === 1, cheo.message);
  ktra("…và máy A vẫn còn mã nguyên vẹn (không bị máy B làm hỏng)", s.doc("TB_OTP")[MAY].sai === 0);
}
{
  const s = dungSan();
  s.props.DEVICE_KEY = "K";
  s.api.apiTbXin_({ tb: MAY, ten: "A · kho", ip: IP_KHO });
  const otp = layOtp(s.teleGui);
  const bia = otp === "0000" ? "1111" : "0000";
  let r;
  for (let i = 0; i < 4; i++) r = s.api.apiTbOtp_({ tb: MAY, otp: bia });
  ktra("Sai 4 lần → mã vẫn còn, báo còn 1 lần", !!s.doc("TB_OTP")[MAY] && /còn 1 lần/.test(r.message), r.message);
  r = s.api.apiTbOtp_({ tb: MAY, otp: bia });
  ktra("Sai lần 5 → HUỶ mã", r.huy === 1 && !s.doc("TB_OTP")[MAY], r.message);
  ktra("…bắn tin cảnh báo dò mã", /SAI QUÁ NHIỀU|SAI QUÁ NHIỀU/.test(s.teleGui.map((x) => x.text).join("|")));
  const sau = s.api.apiTbOtp_({ tb: MAY, otp });
  ktra("…sau khi huỷ, gõ ĐÚNG mã cũ cũng KHÔNG cấp quyền", sau.duyet !== 1 && !s.api.tbDuyetCo_(MAY));
}
{
  const s = dungSan();
  s.props.DEVICE_KEY = "K";
  s.api.apiTbXin_({ tb: MAY, ten: "A · kho", ip: IP_KHO });
  const otp = layOtp(s.teleGui);
  const ds = s.doc("TB_OTP"); ds[MAY].het = Date.now() - 1000; s.ghi("TB_OTP", ds);
  const r = s.api.apiTbOtp_({ tb: MAY, otp });
  ktra("Mã hết hạn 60' → hetHan=1, bảo xin lại", r.hetHan === 1 && !s.api.tbDuyetCo_(MAY), r.message);
}
{
  const s = dungSan();
  s.props.DEVICE_KEY = "K";
  s.api.apiTbXin_({ tb: MAY, ten: "A · kho", ip: IP_KHO });
  const soTin = s.teleGui.length;
  const r = s.api.apiTbXin_({ tb: MAY, ten: "A · kho", ip: IP_KHO });
  ktra("Xin lại trong 10' → KHÔNG bắn tin lần 2 (chống spam quản trị)", s.teleGui.length === soTin, s.teleGui.length + " tin");
  ktra("…nhưng vẫn trả lời tử tế: chờ 4 số, 10' nữa xin lại được", r.choOtp === 1 && r.lai === 1, r.message);
}
{
  const s = dungSan();
  s.props.DEVICE_KEY = "K";
  s.props.TB_XIN_DEM = JSON.stringify({ ngay: "20260824", so: 30 });
  const r = s.api.apiTbXin_({ tb: MAY, ten: "A · kho", ip: IP_KHO });
  const chan = r.status === "error" && !r.ngoaiMang;
  ktra("Trần 30 lượt xin/ngày cho toàn hệ", chan, r.message);
}
{
  const s = dungSan();
  s.props.DEVICE_KEY = "K";
  s.api.apiTbXin_({ tb: MAY, ten: "A · kho", ip: IP_KHO });
  const otp = layOtp(s.teleGui);
  s.props.TB_OTP_SAI_NGAY = JSON.stringify({ ngay: "20260824", so: 50 });
  const r = s.api.apiTbOtp_({ tb: MAY, otp: otp === "0000" ? "1111" : "0000" });
  ktra("Trần 50 lần gõ sai/ngày toàn hệ → huỷ mã ngay từ lần sai đầu của mã đó", r.huy === 1, r.message);
}

/* =========================================================================================
   D. Các nhánh còn lại
   ========================================================================================= */
console.log("\nD. Nhánh còn lại");
{
  const s = dungSan();   // DEVICE_KEY rỗng = chưa siết
  const a = s.api.apiTbXin_({ tb: MAY, ten: "A", ip: IP_LA });
  const b = s.api.apiTbOtp_({ tb: MAY, otp: "1234" });
  const c = s.api.apiTbTra_({ tb: MAY });
  ktra("DEVICE_KEY rỗng → mọi cửa trả duyet=1 (rollout không làm trắng dashboard)",
    a.duyet === 1 && b.duyet === 1 && c.duyet === 1);
  ktra("…và không bắn tin nào", s.teleGui.length === 0);
}
{
  const s = dungSan();
  s.props.DEVICE_KEY = "K";
  s.ghi("TB_DUYET", { [MAY]: { ten: "A", luc: new Date().toISOString() } });
  const r = s.api.apiTbXin_({ tb: MAY, ten: "A", ip: IP_LA });
  ktra("Máy ĐÃ duyệt bấm xin → trả duyet=1, khỏi làm gì thêm", r.duyet === 1 && s.teleGui.length === 0);
}
{
  const s = dungSan();
  s.props.DEVICE_KEY = "K";
  ktra("Tên tự khai quá ngắn → chặn tại chỗ", s.api.apiTbXin_({ tb: MAY, ten: "x", ip: IP_KHO }).status === "error");
  ktra("Mã máy sai định dạng → chặn", s.api.apiTbXin_({ tb: "hack", ten: "A · kho", ip: IP_KHO }).status === "error");
  ktra("OTP không đủ 4 số → chặn trước khi tra sổ", s.api.apiTbOtp_({ tb: MAY, otp: "12" }).status === "error");
}
console.log("\nD2. Kênh Telegram của GAS — 3 nhánh của tbBaoTele_ (24/08: token đi theo .env → deploy)");
{ /* (a) Cả Script Properties LẪN hằng đều chưa có (bản git-safe) → im lặng, KHÔNG nổ */
  const s = dungSan();
  s.props.DEVICE_KEY = "K";
  delete s.props.TELEGRAM_BOT_TOKEN; delete s.props.TELEGRAM_CHAT_ID;
  const r = s.api.apiTbXin_({ tb: MAY, ten: "A · kho", ip: IP_KHO });
  ktra("Chưa cấu hình gì cả → VẪN sinh mã, nói rõ phải liên hệ trực tiếp",
    r.choOtp === 1 && r.guiTele === 0 && /liên hệ trực tiếp/i.test(r.message), r.message);
  ktra("…mã vẫn nằm trong sổ để quản trị tra được", !!s.doc("TB_OTP")[MAY]);
  ktra("…và KHÔNG có tin nào bị bắn ra", s.teleGui.length === 0);
}
{ /* (b) Properties TRỐNG nhưng HẰNG có giá trị (đường .env → deploy-gas.mjs) → PHẢI gửi được */
  const s = dungSan({ token: "1234:token-gia-tu-env", chat: "555" });
  s.props.DEVICE_KEY = "K";
  delete s.props.TELEGRAM_BOT_TOKEN; delete s.props.TELEGRAM_CHAT_ID;
  const r = s.api.apiTbXin_({ tb: MAY, ten: "A · kho", ip: IP_KHO });
  ktra("Properties trống + hằng deploy có giá trị → GỬI ĐƯỢC (khỏi đặt tay Script Properties)",
    r.guiTele === 1 && s.teleGui.length === 1, "guiTele=" + r.guiTele + " · " + s.teleGui.length + " tin");
  ktra("…gọi đúng bot của hằng deploy", /\/bot1234:token-gia-tu-env\//.test(s.teleGui[0] ? s.teleGui[0].url : ""),
    s.teleGui[0] ? s.teleGui[0].url.replace(/bot[^/]*/, "bot***") : "(khong co)");
  ktra("…tin có mã 4 số", /^\d{4}$/.test(layOtp(s.teleGui)), "mã = " + layOtp(s.teleGui));
}
{ /* (c) Cả hai có → Script Properties THẮNG (đổi token gấp không cần deploy lại) */
  const s = dungSan({ token: "9999:hang-deploy", chat: "111" });
  s.props.DEVICE_KEY = "K";
  s.props.TELEGRAM_BOT_TOKEN = "1111:properties-thang"; s.props.TELEGRAM_CHAT_ID = "222";
  s.api.apiTbXin_({ tb: MAY, ten: "A · kho", ip: IP_KHO });
  ktra("Có cả hai → Script Properties THẮNG hằng deploy",
    /\/bot1111:properties-thang\//.test(s.teleGui[0] ? s.teleGui[0].url : ""),
    s.teleGui[0] ? s.teleGui[0].url.replace(/bot[^/]*/, "bot***") : "(khong co)");
}
{ /* (d) Bản trong git PHẢI là placeholder — token thật chỉ được nằm ở .env */
  const gs = NGUON;
  ktra("google-script.gs (bản tracked) giữ TELE_TOKEN/TELE_CHAT ở dạng placeholder",
    /var TELE_TOKEN = 'DAT_[A-Z_]+';/.test(gs) && /var TELE_CHAT = 'DAT_[A-Z_]+';/.test(gs));
  ktra("…và KHÔNG có token bot thật lọt vào file", !/[0-9]{8,}:[A-Za-z0-9_-]{30,}/.test(gs));
  const dg = fs.readFileSync(path.join(DIR, "deploy-gas.mjs"), "utf8");
  ktra("deploy-gas.mjs chèn TELE_TOKEN + TELE_CHAT từ .env",
    /\["TELE_TOKEN", "TELEGRAM_BOT_TOKEN"\]/.test(dg) && /\["TELE_CHAT", "TELEGRAM_CHAT_ID"\]/.test(dg));
  ktra("deploy-gas.mjs vẫn CHẶN nếu còn placeholder sau khi chèn (không deploy bản hỏng)",
    /Vẫn còn placeholder/.test(dg));
  ktra("teleTest ĐÒI SECRET (không phải cửa công khai)",
    /action === 'teleTest'\) return keyBodyOK_\(duLieu\)/.test(gs));
}
{
  const s = dungSan();
  s.props.DEVICE_KEY = "K";
  s.api.apiTbXin_({ tb: MAY, ten: "A · kho", ip: IP_KHO });
  const otp = layOtp(s.teleGui);
  s.api.apiTbOtp_({ tb: MAY, otp });
  ktra("Thu hồi bằng /tuchoi_ (tb_duyet ok=0) → máy mất quyền",
    s.api.apiTbDuyet_({ tb: MAY, ok: "0" }).ok === 0 && !s.api.tbDuyetCo_(MAY));
  ktra("…và mã cũ không hồi sinh", !s.doc("TB_OTP")[MAY]);
  ktra("Đường phụ /duyet_ vẫn cấp được khi laptop sống",
    s.api.apiTbDuyet_({ tb: MAY2, ok: "1" }).ok === 1 && s.api.tbDuyetCo_(MAY2));
}
{
  const s = dungSan();
  s.props.DEVICE_KEY = "KHOA-CHUNG";
  ktra("Link #khoa= (đường phụ) vẫn được tbOK_ nhận", s.api.tbOK_({ tb: "KHOA-CHUNG" }) === true);
  ktra("Lời từ chối đã nói theo OTP, không còn 'mở link'",
    /Xin mã OTP|Xin mã OTP/.test(s.api.tbTuChoi_().message) && !/mở link/.test(s.api.tbTuChoi_().message),
    s.api.tbTuChoi_().message.slice(0, 60) + "…");
}

console.log("\nKẾT QUẢ: " + dat + " đạt · " + hong + " hỏng");
process.exit(hong ? 1 : 0);
