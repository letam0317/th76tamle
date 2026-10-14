/* 14/10/2026 user: «Ghi người tác động không qua hệ thống — là bạn xem xác minh qua cam thấy thì ghi lại, k phải t làm».
 *  MÁY ghi (không phải người): xac-minh-tu-dong.mjs bước 7 (camera thấy người ĐẶT/CHẠM đồ vật) + bước 8 (KHÔNG có lệnh WMS khớp ≤3′)
 *  ⇒ một lượt «tác động không qua hệ thống» vào sổ .exports/tac-dong-vat-ly.json với nguon:"may" (bang-591 gộp vào «Ai tác động ô», tô cam).
 *  Clip khoảng VẮNG→CÓ (khoang_<kênh>.mp4) chép sang Videos/5S-bang-chung/<id>_VL-<kênh>.mp4 để pop-up phát được qua /bc/.
 *  Chưa định danh được thì ma = "" + moTa (quần áo/dáng) — KHÔNG đoán tên.
 *
 *  node ghi-tac-dong-may.mjs --quet      quét lại mọi .exports/xm-tu-dong/<id>/BAO-CAO.md đã có (bù cho các lượt chạy trước 14/10)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SO = path.join(DIR, ".exports", "tac-dong-vat-ly.json");
const GOC_BC = path.dirname(process.env.BAIXE_DIR || "C:/Users/lechitam/Videos/5S-bang-chung/bai-xe");
const msOf = (s) => Date.parse(String(s).replace(" ", "T") + "+07:00");
const vn = (ms) => new Date(ms + 7 * 36e5).toISOString().slice(0, 19).replace("T", " ");

/** o = { id, tNguoi(ms), tDauClip(ms), clipFile, kenh, moTa, doChac, viec } → true nếu thêm mới */
export function ghiTacDongMay(o) {
  if (!o.id || !Number.isFinite(o.tNguoi)) return false;
  let so = {}; try { so = JSON.parse(fs.readFileSync(SO, "utf8")); } catch { /* chưa có sổ */ }
  const ds = (so[o.id] ||= []), at = vn(o.tNguoi);
  if (ds.some((v) => v.nguon === "may" && Math.abs(msOf(v.at) - o.tNguoi) < 90e3)) return false;   // đã ghi lượt này
  let clip = "";
  if (o.clipFile && fs.existsSync(o.clipFile)) {
    const ten = o.id + "_VL-" + String(o.kenh || "cam").replace(/[^\w]+/g, "-") + ".mp4";
    try { fs.copyFileSync(o.clipFile, path.join(GOC_BC, ten)); clip = "/bc/" + encodeURIComponent(ten); } catch { /* không chép được thì vẫn ghi lượt */ }
  }
  ds.push({ at, ma: "", viec: o.viec || "Đặt / chạm đồ vật — không có lệnh WMS", moTa: String(o.moTa || "").slice(0, 240), kenh: o.kenh || "",
    clip, tgClip: clip && Number.isFinite(o.tDauClip) ? Math.max(0, Math.round((o.tNguoi - o.tDauClip) / 100) / 10) : null,
    doChac: o.doChac || "", nguon: "may", luc: new Date().toISOString() });
  fs.writeFileSync(SO, JSON.stringify(so, null, 1));
  return true;
}

/* --quet: đọc BAO-CAO.md cũ — chỉ những phiếu kết luận «camera thấy người đặt/chạm đồ vật nhưng không có lệnh WMS khớp» */
if (process.argv.includes("--quet")) {
  const GOC = path.join(DIR, ".exports", "xm-tu-dong"); let them = 0, xet = 0;
  for (const id of fs.readdirSync(GOC).filter((d) => /^\d{6,}$/.test(d))) {
    const f = path.join(GOC, id, "BAO-CAO.md"); if (!fs.existsSync(f)) continue;
    const bc = fs.readFileSync(f, "utf8"); if (!/KẾT LUẬN: camera thấy người đặt\/chạm đồ vật nhưng không có lệnh WMS khớp/.test(bc)) continue;
    xet++;
    const ng = bc.match(/^(?:- )?(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d) người đặt\/chạm đồ vật: (.*?) \(nguồn:/m); if (!ng) continue;
    const vang = bc.match(/^- (\d{4}-\d\d-\d\d \d\d:\d\d:\d\d) VẮNG\/khác/m);
    const kenh = (bc.match(/^GÓC CAMERA: (\S+)/m) || [])[1] || "";
    const ch = kenh.split("/")[1], clipFile = ch ? path.join(GOC, id, "khoang_" + ch + ".mp4") : "";
    const doChac = (bc.match(/ĐỘ CHẮC: (\S+)/) || [])[1] || "";
    if (ghiTacDongMay({ id, tNguoi: msOf(ng[1]), tDauClip: vang ? msOf(vang[1]) - 3000 : NaN, clipFile, kenh, moTa: ng[2], doChac })) { them++; console.log("  + " + id + " " + ng[1] + " · " + kenh); }
  }
  console.log("quét " + xet + " phiếu có người tác động không lệnh WMS → ghi mới " + them + " lượt");
}
