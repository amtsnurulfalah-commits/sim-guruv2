import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { resolve } from "node:path";
import type { TestContext } from "node:test";
import { readMigrations, applyMigrations } from "../../scripts/lib/migrations";
import type { SqlDatabase, SqlExecutor } from "../../scripts/lib/sql-database";

// Hash sintetik dengan format Argon2id, bukan bukti password crypto diverifikasi (Tahap1.3).
const hashA = '$argon2id$v=19$m=19456,t=2,p=1$abcdefghijklmnopqrstuv$' + 'A'.repeat(43);
const hashB = '$argon2id$v=19$m=19456,t=2,p=1$abcdefghijklmnopqrstuv$' + 'B'.repeat(43);
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
type Context = { actorId: string; sessionId: string; tokenHash: string };
const roles = { business: "sim_guru_business", auth: "sim_guru_auth", bootstrap: "sim_guru_bootstrap", anon: "anon" } as const;
async function denied(work: () => Promise<unknown>, code = "42501") {
  await assert.rejects(work, (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === code);
}
export async function runDatabaseSuite(t: TestContext, db: SqlDatabase) {
  const namespace = await db.query<{ found: boolean }>("select to_regnamespace('app') is not null as found");
  assert.equal(namespace.rows[0]?.found,false,"TEST_DATABASE_MUST_BE_EMPTY");
  await db.exec("DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF; END $$;");
  const migrations = await readMigrations(resolve("supabase/migrations"));
  const engine = await db.query<{ version: string }>("select version()");
  t.diagnostic(`Engine SQL: ${engine.rows[0]!.version}`);
  const initial = await db.query<{ name: string }>("select session_user as name");
  const initialName = initial.rows[0]!.name;
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(initialName)) throw new Error("TEST_ADMIN_IDENTIFIER_INVALID");
  async function asRole<T>(role: keyof typeof roles, context: Context | null, work: (tx: SqlExecutor) => Promise<T>) {
    try { return await db.transaction(async (tx) => {
      await tx.exec(`SET SESSION AUTHORIZATION ${roles[role]}`); // Allowlist tetap, bukan input pengguna.
      if (context) await tx.query("select set_config('app.actor_id',$1,true),set_config('app.session_id',$2,true),set_config('app.request_id',$3,true),set_config('app.session_token_hash',$4,true)",[context.actorId,context.sessionId,randomUUID(),context.tokenHash]);
      return work(tx);
    }); } finally { await db.exec(`SET SESSION AUTHORIZATION "${initialName}"; RESET ROLE`); }
  }
  async function issue(userId: string, scope = "business", passwordHash = hashA): Promise<Context> {
    const tokenHash = digest(randomUUID());
    const versions = await db.query<{ auth_version: string; credential_version: string }>("select u.auth_version::text,c.credential_version::text from app.app_users u join auth_private.user_credentials c on c.user_id=u.id where u.id=$1",[userId]);
    const version = versions.rows[0]!;
    const result = await asRole("auth",null,(tx) => tx.query<{ id: string }>("select auth_private.issue_session($1,$2,$3,$4,$5,$6) as id",[userId,passwordHash,version.credential_version,version.auth_version,tokenHash,scope]));
    return { actorId:userId,sessionId:result.rows[0]!.id,tokenHash };
  }
  await t.test("DB01 migrasi clean install dan rerun checksum idempotent",async () => {
    assert.equal((await applyMigrations(db,migrations)).length,migrations.length);
    assert.deepEqual(await applyMigrations(db,migrations),[]);
  });
  const boot = await asRole("bootstrap",null,(tx) => tx.query<{ id: string }>("select auth_private.bootstrap_admin($1,$2,$3) as id",["operator","Operator Uji",hashA]));
  const adminId=boot.rows[0]!.id;
  const guruA=randomUUID(),guruB=randomUUID(),onboardingId=randomUUID();
  for (const [id,username,complete] of [[adminId,"operator",true],[guruA,"guru.a",true],[guruB,"guru.b",true],[onboardingId,"onboarding",false]] as const) {
    if (id!==adminId) {
      await db.query("insert into app.app_users(id,username,full_name,nip,role,status) values($1,$2,$2,'00001234','guru','active')",[id,username]);
      await db.query("insert into auth_private.user_credentials(user_id,password_hash) values($1,$2)",[id,hashA]);
    }
    if (complete) {
      await db.query("update app.app_users set must_change_password=false,contact_email=$2,email_verified_at=clock_timestamp() where id=$1",[id,username+"@example.test"]);
      await db.query("update auth_private.user_credentials set temporary_expires_at=null where user_id=$1",[id]);
      await db.query("insert into auth_private.security_questions(user_id,question,answer_hash) values($1,'Pertanyaan uji',$2)",[id,hashA]);
    }
  }
  const admin=await issue(adminId),a=await issue(guruA),b=await issue(guruB),onboarding=await issue(onboardingId,"onboarding");
  await db.exec("insert into app.system_settings(key,typed_value) values('app_timezone','\"Asia/Jakarta\"'::jsonb)");

  await t.test("DB02 role runtime nonowner, NOLOGIN, non-superuser, non-BYPASSRLS dan tanpa membership owner",async () => {
    const result=await db.query<{ rolname:string; unsafe:boolean }>("select rolname,(rolcanlogin or rolsuper or rolbypassrls or rolcreatedb or rolcreaterole or pg_has_role(rolname,'sim_guru_owner','MEMBER')) as unsafe from pg_roles where rolname in ('sim_guru_business','sim_guru_auth','sim_guru_worker','sim_guru_bootstrap')");
    assert.equal(result.rows.length,4);assert.equal(result.rows.some(({unsafe})=>unsafe),false);
  });
  await t.test("DB03 seluruh tabel domain mempunyai ENABLE+FORCE RLS",async () => {
    const result=await db.query<{ relrowsecurity:boolean; relforcerowsecurity:boolean }>("select c.relrowsecurity,c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('app','auth_private','ops') and c.relkind='r'");
    assert.equal(result.rows.length,23);assert.equal(result.rows.every((r)=>r.relrowsecurity&&r.relforcerowsecurity),true);
  });
  await t.test("DB04 tanpa context atau UUID actor palsu menghasilkan nol profil",async () => {
    const noContext=await asRole("business",null,(tx)=>tx.query("select id from app.app_users"));assert.equal(noContext.rows.length,0);
    const forged=await asRole("business",{...a,actorId:guruB},(tx)=>tx.query("select id from app.app_users"));assert.equal(forged.rows.length,0);
    const wrongProof=await asRole("business",{...a,tokenHash:digest('incorrect')},(tx)=>tx.query("select id from app.app_users"));assert.equal(wrongProof.rows.length,0);
  });
  await t.test("DB05 guru hanya membaca profil sendiri; NIP tetap teks",async () => {
    const result=await asRole("business",a,(tx)=>tx.query<{ id:string;nip:string }>("select id,nip from app.app_users"));
    assert.deepEqual(result.rows,[{id:guruA,nip:'00001234'}]);
  });
  await t.test("DB06 admin membaca semua profil/settings/audit; guru tidak membaca settings/audit",async () => {
    assert.equal((await asRole("business",admin,(tx)=>tx.query("select id from app.app_users"))).rows.length,4);
    assert.equal((await asRole("business",admin,(tx)=>tx.query("select key from app.system_settings"))).rows.length,1);
    assert.ok((await asRole("business",admin,(tx)=>tx.query("select action from ops.audit_logs"))).rows.length>0);
    assert.equal((await asRole("business",a,(tx)=>tx.query("select key from app.system_settings"))).rows.length,0);
    assert.equal((await asRole("business",a,(tx)=>tx.query("select action from ops.audit_logs"))).rows.length,0);
  });
  await t.test("DB07 business/auth/anon tidak mendapat SELECT langsung ke kredensial/sesi/challenge",async () => {
    for (const role of ["business","auth","anon"] as const) for (const table of ['user_credentials','app_sessions','verification_challenges','security_questions']) await denied(()=>asRole(role,null,(tx)=>tx.query(`select * from auth_private.${table}`)));
  });
  await t.test("DB08 business/anon tidak bisa menjalankan lookup hash; auth hanya melalui routine",async () => {
    for (const role of ["business","anon"] as const) await denied(()=>asRole(role,null,(tx)=>tx.query("select * from auth_private.lookup_credentials('operator')")));
    const result=await asRole("auth",null,(tx)=>tx.query<{ password_hash:string }>("select * from auth_private.lookup_credentials(' OPERATOR ')"));assert.equal(result.rows[0]?.password_hash,hashA);
  });
  await t.test("DB09 direct INSERT/UPDATE/TRUNCATE dan DELETE audit ditolak termasuk actor admin",async () => {
    await denied(()=>asRole("business",a,(tx)=>tx.exec("update app.app_users set role='admin'")));
    await denied(()=>asRole("business",admin,(tx)=>tx.exec("truncate app.app_users cascade")));
    await denied(()=>asRole("business",admin,(tx)=>tx.exec("delete from ops.audit_logs")));
    for(const role of ["business","auth"] as const)await denied(()=>asRole(role,null,(tx)=>tx.exec("insert into app.app_users(username,full_name,role) values('illegal','Illegal','admin')")));
  });
  await t.test("DB10 runtime tidak dapat SET ROLE owner atau mengeksekusi bootstrap",async () => {
    for(const role of ["business","auth"] as const){
      await denied(()=>asRole(role,null,(tx)=>tx.exec("set local role sim_guru_owner")));
      await denied(()=>asRole(role,null,(tx)=>tx.query("select auth_private.bootstrap_admin('bypass','Bypass',$1)",[hashA])));
    }
  });
  await t.test("DB11 create account atomik, username case-insensitive, rollback hash invalid",async () => {
    const result=await asRole("auth",admin,(tx)=>tx.query<{ id:string }>("select auth_private.create_account('guru.baru','Guru Baru','guru',$1) as id",[hashA]));assert.ok(result.rows[0]?.id);
    await denied(()=>asRole("auth",admin,(tx)=>tx.query("select auth_private.create_account('GURU.BARU','Duplikat','guru',$1)",[hashA])),"23505");
    await denied(()=>asRole("auth",admin,(tx)=>tx.query("select auth_private.create_account('invalid.hash','Invalid','guru','plaintext')")),"23514");
    assert.equal((await db.query("select id from app.app_users where username='invalid.hash'")).rows.length,0);
    assert.equal((await db.query("select id from ops.audit_logs where action='account.created'")).rows.length,1);
  });
  await t.test("DB12 create account melalui routine tetap memerlukan admin dan sesi sah",async () => {
    await denied(()=>asRole("auth",a,(tx)=>tx.query("select auth_private.create_account('no.admin','Invalid','guru',null)")));
    await denied(()=>asRole("auth",null,(tx)=>tx.query("select auth_private.create_account('no.session','Invalid','guru',null)")));
  });
  await t.test("DB13 onboarding tidak dapat mendapat business session atau membaca data bisnis",async () => {
    await denied(()=>issue(onboardingId,"business"));
    assert.equal((await asRole("business",onboarding,(tx)=>tx.query("select id from app.app_users"))).rows.length,0);
    const result=await asRole("auth",null,(tx)=>tx.query<{ scope:string }>("select * from auth_private.read_session($1)",[onboarding.tokenHash]));assert.equal(result.rows[0]?.scope,"onboarding");
  });
  await t.test("DB14 context tidak bocor setelah COMMIT atau ROLLBACK dalam koneksi yang sama",async () => {
    await asRole("business",a,(tx)=>tx.query("select app.actor_id()"));
    assert.equal((await asRole("business",null,(tx)=>tx.query<{ id:string|null }>("select app.actor_id() as id"))).rows[0]?.id,null);
    await assert.rejects(()=>asRole("business",a,async(tx)=>{await tx.query("select app.actor_id()");throw new Error("ROLLBACK_TEST");}));
    assert.equal((await asRole("business",null,(tx)=>tx.query<{ id:string|null }>("select app.actor_id() as id"))).rows[0]?.id,null);
  });
  await t.test("DB15 search_path caller dan temp table tidak mengubah helper definer",async () => {
    const result=await asRole("business",a,async(tx)=>{
      await tx.exec("set local search_path=pg_temp,public; create temp table app_users(id uuid,role text) on commit drop;");
      return tx.query<{ id:string }>("select app.actor_id() as id");
    });assert.equal(result.rows[0]?.id,guruA);
    const functions=await db.query<{ proconfig:string[] }>("select p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('app','auth_private') and p.prosecdef");
    assert.ok(functions.rows.length>=10);assert.equal(functions.rows.every(({proconfig})=>proconfig.includes('search_path=pg_catalog')),true);
  });
  await t.test("DB16 session absolut24jam/idle2jam; touch dibatasi absolute; revoke efektif",async () => {
    const temp=await issue(guruB);
    const duration=await db.query<{ absolute:boolean;idle:boolean }>("select expires_at-issued_at=interval '24 hours' as absolute,idle_expires_at-issued_at=interval '2 hours' as idle from auth_private.app_sessions where id=$1",[temp.sessionId]);assert.deepEqual(duration.rows[0],{absolute:true,idle:true});
    await db.query("update auth_private.app_sessions set expires_at=clock_timestamp()+interval '30 minutes',idle_expires_at=clock_timestamp()+interval '20 minutes' where id=$1",[temp.sessionId]);
    await asRole("auth",null,(tx)=>tx.query("select auth_private.touch_session($1)",[temp.tokenHash]));
    assert.equal((await db.query<{ capped:boolean }>("select idle_expires_at=expires_at as capped from auth_private.app_sessions where id=$1",[temp.sessionId])).rows[0]?.capped,true);
    await asRole("auth",null,(tx)=>tx.query("select auth_private.revoke_session($1)",[temp.tokenHash]));
    assert.equal((await asRole("auth",null,(tx)=>tx.query("select * from auth_private.read_session($1)",[temp.tokenHash]))).rows.length,0);
    const expired=await issue(guruB);
    await db.query("update auth_private.app_sessions set issued_at=clock_timestamp()-interval '2 hours',expires_at=clock_timestamp()-interval '1 minute',idle_expires_at=clock_timestamp()-interval '2 minutes' where id=$1",[expired.sessionId]);
    assert.equal((await asRole("auth",null,(tx)=>tx.query("select * from auth_private.read_session($1)",[expired.tokenHash]))).rows.length,0);
  });
  await t.test("DB17 checksum mismatch dan batch gagal tidak menambah ledger migrasi",async () => {
    await assert.rejects(()=>applyMigrations(db,migrations.map((m,i)=>i===0?{...m,checksum:'0'.repeat(64)}:m)),/MIGRATION_CHECKSUM_MISMATCH/);
    await assert.rejects(()=>applyMigrations(db,[...migrations,{name:'202610190006_failure.sql',checksum:'f'.repeat(64),sql:"insert into app.system_settings(key,typed_value) values('rollback_probe','true'::jsonb); select missing_migration_function();"}]));
    assert.equal((await db.query("select * from app.system_settings where key='rollback_probe'")).rows.length,0);
    assert.equal((await db.query("select * from sim_guru_migration.schema_migrations")).rows.length,migrations.length);
  });
  await t.test("DB18 bootstrap idempotent tanpa mengganti hash; target kedua ditolak",async () => {
    const result=await asRole("bootstrap",null,(tx)=>tx.query<{ id:string }>("select auth_private.bootstrap_admin('OPERATOR','Operator Uji',$1) as id",[hashB]));assert.equal(result.rows[0]?.id,adminId);
    assert.equal((await db.query<{ password_hash:string }>("select password_hash from auth_private.user_credentials where user_id=$1",[adminId])).rows[0]?.password_hash,hashA);
    await denied(()=>asRole("bootstrap",null,(tx)=>tx.query("select auth_private.bootstrap_admin('other.admin','Other',$1)",[hashA])));
  });
  await t.test("DB19 constraint FK, nominal dan hash menolak data tidak sah",async () => {
    await denied(()=>db.transaction((tx)=>tx.query("insert into auth_private.user_credentials(user_id,password_hash) values($1,$2)",[randomUUID(),hashA])),"23503");
    await denied(()=>db.transaction((tx)=>tx.query("update app.app_users set km_distance=-1 where id=$1",[guruA])),"23514");
    await denied(()=>db.transaction((tx)=>tx.query("update auth_private.user_credentials set password_hash='plaintext' where user_id=$1",[guruA])),"23514");
  });
  await t.test("DB20 password replacement CAS, revoke semua sesi/challenge dan audit teredaksi",async () => {
    await db.query("insert into auth_private.verification_challenges(user_id,purpose,secret_digest,expires_at) values($1,'reset_token',$2,clock_timestamp()+interval '5 minutes')",[guruA,digest('challenge')]);
    await denied(()=>asRole("auth",a,(tx)=>tx.query("select auth_private.set_password_after_verification($1,$2,99,$3)",[guruA,hashB,hashA])),"40001");
    assert.equal((await asRole("auth",null,(tx)=>tx.query("select * from auth_private.read_session($1)",[a.tokenHash]))).rows.length,1);
    await asRole("auth",a,(tx)=>tx.query("select auth_private.set_password_after_verification($1,$2,1,$3)",[guruA,hashB,hashA]));
    assert.equal((await asRole("auth",null,(tx)=>tx.query("select * from auth_private.read_session($1)",[a.tokenHash]))).rows.length,0);
    assert.equal((await db.query<{ count:number }>("select count(*)::int as count from auth_private.verification_challenges where user_id=$1 and superseded_at is null",[guruA])).rows[0]?.count,0);
    const audit=await db.query("select redacted_changes from ops.audit_logs where action='account.password_changed'");assert.equal(JSON.stringify(audit).includes('argon2'),false);
  });
  await t.test("DB21 disable akun segera mencabut sesi dan menolak issuance baru",async () => {
    await asRole("auth",admin,(tx)=>tx.query("select auth_private.set_account_status($1,'disabled',1)",[guruB]));
    assert.equal((await asRole("auth",null,(tx)=>tx.query("select * from auth_private.read_session($1)",[b.tokenHash]))).rows.length,0);
    await denied(()=>issue(guruB));
    assert.equal((await asRole("business",b,(tx)=>tx.query("select id from app.app_users"))).rows.length,0);
  });
  await t.test("DB22 admin aktif terakhir tidak bisa dinonaktifkan",async () => {
    await denied(()=>asRole("auth",admin,(tx)=>tx.query("select auth_private.set_account_status($1,'disabled',1)",[adminId])));
    assert.equal((await db.query<{ status:string }>("select status from app.app_users where id=$1",[adminId])).rows[0]?.status,'active');
  });
  await t.test("DB23 auth_version berubah menolak sesi lama meski belum ditandai revoked",async () => {
    const current=await issue(guruA,'business',hashB);
    await db.query("update app.app_users set auth_version=auth_version+1 where id=$1",[guruA]);
    assert.equal((await asRole("auth",null,(tx)=>tx.query("select * from auth_private.read_session($1)",[current.tokenHash]))).rows.length,0);
    assert.equal((await asRole("business",current,(tx)=>tx.query("select id from app.app_users"))).rows.length,0);
  });
  await t.test("DB24 default privileges tidak membuka objek/routine baru ke PUBLIC",async () => {
    await db.exec("set role sim_guru_owner; create table ops.future_acl_probe(id integer); create function auth_private.future_acl_probe() returns integer language sql as 'select 1'; reset role;");
    const acl=await db.query<{ schema:boolean;table:boolean;routine:boolean }>("select has_schema_privilege('anon','auth_private','USAGE') as schema,has_table_privilege('anon','ops.future_acl_probe','SELECT') as table,has_function_privilege('anon','auth_private.future_acl_probe()','EXECUTE') as routine");assert.deepEqual(acl.rows[0],{schema:false,table:false,routine:false});
    await db.exec("set role sim_guru_owner; drop table ops.future_acl_probe; drop function auth_private.future_acl_probe(); reset role;");
  });
}
