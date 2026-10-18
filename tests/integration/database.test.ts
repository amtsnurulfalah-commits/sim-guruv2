import test from "node:test";
import { openPgliteDatabase } from "../helpers/pglite-database";
import { runDatabaseSuite } from "../helpers/database-suite";
test("Tahap 1.2 — engine PostgreSQL WASM / PGlite (bukan native/pooling)", async (t) => {
  const database = await openPgliteDatabase();
  t.after(() => database.close());
  await runDatabaseSuite(t,database);
});
