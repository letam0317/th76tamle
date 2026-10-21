/* QC 19/10: LAPTOP TẮT → điện thoại vẫn xem được Xác minh qua máy chủ DỰ PHÒNG (may-chu-du-phong.mjs trên PC).
 * Giả lập trên laptop, KHÔNG đụng máy chủ chính / đường hầm chính đang chạy:
 *   · bật bản dự phòng ở cổng 8592 (XM_DU_PHONG=1) + 1 đường hầm cloudflared riêng trỏ vào 8592;
 *   · gọi thẳng: không phiên → 401; có phiên mà ghi (POST) → 503; ping báo duPhong;
 *   · Apps Script: gửi nhịp máy giả QC-THU-DUPHONG kèm xmHam → bảng nhịp trả lại xmHam → gỡ máy giả;
 *   · điện thoại (UA Android 390×844, bản QC localhost:8123): chặn 127.0.0.1:8591 + tệp summary/xm-may-chu.json (= laptop tắt),
 *     trả lời pcBangPh bằng máy giả → trang phải tự sang bản dự phòng, 3 mục có dữ liệu, có báo «chỉ xem», không nhớ địa chỉ dự phòng.
 * Không ghi dữ liệu thật: mọi POST khác bị chặn. Dùng: node qc-du-phong-xm.mjs */
import fs from "node:fs";
import { spawn } from "node:child_process";
import puppeteer from "puppeteer-core";
import "dotenv/config";
import { phienQC } from "./xacminh-dang-nhap.mjs";
import { gasPost } from "./session-rules.js";

const PHIEN = phienQC();
const GOC = "http://localhost:8123/kiemsoatkho/";
const ANH = "C:/Users/lechitam/AppData/Local/Temp/claude/C--Users-lechitam-New-folder/7859bf53-989a-4347-a586-f8673c0da2ff/scratchpad/";
const MAY_GIA = "QC-THU-DUPHONG";
let dat = 0, truot = 0; const ok = (d, t) => { d ? dat++ : truot++; console.log((d ? "  ✓ " : "  ✗ ") + t); };
const ngu = (ms) => new Promise((r) => setTimeout(r, ms));

