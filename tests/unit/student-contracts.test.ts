import test from "node:test";
import assert from "node:assert/strict";
import {
  studentRecapSchema,
  studentProgressSchema,
  verifyStudentList,
  readStudentResponse,
  studentOptionsSchema,
} from "../../src/lib/activities/student-contracts";
import { commandSchemas } from "../../src/lib/activities/schemas";
const id = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222";
const row = {
  id,
  class_id: id,
  academic_period_id: id,
  date: "2026-10-23",
  hadir: 28,
  sakit: 1,
  izin: 1,
  alpa: 0,
  version: "9007199254740993",
  submitted_by: id,
  className: "VII",
  submittedByName: "Admin",
};
test("student recap DTO preserves version strings and rejects invalid counts/identity", () => {
  assert.equal(studentRecapSchema.parse(row).version, row.version);
  for (const change of [
    { version: 1 },
    { hadir: NaN },
    { hadir: -1 },
    { hadir: 0, sakit: 0, izin: 0, alpa: 0 },
    { hadir: 1000, sakit: 1 },
    { date: "2026-02-30" },
    { submitted_by: null },
  ])
    assert.equal(
      studentRecapSchema.safeParse({ ...row, ...change }).success,
      false,
    );
  assert.throws(
    () => readStudentResponse(studentOptionsSchema, { private: "not-to-echo" }),
    (e) => e instanceof Error && !e.message.includes("not-to-echo"),
  );
});
test("student progress validates exact required set, completed count and empty completeness", () => {
  const progress = {
    required: [{ id, name: "VII", expectedStudents: 30, complete: true }],
    requiredCount: 1,
    completedCount: 1,
    complete: true,
  };
  assert.equal(studentProgressSchema.safeParse(progress).success, true);
  for (const change of [
    { requiredCount: 2 },
    { completedCount: 0 },
    { complete: false },
    { required: [...progress.required, ...progress.required] },
  ])
    assert.equal(
      studentProgressSchema.safeParse({ ...progress, ...change }).success,
      false,
    );
  assert.equal(
    studentProgressSchema.safeParse({
      required: [],
      requiredCount: 0,
      completedCount: 0,
      complete: true,
    }).success,
    true,
  );
});
test("student list rejects cross-account, wrong dates, duplicate identity and wrong page", () => {
  const value = { items: [row], total: 1, page: 1, pageSize: 25 },
    filter = {
      from: row.date,
      to: row.date,
      page: 1,
      pageSize: 25,
      admin: false,
      userId: id,
    };
  assert.equal(verifyStudentList(value, filter).items.length, 1);
  for (const change of [
    { items: [row, row] },
    { page: 2 },
    { total: 0 },
    { items: [{ ...row, submitted_by: other }] },
    { items: [{ ...row, date: "2026-10-22" }] },
  ])
    assert.throws(() => verifyStudentList({ ...value, ...change }, filter));
  assert.equal(
    verifyStudentList(
      { ...value, items: [{ ...row, submitted_by: other }] },
      { ...filter, admin: true },
    ).items.length,
    1,
  );
});
test("student commands reject blank/noninteger/oversized totals and identify hadir", () => {
  const input = {
    classId: id,
    date: row.date,
    hadir: 28,
    sakit: 1,
    izin: 1,
    alpa: 0,
    version: "0",
    reason: "Pengujian siswa",
  };
  for (const hadir of [undefined, NaN, -1, 1.5])
    assert.equal(
      commandSchemas["students-save"].safeParse({ ...input, hadir }).success,
      false,
    );
  for (const counts of [
    { hadir: 0, sakit: 0, izin: 0, alpa: 0 },
    { hadir: 1000, sakit: 1, izin: 0, alpa: 0 },
  ]) {
    const result = commandSchemas["students-save"].safeParse({
      ...input,
      ...counts,
    });
    assert.equal(result.success, false);
    if (!result.success)
      assert.deepEqual(result.error.issues[0]?.path, ["hadir"]);
  }
});
