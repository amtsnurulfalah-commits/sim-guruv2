/** Real Next App Router, shared production shell, synthetic sessions/data only. */
import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { createServer } from "node:net";
import { mkdir, writeFile } from "node:fs/promises";
const { chromium } = await import(
  process.env.UI_PLAYWRIGHT_MODULE ?? "playwright"
);
const reservation = createServer();
await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
const port = reservation.address().port;
await new Promise((resolve) => reservation.close(resolve));
const baseUrl = `http://127.0.0.1:${port}`;
const production = process.env.NAV_FIXTURE_PRODUCTION === "1";
const fixtureEnvironment = {
  ...process.env,
  NAV_FIXTURE_DIST: ".next-run-" + Date.now(),
};
if (production) {
  try {
    await promisify(execFile)(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "build",
        "tests/navigation",
        "--webpack",
      ],
      { env: fixtureEnvironment, timeout: 120000, maxBuffer: 12 * 1024 * 1024 },
    );
  } catch (error) {
    console.error(error.stdout, error.stderr);
    throw error;
  }
}
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    ...(production
      ? ["start", "tests/navigation"]
      : ["dev", "tests/navigation", "--webpack"]),
    "--hostname",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  {
    stdio: ["ignore", "pipe", "pipe"],
    env: fixtureEnvironment,
  },
);
let logs = "",
  browser;
