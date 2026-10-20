import { sqlJson, type SqlDatabase } from "../lib/sql-database";
import { planSchema, planHash } from "../../src/lib/migration/plan";
import { checksum } from "../../src/lib/migration/profile";
/** Operator connection only. Native constraints, triggers and final guards stay enabled. */
export async function applyImportPlan(
  db: SqlDatabase,
  input: unknown,
  expectedHash: string,
) {
  const p = planSchema.parse(input),
    hash = planHash(p);
  if (hash !== expectedHash) throw new Error("PLAN_HASH_MISMATCH");
  return db.transaction(async (tx) => {
    await tx.query("select pg_advisory_xact_lock(734190,1)");
    await tx.exec("SET LOCAL ROLE sim_guru_owner");
    const b = (
      await tx.query<{
        id: string;
        source: string;
        source_checksum: string;
        state: string;
        plan_hash: string | null;
        imported_at: string | null;
        created_by: string;
      }>("select * from ops.migration_batches where id=$1 for update", [
        p.batchId,
      ])
    ).rows[0];
    if (!b || b.source_checksum !== p.sourceChecksum)
      throw new Error("SOURCE_BATCH_MISMATCH");
    if (b.imported_at || ["imported", "reconciled"].includes(b.state)) {
      if (b.plan_hash !== hash) throw new Error("IMPORTED_PLAN_IMMUTABLE");
      return { replayed: true, inserted: 0 };
    }
    if (b.state !== "validated") throw new Error("MIGRATION_NOT_VALIDATED");
    const pending = (
      await tx.query(
        "select 1 from ops.migration_issues where batch_id=$1 and resolution is null",
        [b.id],
      )
    ).rows;
    if (pending.length) throw new Error("UNRESOLVED_MIGRATION_ISSUES");
    const config = (
      await tx.query<{ safe: boolean }>(
        "select auth_private.maintenance_enabled() and not coalesce((typed_value->>'mailEnabled')::boolean,false) and not coalesce((typed_value->>'securityMailEnabled')::boolean,false) and not coalesce((typed_value->>'jobsEnabled')::boolean,false) safe from app.system_settings where key='operations.config'",
      )
    ).rows[0];
    if (!config?.safe)
      throw new Error("MAINTENANCE_AND_PAUSED_DISPATCH_REQUIRED");
    const approval = (
      await tx.query<{ n: number }>(
        "select count(*)::int n from ops.migration_gates where batch_id=$1 and passed and gate in('source_backup','restore_drill','rollback_plan')",
        [b.id],
      )
    ).rows[0];
    if (approval?.n !== 3) throw new Error("IMPORT_EVIDENCE_INCOMPLETE");
    await tx.exec(
      "CREATE TEMP TABLE migration_prior_outbox ON COMMIT DROP AS SELECT id FROM ops.domain_outbox",
    );
    let inserted = 0;
    for (const e of p.entries) {
      const source = (
        await tx.query(
          "select 1 from ops.migration_staging_rows where batch_id=$1 and source_table=$2 and legacy_id=$3",
          [b.id, e.sourceTable, e.legacyId],
        )
      ).rows;
      if (source.length !== 1) throw new Error("STAGING_SOURCE_NOT_UNIQUE");
      const columns = (
        await tx.query<{ name: string; primary: boolean }>(
          "select a.attname name,exists(select 1 from pg_index i where i.indrelid=a.attrelid and i.indisprimary and a.attnum=any(i.indkey)) primary from pg_attribute a where a.attrelid=$1::regclass and a.attnum>0 and not a.attisdropped and a.attgenerated=''",
          [e.targetTable],
        )
      ).rows;
      const valid = new Set(columns.map((c) => c.name)),
        keys = Object.keys(e.values);
      if (!keys.length || keys.some((k) => !valid.has(k)))
        throw new Error("UNKNOWN_TARGET_COLUMN");
      const primary = columns.filter((c) => c.primary).map((c) => c.name);
      if (
        !primary.length ||
        primary.some((k) => e.values[k] === undefined || e.values[k] === null)
      )
        throw new Error("EXPLICIT_TARGET_KEY_REQUIRED");
      const key = Object.fromEntries(primary.map((k) => [k, e.values[k]])),
        payloadHash = checksum(e.values);
      const old = (
        await tx.query<{
          payload_hash: string;
          target_table: string;
          target_key: unknown;
        }>(
          "select payload_hash,target_table,target_key from ops.migration_id_map where source=$1 and source_table=$2 and legacy_id=$3 and target_table=$4",
          [b.source, e.sourceTable, e.legacyId, e.targetTable],
        )
      ).rows[0];
      if (old) {
        if (
          old.payload_hash !== payloadHash ||
          old.target_table !== e.targetTable ||
          checksum(old.target_key) !== checksum(key)
        )
          throw new Error("DELTA_UPDATE_REVIEW_REQUIRED");
        continue;
      }
      const names = keys.map((k) => '"' + k + '"').join(",");
      // The table is a closed enum; columns have been checked against pg_attribute.
      await tx.query(
        `insert into ${e.targetTable}(${names}) select ${names} from jsonb_populate_record(null::${e.targetTable},$1::jsonb)`,
        [sqlJson(e.values)],
      );
      await tx.query(
        "insert into ops.migration_id_map(source,source_table,legacy_id,target_table,target_key,payload_hash,batch_id) values($1,$2,$3,$4,$5::jsonb,$6,$7)",
        [
          b.source,
          e.sourceTable,
          e.legacyId,
          e.targetTable,
          sqlJson(key),
          payloadHash,
          b.id,
        ],
      );
      inserted++;
    }
    await tx.exec(
      "UPDATE ops.domain_outbox o SET state='cancelled' WHERE o.state IN('pending','retry_wait') AND NOT EXISTS(SELECT 1 FROM migration_prior_outbox p WHERE p.id=o.id)",
    );
    await tx.query(
      "update ops.migration_batches set state='imported',plan_hash=$2,imported_at=clock_timestamp(),version=version+1 where id=$1",
      [b.id, hash],
    );
    await tx.query(
      "insert into ops.audit_logs(actor_id,action,entity_id,reason,redacted_changes) values($1,'migration.import',$2,$3,$4::jsonb)",
      [b.created_by, b.id, p.reason, sqlJson({ inserted, planHash: hash })],
    );
    return { replayed: false, inserted };
  });
}
