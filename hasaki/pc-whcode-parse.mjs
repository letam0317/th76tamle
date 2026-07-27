/** Parse sheet "Warehouse code" từ template ĐÃ GIẢI NÉN (tpl-x/) và ghi lên tab qua pc_save_whcode. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const GAS = process.env.APPSCRIPT_URL || "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
const PC_KEY = fs.readFileSync(process.argv[2], "utf8").trim();
const dirX = path.join(DIR, ".wms-session", "tpl-x");
const log = (...a) => console.log(...a);

const wb = fs.readFileSync(path.join(dirX, "xl/workbook.xml"), "utf8");
const sheets = [...wb.matchAll(/<sheet[^>]*name="([^"]*)"[^>]*r:id="(rId\d+)"/g)].map((m) => ({ name: m[1], rid: m[2] }));
log("Các sheet trong template:", sheets.map((s) => s.name).join(" | "));
const sh = sheets.find((s) => /warehouse\s*code/i.test(s.name));
if (!sh) { log("✗ Không thấy sheet Warehouse code"); process.exit(2); }
const rels = fs.readFileSync(path.join(dirX, "xl/_rels/workbook.xml.rels"), "utf8");
const rel = new RegExp('Id="' + sh.rid + '"[^>]*Target="([^"]*)"').exec(rels) || new RegExp('Target="([^"]*)"[^>]*Id="' + sh.rid + '"').exec(rels);
let ss = [];
try {
  const s = fs.readFileSync(path.join(dirX, "xl/sharedStrings.xml"), "utf8");
  ss = [...s.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(""));
} catch {}
const giai = (t) => t.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
const xml = fs.readFileSync(path.join(dirX, "xl", rel[1].replace(/^\/?(xl\/)?/, "")), "utf8");
const raw = [];
for (const rm of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
  const cells = {};
  // hỗ trợ cả 3 kiểu ô: sharedStrings (t="s" + <v>idx</v>), số thô (<v>), inlineStr (<is><t>…</t></is>)
  for (const cm of rm[1].matchAll(/<c [^>]*r="([A-Z]+)\d+"[^>]*>([\s\S]*?)<\/c>/g)) {
    const col = cm[1], body = cm[2];
    const attrs = cm[0].slice(0, cm[0].indexOf(">"));
    const isShared = /t="s"/.test(attrs);
    const vIn = /<is>[\s\S]*?<\/is>/.exec(body);
    if (vIn) { cells[col] = giai([...vIn[0].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")); continue; }
    const v = /<v>([\s\S]*?)<\/v>/.exec(body);
    if (!v) continue;
    cells[col] = isShared ? giai(ss[Number(v[1])] || "") : giai(v[1]);
  }
  raw.push(cells);
}
const rows = raw.slice(1).map((c) => [String(c.A || "").trim(), String(c.B || "").replace(/\s+/g, " ").trim(), String(c.C || "").trim(), String(c.D || "").trim()])
  .filter((r) => r[0] && r[1]);
log("Sheet 'Warehouse code': " + rows.length + " kho.");
const r1177 = rows.find((r) => r[0] === "1177");
log("→ code 1177 THẬT:", r1177 ? r1177.join(" | ") : "(không có)");
rows.filter((r) => /MTG|MASTIGE|GARMENT/i.test(r[1])).forEach((r) => log("→ nhà máy:", r.join(" | ")));

const r2 = await (await fetch(GAS, { method: "POST", redirect: "follow", headers: { "Content-Type": "text/plain;charset=utf-8" },
  body: JSON.stringify({ action: "pc_save_whcode", key: PC_KEY, replace: true, rows }) })).json();
log("pc_save_whcode:", JSON.stringify(r2));
