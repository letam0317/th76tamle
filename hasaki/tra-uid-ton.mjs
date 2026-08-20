/**
 * tra-uid-ton.mjs — Tra SKU + KHO đang giữ tồn theo danh sách UID (hoặc SKU), quy mô hàng trăm mã.
 *
 * Endpoint THẬT (bóc từ bundle SPA 17/08/2026, màn hình `inventory/list-beta`):
 *   GET https://wms-gw.inshasaki.com/api/v1/wms/report-management/report-inventories
 *       ?page=&size=&uids=<CSV>            (đổi `skus=` để tra ngược theo SKU)
 *   Header BẮT BUỘC: `Authorization: Bearer …` **và `Company-Ids: <company_id>`**
 *   (thiếu Company-Ids → 400 "Company not authenticated"). `/wms/inventories` mà chính màn hình
 *   list-beta gọi đang 500 "Error when get list inventory with es" → dùng report-inventories.
 *
 * SỐ ĐO THẬT 17/08/2026 (do-tran-uid.mjs + chạy thử 500 UID) — cơ sở của mọi hằng số dưới đây:
 *   · `size` tối đa = 1000 (2000 → 400 "size must be less than 1000").
 *   · Độ dài URL: 8.093 byte → 200; 8.413 byte → 414 ⇒ trần 8 KB của gateway.
 *     UID dài 13 ký tự + dấu phẩy = 14 byte ⇒ tối đa ~520 UID/lô; ta chặn ở URL_MAX 7,5 KB.
 *   · Quét KHÔNG lọc size=1000: 29 s ⇒ luôn lọc theo uids/skus, đừng quét.
 *   · 500 UID thật, thử nhiều cấu hình (mỗi lượt = 1 lần chạy, ES của WMS dao động khá mạnh):
 *       lô 500 × 1 luồng  16,6 s   |  lô 200 × 1 luồng (tuần tự) 15,9 s
 *       lô 400 × 3        11,7 s   |  lô 50 × 10  12,8 s   |  lô 100 × 6   9,5 s
 *       lô 250 × 2         8,8 s   |  lô 125 × 4   6,5 s   |  lô 167 × 3   6,0 s
 *       lô 200 × 3        6,1 / 7,2 / 11,6 s (3 lần đo → dao động là của WMS, không phải script)
 *     ⇒ ĐIỂM NGỌT: lô ~200 mã, 3 lô song song. Lô quá to (500) chậm vì 1 truy vấn ES nặng;
 *       lô quá nhỏ + nhiều luồng (50×10) cũng chậm vì WMS xếp hàng, không phải càng song song
 *       càng nhanh. Ước lượng thực dụng: **500 UID ≈ 6–12 s, 3 lượt gọi**.
 *
 * KHÔNG đăng nhập mới: chỉ dùng token SỐNG trong kho token-store / bridge (session-rules).
 *
 *   node tra-uid-ton.mjs VN00303841533 VN00292841199 …
 *   node tra-uid-ton.mjs --file uids.txt --csv ket-qua.csv
 *   node tra-uid-ton.mjs --sku --file skus.txt
 * Tuỳ chọn: --lo <n> (mã/lô, mặc định 200) · --song <n> (lô chạy song song, mặc định 3)
 *           --cty 1002,1001,1005 (thứ tự công ty dò; mã không thấy ở công ty đầu sẽ dò tiếp)
 */
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { layTokenSongWms, fetchThuLai } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const GW = "https://wms-gw.inshasaki.com/api/v1/wms/report-management/report-inventories";
const SIZE_MAX = 1000;        // trần server (đo 17/08: size >= 2000 bị 400)
const URL_MAX = 7500;         // ngân sách độ dài URL, dưới mép 414 (~8.192) một quãng an toàn

