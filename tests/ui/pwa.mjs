import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
const {chromium}=await import(process.env.UI_PLAYWRIGHT_MODULE??'playwright');
const child=spawn(process.execPath,['--conditions=react-server','--import','tsx','tests/ui/server.ts'],{stdio:['ignore','pipe','pipe']});let logs='',browser;child.stderr.on('data',b=>logs+=b);
try{
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(logs||'fixture timeout')),60000);child.stdout.on('data',b=>{if(b.toString().includes('UI_FIXTURE_READY')){clearTimeout(timer);resolve();}});child.on('exit',()=>{clearTimeout(timer);reject(Error(logs));});});
 browser=await chromium.launch({headless:true,executablePath:process.env.UI_BROWSER_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));let role='guru';
 await page.route('**/api/auth/session',r=>r.fulfill({json:{ok:true,data:{user:{id:'11111111-1111-4111-8111-111111111111',username:'synthetic',fullName:'Guru sintetis',role},scope:'business',expiresAt:'2099-01-01T00:00:00Z',idleExpiresAt:'2099-01-01T00:00:00Z',onboarding:{mustChangePassword:false,emailVerified:true,securityQuestionReady:true},maintenance:false}}}));
 await page.addInitScript(()=>{const native=window.matchMedia.bind(window);const media=new EventTarget();Object.defineProperty(media,'matches',{get:()=>window.pwaStandalone===true});window.pwaMedia=media;window.matchMedia=query=>query==='(display-mode: standalone)'?media:native(query);});
 const go=async()=>page.goto('http://127.0.0.1:4319/?view=pwa-session');
 await go();await page.getByRole('heading',{name:'Pasang aplikasi untuk melanjutkan',exact:true}).waitFor();assert.equal(await page.getByRole('heading',{name:'Modul kerja sintetis'}).count(),0);
 await page.evaluate(()=>{localStorage.setItem('installed','true');sessionStorage.setItem('installed','true');});await go();await page.getByRole('heading',{name:'Pasang aplikasi untuk melanjutkan'}).waitFor();
 for(const width of [280,320,375,768,1024,1440,1920]){await page.setViewportSize({width,height:800});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 await page.evaluate(()=>{const e=new Event('beforeinstallprompt',{cancelable:true});e.prompt=async()=>{};e.userChoice=Promise.resolve({outcome:'dismissed'});window.dispatchEvent(e);});await page.getByRole('button',{name:'Pasang aplikasi',exact:true}).click();await page.getByText(/Pemasangan dibatalkan/).waitFor();
 await page.evaluate(()=>window.dispatchEvent(new Event('appinstalled')));await page.getByText('Aplikasi telah dipasang pada perangkat ini.',{exact:true}).waitFor();assert.equal(await page.getByRole('heading',{name:'Modul kerja sintetis'}).count(),0);
 await page.evaluate(()=>{window.pwaStandalone=true;window.pwaMedia.dispatchEvent(new Event('change'));});await page.getByRole('heading',{name:'Modul kerja sintetis'}).waitFor();
 role='admin';await go();await page.getByRole('heading',{name:'Modul kerja sintetis'}).waitFor();assert.equal(await page.getByRole('heading',{name:'Pasang aplikasi untuk melanjutkan'}).count(),0);
 role='guru';await page.addInitScript(()=>Object.defineProperty(navigator,'standalone',{value:true}));await go();await page.getByRole('heading',{name:'Modul kerja sintetis'}).waitFor();
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,widths:7,pageErrors:errors,flows:['guru-browser-block','storage-no-bypass','dismiss','installed-still-browser-blocked','standalone-unlock','admin-exempt','Safari-standalone']}));
}finally{await browser?.close();child.kill('SIGTERM');}
