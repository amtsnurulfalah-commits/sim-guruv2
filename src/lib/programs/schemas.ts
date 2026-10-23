import type { DutyOccurrence } from "../duties/schemas";
import { z } from "zod";
import { date } from "../masters/schemas";
import { wibDate } from "../calendar/schemas";
import { operationSchema } from "../duties/schemas";
export { operationSchema };
const uuid = z.uuid(),
  version = z.string().regex(/^(0|[1-9]\d{0,14})$/),
  reason = z.string().trim().min(5).max(500),
  name = z.string().trim().min(1).max(120),
  time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  jtm = z
    .string()
    .regex(/^(0|[1-9]\d{0,3})(\.\d{1,4})?$/)
    .refine((v) => Number(v) > 0),
  base = { id: uuid.optional(), version, reason };
export const examSaveSchema = z.discriminatedUnion("entity", [
  z
    .object({
      ...base,
      entity: z.literal("period"),
      data: z
        .object({
          academicPeriodId: uuid,
          name,
          dateStart: date,
          dateEnd: date,
          committeeJtm: jtm,
        })
        .strict()
        .refine((v) => v.dateStart <= v.dateEnd, {
          path: ["dateEnd"],
          message: "Tanggal akhir harus sama atau setelah tanggal mulai.",
        }),
    })
    .strict(),
  z
    .object({
      ...base,
      entity: z.literal("session"),
      data: z
        .object({
          periodId: uuid,
          date,
          name,
          timeStart: time,
          timeEnd: time,
          jtm,
        })
        .strict()
        .refine((v) => v.timeStart < v.timeEnd, {
          path: ["timeEnd"],
          message: "Jam selesai harus setelah jam mulai.",
        }),
    })
    .strict(),
  z
    .object({
      ...base,
      entity: z.literal("room"),
      data: z
        .object({
          sessionId: uuid,
          name,
          subjectId: uuid,
          totalStudents: z.number().int().min(0).max(1000),
          classIds: z
            .array(uuid)
            .max(100)
            .refine((v) => new Set(v).size === v.length),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...base,
      entity: z.literal("supervisor"),
      data: z
        .object({ roomId: uuid, userId: uuid, overrideJtm: jtm.nullable() })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...base,
      entity: z.literal("committee"),
      data: z
        .object({
          periodId: uuid,
          date,
          userId: uuid,
          jtm: jtm.nullable(),
          exclusiveStart: time.nullable(),
          exclusiveEnd: time.nullable(),
        })
        .strict()
        .refine(
          (v) =>
            v.exclusiveStart === null
              ? v.exclusiveEnd === null
              : v.exclusiveEnd !== null && v.exclusiveStart < v.exclusiveEnd,
          {
            path: ["exclusiveEnd"],
            message:
              "Isi kedua jam eksklusif; jam akhir harus setelah jam awal.",
          },
        ),
    })
    .strict(),
]);
export const readSchema = z
  .object({
    domain: z.enum(["exams", "events"]),
    date: date.default(() => wibDate()),
    periodId: uuid.optional(),
    from: date.optional(),
    to: date.optional(),
  })
  .strict()
  .refine(
    (v) =>
      (!v.from && !v.to) ||
      (!!v.from &&
        !!v.to &&
        v.from <= v.to &&
        (Date.parse(v.to) - Date.parse(v.from)) / 86400000 <= 365),
  );
export const bapSchema = z
  .object({
    occurrenceId: uuid,
    operation: z.enum(["create", "edit"]),
    version,
    present: z.number().int().min(0).max(1000),
    absent: z.number().int().min(0).max(1000),
    notes: z.string().max(1000),
  })
  .strict();
export const deleteSchema = z.union([
  z
    .object({
      entity: z.enum([
        "period",
        "session",
        "room",
        "supervisor",
        "committee",
        "event",
      ]),
      id: uuid,
      reason,
    })
    .strict(),
  z.object({ previewId: uuid, confirmed: z.literal(true) }).strict(),
]);
export const commitSchema = z.object({ previewId: uuid }).strict();
export const eventSaveSchema = z
  .object({
    ...base,
    data: z
      .object({
        name,
        type: z.enum(["rutin", "insidental"]),
        days: z.array(z.number().int().min(0).max(6)).max(7),
        dates: z.array(date).max(366),
        timeStart: time,
        timeEnd: time,
        jtm: z.number().int().min(1).max(99),
        description: z.string().max(1000),
        dateStart: date,
        dateEnd: date,
      })
      .strict()
      .superRefine((v, ctx) => {
        const issue = (key: string, message: string) =>
          ctx.addIssue({ code: "custom", path: [key], message });
        if (v.timeStart >= v.timeEnd)
          issue("timeEnd", "Jam selesai harus setelah jam mulai.");
        if (v.dateStart > v.dateEnd)
          issue(
            "dateEnd",
            "Tanggal akhir harus sama atau setelah tanggal mulai.",
          );
        if ((Date.parse(v.dateEnd) - Date.parse(v.dateStart)) / 86400000 > 365)
          issue("dateEnd", "Rentang acara maksimal 365 hari.");
        if (v.type === "rutin" && (!v.days.length || v.dates.length))
          issue(
            "days",
            "Pilih minimal satu hari rutin dan kosongkan tanggal insidental.",
          );
        if (v.type === "insidental" && (!v.dates.length || v.days.length))
          issue("dates", "Isi tanggal insidental dan kosongkan hari rutin.");
        if (new Set(v.days).size !== v.days.length)
          issue("days", "Hari rutin tidak boleh berulang.");
        if (new Set(v.dates).size !== v.dates.length)
          issue("dates", "Tanggal insidental tidak boleh berulang.");
        if (v.dates.some((d) => d < v.dateStart || d > v.dateEnd))
          issue(
            "dates",
            "Tanggal insidental harus berada dalam rentang berlaku acara.",
          );
      }),
  })
  .strict();
export const eventAttendanceSchema = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("attend"),
      eventId: uuid,
      date,
      userId: uuid,
      timeIn: time,
      reason,
    })
    .strict(),
  z
    .object({
      operation: z.literal("cancel"),
      attendanceId: uuid,
      version,
      reason,
    })
    .strict(),
]);
export const eventJournalSchema = z
  .object({
    attendanceId: uuid,
    version,
    description: z.string().trim().min(1).max(1000),
  })
  .strict();
