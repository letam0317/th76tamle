// pc-login-agent.mjs — PILOT, MUC DICH DUY NHAT: ghi nhan tai khoan dang nhap TREN MAY NAY.
//
// Doc (chi doc, khong sua gi): hostname, user Windows dang dang nhap, tai khoan WMS @hasaki
// (tu localStorage auth_store cua trinh duyet), IP, thoi diem. Ghi vao:
//   .pc-login-agent.log        (nhat ky, 1 dong/lan, tu cat khi >512KB)
//   .pc-login-agent-last.json  (ban ghi moi nhat)
//
// KHONG nhan lenh tu xa. KHONG tu cap nhat ma. KHONG lam viec gi khac. Trong suot va go bo de dang:
//   Unregister-ScheduledTask -TaskName "PC login agent (pilot)" -Confirm:$false
//
// Che do:
//   node pc-login-agent.mjs --once     # chay 1 lan: in ra + ghi log
//   node pc-login-agent.mjs --dry      # chi in, KHONG ghi
//   node pc-login-agent.mjs --service  # lap moi PHUT_LAP phut (mac dinh 5)

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const SERVICE = args.includes('--service');
const PHUT_LAP = Number((args.find(a => a.startsWith('--phut=')) || '').split('=')[1]) || 5;
const LOG = path.join(HERE, '.pc-login-agent.log');
const LAST = path.join(HERE, '.pc-login-agent-last.json');

function ipChinh() {
  const ifs = os.networkInterfaces();
  for (const name of Object.keys(ifs)) {
    for (const a of ifs[name] || []) {
      if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.')) return a.address;
    }
  }
  return '';
}

// User Windows dang dang nhap console (chinh xac hon khi chay bang SYSTEM)
function userWindows() {
  try {
    const out = execFileSync('quser', [], { encoding: 'utf8', windowsHide: true });
    const lines = out.split(/\r?\n/).slice(1).filter(Boolean);
    // cot: USERNAME SESSIONNAME ID STATE ... ; dong 'Active' la user dang ngoi
    let pick = lines.find(l => /\bActive\b/i.test(l)) || lines[0];
    if (pick) return pick.trim().replace(/^>/, '').split(/\s+/)[0];
  } catch {}
  return process.env.USERNAME || os.userInfo().username || '';
}

// Tai khoan WMS @hasaki tu auth_store (tai dung bo trich da kiem chung)
function taiKhoanWms() {
  try {
    const out = execFileSync(process.execPath, [path.join(HERE, 'soi-auth-store.mjs'), '--json'], { encoding: 'utf8', windowsHide: true });
    const arr = JSON.parse(out || '[]');
    if (!arr.length) return {};
    // uu tien token con han, roi exp lon nhat
    arr.sort((a, b) => (Number(b.con_han) - Number(a.con_han)) || (String(b.het_han).localeCompare(String(a.het_han))));
    const r = arr[0];
    return { wmsSub: r.sub || '', wmsAccount: r.taiKhoan || '', wmsName: r.ten || '', wmsConHan: r.con_han, wmsHetHan: r.het_han || '' };
  } catch { return {}; }
}

function thuThap() {
  const now = new Date();
  return Object.assign({
    ts: now.toLocaleString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh' }),
    hostname: os.hostname(),
    ip: ipChinh(),
    winUser: userWindows()
  }, taiKhoanWms());
}

function ghi(rec) {
  const dong = rec.ts + ' | ' + rec.hostname + ' | ' + rec.ip + ' | win=' + rec.winUser +
    ' | wms=' + (rec.wmsAccount || ('sub=' + (rec.wmsSub || '?'))) + (rec.wmsName ? ' (' + rec.wmsName + ')' : '') +
    ' | token=' + (rec.wmsConHan === true ? 'con han' : rec.wmsConHan === false ? 'het han' : '?');
  try {
    if (fs.existsSync(LOG) && fs.statSync(LOG).size > 512 * 1024) {
      try { fs.renameSync(LOG, LOG + '.1'); } catch {}
    }
    fs.appendFileSync(LOG, dong + '\n');
    fs.writeFileSync(LAST, JSON.stringify(rec, null, 2));
  } catch (e) { console.error('  (ghi log loi:', e.message + ')'); }
  return dong;
}

function motLan() {
  const rec = thuThap();
  const dong = DRY ? null : ghi(rec);
  console.log('  ' + (dong || (rec.ts + ' | ' + rec.hostname + ' | win=' + rec.winUser + ' | wms=' + (rec.wmsAccount || rec.wmsSub))));
  return rec;
}

if (SERVICE) {
  console.log('  [pc-login-agent] service: ghi moi ' + PHUT_LAP + ' phut. Ctrl+C de dung.');
  motLan();
  setInterval(motLan, PHUT_LAP * 60 * 1000);
} else {
  motLan();
}
