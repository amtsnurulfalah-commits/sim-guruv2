import type postgres from "postgres";
import {
  SqlJsonParameter,
  type SqlExecutor,
  type SqlParameter,
} from "./sql-database";

/** Shared by production and native tests, including transaction clients. */
export function postgresExecutor(
  sql: postgres.Sql | postgres.TransactionSql,
): SqlExecutor {
  return {
    async exec(statement) {
      await sql.unsafe(statement).simple();
    },
    async query<T extends Record<string, unknown>>(
      statement: string,
      parameters: readonly SqlParameter[] = [],
    ) {
      const values = parameters.map((parameter) =>
        // Explicit text OID: the SQL ::jsonb cast parses JSON once. Inferred jsonb
        // otherwise makes Postgres.js JSON.stringify an already encoded string.
        parameter instanceof SqlJsonParameter
          ? sql.typed(parameter.text, 25)
          : parameter,
      );
      const rows = await sql.unsafe<T[]>(statement, values);
      return { rows: [...rows] };
    },
  };
}
