/* Mở factory/index.html trong Edge headless rồi in ra MỌI lỗi JS — dùng khi bộ test đổ ngay từ ca đầu. */
import puppeteer from "puppeteer-core";
import path from "node:path";
import { fileURLToPath } from "node:url";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const F = "file:///" + path.join(DIR, "..", "factory", "index.html").replace(/\\/g, "/");
const EDGE = process.env.EDGE_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const b = await puppeteer.launch({ executablePath: EDGE, headless: "new", args: ["--no-sandbox"] });
const p = await b.newPage();
p.on("pageerror", (e) => console.log("PAGEERROR: " + e.message));
p.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE ERR: " + m.text().slice(0, 200)); });
await p.goto(F, { waitUntil: "domcontentloaded" });
await new Promise((r) => setTimeout(r, 2500));
const co = await p.evaluate(() => ({
  prVe: typeof prVe, prCam: typeof prCam, PR_TEM: typeof PR_TEM, soTay: typeof ndsSoDem === "function" ? ndsSoDem() : "?",
}));
console.log("trang thai: " + JSON.stringify(co));
await b.close();
