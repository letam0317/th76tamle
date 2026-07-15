/**
 * ============================================================================
 *  ĐẨY DASHBOARD 5S LÊN GITHUB PAGES  →  letam0317.github.io/kiemsoatkho
 * ============================================================================
 *  Đưa kiemsoatkho/index.html + kiemsoatkho/form.html lên repo RIÊNG
 *  `letam0317/kiemsoatkho` qua GitHub REST API (PUT contents, base64).
 *
 *  Cần token GitHub (scope `repo`), KHÔNG lưu vào code — truyền qua biến môi trường:
 *
 *    Windows PowerShell:
 *      $env:GH_TOKEN="ghp_xxx"; node deploy-kiemsoatkho.mjs
 *    Git Bash:
 *      GH_TOKEN=ghp_xxx node deploy-kiemsoatkho.mjs
 *
 *  Chỉ đẩy file nào ĐỔI nội dung (so sánh sha) → an toàn, chạy lại thoải mái.
 * ============================================================================
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_PAT;
const OWNER = process.env.GH_OWNER || "letam0317";
const REPO = process.env.GH_REPO || "kiemsoatkho";
const BRANCH = process.env.GH_BRANCH || "main";
// file cục bộ  ->  đường dẫn trên repo
const FILES = [
  ["kiemsoatkho/index.html", "index.html"],
  ["kiemsoatkho/form.html", "form.html"],
  ["kiemsoatkho/factory-stock.js", "factory-stock.js"],     // module tab Trạng thái lưu trữ (lazy-load)
  ["kiemsoatkho/factory-kiemke.js", "factory-kiemke.js"],   // module tab Kiểm kê (lazy-load)
];

if (!TOKEN) {
  console.error("✗ Thiếu token. Đặt biến môi trường GH_TOKEN (scope repo) rồi chạy lại.");
  console.error('  PowerShell:  $env:GH_TOKEN="ghp_xxx"; node deploy-kiemsoatkho.mjs');
  process.exit(1);
}

const api = (p, opt = {}) =>
  fetch("https://api.github.com" + p, {
    ...opt,
    headers: {
      authorization: "Bearer " + TOKEN,
      accept: "application/vnd.github+json",
      "user-agent": "deploy-kiemsoatkho",
      ...(opt.headers || {}),
    },
  });

async function laySha(repoPath) {
  const r = await api(`/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(repoPath)}?ref=${BRANCH}`);
  if (r.status === 404) return null;                       // file chưa tồn tại → tạo mới
  if (!r.ok) throw new Error(`GET ${repoPath}: ${r.status} ${await r.text()}`);
  return (await r.json()).sha;
}

async function day(localFile, repoPath) {
  const abs = path.join(DIR, localFile);
  if (!fs.existsSync(abs)) { console.warn(`  (bỏ qua, không thấy ${localFile})`); return; }
  const buf = fs.readFileSync(abs);
  const content = buf.toString("base64");
  const sha = await laySha(repoPath);
  const body = { message: `deploy ${repoPath} (${new Date().toISOString()})`, content, branch: BRANCH };
  if (sha) body.sha = sha;
  const r = await api(`/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(repoPath)}`, {
    method: "PUT", body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`PUT ${repoPath}: ${r.status} ${await r.text()}`);
  const j = await r.json();
  console.log(`  ✓ ${repoPath}  (${(buf.length / 1024).toFixed(1)} KB, commit ${j.commit.sha.slice(0, 7)})`);
}

(async () => {
  console.log(`→ Đẩy lên ${OWNER}/${REPO}@${BRANCH} (https://${OWNER}.github.io/${REPO}/)`);
  for (const [local, remote] of FILES) await day(local, remote);
  console.log("✓ Xong. GitHub Pages cập nhật sau ~30–60 giây.");
})().catch((e) => { console.error("✗ " + e.message); process.exit(2); });
