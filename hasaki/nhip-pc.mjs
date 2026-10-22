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
import { ghiJson } from "./so-ghi.mjs";   // 20/10 ghi sổ JSON an toàn (ghi tạm → đổi tên) + nhật ký ai ghi

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
/* 20/10 ĐỔI KHOÁ KHÔNG CÀI LẠI (đánh giá an ninh: gói khoá từng lộ → phải đổi được nhanh trên mọi máy):
   · GAS trả khoaMoi khi máy còn gọi bằng khoá CŨ → ghi APPSCRIPT_KEY mới vào .env ngay.
   · GAS trả goiBam (băm gói khoá laptop đẩy lên qua pcDatGoi); khác băm máy đã áp (.goi-bam.txt) → pcLayGoi → ghi các dòng KEY=VALUE vào .env
     (chỉ PC: RUNNER_VAI=pc; laptop là nguồn gói, không tự ghi đè). Mọi tiến trình cò đọc .env lúc khởi động → lượt sau dùng khoá mới. */
const GOI_F = path.join(DIR, ".goi-bam.txt"), ENV_F = path.join(DIR, ".env");
function goiBamDaAp() { try { return fs.readFileSync(GOI_F, "utf8").trim().slice(0, 16); } catch { return ""; } }
function ghiEnv(cap) {   // cập nhật/thêm dòng KEY=VALUE, giữ nguyên dòng khác; ghi tạm rồi đổi tên
  let dong = []; try { dong = fs.readFileSync(ENV_F, "utf8").split(/\r?\n/); } catch { /* chưa có */ }
  for (const [k, v] of Object.entries(cap)) { if (!/^[A-Z0-9_]+$/.test(k)) continue; const i = dong.findIndex((l) => l.replace(/^\s*/, "").startsWith(k + "=")); if (i >= 0) dong[i] = k + "=" + v; else dong.push(k + "=" + v); process.env[k] = v; }
  const tam = ENV_F + ".tam"; fs.writeFileSync(tam, dong.join("\r\n").replace(/(\r\n)+$/, "") + "\r\n"); fs.renameSync(tam, ENV_F);
}
async function apKhoaMoi(j, log) {
  try {
    if (j.khoaMoi && /^[\w.-]{8,}$/.test(j.khoaMoi) && j.khoaMoi !== KEY) { ghiEnv({ APPSCRIPT_KEY: j.khoaMoi }); KEY = j.khoaMoi; log("nhip: GAS bao KHOA MOI -> da ghi .env"); }
    if (String(process.env.RUNNER_VAI || "").toLowerCase() === "pc" && j.goiBam && j.goiBam !== goiBamDaAp()) {
      const g = await gasPost({ action: "pcLayGoi", key: KEY }, log, "pcLayGoi");
      if (g && g.status === "success" && g.goi) { const cap = {}; for (const l of Buffer.from(g.goi, "base64").toString("utf8").split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim()); if (m && m[2]) cap[m[1]] = m[2]; }
        if (Object.keys(cap).length) { ghiEnv(cap); if (cap.APPSCRIPT_KEY) KEY = cap.APPSCRIPT_KEY; fs.writeFileSync(GOI_F, String(g.goiBam || j.goiBam)); log("nhip: goi khoa moi (" + Object.keys(cap).join(",") + ") -> da ghi .env"); } }
    }
  } catch (e) { log("nhip: ap khoa moi loi " + e.message); }
}

