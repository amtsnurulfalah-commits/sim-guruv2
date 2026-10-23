import { z } from "zod";
import { ApiRequestError } from "../feedback/api-error";
import { commandSchemas, historyFilter } from "./schemas";
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  version = z.string().regex(/^[1-9]\d{0,18}$/),
  choice = z.object({ id: z.uuid(), name: z.string() });
export const attendanceSchema = z
  .object({
    id: z.uuid(),
    userId: z.uuid(),
    teacherName: z.string(),
    date: z.iso.date(),
    scheduledIn: time.nullable(),
    scheduledOut: time.nullable(),
    actualIn: time.nullable(),
    actualOut: time.nullable(),
    source: z.enum(["admin", "self", "piket", "committee"]).nullable(),
    extra: z.boolean(),
    version,
    effectiveMinutes: z.number().finite().min(0).max(1440),
    scheduledMinutes: z.number().finite().min(0).max(1440),
    ratio: z.number().finite().min(0).max(1),
    leaves: z
      .array(
        z.object({
          id: z.uuid(),
          leaveTime: time,
          returnTime: time,
          reason: z.string(),
        }),
      )
      .refine((rows) => new Set(rows.map((r) => r.id)).size === rows.length),
  })
  .refine(
    (r) =>
      ((r.scheduledIn === null && r.scheduledOut === null) ||
        (r.scheduledIn !== null &&
          r.scheduledOut !== null &&
          r.scheduledIn < r.scheduledOut)) &&
      (r.actualOut === null ||
        (r.actualIn !== null && r.actualIn <= r.actualOut)) &&
      r.leaves.every((l) => l.leaveTime < l.returnTime),
  );
export const attendanceListSchema = z
  .object({
    items: z.array(attendanceSchema).max(100),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().min(1).max(100),
  })
  .refine(
    (v) =>
      v.items.length <= v.pageSize &&
      v.total >= v.items.length &&
      new Set(v.items.map((r) => r.id)).size === v.items.length,
  );
export const attendanceOptionsSchema = z.object({
  teachers: z.array(choice),
  canOperate: z.boolean(),
});
const templateTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::00)?$/);
export const attendanceTemplateSchema = z
  .object({
    id: z.uuid(),
    day_index: z.number().int().min(0).max(6),
    sched_type: z.enum(["KBM", "UJIAN"]),
    time_in: templateTime,
    time_out: templateTime,
    version,
  })
  .refine((v) => v.time_in < v.time_out);
export const attendanceTemplatesSchema = z
  .object({ items: z.array(attendanceTemplateSchema).max(14) })
  .refine(
    (v) =>
      new Set(v.items.map((t) => `${t.day_index}:${t.sched_type}`)).size ===
      v.items.length,
  );
export const attendancePreviewSchema = z
  .object({
    previewId: z.uuid(),
    date: z.iso.date(),
    expiresAt: z.iso.datetime({ offset: true }),
    timeIn: time,
    timeOut: time,
    participants: z.array(choice).min(1),
    preservesActual: z.literal(true),
  })
  .refine(
    (v) =>
      v.timeIn < v.timeOut &&
      new Set(v.participants.map((p) => p.id)).size === v.participants.length,
  );
export type AttendanceRow = z.infer<typeof attendanceSchema>;
export type AttendanceTemplate = z.infer<typeof attendanceTemplateSchema>;
export type AttendancePreview = z.infer<typeof attendancePreviewSchema>;
export type AttendanceAction =
  | "in"
  | "out"
  | "leave"
  | "delete-leave"
  | "manual"
  | "template-save"
  | "template-delete"
  | "template-preview"
  | "template-apply";
