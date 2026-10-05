#!/usr/bin/env node
// Lấy danh sách vụ án Trung Quốc từ Wikipedia tiếng Trung qua API chính thức (không cào HTML)
// → ho-so/danh-sach.json + ho-so/danh-sach.csv
// Chạy lại chỉ THÊM vụ mới, không ghi đè dòng đã có (khoá = tên trang Wikipedia).
// Dịch tên + tóm tắt sang tiếng Việt bằng Gemini nếu có GEMINI_API_KEY (.env ở đây, hoặc hasaki/.env chỉ đọc).
//
// Dùng:  node lay-danh-sach-vu-an.mjs [--so=30] [--khong-dich] [--dich-toi-da=20]
//   --so=N          số vụ tối thiểu muốn có trong sổ sau lượt này (mặc định 30)
//   --khong-dich    chỉ lấy, không gọi Gemini
//   --dich-toi-da=N mỗi lượt dịch tối đa N dòng chưa có tiếng Việt (mặc định 20, tránh vượt gói free)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const HO_SO = path.join(DIR, 'ho-so');
const JSON_P = path.join(HO_SO, 'danh-sach.json');
const CSV_P = path.join(HO_SO, 'danh-sach.csv');

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? '1'] : [a, '1'];
}));
const SO = Number(args.so) || 30;
const DICH = !args['khong-dich'];
const DICH_MAX = Number(args['dich-toi-da']) || 20;

const API = 'https://zh.wikipedia.org/w/api.php';
const UA = 'kenh-trinh-tham-bot/0.1 (nghien cuu ca nhan; Node.js fetch)';

// Nguồn 1: danh mục (có thể không tồn tại → bỏ qua êm)
const DANH_MUC = [
  'Category:中华人民共和国杀人案件',
  'Category:中华人民共和国刑事案件',
  'Category:中华人民共和国绑架案',
  'Category:中国连环杀手',
  'Category:中华人民共和国投毒案',
  'Category:中华人民共和国抢劫案',
];
// Nguồn 2: tìm kiếm toàn văn
const TU_KHOA = ['杀人案 中国 判决', '碎尸案', '连环杀手 中国', '绑架案 中国 判处', '灭门案', '投毒案 中国', '故意杀人罪 死刑 案'];

const TINH = ['北京', '天津', '上海', '重庆', '河北', '山西', '辽宁', '吉林', '黑龙江', '江苏', '浙江', '安徽', '福建', '江西', '山东',
  '河南', '湖北', '湖南', '广东', '海南', '四川', '贵州', '云南', '陕西', '甘肃', '青海', '台湾', '内蒙古', '广西', '西藏', '宁夏', '新疆', '香港', '澳门'];
const LOAI_TRU = /列表|电影|电视剧|小说|游戏|漫画|专辑|歌曲|消歧义|纪录片/;

