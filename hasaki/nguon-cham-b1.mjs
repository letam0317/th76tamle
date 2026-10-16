/**
 * nguon-cham-b1.mjs — 16/10 user: lượt «châm vào ô» trong «Ai tác động ô trước giờ ghi nhận» phải ghi HÀNG TỪ ĐÂU
 *  (hàng hoàn / pick dư / châm hàng / chuyển ô…). WMS chỉ ghi lệnh cuối «xe → ô» (PUSH_MASTER từ F0-TF… (mã xe)), nên phải
 *  lần NGƯỢC 1 bước: món hàng đó vào XE bằng lệnh nào (RE_IT nhận IT · RE_PO nhận PO · PICK_MASTER lấy từ ô khác…).
 *
 *  Nguồn: .cache-canh-b1.json (khoá «ô|giờ ghi nhận», cò B1 đã tra) → ghi .exports/nguon-cham-b1.json:
 *    { lan: { "<ô>|<giờ lệnh>": { sku, xe, tu, loaiDay, nguon: { loai, tu, at, email } | null, xet } }, o: { "<ô>|<giờ ghi nhận>": iso } }
 *  Tải WMS (transfer-bins): 1 lượt/khoá ô (lấy sku + mã xe — sổ cò B1 cũ không giữ) + 1 lượt/SKU (lịch sử SKU quanh lượt châm).
 *  Lịch sử đã xong không đổi ⇒ sổ VĨNH VIỄN, chỉ tra lượt chưa có. Trần --max (mặc định 40) lượt gọi/lần chạy, nghỉ 1,2 s/lượt.
 *  Chạy: node nguon-cham-b1.mjs [--max=40] [--xem]   (--xem: không gọi WMS, in thống kê sổ)
 */
import "dotenv/config";
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { layTokenSongWork } from "./session-rules.js";
const DIR = path.dirname(fileURLToPath(import.meta.url)), EXP = path.join(DIR, ".exports");
const A = process.argv.slice(2), MAX = Number((A.find((x) => x.startsWith("--max=")) || "--max=40").slice(6)), XEM = A.includes("--xem");
const WMS = "https://wms-gw.inshasaki.com/api/v1", CUA_SO_GIO = 72, LUI_XE_GIO = 48;
const docJ = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };
const ghiJ = (f, o) => { const t = f + ".tmp"; fs.writeFileSync(t, JSON.stringify(o)); fs.renameSync(t, f); };
const msVN = (s) => Date.parse(String(s).replace(" ", "T") + "+07:00");
const ngu = (ms) => new Promise((r) => setTimeout(r, ms));
const F_SO = path.join(EXP, "nguon-cham-b1.json");
const CW = docJ(path.join(DIR, ".cache-canh-b1.json"), {}), SO = docJ(F_SO, { lan: {}, o: {} });
SO.lan ||= {}; SO.o ||= {};
const kho = (bin) => (/-A2-/.test(bin) ? 874 : 863);   // như canh-b1: kệ A2 = kho WMS 874

if (XEM) {
  const ds = Object.values(SO.lan), dem = {};
  ds.forEach((x) => { const k = x.nguon ? (x.nguon.loai || "(tay)") : x.khongXe ? "THANG" : "khong-thay"; dem[k] = (dem[k] || 0) + 1; });
  console.log("lượt có nguồn:", ds.length, dem, "· khoá ô đã tra:", Object.keys(SO.o).length, "/", Object.keys(CW).filter((k) => (CW[k].rec || []).length).length);
  process.exit(0);
}

let tok = null, nGoi = 0;
async function goi(q) {
  if (nGoi >= MAX) return null;
  if (!tok) tok = (await layTokenSongWork(DIR, () => {})).replace(/^Bearer /, "");
  nGoi++; if (nGoi > 1) await ngu(1200);
  const r = await fetch(WMS + "/wms/transfer-bins?" + new URLSearchParams({ page: 1, size: 200, ...q }), { headers: { authorization: "Bearer " + tok, "Company-Ids": "1001", "user-agent-type": "web" }, signal: AbortSignal.timeout(150000) });
  const j = await r.json(); return j.records || [];
}

/* 1) mỗi khoá ô (mới nhất trước) còn lượt chưa có sku/xe → 1 lượt bin_in (cùng cửa sổ 72h với cò B1) */
const khoa = Object.keys(CW).filter((k) => (CW[k].rec || []).length && !SO.o[k]).sort((a, b) => (a.split("|")[1] < b.split("|")[1] ? 1 : -1));
for (const k of khoa) {
  const [bin, ngay] = k.split("|"), to = msVN(ngay);
  const rec = await goi({ warehouse_id: kho(bin), bin_in: bin, from_date: to - CUA_SO_GIO * 36e5, to_date: to });
  if (!rec) break;
  for (const x of rec) if (x.bin_in === bin && Number(x.status) === 3) {
    const kl = bin + "|" + x.created_at;
    if (!SO.lan[kl]) SO.lan[kl] = { sku: String(x.sku || ""), xe: String(x.cart_code || ""), tu: String(x.bin_out || ""), loaiDay: x.transfer_type || "", qty: Number(x.quantity) || 0 };
  }
  SO.o[k] = new Date().toISOString(); ghiJ(F_SO, SO);
}

/* 2) lần ngược 1 bước: món hàng vào XE bằng lệnh nào — gom theo (kho, sku), 1 lượt keywords=sku phủ mọi lượt cùng sku */
const canTra = Object.entries(SO.lan).filter(([, v]) => v.nguon === undefined && v.sku);
for (const [kl, v] of canTra) if (!v.xe || !/F0-TF-/.test(v.tu)) { v.nguon = null; v.khongXe = true; }   // chuyển thẳng ô → ô, không qua xe: nguồn = chính ô lấy ra
const nhom = new Map();
for (const [kl, v] of canTra) { if (v.nguon !== undefined) continue; const bin = kl.split("|")[0], g = kho(bin) + "|" + v.sku;
  if (!nhom.has(g)) nhom.set(g, []); nhom.get(g).push([kl, v]); }
for (const [g, ds] of nhom) {
  const [wh, sku] = g.split("|"), mocs = ds.map(([kl]) => msVN(kl.slice(kl.indexOf("|") + 1)));
  const rec = await goi({ warehouse_id: wh, keywords: sku, from_date: Math.min(...mocs) - LUI_XE_GIO * 36e5, to_date: Math.max(...mocs) + 6e4 });
  if (!rec) break;
  const vao = rec.filter((x) => Number(x.status) === 3 && String(x.sku) === sku && x.cart_code).sort((a, b) => String(b.created_at).localeCompare(a.created_at));
  for (const [kl, v] of ds) { const at = kl.slice(kl.indexOf("|") + 1);
    const r = vao.find((x) => String(x.cart_code) === v.xe && x.bin_out !== v.tu && String(x.bin_in) === v.tu && x.created_at <= at);
    v.nguon = r ? { loai: r.transfer_type || "", tu: String(r.bin_out || ""), at: r.created_at, email: r.created_user_name || "" } : null;
    v.xet = new Date().toISOString(); }
  ghiJ(F_SO, SO);
}
ghiJ(F_SO, SO);
console.log("nguon-cham-b1: " + nGoi + " lượt WMS · sổ " + Object.keys(SO.lan).length + " lượt · còn khoá ô chưa tra " + Object.keys(CW).filter((k) => (CW[k].rec || []).length && !SO.o[k]).length + " · còn lượt chưa lần nguồn " + Object.values(SO.lan).filter((v) => v.nguon === undefined).length);
