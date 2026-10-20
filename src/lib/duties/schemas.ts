import { z } from "zod";
import { date } from "../masters/schemas";
import { wibDate } from "../calendar/schemas";
const uuid = z.uuid(),
  version = z.string().regex(/^(0|[1-9]\d{0,14})$/),
  reason = z.string().trim().min(1).max(500);
const base = { occurrenceId: uuid, version, reason };
export const operationSchema = z.discriminatedUnion("operation", [
  z.object({ ...base, operation: z.literal("confirm") }).strict(),
  z.object({ ...base, operation: z.literal("revoke") }).strict(),
  z
    .object({ ...base, operation: z.literal("substitute"), userId: uuid })
    .strict(),
  z.object({ ...base, operation: z.literal("replace"), userId: uuid }).strict(),
  z.object({ ...base, operation: z.literal("cancel-substitute") }).strict(),
  z
    .object({
      ...base,
      operation: z.literal("adjust"),
      adjustedJtm: z.string().regex(/^(0|[1-9]\d{0,7})$/),
    })
    .strict(),
  z
    .object({
      ...base,
      operation: z.literal("allocate"),
      userId: uuid,
      allocatedJtm: z
        .string()
        .regex(/^(0|[1-9]\d{0,7})(\.\d{1,4})?$/)
        .refine((v) => Number(v) > 0),
    })
    .strict(),
  z
    .object({
      ...base,
      operation: z.literal("remove-allocation"),
      allocationId: uuid,
    })
    .strict(),
  z.object({ ...base, operation: z.literal("reset") }).strict(),
]);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const dutyScheduleSchema = z
  .object({
    id: uuid.optional(),
    version,
    reason: z.string().trim().min(5).max(500),
    kind: z.enum(["PIKET", "UPACARA"]),
    userId: uuid,
    academicPeriodId: uuid,
    dayIndex: z.number().int().min(0).max(6),
    date: date.nullable(),
    validFrom: date,
    validTo: date,
    timeStart: time,
    timeEnd: time,
    active: z.boolean(),
  })
  .strict()
  .refine(
    (v) =>
      v.timeStart < v.timeEnd &&
      v.validFrom <= v.validTo &&
      (Date.parse(v.validTo) - Date.parse(v.validFrom)) / 86400000 <= 365 &&
      (v.kind === "PIKET"
        ? v.date === null
        : v.dayIndex === 1 &&
          v.date !== null &&
          v.validFrom === v.date &&
          v.validTo === v.date &&
          new Date(v.date + "T00:00:00Z").getUTCDay() === 1),
  );
export const querySchema = z
  .object({ date: date.default(() => wibDate()) })
  .strict();
export const commitSchema = z.object({ previewId: uuid }).strict();
export type DutyOccurrence = {
  id: string;
  kind: "KBM" | "PIKET" | "UPACARA";
  date: string;
  userId: string;
  originalUserId: string;
  teacherName: string;
  originalTeacherName: string;
  className: string | null;
  subjectName: string | null;
  timeStart: string;
  timeEnd: string;
  scheduledJtm: string;
  adjustedJtm: string;
  remainingJtm: string;
  adjustmentReason: string | null;
  confirmed: boolean;
  version: string;
  substitutionId: string | null;
  journalId: string | null;
  allocations: {
    id: string;
    userId: string;
    teacherName: string;
    jtm: string;
    reason: string;
  }[];
};
export type DutySchedule = {
  id: string;
  kind: "PIKET" | "UPACARA";
  user_id: string;
  academic_period_id: string;
  day_index: number;
  date: string | null;
  valid_from: string;
  valid_to: string;
  time_start: string;
  time_end: string;
  active: boolean;
  version: string;
  teacherName: string;
};
export type DutyBoard = {
  date: string;
  canOperate: boolean;
  admin: boolean;
  occurrences: DutyOccurrence[];
  schedules: DutySchedule[];
  teachers: { id: string; name: string }[];
  periods: { id: string; name: string; dateStart: string; dateEnd: string }[];
};
export type DutyPreview = {
  previewId: string;
  expiresAt: string;
  operation: string;
  current: DutyOccurrence;
  request: Record<string, string>;
  activeJournals: number;
  activeNetJtm: string;
  authorizesMutation: false;
};
