import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes,randomUUID,createHash } from "node:crypto";
import { resolve } from "node:path";
import { openPgliteDatabase } from "../helpers/pglite-database";
import { applyMigrations,readMigrations } from "../../scripts/lib/migrations";
import type { SqlDatabase,SqlExecutor,SqlParameter } from "../../scripts/lib/sql-database";
import { getPasswordService } from "../../src/server/auth/passwords";
import { AccountActivationService,bootstrapAdmin } from "../../src/server/accounts/provisioning";
import { activationTokenDigest,createActivationToken,decryptActivationToken } from "../../src/server/auth/activation-secrets";
const password="V9!aL4#qN8@zR2$kD7&x";
const digest=(value:string)=>createHash("sha256").update(value).digest("hex");
test("Tahap1.3 — lifecycle awal dengan hash nyata + PostgreSQL WASM",async(t)=>{
 const database=await openPgliteDatabase();t.after(()=>database.close());
 await applyMigrations(database,await readMigrations(resolve("supabase/migrations")));
 const passwords=await getPasswordService();
 let context: {userId:string;sessionId:string;tokenHash:string}|null=null;
 function scope(role:"sim_guru_bootstrap"|"sim_guru_auth"|"sim_guru_business",useContext=false):SqlDatabase {
  async function transaction<T>(work:(tx:SqlExecutor)=>Promise<T>):Promise<T>{
   try{return await database.transaction(async(tx)=>{
    await tx.exec(`SET SESSION AUTHORIZATION ${role}`);
    if(useContext&&context)await tx.query("select set_config('app.actor_id',$1,true),set_config('app.session_id',$2,true),set_config('app.request_id',$3,true),set_config('app.session_token_hash',$4,true)",[context.userId,context.sessionId,randomUUID(),context.tokenHash]);
    return work(tx);
   });}finally{await database.exec('SET SESSION AUTHORIZATION postgres; RESET ROLE');}
  }
  return {transaction,exec:(sql)=>transaction((tx)=>tx.exec(sql)),query:<T extends Record<string,unknown>>(sql:string,params:readonly SqlParameter[]=[])=>transaction((tx)=>tx.query<T>(sql,params)),close:async()=>{}};
 }
 const bootstrapDb=scope("sim_guru_bootstrap"),authDb=scope("sim_guru_auth"),adminDb=scope("sim_guru_auth",true);
 let adminId="";
 await t.test("AC01 bootstrap hash nyata, flag wajib ganti, TTL24jam dan idempotensi tanpa overwrite",async()=>{
  const result=await bootstrapAdmin(bootstrapDb,passwords,{username:"operator",fullName:"Operator Uji",temporaryPassword:password});assert.equal(result.created,true);adminId=result.userId;
  const row=(await database.query<{password_hash:string;must_change_password:boolean;ttl:boolean}>("select c.password_hash,u.must_change_password,c.temporary_expires_at>clock_timestamp()+interval '23 hours' as ttl from app.app_users u join auth_private.user_credentials c on c.user_id=u.id where u.id=$1",[adminId])).rows[0]!;
  assert.equal((await passwords.verify(row.password_hash,password)).valid,true);assert.equal(row.must_change_password,true);assert.equal(row.ttl,true);
  const repeat=await bootstrapAdmin(bootstrapDb,passwords,{username:"OPERATOR",fullName:"Operator Uji"});assert.equal(repeat.created,false);
  assert.equal((await database.query<{password_hash:string}>("select password_hash from auth_private.user_credentials where user_id=$1",[adminId])).rows[0]?.password_hash,row.password_hash);
  await assert.rejects(()=>bootstrapAdmin(bootstrapDb,passwords,{username:"operator",fullName:"Nama Berbeda"}),/BOOTSTRAP_RECOVERY_REQUIRED/);
 });
 // Fixture administratif menyelesaikan onboarding admin sintetis; bukan fitur UI produksi.
 const adminHash=(await authDb.query<{password_hash:string}>("select * from auth_private.lookup_credentials('operator')")).rows[0]!.password_hash;
 await database.query("update app.app_users set must_change_password=false,contact_email='operator@example.test',email_verified_at=clock_timestamp() where id=$1",[adminId]);
 await database.query("update auth_private.user_credentials set temporary_expires_at=null where user_id=$1",[adminId]);
 await database.query("insert into auth_private.security_questions(user_id,question,answer_hash) values($1,'Pertanyaan uji',$2)",[adminId,adminHash]);
 const proof=digest(randomUUID());const session=(await authDb.query<{id:string}>("select auth_private.issue_session($1,$2,1,1,$3,'business') as id",[adminId,adminHash,proof])).rows[0]!.id;
 context={userId:adminId,sessionId:session,tokenHash:proof};
 const key=randomBytes(32).toString("hex");
 const service=new AccountActivationService((work)=>adminDb.transaction(work),authDb,passwords,key);
 type Invite=Awaited<ReturnType<typeof service.invite>>;
 let invitation:Invite;let token="";
 async function readToken(value:Invite){
  const row=(await database.query<{ciphertext:string;nonce:string;tag:string;email:string}>("select encode(s.ciphertext,'hex') as ciphertext,encode(s.nonce,'hex') as nonce,encode(s.auth_tag,'hex') as tag,o.recipient_email as email from auth_private.outbox_secrets s join ops.notification_outbox o on o.id=s.outbox_id where s.outbox_id=$1",[value.outboxId])).rows[0]!;
  return decryptActivationToken({ciphertextHex:row.ciphertext,nonceHex:row.nonce,tagHex:row.tag,keyVersion:1},key,{userId:value.userId,challengeId:value.challengeId,outboxId:value.outboxId,email:row.email,keyVersion:1});
 }
 await t.test("AC02 invite atomik menulis pending profile+digest+encrypted outbox; bukan email sent",async()=>{
  invitation=await service.invite({username:"guru.aktif",fullName:"Guru Aktif",role:"guru",email:"aktif@example.test",appUrl:"https://example.test"});token=await readToken(invitation);
  assert.equal(invitation.delivery,"queued");assert.equal(JSON.stringify(invitation).includes(token),false);
  const challenge=(await database.query<{secret_digest:string}>("select secret_digest from auth_private.verification_challenges where id=$1",[invitation.challengeId])).rows[0]!;assert.equal(challenge.secret_digest,activationTokenDigest(token));
  const publicRow=await database.query("select public_payload from ops.notification_outbox where id=$1",[invitation.outboxId]);assert.equal(JSON.stringify(publicRow).includes(token),false);
  assert.equal((await database.query("select * from auth_private.user_credentials where user_id=$1",[invitation.userId])).rows.length,0);
 });
 await t.test("AC03 input gagal/encryption key salah rollback seluruh account+challenge+outbox",async()=>{
  const bad=new AccountActivationService((work)=>adminDb.transaction(work),authDb,passwords,"invalid");
  await assert.rejects(()=>bad.invite({username:"rollback.invite",fullName:"Rollback Uji",role:"guru",email:"rollback@example.test",appUrl:"https://example.test"}));
  assert.equal((await database.query("select id from app.app_users where username='rollback.invite'")).rows.length,0);
 });
 await t.test("AC04 token salah/kedaluwarsa tidak membuat credential atau mengonsumsi token sah",async()=>{
  await assert.rejects(()=>service.activate({challengeId:invitation.challengeId,token:createActivationToken().token,newPassword:password}),/INVALID_ACTIVATION/);
  const expired=await service.invite({username:"guru.expired",fullName:"Guru Kedaluwarsa",role:"guru",email:"expired@example.test",appUrl:"https://example.test"});const old=await readToken(expired);
  await database.query("update auth_private.verification_challenges set created_at=clock_timestamp()-interval '2 days',expires_at=clock_timestamp()-interval '1 day' where id=$1",[expired.challengeId]);
  await assert.rejects(()=>service.activate({challengeId:expired.challengeId,token:old,newPassword:password}),/INVALID_ACTIVATION/);
 });
 await t.test("AC05 aktivasi sekali pakai menyimpan hash asli/verifikasi email; masih perlu pertanyaan keamanan",async()=>{
  const result=await service.activate({challengeId:invitation.challengeId,token,newPassword:password});assert.equal(result.requiresOnboarding,true);
  const row=(await database.query<{password_hash:string;verified:boolean;must_change_password:boolean}>("select c.password_hash,u.email_verified_at is not null as verified,u.must_change_password from app.app_users u join auth_private.user_credentials c on c.user_id=u.id where u.id=$1",[invitation.userId])).rows[0]!;
  assert.equal((await passwords.verify(row.password_hash,password)).valid,true);assert.equal(row.verified,true);assert.equal(row.must_change_password,false);
  await assert.rejects(()=>service.activate({challengeId:invitation.challengeId,token,newPassword:password}));
  assert.equal((await database.query("select * from auth_private.outbox_secrets where outbox_id=$1",[invitation.outboxId])).rows.length,0);
  await assert.rejects(()=>authDb.query("select auth_private.issue_session($1,$2,1,2,$3,'business')",[invitation.userId,row.password_hash,digest(randomUUID())]));
 });
 await t.test("AC06 reissue membatalkan token dan secret outbox lama",async()=>{
  const first=await service.invite({username:"guru.reissue",fullName:"Guru Reissue",role:"guru",email:"reissue@example.test",appUrl:"https://example.test"});const old=await readToken(first);
  const replacement=await service.reissue(first.userId,"reissue@example.test","https://example.test");
  await assert.rejects(()=>service.activate({challengeId:first.challengeId,token:old,newPassword:password}),/INVALID_ACTIVATION/);
  assert.equal((await database.query("select * from auth_private.outbox_secrets where outbox_id=$1",[first.outboxId])).rows.length,0);
  await service.activate({challengeId:replacement.challengeId,token:await readToken(replacement),newPassword:password});
 });
 await t.test("AC07 konflik email terverifikasi rollback aktivasi tanpa menghabiskan challenge",async()=>{
  const collision=await service.invite({username:"guru.collision",fullName:"Guru Bentrok",role:"guru",email:"aktif@example.test",appUrl:"https://example.test"});
  await assert.rejects(async()=>service.activate({challengeId:collision.challengeId,token:await readToken(collision),newPassword:password}));
  const state=(await database.query<{status:string;consumed:boolean}>("select u.status,c.consumed_at is not null as consumed from app.app_users u join auth_private.verification_challenges c on c.user_id=u.id where c.id=$1",[collision.challengeId])).rows[0];assert.deepEqual(state,{status:"pending_activation",consumed:false});
 });
 await t.test("AC08 konsumsi ulang dua request memberi satu keberhasilan (antrean satu koneksi, bukan native race)",async()=>{
  const v=await service.invite({username:"guru.once",fullName:"Guru Tunggal",role:"guru",email:"once@example.test",appUrl:"https://example.test"}),raw=await readToken(v);
  // SQL dipanggil serial agar harness session authorization tidak bercampur antar-request.
  const encoded=await passwords.hashNew(password,{username:"guru.once",fullName:"Guru Tunggal"});
  await authDb.query("select auth_private.complete_activation($1,$2,$3)",[v.challengeId,activationTokenDigest(raw),encoded]);
  await assert.rejects(()=>authDb.query("select auth_private.complete_activation($1,$2,$3)",[v.challengeId,activationTokenDigest(raw),encoded]));
  assert.equal((await database.query("select * from auth_private.user_credentials where user_id=$1",[v.userId])).rows.length,1);
 });
 await t.test("AC09 role bisnis tidak membaca secret outbox atau mengeksekusi activation/bootstrap",async()=>{
  const business=scope("sim_guru_business");
  await assert.rejects(()=>business.query("select * from auth_private.outbox_secrets"));
  await assert.rejects(()=>business.query("select auth_private.complete_activation($1,$2,$3)",[invitation.challengeId,digest(token),adminHash]));
 });
 await t.test("AC10 rehash CAS memakai hash nyata tanpa mencabut sesi/password_changed_at",async()=>{
  const newHash=await passwords.hashNew(password,{username:"operator",fullName:"Operator Uji"});
  const before=(await database.query<{time:string}>("select password_changed_at::text as time from auth_private.user_credentials where user_id=$1",[adminId])).rows[0]!.time;
  assert.equal((await authDb.query<{changed:boolean}>("select auth_private.rehash_credentials_after_verification($1,1,$2,$3) as changed",[adminId,adminHash,newHash])).rows[0]?.changed,true);
  assert.equal((await authDb.query<{changed:boolean}>("select auth_private.rehash_credentials_after_verification($1,1,$2,$3) as changed",[adminId,adminHash,newHash])).rows[0]?.changed,false);
  assert.equal((await database.query<{time:string}>("select password_changed_at::text as time from auth_private.user_credentials where user_id=$1",[adminId])).rows[0]?.time,before);
  assert.equal((await authDb.query("select * from auth_private.read_session($1)",[proof])).rows.length,1);
 });
});
