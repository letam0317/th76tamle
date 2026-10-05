// Dò số ngày lưu từng kênh 1 đầu ghi qua top-review (chỉ đọc, tuần tự, có nghỉ). node _do-luu-nvr.mjs <host> <outdir> [kênh tối đa]
import fs from "node:fs";
const [host,OUT,MAXC="32"]=process.argv.slice(2); fs.mkdirSync(OUT,{recursive:true});
const tok=JSON.parse(fs.readFileSync(".exports/.tr-token.json","utf8")).token;
const H={authorization:"Bearer "+tok}, B="https://hasaki.top-review.io/api/v1";
const F=async(u,o)=>{for(let i=0;i<4;i++){try{return await fetch(u,o)}catch(e){if(i==3)throw e;await new Promise(r=>setTimeout(r,4000))}}};
const nghi=(ms)=>new Promise(r=>setTimeout(r,ms));
const iso=(d)=>new Date(Date.now()+7*36e5-d*864e5).toISOString().slice(0,10);
const log=[]; let nLuot=0;
async function co(kenh,d,luu){
  nLuot++;
  const ms=new Date(iso(d)+"T10:00:00+07:00").getTime();
  const c=await (await F(`${B}/pickvideo/cat?host=${host}&kenh=${kenh}&tu=${ms}&den=${ms+8000}`,{headers:H})).json();
  const r=await F(B+"/pickvideo/video?f="+encodeURIComponent(c.data.duong),{headers:H,signal:AbortSignal.timeout(90000)}).catch(()=>({status:0,text:async()=>"timeout"}));
  let ok=false, kb=0, why="";
  if(r.status===200){const b=Buffer.from(await r.arrayBuffer()); kb=b.length>>10; ok=kb>20; if(ok&&luu) fs.writeFileSync(`${OUT}/ch${String(kenh).padStart(2,"0")}_${iso(d)}.mp4`,b);} else why=(await r.text()).slice(0,80);
  log.push({kenh,ngay:iso(d),http:r.status,kb,why,luc:new Date().toISOString()});
  fs.writeFileSync(OUT+"/nhat-ky-thu.json",JSON.stringify(log,null,1));
  await nghi(1500); return ok;
}
const kq={};
// 1) kênh nào đang ghi (hôm qua 10:00)
const song=[]; for(let k=1;k<=Number(MAXC);k++){ if(await co(k,1)) song.push(k); else kq[k]={trangThai:"không có video hôm qua"}; }
console.log("kênh có video hôm qua:",song.join(","));
// 2) chia đôi trên kênh đầu, mốc 1..240 ngày
async function chiaDoi(k,lo,hi){ while(hi-lo>1){const m=(lo+hi)>>1; if(await co(k,m)) lo=m; else hi=m;} return lo; }
let mau=null;
for(const k of song){
  let lo=1,hi=240;
  if(mau!=null){ // thử quanh mốc kênh mẫu trước
    const a=await co(k,mau), b=a?await co(k,mau+2):false;
    if(a&&!b){ lo=mau; hi=mau+2; } else if(a){ lo=mau+2; } else { hi=mau; }
  }
  if(await co(k,hi)) { lo=hi; } else lo=await chiaDoi(k,lo,hi);
  if(mau==null) mau=lo;
  await co(k,lo,true); // lưu clip ngày cũ nhất làm bằng chứng
  kq[k]={ngayCuNhat:iso(lo),soNgay:lo,ngayKe:iso(lo+1)};
  console.log("ch"+k,"cũ nhất",iso(lo),"(",lo,"ngày) · ngày",iso(lo+1),"đã mất");
  fs.writeFileSync(OUT+"/ket-qua.json",JSON.stringify({host,doLuc:new Date().toISOString(),gio:"10:00",kq,nLuot},null,1));
}
console.log("xong, lượt tải:",nLuot);
