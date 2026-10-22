/** Disposable user management browser fixtures; no real credentials or mail. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.UI_PLAYWRIGHT_MODULE??'playwright');
const child=spawn(process.execPath,['--conditions=react-server','--import','tsx','tests/ui/server.ts'],{stdio:['ignore','pipe','pipe']});
let browser,stderr='';child.stderr.on('data',b=>stderr+=b);
const output=process.env.UI_REPORT_DIR??'../ui-users-focused';await mkdir(output,{recursive:true});
const id=n=>`55555555-5555-4555-8555-${String(n).padStart(12,'0')}`;
const row=(n,status='active')=>({id:id(n),username:`guru.${n}`,fullName:`Guru ${n}`,nip:'001234',role:'guru',email:`guru${n}@example.test`,phone:'',address:'',photoUrl:'',employmentStatus:'',rank:'',kmDistance:'1.25',additionalRole:'',version:'1',status,emailVerified:status==='active',mustChangePassword:false,securityQuestionReady:true,temporaryExpiresAt:null,createdAt:'2026-10-22T00:00:00Z'});
try {
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(stderr||'fixture timeout')),60000);child.stdout.on('data',b=>{if(b.toString().includes('UI_FIXTURE_READY')){clearTimeout(timer);resolve();}});child.on('exit',()=>{clearTimeout(timer);reject(Error(stderr));});});
 browser=await chromium.launch({headless:true,...(process.env.UI_BROWSER_EXECUTABLE?{executablePath:process.env.UI_BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();page.setDefaultTimeout(12000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let rows=[row(1),row(2,'pending_activation'),row(3,'disabled'),row(4,'archived')],posts=0,failRead=false,malformed=false,failAfter=false,delay=0,wrong=false,lastAdmin=false,malformedMutation=false,self=false;
 const ok=(route,data)=>route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,data})});
 const fail=(route,code,status)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify({ok:false,error:{code,message:'Penolakan sintetis untuk pengujian.'},requestId:'users-help-123'})});
 await page.route('**/api/users**',async route=>{
  const url=new URL(route.request().url()),method=route.request().method();
  if(method==='GET'){
   if(failRead)return fail(route,'UNAVAILABLE',503);
   const q=url.searchParams,p=Number(q.get('page')??1),size=Number(q.get('pageSize')??20);
   const data=rows.filter(r=>(!q.get('q')||(r.fullName+' '+r.username).includes(q.get('q')))&&(!q.get('status')||r.status===q.get('status'))&&(!q.get('role')||r.role===q.get('role')));
   return ok(route,malformed?{}:{items:data.slice((p-1)*size,p*size),total:data.length,page:p,pageSize:size});
  }
  posts++;if(delay)await new Promise(r=>setTimeout(r,delay));if(wrong)return fail(route,'INVALID_CREDENTIALS',401);if(lastAdmin)return fail(route,'LAST_ACTIVE_ADMIN',403);
  const data=route.request().postDataJSON();let user;
  if(url.pathname==='/api/users'){
   user=row(rows.length+20,data.delivery==='handover'?'active':'pending_activation');
   for(const key of ['username','fullName','nip','role','email','phone','address','photoUrl','employmentStatus','rank','kmDistance','additionalRole'])user[key]=data[key];
   user.emailVerified=false;rows.push(user);
  }else{
   user=rows.find(r=>r.id===url.pathname.split('/')[3]);assert.ok(user);
   if(url.pathname.endsWith('/status'))user.status=data.status;
   else if(!url.pathname.endsWith('/activation'))for(const key of Object.keys(user))if(key in data&&key!=='id')user[key]=data[key];
   user.version=String(Number(user.version)+1);
  }
  if(failAfter)failRead=true;
  const result={user,selfAffected:self,...(data.delivery==='handover'?{delivery:'handover',temporaryPassword:'SyntheticTemporary9!',expiresInHours:24}:data.delivery==='activation'||url.pathname.endsWith('/activation')?{delivery:'queued'}:{})};
  return ok(route,malformedMutation?{temporaryPassword:'SyntheticSalvaged9!'}:result);
 });
 const go=()=>page.goto('http://127.0.0.1:4319/?view=users&role=admin&path=/admin/pengguna');
 const edit=()=>page.getByRole('dialog',{name:'Ubah pengguna',exact:true});
 const create=()=>page.getByRole('dialog',{name:'Tambah pengguna',exact:true});
 const close=async d=>{await d.getByRole('button',{name:'Tutup',exact:true}).click();const discard=page.getByRole('dialog',{name:'Buang perubahan?',exact:true});if(await discard.isVisible())await discard.getByRole('button',{name:'Buang perubahan',exact:true}).click();};
 const proof=async d=>{await d.locator('[name=reason]').fill('Tindakan pengguna sintetis');await d.locator('[name=currentPassword]').fill('SyntheticAdmin9!');};
 const overflow=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 const fits=async d=>{const rect=await d.boundingBox(),size=page.viewportSize();assert.ok(rect&&rect.x>=0&&rect.y>=0&&rect.x+rect.width<=size.width+1&&rect.y+rect.height<=size.height+1);assert.equal(await d.evaluate(n=>n.scrollWidth>n.clientWidth+1),false);};
 for(const width of [320,375,768,1024,1440,1920]){
  console.log('Users viewport',width);await page.setViewportSize({width,height:900});await go();await page.getByRole('region',{name:'Daftar pengguna',exact:true}).waitFor();await overflow();
  if(width===375||width===1440)await page.screenshot({path:`${output}/list-${width}.png`,fullPage:true,animations:'disabled'});
  await page.getByRole('button',{name:'Tambah pengguna',exact:true}).click();await fits(create());if(width===375||width===1440)await page.screenshot({path:`${output}/editor-${width}.png`,fullPage:false,animations:'disabled'});await close(create());
  await page.getByRole('button',{name:'Nonaktifkan',exact:true}).first().click();const confirm=page.getByRole('dialog',{name:'Nonaktifkan pengguna?',exact:true});await fits(confirm);await confirm.getByRole('button',{name:'Batal',exact:true}).click();
 }
 await page.setViewportSize({width:375,height:812});await go();await page.getByRole('button',{name:'Ubah pengguna',exact:true}).first().click();assert.equal(await edit().locator('[name=email]').getAttribute('readonly'),'');
 await proof(edit());await edit().locator('[name=kmDistance]').fill('invalid');await edit().getByRole('button',{name:'Simpan perubahan',exact:true}).click();await edit().getByRole('alert').waitFor();assert.equal(posts,0);assert.equal(await edit().locator('[name=kmDistance]').getAttribute('aria-invalid'),'true');await edit().locator('[name=kmDistance]').fill('2.5');wrong=true;await edit().getByRole('button',{name:'Simpan perubahan',exact:true}).click();await edit().getByRole('alert').filter({hasText:'users-help-123'}).waitFor();assert.equal(await edit().locator('[name=currentPassword]').getAttribute('aria-invalid'),'true');wrong=false;failAfter=true;delay=500;
 await edit().getByRole('button',{name:'Simpan perubahan',exact:true}).evaluate(b=>{b.click();b.click();});await page.keyboard.press('Escape');assert.equal(await edit().isVisible(),true);await page.getByRole('alert').filter({hasText:'Perubahan sudah diproses'}).waitFor();assert.equal(posts,2);failRead=false;failAfter=false;delay=0;await page.getByRole('button',{name:'Muat ulang daftar',exact:true}).click();await page.getByRole('region',{name:'Daftar pengguna',exact:true}).waitFor();assert.equal(posts,2);
 // Confirmation errors are local to the dialog and retain the list and reason.
 await page.getByRole('button',{name:'Nonaktifkan',exact:true}).first().click();let confirm=page.getByRole('dialog',{name:'Nonaktifkan pengguna?',exact:true});await proof(confirm);wrong=true;await confirm.getByRole('button',{name:'Nonaktifkan pengguna',exact:true}).click();await confirm.getByRole('alert').waitFor();assert.equal(await confirm.locator('[name=currentPassword]').getAttribute('aria-invalid'),'true');wrong=false;lastAdmin=true;await confirm.getByRole('button',{name:'Nonaktifkan pengguna',exact:true}).click();await confirm.getByRole('alert').filter({hasText:'users-help-123'}).waitFor();assert.equal(await confirm.locator('[name=reason]').inputValue(),'Tindakan pengguna sintetis');lastAdmin=false;await confirm.getByRole('button',{name:'Nonaktifkan pengguna',exact:true}).click();await confirm.waitFor({state:'hidden'});
 // Reactivation and reissue preserve their endpoint/action contracts.
 await page.getByRole('button',{name:'Aktifkan',exact:true}).first().click();confirm=page.getByRole('dialog',{name:'Aktifkan pengguna?',exact:true});await proof(confirm);await confirm.getByRole('button',{name:'Aktifkan pengguna',exact:true}).click();await confirm.waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Antrekan ulang email aktivasi',exact:true}).first().click();confirm=page.getByRole('dialog',{name:'Antrekan ulang email aktivasi?',exact:true});await proof(confirm);await confirm.getByRole('button',{name:'Antrekan ulang email aktivasi',exact:true}).click();await confirm.waitFor({state:'hidden'});await page.getByRole('status').filter({hasText:'Belum berarti email telah terkirim'}).waitFor();
 // Archive is explicit, keeps the record, and removes mutable actions.
 await page.getByRole('button',{name:'Arsipkan',exact:true}).first().click();confirm=page.getByRole('dialog',{name:'Arsipkan pengguna?',exact:true});await proof(confirm);await confirm.getByRole('button',{name:'Arsipkan pengguna',exact:true}).click();await confirm.waitFor({state:'hidden'});await page.getByRole('region',{name:'Daftar pengguna',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Ubah pengguna',exact:true}).first().isDisabled(),true);
 // Creation via activation, then handover. One-time secret blocks every mutation.
 const fillCreate=async name=>{await create().locator('[name=username]').fill(name);await create().locator('[name=fullName]').fill('Pemilik '+name);await proof(create());};
 await page.getByRole('button',{name:'Tambah pengguna',exact:true}).click();await fillCreate('baru.email');await create().locator('[name=email]').fill('baru@example.test');await create().getByRole('button',{name:'Buat akun',exact:true}).click();await create().waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Tambah pengguna',exact:true}).click();await fillCreate('baru.handover');await create().getByLabel('Metode penyerahan akun',{exact:true}).selectOption('handover');await create().locator('[name=evidence]').fill('Bukti pemeriksaan identitas');await create().getByRole('button',{name:'Buat akun',exact:true}).click();await page.getByText('Serah terima kata sandi sementara',{exact:true}).waitFor();assert.ok((await page.locator('output').textContent()).includes('SyntheticTemporary9!'));assert.ok((await page.getByText('Pemilik: Pemilik baru.handover (baru.handover)',{exact:true}).textContent()).includes('baru.handover'));
 for(const name of ['Tambah pengguna','Ubah pengguna','Nonaktifkan','Aktifkan','Arsipkan','Antrekan ulang email aktivasi'])for(const button of await page.getByRole('button',{name,exact:true}).all())assert.equal(await button.isDisabled(),true);
 await page.getByRole('button',{name:'Sembunyikan kata sandi sementara',exact:true}).click();
 // Malformed write reply still preserves its one-time secret instead of discarding it.
 malformedMutation=true;await page.getByRole('button',{name:'Tambah pengguna',exact:true}).click();await fillCreate('baru.salvage');await create().getByLabel('Metode penyerahan akun',{exact:true}).selectOption('handover');await create().locator('[name=evidence]').fill('Bukti pemeriksaan identitas');await create().getByRole('button',{name:'Buat akun',exact:true}).click();await page.getByRole('status').filter({hasText:'detail hasil belum dapat dibaca'}).waitFor();assert.equal(await page.locator('output').textContent(),'SyntheticSalvaged9!');malformedMutation=false;await page.getByRole('button',{name:'Sembunyikan kata sandi sementara',exact:true}).click();
 // Filter/reset, shrink-to-last-page, malformed/empty read and long data.
 const filter=page.locator('form').filter({has:page.getByRole('button',{name:'Terapkan filter',exact:true})});await filter.locator('[name=q]').fill('baru.email');await filter.getByRole('button',{name:'Terapkan filter',exact:true}).click();await page.getByText('1 pengguna sesuai filter · Halaman 1',{exact:true}).waitFor();await filter.getByRole('button',{name:'Reset filter',exact:true}).click();await page.getByRole('region',{name:'Daftar pengguna',exact:true}).waitFor();
 rows=Array.from({length:21},(_,i)=>row(i+1));await go();await page.getByRole('navigation',{name:'Pagination pengguna',exact:true}).getByRole('button',{name:'Berikutnya',exact:true}).click();await page.getByText('21 pengguna sesuai filter · Halaman 2',{exact:true}).waitFor();rows=[row(1)];await page.getByRole('button',{name:'Muat ulang',exact:true}).click();await page.getByText('1 pengguna sesuai filter · Halaman 1',{exact:true}).waitFor();
 malformed=true;await go();await page.getByRole('alert').filter({hasText:'format'}).waitFor();malformed=false;rows=[];await page.getByRole('button',{name:'Muat ulang daftar',exact:true}).click();await page.getByText('Tidak ada pengguna yang sesuai filter',{exact:true}).waitFor();
 rows=[{...row(1),fullName:'NamaTanpaSpasi'.repeat(15),email:'a'.repeat(180)+'@example.test'}];await go();await page.getByRole('region',{name:'Daftar pengguna',exact:true}).waitFor();await page.addStyleTag({content:'html{font-size:200%}'});await overflow();await page.setViewportSize({width:812,height:375});await overflow();
 rows=[row(1)];await go();self=true;await page.getByRole('button',{name:'Ubah pengguna',exact:true}).first().click();await proof(edit());await edit().getByRole('button',{name:'Simpan perubahan',exact:true}).click();await page.waitForURL('**/login?status=updated');
 assert.deepEqual(errors,[]);console.log('PASS: six viewports + create/confirm modal bounds, edit validation/password/double submit, saved+refresh failure, last-admin denial, status/reactivate/reissue, activation/handover/salvage secret lock, filter/reset/pagination shrink, empty/malformed/long/text200/orientation and self-session redirect; zero page errors.');
} finally {await browser?.close();child.kill('SIGTERM');}
