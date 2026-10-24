/** Synthetic-only exercise. No production URL, SMTP adapter, real user or persistent backup. */
import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";
import { openNativeDatabase } from "./lib/native-database";
import { applyMigrations, readMigrations } from "./lib/migrations";
import { restoreInventory } from "./migration/restore-inventory";
import { getPasswordService } from "../src/server/auth/passwords";
import { ActivityService } from "../src/server/activities/service";
import { databaseFromClient } from "../src/server/auth/runtime";
import postgres from "postgres";

function local(name: string, suffix: string) {
  const raw = process.env[name]; if (!raw) throw Error("DRILL_DATABASE_REQUIRED");
  const url = new URL(raw);
  if (!["postgres:","postgresql:"].includes(url.protocol) || !["127.0.0.1","localhost","[::1]"].includes(url.hostname) || !url.pathname.endsWith(suffix) || url.search || url.hash) throw Error("DISPOSABLE_LOCAL_DRILL_REQUIRED");
  return raw;
}
async function main() {
  const source = local("RELEASE_DRILL_DATABASE_URL", "_drill_test"), target = local("RESTORE_DATABASE_URL", "_restore_test");
  assert.notEqual(source, target);
  const db = openNativeDatabase(source), restored = openNativeDatabase(target), directory = await mkdtemp(join(tmpdir(), "sim-guru-private-drill-")), archive = join(directory,"archive");
  const key = randomBytes(32).toString("hex"), passwords = await getPasswordService();
  async function cli(action: string, override: Record<string,string> = {}, expected = 0) {
    const result = await new Promise<{code:number|null;output:string}>(resolve => {
      const child = spawn(process.execPath,["--conditions=react-server","--import","tsx","scripts/backup-database.ts",action,archive], { env:{...process.env,BACKUP_ENCRYPTION_KEY:key,MIGRATION_DATABASE_URL:source,RESTORE_DATABASE_URL:target,...override},stdio:["ignore","pipe","pipe"] });
      let output=""; child.stdout.on("data",b=>output+=b);child.stderr.on("data",b=>output+=b);child.on("close",code=>resolve({code,output}));
    });
    assert.equal(result.code,expected,result.output); return result.output;
  }
  try {
    for (const database of [db,restored]) assert.equal((await database.query<{n:number}>("select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname not in('pg_catalog','information_schema')")).rows[0]!.n,0);
    const migration = await readMigrations("supabase/migrations"); await applyMigrations(db,migration); assert.deepEqual(await applyMigrations(db,migration),[]);
    const hash = await passwords.hashNew("Native9!rL8#qW4$vZ2@kD7",{username:"drill.admin",fullName:"Synthetic Admin"});
    const actor = (await db.query<{id:string}>("insert into app.app_users(username,full_name,role,status,must_change_password,contact_email,email_verified_at) values('drill.admin','Synthetic Admin','admin','active',false,'admin@example.test',clock_timestamp()) returning id")).rows[0]!.id;
    await db.query("insert into auth_private.user_credentials(user_id,password_hash) values($1,$2)",[actor,hash]);
    await db.query("insert into auth_private.security_questions(user_id,question,answer_hash) values($1,'Synthetic question',$2)",[actor,hash]);
    const token=randomBytes(32).toString("base64url"), digest=createHash("sha256").update(token).digest("hex");
    await db.query("select auth_private.issue_session($1,$2,1,1,$3,'business')",[actor,hash,digest]);
    await db.exec("insert into app.app_users(username,full_name,role,status,must_change_password) select 'drill.teacher.'||n,'Synthetic Teacher '||n,'guru','active',false from generate_series(1,200)n");
    await db.exec("insert into app.daily_attendance(user_id,date,sched_time_in,sched_time_out,actual_time_in,actual_time_out,time_in_source) select id,'2025-01-01'::date+n,'07:30','14:00','07:30','14:00','self' from app.app_users cross join generate_series(0,59)n");
    await db.exec("insert into finance.honor_periods(period_start,state,finalized_at,formula_version) values('2024-01-01','final','2024-02-01','legacy')");
    await db.query(`insert into finance.honor_statements(period_id,user_id,trx_id,snapshot,total_jtm,total_honor,checksum) select p.id,u.id,'SYNTHETIC-'||u.username,jsonb_build_object('formulaVersion','legacy','recipient',jsonb_build_object('name',u.full_name),'period','2024-01','total','9007199254740993','totalJtm','1.2345'),1.2345,9007199254740993,repeat('b',64) from finance.honor_periods p cross join app.app_users u`);
    await db.query("insert into ops.domain_outbox(dedupe_key,recipient_id,subject,body,state,lease_token,lease_until) values('drill-mail',$1,'Synthetic','Synthetic','sending',gen_random_uuid(),clock_timestamp()+interval '1 hour')",[actor]);
    await db.exec("ANALYZE app.app_users; ANALYZE app.daily_attendance; ANALYZE finance.honor_statements");
    // Bounded concurrent reads through the actual business adapter, not superuser bypass.
    const url=new URL(source); const client=postgres(url.toString(),{max:4,prepare:false,onnotice:()=>{}});
    const wrapped=databaseFromClient(client);
    const business={...wrapped,transaction:<T>(work:Parameters<typeof wrapped.transaction<T>>[0])=>wrapped.transaction(async tx=>{await tx.exec("SET LOCAL ROLE sim_guru_business");return work(tx);})};
    const service=new ActivityService(business),durations:number[]=[]; let bytes=0;
    const start=performance.now();
    try { for(let batch=0;batch<10;batch++) await Promise.all(Array.from({length:4},async()=>{const t=performance.now();const data=await service.read(token,"attendance",{from:"2025-01-01",to:"2025-03-01",page:1,pageSize:25});durations.push(performance.now()-t);bytes+=Buffer.byteLength(JSON.stringify(data));})); }
    finally {await client.end();}
    durations.sort((a,b)=>a-b);
    const profile={kind:"native-synthetic-adapter-read",users:201,attendanceRows:12060,statementRows:201,requests:40,concurrency:4,errors:0,p50Ms:Math.round(durations[19]!),p95Ms:Math.round(durations[37]!),wallMs:Math.round(performance.now()-start),meanPayloadBytes:Math.round(bytes/40)};
    assert.ok(profile.p95Ms<5000,"SYNTHETIC_READ_BUDGET_5S_EXCEEDED");
    // Freeze only the disposable fixture. No source traffic or worker exists here.
    await db.exec(`update app.system_settings set typed_value=typed_value||'{"maintenance":true,"jobsEnabled":false,"mailEnabled":false,"securityMailEnabled":false}'::jsonb where key='operations.config'`);
    const before=await restoreInventory(db), backupStarted=performance.now();
    await cli("create"); const backupMs=Math.round(performance.now()-backupStarted);
    await cli("verify"); const wrong=await cli("verify",{BACKUP_ENCRYPTION_KEY:randomBytes(32).toString("hex")},1);assert.match(wrong,/BACKUP_OPERATION_FAILED/);
    const originalManifest=await readFile(join(archive,"manifest.json"),"utf8"),manifest=JSON.parse(originalManifest);
    await writeFile(join(archive,"manifest.json"),JSON.stringify({...manifest,createdAt:"2000-01-01T00:00:00Z"}));await cli("verify",{},1);await writeFile(join(archive,"manifest.json"),originalManifest);
    const dump=await readFile(join(archive,"database.enc"));await writeFile(join(archive,"database.enc"),dump.subarray(1));await cli("verify",{},1);await writeFile(join(archive,"database.enc"),dump);
    assert.equal((await stat(archive)).mode&0o777,0o700);assert.equal((await stat(join(archive,"database.enc"))).mode&0o777,0o600);
    const restoreStarted=performance.now();await cli("restore-local");
    assert.deepEqual(await cli("restore-local",{},1).then(s=>s.includes("EMPTY_RESTORE_DATABASE_REQUIRED")),true);
    assert.equal((await restored.query<{n:number}>("select count(*)::int n from auth_private.app_sessions where revoked_at is null")).rows[0]!.n,0);
    assert.equal((await restored.query<{state:string}>("select state from ops.domain_outbox where dedupe_key='drill-mail'")).rows[0]!.state,"cancelled");
    assert.equal((await restored.query<{value:string}>("select total_honor::text value from finance.honor_statements limit 1")).rows[0]!.value,"9007199254740993");
    await assert.rejects(()=>restored.exec("update finance.honor_statements set total_honor=1"));
    await assert.rejects(()=>restored.transaction(async tx=>{await tx.exec("SET LOCAL ROLE sim_guru_business");await tx.query("select * from auth_private.user_credentials");}));
    const restoredHash=(await restored.query<{password_hash:string}>("select password_hash from auth_private.user_credentials where user_id=$1",[actor])).rows[0]!.password_hash;
    assert.equal((await passwords.verify(restoredHash,"Native9!rL8#qW4$vZ2@kD7")).valid,true);
    assert.deepEqual((await restored.query("select auth_private.session_snapshot($1) value",[digest])).rows[0]!.value,null);
    const after=await restoreInventory(restored);assert.deepEqual(after.migrations,before.migrations);assert.equal(after.rls,true);assert.equal(after.schemaDigest,before.schemaDigest);
    const result={kind:"stage8-native-recovery",ok:true,postgres:(await db.query<{v:string}>("select current_setting('server_version') v")).rows[0]!.v,migrations:migration.length,tables:Object.keys(before.counts).length,backupMs,recoveryMs:Math.round(performance.now()-restoreStarted),archiveBytes:dump.length,rpo:"0 fixture transactions lost at frozen snapshot; not a production RPO",inventory:"v2 full-content/schema/ACL/migration comparison before isolation passed in CLI",checks:["wrong-key","manifest-tamper","archive-truncation","empty-target","permissions","revoked-session","dispatch-isolation","exact-NUMERIC","immutable-final","credential-hash-verify"],profile};
    if(process.env.STAGE8_REPORT_FILE)await writeFile(process.env.STAGE8_REPORT_FILE,JSON.stringify(result,null,2)+"\n");
    console.log("STAGE8_NATIVE_RESULT "+JSON.stringify(result));
  } finally {await db.close();await restored.close();await rm(directory,{recursive:true,force:true});}
}
main().catch(error=>{console.error("STAGE8_NATIVE_DRILL_FAILED",error instanceof Error ? error.message : "UNKNOWN");process.exitCode=1;});
