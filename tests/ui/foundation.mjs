/** Shared required-choice validation and accessible focus; disposable fixtures only. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
const { chromium } = await import(
  process.env.UI_PLAYWRIGHT_MODULE ?? "playwright"
);
const server = spawn(
  process.execPath,
  ["--conditions=react-server", "--import", "tsx", "tests/ui/server.ts"],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let browser,
  logs = "";
server.stderr.on("data", (value) => (logs += value));
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(Error(logs || "fixture timeout")),
      60000,
    );
    server.stdout.on("data", (value) => {
      if (value.toString().includes("UI_FIXTURE_READY")) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.on("exit", () => {
      clearTimeout(timer);
      reject(Error(logs));
    });
  });
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.UI_BROWSER_EXECUTABLE,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage({ viewport: { width: 320, height: 640 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(
    "http://127.0.0.1:4319/?view=requiredChoices&role=admin&path=/jadwal",
  );
  await page
    .getByRole("button", { name: "Simpan pilihan", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Simpan pilihan",
    exact: true,
  });
  await dialog
    .getByRole("button", { name: "Simpan pilihan", exact: true })
    .click();
  await dialog.getByRole("alert").waitFor();
  assert.equal(await page.getByLabel("Jumlah simpan").textContent(), "0");
  assert.equal(
    await dialog
      .getByRole("group", { name: "Hari wajib" })
      .getAttribute("aria-invalid"),
    "true",
  );
  await dialog.getByRole("link", { name: /Hari wajib:/ }).click();
  assert.equal(
    await dialog
      .getByRole("group", { name: "Hari wajib" })
      .evaluate((node) => node === document.activeElement),
    true,
  );
  await dialog.getByLabel("Senin", { exact: true }).check();
  await dialog
    .getByRole("button", { name: "Simpan pilihan", exact: true })
    .click();
  assert.equal(await page.getByLabel("Jumlah simpan").textContent(), "0");
  await dialog.getByLabel("Guru sintetis", { exact: true }).check();
  await dialog
    .getByRole("button", { name: "Simpan pilihan", exact: true })
    .evaluate((button) => {
      button.click();
      button.click();
    });
  await dialog.waitFor({ state: "hidden" });
  assert.equal(await page.getByLabel("Jumlah simpan").textContent(), "1");
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
    false,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: required days/multi remain unsaved until complete, field links focus groups, duplicate submit blocked, 320px no overflow, zero page errors.",
  );
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
