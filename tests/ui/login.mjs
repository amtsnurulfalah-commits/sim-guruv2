/** Synthetic login fixtures: no production sessions, passwords, or mail. */
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {createServer} from 'node:https';
import {request as proxyRequest} from 'node:http';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {mkdir,writeFile,mkdtemp,readFile,rm} from 'node:fs/promises';
const {chromium}=await import(process.env.UI_PLAYWRIGHT_MODULE??'playwright');
const child=spawn(process.execPath,['--conditions=react-server','--import','tsx','tests/ui/server.ts'],{stdio:['ignore','pipe','pipe']});
let browser,production,proxy,certificateDirectory,stderr='';child.stderr.on('data',b=>stderr+=b);
const output=process.env.UI_REPORT_DIR??'../ui-login-focused';await mkdir(output,{recursive:true});
try {
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(stderr||'fixture timeout')),60000);child.stdout.on('data',b=>{if(b.toString().includes('UI_FIXTURE_READY')){clearTimeout(timer);resolve();}});child.on('exit',()=>{clearTimeout(timer);reject(Error(stderr));});});
 browser=await chromium.launch({headless:true,...(process.env.UI_BROWSER_EXECUTABLE?{executablePath:process.env.UI_BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();page.setDefaultTimeout(12000);const errors=[],consoleErrors=[],matrix=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().startsWith('Failed to load resource:'))consoleErrors.push(m.text());});
 let getMode='ok',postMode='wrong',getDelay=0,postDelay=0,gets=0,posts=0,lastInput,lastCsrf;
 const ok=(r,data)=>r.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,data})});
 const fail=(r,code,status,fieldErrors)=>r.fulfill({status,headers:code==='RATE_LIMITED'?{'retry-after':'120'}:{},contentType:'application/json',body:JSON.stringify({ok:false,error:{code,message:'Penolakan login sintetis.',...(fieldErrors?{fieldErrors}:{})},requestId:'login-help-123'})});
 await page.route('**/api/auth/csrf',async r=>{gets++;if(getDelay)await new Promise(resolve=>setTimeout(resolve,getDelay));if(getMode==='failure')return fail(r,'UNAVAILABLE',503);if(getMode==='network')return r.abort();return ok(r,getMode==='malformed'?{}:{csrfToken:'fixture-csrf'});});
 await page.route('**/api/auth/login',async r=>{
  posts++;lastInput=r.request().postDataJSON();lastCsrf=r.request().headers()['x-csrf-token'];if(postDelay)await new Promise(resolve=>setTimeout(resolve,postDelay));
  if(postMode==='wrong')return fail(r,'INVALID_CREDENTIALS',401);
  if(postMode==='csrf')return fail(r,'CSRF_INVALID',403);
  if(postMode==='rate')return fail(r,'RATE_LIMITED',429);
  if(postMode==='maintenance')return fail(r,'MAINTENANCE',503);
  if(postMode==='field')return fail(r,'VALIDATION_ERROR',422,{username:['Periksa username sintetis.']});
  if(postMode==='network')return r.abort();
  if(postMode==='malformed')return ok(r,{});
  if(postMode==='external')return ok(r,{redirectTo:'https://evil.example/'});
  return ok(r,{redirectTo:postMode==='onboarding'?'/akun':'/dashboard'});
 });
 await page.route('**/dashboard',r=>r.fulfill({contentType:'text/html',body:'<main>Dashboard sintetis</main>'}));
 await page.route('**/akun',r=>r.fulfill({contentType:'text/html',body:'<main>Pengamanan sintetis</main>'}));
 await page.route('**/lupa-password',r=>r.fulfill({contentType:'text/html',body:'<main>Pemulihan sintetis</main>'}));
 const go=()=>page.goto('http://127.0.0.1:4319/?view=login&status=logout');
 const submit=()=>page.getByRole('button',{name:'Masuk',exact:true});
 const ready=()=>submit().waitFor();
 const fill=async(username='GURU.TEST',password='Synthetic9!Password')=>{await page.getByLabel('Username',{exact:true}).fill(username);await page.getByLabel('Kata sandi',{exact:true}).fill(password);};
 const bounds=async()=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.equal(await page.locator('form').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);};
 for(const width of [280,320,375,767,768,1024,1440,1920]){
  console.log('Login viewport',width);await page.setViewportSize({width,height:850});await go();await ready();
  for(const fontSize of [16,32]){
   await page.evaluate(size=>document.documentElement.style.fontSize=size+'px',fontSize);await bounds();
   assert.ok((await page.getByRole('link',{name:'Lupa kata sandi?',exact:true}).boundingBox()).height>=44);
   assert.equal(await page.getByLabel('Kata sandi',{exact:true}).evaluate(e=>parseFloat(getComputedStyle(e).paddingRight)>=e.parentElement.querySelector('button').getBoundingClientRect().width),true,'Password text must clear reveal button');
   matrix.push({width,fontSize});
   if(fontSize===16&&[375,1440].includes(width))await page.screenshot({path:`${output}/login-${width}.png`,fullPage:true,animations:'disabled'});
  }
 }
 await page.setViewportSize({width:375,height:812});await go();await ready();await page.getByRole('status').filter({hasText:'Anda berhasil keluar.'}).waitFor();
 assert.equal(await page.locator('form').getAttribute('method'),'post');assert.equal(await page.getByLabel('Username',{exact:true}).getAttribute('autocomplete'),'username');assert.equal(await page.getByLabel('Kata sandi',{exact:true}).getAttribute('autocomplete'),'current-password');
 // Client validation preserves password for correction and sends no request.
 await fill('bad@email.test');await submit().click();await page.getByRole('alert').waitFor();assert.equal(posts,0);assert.equal(await page.getByLabel('Username',{exact:true}).getAttribute('aria-invalid'),'true');assert.equal(await page.getByLabel('Kata sandi',{exact:true}).inputValue(),'Synthetic9!Password');
 await fill('guru.test','😀'.repeat(129));await submit().click();assert.equal(posts,0);assert.equal(await page.getByLabel('Kata sandi',{exact:true}).getAttribute('aria-invalid'),'true');
 // Invalid credentials remain generic; preserve username, clear and conceal password.
 await fill();await page.getByRole('button',{name:'Tampilkan isian rahasia',exact:true}).click();await submit().click();await page.getByRole('alert').filter({hasText:'login-help-123'}).waitFor();await ready();assert.equal(posts,1);assert.deepEqual(lastInput,{username:'guru.test',password:'Synthetic9!Password'});assert.equal(lastCsrf,'fixture-csrf');assert.equal(await page.getByLabel('Username',{exact:true}).inputValue(),'guru.test');assert.equal(await page.getByLabel('Kata sandi',{exact:true}).inputValue(),'');assert.equal(await page.getByLabel('Kata sandi',{exact:true}).getAttribute('type'),'password');assert.equal(await page.getByLabel('Username',{exact:true}).getAttribute('aria-invalid'),'true');
 // Burst submits cannot produce more than one login write.
 const before=posts;postDelay=500;await fill();await submit().evaluate(b=>{b.click();b.click();b.form.requestSubmit();});await ready();assert.equal(posts,before+1);postDelay=0;
 // CSRF recovery only refreshes the form, never replays credentials.
 postMode='csrf';await fill();const previousGets=gets,previousPosts=posts;await submit().click();await page.getByRole('status').filter({hasText:'Formulir telah diperbarui'}).waitFor();await ready();assert.equal(gets,previousGets+1);assert.equal(posts,previousPosts+1);assert.equal(await page.getByLabel('Kata sandi',{exact:true}).inputValue(),'');
 for(const mode of ['field','rate','maintenance','network','malformed','external']){
  postMode=mode;await fill();await submit().click();await page.getByRole('alert').waitFor();await ready();await bounds();
  if(mode==='rate')await page.getByRole('alert').filter({hasText:'2 menit'}).waitFor();
  if(mode==='field')assert.equal(await page.getByLabel('Username',{exact:true}).getAttribute('aria-invalid'),'true');
  if(mode==='network')await page.getByRole('alert').filter({hasText:'Login belum dapat dipastikan'}).waitFor();
  if(mode==='external')assert.equal(new URL(page.url()).hostname,'127.0.0.1');
 }
 // Broken preparation cannot enable login; retry itself is serialized.
 getMode='malformed';await go();await page.getByRole('alert').waitFor();assert.equal(await page.getByRole('button',{name:'Formulir belum siap',exact:true}).isDisabled(),true);getMode='failure';await page.getByRole('button',{name:'Muat ulang formulir',exact:true}).click();await page.getByRole('alert').filter({hasText:'login-help-123'}).waitFor();getMode='ok';getDelay=500;const beforeRetry=gets;await page.getByRole('button',{name:'Muat ulang formulir',exact:true}).evaluate(b=>{b.click();b.click();});await ready();assert.equal(gets,beforeRetry+1);getDelay=0;
 // Onboarding and normal login retain their approved destinations.
 for(const mode of ['onboarding','business']){postMode=mode;await go();await ready();await fill();await submit().click();await page.getByText(mode==='onboarding'?'Pengamanan sintetis':'Dashboard sintetis',{exact:true}).waitFor();assert.equal(new URL(page.url()).pathname,mode==='onboarding'?'/akun':'/dashboard');}
 // A late result cannot replace a destination chosen by the user.
 postMode='business';postDelay=700;await go();await ready();await fill();await submit().click();await page.getByRole('link',{name:'Lupa kata sandi?',exact:true}).click();await page.getByText('Pemulihan sintetis',{exact:true}).waitFor();await page.waitForTimeout(900);assert.equal(new URL(page.url()).pathname,'/lupa-password');postDelay=0;
 await go();await ready();for(const viewport of [{width:812,height:375},{width:320,height:568},{width:1440,height:1600}]){await page.setViewportSize(viewport);await bounds();await page.getByRole('link',{name:'Lupa kata sandi?',exact:true}).scrollIntoViewIfNeeded();await page.evaluate(()=>scrollTo(0,0));}
 await page.getByLabel('Username',{exact:true}).focus();await page.keyboard.press('Tab');assert.equal(await page.getByLabel('Kata sandi',{exact:true}).evaluate(e=>e===document.activeElement),true);await page.keyboard.press('Tab');assert.equal(await page.getByRole('button',{name:'Tampilkan isian rahasia',exact:true}).evaluate(e=>e===document.activeElement),true);await page.keyboard.press('Enter');assert.equal(await page.getByLabel('Kata sandi',{exact:true}).getAttribute('type'),'text');
 // Production SSR/hydration and real prelogin CSRF need no database or login write.
 const origin='https://127.0.0.1:4327';
 production=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','4328'],{stdio:['ignore','pipe','pipe'],env:{...process.env,APP_URL:origin,APP_TIMEZONE:'Asia/Jakarta',SESSION_SECRET:randomBytes(40).toString('hex'),AUTH_CHALLENGE_HMAC_SECRET:randomBytes(40).toString('hex'),AUTH_OUTBOX_ENCRYPTION_KEY:randomBytes(32).toString('hex'),DATABASE_URL:'',AUTH_DATABASE_URL:''}});
 let productionErrors='';production.stderr.on('data',b=>productionErrors+=b);
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(productionErrors||'production server timeout')),60000);production.stdout.on('data',b=>{if(b.toString().includes('Ready in')){clearTimeout(timer);resolve();}});production.on('exit',()=>{clearTimeout(timer);reject(Error(productionErrors));});});
 // Keep the application's HTTPS-only production policy intact using an ephemeral TLS proxy.
 certificateDirectory=await mkdtemp(join(tmpdir(),'sim-guru-login-tls-'));
 const keyPath=join(certificateDirectory,'key.pem'),certPath=join(certificateDirectory,'cert.pem');
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',keyPath,'-out',certPath,'-days','1','-subj','/CN=localhost'],{stdio:'ignore'});
 proxy=createServer({key:await readFile(keyPath),cert:await readFile(certPath)},(request,response)=>{const upstream=proxyRequest({hostname:'127.0.0.1',port:4328,path:request.url,method:request.method,headers:request.headers},result=>{response.writeHead(result.statusCode,result.headers);result.pipe(response);});upstream.on('error',()=>{response.writeHead(502);response.end();});request.pipe(upstream);});
 await new Promise(resolve=>proxy.listen(4327,'127.0.0.1',resolve));
 const live=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:375,height:812}}),livePage=await live.newPage();livePage.on('pageerror',e=>errors.push(e.message));livePage.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
 const realCsrf=livePage.waitForResponse(r=>r.url()===origin+'/api/auth/csrf');
 assert.equal((await livePage.goto(origin+'/login?status=activated')).status(),200);assert.equal((await realCsrf).status(),200);await livePage.getByRole('button',{name:'Masuk',exact:true}).waitFor();await livePage.getByRole('status').filter({hasText:'Akun berhasil diaktifkan'}).waitFor();assert.equal(await livePage.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await live.close();
 const noJs=await browser.newContext({ignoreHTTPSErrors:true,javaScriptEnabled:false,viewport:{width:320,height:700}}),staticPage=await noJs.newPage();assert.equal((await staticPage.goto(origin+'/login')).status(),200);await staticPage.getByText('Aktifkan JavaScript lalu muat ulang halaman untuk masuk dengan aman.',{exact:true}).waitFor();assert.equal(await staticPage.locator('form').getAttribute('method'),'post');assert.equal(await staticPage.locator('button[type=submit]').isDisabled(),true);assert.equal(await staticPage.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await noJs.close();
 assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);await writeFile(`${output}/results.json`,JSON.stringify({matrix,errors,consoleErrors,posts,gets,productionCsrf:true,noJavaScript:true,result:'passed'},null,2));console.log(JSON.stringify({matrix:matrix.length,errors:errors.length,result:'passed'}));
} finally {await browser?.close();child.kill('SIGTERM');production?.kill('SIGTERM');proxy?.closeAllConnections();if(proxy?.listening)await new Promise(resolve=>proxy.close(resolve));if(certificateDirectory)await rm(certificateDirectory,{recursive:true,force:true});}
