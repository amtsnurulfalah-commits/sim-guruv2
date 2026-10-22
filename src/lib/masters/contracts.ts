import { z } from "zod";
// Read contracts validate transport shape without reapplying current write policy
// to historical records (which can legitimately be archived or no longer editable).
export const masterRowSchema = z.object({
  id: z.uuid(), version: z.string().regex(/^[1-9]\d{0,17}$/),
  archivedAt: z.string().nullable(), parentLabel: z.string().nullish(),
}).passthrough();
export const masterListSchema = z.object({
  items: z.array(masterRowSchema), total: z.number().int().nonnegative(),
  page: z.number().int().positive(), pageSize: z.number().int().positive(),
});
export const masterHistorySchema = z.array(z.object({
  actor_id: z.uuid(), actor_name: z.string().nullish(), reason: z.string(),
  created_at: z.string().refine(v => Number.isFinite(Date.parse(v))),
  old_data: z.record(z.string(), z.unknown()).nullable(),
  new_data: z.record(z.string(), z.unknown()),
}));
