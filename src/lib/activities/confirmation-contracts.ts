import { z } from "zod";
import { ApiRequestError } from "../feedback/api-error";

const decimal = z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const confirmationOccurrenceSchema = z.object({
  id: z.uuid(),
  assignmentId: z.uuid(),
  kind: z.literal("KBM"),
  date: z.iso.date(),
  userId: z.uuid(),
  originalUserId: z.uuid(),
  version: z.string().regex(/^[1-9]\d{0,18}$/),
  classId: z.uuid(),
  subjectId: z.uuid(),
  teacherName: z.string(),
  className: z.string(),
  subjectName: z.string(),
  scheduledJtm: decimal,
  adjustedJtm: decimal,
  expectedStudents: z.number().int().min(0).max(1000),
  timeStart: time,
  timeEnd: time,
  confirmed: z.boolean(),
  claimed: z.boolean(),
  journalId: z.uuid().nullable(),
});
export const confirmationListSchema = z
  .object({
    date: z.iso.date(),
    items: z
      .array(confirmationOccurrenceSchema)
      .refine(
        (rows) => new Set(rows.map((row) => row.id)).size === rows.length,
      ),
  })
  .refine((value) => value.items.every((row) => row.date === value.date));
export const confirmationOptionsSchema = z.object({ canOperate: z.boolean() });
export type ConfirmationOccurrence = z.infer<
  typeof confirmationOccurrenceSchema
>;
export type ConfirmationAction = "claim" | "confirm" | "revoke";

export function readConfirmationResponse<T>(
  schema: z.ZodType<T>,
  input: unknown,
): T {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new ApiRequestError(
      "INVALID_RESPONSE",
      "Format data konfirmasi KBM belum sesuai. Muat ulang sebelum melanjutkan.",
    );
  return result.data;
}

/** UI guidance only. SQL always rechecks role, assignment, date, final period and version. */
export function confirmationPermissions(
  row: ConfirmationOccurrence,
  actor: {
    userId: string;
    admin: boolean;
    canOperate: boolean;
    today: string;
  },
) {
  const today = row.date === actor.today;
  const owns = row.userId === actor.userId;
  const canConfirm = today && !owns && (actor.admin || actor.canOperate);
  return {
    claim: today && owns && !row.claimed,
    confirm: canConfirm && !row.confirmed,
    revoke: canConfirm && row.confirmed && row.journalId === null,
  };
}

export function verifyConfirmationResult(
  raw: unknown,
  before: ConfirmationOccurrence,
  action: ConfirmationAction,
) {
  const after = readConfirmationResponse(confirmationOccurrenceSchema, raw);
  if (
    after.id !== before.id ||
    after.assignmentId !== before.assignmentId ||
    after.userId !== before.userId ||
    after.date !== before.date ||
    BigInt(after.version) <= BigInt(before.version) ||
    (action === "claim"
      ? !after.claimed
      : action === "confirm"
        ? !after.confirmed
        : after.confirmed || after.journalId !== null)
  ) {
    throw new ApiRequestError(
      "INVALID_RESPONSE",
      "Hasil konfirmasi tidak sesuai kegiatan atau versi yang dipilih. Muat ulang dan periksa status sebelum mengirim ulang.",
    );
  }
  return after;
}
