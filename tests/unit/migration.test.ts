import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { profileExport, checksum } from "../../src/lib/migration/profile";
import {
  booleanValue,
  decimalValue,
  isoDate,
  localTime,
  textIdentifier,
} from "../../src/lib/migration/normalize";
import { planSchema, reconcile } from "../../src/lib/migration/plan";
const envelope = (sheets: unknown[]) => ({
  version: 1,
  source: "fixture-only",
  exportedAt: "2026-10-20T00:00:00Z",
  timezone: "Asia/Jakarta",
  locale: "id-ID",
  dateFormat: "DMY",
  sheets,
});
test("MIG-U01 explicit date, boolean, time and exact decimal normalization", () => {
  assert.equal(isoDate("29/02/2024", "DMY"), "2024-02-29");
  for (const d of ["29/02/2025", "01/02/2026T10:00", "2026-02-30"])
    assert.throws(() => isoDate(d, "DMY"));
  assert.throws(() => isoDate(46000, "ISO"));
  assert.equal(booleanValue("FALSE"), false);
  assert.equal(booleanValue("ya"), true);
  assert.throws(() => booleanValue("maybe"));
  assert.equal(localTime("08:00"), "08:00:00");
  assert.throws(() => localTime("24:00"));
  assert.equal(decimalValue("999999999999999.0001"), "999999999999999.0001");
  assert.throws(() => decimalValue(1.2));
  assert.throws(() => decimalValue("1,000"));
  assert.throws(() => decimalValue("-0.1"));
  assert.equal(textIdentifier("0000123"), "0000123");
  assert.throws(() => textIdentifier(123));
});
test("MIG-U02 headers, duplicates, orphan and source IDs are profiled without values in errors", () => {
  const p = profileExport(
    envelope([
      {
        name: "Users",
        headers: ["user_id", "username", "nip"],
        rows: [
          ["001", "Guru.One", "0000123"],
          ["001", "guru.one", 123],
        ],
      },
      {
        name: "Teaching_Logs",
        headers: ["log_id", "user_id", "date", "jtm_val"],
        rows: [["log-1", "missing", "31/02/2026", "1.2"]],
      },
    ]),
  );
  for (const code of [
    "DUPLICATE_LEGACY_ID",
    "DUPLICATE_USERNAME",
    "TEXT_IDENTIFIER_REQUIRED",
    "INVALID_DATE",
    "ORPHAN_USER_REFERENCE",
  ])
    assert.ok(
      p.issues.some((i) => i.code === code),
      code,
    );
  assert.equal(p.rows[0]!.normalized.nip, "0000123");
  assert.equal(p.rows[2]!.legacyId, "log-1");
  assert.equal(JSON.stringify(p.issues).includes("guru.one"), false);
});
test("MIG-U03 passwords, nested secrets and secret config are excluded before persistence", () => {
  const p = profileExport(
    envelope([
      {
        name: "Users",
        headers: ["user_id", "username", "password", "details_json"],
        rows: [
          [
            "001",
            "guru.one",
            "DO-NOT-PERSIST",
            '{"salary":"100","token":"TOKEN-SECRET","nested":{"answer":"ANSWER-SECRET"}}',
          ],
        ],
      },
      { name: "Sessions", headers: ["token"], rows: [["SESSION-SECRET"]] },
      {
        name: "Config",
        headers: ["key", "value"],
        rows: [["SMTP_PASSWORD", "SMTP-SECRET"]],
      },
    ]),
  );
  const s = JSON.stringify(p);
  for (const secret of [
    "DO-NOT-PERSIST",
    "TOKEN-SECRET",
    "ANSWER-SECRET",
    "SESSION-SECRET",
    "SMTP-SECRET",
  ])
    assert.equal(s.includes(secret), false);
  assert.ok(p.summary.redactedFields >= 5);
  assert.equal(JSON.parse(String(p.rows[0]!.raw.details_json)).salary, "100");
});
test("MIG-U04 canonical checksum, native date contract and legacy snapshot review", () => {
  assert.equal(
    checksum({ b: 1, a: { y: 2, x: 1 } }),
    checksum({ a: { x: 1, y: 2 }, b: 1 }),
  );
  assert.throws(() => profileExport({ ...envelope([]), timezone: "UTC" }));
  const p = profileExport(
    envelope([
      {
        name: "Honor_History",
        headers: ["trx_id", "total_honor", "details_json"],
        rows: [["H-001", "10001.00", '{"source":"legacy"}']],
      },
    ]),
  );
  assert.ok(p.issues.some((i) => i.code === "LEGACY_SNAPSHOT_REVIEW_REQUIRED"));
  assert.equal(p.rows[0]!.normalized.total_honor, "10001");
});
test("MIG-U05 import plan cannot target auth/ops or activate migrated accounts", () => {
  const base = {
    version: 1,
    batchId: randomUUID(),
    sourceChecksum: "a".repeat(64),
    reason: "Rencana migrasi sintetis",
    entries: [
      {
        sourceTable: "Users",
        legacyId: "001",
        targetTable: "app.app_users",
        values: {
          id: randomUUID(),
          username: "migrated",
          full_name: "Guru Migrasi",
          role: "guru",
          status: "pending_activation",
          must_change_password: true,
        },
      },
    ],
  };
  assert.ok(planSchema.parse(base));
  assert.throws(() =>
    planSchema.parse({
      ...base,
      entries: [
        { ...base.entries[0], targetTable: "auth_private.user_credentials" },
      ],
    }),
  );
  assert.throws(() =>
    planSchema.parse({
      ...base,
      entries: [
        {
          ...base.entries[0],
          values: { ...base.entries[0]!.values, status: "active" },
        },
      ],
    }),
  );
  assert.throws(() =>
    planSchema.parse({
      ...base,
      entries: [
        {
          ...base.entries[0],
          values: {
            ...base.entries[0]!.values,
            profile: { secret: "blocked" },
          },
        },
      ],
    }),
  );
  const slips = {
    ...base,
    entries: [
      {
        sourceTable: "Honor_History",
        legacyId: "h1",
        targetTable: "finance.honor_statements",
        values: { snapshot: { formulaVersion: "honor-v1.1" } },
      },
    ],
  };
  assert.throws(() => planSchema.parse(slips));
});
test("MIG-U06 differences remain unresolved until explained; never silently forced equal", () => {
  const r = reconcile([
    { key: "guru:month:jtm", source: "8.0", target: "7.6" },
    {
      key: "legacy-bug-B09",
      source: "8",
      target: "7.6",
      explanation: "H-1 corrected against expected business result",
    },
    { key: "count", source: "3", target: "3" },
  ]);
  assert.deepEqual(
    r.map((x) => x.state),
    ["unresolved", "explained", "matched"],
  );
});
