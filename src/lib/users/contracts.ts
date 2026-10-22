import { z } from "zod";
import { versionSchema } from "./schemas";
export const userDtoSchema=z.object({
 id:z.uuid(),version:versionSchema,username:z.string(),fullName:z.string(),nip:z.string(),role:z.enum(["admin","guru"]),
 email:z.string(),phone:z.string(),address:z.string(),photoUrl:z.string(),employmentStatus:z.string(),rank:z.string(),
 kmDistance:z.string().regex(/^\d+(\.\d{1,2})?$/),additionalRole:z.enum(["","KEPALA_SEKOLAH"]),
 status:z.enum(["pending_activation","active","disabled","archived"]),emailVerified:z.boolean(),mustChangePassword:z.boolean(),securityQuestionReady:z.boolean(),
 temporaryExpiresAt:z.iso.datetime({offset:true}).nullable(),createdAt:z.iso.datetime({offset:true}),
});
export const userListSchema=z.object({items:z.array(userDtoSchema).max(100),total:z.number().int().nonnegative(),page:z.number().int().min(1).max(100000),pageSize:z.number().int().min(1).max(100)});
export const userMutationSchema=z.object({user:userDtoSchema,selfAffected:z.boolean().optional(),delivery:z.enum(["queued","handover"]).optional(),temporaryPassword:z.string().min(1).optional(),expiresInHours:z.number().positive().optional()});
