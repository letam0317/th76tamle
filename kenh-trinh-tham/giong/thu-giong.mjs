#!/usr/bin/env node
// Tạo mẫu giọng cùng một kịch bản 60 giây bằng nhiều engine → giong/thu/
//   A, B = edge-tts (vi-VN-NamMinhNeural, vi-VN-HoaiMyNeural) — miễn phí, không cần khoá
//   C    = Gemini TTS (nếu có GEMINI_API_KEY) — gói free
//   D    = VieNeu-TTS (nếu đã cài ở giong/vieneu) — in hướng dẫn, chạy riêng bằng giao diện web
// Sau đó tạo bộ nghe mù giong/thu/nghe-mu/ (Mau-1.., dap-an.txt) để 3 người chấm.
//
// Dùng: node giong/thu-giong.mjs [--chi=edge|gemini] [--giong-gemini=Charon] [--kich-ban=duong/dan.txt]

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const THU = path.join(DIR, 'thu');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? '1'] : [a, '1']; }));
const KICH_BAN = path.resolve(args['kich-ban'] || path.join(DIR, 'kich-ban-thu-60s.txt'));
const CHI = args.chi || '';
const GIONG_GEMINI = args['giong-gemini'] || 'Charon';

fs.mkdirSync(THU, { recursive: true });
const vanBan = fs.readFileSync(KICH_BAN, 'utf8').replace(/\[hạ giọng\]\s*/g, '').trim();
const ketQua = [];

function docEnv(p) { try { return Object.fromEntries(fs.readFileSync(p, 'utf8').split(/\r?\n/).map(l => l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^["']|["']$/g, '')])); } catch { return {}; } }
function khoaGemini() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  return docEnv(path.join(DIR, '..', '.env')).GEMINI_API_KEY || docEnv(path.join(DIR, '..', '..', 'hasaki', '.env')).GEMINI_API_KEY || '';
}
const envNoiBo = { ...docEnv(path.join(DIR, '..', '.env')) };

// --- A, B: edge-tts ---------------------------------------------------------
function edge(ten, voice, rate) {
  const out = path.join(THU, `${ten}.mp3`);
  const r = spawnSync('python', ['-m', 'edge_tts', '--voice', voice, `--rate=${rate}`, '--file', KICH_BAN, '--write-media', out, '--write-subtitles', out.replace(/\.mp3$/, '.srt')], { encoding: 'utf8', timeout: 180000 });
  const ok = r.status === 0 && fs.existsSync(out) && fs.statSync(out).size > 10000;
  ketQua.push({ ma: ten, engine: `edge-tts ${voice}`, tep: ok ? out : '', loi: ok ? '' : (r.stderr || r.stdout || `exit ${r.status}`).trim().split('\n').slice(-2).join(' ') });
}

// --- C: Gemini TTS ----------------------------------------------------------
function wavTuPcm(pcm, rate = 24000, kenh = 1, bit = 16) {
  const h = Buffer.alloc(44); const byteRate = rate * kenh * bit / 8;
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20);
  h.writeUInt16LE(kenh, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(byteRate, 28); h.writeUInt16LE(kenh * bit / 8, 32); h.writeUInt16LE(bit, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
async function gemini() {
  const key = khoaGemini();
  if (!key) { ketQua.push({ ma: 'C-gemini', engine: 'Gemini TTS', tep: '', loi: 'không có GEMINI_API_KEY' }); return; }
  const models = [envNoiBo.GEMINI_TTS_MODEL, process.env.GEMINI_TTS_MODEL, 'gemini-3.8-flash-tts', 'gemini-2.5-flash-preview-tts', 'gemini-3.1-flash-tts-preview'].filter(Boolean);
  const chiDan = 'Đọc bằng tiếng Việt như người dẫn chuyện vụ án trên podcast: giọng nam trầm, chậm vừa, ngắt rõ ở dấu chấm và dấu ba chấm, nhấn vào con số và tên riêng, đoạn cuối hạ giọng và chậm lại. Không đọc tiêu đề dòng đầu.\n\n';
  let loiCuoi = '';
  for (const m of models) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: chiDan + vanBan }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: GIONG_GEMINI } } } } }),
      });
      if (!r.ok) { loiCuoi = `${m} → HTTP ${r.status} ${(await r.text()).slice(0, 160)}`; continue; }
      const j = await r.json();
      const part = j.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      if (!part) { loiCuoi = `${m}: không có audio trong trả lời`; continue; }
      const mime = part.inlineData.mimeType || ''; const rate = Number(mime.match(/rate=(\d+)/)?.[1] || 24000);
      const out = path.join(THU, `C-gemini-${GIONG_GEMINI}.wav`);
      fs.writeFileSync(out, wavTuPcm(Buffer.from(part.inlineData.data, 'base64'), rate));
      ketQua.push({ ma: 'C-gemini', engine: `Gemini TTS ${m} / ${GIONG_GEMINI}`, tep: out, loi: '' }); return;
    } catch (e) { loiCuoi = `${m}: ${e.message}`; }
  }
  ketQua.push({ ma: 'C-gemini', engine: 'Gemini TTS', tep: '', loi: loiCuoi });
}

