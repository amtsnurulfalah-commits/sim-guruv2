import test from "node:test";
import assert from "node:assert/strict";
import {
  wibDate,
  calendarChangeSchema,
  contextChangeSchema,
} from "../../src/lib/calendar/schemas";
test("WIB operational date crosses midnight at17:00 UTC, independent of browser timezone", () => {
  assert.equal(wibDate(new Date("2026-10-19T16:59:59Z")), "2026-10-19");
  assert.equal(wibDate(new Date("2026-10-19T17:00:00Z")), "2026-10-20");
});
test("Calendar schema permits literal nonholiday, real leap date and inclusive366-day range only", () => {
  const v = {
    action: "range",
    dateStart: "2028-01-01",
    dateEnd: "2028-12-31",
    description: "Kalender uji",
    isHoliday: false,
    reason: "Alasan uji",
  };
  assert.equal(calendarChangeSchema.safeParse(v).success, true);
  assert.equal(
    calendarChangeSchema.safeParse({ ...v, dateEnd: "2029-01-01" }).success,
    false,
  );
  assert.equal(
    calendarChangeSchema.safeParse({ ...v, dateStart: "2026-02-29" }).success,
    false,
  );
  assert.equal(
    calendarChangeSchema.safeParse({ ...v, isHoliday: "false" }).success,
    false,
  );
});
test("Dated context requires explicit flags/period and rejects browser permission payloads", () => {
  const v = {
    action: "override",
    date: "2090-01-01",
    version: "0",
    academicPeriodId: "11111111-1111-4111-8111-111111111111",
    kbmEnabled: true,
    examEnabled: false,
    reason: "Alasan uji",
  };
  assert.equal(contextChangeSchema.safeParse(v).success, true);
  assert.equal(
    contextChangeSchema.safeParse({ ...v, role: "admin" }).success,
    false,
  );
  assert.equal(
    contextChangeSchema.safeParse({ ...v, academicPeriodId: "" }).success,
    false,
  );
});
