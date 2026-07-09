// capture-stocklocation.mjs
// Mở trình duyệt tới report WMS. Bạn đăng nhập trong cửa sổ (nếu chưa).
// Script tự ghi lại mọi request tới API WMS (login + dữ liệu stock-location)
// vào file capture-out.json để phân tích. KHÔNG in mật khẩu ra màn hình.
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const API_HOST = 'inshasaki.com';           // bắt mọi call tới *.inshasaki.com/api...
const REPORT_URL =
  'https://wms.inshasaki.com/report/beta/stock-location?company_ids=1002&ignore_zero_total=1&page=1&size=20&warehouse_ids=1458%2C1441%2C1307%2C1250%2C1179%2C1178%2C1177%2C1151';
const OUT = path.join(__dirname, 'capture-out.json');
const WAIT_MS = 8 * 60 * 1000;              // tối đa 8 phút để bạn đăng nhập
const DATA_HINT = /stock-location|type-location|checklist|location/i;

const calls = [];
function redact(s){ if(!s) return s; return String(s).replace(/("?(password|otp|token|secret|authorization)"?\s*[:=]\s*)("?)[^",&}\s]+/gi,'$1$3***'); }

const browser = await puppeteer.launch({
  headless: false, executablePath: CHROME, defaultViewport: null,
  userDataDir: path.join(__dirname, '.wms-session', 'pptr-edge'),
  args: ['--start-maximized', '--no-first-run', '--no-default-browser-check']
});
const page = (await browser.pages())[0] || await browser.newPage();

let dataCaptured = false;
page.on('requestfinished', async (req) => {
  try{
    const url = req.url();
    if(!/\/api\//.test(url) || !url.includes(API_HOST)) return;
    const res = req.response();
    const rec = {
      method: req.method(), url,
      status: res ? res.status() : null,
      reqBody: redact(req.postData() || ''),
      authHeader: req.headers()['authorization'] ? 'present ('+String(req.headers()['authorization']).slice(0,7)+'…)' : 'none',
      respTopKeys: null, respFirstRowKeys: null, respSample: null
    };
    if(res){
      const ct = (res.headers()['content-type']||'');
      if(ct.includes('json')){
        try{
          const j = await res.json();
          rec.respTopKeys = Object.keys(j||{});
          // tìm mảng dữ liệu
          const arr = Array.isArray(j) ? j : (j.data && (Array.isArray(j.data)?j.data:j.data.items||j.data.records||j.data.list||j.data.content)) || j.items || j.records || j.list || j.content;
          if(Array.isArray(arr) && arr.length){
            rec.respFirstRowKeys = Object.keys(arr[0]);
            rec.respSample = arr[0];
            rec.total = (j.total ?? (j.data && (j.data.total ?? j.data.total_count)) ?? j.total_count ?? null);
            if(DATA_HINT.test(url)) dataCaptured = true;
          }
        }catch(e){}
      }
    }
    calls.push(rec);
    console.log(`[capture] ${rec.method} ${url.split('?')[0]}  status=${rec.status}  rows=${rec.respFirstRowKeys?rec.respFirstRowKeys.length+' cols':'-'}`);
  }catch(e){}
});

console.log('\n>>> Cửa sổ Chrome đã mở. Nếu chưa đăng nhập, hãy ĐĂNG NHẬP WMS trong cửa sổ đó.');
console.log('>>> Script sẽ tự ghi lại API. Xong tự lưu capture-out.json (hoặc đóng cửa sổ để kết thúc sớm).\n');
try{ await page.goto(REPORT_URL, { waitUntil: 'networkidle2', timeout: 120000 }); }catch(e){}

const t0 = Date.now();
while(Date.now() - t0 < WAIT_MS){
  if(dataCaptured){ console.log('>>> Đã bắt được endpoint dữ liệu. Chờ thêm 4s để gom phân trang...'); await new Promise(r=>setTimeout(r,4000)); break; }
  if(!browser.connected){ break; }
  await new Promise(r=>setTimeout(r,1000));
}

fs.writeFileSync(OUT, JSON.stringify({ capturedAt: new Date().toISOString(), reportUrl: REPORT_URL, calls }, null, 2), 'utf8');
console.log(`\n>>> Đã lưu ${calls.length} request vào: ${OUT}`);
try{ await browser.close(); }catch(e){}
