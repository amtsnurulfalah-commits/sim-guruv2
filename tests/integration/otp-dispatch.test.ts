import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { openPgliteDatabase } from "../helpers/pglite-database";
import { readMigrations, applyMigrations } from "../../scripts/lib/migrations";
import type {
  SqlDatabase,
  SqlExecutor,
  SqlParameter,
} from "../../scripts/lib/sql-database";
import { getPasswordService } from "../../src/server/auth/passwords";
import { LocalAuthService, AuthError } from "../../src/server/auth/service";
import { AccountLifecycleService } from "../../src/server/accounts/lifecycle";
import { createLifecycleHandler } from "../../src/server/accounts/http";
import { issueCsrf } from "../../src/server/auth/security";
import {
  SecurityOutboxWorker,
  type MailMessage,
  type DeliveryResult,
} from "../../src/server/mail/security-outbox";
import { createSecurityOtpDelivery } from "../../src/server/mail/runtime";

test("OTP request commits then dispatches its own message with worker-only privileges", async (t) => {
  const db = await openPgliteDatabase();
  t.after(() => db.close());
  await applyMigrations(
    db,
    await readMigrations(resolve("supabase/migrations")),
  );
  function scope(role: string): SqlDatabase {
    return {
      transaction: async <T>(work: (tx: SqlExecutor) => Promise<T>) => {
        try {
          return await db.transaction(async (tx) => {
            await tx.exec("SET SESSION AUTHORIZATION " + role);
            return work(tx);
          });
        } finally {
          await db.exec("SET SESSION AUTHORIZATION postgres;RESET ROLE");
        }
      },
      query<T extends Record<string, unknown>>(
        sql: string,
        args: readonly SqlParameter[] = [],
      ) {
        return this.transaction((tx) => tx.query<T>(sql, args));
      },
      exec(sql) {
        return this.transaction((tx) => tx.exec(sql));
      },
      close: async () => {},
    };
  }
  const authDb = scope("sim_guru_auth"),
    workerDb = scope("sim_guru_worker"),
    passwords = await getPasswordService(),
    password = "K8!wT5#rH3@cB6$yF4&z",
    hash = await passwords.hashNew(password, {
      username: "otp.fixture",
      fullName: "Penguji Kirim",
    });
  const config = {
      appUrl: "https://school.example",
      hmac: randomBytes(40).toString("hex"),
      encryptionKey: randomBytes(32).toString("hex"),
    },
    secret = randomBytes(40).toString("hex");
  const auth = new LocalAuthService(authDb, passwords, config.hmac),
    service = new AccountLifecycleService(authDb, passwords, config),
    messages: MailMessage[] = [];
  let outcome: DeliveryResult = "sent";
  const worker = new SecurityOutboxWorker(
    workerDb,
    {
      async send(message) {
        messages.push(message);
        return outcome;
      },
    },
    config.encryptionKey,
    config.appUrl,
  );
  const delivery = createSecurityOtpDelivery({
    ready() {},
    worker: () => worker,
  });
  const handler = createLifecycleHandler({
    service: async () => service,
    config: () => ({
      appUrl: config.appUrl,
      sessionSecret: secret,
      production: true,
      vercel: true,
    }),
    mail: delivery,
  });
  async function fixture(label: string) {
    const username = "otp." + label;
    const id = (
      await db.query<{ id: string }>(
        "insert into app.app_users(username,full_name,role,status,must_change_password) values($1,$1,'guru','active',true) returning id",
        [username],
      )
    ).rows[0]!.id;
    await db.query(
      "insert into auth_private.user_credentials(user_id,password_hash) values($1,$2)",
      [id, hash],
    );
    const token = (
      await auth.login({ username, password }, randomUUID(), randomUUID())
    ).token;
    return { id, token, email: label + "@example.test" };
  }
  function request(token: string, email: string) {
    return new Request(config.appUrl + "/api/auth/email-request", {
      method: "POST",
      headers: {
        origin: config.appUrl,
        "content-type": "application/json",
        "x-vercel-forwarded-for": "198.51.100.25",
        cookie: "__Host-sim_guru_session=" + token,
        "x-csrf-token": issueCsrf(secret, "session", token),
      },
      body: JSON.stringify({ email, currentPassword: password }),
    });
  }
  const queuedIds: string[] = [];
  await t.test(
    "OD01 missing delivery configuration returns503 before creating a challenge",
    async () => {
      const f = await fixture("missing");
      const unavailable = createLifecycleHandler({
        service: async () => service,
        config: () => ({
          appUrl: config.appUrl,
          sessionSecret: secret,
          production: true,
          vercel: true,
        }),
        mail: {
          ready() {
            throw new AuthError("EMAIL_DELIVERY_UNAVAILABLE", 503);
          },
          deliver: async () => {
            throw Error("MUST_NOT_SEND");
          },
        },
      });
      const response = await unavailable(
        "email-request",
        request(f.token, f.email),
      );
      assert.equal(response.status, 503);
      assert.equal(
        (await response.json()).error.code,
        "EMAIL_DELIVERY_UNAVAILABLE",
      );
      assert.equal(
        (await db.query("select id from auth_private.verification_challenges"))
          .rows.length,
        0,
      );
    },
  );
  await t.test(
    "OD02 dispatch targets newly requested OTP instead of an older user's message",
    async () => {
      const older = await fixture("older"),
        f = await fixture("fresh");
      const pending = await service.requestEmail(older.token, {
        email: older.email,
        currentPassword: password,
      });
      queuedIds.push(pending.challengeId!);
      const response = await handler(
          "email-request",
          request(f.token, f.email),
        ),
        body = await response.json();
      assert.equal(response.status, 200);
      assert.equal(body.data.delivery, "accepted");
      assert.equal(messages.length, 1);
      assert.equal(messages[0]!.to, f.email);
      assert.ok(!("otp" in body.data));
      assert.ok(!JSON.stringify(body).includes("ciphertext"));
      const otp = messages[0]!.text.match(/: (\d{6})\n/)![1]!;
      await service.verifyOtp("email_verify", f.token, {
        challengeId: body.data.challengeId,
        otp,
      });
      assert.equal(
        (
          await db.query(
            "select outbox_id from auth_private.outbox_secrets where challenge_id=$1",
            [body.data.challengeId],
          )
        ).rows.length,
        0,
      );
      assert.equal(
        (
          await db.query<{ state: string }>(
            "select o.state from ops.notification_outbox o join auth_private.outbox_secrets s on s.outbox_id=o.id where s.challenge_id=$1",
            [pending.challengeId!],
          )
        ).rows[0]!.state,
        "pending",
      );
      queuedIds.push(body.data.challengeId);
    },
  );
  await t.test(
    "OD03 sent/consumed challenge is not sent twice and cooldown does not redispatch",
    async () => {
      assert.equal((await worker.deliverOne(queuedIds[1]!)).processed, 0);
      const f = await fixture("cooldown");
      const before = messages.length;
      assert.equal(
        (
          await (
            await handler("email-request", request(f.token, f.email))
          ).json()
        ).data.delivery,
        "accepted",
      );
      const second = await (
        await handler("email-request", request(f.token, f.email))
      ).json();
      assert.equal(second.data.queued, false);
      assert.equal(messages.length, before + 1);
    },
  );
  await t.test(
    "OD04 provider retry keeps encrypted message and honors next_attempt_at",
    async () => {
      outcome = "retry_wait";
      const f = await fixture("retry");
      const body = await (
        await handler("email-request", request(f.token, f.email))
      ).json();
      assert.equal(body.data.delivery, "pending");
      const row = (
        await db.query<{ state: string; attempts: number }>(
          "select o.state,o.attempts from ops.notification_outbox o join auth_private.outbox_secrets s on s.outbox_id=o.id where s.challenge_id=$1",
          [body.data.challengeId],
        )
      ).rows[0]!;
      assert.equal(row.state, "retry_wait");
      assert.equal(row.attempts, 1);
      assert.equal(
        (await worker.deliverOne(body.data.challengeId)).processed,
        0,
      );
    },
  );
  await t.test(
    "OD05 permanent provider failure is reported and encrypted secret removed",
    async () => {
      outcome = "failed";
      const f = await fixture("failed");
      const body = await (
        await handler("email-request", request(f.token, f.email))
      ).json();
      assert.equal(body.data.delivery, "failed");
      assert.equal(
        (
          await db.query(
            "select outbox_id from auth_private.outbox_secrets where challenge_id=$1",
            [body.data.challengeId],
          )
        ).rows.length,
        0,
      );
    },
  );
  await t.test(
    "OD06 ambiguous provider outcome stays unknown, never claimed as delivered",
    async () => {
      outcome = "unknown";
      const f = await fixture("unknown");
      const body = await (
        await handler("email-request", request(f.token, f.email))
      ).json();
      assert.equal(body.data.delivery, "unknown");
      assert.equal(
        (await worker.deliverOne(body.data.challengeId)).processed,
        0,
      );
    },
  );
  await t.test(
    "OD07 expired or superseded challenge is never dispatched",
    async () => {
      const f = await fixture("expired");
      const v = await service.requestEmail(f.token, {
        email: f.email,
        currentPassword: password,
      });
      await db.query(
        "update auth_private.verification_challenges set superseded_at=clock_timestamp() where id=$1",
        [v.challengeId!],
      );
      const before = messages.length;
      assert.equal((await worker.deliverOne(v.challengeId!)).processed, 0);
      assert.equal(messages.length, before);
      const expired = await fixture("past");
      const past = await service.requestEmail(expired.token, {
        email: expired.email,
        currentPassword: password,
      });
      await db.query(
        "update auth_private.verification_challenges set created_at=clock_timestamp()-interval '20 minutes',expires_at=clock_timestamp()-interval '1 minute' where id=$1",
        [past.challengeId!],
      );
      await db.query(
        "update ops.notification_outbox set public_payload=jsonb_set(public_payload,'{expiresAt}',to_jsonb(clock_timestamp()-interval '1 minute')) where id in(select outbox_id from auth_private.outbox_secrets where challenge_id=$1)",
        [past.challengeId!],
      );
      assert.equal((await worker.deliverOne(past.challengeId!)).processed, 0);
      assert.equal(messages.length, before);
      assert.equal(
        (
          await db.query(
            "select outbox_id from auth_private.outbox_secrets where challenge_id=$1",
            [past.challengeId!],
          )
        ).rows.length,
        0,
      );
    },
  );
  await t.test(
    "OD08 auth/public cannot claim encrypted OTPs; worker cannot read credentials",
    async () => {
      await assert.rejects(() =>
        authDb.query("select auth_private.claim_security_otp($1)", [
          randomUUID(),
        ]),
      );
      await assert.rejects(() =>
        workerDb.query("select * from auth_private.user_credentials"),
      );
      assert.equal(
        (
          await db.query<{ allowed: boolean }>(
            "select has_function_privilege('sim_guru_business','auth_private.claim_security_otp(uuid)','execute') allowed",
          )
        ).rows[0]!.allowed,
        false,
      );
    },
  );
  await t.test(
    "OD09 provider connection errors keep queued result pending without leaking errors",
    async () => {
      const f = await fixture("connection");
      const broken = createLifecycleHandler({
        service: async () => service,
        config: () => ({
          appUrl: config.appUrl,
          sessionSecret: secret,
          production: true,
          vercel: true,
        }),
        mail: {
          ready() {},
          deliver: async () => {
            throw new Error("sensitive-internal-error");
          },
        },
      });
      const response = await broken("email-request", request(f.token, f.email));
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.equal(body.data.delivery, "pending");
      assert.equal(
        JSON.stringify(body).includes("sensitive-internal-error"),
        false,
      );
    },
  );
});
