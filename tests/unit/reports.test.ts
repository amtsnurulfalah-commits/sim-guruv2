import test from "node:test";
import assert from "node:assert/strict";
import {
  accessCommand,
  reportQuery,
  reportResponseSchema,
} from "../../src/lib/reports/contracts";
test("reports accept bounded filters and require explicit independent scopes", () => {
  assert.equal(
    reportQuery.parse({ kind: "academic", period: "2026-10" }).pageSize,
    25,
  );
  for (const v of [
    { kind: "academic", period: "2026-13" },
    { kind: "finance", period: "2026-10", teacher: "admin" },
    { kind: "academic", period: "2026-10", page: 0 },
    { kind: "academic", period: "2026-10", scope: "all" },
  ])
    assert.equal(reportQuery.safeParse(v).success, false);
  assert.equal(
    accessCommand.safeParse({
      userId: "11111111-1111-4111-8111-111111111111",
      version: "0",
      reason: "Valid reason",
      academic: true,
    }).success,
    false,
  );
});
test("report decoder rejects duplicate rows and unsafe numeric money types", () => {
  const row = {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Synthetic",
    total: "9007199254740993",
  };
  const report = {
    kind: "finance",
    period: "2026-10",
    teacher: null,
    mode: "realized",
    cutoff: "2026-10-24",
    updatedAt: "2026-10-24T10:00:00Z",
    summary: { total: row.total },
    issues: [],
    items: [row],
    total: 1,
    page: 1,
    pageSize: 25,
    teachers: [],
  };
  assert.equal(reportResponseSchema.parse(report).items[0]!.total, row.total);
  assert.equal(
    reportResponseSchema.safeParse({ ...report, items: [row, row], total: 2 })
      .success,
    false,
  );
  assert.equal(
    reportResponseSchema.safeParse({
      ...report,
      items: [{ ...row, total: 9007199254740992 }],
    }).success,
    false,
  );
});
