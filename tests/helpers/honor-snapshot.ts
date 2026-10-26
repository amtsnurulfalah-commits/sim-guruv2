import type { HonorStatement } from "../../src/lib/finance/schemas";
export function syntheticHonorStatement(): HonorStatement {
  const id = "11111111-1111-4111-8111-111111111111";
  return { id, trxId: "SG-SYNTHETIC-PRO5", checksum: "a".repeat(64), corrected: true, snapshot: {
    schemaVersion: 1, formulaVersion: "honor-v1", policyVersion: "finance-v1", period: "2090-01", mode: "final", cutoff: "2090-01-31",
    recipient: { id, name: "Guru sintetis", username: "synthetic", nip: null, distance: "1" }, school: null,
    rateId: id, rateMissing: false, ratePolicy: "month_end", allowancePolicy: "month_end_no_proration",
    rate: "10000.125", totalJtm: "2.4000", teachingRaw: "24000.3000000", teachingSettled: "24000", allowances: "1000",
    transportRaw: "333.34000000000000000000001", transportSettled: "500", corrections: "-200", total: "25300",
    lines: [{ component: "KBM", date: "2090-01-05", sourceRef: id, ledgerId: id, jtm: "2.4000", revision: "1", sourceSnapshot: { className: "VII A", subjectName: "IPA" } },
      { component: "CORRECTION", sourceRef: id, sourceStatementId: id, sequence: 1, delta: "-200" }],
    pendingHolidays: [], statementId: id, trxId: "SG-SYNTHETIC-PRO5", finalizedAt: "2090-02-01T00:00:00Z",
  } };
}
