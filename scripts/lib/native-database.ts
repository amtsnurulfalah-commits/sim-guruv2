import postgres from "postgres";
import type { SqlDatabase, SqlExecutor } from "./sql-database";

function executor(sql: postgres.Sql | postgres.TransactionSql): SqlExecutor {
  return {
    async exec(statement) { await sql.unsafe(statement).simple(); },
    async query<T extends Record<string, unknown>>(statement: string, parameters = []) {
      const rows = await sql.unsafe<T[]>(statement, [...parameters]);
      return { rows: [...rows] };
    },
  };
}
export function openNativeDatabase(url: string, production = false): SqlDatabase {
  const sql = postgres(url, { max: 1, prepare: false, ...(production ? { ssl: true } : {}), onnotice: () => {} });
  return {
    ...executor(sql),
    async transaction<T>(work: (transaction: SqlExecutor) => Promise<T>) {
      const result = await sql.begin(async (transaction) => ({ value: await work(executor(transaction)) }));
      return result.value;
    },
    async close() { await sql.end({ timeout: 5 }); },
  };
}
