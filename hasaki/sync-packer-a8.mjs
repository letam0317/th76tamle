/**
 * ============================================================================
 *  sync-packer-a8.mjs — AI ĐÓNG GÓI THẬT TẠI TỪNG BÀN/CAMERA A8 THEO NGÀY
 * ============================================================================
 *  User chốt 24/09/2026: pop-up ô A8 của dashboard kiemsoatkho phải hiện được
 *  "Báo cáo đóng gói tại vị trí" cho ĐÚNG NGÀY đang chọn (7 chip ngày) — tức là
 *  packer THỰC TẾ của bàn đó hôm đó + khung giờ làm (phiếu đầu → phiếu cuối).
 *
 *  NGUỒN: WMS `GET /api/v1/wms/packings/v2` (kho 863 SHOP-170, ORDER+INTERNAL_TRANSFER).
 *  Bản đồ bàn↔camera: xem CAMERA_BAN trong kiemsoatkho/hasaki-planogram.js — tab này
 *  KHÔNG lưu vị trí, chỉ (Ngày · Camera · Packer); dashboard tự nối camera→ô.
 *
 *  ĐẦU RA: tab PRIVATE `PACKER-A8-NGAY` (đã vào SERVE_PRIVATE_TABS @94):
 *    Ngày | Camera | Email | Tên | Phiếu đầu | Phiếu cuối | Số phiếu
 *  Cửa sổ trượt 30 ngày. CÓ EMAIL + TÊN NV (PII) → probe servedTabs trước khi ghi,
 *  GAS chưa phục vụ tab thì THOÁT, tuyệt đối không để rơi sang sheet public.
 *
 *  TẢI UPSTREAM (mục 2 BỘ-CHUẨN): size=5000 đã đo chịu được → 1 ngày ≈ 13-15k phiếu
 *  = 3-4 lượt gọi. Chạy thường (không tham số) chỉ kéo HÔM NAY + hôm qua nếu chưa
 *  chốt ≈ 4-8 lượt/lần × 2 lần/ngày (12:30 + 20:45, xem LICH-VA-DU-PHONG.md).
 *  Ngày ĐÃ QUA và đã kéo sau 23:59 của nó thì CHỐT trong sổ cái, không kéo lại.
 *
 *  Chạy:
 *    node sync-packer-a8.mjs                  # hôm nay + hôm qua (nếu chưa chốt)
 *    node sync-packer-a8.mjs --backfill=30    # đắp các ngày còn thiếu trong 30 ngày
 *    node sync-packer-a8.mjs --dry            # không ghi Sheet, xuất .exports/PACKER-A8-NGAY-out.json
 * ============================================================================
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { layTokenSongWms, gasPost, gasPhucVuTab, hashTab, tabKhongDoi, luuHashTab, hamCacheTabs } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const TAB = "PACKER-A8-NGAY";
const NGAY_GIU = Number(process.env.PACKER_A8_NGAY_GIU || 30);
const F_SO = path.join(DIR, ".packer-a8-ngay.json");     // sổ cái theo ngày (có PII → đã gitignore theo pattern .*.json? KIỂM: thêm .gitignore nếu chưa)
const APPSCRIPT_KEY = process.env.APPSCRIPT_KEY;
const SIZE = 5000;
const A = process.argv.slice(2);
const DRY = A.includes("--dry");
const BACKFILL = Number((A.find(x => x.startsWith("--backfill")) || "").split("=")[1] || 0);

const log = (...x) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...x);

/* ---- chống chạy chồng (FAIL-CLOSED) ---- */
const F_KHOA = path.join(DIR, ".packer-a8.lock");
try {
  const st = fs.statSync(F_KHOA);
  if (Date.now() - st.mtimeMs < 15 * 60 * 1000) { log("lượt trước còn chạy — bỏ lượt."); process.exit(0); }
} catch (e) { if (e.code !== "ENOENT") { log("không dò được khoá → coi như đang chạy, bỏ lượt."); process.exit(0); } }
fs.writeFileSync(F_KHOA, new Date().toISOString());
process.on("exit", () => { try { fs.unlinkSync(F_KHOA); } catch { /* best-effort */ } });

