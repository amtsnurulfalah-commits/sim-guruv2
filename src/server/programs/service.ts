import "server-only";
import { sqlJson, type SqlDatabase } from "../../../scripts/lib/sql-database";
import { tokenHash } from "../auth/service";
import * as s from "../../lib/programs/schemas";
export class ProgramService {
  constructor(private readonly db: SqlDatabase) {}
  private call<T>(token: string, fn: string, args: unknown) {
    return this.db.transaction(
      async (tx) =>
        (
          await tx.query<{ value: T }>(
            `select app.${fn}($1,$2::jsonb) as value`,
            [tokenHash(token), sqlJson(args)],
          )
        ).rows[0]!.value,
    );
  }
  async read(token: string, input: unknown) {
    const q = s.readSchema.parse(input);
    if (q.domain === "exams")
      return this.db.transaction(
        async (tx) =>
          (
            await tx.query<{ value: s.ExamBoard }>(
              "select app.exam_read($1,$2::date,$3::uuid) as value",
              [tokenHash(token), q.date, q.periodId ?? null],
            )
          ).rows[0]!.value,
      );
    return this.call<s.EventBoard>(token, "event_read", q);
  }
  async saveExam(token: string, input: unknown) {
    return this.call(token, "exam_save", s.examSaveSchema.parse(input));
  }
  async deleteExam(token: string, input: unknown) {
    return this.call<s.Impact>(
      token,
      "exam_delete",
      s.deleteSchema.parse(input),
    );
  }
  async bap(token: string, input: unknown) {
    return this.call<s.Bap>(token, "exam_bap_save", s.bapSchema.parse(input));
  }
  async preview(token: string, input: unknown) {
    return this.call<s.Impact>(
      token,
      "duty_preview",
      s.operationSchema.parse(input),
    );
  }
  async commit(token: string, input: unknown) {
    const q = s.commitSchema.parse(input);
    return this.db.transaction(
      async (tx) =>
        (
          await tx.query<{ value: unknown }>(
            "select app.duty_commit($1,$2::uuid) as value",
            [tokenHash(token), q.previewId],
          )
        ).rows[0]!.value,
    );
  }
  async saveEvent(token: string, input: unknown) {
    return this.call(token, "event_save", s.eventSaveSchema.parse(input));
  }
  async deleteEvent(token: string, input: unknown) {
    return this.call<s.Impact>(
      token,
      "event_delete",
      s.deleteSchema.parse(input),
    );
  }
  async attendance(token: string, input: unknown) {
    return this.call(
      token,
      "event_attendance_command",
      s.eventAttendanceSchema.parse(input),
    );
  }
  async journal(token: string, input: unknown) {
    return this.call(
      token,
      "event_journal_save",
      s.eventJournalSchema.parse(input),
    );
  }
  async block(token: string, input: unknown) {
    return this.call(
      token,
      "event_block_save",
      s.eventBlockSchema.parse(input),
    );
  }
}
