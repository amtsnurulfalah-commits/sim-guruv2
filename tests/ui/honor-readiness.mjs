import assert from "node:assert/strict";
import { spawn } from "node:child_process";
const { chromium } = await import(
  process.env.UI_PLAYWRIGHT_MODULE ?? "playwright"
);
const child = spawn(
  process.execPath,
  ["--conditions=react-server", "--import", "tsx", "tests/ui/server.ts"],
  {
    env: { ...process.env, UI_FINANCE_FIXTURE: "1", UI_FINANCE_FINAL: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let logs = "",
  browser,
  page;
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
  page = await browser.newPage({ hasTouch: true });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.install({ time: new Date("2090-02-01T12:00:00+07:00") });
  const ready = () =>
    page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
  const go = async (view, role = "admin") => {
    await page.goto("http://127.0.0.1:4319/?view=" + view + "&role=" + role);
    await page.getByLabel("Periode", { exact: true }).fill("2090-01");
    await ready();
  };
  await go("finance");
  const region = () =>
    page.getByRole("region", { name: "Kesiapan honorarium", exact: true });
  await region()
    .getByText(/Periode sudah final/)
    .waitFor();
  const original = (
    await page.request.get(
      "http://127.0.0.1:4319/api/honorarium/read?kind=readiness&period=2090-01",
    )
  ).ok();
  assert.ok(original);
  // Long names, many recipients, source links and pagination are isolated to this projection.
  await page.route("**/api/honorarium/read?kind=readiness**", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.data = {
      ...body.data,
      mode: "realized",
      recipients: Array.from({ length: 45 }, (_, i) => ({
        userId: `${String(i + 1).padStart(8, "0")}-1111-4111-8111-111111111111`,
        name: "Guru" + "Panjang".repeat(25) + i,
        total: "0",
        issues: [],
        administrative: [
          {
            kind: "journal",
            date: "2090-01-02",
            source_id: "11111111-1111-4111-8111-111111111111",
            title: "Kelas VII · IPA",
            href: "/jurnal?date=2090-01-02",
          },
        ],
      })),
    };
    await route.fulfill({ response, json: body });
  });
  await region()
    .getByRole("button", { name: "Periksa ulang kesiapan" })
    .click();
  await ready();
  assert.equal(await region().locator("article").count(), 20);
  await region().getByRole("button", { name: "Berikutnya" }).click();
  await region()
    .getByText(/Halaman 2 dari 3/)
    .waitFor();
  await region().getByLabel("Cari penerima").fill("tidak ditemukan");
  await region().getByText("Tidak ada penerima yang sesuai.").waitFor();
  await region().getByLabel("Cari penerima").fill("");
  await region().locator("summary").first().click();
  assert.equal(
    await region()
      .getByRole("link", { name: "Periksa sumber dan syarat perbaikan" })
      .first()
      .getAttribute("href"),
    "/jurnal?date=2090-01-02",
  );
  for (const size of [
    { width: 1440, height: 900 },
    { width: 768, height: 1024 },
    { width: 320, height: 740 },
    { width: 740, height: 320 },
  ]) {
    await page.setViewportSize(size);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
  }
  await page.unroute("**/api/honorarium/read?kind=readiness**");
  await go("history", "guru");
  await page.getByRole("button", { name: "Buka slip", exact: true }).click();
  await ready();
  await page
    .getByRole("button", { name: "Ajukan koreksi honorarium", exact: true })
    .click();
  const dialog = () => page.getByRole("dialog");
  await dialog()
    .getByLabel("Alasan (5–500 karakter)")
    .fill("Bukti jurnal perlu diperiksa");
  await dialog()
    .getByLabel("Referensi bukti (5–1000 karakter)")
    .fill("Jurnal dan absensi pada tanggal sumber");
  for (const size of [
    { width: 1440, height: 900 },
    { width: 768, height: 1024 },
    { width: 320, height: 740 },
    { width: 740, height: 320 },
  ]) {
    await page.setViewportSize(size);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
    const box = await dialog().boundingBox();
    assert.ok(
      box.x >= 0 &&
        box.y >= 0 &&
        box.x + box.width <= size.width + 1 &&
        box.y + box.height <= size.height + 1,
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
  }
  await page.setViewportSize({ width: 320, height: 740 });
  await page.screenshot({ path: "/tmp/stage3-correction-mobile.png" });
  await dialog()
    .getByRole("button", { name: "Kirim permintaan koreksi", exact: true })
    .click();
  await dialog().waitFor({ state: "hidden" });
  await ready();
  const workflow = () =>
    page.getByRole("region", {
      name: "Pengajuan dan pemeriksaan koreksi",
      exact: true,
    });
  await workflow()
    .getByText(/Diajukan/)
    .first()
    .waitFor();
  await go("financeOperations");
  await page
    .getByRole("button", { name: "Mulai pemeriksaan", exact: true })
    .click();
  await ready();
  await page
    .getByRole("button", { name: "Tolak pengajuan", exact: true })
    .click();
  await dialog()
    .getByLabel("Alasan (5–500 karakter)")
    .fill("Bukti tidak sesuai dengan sumber yang diperiksa");
  assert.equal(
    await page.getByLabel("Periode", { exact: true }).isDisabled(),
    true,
  );
  await dialog()
    .getByRole("button", { name: "Konfirmasi penolakan", exact: true })
    .click();
  await dialog().waitFor({ state: "hidden" });
  await ready();
  await workflow()
    .getByRole("heading", { name: /Ditolak/ })
    .waitFor();
  assert.equal(
    await workflow()
      .getByRole("button", { name: "Siapkan persetujuan koreksi" })
      .count(),
    0,
  );
  await go("history", "guru");
  await page.getByRole("button", { name: "Buka slip", exact: true }).click();
  await ready();
  await workflow()
    .getByRole("heading", { name: /Ditolak/ })
    .waitFor();
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      passed: true,
      cases: [
        "canonical-final-readiness",
        "long-recipients-pagination-search-empty",
        "source-date-link",
        "desktop-tablet-mobile-landscape-overflow",
        "request-evidence",
        "reviewer-rejection",
        "parent-filter-lock",
        "owner-sees-decision",
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
