/**
 * khai-uidgr-app.mjs — BỘ LÁI app WMS (LDPlayer) tự khai Group UID cho từng cuộn vải.
 *
 *   node khai-uidgr-app.mjs <bin> [--so N] [--thu]      # --thu = chạy khô, không bấm Confirm
 *   node khai-uidgr-app.mjs F0-KHO-503-08-04-01 --so 5
 *
 * Nguồn dữ liệu: .exports/doi-soat-po-uidgr.csv (UID ↔ group ↔ batch/roll ↔ cân) + WMS live.
 *
 * CƠ CHẾ ĐÃ ĐO (21/08/2026):
 *  · Ô "Scan SKU/Barcode/RFID/Location" KHÔNG nhận UID; app rút theo SKU + số lượng từ
 *    "Current picking shelf", ăn UID **inventory_id lớn nhất trước** (LIFO), thiếu thì CẮT UID
 *    kế tiếp + sinh UID mới ⇒ mỗi lượt phải gõ ĐÚNG cân của UID đang ở đầu hàng.
 *  · Gõ mã VỊ TRÍ vào ô item ⇒ app hỏi "Confirm changing the picking shelf" → CONFIRM.
 *  · Sau dấu +, bấm nút "Scan UID group" ở đáy để mở pop-up nhập group/batch/roll rồi Confirm.
 *  · Pop-up có khung camera ⇒ phải kéo lên cho gọn trước khi gõ (toạ độ bên dưới là sau khi kéo).
 *  · "Ungroup UID" = cancel ⇒ CẤM dùng. Bỏ item trong Edit thì hàng bị đẩy về picking shelf.
 *  · Chuỗi gõ vào KHÔNG được có khoảng trắng cuối (app quay vòng, không nạp).
 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { layTokenSongWms } from "./session-rules.js";

const ADB = process.env.LD_ADB || "D:/LDPlayer/LDPlayer9/adb.exe";
const DEV = process.env.LD_DEV || "127.0.0.1:5555";
const MOI = { ...process.env, MSYS_NO_PATHCONV: "1" };
const BIN = process.argv[2];
const SO = (() => { const i = process.argv.indexOf("--so"); return i > 0 ? Number(process.argv[i + 1]) : 999; })();
const THU = process.argv.includes("--thu");
const DS = (() => { const i = process.argv.indexOf("--danh-sach"); return i > 0 ? process.argv[i + 1] : null; })();
const SKU = "422304497";
const KHO = "1177", CTY = "1002";
const GW = "https://wms-gw.inshasaki.com/api/v1";
if (!BIN) { console.log("Dùng: node khai-uidgr-app.mjs <bin> [--so N] [--thu]"); process.exit(2); }

/* ---------- ADB ---------- */
const adb = (a) => execFileSync(ADB, ["-s", DEV, ...a], { env: MOI, maxBuffer: 64 << 20 });
const nghi = (ms) => new Promise((r) => setTimeout(r, ms));
const bam = (x, y) => adb(["shell", "input", "tap", String(x), String(y)]);
const go = (t) => adb(["shell", "input", "text", String(t).trim().replace(/ /g, "%s")]);
const phim = (k) => adb(["shell", "input", "keyevent", String(k)]);
const keo = (x1, y1, x2, y2, ms = 400) => adb(["shell", "input", "swipe", x1, y1, x2, y2, ms].map(String));
function doc() {
  let xml = "";
  for (let t = 0; t < 4 && !xml.includes("<node"); t++) {          // dump hay trả "null root node" → thử lại
    if (t) execFileSync("cmd", ["/c", "timeout /t 1 /nobreak >nul"], { env: MOI });
    try { adb(["shell", "uiautomator", "dump", "/sdcard/ui.xml"]); } catch { /* bỏ qua */ }
    try { xml = adb(["exec-out", "cat", "/sdcard/ui.xml"]).toString("utf8"); } catch { xml = ""; }
  }
  if (!xml.includes("<node")) throw new Error("không đọc được cây UI (uiautomator dump lỗi 4 lần)");
  return [...xml.matchAll(/<node\b([^>]*)>/g)].map((m) => {
    const a = m[1];
    const lay = (k) => { const r = a.match(new RegExp(k + '="([^"]*)"')); return r ? r[1] : ""; };
    const b = lay("bounds").match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/) || [0, 0, 0, 0, 0];
    return { chu: lay("text").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)),
      x: Math.round((+b[1] + +b[3]) / 2), y: Math.round((+b[2] + +b[4]) / 2) };
  });
}
const chuTren = () => doc().map((n) => n.chu).filter(Boolean).join(" | ");
/** có phần tử nào (trong khung toạ độ) mang ĐÚNG con số này? so theo số, không so chuỗi */
function coSo(gtri, khung = {}) {
  const { x1 = 0, x2 = 1080, y1 = 0, y2 = 1920, batKySo = false } = khung;
  return doc().some((n) => {
    if (n.x < x1 || n.x > x2 || n.y < y1 || n.y > y2) return false;
    const t = String(n.chu).replace(/,/g, "").trim();
    if (!/^\d+(\.\d+)?$/.test(t)) return false;
    if (batKySo) return Number(t) > 0;
    return Math.abs(Number(t) - Number(gtri)) < 0.0005;
  });
}
async function xoaO(x, y, n = 45) { bam(x, y); await nghi(450); phim(123); adb(["shell", "input", "keyevent", ...Array(n).fill("67")]); await nghi(200); }

