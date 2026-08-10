/** probe-hr-endpoints.mjs — soi bundle hr.hasaki.vn: HOST API thật + cách gọi sheet-summary
 *  (header/param gì kèm theo) để hiểu vì sao token hiện tại bị 403. READ-ONLY, không cần auth. */
const html = await (await fetch("https://hr.hasaki.vn/")).text();
const srcs = [...new Set([...html.matchAll(/(?:src|href)="([^"]+\.js)"/g)].map(m => m[1]))];
console.log("chunk:", srcs.length);
const hosts = new Map(), quanhSheet = [], headerKeys = new Map();
for (const s of srcs) {
  const u = s.startsWith("http") ? s : "https://hr.hasaki.vn" + (s.startsWith("/") ? s : "/" + s);
  let js = ""; try { js = await (await fetch(u)).text(); } catch { continue; }
  console.log(`  ${u.slice(-34)} ${Math.round(js.length / 1024)}KB`);
  for (const m of js.matchAll(/https?:\/\/([a-z0-9.-]+\.(?:hasaki\.vn|inshasaki\.com))/gi)) hosts.set(m[1], (hosts.get(m[1]) || 0) + 1);
  for (const m of js.matchAll(/.{0,220}sheet-summary.{0,220}/g)) quanhSheet.push(m[0]);
  for (const m of js.matchAll(/["']((?:x-|X-)[\w-]{2,30})["']\s*:/g)) headerKeys.set(m[1], (headerKeys.get(m[1]) || 0) + 1);
  for (const m of js.matchAll(/["'](app[_-]code|platform|client[_-]id)["']\s*:\s*["']([^"']{1,40})["']/g)) headerKeys.set(m[1] + "=" + m[2], (headerKeys.get(m[1] + "=" + m[2]) || 0) + 1);
}
console.log("\n=== host API mà UI HR gọi ===");
[...hosts.entries()].sort((a, b) => b[1] - a[1]).forEach(([h, n]) => console.log(`  ${h}  ×${n}`));
console.log("\n=== header/khoá đặc biệt ===");
[...headerKeys.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([h, n]) => console.log(`  ${h}  ×${n}`));
console.log("\n=== ngữ cảnh quanh 'sheet-summary' ===");
[...new Set(quanhSheet)].slice(0, 6).forEach(c => console.log("  … " + c.replace(/\s+/g, " ") + "\n"));