const sv = spawn(process.execPath, ["bang-591.mjs"], { env: { ...process.env, XM_DU_PHONG: "1", BANG591_PORT: "8592" }, windowsHide: true, stdio: "ignore" });
let HAM = ""; const cf = spawn("bin/cloudflared.exe", ["tunnel", "--no-autoupdate", "--protocol", "http2", "--url", "http://127.0.0.1:8592"], { windowsHide: true });
const doc = (b) => { const m = String(b).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/); if (m && !HAM) HAM = m[0]; };
cf.stdout.on("data", doc); cf.stderr.on("data", doc);
const don = () => { try { sv.kill(); } catch { /* */ } try { cf.kill(); } catch { /* */ } };
try {
  for (let i = 0; i < 60 && !HAM; i++) await ngu(1000);
  let song = false; for (let i = 0; i < 30 && HAM && !song; i++) { song = await fetch(HAM + "/api/ping").then((r) => r.ok, () => false); if (!song) await ngu(4000); }
  ok(song, "đường hầm dự phòng sống: " + HAM);
  const pj = await fetch(HAM + "/api/ping").then((r) => r.json(), () => ({}));
  ok(pj.duPhong === 1, "ping báo đang là bản dự phòng");
  for (const [p, ma] of [["/api/du-lieu", 401], ["/", 401], ["/api/bo-cai-pc", 401]]) {
    const r = await fetch(HAM + p, { headers: { "user-agent": "Mozilla/5.0" } }).catch(() => ({ status: 0 }));
    ok(r.status === ma, "không phiên " + p + " → " + r.status);
  }
  const ghi = await fetch(HAM + "/api/quyet-dinh", { method: "POST", headers: { "x-hx-phien": PHIEN, "content-type": "application/json", "user-agent": "Mozilla/5.0" }, body: "{}" }).catch(() => ({ status: 0 }));
  ok(ghi.status === 503, "có phiên mà ghi quyết định → bị từ chối (" + ghi.status + "), không ghi ở 2 nơi");
  const dl = await fetch(HAM + "/api/du-lieu", { headers: { "x-hx-phien": PHIEN, "user-agent": "Mozilla/5.0" } }).then((r) => r.ok ? r.json() : null, () => null);
  ok(!!dl, "có phiên → đọc được dữ liệu");

  // Apps Script: nhịp máy giả mang xmHam
  const nh = await gasPost({ action: "pcNhip", key: process.env.APPSCRIPT_KEY, nhip: { may: MAY_GIA, xmHam: HAM, coKhoa: [], diem: 0 } }, () => {}, "qc");
  const dong = ((nh && nh.bang) || []).find((m) => m.may === MAY_GIA);
  ok(dong && dong.xmHam === HAM, "Apps Script giữ địa chỉ dự phòng trong nhịp tim (" + (dong ? dong.xmHam : "không thấy máy") + ")");
  const xoa = await gasPost({ action: "pcLenh", key: process.env.APPSCRIPT_KEY, may: MAY_GIA, xoa: true }, () => {}, "qc");
  ok(xoa && xoa.status === "success", "đã gỡ máy giả khỏi danh sách");

  // Điện thoại khi laptop tắt
  const b = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: "new" });
  const pg = await b.newPage(); const loi = [], goiHam = [];
  pg.on("pageerror", (e) => loi.push(e.message));
  await pg.setUserAgent("Mozilla/5.0 (Linux; Android 14; 23116PN5BC) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36");
  await pg.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await pg.evaluateOnNewDocument((hx) => { if (window.top !== window) return; /* 21/10: khung con cùng gốc cũng chạy đoạn này → xoá nhầm hx-ham, «không nhớ» đạt giả */ try { localStorage.setItem("hx-phien", hx); localStorage.removeItem("hx-ham"); localStorage.setItem("tk-phien", "qc");
    localStorage.setItem("tk-nho", JSON.stringify({ ts: Date.now(), nguoi: { id: "qc", ten: "QC", vaiTro: "quantri" }, quyen: { "r.xacminh": "lam", "r.maytram": "lam" } })); } catch (e) {} }, PHIEN);
  await pg.evaluateOnNewDocument(() => { window.__qcToast = []; new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.classList && n.classList.contains("toast")) window.__qcToast.push(n.textContent); })))
    .observe(document, { childList: true, subtree: true }); });
  await pg.setRequestInterception(true);
  pg.on("request", (r) => { const u = r.url();
    if (/127\.0\.0\.1:8591|summary\/xm-may-chu\.json/.test(u)) return r.abort();   // laptop tắt: máy chủ chính + địa chỉ đường hầm laptop không trả lời
    if (u.startsWith(HAM)) goiHam.push(u.replace(HAM, ""));
    if (/script\.google\.com/.test(u) && r.method() === "POST" && /"pcBangPh"/.test(r.postData() || ""))
      return r.respond({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ status: "success", srvNow: Date.now(), may: [{ may: MAY_GIA, luc: new Date().toISOString(), xmHam: HAM }] }) });
    if (r.method() !== "GET" && r.method() !== "OPTIONS" && r.method() !== "HEAD") return r.abort();
    r.continue(); });
  await pg.goto(GOC + "?tab=xacminh", { waitUntil: "networkidle2", timeout: 60000 });
  const coMay = await pg.waitForFunction(() => window.__HX_MAY_CHU && window.HXACMINH, { timeout: 60000 }).then(() => 1, () => 0);
  const st = await pg.evaluate(() => ({ api: window.HX_API, dp: window.__HX_DU_PHONG, nho: localStorage.getItem("hx-ham") }));
  ok(coMay && st.api === HAM, "điện thoại tự sang máy chủ dự phòng (HX_API=" + st.api + ")");
  ok(st.dp === 1, "trang biết đang xem bản dự phòng");
  ok(!st.nho, "không nhớ địa chỉ dự phòng (laptop bật lại thì về laptop)");
  const muc = await pg.evaluate(() => [...document.querySelectorAll("#sideNav .s-item")].map((e) => e.textContent.trim()));
  for (const t of ["Theo tác vụ", "Theo máy", "Nhật ký"]) ok(muc.some((m) => m.includes(t)), "thanh bên có mục «" + t + "»");
  for (const [sub, sel, ten] of [["treo", "[data-p]", "Theo tác vụ"], ["cam", "[data-lid]", "Theo máy"], ["tg", "tr.hx-tg-nhom", "Nhật ký"]]) {
    if (!coMay) break;
    await pg.evaluate((s) => window.HXACMINH.sub(s), sub); await ngu(3000);
    const n = await pg.evaluate((sel) => document.querySelectorAll(sel.startsWith("tr.") ? sel : "#hxBody " + sel).length, sel);
    ok(n > 0, ten + ": có dữ liệu (" + n + ")");
    await pg.screenshot({ path: ANH + "dp-" + sub + ".png" });
  }
  const bao = await pg.evaluate(() => (window.__qcToast || []).join(" | "));
  ok(/bản dự phòng/.test(bao), "có báo «đang xem bản dự phòng» (" + bao.slice(0, 90) + ")");
  ok(goiHam.length > 0, "dữ liệu đi qua đường hầm dự phòng (" + goiHam.length + " lượt)");
  ok(loi.length === 0, "không lỗi trang " + loi.slice(0, 2).join(" | "));
  await b.close();
} catch (e) { ok(false, "lỗi QC: " + e.message); }
don();
console.log((truot ? "✗ " : "✓ ") + dat + "/" + (dat + truot) + " đạt");
process.exit(truot ? 1 : 0);
