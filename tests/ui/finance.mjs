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
    env: { ...process.env, UI_FINANCE_FIXTURE: "1" },
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
    if (
      m.type() === "error" &&
      !/Failed to load resource: the server responded with a status of (422|503)/.test(
        m.text(),
      )
    )
      consoleErrors.push(m.text());
  });
  const screenshots = process.env.UI_SCREENSHOT_DIR;
  if (screenshots) await mkdir(screenshots, { recursive: true });
  const date = "2090-02-01";
  await page.clock.install({ time: new Date(date + "T12:00:00+07:00") });
  const ready = () =>
    page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
  const go = async (view = "finance", role = "admin", period = "2090-01") => {
    await page.goto(
      "http://127.0.0.1:4319/?view=" +
        view +
        "&role=" +
        role +
        "&path=" +
        encodeURIComponent(
          role === "admin" ? "/admin/honorarium" : "/honorarium",
        ),
    );
    await page
      .getByRole("heading", {
        name:
          view === "financeOperations"
            ? "Bonus libur dan transportasi"
            : view === "history"
              ? "Riwayat dan slip honorarium"
              : role === "admin"
                ? "Rekap honorarium"
                : "Honorarium saya",
        exact: true,
      })
      .waitFor();
    await ready();
    if (period !== date.slice(0, 7)) {
      await page.getByLabel("Periode", { exact: true }).fill(period);
      await ready();
    }
  };
  const close = async () => {
    await ready();
    await page.keyboard.press("Escape");
    const discard = page.getByRole("button", {
      name: "Buang perubahan",
      exact: true,
    });
    await discard.waitFor({ state: "visible", timeout: 1000 }).catch(() => {});
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
  const btn = (name) => page.getByRole("button", { name, exact: true });
  const dialog = () => page.getByRole("dialog");
  const reason = () =>
    dialog()
      .getByLabel("Alasan (5–500 karakter)")
      .fill("Pengujian honorarium sintetis");
  const submit = async (name) => {
    await dialog().getByRole("button", { name, exact: true }).click();
    await dialog().waitFor({ state: "hidden" });
    await ready();
  };
  const preview = async (name) => {
    await dialog().getByRole("button", { name, exact: true }).click();
    await page
      .getByRole("heading", { name: "Konfirmasi pratinjau", exact: true })
      .waitFor();
    assert.equal(await dialog().count(), 1);
    await ready();
  };
  const confirm = () => submit("Konfirmasi perubahan honorarium");
  await go("financeOperations");
  // Block window validation, teacher scope, create and remove.
  await page.getByLabel("Sasaran blok transportasi").selectOption({ index: 1 });
  await btn("Tambah blok transportasi").click();
  await dialog().getByLabel("Dari tanggal").fill("2090-01-03");
  await dialog().getByLabel("Sampai tanggal").fill("2090-01-02");
  await reason();
  await dialog()
    .getByRole("button", { name: "Simpan blok transportasi", exact: true })
    .click();
  await dialog()
    .getByText("Tanggal akhir harus sama atau setelah tanggal mulai.", {
      exact: true,
    })
    .first()
    .waitFor();
  assert.equal(
    await dialog().getByLabel("Sampai tanggal").getAttribute("aria-invalid"),
    "true",
  );
  await dialog().getByLabel("Sampai tanggal").fill("2090-01-03");
  await submit("Simpan blok transportasi");
  await page
    .locator("summary")
    .filter({ hasText: "2090-01-03–2090-01-03" })
    .click();
  await btn("Nonaktifkan blok transportasi").click();
  await reason();
  await submit("Konfirmasi penonaktifan blok");
  await page
    .getByText("Tidak ada blok transportasi aktif.", { exact: true })
    .waitFor();
  const holiday = async (date, operation) => {
    await btn("Atur honorarium hari libur").click();
    await dialog().getByLabel("Tanggal libur").fill(date);
    await dialog().getByLabel("Tindakan").selectOption(operation);
    await reason();
    if (operation === "waive") await preview("Jalankan tindakan hari libur");
    else await submit("Jalankan tindakan hari libur");
  };
  await holiday("2090-01-02", "generate");
  await page.locator("summary").filter({ hasText: "Run 2090-01-02" }).click();
  await btn("Tinjau pembatalan penerbitan").click();
  await reason();
  await preview("Buat pratinjau pembatalan");
  await dialog()
    .getByText(/hak kembali tertunda/)
    .waitFor();
  await confirm();
  await holiday("2090-01-02", "generate");
  await holiday("2090-01-09", "waive");
  await dialog()
    .getByText(/tidak dihitung dalam proyeksi/)
    .waitFor();
  await confirm();
  // Finalize closed month from review; preserve one modal and disable filters.
  await go();
  await page.getByLabel("Basis perhitungan").selectOption("projection");
  await ready();
  await btn("Sembunyikan nominal").click();
  await btn("Tinjau finalisasi honorarium").click();
  assert.equal(
    await page.getByLabel("Periode", { exact: true }).isDisabled(),
    true,
  );
  await reason();
  await preview("Buat pratinjau finalisasi");
  assert.match(await dialog().innerText(), /••••/);
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 768, height: 1024 },
    { width: 320, height: 740 },
    { width: 740, height: 320 },
  ]) {
    await page.setViewportSize(viewport);
    await page.evaluate(
      () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        ),
    );
    await overflow();
    const box = await dialog().boundingBox();
    assert.ok(
      box.x >= 0 &&
        box.y >= 0 &&
        box.x + box.width <= viewport.width + 1 &&
        box.y + box.height <= viewport.height + 1,
    );
    assert.equal(
      await dialog().evaluate((el) => el.scrollWidth > el.clientWidth + 1),
      false,
    );
    if (screenshots)
      await page.screenshot({
        path: `${screenshots}/finance-review-${viewport.width}.png`,
      });
  }
  await confirm();
  await page.getByText("Periode final", { exact: true }).waitFor();
  assert.equal(await btn("Tinjau finalisasi honorarium").count(), 0);
  await go("history", "guru");
  await btn("Buka slip").click();
  await page.locator("#honor-slip").waitFor();
  await ready();
  const slipRegion = page.locator("#honor-slip");
  await slipRegion.locator("summary").filter({ hasText: "Asal perhitungan" }).click();
  await slipRegion.getByText("Final — rincian saat diterbitkan", { exact: true }).waitFor();
  await slipRegion.getByText("Referensi versi tarif JTM", { exact: true }).waitFor();
  await slipRegion.locator("summary").filter({ hasText: "Rincian sumber" }).click();
  await slipRegion.locator("summary").filter({ hasText: "Telusuri sumber" }).first().click();
  const sourceLinks = await slipRegion.locator('a[href*="?date="]').evaluateAll(nodes => nodes.map(n => n.getAttribute("href")));
  await slipRegion.getByText("Referensi sumber", { exact: true }).first().waitFor();
  // This SQL fixture contains holiday/reversal lines: keep their references without inventing a destination.
  await slipRegion.getByText("Gunakan referensi ini saat mengajukan koreksi pada slip atau menghubungi administrator.", { exact: true }).first().waitFor();
  assert.ok(sourceLinks.every(href => /^\/(jurnal|piket|upacara|ujian|acara\/jurnal|kehadiran)\?date=\d{4}-\d{2}-\d{2}(?:&section=history)?$/.test(href)));
  for (const width of [320, 768, 1440]) { await page.setViewportSize({ width, height: 800 }); await overflow(); }
  await slipRegion.locator("summary").filter({ hasText: "Rincian sumber" }).click();
  await slipRegion.locator("summary").filter({ hasText: "Asal perhitungan" }).click();
  await page
    .getByText(/Rp 30.003/)
    .first()
    .waitFor();
  await btn("Buat tautan verifikasi").click();
  await ready();
  const link = await page
    .locator('#honor-slip a[href*="verifikasi-dokumen#"]')
    .getAttribute("href");
  assert.match(link, /#([a-f0-9]{96})$/);
  const proof = await page.evaluate(
    async (token) =>
      (
        await fetch("/api/honorarium/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        })
      ).json(),
    link.split("#")[1],
  );
  assert.equal(proof.data.status, "valid");
  assert.equal("total" in proof.data, false);
  const pdfEvent = page.waitForEvent("download");
  await btn("Unduh PDF terverifikasi").click();
  const pdf = await pdfEvent;
  const { readFile } = await import("node:fs/promises");
  assert.equal(
    (await readFile(await pdf.path())).subarray(0, 4).toString(),
    "%PDF",
  );
  await ready();
  const excelEvent = page.waitForEvent("download");
  await btn("Ekspor Excel (semua hasil filter)").click();
  const excel = await excelEvent;
  assert.equal(
    (await readFile(await excel.path())).readUInt32LE(0),
    0x04034b50,
  );
  await ready();
  await btn("Ajukan koreksi honorarium").click();
  await reason();
  await dialog()
    .getByLabel("Referensi bukti (5–1000 karakter)")
    .fill("Bukti pembelajaran sintetis");
  await submit("Kirim permintaan koreksi");
  // Print only the selected slip; requests/form triggers are hidden in print.
  await page.emulateMedia({ media: "print" });
  assert.equal(await btn("Ajukan koreksi honorarium").isVisible(), false);
  await page.emulateMedia({ media: "screen" });
  await page.getByLabel("Periode", { exact: true }).fill("2090-02");
  await ready();
  assert.equal(await page.locator("#honor-slip").count(), 0);
  assert.equal(
    await page.getByText("Belum ada slip final.", { exact: true }).count(),
    1,
  );
  await go("history");
  await btn("Buka slip").click();
  await ready();
  await btn("Mulai pemeriksaan").click();
  await ready();
  await btn("Siapkan persetujuan koreksi").click();
  await dialog().getByLabel("Periode tujuan (YYYY-MM)").fill("2090-01");
  await dialog()
    .getByLabel("Referensi bukti keputusan")
    .fill("Bukti pembelajaran sintetis");
  await reason();
  await dialog()
    .getByRole("button", { name: "Buat pratinjau persetujuan", exact: true })
    .click();
  await dialog()
    .getByText(/Data honorarium|Periode tujuan/)
    .first()
    .waitFor();
  await dialog().getByLabel("Periode tujuan (YYYY-MM)").fill("2090-02");
  await dialog().getByLabel("Total JTM yang benar").fill("4");
  await preview("Buat pratinjau persetujuan");
  await dialog().getByText("Rp 10.001", { exact: true }).waitFor();
  await confirm();
  await page
    .getByText(/Guru Panjang.*Disetujui|Disetujui/)
    .first()
    .waitFor();
  // Current period may be previewed with issues but must never be confirmed.
  await go("finance", "admin", "2090-02");
  await btn("Tinjau finalisasi honorarium").click();
  await reason();
  await preview("Buat pratinjau finalisasi");
  await dialog()
    .getByText("Periode belum berakhir.", { exact: true })
    .waitFor();
  assert.equal(await btn("Konfirmasi perubahan honorarium").isDisabled(), true);
  await close();
  // Expiry disables confirmation based on actual expiry, not a fixed explanation.
  const expire = async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.data.expiresAt = new Date(
      (await page.evaluate(() => Date.now())) + 1000,
    ).toISOString();
    await route.fulfill({ response, json: body });
  };
  await page.route("**/api/honorarium/preview", expire);
  await btn("Tinjau finalisasi honorarium").click();
  await reason();
  await preview("Buat pratinjau finalisasi");
  await page.clock.fastForward(2000);
  await dialog()
    .getByText(/Pratinjau kedaluwarsa/)
    .waitFor();
  assert.equal(await btn("Konfirmasi perubahan honorarium").isDisabled(), true);
  await close();
  await page.unroute("**/api/honorarium/preview", expire);
  // Malformed read must remove old calculations, and retry recovers.
  let fail = true;
  const broken = async (route) => {
    if (
      fail &&
      ["recap", "estimate"].includes(
        new URL(route.request().url()).searchParams.get("kind"),
      )
    ) {
      fail = false;
      await route.fulfill({
        status: 200,
        json: { ok: true, data: { statements: null } },
      });
    } else await route.continue();
  };
  await page.route("**/api/honorarium/read?**", broken);
  await btn("Muat ulang honorarium").click();
  await ready();
  await page
    .getByText(/Hasil honorarium belum dapat diverifikasi/)
    .first()
    .waitFor();
  assert.equal(await btn("Tinjau finalisasi honorarium").count(), 0);
  await btn("Muat ulang honorarium").click();
  await ready();
  await btn("Tinjau finalisasi honorarium").waitFor();
  await page.unroute("**/api/honorarium/read?**", broken);
  // Ambiguous write keeps the form and disables resubmission until reload.
  await go("financeOperations");
  let writes = 0;
  const unavailable = async (route) => {
    writes++;
    await route.fulfill({
      status: 503,
      json: {
        ok: false,
        error: { code: "UNAVAILABLE", message: "Layanan uji sementara gagal" },
      },
    });
  };
  await page.route("**/api/honorarium/block", unavailable);
  await btn("Tambah blok transportasi").click();
  await reason();
  await dialog()
    .getByRole("button", { name: "Simpan blok transportasi", exact: true })
    .click();
  await dialog()
    .getByText(/Layanan uji sementara gagal/)
    .first()
    .waitFor();
  await ready();
  assert.equal(
    await dialog()
      .getByRole("button", { name: "Simpan blok transportasi", exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(writes, 1);
  await close();
  await page.unroute("**/api/honorarium/block", unavailable);
  await btn("Muat ulang honorarium").click();
  await ready();
  // Server-paged history retains filter scope and clears an open slip.
  let firstHistory;
  const paged = async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const query = new URL(route.request().url()).searchParams;
    if (query.get("kind") === "history" && query.get("period") === "2090-01") {
      firstHistory ??= body.data.items[0];
      const pageNo = Number(query.get("page") ?? 1);
      body.data = {
        ...body.data,
        total: 45,
        page: pageNo,
        items: Array.from({ length: pageNo === 3 ? 5 : 20 }, (_, i) => ({
          ...firstHistory,
          id: `${String((pageNo - 1) * 20 + i + 1).padStart(8, "0")}-1111-4111-8111-111111111111`,
          name: "Guru halaman " + pageNo + " " + i,
        })),
      };
    }
    await route.fulfill({ response, json: body });
  };
  await page.route("**/api/honorarium/read?**", paged);
  await go("history");
  await page.getByText(/Halaman 1 dari 3/).waitFor();
  await btn("Berikutnya").click();
  await ready();
  await page.getByText(/Halaman 2 dari 3/).waitFor();
  await btn("Sebelumnya").click();
  await ready();
  await page.getByText(/Halaman 1 dari 3/).waitFor();
  await page.unroute("**/api/honorarium/read?**", paged);
  // Many long recipient names: bounded recap and local search.
  const many = async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    if (body.data.statements) {
      const original = body.data.statements[0];
      body.data.statements = Array.from({ length: 30 }, (_, i) => ({
        ...original,
        recipient: {
          ...original.recipient,
          id: `${String(i + 1).padStart(8, "0")}-1111-4111-8111-111111111111`,
          name: "Guru" + "Panjang".repeat(70) + i,
        },
      }));
    }
    await route.fulfill({ response, json: body });
  };
  await page.route("**/api/honorarium/read?**", many);
  await go();
  await page.getByText(/Halaman 1 dari 3/).waitFor();
  await btn("Penerima berikutnya").click();
  await page.getByText(/Halaman 2 dari 3/).waitFor();
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 768, height: 1024 },
    { width: 320, height: 740 },
    { width: 740, height: 320 },
  ]) {
    await page.setViewportSize(viewport);
    await page.evaluate(
      () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        ),
    );
    await overflow();
    await page
      .locator("summary")
      .filter({ hasText: "Rincian sumber" })
      .first()
      .click();
    await overflow();
  }
  await page.getByLabel("Cari penerima rekap").fill("tidak-cocok");
  await page
    .getByText("Tidak ada penerima yang cocok.", { exact: true })
    .waitFor();
  await page.unroute("**/api/honorarium/read?**", many);
  let invalid = true;
  const invalidProof = async (route) => {
    if (invalid) {
      invalid = false;
      await route.fulfill({
        status: 200,
        json: { ok: true, data: { status: "valid" } },
      });
    } else await route.continue();
  };
  await page.route("**/api/honorarium/verify", invalidProof);
  await page.goto(
    "http://127.0.0.1:4319/?view=verifyDocument#" + link.split("#")[1],
  );
  await page
    .getByText(/Hasil honorarium belum dapat diverifikasi/)
    .first()
    .waitFor();
  assert.equal(
    await page.getByText("Dokumen valid", { exact: true }).count(),
    0,
  );
  await btn("Coba periksa kembali").click();
  await page
    .getByText("Dokumen valid dengan koreksi terkait", { exact: true })
    .waitFor();
  assert.equal(new URL(page.url()).hash, "");
  await overflow();
  await page.unroute("**/api/honorarium/verify", invalidProof);
  assert.deepEqual(errors, []);
  assert.deepEqual(consoleErrors, []);
  assert.ok(!logs.includes("FIXTURE_ROUTE_NOT_IMPLEMENTED"), logs);
  console.log(
    JSON.stringify({
      result: "passed",
      flows: [
        "transport-block",
        "holiday-generate-cancel-waive",
        "finalize",
        "single-modal",
        "privacy",
        "history-slip",
        "verified-PDF",
        "scoped-Excel",
        "correction-request",
        "correction-delta",
        "expiry",
        "malformed-read-retry",
        "uncertain-write",
        "recap-pagination-search",
        "responsive-resize",
        "print",
        "public-verification-retry",
        "history-pagination",
      ],
      widths: [1440, 768, 320, 740],
      pageErrors: errors,
    }),
  );
} catch (error) {
  console.error(await page?.locator("body").innerText());
  await page?.screenshot({ path: "/tmp/finance-error.png", fullPage: true });
  throw error;
} finally {
  await browser?.close();
  child.kill("SIGTERM");
}
