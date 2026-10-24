/** Local fixtures only: schedule UI state, validation, dialogs, and print. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.UI_PLAYWRIGHT_MODULE??'playwright');
const child=spawn(process.execPath,['--conditions=react-server','--import','tsx','tests/ui/server.ts'],{stdio:['ignore','pipe','pipe']});
let browser,stderr='';child.stderr.on('data',b=>stderr+=b);
const output=process.env.UI_REPORT_DIR??'../ui-schedules-focused';await mkdir(output,{recursive:true});
const uid=n=>`44444444-4444-4444-8444-${String(n).padStart(12,'0')}`;
const row=n=>({id:uid(n),academicPeriodId:uid(1001),userId:uid(1002),subjectId:uid(1003),classId:uid(1004),dayIndex:1,timeStart:'07:30',timeEnd:'08:10:00',scheduledJtm:'1.0000',restMinutes:0,minutesPerJtm:40,validFrom:'2090-01-01',validTo:'2090-06-30',state:'active',version:'1',teacherName:`Guru ${n}`,className:'VII',subjectName:'IPA',periodLabel:'2090 · Semester 1',replacesId:null});
try {
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(stderr||'fixture timeout')),60000);child.stdout.on('data',b=>{if(b.toString().includes('UI_FIXTURE_READY')){clearTimeout(timer);resolve();}});child.on('exit',()=>{clearTimeout(timer);reject(Error(stderr));});});
 browser=await chromium.launch({headless:true,...(process.env.UI_BROWSER_EXECUTABLE?{executablePath:process.env.UI_BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();page.setDefaultTimeout(12000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.print=()=>{window.__prints=(window.__prints??0)+1;};});
 let rows=Array.from({length:21},(_,i)=>row(i+1)),badList=false,recapFail=false,dailyFail=false,dailyDelay=0,pickerFail=false,posts=0,previewPosts=0,commits=0,writeDelay=0,stale=false,historyDelay=0,schoolDelay=0,conflictMinutes=40,printRequests=[];
 const ok=(route,data)=>route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,data})});
 const fail=(route,code='UNAVAILABLE')=>route.fulfill({status:code==='UNAVAILABLE'?503:409,contentType:'application/json',body:JSON.stringify({ok:false,error:{code,message:'Kendala sintetis untuk pengujian.'},requestId:'schedule-ref-123'})});
 await page.route('**/api/settings/**',async route=>{
  const url=new URL(route.request().url()),target=url.pathname.split('/').at(-1);
  if(target==='school'){if(schoolDelay)await new Promise(r=>setTimeout(r,schoolDelay));return ok(route,{items:[{id:uid(1005),minutesPerJtm:40}],total:1});}
  if(pickerFail&&target==='subjects')return fail(route);
  const item=target==='academic-periods'?{id:uid(1001),label:'2090',semester:1,dateStart:'2090-01-01',dateEnd:'2090-06-30'}:target==='subjects'?{id:uid(1003),name:'IPA'}:target==='classes'?{id:uid(1004),name:'VII'}:{id:uid(1006),label:'2090'};
  return ok(route,{items:[item],total:1});
 });
 await page.route('**/api/users?**',route=>ok(route,{items:[{id:uid(1002),fullName:'Guru terpilih'}],total:1}));
 await page.route('**/api/schedules**',async route=>{
  const url=new URL(route.request().url()),path=url.pathname,method=route.request().method(),q=url.searchParams;
  if(path.endsWith('/recaps'))return recapFail?fail(route):ok(route,{rowCount:rows.length,totalScheduledJtm:String(rows.length)});
  if(path.endsWith('/today')){if(dailyDelay)await new Promise(r=>setTimeout(r,dailyDelay));return dailyFail?fail(route):ok(route,{items:[{...row(100),subjectName:q.get('date')}],scheduledCount:1,dayContext:{date:q.get('date'),isHoliday:false,kbmEnabled:true}});}
  if(path.endsWith('/history')){const n=path.split('/').at(-2);if(historyDelay&&n===uid(1))await new Promise(r=>setTimeout(r,historyDelay));return ok(route,[{actor_name:'Admin',reason:'Riwayat '+n,created_at:'2026-10-22T00:00:00Z',new_data:null}]);}
  if(path.endsWith('/conflicts'))return ok(route,{conflicts:[],timeEnd:'08:10:00',minutesPerJtm:conflictMinutes});
  if(path.endsWith('/bulk-delete/preview')){previewPosts++;const data=route.request().postDataJSON();return ok(route,{previewId:uid(999),expiresAt:'2090-01-01T00:00:00Z',count:data.items.length,items:data.items.map(r=>({id:r.id,teacherName:'Guru',className:'VII',validFrom:'2090-01-01',validTo:'2090-06-30',stopFrom:data.stopFrom,operation:'archive'}))});}
  if(path.endsWith('/bulk-delete')){commits++;if(stale)return fail(route,'CALENDAR_PREVIEW_STALE');rows=[];return ok(route,{committed:true,count:1});}
  if(method==='POST'||method==='PATCH'){posts++;if(writeDelay)await new Promise(r=>setTimeout(r,writeDelay));return ok(route,{schedule:row(1),revised:false,previousId:null});}
  const size=Number(q.get('pageSize')??20),p=Number(q.get('page')??1);if(size===100)printRequests.push(p);
  let data=rows;if(q.get('q'))data=data.filter(r=>r.teacherName.includes(q.get('q')));
  return ok(route,badList?null:{items:data.slice((p-1)*size,p*size),total:data.length,page:p,pageSize:size});
 });
 const go=(role='admin')=>page.goto(`http://127.0.0.1:4319/?view=schedules&role=${role}&path=/jadwal`);
 const dialog=()=>page.getByRole('dialog',{name:'Ubah jadwal',exact:true});
 const overflow=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 const close=async(d)=>{await d.getByRole('button',{name:'Tutup',exact:true}).click();const discard=page.getByRole('dialog',{name:'Buang perubahan?',exact:true});if(await discard.isVisible())await discard.getByRole('button',{name:'Buang perubahan',exact:true}).click();};
 for(const role of ['admin','guru'])for(const width of [320,375,768,1024,1440,1920]){
  console.log('Schedule viewport',role,width);await page.setViewportSize({width,height:900});await go(role);await page.getByRole('region',{name:'Jadwal mengajar',exact:true}).waitFor();await overflow();
  if(width===375||width===1440)await page.screenshot({path:`${output}/${role}-${width}.png`,fullPage:true});
  assert.equal(await page.getByRole('button',{name:'Tambah jadwal',exact:true}).count(),role==='admin'?1:0);
  if(role==='admin'){
   await page.getByRole('button',{name:'Ubah jadwal',exact:true}).first().click();await dialog().locator('select[name=subjectId]:enabled').waitFor();
   const rect=await dialog().boundingBox();assert.ok(rect&&rect.x>=0&&rect.y>=0&&rect.x+rect.width<=width+1&&rect.y+rect.height<=900+1);
   assert.equal(await dialog().evaluate(node=>node.scrollWidth>node.clientWidth+1),false);
   await dialog().evaluate(node=>{node.scrollTop=0;});if(width===1440)await page.screenshot({path:`${output}/editor-desktop.png`,fullPage:false});await close(dialog());
  }
 }
 await page.setViewportSize({width:375,height:812});recapFail=true;await go();await page.getByRole('region',{name:'Jadwal mengajar',exact:true}).waitFor();await page.getByText('Rekap belum tersedia; daftar jadwal tetap dapat digunakan.',{exact:true}).waitFor();recapFail=false;
 // URL context survives history, reload and sharing; free-text searches remain local.
 const urlFilter = page.locator('details').filter({has:page.getByText('Filter jadwal mingguan',{exact:true})});
 await urlFilter.locator('summary').first().click();
 await urlFilter.getByLabel('Status jadwal',{exact:false}).selectOption('closed');
 await page.waitForURL('**state=closed');
 await page.reload();await page.getByRole('region',{name:'Jadwal mengajar',exact:true}).waitFor();
 await urlFilter.locator('summary').first().click();
 assert.equal(await urlFilter.getByLabel('Status jadwal',{exact:false}).inputValue(),'closed');
 await urlFilter.getByRole('button',{name:'Reset filter',exact:true}).click();
 await page.waitForURL(url=>!url.searchParams.has('state'));
 await page.goBack();await page.waitForURL('**state=closed');
 assert.equal(await urlFilter.getByLabel('Status jadwal',{exact:false}).inputValue(),'closed');
 await page.goForward();await page.waitForURL(url=>!url.searchParams.has('state'));
 await urlFilter.getByLabel('Cari guru / kelas / mata pelajaran / periode',{exact:true}).fill('Guru 21');
 assert.equal(new URL(page.url()).searchParams.has('q'),false);
 await urlFilter.getByRole('button',{name:'Reset filter',exact:true}).click();
 await urlFilter.locator('summary').first().click();
 // Daily error/retry and changed date never present a stale date's rows.
 const daily=page.locator('details').filter({has:page.getByRole('heading',{name:'Jadwal pribadi pada tanggal',exact:true})});await daily.locator('summary').click();dailyFail=true;await daily.getByLabel('Tanggal (WIB)',{exact:true}).fill('2090-01-02');await daily.getByRole('alert').waitFor();dailyFail=false;await daily.getByRole('button',{name:'Coba muat jadwal harian',exact:true}).click();await daily.getByText('VII · 2090-01-02',{exact:true}).waitFor();dailyDelay=500;await daily.getByLabel('Tanggal (WIB)',{exact:true}).fill('2090-01-03');await daily.getByText('Memuat jadwal harian…',{exact:true}).waitFor();assert.equal(await daily.getByText('VII · 2090-01-02',{exact:true}).count(),0);await daily.getByText('VII · 2090-01-03',{exact:true}).waitFor();dailyDelay=0;
 // Editor validation, conflict invalidation, duplicate submission, busy modal guard.
 await page.getByRole('button',{name:'Ubah jadwal',exact:true}).first().click();await dialog().locator('select[name=subjectId]:enabled').waitFor();await dialog().getByRole('button',{name:'Periksa bentrok jadwal',exact:true}).click();await dialog().getByRole('status').filter({hasText:'Tidak ada bentrok'}).waitFor();await dialog().getByLabel('Hari',{exact:true}).selectOption('2');assert.equal(await dialog().getByText('Tidak ada bentrok pada pemeriksaan ini.',{exact:false}).count(),0);
 await dialog().locator('[name=scheduledJtm]').fill('invalid');await dialog().getByRole('button',{name:'Periksa bentrok jadwal',exact:true}).click();await dialog().getByRole('alert').waitFor();assert.equal(await dialog().locator('[name=scheduledJtm]').getAttribute('aria-invalid'),'true');assert.equal(posts,0);await dialog().locator('[name=scheduledJtm]').fill('1.5');await dialog().locator('[name=reason]').fill('Perubahan jadwal sintetis');writeDelay=600;
 await dialog().getByRole('button',{name:'Simpan jadwal',exact:true}).evaluate(b=>{b.click();b.click();});await page.keyboard.press('Escape');assert.equal(await dialog().isVisible(),true);await page.getByRole('status').filter({hasText:'Jadwal tersimpan'}).waitFor();assert.equal(posts,1);writeDelay=0;
 // Picker failures retain the saved human-readable label and offer a real retry.
 pickerFail=true;await page.getByRole('button',{name:'Ubah jadwal',exact:true}).first().click();await dialog().getByRole('button',{name:'Coba muat pilihan',exact:true}).waitFor();assert.equal(await dialog().locator('select[name=subjectId] option:checked').textContent(),'IPA');pickerFail=false;await dialog().getByRole('button',{name:'Coba muat pilihan',exact:true}).click();await dialog().locator('select[name=subjectId]:enabled').waitFor();await dialog().evaluate(node=>{node.scrollTop=0;});const rect=await dialog().boundingBox();assert.ok(rect&&rect.x>=0&&rect.y>=0&&rect.x+rect.width<=375&&rect.y+rect.height<=812);await page.screenshot({path:`${output}/editor-mobile.png`,fullPage:false});await overflow();await close(dialog());
 // A late school read cannot overwrite a more recent server conflict calculation.
 schoolDelay=700;conflictMinutes=25;await page.getByRole('button',{name:'Ubah jadwal',exact:true}).first().click();await dialog().locator('select[name=subjectId]:enabled').waitFor();await dialog().getByRole('button',{name:'Periksa bentrok jadwal',exact:true}).click();await dialog().getByRole('status').filter({hasText:'Tidak ada bentrok'}).waitFor();await page.waitForTimeout(750);assert.ok((await dialog().textContent()).includes('25 menit per JTM'));await close(dialog());schoolDelay=0;conflictMinutes=40;
 // Create uses the same editor without losing the semester/class dependency.
 await page.getByRole('button',{name:'Tambah jadwal',exact:true}).click();const create=page.getByRole('dialog',{name:'Tambah jadwal',exact:true});
 await create.locator('select[name=academicPeriodId]:enabled').waitFor();assert.equal(await create.locator('select[name=classId]').isDisabled(),true);
 await create.locator('select[name=academicPeriodId]').selectOption(uid(1001));await create.locator('select[name=classId]:enabled').waitFor();
 await create.locator('select[name=userId]').selectOption(uid(1002));await create.locator('select[name=subjectId]').selectOption(uid(1003));await create.locator('select[name=classId]').selectOption(uid(1004));await create.locator('[name=reason]').fill('Pembuatan jadwal sintetis');
 await create.getByRole('button',{name:'Simpan jadwal',exact:true}).click();await create.waitFor({state:'hidden'});assert.equal(posts,2);
 // Search/reset keep pagination aligned with the current filter.
 const filters=page.locator('details').filter({has:page.getByText('Filter jadwal mingguan',{exact:true})});await filters.locator('summary').first().click();
 await filters.getByLabel('Cari guru / kelas / mata pelajaran / periode',{exact:true}).fill('Guru 21');await page.getByText('1 baris · halaman 1',{exact:true}).waitFor();
 await filters.getByRole('button',{name:'Reset filter',exact:true}).click();await page.getByText('21 baris · halaman 1',{exact:true}).waitFor();
 await filters.locator('summary').first().click();
 // History opens with loading state, tolerates null snapshot and cancels late responses on close.
 historyDelay=700;await page.getByRole('button',{name:'Riwayat',exact:true}).first().click();const hist=page.getByRole('dialog',{name:'Riwayat jadwal',exact:true});await hist.getByText('Memuat riwayat jadwal…',{exact:true}).waitFor();await close(hist);await page.getByRole('button',{name:'Riwayat',exact:true}).nth(1).click();await hist.getByText('Riwayat '+uid(2),{exact:true}).waitFor();await page.waitForTimeout(750);assert.equal(await hist.getByText('Riwayat '+uid(1),{exact:true}).count(),0);await close(hist);historyDelay=0;
 // Selection across pages, preview back, stale preview recovery, exactly one commit.
 await page.getByRole('checkbox').first().check();await page.getByRole('navigation',{name:'Halaman daftar jadwal',exact:true}).getByRole('button',{name:'Berikutnya',exact:true}).click();await page.getByText('21 baris · halaman 2',{exact:true}).waitFor();await page.getByRole('checkbox').first().check();await page.getByRole('button',{name:'Tinjau penghentian jadwal terpilih',exact:true}).click();const stop=page.getByRole('dialog',{name:'Hentikan 2 jadwal',exact:true});await stop.locator('[name=reason]').fill('Penghentian sintetis');await stop.getByRole('button',{name:'Lihat pratinjau dampak',exact:true}).evaluate(b=>{b.click();b.click();});await stop.getByRole('button',{name:'Konfirmasi penghentian jadwal',exact:true}).waitFor();assert.equal(previewPosts,1);await stop.getByRole('button',{name:'Ubah tanggal atau alasan',exact:true}).click();await stop.locator('[name=reason]').fill('Perubahan batas penghentian');await stop.getByRole('button',{name:'Lihat pratinjau dampak',exact:true}).click();stale=true;await stop.getByRole('button',{name:'Konfirmasi penghentian jadwal',exact:true}).click();await stop.getByRole('alert').waitFor();await stop.locator('[name=reason]').waitFor();stale=false;await stop.locator('[name=reason]').fill('Periksa ulang penghentian');await stop.getByRole('button',{name:'Lihat pratinjau dampak',exact:true}).click();await stop.getByRole('button',{name:'Konfirmasi penghentian jadwal',exact:true}).evaluate(b=>{b.click();b.click();});await page.getByText('Belum ada jadwal sesuai filter',{exact:true}).waitFor();assert.equal(commits,2);
 // Empty / malformed response; expired rows cannot be edited/stopped.
 badList=true;await go();await page.getByRole('button',{name:'Coba muat daftar jadwal',exact:true}).waitFor();badList=false;rows=[{...row(1),validFrom:'2025-01-01',validTo:'2025-06-30'}];await page.getByRole('button',{name:'Coba muat daftar jadwal',exact:true}).click();await page.getByRole('region',{name:'Jadwal mengajar',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Ubah jadwal',exact:true}).count(),0);assert.equal(await page.getByRole('checkbox').first().isDisabled(),true);
 rows=Array.from({length:101},(_,i)=>({...row(i+1),teacherName:'NamaTanpaSpasi'.repeat(15)}));await go();await page.getByRole('region',{name:'Jadwal mengajar',exact:true}).waitFor();await page.addStyleTag({content:'html{font-size:200%}'});await overflow();await page.setViewportSize({width:812,height:375});await overflow();await page.getByRole('button',{name:'Cetak seluruh hasil filter',exact:true}).click();await page.waitForFunction(()=>window.__prints===1);assert.deepEqual(printRequests,[1,2]);assert.equal(await page.locator('#schedule-print tbody tr').count(),101);
 assert.deepEqual(errors,[]);console.log('PASS: 12 role/viewport combinations, create/edit/search/reset, daily error/retry/stale prevention, recap independence, editor validation/conflict invalidation/double submit, picker retry, history cancellation/null, cross-page selection, bulk preview/back/stale/commit, pagination clamp, empty/malformed/expired rows, long names/text200/orientation and 101-row print; zero page errors.');
} finally {await browser?.close();child.kill('SIGTERM');}
