// nhuong-pc.mjs — CỔNG NHƯỜNG của LAPTOP (máy quản lý): laptop có nên chạy cò gốc <tenViec> lúc này không?
//   node nhuong-pc.mjs <tenViec>          ->  exit 0 = laptop CHẠY · 75 = NHƯỜNG (đã có PC nhận việc này)
//   node nhuong-pc.mjs <tenViec> --xong   ->  báo GAS việc đã xong (gọi sau khi cò chạy xong)
// 14/10 user «cho máy trạm chạy xác minh các task còn treo»: laptop thành máy DỰ PHÒNG. Laptop chỉ nhường khi bộ điều phối
//   (cùng luật dieu-phoi.mjs, bảng nhịp tim GAS pcBang — chỉ đọc, KHÔNG gửi nhịp) chọn một PC BẢN MỚI cho việc này.
//   «Bản mới» = nhịp tim có trường chayLuc (PC đã bỏ luật chia vai giờ hành chính, ban ngày chạy thật) — PC bản cũ nhận việc
//   rồi tự bỏ lượt ban ngày, nhường cho nó là không ai làm.
// Không chắc (GAS chậm/lỗi, không PC nào nhận, việc lạ) -> laptop CHẠY như cũ (thà chạy còn hơn bỏ sót).
// 14/10 user «đang chạy công việc gì cũng cần hiển thị»: laptop CHẠY → báo GAS pcPhu (bắt đầu / xong) → tab Máy trạm thấy
//   laptop đang làm thay việc gì (nhịp tim laptop gửi từ bản cài C:\AuditFactory, không biết các cò gốc này).
// Gọi từ _LAPTOP-NHUONG.vbs; ghi 1 dòng vào nhuong-pc.log. Thử ngoại tuyến: NHUONG_BANG=<file.json> ({ may:[...], srvNow }).
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mayChay } from "./dieu-phoi.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const tenViec = process.argv[2] || "";
const XONG = process.argv.includes("--xong");
const nhatKy = (s) => { try { fs.appendFileSync(path.join(DIR, "nhuong-pc.log"), `${new Date().toLocaleString("vi-VN")} ${tenViec} -> ${s}\n`); } catch { /* */ } };

async function baoGas(xong) {   // chỉ để hiển thị — lỗi thì thôi, không chặn cò
  if (process.env.NHUONG_BANG) return;
  try {
    const { gasPost } = await import("./session-rules.js");
    await Promise.race([gasPost({ action: "pcPhu", key: process.env.APPSCRIPT_KEY, may: os.hostname(), viec: tenViec, xong }, () => {}, "pcPhu"),
      new Promise((r) => setTimeout(r, 10000))]);
  } catch { /* */ }
}
async function ghi(ok, ly) {
  nhatKy((ok ? "LAPTOP CHẠY" : "NHƯỜNG") + " (" + ly + ")");
  if (ok) await baoGas(false);
  process.exit(ok ? 0 : 75);
}

if (XONG) { await baoGas(true); nhatKy("xong"); process.exit(0); }

let cfg;
try { cfg = JSON.parse(fs.readFileSync(path.join(DIR, "cai-pc", "dieu-phoi.json"), "utf8")); } catch { await ghi(true, "không đọc được dieu-phoi.json"); }
const viec = (cfg.viec || []).find((v) => v.ten === tenViec);
if (!viec) await ghi(true, "việc không có trong bộ điều phối");

