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
 let role='admin',rows=[],blocks=[],h1=false,writeMode='ok',readMode='ok',writes=0;
 const record={id:jid,occurrenceId:occ,userId:admin,teacherName:'Guru sintetis',date,className:'VII',subjectName:'IPA',material:'Materi sintetis',present:20,absent:0,notes:'Catatan',inputType:'SAME_DAY',weight:'1',creditedJtm:'2.0000',version:'1',submittedAt:date+'T07:00:00Z',recapAvailable:false};
 await page.route('**/api/activities/**',async route=>{
  const req=route.request(),url=new URL(req.url()),kind=url.pathname.split('/').at(-1);
  const ok=data=>route.fulfill({json:{ok:true,data}});
  if(req.method()==='GET'){
   if(kind==='options'){return ok({teachers:[{id:guru,name:'Guru sintetis'}],subjects:[{id:subject,name:'IPA'}],h1Enabled:h1});}
   if(kind==='blocks'){return ok({items:blocks});}
   if(kind==='eligible')return ok({items:[{id:occ,userId:role==='admin'?admin:guru,date:url.searchParams.get('date'),kind:'KBM',className:'VII',subjectName:'IPA',expectedStudents:20,timeStart:'07:00',timeEnd:'09:00',journalId:rows.length?jid:null,eligibilityError:null}]});
   if(kind==='journals'){
    if(readMode==='error')return route.fulfill({status:503,json:{ok:false,error:{code:'UNAVAILABLE',message:'Riwayat belum tersedia.'}}});
    if(readMode==='invalid')return ok({items:null,total:0});
    const p=Number(url.searchParams.get('page'));return ok({items:rows.slice((p-1)*25,p*25),total:rows.length,page:p,pageSize:25});
   }
   if(kind==='export')return route.fulfill({contentType:'text/csv',body:'tanggal,materi\n'+date+',Materi'});
  }
  writes++;const input=req.postDataJSON();
  if(writeMode==='conflict')return route.fulfill({status:409,json:{ok:false,error:{code:'VERSION_CONFLICT',message:'Jurnal berubah pada sesi lain.'}}});
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
 const overflow=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 const close=async()=>{await page.keyboard.press('Escape');const discard=page.getByRole('button',{name:'Buang perubahan',exact:true});if(await discard.isVisible())await discard.click();await page.getByRole('dialog').waitFor({state:'hidden'});};

 const open = async()=>{ await page.getByRole('button',{name:'Jurnal pembelajaran',exact:true}).click(); const d=page.getByRole('dialog'); await d.getByLabel('Kegiatan',{exact:true}).selectOption(occ); await d.getByRole('region',{name:'Draft lokal'}).waitFor(); return d; };
 let d; await go(); d=await open();
 await d.getByLabel('Materi pembelajaran',{exact:true}).fill('Draft materi sebelum reload');
 await d.getByLabel('Siswa hadir',{exact:true}).fill('18'); await d.getByLabel('Siswa absen',{exact:true}).fill('2');
 await d.getByLabel('Alasan penyimpanan',{exact:true}).fill('Draft pengujian otomatis');
 await d.getByText(/Draft tersimpan di tab ini/).waitFor();
 assert.equal(writes,0);
 await go(); d=await open(); await d.getByRole('button',{name:'Pulihkan draft',exact:true}).waitFor();
 assert.equal(await d.getByLabel('Materi pembelajaran',{exact:true}).inputValue(),'');
 await d.getByRole('button',{name:'Pulihkan draft',exact:true}).click();
 assert.equal(await d.getByLabel('Materi pembelajaran',{exact:true}).inputValue(),'Draft materi sebelum reload');
 assert.equal(await d.getByLabel('Siswa hadir',{exact:true}).inputValue(),'18');
 assert.equal(await d.getByLabel('Siswa absen',{exact:true}).inputValue(),'2');
 assert.equal(writes,0);
 for(const viewport of [{width:280,height:640},{width:320,height:568},{width:375,height:812},{width:768,height:1024},{width:1024,height:768},{width:1440,height:900},{width:1920,height:1080},{width:812,height:375},{width:375,height:320}]) {
  await page.setViewportSize(viewport); await overflow();
  await page.waitForFunction(()=>{const r=document.querySelector('[role="dialog"]')?.getBoundingClientRect();return r && r.left>=-1&&r.right<=innerWidth+1&&r.top>=-1&&r.bottom<=innerHeight+1;});
  if(screenshots&&[320,1440].includes(viewport.width))await page.screenshot({path:screenshots+'/draft-journal-'+viewport.width+'.png'});
 }
 await page.context().setOffline(true); await d.getByText(/Koneksi terputus/).waitFor();
 await d.getByLabel('Catatan',{exact:true}).fill('Tetap dapat menulis saat terputus');
 await d.getByRole('button',{name:'Simpan jurnal',exact:true}).click();
 await d.getByText(/Permintaan belum tersimpan/).waitFor(); assert.equal(writes,0);
 assert.equal(await d.getByLabel('Catatan',{exact:true}).inputValue(),'Tetap dapat menulis saat terputus');
 await page.context().setOffline(false); assert.equal(writes,0);
 writeMode='invalid'; await d.getByRole('button',{name:'Simpan jurnal',exact:true}).click(); await d.getByRole('alert').waitFor();
 assert.equal(writes,1); await go(); d=await open();
 await d.getByText(/Hasil permintaan sebelumnya belum pasti/).waitFor();
 assert.equal(await d.getByRole('button',{name:'Pulihkan draft',exact:true}).isDisabled(),true);
 await d.getByLabel('Saya sudah memeriksa hasil terbaru sebelum melanjutkan.').check();
 await d.getByRole('button',{name:'Pulihkan draft',exact:true}).click();
 writeMode='ok'; await d.getByRole('button',{name:'Simpan jurnal',exact:true}).click(); await d.waitFor({state:'hidden'});
 assert.equal(writes,2);
 assert.equal(await page.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.startsWith('sim-guru:draft:v1:')).length),0);
 rows=[]; await go(); d=await open(); await d.getByLabel('Materi pembelajaran',{exact:true}).fill('Stale source');
 await page.evaluate(()=>{for(const key of Object.keys(sessionStorage).filter(k=>k.startsWith('sim-guru:draft:v1:'))){const v=JSON.parse(sessionStorage[key]);v.basis='changed source';sessionStorage[key]=JSON.stringify(v);}});
 await go(); d=await open(); await d.getByText(/Sumber atau versinya berubah/).waitFor();
 assert.equal(await d.getByRole('button',{name:'Pulihkan draft',exact:true}).isDisabled(),true);
 await d.getByRole('button',{name:'Hapus draft lokal',exact:true}).click(); await d.getByLabel('Materi pembelajaran',{exact:true}).fill('TTL test');
 await page.evaluate(()=>{for(const key of Object.keys(sessionStorage).filter(k=>k.startsWith('sim-guru:draft:v1:'))){const v=JSON.parse(sessionStorage[key]);v.savedAt=Date.now()-86400000;sessionStorage[key]=JSON.stringify(v);}});
 await go(); d=await open(); assert.equal(await d.getByRole('button',{name:'Pulihkan draft',exact:true}).count(),0);
 await d.getByLabel('Materi pembelajaran',{exact:true}).fill('Private admin draft');
 role='guru'; await go(); d=await open(); assert.equal(await d.getByRole('button',{name:'Pulihkan draft',exact:true}).count(),0);
 assert.equal(await page.evaluate(()=>Object.values(sessionStorage).some(v=>v.includes('Private admin draft'))),false);
 await d.getByLabel('Materi pembelajaran',{exact:true}).fill('Guru local draft');
 const second = await browser.newPage(); await second.goto('http://127.0.0.1:4319/?view=lab'); assert.equal(await second.evaluate(()=>sessionStorage.length),0); await second.close();
 await close(); assert.equal(await page.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.startsWith('sim-guru:draft:v1:')).length),0);
 await go(); d=await open(); await d.getByLabel('Materi pembelajaran',{exact:true}).fill('Logout cleanup');
 await page.goto('http://127.0.0.1:4319/?view=login'); await page.getByLabel('Username',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.startsWith('sim-guru:draft:v1:')).length),0);
 // Exercise the real session boundary cleanup, including cross-tab notification.
 let sessionAccount=admin, sessionDenied=false, sessionRole='admin';
 await page.route('**/api/auth/session', route=>route.fulfill({status:sessionDenied?401:200,json:sessionDenied?{ok:false,error:{code:'UNAUTHENTICATED',message:'Sesi berakhir.'}}:{ok:true,data:{user:{id:sessionAccount,username:'fixture',fullName:'Akun uji',role:sessionRole},scope:'business',expiresAt:'2099-01-01',idleExpiresAt:'2099-01-01',onboarding:{mustChangePassword:false,emailVerified:true,securityQuestionReady:true},maintenance:false}}}));
 await page.route('**/api/auth/csrf?intent=session', route=>route.fulfill({json:{ok:true,data:{csrfToken:'fixture-csrf'}}}));
 await page.route('**/api/auth/logout', route=>route.fulfill({json:{ok:true,data:{loggedOut:true}}}));
 const sessionView=async()=>{await page.goto('http://127.0.0.1:4319/?view=draft-session');await page.getByRole('button',{name:'Uji keluar sesi',exact:true}).waitFor();};
 const seed=async()=>page.evaluate(()=>{sessionStorage.setItem('sim-guru:draft:v1:fixture','private-draft');sessionStorage.setItem('sim-guru:preferences:v1','synthetic-preference');sessionStorage.setItem('sim-guru:release-seen:v1','synthetic-release');});
 await sessionView(); await seed(); await page.getByRole('button',{name:'Uji keluar sesi',exact:true}).click();await page.getByRole('button',{name:'Keluar dari akun',exact:true}).click();await page.waitForURL('**/login?status=logout');
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('sim-guru:draft:v1:fixture')),null);
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('sim-guru:preferences:v1')),null);
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('sim-guru:release-seen:v1')),null);
 await sessionView(); await seed(); await page.evaluate(()=>{const c=new BroadcastChannel('sim-guru-auth');c.postMessage('logout');c.close();}); await page.waitForURL('**/login?status=logout');
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('sim-guru:draft:v1:fixture')),null);
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('sim-guru:preferences:v1')),null);
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('sim-guru:release-seen:v1')),null);
 await sessionView(); await seed(); sessionDenied=true; await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForURL('**/login?status=expired');
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('sim-guru:draft:v1:fixture')),null);
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('sim-guru:preferences:v1')),null);
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('sim-guru:release-seen:v1')),null);
 sessionDenied=false; await sessionView(); await seed();sessionAccount=guru;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForFunction(()=>sessionStorage.getItem('sim-guru:draft:v1:fixture')===null&&sessionStorage.getItem('sim-guru:preferences:v1')===null);
 await sessionView();await seed();sessionRole='guru';await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForFunction(()=>sessionStorage.getItem('sim-guru:preferences:v1')===null&&sessionStorage.getItem('sim-guru:draft:v1:fixture')===null);
 await page.addInitScript(()=>{Object.defineProperty(window,'sessionStorage',{get(){throw Error('SecurityError')}})});
 role='admin'; await go(); d=await open(); await d.getByText(/Draft lokal tidak dapat disimpan/).waitFor();
 await d.getByLabel('Materi pembelajaran',{exact:true}).fill('Manual with denied storage');
 assert.equal(await d.getByLabel('Materi pembelajaran',{exact:true}).inputValue(),'Manual with denied storage');
 assert.deepEqual(errors,[]); console.log(JSON.stringify({passed:true,cases:['reload-explicit-restore','controlled-counts','9-viewports-short-screen-orientations','offline-preflight-before-CSRF-no-autosubmit','uncertain-receipt-review','success-purge','source-conflict','TTL','account-switch','tab-isolation','discard-purge','login-purge','logout-success','broadcast-logout','expired-session','live-account-switch','storage-denied'],pageErrors:errors,writes},null,2));
} finally {await browser?.close();child.kill('SIGTERM');}
