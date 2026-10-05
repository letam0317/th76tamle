// scaffold-map-tram.mjs - dung khung ban do hostname -> ma tram (ban) A8 tu inventory probe.
//
// Doc  .exports/pc-a8-inventory.json  (do soi-pc-a8.ps1 tao: [{ip,hostname,...}])
// Ghi  .exports/a8-hostname-to-tram.json  = { "<hostname|ip>": "<ma ban A8>" }
//   - Giu nguyen cac gia tri user da dien; chi them key moi (gia tri rong "" de user dien).
//   - PII (hostname) nam trong .exports/ (da gitignore).
//
// Chay: node scaffold-map-tram.mjs
// Sau do mo file JSON, dien ma ban A8 (theo so do MAP_A8 64 ban) cho tung may.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXPORTS = path.join(HERE, '.exports');
const INV = path.join(EXPORTS, 'pc-a8-inventory.json');
const OUT = path.join(EXPORTS, 'a8-hostname-to-tram.json');

if (!fs.existsSync(INV)) {
  console.error('  [!] Chua co ' + INV + ' - chay soi-pc-a8.ps1 truoc de tao inventory.');
  process.exit(1);
}

let inv;
try { inv = JSON.parse(fs.readFileSync(INV, 'utf8')); }
catch (e) { console.error('  [!] Doc inventory loi:', e.message); process.exit(1); }
if (!Array.isArray(inv)) inv = [inv];

let cur = {};
if (fs.existsSync(OUT)) {
  try { cur = JSON.parse(fs.readFileSync(OUT, 'utf8')) || {}; } catch { cur = {}; }
}

let them = 0;
const map = { ...cur };
for (const m of inv) {
  const key = (m.hostname && String(m.hostname).trim()) ? String(m.hostname).trim() : String(m.ip || '').trim();
  if (!key) continue;
  if (!(key in map)) { map[key] = ''; them++; }
}

// Ghi UTF-8 khong BOM, sap xep key cho de doc
const sorted = {};
for (const k of Object.keys(map).sort()) sorted[k] = map[k];
fs.writeFileSync(OUT, JSON.stringify(sorted, null, 2), { encoding: 'utf8' });

const chuaDien = Object.values(sorted).filter(v => !v).length;
console.log('  -> Da ghi ' + OUT);
console.log('  Tong may: ' + Object.keys(sorted).length + ' | them moi: ' + them + ' | chua dien ma tram: ' + chuaDien);
console.log('  Mo file tren, dien ma ban A8 (vd "A8-01".."A8-64") cho tung hostname.');
