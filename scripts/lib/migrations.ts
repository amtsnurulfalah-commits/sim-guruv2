import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { SqlDatabase } from "./sql-database";
export type Migration = { name: string; checksum: string; sql: string };
export async function readMigrations(directory: string): Promise<Migration[]> {
  const names = (await readdir(directory)).filter((name) => /^\d{12}_[a-z0-9_]+\.sql$/.test(name)).sort();
  const migrations = await Promise.all(names.map(async (name) => {
    const sql = await readFile(join(directory, name), "utf8");
    return { name, sql, checksum: createHash("sha256").update(sql).digest("hex") };
  }));
  if (new Set(migrations.map(({ name }) => name.slice(0, 12))).size !== migrations.length) throw new Error("DUPLICATE_MIGRATION_VERSION");
  return migrations;
}
export async function applyMigrations(database: SqlDatabase, migrations: readonly Migration[]): Promise<string[]> {
  const applied: string[] = [];
  // Satu transaksi dan advisory lock untuk seluruh batch: gagal tidak meninggalkan batch parsial.
  await database.transaction(async (transaction) => {
    await transaction.query("select pg_catalog.pg_advisory_xact_lock(734190, 0)");
    const metadataOwner = await transaction.query<{ owner: string; expected: string }>(
      "select pg_catalog.pg_get_userbyid(nspowner) as owner, current_user as expected from pg_catalog.pg_namespace where nspname='sim_guru_migration'",
    );
    if (metadataOwner.rows.some(({ owner, expected }) => owner !== expected)) throw new Error("MIGRATION_METADATA_OWNER_MISMATCH");
    await transaction.exec(`CREATE SCHEMA IF NOT EXISTS sim_guru_migration;
      REVOKE ALL ON SCHEMA sim_guru_migration FROM PUBLIC;
      CREATE TABLE IF NOT EXISTS sim_guru_migration.schema_migrations (
        name text PRIMARY KEY, checksum text NOT NULL CHECK(length(checksum)=64),
        applied_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp()
      );
      REVOKE ALL ON sim_guru_migration.schema_migrations FROM PUBLIC;`);
    const existing = await transaction.query<{ name: string; checksum: string }>("select name,checksum from sim_guru_migration.schema_migrations order by name");
    for (const prior of existing.rows) {
      const source = migrations.find(({ name }) => name === prior.name);
      if (!source) throw new Error("UNKNOWN_APPLIED_MIGRATION");
      if (source.checksum !== prior.checksum) throw new Error("MIGRATION_CHECKSUM_MISMATCH");
    }
    for (const migration of migrations) {
      if (existing.rows.some(({ name }) => name === migration.name)) continue;
      await transaction.exec(migration.sql);
      await transaction.query("insert into sim_guru_migration.schema_migrations(name,checksum) values($1,$2)", [migration.name,migration.checksum]);
      applied.push(migration.name);
    }
  });
  return applied;
}
