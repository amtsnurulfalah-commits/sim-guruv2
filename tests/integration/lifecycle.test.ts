import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { openPgliteDatabase } from "../helpers/pglite-database";
import { applyMigrations, readMigrations } from "../../scripts/lib/migrations";
import type {
  SqlDatabase,
  SqlExecutor,
  SqlParameter,
} from "../../scripts/lib/sql-database";
import {
  getPasswordService,
  normalizeAnswer,
} from "../../src/server/auth/passwords";
import { LocalAuthService, tokenHash } from "../../src/server/auth/service";
import { AccountLifecycleService } from "../../src/server/accounts/lifecycle";
import {
  decryptOtp,
  otpDigest,
} from "../../src/server/accounts/lifecycle-secrets";
import {
  SecurityOutboxWorker,
  ResendMailAdapter,
  type MailMessage,
  type DeliveryResult,
} from "../../src/server/mail/security-outbox";
import { createLifecycleHandler } from "../../src/server/accounts/http";
import { issueCsrf } from "../../src/server/auth/security";
const initial = "V9!aL4#qN8@zR2$kD7&x",
  permanent = "K8!wT5#rH3@cB6$yF4&z",
  replacement = "Z7!qM2#jP4@dH8$wL5&x";
test("Tahap1.5 — lifecycle akun, capability reset, least privilege dan delivery", async (t) => {
  const db = await openPgliteDatabase();
  t.after(() => db.close());
  await applyMigrations(
    db,
    await readMigrations(resolve("supabase/migrations")),
  );
  const passwords = await getPasswordService(),
    hash = await passwords.hashNew(initial, {
      username: "operator",
      fullName: "Pengelola Uji",
    });
  function scope(role: string): SqlDatabase {
    async function transaction<T>(work: (tx: SqlExecutor) => Promise<T>) {
      try {
        return await db.transaction(async (tx) => {
          await tx.exec(`SET SESSION AUTHORIZATION ${role}`);
          return work(tx);
        });
      } finally {
        await db.exec("SET SESSION AUTHORIZATION postgres; RESET ROLE");
      }
    }
    return {
      transaction,
      query: <T extends Record<string, unknown>>(
        sql: string,
        args: readonly SqlParameter[] = [],
      ) => transaction((tx) => tx.query<T>(sql, args)),
      exec: (sql) => transaction((tx) => tx.exec(sql)),
      close: async () => {},
    };
  }
  const authDb = scope("sim_guru_auth"),
    workerDb = scope("sim_guru_worker"),
    businessDb = scope("sim_guru_business");
  const config = {
    hmac: randomBytes(40).toString("hex"),
    encryptionKey: randomBytes(32).toString("hex"),
    appUrl: "https://school.example",
  };
  const service = new AccountLifecycleService(authDb, passwords, config),
    auth = new LocalAuthService(authDb, passwords, config.hmac);
  const id = (
    await db.query<{ id: string }>(
      "insert into app.app_users(username,full_name,role,status,must_change_password) values('peserta','Peserta Uji','guru','active',true) returning id",
    )
  ).rows[0]!.id;
  await db.query(
    "insert into auth_private.user_credentials(user_id,password_hash,temporary_expires_at) values($1,$2,clock_timestamp()+interval '24 hours')",
    [id, hash],
  );
  const signIn = (username = "peserta", password = permanent) =>
    auth.login({ username, password }, randomUUID(), randomUUID());
  let token = (await signIn("peserta", initial)).token,
    challenge = "",
    otp = "",
    reset: { challengeId: string; token: string } | null = null;
  async function readOtp(challengeId: string) {
    const row = (
      await db.query<{
        id: string;
        email: string;
        purpose: "email_verify" | "reset_otp";
        ciphertextHex: string;
        nonceHex: string;
        tagHex: string;
      }>(
        `select o.id,o.recipient_email as email,c.purpose,encode(s.ciphertext,'hex') as "ciphertextHex",encode(s.nonce,'hex') as "nonceHex",encode(s.auth_tag,'hex') as "tagHex" from auth_private.outbox_secrets s join ops.notification_outbox o on o.id=s.outbox_id join auth_private.verification_challenges c on c.id=s.challenge_id where s.challenge_id=$1`,
        [challengeId],
      )
    ).rows[0]!;
    return decryptOtp({ ...row, keyVersion: 1 }, config.encryptionKey, {
      challengeId,
      outboxId: row.id,
      email: row.email,
      purpose: row.purpose,
    });
  }
  await t.test(
    "LC01 new routines isolated; worker cannot read credentials or run lifecycle",
    async () => {
      for (const sql of [
        "select auth_private.lifecycle_context('x')",
        "select auth_private.claim_security_outbox()",
      ]) {
        await assert.rejects(() => businessDb.query(sql));
      }
      await assert.rejects(() =>
        workerDb.query("select auth_private.lookup_credentials('peserta')"),
      );
      await assert.rejects(() =>
        authDb.query("select auth_private.claim_security_outbox()"),
      );
      await assert.rejects(() =>
        workerDb.query("select * from auth_private.user_credentials"),
      );
    },
  );
  await t.test(
    "LC02 temporary password to permanent: proof, reuse rejection, atomic revoke and relogin",
    async () => {
      await assert.rejects(() =>
        service.changePassword(token, {
          currentPassword: "wrong",
          newPassword: permanent,
          confirmation: permanent,
        }),
      );
      await assert.rejects(() =>
        service.changePassword(token, {
          currentPassword: initial,
          newPassword: initial,
          confirmation: initial,
        }),
      );
      await service.changePassword(token, {
        currentPassword: initial,
        newPassword: permanent,
        confirmation: permanent,
      });
      assert.equal(await auth.session(token), null);
      token = (await signIn()).token;
      assert.equal((await auth.requireSession(token)).scope, "onboarding");
      const state = (
        await db.query<{ temporary_expires_at: null }>(
          "select temporary_expires_at from auth_private.user_credentials where user_id=$1",
          [id],
        )
      ).rows[0]!;
      assert.equal(state.temporary_expires_at, null);
    },
  );
  await t.test(
    "LC03 profile DTO excludes private data; strict fields, version CAS, text NIP, phone normalization",
    async () => {
      const profile = await service.profile(token);
      assert.equal(JSON.stringify(profile).includes(hash), false);
      assert.equal("answerHash" in profile, false);
      const input = {
        version: profile.version,
        username: "peserta",
        fullName: "Peserta Uji",
        nip: "0000123",
        phone: "0812-3456-7890",
        address: "Alamat sintetis",
        photoUrl: "",
        currentPassword: permanent,
      };
      await assert.rejects(() =>
        service.saveProfile(token, { ...input, role: "admin" }),
      );
      await service.saveProfile(token, input);
      const updated = await service.profile(token);
      assert.equal(updated.nip, "0000123");
      assert.equal(updated.phone, "+6281234567890");
      await assert.rejects(() => service.saveProfile(token, input));
    },
  );
  await t.test(
    "LC04 question uses normalized Argon2 answer; onboarding cannot skip email",
    async () => {
      await service.setQuestion(token, {
        currentPassword: permanent,
        question: "Apa kode kenangan Anda?",
        answer: "  Kota   Hijau  ",
      });
      const row = (
        await db.query<{ answer_hash: string }>(
          "select answer_hash from auth_private.security_questions where user_id=$1",
          [id],
        )
      ).rows[0]!;
      assert.equal(
        (await passwords.verify(row.answer_hash, normalizeAnswer("KOTA HIJAU")))
          .valid,
        true,
      );
      await assert.rejects(() => service.complete(token));
      assert.equal((await auth.requireSession(token)).scope, "onboarding");
    },
  );
  await t.test(
    "LC05 email request requires password; OTP HMAC + encrypted outbox, no premature verified flag",
    async () => {
      await assert.rejects(() =>
        service.requestEmail(token, {
          email: "peserta@example.test",
          currentPassword: "wrong",
        }),
      );
      const queued = await service.requestEmail(token, {
        email: "peserta@example.test",
        currentPassword: permanent,
      });
      challenge = queued.challengeId!;
      otp = await readOtp(challenge);
      assert.match(otp, /^\d{6}$/);
      assert.equal((await service.profile(token)).emailVerified, false);
      const row = (
        await db.query<{ secret_digest: string }>(
          "select secret_digest from auth_private.verification_challenges where id=$1",
          [challenge],
        )
      ).rows[0]!;
      assert.equal(
        row.secret_digest,
        otpDigest(
          otp,
          config.hmac,
          "email_verify",
          challenge,
          "peserta@example.test",
        ),
      );
      assert.equal(JSON.stringify(queued).includes(otp), false);
    },
  );
  await t.test(
    "LC06 resend cooldown preserves existing challenge and secret",
    async () => {
      const queued = await service.requestEmail(token, {
        email: "peserta@example.test",
        currentPassword: permanent,
      });
      assert.equal(queued.queued, false);
      assert.equal(await readOtp(challenge), otp);
    },
  );
  await t.test(
    "LC07 five wrong attempts commit across requests, then even correct OTP rejected",
    async () => {
      const wrong = otp === "000000" ? "000001" : "000000";
      for (let i = 0; i < 5; i++)
        await assert.rejects(() =>
          service.verifyOtp("email_verify", token, {
            challengeId: challenge,
            otp: wrong,
          }),
        );
      const row = (
        await db.query<{ attempts: number }>(
          "select attempts from auth_private.verification_challenges where id=$1",
          [challenge],
        )
      ).rows[0]!;
      assert.equal(row.attempts, 5);
      await assert.rejects(() =>
        service.verifyOtp("email_verify", token, {
          challengeId: challenge,
          otp,
        }),
      );
      assert.equal((await service.profile(token)).emailVerified, false);
    },
  );
  await t.test(
    "LC08 reissue supersedes; purpose mismatch denied; valid email consumes and revokes session",
    async () => {
      const old = challenge;
      await db.query(
        "update auth_private.verification_challenges set created_at=clock_timestamp()-interval '61 seconds' where id=$1",
        [challenge],
      );
      const queued = await service.requestEmail(token, {
        email: "peserta@example.test",
        currentPassword: permanent,
      });
      challenge = queued.challengeId!;
      otp = await readOtp(challenge);
      assert.equal(
        (
          await db.query(
            "select * from auth_private.outbox_secrets where challenge_id=$1",
            [old],
          )
        ).rows.length,
        0,
      );
      await assert.rejects(() =>
        service.verifyOtp("reset_otp", null, { challengeId: challenge, otp }),
      );
      await service.verifyOtp("email_verify", token, {
        challengeId: challenge,
        otp,
      });
      assert.equal(await auth.session(token), null);
      await assert.rejects(() =>
        service.verifyOtp("email_verify", token, {
          challengeId: challenge,
          otp,
        }),
      );
    },
  );
  await t.test(
    "LC09 complete onboarding rotates opaque cookie scope, never upgrades old token",
    async () => {
      token = (await signIn()).token;
      const session = await auth.requireSession(token);
      assert.equal(session.scope, "business");
      // Existing onboarding sessions can remain limited even after all flags are ready.
      await db.query(
        "update auth_private.app_sessions set scope='onboarding' where token_hash=$1",
        [tokenHash(token)],
      );
      const result = await service.complete(token);
      assert.notEqual(result.token, token);
      assert.equal(await auth.session(token), null);
      token = result.token;
      assert.equal((await auth.requireSession(token, true)).scope, "business");
    },
  );
  await t.test(
    "LC10 forgot responses structurally equal for existing/missing users, no OTP/token disclosure",
    async () => {
      const real = await service.forgot({
          username: "peserta",
          method: "email",
        }),
        fake = await service.forgot({
          username: "missing.user",
          method: "email",
        });
      assert.deepEqual(Object.keys(real).sort(), Object.keys(fake).sort());
      assert.equal(real.accepted, true);
      assert.equal(fake.accepted, true);
      challenge = real.challengeId;
      otp = await readOtp(challenge);
      assert.equal(JSON.stringify(real).includes(otp), false);
    },
  );
  await t.test(
    "LC11 reset OTP consumed once yields only five minute capability, no session",
    async () => {
      const count = (
        await db.query<{ n: number }>(
          "select count(*)::int as n from auth_private.app_sessions",
        )
      ).rows[0]!.n;
      const result = await service.verifyOtp("reset_otp", null, {
        challengeId: challenge,
        otp,
      });
      assert.ok("token" in result);
      reset = result as { challengeId: string; token: string };
      await assert.rejects(() =>
        service.verifyOtp("reset_otp", null, { challengeId: challenge, otp }),
      );
      assert.equal(
        (
          await db.query<{ n: number }>(
            "select count(*)::int as n from auth_private.app_sessions",
          )
        ).rows[0]!.n,
        count,
      );
      const row = (
        await db.query<{ ttl: boolean; secret_digest: string }>(
          "select expires_at<=clock_timestamp()+interval '5 minutes' as ttl,secret_digest from auth_private.verification_challenges where id=$1",
          [reset.challengeId],
        )
      ).rows[0]!;
      assert.equal(row.ttl, true);
      assert.equal(row.secret_digest, tokenHash(reset.token));
    },
  );
  await t.test(
    "LC12 reset rejects reuse/tamper/policy failure; success revokes every session and capability",
    async () => {
      assert.ok(reset);
      await assert.rejects(() =>
        service.reset({
          ...reset,
          newPassword: permanent,
          confirmation: permanent,
        }),
      );
      await assert.rejects(() =>
        service.reset({
          ...reset,
          token: randomBytes(32).toString("base64url"),
          newPassword: replacement,
          confirmation: replacement,
        }),
      );
      await assert.rejects(() =>
        service.reset({ ...reset, newPassword: "weak", confirmation: "weak" }),
      );
      await service.reset({
        ...reset,
        newPassword: replacement,
        confirmation: replacement,
      });
      assert.equal(await auth.session(token), null);
      await assert.rejects(() =>
        service.reset({
          ...reset,
          newPassword: permanent,
          confirmation: permanent,
        }),
      );
      token = (await signIn("peserta", replacement)).token;
      assert.ok(
        (
          await db.query(
            "select id from ops.notification_outbox where template='password_changed' and recipient_id=$1",
            [id],
          )
        ).rows.length > 0,
      );
    },
  );
  await t.test(
    "LC13 expired OTP fails without changing password; email change does not preempt old verified address",
    async () => {
      await db.query(
        "update auth_private.verification_challenges set created_at=clock_timestamp()-interval '61 seconds' where user_id=$1 and purpose='email_verify'",
        [id],
      );
      const queued = await service.requestEmail(token, {
        email: "baru@example.test",
        currentPassword: replacement,
      });
      const code = await readOtp(queued.challengeId!);
      assert.equal(
        (await service.profile(token)).email,
        "peserta@example.test",
      );
      await db.query(
        "update auth_private.verification_challenges set created_at=clock_timestamp()-interval '20 minutes',expires_at=clock_timestamp()-interval '10 minutes' where id=$1",
        [queued.challengeId!],
      );
      await assert.rejects(() =>
        service.verifyOtp("email_verify", token, {
          challengeId: queued.challengeId!,
          otp: code,
        }),
      );
    },
  );
  await t.test(
    "LC14 security answer alone creates at most admin request, never reset capability",
    async () => {
      await service.forgot({
        username: "peserta",
        method: "security",
        answer: "wrong",
      });
      assert.equal(
        (
          await db.query(
            "select id from auth_private.password_reset_requests where user_id=$1",
            [id],
          )
        ).rows.length,
        0,
      );
      const result = await service.forgot({
        username: "peserta",
        method: "security",
        answer: " KOTA HIJAU ",
      });
      assert.equal("token" in result, false);
      assert.equal(
        (
          await db.query(
            "select id from auth_private.password_reset_requests where user_id=$1 and status='pending'",
            [id],
          )
        ).rows.length,
        1,
      );
    },
  );
  let adminToken = "",
    requestId = "";
  await t.test(
    "LC15 admin recovery needs business admin, target-bound request, identity evidence and own password",
    async () => {
      await assert.rejects(() => service.recoveryRequests(token));
      const adminId = (
        await db.query<{ id: string }>(
          "insert into app.app_users(username,full_name,role,status,must_change_password,contact_email,email_verified_at) values('pengelola','Pengelola Uji','admin','active',false,'admin@example.test',clock_timestamp()) returning id",
        )
      ).rows[0]!.id;
      await db.query(
        "insert into auth_private.user_credentials(user_id,password_hash) values($1,$2)",
        [adminId, hash],
      );
      await db.query(
        "insert into auth_private.security_questions(user_id,question,answer_hash) values($1,'Pertanyaan operator',$2)",
        [adminId, hash],
      );
      adminToken = (await signIn("pengelola", initial)).token;
      const pending = (await service.recoveryRequests(adminToken)) as {
        id: string;
      }[];
      requestId = pending[0]!.id;
      await assert.rejects(() =>
        service.approve(adminToken, {
          requestId,
          currentPassword: "wrong",
          method: "tatap_muka",
          evidence: "REF-01",
          reason: "Identitas telah diperiksa",
        }),
      );
      await assert.rejects(() =>
        service.approve(adminToken, {
          requestId,
          currentPassword: initial,
          method: "tatap_muka",
          evidence: "REF-01",
          reason: "Identitas telah diperiksa",
          userId: randomUUID(),
        }),
      );
    },
  );
  await t.test(
    "LC16 approval generates one-time handover, clears factors, revokes sessions, no plaintext stored",
    async () => {
      const result = await service.approve(adminToken, {
        requestId,
        currentPassword: initial,
        method: "tatap_muka",
        evidence: "REF-01",
        reason: "Identitas telah diperiksa",
      });
      assert.ok(result.temporaryPassword.length >= 20);
      assert.equal(await auth.session(token), null);
      const next = await signIn("peserta", result.temporaryPassword);
      assert.equal(next.session.scope, "onboarding");
      assert.equal(next.session.onboarding.emailVerified, false);
      assert.equal(next.session.onboarding.securityQuestionReady, false);
      const logs = await db.query(
        "select redacted_changes,reason from ops.audit_logs",
      );
      assert.equal(
        JSON.stringify(logs).includes(result.temporaryPassword),
        false,
      );
      await assert.rejects(() =>
        service.approve(adminToken, {
          requestId,
          currentPassword: initial,
          method: "tatap_muka",
          evidence: "REF-01",
          reason: "Identitas telah diperiksa",
        }),
      );
    },
  );
  await t.test(
    "LC17 worker only claims leased security message, acknowledges once, purges secret",
    async () => {
      // Cancel other pending messages so this scenario checks a known OTP recipient.
      await db.query(
        "update ops.notification_outbox set state='cancelled' where state in ('pending','retry_wait')",
      );
      const queued = await service.requestEmail(adminToken, {
        email: "admin.new@example.test",
        currentPassword: initial,
      });
      const code = await readOtp(queued.challengeId!);
      const messages: MailMessage[] = [];
      const worker = new SecurityOutboxWorker(
        workerDb,
        {
          send: async (message) => {
            messages.push(message);
            return "sent";
          },
        },
        config.encryptionKey,
        config.appUrl,
      );
      const result = await worker.deliverOne();
      assert.equal(result.result, "sent");
      assert.equal(messages.length, 1);
      assert.ok(messages[0]!.text.includes(code));
      assert.equal((await worker.deliverOne()).processed, 0);
      assert.equal(
        (
          await db.query(
            "select * from auth_private.outbox_secrets where challenge_id=$1",
            [queued.challengeId!],
          )
        ).rows.length,
        0,
      );
    },
  );
  await t.test(
    "LC18 provider retry uses stable idempotency, classifies failures, no false delivery success",
    async () => {
      const keys: string[] = [];
      let status = 429;
      const mock: typeof fetch = async (_input, init) => {
        keys.push(new Headers(init?.headers).get("Idempotency-Key")!);
        return new Response("", { status });
      };
      const adapter = new ResendMailAdapter(
          "synthetic-key",
          "sender@example.test",
          mock,
        ),
        message = {
          id: randomUUID(),
          to: "synthetic@example.test",
          subject: "Sintetis",
          text: "Sintetis",
        };
      assert.equal(await adapter.send(message), "retry_wait");
      status = 200;
      assert.equal(await adapter.send(message), "sent");
      assert.equal(keys[0], keys[1]);
      status = 400;
      assert.equal(await adapter.send(message), "failed");
      status = 409;
      assert.equal(await adapter.send(message), "unknown");
    },
  );
  await t.test(
    "LC19 worker rejects tampered cipher without calling provider",
    async () => {
      await db.query(
        "update auth_private.verification_challenges set created_at=clock_timestamp()-interval '61 seconds' where id=$1",
        [challenge],
      );
      await service.forgot({ username: "pengelola", method: "email" });
      await db.query(
        "update auth_private.outbox_secrets set auth_tag=decode(repeat('00',16),'hex') where outbox_id in(select id from ops.notification_outbox where state='pending')",
      );
      let sent = false;
      const worker = new SecurityOutboxWorker(
        workerDb,
        {
          send: async () => {
            sent = true;
            return "sent" as DeliveryResult;
          },
        },
        config.encryptionKey,
        config.appUrl,
      );
      await worker.deliverOne();
      assert.equal(sent, false);
    },
  );
  await t.test(
    "LC20 HTTP csrf/origin, private DTO, no-store and generic public recovery",
    async () => {
      const httpConfig = {
          appUrl: config.appUrl,
          sessionSecret: randomBytes(40).toString("hex"),
          production: true,
          vercel: true,
        },
        handler = createLifecycleHandler({
          service: async () => service,
          config: () => httpConfig,
        }),
        pre = randomBytes(32).toString("base64url"),
        csrf = issueCsrf(httpConfig.sessionSecret, "login", pre);
      const headers = {
        origin: config.appUrl,
        cookie: `__Host-sim_guru_prelogin=${pre}`,
        "x-csrf-token": csrf,
        "content-type": "application/json",
        "x-vercel-forwarded-for": "198.51.100.50",
      };
      const make = (origin: string) =>
        new Request(config.appUrl + "/api/auth/forgot-password", {
          method: "POST",
          headers: { ...headers, origin },
          body: JSON.stringify({ username: "missing.user", method: "email" }),
        });
      assert.equal(
        (await handler("forgot-password", make("https://evil.example"))).status,
        403,
      );
      const response = await handler("forgot-password", make(config.appUrl));
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("Cache-Control"), "no-store");
      assert.equal((await response.json()).data.accepted, true);
      const sessionCsrf = issueCsrf(
          httpConfig.sessionSecret,
          "session",
          adminToken,
        ),
        profileResponse = await handler(
          "profile",
          new Request(config.appUrl + "/api/auth/profile", {
            headers: { cookie: `__Host-sim_guru_session=${adminToken}` },
          }),
        );
      assert.equal(profileResponse.status, 200);
      assert.equal(
        JSON.stringify(await profileResponse.json()).includes(hash),
        false,
      );
      assert.ok(sessionCsrf);
    },
  );
  await t.test(
    "LC22 expired lease loses acknowledgement, expired reset capability rejected",
    async () => {
      await db.query(
        "update ops.notification_outbox set state='cancelled' where state in ('pending','retry_wait','sending')",
      );
      await db.query(
        "update auth_private.verification_challenges set created_at=clock_timestamp()-interval '61 seconds' where user_id=(select id from app.app_users where username='pengelola') and purpose='reset_otp'",
      );
      const recovery = await service.forgot({
          username: "pengelola",
          method: "email",
        }),
        code = await readOtp(recovery.challengeId);
      const lease = (
        await workerDb.query<{ value: { id: string; lease: string } }>(
          "select auth_private.claim_security_outbox() as value",
        )
      ).rows[0]!.value;
      await db.query(
        "update ops.notification_outbox set lease_until=clock_timestamp()-interval '1 second' where id=$1",
        [lease.id],
      );
      assert.equal(
        (
          await workerDb.query<{ ok: boolean }>(
            "select auth_private.finish_security_outbox($1,$2,'sent') as ok",
            [lease.id, lease.lease],
          )
        ).rows[0]!.ok,
        false,
      );
      const capability = (await service.verifyOtp("reset_otp", null, {
        challengeId: recovery.challengeId,
        otp: code,
      })) as { challengeId: string; token: string };
      await db.query(
        "update auth_private.verification_challenges set created_at=clock_timestamp()-interval '10 minutes',expires_at=clock_timestamp()-interval '1 second' where id=$1",
        [capability.challengeId],
      );
      await assert.rejects(() =>
        service.reset({
          ...capability,
          newPassword: replacement,
          confirmation: replacement,
        }),
      );
    },
  );
  await t.test(
    "LC23 wrong-session email OTP cannot modify another user's address",
    async () => {
      await db.query(
        "update auth_private.verification_challenges set created_at=clock_timestamp()-interval '61 seconds' where user_id=(select id from app.app_users where username='pengelola') and purpose='email_verify'",
      );
      const queued = await service.requestEmail(adminToken, {
          email: "admin.final@example.test",
          currentPassword: initial,
        }),
        code = await readOtp(queued.challengeId!);
      await assert.rejects(() =>
        service.verifyOtp(
          "email_verify",
          randomBytes(32).toString("base64url"),
          { challengeId: queued.challengeId!, otp: code },
        ),
      );
      assert.equal(
        (await service.profile(adminToken)).email,
        "admin@example.test",
      );
      await service.verifyOtp("email_verify", adminToken, {
        challengeId: queued.challengeId!,
        otp: code,
      });
      assert.equal(await auth.session(adminToken), null);
    },
  );
  await t.test(
    "LC21 persistent rate limits apply to unknown identities too",
    async () => {
      for (let i = 0; i < 15; i++)
        await service.rate("198.51.100.99", "unknown-account");
      await assert.rejects(
        () => service.rate("198.51.100.100", "unknown-account"),
        /RATE_LIMITED/,
      );
    },
  );
});
