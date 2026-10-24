import { z } from "zod";
export const preparationRequest = z
  .object({
    sourceId: z.uuid(),
    targetId: z.uuid(),
    configuration: z.enum(["classes", "classes_and_schedules"]),
    reason: z.string().trim().min(5).max(500),
  })
  .strict()
  .refine((d) => d.sourceId !== d.targetId, {
    path: ["targetId"],
    message: "Pilih semester tujuan yang berbeda.",
  });
export const commitRequest = z.object({ previewId: z.uuid() }).strict();
const klass = z.object({
  sourceId: z.uuid(),
  id: z.uuid(),
  name: z.string(),
  level: z.string(),
  grade: z.number().int(),
  parallel: z.string(),
  expectedStudents: z.literal(0),
});
const schedule = z.object({
  sourceId: z.uuid(),
  id: z.uuid(),
  classId: z.uuid().nullable(),
  className: z.string().nullable(),
  teacher: z.string().nullable(),
  subject: z.string().nullable(),
  userId: z.uuid(),
  subjectId: z.uuid(),
  dayIndex: z.number().int().min(0).max(6),
  timeStart: z.string(),
  timeEnd: z.string(),
  scheduledJtm: z.string(),
  restMinutes: z.number().int(),
  validFrom: z.iso.date(),
  validTo: z.iso.date(),
});
const receiptBase = z.object({
  previewId: z.uuid(),
  sourceId: z.uuid(),
  targetId: z.uuid(),
  classes: z.number().int().nonnegative(),
  schedules: z.number().int().nonnegative(),
  committedAt: z.string(),
  classMapping: z.array(klass),
  scheduleMapping: z.array(schedule),
});
export const receiptSchema = receiptBase.superRefine((r, c) => {
  const ids = [...r.classMapping, ...r.scheduleMapping].map((x) => x.id);
  if (
    r.classes !== r.classMapping.length ||
    r.schedules !== r.scheduleMapping.length ||
    new Set(ids).size !== ids.length ||
    r.sourceId === r.targetId ||
    r.scheduleMapping.some(
      (x) => !r.classMapping.some((k) => k.id === x.classId),
    )
  )
    c.addIssue({ code: "custom", message: "PREPARATION_RECEIPT_INVALID" });
});
export const previewSchema = z.object({
  previewId: z.uuid(),
  expiresAt: z.string(),
  plan: z.object({
    sourceId: z.uuid().nullable(),
    targetId: z.uuid().nullable(),
    sourceDate: z.iso.date().nullable(),
    validFrom: z.iso.date().nullable(),
    validTo: z.iso.date().nullable(),
    configuration: z.enum(["classes", "classes_and_schedules"]),
    classes: z.array(klass),
    schedules: z.array(schedule),
    issues: z.array(z.string()),
  }),
  result: receiptSchema.nullable(),
});
export type PreparationPreview = z.infer<typeof previewSchema>;
export type PreparationReceipt = z.infer<typeof receiptSchema>;
export const choicesSchema = z.object({
  periods: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      start: z.iso.date(),
      end: z.iso.date(),
      active: z.boolean(),
    }),
  ),
  history: z.array(
    z.object({
      id: z.uuid(),
      at: z.string(),
      actor: z.string(),
      reason: z.string(),
      result: receiptBase.omit({ classMapping: true, scheduleMapping: true }),
    }),
  ),
});
export type PreparationChoices = z.infer<typeof choicesSchema>;
export const issueLabels: Record<string, string> = {
  PERIOD_INVALID:
    "Tujuan harus semester berikutnya, belum aktif, dan mulai setelah hari ini WIB (maksimal 366 hari). Sumber/tujuan tidak boleh diarsipkan atau bertumpang tindih.",
  TARGET_NOT_EMPTY:
    "Semester tujuan sudah berisi konfigurasi atau kegiatan. Gunakan tujuan kosong; tidak ada data yang akan ditimpa.",
  SCHOOL_INVALID: "Lengkapi profil madrasah aktif terlebih dahulu.",
  CLASS_POLICY_CHANGED:
    "Tingkat atau paralel kelas sumber tidak cocok dengan pengaturan madrasah saat ini.",
  NO_CLASSES: "Tidak ada kelas aktif pada sumber.",
  NO_SCHEDULES:
    "Tidak ada jadwal aktif yang berlaku pada hari terakhir semester sumber.",
  CLASS_MISSING: "Ada jadwal dengan kelas sumber yang telah diarsipkan.",
  INACTIVE_DEPENDENCY: "Ada guru atau mata pelajaran yang tidak aktif.",
  JP_POLICY_CHANGED:
    "Menit per JP berubah. Susun ulang jadwal melalui halaman Jadwal Mengajar.",
  WEEKDAY_MISSING: "Rentang semester tujuan tidak mencakup hari jadwal.",
  SCHEDULE_COLLISION: "Ada bentrok guru atau kelas pada hari/jam yang sama.",
  PLAN_TOO_LARGE:
    "Rencana melebihi batas 500 kelas atau 2.000 jadwal. Hubungi pengelola.",
};

/** A successful-looking acknowledgement must describe the exact reviewed ID mapping. */
export function readPreparationReceipt(
  preview: PreparationPreview,
  input: unknown,
): PreparationReceipt {
  const r = receiptSchema.parse(input),
    p = preview.plan;
  const key = (rows: { id: string; sourceId: string }[]) =>
    rows
      .map((x) => x.sourceId + ":" + x.id)
      .sort()
      .join("|");
  if (
    r.previewId !== preview.previewId ||
    r.sourceId !== p.sourceId ||
    r.targetId !== p.targetId ||
    key(r.classMapping) !== key(p.classes) ||
    key(r.scheduleMapping) !== key(p.schedules)
  )
    throw new Error(
      "Hasil belum cocok dengan pratinjau yang diperiksa. Periksa hasil sebelum mencoba lagi.",
    );
  return r;
}
