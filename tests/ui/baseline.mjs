/** Read-only synthetic baseline: localhost + PGlite, never a production URL. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
const { chromium } = await import(
  process.env.UI_PLAYWRIGHT_MODULE ?? "playwright"
);
const started = performance.now();
const env = { ...process.env };
for (const key of [
  "UI_FINANCE_FIXTURE",
  "UI_FINANCE_FINAL",
  "UI_EVENT_FIXTURE",
  "UI_EXAM_FIXTURE",
  "UI_ATTENDANCE_FIXTURE",
  "UI_DUTY_FIXTURE",
  "UI_STUDENT_FIXTURE",
  "UI_CONFIRMATION_FIXTURE",
])
  env[key] = "0";
const child = spawn(
  process.execPath,
  ["--conditions=react-server", "--import", "tsx", "tests/ui/server.ts"],
  { env, stdio: ["ignore", "pipe", "pipe"] },
);
let browser,
  logs = "";
child.stderr.on("data", (chunk) => (logs += chunk));
try {
  await new Promise((accept, reject) => {
    const timer = setTimeout(
      () => reject(Error("BASELINE_TIMEOUT: " + logs)),
      60000,
    );
    child.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("UI_FIXTURE_READY")) {
        clearTimeout(timer);
        accept();
      }
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(Error("BASELINE_EXIT " + code + " " + logs));
    });
  });
  const fixtureStartupMs = performance.now() - started;
  browser = await chromium.launch({
    headless: true,
    ...(process.env.UI_BROWSER_EXECUTABLE
      ? { executablePath: process.env.UI_BROWSER_EXECUTABLE }
      : {}),
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
    timezoneId: "Asia/Jakarta",
  });
  page.setDefaultTimeout(30000);
  const pageErrors = [],
    consoleErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  const screens = [];
  for (const [view, title, path] of [
    ["dashboard", /^Selamat datang,/, "/dashboard"],
    ["finance", "Rekap honorarium", "/admin/honorarium"],
    ["events", "Kehadiran dan jurnal acara", "/acara"],
    ["schedules", "Jadwal KBM", "/jadwal"],
  ]) {
    const start = performance.now();
    await page.goto(
      "http://127.0.0.1:4319/?" +
        new URLSearchParams({ view, role: "admin", path }),
      { waitUntil: "networkidle" },
    );
    await page
      .getByRole("heading", { name: title, exact: true })
      .first()
      .waitFor();
    await page.waitForFunction(
      () => !document.querySelector('[aria-busy="true"]'),
    );
    screens.push({
      view,
      viewport: { width: 1440, height: 1000 },
      navigationAndReadyMs: Number((performance.now() - start).toFixed(2)),
      documentOverflow: await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
    });
  }
  const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
    }).format(new Date()),
    api = [];
  for (const path of [
    "/api/dashboard",
    "/api/programs/read?domain=events&date=" + date,
    "/api/honorarium/read?kind=recap&period=" +
      date.slice(0, 7) +
      "&mode=realized",
  ]) {
    const times = await page.evaluate(async (path) => {
      const values = [];
      for (let i = 0; i < 11; i++) {
        const start = performance.now(),
          r = await fetch(path, { cache: "no-store" }),
          v = await r.json();
        if (!r.ok || !v.ok) throw Error("BASELINE_READ_FAILED");
        if (i) values.push(performance.now() - start);
      }
      return values;
    }, path);
    times.sort((a, b) => a - b);
    const q = (n) => Number(times[Math.ceil(n * times.length) - 1].toFixed(2));
    api.push({
      path,
      samples: 10,
      warmups: 1,
      p50Ms: q(0.5),
      p95Ms: q(0.95),
      minMs: q(0.1),
      maxMs: q(1),
    });
  }
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(consoleErrors, []);
  assert.equal(logs.trim(), "");
  assert.ok(screens.every((s) => !s.documentOverflow));
  const result = {
    schemaVersion: 1,
    measuredAt: new Date().toISOString(),
    environment: "localhost UI harness + PGlite synthetic minimal dataset",
    production: false,
    node: process.version,
    browser: browser.version(),
    fixtureStartupMs: Number(fixtureStartupMs.toFixed(2)),
    method:
      "Sequential read-only requests; 1 warmup + 10 samples/API; nearest-rank p50/p95. Page readiness includes networkidle and aria-busy=false.",
    limitations: [
      "Not production latency, SSR timing, Core Web Vitals, concurrency or capacity.",
      "Small synthetic data; fixture bypasses production auth/CSRF/rate layer. Security is tested separately by integration tests.",
      "Only compare repeat runs using same environment/data. These numbers are not production SLOs.",
    ],
    screens,
    api,
    pageErrors,
    consoleErrors,
    serverErrors: logs,
  };
  const dir = resolve(
    process.env.UI_BASELINE_REPORT_DIR ?? "../stage0-performance",
  );
  await mkdir(dir, { recursive: true });
  await writeFile(
    resolve(dir, "performance.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      result: "passed",
      screens: 4,
      api: 3,
      output: resolve(dir, "performance.json"),
    }),
  );
} finally {
  await browser?.close();
  child.kill("SIGTERM");
}
