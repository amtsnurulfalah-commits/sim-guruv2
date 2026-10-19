import "server-only";
import { z } from "zod";
import { sqlJson, type SqlDatabase } from "../../../scripts/lib/sql-database";
import { tokenHash } from "../auth/service";
import {
  commands,
  commandSchemas,
  dayFilter,
  historyFilter,
  reads,
  type Command,
} from "../../lib/activities/schemas";
export class ActivityService {
  constructor(private readonly db: SqlDatabase) {}
  async read(token: string, kind: string, input: unknown): Promise<unknown> {
    const k = z.enum(reads).parse(kind);
    const filter = ["occurrences", "eligible", "students-progress"].includes(k)
      ? dayFilter.parse(input)
      : ["options", "blocks", "templates"].includes(k)
        ? z.object({}).strict().parse(input)
        : historyFilter
            .refine(
              (v) =>
                (k === "journals" || !v.q) &&
                (["attendance", "journals"].includes(k) || !v.userId),
            )
            .parse(input);
    return this.db.transaction(
      async (tx) =>
        (
          await tx.query<{ value: unknown }>(
            k === "occurrences"
              ? "select app.occurrences_list($1,$2::date) as value"
              : "select app.activity_read($1,$2,$3::jsonb) as value",
            k === "occurrences"
              ? [tokenHash(token), (filter as { date: string }).date]
              : [tokenHash(token), k, sqlJson(filter)],
          )
        ).rows[0]!.value,
    );
  }
  async command(
    token: string,
    command: string,
    input: unknown,
  ): Promise<unknown> {
    const k = z.enum(commands as [Command, ...Command[]]).parse(command);
    const value = commandSchemas[k].parse(input);
    return this.db.transaction(async (tx) => {
      let sql: string;
      let args;
      if (["claim", "confirm", "revoke"].includes(k)) {
        const v = value as {
          occurrenceId: string;
          version: string;
          reason: string;
        };
        sql = "select app.occurrence_command($1,$2,$3,$4,$5) as value";
        args = [tokenHash(token), v.occurrenceId, k, v.version, v.reason];
      } else if (k === "students-save") {
        sql = "select app.students_save($1,$2::jsonb) as value";
        args = [tokenHash(token), sqlJson(value)];
      } else {
        const fn = k.startsWith("template-")
          ? "attendance_template"
          : k.startsWith("journal-")
            ? "journal_save"
            : ["h1", "block"].includes(k)
              ? "activity_settings"
              : "attendance_command";
        sql = `select app.${fn}($1,$2,$3::jsonb) as value`;
        args = [
          tokenHash(token),
          k.replace(/^(template|journal)-/, ""),
          sqlJson(value),
        ];
      }
      return (await tx.query<{ value: unknown }>(sql, args)).rows[0]!.value;
    });
  }
  async exportRows(
    token: string,
    kind: "attendance" | "journals",
    input: unknown,
  ) {
    const filter = historyFilter
        .refine((v) => kind === "journals" || !v.q)
        .parse(input),
      items: Record<string, unknown>[] = [];
    // Reauthorize every batch and hold a repeatable snapshot for one consistent export.
    return this.db.transaction(async (tx) => {
      await tx.exec("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
      for (let page = 1; ; page++) {
        const v = (
          await tx.query<{
            value: { items: Record<string, unknown>[]; total: number };
          }>("select app.activity_read($1,$2,$3::jsonb) as value", [
            tokenHash(token),
            kind,
            sqlJson({ ...filter, page, pageSize: 100 }),
          ])
        ).rows[0]!.value;
        items.push(...v.items);
        if (items.length >= v.total) break;
        if (items.length >= 10000) throw new Error("EXPORT_TOO_LARGE");
      }
      return items;
    });
  }
}
