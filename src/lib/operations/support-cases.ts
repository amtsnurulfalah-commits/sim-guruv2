import { z } from "zod";
export const caseStatuses = {
  new: "Baru",
  reviewed: "Ditinjau",
  processing: "Diproses",
  waiting: "Menunggu informasi",
  resolved: "Selesai",
};
const id = z.uuid(),
  version = z.string().regex(/^[1-9][0-9]*$/);
const secret =
  /(password|kata sandi|otp|token|secret|api_key)\s*[:=]|Bearer\s+[a-z0-9._-]+|postgres(?:ql)?:\/\/|-----BEGIN .*PRIVATE KEY|https?:\/\/[^/\s]*@/i;
const text = (max: number) =>
  z
    .string()
    .trim()
    .min(5)
    .max(max)
    .refine(
      (v) => !secret.test(v),
      "Hapus kredensial, OTP, token, atau koneksi rahasia dari catatan.",
    );
const base = { operationKey: id, reason: text(2000) };
export const caseCommand = z.discriminatedUnion("operation", [
  z
    .object({
      ...base,
      operation: z.literal("create"),
      reference: id,
      title: text(160),
      summary: text(1000),
      reporterId: id.nullable().default(null),
      reporterVerified: z.boolean().default(false),
    })
    .strict()
    .refine((v) => !v.reporterVerified || v.reporterId !== null, {
      path: ["reporterId"],
      message: "Pilih pelapor yang identitasnya sudah diverifikasi.",
    }),
  z
    .object({
      ...base,
      operation: z.literal("update"),
      id,
      version,
      status: z.enum(["new", "reviewed", "processing", "waiting", "resolved"]),
      ownerId: id.nullable(),
      resolution: z.string().trim().max(1000).default(""),
      verification: z.string().trim().max(1000).default(""),
    })
    .strict()
    .superRefine((v, c) => {
      if (v.status !== "new" && !v.ownerId)
        c.addIssue({
          code: "custom",
          path: ["ownerId"],
          message: "Tetapkan penanggung jawab admin aktif.",
        });
      if (v.status === "resolved")
        for (const field of ["resolution", "verification"] as const)
          if (!text(1000).safeParse(v[field]).success)
            c.addIssue({
              code: "custom",
              path: [field],
              message:
                "Isi hasil perbaikan/verifikasi 5–1000 karakter tanpa rahasia.",
            });
    }),
  z
    .object({
      ...base,
      operation: z.literal("context"),
      id,
      version,
      reporterId: id.nullable(),
      reporterVerified: z.boolean(),
    })
    .strict()
    .refine((v) => !v.reporterVerified || v.reporterId !== null, {
      path: ["reporterId"],
      message: "Pilih pelapor yang sudah diverifikasi.",
    }),
  z
    .object({
      ...base,
      operation: z.literal("link"),
      id,
      version,
      reference: id,
    })
    .strict(),
  z.object({ ...base, operation: z.literal("note"), id, version }).strict(),
  z.object({ ...base, operation: z.literal("purge") }).strict(),
]);
export const caseQuery = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("list").default("list"),
      page: z.coerce.number().int().min(1).max(100000).default(1),
      q: z.string().trim().max(100).default(""),
      status: z
        .enum(["", "new", "reviewed", "processing", "waiting", "resolved"])
        .default(""),
    })
    .strict(),
  z.object({ kind: z.literal("detail"), id }).strict(),
]);
const status = z.enum(["new", "reviewed", "processing", "waiting", "resolved"]);
const choice = z.object({ id, name: z.string() });
export const caseListSchema = z.object({
  items: z.array(
    z.object({
      id,
      title: z.string(),
      status,
      version,
      module: z.string(),
      code: z.string(),
      updated_at: z.iso.datetime({ offset: true }),
      owner: z.string().nullable(),
      reference_count: z.number().int().nonnegative(),
    }),
  ),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.literal(20),
  owners: z.array(choice),
  reporters: z.array(choice),
});
export const caseDetailSchema = z.object({
  id,
  title: z.string(),
  summary: z.string(),
  reporter_id: id.nullable(),
  reporter_verified: z.boolean(),
  reporter: z.string().nullable(),
  owner_id: id.nullable(),
  owner: z.string().nullable(),
  status,
  version,
  module: z.string(),
  code: z.string(),
  resolution: z.string().nullable(),
  verification: z.string().nullable(),
  closed_at: z.iso.datetime({ offset: true }).nullable(),
  references: z.array(
    z.object({
      request_id: id,
      occurred_at: z.iso.datetime({ offset: true }),
      module: z.string(),
      code: z.string(),
      status: z.number().int().min(400).max(599),
    }),
  ),
  history: z.array(
    z.object({
      id,
      actor: z.string(),
      action: z.string(),
      note: z.string(),
      changes: z.object({
        before: z
          .object({
            owner: z.string().nullable(),
            reporter: z.string().nullable(),
            verified: z.boolean(),
            resolution: z.string().nullable(),
            verification: z.string().nullable(),
          })
          .nullable(),
        after: z.object({
          owner: z.string().nullable(),
          reporter: z.string().nullable(),
          verified: z.boolean(),
          resolution: z.string().nullable(),
          verification: z.string().nullable(),
        }),
      }),
      from: status.nullable(),
      to: status.nullable(),
      at: z.iso.datetime({ offset: true }),
    }),
  ),
});
export const caseResultSchema = z.union([
  z.object({ id, version }),
  z.object({
    events: z.number().int().nonnegative(),
    cases: z.number().int().nonnegative(),
    metrics: z.number().int().nonnegative(),
  }),
]);
export const monitorSchema = z.object({
  reliability: z.object({
    lastSuccessfulJobAt: z.iso.datetime({offset:true}).nullable(),
    lastAcceptedAt: z.iso.datetime({offset:true}).nullable(),
    accepted24h: z.number().int().nonnegative(), failed24h: z.number().int().nonnegative(), uncertain24h: z.number().int().nonnegative(),
    knownFailurePercent: z.number().min(0).max(100).nullable(),
    activeReadyQueue: z.number().int().nonnegative(), activeOldestQueueSeconds: z.number().int().nonnegative(),
  }).nullable().optional().default(null),
  generatedAt: z.iso.datetime({ offset: true }),
  lastWorkerAt: z.iso.datetime({ offset: true }).nullable(),
  workerEnabled: z.boolean(),
  failedJobs: z.number(),
  failedMessages: z.number(),
  readyQueue: z.number(),
  oldestQueueSeconds: z.number(),
  samples: z.number(),
  averageMs: z.number(),
  maxMs: z.number(),
  alerts: z.array(
    z.object({
      code: z.string(),
      message: z.string(),
      href: z.enum(["/admin/operasional", "/admin/laporan-kendala"]),
    }),
  ),
  groups: z.array(
    z.object({
      module: z.string(),
      code: z.string(),
      count: z.number().int().nonnegative(),
    }),
  ),
  modules: z.array(
    z.object({
      module: z.string(),
      samples: z.number(),
      average_ms: z.number(),
      max_ms: z.number(),
    }),
  ),
});
export type SupportCase = z.infer<typeof caseDetailSchema>;
