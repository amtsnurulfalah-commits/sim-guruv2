import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {openPgliteDatabase} from "../helpers/pglite-database";
import {applyMigrations,readMigrations} from "../../scripts/lib/migrations";
import {sqlJson,type SqlExecutor,type SqlParameter} from "../../scripts/lib/sql-database";
import {OperationsService} from "../../src/server/operations/service";
import {monitorSchema} from "../../src/lib/operations/support-cases";
import {isolateRestoredDatabase} from "../../scripts/migration/recovery";
import {tokenHash} from "../../src/server/auth/service";

test("PRO-3 operational reliability and restored capability isolation",async t=>{
 const db=await openPgliteDatabase();t.after(()=>db.close());
 await applyMigrations(db,await readMigrations("supabase/migrations"));
 const actor=(await db.query<{id:string}>("insert into app.app_users(username,full_name,role,status,must_change_password,contact_email,email_verified_at) values('pro3.admin','Synthetic Admin','admin','active',false,'admin@example.test',clock_timestamp()) returning id")).rows[0]!.id;
 const hash="$argon2id$v=19$m=19456,t=2,p=1$abcdefghijklmnopqrstuv$"+"A".repeat(43),token="R".repeat(43);
 await db.query("insert into auth_private.user_credentials(user_id,password_hash) values($1,$2)",[actor,hash]);await db.query("insert into auth_private.security_questions(user_id,question,answer_hash) values($1,'Synthetic question',$2)",[actor,hash]);await db.query("select auth_private.issue_session($1,$2,1,1,$3,'business')",[actor,hash,tokenHash(token)]);
 async function worker<T extends Record<string,unknown>>(sql:string,args:SqlParameter[]=[]){return db.transaction(async tx=>{await tx.exec("SET LOCAL ROLE sim_guru_worker");return tx.query<T>(sql,args);});}
 const service=new OperationsService({...db,transaction:work=>db.transaction(async(tx:SqlExecutor)=>{await tx.exec("SET LOCAL ROLE sim_guru_business");return work(tx);})});
 const monitor=async()=>monitorSchema.parse(await service.read(token,"support-monitor"));
 await t.test("paused finance job with zero attempts remains paused and creates no money",async()=>{
  await db.exec("CREATE OR REPLACE FUNCTION app.activity_today() RETURNS date LANGUAGE sql STABLE SET search_path=pg_catalog AS $$ SELECT date '2030-03-15' $$");
  await db.exec("insert into ops.job_runs(business_key,kind,state,attempts,result) values('honor:2030-02-01','honor','paused',0,'{\"code\":\"PERIOD_OUT_OF_SCOPE\"}')");
  await db.transaction(async tx=>{await tx.exec("SET LOCAL ROLE sim_guru_owner");await tx.query("select ops.scheduled_finance()");});
  const job=(await db.query("select state,attempts,result from ops.job_runs where business_key='honor:2030-02-01'")).rows[0];assert.deepEqual(job,{state:"paused",attempts:0,result:{code:"PERIOD_OUT_OF_SCOPE"}});
  assert.equal((await db.query<{n:number}>("select count(*)::int n from finance.honor_statements")).rows[0]!.n,0);
 });
 await t.test("domain retry exhaustion is terminal, timestamped and fenced",async()=>{
  const id=randomUUID(),lease=randomUUID();await db.query("insert into ops.domain_outbox(id,dedupe_key,recipient_id,subject,body,state,attempts,lease_token,lease_until) values($1::uuid,$1::text,$2,'Synthetic','Not delivered','sending',5,$3,clock_timestamp()+interval '1 minute')",[id,actor,lease]);
  assert.equal((await worker<{ok:boolean}>("select ops.domain_finish($1,$2,'retry_wait') ok",[id,lease])).rows[0]!.ok,true);
  const row=(await db.query("select state,completed_at is not null terminal from ops.domain_outbox where id=$1",[id])).rows[0];assert.deepEqual(row,{state:"failed",terminal:true});
  assert.equal((await worker<{ok:boolean}>("select ops.domain_finish($1,$2,'sent') ok",[id,lease])).rows[0]!.ok,false);
 });
 await t.test("security terminal receipt is timestamped; missing/null/stale leases cannot succeed",async()=>{
  const id=randomUUID(),lease=randomUUID();await db.query("insert into ops.notification_outbox(id,dedupe_key,recipient_id,recipient_email,template,public_payload,state,attempts,lease_token,lease_until) values($1::uuid,$1::text,$2,'recipient@example.test','password_changed','{}','sending',5,$3,clock_timestamp()+interval '1 minute')",[id,actor,lease]);
  assert.equal((await worker<{ok:boolean}>("select auth_private.finish_security_outbox($1,$2,'retry_wait') ok",[id,lease])).rows[0]!.ok,true);
  assert.deepEqual((await db.query("select state,completed_at is not null terminal from ops.notification_outbox where id=$1",[id])).rows[0],{state:"failed",terminal:true});
  for(const args of [[randomUUID(),randomUUID(),"sent"],[id,null,"sent"],[id,lease,null]])assert.equal((await worker<{ok:boolean}>("select auth_private.finish_security_outbox($1,$2,$3) ok",args)).rows[0]!.ok,false);
 });
 await t.test("health reports state cohort and suppresses paused-channel queue noise",async()=>{
  await db.query("insert into ops.notification_outbox(id,dedupe_key,recipient_id,recipient_email,template,public_payload,state,completed_at) values(gen_random_uuid(),'accepted-test',$1,'recipient@example.test','password_changed','{}','sent',clock_timestamp())",[actor]);
  await db.query("insert into ops.domain_outbox(dedupe_key,recipient_id,subject,body,state) values('uncertain-test',$1,'Synthetic','Not delivered','unknown')",[actor]);
  await db.query("insert into ops.domain_outbox(dedupe_key,recipient_id,subject,body,created_at) values('paused-channel',$1,'Synthetic','Not delivered',clock_timestamp()-interval '1 hour')",[actor]);
  await db.query("update app.system_settings set typed_value=$1::jsonb where key='operations.config'",[sqlJson({maintenance:false,jobsEnabled:false,mailEnabled:false,securityMailEnabled:false,maintenanceStart:null,maintenanceEnd:null})]);
  let m=await monitor();assert.equal(m.reliability?.accepted24h,1);assert.equal(m.reliability?.failed24h,2);assert.equal(m.reliability?.uncertain24h,1);assert.equal(m.reliability?.knownFailurePercent,66.7);assert.equal(m.reliability?.activeReadyQueue,0);assert.ok(!m.alerts.some(a=>a.code==='QUEUE_DELAY'||a.code==='WORKER_STALE'));assert.ok(!JSON.stringify(m).includes('recipient@example.test'));
  await db.exec("insert into ops.worker_tickets(token_hash,expires_at,used_at) values(repeat('b',64),clock_timestamp()+interval '1 hour',clock_timestamp()); update app.system_settings set typed_value=typed_value||'{\"jobsEnabled\":true}'::jsonb where key='operations.config'");
  m=await monitor();assert.ok(m.alerts.some(a=>a.code==='JOBS_STALE'));
  await db.exec("insert into ops.job_runs(business_key,kind,state,completed_at) values('success-test','notifications','completed',clock_timestamp())");
  m=await monitor();assert.ok(!m.alerts.some(a=>a.code==='JOBS_STALE'));assert.ok(m.reliability?.lastSuccessfulJobAt);
  await assert.rejects(()=>worker("select ops.reliability_snapshot()"),/permission denied/);
  await db.query("insert into ops.notification_outbox(id,dedupe_key,recipient_id,recipient_email,template,public_payload,created_at) values(gen_random_uuid(),'active-security',$1,'recipient@example.test','password_changed','{}',clock_timestamp()-interval '1 hour')",[actor]);
  await db.exec("update app.system_settings set typed_value=typed_value||'{\"securityMailEnabled\":true,\"maintenance\":true}'::jsonb where key='operations.config'");m=await monitor();assert.equal(m.reliability?.activeReadyQueue,1);assert.ok(m.alerts.some(a=>a.code==='QUEUE_DELAY'));
 });
 await t.test("restore removes worker tickets as well as sessions and active queues",async()=>{
  await db.exec("insert into ops.worker_tickets(token_hash,expires_at) values(repeat('c',64),clock_timestamp()+interval '1 hour')");
  await isolateRestoredDatabase(db);assert.equal((await db.query<{n:number}>("select count(*)::int n from ops.worker_tickets")).rows[0]!.n,0);
  assert.equal((await db.query<{n:number}>("select count(*)::int n from auth_private.app_sessions where revoked_at is null")).rows[0]!.n,0);
  assert.equal((await db.query<{n:number}>("select count(*)::int n from ops.notification_outbox where state in('pending','sending','retry_wait','unknown')")).rows[0]!.n,0);
 });
});
