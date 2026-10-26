import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.UI_PLAYWRIGHT_MODULE ?? 'playwright');
const child=spawn(process.execPath,['--conditions=react-server','--import','tsx','tests/ui/server.ts'],{stdio:['ignore','pipe','pipe']});
let browser,logs='';child.stderr.on('data',b=>logs+=b);
try {
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(logs||'fixture timeout')),60000);child.stdout.on('data',b=>{if(b.toString().includes('UI_FIXTURE_READY')){clearTimeout(timer);resolve();}});child.on('exit',()=>{clearTimeout(timer);reject(Error(logs));});});
 browser=await chromium.launch({headless:true,...(process.env.UI_BROWSER_EXECUTABLE?{executablePath:process.env.UI_BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({hasTouch:true,reducedMotion:'reduce'});page.setDefaultTimeout(60000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const screenshots=process.env.UI_SCREENSHOT_DIR;if(screenshots)await mkdir(screenshots,{recursive:true});
 const admin='11111111-1111-4111-8111-111111111111',guru='22222222-2222-4222-8222-222222222222',occ='33333333-3333-4333-8333-333333333333',subject='44444444-4444-4444-8444-444444444444',jid='55555555-5555-4555-8555-555555555555';
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta'}).format(new Date());
 let role='admin',rows=[],blocks=[],h1=false,writeMode='ok',readMode='ok',writes=0,contextReads=0,historyReads=0,blockReads=0,holdRelease,holdStarted,started,hold;
 const record={id:jid,occurrenceId:occ,userId:admin,teacherName:'Guru sintetis',date,className:'VII',subjectName:'IPA',material:'Materi sintetis',present:20,absent:0,notes:'Catatan',inputType:'SAME_DAY',weight:'1',creditedJtm:'2.0000',version:'1',submittedAt:date+'T07:00:00Z',recapAvailable:false};
 await page.route('**/api/activities/**',async route=>{
  const req=route.request(),url=new URL(req.url()),kind=url.pathname.split('/').at(-1);
  const ok=data=>route.fulfill({json:{ok:true,data}});
  if(req.method()==='GET'){
   if(kind==='options'){contextReads++;return ok({teachers:[{id:guru,name:'Guru sintetis'}],subjects:[{id:subject,name:'IPA'}],h1Enabled:h1});}
   if(kind==='blocks'){blockReads++;return ok({items:blocks});}
   if(kind==='eligible')return ok({items:[{id:occ,userId:role==='admin'?admin:guru,date:url.searchParams.get('date'),kind:'KBM',className:'VII',subjectName:'IPA',expectedStudents:20,timeStart:'07:00',timeEnd:'09:00',journalId:rows.length?jid:null,eligibilityError:null}]});
   if(kind==='journals'){historyReads++;
    if(readMode==='error')return route.fulfill({status:503,json:{ok:false,error:{code:'UNAVAILABLE',message:'Riwayat belum tersedia.'}}});
    if(readMode==='invalid')return ok({items:null,total:0});
    const p=Number(url.searchParams.get('page'));return ok({items:rows.slice((p-1)*25,p*25),total:rows.length,page:p,pageSize:25});
   }
   if(kind==='export')return route.fulfill({contentType:'text/csv',body:'tanggal,materi\n'+date+',Materi'});
  }
  writes++;const input=req.postDataJSON();
  if(writeMode==='held'){holdStarted();await hold;}
  if(writeMode==='conflict')return route.fulfill({status:409,json:{ok:false,error:{code:'VERSION_CONFLICT',message:'Jurnal berubah pada sesi lain.'}}});
  if(writeMode==='lost'){rows=[{...record,...input}];return route.abort('connectionreset');}
  if(writeMode==='invalid')return ok({id:null});
  if(writeMode==='reject')return route.fulfill({status:403,json:{ok:false,error:{code:'FORBIDDEN',message:'Perubahan ditolak.'}}});
  if(kind==='journal-create'){rows=[{...record,...input,userId:role==='admin'?admin:guru}];return ok(rows[0]);}
  if(kind==='journal-edit'){rows=rows.map(r=>r.id===input.journalId?{...r,...input,version:String(BigInt(r.version)+1n)}:r);return ok(rows.find(r=>r.id===input.journalId));}
  if(kind==='journal-delete'){rows=rows.filter(r=>r.id!==input.journalId);return ok({deleted:true,id:input.journalId});}
  if(kind==='h1')h1=input.enabled;
  if(kind==='block'){
   if(input.id)blocks=blocks.map(b=>b.id===input.id?{...b,active:input.active,version:String(BigInt(b.version)+1n)}:b);
   else blocks.push({id:subject,subject_id:input.subjectId,date_start:input.dateStart,date_end:input.dateEnd,message:input.message,active:true,version:'1'});
  }
  return ok({saved:true});
 });
 const go=async()=>{await page.goto('http://127.0.0.1:4319/?view=journals&role='+role);await page.getByRole('button',{name:'Jurnal pembelajaran',exact:true}).waitFor();await page.waitForFunction(()=>!document.querySelector('[aria-busy="true"]'));};
 const tab=async name=>page.getByRole('tab',{name,exact:true}).click();
 const overflow=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 const close=async()=>{await page.keyboard.press('Escape');const discard=page.getByRole('button',{name:'Buang perubahan',exact:true});if(await discard.isVisible())await discard.click();await page.getByRole('dialog').waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.closest('.ui-workspace-pilot')!==null);};
 const reload=async()=>{await page.getByRole('button',{name:'Muat ulang',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('[aria-busy="true"]'));};
 await go(); await page.waitForTimeout(300); assert.equal(historyReads,0,'Hidden history must not be fetched on journal entry');
 await page.locator('summary').filter({hasText:'Tanggal dan filter jurnal'}).click();
 await page.getByLabel('Cari materi/catatan',{exact:true}).fill('Pencarian tersembunyi');await page.waitForTimeout(300);assert.equal(historyReads,0,'Hidden search must not fetch history');
 await tab('Riwayat dan Detail Jurnal');await page.getByText('Belum ada jurnal pada rentang ini.',{exact:true}).waitFor();assert.equal(historyReads,1);
 await tab('Input Jurnal Pembelajaran');const hiddenReads=historyReads;await page.getByRole('button',{name:'Muat ulang',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('[aria-busy="true"]'));assert.equal(historyReads,hiddenReads,'Input refresh must not fetch history without recovery need');

 for(const width of [280,320,375,768,1024,1440,1920]){
  await page.setViewportSize({width,height:800});await go();await overflow();
  await page.getByRole('button',{name:'Jurnal pembelajaran',exact:true}).click();const d=page.getByRole('dialog');await d.getByLabel('Kegiatan',{exact:true}).waitFor();
  if(screenshots&&[320,1440].includes(width)){await d.evaluate(async el=>Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>{}))));await page.screenshot({path:screenshots+'/journal-modal-'+width+'.png'});}
  assert.equal(await d.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1&&r.top>=-1&&r.bottom<=innerHeight+1;}),true);await close();
  await tab('Riwayat dan Detail Jurnal');await overflow();await tab('Kebijakan dan Pemblokiran Jurnal');await overflow();
 }
 await tab('Input Jurnal Pembelajaran');await page.getByRole('button',{name:'Jurnal pembelajaran',exact:true}).click();let d=page.getByRole('dialog');
 await d.getByLabel('Kegiatan',{exact:true}).selectOption(occ);await d.getByLabel('Materi pembelajaran',{exact:true}).fill('Materi baru');await d.getByLabel('Alasan penyimpanan',{exact:true}).fill('Catatan pembelajaran harian');
 await d.getByLabel('Siswa hadir',{exact:true}).fill('');await d.getByRole('button',{name:'Simpan jurnal',exact:true}).click();assert.equal(writes,0);
 await d.getByLabel('Siswa hadir',{exact:true}).fill('19');await d.getByRole('button',{name:'Simpan jurnal',exact:true}).click();await d.getByRole('alert').waitFor();assert.equal(writes,0);
 await d.getByLabel('Siswa hadir',{exact:true}).fill('20');
 started=new Promise(r=>holdStarted=r);hold=new Promise(r=>holdRelease=r);writeMode='held';await d.getByRole('button',{name:'Simpan jurnal',exact:true}).click();await started;
 await d.locator('form').evaluate(f=>{f.requestSubmit();f.requestSubmit();});await page.keyboard.press('Escape');assert.equal(await d.isVisible(),true);assert.equal(writes,1);writeMode='ok';holdRelease();await d.waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.closest('.ui-workspace-pilot')!==null);
 await tab('Riwayat dan Detail Jurnal');await page.getByText('Materi baru',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Ubah jurnal',exact:true}).click();d=page.getByRole('dialog');await d.getByLabel('Materi pembelajaran',{exact:true}).fill('Materi diperbarui');await d.getByLabel('Alasan penyimpanan',{exact:true}).fill('Koreksi materi pembelajaran');
 writeMode='conflict';await d.getByRole('button',{name:'Simpan jurnal',exact:true}).click();await d.getByRole('alert').waitFor();assert.equal(await d.getByLabel('Materi pembelajaran',{exact:true}).inputValue(),'Materi diperbarui');assert.equal(await d.getByRole('button',{name:'Simpan jurnal',exact:true}).isDisabled(),true);
 writeMode='ok';await d.getByRole('button',{name:'Muat ulang dan periksa jurnal',exact:true}).click();await d.waitFor({state:'hidden'});await tab('Riwayat dan Detail Jurnal');await page.getByRole('button',{name:'Ubah jurnal',exact:true}).click();d=page.getByRole('dialog');await d.getByLabel('Saya sudah memeriksa hasil terbaru sebelum melanjutkan.').check();await d.getByRole('button',{name:'Pulihkan draft',exact:true}).click();await d.getByLabel('Alasan penyimpanan',{exact:true}).fill('Koreksi materi pembelajaran');await d.getByRole('button',{name:'Simpan jurnal',exact:true}).click();await d.waitFor({state:'hidden'});
 await tab('Riwayat dan Detail Jurnal');await page.getByRole('button',{name:'Hapus jurnal dan batalkan JTM',exact:true}).click();d=page.getByRole('dialog');await d.getByLabel('Alasan penghapusan jurnal',{exact:true}).fill('Jurnal pengujian dibatalkan');await d.getByRole('button',{name:'Konfirmasi penghapusan jurnal',exact:true}).click();await d.waitFor({state:'hidden'});await page.getByText('Belum ada jurnal pada rentang ini.',{exact:true}).waitFor();
 await tab('Kebijakan dan Pemblokiran Jurnal');await page.getByRole('button',{name:'Aktifkan jurnal H-1',exact:true}).click();d=page.getByRole('dialog');await d.getByLabel('Alasan perubahan kebijakan',{exact:true}).fill('Membuka pengisian hari sebelumnya');await d.getByRole('button',{name:'Aktifkan jurnal H-1',exact:true}).click();await d.waitFor({state:'hidden'});await page.getByRole('button',{name:'Nonaktifkan jurnal H-1',exact:true}).waitFor();
 await page.getByRole('button',{name:'Blok pengisian jurnal',exact:true}).click();d=page.getByRole('dialog');await d.getByLabel('Mata pelajaran',{exact:true}).selectOption(subject);await d.getByLabel('Pesan pemblokiran',{exact:true}).fill('Pemblokiran sintetis');await d.getByLabel('Alasan perubahan blok',{exact:true}).fill('Pemeriksaan materi pembelajaran');await d.getByRole('button',{name:'Simpan blok jurnal',exact:true}).click();await d.waitFor({state:'hidden'});await page.getByRole('button',{name:'Nonaktifkan blok jurnal',exact:true}).click();d=page.getByRole('dialog');await d.getByLabel('Alasan perubahan blok',{exact:true}).fill('Pemeriksaan sudah selesai');await d.getByRole('button',{name:'Simpan status blok jurnal',exact:true}).click();await d.waitFor({state:'hidden'});await page.getByRole('button',{name:'Aktifkan blok jurnal',exact:true}).waitFor();
 // Failed/uncertain writes retain the form; recovery never retries automatically.
 await tab('Input Jurnal Pembelajaran');
 for(const mode of ['reject','invalid','lost']){
  await page.getByRole('button',{name:'Jurnal pembelajaran',exact:true}).click();d=page.getByRole('dialog');
  await d.getByLabel('Kegiatan',{exact:true}).selectOption(occ);if(mode==='lost'){await d.getByLabel('Saya sudah memeriksa hasil terbaru sebelum melanjutkan.').check();await d.getByRole('button',{name:'Pulihkan draft',exact:true}).click();}await d.getByLabel('Materi pembelajaran',{exact:true}).fill('Isian tetap tersimpan');await d.getByLabel('Alasan penyimpanan',{exact:true}).fill('Pengujian penolakan server');writeMode=mode;
  const beforeWrite=writes;await d.getByRole('button',{name:'Simpan jurnal',exact:true}).click();await d.getByRole('alert').waitFor();assert.equal(writes,beforeWrite+1);assert.equal(await d.getByLabel('Materi pembelajaran',{exact:true}).inputValue(),'Isian tetap tersimpan');
  if(mode==='reject'){assert.equal(await d.getByRole('button',{name:'Simpan jurnal',exact:true}).isEnabled(),true);await close();}
  else {assert.equal(await d.getByRole('button',{name:'Simpan jurnal',exact:true}).isDisabled(),true);await d.getByRole('button',{name:'Muat ulang dan periksa jurnal',exact:true}).click();await d.waitFor({state:'hidden'});}
  writeMode='ok';await page.waitForFunction(()=>!document.querySelector('[aria-busy="true"]'));
  assert.equal(writes,beforeWrite+1);
  if(mode==='lost')assert.equal(rows[0].material,'Isian tetap tersimpan');
 }
 // A saved edit must remain acknowledged even if subsequent history refresh fails.
 rows=[{...record,material:'x'.repeat(2000),notes:'y'.repeat(2000)}];await reload();await tab('Riwayat dan Detail Jurnal');await page.setViewportSize({width:320,height:650});await overflow();if(screenshots)await page.screenshot({path:screenshots+'/journal-history-mobile.png'});
 await page.getByRole('button',{name:'Ubah jurnal',exact:true}).click();d=page.getByRole('dialog');await d.getByLabel('Alasan penyimpanan',{exact:true}).fill('Simpan sebelum pemuatan gagal');readMode='error';await d.getByRole('button',{name:'Simpan jurnal',exact:true}).click();await d.waitFor({state:'hidden'});await page.getByRole('status').filter({hasText:'Jurnal berhasil disimpan'}).waitFor();await tab('Riwayat dan Detail Jurnal');await page.getByRole('alert').filter({hasText:'Riwayat belum tersedia'}).waitFor();assert.equal(await page.getByRole('button',{name:'Unduh CSV',exact:true}).isDisabled(),true);
 readMode='ok';rows=[];await reload();
 // Invalid history must never prevent independent input or cause options refetch on search.
 readMode='invalid';await reload();await tab('Riwayat dan Detail Jurnal');await page.getByRole('alert').waitFor();await tab('Input Jurnal Pembelajaran');assert.equal(await page.getByRole('button',{name:'Jurnal pembelajaran',exact:true}).isEnabled(),true);
 readMode='ok';await reload();await page.locator('summary').filter({hasText:'Tanggal dan filter jurnal'}).click();const before=contextReads;await page.getByLabel('Cari materi/catatan',{exact:true}).fill('materi');await page.waitForTimeout(500);assert.equal(contextReads,before);
 await page.getByLabel('Riwayat mulai',{exact:true}).fill('2099-01-01');await tab('Riwayat dan Detail Jurnal');await page.getByRole('alert').waitFor();await tab('Input Jurnal Pembelajaran');assert.equal(await page.getByRole('button',{name:'Jurnal pembelajaran',exact:true}).isEnabled(),true);
 await go();await tab('Riwayat dan Detail Jurnal');const download=page.waitForEvent('download');await page.getByRole('button',{name:'Unduh CSV',exact:true}).click();assert.equal((await download).suggestedFilename(),'journals.csv');
 rows=Array.from({length:26},(_,i)=>({...record,id:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,material:'Data '+i}));await reload();await page.getByRole('button',{name:'Berikutnya',exact:true}).click();await page.getByText('Data 25',{exact:true}).waitFor();await page.getByRole('button',{name:'Hapus jurnal dan batalkan JTM',exact:true}).click();d=page.getByRole('dialog');await d.getByLabel('Alasan penghapusan jurnal',{exact:true}).fill('Menghapus baris halaman akhir');await d.getByRole('button',{name:'Konfirmasi penghapusan jurnal',exact:true}).click();await d.waitFor({state:'hidden'});await page.getByText('Halaman 1 dari 1 · 25 catatan',{exact:true}).waitFor();await page.getByRole('button',{name:'Ubah jurnal',exact:true}).first().waitFor();assert.equal(await page.getByRole('button',{name:'Ubah jurnal',exact:true}).first().isEnabled(),true);
 role='guru';rows=[];const beforeBlocks=blockReads;await go();await tab('Kebijakan dan Pemblokiran Jurnal');assert.equal(await page.getByRole('button',{name:/jurnal H-1/}).count(),0);assert.equal(blockReads,beforeBlocks);
 await page.setViewportSize({width:844,height:390});await overflow();await page.addStyleTag({content:'html{font-size:32px}'});await overflow();assert.deepEqual(errors,[]);
 console.log('PASS: journals 7 widths/all tabs, modal bounds, create/edit/delete/H1/block commands, blank/count validation, double submit/busy close, conflict/rejected/malformed-ack/lost-response-after-commit recovery, saved edit with failed refresh, long text, independent invalid history/search, CSV, last-page deletion, teacher permissions, touch/landscape/200% text; zero page errors. Browser commands use controlled API fixtures; database business rules tested separately.');
} finally {await browser?.close();child.kill('SIGTERM');}