/* ---- ngày giờ VN ---- */
const TZ = "Asia/Ho_Chi_Minh";
function ngayVN(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function msDauNgay(iso) { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y, m - 1, d, -7, 0, 0); }
function lui(iso, n) { const t = new Date(iso + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() - n); return t.toISOString().slice(0, 10); }

/* ---- danh bạ: user_id/email → tên ---- */
let TEN = new Map();
try {
  const db = JSON.parse(fs.readFileSync(path.join(DIR, ".cache-danhba.json"), "utf8")).data || {};
  for (const k of Object.keys(db)) { const v = db[k]; if (v && v.staff_email) TEN.set(String(v.staff_email).toLowerCase(), v.staff_name || ""); }
  log("danh bạ: " + TEN.size + " email→tên");
} catch { log("⚠ không đọc được .cache-danhba.json — cột Tên sẽ trống (dashboard tự tra tenNm)."); }

/* ---- kéo TRỌN 1 ngày từ packings/v2, gộp theo (camera, packer) ---- */
async function keoNgay(tk, iso) {
  const from = msDauNgay(iso), to = msDauNgay(iso) + 24 * 3600 * 1000 - 1;
  const base = "https://wms-gw.inshasaki.com/api/v1/wms/packings/v2?warehouse_ids=863&packing_types=" +
    encodeURIComponent("ORDER,INTERNAL_TRANSFER") + "&from_date=" + from + "&to_date=" + to + "&size=" + SIZE;
  const gop = new Map();   // cam|email → {n, dau, cuoi}
  let tong = 0, count = null, goi = 0;
  for (let p = 1; p <= 12; p++) {   // trần 12 trang = 60k phiếu/ngày, gấp 4 ngày cao điểm — chạm trần là bất thường, dừng để không quay vô hạn
    const r = await fetch(base + "&page=" + p, { headers: { authorization: tk }, signal: AbortSignal.timeout(90000) });
    goi++;
    if (!r.ok) throw new Error("packings/v2 " + iso + " p" + p + " HTTP " + r.status);
    const j = await r.json();
    count = j.count;
    const recs = j.records || [];
    for (const x of recs) {
      if (!x.camera_code || !x.packer_name) continue;
      /* from/to bị WMS làm tròn theo NGÀY nên vẫn lọc lại theo created_at cho chắc */
      const ng = String(x.created_at || "").slice(0, 10);
      if (ng !== iso) continue;
      const k = x.camera_code + "|" + String(x.packer_name).toLowerCase();
      const dau = String(x.created_at || "").slice(11, 16);
      const xong = String(x.packing_date || x.packed_date || x.created_at || "").slice(11, 16);
      const g = gop.get(k) || { n: 0, dau: "99:99", cuoi: "" };
      g.n++;
      if (dau && dau < g.dau) g.dau = dau;
      if (xong && xong > g.cuoi) g.cuoi = xong;
      gop.set(k, g);
    }
    tong += recs.length;
    if (!recs.length || tong >= count) break;
    await new Promise((s) => setTimeout(s, 400));
  }
  const rows = [...gop.entries()].map(([k, g]) => {
    const [cam, em] = k.split("|");
    return [cam, em, g.dau === "99:99" ? "" : g.dau, g.cuoi, g.n];
  });
  log(`  ${iso}: ${goi} lượt gọi · ${count} phiếu · ${rows.length} cặp camera×packer`);
  return rows;
}

