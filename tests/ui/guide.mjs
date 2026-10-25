/** Production-build guide tests with synthetic sessions; no credentials or business writes. */
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
    if (
      m.type() === "error" &&
      !(
        /\/api\/auth\/session/.test(m.location().url) &&
        /status of (401|503)/.test(m.text())
      )
    )
      consoleErrors.push(m.text());
  });
  let state = "anonymous",
    role = "admin",
    scope = "business",
    maintenance = false;
  const authRequests = [];
  const session = () => ({
    user: {
      id:
        role === "admin"
          ? "11111111-1111-4111-8111-111111111111"
          : "22222222-2222-4222-8222-222222222222",
      username: "fixture",
      fullName: "Akun panduan sintetis",
      role,
    },
    scope,
    maintenance,
    expiresAt: "2099-01-01T00:00:00Z",
    idleExpiresAt: "2099-01-01T00:00:00Z",
    onboarding: {
      mustChangePassword: scope !== "business",
      emailVerified: true,
      securityQuestionReady: true,
    },
  });
  const routeApi = async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    if (url.pathname === "/api/auth/session") {
      authRequests.push({ path: url.pathname, method: req.method() });
      if (state === "anonymous")
        return route.fulfill({
          status: 401,
          json: {
            ok: false,
            error: { code: "UNAUTHENTICATED", message: "Sesi tidak tersedia." },
          },
        });
      if (state === "error")
        return route.fulfill({
          status: 503,
          json: {
            ok: false,
            error: {
              code: "UNAVAILABLE",
              message: "Pemeriksaan sesi terganggu.",
            },
          },
        });
      return route.fulfill({ json: { ok: true, data: session() } });
    }
    if (
      url.pathname === "/api/auth/csrf" &&
      url.searchParams.get("intent") === "session"
    ) {
      authRequests.push({ path: url.pathname, method: req.method() });
      return route.fulfill({
        json: { ok: true, data: { csrfToken: "fixture-csrf" } },
      });
    }
    if (
      url.pathname === "/api/reports/read" &&
      url.searchParams.get("kind") === "capabilities"
    )
      return route.fulfill({
        json: { ok: true, data: { admin: false, academic: false, finance: false } },
      });
    apiRequests.push(req.method() + " " + url.pathname);
    return route.abort();
  };
  await page.route("**/api/**", routeApi);
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
  await touchPage.route("**/api/**", routeApi);
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
  assert.equal(
    authRequests.some((r) => r.method === "POST"),
    false,
    "Anonymous reading must not refresh an absent session",
  );
  // The real session boundary and Next router must retain account navigation across guide visits.
  state = "authenticated";
  for (role of ["admin", "guru"]) {
    await page.context().addCookies([
      {
        name: "__Host-sim_guru_session",
        value: "A".repeat(43),
        domain: "127.0.0.1",
        path: "/",
        secure: true,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    await guide();
    await page.getByRole("button", { name: "Keluar", exact: true }).waitFor();
    assert.equal(
      await page.getByText("Akun panduan sintetis", { exact: true }).count(),
      1,
    );
    await page.evaluate(
      (account) =>
        sessionStorage.setItem(
          "sim-guru:draft:v1:guide-proof",
          JSON.stringify({
            format: 1,
            account,
            module: "journal",
            entity: "guide-proof",
            basis: "fixture",
            savedAt: Date.now(),
            state: "editing",
            values: { material: "draft tetap ada" },
          }),
        ),
      session().user.id,
    );
    assert.equal(
      await page.locator('a[href="/login"]').count(),
      0,
      "Verified accounts must not be prompted to log in again",
    );
    assert.equal(
      await page
        .getByRole("link", { name: "Kembali ke Dashboard", exact: true })
        .getAttribute("href"),
      "/dashboard",
    );
    const nav = page.locator('aside[aria-label="Sidebar desktop"]');
    assert.equal(
      await nav.getByRole("link", { name: "Dashboard", exact: true }).count(),
      1,
    );
    assert.equal(
      await nav
        .getByRole("link", { name: "Manajemen pengguna", exact: true })
        .count(),
      role === "admin" ? 1 : 0,
    );
    await nav.getByRole("link", { name: "Dashboard", exact: true }).click();
    await page.waitForURL("**/dashboard");
    await page.getByRole("button", { name: "Keluar", exact: true }).waitFor();
    await page
      .locator('aside[aria-label="Sidebar desktop"]')
      .getByRole("link", { name: "Panduan aplikasi", exact: true })
      .click();
    await page.waitForURL("**/kesiapan");
    await page
      .getByRole("heading", { name: "Panduan aplikasi", exact: true })
      .waitFor();
    assert.equal(
      await page.getByRole("button", { name: "Keluar", exact: true }).count(),
      1,
    );
    assert.equal(
      await page.evaluate(
        () =>
          JSON.parse(
            sessionStorage.getItem("sim-guru:draft:v1:guide-proof") ?? "null",
          )?.values.material,
      ),
      "draft tetap ada",
    );
    const cookie = (await page.context().cookies()).find(
      (c) => c.name === "__Host-sim_guru_session",
    );
    assert.equal(
      cookie?.value,
      "A".repeat(43),
      "Guide must not clear the session cookie",
    );
    // An unavailable session service is not a logout signal.
    state = "error";
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await page.getByText(/Pemeriksaan sesi terganggu/).waitFor();
    assert.equal(
      await page.getByRole("button", { name: "Keluar", exact: true }).count(),
      1,
    );
    assert.equal(new URL(page.url()).pathname, "/kesiapan");
    state = "authenticated";
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await page
      .getByText(/Pemeriksaan sesi terganggu/)
      .waitFor({ state: "hidden" });
    // Confirm the usual activity heartbeat and logout confirmation are present.
    await page.getByRole("button", { name: "Keluar", exact: true }).click();
    const logoutDialog = page.getByRole("dialog", {
      name: "Keluar dari SiM-Guru?",
      exact: true,
    });
    await logoutDialog.waitFor();
    await logoutDialog
      .getByRole("button", { name: "Batal", exact: true })
      .click();
    await logoutDialog.waitFor({ state: "hidden" });
    assert.equal(new URL(page.url()).pathname, "/kesiapan");
  }
  assert.ok(
    authRequests.some(
      (r) => r.path === "/api/auth/session" && r.method === "POST",
    ),
    "Authenticated guide must retain session activity renewal",
  );
  // Onboarding and maintenance can still read help without being forced to a business page.
  scope = "onboarding";
  await guide();
  await page.getByRole("button", { name: "Keluar", exact: true }).waitFor();
  assert.equal(
    await page
      .locator("aside")
      .getByRole("link", { name: "Dashboard", exact: true })
      .count(),
    0,
  );
  assert.equal(
    await page
      .locator("aside")
      .getByRole("link", { name: "Akun dan profil", exact: true })
      .count(),
    1,
  );
  assert.equal(
    await page
      .getByRole("link", { name: "Buka akun dan profil", exact: true })
      .getAttribute("href"),
    "/akun",
  );
  scope = "business";
  maintenance = true;
  await guide();
  await page.getByRole("button", { name: "Keluar", exact: true }).waitFor();
  assert.equal(new URL(page.url()).pathname, "/kesiapan");
  maintenance = false;
  state = "error";
  await guide();
  await page
    .getByRole("button", { name: "Periksa kembali sesi", exact: true })
    .waitFor();
  state = "authenticated";
  await page
    .getByRole("button", { name: "Periksa kembali sesi", exact: true })
    .click();
  await page.getByRole("button", { name: "Keluar", exact: true }).waitFor();
  state = "anonymous";
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page
    .getByRole("link", { name: "Masuk ke SiM-Guru", exact: true })
    .waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Keluar", exact: true }).count(),
    0,
    "A confirmed 401 must stop displaying an authenticated account",
  );
  assert.equal(new URL(page.url()).pathname, "/kesiapan");
  assert.equal(
    await page.evaluate(() =>
      sessionStorage.getItem("sim-guru:draft:v1:guide-proof"),
    ),
    null,
    "Confirmed expiry still clears known-account drafts",
  );
  assert.deepEqual(
    apiRequests,
    [],
    "Guide must not log in, log out, or issue business requests",
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(consoleErrors, []);
  const result = {
    matrix,
    sessionContinuity: [
      "admin",
      "guru",
      "onboarding",
      "maintenance",
      "transient-failure",
      "retry",
      "activity-heartbeat",
      "logout-cancel",
      "confirmed-expiry",
    ],
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
