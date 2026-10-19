import { sqlJson } from "../../../scripts/lib/sql-database";
import "server-only";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import type {
  SqlDatabase,
  SqlExecutor,
} from "../../../scripts/lib/sql-database";
import { AuthError, tokenHash } from "../auth/service";
import {
  normalizeAnswer,
  type PasswordService,
  PasswordPolicyError,
} from "../auth/passwords";
import { AccountActivationService } from "./provisioning";
import {
  createOtp,
  encryptOtp,
  otpDigest,
  type OtpPurpose,
} from "./lifecycle-secrets";
import {
  approvalSchema,
  activationSchema,
  changePasswordSchema,
  emailRequestSchema,
  forgotSchema,
  profileSchema,
  questionSchema,
  resetSchema,
  verifyOtpSchema,
  type ProfileDto,
} from "../../lib/accounts/schemas";
type Context = {
  userId: string;
  passwordHash: string;
  credentialVersion: string;
  answerHash: string | null;
  profile: ProfileDto;
};
type Target = {
  userId: string;
  email: string | null;
  answerHash: string | null;
};
export class AccountLifecycleService {
  constructor(
    private readonly db: SqlDatabase,
    private readonly passwords: PasswordService,
    private readonly config: {
      hmac: string;
      encryptionKey: string;
      appUrl: string;
    },
  ) {}
  async rate(source: string, key: string) {
    for (const [scope, value, max] of [
      ["lifecycle_ip", source, 30],
      ["lifecycle_account", key, 15],
    ] as const) {
      const digest = createHmac("sha256", this.config.hmac)
        .update(JSON.stringify(["sim-guru:lifecycle-rate:v1", scope, value]))
        .digest("hex");
      const wait = (
        await this.db.query<{ wait: number }>(
          "select auth_private.consume_lifecycle_rate($1,$2,$3) as wait",
          [scope, digest, max],
        )
      ).rows[0]!.wait;
      if (wait > 0) throw new AuthError("RATE_LIMITED", 429, wait);
    }
  }
  private async context(tx: SqlExecutor, token: string) {
    const row = (
      await tx.query<{ value: Context }>(
        "select auth_private.lifecycle_context($1) as value",
        [tokenHash(token)],
      )
    ).rows[0]?.value;
    if (!row) throw new AuthError("UNAUTHENTICATED", 401);
    return row;
  }
  private async prove(ctx: Context, password: string) {
    if (!(await this.passwords.verify(ctx.passwordHash, password)).valid)
      throw new AuthError("INVALID_CREDENTIALS", 401);
  }
  async profile(token: string) {
    return this.db.transaction(
      async (tx) => (await this.context(tx, token)).profile,
    );
  }
  async saveProfile(token: string, input: unknown) {
    const v = profileSchema.parse(input);
    return this.db.transaction(async (tx) => {
      const ctx = await this.context(tx, token);
      await this.prove(ctx, v.currentPassword);
      // Node owns the allowed fields; SQL never accepts role/status/onboarding flags from this DTO.
      const { currentPassword: _, ...data } = v;
      void _;
      await tx.query(
        "select auth_private.lifecycle_mutate($1,'profile',$2::jsonb)",
        [tokenHash(token), sqlJson(data)],
      );
      return { saved: true };
    });
  }
  async changePassword(token: string, input: unknown) {
    const v = changePasswordSchema.parse(input);
    return this.db.transaction(async (tx) => {
      const ctx = await this.context(tx, token);
      await this.prove(ctx, v.currentPassword);
      if ((await this.passwords.verify(ctx.passwordHash, v.newPassword)).valid)
        throw new PasswordPolicyError(["PASSWORD_REUSE"]);
      const hash = await this.passwords.hashNew(v.newPassword, ctx.profile);
      await tx.query(
        "select auth_private.lifecycle_mutate($1,'password',$2::jsonb)",
        [
          tokenHash(token),
          sqlJson({
            newHash: hash,
            oldHash: ctx.passwordHash,
            credentialVersion: ctx.credentialVersion,
            appUrl: this.config.appUrl,
          }),
        ],
      );
      return { loginRequired: true };
    });
  }
  async setQuestion(token: string, input: unknown) {
    const v = questionSchema.parse(input);
    return this.db.transaction(async (tx) => {
      const ctx = await this.context(tx, token);
      await this.prove(ctx, v.currentPassword);
      const hash = await this.passwords.hashAnswer(v.answer);
      await tx.query(
        "select auth_private.lifecycle_mutate($1,'question',$2::jsonb)",
        [tokenHash(token), sqlJson({ question: v.question, answerHash: hash })],
      );
      return { saved: true };
    });
  }
  async complete(token: string) {
    const next = randomBytes(32).toString("base64url");
    await this.db.query("select auth_private.complete_onboarding($1,$2)", [
      tokenHash(token),
      tokenHash(next),
    ]);
    return { token: next };
  }
  private async queue(
    tx: SqlExecutor,
    purpose: OtpPurpose,
    email: string,
    token: string | null,
    username: string | null,
  ) {
    const id = randomUUID(),
      outbox = randomUUID(),
      otp = createOtp(),
      cipher = encryptOtp(otp, this.config.encryptionKey, {
        challengeId: id,
        outboxId: outbox,
        email,
        purpose,
      });
    const digest = otpDigest(otp, this.config.hmac, purpose, id, email);
    const queued = (
      await tx.query<{ queued: boolean }>(
        "select auth_private.queue_security_otp($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) as queued",
        [
          token ? tokenHash(token) : null,
          username,
          purpose,
          email,
          id,
          digest,
          outbox,
          cipher.ciphertextHex,
          cipher.nonceHex,
          cipher.tagHex,
          this.config.appUrl,
        ],
      )
    ).rows[0]!.queued;
    return { id, queued };
  }
  async requestEmail(token: string, input: unknown) {
    const v = emailRequestSchema.parse(input);
    return this.db.transaction(async (tx) => {
      const ctx = await this.context(tx, token);
      await this.prove(ctx, v.currentPassword);
      const result = await this.queue(tx, "email_verify", v.email, token, null);
      if (!result.queued) return { queued: false, retryAfter: 60 };
      return { queued: true, challengeId: result.id, delivery: "queued" };
    });
  }
  async forgot(input: unknown) {
    const v = forgotSchema.parse(input);
    // Same Argon2 cost for unknown users and both recovery branches. No account state in the response.
    return this.db.transaction(async (tx) => {
      const target = (
        await tx.query<{ value: Target | null }>(
          "select auth_private.recovery_question_context($1) as value",
          [v.username],
        )
      ).rows[0]?.value;
      const proof = await this.passwords.verify(
        v.method === "security" ? (target?.answerHash ?? null) : null,
        normalizeAnswer(v.answer ?? "synthetic unknown answer"),
      );
      const id = randomUUID();
      if (v.method === "email") {
        const result = await this.queue(
          tx,
          "reset_otp",
          target?.email ?? "unknown@example.invalid",
          null,
          v.username,
        );
        return { accepted: true, challengeId: result.id };
      }
      if (v.method === "admin" || proof.valid)
        await tx.query("select auth_private.request_admin_recovery($1,$2)", [
          v.username,
          v.reason ??
            "Pemulihan dengan pertanyaan keamanan, tetap memerlukan verifikasi identitas admin.",
        ]);
      return { accepted: true, challengeId: id };
    });
  }
  async verifyOtp(purpose: OtpPurpose, token: string | null, input: unknown) {
    const v = verifyOtpSchema.parse(input),
      resetId = randomUUID(),
      resetToken = randomBytes(32).toString("base64url");
    // Commit negative attempts. Never throw within the transaction after incrementing attempts.
    const verified = await this.db.transaction(async (tx) => {
      const binding = (
        await tx.query<{ value: { userId: string; email: string } | null }>(
          "select auth_private.otp_binding($1,$2) as value",
          [v.challengeId, purpose],
        )
      ).rows[0]?.value;
      const digest = otpDigest(
        v.otp,
        this.config.hmac,
        purpose,
        v.challengeId,
        binding?.email ?? "unknown@example.invalid",
      );
      return (
        await tx.query<{ ok: boolean }>(
          "select auth_private.verify_security_otp($1,$2,$3,$4,$5,$6) as ok",
          [
            token ? tokenHash(token) : null,
            v.challengeId,
            purpose,
            digest,
            resetId,
            tokenHash(resetToken),
          ],
        )
      ).rows[0]!.ok;
    });
    if (!verified) throw new AuthError("CHALLENGE_INVALID", 422);
    return purpose === "reset_otp"
      ? { challengeId: resetId, token: resetToken }
      : { loginRequired: true };
  }
  async reset(input: unknown) {
    const v = resetSchema.parse(input);
    return this.db.transaction(async (tx) => {
      const ctx = (
        await tx.query<{
          value: {
            username: string;
            fullName: string;
            passwordHash: string;
          } | null;
        }>("select auth_private.reset_context($1,$2) as value", [
          v.challengeId,
          tokenHash(v.token),
        ])
      ).rows[0]?.value;
      if (!ctx) throw new AuthError("CHALLENGE_INVALID", 422);
      if ((await this.passwords.verify(ctx.passwordHash, v.newPassword)).valid)
        throw new PasswordPolicyError(["PASSWORD_REUSE"]);
      const hash = await this.passwords.hashNew(v.newPassword, ctx);
      const ok = (
        await tx.query<{ ok: boolean }>(
          "select auth_private.finish_password_reset($1,$2,$3,$4) as ok",
          [v.challengeId, tokenHash(v.token), hash, this.config.appUrl],
        )
      ).rows[0]!.ok;
      if (!ok) throw new AuthError("CHALLENGE_INVALID", 422);
      return { loginRequired: true };
    });
  }
  async activate(input: unknown) {
    const v = activationSchema.parse(input);
    try {
      await new AccountActivationService(
        (work) => this.db.transaction(work),
        this.db,
        this.passwords,
        this.config.encryptionKey,
      ).activate(v);
      return { loginRequired: true };
    } catch (e) {
      if (e instanceof Error && e.message === "INVALID_ACTIVATION")
        throw new AuthError("CHALLENGE_INVALID", 422);
      throw e;
    }
  }
  async recoveryRequests(token: string) {
    return (
      await this.db.query<{ value: unknown }>(
        "select auth_private.admin_recovery_context($1,null) as value",
        [tokenHash(token)],
      )
    ).rows[0]!.value;
  }
  async approve(token: string, input: unknown) {
    const v = approvalSchema.parse(input);
    return this.db.transaction(async (tx) => {
      const admin = await this.context(tx, token);
      await this.prove(admin, v.currentPassword);
      const ctx = (
        await tx.query<{
          value: { username: string; fullName: string } | null;
        }>("select auth_private.admin_recovery_context($1,$2) as value", [
          tokenHash(token),
          v.requestId,
        ])
      ).rows[0]!.value;
      if (!ctx) throw new AuthError("CHALLENGE_INVALID", 422);
      // Display only in this response for verified handover, never in audit/outbox/logs.
      let temporaryPassword: string;
      for (let i = 0; i < 10; i++) {
        temporaryPassword = "A9!" + randomBytes(24).toString("base64url");
        try {
          const hash = await this.passwords.hashNew(temporaryPassword, ctx);
          const ok = (
            await tx.query<{ ok: boolean }>(
              "select auth_private.approve_admin_recovery($1,$2,$3,$4,$5,$6) as ok",
              [
                tokenHash(token),
                v.requestId,
                hash,
                v.method,
                v.evidence,
                v.reason,
              ],
            )
          ).rows[0]!.ok;
          if (!ok) throw new AuthError("CHALLENGE_INVALID", 422);
          return { temporaryPassword, expiresInHours: 24 };
        } catch (e) {
          if (e instanceof PasswordPolicyError) continue;
          throw e;
        }
      }
      throw new AuthError("UNAVAILABLE", 503);
    });
  }
}
