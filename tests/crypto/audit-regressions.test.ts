import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type {
  SqlDatabase,
  SqlExecutor,
  SqlParameter,
} from "../../scripts/lib/sql-database";
import { SecurityOutboxWorker } from "../../src/server/mail/security-outbox";
import { createFinanceHandler } from "../../src/server/finance/http";

for (const scenario of [
  "transport-throws",
  "invalid-expiry",
  "expired",
  "wrong-origin",
  "sent",
] as const) {
  test(`Audit security outbox: ${scenario}`, async () => {
    let sent = 0;
    let finished: readonly SqlParameter[] = [];
    const payload = {
      id: randomUUID(),
      lease: randomUUID(),
      userId: randomUUID(),
      email: "synthetic@example.test",
      template: "password_changed",
      secret: null,
      public: {
        fullName: "Synthetic",
        username: "synthetic",
        appUrl:
          scenario === "wrong-origin"
            ? "https://other.example.test"
            : "https://school.example.test",
        expiresAt:
          scenario === "invalid-expiry"
            ? "invalid"
            : new Date(
                Date.now() + (scenario === "expired" ? -60000 : 60000),
              ).toISOString(),
      },
    };
    const db: SqlExecutor = {
      async exec() {},
      async query<T extends Record<string, unknown>>(
        sql: string,
        args: readonly SqlParameter[] = [],
      ) {
        if (sql.includes("finish_security_outbox")) {
          finished = args;
          return { rows: [{ ok: true } as unknown as T] };
        }
        return { rows: [{ value: payload } as unknown as T] };
      },
    };
    const result = await new SecurityOutboxWorker(
      db,
      {
        async send() {
          sent++;
          if (scenario === "transport-throws")
            throw Error("Synthetic uncertain transport");
          return "sent";
        },
      },
      "00".repeat(32),
      "https://school.example.test",
    ).deliverOne();
    const expected =
      scenario === "transport-throws"
        ? "unknown"
        : scenario === "sent"
          ? "sent"
          : "failed";
    assert.equal(result.result, expected);
    assert.equal(finished[2], expected);
    assert.equal(sent, ["transport-throws", "sent"].includes(scenario) ? 1 : 0);
  });
}
test("Audit finance rejects inherited object properties before accessing services", async () => {
  const unreachable = async (): Promise<never> => {
    throw Error("UNEXPECTED_SERVICE_ACCESS");
  };
  const handler = createFinanceHandler({
    config: () => ({
      appUrl: "https://school.example.test",
      sessionSecret: "x".repeat(40),
      production: true,
      vercel: true,
    }),
    auth: unreachable,
    service: unreachable,
    rate: unreachable,
  });
  for (const action of [
    "constructor",
    "toString",
    "__proto__",
    "not-a-command",
  ]) {
    const response = await handler(
      action,
      new Request(`https://school.example.test/api/honorarium/${action}`, {
        method: "POST",
      }),
    );
    assert.equal(response.status, 405, action);
    assert.equal((await response.json()).error.code, "FORBIDDEN");
  }
});

for (const total of [0, 10000, 10001, 10100, 10101]) {
  test(`Audit activity export enforces 10,000-row cap: ${total}`, async () => {
    let page = 0;
    const db: SqlDatabase = {
      async exec() {},
      async close() {},
      async transaction(work) {
        return work(db);
      },
      async query<T extends Record<string, unknown>>() {
        const count = Math.max(0, Math.min(100, total - page++ * 100));
        return {
          rows: [
            {
              value: {
                total,
                items: Array.from({ length: count }, () => ({
                  teacherName: "Synthetic",
                })),
              },
            } as unknown as T,
          ],
        };
      },
    };
    const { ActivityService } =
      await import("../../src/server/activities/service");
    const pending = new ActivityService(db).exportRows(
      "synthetic",
      "journals",
      { from: "2026-01-01", to: "2026-01-02" },
    );
    if (total > 10000) await assert.rejects(pending, /EXPORT_TOO_LARGE/);
    else assert.equal((await pending).length, total);
  });
}
