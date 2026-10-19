// qc-may-tram.mjs — bộ đo tab «Máy trạm» bằng DỮ LIỆU GIẢ, 2 chế độ:
//   · quanly : máy quản lý — /api/may-tram (8591) trả 2 PC mẫu, có nút Dừng/Tiếp tục/Gỡ; bấm THẬT nút Dừng → kiểm thân lệnh.
//   · dienthoai: CHẶN HẲN 127.0.0.1:8591 (như điện thoại) — dữ liệu chỉ qua Apps Script action=pcBangTb (JSONP), KHÔNG được có nút.
// CHẶN MỌI POST ở tầng mạng (luật QC không ghi dữ liệu thật). Ảnh ở .qc-may-tram/.
//   node qc-may-tram.mjs [--url=http://localhost:8123/kiemsoatkho/]
import puppeteer from "puppeteer-core";   // puppeteer-core đã vá hồ sơ trống (bộ chuẩn mục 5)
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { phienQC } from "./xacminh-dang-nhap.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url)), RA = path.join(DIR, ".qc-may-tram");
const URL0 = (process.argv.find((a) => a.startsWith("--url=")) || "").slice(6) || "http://localhost:8123/kiemsoatkho/";
fs.mkdirSync(RA, { recursive: true });
const now = Date.now(), iso = (s) => new Date(now - s * 1000).toISOString();
const PC1 = { may: "PC-KHO-01", luc: iso(24), ramTrongPct: 38, cpuPct: 72, diaTrongGB: 8.4, yeu: true, diem: 420, nhan: 8, ramTongGB: 16, ban: "5be3da2",
  dangChay: ["canh-b11"], dungViec: ["canh-bai-xe-sang"], dung: false, viecGiao: ["canh-b11", "tim-bang-chung-b1", "co-canh-planogram"],
  tatCaViec: ["canh-b11", "canh-bai-xe-sang", "tim-bang-chung-b1", "co-canh-planogram"] };
const PC2 = { may: "PC-KHO-02", luc: iso(5400), ramTrongPct: 61, cpuPct: 4, diaTrongGB: 120, yeu: false, diem: 300, nhan: 4, ramTongGB: 8, ban: "13d633b",
  dangChay: [], dungViec: [], dung: false, viecGiao: [], tatCaViec: PC1.tatCaViec };
const API591 = { srvNow: now, hetHanPhut: 3,
  may: [{ ...PC1, song: true, tuoiGiay: 24, coKhoa: ["APPSCRIPT_KEY", "TOPREVIEW_USER"] }, { ...PC2, song: false, tuoiGiay: 5400, coKhoa: ["APPSCRIPT_KEY"] }],
  viec: [{ ten: "canh-b11", nang: true, may: "PC-KHO-01" }, { ten: "canh-bai-xe-sang", nang: true, may: null, canKhoa: ["TOPREVIEW_USER"] },
    { ten: "tim-bang-chung-b1", nang: true, may: "PC-KHO-01" }, { ten: "co-canh-planogram", nang: false, may: "PC-KHO-01" }],
  chuyen: [{ viec: "canh-bai-xe-sang", tu: "PC-KHO-01", luc: now - 30000, sanSang: true }],
  xin: [{ may: "PC-MOI-03", maXN: "7F3A", luc: now - 60000, daDuyet: false }],   // 14/10 PC xin khoá chờ duyệt
  bridge: [{ kind: "wshr", sub: "18811", email: "tamlc@hasaki.vn", at: now - 120000, tuoi: true, tamlc: true }, { kind: "wms", sub: "18811", email: "tamlc@hasaki.vn", at: now - 3600000, tuoi: false, tamlc: true },
    { kind: "wms", sub: "22222", email: "qc-nguoi-khac@hasaki.vn", ten: "Người Khác QC", may: "PC-KHO-01", td: "Chrome", at: now - 60000, tuoi: true, tamlc: false }] };   // 16/10 phiên bridge theo email
const GAS_TB = { status: "success", srvNow: now, may: [{ ...PC1, coCamera: true }, { ...PC2, coCamera: false }], chuyen: API591.chuyen, bridge: API591.bridge };
const CA = [{ ten: "quanly-pc", w: 1366, h: 900, mob: false, quanLy: true }, { ten: "quanly-ip14", w: 390, h: 844, mob: true, quanLy: true },
  { ten: "quanly-chua-dn", w: 1366, h: 900, mob: false, quanLy: true, chuaDN: true },
  { ten: "dienthoai-ip14", w: 390, h: 844, mob: true, quanLy: false }, { ten: "dienthoai-and360", w: 360, h: 740, mob: true, quanLy: false }];
const MK_DUNG = "mat-khau-qc-dung";
// 14/10 trưa: trang có HỆ TÀI KHOẢN (tai-khoan.js) — đăng nhập 1 lần ở đó là xem được Máy trạm. Giả lập tk_* (không chạm máy chủ thật).
const QTAT = Object.fromEntries(["r.tong", "r.task", "r.hangmuc", "r.planogram", "r.htonbat", "r.kk", "r.xacminh"].map((k) => [k, "lam"]));
const TKN = { id: "tamlc", ten: "Lê Tâm", vaiTro: "quantri", quyen: QTAT }, TKPH = "c".repeat(64);
const KHACH = { ...QTAT, "r.xacminh": "khong" };   // giả: GAS mock chỉ nhận chuỗi này
// 14/10 ca THẬT user chụp: chỉ có laptop, đang Dừng (bộ cài), 13 việc chưa có máy → trước đây 13 dòng lặp + câu sai «đã chuyển sang máy khác»
const TEN13 = ["canh-b11", "canh-xac-minh-b1", "tim-bang-chung-b1", "canh-bai-xe-sang", "canh-bai-xe-chieu", "canh-bai-xe-toi", "xac-minh-camera", "co-canh-planogram", "dong-bo-dashboard", "packer-a8-sang", "packer-a8-chieu", "cham-cong", "watchdog-ton-kho"];
const API_LAPTOP = { srvNow: now, hetHanPhut: 3,
  may: [{ may: "HSK-KHO170-tamlc-1", luc: iso(22), song: true, tuoiGiay: 22, ramTrongPct: 40, cpuPct: 8, diaTrongGB: 65.7, nhan: 16, ramTongGB: 15.4, diem: 335, ban: "70c4915", dung: true, lenhBoi: "bo cai (may quan ly)",
    dungViec: [], dangChay: [], viecGiao: [], coKhoa: ["APPSCRIPT_URL", "APPSCRIPT_KEY", "TOPREVIEW_USER", "TOPREVIEW_PASS", "GEMINI_API_KEY"] }],
  viec: TEN13.map((t, i) => ({ ten: t, may: null, nang: i < 7, canKhoa: i < 7 ? ["APPSCRIPT_URL", "APPSCRIPT_KEY", "TOPREVIEW_USER", "TOPREVIEW_PASS"].concat(i === 1 || i === 6 ? ["GEMINI_API_KEY"] : []) : ["APPSCRIPT_URL", "APPSCRIPT_KEY"] })), chuyen: [] };
// 14/10 «chip máy gọn, không tràn»: ca thật sắp tới — 1 PC chạy cả 13 việc + laptop đang dừng
const API_PC13 = { srvNow: now, hetHanPhut: 3, chuyen: [], xin: [],
  may: [{ may: "HSK-KHO170-QLIT", luc: iso(15), song: true, tuoiGiay: 15, ramTrongPct: 45, cpuPct: 30, diaTrongGB: 120, nhan: 16, ramTongGB: 16, diem: 340, ban: "9360a35", dung: false,
      dungViec: ["cham-cong"], dangChay: ["canh-b11", "co-canh-planogram"], viecGiao: TEN13.filter((t) => t !== "cham-cong"), coKhoa: ["APPSCRIPT_KEY", "TOPREVIEW_USER", "GEMINI_API_KEY"],
      oDia: [{ o: "C", trong: 12.4, tong: 237.9 }, { o: "D", trong: 812.5, tong: 931.5 }], viecNang: TEN13.slice(0, 7), tatCaViec: TEN13, chayLuc: { "canh-b11": iso(900), "co-canh-planogram": iso(120) }, tienDo: { "canh-b11": { buoc: "Soát phiếu 5S (B1.1 · B3 · vệ sinh)", task: "14180438", i: 40, n: 120, chiTiet: "", luc: iso(8) } } },   // 14/10 nhiều ổ + nhãn nặng/nhẹ
    { ...API_LAPTOP.may[0] }],
  viec: TEN13.map((t, i) => ({ ten: t, nang: i < 7, may: t === "cham-cong" ? null : "HSK-KHO170-QLIT", canKhoa: [] })) };
