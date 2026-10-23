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
    env: { ...process.env, UI_DUTY_FIXTURE: "1" },
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
  page.setDefaultTimeout(15000);
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
  const ready = () =>
    page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
  const go = async () => {
    await page.goto(
      "http://127.0.0.1:4319/?view=duties&role=admin&path=%2Fpiket",
    );
    await ready();
  };
  const open = async () => {
    await page
      .getByRole("button", { name: "Tambah jadwal tugas", exact: true })
      .click();
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
  await go();
  let d = await open();
  await d.getByLabel("Guru", { exact: true }).selectOption(guru);
  await d
    .getByLabel("Periode akademik", { exact: true })
    .selectOption({ index: 1 });
  await d
    .getByLabel("Hari", { exact: true })
    .selectOption(String(new Date(date + "T00:00:00Z").getUTCDay()));
  await d
    .getByLabel("Alasan perubahan jadwal", { exact: true })
    .fill("Jadwal piket sintetis");
  await d
    .getByRole("button", { name: "Simpan jadwal tugas", exact: true })
    .click();
  await d.waitFor({ state: "hidden" });
  await ready();
  const duty = () =>
    page.locator("article").filter({
      has: page.getByRole("heading", {
        name: "Piket · Guru Pengujian Sintetis",
        exact: true,
      }),
    });
  await duty()
    .getByRole("button", { name: "Kelola kegiatan", exact: true })
    .click();
  d = page.getByRole("dialog");
  await d
    .getByLabel("Alasan tindakan", { exact: true })
    .fill("Konfirmasi tugas sintetis");
  await d
    .getByRole("button", { name: "Tinjau dampak perubahan", exact: true })
    .click();
  await d
    .getByRole("heading", { name: "Konfirmasi Konfirmasi", exact: true })
    .waitFor();
  assert.equal(
    await d.getByLabel("Alasan tindakan", { exact: true }).isDisabled(),
    true,
  );
  await d.getByRole("button", { name: "Konfirmasi", exact: true }).click();
  await d.waitFor({ state: "hidden" });
  await ready();
  await duty().getByText("Terkonfirmasi", { exact: false }).waitFor();
  await page
    .getByRole("button", { name: "Ubah jadwal tugas", exact: true })
    .click();
  d = page.getByRole("dialog");
  assert.equal(
    await d.getByLabel("Jenis tugas", { exact: true }).isDisabled(),
    true,
  );
  assert.equal(
    await d.getByLabel("Periode akademik", { exact: true }).isDisabled(),
    true,
  );
  await d
    .getByLabel("Alasan perubahan jadwal", { exact: true })
    .fill("Pembaruan alasan jadwal sintetis");
  await d
    .getByRole("button", { name: "Simpan jadwal tugas", exact: true })
    .click();
  await d.waitFor({ state: "hidden" });
  await ready();
  d = await open();
  assert.equal(await d.getByLabel("Guru", { exact: true }).inputValue(), "");
  await close();
  const real = await page.evaluate(
    async (date) =>
      (await (await fetch("/api/duties/board?date=" + date)).json()).data,
    date,
  );
  // Ceremony creation rejects a non-Monday locally, then displays the saved Monday.
  d = await open();
  await d.getByLabel("Jenis tugas", { exact: true }).selectOption("UPACARA");
  await d.getByLabel("Guru", { exact: true }).selectOption(guru);
  await d
    .getByLabel("Periode akademik", { exact: true })
    .selectOption({ index: 1 });
  await d.getByLabel("Jam selesai", { exact: true }).fill("07:20");
  await d
    .getByLabel("Alasan perubahan jadwal", { exact: true })
    .fill("Upacara Senin sintetis");
  const monday = new Date(date + "T00:00:00Z");
  monday.setUTCDate(monday.getUTCDate() + ((8 - monday.getUTCDay()) % 7));
  const mondayDate = monday.toISOString().slice(0, 10);
  if (mondayDate !== date) {
    await d
      .getByRole("button", { name: "Simpan jadwal tugas", exact: true })
      .click();
    await d
      .getByText("Upacara harus pada hari Senin", { exact: false })
      .waitFor();
    assert.equal(
      await d.getByLabel("Tanggal Senin", { exact: true }).isDisabled(),
      false,
    );
  }
  await d.getByLabel("Tanggal Senin", { exact: true }).fill(mondayDate);
  await d
    .getByRole("button", { name: "Simpan jadwal tugas", exact: true })
    .click();
  await d.waitFor({ state: "hidden" });
  await ready();
  assert.equal(
    await page
      .getByLabel("Tanggal kegiatan (WIB)", { exact: true })
      .inputValue(),
    mondayDate,
  );
  await page.getByLabel("Tanggal kegiatan (WIB)", { exact: true }).fill(date);
  await ready();
  // Late preview response cannot be applied to edited fields: controls stay locked.
  await page.route("**/api/duties/preview", async (route) => {
    await new Promise((r) => setTimeout(r, 350));
    await route.continue();
  });
  await duty()
    .getByRole("button", { name: "Kelola kegiatan", exact: true })
    .click();
  d = page.getByRole("dialog");
  await d
    .getByLabel("Alasan tindakan", { exact: true })
    .fill("Tinjau pencabutan sintetis");
  await d
    .getByRole("button", { name: "Tinjau dampak perubahan", exact: true })
    .click();
  assert.equal(
    await d.getByLabel("Tindakan", { exact: true }).isDisabled(),
    true,
  );
  await d
    .getByRole("heading", { name: "Konfirmasi Cabut konfirmasi", exact: true })
    .waitFor();
  await close();
  await page.unroute("**/api/duties/preview");
  // Lost write response must not permit duplicate resubmission.
  await page.route("**/api/duties/commit", (route) => route.abort("failed"));
  await duty()
    .getByRole("button", { name: "Kelola kegiatan", exact: true })
    .click();
  d = page.getByRole("dialog");
  await d
    .getByLabel("Alasan tindakan", { exact: true })
    .fill("Gagal jaringan sintetis");
  await d
    .getByRole("button", { name: "Tinjau dampak perubahan", exact: true })
    .click();
  await d
    .getByRole("heading", { name: "Konfirmasi Cabut konfirmasi", exact: true })
    .waitFor();
  await d
    .getByRole("button", { name: "Cabut konfirmasi", exact: true })
    .click();
  await d
    .getByText("Status penyimpanan perlu diperiksa sebelum mengirim ulang.", {
      exact: false,
    })
    .waitFor();
  assert.equal(
    await d
      .getByRole("button", { name: "Cabut konfirmasi", exact: true })
      .isDisabled(),
    true,
  );
  await close();
  await page.unroute("**/api/duties/commit");
  // Malformed/loading/error responses never leave stale editable rows.
  await page.route("**/api/duties/board?**", (route) =>
    route.fulfill({
      status: 200,
      json: { ok: true, data: { ...real, occurrences: [{}] } },
    }),
  );
  await page.getByRole("button", { name: "Muat ulang", exact: true }).click();
  await ready();
  await page
    .getByText("Data tugas dari server belum sesuai.", { exact: false })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Kelola kegiatan", exact: true })
      .count(),
    0,
  );
  await page.unroute("**/api/duties/board?**");
  await go();
  // Long records and paging at desktop, tablet, portrait and landscape.
  const long = {
    ...real,
    occurrences: Array.from({ length: 31 }, (_, i) => ({
      ...real.occurrences.find((o) => o.kind === "PIKET"),
      id: `99999999-9999-4999-8999-${String(i).padStart(12, "0")}`,
      teacherName: "Guru" + "Panjang".repeat(70),
    })),
  };
  await page.route("**/api/duties/board?**", (route) =>
    route.fulfill({ json: { ok: true, data: long } }),
  );
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
    assert.equal(await page.locator("article").count(), 13);
    await page
      .getByRole("navigation", { name: "Halaman kegiatan", exact: true })
      .getByRole("button", { name: "Berikutnya", exact: true })
      .click();
    await page
      .getByRole("navigation", { name: "Halaman kegiatan", exact: true })
      .getByRole("button", { name: "Sebelumnya", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Kelola kegiatan", exact: true })
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
    await close();
    if (screenshots)
      await page.screenshot({
        path: screenshots + `/duties-${width}.png`,
        fullPage: true,
      });
  }
  await page
    .getByLabel("Cari kegiatan dan jadwal", { exact: true })
    .fill("tidak ditemukan");
  assert.equal(
    await page
      .getByRole("button", { name: "Kelola kegiatan", exact: true })
      .count(),
    0,
  );
  assert.deepEqual(errors, []);
  assert.equal(
    consoleErrors.some((e) => /NaN|uncontrolled|unique.*key/.test(e)),
    false,
  );
  console.log(
    JSON.stringify({
      result: "passed",
      realFlows: [
        "schedule-create",
        "schedule-edit",
        "confirm",
        "preview-lock",
        "ambiguous-write",
      ],
      responsiveWidths: [1440, 768, 320, 740],
      pageErrors: errors,
    }),
  );
} catch (error) {
  console.error(await page?.locator("body").innerText());
  await page?.screenshot({ path: "/tmp/duty-error.png", fullPage: true });
  throw error;
} finally {
  await browser?.close();
  child.kill("SIGTERM");
}
