// Tạm 01/10: mọi thao tác WMS (lấy ra + cất vào) ở 1 ô trong khoảng giờ.  node _wms-o.mjs <bin> <từ ISO VN> <đến ISO VN>
import "dotenv/config"; import { layTokenSongWork } from "./session-rules.js";
const [bin, tu, den] = process.argv.slice(2);
const WMS = "https://wms-gw.inshasaki.com/api/v1";
const tok = (await layTokenSongWork(process.cwd(), () => {})).replace(/^Bearer /, "");
const H = { authorization: "Bearer " + tok, "Company-Ids": "1001", "user-agent-type": "web" };
const from = new Date(tu + "+07:00").getTime(), to = new Date(den + "+07:00").getTime();
const ds = [];
for (const k of ["bin_in", "bin_out"]) {
  const q = { page: 1, size: 200, warehouse_id: 863, [k]: bin, from_date: from, to_date: to };
  const j = await (await fetch(WMS + "/wms/transfer-bins?" + new URLSearchParams(q), { headers: H, signal: AbortSignal.timeout(150000) })).json();
  for (const x of j.records || []) if (x[k] === bin) ds.push({ chieu: k === "bin_in" ? "CẤT VÀO" : "LẤY RA", ...x });
}
ds.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
if (process.env.TH) console.log(JSON.stringify(ds[0],null,1));
for (const x of ds) console.log(String(x.created_at).slice(5, 16), x.chieu, x.sku, "SL", x.quantity, "·", x.created_by_name || x.created_name || x.created_by, "·", x.transfer_type, "· từ", x.bin_out, "→", x.bin_in, "· st", x.status);
console.log("tổng", ds.length);
