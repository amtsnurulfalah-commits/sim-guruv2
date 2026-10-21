import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.UI_PLAYWRIGHT_MODULE ?? 'playwright');
const child=spawn(process.execPath,['--conditions=react-server','--import','tsx','tests/ui/server.ts'],{stdio:['ignore','pipe','pipe']});
let browser;let stderr=''; child.stderr.on('data',b=>stderr+=b);
const output=process.env.UI_REPORT_DIR ?? '../ui-dashboard-focused';await mkdir(output,{recursive:true});
try {
 await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error(stderr||'fixture timeout')),60000);child.stdout.on('data',b=>{if(b.toString().includes('UI_FIXTURE_READY')){clearTimeout(timeout);resolve();}});child.on('exit',()=>{clearTimeout(timeout);reject(Error(stderr));});});
 browser=await chromium.launch({headless:true,...(process.env.UI_BROWSER_EXECUTABLE?{executablePath:process.env.UI_BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base={date:'2026-10-21',planned:[],tasks:[],pendingEventJournals:0,attendance:null,honor:{total:'1234567890123456789.0000',totalJtm:'12.5000',rateMissing:false},pendingHolidays:0,admin:null};
 let summary=structuredClone(base),delay=0,apiError=false,items=[],dismissCount=0,summaryRequests=0;
 await page.route('**/api/dashboard',async route=>{summaryRequests++;if(delay)await new Promise(r=>setTimeout(r,delay));await route.fulfill({status:apiError?503:200,contentType:'application/json',body:JSON.stringify(apiError?{ok:false,error:{code:'UNAVAILABLE',message:'Ringkasan sedang tidak tersedia.'},requestId:'11111111-1111-4111-8111-111111111111'}:{ok:true,data:{summary}})});});
 await page.route('**/api/operations/announcements',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,data:items})}));
 await page.route('**/api/operations/dismiss',async route=>{dismissCount++;await new Promise(r=>setTimeout(r,400));await route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,data:{dismissed:true}})});});
 const go=role=>{console.log('Dashboard scenario',role,summary.tasks?.length,summary.planned?.length,apiError);return page.goto(`http://127.0.0.1:4319/?view=dashboard&role=${role}&path=/dashboard`);};
 const noOverflow=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 for(const role of ['admin','guru'])for(const width of [320,375,768,1024,1440,1920]){
  summary={...base,admin:role==='admin'?{activeUsers:1234,failedMessages:4,failedJobs:1}:null};
  await page.setViewportSize({width,height:900});await go(role);
  await page.getByText('Belum ada jadwal atau penugasan untuk Anda pada hari ini.',{exact:false}).waitFor();
  assert.equal(await page.getByRole('heading',{name:'Ringkasan administrasi',exact:true}).count(),role==='admin'?1:0);
  const context=page.getByRole('region',{name:'Konteks hari ini',exact:true});await context.locator('summary').waitFor();await context.locator('summary').focus();await page.keyboard.press('Enter');await context.getByText('Semester aktif',{exact:true}).waitFor();await noOverflow();await page.keyboard.press('Space');
  if(width===1440)await page.screenshot({path:`${output}/${role}-desktop.png`,fullPage:true});
  if(width===375)await page.screenshot({path:`${output}/${role}-mobile.png`,fullPage:true});
 }
 // Planned-only entries must never claim the day is empty; raw internal kinds are translated.
 summary={...base,planned:[{id:'planned',kind:'EXAM_SUPERVISOR',time_start:'07:20:00',time_end:'08:00:00'}]};await go('guru');await page.getByText('Pengawas ujian',{exact:true}).waitFor();assert.equal(await page.getByText('Belum ada jadwal atau penugasan untuk Anda pada hari ini.',{exact:false}).count(),0);
 // Large data: bounded DOM, pagination and responsive orientation/large text.
 summary={...base,tasks:Array.from({length:101},(_,i)=>({id:String(i),kind:'KBM',start:'07:20:00',end:'08:00:00',confirmed:i%2===0,journalComplete:false}))};
 await go('guru');const list=page.getByRole('list',{name:'Daftar jadwal dan penugasan'});await list.locator('li').first().waitFor();assert.equal(await list.locator('li').count(),8);
 const pagination=page.getByRole('navigation',{name:'Halaman penugasan'});await pagination.getByRole('button',{name:'Berikutnya'}).click();await pagination.getByText('Halaman 2 dari 13',{exact:false}).waitFor();await pagination.getByRole('button',{name:'Sebelumnya'}).click();
 for(const size of [{width:844,height:390},{width:375,height:812}]){await page.setViewportSize(size);await noOverflow();}
 await page.addStyleTag({content:'html{font-size:200%}'});await noOverflow();
 // Stress wrapping for long names and calendar descriptions without changing application data.
 await page.getByRole('heading',{name:'Selamat datang',exact:false}).evaluate(el=>el.textContent+=' '+ 'NamaPanjang'.repeat(60));
 const disclosure=page.getByRole('region',{name:'Konteks hari ini',exact:true});await disclosure.locator('summary').click();
 await disclosure.locator('dd').first().evaluate(el=>el.textContent='Keterangan'.repeat(100));await noOverflow();
 // Explicit loading state resolves on a delayed response.
 delay=1200;summary=base;await go('guru');await page.getByRole('status').filter({hasText:'Memuat ringkasan kegiatan'}).waitFor();
 await page.getByText('Belum ada jadwal atau penugasan untuk Anda pada hari ini.',{exact:false}).waitFor();delay=0;
 // Malformed payload and HTTP error resolve to an actionable error, not a permanent loader.
 summary={};await go('admin');await page.getByRole('alert').filter({hasText:'Layanan ringkasan mengirim data yang belum sesuai'}).waitFor();summary=base;await page.getByRole('button',{name:'Coba kembali',exact:true}).click();await page.getByText('Belum ada jadwal atau penugasan untuk Anda pada hari ini.',{exact:false}).waitFor();
 apiError=true;await page.getByRole('button',{name:'Muat ulang ringkasan',exact:true}).click();await page.getByRole('alert').filter({hasText:'11111111-1111-4111-8111-111111111111'}).waitFor();apiError=false;await page.getByRole('button',{name:'Coba kembali',exact:true}).click();await page.getByText('Belum ada jadwal atau penugasan untuk Anda pada hari ini.',{exact:false}).waitFor();
 // Context recovery is independent: retrying it must not reload the summary.
 await page.route('**/api/day-context?*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,data:null})}));
 await go('guru');await page.getByRole('alert').filter({hasText:'Data konteks hari belum sesuai'}).waitFor();
 await page.getByText('Belum ada jadwal atau penugasan untuk Anda pada hari ini.',{exact:false}).waitFor();
 const beforeContextRetry=summaryRequests;await page.unroute('**/api/day-context?*');
 await page.getByRole('button',{name:'Muat ulang konteks',exact:true}).click();
 await page.getByRole('region',{name:'Konteks hari ini',exact:true}).locator('summary').waitFor();assert.equal(summaryRequests,beforeContextRetry);
 // Dismissal permits only one in-flight write, preserves the second card and gives success feedback.
 items=[1,2].map(n=>({id:`notice-${n}`,title:`Pengumuman ${n}`,body:'Keterangan '+ 'a'.repeat(400),severity:'warning',version:1,canDismiss:true,cta_url:null,cta_text:null}));await go('admin');await page.getByRole('heading',{name:'Pengumuman 1',exact:true}).waitFor();await page.getByRole('button',{name:'Tutup pengumuman',exact:true}).first().evaluate(button=>{button.click();button.click();});await page.getByRole('status').filter({hasText:'Pengumuman berhasil ditutup.'}).waitFor();assert.equal(dismissCount,1);assert.equal(await page.getByRole('heading',{name:'Pengumuman 1',exact:true}).count(),0);assert.equal(await page.getByRole('heading',{name:'Pengumuman 2',exact:true}).count(),1);await noOverflow();
 // Date rollover/focus causes a coordinated refresh without waiting for a full-page navigation.
 await page.clock.install({time:new Date('2026-10-21T16:59:59Z')});await go('guru');await page.getByRole('heading',{name:'Selamat datang',exact:false}).waitFor();await page.clock.setSystemTime(new Date('2026-10-21T17:01:00Z'));await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.getByText('Kamis, 22 Oktober 2026 · WIB',{exact:false}).waitFor();
 assert.deepEqual(errors,[]);console.log('PASS: 12 role/viewport cases; keyboard disclosure; empty/planned-only/101 entries; pagination; landscape/portrait/200% text; malformed/503 retry; duplicate-dismiss prevention; WIB rollover; zero page errors.');
} finally {await browser?.close();child.kill('SIGTERM');}
