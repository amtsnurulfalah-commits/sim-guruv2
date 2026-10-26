import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {openPgliteDatabase} from "../helpers/pglite-database";
import {applyMigrations,readMigrations} from "../../scripts/lib/migrations";
import {seedPro2Fixture} from "../../scripts/lib/pro2-fixture";
import {ActivityService} from "../../src/server/activities/service";

test("PRO-2 history optimization preserves results, private grants and session/owner boundaries",async t=>{
 const db=await openPgliteDatabase();t.after(()=>db.close());
 const migrations=await readMigrations("supabase/migrations");
 await applyMigrations(db,migrations.filter(m=>!m.name.includes("pro2_activity_read_performance")));
 const {actor,token}=await seedPro2Fixture(db);
 const service=new ActivityService({...db,transaction:work=>db.transaction(async tx=>{await tx.exec("SET LOCAL ROLE sim_guru_business");return work(tx);})});
 const filter={from:"2025-01-01",to:"2025-03-01",page:1,pageSize:25};
 const catalog=()=>db.query("select proowner,proacl::text,prosecdef,proconfig from pg_proc where oid='app.activity_read(text,text,jsonb)'::regprocedure");
 const permissions=await catalog(),before=await service.read(token,"attendance",filter),deepBefore=await service.read(token,"attendance",{...filter,page:400});
 await applyMigrations(db,migrations);assert.deepEqual(await applyMigrations(db,migrations),[]);
 await t.test("12,060-row response and routine owner/grants are identical",async()=>{
  assert.deepEqual(await service.read(token,"attendance",filter),before);
  assert.deepEqual(await catalog(),permissions);
  assert.deepEqual(await service.read(token,"attendance",{...filter,page:400}),deepBefore);
  const page=await service.read(token,"attendance",{...filter,page:400}) as {items:unknown[];total:number};assert.equal(page.total,12060);assert.equal(page.items.length,25);
 });
 await t.test("non-admin requests remain owner-scoped, including an explicit foreign filter",async()=>{
  const teacher=(await db.query<{id:string}>("select id from app.app_users where username='pro2.teacher.1'")).rows[0]!.id;
  const hash=(await db.query<{password_hash:string}>("select password_hash from auth_private.user_credentials where user_id=$1",[actor])).rows[0]!.password_hash;
  await db.query("insert into auth_private.user_credentials(user_id,password_hash) values($1,$2)",[teacher,hash]);
  await db.query("update app.app_users set contact_email='teacher@example.test',email_verified_at=clock_timestamp() where id=$1",[teacher]);
  await db.query("insert into auth_private.security_questions(user_id,question,answer_hash) values($1,'Synthetic',$2)",[teacher,hash]);
  const teacherToken="Q".repeat(43);await db.query("select auth_private.issue_session($1,$2,1,1,$3,'business')",[teacher,hash,createHash("sha256").update(teacherToken).digest("hex")]);
  const own=await service.read(teacherToken,"attendance",filter) as {items:{userId:string}[];total:number};assert.equal(own.total,60);assert.ok(own.items.every(row=>row.userId===teacher));
  const foreign=await service.read(teacherToken,"attendance",{...filter,userId:actor}) as {items:unknown[];total:number};assert.equal(foreign.total,0);assert.deepEqual(foreign.items,[]);
  const admin=await service.read(token,"attendance",filter) as {total:number};assert.equal(admin.total,12060);
 });
 await t.test("revocation is rechecked on the next request",async()=>{
  await db.query("update auth_private.app_sessions set revoked_at=clock_timestamp() where user_id=$1",[actor]);
  await assert.rejects(()=>service.read(token,"attendance",filter),/UNAUTHENTICATED/);
 });
});
