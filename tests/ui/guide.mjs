/** Public guide against a production build; no credentials, business writes or data APIs. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
const { chromium } = await import(
  process.env.UI_PLAYWRIGHT_MODULE ?? "playwright"
);
const output = process.env.UI_REPORT_DIR ?? "../ui-guide-focused";
await mkdir(output, { recursive: true });
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "4337",
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let browser,
  stderr = "";
child.stderr.on("data", (b) => {
  stderr += b;
});
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(Error(stderr || "Guide server timeout")),
      60000,
    );
    child.stdout.on("data", (b) => {
      if (b.toString().includes("Ready in")) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(Error(`Guide server exit ${code}: ${stderr}`));
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
    apiRequests = [],
    matrix = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  await page.route("**/api/**", (route) => {
    apiRequests.push(route.request().url());
    return route.abort();
  });
  const guide = async () => {
    const response = await page.goto("http://127.0.0.1:4337/kesiapan");
    assert.equal(response.status(), 200);
    await page
      .getByRole("heading", { name: "Panduan aplikasi", exact: true })
      .waitFor();
    assert.match(await page.title(), /^Panduan aplikasi/);
  };
  const bounds = async () => {
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
      "Horizontal viewport overflow",
    );
    const clipped = await page.locator(".application-guide").evaluate((root) =>
      [...root.querySelectorAll("p,h1,h2,h3,summary,a")]
        .filter((e) => e.scrollWidth > e.clientWidth + 1)
        .map((e) => ({
          tag: e.tagName,
          text: e.textContent,
          width: e.clientWidth,
          scroll: e.scrollWidth,
        })),
    );
    assert.deepEqual(
      clipped,
      [],
      `Clipped guide text at ${JSON.stringify(page.viewportSize())}`,
    );
  };
  for (const width of [280, 320, 375, 767, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await guide();
    for (const fontSize of [16, 32]) {
      await page.evaluate((size) => {
        document.documentElement.style.fontSize = `${size}px`;
      }, fontSize);
      await bounds();
      assert.equal(await page.getByRole("main").count(), 1);
      assert.equal(await page.getByRole("heading", { level: 1 }).count(), 1);
      const modules = page.getByRole("region", {
        name: "Modul SiM-Guru",
        exact: true,
      });
      assert.equal(
        await modules.getByRole("article").count(),
        18,
        "All original module descriptions remain available",
      );
      assert.equal(
        await modules
          .getByText("Khusus administrator", { exact: true })
          .count(),
        8,
      );
      assert.equal(
        await modules
          .getByText("Administrator atau pemegang izin laporan", {
            exact: true,
          })
          .count(),
        1,
      );
      assert.equal(
        await modules.getByRole("link").count(),
        0,
        "Public guide must not suggest private module access",
      );
      for (const link of await page
        .getByRole("navigation", { name: "Daftar isi panduan" })
        .getByRole("link")
        .all()) {
        assert.ok((await link.boundingBox()).height >= 44);
        const hash = await link.getAttribute("href");
        assert.equal(
          await page.locator(hash).count(),
          1,
          "Every anchor has one destination",
        );
      }
      for (const summary of await page.locator(".guide-question summary").all())
        assert.ok((await summary.boundingBox()).height >= 44);
      matrix.push({ width, fontSize });
      if ([375, 1440].includes(width) && fontSize === 16)
        await page.screenshot({
          path: `${output}/guide-${width}.png`,
          fullPage: true,
          animations: "disabled",
        });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await guide();
  // Native section anchors move focus to a readable heading, including under the sticky topbar.
  for (const link of await page
    .getByRole("navigation", { name: "Daftar isi panduan" })
    .getByRole("link")
    .all()) {
    await link.click();
    const id = (await link.getAttribute("href")).slice(1);
    assert.equal(await page.evaluate(() => document.activeElement.id), id);
    assert.ok(
      await page
        .locator(`#${id}`)
        .evaluate(
          (e) =>
            e.getBoundingClientRect().top >=
            document.querySelector(".ui-topbar").getBoundingClientRect().bottom,
        ),
      "Anchor target behind topbar",
    );
  }
  // Repeated keyboard open/close needs no custom listener or async state.
  const questions = page.locator(".guide-question");
  for (const question of await questions.all()) {
    const summary = question.locator("summary");
    await summary.focus();
    for (let i = 0; i < 2; i++) {
      await page.keyboard.press("Enter");
      assert.equal(await question.evaluate((e) => e.open), true);
      assert.equal(await question.locator("p").isVisible(), true);
      await page.keyboard.press("Space");
      assert.equal(await question.evaluate((e) => e.open), false);
    }
  }
  // Print must include answers even when disclosures were closed on screen.
  await page.emulateMedia({ media: "print" });
  assert.equal(
    await page
      .getByRole("heading", { level: 1 })
      .evaluate((e) => getComputedStyle(e).visibility),
    "visible",
  );
  for (const question of await questions.all())
    assert.equal(
      await question.locator("p").isVisible(),
      true,
      "Closed FAQ missing from print",
    );
  assert.equal(await page.locator(".ui-sidebar").isVisible(), false);
  await page.pdf({
    path: `${output}/guide.pdf`,
    format: "A4",
    printBackground: true,
  });
  await page.emulateMedia({ media: "screen", reducedMotion: "reduce" });
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 812, height: 375 },
    { width: 1440, height: 1600 },
  ]) {
    await page.setViewportSize(viewport);
    await bounds();
    await page.locator("footer").scrollIntoViewIfNeeded();
    assert.ok(
      await page
        .locator("footer")
        .evaluate((e) => e.getBoundingClientRect().bottom <= innerHeight + 1),
      "Footer must remain reachable",
    );
  }
  // The framework's streamed loading shell needs JS. Without JS, give an actionable fallback.
  const noJs = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 700 },
  });
  const staticPage = await noJs.newPage();
  assert.equal(
    (await staticPage.goto("http://127.0.0.1:4337/kesiapan")).status(),
    200,
  );
  assert.equal(
    await staticPage.getByText(/Halaman ini memerlukan JavaScript/).isVisible(),
    true,
  );
  await staticPage
    .getByRole("link", { name: "kembali ke beranda", exact: true })
    .click();
  await staticPage.getByRole("heading", { level: 1 }).waitFor();
  assert.equal(new URL(staticPage.url()).pathname, "/");
  await noJs.close();
  // Touch interactions use the real production markup; no data APIs are required.
  const touch = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 375, height: 812 },
  });
  const touchPage = await touch.newPage();
  await touchPage.goto("http://127.0.0.1:4337/kesiapan");
  await touchPage
    .getByRole("link", { name: "Bantuan dan kendala", exact: true })
    .tap();
  const referenceQuestion = touchPage.getByText(
    "Bagaimana menggunakan kode referensi bantuan?",
    { exact: true },
  );
  await referenceQuestion.tap();
  assert.equal(
    await touchPage
      .getByText(/Salin kode referensi bantuan lengkap/)
      .isVisible(),
    true,
  );
  for (const [name, destination] of [
    ["Masuk ke SiM-Guru", "/login"],
    ["Buka pemulihan akun", "/lupa-password"],
  ])
    assert.equal(
      await touchPage
        .getByRole("link", { name, exact: true })
        .getAttribute("href"),
      destination,
    );
  await touch.close();
  assert.deepEqual(apiRequests, [], "Public guide must not call private APIs");
  assert.deepEqual(errors, []);
  assert.deepEqual(consoleErrors, []);
  const result = {
    matrix,
    keyboard: true,
    disclosures: 5,
    touch: true,
    noJavaScriptFallback: true,
    print: true,
    resize: true,
    apiRequests,
    errors,
    consoleErrors,
    result: "passed",
  };
  await writeFile(`${output}/results.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ...result, matrix: matrix.length }));
} finally {
  await browser?.close();
  child.kill("SIGTERM");
}
