// dam-bao-mo-hinh.mjs — đảm bảo có mô hình dò NGƯỜI COCO-SSD (.cache-model/ssd_mobilenet_v2, 65 MB, ngoài git) trước khi chạy cò.
// 14/10: PC cài bằng bộ cài KHÔNG có thư mục này → dò người (_nguoi-trong-vung, canh-bai-xe, _clip-noi…) hỏng. Thiếu thì tải từ
//   nguồn chính thức TensorFlow (đã so: model.json trùng từng byte bản laptop). Có đủ rồi thì thoát ngay (0 lượt mạng).
//   node dam-bao-mo-hinh.mjs      ·  import { damBaoMoHinh } from "./dam-bao-mo-hinh.mjs"
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const MDIR = path.join(DIR, ".cache-model", "ssd_mobilenet_v2");
const GOC = "https://storage.googleapis.com/tfjs-models/savedmodel/ssd_mobilenet_v2/";

export async function damBaoMoHinh(log = console.log) {
  const mj = path.join(MDIR, "model.json");
  let can = [];
  try {
    const m = JSON.parse(fs.readFileSync(mj, "utf8"));
    can = (m.weightsManifest || []).flatMap((w) => w.paths || []).filter((p) => !fs.existsSync(path.join(MDIR, p)));
    if (!can.length) return true;                                   // đủ rồi
  } catch { can = null; }                                            // chưa có model.json
  fs.mkdirSync(MDIR, { recursive: true });
  const tai = async (ten) => {
    const r = await fetch(GOC + ten, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error(ten + " HTTP " + r.status);
    const tam = path.join(MDIR, ten + ".tam"); fs.writeFileSync(tam, Buffer.from(await r.arrayBuffer())); fs.renameSync(tam, path.join(MDIR, ten));
  };
  if (can === null) { await tai("model.json"); can = JSON.parse(fs.readFileSync(mj, "utf8")).weightsManifest.flatMap((w) => w.paths); }
  for (const p of can) await tai(p);
  log(`mô hình dò người: đã tải ${can.length} phần từ nguồn TensorFlow → ${MDIR}`);
  return true;
}

if (process.argv[1] && path.basename(process.argv[1]) === "dam-bao-mo-hinh.mjs") {
  damBaoMoHinh().then(() => console.log("mô hình dò người: đủ"), (e) => { console.error("LỖI tải mô hình:", e.message); process.exit(1); });
}
