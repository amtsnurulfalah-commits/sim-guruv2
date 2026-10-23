import { z } from "zod";
import { ApiRequestError } from "../feedback/api-error";
import {
  commandSchemas,
  period,
  previewSchema,
  type HonorStatement,
} from "./schemas";
const decimal = z.string().regex(/^-?\d+(\.\d+)?$/),
  integer = z.string().regex(/^-?\d+$/),
  uuid = z.uuid();
const line = z
  .object({
    component: z.string(),
    sourceRef: z.string().nullable().optional(),
    ledgerId: z.string().nullable().optional(),
    sourceKey: z.string().optional(),
    date: z.iso.date().nullable().optional(),
    jtm: decimal.nullable().optional(),
    amount: decimal.nullable().optional(),
    raw: decimal.nullable().optional(),
    delta: decimal.nullable().optional(),
    name: z.string().nullable().optional(),
  })
  .passthrough();
export const honorSnapshotSchema = z.object({
  schemaVersion: z.number().int().positive(),
  formulaVersion: z.string(),
  policyVersion: z.string(),
  period,
  mode: z.enum(["realized", "projection", "final"]),
  cutoff: z.iso.date(),
  recipient: z.object({
    id: uuid,
    name: z.string(),
    nip: z.string().nullable(),
    username: z.string(),
    distance: decimal,
  }),
  school: z
    .object({
      name: z.string(),
      address: z.string(),
      npsn: z.string(),
      headmaster: z
        .string()
        .nullable()
        .transform((v) => v ?? ""),
      headmasterNip: z.string().nullable(),
    })
    .nullable(),
  rate: decimal,
  totalJtm: decimal,
  teachingRaw: decimal,
  teachingSettled: integer,
  allowances: integer,
  transportRaw: decimal,
  transportSettled: integer,
  corrections: integer,
  total: integer,
  lines: z.array(line),
  pendingHolidays: z.array(line),
  statementId: uuid.optional(),
  trxId: z.string().optional(),
  finalizedAt: z.string().optional(),
});
export const honorBundleSchema = z
  .object({
    period,
    mode: z.enum(["realized", "projection", "final"]),
    issues: z.array(z.string()),
    statements: z.array(honorSnapshotSchema),
    beneficiaries: z.number().int().nonnegative().optional(),
  })
  .refine(
    (b) =>
      b.statements.every((s) => s.period === b.period && s.mode === b.mode) &&
      new Set(b.statements.map((s) => s.recipient.id)).size ===
        b.statements.length,
  );
export const honorStatementSchema = z
  .object({
    id: uuid,
    trxId: z.string(),
    checksum: z.string().regex(/^[a-f0-9]{64}$/),
    snapshot: honorSnapshotSchema,
    corrected: z.boolean(),
  })
  .refine(
    (s) =>
      s.snapshot.mode === "final" &&
      s.snapshot.statementId === s.id &&
      s.snapshot.trxId === s.trxId,
  );
export const honorHistorySchema = z
  .object({
    items: z.array(
      z.object({
        id: uuid,
        trx_id: z.string(),
        name: z.string(),
        jtm: decimal,
        total: integer,
        period,
      }),
    ),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().min(1).max(100),
  })
  .refine(
    (h) =>
      h.items.length <= h.pageSize &&
      h.items.length <= h.total &&
      new Set(h.items.map((s) => s.id)).size === h.items.length,
  );
