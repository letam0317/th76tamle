/**
 * qc-cham-idf.mjs — ĐO HAI NGƯỜI CHẤM ĐIỂM TRÊN CÙNG DỮ LIỆU
 * ===========================================================================================
 *  'vai' = bản đang chạy: trọng số theo VAI (mã 45 · thông số 25 · màu 20 · loại 10) + xung đột
 *  'idf' = bản 4 giai đoạn (yêu cầu 19/08/2026): tổng IDF × hệ số nhóm (mã ×3 · số đo ×2 · chữ ×1
 *          · từ phổ thông ép 0,1) + fuzzy phạt 0,5 + boost trùng ĐVT, xung đột giữ nguyên
 *
 *  Hai bộ đề, cả hai đều KHÔNG gọi mạng:
 *    A. 30 lượt OCR THẬT đã lưu trong `.exports/qc-ocr-dem.json` (chữ Drive OCR đọc từ tem mô phỏng,
 *       nhãn cắt từ SKU thật) — đây là bộ sát thực tế nhất đang có.
 *    B. Bộ ca nghiệp vụ: mỗi ca là một tình huống đã từng gây sự cố thật (xem NHAN-DIEN-SKU.md).
 *
 *  node qc-cham-idf.mjs [--chi-tiet]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const CHI_TIET = process.argv.includes("--chi-tiet");
const html = fs.readFileSync(path.join(DIR, "..", "factory", "index.html"), "utf8");
const E = new Function(html.slice(html.indexOf("/*<NDS-ENGINE>*/"), html.indexOf("/*</NDS-ENGINE>*/")) + "\n return NDS_ENGINE;")();
if (typeof E.datCham !== "function") { console.error("✗ Lõi chưa có datCham() — chưa cắm người chấm IDF."); process.exit(2); }

const rows = JSON.parse(fs.readFileSync(path.join(DIR, ".sku-master-dry.json"), "utf8")).rows;
const ds = rows.map((r) => ({ sku: String(r[0]), pn: r[1], type: r[2], status: r[3], qty: Number(r[4]) || 0 }));
const t0 = Date.now();
const cm = E.dungChiMuc(ds);
console.log("✓ Danh mục " + ds.length + " SKU · dựng chỉ mục " + (Date.now() - t0) + "ms · IDF trung vị " + cm.idfGiua.toFixed(2) + "\n");

const KIEU = ["vai", "idf"];
const chay = (kieu, nhan, opt) => { E.datCham(kieu); const r = E.timTop(nhan, cm, opt || { soLuong: 3, chiActive: true }); E.datCham("vai"); return r; };

/* ───────────── BỘ A: 30 lượt OCR thật ───────────── */
const F_DEM = path.join(DIR, ".exports", "qc-ocr-dem.json");
const d = { vai: { t1: 0, t3: 0, ma: 0, ms: 0 }, idf: { t1: 0, t3: 0, ma: 0, ms: 0 } };
let nA = 0, doiHang = 0;
if (fs.existsSync(F_DEM)) {
  const dem = JSON.parse(fs.readFileSync(F_DEM, "utf8"));
  for (const k of Object.keys(dem)) {
    if (k.indexOf("ocr:") !== 0) continue;
    const sku = k.split(":")[1], o = dem[k];
    const dong = rows.find((r) => String(r[0]) === sku);
    if (!dong || !o.txt) continue;
    nA++;
    const khoaDap = E.khoaHang(dong[1]);
    const nhan = E.tuVanBan(o.txt, cm);
    const sku1 = {};
    for (const kieu of KIEU) {
      const t = Date.now();
      const top = chay(kieu, nhan);
      d[kieu].ms += Date.now() - t;
      const khoa = top.map((x) => E.khoaHang(x.pn));
      if (khoa[0] === khoaDap) d[kieu].t1++;
      if (khoa.indexOf(khoaDap) >= 0) d[kieu].t3++;
      if (top.coMaKhop) d[kieu].ma++;
      sku1[kieu] = (top[0] || {}).sku + "/" + (top[0] || {}).pct + "%";
    }
    if (sku1.vai.split("/")[0] !== sku1.idf.split("/")[0]) {
      doiHang++;
      if (CHI_TIET) console.log("  đổi hạng 1 · đáp án " + sku + ":  vai=" + sku1.vai + "  →  idf=" + sku1.idf);
    }
  }
  const pc = (v) => String(Math.round((v / Math.max(1, nA)) * 100)).padStart(3) + "%";
  console.log("════ BỘ A — " + nA + " lượt OCR thật ════");
  console.log("  người chấm   Top-1        Top-3        khớp được mã   thời gian");
  for (const kieu of KIEU) {
    console.log("  " + (kieu === "vai" ? "VAI (đang chạy)" : "IDF (4 giai đoạn)").padEnd(19) +
      pc(d[kieu].t1) + " (" + d[kieu].t1 + ")   " + pc(d[kieu].t3) + " (" + d[kieu].t3 + ")   " +
      pc(d[kieu].ma) + "        " + (d[kieu].ms / Math.max(1, nA)).toFixed(1) + "ms/lượt");
  }
  console.log("  Số lượt IDF đổi hạng 1 so với VAI: " + doiHang + "/" + nA);
} else console.log("(bỏ qua BỘ A — chưa có .exports/qc-ocr-dem.json)");

