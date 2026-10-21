import { z } from "zod";
import { date } from "../masters/schemas";
import { DomainDecimal } from "../decimal";
const uuid = z.uuid(),
  version = z.string().regex(/^[1-9]\d{0,17}$/),
  reason = z.string().trim().min(5).max(500);
export const scheduleData = z
  .object({
    academicPeriodId: uuid,
    userId: uuid,
    subjectId: uuid,
    classId: uuid,
    dayIndex: z.number().int().min(0).max(6),
    timeStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    scheduledJtm: z
      .string()
      .regex(/^(0|[1-9]\d{0,7})(\.\d{1,4})?$/)
      .pipe(z.string().refine((v) => new DomainDecimal(v).gt(0))
        .transform((v) => new DomainDecimal(v).toFixed(4))),
    restMinutes: z.number().int().min(0).max(600),
    validFrom: date,
    validTo: date,
  })
  .strict()
  .refine(
    (v) => {
      const n = (Date.parse(v.validTo) - Date.parse(v.validFrom)) / 86400000;
      return n >= 0 && n <= 365;
    },
    {
      path: ["validTo"],
      message:
        "Tanggal akhir harus setelah atau sama dengan tanggal mulai, maksimal 366 hari.",
    },
  );
export const createSchedule = z.object({ data: scheduleData, reason }).strict();
export const editSchedule = createSchedule.extend({ version }).strict();
export const stopSchedule = z
  .object({ version, stopFrom: date, reason })
  .strict();
export const conflictSchedule = z
  .object({ id: uuid.optional(), data: scheduleData })
  .strict();
export const scheduleFilters = z
  .object({
    q: z.string().trim().max(100).default(""),
    academicYearId: z.union([z.literal(""), uuid]).default(""),
    academicPeriodId: z.union([z.literal(""), uuid]).default(""),
    userId: z.union([z.literal(""), uuid]).default(""),
    subjectId: z.union([z.literal(""), uuid]).default(""),
    classId: z.union([z.literal(""), uuid]).default(""),
    dayIndex: z.union([z.literal(""), z.string().regex(/^[0-6]$/)]).default(""),
    validFrom: z.union([z.literal(""), date]).default(""),
    validTo: z.union([z.literal(""), date]).default(""),
    state: z.enum(["", "active", "closed", "archived"]).default("active"),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict()
  .refine((v) => !v.validFrom || !v.validTo || v.validFrom <= v.validTo);
export const bulkSchedule = z
  .object({
    items: z
      .array(z.object({ id: uuid, version }).strict())
      .min(1)
      .max(100)
      .refine((v) => new Set(v.map((i) => i.id)).size === v.length),
    stopFrom: date,
    reason,
  })
  .strict();
export const bulkCommit = z.object({ previewId: uuid }).strict();
export type ScheduleData = z.input<typeof scheduleData>;
export type ScheduleRow = z.output<typeof scheduleData> & {
  id: string;
  timeEnd: string;
  minutesPerJtm: number;
  version: string;
  state: "active" | "closed" | "archived";
  teacherName: string;
  subjectName: string;
  className: string;
  periodLabel: string;
  replacesId: string | null;
};
export type ScheduleList = {
  items: ScheduleRow[];
  total: number;
  page: number;
  pageSize: number;
};
export const days = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];
export function endTime(
  start: string,
  jtm: string,
  minutes: number,
  rest: number,
) {
  if (
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(start) ||
    !/^\d+(\.\d{1,4})?$/.test(jtm) ||
    !Number.isInteger(minutes) ||
    minutes < 1 ||
    !Number.isInteger(rest) ||
    rest < 0
  )
    return null;
  const [h, m] = start.split(":").map(Number);
  const sec = new DomainDecimal(h! * 3600 + m! * 60).plus(
    new DomainDecimal(jtm).times(minutes).plus(rest).times(60),
  );
  if (sec.gte(86400) || sec.lte(h! * 3600 + m! * 60)) return null;
  const hours = sec.div(3600).floor(),
    mins = sec.minus(hours.times(3600)).div(60).floor(),
    seconds = sec.minus(hours.times(3600)).minus(mins.times(60));
  return (
    hours.toFixed(0).padStart(2, "0") +
    ":" +
    mins.toFixed(0).padStart(2, "0") +
    ":" +
    seconds.toFixed(4).padStart(7, "0")
  );
}
