import { z } from "zod";
const href = z
  .string()
  .regex(
    /^\/(?:jurnal|kehadiran|piket|absensi-siswa\/input|ujian(?:\/bap)?|acara\/jurnal|kegiatan|admin\/operasional)(?:\?date=\d{4}-\d{2}-\d{2})?$/,
  );
const taskSchema = z.object({
  id: z.string().trim().min(1),
  source_id: z.string().trim().min(1),
  kind: z.enum(["journal", "bap", "event", "confirmation", "operations", "attendance", "students", "assignment"]),
  title: z.string().trim().min(1),
  reason: z.string().trim().min(1),
  date: z.iso.date(),
  deadline: z.iso.datetime({ offset: true }).nullable(),
  href,
  blocked: z.boolean(),
}).refine(task => {
  const [path, query] = task.href.split("?");
  const paths: Record<string, string[]> = {
    journal: ["/jurnal"], bap: ["/ujian/bap"], event: ["/acara/jurnal"],
    confirmation: ["/kegiatan", "/piket", "/ujian"], attendance: ["/kehadiran"],
    students: ["/absensi-siswa/input"], assignment: ["/piket", "/ujian"], operations: ["/admin/operasional"],
  };
  const date = new URLSearchParams(query).get("date");
  return paths[task.kind]!.includes(path!) && (date === null || date === task.date);
}, "Task source link does not match its kind or date");
export const tasksSchema = z.object({
  date: z.iso.date(),
  generatedAt: z.iso.datetime({ offset: true }),
  items: z.array(taskSchema).refine(items => new Set(items.map(item => item.id)).size === items.length, "Duplicate task IDs"),
});
export type Task = z.infer<typeof tasksSchema>["items"][number];
export const inboxQuery = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    unread: z.enum(["true", "false"]).default("false"),
  })
  .strict();
export const preferenceCommand = z
  .object({
    version: z.string().regex(/^(0|[1-9]\d{0,17})$/),
    emailEnabled: z.boolean(),
    reminderEmail: z.boolean(),
  })
  .strict();
export const readCommand = z.object({ id: z.uuid() }).strict();
export const inboxSchema = z.object({
  preferences: preferenceCommand,
  total: z.number().int().nonnegative(),
  unread: z.number().int().nonnegative(),
  items: z.array(
    z.object({
      id: z.uuid(),
      subject: z.string(),
      body: z.string(),
      state: z.enum([
        "pending",
        "sending",
        "sent",
        "retry_wait",
        "failed",
        "unknown",
        "cancelled",
      ]),
      created_at: z.iso.datetime({ offset: true }),
      read: z.boolean(),
      href: z.enum(["/tugas", "/honorarium", "/dashboard"]),
    }),
  ),
});
export const taskPriority = (task: Task, now = Date.now()) =>
  task.blocked
    ? "Perlu prasyarat"
    : task.kind === "operations"
      ? "Segera"
      : task.deadline && Date.parse(task.deadline) <= now
        ? "Batas waktu terlewati"
        : task.deadline && Date.parse(task.deadline) - now <= 86400000
        ? "Segera"
        : "Berikutnya";
