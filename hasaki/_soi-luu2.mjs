import fs from "node:fs";
const tok=JSON.parse(fs.readFileSync(".exports/.tr-token.json","utf8")).token;
const H={authorization:"Bearer "+tok};
const B="https://hasaki.top-review.io/api/v1";
const F=async(u,o)=>{for(let i=0;i<4;i++){try{return await fetch(u,o)}catch(e){if(i==3)throw e;await new Promise(r=>setTimeout(r,3000))}}};
async function thu(host,kenh,ms){
  const c=await (await F(`${B}/pickvideo/cat?host=${host}&kenh=${kenh}&tu=${ms}&den=${ms+8000}`,{headers:H})).json();
  const t0=Date.now(); const r=await F(B+"/pickvideo/video?f="+encodeURIComponent(c.data.duong),{headers:H,signal:AbortSignal.timeout(120000)}).catch(e=>({status:0,text:async()=>e.message,headers:new Map()}));
  const buf=r.status===200?Buffer.from(await r.arrayBuffer()):null;
  return {st:r.status,kb:buf?Math.round(buf.length/1024):0,s:((Date.now()-t0)/1000).toFixed(1),loi:buf?"":(await r.text()).slice(0,150),buf};
}
const [host,kenh,ngay]=process.argv.slice(2);
const ms=ngay?new Date(ngay+"T10:00:00+07:00").getTime():Date.now()-3600e3;
const k=await thu(host,Number(kenh),ms); console.log(host,kenh,ngay||"1h trước",k.st,k.kb+"KB",k.s+"s",k.loi);
if(k.buf&&process.argv[5]) fs.writeFileSync(process.argv[5],k.buf);
