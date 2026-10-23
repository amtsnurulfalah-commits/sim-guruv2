import test from "node:test";
import assert from "node:assert/strict";
import {
  attendanceSchema,
  attendanceListSchema,
  attendanceTemplatesSchema,
  attendancePreviewSchema,
  readAttendanceResponse,
  verifyAttendanceList,
  attendancePermissions,
  validateAttendanceInput,
  verifyAttendanceMutation,
  type AttendanceRow,
} from "../../src/lib/activities/attendance-contracts";
import { commandSchemas } from "../../src/lib/activities/schemas";
const id = "11111111-1111-4111-8111-111111111111",
  user = "22222222-2222-4222-8222-222222222222",
  other = "33333333-3333-4333-8333-333333333333",
  date = "2090-01-02";
const row: AttendanceRow = {
  id,
  userId: user,
  teacherName: "Guru",
  date,
  scheduledIn: "07:00",
  scheduledOut: "14:00",
  actualIn: "07:00",
  actualOut: null,
  source: "admin",
  extra: false,
  version: "1",
  effectiveMinutes: 0,
  scheduledMinutes: 420,
  ratio: 0,
  leaves: [],
};
const list = { items: [row], total: 1, page: 1, pageSize: 25 };
test("attendance DTO rejects malformed/nonfinite values and broken identities", () => {
  assert.ok(readAttendanceResponse(attendanceSchema, row));
  for (const change of [
    { ratio: NaN },
    { effectiveMinutes: null },
    { ratio: 1.1 },
    { actualIn: null, actualOut: "14:00" },
    { scheduledOut: null },
  ])
    assert.throws(
      () => readAttendanceResponse(attendanceSchema, { ...row, ...change }),
      /Format data kehadiran/,
    );
  assert.equal(
    attendanceListSchema.safeParse({ ...list, items: [row, row] }).success,
    false,
  );
});
test("attendance responses must match requested date, teacher and page", () => {
  const filter = {
    from: date,
    to: date,
    page: 1,
    pageSize: 25,
    admin: true,
    userId: other,
    filterTeacher: user,
  };
  assert.ok(verifyAttendanceList(list, filter));
  for (const change of [
    { from: "2090-01-03" },
    { filterTeacher: other },
    { page: 2 },
    { pageSize: 1 },
  ])
    assert.throws(
      () => verifyAttendanceList(list, { ...filter, ...change }),
      /filter/,
    );
});
test("attendance buttons obey WIB today, ownership and the five-minute out gate", () => {
  const at = (day: string, time: string) =>
      Date.parse(day + "T" + time + ":00+07:00"),
    actor = {
      admin: false,
      userId: user,
      canOperate: false,
      now: at(date, "14:04"),
    };
  assert.equal(attendancePermissions(row, actor).out, false);
  assert.equal(
    attendancePermissions(row, { ...actor, now: at(date, "14:05") }).out,
    true,
  );
  assert.equal(
    attendancePermissions(row, {
      ...actor,
      admin: true,
      now: at(date, "10:00"),
    }).out,
    true,
  );
  assert.equal(
    attendancePermissions(row, { ...actor, userId: other }).leave,
    false,
  );
  assert.equal(
    attendancePermissions(row, { ...actor, userId: other, canOperate: true })
      .leave,
    true,
  );
  assert.equal(
    attendancePermissions(row, { ...actor, now: at("2090-01-03", "10:00") })
      .leave,
    false,
  );
  assert.equal(
    attendancePermissions(row, {
      ...actor,
      admin: true,
      now: at("2090-01-03", "10:00"),
    }).manual,
    true,
  );
  assert.equal(
    attendancePermissions(
      { ...row, actualIn: null },
      { ...actor, now: at(date, "06:59") },
    ).in,
    false,
  );
});
test("leave validation rejects overlap, accepts adjacent and clipped intervals", () => {
  const before = {
      ...row,
      leaves: [
        {
          id: other,
          leaveTime: "08:00",
          returnTime: "09:00",
          reason: "Izin pengujian",
        },
      ],
    },
    base = { attendanceId: id, version: "1", reason: "Izin pengujian" };
  assert.throws(
    () =>
      validateAttendanceInput(
        "leave",
        { ...base, leaveTime: "08:30", returnTime: "10:00" },
        before,
      ),
    /bert abrakan|bertabrakan/,
  );
  assert.ok(
    validateAttendanceInput(
      "leave",
      { ...base, leaveTime: "09:00", returnTime: "10:00" },
      before,
    ),
  );
  assert.ok(
    validateAttendanceInput(
      "leave",
      { ...base, leaveTime: "06:00", returnTime: "07:00" },
      before,
    ),
  );
});
test("manual validation names the invalid scheduled and actual out field", () => {
  const base = {
    userId: user,
    date,
    scheduledIn: "07:00",
    scheduledOut: "14:00",
    actualIn: "07:00",
    actualOut: null,
    extra: false,
    version: "0",
    reason: "Koreksi pengujian",
  };
  assert.ok(commandSchemas.manual.safeParse(base).success);
  assert.equal(
    commandSchemas.manual.safeParse({ ...base, scheduledOut: "06:00" }).error
      ?.issues[0]?.path[0],
    "scheduledOut",
  );
  assert.equal(
    commandSchemas.manual.safeParse({ ...base, actualOut: "06:59" }).error
      ?.issues[0]?.path[0],
    "actualOut",
  );
});
test("mutation results cannot change the selected attendance or reuse its version", () => {
  const input = { attendanceId: id, version: "1" };
  assert.ok(verifyAttendanceMutation({ ...row, version: "2" }, input, row));
  for (const change of [
    { id: other },
    { version: "1" },
    { userId: other },
    { date: "2090-01-03" },
  ])
    assert.throws(
      () =>
        verifyAttendanceMutation(
          { ...row, version: "2", ...change },
          input,
          row,
        ),
      /catatan atau versi/,
    );
});
test("template preview requires unique participants, expiry and preserved actual times", () => {
  const v = {
    previewId: id,
    date,
    expiresAt: "2090-01-02T12:10:00Z",
    timeIn: "07:00",
    timeOut: "14:00",
    participants: [{ id: user, name: "Guru" }],
    preservesActual: true,
  };
  assert.ok(attendancePreviewSchema.safeParse(v).success);
  for (const change of [
    { participants: [] },
    { preservesActual: false },
    { participants: [v.participants[0], v.participants[0]] },
  ])
    assert.equal(
      attendancePreviewSchema.safeParse({ ...v, ...change }).success,
      false,
    );
});
test("templates validate both contexts and reject duplicate day/context keys", () => {
  const t = {
    id,
    day_index: 1,
    sched_type: "KBM",
    time_in: "07:00:00",
    time_out: "14:00:00",
    version: "1",
  };
  assert.ok(
    attendanceTemplatesSchema.safeParse({
      items: [t, { ...t, id: other, sched_type: "UJIAN" }],
    }).success,
  );
  assert.equal(
    attendanceTemplatesSchema.safeParse({ items: [t, { ...t, id: other }] })
      .success,
    false,
  );
});

test("attendance mutation postconditions reject successful-looking incomplete writes", () => {
  assert.throws(
    () =>
      verifyAttendanceMutation(
        { ...row, version: "2" },
        { attendanceId: id, version: "1" },
        row,
        "out",
      ),
    /Hasil tindakan/,
  );
  assert.throws(
    () =>
      verifyAttendanceMutation(
        { ...row, version: "2" },
        {
          userId: user,
          date,
          version: "1",
          scheduledIn: "08:00",
          scheduledOut: "14:00",
          actualIn: "07:00",
          actualOut: null,
          extra: false,
        },
        row,
        "manual",
      ),
    /Hasil tindakan/,
  );
});
