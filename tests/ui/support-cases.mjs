import assert from "node:assert/strict";
import { spawn } from "node:child_process";
const { chromium } = await import(
  process.env.UI_PLAYWRIGHT_MODULE ?? "playwright"
);
const child = spawn(
  process.execPath,
  ["--conditions=react-server", "--import", "tsx", "tests/ui/server.ts"],
  { stdio: ["ignore", "pipe", "pipe"] },
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
  const ready = () =>
    page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
  const btn = (name) => page.getByRole("button", { name, exact: true });
  const dialog = () => page.getByRole("dialog");
  const reason = () =>
    dialog()
      .getByLabel("Alasan / catatan internal (5–2000 karakter)")
      .fill("Pengguna telah menghubungi admin dan sumber diperiksa");
  const submit = async (name) => {
    await dialog().getByRole("button", { name, exact: true }).click();
    await dialog().waitFor({ state: "hidden" });
    await ready();
  };
  await page.goto("http://127.0.0.1:4319/?view=support&role=admin");
  await page.getByRole("heading",{name:"Keandalan pemrosesan dan email",exact:true}).waitFor();
  await page.getByText(/bukan tingkat kegagalan seluruh percobaan kirim/).waitFor();
  await ready();
  await page
    .getByRole("heading", { name: "Pemantauan layanan", exact: true })
    .waitFor();
  await page
    .getByLabel("Kode referensi bantuan")
    .fill("48bfc3a0-adb3-45d0-a97f-eb27186062b0");
  await btn("Cari laporan").click();
  await ready();
  await btn("Buat laporan penanganan").click();
  await dialog()
    .getByLabel("Judul kendala (5–160 karakter)")
    .fill(
      "Kendala jurnal pembelajaran dengan nama yang panjang untuk pemeriksaan responsif",
    );
  await dialog()
    .getByLabel("Konteks halaman, tindakan, dan waktu dari pengguna")
    .fill(
      "Guru melaporkan penolakan saat menyimpan jurnal setelah pembelajaran",
    );
  await dialog()
    .getByLabel("Pelapor (opsional)")
    .selectOption("11111111-1111-4111-8111-111111111111");
  await dialog().getByLabel("Identitas pelapor").selectOption("true");
  await reason();
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
  await page.screenshot({ path: "/tmp/stage4-case-mobile.png" });
  await submit("Simpan laporan penanganan");
  const detail = () =>
    page.getByRole("article", { name: "Detail penanganan", exact: true });
  await detail().waitFor();
  await btn("Perbarui konteks pelapor").click();
  await dialog()
    .getByLabel("Pelapor", { exact: true })
    .selectOption("22222222-2222-4222-8222-222222222222");
  await dialog().getByLabel("Identitas pelapor").selectOption("true");
  await reason();
  await submit("Simpan konteks pelapor");
  await btn("Ubah status / penanggung jawab").click();
  await dialog().getByLabel("Status tujuan").selectOption("reviewed");
  await dialog()
    .getByLabel("Penanggung jawab admin")
    .selectOption("11111111-1111-4111-8111-111111111111");
  await reason();
  await submit("Simpan status penanganan");
  await btn("Ubah status / penanggung jawab").click();
  await dialog().getByLabel("Status tujuan").selectOption("processing");
  await reason();
  await submit("Simpan status penanganan");
  await btn("Ubah status / penanggung jawab").click();
  await dialog().getByLabel("Status tujuan").selectOption("resolved");
  await reason();
  await dialog()
    .getByRole("button", { name: "Simpan status penanganan", exact: true })
    .click();
  await dialog()
    .getByText(/hasil perbaikan|Isi hasil/)
    .first()
    .waitFor();
  await dialog()
    .getByLabel("Hasil perbaikan (wajib untuk Selesai)")
    .fill("Pemblokiran sumber diperbaiki sesuai kebijakan");
  await dialog()
    .getByLabel("Bukti verifikasi bersama pengguna (wajib untuk Selesai)")
    .fill("Guru mengulang penyimpanan dan berhasil tanpa pesan kesalahan");
  await submit("Simpan status penanganan");
  await detail()
    .getByRole("heading", { name: /Selesai/ })
    .waitFor();
  await btn("Buka kembali laporan").click();
  await reason();
  await submit("Simpan status penanganan");
  await detail().getByRole("heading", { name: /Baru/ }).waitFor();
  await btn("Tambah catatan internal").click();
  await reason();
  let writes = 0;
  await page.route("**/api/operations/support-case", async (route) => {
    writes++;
    await route.fulfill({
      status: 503,
      json: {
        ok: false,
        error: {
          code: "UNAVAILABLE",
          message: "Hasil simpan belum dapat dipastikan",
        },
      },
    });
  });
  await dialog()
    .getByRole("button", { name: "Simpan catatan internal", exact: true })
    .click();
  await dialog()
    .getByText(/belum dapat dipastikan/)
    .first()
    .waitFor();
  assert.equal(
    await dialog()
      .getByRole("button", { name: "Simpan catatan internal", exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(writes, 1);
  await page.keyboard.press("Escape");
  const discard = page.getByRole("button", {
    name: "Buang perubahan",
    exact: true,
  });
  await discard.waitFor({ state: "visible", timeout: 1000 }).catch(() => {});
  if (await discard.isVisible()) await discard.click();
  await dialog().waitFor({ state: "hidden" });
  await page.unroute("**/api/operations/support-case");
  await btn("Muat ulang penanganan").click();
  await ready();
  await btn("Tambah catatan internal").click();
  await reason();
  await submit("Simpan catatan internal");
  await detail()
    .locator("summary")
    .filter({ hasText: "Riwayat dan catatan" })
    .click();
  await detail()
    .getByText(/Pengguna telah menghubungi admin/)
    .first()
    .waitFor();
  await page.getByLabel("Status penanganan").selectOption("resolved");
  await ready();
  await page
    .getByText("Belum ada laporan penanganan yang sesuai.", { exact: true })
    .waitFor();
  await page.getByLabel("Status penanganan").selectOption("");
  await ready();
  for (const width of [280, 320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      passed: true,
      flows: [
        "reference-to-case",
        "verified-reporter",
        "owner-and-status",
        "resolution-proof",
        "reopen-history",
        "uncertain-write-lock",
        "retry-after-read",
        "empty-status-filter",
        "monitoring",
        "responsive-modal",
        "reporter-context-audit",
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
