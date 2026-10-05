/* 05/10/2026 — user: "xem WMS thời gian châm → tra camera đúng giờ châm xem có phải người đó chuyển pallet tới vị trí → đúng thì duyệt chuyển B1.1".
 * Cho các phiếu ĐÃ khớp WMS + camera: gắn ảnh 3 mốc (PIC02) + video gốc (video02) vào B1 → bình luận bằng chứng gọn → auto-complete B1→B1.1 → đọc lại.
 * node _chuyen-b11-camera.mjs <cau-hinh.json> [--lam] ; cấu hình: [{id, nv:"email", anh, video, binhLuan}] */
import "dotenv/config"; import fs from "node:fs"; import { execFileSync } from "node:child_process";
import { layTokenSongWork } from "./session-rules.js";
const V = "https://wshr.hasaki.vn/api"; const DS = JSON.parse(fs.readFileSync(process.argv[2], "utf8")); const LAM = process.argv.includes("--lam");
const t = await layTokenSongWork(process.cwd(), () => {}); const HW = { authorization: t, origin: "https://work.hasaki.vn", referer: "https://work.hasaki.vn/" };
const doc = async (id) => (await (await fetch(V + "/hr/projects/task-input/" + id, { headers: { authorization: t, accept: "application/json" } })).json()).data;
const chay = (args, ms) => { try { return execFileSync(process.execPath, args, { windowsHide: true, encoding: "utf8", timeout: ms }); } catch (e) { return String(e.stdout || "") + String(e.message); } };
for (const p of DS) {
  const d = await doc(p.id); const b1 = (d.subtasks || []).filter((s) => Number(s.workflow_step_id) === 7379).pop();
  console.log("\n" + p.id, "cha st", d.status, "· B1", b1.id, "st", b1.status, "→", p.nv);
  if (![0, 1].includes(Number(b1.status))) { console.log("  B1 không còn treo — bỏ qua"); continue; }
  for (const f of [p.anh, p.video]) if (!fs.existsSync(f)) { console.log("  ✗ thiếu", f); process.exit(1); }
  /* 05/10 user "sao chỉ là clip mà không có khung khoanh - ghi chú như trước": CẤM gắn video gốc — chỉ nhận clip chuẩn _clip-noi (webm: khung vàng vật, khung đỏ người + tên, chú thích, tua) */
  if (!/_CLIP-CHUAN\.webm$/.test(p.video)) { console.log("  ✗ video phải là clip chuẩn *_CLIP-CHUAN.webm (dựng bằng _clip-noi.mjs), không phải video gốc:", p.video); process.exit(1); }
  if (!LAM) { console.log("  (diễn tập) ảnh", p.anh.split("/").pop(), "· video", p.video.split("/").pop(), (fs.statSync(p.video).size / 1048576).toFixed(1) + "MB\n  bình luận:", p.binhLuan); continue; }
  /* 05/10: mạng chập chờn → nạp xong phải ĐỌC LẠI thấy đủ PIC02 + clip chuẩn trên B1 mới đi tiếp; không thì DỪNG (không chuyển B1.1) */
  const coDu = async () => { try { const b = ((await doc(p.id)).subtasks || []).find((s) => s.id === b1.id); const c = (b && b.data && b.data.configs) || {};
    return [].concat(c.PIC02 || []).some((x) => /ANH-3-MOC/.test(x)) && [].concat(c.video02 || []).some((x) => /CLIP-CHUAN/.test(x)); } catch { return false; } };
  for (let k = 0; k < 2 && !(await coDu()); k++) {
    console.log("  " + chay(["_thay-file-phieu.mjs", String(b1.id), "PIC02", p.anh, "--lam"], 1300000).trim().split("\n").pop());
    console.log("  " + chay(["_thay-file-phieu.mjs", String(b1.id), "video02", p.video, "--lam"], 1300000).trim().split("\n").pop());
  }
  if (!(await coDu())) { console.log("  ✗ chưa xác nhận đủ ảnh + clip trên B1 — DỪNG, không chuyển B1.1"); continue; }
  /* bình luận chỉ đăng nếu chưa có câu y hệt — chạy lại không đăng trùng (05/10 từng trùng 2 bản ở 14007566) */
  let daCo = null; try { daCo = (((await (await fetch(V + "/v2/task/comment?obj_id=" + p.id, { headers: HW })).json()).data) || []).some((c) => String(c.comment).trim() === p.binhLuan.trim()); } catch { }
  if (daCo === null) { console.log("  ✗ không đọc được bình luận — DỪNG để không đăng trùng"); continue; }
  if (!daCo) { const fc = new FormData(); fc.set("obj_id", String(p.id)); fc.set("comment", p.binhLuan);
    await fetch(V + "/v2/task/comment", { method: "POST", body: fc, headers: HW }).catch(() => {}); }
  console.log("  " + chay(["auto-complete-single-task.mjs", "--task=" + p.id, "--nv=" + p.nv, "--lam"], 300000).trim().split("\n").slice(-2).join(" | "));
  await new Promise((r) => setTimeout(r, 3000));
  const d2 = await doc(p.id); const b11 = (d2.subtasks || []).filter((s) => Number(s.workflow_step_id) === 7826).pop();
  const ten = b11 ? ((JSON.stringify(b11.staff || []).match(/"staff_name":"([^"]+)"/g) || []).map((x) => x.slice(14, -1)).filter((x) => x !== "Lê Chí Tâm")) : [];
  console.log("  đọc lại: B1.1", b11 ? b11.id + " st " + b11.status + " · giao " + ten.join(", ") : "CHƯA MỞ");
}
