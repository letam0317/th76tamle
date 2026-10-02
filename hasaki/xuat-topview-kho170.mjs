#!/usr/bin/env node
/* xuat-topview-kho170.mjs — chụp ẢNH NHÌN TỪ TRÊN XUỐNG (trực giao, tĩnh) của mô phỏng 3D kho 170
 * cho màn "Planogram" (mặt bằng) ở tab Planogram — user 28/09: "đổi Mặt bằng thật thành topview của
 * mô phỏng 3D, nhưng không có hoạt ảnh".
 *
 * Chỉ ĐỌC kiemsoatkho/kho170-3d.html (mở bằng Edge headless), không sửa trang 3D. Sinh 2 tệp:
 *   kiemsoatkho/kho170-topview.webp  — ảnh nền, khung = đúng khổ nhà W × H mét (0,0 = góc trên-trái bản vẽ)
 *   kiemsoatkho/kho170-topview.js    — window.KHO170_TOPVIEW = {W,H,anh,ngay,o:[{k,x,y,w,h,loc}],khu:[…]}
 *                                      toạ độ ô LẤY TỪ MÔ HÌNH 3D (A1 hai mặt, A8 đã dời) để ô tô màu
 *                                      nằm đúng trên ảnh.
 * Sửa mô hình 3D xong → chạy lại:  node hasaki/xuat-topview-kho170.mjs [--url http://localhost:8123/kiemsoatkho/kho170-3d.html]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, "kiemsoatkho");
const EDGE = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
              "C:/Program Files/Microsoft/Edge/Application/msedge.exe"].find((p) => fs.existsSync(p));
const argv = process.argv.slice(2), iU = argv.indexOf("--url");
const URL_3D = iU >= 0 ? argv[iU + 1] : "http://localhost:8123/kiemsoatkho/kho170-3d.html";
const RONG = 2600;                                   // px bề ngang ảnh (≈ 22 px / m)

const b = await puppeteer.launch({ executablePath: EDGE, headless: "new", args: ["--ignore-gpu-blocklist"] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900 });
const loi = [];
p.on("pageerror", (e) => loi.push(e.message));
await p.goto(URL_3D, { waitUntil: "networkidle0", timeout: 90000 });
await p.waitForFunction("typeof CAM!=='undefined'&&window.GOC3D&&window.oA1&&window.oA1.length>0", { timeout: 60000 });
await new Promise((r) => setTimeout(r, 1500));

const kq = await p.evaluate((RONG) => {
  /* dừng mọi chuyển động + giấu những thứ "sống" (người, xe nâng, xe đẩy, kiện, sóng, xe tải) —
     ảnh chỉ còn phần CỐ ĐỊNH của kho */
  paused = true;
  const HX = +V("HX"), HZ = +V("HZ"), CAO = Math.round(RONG * HZ / HX);
  const an = [];
  const giau = (o) => { if (o && o.visible) { an.push(o); o.visible = false; } };
  labels.forEach(giau);
  if (roofG) giau(roofG);
  xes.forEach((x) => giau(x.g));
  if (typeof DONG !== "undefined" && DONG) {
    /* mọi đối tượng DONG giữ (người instanced, xe đẩy, sóng, kiện, xe van/tải, đèn flash) */
    const seen = new Set();
    const quet = (v, d) => { if (!v || d > 3 || seen.has(v)) return; if (typeof v !== "object") return; seen.add(v);
      if (v.isObject3D) { giau(v); return; }
      if (Array.isArray(v)) v.forEach((x) => quet(x, d + 1)); else Object.keys(v).forEach((k) => quet(v[k], d + 1)); };
    quet(DONG, 0);
  }
  if (typeof CAM !== "undefined" && CAM.boTim) CAM.boTim();
  scene.traverse((o) => { if (o.isSprite) giau(o); });
  /* tường/vách trong 3D để trong suốt (nhìn xuyên vào kho) — ảnh mặt bằng thì cần nét tường đậm */
  const tuong = [HM.wall, HM.vach].map((m) => [m, m.opacity, m.color.getHex()]);
  tuong.forEach(([m]) => { m.opacity = 1; m.color.set(0x5f6873); m.needsUpdate = true; });
  /* user 29/09 lượt 4: BỎ NỀN — giấu mặt sàn bê tông (vân + lưới), nền trắng tinh; mặt bằng tự tô nền nhà nhạt bằng SVG */
  scene.traverse((m) => { if (m.isMesh && m.material === matSan) giau(m); });
  const nenCu = scene.background; scene.background = new THREE.Color(0xffffff);
  /* nhìn thẳng xuống (-y), "lên" của ảnh = -z ⇒ ảnh: x sang phải, z đi xuống — đúng hệ toạ độ bản vẽ */
  const cam = new THREE.OrthographicCamera(0, HX, 0, -HZ, 0.1, 300);
  cam.position.set(0, 120, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0); cam.updateProjectionMatrix();
  const pr = renderer.getPixelRatio(), sz = renderer.getSize(new THREE.Vector2());
  renderer.setPixelRatio(1); renderer.setSize(RONG, CAO, false);
  /* user 29/09: mặt bằng KHÔNG đổ bóng — tắt shadow map khi chụp (phải biên dịch lại vật liệu), chụp xong trả lại */
  const bongCu = renderer.shadowMap.enabled, doiVL = () => scene.traverse((m) => { if (m.material) [].concat(m.material).forEach((q) => (q.needsUpdate = true)); });
  renderer.shadowMap.enabled = false; doiVL();
  renderer.render(scene, cam);
  renderer.shadowMap.enabled = bongCu; doiVL(); scene.background = nenCu;
  const anh = renderer.domElement.toDataURL("image/webp", 0.82);
  renderer.setPixelRatio(pr); renderer.setSize(sz.x, sz.y, false);
  an.forEach((o) => (o.visible = true));
  tuong.forEach(([m, op, c]) => { m.opacity = op; m.color.setHex(c); m.needsUpdate = true; });
  /* ô lấy thẳng từ mô hình: A1 (đã tách 2 mặt), A2, bàn A8 (đã dời) */
  const r2 = (v) => Math.round(v * 1000) / 1000;
  const o = [];
  oA1.forEach((q) => o.push({ k: "ke", x: r2(q.x), y: r2(q.y), w: r2(q.w), h: r2(q.h), loc: q.loc }));
  oA2.forEach((q) => o.push({ k: "ke", x: r2(q.x), y: r2(q.y), w: r2(q.w), h: r2(q.h), loc: q.loc }));
  const A8 = imMam.A8;
  if (A8) { const m = new THREE.Matrix4(), ps = new THREE.Vector3(), qq = new THREE.Quaternion(), sc = new THREE.Vector3();
    A8.meta.forEach((mt, i) => { A8.im.getMatrixAt(i, m); m.decompose(ps, qq, sc);
      o.push({ k: "pack", x: r2(ps.x - sc.x / 2), y: r2(ps.z - sc.z / 2), w: r2(sc.x), h: r2(sc.z), loc: mt.loc || "" }); }); }
  const khu = KHO170_SODO.khu.map((t) => ({ s: t.s, x: t.x, y: t.y }));
  /* VÙNG KHU 5S (user 29/09: trỏ vào khu = tô mờ + tên khu). k = mã khu trong mã vị trí F0-<k>-…; hình chữ nhật
     theo mô hình 3D (A1/A2/A8 = khung bao các ô) và bản vẽ (phòng). "uoc" = ranh ước lượng, chưa có nét bản vẽ. */
  const bao = (ds, le) => { const x0 = Math.min(...ds.map((q) => q.x)), y0 = Math.min(...ds.map((q) => q.y)),
    x1 = Math.max(...ds.map((q) => q.x + q.w)), y1 = Math.max(...ds.map((q) => q.y + q.h));
    return { x: r2(x0 - le), y: r2(y0 - le), w: r2(x1 - x0 + 2 * le), h: r2(y1 - y0 + 2 * le) }; };
  const hcn = (x0, x1, y0, y1) => ({ x: x0, y: y0, w: r2(x1 - x0), h: r2(y1 - y0) });
  const pk = o.filter((q) => q.k === "pack");
  const a2ChuL = () => { const duoi = oA2.filter((q) => /^F0-A2-51[56]-/.test(q.loc || "")), chinh = oA2.filter((q) => !duoi.includes(q));
    const A = bao(chinh, 0.6), B = bao(duoi, 0.6), yA = r2(A.y + A.h), yB = r2(B.y + B.h), xB1 = r2(B.x + B.w), xA1 = r2(A.x + A.w);
    return { k: "A2", ten: "Kệ lưu trữ WH", x: A.x, y: A.y, w: A.w, h: r2(yB - A.y),
      pts: [[A.x, A.y], [xA1, A.y], [xA1, yA], [xB1, yA], [xB1, yB], [B.x, yB], [B.x, yA], [A.x, yA]] }; };
  const vung = [
    Object.assign({ k: "A1", ten: "Quầy kệ A1" }, bao(oA1, 0.6)),
    /* 02/10/2026 (user): A2 = "Khu vực kệ lưu trữ WH", CHỈ ôm dãy kệ. Khung bao cũ kéo tới đáy dãy 515/516 (dọc băng chuyền,
       xuống z≈38) nên nuốt luôn 7 cụm pallet nhận PO (A9) + chia IT (A20) ⇒ vẽ hình chữ L: khối dãy chính + đuôi 515|516. */
    a2ChuL(),
    /* hàng 7 cụm pallet dưới khối A2 — PDF DC HASAKI 3D: trái "KHU VỰC NHẬN, KIỂM TRA PO" (3 cụm), phải "KHU VỰC CHIA IT" (4 cụm);
       toạ độ đo trên ảnh trực giao (cụm PO x 49,2–60,6 · cụm IT x 63,0–79,1 · z 33,5–39,4), lề 0,6 như A2 */
    Object.assign({ k: "A9", ten: "Nhận, kiểm tra PO" }, hcn(48.56, 61.22, 32.9, 40.0)),
    Object.assign({ k: "A20", ten: "Chia IT" }, hcn(62.43, 79.68, 32.9, 40.0)),
    pk.length ? Object.assign({ k: "A8", ten: "Bàn đóng gói · băng chuyền" }, bao(pk, 1.2)) : null,
    Object.assign({ k: "A5", ten: "Bàn giao ĐVVC" }, hcn(24.8, 42.0, 57.8, 62.85)),
    Object.assign({ k: "A6", ten: "Bàn quản lý · hàng hoàn" }, hcn(12.46, 24.8, 55.6, 62.85)),
    Object.assign({ k: "A10", ten: "Nhà vệ sinh" }, hcn(42.18, 46.38, 43.05, 49.05)),
    Object.assign({ k: "A3", ten: "Kệ trữ VPP" }, hcn(38.79, 41.29, 43.47, 53.03)),
    Object.assign({ k: "A4", ten: "Kho VPP · tái chế giấy", uoc: 1 }, hcn(46.4, 53.4, 43.05, 48.0)),
    Object.assign({ k: "A15", ten: "Xe nâng điện đứng" }, hcn(42.66, 46.96, 7.9, 10.81)),
    Object.assign({ k: "A14", ten: "Kiểm nhập IT Shop (Re-IT)" }, hcn(42.66, 46.96, 10.81, 17.51)),
    Object.assign({ k: "A13", ten: "Phòng họp" }, hcn(42.66, 46.96, 17.51, 23.51)),
    Object.assign({ k: "A12", ten: "Kho Clinic (SPA)" }, hcn(42.66, 46.96, 23.51, 34.71)),
    Object.assign({ k: "A11", ten: "Hàng đổi trả · IT" }, hcn(42.66, 46.96, 34.71, 39.3)),
    Object.assign({ k: "CB", ten: "Băng chuyền phân loại" }, hcn(83.4, 92.1, 8.5, 42.6)),
    Object.assign({ k: "A19", ten: "Băng chuyền xuất · bàn giao", uoc: 1 }, hcn(93.5, 106.5, 30.0, 42.85)),
    Object.assign({ k: "A16", ten: "Kho hành chánh", uoc: 1 }, hcn(108.46, 112.46, 17.65, 38.15)),
    /* kệ sát tường A1 (khung lấy từ mô hình 3D) */
    ...(window.__o5L || []).map((q) => Object.assign({ k: q.nhan, ten: q.nhan }, { x: r2(q.x - 0.15), y: r2(q.y - 0.15), w: r2(q.w + 0.3), h: r2(q.h + 0.3) })),
    /* NGOÀI NHÀ — bản vẽ DC HASAKI 6.6.dwg (bản có "BÃI XE MÁY NHÂN VIÊN"; đổi toạ độ x = X+74664,42 · z = 49308,76−Y).
       Giặt sấy chỉ có ở bản biến thể ⇒ neo theo khoảng cách tới HẦM NƯỚC. "PCCC" = khối HẦM NƯỚC (bể + bơm chữa cháy — CHƯA xác minh). */
    Object.assign({ k: "A23", ten: "Bãi xe máy nhân viên", ngoai: 1 }, hcn(54.8, 104.7, 73.5, 77.5)),
    Object.assign({ k: "A24", ten: "Phòng giặt sấy", ngoai: 1 }, hcn(42.15, 48.57, -6.5, -2.0)),
    Object.assign({ k: "PCCC", ten: "Phòng bơm PCCC · hầm nước", ngoai: 1, uoc: 1 }, hcn(75.5, 85.3, -5.7, -1.2)),
  ].filter(Boolean);
  /* khung cắt ảnh: chỉ phần NHÀ (bỏ sân bãi trống) */
  const X0 = +V("nhaX0"), X1 = +V("nhaX1"), Y0 = +V("nhaY0"), YT = +V("nhaYTrai");
  const XG = +V("nhaGiua"), YP = +V("nhaYPhai");
  const zMin = Math.min(Y0, ...vung.map((z) => z.y)) - 0.8, zMax = Math.max(YT, ...vung.map((z) => z.y + z.h)) + 0.8;
  const khung = { x: r2(X0 - 0.8), y: r2(zMin), w: r2(X1 - X0 + 1.6), h: r2(zMax - zMin) };
  /* vỏ nhà chữ L — SVG tô nền nhà nhạt dưới ảnh (ảnh nền trắng, hoà trộn multiply) */
  const nha = [[X0, Y0], [X1, Y0], [X1, YP], [XG, YP], [XG, YT], [X0, YT]].map((p) => [r2(p[0]), r2(p[1])]);
  return { W: HX, H: HZ, anh, o, khu, vung, khung, nha, px: [RONG, CAO] };
}, RONG);

