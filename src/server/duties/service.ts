import "server-only";
import { sqlJson, type SqlDatabase } from "../../../scripts/lib/sql-database";
import { tokenHash } from "../auth/service";
import {
  querySchema,
  operationSchema,
  commitSchema,
  dutyScheduleSchema,
  type DutyBoard,
  type DutyPreview,
  type DutyOccurrence,
} from "../../lib/duties/schemas";
export class DutyService {
  constructor(private readonly db: SqlDatabase) {}
  async read(token: string, input: unknown): Promise<DutyBoard> {
    const v = querySchema.parse(input);
    return this.db.transaction(
      async (tx) =>
        (
          await tx.query<{ value: DutyBoard }>(
            "select app.duty_read($1,$2::date) as value",
            [tokenHash(token), v.date],
          )
        ).rows[0]!.value,
    );
  }
  async preview(token: string, input: unknown): Promise<DutyPreview> {
    const v = operationSchema.parse(input);
    return this.db.transaction(
      async (tx) =>
        (
          await tx.query<{ value: DutyPreview }>(
            "select app.duty_preview($1,$2::jsonb) as value",
            [tokenHash(token), sqlJson(v)],
          )
        ).rows[0]!.value,
    );
  }
  async commit(token: string, input: unknown): Promise<DutyOccurrence> {
    const v = commitSchema.parse(input);
    return this.db.transaction(
      async (tx) =>
        (
          await tx.query<{ value: DutyOccurrence }>(
            "select app.duty_commit($1,$2) as value",
            [tokenHash(token), v.previewId],
          )
        ).rows[0]!.value,
    );
  }
  async schedule(token: string, input: unknown) {
    const { id, ...data } = dutyScheduleSchema.parse(input);
    return this.db.transaction(
      async (tx) =>
        (
          await tx.query<{ value: unknown }>(
            "select app.duty_schedule_save($1,$2,$3::jsonb) as value",
            [tokenHash(token), id ?? null, sqlJson(data)],
          )
        ).rows[0]!.value,
    );
  }
}
