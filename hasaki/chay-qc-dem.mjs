// chay-qc-dem.mjs — CHẠY BỘ ĐO TỰ ĐỘNG HẰNG ĐÊM · 20/10/2026
// Đánh giá 20/10: 82 bộ đo qc-*.mjs chỉ chạy tay theo phiên → luật không ai gác giữa các phiên. Task «5S QC hang dem» 02:30 (laptop):
// chạy lần lượt các bộ đo trong cai-pc/qc-dem.json (chỉ bộ CHỈ-ĐỌC, chặn POST, đã chạy ổn), mỗi bộ có trần phút; ghi kết quả
// .exports/qc-dem.json {luc, tong, dat, hong, ds:[{ten, ma, giay, cuoi}]} → máy chủ 8591 /api/qc-dem (tab Máy trạm hiện — làm sau).
//   node chay-qc-dem.mjs [--chi=qc-ma-tinh,qc-may-tram] [--tran=20]
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const A = Object.fromEntries(process.argv.slice(2).filter((x) => x.startsWith("--")).map((x) => { const [k, v] = x.slice(2).split("="); return [k, v ?? "1"]; }));
const CFG = JSON.parse(fs.readFileSync(path.join(DIR, "cai-pc", "qc-dem.json"), "utf8"));
const DS = (A.chi ? A.chi.split(",").map((t) => CFG.ds.find((x) => x.ten === t) || { ten: t }) : CFG.ds);
const log = (...a) => { const d = new Date().toTimeString().slice(0, 8) + " " + a.join(" "); console.log(d); try { fs.appendFileSync(path.join(DIR, "qc-dem.log"), d + "\n"); } catch { /* */ } };
const KHOA = path.join(DIR, ".exports", ".qc-dem.lock");
try { if (Date.now() - fs.statSync(KHOA).mtimeMs < 3 * 36e5) { log("đang có lượt khác chạy — thoát"); process.exit(0); } } catch { /* */ }
fs.writeFileSync(KHOA, String(process.pid));

const chay = (x) => new Promise((res) => {
  const t0 = Date.now(), tran = (Number(x.tranPhut || A.tran || CFG.tranPhut || 15)) * 60e3, tep = path.join(DIR, x.ten + ".mjs");
  if (!fs.existsSync(tep)) return res({ ten: x.ten, ma: -2, giay: 0, cuoi: "không có tệp" });
  let ra = ""; const c = spawn(process.execPath, [tep, ...(x.doi || [])], { cwd: DIR, windowsHide: true, env: { ...process.env, QC_DEM: "1" } });
  c.stdout.on("data", (d) => { ra += d; if (ra.length > 400000) ra = ra.slice(-200000); }); c.stderr.on("data", (d) => { ra += d; });
  const h = setTimeout(() => { c.kill(); ra += "\n(quá " + tran / 60e3 + " phút — dừng)"; }, tran);
  c.on("close", (ma) => { clearTimeout(h); const dong = ra.trim().split(/\r?\n/).filter(Boolean); res({ ten: x.ten, ma, giay: Math.round((Date.now() - t0) / 1000), cuoi: (dong.slice(-2).join(" | ")).slice(0, 240) }); });
  c.on("error", (e) => { clearTimeout(h); res({ ten: x.ten, ma: -1, giay: 0, cuoi: e.message }); });
});

const KQ = { luc: new Date().toISOString(), ds: [] };
log(`bắt đầu ${DS.length} bộ đo`);
for (const x of DS) { const r = await chay(x); KQ.ds.push(r); log(`${r.ma === 0 ? "ĐẠT " : "HỎNG"} ${r.ten} · ${r.giay}s · ${r.cuoi.slice(0, 120)}`); fs.writeFileSync(path.join(DIR, ".exports", "qc-dem.json"), JSON.stringify({ ...KQ, dangChay: x.ten }, null, 1)); }
KQ.tong = KQ.ds.length; KQ.dat = KQ.ds.filter((r) => r.ma === 0).length; KQ.hong = KQ.tong - KQ.dat; KQ.xongLuc = new Date().toISOString();
fs.writeFileSync(path.join(DIR, ".exports", "qc-dem.json"), JSON.stringify(KQ, null, 1));
try { fs.unlinkSync(KHOA); } catch { /* */ }
log(`xong: ${KQ.dat}/${KQ.tong} đạt`);
process.exit(KQ.hong ? 1 : 0);
