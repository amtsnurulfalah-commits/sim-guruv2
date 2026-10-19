import { z } from "zod";
export const usernameSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9._-]{3,64}$/)
  .transform((v) => v.toLowerCase());
const password = z
  .string()
  .min(1)
  .max(256)
  .refine((v) => Array.from(v).length <= 128);
export const changePasswordSchema = z
  .object({
    currentPassword: password,
    newPassword: password,
    confirmation: password,
  })
  .strict()
  .refine((v) => v.newPassword === v.confirmation);
export const questionSchema = z
  .object({
    currentPassword: password,
    question: z.string().trim().min(5).max(300),
    answer: z.string().trim().min(3).max(128),
  })
  .strict();
export const profileSchema = z
  .object({
    currentPassword: password,
    version: z.string().regex(/^[1-9]\d{0,17}$/),
    username: usernameSchema,
    fullName: z.string().trim().min(1).max(200),
    nip: z.string().trim().max(64),
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
  })
  .strict();
export const emailRequestSchema = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    currentPassword: password,
  })
  .strict();
export const verifyOtpSchema = z
  .object({ challengeId: z.uuid(), otp: z.string().regex(/^\d{6}$/) })
  .strict();
export const forgotSchema = z
  .object({
    username: usernameSchema,
    method: z.enum(["email", "admin", "security"]),
    answer: z.string().max(128).optional(),
    reason: z.preprocess(
      (v) => (typeof v === "string" && !v.trim() ? undefined : v),
      z.string().trim().min(5).max(500).optional(),
    ),
  })
  .strict();
export const resetSchema = z
  .object({
    challengeId: z.uuid(),
    token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    newPassword: password,
    confirmation: password,
  })
  .strict()
  .refine((v) => v.newPassword === v.confirmation);
export const activationSchema = z
  .object({
    challengeId: z.uuid(),
    token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    newPassword: password,
    confirmation: password,
  })
  .strict()
  .refine((v) => v.newPassword === v.confirmation);
export const approvalSchema = z
  .object({
    requestId: z.uuid(),
    currentPassword: password,
    method: z.enum(["tatap_muka", "dokumen_dan_panggilan"]),
    evidence: z.string().trim().min(5).max(300),
    reason: z.string().trim().min(5).max(500),
  })
  .strict();
export type ProfileDto = {
  id: string;
  username: string;
  fullName: string;
  nip: string;
  phone: string;
  address: string;
  photoUrl: string;
  email: string;
  emailVerified: boolean;
  question: string;
  version: string;
};
