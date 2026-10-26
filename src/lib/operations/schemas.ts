import { z } from "zod";
const reason = z.string().trim().min(5).max(500);
const version = z.string().regex(/^[1-9][0-9]*$/);
const id = z.string().uuid();
const date = z.iso.date().nullable().default(null);
const url = z
  .string()
  .url()
  .max(2000)
  .refine((v) => {
    let u: URL;
    try { u = new URL(v); } catch { return false; }
    return (
      ["http:", "https:"].includes(u.protocol) &&
      !u.username &&
      !u.password &&
      !/[\s@\\]/.test(v)
    );
  }, { message: "Gunakan URL HTTP atau HTTPS tanpa kredensial atau spasi." })
  .nullable()
  .default(null);
export const operationsConfigSchema = z
  .object({
    mailEnabled: z.boolean(),
    securityMailEnabled: z.boolean().default(false),
    jobsEnabled: z.boolean(),
    maintenance: z.boolean(),
    maintenanceStart: z.iso.datetime({ offset: true }).nullable(),
    maintenanceEnd: z.iso.datetime({ offset: true }).nullable(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.maintenanceStart && !v.maintenanceEnd)
      ctx.addIssue({ code: "custom", path: ["maintenanceEnd"], message: "Isi waktu selesai pemeliharaan atau kosongkan kedua waktu." });
    if (!v.maintenanceStart && v.maintenanceEnd)
      ctx.addIssue({ code: "custom", path: ["maintenanceStart"], message: "Isi waktu mulai pemeliharaan atau kosongkan kedua waktu." });
    if (v.maintenanceStart && v.maintenanceEnd && Date.parse(v.maintenanceStart) >= Date.parse(v.maintenanceEnd))
      ctx.addIssue({ code: "custom", path: ["maintenanceEnd"], message: "Waktu selesai harus setelah waktu mulai pemeliharaan." });
  });

export const commands = {
  "job-retry": z.object({ key: z.string().min(1).max(150), reason }).strict(),
  save: z
    .object({
      id: id.nullable().default(null),
      version: version.nullable().default(null),
      title: z.string().trim().min(1).max(200),
      body: z.string().trim().min(1).max(5000),
      severity: z.enum(["info", "success", "warning", "critical"]),
      active: z.boolean(),
      from: date,
      to: date,
      targetRole: z.enum(["all", "guru", "admin"]),
      targetUsers: z.array(id).max(1000).default([]),
      dismissible: z.boolean(),
      allowDismiss: z.array(id).max(1000).default([]),
      denyDismiss: z.array(id).max(1000).default([]),
      ctaText: z.string().trim().min(1).max(100).nullable().default(null),
      ctaUrl: url,
      sendEmail: z.boolean(),
      reminderOffsets: z
        .array(z.union([z.literal(1), z.literal(2), z.literal(3)]))
        .max(3)
        .default([]),
      reason,
    })
    .strict()
    .superRefine((v, ctx) => {
      if (v.id && !v.version) ctx.addIssue({ code: "custom", path: ["version"], message: "Versi pengumuman wajib tersedia." });
      if (v.from && v.to && v.to < v.from) ctx.addIssue({ code: "custom", path: ["to"], message: "Tanggal akhir harus setelah atau sama dengan tanggal mulai." });
      if (!!v.ctaText !== !!v.ctaUrl) ctx.addIssue({ code: "custom", path: [v.ctaText ? "ctaUrl" : "ctaText"], message: "Isi teks dan URL tautan bersama-sama." });
      if (v.allowDismiss.some(u => v.denyDismiss.includes(u))) ctx.addIssue({ code: "custom", path: ["denyDismiss"], message: "Pengguna yang sama tidak boleh berada pada kedua pengecualian." });
    }),
  deactivate: z.object({ id, version, reason }).strict(),
  dismiss: z.object({ id, version }).strict(),
  settings: z.object({ version, config: operationsConfigSchema, reason }).strict(),
  retry: z.object({ id, reason }).strict(),
  reconcile: z.object({ id, sent: z.boolean(), reason }).strict(),
};
export type Announcement = {
  recipientNames?: Record<string, string>;
  id: string;
  title: string;
  body: string;
  severity: string;
  version: number;
  active: boolean;
  date_start: string | null;
  date_end: string | null;
  target_role: string;
  target_users: string[];
  allow_dismiss: string[];
  deny_dismiss: string[];
  dismissible: boolean;
  cta_text: string | null;
  cta_url: string | null;
  send_email: boolean;
  reminder_offsets: number[];
  canDismiss?: boolean;
};
export type Operations = {
  config: { value: z.infer<typeof operationsConfigSchema>; version: string };
  maintenanceActive: boolean;
  lastWorkerAt: string | null;
  outbox: {
    id: string;
    state: string;
    attempts: number;
    next_attempt_at: string;
  }[];
  jobs: {
    result?: {code?: string | undefined} | undefined;
    completed_at?: string | null | undefined;
    next_attempt_at?: string | undefined;
    business_key: string;
    state: string;
    kind: string;
    attempts: number;
  }[];
};
