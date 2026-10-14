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

// ---- 13/10: VIEC DANG CHAY tren may nay (cho sub-tab «May tram» + lenh dung) ----
// _DP-CHAY.vbs ghi .dang-chay/<viec>.pid = PID goc luc khoi chay. Viec con chay = con >=1 tien trinh trong CAY CON
// cua PID do (tinh qua ParentProcessId, chi nhan tien trinh sinh SAU luc khoi chay -> khong nham PID tai su dung).
const DC_DIR = path.join(DIR, ".dang-chay");
const DC_TOM = path.join(DC_DIR, "_tom-tat.json");      // ten viec dang chay (lan do gan nhat) -> guiNhip cua cong gac dung lai, khong do lai
export const LENH_F = path.join(DIR, ".lenh-may.json");  // lenh dung cua may nay (GAS tra ve) -> cong gac doc khi GAS cham
const NHAN_F = path.join(DIR, ".da-nhan-chuyen.json");   // viec vua chay bu (bao GAS xoa o nhip ke)
export const CHAY_F = path.join(DIR, ".chay-luc.json");  // 14/10 { viec: ISO } lần cổng gác cho CHẠY gần nhất -> tab Máy trạm hiện «chạy lúc …» (chứng minh có chạy)
const GIAO_F = path.join(DIR, ".viec-giao.json");         // viec may nay duoc giao (tinh tu bang nhip vua nhan) -> gui o nhip ke

async function dsTienTrinh() {
  const { execFile } = await import("node:child_process");
  const ps = "Get-CimInstance Win32_Process | ForEach-Object { '' + $_.ProcessId + ',' + $_.ParentProcessId + ',' + $_.CreationDate.ToUniversalTime().ToString('o') }";
  const out = await new Promise((r) => execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ps], { windowsHide: true, timeout: 20000, maxBuffer: 8 << 20 }, (e, so) => r(e ? null : String(so))));
  if (out == null) return null;
  const m = new Map();
  for (const d of out.split(/\r?\n/)) { const [a, b, t] = d.split(","); if (a) m.set(+a, { ppid: +b, t: Date.parse(t) || 0 }); }
  return m;
}

// -> { viec: [pid con song...] } ; tu xoa dau .pid cua viec da xong. Loi do tien trinh -> null (giu nguyen, khong ket luan).
export async function doDangChay() {
  let tep = []; try { tep = fs.readdirSync(DC_DIR).filter((f) => f.endsWith(".pid")); } catch { return {}; }
  if (!tep.length) return {};
  const pt = await dsTienTrinh(); if (!pt) return null;
  const kq = {};
  for (const f of tep) {
    const fp = path.join(DC_DIR, f), viec = f.slice(0, -4);
    let goc = 0, moc = 0; try { goc = +fs.readFileSync(fp, "utf8").trim(); moc = fs.statSync(fp).mtimeMs; } catch { continue; }
    const cay = new Set([goc]); let them = true;
    while (them) { them = false; for (const [pid, p] of pt) if (!cay.has(pid) && cay.has(p.ppid) && p.t >= moc - 10000) { cay.add(pid); them = true; } }
    const song = [...cay].filter((pid) => pt.has(pid) && (pid !== goc || Math.abs(pt.get(pid).t - moc) < 120000));
    if (song.length) kq[viec] = song; else { try { fs.unlinkSync(fp); } catch { /* */ } }
  }
  return kq;
}

async function dungViec(viec, pids, log) {
  const { execFile } = await import("node:child_process");
  for (const pid of pids) await new Promise((r) => execFile("taskkill", ["/F", "/T", "/PID", String(pid)], { windowsHide: true, timeout: 15000 }, () => r()));
  try { fs.unlinkSync(path.join(DC_DIR, viec + ".pid")); } catch { /* */ }
  log(`dung viec ${viec} (${pids.length} tien trinh) theo lenh tu sub-tab May tram`);
}

function banCode() {   // ma commit dang chay (doc thang .git, khong goi git)
  try {
    const g = path.join(DIR, "..", ".git"), h = fs.readFileSync(path.join(g, "HEAD"), "utf8").trim();
    if (!h.startsWith("ref:")) return h.slice(0, 7);
    const ref = h.slice(5).trim(), f = path.join(g, ref);
    if (fs.existsSync(f)) return fs.readFileSync(f, "utf8").trim().slice(0, 7);
    const p = fs.readFileSync(path.join(g, "packed-refs"), "utf8").split("\n").find((d) => d.endsWith(" " + ref));
    return p ? p.slice(0, 7) : "";
  } catch { return ""; }
}

