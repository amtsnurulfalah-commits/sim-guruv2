/** Mock provider only; never solves or contacts a real CAPTCHA. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.UI_PLAYWRIGHT_MODULE??'playwright');
const child=spawn(process.execPath,['--conditions=react-server','--import','tsx','tests/ui/server.ts'],{stdio:['ignore','pipe','pipe']});
let browser,stderr='';child.stderr.on('data',b=>stderr+=b);
try {
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(stderr||'fixture timeout')),60000);child.stdout.on('data',b=>{if(b.toString().includes('UI_FIXTURE_READY')){clearTimeout(timer);resolve();}});child.on('exit',()=>{clearTimeout(timer);reject(Error(stderr));});});
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],...(process.env.UI_BROWSER_EXECUTABLE?{executablePath:process.env.UI_BROWSER_EXECUTABLE}:{})});
 await mkdir('../ui-recaptcha-panel',{recursive:true});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let blocked=false,posts=0,lastInput;
 await page.route('https://www.google.com/recaptcha/api.js?**',r=>blocked?r.abort():r.fulfill({contentType:'application/javascript',body:`
 window.fixtureCaptchas=[];
 window.grecaptcha={render(node,options){const id=window.fixtureCaptchas.push(options)-1;const b=document.createElement('button');b.type='button';b.textContent='Centang sintetis';b.style.cssText='width:164px;height:144px';b.onclick=()=>options.callback('synthetic-token-'+id);node.appendChild(b);return id;},reset(id){}};
 window.simGuruRecaptchaReady?.();
 `}));
 await page.route('**/api/auth/csrf',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,data:{csrfToken:'fixture-csrf'}})}));
 await page.route('**/api/auth/login',r=>{posts++;lastInput=r.request().postDataJSON();return r.fulfill({status:401,contentType:'application/json',body:JSON.stringify({ok:false,error:{code:'INVALID_CREDENTIALS',message:'Username atau kata sandi tidak sesuai.'},requestId:'synthetic-reference'})});});
 const go=()=>page.goto('http://127.0.0.1:4319/?view=login-captcha');
 const submit=()=>page.getByRole('button',{name:'Masuk',exact:true});
 const check=()=>page.getByRole('button',{name:'Centang sintetis',exact:true});
 const fill=async()=>{await page.getByLabel('Username',{exact:true}).fill('guru.test');await page.getByLabel('Kata sandi',{exact:true}).fill('Synthetic9!Password');};
 for(const width of [280,320,375,768,1440]) {
  await page.setViewportSize({width,height:900});await go();await check().waitFor();
  assert.equal(await check().count(),1,'no duplicate widgets in StrictMode');
  for(const font of [16,32]) {await page.evaluate(size=>document.documentElement.style.fontSize=size+'px',font);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);}
 }
 await go();await check().waitFor();await page.screenshot({path:'../ui-recaptcha-panel/login-desktop.png',fullPage:true});await page.setViewportSize({width:375,height:900});await go();await check().waitFor();await page.screenshot({path:'../ui-recaptcha-panel/login-mobile.png',fullPage:true});await fill();assert.equal(await submit().isDisabled(),true);
 await page.locator('form').evaluate(f=>f.requestSubmit());assert.equal(posts,0);
 await check().click();assert.equal(await submit().isEnabled(),true);await page.getByText('Anda siap masuk',{exact:true}).waitFor();await page.screenshot({path:'../ui-recaptcha-panel/login-verified.png',fullPage:true});
 await page.evaluate(()=>window.fixtureCaptchas.at(-1)['expired-callback']());assert.equal(await submit().isDisabled(),true);
 await check().click();await submit().click();await page.getByRole('alert').filter({hasText:'synthetic-reference'}).waitFor();
 await check().waitFor();await page.getByText('Belum diverifikasi',{exact:true}).waitFor();assert.equal(posts,1);assert.match(lastInput.captchaToken,/^synthetic-token-/);assert.equal(await submit().isDisabled(),true);
 assert.equal(await page.getByLabel('Username',{exact:true}).inputValue(),'guru.test');assert.equal(await page.getByLabel('Kata sandi',{exact:true}).inputValue(),'');
 await page.evaluate(()=>window.fixtureCaptchas.at(-1)['error-callback']());await page.getByRole('button',{name:'Muat ulang verifikasi'}).click();await check().waitFor();assert.equal(await check().count(),1);
 blocked=true;await go();await page.getByRole('alert').filter({hasText:'gagal dimuat'}).waitFor();assert.equal(await submit().isDisabled(),true);
 blocked=false;await page.getByRole('button',{name:'Muat ulang verifikasi'}).click();await check().waitFor();await check().click();assert.equal(await submit().isEnabled(),true);
 assert.deepEqual(errors,[]);console.log('CAPTCHA UI: 5 viewports, 200% text, StrictMode, missing/expired/reset/network/retry PASS');
} finally {await browser?.close();child.kill('SIGTERM');}
