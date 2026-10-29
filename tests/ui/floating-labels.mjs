/** Real shared fields, synthetic values only; no API/business writes. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.UI_PLAYWRIGHT_MODULE??'playwright');
const child=spawn(process.execPath,['--conditions=react-server','--import','tsx','tests/ui/server.ts'],{stdio:['ignore','pipe','pipe']});
let browser,stderr='';child.stderr.on('data',b=>stderr+=b);
try {
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(stderr||'fixture timeout')),60000);child.stdout.on('data',b=>{if(b.toString().includes('UI_FIXTURE_READY')){clearTimeout(timer);resolve();}});child.on('exit',()=>{clearTimeout(timer);reject(Error(stderr));});});
 browser=await chromium.launch({headless:true,...(process.env.UI_BROWSER_EXECUTABLE?{executablePath:process.env.UI_BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4319/?view=floating-fields');
 const field=page.getByLabel('Nama pengguna',{exact:true});
 const transform=()=>field.evaluate(el=>getComputedStyle(el.parentElement.querySelector('label')).transform);
 const settle=()=>page.evaluate(()=>Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{}))));
 await field.waitFor();await settle();assert.notEqual(await transform(),'none');
 await field.focus();await settle();assert.equal(await transform(),'none');
 await field.fill('Guru baru');await field.blur();await settle();assert.equal(await transform(),'none');
 await page.getByRole('button',{name:'Reset formulir',exact:true}).click();await settle();assert.equal(await field.inputValue(),'');assert.notEqual(await transform(),'none');
 await page.getByLabel('Kata sandi',{exact:true}).fill('SyntheticPassword!');
 await page.getByRole('button',{name:'Tampilkan isian rahasia'}).click();assert.equal(await page.getByLabel('Kata sandi',{exact:true}).getAttribute('type'),'text');
 await page.getByRole('button',{name:'Reset formulir',exact:true}).click();assert.equal(await page.getByLabel('Kata sandi',{exact:true}).getAttribute('type'),'password');
 assert.equal(await page.getByLabel('Nama tersimpan',{exact:true}).inputValue(),'Guru sintetis');
 assert.equal(await page.getByLabel('Tanggal kegiatan').evaluate(el=>getComputedStyle(el.parentElement.querySelector('label')).transform),'none');
 assert.equal(await page.getByLabel('Isian nonaktif').isDisabled(),true);
 assert.equal(await page.getByLabel('Isian hanya baca').getAttribute('readonly'),'');
 assert.equal(await page.getByLabel('Isian dengan kesalahan').getAttribute('aria-describedby'),'fixture-error');
 assert.equal(await page.getByLabel('Isian dengan kesalahan').evaluate(el=>getComputedStyle(el.parentElement).borderTopColor),'rgb(180, 35, 50)');
 assert.equal(await page.getByLabel('Pilih status').evaluate(el=>getComputedStyle(el.parentElement).borderTopWidth),'0px');
 assert.equal(await page.getByLabel('Persetujuan').evaluate(el=>getComputedStyle(el.parentElement).borderTopWidth),'0px');
 for(const width of [280,320,375,768,1024,1440,1920]){
  await page.setViewportSize({width,height:800});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`overflow ${width}`);
  const overlap=await page.locator('.ui-floating-field:has(textarea)').evaluate(el=>{const l=el.querySelector('.ui-floating-label').getBoundingClientRect(),i=el.querySelector('textarea').getBoundingClientRect();return l.right>innerWidth||l.left<0||l.top<i.top-100;});assert.equal(overlap,false);
 }
 await page.emulateMedia({reducedMotion:'reduce'});await field.focus();assert.ok(parseFloat(await field.evaluate(el=>getComputedStyle(el.parentElement.querySelector('label')).transitionDuration)) <= 0.001);
 await page.setViewportSize({width:375,height:812});await page.getByLabel('Catatan pembelajaran',{exact:false}).fill('Catatan sintetis.');await mkdir('../floating-label-evidence',{recursive:true});await page.screenshot({path:'../floating-label-evidence/mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('Floating labels: focus, filled, reset, password, date, readonly, disabled, errors, exclusions, 7 widths and reduced motion passed.');
} finally {await browser?.close();child.kill('SIGTERM');}
