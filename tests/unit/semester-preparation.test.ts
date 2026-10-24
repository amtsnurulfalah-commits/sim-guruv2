import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  preparationRequest,
  commitRequest,
  readPreparationReceipt,
  type PreparationPreview,
} from "../../src/lib/semester-preparation/contracts";
test("semester allowlist rejects extra data and same source/target", () => {
  const sourceId = randomUUID(),
    targetId = randomUUID(),
    q = {
      sourceId,
      targetId,
      configuration: "classes",
      reason: "Persiapan semester",
    };
  assert.equal(preparationRequest.safeParse(q).success, true);
  for (const x of [
    { ...q, targetId: sourceId },
    { ...q, configuration: "all" },
    { ...q, copyTransactions: true },
    { ...q, reason: "x" },
  ])
    assert.equal(preparationRequest.safeParse(x).success, false);
  assert.equal(
    commitRequest.safeParse({ previewId: randomUUID(), classes: [] }).success,
    false,
  );
});
test("receipt must match reviewed mapping and exact counts before success is shown", () => {
  const klass = {
      id: randomUUID(),
      sourceId: randomUUID(),
      name: "Kelas",
      level: "SMP",
      grade: 7,
      parallel: "",
      expectedStudents: 0 as const,
    },
    sourceId = randomUUID(),
    targetId = randomUUID(),
    previewId = randomUUID();
  const preview: PreparationPreview = {
    previewId,
    expiresAt: "2095-01-01",
    result: null,
    plan: {
      sourceId,
      targetId,
      sourceDate: "2090-06-30",
      validFrom: "2090-07-01",
      validTo: "2090-12-31",
      configuration: "classes",
      classes: [klass],
      schedules: [],
      issues: [],
    },
  };
  const r = {
    previewId,
    sourceId,
    targetId,
    classes: 1,
    schedules: 0,
    committedAt: "2090-01-01",
    classMapping: [klass],
    scheduleMapping: [],
  };
  assert.equal(readPreparationReceipt(preview, r).previewId, previewId);
  for (const x of [
    { ...r, previewId: randomUUID() },
    { ...r, classes: 0, classMapping: [] },
    { ...r, classMapping: [{ ...klass, id: randomUUID() }] },
    { ...r, classes: 2 },
  ])
    assert.throws(() => readPreparationReceipt(preview, x));
});
