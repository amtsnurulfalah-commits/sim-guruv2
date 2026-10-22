/** Public home smoke tests against the actual production Next.js build. No credentials. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
const { chromium } = await import(process.env.UI_PLAYWRIGHT_MODULE ?? "playwright");
const output = process.env.UI_REPORT_DIR ?? "../ui-home-focused";
await mkdir(output, { recursive: true });
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "4327"], { stdio: ["ignore", "pipe", "pipe"] });
let browser, stderr = "";
child.stderr.on("data", b => { stderr += b; });
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error(stderr || "Home server timeout")), 60000);
    child.stdout.on("data", b => { if (b.toString().includes("Ready in")) { clearTimeout(timer); resolve(); } });
    child.on("exit", code => { clearTimeout(timer); reject(Error(`Home server exit ${code}: ${stderr}`)); });
  });
  browser = await chromium.launch({ headless: true, ...(process.env.UI_BROWSER_EXECUTABLE ? { executablePath: process.env.UI_BROWSER_EXECUTABLE } : {}), args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const page = await browser.newPage(), errors = [], consoleErrors = [], apiRequests = [], matrix = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") consoleErrors.push(m.text()); });
  await page.route("**/api/**", route => { apiRequests.push(route.request().url()); return route.abort(); });
  const home = async () => {
    const response = await page.goto("http://127.0.0.1:4327/");
    assert.equal(response.status(), 200);
    await page.getByRole("heading", { level: 1 }).waitFor();
  };
  const bounds = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, "Horizontal viewport overflow");
  for (const width of [280, 320, 375, 767, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await home();
    for (const fontSize of [16, 32]) {
      await page.evaluate(size => { document.documentElement.style.fontSize = `${size}px`; }, fontSize);
      await bounds();
      assert.equal(await page.getByRole("main").count(), 1);
      assert.equal(await page.getByRole("banner").count(), 1);
      assert.equal(await page.getByRole("contentinfo").count(), 1);
      assert.equal(await page.getByRole("heading", { level: 1 }).count(), 1);
      assert.equal(await page.getByRole("list", { name: "Tiga langkah menggunakan SiM-Guru" }).getByRole("listitem").count(), 3);
      const guide = page.getByRole("link", { name: "Panduan penggunaan SiM-Guru", exact: true });
      assert.equal(await guide.getAttribute("href"), "/kesiapan");
      assert.ok((await guide.boundingBox()).height >= 44);
      const login = page.getByRole("link", { name: "Masuk ke SiM-Guru", exact: true });
      assert.equal(await login.getAttribute("href"), "/login");
      assert.equal(await login.evaluate(e => e.scrollHeight > e.clientHeight + 1), false, "Clipped login text");
      assert.ok(await page.locator("header a > span > span").first().evaluate(e => e.getBoundingClientRect().width >= parseFloat(getComputedStyle(document.documentElement).fontSize) * 2.5 - 1));
      assert.ok(await page.locator("footer").evaluate(e => e.getBoundingClientRect().bottom >= innerHeight - 1));
      matrix.push({ width, fontSize });
      if ([375, 1440].includes(width) && fontSize === 16) await page.screenshot({ path: `${output}/home-${width}.png`, fullPage: true, animations: "disabled" });
    }
  }
  // Real root-layout skip link: keyboard focus moves to main, then the login CTA.
  await page.setViewportSize({ width: 375, height: 812 }); await home();
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), "Lewati ke konten utama");
  await page.keyboard.press("Enter");
  assert.equal(await page.evaluate(() => document.activeElement.id), "konten-utama");
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute("href")), "/login");
  assert.equal(await page.evaluate(() => { const style = getComputedStyle(document.activeElement); return style.outlineStyle !== "none" || style.boxShadow !== "none"; }), true);
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute("href")), "/kesiapan");
  // Reflow on resize/orientation and a tall desktop viewport with short content.
  for (const viewport of [{ width: 812, height: 375 }, { width: 320, height: 568 }, { width: 1440, height: 1600 }]) {
    await page.setViewportSize(viewport); await bounds();
    assert.ok(await page.locator("footer").evaluate(e => e.getBoundingClientRect().bottom >= innerHeight - 1));
    await page.locator("footer").scrollIntoViewIfNeeded();
    assert.equal(await page.locator("footer").isVisible(), true);
    await page.evaluate(() => scrollTo(0, 0));
  }
  // Public home should remain readable in print despite the app's finance-only print stylesheet.
  await page.emulateMedia({ media: "print" });
  assert.equal(await page.getByRole("heading", { level: 1 }).evaluate(e => getComputedStyle(e).visibility), "visible");
  await page.emulateMedia({ media: "screen", reducedMotion: "reduce" }); await bounds();
  // The public page is rendered by the server: content and links remain available without JS.
  const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 700 } });
  const staticPage = await noJs.newPage();
  assert.equal((await staticPage.goto("http://127.0.0.1:4327/")).status(), 200);
  await staticPage.getByRole("heading", { name: /Administrasi tertata/ }).waitFor();
  assert.equal(await staticPage.getByRole("link", { name: "Masuk ke SiM-Guru", exact: true }).getAttribute("href"), "/login");
  assert.equal(await staticPage.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
  await noJs.close();
  // Native anchors support touch even without the client router. Check all original destinations.
  const touch = await browser.newContext({ hasTouch: true, isMobile: true, javaScriptEnabled: false, viewport: { width: 375, height: 812 } });
  const touchPage = await touch.newPage();
  for (const [name, destination] of [["SiM-Guru, beranda", "/"], ["Masuk ke SiM-Guru", "/login"], ["Panduan penggunaan SiM-Guru", "/kesiapan"]]) {
    await touchPage.goto("http://127.0.0.1:4327/");
    await touchPage.route(`http://127.0.0.1:4327${destination}`, route => route.fulfill({ contentType: "text/html", body: "<main>Tujuan navigasi sintetis</main>" }), { times: 1 });
    await touchPage.getByRole("link", { name, exact: true }).tap();
    await touchPage.getByText("Tujuan navigasi sintetis").waitFor();
    assert.equal(new URL(touchPage.url()).pathname, destination);
  }
  await touch.close();
  assert.deepEqual(apiRequests, [], "Home must not require authenticated/data APIs");
  assert.deepEqual(errors, []); assert.deepEqual(consoleErrors, []);
  await writeFile(`${output}/results.json`, JSON.stringify({ matrix, keyboard: true, touchLinks: 3, noJavaScript: true, print: true, resize: true, apiRequests, errors, consoleErrors, result: "passed" }, null, 2));
  console.log(JSON.stringify({ matrix: matrix.length, errors: errors.length, consoleErrors: consoleErrors.length, result: "passed" }));
} finally { await browser?.close(); child.kill("SIGTERM"); }
