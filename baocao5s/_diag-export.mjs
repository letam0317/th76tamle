// TẠM: chẩn đoán vì sao cửa sổ Apr-May của auto-export luôn timeout.
// Lấy token → queue export Apr-May → in RAW job status mỗi 5s (~40s). Không ghi Sheet.
import puppeteer from "puppeteer";
import "dotenv/config";
const EDGE_PATH = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PROFILE_DIR = process.env.EDGE_PROFILE_DIR || "C:/Users/lechitam/New folder/baocao5s/.wms-session/edge-profile";
const WFID = process.env.WORKFLOW_ID || "591";
const API = "https://wshr.hasaki.vn/api/hr/excel-io";
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function getToken() {
  const b = await puppeteer.launch({ headless: true, executablePath: EDGE_PATH, userDataDir: PROFILE_DIR, args: ["--disable-blink-features=AutomationControlled"] });
  try {
    const p = (await b.pages())[0] || (await b.newPage());
    let tk = null; p.on("request", r => { const a = r.headers()["authorization"]; if (a && /wshr\.hasaki\.vn/.test(r.url()) && !tk) tk = a; });
    await p.goto("https://work.hasaki.vn/tasks-workflow?wfid=" + WFID, { waitUntil: "networkidle2", timeout: 60000 }).catch(() => {});
    for (let i = 0; i < 15 && !tk; i++) await new Promise(r => setTimeout(r, 1000));
    return tk;
  } finally { await b.close().catch(() => {}); }
}
const ds = async (tk) => ((await (await fetch(API, { headers: { authorization: tk } })).json()).data?.rows || []);

const tk = await getToken();
if (!tk) { log("✗ không lấy được token (phiên?)"); process.exit(1); }
log("✓ token OK");
const from = "2026-04-01", to = "2026-05-31";
const fd = new FormData();
fd.append("param[from_date]", from); fd.append("param[to_date]", to);
fd.append("param[search_type]", "board"); fd.append("param[wfid]", WFID); fd.append("type", "6");
await fetch(API + "/export", { method: "POST", headers: { authorization: tk }, body: fd });
log("queued " + from + ".." + to);
for (let i = 0; i < 8; i++) {
  await new Promise(r => setTimeout(r, 5000));
  const rows = await ds(tk);
  const job = rows.find(r => r.param && r.param.from_date === from && r.param.to_date === to && r.type === 6);
  log("t+" + ((i + 1) * 5) + "s: " + (job ? ("status=" + job.status + " file=" + (job.file_path || "-") + " log=" + JSON.stringify(job.log || {}).slice(0, 120)) : "CHƯA có job nào khớp (tổng " + rows.length + " job)"));
  if (job && (job.status === 1 || job.status === 0)) break;
}
process.exit(0);