export const financeOperationsSchema = z.object({
  holidays: z.array(
    z.object({
      sourceKey: z.string(),
      kind: z.string(),
      date: z.iso.date(),
      userId: uuid,
      name: z.string(),
      jtm: decimal,
      state: z.enum(["projected", "pending", "posted", "waived"]),
    }),
  ),
  runs: z.array(
    z.object({
      id: uuid,
      date: z.iso.date(),
      generation: z.number().int().positive(),
      state: z.enum(["completed", "cancelled"]),
    }),
  ),
  blocks: z.array(
    z.object({
      id: uuid,
      user_id: uuid.nullable(),
      date_start: z.iso.date(),
      date_end: z.iso.date(),
      reason: z.string(),
      active: z.boolean(),
      version: z.number().int().positive().safe(),
    }),
  ),
  requests: z.array(
    z.object({ id: uuid, statement_id: uuid, reason: z.string() }),
  ),
  notificationQueue: z.string(),
});
export const correctionResultSchema = z.object({
  sourceStatementId: uuid,
  sourceChecksum: z.string().regex(/^[a-f0-9]{64}$/),
  targetPeriod: period,
  sequence: z.number().int().positive(),
  baseline: integer,
  correctedTotal: integer,
  delta: integer,
  recipientId: uuid,
});
const impactSchema = z.object({
  count: z.number().int().nonnegative(),
  jtm: decimal,
  operation: z.string().optional(),
});
export const financePreviewSchema = z.object({
  previewId: uuid,
  expiresAt: z.iso.datetime({ offset: true }),
  result: z.union([honorBundleSchema, correctionResultSchema, impactSchema]),
});
export const financeTokenSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{96}$/),
});
export const financeIdSchema = z.object({ id: uuid });
export const holidayCommandResultSchema = z.object({
  count: z.number().int().nonnegative(),
  runId: uuid.nullable(),
  operation: z.enum(["generate", "waive", "cancel"]).optional(),
  state: z.literal("cancelled").optional(),
});
export const financeVerifySchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("not_found") }),
  z.object({
    status: z.enum(["valid", "corrected"]),
    documentType: z.string(),
    period,
    school: z.string(),
    recipient: z.string(),
  }),
]);
export function readFinanceResponse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const parsed = schema.safeParse(raw);
  if (!parsed.success)
    throw new ApiRequestError(
      "INVALID_RESPONSE",
      "Hasil honorarium belum dapat diverifikasi. Muat ulang dan periksa status sebelum mengirim ulang.",
    );
  return parsed.data;
}
export function validateFinancePreview(
  raw: unknown,
  slip: HonorStatement | null,
  today: string,
) {
  const v = previewSchema.parse(raw);
  if (
    v.operation === "correction" &&
    (!slip ||
      v.statementId !== slip.id ||
      v.targetPeriod <= slip.snapshot.period)
  )
    throw new z.ZodError([
      {
        code: "custom",
        path: ["targetPeriod"],
        message: "Periode tujuan harus setelah periode slip sumber.",
      },
    ]);
  if ("date" in v && v.date > today)
    throw new z.ZodError([
      {
        code: "custom",
        path: ["date"],
        message:
          "Tindakan hari libur tidak dapat dijalankan untuk tanggal mendatang.",
      },
    ]);
  return v;
}
export function validateFinanceCommand(
  action: "holiday" | "block" | "request" | "token",
  raw: unknown,
  today: string,
) {
  const v = commandSchemas[action].parse(raw);
  if ("date" in v && v.date > today)
    throw new z.ZodError([
      {
        code: "custom",
        path: ["date"],
        message:
          "Posting hanya dapat dilakukan untuk hari ini atau sebelumnya.",
      },
    ]);
  return v;
}
export function verifyFinancePreview(
  raw: unknown,
  request: z.infer<typeof previewSchema>,
) {
  const v = readFinanceResponse(financePreviewSchema, raw),
    r = v.result;
  if (
    request.operation === "finalize"
      ? !(
          "statements" in r &&
          r.period === request.period &&
          r.mode === "realized"
        )
      : request.operation === "correction"
        ? !(
            "delta" in r &&
            r.sourceStatementId === request.statementId &&
            r.targetPeriod === request.targetPeriod
          )
        : !("count" in r)
  )
    throw new ApiRequestError(
      "INVALID_RESPONSE",
      "Pratinjau tidak sesuai tindakan yang dipilih. Muat ulang honorarium.",
    );
  return v;
}
export function verifyFinanceCommit(
  raw: unknown,
  request: z.infer<typeof previewSchema>,
) {
  if (request.operation === "finalize") {
    const v = readFinanceResponse(
      z.object({
        period,
        state: z.literal("final"),
        beneficiaries: z.number().int().nonnegative(),
      }),
      raw,
    );
    if (v.period !== request.period)
      throw new ApiRequestError(
        "INVALID_RESPONSE",
        "Periode final tidak sesuai. Periksa riwayat sebelum mengirim ulang.",
      );
    return;
  }
  if (request.operation === "correction") {
    const v = readFinanceResponse(
      correctionResultSchema.extend({ id: uuid }),
      raw,
    );
    if (
      v.sourceStatementId !== request.statementId ||
      v.targetPeriod !== request.targetPeriod
    )
      throw new ApiRequestError(
        "INVALID_RESPONSE",
        "Hasil koreksi tidak sesuai slip sumber. Muat ulang honorarium.",
      );
    return;
  }
  const v = readFinanceResponse(holidayCommandResultSchema, raw);
  if (request.operation === "holiday-waive" && v.operation !== "waive")
    throw new ApiRequestError(
      "INVALID_RESPONSE",
      "Hasil pengecualian tidak sesuai tindakan. Muat ulang honorarium.",
    );
  if (request.operation === "holiday-cancel" && v.runId !== request.runId)
    throw new ApiRequestError(
      "INVALID_RESPONSE",
      "Hasil pembatalan tidak sesuai penerbitan. Muat ulang honorarium.",
    );
}
/** Format decimal text directly: do not convert money to binary floating point. */
export function formatHonorAmount(value: string) {
  if (!/^-?\d+(\.\d+)?$/.test(value)) return value;
  const [whole, fraction] = value.split(".");
  return (
    "Rp " +
    whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ".") +
    (fraction ? "," + fraction : "")
  );
}
