import test from "node:test";
import assert from "node:assert/strict";
import { payloadSchemas, date } from "../../src/lib/masters/schemas";
test("Master class standards follow each source level and permit empty parallel classes", () => {
  for (const [level, grade, parallel, max] of [
    ["SD", 1, "D", 28],
    ["SMP", 7, "K", 32],
    ["SMA", 10, "L", 36],
    ["SMK", 10, "X", 36],
  ] as const) {
    const v = {
      academicPeriodId: "11111111-1111-4111-8111-111111111111",
      name: "Kelas Uji",
      level,
      grade,
      parallel,
      expectedStudents: max,
    };
    assert.equal(payloadSchemas.classes.safeParse(v).success, true);
    for (const n of [0, 15])
      assert.equal(
        payloadSchemas.classes.safeParse({ ...v, expectedStudents: n }).success,
        true,
      );
    for (const n of [14, max + 1, -1, 15.5])
      assert.equal(
        payloadSchemas.classes.safeParse({ ...v, expectedStudents: n }).success,
        false,
      );
  }
});
test("Master inputs reject impossible dates and money precision without throwing unsafe errors", () => {
  for (const value of [
    "not-a-date",
    "2026-02-29",
    "2026-02-30",
    "2026-13-01",
    "infinity",
  ])
    assert.equal(date.safeParse(value).success, false);
  assert.equal(date.safeParse("2028-02-29").success, true);
  assert.equal(
    payloadSchemas.subjects.parse({ name: "  Ilmu  Pengetahuan   Alam " }).name,
    "Ilmu Pengetahuan Alam",
  );
});