export async function guiNhip(log = () => {}, opts = {}) {
  const sk = await sucKhoe();
  let dangChay = opts.dangChay; if (!dangChay) { try { dangChay = JSON.parse(fs.readFileSync(DC_TOM, "utf8")); } catch { dangChay = []; } }
  // 13/10: việc máy này được giao (tính ở nhịp trước bằng dieu-phoi.mjs) + mọi việc trong dieu-phoi.json → tab Máy trạm trên điện thoại
  let viecGiao = []; try { viecGiao = JSON.parse(fs.readFileSync(GIAO_F, "utf8")); } catch { /* chưa tính */ }
  let tatCaViec = [], viecNang = []; try { const vs = JSON.parse(fs.readFileSync(path.join(DIR, "cai-pc", "dieu-phoi.json"), "utf8")).viec || []; tatCaViec = vs.map((v) => v.ten); viecNang = vs.filter((v) => v.nang).map((v) => v.ten); } catch { /* */ }   // 14/10 nhãn nặng/nhẹ
  let chayLuc = {}; try { chayLuc = JSON.parse(fs.readFileSync(CHAY_F, "utf8")); } catch { /* chưa chạy việc nào */ }
  const ban = { may: sk.may, ramTrongPct: sk.ramTrongPct, cpuPct: sk.cpuPct, yeu: sk.yeu, diem: sk.diem, nhan: sk.nhan, ramTongGB: sk.ramTongGB, diaTrongGB: sk.diaTrongGB, coKhoa: coKhoa(),
    dangChay, viecGiao, tatCaViec, viecNang, chayLuc, oDia: sk.oDia || [], ban: banCode(), daNhan: opts.daNhan || [], luc: new Date().toISOString() };
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
      if (j.lenh) { try { fs.writeFileSync(LENH_F, JSON.stringify(j.lenh)); } catch { /* */ } }
      return { bang: j.bang, nguon: "gas", giuOK: j.giuOK, srvNow: j.srvNow, lenh: j.lenh || null, chuyen: j.chuyen || [] };
    }
    log("nhip: GAS tra bat thuong -> dung local");
  } catch (e) { log("nhip: loi GAS " + e.message + " -> dung local"); }
  return { bang: [ban], nguon: "local", giuOK: null };
}

export async function layBang(log = () => {}, opts = {}) { return guiNhip(log, opts); }

// NHIP TIM (task 'Audit nhip tim PC' moi 1'): do viec dang chay -> gui -> thi hanh LENH DUNG -> CHAY BU viec duoc chuyen sang.
if (process.argv[1] && process.argv[1].endsWith("nhip-pc.mjs")) {
  const nk = (...a) => { const d = new Date().toTimeString().slice(0, 8) + " " + a.join(" "); console.error(d); try { fs.appendFileSync(path.join(DIR, "runner-dieu-phoi.log"), d + "\n"); } catch { /* */ } };
  const dc = await doDangChay();
  if (dc) { try { fs.mkdirSync(DC_DIR, { recursive: true }); fs.writeFileSync(DC_TOM, JSON.stringify(Object.keys(dc))); } catch { /* */ } }
  let daNhan = []; try { daNhan = JSON.parse(fs.readFileSync(NHAN_F, "utf8")); } catch { /* */ }
  const r = await guiNhip(nk, { timeoutMs: 20000, daNhan, ...(dc ? { dangChay: Object.keys(dc) } : {}) });
  if (r.nguon === "gas") { try { fs.unlinkSync(NHAN_F); } catch { /* */ } }
  if (r.nguon === "gas") {   // việc được giao theo bảng vừa nhận (cùng luật cổng gác) → báo ở nhịp kế
    try { const { viecCuaToi } = await import("./dieu-phoi.mjs"); const cfg = JSON.parse(fs.readFileSync(path.join(DIR, "cai-pc", "dieu-phoi.json"), "utf8"));
      fs.writeFileSync(GIAO_F, JSON.stringify(viecCuaToi(os.hostname(), r.bang, cfg, r.srvNow || Date.now()))); } catch { /* */ }
  }

  // 1) LENH DUNG: viec dang chay ma may nay bi dung (ca may / rieng viec) -> dung ngay; nhip ke bao GAS "da dung" -> may khac chay bu
  const l = r.lenh || (() => { try { return JSON.parse(fs.readFileSync(LENH_F, "utf8")); } catch { return null; } })();
  if (l && dc) for (const [viec, pids] of Object.entries(dc)) if (l.dung || (l.dungViec || []).includes(viec)) await dungViec(viec, pids, nk);

  // 2) CHAY BU: viec bi dung giua chung o may khac, dieu phoi chon may nay -> chay task "5S DP <viec>" ngay (van qua cong gac)
  if (r.nguon === "gas" && r.chuyen?.length) {
    const { mayChay } = await import("./dieu-phoi.mjs");
    const cfg = JSON.parse(fs.readFileSync(path.join(DIR, "cai-pc", "dieu-phoi.json"), "utf8"));
    const { execFile } = await import("node:child_process");
    const nhan = [];
    for (const c of r.chuyen) {
      const v = (cfg.viec || []).find((x) => x.ten === c.viec);
      if (!v || c.tu === os.hostname() || (dc && dc[c.viec]) || daNhan.includes(c.viec)) continue;
      if (mayChay(v, r.bang, r.srvNow || Date.now(), cfg) !== os.hostname()) continue;
      const ok = await new Promise((res) => execFile("schtasks", ["/Run", "/TN", "5S DP " + c.viec], { windowsHide: true, timeout: 15000 }, (e) => res(!e)));
      nk(`chay bu ${c.viec} (bi dung o ${c.tu}) -> ${ok ? "da goi task" : "LOI goi task"}`);
      if (ok) nhan.push(c.viec);
    }
    if (nhan.length) { try { fs.writeFileSync(NHAN_F, JSON.stringify(nhan)); } catch { /* */ } }
  }
  console.log("May nay: " + os.hostname() + " (nguon: " + r.nguon + ")" + (dc ? " · dang chay: " + (Object.keys(dc).join(", ") || "khong") : ""));
  console.log(JSON.stringify(r.bang, null, 1));
}
