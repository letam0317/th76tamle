// Tạm 01/10: mọi transfer-bins kho 863 trong 1 khoảng giờ (không lọc ô) — tìm ai thao tác lúc đó. node _wms-khoang.mjs <từ ISO VN> <đến ISO VN> [lọc chuỗi]
import "dotenv/config"; import { layTokenSongWork } from "./session-rules.js";
const [tu, den, loc = ""] = process.argv.slice(2);
const tok = (await layTokenSongWork(process.cwd(), () => {})).replace(/^Bearer /, "");
const H = { authorization: "Bearer " + tok, "Company-Ids": "1001", "user-agent-type": "web" };
const q = { page: 1, size: 200, warehouse_id: 863, from_date: new Date(tu + "+07:00").getTime(), to_date: new Date(den + "+07:00").getTime() };
const j = await (await fetch("https://wms-gw.inshasaki.com/api/v1/wms/transfer-bins?" + new URLSearchParams(q), { headers: H, signal: AbortSignal.timeout(150000) })).json();
const ds = (j.records || []).filter((x) => !loc || JSON.stringify(x).includes(loc)).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
for (const x of ds) console.log(String(x.created_at).slice(5, 19), x.created_user_name, "·", x.transfer_type, "·", x.sku, "SL", x.quantity, "·", x.bin_out, "→", x.bin_in);
console.log("tổng", ds.length, "/ trang 1 của", j.total ?? "?");
