/**
 * bao-cao-khai-uidgr.mjs — CHỈ ĐỌC: đánh giá kết quả khai Group UID của PO 10012508091422.
 *   node bao-cao-khai-uidgr.mjs [--ra <tệp.txt>]
 * So bảng đối soát (.exports/doi-soat-po-uidgr.csv) với WMS live: group nào đã nạp đúng,
 * group nào còn trống, có cuộn nào bị CẮT (group chứa >1 UID) và bin nào còn lệch.
 */
import fs from "node:fs";
import { layTokenSongWms } from "./session-rules.js";

const RA = (() => { const i = process.argv.indexOf("--ra"); return i > 0 ? process.argv[i + 1] : null; })();
const GW = "https://wms-gw.inshasaki.com/api/v1";
const SKU = "422304497", KHO = "1177", CTY = "1002";

const csv = fs.readFileSync("./.exports/doi-soat-po-uidgr.csv", "utf8").trim().split(/\r?\n/).map((l) => {
  const o = []; let cur = "", q = false;
  for (const ch of l) { if (ch === '"') q = !q; else if (ch === "," && !q) { o.push(cur); cur = ""; } else cur += ch; }
  o.push(cur); return o;
});
const H = csv[0].map((x) => x.trim());
const bang = csv.slice(1).map((r) => Object.fromEntries(H.map((h, i) => [h, (r[i] || "").trim()])))
  .filter((r) => r["Group Uid Code (de xuat)"]);

const token = await layTokenSongWms(process.cwd(), () => {});
if (!token) { console.log("✗ không có token WMS sống"); process.exit(75); }
const hd = { authorization: token, "company-ids": CTY, "user-agent-type": "web", origin: "https://wms.inshasaki.com" };
const api = async (u) => { const r = await fetch(GW + u, { headers: hd }); const t = await r.text(); try { return JSON.parse(t); } catch { return {}; } };

/* group của 5 mẻ trong tệp */
const meCode = [...new Set(bang.map((r) => r["Batch Code"]))];
const grp = new Map();
for (const me of meCode) {
  const j = await api("/wms/group-uid-infos?page=1&size=200&batch_codes=" + encodeURIComponent(me));
  (j.records || []).forEach((r) => grp.set(String(r.group_uid_code), r));
}
/* UID bên trong từng group đã có hàng */
const ruot = new Map();
for (const [code, r] of grp) {
  if (!r.uid_quantity) continue;
  const d = await api("/wms/group-uid-infos/detail/uid?page=1&size=50&group_uid_code=" + code);
  ruot.set(code, (d.records || []).map((x) => ({ uid: x.uid, qty: x.quantity })));
}
/* tồn 4 bin */
const bins = [...new Set(bang.map((r) => r["Vi tri"]))].sort();
const tonBin = {};
for (const b of bins) {
  const j = await api("/wms/report-management/report-inventories?page=1&size=300&location_description=" + b +
    "&warehouse_ids=" + KHO + "&skus=" + SKU);
  const rs = (j.records || []).filter((x) => x.status_id === 6);
  tonBin[b] = { dong: rs.length, tong: rs.reduce((s, x) => s + x.qty, 0),
    ranh: rs.filter((x) => String(x.group_uid) === "0").sort((a, b2) => b2.inventory_id - a.inventory_id) };
}

const d = [];
const p = (s) => { d.push(s); console.log(s); };
const gio = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
p("KHAI BAO GROUP UID — PO 10012508091422 (SKU 422304497, kho WH-MATERIAL-MTG)");
p("Chot luc " + gio);

let xong = 0, trong = 0, cat = 0, lechCan = 0;
const dsTrong = [], dsCat = [];
for (const r of bang) {
  const code = r["Group Uid Code (de xuat)"];
  const g = grp.get(code);
  const canKg = Number(r["Received Qty (kg)"]);
  const canG = Math.round(canKg * 1000);
  if (!g || !g.uid_quantity) { trong++; dsTrong.push(r); continue; }
  xong++;
  const u = ruot.get(code) || [];
  if (u.length > 1) { cat++; dsCat.push({ r, u }); }
  if (Math.abs(Number(g.uid_quantity) - canG) > 1) { lechCan++; dsCat.push({ r, u, lech: g.uid_quantity }); }
}
p("");
p("KET QUA: " + xong + "/" + bang.length + " group da co hang · " + trong + " con trong");
p("  · dung 1 UID/cuon (khong cat): " + (xong - cat));
p("  · group co >1 UID (bi cat cuon): " + cat + (dsCat.length ? " → " + dsCat.map((x) => x.r["Roll Code"]).join(", ") : ""));
p("  · lech can so voi packing list: " + lechCan);

p("");
p("TON 4 BIN (dong / tong g / con chua khai):");
for (const b of bins) p("  " + b + ": " + tonBin[b].dong + " dong · " + tonBin[b].tong + " g · chua khai " + tonBin[b].ranh.length);

/* việc còn lại: UID đầu hàng của từng bin có khớp cuộn nào không */
p("");
p("VIEC CON LAI theo bin (app an UID moi nhat truoc):");
for (const b of bins) {
  const conCuon = bang.filter((r) => r["Vi tri"] === b && (!grp.get(r["Group Uid Code (de xuat)"]) || !grp.get(r["Group Uid Code (de xuat)"]).uid_quantity));
  if (!conCuon.length) { p("  " + b + ": DA XONG"); continue; }
  const dau = tonBin[b].ranh[0];
  const khop = dau && conCuon.find((r) => Math.abs(Math.round(Number(r["Received Qty (kg)"]) * 1000) - dau.qty) <= 1);
  p("  " + b + ": con " + conCuon.length + " cuon · dau hang " + (dau ? dau.uid + " (" + dau.qty + " g)" : "-") +
    (khop ? " → khop cuon " + khop["Roll Code"] + ", chay tiep duoc" : " → KHONG khop cuon nao, can xu ly khuc le truoc"));
}
if (dsTrong.length) {
  p("");
  p("GROUP CON TRONG (" + dsTrong.length + "): " + dsTrong.map((r) => r["Roll Code"] + " (" + r["Received Qty (kg)"] + "kg/" + r["Group Uid Code (de xuat)"] + ")").join(" · "));
}
if (RA) { fs.writeFileSync(RA, d.join("\n"), "utf8"); console.log("\n→ đã ghi " + RA); }
