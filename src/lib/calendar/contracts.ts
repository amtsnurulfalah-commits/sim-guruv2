import { z } from "zod";
import { date } from "../masters/schemas";
import { ApiRequestError } from "../feedback/api-error";
const version = z.string().regex(/^\d{1,18}$/);
const integration = z.enum(["not_installed", "teaching_ready", "attendance_ready", "exams_ready"]);
const row = z.object({ id: z.uuid(), date, description: z.string(), isHoliday: z.boolean(), version, deletedAt: z.string().nullable() });
export const calendarListSchema = z.object({ items: z.array(row), total: z.number().int().nonnegative(), page: z.number().int().positive(), pageSize: z.number().int().positive() });
export const dayContextSchema = z.object({
  date, dayIndex: z.number().int().min(0).max(6), isHoliday: z.boolean(),
  calendarEntry: row.extend({ id: z.uuid().nullable() }).nullable(),
  kbmEnabled: z.boolean(), examEnabled: z.boolean(), activeExamPeriods: z.array(z.unknown()), activeExamPeriodIds: z.array(z.uuid()),
  activeAcademicPeriod: z.object({ id: z.uuid(), label: z.string(), semester: z.number().int().min(1).max(2), dateStart: date, dateEnd: date }).nullable(),
  academicPeriodId: z.uuid().nullable(), contextVersion: z.string().min(1),
  // Dry-run replacements have no persisted id yet.
  override: z.object({ id: z.uuid().nullable(), version, academicPeriodId: z.uuid(), kbmEnabled: z.boolean(), examEnabled: z.boolean() }).nullable(),
  calendarVersion: version, overrideVersion: version, reasons: z.array(z.string()), policyVersion: z.string(), assignmentIntegration: integration,
});
export const calendarPreviewSchema = z.object({
  previewId: z.uuid(), expiresAt: z.iso.datetime({ offset: true }), kind: z.enum(["calendar", "context"]),
  action: z.enum(["upsert", "delete", "range", "override", "clear"]), count: z.number().int().min(1).max(366),
  policyVersion: z.string(), assignmentIntegration: integration,
  days: z.array(z.object({ date, before: dayContextSchema, after: dayContextSchema })).min(1).max(366),
}).refine(v => v.count === v.days.length && new Set(v.days.map(d => d.date)).size === v.count && v.days.every(d => d.date === d.before.date && d.date === d.after.date));
export const calendarCommitSchema = z.object({ committed: z.literal(true), count: z.number().int().positive(), previewId: z.uuid(), policyVersion: z.string() });
export const calendarHistorySchema = z.array(z.object({ actor_name: z.string().nullable(), reason: z.string(), created_at: z.iso.datetime({ offset: true }), old_data: z.record(z.string(), z.unknown()).nullable(), new_data: z.record(z.string(), z.unknown()).nullable() }));
export const calendarPeriodsSchema = z.object({ items: z.array(z.object({ id: z.uuid(), parentLabel: z.string().nullable().optional(), semester: z.number().int().min(1).max(2), dateStart: date, dateEnd: date })), total: z.number().int().nonnegative(), page: z.number().int().positive(), pageSize: z.number().int().positive() });
export type CalendarHistory = z.infer<typeof calendarHistorySchema>;
export type CalendarPeriods = z.infer<typeof calendarPeriodsSchema>;
export function readCalendarResponse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (!result.success) throw new ApiRequestError("INVALID_RESPONSE", "Format data kalender belum sesuai. Muat ulang atau hubungi administrator.");
  return result.data;
}
