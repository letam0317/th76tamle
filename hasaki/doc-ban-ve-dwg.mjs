#!/usr/bin/env node
// doc-ban-ve-dwg.mjs — đọc bản vẽ AutoCAD (.dwg) mà KHÔNG cần mở giao diện.
//
// Cách làm: máy này có AutoCAD 2022 → dùng accoreconsole.exe (bộ chạy nền của AutoCAD)
// xuất .dwg sang .dxf (văn bản thuần), rồi bóc nhãn chữ + toạ độ ra TSV để phân tích.
// Không chạm upstream (work/wms/hr/planogram) — chạy hoàn toàn cục bộ.
//
//   node hasaki/doc-ban-ve-dwg.mjs <duong-dan.dwg> [--ra <thu-muc>] [--giu-dxf]
//
// Kết quả: <thu-muc>/<ten>.texts.tsv  (cột: layer, x, y, chữ)
//          <thu-muc>/<ten>.tomtat.txt (layer, đếm entity, khung bản vẽ, block hay dùng)

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

const ACCORE = [
  'C:/Program Files/Autodesk/AutoCAD 2022/accoreconsole.exe',
  'C:/Program Files/Autodesk/AutoCAD 2023/accoreconsole.exe',
  'C:/Program Files/Autodesk/AutoCAD 2024/accoreconsole.exe',
  'C:/Program Files/Autodesk/AutoCAD 2025/accoreconsole.exe',
].find(p => fs.existsSync(p));

const argv = process.argv.slice(2);
const dwg = argv.find(a => !a.startsWith('--'));
const raIdx = argv.indexOf('--ra');
const giuDxf = argv.includes('--giu-dxf');

if (!dwg) {
  console.error('Thiếu đường dẫn .dwg.\n  node hasaki/doc-ban-ve-dwg.mjs <duong-dan.dwg> [--ra <thu-muc>] [--giu-dxf]');
  process.exit(2);
}
if (!fs.existsSync(dwg)) { console.error('Không thấy tệp: ' + dwg); process.exit(2); }
if (!ACCORE) {
  console.error('Không thấy accoreconsole.exe — máy phải có AutoCAD cài sẵn (đã dò bản 2022–2025).');
  process.exit(2);
}

const ten = path.basename(dwg).replace(/\.dwg$/i, '');
const thuMuc = path.resolve(raIdx >= 0 ? argv[raIdx + 1] : path.join(os.tmpdir(), 'doc-ban-ve-dwg'));
fs.mkdirSync(thuMuc, { recursive: true });
const dxf = path.join(thuMuc, ten + '.dxf');

// ── 1. DWG → DXF ────────────────────────────────────────────────────────────
// accoreconsole chạy theo kịch bản .scr; FILEDIA=0 để lệnh hỏi ngay trên dòng lệnh
// thay vì bật hộp thoại (headless không có hộp thoại nào bấm được).
async function xuatDxf() {
  if (fs.existsSync(dxf) && fs.statSync(dxf).mtimeMs > fs.statSync(dwg).mtimeMs) {
    console.log('• Dùng lại DXF đã xuất: ' + dxf);
    return;
  }
  const scr = path.join(thuMuc, ten + '.scr');
  fs.writeFileSync(scr, ['FILEDIA', '0', '_.DXFOUT', dxf, '16', 'QUIT', 'N', ''].join('\n'), 'ascii');
  console.log('• Xuất DXF bằng AutoCAD nền (mất 1–5 phút với bản vẽ lớn)…');
  await new Promise((ok, loi) => {
    const p = spawn(ACCORE, ['/i', path.resolve(dwg), '/s', scr], { stdio: 'ignore', windowsHide: true });
    p.on('error', loi);
    p.on('exit', c => (c === 0 ? ok() : loi(new Error('accoreconsole thoát mã ' + c))));
  });
  if (!fs.existsSync(dxf)) throw new Error('accoreconsole chạy xong nhưng không sinh ra DXF — xem lại quyền ghi ở ' + thuMuc);
}

// ── 2. Bóc mã định dạng khỏi chữ MTEXT ──────────────────────────────────────
// MTEXT nhét mã font/căn lề vào chính chuỗi chữ: \fArial|b1|i0;  \pxqc;  \P (xuống dòng).
export function bocChu(s) {
  return s
    .replace(/\\P/g, ' | ')
    .replace(/\^J/g, ' ')
    .replace(/\\f[^;]*;/g, '')
    .replace(/\\[AaCcFfHhLlOoQqTtWwpe][^;\\]*;/g, '')
    .replace(/\\[LlOoKkNn]/g, '')
    .replace(/[{}]/g, '')
    .replace(/\\~/g, ' ')
    .replace(/\\\\/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^\s*\|\s*/, '')
    .trim();
}

