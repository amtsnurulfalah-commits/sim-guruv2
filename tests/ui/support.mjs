import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
const { chromium } = await import(process.env.UI_PLAYWRIGHT_MODULE ?? 'playwright');
const child=spawn(process.execPath,['--conditions=react-server','--import','tsx','tests/ui/server.ts'],{stdio:['ignore','pipe','pipe']});
let browser; let logs='';
child.stderr.on('data',b=>logs+=b);
try {
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(logs||'fixture timeout')),60000);child.stdout.on('data',b=>{if(b.toString().includes('UI_FIXTURE_READY')){clearTimeout(timer);resolve();}});child.on('exit',()=>{clearTimeout(timer);reject(Error(logs));});});
 browser=await chromium.launch({headless:true,...(process.env.UI_BROWSER_EXECUTABLE ? {executablePath:process.env.UI_BROWSER_EXECUTABLE} : {}),args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const width of [375,768,1440]) {
  await page.setViewportSize({width,height:900});await page.goto('http://127.0.0.1:4319/?view=support&role=admin');
  const input=page.getByLabel('Kode referensi bantuan'); const submit=page.getByRole('button',{name:'Cari laporan'});
  await input.fill('invalid');await submit.click();await page.getByRole('alert').filter({hasText:'UUID lengkap'}).waitFor();
  await input.fill('48bfc3a0-adb3-45d0-a97f-eb27186062b0');await submit.click();await page.getByRole('heading',{name:'Rincian kendala'}).waitFor();
  await page.getByText('JOURNAL_BLOCKED',{exact:true}).waitFor();await page.getByText('Kegiatan dan Jurnal',{exact:true}).waitFor();
  if(width===375 && process.env.UI_SUPPORT_SCREENSHOT)await page.screenshot({path:process.env.UI_SUPPORT_SCREENSHOT,fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await input.fill('ffffffff-ffff-4fff-8fff-ffffffffffff');await submit.click();await page.getByRole('heading',{name:'Referensi belum ditemukan'}).waitFor();
 }
 await page.route('**/api/operations/support?*',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:{code:'UNAVAILABLE',message:'Layanan laporan belum tersedia.'},requestId:'44444444-4444-4444-8444-444444444444'})}));
 await page.getByLabel('Kode referensi bantuan').fill('48bfc3a0-adb3-45d0-a97f-eb27186062b0');
 await page.getByRole('button',{name:'Cari laporan'}).click();
 await page.getByRole('alert').filter({hasText:'Layanan laporan belum tersedia.'}).waitFor();
 assert.equal(await page.getByRole('heading',{name:'Rincian kendala'}).count(),0);
 assert.deepEqual(errors,[]); console.log('PASS: support lookup, unknown reference, invalid UUID and responsive layout at 375/768/1440 px; zero page errors.');
} finally {await browser?.close();child.kill('SIGTERM');}
