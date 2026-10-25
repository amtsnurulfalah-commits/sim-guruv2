import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { openPgliteDatabase } from "../helpers/pglite-database";
import { applyMigrations, readMigrations } from "../../scripts/lib/migrations";
import type {
  SqlDatabase,
  SqlExecutor,
  SqlParameter,
} from "../../scripts/lib/sql-database";
import { getPasswordService } from "../../src/server/auth/passwords";
import { AuthError, LocalAuthService } from "../../src/server/auth/service";
import { issueCsrf } from "../../src/server/auth/security";
import { UserService } from "../../src/server/users/service";
import { createUserHandler } from "../../src/server/users/http";
import { AccountLifecycleService } from "../../src/server/accounts/lifecycle";
import {
  SecurityOutboxWorker,
  type DeliveryResult,
  type MailMessage,
} from "../../src/server/mail/security-outbox";
import { createSecurityOtpDelivery } from "../../src/server/mail/runtime";

test("Admin reset email: authorized queue, worker delivery and owner-only password completion", async (t) => {
  const db = await openPgliteDatabase();
  t.after(() => db.close());
  await db.exec("CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;");
  await applyMigrations(db, await readMigrations("supabase/migrations"));
  function scope(role: string): SqlDatabase {
    return {
      transaction: async <T>(work: (tx: SqlExecutor) => Promise<T>) => {
        try {
          return await db.transaction(async (tx) => {
            await tx.exec("SET SESSION AUTHORIZATION " + role);
            return work(tx);
          });
        } finally {
          await db.exec("SET SESSION AUTHORIZATION postgres; RESET ROLE");
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
    passwords = await getPasswordService();
  const password = "Original9!v7R3#Secret",
    hash = await passwords.hashNew(password, {
      username: "fixture.admin",
      fullName: "Administrator sintetis",
    });
  let seq = 0;
  async function fixture(role = "guru", status = "active", verified = true) {
    const username = "reset.fixture." + ++seq,
      email = username + "@example.test";
    const id = (
      await db.query<{ id: string }>(
        "insert into app.app_users(username,full_name,role,status,must_change_password,contact_email,email_verified_at) values($1,$1,$2,$3,false,$4,case when $5 then clock_timestamp() end) returning id",
        [username, role, status, email, verified],
      )
    ).rows[0]!.id;
    await db.query(
      "insert into auth_private.user_credentials(user_id,password_hash) values($1,$2)",
      [id, hash],
    );
    await db.query(
      "insert into auth_private.security_questions(user_id,question,answer_hash) values($1,'Pertanyaan sintetis',$2)",
      [id, hash],
    );
    return { id, username, email };
  }
  const actor = await fixture("admin"),
    target = await fixture(),
    teacher = await fixture();
  const config = {
    appUrl: "https://school.example",
    sessionSecret: randomBytes(40).toString("hex"),
    production: true,
    vercel: true,
  };
  const encryptionKey = randomBytes(32).toString("hex"),
    hmac = randomBytes(40).toString("hex");
  const auth = new LocalAuthService(authDb, passwords, config.sessionSecret),
    users = new UserService(authDb, passwords, {
      appUrl: config.appUrl,
      encryptionKey,
      hmac,
    });
  const lifecycle = new AccountLifecycleService(authDb, passwords, {
    appUrl: config.appUrl,
    encryptionKey,
    hmac,
  });
  const login = async (username: string, value = password) =>
    (
      await auth.login(
        { username, password: value },
        randomUUID(),
        randomUUID(),
      )
    ).token;
  const admin = await login(actor.username),
    guru = await login(teacher.username),
    targetSession = await login(target.username);
  const messages: MailMessage[] = [];
  let provider: DeliveryResult = "sent",
    ready = true;
  const worker = new SecurityOutboxWorker(
    workerDb,
    {
      send: async (message) => {
        messages.push(message);
        return provider;
      },
    },
    encryptionKey,
    config.appUrl,
  );
  const mail = createSecurityOtpDelivery({
    ready() {
      if (!ready) throw new AuthError("EMAIL_DELIVERY_UNAVAILABLE", 503);
    },
    worker: () => worker,
  });
  const handler = createUserHandler({
    config: () => config,
    auth: async () => auth,
    users: async () => users,
    rate: async () => lifecycle,
    mail,
  });
  const proof = {
    currentPassword: password,
    reason: "Bantuan pemilik akun terverifikasi",
  };
  function request(
    token: string | undefined,
    body: unknown,
    extra: Record<string, string> = {},
    method = "POST",
  ) {
    return new Request(
      config.appUrl + "/api/users/" + target.id + "/reset-email",
      {
        method,
        headers: {
          origin: config.appUrl,
          "content-type": "application/json",
          "x-vercel-forwarded-for": "192.0.2.8",
          ...(token
            ? {
                cookie: "__Host-sim_guru_session=" + token,
                "x-csrf-token": issueCsrf(
                  config.sessionSecret,
                  "session",
                  token,
                ),
              }
            : {}),
          ...extra,
        },
        ...(method !== "GET" ? { body: JSON.stringify(body) } : {}),
      },
    );
  }
  const version = async (id: string) => (await users.detail(admin, id)).version;
  await t.test(
    "admin role, origin, CSRF, method, password and strict payload checks",
    async () => {
      const body = { ...proof, version: await version(target.id) };
      assert.equal(
        (await handler("reset-email", request(undefined, body), target.id))
          .status,
        403,
      );
      assert.equal(
        (await handler("reset-email", request(guru, body), target.id)).status,
        403,
      );
      assert.equal(
        (
          await handler(
            "reset-email",
            request(admin, body, { origin: "https://evil.example" }),
            target.id,
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await handler(
            "reset-email",
            request(admin, body, { "x-csrf-token": "wrong" }),
            target.id,
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await handler(
            "reset-email",
            request(admin, body, {}, "GET"),
            target.id,
          )
        ).status,
        405,
      );
      assert.equal(
        (
          await handler(
            "reset-email",
            request(admin, { ...body, currentPassword: "wrong" }),
            target.id,
          )
        ).status,
        401,
      );
      assert.equal(
        (
          await handler(
            "reset-email",
            request(admin, { ...body, email: "other@example.test" }),
            target.id,
          )
        ).status,
        422,
      );
      ready = false;
      assert.equal(
        (await handler("reset-email", request(admin, body), target.id)).status,
        503,
      );
      ready = true;
      assert.equal(messages.length, 0);
      assert.equal(await version(target.id), body.version);
    },
  );
  let challengeId = "",
    otp = "";
  await t.test(
    "commit before dispatch; no reset/session revocation until owner verification",
    async () => {
      const oldVersion = await version(target.id);
      const response = await handler(
        "reset-email",
        request(admin, { ...proof, version: oldVersion }),
        target.id,
      );
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(response.headers.get("set-cookie"), null);
      const body = await response.json();
      assert.equal(body.data.emailDelivery, "accepted");
      assert.equal(body.data.delivery, "queued");
      assert.equal(body.data.challengeId, undefined);
      assert.equal(body.data.token, undefined);
      assert.equal(body.data.otp, undefined);
      assert.equal(body.data.user.id, target.id);
      assert.notEqual(body.data.user.version, oldVersion);
      assert.equal(messages.length, 1);
      assert.equal(messages[0]!.to, target.email);
      otp = messages[0]!.text.match(/Anda: (\d{6})/)![1]!;
      const link = new URL(
        messages[0]!.text.match(
          /https:\/\/school\.example\/lupa-password#[^\s]+/,
        )![0],
      );
      challengeId = new URLSearchParams(link.hash.slice(1)).get("challengeId")!;
      assert.equal(new URLSearchParams(link.hash.slice(1)).get("otp"), null);
      assert.equal(link.search, "");
      assert.ok(await auth.requireSession(targetSession, true));
      assert.ok(await auth.requireSession(admin, true));
      assert.equal(
        (
          await db.query(
            "select * from auth_private.outbox_secrets where challenge_id=$1",
            [challengeId],
          )
        ).rows.length,
        0,
      );
      const audit = (
        await db.query<{ actor_id: string; entity_id: string; reason: string }>(
          "select actor_id,entity_id,reason from ops.audit_logs where action='users.password_reset_email_queued' and entity_id=$1",
          [target.id],
        )
      ).rows;
      assert.deepEqual(audit, [
        { actor_id: actor.id, entity_id: target.id, reason: proof.reason },
      ]);
      assert.equal(
        (
          await handler(
            "reset-email",
            request(admin, { ...proof, version: oldVersion }),
            target.id,
          )
        ).status,
        409,
      );
      const limited = await handler(
        "reset-email",
        request(admin, { ...proof, version: await version(target.id) }),
        target.id,
      );
      assert.equal(limited.status, 429);
      assert.equal(limited.headers.get("retry-after"), "60");
      assert.equal(messages.length, 1);
    },
  );
  await t.test(
    "owner OTP then password reset consumes once and revokes old target sessions",
    async () => {
      await assert.rejects(() =>
        lifecycle.verifyOtp("reset_otp", null, {
          challengeId,
          otp: otp === "000000" ? "111111" : "000000",
        }),
      );
      const capability = await lifecycle.verifyOtp("reset_otp", null, {
        challengeId,
        otp,
      });
      assert.ok("token" in capability);
      if (!("token" in capability)) throw Error("RESET_PROOF_REQUIRED");
      const next = "Changed9!r8W3#Password";
      await lifecycle.reset({
        ...capability,
        newPassword: next,
        confirmation: next,
      });
      await assert.rejects(() =>
        lifecycle.reset({
          ...capability,
          newPassword: next,
          confirmation: next,
        }),
      );
      await assert.rejects(() => auth.requireSession(targetSession, true));
      await assert.rejects(() => login(target.username));
      assert.ok(await login(target.username, next));
      assert.ok(await auth.requireSession(admin, true));
    },
  );
  await t.test(
    "inactive/unverified targets rejected and no privilege widening",
    async () => {
      for (const [status, verified] of [
        ["pending_activation", true],
        ["disabled", true],
        ["archived", true],
        ["active", false],
      ] as const) {
        const other = await fixture("guru", status, verified);
        const response = await handler(
          "reset-email",
          request(admin, { ...proof, version: await version(other.id) }),
          other.id,
        );
        assert.equal(response.status, 403);
        assert.equal(
          (await response.json()).error.code,
          "RESET_EMAIL_NOT_ALLOWED",
        );
      }
      for (const role of [
        "sim_guru_business",
        "sim_guru_worker",
        "anon",
        "authenticated",
      ]) {
        const result = (
          await db.query<{ allowed: boolean }>(
            "select has_function_privilege($1,'auth_private.users_queue_reset_email(text,uuid,bigint,text,text,uuid,text,uuid,text,text,text,text)','execute') allowed",
            [role],
          )
        ).rows[0]!;
        assert.equal(result.allowed, false);
      }
    },
  );
  await t.test(
    "delivery receipts distinguish retry, failure and ambiguous acceptance",
    async () => {
      // The HTTP admin limiter was exercised above; independent new admin sessions do not bypass its account key.
      for (const [mode, expected] of [
        ["retry_wait", "pending"],
        ["failed", "failed"],
        ["unknown", "unknown"],
      ] as const) {
        const other = await fixture();
        provider = mode;
        const queued = await users.resetEmail(admin, other.id, {
          ...proof,
          version: await version(other.id),
        });
        const result = await mail.deliver(queued.challengeId);
        assert.equal(result, expected);
        assert.ok(await auth.requireSession(admin, true));
      }
    },
  );
});
