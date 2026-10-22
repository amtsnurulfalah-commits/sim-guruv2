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
test("Master business validation identifies the exact fields to correct", () => {
  const invalid = payloadSchemas.classes.safeParse({ academicPeriodId: "11111111-1111-4111-8111-111111111111", name: "Kelas", level: "SD", grade: 7, parallel: "K", expectedStudents: 14 });
  assert.equal(invalid.success, false);
  if (!invalid.success) assert.deepEqual(invalid.error.issues.map(i => i.path.join(".")).sort(), ["expectedStudents", "grade", "parallel"]);
  const year = payloadSchemas["academic-years"].safeParse({ label: "2026/2028", dateStart: "2026-12-01", dateEnd: "2026-01-01" });
  assert.equal(year.success, false);
  if (!year.success) assert.deepEqual(year.error.issues.map(i => i.path.join(".")).sort(), ["dateEnd", "label"]);
  const rate = payloadSchemas.rates.safeParse({ kind: "transport", amount: "0", enabled: true, dateStart: "2026-01-01", dateEnd: "2026-12-31" });
  assert.equal(rate.success, false);
  if (!rate.success) assert.equal(rate.error.issues[0]?.path.join("."), "amount");
});
test("Master read contracts reject malformed lists and permit nullable history actor labels", async () => {
  const { masterListSchema, masterHistorySchema } = await import("../../src/lib/masters/contracts");
  assert.equal(masterListSchema.safeParse({ items: [{}], total: 1, page: 1, pageSize: 20 }).success, false);
  assert.equal(masterListSchema.safeParse({ items: [], total: -1, page: 1, pageSize: 20 }).success, false);
  assert.equal(masterHistorySchema.safeParse([{ actor_id: "11111111-1111-4111-8111-111111111111", actor_name: null, reason: "Perubahan", created_at: "2026-10-22T00:00:00Z", old_data: null, new_data: { name: "Sekolah" } }]).success, true);
});
