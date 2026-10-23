import test from "node:test";
import assert from "node:assert/strict";
import { ActivityService } from "../../src/server/activities/service";
import type { SqlDatabase, SqlExecutor } from "../../scripts/lib/sql-database";
function fixture(total: number, empty = false) {
  let reads = 0;
  const tx: SqlExecutor = {
    exec: async () => {},
    query: async <T extends Record<string, unknown>>() => {
      reads++;
      const size = empty ? 0 : Math.min(100, total - (reads - 1) * 100);
      return {
        rows: [
          {
            value: {
              total,
              items: Array.from({ length: size }, (_, i) => ({
                id: (reads - 1) * 100 + i,
              })),
            },
          } as unknown as T,
        ],
      };
    },
  };
  const db: SqlDatabase = {
    ...tx,
    transaction: async (work) => work(tx),
    close: async () => {},
  };
  return { service: new ActivityService(db), reads: () => reads };
}
const input = { from: "2090-01-01", to: "2090-12-31" };
test("attendance exports reject over 10000 rows before fetching the remaining pages", async () => {
  const f = fixture(10001);
  await assert.rejects(
    () => f.service.exportRows("A".repeat(43), "attendance", input),
    /EXPORT_TOO_LARGE/,
  );
  assert.equal(f.reads(), 1);
});
test("attendance exports allow exactly 10000 rows across all pages", async () => {
  const f = fixture(10000);
  assert.equal(
    (await f.service.exportRows("A".repeat(43), "attendance", input)).length,
    10000,
  );
  assert.equal(f.reads(), 100);
});
test("attendance export cannot loop forever when a batch makes no progress", async () => {
  const f = fixture(1, true);
  await assert.rejects(
    () => f.service.exportRows("A".repeat(43), "attendance", input),
    /INVALID_EXPORT_RESPONSE/,
  );
  assert.equal(f.reads(), 1);
});
