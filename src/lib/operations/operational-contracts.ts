import { z } from "zod";
import { ApiRequestError } from "../feedback/api-error";
import { operationsConfigSchema } from "./schemas";
const timestamp = z.iso.datetime({ offset: true });
const version = z.string().regex(/^[1-9]\d{0,18}$/);
export const operationsSchema = z.object({
    config: z.object({ value: operationsConfigSchema, version }),
    maintenanceActive: z.boolean(),
    lastWorkerAt: timestamp.nullable(),
    outbox: z.array(z.object({
        id: z.uuid(), state: z.enum(["pending", "sending", "sent", "retry_wait", "failed", "unknown", "cancelled"]),
        attempts: z.number().int().min(0).max(5), next_attempt_at: timestamp,
    })).max(100),
    jobs: z.array(z.object({
        result: z.object({code: z.string().regex(/^[A-Z0-9_]{1,80}$/).optional()}).optional(),
        completed_at: timestamp.nullable().optional(), next_attempt_at: timestamp.optional(),
        business_key: z.string().min(1), kind: z.string().min(1),
        state: z.enum(["pending", "running", "completed", "failed", "paused"]), attempts: z.number().int().nonnegative(),
    })).max(100),
});
export const settingsSavedSchema = z.object({ id: z.null(), version });
export const emailUpdatedSchema = z.object({ id: z.uuid(), version: z.null() });
export const jobRetriedSchema = z.object({ id: z.null(), version: z.null() });
export function readOperationsResponse<T>(schema: z.ZodType<T>, raw: unknown): T {
    const result = schema.safeParse(raw);
    if (!result.success)
        throw new ApiRequestError("INVALID_RESPONSE", "Format data operasional belum sesuai. Muat ulang dan periksa data sebelum melanjutkan.");
    return result.data;
}
/** datetime-local values always represent WIB, independently of the device timezone. */
export function toWibInput(value: string | null): string {
    return value ? new Date(Date.parse(value) + 7 * 60 * 60 * 1000).toISOString().slice(0, -1) : "";
}
export function fromWibInput(value: string): string | null {
    return value ? value.replace(/(T\d{2}:\d{2})$/, "$1:00") + "+07:00" : null;
}
export function formatOperationalTime(value: string): string {
    return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(value));
}
