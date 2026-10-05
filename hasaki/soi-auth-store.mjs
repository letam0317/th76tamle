// soi-auth-store.mjs — Trich tai khoan WMS @hasaki tu localStorage["auth_store"] cua trinh duyet.
//
// Vi sao: ung dung WMS (SPA) luu dang nhap trong localStorage key "auth_store" = {state:{token:<JWT>}}.
// localStorage nam TREN DIA (Local Storage/leveldb) va KHONG ma hoa -> doc duoc (ke ca tu xa qua \\HOST\C$).
// JWT WMS chi co sub (ma nguoi dung), khong co ten/email -> tra sub qua danh ba .cache-danhba.json.
//
// DUNG:
//   node soi-auth-store.mjs                      # doc ho so Edge Default cua may nay (kiem chung)
//   node soi-auth-store.mjs --dir="<leveldb dir>"# doc mot thu muc leveldb da chep ve (vd tu \\HOST\C$)
//   node soi-auth-store.mjs --edge --chrome --all-profiles
//   node soi-auth-store.mjs --json               # in JSON (cho poller doc)
// CHI DOC. Khong in token day du (chi sub/exp + tai khoan tra ra).

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (k, d = '') => { const a = args.find(x => x.startsWith(k + '=')); return a ? a.slice(k.length + 1) : d; };
const asJson = has('--json');
const LOCAL = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---- Danh ba: user_id -> {ten,email,code} ----
function napDanhBa() {
  const p = path.join(HERE, '.cache-danhba.json');
  const map = new Map();
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    const recs = Array.isArray(raw) ? raw : (raw.rows || raw.data || Object.values(raw));
    for (const r of recs) {
      if (!r) continue;
      const id = r.user_id ?? r.staff_id ?? r.id;
      if (id == null) continue;
      map.set(String(id), {
        ten: r.staff_name || r.name || '',
        email: r.staff_email || r.email || '',
        code: r.code || r.staff_code || ''
      });
    }
  } catch (e) { if (!asJson) console.error('  (khong doc duoc danh ba:', e.message + ')'); }
  return map;
}

// ---- Giai ma payload JWT (khong xac thuc chu ky, chi doc claim) ----
function docJwt(tok) {
  try {
    let b = tok.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b.length % 4) b += '=';
    return JSON.parse(Buffer.from(b, 'base64').toString('utf8'));
  } catch { return null; }
}

// ---- Cac thu muc Local Storage leveldb can soi ----
function cacThuMucLeveldb() {
  const dirArg = val('--dir', '');
  if (dirArg) return [dirArg];
  const dirs = [];
  const bases = [];
  const APPDATA = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');

  bases.push(['Edge', path.join(LOCAL, 'Microsoft', 'Edge', 'User Data')]);
  bases.push(['Chrome', path.join(LOCAL, 'Google', 'Chrome', 'User Data')]);
  bases.push(['CocCoc', path.join(LOCAL, 'CocCoc', 'Browser', 'User Data')]);
  bases.push(['Brave', path.join(LOCAL, 'BraveSoftware', 'Brave-Browser', 'User Data')]);
  bases.push(['Opera', path.join(APPDATA, 'Opera Software', 'Opera Stable')]);
  bases.push(['OperaGX', path.join(APPDATA, 'Opera Software', 'Opera GX Stable')]);
  bases.push(['Vivaldi', path.join(LOCAL, 'Vivaldi', 'User Data')]);
  bases.push(['Yandex', path.join(LOCAL, 'Yandex', 'YandexBrowser', 'User Data')]);

  for (const [_ten, base] of bases) {
    if (!fs.existsSync(base)) continue;
    let profiles = ['Default'];
    if (has('--all-profiles') || true) {
      try {
        const found = fs.readdirSync(base).filter(d => d === 'Default' || /^Profile \d+$/i.test(d));
        if (found.length) profiles = found;
      } catch {}
    }
    for (const pf of profiles) {
      const d = path.join(base, pf, 'Local Storage', 'leveldb');
      if (fs.existsSync(d)) dirs.push(d);
      // Opera co the de leveldb ngay tai root cua Profile/Opera Stable
      const dDirect = path.join(base, 'Local Storage', 'leveldb');
      if (fs.existsSync(dDirect) && !dirs.includes(dDirect)) dirs.push(dDirect);
    }
  }
  return dirs;
}

