/**
 * don-ban-ro-du-phong.mjs — DỌN BẢN RÕ do bản dự phòng Xác minh để lại trên PC (22/10/2026).
 *
 *  22/10 user: «máy gương clip dự phòng phải để cả admin của máy đó cũng KHÔNG xem được clip lẫn dữ liệu Xác minh». Bản dự phòng nay chỉ giữ
 *  bản mã (guong-ma-hoa.mjs). Trước đó PC đã có BẢN RÕ do chính bản dự phòng để lại — dọn đúng những thứ ấy, KHÔNG đụng tệp PC tự sinh:
 *   ① gương bản rõ (sổ <BC>/.guong-clip-so.json liệt kê từng tệp gương đã ghi) → xoá đúng các tệp trong sổ + sổ;
 *   ② ảnh nhỏ bản rõ .exports/.thu-cache (chỉ bang-591 /thu sinh — trên PC chỉ bản dự phòng chạy bang-591);
 *   ③ dữ liệu bước «kéo kho Drive 15'» (dấu .du-phong-keo): tệp nhóm vao/chung/ra của cai-pc/dong-bo-xm.json + bản gốc gộp .exports/.dbxm-goc.
 *      CHỈ khi máy này CHƯA TỪNG chạy cò xác minh (dong-bo-xm.log không có dòng «[tên việc]» của chay-xm) và không có chay-xm đang chạy
 *      (dò lỗi → coi như đang chạy, không xoá). Máy từng chạy cò: dữ liệu đó là đầu vào/kết quả của chính cò ⇒ giữ, ghi log.
 *      «@BC/bai-xe/<ngày>/ket-qua.json» chỉ xoá khi thư mục ngày đó KHÔNG có tệp nào khác (có ảnh/clip = máy tự chạy cò bãi xe).
 *  Gọi từ may-chu-du-phong.mjs (máy đang giữ việc dự phòng) VÀ nhip-pc.mjs (mọi PC, 1'/lần — máy đã thôi làm dự phòng như QLIT cũng được dọn).
 *  Rẻ: không có dấu nào (sổ gương / .thu-cache / .du-phong-keo) thì không làm gì. Chỉ PC (RUNNER_VAI=pc), chỉ khi XM_MA_HOA khác "0".
 *  Kết quả lượt dọn: .du-phong-da-don.json (số tệp, không có tên tệp).
 *    node don-ban-ro-du-phong.mjs [--thu]     (--thu: chỉ liệt kê, không xoá; chạy được cả trên laptop để soát)
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ghiJson } from "./so-ghi.mjs";
import { kiemRel } from "./guong-clip-chung.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));

/** o = { thu, bc (thư mục bằng chứng), dir (thư mục hasaki), log, coChayXm (hàm thử) } → { gương, anhNho, keo, giu } */
export async function donBanRo(log = () => {}, o = {}) {
  const ep = !!o.ep;   // QC: bỏ qua kiểm vai PC
  if (!ep && (String(process.env.RUNNER_VAI || "").toLowerCase() !== "pc" || process.env.XM_MA_HOA === "0")) return null;
  const dir = o.dir || DIR, bc = o.bc || path.dirname(process.env.BAIXE_DIR || "C:/Users/lechitam/Videos/5S-bang-chung/bai-xe");
  const SO = path.join(bc, ".guong-clip-so.json"), THU = path.join(dir, ".exports", ".thu-cache"), KEO = path.join(dir, ".du-phong-keo");
  const coSo = fs.existsSync(SO), coThu = fs.existsSync(THU), coKeo = fs.existsSync(KEO);
  if (!coSo && !coThu && !coKeo) return null;
  const kq = { guong: 0, anhNho: 0, keo: 0, giu: "", thu: !!o.thu };
  const xoa = (f) => { if (o.thu) return true; try { fs.rmSync(f, { force: true }); return true; } catch { return false; } };
  // ① gương bản rõ — chỉ tệp có trong sổ, đường dẫn hợp lệ, nằm trong thư mục bằng chứng
  if (coSo) {
    let so = {}; try { so = JSON.parse(fs.readFileSync(SO, "utf8")); } catch { /* sổ hỏng: không đoán, không xoá gì ngoài sổ */ }
    for (const rel of Object.keys(so)) {
      if (kiemRel(rel)) continue;
      const f = path.resolve(bc, ...rel.split("/")); if (!f.startsWith(path.resolve(bc) + path.sep)) continue;
      if (fs.existsSync(f) && xoa(f)) kq.guong++;
    }
    xoa(SO);
  }
  // ② ảnh nhỏ bản rõ
  if (coThu) { try { kq.anhNho = fs.readdirSync(THU).length; } catch { /* */ } if (!o.thu) try { fs.rmSync(THU, { recursive: true, force: true }); } catch { /* */ } }
  // ③ dữ liệu kéo từ kho Drive
  if (coKeo) {
    let daChayCo = false;
    try { daChayCo = /^\d\d:\d\d:\d\d \[[\w.-]+\] /m.test(fs.readFileSync(path.join(dir, "dong-bo-xm.log"), "utf8")); } catch { /* chưa có log = chưa chạy */ }
    let dangChay = true;
    try {
      dangChay = o.coChayXm ? !!o.coChayXm() : /chay-xm\.mjs/.test(String(execFileSync("powershell.exe", ["-NoProfile", "-Command",
        "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Select-Object -ExpandProperty CommandLine"], { encoding: "utf8", windowsHide: true, timeout: 30000 })));
    } catch { dangChay = true; }   // FAIL-CLOSED: không dò được thì coi như cò đang chạy
    if (daChayCo || dangChay) kq.giu = daChayCo ? "máy này từng chạy cò xác minh — dữ liệu là của chính cò, giữ" : "có chay-xm đang chạy / không dò được — để lượt sau";
    else {
      const ds = o.tepMay ? o.tepMay() : (await import("./dong-bo-xm.mjs")).tepMay(["vao", "chung", "ra"]);   // [{ten, abs}] — đúng mẫu nhóm của kho Drive
      for (const t of ds) {
        const f = t.abs;
        if (/^@BC\/bai-xe\/[^/]+\/ket-qua\.json$/.test(t.ten)) { let khac = []; try { khac = fs.readdirSync(path.dirname(f)).filter((x) => x !== "ket-qua.json"); } catch { /* */ } if (khac.length) continue; }
        if (xoa(f)) kq.keo++;
      }
      const goc = path.join(dir, ".exports", ".dbxm-goc");
      if (fs.existsSync(goc)) { try { kq.keo += fs.readdirSync(goc).length; } catch { /* */ } if (!o.thu) try { fs.rmSync(goc, { recursive: true, force: true }); } catch { /* */ } }
    }
    if (!o.thu && !kq.giu.startsWith("có chay-xm")) xoa(KEO);
  }
  if (!o.thu) try { ghiJson(path.join(dir, ".du-phong-da-don.json"), { luc: new Date().toISOString(), ...kq }, { thut: 1 }); } catch { /* */ }
  log(`dọn bản rõ dự phòng${o.thu ? " (THỬ)" : ""}: gương ${kq.guong} tệp · ảnh nhỏ ${kq.anhNho} · dữ liệu kéo kho ${kq.keo}${kq.giu ? " · GIỮ: " + kq.giu : ""}`);
  return kq;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await import("dotenv/config");
  const thu = process.argv.includes("--thu");
  const r = await donBanRo((...a) => console.log(...a), { thu, ep: thu });
  if (!r) console.log("không có gì để dọn (hoặc không phải PC / XM_MA_HOA=0)");
}
