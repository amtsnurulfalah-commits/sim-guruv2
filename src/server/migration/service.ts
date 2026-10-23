import "server-only";
import { z } from "zod";
import { sqlJson, type SqlDatabase } from "../../../scripts/lib/sql-database";
import { AuthError } from "../auth/service";
import { tokenHash } from "../auth/service";
import { profileExport } from "../../lib/migration/profile";
import { gateSchema, resolveSchema } from "../../lib/migration/contracts";
export class MigrationService {
    constructor(private readonly db: SqlDatabase) { }
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
        const data = kind === "gate"
            ? gateSchema.parse(input)
            : resolveSchema.parse(input);
        z.enum(["gate", "resolve"]).parse(kind);
        return this.call("select app.migration_command($1,$2,$3::jsonb) value", [
            tokenHash(token),
            kind,
            sqlJson(data),
        ]);
    }
    private call(sql: string, args: Parameters<SqlDatabase["query"]>[1]) {
        return this.db.transaction(async (tx) => (await tx.query<{
            value: unknown;
        }>(sql, args)).rows[0]!.value).catch((error: unknown) => {
            if (error && typeof error === "object" && "code" in error && error.code === "42501" && "message" in error) {
                const code = String(error.message);
                if (["REVIEW_NOT_ALLOWED", "MIGRATION_BLOCKED", "MIGRATION_NOT_IMPORTED", "CUTOVER_GATES_INCOMPLETE"].includes(code))
                    throw new AuthError(code, code === "REVIEW_NOT_ALLOWED" ? 409 : 422);
            }
            throw error;
        });
    }
}
