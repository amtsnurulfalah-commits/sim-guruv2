import test from "node:test";
import assert from "node:assert/strict";
import {
  ApiRequestError,
  readApiResponse,
  requestJson,
  serverFieldErrors,
  downloadFile,
} from "../../src/lib/feedback/api-error";
const rejected = (code: string, status: number, extra = {}) =>
  Response.json(
    {
      ok: false,
      error: { code, message: "Permintaan ditolak.", ...extra },
      requestId: "synthetic-reference-001",
    },
    { status },
  );
test("API feedback retains field locations, safe reference and repair instructions", async () => {
  await assert.rejects(
    readApiResponse(
      rejected("VALIDATION_ERROR", 422, {
        fieldErrors: { "data.reason": ["Isi minimal 5 karakter."] },
      }),
    ),
    (e) => {
      assert.ok(e instanceof ApiRequestError);
      assert.match(e.message, /Alasan: Isi minimal 5 karakter/);
      assert.match(e.message, /synthetic-reference-001/);
      assert.equal(serverFieldErrors(e).reason, "Isi minimal 5 karakter.");
      return true;
    },
  );
});
for (const [code, status, pattern] of [
  ["FORBIDDEN", 403, /peran dan penugasan/],
  ["UNAUTHENTICATED", 401, /Masuk kembali/],
  ["CONFLICT", 409, /data terbaru/],
  ["STUDENT_COUNT_MISMATCH", 422, /Totalnya harus sesuai/],
] as const)
  test(`API feedback ${code} gives a relevant next action`, async () => {
    await assert.rejects(readApiResponse(rejected(code, status)), (e) => {
      assert.ok(e instanceof ApiRequestError);
      assert.match(e.message, pattern);
      return true;
    });
  });
test("Rate limiting preserves Retry-After without automatic retry", async () => {
  const r = rejected("RATE_LIMITED", 429);
  r.headers.set("retry-after", "125");
  await assert.rejects(readApiResponse(r), (e) => {
    assert.ok(e instanceof ApiRequestError);
    assert.equal(e.retryAfter, 125);
    assert.match(e.message, /3 menit/);
    return true;
  });
});
test("Malformed gateway response never shows raw HTML or SQL", async () => {
  await assert.rejects(
    readApiResponse(
      new Response("<html>postgres://private:secret@host</html>", {
        status: 502,
      }),
    ),
    (e) => {
      assert.ok(e instanceof ApiRequestError);
      assert.doesNotMatch(e.message, /postgres|secret|<html>/);
      return true;
    },
  );
});
test("HTTP rejection cannot masquerade as ok true", async () => {
  await assert.rejects(
    readApiResponse(
      Response.json({ ok: true, data: { saved: true } }, { status: 403 }),
    ),
    ApiRequestError,
  );
});
test("Interrupted write warns of uncertain state and is never replayed", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    throw new TypeError("Failed to fetch");
  });
  await assert.rejects(
    requestJson("/api/synthetic", { method: "POST" }),
    (e) => {
      assert.ok(e instanceof ApiRequestError);
      assert.match(e.message, /Status penyimpanan belum dapat dipastikan/);
      assert.match(e.message, /Periksa riwayat/);
      return true;
    },
  );
  assert.equal(calls, 1);
});
test("GET network failure advises restoring connection", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new TypeError("Failed to fetch");
  });
  await assert.rejects(requestJson("/api/synthetic"), (e) => {
    assert.ok(e instanceof ApiRequestError);
    assert.match(e.message, /koneksi kembali stabil/);
    return true;
  });
});
test("Timeout differs from deliberate cancellation", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new DOMException("timeout", "TimeoutError");
  });
  await assert.rejects(
    requestJson("/api/synthetic"),
    (e) => e instanceof ApiRequestError && e.code === "TIMEOUT",
  );
  const c = new AbortController();
  c.abort();
  t.mock.method(globalThis, "fetch", async () => {
    throw c.signal.reason;
  });
  await assert.rejects(
    requestJson("/api/synthetic", { signal: c.signal }),
    (e) => e === c.signal.reason,
  );
});
test("Successful envelope preserves API data", async () => {
  assert.deepEqual(
    await readApiResponse(Response.json({ ok: true, data: { value: 7 } })),
    { value: 7 },
  );
});

test("Interrupted download reports a safe retry instruction", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(
        new ReadableStream({
          start(c) {
            c.error(Error("synthetic-private-stream-error"));
          },
        }),
        { headers: { "content-type": "text/csv" } },
      ),
  );
  await assert.rejects(
    downloadFile("/api/synthetic-export", "synthetic.csv"),
    (e) => {
      assert.ok(e instanceof ApiRequestError);
      assert.equal(e.code, "DOWNLOAD_INTERRUPTED");
      assert.doesNotMatch(e.message, /private-stream/);
      return true;
    },
  );
});
