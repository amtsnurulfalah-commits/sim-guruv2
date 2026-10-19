import { SqlJsonParameter } from "../../scripts/lib/sql-database";
import { PGlite } from "@electric-sql/pglite";
import type {
  SqlDatabase,
  SqlExecutor,
  SqlParameter,
} from "../../scripts/lib/sql-database";
interface Queryable {
  exec(sql: string): Promise<unknown>;
  query<T extends Record<string, unknown>>(
    sql: string,
    params?: (string | number | boolean | null)[],
  ): Promise<{ rows: T[] }>;
}
function executor(database: Queryable): SqlExecutor {
  return {
    async exec(statement) {
      await database.exec(statement);
    },
    async query<T extends Record<string, unknown>>(
      statement: string,
      parameters: readonly SqlParameter[] = [],
    ) {
      return database.query<T>(
        statement,
        parameters.map((p) => (p instanceof SqlJsonParameter ? p.text : p)),
      );
    },
  };
}
export async function openPgliteDatabase(
  existing?: PGlite,
): Promise<SqlDatabase> {
  const database = existing ?? (await PGlite.create());
  return {
    ...executor(database),
    transaction: (work) =>
      database.transaction((transaction) => work(executor(transaction))),
    close: () => database.close(),
  };
}
