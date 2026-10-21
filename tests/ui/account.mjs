import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.UI_PLAYWRIGHT_MODULE??'playwright');
const child=spawn(process.execPath,['--conditions=react-server','--import','tsx','tests/ui/server.ts'],{stdio:['ignore','pipe','pipe']});
let browser,stderr='';child.stderr.on('data',b=>stderr+=b);
const output=process.env.UI_REPORT_DIR??'../ui-account-focused';await mkdir(output,{recursive:true});
try {
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(stderr||'fixture timeout')),60000);child.stdout.on('data',b=>{if(b.toString().includes('UI_FIXTURE_READY')){clearTimeout(timer);resolve();}});child.on('exit',()=>{clearTimeout(timer);reject(Error(stderr));});});
 browser=await chromium.launch({headless:true,...(process.env.UI_BROWSER_EXECUTABLE?{executablePath:process.env.UI_BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();page.setDefaultTimeout(12000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let profile={id:'11111111-1111-4111-8111-111111111111',username:'fixture.account',fullName:'Guru Sintetis',nip:'001234',phone:'+62812345678',address:'Alamat sintetis',photoUrl:'',email:'account@example.test',emailVerified:true,question:'Pertanyaan sintetis',version:'1'};
 let malformed=false,failRead=false,failAfterSave=false,postDelay=0,profilePosts=0,rejectPassword=false,dispatch='accepted',challengeNo=0;
 const ok=(route,data)=>route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,data})});
 await page.route('**/api/auth/profile',async route=>{
  if(route.request().method()==='GET') {
   if(failRead)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:{code:'UNAVAILABLE',message:'Profil sementara belum tersedia.'},requestId:'account-read-503'})});
   return ok(route,malformed?null:profile);
  }
  profilePosts++;if(postDelay)await new Promise(r=>setTimeout(r,postDelay));
  if(rejectPassword)return route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({ok:false,error:{code:'INVALID_CREDENTIALS',message:'Kata sandi saat ini tidak sesuai.'},requestId:'account-password-401'})});
  const data=route.request().postDataJSON();profile={...profile,...data,version:String(Number(profile.version)+1)};delete profile.currentPassword;if(failAfterSave)failRead=true;return ok(route,{saved:true});
 });
 await page.route('**/api/auth/email-request',async route=>{challengeNo++;return ok(route,{queued:true,challengeId:`33333333-3333-4333-8333-${String(challengeNo).padStart(12,'0')}`,delivery:dispatch});});
 await page.route('**/api/auth/security-question',async route=>{profile={...profile,question:route.request().postDataJSON().question};return ok(route,{saved:true});});
 let passwordPosts=0;await page.route('**/api/auth/change-password',route=>{passwordPosts++;return ok(route,{loginRequired:true});});
 const tab=label=>page.getByRole('tab',{name:label,exact:true}).click();
 const panel=()=>page.getByRole('tabpanel');
 const go=(role='admin',view='account')=>page.goto(`http://127.0.0.1:4319/?view=${view}&role=${role}&path=/akun`);
 const noOverflow=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 for(const role of ['admin','guru'])for(const width of [320,375,768,1024,1440,1920]) {
  console.log('Account viewport',role,width);await page.setViewportSize({width,height:900});await go(role);await panel().getByLabel('Username',{exact:true}).waitFor();
  await panel().getByLabel('Nama lengkap',{exact:true}).fill('Draf profil tetap tersimpan');
  await tab('Ganti Kata Sandi');await panel().getByLabel('Kata sandi baru',{exact:true}).fill('SyntheticDraft9!');await tab('Ubah Profil');assert.equal(await panel().getByLabel('Nama lengkap',{exact:true}).inputValue(),'Draf profil tetap tersimpan');
  await page.getByRole('tab',{name:'Ubah Profil',exact:true}).focus();await page.keyboard.press('End');assert.equal(await page.getByRole('tab',{name:'Pertanyaan Keamanan',exact:true}).getAttribute('aria-selected'),'true');await page.keyboard.press('Home');await noOverflow();
  if(width===375||width===1440)await page.screenshot({path:`${output}/${role}-${width}.png`,fullPage:true});
 }
 await page.setViewportSize({width:375,height:812});await go('guru','onboarding');await panel().getByLabel('Kata sandi baru',{exact:true}).waitFor();assert.equal(await page.getByRole('tab',{name:'Ganti Kata Sandi',exact:true}).getAttribute('aria-selected'),'true');
 // Cross-tab serialisation and exactly one write; profile refresh must retain other drafts.
 await go();await tab('Ganti Kata Sandi');await panel().getByLabel('Kata sandi baru',{exact:true}).fill('SyntheticDraft9!');await tab('Ubah Profil');
 await panel().getByLabel('Nama lengkap',{exact:true}).fill('Nama diperbarui');await panel().getByLabel('Konfirmasi kata sandi saat ini',{exact:true}).fill('Synthetic9!');postDelay=700;
 await panel().getByRole('button',{name:'Simpan perubahan profil',exact:true}).evaluate(button=>{button.click();button.click();});await tab('Ganti Kata Sandi');assert.equal(await panel().getByRole('button',{name:'Simpan kata sandi baru',exact:true}).isDisabled(),true);
 await page.getByRole('status').filter({hasText:'Profil berhasil diperbarui.'}).first().waitFor();await page.waitForFunction(()=>!document.querySelector('[role=tabpanel]:not([hidden]) button[type=submit]')?.disabled);assert.equal(profilePosts,1);assert.equal(await panel().getByLabel('Kata sandi baru',{exact:true}).inputValue(),'SyntheticDraft9!');postDelay=0;
 // Committed write + failed refresh is not presented as a failed save; no automatic replay.
 await tab('Ubah Profil');await panel().getByLabel('Nama lengkap',{exact:true}).fill('Nama tersimpan');await panel().getByLabel('Konfirmasi kata sandi saat ini',{exact:true}).fill('Synthetic9!');failAfterSave=true;await panel().getByRole('button',{name:'Simpan perubahan profil',exact:true}).click();await page.getByRole('alert').filter({hasText:'Perubahan sudah tersimpan'}).waitFor();assert.equal(profilePosts,2);assert.equal(await panel().getByRole('button',{name:'Simpan perubahan profil',exact:true}).isDisabled(),true);failRead=false;failAfterSave=false;await page.getByRole('button',{name:'Muat ulang profil',exact:true}).click();await panel().getByLabel('Nama lengkap',{exact:true}).waitFor();await page.waitForFunction(()=>document.querySelector('[name=fullName]')?.value==='Nama tersimpan');assert.equal(profilePosts,2);
 // Wrong current password gives a field marker and preserves edits.
 rejectPassword=true;await panel().getByLabel('Konfirmasi kata sandi saat ini',{exact:true}).fill('WrongSynthetic9!');await panel().getByRole('button',{name:'Simpan perubahan profil',exact:true}).click();await page.getByRole('alert').filter({hasText:'account-password-401'}).waitFor();assert.equal(await panel().getByLabel('Konfirmasi kata sandi saat ini',{exact:true}).getAttribute('aria-invalid'),'true');rejectPassword=false;
 // New OTP resets old digits; tab changes retain the same challenge and draft.
 await tab('Verifikasi Email');await panel().getByLabel('Alamat email milik Anda',{exact:true}).fill('baru@example.test');await panel().getByLabel('Kata sandi saat ini',{exact:true}).fill('Synthetic9!');await panel().getByRole('button',{name:'Kirim kode OTP',exact:true}).click();await panel().getByLabel('Kode OTP enam digit',{exact:true}).waitFor();await panel().getByLabel('Kode OTP enam digit',{exact:true}).fill('123456');await tab('Ubah Profil');await tab('Verifikasi Email');assert.equal(await panel().getByLabel('Kode OTP enam digit',{exact:true}).inputValue(),'123456');await panel().getByLabel('Kata sandi saat ini',{exact:true}).fill('Synthetic9!');await panel().getByRole('button',{name:'Kirim kode OTP',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[name=otp]')?.value==='');assert.equal(await panel().getByLabel('Kode OTP enam digit',{exact:true}).getAttribute('inputmode'),'numeric');
 // Delivery failure is an error; security-question form reset hides the secret again.
 dispatch='failed';await panel().getByLabel('Kata sandi saat ini',{exact:true}).fill('Synthetic9!');await panel().getByRole('button',{name:'Kirim kode OTP',exact:true}).click();await panel().getByRole('alert').filter({hasText:'Kode belum berhasil dikirim'}).waitFor();
 await tab('Pertanyaan Keamanan');await panel().getByLabel('Pertanyaan yang jawabannya hanya Anda ketahui',{exact:true}).fill('Apa nama buku kesukaan?');await panel().getByLabel('Jawaban keamanan',{exact:true}).fill('Jawaban sintetis');await panel().getByRole('button',{name:'Tampilkan isian rahasia',exact:true}).first().click();await panel().getByLabel('Kata sandi saat ini',{exact:true}).fill('Synthetic9!');await panel().getByRole('button',{name:'Simpan pertanyaan keamanan',exact:true}).click();await page.getByRole('status').filter({hasText:'Pertanyaan keamanan berhasil diperbarui.'}).first().waitFor();assert.equal(await panel().getByLabel('Jawaban keamanan',{exact:true}).getAttribute('type'),'password');
 // Malformed read must show retry instead of rendering null fields indefinitely.
 malformed=true;await go();await page.getByRole('alert').filter({hasText:'Data profil belum sesuai'}).waitFor();malformed=false;await page.getByRole('button',{name:'Coba kembali',exact:true}).click();await panel().getByLabel('Username',{exact:true}).waitFor();
 profile={...profile,fullName:'NamaTanpaSpasi'.repeat(14),email:'a'.repeat(180)+'@example.test',question:'Pertanyaan'.repeat(30)};await go();await panel().getByLabel('Username',{exact:true}).waitFor();await page.addStyleTag({content:'html{font-size:200%}'});await noOverflow();await tab('Verifikasi Email');await noOverflow();await tab('Pertanyaan Keamanan');await noOverflow();for(const size of [{width:844,height:390},{width:375,height:812}]){await page.setViewportSize(size);await noOverflow();}
 // Successful password update keeps the existing full-session termination redirect.
 await go();await tab('Ganti Kata Sandi');await panel().getByLabel('Kata sandi saat ini',{exact:true}).fill('Synthetic9!');await panel().getByLabel('Kata sandi baru',{exact:true}).fill('DifferentSynthetic9!');await panel().getByLabel('Ulangi kata sandi baru',{exact:true}).fill('MismatchSynthetic9!');await panel().getByRole('button',{name:'Simpan kata sandi baru',exact:true}).click();await panel().getByRole('alert').filter({hasText:'Konfirmasi kata sandi harus sama'}).waitFor();assert.equal(passwordPosts,0);await panel().getByLabel('Ulangi kata sandi baru',{exact:true}).fill('DifferentSynthetic9!');await panel().getByRole('button',{name:'Simpan kata sandi baru',exact:true}).click();await page.waitForURL('**/login?status=updated');assert.equal(passwordPosts,1);
 assert.deepEqual(errors,[]);console.log('PASS: 12 role/viewport combinations, keyboard/drafts/onboarding, cross-tab lock, single POST, saved+refresh failure recovery, field errors, OTP retention/replacement/delivery, secret reset, malformed read, 200% text/orientation, password redirect; zero page errors.');
} finally {await browser?.close();child.kill('SIGTERM');}
