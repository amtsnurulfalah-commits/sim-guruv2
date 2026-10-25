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
 let summary=structuredClone(base),delay=0,apiError=false,items=[],dismissCount=0,summaryRequests=0,wrongAccount=false,wrongDate=false;
 const clientDate=()=>page.evaluate(()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()));
 const summaryRoute=async route=>{summaryRequests++;const date=await clientDate();const role=new URL(page.url()).searchParams.get('role')==='guru'?'guru':'admin';if(delay)await new Promise(r=>setTimeout(r,delay));await route.fulfill({status:apiError?503:200,contentType:'application/json',body:JSON.stringify(apiError?{ok:false,error:{code:'UNAVAILABLE',message:'Ringkasan sedang tidak tersedia.'},requestId:'11111111-1111-4111-8111-111111111111'}:{ok:true,data:{date:wrongDate?'1999-01-01':date,user:{id:wrongAccount?'33333333-3333-4333-8333-333333333333':role==='guru'?'22222222-2222-4222-8222-222222222222':'11111111-1111-4111-8111-111111111111',role},summary:{...summary,date}}})});};
 await page.route('**/api/dashboard*',summaryRoute);
 await page.route('**/api/operations/announcements',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,data:items})}));
 await page.route('**/api/operations/dismiss',async route=>{dismissCount++;await new Promise(r=>setTimeout(r,400));items=items.filter(item=>item.id!==route.request().postDataJSON().id);await route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,data:{}})});});
 const go=role=>{console.log('Dashboard scenario',role,summary.tasks?.length,summary.planned?.length,apiError);if(role==='guru')summary={...summary,admin:null};return page.goto(`http://127.0.0.1:4319/?view=dashboard&role=${role}&path=/dashboard`);};
 const noOverflow=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 for(const role of ['admin','guru'])for(const width of [280,320,375,768,1024,1440,1920]){
  summary={...base,admin:role==='admin'?{activeUsers:1234,failedMessages:4,failedJobs:1}:null};
  await page.setViewportSize({width,height:900});await go(role);
  await page.getByText('Belum ada jadwal atau penugasan untuk Anda pada hari ini.',{exact:false}).waitFor();
  assert.equal(await page.getByRole('heading',{name:'Ringkasan administrasi',exact:true}).count(),role==='admin'?1:0);
  const context=page.getByRole('region',{name:'Konteks hari ini',exact:true});await context.locator('summary').waitFor();await context.locator('summary').focus();await page.keyboard.press('Enter');await context.getByText('Semester aktif',{exact:true}).waitFor();await noOverflow();await page.keyboard.press('Space');
  if(width===1440)await page.evaluate(()=>scrollTo(0,0));
  if(width===1440)await page.screenshot({path:`${output}/${role}-desktop.png`,fullPage:true});
  if(width===375)await page.evaluate(()=>scrollTo(0,0));
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
 summary={};await go('admin');await page.getByRole('alert').filter({hasText:'Layanan ringkasan mengirim data yang belum sesuai'}).waitFor();summary={...base,admin:{activeUsers:1,failedMessages:0,failedJobs:0}};await page.getByRole('button',{name:'Coba kembali',exact:true}).click();await page.getByText('Belum ada jadwal atau penugasan untuk Anda pada hari ini.',{exact:false}).waitFor();
 apiError=true;await page.getByRole('button',{name:'Muat ulang ringkasan',exact:true}).click();await page.getByRole('alert').filter({hasText:'11111111-1111-4111-8111-111111111111'}).waitFor();apiError=false;await page.getByRole('button',{name:'Coba kembali',exact:true}).click();await page.getByText('Belum ada jadwal atau penugasan untuk Anda pada hari ini.',{exact:false}).waitFor();
 // Context recovery is independent: retrying it must not reload the summary.
 await page.route('**/api/day-context?*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,data:null})}));
 await go('guru');await page.getByRole('alert').filter({hasText:'Data konteks hari belum sesuai'}).waitFor();
 await page.getByText('Belum ada jadwal atau penugasan untuk Anda pada hari ini.',{exact:false}).waitFor();
 const beforeContextRetry=summaryRequests;await page.unroute('**/api/day-context?*');
 await page.getByRole('button',{name:'Muat ulang konteks',exact:true}).click();
 await page.getByRole('region',{name:'Konteks hari ini',exact:true}).locator('summary').waitFor();assert.equal(summaryRequests,beforeContextRetry);
 // Dismissal permits only one in-flight write, preserves the second card and gives success feedback.
 items=[1,2].map(n=>({id:`33333333-3333-4333-8333-${String(n).padStart(12,"0")}`,title:`Pengumuman ${n}`,body:'Keterangan '+ 'a'.repeat(400),severity:'warning',version:1,canDismiss:true,cta_url:null,cta_text:null}));await go('admin');await page.getByRole('heading',{name:'Pengumuman 1',exact:true}).waitFor();await page.getByRole('button',{name:'Tutup pengumuman',exact:true}).first().evaluate(button=>{button.click();button.click();});await page.getByRole('button',{name:'Muat ulang ringkasan',exact:true}).click();await page.getByRole('status').filter({hasText:'Pengumuman berhasil ditutup.'}).waitFor();assert.equal(dismissCount,1);assert.equal(await page.getByRole('heading',{name:'Pengumuman 1',exact:true}).count(),0);assert.equal(await page.getByRole('heading',{name:'Pengumuman 2',exact:true}).count(),1);await noOverflow();
 // Slow focus bursts coalesce without clearing a valid snapshot or remounting announcements.
 summary=base;await go('guru');await page.getByRole('heading',{name:'Pengumuman 2',exact:true}).waitFor();
 await page.getByText('Belum ada jadwal atau penugasan untuk Anda pada hari ini.',{exact:false}).waitFor();
 delay=600;const beforeWake=summaryRequests;await page.evaluate(()=>{for(let n=0;n<4;n++)window.dispatchEvent(new Event('focus'));});
 await page.getByRole('status').filter({hasText:'Memperbarui ringkasan'}).waitFor();
 await page.getByText('Belum ada jadwal atau penugasan untuk Anda pada hari ini.',{exact:false}).waitFor();
 await page.getByRole('button',{name:'Muat ulang ringkasan',exact:true}).waitFor({state:'visible'});await page.waitForTimeout(800);assert.equal(summaryRequests,beforeWake+1);delay=0;
 wrongAccount=true;await page.getByRole('button',{name:'Muat ulang ringkasan',exact:true}).click();await page.getByRole('alert').filter({hasText:'Layanan ringkasan mengirim data yang belum sesuai'}).waitFor();wrongAccount=false;wrongDate=true;await page.getByRole('button',{name:'Coba kembali',exact:true}).click();await page.getByRole('alert').filter({hasText:'Layanan ringkasan mengirim data yang belum sesuai'}).waitFor();wrongDate=false;
 // Transport failure fails closed, then recovers without navigation.
 await page.unroute('**/api/dashboard*');await page.route('**/api/dashboard*',route=>route.abort());await page.getByRole('button',{name:'Coba kembali',exact:true}).click();await page.getByRole('alert').waitFor();await page.unroute('**/api/dashboard*');await page.route('**/api/dashboard*',summaryRoute);await page.getByRole('button',{name:'Coba kembali',exact:true}).click();await page.getByText('Belum ada jadwal atau penugasan untuk Anda pada hari ini.',{exact:false}).waitFor();
 // Correct shape with wrong calendar/task envelope date must still be rejected.
 await page.route('**/api/day-context?*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,data:{date:'1999-01-01',isHoliday:false,kbmEnabled:true,examEnabled:true,calendarEntry:null,activeAcademicPeriod:null,override:null,reasons:[]}})}));
 await page.route('**/api/operations/tasks',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,data:{date:'1999-01-01',generatedAt:new Date().toISOString(),items:[]}})}));
 await go('guru');await page.getByRole('alert').filter({hasText:'Data konteks hari belum sesuai'}).waitFor();await page.getByRole('alert').filter({hasText:'Data pusat tugas belum sesuai'}).waitFor();
 await page.unroute('**/api/day-context?*');await page.unroute('**/api/operations/tasks');
 // Date rollover: mock all dated widgets using the same browser clock.
 await page.route('**/api/day-context?*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,data:{date:new URL(route.request().url()).searchParams.get('date'),isHoliday:false,kbmEnabled:true,examEnabled:true,calendarEntry:null,activeAcademicPeriod:null,override:null,reasons:[]}})}));
 await page.route('**/api/operations/tasks',async route=>route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,data:{date:await clientDate(),generatedAt:new Date().toISOString(),items:[]}})}));
 await page.clock.install({time:new Date('2026-10-21T16:59:59Z')});await go('guru');await page.getByText('Belum ada jadwal atau penugasan untuk Anda pada hari ini.',{exact:false}).waitFor();await page.clock.setSystemTime(new Date('2026-10-21T17:01:00Z'));await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.getByText('Kamis, 22 Oktober 2026 · WIB',{exact:false}).waitFor();await page.getByText('Belum ada jadwal atau penugasan untuk Anda pada hari ini.',{exact:false}).waitFor();assert.equal(await page.getByRole('alert').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS: 14 role/viewport cases; keyboard disclosure; empty/planned-only/101 entries; pagination; landscape/portrait/200% text; malformed/503 retry; account/date guard; focus coalescing; duplicate-dismiss prevention; WIB rollover; zero page errors.');
} finally {await browser?.close();child.kill('SIGTERM');}
