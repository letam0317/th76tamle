/**
 * sync-guard.js — WATCHDOG "dữ liệu tồn kho factory PHẢI mới trong ngày".
 *
 *  Sinh ra từ sự cố 21/07/2026: máy tắt lúc 7h → task chạy bù 9:34 → máy restart 9:37
 *  giết cả cụm giữa chừng → dashboard trơ dữ liệu cũ tới tận khi chạy tay.
 *
 *  Được gọi từ 3 nơi:
 *   - Task Scheduler "Factory watchdog ton kho": khi đăng nhập máy (+5') và mỗi giờ 7h-17h.
 *   - watch-login-request.js: khi có cờ "Tải lại dữ liệu" từ dashboard (chạy với --force).
 *   - Chạy tay: node sync-guard.js [--force] [--thu]
 *       --thu = chạy KHÔ: in đủ phán quyết (cũ/mới · nguồn token · vé ưu tiên) rồi dừng, không
 *               spawn cụm, không ghi mốc, không chiếm lock — dùng để soi "vì sao guard quyết vậy".
 *
 *  Thuật toán:
 *   1) Khoá đơn lượt (.sync-guard.lock) + né khi cụm sync khác đang chạy.
 *   2) Đọc mốc đồng bộ (Metadata!B1 của Sheet, qua gviz công khai) + mốc TỪNG BƯỚC
 *      (.sync-ok-<bước>, vá 25/07/2026 — trước chỉ nhìn Metadata do riêng stocklocation ghi,
 *      nên kiemke chết vì "fetch failed" 24/07 mà guard vẫn tưởng mới, trơ dữ liệu 3 tiếng).
 *      CŨ = mốc CŨ NHẤT của cụm < 08:40 hôm nay VÀ bây giờ ≥ 09:25 (nhường task 8h40 chạy
 *      trước — lịch "5S Dong bo dashboard" dời 7h00→8h40 ngày 22/07/2026 vì máy hay bật muộn).
 *      --force = bỏ kiểm tra cũ/mới (cooldown 4h đã kiểm ở GAS khi đặt cờ).
 *      Lượt VÁ (không --force) đặt SYNC_SKIP_FRESH=1: bước còn tươi (trễ < CANH_TRE_PHUT) tự thoát
 *      sớm, chỉ bước còn cũ chạy lại — không kéo trùng cả cụm ~25 phút.
 *   2b) VÉ ƯU TIÊN (15/08/2026): kênh work/wms/planogram chết ở tick trước mà SỐNG ở tick này
 *      ⇒ bỏ qua backoff 20', làm tươi ngay bằng bridge. Đây là đường "mỗi sáng operator vừa đăng
 *      nhập là dữ liệu tự bắt kịp trong ≤2 phút", và nó KHÔNG bao giờ mở đường login (đã có token).
 *   3) Chọn nguồn token qua layTokenSongWms (session-rules, 22/07/2026): kho BẤT KỂ tuổi
 *      + get-me trọng tài → bridge GAS → còn sống là chạy, KHÔNG đăng nhập mới.
 *      Hết cả hai: chỉ re-login trong khung an toàn (<07:45 / ≥18:00) · còn lại HOÃN (exit 75).
 *   4) Gọi SYNC-STOCK.bat (3 bước, log riêng từng bước) rồi đọc lại Metadata để kết luận.
 *
 *  Exit: 0 = đã mới / chạy xong · 75 = hoãn (sẽ tự thử lại ở tick sau) · 2 = lỗi.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { spawn, execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { duocPhepReLogin, layTokenSongWms, layTokenSongWork, DEFER_EXIT, docMocBuoc, CAC_BUOC_SYNC,
         trangThaiPhien, kenhWshrDaChungThuc, phutVN } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SHEET_ID = process.env.STOCKLOC_SHEET_ID || "1eY_oo9fAvWCTXp24x-Z0FXq9mp_jJPlTHg09qdemETs";
const LOCK = path.join(DIR, ".sync-guard.lock");
const LAN_VA = path.join(DIR, ".sync-guard.last-run");   // mốc lượt VÁ gần nhất (backoff 20' — tick 2' không được spam cụm khi 1 bước hỏng kéo dài)
const VA_BACKOFF_MS = 20 * 60 * 1000;
/* Trạng thái phiên của tick TRƯỚC — để nhận ra "operator vừa có phiên trở lại" (vé ưu tiên, xem 2b) */
const PHIEN_TRUOC = path.join(DIR, ".guard-phien-truoc.json");
const VE_UU_TIEN_MS = 10 * 60 * 1000;   // 2 vé ưu tiên phải cách nhau ≥10' (phiên chập chờn không spam cụm)
/* Ngưỡng TRỄ TRONG NGÀY (vá 12/08/2026 — sự cố 11/08): xem chú thích ở `cu` bên dưới.
 * Dùng CHUNG env với cảm biến canh-suc-khoe.js để 2 tầng không bao giờ lệch nhau. */
