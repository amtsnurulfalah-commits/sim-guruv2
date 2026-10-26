/** Read-only controlled history responses; no production account or business writes. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
const {chromium}=await import(process.env.UI_PLAYWRIGHT_MODULE??'playwright');
const child=spawn(process.execPath,['--conditions=react-server','--import','tsx','tests/ui/server.ts'],{stdio:['ignore','pipe','pipe']});
const axe=process.env.HISTORY_AXE_PATH?await readFile(process.env.HISTORY_AXE_PATH,'utf8'):null;
const audits=[];
let browser,logs='';child.stderr.on('data',b=>logs+=b);
try{
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(logs||'fixture timeout')),60000);child.stdout.on('data',b=>{if(b.toString().includes('UI_FIXTURE_READY')){clearTimeout(timer);resolve();}});child.on('exit',()=>{clearTimeout(timer);reject(Error(logs));});});
 browser=await chromium.launch({headless:true,...(process.env.UI_BROWSER_EXECUTABLE?{executablePath:process.env.UI_BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({hasTouch:true}),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
 let mode='many',reads=0,slow=false;
 const items=Array.from({length:100},(_,i)=>({id:'11111111-1111-4111-8111-'+String(i).padStart(12,'0'),reference:'22222222-2222-4222-8222-222222222222',kind:i%2?'journal':'duty-substitute',actor:i?'Petugas berwenang':'Nama'.repeat(120),reason:i===0?'<script>window.historyInjected=true</script>'+ 'kata'.repeat(160):null,createdAt:'2026-10-26T00:'+String(i%60).padStart(2,'0')+':00Z',hasBefore:!!(i%2),hasAfter:true,changedFields:['Petugas efektif']}));
 await page.route('**/api/personal/history?*',async route=>{
  reads++;const from=new URL(route.request().url()).searchParams.get('from');const stale=slow&&from==='2026-10-20';
  if(stale)await new Promise(r=>setTimeout(r,500));
  const data={items:mode==='empty'?[]:mode==='invalid'?[{...items[0],createdAt:'2026-10-19T00:00:00Z'}]:mode==='race'?[{...items[0],actor:stale?'STALE':'FRESH'}]:items,truncated:mode==='many'};
  try{await route.fulfill({json:{ok:true,data}});}catch{/* Aborted old-range request. */}
 });
 const go=async(role='guru')=>page.goto('http://127.0.0.1:4319/?view=personalHistory&role='+role);
 await go();await page.getByRole('list',{name:'Daftar riwayat perubahan'}).waitFor();
 assert.equal(await page.getByLabel('Dari tanggal',{exact:true}).inputValue(),'2026-10-20');assert.equal(await page.getByLabel('Sampai tanggal',{exact:true}).inputValue(),'2026-10-26');
 assert.equal(await page.getByRole('list',{name:'Daftar riwayat perubahan'}).locator(':scope > li').count(),10);
 await page.getByRole('note').getByText(/Hanya 100 catatan/).waitFor();
 await page.getByRole('button',{name:'Berikutnya',exact:true}).click();await page.getByText('Halaman 2 dari 10',{exact:true}).waitFor();
 await page.getByLabel('Jenis perubahan',{exact:true}).selectOption('journal');await page.getByText('Halaman 1 dari 5',{exact:true}).waitFor();
 await page.getByLabel('Cari dalam catatan dimuat',{exact:true}).fill('11111111-1111-4111-8111-000000000099');assert.equal(await page.getByRole('list',{name:'Daftar riwayat perubahan'}).locator(':scope > li').count(),1);
 await page.getByLabel('Cari dalam catatan dimuat',{exact:true}).fill('TIDAK ADA');await page.getByText('Tidak ada catatan yang cocok',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Reset pencarian',exact:true}).click();
 const before=reads;await page.getByLabel('Dari tanggal',{exact:true}).fill('2026-10-21');assert.equal(reads,before);await page.getByLabel('Sampai tanggal',{exact:true}).fill('2026-10-20');await page.getByRole('button',{name:'Tampilkan rentang',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(reads,before);assert.equal(await page.getByRole('alert').evaluate(n=>document.activeElement===n),true);
 await go();await page.getByRole('list',{name:'Daftar riwayat perubahan'}).waitFor();await page.getByLabel('Cari dalam catatan dimuat',{exact:true}).fill('000000000000');await page.getByText(/<script>window.historyInjected/).waitFor();assert.equal(await page.evaluate(()=>window.historyInjected),undefined);
 await page.getByText('Referensi audit',{exact:true}).click();await page.getByText('ID objek terkait',{exact:true}).waitFor();
 for(const role of ['guru','admin']){
  await go(role);await page.getByRole('list',{name:'Daftar riwayat perubahan'}).waitFor();
  await page.getByText(role==='admin'?'Alasan tidak tersimpan pada catatan ini.':'Alasan tidak tersedia atau dibatasi sesuai hak akses akun ini.',{exact:false}).first().waitFor();
  await page.getByLabel('Cari dalam catatan dimuat',{exact:true}).fill('000000000000');
  for(const width of [280,320,375,768,1024,1440,1920])for(const font of [16,32]){
   await page.setViewportSize({width,height:width<768?812:900});await page.evaluate(size=>document.documentElement.style.fontSize=size+'px',font);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),role+'/'+width+'/'+font);
  }
  if(axe){await page.setViewportSize({width:375,height:812});await page.addScriptTag({content:axe});const violations=await page.evaluate(async()=>{const r=await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return r.violations.map(x=>({id:x.id,targets:x.nodes.map(n=>n.target)}));});audits.push({role,violations});assert.deepEqual(violations,[]);}
 }
 mode='empty';await go();await page.getByText('Belum ada catatan pada rentang ini',{exact:true}).waitFor();
 mode='invalid';await page.getByRole('button',{name:'Muat ulang sumber',exact:true}).click();await page.getByRole('button',{name:'Coba kembali',exact:true}).waitFor();
 mode='many';await page.getByRole('button',{name:'Coba kembali',exact:true}).click();await page.getByRole('list',{name:'Daftar riwayat perubahan'}).waitFor();
 mode='race';slow=true;await go();await page.getByLabel('Dari tanggal',{exact:true}).fill('2026-10-21');await page.getByRole('button',{name:'Tampilkan rentang',exact:true}).click();await page.getByText('FRESH',{exact:false}).first().waitFor();await page.waitForTimeout(600);assert.equal(await page.getByText('STALE',{exact:false}).count(),0);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,roles:2,layoutCases:28,audits,pageErrors:errors,flows:['past-default','100-row-bound','local-search','kind','paging-reset','draft-vs-applied','invalid-focus','redaction-copy','empty','malformed-retry','abort-stale-range','details','escaped-text','200%-font-orientation']}));
}finally{await browser?.close();child.kill('SIGTERM');}
