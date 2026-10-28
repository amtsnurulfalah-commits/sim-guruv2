import test from "node:test";
import assert from "node:assert/strict";
import { honorStatementSchema } from "../../src/lib/finance/contracts";
import { financeComponentLabel, honorLineContext, honorLineReferences, honorSourceLink, honorTransportFacts, honorModeText } from "../../src/lib/finance/provenance";
import { syntheticHonorStatement } from "../helpers/honor-snapshot";
test("honor display retains source metadata and exact final money, supports old snapshots", () => {
  const raw = syntheticHonorStatement(), parsed = honorStatementSchema.parse(raw);
  assert.equal(parsed.snapshot.rateId, raw.snapshot.rateId);
  for (const key of ["rate", "teachingRaw", "teachingSettled", "transportRaw", "transportSettled", "total"] as const) assert.equal(parsed.snapshot[key], raw.snapshot[key]);
  assert.match(honorModeText(parsed.snapshot), /Final/);
  assert.match(honorModeText({ mode: "projection" }), /belum menjadi pembayaran final/);
  delete raw.snapshot.rateId; delete raw.snapshot.rateMissing; delete raw.snapshot.ratePolicy; delete raw.snapshot.allowancePolicy;
  assert.equal(honorStatementSchema.safeParse(raw).success, true);
});
test("source links use only allowed paths, actual dates and context; no private IDs or arbitrary URL", () => {
  const line = syntheticHonorStatement().snapshot.lines[0]!;
  assert.equal(honorSourceLink(line), "/jurnal?date=2090-01-05&section=history");
  assert.equal(honorSourceLink({ component: "TRANSPORT", date: "2090-01-05", sourceRef: "private" }), "/kehadiran?date=2090-01-05");
  for (const date of ["2090-02-30", "2090-01-05&user=secret", null]) assert.equal(honorSourceLink({ ...line, date }), null);
  for (const component of ["CORRECTION", "ALLOWANCE", "https://example.test", "constructor", "__proto__"]) assert.equal(honorSourceLink({ ...line, component }), null);
  assert.equal(financeComponentLabel("constructor"), "constructor");
});
test("lineage safely identifies reversals and integer correction sequences without dumping arbitrary JSON", () => {
  assert.deepEqual(honorLineReferences({ component: "CORRECTION", reversesId: "ref", sequence: 2, reason: "do-not-render", version: { hidden: true } }), [["Membalik catatan JTM", "ref"], ["Urutan koreksi", "2"]]);
  assert.deepEqual(honorLineContext({ component: "KBM", sourceSnapshot: { subjectName: "IPA", credential: "do-not-render" } }), [["Mata pelajaran", "IPA"]]);
  assert.deepEqual(honorLineContext({ component: "KBM", sourceSnapshot: ["bad"] }), []);
  assert.deepEqual(honorTransportFacts({ component: "TRANSPORT", effectiveMinutes: "120.0000", ratio: "0.667", blocked: false }), [["Menit efektif", "120"], ["Rasio tampilan (dibulatkan sistem)", "0,667"], ["Transport diblok", "Tidak"]]);
});
