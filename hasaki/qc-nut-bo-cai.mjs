// qc-nut-bo-cai.mjs — bộ đo nút «Tải bộ cài PC». 14/10 user: «tải ngay trên nút ở audit-dc — tóm gọn 1 lần cài».
// 20/10 ĐÁNH GIÁ AN NINH (user «xử lý hết»): cửa pcBoCai từng trả trọn gói khoá cho bất kỳ ai → nay ĐÒI PHIÊN tài khoản có quyền Xác minh (hoặc phiên Máy trạm).
//   Ca 1 (không phiên): bấm nút → mở ĐĂNG NHẬP, KHÔNG gọi pcBoCai, KHÔNG tải.
//   Ca 2 (có phiên tài khoản): bấm nút → pcBoCai kèm ph → tải ngay .bat CÓ khoá, CRLF. Chế độ PC: CHẶN 127.0.0.1:8591 (GAS GIẢ, không POST thật).
//   node qc-nut-bo-cai.mjs [--url=http://localhost:8123/kiemsoatkho/]   (chạy được cả trên audit-dc)
import puppeteer from "puppeteer-core";
import fs from "node:fs"; import path from "node:path"; import os from "node:os"; import { fileURLToPath } from "node:url";
const URL0 = (process.argv.find((a) => a.startsWith("--url=")) || "").slice(6) || "http://localhost:8123/kiemsoatkho/";
const DL = fs.mkdtempSync(path.join(os.tmpdir(), "qc-nut-")), GOI = Buffer.from("APPSCRIPT_KEY=gia\nAPPSCRIPT_URL=https://gia").toString("base64");
const BAT = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "cai-pc", "CAI-PC-1LAN.bat"));
let loi = 0; const ok = (dk, ten) => { console.log((dk ? "  OK   " : "  FAIL ") + ten); if (!dk) loi++; };
const b = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: "new" });
try {
  for (const [ten, w, h, mob, coPhien] of [["pc-khong-phien", 1366, 860, false, false], ["pc-co-phien", 1366, 860, false, true], ["ip14-co-phien", 390, 844, true, true]]) {
    console.log("== " + ten);
    for (const f of fs.readdirSync(DL)) fs.unlinkSync(path.join(DL, f));
    const p = await b.newPage(); const thatGui = [], gasGoi = [];
    await (await p.createCDPSession()).send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: DL });
    await p.evaluateOnNewDocument((co) => { localStorage.removeItem("hx-phien"); localStorage.removeItem("mt-phien");
      if (co) { localStorage.setItem("tk-phien", "qc-phien-gia"); localStorage.setItem("tk-nho", JSON.stringify({ ts: Date.now(), nguoi: { id: "qc", ten: "QC", vaiTro: "quantri" }, quyen: { "r.xacminh": "lam", "r.tong": "lam" } })); }
      else { localStorage.removeItem("tk-phien"); localStorage.removeItem("tk-nho"); } }, coPhien);
    await p.setViewport({ width: w, height: h, isMobile: mob, hasTouch: mob });
    await p.setRequestInterception(true);
    p.on("request", (r) => {
      const u = r.url();
      if (/127\.0\.0\.1:8591/.test(u)) return r.abort();
      if (r.method() === "POST" && /script\.google\.com/.test(u)) { const o = JSON.parse(r.postData() || "{}"); gasGoi.push(o);
        if (o.action === "pcBoCai") return r.respond({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(o.ph ? { status: "success", goi: GOI } : { status: "error", code: 401, message: "Cần đăng nhập" }) }); }
      if (r.method() === "POST" && /\/api\/tk-/.test(u)) return r.abort();   // module tài khoản (chỉ bản nội bộ) — không phải nút tải
      if (r.method() === "POST") { thatGui.push(u); return r.abort(); }
      if (/\/CAI-PC-1LAN\.bat/.test(u) && /localhost|127\.0\.0\.1/.test(u)) return r.respond({ status: 200, contentType: "application/octet-stream", body: BAT });   // bản nội bộ không có file này (deploy chép từ cai-pc)
      r.continue();
    });
    await p.goto(URL0 + "?tab=home", { waitUntil: "networkidle2" }).catch(() => {});
    await p.waitForFunction(() => typeof hienModal === "function" && document.getElementById("btnTaiBoCai") && typeof APPSCRIPT_URL !== "undefined", { timeout: 30000 });
    await new Promise((r) => setTimeout(r, 1500));
    await p.evaluate(() => document.getElementById("btnTaiBoCai").click());
    let tep = []; for (let i = 0; i < 40 && !(tep = fs.readdirSync(DL).filter((f) => f.endsWith(".bat"))).length; i++) await new Promise((r) => setTimeout(r, 300));
    const nd = tep[0] ? fs.readFileSync(path.join(DL, tep[0]), "utf8") : "";
    const dangNhapMo = await p.evaluate(() => !!document.querySelector("#tkModal.show, .tk-dn.show, #modal.show, [data-tk-modal].show") || /Đăng nhập/.test((document.querySelector(".modal.show, #modal.show, .tk-pop") || {}).textContent || ""));
    if (!coPhien) {
      ok(dangNhapMo, "không phiên: bấm nút → mở ĐĂNG NHẬP");
      ok(!gasGoi.some((o) => o.action === "pcBoCai"), "không phiên: KHÔNG gọi pcBoCai");
      ok(!tep[0], "không phiên: KHÔNG tải gì");
    } else {
      ok(gasGoi.some((o) => o.action === "pcBoCai" && o.ph === "qc-phien-gia"), "có phiên: gọi pcBoCai KÈM ph");
      ok(!!tep[0] && nd.includes('set "HSK_KHOA_B64=' + GOI + '"'), "có phiên: tải ngay file .bat CÓ khoá (" + (tep[0] || "không có") + ")");
      ok(nd.indexOf("HSK_KHOA_B64") > nd.indexOf("net session") && nd.indexOf("HSK_KHOA_B64") < nd.indexOf('set "REPO='), "dòng khoá nằm SAU bước nâng quyền, TRƯỚC REPO");
      ok(/\r\n/.test(nd) && !/[^\r]\n/.test(nd), "file .bat xuống dòng kiểu Windows (CRLF)");
    }
    ok(!thatGui.length, "không gửi POST nào ra ngoài (" + thatGui.length + ")");
    await p.close();
  }
} finally { await b.close(); fs.rmSync(DL, { recursive: true, force: true }); }
console.log(loi ? `\n${loi} ca HỎNG` : "\nĐẠT tất cả"); process.exit(loi ? 1 : 0);
