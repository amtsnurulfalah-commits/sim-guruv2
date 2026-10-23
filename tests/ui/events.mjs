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
    env: { ...process.env, UI_EVENT_FIXTURE: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let page;
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
  page = await browser.newPage({
    hasTouch: true,
    reducedMotion: "reduce",
    timezoneId: "America/Los_Angeles",
  });
  page.setDefaultTimeout(20000);
  const errors = [],
    consoleErrors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (
      m.type() === "error" &&
      !/Failed to load resource: the server responded with a status of (422|503)/.test(
        m.text(),
      )
    )
      consoleErrors.push(m.text());
  });
  const screenshots = process.env.UI_SCREENSHOT_DIR;
  if (screenshots) await mkdir(screenshots, { recursive: true });
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
  }).format(new Date());
  await page.clock.install({ time: new Date(date + "T12:00:00+07:00") });
  const ready = () =>
    page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
  const go = async (role = "admin") => {
    await page.goto(
      "http://127.0.0.1:4319/?view=events&role=" + role + "&path=%2Facara",
    );
    await page
      .getByRole("heading", { name: "Kehadiran dan jurnal acara", exact: true })
      .waitFor();
    await ready();
  };
  const close = async () => {
    await ready();
    await page.keyboard.press("Escape");
    const discard = page.getByRole("button", {
      name: "Buang perubahan",
      exact: true,
    });
    await discard.waitFor({ state: "visible", timeout: 1000 }).catch(() => {});
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
  await go();
  const btn = (name) => page.getByRole("button", { name, exact: true });
  const dialog = () => page.getByRole("dialog");
  const reason = () =>
    dialog()
      .getByLabel("Alasan perubahan (5–500 karakter)")
      .fill("Pengujian kegiatan sintetis");
  const submit = async (name) => {
    await dialog().getByRole("button", { name, exact: true }).click();
    await dialog().waitFor({ state: "hidden" });
    await ready();
  };
  await btn("Tambah acara").click();
  await dialog().getByLabel("Nama acara").fill("Rapat Sintetis");
  await dialog()
    .getByLabel("Mulai", { exact: false })
    .filter({ hasNot: page.locator("never") })
    .count();
  await dialog().locator('[name="timeStart"]').fill("09:00");
  await dialog().locator('[name="timeEnd"]').fill("08:00");
  await reason();
  await dialog()
    .getByRole("button", { name: "Simpan acara", exact: true })
    .click();
  await dialog()
    .getByText("Jam selesai harus setelah jam mulai.", { exact: true })
    .first()
    .waitFor();
  assert.equal(
    await dialog().locator('[name="timeEnd"]').getAttribute("aria-invalid"),
    "true",
  );
  await dialog().locator('[name="timeEnd"]').fill("11:00");
  await dialog().getByLabel("Senin", { exact: false }).check();
  // All weekdays ensure this fixture runs on any date.
  for (const label of ["Minggu", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"])
    await dialog().getByLabel(label, { exact: false }).check();
  await submit("Simpan acara");
  await page
    .getByRole("heading", { name: "Rapat Sintetis", exact: true })
    .waitFor();
  await btn("Ubah acara").click();
  await dialog().getByLabel("Nama acara").fill("Rapat Sintetis Diperbarui");
  await dialog().locator('[name="type"]').selectOption("insidental");
  for (const label of [
    "Minggu",
    "Senin",
    "Selasa",
    "Rabu",
    "Kamis",
    "Jumat",
    "Sabtu",
  ])
    await dialog().getByLabel(label).uncheck();
  await dialog().locator('[name="dates"]').fill(date);
  await reason();
  await submit("Simpan acara");
  await page
    .getByRole("heading", { name: "Rapat Sintetis Diperbarui", exact: true })
    .waitFor();
  await btn("Catat kehadiran peserta").click();
  await dialog().locator('[name="eventId"]').selectOption({ index: 1 });
  await dialog().locator('[name="userId"]').selectOption({ index: 1 });
  await dialog().getByLabel("Jam masuk acara").fill("11:00");
  await reason();
  await dialog()
    .getByRole("button", { name: "Simpan kehadiran", exact: true })
    .click();
  await dialog()
    .getByText(
      "Jam masuk harus mulai dari jam mulai hingga sebelum jam selesai acara.",
      { exact: true },
    )
    .first()
    .waitFor();
  await dialog().getByLabel("Jam masuk acara").fill("09:15");
  await submit("Simpan kehadiran");
  await btn("Batalkan kehadiran").click();
  await reason();
  await submit("Konfirmasi pembatalan kehadiran");
  await page.getByText(/Masuk 09:15 · Dibatalkan/).waitFor();
  await btn("Catat kehadiran peserta").click();
  await dialog().locator('[name="eventId"]').selectOption({ index: 1 });
  await dialog().locator('[name="userId"]').selectOption({ index: 1 });
  await dialog().getByLabel("Jam masuk acara").fill("09:20");
  await reason();
  await submit("Simpan kehadiran");
  await btn("Tambah blokir jurnal acara").click();
  await dialog()
    .locator('[name="message"]')
    .fill("Blok pengujian jurnal acara");
  await reason();
  await submit("Aktifkan blokir jurnal");
  await go("guru");
  await btn("Tulis jurnal acara").click();
  await dialog()
    .locator('[name="description"]')
    .fill("Rapat peningkatan pembelajaran");
  await dialog()
    .getByRole("button", { name: "Kirim jurnal acara", exact: true })
    .click();
  await dialog()
    .getByText(/JOURNAL_BLOCKED/)
    .first()
    .waitFor();
  assert.equal(
    await dialog().locator('[name="description"]').inputValue(),
    "Rapat peningkatan pembelajaran",
  );
  await close();
  await go();
  await btn("Nonaktifkan blok jurnal").click();
  await ready();
  await btn("Aktifkan blok jurnal").waitFor();
  await go("guru");
  await btn("Tulis jurnal acara").click();
  await dialog()
    .locator('[name="description"]')
    .fill("Rapat peningkatan pembelajaran");
  await submit("Kirim jurnal acara");
  await page.getByText(/Jurnal tersimpan/).waitFor();
  await go();
  await btn("Tinjau penghapusan acara").click();
  await page
    .getByRole("heading", { name: "Konfirmasi penghapusan acara", exact: true })
    .waitFor();
  assert.equal(await dialog().count(), 1);
  await dialog()
    .getByText("JTM bersih yang dibalik", { exact: true })
    .waitFor();
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 768, height: 1024 },
    { width: 320, height: 740 },
    { width: 740, height: 320 },
  ]) {
    await page.setViewportSize(viewport);
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    await overflow();
    assert.equal(
      await dialog().evaluate((el) => el.scrollWidth > el.clientWidth + 1),
      false,
    );
    const box = await dialog().boundingBox();
    assert.ok(
      box.x >= 0 &&
        box.y >= 0 &&
        box.x + box.width <= viewport.width + 1 &&
        box.y + box.height <= viewport.height + 1,
    );
    if (screenshots)
      await page.screenshot({
        path: `${screenshots}/events-delete-${viewport.width}.png`,
      });
  }
  await close();
  const expire = async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.data.expiresAt = new Date(
      (await page.evaluate(() => Date.now())) + 1000,
    ).toISOString();
    await route.fulfill({ response, json: body });
  };
  await page.route("**/api/programs/event-delete", expire);
  await btn("Tinjau penghapusan acara").click();
  await page
    .getByRole("heading", { name: "Konfirmasi penghapusan acara", exact: true })
    .waitFor();
  await page.clock.fastForward(2000);
  assert.equal(await btn("Konfirmasi penghapusan").isDisabled(), true);
  await close();
  await page.unroute("**/api/programs/event-delete", expire);
  await btn("Tinjau penghapusan acara").click();
  await page
    .getByRole("heading", { name: "Konfirmasi penghapusan acara", exact: true })
    .waitFor();
  await btn("Konfirmasi penghapusan").click();
  await dialog().waitFor({ state: "hidden" });
  await ready();
  await page.getByText("Belum ada definisi acara.", { exact: true }).waitFor();
  await page.getByText(/Masuk 09:20 · Dibatalkan/).waitFor();
  // Failed reads must remove old data; retry must recover.
  let fail = true;
  const readRoute = async (route) => {
    if (fail) {
      fail = false;
      await route.fulfill({
        status: 200,
        json: { ok: true, data: { attendance: null } },
      });
    } else await route.continue();
  };
  await page.route("**/api/programs/read?**", readRoute);
  const previous = new Date(Date.parse(date + "T00:00:00Z") - 86400000)
    .toISOString()
    .slice(0, 10);
  await page.getByLabel("Tanggal acara", { exact: true }).fill(previous);
  await page
    .getByText(/Data acara belum dapat diverifikasi/)
    .first()
    .waitFor();
  assert.equal(await btn("Tambah acara").count(), 0);
  await page.getByRole("button", { name: /Coba kembali|Muat ulang/ }).click();
  await ready();
  await page
    .getByRole("heading", { name: "Kehadiran dan jurnal acara", exact: true })
    .waitFor();
  assert.equal(await btn("Catat kehadiran peserta").count(), 0);
  await page.unroute("**/api/programs/read?**", readRoute);
  await page.getByLabel("Tanggal acara", { exact: true }).fill(date);
  await ready();
  // Uncertain response: retain draft, disable resubmission until reload.
  let writes = 0;
  const reject = async (route) => {
    writes++;
    await route.fulfill({
      status: 503,
      json: {
        ok: false,
        error: { code: "UNAVAILABLE", message: "Layanan uji sementara gagal" },
      },
    });
  };
  await page.route("**/api/programs/event-save", reject);
  await btn("Tambah acara").click();
  await dialog().getByLabel("Nama acara").fill("Draft tetap tersimpan");
  await dialog().locator('[name="timeStart"]').fill("09:00");
  await dialog().locator('[name="timeEnd"]').fill("10:00");
  await dialog().getByLabel("Senin").check();
  await reason();
  await dialog()
    .getByRole("button", { name: "Simpan acara", exact: true })
    .click();
  await dialog()
    .getByText(/Layanan uji sementara gagal/)
    .first()
    .waitFor();
  assert.equal(
    await dialog().getByLabel("Nama acara").inputValue(),
    "Draft tetap tersimpan",
  );
  assert.equal(
    await dialog()
      .getByRole("button", { name: "Simpan acara", exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(writes, 1);
  await close();
  await page.unroute("**/api/programs/event-save", reject);
  await btn("Muat ulang acara").click();
  await ready();
  // Long data, pagination, search, stale dates and responsive forms.
  const many = async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const a = body.data.attendance[0];
    body.data.attendance = Array.from({ length: 30 }, (_, i) => ({
      ...a,
      id: `${String(i + 1).padStart(8, "0")}-1111-4111-8111-111111111111`,
      eventName: "Kegiatan" + "Panjang".repeat(60),
      teacherName: "Guru " + i,
    }));
    await route.fulfill({ response, json: body });
  };
  await page.route("**/api/programs/read?**", many);
  await go();
  await page.getByText(/Halaman 1 dari 3/).waitFor();
  await btn("Berikutnya").click();
  await page.getByText(/Halaman 2 dari 3/).waitFor();
  await page.getByLabel("Cari riwayat").fill("tidak cocok");
  await page
    .getByText("Tidak ada riwayat yang cocok.", { exact: true })
    .waitFor();
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 768, height: 1024 },
    { width: 320, height: 740 },
    { width: 740, height: 320 },
  ]) {
    await page.setViewportSize(viewport);
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    await overflow();
    await btn("Tambah acara").click();
    await overflow();
    assert.equal(
      await dialog().evaluate((el) => el.scrollWidth > el.clientWidth + 1),
      false,
    );
    await close();
  }
  await page.unroute("**/api/programs/read?**", many);
  await go();
  await btn("Tambah acara").click();
  await dialog().getByLabel("Nama acara").fill("Acara Pergantian Hari");
  await dialog().locator('[name="timeStart"]').fill("09:00");
  await dialog().locator('[name="timeEnd"]').fill("11:00");
  for (const label of [
    "Minggu",
    "Senin",
    "Selasa",
    "Rabu",
    "Kamis",
    "Jumat",
    "Sabtu",
  ])
    await dialog().getByLabel(label).check();
  await reason();
  await submit("Simpan acara");
  await btn("Catat kehadiran peserta").click();
  await page.clock.fastForward(13 * 60 * 60 * 1000);
  assert.equal(
    await dialog()
      .getByRole("button", { name: "Simpan kehadiran", exact: true })
      .isDisabled(),
    true,
  );
  await close();
  assert.equal(
    await page.getByLabel("Tanggal acara", { exact: true }).isDisabled(),
    false,
  );
  assert.equal(await btn("Catat kehadiran peserta").count(), 0);
  assert.deepEqual(errors, []);
  assert.deepEqual(consoleErrors, []);
  assert.ok(!logs.includes("FIXTURE_ERROR"), logs);
  console.log(
    JSON.stringify({
      result: "passed",
      flows: [
        "create-edit",
        "field-validation",
        "attendance-cancel-restore",
        "journal-block",
        "journal-ledger",
        "delete-reversal-history",
        "malformed-read-retry",
        "uncertain-write",
        "pagination-search",
        "responsive-modal",
        "preview-expiry",
        "WIB-midnight",
      ],
      widths: [1440, 768, 320, 740],
      pageErrors: errors,
    }),
  );
} catch (error) {
  console.error(
    await page?.evaluate(() =>
      Array.from(
        document.querySelectorAll('[role="dialog"], [role="dialog"] *'),
      )
        .filter((el) => el.scrollWidth > el.clientWidth + 1)
        .map((el) => ({
          tag: el.tagName,
          cls: el.className,
          width: el.clientWidth,
          scroll: el.scrollWidth,
          style: getComputedStyle(el).cssText,
          rect: el.getBoundingClientRect().toJSON(),
          text: el.textContent?.slice(0, 80),
        })),
    ),
  );
  console.error(await page?.locator("body").innerText());
  await page?.screenshot({ path: "/tmp/events-error.png", fullPage: true });
  throw error;
} finally {
  await browser?.close();
  child.kill("SIGTERM");
}
