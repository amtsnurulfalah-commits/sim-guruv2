import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  honorBundleSchema,
  honorHistorySchema,
  readFinanceResponse,
  formatHonorAmount,
  validateFinanceCommand,
  validateFinancePreview,
  verifyFinancePreview,
  verifyFinanceCommit,
  financeVerifySchema,
} from "../../src/lib/finance/contracts";
import type { HonorStatement } from "../../src/lib/finance/schemas";
const id = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222",
  today = "2090-02-01",
  reason = "Alasan perubahan sintetis";
const statement = { id, snapshot: { period: "2090-01" } } as HonorStatement;
test("honor money formatting preserves integer precision and exact decimal strings", () => {
  assert.equal(
    formatHonorAmount("99999999999999999999"),
    "Rp 99.999.999.999.999.999.999",
  );
  assert.equal(formatHonorAmount("-2000"), "Rp -2.000");
  assert.equal(
    formatHonorAmount("333.34000000000000000000000000001"),
    "Rp 333,34000000000000000000000000001",
  );
  assert.equal(formatHonorAmount("0"), "Rp 0");
});
test("honor response rejects incomplete and malformed collections", () => {
  assert.throws(
    () =>
      readFinanceResponse(honorBundleSchema, {
        period: "2090-01",
        mode: "realized",
        issues: [],
        statements: [null],
      }),
    /belum dapat diverifikasi/,
  );
  assert.equal(
    honorBundleSchema.safeParse({
      period: "2090-01",
      mode: "final",
      issues: [],
      statements: [],
    }).success,
    true,
  );
  assert.equal(
    honorHistorySchema.safeParse({ items: [], total: 0, page: 1, pageSize: 20 })
      .success,
    true,
  );
  assert.equal(
    honorHistorySchema.safeParse({
      items: null,
      total: 0,
      page: 1,
      pageSize: 20,
    }).success,
    false,
  );
  const row = {
    id,
    trx_id: "SG-fixture",
    name: "Guru",
    jtm: "2.4000",
    total: "24002",
    period: "2090-01",
  };
  assert.equal(
    honorHistorySchema.safeParse({
      items: [row, row],
      total: 2,
      page: 1,
      pageSize: 20,
    }).success,
    false,
  );
});
test("transport block dates match SQL inclusive window and field errors", () => {
  const input = { userId: null, from: "2090-01-01", to: "2090-12-31", reason };
  assert.ok(validateFinanceCommand("block", input, today));
  for (const to of ["2089-12-31", "2091-01-02"])
    assert.throws(
      () => validateFinanceCommand("block", { ...input, to }, today),
      (e: unknown) =>
        e instanceof z.ZodError && e.issues.some((i) => i.path[0] === "to"),
    );
  assert.throws(
    () =>
      validateFinanceCommand(
        "holiday",
        { operation: "generate", date: "2090-02-02", reason },
        today,
      ),
    /Posting hanya/,
  );
});
test("correction target must follow original slip and decimals remain strings", () => {
  const input = {
    operation: "correction",
    requestId: id,
    requestVersion: "2",
    statementId: id,
    targetPeriod: "2090-02",
    correctedJtm: "2.4",
    correctedAllowances: "10000",
    correctedTransportRaw: "333.34000000000000000001",
    evidence: "Dokumen bukti sintetis",
    reason,
  };
  const v = validateFinancePreview(input, statement, today);
  assert.equal(v.operation, "correction");
  assert.throws(
    () =>
      validateFinancePreview(
        { ...input, targetPeriod: "2090-01" },
        statement,
        today,
      ),
    /setelah periode/,
  );
  assert.throws(
    () =>
      validateFinancePreview(
        { ...input, statementId: other },
        statement,
        today,
      ),
    /setelah periode/,
  );
  assert.throws(() =>
    validateFinancePreview({ ...input, correctedJtm: "2,4" }, statement, today),
  );
});
test("preview responses bind to request kind and period without treating missing fields as success", () => {
  const request = { operation: "finalize" as const, period: "2090-01", reason };
  const p = {
    previewId: id,
    expiresAt: "2090-02-01T12:00:00+07:00",
    result: { period: "2090-01", mode: "realized", issues: [], statements: [] },
  };
  assert.equal(verifyFinancePreview(p, request).previewId, id);
  assert.throws(
    () =>
      verifyFinancePreview(
        { ...p, result: { ...p.result, period: "2090-02" } },
        request,
      ),
    /tidak sesuai/,
  );
  assert.throws(
    () =>
      verifyFinancePreview(
        { ...p, result: { count: 1, jtm: "3.0000" } },
        request,
      ),
    /tidak sesuai/,
  );
  assert.throws(
    () => verifyFinancePreview({ ...p, expiresAt: "invalid" }, request),
    /belum dapat diverifikasi/,
  );
});
test("commit responses verify financial operation target", () => {
  const request = { operation: "finalize" as const, period: "2090-01", reason };
  assert.doesNotThrow(() =>
    verifyFinanceCommit(
      { period: "2090-01", state: "final", beneficiaries: 1 },
      request,
    ),
  );
  assert.throws(
    () =>
      verifyFinanceCommit(
        { period: "2090-02", state: "final", beneficiaries: 1 },
        request,
      ),
    /tidak sesuai/,
  );
  assert.throws(
    () => verifyFinanceCommit({}, request),
    /belum dapat diverifikasi/,
  );
  const cancel = {
    operation: "holiday-cancel" as const,
    date: "2090-01-02",
    runId: id,
    reason,
  };
  assert.throws(
    () =>
      verifyFinanceCommit(
        { count: 1, runId: other, operation: "cancel" },
        cancel,
      ),
    /tidak sesuai/,
  );
});
test("public verification accepts only documented statuses and safe fields", () => {
  assert.equal(
    financeVerifySchema.safeParse({ status: "not_found" }).success,
    true,
  );
  assert.equal(
    financeVerifySchema.safeParse({ status: "unknown" }).success,
    false,
  );
  assert.equal(
    financeVerifySchema.safeParse({ status: "valid" }).success,
    false,
  );
  const parsed = financeVerifySchema.parse({
    status: "corrected",
    documentType: "Slip honorarium",
    period: "2090-01",
    school: "Madrasah",
    recipient: "G***",
    total: "1000000",
  });
  assert.equal("total" in parsed, false);
});
