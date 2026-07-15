// capture2.mjs — spawn Edge (bản sao profile Default, có debug port) rồi connect
// để tái sử dụng phiên đăng nhập sẵn có, tự bắt API stock-location.
import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const TEMP_UD = path.join(__dirname, '.wms-session', 'edge-copy');
const PORT = 9222;
const REPORT_URL =
  'https://wms.inshasaki.com/report/beta/stock-location?company_ids=1002&ignore_zero_total=1&page=1&size=20&warehouse_ids=1458%2C1441%2C1307%2C1250%2C1179%2C1178%2C1177%2C1151';
const OUT = path.join(__dirname, 'capture-out.json');
const DATA_HINT = /stock-location|type-location|location/i;
const WAIT_MS = 3 * 60 * 1000;

function redact(s){ if(!s) return s; return String(s).replace(/("?(password|otp|token|secret|authorization)"?\s*[:=]\s*)("?)[^",&}\s]+/gi,'$1$3***'); }
function getWS(){ return new Promise((res,rej)=>{ http.get(`http://127.0.0.1:${PORT}/json/version`,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>{try{res(JSON.parse(d).webSocketDebuggerUrl)}catch(e){rej(e)}})}).on('error',rej); }); }

const edge = spawn(EDGE, [
  `--user-data-dir=${TEMP_UD}`, '--profile-directory=Default',
  `--remote-debugging-port=${PORT}`, '--no-first-run', '--no-default-browser-check',
  '--start-maximized', 'about:blank'
], { detached: true, stdio: 'ignore' });
edge.unref();

let ws = null;
for (let i=0;i<30;i++){ try{ ws = await getWS(); if(ws) break; }catch{} await new Promise(r=>setTimeout(r,1000)); }
if(!ws){ console.log('NO_WS: khong mo duoc debug port'); process.exit(2); }
console.log('connected WS ok');

const browser = await puppeteer.connect({ browserWSEndpoint: ws, defaultViewport: null });
const page = (await browser.pages())[0] || await browser.newPage();

const calls = []; let dataCaptured = false;
page.on('requestfinished', async (req) => {
  try{
    const url = req.url();
    if(!/\/api\//.test(url) || !url.includes('inshasaki.com')) return;
    const res = req.response();
    const rec = { method:req.method(), url, status:res?res.status():null,
      reqBody:redact(req.postData()||''),
      authHeader:req.headers()['authorization']?('present '+String(req.headers()['authorization']).slice(0,12)+'…'):'none',
      respTopKeys:null, respFirstRowKeys:null, respSample:null, total:null };
    if(res){
      const ct=(res.headers()['content-type']||'');
      if(ct.includes('json')){
        try{
          const j=await res.json();
          rec.respTopKeys=Object.keys(j||{});
          const arr=Array.isArray(j)?j:(j.data&&(Array.isArray(j.data)?j.data:j.data.items||j.data.records||j.data.list||j.data.content))||j.items||j.records||j.list||j.content;
          if(Array.isArray(arr)&&arr.length){ rec.respFirstRowKeys=Object.keys(arr[0]); rec.respSample=arr[0];
            rec.total=(j.total ?? (j.data&&(j.data.total ?? j.data.total_count)) ?? j.total_count ?? null);
            if(DATA_HINT.test(url)) dataCaptured=true; }
        }catch{}
      }
    }
    calls.push(rec);
    console.log(`[cap] ${rec.method} ${url.split('?')[0]} status=${rec.status} rows=${rec.respFirstRowKeys?rec.respFirstRowKeys.length+'cols':'-'} auth=${rec.authHeader==='none'?'no':'yes'}`);
  }catch{}
});

try{ await page.goto(REPORT_URL,{waitUntil:'networkidle2',timeout:120000}); }catch(e){ console.log('goto note:',e.message); }
const t0=Date.now();
while(Date.now()-t0<WAIT_MS){ if(dataCaptured){ console.log('>>> got data endpoint, gom them 4s'); await new Promise(r=>setTimeout(r,4000)); break; } await new Promise(r=>setTimeout(r,1000)); }

fs.writeFileSync(OUT, JSON.stringify({capturedAt:new Date().toISOString(),reportUrl:REPORT_URL,dataCaptured,calls},null,2),'utf8');
console.log(`>>> luu ${calls.length} request -> ${OUT} | dataCaptured=${dataCaptured}`);
try{ await browser.disconnect(); }catch{}
process.exit(0);
