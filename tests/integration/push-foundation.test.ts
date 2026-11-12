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
  await applyMigrations(db, migrations.filter(m => !/_push_notification_foundation\.sql$|_notification_inbox_cutover\.sql$/.test(m.name)));
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
  await db.query("insert into app.notification_receipts(user_id,outbox_id,read_at) values($1,$2,'2026-01-01T01:00:00Z')",[a.id,legacy]);
  assert.equal((await applyMigrations(db,migrations)).length,2);
  assert.deepEqual(await applyMigrations(db,migrations),[]);
  const legacyInbox = await asRole("sim_guru_business","select app.notifications_read($1,1,false) value",[a.digest]);
  assert.equal((legacyInbox.rows[0]!.value as {items:{read:boolean}[]}).items[0]?.read,true);

  const imported = (await db.query(
    "select n.id, n.created_at = o.created_at as same_created, r.read_at = '2026-01-01T01:00:00Z'::timestamptz as same_read, e.fanout_state from app.notifications n join ops.domain_outbox o on o.id=n.id join ops.notification_events e on e.id=n.event_id join app.notification_receipts r on r.notification_id=n.id where n.id=$1",
    [legacy],
  )).rows[0]!;
  assert.deepEqual(imported,{id:legacy,same_created:true,same_read:true,fanout_state:"completed"});
  assert.equal((await db.query("select count(*)::int as n from ops.notification_deliveries")).rows[0]!.n,0);
  assert.equal((await db.query("select ops.backfill_notification_inbox(1) as n")).rows[0]!.n,0);

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
  assert.deepEqual(((await asRole("sim_guru_business",inbox,[b.digest])).rows[0]!.value as {items:unknown[]}).items,[]);
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

  const publish = "select ops.publish_notification($1,$2,'system','fixture',null,1,'dashboard','SiM-Guru','Pembaruan uji') as created";
  await db.query("update app.notification_preferences set email_enabled=false where user_id=$1",[a.id]);
  assert.equal((await db.query(publish,["push-only",a.id])).rows[0]!.created,true);
  assert.equal((await db.query(publish,["push-only",a.id])).rows[0]!.created,false);
  const c = await fixture("guru.push.d",true);
  await db.query("insert into app.notification_preferences(user_id,email_enabled) values($1,false)",[c.id]);
  assert.equal((await db.query(publish,["inbox-only",c.id])).rows[0]!.created,true);
  const fanout = "select ops.fanout_notification_push('staging',array[$1,$2]::uuid[],100) as n";
  await db.query(fanout,[a.id,c.id]);
  assert.equal((await db.query(fanout,[a.id,c.id])).rows[0]!.n,0);
  const channels = (await db.query(
    "select e.event_key, count(o.id)::int as emails,count(d.id)::int as pushes from ops.notification_events e join app.notifications n on n.event_id=e.id left join ops.domain_outbox o on o.dedupe_key=e.event_key left join ops.notification_deliveries d on d.notification_id=n.id where e.event_key in ('push-only','inbox-only','push-legacy') group by e.event_key order by e.event_key",
  )).rows;
  assert.deepEqual(channels,[
    {event_key:"inbox-only",emails:0,pushes:0},
    {event_key:"push-legacy",emails:1,pushes:0},
    {event_key:"push-only",emails:0,pushes:1},
  ]);
  await db.query("update app.notification_preferences set email_enabled=true where user_id=$1",[a.id]);
  assert.equal((await db.query(publish,["email-on",a.id])).rows[0]!.created,true);
  assert.equal((await db.query(publish,["email-on",a.id])).rows[0]!.created,false);
  assert.equal((await db.query("select count(*)::int as n from ops.domain_outbox where dedupe_key='email-on'")).rows[0]!.n,1);
  await assert.rejects(db.transaction(async tx => {
    await tx.query(publish,["atomic-inbox",a.id]);
    throw Error("source rollback");
  }), /source rollback/);
  assert.equal((await db.query("select count(*)::int as n from ops.notification_events where event_key='atomic-inbox'")).rows[0]!.n,0);
  assert.equal((await db.query("select count(*)::int as n from ops.domain_outbox where dedupe_key='atomic-inbox'")).rows[0]!.n,0);

  const late = (await db.query<{id:string}>(
    "insert into ops.domain_outbox(dedupe_key,recipient_id,subject,body) values('late-legacy',$1,'Pesan lama','Saat cutover') returning id",
    [c.id],
  )).rows[0]!.id;
  await db.query("insert into app.notification_receipts(user_id,outbox_id) values($1,$2)",[c.id,late]);
  assert.deepEqual((await db.query(
    "select r.notification_id,r.outbox_id,e.fanout_state from app.notification_receipts r join ops.notification_events e on e.id=r.notification_id where r.notification_id=$1",
    [late],
  )).rows[0],{notification_id:late,outbox_id:null,fanout_state:"completed"});

  const announcement = randomUUID();
  await db.query("insert into app.announcements(id,title,body,severity,target_role,target_users) values($1,'Pengumuman uji','Konten terbatas','info','all',array[$2]::uuid[])",[announcement,c.id]);
  assert.equal((await db.query("select ops.enqueue_announcements() as n")).rows[0]!.n,1);
  assert.equal((await db.query("select ops.enqueue_announcements() as n")).rows[0]!.n,0);
  const getInbox = async (session: string) =>
    (await asRole("sim_guru_business",inbox,[session])).rows[0]!.value as {items:{subject:string;body:string}[]};
  assert.ok((await getInbox(c.digest)).items.some(item => item.body === "Konten terbatas"));
  assert.ok(!(await getInbox(a.digest)).items.some(item => item.body === "Konten terbatas"));
  await db.query("update app.announcements set active=false,version=version+1 where id=$1",[announcement]);
  assert.ok(!(await getInbox(c.digest)).items.some(item => item.body === "Konten terbatas"));

  for (const name of ["sim_guru_business","sim_guru_auth","sim_guru_worker","sim_guru_bootstrap"]) {
    for (const table of ["ops.notification_events","app.notifications","app.push_installations","ops.push_subscriptions","ops.notification_deliveries"])
      await assert.rejects(asRole(name,"select * from "+table),{code:"42501"});
  }
  await assert.rejects(asRole("sim_guru_worker",devices,[a.digest]),{code:"42501"});
  await assert.rejects(db.transaction(async tx=>{await tx.query(insertEvent,[randomUUID(),"rollback-fixture",a.id]);throw Error("rollback");}),/rollback/);
  assert.equal((await db.query("select id from ops.notification_events where event_key='rollback-fixture'")).rows.length,0);
});