const NGUONG_TRE_MS = Number(process.env.CANH_TRE_PHUT || 90) * 60000;
const FORCE = process.argv.includes("--force");
/* --thu: chạy KHÔ — in đủ phán quyết (cũ/mới, nguồn token, vé ưu tiên) nhưng KHÔNG spawn cụm,
   KHÔNG ghi mốc backoff/trạng thái phiên. Để soi "vì sao guard quyết như vậy" mà không tốn lượt API
   và không đụng cụm đang chạy. Thêm 15/08/2026 khi kiểm chứng vé ưu tiên. */
const THU = process.argv.includes("--thu");
const log = (...a) => console.log(new Date().toLocaleString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" }), ...a);

/* ---- 1) Khoá đơn lượt: lock < 45' coi như đang có guard khác chạy ---- */
function giuKhoa() {
  try {
    if (fs.existsSync(LOCK) && Date.now() - fs.statSync(LOCK).mtimeMs < 45 * 60 * 1000) return false;
  } catch { /* đọc lock lỗi → cứ ghi đè */ }
  fs.writeFileSync(LOCK, String(process.pid));
  return true;
}
const nhaKhoa = () => { try { fs.rmSync(LOCK, { force: true }); } catch { /* bỏ qua */ } };

/* ---- Cụm sync khác (task 7h / guard khác / chạy tay) đang chạy? — soi command line ---- */
function cumDangChay() {
  return new Promise((res) => {
    execFile("powershell", ["-NoProfile", "-Command",
      "Get-CimInstance Win32_Process -Filter \"Name='node.exe' or Name='cmd.exe'\" | Select-Object -ExpandProperty CommandLine"],
      { windowsHide: true, timeout: 30000 },
      (err, out) => {
        if (err || !out) return res(false);
        const dau = /sync-stocklocation\.js|push-pc-to-sheet\.mjs|sync-tonbatthuong\.js|sync-vesinh-all\.js|sync-vesinh-factory\.mjs|sync-vesinh-ai\.mjs|auto-export-sync\.js|SYNC-STOCK\.bat|AUTO-EXPORT\.bat/i;
        res(out.split(/\r?\n/).some((l) => dau.test(l)));
      });
  });
}

/* ---- 2) Mốc đồng bộ cuối: Metadata!B1 (epoch ms) qua gviz công khai ---- */
async function docMocMeta() {
  const url = "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/gviz/tq?tqx=out:json&sheet=Metadata&range=B1&_=" + Date.now();
  const r = await fetch(url).catch(() => null);
  if (!r || !r.ok) return null;                       // không đọc được → null = "không biết"
  const t = await r.text().catch(() => "");
  const m = t.match(/"v"\s*:\s*([0-9][0-9.eE+]*)/);
  return m ? Number(m[1]) : 0;                        // 0 = tab chưa có mốc (chưa sync lần nào)
}

const fmtVN = (ms) => new Date(ms).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour12: false });

