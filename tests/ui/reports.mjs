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
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const btn = (n) => page.getByRole("button", { name: n, exact: true });
  await page.goto("http://127.0.0.1:4319/?view=reports&role=admin");
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
  await page.goto("http://127.0.0.1:4319/?view=reports&role=guru");
  await page
    .getByRole("heading", { name: "Rincian sumber", exact: true })
    .waitFor();
  assert.equal(await btn("Honorarium").count(), 0);
  assert.equal(
    await page.getByRole("heading", { name: "Izin pembaca laporan" }).count(),
    0,
  );
  await page.goto("http://127.0.0.1:4319/?view=reports&role=admin");
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
  await page.goto("http://127.0.0.1:4319/?view=reports&role=guru");
  await page
    .getByRole("heading", { name: "Akses laporan belum diberikan" })
    .waitFor();
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
        "responsive-modal",
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
