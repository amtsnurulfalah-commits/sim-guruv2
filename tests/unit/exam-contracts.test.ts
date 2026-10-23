import test from "node:test";
import assert from "node:assert/strict";
import {
  examBoardSchema,
  readExamResponse,
  examOperations,
  bapAvailability,
  validateBap,
  validateExamOperation,
  validateExamSave,
} from "../../src/lib/programs/exam-contracts";
import type { ExamBoard, ExamOccurrence } from "../../src/lib/programs/schemas";
const id = "11111111-1111-4111-8111-111111111111",
  guru = "22222222-2222-4222-8222-222222222222",
  panitia = "33333333-3333-4333-8333-333333333333",
  period = "44444444-4444-4444-8444-444444444444";
const o: ExamOccurrence = {
  id,
  kind: "EXAM_SUPERVISOR",
  date: "2090-01-02",
  userId: guru,
  originalUserId: guru,
  teacherName: "Guru",
  originalTeacherName: "Guru",
  className: "Ruang A",
  subjectName: "IPA",
  timeStart: "08:00",
  timeEnd: "09:00",
  scheduledJtm: "3.0000",
  adjustedJtm: "2.0000",
  remainingJtm: "1.0000",
  adjustmentReason: null,
  confirmed: true,
  version: "1",
  substitutionId: null,
  journalId: null,
  allocations: [],
  sourceId: id,
  sourceVersion: "1",
  roomId: id,
  overrideJtm: null,
  periodId: period,
  sessionName: "Sesi I",
  periodName: "Semester",
  expectedStudents: 30,
  bap: null,
  lockedBaps: 0,
  netJtm: "0.0000",
};
const board: ExamBoard = {
  date: o.date,
  admin: true,
  canOperate: true,
  required: [{ id, name: "Kelas", complete: true }],
  periods: [
    {
      id: period,
      academic_period_id: id,
      name: "Ujian",
      date_start: o.date,
      date_end: "2090-01-05",
      default_committee_jtm: "1.0000",
      version: "1",
    },
  ],
  sessions: [
    {
      id,
      period_id: period,
      date: o.date,
      name: "Sesi",
      time_start: "08:00:00",
      time_end: "09:00:00",
      scheduled_jtm: "3.0000",
      version: "1",
    },
  ],
  rooms: [
    {
      id,
      session_id: id,
      name: "Ruang",
      subject_id: id,
      total_students: 30,
      classIds: [id],
      version: "1",
    },
  ],
  occurrences: [
    o,
    {
      ...o,
      id: panitia,
      sourceId: panitia,
      kind: "EXAM_COMMITTEE",
      userId: panitia,
      originalUserId: panitia,
      roomId: null,
    },
  ],
  baps: [],
  recaps: [],
  teachers: [{ id: guru, name: "Guru" }],
  academicPeriods: [{ id, name: "Semester" }],
  classes: [{ id, name: "Kelas", periodId: id }],
  subjects: [{ id, name: "IPA" }],
};
test("exam board rejects malformed, duplicate and cross-date data; normalizes numeric master JTM", () => {
  assert.ok(readExamResponse(examBoardSchema, board));
  assert.equal(
    examBoardSchema.parse({
      ...board,
      periods: [{ ...board.periods[0], default_committee_jtm: 1 }],
    }).periods[0]?.default_committee_jtm,
    "1",
  );
  for (const value of [
    null,
    { ...board, date: "2090-01-03" },
    { ...board, occurrences: [o, o] },
    { ...board, occurrences: [{ ...o, netJtm: "NaN" }] },
  ])
    assert.throws(
      () => readExamResponse(examBoardSchema, value),
      /Format data ujian/,
    );
});
test("committee operations follow period, required recaps, ownership and WIB date", () => {
  const b = { ...board, admin: false };
  assert.ok(examOperations(o, b, panitia, o.date).includes("revoke"));
  assert.deepEqual(examOperations(o, b, guru, o.date), []);
  assert.deepEqual(
    examOperations(
      o,
      { ...b, required: [{ id, name: "Kelas", complete: false }] },
      panitia,
      o.date,
    ),
    [],
  );
  assert.deepEqual(
    examOperations({ ...o, periodId: id }, b, panitia, o.date),
    [],
  );
  assert.deepEqual(examOperations(o, board, id, "2090-01-03"), []);
  assert.deepEqual(
    examOperations({ ...o, kind: "EXAM_COMMITTEE" }, board, id, o.date),
    ["revoke", "substitute"],
  );
});
test("BAP uses end plus five minutes WIB and inclusive period-end deadline", () => {
  const at = (date: string, time: string) =>
    Date.parse(date + "T" + time + "+07:00");
  assert.match(
    bapAvailability(o, board, guru, at(o.date, "09:04:59")),
    /5 menit/,
  );
  assert.equal(bapAvailability(o, board, guru, at(o.date, "09:05:00")), "");
  assert.equal(
    bapAvailability(o, board, guru, at("2090-01-05", "23:59:59")),
    "",
  );
  assert.match(
    bapAvailability(o, board, guru, at("2090-01-06", "00:00:00")),
    /berakhir/,
  );
  assert.match(
    bapAvailability(
      { ...o, confirmed: false },
      board,
      guru,
      at(o.date, "12:00:00"),
    ),
    /konfirmasi/,
  );
  assert.match(
    bapAvailability(o, board, id, at(o.date, "12:00:00")),
    /pengawas efektif/,
  );
});
test("BAP validates exact integer participant totals", () => {
  const data = {
    occurrenceId: id,
    operation: "create",
    version: "0",
    present: 29,
    absent: 1,
    notes: "",
  };
  assert.ok(validateBap(data, o));
  assert.throws(() => validateBap({ ...data, present: 28 }, o), /Jumlah hadir/);
  assert.throws(() => validateBap({ ...data, present: 29.5, absent: 0.5 }, o));
  assert.throws(
    () =>
      validateBap(
        { ...data, present: 1000, absent: 1 },
        { ...o, expectedStudents: 0 },
      ),
    /Jumlah hadir/,
  );
});
test("exam master errors identify dates, time fields and cross-semester classes", () => {
  const data = {
    entity: "session",
    version: "0",
    reason: "Sesi pengujian",
    data: {
      periodId: period,
      date: o.date,
      name: "Sesi",
      timeStart: "08:00",
      timeEnd: "09:00",
      jtm: "3",
    },
  };
  assert.ok(validateExamSave(data, board, o.date));
  assert.throws(
    () =>
      validateExamSave(
        { ...data, data: { ...data.data, date: "2090-01-06" } },
        board,
        o.date,
      ),
    /periode ujian/,
  );
  try {
    validateExamSave(
      { ...data, data: { ...data.data, timeEnd: "07:00" } },
      board,
      o.date,
    );
    assert.fail();
  } catch (e) {
    assert.equal(
      (e as { issues: { path: string[] }[] }).issues[0]?.path[0],
      "timeEnd",
    );
  }
  assert.throws(
    () =>
      validateExamSave(
        {
          entity: "room",
          version: "0",
          reason: "Ruang ujian",
          data: {
            sessionId: id,
            name: "Ruang",
            subjectId: id,
            totalStudents: 30,
            classIds: [guru],
          },
        },
        board,
        o.date,
      ),
    /semester/,
  );
});
test("exam JTM conservation compares decimal values exactly", () => {
  const data = {
    occurrenceId: id,
    version: "1",
    operation: "allocate",
    reason: "Alokasi",
    userId: panitia,
    allocatedJtm: "1.0000",
  };
  assert.ok(validateExamOperation(data, o));
  assert.throws(
    () => validateExamOperation({ ...data, allocatedJtm: "1.0001" }, o),
    /melebihi/,
  );
});
