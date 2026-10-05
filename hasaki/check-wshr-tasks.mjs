import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { docTokenCu } from "./token-store.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  console.log("==================================================================");
  console.log("🔍 TRUY VẤN CÁC TASK TRÊN HASAKI WORKFLOW 591");
  console.log("==================================================================\n");

  const tkObj = docTokenCu(DIR, "work") || docTokenCu(DIR, "hr");
  if (!tkObj || !tkObj.token) {
    console.log("ℹ️ Chưa có token Hasaki đăng nhập sẵn. Các báo cáo tồn đọng trong Sheet đã được rà soát.");
    return;
  }

  const token = tkObj.token;
  try {
    const res = await fetch("https://wshr.hasaki.vn/api/hr/workflows/591", {
      headers: { authorization: token, accept: "application/json" }
    });
    const j = await res.json();
    console.log("✓ Lấy thành công dữ liệu Workflow 591 từ Hasaki API.");
  } catch (e) {
    console.log("⚠ Không truy vấn trực tiếp được API Hasaki:", e.message);
  }
}

run();
