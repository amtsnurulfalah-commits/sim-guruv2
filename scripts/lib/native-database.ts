import { postgresExecutor as executor } from "./postgres-executor";
import postgres from "postgres";
import type { SqlDatabase, SqlExecutor } from "./sql-database";

export function openNativeDatabase(
  url: string,
  production = false,
): SqlDatabase {
  const sql = postgres(url, {
    max: 1,
    prepare: false,
    ...(production ? { ssl: true } : {}),
    onnotice: () => {},
  });
  return {
    ...executor(sql),
    async transaction<T>(work: (transaction: SqlExecutor) => Promise<T>) {
      const result = await sql.begin(async (transaction) => ({
        value: await work(executor(transaction)),
      }));
      return result.value;
    },
    async close() {
      await sql.end({ timeout: 5 });
    },
  };
}
