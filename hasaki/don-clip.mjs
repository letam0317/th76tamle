// don-clip.mjs — VAN DON DIA cho PC noi bo: xoa clip GOC sau khi da cat + dinh phieu,
//   va khi dia thap thi xoa bot clip cu nhat de may KHONG tu "yeu" (dia < 3GB -> ngung nhan viec camera).
// =====================================================================================
// Luat (user 13/10/2026 — doi luat cu "giu toi B3" cho PC):
//   - Bang chung THAT da nam tren PHIEU (PIC02/video02) + dau ghi giu >=69 ngay -> KHONG can giu clip goc duoi may.
//   - Giu file GB toi B3 chi lam DAY DIA -> may tu tat viec camera, lai khong song sot qua gan-thay.
// Chi dong vao FILE VIDEO (.mp4/.webm/.mkv/.avi/.ts/.m4v) trong CAC KHO CLIP da biet. Khong bao gio nem loi.
//
// Chay:
//   node don-clip.mjs            # don day du + van dia (dung o cuoi task camera / task cap nhat 2h)
//   node don-clip.mjs --im       # nhu tren nhung khong in (goi tu cac co)
//   node don-clip.mjs --kho      # chi in cac kho + dung luong, KHONG xoa (xem truoc)
// Nguong doi qua .env:
//   DIA_TRONG_TOI_THIEU_GB=3  CLIP_DU_PHONG_GB=3  -> giu it nhat 6 GB trong (neu thieu: xoa clip cu nhat).
//   CLIP_RAW_GIU_PHUT=120     -> clip GOC (.mp4) qua 2h chac da dinh phieu/xong -> xoa (du chua thay dau "da cat").
//   CLIP_FINAL_GIU_GIO=48     -> clip bang chung *_BAOCAO_CLIP-*.webm qua 48h -> xoa (da o tren phieu).
//   CLIP_DIRS=D:\a;E:\b       -> them kho clip ngoai (ngan cach bang ;).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const A = new Set(process.argv.slice(2));
const IM = A.has("--im");
const CHI_XEM = A.has("--kho");
// CHI PC moi xoa-ngay (RUNNER_VAI=pc, dat trong envCung bo cai). Laptop giu luat cu "giu toi B3":
//   chi chay VAN DIA khi dia that su thap (xoa cu nhat truoc) — khong xoa raw theo tuoi.
const VAI = String(process.env.RUNNER_VAI || "").toLowerCase();
const XOA_NGAY = A.has("--ep") || process.env.CLIP_XOA_NGAY === "1" || VAI === "pc";
const log = (...a) => { if (!IM) console.log(...a); };
const VIDEO = new Set([".mp4", ".webm", ".mkv", ".avi", ".ts", ".m4v"]);

const GB = 1073741824;
const DIA_MIN = Number(process.env.DIA_TRONG_TOI_THIEU_GB || 3);
const DU_PHONG = Number(process.env.CLIP_DU_PHONG_GB || 3);
const DIA_DICH = DIA_MIN + DU_PHONG;                 // giu it nhat bay nhieu GB trong
const RAW_GIU = Number(process.env.CLIP_RAW_GIU_PHUT || 120) * 60e3;
const FINAL_GIU = Number(process.env.CLIP_FINAL_GIU_GIO || 48) * 3600e3;
const AN_TOAN = 2 * 60e3;                            // < 2 phut = co the dang dung -> khong dong vao

// ---- cac kho clip (giong camera-bao-cao.mjs: VID + .exports) ----
const khoVID = process.env.BAIXE_DIR ? path.dirname(process.env.BAIXE_DIR) : "C:/Users/lechitam/Videos/5S-bang-chung";
const roots = [...new Set([
  khoVID,
  path.join(DIR, ".exports"),
  ...String(process.env.CLIP_DIRS || "").split(";").map((s) => s.trim()).filter(Boolean),
].map((p) => path.resolve(p)))];

// ---- quet de quy, chi file video, bo thu muc an toan ----
function quet(root, ra = []) {
  let ds; try { ds = fs.readdirSync(root, { withFileTypes: true }); } catch { return ra; }
  for (const d of ds) {
    const p = path.join(root, d.name);
    try {
      if (d.isSymbolicLink()) continue;              // khong di theo link ra ngoai
      if (d.isDirectory()) { quet(p, ra); continue; }
      if (!VIDEO.has(path.extname(d.name).toLowerCase())) continue;
      const st = fs.statSync(p);
      ra.push({ p, dir: root, base: d.name, mtime: st.mtimeMs, size: st.size });
    } catch { /* bo qua file loi */ }
  }
  return ra;
}

