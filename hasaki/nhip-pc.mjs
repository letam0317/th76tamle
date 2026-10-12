// nhip-pc.mjs — MAT TRUNG TAM: moi may day NHIP TIM (suc khoe) len GAS va lay ve BANG nhip cua moi may.
//   import { guiNhip, layBang } from "./nhip-pc.mjs";
//   node nhip-pc.mjs            # day nhip may nay + in bang (ai song/yeu)
// GAS action 'pcNhip' (them trong google-script-DEPLOY.gs, CHUA deploy): upsert PCNHIP_<may> + tra bang.
// Khong co GAS/CHUA deploy -> tra bang CHI co may nay (doc tu file local) de dieu phoi van chay (coi nhu 1 may).
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sucKhoe } from "./suc-khoe.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const LOCAL = path.join(DIR, ".nhip-pc.json");       // ban sao nhip may nay (du phong khi chua co GAS)
const CACHE = path.join(DIR, ".nhip-bang-cache.json"); // bang tat ca may (tu nhip tim) -> cong gac dung lai, do khong goi GAS moi lan

// Bang trong bo nho dem con tuoi? (< maxGiay). Tra {bang, nguon:"cache", srvNow} hoac null.
export function layBangCache(maxGiay = Number(process.env.BANG_CACHE_GIAY || 90)) {
  try {
    const c = JSON.parse(fs.readFileSync(CACHE, "utf8"));
    if (c.luc && Date.now() - c.luc <= maxGiay * 1000 && Array.isArray(c.bang)) {
      // doi srvNow theo do tuoi dem (de maySong tinh dung tren bang cu)
      return { bang: c.bang, nguon: "cache", srvNow: (c.srvNow || Date.now()) + (Date.now() - c.luc) };
    }
  } catch { /* chua co dem */ }
  return null;
}

let gasPost = null, KEY = null;
try {
  const sr = await import("./session-rules.js");
  gasPost = sr.gasPost;
  KEY = process.env.APPSCRIPT_KEY || null;
} catch { /* chay doc lap (test) khong co session-rules cung duoc */ }

// guiNhip(opts): opts.giuViec = xin khoa giu viec (viec GHI); opts.traViec = tra khoa.
// Tra { bang, nguon: "gas"|"local", giuOK }. nguon="local" = GAS chet/chua co -> chi thay chinh may nay.
// Khoa NANG LUC may dang co (ten khoa, KHONG gia tri) -> dieu phoi biet may nay lam duoc viec can khoa nao.
const KHOA_NANG_LUC = ["APPSCRIPT_KEY", "APPSCRIPT_URL", "TOPREVIEW_USER", "TOPREVIEW_PASS", "GEMINI_API_KEY"];
function coKhoa() { return KHOA_NANG_LUC.filter((k) => (process.env[k] || "").trim() !== ""); }

export async function guiNhip(log = () => {}, opts = {}) {
  const sk = await sucKhoe();
  const ban = { may: sk.may, ramTrongPct: sk.ramTrongPct, cpuPct: sk.cpuPct, yeu: sk.yeu, diem: sk.diem, nhan: sk.nhan, ramTongGB: sk.ramTongGB, coKhoa: coKhoa(), luc: new Date().toISOString() };
  try { fs.writeFileSync(LOCAL, JSON.stringify(ban)); } catch { /* */ }
  if (!gasPost || !KEY) { log("nhip: chua co GAS/key -> chi local"); return { bang: [ban], nguon: "local", giuOK: null }; }
  // TRAN THOI GIAN: cong gac khong duoc cho GAS qua lau -> het han thi roi ve local (may uu-tien-1 van chay).
  const tran = Number(opts.timeoutMs || process.env.NHIP_TRAN_MS || 2500);
  const goi = gasPost({ action: "pcNhip", key: KEY, nhip: { ...ban, giuViec: opts.giuViec, giuTTL: opts.giuTTL, traViec: opts.traViec } }, log, "pcNhip");
  const hetGio = new Promise((res) => setTimeout(() => res("__TIMEOUT__"), tran));
  try {
    const j = await Promise.race([goi, hetGio]);
    if (j === "__TIMEOUT__") { log(`nhip: GAS qua ${tran}ms -> dung local`); goi.catch(() => {}); return { bang: [ban], nguon: "local", giuOK: null }; }
    if (j && j.status === "success" && Array.isArray(j.bang)) {
      try { fs.writeFileSync(CACHE, JSON.stringify({ bang: j.bang, srvNow: j.srvNow, luc: Date.now() })); } catch { /* */ }
      return { bang: j.bang, nguon: "gas", giuOK: j.giuOK, srvNow: j.srvNow };
    }
    log("nhip: GAS tra bat thuong -> dung local");
  } catch (e) { log("nhip: loi GAS " + e.message + " -> dung local"); }
  return { bang: [ban], nguon: "local", giuOK: null };
}

export async function layBang(log = () => {}, opts = {}) { return guiNhip(log, opts); }

if (process.argv[1] && process.argv[1].endsWith("nhip-pc.mjs")) {
  const r = await guiNhip((...a) => console.error(...a));
  console.log("May nay: " + os.hostname() + " (nguon: " + r.nguon + ")");
  console.log(JSON.stringify(r.bang, null, 1));
}
