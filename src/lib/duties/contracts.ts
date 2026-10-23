import { z } from "zod";
import { DomainDecimal as Decimal } from "../decimal";
import { ApiRequestError } from "../feedback/api-error";
import {
  dutyScheduleSchema,
  operationSchema,
  type DutyOccurrence,
  type DutyBoard,
} from "./schemas";
const decimal = z.string().regex(/^(0|[1-9]\d*)(\.\d+)?$/);
const version = z.string().regex(/^[1-9]\d{0,18}$/);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::00)?$/);
export const dutyOccurrenceSchema = z.object({
  id: z.uuid(),
  kind: z.enum(["KBM", "PIKET", "UPACARA"]),
  date: z.iso.date(),
  userId: z.uuid(),
  originalUserId: z.uuid(),
  teacherName: z.string(),
  originalTeacherName: z.string(),
  className: z.string().nullable(),
  subjectName: z.string().nullable(),
  timeStart: time,
  timeEnd: time,
  scheduledJtm: decimal,
  adjustedJtm: decimal,
  remainingJtm: decimal,
  adjustmentReason: z.string().nullable(),
  confirmed: z.boolean(),
  version,
  substitutionId: z.uuid().nullable(),
  journalId: z.uuid().nullable(),
  allocations: z.array(
    z.object({
      id: z.uuid(),
      userId: z.uuid(),
      teacherName: z.string(),
      jtm: decimal,
      reason: z.string(),
    }),
  ),
});
export const dutyScheduleResultSchema = z.object({
  id: z.uuid(),
  kind: z.enum(["PIKET", "UPACARA"]),
  user_id: z.uuid(),
  academic_period_id: z.uuid(),
  day_index: z.number().int().min(0).max(6),
  date: z.iso.date().nullable(),
  valid_from: z.iso.date(),
  valid_to: z.iso.date(),
  time_start: time,
  time_end: time,
  active: z.boolean(),
  version,
});
export const dutyBoardSchema = z
  .object({
    date: z.iso.date(),
    canOperate: z.boolean(),
    admin: z.boolean(),
    occurrences: z.array(dutyOccurrenceSchema),
    schedules: z.array(
      dutyScheduleResultSchema.extend({ teacherName: z.string() }),
    ),
    teachers: z.array(z.object({ id: z.uuid(), name: z.string() })),
    periods: z.array(
      z.object({
        id: z.uuid(),
        name: z.string(),
        dateStart: z.iso.date(),
        dateEnd: z.iso.date(),
      }),
    ),
  })
  .refine(
    (v) =>
      v.occurrences.every((o) => o.date === v.date) &&
      new Set(v.occurrences.map((o) => o.id)).size === v.occurrences.length &&
      new Set(v.schedules.map((o) => o.id)).size === v.schedules.length,
  );
export const dutyPreviewSchema = z.object({
  previewId: z.uuid(),
  expiresAt: z.iso.datetime({ offset: true }),
  operation: z.string(),
  current: dutyOccurrenceSchema,
  request: operationSchema,
  activeJournals: z.number().int().nonnegative(),
  activeNetJtm: z.string().regex(/^-?\d+(\.\d+)?$/),
  authorizesMutation: z.literal(false),
});
export function readDutyResponse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const parsed = schema.safeParse(raw);
  if (!parsed.success)
    throw new ApiRequestError(
      "INVALID_RESPONSE",
      "Data tugas dari server belum sesuai. Muat ulang dan periksa status sebelum mengirim ulang.",
    );
  return parsed.data;
}
export function dutyOperations(
  o: DutyOccurrence,
  actor: { admin: boolean; canOperate: boolean; userId: string; today: string },
): string[] {
  if (o.date !== actor.today) return [];
  const own = o.userId === actor.userId,
    original = o.originalUserId === actor.userId;
  const confirm =
    actor.admin ||
    (o.kind === "UPACARA" ? own : o.kind === "KBM" && actor.canOperate && !own);
  const actions = confirm ? [o.confirmed ? "revoke" : "confirm"] : [];
  if ((actor.admin || actor.canOperate) && !own && !original) {
    actions.push(o.substitutionId ? "replace" : "substitute");
    if (o.substitutionId) actions.push("cancel-substitute");
    if (o.kind !== "UPACARA" && o.confirmed) {
      actions.push("adjust", "allocate", "reset");
      if (o.allocations.length) actions.push("remove-allocation");
    }
  }
  return actions;
}
export function validateDutySchedule(
  raw: unknown,
  board: DutyBoard,
  today: string,
) {
  const v = dutyScheduleSchema.parse(raw),
    period = board.periods.find((p) => p.id === v.academicPeriodId);
  if (!period || v.validFrom < period.dateStart || v.validTo > period.dateEnd)
    throw Error(
      "Periode akademik: seluruh rentang jadwal harus berada dalam periode yang dipilih.",
    );
  if (!v.id && v.validFrom < today)
    throw Error(
      "Berlaku mulai: jadwal baru tidak boleh dimulai sebelum hari ini (WIB).",
    );
  if (v.id && v.validTo < today)
    throw Error("Jadwal yang sudah berakhir tidak dapat diubah.");
  return v;
}
export function validateDutyOperation(raw: unknown, o: DutyOccurrence) {
  const v = operationSchema.parse(raw);
  if (v.operation === "adjust") {
    const total = o.allocations.reduce(
      (sum, a) => sum.plus(a.jtm),
      new Decimal(v.adjustedJtm),
    );
    if (total.gt(o.scheduledJtm))
      throw Error(
        "JTM basis pemilik: jumlah basis dan alokasi tidak boleh melebihi JTM terjadwal.",
      );
  }
  if (
    v.operation === "allocate" &&
    new Decimal(v.allocatedJtm).gt(o.remainingJtm)
  )
    throw Error(
      "JTM alokasi: jumlah melebihi sisa JTM yang belum dialokasikan.",
    );
  return v;
}
