/** Synthetic calendar transport; no production data mutations. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.UI_PLAYWRIGHT_MODULE??'playwright');
const child=spawn(process.execPath,['--conditions=react-server','--import','tsx','tests/ui/server.ts'],{stdio:['ignore','pipe','pipe']});
let browser,stderr='';child.stderr.on('data',b=>stderr+=b);
const output=process.env.UI_REPORT_DIR??'../ui-calendar-focused';await mkdir(output,{recursive:true});
const id=n=>`33333333-3333-4333-8333-${String(n).padStart(12,'0')}`;
let entries=new Map(),overrides=new Map(),listMode='ok',dayMode='ok',periodMode='ok',previewMode='ok',commitMode='ok',historyMode='ok',historyDelay=0,previewDelay=0,commitDelay=0,previewCount=0,commitCount=0,dayCount=0,lastInput,lastMethod,lastPath,lastPreview;
const row=(date,n=1)=>({id:id(n),date,description:'Keterangan panjang '+ 'x'.repeat(480),isHoliday:false,version:'1',deletedAt:null});
const context=date=>({date,dayIndex:new Date(date+'T00:00:00Z').getUTCDay(),isHoliday:entries.get(date)?.isHoliday??false,calendarEntry:entries.get(date)??null,kbmEnabled:!entries.get(date)?.isHoliday,examEnabled:false,activeExamPeriods:[],activeExamPeriodIds:[],activeAcademicPeriod:{id:id(600),label:'2090/2091',semester:1,dateStart:'2090-01-01',dateEnd:'2090-12-31'},academicPeriodId:id(600),contextVersion:'revision-'+(entries.get(date)?.version??0)+'-'+(overrides.get(date)?.version??0),override:overrides.get(date)??null,calendarVersion:entries.get(date)?.version??'0',overrideVersion:overrides.get(date)?.version??'0',reasons:[],policyVersion:'calendar-v1',assignmentIntegration:'exams_ready'});
try {
 await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error(stderr||'fixture timeout')),60000);child.stdout.on('data',b=>{if(b.toString().includes('UI_FIXTURE_READY')){clearTimeout(t);resolve();}});child.on('exit',()=>{clearTimeout(t);reject(Error(stderr));});});
 browser=await chromium.launch({headless:true,...(process.env.UI_BROWSER_EXECUTABLE?{executablePath:process.env.UI_BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();page.setDefaultTimeout(12000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const ok=(r,data)=>r.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,data})});
 const fail=(r,code='UNAVAILABLE',status=503)=>r.fulfill({status,contentType:'application/json',body:JSON.stringify({ok:false,error:{code,message:'Penolakan kalender sintetis'},requestId:'calendar-help-123'})});
 await page.route('**/api/settings/academic-periods?*',r=>{
  if(periodMode==='error')return fail(r);if(periodMode==='bad')return ok(r,{});
  const p=Number(new URL(r.request().url()).searchParams.get('page'));return ok(r,{items:[{id:id(p===1?600:601),parentLabel:p===1?'2090/2091':'2091/2092',semester:1,dateStart:'2090-01-01',dateEnd:'2090-12-31'},{id:id(602),parentLabel:'Di luar tanggal',semester:2,dateStart:'2091-01-01',dateEnd:'2091-12-31'}],total:21,page:p,pageSize:20});
 });
 await page.route('**/api/settings/day-context?*',r=>{dayCount++;return dayMode==='error'?fail(r):ok(r,dayMode==='bad'?{}:context(new URL(r.request().url()).searchParams.get('date')));});
 await page.route('**/api/settings/calendar?*',r=>{
  if(listMode==='error')return fail(r);if(listMode==='bad')return ok(r,{});
  const q=new URL(r.request().url()).searchParams,p=Number(q.get('page')),all=[...entries.values()].filter(e=>e.date>=q.get('dateStart')&&e.date<=q.get('dateEnd')&&e.description.includes(q.get('q')??'')&&(!q.get('holiday')||String(e.isHoliday)===q.get('holiday')));
  return ok(r,{items:all.slice((p-1)*20,p*20),total:all.length,page:p,pageSize:20});
 });
 for(const kind of ['calendar','day-context'])await page.route('**/api/settings/'+kind+'/preview',async r=>{
  previewCount++;lastInput=r.request().postDataJSON();if(previewDelay)await new Promise(resolve=>setTimeout(resolve,previewDelay));
  if(previewMode==='error')return fail(r,'CALENDAR_INVALID',422);if(previewMode==='bad')return ok(r,{});
  const v=lastInput,dates=[];let d=v.dateStart??v.date,end=v.dateEnd??v.date;
  while(d<=end){dates.push(d);d=new Date(Date.parse(d+'T00:00:00Z')+86400000).toISOString().slice(0,10);}
  lastPreview={previewId:id(900),expiresAt:new Date(Date.now()+(previewMode==='expired'?-1000:600000)).toISOString(),kind:kind==='calendar'?'calendar':'context',action:v.action,count:dates.length,policyVersion:'calendar-v1',assignmentIntegration:'exams_ready',days:dates.map(date=>{const before=context(date),after=structuredClone(before);if(v.action==='upsert'||v.action==='range'){after.calendarEntry={...row(date),id:null,description:v.description,isHoliday:v.isHoliday};after.isHoliday=v.isHoliday;}if(v.action==='override')after.override={id:null,version:'1',academicPeriodId:v.academicPeriodId,kbmEnabled:v.kbmEnabled,examEnabled:v.examEnabled};return {date,before,after};})};return ok(r,lastPreview);
 });
 const save=async r=>{
  commitCount++;lastMethod=r.request().method();lastPath=new URL(r.request().url()).pathname;if(commitDelay)await new Promise(resolve=>setTimeout(resolve,commitDelay));
  if(commitMode==='stale')return fail(r,'CALENDAR_PREVIEW_STALE',409);if(commitMode==='network')return r.abort();if(commitMode==='bad')return ok(r,{});
  for(const d of lastPreview.days){if(lastPreview.action==='delete')entries.delete(d.date);else if(lastPreview.action==='clear')overrides.delete(d.date);else if(lastPreview.kind==='calendar')entries.set(d.date,{...row(d.date),description:lastInput.description,isHoliday:lastInput.isHoliday,version:String(Number(d.before.calendarVersion)+1)});else overrides.set(d.date,{id:id(700),version:'1',academicPeriodId:lastInput.academicPeriodId,kbmEnabled:lastInput.kbmEnabled,examEnabled:lastInput.examEnabled});}
  if(commitMode==='refresh-error'){listMode='error';dayMode='error';}
  return ok(r,{committed:true,count:lastPreview.count,previewId:lastPreview.previewId,policyVersion:'calendar-v1'});
 };
 await page.route('**/api/settings/calendar',save);await page.route('**/api/settings/calendar/range',save);await page.route('**/api/settings/day-context/commit',save);
 await page.route('**/api/settings/calendar/history?*',async r=>{if(historyDelay)await new Promise(resolve=>setTimeout(resolve,historyDelay));return historyMode==='error'?fail(r):ok(r,historyMode==='bad'?{}:historyMode==='empty'?[]:[{actor_name:null,reason:'Riwayat panjang '+ 'q'.repeat(500),created_at:'2090-01-01T00:00:00Z',old_data:null,new_data:null}]);});
 const go=async()=>{await page.goto('http://127.0.0.1:4319/?view=calendar&path=/admin/kalender');await page.getByLabel('Tanggal kegiatan (WIB)').fill('2090-01-15');await page.getByLabel('Bulan',{exact:true}).fill('2090-01');await page.getByRole('button',{name:'Lihat pratinjau perubahan',exact:true}).waitFor();};
 const ready=()=>page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Muat ulang'&&!b.disabled));
 const editor=()=>page.locator('form').first(),preview=()=>page.getByRole('dialog',{name:/Konfirmasi perubahan/});
 const fill=async()=>{await editor().getByLabel(/Keterangan kalender|Keterangan seluruh tanggal/).fill('Catatan sintetis');await editor().getByLabel('Alasan perubahan (minimal 5 karakter)').fill('Alasan sintetis');};
 const inspect=async()=>{await editor().getByRole('button',{name:'Lihat pratinjau perubahan',exact:true}).click();await preview().waitFor();};
 const saveButton=()=>preview().getByRole('button',{name:'Simpan perubahan kalender',exact:true});
 const bounds=async()=>{if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))console.log('OVERFLOW',page.viewportSize(),await page.evaluate(()=>({font:getComputedStyle(document.documentElement).fontSize,wide:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.right>innerWidth+1&&!e.closest('table')}).slice(0,12).map(e=>({tag:e.tagName,text:e.textContent.slice(0,70),class:e.className,width:e.getBoundingClientRect().width,right:e.getBoundingClientRect().right}))})));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);for(const d of await page.locator('dialog[open]').all()){const b=await d.boundingBox();assert.ok(b.x>=-1&&b.y>=-1&&b.x+b.width<=page.viewportSize().width+1&&b.y+b.height<=page.viewportSize().height+1);assert.equal(await d.evaluate(e=>e.scrollWidth>e.clientWidth+1),false);}};
 let matrix=0;
 for(const width of [280,320,375,768,1024,1440,1920]){
  await page.setViewportSize({width,height:900});await go();
  for(const size of [16,32]){
   await page.evaluate(s=>document.documentElement.style.fontSize=s+'px',size);
   for(const tab of ['Catatan tanggal','Tambah rentang','Atur konteks']){console.log('Calendar viewport',width,size,tab);await page.getByRole('button',{name:tab,exact:true}).click();await bounds();matrix++;}
  }
  await page.evaluate(()=>document.documentElement.style.fontSize='16px');await page.getByRole('button',{name:'Catatan tanggal',exact:true}).click();await fill();await inspect();await bounds();await page.evaluate(()=>document.documentElement.style.fontSize='32px');await bounds();await page.evaluate(()=>document.documentElement.style.fontSize='16px');
  if([375,1440].includes(width))await page.screenshot({path:`${output}/preview-${width}.png`,fullPage:true});
  await page.keyboard.press('Escape');await preview().waitFor({state:'hidden'});await ready();
 }
 await page.setViewportSize({width:375,height:812});await go();await fill();
 let invalidBefore=previewCount;await editor().getByLabel('Keterangan kalender').fill('   ');await editor().getByRole('button',{name:'Lihat pratinjau perubahan',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(previewCount,invalidBefore);assert.equal(await editor().getByLabel('Keterangan kalender').getAttribute('aria-invalid'),'true');
 await page.getByLabel('Tanggal kegiatan (WIB)').fill('2000-01-01');await editor().waitFor();await fill();await editor().getByRole('button',{name:'Lihat pratinjau perubahan',exact:true}).click();await page.getByRole('alert').filter({hasText:'Tanggal lampau'}).waitFor();assert.equal(previewCount,invalidBefore);
 await page.getByLabel('Tanggal kegiatan (WIB)').fill('2090-01-15');await editor().waitFor();await fill();const dayReads=dayCount;
 await page.getByLabel('Cari keterangan',{exact:true}).fill('Catatan');await page.getByText('0 entri · halaman 1').waitFor();assert.equal(dayCount,dayReads);assert.equal(await editor().getByLabel('Keterangan kalender').inputValue(),'Catatan sintetis');
 // Preview and commit bursts, all route methods, busy Escape.
 previewDelay=200;let before=previewCount;await editor().getByRole('button',{name:'Lihat pratinjau perubahan',exact:true}).evaluate(b=>{b.click();b.click();b.form.requestSubmit();});await preview().waitFor();assert.equal(previewCount,before+1);previewDelay=0;
 commitDelay=250;before=commitCount;await saveButton().evaluate(b=>{b.click();b.click();});await page.keyboard.press('Escape');assert.equal(await preview().isVisible(),true);await preview().waitFor({state:'hidden'});await ready();assert.equal(commitCount,before+1);assert.equal(lastMethod,'POST');commitDelay=0;
 await editor().getByLabel('Keterangan kalender').waitFor();await fill();await inspect();await saveButton().click();await preview().waitFor({state:'hidden'});await ready();assert.equal(lastMethod,'PATCH');
 await page.getByLabel('Alasan menghapus entri tanggal').fill('Hapus sintetis');await page.getByRole('button',{name:'Pratinjau penghapusan catatan',exact:true}).click();await preview().waitFor();await saveButton().click();await preview().waitFor({state:'hidden'});await ready();assert.equal(lastMethod,'DELETE');assert.equal(entries.has('2090-01-15'),false);
 await page.getByRole('button',{name:'Tambah rentang',exact:true}).click();await fill();await editor().getByLabel('Tanggal mulai',{exact:true}).fill('2090-01-16');await editor().getByLabel(/Tanggal akhir/).fill('2090-01-15');before=previewCount;await editor().getByRole('button',{name:'Lihat pratinjau perubahan',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(previewCount,before);assert.equal(await editor().getByLabel(/Tanggal akhir/).getAttribute('aria-invalid'),'true');
 await editor().getByLabel(/Tanggal akhir/).fill('2090-01-17');await inspect();assert.equal(lastPreview.count,2);await saveButton().click();await preview().waitFor({state:'hidden'});await ready();assert.equal(lastPath,'/api/settings/calendar/range');
 await page.getByRole('button',{name:'Tambah rentang',exact:true}).click();await fill();await editor().getByLabel('Tanggal mulai',{exact:true}).fill('2090-01-01');await editor().getByLabel(/Tanggal akhir/).fill('2091-01-01');await inspect();assert.equal(lastPreview.count,366);await bounds();await page.keyboard.press('Escape');await preview().waitFor({state:'hidden'});
 // Select, paginate/search/failure and clear a custom period choice.
 await page.getByRole('button',{name:'Atur konteks',exact:true}).click();await page.getByLabel('Semester yang mencakup tanggal').selectOption(id(600));assert.notEqual(await page.locator('option[value="'+id(602)+'"]').getAttribute('disabled'),null);
 await page.getByRole('button',{name:'Pilihan berikutnya',exact:true}).click();await page.getByText(/Halaman 2\. Semester/).waitFor();await page.getByLabel('Semester yang mencakup tanggal').selectOption(id(601));
 await page.getByRole('button',{name:'Pilihan sebelumnya',exact:true}).click();await page.getByText(/Halaman 1\. Semester/).waitFor();assert.equal(await page.getByLabel('Semester yang mencakup tanggal').inputValue(),id(601));
 periodMode='error';await page.getByLabel('Cari semester untuk konteks khusus').fill('uji');await page.getByRole('button',{name:'Coba muat semester',exact:true}).waitFor();periodMode='ok';await page.getByRole('button',{name:'Coba muat semester',exact:true}).click();await page.getByRole('button',{name:'Pilihan berikutnya',exact:true}).waitFor();
 await editor().getByLabel('Alasan perubahan (minimal 5 karakter)').fill('Konteks sintetis');await inspect();assert.equal(lastInput.academicPeriodId,id(601));await saveButton().click();await preview().waitFor({state:'hidden'});await ready();assert.equal(lastPath,'/api/settings/day-context/commit');
 await page.getByLabel('Semester yang mencakup tanggal').selectOption('');assert.equal(await page.getByLabel('Semester yang mencakup tanggal').inputValue(),'');
 await page.getByLabel('Alasan mengembalikan konteks standar').fill('Kembali standar');await page.getByRole('button',{name:'Pratinjau hapus konteks khusus',exact:true}).click();await preview().waitFor();await saveButton().click();await preview().waitFor({state:'hidden'});await ready();assert.equal(lastPreview.action,'clear');
 // Independent errors, malformed contracts, pagination clamp.
 await ready();listMode='error';await page.getByRole('button',{name:'Muat ulang',exact:true}).click();await page.getByRole('button',{name:'Coba muat kalender',exact:true}).waitFor();await editor().waitFor();listMode='ok';await page.getByRole('button',{name:'Coba muat kalender',exact:true}).click();await editor().waitFor();
 await ready();dayMode='bad';await page.getByRole('button',{name:'Muat ulang',exact:true}).click();await page.getByRole('button',{name:'Coba muat konteks',exact:true}).waitFor();assert.equal(await page.locator('form').count(),0);dayMode='ok';await page.getByRole('button',{name:'Coba muat konteks',exact:true}).click();await editor().waitFor();
 await ready();listMode='bad';await page.getByRole('button',{name:'Muat ulang',exact:true}).click();await page.getByRole('button',{name:'Coba muat kalender',exact:true}).waitFor();listMode='ok';entries=new Map(Array.from({length:26},(_,i)=>{const date=`2090-01-${String(i+1).padStart(2,'0')}`;return [date,row(date,i+1)];}));await go();await page.getByText('26 entri · halaman 1').waitFor();await page.getByRole('button',{name:'Berikutnya',exact:true}).click();await page.getByText('26 entri · halaman 2').waitFor();entries=new Map([['2090-01-15',row('2090-01-15')]]);await page.getByRole('button',{name:'Muat ulang',exact:true}).click();await page.getByText('1 entri · halaman 1').waitFor();
 // Same-date row must not leave editor permanently loading.
 await page.getByRole('button',{name:'Buka tanggal',exact:true}).click();await editor().waitFor();await fill();
 for(const mode of ['bad','expired']){previewMode=mode;await editor().getByRole('button',{name:'Lihat pratinjau perubahan',exact:true}).click();if(mode==='bad')await page.getByRole('alert').filter({hasText:'Format data'}).waitFor();else {await preview().waitFor();before=commitCount;await saveButton().click();await preview().getByRole('alert').waitFor();assert.equal(commitCount,before);await preview().getByRole('button',{name:'Kembali dan muat ulang',exact:true}).click();await editor().waitFor();await fill();}}previewMode='ok';
 for(const mode of ['stale','bad','network']){await inspect();commitMode=mode;before=commitCount;await saveButton().click();await preview().getByRole('alert').waitFor();assert.equal(await saveButton().isDisabled(),true);assert.equal(commitCount,before+1);await preview().getByRole('button',{name:'Kembali dan muat ulang',exact:true}).click();await editor().waitFor();await fill();}commitMode='ok';
 // History opens immediately, closing cancels; late response never reopens.
 historyDelay=400;await page.getByRole('button',{name:'Riwayat catatan tanggal',exact:true}).click();const history=page.getByRole('dialog',{name:/Riwayat 2090/});await history.getByRole('status').waitFor();await history.getByRole('button',{name:'Tutup',exact:true}).click();await page.waitForTimeout(500);assert.equal(await page.locator('dialog[open]').count(),0);historyDelay=0;
 for(const mode of ['ok','empty','bad','error']){historyMode=mode;await page.getByRole('button',{name:'Riwayat konteks khusus',exact:true}).click();await history.waitFor();if(mode==='ok')await history.getByText('Administrator',{exact:false}).waitFor();if(mode==='empty')await history.getByText('Belum ada riwayat.',{exact:true}).waitFor();if(['bad','error'].includes(mode))await history.getByRole('alert').waitFor();await bounds();await page.keyboard.press('Escape');}historyMode='ok';
 // Success remains visible after refresh failure; no implicit repeated write.
 await fill();await inspect();commitMode='refresh-error';before=commitCount;await saveButton().click();await preview().waitFor({state:'hidden'});await ready();await page.getByRole('status').filter({hasText:'Perubahan disimpan'}).waitFor();await page.getByRole('button',{name:'Coba muat kalender',exact:true}).waitFor();assert.equal(commitCount,before+1);listMode='ok';dayMode='ok';commitMode='ok';await page.getByRole('button',{name:'Coba muat konteks',exact:true}).click();await editor().waitFor();
 await page.setViewportSize({width:812,height:375});await bounds();await page.setViewportSize({width:375,height:812});await page.evaluate(()=>document.documentElement.style.fontSize='200%');await bounds();
 assert.deepEqual(errors,[]);console.log(`PASS: ${matrix} tab/text/viewport combinations, preview bounds at seven widths, all five CRUD actions and methods, single writes/busy Escape, field validation, isolated errors, period retention/retry/clear, malformed contracts, shrinking pagination, same-date selection, expired/stale/uncertain commit, cancelled/null history, saved+refresh failure and orientation; zero page errors.`);
}finally{await browser?.close();child.kill('SIGTERM');}
