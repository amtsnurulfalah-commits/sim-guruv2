import { z } from "zod";
import { ApiRequestError } from "../feedback/api-error";
import { dutyOccurrenceSchema } from "../duties/contracts";
import { DomainDecimal as Decimal } from "../decimal";
import {
  bapSchema,
  examSaveSchema,
  operationSchema,
  type ExamBoard,
  type ExamOccurrence,
} from "./schemas";
const version = z.string().regex(/^[1-9]\d{0,18}$/),
  decimal = z.string().regex(/^(0|[1-9]\d*)(\.\d+)?$/),
  signed = z.string().regex(/^-?\d+(\.\d+)?$/),
  time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::00)?$/),
  choice = z.object({ id: z.uuid(), name: z.string() });
const masterJtm = z.union([
  decimal,
  z.number().finite().positive().max(9999.9999).transform(String),
]);
export const examPeriodSchema = z.object({
  id: z.uuid(),
  academic_period_id: z.uuid(),
  name: z.string(),
  date_start: z.iso.date(),
  date_end: z.iso.date(),
  default_committee_jtm: masterJtm,
  version,
});
export const examSessionSchema = z.object({
  id: z.uuid(),
  period_id: z.uuid(),
  date: z.iso.date(),
  name: z.string(),
  time_start: time,
  time_end: time,
  scheduled_jtm: masterJtm,
  version,
});
export const examRoomSchema = z.object({
  id: z.uuid(),
  session_id: z.uuid(),
  name: z.string(),
  subject_id: z.uuid(),
  total_students: z.number().int().min(0).max(1000),
  classIds: z.array(z.uuid()),
  version,
});
export const examBapSchema = z.object({
  id: z.uuid(),
  occurrence_id: z.uuid(),
  present: z.number().int().min(0).max(1000),
  absent: z.number().int().min(0).max(1000),
  notes: z.string().max(1000),
  version,
  state: z.enum(["active", "locked"]),
  teacherName: z.string().optional(),
  date: z.iso.date().optional(),
});
export const examOccurrenceSchema = dutyOccurrenceSchema.extend({
  kind: z.enum(["EXAM_SUPERVISOR", "EXAM_COMMITTEE"]),
  sourceId: z.uuid(),
  sourceVersion: version,
  roomId: z.uuid().nullable(),
  overrideJtm: decimal.nullable(),
  periodId: z.uuid(),
  sessionName: z.string(),
  periodName: z.string(),
  expectedStudents: z.number().int().min(0).max(1000),
  bap: examBapSchema.nullable(),
  lockedBaps: z.number().int().nonnegative(),
  netJtm: signed,
});
export const examBoardSchema = z
  .object({
    date: z.iso.date(),
    admin: z.boolean(),
    canOperate: z.boolean(),
    required: z.array(choice.extend({ complete: z.boolean() })),
    periods: z.array(examPeriodSchema),
    sessions: z.array(examSessionSchema),
    rooms: z.array(examRoomSchema),
    occurrences: z.array(examOccurrenceSchema),
    baps: z.array(
      examBapSchema.extend({ teacherName: z.string(), date: z.iso.date() }),
    ),
    recaps: z.array(
      z.object({
        teacherName: z.string(),
        sourceKind: z.string(),
        jtm: signed,
      }),
    ),
    teachers: z.array(choice),
    academicPeriods: z.array(choice),
    classes: z.array(choice.extend({ periodId: z.uuid() })),
    subjects: z.array(choice),
  })
  .refine(
    (v) =>
      v.occurrences.every(
        (o) => o.date === v.date && (!o.bap || o.bap.occurrence_id === o.id),
      ) &&
      [v.occurrences, v.periods, v.sessions, v.rooms, v.baps].every(
        (rows) => new Set(rows.map((r) => r.id)).size === rows.length,
      ),
  );
