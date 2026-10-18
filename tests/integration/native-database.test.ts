import test from "node:test";
import { loadEnvConfig } from "@next/env";
import { openNativeDatabase } from "../../scripts/lib/native-database";
import { runDatabaseSuite } from "../helpers/database-suite";

test("Tahap 1.2 — native PostgreSQL terisolasi (opsional, tidak auto-skip)", async (t) => {
  loadEnvConfig(process.cwd());
  const connection = process.env.SIM_GURU_TEST_DATABASE_URL;
  if (!connection) throw new Error("SIM_GURU_TEST_DATABASE_URL_REQUIRED");
  const url = new URL(connection);
  if (!["postgres:","postgresql:"].includes(url.protocol) || !["localhost","127.0.0.1","[::1]"].includes(url.hostname) || !url.pathname.endsWith("_test")) throw new Error("DISPOSABLE_LOCAL_TEST_DATABASE_REQUIRED");
  const database = openNativeDatabase(connection);
  t.after(() => database.close());
  await runDatabaseSuite(t,database);
});
