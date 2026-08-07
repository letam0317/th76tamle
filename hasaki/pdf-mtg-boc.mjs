/**
 * pdf-mtg-boc.mjs — bóc MẶT BẰNG từ MTG_zigzag.pdf (bản vẽ AutoCAD, vector, không ảnh).
 *
 * Cấu trúc file: /Contents [5 0 R 9 0 R] (2 stream FlateDecode), /MediaBox 1728×2592,
 * /Rotate 270, font Type0 Identity-H nên chuỗi chữ là HEX glyph-id → phải giải qua
 * ToUnicode CMap (object 7, không nén). Xuất:
 *   .exports/mtg-zigzag.json  — chữ + toạ độ, đoạn thẳng, khung (toạ độ PDF gốc)
 *   .exports/mtg-zigzag.svg   — để nhìn bằng mắt (đã xoay 270° như khi in)
 */
import fs from "node:fs"; import zlib from "node:zlib"; import path from "node:path";
import { fileURLToPath } from "node:url";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC = process.argv[2] || "C:/Users/lechitam/OneDrive/Desktop/MTG_zigzag.pdf";
const buf = fs.readFileSync(SRC);
const raw = buf.toString("latin1");

/* ---------- 1) tách object ---------- */
const objs = {};
{
  const re = /(\d+)\s+(\d+)\s+obj\b/g; let m; const list = [];
  while ((m = re.exec(raw))) list.push({ n: +m[1], at: m.index, hdr: re.lastIndex });
  list.forEach((o, i) => {
    const end = i + 1 < list.length ? list[i + 1].at : raw.length;
    const body = raw.slice(o.hdr, end);
    const si = body.indexOf("stream");
    let data = null;
    if (si >= 0) {
      const st = si + (body.substr(si + 6, 2) === "\r\n" ? 8 : 7);
      const en = body.indexOf("endstream", st);
      const d = Buffer.from(body.slice(st, en), "latin1");
      if (/\/Filter\s*\/FlateDecode/.test(body.slice(0, si))) {
        try { data = zlib.inflateSync(d); } catch { try { data = zlib.inflateRawSync(d); } catch { data = d; } }
      } else data = d;
    }
    objs[o.n] = { dict: si >= 0 ? body.slice(0, si) : body, data };
  });
}

/* ---------- 2) ToUnicode CMap (glyph id → ký tự) ---------- */
const cmap = {};
{
  const t = objs[7] && objs[7].data ? objs[7].data.toString("latin1") : "";
  for (const blk of t.matchAll(/beginbfchar([\s\S]*?)endbfchar/g))
    for (const p of blk[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g))
      cmap[parseInt(p[1], 16)] = String.fromCharCode(...(p[2].match(/.{4}/g) || []).map((h) => parseInt(h, 16)));
  for (const blk of t.matchAll(/beginbfrange([\s\S]*?)endbfrange/g))
    for (const p of blk[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      const a = parseInt(p[1], 16), b = parseInt(p[2], 16), c = parseInt(p[3], 16);
      for (let i = a; i <= b; i++) cmap[i] = String.fromCharCode(c + (i - a));
    }
}
const deHex = (h) => (h.replace(/\s/g, "").match(/.{4}/g) || []).map((x) => cmap[parseInt(x, 16)] ?? "").join("");

/* ---------- 3) máy trạng thái đồ hoạ ---------- */
const content = Buffer.concat([objs[5].data, Buffer.from("\n"), objs[9].data]).toString("latin1");
fs.mkdirSync(path.join(DIR, ".exports"), { recursive: true });
fs.writeFileSync(path.join(DIR, ".exports", "mtg-content.txt"), content);

const mul = (a, b) => [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3], a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5]];
const app = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

let ctm = [1, 0, 0, 1, 0, 0]; const stack = [];
let tm = [1, 0, 0, 1, 0, 0], tlm = tm.slice(), tf = 1;
const texts = [], lines = [], rects = [];
let cur = null, sub0 = null;
const ops = [];   // toán hạng đang gom

