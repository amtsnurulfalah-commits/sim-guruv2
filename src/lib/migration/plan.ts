import { z } from "zod";
import { checksum } from "./profile";
export const targets = [
  "app.app_users",
  "app.school_profiles",
  "app.academic_years",
  "app.academic_periods",
  "app.subjects",
  "app.classes",
  "app.rate_versions",
  "app.allowances",
  "app.academic_calendar",
  "app.day_context_overrides",
  "app.teaching_schedules",
  "app.duty_schedules",
  "app.exam_periods",
  "app.exam_sessions",
  "app.exam_rooms",
  "app.exam_room_classes",
  "app.exam_supervisor_assignments",
  "app.exam_committee_assignments",
  "app.event_definitions",
  "app.event_attendance",
  "app.activity_occurrences",
  "app.activity_assignments",
  "app.activity_confirmations",
  "app.substitutions",
  "app.attendance_schedule_templates",
  "app.daily_attendance",
  "app.attendance_leaves",
  "app.student_attendance",
  "app.teaching_journals",
  "app.exam_baps",
  "app.event_journals",
  "app.journal_blocks",
  "app.event_journal_blocks",
  "finance.jtm_adjustments",
  "finance.jtm_allocations",
  "finance.holiday_entitlements",
  "finance.jtm_ledger",
  "finance.transport_blocks",
  "finance.honor_periods",
  "finance.honor_statements",
  "finance.honor_statement_lines",
] as const;
function containsCredential(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(
    ([key, child]) =>
      (key !== "must_change_password" &&
        /password|secret|token|answer|credential/i.test(key)) ||
      containsCredential(child),
  );
}
export const planSchema = z
  .object({
    version: z.literal(1),
    batchId: z.uuid(),
    sourceChecksum: z.string().regex(/^[a-f0-9]{64}$/),
    reason: z.string().trim().min(10).max(500),
    entries: z
      .array(
        z
          .object({
            sourceTable: z.string().min(1).max(100),
            legacyId: z.string().min(1).max(200),
            targetTable: z.enum(targets),
            values: z.record(
              z.string().regex(/^[a-z][a-z0-9_]*$/),
              z.unknown(),
            ),
          })
          .strict(),
      )
      .min(1)
      .max(10000),
  })
  .strict()
  .superRefine((p, ctx) => {
    const seen = new Set<string>();
    for (const [i, e] of p.entries.entries()) {
      const key = e.sourceTable + "\0" + e.legacyId + "\0" + e.targetTable;
      if (seen.has(key))
        ctx.addIssue({
          code: "custom",
          path: ["entries", i],
          message: "DUPLICATE_PLAN_SOURCE",
        });
      seen.add(key);
      if (
        e.targetTable === "app.app_users" &&
        (e.values.status !== "pending_activation" ||
          e.values.must_change_password !== true ||
          ["auth_version", "email_verified_at"].some((k) => k in e.values))
      )
        ctx.addIssue({
          code: "custom",
          path: ["entries", i],
          message: "IMPORTED_ACCOUNT_MUST_ACTIVATE",
        });
      if (
        e.targetTable === "finance.honor_periods" &&
        (e.values.formula_version !== "legacy" ||
          e.values.state !== "final" ||
          !e.values.finalized_at)
      )
        ctx.addIssue({
          code: "custom",
          path: ["entries", i],
          message: "LEGACY_FORMULA_REQUIRED",
        });
      if (
        e.targetTable === "finance.honor_statements" &&
        (!(e.values.snapshot && typeof e.values.snapshot === "object") ||
          (e.values.snapshot as Record<string, unknown>).formulaVersion !==
            "legacy")
      )
        ctx.addIssue({
          code: "custom",
          path: ["entries", i],
          message: "LEGACY_SNAPSHOT_REQUIRED",
        });
      if (containsCredential(e.values))
        ctx.addIssue({
          code: "custom",
          path: ["entries", i],
          message: "AUTH_FIELD_EXCLUDED",
        });
    }
  });
export type ImportPlan = z.infer<typeof planSchema>;
export const planHash = (p: ImportPlan) => checksum(p);
export type ReconciliationCell = {
  key: string;
  source: string;
  target: string;
  explanation?: string;
};
export function reconcile(cells: ReconciliationCell[]) {
  // Decimal values remain strings; classification is separate from approval.
  return cells.map(
    (c) =>
      ({
        ...c,
        state:
          c.source === c.target
            ? "matched"
            : c.explanation?.trim()
              ? "explained"
              : "unresolved",
      }) as const,
  );
}
