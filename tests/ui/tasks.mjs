/** Stage 2 localhost fixtures only: task projection UI, inbox, preferences and write uncertainty. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
const { chromium } = await import(
  process.env.UI_PLAYWRIGHT_MODULE ?? "playwright"
);
const server = spawn(
  process.execPath,
  ["--conditions=react-server", "--import", "tsx", "tests/ui/server.ts"],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let browser,
  logs = "";
server.stderr.on("data", (v) => (logs += v));
const output = process.env.UI_REPORT_DIR ?? "../stage2-ui-focused";
await mkdir(output, { recursive: true });
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(Error(logs || "fixture timeout")),
      60000,
    );
    server.stdout.on("data", (v) => {
      if (v.toString().includes("UI_FIXTURE_READY")) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.on("exit", () => {
      clearTimeout(timer);
      reject(Error(logs));
    });
  });
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.UI_BROWSER_EXECUTABLE,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage({hasTouch:true});
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const uid = (n) => `44444444-4444-4444-8444-${String(n).padStart(12, "0")}`;
  const task = (n) => ({
    id: "journal:" + uid(n),
    source_id: uid(n),
    kind: "journal",
    title: "Lengkapi jurnal pembelajaran",
    reason:
      n % 2 ? "NO_ACTIVE_CONFIRMATION" : "Pembelajaran telah dikonfirmasi",
    date: "2090-01-02",
    deadline: "2090-01-03T00:00:00+07:00",
    href: "/jurnal?date=2090-01-02",
    blocked: Boolean(n % 2),
  });
  let items = Array.from({ length: 23 }, (_, n) => task(n + 1)),
    bad = false,
    fail = false,
    writes = 0,
    readWrites = 0,
    delay = 0,
    writeFail = false, readDelay = 0, reads = 0, wrongDate = false, network = false;
  let pref = { version: "0", emailEnabled: true, reminderEmail: true };
  let messages = Array.from({ length: 21 }, (_, n) => ({
    id: uid(n + 50),
    subject: "Pemberitahuan " + n,
    body: "Informasi panjang tanpa rahasia. ".repeat(15),
    state: n % 2 ? "pending" : "sent",
    created_at: "2090-01-02T09:00:00+07:00",
    read: false,
    href: "/tugas",
  }));
  const ok = (route, data) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data }),
    });
  await page.route("**/api/operations/**", async (route) => {
    const url = new URL(route.request().url()),
      kind = url.pathname.split("/").at(-1);
    if (kind === "tasks") {
      reads++;
      if (network) return route.abort();
      if (readDelay) await new Promise(resolve=>setTimeout(resolve,readDelay));
      return fail ? route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({ok:false,error:{code:"UNAVAILABLE",message:"Layanan sementara terganggu."},requestId:"11111111-1111-4111-8111-111111111111"})})
        : ok(route,bad?null:{date:wrongDate?"1999-01-01":await page.evaluate(()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta"}).format(new Date())),generatedAt:"2090-01-02T12:00:00+07:00",items});
    }
    if (kind === "inbox") {
      let rows = messages;
      if (url.searchParams.get("unread") === "true")
        rows = rows.filter((m) => !m.read);
      const p = Number(url.searchParams.get("page") ?? 1);
      return ok(route, {
        preferences: pref,
        total: rows.length,
        unread: messages.filter((m) => !m.read).length,
        items: rows.slice((p - 1) * 20, p * 20),
      });
    }
    if (delay) await new Promise((r) => setTimeout(r, delay));
    if (kind === "notification-preferences") {
      writes++;
      if (writeFail) return ok(route, null);
      pref = {
        ...route.request().postDataJSON(),
        version: String(Number(pref.version) + 1),
      };
      return ok(route, { saved: true });
    }
    if (kind === "notification-read") {
      readWrites++;
      messages = messages.map((m) =>
        m.id === route.request().postDataJSON().id ? { ...m, read: true } : m,
      );
      return ok(route, { read: true });
    }
    return route.continue();
  });
  const go = (view, role = "admin", extra = "") =>
    page.goto(
      `http://127.0.0.1:4319/?view=${view}&role=${role}&path=/${view === "tasks" ? "tugas" : "notifikasi"}${extra}`,
    );
  const overflow = async () => {
    await page.evaluate(
      () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        ),
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
  };
  for (const role of ["admin", "guru"])
    for (const width of [280, 320, 375, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await go("tasks", role);
      await page.getByRole("list", { name: "Daftar tugas aktif" }).waitFor();
      await overflow();
      assert.equal(
        await page
          .getByRole("link", { name: "Buka sumber tugas", exact: true })
          .first()
          .getAttribute("href"),
        "/jurnal?date=2090-01-02",
      );
      assert.equal(await page.getByRole("heading",{name:"Pusat tugas",exact:true}).count(),1);
      if(role==="admin"&&(width===375||width===1440)){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`${output}/tasks-${width}.png`,fullPage:true});}
      await go("inbox", role);
      await page.getByRole("region", { name: "Inbox notifikasi" }).waitFor();
      await overflow();
      if (role === "admin" && (width === 375 || width === 1440))
        await page.screenshot({
          path: `${output}/inbox-${width}.png`,
          fullPage: true,
        });
    }
  await go("tasks");
  await page.getByRole("list", { name: "Daftar tugas aktif" }).waitFor();
  await page.getByLabel("Status tugas").selectOption("blocked");
  assert.equal(
    await page
      .getByRole("link", { name: "Buka sumber tugas", exact: true })
      .count(),
    0,
  );
  await page.getByLabel("Status tugas").selectOption("all");
  await page
    .getByRole("navigation", { name: "Halaman pusat tugas" })
    .getByRole("button", { name: "Berikutnya" })
    .click();
  assert.equal(
    await page
      .getByRole("list", { name: "Daftar tugas aktif" })
      .locator("li")
      .count(),
    3,
  );
  // Search and type/status filters combine without changing server order or source links.
  await page.getByLabel("Cari tugas",{exact:true}).fill("  tidak ditemukan  ");
  await page.getByText("Tidak ada tugas pada tampilan ini",{exact:true}).waitFor();
  const resetTouch=page.getByRole("button",{name:"Hapus filter",exact:true});await resetTouch.scrollIntoViewIfNeeded();const touchBox=await resetTouch.boundingBox();assert.ok(touchBox.height>=44);await page.touchscreen.tap(touchBox.x+touchBox.width/2,touchBox.y+touchBox.height/2);
  await page.getByRole("list",{name:"Daftar tugas aktif"}).locator("li").first().waitFor();
  await page.getByLabel("Jenis tugas",{exact:true}).selectOption("bap");
  await page.getByText("Tidak ada tugas pada tampilan ini",{exact:true}).waitFor();
  await page.getByRole("button",{name:"Hapus filter",exact:true}).click();
  await page.getByLabel("Cari tugas",{exact:true}).fill("JURNAL PEMBELAJARAN");
  await page.getByLabel("Status tugas",{exact:true}).selectOption("ready");
  assert.equal(await page.getByRole("list",{name:"Daftar tugas aktif"}).locator("li").count(),11);
  await page.getByRole("button",{name:"Hapus filter",exact:true}).click();
  // A refreshed shorter dataset clamps stored page, even if later growth restores more pages.
  await page.getByRole("navigation",{name:"Halaman pusat tugas"}).getByRole("button",{name:"Berikutnya"}).click();
  items=[task(2)];await page.evaluate(()=>window.dispatchEvent(new Event("focus")));
  await page.getByRole("navigation",{name:"Halaman pusat tugas"}).getByText("Halaman 1 dari 1",{exact:false}).waitFor();
  items=Array.from({length:23},(_,n)=>task(n+1));await page.evaluate(()=>window.dispatchEvent(new Event("focus")));
  await page.getByRole("navigation",{name:"Halaman pusat tugas"}).getByText("Halaman 1 dari 2",{exact:false}).waitFor();
  // A slow refresh preserves cards, filter selection and coalesces focus/online bursts.
  await page.getByLabel("Status tugas",{exact:true}).selectOption("ready");readDelay=700;
  const before=reads;await page.evaluate(()=>{for(let n=0;n<4;n++){window.dispatchEvent(new Event("focus"));window.dispatchEvent(new Event("online"));}});
  await page.getByRole("status").filter({hasText:"Memperbarui tugas"}).waitFor();
  assert.equal(await page.getByRole("list",{name:"Daftar tugas aktif"}).locator("li").count(),11);
  await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Muat ulang tugas'))?.disabled);
  assert.equal(reads,before+1);assert.equal(await page.getByLabel("Status tugas",{exact:true}).inputValue(),"ready");readDelay=0;
  // Hidden tabs skip periodic/wake reads; returning to visible recovers once.
  const beforeHidden=reads;
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('online'));document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForTimeout(100);assert.equal(reads,beforeHidden);
  await page.evaluate(()=>{delete document.visibilityState;document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForTimeout(200);assert.equal(reads,beforeHidden+1);
  await page.getByRole("button",{name:"Hapus filter",exact:true}).click();
  items = [];
  await page.getByRole("button", { name: "Muat ulang tugas" }).click();
  await page
    .getByText("Tidak ada tugas pada tampilan ini", { exact: true })
    .waitFor();
  fail = true;
  await page.getByRole("button", { name: "Muat ulang tugas" }).click();
  await page.getByRole("alert").waitFor();
  assert.equal(
    await page
      .getByText("Tidak ada tugas pada tampilan ini", { exact: true })
      .count(),
    0,
  );
  fail = false;
  bad = true;
  await page.getByRole("button", { name: "Coba kembali" }).click();
  await page.getByRole("alert").waitFor();
  bad = false;
  items = [{ ...task(2), title: "JudulTanpaSpasi".repeat(35) }];
  await page.getByRole("button", { name: "Coba kembali" }).click();
  await page.getByRole("list", { name: "Daftar tugas aktif" }).waitFor();
  await overflow();
  // Large projection keeps at most 20 cards mounted and the final page stays bounded.
  items=Array.from({length:101},(_,n)=>task(n+1));await page.getByRole("button",{name:"Muat ulang tugas"}).click();
  const pager=page.getByRole("navigation",{name:"Halaman pusat tugas"});await pager.getByText("Halaman 1 dari 6",{exact:false}).waitFor();
  assert.equal(await page.getByRole("list",{name:"Daftar tugas aktif"}).locator("li").count(),20);
  for(let n=0;n<5;n++)await pager.getByRole("button",{name:"Berikutnya",exact:true}).click();
  await pager.getByText("Halaman 6 dari 6",{exact:false}).waitFor();assert.equal(await page.getByRole("list",{name:"Daftar tugas aktif"}).locator("li").count(),1);
  assert.equal(await page.getByRole("heading",{name:"Daftar tugas aktif",exact:true}).evaluate(el=>document.activeElement===el),true);
  items=[task(2)];await page.getByRole("button",{name:"Muat ulang tugas"}).click();await pager.getByText("Halaman 1 dari 1",{exact:false}).waitFor();
  // Invalid identity/link metadata cannot produce duplicate keys or route to the wrong day/module.
  for(const invalidItems of [[task(2),task(2)],[{...task(2),href:"/jurnal?date=2000-01-01"}],[{...task(2),href:"/admin/operasional"}]]) {
    items=invalidItems;await page.getByRole("button",{name:"Muat ulang tugas"}).click();await page.getByRole("alert").filter({hasText:"Data pusat tugas belum sesuai"}).waitFor();
    items=[task(2)];await page.getByRole("button",{name:"Coba kembali"}).click();await page.getByRole("list",{name:"Daftar tugas aktif"}).waitFor();
  }
  wrongDate=true;await page.getByRole("button",{name:"Muat ulang tugas"}).click();await page.getByRole("alert").filter({hasText:"Data pusat tugas belum sesuai"}).waitFor();wrongDate=false;
  network=true;await page.getByRole("button",{name:"Coba kembali"}).click();await page.getByRole("alert").filter({hasText:"Koneksi"}).waitFor();network=false;
  items=[{...task(2),kind:"confirmation",title:"Konfirmasi ujian",reason:"STUDENT_ATTENDANCE_MISMATCH",blocked:true,href:"/ujian?date=2090-01-02"}, {...task(4),deadline:"2000-01-01T00:00:00+07:00"}];
  await page.getByRole("button",{name:"Coba kembali"}).click();await page.getByText("Rekap absensi siswa untuk ujian belum lengkap",{exact:false}).waitFor();await page.getByText("Batas waktu terlewati",{exact:true}).waitFor();
  for(const size of [{width:844,height:390},{width:375,height:812}]){await page.setViewportSize(size);await overflow();}
  await page.addStyleTag({content:"html{font-size:200%}"});await overflow();
  await go("inbox");
  await page.getByRole("region", { name: "Inbox notifikasi" }).waitFor();
  await page.getByLabel("Email informasi kegiatan dan honorarium").uncheck();
  await page
    .getByRole("button", { name: "Tandai sudah dibaca", exact: true })
    .first()
    .click();
  await page
    .getByText("Notifikasi ditandai sudah dibaca.", { exact: true })
    .waitFor();
  await page.getByRole("region", { name: "Inbox notifikasi" }).waitFor();
  assert.equal(
    await page
      .getByLabel("Email informasi kegiatan dan honorarium")
      .isChecked(),
    false,
  );
  delay = 400;
  await page
    .getByRole("button", { name: "Simpan preferensi" })
    .evaluate((b) => {
      b.click();
      b.click();
    });
  await page
    .getByText("Preferensi notifikasi tersimpan.", { exact: true })
    .waitFor();
  assert.equal(writes, 1);
  assert.equal(readWrites, 1);
  delay = 0;
  await page.getByLabel("Hanya yang belum dibaca").check();
  await page.getByRole("region", { name: "Inbox notifikasi" }).waitFor();
  assert.equal(
    await page.getByRole("heading", { name: /Pemberitahuan 0/ }).count(),
    0,
  );
  await page.getByLabel("Email ringkasan pengingat tugas").uncheck();
  writeFail = true;
  await page.getByRole("button", { name: "Simpan preferensi" }).click();
  await page.getByRole("alert").waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Simpan preferensi" }).isDisabled(),
    true,
  );
  assert.equal(writes, 2);
  writeFail = false;
  await page.getByRole("button", { name: "Muat ulang notifikasi" }).click();
  await page.getByRole("button", { name: "Simpan preferensi" }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Simpan preferensi" }).isDisabled(),
    false,
  );
  // Real fixture API (no task interception) proves renderer accepts actual SQL projection envelope.
  await page.unroute("**/api/operations/**");
  await go("tasks", "guru");
  await page.getByRole("list", { name: "Daftar tugas aktif" }).waitFor();
  assert.equal(await page.getByRole("alert").count(), 0);
  // Initial delay, then a sleeping tab crossing midnight WIB; no reload and no stale-day error.
  await page.route("**/api/operations/tasks",async route=>{
    if(readDelay)await new Promise(r=>setTimeout(r,readDelay));
    return ok(route,{date:await page.evaluate(()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta"}).format(new Date())),generatedAt:new Date().toISOString(),items:[]});
  });
  readDelay=600;await go("tasks","guru");await page.getByRole("status").filter({hasText:"Memuat pusat tugas"}).waitFor();await page.getByText("Tidak ada tugas pada tampilan ini",{exact:true}).waitFor();readDelay=0;
  await page.clock.install({time:new Date("2026-10-25T16:59:59Z")});await go("tasks","guru");await page.getByText("Tidak ada tugas pada tampilan ini",{exact:true}).waitFor();
  await page.clock.setSystemTime(new Date("2026-10-25T17:01:00Z"));await page.evaluate(()=>window.dispatchEvent(new Event("online")));
  await page.getByText("Senin, 26 Oktober 2026 · WIB",{exact:false}).waitFor();await page.getByText("Tidak ada tugas pada tampilan ini",{exact:true}).waitFor();assert.equal(await page.getByRole("alert").count(),0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: 28 role/view/viewport cases, combined search/status/kind and reset; stable paging after shrink/growth; slow focus/online coalescing and hidden tabs; loading/date guard/duplicate IDs/wrong source link/network recovery; exam prerequisites/deadline; orientation/200% text/WIB rollover; task filters/pagination/empty/error/malformed/retry/source date, long text, inbox read isolation UI, preference draft retained, double submit, uncertain write lock/recovery and real SQL fixture response; zero page errors/document overflow.",
  );
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
