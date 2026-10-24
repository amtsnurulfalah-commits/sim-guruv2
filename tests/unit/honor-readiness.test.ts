import test from "node:test";
import assert from "node:assert/strict";
import { commandSchemas, readSchema } from "../../src/lib/finance/schemas";
import {
  readinessSchema,
  requestsSchema,
} from "../../src/lib/finance/readiness";
const id = "11111111-1111-4111-8111-111111111111";
test("readiness links cannot inject external URLs or unrelated destinations", () => {
  const base = {
    period: "2090-01",
    mode: "realized",
    scope: "own",
    issues: [],
    note: "Sumber terbentuk",
    recipients: [
      {
        userId: id,
        name: "Guru",
        total: "99999999999999999999",
        issues: [],
        administrative: [
          {
            kind: "journal",
            date: "2090-01-02",
            source_id: id,
            title: "Jurnal",
            href: "/jurnal?date=2090-01-02",
          },
        ],
      },
    ],
  };
  assert.ok(readinessSchema.safeParse(base).success);
  for (const href of [
    "https://evil.example/jurnal",
    "//evil.example",
    "javascript:alert(1)",
    "/admin/pengguna?date=2090-01-02",
  ]) {
    const input = structuredClone(base);
    input.recipients[0]!.administrative[0]!.href = href;
    assert.equal(readinessSchema.safeParse(input).success, false);
  }
});
test("correction gateway requires evidence, retry identity, version and an allowlisted decision", () => {
  const request = {
    statementId: id,
    reason: "Alasan sintetis",
    evidence: "Bukti sintetis",
    requestKey: id,
  };
  assert.ok(commandSchemas.request.safeParse(request).success);
  assert.equal(
    commandSchemas.request.safeParse({ ...request, evidence: "" }).success,
    false,
  );
  assert.equal(
    commandSchemas.request.safeParse({ ...request, reviewerId: id }).success,
    false,
  );
  const review = {
    requestId: id,
    version: "2",
    decision: "reject",
    reason: "Bukti belum memadai",
  };
  assert.ok(commandSchemas.review.safeParse(review).success);
  assert.equal(
    commandSchemas.review.safeParse({ ...review, version: "0" }).success,
    false,
  );
  assert.equal(
    commandSchemas.review.safeParse({ ...review, decision: "approve" }).success,
    false,
  );
  assert.equal(
    readSchema.safeParse({ kind: "readiness", period: "2090-01", userId: id })
      .success,
    false,
  );
  assert.ok(
    readSchema.safeParse({
      kind: "requests",
      period: "2090-01",
      statementId: id,
      page: 1,
    }).success,
  );
  assert.equal(
    requestsSchema.safeParse({ items: null, total: 0, page: 1, pageSize: 20 })
      .success,
    false,
  );
});
