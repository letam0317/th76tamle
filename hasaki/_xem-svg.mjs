// Kết xuất SVG sơ đồ ra PNG để soi bằng mắt
import puppeteer from "puppeteer";
import { EDGE_PATH } from "./token-store.js";
import fs from "node:fs";
import path from "node:path";

const svg = process.argv[2];
const png = process.argv[3] || svg.replace(/\.svg$/, ".png");
const w = Number(process.argv[4] || 1800);

const b = await puppeteer.launch({ headless: "new", executablePath: EDGE_PATH, args: ["--no-sandbox"] });
const p = await b.newPage();
await p.setViewport({ width: w, height: Math.round(w * 0.72), deviceScaleFactor: 1 });
await p.goto("file:///" + path.resolve(svg).replace(/\\/g, "/"), { waitUntil: "load", timeout: 120000 });
await p.screenshot({ path: png, fullPage: true });
await b.close();
console.log("→ " + png + "  " + (fs.statSync(png).size / 1024).toFixed(0) + " KB");
