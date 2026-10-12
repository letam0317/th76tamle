/**
 * so-tac-gia.mjs — SỔ TÁC GIẢ: ghi lại MÁY nào (cò/script nào) đã tạo phiếu, bình luận, ảnh trên work.hasaki.vn.
 *
 *  User 12/10/2026: "mọi task đều để tên t là người tạo — do bộ cò tạo từ tài khoản của t; cải tiến để t biết
 *  task/hình ảnh đó do ai tạo (dữ liệu này chỉ t coi được)".
 *
 *  Cách làm: bọc globalThis.fetch MỘT lần cho mọi tiến trình Node có nạp token-store.js (mọi bộ ghi lên wshr đều nạp).
 *  Lượt GHI (POST/PUT/PATCH/DELETE) tới wshr/work.hasaki.vn → 1 dòng JSON vào .exports/so-tac-gia/<YYYY-MM>.jsonl
 *  (.exports/ không lên git; KHÔNG ghi lên phiếu — luật ngầm không ghi lên phiếu). Xem ở dashboard nội bộ
 *  (bang-591 → tab Xác minh › «Máy đã làm gì»), chỉ máy có máy chủ 8591 mới thấy.
 *  0 lượt gọi thêm lên upstream: chỉ đọc lại body/phản hồi của chính lượt gọi đó.
 *  Tuyệt đối không được làm hỏng lượt gọi: mọi bước ghi sổ nằm trong try/catch.
 */
import fs from "node:fs"; import path from "node:path"; import os from "node:os"; import crypto from "node:crypto"; import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
export const SO_DIR = process.env.HSK_SO_TAC_GIA_DIR || path.join(DIR, ".exports", "so-tac-gia");   // biến môi trường chỉ để QC ghi ra chỗ khác
const HOST = /(^|\.)(wshr|work)\.hasaki\.vn$/i;

/* Tên dễ đọc cho từng bộ (khớp LICH-VA-DU-PHONG.md). Bộ chưa có tên → hiện tên tệp. */
export const TEN_BO = {
  "push-5s-to-workflow.js": "Form 5S → phiếu WF591",
  "auto-export-sync.js": "Đồng bộ 5S",
  "auto-complete-single-task.mjs": "Tự đóng B1 → B1.1",
  "canh-b1.mjs": "Cò canh B1",
  "canh-b11.mjs": "Cò canh B1.1 (vệ sinh)",
  "canh-bai-xe.mjs": "Cò bãi xe",
  "bai-xe-phieu.mjs": "Cò bãi xe · lập phiếu",
  "canh-ao-xanh.mjs": "Cò áo xanh kho giấy",
  "canh-trung-nv.mjs": "Cò trùng nhân viên",
  "kiem-giai-trinh-ai.mjs": "AI kiểm giải trình",
  "luat-3-ngay.mjs": "Luật 3 ngày không báo cáo",
  "task-hangngay.mjs": "Task hằng ngày",
  "dieu-huong-tra-b1.mjs": "Điều hướng trả về B1",
  "bo-sung-sku-comment.mjs": "Bổ sung mã sản phẩm",
  "sua-cau-nhac-b11.mjs": "Sửa câu nhắc B1.1",
  "xac-minh-tu-dong.mjs": "Xác minh tự động",
  "xac-minh-dem.mjs": "Xác minh ban đêm",
  "bang-591.mjs": "Dashboard nội bộ (bạn bấm)",
};
const SCRIPT = path.basename(process.argv[1] || "node");
/* Chuỗi cha → con: tiến trình con thừa hưởng biến môi trường, nên biết «Xác minh ban đêm › Cò canh B1.1». */
const CHUOI = [process.env.HSK_CHUOI_TAC_GIA, SCRIPT].filter(Boolean).join(" › ");
process.env.HSK_CHUOI_TAC_GIA = CHUOI;
/* Ai bấm chạy: Claude Code đặt CLAUDECODE=1; có bàn phím (TTY) = chạy tay; còn lại = lịch nền / tiến trình con. */
const CACH = process.env.CLAUDECODE ? "Claude (phiên AI)" : process.stdin && process.stdin.isTTY ? "Chạy tay" : "Lịch nền";

let phieuGanNhat = "";   // phiếu vừa đọc trong tiến trình này — dùng cho lượt ghi chỉ có id bước (re-create-step)
const vn = (ms) => new Date(ms + 7 * 36e5).toISOString().slice(0, 19).replace("T", " ");

