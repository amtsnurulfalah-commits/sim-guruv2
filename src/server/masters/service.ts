import { sqlJson } from "../../../scripts/lib/sql-database";
import "server-only";
import { z } from "zod";
import type {
  SqlDatabase,
  SqlParameter,
} from "../../../scripts/lib/sql-database";
import { tokenHash, AuthError } from "../auth/service";
import {
  kindSchema,
  mutationSchema,
  payloadSchemas,
  filtersSchema,
  type MasterList,
  type MasterRow,
} from "../../lib/masters/schemas";
const snake = (s: string) => s.replace(/[A-Z]/g, (v) => "_" + v.toLowerCase());
const camel = (s: string) =>
  s.replace(/_([a-z])/g, (_, v: string) => v.toUpperCase());
function dto(row: Record<string, unknown>): MasterRow {
  return Object.fromEntries(
    Object.entries(row)
      .filter(([k]) => !["singleton", "normalized_name"].includes(k))
      .map(([k, v]) => [
        camel(k),
        k === "version" || k === "amount" ? String(v) : v,
      ]),
  ) as MasterRow;
}
export class MasterService {
  constructor(private readonly db: SqlDatabase) {}
  private query<T extends Record<string, unknown>>(
    sql: string,
    args: readonly SqlParameter[],
  ) {
    return this.db.transaction((tx) => tx.query<T>(sql, args));
  }
  async list(token: string, kind: unknown, input: unknown) {
    const k = kindSchema.parse(kind),
      filter = filtersSchema.parse(input);
    const value = (
      await this.query<{ value: MasterList }>(
        "select app.master_list($1,$2,$3::jsonb) as value",
        [tokenHash(token), k, sqlJson(filter)],
      )
    ).rows[0]!.value;
    return { ...value, items: value.items.map(dto) };
  }
  async save(token: string, kind: unknown, input: unknown, archive = false) {
    const k = kindSchema.parse(kind),
      v = mutationSchema.parse(input);
    if (archive && !v.id) throw new AuthError("VALIDATION_ERROR", 422);
    const data = archive ? null : payloadSchemas[k].parse(v.data);
    const mapped = data
      ? Object.fromEntries(
          Object.entries(data).map(([key, value]) => [
            snake(key),
            key === "headmasterId" && value === "" ? null : value,
          ]),
        )
      : null;
    return dto(
      (
        await this.query<{ value: Record<string, unknown> }>(
          "select app.master_save($1,$2,$3,$4,$5::jsonb,$6,$7) as value",
          [
            tokenHash(token),
            k,
            v.id ?? null,
            v.version,
            mapped ? sqlJson(mapped) : null,
            archive,
            v.reason,
          ],
        )
      ).rows[0]!.value,
    );
  }
  async history(token: string, kind: unknown, id: string) {
    const k = kindSchema.parse(kind);
    z.uuid().parse(id);
    return (
      await this.query<{ value: unknown[] }>(
        "select app.master_history($1,$2,$3) as value",
        [tokenHash(token), k, id],
      )
    ).rows[0]!.value;
  }
}