/* ---------- đọc tham số ---------- */
const argv = process.argv.slice(2);
const lay = (ten, mac) => { const i = argv.indexOf(ten); return i >= 0 && argv[i + 1] ? argv[i + 1] : mac; };
const co = (ten) => argv.includes(ten);
const theoSku = co("--sku");
const LO = Math.max(1, Number(lay("--lo", 200)));   // điểm ngọt đo được, xem chú thích đầu tệp
const SONG = Math.max(1, Number(lay("--song", 3)));
const CTY = String(lay("--cty", process.env.WMS_COMPANY_ID || "1002,1001,1005")).split(",").map((s) => s.trim()).filter(Boolean);
const CSV = lay("--csv", "");
const tepVao = lay("--file", "");

let raw = argv.filter((a, i) => !a.startsWith("--") && !["--lo", "--song", "--cty", "--csv", "--file"].includes(argv[i - 1]));
if (tepVao) raw = raw.concat(fs.readFileSync(path.isAbsolute(tepVao) ? tepVao : path.join(process.cwd(), tepVao), "utf8").split(/\r?\n/));
const ma = [...new Set(raw.flatMap((s) => String(s).split(/[\s,;]+/)).map((s) => s.trim()).filter(Boolean))];
if (!ma.length) {
  console.error("Cách dùng: node tra-uid-ton.mjs <UID…>  |  --file uids.txt [--csv ra.csv] [--sku] [--lo 400] [--song 3]");
  process.exit(1);
}

const log = (...a) => console.log(...a);
const token = await layTokenSongWms(DIR, log);
if (!token) { console.error("✗ Không có token WMS sống — dừng (không đăng nhập mới, không đá phiên ai)."); process.exit(2); }
const TRUONG = theoSku ? "skus" : "uids";

/* ---------- chia lô: vừa theo số mã, vừa theo ngân sách độ dài URL ---------- */
function chiaLo(ds, nMax) {
  const lo = [], nen = GW.length + 60;   // + page/size/params
  let cur = [], len = nen;
  for (const m of ds) {
    const them = m.length + 1;
    if (cur.length >= nMax || len + them > URL_MAX) { lo.push(cur); cur = []; len = nen; }
    cur.push(m); len += them;
  }
  if (cur.length) lo.push(cur);
  return lo;
}

/* ---------- gọi 1 lô: tự chẻ đôi khi 414/500, tự phân trang khi count > records ---------- */
let soGoi = 0;
async function goiLo(dsMa, company, sau = 0) {
  const ket = [];
  let page = 1, tong = null;
  while (true) {
    const u = new URL(GW);
    u.searchParams.set("page", String(page));
    u.searchParams.set("size", String(Math.min(SIZE_MAX, Math.max(50, dsMa.length * 2))));
    u.searchParams.set(TRUONG, dsMa.join(","));
    let r, body = "";
    soGoi++;
    try {
      r = await fetchThuLai(u.toString(), { headers: { authorization: token, "Company-Ids": company, "user-agent-type": "web" } }, 3);
      body = await r.text();
    } catch (e) {
      if (dsMa.length > 25 && sau < 4) return chevonDoi(dsMa, company, sau, "lỗi mạng: " + e.message);
      log("  ⚠ bỏ lô " + dsMa.length + " mã (lỗi mạng: " + e.message + ")");
      return ket;
    }
    if (r.status === 414 || r.status >= 500) {
      if (dsMa.length > 25 && sau < 4) return ket.concat(await chevonDoi(dsMa, company, sau, r.status));
      log("  ⚠ bỏ lô " + dsMa.length + " mã (HTTP " + r.status + ")");
      return ket;
    }
    if (!r.ok) { log("  ⚠ HTTP " + r.status + ": " + body.slice(0, 160)); return ket; }
    let j; try { j = JSON.parse(body); } catch { log("  ⚠ phản hồi không phải JSON"); return ket; }
    const recs = j.records || [];
    ket.push(...recs);
    tong = j.count == null ? recs.length : j.count;
    if (ket.length >= tong || !recs.length) break;   // count > records ⇒ có mã trả nhiều dòng → sang trang
    page++;
  }
  return ket;
}
async function chevonDoi(dsMa, company, sau, vi) {
  const giua = Math.ceil(dsMa.length / 2);
  log("  … chẻ lô " + dsMa.length + " → " + giua + "+" + (dsMa.length - giua) + " (" + vi + ")");
  const a = await goiLo(dsMa.slice(0, giua), company, sau + 1);
  const b = await goiLo(dsMa.slice(giua), company, sau + 1);
  return a.concat(b);
}