/* ---------- WMS ---------- */
const token = await layTokenSongWms(process.cwd(), (s) => console.log("· " + s));
if (!token) { console.log("✗ không có token WMS sống"); process.exit(75); }
const H = { authorization: token, "company-ids": CTY, "user-agent-type": "web", origin: "https://wms.inshasaki.com" };
const api = async (u) => { const r = await fetch(GW + u, { headers: H }); const t = await r.text(); try { return JSON.parse(t); } catch { return { _t: t }; } };
async function tonBin() {
  const j = await api("/wms/report-management/report-inventories?page=1&size=300&location_description=" + BIN +
    "&warehouse_ids=" + KHO + "&skus=" + SKU);
  const rs = (j.records || []).filter((x) => x.status_id === 6);
  return { tong: rs.reduce((s, x) => s + x.qty, 0), dong: rs.length,
    ranh: rs.filter((x) => String(x.group_uid) === "0").sort((a, b) => b.inventory_id - a.inventory_id) };
}
async function xemGroup(g) {
  const j = await api("/wms/group-uid-infos?page=1&size=1&group_uid_codes=" + g);
  const d = await api("/wms/group-uid-infos/detail/uid?page=1&size=20&group_uid_code=" + g);
  return { ...((j.records || [])[0] || {}), uids: (d.records || []).map((x) => x.uid + ":" + x.quantity) };
}

/* ---------- bảng đối soát ---------- */
const csv = fs.readFileSync("./.exports/doi-soat-po-uidgr.csv", "utf8").trim().split(/\r?\n/).map((l) => {
  const o = []; let cur = "", q = false;
  for (const ch of l) { if (ch === '"') q = !q; else if (ch === "," && !q) { o.push(cur); cur = ""; } else cur += ch; }
  o.push(cur); return o;
});
const HD = csv[0].map((x) => x.trim());
const cuon = csv.slice(1).map((r) => Object.fromEntries(HD.map((h, i) => [h, (r[i] || "").trim()])))
  .filter((r) => r["Vi tri"] === BIN && r["Group Uid Code (de xuat)"])
  .map((r) => ({ group: r["Group Uid Code (de xuat)"], batch: r["Batch Code"], roll: r["Roll Code"],
    g: Math.round(Number(r["Received Qty (kg)"]) * 1000) }));

/* ---------- toạ độ (đo 21/08/2026, 1080×1920) ---------- */
const T = { create: [911, 156], push: [492, 480], qty: [179, 630], item: [632, 630], x1000: [60, 765],
  cong: [1017, 630], moPop: [540, 1835], popGroup: [492, 765], popBatch: [540, 1190], popRoll: [540, 1428],
  popXac: [929, 1657], popDong: [702, 1657], dlgXac: [841, 1183] };

