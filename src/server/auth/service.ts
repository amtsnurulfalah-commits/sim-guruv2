import "server-only";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { loginSchema } from "@/lib/accounts/login";
export { loginSchema } from "@/lib/accounts/login";
import type { SqlDatabase } from "../../../scripts/lib/sql-database";
import type { PasswordService } from "./passwords";
export class AuthError extends Error {
    constructor(readonly code: string, readonly status: number, readonly retryAfter?: number) { super(code); }
}
export const tokenHash = (value: string) => createHash("sha256").update(value).digest("hex");
export type SessionRow = {
    session_id: string;
    user_id: string;
    username: string;
    full_name: string;
    role: "admin" | "guru";
    scope: "onboarding" | "business";
    expires_at: Date | string;
    idle_expires_at: Date | string;
    must_change_password: boolean;
    email_verified: boolean;
    security_question_ready: boolean;
    maintenance: boolean;
};
type Credential = {
    user_id: string;
    username: string;
    password_hash: string;
    auth_version: string | number;
    credential_version: string | number;
    status: string;
    must_change_password: boolean;
    temporary_expires_at: Date | string | null;
};
const iso = (value: Date | string) => new Date(value).toISOString();
export function sessionDto(row: SessionRow) { return { user: { id: row.user_id, username: row.username, fullName: row.full_name, role: row.role }, scope: row.scope, expiresAt: iso(row.expires_at), idleExpiresAt: iso(row.idle_expires_at), onboarding: { mustChangePassword: row.must_change_password, emailVerified: row.email_verified, securityQuestionReady: row.security_question_ready }, maintenance: row.maintenance }; }
export type SessionDto = ReturnType<typeof sessionDto>;
export class LocalAuthService {
    constructor(private readonly database: SqlDatabase, private readonly passwords: PasswordService, private readonly rateSecret: string) { }
    private key(scope: string, value: string) { return createHmac("sha256", this.rateSecret).update(JSON.stringify(["sim-guru:rate:v1", scope, value])).digest("hex"); }
    async login(input: unknown, source: string, requestId: string, previousToken?: string) {
        const value = loginSchema.parse(input), account = this.key("account", value.username), ip = this.key("ip", source);
        const sourceLimit = (await this.database.query<{
            wait: number;
        }>("select auth_private.consume_login_source($1) as wait", [ip])).rows[0]!.wait;
        if (sourceLimit > 0)
            throw new AuthError("RATE_LIMITED", 429, sourceLimit);
        const result = await this.database.transaction(async (tx) => {
            const limit = (await tx.query<{
                wait: number;
            }>("select auth_private.login_account_state($1) as wait", [account])).rows[0]!.wait;
            if (limit > 0)
                return { error: new AuthError("RATE_LIMITED", 429, limit) };
            const row = (await tx.query<Credential>("select * from auth_private.lookup_credentials($1)", [value.username])).rows[0];
            const checked = await this.passwords.verify(row?.password_hash ?? null, value.password);
            if (!checked.valid || !row || row.status !== "active" || (row.temporary_expires_at !== null && new Date(row.temporary_expires_at).getTime() <= Date.now())) {
                await tx.query("select auth_private.finish_login_attempt($1,false,$2)", [account, requestId]);
                return { error: new AuthError("INVALID_CREDENTIALS", 401) };
            }
            const profile = (await tx.query<{
                full_name: string;
                ready: boolean;
                maintenance: boolean;
            }>("select * from auth_private.login_profile($1)", [row.user_id])).rows[0]!;
            await tx.query("select auth_private.finish_login_attempt($1,true,$2)", [account, requestId]);
            if (profile.maintenance)
                return { error: new AuthError("MAINTENANCE", 503) };
            // Rehash setelah bukti password, CAS mempertahankan credential_version terkini untuk issue_session.
            if (checked.needsRehash) {
                const next = await this.passwords.upgradeVerified(row.password_hash, value.password);
                const changed = (await tx.query<{
                    changed: boolean;
                }>("select auth_private.rehash_credentials_after_verification($1,$2,$3,$4) as changed", [row.user_id, String(row.credential_version), row.password_hash, next])).rows[0]!.changed;
                if (!changed)
                    return { error: new AuthError("INVALID_CREDENTIALS", 401) };
                row.password_hash = next;
                row.credential_version = String(BigInt(row.credential_version) + 1n);
            }
            const token = randomBytes(32).toString("base64url"), digest = tokenHash(token);
            await tx.query("select auth_private.issue_session($1,$2,$3,$4,$5,$6)", [row.user_id, row.password_hash, String(row.credential_version), String(row.auth_version), digest, profile.ready ? "business" : "onboarding"]);
            if (previousToken && /^[A-Za-z0-9_-]{43}$/u.test(previousToken))
                await tx.query("select auth_private.revoke_session($1)", [tokenHash(previousToken)]);
            await tx.query("select auth_private.audit_login_success($1,$2)", [row.user_id, requestId]);
            const session = (await tx.query<SessionRow>("select * from auth_private.session_snapshot($1,false)", [digest])).rows[0];
            if (!session)
                throw new AuthError("UNAVAILABLE", 503);
            return { token, session: sessionDto(session) };
        });
        if (result.error)
            throw result.error;
        return { token: result.token!, session: result.session! };
    }
    async session(token: string | undefined, touch = false): Promise<SessionRow | null> {
        if (!token || !/^[A-Za-z0-9_-]{43}$/u.test(token))
            return null;
        return (await this.database.query<SessionRow>("select * from auth_private.session_snapshot($1,$2)", [tokenHash(token), touch])).rows[0] ?? null;
    }
    async requireSession(token: string | undefined, business = false, touch = false) {
        const row = await this.session(token, touch);
        if (!row)
            throw new AuthError("UNAUTHENTICATED", 401);
        if (business && row.scope !== "business")
            throw new AuthError("ONBOARDING_REQUIRED", 403);
        if (business && row.maintenance && row.role !== "admin")
            throw new AuthError("MAINTENANCE", 503);
        return row;
    }
    async logout(token: string | undefined, requestId: string) { if (token && /^[A-Za-z0-9_-]{43}$/u.test(token))
        await this.database.query("select auth_private.logout_with_audit($1,$2)", [tokenHash(token), requestId]); }
}
