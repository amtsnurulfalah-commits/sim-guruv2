import test from "node:test";
import assert from "node:assert/strict";
import {
  confirmationListSchema,
  confirmationOptionsSchema,
  confirmationOccurrenceSchema,
  confirmationPermissions,
  verifyConfirmationResult,
  readConfirmationResponse,
} from "../../src/lib/activities/confirmation-contracts";
const actor = "11111111-1111-4111-8111-111111111111";
const row = {
  id: "22222222-2222-4222-8222-222222222222",
  assignmentId: "33333333-3333-4333-8333-333333333333",
  kind: "KBM" as const,
  date: "2026-10-23",
  userId: actor,
  originalUserId: actor,
  version: "9007199254740993",
  classId: "44444444-4444-4444-8444-444444444444",
  subjectId: actor,
  teacherName: "Guru",
  className: "VII",
  subjectName: "IPA",
  scheduledJtm: "3.0000",
  adjustedJtm: "2.0000",
  expectedStudents: 30,
  timeStart: "07:00",
  timeEnd: "09:00",
  confirmed: false,
  claimed: false,
  journalId: null,
};
test("confirmation list validates date, unique identity and exact server numeric strings", () => {
  assert.equal(
    confirmationListSchema.safeParse({ date: row.date, items: [row] }).success,
    true,
  );
  assert.equal(
    confirmationListSchema.safeParse({ date: row.date, items: [row, row] })
      .success,
    false,
  );
  assert.equal(
    confirmationListSchema.safeParse({ date: "2026-10-22", items: [row] })
      .success,
    false,
  );
  for (const change of [
    { version: 1 },
    { scheduledJtm: 3 },
    { timeStart: "25:00" },
    { kind: "PIKET" },
    { assignmentId: null },
    { confirmed: "false" },
  ]) {
    assert.equal(
      confirmationOccurrenceSchema.safeParse({ ...row, ...change }).success,
      false,
    );
  }
  assert.equal(
    confirmationOptionsSchema.safeParse({ canOperate: "true" }).success,
    false,
  );
  assert.throws(
    () =>
      readConfirmationResponse(confirmationListSchema, {
        secret: "must-not-echo",
      }),
    (error) =>
      error instanceof Error && !error.message.includes("must-not-echo"),
  );
});
test("confirmation permission follows ownership, effective operator, date and active journal", () => {
  const own = {
    userId: actor,
    admin: false,
    canOperate: false,
    today: row.date,
  };
  assert.deepEqual(confirmationPermissions(row, own), {
    claim: true,
    confirm: false,
    revoke: false,
  });
  assert.equal(
    confirmationPermissions(row, { ...own, admin: true }).confirm,
    false,
  );
  const operator = { ...own, userId: row.id, canOperate: true };
  assert.equal(confirmationPermissions(row, operator).confirm, true);
  assert.equal(
    confirmationPermissions(row, { ...operator, canOperate: false }).confirm,
    false,
  );
  assert.deepEqual(
    confirmationPermissions(row, { ...operator, today: "2026-10-24" }),
    { claim: false, confirm: false, revoke: false },
  );
  assert.equal(
    confirmationPermissions({ ...row, confirmed: true }, operator).revoke,
    true,
  );
  assert.equal(
    confirmationPermissions(
      { ...row, confirmed: true, journalId: row.id },
      operator,
    ).revoke,
    false,
  );
});
test("confirmation acknowledgement requires matching identity, newer version and requested state", () => {
  const after = { ...row, version: "9007199254740994", confirmed: true };
  assert.equal(
    verifyConfirmationResult(after, row, "confirm").version,
    after.version,
  );
  for (const change of [
    { id: row.subjectId },
    { assignmentId: row.id },
    { date: "2026-10-22" },
    { userId: row.id },
    { version: row.version },
    { confirmed: false },
  ]) {
    assert.throws(() =>
      verifyConfirmationResult({ ...after, ...change }, row, "confirm"),
    );
  }
  assert.throws(() => verifyConfirmationResult(after, row, "claim"));
  assert.throws(() => verifyConfirmationResult(after, row, "revoke"));
  assert.equal(
    verifyConfirmationResult(
      { ...after, confirmed: false, claimed: true },
      row,
      "claim",
    ).claimed,
    true,
  );
});
