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
    "home",
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
      login: "/login",
    };
    await page.goto(
      `http://127.0.0.1:4319/?view=${view}&role=${role}&path=${encodeURIComponent(paths[view] ?? "/dashboard")}`,
    );
    await page.waitForLoadState("networkidle");
  }
  if (!process.env.UI_INTERACTIONS_ONLY)
    for (const width of [320, 375, 767, 768, 1024, 1440]) {
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
  await editor
    .getByRole("button", { name: "Simpan dan catat perubahan" })
    .click();
  await editor.waitFor({ state: "hidden" });
  let row = page.getByRole("row").filter({ hasText: "Subjek CRUD sintetis" });
  await row.waitFor();
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  editor = page.getByRole("dialog", {
    name: "Edit Mata pelajaran",
    exact: true,
  });
  await editor
    .getByLabel("Nama mata pelajaran", { exact: true })
    .fill("Subjek CRUD diperbarui");
  await editor
    .getByLabel("Alasan perubahan", { exact: false })
    .fill("Pembaruan CRUD sintetis");
  await editor
    .getByRole("button", { name: "Simpan dan catat perubahan" })
    .click();
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
  await archive.getByRole("button", { name: "Ya, arsipkan" }).click();
  await archive.waitFor({ state: "hidden" });
  await row.waitFor({ state: "hidden" });
  interactions.push({
    crud: "master-subject",
    create: true,
    update: true,
    archive: true,
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
