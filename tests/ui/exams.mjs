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
    env: { ...process.env, UI_EXAM_FIXTURE: "1" },
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
    if (m.type() === "error") consoleErrors.push(m.text());
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
      "http://127.0.0.1:4319/?view=exams&role=" + role + "&path=%2Fujian",
    );
    await page
      .getByRole("heading", { name: "Ujian, panitia dan BAP", exact: true })
      .waitFor();
    await ready();
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
  await go();
  await page
    .getByLabel("Penugasan", { exact: true })
    .selectOption({ index: 1 });
  await page
    .getByRole("button", { name: "Atur perubahan penugasan", exact: true })
    .click();
  let d = page.getByRole("dialog");
  await d
    .getByLabel("Alasan perubahan (5–500 karakter)")
    .fill("Konfirmasi pengawas sintetis");
  await d
    .getByRole("button", { name: "Buat pratinjau perubahan", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Konfirmasi dampak perubahan", exact: true })
    .waitFor();
  assert.equal(await page.getByRole("dialog").count(), 1);
  await page
    .getByRole("button", { name: "Konfirmasi perubahan", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await ready();
  await go("guru");
  await page.locator("summary").filter({ hasText: "Isi BAP" }).click();
  await page.getByRole("button", { name: "Isi BAP", exact: true }).click();
  d = page.getByRole("dialog");
  await d.getByLabel("Catatan").fill("Draft BAP sebelum reload");
  await d.getByLabel("Hadir").fill("28");
  await d.getByLabel("Absen").fill("2");
  await d.getByText(/Draft tersimpan di tab ini/).waitFor();
  await go("guru");
  await page.locator("summary").filter({ hasText: "Isi BAP" }).click();
  await page.getByRole("button", { name: "Isi BAP", exact: true }).click();
  d = page.getByRole("dialog");
  await d.getByRole("button", { name: "Pulihkan draft", exact: true }).click();
  assert.equal(await d.getByLabel("Catatan").inputValue(), "Draft BAP sebelum reload");
  assert.equal(await d.getByLabel("Hadir").inputValue(), "28");
  assert.equal(await d.getByLabel("Absen").inputValue(), "2");
  await d.getByLabel("Absen").fill("0");
  await d.getByLabel("Hadir").fill("29");
  await d.getByRole("button", { name: "Kirim BAP", exact: true }).click();
  await d
    .getByText("Jumlah hadir dan absen harus sesuai total peserta.", {
      exact: false,
    })
    .waitFor();
  assert.equal(
    await d.getByLabel("Hadir").getAttribute("aria-invalid"),
    "true",
  );
  await d.getByLabel("Absen").fill("1");
  await d.getByLabel("Catatan").fill("Ujian berjalan tertib");
  await d.getByRole("button", { name: "Kirim BAP", exact: true }).click();
  await d.waitFor({ state: "hidden" });
  await ready();
  await page.getByText("Ujian berjalan tertib", { exact: true }).waitFor();
  await page.locator("summary").filter({ hasText: "Ubah BAP" }).click();
  await page.getByRole("button", { name: "Ubah BAP", exact: true }).click();
  d = page.getByRole("dialog");
  await d.getByLabel("Catatan").fill("BAP diperbarui sintetis");
  await d
    .getByRole("button", { name: "Simpan perubahan BAP", exact: true })
    .click();
  await d.waitFor({ state: "hidden" });
  await ready();
  await page.getByText("BAP diperbarui sintetis", { exact: true }).waitFor();
  await go();
  const real = await page.evaluate(
    async (date) =>
      (
        await (
          await fetch("/api/programs/read?domain=exams&date=" + date)
        ).json()
      ).data,
    date,
  );
  // Real master create/edit/delete on a future period.
  const day = new Date(date + "T00:00:00Z");
  day.setUTCDate(day.getUTCDate() + 1);
  const tomorrow = day.toISOString().slice(0, 10);
  await page
    .getByRole("button", { name: "Tambah data ujian", exact: true })
    .click();
  d = page.getByRole("dialog");
  await d.getByLabel("Semester").selectOption({ index: 1 });
  await d.getByLabel("Nama periode").fill("Periode UI Masa Depan");
  await d.getByLabel("Tanggal mulai").fill(tomorrow);
  await d.getByLabel("Tanggal akhir").fill(tomorrow);
  await d
    .getByLabel("Alasan perubahan (5–500 karakter)")
    .fill("Periode masa depan sintetis");
  await d
    .getByRole("button", { name: "Simpan data ujian", exact: true })
    .click();
  await d.waitFor({ state: "hidden" });
  await ready();
  const details = () =>
    page
      .locator("details")
      .filter({
        has: page
          .locator("summary")
          .filter({ hasText: "Periode UI Masa Depan" }),
      });
  await details().locator("summary").click();
  await details()
    .getByRole("button", { name: "Ubah periode", exact: true })
    .click();
  d = page.getByRole("dialog");
  await d.getByLabel("Nama periode").fill("Periode UI Masa Depan Edit");
  await d
    .getByLabel("Alasan perubahan (5–500 karakter)")
    .fill("Perbarui periode sintetis");
  await d
    .getByRole("button", { name: "Simpan data ujian", exact: true })
    .click();
  await d.waitFor({ state: "hidden" });
  await ready();
  await details().locator("summary").click();
  await details()
    .getByRole("button", { name: "Tinjau penghapusan periode", exact: true })
    .click();
  await page.getByRole("dialog").waitFor();
  await page
    .getByRole("button", { name: "Konfirmasi perubahan", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await ready();
  assert.equal(await details().count(), 0);
  // Preview expires according to its returned timestamp; no overlapping modals.
  const expiry = await page.evaluate(() =>
    new Date(Date.now() + 1000).toISOString(),
  );
  await page.route("**/api/programs/preview", async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    json.data.expiresAt = expiry;
    await route.fulfill({ response, json });
  });
  const review = async () => {
    await page
      .getByLabel("Penugasan", { exact: true })
      .selectOption({ index: 1 });
    await page
      .getByRole("button", { name: "Atur perubahan penugasan", exact: true })
      .click();
    const form = page.getByRole("dialog");
    await form
      .getByLabel("Alasan perubahan (5–500 karakter)")
      .fill("Pencabutan sintetis");
    await form
      .getByRole("button", { name: "Buat pratinjau perubahan", exact: true })
      .click();
    await page
      .getByRole("heading", {
        name: "Konfirmasi dampak perubahan",
        exact: true,
      })
      .waitFor();
  };
  await review();
  await page.clock.fastForward(2000);
  assert.equal(
    await page
      .getByRole("button", { name: "Konfirmasi perubahan", exact: true })
      .isDisabled(),
    true,
  );
  await close();
  await page.unroute("**/api/programs/preview");
  await review();
  await page.route("**/api/programs/commit", (route) => route.abort("failed"));
  await page
    .getByRole("button", { name: "Konfirmasi perubahan", exact: true })
    .click();
  await page
    .getByText("Status penyimpanan perlu diperiksa. Tutup pratinjau", {
      exact: false,
    })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Konfirmasi perubahan", exact: true })
      .isDisabled(),
    true,
  );
  await close();
  await page.unroute("**/api/programs/commit");
  await page
    .getByRole("button", { name: "Muat ulang ujian", exact: true })
    .click();
  await ready();
  await page.route("**/api/programs/read?**", (route) =>
    route.fulfill({ json: { ok: true, data: { ...real, occurrences: [{}] } } }),
  );
  await page
    .getByRole("button", { name: "Muat ulang ujian", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Data belum dapat dimuat", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Tambah data ujian", exact: true })
      .count(),
    0,
  );
  await page.unroute("**/api/programs/read?**");
  await page.getByRole("button", { name: "Coba kembali", exact: true }).click();
  await ready();
  const long = {
    ...real,
    occurrences: Array.from({ length: 31 }, (_, i) => ({
      ...real.occurrences[0],
      id: `99999999-9999-4999-8999-${String(i).padStart(12, "0")}`,
      bap: null,
      teacherName: "Guru" + "Panjang".repeat(60),
    })),
    baps: Array.from({ length: 43 }, (_, i) => ({
      ...real.baps[0],
      id: `88888888-8888-4888-8888-${String(i).padStart(12, "0")}`,
      notes: "Catatan".repeat(100),
    })),
  };
  await page.route("**/api/programs/read?**", (route) =>
    route.fulfill({ json: { ok: true, data: long } }),
  );
  await page
    .getByRole("button", { name: "Muat ulang ujian", exact: true })
    .click();
  await ready();
  for (const [width, height] of [
    [1440, 1000],
    [768, 1024],
    [320, 740],
    [740, 320],
  ]) {
    await page.setViewportSize({ width, height });
    await overflow();
    assert.equal(await page.locator("article").count(), 12);
    await page
      .getByRole("navigation", { name: "Halaman penugasan", exact: true })
      .getByRole("button", { name: "Berikutnya", exact: true })
      .click();
    await page
      .getByRole("navigation", { name: "Halaman penugasan", exact: true })
      .getByRole("button", { name: "Sebelumnya", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Tambah data ujian", exact: true })
      .click();
    d = page.getByRole("dialog");
    await overflow();
    assert.equal(
      await d.evaluate(
        (e) => e.getBoundingClientRect().bottom <= innerHeight + 1,
      ),
      true,
    );
    if (screenshots)
      await page.screenshot({ path: screenshots + `/exam-modal-${width}.png` });
    await close();
  }
  await page
    .getByLabel("Cari penugasan dan BAP", { exact: true })
    .fill("tidak ditemukan");
  assert.equal(await page.locator("article").count(), 0);
  // WIB midnight must leave the editor closable and restore enabled filters.
  await page.getByLabel("Cari penugasan dan BAP", { exact: true }).fill("");
  await page
    .getByLabel("Penugasan", { exact: true })
    .selectOption({ index: 1 });
  await page
    .getByRole("button", { name: "Atur perubahan penugasan", exact: true })
    .click();
  await page.clock.fastForward(13 * 60 * 60000);
  d = page.getByRole("dialog");
  assert.equal(await d.isVisible(), true);
  assert.equal(
    await d
      .getByRole("button", { name: "Buat pratinjau perubahan", exact: true })
      .isDisabled(),
    true,
  );
  await close();
  assert.equal(
    await page.getByLabel("Tanggal", { exact: true }).isDisabled(),
    false,
  );
  assert.deepEqual(errors, []);
  assert.equal(
    consoleErrors.some((e) => /NaN|uncontrolled|unique.*key/.test(e)),
    false,
  );
  console.log(
    JSON.stringify({
      result: "passed",
      flows: [
        "confirm",
        "BAP-draft-reload-restore",
        "BAP-count-validation",
        "BAP-create-edit",
        "master-create-edit-delete",
        "preview-expiry",
        "uncertain-write",
        "malformed-response",
        "pagination",
        "WIB-midnight",
      ],
      widths: [1440, 768, 320, 740],
      pageErrors: errors,
    }),
  );
} catch (error) {
  console.error(await page?.locator("body").innerText());
  await page?.screenshot({ path: "/tmp/exam-error.png", fullPage: true });
  throw error;
} finally {
  await browser?.close();
  child.kill("SIGTERM");
}
