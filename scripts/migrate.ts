import { loadEnvConfig } from "@next/env";
import { resolve } from "node:path";
import { readMigrations, applyMigrations } from "./lib/migrations";
import { openNativeDatabase } from "./lib/native-database";
async function main() {
  loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
  const args = new Set(process.argv.slice(2));
  if ([...args].some((arg) => !["--apply","--allow-remote"].includes(arg))) throw new Error("INVALID_ARGUMENT");
  const migrations = await readMigrations(resolve("supabase/migrations"));
  if (!args.has("--apply")) {
    for (const { name, checksum } of migrations) console.log(`${name} ${checksum}`);
    console.log("Mode rencana: tidak terhubung atau mengubah database.");
    return;
  }
  const connection = process.env.MIGRATION_DATABASE_URL;
  if (!connection) throw new Error("MIGRATION_DATABASE_URL_REQUIRED");
  const url = new URL(connection);
  if (!["postgres:","postgresql:"].includes(url.protocol)) throw new Error("INVALID_DATABASE_URL");
  const local = ["localhost","127.0.0.1","[::1]"].includes(url.hostname);
  if (!local && !args.has("--allow-remote")) throw new Error("REMOTE_APPLY_REQUIRES_EXPLICIT_FLAG");
  const database = openNativeDatabase(connection, !local);
  try { console.log(`Migrasi diterapkan: ${(await applyMigrations(database,migrations)).length}.`); }
  finally { await database.close(); }
}
main().catch((error: unknown) => {
  const message = error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : "MIGRATION_FAILED";
  console.error(message); // Jangan log URL, parameter SQL, atau stack yang memuat kredensial.
  process.exitCode = 1;
});
