import path from "node:path";
import { fileURLToPath } from "node:url";
import { layTokenSongWork } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const V = "https://wshr.hasaki.vn/api";
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);

async function run() {
  const token = await layTokenSongWork(DIR, log);
  if (!token) return;

  const sampleIds = ["13848489", "13854339", "13829889", "13829903", "13808721"];

  for (const id of sampleIds) {
    const resDetail = await fetch(`${V}/hr/projects/task-input/${id}`, { headers: { authorization: token, accept: "application/json" } });
    const jDetail = await resDetail.json().catch(() => ({}));
    const data = jDetail && jDetail.data;
    if (data) {
      console.log(`\n--------------------------------------------------`);
      console.log(`Task Code: ${data.code}`);
      console.log(`Task Name: ${data.name}`);
      console.log(`Link: https://work.hasaki.vn/tasks-workflow?wfid=591&task_id=${data.id}`);
      console.log(`Mô tả hiện tại: ${data.note}`);
    }
  }
}

run();
