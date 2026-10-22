/** Disposable Data Master regression fixtures; no production mutations. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.UI_PLAYWRIGHT_MODULE??'playwright');
const child=spawn(process.execPath,['--conditions=react-server','--import','tsx','tests/ui/server.ts'],{stdio:['ignore','pipe','pipe']});
let browser,stderr='';child.stderr.on('data',b=>stderr+=b);
const output=process.env.UI_REPORT_DIR??'../ui-masters-focused';await mkdir(output,{recursive:true});
const id='55555555-5555-4555-8555-555555555555';
const labels={'school':'Identitas sekolah','academic-years':'Tahun pelajaran','academic-periods':'Semester','classes':'Kelas dan standar siswa','subjects':'Mata pelajaran','rates':'Tarif','allowances':'Tunjangan'};
const row={id,version:'1',archivedAt:null,name:'Data sintetis '+ 'P'.repeat(200),parentLabel:'Relasi '+ 'R'.repeat(200),label:'2026/2027',dateStart:'2026-01-01',dateEnd:'2026-12-31',level:'SMP',useParallel:false,parallelMax:1,minutesPerJtm:40,address:'Alamat',npsn:'',headmasterId:null,academicYearId:id,academicPeriodId:id,semester:1,isActive:true,grade:7,parallel:'',expectedStudents:0,kind:'jtm',amount:'0',enabled:true,userId:id,dutyName:'Tugas'};
try {
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(stderr||'fixture timeout')),60000);child.stdout.on('data',b=>{if(b.toString().includes('UI_FIXTURE_READY')){clearTimeout(timer);resolve();}});child.on('exit',()=>{clearTimeout(timer);reject(Error(stderr));});});
 browser=await chromium.launch({headless:true,...(process.env.UI_BROWSER_EXECUTABLE?{executablePath:process.env.UI_BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();page.setDefaultTimeout(12000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let failure=false,malformed=false,empty=false,posts=0,historyDelay=0,referenceFailure=false;
 const ok=(r,data)=>r.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,data})});
 const fail=r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:{code:'UNAVAILABLE',message:'Kegagalan sintetis'},requestId:'master-help-123'})});
 await page.route('**/api/settings/**',async r=>{
  const u=new URL(r.request().url());
  if(u.pathname.includes('/history/')){if(historyDelay)await new Promise(resolve=>setTimeout(resolve,historyDelay));return ok(r,[]);}
  if(r.request().method()!=='GET'){posts++;await new Promise(resolve=>setTimeout(resolve,300));return ok(r,row);}
  if(failure)return fail(r);
  if(referenceFailure&&u.searchParams.get('archived')===null)return fail(r);
  const p=Number(u.searchParams.get('page')??1);
  const items=empty||u.searchParams.get('q')==='nothing'?[]:[row];
  return ok(r,malformed?{}:{items,total:items.length,page:p,pageSize:20});
 });
 const go=()=>page.goto('http://127.0.0.1:4319/?view=masters&role=admin&path=/admin/master');
 const tab=async k=>{await page.getByRole('button',{name:labels[k],exact:true}).click();await page.getByRole('region',{name:'Data master',exact:true}).waitFor();};
 const overflow=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 const fits=async d=>{const b=await d.boundingBox(),v=page.viewportSize();assert.ok(b&&b.x>=0&&b.y>=0&&b.x+b.width<=v.width+1&&b.y+b.height<=v.height+1);assert.equal(await d.evaluate(e=>e.scrollWidth>e.clientWidth+1),false);};
 const close=async d=>{await d.getByRole('button',{name:'Tutup',exact:true}).click();const discard=page.getByRole('dialog',{name:'Buang perubahan?',exact:true});if(await discard.isVisible())await discard.getByRole('button',{name:'Buang perubahan',exact:true}).click();};
 for(const width of [320,375,768,1024,1440,1920]){
  console.log('Master viewport',width);await page.setViewportSize({width,height:850});await go();
  for(const k of Object.keys(labels)){
   await tab(k);await overflow();
   if(k==='school')await page.getByRole('button',{name:'Ubah data',exact:true}).click();
   else await page.getByRole('button',{name:'Tambah '+labels[k].toLowerCase(),exact:true}).click();
   const d=page.getByRole('dialog').filter({visible:true});await fits(d);
   if(k==='classes'&&(width===375||width===1440))await page.screenshot({path:`${output}/class-editor-${width}.png`,animations:'disabled'});
   await close(d);await overflow();
  }
  if(width===375||width===1440)await page.screenshot({path:`${output}/list-${width}.png`,fullPage:true,animations:'disabled'});
 }
 await tab('school');await page.getByLabel('Cari nama / label').fill('nothing');await page.getByText('Belum ada data sesuai pencarian.',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Tambah identitas sekolah',exact:true}).isDisabled(),true);
 await tab('subjects');await page.locator('section select').first().selectOption('true');await tab('academic-years');assert.equal(await page.locator('section select').first().inputValue(),'false');
 await page.getByRole('button',{name:'Buka semester',exact:true}).click();await page.getByRole('button',{name:'Hapus filter relasi',exact:true}).waitFor();assert.equal(await page.locator('section select').first().inputValue(),'false');
 await page.getByRole('button',{name:'Ubah data',exact:true}).click();let d=page.getByRole('dialog').filter({visible:true});assert.equal(await d.locator('select[name=academicYearId]').count(),0);await close(d);
 await tab('academic-years');await page.getByRole('button',{name:'Tambah tahun pelajaran',exact:true}).click();d=page.getByRole('dialog').filter({visible:true});await d.locator('[name=label]').fill('2026/2028');await d.locator('[name=dateStart]').fill('2026-12-01');await d.locator('[name=dateEnd]').fill('2026-01-01');await d.locator('[name=reason]').fill('Validasi sintetis');await d.getByRole('button',{name:'Simpan data'}).click();await d.getByRole('alert').waitFor();assert.equal(await d.locator('[name=label]').getAttribute('aria-invalid'),'true');assert.equal(await d.locator('[name=dateEnd]').getAttribute('aria-invalid'),'true');assert.equal(posts,0);await close(d);
 referenceFailure=true;await tab('classes');await page.getByRole('button',{name:'Tambah kelas dan standar siswa',exact:true}).click();d=page.getByRole('dialog').filter({visible:true});await d.getByRole('alert').filter({hasText:'master-help-123'}).waitFor();referenceFailure=false;await d.getByRole('button',{name:'Coba lagi pilihan'}).click();await d.locator('select[name=academicPeriodId] option').nth(1).waitFor({state:'attached'});await close(d);
 await tab('subjects');historyDelay=800;await page.getByRole('button',{name:'Riwayat',exact:true}).click();d=page.getByRole('dialog',{name:'Riwayat perubahan',exact:true});await d.getByText('Memuat riwayat…').waitFor();await close(d);await tab('rates');await page.waitForTimeout(1000);assert.equal(await page.getByRole('dialog').filter({visible:true}).count(),0);historyDelay=0;
 await tab('subjects');await page.getByRole('button',{name:'Tambah mata pelajaran'}).click();d=page.getByRole('dialog').filter({visible:true});await d.locator('[name=name]').fill('Data baru');await d.locator('[name=reason]').fill('Pengujian submit ganda');await d.getByRole('button',{name:'Simpan data'}).evaluate(b=>{b.click();b.click();});await d.waitFor({state:'hidden'});assert.equal(posts,1);
 malformed=true;await page.getByRole('button',{name:'Muat ulang',exact:true}).click();await page.getByRole('alert').filter({hasText:'Respons data tidak sesuai'}).waitFor();malformed=false;failure=true;await page.getByRole('button',{name:'Muat ulang',exact:true}).click();await page.getByRole('alert').filter({hasText:'master-help-123'}).waitFor();failure=false;empty=true;await page.getByRole('button',{name:'Muat ulang',exact:true}).click();await page.getByText('Belum ada data sesuai pencarian.',{exact:true}).waitFor();
 await page.setViewportSize({width:850,height:375});await overflow();assert.deepEqual(errors,[]);console.log('Data Master focused checks passed: 42 tab/viewports + validation, singleton, reference retry, history cancellation, immutable relations, double submit, loading/error/empty/orientation.');
} finally {await browser?.close();child.kill('SIGTERM');}
