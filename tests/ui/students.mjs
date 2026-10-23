import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
const { chromium } = await import(
  process.env.UI_PLAYWRIGHT_MODULE ?? "playwright"
);
const child = spawn(
  process.execPath,
  ["--conditions=react-server", "--import", "tsx", "tests/ui/server.ts"],
  {
    env: { ...process.env, UI_STUDENT_FIXTURE: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let browser,
  logs = "";
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
    ...(process.env.UI_BROWSER_EXECUTABLE
      ? { executablePath: process.env.UI_BROWSER_EXECUTABLE }
      : {}),
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage({
    hasTouch: true,
    reducedMotion: "reduce",
    timezoneId: "America/Los_Angeles",
  });
  page.setDefaultTimeout(60000);
  const errors = [],
    consoleErrors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  const screenshots = process.env.UI_SCREENSHOT_DIR;
  if (screenshots) await mkdir(screenshots, { recursive: true });
  const admin = "11111111-1111-4111-8111-111111111111",
    guru = "22222222-2222-4222-8222-222222222222",
    period = "33333333-3333-4333-8333-333333333333";
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
  }).format(new Date());
  let role = "admin";
  const ready = () =>
    page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
  const go = async () => {
    await page.goto(
      "http://127.0.0.1:4319/?view=students&role=" +
        role +
        "&path=%2Fabsensi-siswa%2Finput",
    );
    await page
      .getByRole("heading", { name: "Rekap absensi siswa", exact: true })
      .waitFor();
    await ready();
  };
  const input = () =>
    page
      .getByRole("tab", { name: "Input dan Kelengkapan", exact: true })
      .click();
  const history = () =>
    page.getByRole("tab", { name: "Riwayat Absensi", exact: true }).click();
  const open = async () => {
    await page
      .getByRole("button", { name: "Rekap absensi siswa", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByLabel("Kelas", { exact: true })
      .waitFor();
    return page.getByRole("dialog");
  };
  const close = async () => {
    await page.keyboard.press("Escape");
    const discard = page.getByRole("button", {
      name: "Buang perubahan",
      exact: true,
    });
    if (await discard.isVisible()) await discard.click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
  };
  const overflow = async () =>
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
    );
  const reload = async () => {
    await page
      .getByRole("button", { name: "Muat ulang input", exact: true })
      .click();
    await ready();
  };
  // Real disposable DB: create and edit despite a history filter that excludes today.
  await go();
  let d = await open();
  await d.getByLabel("Kelas", { exact: true }).selectOption({ index: 1 });
  await d.getByLabel("Hadir", { exact: true }).fill("30");
  await d
    .getByLabel("Alasan pencatatan", { exact: true })
    .fill("Rekap harian sintetis");
  await d
    .getByRole("button", { name: "Simpan rekap siswa", exact: true })
    .click();
  await d.waitFor({ state: "hidden" });
  await ready();
  await page
    .getByText(
      "1 dari 1 kelas wajib sudah diisi. Rekap kelas tambahan tidak menggantikan kelas wajib.",
      { exact: true },
    )
    .waitFor();
  await history();
  await page.getByLabel("Riwayat mulai", { exact: true }).fill("2000-01-01");
  await page.getByLabel("Riwayat sampai", { exact: true }).fill("2000-01-01");
  await page
    .getByText("Belum ada rekap yang dapat ditampilkan.", { exact: true })
    .waitFor();
  await input();
  d = await open();
  await d.getByLabel("Kelas", { exact: true }).selectOption({ index: 1 });
  assert.equal(await d.getByLabel("Hadir", { exact: true }).inputValue(), "30");
  let sent;
  page.on("request", (req) => {
    if (req.url().endsWith("/api/activities/students-save"))
      sent = req.postDataJSON();
  });
  await d.getByLabel("Hadir", { exact: true }).fill("28");
  await d.getByLabel("Sakit", { exact: true }).fill("1");
  await d.getByLabel("Izin", { exact: true }).fill("1");
  await d
    .getByLabel("Alasan pencatatan", { exact: true })
    .fill("Koreksi rekap yang sudah ada");
  await d
    .getByRole("button", { name: "Simpan rekap siswa", exact: true })
    .click();
  await d.waitFor({ state: "hidden" });
  await ready();
  assert.equal(sent.version, "1");
  // Controlled API fixtures exercise large current-day sets, scoped history, and failure paths.
  const uuid = (i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
  let classes = Array.from({ length: 121 }, (_, i) => ({
    id: uuid(i + 1),
    name: "Kelas " + i,
    periodId: period,
    expectedStudents: 30,
  }));
  let rows = classes.map((c, i) => ({
    id: uuid(i + 1000),
    class_id: c.id,
    academic_period_id: period,
    date,
    hadir: 27,
    sakit: 1,
    izin: 1,
    alpa: 1,
    version: i === 120 ? "9" : "1",
    submitted_by: admin,
    className: c.name,
    submittedByName: "Admin sintetis",
  }));
  let canOperate = false,
    readMode = "ok",
    writeMode = "ok",
    writes = 0,
    heldStart,
    releaseWrite,
    started,
    hold,
    holdDate = "",
    heldReadStart,
    releaseRead,
    readStarted,
    scopeReads = 0,
    historyReads = 0;
  await page.route("**/api/day-context?*", (route) =>
    route.fulfill({
      json: {
        ok: true,
        data: {
          date: new URL(route.request().url()).searchParams.get("date"),
          academicPeriodId: period,
        },
      },
    }),
  );
  await page.route("**/api/activities/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      kind = url.pathname.split("/").at(-1),
      ok = (data) => route.fulfill({ json: { ok: true, data } });
    if (req.method() === "GET") {
      if (kind === "options")
        return ok({
          canOperate,
          classes: [
            ...classes,
            {
              id: uuid(900),
              name: "Periode lain",
              periodId: uuid(901),
              expectedStudents: 30,
            },
          ],
        });
      if (kind === "students-progress") {
        const required = classes.map((c) => ({
          ...c,
          complete: rows.some((r) => r.class_id === c.id),
        }));
        return ok({
          required,
          requiredCount: required.length,
          completedCount: required.filter((c) => c.complete).length,
          complete: required.every((c) => c.complete),
        });
      }
      if (kind === "students") {
        const isDaily = url.searchParams.get("pageSize") === "100";
        if (isDaily) scopeReads++;
        else historyReads++;
        const from = url.searchParams.get("from"),
          to = url.searchParams.get("to"),
          p = Number(url.searchParams.get("page")),
          size = Number(url.searchParams.get("pageSize"));
        let scoped = rows.filter(
          (r) =>
            r.date >= from &&
            r.date <= to &&
            (role === "admin" || r.submitted_by === guru),
        );
        const snapshot = structuredClone(
          scoped.slice((p - 1) * size, p * size),
        );
        if (isDaily && from === holdDate) {
          heldReadStart();
          await new Promise((r) => (releaseRead = r));
        }
        if (
          readMode === "all-error" ||
          (readMode === "daily-error" && isDaily) ||
          (readMode === "history-error" && !isDaily)
        )
          return route.fulfill({
            status: 503,
            json: {
              ok: false,
              error: { code: "UNAVAILABLE", message: "Rekap belum tersedia." },
            },
          });
        if (readMode === "invalid")
          return ok({ items: null, total: 0, page: p, pageSize: size });
        return ok({
          items: snapshot,
          total: scoped.length,
          page: p,
          pageSize: size,
        });
      }
    }
    writes++;
    const body = req.postDataJSON();
    if (writeMode === "held") {
      heldStart();
      await hold;
    }
    if (writeMode === "network") return route.abort("failed");
    if (writeMode === "conflict")
      return route.fulfill({
        status: 409,
        json: {
          ok: false,
          error: {
            code: "VERSION_CONFLICT",
            message: "Rekap berubah pada sesi lain.",
          },
        },
      });
    if (writeMode === "reject")
      return route.fulfill({
        status: 403,
        json: {
          ok: false,
          error: { code: "FORBIDDEN", message: "Hak pencatatan ditolak." },
        },
      });
    if (writeMode === "invalid") return ok({ id: null });
    const index = rows.findIndex(
        (r) => r.class_id === body.classId && r.date === body.date,
      ),
      klass = classes.find((c) => c.id === body.classId);
    const result = {
      id: index < 0 ? uuid(9999) : rows[index].id,
      class_id: body.classId,
      academic_period_id: period,
      date: body.date,
      hadir: body.hadir,
      sakit: body.sakit,
      izin: body.izin,
      alpa: body.alpa,
      version: index < 0 ? "1" : String(BigInt(rows[index].version) + 1n),
      submitted_by: role === "admin" ? admin : guru,
      className: klass.name,
      submittedByName: "Penginput sintetis",
    };
    if (index < 0) rows.push(result);
    else rows[index] = result;
    return ok({ id: result.id });
  });
  for (const width of [280, 320, 375, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 800 });
    await go();
    await overflow();
    const opener = page.getByRole("button", {
      name: "Rekap absensi siswa",
      exact: true,
    });
    if (width === 320) await opener.tap();
    else await opener.click();
    d = page.getByRole("dialog");
    await d.getByLabel("Kelas", { exact: true }).waitFor();
    assert.equal(
      await d
        .getByLabel("Kelas", { exact: true })
        .locator("option")
        .filter({ hasText: "Periode lain" })
        .count(),
      0,
    );
    assert.equal(
      await d.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return (
          r.left >= -1 &&
          r.right <= innerWidth + 1 &&
          r.top >= -1 &&
          r.bottom <= innerHeight + 1
        );
      }),
      true,
    );
    if (screenshots && [320, 1440].includes(width))
      await page.screenshot({
        path: screenshots + "/student-modal-" + width + ".png",
      });
    await close();
    await page.waitForFunction(
      () =>
        document.activeElement?.tagName === "BUTTON" &&
        document.activeElement.textContent?.trim() === "Rekap absensi siswa",
    );
    assert.equal(
      await opener.evaluate((el) => el === document.activeElement),
      true,
    );
    await history();
    await overflow();
    await input();
  }
  assert.equal(
    await page
      .locator("article")
      .filter({ has: page.getByRole("button", { name: /Periksa rekap/ }) })
      .count(),
    12,
  );
  await page
    .getByRole("button", { name: "Kelas berikutnya", exact: true })
    .click();
  await page
    .getByText("Kelengkapan halaman 2 dari 11", { exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Kelas sebelumnya", exact: true })
    .click();
  // Class 121 is beyond both the first history page and first daily batch.
  d = await open();
  await d.getByLabel("Kelas", { exact: true }).selectOption(classes[120].id);
  assert.equal(await d.getByLabel("Hadir", { exact: true }).inputValue(), "27");
  await d
    .getByLabel("Alasan pencatatan", { exact: true })
    .fill("Pembaruan kelas halaman berikutnya");
  await d
    .getByRole("button", { name: "Simpan rekap siswa", exact: true })
    .click();
  await d.waitFor({ state: "hidden" });
  await ready();
  assert.equal(sent.version, "9");
  assert.ok(scopeReads >= 2);
  // Blank, fractional and inconsistent counts never submit and never store NaN.
  d = await open();
  await d.getByLabel("Kelas", { exact: true }).selectOption(classes[0].id);
  await d
    .getByLabel("Alasan pencatatan", { exact: true })
    .fill("Pemeriksaan jumlah siswa");
  const before = writes;
  await d.getByLabel("Hadir", { exact: true }).fill("");
  await d
    .getByRole("button", { name: "Simpan rekap siswa", exact: true })
    .click();
  assert.equal(writes, before);
  await d.getByLabel("Hadir", { exact: true }).fill("1.5");
  await d
    .getByRole("button", { name: "Simpan rekap siswa", exact: true })
    .click();
  assert.equal(writes, before);
  await d.getByLabel("Hadir", { exact: true }).fill("25");
  await d
    .getByRole("button", { name: "Simpan rekap siswa", exact: true })
    .click();
  await d.getByRole("alert").waitFor();
  assert.equal(writes, before);
  assert.equal(
    await d.getByLabel("Hadir", { exact: true }).getAttribute("aria-invalid"),
    "true",
  );
  await d.getByLabel("Hadir", { exact: true }).fill("27");
  started = new Promise((r) => (heldStart = r));
  hold = new Promise((r) => (releaseWrite = r));
  writeMode = "held";
  await d
    .getByRole("button", { name: "Simpan rekap siswa", exact: true })
    .click();
  await started;
  await d.locator("form").evaluate((f) => {
    f.requestSubmit();
    f.requestSubmit();
  });
  await page.keyboard.press("Escape");
  assert.equal(await d.isVisible(), true);
  assert.equal(writes, before + 1);
  readMode = "daily-error";
  writeMode = "ok";
  releaseWrite();
  await d.waitFor({ state: "hidden" });
  await page
    .getByRole("status")
    .filter({ hasText: "Rekap absensi siswa berhasil disimpan" })
    .waitFor();
  await page.getByRole("alert").waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Rekap absensi siswa", exact: true })
      .count(),
    0,
  );
  readMode = "ok";
  await reload();
  for (const mode of ["conflict", "network", "invalid", "reject"]) {
    d = await open();
    await d.getByLabel("Kelas", { exact: true }).selectOption(classes[0].id);
    await d
      .getByLabel("Alasan pencatatan", { exact: true })
      .fill("Isian tidak boleh hilang");
    writeMode = mode;
    await d
      .getByRole("button", { name: "Simpan rekap siswa", exact: true })
      .click();
    await d.getByRole("alert").waitFor();
    assert.equal(
      await d.getByLabel("Alasan pencatatan", { exact: true }).inputValue(),
      "Isian tidak boleh hilang",
    );
    writeMode = "ok";
    if (mode === "reject") {
      assert.equal(
        await d
          .getByRole("button", { name: "Simpan rekap siswa", exact: true })
          .isEnabled(),
        true,
      );
      await close();
    } else {
      assert.equal(
        await d
          .getByRole("button", { name: "Simpan rekap siswa", exact: true })
          .isDisabled(),
        true,
      );
      await d
        .getByRole("button", {
          name: "Muat ulang dan periksa absensi",
          exact: true,
        })
        .click();
      await d.waitFor({ state: "hidden" });
      await ready();
    }
  }
  // Invalid/error history is independent from valid current-day input; history paging does not reload daily data.
  await history();
  const dailyBefore = scopeReads;
  await page.getByRole("button", { name: "Berikutnya", exact: true }).click();
  await page
    .getByText("Halaman 2 dari 5 · 121 catatan", { exact: true })
    .waitFor();
  assert.equal(scopeReads, dailyBefore);
  await page.getByLabel("Riwayat mulai", { exact: true }).fill("2099-01-01");
  await page.getByRole("alert").waitFor();
  await input();
  assert.equal(
    await page
      .getByRole("button", { name: "Rekap absensi siswa", exact: true })
      .isEnabled(),
    true,
  );
  readMode = "invalid";
  await reload();
  await page.getByRole("alert").waitFor();
  readMode = "ok";
  await reload();
  // Late daily responses and historical input cannot overwrite today's selection.
  const historyBefore = historyReads;
  holdDate = "2026-10-01";
  readStarted = new Promise((r) => (heldReadStart = r));
  await page
    .getByLabel("Tanggal kegiatan / input", { exact: true })
    .fill(holdDate);
  await readStarted;
  await page
    .getByLabel("Tanggal kegiatan / input", { exact: true })
    .fill("2026-10-02");
  await ready();
  releaseRead();
  holdDate = "";
  await page.waitForTimeout(100);
  assert.equal(
    await page
      .getByLabel("Tanggal kegiatan / input", { exact: true })
      .inputValue(),
    "2026-10-02",
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Rekap absensi siswa", exact: true })
      .isDisabled(),
    true,
  );
  await page.getByLabel("Tanggal kegiatan / input", { exact: true }).fill(date);
  await ready();
  assert.equal(historyReads, historyBefore);
  // Other submitters' rows remain private. A known completed class is not silently recreated.
  role = "guru";
  canOperate = false;
  await go();
  assert.equal(
    await page
      .getByRole("button", { name: "Rekap absensi siswa", exact: true })
      .count(),
    0,
  );
  canOperate = true;
  await reload();
  d = await open();
  await d.getByLabel("Kelas", { exact: true }).selectOption(classes[0].id);
  await d.getByText(/Rekap kelas ini sudah diisi oleh operator lain/).waitFor();
  assert.equal(
    await d
      .getByRole("button", { name: "Simpan rekap siswa", exact: true })
      .isDisabled(),
    true,
  );
  await close();
  rows = [];
  await reload();
  d = await open();
  await d.getByLabel("Kelas", { exact: true }).selectOption(classes[0].id);
  await d.getByLabel("Hadir", { exact: true }).fill("30");
  await d
    .getByLabel("Alasan pencatatan", { exact: true })
    .fill("Rekap guru piket sintetis");
  await d
    .getByRole("button", { name: "Simpan rekap siswa", exact: true })
    .click();
  await d.waitFor({ state: "hidden" });
  await ready();
  assert.equal(sent.version, "0");
  await page.setViewportSize({ width: 844, height: 390 });
  await overflow();
  await page.addStyleTag({ content: "html{font-size:32px}" });
  await overflow();
  await page.clock.install({ time: new Date(date + "T23:59:50+07:00") });
  await go();
  await page
    .getByRole("button", { name: "Rekap absensi siswa", exact: true })
    .waitFor();
  await page.clock.fastForward(40000);
  await page.getByText(/Tanggal ini hanya dapat ditinjau/).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Rekap absensi siswa", exact: true })
      .isDisabled(),
    true,
  );
  assert.deepEqual(errors, []);
  assert.equal(
    consoleErrors.some((e) => e.includes("NaN")),
    false,
  );
  console.log(
    "PASS: real DB create/edit with history excluding today; all 121 daily records/current versions; 7 widths, modal/touch/focus, scope/period/privacy, blank/fraction/total validation, duplicate submit/busy modal, read/write/network/conflict/malformed recovery, saved then failed refresh, independent history/pagination, date races, empty, landscape/200% text, WIB midnight; zero page errors/NaN warnings.",
  );
} finally {
  await browser?.close();
  child.kill("SIGTERM");
}
