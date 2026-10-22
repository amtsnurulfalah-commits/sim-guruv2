import { z } from "zod";
import { scheduleData } from "./schemas";
import { date } from "../masters/schemas";
import { ApiRequestError } from "../feedback/api-error";
const time=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,6})?)?$/);
const count=z.number().int().nonnegative(),version=z.string().regex(/^[1-9]\d{0,17}$/);
export const scheduleRowSchema=scheduleData.safeExtend({
  id:z.uuid(),timeEnd:time,minutesPerJtm:z.number().int().min(1).max(180),version,
  state:z.enum(["active","closed","archived"]),teacherName:z.string(),subjectName:z.string(),className:z.string(),periodLabel:z.string(),replacesId:z.uuid().nullable(),
});
export const scheduleListSchema=z.object({items:z.array(scheduleRowSchema).max(100),total:count,page:z.number().int().positive().max(100000),pageSize:z.number().int().min(1).max(100)});
export const recapSchema=z.object({rowCount:count,totalScheduledJtm:z.string().regex(/^\d+(\.\d{1,4})?$/)});
export const dailySchema=z.object({items:z.array(scheduleRowSchema),scheduledCount:count,dayContext:z.object({date,isHoliday:z.boolean(),kbmEnabled:z.boolean()})});
export const collisionSchema=z.object({conflicts:z.array(z.object({id:z.uuid(),teacher:z.boolean(),class:z.boolean(),dayIndex:z.number().int().min(0).max(6),timeStart:time,timeEnd:time,validFrom:date,validTo:date})),timeEnd:time,minutesPerJtm:z.number().int().min(1).max(180)});
export const bulkPreviewSchema=z.object({previewId:z.uuid(),expiresAt:z.iso.datetime({offset:true}),count:count,items:z.array(z.object({id:z.uuid(),teacherName:z.string(),className:z.string(),validFrom:date,validTo:date,stopFrom:date,operation:z.enum(["archive","close"])})).min(1).max(100)}).refine(v=>v.count===v.items.length);
export const historySchema=z.array(z.object({actor_name:z.string().nullable(),reason:z.string().nullable(),created_at:z.iso.datetime({offset:true}),new_data:z.record(z.string(),z.unknown()).nullable()}));
export const choiceListSchema=z.object({items:z.array(z.object({id:z.uuid(),fullName:z.string().nullish(),name:z.string().nullish(),label:z.string().nullish(),parentLabel:z.string().nullish(),semester:z.number().nullish()}).passthrough()).max(100),total:count});
/** Reject malformed successful envelopes before rendering or authorizing a UI step. */
export function readScheduleResponse<T>(schema:z.ZodType<T>,raw:unknown):T {
  const parsed=schema.safeParse(raw);
  if(!parsed.success)throw new ApiRequestError("INVALID_RESPONSE","Data jadwal belum sesuai format. Muat ulang data sebelum melanjutkan.");
  return parsed.data;
}
export function canChangeSchedule(row:{state:string;validTo:string},today:string){return row.state==="active"&&row.validTo>=today;}
