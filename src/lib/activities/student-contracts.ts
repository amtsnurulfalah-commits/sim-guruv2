import { z } from "zod";
import { ApiRequestError } from "../feedback/api-error";
const count = z.number().int().min(0).max(1000);
const unique = <T>(rows: T[], key: (row: T) => string) =>
  new Set(rows.map(key)).size === rows.length;
export const studentRecapSchema = z
  .object({
    id: z.uuid(),
    class_id: z.uuid(),
    academic_period_id: z.uuid(),
    date: z.iso.date(),
    hadir: count,
    sakit: count,
    izin: count,
    alpa: count,
    version: z.string().regex(/^[1-9]\d{0,18}$/),
    submitted_by: z.uuid(),
    className: z.string(),
    submittedByName: z.string(),
  })
  .refine(
    (row) =>
      row.hadir + row.sakit + row.izin + row.alpa >= 1 &&
      row.hadir + row.sakit + row.izin + row.alpa <= 1000,
  );
export const studentListSchema = z
  .object({
    items: z
      .array(studentRecapSchema)
      .max(100)
      .refine((rows) => unique(rows, (row) => row.id)),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().min(1).max(100),
  })
  .refine((v) => v.items.length <= v.pageSize && v.total >= v.items.length);
export const studentOptionsSchema = z.object({
  canOperate: z.boolean(),
  classes: z
    .array(
      z.object({
        id: z.uuid(),
        name: z.string(),
        periodId: z.uuid(),
        expectedStudents: count,
      }),
    )
    .refine((rows) => unique(rows, (row) => row.id)),
});
export const studentDaySchema = z.object({
  date: z.iso.date(),
  academicPeriodId: z.uuid().nullable(),
});
export const studentProgressSchema = z
  .object({
    required: z
      .array(
        z.object({
          id: z.uuid(),
          name: z.string(),
          expectedStudents: count,
          complete: z.boolean(),
        }),
      )
      .refine((rows) => unique(rows, (row) => row.id)),
    requiredCount: z.number().int().nonnegative(),
    completedCount: z.number().int().nonnegative(),
    complete: z.boolean(),
  })
  .refine(
    (v) =>
      v.requiredCount === v.required.length &&
      v.completedCount === v.required.filter((c) => c.complete).length &&
      v.complete === (v.completedCount === v.requiredCount),
  );
export const studentSavedSchema = z.object({ id: z.uuid() });
export type StudentRecap = z.infer<typeof studentRecapSchema>;
export type StudentClass = z.infer<
  typeof studentOptionsSchema
>["classes"][number];
export type StudentProgress = z.infer<typeof studentProgressSchema>;
export function readStudentResponse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const parsed = schema.safeParse(raw);
  if (!parsed.success)
    throw new ApiRequestError(
      "INVALID_RESPONSE",
      "Format data absensi siswa belum sesuai. Muat ulang sebelum melanjutkan.",
    );
  return parsed.data;
}
export function verifyStudentList(
  raw: unknown,
  filter: {
    from: string;
    to: string;
    page: number;
    pageSize: number;
    admin: boolean;
    userId: string;
  },
) {
  const list = readStudentResponse(studentListSchema, raw);
  if (
    list.page !== filter.page ||
    list.pageSize !== filter.pageSize ||
    list.items.some(
      (row) =>
        row.date < filter.from ||
        row.date > filter.to ||
        (!filter.admin && row.submitted_by !== filter.userId),
    )
  )
    throw new ApiRequestError(
      "INVALID_RESPONSE",
      "Riwayat absensi tidak sesuai tanggal atau akun. Muat ulang dan periksa data.",
    );
  return list;
}
export function studentTotal(row: {
  hadir: number;
  sakit: number;
  izin: number;
  alpa: number;
}) {
  return row.hadir + row.sakit + row.izin + row.alpa;
}
