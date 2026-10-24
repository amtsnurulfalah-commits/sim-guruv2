import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { openPgliteDatabase } from "../helpers/pglite-database";
import { applyMigrations, readMigrations } from "../../scripts/lib/migrations";
import { restoreInventory } from "../../scripts/migration/restore-inventory";
import { backupContext, compareRestoredInventory, isolateRestoredDatabase } from "../../scripts/migration/recovery";
import { encryptBackup, decryptBackup } from "../../scripts/migration/backup-crypto";

test("Professional Stage8 — complete-schema security and recovery regression", async t => {
  const db = await openPgliteDatabase(); t.after(() => db.close());
  await applyMigrations(db, await readMigrations("supabase/migrations"));
  await t.test("all installed private tables have FORCE RLS and no PUBLIC grants", async () => {
    const rows = (await db.query(`select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('app','auth_private','ops','finance') and c.relkind='r' and (not c.relrowsecurity or not c.relforcerowsecurity or exists(select 1 from aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a where a.grantee=0))`)).rows;
    assert.deepEqual(rows, []);
  });
  await t.test("all definer routines pin trusted search_path; no PUBLIC execute", async () => {
    const rows = (await db.query(`select n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('app','auth_private','ops','finance') and (exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE') or p.prosecdef and not exists(select 1 from unnest(p.proconfig) setting where setting like 'search_path=%' and setting not like '%public%' and setting not like '%$user%'))`)).rows;
    assert.deepEqual(rows, []);
  });
  const original = await restoreInventory(db);
  await t.test("same-count content drift and privilege drift invalidate inventory", async () => {
    await db.exec("update app.system_settings set typed_value='true'::jsonb where key='journals.h1_enabled'");
    let changed = await restoreInventory(db);
    // A guaranteed field change, independent of whether that optional setting exists.
    await db.exec("update app.system_settings set version=version+1 where key='operations.config'");
    changed = await restoreInventory(db);
    assert.deepEqual(changed.counts, original.counts);
    assert.notDeepEqual(changed.content, original.content);
    assert.throws(() => compareRestoredInventory(changed, { version: 2, inventory: original }), /RESTORE_INVENTORY_MISMATCH/);
    await db.exec("grant execute on function finance.digest(text) to public");
    const grants = await restoreInventory(db);
    assert.notEqual(grants.schemaDigest, changed.schemaDigest);
    await db.exec("revoke execute on function finance.digest(text) from public");
  });
  await t.test("v2 manifest modification, wrong key, truncation and downgrade cannot authenticate", () => {
    const metadata = { version: 2, createdAt: new Date().toISOString(), inventory: original }, key = randomBytes(32).toString("hex"), bytes = Buffer.from("synthetic pg_dump bytes");
    const encrypted = encryptBackup(bytes, key, backupContext(metadata));
    assert.deepEqual(decryptBackup(encrypted.data, encrypted, key, backupContext(metadata)), bytes);
    assert.throws(() => decryptBackup(encrypted.data, encrypted, key, backupContext({ ...metadata, inventory: {} })));
    assert.throws(() => decryptBackup(encrypted.data, encrypted, key));
    assert.throws(() => decryptBackup(encrypted.data, encrypted, randomBytes(32).toString("hex"), backupContext(metadata)));
    assert.throws(() => decryptBackup(encrypted.data.subarray(1), encrypted, key, backupContext(metadata)));
  });
  await t.test("legacy archives retain explicitly limited comparison compatibility", () => {
    const { counts, finance, roles, rls } = original;
    compareRestoredInventory(original, { version: 1, inventory: { counts, finance, roles, rls } });
    compareRestoredInventory(original, { version: 2, inventory: original });
    assert.throws(() => compareRestoredInventory(original, { version: 9, inventory: original }));
  });
  await t.test("restore isolation revokes sessions, disables dispatch and neutralizes in-flight jobs", async () => {
    const id = (await db.query<{id:string}>("insert into app.app_users(username,full_name,role,status) values('release.fixture','Release Fixture','guru','pending_activation') returning id")).rows[0]!.id;
    await db.query("insert into ops.domain_outbox(dedupe_key,recipient_id,subject,body,state,lease_token,lease_until) values('drill',$1,'synthetic','synthetic','sending',gen_random_uuid(),clock_timestamp()+interval '1 hour')", [id]);
    await isolateRestoredDatabase(db);
    const row = (await db.query<{state:string;lease_token:string|null}>("select state,lease_token from ops.domain_outbox where dedupe_key='drill'")).rows[0]!;
    assert.equal(row.state, "cancelled"); assert.equal(row.lease_token, null);
    const flags = (await db.query<{typed_value:Record<string,boolean>}>("select typed_value from app.system_settings where key='operations.config'")).rows[0]!.typed_value;
    assert.equal(flags.maintenance, true); for (const flag of ['jobsEnabled','mailEnabled','securityMailEnabled']) assert.equal(flags[flag], false);
  });
});
