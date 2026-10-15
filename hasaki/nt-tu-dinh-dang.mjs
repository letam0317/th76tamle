/* nt-tu-dinh-dang.mjs — 15/10/2026 user «tự trình bày lại khi có dòng mới» (sheet Nghiệm thu checklist kiểm kê).
 * Gọi GAS nt_tu_dinh_dang: máy chủ so dấu vân bảng (số dòng/cột + STT + dòng có Checklist), chỉ trình bày lại
 * khi bảng đổi — không đổi thì ~1 s, không ghi gì. Chạy kèm lịch 15' DAY-BAO-CAO-5S.bat; form nghiệm thu
 * cũng tự gọi mỗi lần tải danh sách. 0 lượt gọi work/wms/hr. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.join(DIR, ".env"), "utf8");
const lay = (k) => { const m = env.match(new RegExp("^" + k + "\\s*=\\s*\"?([^\"\\r\\n]+)\"?", "m")); return m ? m[1].trim() : ""; };
const url = lay("APPSCRIPT_URL"), key = lay("APPSCRIPT_KEY");
const gio = () => new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

for (let lan = 1; lan <= 3; lan++) {
  try {
    const t = await (await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ action: "nt_tu_dinh_dang", key }), signal: AbortSignal.timeout(120000) })).text();
    const j = JSON.parse(t);   // GAS chập chờn trả trang HTML 404 → JSON.parse ném lỗi → thử lại
    console.log(`[${gio()}] nghiệm thu: ${j.status !== "success" ? "LỖI " + j.message : j.doi ? `đã trình bày lại (${j.dong} dòng, ${j.nhom} nhóm)` : "bảng không đổi"}`);
    process.exit(0);
  } catch (e) {
    console.log(`[${gio()}] nghiệm thu: lượt ${lan} hỏng — ${e.message}`);
  }
}