// ---- 13/10: VIEC DANG CHAY tren may nay (cho sub-tab «May tram» + lenh dung) ----
// _DP-CHAY.vbs ghi .dang-chay/<viec>.pid = PID goc luc khoi chay. Viec con chay = con >=1 tien trinh trong CAY CON
// cua PID do (tinh qua ParentProcessId, chi nhan tien trinh sinh SAU luc khoi chay -> khong nham PID tai su dung).
const DC_DIR = path.join(DIR, ".dang-chay");
const DC_TOM = path.join(DC_DIR, "_tom-tat.json");      // ten viec dang chay (lan do gan nhat) -> guiNhip cua cong gac dung lai, khong do lai
export const LENH_F = path.join(DIR, ".lenh-may.json");  // lenh dung cua may nay (GAS tra ve) -> cong gac doc khi GAS cham
const NHAN_F = path.join(DIR, ".da-nhan-chuyen.json");   // viec vua chay bu (bao GAS xoa o nhip ke)
export const CHAY_F = path.join(DIR, ".chay-luc.json");  // 14/10 { viec: ISO } lần cổng gác cho CHẠY gần nhất -> tab Máy trạm hiện «chạy lúc …» (chứng minh có chạy)
const GIAO_F = path.join(DIR, ".viec-giao.json");
const CAPNHAT_F = path.join(DIR, ".cap-nhat-yc.txt");     // 15/10 lenh «Cap nhat ngay» da nhan (ISO) -> bao GAS go lenh, khong chay lap
const CAPNGAY_F = path.join(DIR, ".cap-nhat-ngay");       // co cho _CAP-NHAT-PC.ps1: bo cho canary lan nay         // viec may nay duoc giao (tinh tu bang nhip vua nhan) -> gui o nhip ke

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

/* 14/10: QLIT lên bản mới mà nhật ký cổng gác KHÔNG có dòng quyết định nào ⇒ task «5S DP …» không hề gọi cổng gác. Từ xa không thấy task
   ⇒ nhịp tim gửi trạng thái task (tên|trạng thái|lần chạy cuối|mã kết quả|lần chạy kế), đọc lại mỗi 10' (đệm .task-dp.json). */
const TASK_F = path.join(DIR, ".task-dp.json");
async function trangThaiTask() {
  try { const c = JSON.parse(fs.readFileSync(TASK_F, "utf8")); if (Date.now() - c.luc < 10 * 60e3) return c.ds; } catch { /* chưa có */ }
  const { execFile } = await import("node:child_process");
  const ps = "Get-ScheduledTask | Where-Object { $_.TaskName -like '5S DP *' -or $_.TaskName -like 'Audit *' } | ForEach-Object { $i = $_ | Get-ScheduledTaskInfo; " +
    "$_.TaskName + '|' + $_.State + '|' + $(if ($i.LastRunTime) { $i.LastRunTime.ToString('dd/MM HH:mm') } else { '-' }) + '|' + $i.LastTaskResult + '|' + $(if ($i.NextRunTime) { $i.NextRunTime.ToString('dd/MM HH:mm') } else { '-' }) }";
  const out = await new Promise((r) => execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ps], { windowsHide: true, timeout: 30000 }, (e, so) => r(e ? "" : String(so))));
  const ds = out.split(/\r?\n/).map((d) => d.trim()).filter(Boolean).slice(0, 40).map((d) => d.slice(0, 120));   // 19/10: 20 → 40 — máy FOQ đã 19 lịch, lịch thứ 21 bị cắt = «thiếu task» → không được giao việc
  try { ghiJson(TASK_F, { luc: Date.now(), ds }, { thut: 0 }); } catch { /* */ }
  return ds;
}

