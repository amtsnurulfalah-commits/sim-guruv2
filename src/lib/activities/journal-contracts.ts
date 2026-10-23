import { z } from "zod";
import { ApiRequestError } from "../feedback/api-error";
const uuid = z.uuid(), date = z.iso.date();
const version = z.string().regex(/^[1-9]\d{0,18}$/);
const decimal = z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/);
const count = z.number().int().min(0).max(1000);
const unique = <T>(rows: T[], key: (row: T) => string) => new Set(rows.map(key)).size === rows.length;
export const journalSchema = z.object({
    id: uuid, occurrenceId: uuid, userId: uuid, teacherName: z.string(), date,
    className: z.string(), subjectName: z.string(), material: z.string().max(2000),
    present: count, absent: count, notes: z.string().max(2000),
    inputType: z.enum(["SAME_DAY", "H_MINUS_1"]), weight: z.string().regex(/^(?:1(?:\.0+)?|0\.80*)$/),
    creditedJtm: decimal, version, submittedAt: z.iso.datetime({ offset: true }), recapAvailable: z.boolean(),
});
export const journalListSchema = z.object({
    items: z.array(journalSchema).max(100).refine(rows => unique(rows, row => row.id)),
    total: z.number().int().nonnegative(), page: z.number().int().positive(), pageSize: z.number().int().min(1).max(100),
}).refine(v => v.items.length <= v.pageSize && v.total >= v.items.length);
const option = z.object({ id: uuid, name: z.string() });
export const journalOptionsSchema = z.object({
    teachers: z.array(option).refine(rows => unique(rows, row => row.id)),
    subjects: z.array(option).refine(rows => unique(rows, row => row.id)), h1Enabled: z.boolean(),
});
export const eligibleJournalsSchema = z.object({ items: z.array(z.object({
        id: uuid, userId: uuid, date, kind: z.enum(["KBM", "PIKET", "UPACARA", "EXAM_SUPERVISOR", "EXAM_COMMITTEE"]),
        className: z.string().nullable(), subjectName: z.string().nullable(), expectedStudents: count,
        timeStart: z.string().regex(/^\d{2}:\d{2}$/), timeEnd: z.string().regex(/^\d{2}:\d{2}$/),
        journalId: uuid.nullable(), eligibilityError: z.string().nullable(),
    })).refine(rows => unique(rows, row => row.id)) });
export const journalBlocksSchema = z.object({ items: z.array(z.object({
        id: uuid, subject_id: uuid, date_start: date, date_end: date, message: z.string().min(5).max(500),
        active: z.boolean(), version,
    })).refine(rows => unique(rows, row => row.id)) });
export const journalDeletedSchema = z.object({ deleted: z.literal(true), id: uuid });
export const journalPolicySavedSchema = z.object({ saved: z.literal(true) });
export type JournalRecord = z.infer<typeof journalSchema>;
export type JournalEligible = z.infer<typeof eligibleJournalsSchema>["items"][number];
export type JournalBlock = z.infer<typeof journalBlocksSchema>["items"][number];
export type JournalOptions = z.infer<typeof journalOptionsSchema>;
export function readJournalResponse<T>(schema: z.ZodType<T>, raw: unknown): T {
    const result = schema.safeParse(raw);
    if (!result.success)
        throw new ApiRequestError("INVALID_RESPONSE", "Format data jurnal belum sesuai. Muat ulang dan periksa data sebelum melanjutkan.");
    return result.data;
}
export function journalEligibilityText(code: string | null) {
    const labels: Record<string, string> = {
        H1_DISABLED: "Input H-1 belum diaktifkan administrator.", H1_NOT_CONFIRMED: "Konfirmasi kegiatan kemarin belum tersedia.",
        NO_ACTIVE_CONFIRMATION: "Menunggu konfirmasi kegiatan.", DATE_EXPIRED: "Batas input sudah berakhir.",
        FUTURE_DATE: "Tanggal kegiatan belum tiba.", JOURNAL_BLOCKED: "Input diblokir. Hubungi administrator untuk memeriksa kebijakannya.",
        FINAL_PERIOD: "Periode honorarium sudah final.", NOT_FOUND: "Kegiatan tidak tersedia untuk akun ini.",
    };
    return code && Object.hasOwn(labels, code) ? labels[code]! : "Kegiatan belum memenuhi syarat input.";
}