function docEnv(p) {
  try {
    return Object.fromEntries(fs.readFileSync(p, 'utf8').split(/\r?\n/)
      .map(l => l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)).filter(Boolean)
      .map(m => [m[1], m[2].replace(/^["']|["']$/g, '')]));
  } catch { return {}; }
}
function layKhoaGemini() {
  if (process.env.GEMINI_API_KEY) return { key: process.env.GEMINI_API_KEY, nguon: 'biến môi trường' };
  const a = docEnv(path.join(DIR, '.env'));
  if (a.GEMINI_API_KEY) return { key: a.GEMINI_API_KEY, nguon: 'kenh-trinh-tham/.env' };
  const b = docEnv(path.join(DIR, '..', 'hasaki', '.env'));
  if (b.GEMINI_API_KEY) return { key: b.GEMINI_API_KEY, nguon: 'hasaki/.env (chỉ đọc)' };
  return null;
}

async function wiki(params, lan = 0) {
  const u = new URL(API);
  Object.entries({ format: 'json', formatversion: 2, origin: '*', maxlag: 5, ...params }).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA } });
  if ((r.status === 429 || r.status === 503) && lan < 6) {
    const ra = Number(r.headers.get('retry-after')) || 0; const cho = Math.max(ra * 1000, 5000 * (lan + 1));
    console.log(`  Wikipedia ${r.status} (bị giới hạn tốc độ), chờ ${cho / 1000}s rồi thử lại…`); await ngu(cho); return wiki(params, lan + 1);
  }
  if (!r.ok) throw new Error(`Wikipedia ${r.status} ${params.list || params.prop || ''}`);
  const j = await r.json();
  if (j.error?.code === 'maxlag' && lan < 6) { await ngu(6000); return wiki(params, lan + 1); }
  return j;
}
const ngu = ms => new Promise(r => setTimeout(r, ms));

async function layTenTrang() {
  const ten = new Map(); // title → nguồn
  for (const cm of DANH_MUC) {
    try {
      const j = await wiki({ action: 'query', list: 'categorymembers', cmtitle: cm, cmnamespace: 0, cmlimit: 100 });
      for (const m of j.query?.categorymembers || []) if (!ten.has(m.title)) ten.set(m.title, cm);
    } catch (e) { console.log(`  bỏ qua ${cm}: ${e.message}`); }
    await ngu(1200);
  }
  for (const q of TU_KHOA) {
    try {
      const j = await wiki({ action: 'query', list: 'search', srsearch: q, srnamespace: 0, srlimit: 50 });
      for (const m of j.query?.search || []) if (!ten.has(m.title)) ten.set(m.title, `tìm: ${q}`);
    } catch (e) { console.log(`  bỏ qua tìm "${q}": ${e.message}`); }
    await ngu(1500);
  }
  return ten;
}

function locTen(t) {
  if (LOAI_TRU.test(t)) return false;
  return /案|杀手|事件|命案/.test(t);
}

async function layChiTiet(titles) {
  const ra = [];
  for (let i = 0; i < titles.length; i += 20) {
    const lo = titles.slice(i, i + 20);
    const j = await wiki({
      action: 'query', prop: 'extracts|pageprops|info', exintro: 1, explaintext: 1, exlimit: 20,
      inprop: 'url', ppprop: 'disambiguation', titles: lo.join('|'), redirects: 1,
    });
    for (const p of j.query?.pages || []) {
      if (p.missing || p.pageprops?.disambiguation !== undefined) continue;
      const tomTat = (p.extract || '').replace(/\s+/g, ' ').trim();
      if (tomTat.length < 60) continue;
      const nam = (p.title + ' ' + tomTat).match(/((?:19|20)\d{2})年/)?.[1] || '';
      const tinh = TINH.find(t => tomTat.includes(t)) || '';
      ra.push({ ten_zh: p.title, nam, tinh, tom_tat_zh: tomTat.slice(0, 700), url: p.fullurl || `https://zh.wikipedia.org/wiki/${encodeURIComponent(p.title)}` });
    }
    await ngu(2000);
  }
  return ra;
}

async function dichGemini(key, dong) {
  const models = (process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : []).concat(['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-flash-latest']);
  const prompt = `Bạn là biên tập viên kênh kể chuyện vụ án tiếng Việt. Dịch sang tiếng Việt tự nhiên, tên riêng đọc theo Hán Việt và kèm chữ Hán trong ngoặc ở lần đầu. KHÔNG mô tả chi tiết cách gây án. Trả về JSON duy nhất dạng {"ten_vi":"...","tom_tat_vi":"..."} (tóm tắt 2–4 câu).\nTên: ${dong.ten_zh}\nTóm tắt gốc: ${dong.tom_tat_zh}`;
  let loiCuoi = '';
  for (const m of models) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, responseMimeType: 'application/json' } }),
    });
    if (r.status === 429) throw new Error('429: hết hạn mức Gemini, dừng dịch lượt này');
    if (!r.ok) { loiCuoi = `${m} → ${r.status}`; continue; }
    const j = await r.json();
    const txt = j.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
    try { const o = JSON.parse(txt.replace(/^```json|```$/gm, '').trim()); if (o.tom_tat_vi) return { ...o, model: m }; }
    catch { loiCuoi = `${m}: JSON lỗi`; }
  }
  throw new Error(loiCuoi || 'không model nào trả lời');
}

