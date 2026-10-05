import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { gasPost, gasGetText } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const APPSCRIPT_KEY = process.env.APPSCRIPT_KEY;
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);

async function run() {
  console.log("==================================================================");
  console.log("🔍 ĐỌC DỮ LIỆU APPS SCRIPT / SHEET CHO VỊ TRÍ F0-A1-515-08-01-06");
  console.log("==================================================================\n");

  if (!APPSCRIPT_KEY) {
    console.log("✗ Thiếu APPSCRIPT_KEY");
    return;
  }

  // 1. Check pending rows
  log("📌 Đang đọc pending rows từ Apps Script...");
  try {
    const jPending = await gasPost({ action: "pending", key: APPSCRIPT_KEY }, log, "pending");
    if (jPending && Array.isArray(jPending.rows)) {
      log(`Tìm thấy ${jPending.rows.length} pending rows.`);
      const match = jPending.rows.find(r => String(r.viTri || "").includes("515-08-01-06"));
      if (match) {
        console.log("\n--- BÁO CÁO PENDING CHO 515-08-01-06 ---");
        console.log(JSON.stringify(match, null, 2));
      } else {
        log("Không thấy 515-08-01-06 trong pending rows (có thể đã được đẩy task).");
      }
    }
  } catch (e) {
    log("Lỗi read pending:", e.message);
  }

  // 2. Read Sheet tab (AUDIT 5S or similar)
  log("\n📌 Đang thử đọc tab Sheet 5S...");
  try {
    const txt = await gasGetText("action=readTab&tab=WMS-5S-AUDIT&callback=cb", log, "readTab WMS-5S-AUDIT");
    const m = txt.match(/^\s*(?:\/\*\*\/)?cb\(([\s\S]*)\)\s*;?\s*$/);
    if (m) {
      const j = JSON.parse(m[1]);
      if (j && Array.isArray(j.rows)) {
        log(`Đọc được ${j.rows.length} dòng từ tab WMS-5S-AUDIT.`);
        const matches = j.rows.filter(r => JSON.stringify(r).includes("515-08-01-06") || JSON.stringify(r).includes("4QO31XHX"));
        console.log(`\nTìm thấy ${matches.length} dòng liên quan đến 515-08-01-06 / 4QO31XHX:`);
        matches.forEach(r => console.log(JSON.stringify(r, null, 2)));
      }
    } else {
      log("Không parse được JSONP readTab:", txt.slice(0, 150));
    }
  } catch (e) {
    log("Lỗi readTab:", e.message);
  }
}

run();
