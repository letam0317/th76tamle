/**
 * capture-task-detail.mjs — READ-ONLY: mở work.hasaki.vn/tasks?task_id=<id> bằng profile Edge
 * đã đăng nhập, ghi lại MỌI request wshr + response để biết endpoint chi tiết task.
 * Không đăng nhập mới (chỉ dùng cookie/profile sẵn có).
 * Chạy: node capture-task-detail.mjs [task_id]
 */
import puppeteer from "puppeteer";
import path from "node:path"; import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { EDGE_PATH, duongDanProfile } from "./token-store.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, ".exports"); fs.mkdirSync(OUT, { recursive: true });
const TASK = process.argv[2] || "12850765";
const log = (...a) => console.log(...a);

const browser = await puppeteer.launch({ headless: true, executablePath: EDGE_PATH, userDataDir: duongDanProfile(DIR), args: ["--disable-blink-features=AutomationControlled"] });
const ev = [];
try {
  const page = (await browser.pages())[0] || (await browser.newPage());
  page.on("response", async (res) => {
    const u = res.url();
    if (!/wshr\.hasaki\.vn\/api/.test(u)) return;
    let body = ""; try { body = (await res.text()).slice(0, 200000); } catch { }
    ev.push({ url: u, status: res.status(), body });
    log(`  [${res.status()}] ${u.replace("https://wshr.hasaki.vn/api", "")}  (${body.length} B)`);
  });
  await page.goto(`https://work.hasaki.vn/tasks?task_id=${TASK}`, { waitUntil: "networkidle2", timeout: 90000 }).catch(() => { });
  await new Promise(r => setTimeout(r, 8000));
  log("URL cuối: " + page.url());
} finally { await browser.close().catch(() => { }); }
fs.writeFileSync(path.join(OUT, `task-detail-${TASK}.json`), JSON.stringify(ev, null, 1));
log(`\n→ ${ev.length} request wshr đã ghi vào .exports/task-detail-${TASK}.json`);