const idCua = (base) => (String(base).match(/^(\d{4,})/) || [])[1] || null;
const laFinal = (base) => /_BAOCAO_CLIP-/.test(base);
const laRaw = (base) => path.extname(base).toLowerCase() === ".mp4" && !laFinal(base);

function diaTrongGB(p) {
  try { const st = fs.statfsSync(p); return (st.bavail * st.bsize) / GB; } catch { return null; }
}

function xoa(f, vetXoa, vetMB) {
  if (CHI_XEM) return false;
  try { fs.unlinkSync(f.p); vetXoa.push(f.base); vetMB.v += f.size / 1048576; return true; } catch { return false; }
}

function main() {
  const now = Date.now();
  const files = [];
  for (const r of roots) quet(r, files);

  if (CHI_XEM) {
    const theoKho = {};
    for (const f of files) { const k = roots.find((r) => f.p.startsWith(r)) || f.dir; (theoKho[k] ||= { n: 0, mb: 0 }); theoKho[k].n++; theoKho[k].mb += f.size / 1048576; }
    log("KHO CLIP (chi xem, khong xoa):");
    for (const [k, v] of Object.entries(theoKho)) log("  " + k + " : " + v.n + " file · " + v.mb.toFixed(0) + " MB");
    for (const r of roots) { const g = diaTrongGB(r); if (g != null) { log("  [dia] " + r + " : con trong " + g.toFixed(1) + " GB (dich >= " + DIA_DICH + ")"); break; } }
    return;
  }

  // ID nao da co clip bang chung / anh 3 moc -> raw cua ID do coi nhu "da cat + dinh phieu"
  const idXong = new Set();
  for (const f of files) { if (laFinal(f.base) || /_BAOCAO_ANH-3-MOC\./.test(f.base)) { const id = idCua(f.base); if (id) idXong.add(id); } }
  const dirXong = new Set();  // thu muc co bao cao -> raw trong do da dung xong
  for (const f of files) { try { const d = f.dir; if (fs.existsSync(path.join(d, "BAO-CAO.md")) || fs.existsSync(path.join(d, "ket-qua.json"))) dirXong.add(d); } catch { } }

  const vetXoa = [], vetMB = { v: 0 };
  // --- Pass 1 + 2 CHI khi XOA_NGAY (PC). Laptop bo qua -> giu toi B3. ---
  if (XOA_NGAY) {
    // Pass 1: xoa raw DA CAT (co dau xong) hoac qua han raw
    for (const f of files) {
      if (now - f.mtime < AN_TOAN) continue;
      if (laRaw(f.base)) {
        const daCat = idXong.has(idCua(f.base)) || dirXong.has(f.dir);
        if ((daCat && now - f.mtime > AN_TOAN) || now - f.mtime > RAW_GIU) xoa(f, vetXoa, vetMB);
      }
    }
    // Pass 2: clip bang chung qua han (da o tren phieu)
    for (const f of files) {
      if (now - f.mtime < AN_TOAN) continue;
      if (laFinal(f.base) && now - f.mtime > FINAL_GIU) xoa(f, vetXoa, vetMB);
    }
  }
  // --- Pass 3: VAN DIA (ca laptop) — con thieu thi xoa VIDEO cu nhat (bat ky) toi khi du ---
  const con = () => { for (const r of roots) { const g = diaTrongGB(r); if (g != null) return g; } return null; };
  let g0 = con();
  if (g0 != null && g0 < DIA_DICH) {
    const conLai = files.filter((f) => { try { return fs.existsSync(f.p) && now - f.mtime > AN_TOAN; } catch { return false; } })
      .sort((a, b) => a.mtime - b.mtime);   // cu nhat truoc
    for (const f of conLai) { if ((con() ?? DIA_DICH) >= DIA_DICH) break; xoa(f, vetXoa, vetMB); }
  }

  const g1 = con();
  const dong = "don-clip " + new Date().toISOString() + " [" + (XOA_NGAY ? "pc:xoa-ngay" : "laptop:chi-van-dia") + "] : xoa " + vetXoa.length + " file · " + vetMB.v.toFixed(0) + " MB" + (g1 != null ? " · dia trong " + g1.toFixed(1) + " GB" : "");
  try { fs.appendFileSync(path.join(DIR, ".exports", "don-clip.log"), dong + "\n"); } catch { }
  log(dong);
}

try { main(); } catch (e) { try { console.error("don-clip loi: " + e.message); } catch { } }
