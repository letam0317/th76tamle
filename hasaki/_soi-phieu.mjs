import "dotenv/config"; import { layTokenSongWork } from "./session-rules.js";
const token = await layTokenSongWork(process.cwd(), ()=>{});
const d=(await (await fetch("https://wshr.hasaki.vn/api/hr/projects/task-input/"+process.argv[2],{headers:{authorization:token,accept:"application/json"}})).json()).data;
console.log(JSON.stringify(d.data?.configs,null,1)); console.log("name:",d.name); console.log("desc:",String(d.description||"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").slice(0,800));
