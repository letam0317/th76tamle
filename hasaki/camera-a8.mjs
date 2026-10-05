#!/usr/bin/env node
/**
 * camera-a8.mjs — Kéo bản đồ NGƯỜI ↔ TRẠM (máy đóng gói A8) từ hệ camera top-review.
 *
 * Nguồn: hasaki.top-review.io  →  POST /auth/login {username,password}  →  GET /cameras
 * Mục đích: biết ai đứng máy nào / mã trạm F0-A8-… nào / lúc mấy giờ (giờ đóng đơn cuối)
 *           để đối chiếu trách nhiệm 5S bàn đóng gói. KHÔNG chạm work/wms/hr/planogram.
 *
 * Bí mật lấy từ .env (cùng thư mục): TOPREVIEW_BASE / TOPREVIEW_USER / TOPREVIEW_PASS.
 * Đầu ra (đều PII → .exports/ đã gitignore):
 *   .exports/camera-a8-latest.json  — dữ liệu chuẩn hoá + tóm tắt
 *   .exports/CAMERA-A8.md           — bảng đọc bằng mắt
 *
 * Chạy (từ thư mục hasaki/):
 *   node camera-a8.mjs            # kéo 1 lần, in tóm tắt + bảng, ghi .exports
 *   node camera-a8.mjs --json     # in JSON chuẩn hoá ra stdout
 *   node camera-a8.mjs --quiet    # chỉ ghi file, không in bảng
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") }); // đọc hasaki/.env dù cwd ở đâu

const BASE = (process.env.TOPREVIEW_BASE || "https://hasaki.top-review.io/api/v1").replace(/\/+$/, "");
const USER = process.env.TOPREVIEW_USER;
const PASS = process.env.TOPREVIEW_PASS;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) camera-a8/1.0";

const EXPORT_DIR = path.join(__dirname, ".exports");
const TOKEN_CACHE = path.join(EXPORT_DIR, ".tr-token.json");
const OUT_JSON = path.join(EXPORT_DIR, "camera-a8-latest.json");
const OUT_MD = path.join(EXPORT_DIR, "CAMERA-A8.md");

const args = new Set(process.argv.slice(2));
const wantJson = args.has("--json");
const quiet = args.has("--quiet");

function ensureExportDir() {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

// ---- fetch có trần thời gian + backoff nhẹ (không đập dồn máy chủ) --------------
async function req(url, opts = {}, { retries = 2 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await fetch(url, {
        ...opts,
        headers: { "User-Agent": UA, Accept: "application/json", ...(opts.headers || {}) },
        signal: AbortSignal.timeout(30000),
      });
      return r;
    } catch (e) {
      lastErr = e;
      if (i < retries) await new Promise((s) => setTimeout(s, 1500 * (i + 1))); // 1.5s, 3s
    }
  }
  throw lastErr;
}

// ---- token: cache trong .exports, chỉ đăng nhập lại khi hết hạn -----------------
function decodeExpMs(jwt) {
  try {
    const p = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"));
    return p.exp ? p.exp * 1000 : 0;
  } catch { return 0; }
}

function readCachedToken() {
  try {
    const c = JSON.parse(fs.readFileSync(TOKEN_CACHE, "utf8"));
    if (c.token && (!c.exp || c.exp - Date.now() > 120000)) return c.token; // còn >2'
  } catch { /* chưa có cache */ }
  return null;
}

async function login() {
  if (!USER || !PASS) {
    throw new Error("Thiếu TOPREVIEW_USER / TOPREVIEW_PASS trong hasaki/.env");
  }
  const r = await req(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USER, password: PASS }),
  });
  const t = await r.text();
  if (!r.ok) {
    let msg = t;
    try { msg = JSON.parse(t).message || t; } catch { /* body không phải JSON */ }
    throw new Error(`Đăng nhập lỗi HTTP ${r.status}: ${msg}`);
  }
  const j = JSON.parse(t);
  const token = j?.data?.token || j?.token || j?.access_token;
  if (!token) throw new Error("Đăng nhập OK nhưng không tìm thấy token trong phản hồi.");
  ensureExportDir();
  fs.writeFileSync(TOKEN_CACHE, JSON.stringify({ token, exp: decodeExpMs(token) }), "utf8");
  return token;
}

async function apiGet(pathname, token) {
  const r = await req(`${BASE}${pathname}`, { headers: { Authorization: `Bearer ${token}` } });
  const t = await r.text();
  if (r.status === 401) { const e = new Error("401"); e.unauth = true; throw e; }
  if (!r.ok) throw new Error(`GET ${pathname} lỗi HTTP ${r.status}`);
  // API trả JSON; guard phòng khi trả HTML (proxy/WAF)
  if (t[0] !== "{" && t[0] !== "[") throw new Error(`GET ${pathname} không trả JSON`);
  return JSON.parse(t);
}

