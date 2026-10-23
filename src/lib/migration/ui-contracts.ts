import { z } from "zod";
import { ApiRequestError } from "../feedback/api-error";
import { gates } from "./contracts";
const count = z.number().int().nonnegative();
const version = z.string().regex(/^[1-9]\d{0,18}$/);
const unique = <T>(rows: T[], key: (row: T) => string | number) => new Set(rows.map(key)).size === rows.length;
export const migrationBoardSchema = z.object({ batches: z.array(z.object({
        id: z.uuid(), source: z.string().min(1), source_checksum: z.string().regex(/^[a-f0-9]{64}$/),
        state: z.enum(["blocked", "validated", "imported", "reconciled"]),
        summary: z.object({ rows: count, errors: count, review: count, redactedFields: count }),
        version, created_at: z.iso.datetime({ offset: true }),
        gates: z.array(z.object({ gate: z.enum(gates), passed: z.boolean(), evidence: z.string(), version }))
            .max(gates.length).refine(rows => unique(rows, row => row.gate)),
    })).max(50).refine(rows => unique(rows, row => row.id)) });
export const migrationReportSchema = z.object({
    issues: z.array(z.object({
        sequence: z.number().int().positive(), code: z.string().min(1), source_table: z.string(),
        row_number: z.number().int().positive().nullable(), field: z.string().nullable(),
        severity: z.enum(["error", "review"]), resolution: z.string().nullable(),
    })).refine(rows => unique(rows, row => row.sequence)),
    counts: z.record(z.string(), count).nullable().transform(value => value ?? {}),
    mappedRows: count,
});
export const migrationStagedSchema = z.object({ id: z.uuid(), replayed: z.boolean() });
export const migrationSavedSchema = z.object({ version });
export type MigrationBatch = z.infer<typeof migrationBoardSchema>["batches"][number];
export type MigrationReport = z.infer<typeof migrationReportSchema>;
export function readMigrationResponse<T>(schema: z.ZodType<T>, raw: unknown): T {
    const result = schema.safeParse(raw);
    if (!result.success)
        throw new ApiRequestError("INVALID_RESPONSE", "Format jawaban migrasi belum sesuai. Muat ulang dan periksa data sebelum melanjutkan.");
    return result.data;
}
export const gateLabels: Record<(typeof gates)[number], string> = {
    source_backup: "Backup sumber", restore_drill: "Uji pemulihan", reconciliation: "Rekonsiliasi",
    parallel_run: "Uji berjalan berdampingan", uat_admin: "Uji penerimaan administrator", uat_guru: "Uji penerimaan guru",
    legacy_freeze: "Penghentian pencatatan pada sistem lama", delta_reconciliation: "Pencocokan perubahan data terakhir",
    rollback_plan: "Rencana pemulihan layanan", cutover_approval: "Persetujuan pemindahan layanan",
};
