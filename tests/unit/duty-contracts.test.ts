import test from "node:test";
import assert from "node:assert/strict";
import {
  dutyBoardSchema,
  dutyOperations,
  readDutyResponse,
  validateDutyOperation,
  validateDutySchedule,
} from "../../src/lib/duties/contracts";
import {
  dutyScheduleSchema,
  type DutyBoard,
  type DutyOccurrence,
} from "../../src/lib/duties/schemas";
const id = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222",
  third = "33333333-3333-4333-8333-333333333333";
const o: DutyOccurrence = {
  id,
  kind: "PIKET",
  date: "2090-01-02",
  userId: other,
  originalUserId: other,
  teacherName: "Guru",
  originalTeacherName: "Guru",
  className: null,
  subjectName: null,
  timeStart: "07:00",
  timeEnd: "14:00",
  scheduledJtm: "4.0000",
  adjustedJtm: "2.0000",
  remainingJtm: "1.9999",
  adjustmentReason: null,
  confirmed: true,
  version: "1",
  substitutionId: null,
  journalId: null,
  allocations: [
    {
      id: third,
      userId: third,
      teacherName: "Penerima",
      jtm: "0.0001",
      reason: "uji",
    },
  ],
};
const board: DutyBoard = {
  date: o.date,
  admin: true,
  canOperate: false,
  occurrences: [o],
  schedules: [],
  teachers: [{ id: other, name: "Guru" }],
  periods: [
    {
      id: third,
      name: "Periode",
      dateStart: "2090-01-01",
      dateEnd: "2090-06-30",
    },
  ],
};
const data = {
  version: "0",
  reason: "Jadwal pengujian",
  kind: "PIKET",
  userId: other,
  academicPeriodId: third,
  dayIndex: 1,
  date: null,
  validFrom: o.date,
  validTo: o.date,
  timeStart: "07:00",
  timeEnd: "14:00",
  active: true,
};
test("duty board rejects malformed, duplicate and cross-date responses", () => {
  assert.equal(readDutyResponse(dutyBoardSchema, board).occurrences.length, 1);
  for (const raw of [
    null,
    { ...board, occurrences: [o, o] },
    { ...board, date: "2090-01-03" },
    { ...board, occurrences: [{ ...o, scheduledJtm: "NaN" }] },
  ])
    assert.throws(() => readDutyResponse(dutyBoardSchema, raw), /Data tugas/);
});
test("duty actions mirror date, confirmation, self-operation and substitution rules", () => {
  const actor = { admin: false, canOperate: true, userId: id, today: o.date };
  assert.deepEqual(dutyOperations(o, actor), [
    "substitute",
    "adjust",
    "allocate",
    "reset",
    "remove-allocation",
  ]);
  assert.deepEqual(dutyOperations(o, { ...actor, userId: other }), []);
  assert.deepEqual(
    dutyOperations({ ...o, kind: "UPACARA" }, { ...actor, userId: other }),
    ["revoke"],
  );
  assert.deepEqual(
    dutyOperations({ ...o, kind: "KBM" }, { ...actor, userId: other }),
    [],
  );
  assert.deepEqual(
    dutyOperations(o, { ...actor, admin: true, today: "2090-01-03" }),
    [],
  );
  assert.ok(
    dutyOperations({ ...o, substitutionId: third }, actor).includes("replace"),
  );
  assert.ok(
    !dutyOperations({ ...o, confirmed: false }, actor).includes("adjust"),
  );
});
test("schedule validation identifies range, weekday, Monday and period errors", () => {
  assert.ok(validateDutySchedule(data, board, o.date));
  for (const change of [
    { validTo: "2090-01-01" },
    { dayIndex: 2 },
    { timeEnd: "06:59" },
    {
      kind: "UPACARA",
      date: "2090-01-03",
      validFrom: "2090-01-03",
      validTo: "2090-01-03",
    },
  ])
    assert.equal(
      dutyScheduleSchema.safeParse({ ...data, ...change }).success,
      false,
    );
  assert.throws(
    () =>
      validateDutySchedule({ ...data, validTo: "2090-07-01" }, board, o.date),
    /Periode akademik/,
  );
  assert.throws(
    () => validateDutySchedule(data, board, "2090-01-03"),
    /sebelum hari ini/,
  );
});
test("JTM checks preserve four-decimal conservation exactly", () => {
  const base = { occurrenceId: id, version: "1", reason: "Alokasi" };
  assert.ok(
    validateDutyOperation(
      { ...base, operation: "allocate", userId: third, allocatedJtm: "1.9999" },
      o,
    ),
  );
  assert.throws(
    () =>
      validateDutyOperation(
        { ...base, operation: "allocate", userId: third, allocatedJtm: "2" },
        o,
      ),
    /melebihi sisa/,
  );
  assert.throws(
    () =>
      validateDutyOperation(
        { ...base, operation: "adjust", adjustedJtm: "4" },
        o,
      ),
    /basis dan alokasi/,
  );
  assert.throws(() =>
    validateDutyOperation(
      {
        ...base,
        operation: "allocate",
        userId: third,
        allocatedJtm: "0.00001",
      },
      o,
    ),
  );
});
