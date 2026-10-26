import test from "node:test";
import assert from "node:assert/strict";
import { defaultPreferences, preferenceKey, preferencesSchema, readPreferences, writePreferences } from "../../src/lib/preferences/storage";
const memory = () => {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
};
test("preferences roundtrip only allowlisted display settings; no identity/filter payload", () => {
  const storage = memory();
  writePreferences(storage, "account:admin", { density: "compact", taskPageSize: 50, pins: ["jurnal", "jadwal"] });
  assert.equal(readPreferences(storage, "account:admin").taskPageSize, 50);
  for (const patch of [{ density: "hidden" }, { taskPageSize: 100000 }, { pins: ["/admin/secret"] }, { pins: ["jurnal", "jurnal"] }, { role: "admin" }, { date: "2090-01-01" }, { pins: ["jurnal", "jadwal", "piket", "ujian", "kehadiran"] }]) assert.equal(preferencesSchema.safeParse({ ...defaultPreferences(), ...patch }).success, false);
});
test("wrong account/role, malformed or legacy values reset safely without retaining old pins", () => {
  const storage = memory();
  writePreferences(storage, "A:admin", { density: "compact", taskPageSize: 10, pins: ["pengguna"] });
  assert.deepEqual(readPreferences(storage, "A:guru"), defaultPreferences());
  assert.equal(storage.getItem(preferenceKey), null);
  for (const bad of ["{", JSON.stringify({ version: 0 }), "x".repeat(2001)]) {
    storage.setItem(preferenceKey, bad);
    assert.deepEqual(readPreferences(storage, "B:guru"), defaultPreferences());
    assert.equal(storage.getItem(preferenceKey), null);
  }
});
