import { z } from "zod";
import { ApiRequestError } from "../feedback/api-error";
const version = z.union([z.number().int().positive().refine(Number.isSafeInteger), z.string().regex(/^[1-9]\d{0,17}$/)]).transform(String);
const link = z.url().refine(v => { let u: URL; try {
    u = new URL(v);
}
catch {
    return false;
} return ["http:", "https:"].includes(u.protocol) && !u.username && !u.password && !/[\s@\\]/.test(v); }).nullable();
const base = z.object({ id: z.uuid(), title: z.string(), body: z.string(), severity: z.enum(["info", "success", "warning", "critical"]), version, cta_url: link, cta_text: z.string().nullable() });
export const visibleAnnouncementsSchema = z.array(base.extend({ canDismiss: z.boolean() }));
export const managedAnnouncementsSchema = z.array(base.extend({
    active: z.boolean(), date_start: z.iso.date().nullable(), date_end: z.iso.date().nullable(), target_role: z.enum(["all", "guru", "admin"]), target_users: z.array(z.uuid()), allow_dismiss: z.array(z.uuid()), deny_dismiss: z.array(z.uuid()), dismissible: z.boolean(), send_email: z.boolean(), reminder_offsets: z.array(z.number().int().min(1).max(3)), recipientNames: z.record(z.string(), z.string()).optional(),
}));
export const announcementSavedSchema = z.object({ id: z.uuid(), version: z.string().regex(/^[1-9]\d{0,17}$/) });
export const announcementDismissedSchema = z.object({}).strict();
export const recipientListSchema = z.object({ items: z.array(z.object({ id: z.uuid(), fullName: z.string(), username: z.string() })), total: z.number().int().nonnegative(), page: z.number().int().positive(), pageSize: z.number().int().positive() });
export type ManagedAnnouncement = z.infer<typeof managedAnnouncementsSchema>[number];
export function readAnnouncementResponse<T>(schema: z.ZodType<T>, raw: unknown): T {
    const result = schema.safeParse(raw);
    if (!result.success)
        throw new ApiRequestError("INVALID_RESPONSE", "Format data pengumuman belum sesuai. Muat ulang atau hubungi administrator.");
    return result.data;
}
