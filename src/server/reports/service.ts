import "server-only";
import { z } from "zod";
import { sqlJson, type SqlDatabase } from "../../../scripts/lib/sql-database";
import { tokenHash } from "../auth/service";
import {
  accessCommand,
  reportQuery,
  readReportResponse,
  type Report,
} from "../../lib/reports/contracts";
export class ReportsService {
  constructor(private readonly db: SqlDatabase) {}
  async read<T = Report>(token: string, input: unknown): Promise<T> {
    const q = z
      .union([
        z.object({ kind: z.enum(["capabilities", "access"]) }).strict(),
        reportQuery,
      ])
      .parse(input);
    return this.db.transaction(
      async (tx) =>
        (
          await tx.query<{ value: T }>(
            "select app.reports_read($1,$2::jsonb) value",
            [tokenHash(token), sqlJson(q)],
          )
        ).rows[0]!.value,
    );
  }
  async access(token: string, input: unknown) {
    return this.db.transaction(
      async (tx) =>
        (
          await tx.query("select app.report_access($1,$2::jsonb) value", [
            tokenHash(token),
            sqlJson(accessCommand.parse(input)),
          ])
        ).rows[0]!.value,
    );
  }
  async export(token: string, input: unknown) {
    const q = reportQuery.parse(input);
    return this.db.transaction(async (tx) => {
      await tx.exec("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
      const read = async (page: number) => {
        const query = {...q, page, pageSize: 1000};
        const value = (await tx.query<{value: unknown}>("select app.reports_read($1,$2::jsonb) value", [tokenHash(token),sqlJson(query)])).rows[0]!.value;
        return readReportResponse(value, new URLSearchParams(Object.entries(query).map(([key,value])=>[key,String(value)])).toString());
      };
      const first = await read(1);
      if (first.total > 10000) throw new Error("EXPORT_TOO_LARGE");
      const items = [...first.items];
      for (let p = 2; items.length < first.total; p++) {
        const next = await read(p);
        if (!next.items.length || next.total !== first.total || next.cutoff !== first.cutoff || next.mode !== first.mode ||
          Object.keys(first.summary).some(key => next.summary[key] !== first.summary[key])) throw new Error("REPORT_INCOMPLETE");
        items.push(...next.items);
        if (items.length > first.total || new Set(items.map(row=>row.id)).size !== items.length) throw new Error("REPORT_INCOMPLETE");
      }
      return { ...first, items, page: 1, pageSize: items.length };
    });
  }
}
