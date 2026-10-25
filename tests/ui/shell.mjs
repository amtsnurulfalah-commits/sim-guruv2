/** Real production shell with synthetic API sessions; no credentials or business writes. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
const { chromium } = await import(
  process.env.UI_PLAYWRIGHT_MODULE ?? "playwright"
);
const origin = "http://127.0.0.1:4357";
const output = process.env.UI_REPORT_DIR ?? "../ui-shell-focused";
await mkdir(output, { recursive: true });
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "4357",
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let browser,
  stderr = "";
child.stderr.on("data", (b) => (stderr += b));
const result = { matrix: [], errors: [], consoleErrors: [], writes: [] };
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(Error(stderr || "Shell server timeout")),
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
      reject(Error(`Shell server exit ${code}: ${stderr}`));
    });
  });
  browser = await chromium.launch({
    headless: true,
    ...(process.env.UI_BROWSER_EXECUTABLE
      ? { executablePath: process.env.UI_BROWSER_EXECUTABLE }
      : {}),
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--no-zygote",
      "--disable-gpu",
    ],
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  let role = "admin",
    scope = "business",
    anonymous = false,
    capMode = "denied",
    capDelay = 0;
  const userId = "11111111-1111-4111-8111-111111111111";
  const session = () => ({
    user: {
      id: userId,
      username: "shell.fixture",
      fullName: "Nama pengguna " + "SangatPanjang".repeat(80),
      role,
    },
    scope,
    maintenance: false,
    expiresAt: "2099-01-01T00:00:00Z",
    idleExpiresAt: "2099-01-01T00:00:00Z",
    onboarding: {
      mustChangePassword: scope !== "business",
      emailVerified: true,
      securityQuestionReady: true,
    },
  });
  const watch = (p) => {
    p.on("pageerror", (e) => result.errors.push(e.message));
    p.on("console", (m) => {
      if (
        m.type() === "error" &&
        !(
          /status of 404/.test(m.text()) && /shell-audit/.test(m.location().url)
        ) &&
        !(
          /status of (401|503)/.test(m.text()) &&
          /api\/auth\/session|api\/reports\/read/.test(m.location().url)
        )
      )
        result.consoleErrors.push(m.text());
    });
  };
  watch(page);
  const routeApi = async (route) => {
    const req = route.request(),
      u = new URL(req.url());
    if (req.method() !== "GET") result.writes.push(u.pathname);
    if (u.pathname === "/api/auth/session")
      return route.fulfill({
        status: anonymous ? 401 : 200,
        json: anonymous
          ? {
              ok: false,
              error: {
                code: "UNAUTHENTICATED",
                message: "Sesi sintetis tidak tersedia.",
              },
            }
          : { ok: true, data: session() },
      });
    if (u.pathname === "/api/auth/csrf")
      return route.fulfill({
        json: { ok: true, data: { csrfToken: "fixture-csrf" } },
      });
    if (u.pathname === "/api/reports/read") {
      const mode = capMode,
        delay = capDelay;
      if (delay) await new Promise((r) => setTimeout(r, delay));
      return route
        .fulfill(
          mode === "error"
            ? {
                status: 503,
                json: {
                  ok: false,
                  error: {
                    code: "UNAVAILABLE",
                    message: "Kapabilitas sintetis gagal.",
                  },
                },
              }
            : {
                json: {
                  ok: true,
                  data:
                    mode === "malformed"
                      ? { academic: true }
                      : {
                          admin: false,
                          academic: mode === "allowed",
                          finance: false,
                        },
                },
              },
        )
        .catch(() => {});
    }
    return route.abort();
  };
  await context.route("**/api/**", routeApi);
  const desktop = page.getByRole("complementary", {
    name: "Sidebar desktop",
    exact: true,
  });
  const drawer = page.getByRole("dialog", {
    name: "Navigasi SiM-Guru",
    exact: true,
  });
  const trigger = page.getByRole("button", {
    name: "Buka navigasi",
    exact: true,
  });
  const go = async () => {
    const response = await page.goto(origin + "/shell-audit-fixture");
    assert.equal(response.status(), 404);
    await page
      .getByRole("heading", { name: "Halaman tidak ditemukan", exact: true })
      .waitFor();
    await page
      .getByRole(anonymous ? "link" : "button", {
        name: anonymous ? "Masuk" : "Keluar",
        exact: true,
      })
      .first()
      .waitFor();
  };
  const open = async () => {
    await trigger.click();
    await drawer.waitFor();
    assert.equal(await trigger.getAttribute("aria-expanded"), "true");
    assert.equal(
      await page.evaluate(() => getComputedStyle(document.body).overflow),
      "hidden",
    );
  };
  const closed = async () => {
    await drawer.waitFor({ state: "hidden" });
    await page.waitForFunction(
      () =>
        document
          .querySelector('[aria-label="Buka navigasi"]')
          ?.getAttribute("aria-expanded") === "false",
    );
    assert.notEqual(
      await page.evaluate(() => getComputedStyle(document.body).overflow),
      "hidden",
    );
  };
  const clear = async (nav) => {
    const b = nav.getByRole("button", { name: "Hapus pencarian", exact: true });
    if (await b.count()) await b.click();
  };
  const bounds = async () => {
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
      "Horizontal document overflow",
    );
    const header = await page.getByRole("banner").boundingBox();
    assert.ok(
      header.height < page.viewportSize().height,
      "Navbar covers viewport",
    );
    assert.equal(await page.locator("main").count(), 1);
    assert.equal(
      await page
        .getByRole("contentinfo")
        .evaluate((n) => n.scrollWidth > n.clientWidth + 1),
      false,
    );
  };
  const navSearch = async (nav, query, count) => {
    await nav
      .getByRole("searchbox", { name: "Cari menu", exact: true })
      .fill(query);
    const status = nav
      .getByRole("status")
      .filter({ hasText: "menu sesuai pencarian" });
    assert.match(
      await status.textContent(),
      new RegExp(`^${count} menu sesuai pencarian`),
    );
    assert.equal(
      await nav
        .getByRole("navigation", { name: "Navigasi utama", exact: true })
        .getByRole("link")
        .count(),
      count,
    );
  };
  for (const variant of ["admin", "guru", "onboarding", "anonymous"]) {
    role = variant === "admin" ? "admin" : "guru";
    scope = variant === "onboarding" ? "onboarding" : "business";
    anonymous = variant === "anonymous";
    for (const [width, height] of [
      [280, 740],
      [375, 812],
      [768, 1024],
      [1024, 768],
      [1440, 900],
      [1920, 1080],
      [812, 375],
    ])
      for (const scale of [1, 2]) {
        await page.setViewportSize({ width, height });
        await go();
        await page.addStyleTag({
          content: `html{font-size:${16 * scale}px!important}`,
        });
        await bounds();
        let nav = desktop;
        if (width < 1024) {
          await open();
          nav = drawer;
          const dimensions = await drawer.evaluate((n) => {
            const rect = n.getBoundingClientRect(),
              body = n.lastElementChild;
            return {
              right: rect.right,
              bottom: rect.bottom,
              width: rect.width,
              scroll: body.scrollHeight,
              bodyHeight: body.clientHeight,
              bodyBottom: body.getBoundingClientRect().bottom,
              drawerOverflow: n.scrollHeight > n.clientHeight + 1,
            };
          });
          assert.ok(
            dimensions.right <= width + 1 && dimensions.bottom <= height + 1,
          );
          assert.equal(
            dimensions.drawerOverflow,
            false,
            "Drawer header pushes content outside",
          );
          assert.ok(dimensions.bodyBottom <= height + 1);
          await nav
            .getByRole("link", { name: "Panduan aplikasi", exact: true })
            .scrollIntoViewIfNeeded();
          const helpBox = await nav
            .getByRole("link", { name: "Panduan aplikasi", exact: true })
            .boundingBox();
          assert.ok(
            helpBox.y + helpBox.height <= height + 1,
            JSON.stringify({
              variant,
              width,
              height,
              scale,
              helpBox,
              dimensions,
            }),
          );
        }
        if (variant === "admin" || variant === "guru")
          await navSearch(nav, "Dashboard", 1);
        await navSearch(nav, "Panduan", 1);
        await navSearch(nav, "menu-tidak-ada", 0);
        await clear(nav);
        if (
          variant === "guru" ||
          variant === "onboarding" ||
          variant === "anonymous"
        )
          assert.equal(
            await nav
              .getByRole("link", { name: "Manajemen pengguna", exact: true })
              .count(),
            0,
          );
        if (variant === "onboarding" || variant === "anonymous")
          assert.equal(
            await nav
              .getByRole("link", { name: "Dashboard", exact: true })
              .count(),
            0,
          );
        if (width < 1024) {
          await drawer
            .getByRole("button", { name: "Tutup navigasi", exact: true })
            .click();
          await closed();
          assert.equal(
            await trigger.evaluate((n) => n === document.activeElement),
            true,
          );
        }
        result.matrix.push({ variant, width, height, scale });
        if (
          variant === "admin" &&
          scale === 1 &&
          (width === 375 || width === 1440)
        )
          await page.screenshot({
            path: `${output}/shell-${width}.png`,
            fullPage: true,
            animations: "disabled",
          });
      }
  }
  anonymous = false;
  scope = "business";
  role = "admin";
  await page.setViewportSize({ width: 1440, height: 1600 });
  await go();
  // Searching opens a closed section instead of hiding its matching links.
  const section = desktop.locator("details").filter({
    has: page.locator("summary").filter({ hasText: "Pembelajaran" }),
  });
  await section.locator("summary").click();
  assert.equal(await section.getAttribute("open"), null);
  await navSearch(desktop, "jurnal", 1);
  assert.equal(
    await desktop
      .getByRole("link", { name: "Jurnal pembelajaran", exact: true })
      .isVisible(),
    true,
  );
  await clear(desktop);
  await navSearch(
    desktop,
    "Administrasi",
    await desktop
      .locator("details")
      .filter({
        has: page.locator("summary").filter({ hasText: "Administrasi" }),
      })
      .getByRole("link")
      .count(),
  );
  await clear(desktop);
  // Footer reaches the viewport bottom for short pages without becoming fixed.
  const footer = await page.getByRole("contentinfo").boundingBox();
  assert.ok(Math.abs(footer.y + footer.height - 1600) <= 1);
  await desktop
    .getByRole("button", { name: "Ciutkan sidebar", exact: true })
    .click();
  await desktop
    .getByRole("button", { name: "Perluas sidebar", exact: true })
    .waitFor();
  assert.equal(
    await desktop
      .getByRole("button", { name: "Perluas sidebar", exact: true })
      .getAttribute("aria-expanded"),
    "false",
  );
  const compactBrand = desktop.getByRole("link", {
    name: "SiM-Guru, halaman utama",
    exact: true,
  });
  assert.ok((await compactBrand.boundingBox()).height >= 44);
  await page.reload();
  await page.getByRole("button", { name: "Keluar", exact: true }).waitFor();
  await desktop
    .getByRole("button", { name: "Perluas sidebar", exact: true })
    .waitFor();
  await desktop
    .getByRole("button", { name: "Perluas sidebar", exact: true })
    .click();
  // Escape/backdrop/drag, focus restoration, inertness and breakpoint cleanup.
  await page.setViewportSize({ width: 375, height: 812 });
  await open();
  await page.keyboard.press("Escape");
  await closed();
  assert.equal(
    await trigger.evaluate((n) => n === document.activeElement),
    true,
  );
  await open();
  await page.mouse.click(371, 200);
  await closed();
  await open();
  const title = await drawer
    .getByRole("heading", { name: "Navigasi SiM-Guru", exact: true })
    .boundingBox();
  await page.mouse.move(title.x + 5, title.y + 5);
  await page.mouse.down();
  await page.mouse.move(371, 200);
  await page.mouse.up();
  assert.equal(await drawer.isVisible(), true);
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("Tab");
    assert.equal(
      await drawer.evaluate((n) => n.contains(document.activeElement)),
      true,
    );
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await closed();
  assert.equal(
    await page.locator("main").evaluate((n) => n === document.activeElement),
    true,
  );
  await page.setViewportSize({ width: 375, height: 812 });
  await open();
  await page.evaluate(() => history.pushState(null, "", "/shell-audit-other"));
  await closed();
  // A stale allowed response or a failed recheck cannot keep an old report menu.
  role = "guru";
  capMode = "allowed";
  await page.setViewportSize({ width: 1440, height: 900 });
  await go();
  await desktop
    .getByRole("link", { name: "Laporan pimpinan", exact: true })
    .waitFor();
  await page.evaluate(() => history.pushState(null, "", "/laporan-pimpinan"));
  await desktop
    .getByRole("link", { name: "Laporan pimpinan", exact: true })
    .waitFor();
  await page
    .getByRole("navigation", { name: "Jejak navigasi" })
    .getByText("Laporan pimpinan", { exact: true })
    .waitFor();
  for (const mode of ["error", "malformed", "denied"]) {
    capMode = mode;
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/reports/read")),
      page.evaluate(
        (path) => history.pushState(null, "", path),
        "/shell-audit-" + mode,
      ),
    ]);
    await page.waitForFunction(
      () =>
        ![...document.querySelectorAll("aside a")].some(
          (n) => n.textContent === "Laporan pimpinan",
        ),
    );
    if (mode !== "denied") {
      await desktop
        .getByRole("button", { name: "Periksa izin laporan", exact: true })
        .waitFor();
      capMode = "allowed";
      await desktop
        .getByRole("button", { name: "Periksa izin laporan", exact: true })
        .click();
      await desktop
        .getByRole("link", { name: "Laporan pimpinan", exact: true })
        .waitFor();
    }
  }
  capMode = "allowed";
  capDelay = 700;
  await Promise.all([
    page.waitForRequest((r) => r.url().includes("/api/reports/read")),
    page.evaluate(() => history.pushState(null, "", "/shell-audit-slow")),
  ]);
  await page.waitForTimeout(30);
  capMode = "denied";
  capDelay = 0;
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/reports/read")),
    page.evaluate(() => history.pushState(null, "", "/shell-audit-fast")),
  ]);
  await page.waitForTimeout(850);
  assert.equal(
    await desktop
      .getByRole("link", { name: "Laporan pimpinan", exact: true })
      .count(),
    0,
  );
  // Optional browser storage must not break collapse or navigation.
  const restricted = await browser.newContext();
  await restricted.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw Error("Storage disabled");
    };
    Storage.prototype.setItem = () => {
      throw Error("Storage disabled");
    };
  });
  await restricted.route("**/api/**", routeApi);
  const rp = await restricted.newPage();
  watch(rp);
  await rp.setViewportSize({ width: 1440, height: 900 });
  await rp.goto(origin + "/shell-audit-fixture");
  await rp.getByRole("button", { name: "Keluar", exact: true }).waitFor();
  await rp
    .getByRole("button", { name: "Ciutkan sidebar", exact: true })
    .click();
  await rp
    .getByRole("button", { name: "Perluas sidebar", exact: true })
    .click();
  await restricted.close();
  const touch = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
  });
  await touch.route("**/api/**", routeApi);
  const tp = await touch.newPage();
  watch(tp);
  await tp.goto(origin + "/shell-audit-fixture");
  await tp.getByRole("button", { name: "Keluar", exact: true }).waitFor();
  await tp.getByRole("button", { name: "Buka navigasi", exact: true }).tap();
  await tp
    .getByRole("dialog", { name: "Navigasi SiM-Guru" })
    .getByRole("link", { name: "Panduan aplikasi", exact: true })
    .scrollIntoViewIfNeeded();
  await tp.getByRole("button", { name: "Tutup navigasi", exact: true }).tap();
  await touch.close();
  assert.ok(!result.writes.includes("/api/auth/logout"));
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.consoleErrors, []);
  await writeFile(`${output}/results.json`, JSON.stringify(result, null, 2));
  console.log(
    JSON.stringify({
      ok: true,
      matrix: result.matrix.length,
      pageErrors: result.errors.length,
      consoleErrors: result.consoleErrors.length,
      scenarios:
        "roles, long identity, text200, search count/groups, footer, collapse/storage, dialog geometry/focus/Escape/backdrop/drag/resize/route, capabilities deny/malformed/stale, touch",
    }),
  );
} finally {
  await browser?.close();
  child.kill("SIGTERM");
}
