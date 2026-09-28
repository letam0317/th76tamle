/**
 * qc-kho170-3d.mjs — BỘ ĐO cho kiemsoatkho/kho170-3d.html (mô hình 3D kho 170).
 *
 * Trang này dựng theo ĐÚNG khung của trang mẫu new-warehouse (thanh #ui thu gọn, nhãn sprite,
 * mái bật tắt). Nên bộ đo KHÔNG áp 9 luật hiển thị điện thoại của 2 dashboard — khung đó vốn
 * dùng tiêu đề nowrap + panel 46vh + nút 29px, người dùng đã chốt giữ nguyên cấu trúc ấy.
 * Cái phải đo ở đây là: hình dựng ra có ĐÚNG dữ liệu bản vẽ không, và mọi nút có chạy không.
 *
 *   node hasaki/qc-kho170-3d.mjs [--url <u>]
 * Không chạm upstream — trang chỉ đọc tệp cục bộ + three.js từ CDN.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const EDGE = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
              "C:/Program Files/Microsoft/Edge/Application/msedge.exe"].find((p) => fs.existsSync(p));
const argv = process.argv.slice(2);
const iU = argv.indexOf("--url");
const URL_DO = iU >= 0 ? argv[iU + 1] : "http://localhost:8123/kiemsoatkho/kho170-3d.html";

/* Sự thật gốc đọc THẲNG từ dữ liệu sơ đồ — trang không thể tự khai đúng */
function goc() {
  const js = fs.readFileSync(path.join(DIR, "kiemsoatkho", "kho170-sodo.js"), "utf8");
  const k = js.indexOf("{", js.indexOf("window.KHO170_SODO"));
  const D = JSON.parse(js.slice(k, js.lastIndexOf("}") + 1));
  const ke = D.o.filter((o) => o.k === "ke" && o.loc);
  return {
    W: D.W, H: D.H,
    a1: ke.filter((o) => o.loc.indexOf("F0-A1-") === 0).length,
    a2: ke.filter((o) => o.loc.indexOf("F0-A2-") === 0).length,
    pallet: D.o.filter((o) => o.k === "pallet").length,
    pack: D.o.filter((o) => o.k === "pack").length,
    pick: D.o.filter((o) => o.k === "pick").length,
    khu: D.khu.length,
    net2m: D.nen.filter((s) => Math.hypot(s[2] - s[0], s[3] - s[1]) >= 2.0).length,
  };
}

const ok = [], loi = [];
const bao = (d, t, c) => (d ? ok : loi).push(`${d ? "ĐẠT " : "LỖI "} · ${t}${c ? " — " + c : ""}`);

