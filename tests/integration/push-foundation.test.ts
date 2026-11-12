import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { openPgliteDatabase } from "../helpers/pglite-database";
import { readMigrations, applyMigrations } from "../../scripts/lib/migrations";
import { sqlJson, type SqlParameter } from "../../scripts/lib/sql-database";
import { sealSubscription, openSubscription, generatePushKeys } from "../../src/server/notifications/keys";

test("push migration preserves inbox and isolates notification recipients", async t => {
  const db = await openPgliteDatabase();
  t.after(() => db.close());
  const migrations = await readMigrations("supabase/migrations");
  await applyMigrations(db, migrations.filter(m => !m.name.endsWith("_push_notification_foundation.sql")));
  async function asRole(name: string, sql: string, args: readonly SqlParameter[] = []) {
    return db.transaction(async tx => {
      await tx.exec("SET LOCAL ROLE " + name);
      return tx.query(sql, args);
    });
  }
  const hash = '$argon2id$v=19$m=19456,t=2,p=1$abcdefghijklmnopqrstuv$' + 'A'.repeat(43);
  async function fixture(name: string, ready: boolean) {
    const id = randomUUID(), digest = createHash("sha256").update(randomUUID()).digest("hex");
    await db.query("insert into app.app_users(id,username,full_name,role,status,must_change_password,contact_email,email_verified_at) values($1,$2,$2,'guru','active',$3,$4,case when $5 then now() end)", [id,name,!ready,name+"@example.test",ready]);
    await db.query("insert into auth_private.user_credentials(user_id,password_hash) values($1,$2)", [id,hash]);
    if (ready) await db.query("insert into auth_private.security_questions(user_id,question,answer_hash) values($1,'Pertanyaan uji',$2)", [id,hash]);
    await asRole("sim_guru_auth","select auth_private.issue_session($1,$2,1,1,$3,$4)", [id,hash,digest,ready?"business":"onboarding"]);
    return { id, digest };
  }
  const a = await fixture("guru.push.a",true), b = await fixture("guru.push.b",true), onboarding = await fixture("guru.push.c",false);
  const legacy = (await db.query<{id:string}>("insert into ops.domain_outbox(dedupe_key,recipient_id,subject,body) values('push-legacy',$1,'Lama','Riwayat') returning id",[a.id])).rows[0]!.id;
  await db.query("insert into app.notification_receipts(user_id,outbox_id) values($1,$2)",[a.id,legacy]);
  assert.equal((await applyMigrations(db,migrations)).length,1);
  assert.deepEqual(await applyMigrations(db,migrations),[]);
  const legacyInbox = await asRole("sim_guru_business","select app.notifications_read($1,1,false) value",[a.digest]);
  assert.equal((legacyInbox.rows[0]!.value as {items:{read:boolean}[]}).items[0]?.read,true);

  const event = randomUUID(), notice = randomUUID(), device = randomUUID(), subscription = randomUUID();
  const insertEvent = "insert into ops.notification_events(id,event_key,recipient_id,category,source_type,source_version,route_key,expires_at) values($1,$2,$3,'task','task',1,'tasks',now()+interval '1 day')";
  await db.query(insertEvent,[event,"push-fixture",a.id]);
  await assert.rejects(db.query(insertEvent,[randomUUID(),"push-fixture",a.id]), {code:"23505"});
  const insertNotice = "insert into app.notifications(id,event_id,recipient_id,title,body) values($1,$2,$3,'SiM-Guru','Ada pembaruan')";
  await assert.rejects(db.query(insertNotice,[notice,event,b.id]), {code:"23503"});
  await db.query(insertNotice,[notice,event,a.id]);
  await assert.rejects(db.query(insertNotice,[randomUUID(),event,a.id]), {code:"23505"});
  await db.query("insert into app.push_installations(id,user_id,label,environment) values($1,$2,'Perangkat uji','staging')",[device,a.id]);
  const keys = generatePushKeys();
  const binding = {userId:a.id,installationId:device,generation:"1",environment:"staging",keyId:"staging-v1"};
  const raw = {endpoint:"https://example.test/private-fixture",keys:{p256dh:keys.publicKey,auth:"A".repeat(22)}};
  const sealed = sealSubscription(raw,binding,keys.encryptionKey);
  assert.deepEqual(openSubscription(sealed,binding,{"staging-v1":keys.encryptionKey}),raw);
  for (const change of [{userId:b.id},{environment:"production"},{generation:"2"},{installationId:randomUUID()}])
    assert.throws(()=>openSubscription(sealed,{...binding,...change},{"staging-v1":keys.encryptionKey}),/PUSH_SUBSCRIPTION_UNAVAILABLE/);
  await db.query("insert into ops.push_subscriptions(id,installation_id,user_id,environment,binding_generation,endpoint_hash,destination_encrypted,encryption_key_id,vapid_key_id) values($1,$2,$3,'staging',1,$4,$5::jsonb,'staging-v1','staging-v1')",[subscription,device,a.id,"a".repeat(64),sqlJson(sealed)]);
  const delivery = "insert into ops.notification_deliveries(notification_id,recipient_id,channel,subscription_id,binding_generation,expires_at) values($1,$2,'web_push',$3,$4,now()+interval '1 hour')";
  await assert.rejects(db.query(delivery,[notice,a.id,subscription,2]),{code:"23503"});
  await assert.rejects(db.query(delivery,[notice,a.id,subscription,null]),{code:"23514"});
  await db.query(delivery,[notice,a.id,subscription,1]);
  await assert.rejects(db.query(delivery,[notice,a.id,subscription,1]),{code:"23505"});

  const devices = "select app.push_devices_read($1) value";
  const inbox = "select app.notification_inbox_read($1,1,false) value";
  const markRead = "select app.notification_mark_read($1,$2)";
  assert.equal(((await asRole("sim_guru_business",devices,[a.digest])).rows[0]!.value as unknown[]).length,1);
  assert.deepEqual((await asRole("sim_guru_business",devices,[b.digest])).rows[0]!.value,[]);
  assert.deepEqual((await asRole("sim_guru_business",inbox,[b.digest])).rows[0]!.value,{items:[]});
  await assert.rejects(asRole("sim_guru_business",markRead,[b.digest,notice]),/NOT_FOUND/);
  await asRole("sim_guru_business",markRead,[a.digest,notice]);
  await asRole("sim_guru_business",markRead,[a.digest,notice]);
  assert.equal((await db.query("select * from app.notification_receipts where notification_id=$1",[notice])).rows.length,1);
  for (const invalid of [onboarding.digest,"0".repeat(64)])
    await assert.rejects(asRole("sim_guru_business",devices,[invalid]));
  await db.query("update app.app_users set status='disabled' where id=$1",[b.id]);
  await assert.rejects(asRole("sim_guru_business",devices,[b.digest]));

  const pref = await asRole("sim_guru_business","select app.push_preferences_read($1) value",[a.digest]);
  assert.equal((pref.rows[0]!.value as {pushEnabled:boolean}).pushEnabled,false);
  await asRole("sim_guru_business","select app.notification_command($1,'notification-preferences',$2::jsonb)",[a.digest,sqlJson({version:"0",emailEnabled:false,reminderEmail:false})]);
  await db.query("update app.notification_preferences set push_enabled=true where user_id=$1",[a.id]);
  await asRole("sim_guru_business","select app.notification_command($1,'notification-preferences',$2::jsonb)",[a.digest,sqlJson({version:"1",emailEnabled:true,reminderEmail:true})]);
  assert.equal((await db.query("select push_enabled from app.notification_preferences where user_id=$1",[a.id])).rows[0]!.push_enabled,true);

  for (const name of ["sim_guru_business","sim_guru_auth","sim_guru_worker","sim_guru_bootstrap"]) {
    for (const table of ["ops.notification_events","app.notifications","app.push_installations","ops.push_subscriptions","ops.notification_deliveries"])
      await assert.rejects(asRole(name,"select * from "+table),{code:"42501"});
  }
  await assert.rejects(asRole("sim_guru_worker",devices,[a.digest]),{code:"42501"});
  await assert.rejects(db.transaction(async tx=>{await tx.query(insertEvent,[randomUUID(),"rollback-fixture",a.id]);throw Error("rollback");}),/rollback/);
  assert.equal((await db.query("select id from ops.notification_events where event_key='rollback-fixture'")).rows.length,0);
});
