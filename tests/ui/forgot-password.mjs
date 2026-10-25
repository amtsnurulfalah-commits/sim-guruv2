/** Disposable public-recovery contract and reflow fixtures; no real mail or accounts. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
const {chromium}=await import(process.env.UI_PLAYWRIGHT_MODULE??'playwright');
const child=spawn(process.execPath,['--conditions=react-server','--import','tsx','tests/ui/server.ts'],{stdio:['ignore','pipe','pipe']});
let browser,stderr='';child.stderr.on('data',b=>stderr+=b);
try {
 await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error(stderr||'fixture timeout')),60000);child.stdout.on('data',b=>{if(b.toString().includes('UI_FIXTURE_READY')){clearTimeout(t);resolve();}});child.on('exit',()=>{clearTimeout(t);reject(Error(stderr));});});
 browser=await chromium.launch({headless:true,...(process.env.UI_BROWSER_EXECUTABLE?{executablePath:process.env.UI_BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();page.setDefaultTimeout(12000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let lastOtpChallenge='';
 const id='33333333-3333-4333-8333-333333333333';let mode='ok',csrf='ok',writes=0,delay=0;
 const ok=(r,data)=>r.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,data})});
 const fail=(r,code,status)=>r.fulfill({status,headers:code==='RATE_LIMITED'?{'retry-after':'120'}:{},contentType:'application/json',body:JSON.stringify({ok:false,error:{code,message:'Penolakan sintetis'},requestId:'recovery-help-123'})});
 await page.route('**/api/auth/csrf?*',r=>csrf==='network'?r.abort():ok(r,csrf==='bad'?{}:{csrfToken:'fixture-csrf'}));
 for(const action of ['forgot-password','reset-otp','reset-password'])await page.route('**/api/auth/'+action,async r=>{
  if(action==='reset-otp')lastOtpChallenge=r.request().postDataJSON().challengeId;
  writes++;if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
  if(mode===action+'-network')return r.abort();
  if(mode===action+'-503')return fail(r,'INTERNAL_ERROR',503);
  if(mode===action+'-bad')return ok(r,{});
  if(mode==='invalid'&&action==='reset-password')return fail(r,'CHALLENGE_INVALID',422);
  if(mode==='rate')return fail(r,'RATE_LIMITED',429);
  return ok(r,action==='forgot-password'?{accepted:true,challengeId:id}:action==='reset-otp'?{challengeId:id,token:'A'.repeat(43)}:{loginRequired:true});
 });
 const form=title=>page.locator('form').filter({has:page.getByRole('heading',{name:title,exact:true,includeHidden:true})});
 const request=()=>form('Ajukan pemulihan'),otp=()=>form('Verifikasi OTP pemulihan'),reset=()=>form('Atur kata sandi baru');
 const go=async()=>{await page.goto('http://127.0.0.1:4319/?view=recovery');await request().getByRole('button',{name:'Ajukan',exact:true}).waitFor();};
 const ask=async()=>{await request().getByLabel('Username',{exact:true}).fill('fixture.guru');await request().getByRole('button',{name:'Ajukan',exact:true}).click();};
 const verify=async()=>{await otp().getByLabel('Kode OTP enam digit').fill('123456');await otp().getByRole('button',{name:'Verifikasi kode',exact:true}).click();};
 const password=async()=>{await reset().getByLabel('Kata sandi baru',{exact:true}).fill('SyntheticNew9!');await reset().getByLabel('Ulangi kata sandi baru',{exact:true}).fill('SyntheticNew9!');};
 const bounds=async()=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);for(const f of await page.locator('form').all())if(await f.isVisible())assert.equal(await f.evaluate(e=>e.scrollWidth>e.clientWidth+1),false);};
 let combinations=0;
 for(const width of [280,320,375,767,768,1024,1440,1920]){
  await page.setViewportSize({width,height:850});await go();
  for(const size of [16,32]){await page.evaluate(s=>document.documentElement.style.fontSize=s+'px',size);await bounds();combinations++;}
  await ask();await otp().waitFor();
  for(const size of [16,32]){await page.evaluate(s=>document.documentElement.style.fontSize=s+'px',size);await bounds();combinations++;}
  await verify();await reset().waitFor();assert.equal(await request().locator('button[type=submit]').isDisabled(),true);
  for(const size of [16,32]){await page.evaluate(s=>document.documentElement.style.fontSize=s+'px',size);await bounds();combinations++;}
 }
 await page.setViewportSize({width:375,height:812});await go();await page.clock.install();delay=150;const before=writes;
 await request().getByLabel('Username',{exact:true}).fill('fixture.guru');await request().getByRole('button',{name:'Ajukan',exact:true}).evaluate(b=>{b.click();b.click();b.form.requestSubmit();});await otp().waitFor();assert.equal(writes,before+1);delay=0;
 await request().getByRole('button',{name:'Ajukan',exact:true}).click();await page.getByRole('status').filter({hasText:'Tunggu'}).waitFor();assert.equal(writes,before+1);
 await page.clock.fastForward(61000);await request().getByRole('button',{name:'Ajukan',exact:true}).click();await otp().waitFor();assert.equal(writes,before+2);
 await request().getByLabel('Username',{exact:true}).fill('another.user');await verify();await reset().waitFor();await reset().getByText('fixture.guru',{exact:true}).waitFor();
 assert.equal(await reset().getByLabel('Kata sandi baru',{exact:true}).getAttribute('maxlength'),'256');
 await password();await reset().getByLabel('Ulangi kata sandi baru',{exact:true}).fill('Mismatch9!');const count=writes;await reset().getByRole('button',{name:'Reset kata sandi',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(writes,count);
 await reset().getByRole('button',{name:'Mulai ulang pemulihan',exact:true}).click();await request().getByRole('button',{name:'Ajukan',exact:true}).waitFor();assert.equal(await otp().count(),0);
 for(const method of ['admin','security']){
  await go();await request().getByLabel('Metode pemulihan').selectOption(method);
  if(method==='security'){await request().getByLabel('Jawaban keamanan',{exact:true}).fill('SyntheticAnswer');await request().getByRole('button',{name:'Tampilkan isian rahasia',exact:true}).click();}
  await ask();await page.getByRole('status').filter({hasText:'pemeriksaan identitas'}).waitFor();assert.equal(await otp().count(),0);
  if(method==='security'){assert.equal(await request().getByLabel('Jawaban keamanan',{exact:true}).inputValue(),'');assert.equal(await request().getByLabel('Jawaban keamanan',{exact:true}).getAttribute('type'),'password');}
 }
 for(const target of ['forgot-password','reset-otp','reset-password'])for(const kind of ['bad','network','503']){
  mode='ok';csrf='ok';await go();
  if(target!=='forgot-password'){await ask();await otp().waitFor();}
  if(target==='reset-password'){await verify();await reset().waitFor();await password();}
  mode=target+'-'+kind;const count=writes;
  if(target==='forgot-password')await ask();else if(target==='reset-otp')await verify();else await reset().getByRole('button',{name:'Reset kata sandi',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'belum dapat dipastikan'}).waitFor();assert.equal(writes,count+1);assert.equal(await otp().count(),0);assert.equal(await reset().count(),0);
  if(target==='reset-password')assert.equal(await page.getByRole('link',{name:'Ke halaman masuk',exact:true}).getAttribute('href'),'/login');
 }
 mode='ok';await go();await ask();await verify();await reset().waitFor();await password();mode='invalid';await reset().getByRole('button',{name:'Reset kata sandi',exact:true}).click();await page.getByRole('alert').filter({hasText:'recovery-help-123'}).waitFor();assert.equal(await reset().count(),0);
 mode='ok';
 for(const failure of ['bad','network']){
  csrf='ok';await go();await ask();await verify();await reset().waitFor();await password();csrf=failure;const count=writes;
  await reset().getByRole('button',{name:'Reset kata sandi',exact:true}).click();await page.getByRole('alert').filter({hasText:'Formulir belum dapat disiapkan'}).waitFor();assert.equal(writes,count);assert.equal(await reset().count(),1);
 }
 csrf='ok';await go();mode='rate';await ask();await page.getByRole('alert').filter({hasText:'recovery-help-123'}).waitFor();await page.getByText(/Permintaan baru dapat diajukan dalam 120 detik/).waitFor();mode='ok';
 await go();await ask();await verify();await reset().waitFor();await password();
 assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);assert.equal(await page.locator('input[value="'+ 'A'.repeat(43)+'"]').count(),0);
 await page.setViewportSize({width:812,height:375});await bounds();await reset().getByRole('button',{name:'Reset kata sandi',exact:true}).click();await page.waitForURL('**/login?status=updated');
 // Admin email links open OTP verification without sending a new recovery request or leaking the ID in URL.
 const beforeLink=writes;
 await page.goto('http://127.0.0.1:4319/?view=recovery#challengeId='+id);
 await otp().waitFor();assert.equal(writes,beforeLink);assert.equal(new URL(page.url()).hash,'');
 await otp().getByText(/Membuka tautan saja belum mengubah kata sandi/).waitFor();await verify();await reset().waitFor();
 await page.goto('http://127.0.0.1:4319/?view=recovery#challengeId=invalid');
 await page.getByRole('alert').filter({hasText:'Tautan pemulihan tidak lengkap'}).waitFor();assert.equal(new URL(page.url()).hash,'');assert.equal(await otp().count(),0);
 // A later email link wins over an earlier request still waiting for its response.
 mode='ok';csrf='ok';delay=250;await go();await ask();
 const newer='44444444-4444-4444-8444-444444444444';
 await page.evaluate(value=>{location.hash='challengeId='+value;},newer);
 await otp().waitFor();await verify();await reset().waitFor();delay=0;assert.equal(lastOtpChallenge,newer);
 assert.deepEqual(errors,[]);console.log(`PASS: ${combinations} recovery reflow combinations; methods, cooldown/resend, single writes, identity snapshot, malformed/network/server responses, invalid proof, CSRF no-POST, uncertain outcome, validation, restart, orientation, reset success; zero page errors.`);
} finally {await browser?.close();child.kill('SIGTERM');}
