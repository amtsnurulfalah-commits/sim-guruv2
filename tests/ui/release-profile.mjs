import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.UI_PLAYWRIGHT_MODULE ?? 'playwright');
const child=spawn(process.execPath,['--conditions=react-server','--import','tsx','tests/ui/server.ts'],{stdio:['ignore','pipe','pipe']});
let browser,log='';child.stderr.on('data',b=>log+=b);
try {
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(log||'fixture timeout')),60000);child.stdout.on('data',b=>{if(b.toString().includes('UI_FIXTURE_READY')){clearTimeout(timer);resolve();}});child.on('exit',()=>{clearTimeout(timer);reject(Error(log));});});
 browser=await chromium.launch({headless:true,...(process.env.UI_BROWSER_EXECUTABLE?{executablePath:process.env.UI_BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({reducedMotion:'reduce'}),errors=[],samples=[];
 page.on('pageerror',e=>errors.push(e.message));
 for(const width of [320,1440]) for(const view of ['dashboard','journals','history']) for(let repeat=0;repeat<5;repeat++){
  await page.setViewportSize({width,height:900});const start=performance.now();
  await page.goto('http://127.0.0.1:4319/?view='+view);
  await page.waitForLoadState('networkidle');await page.waitForFunction(()=>!document.querySelector('[aria-busy="true"]'));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  const resources=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>r.name.includes('/api/')).map(r=>({durationMs:Math.round(r.duration),bytes:r.transferSize})));
  samples.push({width,view,repeat,readyMs:Math.round(performance.now()-start),resources});
 }
 assert.deepEqual(errors,[]);
 const ordered=samples.map(s=>s.readyMs).sort((a,b)=>a-b);
 const result={kind:'localhost-chromium-fixture-profile',samples:samples.length,p50ReadyMs:ordered[14],p95ReadyMs:ordered[28],pageErrors:0,overflow:false,measurements:samples,limits:'Includes a 500ms network-idle wait; small synthetic fixture, no TLS/WAN, not production Core Web Vitals/SLO or physical device UAT.'};
 if(process.env.UI_PROFILE_FILE)await writeFile(process.env.UI_PROFILE_FILE,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({...result,measurements:undefined}));
}finally{await browser?.close();child.kill('SIGTERM');}
