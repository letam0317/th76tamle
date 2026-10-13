// xem-dieu-phoi.mjs — BO DANH GIA: xem cac may (suc manh/suc khoe/khoa) + viec nao may nao chay.
//   node xem-dieu-phoi.mjs
// Lay bang nhip tu GAS (dong thoi day nhip may nay). Chua deploy GAS -> chi thay may nay.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mayChay, maySong } from "./dieu-phoi.mjs";
import { layBang } from "./nhip-pc.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(fs.readFileSync(path.join(DIR, "cai-pc", "dieu-phoi.json"), "utf8"));
const r = await layBang((...a) => console.error(...a));
const bang = r.bang, now = r.srvNow || Date.now();

console.log("NGUON:", r.nguon === "gas" ? "GAS (mat trung tam)" : "LOCAL (chua deploy GAS -> chi thay may nay)");
console.log("\n== MAY ==");
const song = maySong(bang, now, cfg.hetHanPhut || 8);
for (const hb of [...bang].sort((a, b) => (b.diem || 0) - (a.diem || 0))) {
  const s = song.has(hb.may) ? "song" : "CHET(nhip cu)";
  console.log(`  ${hb.may.padEnd(20)} diem=${String(hb.diem || "?").padStart(4)} RAM=${String(hb.ramTrongPct ?? "?").padStart(4)}% dia=${String(hb.diaTrongGB ?? "?")}GB ${hb.yeu ? "YEU " : "khoe"} khoa=[${(hb.coKhoa || []).join(",")}] ${s}`);
}
console.log("\n== VIEC -> MAY CHAY ==");
for (const v of cfg.viec) {
  const chon = mayChay(v, bang, now, cfg);
  console.log(`  ${v.ten.padEnd(20)} ${v.nang ? "nang" : "nhe "} -> ${chon || "HOAN (khong may nao du dieu kien)"}`);
}
const khongAi = cfg.viec.filter((v) => !mayChay(v, bang, now, cfg)).map((v) => v.ten);
if (khongAi.length) console.log("\n[!] VIEC KHONG MAY NAO NHAN: " + khongAi.join(", ") + " (thieu may song/du khoa/khoe)");
