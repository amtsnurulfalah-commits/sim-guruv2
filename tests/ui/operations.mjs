import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
const { chromium } = await import(process.env.UI_PLAYWRIGHT_MODULE ?? 'playwright');
const child=spawn(process.execPath,['--conditions=react-server','--import','tsx','tests/ui/server.ts'],{stdio:['ignore','pipe','pipe']});
let browser,logs='';child.stderr.on('data',b=>logs+=b);
try {
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(logs||'fixture timeout')),60000);child.stdout.on('data',b=>{if(b.toString().includes('UI_FIXTURE_READY')){clearTimeout(timer);resolve();}});child.on('exit',()=>{clearTimeout(timer);reject(Error(logs));});});
 browser=await chromium.launch({headless:true,...(process.env.UI_BROWSER_EXECUTABLE?{executablePath:process.env.UI_BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({timezoneId:'America/Los_Angeles',hasTouch:true});
 page.setDefaultTimeout(30000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url='http://127.0.0.1:4319/?view=operations&role=admin&path=%2Fadmin%2Foperasional';
 const heading=()=>page.getByRole('heading',{name:'Pengaturan operasional',exact:true});
 const openSettings=async()=>{await page.getByRole('button',{name:'Atur operasional aplikasi',exact:true}).click();return page.getByRole('dialog',{name:'Atur operasional aplikasi',exact:true});};
 const overflow=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 async function closeDialog() {await page.keyboard.press('Escape');const discard=page.getByRole('button',{name:'Buang perubahan',exact:true});if(await discard.isVisible())await discard.click();await page.getByRole('dialog').waitFor({state:'hidden'});}
 for(const width of [280,320,375,768,1024,1440,1920]) {
  await page.setViewportSize({width,height:800});await page.goto(url);await heading().waitFor();
  await page.getByRole('button',{name:'Atur operasional aplikasi',exact:true}).waitFor();
  await page.getByText('Belum ada antrean.',{exact:true}).waitFor();await overflow();
  const dialog=await openSettings();
  await dialog.getByLabel('Mulai pemeliharaan (WIB)',{exact:true}).waitFor();
  assert.equal(await dialog.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1&&r.top>=-1&&r.bottom<=innerHeight+1;}),true);
  await closeDialog();
 }
 // Real disposable database save and local WIB conversion from a non-WIB browser.
 let body;const record=request=>{if(request.url().endsWith('/api/operations/settings')&&request.method()==='POST')body=request.postDataJSON();};page.on('request',record);
 let dialog=await openSettings();
 await dialog.getByLabel('Mulai pemeliharaan (WIB)',{exact:true}).fill('2090-11-01T20:00');
 await dialog.getByLabel('Selesai pemeliharaan (WIB)',{exact:true}).fill('2090-11-01T19:00');
 await dialog.getByLabel('Alasan perubahan (min. 5 karakter)',{exact:true}).fill('Pengujian jadwal pemeliharaan');
 await dialog.getByRole('button',{name:'Simpan pengaturan operasional',exact:true}).click();
 await dialog.getByRole('alert').filter({hasText:'Waktu selesai harus setelah'}).waitFor();assert.equal(body,undefined);
 assert.equal(await dialog.getByLabel('Selesai pemeliharaan (WIB)',{exact:true}).getAttribute('aria-invalid'),'true');
 await dialog.getByLabel('Selesai pemeliharaan (WIB)',{exact:true}).fill('2090-11-01T21:00');
 await dialog.getByRole('button',{name:'Simpan pengaturan operasional',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Pengaturan operasional berhasil disimpan'}).waitFor();await page.getByText('Versi pengaturan 2',{exact:true}).waitFor();
 assert.match(body.config.maintenanceStart,/T20:00(?::00(?:\.000)?)?\+07:00$/);assert.equal(body.config.maintenance,false);
 dialog=await openSettings();assert.match(await dialog.getByLabel('Mulai pemeliharaan (WIB)',{exact:true}).inputValue(),/2090-11-01T20:00/);await closeDialog();
 page.off('request',record);
 const base=(await (await page.request.get('http://127.0.0.1:4319/api/operations/operations')).json()).data;
 let data=structuredClone(base), readMode='ok', writeMode='ok', writes=0, nextFailure=false, heldRelease, heldStarted;
 let started,hold;
 function holdWrite(){started=new Promise(r=>{heldStarted=r;});hold=new Promise(r=>{heldRelease=r;});writeMode='held';}
 await page.route('**/api/operations/**',async route=>{
  const request=route.request();
  if(request.method()==='GET') {
   if(readMode==='error'||nextFailure){nextFailure=false;return route.fulfill({status:503,json:{ok:false,error:{code:'UNAVAILABLE',message:'Data operasional belum tersedia.'}}});}
   return route.fulfill({json:{ok:true,data:readMode==='invalid'?{...data,config:null}:data}});
  }
  writes++;const input=request.postDataJSON(),kind=request.url().split('/').at(-1);
  if(writeMode==='held'){heldStarted();await hold;}
  if(writeMode==='network')return route.abort('failed');
  if(writeMode==='conflict')return route.fulfill({status:409,json:{ok:false,error:{code:'CONFLICT',message:'Pengaturan berubah di sesi lain.'}}});
  if(writeMode==='reject')return route.fulfill({status:403,json:{ok:false,error:{code:'FORBIDDEN',message:'Anda tidak berwenang melakukan tindakan ini.'}}});
  if(writeMode==='invalid')return route.fulfill({json:{ok:true,data:{id:null,version:'1'}}});
  let result;
  if(kind==='settings'){data.config={version:String(BigInt(data.config.version)+1n),value:input.config};result={id:null,version:data.config.version};}
  else if(kind==='job-retry'){data.jobs.find(j=>j.business_key===input.key).attempts=0;result={id:null,version:null};}
  else {data.outbox.find(o=>o.id===input.id).state=kind==='retry'?'pending':input.sent?'sent':'cancelled';result={id:input.id,version:null};}
  return route.fulfill({json:{ok:true,data:result}});
 });
 // Initial errors/malformed read must offer a usable recovery path.
 for(const mode of ['error','invalid']) {
  readMode=mode;await page.goto(url);await page.getByRole('alert').waitFor();
  assert.equal(await page.getByRole('button',{name:'Atur operasional aplikasi',exact:true}).count(),0);
  readMode='ok';await page.getByRole('button',{name:'Muat ulang operasional',exact:true}).click();await page.getByRole('button',{name:'Atur operasional aplikasi',exact:true}).waitFor();
 }
 // Large queues, all retryable actions, search and independent pagination.
 data.outbox=Array.from({length:100},(_,i)=>({id:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,state:i===0?'unknown':i===1?'failed':'sent',attempts:1,next_attempt_at:'2026-10-23T00:00:00Z'}));
 data.jobs=Array.from({length:100},(_,i)=>({business_key:i===0?'job:'+('x'.repeat(140)):`job:${i}`,kind:'honor',state:i===0?'failed':'completed',attempts:2}));
 await page.getByRole('button',{name:'Muat ulang operasional',exact:true}).click();await page.getByRole('heading',{name:'Perlu pemeriksaan · 1 percobaan',exact:true}).waitFor();
 await page.setViewportSize({width:320,height:650});await overflow();
 await page.getByRole('button',{name:'Halaman berikutnya email',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Tinjau status pengiriman',exact:true}).count(),0);
 await page.getByLabel('Status email',{exact:true}).selectOption('unknown');await page.getByRole('button',{name:'Tinjau status pengiriman',exact:true}).tap();
 dialog=page.getByRole('dialog');assert.equal(await dialog.getByLabel('Email terbukti diterima',{exact:true}).inputValue(),'');
 await dialog.getByLabel('Alasan / bukti pemeriksaan',{exact:true}).fill('Bukti pemeriksaan sintetis');
 await dialog.getByRole('button',{name:'Simpan hasil pemeriksaan',exact:true}).click();assert.equal(writes,0);
 await dialog.getByLabel('Email terbukti diterima',{exact:true}).selectOption('false');await dialog.getByRole('button',{name:'Simpan hasil pemeriksaan',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Hasil pemeriksaan email berhasil disimpan'}).waitFor();assert.equal(data.outbox[0].state,'cancelled');
 await page.getByLabel('Status email',{exact:true}).selectOption('failed');await page.getByRole('button',{name:'Tinjau pengiriman ulang',exact:true}).click();dialog=page.getByRole('dialog');
 await dialog.getByLabel('Alasan perubahan (min. 5 karakter)',{exact:true}).fill('Kendala email sudah diperbaiki');await dialog.getByRole('button',{name:'Jadwalkan pengiriman ulang',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Email berhasil dijadwalkan ulang'}).waitFor();assert.equal(data.outbox[1].state,'pending');
 await page.getByLabel('Status pekerjaan',{exact:true}).selectOption('failed');await page.getByRole('button',{name:'Tinjau pengulangan pekerjaan',exact:true}).click();dialog=page.getByRole('dialog');
 await dialog.getByLabel('Alasan perubahan (min. 5 karakter)',{exact:true}).fill('Kendala pekerjaan sudah diperbaiki');await dialog.getByRole('button',{name:'Jadwalkan ulang pekerjaan',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Percobaan ulang pekerjaan berhasil dijadwalkan'}).waitFor();assert.equal(data.jobs[0].attempts,0);
 await page.getByLabel('Cari referensi pekerjaan',{exact:true}).fill('tidak-ada');await page.getByText('Tidak ada pekerjaan sesuai filter.',{exact:true}).waitFor();await page.getByLabel('Cari referensi pekerjaan',{exact:true}).fill('');
 // Double submit, closing while saving, and successful writes followed by failed refresh.
 dialog=await openSettings();await dialog.getByLabel('Alasan perubahan (min. 5 karakter)',{exact:true}).fill('Pengujian simpan sekali');holdWrite();const before=writes;
 await dialog.getByRole('button',{name:'Simpan pengaturan operasional',exact:true}).click();await started;
 await dialog.locator('form').evaluate(form=>{form.requestSubmit();form.requestSubmit();});await page.keyboard.press('Escape');assert.equal(await dialog.isVisible(),true);assert.equal(writes,before+1);
 nextFailure=true;writeMode='ok';heldRelease();await page.getByRole('alert').filter({hasText:'Data operasional belum tersedia'}).waitFor();
 await page.getByText('Perubahan telah disimpan, tetapi data terbaru belum dapat dimuat.',{exact:false}).waitFor();assert.equal(await page.getByRole('button',{name:'Atur operasional aplikasi',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'Muat ulang operasional',exact:true}).click();
 // Refuse uncertain retries; preserve entered reason until explicit recovery.
 for(const mode of ['network','conflict','invalid','reject']) {
  dialog=await openSettings();await dialog.getByLabel('Alasan perubahan (min. 5 karakter)',{exact:true}).fill('Isian harus tetap tersimpan');writeMode=mode;
  await dialog.getByRole('button',{name:'Simpan pengaturan operasional',exact:true}).click();await dialog.getByRole('alert').waitFor();
  assert.equal(await dialog.getByLabel('Alasan perubahan (min. 5 karakter)',{exact:true}).inputValue(),'Isian harus tetap tersimpan');
  if(mode==='reject'){assert.equal(await dialog.getByRole('button',{name:'Simpan pengaturan operasional',exact:true}).isDisabled(),false);await closeDialog();}
  else {assert.equal(await dialog.getByRole('button',{name:'Simpan pengaturan operasional',exact:true}).isDisabled(),true);writeMode='ok';await dialog.getByRole('button',{name:'Muat ulang dan periksa data',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});}
 }
 writeMode='ok';await page.getByLabel('Status email',{exact:true}).selectOption('');
 await page.addStyleTag({content:'html {font-size:32px}'});await overflow();await page.setViewportSize({width:844,height:390});await overflow();
 dialog=await openSettings();assert.equal(await dialog.evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight+1),true);await closeDialog();
 assert.deepEqual(errors,[]);
 console.log('PASS: operational settings real database save/WIB; 7 widths; all actions; empty/100 rows/filter/pagination; malformed/read/write errors; duplicate submission, busy modal, conflict/uncertain recovery, touch, 200% text and landscape; zero page errors.');
} finally {await browser?.close();child.kill('SIGTERM');}
