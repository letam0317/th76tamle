/**
 * anh-nho-pages.mjs — ẢNH NHỎ cho bảng Task vi phạm (12/10/2026, user: "tải cực chậm, ép tải trong <2s").
 *
 *  Đo 12/10: mỗi ô ảnh 44 px của bảng tải ẢNH GỐC từ hr-media (175 KB – 1,5 MB/ảnh, không cache-control) — tab mặc định
 *  kéo ~50 ảnh ≈ 15 MB, ảnh về sau 6–7 s, sự kiện load kéo tới 30 s.
 *  Cách chữa: máy làm sẵn ảnh nhỏ 88×88 webp (~3 KB, đủ nét màn 2x) và để chung trên GitHub Pages (cùng nguồn, có cache).
 *  Mỗi ảnh gốc chỉ tải từ hr-media ĐÚNG 1 LẦN (ảnh trên hr-media bất biến) ⇒ BỚT tải upstream so với mỗi người xem tải lại.
 *
 *  Nguồn danh sách: .exports/summary/*.json (auto-export-sync ghi) — ảnh ĐẦU của cột "Hình ảnh vi phạm" mỗi dòng
 *  (đúng ảnh dashboard hiện trong ô). Tên tệp = thu/<băm 16 hex của URL>.webp — index.html băm y hệt (hàm anhNho).
 *  Đẩy: bản sao repo kiemsoatkho ở .exports/repo-kiemsoatkho (git credential đã cache) → 1 commit cho cả lô.
 *
 *  Chạy: node anh-nho-pages.mjs          (auto-export-sync gọi ngầm sau mỗi lượt đẩy summary)
 *        node anh-nho-pages.mjs --khong-day   (chỉ làm ảnh, không push)
 */
import fs from "node:fs"; import path from "node:path"; import { execFileSync } from "node:child_process"; import { fileURLToPath } from "node:url";
import sharp from "sharp";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SUM = path.join(DIR, ".exports", "summary");
const REPO = path.join(DIR, ".exports", "repo-kiemsoatkho");
const KHOA = path.join(DIR, ".exports", "anh-nho-pages.lock");
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);

/* băm 64 bit (2 × FNV-1a 32) — GIỐNG HỆT anhNho() trong kiemsoatkho/index.html */
export function bamAnh(s) {
  let h1 = 0x811c9dc5, h2 = 0x1b873593;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619); h2 = Math.imul(h2 ^ c, 0x5bd1e995); h2 ^= h2 >>> 13; }
  return (h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0");
}

function dsAnh() {
  const set = new Set();
  /* tháng MỚI trước (+ task sống cũ): đúng phần dashboard mở ra là thấy — tháng cũ chỉ nạp khi lọc lùi ngày */
  for (const f of fs.readdirSync(SUM).filter((f) => /^(\d{4}-\d{2}|song-cu)\.json$/.test(f)).sort().reverse()) {
    let j; try { j = JSON.parse(fs.readFileSync(path.join(SUM, f), "utf8")); } catch { continue; }
    const i = j.header.indexOf("Hình ảnh vi phạm"); if (i < 0) continue;
    for (const r of j.rows) {
      const u = String(r[i] || "").split("\n").map((s) => s.trim()).find((s) => s.startsWith("http"));
      if (u && !/\.(mp4|mov|webm|m4v)(\?|$)/i.test(u)) set.add(u);
    }
  }
  return [...set];
}

const git = (...a) => execFileSync("git", a, { cwd: REPO, encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });

async function main() {
  // 1 lượt tại 1 thời điểm (auto-export-sync gọi mỗi lượt — lượt trước còn tải thì lượt sau thôi)
  try { const st = fs.statSync(KHOA); if (Date.now() - st.mtimeMs < 30 * 60e3) { log("lượt khác đang chạy — bỏ"); return; } } catch { /* */ }
  fs.writeFileSync(KHOA, String(process.pid));
  try {
    if (!fs.existsSync(path.join(REPO, ".git"))) {
      log("clone repo kiemsoatkho…");
      execFileSync("git", ["clone", "--depth=1", "https://github.com/letam0317/kiemsoatkho.git", REPO], { windowsHide: true, stdio: "ignore" });
    } else { try { git("pull", "--ff-only", "-q"); } catch (e) { log("pull lỗi (bỏ qua):", String(e.message).slice(0, 120)); } }
    const THU = path.join(REPO, "thu"); fs.mkdirSync(THU, { recursive: true });
    const can = dsAnh().filter((u) => !fs.existsSync(path.join(THU, bamAnh(u) + ".webp")));
    log("ảnh cần làm:", can.length);
    let xong = 0, loi = 0;
    const lam = async (u) => {
      try {
        const r = await fetch(u, { signal: AbortSignal.timeout(45000) });
        if (!r.ok) throw new Error("HTTP " + r.status);
        const buf = Buffer.from(await r.arrayBuffer());
        const out = await sharp(buf).rotate().resize(88, 88, { fit: "cover" }).webp({ quality: 62 }).toBuffer();
        fs.writeFileSync(path.join(THU, bamAnh(u) + ".webp"), out); xong++;
      } catch (e) { loi++; if (loi <= 5) log("  ✗", u.slice(-60), e.message); }
    };
    for (let i = 0; i < can.length; i += 6) await Promise.all(can.slice(i, i + 6).map(lam));   // 6 song song; mỗi ảnh chỉ tải 1 lần trong đời
    log(`làm xong ${xong} · lỗi ${loi}`);
    if (process.argv.includes("--khong-day")) return;
    git("add", "thu");
    const moi = git("diff", "--cached", "--name-only").split(String.fromCharCode(10)).filter(Boolean).length;   // gồm cả ảnh lượt trước làm mà chưa đẩy được
    if (!moi) return;
    git("-c", "user.name=letam0317", "-c", "user.email=letam0317@users.noreply.github.com", "commit", "-q", "-m", `anh nho bang task: +${moi} (${new Date().toISOString()})`);
    /* repo còn được đẩy qua REST API (deploy-kiemsoatkho, auto-export-sync summary) ⇒ có thể vừa có commit mới: rebase rồi đẩy lại */
    try { git("push", "-q", "origin", "HEAD:main"); } catch { git("pull", "--rebase", "-q", "origin", "main"); git("push", "-q", "origin", "HEAD:main"); }
    log("✓ đã đẩy", moi, "ảnh nhỏ lên Pages");
  } finally { try { fs.rmSync(KHOA, { force: true }); } catch { /* */ } }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((e) => { log("✗", e.message); process.exit(2); });