// ── 3. Đọc DXF ──────────────────────────────────────────────────────────────
// DXF là chuỗi cặp (mã, giá trị) mỗi thứ một dòng. Mã cần dùng:
//   0 = loại đối tượng · 8 = layer · 10/20 = toạ độ X/Y · 1 và 3 = chữ · 2 = tên (block/layer)
function docDxf() {
  const dong = fs.readFileSync(dxf, 'utf8').split(/\r?\n/);
  const layers = new Set(), ents = [], demLoai = {}, demBlock = {};
  let cur = null, bang = null, trongBlock = null;

  const chot = () => {
    if (!cur) return;
    if (cur.t === 'LAYER') layers.add(cur.name);
    else if (cur.t !== 'BLOCK') {
      demLoai[cur.t] = (demLoai[cur.t] || 0) + 1;
      if (cur.t === 'INSERT' && cur.name) demBlock[cur.name] = (demBlock[cur.name] || 0) + 1;
      if ((cur.t === 'TEXT' || cur.t === 'MTEXT') && cur.text.trim()) ents.push(cur);
    }
    cur = null;
  };

  for (let i = 0; i + 1 < dong.length; i += 2) {
    const ma = dong[i].trim(), gt = dong[i + 1];
    if (ma === '0') {
      chot();
      if (gt === 'TABLE') { bang = dong[i + 3]; continue; }
      if (gt === 'ENDTAB') { bang = null; continue; }
      if (gt === 'ENDBLK') { trongBlock = null; continue; }
      if (gt === 'LAYER' && bang === 'LAYER') { cur = { t: 'LAYER', name: '' }; continue; }
      if (gt === 'BLOCK') { cur = { t: 'BLOCK', name: '' }; continue; }
      cur = { t: gt, layer: '', x: null, y: null, text: '', name: '' };
      continue;
    }
    if (!cur) continue;
    if (cur.t === 'LAYER' || cur.t === 'BLOCK') {
      if (ma === '2' && !cur.name) { cur.name = gt; if (cur.t === 'BLOCK') trongBlock = gt; }
      continue;
    }
    if (ma === '8') cur.layer = gt;
    else if (ma === '10' && cur.x === null) cur.x = +gt;
    else if (ma === '20' && cur.y === null) cur.y = +gt;
    else if (ma === '1' || ma === '3') cur.text += gt;
    else if (ma === '2') cur.name = gt;
    if (cur.t === 'TEXT' || cur.t === 'MTEXT') cur.block = trongBlock || '';
  }
  chot();
  return { layers: [...layers].sort(), ents, demLoai, demBlock };
}

await xuatDxf();
const { layers, ents, demLoai, demBlock } = docDxf();

const nhan = ents.map(e => ({ ...e, c: bocChu(e.text) })).filter(e => e.c);
const tsv = path.join(thuMuc, ten + '.texts.tsv');
fs.writeFileSync(tsv, nhan.map(e => [e.layer, e.x?.toFixed(1) ?? '', e.y?.toFixed(1) ?? '', e.c].join('\t')).join('\n'), 'utf8');

const xs = nhan.map(e => e.x).filter(Number.isFinite), ys = nhan.map(e => e.y).filter(Number.isFinite);
const tomTat = [
  `BẢN VẼ: ${path.resolve(dwg)}`,
  `Sửa lần cuối: ${fs.statSync(dwg).mtime.toLocaleString('vi-VN')}`,
  '',
  `LAYER (${layers.length}): ${layers.join(' · ')}`,
  '',
  'ĐẾM ĐỐI TƯỢNG: ' + Object.entries(demLoai).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k}=${v}`).join(' · '),
  '',
  'BLOCK CHÈN NHIỀU NHẤT: ' + Object.entries(demBlock).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${k}×${v}`).join(' · '),
  '',
  `NHÃN CHỮ: ${nhan.length}`,
  xs.length ? `KHUNG (theo nhãn): X ${Math.min(...xs).toFixed(1)}…${Math.max(...xs).toFixed(1)} · Y ${Math.min(...ys).toFixed(1)}…${Math.max(...ys).toFixed(1)}` : '',
].join('\n');
fs.writeFileSync(path.join(thuMuc, ten + '.tomtat.txt'), tomTat, 'utf8');

if (!giuDxf) fs.rmSync(dxf, { force: true });

console.log(tomTat);
console.log('\n→ Nhãn kèm toạ độ: ' + tsv);
