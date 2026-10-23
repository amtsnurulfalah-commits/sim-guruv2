import { z } from "zod";
// Export envelopes retain sheet/header/row ordering and source metadata.
const cell = z.union([
  z.string().max(20000),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);
export const exportSchema = z
  .object({
    version: z.literal(1),
    source: z.string().trim().min(1).max(120),
    exportedAt: z.iso.datetime({ offset: true }),
    timezone: z.literal("Asia/Jakarta"),
    locale: z.string().min(2).max(30),
    dateFormat: z.enum(["ISO", "DMY"]),
    sheets: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(100),
            headers: z.array(z.string().max(100)).min(1).max(150),
            rows: z.array(z.array(cell).max(150)).max(10000),
          })
          .strict(),
      )
      .min(1)
      .max(80),
    triggers: z
      .array(
        z
          .object({ handler: z.string().max(120), enabled: z.boolean() })
          .strict(),
      )
      .max(100)
      .default([]),
  })
  .strict()
  .refine(
    (v) => v.sheets.reduce((n, s) => n + s.rows.length, 0) <= 10000,
    "ROW_LIMIT",
  );
export type LegacyExport = z.infer<typeof exportSchema>;
export type Issue = {
  code: string;
  sheet: string;
  row: number | null;
  field: string | null;
  severity: "error" | "review";
  resolution?: string;
};
export type StagedRow = {
  sheet: string;
  row: number;
  raw: Record<string, unknown>;
  normalized: Record<string, unknown>;
  legacyId: string | null;
};
export type Profile = {
  version: 1;
  source: string;
  sourceChecksum: string;
  exportedAt: string;
  timezone: "Asia/Jakarta";
  metadata: {
    locale: string;
    dateFormat: "ISO" | "DMY";
    triggers: LegacyExport["triggers"];
    sheets: { name: string; headers: string[]; count: number }[];
  };
  rows: StagedRow[];
  issues: Issue[];
  summary: {
    rows: number;
    errors: number;
    review: number;
    redactedFields: number;
  };
};
export const gates = [
  "source_backup",
  "restore_drill",
  "reconciliation",
  "parallel_run",
  "uat_admin",
  "uat_guru",
  "legacy_freeze",
  "delta_reconciliation",
  "rollback_plan",
  "cutover_approval",
] as const;
export type Gate = (typeof gates)[number];
export const gateSchema = z
  .object({
    batchId: z.uuid(),
    gate: z.enum(gates),
    version: z.string().regex(/^[1-9][0-9]*$/),
    passed: z.boolean(),
    evidence: z.string().trim().min(10).max(1000),
    reason: z.string().trim().min(5).max(500),
  })
  .strict();
export const resolveSchema = z.object({
  batchId: z.uuid(), version: z.string().regex(/^[1-9][0-9]*$/),
  sequence: z.number().int().positive(),
  evidence: z.string().trim().min(10).max(1000), reason: z.string().trim().min(5).max(500),
}).strict();
export type MigrationBoard = {
  batches: {
    id: string;
    source: string;
    source_checksum: string;
    state: string;
    summary: Profile["summary"];
    version: string;
    created_at: string;
    gates: { gate: Gate; passed: boolean; evidence: string; version: string }[];
  }[];
};
