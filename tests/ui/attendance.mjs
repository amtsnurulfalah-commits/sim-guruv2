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
    env: { ...process.env, UI_ATTENDANCE_FIXTURE: "1" },
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
  const guru = "22222222-2222-4222-8222-222222222222";
  await page.clock.install({ time: new Date(date + "T12:00:00+07:00") });
  const ready = () =>
    page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
  const go = async (role = "admin") => {
    await page.goto(
      "http://127.0.0.1:4319/?view=attendance&role=" +
        role +
        "&path=%2Fkehadiran",
    );
    await page
      .getByRole("heading", { name: "Kehadiran guru", exact: true })
      .waitFor();
    await ready();
  };
  const daily = async () => {
    await page
      .getByRole("tab", { name: "Kehadiran harian", exact: true })
      .click();
    await ready();
  };
  const history = async () => {
    await page
      .getByRole("tab", { name: "Riwayat kehadiran", exact: true })
      .click();
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
  await history();
  const old = new Date(date + "T00:00:00Z");
  old.setUTCDate(old.getUTCDate() - 1);
  const previous = old.toISOString().slice(0, 10);
  await page.getByLabel("Riwayat mulai", { exact: true }).fill(previous);
  await page.getByLabel("Riwayat sampai", { exact: true }).fill(previous);
  await ready();
  await page
    .getByRole("button", { name: "Kehadiran harian", exact: true })
    .click();
  let d = page.getByRole("dialog");
  await d.getByLabel("Guru", { exact: true }).selectOption(guru);
  await d.getByText("Catatan sudah ada.", { exact: false }).waitFor();
  assert.equal(
    await d
      .getByLabel("Aktual masuk (boleh kosong)", { exact: true })
      .inputValue(),
    "07:00",
  );
  await d
    .getByLabel("Aktual pulang (boleh kosong)", { exact: true })
    .fill("14:00");
  await d
    .getByLabel("Alasan", { exact: true })
    .fill("Koreksi di luar filter riwayat");
  const manualRequest = page.waitForRequest(
    (r) => new URL(r.url()).pathname === "/api/activities/manual",
  );
  await d
    .getByRole("button", { name: "Simpan kehadiran manual", exact: true })
    .click();
  assert.notEqual((await manualRequest).postDataJSON().version, "0");
  await d.waitFor({ state: "hidden" });
  await ready();
  await daily();
  await page
    .getByRole("button", { name: "Ajukan izin keluar", exact: true })
    .click();
  d = page.getByRole("dialog");
  await d.getByLabel("Jam keluar", { exact: true }).fill("08:00");
  await d.getByLabel("Jam kembali", { exact: true }).fill("09:00");
  await d.getByLabel("Alasan", { exact: true }).fill("Izin sintetis pertama");
  await d.getByRole("button", { name: "Simpan izin", exact: true }).click();
  await d.waitFor({ state: "hidden" });
  await ready();
  await page
    .getByText("Izin 08:00–09:00: Izin sintetis pertama", { exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Ajukan izin keluar", exact: true })
    .click();
  d = page.getByRole("dialog");
  assert.equal(await d.getByLabel("Alasan", { exact: true }).inputValue(), "");
  await d.getByLabel("Jam keluar", { exact: true }).fill("08:30");
  await d.getByLabel("Jam kembali", { exact: true }).fill("10:00");
  await d
    .getByLabel("Alasan", { exact: true })
    .fill("Interval yang bertabrakan");
  await d.getByRole("button", { name: "Simpan izin", exact: true }).click();
  await d.getByText("Interval izin bertabrakan", { exact: false }).waitFor();
  await close();
  await page.getByRole("button", { name: "Hapus izin", exact: true }).click();
  d = page.getByRole("dialog");
  await d.getByLabel("Alasan", { exact: true }).fill("Hapus izin sintetis");
  await d.getByRole("button", { name: "Hapus izin", exact: true }).click();
  await d.waitFor({ state: "hidden" });
  await ready();
  assert.equal(
    await page.getByRole("button", { name: "Hapus izin", exact: true }).count(),
    0,
  );
  // Real server-time in/out: admin corrects the schedule before requesting server timestamps.
  await page
    .getByRole("button", { name: "Koreksi kehadiran", exact: true })
    .click();
  d = page.getByRole("dialog");
  await d.getByLabel("Aktual masuk (boleh kosong)", { exact: true }).fill("");
  await d.getByLabel("Aktual pulang (boleh kosong)", { exact: true }).fill("");
  await d.getByLabel("Jadwal masuk", { exact: true }).fill("00:00");
  await d.getByLabel("Jadwal pulang", { exact: true }).fill("23:59");
  await d
    .getByLabel("Alasan", { exact: true })
    .fill("Siapkan uji masuk pulang");
  await d
    .getByRole("button", { name: "Simpan kehadiran manual", exact: true })
    .click();
  await d.waitFor({ state: "hidden" });
  await ready();
  await page
    .getByRole("button", { name: "Catat masuk sekarang", exact: true })
    .click();
  d = page.getByRole("dialog");
  await d
    .getByLabel("Alasan", { exact: true })
    .fill("Masuk menurut waktu server");
  await d
    .getByRole("button", { name: "Konfirmasi pencatatan", exact: true })
    .click();
  await d.waitFor({ state: "hidden" });
  await ready();
  await page.getByRole("button", { name: "Catat pulang", exact: true }).click();
  d = page.getByRole("dialog");
  await d
    .getByLabel("Alasan", { exact: true })
    .fill("Pulang menurut waktu server");
  await d
    .getByRole("button", { name: "Konfirmasi pencatatan", exact: true })
    .click();
  await d.waitFor({ state: "hidden" });
  await ready();
  // Pattern selection never opens its editor; KBM preview and application preserve actual times.
  await page
    .getByRole("button", { name: "Pola jam kehadiran", exact: true })
    .click();
  d = page.getByRole("dialog");
  await d.getByLabel("Jam masuk", { exact: true }).fill("07:15");
  await d.getByLabel("Jam pulang", { exact: true }).fill("14:30");
  await d.getByLabel("Alasan", { exact: true }).fill("Pola KBM sintetis");
  await d
    .getByRole("button", { name: "Simpan pola kehadiran", exact: true })
    .click();
  await d.waitFor({ state: "hidden" });
  await ready();
  await page
    .getByLabel("Pola kehadiran", { exact: true })
    .selectOption({ index: 1 });
  assert.equal(await page.getByRole("dialog").count(), 0);
  const before = await page.evaluate(
    async (date) =>
      (
        await (
          await fetch(
            "/api/activities/attendance?from=" +
              date +
              "&to=" +
              date +
              "&page=1&pageSize=25",
          )
        ).json()
      ).data,
    date,
  );
  await page
    .getByRole("button", { name: "Tinjau penerapan pola", exact: true })
    .click();
  d = page.getByRole("dialog");
  await d.getByText("1 guru.", { exact: false }).waitFor();
  await d.getByLabel("Alasan", { exact: true }).fill("Terapkan pola sintetis");
  await d
    .getByRole("button", { name: "Terapkan pola kehadiran", exact: true })
    .click();
  await d.waitFor({ state: "hidden" });
  await ready();
  const after = await page.evaluate(
    async (date) =>
      (
        await (
          await fetch(
            "/api/activities/attendance?from=" +
              date +
              "&to=" +
              date +
              "&page=1&pageSize=25",
          )
        ).json()
      ).data,
    date,
  );
  assert.equal(after.items[0].actualIn, before.items[0].actualIn);
  assert.equal(after.items[0].actualOut, before.items[0].actualOut);
  await page.getByRole("button", { name: "Ubah pola", exact: true }).click();
  d = page.getByRole("dialog");
  assert.equal(
    await d.getByLabel("Jam masuk", { exact: true }).inputValue(),
    "07:15",
  );
  await d.getByLabel("Konteks", { exact: true }).selectOption("UJIAN");
  assert.equal(
    await d.getByLabel("Jam masuk", { exact: true }).inputValue(),
    "07:30",
  );
  await d
    .getByLabel("Alasan", { exact: true })
    .fill("Pola ujian belum digunakan");
  await d
    .getByRole("button", { name: "Simpan pola kehadiran", exact: true })
    .click();
  await d.waitFor({ state: "hidden" });
  await ready();
  const examPattern = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: /UJIAN/ }) });
  await examPattern
    .getByRole("button", { name: "Hapus pola", exact: true })
    .click();
  d = page.getByRole("dialog");
  await d.getByLabel("Alasan", { exact: true }).fill("Hapus pola ujian kosong");
  await d
    .getByRole("button", { name: "Hapus pola kehadiran", exact: true })
    .click();
  await d.waitFor({ state: "hidden" });
  await ready();
  assert.equal(await examPattern.count(), 0);
  // Lost write response: server completes, UI blocks replay and reload reveals the new version.
  await page.route("**/api/activities/manual", async (route) => {
    await route.fetch();
    await route.abort("failed");
  });
  await page
    .getByRole("button", { name: "Koreksi kehadiran", exact: true })
    .click();
  d = page.getByRole("dialog");
  await d
    .getByLabel("Alasan", { exact: true })
    .fill("Respons penyimpanan terputus");
  await d
    .getByRole("button", { name: "Simpan kehadiran manual", exact: true })
    .click();
  await d
    .getByText("Status penyimpanan perlu diperiksa.", { exact: false })
    .waitFor();
  assert.equal(
    await d
      .getByRole("button", { name: "Simpan kehadiran manual", exact: true })
      .isDisabled(),
    true,
  );
  await close();
  await page.unroute("**/api/activities/manual");
  await page.getByRole("button", { name: "Muat ulang", exact: true }).click();
  await ready();
  // Export uses active history scope and produces real CSV/PDF.
  await history();
  await page.getByLabel("Riwayat mulai", { exact: true }).fill(date);
  await page.getByLabel("Riwayat sampai", { exact: true }).fill(date);
  await ready();
  for (const type of ["CSV", "PDF"]) {
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Unduh " + type, exact: true })
      .click();
    const file = await download;
    assert.equal(file.suggestedFilename(), "attendance." + type.toLowerCase());
    await file.failure().then((f) => assert.equal(f, null));
  }
  await page.getByLabel("Riwayat mulai", { exact: true }).fill("2090-01-01");
  await ready();
  await page
    .getByText("Pilih rentang riwayat yang valid", { exact: false })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Unduh CSV", exact: true })
      .isDisabled(),
    true,
  );
  await go();
  const real = await page.evaluate(
    async (date) =>
      (
        await (
          await fetch(
            "/api/activities/attendance?from=" +
              date +
              "&to=" +
              date +
              "&page=1&pageSize=25",
          )
        ).json()
      ).data,
    date,
  );
  await page.route("**/api/activities/attendance?**", (route) =>
    route.fulfill({
      json: {
        ok: true,
        data: { ...real, items: [{ ...real.items[0], ratio: "NaN" }] },
      },
    }),
  );
  await page.getByRole("button", { name: "Muat ulang", exact: true }).click();
  await ready();
  await page
    .getByText("Format data kehadiran belum sesuai", { exact: false })
    .first()
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Koreksi kehadiran", exact: true })
      .count(),
    0,
  );
  await page.unroute("**/api/activities/attendance?**");
  const long = {
    ...real,
    total: 61,
    items: Array.from({ length: 25 }, (_, i) => ({
      ...real.items[0],
      id: `99999999-9999-4999-8999-${String(i).padStart(12, "0")}`,
      teacherName: "Guru" + "Panjang".repeat(70),
      leaves: [],
    })),
  };
  await page.route("**/api/activities/attendance?**", (route) => {
    const url = new URL(route.request().url());
    return route.fulfill({
      json: {
        ok: true,
        data: {
          ...long,
          page: Number(url.searchParams.get("page")),
          pageSize: Number(url.searchParams.get("pageSize")),
          items: long.items.map((r) => ({
            ...r,
            date: url.searchParams.get("from"),
          })),
        },
      },
    });
  });
  await page.getByRole("button", { name: "Muat ulang", exact: true }).click();
  await ready();
  for (const [width, height] of [
    [1440, 1000],
    [768, 1024],
    [320, 740],
    [740, 320],
  ]) {
    await page.setViewportSize({ width, height });
    await overflow();
    await page
      .getByRole("navigation", {
        name: "Halaman kehadiran harian",
        exact: true,
      })
      .getByRole("button", { name: "Berikutnya", exact: true })
      .click();
    await ready();
    await page
      .getByRole("navigation", {
        name: "Halaman kehadiran harian",
        exact: true,
      })
      .getByRole("button", { name: "Sebelumnya", exact: true })
      .click();
    await ready();
    await page
      .getByRole("button", { name: "Koreksi kehadiran", exact: true })
      .first()
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
      await page.screenshot({
        path: screenshots + `/attendance-modal-${width}.png`,
      });
    await close();
  }
  // Rollover keeps a leave editor closable and removes stale-day submit rights.
  await page
    .getByRole("button", { name: "Ajukan izin keluar", exact: true })
    .first()
    .click();
  d = page.getByRole("dialog");
  await page.clock.fastForward(13 * 60 * 60000);
  assert.equal(
    await d
      .getByRole("button", { name: "Simpan izin", exact: true })
      .isDisabled(),
    true,
  );
  await close();
  assert.deepEqual(errors, []);
  assert.equal(
    consoleErrors.some((e) => /NaN|uncontrolled|unique.*key/.test(e)),
    false,
  );
  console.log(
    JSON.stringify({
      result: "passed",
      flows: [
        "manual-outside-history",
        "leave-create-overlap-delete",
        "server-in-out",
        "template-save-apply-delete",
        "uncertain-write",
        "CSV-PDF",
        "invalid-range",
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
  await page?.screenshot({ path: "/tmp/attendance-error.png", fullPage: true });
  throw error;
} finally {
  await browser?.close();
  child.kill("SIGTERM");
}