/** dọn dòng sản phẩm còn treo trên màn Create (chạy lại sau khi lỗi) — chỉ là danh sách tạm, không gọi máy chủ */
async function donDongCu() {
  for (let t = 0; t < 3; t++) {
    if (!coSo(null, { y1: 950, y2: 1400, batKySo: true })) return;
    bam(174, 1260); await nghi(1200);
    const s = chuTren();
    if (/remove SKU|khỏi danh sách/i.test(s)) { bam(873, 1165); await nghi(1500); }
  }
}

async function vaoManCreate() {
  let s = chuTren();
  if (!/Create new UID group/.test(s)) {
    if (!/Group UID/.test(s)) throw new Error("không ở màn Group UID — mở app tới màn Group UID trước");
    bam(...T.create); await nghi(2500);
  }
  s = chuTren();
  if (!s.includes("Current picking shelf: " + BIN)) {
    await xoaO(...T.push, 30); go(BIN); phim(66); await nghi(1200);           // PUSH shelf
    await xoaO(...T.item, 30); go(BIN); phim(66); await nghi(1500);           // đổi picking shelf
    const s2 = chuTren();
    if (/Confirm changing the picking shelf/.test(s2)) { bam(...T.dlgXac); await nghi(3500); }
    await nghi(1200);
  }
}

const kq = { xong: 0, boQua: 0, loi: [] };
let ton = await tonBin();
console.log("\n### " + BIN + " · " + ton.dong + " dòng · " + ton.tong + " g · " + ton.ranh.length + " UID chưa khai · " + cuon.length + " cuộn trong bảng");
const conCuon = cuon.map((c) => ({ ...c }));

/* ---------- chế độ DANH SÁCH CHỈ ĐỊNH: gõ đúng cân packing list, cho phép lỗ nhỏ tự khép ---------- */
if (DS) {
  const ds = JSON.parse(fs.readFileSync(DS, "utf8"));
  for (const b of ds) {
    const kg = Number(b.kg).toFixed(3);
    const canG = Math.round(Number(b.kg) * 1000);
    console.log("\n» " + b.roll + " · group " + b.group + " · gõ " + kg + " kg");
    const truoc = await xemGroup(b.group);
    if (truoc.uids && truoc.uids.length) { console.log("   … đã có UID (" + truoc.uids + ") — bỏ qua."); kq.boQua++; continue; }
    const tonTruoc = await tonBin();
    try {
      await vaoManCreate(); await donDongCu();
      const daTich = () => doc().some((n) => n.chu === "✓" && n.x < 140 && n.y > 700 && n.y < 820);
      if (!daTich()) { bam(...T.x1000); await nghi(600); }
      if (!daTich()) throw new Error("không tích được ô x1000");
      await xoaO(...T.qty, 12); go(kg); await nghi(350);
      await xoaO(...T.item, 30); go(SKU); await nghi(400);
      const oQty = { x2: 340, y1: 560, y2: 700 };
      for (let t = 0; t < 3 && !coSo(kg, oQty); t++) await nghi(900);
      if (!coSo(kg, oQty)) throw new Error("ô số lượng không nhận " + kg);
      bam(...T.cong); await nghi(2500);
      let coDong = false;
      for (let t = 0; t < 8 && !coDong; t++) { coDong = coSo(kg, { y1: 950 }) || /Scan UID group/.test(chuTren()); if (!coDong) await nghi(1200); }
      if (!coDong) throw new Error("dấu + không nạp được dòng");
      let moRoi = false;
      for (let t = 0; t < 3 && !moRoi; t++) {
        bam(...T.moPop); await nghi(2500);
        for (let k = 0; k < 4 && !moRoi; k++) { if (/RFID mapping\/ Group UID/.test(chuTren())) moRoi = true; else await nghi(1000); }
      }
      if (!moRoi) throw new Error("không mở được pop-up");
      keo(540, 1450, 540, 900, 300); await nghi(800);
      await xoaO(...T.popGroup, 45); go(b.group); await nghi(350);
      await xoaO(...T.popBatch, 30); go(b.batch); await nghi(300);
      await xoaO(...T.popRoll, 30); go(b.roll); await nghi(450);
      let s2 = "";
      for (let t = 0; t < 3; t++) { s2 = chuTren(); if (s2.includes(b.group) && s2.includes(b.roll)) break; await nghi(900); }
      if (!s2.includes(b.group) || !s2.includes(b.roll)) throw new Error("pop-up không đúng dữ liệu");
      if (THU) { bam(...T.popDong); await nghi(1500); continue; }
      bam(...T.popXac); await nghi(3500);
      let ok = false;
      for (let t = 0; t < 8 && !ok; t++) { const sau = await xemGroup(b.group); ok = Number(sau.uid_quantity) === canG; if (!ok) await nghi(1800); }
      const tonSau = await tonBin();
      if (!ok) throw new Error("group chưa đủ " + canG + " g sau Confirm");
      if (tonSau.tong !== tonTruoc.tong) throw new Error("tổng bin đổi " + tonTruoc.tong + " → " + tonSau.tong);
      if (tonSau.dong > tonTruoc.dong + 1) throw new Error("bin sinh thêm " + (tonSau.dong - tonTruoc.dong) + " dòng");
      const sau = await xemGroup(b.group);
      console.log("   ✓ " + b.roll + " = " + sau.uid_quantity + " g · " + sau.uids.length + " UID (" + sau.uids + ") · bin " + tonSau.dong + " dòng / " + tonSau.tong + " g");
      kq.xong++;
    } catch (e) { console.log("   ✗ " + e.message); kq.loi.push({ roll: b.roll, group: b.group, loi: e.message }); break; }
  }
  console.log("\n=== danh sách: xong " + kq.xong + " · bỏ qua " + kq.boQua + (kq.loi.length ? " · LỖI " + JSON.stringify(kq.loi) : ""));
  process.exit(0);
}

