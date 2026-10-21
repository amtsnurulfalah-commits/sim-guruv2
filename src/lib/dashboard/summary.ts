import { z } from "zod";
const count = z.number().int().nonnegative();
const time = z.string().regex(/^\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/);
export const summarySchema = z.object({
  date: z.iso.date(),
  planned: z.array(z.object({ id: z.string(), kind: z.string(), time_start: time, time_end: time })),
  pendingEventJournals: count,
  tasks: z.array(z.object({ id: z.string(), kind: z.string(), start: time, end: time, confirmed: z.boolean(), journalComplete: z.boolean() })),
  attendance: z.object({ actualIn: time.nullable(), actualOut: time.nullable() }).nullable(),
  honor: z.object({ total: z.string().regex(/^-?\d+(?:\.\d+)?$/), totalJtm: z.string(), rateMissing: z.boolean() }),
  pendingHolidays: count,
  admin: z.object({ activeUsers: count, failedMessages: count, failedJobs: count }).nullable(),
});
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
        (task.confirmed && !task.journalComplete ? " · Jurnal/BAP belum lengkap" : ""),
    })),
  ].sort((a,b) => a.start.localeCompare(b.start) || a.key.localeCompare(b.key));
}
