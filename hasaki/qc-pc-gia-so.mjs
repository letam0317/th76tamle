// qc-pc-gia-so.mjs — so dữ liệu xác minh của «PC giả» (thư mục này) với laptop, từng byte.  node qc-pc-gia-so.mjs [thư mục laptop]
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { tepMay } from "./dong-bo-xm.mjs";

const LAP = process.argv[2] || "C:/Users/lechitam/New folder/hasaki";
const h = (f) => { try { return crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex"); } catch { return "THIEU"; } };
const ds = tepMay(["vao", "chung"]);
const lap = new Set(fs.readdirSync(LAP).length ? [] : []);
let khop = 0; const lech = [];
for (const f of ds) (h(f.abs) === h(path.join(LAP, f.ten)) ? khop++ : lech.push(f.ten));
console.log(`PC giả có ${ds.length} tệp · khớp laptop ${khop} · lệch ${lech.length}`);
for (const x of lech.slice(0, 10)) console.log("  lệch:", x);
process.exit(lech.length ? 1 : 0);
