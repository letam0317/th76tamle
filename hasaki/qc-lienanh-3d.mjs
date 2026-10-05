/**
 * qc-lienanh-3d.mjs — BỘ ĐO cho kiemsoatkho/lienanh-3d.html (công cụ bố trí kho Liên Anh, 05/10/2026).
 *
 *   node hasaki/qc-lienanh-3d.mjs [--url http://localhost:8123/kiemsoatkho/lienanh-3d.html]
 *
 * Mẫu theo qc-kho170-3d.mjs: Edge headless + swiftshader, bấm/kéo THẬT bằng chuột (không gọi hàm tắt khi đo tương tác),
 * CHẶN lệnh ghi (fetch giả) để không đụng lienanh-bocuc.js thật — bộ đo này cũng chạy giữa lúc bấm Chốt.
 * Sự thật gốc đọc THẲNG lienanh-thongso.js + lienanh-bocuc-goc.js qua vm (trang không tự khai).
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const EDGE = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe"].find((p) => fs.existsSync(p));
const argv = process.argv.slice(2);
const iU = argv.indexOf("--url");
const URL_DO = iU >= 0 ? argv[iU + 1] : "http://localhost:8123/kiemsoatkho/lienanh-3d.html";
const HTML = fs.readFileSync(path.join(DIR, "kiemsoatkho", "lienanh-3d.html"), "utf8");

function goc() {
  const w = {}; const ctx = vm.createContext({ window: w, globalThis: w, module: undefined });
  ["lienanh-thongso.js", "lienanh-luat.js", "lienanh-xuat.js", "lienanh-bocuc-goc.js"].forEach((f) => vm.runInContext(fs.readFileSync(path.join(DIR, "kiemsoatkho", f), "utf8"), ctx, { filename: f }));
  const X = w.LIENANH_XUAT, N = X.nha(w.LIENANH_TS, {});
  const coBocuc = fs.existsSync(path.join(DIR, "kiemsoatkho", "lienanh-bocuc.js"));
  return { X, N, khu: w.LIENANH_GOC.khu.length, vat: w.LIENANH_GOC.vat.length, luat: w.LIENANH_LUAT.luat.length, coBocuc, G: w.LIENANH_GOC, TS: w.LIENANH_TS, LUAT: w.LIENANH_LUAT };
}
const ok = [], loi = [];
const bao = (d, t, c) => (d ? ok : loi).push(`${d ? "ĐẠT " : "LỖI "} · ${t}${c ? " — " + c : ""}`);
const cho = (ms) => new Promise((x) => setTimeout(x, ms));

(async () => {
  if (!EDGE) { console.error("Không thấy msedge.exe."); process.exit(2); }
  const G = goc();
  console.log(`GỐC (lienanh-thongso + bocuc-goc): ${G.N.HX}×${G.N.HZ} m · trục ${G.N.X.length}/${G.N.Z.length} · cột ${G.N.cot.length} · khu ${G.khu} · món ${G.vat} · luật ${G.luat}${G.coBocuc ? " · CÓ lienanh-bocuc.js (số món có thể khác gốc)" : ""}\n`);
  bao(G.N.ok && G.N.tongX === 108000 && G.N.tongZ === 80000, "chuỗi kích thước tự cộng = 108 000 × 80 000 mm", G.N.tongX + " × " + G.N.tongZ);
  bao(G.N.X.length === 20 && G.N.Z.length === 14 && G.N.X.some((x) => Math.abs(x - 54.32) < 1e-6), "20 trục x (có khe lún 54,32) · 14 trục z", G.N.X.length + "/" + G.N.Z.length);
  /* luật tĩnh về mã nguồn */
  const fetchKhongTran = (HTML.match(/fetch\(/g) || []).length - (HTML.match(/fetch\([^;]*?(signal|AbortSignal)/g) || []).length;
  bao(fetchKhongTran === 0, "mọi fetch() trong html có trần thời gian (AbortController/AbortSignal)", fetchKhongTran + " fetch không trần");
  bao(!/(rx:\s*[-\d]|khu:'(sac|vp|gd1)')/.test(HTML.replace(/\/\*[\s\S]*?\*\//g, "")), "html không chứa bố cục nội tuyến (bố cục chỉ ở lienanh-bocuc*.js gitignore)");
  const emoji = HTML.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}]/gu) || [];
  bao(emoji.length === 0, "không icon emoji trong html (bộ chuẩn §6)", emoji.join(" "));

  const br = await puppeteer.launch({ headless: "new", executablePath: EDGE, args: ["--no-sandbox", "--disable-dev-shm-usage", "--enable-unsafe-swiftshader", "--use-gl=swiftshader"], protocolTimeout: 240000 });
  const p = await br.newPage();
  const loiTrang = [];
  p.on("pageerror", (e) => loiTrang.push(String(e).slice(0, 160)));
  p.on("console", (c) => { if (c.type() === "error" && !/404/.test(c.text())) loiTrang.push("console: " + c.text().slice(0, 160)); });
  p.on("dialog", (d) => d.accept());
  await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await p.goto(URL_DO, { waitUntil: "domcontentloaded", timeout: 60000 });
  let san = true;
  try { await p.waitForFunction("(" + (() => window.__SAN_SANG === true) + ")()", { timeout: 60000 }); } catch (e) { san = false; }
  if (!san) {
    const e = await p.evaluate(() => document.getElementById("errT").textContent);
    bao(false, "trang dựng được mô hình", e || "quá giờ chờ __SAN_SANG");
  } else {
    bao(true, "trang dựng được mô hình (__SAN_SANG)");
    /* CHẶN ghi thật — trước mọi thao tác */
    await p.evaluate(() => { const f0 = window.fetch; window.__ghiGia = 0; window.__chotGia = 0;
      window.fetch = (u, o) => { if (/\/api\/3d\/lienanh\/bocuc/.test(u)) { window.__ghiGia++; return Promise.resolve(new Response('{"ok":true}')); }
        if (/\/api\/3d\/lienanh\/chot/.test(u) && o && o.method === "POST") { window.__chotGia++; return Promise.resolve(new Response('{"ok":true}')); }
        if (/\/api\/3d\/lienanh\/chot/.test(u)) return Promise.resolve(new Response('{"chay":false,"xong":false}'));
        return f0(u, o); }; });
    await cho(2500);
    const d = await p.evaluate(() => { const LA = window.LA; return {
      HX: LA.N.HX, HZ: LA.N.HZ, cot: LA.N.cot.length, khu: LA.KHU.length, vat: LA.VAT.length, sorters: LA.SORTERS.length,
      suaBat: window.LA.SUA.bat, buoc: window.LA.SUA.buoc, ortho: LA.CAM.o.ortho, phi: LA.CAM.o.phi, mode: LA.CAM.o.mode,
      gocChildren: LA.GOC.children.length, khuG: Object.keys(LA.KHU_G).length, vatG: Object.keys(LA.VAT_G).length,
      datK: window.__sua.khuDat().length, datV: window.__sua.vatDat().length, khay: LA.KHU.filter((k) => k.trongKhay).length, khayDong: document.querySelectorAll("#khay [data-khay]").length,
      loi: window.__sua.LOI.filter((l) => l.muc === "loi").length, canhBao: window.__sua.LOI.filter((l) => l.muc !== "loi").length,
      sorterChildren: LA.SORTERS[0] ? LA.SORTERS[0].g.children[0].children.length : 0,
      dtKhu: LA.KHU.map((k) => [k.id, LA.X.dienTich(k), +(k.w * k.d).toFixed(1)]),
      tieu: document.getElementById("tieu").textContent, hangKhuAn: document.getElementById("hangKhu").style.display === "none",
      sua: !document.getElementById("sua").hidden, chuoi: document.getElementById("tsChuoi").textContent }; });
    bao(d.HX === 108 && d.HZ === 80 && d.cot === 100, "khổ nhà 108×80, 100 cột (20 trục × 4 hàng + cột tường bên)", d.HX + "×" + d.HZ + " · " + d.cot + " cột");
    bao(G.coBocuc ? d.khu >= 1 && d.vat >= 1 : d.khu === G.khu && d.vat === G.vat, "số khu / món = tệp bố cục gốc", d.khu + " khu · " + d.vat + " món (gốc " + G.khu + "/" + G.vat + ")");
    bao(d.khuG === d.datK && d.vatG === d.datV && d.gocChildren === d.datK + d.datV, "chỉ khu ĐÃ ĐẶT + món của nó mới dựng; mỗi cái = 1 nhóm trong GOC", d.gocChildren + " nhóm · đặt " + d.datK + " khu / " + d.datV + " món");
    bao(d.datK === 1 && d.khay === d.khu - 1 && d.khayDong === d.khay && /0 khu đã đặt/.test(d.tieu), "mở lần đầu: mặt bằng TRỐNG (chỉ cửa/dock gắn tường), " + d.khay + " khối nằm trong khay", d.tieu);
    bao(d.suaBat && d.sua && d.buoc === 1 && d.hangKhuAn, "localhost: bộ sửa tự bật ở Bước 1 (khu vực), hàng chọn khu ẩn");
    bao(d.ortho === true && d.phi < 0.05 && d.mode === "map", "vào sửa: nhìn thẳng từ trên, trực giao, điều khiển kiểu bản đồ", "ortho " + d.ortho + " · phi " + d.phi.toFixed(3) + " · " + d.mode);
    bao(d.loi === 0, "bố cục khởi tạo 0 LỖI luật", d.loi + " lỗi · " + d.canhBao + " cảnh báo");
    bao(d.dtKhu.every((q) => q[1] === q[2]), "diện tích mọi khu = rộng × sâu (làm tròn 0,1)", d.dtKhu.filter((q) => q[1] !== q[2]).map((q) => q[0]).join(","));
    bao(/108[.\s  ]?000 mm/.test(d.chuoi) && /80[.\s  ]?000 mm/.test(d.chuoi), "bảng Số liệu nhà hiện chuỗi + tổng", d.chuoi.slice(0, 80));

    /* ── KHAY KHỐI: kéo dòng "sac" từ khay thả xuống mặt bằng, rồi kéo "xetay" đè lên → đỏ; Xếp theo bản mẫu; Cất vào khay ── */
    const dich = await p.evaluate(() => { const P = new THREE.Vector3(40, 0, 40).project(window.LA.CAM.cam()); const el = document.querySelector('#khay [data-khay="sac"]'); el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect();
      return { x: (P.x + 1) / 2 * innerWidth, y: (1 - P.y) / 2 * innerHeight, rx: r.left + 40, ry: r.top + r.height / 2 }; });
    await p.mouse.move(dich.rx, dich.ry); await p.mouse.down(); for (let i = 1; i <= 12; i++) await p.mouse.move(dich.rx + (dich.x - dich.rx) * i / 12, dich.ry + (dich.y - dich.ry) * i / 12); await p.mouse.up(); await cho(1000);
    const th1 = await p.evaluate(() => { const k = window.LA.KHU.find((q) => q.id === "sac"); return { khay: k.trongKhay, x: k.x, z: k.z, g: !!window.LA.KHU_G.sac, con: window.LA.VAT.filter((v) => v.khu === "sac").filter((v) => window.LA.VAT_G[v.id]).length, soKhay: window.LA.KHU.filter((q) => q.trongKhay).length, de: window.__sua.deKhu(k).length }; });
    bao(!th1.khay && th1.g && th1.con === 9 && Math.abs(th1.x + 3 - 40) <= 0.6 && Math.abs(th1.z + 5 - 40) <= 0.6 && th1.soKhay === 18 && th1.de === 0, "kéo dòng 'Sạc xe nâng' từ khay thả vào (40, 40) ⇒ khu + 9 món dựng tại chỗ thả, khay còn 18", JSON.stringify(th1));
    const dich2 = await p.evaluate(() => { const el = document.querySelector('#khay [data-khay="xetay"]'); el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect(); return { rx: r.left + 40, ry: r.top + r.height / 2 }; });
    await p.mouse.move(dich2.rx, dich2.ry); await p.mouse.down(); for (let i = 1; i <= 12; i++) await p.mouse.move(dich2.rx + (dich.x - dich2.rx) * i / 12, dich2.ry + (dich.y - dich2.ry) * i / 12); await p.mouse.up(); await cho(1000);
    const th2 = await p.evaluate(() => { const k = window.LA.KHU.find((q) => q.id === "xetay"); return { de: window.__sua.deKhu(k), l11: window.__sua.LOI.filter((l) => l.ma === "L11" && l.muc === "loi").length, tt: document.getElementById("suaTt").textContent, hopMau: window.__sua.hop ? window.__sua.hop.material.color.getHex() : 0, do: window.__sua.LOI.filter((l) => l.muc === "loi").length }; });
    bao(th2.de.length === 1 && th2.l11 >= 1 && th2.hopMau === 0xdc2626 && /ĐÈ LÊN/.test(th2.tt), "thả 'Trữ xe nâng tay' đè lên khu sạc ⇒ khung ĐỎ + dòng 'ĐÈ LÊN' (giữ cả sau khi lưu) + luật L11 lỗi", th2.de.join() + " · L11 " + th2.l11 + " · khung #" + th2.hopMau.toString(16) + " · " + th2.tt.slice(0, 60));
    await p.click("#suaMau"); await cho(2500);
    const mau = await p.evaluate(() => ({ dat: window.__sua.khuDat().filter((k) => !k.anSan).length, khay: window.LA.KHU.filter((k) => k.trongKhay).length, loi: window.__sua.LOI.filter((l) => l.muc === "loi").length, sorters: window.LA.SORTERS.length,
      sorterChildren: window.LA.SORTERS[0] ? window.LA.SORTERS[0].g.children[0].children.length : 0, sac: (window.LA.KHU.find((q) => q.id === "sac") || {}).x }));
    bao(mau.dat === 19 && mau.khay === 0 && mau.loi === 0 && mau.sac === 18, "nút 'Xếp theo bản mẫu' ⇒ 19 khu đặt đúng toạ độ mẫu, khay rỗng, 0 lỗi", JSON.stringify(mau));
    bao(mau.sorters === 1 && mau.sorterChildren > 300, "sorter là 1 món, dựng nguyên khối (ring + xe + máng + lồng + line nạp)", mau.sorterChildren + " phần");
    const cat = await p.evaluate(() => { window.__sua.catKhay("vp"); return { khay: window.LA.KHU.filter((k) => k.trongKhay).map((k) => k.id).join(), g: !!window.LA.KHU_G.vp, con: !!window.LA.VAT_G["vp-ql-1"], dong: document.querySelectorAll("#khay [data-khay]").length }; });
    bao(cat.khay === "vp" && !cat.g && !cat.con && cat.dong === 1, "'Cất vào khay' ⇒ khu + đồ bên trong rời mặt bằng, khay có 1 dòng", JSON.stringify(cat));
    await p.keyboard.down("Control"); await p.keyboard.press("KeyZ"); await p.keyboard.up("Control"); await cho(900);
    const cat2 = await p.evaluate(() => ({ khay: window.LA.KHU.filter((k) => k.trongKhay).length, g: !!window.LA.KHU_G.vp, con: !!window.LA.VAT_G["vp-ql-1"] }));
    bao(cat2.khay === 0 && cat2.g && cat2.con, "Ctrl+Z sau khi cất ⇒ khu quay lại mặt bằng", JSON.stringify(cat2));
    await p.evaluate(() => { window.__ghiGia = 0; });
    /* ── kéo KHU thật bằng chuột: khu + mọi con dời đúng Δ, camera đứng yên ── */
    const viTriKhu = (id) => p.evaluate((id) => { const k = window.LA.KHU.find((q) => q.id === id); const P = new THREE.Vector3(k.x + k.w / 2, 0, k.z + k.d / 2).project(window.LA.CAM.cam());
      const con = window.LA.VAT.filter((v) => v.khu === id).map((v) => [v.id, +window.LA.VAT_G[v.id].position.x.toFixed(2), +window.LA.VAT_G[v.id].position.z.toFixed(2)]);
      return { x: (P.x + 1) / 2 * innerWidth, y: (1 - P.y) / 2 * innerHeight, kx: k.x, kz: k.z, w: k.w, d: k.d, con, cam: [window.LA.CAM.o.theta, window.LA.CAM.o.target.x, window.LA.CAM.o.target.z].join() }; }, id);
    const k0 = await viTriKhu("sac");
    await p.mouse.move(k0.x, k0.y); await p.mouse.down(); for (let i = 1; i <= 10; i++) await p.mouse.move(k0.x + i * 5, k0.y + i * 5); await p.mouse.up(); await cho(1000);
    const k1 = await viTriKhu("sac");
    const dX = k1.kx - k0.kx, dZ = k1.kz - k0.kz;
    const conTheo = k1.con.every((c, i) => Math.abs(c[1] - k0.con[i][1] - dX) < 0.011 && Math.abs(c[2] - k0.con[i][2] - dZ) < 0.011);
    bao((dX !== 0 || dZ !== 0) && conTheo && k1.cam === k0.cam && k0.con.length >= 5, "Bước 1: kéo chuột trúng khu ⇒ khu dời, " + k0.con.length + " món bên trong dời đúng Δ, camera đứng yên", `Δ (${dX}, ${dZ}) · con theo ${conTheo}`);
    let ghi1 = 0; try { await p.waitForFunction("(" + (() => window.__ghiGia >= 1) + ")()", { timeout: 6000 }); ghi1 = await p.evaluate(() => window.__ghiGia); } catch (e) {}
    bao(ghi1 >= 1, "mỗi thay đổi tự gửi lệnh lưu (POST /api/3d/lienanh/bocuc, trì hoãn 0,7 s)", ghi1 + " lần");
    const loiKeo = await p.evaluate(() => window.__sua.LOI.filter((l) => l.muc === "loi").map((l) => l.ma));
    bao(loiKeo.length > 0, "kéo khu sạc đè kệ GĐ2 ⇒ luật báo LỖI ngay khi kéo (DE / L09)", [...new Set(loiKeo)].join(","));
    await p.keyboard.down("Control"); await p.keyboard.press("KeyZ"); await p.keyboard.up("Control"); await cho(900);
    const k2 = await viTriKhu("sac");
    bao(k2.kx === k0.kx && k2.kz === k0.kz && k2.con.every((c, i) => c[1] === k0.con[i][1] && c[2] === k0.con[i][2]), "Ctrl+Z: khu + con về đúng chỗ cũ", [k2.kx, k2.kz].join());

    /* ── nới khu bằng tay nắm phải, rồi Thu vừa khít ── */
    await p.evaluate(() => window.__sua.chonMon("khu", "xetay"));
    await cho(300);
    const tay = await p.evaluate(() => { const k = window.LA.KHU.find((q) => q.id === "xetay"); const P = new THREE.Vector3(k.x + k.w, 0, k.z + k.d / 2).project(window.LA.CAM.cam()); return { x: (P.x + 1) / 2 * innerWidth, y: (1 - P.y) / 2 * innerHeight, w: k.w, dt: window.LA.X.dienTich(k) }; });
    await p.mouse.move(tay.x, tay.y); await p.mouse.down(); for (let i = 1; i <= 8; i++) await p.mouse.move(tay.x + i * 6, tay.y); await p.mouse.up(); await cho(900);
    const noi = await p.evaluate(() => { const k = window.LA.KHU.find((q) => q.id === "xetay"); return { w: k.w, dt: window.LA.X.dienTich(k), nhan: document.getElementById("suaMon").textContent }; });
    bao(noi.w > tay.w && noi.dt > tay.dt && noi.dt === +(noi.w * 14).toFixed(1), "kéo tay nắm phải ⇒ khu rộng ra, m² cập nhật đúng", tay.w + " → " + noi.w + " m · " + noi.dt + " m²");
    await p.evaluate(() => window.__sua.thuKhit()); await cho(600);
    const khit = await p.evaluate(() => { const k = window.LA.KHU.find((q) => q.id === "xetay"); const km = window.LA.X.khuMap(window.LA.KHU); const bs = window.LA.VAT.filter((v) => v.khu === "xetay").map((v) => window.LA.X.vetVat(v, km, window.LA.GIA));
      const x0 = Math.min(...bs.map((b) => b.x)), x1 = Math.max(...bs.map((b) => b.x + b.w)); return { w: k.w, x: k.x, x0, x1, loi: window.__sua.LOI.filter((l) => l.muc === "loi").length }; });
    bao(Math.abs(khit.x - (khit.x0 - 0.5)) < 0.011 && Math.abs(khit.x + khit.w - (khit.x1 + 0.5)) < 0.011, "Thu vừa khít: khu = bao đồ bên trong + lề 0,5 m", khit.w + " m");
    await p.keyboard.down("Control"); await p.keyboard.press("KeyZ"); await p.keyboard.press("KeyZ"); await p.keyboard.up("Control"); await cho(900);
    const kh3 = await p.evaluate(() => window.LA.KHU.find((q) => q.id === "xetay").w);
    bao(kh3 === tay.w, "hoàn tác 2 bước ⇒ khu về bề rộng cũ", kh3 + " m");

    /* ── Bước 2: vào khu, kéo món, chặn ra ngoài biên ── */
    await p.evaluate(() => window.__sua.datBuoc(2, "xetay")); await cho(1200);
    const v0 = await p.evaluate(() => { const v = window.LA.VAT.find((q) => q.id === "xnt-1"); const g = window.LA.VAT_G[v.id]; const P = g.position.clone().setY(0.3).project(window.LA.CAM.cam());
      return { x: (P.x + 1) / 2 * innerWidth, y: (1 - P.y) / 2 * innerHeight, rx: v.rx, rz: v.rz, buoc: window.LA.SUA.buoc, khu: window.LA.SUA.khu }; });
    bao(v0.buoc === 2 && v0.khu === "xetay", "Bước 2: vào khu xetay, camera bay nhìn thẳng khu");
    await p.mouse.move(v0.x, v0.y); await p.mouse.down(); for (let i = 1; i <= 6; i++) await p.mouse.move(v0.x + i * 4, v0.y + i * 3); await p.mouse.up(); await cho(800);
    const v1 = await p.evaluate(() => { const v = window.LA.VAT.find((q) => q.id === "xnt-1"); return { rx: v.rx, rz: v.rz }; });
    bao(v1.rx !== v0.rx || v1.rz !== v0.rz, "Bước 2: kéo chuột trúng xe nâng tay ⇒ món dời", [v0.rx, v0.rz] + " → " + [v1.rx, v1.rz]);
    /* kéo RẤT xa ra ngoài khu → bị chặn trong biên */
    await p.mouse.move(v0.x + 24, v0.y + 18); await p.mouse.down(); for (let i = 1; i <= 30; i++) await p.mouse.move(v0.x + 24 - i * 25, v0.y + 18); await p.mouse.up(); await cho(800);
    const v2 = await p.evaluate(() => { const v = window.LA.VAT.find((q) => q.id === "xnt-1"); const k = window.LA.KHU.find((q) => q.id === "xetay"); const b = window.LA.X.vetVat(v, window.LA.X.khuMap(window.LA.KHU), window.LA.GIA); return { trong: window.LA.X.trong(b, window.LA.X.vetKhu(k), 0.02), rx: v.rx }; });
    bao(v2.trong, "kéo món ra ngoài biên khu (không Alt) ⇒ bị giữ trong khu", "rx " + v2.rx);
    await p.keyboard.press("KeyR"); await cho(300);
    const xo = await p.evaluate(() => window.LA.VAT.find((q) => q.id === "xnt-1").xoay);
    bao(xo === 90, "phím R xoay món 90°", "xoay " + xo);
    const nb = await p.evaluate(async () => { const S = window.__sua; const n0 = window.LA.VAT.length; await new Promise((x) => setTimeout(x, 100)); S.nhanBan(); const n1 = window.LA.VAT.length; S.xoa(); const n2 = window.LA.VAT.length; S.hoanTac(); S.hoanTac(); const n3 = window.LA.VAT.length; return { n0, n1, n2, n3 }; });
    bao(nb.n1 === nb.n0 + 1 && nb.n2 === nb.n0 && nb.n3 === nb.n0, "Nhân bản → Xoá → Hoàn tác đúng số món", JSON.stringify(nb));
    const them = await p.evaluate(() => { const S = window.__sua; const n0 = window.LA.VAT.length; S.them("locker"); const v = window.LA.VAT[window.LA.VAT.length - 1]; const r = { n: window.LA.VAT.length - n0, khu: v.khu, loai: v.loai }; S.xoa(); return r; });
    bao(them.n === 1 && them.khu === "xetay" && them.loai === "locker", "Thêm món ở Bước 2 tự gán vào khu đang sửa", JSON.stringify(them));

    /* ── dãy kệ: kéo tay nắm đầu dãy = thêm/bớt bay ── */
    await p.evaluate(() => window.__sua.datBuoc(2, "gd1")); await cho(1200);
    await p.evaluate(() => window.__sua.chonMon("vat", "gd1-1")); await cho(300);
    const ke0 = await p.evaluate(() => { const v = window.LA.VAT.find((q) => q.id === "gd1-1"); const c = window.LA.X.tuyetDoi(v, window.LA.X.khuMap(window.LA.KHU)); const k = window.LA.X.kichThuocKe(v, window.LA.GIA); const P = new THREE.Vector3(c.x + k.L / 2, 0.5, c.z).project(window.LA.CAM.cam()); return { x: (P.x + 1) / 2 * innerWidth, y: (1 - P.y) / 2 * innerHeight, n: v.nBay }; });
    await p.mouse.move(ke0.x, ke0.y); await p.mouse.down(); for (let i = 1; i <= 8; i++) await p.mouse.move(ke0.x - i * 8, ke0.y); await p.mouse.up(); await cho(900);
    const ke1 = await p.evaluate(() => window.LA.VAT.find((q) => q.id === "gd1-1").nBay);
    bao(ke1 < ke0.n, "kéo tay nắm đầu dãy kệ vào trong ⇒ bớt bay", ke0.n + " → " + ke1 + " bay");
    await p.keyboard.down("Control"); await p.keyboard.press("KeyZ"); await p.keyboard.up("Control"); await cho(600);

    /* ── luật bắt lỗi cố ý + chặn Chốt ── */
    const coY = await p.evaluate(() => { const S = window.__sua; const truoc = S.luat().loi; const v = window.LA.VAT.find((q) => q.id === "gd1-2"); const rz = v.rz; v.rz = 28.75 - 3.3; const l = S.luat(); const ma = S.LOI.filter((q) => q.muc === "loi").map((q) => q.ma + ":" + q.a + "|" + q.b);
      const chotTat = document.getElementById("suaChot").disabled; document.getElementById("suaChot").click(); const goi = window.__chotGia; v.rz = rz; const sau = S.luat().loi; const x1 = window.LA.VAT.find((q) => q.id === "xnt-1");
      return { truoc, loi: l.loi, ma, chotTat, goi, sau, xnt: [x1.rx, x1.rz, x1.xoay] }; });
    bao(coY.loi > coY.truoc && coY.ma.some((m) => /^L01:gd1-1\|gd1-2/.test(m)), "cố ý kéo kệ GĐ1-2 sát GĐ1-1 (lối 1,0 m) ⇒ L01 đúng cặp", coY.ma.slice(0, 3).join(" ; ") + " · xnt-1 " + coY.xnt);
    bao(coY.chotTat && coY.goi === 0 && coY.sau === coY.truoc, "còn LỖI ⇒ nút Chốt tắt, bấm không gửi lệnh; sửa lại ⇒ số lỗi về như trước", "chốt tắt " + coY.chotTat + " · gửi " + coY.goi + " · lỗi " + coY.truoc + "→" + coY.sau);
    const cua = await p.evaluate(() => { const S = window.__sua; const n = { id: "qc-locker", loai: "locker", khu: "stg-duoi", rx: 1.2, rz: 7, xoay: 90, w: 1.5, d: 0.45 }; window.LA.VAT.push(n); S.luat(); const ma = S.LOI.filter((q) => q.muc === "loi").map((q) => q.ma); window.LA.VAT.pop(); S.luat(); return ma; });
    bao(cua.includes("L06"), "locker đặt trước cửa xuất ⇒ L06", cua.join(","));

    /* ── xuất SVG / DXF / PNG ── */
    const xuat = await p.evaluate(async () => { const S = window.__sua; const svg = S.svg(), dxf = S.dxf(); const dom = new DOMParser().parseFromString(svg, "image/svg+xml");
      const png = await S.png(); const d = window.LA.X.docDxf(dxf);
      return { svgKhu: dom.querySelectorAll("polygon.KHU").length, svgM2: [...dom.querySelectorAll("text.KHUCHU")].filter((t) => /m²/.test(t.textContent)).length, viewBox: dom.documentElement.getAttribute("viewBox"), khu: window.__sua.khuDat().filter((k) => !k.anSan).length,
        dxfKhu: (d.theoLop["LA-KHU"] || {}).LWPOLYLINE || 0, dxfTrung: d.trung, dxfAscii: !d.nonAscii, dxfEOF: d.coEOF, dxfM2: /m\\U\+00B2/.test(dxf), pngKb: Math.round(png.length * 3 / 4 / 1024), pngOk: png.startsWith("data:image/png") }; });
    bao(xuat.svgKhu === xuat.khu && xuat.svgM2 === xuat.khu && /^-10 -12/.test(xuat.viewBox), "SVG: mỗi khu 1 polygon vàng + 1 dòng m², viewBox đúng", xuat.svgKhu + "/" + xuat.khu + " · " + xuat.viewBox);
    bao(xuat.dxfKhu === xuat.khu && xuat.dxfTrung === 0 && xuat.dxfAscii && xuat.dxfEOF && xuat.dxfM2, "DXF: LA-KHU = số khu, không trùng handle, ASCII, có m\\U+00B2, có EOF", xuat.dxfKhu + "/" + xuat.khu);
    bao(xuat.pngOk && xuat.pngKb > 50, "PNG chụp trực giao > 50 kB", xuat.pngKb + " kB");

    /* ── đổi trạm sorter ⇒ vết đổi, L08 cảnh báo ── */
    const tram = await p.evaluate(async () => { const km = window.LA.X.khuMap(window.LA.KHU); const s = window.LA.VAT.find((v) => v.loai === "sorter"); const h0 = window.LA.X.vetVat(s, km, window.LA.GIA).h; document.getElementById("bTram").click(); await new Promise((x) => setTimeout(x, 1500));
      const h1 = window.LA.X.vetVat(s, km, window.LA.GIA).h; const l8 = window.__sua.LOI.filter((q) => q.ma === "L08").length; document.getElementById("bTram").click(); await new Promise((x) => setTimeout(x, 800)); return { h0, h1, l8, tram: s.tram }; });
    bao(tram.h1 > tram.h0 && tram.l8 > 0 && tram.tram === "cage", "nút Trạm: người xếp ⇒ vết sorter rộng hơn, L08 cảnh báo sát cột; bấm lại về lồng", tram.h0 + " → " + tram.h1 + " m · L08 " + tram.l8);
    bao(loiTrang.length === 0, "console sạch (máy tính)", loiTrang.slice(0, 2).join(" | "));
    await p.close();

    /* ── điện thoại 390×844 ── */
    const q = await br.newPage(); await q.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const loiDT = []; q.on("pageerror", (e) => loiDT.push(String(e).slice(0, 120)));
    await q.goto(URL_DO, { waitUntil: "domcontentloaded", timeout: 60000 });
    try { await q.waitForFunction("(" + (() => window.__SAN_SANG === true) + ")()", { timeout: 60000 }); } catch (e) {}
    await q.evaluate(() => { window.fetch = (u) => /lienanh\/(bocuc|chot)/.test(u) ? Promise.resolve(new Response('{"ok":true,"chay":false}')) : Promise.reject(new Error("chặn")); });
    await cho(2000);
    const dt = await q.evaluate(() => { const r = document.getElementById("sua").getBoundingClientRect(); const nho = [...document.querySelectorAll("#sua button, #ui button, #vc button")].filter((b) => b.offsetParent && b.getBoundingClientRect().height < 40).map((b) => b.textContent.trim().slice(0, 12));
      return { ngang: document.documentElement.scrollWidth - innerWidth, suaCao: Math.round(r.height), vh45: Math.round(innerHeight * 0.45), nho, mmAn: getComputedStyle(document.getElementById("mmBox")).display === "none", san: window.__SAN_SANG === true }; });
    bao(dt.san, "điện thoại: trang dựng được");
    bao(dt.ngang <= 0, "điện thoại: không kéo ngang", dt.ngang + "px");
    bao(dt.suaCao <= dt.vh45 + 1 && dt.mmAn, "điện thoại: bảng bố trí ≤ 45vh, bản đồ nhỏ ẩn", dt.suaCao + "/" + dt.vh45 + "px");
    bao(dt.nho.length === 0, "điện thoại: mọi nút nhìn thấy ≥ 40px", dt.nho.join(", "));
    bao(loiDT.length === 0, "console sạch (điện thoại)", loiDT.slice(0, 2).join(" | "));
    await q.close();
  }
  await br.close();
  console.log(ok.join("\n"));
  if (loi.length) { console.log("\n" + "-".repeat(64) + "\n" + loi.join("\n") + "\n" + "-".repeat(64)); console.log(`\nKẾT QUẢ: ${ok.length} đạt · ${loi.length} LỖI`); process.exit(1); }
  console.log(`\nKẾT QUẢ: ĐẠT toàn bộ ${ok.length} ca.`);
})();
