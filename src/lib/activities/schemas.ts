import { z } from "zod";
import { date } from "../masters/schemas";
import { wibDate } from "../calendar/schemas";
const uuid = z.uuid();
const version = z.string().regex(/^(0|[1-9]\d{0,14})$/);
const reason = z.string().trim().min(5).max(500);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const count = z.number().int().min(0).max(1000);
export const dayFilter = z
  .object({ date: date.default(() => wibDate()) })
  .strict();
export const historyFilter = z
  .object({
    from: date,
    to: date,
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    userId: uuid.optional(),
    q: z.string().trim().max(200).optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.from <= v.to &&
      (Date.parse(v.to) - Date.parse(v.from)) / 86400000 <= 365,
  );
const attendanceIdentity = { attendanceId: uuid, version, reason };
const journalFields = {
  material: z.string().trim().min(1).max(2000),
  present: count,
  absent: count,
  notes: z.string().max(2000),
  reason,
};
export const commandSchemas = {
  claim: z.object({ occurrenceId: uuid, version, reason }).strict(),
  confirm: z.object({ occurrenceId: uuid, version, reason }).strict(),
  revoke: z.object({ occurrenceId: uuid, version, reason }).strict(),
  "template-save": z
    .object({
      dayIndex: z.number().int().min(0).max(6),
      type: z.enum(["KBM", "UJIAN"]),
      timeIn: time,
      timeOut: time,
      version,
      reason,
    })
    .strict()
    .refine((v) => v.timeOut > v.timeIn, {
      path: ["timeOut"],
      message: "Jam pulang harus setelah jam masuk.",
    }),
  "template-delete": z
    .object({
      dayIndex: z.number().int().min(0).max(6),
      type: z.enum(["KBM", "UJIAN"]),
      version,
      reason,
    })
    .strict(),
  "template-preview": z.object({ date, templateId: uuid }).strict(),
  "template-apply": z.object({ previewId: uuid, reason }).strict(),
  manual: z
    .object({
      userId: uuid,
      date,
      scheduledIn: time.nullable(),
      scheduledOut: time.nullable(),
      actualIn: time.nullable(),
      actualOut: time.nullable(),
      extra: z.boolean(),
      version,
      reason,
    })
    .strict()
    .refine(
      (v) =>
        ((v.scheduledIn === null && v.scheduledOut === null) ||
          (v.scheduledIn !== null &&
            v.scheduledOut !== null &&
            v.scheduledOut > v.scheduledIn)) &&
        (v.actualOut === null ||
          (v.actualIn !== null && v.actualOut >= v.actualIn)),
    ),
  in: z.object(attendanceIdentity).strict(),
  out: z.object(attendanceIdentity).strict(),
  leave: z
    .object({ ...attendanceIdentity, leaveTime: time, returnTime: time })
    .strict()
    .refine((v) => v.returnTime > v.leaveTime, {
      path: ["returnTime"],
      message: "Jam kembali harus setelah jam keluar.",
    }),
  "delete-leave": z.object({ ...attendanceIdentity, leaveId: uuid }).strict(),
  "students-save": z
    .object({
      classId: uuid,
      date,
      hadir: count,
      sakit: count,
      izin: count,
      alpa: count,
      version,
      reason,
    })
    .strict()
    .refine((v) => v.hadir + v.sakit + v.izin + v.alpa > 0),
  "journal-create": z.object({ occurrenceId: uuid, ...journalFields }).strict(),
  "journal-edit": z
    .object({ journalId: uuid, version, ...journalFields })
    .strict(),
  "journal-delete": z.object({ journalId: uuid, version, reason }).strict(),
  h1: z.object({ enabled: z.boolean(), reason }).strict(),
  block: z
    .object({
      id: uuid.optional(),
      subjectId: uuid,
      dateStart: date,
      dateEnd: date,
      message: z.string().trim().min(5).max(500),
      active: z.boolean(),
      version,
      reason,
    })
    .strict()
    .refine((v) => v.dateStart <= v.dateEnd, {path:["dateEnd"],message:"Tanggal akhir blok harus setelah atau sama dengan tanggal mulai."}),
} as const;
export type Command = keyof typeof commandSchemas;
export const commands = Object.keys(commandSchemas) as Command[];
export const reads = [
  "occurrences",
  "eligible",
  "attendance",
  "students",
  "students-progress",
  "journals",
  "ledger",
  "templates",
  "blocks",
  "options",
] as const;
export type ReadKind = (typeof reads)[number];
export type Occurrence = {
  id: string;
  assignmentId: string;
  classId: string;
  subjectId: string;
  date: string;
  userId: string;
  version: string;
  teacherName: string;
  className: string;
  subjectName: string;
  scheduledJtm: string;
  expectedStudents: number;
  timeStart: string;
  timeEnd: string;
  confirmed: boolean;
  claimed: boolean;
  journalId: string | null;
  eligibilityError?: string | null;
};
export type Attendance = {
  id: string;
  userId: string;
  teacherName: string;
  date: string;
  scheduledIn: string | null;
  scheduledOut: string | null;
  actualIn: string | null;
  actualOut: string | null;
  source: string | null;
  extra: boolean;
  version: string;
  effectiveMinutes: number;
  scheduledMinutes: number;
  ratio: number;
  leaves: {
    id: string;
    leaveTime: string;
    returnTime: string;
    reason: string;
  }[];
};
export type Journal = {
  id: string;
  occurrenceId: string;
  userId: string;
  teacherName: string;
  date: string;
  className: string;
  subjectName: string;
  material: string;
  present: number;
  absent: number;
  notes: string;
  inputType: string;
  weight: string;
  creditedJtm: string;
  version: string;
  submittedAt: string;
  recapAvailable: boolean;
};
export type StudentRecap = {
  id: string;
  class_id: string;
  date: string;
  className: string;
  hadir: number;
  sakit: number;
  izin: number;
  alpa: number;
  version: string;
  submittedByName: string;
};
export type List<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};
export type Options = {
  canOperate?: boolean;
  teachers: { id: string; name: string }[];
  classes: {
    id: string;
    name: string;
    periodId: string;
    expectedStudents: number;
  }[];
  subjects: { id: string; name: string }[];
  h1Enabled: boolean;
};
