import "server-only";
import { z } from "zod";
import { sqlJson, type SqlDatabase } from "../../../scripts/lib/sql-database";
import { tokenHash } from "../auth/service";
import { profileExport } from "../../lib/migration/profile";
import { gateSchema } from "../../lib/migration/contracts";
export class MigrationService {
  constructor(private readonly db: SqlDatabase) {}
  async read(token: string, kind: string, input: unknown = {}) {
    z.literal("board").parse(kind);
    const q = z.object({ id: z.uuid().optional() }).strict().parse(input);
    return this.call("select app.migration_read($1,$2::uuid) value", [
      tokenHash(token),
      q.id ?? null,
    ]);
  }
  async command(token: string, kind: string, input: unknown) {
    if (kind === "stage") {
      const p = profileExport(input);
      return this.call("select app.migration_stage($1,$2::jsonb) value", [
        tokenHash(token),
        sqlJson(p),
      ]);
    }
    const data =
      kind === "gate"
        ? gateSchema.parse(input)
        : z
            .object({
              batchId: z.uuid(),
              version: z.string().regex(/^[1-9][0-9]*$/),
              sequence: z.number().int().positive(),
              evidence: z.string().trim().min(10).max(1000),
              reason: z.string().trim().min(5).max(500),
            })
            .strict()
            .parse(input);
    z.enum(["gate", "resolve"]).parse(kind);
    return this.call("select app.migration_command($1,$2,$3::jsonb) value", [
      tokenHash(token),
      kind,
      sqlJson(data),
    ]);
  }
  private call(sql: string, args: Parameters<SqlDatabase["query"]>[1]) {
    return this.db.transaction(
      async (tx) =>
        (await tx.query<{ value: unknown }>(sql, args)).rows[0]!.value,
    );
  }
}
