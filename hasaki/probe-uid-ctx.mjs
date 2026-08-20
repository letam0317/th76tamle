/**
 * probe-uid-ctx.mjs — in ngữ cảnh quanh chuỗi cần tìm trong bundle JS của WMS SPA.
 * node probe-uid-ctx.mjs "<chuỗi>" [số ký tự trước] [số ký tự sau]
 */
const APP = "https://wms.inshasaki.com";
const CAN = process.argv[2] || "/wms/inventories";
const TRUOC = Number(process.argv[3] || 300), SAU = Number(process.argv[4] || 300);
const html = await (await fetch(APP + "/inventory/list-beta")).text();
const goc = [...new Set([...html.matchAll(/(?:src|href)="([^"]+\.js)"/g)].map((m) => m[1]))];
const seen = new Set(); const queue = goc.map((a) => (a.startsWith("http") ? a : APP + a));
let quet = 0, hit = 0;
while (queue.length && quet < 600 && hit < 8) {
  const u = queue.shift(); if (seen.has(u)) continue; seen.add(u); quet++;
  let js = ""; try { const r = await fetch(u); if (!r.ok) continue; js = await r.text(); } catch { continue; }
  let i = -1;
  while ((i = js.indexOf(CAN, i + 1)) !== -1 && hit < 8) {
    hit++;
    console.log("\n===== " + u.replace(APP, "") + " @" + i + "\n" + js.slice(Math.max(0, i - TRUOC), i + CAN.length + SAU));
  }
  for (const m of js.matchAll(/["']([^"'\s]*?\.js)["']/g)) {
    let c = m[1];
    if (/^https?:/.test(c) && !c.startsWith(APP)) continue;
    if (!/assets|static|chunk|_next|\/js\//i.test(c)) continue;
    const abs = c.startsWith("http") ? c : APP + "/" + c.replace(/^\.?\//, "");
    if (!seen.has(abs) && queue.length < 600) queue.push(abs);
  }
}
console.log("\n-- quét " + quet + " tệp, " + hit + " lần khớp");
