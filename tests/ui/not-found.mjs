/** Production-build 404 checks. Local synthetic sessions only; no real data/mail. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.UI_PLAYWRIGHT_MODULE??'playwright');
const origin='http://127.0.0.1:4347';
const output=process.env.UI_REPORT_DIR??'../ui-not-found-focused';
await mkdir(output,{recursive:true});
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','4347'],{stdio:['ignore','pipe','pipe']});
let browser,stderr='';child.stderr.on('data',b=>stderr+=b);
const report={matrix:[],pageErrors:[],consoleErrors:[],apiWrites:[]};
try {
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(stderr||'404 server timeout')),60000);child.stdout.on('data',b=>{if(b.toString().includes('Ready in')){clearTimeout(timer);resolve();}});child.on('exit',code=>{clearTimeout(timer);reject(Error(`404 server exit ${code}: ${stderr}`));});});
 browser=await chromium.launch({headless:true,...(process.env.UI_BROWSER_EXECUTABLE?{executablePath:process.env.UI_BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--no-zygote','--disable-gpu']});
 const context=await browser.newContext();const page=await context.newPage();page.setDefaultTimeout(12000);
 page.on('pageerror',e=>report.pageErrors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&!(/status of 404/.test(m.text())&&/not-found-fixture|modul\/nonexistent/.test(m.location().url))&&!(/status of (401|503)/.test(m.text())&&/api\/auth\/session/.test(m.location().url)))report.consoleErrors.push(m.text());});
 let state='active',role='admin',delay=0;const api=[];
 const userId='11111111-1111-4111-8111-111111111111';
 const session=()=>({user:{id:userId,username:'synthetic',fullName:'Pengguna sintetis',role},scope:'business',maintenance:false,expiresAt:'2099-01-01T00:00:00Z',idleExpiresAt:'2099-01-01T00:00:00Z',onboarding:{mustChangePassword:false,emailVerified:true,securityQuestionReady:true}});
 await context.route('**/api/**',async route=>{const request=route.request(),url=new URL(request.url());api.push({path:url.pathname,method:request.method()});if(request.method()!=='GET')report.apiWrites.push(url.pathname);
  if(url.pathname==='/api/auth/session'){
   if(delay)await new Promise(r=>setTimeout(r,delay));
   if(state!=='active')return route.fulfill({status:state==='anonymous'?401:503,json:{ok:false,error:{code:state==='anonymous'?'UNAUTHENTICATED':'UNAVAILABLE',message:'Pemeriksaan sesi sintetis.'}}});
   return route.fulfill({json:{ok:true,data:request.method()==='GET'?session():{updated:true}}});
  }
  if(url.pathname==='/api/auth/csrf')return route.fulfill({json:{ok:true,data:{csrfToken:'fixture-csrf'}}});
  if(url.pathname==='/api/reports/read')return route.fulfill({json:{ok:true,data:{academic:false,finance:false}}});
  return route.abort();
 });
 // The auth redirect is under test; the login form itself has its own suite.
 await context.route('**/login?status=expired',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="id"><title>Masuk | SiM-Guru</title><body>Tujuan login sintetis</body></html>'}));
 await context.addCookies([{name:'sim-guru-404-test',value:'retained',url:origin}]);
 const heading=page.getByRole('heading',{name:'Halaman tidak ditemukan',exact:true});
 const go=async path=>{const response=await page.goto(origin+path);await heading.waitFor();return response;};
 const check=async()=>{
  assert.equal(await page.locator('main').count(),1);assert.equal(await page.locator('#konten-utama').count(),1);assert.equal(await page.locator('main main').count(),0);
  assert.equal(await page.locator('h1').count(),1);assert.match(await page.locator('meta[name=robots]').first().getAttribute('content'),/noindex/);assert.match(await page.title(),/SiM-Guru/);assert.equal(await page.locator('head title').count(),1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  assert.equal(await page.getByRole('region',{name:'Halaman tidak ditemukan',exact:true}).evaluate(root=>[...root.querySelectorAll('p,h1,h2,a')].some(n=>n.scrollWidth>n.clientWidth+1)),false,'No clipped text');
  const actions=page.getByRole('navigation',{name:'Navigasi pemulihan halaman'}).getByRole('link');
  for(const link of await actions.all())assert.ok((await link.boundingBox()).height>=44);
  for(const [label,target] of [['Kembali ke beranda','/'],['Buka Dashboard','/dashboard'],['Buka panduan aplikasi','/kesiapan']])assert.equal(await page.getByRole('link',{name:label,exact:true}).getAttribute('href'),target);
 };
 const viewports=[[280,740],[320,740],[375,812],[768,1024],[1024,768],[1440,900],[1920,1080],[812,375]];
 for(const embedded of [false,true])for(const [width,height] of viewports)for(const scale of [1,2]){
  await page.setViewportSize({width,height});await go(embedded?'/modul/nonexistent-404-fixture':'/not-found-fixture');
  await page.addStyleTag({content:`html{font-size:${16*scale}px!important}`});await check();
  report.matrix.push({embedded,width,height,scale});
  if(scale===1&&(width===375||width===1440))await page.screenshot({path:`${output}/${embedded?'workspace':'public'}-${width}.png`,fullPage:true,animations:'disabled'});
 }
 // Public errors stay usable without auth/network and never probe or clear a session.
 state='unavailable';api.length=0;let response=await go('/not-found-fixture/'+ 'a'.repeat(1500)+'?token=DO_NOT_REFLECT');assert.equal(response.status(),404);assert.equal(api.length,0);assert.equal(await page.getByText('DO_NOT_REFLECT').count(),0);
 await page.evaluate(()=>sessionStorage.setItem('404-sentinel','retained'));
 await page.reload();await heading.waitFor();assert.equal(await page.evaluate(()=>sessionStorage.getItem('404-sentinel')),'retained');
 // Native links and the root skip link work without JavaScript too.
 const nojs=await browser.newContext({javaScriptEnabled:false,viewport:{width:320,height:740}});const staticPage=await nojs.newPage();response=await staticPage.goto(origin+'/not-found-fixture');assert.equal(response.status(),404);assert.equal(await staticPage.getByRole('heading',{name:'Halaman tidak ditemukan',exact:true}).count(),1);await staticPage.getByRole('link',{name:'Kembali ke beranda',exact:true}).click();assert.equal(new URL(staticPage.url()).pathname,'/');await nojs.close();
 await page.setViewportSize({width:375,height:812});await go('/not-found-fixture');await page.keyboard.press('Tab');assert.equal(await page.getByRole('link',{name:'Lewati ke konten utama'}).evaluate(n=>n===document.activeElement),true);await page.keyboard.press('Enter');assert.equal(await page.locator('main').evaluate(n=>n===document.activeElement),true);
 await page.keyboard.press('Tab');const home=page.getByRole('link',{name:'Kembali ke beranda',exact:true});assert.equal(await home.evaluate(n=>n===document.activeElement&&n.matches(':focus-visible')),true);await page.keyboard.press('Enter');await page.waitForURL(origin+'/');
 // Both roles keep their existing workspace and can leave the 404 without logout.
 state='active';for(role of ['admin','guru']){
  await go('/modul/nonexistent-404-fixture');await page.getByRole('button',{name:'Keluar',exact:true}).first().waitFor();await check();
  await page.getByRole('link',{name:'Buka Dashboard',exact:true}).click();await page.waitForURL(origin+'/dashboard');await page.getByRole('button',{name:'Keluar',exact:true}).first().waitFor();assert.equal(new URL(page.url()).pathname,'/dashboard');
  await go('/not-found-fixture');await page.getByRole('link',{name:'Buka panduan aplikasi',exact:true}).click();await page.waitForURL(origin+'/kesiapan');await page.getByRole('button',{name:'Keluar',exact:true}).first().waitFor();
 }
 assert.equal((await context.cookies()).find(c=>c.name==='sim-guru-404-test')?.value,'retained');
 delay=800;await page.goto(origin+'/modul/nonexistent-404-fixture');await page.getByLabel('Memuat halaman',{exact:true}).waitFor();await heading.waitFor();delay=0;
 state='unavailable';await page.goto(origin+'/modul/nonexistent-404-fixture');await page.getByRole('heading',{name:'Pemeriksaan sesi',exact:true}).waitFor();state='active';await page.getByRole('button',{name:'Coba kembali',exact:true}).click();await heading.waitFor();await check();
 state='anonymous';await page.goto(origin+'/modul/nonexistent-404-fixture');await page.waitForURL(/\/login\?status=expired/);
 assert.ok(!report.apiWrites.includes('/api/auth/logout'));assert.equal(report.pageErrors.length,0,JSON.stringify(report.pageErrors));assert.equal(report.consoleErrors.length,0,JSON.stringify(report.consoleErrors));
 await writeFile(`${output}/results.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({ok:true,matrix:report.matrix.length,pageErrors:report.pageErrors.length,consoleErrors:report.consoleErrors.length,notes:'HTTP404, static/noJS, main/skip/focus, links, anonymous guards, roles/session preservation, retry; no real credentials/mail/data'}));
}finally{await browser?.close();child.kill('SIGTERM');}
