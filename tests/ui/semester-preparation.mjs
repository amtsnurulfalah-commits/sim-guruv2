import assert from "node:assert/strict";
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
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const btn = (n) => page.getByRole("button", { name: n, exact: true });
  const dialog = () => page.getByRole("dialog");
  await page.goto("http://127.0.0.1:4319/?view=semesterPreparation&role=admin");
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
  await page.goto("http://127.0.0.1:4319/?view=semesterPreparation&role=guru");
  await page.getByRole("alert").waitFor();
  assert.equal(
    await page.getByRole("heading", { name: "Pratinjau konfigurasi" }).count(),
    0,
  );
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
        "guru-denied",
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