await b.close();
if (loi.length) { console.error("Lỗi trang 3D:", loi.join(" | ")); process.exit(1); }
const buf = Buffer.from(kq.anh.split(",")[1], "base64");
fs.writeFileSync(path.join(OUT, "kho170-topview.webp"), buf);
const du = { nguon: "kho170-3d.html (ảnh trực giao từ trên xuống, tĩnh)", ngay: new Date().toISOString().slice(0, 10),
  ver: Date.now().toString(36), W: kq.W, H: kq.H, anh: "kho170-topview.webp", px: kq.px, khung: kq.khung, nha: kq.nha, o: kq.o, khu: kq.khu, vung: kq.vung };
fs.writeFileSync(path.join(OUT, "kho170-topview.js"),
  "/* kho170-topview.js — SINH TỰ ĐỘNG bởi hasaki/xuat-topview-kho170.mjs. ĐỪNG SỬA TAY. */\nwindow.KHO170_TOPVIEW=" + JSON.stringify(du) + ";\n");
const dem = {}; kq.o.forEach((q) => { const kk = q.k + (q.loc ? q.loc.slice(0, 5) : ""); dem[kk] = (dem[kk] || 0) + 1; });
console.log("Ảnh", kq.px.join("×"), "px ·", Math.round(buf.length / 1024), "KB · ô:", JSON.stringify(dem));
