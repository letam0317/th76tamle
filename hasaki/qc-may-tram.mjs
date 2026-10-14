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
const PC1 = { may: "PC-KHO-01", luc: iso(24), ramTrongPct: 38, cpuPct: 72, diaTrongGB: 8.4, yeu: false, diem: 420, nhan: 8, ramTongGB: 16, ban: "5be3da2",
  dangChay: ["canh-b11"], dungViec: ["canh-bai-xe-sang"], dung: false, viecGiao: ["canh-b11", "tim-bang-chung-b1", "co-canh-planogram"],
  tatCaViec: ["canh-b11", "canh-bai-xe-sang", "tim-bang-chung-b1", "co-canh-planogram"] };
const PC2 = { may: "PC-KHO-02", luc: iso(5400), ramTrongPct: 61, cpuPct: 4, diaTrongGB: 120, yeu: false, diem: 300, nhan: 4, ramTongGB: 8, ban: "13d633b",
  dangChay: [], dungViec: [], dung: false, viecGiao: [], tatCaViec: PC1.tatCaViec };
const API591 = { srvNow: now, hetHanPhut: 3,
  may: [{ ...PC1, song: true, tuoiGiay: 24, coKhoa: ["APPSCRIPT_KEY", "TOPREVIEW_USER"] }, { ...PC2, song: false, tuoiGiay: 5400, coKhoa: ["APPSCRIPT_KEY"] }],
  viec: [{ ten: "canh-b11", nang: true, may: "PC-KHO-01" }, { ten: "canh-bai-xe-sang", nang: true, may: null, canKhoa: ["TOPREVIEW_USER"] },
    { ten: "tim-bang-chung-b1", nang: true, may: "PC-KHO-01" }, { ten: "co-canh-planogram", nang: false, may: "PC-KHO-01" }],
  chuyen: [{ viec: "canh-bai-xe-sang", tu: "PC-KHO-01", luc: now - 30000, sanSang: true }],
  xin: [{ may: "PC-MOI-03", maXN: "7F3A", luc: now - 60000, daDuyet: false }] };   // 14/10 PC xin khoá chờ duyệt