export const examPreviewSchema = z.object({
  previewId: z.uuid(),
  expiresAt: z.iso.datetime({ offset: true }),
  operation: z.string(),
  request: operationSchema,
  current: dutyOccurrenceSchema.extend({
    kind: z.enum(["EXAM_SUPERVISOR", "EXAM_COMMITTEE"]),
  }),
  activeNetJtm: signed,
  activeJournals: z.number().int().nonnegative(),
  activeBaps: z.number().int().nonnegative(),
  authorizesMutation: z.literal(false),
});
export const examDeletePreviewSchema = z.object({
  previewId: z.uuid(),
  expiresAt: z.iso.datetime({ offset: true }),
  assignments: z.number().int().nonnegative(),
  baps: z.number().int().nonnegative(),
  sessions: z.number().int().nonnegative(),
  rooms: z.number().int().nonnegative(),
  netJtm: signed,
});
export function readExamResponse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const v = schema.safeParse(raw);
  if (!v.success)
    throw new ApiRequestError(
      "INVALID_RESPONSE",
      "Format data ujian belum sesuai. Muat ulang dan periksa status sebelum mengirim ulang.",
    );
  return v.data;
}
export function examOperations(
  o: ExamOccurrence,
  board: ExamBoard,
  userId: string,
  today: string,
) {
  if (o.date !== today) return [];
  const own = [o.userId, o.originalUserId].includes(userId);
  if (!board.admin) {
    if (
      own ||
      o.kind === "EXAM_COMMITTEE" ||
      !board.occurrences.some(
        (c) =>
          c.kind === "EXAM_COMMITTEE" &&
          c.userId === userId &&
          c.confirmed &&
          c.periodId === o.periodId,
      )
    )
      return [];
    const ids = new Set(
      board.rooms
        .filter((r) =>
          board.sessions.some(
            (s) =>
              s.id === r.session_id &&
              s.period_id === o.periodId &&
              s.date === o.date,
          ),
        )
        .flatMap((r) => r.classIds),
    );
    if (board.required.some((c) => ids.has(c.id) && !c.complete)) return [];
  }
  const actions = [o.confirmed ? "revoke" : "confirm"];
  if (!own) {
    actions.push(o.substitutionId ? "replace" : "substitute");
    if (o.substitutionId) actions.push("cancel-substitute");
    if (o.kind === "EXAM_SUPERVISOR" && o.confirmed) {
      actions.push("adjust", "allocate", "reset");
      if (o.allocations.length) actions.push("remove-allocation");
    }
  }
  return actions;
}
export function bapAvailability(
  o: ExamOccurrence,
  board: ExamBoard,
  userId: string,
  now: number,
) {
  const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
    }).format(new Date(now)),
    p = board.periods.find((p) => p.id === o.periodId);
  if (o.kind !== "EXAM_SUPERVISOR" || o.userId !== userId)
    return "BAP hanya dapat diisi oleh pengawas efektif.";
  if (!p) return "Periode ujian tidak tersedia. Muat ulang panel.";
  if (today < o.date) return "BAP belum dapat diisi sebelum tanggal sesi.";
  if (today > p.date_end)
    return "Batas pengisian BAP telah berakhir pada " + p.date_end + ".";
  if (!o.confirmed) return "Tunggu konfirmasi penugasan sebelum mengisi BAP.";
  if (
    now <
    Date.parse(o.date + "T" + o.timeEnd.slice(0, 5) + ":00+07:00") + 300000
  )
    return "BAP dapat diisi mulai 5 menit setelah sesi selesai (WIB).";
  return "";
}
export function validateBap(raw: unknown, o: ExamOccurrence) {
  const v = bapSchema.parse(raw);
  if (
    v.present + v.absent > 1000 ||
    (o.expectedStudents > 0 && v.present + v.absent !== o.expectedStudents)
  )
    throw new ApiRequestError(
      "STUDENT_COUNT_MISMATCH",
      "Jumlah hadir dan absen harus sesuai total peserta.",
      422,
      {
        present: [
          "Total hadir + absen harus " +
            (o.expectedStudents > 0 ? o.expectedStudents : "maksimal 1000") +
            " siswa.",
        ],
      },
    );
  return v;
}
export function validateExamOperation(raw: unknown, o: ExamOccurrence) {
  const v = operationSchema.parse(raw);
  if (
    v.operation === "adjust" &&
    o.allocations
      .reduce((n, a) => n.plus(a.jtm), new Decimal(v.adjustedJtm))
      .gt(o.scheduledJtm)
  )
    throw Error("JTM dasar dan alokasi tidak boleh melebihi JTM terjadwal.");
  if (
    v.operation === "allocate" &&
    new Decimal(v.allocatedJtm).gt(o.remainingJtm)
  )
    throw Error("Jumlah alokasi melebihi sisa JTM yang tersedia.");
  return v;
}
export function validateExamSave(
  raw: unknown,
  board: ExamBoard,
  today: string,
) {
  const parsed = examSaveSchema.safeParse(raw);
  if (!parsed.success)
    throw new z.ZodError(
      parsed.error.issues.map((issue) => ({
        ...issue,
        path: issue.path[0] === "data" ? issue.path.slice(1) : issue.path,
      })),
    );
  const v = parsed.data,
    d = v.data;
  if ("dateStart" in d && d.dateStart < today)
    throw Error("Tanggal mulai periode tidak boleh sebelum hari ini (WIB).");
  if ("date" in d && d.date < today)
    throw Error("Tanggal sesi/panitia tidak boleh sebelum hari ini (WIB).");
  if ("periodId" in d) {
    const p = board.periods.find((p) => p.id === d.periodId);
    if (!p || d.date < p.date_start || d.date > p.date_end)
      throw Error("Tanggal harus berada dalam periode ujian yang dipilih.");
  }
  if (v.entity === "room") {
    const session = board.sessions.find((s) => s.id === v.data.sessionId),
      p = board.periods.find((p) => p.id === session?.period_id);
    if (
      !p ||
      v.data.classIds.some(
        (id) =>
          !board.classes.some(
            (c) => c.id === id && c.periodId === p.academic_period_id,
          ),
      )
    )
      throw Error(
        "Kelas peserta harus berasal dari semester yang sama dengan sesi ujian.",
      );
  }
  return v;
}
export function verifyExamSave(
  raw: unknown,
  input: z.infer<typeof examSaveSchema>,
) {
  const schemas = {
    period: examPeriodSchema,
    session: examSessionSchema,
    room: examRoomSchema.omit({ classIds: true }),
    supervisor: z.object({
      id: z.uuid(),
      version,
      exam_room_id: z.uuid(),
      user_id: z.uuid(),
      override_jtm: masterJtm.nullable(),
    }),
    committee: z.object({
      id: z.uuid(),
      version,
      period_id: z.uuid(),
      date: z.iso.date(),
      user_id: z.uuid(),
      scheduled_jtm: masterJtm,
      exclusive_time_start: time.nullable(),
      exclusive_time_end: time.nullable(),
    }),
  };
  const parsed = schemas[input.entity].safeParse(raw);
  if (
    !parsed.success ||
    (input.id && parsed.data.id !== input.id) ||
    BigInt(parsed.data.version) <= BigInt(input.version)
  )
    throw Error(
      "Hasil penyimpanan ujian belum dapat diverifikasi. Muat ulang sebelum mengirim ulang.",
    );
  return parsed.data;
}