// ---- Doc 1 file leveldb (chiu file dang bi khoa: thu doc, loi thi chep tam) ----
function docFileAnToan(fp) {
  try { return fs.readFileSync(fp); }
  catch {
    try { const tmp = path.join(os.tmpdir(), 'ldb-' + Date.now() + '-' + path.basename(fp)); fs.copyFileSync(fp, tmp); const b = fs.readFileSync(tmp); fs.unlinkSync(tmp); return b; }
    catch { return null; }
  }
}

// ---- Quet 1 thu muc leveldb -> tim auth_store + JWT WMS ----
const RE_JWT = /eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/g;
const RE_ORIGIN = /https?:\/\/[A-Za-z0-9.\-]+/g;

function quetThuMuc(dir) {
  const ket = [];
  let files = [];
  try { files = fs.readdirSync(dir).filter(f => /\.(ldb|log)$/i.test(f)); } catch { return ket; }
  for (const f of files) {
    const buf = docFileAnToan(path.join(dir, f));
    if (!buf) continue;
    const s = buf.toString('latin1');
    let idx = s.indexOf('auth_store');
    while (idx !== -1) {
      // origin thuong dung ngay truoc key trong leveldb localStorage
      const truoc = s.slice(Math.max(0, idx - 120), idx);
      const org = (truoc.match(RE_ORIGIN) || []).pop() || '';
      // JWT nam sau key auth_store (trong gia tri {state:{token:...}})
      const sau = s.slice(idx, idx + 4000);
      const m = sau.match(RE_JWT);
      if (m) {
        for (const tok of m) {
          const p = docJwt(tok);
          if (!p) continue;
          const aud = JSON.stringify(p.aud || '') + ' ' + (p.iss || '');
          ket.push({ file: f, origin: org, sub: p.sub != null ? String(p.sub) : '', jti: p.jti || '', exp: p.exp || 0, aud_iss: aud });
        }
      }
      idx = s.indexOf('auth_store', idx + 10);
    }
  }
  // gop theo sub (giu exp lon nhat)
  const theoSub = new Map();
  for (const k of ket) {
    const cur = theoSub.get(k.sub);
    if (!cur || (k.exp || 0) > (cur.exp || 0)) theoSub.set(k.sub, k);
  }
  return [...theoSub.values()];
}

// ================== MAIN ==================
const db = napDanhBa();
const dirs = cacThuMucLeveldb();
const out = [];
for (const d of dirs) {
  for (const r of quetThuMuc(d)) {
    const nb = db.get(r.sub) || {};
    out.push({
      leveldb: d,
      origin: r.origin,
      sub: r.sub,
      taiKhoan: nb.email || '',
      ten: nb.ten || '',
      code: nb.code || '',
      het_han: r.exp ? new Date(r.exp * 1000).toISOString() : '',
      con_han: r.exp ? (r.exp * 1000 > Date.now()) : null,
      nguon_file: r.file
    });
  }
}

if (asJson) {
  process.stdout.write(JSON.stringify(out, null, 2));
} else {
  console.log('');
  console.log('  === SOI auth_store (tai khoan WMS @hasaki dang/da dang nhap trinh duyet) ===');
  console.log('  Danh ba: ' + db.size + ' nhan su. Thu muc leveldb soi: ' + dirs.length);
  if (!dirs.length) console.log('  (Khong thay thu muc leveldb nao. Dung --dir= de chi thu muc chep tu \\\\HOST\\C$.)');
  if (!out.length) console.log('  -> KHONG tim thay auth_store/JWT WMS nao (co the chua tung dang nhap, hoac gia tri bi nen Snappy trong .ldb).');
  for (const r of out) {
    console.log('');
    console.log('  origin     : ' + (r.origin || '(khong ro)'));
    console.log('  sub (uid)  : ' + r.sub);
    console.log('  tai khoan  : ' + (r.taiKhoan || '(khong co trong danh ba)') + (r.ten ? '  [' + r.ten + (r.code ? ' - ' + r.code : '') + ']' : ''));
    console.log('  token      : ' + (r.con_han === true ? 'CON HAN' : r.con_han === false ? 'het han' : '?') + (r.het_han ? ' (het ' + r.het_han + ')' : ''));
    console.log('  file       : ' + r.nguon_file);
  }
  console.log('');
}
