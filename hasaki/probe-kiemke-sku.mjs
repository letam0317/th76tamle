/** probe-kiemke-sku.mjs — CHỈ ĐỌC: tìm phiếu kiểm kê type-SKU đang mở của 1 SKU + nội dung khai. */
import { layTokenSongWms } from "./session-rules.js";
const GW = "https://wms-gw.inshasaki.com";
const SKU = process.argv[2] || "422304497";
const KHO = process.argv[3] || "1177";
const token = await layTokenSongWms(process.cwd(), () => {});
async function goi(p, cty = "1002") {
  const r = await fetch(GW + p, { headers: { authorization: token, "company-ids": cty, "user-agent-type": "web", origin: "https://wms.inshasaki.com", referer: "https://wms.inshasaki.com/" } });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
  return { status: r.status, j, t };
}
const R = (k) => (k.j && (k.j.records || k.j.data || [])) || [];
/* ① các phiếu (plan) gần đây */
const pl = await goi("/api/v1/wms/counting-plans?page=1&size=20&warehouse_ids=" + KHO + "&sort_by=created_at&order_by=desc");
console.log("### counting-plans (kho " + KHO + ") → " + pl.status + " · " + R(pl).length + " phiếu");
R(pl).slice(0, 10).forEach((p) => console.log("   plan " + p.id + " | " + (p.code || p.plan_code || "") + " | " + (p.status_name || p.status) + " | " + (p.checklist_type_name || p.checklist_type || "") + " | " + (p.from_date || p.created_at || "")));
/* ② checklist type-sku của SKU cần tìm, thử từng plan còn mở */
for (const p of R(pl).slice(0, 6)) {
  const c = await goi("/api/v1/wms/counting-plan/checklists/type-sku?page=1&size=50&plan_id=" + p.id + "&keywords=" + SKU);
  const ds = R(c);
  if (!ds.length) { console.log("   plan " + p.id + ": không có dòng khớp SKU " + SKU); continue; }
  console.log("\n### plan " + p.id + " → " + ds.length + " checklist khớp SKU " + SKU);
  for (const cl of ds.slice(0, 5)) {
    console.log("   checklist_id=" + cl.checklist_id + " obj=" + cl.plan_object_code + " status=" + cl.status_name + " nguoi=" + (cl.checklist_by_name || "-") + " diff=" + cl.is_diff);
    const tr = await goi("/api/v1/wms/counting-plan/checklist/tracking?checklist_id=" + cl.checklist_id + "&page=1&size=50");
    for (const t of R(tr)) {
      console.log("     tracking_id=" + t.tracking_id + " sku=" + t.sku + " qty_sys=" + t.qty_by_sys + " qty_user=" + t.qty_by_user +
        "\n       exp_by_sys =" + String(t.exp_by_sys || "").slice(0, 400) +
        "\n       exp_by_user=" + String(t.exp_by_user || "").slice(0, 400));
    }
  }
}
