// nhuong-pc.mjs — CỔNG NHƯỜNG của LAPTOP (máy quản lý): laptop có nên chạy cò gốc <tenViec> lúc này không?
//   node nhuong-pc.mjs <tenViec>   ->  exit 0 = laptop CHẠY · 75 = NHƯỜNG (đã có PC nhận việc này)
// 14/10 user «cho máy trạm chạy xác minh các task còn treo»: laptop thành máy DỰ PHÒNG. Laptop chỉ nhường khi bộ điều phối
//   (cùng luật dieu-phoi.mjs, bảng nhịp tim GAS pcBang — chỉ đọc, KHÔNG gửi nhịp) chọn một PC BẢN MỚI cho việc này.
//   «Bản mới» = nhịp tim có trường chayLuc (PC đã bỏ luật chia vai giờ hành chính, ban ngày chạy thật) — PC bản cũ nhận việc
//   rồi tự bỏ lượt ban ngày, nhường cho nó là không ai làm.
// Không chắc (GAS chậm/lỗi, không PC nào nhận, việc lạ) -> laptop CHẠY như cũ (thà chạy còn hơn bỏ sót).
// Gọi từ _LAPTOP-NHUONG.vbs; ghi 1 dòng vào nhuong-pc.log.
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mayChay } from "./dieu-phoi.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const tenViec = process.argv[2] || "";
const ghi = (ok, ly) => {
  try { fs.appendFileSync(path.join(DIR, "nhuong-pc.log"), `${new Date().toLocaleString("vi-VN")} ${tenViec} -> ${ok ? "LAPTOP CHẠY" : "NHƯỜNG"} (${ly})\n`); } catch { /* */ }
  process.exit(ok ? 0 : 75);
};

let cfg;
try { cfg = JSON.parse(fs.readFileSync(path.join(DIR, "cai-pc", "dieu-phoi.json"), "utf8")); } catch { ghi(true, "không đọc được dieu-phoi.json"); }
const viec = (cfg.viec || []).find((v) => v.ten === tenViec);
if (!viec) ghi(true, "việc không có trong bộ điều phối");

// Thử ngoại tuyến: NHUONG_BANG=<file.json> ({ may:[...], srvNow }) thay cho GAS
if (process.env.NHUONG_BANG) { const t = JSON.parse(fs.readFileSync(process.env.NHUONG_BANG, "utf8")); quyet(t.may, t.srvNow || Date.now()); }
const { gasPost } = await import("./session-rules.js");
const hetGio = new Promise((r) => setTimeout(() => r("__TIMEOUT__"), 10000));
let j;
try { j = await Promise.race([gasPost({ action: "pcBang", key: process.env.APPSCRIPT_KEY }, () => {}, "pcBang nhường"), hetGio]); } catch (e) { ghi(true, "GAS lỗi: " + e.message); }
if (j === "__TIMEOUT__" || !j || j.status !== "success" || !Array.isArray(j.may)) ghi(true, "GAS không trả bảng máy");

quyet(j.may, j.srvNow || Date.now());

function quyet(bang, now) {
  const chon = mayChay(viec, bang, now, cfg);
  if (!chon) ghi(true, "không PC nào đủ điều kiện");
  if (chon === os.hostname()) ghi(true, "điều phối chọn chính laptop");
  const hb = bang.find((m) => m.may === chon);
  if (!hb || !("chayLuc" in hb)) ghi(true, chon + " còn bản cũ (ban ngày tự bỏ lượt) — laptop làm thay");
  ghi(false, chon + " nhận việc này");
}
