import fs from "node:fs";
const tok=JSON.parse(fs.readFileSync(".exports/.tr-token.json","utf8")).token;
const H={authorization:"Bearer "+tok,accept:"application/json"};
const B="https://hasaki.top-review.io/api/v1";
const g=async(p)=>{const r=await fetch(B+p,{headers:H,signal:AbortSignal.timeout(90000)});return [r.status,(await r.text())]};
let [s,t]=await g("/nvr/"+encodeURIComponent("172.16.10.12")+"/thumbs"); console.log("thumbs",s,t.slice(0,1500));
const now=Date.now();
for (const d of [0,3,10]) { const tu=now-d*864e5-3600e3; [s,t]=await g(`/pickvideo/cat?host=172.16.10.12&kenh=6&tu=${tu}&den=${tu+10000}`); console.log("cat ch6 -"+d+"d",s,t.slice(0,300)); }