async function main() {
  if (!THU && await cumDangChay()) { log("Cụm đồng bộ khác đang chạy (task 7h / chạy tay) — guard đứng ngoài."); return 0; }

  const moc = await docMocMeta();
  if (moc == null && !FORCE) { log("⚠ Không đọc được Metadata (mạng?) — không kết luận được, thử lại tick sau."); return DEFER_EXIT; }

  const now = new Date();
  const bayGio = now.getTime();
  const homNay840 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 40, 0).getTime();
  const homNay925 = homNay840 + 45 * 60 * 1000;
  // Mốc CŨ NHẤT của cả cụm (vá 25/07/2026): Metadata!B1 + mốc từng bước .sync-ok-* —
  // 1 bước chết (như kiemke "fetch failed" 24/07) là cả cụm bị coi CŨ để guard chạy vá.
  const buocCu = () => CAC_BUOC_SYNC.filter((b) => docMocBuoc(DIR, b) < homNay840);
  const mocCum = () => Math.min(moc || 0, ...CAC_BUOC_SYNC.map((b) => docMocBuoc(DIR, b)));
  const mocMin = mocCum();
  /* TRỄ TRONG NGÀY (vá 12/08/2026) — trước bản này luật CŨ chỉ là "mốc < 08:40 hôm nay", tức guard
   * là watchdog MỖI NGÀY MỘT LẦN đội lốt watchdog 2 phút: cụm chạy xong buổi sáng là cả ngày còn
   * lại nó in "✓ Dữ liệu đã mới — không cần làm gì". Chiều 11/08/2026 phiên WMS bị đá lúc 13:12,
   * canh-suc-khoe.js kêu "⛔ mốc cũ 362'" hơn 400 lượt liên tiếp, còn guard — tầng DUY NHẤT có
   * quyền chạy lại cụm — vẫn kết luận "không cần làm gì" cho tới lúc tắt máy 19:08. Nay thêm vế
   * "cũ quá ngưỡng 90'" để guard bám đúng cái người dùng nhìn thấy trên dashboard.
   * Chỉ xét trong 07:00–22:30 (khung có người làm, cùng khung với cuaImLangMs) — để máy lỡ bật
   * qua đêm thì không dội cụm suốt đêm. Backoff 20' ở dưới vẫn chặn spam. */
  const p = phutVN(now);   // giờ VN thật, không tin múi giờ máy (dùng chung hàm của session-rules)
  const trongGioCanh = p >= 7 * 60 && p < 22 * 60 + 30;
  const treMs = bayGio - mocMin;
  const treTrongNgay = trongGioCanh && treMs > NGUONG_TRE_MS;
  const cu = FORCE || (mocMin < homNay840 && bayGio >= homNay925) || treTrongNgay;
  if (!cu) {
    if (mocMin < homNay840) log("… Mốc còn cũ (" + (buocCu().join(", ") || "Metadata") + ") nhưng chưa tới 09:25 — nhường task 8h40 chạy trước.");
    else log("✓ Dữ liệu đã mới (Metadata " + (moc ? fmtVN(moc) : "—") + ", đủ mốc " + CAC_BUOC_SYNC.length + " bước hôm nay, trễ " + Math.round(treMs / 60000) + "' < ngưỡng " + Math.round(NGUONG_TRE_MS / 60000) + "') — không cần làm gì.");
    return 0;
  }
  log((FORCE ? "⚡ Có yêu cầu tải lại (--force)"
     : treTrongNgay && mocMin >= homNay840
       ? "⚠ Dữ liệu TRỄ TRONG NGÀY (mốc cũ nhất " + Math.round(treMs / 60000) + "' > ngưỡng " + Math.round(NGUONG_TRE_MS / 60000) + "' · bước: " + (CAC_BUOC_SYNC.filter((b) => bayGio - docMocBuoc(DIR, b) > NGUONG_TRE_MS).join(", ") || "Metadata") + ")"
       : "⚠ Dữ liệu CŨ (Metadata " + (moc ? fmtVN(moc) : "chưa có") + " · bước cũ: " + (buocCu().join(", ") || "—") + ")") + " — chuẩn bị chạy cụm đồng bộ...");

  /* ---- 3) Nguồn token theo session-rules — quyết định chạy hay hoãn ----
     ĐỔI THỨ TỰ 15/08/2026: dò token TRƯỚC backoff. Phải biết "kênh nào vừa sống lại" thì mới cấp
     được vé ưu tiên ở 2b. Không tốn thêm gì đáng kể: sync-poller.js vốn đã get-me mỗi tick 2'. */
  let nguon = null;
  const coWms = !!(await layTokenSongWms(DIR, log));
  if (coWms) nguon = "token sống (kho/bridge — get-me OK, không tạo phiên mới)";
  // Không có phiên WMS nhưng có phiên work/hr: bước 5S vẫn chạy được (cổng wshr riêng), 4 bước
  // factory sẽ tự hoãn (exit 75) — vẫn hơn là đứng im để 5S cũ nguyên ngày.
  const coWork = !nguon && !!(await layTokenSongWork(DIR, log));
  if (coWork) nguon = "token work/hr sống (bridge) — đủ cho bước 5S";

  /* ---- 2b) BACKOFF lượt vá: tick 2' chỉ được spawn cụm tối đa mỗi 20' (1 bước hỏng kéo dài
     không thành dội API cả ngày). Chỉ tính khi cụm THẬT SỰ được spawn — lượt hoãn vì thiếu token
     không ghi mốc, nên sáng sớm vẫn dò token mỗi 2' và bắt được operator login ngay.

     VÉ ƯU TIÊN "PHIÊN VỪA SỐNG LẠI" (15/08/2026, theo yêu cầu vận hành): mỗi sáng, NGAY khi
     operator có phiên work/wms/planogram thì phải làm tươi liền bằng bridge. Cảnh hỏng sáng 15/08:
     08:34 guard chạy khi mới chỉ có token work/hr → ghi mốc backoff → phiên WMS lên lúc ~08:40 lại
     bị CHÍNH backoff của mình chặn tới 08:54 (chỉ nhờ task lịch 08:40 mới cứu). Nay kênh nào chết ở
     tick trước mà sống ở tick này thì được đúng 1 vé đi thẳng, bỏ qua backoff. Vé này KHÔNG mở
     đường login: tới đây đã có token sống nên `nguon` luôn là token mượn — không đá phiên ai. ---- */
  const coPhien = coWms || coWork;
  let truoc = {};
  try { truoc = JSON.parse(fs.readFileSync(PHIEN_TRUOC, "utf8")); } catch { /* tick đầu tiên */ }
  const kenhMoiSong = [];
  if (coWms && !truoc.wms) kenhMoiSong.push("WMS/planogram");            // mở được cả 4 bước factory
  else if (coPhien && !truoc.coPhien) kenhMoiSong.push("work/hr");       // chỉ mở bước 5S, vẫn đáng chạy ngay
  // Phiên chập chờn (sống–chết–sống) không được biến thành vé mỗi 2 phút.
  const duXaVeTruoc = Date.now() - Number(truoc.veLuc || 0) >= VE_UU_TIEN_MS;
  const veUuTien = !FORCE && kenhMoiSong.length > 0 && duXaVeTruoc;
  if (!THU) {
    try {
      fs.writeFileSync(PHIEN_TRUOC, JSON.stringify({
        wms: coWms, coPhien, luc: Date.now(),
        veLuc: veUuTien ? Date.now() : Number(truoc.veLuc || 0),
      }));
    } catch { /* mốc phiên best-effort */ }
  }

  if (!FORCE) {
    let lanTruoc = 0; try { lanTruoc = fs.statSync(LAN_VA).mtimeMs; } catch { /* chưa vá lần nào */ }
    const chuaDuBackoff = Date.now() - lanTruoc < VA_BACKOFF_MS;
    if (chuaDuBackoff && veUuTien) {
      log("⚡ Phiên " + kenhMoiSong.join(" + ") + " VỪA SỐNG LẠI — vé ưu tiên, làm tươi ngay bằng bridge (bỏ qua backoff "
        + Math.round((Date.now() - lanTruoc) / 60000) + "'/20', không đăng nhập mới).");
    } else if (chuaDuBackoff) {
      log("… Lượt vá trước mới chạy " + Math.round((Date.now() - lanTruoc) / 60000) + "' trước — chờ đủ backoff 20' rồi vá tiếp.");
      return DEFER_EXIT;
    }
  }

  if (!nguon) {
    /* Vá 12/08/2026: guard cũ chỉ hỏi ĐỒNG HỒ (duocPhepReLogin — chặn 07:00–22:30), trong khi tầng
     * dưới (chanReLoginNgoaiKhung) từ 30/07 đã chạy LUẬT PHIÊN: không phiên nào sống + đủ cửa im
     * lặng thì được login bất kể mấy giờ, vì không có ai để đá. Lệch 2 tầng ⇒ chiều 11/08 verdict
     * ghi rõ "bridge đã im 368' ≥ cửa 15' — ĐƯỢC login" mà guard vẫn hoãn. Nay hỏi đúng bộ đánh giá
     * đó; verdict "khongro" (mất mạng/GAS) vẫn KHÔNG được coi là cớ để login — giữ nguyên tinh thần cũ. */
    let v = null;
    if (kenhWshrDaChungThuc(DIR)) { try { v = await trangThaiPhien(DIR, log); } catch { v = null; } }
    if (v && v.ai === "khong" && v.duocLogin) nguon = "luật phiên: " + v.vi;
    else if (duocPhepReLogin(now)) nguon = "khung giờ an toàn (cho phép re-login SSO)";
    else {
      log("⛔ Không có token sống và " + (v ? "chưa được phép login (" + v.vi + ")" : "đang TRONG GIỜ LÀM VIỆC") + " — hoãn, không đá phiên ai. (Mẹo: mở WMS trên trình duyệt có extension wms-bridge là guard chạy được ngay.)");
      return DEFER_EXIT;
    }
  }
  if (THU) { log("🧪 --thu: DỪNG ở đây, không spawn cụm. (Nguồn sẽ dùng: " + nguon + ")"); return 0; }
  log("→ Nguồn: " + nguon + ". Chạy AUTO-EXPORT.bat (5S + cụm tồn kho)...");

  /* ---- 4) Chạy cụm rồi kết luận bằng Metadata + mốc từng bước ---- */
  try { fs.writeFileSync(LAN_VA, new Date().toISOString()); } catch { /* mốc backoff best-effort */ }
  const ma = await new Promise((res) => {
    // Lượt VÁ (không --force): SYNC_SKIP_FRESH=1 — bước đã tươi hôm nay tự thoát sớm trong script.
    const env = { ...process.env, SYNC_SKIP_FRESH: FORCE ? "" : "1" };
    /* 31/07/2026: gọi AUTO-EXPORT.bat thay cho SYNC-STOCK.bat — bat này chạy bước 5S rồi mới
       call SYNC-STOCK.bat, nên guard mới với tới được bước "5s". Không sợ chạy thừa: lượt VÁ đặt
       SYNC_SKIP_FRESH=1 nên bước nào đã tươi hôm nay cũng tự thoát ngay ở dòng đầu. */
    const c = spawn("cmd.exe", ["/c", path.join(DIR, "AUTO-EXPORT.bat")], { cwd: DIR, stdio: "ignore", windowsHide: true, env });
    c.on("exit", (code) => res(code == null ? -1 : code));
    c.on("error", () => res(-1));
  });
  const mocMoi = await docMocMeta();
  const mocMinMoi = Math.min(mocMoi || 0, ...CAC_BUOC_SYNC.map((b) => docMocBuoc(DIR, b)));
  /* VÁ 15/08/2026: kết luận phải đo bằng ĐÚNG cái thước đã dùng để gọi cụm. Bản cũ chỉ hỏi
   * "mốc ≥ 08:40 hôm nay" nên lượt vá vì TRỄ TRONG NGÀY luôn kết thúc bằng "✓ XONG" dù không bước
   * nào được kéo lại (chiều 14/08: gọi lúc 16:12 vì trễ 151', 29 giây sau in ✓ XONG, mốc vẫn 13:37).
   * Báo thành công giả còn nguy hơn im lặng: nó nuốt luôn lượt login hiếm hoi và reset backoff. */
  const sauKhiChay = Date.now();
  const conCu = () => CAC_BUOC_SYNC.filter((b) => {
    const t = docMocBuoc(DIR, b);
    return t < homNay840 || (trongGioCanh && sauKhiChay - t > NGUONG_TRE_MS);
  });
  const daDu = FORCE ? ((mocMoi || 0) > (moc || 0) || mocMinMoi > mocMin) : conCu().length === 0;
  if (daDu) {
    log("✓ XONG — Metadata " + fmtVN(mocMoi || 0) + ", mốc bước cũ nhất " + fmtVN(mocMinMoi) + " (bat exit " + ma + ").");
    return 0;
  }
  log("⚠ Cụm chạy xong (bat exit " + ma + ") nhưng còn CŨ: " + (conCu().join(", ") || buocCu().join(", ") || "Metadata") + " — nhiều khả năng bước bị hoãn (ngoài khung an toàn) hoặc lỗi; xem log từng bước. Guard sẽ thử lại tick sau.");
  return DEFER_EXIT;
}

