import { z } from "zod";
import { ApiRequestError } from "../feedback/api-error";
import { eventSaveSchema, type EventDefinition } from "./schemas";
const version = z.string().regex(/^[1-9]\d{0,18}$/);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::00)?$/);
export const eventDefinitionSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  type: z.enum(["rutin", "insidental"]),
  days: z.array(z.number().int().min(0).max(6)),
  dates: z.array(z.iso.date()),
  time_start: time,
  time_end: time,
  jtm: z.number().int().min(1).max(99),
  description: z.string(),
  date_start: z.iso.date(),
  date_end: z.iso.date(),
  version,
});
export const eventAttendanceResponseSchema = z.object({
  id: z.uuid(),
  event_id: z.uuid(),
  date: z.iso.date(),
  user_id: z.uuid(),
  time_in: time,
  version,
  cancelled_at: z.string().nullable(),
});
export const eventBlockResponseSchema = z.object({
  id: z.uuid(),
  event_id: z.uuid().nullable(),
  event_type: z.enum(["rutin", "insidental"]).nullable(),
  date_start: z.iso.date(),
  date_end: z.iso.date(),
  message: z.string(),
  active: z.boolean(),
  version,
});
export const eventBoardSchema = z
  .object({
    date: z.iso.date(),
    canOperate: z.boolean(),
    events: z.array(eventDefinitionSchema),
    today: z.array(eventDefinitionSchema),
    attendance: z.array(
      eventAttendanceResponseSchema.extend({
        teacherName: z.string(),
        eventName: z.string(),
        journal: z.string().nullable(),
        creditedJtm: z.string().regex(/^\d+(\.\d+)?$/),
      }),
    ),
    teachers: z.array(z.object({ id: z.uuid(), name: z.string() })),
    blocks: z.array(eventBlockResponseSchema),
  })
  .refine(
    (b) =>
      b.today.every((e) => b.events.some((v) => v.id === e.id)) &&
      [b.events, b.today, b.attendance, b.teachers, b.blocks].every(
        (rows) => new Set(rows.map((r) => r.id)).size === rows.length,
      ),
  );
export const eventDeletePreviewSchema = z.object({
  previewId: z.uuid(),
  expiresAt: z.iso.datetime({ offset: true }),
  attendance: z.number().int().nonnegative(),
  journals: z.number().int().nonnegative(),
  netJtm: z.string().regex(/^-?\d+(\.\d+)?$/),
});
export const eventJournalResponseSchema = z.object({
  id: z.uuid(),
  attendance_id: z.uuid(),
  description: z.string(),
  credited_jtm: z.union([
    z.number().nonnegative(),
    z.string().regex(/^\d+(\.\d+)?$/),
  ]),
});
export function readEventResponse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (!result.success)
    throw new ApiRequestError(
      "INVALID_RESPONSE",
      "Data acara belum dapat diverifikasi. Muat ulang dan periksa status sebelum mengirim ulang.",
    );
  return result.data;
}
export function validateEventSave(
  raw: unknown,
  today: string,
  previous: EventDefinition | null,
) {
  const result = eventSaveSchema.safeParse(raw);
  if (!result.success)
    throw new z.ZodError(
      result.error.issues.map((i) => ({
        ...i,
        path: i.path[0] === "data" ? i.path.slice(1) : i.path,
      })),
    );
  if (
    result.data.data.dateStart < today &&
    result.data.data.dateStart !== previous?.date_start
  )
    throw new z.ZodError([
      {
        code: "custom",
        path: ["dateStart"],
        message: "Tanggal mulai baru tidak boleh sebelum hari ini (WIB).",
      },
    ]);
  return result.data;
}
export function eventJournalDateMessage(date: string, today: string) {
  if (date > today) return "Jurnal belum dapat diisi sebelum tanggal kegiatan.";
  const yesterday = new Date(Date.parse(today + "T00:00:00Z") - 86400000)
    .toISOString()
    .slice(0, 10);
  if (date < yesterday)
    return "Batas pengisian jurnal telah berakhir (maksimal H-1).";
  return "";
}