const GAS_TB = { status: "success", srvNow: now, may: [{ ...PC1, coCamera: true }, { ...PC2, coCamera: false }], chuyen: API591.chuyen };
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
CA.push({ ten: "pc13-pc", w: 1366, h: 900, mob: false, quanLy: true, data2: API_PC13 }, { ten: "pc13-ip14", w: 390, h: 844, mob: true, quanLy: true, data2: API_PC13 }, { ten: "pc13-and360", w: 360, h: 740, mob: true, quanLy: true, data2: API_PC13 });
CA.push({ ten: "chi-laptop-dung", w: 1366, h: 900, mob: false, quanLy: true, data: API_LAPTOP }, { ten: "chi-laptop-dung-ip14", w: 390, h: 844, mob: true, quanLy: true, data: API_LAPTOP }, { ten: "chi-laptop-dung-and360", w: 360, h: 740, mob: true, quanLy: true, data: API_LAPTOP });
// 14/10 «đang chạy công việc gì cũng cần hiển thị»: laptop DỰ PHÒNG đang làm thay Cò xác minh B1 (GAS PCPHU gộp duPhong/dangChay/batDau)
const API_DUPHONG = { ...API_PC13, may: [{ ...API_PC13.may[0], dangChay: [], dungViec: [], chayLuc: { "co-canh-planogram": iso(300) } },
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
      }
      if (r.method() === "POST" && !/\/api\/dang-nhap$/.test(u)) { post.push({ url: u, body: r.postData() }); return r.respond({ status: 200, contentType: "application/json", headers: cors(r), body: JSON.stringify({ ok: 1, daChuyen: [] }) }); }
      if (/\/api\/may-tram$/.test(u)) return r.respond({ status: 200, contentType: "application/json", headers: cors(r), body: JSON.stringify(m.data || m.data2 || API591) });
      r.continue();
    });
    await p.goto(URL0 + "?tab=maytram", { waitUntil: "domcontentloaded", timeout: 60000 });
    const nhom = () => p.evaluate(() => { const g = [...document.querySelectorAll("#sideNav .s-grp")].find((x) => x.textContent.trim() === "Xác minh"); const sub = g && g.nextElementSibling;
      return sub ? [...sub.querySelectorAll(".s-item")].map((x) => x.textContent.trim().replace(/\d.*$/, "")) : []; });
    if (m.chuaDN) {   // máy quản lý CHƯA đăng nhập hệ tài khoản (dù còn sót phiên Xác minh cũ hx-phien)
      await p.waitForSelector("#mtMoTk", { timeout: 30000 });
      ok(!(await p.$("#pane-maytram .mt-o")), "chưa đăng nhập: KHÔNG thấy dữ liệu, chỉ nút Đăng nhập (hệ tài khoản)");
      await new Promise((r) => setTimeout(r, 1500));
      const nb0 = await nhom(), mot0 = await p.evaluate(() => !!document.querySelector('#sideNav .s-mot .s-item[data-tab="xacminh"]'));
      ok(!nb0.length && mot0, "chưa đăng nhập: thanh bên chỉ 1 nút «Xác minh», KHÔNG có mục con (" + nb0.join(" | ") + ")");
      await p.screenshot({ path: path.join(RA, m.ten + ".png") }); await p.close(); continue;
    }
    if (!m.quanLy) {   // điện thoại: chưa đăng nhập → nút Đăng nhập (hệ tài khoản); sai → vẫn khoá; đúng 1 lần → thấy Máy trạm
      await p.waitForSelector("#mtMoTk", { timeout: 30000 });
      ok(!(await p.$("#pane-maytram .mt-o")) && goiBang === 0, "điện thoại chưa đăng nhập: KHÔNG thấy/không tải dữ liệu");
      ok(!(await nhom()).length, "điện thoại chưa đăng nhập: thanh bên không có mục con Xác minh");
      await p.screenshot({ path: path.join(RA, m.ten + "-dangnhap.png") });
      const sai = await p.evaluate((mk) => window.tkDangNhap("tamlc", mk).then(() => "ok", (e) => "loi:" + e.message), "sai-mat-khau");
      await new Promise((r) => setTimeout(r, 800));
      ok(/^loi/.test(sai) && !(await p.$("#pane-maytram .mt-o")), "sai mật khẩu → vẫn khoá (" + sai + ")");
      await p.evaluate((mk) => window.tkDangNhap("tamlc", mk), MK_DUNG);
    }
    await p.waitForFunction(() => document.querySelectorAll("#pane-maytram .mt-o").length > 0, { timeout: 60000 });
    await new Promise((r) => setTimeout(r, 800));
    // 14/10 chiều bố cục DỌC: «Việc chưa có máy nhận» TRÊN CÙNG; mỗi máy 1 hàng, xếp từ trên xuống, rộng đều, vừa bề ngang
    const bc = await p.evaluate(() => { const pn = document.querySelector("#pane-maytram"), the = [...pn.querySelectorAll(".mt-hang > .mt-o")], ch = pn.querySelector(".mt-chua"), hg = pn.querySelector(".mt-hang");
      const r = the.map((x) => x.getBoundingClientRect()), pr = pn.getBoundingClientRect();
      return { so: the.length, doc: r.every((x, i) => !i || x.top >= r[i - 1].bottom - 1), deuNhau: r.every((x) => Math.abs(x.width - r[0].width) < 2), vua: r.every((x) => x.right <= pr.right + 1),
        chuaTruoc: !!(ch && hg && (ch.compareDocumentPosition(hg) & Node.DOCUMENT_POSITION_FOLLOWING)), ngang: document.documentElement.scrollWidth - innerWidth,
        chu: the.map((t) => t.innerText.replace(/\s+/g, " ")), tipPhu: the.map((t) => (t.querySelector(".mt-phu") || {}).title || ""),
        chip: the.map((t) => [...t.querySelectorAll(".mt-c")].map((c) => c.className.replace("mt-c ", "") + ":" + c.textContent)),
        nut: [...pn.querySelectorAll("button[data-may]")].map((n) => ({ t: n.textContent, h: Math.round(n.getBoundingClientRect().height) })) }; });
    ok(bc.chuaTruoc, "«Việc chưa có máy nhận» nằm TRÊN hàng máy trạm");
    ok(bc.doc && bc.deuNhau && bc.vua, "máy trạm xếp DỌC từ trên xuống, rộng đều, vừa bề ngang (" + bc.so + " máy)");
    ok(bc.ngang <= 0, "không kéo ngang trang (" + bc.ngang + ")");
    // 14/10 chiều: «Đang chạy» nằm TRONG TỪNG THẺ MÁY (không còn khối chung) — việc · bước · phiếu (link) · i/n · từ giờ · cập nhật
    const dcMay = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll("#pane-maytram .mt-o")].map((o) => [o.querySelector(".mt-dau b").textContent,
      [...o.querySelectorAll(".mt-phai .mt-dc")].map((d) => ({ t: d.innerText.replace(/\s+/g, " ").trim(), link: (d.querySelector(".mt-dc-bc a") || {}).href || "",
        thanh: d.querySelector(".mt-dc-thanh b") ? parseFloat(d.querySelector(".mt-dc-thanh b").style.width) : -1, dauPhai: d.parentElement.firstElementChild === d }))])));
    ok(!(await p.$("#pane-maytram .mt-dang")), "không còn khối «Đang chạy» chung (tránh lặp)");
    if (m.duPhong) {   // laptop dự phòng đang làm thay
      const d = (dcMay["HSK-KHO170-tamlc-1"] || [])[0];
      ok(d && /^Cò xác minh B1 làm thay Soát phiếu B1 theo luật · phiếu 14180441 \(23\/83\)/.test(d.t) && /từ \d\d:\d\d · 1\d phút · cập nhật \d+ giây trước/.test(d.t)
        && /tasks\?task_id=14180441$/.test(d.link) && Math.abs(d.thanh - 28) <= 1 && d.dauPhai, "thẻ laptop: đang chạy việc gì · bước · phiếu (link work) · 23/83 · từ giờ · cập nhật (" + (d ? d.t : "không có") + ")");
      const lt = await p.evaluate(() => { const t = [...document.querySelectorAll("#pane-maytram .mt-o")].find((e) => /tamlc/.test(e.querySelector(".mt-dau b").textContent));
        return { tag: t.querySelector(".mt-dau .hx-tag").textContent, mo: t.classList.contains("mo"), chip: [...t.querySelectorAll(".mt-c")].map((c) => c.className + ":" + c.textContent) }; });
      ok(lt.tag === "Dự phòng" && !lt.mo && lt.chip.length === 4 && lt.chip.some((c) => /chay:Cò xác minh B1/.test(c)) && lt.chip.filter((c) => /mt-c cho:/.test(c)).length === 3, "thẻ laptop: «Dự phòng», SÁNG khi đang làm thay, 4 việc ghim laptop: 1 chạy (xanh) + 3 chờ (" + lt.tag + " · " + lt.chip.join(",") + ")");
      ok(await p.evaluate(() => !/Cò canh B1.1|Cò xác minh B1|Tìm bằng chứng B1|Xác minh camera tối/.test((document.querySelector("#pane-maytram .mt-chua") || {}).innerText || "")), "việc ghim laptop KHÔNG nằm trong «Việc chưa có máy nhận»");
      ok((dcMay["HSK-KHO170-QLIT"] || []).length === 0, "QLIT không chạy gì → thẻ không có khối Đang chạy");
      await p.screenshot({ path: path.join(RA, m.ten + ".png"), fullPage: true }); await p.close(); continue;
    }
    if (m.data2) { const q = dcMay["HSK-KHO170-QLIT"] || [];
      ok(q.length === 2 && /^Cò canh B1\.1 Soát phiếu 5S \(B1\.1 · B3 · vệ sinh\) · phiếu 14180438 \(40\/120\)/.test(q[0].t) && Math.abs(q[0].thanh - 33) <= 1 && /^Cò canh planogram Đang chạy từ \d\d:\d\d/.test(q[1].t),
        "thẻ QLIT: 2 việc đang chạy — có tiến độ thì bước/phiếu/thanh, chưa có thì «Đang chạy» + giờ (" + q.map((x) => x.t).join(" | ") + ")"); }
    if (m.data) ok(!Object.values(dcMay).some((x) => x.length), "không máy nào chạy → không thẻ nào có khối Đang chạy");
    if (m.data2) {   // 14/10 chiều: chip việc TRÁI→PHẢI kê BÊN PHẢI thẻ máy (máy tính); máy dừng MỜ, máy chạy sáng; mỗi chip có ×
      const g = await p.evaluate(() => { const the = [...document.querySelectorAll("#pane-maytram .mt-o")];
        const o = the[0], tr = o.querySelector(".mt-trai").getBoundingClientRect(), ph = o.querySelector(".mt-phai").getBoundingClientRect();
        const chip = [...o.querySelectorAll(".mt-phai .ds")[0].querySelectorAll(".mt-c")].map((c) => c.getBoundingClientRect());
        const x = [...o.querySelectorAll(".mt-c")].map((c) => { const b = c.querySelector(".mt-x"); if (!b) return null; const r = b.getBoundingClientRect(), rc = c.getBoundingClientRect(); return { phai: r.right >= rc.right - 8, w: r.width, h: r.height, k: b.textContent }; });
        const mo = (sel) => { const t = the.find((e) => e.querySelector(".mt-dau b").textContent === sel); return t ? +getComputedStyle(t.querySelector(".mt-phai")).opacity : -1; };
        return { benPhai: ph.left >= tr.right - 1 && Math.abs(ph.top - tr.top) < 2, duoi: ph.top >= tr.bottom - 1, traiPhai: chip.length > 1 && chip[1].left > chip[0].left && Math.abs(chip[1].top - chip[0].top) < 2,
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
      ok(od.includes("C: 12 GB") && od.includes("D: 813 GB") && !od.some((x) => /^Ổ C/.test(x)), "liệt kê MỌI ổ đĩa: " + od.slice(2).join(" | "));
      ok(await p.evaluate(() => { const b = document.querySelector("#pane-maytram .mt-o .mt-sk .r[title*='Ổ C'] i b"); return !!b && Math.abs(parseFloat(b.style.width) - 95) <= 1; }), "thanh ổ C = phần ĐÃ DÙNG (95%), đổi màu khi sắp đầy");
      ok(/13 việc · .*2 chạy · .*1 dừng · .*10 chờ/.test(g.tom), "việc tóm 1 dòng: " + g.tom.replace(/\s+/g, " "));
      const gan = await p.evaluate(() => (document.querySelector("#pane-maytram .mt-gan") || {}).textContent || "");
      ok(/^7 nặng · 6 nhẹ · chạy gần nhất \d\d:\d\d$/.test(gan), "dòng 2: nặng/nhẹ + giờ chạy gần nhất (" + gan + ")");
      const nn = await p.evaluate((sel) => { const o = {}; document.querySelectorAll(sel).forEach((d) => { const nh = d.querySelector(".mt-nh"); o[nh ? nh.textContent : "?"] = d.querySelectorAll(".mt-c,.hx-tag").length; }); return o; }, "#pane-maytram .mt-o .mt-phai .ds");
      ok(nn["Nặng:"] === 7 && nn["Nhẹ:"] === 6, "chip việc chia hàng Nặng/Nhẹ, nhãn ghi 1 lần, hiện sẵn không cần bấm (" + JSON.stringify(nn) + ")");
      hoi.length = 0; await p.click('#pane-maytram .mt-x[data-viec="tim-bang-chung-b1"]'); await new Promise((r) => setTimeout(r, 1200));
      const bx = post.filter((x) => /may-tram\/lenh/.test(x.url)).pop(), ox = bx ? JSON.parse(bx.body) : {};
      ok(hoi.length === 1 && /chuyển việc này sang máy khác/.test(hoi[0]) && ox.viec === "tim-bang-chung-b1" && ox.dung === true, "bấm × → hỏi lại rồi gửi lệnh tắt việc trên máy (" + (hoi[0] || "không hỏi") + ")");
      await p.screenshot({ path: path.join(RA, m.ten + ".png"), fullPage: true }); await p.close(); continue;
    }
    if (m.data) {   // ca hiển thị: chỉ laptop đang dừng, 13 việc chưa có máy
      const d = await p.evaluate(() => { const pn = document.querySelector("#pane-maytram"), khoi = pn.querySelector(".mt-chua");
        return { t: pn.innerText, ly: [...pn.querySelectorAll(".hx-mt-ly .ly")].map((x) => x.textContent), nhan: pn.querySelectorAll(".hx-mt-ly .hx-tag").length, caoKhoi: khoi ? Math.round(khoi.getBoundingClientRect().height) : 0 }; });
      ok(!/chuyển sang máy khác|sang máy khác/.test(d.t) && /Đang dừng — không nhận việc/.test(d.t), "máy dừng duy nhất: KHÔNG nói «sang máy khác»");
      ok(d.ly.length === 1 && d.ly[0] === "Chưa có PC nào đang chạy" && d.nhan === 13, "13 việc gom thành 1 lý do + 13 nhãn (" + d.ly.join(" | ") + " · " + d.nhan + ")");
      ok(!/APPSCRIPT_|TOPREVIEW_|GEMINI_/.test(d.t), "không lộ tên khoá kỹ thuật");
      const nc = await p.evaluate((sel) => { const o = {}; document.querySelectorAll(sel).forEach((d) => { const nh = d.querySelector(".mt-nh"); o[nh ? nh.textContent : "?"] = d.querySelectorAll(".mt-c,.hx-tag").length; }); return o; }, "#pane-maytram .mt-chua .ds");
      ok(nc["Nặng:"] === 7 && nc["Nhẹ:"] === 6, "Việc chưa có máy nhận: chia hàng Nặng/Nhẹ, nhãn ghi 1 lần (" + JSON.stringify(nc) + ")");
      ok(!/điểm \d/.test(d.t) && /dừng bởi bộ cài \(máy quản lý\)/.test(bc.tipPhu[0]), "thẻ gọn: «điểm», «dừng bởi» chỉ trong chú thích rê chuột");
      const tran = m.mob ? 300 : 220;   // 14/10 điện thoại: thêm 2 hàng «Nặng:/Nhẹ:» (user yêu cầu nhãn nặng nhẹ) → 285px, vẫn nửa trên màn
      ok(d.caoKhoi > 0 && d.caoKhoi < tran, "khối chưa nhận gọn (" + d.caoKhoi + "px < " + tran + ")");
      await p.screenshot({ path: path.join(RA, m.ten + ".png"), fullPage: true }); await p.close(); continue;
    }
    ok(bc.so === 2, "2 thẻ máy (" + bc.so + ")");
    ok(/PC-KHO-01/.test(bc.chu[0]) && /Đang chạy/.test(bc.chu[0]) && /RAM 62%/.test(bc.chu[0]) && /CPU 72%/.test(bc.chu[0]) && /Ổ C 8 GB/.test(bc.chu[0]), "thẻ 1: trạng thái + RAM 62% + CPU 72% + ổ C 8 GB");
    ok(/2\d giây trước/.test(bc.chu[0]) && /bản 5be3da2/.test(bc.tipPhu[0]), "thẻ 1: nhịp tim (bản code trong chú thích)");
    const c1 = bc.chip[0].join("|");
    ok(/chay:Cò canh B1\.1/.test(c1) && /cho:Tìm bằng chứng B1/.test(c1) && /dung:Canh bãi xe sáng/.test(c1), "thẻ 1: chip việc đúng màu (chạy / chờ lịch / dừng)");
    ok(/PC-KHO-02/.test(bc.chu[1]) && /Mất nhịp/.test(bc.chu[1]) && /2 giờ trước|90 phút trước/.test(bc.chu[1]) && /không khoá camera/.test(bc.chu[1]), "thẻ 2: mất nhịp + không khoá camera");
    const nb = await nhom();
    ok(nb[nb.length - 1] === "Máy trạm" && (m.quanLy || nb.length === 1), "thanh bên: Máy trạm DƯỚI CÙNG nhóm Xác minh (" + nb.join(" | ") + ")");
    await p.screenshot({ path: path.join(RA, m.ten + ".png"), fullPage: true });
    if (m.quanLy) {
      ok(bc.nut.some((n) => n.t === "Gỡ") && !/Dừng máy/.test(bc.chu[1]) && bc.nut.some((n) => n.t === "Dừng máy"), "máy quản lý: máy sống có «Dừng máy», máy mất nhịp chỉ có «Gỡ»");
      if (m.mob) ok(bc.nut.every((n) => n.h >= 40), "vùng chạm ≥40px trên điện thoại (" + bc.nut.map((n) => n.h).join(",") + ")");
      const xk = await p.evaluate(() => { const k = document.querySelector("#pane-maytram .hx-mt-xin"); return k ? k.innerText.replace(/\s+/g, " ") : ""; });
      ok(/PC-MOI-03/.test(xk) && /Mã xác nhận 7F3A/.test(xk) && /Duyệt/.test(xk) && /Từ chối/.test(xk), "khối PC xin khoá: tên máy + mã xác nhận + Duyệt/Từ chối");
      await p.click('#pane-maytram button[data-xin="PC-MOI-03"][data-dongy="1"]'); await new Promise((r) => setTimeout(r, 1200));
      const dk = post.find((x) => /duyet-khoa/.test(x.url)), od = dk ? JSON.parse(dk.body) : {};
      ok(od.may === "PC-MOI-03" && od.dongY === true, "bấm Duyệt → lệnh {PC-MOI-03, đồng ý}");
      hoi.length = 0; await p.click('#pane-maytram .mt-x[data-viec="canh-b11"]'); await new Promise((r) => setTimeout(r, 1200));
      const bd = post.find((x) => /may-tram\/lenh/.test(x.url)), o = bd ? JSON.parse(bd.body) : {};
      ok(hoi.length === 1 && /Tắt «Cò canh B1\.1» trên PC-KHO-01/.test(hoi[0]), "bấm × trên chip việc → hỏi lại trước khi tắt (" + (hoi[0] || "không hỏi") + ")");
      ok(o.may === "PC-KHO-01" && o.viec === "canh-b11" && o.dung === true, "đồng ý → lệnh {PC-KHO-01, canh-b11, dừng}");
    } else {
      ok(goiDN === 2 && goiBang > 0, "điện thoại: đăng nhập 1 lần ở hệ tài khoản → dữ liệu qua Apps Script, không hỏi lần 2 (đăng nhập " + goiDN + " · bảng " + goiBang + ")");
      ok(!(await p.$("#mtDnForm")) && !(await p.$("#mtDangXuat")), "không còn ô đăng nhập / nút đăng xuất riêng của Máy trạm");
      ok(bc.nut.length === 0 && !(await p.$("#pane-maytram .mt-x")) && !(await p.$("#pane-maytram .hx-mt-xin")), "điện thoại: chip/nút chỉ xem, KHÔNG điều khiển, KHÔNG khối duyệt khoá");
      const lenhMT = post.filter((x) => /may-tram\/(lenh|duyet-khoa)|"action":"pc(Lenh|DuyetKhoa)"/.test(x.url + " " + (x.body || "")));   // chỉ lệnh ĐIỀU KHIỂN máy trạm (module khác gọi GAS không tính)
      ok(!lenhMT.length, "điện thoại: không gửi lệnh điều khiển máy trạm nào" + (lenhMT.length ? " — CÓ: " + post.map((x) => x.url.replace(/\?.*/, "").slice(-40) + " " + String(x.body || "").slice(0, 60)).join(" ; ") : ""));
      await p.evaluate(() => { window.TK.nguoi = null; window.TK.phien = ""; document.dispatchEvent(new CustomEvent("tk-doi")); }); await new Promise((r) => setTimeout(r, 800));
      ok(!!(await p.$("#mtMoTk")) && !(await p.$("#pane-maytram .mt-o")), "đăng xuất hệ tài khoản → Máy trạm khoá lại ngay");
    }
    await p.close();
  }
} finally { await b.close(); }
console.log(loi ? `\n${loi} ca HỎNG` : "\nĐẠT tất cả"); process.exit(loi ? 1 : 0);
