/** qc-khung-long.mjs — 15/10 user «Kiểm kê/Bất thường nhiều khung, không chuyên nghiệp»: chuẩn antd 1 Card / phần, BÊN TRONG không còn phần tử có viền 4 phía (thẻ khối, ô số). Đạt = 0 khung lồng ở cả 2 phần, 2 trang. node qc-khung-long.mjs */
import puppeteer from "puppeteer-core";
const S=process.argv[2]||"", CHUP=process.argv[3]||""; let loi=0;
const b = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: "new" });
const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 });
await p.setRequestInterception(true); p.on("request", (r) => (/^(GET|OPTIONS|HEAD)$/.test(r.method()) ? r.continue() : r.abort()));
for (const [u,secs] of [["/retail/tonkho/tonkhochinhxac",["pane-kk","pane-htonbat"]],["/factory/hangmuctonkho/tonkhochinhxac",["viewKK","viewAbn"]]]) {
  await p.goto("http://localhost:8123"+u, { waitUntil: "networkidle2", timeout: 90000 }); await new Promise(r=>setTimeout(r,10000));
  const r = await p.evaluate((secs)=>{ const vien=e=>{ const s=getComputedStyle(e); return ["Top","Right","Bottom","Left"].every(k=>parseFloat(s["border"+k+"Width"])>0 && s["border"+k+"Style"]!=="none") && e.offsetParent && e.getBoundingClientRect().width>40 && e.getBoundingClientRect().height>24; };
    const out={}; secs.forEach(id=>{ const root=document.getElementById(id); const ds={}; let max=0;
      root.querySelectorAll("*").forEach(e=>{ if(!vien(e)) return; if(/^(INPUT|BUTTON|SELECT|TEXTAREA)$/.test(e.tagName)||e.closest("button")) return; let d=vien(root)?1:0; for(let a=e.parentElement;a&&a!==root.parentElement;a=a.parentElement) if(vien(a)) d++; d++; max=Math.max(max,d); const k=d+":"+(e.className&&e.className.baseVal===undefined?String(e.className).split(" ")[0]:e.tagName); ds[k]=(ds[k]||0)+1; });
      out[id]={tangMax:max, ds}; }); return out; }, secs);
  console.log(u); for(const k in r) { const n=Object.values(r[k].ds).reduce((a,b)=>a+b,0); if(n) loi++; console.log((n?"  ✗ ":"  ✓ ")+k+" khung lồng bên trong: "+n+(n?" "+JSON.stringify(r[k].ds):"")); }
  if (CHUP) await p.screenshot({path:S+CHUP+u.replace(/\//g,"_")+".png", fullPage:true});
}
await b.close(); console.log(loi?"✗ "+loi+" phần còn khung lồng":"✓ khung: 1 tầng mỗi phần"); process.exit(loi?1:0);
