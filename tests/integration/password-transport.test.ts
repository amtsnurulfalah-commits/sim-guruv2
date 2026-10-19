import {
  sqlJson,
  SqlJsonParameter,
  type SqlDatabase,
} from "../../scripts/lib/sql-database";
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import postgres from "postgres";
import { readMigrations, applyMigrations } from "../../scripts/lib/migrations";
import { openPgliteDatabase } from "../helpers/pglite-database";
import { databaseFromClient } from "../../src/server/auth/runtime";
import { getPasswordService } from "../../src/server/auth/passwords";
import { LocalAuthService } from "../../src/server/auth/service";
import { AccountLifecycleService } from "../../src/server/accounts/lifecycle";
import { createLifecycleHandler } from "../../src/server/accounts/http";
import { issueCsrf } from "../../src/server/auth/security";

test("Password change through production Postgres.js TCP transport", async (t) => {
  const pg = await PGlite.create();
  const seed = await openPgliteDatabase(pg);
  await applyMigrations(
    seed,
    await readMigrations(resolve("supabase/migrations")),
  );
  const passwords = await getPasswordService(),
    oldPassword = "V9!aL4#qN8@zR2$kD7&x",
    nextPassword = "K8!wT5#rH3@cB6$yF4&z";
  const hash = await passwords.hashNew(oldPassword, {
    username: "wire.operator",
    fullName: "Transport Operator",
  });
  const {
    rows: [user],
  } = await seed.query<{ id: string }>(
    "insert into app.app_users(username,full_name,role,status,must_change_password) values('wire.operator','Transport Operator','admin','active',true) returning id",
  );
  await seed.query(
    "insert into auth_private.user_credentials(user_id,password_hash,temporary_expires_at) values($1,$2,clock_timestamp()+interval '1 day')",
    [user!.id, hash],
  );
  const server = new PGLiteSocketServer({ db: pg, port: 0, host: "127.0.0.1" });
  await server.start();
  const port = Number(server.getServerConn().split(":").at(-1));
  const sql = postgres({
    host: "127.0.0.1",
    port,
    username: "postgres",
    database: "postgres",
    max: 1,
    prepare: false,
    onnotice: () => {},
  });
  t.after(async () => {
    await sql.end({ timeout: 2 });
    await server.stop();
    await pg.close();
  });
  await sql.unsafe("set session authorization sim_guru_auth");
  const db = databaseFromClient(sql),
    config = {
      appUrl: "https://school.example",
      hmac: randomBytes(40).toString("hex"),
      encryptionKey: randomBytes(32).toString("hex"),
    };
  const auth = new LocalAuthService(db, passwords, config.hmac),
    service = new AccountLifecycleService(db, passwords, config);
  const token = (
    await auth.login(
      { username: "wire.operator", password: oldPassword },
      randomUUID(),
      randomUUID(),
    )
  ).token;
  const secret = randomBytes(40).toString("hex"),
    handler = createLifecycleHandler({
      service: async () => service,
      config: () => ({
        appUrl: config.appUrl,
        sessionSecret: secret,
        production: true,
        vercel: true,
      }),
    });
  const request = (body: unknown) =>
    new Request(config.appUrl + "/api/auth/change-password", {
      method: "POST",
      headers: {
        "x-vercel-forwarded-for": "198.51.100.88",
        origin: config.appUrl,
        "content-type": "application/json",
        cookie: "__Host-sim_guru_session=" + token,
        "x-csrf-token": issueCsrf(secret, "session", token),
      },
      body: JSON.stringify(body),
    });
  const secondToken = (
    await auth.login(
      { username: "wire.operator", password: oldPassword },
      randomUUID(),
      randomUUID(),
    )
  ).token;
  await t.test(
    "legacy double-encoded payload reproduces VERSION_CONFLICT and rolls back",
    async () => {
      const legacy: SqlDatabase = {
        ...db,
        transaction: (work) =>
          db.transaction((tx) =>
            work({
              ...tx,
              query: (statement, params = []) =>
                tx.query(
                  statement,
                  params.map((p) =>
                    p instanceof SqlJsonParameter ? p.text : p,
                  ),
                ),
            }),
          ),
      };
      const broken = new AccountLifecycleService(legacy, passwords, config);
      await assert.rejects(
        () =>
          broken.changePassword(token, {
            currentPassword: oldPassword,
            newPassword: nextPassword,
            confirmation: nextPassword,
          }),
        /VERSION_CONFLICT/,
      );
      assert.ok(await auth.session(token));
    },
  );
  await t.test(
    "JSON payload preserves objects, arrays, scalar strings, null and exact decimals",
    async () => {
      for (const value of [
        {
          version: "12",
          decimal: "2.4000",
          nested: { text: 'Petik " dan $ tanda' },
        },
        ["a", null, 3],
        "scalar",
        null,
      ]) {
        const result = await db.query<{ value: unknown }>(
          "select $1::jsonb as value",
          [sqlJson(value)],
        );
        assert.deepEqual(result.rows[0]!.value, value);
      }
    },
  );
  await t.test(
    "wrong current password and mismatched confirmation do not change credentials",
    async () => {
      assert.equal(
        (
          await handler(
            "change-password",
            request({
              currentPassword: "wrong",
              newPassword: nextPassword,
              confirmation: nextPassword,
            }),
          )
        ).status,
        401,
      );
      assert.equal(
        (
          await handler(
            "change-password",
            request({
              currentPassword: oldPassword,
              newPassword: nextPassword,
              confirmation: "different",
            }),
          )
        ).status,
        422,
      );
      assert.ok(await auth.session(token));
    },
  );
  await t.test(
    "onboarding password saves, clears cookie, revokes sessions and permits only the new password",
    async () => {
      const response = await handler(
        "change-password",
        request({
          currentPassword: oldPassword,
          newPassword: nextPassword,
          confirmation: nextPassword,
        }),
      );
      const body = await response.json();
      assert.equal(response.status, 200, JSON.stringify(body));
      assert.equal(body.data.loginRequired, true);
      assert.match(response.headers.get("set-cookie")!, /Max-Age=0/);
      assert.equal(await auth.session(token), null);
      assert.equal(await auth.session(secondToken), null);
      await assert.rejects(() =>
        auth.login(
          { username: "wire.operator", password: oldPassword },
          randomUUID(),
          randomUUID(),
        ),
      );
      const result = await auth.login(
        { username: "wire.operator", password: nextPassword },
        randomUUID(),
        randomUUID(),
      );
      assert.equal(result.session.scope, "onboarding");
      assert.equal(result.session.onboarding.mustChangePassword, false);
      await service.setQuestion(result.token, {
        currentPassword: nextPassword,
        question: "Pertanyaan transport",
        answer: "Jawaban uji",
      });
      assert.equal(
        (await service.profile(result.token)).question,
        "Pertanyaan transport",
      );
    },
  );
});