/* ---- 5) TẦNG TỰ CHỮA (12/08/2026): mỗi tick guard là 1 nhịp tim + 1 lượt soát sức khoẻ ----
   Guard đã chạy sẵn mỗi giờ 7h-18h nên đây là chỗ rẻ nhất để đặt đồng hồ chết, khỏi thêm task.
   Chạy TÁCH TIẾN TRÌNH: bộ giám sát tuyệt đối không được làm hỏng mã thoát của guard
   (mã thoát 75 là tín hiệu "hoãn" mà cả hệ đang dựa vào). Treo quá 60s thì cắt, bỏ qua. */
async function soatSucKhoe() {
  await new Promise((res) => {
    let xong = false;
    const kt = () => { if (!xong) { xong = true; res(); } };
    const c = spawn(process.execPath, [path.join(DIR, "canh-suc-khoe.js")], { cwd: DIR, stdio: "inherit", windowsHide: true });
    const hen = setTimeout(() => { try { c.kill(); } catch { /* đã thoát */ } kt(); }, 60000);
    c.on("exit", () => { clearTimeout(hen); kt(); });
    c.on("error", () => { clearTimeout(hen); kt(); });
  });
}

(async () => {
  // Dùng process.exitCode (không process.exit) để socket keep-alive tự đóng, thoát sạch.
  if (!THU && !giuKhoa()) { log("Guard khác đang chạy (lock còn tươi) — thoát."); return; }   // không nhả lock của người khác
  let code = 2;
  try { code = await main(); }
  catch (e) { log("✗ " + (e && e.message ? e.message : e)); code = 2; }
  if (!THU) nhaKhoa();
  if (!THU) { try { await soatSucKhoe(); } catch { /* giám sát hỏng không được kéo theo guard */ } }
  process.exitCode = code;
})();
