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
 for(const width of [280,320,375,768,1024,1440,1920]) {
  await page.setViewportSize({width,height:900});await page.goto('http://127.0.0.1:4319/?view=support&role=admin');
  const input=page.getByLabel('Kode referensi bantuan'); const submit=page.getByRole('button',{name:'Cari laporan'});
  await input.fill('invalid');await submit.click();await page.getByRole('alert').filter({hasText:'UUID lengkap'}).waitFor();
  await input.fill('  48BFC3A0-ADB3-45D0-A97F-EB27186062B0  ');await submit.click();await page.getByRole('heading',{name:'Rincian kendala'}).waitFor();
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
 await page.unroute('**/api/operations/support?*');
 const reference='48bfc3a0-adb3-45d0-a97f-eb27186062b0';
 const report={requestId:reference,occurredAt:'2026-10-23T10:00:00+00:00',module:'activities',code:'JOURNAL_BLOCKED',status:403};
 const input=page.getByLabel('Kode referensi bantuan');
 for(const data of [{...report,occurredAt:'bad'}, {...report,module:'toString'}, {...report,requestId:'ffffffff-ffff-4fff-8fff-ffffffffffff'}, {}, []]) {
  await page.route('**/api/operations/support?*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data})}));
  await input.fill(reference);await page.getByRole('button',{name:'Cari laporan'}).click();
  await page.getByRole('alert').filter({hasText:'Jawaban layanan laporan tidak sesuai'}).waitFor();
  assert.equal(await page.getByRole('heading',{name:'Rincian kendala'}).count(),0);
  await page.unroute('**/api/operations/support?*');
 }
 let release;let started;let calls=0;
 const ready=new Promise(resolve=>{started=resolve;});
 const held=new Promise(resolve=>{release=resolve;});
 await page.route('**/api/operations/support?*',async route=>{calls++;started();await held;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data:report})}).catch(()=>{});});
 await input.fill(reference);await page.getByRole('button',{name:'Cari laporan'}).click();await ready;
 await page.getByRole('status').filter({hasText:'Sedang mencari'}).waitFor();
 await page.locator('form').evaluate(form=>{form.requestSubmit();form.requestSubmit();});
 assert.equal(calls,1,'duplicate submit must not send another request');
 await input.fill('ffffffff-ffff-4fff-8fff-ffffffffffff');
 release();
 await page.unroute('**/api/operations/support?*');
 await page.getByRole('heading',{name:'Mulai penelusuran kendala'}).waitFor();
 await page.getByRole('button',{name:'Cari laporan'}).click();
 await page.getByRole('heading',{name:'Referensi belum ditemukan'}).waitFor();
 assert.equal(await page.getByRole('heading',{name:'Rincian kendala'}).count(),0);
 await page.setViewportSize({width:320,height:480});
 await input.fill(reference);await page.getByRole('button',{name:'Cari laporan'}).click();
 await page.getByRole('heading',{name:'Rincian kendala'}).waitFor();
 await page.addStyleTag({content:'html {font-size:32px}'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'200% text should wrap');
 await page.setViewportSize({width:844,height:390});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'landscape should wrap');
 const touch=await browser.newPage({viewport:{width:375,height:667},hasTouch:true});
 touch.on('pageerror',error=>errors.push(error.message));
 await touch.goto('http://127.0.0.1:4319/?view=support&role=admin');
 await touch.route('**/api/operations/support?*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data:{...report,module:'a'.repeat(40),code:'X'.repeat(80)}})}));
 await touch.getByLabel('Kode referensi bantuan').fill(reference);
 await touch.getByRole('button',{name:'Cari laporan'}).tap();
 await touch.getByRole('heading',{name:'Rincian kendala'}).waitFor();
 assert.equal(await touch.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'long metadata must wrap on touch screens');
 await touch.unroute('**/api/operations/support?*');
 for(const [status,code] of [[401,'UNAUTHENTICATED'],[403,'FORBIDDEN'],[429,'RATE_LIMITED']]) {
  await touch.route('**/api/operations/support?*',route=>route.fulfill({status,contentType:'application/json',body:JSON.stringify({ok:false,error:{code,message:'Permintaan ditolak '+status},requestId:reference})}));
  await touch.getByRole('button',{name:'Cari laporan'}).tap();
  await touch.getByRole('alert').filter({hasText:'Permintaan ditolak '+status}).waitFor();
  assert.equal(await touch.getByRole('heading',{name:'Rincian kendala'}).count(),0);
  await touch.unroute('**/api/operations/support?*');
 }
 await touch.route('**/api/operations/support?*',route=>route.abort('failed'));
 await touch.getByRole('button',{name:'Cari laporan'}).tap();
 await touch.getByRole('alert').filter({hasText:'Koneksi ke layanan terputus'}).waitFor();
 await touch.close();
 assert.deepEqual(errors,[]); console.log('PASS: support lookup at 7 widths (280–1920px), pasted UUID, empty/error/malformed states, duplicate submission, stale response cancellation, 200% text and orientation; zero page errors.');
} finally {await browser?.close();child.kill('SIGTERM');}
