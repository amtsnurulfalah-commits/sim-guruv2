import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import { spawn } from "node:child_process";
const { chromium } = await import(
  process.env.UI_PLAYWRIGHT_MODULE ?? "playwright"
);
const child = spawn(
  process.execPath,
  ["--conditions=react-server", "--import", "tsx", "tests/ui/server.ts"],
  {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, UI_SEMESTER_FIXTURE: "1" },
  },
);
let logs = "",
  browser,
  page;
child.stderr.on("data", (b) => (logs += b));
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(Error(logs || "fixture timeout")),
      60000,
    );
    child.stdout.on("data", (b) => {
      if (b.toString().includes("UI_FIXTURE_READY")) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.on("exit", () => {
      clearTimeout(timer);
      reject(Error(logs));
    });
  });
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.UI_BROWSER_EXECUTABLE,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  page = await browser.newPage({ hasTouch: true });
  page.setDefaultTimeout(15000);
  const output=process.env.UI_REPORT_DIR??"../semester-audit-focused";await mkdir(output,{recursive:true});
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const btn = (n) => page.getByRole("button", { name: n, exact: true });
  const dialog = () => page.getByRole("dialog");
  await page.goto("http://127.0.0.1:4319/?view=semesterPreparation&role=admin&path=/admin/persiapan-semester");
  await btn("Buat pratinjau").waitFor();
  await page.waitForFunction(
    () => !document.querySelector('[aria-busy="true"]'),
  );
  await btn("Buat pratinjau").click();
  await dialog()
    .getByLabel("Semester sumber")
    .selectOption({ label: "2095/2096 · Semester 1 (2095-01-01–2095-06-30)" });
  await dialog()
    .getByLabel("Semester tujuan")
    .selectOption({ label: "2095/2096 · Semester 2 (2095-07-01–2095-12-31)" });
  await dialog()
    .getByLabel("Konfigurasi yang disalin")
    .selectOption("classes_and_schedules");
  await dialog()
    .getByLabel("Alasan persiapan (5–500 karakter)")
    .fill("Persiapan semester sintetis untuk pengujian antarmuka");
  for (const size of [
    { width: 1440, height: 900 },
    { width: 768, height: 1024 },
    { width: 320, height: 740 },
    { width: 740, height: 320 },
  ]) {
    await page.setViewportSize(size);
    const b = await dialog().boundingBox();
    assert.ok(
      b.x >= 0 &&
        b.y >= 0 &&
        b.x + b.width <= size.width + 1 &&
        b.y + b.height <= size.height + 1,
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
  }
  const response = page.waitForResponse((r) =>
    r.url().includes("/semester-preparation/preview"),
  );
  await dialog()
    .getByRole("button", { name: "Periksa rencana", exact: true })
    .click();
  const p = (await (await response).json()).data;
  assert.deepEqual(p.plan.issues, []);
  await dialog().waitFor({ state: "hidden" });
  await page.getByRole("heading", { name: "Pratinjau konfigurasi" }).waitFor();
  for (const width of [280, 320, 375, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 850 });
    await page.waitForTimeout(60);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "page overflow " + width,
    );
  }
  await page.route("**/api/semester-preparation/commit", async (route) => {
    const r = await route.fetch();
    assert.equal(r.status(), 200);
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        error: {
          code: "UNAVAILABLE",
          message: "Koneksi terputus setelah server menyelesaikan penerapan",
        },
      }),
    });
  });
  await btn("Terapkan konfigurasi").click();
  assert.equal(
    await dialog()
      .getByRole("button", { name: "Ya, terapkan konfigurasi", exact: true })
      .isDisabled(),
    true,
  );
  await dialog().getByRole("checkbox").check();
  await dialog()
    .getByRole("button", { name: "Ya, terapkan konfigurasi", exact: true })
    .click();
  await dialog()
    .getByRole("button", { name: "Periksa hasil pratinjau", exact: true })
    .waitFor();
  assert.equal(
    await dialog()
      .getByRole("button", { name: "Ya, terapkan konfigurasi", exact: true })
      .isDisabled(),
    true,
  );
  await page.unroute("**/api/semester-preparation/commit");
  await dialog()
    .getByRole("button", { name: "Periksa hasil pratinjau", exact: true })
    .click();
  await dialog().waitFor({ state: "hidden" });
  await page
    .getByRole("heading", { name: "Konfigurasi berhasil diterapkan" })
    .waitFor();
  const retry = await page.request.post(
    "http://127.0.0.1:4319/api/semester-preparation/commit",
    { data: { previewId: p.previewId } },
  );
  assert.equal(retry.status(), 200);
  const rr = (await retry.json()).data;
  assert.equal(rr.classes, 1);
  assert.equal(rr.schedules, 1);
  assert.equal(rr.classMapping[0].id, p.plan.classes[0].id);
  await page.reload();
  await page
    .getByText("Bukti penerapan: " + p.previewId, { exact: true })
    .waitFor();
  // A second preview detects the now-populated target and cannot be applied.
  await btn("Buat pratinjau").click();
  await dialog()
    .getByLabel("Semester sumber")
    .selectOption({ label: "2095/2096 · Semester 1 (2095-01-01–2095-06-30)" });
  await dialog()
    .getByLabel("Semester tujuan")
    .selectOption({ label: "2095/2096 · Semester 2 (2095-07-01–2095-12-31)" });
  await dialog().getByLabel("Konfigurasi yang disalin").selectOption("classes");
  await dialog()
    .getByLabel("Alasan persiapan (5–500 karakter)")
    .fill("Pemeriksaan target yang sudah terisi");
  await dialog()
    .getByRole("button", { name: "Periksa rencana", exact: true })
    .click();
  await dialog().waitFor({ state: "hidden" });
  await page
    .getByText("Rencana belum dapat diterapkan", { exact: true })
    .waitFor();
  assert.equal(await btn("Terapkan konfigurasi").isDisabled(), true);
  await page.goto("http://127.0.0.1:4319/?view=semesterPreparation&role=guru&path=/admin/persiapan-semester");
  await page.getByRole("alert").waitFor();
  assert.equal(
    await page.getByRole("heading", { name: "Pratinjau konfigurasi" }).count(),
    0,
  );

  // Fault injection uses synthetic choices/IDs; no production data or writes.
  const uid=n=>`66666666-6666-4666-8666-${String(n).padStart(12,"0")}`;
  let readsMode="ok",previewMode="ok",commitMode="network",statusMode="none",previewDelay=0,commits=0,previews=0,previewGate=null,current=null,applied=false,expiresIn=600000;
  const periods=[{id:uid(1),name:"Semester sumber "+"NamaPanjang".repeat(15),start:"2095-01-01",end:"2095-06-30",active:false},{id:uid(2),name:"Semester tujuan",start:"2095-07-01",end:"2095-12-31",active:false}];
  const ok=(r,data)=>r.fulfill({contentType:"application/json",body:JSON.stringify({ok:true,data})});
  const fail=(r,status,code,text)=>r.fulfill({status,contentType:"application/json",body:JSON.stringify({ok:false,error:{code,message:text},requestId:"11111111-1111-4111-8111-111111111111"})});
  const result=()=>({previewId:current.previewId,sourceId:uid(1),targetId:uid(2),classes:current.plan.classes.length,schedules:current.plan.schedules.length,committedAt:new Date().toISOString(),classMapping:current.plan.classes,scheduleMapping:current.plan.schedules});
  await page.route("**/api/semester-preparation/**",async r=>{
    const url=new URL(r.request().url()),action=url.pathname.split('/').at(-1);
    if(action==="read"&&!url.searchParams.has('previewId'))return readsMode==="error"?fail(r,503,"UNAVAILABLE","Pilihan semester sementara gagal."):ok(r,readsMode==="bad"?{periods:null,history:[]}:{periods:readsMode==="empty"?[]:periods,history:[]});
    if(action==="read"){
      if(statusMode==="error")return fail(r,503,"UNAVAILABLE","Pemeriksaan hasil terputus.");
      const v=structuredClone(current);v.result=applied?result():null;
      if(statusMode==="plan")v.plan.classes[0].name="Berubah dari rencana";
      if(statusMode==="receipt"){v.result=result();v.result.classMapping=structuredClone(v.result.classMapping);v.result.classMapping[0].grade=8;}
      return ok(r,v);
    }
    if(action==="preview"){
      previews++;if(previewGate)await previewGate;if(previewDelay)await new Promise(resolve=>setTimeout(resolve,previewDelay));
      const request=r.request().postDataJSON(),classes=Array.from({length:56},(_,n)=>({sourceId:uid(n+100),id:uid(n+200),name:"Kelas "+n+" "+"Panjang".repeat(10),level:"SMP",grade:7,parallel:"",expectedStudents:0}));
      const schedules=request.configuration==="classes"&&previewMode!=="wrong"?[]:[{sourceId:uid(500),id:uid(501),classId:classes[0].id,className:classes[0].name,teacher:"Guru sintetis",subject:"IPA",userId:uid(600),subjectId:uid(601),dayIndex:1,timeStart:"07:00:00",timeEnd:"07:40:00",scheduledJtm:"1",restMinutes:0,validFrom:periods[1].start,validTo:periods[1].end}];
      current={previewId:uid(1000+previews),expiresAt:new Date(await page.evaluate(()=>Date.now())+expiresIn).toISOString(),result:null,plan:{sourceId:request.sourceId,targetId:request.targetId,sourceDate:periods[0].end,validFrom:periods[1].start,validTo:periods[1].end,configuration:request.configuration,classes,schedules,issues:[]}};applied=false;
      const v=structuredClone(current);if(previewMode==="wrong")v.plan.configuration="classes_and_schedules";if(previewMode==="duplicate")v.plan.classes[1].id=v.plan.classes[0].id;
      if(previewMode==="blocked"){v.plan.classes=[];v.plan.schedules=[];v.plan.issues=["NO_CLASSES","__proto__"];}
      return ok(r,v);
    }
    if(action==="commit"){
      commits++;await new Promise(resolve=>setTimeout(resolve,300));
      if(commitMode==="network")return r.abort();
      if(commitMode==="stale")return fail(r,409,"SEMESTER_PREVIEW_STALE","Pratinjau berubah atau kedaluwarsa.");
      applied=true;const receipt=result();if(commitMode==="bad"){receipt.classMapping=structuredClone(receipt.classMapping);receipt.classMapping[0].name="Tidak ditinjau";}
      return ok(r,receipt);
    }
    return r.continue();
  });
  const go=()=>page.goto("http://127.0.0.1:4319/?view=semesterPreparation&role=admin&path=/admin/persiapan-semester");
  const ready=()=>page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(b=>b.textContent.includes('Buat pratinjau')&&!b.disabled));
  const fill=async(configuration="classes_and_schedules")=>{await ready();await btn("Buat pratinjau").click();await dialog().getByLabel("Semester sumber").selectOption(uid(1));await dialog().getByLabel("Semester tujuan").selectOption(uid(2));await dialog().getByLabel("Konfigurasi yang disalin").selectOption(configuration);await dialog().getByLabel("Alasan persiapan (5–500 karakter)").fill("Persiapan semester baru sintetis");};
  const create=async(configuration="classes_and_schedules")=>{await fill(configuration);await dialog().getByRole('button',{name:'Periksa rencana',exact:true}).click();await dialog().waitFor({state:'hidden'});await page.getByRole('heading',{name:'Pratinjau konfigurasi',exact:true}).waitFor();};
  const accept=async()=>{await btn('Terapkan konfigurasi').click();await dialog().getByRole('checkbox').check();};
  await go();await ready();assert.equal(await btn('Terapkan persiapan semester?').count(),0);
  readsMode='error';await btn('Muat ulang pilihan').click();await page.getByRole('alert').filter({hasText:'Pilihan semester sementara gagal'}).waitFor();assert.equal(await btn('Buat pratinjau').isDisabled(),true);
  readsMode='bad';await btn('Muat ulang pilihan').click();await page.getByRole('alert').filter({hasText:'Respons persiapan semester tidak sesuai'}).waitFor();assert.equal(await btn('Buat pratinjau').isDisabled(),true);
  readsMode='empty';await btn('Muat ulang pilihan').click();await page.getByText('Siapkan minimal dua semester',{exact:false}).waitFor();assert.equal(await btn('Buat pratinjau').isDisabled(),true);readsMode='ok';await btn('Muat ulang pilihan').click();await ready();
  await fill('classes');const beforeSame=previews;await dialog().getByLabel('Semester tujuan').selectOption(uid(1));await dialog().getByRole('button',{name:'Periksa rencana',exact:true}).click();await dialog().getByRole('alert').filter({hasText:'tujuan yang berbeda'}).waitFor();assert.equal(previews,beforeSame);await dialog().getByLabel('Semester tujuan').selectOption(uid(2));previewMode='wrong';await dialog().getByRole('button',{name:'Periksa rencana',exact:true}).click();await dialog().getByRole('alert').filter({hasText:'tidak sesuai semester atau konfigurasi'}).waitFor();
  previewMode='duplicate';await dialog().getByRole('button',{name:'Periksa rencana',exact:true}).click();await dialog().getByRole('alert').filter({hasText:'Respons persiapan semester tidak sesuai'}).waitFor();previewMode='ok';previewDelay=500;
  previewDelay=0;let releasePreview;previewGate=new Promise(resolve=>{releasePreview=resolve;});const beforePreview=previews;await dialog().getByRole('button',{name:'Periksa rencana',exact:true}).evaluate(b=>{b.click();b.click();});await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Muat ulang pilihan')?.disabled===true);releasePreview();await dialog().waitFor({state:'hidden'});previewGate=null;assert.equal(previews,beforePreview+1);
  const pager=page.getByRole('navigation',{name:'Halaman pemetaan konfigurasi',exact:true});await pager.getByText('Halaman 1 dari 3',{exact:false}).waitFor();assert.equal(await page.getByRole('region',{name:'Pemetaan konfigurasi semester',exact:true}).locator('tbody tr').count(),25);await pager.getByRole('button',{name:'Berikutnya',exact:true}).click();await pager.getByText('Halaman 2 dari 3',{exact:false}).waitFor();
  for(const width of [280,320,375,768,1024,1440,1920]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));if(width===375||width===1440){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`${output}/semester-${width}.png`,fullPage:true});}}
  await page.setViewportSize({width:375,height:812});const zoom=await page.addStyleTag({content:'html{font-size:200%}'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await zoom.evaluate(el=>el.remove());
  // Lost write outcome stays locked through wrong-plan/receipt/transport reads; original plan remains trusted.
  await accept();for(const size of [{width:280,height:740},{width:375,height:812},{width:740,height:320},{width:1440,height:900}]){await page.setViewportSize(size);const bounds=await dialog().boundingBox();assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=size.width+1&&bounds.y+bounds.height<=size.height+1);assert.ok(await dialog().locator('.ui-modal-body').evaluate(node=>node.scrollWidth<=node.clientWidth+1));}await page.setViewportSize({width:375,height:812});const modalZoom=await page.addStyleTag({content:'html{font-size:200%}'});assert.ok(await dialog().locator('.ui-modal-body').evaluate(node=>node.scrollWidth<=node.clientWidth+1));await modalZoom.evaluate(el=>el.remove());const beforeCommit=commits;await dialog().getByRole('button',{name:'Ya, terapkan konfigurasi',exact:true}).evaluate(b=>{b.click();b.click();});await dialog().getByRole('button',{name:'Periksa hasil pratinjau',exact:true}).waitFor();assert.equal(commits,beforeCommit+1);
  for(const mode of ['plan','receipt','error']){statusMode=mode;await dialog().getByRole('button',{name:'Periksa hasil pratinjau',exact:true}).click();await dialog().getByRole('alert').waitFor();assert.equal(await dialog().getByRole('button',{name:'Ya, terapkan konfigurasi',exact:true}).isDisabled(),true);assert.equal(await page.getByRole('heading',{name:'Konfigurasi berhasil diterapkan',exact:true}).count(),0);}
  statusMode='none';await dialog().getByRole('button',{name:'Periksa hasil pratinjau',exact:true}).click();await dialog().getByText('Belum ada hasil penerapan untuk ID ini.',{exact:false}).waitFor();assert.equal(await dialog().getByRole('checkbox').isChecked(),false);assert.equal(await dialog().getByRole('button',{name:'Ya, terapkan konfigurasi',exact:true}).isDisabled(),true);
  commitMode='bad';await dialog().getByRole('checkbox').check();await dialog().getByRole('button',{name:'Ya, terapkan konfigurasi',exact:true}).click();await dialog().getByRole('button',{name:'Periksa hasil pratinjau',exact:true}).waitFor();assert.equal(await page.getByRole('heading',{name:'Konfigurasi berhasil diterapkan',exact:true}).count(),0);
  await dialog().getByRole('button',{name:'Periksa hasil pratinjau',exact:true}).click();await dialog().waitFor({state:'hidden'});await page.getByRole('heading',{name:'Konfigurasi berhasil diterapkan',exact:true}).waitFor();assert.equal(await btn('Terapkan konfigurasi').isDisabled(),true);
  // Stale commit requires a new preview and cannot be submitted again.
  await create('classes');commitMode='stale';await accept();await dialog().getByRole('button',{name:'Ya, terapkan konfigurasi',exact:true}).click();await dialog().waitFor({state:'hidden'});await page.getByText('Pratinjau berubah atau tidak tersedia.',{exact:false}).waitFor();assert.equal(await btn('Terapkan konfigurasi').isDisabled(),true);
  previewMode='blocked';await create('classes');await page.getByText('Rencana belum dapat diterapkan',{exact:true}).waitFor();assert.equal(await btn('Terapkan konfigurasi').isDisabled(),true);previewMode='ok';
  // A valid committed receipt remains available even if the preview is now expired.
  await page.clock.install({time:new Date('2026-10-25T03:00:00Z')});expiresIn=1000;await create('classes');await page.clock.setSystemTime(new Date(Date.parse(current.expiresAt)+2000));await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.getByText('Pratinjau kedaluwarsa.',{exact:false}).waitFor();assert.equal(await btn('Terapkan konfigurasi').isDisabled(),true);applied=true;await btn('Periksa hasil pratinjau').click();await page.getByRole('heading',{name:'Konfigurasi berhasil diterapkan',exact:true}).waitFor();
  assert.deepEqual(errors, []);
  assert.equal(
    logs.replace("fixture /api/semester-preparation/read FORBIDDEN\n", ""),
    "",
  );
  console.log(
    JSON.stringify({
      passed: true,
      widths: 7,
      dialogOrientations: 4,
      flows: [
        "preview-mapping",
        "confirmation",
        "commit-ack-loss",
        "receipt-recovery",
        "idempotent-retry",
        "history-reload",
        "occupied-target",
        "guru-denied", "choices-error-lock-empty-recovery", "request-and-graph-validation", "single-flight-preview-commit", "56-row-pagination", "200-percent-text", "exact-status-and-receipt-recovery", "stale-preview", "unknown-issue", "expiry-and-expired-receipt",
      ],
      pageErrors: errors,
    }),
  );
} catch (e) {
  console.error(await page?.locator("body").innerText());
  throw e;
} finally {
  await browser?.close();
  child.kill("SIGTERM");
}
