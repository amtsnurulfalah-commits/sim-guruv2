import "server-only";
import { z } from "zod";
import { sqlJson, type SqlDatabase } from "../../../scripts/lib/sql-database";
import { tokenHash } from "../auth/service";
import {
  preparationRequest,
  commitRequest,
} from "../../lib/semester-preparation/contracts";
export class SemesterPreparationService {
  constructor(private readonly db: SqlDatabase) {}
  async read(token: string, input: unknown) {
    const q = z
      .object({ previewId: z.uuid().optional() })
      .strict()
      .parse(input);
    return this.db.transaction(
      async (tx) =>
        (
          await tx.query<{ value: unknown }>(
            "select app.semester_read($1,$2::jsonb) value",
            [tokenHash(token), sqlJson(q)],
          )
        ).rows[0]!.value,
    );
  }
  async command(token: string, action: string, input: unknown) {
    const d =
      action === "preview"
        ? preparationRequest.parse(input)
        : action === "commit"
          ? commitRequest.parse(input)
          : null;
    if (!d) throw new Error("SEMESTER_INVALID");
    return this.db.transaction(
      async (tx) =>
        (
          await tx.query<{ value: unknown }>(
            action === "preview"
              ? "select app.semester_preview($1,$2::jsonb) value"
              : "select app.semester_commit($1,$2::uuid) value",
            [
              tokenHash(token),
              action === "preview"
                ? sqlJson(d)
                : (d as { previewId: string }).previewId,
            ],
          )
        ).rows[0]!.value,
    );
  }
}
