import { z } from "zod";
import { period } from "./schemas";
const id = z.uuid();
const money = z.string().regex(/^-?\d+$/);
export const readinessSchema = z.object({
  period,
  mode: z.enum(["realized", "final"]),
  scope: z.enum(["own", "period"]),
  issues: z.array(z.string()),
  note: z.string(),
  recipients: z.array(
    z.object({
      userId: id,
      name: z.string(),
      total: money,
      issues: z.array(z.string()),
      administrative: z.array(
        z.object({
          kind: z.enum([
            "confirmation",
            "journal",
            "bap",
            "event",
            "attendance",
          ]),
          date: z.iso.date(),
          source_id: id,
          title: z.string(),
          href: z
            .string()
            .regex(
              /^\/(jurnal|kegiatan|piket|ujian(?:\/bap)?|acara\/jurnal|kehadiran-saya|admin\/kehadiran-harian)\?date=\d{4}-\d{2}-\d{2}$/,
            ),
        }),
      ),
    }),
  ),
});
export const requestsSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.literal(20),
  total: z.number().int().nonnegative(),
  items: z.array(
    z.object({
      id,
      statement_id: id,
      trx_id: z.string(),
      recipient: z.string(),
      requested_by: id,
      reason: z.string(),
      evidence: z.string(),
      status: z.enum(["submitted", "reviewing", "approved", "rejected"]),
      version: z.string().regex(/^[1-9][0-9]*$/),
      reviewer_id: id.nullable(),
      reviewer: z.string().nullable(),
      decision_reason: z.string().nullable(),
      decided_at: z.string().nullable(),
      correction_id: id.nullable(),
      created_at: z.string(),
      can_review: z.boolean(),
      history: z.array(
        z.object({
          action: z.enum(["submitted", "claim", "approved", "rejected"]),
          reason: z.string(),
          actor: z.string(),
          at: z.string(),
        }),
      ),
    }),
  ),
});
export type CorrectionRequest = z.infer<typeof requestsSchema>["items"][number];
export const correctionStatus = {
  submitted: "Diajukan",
  reviewing: "Diperiksa",
  approved: "Disetujui",
  rejected: "Ditolak",
};
