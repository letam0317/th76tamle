/**
 * tra-inside.mjs — THĂM DÒ inside.mastige.vn BẰNG HTTP DIGEST (chỉ ĐỌC, chạy tay)
 * ===========================================================================================
 *  Vì sao: trạng thái Active/Inactive THẬT của sản phẩm nằm ở inside.mastige.vn/sales/product
 *  (user chốt 22/08/2026) — WMS không có cờ này trong báo cáo tồn, nên STATUS của SKU_MASTER
 *  đang phải SUY từ tồn kho (sai nghĩa với SKU Active mà tồn 0, ví dụ 422364500).
 *
 *  Chặng ngoài của inside.mastige.vn là HTTP DIGEST (realm "inside.hasaki.vn" — đo 22/08/2026,
 *  401 + www-authenticate: Digest). ĐO 22/08/2026: khoá Digest CHÍNH LÀ tài khoản Hasaki
 *  (HASAKI_EMAIL / HASAKI_PASSWORD) — HTTP 200 ngay. Nên mặc định dùng cặp đó; muốn tài khoản
 *  riêng thì đặt INSIDE_USER / INSIDE_PASS trong .env để đè.
 *  (bí mật CHỈ nằm trong .env — lệ dự án; file này không in mật khẩu ra màn hình/log)
 *
 *  Đi bằng curl --digest (curl lo bắt tay nonce/qop, khỏi tự cài RFC 2617). Sau chặng Digest
 *  chưa biết app còn lớp đăng nhập riêng hay không — nên bước đầu là THĂM DÒ: tải URL, lưu
 *  nguyên body + headers vào .exports/inside/ để soi app là server-render hay SPA gọi API nào.
 *
 *  node tra-inside.mjs "https://inside.mastige.vn/sales/product" [--json]
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import "dotenv/config";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, ".exports", "inside");
fs.mkdirSync(OUT, { recursive: true });

const URL_TRA = process.argv.find((x) => /^https?:\/\//.test(x)) || "https://inside.mastige.vn/sales/product";
const U = process.env.INSIDE_USER || process.env.HASAKI_EMAIL;
const P = process.env.INSIDE_PASS || process.env.HASAKI_PASSWORD;
if (!U || !P) {
  console.error("✗ Thiếu khoá Digest: đặt INSIDE_USER/INSIDE_PASS, hoặc HASAKI_EMAIL/HASAKI_PASSWORD trong .env.");
  process.exit(3);
}

/* Cookie phiên app (sau lớp SSO): user dán từ trình duyệt đang đăng nhập. Nhận cả chuỗi thô
   "ci_session=abc" lẫn cả header nhiều cookie; đọc từ .env INSIDE_COOKIE hoặc file .inside-cookie
   (gitignore) để khỏi phơi trên dòng lệnh. */
const COOKIE = (process.env.INSIDE_COOKIE
  || (fs.existsSync(path.join(DIR, ".inside-cookie")) ? fs.readFileSync(path.join(DIR, ".inside-cookie"), "utf8") : "")
  ).trim();

const ten = URL_TRA.replace(/^https?:\/\//, "").replace(/[^a-z0-9]+/gi, "-").slice(0, 80);
const fBody = path.join(OUT, ten + ".html");
const fHead = path.join(OUT, ten + ".headers.txt");

let ra;
try {
  const args = ["-s", "--digest", "-u", U + ":" + P, "-D", fHead, "-o", fBody,
    "-w", "%{http_code} %{content_type} %{size_download}", "-m", "30", "-L"];
  if (COOKIE) args.push("-H", "cookie: " + COOKIE);
  args.push(URL_TRA);
  ra = execFileSync("curl", args, { encoding: "utf8", maxBuffer: 2e7 });
} catch (e) {
  console.error("✗ curl lỗi: " + String(e.message).slice(0, 200));
  process.exit(2);
}
const [code, ctype, size] = ra.trim().split(" ");
console.log("HTTP " + code + " · " + ctype + " · " + size + " byte");
console.log("→ body:    " + fBody);
console.log("→ headers: " + fHead);
if (code === "401") { console.log("⚠ Vẫn 401 — khoá Digest sai hoặc đổi rồi."); process.exit(1); }

const body = fs.readFileSync(fBody, "utf8");
/* Soi nhanh app là gì: SPA (script bundle + gọi API) hay server-render (bảng HTML có sẵn) */
const scripts = [...body.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]).slice(0, 8);
const apis = [...body.matchAll(/https?:\/\/[a-z0-9.-]*(?:api|gw|gateway)[a-z0-9.-]*\.[a-z.]+[^"'\s]*/gi)].map((m) => m[0]);
const bang = /<table|<tbody/i.test(body);
console.log("\nScript bundle:", scripts.length ? "" : "(không có)");
scripts.forEach((s) => console.log("   ", s.slice(0, 110)));
console.log("URL dạng API trong body:", apis.length ? "" : "(không thấy)");
[...new Set(apis)].slice(0, 6).forEach((s) => console.log("   ", s.slice(0, 110)));
console.log("Có <table> trong body:", bang);
console.log("Tiêu đề:", (body.match(/<title>([^<]*)<\/title>/i) || [])[1] || "(không có)");
