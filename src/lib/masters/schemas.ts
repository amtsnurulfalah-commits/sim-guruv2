import { z } from "zod";
export const kinds = [
  "school",
  "academic-years",
  "academic-periods",
  "classes",
  "subjects",
  "rates",
  "allowances",
] as const;
export const kindSchema = z.enum(kinds);
export type MasterKind = z.infer<typeof kindSchema>;
const name = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .transform((v) => v.replace(/\s+/gu, " "));
export const date = z.iso
  .date()
  .refine(
    (v) =>
      !Number.isNaN(new Date(v + "T00:00:00Z").getTime()) &&
      new Date(v + "T00:00:00Z").toISOString().slice(0, 10) === v,
  );
const window = { dateStart: date, dateEnd: date };
const validWindow = (v: { dateStart: string; dateEnd: string }) =>
  v.dateStart <= v.dateEnd;
const money = z.string().regex(/^(0|[1-9]\d{0,8})$/);
export const payloadSchemas = {
  school: z
    .object({
      name,
      address: z.string().trim().max(500),
      npsn: z.string().regex(/^$|^\d{8}$/),
      level: z.enum(["SD", "SMP", "SMA", "SMK"]),
      useParallel: z.boolean(),
      parallelMax: z.number().int().min(1).max(24),
      minutesPerJtm: z.number().int().min(1).max(180),
      headmasterId: z.union([z.literal(""), z.uuid()]),
    })
    .strict()
    .refine(
      (v) => v.parallelMax <= { SD: 4, SMP: 11, SMA: 12, SMK: 24 }[v.level],
      "Batas paralel melampaui jenjang.",
    ),
  "academic-years": z
    .object({ label: z.string().regex(/^\d{4}\/\d{4}$/), ...window })
    .strict()
    .refine(validWindow)
    .refine(
      (v) => Number(v.label.slice(5)) === Number(v.label.slice(0, 4)) + 1,
    ),
  "academic-periods": z
    .object({
      academicYearId: z.uuid(),
      semester: z.number().int().min(1).max(2),
      ...window,
      isActive: z.boolean(),
    })
    .strict()
    .refine(validWindow),
  classes: z
    .object({
      academicPeriodId: z.uuid(),
      name,
      level: z.enum(["SD", "SMP", "SMA", "SMK"]),
      grade: z.number().int().min(1).max(12),
      parallel: z.string().regex(/^$|^[A-X]$/),
      expectedStudents: z.number().int().min(0).max(36),
    })
    .strict()
    .superRefine((v, c) => {
      const limits = {
        SD: [1, 6, 4, 28],
        SMP: [7, 9, 11, 32],
        SMA: [10, 12, 12, 36],
        SMK: [10, 12, 24, 36],
      }[v.level];
      if (
        v.grade < limits[0]! ||
        v.grade > limits[1]! ||
        v.expectedStudents > limits[3]! ||
        (v.parallel &&
          (v.parallel.charCodeAt(0) - 64 > limits[2]! ||
            (v.expectedStudents > 0 && v.expectedStudents < 15)))
      )
        c.addIssue({
          code: "custom",
          message:
            "Jenjang, kelas, paralel atau standar siswa tidak sesuai kebijakan.",
        });
    }),
  subjects: z.object({ name }).strict(),
  rates: z
    .object({
      kind: z.enum(["jtm", "transport"]),
      amount: money,
      enabled: z.boolean(),
      ...window,
    })
    .strict()
    .refine(validWindow)
    .refine((v) => v.kind !== "transport" || !v.enabled || v.amount !== "0"),
  allowances: z
    .object({ userId: z.uuid(), dutyName: name, amount: money, ...window })
    .strict()
    .refine(validWindow),
} as const;
export const mutationSchema = z
  .object({
    id: z.uuid().optional(),
    version: z.string().regex(/^\d{1,18}$/),
    reason: z.string().trim().min(5).max(500),
    data: z.unknown().optional(),
  })
  .strict();
export const filtersSchema = z
  .object({
    q: z.string().trim().max(100).default(""),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    parentId: z.union([z.literal(""), z.uuid()]).default(""),
    archived: z.enum(["", "true", "false"]).default("false"),
  })
  .strict();
export type MasterRow = {
  id: string;
  version: string;
  archivedAt: string | null;
  [key: string]: unknown;
};
export type MasterList = {
  items: MasterRow[];
  total: number;
  page: number;
  pageSize: number;
};
export const labels: Record<MasterKind, string> = {
  school: "Identitas sekolah",
  "academic-years": "Tahun pelajaran",
  "academic-periods": "Semester",
  classes: "Kelas dan standar siswa",
  subjects: "Mata pelajaran",
  rates: "Tarif",
  allowances: "Tunjangan",
};
