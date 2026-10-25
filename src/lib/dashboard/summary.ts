import { z } from "zod";
const count = z.number().int().nonnegative();
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?$/);
export const summarySchema = z.object({
  date: z.iso.date(),
  planned: z.array(z.object({ id: z.string(), kind: z.string(), time_start: time, time_end: time })),
  pendingEventJournals: count,
  tasks: z.array(z.object({ id: z.string(), kind: z.string(), start: time, end: time, confirmed: z.boolean(), journalComplete: z.boolean() })),
  attendance: z.object({ actualIn: time.nullable(), actualOut: time.nullable() }).nullable(),
  honor: z.object({ total: z.string().regex(/^-?\d+(?:\.\d+)?$/), totalJtm: z.string().regex(/^\d+(?:\.\d+)?$/), rateMissing: z.boolean() }),
  pendingHolidays: count,
  admin: z.object({ activeUsers: count, failedMessages: count, failedJobs: count }).nullable(),
}).refine(value => new Set(value.tasks.map(item => item.id)).size === value.tasks.length && new Set(value.planned.map(item => item.id)).size === value.planned.length, "Duplicate dashboard IDs");
export type Summary = z.infer<typeof summarySchema>;
const labels: Record<string,string> = {KBM:"Mengajar",PIKET:"Piket",UPACARA:"Upacara",EXAM_SUPERVISOR:"Pengawas ujian",EXAM_COMMITTEE:"Panitia ujian",EVENT:"Acara"};
export const activityLabel = (kind: string) => Object.hasOwn(labels,kind) ? labels[kind]! : "Kegiatan lainnya";
/** Format decimal strings without converting large financial amounts to a lossy Number. */
export function rupiah(total: string) { return "Rp " + total.split(".")[0]!.replace(/\B(?=(\d{3})+(?!\d))/g,"."); }

export function dashboardRows(value: Summary | null) {
  if (!value) return [];
  return [
    ...value.planned.map(task => ({
      key: "planned-" + task.id,
      kind: task.kind,
      start: task.time_start,
      end: task.time_end,
      status: "Terjadwal, belum tercatat",
    })),
    ...value.tasks.map(task => ({
      key: "task-" + task.id,
      kind: task.kind,
      start: task.start,
      end: task.end,
      status: (task.confirmed ? "Terkonfirmasi" : "Menunggu konfirmasi") +
        (pendingJournal(task) ? " · Jurnal/BAP belum lengkap" : ""),
    })),
  ].sort((a,b) => a.start.localeCompare(b.start) || a.key.localeCompare(b.key));
}

export function pendingJournal(task: Summary["tasks"][number]) {
  return task.confirmed && !task.journalComplete && ["KBM", "EXAM_SUPERVISOR"].includes(task.kind);
}
export function readDashboardSummary(raw: unknown, date: string, account: {id: string; role: "admin" | "guru"}) {
  const parsed = z.object({date: z.iso.date(), user: z.object({id: z.uuid(), role: z.enum(["admin", "guru"])}), summary: summarySchema}).safeParse(raw);
  if (!parsed.success || parsed.data.date !== date || parsed.data.summary.date !== date || parsed.data.user.id !== account.id || parsed.data.user.role !== account.role || (account.role !== "admin" && parsed.data.summary.admin !== null))
    throw Error("Layanan ringkasan mengirim data yang belum sesuai. Coba muat ulang; jika berulang, hubungi administrator.");
  return parsed.data.summary;
}
export function activityHref(kind: string, date: string) {
  const path = kind === "KBM" ? "/jurnal" : kind === "EXAM_SUPERVISOR" ? "/ujian/bap" : ["PIKET", "UPACARA"].includes(kind) ? "/piket" : kind === "EVENT" ? "/acara/jurnal" : "/kegiatan";
  return path + "?date=" + encodeURIComponent(date);
}
