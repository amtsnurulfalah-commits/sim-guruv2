import "server-only";
import type {
  SqlDatabase,
  SqlParameter,
} from "../../../scripts/lib/sql-database";
import { tokenHash } from "../auth/service";
import {
  calendarChangeSchema,
  contextChangeSchema,
  calendarFilters,
  commitSchema,
  dayQuerySchema,
  type CalendarList,
  type DayContext,
  type ChangePreview,
} from "../../lib/calendar/schemas";
export class CalendarService {
  constructor(private readonly db: SqlDatabase) {}
  private async query<T>(sql: string, args: readonly SqlParameter[]) {
    return (
      await this.db.transaction((tx) => tx.query<{ value: T }>(sql, args))
    ).rows[0]!.value;
  }
  async list(token: string, input: unknown) {
    return this.query<CalendarList>(
      "select app.calendar_list($1,$2::jsonb) as value",
      [tokenHash(token), JSON.stringify(calendarFilters.parse(input))],
    );
  }
  async context(token: string, input: unknown) {
    const v = dayQuerySchema.parse(input);
    return this.query<DayContext>(
      "select app.get_day_context($1,$2) as value",
      [tokenHash(token), v.date],
    );
  }
  async preview(token: string, kind: "calendar" | "context", input: unknown) {
    const v = (
      kind === "calendar" ? calendarChangeSchema : contextChangeSchema
    ).parse(input);
    return this.query<ChangePreview>(
      "select app.calendar_preview($1,$2,$3::jsonb) as value",
      [tokenHash(token), kind, JSON.stringify(v)],
    );
  }
  async commit(
    token: string,
    kind: "calendar" | "context",
    input: unknown,
    action: string,
  ) {
    const v = commitSchema.parse(input);
    return this.query<{ committed: true; count: number }>(
      "select app.calendar_commit($1,$2,$3,$4) as value",
      [tokenHash(token), v.previewId, kind, action],
    );
  }
  async history(token: string, kind: "calendar" | "day-context", date: string) {
    dayQuerySchema.parse({ date });
    return this.query<
      {
        actor_name: string;
        reason: string;
        created_at: string;
        old_data: Record<string, unknown> | null;
        new_data: Record<string, unknown>;
      }[]
    >("select app.calendar_history($1,$2,$3) as value", [
      tokenHash(token),
      kind,
      date,
    ]);
  }
}
