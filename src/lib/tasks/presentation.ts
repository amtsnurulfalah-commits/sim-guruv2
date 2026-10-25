import { journalEligibilityText } from "../activities/journal-contracts";
import type { Task } from "./contracts";

export const taskKinds: Record<Task["kind"], string> = {
  journal: "Jurnal pembelajaran", bap: "Berita acara ujian", event: "Jurnal acara",
  confirmation: "Konfirmasi kegiatan", operations: "Administrasi", attendance: "Kehadiran",
  students: "Absensi siswa", assignment: "Penugasan",
};
export type TaskStatus = "all" | "ready" | "blocked";
export function taskReason(task: Task) {
  if (task.reason === "ATTENDANCE_TIME_INVALID") return "Tunggu sampai lima menit setelah kegiatan selesai.";
  if (task.reason === "STUDENT_ATTENDANCE_MISMATCH") return "Rekap absensi siswa untuk ujian belum lengkap atau belum sesuai. Periksa rekap pada halaman sumber sebelum mengonfirmasi.";
  return /^[A-Z_]+$/.test(task.reason) ? journalEligibilityText(task.reason) : task.reason;
}
/** Keep the server's canonical priority order; filtering never marks a task completed. */
export function filterTasks(items: Task[], status: TaskStatus, kind: string, query: string) {
  const term = query.trim().toLocaleLowerCase("id-ID");
  return items.filter(task =>
    (status === "all" || task.blocked === (status === "blocked")) &&
    (kind === "all" || task.kind === kind) &&
    (!term || `${task.title} ${taskReason(task)} ${taskKinds[task.kind]} ${task.date}`.toLocaleLowerCase("id-ID").includes(term)),
  );
}