// 19/10: địa chỉ đường hầm của máy chủ Xác minh DỰ PHÒNG (may-chu-du-phong.mjs) — chỉ khi tiến trình đường hầm còn sống
function xmHam() {   // 20/10: laptop gửi nhịp tim từ bản cài PC (C:\AuditFactory) nên đọc thêm tệp do đường hầm ghi ở thư mục chung (DUONG_HAM_URL_F)
  /* 21/10 (Theo máy điện thoại trống): tệp ProgramData từng KHÔNG có pid → process.kill(undefined) ném lỗi → laptop không bao giờ báo xmHam.
     Nay: tiến trình còn sống (pid) HOẶC tệp mới ghi ≤45' (đường hầm làm mới «luc» mỗi 30') đều chấp nhận — nhịp tim SYSTEM không soi được tiến trình người dùng cũng vẫn đọc được. */
  for (const f of [path.join(DIR, ".duong-ham-591.url"), process.env.DUONG_HAM_URL_F || "", "C:/ProgramData/AuditFactory/duong-ham-591.url"]) {
    if (!f) continue;
    try {
      const o = JSON.parse(fs.readFileSync(f, "utf8"));
      if (!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(o.url)) continue;
      let song = false; try { process.kill(o.pid, 0); song = true; } catch { /* không soi được tiến trình → xét tuổi tệp */ }
      if (song || Date.now() - Date.parse(o.luc) < 45 * 60e3) return o.url;
    } catch { /* thử tệp kế */ }
  }
  return "";
}

export async function guiNhip(log = () => {}, opts = {}) {
  const sk = await sucKhoe();
  let dangChay = opts.dangChay; if (!dangChay) { try { dangChay = JSON.parse(fs.readFileSync(DC_TOM, "utf8")); } catch { dangChay = []; } }
  // 13/10: việc máy này được giao (tính ở nhịp trước bằng dieu-phoi.mjs) + mọi việc trong dieu-phoi.json → tab Máy trạm trên điện thoại
  let viecGiao = []; try { viecGiao = JSON.parse(fs.readFileSync(GIAO_F, "utf8")); } catch { /* chưa tính */ }
  let tatCaViec = [], viecNang = []; try { const vs = JSON.parse(fs.readFileSync(path.join(DIR, "cai-pc", "dieu-phoi.json"), "utf8")).viec || []; tatCaViec = vs.filter((v) => !v.uuTien || v.uuTien.includes(os.hostname())).map((v) => v.ten);   /* 20/10: việc ghim máy khác không cài ở máy này → không đếm «thiếu task» */ viecNang = vs.filter((v) => v.nang).map((v) => v.ten); } catch { /* */ }   // 14/10 nhãn nặng/nhẹ
  let congGan = []; try { congGan = fs.readFileSync(path.join(DIR, "runner-dieu-phoi.log"), "utf8").trim().split(/\r?\n/).slice(-8).map((d) => d.slice(0, 180)); } catch { /* chưa có */ }   // 14/10: 8 dòng cuối cổng gác → xem từ xa vì sao máy chạy/không chạy
  let chayLuc = {}; try { chayLuc = JSON.parse(fs.readFileSync(CHAY_F, "utf8")); } catch { /* chưa chạy việc nào */ }
  const ban = { may: sk.may, ramTrongPct: sk.ramTrongPct, cpuPct: sk.cpuPct, yeu: sk.yeu, diem: sk.diem, nhan: sk.nhan, ramTongGB: sk.ramTongGB, diaTrongGB: sk.diaTrongGB, coKhoa: coKhoa(),
    dangChay, viecGiao, tatCaViec, viecNang, chayLuc, congGan, goiBam: goiBamDaAp(), capGan: (() => { try { return fs.readFileSync(path.join(DIR, ".cap-nhat-pc.log"), "utf8").replace(/^\uFEFF/, "").trim().split(/\r?\n/).slice(-6).map((d) => d.slice(0, 160)); } catch { return []; } })(), congLuc: (() => { try { return fs.readFileSync(path.join(DIR, ".cong-luc"), "utf8").trim() || null; } catch { return null; } })(), taskDP: await trangThaiTask(), oDia: sk.oDia || [], ban: banCode(), daNhan: opts.daNhan || [], capNhatNhan: (() => { try { return fs.readFileSync(CAPNHAT_F, "utf8").trim(); } catch { return ""; } })(), xmHam: xmHam(), luc: new Date().toISOString() };
  try { ghiJson(LOCAL, ban, { thut: 0 }); } catch { /* */ }
  if (!gasPost || !KEY) { log("nhip: chua co GAS/key -> chi local"); return { bang: [ban], nguon: "local", giuOK: null }; }
  // TRAN THOI GIAN: cong gac khong duoc cho GAS qua lau -> het han thi roi ve local (may uu-tien-1 van chay).
  const tran = Number(opts.timeoutMs || process.env.NHIP_TRAN_MS || 2500);
  const goi = gasPost({ action: "pcNhip", key: KEY, nhip: { ...ban, giuViec: opts.giuViec, giuTTL: opts.giuTTL, traViec: opts.traViec } }, log, "pcNhip");
  const hetGio = new Promise((res) => setTimeout(() => res("__TIMEOUT__"), tran));
  try {
    const j = await Promise.race([goi, hetGio]);
    if (j === "__TIMEOUT__") { log(`nhip: GAS qua ${tran}ms -> dung local`); goi.catch(() => {}); return { bang: [ban], nguon: "local", giuOK: null }; }
    if (j && j.status === "success" && Array.isArray(j.bang)) {
      try { ghiJson(CACHE, { bang: j.bang, srvNow: j.srvNow, luc: Date.now() }, { thut: 0 }); } catch { /* */ }
      if (j.lenh) { try { ghiJson(LENH_F, j.lenh, { thut: 0 }); } catch { /* */ } }
      await apKhoaMoi(j, log);
      return { bang: j.bang, nguon: "gas", giuOK: j.giuOK, srvNow: j.srvNow, lenh: j.lenh || null, chuyen: j.chuyen || [] };
    }
    log("nhip: GAS tra bat thuong -> dung local");
  } catch (e) { log("nhip: loi GAS " + e.message + " -> dung local"); }
  return { bang: [ban], nguon: "local", giuOK: null };
}

