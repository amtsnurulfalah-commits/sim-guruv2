/** Disposable announcement fixtures; no real recipients or email. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.UI_PLAYWRIGHT_MODULE??'playwright');
const child=spawn(process.execPath,['--conditions=react-server','--import','tsx','tests/ui/server.ts'],{stdio:['ignore','pipe','pipe']});
let browser,stderr='';child.stderr.on('data',b=>stderr+=b);
const output=process.env.UI_REPORT_DIR??'../ui-announcements-focused';await mkdir(output,{recursive:true});
const id=n=>`33333333-3333-4333-8333-${String(n).padStart(12,'0')}`;
const row=n=>({id:id(n),title:`Pengumuman ${n}`,body:'Isi panjang '+ 'a'.repeat(500),severity:'warning',version:1,active:true,date_start:null,date_end:null,target_role:'all',target_users:[],allow_dismiss:[],deny_dismiss:[],dismissible:true,cta_text:null,cta_url:null,send_email:false,reminder_offsets:[],recipientNames:{}});
try{
 await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error(stderr||'fixture timeout')),60000);child.stdout.on('data',b=>{if(b.toString().includes('UI_FIXTURE_READY')){clearTimeout(t);resolve();}});child.on('exit',()=>{clearTimeout(t);reject(Error(stderr));});});
 browser=await chromium.launch({headless:true,...(process.env.UI_BROWSER_EXECUTABLE?{executablePath:process.env.UI_BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({hasTouch:true});page.setDefaultTimeout(30000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let items=[row(1)],readMode='ok',writeMode='ok',userMode='ok',delay=0,writes=0,lastInput,dismiss=0,dismissMode='ok';
 const ok=(r,data)=>r.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,data})});
 const fail=(r,code='UNAVAILABLE',status=503)=>r.fulfill({status,contentType:'application/json',body:JSON.stringify({ok:false,error:{code,message:'Penolakan pengumuman sintetis'},requestId:'announcement-help-123'})});
 await page.route('**/api/operations/manage',r=>readMode==='error'?fail(r):ok(r,readMode==='bad'?{}:items));
 await page.route('**/api/users?*',r=>{const p=Number(new URL(r.request().url()).searchParams.get('page'));return userMode==='error'?fail(r):ok(r,userMode==='bad'?{}:{items:[{id:id(100+p),fullName:'Guru '+ 'x'.repeat(180),username:`guru.${p}`}],total:21,page:p,pageSize:20});});
 await page.route('**/api/operations/save',async r=>{
  writes++;lastInput=r.request().postDataJSON();if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
  if(writeMode==='network')return r.abort();if(writeMode==='bad')return ok(r,{});if(writeMode==='conflict')return fail(r,'VERSION_CONFLICT',409);
  const v=lastInput,newId=v.id??id(500),version=v.id?String(Number(v.version)+1):'1';
  items=[{...row(500),id:newId,version,title:v.title,body:v.body,severity:v.severity,active:v.active,date_start:v.from,date_end:v.to,target_role:v.targetRole,target_users:v.targetUsers,allow_dismiss:v.allowDismiss,deny_dismiss:v.denyDismiss,cta_text:v.ctaText,cta_url:v.ctaUrl,send_email:v.sendEmail,reminder_offsets:v.reminderOffsets},...items.filter(a=>a.id!==newId)];
  if(writeMode==='refresh-error')readMode='error';return ok(r,{id:newId,version});
 });
 await page.route('**/api/operations/announcements',r=>ok(r,readMode==='bad'?{}:items.filter(a=>a.active).map(a=>({...a,canDismiss:a.dismissible}))));
 await page.route('**/api/operations/dismiss',async r=>{dismiss++;if(delay)await new Promise(resolve=>setTimeout(resolve,delay));if(dismissMode==='bad')return ok(r,null);const v=r.request().postDataJSON();items=items.filter(a=>a.id!==v.id);return ok(r,{});});
 const form=()=>page.locator('form').first();
 const submit=()=>page.getByRole('button',{name:'Simpan pengumuman',exact:true});
 const ready=()=>page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Simpan pengumuman'&&!b.disabled));
 const go=async()=>{await page.goto('http://127.0.0.1:4319/?view=announcements&path=/admin/pengumuman');await ready();};
 const fill=async()=>{await form().getByLabel('Judul',{exact:true}).fill('Judul sintetis');await form().getByLabel('Isi (teks biasa)',{exact:true}).fill('Isi sintetis');await form().getByLabel('Alasan perubahan (min. 5 karakter)').fill('Alasan sintetis');};
 const choices=()=>form().locator('details');
 const openChoices=async()=>{if(await choices().getAttribute('open')===null)await choices().locator('summary').tap();};
 const picker=label=>form().getByRole('group',{name:new RegExp('^'+label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))});
 const choose=async(label,n)=>{await openChoices();await page.getByLabel('Tambah '+label,{exact:true}).selectOption(id(n));};
 const bounds=async()=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.equal(await form().evaluate(e=>e.scrollWidth>e.clientWidth+1),false);};
 let matrix=0;
 for(const width of [280,320,375,768,1024,1440,1920]){
  await page.setViewportSize({width,height:900});await go();await openChoices();await choose('Sasaran pengguna tertentu',101);
  for(const size of [16,32]){console.log('Announcement viewport',width,size);await page.evaluate(s=>document.documentElement.style.fontSize=s+'px',size);await bounds();matrix++;}
  await page.evaluate(()=>document.documentElement.style.fontSize='16px');
  if([375,1440].includes(width))await page.screenshot({path:`${output}/editor-${width}.png`,fullPage:true});
 }
 await page.setViewportSize({width:375,height:812});await go();await fill();
 assert.equal(await form().getByLabel('Judul',{exact:true}).getAttribute('maxlength'),'200');assert.equal(await form().getByLabel('Isi (teks biasa)',{exact:true}).getAttribute('maxlength'),'5000');assert.equal(await form().getByLabel('URL http/https').getAttribute('maxlength'),'2000');
 // Schema errors map to the relevant fields and do not issue writes.
 await form().getByLabel('Tanggal mulai inklusif (WIB)').fill('2090-02-02');await form().getByLabel('Tanggal akhir inklusif (WIB)').fill('2090-01-01');let before=writes;await submit().click();await page.getByRole('alert').waitFor();assert.equal(writes,before);assert.equal(await form().getByLabel('Tanggal akhir inklusif (WIB)').getAttribute('aria-invalid'),'true');
 await form().getByLabel('Tanggal akhir inklusif (WIB)').fill('2090-02-03');await form().getByLabel('Teks tautan',{exact:true}).fill('Buka');await submit().click();assert.equal(writes,before);assert.equal(await form().getByLabel('URL http/https').getAttribute('aria-invalid'),'true');
 await form().getByLabel('URL http/https').fill('not-url');await submit().click();assert.equal(writes,before);await form().getByLabel('URL http/https').fill('https://example.test/info');
 await choose('Pengecualian: boleh menutup',101);await choose('Pengecualian: tidak boleh menutup',101);await submit().click();await page.getByRole('alert').waitFor();assert.equal(writes,before);assert.equal(await page.getByLabel('Tambah Pengecualian: tidak boleh menutup',{exact:true}).getAttribute('aria-invalid'),'true');
 await picker('Pengecualian: tidak boleh menutup').getByRole('button',{name:/Hapus/}).click();await choose('Sasaran pengguna tertentu',101);
 // All recipient controls lock along with the form; burst submit writes once.
 await form().getByLabel('Antrekan email',{exact:true}).selectOption('true');await form().getByLabel('H-3',{exact:true}).check();await form().getByLabel('Judul',{exact:true}).fill('J'.repeat(200));await form().getByLabel('Isi (teks biasa)',{exact:true}).fill('I'.repeat(5000));delay=300;before=writes;await submit().evaluate(b=>{b.click();b.click();b.form.requestSubmit();});assert.equal(await page.getByLabel('Tambah Sasaran pengguna tertentu',{exact:true}).isDisabled(),true);await page.getByRole('status').filter({hasText:'Pengumuman berhasil disimpan'}).waitFor();await ready();assert.equal(writes,before+1);assert.equal(lastInput.body.length,5000);assert.equal(lastInput.title.length,200);assert.equal(lastInput.sendEmail,true);assert.deepEqual(lastInput.reminderOffsets,[3]);assert.deepEqual(lastInput.targetUsers,[id(101)]);assert.deepEqual(lastInput.allowDismiss,[id(101)]);assert.equal(await form().getByLabel('Judul',{exact:true}).inputValue(),'');delay=0;
 // Edit/cancel, inactive version and recipient selection survive search/paging/errors.
 await page.getByRole('button',{name:'Ubah pengumuman',exact:true}).first().click();await form().getByLabel('Aktif',{exact:true}).selectOption('false');await openChoices();
 const target=picker('Sasaran pengguna tertentu');await target.getByRole('button',{name:'Berikutnya',exact:true}).click();await page.getByLabel('Tambah Sasaran pengguna tertentu',{exact:true}).selectOption(id(102));await target.getByRole('button',{name:'Sebelumnya',exact:true}).click();assert.equal(await target.getByRole('button',{name:/Hapus/}).count(),2);
 userMode='error';await target.getByLabel('Cari nama atau username',{exact:true}).fill('uji');await target.getByRole('button',{name:'Coba muat pengguna',exact:true}).waitFor();userMode='ok';await target.getByRole('button',{name:'Coba muat pengguna',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('select[name="targetUsers"]').disabled);assert.equal(await target.getByRole('button',{name:/Hapus/}).count(),2);
 await form().getByLabel('Alasan perubahan (min. 5 karakter)').fill('Nonaktifkan informasi');await submit().click();await page.getByRole('status').filter({hasText:'Pengumuman berhasil disimpan'}).waitFor();await ready();assert.equal(lastInput.active,false);assert.equal(lastInput.version,'1');assert.deepEqual(lastInput.targetUsers,[id(101),id(102)]);
 await page.getByRole('button',{name:'Ubah pengumuman',exact:true}).first().click();await page.getByRole('button',{name:'Batal mengubah',exact:true}).click();assert.equal(await form().getByLabel('Judul',{exact:true}).inputValue(),'');
 // Successful commit and failed refresh remain distinct; retry does not replay POST.
 await fill();writeMode='refresh-error';before=writes;await submit().click();await page.getByRole('status').filter({hasText:'Pengumuman berhasil disimpan'}).waitFor();await page.getByRole('alert').filter({hasText:'announcement-help-123'}).waitFor();assert.equal(writes,before+1);readMode='ok';writeMode='ok';await page.getByRole('button',{name:'Muat ulang pengumuman',exact:true}).click();await ready();assert.equal(writes,before+1);
 for(const mode of ['conflict','bad','network']){await fill();writeMode=mode;before=writes;await submit().click();await form().getByRole('alert').waitFor();assert.equal(writes,before+1);assert.equal(await form().getByLabel('Judul',{exact:true}).inputValue(),'Judul sintetis');{assert.equal(await submit().isDisabled(),true);writeMode='ok';await page.getByRole('button',{name:'Muat ulang pengumuman',exact:true}).click();await ready();assert.equal(await form().getByLabel('Judul',{exact:true}).inputValue(),'');}}writeMode='ok';
 // Empty/malformed/large lists, filtering and pagination clamping.
 readMode='bad';await page.getByRole('button',{name:'Muat ulang pengumuman',exact:true}).click();await page.getByRole('alert').filter({hasText:'Format data'}).waitFor();readMode='ok';items=Array.from({length:45},(_,i)=>row(i+1));await page.getByRole('button',{name:'Muat ulang pengumuman',exact:true}).click();await ready();const list=page.getByRole('region',{name:'Daftar pengumuman',exact:true});await list.getByText('45 pengumuman · halaman 1 dari 3',{exact:true}).waitFor();await list.getByRole('button',{name:'Berikutnya',exact:true}).click();await list.getByRole('button',{name:'Berikutnya',exact:true}).click();items=[row(1)];await page.getByRole('button',{name:'Muat ulang pengumuman',exact:true}).click();await ready();await list.getByText('1 pengumuman · halaman 1 dari 1',{exact:true}).waitFor();await page.getByLabel('Cari judul atau isi',{exact:true}).fill('Tidak ditemukan');await page.getByText('Belum ada pengumuman sesuai filter.',{exact:true}).waitFor();await bounds();await page.setViewportSize({width:812,height:375});await bounds();
 // Dashboard respects server dismiss permission, canonical versions and CTA touch targets.
 items=[{...row(1),dismissible:false,cta_text:'Buka informasi',cta_url:'https://example.test/info'},row(2)];readMode='ok';await page.goto('http://127.0.0.1:4319/?view=dashboard&path=/dashboard');await page.getByRole('heading',{name:'Pengumuman 1',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Tutup pengumuman',exact:true}).count(),1);assert.ok((await page.getByRole('link',{name:'Buka informasi',exact:true}).boundingBox()).height>=44);
 delay=250;await page.getByRole('button',{name:'Tutup pengumuman',exact:true}).evaluate(b=>{b.click();b.click();});await page.getByRole('status').filter({hasText:'Pengumuman berhasil ditutup'}).waitFor();assert.equal(dismiss,1);assert.equal(await page.getByRole('heading',{name:'Pengumuman 2',exact:true}).count(),0);delay=0;
 items=[row(3)];dismissMode='bad';await page.reload();await page.getByRole('button',{name:'Tutup pengumuman',exact:true}).click();await page.getByRole('alert').filter({hasText:'Format data'}).waitFor();assert.equal(await page.getByRole('heading',{name:'Pengumuman 3',exact:true}).count(),1);
 assert.deepEqual(errors,[]);console.log(`PASS: ${matrix} viewport/text combinations, create/edit/cancel/inactive, full content limits, field validation, recipient retention/retry, synchronized lock and single writes, saved+refresh failure, conflict/uncertain/malformed, filters/pagination, orientation and dashboard dismissal/CTA; zero page errors.`);
}finally{await browser?.close();child.kill('SIGTERM');}
