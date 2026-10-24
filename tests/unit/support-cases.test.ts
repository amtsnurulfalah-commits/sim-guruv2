import test from "node:test";
import assert from "node:assert/strict";
import { caseCommand, caseQuery } from "../../src/lib/operations/support-cases";
const id = "11111111-1111-4111-8111-111111111111";
test("support case contracts require verified reporter context, proof of resolution and no credential assignments", () => {
  const create = {
    operation: "create",
    operationKey: id,
    reference: id,
    title: "Kendala jurnal",
    summary: "Jurnal pada tanggal sumber ditolak",
    reason: "Pelapor menghubungi admin",
    reporterId: null,
    reporterVerified: false,
  };
  assert.ok(caseCommand.safeParse(create).success);
  assert.equal(
    caseCommand.safeParse({ ...create, reporterVerified: true }).success,
    false,
  );
  for (const reason of [
    "password=very-secret",
    "OTP: 123456",
    "token=abc",
    "Bearer abcdef",
    "postgresql://admin:secret@db/x",
    "-----BEGIN PRIVATE KEY-----",
  ])
    assert.equal(caseCommand.safeParse({ ...create, reason }).success, false);
  const close = {
    operation: "update",
    operationKey: id,
    id,
    version: "1",
    status: "resolved",
    ownerId: id,
    reason: "Perbaikan telah diuji ulang",
    resolution: "Konfigurasi diperbaiki",
    verification: "Guru menguji kembali dan berhasil",
  };
  assert.ok(caseCommand.safeParse(close).success);
  for (const field of ["resolution", "verification"])
    assert.equal(
      caseCommand.safeParse({ ...close, [field]: "" }).success,
      false,
    );
  assert.equal(
    caseCommand.safeParse({ ...close, ownerId: null }).success,
    false,
  );
  assert.equal(caseCommand.safeParse({ ...close, actorId: id }).success, false);
  assert.equal(caseQuery.safeParse({ kind: "list", page: 0 }).success, false);
  assert.ok(
    caseQuery.safeParse({
      kind: "list",
      q: "JOURNAL_BLOCKED",
      status: "waiting",
    }).success,
  );
});
