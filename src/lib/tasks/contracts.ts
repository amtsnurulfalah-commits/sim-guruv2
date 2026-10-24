import { z } from "zod";
const href = z
  .string()
  .regex(
    /^\/(?:jurnal|kehadiran|piket|absensi-siswa\/input|ujian(?:\/bap)?|acara\/jurnal|kegiatan|admin\/operasional)(?:\?date=\d{4}-\d{2}-\d{2})?$/,
  );
export const tasksSchema = z.object({
  date: z.iso.date(),
  generatedAt: z.iso.datetime({ offset: true }),
  items: z.array(
    z.object({
      id: z.string().min(1),
      source_id: z.string().min(1),
      kind: z.enum([
        "journal",
        "bap",
        "event",
        "confirmation",
        "operations",
        "attendance",
        "students",
        "assignment",
      ]),
      title: z.string(),
      reason: z.string(),
      date: z.iso.date(),
      deadline: z.iso.datetime({ offset: true }).nullable(),
      href,
      blocked: z.boolean(),
    }),
  ),
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
      : task.deadline && Date.parse(task.deadline) - now <= 86400000
        ? "Segera"
        : "Berikutnya";