for (let lan = 0; lan < SO; lan++) {                 // trần theo SO, thoát khi hết UID/hết cuộn khớp
  ton = await tonBin();
  const dau = ton.ranh[0];
  if (!dau) { console.log("hết UID chưa khai."); break; }
  const i = conCuon.findIndex((c) => !c.xong && Math.abs(c.g - dau.qty) <= 1);
  if (i < 0) { console.log("⚠ DỪNG: UID đầu hàng " + dau.uid + " (" + dau.qty + " g) không khớp cuộn nào còn lại."); break; }
  const c = conCuon[i];
  const kg = (dau.qty / 1000).toFixed(3);
  console.log("\n[" + (lan + 1) + "] " + dau.uid + " " + dau.qty + " g → group " + c.group + " · " + c.roll + " · gõ " + kg + " kg");

  const truoc = await xemGroup(c.group);
  if (truoc.uids && truoc.uids.length) { console.log("   … group đã có UID (" + truoc.uids + ") — bỏ qua."); c.xong = true; kq.boQua++; continue; }
  if (String(truoc.batch_code || "").trim() !== c.batch || String(truoc.roll_code || "").trim() !== c.roll) {
    console.log("   ⚠ DỪNG: batch/roll trên WMS (" + truoc.batch_code + " / " + truoc.roll_code + ") khác bảng (" + c.batch + " / " + c.roll + ")"); break;
  }

  try {
    await vaoManCreate();
    await donDongCu();
    /* số lượng + SKU — x1000 PHẢI được tích, nếu không 19.360 sẽ thành 19 g và app CẮT cuộn */
    const daTich = () => doc().some((n) => n.chu === "✓" && n.x < 140 && n.y > 700 && n.y < 820);
    if (!daTich()) { bam(...T.x1000); await nghi(600); }
    if (!daTich()) throw new Error("không tích được ô x1000");
    let s = chuTren();
    await xoaO(...T.qty, 12); go(kg); await nghi(350);
    await xoaO(...T.item, 30); go(SKU); await nghi(400);
    /* kiểm trước khi + */
    s = chuTren();
    const oQty = { x2: 340, y1: 560, y2: 700 };            // app tự bỏ số 0 cuối ⇒ phải so THEO SỐ
    for (let t = 0; t < 3 && !coSo(kg, oQty); t++) await nghi(900);
    if (!coSo(kg, oQty)) throw new Error("ô số lượng không nhận " + kg);
    if (!s.includes(SKU)) { await nghi(600); s = chuTren(); }
    if (!s.includes(SKU)) throw new Error("ô item không nhận SKU " + SKU);
    bam(...T.cong); await nghi(2500);
    s = chuTren();
    if (/not exist|greater than 0/.test(s)) throw new Error("app báo: " + s.split("|").pop().trim());
    /* dòng vừa nạp phải hiện ĐÚNG số kg (nếu x1000 hụt thì ra 0.019 → dừng ngay) */
    let coDong = false;
    for (let t = 0; t < 8 && !coDong; t++) {
      const ss = chuTren();
      coDong = coSo(kg, { y1: 950 }) || /Scan UID group/.test(ss);   // nút này chỉ hiện khi đã có dòng
      if (!coDong) await nghi(1200);
    }
    if (!coDong) throw new Error("dấu + không nạp được dòng " + kg + " kg");
    /* pop-up — phải thấy tiêu đề của nó mới được gõ, không thì chữ rơi vào ô màn Create */
    let moRoi = false;
    for (let t = 0; t < 3 && !moRoi; t++) {
      bam(...T.moPop); await nghi(2500);
      for (let k = 0; k < 4 && !moRoi; k++) {
        if (/RFID mapping\/ Group UID/.test(chuTren())) moRoi = true; else await nghi(1000);
      }
    }
    if (!moRoi) throw new Error("không mở được pop-up Scan UID group");
    keo(540, 1450, 540, 900, 300); await nghi(800);
    await xoaO(...T.popGroup, 45); go(c.group); await nghi(350);
    await xoaO(...T.popBatch, 30); go(c.batch); await nghi(300);
    await xoaO(...T.popRoll, 30); go(c.roll); await nghi(450);
    /* kiểm 3 ô */
    for (let t = 0; t < 3; t++) {
      s = chuTren();
      if (s.includes(c.group) && s.includes(c.batch) && s.includes(c.roll)) break;
      await nghi(900);
    }
    if (!s.includes(c.group) || !s.includes(c.roll)) throw new Error("pop-up không đúng dữ liệu: " + s.slice(0, 200));
    if (THU) { console.log("   (chạy khô) — bấm Close"); bam(...T.popDong); await nghi(2000); continue; }
    bam(...T.popXac); await nghi(3500);

    /* xác minh bằng API */
    let ok = false;
    for (let t = 0; t < 8; t++) {
      const sau = await xemGroup(c.group);
      if (Number(sau.uid_quantity) === dau.qty && sau.uids.length === 1 && sau.uids[0] === dau.uid + ":" + dau.qty) { ok = true; break; }
      await nghi(1800);
    }
    const sauTon = await tonBin();
    if (!ok) throw new Error("group " + c.group + " chưa đúng sau Confirm");
    if (sauTon.tong !== ton.tong) throw new Error("tổng bin đổi " + ton.tong + " → " + sauTon.tong);
    if (sauTon.dong !== ton.dong) throw new Error("số dòng bin đổi " + ton.dong + " → " + sauTon.dong + " (app đã CẮT cuộn)");
    console.log("   ✓ đúng: 1 UID " + dau.uid + " · bin vẫn " + sauTon.dong + " dòng / " + sauTon.tong + " g");
    c.xong = true; kq.xong++;
  } catch (e) {
    console.log("   ✗ " + e.message);
    kq.loi.push({ uid: dau.uid, group: c.group, loi: e.message });
    break;   // dừng ngay, không làm lung tung
  }
}
console.log("\n=== xong " + kq.xong + " cuộn · bỏ qua " + kq.boQua + (kq.loi.length ? " · LỖI: " + JSON.stringify(kq.loi) : ""));
