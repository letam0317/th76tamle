// xuat-pdf.mjs — HTML → PDF bằng Edge (puppeteer-core), A4, in nền. 20/10/2026.
//   node xuat-pdf.mjs <tệp.html> <tệp.pdf>
// Dùng cho báo cáo gửi user (Desktop\Tệp xuất). Ảnh trong HTML dùng đường dẫn file:// tuyệt đối hoặc tương đối với tệp HTML.
import puppeteer from "puppeteer-core";
import path from "node:path";
import { pathToFileURL } from "node:url";
const [html, pdf] = process.argv.slice(2);
if (!html || !pdf) { console.log("node xuat-pdf.mjs <tệp.html> <tệp.pdf>"); process.exit(2); }
const b = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: "new" });
try {
  const p = await b.newPage();
  await p.goto(pathToFileURL(path.resolve(html)).href, { waitUntil: "networkidle0", timeout: 60000 });
  await p.emulateMediaType("print");
  await p.pdf({ path: pdf, format: "A4", printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true, headerTemplate: "<span></span>",
    footerTemplate: '<div style="width:100%;font-size:8px;color:#6b7280;padding:0 14mm;display:flex;justify-content:space-between"><span class="title"></span><span>Trang <span class="pageNumber"></span>/<span class="totalPages"></span></span></div>' });
  console.log("→ " + pdf);
} finally { await b.close(); }
