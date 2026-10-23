import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
const { chromium } = await import(process.env.UI_PLAYWRIGHT_MODULE ?? 'playwright');
const child=spawn(process.execPath,['--conditions=react-server','--import','tsx','tests/ui/server.ts'],{stdio:['ignore','pipe','pipe']});
let browser,logs='';child.stderr.on('data',b=>logs+=b);
try {
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(logs||'fixture timeout')),60000);child.stdout.on('data',b=>{if(b.toString().includes('UI_FIXTURE_READY')){clearTimeout(timer);resolve();}});child.on('exit',()=>{clearTimeout(timer);reject(Error(logs));});});
 browser=await chromium.launch({headless:true,...(process.env.UI_BROWSER_EXECUTABLE?{executablePath:process.env.UI_BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({hasTouch:true});page.setDefaultTimeout(60000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url='http://127.0.0.1:4319/?view=migration&role=admin&path=%2Fadmin%2Fmigrasi';
 const file=()=>page.getByLabel('File JSON ekspor (maksimum 2 MiB)',{exact:true});
 const upload=async content=>file().setInputFiles({name:'synthetic.json',mimeType:'application/json',buffer:Buffer.from(typeof content==='string'?content:JSON.stringify(content))});
 const reload=()=>page.getByRole('button',{name:'Muat ulang migrasi',exact:true}).click();
 const overflow=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 async function closeDialog(){await page.keyboard.press('Escape');const discard=page.getByRole('button',{name:'Buang perubahan',exact:true});if(await discard.isVisible())await discard.click();await page.getByRole('dialog').waitFor({state:'hidden'});}
 for(const width of [280,320,375,768,1024,1440,1920]){
  await page.setViewportSize({width,height:800});await page.goto(url);await page.getByText('Belum ada ekspor yang diperiksa.',{exact:true}).waitFor();await overflow();
 }
 console.log('PASS: empty state and 7 viewports');
 let posted=0;page.on('request',r=>{if(r.url().includes('/api/migration/stage')&&r.method()==='POST')posted++;});
 await upload('{"password":"SYNTHETIC-PRIVATE",');await page.getByRole('alert').filter({hasText:'Berkas bukan JSON yang valid'}).waitFor();assert.doesNotMatch(await page.locator('body').innerText(),/SYNTHETIC-PRIVATE/);assert.equal(await file().inputValue(),'');assert.equal(await file().isDisabled(),false);
 await upload(' '.repeat(2*1024*1024+1));await page.getByRole('alert').filter({hasText:'melebihi 2 MiB'}).waitFor();assert.equal(await file().inputValue(),'');
 await upload({version:2});await page.getByRole('alert').filter({hasText:'Periksa isian'}).waitFor();assert.equal(posted,0);
 const source={version:1,source:'Batch pengujian nyata',exportedAt:'2026-10-23T00:00:00Z',timezone:'Asia/Jakarta',locale:'id-ID',dateFormat:'ISO',sheets:[{name:'Unknown_Sheet',headers:['id'],rows:[['review-1']]}]};
 await upload(source);await page.getByRole('status').filter({hasText:'Berkas berhasil diperiksa'}).waitFor();await page.getByRole('heading',{name:'UNMAPPED_SOURCE_SHEET',exact:true}).waitFor();assert.equal(posted,1);
 await page.getByRole('button',{name:'Tinjau bukti migrasi',exact:true}).click();let dialog=page.getByRole('dialog');
 await dialog.getByLabel('Pemeriksaan',{exact:true}).selectOption('source_backup');await dialog.getByLabel('Keputusan',{exact:true}).selectOption('true');await dialog.getByLabel('Hasil pemeriksaan dan rujukan bukti',{exact:true}).fill('Bukti sintetis untuk pengujian');await dialog.getByLabel('Alasan keputusan',{exact:true}).fill('Pengujian guard database');
 await dialog.getByRole('button',{name:'Simpan keputusan bukti',exact:true}).click();await dialog.getByRole('alert').filter({hasText:'MIGRATION_BLOCKED'}).waitFor();assert.equal(await dialog.getByLabel('Hasil pemeriksaan dan rujukan bukti',{exact:true}).inputValue(),'Bukti sintetis untuk pengujian');await closeDialog();
 await page.getByRole('button',{name:'Tinjau data migrasi',exact:true}).click();dialog=page.getByRole('dialog');
 await dialog.getByLabel('Hasil peninjauan dan lokasi bukti',{exact:true}).fill('a'.repeat(1000));await dialog.getByLabel('Alasan',{exact:true}).fill('Peninjauan sintetis selesai');await dialog.getByRole('button',{name:'Simpan hasil peninjauan',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Hasil peninjauan berhasil disimpan'}).waitFor();await page.getByText('Lolos validasi · versi 2',{exact:true}).waitFor();await page.getByText('Hasil tinjauan: '+ 'a'.repeat(1000),{exact:true}).waitFor();
 await page.getByRole('button',{name:'Tinjau bukti migrasi',exact:true}).click();dialog=page.getByRole('dialog');
 await dialog.getByLabel('Pemeriksaan',{exact:true}).selectOption('source_backup');await dialog.getByLabel('Keputusan',{exact:true}).selectOption('true');await dialog.getByLabel('Hasil pemeriksaan dan rujukan bukti',{exact:true}).fill('Lokasi bukti privat pengujian');await dialog.getByLabel('Alasan keputusan',{exact:true}).fill('Bukti pengujian telah diperiksa');await dialog.getByRole('button',{name:'Simpan keputusan bukti',exact:true}).click();await page.getByRole('status').filter({hasText:'Keputusan bukti berhasil disimpan'}).waitFor();await page.getByText('Lolos validasi · versi 3',{exact:true}).waitFor();
 await upload(source);await page.getByRole('status').filter({hasText:'tidak dibuat batch ganda'}).waitFor();await page.getByRole('heading',{name:'UNMAPPED_SOURCE_SHEET',exact:true}).waitFor();assert.equal(posted,2);
 console.log('PASS: real database staging, replay, 1000-character review, gate guard and save');
 const base=(await (await page.request.get('http://127.0.0.1:4319/api/migration/board')).json()).data;
 const realBatch=base.batches[0], idB='22222222-2222-4222-8222-222222222222';
 let batches=Array.from({length:50},(_,i)=>({...realBatch,id:i===0?realBatch.id:i===1?idB:`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`,source:i===0?'Batch A':i===1?'Batch B':`Batch sintetis ${i}`,source_checksum:'b'.repeat(64),state:'blocked',version:'1',gates:[]}));
 const issues=Array.from({length:101},(_,i)=>({sequence:i+1,code:i===0?'TEMUAN_KHUSUS_A':`KODE_${i}`,source_table:'S'.repeat(100),row_number:i+2,field:'f'.repeat(100),severity:i%2?'error':'review',resolution:null}));
 let report={issues,counts:{Synthetic:101},mappedRows:0},readMode='ok',writeMode='ok',writes=0,heldStarted,heldRelease,hold,started,nextFailure=false;
 function holdWrite(){started=new Promise(r=>{heldStarted=r;});hold=new Promise(r=>{heldRelease=r;});writeMode='held';}
 await page.route('**/api/migration/**',async route=>{
  const request=route.request(),id=new URL(request.url()).searchParams.get('id');
  if(request.method()==='GET'){
   if(readMode==='error'||nextFailure||(id===idB&&readMode==='batch-b-error')){nextFailure=false;return route.fulfill({status:503,json:{ok:false,error:{code:'UNAVAILABLE',message:'Laporan belum dapat dimuat.'}}});}
   return route.fulfill({json:{ok:true,data:readMode==='invalid'?(id?{...report,issues:null}:{batches:null}):id?report:{batches}}});
  }
  writes++;const data=request.postDataJSON();
  if(writeMode==='held'){heldStarted();await hold;}
  if(writeMode==='network')return route.abort('failed');
  if(writeMode==='conflict')return route.fulfill({status:409,json:{ok:false,error:{code:'CONFLICT',message:'Versi batch sudah berubah.'}}});
  if(writeMode==='reject')return route.fulfill({status:422,json:{ok:false,error:{code:'MIGRATION_BLOCKED',message:'Selesaikan temuan sebelum menyetujui bukti.'}}});
  if(writeMode==='invalid')return route.fulfill({json:{ok:true,data:{version:'1'}}});
  const batch=batches.find(b=>b.id===data.batchId);batch.version=String(BigInt(batch.version)+1n);
  if(request.url().endsWith('/resolve'))report={...report,issues:report.issues.map(i=>i.sequence===data.sequence?{...i,resolution:data.evidence}:i)};
  return route.fulfill({json:{ok:true,data:{version:batch.version}}});
 });
 for(const mode of ['error','invalid']){readMode=mode;await page.goto(url);await page.getByRole('alert').waitFor();assert.equal(await file().isDisabled(),true);readMode='ok';await reload();await page.getByRole('heading',{name:'Batch A',exact:true}).waitFor();}
 const sectionA=()=>page.locator('section.ui-panel').filter({has:page.getByRole('heading',{name:'Batch A',exact:true})});
 await page.getByRole('button',{name:'Batch berikutnya',exact:true}).click();await page.getByRole('heading',{name:'Batch sintetis 5',exact:true}).waitFor();await page.getByLabel('Cari sumber atau referensi batch',{exact:true}).fill('Batch A');await page.getByRole('heading',{name:'Batch A',exact:true}).waitFor();
 await sectionA().getByRole('button',{name:'Periksa temuan dan bukti',exact:true}).click();await page.getByRole('heading',{name:'TEMUAN_KHUSUS_A',exact:true}).waitFor();
 await page.getByRole('button',{name:'Temuan berikutnya',exact:true}).click();await page.getByRole('heading',{name:'KODE_20',exact:true}).waitFor();await page.getByLabel('Jenis temuan',{exact:true}).selectOption('error');assert.equal(await page.getByRole('button',{name:'Tinjau data migrasi',exact:true}).count(),0);await page.getByLabel('Jenis temuan',{exact:true}).selectOption('');
 await page.getByLabel('Cari sheet, baris, kolom, atau kode',{exact:true}).fill('tidak-ada');await page.getByText('Tidak ada temuan sesuai filter.',{exact:true}).waitFor();await page.getByLabel('Cari sheet, baris, kolom, atau kode',{exact:true}).fill('');
 await page.setViewportSize({width:320,height:650});await overflow();
 if(process.env.UI_MIGRATION_SCREENSHOT)await page.screenshot({path:process.env.UI_MIGRATION_SCREENSHOT,fullPage:true});
 await page.getByLabel('Cari sumber atau referensi batch',{exact:true}).fill('');readMode='batch-b-error';
 await page.locator('section.ui-panel').filter({has:page.getByRole('heading',{name:'Batch B',exact:true})}).getByRole('button',{name:'Periksa temuan dan bukti',exact:true}).click();await page.getByRole('alert').waitFor();
 assert.equal(await sectionA().getByRole('heading',{name:'TEMUAN_KHUSUS_A',exact:true}).count(),1);readMode='ok';await reload();await page.getByRole('heading',{name:'TEMUAN_KHUSUS_A',exact:true}).waitFor();
 console.log('PASS: large batch/report filtering, pagination and failed batch selection binding');
 async function openGate(){await page.getByRole('button',{name:'Tinjau bukti migrasi',exact:true}).click();const modal=page.getByRole('dialog');await modal.getByLabel('Pemeriksaan',{exact:true}).selectOption('source_backup');await modal.getByLabel('Keputusan',{exact:true}).selectOption('false');await modal.getByLabel('Hasil pemeriksaan dan rujukan bukti',{exact:true}).fill('Bukti harus tetap ada');await modal.getByLabel('Alasan keputusan',{exact:true}).fill('Alasan pengujian tidak hilang');return modal;}
 dialog=await openGate();holdWrite();const before=writes;await dialog.getByRole('button',{name:'Simpan keputusan bukti',exact:true}).click();await started;await dialog.locator('form').evaluate(form=>{form.requestSubmit();form.requestSubmit();});await page.keyboard.press('Escape');assert.equal(await dialog.isVisible(),true);assert.equal(writes,before+1);writeMode='ok';nextFailure=true;heldRelease();await page.getByRole('alert').filter({hasText:'Laporan belum dapat dimuat'}).waitFor();await page.getByText('Permintaan telah berhasil, tetapi data terbaru belum dapat dimuat.',{exact:false}).waitFor();assert.equal(await file().isDisabled(),true);await reload();await page.getByRole('heading',{name:'TEMUAN_KHUSUS_A',exact:true}).waitFor();
 for(const mode of ['network','conflict','invalid','reject']){
  dialog=await openGate();writeMode=mode;await dialog.getByRole('button',{name:'Simpan keputusan bukti',exact:true}).click();await dialog.getByRole('alert').waitFor();assert.equal(await dialog.getByLabel('Hasil pemeriksaan dan rujukan bukti',{exact:true}).inputValue(),'Bukti harus tetap ada');
  if(mode==='reject'){assert.equal(await dialog.getByRole('button',{name:'Simpan keputusan bukti',exact:true}).isDisabled(),false);await closeDialog();}
  else{assert.equal(await dialog.getByRole('button',{name:'Simpan keputusan bukti',exact:true}).isDisabled(),true);writeMode='ok';await dialog.getByRole('button',{name:'Muat ulang dan periksa data',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});await page.getByRole('heading',{name:'TEMUAN_KHUSUS_A',exact:true}).waitFor();}
 }
 writeMode='ok';await page.addStyleTag({content:'html {font-size:32px}'});await overflow();await page.setViewportSize({width:844,height:390});await overflow();dialog=await openGate();assert.equal(await dialog.evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight+1),true);await closeDialog();
 assert.deepEqual(errors,[]);console.log('PASS: migration actions, validation, file reset/privacy, duplicate submit, refresh failure, uncertain/conflict recovery, touch, 200% text and orientation; zero page errors.');
} finally {await browser?.close();child.kill('SIGTERM');}
