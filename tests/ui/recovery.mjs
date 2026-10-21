/** Disposable recovery UI fixtures; no production accounts or mail. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.UI_PLAYWRIGHT_MODULE??'playwright');
const child=spawn(process.execPath,['--conditions=react-server','--import','tsx','tests/ui/server.ts'],{stdio:['ignore','pipe','pipe']});
let browser,stderr='';child.stderr.on('data',b=>stderr+=b);
const output=process.env.UI_REPORT_DIR??'../ui-recovery-focused';await mkdir(output,{recursive:true});
const id='33333333-3333-4333-8333-333333333333', userId='22222222-2222-4222-8222-222222222222';
const row=n=>({id:`33333333-3333-4333-8333-${String(n).padStart(12,'0')}`,userId,version:'1',username:`guru.${n}`,fullName:`Guru ${n}`,createdAt:'2026-10-21T00:00:00Z',reason:'Keterangan '.repeat(30)});
try {
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(stderr||'fixture timeout')),60000);child.stdout.on('data',b=>{if(b.toString().includes('UI_FIXTURE_READY')){clearTimeout(timer);resolve();}});child.on('exit',()=>{clearTimeout(timer);reject(Error(stderr));});});
 browser=await chromium.launch({headless:true,...(process.env.UI_BROWSER_EXECUTABLE?{executablePath:process.env.UI_BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();page.setDefaultTimeout(12000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let rows=[row(1),row(2)], failRead=false, malformed=false, delay=0, posts=0, wrong=false, failAfter=false;
 const ok=(route,data)=>route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,data})});
 await page.route('**/api/users/reset-requests',async route=>{
  if(route.request().method()==='GET')return failRead?route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:{code:'UNAVAILABLE',message:'Layanan belum tersedia'},requestId:'recovery-read-503'})}):ok(route,malformed?{}:rows);
  posts++;if(delay)await new Promise(r=>setTimeout(r,delay));
  if(wrong)return route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({ok:false,error:{code:'INVALID_CREDENTIALS',message:'Kata sandi tidak sesuai'},requestId:'recovery-password-401'})});
  const data=route.request().postDataJSON();rows=rows.filter(r=>r.id!==data.requestId);if(failAfter)failRead=true;
  return ok(route,data.action==='approve'?{temporaryPassword:'SyntheticTemporary9!',expiresInHours:24}:{rejected:true});
 });
 let forgot=0,otp=0,resets=0,badPublic=false;
 await page.route('**/api/auth/forgot-password',route=>{forgot++;return ok(route,badPublic?{}:{accepted:true,challengeId:id});});
 await page.route('**/api/auth/reset-otp',route=>{otp++;return ok(route,{challengeId:id,token:'A'.repeat(43)});});
 await page.route('**/api/auth/reset-password',route=>{resets++;return ok(route,{loginRequired:true});});
 const go=view=>page.goto(`http://127.0.0.1:4319/?view=${view}&path=/admin/pemulihan`);
 const form=()=>page.locator('form').first();
 const fill=async()=>{await form().getByLabel('Referensi bukti verifikasi').fill('Bukti pemeriksaan identitas');await form().getByLabel('Alasan keputusan').fill('Identitas telah diverifikasi');await form().getByLabel('Konfirmasi kata sandi administrator').fill('Synthetic9!');};
 const overflow=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 for(const width of [320,375,768,1024,1440,1920])for(const view of ['recoveryAdmin','recovery']) {
  console.log('Recovery viewport',view,width);await page.setViewportSize({width,height:900});await go(view);await page.getByRole('button',{name:view==='recovery'?'Ajukan':'Setujui pemulihan',exact:true}).first().waitFor();await overflow();
  if(width===375||width===1440)await page.screenshot({path:`${output}/${view}-${width}.png`,fullPage:true});
 }
 await page.setViewportSize({width:375,height:812});await go('recoveryAdmin');await fill();delay=600;
 await form().getByRole('button',{name:'Setujui pemulihan',exact:true}).evaluate(b=>{b.click();b.click();});assert.equal(await page.locator('form').nth(1).getByRole('button',{name:'Setujui pemulihan',exact:true}).isDisabled(),true);assert.equal(await page.getByRole('button',{name:'Muat ulang permintaan',exact:true}).isDisabled(),true);
 await page.getByRole('region',{name:'Serah terima rahasia satu kali'}).waitFor();assert.equal(posts,1);assert.equal(await form().getByRole('button',{name:'Setujui pemulihan',exact:true}).isDisabled(),true);await page.getByRole('button',{name:'Sudah diserahkan, sembunyikan'}).click();delay=0;
 // Wrong password retains evidence and marks the correct field.
 await fill();wrong=true;await form().getByRole('button',{name:'Setujui pemulihan',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(await form().getByLabel('Konfirmasi kata sandi administrator').getAttribute('aria-invalid'),'true');assert.equal(await form().getByLabel('Referensi bukti verifikasi').inputValue(),'Bukti pemeriksaan identitas');wrong=false;
 await form().getByLabel('Keputusan',{exact:true}).selectOption('reject');assert.equal(await form().getByLabel('Referensi bukti verifikasi').count(),0);await form().getByRole('button',{name:'Tolak permintaan',exact:true}).click();await page.getByText('Belum ada permintaan pemulihan',{exact:true}).waitFor();assert.equal(posts,3);
 // Approval success survives a failed list refresh; retry never repeats POST.
 rows=[row(3)];await page.getByRole('button',{name:'Muat ulang permintaan',exact:true}).click();await fill();failAfter=true;await form().getByRole('button',{name:'Setujui pemulihan',exact:true}).click();await page.getByRole('alert').filter({hasText:'recovery-read-503'}).waitFor();await page.getByRole('region',{name:'Serah terima rahasia satu kali'}).waitFor();assert.equal(posts,4);failRead=false;failAfter=false;await page.getByRole('button',{name:'Coba kembali',exact:true}).click();await page.getByText('Belum ada permintaan pemulihan',{exact:true}).waitFor();assert.equal(posts,4);
 malformed=true;await go('recoveryAdmin');await page.getByRole('alert').filter({hasText:'format'}).waitFor();assert.equal(await page.locator('form').count(),0);malformed=false;rows=Array.from({length:100},(_,i)=>row(i+1));await page.getByRole('button',{name:'Coba kembali',exact:true}).click();await page.locator('form').nth(99).waitFor();await page.evaluate(()=>document.documentElement.style.fontSize='200%');await overflow();await page.setViewportSize({width:812,height:375});await overflow();
 await go('recovery');await form().getByLabel('Username',{exact:true}).fill('fixture.guru');await form().getByRole('button',{name:'Ajukan',exact:true}).click();await page.getByRole('heading',{name:'Verifikasi OTP pemulihan'}).waitFor();await form().getByRole('button',{name:'Ajukan',exact:true}).click();await page.getByRole('status').filter({hasText:'Tunggu'}).waitFor();assert.equal(forgot,1);
 const otpForm=page.locator('form').nth(1);await otpForm.getByLabel('Kode OTP enam digit').fill('123456');assert.equal(await otpForm.getByLabel('Kode OTP enam digit').getAttribute('inputmode'),'numeric');await otpForm.getByRole('button',{name:'Verifikasi kode',exact:true}).click();await page.getByRole('heading',{name:'Atur kata sandi baru'}).waitFor();assert.equal(otp,1);
 const resetForm=page.locator('form').nth(1);await resetForm.getByLabel('Kata sandi baru',{exact:true}).fill('SyntheticNew9!');await resetForm.getByLabel('Ulangi kata sandi baru',{exact:true}).fill('Mismatch9!');await resetForm.getByRole('button',{name:'Reset kata sandi',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(resets,0);await resetForm.getByLabel('Ulangi kata sandi baru',{exact:true}).fill('SyntheticNew9!');await resetForm.getByRole('button',{name:'Reset kata sandi',exact:true}).click();await page.waitForURL('**/login?status=updated');assert.equal(resets,1);
 badPublic=true;await go('recovery');await form().getByLabel('Username',{exact:true}).fill('fixture.guru');await form().getByRole('button',{name:'Ajukan',exact:true}).click();await page.getByRole('alert').filter({hasText:'belum dapat dipastikan'}).waitFor();assert.equal(await page.getByRole('heading',{name:'Verifikasi OTP pemulihan'}).count(),0);
 await go('recovery');await form().getByLabel('Metode pemulihan').selectOption('security');await form().getByLabel('Jawaban keamanan',{exact:true}).waitFor();await form().getByLabel('Metode pemulihan').selectOption('admin');assert.equal(await form().getByLabel('Jawaban keamanan',{exact:true}).count(),0);
 await go('activation');await page.getByRole('status').filter({hasText:'Tautan tidak lengkap'}).waitFor();assert.equal(await page.locator('form').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS: 12 recovery viewports, 100/empty/malformed lists, serialized decisions, handover lock, wrong password, rejection, committed+refresh failure, public OTP/reset/cooldown, schema errors, method fields, activation invalid link; zero page errors.');
} finally {await browser?.close();child.kill('SIGTERM');}
