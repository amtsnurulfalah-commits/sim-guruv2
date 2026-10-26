import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
const {chromium}=await import(process.env.UI_PLAYWRIGHT_MODULE??'playwright');
const child=spawn(process.execPath,['--conditions=react-server','--import','tsx','tests/ui/server.ts'],{stdio:['ignore','pipe','pipe']});
let browser,logs='';child.stderr.on('data',b=>logs+=b);
try {
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(logs||'fixture timeout')),60000);child.stdout.on('data',b=>{if(b.toString().includes('UI_FIXTURE_READY')){clearTimeout(timer);resolve();}});child.on('exit',()=>{clearTimeout(timer);reject(Error(logs));});});
 browser=await chromium.launch({headless:true,...(process.env.UI_BROWSER_EXECUTABLE?{executablePath:process.env.UI_BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();page.setDefaultTimeout(60000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta'}).format(new Date());let reads=0;
 await page.route('**/api/operations/tasks',route=>{reads++;return route.fulfill({json:{ok:true,data:{date,generatedAt:date+'T07:00:00Z',items:Array.from({length:61},(_,i)=>({id:'task-'+i,source_id:'source-'+i,kind:'journal',title:'Tugas '+i,reason:'Lengkapi jurnal',date,deadline:null,href:'/jurnal?date='+date,blocked:false}))}}});});
 const go=async(view='tasks',role='admin')=>{await page.goto('http://127.0.0.1:4319/?view='+view+'&role='+role+'&path=/tugas');await page.locator('summary').filter({hasText:'Preferensi tampilan dan pintasan'}).waitFor();};
 const open=async()=>{const summary=page.locator('summary').filter({hasText:'Preferensi tampilan dan pintasan'});if(!await summary.evaluate(n=>n.parentElement.open))await summary.click();await page.getByLabel('Tugas per halaman',{exact:true}).waitFor();};
 const key='sim-guru:preferences:v1';await go();await open();await page.getByRole('list',{name:'Daftar tugas aktif'}).locator(':scope > li').first().waitFor();
 assert.equal(await page.getByRole('list',{name:'Daftar tugas aktif'}).locator(':scope > li').count(),20);
 await page.getByLabel('Tugas per halaman',{exact:true}).selectOption('10');await page.waitForFunction(()=>document.querySelector('ul[aria-label="Daftar tugas aktif"]').children.length===10);
 const readCount=reads;await page.getByLabel('Kepadatan tabel desktop',{exact:true}).selectOption('compact');await page.getByLabel('Jurnal pembelajaran',{exact:true}).check();await page.getByLabel('Manajemen pengguna',{exact:true}).check();assert.equal(reads,readCount);
 const url=page.url();await go();await open();assert.equal(page.url(),url);assert.equal(await page.getByLabel('Tugas per halaman',{exact:true}).inputValue(),'10');assert.equal(await page.getByRole('navigation',{name:'Pintasan pilihan'}).getByRole('link').count(),2);
 await page.getByRole('navigation',{name:'Halaman pusat tugas'}).getByRole('button',{name:'Berikutnya',exact:true}).click();await page.getByLabel('Tugas per halaman',{exact:true}).selectOption('50');await page.waitForFunction(()=>document.querySelector('ul[aria-label="Daftar tugas aktif"]').children.length===50);
 await page.getByRole('button',{name:'Reset preferensi tampilan',exact:true}).click();assert.equal(await page.getByLabel('Tugas per halaman',{exact:true}).inputValue(),'20');assert.equal(await page.getByRole('navigation',{name:'Pintasan pilihan'}).count(),0);assert.equal(await page.evaluate(k=>sessionStorage.getItem(k),key),null);
 // Actual table density: whitespace changes on fine-pointer desktop, controls remain >=44px.
 await go('preferences');await open();await page.setViewportSize({width:1440,height:900});const cell=page.getByRole('region',{name:'Tabel uji preferensi'}).locator('td').first();const comfortable=await cell.evaluate(n=>parseFloat(getComputedStyle(n).paddingTop));await page.getByLabel('Kepadatan tabel desktop',{exact:true}).selectOption('compact');assert.ok(await cell.evaluate(n=>parseFloat(getComputedStyle(n).paddingTop))<comfortable);assert.ok((await page.getByRole('button',{name:'Tindakan uji'}).boundingBox()).height>=44);
 for(const width of [280,320,375,768,1024,1440,1920]){await page.setViewportSize({width,height:800});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 await page.setViewportSize({width:375,height:812});assert.equal(await cell.evaluate(n=>parseFloat(getComputedStyle(n).paddingTop)),comfortable);
 await go('tasks','guru');await open();assert.equal(await page.getByLabel('Tugas per halaman',{exact:true}).inputValue(),'20');assert.equal(await page.getByLabel('Manajemen pengguna',{exact:true}).count(),0);
 // Forged, but structurally valid pins never create unauthorized links or exhaust visible slots.
 await page.evaluate(k=>sessionStorage.setItem(k,JSON.stringify({version:1,scope:'22222222-2222-4222-8222-222222222222:guru',values:{density:'compact',taskPageSize:10,pins:['pengguna','master','operasional','migrasi']}})),key);
 await go('tasks','guru');await open();assert.equal(await page.getByRole('navigation',{name:'Pintasan pilihan'}).count(),0);assert.equal(await page.getByLabel('Jurnal pembelajaran',{exact:true}).isEnabled(),true);await page.getByLabel('Jurnal pembelajaran',{exact:true}).check();assert.deepEqual(await page.evaluate(k=>JSON.parse(sessionStorage.getItem(k)).values.pins,key),['jurnal']);
 await page.evaluate(k=>sessionStorage.setItem(k,'{"version":0}'),key);await go('tasks','guru');await open();assert.equal(await page.getByLabel('Tugas per halaman',{exact:true}).inputValue(),'20');
 await page.addInitScript(()=>Object.defineProperty(window,'sessionStorage',{get(){throw Error('SecurityError');}}));await go();await open();await page.getByText(/Preferensi tidak dapat disimpan/).waitFor();await page.getByLabel('Tugas per halaman',{exact:true}).selectOption('10');await page.waitForFunction(()=>document.querySelector('ul[aria-label="Daftar tugas aktif"]').children.length===10);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,widths:7,pageErrors:errors,cases:['reload','count-without-refetch','reset','fine-pointer-density','44px-targets','mobile-density','account-role-isolation','forged-pins-denied','invalid-version','denied-storage','no-URL-private-state']},null,2));
} finally {await browser?.close();child.kill('SIGTERM');}
