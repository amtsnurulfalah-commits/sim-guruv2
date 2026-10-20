import { loadEnvConfig } from "@next/env";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { openNativeDatabase } from "./lib/native-database";
import { encryptBackup, decryptBackup } from "./migration/backup-crypto";
import { restoreInventory } from "./migration/restore-inventory";
import { checksum } from "../src/lib/migration/profile";
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
function connection(value: string | undefined, localOnly = false) {
  if (!value) throw new Error("DATABASE_URL_REQUIRED");
  const u = new URL(value);
  if (!["postgres:", "postgresql:"].includes(u.protocol))
    throw new Error("INVALID_DATABASE_URL");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  if (localOnly && (!local || !u.pathname.endsWith("_restore_test")))
    throw new Error("DISPOSABLE_LOCAL_RESTORE_REQUIRED");
  return {
    url: value,
    local,
    env: {
      ...process.env,
      PGHOST: u.hostname,
      PGPORT: u.port || "5432",
      PGDATABASE: decodeURIComponent(u.pathname.slice(1)),
      PGUSER: decodeURIComponent(u.username),
      PGPASSWORD: decodeURIComponent(u.password),
      PGSERVICE: undefined,
      PGSERVICEFILE: undefined,
      PGHOSTADDR: undefined,
      PGOPTIONS: undefined,
      PGSSLMODE: local ? "disable" : "verify-full",
    },
  };
}
function child(
  binary: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  input?: Buffer,
) {
  return new Promise<Buffer>((resolve, reject) => {
    const p = spawn(binary, args, { env, stdio: ["pipe", "pipe", "pipe"] });
    const chunks: Buffer[] = [];
    let size = 0;
    p.stdout.on("data", (b: Buffer) => {
      size += b.length;
      if (size > 256 * 1024 * 1024) {
        p.kill();
        reject(new Error("BACKUP_SIZE_LIMIT"));
      } else chunks.push(b);
    });
    p.stderr.resume();
    p.stdin.on("error", () => {});
    p.on("error", () => reject(new Error("POSTGRES_CLIENT_REQUIRED")));
    p.on("close", (code) =>
      code === 0
        ? resolve(Buffer.concat(chunks))
        : reject(new Error("POSTGRES_TOOL_FAILED")),
    );
    if (input) p.stdin.end(input);
    else p.stdin.end();
  });
}
async function main() {
  loadEnvConfig(root);
  const [action, dir, ...extra] = process.argv.slice(2);
  if (
    !dir ||
    extra.length ||
    !["create", "verify", "restore-local"].includes(action ?? "")
  )
    throw new Error("USAGE_ACTION_PRIVATE_DIRECTORY_REQUIRED");
  const path = resolve(dir);
  if (path === root || path.startsWith(root + sep))
    throw new Error("BACKUP_OUTSIDE_REPOSITORY_REQUIRED");
  const key = process.env.BACKUP_ENCRYPTION_KEY ?? "";
  if (action === "create") {
    if (!/^[a-f0-9]{64}$/i.test(key))
      throw new Error("BACKUP_ENCRYPTION_KEY_REQUIRED");
    const c = connection(process.env.MIGRATION_DATABASE_URL),
      db = openNativeDatabase(c.url, !c.local);
    try {
      // Read-only source; financial/operational writes must be frozen so the inventories agree.
      const safe = (
        await db.query<{ safe: boolean }>(
          "select auth_private.maintenance_enabled() and not coalesce((typed_value->>'jobsEnabled')::boolean,false) and not coalesce((typed_value->>'mailEnabled')::boolean,false) and not coalesce((typed_value->>'securityMailEnabled')::boolean,false) safe from app.system_settings where key='operations.config'",
        )
      ).rows[0];
      if (!safe?.safe) throw new Error("FROZEN_SOURCE_REQUIRED");
      const before = await restoreInventory(db);
      const dump = await child(
        "pg_dump",
        [
          "--format=custom",
          "--schema=app",
          "--schema=auth_private",
          "--schema=ops",
          "--schema=finance",
          "--schema=sim_guru_migration",
        ],
        c.env,
      );
      const after = await restoreInventory(db);
      if (checksum(before) !== checksum(after))
        throw new Error("SOURCE_CHANGED_DURING_BACKUP");
      const encrypted = encryptBackup(dump, key);
      await mkdir(path, { mode: 0o700 });
      await writeFile(resolve(path, "database.enc"), encrypted.data, {
        mode: 0o600,
        flag: "wx",
      });
      await writeFile(
        resolve(path, "manifest.json"),
        JSON.stringify(
          {
            ...encrypted,
            data: undefined,
            version: 1,
            createdAt: new Date().toISOString(),
            inventory: before,
          },
          null,
          2,
        ) + "\n",
        { mode: 0o600, flag: "wx" },
      );
      console.log("Backup terenkripsi dibuat; simpan kunci secara terpisah.");
    } finally {
      await db.close();
    }
  } else {
    const manifest = JSON.parse(
        await readFile(resolve(path, "manifest.json"), "utf8"),
      ),
      bytes = decryptBackup(
        await readFile(resolve(path, "database.enc")),
        manifest,
        key,
      );
    if (action === "verify") {
      console.log(
        "Checksum dan autentikasi arsip backup valid; ini belum membuktikan restore database.",
      );
      return;
    }
    const c = connection(process.env.RESTORE_DATABASE_URL, true),
      db = openNativeDatabase(c.url);
    try {
      const n = (
        await db.query<{ n: number }>(
          "select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname not in('pg_catalog','information_schema')",
        )
      ).rows[0]!.n;
      if (n !== 0) throw new Error("EMPTY_RESTORE_DATABASE_REQUIRED");
      await db.transaction(async (tx) =>
        tx.exec(
          await readFile(
            fileURLToPath(
              new URL(
                "../supabase/migrations/202610190001_roles_and_schemas.sql",
                import.meta.url,
              ),
            ),
            "utf8",
          ),
        ),
      );
    } finally {
      await db.close();
    }
    await child(
      "pg_restore",
      [
        "--dbname",
        c.env.PGDATABASE,
        "--clean",
        "--if-exists",
        "--single-transaction",
        "--exit-on-error",
      ],
      c.env,
      bytes,
    );
    const restored = openNativeDatabase(c.url);
    try {
      const inventory = await restoreInventory(restored);
      if (checksum(inventory) !== checksum(manifest.inventory))
        throw new Error("RESTORE_INVENTORY_MISMATCH");
      await restored.transaction(async (tx) => {
        await tx.exec("SET LOCAL ROLE sim_guru_owner");
        await tx.exec(
          "UPDATE app.system_settings SET typed_value=typed_value||'{\"maintenance\":true,\"jobsEnabled\":false,\"mailEnabled\":false,\"securityMailEnabled\":false}'::jsonb,version=version+1 WHERE key='operations.config';UPDATE auth_private.app_sessions SET revoked_at=coalesce(revoked_at,clock_timestamp());UPDATE ops.domain_outbox SET state='cancelled' WHERE state IN('pending','retry_wait');UPDATE ops.notification_outbox SET state='cancelled' WHERE state IN('pending','retry_wait')",
        );
      });
      console.log(
        "Restore lokal, inventory, total finansial, checksum slip, role dan RLS cocok. Pengiriman dijeda dan sesi dicabut.",
      );
    } finally {
      await restored.close();
    }
  }
}
main().catch((e) => {
  console.error(
    e instanceof Error && /^[A-Z_]+$/.test(e.message)
      ? e.message
      : "BACKUP_OPERATION_FAILED",
  );
  process.exitCode = 1;
});