export const eventBlockSchema = z
  .object({
    ...base,
    eventId: uuid.nullable(),
    eventType: z.enum(["rutin", "insidental"]).nullable().default(null),
    dateStart: date,
    dateEnd: date,
    message: z
      .string()
      .trim()
      .min(5, "Pesan blok minimal 5 karakter.")
      .max(500, "Pesan blok maksimal 500 karakter."),
    active: z.boolean(),
  })
  .strict()
  .refine((v) => v.dateStart <= v.dateEnd, {
    path: ["dateEnd"],
    message: "Tanggal akhir harus sama atau setelah tanggal mulai.",
  });
export type Choice = { id: string; name: string };
export type ExamPeriod = {
  id: string;
  academic_period_id: string;
  name: string;
  date_start: string;
  date_end: string;
  default_committee_jtm: string;
  version: string;
};
export type ExamSession = {
  id: string;
  period_id: string;
  date: string;
  name: string;
  time_start: string;
  time_end: string;
  scheduled_jtm: string;
  version: string;
};
export type ExamRoom = {
  id: string;
  session_id: string;
  name: string;
  subject_id: string;
  total_students: number;
  classIds: string[];
  version: string;
};
export type Bap = {
  id: string;
  occurrence_id: string;
  present: number;
  absent: number;
  notes: string;
  version: string;
  state: string;
  teacherName?: string | undefined;
  date?: string | undefined;
};
export type ExamOccurrence = Omit<DutyOccurrence, "kind"> & {
  kind: "EXAM_SUPERVISOR" | "EXAM_COMMITTEE";
  sourceId: string;
  roomId: string | null;
  overrideJtm: string | null;
  sourceVersion: string;
  periodId: string;
  sessionName: string;
  periodName: string;
  expectedStudents: number;
  bap: Bap | null;
  lockedBaps: number;
  netJtm: string;
};
export type ExamBoard = {
  date: string;
  admin: boolean;
  canOperate: boolean;
  required: (Choice & { complete: boolean })[];
  periods: ExamPeriod[];
  sessions: ExamSession[];
  rooms: ExamRoom[];
  occurrences: ExamOccurrence[];
  baps: Bap[];
  recaps: { teacherName: string; sourceKind: string; jtm: string }[];
  teachers: Choice[];
  academicPeriods: Choice[];
  classes: (Choice & { periodId: string })[];
  subjects: Choice[];
};
export type EventDefinition = {
  id: string;
  name: string;
  type: "rutin" | "insidental";
  days: number[];
  dates: string[];
  time_start: string;
  time_end: string;
  jtm: number;
  description: string;
  date_start: string;
  date_end: string;
  version: string;
};
export type EventAttendance = {
  id: string;
  event_id: string;
  date: string;
  user_id: string;
  time_in: string;
  version: string;
  teacherName: string;
  eventName: string;
  journal: string | null;
  creditedJtm: string;
  cancelled_at: string | null;
};
export type EventBoard = {
  date: string;
  canOperate: boolean;
  events: EventDefinition[];
  today: EventDefinition[];
  attendance: EventAttendance[];
  teachers: Choice[];
  blocks: {
    id: string;
    event_id: string | null;
    event_type: "rutin" | "insidental" | null;
    date_start: string;
    date_end: string;
    message: string;
    active: boolean;
    version: string;
  }[];
};
export type Impact = {
  previewId: string;
  expiresAt: string;
  assignments?: number;
  baps?: number;
  sessions?: number;
  rooms?: number;
  attendance?: number;
  journals?: number;
  netJtm?: string;
  activeNetJtm?: string;
  activeBaps?: number;
  operation?: string;
};
