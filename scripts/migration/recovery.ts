import { checksum } from "../../src/lib/migration/profile";
import type { SqlDatabase } from "../lib/sql-database";
import type { restoreInventory } from "./restore-inventory";
type Inventory = Awaited<ReturnType<typeof restoreInventory>>;
/** Authenticate manifest metadata as well as dump bytes; no secrets are added to logs. */
export function backupContext(metadata: { version: number; createdAt: string; inventory: unknown }) {
  if (metadata.version !== 2 || !Number.isFinite(Date.parse(metadata.createdAt))) throw Error("BACKUP_MANIFEST_INVALID");
  return "sim-guru-backup-v2:" + checksum({ version: metadata.version, createdAt: metadata.createdAt, inventory: metadata.inventory });
}
export function compareRestoredInventory(actual: Inventory, manifest: { version: number; inventory: unknown }) {
  if (![1, 2].includes(manifest.version)) throw Error("BACKUP_MANIFEST_INVALID");
  const comparable = manifest.version === 2 ? actual : { counts: actual.counts, finance: actual.finance, roles: actual.roles, rls: actual.rls };
  if (checksum(comparable) !== checksum(manifest.inventory)) throw Error("RESTORE_INVENTORY_MISMATCH");
}
export async function isolateRestoredDatabase(db: SqlDatabase) {
  await db.transaction(async tx => {
    await tx.exec("SET LOCAL ROLE sim_guru_owner");
    await tx.exec(`UPDATE app.system_settings SET typed_value=typed_value||'{"maintenance":true,"jobsEnabled":false,"mailEnabled":false,"securityMailEnabled":false}'::jsonb,version=version+1 WHERE key='operations.config';
      UPDATE auth_private.app_sessions SET revoked_at=coalesce(revoked_at,clock_timestamp());
      UPDATE ops.domain_outbox SET state='cancelled',lease_token=null,lease_until=null WHERE state IN('pending','retry_wait','sending','unknown');
      UPDATE ops.notification_outbox SET state='cancelled',lease_token=null,lease_until=null WHERE state IN('pending','retry_wait','sending','unknown');
      UPDATE finance.notification_outbox SET state='failed' WHERE state='pending';
      DELETE FROM ops.worker_tickets;
      DELETE FROM auth_private.outbox_secrets;
      UPDATE auth_private.verification_challenges SET superseded_at=coalesce(superseded_at,clock_timestamp()) WHERE consumed_at IS NULL;`);
  });
}
