import test from "node:test";
import assert from "node:assert/strict";
import {
  endTime,
  scheduleData,
  bulkSchedule,
} from "../../src/lib/schedules/schemas";
test("Schedule preview end combines JTM and rest minutes without midnight modulo", () => {
  assert.equal(endTime("07:30", "2", 40, 15), "09:05:00.0000");
  assert.equal(endTime("07:30", "1.5", 25, 0), "08:07:30.0000");
  assert.equal(endTime("23:50", "1", 40, 0), null);
});
test("Fractional JTM retains four decimal places down to fractional seconds", () => {
  assert.equal(endTime("13:00", "0.0001", 40, 0), "13:00:00.2400");
  assert.equal(endTime("07:30", "1e2", 40, 0), null);
  assert.equal(endTime("25:00", "1", 40, 0), null);
});
test("Schedule inputs reject hidden end-time/precision/negative and inverted validity", () => {
  const id = "11111111-1111-4111-8111-111111111111",
    v = {
      academicPeriodId: id,
      userId: id,
      subjectId: id,
      classId: id,
      dayIndex: 0,
      timeStart: "07:30",
      scheduledJtm: "1.5",
      restMinutes: 0,
      validFrom: "2090-01-01",
      validTo: "2090-06-30",
    };
  assert.equal(scheduleData.parse(v).scheduledJtm, "1.5000");
  for (const p of [
    { scheduledJtm: "0.00001" },
    { timeEnd: "08:00" },
    { restMinutes: -1 },
    { dayIndex: 7 },
    { validFrom: "2090-07-01" },
  ])
    assert.equal(scheduleData.safeParse({ ...v, ...p }).success, false);
});
test("Bulk scheduling changes reject duplicate targets and actor-controlled keys", () => {
  const id = "11111111-1111-4111-8111-111111111111",
    v = {
      items: [{ id, version: "1" }],
      stopFrom: "2090-01-01",
      reason: "Alasan uji",
    };
  assert.equal(bulkSchedule.safeParse(v).success, true);
  assert.equal(
    bulkSchedule.safeParse({ ...v, items: [...v.items, ...v.items] }).success,
    false,
  );
  assert.equal(bulkSchedule.safeParse({ ...v, actorId: id }).success, false);
});
