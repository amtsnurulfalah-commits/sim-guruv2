import test from "node:test";
import { createDashboardHandler } from "../../src/server/dashboard/http";
import { wibDate } from "../../src/lib/calendar/schemas";
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
import { MasterService } from "../../src/server/masters/service";
import { CalendarService } from "../../src/server/calendar/service";
import { createCalendarHandler } from "../../src/server/calendar/http";
import { AccountLifecycleService } from "../../src/server/accounts/lifecycle";
import { issueCsrf } from "../../src/server/auth/security";
const password = "H9!vL4#qT8@bP2$wF7&z";
test("Tahap 2.3 — calendar and one operational DayContext", async (t) => {
  const db = await openPgliteDatabase();
  t.after(() => db.close());
  const migrations = await readMigrations(resolve("supabase/migrations"));
  await applyMigrations(db, migrations.slice(0, -1));
  const passwords = await getPasswordService(),
    hash = await passwords.hashNew(password, {
      username: "calendar.operator",
      fullName: "Calendar Operator",
    });
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
    business = scope("sim_guru_business");
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
        "insert into auth_private.security_questions(user_id,question,answer_hash) values($1,'Pertanyaan uji',$2)",
        [id, hash],
      );
    return id;
  }
  const adminId = await fixture("calendar.operator", "admin");
  await fixture("calendar.second", "admin");
  await fixture("calendar.guru", "guru");
  await fixture("calendar.onboard", "admin", false);
  await t.test(
    "CA01 incremental upgrade leaves identities intact, repeat no-op, all71 tables FORCE RLS",
    async () => {
      assert.equal((await applyMigrations(db, migrations)).length, 1);
      assert.equal((await applyMigrations(db, migrations)).length, 0);
      assert.equal(
        (await db.query("select id from app.app_users where id=$1", [adminId]))
          .rows.length,
        1,
      );
      assert.equal(
        (
          await db.query<{ n: number }>(
            "select count(*)::int as n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('app','auth_private','ops') and c.relkind='r' and c.relrowsecurity and c.relforcerowsecurity",
          )
        ).rows[0]!.n,
        71,
      );
    },
  );
  const config = {
      appUrl: "https://school.example",
      sessionSecret: randomBytes(40).toString("hex"),
      production: true,
      vercel: true,
    },
    auth = new LocalAuthService(
      authDb,
      passwords,
      randomBytes(40).toString("hex"),
    );
  const login = async (username: string) =>
    (await auth.login({ username, password }, randomUUID(), randomUUID()))
      .token;
  const admin = await login("calendar.operator"),
    second = await login("calendar.second"),
    guru = await login("calendar.guru"),
    onboard = await login("calendar.onboard");
  const masters = new MasterService(business),
    calendar = new CalendarService(business),
    reason = "Kalender sintetis terkontrol";
  const handler = createCalendarHandler({
    config: () => config,
    auth: async () => auth,
    calendar: async () => calendar,
    rate: async () =>
      new AccountLifecycleService(authDb, passwords, {
        hmac: config.sessionSecret,
        encryptionKey: randomBytes(32).toString("hex"),
        appUrl: config.appUrl,
      }),
  });
  function req(
    token?: string,
    method = "GET",
    body?: unknown,
    path = "/api/settings/calendar?dateStart=2090-01-01&dateEnd=2090-12-31",
    origin = config.appUrl,
  ) {
    return new Request(config.appUrl + path, {
      method,
      headers: {
        origin,
        "x-vercel-forwarded-for": "192.0.2.9",
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
  const input = (date: string, isHoliday = false, version = "0") => ({
    action: "upsert",
    date,
    version,
    description: "Catatan sintetis",
    isHoliday,
    reason,
  });
  const preview = (v: unknown) => calendar.preview(admin, "calendar", v),
    commit = (id: string, action = "upsert") =>
      calendar.commit(admin, "calendar", { previewId: id }, action),
    day = (date: string) => calendar.context(admin, { date });
  const year = await masters.save(admin, "academic-years", {
    version: "0",
    reason,
    data: {
      label: "2090/2091",
      dateStart: "2090-01-01",
      dateEnd: "2091-12-31",
    },
  });
  let period = await masters.save(admin, "academic-periods", {
    version: "0",
    reason,
    data: {
      academicYearId: year.id,
      semester: 1,
      dateStart: "2090-01-01",
      dateEnd: "2090-12-31",
      isActive: true,
    },
  });
  const weekday = "2090-01-02",
    sunday = (() => {
      for (let d = 1; d < 8; d++) {
        const s = "2090-01-0" + d;
        if (new Date(s + "T00:00:00Z").getUTCDay() === 0) return s;
      }
      throw Error("No Sunday");
    })();
  await t.test(
    "CA02 admin list denied for anonymous/guru/onboard; shared context only business sessions",
    async () => {
      for (const [token, status] of [
        [undefined, 401],
        [guru, 403],
        [onboard, 403],
      ] as const)
        assert.equal((await handler("calendar", req(token))).status, status);
      assert.equal(
        (
          await handler(
            "self-context",
            req(guru, "GET", undefined, "/api/day-context?date=" + weekday),
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await handler(
            "self-context",
            req(onboard, "GET", undefined, "/api/day-context?date=" + weekday),
          )
        ).status,
        403,
      );
      await assert.rejects(() =>
        calendar.list(guru, { dateStart: "2090-01-01", dateEnd: "2090-12-31" }),
      );
      await assert.rejects(() => calendar.context(onboard, { date: weekday }));
    },
  );
  await t.test(
    "CA03 origin/CSRF/method/actor spoof rejected before mutation",
    async () => {
      assert.equal(
        (
          await handler(
            "calendar-preview",
            req(admin, "POST", {}, undefined, "https://evil.example"),
          )
        ).status,
        403,
      );
      assert.equal(
        (await handler("calendar-preview", req(undefined, "POST", {}))).status,
        403,
      );
      assert.equal((await handler("calendar-preview", req(admin))).status, 405);
      assert.equal(
        (
          await handler(
            "self-context",
            req(
              guru,
              "GET",
              undefined,
              "/api/day-context?date=" + weekday + "&role=admin",
            ),
          )
        ).status,
        422,
      );
      await assert.rejects(() =>
        preview({ ...input(weekday), actorId: adminId }),
      );
    },
  );
  await t.test(
    "CA04 default weekday has KBM, no invented exams, no period outside configured range",
    async () => {
      const d = await day(weekday);
      assert.equal(
        d.kbmEnabled,
        new Date(weekday + "T00:00:00Z").getUTCDay() !== 0,
      );
      assert.equal(d.examEnabled, false);
      assert.deepEqual(d.activeExamPeriods, []);
      assert.equal(d.academicPeriodId, period.id);
      assert.equal(d.assignmentIntegration, "exams_ready");
      const dashboard = createDashboardHandler({
        service: async () => auth,
        config: () => config,
        calendar: async () => calendar,
      });
      const response = await dashboard(req(admin));
      assert.equal(response.status, 200);
      assert.deepEqual(
        (await response.json()).data.dayContext,
        await calendar.context(admin, { date: wibDate() }),
      );
      assert.equal((await day("2089-12-31")).kbmEnabled, false);
    },
  );
  let normalPreview: Awaited<ReturnType<typeof preview>>;
  await t.test(
    "CA05 nonholiday preview is read-only and keeps KBM active (T41/B25)",
    async () => {
      normalPreview = await preview(input(weekday));
      assert.equal(normalPreview.days[0]!.after.isHoliday, false);
      assert.equal(
        normalPreview.days[0]!.after.kbmEnabled,
        normalPreview.days[0]!.before.kbmEnabled,
      );
      assert.equal(
        (
          await db.query("select id from app.academic_calendar where date=$1", [
            weekday,
          ])
        ).rows.length,
        0,
      );
      await commit(normalPreview.previewId);
      assert.equal((await day(weekday)).isHoliday, false);
      assert.equal(
        (await day(weekday)).kbmEnabled,
        normalPreview.days[0]!.before.kbmEnabled,
      );
    },
  );
  await t.test(
    "CA06 one-use actor-bound/action-bound previews prevent replay and ID substitution",
    async () => {
      await assert.rejects(
        () => commit(normalPreview.previewId),
        /CALENDAR_PREVIEW_INVALID/,
      );
      const p = await preview(input("2090-01-09"));
      await assert.rejects(
        () =>
          calendar.commit(
            second,
            "calendar",
            { previewId: p.previewId },
            "upsert",
          ),
        /CALENDAR_PREVIEW_INVALID/,
      );
      await assert.rejects(
        () =>
          calendar.commit(
            admin,
            "context",
            { previewId: p.previewId },
            "context",
          ),
        /CALENDAR_PREVIEW_INVALID/,
      );
      await assert.rejects(
        () => commit(p.previewId, "delete"),
        /CALENDAR_PREVIEW_INVALID/,
      );
      await commit(p.previewId);
    },
  );
  await t.test(
    "CA07 stale preview detects calendar changes without partial writes",
    async () => {
      const p = await preview(input("2090-01-10")),
        other = await preview(input("2090-01-11"));
      await commit(other.previewId);
      await assert.rejects(() => commit(p.previewId), /CALENDAR_PREVIEW_STALE/);
      assert.equal(
        (
          await db.query(
            "select id from app.academic_calendar where date='2090-01-10'",
          )
        ).rows.length,
        0,
      );
    },
  );
  await t.test(
    "CA08 academic period change invalidates preview even if calendar row unchanged",
    async () => {
      const p = await preview(input("2090-01-12"));
      period = await masters.save(admin, "academic-periods", {
        id: period.id,
        version: period.version,
        reason,
        data: {
          academicYearId: year.id,
          semester: 1,
          dateStart: "2090-01-01",
          dateEnd: "2090-12-31",
          isActive: true,
        },
      });
      await assert.rejects(() => commit(p.previewId), /CALENDAR_PREVIEW_STALE/);
    },
  );
  await t.test(
    "CA09 expired preview is denied without consuming or modifying source",
    async () => {
      const p = await preview(input("2090-01-13"));
      await db.query(
        "update ops.calendar_previews set expires_at=clock_timestamp()-interval '1 minute' where id=$1",
        [p.previewId],
      );
      await assert.rejects(
        () => commit(p.previewId),
        /CALENDAR_PREVIEW_INVALID/,
      );
    },
  );
  await t.test(
    "CA10 holiday disables regular KBM/exam; description alone does not",
    async () => {
      const current = await day(weekday),
        p = await preview(input(weekday, true, current.calendarVersion));
      assert.equal(p.days[0]!.after.isHoliday, true);
      assert.equal(p.days[0]!.after.kbmEnabled, false);
      await commit(p.previewId);
      const d = await day(weekday);
      assert.equal(d.isHoliday, true);
      assert.equal(d.kbmEnabled, false);
      assert.ok(d.reasons.includes("HOLIDAY"));
    },
  );
  await t.test("CA11 CAS rejects old row version before preview", async () => {
    await assert.rejects(
      () => preview(input(weekday, false, "1")),
      /VERSION_CONFLICT/,
    );
  });
  await t.test(
    "CA12 delete is audited tombstone; restores default and re-add requires tombstone version",
    async () => {
      const current = await day(weekday),
        p = await preview({
          action: "delete",
          date: weekday,
          version: current.calendarVersion,
          reason,
        });
      await commit(p.previewId, "delete");
      const d = await day(weekday);
      assert.equal(d.calendarEntry, null);
      assert.equal(d.isHoliday, false);
      assert.equal(
        (await calendar.history(admin, "calendar", weekday)).length,
        3,
      );
      await assert.rejects(() => preview(input(weekday)), /VERSION_CONFLICT/);
      const restore = await preview(input(weekday, false, d.calendarVersion));
      await commit(restore.previewId);
    },
  );
  await t.test(
    "CA13 range preview and commit cover inclusive dates and create one audited entry per date",
    async () => {
      const p = await preview({
        action: "range",
        dateStart: "2090-02-01",
        dateEnd: "2090-02-03",
        description: "Libur rentang",
        isHoliday: true,
        reason,
      });
      assert.equal(p.count, 3);
      await commit(p.previewId, "range");
      assert.equal((await day("2090-02-03")).isHoliday, true);
      assert.equal(
        (
          await calendar.list(admin, {
            dateStart: "2090-02-01",
            dateEnd: "2090-02-28",
          })
        ).total,
        3,
      );
    },
  );
  await t.test(
    "CA14 range collision aborts all dates; no partial overwrite or lost reason",
    async () => {
      await assert.rejects(
        () =>
          preview({
            action: "range",
            dateStart: "2090-01-31",
            dateEnd: "2090-02-02",
            description: "Bentrok",
            isHoliday: false,
            reason,
          }),
        /VERSION_CONFLICT/,
      );
      assert.equal((await day("2090-01-31")).calendarEntry, null);
      assert.equal((await day("2090-02-01")).isHoliday, true);
    },
  );
  await t.test(
    "CA15 impossible/inverted/oversized ranges and historical writes rejected",
    async () => {
      for (const data of [
        { ...input("2090-02-30") },
        {
          action: "range",
          dateStart: "2090-03-02",
          dateEnd: "2090-03-01",
          description: "X",
          isHoliday: true,
          reason,
        },
        {
          action: "range",
          dateStart: "2090-01-01",
          dateEnd: "2092-01-01",
          description: "X",
          isHoliday: true,
          reason,
        },
      ])
        await assert.rejects(() => preview(data));
      await assert.rejects(() => preview(input("2000-01-01")), /CALENDAR_PAST/);
      await assert.rejects(
        () =>
          calendar.preview(admin, "context", {
            action: "override",
            date: "2000-01-01",
            version: "0",
            academicPeriodId: period.id,
            kbmEnabled: true,
            examEnabled: false,
            reason,
          }),
        /CALENDAR_PAST/,
      );
    },
  );
  await t.test(
    "CA16 Sunday does not create activity or credit; explicit dated override only changes requested mode",
    async () => {
      const d = await day(sunday);
      assert.equal(d.kbmEnabled, false);
      assert.ok(d.reasons.includes("SUNDAY_DEFAULT_OFF"));
      const p = await calendar.preview(admin, "context", {
        action: "override",
        date: sunday,
        version: d.overrideVersion,
        academicPeriodId: period.id,
        kbmEnabled: true,
        examEnabled: true,
        reason,
      });
      assert.equal(p.days[0]!.after.kbmEnabled, true);
      await calendar.commit(
        admin,
        "context",
        { previewId: p.previewId },
        "context",
      );
      const after = await day(sunday);
      assert.equal(after.kbmEnabled, true);
      assert.equal(after.examEnabled, true);
      assert.deepEqual(after.activeExamPeriods, []);
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from ops.audit_logs where action like '%credit%'",
          )
        ).rows[0]?.n,
        0,
      );
    },
  );
  await t.test(
    "CA17 holiday takes precedence over requested mode; clearing override reverts Sunday policy",
    async () => {
      const p = await preview(
        input(sunday, true, (await day(sunday)).calendarVersion),
      );
      await commit(p.previewId);
      assert.equal((await day(sunday)).examEnabled, false);
      const remove = await preview({
        action: "delete",
        date: sunday,
        version: (await day(sunday)).calendarVersion,
        reason,
      });
      await commit(remove.previewId, "delete");
      const clear = await calendar.preview(admin, "context", {
        action: "clear",
        date: sunday,
        version: (await day(sunday)).overrideVersion,
        reason,
      });
      assert.equal(clear.days[0]!.after.kbmEnabled, false);
      await calendar.commit(
        admin,
        "context",
        { previewId: clear.previewId },
        "context",
      );
      assert.equal((await day(sunday)).override, null);
      assert.equal(
        (await calendar.history(admin, "day-context", sunday)).length,
        2,
      );
    },
  );
  await t.test(
    "CA18 explicit context requires existing nonarchived semester containing the exact date",
    async () => {
      for (const academicPeriodId of [randomUUID(), period.id])
        await assert.rejects(
          () =>
            calendar.preview(admin, "context", {
              action: "override",
              date: "2091-01-01",
              version: "0",
              academicPeriodId,
              kbmEnabled: true,
              examEnabled: false,
              reason,
            }),
          /CALENDAR_INVALID/,
        );
    },
  );
  await t.test(
    "CA19 parent range/archival cannot invalidate live dated override",
    async () => {
      const p = await calendar.preview(admin, "context", {
        action: "override",
        date: "2090-12-31",
        version: "0",
        academicPeriodId: period.id,
        kbmEnabled: true,
        examEnabled: false,
        reason,
      });
      await calendar.commit(
        admin,
        "context",
        { previewId: p.previewId },
        "context",
      );
      await assert.rejects(
        () =>
          masters.save(admin, "academic-periods", {
            id: period.id,
            version: period.version,
            reason,
            data: {
              academicYearId: year.id,
              semester: 1,
              dateStart: "2090-01-01",
              dateEnd: "2090-12-30",
              isActive: true,
            },
          }),
        /MASTER_REFERENCED/,
      );
    },
  );
  await t.test(
    "CA20 dataset search/filter and stable paging; nonholiday does not match holiday filter",
    async () => {
      const a = await calendar.list(admin, {
          dateStart: "2090-01-01",
          dateEnd: "2090-12-31",
          pageSize: 1,
        }),
        b = await calendar.list(admin, {
          dateStart: "2090-01-01",
          dateEnd: "2090-12-31",
          pageSize: 1,
          page: 2,
        });
      assert.notEqual(a.items[0]?.date, b.items[0]?.date);
      assert.equal(
        (
          await calendar.list(admin, {
            dateStart: "2090-01-01",
            dateEnd: "2090-12-31",
            holiday: "true",
          })
        ).total,
        3,
      );
      assert.equal(
        (
          await calendar.list(admin, {
            dateStart: "2090-01-01",
            dateEnd: "2090-12-31",
            q: "%",
          })
        ).total,
        0,
      );
    },
  );
  await t.test(
    "CA21 context version changes with relevant calendar or semester revisions, no stale cache",
    async () => {
      const before = await day(weekday);
      const p = await preview(input(weekday, false, before.calendarVersion));
      await commit(p.previewId);
      const after = await calendar.context(guru, { date: weekday });
      assert.notEqual(before.contextVersion, after.contextVersion);
      assert.equal(after.academicPeriodId, period.id);
    },
  );
  await t.test(
    "CA22 unintegrated installed finance module fails closed for resolver and mutation",
    async () => {
      await db.exec("alter table finance.honor_periods rename to honor_periods_installed; create table finance.honor_periods(id uuid)");
      await assert.rejects(
        () => day(weekday),
        /CONTEXT_DEPENDENCY_UNAVAILABLE/,
      );
      await assert.rejects(
        () => preview(input("2090-04-01")),
        /CONTEXT_DEPENDENCY_UNAVAILABLE/,
      );
      await db.exec("drop table finance.honor_periods; alter table finance.honor_periods_installed rename to honor_periods");
    },
  );
  await t.test(
    "CA23 least privilege and full audits exclude hashes or session proof",
    async () => {
      await assert.rejects(() =>
        business.query("select * from ops.calendar_previews"),
      );
      await assert.rejects(() =>
        business.query("select app.day_context_internal($1)", [weekday]),
      );
      for (const role of [
        "sim_guru_auth",
        "sim_guru_worker",
        "sim_guru_bootstrap",
      ])
        assert.equal(
          (
            await db.query<{ allowed: boolean }>(
              "select has_function_privilege($1,'app.calendar_commit(text,uuid,text,text)','execute') as allowed",
              [role],
            )
          ).rows[0]!.allowed,
          false,
        );
      const raw = JSON.stringify(
        await calendar.history(admin, "calendar", weekday),
      );
      assert.equal(raw.includes(hash), false);
      assert.equal(raw.includes(tokenHash(admin)), false);
      assert.ok(raw.includes(reason));
    },
  );
  await t.test(
    "CA24 HTTP preview/commit returns no-store and maps expired/stale safely",
    async () => {
      const p = await handler(
        "calendar-preview",
        req(admin, "POST", input("2090-05-01")),
      );
      assert.equal(p.status, 200);
      const data = (await p.json()).data;
      const r = await handler(
        "calendar",
        req(admin, "POST", { previewId: data.previewId }),
      );
      assert.equal(r.status, 200);
      assert.equal(r.headers.get("cache-control"), "no-store");
      const replay = await handler(
        "calendar",
        req(admin, "POST", { previewId: data.previewId }),
      );
      assert.equal(replay.status, 409);
      assert.equal(
        (await replay.text()).includes("ops.calendar_previews"),
        false,
      );
    },
  );
  await t.test(
    "CA25 revoked session cannot read context or commit despite owning prior preview",
    async () => {
      const p = await preview(input("2090-06-01"));
      await authDb.query("select auth_private.revoke_session($1)", [
        tokenHash(admin),
      ]);
      await assert.rejects(() => commit(p.previewId));
      assert.equal(
        (
          await handler(
            "self-context",
            req(admin, "GET", undefined, "/api/day-context?date=" + weekday),
          )
        ).status,
        401,
      );
    },
  );
});