CA.push({ ten: "pc13-1920", w: 1920, h: 1080, mob: false, quanLy: true, data2: API_PC13 }, { ten: "pc13-414", w: 414, h: 896, mob: true, quanLy: true, data2: API_PC13 });   // 19/10 thêm 1920 + 414
CA.push({ ten: "pc13-pc", w: 1366, h: 900, mob: false, quanLy: true, data2: API_PC13 }, { ten: "pc13-ip14", w: 390, h: 844, mob: true, quanLy: true, data2: API_PC13 }, { ten: "pc13-and360", w: 360, h: 740, mob: true, quanLy: true, data2: API_PC13 });
CA.push({ ten: "chi-laptop-dung", w: 1366, h: 900, mob: false, quanLy: true, data: API_LAPTOP }, { ten: "chi-laptop-dung-ip14", w: 390, h: 844, mob: true, quanLy: true, data: API_LAPTOP }, { ten: "chi-laptop-dung-and360", w: 360, h: 740, mob: true, quanLy: true, data: API_LAPTOP });
// 14/10 «đang chạy công việc gì cũng cần hiển thị»: laptop DỰ PHÒNG đang làm thay Cò xác minh B1 (GAS PCPHU gộp duPhong/dangChay/batDau)
// 15/10 ca THẬT của user: còn máy sống → việc chưa nhận chia 3 LÝ DO (khoá camera / khoá camera+AI / cần PC) — Nặng trái, Nhẹ phải cùng hàng
const API_3LY = { ...API_LAPTOP, may: [{ ...API_LAPTOP.may[0], dung: false, lenhBoi: "" }] };
CA.push({ ten: "ba-ly-do", w: 1366, h: 900, mob: false, quanLy: true, data: API_3LY }, { ten: "ba-ly-do-ip14", w: 390, h: 844, mob: true, quanLy: true, data: API_3LY });
const API_DUPHONG = { ...API_PC13, may: [{ ...API_PC13.may[0], dangChay: [], dungViec: [], chayLuc: { "co-canh-planogram": iso(300) }, taskDP: ["5S DP canh-b11|Ready|30/11 00:00|267011|14/10 22:35", "5S DP canh-xac-minh-b1|Ready|30/11 00:00|267011|15/10 07:50", "5S DP tim-bang-chung-b1|Ready|30/11 00:00|267011|15/10 08:30", "5S DP xac-minh-camera|Ready|30/11 00:00|267011|15/10 19:30", "Audit nhip tim PC|Ready|14/10 21:51|0|14/10 21:52"] },   // 14/10 QLIT thật: chỉ 4/13 task
  { ...API_LAPTOP.may[0], duPhong: true, dangChay: ["canh-xac-minh-b1"], batDau: { "canh-xac-minh-b1": iso(12 * 60) }, chayLuc: { "canh-xac-minh-b1": iso(12 * 60) }, tienDo: { "canh-xac-minh-b1": { buoc: "Soát phiếu B1 theo luật", task: "14180441", i: 23, n: 83, chiTiet: "", luc: iso(9) } } }] };
const GHIM4 = ["canh-b11", "canh-xac-minh-b1", "tim-bang-chung-b1", "xac-minh-camera"];   // 14/10 ghim laptop (cần .exports)
API_DUPHONG.viec = API_PC13.viec.map((v) => GHIM4.includes(v.ten) ? { ...v, may: null, chiLaptop: true } : v);
CA.push({ ten: "duphong-pc", w: 1366, h: 900, mob: false, quanLy: true, data: API_DUPHONG, duPhong: true }, { ten: "duphong-and360", w: 360, h: 740, mob: true, quanLy: true, data: API_DUPHONG, duPhong: true });
let loi = 0; const ok = (dk, ten) => { console.log((dk ? "  OK   " : "  FAIL ") + ten); if (!dk) loi++; };
const cors = (r) => ({ "Access-Control-Allow-Origin": r.headers().origin || "*", "Access-Control-Allow-Headers": "content-type,x-hx-phien" });

