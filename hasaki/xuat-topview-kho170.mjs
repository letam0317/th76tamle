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
  /* nhìn thẳng xuống (-y), "lên" của ảnh = -z ⇒ ảnh: x sang phải, z đi xuống — đúng hệ toạ độ bản vẽ */
  const cam = new THREE.OrthographicCamera(0, HX, 0, -HZ, 0.1, 300);
  cam.position.set(0, 120, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0); cam.updateProjectionMatrix();
  const pr = renderer.getPixelRatio(), sz = renderer.getSize(new THREE.Vector2());
  renderer.setPixelRatio(1); renderer.setSize(RONG, CAO, false);
  renderer.shadowMap.needsUpdate = true;
  renderer.render(scene, cam);
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
  return { W: HX, H: HZ, anh, o, khu, px: [RONG, CAO] };
}, RONG);

await b.close();
if (loi.length) { console.error("Lỗi trang 3D:", loi.join(" | ")); process.exit(1); }
const buf = Buffer.from(kq.anh.split(",")[1], "base64");
fs.writeFileSync(path.join(OUT, "kho170-topview.webp"), buf);
const du = { nguon: "kho170-3d.html (ảnh trực giao từ trên xuống, tĩnh)", ngay: new Date().toISOString().slice(0, 10),
  W: kq.W, H: kq.H, anh: "kho170-topview.webp", px: kq.px, o: kq.o, khu: kq.khu };
fs.writeFileSync(path.join(OUT, "kho170-topview.js"),
  "/* kho170-topview.js — SINH TỰ ĐỘNG bởi hasaki/xuat-topview-kho170.mjs. ĐỪNG SỬA TAY. */\nwindow.KHO170_TOPVIEW=" + JSON.stringify(du) + ";\n");
const dem = {}; kq.o.forEach((q) => { const kk = q.k + (q.loc ? q.loc.slice(0, 5) : ""); dem[kk] = (dem[kk] || 0) + 1; });
console.log("Ảnh", kq.px.join("×"), "px ·", Math.round(buf.length / 1024), "KB · ô:", JSON.stringify(dem));
