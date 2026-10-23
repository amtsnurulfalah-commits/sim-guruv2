import { z } from "zod";
export type SupportEvent = { requestId: string; occurredAt: string; module: string; code: string; status: number };
export function supportEvent(requestId: string, module: string, code: string, status: number): SupportEvent {
  return { requestId, occurredAt: new Date().toISOString(), module: /^[a-z-]{1,40}$/.test(module) ? module : "unknown", code: /^[A-Z0-9_]{1,80}$/.test(code) ? code : "INTERNAL_ERROR", status };
}

/** Match the lookup endpoint and the database metadata contract before rendering. */
export const supportReferenceSchema = z.uuid();
export const supportLookupSchema = z.object({
  requestId: supportReferenceSchema,
  occurredAt: z.iso.datetime({ offset: true }).refine(value => Number.isFinite(Date.parse(value))),
  module: z.string().regex(/^[a-z-]{1,40}$/),
  code: z.string().regex(/^[A-Z0-9_]{1,80}$/),
  status: z.number().int().min(400).max(599),
}).strict().nullable();
