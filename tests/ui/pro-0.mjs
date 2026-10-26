/** Synthetic baseline. No production URL, real users, mail, or business mutations. */
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {dirname} from 'node:path';
const {chromium}=await import(process.env.UI_PLAYWRIGHT_MODULE??'playwright');
if(!process.env.PRO0_AXE_PATH||!process.env.PRO0_REPORT_FILE)throw Error('PRO0_AXE_PATH_AND_REPORT_FILE_REQUIRED');
const axe=await readFile(process.env.PRO0_AXE_PATH,'utf8');
const child=spawn(process.execPath,['--conditions=react-server','--import','tsx','tests/ui/server.ts'],{stdio:['ignore','pipe','pipe']});
let browser,log='';child.stderr.on('data',b=>log+=b);
try{
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(log||'fixture timeout')),60000);child.stdout.on('data',b=>{if(b.toString().includes('UI_FIXTURE_READY')){clearTimeout(timer);resolve();}});child.on('exit',()=>{clearTimeout(timer);reject(Error(log||'fixture exited'));});});
 browser=await chromium.launch({headless:true,...(process.env.UI_BROWSER_EXECUTABLE?{executablePath:process.env.UI_BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({reducedMotion:'reduce',timezoneId:'Asia/Jakarta'}),pageErrors=[],cases=[];
 page.on('pageerror',e=>pageErrors.push(e.message));
 for(const [view,role] of [['journals','guru'],['tasks','admin']])for(const width of [320,375,768,1440])for(const fontSize of [16,32]){
  await page.setViewportSize({width,height:900});const start=performance.now();
  await page.goto('http://127.0.0.1:4319/?'+new URLSearchParams({view,role,path:view==='tasks'?'/tugas':'/jurnal'}),{waitUntil:'networkidle'});
  await page.waitForFunction(()=>!document.querySelector('[aria-busy="true"]'));
  const readyMs=Math.round(performance.now()-start);
  await page.evaluate(size=>document.documentElement.style.fontSize=size+'px',fontSize);
  await page.addScriptTag({content:axe});
  const audit=await page.evaluate(async()=>{
   const r=await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});
   return {version:window.axe.version,passes:r.passes.length,incomplete:r.incomplete.map(v=>({id:v.id,nodes:v.nodes.length})),violations:r.violations.map(v=>({id:v.id,impact:v.impact,help:v.help,helpUrl:v.helpUrl,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))};
  });
  const tabSequence=[];
  await page.evaluate(()=>document.activeElement?.blur());
  for(let i=0;i<8;i++){await page.keyboard.press('Tab');tabSequence.push(await page.evaluate(()=>{const e=document.activeElement;return {tag:e?.tagName,role:e?.getAttribute('role'),name:e?.getAttribute('aria-label')||e?.getAttribute('name'),disabled:e?.hasAttribute('disabled')};}));}
  cases.push({view,role,width,fontSize,readyMs,documentOverflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),audit,tabSequence});
 }
 const result={schemaVersion:1,measuredAt:new Date().toISOString(),kind:'synthetic-pilot-a11y-and-layout-baseline',sourceCommit:process.env.PRO0_SOURCE_COMMIT??null,environment:{node:process.version,browser:browser.version(),network:'localhost',database:'disposable PGlite fixture',production:false},cases,pageErrors,limits:['Not human UAT, physical-device evidence, screen-reader testing or WCAG certification.','axe may require manual review; no finding is automatically fixed by this collector.','Only default journal/task views, two roles and eight Tab steps; not all dialogs, tabs, business flows or API authorization.','Readiness includes networkidle; not user task duration or Core Web Vitals.'],serverLogPresent:Boolean(log.trim())};
 await mkdir(dirname(process.env.PRO0_REPORT_FILE),{recursive:true});
 await writeFile(process.env.PRO0_REPORT_FILE,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({cases:cases.length,pageErrors:pageErrors.length,overflow:cases.filter(c=>c.documentOverflow).length,violationIds:[...new Set(cases.flatMap(c=>c.audit.violations.map(v=>v.id)))]}));
}finally{await browser?.close();child.kill('SIGTERM');}