/* ---------- chạy nhiều lô song song có giới hạn ---------- */
async function chayLo(danhSachLo, company) {
  const ra = [];
  for (let i = 0; i < danhSachLo.length; i += SONG) {
    const nhom = danhSachLo.slice(i, i + SONG);
    const kq = await Promise.all(nhom.map((l) => goiLo(l, company)));
    kq.forEach((k) => ra.push(...k));
  }
  return ra;
}

/* ---------- vòng theo công ty: mã còn thiếu mới dò công ty kế tiếp ---------- */
const t0 = Date.now();
const tatCa = [];
let conThieu = ma.slice();
for (const cty of CTY) {
  if (!conThieu.length) break;
  const lo = chiaLo(conThieu, LO);
  log("→ Công ty " + cty + ": " + conThieu.length + " mã / " + lo.length + " lô (tối đa " + LO + " mã/lô, " + SONG + " lô song song)");
  const recs = await chayLo(lo, cty);
  tatCa.push(...recs);
  const thay = new Set(recs.map((x) => String(theoSku ? x.sku : x.uid)));
  conThieu = conThieu.filter((m) => !thay.has(m));
  log("  ✓ " + recs.length + " bản ghi · còn thiếu " + conThieu.length);
}
const giay = ((Date.now() - t0) / 1000).toFixed(1);

/* ---------- xuất ---------- */
const COT = [["UID", "uid"], ["SKU", "sku"], ["Kho đang giữ", "warehouse_name"], ["Vị trí", "location_description"],
  ["Trạng thái", "status_name"], ["SL", "qty"], ["Công ty", "company_code"], ["Hạn dùng", "expiration_date"],
  ["Tên sản phẩm", "product_name"]];
const W = (s, n) => String(s ?? "").padEnd(n).slice(0, n);
log("\nTìm thấy " + tatCa.length + " bản ghi cho " + (ma.length - conThieu.length) + "/" + ma.length + " mã · " +
  soGoi + " lượt gọi WMS · " + giay + "s\n");
const inRa = CSV ? tatCa.slice(0, 20) : tatCa;
log(W("UID", 15) + W("SKU", 11) + W("Kho đang giữ", 30) + W("Vị trí", 20) + W("Trạng thái", 12) + W("SL", 4) + "Tên sản phẩm");
log("-".repeat(150));
for (const x of inRa) {
  log(W(x.uid, 15) + W(x.sku, 11) + W(x.warehouse_name, 30) + W(x.location_description, 20) +
    W(x.status_name, 12) + W(x.qty, 4) + String(x.product_name || "").slice(0, 60));
}
if (CSV && tatCa.length > inRa.length) log("… (" + (tatCa.length - inRa.length) + " dòng nữa — xem tệp CSV)");

/* Tổng hợp theo kho: câu hỏi hay gặp là "đang nằm ở kho nào" */
const theoKho = new Map();
for (const x of tatCa) {
  const k = (x.warehouse_name || "?") + " · " + (x.status_name || "?");
  theoKho.set(k, (theoKho.get(k) || 0) + 1);
}
log("\nTheo kho × trạng thái:");
for (const [k, v] of [...theoKho].sort((a, b) => b[1] - a[1])) log("  " + W(k, 55) + v);
if (conThieu.length) log("\n⚠ Không thấy ở công ty " + CTY.join("/") + " (" + conThieu.length + "): " + conThieu.slice(0, 30).join(", ") + (conThieu.length > 30 ? " …" : ""));

if (CSV) {
  const esc = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
  const dong = [COT.map((c) => c[0]).join(",")].concat(tatCa.map((x) => COT.map((c) => esc(x[c[1]])).join(",")));
  fs.writeFileSync(path.isAbsolute(CSV) ? CSV : path.join(process.cwd(), CSV), "﻿" + dong.join("\r\n"), "utf8");
  log("\n→ Đã ghi " + tatCa.length + " dòng vào " + CSV);
}