// tự đăng nhập lại 1 lần nếu token cache đã hết hạn ngầm
async function getWithAuth(pathname) {
  let token = readCachedToken() || (await login());
  try {
    return await apiGet(pathname, token);
  } catch (e) {
    if (e.unauth) { token = await login(); return await apiGet(pathname, token); }
    throw e;
  }
}

// ---- chuẩn hoá 1 camera → 1 dòng người/trạm -----------------------------------
const TZ = "Asia/Ho_Chi_Minh";
function gio(ms) {
  if (!ms) return "-";
  return new Date(Number(ms)).toLocaleTimeString("vi-VN", { hour12: false, timeZone: TZ });
}
function ngayGio(ms) {
  if (!ms) return "-";
  return new Date(Number(ms)).toLocaleString("vi-VN", { hour12: false, timeZone: TZ });
}
function mayNum(m) {
  const n = parseInt(String(m || "").replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : 99999;
}

function chuanHoa(cam) {
  return {
    code: cam.code || "",
    may: cam.machine || "",
    mayNum: mayNum(cam.machine),
    tram: cam.location || "",
    nguoi: cam.worker || "",
    don: Number(cam.today_count || 0),
    dongCuoiMs: Number(cam.last_cut_at || 0),
    dongCuoi: gio(cam.last_cut_at),
    ghiHinh: !!cam.recording,
    online: !!cam.online,
    ip: cam.ip || "",
  };
}

function bangMd(rows, fetchedAt, tt) {
  const line = (r) =>
    `| ${r.may || "—"} | ${r.tram || "—"} | ${r.nguoi || "—"} | ${r.don} | ${r.dongCuoi} | ${r.ghiHinh ? "CÓ" : "—"} | ${r.online ? "on" : "OFF"} |`;
  const head = "| Máy | Trạm | Người | Đơn | Đóng cuối | Ghi hình | Online |\n|---|---|---|---:|---|---|---|";
  const coNguoi = rows.filter((r) => r.nguoi).sort((a, b) => a.mayNum - b.mayNum);
  const chuaNguoi = rows.filter((r) => !r.nguoi && (r.may || r.tram)).sort((a, b) => a.mayNum - b.mayNum);
  return [
    `# Người ↔ trạm máy đóng gói A8 — ${ngayGio(fetchedAt)}`,
    "",
    `Tổng camera **${tt.tong}** · online **${tt.online}** · đang ghi hình **${tt.ghiHinh}** · có người đứng máy **${tt.coNguoi}** · có gán máy **${tt.coMay}**.`,
    "",
    `## Có người đứng máy (${coNguoi.length})`,
    head,
    ...coNguoi.map(line),
    "",
    `## Có máy/trạm nhưng CHƯA gán người (${chuaNguoi.length})`,
    head,
    ...chuaNguoi.map(line),
    "",
  ].join("\n");
}

async function main() {
  const cam = await getWithAuth("/cameras");
  const list = Array.isArray(cam) ? cam : cam.data || cam.items || [];
  const rows = list.map(chuanHoa);
  const fetchedAt = Date.now();
  const tt = {
    tong: rows.length,
    online: rows.filter((r) => r.online).length,
    ghiHinh: rows.filter((r) => r.ghiHinh).length,
    coNguoi: rows.filter((r) => r.nguoi).length,
    coMay: rows.filter((r) => r.may).length,
  };

  ensureExportDir();
  fs.writeFileSync(OUT_JSON, JSON.stringify({ fetchedAt, ...tt, rows }, null, 2), "utf8");
  fs.writeFileSync(OUT_MD, bangMd(rows, fetchedAt, tt), "utf8");

  if (wantJson) {
    process.stdout.write(JSON.stringify({ fetchedAt, ...tt, rows }, null, 2) + "\n");
    return;
  }
  console.log(
    `Tổng ${tt.tong} | online ${tt.online} | ghi hình ${tt.ghiHinh} | có người ${tt.coNguoi} | có máy ${tt.coMay}`
  );
  console.log(`→ ${path.relative(process.cwd(), OUT_JSON)}`);
  console.log(`→ ${path.relative(process.cwd(), OUT_MD)}`);
  if (!quiet) {
    const coNguoi = rows.filter((r) => r.nguoi).sort((a, b) => a.mayNum - b.mayNum);
    console.log("\nMáy   Trạm                 Người                         Đơn  ĐóngCuối  Ghi");
    for (const r of coNguoi) {
      console.log(
        `${(r.may || "").padEnd(6)}${(r.tram || "").padEnd(21)}${(r.nguoi || "").padEnd(30)}${String(r.don).padStart(4)}  ${r.dongCuoi.padEnd(9)} ${r.ghiHinh ? "CÓ" : ""}`
      );
    }
  }
}

main().catch((e) => {
  console.error("LỖI:", e.message);
  process.exit(1);
});
