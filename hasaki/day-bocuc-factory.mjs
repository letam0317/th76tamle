/**
 * day-bocuc-factory.mjs — bước «đẩy lên live» khi CHỐT bố cục dashboard Audit Factory (xem-noi-bo.mjs → /api/dash/factory/chot).
 * Chỉ commit + push ĐÚNG 2 tệp bố cục (dash-bocuc.js, dash-bocuc-ap.js) của repo factory — các thay đổi khác đang sửa dở
 * trong repo (chưa được duyệt) KHÔNG bị kéo theo. Repo phải đang ở nhánh main.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "factory");
const TEP = ["dash-bocuc.js", "dash-bocuc-ap.js"];
const git = (...a) => execFileSync("git", a, { cwd: REPO, encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }).trim();
const nhanh = git("branch", "--show-current");
if (nhanh !== "main") { console.log("✗ repo factory đang ở nhánh " + nhanh + " — chỉ đẩy bố cục khi ở main"); process.exit(1); }
git("add", "--", ...TEP);
const doi = git("diff", "--cached", "--name-only", "--", ...TEP);
if (!doi) { console.log("✓ bố cục Factory không đổi so với bản đã đẩy — bỏ qua"); process.exit(0); }
git("commit", "-q", "-m", "Chốt bố cục dashboard Audit Factory (" + new Date().toISOString().slice(0, 16) + ")", "--", ...TEP);
try { git("push", "-q", "origin", "HEAD:main"); } catch (e) { console.log("✗ push lỗi: " + String(e.stderr || e.message).slice(0, 300)); process.exit(1); }
console.log("✓ đã đẩy " + doi.split(/\n/).join(", ") + " lên stocklocationfactory@main");
/* 13/10: đẩy tiếp mặt tiền audit-dc.pages.dev (không đổi thì tự bỏ qua; lỗi thì lịch «5S Day Cloudflare audit-dc» 2 giờ bù) */
try { execFileSync(process.execPath, [path.join(path.dirname(fileURLToPath(import.meta.url)), "day-cloudflare.mjs")], { stdio: "inherit", windowsHide: true }); } catch (e) { console.log("  ⚠ Cloudflare chưa đẩy được — lịch 2 giờ sẽ thử lại"); }
