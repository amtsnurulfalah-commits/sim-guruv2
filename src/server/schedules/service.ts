import { sqlJson } from "../../../scripts/lib/sql-database";
import "server-only";
import { z } from "zod";
import type {
  SqlDatabase,
  SqlParameter,
} from "../../../scripts/lib/sql-database";
import { tokenHash } from "../auth/service";
import {
  createSchedule,
  editSchedule,
  stopSchedule,
  conflictSchedule,
  scheduleFilters,
  bulkSchedule,
  bulkCommit,
  type ScheduleRow,
  type ScheduleList,
} from "../../lib/schedules/schemas";
import { date } from "../../lib/masters/schemas";
import type { DayContext } from "../../lib/calendar/schemas";
export class ScheduleService {
  constructor(private readonly db: SqlDatabase) {}
  private async query<T>(sql: string, args: readonly SqlParameter[]) {
    return (
      await this.db.transaction((tx) => tx.query<{ value: T }>(sql, args))
    ).rows[0]!.value;
  }
  async list(token: string, input: unknown, mine = false) {
    return this.query<ScheduleList>(
      "select app.schedule_list($1,$2::jsonb,$3) as value",
      [tokenHash(token), sqlJson(scheduleFilters.parse(input)), mine],
    );
  }
  async save(token: string, id: string | undefined, input: unknown) {
    const v = id ? editSchedule.parse(input) : createSchedule.parse(input);
    if (id) z.uuid().parse(id);
    return this.query<{
      schedule: ScheduleRow;
      revised: boolean;
      previousId: string | null;
    }>("select app.schedule_save($1,$2,$3,$4::jsonb,$5) as value", [
      tokenHash(token),
      id ?? null,
      "version" in v ? (v.version as string) : null,
      sqlJson(v.data),
      v.reason,
    ]);
  }
  async stop(token: string, id: string, input: unknown) {
    z.uuid().parse(id);
    const v = stopSchedule.parse(input);
    return this.query("select app.schedule_stop($1,$2,$3,$4,$5) as value", [
      tokenHash(token),
      id,
      v.version,
      v.stopFrom,
      v.reason,
    ]);
  }
  async conflicts(token: string, input: unknown) {
    const v = conflictSchedule.parse(input);
    return this.query<{
      conflicts: {
        id: string;
        teacher: boolean;
        class: boolean;
        dayIndex: number;
        timeStart: string;
        timeEnd: string;
        validFrom: string;
        validTo: string;
      }[];
      timeEnd: string;
      minutesPerJtm: number;
      authorizesMutation: false;
    }>("select app.schedule_conflicts($1,$2::jsonb,$3) as value", [
      tokenHash(token),
      sqlJson(v.data),
      v.id ?? null,
    ]);
  }
  async recaps(token: string, input: unknown) {
    return this.query<{
      rowCount: number;
      totalScheduledJtm: string;
      basis: string;
    }>("select app.schedule_recaps($1,$2::jsonb) as value", [
      tokenHash(token),
      sqlJson(scheduleFilters.parse(input)),
    ]);
  }
  async today(token: string, value: string) {
    date.parse(value);
    return this.query<{
      items: ScheduleRow[];
      scheduledCount: number;
      dayContext: DayContext;
      confirmationAvailable: true;
      journalAvailable: true;
      substitutionsAvailable: false;
    }>("select app.schedule_today($1,$2) as value", [tokenHash(token), value]);
  }
  async bulkPreview(token: string, input: unknown) {
    const v = bulkSchedule.parse(input);
    return this.query<{
      previewId: string;
      expiresAt: string;
      count: number;
      items: {
        id: string;
        teacherName: string;
        className: string;
        validFrom: string;
        validTo: string;
        stopFrom: string;
        operation: string;
      }[];
    }>("select app.schedule_bulk_preview($1,$2::jsonb) as value", [
      tokenHash(token),
      sqlJson(v),
    ]);
  }
  async bulkCommit(token: string, input: unknown) {
    const v = bulkCommit.parse(input);
    return this.query<{ committed: true; count: number }>(
      "select app.schedule_bulk_commit($1,$2) as value",
      [tokenHash(token), v.previewId],
    );
  }
  async history(token: string, id: string) {
    z.uuid().parse(id);
    return this.query<
      {
        actor_name: string;
        reason: string;
        created_at: string;
        old_data: unknown;
        new_data: unknown;
      }[]
    >("select app.master_history($1,$2,$3) as value", [
      tokenHash(token),
      "schedules",
      id,
    ]);
  }
}
