import { z } from "zod";

const flag = z.enum(["false", "true"]).default("false");
export const pushConfigSchema = z.object({
  PUSH_REGISTRATION_ENABLED: flag,
  PUSH_EVENTS_ENABLED: flag,
  PUSH_FANOUT_ENABLED: flag,
  PUSH_DELIVERY_ENABLED: flag,
  PUSH_ENVIRONMENT: z.enum(["development", "staging", "production"]).default("development"),
  PUSH_PILOT_USER_IDS: z.string().default(""),
  PUSH_VAPID_KEY_ID: z.string().optional(),
  PUSH_VAPID_PUBLIC_KEY: z.string().optional(),
  PUSH_VAPID_PRIVATE_KEY: z.string().optional(),
  PUSH_VAPID_SUBJECT: z.string().optional(),
  PUSH_ENCRYPTION_KEY_ID: z.string().optional(),
  PUSH_ENCRYPTION_KEY: z.string().optional(),
}).superRefine((v, ctx) => {
  if (![v.PUSH_REGISTRATION_ENABLED, v.PUSH_EVENTS_ENABLED, v.PUSH_FANOUT_ENABLED, v.PUSH_DELIVERY_ENABLED].includes("true")) return;
  const checks = {
    PUSH_PILOT_USER_IDS: v.PUSH_PILOT_USER_IDS.split(",").every(id => z.uuid().safeParse(id.trim()).success),
    PUSH_VAPID_KEY_ID: /^[a-zA-Z0-9_-]{1,50}$/.test(v.PUSH_VAPID_KEY_ID ?? ""),
    PUSH_VAPID_PUBLIC_KEY: /^[A-Za-z0-9_-]{87}$/.test(v.PUSH_VAPID_PUBLIC_KEY ?? ""),
    PUSH_VAPID_PRIVATE_KEY: /^[A-Za-z0-9_-]{43}$/.test(v.PUSH_VAPID_PRIVATE_KEY ?? ""),
    PUSH_VAPID_SUBJECT: /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.PUSH_VAPID_SUBJECT ?? ""),
    PUSH_ENCRYPTION_KEY_ID: /^[a-zA-Z0-9_-]{1,50}$/.test(v.PUSH_ENCRYPTION_KEY_ID ?? ""),
    PUSH_ENCRYPTION_KEY: /^[a-f0-9]{64}$/i.test(v.PUSH_ENCRYPTION_KEY ?? ""),
    PUSH_EVENTS_ENABLED: v.PUSH_FANOUT_ENABLED === "false" || v.PUSH_EVENTS_ENABLED === "true",
    PUSH_FANOUT_ENABLED: v.PUSH_DELIVERY_ENABLED === "false" || v.PUSH_FANOUT_ENABLED === "true",
  };
  for (const [field, valid] of Object.entries(checks)) {
    if (!valid) ctx.addIssue({ code: "custom", path: [field], message: "INVALID_PUSH_CONFIG" });
  }
});
