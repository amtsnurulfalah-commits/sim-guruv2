import { z } from "zod";
import { DomainDecimal } from "@/lib/decimal";
export const versionSchema = z.string().regex(/^[1-9]\d{0,17}$/);
const password = z
  .string()
  .min(1)
  .max(256)
  .refine((v) => Array.from(v).length <= 128);
const reason = z.string().trim().min(5).max(500);
export const userProfileSchema = z
  .object({
    username: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9._-]{3,64}$/)
      .transform((v) => v.toLowerCase()),
    fullName: z.string().trim().min(1).max(200),
    nip: z.string().trim().max(64),
    role: z.enum(["admin", "guru"]),
    email: z
      .union([z.literal(""), z.email().max(254)])
      .transform((v) => v.toLowerCase()),
    phone: z
      .string()
      .trim()
      .max(25)
      .transform((v) => v.replace(/[\s()-]/gu, "").replace(/^0/u, "+62"))
      .refine((v) => !v || /^\+?[1-9]\d{5,19}$/u.test(v)),
    address: z.string().trim().max(500),
    photoUrl: z.union([
      z.literal(""),
      z
        .url()
        .max(2048)
        .refine((v) => {
          const u = new URL(v);
          return u.protocol === "https:" && !u.username && !u.password;
        }),
    ]),
    employmentStatus: z.string().trim().max(100),
    rank: z.string().trim().max(100),
    kmDistance: z
      .string()
      .regex(/^\d{1,3}(\.\d{1,2})?$/)
      .refine((v) => new DomainDecimal(v).lte("999.99"))
      .transform((v) => new DomainDecimal(v).toFixed(2)),
    additionalRole: z.enum(["", "KEPALA_SEKOLAH"]),
  })
  .strict();
const verification = {
  method: z.enum(["tatap_muka", "dokumen_dan_panggilan"]),
  evidence: z.string().trim().min(5).max(300),
};
export const createUserSchema = userProfileSchema
  .extend({
    currentPassword: password,
    reason,
    delivery: z.enum(["activation", "handover"]),
    method: verification.method.optional(),
    evidence: verification.evidence.optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.delivery === "activation" && !v.email)
      ctx.addIssue({
        code: "custom",
        path: ["email"],
        message: "Email aktivasi wajib.",
      });
    if (v.delivery === "handover" && (!v.method || !v.evidence))
      ctx.addIssue({
        code: "custom",
        path: ["evidence"],
        message: "Verifikasi identitas diperlukan.",
      });
  });
export const editUserSchema = userProfileSchema
  .extend({ version: versionSchema, currentPassword: password, reason })
  .strict();
export const statusSchema = z
  .object({
    version: versionSchema,
    status: z.enum(["active", "disabled", "archived"]),
    currentPassword: password,
    reason,
  })
  .strict();
export const activationRequestSchema = z
  .object({ version: versionSchema, currentPassword: password, reason })
  .strict();
export const recoverySchema = z
  .object({
    version: versionSchema,
    requestId: z.uuid(),
    currentPassword: password,
    reason,
    ...verification,
  })
  .strict();
export const rejectRecoverySchema = z
  .object({
    action: z.literal("reject"),
    requestId: z.uuid(),
    currentPassword: password,
    reason,
  })
  .strict();
export const approveRecoverySchema = recoverySchema
  .extend({ action: z.literal("approve"), targetId: z.uuid() })
  .strict();
export const listUsersSchema = z
  .object({
    q: z.string().trim().max(100).default(""),
    role: z.enum(["", "admin", "guru"]).default(""),
    status: z
      .enum(["", "pending_activation", "active", "disabled", "archived"])
      .default(""),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export type UserProfileInput = z.input<typeof userProfileSchema>;
export type UserDto = UserProfileInput & {
  id: string;
  version: string;
  status: "pending_activation" | "active" | "disabled" | "archived";
  emailVerified: boolean;
  mustChangePassword: boolean;
  securityQuestionReady: boolean;
  temporaryExpiresAt: string | null;
  createdAt: string;
};
export type UserList = {
  items: UserDto[];
  total: number;
  page: number;
  pageSize: number;
};
export type RecoveryRequest = {
  id: string;
  userId: string;
  version: string;
  username: string;
  fullName: string;
  createdAt: string;
  reason: string | null;
};
export const userStatusLabels: Record<UserDto["status"], string> = {
  pending_activation: "Menunggu aktivasi",
  active: "Aktif",
  disabled: "Nonaktif",
  archived: "Diarsipkan",
};

/** Validate the public pending-request DTO before rendering decisions. */
export const recoveryRequestsSchema = z.array(z.object({
  id: z.uuid(), userId: z.uuid(), version: versionSchema,
  username: z.string(), fullName: z.string(), createdAt: z.iso.datetime({offset:true}),
  reason: z.string().nullable(),
})).max(100);
