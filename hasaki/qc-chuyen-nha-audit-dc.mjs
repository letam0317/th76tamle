/**
 * qc-chuyen-nha-audit-dc.mjs — kiểm link letam0317.github.io (kiemsoatkho + stocklocationfactory) tự CHUYỂN sang audit-dc.pages.dev
 *  (user 19/10 bật lại BAT=true, xem memory link-chinh-audit-dc). Mở link THẬT trên web 1366 + điện thoại 390:
 *  R1 tới đúng audit-dc /retail/ hoặc /factory/ · R2 giữ tham số ?tab=… và mở đúng mục · R3 không vòng lặp (≤ 3 lượt điều hướng, dừng hẳn ở audit-dc)
 *  · R4 ?o-lai=1 thì ở lại github.io · R5 mang khoá localStorage sang (#mang= rồi tự xoá khỏi địa chỉ).
 *  Chạy: node qc-chuyen-nha-audit-dc.mjs
 */
import puppeteer from "puppeteer-core";
const ngu = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: "new" });
const loi = []; let dat = 0; const ok = (dk, ten) => { if (dk) dat++; else loi.push(ten); console.log((dk ? "  ✓ " : "  ✗ ") + ten); };
const CA = [
  { tu: "https://letam0317.github.io/kiemsoatkho/", den: /^https:\/\/audit-dc\.pages\.dev\/retail\// },
  { tu: "https://letam0317.github.io/kiemsoatkho/?tab=xacminh", den: /^https:\/\/audit-dc\.pages\.dev\/retail\/.*(xacminh|tab=xacminh)/ },
  { tu: "https://letam0317.github.io/kiemsoatkho/?tab=task", den: /^https:\/\/audit-dc\.pages\.dev\/retail\/.*(vipham|tab=task)/ },
  { tu: "https://letam0317.github.io/kiemsoatkho/form.html", den: /^https:\/\/audit-dc\.pages\.dev\/retail\/form/ },
  { tu: "https://letam0317.github.io/stocklocationfactory/", den: /^https:\/\/audit-dc\.pages\.dev\/factory\// },
];
for (const m of [{ ten: "web-1366", w: 1366, h: 768 }, { ten: "dt-390", w: 390, h: 844, mob: true }]) {
  for (const c of CA) {
    const p = await b.newPage(); await p.setViewport({ width: m.w, height: m.h, isMobile: !!m.mob, hasTouch: !!m.mob });
    const di = []; p.on("framenavigated", (f) => { if (f === p.mainFrame()) di.push(f.url()); });
    await p.goto(c.tu, { waitUntil: "networkidle2", timeout: 60000 }).catch(() => {});
    /* không vòng lặp = địa chỉ đứng yên, không quay lại github.io sau khi đã tới audit-dc (đếm lượt điều hướng vô nghĩa — replaceState của trang cũng tính) */
    await ngu(3000); const cuoi = p.url(); await ngu(1500); const dungYen = p.url() === cuoi;
    const iA = di.findIndex((u) => /audit-dc/.test(u)), quayLai = iA >= 0 && di.slice(iA).some((u) => /github\.io/.test(u)), hong = /\/&|\?.*\?/.test(cuoi);
    ok(c.den.test(cuoi) && dungYen && !quayLai && !hong, m.ten + ": " + c.tu.replace("https://", "") + " → " + cuoi.slice(0, 90) + (hong ? " (ĐỊA CHỈ HỎNG)" : "") + (quayLai ? " (QUAY LẠI github.io)" : "") + (dungYen ? "" : " (CHƯA ĐỨNG YÊN)"));
    await p.close();
  }
  /* R4 ở lại + R5 mang khoá */
  const p = await b.newPage(); await p.setViewport({ width: m.w, height: m.h, isMobile: !!m.mob, hasTouch: !!m.mob });
  await p.goto("https://letam0317.github.io/kiemsoatkho/?o-lai=1", { waitUntil: "domcontentloaded", timeout: 60000 }); await ngu(1500);
  ok(/letam0317\.github\.io/.test(p.url()), m.ten + ": R4 ?o-lai=1 ở lại github.io");
  await p.evaluate(() => localStorage.setItem("qc-chuyen-nha", "1"));
  await p.goto("https://letam0317.github.io/kiemsoatkho/?qc=" + Date.now(), { waitUntil: "networkidle2", timeout: 60000 }); await ngu(2500);
  const mang = await p.evaluate(() => ({ khoa: localStorage.getItem("qc-chuyen-nha"), hash: location.hash }));
  ok(/audit-dc/.test(p.url()) && mang.khoa === "1" && !/mang=/.test(mang.hash), m.ten + ": R5 mang khoá localStorage sang, #mang= đã xoá " + JSON.stringify(mang));
  await p.close();
}
await b.close();
console.log(loi.length ? "✗ " + dat + " đạt, " + loi.length + " lỗi:\n  " + loi.join("\n  ") : "✓ " + dat + "/" + dat + " đạt");
process.exit(loi.length ? 1 : 0);