const b = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: "new" });
try {
  // máy chủ 8591 đệm sổ phiên 5 s (kiemPhien) → phiên QC mới tạo phải chờ >5 s mới được nhận
  const PHIEN = phienQC(); await new Promise((r) => setTimeout(r, 6000));
  for (const m of CA) {
    console.log("== " + m.ten);
    const p = await b.newPage(); const post = []; let goiBang = 0, goiDN = 0;
    const hoi = []; p.on("dialog", (d) => { hoi.push(d.message()); d.accept(); }); p.on("pageerror", (e) => console.log("  PAGEERR " + e.message.slice(0, 200)));
    await p.evaluateOnNewDocument((hx, coPhien, tkn, tkph, laptop) => { try { localStorage.removeItem("mt-phien"); localStorage.removeItem("hx-email");
      if (coPhien) { localStorage.setItem("hx-phien", hx); localStorage.setItem("tk-phien", tkph); localStorage.setItem("tk-nho", JSON.stringify({ ts: Date.now(), nguoi: tkn, quyen: tkn.quyen })); }
      else { if (laptop) localStorage.setItem("hx-phien", hx); else localStorage.removeItem("hx-phien"); localStorage.removeItem("tk-phien"); localStorage.removeItem("tk-nho"); } } catch (e) {} }, PHIEN, m.quanLy && !m.chuaDN, TKN, TKPH, !!m.quanLy);   // laptop chưa đăng nhập: CỐ Ý sót hx-phien cũ; điện thoại không bao giờ có   // chưa đăng nhập: CỐ Ý để sót hx-phien cũ (ca thật trên laptop)
    await p.setViewport({ width: m.w, height: m.h, deviceScaleFactor: 1, isMobile: m.mob, hasTouch: m.mob });
    // 17/10: điện thoại THẬT không có «Windows NT» trong UA (trang dựa vào đó để biết máy không có máy chủ Xác minh) — giả đúng UA
    if (!m.quanLy && m.mob) await p.setUserAgent("Mozilla/5.0 (Linux; Android 14; Xiaomi 17 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36");
    await p.setRequestInterception(true);
    p.on("request", (r) => {
      const u = r.url();
      if (!m.quanLy && /127\.0\.0\.1:8591/.test(u)) return r.abort();   // điện thoại: không có máy chủ 8591
      if (r.method() === "POST" && (/\/api\/tk-thu/.test(u) || /"action":"tk_/.test(r.postData() || ""))) {   // hệ tài khoản giả
        const o = JSON.parse(r.postData() || "{}"), tra = (x) => r.respond({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(x) });
        if (o.action === "tk_khach") return tra({ status: "success", quyen: KHACH });
        if (o.action === "tk_toi") return tra(o.phien === TKPH ? { status: "success", nguoi: TKN } : { status: "error", code: 401, message: "Phiên hết" });
        if (o.action === "tk_dangnhap") { goiDN++; return tra(o.mk === MK_DUNG ? { status: "success", phien: TKPH, nguoi: TKN } : { status: "error", code: 401, message: "Sai tài khoản hoặc mật khẩu" }); }
        return tra({ status: "success" });
      }
      if (r.method() === "POST" && /script\.google\.com/.test(u)) {   // GAS giả — KHÔNG tới máy chủ thật
        const o = JSON.parse(r.postData() || "{}"), tra = (x) => r.respond({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(x) });
        if (o.action === "pcDangNhap") { goiDN++; return tra(o.mk === MK_DUNG ? { status: "success", ph: "a".repeat(64), het: Date.now() + 36e5, email: o.email } : { status: "error", code: 401, message: "Sai email hoặc mật khẩu" }); }
        if (o.action === "pcBangPh") { goiBang++; return tra(o.ph === TKPH ? GAS_TB : { status: "error", code: 401, message: "Phiên đăng nhập đã hết" }); }
        if (o.action === "pcDangXuat") return tra({ status: "success" });
        if (o.action === "pcLenhPh") { post.push({ url: "gas:pcLenhPh", body: r.postData() }); return tra(o.ph === TKPH ? { status: "success", lenh: { dung: !!o.dung }, daChuyen: [] } : { status: "error", code: 403, message: "chưa có quyền" }); }   // 14/10 lệnh qua GAS
      }
      if (r.method() === "POST" && !/\/api\/dang-nhap$/.test(u)) { post.push({ url: u, body: r.postData() }); return r.respond({ status: 200, contentType: "application/json", headers: cors(r), body: JSON.stringify({ ok: 1, daChuyen: [] }) }); }
      if (/\/api\/may-tram$/.test(u)) return r.respond({ status: 200, contentType: "application/json", headers: cors(r), body: JSON.stringify(m.data || m.data2 || API591) });
      r.continue();
    });
    await p.goto(URL0 + "?tab=maytram", { waitUntil: "domcontentloaded", timeout: 60000 });
    /* 17/10 user «1 máy sao có 2 phiên Tâm và Hải» + «có Theo máy rồi thì khối Phiên bridge làm gì»: bỏ khối riêng; phiên ghi đúng thẻ máy —
       phiên kèm tên máy → máy đó; phiên không tên máy (laptop) → CHỈ thẻ máy dự phòng đang dừng (laptop), không lan sang PC có cờ duPhong. */
    const kiemBridge = async () => { const t = await p.evaluate(() => {
      const the = [...document.querySelectorAll("#pane-maytram .mt-o")].map((o) => ({ may: o.querySelector(".mt-dau b").textContent, duPhong: /Dự phòng/.test((o.querySelector(".mt-the") || {}).textContent || ""),
        ph: [...o.querySelectorAll(".mt-ph")].map((x) => ({ t: x.textContent, title: x.title, cao: x.getBoundingClientRect().height, tran: x.firstElementChild.scrollWidth > x.firstElementChild.clientWidth + 1 })) }));
      return { khoi: [...document.querySelectorAll("#pane-maytram .panel")].some((x) => /Phiên bridge/.test(x.textContent)), the }; });
      const khac = t.the.filter((o) => o.ph.some((x) => /qc-nguoi-khac/.test(x.title))), tam = t.the.filter((o) => o.ph.some((x) => /tamlc/.test(x.title))), moi = t.the.flatMap((o) => o.ph);
      const coPC1 = t.the.some((o) => o.may === "PC-KHO-01");   // chỉ bộ API591/GAS_TB có phiên «người khác» trên PC-KHO-01
      ok(!t.khoi && (coPC1 ? khac.length === 1 && khac[0].may === "PC-KHO-01" && khac[0].ph.some((x) => /Chỉ đọc$/.test(x.t)) : !khac.length) && tam.every((o) => o.duPhong) && tam.length <= 1 && moi.every((x) => x.cao <= 30 && !/trước trước/.test(x.t))
        && !moi.some((x) => /\(hết\)/.test(x.t)),
        "phiên bridge: không còn khối riêng · phiên ghi đúng thẻ máy (người khác → PC-KHO-01; tamlc chỉ ở laptop dự phòng) · 1 dòng/phiên + nhãn Ghi/Chỉ đọc (" + JSON.stringify(t.the.map((o) => o.may + ":" + o.ph.length)) + ")"); };
    const nhom = () => p.evaluate(() => { const g = [...document.querySelectorAll("#sideNav .s-grp")].find((x) => x.textContent.trim() === "Xác minh"); const sub = g && g.nextElementSibling;
      return sub ? [...sub.querySelectorAll(".s-item")].map((x) => x.textContent.trim().replace(/\d.*$/, "")) : []; });
    if (m.chuaDN) {   // máy quản lý CHƯA đăng nhập hệ tài khoản (dù còn sót phiên Xác minh cũ hx-phien)
      await p.waitForSelector("#mtMoTk, #pane-maytram .xm-khoa-nut", { timeout: 30000 });
      ok(!(await p.$("#pane-maytram .mt-o")), "chưa đăng nhập: KHÔNG thấy dữ liệu, chỉ nút Đăng nhập (hệ tài khoản)");
      await new Promise((r) => setTimeout(r, 1500));
      const nb0 = await nhom(), mot0 = await p.evaluate(() => !!document.querySelector('#sideNav .s-grp.s-khoa'));   // 15/10: chưa đăng nhập = tiêu đề nhóm «Xác minh» + khoá
      ok(!nb0.length && mot0, "chưa đăng nhập: thanh bên chỉ 1 nút «Xác minh», KHÔNG có mục con (" + nb0.join(" | ") + ")");
      await p.screenshot({ path: path.join(RA, m.ten + ".png") }); await p.close(); continue;
    }
    if (!m.quanLy) {   // điện thoại: chưa đăng nhập → nút Đăng nhập (hệ tài khoản); sai → vẫn khoá; đúng 1 lần → thấy Máy trạm
      await p.waitForSelector("#mtMoTk, #pane-maytram .xm-khoa-nut", { timeout: 30000 });
      ok(!(await p.$("#pane-maytram .mt-o")) && goiBang === 0, "điện thoại chưa đăng nhập: KHÔNG thấy/không tải dữ liệu");
      ok(!(await nhom()).length, "điện thoại chưa đăng nhập: thanh bên không có mục con Xác minh");
      await p.screenshot({ path: path.join(RA, m.ten + "-dangnhap.png") });
      const sai = await p.evaluate((mk) => window.tkDangNhap("tamlc", mk).then(() => "ok", (e) => "loi:" + e.message), "sai-mat-khau");
      await new Promise((r) => setTimeout(r, 800));
      ok(/^loi/.test(sai) && !(await p.$("#pane-maytram .mt-o")), "sai mật khẩu → vẫn khoá (" + sai + ")");
      /* 17/10 user «đăng nhập ở pop-up xong lại chuyển sang màn hình đăng nhập (lặp)»: đi ĐÚNG đường người dùng — đứng ở Tổng quan, bấm nhóm
         «Xác minh» có khoá ở thanh bên → ô đăng nhập → gõ đúng → phải sang Máy trạm, KHÔNG rơi vào ô «Đăng nhập phần Xác minh» của tab xacminh. */
      await p.evaluate(() => { setTab("home"); document.querySelector("#sideNav .s-grp.s-khoa").click(); });
      await p.waitForSelector(".tk-f", { timeout: 10000 });
      await p.evaluate((mk) => { const f = document.querySelector(".tk-f"); f.id.value = "tamlc"; f.mk.value = mk; f.requestSubmit(); }, MK_DUNG);
      await p.waitForFunction(() => (document.querySelector(".tab.active") || {}).dataset?.tab === "maytram" && document.querySelectorAll("#pane-maytram .mt-o").length > 0, { timeout: 30000 }).catch(() => {});
      const sauDN = await p.evaluate(() => ({ tab: (document.querySelector(".tab.active") || {}).dataset?.tab, dnXm: [...document.querySelectorAll(".hx-dn, .xm-khoa, #mtMoTk")].some((x) => x.offsetParent), hop: !!document.querySelector(".tk-f"), url: location.href }));
      ok(sauDN.tab === "maytram" && /maytram/.test(sauDN.url) && !sauDN.dnXm && !sauDN.hop, "điện thoại: đăng nhập ở hộp thanh bên → sang Máy trạm, KHÔNG hiện lại màn đăng nhập (" + JSON.stringify(sauDN) + ")");
      await p.evaluate(() => setTab("xacminh")); await new Promise((r) => setTimeout(r, 400));
      const vaoXm = await p.evaluate(() => ({ tab: (document.querySelector(".tab.active") || {}).dataset?.tab, dnXm: !!document.querySelector("#pane-xacminh .hx-dn") }));
      ok(vaoXm.tab === "maytram" && !vaoXm.dnXm, "điện thoại: mở tab xacminh (đường dẫn/tab nhớ) → tự về Máy trạm, không ô đăng nhập riêng (" + JSON.stringify(vaoXm) + ")");
    }
    await p.waitForFunction(() => document.querySelectorAll("#pane-maytram .mt-o").length > 0, { timeout: 60000 });
    await new Promise((r) => setTimeout(r, 800));
    // 14/10 chiều bố cục DỌC: «Việc chưa có máy nhận» TRÊN CÙNG; mỗi máy 1 hàng, xếp từ trên xuống, rộng đều, vừa bề ngang
    const bc = await p.evaluate(() => { const pn = document.querySelector("#pane-maytram"), the = [...pn.querySelectorAll(".mt-hang > .mt-o")], ch = pn.querySelector(".mt-chua"), hg = pn.querySelector(".mt-hang");
      const r = the.map((x) => x.getBoundingClientRect()), pr = pn.getBoundingClientRect();
      return { so: the.length, doc: r.every((x, i) => !i || x.top >= r[i - 1].bottom - 1), deuNhau: r.every((x) => Math.abs(x.width - r[0].width) < 2), vua: r.every((x) => x.right <= pr.right + 1),
        chuaTruoc: !!(ch && hg && (ch.compareDocumentPosition(hg) & Node.DOCUMENT_POSITION_FOLLOWING)), ngang: document.documentElement.scrollWidth - innerWidth,
        chu: the.map((t) => t.innerText.replace(/\s+/g, " ")), tipPhu: the.map((t) => (t.querySelector(".mt-dau b") || {}).title || ""),
        chip: the.map((t) => [...t.querySelectorAll(".mt-c")].map((c) => c.className.replace("mt-c ", "") + ":" + c.textContent)),
        nut: [...pn.querySelectorAll("button[data-may]")].filter((n) => n.getBoundingClientRect().height).map((n) => ({ t: n.textContent, h: Math.round(n.getBoundingClientRect().height) })) }; });
    ok(bc.chuaTruoc, "«Việc chưa có máy nhận» nằm TRÊN hàng máy trạm");
    ok(bc.doc && bc.deuNhau && bc.vua, "máy trạm xếp DỌC từ trên xuống, rộng đều, vừa bề ngang (" + bc.so + " máy)");
    ok(bc.ngang <= 0, "không kéo ngang trang (" + bc.ngang + ")");
    // 14/10 chiều: «Đang chạy» nằm TRONG TỪNG THẺ MÁY (không còn khối chung) — việc · bước · phiếu (link) · i/n · từ giờ · cập nhật
    const dcMay = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll("#pane-maytram .mt-o")].map((o) => [o.querySelector(".mt-dau b").textContent,
      [...o.querySelectorAll(".mt-ket .mt-dc")].map((d) => ({ t: d.innerText.replace(/\s+/g, " ").trim(), link: (d.querySelector(".mt-dc-bc a") || {}).href || "",
        thanh: d.querySelector(".mt-dc-thanh b") ? parseFloat(d.querySelector(".mt-dc-thanh b").style.width) : -1, dauPhai: d.parentElement.querySelector(".mt-dc,.mt-hn") === d }))])));
    // 15/10 user «chia 3 mục ngang hàng: Thông tin máy, sức khoẻ / Việc đảm nhận / Việc đang làm và kết quả — canh đồng đều»
    const c3 = await p.evaluate(() => { const the = [...document.querySelectorAll("#pane-maytram .mt-o")], td = document.querySelector("#pane-maytram .mt-tde");
      const cot = the.map((o) => [".mt-trai", ".mt-phai", ".mt-ket"].map((s) => { const e = o.querySelector(":scope > " + s); return e ? e.getBoundingClientRect() : null; }));
      const tdHien = td && td.offsetParent !== null, tdL = tdHien ? [...td.children].map((s) => s.getBoundingClientRect().left + parseFloat(getComputedStyle(s).paddingLeft)) : [];
      return { du: cot.every((c) => c.every(Boolean)), moc: cot.map((c) => c.map((r) => Math.round(r ? r.left : -1))), tdHien, tdL: tdL.map(Math.round),
        nhan: tdHien ? [...td.children].map((s) => s.textContent) : [...(the[0] || document).querySelectorAll(".mt-ct")].map((s) => s.classList.contains("mt-xo") ? s.firstElementChild.textContent : s.textContent),   // 17/10 nút xổ: nhãn = ô đầu
        ngang: cot.every((c) => c[1] && Math.abs(c[1].top - c[0].top) < 2 && Math.abs(c[2].top - c[0].top) < 2) }; });
    ok(c3.du, "mỗi máy đủ 3 mục (thông tin · việc đảm nhận · đang làm/kết quả)");
    if (!m.mob) {
      const thang = c3.moc.every((r) => r.every((x, i) => Math.abs(x - c3.moc[0][i]) <= 1));
      const trungTieuDe = c3.moc[0].slice(1).every((x, i) => Math.abs(x + 14 - c3.tdL[i + 1]) <= 2);
      ok(c3.ngang && thang && c3.tdHien && trungTieuDe && c3.nhan.join("|") === "Thông tin máy · sức khoẻ|Việc đảm nhận|Việc đang làm và kết quả",
        "3 mục NGANG HÀNG, thẳng cột giữa các máy và khớp hàng tiêu đề (" + JSON.stringify({ moc: c3.moc, tdL: c3.tdL }) + ")");
    } else ok(!c3.tdHien && c3.nhan.join("|") === "Việc đảm nhận|Việc đang làm và kết quả", "điện thoại: 3 mục xếp dọc, nhãn mục nằm ngay trong thẻ (" + c3.nhan.join("|") + ")");
    /* 17/10 điện thoại → 19/10 user «chip việc nặng/nhẹ to cả web/điện thoại — làm cách khác»: MỌI cỡ màn mặc định 1 dòng «Nặng N · Nhẹ M ▾»
       X1 nút tóm tắt (số KHỚP số chip, chi tiết ẩn; cao ≥40px điện thoại / ≤36px máy tính) · X2 bấm → bảng chip NỔI (popIn, ✕), KHUNG MÁY KHÔNG ĐỔI CAO,
       chỉ 1 bảng mở 1 lúc · X3 vẽ lại vẫn giữ mở · X5 ✕ / bấm ra ngoài đóng. Các ca sau mở bảng của máy cần đo bằng moViec(). */
    const xo0 = await p.evaluate(() => [...document.querySelectorAll("#pane-maytram .mt-phai")].map((o) => { const n = o.querySelector(":scope > .mt-xo"), ct = o.querySelector(":scope > .mt-xo-ct");
      const chip = [...o.querySelectorAll(".mt-c")], nang = chip.filter((c) => c.closest(".mt-nhom") && c.closest(".mt-nhom").querySelector(".mt-nh.nang")).length;
      return { co: !!n, hien: !!(n && n.getBoundingClientRect().height), so: n ? n.querySelector(".so").textContent : "", mong: [[nang, "Nặng"], [chip.length - nang, "Nhẹ"]].filter((x) => x[0]).map((x) => x[1] + " " + x[0]).join(" · "),
        an: ct ? getComputedStyle(ct).display === "none" : null, chip: chip.length, cao: n ? Math.round(n.getBoundingClientRect().height) : 0 }; }).filter((x) => x.co));
    if (!xo0.length) console.log("  ·    ca này không máy nào có việc đảm nhận — không có nút xổ để đo");
    else {
      ok(xo0.every((x) => x.hien && x.an && x.so === x.mong && (m.mob ? x.cao >= 40 : x.cao <= 36)), "X1 " + (m.mob ? "điện thoại" : "máy tính") + ": mặc định 1 dòng số việc Nặng/Nhẹ, ẩn chip (" + xo0.map((x) => x.so + (x.an ? "" : " LỘ") + "/" + x.mong + " " + x.cao + "px").join(" | ") + ")");
      const n1 = await p.$$("#pane-maytram .mt-xo"); const xo1 = [];
      for (const n of n1) {
        const truoc = await p.evaluate(() => [...document.querySelectorAll("#pane-maytram .mt-hang > .mt-o")].map((o) => Math.round(o.getBoundingClientRect().height)));
        await n.click(); await new Promise((r) => setTimeout(r, 260));
        xo1.push(await p.evaluate((n, truoc) => { const o = n.closest(".mt-phai"), ct = o.querySelector(".mt-xo-ct"), mu = n.querySelector(".mt-xo-mui"), r = ct.getBoundingClientRect(), dong = ct.querySelector(".mt-xo-dong");
          const sau = [...document.querySelectorAll("#pane-maytram .mt-hang > .mt-o")].map((o) => Math.round(o.getBoundingClientRect().height));
          return { mo: o.classList.contains("mo") && n.getAttribute("aria-expanded") === "true", hien: getComputedStyle(ct).display !== "none" && r.height > 0, noi: getComputedStyle(ct).position === "absolute",
            anim: getComputedStyle(ct).animationName, xoay: getComputedStyle(mu).transform !== "none", khongDoiCao: truoc.join() === sau.join(), vua: r.left >= 0 && r.right <= innerWidth + 1,
            mot: document.querySelectorAll("#pane-maytram .mt-phai.mo").length === 1, duoiNut: r.top >= n.getBoundingClientRect().bottom - 1, x: dong ? Math.round(Math.min(dong.getBoundingClientRect().width, dong.getBoundingClientRect().height)) : 0 }; }, n, truoc));
      }
      ok(xo1.every((x) => x.mo && x.hien && x.noi && x.anim === "popIn" && x.xoay && x.mot && x.vua), "X2 bấm → bảng chip NỔI (popIn), mũi tên xoay, 1 bảng mở 1 lúc, vừa màn " + JSON.stringify(xo1[0] || {}));
      ok(xo1.every((x) => x.khongDoiCao), "X2 mở bảng việc KHÔNG làm khung máy đổi cao");
      ok(xo1.every((x) => x.duoiNut), "X2 bảng nổi mở XUỐNG ngay dưới nút, không đè lên nút");
      ok(xo1.every((x) => m.mob ? x.x >= 44 : x.x >= 24), "X2 bảng có nút ✕ (" + (m.mob ? "≥44px" : "≥24px") + ": " + xo1.map((x) => x.x).join(",") + ")");
      await p.evaluate(() => { const e = document.querySelector("#pane-maytram .mt-phai.mo"); e.dataset.cu = "1"; window.HMAYTRAM.veLai(); return true; }); await new Promise((r) => setTimeout(r, 300));
      const xo2 = await p.evaluate(() => !document.querySelector("#pane-maytram .mt-phai[data-cu]") && document.querySelectorAll("#pane-maytram .mt-phai.mo").length === 1);
      ok(xo2, "X3 đã mở thì vẽ lại vẫn giữ mở");
      await p.click("#pane-maytram .mt-phai.mo .mt-xo-dong"); await new Promise((r) => setTimeout(r, 150));
      const d1 = await p.evaluate(() => document.querySelectorAll("#pane-maytram .mt-phai.mo").length);
      await (await p.$("#pane-maytram .mt-xo")).click(); await new Promise((r) => setTimeout(r, 150));
      await p.mouse.click(m.w - 5, m.h - 5); await new Promise((r) => setTimeout(r, 150));
      const d2 = await p.evaluate(() => document.querySelectorAll("#pane-maytram .mt-phai.mo").length);
      ok(d1 === 0 && d2 === 0, "X5 ✕ đóng bảng · bấm ra ngoài đóng bảng (" + d1 + "," + d2 + ")");
    }
    /* 19/10 user «nhìn vào là biết khung nào ở máy nào»: K1 mỗi máy 1 khung — thanh tên máy ngang trọn đầu khung, chữ ≥15px, vạch màu trái ≥4px,
       máy tính: mọi khung CAO BẰNG NHAU; điện thoại: khung cao theo nội dung (khung xếp dọc, bằng ngang nhau); khung cách nhau ≥10px */
    const k1 = await p.evaluate(() => { const the = [...document.querySelectorAll("#pane-maytram .mt-hang > .mt-o")];
      return the.map((o) => { const r = o.getBoundingClientRect(), t = o.querySelector(":scope > .mt-tieu"), rt = t ? t.getBoundingClientRect() : null, cs = getComputedStyle(o);
        return { h: Math.round(r.height), top: r.top, bot: r.bottom, tieu: !!t && rt.top - r.top <= 2 && rt.width >= r.width - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth) - 1,
          co: t ? parseFloat(getComputedStyle(t.querySelector("b")).fontSize) : 0, vach: parseFloat(cs.borderLeftWidth), dbg: rt ? [Math.round(rt.top - r.top), Math.round(rt.width), Math.round(r.width)].join(":") : "" }; }); });
    ok(k1.every((x) => x.tieu && x.co >= 15 && x.vach >= 4), "K1 mỗi máy 1 khung: thanh tên máy trọn đầu khung, chữ ≥15px, vạch màu trái ≥4px (" + k1.map((x) => x.co + "px/" + x.vach + "/" + x.tieu + "/" + x.dbg).join(",") + ")");
    ok((m.mob || k1.every((x) => Math.abs(x.h - k1[0].h) <= 1)) && k1.every((x, i) => !i || x.top - k1[i - 1].bot >= 10), "K1 " + (m.mob ? "điện thoại: khung tách nhau" : "máy tính: các khung CAO BẰNG NHAU") + ", cách nhau ≥10px (" + k1.map((x) => x.h).join(",") + ")");
    ok(!(await p.$("#pane-maytram .mt-dang")), "không còn khối «Đang chạy» chung (tránh lặp)");
    if (m.duPhong) {   // laptop dự phòng đang làm thay
      const d = (dcMay["HSK-KHO170-tamlc-1"] || [])[0];
      ok(d && /^Cò xác minh B1 làm thay Soát phiếu B1 theo luật · phiếu 14180441 \(23\/83\)/.test(d.t) && /từ \d\d:\d\d · 1\d phút · cập nhật \d+ (giây|phút) trước/.test(d.t)
        && /tasks\?task_id=14180441$/.test(d.link) && Math.abs(d.thanh - 28) <= 1 && d.dauPhai, "thẻ laptop: đang chạy việc gì · bước · phiếu (link work) · 23/83 · từ giờ · cập nhật (" + (d ? d.t : "không có") + ")");
      const lt = await p.evaluate(() => { const t = [...document.querySelectorAll("#pane-maytram .mt-o")].find((e) => /tamlc/.test(e.querySelector(".mt-dau b").textContent));
        return { tag: t.querySelector(".mt-the").textContent, mo: t.classList.contains("mo"), chip: [...t.querySelectorAll(".mt-c")].map((c) => c.className + ":" + c.textContent) }; });
      ok(/Dự phòng$/.test(lt.tag) && !lt.mo && lt.chip.length === 4 && lt.chip.some((c) => /chay:Cò xác minh B1/.test(c)) && lt.chip.filter((c) => /mt-c cho:/.test(c)).length === 3, "thẻ laptop: «Dự phòng», SÁNG khi đang làm thay, 4 việc ghim laptop: 1 chạy (xanh) + 3 chờ (" + lt.tag + " · " + lt.chip.join(",") + ")");
      ok(await p.evaluate(() => !/Cò canh B1.1|Cò xác minh B1|Tìm bằng chứng B1|Xác minh camera tối/.test((document.querySelector("#pane-maytram .mt-chua") || {}).innerText || "")), "việc ghim laptop KHÔNG nằm trong «Việc chưa có máy nhận»");
      { const tt = await p.evaluate(() => [...document.querySelectorAll("#pane-maytram .mt-o")].map((o) => o.querySelector(".mt-dau b").textContent + ":" + (o.querySelector(".mt-dc") ? "Đang làm việc" : "-")));
        ok(/Đang làm việc$/.test(tt[0]) && tt.slice(1).every((x) => !/Đang làm việc$/.test(x)), "máy ĐANG LÀM VIỆC (kể cả laptop Dừng làm thay) xếp trên máy rảnh (" + tt.join(" → ") + ")"); }
      ok((dcMay["HSK-KHO170-QLIT"] || []).length === 0, "QLIT không chạy gì → thẻ không có khối Đang chạy");
      // 14/10 user «sao thấy cả 4 đều đứng im»: máy bật mà không việc nào đang chạy → «Rảnh» + «Hôm nay đã làm N việc · gần nhất …»
      const hn = await p.evaluate(() => { const t = [...document.querySelectorAll("#pane-maytram .mt-o")].find((e) => /QLIT/.test(e.querySelector(".mt-dau b").textContent));
        return { tag: t.querySelector(".mt-the").textContent, hn: (t.querySelector(".mt-hn") || {}).textContent || "" }; });
      const dgQ = await p.evaluate(() => { const t = [...document.querySelectorAll("#pane-maytram .mt-o")].find((e) => /QLIT/.test(e.querySelector(".mt-dau b").textContent)); return t.querySelector(".mt-the").textContent + "|" + ((t.querySelector(".mt-ly") || {}).textContent || ""); });
      ok(/^Sức khoẻ kém\|thiếu 9\/13 task việc/.test(dgQ), "máy thiếu task (QLIT thật 14/10: 4/13) → Sức khoẻ Kém · thiếu 9/13 task việc (" + dgQ + ")");
      ok(!/Rảnh/.test(hn.tag) && /^Hôm nay đã làm 1 việc · gần nhất: Cò canh planogram lúc \d\d:\d\d \(\d+ phút trước\)$/.test(hn.hn), "máy rảnh: nhãn «Rảnh» + dòng «Hôm nay đã làm …» (" + hn.tag + " · " + hn.hn + ")");
      await kiemBridge(); await p.screenshot({ path: path.join(RA, m.ten + ".png"), fullPage: true }); await p.close(); continue;
    }
    if (m.data2) { const q = dcMay["HSK-KHO170-QLIT"] || [];
      ok(q.length === 2 && /^Cò canh B1\.1 Soát phiếu 5S \(B1\.1 · B3 · vệ sinh\) · phiếu 14180438 \(40\/120\)/.test(q[0].t) && Math.abs(q[0].thanh - 33) <= 1 && /^Cò canh planogram Đang chạy từ \d\d:\d\d/.test(q[1].t),
        "thẻ QLIT: 2 việc đang chạy — có tiến độ thì bước/phiếu/thanh, chưa có thì «Đang chạy» + giờ (" + q.map((x) => x.t).join(" | ") + ")"); }
    if (m.data) ok(!Object.values(dcMay).some((x) => x.length), "không máy nào chạy → không thẻ nào có khối Đang chạy");
    const moViec = (may) => p.evaluate((may) => { const n = [...document.querySelectorAll("#pane-maytram .mt-xo")].find((e) => e.dataset.xo === may); if (n && !n.closest(".mt-phai").classList.contains("mo")) n.click(); }, may).then(() => new Promise((r) => setTimeout(r, 250)));
    if (m.data2) await moViec("HSK-KHO170-QLIT");
    if (m.data2) {   // 14/10 chiều: chip việc TRÁI→PHẢI kê BÊN PHẢI thẻ máy (máy tính); máy dừng MỜ, máy chạy sáng; mỗi chip có ×
      const g = await p.evaluate(() => { const the = [...document.querySelectorAll("#pane-maytram .mt-o")];
        const o = the[0], tr = o.querySelector(".mt-trai").getBoundingClientRect(), ph = o.querySelector(".mt-phai").getBoundingClientRect();
        const chip = [...o.querySelectorAll(".mt-phai .mt-nhom")[0].querySelectorAll(".mt-c")].map((c) => c.getBoundingClientRect());
        const x = [...o.querySelectorAll(".mt-c")].map((c) => { const b = c.querySelector(".mt-x"); if (!b) return null; const r = b.getBoundingClientRect(), rc = c.getBoundingClientRect(); return { phai: r.right >= rc.right - 8, w: r.width, h: r.height, k: b.textContent }; });
        const mo = (sel) => { const t = the.find((e) => e.querySelector(".mt-dau b").textContent === sel); return t ? +getComputedStyle(t.querySelector(".mt-phai")).opacity : -1; };
        return { benPhai: ph.left >= tr.right - 1 && Math.abs(ph.top - tr.top) < 2, duoi: ph.top >= tr.bottom - 1, traiPhai: chip.length > 1 && ((chip[1].left > chip[0].left && Math.abs(chip[1].top - chip[0].top) < 2) || (chip[1].top > chip[0].top && Math.abs(chip[1].left - chip[0].left) < 2)),
          x, moDung: mo("HSK-KHO170-tamlc-1"), moChay: mo("HSK-KHO170-QLIT"), nutDungSang: +getComputedStyle(the[1].querySelector(".mt-nut")).opacity,
          tom: (document.querySelector("#pane-maytram .mt-tom") || {}).textContent || "" }; });
      if (!m.mob) ok(g.benPhai, "chip việc kê BÊN PHẢI thẻ máy");
      else ok(g.duoi, "điện thoại: chip việc xuống dưới thẻ máy (không bóp hẹp)");
      ok(g.traiPhai, "chip việc chạy từ trái sang phải");
      ok(g.moDung < 0.6 && g.moChay === 1 && g.nutDungSang === 1, "máy dừng MỜ (" + g.moDung + "), máy chạy sáng, nút «Cho chạy lại» vẫn sáng");
      ok(g.x.length === 13 && g.x.every((v) => v && v.phai), "13 chip đều có nút tắt nằm bên phải");
      ok(g.x.filter((v) => v.k === "↺").length === 1 && g.x.filter((v) => v.k === "×").length === 12, "việc đã tắt hiện ↺ (bật lại), còn lại ×");
      if (m.mob) ok(g.x.every((v) => v.w >= 40 && v.h >= 40), "điện thoại: nút × vùng chạm ≥40px (" + g.x.map((v) => Math.round(v.w) + "×" + Math.round(v.h)).slice(0, 3).join(",") + "…)");
      const od = await p.evaluate(() => [...document.querySelector("#pane-maytram .mt-o").querySelectorAll(".mt-sk .r")].map((r) => r.innerText.replace(/\s+/g, " ").trim()));
      ok(await p.evaluate(() => { const r = [...document.querySelector("#pane-maytram .mt-o").querySelectorAll(".mt-sk .r")].slice(2, 4).map((x) => x.getBoundingClientRect()); return r.length === 2 && Math.abs(r[0].top - r[1].top) < 2 && r[1].left > r[0].right; }), "ổ C | ổ D cùng 1 hàng, trái sang phải");
      ok(od.includes("C: 12 GB") && od.includes("D: 813 GB") && !od.some((x) => /^Ổ C/.test(x)), "liệt kê MỌI ổ đĩa: " + od.slice(2).join(" | "));
      ok(await p.evaluate(() => { const b = document.querySelector("#pane-maytram .mt-o .mt-sk .r[title*='Ổ C'] i b"); return !!b && Math.abs(parseFloat(b.style.width) - 95) <= 1; }), "thanh ổ C = phần ĐÃ DÙNG (95%), đổi màu khi sắp đầy");
      // 14/10 user «thông tin ở nút máy trạm lộn xộn, lặp lại»: bỏ dòng tóm «13 việc · 2 chạy · 10 chờ» (trùng màu chip + khối Đang chạy) — thay bằng SỨC KHOẺ + «Hôm nay đã làm»
      const sk = await p.evaluate(() => { const o = document.querySelector("#pane-maytram .mt-o"); return { tom: !!document.querySelector("#pane-maytram .mt-tom, #pane-maytram .mt-gan"), dg: o.querySelector(".mt-the").textContent + "|" + ((o.querySelector(".mt-ly") || {}).textContent || ""), lop: (o.querySelector(".mt-ly") || {}).className || "", hn: (o.querySelector(".mt-hn") || {}).textContent || "" }; });
      ok(!sk.tom, "không còn dòng tóm tắt lặp (13 việc · 2 chạy · …)");
      // 15/10 user «gom RAM và CPU thành 1 hàng; 2 nút Cập nhật ngay | Dừng máy (phải) ngang hàng; Sức khoẻ: Cần chú ý + lý do ngang hàng khi bên phải còn trống»
      const nh1 = await p.evaluate(() => { const o = document.querySelector("#pane-maytram .mt-o"), r = [...o.querySelectorAll(".mt-sk .r")].slice(0, 2).map((x) => x.getBoundingClientRect());
        const n = [...o.querySelectorAll(".mt-nut .hx-nut")].map((x) => ({ t: x.textContent, r: x.getBoundingClientRect() })), a = o.querySelector(".mt-dau b").getBoundingClientRect(), b = o.querySelector(".mt-the").getBoundingClientRect();
        return { ramCpu: Math.abs(r[0].top - r[1].top) < 2 && r[1].left > r[0].right, nut: n.length === 2 && Math.abs(n[0].r.top - n[1].r.top) < 2 && n[1].r.left > n[0].r.right && n[1].t === "Dừng máy" && n[0].t === "Cập nhật ngay",
          dg: Math.abs(a.top - b.top) < 4 && b.left > a.right }; });
      ok(nh1.ramCpu && nh1.nut && nh1.dg, "RAM|CPU cùng 1 hàng · nút Cập nhật ngay | Dừng máy (phải) cùng hàng · chip sức khoẻ cùng dòng tên máy (" + JSON.stringify(nh1) + ")");
      // máy mẫu: ổ C đã dùng 95% (thanh ĐỎ) dù còn 12 GB → sức khoẻ phải «Cần chú ý» + lý do — thanh đỏ mà ghi «Tốt» là lệch (lỗi đã gặp 14/10)
      ok(/^Cần chú ý\|ổ C đầy 95%, còn 12 GB$/.test(sk.dg) && /\bchu-y\b/.test(sk.lop), "đánh giá sức khoẻ khớp màu thanh ổ đĩa: «Cần chú ý · ổ C đầy 95%» (" + sk.dg + ")");
      ok(await p.evaluate(() => { const t = document.querySelector("#pane-maytram .mt-o .mt-dau b"); return t.scrollHeight <= 20; }), "tên máy 1 dòng, không ngắt giữa tên");
      ok(/^Hôm nay đã làm 2 việc · gần nhất: Cò canh planogram lúc \d\d:\d\d \(\d+ phút trước\)$/.test(sk.hn), "dòng «Hôm nay đã làm» (" + sk.hn + ")");
      const nn = await p.evaluate((sel) => { const o = {}; document.querySelectorAll(sel).forEach((d) => { const nh = d.querySelector(".mt-nh"); o[nh ? nh.textContent : "?"] = d.querySelectorAll(".mt-c,.hx-tag").length; }); return o; }, "#pane-maytram .mt-o .mt-phai .mt-nhom");
      ok(nn["Nặng:"] === 7 && nn["Nhẹ:"] === 6, "chip việc chia hàng Nặng/Nhẹ, nhãn ghi 1 lần, hiện sẵn không cần bấm (" + JSON.stringify(nn) + ")");
      // 15/10 user «chip vừa khớp chữ, đồng bộ; Nặng chốt trái, Nhẹ chốt phải ngang hàng Nặng»; «máy không chạy xuống dưới»
      const bo = await p.evaluate(() => { const o = document.querySelector("#pane-maytram .mt-o"), nh = [...o.querySelectorAll(".mt-phai .mt-nhom")], ph = o.querySelector(".mt-phai").getBoundingClientRect();
        const c = [...o.querySelectorAll(".mt-phai .mt-c")].map((e) => { const r = e.getBoundingClientRect(), t = e.querySelector(".ten"); return { w: r.width, h: Math.round(r.height), cat: t.scrollWidth > t.clientWidth + 1 }; });
        const rN = nh[0].getBoundingClientRect(), cuoiNhe = [...nh[1].querySelectorAll(".mt-c")].map((e) => e.getBoundingClientRect().right);
        const rL = nh[1].getBoundingClientRect(), c0 = (g) => g.querySelector(".mt-c").getBoundingClientRect().left;
        const bn = o.querySelector(".mt-phai .mt-xo-ct"), rb = bn.getBoundingClientRect();   // 19/10 chip nằm trong bảng nổi
        return { ngang: rL.top >= rN.bottom - 1 && Math.abs(rL.left - rN.left) < 2 && Math.abs(c0(nh[0]) - c0(nh[1])) < 2, traiN: Math.abs(rN.left - rb.left - parseFloat(getComputedStyle(bn).paddingLeft) - 1) < 2, phaiNhe: Math.max(...cuoiNhe) <= rb.right + 1,
          caoDeu: new Set(c.map((x) => x.h)).size === 1, rongTheoChu: new Set(c.map((x) => Math.round(x.w))).size > 3, khongCat: c.every((x) => !x.cat),
          thuTu: [...document.querySelectorAll("#pane-maytram .mt-o .mt-dau b")].map((b) => b.textContent) }; });
      // 15/10 chiều: cột «Việc đảm nhận» hẹp hơn → Nặng TRÊN, Nhẹ DƯỚI, chip 2 nhóm thẳng lề, không tràn cột
      if (!m.mob) ok(bo.ngang && bo.traiN && bo.phaiNhe, "Nặng trên, Nhẹ dưới, chip 2 nhóm thẳng lề, không tràn cột (" + JSON.stringify({ ngang: bo.ngang, traiN: bo.traiN, phaiNhe: bo.phaiNhe }) + ")");
      { const cc = await p.evaluate(() => { const c = [...document.querySelectorAll("#pane-maytram .mt-o .mt-c.dung")].map((e) => e.textContent); return c; });
        ok(cc.length === 1 && /^Chấm công→ chưa máy nào nhận/.test(cc[0]), "việc đã tắt ghi rõ ai nhận thay (" + cc.join(" | ") + ")"); }
      ok(bo.caoDeu && bo.rongTheoChu && bo.khongCat, "chip cao đều, rộng vừa theo chữ, không cắt chữ (" + JSON.stringify({ caoDeu: bo.caoDeu, rongTheoChu: bo.rongTheoChu, khongCat: bo.khongCat }) + ")");
      ok(bo.thuTu[0] === "HSK-KHO170-QLIT" && bo.thuTu[bo.thuTu.length - 1] === "HSK-KHO170-tamlc-1", "máy đang chạy trên cùng, máy dừng dưới cùng (" + bo.thuTu.join(" → ") + ")");
      await moViec("HSK-KHO170-QLIT"); hoi.length = 0; await p.click('#pane-maytram .mt-x[data-viec="tim-bang-chung-b1"]'); await new Promise((r) => setTimeout(r, 1200));
      const bx = post.filter((x) => /may-tram\/lenh/.test(x.url)).pop(), ox = bx ? JSON.parse(bx.body) : {};
      ok(hoi.length === 1 && /chuyển việc này sang máy khác/.test(hoi[0]) && ox.viec === "tim-bang-chung-b1" && ox.dung === true, "bấm × → hỏi lại rồi gửi lệnh tắt việc trên máy (" + (hoi[0] || "không hỏi") + ")");
      await kiemBridge(); await p.screenshot({ path: path.join(RA, m.ten + ".png"), fullPage: true }); await p.close(); continue;
    }
    if (m.data) {   // ca hiển thị: chỉ laptop đang dừng, 13 việc chưa có máy
      /* 19/10 user «chưa có máy nào nhận việc cũng cần gọn — điện thoại bảng này chiếm phần lớn khung»: C1 mặc định 1 dòng (số Nặng/Nhẹ, lý do chung), chip ẩn;
         C2 bấm → xổ chip (popIn). Các ca sau đo ở trạng thái đã xổ. */
      const c1 = await p.evaluate(() => { const k = document.querySelector("#pane-maytram .mt-chua"), dau = k.querySelector(".mt-chua-dau"), ly = k.querySelector(".hx-mt-ly");
        return { cao: Math.round(k.getBoundingClientRect().height), an: getComputedStyle(ly).display === "none", so: (dau.querySelector(".so") || {}).textContent || "", nut: Math.round(dau.getBoundingClientRect().height) }; });
      ok(c1.an && /^Nặng 7 · Nhẹ 6$/.test(c1.so) && c1.cao <= (m.mob ? 72 : 52) && (!m.mob || c1.nut >= 44), "C1 «Việc chưa có máy nhận» mặc định gọn: «" + c1.so + "», ẩn chip, cao " + c1.cao + "px");
      await p.click("#pane-maytram .mt-chua-dau"); await new Promise((r) => setTimeout(r, 300));
      const c2 = await p.evaluate(() => { const ly = document.querySelector("#pane-maytram .mt-chua .hx-mt-ly"); return { hien: getComputedStyle(ly).display !== "none" && ly.getBoundingClientRect().height > 0, anim: getComputedStyle(ly).animationName }; });
      ok(c2.hien && c2.anim === "popIn", "C2 bấm → xổ chip (popIn) " + JSON.stringify(c2));
      const d = await p.evaluate(() => { const pn = document.querySelector("#pane-maytram"), khoi = pn.querySelector(".mt-chua");
        return { t: pn.innerText, ly: [...pn.querySelectorAll(".hx-mt-ly .ly, .mt-chua-dau .ly1")].map((x) => x.textContent), nhan: pn.querySelectorAll(".hx-mt-ly .hx-tag").length, caoKhoi: khoi ? Math.round(khoi.getBoundingClientRect().height) : 0 }; });
      const laL = m.data === API_LAPTOP;
      if (!laL) ok(d.ly.length === 3 && new Set(d.ly).size === 3, "3 lý do, mỗi lý do ghi 1 lần (" + d.ly.join(" | ") + ")");
      if (laL) ok(!/chuyển sang máy khác|sang máy khác/.test(d.t) && /Đang dừng — không nhận việc/.test(d.t), "máy dừng duy nhất: KHÔNG nói «sang máy khác»");
      if (laL) ok(d.ly.length === 1 && d.ly[0] === "Chưa có PC nào đang chạy" && d.nhan === 13, "13 việc gom thành 1 lý do + 13 nhãn (" + d.ly.join(" | ") + " · " + d.nhan + ")");
      ok(!/APPSCRIPT_|TOPREVIEW_|GEMINI_/.test(d.t), "không lộ tên khoá kỹ thuật");
      const nc = await p.evaluate((sel) => { const o = {}; document.querySelectorAll(sel).forEach((d) => { const nh = d.querySelector(".mt-nh"); o[nh ? nh.textContent : "?"] = d.querySelectorAll(".mt-c,.hx-tag").length; }); return o; }, "#pane-maytram .mt-chua .mt-cot");
      ok(nc["Nặng:"] === 7 && nc["Nhẹ:"] === 6, "Việc chưa có máy nhận: chia hàng Nặng/Nhẹ, nhãn ghi 1 lần (" + JSON.stringify(nc) + ")");
      if (!m.mob) { const c2 = await p.evaluate(() => { const c = [...document.querySelectorAll("#pane-maytram .mt-chua .mt-cot")], k = document.querySelector("#pane-maytram .mt-chua .hx-mt-ly").getBoundingClientRect();
          const r = c.map((e) => e.getBoundingClientRect()), cuoi = Math.max(...[...c[1].querySelectorAll(".hx-tag")].map((t) => t.getBoundingClientRect().right));
          return { ngang: Math.abs(r[0].top - r[1].top) < 2, trai: r[0].left < k.left + 20, phai: cuoi >= k.right - 20 }; });
        ok(c2.ngang && c2.trai && c2.phai, "Việc chưa nhận: cột Nặng TRÁI, cột Nhẹ PHẢI cùng hàng (" + JSON.stringify(c2) + ")"); }
      if (laL) ok(!/điểm \d/.test(d.t) && /dừng bởi bộ cài \(máy quản lý\)/.test(bc.tipPhu[0]), "thẻ gọn: «điểm», «dừng bởi» chỉ trong chú thích rê chuột");
      const tran = (m.mob ? 300 : 220) + (laL ? 0 : 60);   // 15/10 3 lý do = thêm 2 dòng lý do   // 14/10 điện thoại: thêm 2 hàng «Nặng:/Nhẹ:» (user yêu cầu nhãn nặng nhẹ) → 285px, vẫn nửa trên màn
      ok(d.caoKhoi > 0 && d.caoKhoi < tran, "khối chưa nhận gọn (" + d.caoKhoi + "px < " + tran + ")");
      await kiemBridge(); await p.screenshot({ path: path.join(RA, m.ten + ".png"), fullPage: true }); await p.close(); continue;
    }
    ok(bc.so === 2, "2 thẻ máy (" + bc.so + ")");
    ok(/PC-KHO-01/.test(bc.chu[0]) && /Đang chạy/.test(bc.chu[0]) && /RAM 62%/.test(bc.chu[0]) && /CPU 72%/.test(bc.chu[0]) && /Ổ C 8 GB/.test(bc.chu[0]), "thẻ 1: trạng thái + RAM 62% + CPU 72% + ổ C 8 GB");
    ok(/nhịp tim 2\d giây trước/.test(bc.tipPhu[0]) && /bản 5be3da2/.test(bc.tipPhu[0]) && !/giây trước/.test(bc.chu[0]), "thẻ 1: nhịp tim + bản code CHỈ trong chú thích tên máy (thẻ gọn)");
    const c1 = bc.chip[0].join("|");
    ok(/Cần chú ý[\s\S]*tạm ngưng việc nặng \(RAM 62%, chờ xuống 60%\)/.test(bc.chu[0]), "máy có cờ Yếu → Sức khoẻ KHÔNG được ghi «Tốt», nêu lý do (" + (bc.chu[0].match(/Cần chú ý[^R]*/) || [""])[0] + ")");
    ok(/chay:Cò canh B1\.1/.test(c1) && /cho:Tìm bằng chứng B1/.test(c1) && /dung:Canh bãi xe sáng/.test(c1), "thẻ 1: chip việc đúng màu (chạy / chờ lịch / dừng)");
    ok(/dung:Canh bãi xe sáng→ chờ máy chạy bù/.test(c1), "thẻ 1: việc nặng đã dừng, đang chuyển → «chờ máy chạy bù» (" + c1 + ")");
    ok(/PC-KHO-02/.test(bc.chu[1]) && /Sức khoẻ kém[\s\S]*mất nhịp (2 giờ trước|90 phút trước)/.test(bc.chu[1]) && /không có khoá camera/.test(bc.tipPhu[1]), "thẻ 2: mất nhịp → Sức khoẻ Kém + lý do; «không khoá camera» trong chú thích");
    const nb = await nhom();
    const coHam = m.quanLy ? 0 : await p.evaluate(() => !!window.__HX_QUA_HAM);   // 19/10 user duyệt đường hầm: điện thoại thấy đủ 4 mục khi đường hầm sống
    ok(m.quanLy || coHam ? nb.join("|") === "Theo tác vụ|Theo máy|Máy trạm|Nhật ký" : nb.join("|") === "Máy trạm", "thanh bên nhóm Xác minh: máy quản lý (và điện thoại khi có đường hầm) Theo tác vụ|Theo máy|Máy trạm|Nhật ký · điện thoại không đường hầm chỉ Máy trạm (" + nb.join(" | ") + ")");
    await kiemBridge(); await p.screenshot({ path: path.join(RA, m.ten + ".png"), fullPage: true });
    if (m.quanLy) {
      ok(bc.nut.some((n) => n.t === "Gỡ") && !/Dừng máy/.test(bc.chu[1]) && bc.nut.some((n) => n.t === "Dừng máy"), "máy quản lý: máy sống có «Dừng máy», máy mất nhịp chỉ có «Gỡ»");
      if (m.mob) ok(bc.nut.every((n) => n.h >= 40), "vùng chạm ≥40px trên điện thoại (" + bc.nut.map((n) => n.h).join(",") + ")");
      // 15/10 «Cập nhật ngay»: chỉ máy SỐNG có nút; bấm → lệnh capNhat (không hỏi lại — không làm gián đoạn việc)
      const cn = await p.evaluate(() => [...document.querySelectorAll("#pane-maytram button[data-capnhat]")].map((b) => b.dataset.may));
      ok(cn.includes("PC-KHO-01") && !cn.includes("PC-KHO-02"), "nút «Cập nhật ngay» chỉ ở máy sống (" + cn.join(",") + ")");
      { const truoc = post.length; await p.click('#pane-maytram button[data-capnhat][data-may="PC-KHO-01"]'); await new Promise((r) => setTimeout(r, 1200));
        const bq = post.slice(truoc).find((x) => /may-tram\/lenh/.test(x.url)), oq = bq ? JSON.parse(bq.body) : {};
        ok(oq.may === "PC-KHO-01" && oq.capNhat === true && !oq.dung, "bấm «Cập nhật ngay» → gửi lệnh capNhat cho đúng máy (" + JSON.stringify(oq) + ")"); }
      const xk = await p.evaluate(() => { const k = document.querySelector("#pane-maytram .hx-mt-xin"); return k ? k.innerText.replace(/\s+/g, " ") : ""; });
      ok(/PC-MOI-03/.test(xk) && /Mã xác nhận 7F3A/.test(xk) && /Duyệt/.test(xk) && /Từ chối/.test(xk), "khối PC xin khoá: tên máy + mã xác nhận + Duyệt/Từ chối");
      await p.click('#pane-maytram button[data-xin="PC-MOI-03"][data-dongy="1"]'); await new Promise((r) => setTimeout(r, 1200));
      const dk = post.find((x) => /duyet-khoa/.test(x.url)), od = dk ? JSON.parse(dk.body) : {};
      ok(od.may === "PC-MOI-03" && od.dongY === true, "bấm Duyệt → lệnh {PC-MOI-03, đồng ý}");
      await moViec("PC-KHO-01"); hoi.length = 0; await p.click('#pane-maytram .mt-x[data-viec="canh-b11"]'); await new Promise((r) => setTimeout(r, 1200));
      const bd = post.find((x) => /may-tram\/lenh/.test(x.url) && JSON.parse(x.body).viec), o = bd ? JSON.parse(bd.body) : {};
      ok(hoi.length === 1 && /Tắt «Cò canh B1\.1» trên PC-KHO-01/.test(hoi[0]), "bấm × trên chip việc → hỏi lại trước khi tắt (" + (hoi[0] || "không hỏi") + ")");
      ok(o.may === "PC-KHO-01" && o.viec === "canh-b11" && o.dung === true, "đồng ý → lệnh {PC-KHO-01, canh-b11, dừng}");
    } else {
      ok(goiDN === 2 && goiBang > 0, "điện thoại: đăng nhập 1 lần ở hệ tài khoản → dữ liệu qua Apps Script, không hỏi lần 2 (đăng nhập " + goiDN + " · bảng " + goiBang + ")");
      ok(!(await p.$("#mtDnForm")) && !(await p.$("#mtDangXuat")), "không còn ô đăng nhập / nút đăng xuất riêng của Máy trạm");
      /* 14/10 user «nút dừng chạy của máy trạm đâu»: tài khoản quyền «làm» Xác minh → CÓ nút ở mọi nơi (lệnh qua GAS pcLenhPh, không cần 8591); vẫn KHÔNG khối duyệt khoá */
      ok(bc.nut.some((n) => n.t === "Dừng máy") && !!(await p.$("#pane-maytram .mt-x")) && !(await p.$("#pane-maytram .hx-mt-xin")), "điện thoại (quyền làm): CÓ nút Dừng máy + × chip, KHÔNG khối duyệt khoá");
      hoi.length = 0; await p.click('#pane-maytram button.hx-nut[data-may="PC-KHO-01"][data-dung="1"]'); await new Promise((r) => setTimeout(r, 1500));
      const lg = post.filter((x) => x.url === "gas:pcLenhPh").map((x) => JSON.parse(x.body)), l8591 = post.filter((x) => /may-tram\/lenh/.test(x.url));
      ok(hoi.length === 1 && lg.length === 1 && lg[0].may === "PC-KHO-01" && lg[0].dung === true && lg[0].ph && !l8591.length, "điện thoại: bấm Dừng máy → hỏi lại → lệnh qua GAS pcLenhPh kèm phiên tài khoản (không gọi 8591)");
      await p.evaluate(() => { window.TK.nguoi = null; window.TK.phien = ""; document.dispatchEvent(new CustomEvent("tk-doi")); }); await new Promise((r) => setTimeout(r, 800));
      ok(!!(await p.$("#mtMoTk, #pane-maytram .xm-khoa-nut")) && !(await p.$("#pane-maytram .mt-o")), "đăng xuất hệ tài khoản → Máy trạm khoá lại ngay");
    }
    await p.close();
  }
} finally { await b.close(); }
console.log(loi ? `\n${loi} ca HỎNG` : "\nĐẠT tất cả"); process.exit(loi ? 1 : 0);
