// runner-dieu-phoi.mjs — CONG GAC dat o DAU moi co: may nay co chay viec <tenViec> ngay bay gio khong?
//   node runner-dieu-phoi.mjs <tenViec>   ->  exit 0 CHAY / 75 DUNG  (ghi 1 dong runner-dieu-phoi.log)
// NHANH: bang nhip lay tu BO NHO DEM (nhip tim 3' da ghi) -> KHONG goi GAS de doc bang; chi goi GAS 1 LAN
//   de GIU KHOA (khi minh la ung vien, doi toi 8s — 14/10: 2s hay hut, khoa khong ghi duoc). Co tran thoi gian.
// Chong 3 bay: lech dong ho (gio may chu), chay doi (khoa atomic), GAS chet (theo bang dem; thieu bang -> viec nhe chay, nang thoi).
// Test offline: DIEUPHOI_BANG=<file.json>.
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mayChay } from "./dieu-phoi.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const tenViec = process.argv[2];
if (!tenViec) { console.error("Thieu <tenViec>"); process.exit(2); }
const cfgF = path.join(DIR, "cai-pc", "dieu-phoi.json");
if (!fs.existsSync(cfgF)) { console.error("Thieu dieu-phoi.json -> chay (khong gac)"); process.exit(0); }
const cfg = JSON.parse(fs.readFileSync(cfgF, "utf8"));
const viec = (cfg.viec || []).find((v) => v.ten === tenViec);
if (!viec) { console.error("Viec khong co -> DUNG"); process.exit(75); }
const may = os.hostname();

function thoat(ok, ly, bang, nguon) {
  const dong = `${new Date().toTimeString().slice(0, 8)} ${tenViec} ${may} [${nguon}] -> ${ok ? "CHAY" : "DUNG"} (${ly}; song=${(bang || []).map((b) => b.may + (b.yeu ? "!" : "")).join(",")})`;
  try { fs.appendFileSync(path.join(DIR, "runner-dieu-phoi.log"), dong + "\n"); } catch { /* */ }
  if (nguon !== "test") try { fs.writeFileSync(path.join(DIR, ".cong-luc"), new Date().toISOString()); } catch { /* */ }   // 14/10 cổng gác còn sống (congLuc)
  if (ok && nguon !== "test") { const f = path.join(DIR, ".chay-luc.json"); let c = {}; try { c = JSON.parse(fs.readFileSync(f, "utf8")); } catch { /* */ }
    c[tenViec] = new Date().toISOString(); try { fs.writeFileSync(f, JSON.stringify(c)); } catch { /* */ } }   // 14/10 «chạy lúc» lên tab Máy trạm
  process.exit(ok ? 0 : 75);
}

// --- Offline test ---
if (process.env.DIEUPHOI_BANG) {
  const bang = JSON.parse(fs.readFileSync(process.env.DIEUPHOI_BANG, "utf8"));
  const chon = mayChay(viec, bang, Date.now(), cfg);
  thoat(chon === may, chon === may ? "duoc chon" : "may chay=" + (chon || "HOAN"), bang, "test");
}

const { layBang, layBangCache, LENH_F } = await import("./nhip-pc.mjs");

// 0) LENH DUNG tu sub-tab May tram (ban luu cuc bo tu nhip tim) -> dung truoc moi thu, ke ca khi GAS cham/khong toi
try {
  const l = JSON.parse(fs.readFileSync(LENH_F, "utf8"));
  if (l && (l.dung || (l.dungViec || []).includes(tenViec))) thoat(false, l.dung ? "may bi dung (lenh tu May tram)" : "viec bi dung tren may nay (lenh tu May tram)", [], "lenh");
} catch { /* chua co lenh */ }

// 1) BANG: uu tien BO NHO DEM (0 lan goi GAS). Dem cu/khong co -> lay live 1 lan (co tran).
let r = layBangCache();
if (!r) r = await layBang(() => {}, { timeoutMs: 2000 });
const bang = r.bang, nguon = r.nguon, srvNow = r.srvNow || Date.now();

// 2) UNG VIEN theo gio may chu
const chon = mayChay(viec, bang, srvNow, cfg);
if (chon !== may) thoat(false, "may chay=" + (chon || "HOAN"), bang, nguon);

// 3) Toi la ung vien.
if (viec.khongKhoa) thoat(true, "duoc chon (khong khoa)", bang, nguon);

// Giu khoa atomic (1 lan goi GAS, co tran) -> chong chay doi.
const r2 = await layBang(() => {}, { giuViec: tenViec, giuTTL: viec.giuTTL || 600, timeoutMs: 8000 });   // 14/10: 2s quá ngắn (GAS thường ~2s) → khoá không ghi được, việc chạy «không khoá»; việc nền nên đợi 8s không sao
if (r2.giuOK === true) thoat(true, "duoc chon + giu khoa", bang, nguon);
if (r2.giuOK === false) thoat(false, "may khac dang giu khoa", bang, nguon);
// giuOK === null: GAS khong toi (het tran). Du phong theo BANG (xep hang nhat quan giua cac may):
//  - co bang that (cache/gas, nhieu may deu thay cung bang) -> van chay (toi la ung vien; rui ro chay doi thap).
//  - chi thay chinh minh (local, khong dem) -> viec NHE chay, viec NANG thoi (tranh N× tai khi khong biet ai manh hon).
if (nguon === "cache" || nguon === "gas") thoat(true, "GAS cham nhung bang dem nhat quan -> chay", bang, nguon);
thoat(!viec.nang, viec.nang ? "GAS cham + khong co bang -> viec nang thoi" : "GAS cham + viec nhe -> chay", bang, nguon);
