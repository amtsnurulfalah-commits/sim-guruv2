import { sqlJson } from "../../../scripts/lib/sql-database";
import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import type {
  SqlDatabase,
  SqlExecutor,
} from "../../../scripts/lib/sql-database";
import { tokenHash, AuthError } from "../auth/service";
import { PasswordPolicyError, type PasswordService } from "../auth/passwords";
import { AccountActivationService } from "../accounts/provisioning";
import {
  activationRequestSchema,
  createUserSchema,
  editUserSchema,
  listUsersSchema,
  recoverySchema,
  rejectRecoverySchema,
  statusSchema,
  userProfileSchema,
  type UserDto,
  type UserList,
  type RecoveryRequest,
} from "../../lib/users/schemas";
export class UserService {
  constructor(
    private readonly db: SqlDatabase,
    private readonly passwords: PasswordService,
    private readonly config: { appUrl: string; encryptionKey: string },
  ) {}
  private async proof(tx: SqlExecutor, token: string, password: string) {
    const ctx = (
      await tx.query<{ value: { userId: string; passwordHash: string } }>(
        "select auth_private.users_admin_context($1) as value",
        [tokenHash(token)],
      )
    ).rows[0]!.value;
    if (!(await this.passwords.verify(ctx.passwordHash, password)).valid)
      throw new AuthError("INVALID_CREDENTIALS", 401);
    return ctx;
  }
  private async temporary(identity: { username: string; fullName: string }) {
    for (let i = 0; i < 10; i++) {
      const value = "A9!" + randomBytes(24).toString("base64url");
      try {
        return {
          password: value,
          hash: await this.passwords.hashNew(value, identity),
        };
      } catch (e) {
        if (e instanceof PasswordPolicyError) continue;
        throw e;
      }
    }
    throw new AuthError("UNAVAILABLE", 503);
  }
  private activation(tx: SqlExecutor) {
    return new AccountActivationService(
      (work) => work(tx),
      tx,
      this.passwords,
      this.config.encryptionKey,
    );
  }
  async list(token: string, input: unknown) {
    const v = listUsersSchema.parse(input);
    return (
      await this.db.query<{ value: UserList }>(
        "select auth_private.users_list($1,$2,$3,$4,$5,$6) as value",
        [tokenHash(token), v.q, v.role, v.status, v.page, v.pageSize],
      )
    ).rows[0]!.value;
  }
  async detail(token: string, id: string) {
    z.uuid().parse(id);
    return (
      await this.db.query<{ value: UserDto }>(
        "select auth_private.users_detail($1,$2) as value",
        [tokenHash(token), id],
      )
    ).rows[0]!.value;
  }
  async create(token: string, input: unknown) {
    const v = createUserSchema.parse(input),
      data = userProfileSchema.parse(
        Object.fromEntries(
          Object.keys(userProfileSchema.shape).map((k) => [
            k,
            v[k as keyof typeof v],
          ]),
        ),
      );
    return this.db.transaction(async (tx) => {
      await this.proof(tx, token, v.currentPassword);
      const temp =
        v.delivery === "handover" ? await this.temporary(data) : null;
      const user = (
        await tx.query<{ value: UserDto }>(
          "select auth_private.users_save($1,null,null,$2::jsonb,$3,$4) as value",
          [
            tokenHash(token),
            sqlJson({
              ...data,
              ...(temp ? { method: v.method, evidence: v.evidence } : {}),
            }),
            temp?.hash ?? null,
            v.reason,
          ],
        )
      ).rows[0]!.value;
      if (v.delivery === "activation")
        await this.activation(tx).reissue(user.id, v.email, this.config.appUrl);
      return {
        user,
        delivery: v.delivery === "activation" ? "queued" : "handover",
        ...(temp
          ? { temporaryPassword: temp.password, expiresInHours: 24 }
          : {}),
      };
    });
  }
  async edit(token: string, id: string, input: unknown) {
    z.uuid().parse(id);
    const v = editUserSchema.parse(input),
      data = userProfileSchema.parse(
        Object.fromEntries(
          Object.keys(userProfileSchema.shape).map((k) => [
            k,
            v[k as keyof typeof v],
          ]),
        ),
      );
    return this.db.transaction(async (tx) => {
      const actor = await this.proof(tx, token, v.currentPassword);
      const user = (
        await tx.query<{ value: UserDto }>(
          "select auth_private.users_save($1,$2,$3,$4::jsonb,null,$5) as value",
          [tokenHash(token), id, v.version, sqlJson(data), v.reason],
        )
      ).rows[0]!.value;
      if (user.status === "pending_activation") {
        if (!user.email) throw new AuthError("VALIDATION_ERROR", 422);
        await this.activation(tx).reissue(
          user.id,
          user.email,
          this.config.appUrl,
        );
      }
      return {
        user,
        selfAffected: actor.userId === id,
        ...(user.status === "pending_activation" ? { delivery: "queued" } : {}),
      };
    });
  }
  async status(token: string, id: string, input: unknown) {
    z.uuid().parse(id);
    const v = statusSchema.parse(input);
    return this.db.transaction(async (tx) => {
      const actor = await this.proof(tx, token, v.currentPassword);
      const user = (
        await tx.query<{ value: UserDto }>(
          "select auth_private.users_status($1,$2,$3,$4,$5) as value",
          [tokenHash(token), id, v.version, v.status, v.reason],
        )
      ).rows[0]!.value;
      return { user, selfAffected: actor.userId === id };
    });
  }
  async reissue(token: string, id: string, input: unknown) {
    z.uuid().parse(id);
    const v = activationRequestSchema.parse(input);
    return this.db.transaction(async (tx) => {
      await this.proof(tx, token, v.currentPassword);
      const user = (
        await tx.query<{ value: UserDto }>(
          "select auth_private.users_activation_target($1,$2,$3,$4) as value",
          [tokenHash(token), id, v.version, v.reason],
        )
      ).rows[0]!.value;
      if (!user.email) throw new AuthError("VALIDATION_ERROR", 422);
      await this.activation(tx).reissue(id, user.email, this.config.appUrl);
      return { user, delivery: "queued" };
    });
  }
  async requests(token: string) {
    return (
      await this.db.query<{ value: RecoveryRequest[] }>(
        "select auth_private.users_reset_requests($1) as value",
        [tokenHash(token)],
      )
    ).rows[0]!.value;
  }
  async recover(token: string, id: string, input: unknown) {
    z.uuid().parse(id);
    const v = recoverySchema.parse(input);
    return this.db.transaction(async (tx) => {
      await this.proof(tx, token, v.currentPassword);
      const target = (
        await tx.query<{ value: UserDto }>(
          "select auth_private.users_recovery_target($1,$2,$3,$4) as value",
          [tokenHash(token), id, v.requestId, v.version],
        )
      ).rows[0]!.value;
      const temp = await this.temporary(target);
      const ok = (
        await tx.query<{ ok: boolean }>(
          "select auth_private.approve_admin_recovery($1,$2,$3,$4,$5,$6) as ok",
          [
            tokenHash(token),
            v.requestId,
            temp.hash,
            v.method,
            v.evidence,
            v.reason,
          ],
        )
      ).rows[0]!.ok;
      if (!ok) throw new AuthError("CHALLENGE_INVALID", 422);
      return { temporaryPassword: temp.password, expiresInHours: 24 };
    });
  }
  async reject(token: string, input: unknown) {
    const v = rejectRecoverySchema.parse(input);
    return this.db.transaction(async (tx) => {
      await this.proof(tx, token, v.currentPassword);
      await tx.query("select auth_private.users_reject_recovery($1,$2,$3)", [
        tokenHash(token),
        v.requestId,
        v.reason,
      ]);
      return { rejected: true };
    });
  }
}
