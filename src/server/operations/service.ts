import "server-only";
import { z } from "zod";
import { sqlJson, type SqlDatabase } from "../../../scripts/lib/sql-database";
import { tokenHash } from "../auth/service";
import { commands } from "../../lib/operations/schemas";
export class OperationsService {
  constructor(private readonly db: SqlDatabase) {}
  async read(token: string, kind: string, input: unknown = {}) {
    z.object({}).strict().parse(input);
    z.enum(["announcements", "manage", "operations"]).parse(kind);
    return this.db.transaction(
      async (tx) =>
        (
          await tx.query<{ value: unknown }>(
            "select app.operations_read($1,$2) as value",
            [tokenHash(token), kind],
          )
        ).rows[0]!.value,
    );
  }
  async command(token: string, kind: string, input: unknown) {
    const k = z
      .enum([
        "job-retry",
        "save",
        "deactivate",
        "dismiss",
        "settings",
        "retry",
        "reconcile",
      ])
      .parse(kind);
    const data = commands[k].parse(input);
    return this.db.transaction(
      async (tx) =>
        (
          await tx.query<{ value: unknown }>(
            "select app.operations_command($1,$2,$3::jsonb) as value",
            [tokenHash(token), k, sqlJson(data)],
          )
        ).rows[0]!.value,
    );
  }
}