async function quyet(bang, now) {
  if (viec.chiLaptop) await ghi(true, "việc chỉ chạy trên laptop (cần dữ liệu .exports)");   // 14/10 ghim laptop
  const chon = mayChay(viec, bang, now, cfg);
  if (!chon) await ghi(true, "không PC nào đủ điều kiện");
  if (chon === os.hostname()) await ghi(true, "điều phối chọn chính laptop");
  const hb = bang.find((m) => m.may === chon);
  if (!hb || !("chayLuc" in hb)) await ghi(true, chon + " còn bản cũ (ban ngày tự bỏ lượt) — laptop làm thay");
  /* 14/10 13:58: QLIT lên bản mới, laptop nhường planogram 13:55 nhưng QLIT không ghi nhận lần chạy nào → có thể bỏ sót lượt.
     Chỉ nhường khi PC đã CÓ BẰNG CHỨNG chạy thật (chayLuc có lượt trong 3 giờ qua); chưa có → laptop vẫn làm (trùng còn hơn sót). */
  const ganNhat = Math.max(0, ...Object.values(hb.chayLuc || {}).map((x) => Date.parse(x) || 0));
  if (now - ganNhat > 3 * 36e5) await ghi(true, chon + " bản mới nhưng chưa có lượt chạy nào trong 3 giờ — laptop vẫn làm");
  /* 14/10 18:30 LỖ HỔNG: laptop (luật mới) tính tim-bang-chung/canh-b11 thuộc FOQ5T89 nên nhường, nhưng FOQ5T89 (luật CŨ) tính thuộc JE
     → 2 lượt KHÔNG AI CHẠY. Máy lệch phiên bản thì «mọi máy tính ra cùng kết quả» sai ⇒ chỉ nhường khi CHÍNH PC ĐÓ báo việc là của nó
     (viecGiao trong nhịp tim — PC tự tính bằng luật của chính nó). PC không nhận → laptop làm. */
  if (!(hb.viecGiao || []).includes(viec.ten)) await ghi(true, chon + " chưa tự nhận việc này (bảng giao của chính nó khác — lệch phiên bản) — laptop làm");
  /* 14/10 23:40 LỖ HỔNG: QLIT tự nhận planogram nhưng KHÔNG CÓ task «5S DP co-canh-planogram» (chỉ 4/13 task) → laptop nhường, không ai chạy.
     PC có báo trạng thái task (taskDP) mà thiếu task của việc này → laptop làm. */
  if ((hb.taskDP || []).length && !(hb.taskDP || []).some((d) => String(d).startsWith("5S DP " + viec.ten + "|"))) await ghi(true, chon + " không có task của việc này — laptop làm");
  await ghi(false, chon + " nhận việc này (chính nó cũng tự nhận)");
}

if (process.env.NHUONG_BANG) { const t = JSON.parse(fs.readFileSync(process.env.NHUONG_BANG, "utf8")); await quyet(t.may, t.srvNow || Date.now()); }
const { gasPost } = await import("./session-rules.js");
/* 16/10 16:35 LỖ HỔNG: GAS chập chờn 1 lượt → laptop chạy canh-b11 TRÙNG lúc JE75K38 cũng đang chạy (3 lượt «GAS không trả bảng máy»
   15:55–16:35). Nay: hỏi GAS tối đa 2 lần; vẫn hỏng thì dùng bảng nhớ lần thành công gần nhất nếu ≤ 5 phút tuổi — đồng hồ được dời theo
   thời gian đã trôi nên PC mất nhịp vẫn bị coi là chết như thường (sót không xảy ra hơn trước). Bảng nhớ cũ hơn → laptop chạy như cũ. */
const CACHE = path.join(DIR, ".nhuong-bang-cache.json");
const hoiGas = async () => { try { return await Promise.race([gasPost({ action: "pcBang", key: process.env.APPSCRIPT_KEY }, () => {}, "pcBang nhường"), new Promise((r) => setTimeout(() => r(null), 10000))]); } catch { return null; } };
const tot = (x) => x && x.status === "success" && Array.isArray(x.may);
let j = await hoiGas();
if (!tot(j)) j = await hoiGas();
if (tot(j)) {
  try { fs.writeFileSync(CACHE, JSON.stringify({ luc: Date.now(), srvNow: j.srvNow || Date.now(), may: j.may })); } catch { /* */ }
  await quyet(j.may, j.srvNow || Date.now());
}
let nho = null;
try { nho = JSON.parse(fs.readFileSync(CACHE, "utf8")); } catch { /* */ }
const tuoi = nho ? Date.now() - nho.luc : Infinity;
if (!nho || !Array.isArray(nho.may) || !(tuoi >= 0 && tuoi <= 5 * 6e4)) await ghi(true, "GAS không trả bảng máy");
nhatKy(`(GAS hỏng 2 lần — dùng bảng nhớ ${Math.round(tuoi / 1000)} giây trước)`);
await quyet(nho.may, nho.srvNow + tuoi);
