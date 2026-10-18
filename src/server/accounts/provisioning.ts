import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { SqlDatabase, SqlExecutor } from "../../../scripts/lib/sql-database";
import type { PasswordService } from "../auth/passwords";
import { activationTokenDigest,createActivationToken,encryptActivationToken } from "../auth/activation-secrets";
const identitySchema=z.object({username:z.string().trim().regex(/^[A-Za-z0-9._-]{3,64}$/),fullName:z.string().trim().min(1).max(200)}).strict();
export const bootstrapInputSchema=identitySchema.extend({temporaryPassword:z.string().optional()}).strict();
type BootstrapTarget={user_id:string;full_name:string;role:string;status:string;has_credential:boolean;temporary_expired:boolean};
/** Store harus koneksi dengan grant bootstrap saja, bukan business/auth. */
export async function bootstrapAdmin(database: SqlDatabase,passwords: PasswordService,input: unknown): Promise<{ userId:string;created:boolean }> {
  const value=bootstrapInputSchema.parse(input);
  const probe=await database.query<BootstrapTarget>("select * from auth_private.bootstrap_target($1)",[value.username]);
  const existing=probe.rows[0];
  if(existing){
    if(existing.role!=="admin" || existing.full_name!==value.fullName || existing.status!=="active" || !existing.has_credential || existing.temporary_expired)throw new Error("BOOTSTRAP_RECOVERY_REQUIRED");
    // Recheck rutin SQL dalam lock, tidak mengubah hash. Parameter hash diabaikan hanya untuk target identik yang valid.
    const result=await database.query<{id:string}>("select auth_private.bootstrap_admin($1,$2,null) as id",[value.username,value.fullName]);
    return {userId:result.rows[0]!.id,created:false};
  }
  if(value.temporaryPassword===undefined || Array.from(value.temporaryPassword).length<20)throw new Error("TEMPORARY_PASSWORD_MIN_20");
  const encoded=await passwords.hashNew(value.temporaryPassword,value);
  const result=await database.query<{id:string}>("select auth_private.bootstrap_admin($1,$2,$3) as id",[value.username,value.fullName,encoded]);
  return {userId:result.rows[0]!.id,created:true};
}
const inviteSchema=identitySchema.extend({role:z.enum(["guru","admin"]),email:z.email(),appUrl:z.url().refine((v)=>["http:","https:"].includes(new URL(v).protocol))}).strict();
export type AuthTransactionRunner=<T>(work:(transaction:SqlExecutor)=>Promise<T>)=>Promise<T>;
export class AccountActivationService {
  constructor(private readonly runAuthenticated: AuthTransactionRunner,private readonly authDatabase: SqlExecutor,private readonly passwords: PasswordService,private readonly encryptionKey: string){}
  /** Queue saja; tidak menyatakan email terkirim dan tidak mengembalikan token/url rahasia. */
  async invite(input: unknown):Promise<{userId:string;challengeId:string;outboxId:string;delivery:"queued"}> {
    const value=inviteSchema.parse(input);
    return this.runAuthenticated(async(transaction)=>{
      const created=await transaction.query<{id:string}>("select auth_private.create_account($1,$2,$3,null) as id",[value.username,value.fullName,value.role]);
      const userId=created.rows[0]!.id;
      return this.queue(transaction,userId,value.email,value.appUrl);
    });
  }
  async reissue(userId:string,email:string,appUrl:string){
    z.uuid().parse(userId);z.email().parse(email);z.url().refine((v)=>["http:","https:"].includes(new URL(v).protocol)).parse(appUrl);
    return this.runAuthenticated((transaction)=>this.queue(transaction,userId,email,appUrl));
  }
  private async queue(transaction:SqlExecutor,userId:string,email:string,appUrl:string){
    const challengeId=randomUUID(),outboxId=randomUUID(),secret=createActivationToken();
    const target=email.trim().toLowerCase();
    const cipher=encryptActivationToken(secret.token,this.encryptionKey,{challengeId,outboxId,userId,email:target,keyVersion:1});
    await transaction.query("select auth_private.queue_activation($1,$2,$3,$4,$5,$6,$7,$8,$9)",[userId,target,challengeId,secret.digest,outboxId,cipher.ciphertextHex,cipher.nonceHex,cipher.tagHex,appUrl]);
    return {userId,challengeId,outboxId,delivery:"queued" as const};
  }
  /** Dipanggil endpoint 1.5 setelah rate limit; precheck ulang dikunci atomik oleh complete_activation. */
  async activate(input:{challengeId:string;token:string;newPassword:string}):Promise<{userId:string;requiresOnboarding:true}> {
    const id=z.uuid().parse(input.challengeId),digest=activationTokenDigest(input.token);
    const context=await this.authDatabase.query<{user_id:string;username:string;full_name:string}>("select * from auth_private.activation_context($1,$2)",[id,digest]);
    const user=context.rows[0];if(!user)throw new Error("INVALID_ACTIVATION");
    const encoded=await this.passwords.hashNew(input.newPassword,{username:user.username,fullName:user.full_name});
    const result=await this.authDatabase.query<{id:string}>("select auth_private.complete_activation($1,$2,$3) as id",[id,digest,encoded]);
    return {userId:result.rows[0]!.id,requiresOnboarding:true};
  }
}
