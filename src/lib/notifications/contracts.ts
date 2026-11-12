import { z } from "zod";

export const categories = ["announcement", "task", "assignment", "honor", "system"] as const;
export const routes = ["inbox", "tasks", "journal", "attendance", "duty", "exam", "event", "honor", "dashboard"] as const;
const version = z.string().regex(/^(0|[1-9][0-9]{0,18})$/);
const time = z.string().regex(/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/);

export const notificationEvent = z.object({
  schemaVersion: z.literal(1),
  eventKey: z.string().min(1).max(300),
  recipientId: z.uuid(),
  category: z.enum(categories),
  sourceType: z.string().regex(/^[a-z_]{1,50}$/),
  sourceId: z.uuid().nullable(),
  sourceVersion: version.refine(v => v !== "0"),
  routeKey: z.enum(routes),
  occurredAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
}).strict().refine(v => Date.parse(v.expiresAt) > Date.parse(v.occurredAt), "EXPIRY_INVALID");

export const pushSubscription = z.object({
  endpoint: z.url().max(4096).refine(v => {
    const u = URL.parse(v);
    return u?.protocol === "https:" && !u.username && !u.password && !u.hash && !u.port;
  }),
  keys: z.object({
    p256dh: z.string().regex(/^[A-Za-z0-9_-]{87}$/),
    auth: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
  }).strict(),
}).strict();

export const subscribeInput = z.object({
  installationId: z.uuid(),
  requestId: z.uuid(),
  version,
  label: z.string().trim().min(1).max(80),
  subscription: pushSubscription,
}).strict();
export const unsubscribeInput = z.object({ installationId: z.uuid() }).strict();
export const pushTestInput = unsubscribeInput;
export const pushPreferences = z.object({
  version,
  pushEnabled: z.boolean(),
  reminderPush: z.boolean(),
  categories: z.array(z.enum(categories)).max(5).refine(v => new Set(v).size === v.length),
  quietStart: time,
  quietEnd: time,
  timezone: z.literal("Asia/Jakarta"),
}).strict();
export const pushDevice = z.object({
  id: z.uuid(), label: z.string(), version,
  lastSeenAt: z.iso.datetime({ offset: true }),
  revokedAt: z.iso.datetime({ offset: true }).nullable(),
}).strict();

export const deliveryStates = ["pending", "sending", "accepted", "retry_wait", "failed", "unknown", "cancelled", "expired"] as const;
export type PushResult =
  | { kind: "accepted" }
  | { kind: "retry"; retryAfterSeconds?: number }
  | { kind: "invalid_destination" | "configuration_error" | "failed" };