export function readAttendanceResponse<T>(
  schema: z.ZodType<T>,
  raw: unknown,
): T {
  const v = schema.safeParse(raw);
  if (!v.success)
    throw new ApiRequestError(
      "INVALID_RESPONSE",
      "Format data kehadiran belum sesuai. Muat ulang dan periksa status sebelum mengirim ulang.",
    );
  return v.data;
}
export function verifyAttendanceList(
  raw: unknown,
  filter: {
    from: string;
    to: string;
    page: number;
    pageSize: number;
    admin: boolean;
    userId: string;
    filterTeacher?: string;
  },
) {
  const v = readAttendanceResponse(attendanceListSchema, raw);
  if (
    v.page !== filter.page ||
    v.pageSize !== filter.pageSize ||
    v.items.some(
      (r) =>
        r.date < filter.from ||
        r.date > filter.to ||
        (!!filter.filterTeacher && r.userId !== filter.filterTeacher),
    )
  )
    throw new ApiRequestError(
      "INVALID_RESPONSE",
      "Data kehadiran tidak sesuai filter yang diminta. Muat ulang.",
    );
  return v;
}
export function attendancePermissions(
  row: AttendanceRow,
  actor: { admin: boolean; userId: string; canOperate: boolean; now: number },
) {
  const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
    }).format(new Date(actor.now)),
    current = row.date === today;
  // Scoped attendance reads already limit operational actors; SQL rechecks duty/committee targets and finance locks.
  const access = actor.admin || row.userId === actor.userId || actor.canOperate;
  const at = (time: string) => Date.parse(row.date + "T" + time + ":00+07:00");
  return {
    manual: actor.admin && row.date <= today,
    in:
      current &&
      access &&
      row.actualIn === null &&
      row.scheduledIn !== null &&
      actor.now >= at(row.scheduledIn),
    out:
      current &&
      access &&
      row.actualIn !== null &&
      row.actualOut === null &&
      row.scheduledOut !== null &&
      row.actualIn <= row.scheduledOut &&
      (actor.admin || actor.now >= at(row.scheduledOut) + 300000),
    leave: current && access && row.actualIn !== null,
    deleteLeave: current && access,
  };
}
export function validateAttendanceInput(
  action: AttendanceAction,
  raw: unknown,
  before?: AttendanceRow,
) {
  const v = commandSchemas[action].parse(raw);
  if (action === "leave" && before) {
    const d = v as z.infer<typeof commandSchemas.leave>;
    if (
      before.leaves.some(
        (l) => l.leaveTime < d.returnTime && l.returnTime > d.leaveTime,
      )
    )
      throw new ApiRequestError(
        "LEAVE_OVERLAP",
        "Interval izin bertabrakan dengan izin yang sudah tercatat.",
        422,
        { leaveTime: ["Pilih interval yang tidak bertumpang tindih."] },
      );
  }
  return v;
}
export function verifyAttendanceMutation(
  raw: unknown,
  input: unknown,
  before?: AttendanceRow,
  action?: AttendanceAction,
) {
  const after = readAttendanceResponse(attendanceSchema, raw),
    d = input as {
      userId?: string;
      date?: string;
      version: string;
      attendanceId?: string;
    };
  if (
    (before && after.id !== before.id) ||
    (d.attendanceId && after.id !== d.attendanceId) ||
    (d.userId && after.userId !== d.userId) ||
    (d.date && after.date !== d.date) ||
    (before &&
      (after.userId !== before.userId || after.date !== before.date)) ||
    BigInt(after.version) <= BigInt(d.version)
  )
    throw new ApiRequestError(
      "INVALID_RESPONSE",
      "Hasil penyimpanan tidak sesuai catatan atau versi. Periksa status terbaru sebelum mengirim ulang.",
    );
  const values = input as Record<string, unknown>;
  const mismatch =
    action === "manual"
      ? ["scheduledIn", "scheduledOut", "actualIn", "actualOut", "extra"].some(
          (key) => after[key as keyof typeof after] !== values[key],
        )
      : action === "in"
        ? after.actualIn === null
        : action === "out"
          ? after.actualOut === null
          : action === "leave"
            ? after.leaves.length !== (before?.leaves.length ?? 0) + 1 ||
              !after.leaves.some(
                (l) =>
                  l.leaveTime === values.leaveTime &&
                  l.returnTime === values.returnTime &&
                  l.reason === values.reason,
              )
            : action === "delete-leave"
              ? after.leaves.length !== (before?.leaves.length ?? 0) - 1 ||
                after.leaves.some((l) => l.id === values.leaveId)
              : false;
  if (mismatch)
    throw new ApiRequestError(
      "INVALID_RESPONSE",
      "Hasil tindakan belum sesuai isian. Muat ulang dan periksa status kehadiran.",
    );
  return after;
}
export const attendanceHistoryFilter = historyFilter.refine((v) => !v.q);
