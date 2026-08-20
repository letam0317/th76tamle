/**
 * do-toc-do-in.mjs — ĐO ĐỘ TRỄ ĐƯỜNG IN TEM, ĐÚNG NHƯ NGƯỜI DÙNG BẤM.
 * ============================================================================================
 *  Đi đúng đường của dashboard: `pr_them` vào hàng đợi → agent nhặt → dựng tem → (gửi máy in) →
 *  `pr_trangthai` cho tới khi xong. In ra từng chặng mất bao nhiêu giây.
 *
 *  MẶC ĐỊNH LÀ CHẾ ĐỘ ĐO: KHÔNG tốn con tem nào (agent dựng đủ tem rồi bỏ). Ngày 20/08/2026 tôi đo
 *  bằng cách in thật và 7 con tem thật đã ra khỏi máy in cho việc không ai cần — đo tốc độ là việc
 *  còn làm lại nhiều lần, nên nó phải không tốn vật tư.
 *
 *  CÁCH DÙNG
 *    node do-toc-do-in.mjs                 # đo, không in gì (mặc định)
 *    node do-toc-do-in.mjs --lan 3         # đo 3 lượt
 *    node do-toc-do-in.mjs --in-that       # IN THẬT 1 con tem (chỉ khi cần nghiệm thu giấy)
 */
import "dotenv/config";

const U = process.env.APPSCRIPT_URL, K = process.env.APPSCRIPT_KEY;
if (!U) { console.error("Thiếu APPSCRIPT_URL trong hasaki/.env"); process.exit(2); }
const argv = process.argv.slice(2);
const co = (t) => argv.includes(t);
const so = (t, mac) => { const i = argv.indexOf(t); return i >= 0 && argv[i + 1] ? Number(argv[i + 1]) : mac; };
const inThat = co("--in-that");
const soLan = Math.max(1, so("--lan", 1));

const goi = async (b) => {
  const t = await (await fetch(U, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(b) })).text();
  return JSON.parse(t);
};

console.log(inThat ? "⚠ IN THẬT — sẽ có tem ra khỏi máy in." : "Chế độ ĐO — agent dựng tem rồi bỏ, không tốn con tem nào.");

for (let lan = 1; lan <= soLan; lan++) {
  const t0 = Date.now();
  const g = () => ((Date.now() - t0) / 1000).toFixed(1) + "s";
  const dong = [{ sku: "422430797", sl: 1, slHang: "1200", mau: "t40x60",
    pn: "Quần mẫu FT/SMPA01/87% Nylon, 13% Lycra/None/Deep Black/Size S" }];
  const them = await goi({ action: "pr_them", nguoi: "do-toc-do@hasaki.vn", dong: JSON.stringify(dong), thu: inThat ? 0 : 1 });
  console.log("lượt " + lan + " · " + g() + "  gửi hàng đợi" +
    (them.agentTre >= 0 ? " (agent trả lời cách đây " + (them.agentTre / 1000).toFixed(1) + "s)" : " (CHƯA THẤY AGENT — máy trạm tắt?)"));
  if (!them.id) { console.error("  ✗ hàng đợi không nhận: " + (them.message || JSON.stringify(them))); break; }

  let daNhat = false;
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, Date.now() - t0 < 12000 ? 700 : 2500));
    const tt = await goi({ action: "pr_trangthai", id: them.id });
    if (tt.trangThai === "dang_in" && !daNhat) { daNhat = true; console.log("          " + g() + "  agent đã nhặt lệnh"); }
    if (tt.trangThai === "xong") { console.log("          " + g() + "  ✓ xong — " + tt.ghiChu); break; }
    if (tt.trangThai === "loi") { console.log("          " + g() + "  ✗ lỗi — " + tt.ghiChu); break; }
  }
}
console.log("Chi tiết từng chặng (tra tên · dựng ảnh · gửi máy in): xem hasaki/.in-tem-agent.log");