export async function layBang(log = () => {}, opts = {}) { return guiNhip(log, opts); }

// NHIP TIM (task 'Audit nhip tim PC' moi 1'): do viec dang chay -> gui -> thi hanh LENH DUNG -> CHAY BU viec duoc chuyen sang.
if (process.argv[1] && process.argv[1].endsWith("nhip-pc.mjs")) {
  // 15/10 FOQ5T89 câm từ 11:44 dù máy bật: 1 lượt kẹt chờ Google → task (MultipleInstances IgnoreNew) bỏ qua MỌI lượt sau. Tự thoát sau 80 giây (lượt bình thường < 60 giây: GAS 20s + đọc task 30s).
  setTimeout(() => { try { fs.appendFileSync(path.join(DIR, "runner-dieu-phoi.log"), new Date().toTimeString().slice(0, 8) + " nhip: qua 80s -> tu thoat (chong treo)" + os.EOL); } catch { /* */ } process.exit(3); }, 80000).unref();
  const nk = (...a) => { const d = new Date().toTimeString().slice(0, 8) + " " + a.join(" "); console.error(d); try { fs.appendFileSync(path.join(DIR, "runner-dieu-phoi.log"), d + "\n"); } catch { /* */ } };
  const dc = await doDangChay();
  if (dc) { try { fs.mkdirSync(DC_DIR, { recursive: true }); ghiJson(DC_TOM, Object.keys(dc), { thut: 0 }); } catch { /* */ } }
  let daNhan = []; try { daNhan = JSON.parse(fs.readFileSync(NHAN_F, "utf8")); } catch { /* */ }
  const r = await guiNhip(nk, { timeoutMs: 20000, daNhan, ...(dc ? { dangChay: Object.keys(dc) } : {}) });
  if (r.nguon === "gas") { try { fs.unlinkSync(NHAN_F); } catch { /* */ } }
  if (r.nguon === "gas") {   // việc được giao theo bảng vừa nhận (cùng luật cổng gác) → báo ở nhịp kế
    try { const { viecCuaToi } = await import("./dieu-phoi.mjs"); const cfg = JSON.parse(fs.readFileSync(path.join(DIR, "cai-pc", "dieu-phoi.json"), "utf8"));
      ghiJson(GIAO_F, viecCuaToi(os.hostname(), r.bang, cfg, r.srvNow || Date.now()), { thut: 0 }); } catch { /* */ }
  }

  // 1) LENH DUNG: viec dang chay ma may nay bi dung (ca may / rieng viec) -> dung ngay; nhip ke bao GAS "da dung" -> may khac chay bu
  const l = r.lenh || (() => { try { return JSON.parse(fs.readFileSync(LENH_F, "utf8")); } catch { return null; } })();
  if (l && dc) for (const [viec, pids] of Object.entries(dc)) if (l.dung || (l.dungViec || []).includes(viec)) await dungViec(viec, pids, nk);

  // 1b) 15/10 «CAP NHAT NGAY» (bam o tab May tram): chay task SYSTEM 'Audit cap nhat PC' ngay, bo cho canary (co .cap-nhat-ngay)
  if (r.nguon === "gas" && l && l.capNhat) {
    let daLam = ""; try { daLam = fs.readFileSync(CAPNHAT_F, "utf8").trim(); } catch { /* */ }
    if (daLam < l.capNhat) {
      try { fs.writeFileSync(CAPNGAY_F, l.capNhat); fs.writeFileSync(CAPNHAT_F, l.capNhat); } catch { /* */ }
      const { execFile } = await import("node:child_process");
      const ok = await new Promise((res) => execFile("schtasks", ["/Run", "/TN", "Audit cap nhat PC"], { windowsHide: true, timeout: 15000 }, (e) => res(!e)));
      nk(`lenh cap nhat ngay (${l.capNhat}) -> ${ok ? "da goi task cap nhat" : "LOI goi task cap nhat"}`);
    }
  }

  // 1c) 22/10 user «can cap nhat ngay - co the k can t bam»: 5 phut/lan hoi GitHub (git ls-remote, nhe) nhanh dang theo doi co commit MOI
  //     khac HEAD may nay -> tu lam y nhu bam «Cap nhat ngay» (dat .cap-nhat-ngay bo cho canary + chay task 'Audit cap nhat PC').
  //     Moi commit chi kich 1 lan (so .kiem-ban-moi.json); task cap nhat tu kiem loi/khoi phuc nhu cu.
  try {
    const KBM_F = path.join(DIR, ".kiem-ban-moi.json");
    let kbm = {}; try { kbm = JSON.parse(fs.readFileSync(KBM_F, "utf8")); } catch { /* lan dau */ }
    if (Date.now() - (kbm.luc || 0) >= 5 * 60e3) {
      kbm.luc = Date.now();
      const { execFileSync } = await import("node:child_process");
      const cfgN = JSON.parse(fs.readFileSync(path.join(DIR, "cai-pc", "dieu-phoi.json"), "utf8")).nhanh;
      let GIT = "git"; try { GIT = fs.readFileSync(path.join(DIR, ".git-exe"), "utf8").trim() || "git"; } catch { /* git tren PATH */ }
      const o = { cwd: DIR, encoding: "utf8", windowsHide: true, timeout: 30000 };
      const xa = String(execFileSync(GIT, ["ls-remote", "origin", "refs/heads/" + cfgN], o)).split(/\s/)[0];
      const dang = String(execFileSync(GIT, ["rev-parse", "HEAD"], o)).trim();
      if (/^[0-9a-f]{40}$/.test(xa) && xa !== dang && kbm.daKich !== xa) {
        kbm.daKich = xa;
        try { fs.writeFileSync(CAPNGAY_F, "tu-dong " + xa.slice(0, 7)); } catch { /* */ }
        const { execFile } = await import("node:child_process");
        const ok = await new Promise((res) => execFile("schtasks", ["/Run", "/TN", "Audit cap nhat PC"], { windowsHide: true, timeout: 15000 }, (e) => res(!e)));
        nk(`ban moi tren GitHub ${dang.slice(0, 7)} -> ${xa.slice(0, 7)}: tu cap nhat ngay -> ${ok ? "da goi task cap nhat" : "LOI goi task cap nhat"}`);
      }
    }
    ghiJson(KBM_F, kbm, { thut: 0 });
  } catch { /* mang / git loi: luot sau thu lai; khong lam hong nhip tim */ }

  // 1d) 22/10 doi may chu du phong sang BANGCHUYEN-2: may KHONG con duoc giao «may-chu-xm-du-phong» ma van con ban du phong 8591
  //     + duong ham chay ngam (tien trinh tach roi, song tiep sau khi bo viec) -> van bao xmHam, dien thoai co the chon nham ban cu.
  //     Tat khi 3 nhip LIEN TIEP (~3') danh sach viec giao KHONG RONG ma khong co viec nay; chi tat 8591 neu ping bao duPhong (khong bao gio dung may chu that).
  try {
    const BO_F = path.join(DIR, ".bo-du-phong.json");
    let giao = null; try { giao = JSON.parse(fs.readFileSync(GIAO_F, "utf8")); } catch { /* chua tinh */ }
    let bo = { n: 0 }; try { bo = JSON.parse(fs.readFileSync(BO_F, "utf8")); } catch { /* lan dau */ }
    if (Array.isArray(giao) && giao.length && !giao.includes("may-chu-xm-du-phong")) {
      const pj = await fetch("http://127.0.0.1:8591/api/ping", { signal: AbortSignal.timeout(3000) }).then((x) => (x.ok ? x.json() : null), () => null);
      bo.n = pj && pj.duPhong ? (bo.n || 0) + 1 : 0;
      if (bo.n >= 3) {
        const { execFileSync } = await import("node:child_process");
        const ps = (lenh) => { try { return String(execFileSync("powershell.exe", ["-NoProfile", "-Command", lenh], { encoding: "utf8", windowsHide: true, timeout: 30000 })).trim(); } catch { return ""; } };
        const pid8591 = ps("Get-NetTCPConnection -LocalPort 8591 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force; $_ }");
        let pidHam = ""; try { pidHam = fs.readFileSync(path.join(DIR, ".duong-ham-591.pid"), "utf8").trim(); if (/^\d+$/.test(pidHam)) ps("taskkill /PID " + pidHam + " /T /F"); } catch { /* khong co ham */ }   // taskkill /T: ca cay (node + cloudflared con)
        try { fs.unlinkSync(path.join(DIR, ".duong-ham-591.url")); } catch { /* */ } try { fs.unlinkSync("C:/ProgramData/AuditFactory/duong-ham-591.url"); } catch { /* */ }
        nk(`khong con giao may-chu-xm-du-phong -> tat ban du phong 8591 (pid ${pid8591 || "?"}) + duong ham (pid ${pidHam || "?"})`);
        bo.n = 0;
      }
    } else bo.n = 0;
    ghiJson(BO_F, bo, { thut: 0 });
  } catch { /* khong lam hong nhip tim */ }

  // 1e) 22/10 user «ca admin may guong cung KHONG xem duoc clip lan du lieu Xac minh»: ban du phong nay chi giu BAN MA — don ban ro cu
  //     do ban du phong de lai (guong ban ro, anh nho, du lieu keo kho Drive) tren MOI PC, ke ca may da thoi lam du phong (QLIT). Khong co dau -> 0 viec.
  try { const { donBanRo } = await import("./don-ban-ro-du-phong.mjs"); await donBanRo(nk); } catch { /* khong lam hong nhip tim */ }

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
    if (nhan.length) { try { ghiJson(NHAN_F, nhan, { thut: 0 }); } catch { /* */ } }
  }
  console.log("May nay: " + os.hostname() + " (nguon: " + r.nguon + ")" + (dc ? " · dang chay: " + (Object.keys(dc).join(", ") || "khong") : ""));
  console.log(JSON.stringify(r.bang, null, 1));
}
