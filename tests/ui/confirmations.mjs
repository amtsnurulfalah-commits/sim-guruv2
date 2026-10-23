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
    env: { ...process.env, UI_CONFIRMATION_FIXTURE: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
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
  const page = await browser.newPage({
    hasTouch: true,
    reducedMotion: "reduce",
    timezoneId: "America/Los_Angeles",
  });
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const screenshots = process.env.UI_SCREENSHOT_DIR;
  if (screenshots) await mkdir(screenshots, { recursive: true });
  const admin = "11111111-1111-4111-8111-111111111111",
    guru = "22222222-2222-4222-8222-222222222222",
    other = "33333333-3333-4333-8333-333333333333",
    aid = "44444444-4444-4444-8444-444444444444";
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
  }).format(new Date());
  let role = "guru";
  const go = async () => {
    await page.goto(
      "http://127.0.0.1:4319/?view=occurrences&role=" +
        role +
        "&path=%2Fkegiatan",
    );
    await page
      .getByRole("heading", {
        name: "Kegiatan dan konfirmasi KBM",
        exact: true,
      })
      .waitFor();
    await page.waitForFunction(
      () => !document.querySelector('[aria-busy="true"]'),
    );
  };
  const overflow = async () =>
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
    );
  const modal = () => page.getByRole("dialog");
  const reload = async () => {
    await page.getByRole("button", { name: "Muat ulang", exact: true }).click();
    await page.waitForFunction(
      () => !document.querySelector('[aria-busy="true"]'),
    );
  };
  const close = async () => {
    await page.keyboard.press("Escape");
    const discard = page.getByRole("button", {
      name: "Buang perubahan",
      exact: true,
    });
    if (await discard.isVisible()) await discard.click();
    await modal().waitFor({ state: "hidden" });
  };
  const act = async (name) => {
    await page.getByRole("button", { name, exact: true }).first().click();
    await modal()
      .getByLabel("Alasan tindakan", { exact: true })
      .fill("Pengujian konfirmasi KBM sintetis");
    await modal().getByRole("button", { name, exact: true }).click();
    await modal().waitFor({ state: "hidden" });
    await page.waitForFunction(
      () => !document.querySelector('[aria-busy="true"]'),
    );
  };
  // Real browser -> API -> service -> disposable PostgreSQL, including claim/confirmation separation.
  await go();
  await act("Ajukan klaim kehadiran");
  await page
    .getByRole("status")
    .filter({ hasText: "Klaim kehadiran berhasil dicatat" })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Konfirmasi KBM", exact: true })
      .count(),
    0,
  );
  role = "admin";
  await go();
  await act("Konfirmasi KBM");
  await page
    .locator("article")
    .getByText("Terkonfirmasi", { exact: true })
    .waitFor();
  await act("Cabut konfirmasi");
  await page
    .locator("article")
    .getByText("Belum dikonfirmasi", { exact: true })
    .waitFor();
  const real = (
    await (
      await page.request.get(
        "http://127.0.0.1:4319/api/activities/occurrences?date=" + date,
      )
    ).json()
  ).data.items[0];
  assert.equal(real.confirmed, false);
  assert.equal(real.claimed, false); // revoke cleanup also clears claims.
  // Controlled failures and races supplement the real database flow.
  let rows = [
      {
        ...real,
        userId: guru,
        originalUserId: guru,
        teacherName: "Guru sintetis",
        claimed: false,
        confirmed: false,
        version: "1",
      },
    ],
    operator = false,
    readMode = "ok",
    writeMode = "ok",
    writes = 0,
    reads = 0,
    holdRelease,
    holdStarted,
    started,
    hold,
    delayDate = "",
    releaseRead,
    readStarted,
    delayedStarted;
  await page.route("**/api/activities/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      kind = url.pathname.split("/").at(-1),
      ok = (data) => route.fulfill({ json: { ok: true, data } });
    if (req.method() === "GET") {
      if (kind === "options") return ok({ canOperate: operator });
      if (kind === "occurrences") {
        reads++;
        const requested = url.searchParams.get("date");
        const snapshot = rows.map((r) => ({ ...r, date: requested }));
        if (requested === delayDate) {
          readStarted();
          await new Promise((r) => (releaseRead = r));
        }
        if (readMode === "error")
          return route.fulfill({
            status: 503,
            json: {
              ok: false,
              error: {
                code: "UNAVAILABLE",
                message: "Penugasan belum tersedia.",
              },
            },
          });
        if (readMode === "invalid")
          return ok({
            date: requested,
            items: [{ ...snapshot[0], version: 1 }],
          });
        if (readMode === "wrong-date")
          return ok({ date: "2000-01-01", items: [] });
        return ok({ date: requested, items: snapshot });
      }
    }
    writes++;
    const input = req.postDataJSON();
    if (writeMode === "held") {
      holdStarted();
      await hold;
    }
    if (writeMode === "network") return route.abort("failed");
    if (writeMode === "conflict")
      return route.fulfill({
        status: 409,
        json: {
          ok: false,
          error: {
            code: "VERSION_CONFLICT",
            message: "Kegiatan berubah pada sesi lain.",
          },
        },
      });
    if (writeMode === "reject")
      return route.fulfill({
        status: 403,
        json: {
          ok: false,
          error: { code: "FORBIDDEN", message: "Perubahan ditolak server." },
        },
      });
    if (writeMode === "invalid") return ok({ id: null });
    const index = rows.findIndex((r) => r.id === input.occurrenceId),
      current = rows[index];
    const changed = {
      ...current,
      version: String(BigInt(current.version) + 1n),
      claimed:
        kind === "claim" ? true : kind === "revoke" ? false : current.claimed,
      confirmed:
        kind === "confirm"
          ? true
          : kind === "revoke"
            ? false
            : current.confirmed,
    };
    rows[index] = changed;
    return ok(changed);
  });
  for (const width of [280, 320, 375, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 800 });
    await go();
    await overflow();
    await page
      .getByRole("button", { name: "Konfirmasi KBM", exact: true })
      .click();
    await modal().getByLabel("Alasan tindakan", { exact: true }).waitFor();
    assert.equal(
      await modal().evaluate((el) => {
        const r = el.getBoundingClientRect();
        return (
          r.left >= -1 &&
          r.right <= innerWidth + 1 &&
          r.top >= -1 &&
          r.bottom <= innerHeight + 1
        );
      }),
      true,
    );
    if (screenshots && [320, 1440].includes(width))
      await page.screenshot({
        path: screenshots + "/confirmation-modal-" + width + ".png",
      });
    await close();
  }
  // Search/status/pagination are local and do not re-fetch or expose other pages of data.
  rows = Array.from({ length: 61 }, (_, i) => ({
    ...rows[0],
    id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    assignmentId: aid,
    teacherName: i === 60 ? "Guru terakhir" : "Guru " + i,
    subjectName: "X".repeat(200),
    className: "Kelas " + i,
    confirmed: i % 2 === 0,
  }));
  await reload();
  await page.setViewportSize({ width: 320, height: 650 });
  await overflow();
  assert.equal(await page.locator("article").count(), 25);
  const readsBefore = reads;
  await page.getByRole("button", { name: "Berikutnya", exact: true }).click();
  await page
    .getByText("Halaman 2 dari 3 · 61 hasil", { exact: true })
    .waitFor();
  await page
    .getByLabel("Cari guru, mata pelajaran, atau kelas", { exact: true })
    .fill("Guru terakhir");
  await page
    .getByRole("heading", { name: "Guru terakhir", exact: true })
    .waitFor();
  assert.equal(await page.locator("article").count(), 1);
  assert.equal(reads, readsBefore);
  await page
    .getByLabel("Status konfirmasi", { exact: true })
    .selectOption("pending");
  await page
    .getByText("Tidak ada kegiatan sesuai filter.", { exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Hapus filter", exact: true }).click();
  rows = [
    {
      ...real,
      userId: guru,
      originalUserId: guru,
      teacherName: "Guru sintetis",
      claimed: false,
      confirmed: false,
      version: "1",
    },
  ];
  await reload();
  // Short reason is rejected without POST; duplicate submits cannot create duplicate commands.
  await page
    .getByRole("button", { name: "Konfirmasi KBM", exact: true })
    .click();
  let d = modal();
  await d.getByLabel("Alasan tindakan", { exact: true }).fill("x");
  await d.getByRole("button", { name: "Konfirmasi KBM", exact: true }).click();
  assert.equal(writes, 0);
  await d
    .getByLabel("Alasan tindakan", { exact: true })
    .fill("Konfirmasi kegiatan berjalan");
  started = new Promise((r) => (holdStarted = r));
  hold = new Promise((r) => (holdRelease = r));
  writeMode = "held";
  await d.getByRole("button", { name: "Konfirmasi KBM", exact: true }).click();
  await started;
  await d.locator("form").evaluate((f) => {
    f.requestSubmit();
    f.requestSubmit();
  });
  await page.keyboard.press("Escape");
  assert.equal(await d.isVisible(), true);
  assert.equal(writes, 1);
  readMode = "error";
  writeMode = "ok";
  holdRelease();
  await d.waitFor({ state: "hidden" });
  await page
    .getByRole("status")
    .filter({ hasText: "Konfirmasi KBM berhasil disimpan" })
    .waitFor();
  await page.getByRole("alert").waitFor();
  assert.equal(await page.locator("article").count(), 0);
  readMode = "ok";
  await reload();
  await act("Cabut konfirmasi");
  for (const mode of ["conflict", "network", "invalid", "reject"]) {
    await page
      .getByRole("button", { name: "Konfirmasi KBM", exact: true })
      .click();
    d = modal();
    await d
      .getByLabel("Alasan tindakan", { exact: true })
      .fill("Alasan harus tetap tersedia");
    writeMode = mode;
    const before = writes;
    await d
      .getByRole("button", { name: "Konfirmasi KBM", exact: true })
      .click();
    await d.getByRole("alert").waitFor();
    assert.equal(writes, before + 1);
    assert.equal(
      await d.getByLabel("Alasan tindakan", { exact: true }).inputValue(),
      "Alasan harus tetap tersedia",
    );
    writeMode = "ok";
    if (mode === "reject") {
      assert.equal(
        await d
          .getByRole("button", { name: "Konfirmasi KBM", exact: true })
          .isEnabled(),
        true,
      );
      await close();
    } else {
      assert.equal(
        await d
          .getByRole("button", { name: "Konfirmasi KBM", exact: true })
          .isDisabled(),
        true,
      );
      await d
        .getByRole("button", {
          name: "Muat ulang dan periksa kegiatan",
          exact: true,
        })
        .click();
      await d.waitFor({ state: "hidden" });
      await page.waitForFunction(
        () => !document.querySelector('[aria-busy="true"]'),
      );
    }
  }
  for (const mode of ["error", "invalid", "wrong-date"]) {
    readMode = mode;
    await reload();
    await page.getByRole("alert").waitFor();
    assert.equal(await page.locator("article").count(), 0);
    readMode = "ok";
    await reload();
  }
  // Late response from an older date cannot replace the currently selected date.
  delayDate = "2026-10-01";
  delayedStarted = new Promise((r) => (readStarted = r));
  await page
    .getByLabel("Tanggal kegiatan / input", { exact: true })
    .fill(delayDate);
  await delayedStarted;
  assert.equal(await page.locator("article").count(), 0);
  await page
    .getByLabel("Tanggal kegiatan / input", { exact: true })
    .fill("2026-10-02");
  await page
    .getByRole("heading", { name: "Penugasan tanggal 2026-10-02", exact: true })
    .waitFor();
  releaseRead();
  delayDate = "";
  await page.waitForTimeout(150);
  assert.equal(
    await page
      .getByRole("heading", {
        name: "Penugasan tanggal 2026-10-02",
        exact: true,
      })
      .count(),
    1,
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Konfirmasi KBM", exact: true })
      .count(),
    0,
  );
  await page.getByLabel("Tanggal kegiatan / input", { exact: true }).fill("");
  await page.getByRole("alert").waitFor();
  await page.getByLabel("Tanggal kegiatan / input", { exact: true }).fill(date);
  await page
    .getByRole("button", { name: "Konfirmasi KBM", exact: true })
    .waitFor();
  // Own activity cannot be self-confirmed even by admin; active journal prevents revoke.
  rows = [{ ...rows[0], userId: admin, claimed: false }];
  await reload();
  assert.equal(
    await page
      .getByRole("button", { name: "Konfirmasi KBM", exact: true })
      .count(),
    0,
  );
  await page
    .getByRole("button", { name: "Ajukan klaim kehadiran", exact: true })
    .waitFor();
  rows = [{ ...rows[0], userId: guru, confirmed: true, journalId: aid }];
  await reload();
  assert.equal(
    await page
      .getByRole("button", { name: "Cabut konfirmasi", exact: true })
      .count(),
    0,
  );
  await page.getByText(/Jurnal aktif tersedia/).waitFor();
  role = "guru";
  operator = false;
  rows = [
    {
      ...rows[0],
      userId: guru,
      claimed: false,
      confirmed: false,
      journalId: null,
    },
  ];
  await go();
  assert.equal(
    await page
      .getByRole("button", { name: "Konfirmasi KBM", exact: true })
      .count(),
    0,
  );
  await act("Ajukan klaim kehadiran");
  operator = true;
  rows = [{ ...rows[0], userId: other, claimed: false }];
  await reload();
  await act("Konfirmasi KBM");
  await act("Cabut konfirmasi");
  operator = false;
  await page
    .getByLabel("Tanggal kegiatan / input", { exact: true })
    .fill("2026-10-02");
  await page
    .getByRole("heading", { name: "Penugasan tanggal 2026-10-02", exact: true })
    .waitFor();
  assert.equal(await page.locator("article").count(), 1);
  assert.equal(
    await page
      .getByRole("button", { name: "Konfirmasi KBM", exact: true })
      .count(),
    0,
  );
  await page.getByLabel("Tanggal kegiatan / input", { exact: true }).fill(date);
  await page.waitForFunction(
    () => !document.querySelector('[aria-busy="true"]'),
  );
  rows = [];
  await reload();
  await page
    .getByText("Tidak ada penugasan pada tanggal ini.", { exact: true })
    .waitFor();
  await page.setViewportSize({ width: 844, height: 390 });
  await overflow();
  await page.addStyleTag({ content: "html{font-size:32px}" });
  await overflow();
  rows = [
    {
      ...real,
      userId: guru,
      originalUserId: guru,
      claimed: false,
      confirmed: false,
      journalId: null,
    },
  ];
  await page.clock.install({ time: new Date(date + "T23:59:50+07:00") });
  await go();
  await page
    .getByRole("button", { name: "Ajukan klaim kehadiran", exact: true })
    .waitFor();
  await page.clock.fastForward(40000);
  await page.getByText(/Tanggal ini hanya dapat ditinjau/).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Ajukan klaim kehadiran", exact: true })
      .count(),
    0,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: real database browser claim/confirm/revoke; 7 widths, modal bounds, 61 rows/search/status/pagination, long text, validation, duplicate submit/busy close, write/read/malformed/network errors, success then refresh failure, stale date race, own/admin/guru/piket/journal guards, empty, landscape/200% text; zero page errors.",
  );
} finally {
  await browser?.close();
  child.kill("SIGTERM");
}