// --- D: VieNeu --------------------------------------------------------------
function vieneu() {
  const goc = path.join(DIR, 'vieneu');
  const daCai = fs.existsSync(path.join(goc, '.venv')) || fs.existsSync(path.join(goc, 'pyproject.toml'));
  ketQua.push({ ma: 'D-vieneu', engine: 'VieNeu-TTS (clone giọng mình)', tep: '', loi: daCai ? 'tạo bằng: cd giong/vieneu && uv run python ../vieneu-tao-mau.py (ra giong/thu/D-vieneu-*.wav)' : 'chưa cài (giong/vieneu trống), xem giong/VIENEU-CAI-DAT.md' });
}

// --- bộ nghe mù ---------------------------------------------------------------
function ngheMu() {
  const tenEngine = Object.fromEntries(ketQua.filter(k => k.tep).map(k => [path.basename(k.tep), k.engine]));
  // gom MỌI mẫu đang có trong giong/thu (A..E), kể cả mẫu tạo ở lượt trước hoặc tạo tay
  const tatCa = fs.readdirSync(THU).filter(f => /^[A-E]-.*\.(wav|mp3)$/i.test(f)).sort().map(f => ({ engine: tenEngine[f] || f.replace(/\.(wav|mp3)$/i, ''), tep: path.join(THU, f) }));
  if (tatCa.length < 2) return;
  const nm = path.join(THU, 'nghe-mu'); fs.rmSync(nm, { recursive: true, force: true }); fs.mkdirSync(nm);
  const tron = tatCa.map((k, i) => ({ k, r: Math.sin(i * 9301 + Date.now() % 7919) })).sort((a, b) => a.r - b.r).map(x => x.k);
  const dapAn = tron.map((k, i) => { const ten = `Mau-${i + 1}${path.extname(k.tep)}`; fs.copyFileSync(k.tep, path.join(nm, ten)); return `${ten}\t${k.engine}`; });
  fs.writeFileSync(path.join(nm, 'dap-an.txt'), 'KHÔNG mở tệp này trước khi chấm xong.\n' + dapAn.join('\n') + '\n', 'utf8');
  fs.writeFileSync(path.join(nm, 'PHIEU-CHAM.md'), `# Phiếu chấm nghe mù\n\nMỗi người nghe hết từng mẫu rồi chấm 1–5 cho từng cột. Đạt khi trung bình ≥ 4 và ≥ 80 % điểm của bản giọng thật (nếu có).\n\n| Mẫu | Tự nhiên | Ngắt nghỉ đúng dấu | Đọc số đúng | Tên riêng đúng | Cảm xúc | Tổng |\n|---|---|---|---|---|---|---|\n${tron.map((_, i) => `| Mau-${i + 1} |  |  |  |  |  |  |`).join('\n')}\n\nChỗ cần nghe kỹ: "hai mươi ba giờ mười lăm phút", "một triệu hai trăm năm mươi nghìn", "Thẩm Dương", "Liêu Ninh", "CSĐT", "VKSND", "TP.HCM", câu ngắn "Nghe thì bình thường.", đoạn hạ giọng cuối.\n`, 'utf8');
  console.log(`Bộ nghe mù: ${nm} (${tatCa.length} mẫu, đáp án trong dap-an.txt)`);
}

(async () => {
  console.log(`Kịch bản: ${KICH_BAN} (${vanBan.length} ký tự)`);
  if (!CHI || CHI === 'edge') { edge('A-edge-NamMinh', 'vi-VN-NamMinhNeural', '-6%'); edge('B-edge-HoaiMy', 'vi-VN-HoaiMyNeural', '-6%'); }
  if (!CHI || CHI === 'gemini') await gemini();
  vieneu();
  console.table(ketQua.map(k => ({ ma: k.ma, engine: k.engine, tep: k.tep ? `${path.basename(k.tep)} (${Math.round(fs.statSync(k.tep).size / 1024)} KB)` : '', loi: k.loi })));
  ngheMu();
  console.log('Bước tiếp: mở giong/thu/, nghe từng mẫu, chấm theo giong/thu/nghe-mu/PHIEU-CHAM.md. Chi tiết luật và nguồn: giong/KIEM-THU-GIONG.md');
})();
