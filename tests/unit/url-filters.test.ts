import test from "node:test";
import assert from "node:assert/strict";
import {
  readUrlFilters,
  writeUrlFilters,
} from "../../src/lib/navigation/url-filters";
const defaults = { state: "active", page: "1" };
const rules = {
  state: (v: string) => ["", "active", "closed"].includes(v),
  page: (v: string) => /^[1-9]\d{0,5}$/.test(v),
};
test("URL filters reject invalid and ambiguous values and ignore undeclared data", () => {
  assert.deepEqual(
    readUrlFilters("?state=closed&page=2&password=secret", defaults, rules),
    { state: "closed", page: "2" },
  );
  for (const search of [
    "?state=bad&page=-1",
    "?state=closed&state=active&page=1e3",
    "?page=9999999",
  ])
    assert.deepEqual(readUrlFilters(search, defaults, rules), defaults);
});
test("URL updates preserve unrelated routing parameters/hash and omit defaults", () => {
  assert.equal(
    writeUrlFilters(
      "https://fixture.test/jadwal?view=schedules&page=3#weekly",
      { state: "closed", page: "1" },
      defaults,
      rules,
    ),
    "/jadwal?view=schedules&state=closed#weekly",
  );
  assert.equal(
    writeUrlFilters(
      "https://fixture.test/jadwal?state=closed&page=3",
      defaults,
      defaults,
      rules,
    ),
    "/jadwal",
  );
});
