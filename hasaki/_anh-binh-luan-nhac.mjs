/* 05/10: chụp bình luận nhắc QLTT của 1 phiếu thành PNG (bằng chứng B1.1) — node _anh-binh-luan-nhac.mjs <task id> <file.png> */
import "dotenv/config"; import fs from "node:fs"; import { layTokenSongWork } from "./session-rules.js";
const V = "https://wshr.hasaki.vn/api"; const DAU = ["phản hồi Có lỗi cá nhân hoặc Không phải lỗi cá nhân ở bước B1.1", "Nhờ anh/chị nhắc"]; const coDauHieu = (x) => DAU.some((d) => x.includes(d));
const fmtVN = (ms) => { const d = new Date(ms + 7 * 36e5).toISOString(); return d.slice(8, 10) + "/" + d.slice(5, 7) + "/" + d.slice(0, 4) + " " + d.slice(11, 16); };
export async function anhBinhLuanNhac(token, taskId) {
  let ds = []; try { ds = (((await (await fetch(V + "/v2/task/comment?obj_id=" + taskId, { headers: { authorization: token }, signal: AbortSignal.timeout(20000) })).json()).data) || []); } catch { return null; }
  const c = ds.find((x) => coDauHieu(String(x.comment || "").replace(/\r\n/g, "\n"))); if (!c) return null;
  const esc = (x) => String(x).replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[m]);
  const txt = esc(String(c.comment).replace(/@\[([^\]]+)\]\(user_id:\d+\)/g, "@$1")).replace(/\r?\n/g, "<br>");
  const ten = esc((c.user && c.user.name) || "Lê Chí Tâm"), m = String(c.created_at || "").match(/^(\d{4})-(\d\d)-(\d\d) (\d\d:\d\d)/), luc = (String(c.comment).match(/nhắc lúc ([0-9/]+ [0-9:]+)\)/) || [])[1] || (m ? m[3] + "/" + m[2] + "/" + m[1] + " " + m[4] : "");   // 05/10: ưu tiên GIỜ NHẮC GỐC ghi trong câu
  const html = '<meta charset=utf-8><body style="margin:0;background:#fff;font:15px Arial;color:#111"><div style="padding:16px 18px;width:760px">' +
    '<div style="font-weight:bold;font-size:16px;margin-bottom:6px">Trao đổi · bình luận nhắc</div><div style="border:1px solid #ddd;border-radius:8px;padding:12px 14px">' +
    '<div><b>' + ten + '</b> <span style="color:#666">· ' + luc + '</span></div><div style="margin-top:8px;line-height:1.5">' + txt + '</div></div>' +
    '<div style="color:#666;font-size:12px;margin-top:8px">https://work.hasaki.vn/tasks?task_id=' + taskId + '</div></div></body>';
  const { EDGE_PATH } = await import("./token-store.js"); const puppeteer = (await import("puppeteer")).default;
  const b = await puppeteer.launch({ headless: true, executablePath: EDGE_PATH });
  try { const pg = await b.newPage(); await pg.setViewport({ width: 800, height: 300 }); await pg.setContent(html); return await pg.screenshot({ fullPage: true, type: "png" }); }
  finally { await b.close().catch(() => {}); }
}
const token = await layTokenSongWork(process.cwd(), () => {}); const png = await anhBinhLuanNhac(token, process.argv[2]); if (!png) { console.log("✗ không thấy bình luận nhắc"); process.exit(1); } fs.writeFileSync(process.argv[3], png); console.log("✓", process.argv[3], png.length);
