import { z } from "zod";
export const reportQuery = z
  .object({
    kind: z.enum(["academic", "finance"]),
    period: z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/),
    teacher: z.union([z.uuid(), z.literal("")]).default(""),
    mode: z.enum(["realized", "projection"]).default("realized"),
    page: z.coerce.number().int().min(1).max(999999).default(1),
    pageSize: z.coerce
      .number()
      .refine((v) => [25, 100, 1000].includes(v))
      .default(25),
  })
  .strict();
export const accessCommand = z
  .object({
    userId: z.uuid(),
    academic: z.boolean(),
    finance: z.boolean(),
    version: z.string().regex(/^\d{1,15}$/),
    reason: z.string().trim().min(5).max(500),
  })
  .strict();
export type Capabilities = {
  admin: boolean;
  academic: boolean;
  finance: boolean;
};
export type Reader = {
  id: string;
  name: string;
  academic: boolean;
  finance: boolean;
  version: string;
};
export type Report = z.infer<typeof reportResponseSchema>;
export type ReportRow = Report["items"][number];
export const reportDefinitions = {
  academic:
    "Sumber: kegiatan aktif yang sudah terbentuk sampai tanggal batas, sesuai kalender saat dibaca; bukan seluruh jadwal rencana. Konfirmasi dan jurnal dibandingkan dengan KBM terbentuk; BAP dengan pengawasan ujian terbentuk. Kehadiran dibandingkan dengan baris kehadiran tercatat, bukan seluruh hari wajib hadir. Ketiadaan catatan tidak membuktikan tidak ada jadwal. Kelengkapan administrasi bukan penilaian kinerja.",
  finance:
    "Sumber: mesin honorarium kanonis (ledger, transport, tunjangan dan koreksi). Realisasi memakai sumber sampai tanggal batas; proyeksi menambahkan hak libur tertunda sesuai mesin, bukan seluruh kegiatan masa depan. Periode final memakai snapshot penerbitan asli, tanpa menghitung ulang atau memasukkan koreksi periode berikutnya. Filter guru tidak membagi honor bulanan menurut kelas. Nominal rupiah dihitung dan dijumlahkan di server.",
};

export const capabilitiesSchema = z.object({
  admin: z.boolean(),
  academic: z.boolean(),
  finance: z.boolean(),
});
const decimal = z.string().regex(/^-?\d+(\.\d+)?$/);
export const reportResponseSchema = z
  .object({
    kind: z.enum(["academic", "finance"]),
    period: z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/),
    teacher: z.uuid().nullable(),
    mode: z.enum(["recorded", "realized", "projection", "final"]),
    cutoff: z.iso.date(),
    updatedAt: z.iso.datetime({ offset: true }),
    summary: z.record(
      z.string(),
      z.union([z.number().int().nonnegative(), decimal]),
    ),
    issues: z.array(z.string()),
    items: z.array(
      z.object({
        id: z.uuid(),
        name: z.string(),
        category: z.string().optional(),
        date: z.iso.date().optional(),
        user_id: z.uuid().optional(),
        class_name: z.string().nullable().optional(),
        subject: z.string().nullable().optional(),
        confirmed: z.boolean().optional(),
        documented: z.boolean().optional(),
        time_in: z.string().nullable().optional(),
        time_out: z.string().nullable().optional(),
        jtm: decimal.optional(),
        teaching: decimal.optional(),
        allowances: decimal.optional(),
        transport: decimal.optional(),
        corrections: decimal.optional(),
        total: decimal.optional(),
        cutoff: z.iso.date().optional(),
      }),
    ),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    teachers: z.array(z.object({ id: z.uuid(), name: z.string() })),
  })
  .superRefine((r, c) => {
    const keys = r.kind === "academic" ? ["kbm", "confirmed", "journals", "exams", "baps", "attendance", "present", "complete"] : ["beneficiaries", "jtm", "total"];
    const counts = r.kind === "academic" ? keys : ["beneficiaries"];
    const requiredRows = r.kind === "academic" ? ["category", "date", "user_id", "confirmed", "documented"] : ["jtm", "teaching", "allowances", "transport", "corrections", "total", "cutoff"];
    if ((r.kind === "academic" && (Number(r.summary.kbm)+Number(r.summary.exams)+Number(r.summary.attendance)!==r.total ||
      [["confirmed","kbm"],["journals","kbm"],["baps","exams"],["present","attendance"],["complete","attendance"]].some(([part,total])=>Number(r.summary[part!])>Number(r.summary[total!])))) ||
      (r.kind === "finance" && r.summary.beneficiaries !== r.total) ||
      r.items.some(row => (r.teacher && (r.kind==="academic"?row.user_id:row.id)?.toLowerCase()!==r.teacher.toLowerCase()) || (r.kind==="academic" && row.date?.slice(0,7)!==r.period)) ||
      keys.some(key => r.summary[key] === undefined) || counts.some(key => typeof r.summary[key] !== "number") ||
      (r.kind === "academic" ? r.mode !== "recorded" || r.items.some(row => !["KBM", "EXAM_SUPERVISOR", "ATTENDANCE"].includes(row.category ?? ""))
        : r.mode === "recorded" || typeof r.summary.jtm !== "string" || typeof r.summary.total !== "string") ||
      r.items.some(row => requiredRows.some(key => row[key as keyof typeof row] === undefined)) ||
      new Set(r.teachers.map(teacher => teacher.id)).size !== r.teachers.length ||
      ![25,100,1000].includes(r.pageSize) ||
      r.items.length !== Math.min(r.pageSize, Math.max(0, r.total - (r.page - 1) * r.pageSize))) {
      c.addIssue({code:"custom", message:"REPORT_RESPONSE_INCOMPLETE"});
    }
    if (
      r.items.length > r.pageSize ||
      r.items.length > r.total ||
      new Set(r.items.map((x) => x.id)).size !== r.items.length
    )
      c.addIssue({ code: "custom", message: "REPORT_RESPONSE_INVALID" });
  });

export const readersSchema = z.object({items:z.array(z.object({
  id:z.uuid(), name:z.string().trim().min(1), academic:z.boolean(), finance:z.boolean(), version:z.string().regex(/^\d{1,15}$/),
})).refine(items=>new Set(items.map(item=>item.id)).size===items.length)});
export const accessSavedSchema = z.object({ok:z.literal(true)});
/** Validate shape and complete request scope before using a report or enabling export. */
export function readReportResponse(raw: unknown, query: string): Report {
  const expected=reportQuery.parse(Object.fromEntries(new URLSearchParams(query)));
  const result=reportResponseSchema.parse(raw);
  if(result.kind!==expected.kind || result.period!==expected.period || (result.teacher?.toLowerCase()??null)!==(expected.teacher.toLowerCase()||null) ||
    result.page!==expected.page || result.pageSize!==expected.pageSize ||
    (result.kind==="finance" && result.mode!=="final" && result.mode!==expected.mode))
    throw Error("Respons laporan tidak sesuai filter. Muat ulang untuk mencoba kembali.");
  return result;
}