/* ───────────── BỘ B: các tình huống đã gây sự cố thật ───────────── */
const CA = [
  { ten: "Tem chỉ Irisa F9-5284 (mã + màu + chi số)", ai: { item_codes: ["F9-5284"], specs: ["Tkt 120", "Tex 27", "60/3"], colors: ["Hồng tro"], brands: ["THESEUS IRISA"] }, mong1: "422377978" },
  { ten: "Tem nút Morito JC01262 17mm — COMBO không được đứng đầu", ai: { item_codes: ["JC01262"], specs: ["17mm", "27L"], colors: ["#006", "matt silver"], brands: ["MORITO"] }, khongCombo: true, mong3: "422440680" },
  { ten: "Dây kéo 8846295 màu 345 38cm — phải tách đúng biến thể", ai: { item_codes: ["8846295"], specs: ["38.0 CM", "#3"], colors: ["345"], brands: ["YKK"] }, mong1: "422322192" },
  { ten: "Dây kéo cùng mã KHÁC MÀU (074) — phải ra biến thể navy", ai: { item_codes: ["8846295"], specs: ["38cm"], colors: ["074", "Navy Blue"], brands: ["YKK"] }, mong1: "422322204" },
  { ten: "Tem mờ: chỉ đọc được hiệu + màu (KHÔNG có mã) → không được tự tin ≥85%", ai: { item_codes: [], specs: [], colors: ["Hồng tro"], brands: ["Irisa"] }, pctToiDa: 85 },
  { ten: "Từ khoá RÁC hoàn toàn → không được có gợi ý đáng tin", ai: { item_codes: ["ZZQ99999"], specs: ["999cm"], colors: ["zzz"], brands: ["khongcothuonghieunay"] }, rac: true },
  { ten: "Mã F9-5374 → Top 3 phải TOÀN SKU mang mã đó", ai: { item_codes: ["F9-5374"], specs: [], colors: [], brands: ["Chi", "Filtex", "Phong Viet", "Polyester"] }, moiTheCoMa: "5374" },
  { ten: "ĐVT: keo Bemis 3914 Clear → #1 phải là bản mm", ai: { item_codes: ["3914"], specs: [], colors: ["Clear"], brands: ["Bemis", "Keo bonding"] }, dv: "mm" },
];
console.log("\n════ BỘ B — " + CA.length + " tình huống nghiệp vụ ════");
const dat = { vai: 0, idf: 0 };
for (const ca of CA) {
  const nhan = E.tuAI(ca.ai, cm);
  const kq = {};
  for (const kieu of KIEU) {
    const top = chay(kieu, nhan);
    let ok = true, vi = "";
    if (ca.rac) { if (top.length && top[0].pct >= 50) { ok = false; vi = "#1 = " + top[0].pct + "%"; } }
    else {
      if (ca.mong1 && (!top.length || String(top[0].sku) !== ca.mong1)) { ok = false; vi = "#1 = " + ((top[0] || {}).sku || "rỗng"); }
      if (ca.mong3 && !top.some((r) => String(r.sku) === ca.mong3)) { ok = false; vi += " (thiếu " + ca.mong3 + " trong Top 3)"; }
      if (ca.khongCombo && top.length && (top[0].type === "COMBO" || top[0].gop)) { ok = false; vi = "#1 là hàng đóng gói"; }
      if (ca.pctToiDa != null && top.length && top[0].pct > ca.pctToiDa) { ok = false; vi = "#1 = " + top[0].pct + "% (> " + ca.pctToiDa + ")"; }
      if (ca.moiTheCoMa) { const thieu = top.filter((r) => String(r.pn).indexOf(ca.moiTheCoMa) < 0); if (!top.length || thieu.length) { ok = false; vi = "lọt " + thieu.map((r) => r.sku).join(","); } }
      if (ca.dv && (!top.length || top[0].dv !== ca.dv)) { ok = false; vi = "ĐVT #1 = " + ((top[0] || {}).donVi || "rỗng"); }
    }
    if (ok) dat[kieu]++;
    kq[kieu] = (ok ? "✓" : "✗ " + vi.trim()) + "  [" + top.slice(0, 3).map((r) => r.sku + "/" + r.pct).join(" ") + "]";
  }
  console.log("  " + ca.ten);
  console.log("      VAI: " + kq.vai);
  console.log("      IDF: " + kq.idf);
}
console.log("\n  VAI đạt " + dat.vai + "/" + CA.length + " · IDF đạt " + dat.idf + "/" + CA.length);
console.log((dat.idf > dat.vai ? "→ IDF tốt hơn ở bộ nghiệp vụ" : dat.idf === dat.vai ? "→ hai bên ngang nhau ở bộ nghiệp vụ" : "→ VAI tốt hơn ở bộ nghiệp vụ"));