function ghiCsv(rows) {
  const cot = ['ten_zh', 'ten_vi', 'nam', 'tinh', 'tom_tat_vi', 'tom_tat_zh', 'url', 'nguon', 'them_ngay', 'trang_thai'];
  const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const body = rows.map(r => cot.map(c => q(r[c])).join(',')).join('\r\n');
  fs.writeFileSync(CSV_P, '﻿' + cot.join(',') + '\r\n' + body + '\r\n', 'utf8');
}

async function main() {
  fs.mkdirSync(HO_SO, { recursive: true });
  const so = fs.existsSync(JSON_P) ? JSON.parse(fs.readFileSync(JSON_P, 'utf8')) : [];
  const daCo = new Set(so.map(r => r.ten_zh));
  console.log(`Sổ hiện có ${so.length} vụ. Mục tiêu ≥ ${SO}.`);

  if (so.length < SO) {
    console.log('Lấy tên trang từ Wikipedia tiếng Trung…');
    const ten = await layTenTrang();
    const ungVien = [...ten.entries()].filter(([t]) => locTen(t) && !daCo.has(t));
    console.log(`  ${ten.size} tên thô → ${ungVien.length} ứng viên sau lọc`);
    const chiTiet = await layChiTiet(ungVien.map(([t]) => t).slice(0, Math.max(SO * 2, 60)));
    const homNay = new Date().toISOString().slice(0, 10);
    let them = 0;
    for (const c of chiTiet) {
      if (daCo.has(c.ten_zh)) continue;
      so.push({ ...c, ten_vi: '', tom_tat_vi: '', nguon: ten.get(c.ten_zh) || 'zh.wikipedia', them_ngay: homNay, trang_thai: 'moi' });
      daCo.add(c.ten_zh); them++;
      if (so.length >= SO * 2) break;
    }
    console.log(`  thêm ${them} vụ mới (tổng ${so.length})`);
  }

  if (DICH) {
    const k = layKhoaGemini();
    if (!k) console.log('Không có GEMINI_API_KEY → bỏ qua dịch. Điền vào kenh-trinh-tham/.env rồi chạy lại.');
    else {
      const can = so.filter(r => !r.tom_tat_vi).slice(0, DICH_MAX);
      console.log(`Dịch ${can.length} dòng bằng Gemini (khoá từ ${k.nguon})…`);
      let loiLienTiep = 0, xong = 0;
      for (const r of can) {
        try { const d = await dichGemini(k.key, r); r.ten_vi = d.ten_vi || r.ten_vi; r.tom_tat_vi = d.tom_tat_vi; r.dich_model = d.model; process.stdout.write('.'); loiLienTiep = 0; xong++; }
        catch (e) {
          if (String(e.message).startsWith('429')) { console.log(`
  dừng dịch: ${e.message}`); break; }
          loiLienTiep++; console.log(`
  bỏ qua "${r.ten_zh}": ${e.message}`);
          if (loiLienTiep >= 3) { console.log('  3 lỗi liền, dừng dịch lượt này (chạy lại sau).'); break; }
        }
        await ngu(1500);
      }
      console.log(`
  dịch xong ${xong}/${can.length}`);
      console.log('');
    }
  }

  so.sort((a, b) => (b.nam || '').localeCompare(a.nam || ''));
  fs.writeFileSync(JSON_P, JSON.stringify(so, null, 2), 'utf8');
  ghiCsv(so);
  const daDich = so.filter(r => r.tom_tat_vi).length;
  console.log(`Ghi ${JSON_P}\nGhi ${CSV_P}\nTổng ${so.length} vụ, đã có tiếng Việt ${daDich}, năm có ${so.filter(r => r.nam).length}, tỉnh có ${so.filter(r => r.tinh).length}.`);
  console.table(so.slice(0, 10).map(r => ({ nam: r.nam, tinh: r.tinh, ten: r.ten_vi || r.ten_zh })));
}

main().catch(e => { console.error('LỖI:', e.message); process.exit(1); });
