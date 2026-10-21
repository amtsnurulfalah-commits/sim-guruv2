/** UI only, disposable localhost fixtures. Browser dependencies are supplied externally. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const { chromium } = await import(
  process.env.UI_PLAYWRIGHT_MODULE ?? "playwright"
);
const child = spawn(
  process.execPath,
  ["--conditions=react-server", "--import", "tsx", "tests/ui/server.ts"],
  { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] },
);
let serverErrors = "";
child.stderr.on("data", (b) => {
  serverErrors += b;
});
let browser;
const output = resolve(process.env.UI_REPORT_DIR ?? "../ui-verification");
await mkdir(output, { recursive: true });
try {
  await new Promise((accept, reject) => {
    const timeout = setTimeout(
      () => reject(Error("UI_FIXTURE_START_TIMEOUT: " + serverErrors)),
      60000,
    );
    child.stdout.on("data", (b) => {
      if (b.toString().includes("UI_FIXTURE_READY")) {
        clearTimeout(timeout);
        accept();
      }
    });
    child.on("exit", (code) => {
      clearTimeout(timeout);
      reject(Error("UI_FIXTURE_EXIT " + code + " " + serverErrors));
    });
  });
  browser = await chromium.launch({
    headless: true,
    ...(process.env.UI_BROWSER_EXECUTABLE
      ? { executablePath: process.env.UI_BROWSER_EXECUTABLE }
      : {}),
    args: JSON.parse(
      process.env.UI_BROWSER_ARGS ??
        '["--no-sandbox","--disable-dev-shm-usage"]',
    ),
  });
  const page = await browser.newPage(),
    errors = [],
    consoleErrors = [],
    matrix = [],
    interactions = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  const adminViews = [
    "dashboard",
    "home",
    "guide",
    "login",
    "lab",
    "masters",
    "users",
    "calendar",
    "schedules",
    "occurrences",
    "attendance",
    "students",
    "journals",
    "duties",
    "exams",
    "events",
    "finance",
    "history",
    "financeOperations",
    "announcements",
    "operations",
    "migration",
  ];
  const guruViews = [
    "dashboard",
    "occurrences",
    "attendance",
    "students",
    "journals",
    "duties",
    "exams",
    "events",
    "finance",
    "history",
  ];
  async function go(view, role = "admin") {
    const paths = {
      masters: "/admin/master",
      users: "/admin/pengguna",
      calendar: "/admin/kalender",
      schedules: "/jadwal",
      occurrences: "/kegiatan",
      attendance: "/kehadiran",
      students: "/absensi-siswa/input",
      journals: "/jurnal",
      duties: "/piket",
      exams: "/ujian",
      events: "/acara",
      finance: "/honorarium",
      history: "/honorarium/riwayat",
      financeOperations: "/admin/honorarium/operasi",
      announcements: "/admin/pengumuman",
      operations: "/admin/operasional",
      migration: "/admin/migrasi",
      home: "/",
      guide: "/kesiapan",
      login: "/login",
    };
    await page.goto(
      `http://127.0.0.1:4319/?view=${view}&role=${role}&path=${encodeURIComponent(paths[view] ?? "/dashboard")}`,
    );
    await page.waitForLoadState("networkidle");
  }
  if (!process.env.UI_INTERACTIONS_ONLY)
    for (const width of [320, 375, 767, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      for (const role of ["admin", "guru"])
        for (const view of role === "admin" ? adminViews : guruViews) {
          await go(view, role);
          const result = await page.evaluate(() => ({
            width: innerWidth,
            scroll: document.documentElement.scrollWidth,
            alerts: [...document.querySelectorAll("[role=alert]")]
              .filter((e) => e.getClientRects().length)
              .map((e) => e.textContent.trim())
              .filter(Boolean),
          }));
          matrix.push({ view, role, ...result });
          assert.ok(
            result.scroll <= width + 1,
            `OVERFLOW ${view} ${role} ${width}: ${result.scroll}`,
          );
          assert.deepEqual(
            result.alerts,
            [],
            `UNEXPECTED_ALERT ${view} ${role}: ${result.alerts.join(" ")}`,
          );
          if (role === "guru")
            assert.equal(
              await page
                .getByRole("link", { name: "Manajemen pengguna", exact: true })
                .count(),
              0,
            );
        }
    }
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await go("lab");
    const trigger = page.getByRole("button", {
      name: "Simpan contoh",
      exact: true,
    });
    await trigger.click();
    let dialog = page.getByRole("dialog", {
      name: "Simpan contoh",
      exact: true,
    });
    await dialog.waitFor();
    assert.ok(await dialog.locator(":focus").count());
    const bounds = await dialog.boundingBox();
    assert.ok(
      bounds.x >= 0 &&
        bounds.x + bounds.width <= width + 1 &&
        bounds.height <= 900,
    );
    await dialog.getByLabel("Nama", { exact: false }).fill("gagal");
    await dialog
      .getByLabel("Alasan", { exact: false })
      .fill("Alasan pengujian sintetis");
    await dialog.getByLabel("Senin", { exact: true }).check();
    await dialog
      .getByRole("button", { name: "Simpan contoh", exact: true })
      .click();
    await dialog
      .getByRole("alert")
      .filter({ hasText: "Penyimpanan ditolak" })
      .waitFor();
    assert.equal(await dialog.isVisible(), true);
    await dialog.getByRole("button", { name: "Batal", exact: true }).click();
    const discard = page.getByRole("alertdialog");
    await discard.waitFor();
    for (let n = 0; n < 4; n++) {
      await page.keyboard.press("Tab");
      assert.equal(await discard.locator(":focus").count(), 1);
    }
    await discard.getByRole("button", { name: "Lanjutkan mengisi" }).click();
    assert.equal(
      await dialog.getByLabel("Nama", { exact: false }).inputValue(),
      "gagal",
    );
    await dialog.getByLabel("Nama", { exact: false }).fill("berhasil");
    const save = dialog.getByRole("button", {
      name: "Simpan contoh",
      exact: true,
    });
    await save.evaluate((button) => {
      button.form.requestSubmit();
      button.form.requestSubmit();
    });
    await page.keyboard.press("Escape");
    assert.equal(await dialog.isVisible(), true);
    await dialog.waitFor({ state: "hidden" });
    await page.getByText("Jumlah penyimpanan: 1", { exact: true }).waitFor();
    assert.equal(
      await trigger.evaluate((e) => e === document.activeElement),
      true,
    );
    await trigger.click();
    dialog = page.getByRole("dialog", { name: "Simpan contoh", exact: true });
    await dialog.getByLabel("Nama", { exact: false }).fill("belum disimpan");
    await page.keyboard.press("Escape");
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Buang perubahan", exact: true })
      .click();
    await dialog.waitFor({ state: "hidden" });
    await page
      .getByRole("button", { name: "Buka editor native", exact: true })
      .click();
    const native = page.getByRole("dialog", {
      name: "Editor native",
      exact: true,
    });
    await native.getByLabel("Nama native").fill("belum tersimpan");
    await native.getByRole("button", { name: "Tutup editor" }).click();
    const nativeDiscard = page.getByRole("dialog", {
      name: "Buang perubahan?",
      exact: true,
    });
    await nativeDiscard.waitFor();
    await nativeDiscard
      .getByRole("button", { name: "Lanjutkan mengisi" })
      .click();
    assert.equal(await native.isVisible(), true);
    await native.getByRole("button", { name: "Simpan native" }).click();
    await native.waitFor({ state: "hidden" });
    if (width < 1024) {
      await page.getByRole("button", { name: "Buka navigasi" }).click();
      const navigation = page.getByRole("dialog", {
        name: "Navigasi SiM-Guru",
      });
      await navigation.waitFor();
      await page.keyboard.press("Escape");
      await navigation.waitFor({ state: "hidden" });
    } else {
      await page.getByRole("button", { name: "Ciutkan sidebar" }).click();
      await page.getByRole("button", { name: "Perluas sidebar" }).waitFor();
    }
    interactions.push({
      width,
      focus: true,
      failedSubmission: true,
      dirtyClose: true,
      checkboxes: true,
      nativeEditor: true,
      navigation: true,
    });
  }
  await go("lab");
  await page
    .getByRole("button", { name: "Ganti kata sandi", exact: true })
    .click();
  const accountDialog = page.getByRole("dialog", {
    name: "Ganti kata sandi",
    exact: true,
  });
  const accountInput = accountDialog.getByLabel("Input akun sintetis", {
    exact: true,
  });
  await accountInput.fill("Synthetic9!account");
  await accountDialog
    .getByRole("button", { name: "Tampilkan isian rahasia", exact: true })
    .click();
  assert.equal(await accountInput.inputValue(), "Synthetic9!account");
  await accountDialog
    .getByRole("button", { name: "Sembunyikan isian rahasia", exact: true })
    .click();
  assert.equal(await accountInput.getAttribute("type"), "password");
  await accountDialog.locator("form").evaluate((form) => {
    form.requestSubmit();
    form.requestSubmit();
  });
  await accountDialog.waitFor({ state: "hidden" });
  assert.equal(
    await page.getByText("Jumlah aksi akun: 1", { exact: true }).count(),
    1,
  );
  await page.waitForTimeout(250);
  assert.equal(
    await page.getByText("Jumlah aksi akun: 2", { exact: true }).count(),
    0,
  );
  interactions.push({
    regression: "account-synchronous-double-submit",
    passed: true,
  });

  const batches = ["A", "B"].map((name) => ({
    id: name,
    source: "Batch " + name,
    state: "staged",
    version: "1",
    gates: [],
    summary: { rows: 1, errors: 0, review: 1, redactedFields: 0 },
  }));
  await page.route("**/api/migration/board*", async (route) => {
    const id = new URL(route.request().url()).searchParams.get("id");
    if (id === "B") {
      await route.fulfill({
        status: 503,
        json: { ok: false, error: { message: "Laporan B gagal dimuat" } },
      });
    } else {
      await route.fulfill({
        json: {
          ok: true,
          data: id
            ? {
                mappedRows: 7,
                counts: {},
                issues: [
                  {
                    sequence: 1,
                    code: "TEMUAN_KHUSUS_A",
                    source_table: "Fixture",
                    row_number: 1,
                    field: null,
                    severity: "review",
                    resolution: null,
                  },
                ],
              }
            : { batches },
        },
      });
    }
  });
  await go("migration");
  const batchA = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Batch A", exact: true }),
  });
  const batchB = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Batch B", exact: true }),
  });
  await batchA
    .getByRole("button", { name: "Periksa temuan dan bukti" })
    .click();
  await batchA.getByText(/TEMUAN_KHUSUS_A/).waitFor();
  const beforeExpected503 = consoleErrors.length;
  await batchB
    .getByRole("button", { name: "Periksa temuan dan bukti" })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Laporan B gagal dimuat" })
    .waitFor();
  const expectedNetworkErrors = consoleErrors.splice(beforeExpected503);
  assert.deepEqual(expectedNetworkErrors, [
    "Failed to load resource: the server responded with a status of 503 (Service Unavailable)",
  ]);
  assert.equal(await batchB.getByText(/TEMUAN_KHUSUS_A/).count(), 0);
  assert.equal(await batchA.getByText(/TEMUAN_KHUSUS_A/).count(), 1);
  interactions.push({
    regression: "migration-report-batch-binding",
    passed: true,
  });
  await page.unroute("**/api/migration/board*");

  // Pro Max adaptation: observable interaction outcomes, not snapshots of class names.
  await page.setViewportSize({ width: 1440, height: 900 });
  await go("login");
  const password = page.getByLabel("Kata sandi", { exact: true });
  await password.fill("Synthetic9!password");
  await page
    .getByRole("button", { name: "Tampilkan isian rahasia", exact: true })
    .click();
  assert.equal(await password.getAttribute("type"), "text");
  assert.equal(await password.inputValue(), "Synthetic9!password");
  await page
    .getByRole("button", { name: "Sembunyikan isian rahasia", exact: true })
    .click();
  assert.equal(await password.getAttribute("type"), "password");
  assert.equal(await password.getAttribute("autocomplete"), "current-password");
  interactions.push({ proMax: "password-visibility", passed: true });

  for (const role of ["admin", "guru"]) {
    await go("lab", role);
    const expand = page.getByRole("button", {
      name: "Perluas sidebar",
      exact: true,
    });
    if (await expand.count()) await expand.click();
    const sidebar = page.getByRole("complementary", {
      name: "Sidebar desktop",
    });
    const search = sidebar.getByRole("searchbox", { name: "Cari menu" });
    await search.fill("honor");
    assert.equal(
      await sidebar.getByRole("link", { name: /Honorarium/ }).count(),
      1,
    );
    await search.fill("zzzzzzz");
    assert.equal(
      await sidebar.getByRole("navigation").getByRole("link").count(),
      0,
    );
    await sidebar.getByRole("button", { name: "Hapus pencarian" }).click();
    assert.ok(
      await sidebar
        .getByRole("link", { name: "Dashboard", exact: true })
        .count(),
    );
    if (role === "guru") {
      await search.fill("pengguna");
      assert.equal(
        await sidebar.getByRole("navigation").getByRole("link").count(),
        0,
      );
    }
  }
  interactions.push({ proMax: "role-scoped-menu-search", passed: true });
  await go("lab");
  await page
    .getByRole("button", { name: "Simpan contoh", exact: true })
    .click();
  const validationDialog = page.getByRole("dialog", {
    name: "Simpan contoh",
    exact: true,
  });
  await validationDialog
    .getByRole("button", { name: "Simpan contoh", exact: true })
    .click();
  const validationSummary = validationDialog.getByRole("alert");
  await validationSummary.waitFor();
  await page.waitForFunction(
    () => document.activeElement?.getAttribute("role") === "alert",
  );
  assert.equal(
    await validationDialog.locator("input[aria-invalid=true]").count(),
    2,
  );
  await validationSummary.getByRole("link", { name: /^Nama:/ }).click();
  assert.equal(
    await validationDialog
      .getByLabel("Nama", { exact: false })
      .evaluate((e) => e === document.activeElement),
    true,
  );
  await validationDialog
    .getByLabel("Nama", { exact: false })
    .fill("Validasi sintetis");
  await validationDialog.getByLabel("Alasan", { exact: false }).fill("x");
  await validationDialog
    .getByRole("button", { name: "Simpan contoh", exact: true })
    .click();
  await validationSummary.getByRole("link", { name: /^Alasan:/ }).waitFor();
  const reason = validationDialog.getByLabel("Alasan", { exact: false });
  assert.ok(await reason.getAttribute("aria-describedby"));
  await reason.fill("Pengujian validasi sintetis");
  await validationDialog
    .getByRole("button", { name: "Simpan contoh", exact: true })
    .click();
  await validationDialog.waitFor({ state: "hidden" });
  interactions.push({ proMax: "linked-field-errors-and-focus", passed: true });

  await page.setViewportSize({ width: 320, height: 850 });
  await go("masters");
  await page
    .getByRole("button", { name: "Mata pelajaran", exact: true })
    .click();
  const tableRegion = page.getByRole("region", {
    name: "Data master",
    exact: true,
  });
  await tableRegion.waitFor();
  await page.waitForFunction(
    () =>
      document.querySelector(".ui-table-region")?.getAttribute("tabindex") ===
      "0",
  );
  await tableRegion.focus();
  const scrollBefore = await tableRegion.evaluate((e) => e.scrollLeft);
  for (let index = 0; index < 8; index++)
    await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(150);
  assert.ok((await tableRegion.evaluate((e) => e.scrollLeft)) > scrollBefore);
  interactions.push({ proMax: "keyboard-table-scroll", passed: true });

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 812, height: 375 });
  await go("lab");
  await page
    .getByRole("button", { name: "Simpan contoh", exact: true })
    .click();
  const landscape = page.getByRole("dialog", {
    name: "Simpan contoh",
    exact: true,
  });
  const landscapeBounds = await landscape.boundingBox();
  assert.ok(landscapeBounds.y >= 0 && landscapeBounds.height <= 375);
  assert.ok(
    await landscape.evaluate(
      (e) => parseFloat(getComputedStyle(e).animationDuration) <= 0.001,
    ),
  );
  await page.keyboard.press("Escape");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  interactions.push({ proMax: "landscape-reduced-motion", passed: true });

  for (const view of ["login", "dashboard", "masters"]) {
    await page.setViewportSize({ width: 375, height: 850 });
    await go(view);
    await page.addStyleTag({ content: "html {font-size: 200% !important;}" });
    await page.waitForTimeout(100);
    const textScale = await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
      elements: [...document.querySelectorAll("body *")]
        .filter((element) => {
          const box = element.getBoundingClientRect();
          return box.width > innerWidth || box.right > innerWidth + 1;
        })
        .map((element) => ({
          tag: element.tagName,
          className: element.className,
          text: element.textContent?.slice(0, 80),
          width: element.getBoundingClientRect().width,
          right: element.getBoundingClientRect().right,
        }))
        .slice(0, 20),
    }));
    assert.ok(
      textScale.scroll <= textScale.width + 1,
      "TEXT_SCALE_OVERFLOW " + view + " " + JSON.stringify(textScale),
    );
  }
  interactions.push({ proMax: "text-scale-200-percent", passed: true });

  const touchPage = await browser.newPage({
    viewport: { width: 375, height: 812 },
    hasTouch: true,
    isMobile: true,
  });
  touchPage.on("pageerror", (error) => errors.push(error.message));
  touchPage.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await touchPage.goto("http://127.0.0.1:4319/?view=lab&role=guru");
  await touchPage
    .getByRole("button", { name: "Buka navigasi", exact: true })
    .tap();
  const touchDrawer = touchPage.getByRole("dialog", {
    name: "Navigasi SiM-Guru",
    exact: true,
  });
  await touchDrawer
    .getByRole("searchbox", { name: "Cari menu" })
    .fill("jurnal");
  assert.ok(await touchDrawer.getByRole("link", { name: /Jurnal/ }).count());
  await touchDrawer
    .getByRole("button", { name: "Tutup navigasi", exact: true })
    .tap();
  await touchDrawer.waitFor({ state: "hidden" });
  await touchPage.close();
  interactions.push({ proMax: "touch-navigation", passed: true });

  await page.setViewportSize({ width: 1024, height: 900 });
  await go("masters");
  await page
    .getByRole("button", { name: "Mata pelajaran", exact: true })
    .click();
  await page.waitForLoadState("networkidle");
  await page
    .getByRole("button", { name: "Tambah mata pelajaran", exact: true })
    .click();
  let editor = page.getByRole("dialog", {
    name: "Tambah Mata pelajaran",
    exact: true,
  });
  await editor
    .getByLabel("Nama mata pelajaran", { exact: true })
    .fill("Subjek CRUD sintetis");
  await editor
    .getByLabel("Alasan perubahan", { exact: false })
    .fill("Pengujian CRUD antarmuka");
  await editor.getByRole("button", { name: "Simpan data" }).click();
  await editor.waitFor({ state: "hidden" });
  let row = page.getByRole("row").filter({ hasText: "Subjek CRUD sintetis" });
  await row.waitFor();
  await row.getByRole("button", { name: "Ubah data", exact: true }).click();
  editor = page.getByRole("dialog", {
    name: "Ubah Mata pelajaran",
    exact: true,
  });
  await editor
    .getByLabel("Nama mata pelajaran", { exact: true })
    .fill("Subjek CRUD diperbarui");
  await editor
    .getByLabel("Alasan perubahan", { exact: false })
    .fill("Pembaruan CRUD sintetis");
  await editor.getByRole("button", { name: "Simpan data" }).click();
  await editor.waitFor({ state: "hidden" });
  row = page.getByRole("row").filter({ hasText: "Subjek CRUD diperbarui" });
  await row.waitFor();
  await row.getByRole("button", { name: "Arsipkan", exact: true }).click();
  const archive = page.getByRole("dialog", {
    name: "Arsipkan Subjek CRUD diperbarui?",
    exact: true,
  });
  await archive
    .getByLabel("Alasan pengarsipan")
    .fill("Arsip data pengujian sintetis");
  await archive.getByRole("button", { name: "Arsipkan data" }).click();
  await archive.waitFor({ state: "hidden" });
  await row.waitFor({ state: "hidden" });
  interactions.push({
    crud: "master-subject",
    create: true,
    update: true,
    archive: true,
  });
  // Opening a form must not be mistaken for committing data.
  await go("lab");
  await page
    .getByRole("button", { name: "Tambah catatan uji", exact: true })
    .click();
  const noteDialog = page.getByRole("dialog", {
    name: "Tambah catatan uji",
    exact: true,
  });
  await noteDialog.waitFor();
  assert.equal(
    await page
      .getByRole("status", { includeHidden: true })
      .filter({ hasText: "Jumlah penyimpanan: 0" })
      .count(),
    1,
  );
  await noteDialog
    .getByLabel("Catatan uji", { exact: false })
    .fill("Catatan sintetis");
  await noteDialog
    .getByRole("button", { name: "Simpan catatan uji", exact: true })
    .click();
  await noteDialog.waitFor({ state: "hidden" });
  assert.equal(
    await page
      .getByRole("status")
      .filter({ hasText: "Jumlah penyimpanan: 1" })
      .count(),
    1,
  );
  interactions.push({
    scenario: "distinct-form-trigger-submit",
    openingDoesNotSave: true,
    saveCount: 1,
  });
  // A previously selected attendance row can reopen its leave editor.
  await go("attendance");
  const leaveAction = page
    .getByRole("button", { name: "Ajukan izin keluar", exact: true })
    .first();
  assert.ok(
    await leaveAction.count(),
    "attendance fixture must contain a leave action",
  );
  for (let repeat = 0; repeat < 2; repeat++) {
    await leaveAction.click();
    const leaveDialog = page.getByRole("dialog", {
      name: "Izin keluar sementara",
      exact: true,
    });
    await leaveDialog.waitFor();
    await page.keyboard.press("Escape");
    await leaveDialog.waitFor({ state: "hidden" });
  }
  interactions.push({ scenario: "reopen-same-attendance-leave", openings: 2 });
  await go("guide");
  assert.equal(
    await page
      .getByRole("heading", { name: "Panduan aplikasi", exact: true })
      .count(),
    1,
  );
  assert.equal(
    await page
      .getByRole("link", { name: "Buka pemulihan akun", exact: true })
      .getAttribute("href"),
    "/lupa-password",
  );
  assert.doesNotMatch(
    await page.locator("main").innerText(),
    /Status pengembangan|Tahap \d|worker|scheduler/i,
  );
  interactions.push({
    scenario: "public-user-guide",
    recoveryRoute: true,
    developmentCopyAbsent: true,
  });
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await go("operations");
    assert.equal(
      await page
        .getByRole("definition")
        .filter({ hasText: "Nonaktif" })
        .count(),
      3,
    );
    await page
      .getByRole("button", { name: "Atur operasional aplikasi", exact: true })
      .click();
    const settings = page.getByRole("dialog", {
      name: "Atur operasional aplikasi",
      exact: true,
    });
    await settings.waitFor();
    assert.equal(
      await settings
        .getByRole("button", {
          name: "Simpan pengaturan operasional",
          exact: true,
        })
        .count(),
      1,
    );
    await page.keyboard.press("Escape");
    await settings.waitFor({ state: "hidden" });
    for (const view of [
      "attendance",
      "financeOperations",
      "masters",
      "guide",
    ]) {
      await go(view);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        view + " final copy overflow",
      );
      assert.equal(await page.getByRole("alert").count(), 0);
    }
    await go("financeOperations");
    await page
      .getByRole("button", { name: "Atur honorarium hari libur", exact: true })
      .click();
    const holiday = page.getByRole("dialog", {
      name: "Atur honorarium hari libur",
      exact: true,
    });
    await holiday.waitFor();
    assert.equal(
      await holiday
        .getByRole("button", {
          name: "Jalankan tindakan hari libur",
          exact: true,
        })
        .count(),
      1,
    );
    await page.keyboard.press("Escape");
    await holiday.waitFor({ state: "hidden" });
  }
  interactions.push({
    scenario: "final-operational-and-copy-review",
    viewports: [320, 1440],
    inactiveFlagsVisible: true,
    distinctSettingsSubmit: true,
    holidayActionLabel: true,
    changedViewsDoNotOverflow: true,
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(consoleErrors, []);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await go("masters");
  if (await page.getByRole("button", { name: "Perluas sidebar" }).count())
    await page.getByRole("button", { name: "Perluas sidebar" }).click();
  await page.screenshot({
    path: resolve(output, "master-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 375, height: 850 });
  await go("lab");
  await page
    .getByRole("button", { name: "Simpan contoh", exact: true })
    .click();
  await page.screenshot({
    path: resolve(output, "modal-mobile.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await go("login");
  await page.screenshot({
    path: resolve(output, "login-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });
  await go("dashboard");
  await page.screenshot({
    path: resolve(output, "dashboard-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });
  const result = {
    fixture: true,
    realProductionCredentials: false,
    matrix,
    interactions,
    pageErrors: errors,
    consoleErrors,
    serverErrors,
  };
  await writeFile(
    resolve(output, "results.json"),
    JSON.stringify(result, null, 2),
  );
  console.log(
    JSON.stringify({
      matrix: matrix.length,
      interactionWidths: interactions.filter((x) => typeof x.width === "number")
        .length,
      crudScenarios: interactions.filter((x) => x.crud).length,
      pageErrors: errors.length,
      consoleErrors: consoleErrors.length,
      result: "passed",
    }),
  );
} finally {
  await browser?.close();
  child.kill("SIGTERM");
}
