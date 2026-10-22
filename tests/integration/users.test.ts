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
import { getPasswordService } from "../../src/server/auth/passwords";
import { LocalAuthService, tokenHash } from "../../src/server/auth/service";
import { UserService } from "../../src/server/users/service";
import { createUserHandler } from "../../src/server/users/http";
import { AccountLifecycleService } from "../../src/server/accounts/lifecycle";
import { issueCsrf } from "../../src/server/auth/security";
import { userProfileSchema } from "../../src/lib/users/schemas";
const password = "H9!vL4#qT8@bP2$wF7&z";
test("Tahap 2.1 — user management, real hashes and role-scoped SQL", async (t) => {
  const db = await openPgliteDatabase();
  t.after(() => db.close());
  await applyMigrations(
    db,
    await readMigrations(resolve("supabase/migrations")),
  );
  const passwords = await getPasswordService(),
    hash = await passwords.hashNew(password, {
      username: "operator.test",
      fullName: "Operator Test",
    });
  const scoped: SqlDatabase = {
    transaction: async <T>(work: (tx: SqlExecutor) => Promise<T>) => {
      try {
        return await db.transaction(async (tx) => {
          await tx.exec("SET SESSION AUTHORIZATION sim_guru_auth");
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
  async function fixture(username: string, role: string, ready = true) {
    const id = (
      await db.query<{ id: string }>(
        "insert into app.app_users(username,full_name,role,status,must_change_password,contact_email,email_verified_at) values($1,$1,$2,'active',$3,$4,case when $5 then clock_timestamp() end) returning id",
        [username, role, !ready, username + "@example.test", ready],
      )
    ).rows[0]!.id;
    await db.query(
      "insert into auth_private.user_credentials(user_id,password_hash) values($1,$2)",
      [id, hash],
    );
    if (ready)
      await db.query(
        "insert into auth_private.security_questions(user_id,question,answer_hash) values($1,'Pertanyaan sintetis',$2)",
        [id, hash],
      );
    return id;
  }
  const adminId = await fixture("operator.test", "admin"),
    guruId = await fixture("guru.test", "guru");
  await fixture("pending.admin", "admin", false);
  const auth = new LocalAuthService(
    scoped,
    passwords,
    randomBytes(40).toString("hex"),
  );
  const config = {
    appUrl: "https://school.example",
    sessionSecret: randomBytes(40).toString("hex"),
    production: true,
    vercel: true,
  };
  const encryptionKey = randomBytes(32).toString("hex"),
    service = new UserService(scoped, passwords, {
      appUrl: config.appUrl,
      encryptionKey,
    });
  let admin = (
    await auth.login(
      { username: "operator.test", password },
      randomUUID(),
      randomUUID(),
    )
  ).token;
  const guru = (
    await auth.login(
      { username: "guru.test", password },
      randomUUID(),
      randomUUID(),
    )
  ).token;
  const onboard = (
    await auth.login(
      { username: "pending.admin", password },
      randomUUID(),
      randomUUID(),
    )
  ).token;
  const profile = (username: string) => ({
    username,
    fullName: "Nama " + username,
    nip: "001234",
    role: "guru",
    email: username + "@example.test",
    phone: "081234567890",
    address: "Alamat contoh",
    photoUrl: "",
    employmentStatus: "Tetap",
    rank: "III/a",
    kmDistance: "12.30",
    additionalRole: "",
  });
  const proof = { currentPassword: password, reason: "Pengelolaan akun uji" };
  const handler = createUserHandler({
    config: () => config,
    auth: async () => auth,
    users: async () => service,
    rate: async () =>
      new AccountLifecycleService(scoped, passwords, {
        hmac: config.sessionSecret,
        encryptionKey,
        appUrl: config.appUrl,
      }),
  });
  function request(
    token: string | undefined,
    method = "GET",
    body?: unknown,
    path = "/api/users",
    origin = config.appUrl,
  ) {
    return new Request(config.appUrl + path, {
      method,
      headers: {
        origin,
        "x-vercel-forwarded-for": "192.0.2.7",
        ...(token
          ? {
              cookie: "__Host-sim_guru_session=" + token,
              "x-csrf-token": issueCsrf(config.sessionSecret, "session", token),
            }
          : {}),
        ...(body ? { "content-type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }
  await t.test(
    "US01 HTTP anonymous/guru/onboarding sessions cannot access admin users",
    async () => {
      for (const [token, status] of [
        [undefined, 401],
        [guru, 403],
        [onboard, 403],
      ] as const) {
        assert.equal(
          (await handler("collection", request(token))).status,
          status,
        );
      }
      await assert.rejects(() => service.list(guru, {}));
      await assert.rejects(() => service.list(onboard, {}));
    },
  );
  await t.test(
    "US02 origin/CSRF/method and strict filters prevent bypass",
    async () => {
      assert.equal(
        (
          await handler(
            "collection",
            request(admin, "POST", {}, "/api/users", "https://evil.example"),
          )
        ).status,
        403,
      );
      assert.equal(
        (await handler("collection", request(undefined, "POST", {}))).status,
        403,
      );
      assert.equal((await handler("status", request(admin))).status, 405);
      assert.equal(
        (
          await handler(
            "collection",
            request(
              admin,
              "GET",
              undefined,
              "/api/users?role=admin&actorId=" + guruId,
            ),
          )
        ).status,
        422,
      );
    },
  );
  let pending: Awaited<ReturnType<typeof service.create>>;
  await t.test(
    "US03 activation create is atomic, pending and secret-free DTO",
    async () => {
      pending = await service.create(admin, {
        ...profile("guru.invite"),
        ...proof,
        delivery: "activation",
      });
      assert.equal(pending.delivery, "queued");
      assert.equal(pending.user.status, "pending_activation");
      assert.equal(pending.user.nip, "001234");
      assert.equal(pending.user.kmDistance, "12.30");
      assert.equal(JSON.stringify(pending).includes("passwordHash"), false);
      assert.equal(
        (
          await db.query(
            "select user_id from auth_private.user_credentials where user_id=$1",
            [pending.user.id],
          )
        ).rows.length,
        0,
      );
      assert.equal(
        (
          await db.query(
            "select id from auth_private.verification_challenges where user_id=$1",
            [pending.user.id],
          )
        ).rows.length,
        1,
      );
    },
  );
  await t.test(
    "US04 invalid encryption configuration rolls back user and queue",
    async () => {
      const bad = new UserService(scoped, passwords, {
        appUrl: config.appUrl,
        encryptionKey: "invalid",
      });
      await assert.rejects(() =>
        bad.create(admin, {
          ...profile("rollback.users"),
          ...proof,
          delivery: "activation",
        }),
      );
      assert.equal(
        (
          await db.query(
            "select id from app.app_users where username='rollback.users'",
          )
        ).rows.length,
        0,
      );
    },
  );
  await t.test(
    "US05 duplicate username is case-insensitive and rejects password/role payload extras",
    async () => {
      await assert.rejects(() =>
        service.create(admin, {
          ...profile("GURU.INVITE"),
          ...proof,
          delivery: "activation",
        }),
      );
      await assert.rejects(() =>
        service.create(admin, {
          ...profile("bad.extra"),
          ...proof,
          delivery: "activation",
          password: "common",
        }),
      );
      await assert.rejects(() =>
        service.create(admin, {
          ...profile("bad.role"),
          ...proof,
          delivery: "activation",
          role: "superadmin",
        }),
      );
      await assert.rejects(() =>
        service.create(admin, {
          ...profile("bad.identity"),
          ...proof,
          delivery: "handover",
        }),
      );
      await assert.rejects(() =>
        service.create(admin, {
          ...profile("wrong.proof"),
          ...proof,
          currentPassword: "wrong",
          delivery: "activation",
        }),
      );
    },
  );
  await t.test(
    "US06 full-dataset filters and bounded stable pagination; wildcard treated literally",
    async () => {
      const all = await service.list(admin, { pageSize: 1 });
      assert.equal(all.total, 4);
      const second = await service.list(admin, { pageSize: 1, page: 2 });
      assert.notEqual(all.items[0]!.id, second.items[0]!.id);
      assert.equal(
        (
          await service.list(admin, {
            q: "001234",
            status: "pending_activation",
          })
        ).items[0]?.id,
        pending.user.id,
      );
      assert.equal((await service.list(admin, { q: "%" })).total, 0);
      assert.equal((await service.list(admin, { role: "admin" })).total, 2);
      await assert.rejects(() => service.list(admin, { pageSize: 101 }));
    },
  );
  await t.test(
    "US07 edit metadata, normalization, CAS conflict and reissued pending challenge",
    async () => {
      const changed = await service.edit(admin, pending.user.id, {
        ...profile("guru.invite"),
        ...proof,
        version: pending.user.version,
        fullName: "Guru Diperbarui",
        additionalRole: "KEPALA_SEKOLAH",
      });
      assert.equal(changed.user.phone, "+6281234567890");
      assert.equal(changed.user.additionalRole, "KEPALA_SEKOLAH");
      assert.equal(changed.user.version, "2");
      await assert.rejects(
        () =>
          service.edit(admin, pending.user.id, {
            ...profile("guru.invite"),
            ...proof,
            version: "1",
          }),
        /VERSION_CONFLICT/,
      );
      pending = { ...pending, ...changed };
      assert.equal(
        (
          await db.query(
            "select id from auth_private.verification_challenges where user_id=$1 and superseded_at is null and consumed_at is null",
            [pending.user.id],
          )
        ).rows.length,
        1,
      );
    },
  );
  await t.test(
    "US08 activation cannot bypass onboarding and replay version; reissue revokes prior secret",
    async () => {
      await assert.rejects(
        () =>
          service.status(admin, pending.user.id, {
            ...proof,
            version: pending.user.version,
            status: "active",
          }),
        /INVALID_STATUS_TRANSITION/,
      );
      const result = await service.reissue(admin, pending.user.id, {
        ...proof,
        version: pending.user.version,
      });
      await assert.rejects(
        () =>
          service.reissue(admin, pending.user.id, {
            ...proof,
            version: pending.user.version,
          }),
        /VERSION_CONFLICT/,
      );
      pending = { ...pending, ...result };
      assert.equal(
        (
          await db.query(
            "select s.outbox_id from auth_private.outbox_secrets s join ops.notification_outbox o on o.id=s.outbox_id where o.recipient_id=$1",
            [pending.user.id],
          )
        ).rows.length,
        1,
      );
    },
  );
  await t.test(
    "US09 handover uses random hash, 24h expiry, unverified email and mandatory onboarding",
    async () => {
      const a = await service.create(admin, {
        ...profile("guru.handover"),
        ...proof,
        delivery: "handover",
        method: "tatap_muka",
        evidence: "Referensi pertemuan 001",
      });
      assert.ok(a.temporaryPassword!.length >= 20);
      assert.equal(a.user.mustChangePassword, true);
      assert.equal(a.user.emailVerified, false);
      const row = (
        await db.query<{ password_hash: string; ttl: boolean }>(
          "select password_hash,temporary_expires_at>clock_timestamp()+interval '23 hours' as ttl from auth_private.user_credentials where user_id=$1",
          [a.user.id],
        )
      ).rows[0]!;
      assert.equal(
        (await passwords.verify(row.password_hash, a.temporaryPassword!)).valid,
        true,
      );
      assert.equal(row.ttl, true);
      assert.equal(
        JSON.stringify(
          (
            await db.query(
              "select redacted_changes from ops.audit_logs where entity_id=$1",
              [a.user.id],
            )
          ).rows,
        ).includes(a.temporaryPassword!),
        false,
      );
    },
  );
  await t.test(
    "US10 verified email immutable; profile edit revokes target session",
    async () => {
      const user = await service.detail(admin, guruId);
      await assert.rejects(
        () =>
          service.edit(admin, guruId, {
            ...profile("guru.test"),
            ...proof,
            version: user.version,
            email: "different@example.test",
          }),
        /VERIFIED_EMAIL_IMMUTABLE/,
      );
      await service.edit(admin, guruId, {
        ...profile("guru.test"),
        ...proof,
        version: user.version,
      });
      await assert.rejects(() => auth.requireSession(guru, true));
    },
  );
  await t.test(
    "US11 last ready admin cannot be demoted/disabled/archived; incomplete admin does not count",
    async () => {
      const user = await service.detail(admin, adminId);
      await assert.rejects(
        () =>
          service.edit(admin, adminId, {
            ...profile("operator.test"),
            ...proof,
            version: user.version,
            role: "guru",
          }),
        /LAST_ACTIVE_ADMIN/,
      );
      for (const status of ["disabled", "archived"])
        await assert.rejects(
          () =>
            service.status(admin, adminId, {
              ...proof,
              version: user.version,
              status,
            }),
          /LAST_ACTIVE_ADMIN/,
        );
    },
  );
  await t.test(
    "US12 archive is logical, cancels security material, preserves audit and is terminal",
    async () => {
      const result = await service.status(admin, pending.user.id, {
        ...proof,
        version: pending.user.version,
        status: "archived",
      });
      assert.equal(result.user.status, "archived");
      assert.equal(
        (
          await db.query("select id from app.app_users where id=$1", [
            pending.user.id,
          ])
        ).rows.length,
        1,
      );
      assert.ok(
        (
          await db.query("select id from ops.audit_logs where entity_id=$1", [
            pending.user.id,
          ])
        ).rows.length > 0,
      );
      await assert.rejects(
        () =>
          service.edit(admin, pending.user.id, {
            ...profile("guru.invite"),
            ...proof,
            version: result.user.version,
          }),
        /ARCHIVED_READ_ONLY/,
      );
      await assert.rejects(
        () =>
          service.status(admin, pending.user.id, {
            ...proof,
            version: result.user.version,
            status: "active",
          }),
        /INVALID_STATUS_TRANSITION/,
      );
    },
  );
  await t.test(
    "US13 disabled user cannot log in; admin may reactivate non-archived account",
    async () => {
      const u = await service.detail(admin, guruId),
        disabled = await service.status(admin, guruId, {
          ...proof,
          version: u.version,
          status: "disabled",
        });
      await assert.rejects(() =>
        auth.login(
          { username: "guru.test", password },
          randomUUID(),
          randomUUID(),
        ),
      );
      await service.status(admin, guruId, {
        ...proof,
        version: disabled.user.version,
        status: "active",
      });
    },
  );
  let resetId = "";
  await t.test(
    "US14 pending recovery list binds request to target and version",
    async () => {
      resetId = (
        await db.query<{ id: string }>(
          "insert into auth_private.password_reset_requests(user_id,method,reason) values($1,'admin','Butuh bantuan identitas') returning id",
          [guruId],
        )
      ).rows[0]!.id;
      const row = (await service.requests(admin))[0]!;
      assert.equal(row.userId, guruId);
      await assert.rejects(() =>
        service.recover(admin, adminId, {
          ...proof,
          version: "1",
          requestId: resetId,
          method: "tatap_muka",
          evidence: "Referensi identitas 123",
        }),
      );
      await assert.rejects(
        () =>
          service.recover(admin, guruId, {
            ...proof,
            version: "1",
            requestId: resetId,
            method: "tatap_muka",
            evidence: "Referensi identitas 123",
          }),
        /VERSION_CONFLICT/,
      );
    },
  );
  await t.test(
    "US15 rejection is audited, one-use and cannot approve afterward",
    async () => {
      await service.reject(admin, {
        ...proof,
        action: "reject",
        requestId: resetId,
      });
      assert.equal((await service.requests(admin)).length, 0);
      await assert.rejects(
        () =>
          service.reject(admin, {
            ...proof,
            action: "reject",
            requestId: resetId,
          }),
        /RECOVERY_REQUEST_INVALID/,
      );
      const u = await service.detail(admin, guruId);
      await assert.rejects(
        () =>
          service.recover(admin, guruId, {
            ...proof,
            version: u.version,
            requestId: resetId,
            method: "tatap_muka",
            evidence: "Referensi identitas 123",
          }),
        /RECOVERY_REQUEST_INVALID/,
      );
    },
  );
  await t.test(
    "US16 recovery approval returns temporary secret once and resets factors",
    async () => {
      const requestId = (
          await db.query<{ id: string }>(
            "insert into auth_private.password_reset_requests(user_id,method,reason) values($1,'admin','Permintaan baru') returning id",
            [guruId],
          )
        ).rows[0]!.id,
        u = await service.detail(admin, guruId);
      const r = await service.recover(admin, guruId, {
        ...proof,
        version: u.version,
        requestId,
        method: "tatap_muka",
        evidence: "Referensi identitas 123",
      });
      assert.ok(r.temporaryPassword.length >= 20);
      const now = await service.detail(admin, guruId);
      assert.equal(now.mustChangePassword, true);
      assert.equal(now.emailVerified, false);
      assert.equal(now.securityQuestionReady, false);
    },
  );
  await t.test(
    "US17 least privilege: helpers and new functions unavailable to worker/business/public",
    async () => {
      for (const role of ["sim_guru_business", "sim_guru_worker"]) {
        const p = (
          await db.query<{ allowed: boolean }>(
            "select has_function_privilege($1,'auth_private.users_list(text,text,text,text,integer,integer)','execute') as allowed",
            [role],
          )
        ).rows[0]!;
        assert.equal(p.allowed, false);
      }
      assert.equal(
        (
          await db.query<{ allowed: boolean }>(
            "select has_function_privilege('sim_guru_auth','auth_private.users_dto(uuid)','execute') as allowed",
          )
        ).rows[0]!.allowed,
        false,
      );
      const dto = await service.detail(admin, adminId);
      for (const key of [
        "password_hash",
        "passwordHash",
        "secret_digest",
        "answer_hash",
        "session_token_hash",
      ])
        assert.equal(JSON.stringify(dto).includes(key), false);
    },
  );
  await t.test("US17b malformed distance/photo returns field 422 instead of INTERNAL_ERROR",async()=>{
    for(const patch of [{kmDistance:"invalid"},{photoUrl:"not a URL"}]){
      const response=await handler("collection",request(admin,"POST",{...profile("invalid.input"),...proof,delivery:"activation",email:"invalid@example.test",...patch}));
      assert.equal(response.status,422);const body=await response.json();assert.equal(body.error.code,"VALIDATION_ERROR");
      assert.ok(body.error.fieldErrors[Object.keys(patch)[0]!]);
    }
  });
  await t.test(
    "US18 strict decimal/profile validation and sanitized HTTP conflicts",
    async () => {
      assert.equal(
        userProfileSchema.safeParse({
          ...profile("decimal.test"),
          kmDistance: "NaN",
        }).success,
        false,
      );
      assert.equal(
        userProfileSchema.safeParse({
          ...profile("decimal.test"),
          kmDistance: "1000",
        }).success,
        false,
      );
      const response = await handler(
        "detail",
        request(admin, "PATCH", {
          ...profile("guru.test"),
          ...proof,
          version: "1",
        }),
        guruId,
      );
      assert.equal(response.status, 409);
      assert.equal(response.headers.get("cache-control"), "no-store");
      const body = JSON.stringify(await response.json());
      assert.equal(body.includes("auth_private"), false);
      assert.equal(body.includes(hash), false);
    },
  );
  await t.test(
    "US19 self edit clears cookie and revokes session when a second ready admin exists",
    async () => {
      await fixture("second.admin", "admin");
      const u = await service.detail(admin, adminId);
      const response = await handler(
        "detail",
        request(admin, "PATCH", {
          ...profile("operator.test"),
          role: "admin",
          ...proof,
          version: u.version,
        }),
        adminId,
      );
      assert.equal(response.status, 200);
      assert.match(response.headers.get("set-cookie") ?? "", /Max-Age=0/);
      await assert.rejects(() => auth.requireSession(admin, true));
      admin = (
        await auth.login(
          { username: "operator.test", password },
          randomUUID(),
          randomUUID(),
        )
      ).token;
      assert.ok(tokenHash(admin));
    },
  );
});