(async () => {
  /* sổ cái */
  let so = { days: {} };
  try { so = JSON.parse(fs.readFileSync(F_SO, "utf8")); } catch { /* lần đầu */ }
  const homNay = ngayVN();

  /* danh sách ngày cần kéo */
  const can = [];
  if (BACKFILL > 0) {
    for (let i = BACKFILL - 1; i >= 0; i--) {
      const d = lui(homNay, i);
      const e = so.days[d];
      if (!e || (!e.final && d < homNay) || d === homNay) can.push(d);
    }
  } else {
    const homQua = lui(homNay, 1);
    if (!so.days[homQua] || !so.days[homQua].final) can.push(homQua);
    can.push(homNay);
  }
  if (!can.length) { log("không có ngày nào cần kéo."); return; }

  const tk = await layTokenSongWms(DIR, log);
  if (!tk) { log("✗ KHÔNG có token WMS sống — dừng, không kéo gì."); process.exitCode = 1; return; }

  for (const d of can) {
    try {
      const rows = await keoNgay(tk, d);
      /* ngày rỗng bất thường (WMS trục trặc) thì GIỮ bản cũ nếu có, đừng ghi đè bằng rỗng */
      if (!rows.length && so.days[d] && so.days[d].rows.length) { log(`  ⚠ ${d}: 0 dòng nhưng sổ cái đang có ${so.days[d].rows.length} — giữ bản cũ.`); continue; }
      so.days[d] = { final: d < homNay, at: Date.now(), rows };
    } catch (e) { log(`  ⚠ ${d}: ${e.message} — giữ bản cũ (nếu có).`); }
  }
  /* cắt cửa sổ 30 ngày */
  const moc = lui(homNay, NGAY_GIU - 1);
  for (const d of Object.keys(so.days)) if (d < moc) delete so.days[d];
  fs.writeFileSync(F_SO, JSON.stringify(so), "utf8");

  /* dựng tab: ngày MỚI → CŨ, trong ngày theo camera */
  const header = ["Ngày", "Camera", "Email", "Tên", "Phiếu đầu", "Phiếu cuối", "Số phiếu"];
  const out = [];
  for (const d of Object.keys(so.days).sort().reverse()) {
    for (const r of so.days[d].rows.slice().sort((a, b) => a[0] < b[0] ? -1 : 1)) {
      out.push([d, r[0], r[1], TEN.get(r[1]) || "", r[2], r[3], r[4]]);
    }
  }
  log(`tab ${TAB}: ${out.length} dòng / ${Object.keys(so.days).length} ngày`);

  if (DRY) {
    fs.mkdirSync(path.join(DIR, ".exports"), { recursive: true });
    fs.writeFileSync(path.join(DIR, ".exports", TAB + "-out.json"), JSON.stringify({ header, rows: out }, null, 1));
    log("(DRY) → .exports/" + TAB + "-out.json");
    return;
  }
  if (!out.length) { log("⚠ 0 dòng — không ghi."); return; }

  /* CHỐT PII: GAS phải đang phục vụ tab này (định tuyến sheet PRIVATE) mới được ghi */
  if (!(await gasPhucVuTab(TAB, log))) {
    log("✗ GAS chưa phục vụ " + TAB + " (SERVE_PRIVATE_TABS) — THOÁT, không ghi để khỏi rơi sang sheet public.");
    process.exitCode = 1; return;
  }
  const hash = hashTab(header, out);
  if (tabKhongDoi(DIR, TAB, hash)) { log("= " + TAB + ": không đổi — bỏ qua ghi."); return; }
  const j = await gasPost({ action: "syncTasks", key: APPSCRIPT_KEY, tab: TAB, header, rows: out, apiAt: Date.now() }, log, TAB);
  if (!j || j.status !== "success") throw new Error("ghi " + TAB + " lỗi: " + (j && j.message || "?"));
  luuHashTab(DIR, TAB, hash);
  log("✓ " + TAB + ": ghi " + (j.written || out.length) + " dòng.");
  await hamCacheTabs([TAB], log);   // dựng sẵn cache readTab để người mở pop-up không phải chờ 15-100s
})().catch((e) => { log("LỖI:", e.message); process.exitCode = 1; });