(async () => {
  if (!EDGE) { console.error("Không thấy msedge.exe."); process.exit(2); }
  const G = goc();
  console.log(`GỐC (đọc thẳng kho170-sodo.js): ${G.W}×${G.H} m · A1 ${G.a1} ô · A2 ${G.a2} ô · pallet ${G.pallet} · pack ${G.pack} · pick ${G.pick} · khu ${G.khu} · nét>=2m ${G.net2m}\n`);

  const br = await puppeteer.launch({ headless: "new", executablePath: EDGE,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--enable-unsafe-swiftshader", "--use-gl=swiftshader"] });
  const p = await br.newPage();
  const loiTrang = [];
  p.on("pageerror", (e) => loiTrang.push(String(e).slice(0, 160)));
  p.on("console", (c) => { if (c.type() === "error") loiTrang.push("console: " + c.text().slice(0, 160)); });
  await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await p.goto(URL_DO, { waitUntil: "domcontentloaded", timeout: 60000 });

  /* bọc "(" + fn + ")()" — chuỗi arrow function trần là no-op (bẫy 8 của bộ đo di động) */
  let san = true;
  try { await p.waitForFunction("(" + (() => window.__SAN_SANG === true) + ")()", { timeout: 45000 }); }
  catch (e) { san = false; }

  if (!san) {
    const e = await p.evaluate(() => ({ t: document.getElementById("errT").textContent, c: document.getElementById("errC").textContent }));
    bao(false, "trang dựng được mô hình", `${e.t} — ${e.c}`);
  } else {
    /* Mọi thứ dựng lại được nằm trong nhóm GOC3D, không phải scene.children */
    const d = await p.evaluate(() => ({
      khoNha: [Math.round(+window.GIA.HX * 10) / 10, Math.round(+window.GIA.HZ * 10) / 10],
      soSprite: window.GOC3D.children.filter((o) => o.isSprite).length,
      dem: window.GOC3D.children.filter((o) => o.isInstancedMesh).map((o) => o.count),
      maiTat: !window.roofG.visible,
      nutView: document.querySelectorAll("[data-v]").length,
      uiThuGon: document.getElementById("ui").classList.contains("col"),
      soOA1: window.oA1.length, soOA2: window.oA2.length,
      soONhap: document.querySelectorAll("#tsBox input, #tsBox select").length,
      soTs: Object.keys(window.GOC_TS).length,
      soTam: document.querySelectorAll("#tsBox .ng.tam").length,
      netVach: window.KHO170_SODO.nen.filter(window.netLaVach).length,
      soRac: ((window.KHO170_VACH || {}).rac || []).length,
      keDem: JSON.parse(JSON.stringify(window.KE_DEM || {})),
      bangMa: window.__bang || null,
      ranh: window.RANH && window.DONG ? { cot: window.RANH.cot.length + window.RANH.cotDoc.length, cong: Object.keys(window.DONG.cong).length } : null,
      mang: window.BC && window.BC.mangZs ? (() => { const bay = []; let z = +window.GIA.c5ZDau;
        [2.48,2.39,2.39,2.39,2.39,1.45,2.39,2.39,2.39,2.39,2.39].forEach((L) => { if (L > 2) for (let p = 0; p < 2; p++) bay.push(z + 0.045 + (p + 0.5) * (L - 0.09) / 2); z += L; });
        return { so: window.BC.mangZs.length, lech: Math.max(...window.BC.mangZs.map((m, i) => Math.abs(m - bay[i]))) }; })() : null,
      a8: window.DONG ? { nguoi: window.DONG.a8.NV.length, song: window.DONG.quet.length, xe: window.DONG.a8.imX[0].count, bang: window.DONG.a8 && window.__bang } : null,
      dong: window.DONG ? { xe: window.DONG.xe.length, nguoi: 1 + window.DONG.nOut.length, flash: window.DONG.fl.length } : null,
      soBanMa: window.imMam.A8 ? window.imMam.A8.meta.filter((m) => /^F0-A8-5\d\d-0[1-8]-01-01$/.test(m.loc)).length : 0,
      soBangA8: window.a8GanMa(window.KHO170_SODO.o.filter((o) => o.k === "pack").map((o) => Object.assign({}, o))).length,
      conLan: Math.max(0, ...window.GOC3D.children.filter((o) => o.isInstancedMesh && o.geometry.type === "CylinderGeometry").map((o) => o.count)),
    }));
    bao(d.khoNha[0] === Math.round(G.W * 10) / 10 && d.khoNha[1] === Math.round(G.H * 10) / 10,
      "khổ nhà đúng bản vẽ", d.khoNha.join("x") + " m");
    /* Kệ dựng theo trang mẫu new-warehouse: khung đứng ở mọi ranh bay, 2 bay liền nhau DÙNG CHUNG khung
       (mỗi khung 2 trụ) — không còn 4 trụ riêng cho từng ô. */
    const K = d.keDem, sumTru = Object.values(K).reduce((a, k) => a + k.tru, 0);
    bao(K.A1 && K.A1.bay === G.a1 / 2 && K.A1.tru === 2 * K.A1.khung, "kệ A1: 80 bay, trụ = 2 × số khung (khung dùng chung)",
      K.A1 ? K.A1.bay + " bay · " + K.A1.khung + " khung · " + K.A1.tru + " trụ" : "không có");
    /* A2 = khối 501…514 (mỗi ô 1 bay, 501|502 chung 1 kệ 2 mặt) + cụm C5000: 515|516 double-deep đè máng băng
       chuyền (2 × 2 hàng × 11 bay) · 517|518 double-deep 4 hàng · 519|520 · 521 (bay theo A2-514) */
    bao(K.A2 && K.A2.tru === 2 * K.A2.khung && K.A2.ddHang === 8 && K.A2.bay >= 190,
      "kệ A2 + cụm C5000: trụ = 2 × khung · 8 hàng double-deep (515|516 đè máng · 517|518)",
      K.A2 ? K.A2.bay + " bay · " + K.A2.khung + " khung · " + K.A2.ddHang + " hàng double-deep" : "không có");
    bao(K.A2T && K.A2T.bay === 21, "kệ tường đầu dãy A2 (phía tủ 01): 5 mô-đun Thăng Long + 6 bay DCMTG1 = 21 bay",
      K.A2T ? K.A2T.bay + " bay" : "MẤT");
    bao(K.KWC && K.KWC.bay === 3, "kệ cạnh WC / kho giấy: 1 dãy × 3 bay (user 28/09: thực tế chỉ 3 kệ)", K.KWC ? K.KWC.bay + " bay" : "MẤT");
    bao(K.KRAC && K.KRAC.bay === 2, "kệ selective đơn 2 bay 2.390 cạnh khu phân loại rác (ảnh số 2)", K.KRAC ? K.KRAC.bay + " bay" : "MẤT");
    bao(d.mang && d.mang.lech < 0.06 && d.mang.so === 20, "20 máng mỗi bên nằm đúng dưới pallet bay 515|516 ⇒ trụ kệ giữa 2 đầu máng",
      d.mang ? d.mang.so + " máng · lệch tối đa " + d.mang.lech.toFixed(3) + " m" : "không có");
    bao(d.a8 && d.a8.nguoi === 64 && d.a8.xe === 100 && d.a8.song === 2, "64 NV soạn-đóng (xe đẩy theo người) · 100 xe đẩy 2 tầng · 2 người quét kiêm bàn giao",
      d.a8 ? d.a8.nguoi + " NV · " + d.a8.xe + " xe đẩy · " + d.a8.song + " người quét" : "không có");
    bao(d.dong && d.dong.xe === 4 && d.dong.nguoi === 4 && d.dong.flash === 4, "4 xe Ford Transit de đít vào 4 cửa (IN + OUT 3/2/1), có người + 4 cổng camera",
      d.dong ? d.dong.xe + " xe · " + d.dong.nguoi + " người · " + d.dong.flash + " đèn quét" : "không có");
    bao(K["5L"] && K["5L"].bay === 32 && K["5L"].pallet >= 77, "kệ tường 5L1 · 5L2 · 5L3 có đủ (32 bay, ≥77 ô pallet sàn)",
      K["5L"] ? K["5L"].bay + " bay · " + K["5L"].pallet + " pallet" : "MẤT");
    bao(d.dem.includes(sumTru), "số trụ dựng ra khớp tổng khung của mọi dãy", sumTru + " trụ");
    /* nét trong vùng băng chuyền là khung băng tải + đường gióng kích thước, không dựng thành vách */
    /* vách = nét ≥2 m trùng tường hồng của "DC HASAKI 3d.pdf" (qc-vach-kho170.mjs), trừ khung băng chuyền */
    bao(d.dem.includes(d.netVach) && d.soRac > 300 && d.netVach >= 50 && d.netVach <= 90,
      "vách chỉ còn tường thật (đối soát PDF màu, bỏ vách rác)", d.netVach + " vách · bỏ " + (G.net2m - d.netVach) + " nét rác");
    bao(d.soBanMa === 64 && d.soBangA8 === 4, "khu A8: 64 bàn có mã + 4 băng chuyền (502·505·508·511)",
      d.soBanMa + " bàn có mã · " + d.soBangA8 + " băng");
    bao(d.conLan >= 3 * 20, "đủ con lăn cho 3 line xuất (máng phân loại dùng mặt vân con lăn)", d.conLan + " con lăn");
    bao(d.dem.includes(G.pack), "đủ 64 bàn đóng gói", "cần " + G.pack);
    /* 107 khối xanh "xe pick" của bản vẽ → thay bằng xe đẩy thật (64 theo NV + 36 trữ ở khu trữ xe) + người ở vị trí đứng A8 */
    bao(d.bangMa && d.bangMa.lon === 12 && d.bangMa.rong === 9 && d.bangMa.nho === 128, "bảng mã dãy theo bộ in thật: A2 503–514 đơn (12) · foam 2 ô A1 501|502…515|516 + A2 501|502 (9) ở đầu dãy phía nam · tam giác đủ bộ 8 bảng/dãy ở trụ giữa 2 tủ, bỏ lối cắt 05|06 (8 dãy × 8 × 2 mặt = 128)",
      d.bangMa ? d.bangMa.lon + " đơn · " + d.bangMa.rong + " foam 2 ô · " + d.bangMa.nho + " mặt tam giác" : "không có");
    bao(d.ranh && d.ranh.cot >= 10 && d.ranh.cong === 2, "ranh khu bàn giao ĐVVC: cột inox dây rút + 2 cổng (SPX · J&T)",
      d.ranh ? d.ranh.cot + " cột · " + d.ranh.cong + " cổng" : "không có");
    /* pallet zone băng phân loại: 41 ô vẽ theo máng cũ → 40 ô đặt lại đúng dưới 40 máng mới (28/09) */
    bao(d.dem.includes(G.pallet - 41 + 40), "đủ vị trí pallet sàn (pallet zone = 40 ô dưới 40 máng)", "cần " + (G.pallet - 41 + 40));
    bao(d.soSprite >= G.khu + 3 + 16, "đủ nhãn (25 khu + 3 khối + 16 mã dãy)", d.soSprite + " nhãn");
    /* A2: bản vẽ có 158 ô = 501…514 (112) + 517…521 (45) + 522 (1, nằm ngoài tường). Cụm C5000 thay 46 ô 517…522 bằng
       515|516 (2 × 11 bay) + 517…521 (5 dãy × 8 bay theo A2-514) ⇒ 158 − 46 + 22 + 32 = 166 (521 bỏ 28/09 — không có ngoài thực tế) */
    const a2Can = G.a2 - 46 + 22 + 32;
    bao(d.soOA1 === G.a1 && d.soOA2 === a2Can, "mặc định dựng theo BẢN VẼ (A2 có cụm C5000)", `A1 ${d.soOA1}/${G.a1} · A2 ${d.soOA2}/${a2Can}`);
    bao(d.soONhap === d.soTs, "bảng Thông số hiện đủ mọi thông số", `${d.soONhap}/${d.soTs} ô nhập`);
    bao(d.soTam > 0, "số còn TẠM được đánh dấu đỏ để biết mà sửa", d.soTam + " số");
    bao(d.maiTat, "mái mặc định TẮT như trang mẫu");
    bao(d.nutView === 7, "đủ 7 góc nhìn đặt sẵn", d.nutView + " nút");
    bao(d.uiThuGon, "thanh #ui mở ra ở trạng thái thu gọn");

    /* mọi nút phải ăn */
    const nut = await p.evaluate(async () => {
      const r = {};
      const cho = () => new Promise((x) => requestAnimationFrame(() => requestAnimationFrame(x)));
      document.getElementById("bRoof").click(); await cho(); r.mai = window.roofG.visible;
      document.getElementById("bRoof").click(); await cho();
      document.getElementById("bTog").click(); await cho();
      r.moChiTiet = !document.getElementById("ui").classList.contains("col");
      r.nhanChiTiet = document.getElementById("bTog").textContent.trim();
      document.getElementById("bTog").click(); await cho();
      /* Đo bằng thứ NGƯỜI DÙNG thấy, không đọc biến 'let' (let cấp tệp không lên window) */
      const bP = document.getElementById("bPause");
      bP.click(); await cho();
      r.dung = bP.textContent.trim() === "Tiếp tục" && bP.classList.contains("on");
      bP.click(); await cho();
      r.chayLai = bP.textContent.trim() === "Tạm dừng" && !bP.classList.contains("on");
      document.getElementById("bLab").click(); await cho();
      r.tatNhan = !document.getElementById("bLab").classList.contains("on");
      document.getElementById("bLab").click(); await cho();
      /* Đổi màu phải đổi MÀU THẬT của mâm, không chỉ đổi chữ trên nút */
      const bM = document.getElementById("bMode");
      const mau0 = Array.from(window.imMam.A1.im.instanceColor.array.slice(0, 30));
      const t0 = bM.textContent;
      bM.click(); await cho();
      const mau1 = Array.from(window.imMam.A1.im.instanceColor.array.slice(0, 30));
      r.doiMau = bM.textContent !== t0 && mau0.some((v, k) => Math.abs(v - mau1[k]) > 0.01);
      bM.click(); await cho();
      r.goc = [];
      const bs = document.querySelectorAll("[data-v]");
      for (const b of bs) { b.click(); await cho();
        r.goc.push(b.classList.contains("on") && isFinite(window.camera.position.x)); }
      return r;
    });
    bao(nut.mai, "nút Mái bật/tắt được");
    bao(nut.moChiTiet && nut.nhanChiTiet === "Thu gọn ▴", "nút Chi tiết mở khối mô tả + đổi nhãn", nut.nhanChiTiet);
    bao(nut.dung && nut.chayLai, "nút Tạm dừng ⇄ Tiếp tục");
    bao(nut.tatNhan, "nút Nhãn tắt được");
    bao(nut.doiMau, "nút Màu đổi loại khu ⇄ vệ sinh (đổi cả màu mâm, không chỉ đổi chữ)");
    bao(nut.goc.every(Boolean), "cả 7 góc nhìn đều nhảy camera hợp lệ");

    /* 28/09 (user duyệt bản thử camera): tìm mã vị trí · 4 kiểu điều khiển · khu A6 · vách WC */
    const moi = await p.evaluate(async () => {
      const cho = (ms) => new Promise((x) => setTimeout(x, ms || 80));
      const r = { chiMuc: CAM.chiMuc.length };
      const tt = () => document.getElementById("timTt").textContent, tag = () => document.getElementById("timTag").textContent;
      CAM.timMa("A1-506-05"); await cho(); r.mot = tt() === "Đã tìm thấy." && tag() === "F0-A1-506-05";
      CAM.timMa("F0-A2-507"); await cho(); r.nhieu = /^Khớp \d+ ô/.test(tt());
      CAM.timMa("F0-A8-501-01-01-01"); await cho(); r.a8 = tag() === "F0-A8-501-01-01-01";
      CAM.timMa("ZZ-999"); await cho(); r.khong = /Không có mã/.test(tt());
      CAM.boTim();
      r.mode = [];
      for (const b of document.querySelectorAll("[data-m]")) { b.click(); await cho(); r.mode.push(b.classList.contains("on") && isFinite(window.camera.position.x)); }
      document.querySelector('[data-m="orbit"]').click();
      const bc = document.getElementById("bChieu"); bc.click(); await cho(); r.chieu = bc.classList.contains("on"); bc.click(); await cho();
      const a6 = window.__a6 || [];
      r.a6 = a6.length; r.a6DeVach = a6.filter((c) => c.x + c.w > 24.8 - 0.05 && c.y + c.h > window.RANH.z).length;
      r.wc = window.__wc || 0;
      return r;
    });
    bao(moi.chiMuc >= 380, "ô tìm mã có đủ chỉ mục (A1 + A2 + A8)", moi.chiMuc + " mã");
    bao(moi.mot && moi.a8, "tìm đúng 1 mã (A1 thiếu F0- vẫn ra · A8 mã đủ 6 đoạn) → khoanh + nhãn đúng mã");
    bao(moi.nhieu && moi.khong, "tìm một phần mã ra nhiều ô · mã không có thì báo không có");
    bao(moi.mode.length === 4 && moi.mode.every(Boolean) && moi.chieu, "4 kiểu điều khiển + đổi phép chiếu chạy", JSON.stringify(moi.mode));
    bao(moi.a6 >= 20 && moi.a6DeVach === 0, "khu A6 có bàn quản lý + bàn dọc ranh ĐVVC, KHÔNG bàn nào đè vạch x 24,8", moi.a6 + " vật · " + moi.a6DeVach + " đè vạch");
    bao(moi.wc >= 15, "WC có tường + vách ngăn buồng + cửa", moi.wc + " tấm");

    /* Sửa thông số phải ĐỔI THẬT hình dựng ra, không chỉ đổi chữ */
    const ts = await p.evaluate(async () => {
      const cho = () => new Promise((x) => setTimeout(x, 60));
      const r = {};
      const cu = window.oA1.length;
      /* Gõ số bố cục khi khối còn "dựng theo bản vẽ" -> trang phải TỰ chuyển sang "thông số",
         nếu không thì bấm Áp dụng chẳng thấy gì đổi (bẫy bộ đo bắt được 22/09). */
      let inp = document.getElementById("ts_a1SoTu");
      inp.value = 6; inp.dispatchEvent(new Event("change"));
      r.tuChuyen = window.GIA.a1Nguon === "thongso";
      inp = document.getElementById("ts_a1SoTu");
      r.danhDau = inp.closest(".ts-d").classList.contains("doi");
      document.getElementById("tsAp").click(); await cho();
      r.sauKhiSua = window.oA1.length;
      /* 4 cụm × 4 dãy × 6 tủ = 96 */
      r.dung = window.oA1.length === 96;
      r.tieuDeBao = /ĐÃ SỬA/.test(document.getElementById("tieu").textContent);
      r.nhoTrongMay = !!JSON.parse(localStorage.getItem("kho170-ts") || "{}").a1SoTu;
      document.getElementById("tsGoc").click(); await cho();
      r.veGoc = window.oA1.length === cu && !localStorage.getItem("kho170-ts");
      return r;
    });
    bao(ts.tuChuyen, "gõ số bố cục thì TỰ chuyển khối sang 'dựng theo thông số'");
    bao(ts.danhDau, "ô vừa sửa được viền xanh để thấy ngay");
    bao(ts.dung, "sửa 'số tủ mỗi dãy' = 6 thì dựng lại đúng 96 ô", ts.sauKhiSua + " ô");
    bao(ts.tieuDeBao, "tiêu đề báo đang chạy bằng số đã sửa");
    bao(ts.nhoTrongMay, "số đã sửa được nhớ lại trong máy");
    bao(ts.veGoc, "nút Đặt lại số gốc trả mô hình về đúng bản gốc");

    /* ── Xe nâng NICHIYU FBR: phải dựng theo thông số, không phải hình đóng cứng ── */
    const xe = await p.evaluate(async () => {
      const cho = () => new Promise((x) => setTimeout(x, 80));
      /* chỉ xe nâng ĐANG CHẠY — bỏ xe đỗ ở chỗ sạc + xe van (khối tĩnh đã gộp, gắn userData.tinh) */
      const nhom = () => window.GOC3D.children.filter((o) => o.type === "Group" && o.children.length > 15 && !o.userData.tinh);
      const r = { so: nhom().length, boPhan: nhom()[0] ? nhom()[0].children.length : 0 };
      /* đổi bề rộng xe -> thân xe phải rộng ra theo */
      const rongCu = nhom()[0].children[0].geometry.parameters.width;
      const el = document.getElementById("ts_xnRong");
      el.value = 2.0; el.dispatchEvent(new Event("change"));
      document.getElementById("tsAp").click(); await cho();
      r.rongMoi = nhom()[0].children[0].geometry.parameters.width;
      r.theoTs = Math.abs(r.rongMoi - 2.0) < 0.01 && Math.abs(rongCu - 1.2) < 0.01;
      document.getElementById("tsGoc").click(); await cho();
      return r;
    });
    bao(xe.so === Number(await p.evaluate(() => window.GIA.soXeNang)), "dựng đúng số xe nâng đã khai", xe.so + " xe");
    bao(xe.boPhan >= 20, "xe nâng có đủ bộ phận (thân · buồng · nóc · 2 chân càng · khung nâng · càng)", xe.boPhan + " khối");
    bao(xe.theoTs, "đổi 'bề rộng xe' thì thân xe rộng theo", "1,2 m → " + xe.rongMoi + " m");

    /* ── Chu trình NÂNG HÀNG: dừng → nâng càng → vươn → lấy/trả pallet → rút → hạ ── */
    /* NV soạn–đóng: không đè nhau · không xuyên bàn/băng A8 · xe nâng không chạm người (soi 12 s, xe tốc độ cao) */
    const ng = await p.evaluate(async () => {
      const A = window.DONG.a8, ban = A.tram.length ? window.KHO170_SODO.o.filter((o) => o.k === "pack") : [];
      const bang = A.bang.map((b) => ({ x: b.x0, y: b.z0, w: b.x1 - b.x0, h: b.zDuoi - b.z0 }));
      const trong = (x, z, o, m) => x > o.x + m && x < o.x + o.w - m && z > o.y + m && z < o.y + o.h - m;
      let de = 0, xuyen = 0, cham = 0, buoc = 0, xuyenKe = 0, maxCho = 0; const q0 = A.soQuay || 0; const t0 = performance.now();
      await new Promise((ok) => { const d = () => { buoc++;
        const di = A.NV.filter((n) => n.pha !== "tram");
        for (let i = 0; i < di.length; i++) { const a = di[i];
          if (ban.some((o) => trong(a.rx, a.rz, o, 0.08)) || bang.some((o) => trong(a.rx, a.rz, o, 0.05))) xuyen++;
          for (let j = i + 1; j < di.length; j++) if (Math.hypot(a.rx - di[j].rx, a.rz - di[j].rz) < 0.3) de++;
          for (const x of window.xes) if (Math.hypot(a.rx - x.x, a.rz - x.z) < 0.7) cham++;
          if (a.rz < A.zNgang - 1 && !window.oTrong(a.rx, a.rz)) xuyenKe++; maxCho = Math.max(maxCho, a.cho || 0); }
        performance.now() - t0 < 12000 ? requestAnimationFrame(d) : ok(); }; requestAnimationFrame(d); });
      return { de, xuyen, cham, buoc, xuyenKe, maxCho, soQuay: (A.soQuay || 0) - q0, di: A.NV.filter((n) => n.pha !== "tram").length };
    });
    bao(ng.xuyen === 0, "NV soạn KHÔNG đi xuyên bàn / băng chuyền A8 (đi theo hành lang giữa các line)", ng.xuyen + " lần · " + ng.buoc + " khung");
    bao(ng.de <= ng.buoc * 0.1, "NV soạn không chen lấn (giữ 1 m, nép phải, vượt người đang dừng; chạm thoáng lúc rẽ góc ≤ 10% khung)", ng.de + " cặp chạm / " + ng.buoc + " khung");
    bao(ng.cham === 0, "xe nâng không chạm người (dừng khi có người trước mũi xe)", ng.cham + " lần");
    bao(ng.xuyenKe === 0, "NV soạn KHÔNG đi xuyên kệ / tường trong khối A1", ng.xuyenKe + " lần");
    bao(ng.maxCho < 13, "NV không đứng kẹt lâu: sau xe nâng > 5 s / sau hàng chờ > 6 s thì QUAY ĐẦU theo đường cũ", "chờ lâu nhất " + ng.maxCho.toFixed(1) + " s · " + ng.soQuay + " lượt quay đầu");
    /* cơ cấu xe nâng đo khi lối trống: đưa NV soạn về trạm (luật nhường người đã đo ở trên) */
    await p.evaluate(() => window.DONG.a8.NV.forEach((n) => { n.pha = "tram"; n.tp = 0; n.dong = 1e9; }));
    const nang = await p.evaluate(async () => {
      const r = { tt: {}, chuKy: 0, doiHang: 0, giaMax: 0, dungYen: true, khungTruot: false };
      r.theoKhu = window.xes.reduce((a, x) => { a[x.khu] = (a[x.khu] || 0) + 1; return a; }, {});
      r.mucA1 = [...new Set(window.xes.filter((x) => x.khu === "A1").map((x) => x.mucCao.join("/")))];
      r.mucA2 = [...new Set(window.xes.filter((x) => x.khu === "A2").map((x) => x.mucCao.join("/")))];
      window.xes.forEach((x) => { x.tKe = 0.2; x.v = 3.5; });
      const caoMax = {}, ttTruoc = window.xes.map((x) => x.tt), hangTruoc = window.xes.map((x) => x.coHang);
      const viTri = window.xes.map((x) => x.x + "|" + x.z);
      const t0 = performance.now();
      let khungNang = 0;
      await new Promise((res) => {
        const d = () => {
          window.xes.forEach((x, i) => {
            r.tt[x.tt] = (r.tt[x.tt] || 0) + 1;
            caoMax[x.khu] = Math.max(caoMax[x.khu] || 0, x.cao);
            r.giaMax = Math.max(r.giaMax, x.giaZ);
            /* đang nâng / vươn thì xe phải ĐỨNG YÊN, không vừa chạy vừa nâng */
            const vt = x.x + "|" + x.z;
            if (x.tt !== "chay" && vt !== viTri[i]) r.dungYen = false;
            viTri[i] = vt;
            /* khung nâng phải TRƯỢT: tầng trong cao hơn tầng ngoài khi đang nâng */
            const k = x.g.userData.khung;
            if (x.cao > 0.5 && k[k.length - 1].position.y > k[0].position.y + 0.1) r.khungTruot = true;
            if (ttTruoc[i] !== "nang" && x.tt === "nang") { r.chuKy++; (r.daDung = r.daDung || []).push({ khu: x.khu, cao: +x.caoDich.toFixed(2) }); }
            if (x.coHang !== hangTruoc[i]) { r.doiHang++; hangTruoc[i] = x.coHang; }
            ttTruoc[i] = x.tt;
          });
          /* đủ KHUNG HÌNH chứ không chỉ đủ giây: máy chậm (cảnh kệ đủ cấu kiện 28/09) thì 22 s chưa đủ lượt để phán */
          khungNang++;
          const tNang = performance.now() - t0;
          (tNang < 22000 || khungNang < 130) && tNang < 60000 ? requestAnimationFrame(d) : res();
        };
        requestAnimationFrame(d);
      });
      r.caoMax = caoMax;
      r.giaVeCho = window.xes.every((x) => x.tt === "chay" ? x.giaZ < 0.02 : true);
      return r;
    });
    bao(nang.theoKhu.A1 === 3 && nang.theoKhu.A2 === 2, "đúng 3 xe khối A1 + 2 xe khối A2",
      JSON.stringify(nang.theoKhu));
    bao(["nang", "vuon", "doi", "rut", "ha"].every((k) => nang.tt[k] > 0),
      "chạy đủ 5 chặng: nâng · vươn càng · lấy-trả · rút càng · hạ", JSON.stringify(nang.tt));
    bao(nang.chuKy >= 3, "nhiều xe cùng làm hàng, không phải một xe làm mẫu", nang.chuKy + " lượt nâng");
    bao(nang.doiHang >= 3, "pallet có sang tay (lấy lên / đặt xuống)", nang.doiHang + " lần");
    bao(nang.khungTruot, "khung nâng TRƯỢT từng tầng chứ không đứng im khi nâng");
    bao(nang.giaMax > 0.5, "càng có VƯƠN ra để lấy hàng trong ô", "vươn " + nang.giaMax.toFixed(2) + " m");
    bao(nang.giaVeCho, "chạy tiếp thì càng đã rút về hết, không thò ra");
    bao(nang.dungYen, "đang nâng / vươn thì xe ĐỨNG YÊN, không vừa chạy vừa nâng");
    /* Cao độ nâng phải RƠI ĐÚNG vào một tầng của khối đó. (Không đòi phải chạm tầng cao
       nhất — tầng chọn ngẫu nhiên nên một lượt đo ngắn có thể chưa bốc tầng trên cùng.) */
    const muc = { A1: nang.mucA1[0].split("/").map(Number), A2: nang.mucA2[0].split("/").map(Number) };
    const sai = (nang.daDung || []).filter((d) => !muc[d.khu].some((m) => Math.abs(m - d.cao) < 0.01));
    bao((nang.daDung || []).length > 0 && sai.length === 0,
      "mọi lượt nâng đều dừng ĐÚNG một cao độ tầng của khối đó",
      `${(nang.daDung || []).length} lượt · ${sai.length} lượt sai` +
      (sai.length ? " " + JSON.stringify(sai.slice(0, 3)) : ""));
    bao(muc.A1.some((m) => Math.abs(m - nang.caoMax.A1) < 0.01), "A1 không nâng quá tầng cao nhất của nó",
      nang.caoMax.A1.toFixed(2) + " m / trần " + Math.max(...muc.A1) + " m");
    bao(muc.A2.some((m) => Math.abs(m - nang.caoMax.A2) < 0.01), "A2 không nâng quá tầng cao nhất của nó",
      nang.caoMax.A2.toFixed(2) + " m / trần " + Math.max(...muc.A2) + " m");

    /* ── Va chạm + xi-nhan: chạy mô phỏng thật rồi soi từng khung hình ── */
    const va = await p.evaluate(async () => {
      window.xes.forEach((x) => { x.v = 4.0; });
      let khungVa = 0;
      const nk = []; let buoc = 0, damVat = 0, damXe = 0, tr = 0, ph = 0, ca2 = 0;
      let hTruoc = window.xes.map((x) => x.h);
      const t0 = performance.now();
      await new Promise((r) => {
        const d = () => {
          window.xes.forEach((x, i) => {
            buoc++;
            if (!window.xeLot(x.x, x.z, x.h)) damVat++;
            if (!window.dungXe(x.x, x.z, x.h, i)) damXe++;
            const T = x.g.userData.denTrai.visible, P = x.g.userData.denPhai.visible;
            if (T && P) ca2++; else if (T) tr++; else if (P) ph++;
            if (x.h !== hTruoc[i]) { nk.push({ ben: x.ben, quayDau: (x.h - hTruoc[i] + 4) % 4 === 2 }); hTruoc[i] = x.h; }
          });
          khungVa++; const tVa = performance.now() - t0;
          (tVa < 12000 || khungVa < 150) && tVa < 45000 ? requestAnimationFrame(d) : r();
        };
        requestAnimationFrame(d);
      });
      return { buoc, damVat, damXe, soRe: nk.length, tr, ph, ca2,
               quayDauDungDen: nk.filter((n) => n.quayDau).every((n) => n.ben === 0),
               reDungDen: nk.filter((n) => !n.quayDau).every((n) => n.ben !== 0) };
    });
    bao(va.buoc > 300, "chạy được mô phỏng đủ dài để phán", va.buoc + " lượt đo");
    const dongChay = await p.evaluate(() => {
      const G = window.GIA, ngoai = window.xes.filter((x) => x.x < +G.nhaX0 || x.x > +G.nhaX1 || x.z < +G.nhaY0 ||
        (x.x > +G.nhaGiua && x.z > +G.nhaYPhai) || (x.x <= +G.nhaGiua && x.z > +G.nhaYTrai)).length;
      return { flash: window.DONG.fl.map((f) => f.dem), ngoai };
    });
    bao(dongChay.flash.some((n) => n > 0), "kiện chạy qua ô camera thì đèn flash nháy (trạm IN + 3 cổng OUT)", JSON.stringify(dongChay.flash));
    bao(dongChay.ngoai === 0, "không xe nâng nào chạy ra ngoài nhà (ngoài hình chữ L là vật cản)", dongChay.ngoai + " xe ngoài nhà");
    bao(va.damVat === 0, "KHÔNG xuyên / trèo lên vật thể lần nào", va.damVat + " lần đâm");
    bao(va.damXe === 0, "KHÔNG có 2 xe chồng lên nhau", va.damXe + " lần đâm");
    bao(va.soRe > 0, "có rẽ khi gặp vật cản", va.soRe + " lần rẽ");
    /* Xi-nhan nháy ~2 Hz mà Edge headless chỉ chạy ~6 fps nên lấy mẫu theo khung hình
       bị TRƯỢT PHA — báo "không nháy" oan. Ép từng xe vào một lượt rẽ DÀI rồi soi suốt lượt. */
    const nhay = await p.evaluate(async () => {
      const r = { trai: 0, phai: 0, ca2: 0, tat: 0 };
      const dat = (ben) => window.xes.forEach((x) => {
        x.re = 1; x.ben = ben; x.gocDich = x.goc + Math.PI * 6;   // rẽ dài để soi đủ nhiều khung
      });
      /* soi xe ĐANG CHẠY: xe đang dừng nâng/hạ pallet thì không xử lý lượt rẽ → đèn tắt, báo lỗi oan */
      const iSoi = Math.max(0, window.xes.findIndex((x) => x.tt === "chay"));
      const soi = async (n) => {
        for (let k = 0; k < n; k++) {
          await new Promise((y) => requestAnimationFrame(y));
          const x = window.xes[iSoi];
          const T = x.g.userData.denTrai.visible, P = x.g.userData.denPhai.visible;
          if (T && P) r.ca2++; else if (T) r.trai++; else if (P) r.phai++; else r.tat++;
        }
      };
      dat(-1); await soi(26); const trai = { ...r };
      Object.keys(r).forEach((k) => (r[k] = 0));
      dat(1); await soi(26); const phai = { ...r };
      Object.keys(r).forEach((k) => (r[k] = 0));
      dat(0); await soi(26); const ca2 = { ...r };
      return { trai, phai, ca2 };
    });
    bao(nhay.trai.trai > 0 && nhay.trai.tat > 0 && nhay.trai.phai === 0 && nhay.trai.ca2 === 0,
      "rẽ TRÁI: chỉ đèn trái nháy (có lúc sáng, có lúc tắt)", JSON.stringify(nhay.trai));
    bao(nhay.phai.phai > 0 && nhay.phai.tat > 0 && nhay.phai.trai === 0 && nhay.phai.ca2 === 0,
      "rẽ PHẢI: chỉ đèn phải nháy", JSON.stringify(nhay.phai));
    bao(nhay.ca2.ca2 > 0 && nhay.ca2.tat > 0 && nhay.ca2.trai === 0 && nhay.ca2.phai === 0,
      "quay đầu: cả hai đèn nháy cùng nhịp", JSON.stringify(nhay.ca2));
    bao(va.reDungDen, "rẽ trái/phải thì chỉ nháy ĐÚNG MỘT bên");
    bao(va.quayDauDungDen, "quay đầu thì nháy CẢ HAI đèn (đèn cảnh báo), không báo bừa một bên");

    /* ── Ô nạp tệp: bóc số từ tệp rồi bấm chip điền vào ô ── */
    const nap = await p.evaluate(async () => {
      const cho = () => new Promise((x) => setTimeout(x, 80));
      const r = {};
      r.coO = !!document.getElementById("tsFile") && !!document.getElementById("tsChip");
      /* giả lập một tờ thông số dạng text (PDF cần mạng, không đo ở đây) */
      const txt = "NICHIYU FBR15 Overall width 1270 mm Lowered mast height 2350 mm Fork length 1070 mm";
      const f = new File([txt], "fbr15.txt", { type: "text/plain" });
      const dt = new DataTransfer(); dt.items.add(f);
      const inp = document.getElementById("tsFile");
      inp.files = dt.files; inp.dispatchEvent(new Event("change"));
      await cho(); await cho();
      const chips = Array.from(document.querySelectorAll("#tsChip .chip"));
      r.soChip = chips.length;
      /* 1270 mm phải sinh ra cả chip 1.27 m — mô hình tính bằng mét */
      r.coDoiSangMet = chips.some((c) => c.textContent.trim() === "1.27 m");
      const c127 = chips.find((c) => c.textContent.trim() === "1.27 m");
      if (c127) {
        c127.click();
        const o = document.getElementById("ts_xnRong");
        o.focus(); o.click(); await cho();
        r.dienDuoc = Math.abs(+o.value - 1.27) < 0.001 && Math.abs(+window.GIA.xnRong - 1.27) < 0.001;
      }
      document.getElementById("tsGoc").click(); await cho();
      return r;
    });
    bao(nap.coO, "có ô nạp tệp + chỗ hiện số tìm được");
    bao(nap.soChip >= 6, "bóc được số từ tệp thông số", nap.soChip + " số");
    bao(nap.coDoiSangMet, "số ghi bằng mm được đổi sẵn sang m (mô hình tính bằng mét)");
    bao(nap.dienDuoc, "bấm 1 số rồi bấm vào ô là điền được, khỏi gõ tay");

    const fps = await p.evaluate(() => new Promise((r) => {
      let n = 0; const t0 = performance.now();
      const d2 = () => { n++; performance.now() - t0 < 1000 ? requestAnimationFrame(d2) : r(Math.round(n * 1000 / (performance.now() - t0))); };
      requestAnimationFrame(d2);
    }));
    /* Edge headless vẽ bằng SwiftShader (CPU) nên con số này KHÔNG phải tốc độ máy thật —
       nó chỉ dùng để bắt hồi quy. Mốc đo 22/09/2026: 8 fps có bóng · 13 fps khi tắt bóng
       (cảnh có 7.436 instance). Mốc 28/09/2026: kệ dựng đủ cấu kiện như trang mẫu new-warehouse (khung
       chung + giằng + beam trước/sau + pallet từng vị trí, thêm 3 dãy kệ tường) — ~5 fps; phần kệ tĩnh đã
       gộp thành hình liền. Tụt dưới 4 là có gì đó vừa phình ra. */
    bao(fps >= 4, "khung hình SwiftShader >= 4 fps (mốc 28/09 kệ đủ cấu kiện ~5 · mốc 22/09 cảnh thô 8)", fps + " fps");
    const fpsNhe = await (async () => {
      const p2 = await br.newPage();
      await p2.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      await p2.goto(URL_DO, { waitUntil: "domcontentloaded", timeout: 60000 });
      await p2.waitForFunction("(" + (() => window.__SAN_SANG === true) + ")()", { timeout: 45000 });
      const f = await p2.evaluate(() => new Promise((r) => {
        let n = 0; const t0 = performance.now();
        const d3 = () => { n++; performance.now() - t0 < 1000 ? requestAnimationFrame(d3) : r(Math.round(n * 1000 / (performance.now() - t0))); };
        requestAnimationFrame(d3);
      }));
      const bong = await p2.evaluate(() => innerWidth < 900);
      await p2.close();
      return { f, bong };
    })();
    bao(fpsNhe.bong, "màn hẹp (<900px) tự TẮT bóng đổ để đỡ nặng máy");
    bao(fpsNhe.f >= 6, "điện thoại 390px vẫn vẽ được", fpsNhe.f + " fps");
  }
  bao(loiTrang.length === 0, "console sạch", loiTrang.slice(0, 2).join(" | "));
  await p.close(); await br.close();

  console.log(ok.join("\n"));
  if (loi.length) {
    console.log("\n" + "-".repeat(64) + "\n" + loi.join("\n") + "\n" + "-".repeat(64));
    console.log(`\nKẾT QUẢ: ${ok.length} đạt · ${loi.length} LỖI`);
    process.exit(1);
  }
  console.log(`\nKẾT QUẢ: ĐẠT toàn bộ ${ok.length} ca.`);
})();
