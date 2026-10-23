import { z } from "zod";
export const period = z.string().regex(/^(20\d{2}|21\d{2})-(0[1-9]|1[0-2])$/);
const id = z.uuid();
const reason = z.string().trim().min(5).max(500);
const date = z.iso.date();
const amount = z.string().regex(/^(0|[1-9][0-9]{0,14})$/);
export const readSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.enum(["estimate", "recap"]),
      period,
      mode: z.enum(["realized", "projection"]).default("realized"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("history"),
      period: period.optional(),
      q: z.string().trim().max(100).default(""),
      page: z.coerce.number().int().min(1).max(100000).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
    })
    .strict(),
  z.object({ kind: z.literal("statement"), id }).strict(),
  z.object({ kind: z.literal("operations"), period }).strict(),
]);
export const previewSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("holiday-waive"), date, reason }).strict(),
  z.object({ operation: z.literal("finalize"), period, reason }).strict(),
  z
    .object({ operation: z.literal("holiday-cancel"), date, runId: id, reason })
    .strict(),
  z
    .object({
      operation: z.literal("correction"),
      statementId: id,
      targetPeriod: period,
      correctedJtm: z.string().regex(/^(0|[1-9][0-9]{0,7})(\.[0-9]{1,4})?$/),
      correctedAllowances: amount,
      correctedTransportRaw: z
        .string()
        .regex(/^(0|[1-9][0-9]{0,14})(\.[0-9]{1,100})?$/),
      reason,
      evidence: z.string().trim().min(5).max(1000),
    })
    .strict(),
]);
export const commandSchemas = {
  preview: previewSchema,
  commit: z.object({ previewId: id }).strict(),
  holiday: z.discriminatedUnion("operation", [
    z.object({ operation: z.literal("generate"), date, reason }).strict(),
  ]),
  block: z.union([
    z
      .object({ userId: id.nullable(), from: date, to: date, reason })
      .strict()
      .superRefine((v, ctx) => {
        if (v.to < v.from)
          ctx.addIssue({
            code: "custom",
            path: ["to"],
            message: "Tanggal akhir harus sama atau setelah tanggal mulai.",
          });
        if ((Date.parse(v.to) - Date.parse(v.from)) / 86400000 > 365)
          ctx.addIssue({
            code: "custom",
            path: ["to"],
            message: "Rentang blok transportasi maksimal 365 hari.",
          });
      }),
    z
      .object({ id, version: z.string().regex(/^[1-9][0-9]*$/), reason })
      .strict(),
  ]),
  request: z.object({ statementId: id, reason }).strict(),
  token: z.object({ statementId: id }).strict(),
};
export type FinanceAction = keyof typeof commandSchemas;
export const verifySchema = z
  .object({ token: z.string().regex(/^[a-f0-9]{96}$/) })
  .strict();
export type SourceLine = {
  component: string;
  sourceRef?: string | null | undefined;
  ledgerId?: string | null | undefined;
  date?: string | null | undefined;
  jtm?: string | null | undefined;
  amount?: string | null | undefined;
  raw?: string | null | undefined;
  delta?: string | null | undefined;
  name?: string | null | undefined;
  [key: string]: unknown;
};
export type HonorSnapshot = {
  schemaVersion: number;
  formulaVersion: string;
  policyVersion: string;
  period: string;
  mode: string;
  cutoff: string;
  recipient: {
    id: string;
    name: string;
    nip: string | null;
    username: string;
    distance: string;
  };
  school: {
    name: string;
    address: string;
    npsn: string;
    headmaster: string;
    headmasterNip: string | null;
  } | null;
  rate: string;
  totalJtm: string;
  teachingRaw: string;
  teachingSettled: string;
  allowances: string;
  transportRaw: string;
  transportSettled: string;
  corrections: string;
  total: string;
  lines: SourceLine[];
  pendingHolidays: SourceLine[];
  statementId?: string | undefined;
  trxId?: string | undefined;
  finalizedAt?: string | undefined;
};
export type HonorBundle = {
  period: string;
  mode: string;
  issues: string[];
  statements: HonorSnapshot[];
  beneficiaries?: number | undefined;
};
export type HonorStatement = {
  id: string;
  trxId: string;
  checksum: string;
  snapshot: HonorSnapshot;
  corrected: boolean;
};
export type HonorHistory = {
  items: {
    id: string;
    trx_id: string;
    name: string;
    jtm: string;
    total: string;
    period: string;
  }[];
  total: number;
  page: number;
  pageSize: number;
};
export type FinancePreview = {
  previewId: string;
  expiresAt: string;
  result:
    | HonorBundle
    | {
        baseline: string;
        correctedTotal: string;
        delta: string;
        sequence: number;
      }
    | { count: number; jtm: string; operation?: string };
};
export type Operations = {
  holidays: {
    sourceKey: string;
    kind: string;
    date: string;
    userId: string;
    name: string;
    jtm: string;
    state: string;
  }[];
  runs: { id: string; date: string; generation: number; state: string }[];
  blocks: {
    id: string;
    user_id: string | null;
    date_start: string;
    date_end: string;
    reason: string;
    active: boolean;
    version: number;
  }[];
  requests: { id: string; statement_id: string; reason: string }[];
  notificationQueue: string;
};
export const issueLabels: Record<string, string> = {
  PERIOD_NOT_ENDED: "Periode belum berakhir.",
  RATE_MISSING: "Tarif per JTM pada akhir bulan belum tersedia.",
  SCHOOL_SIGNATORY_MISSING:
    "Identitas sekolah atau kepala madrasah belum lengkap.",
  HOLIDAY_PENDING: "Hak libur perlu diposting atau dikecualikan dengan alasan.",
  HOLIDAY_INCONSISTENT:
    "Posting libur tidak cocok dengan sumber jadwal/kalender.",
  LEDGER_INCONSISTENT: "Ledger tidak konsisten.",
  NEGATIVE_PAYABLE:
    "Koreksi menghasilkan pembayaran negatif; selesaikan terlebih dahulu.",
};
