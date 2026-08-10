/**
 * qc-plg-oke.mjs — QC RIÊNG CHO Ô KỆ của tab Planogram (Audit Factory).
 * Mở factory/index.html bằng Edge headless, sang tab Planogram, rồi:
 *   1. ĐO thật: cỡ ô trên màn hình (px), bề rộng vạch kho (px), tỷ lệ co của bản vẽ,
 *      màu nền/viền/chữ mà trình duyệt đang tính (getComputedStyle) — không đoán theo CSS nguồn.
 *   2. CHỤP: toàn khối sơ đồ + một mảng cắt phóng to (crop) để soi mép ô, ở nhiều theme.
 * Chạy: node qc-plg-oke.mjs [nhãn]      (nhãn để phân biệt ảnh trước/sau, mặc định "now")
 */
import path from "node:path"; import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer";
import { EDGE_PATH } from "./token-store.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(DIR, "..", "factory", "index.html");
const OUT = path.join(DIR, ".exports");
const NHAN = process.argv[2] || "now";
const THEMES = ["hasaki", "solar", "latte", "tokyo"];
fs.mkdirSync(OUT, { recursive: true });

const b = await puppeteer.launch({ headless: "new", executablePath: EDGE_PATH, args: ["--no-sandbox", "--allow-file-access-from-files"] });
const p = await b.newPage();
await p.setViewport({ width: 1560, height: 1000, deviceScaleFactor: 2 });
const loi = [];
p.on("console", (m) => { if (m.type() === "error") loi.push("console: " + m.text()); });
p.on("pageerror", (e) => loi.push("pageerror: " + e.message));

await p.goto(pathToFileURL(FILE).href, { waitUntil: "networkidle2", timeout: 60000 });
await p.evaluate(() => showTab("plg"));
await p.waitForFunction(() => document.querySelectorAll(".pg-o").length > 0, { timeout: 30000 });
await new Promise((r) => setTimeout(r, 700));

for (const th of THEMES) {
  await p.evaluate((t) => setTheme(t), th);
  await new Promise((r) => setTimeout(r, 350));

  const do_ = await p.evaluate(() => {
    const svg = document.querySelector(".pg-svg");
    const vb = (svg.getAttribute("viewBox") || "").split(/\s+/).map(Number);
    const box = svg.getBoundingClientRect();
    const tyLe = box.width / (vb[2] || 1);          // đơn vị SVG -> px màn hình
    const cells = [...document.querySelectorAll(".pg-o")];
    // ô ĐẠI DIỆN: lấy ô có vạch kho (rect.pg-vach) để đo được cả vạch
    const oc = cells.find((c) => c.querySelector(".pg-vach")) || cells[0];
    const bg = oc.querySelector("rect.bg"), va = oc.querySelector(".pg-vach"), tx = oc.querySelector("text");
    const cs = getComputedStyle(bg), ct = getComputedStyle(tx);
    const r = (el) => el ? el.getBoundingClientRect() : null;
    const px = (v) => Math.round(v * 100) / 100;
    const rb = r(bg), rv = r(va);
    // ô THẤP NHẤT trên bản vẽ — ràng buộc khắt khe nhất cho bo góc / bề rộng vạch
    let thap = cells[0], hMin = 1e9;
    cells.forEach((c) => { const h = r(c.querySelector("rect.bg")).height; if (h < hMin) { hMin = h; thap = c; } });
    return {
      tyLe: px(tyLe),
      oMau: oc.getAttribute("data-l"),
      oPx: px(rb.width) + " x " + px(rb.height),
      oDvi: bg.getAttribute("width") + " x " + bg.getAttribute("height"),
      boGoc_dvi: bg.getAttribute("rx"), boGoc_px: px(Number(bg.getAttribute("rx")) * tyLe),
      vach_dvi: va ? va.getAttribute("width") : "-", vach_px: rv ? px(rv.width) : "-",
      vachBoGoc_dvi: va ? va.getAttribute("rx") : "-",
      vachMau: va ? va.getAttribute("fill") : "-",
      nen: cs.fill, vien: cs.stroke, vienDay: cs.strokeWidth, netDut: cs.strokeDasharray,
      chu: ct.fill, chuVien: ct.stroke,
      oThapNhat_px: px(r(thap.querySelector("rect.bg")).height),
      vachCacMau: [...new Set(cells.map((c) => { const v = c.querySelector(".pg-vach"); return v ? v.getAttribute("fill") : null; }).filter(Boolean))],
      vachBeRong_px: [...new Set(cells.map((c) => { const v = c.querySelector(".pg-vach"); return v ? px(r(v).width) : null; }).filter(Boolean))].sort((a, b) => a - b),
      boGoc_px_dai: [...new Set(cells.map((c) => px(Number(c.querySelector("rect.bg").getAttribute("rx")) * tyLe)))].sort((a, b) => a - b),
      soClip: document.querySelectorAll(".pg-svg defs clipPath").length,
      /* BẮT CHUỘT GIỮA RUỘT Ô — nền trong suốt dễ làm chết vùng bấm (pointer-events:visiblePainted
         chỉ bắt ở phần CÓ TÔ). Bắn thử vào đúng tâm 20 ô: phải ra đúng ô đó, không phải nền SVG. */
      bamTrungTam: (function () {
        let ok = 0;
        cells.slice(0, 20).forEach((c) => {
          const b = r(c.querySelector("rect.bg"));
          const el = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
          if (el && el.closest(".pg-o") === c) ok++;
        });
        return ok + "/20";
      })(),
      soO: cells.length, soONolich: cells.filter((c) => c.classList.contains("vs-nolich")).length,
      nenKhung: getComputedStyle(document.querySelector(".pg-wrap")).backgroundColor,
    };
  });
  console.log("[" + th + "] " + JSON.stringify(do_));

  const wrap = await p.$(".pg-wrap");
  await wrap.screenshot({ path: path.join(OUT, `oke-${NHAN}-${th}.png`) });

  // MẢNG CẮT PHÓNG TO: 8 ô đầu dãy 501 — chỗ duy nhất soi được mép ô/vạch ở cỡ thật
  const crop = await p.evaluate(() => {
    const cells = [...document.querySelectorAll(".pg-o")].filter((c) => c.querySelector(".pg-vach"));
    const rs = cells.slice(0, 8).map((c) => c.getBoundingClientRect());
    const x0 = Math.min(...rs.map((r) => r.left)), y0 = Math.min(...rs.map((r) => r.top));
    const x1 = Math.max(...rs.map((r) => r.right)), y1 = Math.max(...rs.map((r) => r.bottom));
    return { x: x0 - 6, y: y0 - 6, width: x1 - x0 + 12, height: y1 - y0 + 12 };
  });
  await p.screenshot({ path: path.join(OUT, `oke-${NHAN}-${th}-zoom.png`), clip: crop });
}

console.log(loi.length ? "LỖI:\n  " + loi.join("\n  ") : "✓ Không có lỗi console/pageerror.");
console.log("Ảnh: .exports/oke-" + NHAN + "-<theme>[-zoom].png");
await b.close();
