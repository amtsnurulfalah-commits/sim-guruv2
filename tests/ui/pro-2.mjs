/** Controlled lazy-history comparison. No production requests or writes. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
const {chromium}=await import(process.env.UI_PLAYWRIGHT_MODULE??'playwright');
const child=spawn(process.execPath,['--conditions=react-server','--import','tsx','tests/ui/server.ts'],{stdio:['ignore','pipe','pipe']});
let browser,logs='';child.stderr.on('data',b=>logs+=b);
try{
 await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error(logs||'fixture timeout')),60000);child.stdout.on('data',b=>{if(b.toString().includes('UI_FIXTURE_READY')){clearTimeout(t);resolve();}});child.on('exit',()=>{clearTimeout(t);reject(Error(logs||'fixture exit'));});});
 browser=await chromium.launch({headless:true,executablePath:process.env.UI_BROWSER_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({reducedMotion:'reduce'}),errors=[],samples=[];let historyReads=0;
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/activities/journals?*',async route=>{
  historyReads++;await new Promise(r=>setTimeout(r,400));
  const url=new URL(route.request().url());await route.fulfill({json:{ok:true,data:{items:[],total:0,page:Number(url.searchParams.get('page')),pageSize:25}}});
 });
 for(const role of ['guru','admin'])for(const width of [375,1440])for(let repeat=0;repeat<5;repeat++){
  await page.setViewportSize({width,height:900});historyReads=0;const start=performance.now();
  await page.goto('http://127.0.0.1:4319/?view=journals&role='+role,{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'Jurnal pembelajaran',exact:true}).waitFor();
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Muat ulang'&&!b.disabled));
  const readyMs=Math.round(performance.now()-start);await page.waitForTimeout(750);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false);
  samples.push({role,width,repeat,readyMs,hiddenHistoryRequests:historyReads});
 }
 assert.deepEqual(errors,[]);const ordered=samples.map(s=>s.readyMs).sort((a,b)=>a-b);
 const phase=process.env.UI_PROFILE_LABEL??'after';if(phase==='after')assert.ok(samples.every(s=>s.hiddenHistoryRequests===0),'HIDDEN_HISTORY_FETCH_REGRESSION');
 const result={phase,kind:'pro2-lazy-history-controlled-browser',browser:browser.version(),samples,p50Ms:ordered[9],p95Ms:ordered[18],hiddenHistoryRequests:samples.reduce((n,s)=>n+s.hiddenHistoryRequests,0),pageErrors:errors,overflow:false,limits:'Readiness = reload control enabled, not Core Web Vitals or human task time. History response deliberately delayed 400ms in both variants. Local fixture, empty history, no Next SSR/WAN/production measurement.'};
 if(process.env.UI_PROFILE_FILE)await writeFile(process.env.UI_PROFILE_FILE,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({...result,samples:samples.length}));
}finally{await browser?.close();child.kill('SIGTERM');}
