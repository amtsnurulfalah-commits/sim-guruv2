import "server-only";
import { sqlJson, type SqlDatabase } from "../../../scripts/lib/sql-database";
import { tokenHash } from "../auth/service";
import {
  readSchema,
  commandSchemas,
  verifySchema,
  type FinanceAction,
  type HonorHistory,
  type HonorStatement,
} from "../../lib/finance/schemas";
export class FinanceService {
  constructor(private readonly db: SqlDatabase) {}
  private async call<T>(
    sql: string,
    args: Parameters<SqlDatabase["query"]>[1],
  ) {
    return this.db.transaction(
      async (tx) => (await tx.query<{ value: T }>(sql, args)).rows[0]!.value,
    );
  }
  async read<T = unknown>(token: string, input: unknown) {
    return this.call<T>("select app.finance_read($1,$2::jsonb) as value", [
      tokenHash(token),
      sqlJson(readSchema.parse(input)),
    ]);
  }
  async command<T = unknown>(
    token: string,
    action: FinanceAction,
    input: unknown,
  ) {
    return this.call<T>(
      "select app.finance_command($1,$2,$3::jsonb) as value",
      [tokenHash(token), action, sqlJson(commandSchemas[action].parse(input))],
    );
  }
  async verify(input: unknown) {
    const v = verifySchema.parse(input);
    return this.call<{
      status: string;
      documentType?: string;
      period?: string;
      school?: string;
      recipient?: string;
    }>("select app.finance_verify($1) as value", [v.token]);
  }
  // Exports traverse the same scoped server filter, including all matching pages.
  async exportHistory(token: string, input: unknown) {
    const q = readSchema.parse(input);
    if (q.kind !== "history") throw new Error("FINANCE_INVALID");
    return this.db.transaction(async (tx) => {
      await tx.exec("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
      const pageRead = async (page: number) =>
        (
          await tx.query<{ value: HonorHistory }>(
            "select app.finance_read($1,$2::jsonb) as value",
            [tokenHash(token), sqlJson({ ...q, page, pageSize: 100 })],
          )
        ).rows[0]!.value;
      const first = await pageRead(1);
      if (first.total > 10000) throw new Error("EXPORT_TOO_LARGE");
      const items = [...first.items];
      for (let page = 2; items.length < first.total; page++) {
        const r = await pageRead(page);
        if (!r.items.length) break;
        items.push(...r.items);
      }
      return items;
    });
  }

  statement(token: string, id: string) {
    return this.read<HonorStatement>(token, { kind: "statement", id });
  }
}
