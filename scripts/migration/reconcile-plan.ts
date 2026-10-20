import { sqlJson, type SqlDatabase } from "../lib/sql-database";
import { planSchema, planHash } from "../../src/lib/migration/plan";
/** Compare native typed values, including NUMERIC, entirely inside PostgreSQL. */
export async function reconcilePlan(db: SqlDatabase, input: unknown) {
  const p = planSchema.parse(input),
    hash = planHash(p);
  return db.transaction(async (tx) => {
    await tx.query("select pg_advisory_xact_lock(734190,1)");
    await tx.exec("SET LOCAL ROLE sim_guru_owner");
    const b = (
      await tx.query<{ plan_hash: string; state: string }>(
        "select plan_hash,state from ops.migration_batches where id=$1 for update",
        [p.batchId],
      )
    ).rows[0];
    if (
      !b ||
      b.plan_hash !== hash ||
      !["imported", "reconciled"].includes(b.state)
    )
      throw new Error("IMPORTED_PLAN_MISMATCH");
    const rows = [];
    for (const e of p.entries) {
      const pk = (
        await tx.query<{ name: string }>(
          "select a.attname name from pg_attribute a join pg_index i on i.indrelid=a.attrelid and i.indisprimary and a.attnum=any(i.indkey) where a.attrelid=$1::regclass",
          [e.targetTable],
        )
      ).rows.map((x) => x.name);
      if (!pk.length) throw new Error("MISSING_PRIMARY_KEY");
      const names = Object.keys(e.values);
      if (names.some((k) => !/^[a-z][a-z0-9_]*$/.test(k)))
        throw new Error("INVALID_COLUMN");
      const identity = pk
        .map((k) => `t."${k}" is not distinct from p."${k}"`)
        .join(" AND ");
      const comparisons = names
        .map((k) => `t."${k}" is not distinct from p."${k}"`)
        .join(" AND ");
      const x = (
        await tx.query<{ count: number; matched: boolean }>(
          `select count(*)::int count,coalesce(bool_and(${comparisons}),false) matched from ${e.targetTable} t cross join jsonb_populate_record(null::${e.targetTable},$1::jsonb) p where ${identity}`,
          [sqlJson(e.values)],
        )
      ).rows[0]!;
      rows.push({
        sourceTable: e.sourceTable,
        legacyId: e.legacyId,
        targetTable: e.targetTable,
        matched: x.count === 1 && x.matched,
      });
    }
    const matched = rows.every((r) => r.matched);
    if (matched)
      await tx.query(
        "update ops.migration_batches set state='reconciled',version=version+1 where id=$1",
        [p.batchId],
      );
    return { version: 1, batchId: p.batchId, planHash: hash, matched, rows };
  });
}
