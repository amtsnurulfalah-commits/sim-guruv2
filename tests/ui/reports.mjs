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
    env: { ...process.env, UI_REPORT_FIXTURE: "1" },
  },
);
let logs = "",
  browser,
  page;
child.stderr.on("data", (b) => (logs += b));
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error(logs || "timeout")), 60000);
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
  const output=process.env.UI_REPORT_DIR??"../reports-audit-focused";await mkdir(output,{recursive:true});
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const btn = (n) => page.getByRole("button", { name: n, exact: true });
  await page.goto("http://127.0.0.1:4319/?view=reports&role=admin&path=/laporan-pimpinan");
  await page
    .getByRole("heading", { name: "Rincian sumber", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: /Lihat rincian/ })
    .first()
    .click();
  await page.getByRole("dialog").waitFor();
  for (const size of [
    { width: 1440, height: 900 },
    { width: 768, height: 1024 },
    { width: 320, height: 740 },
    { width: 740, height: 320 },
  ]) {
    await page.setViewportSize(size);
    const b = await page.getByRole("dialog").boundingBox();
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
  await page.keyboard.press("Escape");
  for (const width of [280, 320, 375, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 800 });
    await page.waitForTimeout(80);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "overflow " + width,
    );
  }
  const download = page.waitForEvent("download");
  await btn("Unduh Excel").click();
  assert.match((await download).suggestedFilename(), /laporan-academic/);
  await btn("Honorarium").click();
  await page.getByText("Total honorarium", { exact: true }).waitFor();
  await page.getByLabel("Dasar perhitungan").selectOption("projection");
  await page.getByText("Total honorarium", { exact: true }).waitFor();
  await btn("Akademik").click();
  await page
    .getByRole("heading", { name: "Rincian sumber", exact: true })
    .waitFor();
  await page.getByLabel("Bulan", { exact: true }).fill("");
  await page.getByRole("alert").filter({hasText:"Pilih bulan laporan"}).waitFor();
  assert.equal(await btn("Unduh Excel").isDisabled(),true);
  await page.getByLabel("Bulan", { exact: true }).fill("2000-01");
  await page.getByText(/Belum ada catatan sesuai filter/).waitFor();
  await page.route("**/api/reports/read?**", async (route) => {
    const q = new URL(route.request().url()).searchParams;
    if (q.get("period") === "2001-01")
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          error: { code: "UNAVAILABLE", message: "Layanan sintetis gagal" },
        }),
      });
    if (q.get("period") === "2002-01")
      await new Promise((r) => setTimeout(r, 600));
    await route.continue();
  });
  await page.getByLabel("Bulan", { exact: true }).fill("2001-01");
  await page.getByRole("alert").waitFor();
  await page.getByLabel("Bulan", { exact: true }).fill("2002-01");
  await page.getByText("Memuat laporan…", { exact: true }).waitFor();
  await page.getByLabel("Bulan", { exact: true }).fill("2000-01");
  await page.getByText(/Belum ada catatan sesuai filter/).waitFor();
  await page.waitForTimeout(700);
  assert.equal(await page.getByRole("alert").count(), 0);
  assert.ok(
    (await page.locator("body").innerText()).includes("Periode 2000-01"),
  );
  await page.unroute("**/api/reports/read?**");
  await btn("Atur izin laporan").click();
  const d = page.getByRole("dialog");
  await d
    .getByLabel("Pengguna")
    .selectOption("22222222-2222-4222-8222-222222222222");
  await d.getByLabel("Laporan akademik").selectOption("true");
  await d.getByLabel("Laporan honorarium").selectOption("false");
  await d
    .getByLabel("Alasan (5–500 karakter)")
    .fill("Izin akademik sintetis untuk kepala madrasah");
  await d
    .getByRole("button", { name: "Atur izin laporan", exact: true })
    .click();
  await d.waitFor({ state: "hidden" });
  await page.goto("http://127.0.0.1:4319/?view=reports&role=guru&path=/laporan-pimpinan");
  await page
    .getByRole("heading", { name: "Rincian sumber", exact: true })
    .waitFor();
  assert.equal(await btn("Honorarium").count(), 0);
  assert.equal(
    await page.getByRole("heading", { name: "Izin pembaca laporan" }).count(),
    0,
  );
  await page.goto("http://127.0.0.1:4319/?view=reports&role=admin&path=/laporan-pimpinan");
  await btn("Atur izin laporan").click();
  await d
    .getByLabel("Pengguna")
    .selectOption("22222222-2222-4222-8222-222222222222");
  await d.getByLabel("Laporan akademik").selectOption("false");
  await d.getByLabel("Laporan honorarium").selectOption("false");
  await d
    .getByLabel("Alasan (5–500 karakter)")
    .fill("Pencabutan izin sintetis setelah pemeriksaan");
  await d
    .getByRole("button", { name: "Atur izin laporan", exact: true })
    .click();
  await d.waitFor({ state: "hidden" });
  await page.goto("http://127.0.0.1:4319/?view=reports&role=guru&path=/laporan-pimpinan");
  await page
    .getByRole("heading", { name: "Akses laporan belum diberikan" })
    .waitFor();

  const uid=n=>`55555555-5555-4555-8555-${String(n).padStart(12,"0")}`;
  let caps={admin:true,academic:true,finance:true},capBad=false,accessBad=false,readBad=false,wrongMode=false,delay=0,total=56,postMode="ok",postCount=0,lastPost,exports=0,exportFail=false,reportReads=0;
  let reader={id:uid(1),name:"Guru panjang "+"NamaTanpaSpasi".repeat(25),academic:true,finance:true,version:"7"};
  const ok=(r,data)=>r.fulfill({contentType:"application/json",body:JSON.stringify({ok:true,data})});
  await page.route("**/api/reports/read?**",async r=>{
    const q=new URL(r.request().url()).searchParams;
    if(q.get("kind")==="capabilities")return ok(r,capBad?{}:caps);
    if(q.get("kind")==="access")return ok(r,accessBad?{items:null}:{items:[reader]});
    reportReads++;
    if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
    const fin=q.get("kind")==="finance",count=fin?1:total,p=Number(q.get("page")),size=Number(q.get("pageSize"));
    const items=Array.from({length:Math.min(size,Math.max(0,count-(p-1)*size))},(_,n)=>fin?{id:uid(1),name:reader.name,jtm:"1",teaching:"9007199254740993",allowances:"0",transport:"0",corrections:"0",total:"9007199254740993",cutoff:q.get("period")+"-01"}:{id:uid((p-1)*size+n+1),name:reader.name,category:"ATTENDANCE",date:q.get("period")+"-01",user_id:uid(1),confirmed:true,documented:false});
    return ok(r,{kind:q.get("kind"),period:q.get("period"),teacher:q.get("teacher")||null,mode:fin?(wrongMode?"realized":q.get("mode")):"recorded",cutoff:q.get("period")+"-01",updatedAt:new Date().toISOString(),summary:readBad?{}:fin?{beneficiaries:1,jtm:"1",total:"9007199254740993"}:{kbm:0,confirmed:0,journals:0,exams:0,baps:0,attendance:count,present:count,complete:0},issues:["__proto__"],items,total:count,page:p,pageSize:size,teachers:[{id:uid(1),name:reader.name}]});
  });
  await page.route("**/api/reports/access",async r=>{
    postCount++;lastPost=r.request().postDataJSON();await new Promise(resolve=>setTimeout(resolve,350));
    if(postMode==="network")return r.abort();
    if(postMode==="conflict")return r.fulfill({status:409,contentType:"application/json",body:JSON.stringify({ok:false,error:{code:"VERSION_CONFLICT",message:"Izin telah berubah."}})});
    reader={...reader,academic:lastPost.academic,finance:lastPost.finance,version:String(Number(reader.version)+1)};
    return ok(r,postMode==="bad"?null:{ok:true});
  });
  await page.route("**/api/reports/excel?**",async r=>{exports++;await new Promise(resolve=>setTimeout(resolve,350));return exportFail?r.fulfill({status:503,contentType:"application/json",body:JSON.stringify({ok:false,error:{code:"UNAVAILABLE",message:"Ekspor sintetis gagal."}})}):r.fulfill({contentType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",body:Buffer.from("PK synthetic download guard")});});
  const ready=()=>page.getByRole("heading",{name:"Rincian sumber",exact:true}).waitFor();
  delay=600;await page.goto("http://127.0.0.1:4319/?view=reports&role=admin&path=/laporan-pimpinan");await page.getByText("Memuat laporan…",{exact:true}).waitFor();await ready();delay=0;
  assert.equal(await btn("Rincian catatan laporan").count(),0);
  for(const width of [280,320,375,768,1024,1440,1920]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));if(width===375||width===1440){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`${output}/academic-${width}.png`,fullPage:true});}}
  await page.setViewportSize({width:375,height:812});const zoom=await page.addStyleTag({content:"html{font-size:200%}"});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.getByRole("button",{name:/Lihat rincian/}).first().click();const zoomDialog=await page.getByRole("dialog").boundingBox();assert.ok(zoomDialog.x>=0&&zoomDialog.y>=0&&zoomDialog.x+zoomDialog.width<=376&&zoomDialog.y+zoomDialog.height<=813);await page.keyboard.press("Escape");await zoom.evaluate(el=>el.remove());
  const pager=page.getByRole("navigation",{name:"Halaman daftar",exact:true});
  await pager.getByRole("button",{name:"Berikutnya",exact:true}).click();await pager.getByText("Halaman 2 dari 3",{exact:false}).waitFor();await pager.getByRole("button",{name:"Berikutnya",exact:true}).click();await pager.getByText("Halaman 3 dari 3",{exact:false}).waitFor();total=0;await btn("Muat ulang").click();await pager.getByText("Halaman 1 dari 1",{exact:false}).waitFor();total=56;
  await btn("Honorarium").click();await page.getByText("Total honorarium",{exact:true}).waitFor();assert.ok(!(await page.locator("body").innerText()).includes("Rp Rp"));
  wrongMode=true;await page.getByLabel("Dasar perhitungan").selectOption("projection");await page.getByRole("alert").filter({hasText:"tidak sesuai filter"}).waitFor();assert.equal(await btn("Unduh Excel").isDisabled(),true);wrongMode=false;await btn("Muat ulang").click();await ready();
  readBad=true;await btn("Muat ulang").click();await page.getByRole("alert").filter({hasText:"Respons laporan belum sesuai"}).waitFor();assert.ok(!(await page.locator("body").innerText()).includes("undefined"));readBad=false;await btn("Muat ulang").click();await ready();
  exportFail=true;await btn("Unduh Excel").click();await page.getByRole("alert").filter({hasText:"Ekspor sintetis gagal"}).waitFor();assert.equal(await page.getByRole("heading",{name:"Rincian sumber",exact:true}).count(),1);exportFail=false;
  const before=exports,file=page.waitForEvent("download");await btn("Unduh Excel").evaluate(b=>{b.click();b.click();});await file;assert.equal(exports,before+1);
  await btn("Atur izin laporan").click();const modal=page.getByRole("dialog");await modal.getByLabel("Pengguna").selectOption(uid(1));assert.equal(await modal.getByLabel("Laporan akademik").inputValue(),"true");assert.equal(await modal.getByLabel("Laporan honorarium").inputValue(),"true");await modal.getByLabel("Laporan akademik").selectOption("false");await modal.getByLabel("Alasan (5–500 karakter)").fill("     ");await modal.getByRole("button",{name:"Atur izin laporan",exact:true}).click();await modal.getByRole("alert").filter({hasText:"Alasan perubahan"}).waitFor();assert.equal(postCount,0);await modal.getByLabel("Alasan (5–500 karakter)").fill("Ubah akademik tanpa mencabut honorarium");await modal.getByRole("button",{name:"Atur izin laporan",exact:true}).evaluate(b=>{b.click();b.click();});await modal.waitFor({state:"hidden"});assert.equal(postCount,1);assert.equal(lastPost.finance,true);assert.equal(lastPost.version,"7");
  for(const mode of ["conflict","bad","network"]){postMode=mode;await btn("Atur izin laporan").click();await modal.getByLabel("Pengguna").selectOption(uid(1));await modal.getByLabel("Alasan (5–500 karakter)").fill("Periksa status izin sintetis");await modal.getByRole("button",{name:"Atur izin laporan",exact:true}).click();await modal.getByRole("alert").waitFor();assert.equal(await modal.getByRole("button",{name:"Atur izin laporan",exact:true}).isDisabled(),true);await modal.getByRole("button",{name:"Tutup formulir",exact:true}).click();await page.getByRole("button",{name:"Buang perubahan",exact:true}).click();await modal.waitFor({state:"hidden"});assert.equal(await btn("Atur izin laporan").isDisabled(),true);await btn("Muat ulang izin").click();await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Atur izin laporan'&&!b.disabled));}postMode="ok";
  accessBad=true;await btn("Muat ulang izin").click();await page.getByRole("alert").filter({hasText:"Daftar izin belum sesuai"}).waitFor();assert.equal(await btn("Atur izin laporan").isDisabled(),true);accessBad=false;await btn("Muat ulang izin").click();
  await ready();await page.getByRole("button",{name:/Lihat rincian/}).first().click();await modal.waitFor();const beforeAccessCheck=reportReads;const checked=page.waitForResponse(r=>new URL(r.url()).searchParams.get("kind")==="capabilities");await page.evaluate(()=>window.dispatchEvent(new Event("focus")));await checked;await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));assert.equal(await modal.isVisible(),true);assert.equal(reportReads,beforeAccessCheck);caps={admin:false,academic:false,finance:false};await page.evaluate(()=>window.dispatchEvent(new Event("focus")));await page.getByRole("heading",{name:"Akses laporan belum diberikan",exact:true}).waitFor();await modal.waitFor({state:"hidden"});assert.equal(await page.getByRole("heading",{name:"Rincian sumber",exact:true}).count(),0);
  caps={admin:false,academic:false,finance:true};await btn("Periksa ulang akses").click();await ready();assert.equal(await btn("Akademik").count(),0);assert.equal(await page.getByRole("heading",{name:"Izin pembaca laporan",exact:true}).count(),0);
  capBad=true;await page.evaluate(()=>window.dispatchEvent(new Event("focus")));await page.getByRole("alert").filter({hasText:"Data izin laporan belum sesuai"}).waitFor();assert.equal(await page.getByRole("heading",{name:"Rincian sumber",exact:true}).count(),0);
  assert.deepEqual(errors, []);
  assert.equal(logs, "");
  console.log(
    JSON.stringify({
      passed: true,
      widths: 7,
      flows: [
        "academic",
        "finance",
        "projection",
        "detail",
        "excel",
        "empty",
        "grant-academic-only",
        "revoke",
        "responsive-modal", "blank-month", "56-row-pagination-shrink-to-zero", "strict-mode-and-summary", "download-failure-and-double-click", "preserve-reader-scopes-and-version", "conflict-malformed-network-write-lock", "invalid-readers", "stable-open-detail-on-access-refresh", "revoke-open-detail", "finance-only-and-invalid-capabilities",
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