/* tokenizer: PDF content là chuỗi token phân cách bởi khoảng trắng, KHÔNG theo dòng */
const tokRe = /<([0-9A-Fa-f\s]*)>|\[((?:[^\[\]\\]|\\.)*)\]|\(((?:[^()\\]|\\.)*)\)|\/([^\s/<>\[\]()]+)|([-+]?[\d.]+)|([A-Za-z'"*]+)/g;
let t;
while ((t = tokRe.exec(content))) {
  if (t[1] !== undefined) { ops.push({ hex: t[1] }); continue; }
  if (t[2] !== undefined) { ops.push({ arr: t[2] }); continue; }
  if (t[3] !== undefined) { ops.push({ str: t[3] }); continue; }
  if (t[4] !== undefined) { ops.push({ name: t[4] }); continue; }
  if (t[5] !== undefined) { ops.push(Number(t[5])); continue; }
  const op = t[6];
  const n = (i) => Number(ops[ops.length - i]) || 0;
  switch (op) {
    case "q": stack.push(ctm.slice()); break;
    case "Q": ctm = stack.pop() || [1, 0, 0, 1, 0, 0]; break;
    case "cm": ctm = mul([n(6), n(5), n(4), n(3), n(2), n(1)], ctm); break;
    case "BT": tm = tlm = [1, 0, 0, 1, 0, 0]; break;
    case "Tm": tm = tlm = [n(6), n(5), n(4), n(3), n(2), n(1)]; break;
    case "Td": tlm = mul([1, 0, 0, 1, n(2), n(1)], tlm); tm = tlm.slice(); break;
    case "TD": tlm = mul([1, 0, 0, 1, n(2), n(1)], tlm); tm = tlm.slice(); break;
    case "T*": tlm = mul([1, 0, 0, 1, 0, -tf], tlm); tm = tlm.slice(); break;
    case "Tf": tf = n(1); break;
    case "Tj": case "TJ": {
      const last = ops[ops.length - 1];
      let s = "";
      if (last && last.hex !== undefined) s = deHex(last.hex);
      else if (last && last.str !== undefined) s = last.str;
      else if (last && last.arr !== undefined) s = [...last.arr.matchAll(/<([0-9A-Fa-f\s]*)>/g)].map((x) => deHex(x[1])).join("");
      if (s.trim()) {
        const M = mul(tm, ctm), p = app(M, 0, 0);
        texts.push({ s, x: p[0], y: p[1], size: tf * Math.hypot(M[0], M[1]), rot: Math.atan2(M[1], M[0]) * 180 / Math.PI });
      }
      break;
    }
    case "re": {
      const [x, y, w, h] = [n(4), n(3), n(2), n(1)];
      const a = app(ctm, x, y), b = app(ctm, x + w, y + h);
      rects.push({ x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(b[0] - a[0]), h: Math.abs(b[1] - a[1]) });
      break;
    }
    case "m": cur = sub0 = app(ctm, n(2), n(1)); break;
    case "l": { const p = app(ctm, n(2), n(1)); if (cur) lines.push({ x1: cur[0], y1: cur[1], x2: p[0], y2: p[1] }); cur = p; break; }
    case "c": { const p = app(ctm, n(2), n(1)); if (cur) lines.push({ x1: cur[0], y1: cur[1], x2: p[0], y2: p[1], c: 1 }); cur = p; break; }
    case "v": case "y": { const p = app(ctm, n(2), n(1)); if (cur) lines.push({ x1: cur[0], y1: cur[1], x2: p[0], y2: p[1], c: 1 }); cur = p; break; }
    case "h": if (cur && sub0) { lines.push({ x1: cur[0], y1: cur[1], x2: sub0[0], y2: sub0[1] }); cur = sub0; } break;
    default: break;
  }
  if (!/^(q|Q|BT|ET|W|n|f|F|S|s|B|b|h)$/.test(op) || /^(h)$/.test(op)) ops.length = 0; else ops.length = 0;
}

const W = 1728, H = 2592;
console.log(`Chữ: ${texts.length} · đoạn: ${lines.length} · khung: ${rects.length}`);
fs.writeFileSync(path.join(DIR, ".exports", "mtg-zigzag.json"), JSON.stringify({ src: SRC, W, H, rotate: 270, texts, lines, rects }));

/* ---------- 4) SVG (xoay 270° cho đúng chiều đọc như bản in) ---------- */
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const body = [
  ...lines.map((l) => `<line x1="${l.x1.toFixed(1)}" y1="${l.y1.toFixed(1)}" x2="${l.x2.toFixed(1)}" y2="${l.y2.toFixed(1)}"/>`),
  ...rects.map((r) => `<rect x="${r.x.toFixed(1)}" y="${r.y.toFixed(1)}" width="${r.w.toFixed(1)}" height="${r.h.toFixed(1)}" fill="none"/>`),
  ...texts.map((t) => `<g transform="translate(${t.x.toFixed(1)},${t.y.toFixed(1)}) scale(1,-1) rotate(${(-t.rot).toFixed(1)})"><text font-size="${Math.max(3, t.size).toFixed(1)}" fill="#c00" stroke="none" font-family="Times New Roman" font-weight="bold">${esc(t.s)}</text></g>`),
].join("\n");
fs.writeFileSync(path.join(DIR, ".exports", "mtg-zigzag.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${H} ${W}" width="${H}" height="${W}"><rect width="100%" height="100%" fill="#fff"/>` +
  `<g stroke="#111" stroke-width="0.8" transform="rotate(-90 0 0) translate(${-H},0) translate(0,${W}) scale(1,-1)">${body}</g></svg>`);
console.log("Đã lưu .exports/mtg-zigzag.json + .svg");

const uniq = {}; texts.forEach((t) => (uniq[t.s.trim()] = (uniq[t.s.trim()] || 0) + 1));
console.log("\nNhãn:");
Object.entries(uniq).sort((a, b) => b[1] - a[1]).slice(0, 100).forEach(([k, v]) => console.log(`  ${String(v).padStart(3)} × "${k}"`));
