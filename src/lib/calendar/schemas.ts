import { z } from "zod";
import { date } from "../masters/schemas";
export const calendarPolicy = "calendar-v1";
const reason = z.string().trim().min(5).max(500),
  version = z.string().regex(/^\d{1,18}$/),
  description = z.string().trim().min(1).max(500);
export const entrySchema = z
  .object({
    action: z.literal("upsert"),
    date,
    version,
    description,
    isHoliday: z.boolean(),
    reason,
  })
  .strict();
export const removeSchema = z
  .object({ action: z.literal("delete"), date, version, reason })
  .strict();
export const rangeSchema = z
  .object({
    action: z.literal("range"),
    dateStart: date,
    dateEnd: date,
    description,
    isHoliday: z.boolean(),
    reason,
  })
  .strict()
  .refine((v) => {
    const days =
      (Date.parse(v.dateEnd + "T00:00:00Z") -
        Date.parse(v.dateStart + "T00:00:00Z")) /
      86400000;
    return days >= 0 && days <= 365;
  }, { path: ["dateEnd"], message: "Tanggal akhir harus setelah atau sama dengan tanggal mulai, maksimal 366 hari." });
export const calendarChangeSchema = z.discriminatedUnion("action", [
  entrySchema,
  removeSchema,
  rangeSchema,
]);
export const contextChangeSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("override"),
      date,
      version,
      academicPeriodId: z.uuid(),
      kbmEnabled: z.boolean(),
      examEnabled: z.boolean(),
      reason,
    })
    .strict(),
  z.object({ action: z.literal("clear"), date, version, reason }).strict(),
]);
export const commitSchema = z.object({ previewId: z.uuid() }).strict();
export const dayQuerySchema = z.object({ date }).strict();
export const calendarFilters = z
  .object({
    dateStart: date,
    dateEnd: date,
    q: z.string().trim().max(100).default(""),
    holiday: z.enum(["", "true", "false"]).default(""),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict()
  .refine(
    (v) =>
      (Date.parse(v.dateEnd) - Date.parse(v.dateStart)) / 86400000 >= 0 &&
      (Date.parse(v.dateEnd) - Date.parse(v.dateStart)) / 86400000 <= 365,
  );
export type CalendarRow = {
  id: string;
  date: string;
  description: string;
  isHoliday: boolean;
  version: string;
  deletedAt: string | null;
};
export type CalendarList = {
  items: CalendarRow[];
  total: number;
  page: number;
  pageSize: number;
};
export type DayContext = {
  date: string;
  dayIndex: number;
  isHoliday: boolean;
  calendarEntry: (Omit<CalendarRow, "id"> & { id: string | null }) | null;
  kbmEnabled: boolean;
  examEnabled: boolean;
  activeExamPeriods: unknown[];
  activeExamPeriodIds: string[];
  activeAcademicPeriod: {
    id: string;
    label: string;
    semester: number;
    dateStart: string;
    dateEnd: string;
  } | null;
  academicPeriodId: string | null;
  contextVersion: string;
  override: {
    id: string | null;
    version: string;
    academicPeriodId: string;
    kbmEnabled: boolean;
    examEnabled: boolean;
  } | null;
  calendarVersion: string;
  overrideVersion: string;
  reasons: string[];
  policyVersion: string;
  assignmentIntegration:
    | "not_installed"
    | "teaching_ready"
    | "attendance_ready"
    | "exams_ready";
};
export type ChangePreview = {
  previewId: string;
  expiresAt: string;
  kind: "calendar" | "context";
  action: string;
  count: number;
  policyVersion: string;
  assignmentIntegration:
    | "not_installed"
    | "teaching_ready"
    | "attendance_ready"
    | "exams_ready";
  days: { date: string; before: DayContext; after: DayContext }[];
};
export function wibDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
