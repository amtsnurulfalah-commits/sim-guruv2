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
import { CalendarService } from "../../src/server/calendar/service";
import { LocalAuthService } from "../../src/server/auth/service";
import { createDashboardHandler } from "../../src/server/dashboard/http";
const password = "H9!vL4#qT8@bP2$wF7&z";
test("Tahap1.6 dashboard boundaries with real local sessions", async (t) => {
  const db = await openPgliteDatabase();
  t.after(() => db.close());
  await applyMigrations(
    db,
    await readMigrations(resolve("supabase/migrations")),
  );
  const passwords = await getPasswordService(),
    hash = await passwords.hashNew(password, {
      username: "guru.shell",
      fullName: "Guru Sintetis",
    });
  for (const [username, role, ready] of [
    ["guru.shell", "guru", true],
    ["admin.shell", "admin", true],
    ["onboard.shell", "guru", false],
  ] as const) {
    const id = (
      await db.query<{ id: string }>(
        "insert into app.app_users(username,full_name,role,status,must_change_password,contact_email,email_verified_at) values($1,$1,$2,'active',$3,$4,case when $5 then clock_timestamp() else null end) returning id",
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
  }
  const authDb: SqlDatabase = {
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
  const auth = new LocalAuthService(
      authDb,
      passwords,
      randomBytes(40).toString("hex"),
    ),
    config = {
      appUrl: "https://school.example",
      sessionSecret: randomBytes(40).toString("hex"),
      production: true,
      vercel: true,
    },
    handler = createDashboardHandler({
      service: async () => auth,
      config: () => config,
    });
  const login = (username: string) =>
    auth.login({ username, password }, randomUUID(), randomUUID());
  const guru = (await login("guru.shell")).token,
    admin = (await login("admin.shell")).token,
    onboard = (await login("onboard.shell")).token;
  const request = (token?: string, path = "/api/dashboard", origin?: string) =>
    new Request(config.appUrl + path, {
      headers: {
        ...(token ? { cookie: `__Host-sim_guru_session=${token}` } : {}),
        ...(origin ? { origin } : {}),
      },
    });
  await t.test(
    "SH01 anonymous/forged cookie denied; browser role and actor query cannot elevate",
    async () => {
      assert.equal((await handler(request())).status, 401);
      const forged = await handler(
        request(randomBytes(32).toString("base64url")),
      );
      assert.equal(forged.status, 401);
      const response = await handler(
        request(guru, "/api/dashboard?role=admin&actorId=" + randomUUID()),
      );
      assert.equal(response.status, 200);
      const data = (await response.json()).data;
      assert.equal(data.user.role, "guru");
      assert.equal(
        data.modules.some((m: { adminOnly?: boolean }) => m.adminOnly),
        false,
      );
    },
  );
  await t.test(
    "SH02 admin/guru filtered DTO without credentials or invented financial metrics",
    async () => {
      const response = await handler(request(admin));
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      const result = await response.json();
      assert.equal(result.data.modules.length, 18);
      assert.equal(result.data.financeSummaryAvailable, false);
      assert.equal(result.data.activitySummaryAvailable, false);
      assert.equal(JSON.stringify(result).includes(hash), false);
      assert.equal(JSON.stringify(result).includes(admin), false);
      assert.equal("amount" in result.data, false);
      assert.equal(result.data.user.fullName, "admin.shell");
    },
  );
  await t.test("SH03 onboarding session cannot read dashboard", async () => {
    const response = await handler(request(onboard));
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error.code, "ONBOARDING_REQUIRED");
  });
  await t.test(
    "SH04 maintenance affects existing guru session; admin remains allowed",
    async () => {
      await db.query(
        "insert into app.system_settings(key,typed_value) values('maintenance.enabled','true'::jsonb)",
      );
      assert.equal((await handler(request(guru))).status, 503);
      assert.equal((await handler(request(admin))).status, 200);
      await db.query(
        "delete from app.system_settings where key='maintenance.enabled'",
      );
    },
  );
  await t.test("SH06 context and summary begin independently after session verification and preserve the response contract", {timeout:10000}, async () => {
    const calendar = new CalendarService(db);
    let summaryStarted = false;
    let contextStarted = false;
    let releaseContext!: () => void;
    const contextReady = new Promise<void>(resolve => { releaseContext = resolve; });
    const context = await calendar.context(admin, {date:"2026-10-21"});
    t.mock.method(calendar,"context",async () => {
      contextStarted = true;
      await contextReady;
      return context;
    });
    const extended = createDashboardHandler({config:()=>config,service:async()=>auth,calendar:async()=>calendar,summary:async()=>{
      summaryStarted = true;
      releaseContext();
      return {date:"2026-10-21",tasks:[],planned:[]};
    }});
    const response = await extended(request(admin));
    assert.equal(response.status,200);
    const data=(await response.json()).data;
    assert.equal(contextStarted,true); assert.equal(summaryStarted,true);
    assert.equal(data.dayContext.date,"2026-10-21");
    assert.equal(data.activitySummaryAvailable,true);assert.equal(data.financeSummaryAvailable,true);
    assert.deepEqual(data.summary.tasks,[]);
  });
  await t.test("summary-only isolates unused calendar enrichment without bypassing authentication", async () => {
    const extended = createDashboardHandler({config:()=>config,service:async()=>auth,calendar:async()=>{throw Error("optional calendar unavailable");},summary:async()=>({tasks:[]})});
    assert.equal((await extended(request(admin,"/api/dashboard?section=summary"))).status,200);
    assert.equal((await extended(request(admin))).status,500);
    assert.equal((await extended(request(undefined,"/api/dashboard?section=summary"))).status,401);
    assert.equal((await extended(request(onboard,"/api/dashboard?section=summary"))).status,403);
    assert.equal((await extended(new Request(config.appUrl+"/api/dashboard",{method:"POST"}))).status,405);
  });
  await t.test(
    "SH05 cross-origin and revoked sessions rejected; backend error sanitized",
    async () => {
      assert.equal(
        (
          await handler(
            request(admin, "/api/dashboard", "https://other.example"),
          )
        ).status,
        403,
      );
      await auth.logout(guru, randomUUID());
      assert.equal((await handler(request(guru))).status, 401);
      const unavailable = createDashboardHandler({
          config: () => config,
          service: async () => {
            throw Object.assign(new Error("synthetic private database error"), {
              code: "ECONNREFUSED",
            });
          },
        }),
        response = await unavailable(request(admin));
      assert.equal(response.status, 503);
      assert.equal(
        JSON.stringify(await response.json()).includes("private database"),
        false,
      );
    },
  );
});