function hanhDong(u, m, f) {
  const p = u.pathname;
  if (/create-task-workflow/.test(p)) return "Tạo phiếu";
  if (/\/task\/comment\/\d+/.test(p)) return m === "DELETE" ? "Xoá bình luận" : "Sửa bình luận";
  if (/\/task\/comment/.test(p)) return f.tep.length ? "Bình luận + tệp" : "Bình luận";
  if (/re-create-step/.test(p)) return f.buocDen === "-1" ? "Dừng phiếu" : "Điều hướng bước";
  if (/mass-update-field-task-input|task-input/.test(p)) return "Cập nhật trường phiếu";
  if (/complete|submit|done|finish/i.test(p)) return "Hoàn thành bước";
  return (m === "DELETE" ? "Xoá" : "Ghi") + " " + p.replace(/^\/api\//, "").replace(/\/\d+/g, "/…").slice(0, 60);
}

async function docBody(body) {
  const f = { phieu: "", buocDen: "", noiDung: "", tep: [] };
  if (!body) return f;
  const lay = (k, v) => {
    const s = typeof v === "string" ? v : "";
    if (!f.phieu && /^(obj_id|task_id|id|ids?\[\]?|task_ids?\[\]?)$/.test(k) && /^\d{5,}$/.test(s)) f.phieu = s;
    if (k === "workflow_step_id") f.buocDen = s;
    if (!f.noiDung && /^(comment|name|note|note_failed|reason)$/.test(k) && s) f.noiDung = s.replace(/\s+/g, " ").slice(0, 300);
  };
  if (typeof FormData !== "undefined" && body instanceof FormData) {
    for (const [k, v] of body.entries()) {
      if (typeof v === "string") { lay(k, v); continue; }
      let sha = ""; try { sha = crypto.createHash("sha1").update(Buffer.from(await v.arrayBuffer())).digest("hex").slice(0, 12); } catch { }
      f.tep.push({ ten: v.name || k, kb: Math.round((v.size || 0) / 1024), loai: v.type || "", sha, truong: k });
    }
  } else if (typeof body === "string" || body instanceof URLSearchParams) {
    const s = String(body);
    try { const j = JSON.parse(s); for (const [k, v] of Object.entries(j)) lay(k, String(v)); }
    catch { try { for (const [k, v] of new URLSearchParams(s)) lay(k, v); } catch { } }
  }
  return f;
}

function ghi(dong) {
  try {
    fs.mkdirSync(SO_DIR, { recursive: true });
    fs.appendFileSync(path.join(SO_DIR, dong.t.slice(0, 7) + ".jsonl"), JSON.stringify(dong) + "\n");
  } catch { /* sổ hỏng không được làm hỏng việc chính */ }
}

if (typeof globalThis.fetch === "function" && !globalThis.fetch.__soTacGia) {
  const goc = globalThis.fetch;
  const boc = async function (input, init) {
    let u = null, m = "GET";
    try { u = new URL(typeof input === "string" || input instanceof URL ? String(input) : input.url); m = String((init && init.method) || (input && input.method) || "GET").toUpperCase(); } catch { }
    if (!u || !HOST.test(u.hostname)) return goc(input, init);
    if (m === "GET") {
      try { const k = /task-input\/(\d{5,})/.exec(u.pathname) || /[?&](?:task_id|obj_id|id)=(\d{5,})/.exec(u.search); if (k) phieuGanNhat = k[1]; } catch { }
      return goc(input, init);
    }
    let f = { phieu: "", buocDen: "", noiDung: "", tep: [] };
    try { f = await docBody(init && init.body); } catch { }
    const t0 = Date.now();
    const r = await goc(input, init);   // lỗi mạng ném ra nguyên vẹn cho script; lượt hỏng không ghi sổ
    try {
      let j = null;
      if (/json|text/i.test(r.headers.get("content-type") || "")) { try { j = JSON.parse(await r.clone().text()); } catch { } }
      const hd = hanhDong(u, m, f);
      const idMoi = j && j.data && (j.data.id || j.data.task_id) ? String(j.data.id || j.data.task_id) : "";
      let phieu = f.phieu;
      if (!phieu && hd === "Tạo phiếu") phieu = idMoi;
      if (!phieu) { const k = /task-input\/(\d{5,})/.exec(u.pathname); if (k) phieu = k[1]; }
      let doan = false;
      if (!phieu && phieuGanNhat && /re-create-step|task-input/.test(u.pathname)) { phieu = phieuGanNhat; doan = true; }
      if (phieu) phieuGanNhat = phieu;
      ghi({ t: vn(t0), bo: SCRIPT, ten: TEN_BO[SCRIPT] || (SCRIPT.startsWith("_") ? "Script làm tay (" + SCRIPT + ")" : SCRIPT), chuoi: CHUOI, cach: CACH,
        may: os.hostname(), hd, phieu, doan: doan || undefined, idMoi: idMoi && idMoi !== phieu ? idMoi : undefined,
        nguoiThat: globalThis.__HSK_NGUOI_THAT || undefined,   // người thật đứng sau (vd người gửi form 5S) — bộ gọi tự đặt
        noiDung: f.noiDung || undefined, tep: f.tep.length ? f.tep : undefined, http: r.status, ok: r.ok && !(j && j.status === 0),
        url: m + " " + u.pathname });
    } catch { }
    return r;
  };
  boc.__soTacGia = true;
  globalThis.fetch = boc;
}

/** Đọc sổ N ngày gần nhất (mới nhất trước) — dùng cho bang-591. */
export function docSo(soNgay = 14, toiDa = 3000) {
  const tu = vn(Date.now() - soNgay * 864e5), ra = [];
  let tep = []; try { tep = fs.readdirSync(SO_DIR).filter((x) => /^\d{4}-\d{2}\.jsonl$/.test(x)).sort().reverse(); } catch { return ra; }
  for (const x of tep) {
    if (x.slice(0, 7) < tu.slice(0, 7)) break;
    const dong = fs.readFileSync(path.join(SO_DIR, x), "utf8").split("\n");
    for (let i = dong.length - 1; i >= 0 && ra.length < toiDa; i--) { if (!dong[i]) continue; try { const d = JSON.parse(dong[i]); if (d.t >= tu) ra.push(d); } catch { } }
  }
  return ra.sort((a, b) => (a.t < b.t ? 1 : a.t > b.t ? -1 : 0));
}