server.stdout.on("data", (b) => {
  logs += b;
});
server.stderr.on("data", (b) => {
  logs += b;
});
const output = resolve(
  process.env.NAV_REPORT_DIR ?? "../navigation-verification",
);
try {
  await new Promise((accept, reject) => {
    const timeout = setTimeout(
      () => reject(Error("NEXT_FIXTURE_TIMEOUT: " + logs)),
      60000,
    );
    const check = (b) => {
      if (/Ready in/.test(b.toString())) {
        clearTimeout(timeout);
        accept();
      }
    };
    server.stdout.on("data", check);
    server.on("exit", (code) => {
      clearTimeout(timeout);
      reject(Error("NEXT_FIXTURE_EXIT " + code + logs));
    });
  });
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.UI_BROWSER_EXECUTABLE,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-zygote",
    ],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const documents = [],
    dataRequests = [],
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (request.isNavigationRequest() && request.frame() === page.mainFrame())
      documents.push(path);
    if (path.startsWith("/api/data/")) dataRequests.push(path);
  });
  await page.goto(baseUrl + "/dashboard");
  await page.getByText("Data halaman siap", { exact: true }).waitFor();
  const origin = await page.evaluate(() => performance.timeOrigin);
  const sidebar = await page
    .getByRole("complementary", { name: "Sidebar desktop" })
    .elementHandle();
  const banner = await page.getByRole("banner").elementHandle();
  const main = await page.getByRole("main").elementHandle();
  await page.getByRole("searchbox", { name: "Cari menu" }).fill("jurnal");
  dataRequests.length = 0;
  const navigationStarted = Date.now();
  await page
    .getByRole("link", { name: "Jurnal pembelajaran", exact: true })
    .click();
  const immediateHeading = page.getByRole("heading", {
    name: "Jurnal pembelajaran",
    exact: true,
  });
  await immediateHeading.waitFor({ state: "visible", timeout: 750 });
  const clickFeedbackMs = Date.now() - navigationStarted;
  assert.ok(clickFeedbackMs < 750, `CLICK_FEEDBACK_DELAY ${clickFeedbackMs}ms`);
  assert.ok(await immediateHeading.isVisible());
  assert.equal(
    await page
      .getByRole("heading", { name: "dashboard", exact: true })
      .isVisible(),
    false,
  );
  assert.equal(await sidebar.evaluate((element) => element.isConnected), true);

  await page.getByRole("heading", { name: "jurnal", exact: true }).waitFor();
  await page.getByText("Data halaman siap", { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => performance.timeOrigin), origin);
  assert.deepEqual(documents, ["/dashboard"]);
  assert.deepEqual([...new Set(dataRequests)], ["/api/data/jurnal"]);
  assert.equal(await sidebar.evaluate((element) => element.isConnected), true);
  assert.equal(await banner.evaluate((element) => element.isConnected), true);
  assert.equal(await main.evaluate((element) => element.isConnected), true);
  assert.equal(
    await page.getByRole("searchbox", { name: "Cari menu" }).inputValue(),
    "jurnal",
  );
  assert.equal(
    await page
      .getByRole("link", { name: "Jurnal pembelajaran", exact: true })
      .getAttribute("aria-current"),
    "page",
  );
  await page.getByRole("searchbox", { name: "Cari menu" }).fill("");
  await page
    .getByRole("button", { name: "Ciutkan sidebar", exact: true })
    .click();
  dataRequests.length = 0;
  await page
    .getByRole("link", { name: "Jadwal mengajar", exact: true })
    .click();
  await page.getByRole("heading", { name: "jadwal", exact: true }).waitFor();
  await page.getByText("Data halaman siap", { exact: true }).waitFor();
  assert.deepEqual([...new Set(dataRequests)], ["/api/data/jadwal"]);
  assert.ok(
    await page
      .getByRole("button", { name: "Perluas sidebar", exact: true })
      .isVisible(),
  );
  assert.equal(await sidebar.evaluate((element) => element.isConnected), true);
  await page
    .getByRole("link", { name: "Akun dan profil", exact: true })
    .click();
  await page.getByRole("heading", { name: "akun", exact: true }).waitFor();
  assert.equal(await sidebar.evaluate((element) => element.isConnected), true);
  assert.deepEqual(documents, ["/dashboard"]);
  await page.goBack();
  await page.getByRole("heading", { name: "jadwal", exact: true }).waitFor();
  assert.equal(await sidebar.evaluate((element) => element.isConnected), true);
  assert.deepEqual(documents, ["/dashboard"]);
  // A later click wins even if the previous destination has a slow response.
  dataRequests.length = 0;
  await page
    .getByRole("link", { name: "Jurnal pembelajaran", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Jurnal pembelajaran", exact: true })
    .waitFor();
  await page
    .getByRole("link", { name: "Akun dan profil", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "akun", exact: true })
    .waitFor({ timeout: 1500 });
  await page.getByText("Data halaman siap", { exact: true }).waitFor();
  assert.deepEqual([...new Set(dataRequests)], ["/api/data/akun"]);
  assert.equal(
    await page.locator('[data-slot="navigation-pending"]').count(),
    0,
  );
  assert.equal(await sidebar.evaluate((element) => element.isConnected), true);
  await page.setViewportSize({ width: 375, height: 850 });
  await page
    .getByRole("button", { name: "Buka navigasi", exact: true })
    .click();
  const drawer = page.getByRole("dialog", { name: "Navigasi SiM-Guru" });
  await drawer
    .getByRole("link", { name: "Jurnal pembelajaran", exact: true })
    .click();
  await page.getByRole("heading", { name: "jurnal", exact: true }).waitFor();
  await drawer.waitFor({ state: "hidden" });
  assert.deepEqual(documents, ["/dashboard"]);
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  await page
    .getByRole("button", { name: "Buka navigasi", exact: true })
    .click();
  await drawer
    .getByRole("link", { name: "Jurnal pembelajaran", exact: true })
    .click();
  await drawer.waitFor({ state: "hidden" });
  assert.equal(
    await page.locator('[data-slot="navigation-pending"]').count(),
    0,
  );
  // Resizing an open mobile modal must release its inert desktop background.
  await page
    .getByRole("button", { name: "Buka navigasi", exact: true })
    .click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await drawer.waitFor({ state: "hidden" });
  await page
    .getByRole("link", { name: "Jadwal mengajar", exact: true })
    .click();
  const context = page.getByTestId("url-context");
  await context.getByText("active:1", { exact: true }).waitFor();
  await page.getByLabel("Status fixture").selectOption("closed");
  await context.getByText("closed:1", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Halaman fixture berikutnya" })
    .click();
  await context.getByText("closed:2", { exact: true }).waitFor();
  assert.equal(await sidebar.evaluate((node) => node.isConnected), true);
  await page.goBack();
  await context.getByText("closed:1", { exact: true }).waitFor();
  await page.goForward();
  await context.getByText("closed:2", { exact: true }).waitFor();
  await page.reload();
  await context.getByText("closed:2", { exact: true }).waitFor();
  const sharedUrl = page.url();
  await page.goto(sharedUrl);
  await context.getByText("closed:2", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Reset fixture" }).click();
  await context.getByText("active:1", { exact: true }).waitFor();
  assert.equal(new URL(page.url()).search, "");
  await page.goto(baseUrl + "/jadwal?page=-1&state=bad");
  await context.getByText("active:1", { exact: true }).waitFor();
  // Revocation still discards the entire protected tree and redirects to login.
  await page.route("**/api/auth/session", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({
            ok: false,
            error: { message: "Sesi fixture berakhir" },
          }),
        })
      : route.continue(),
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.waitForURL("**/login?status=expired");
  await page.getByRole("heading", { name: "Login fixture" }).waitFor();
  assert.equal(await page.getByRole("complementary").count(), 0);
  assert.deepEqual(errors, []);
  await mkdir(output, { recursive: true });
  const result = {
    result: "passed",
    mode: production ? "production-build" : "development",
    clickFeedbackMs,
    delayedResponseMs: 1800,
    immediateDestinationState: true,
    latestClickWins: true,
    initialDocumentRequests: 1,
    persistentSidebar: true,
    persistentTopbar: true,
    persistentMain: true,
    targetDataOnly: true,
    searchAndCollapseRetained: true,
    accountAndBackNavigation: true,
    mobileDrawer: true,
    currentMenuClosesDrawer: true,
    expiredSessionRedirect: true,
    urlFiltersBackForwardReloadShareReset: true,
    mobileResizeReleasesModal: true,
    pageErrors: errors,
  };
  await writeFile(
    resolve(output, "results.json"),
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
