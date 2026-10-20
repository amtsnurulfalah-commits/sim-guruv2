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
import { LocalAuthService } from "../../src/server/auth/service";
import { MasterService } from "../../src/server/masters/service";
import { ScheduleService } from "../../src/server/schedules/service";
import { CalendarService } from "../../src/server/calendar/service";
import { FinanceService } from "../../src/server/finance/service";
import { ProgramService } from "../../src/server/programs/service";
import { ActivityService } from "../../src/server/activities/service";
import { AccountLifecycleService } from "../../src/server/accounts/lifecycle";
import { createFinanceHandler } from "../../src/server/finance/http";
import { issueCsrf } from "../../src/server/auth/security";
import type {
  HonorBundle,
  HonorStatement,
  FinancePreview,
  Operations,
} from "../../src/lib/finance/schemas";
const password = "H9!vL4#qT8@bP2$wF7&z",
  reason = "Verifikasi honorarium sintetis";
test("Tahap 6 — holiday, transport, canonical honor and immutable final", async (t) => {
  const db = await openPgliteDatabase();
  t.after(() => db.close());
  const migrations = await readMigrations("supabase/migrations");
  await applyMigrations(
    db,
    migrations.filter((m) => m.name < "20261020055614"),
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
    business = scope("sim_guru_business"),
    passwords = await getPasswordService(),
    hash = await passwords.hashNew(password, {
      username: "operator",
      fullName: "Operator",
    });
  async function fixture(username: string, role: string, ready = true) {
    const id = (
      await db.query<{ id: string }>(
        "insert into app.app_users(username,full_name,role,status,must_change_password,contact_email,email_verified_at,km_distance) values($1,$1,$2,'active',$3,$4,case when $5 then clock_timestamp() end,10) returning id",
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
  const adminId = await fixture("operator", "admin"),
    guruId = await fixture("teacher.one", "guru"),
    otherId = await fixture("teacher.two", "guru");
  await fixture("onboard", "guru", false);
  await t.test(
    "F01 upgrade preserves users, idempotent migration and all69 tables FORCE RLS",
    async () => {
      assert.deepEqual(
        await applyMigrations(db, migrations),
        migrations.filter((m) => m.name >= "20261020055614").map((m) => m.name),
      );
      assert.equal((await applyMigrations(db, migrations)).length, 0);
      assert.equal(
        (
          await db.query(
            "select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('app','auth_private','ops','finance') and c.relkind='r' and (not relrowsecurity or not relforcerowsecurity)",
          )
        ).rows.length,
        0,
      );
      await assert.rejects(() =>
        business.query("select * from finance.honor_statements"),
      );
      await assert.rejects(() =>
        business.query("select finance.bundle(date '2090-01-01','realized')"),
      );
    },
  );
  async function clock(day: string) {
    await db.exec(
      `create or replace function app.activity_today() returns date language sql stable set search_path=pg_catalog as $$ select date '${day}' $$; create or replace function finance.today() returns date language sql stable set search_path=pg_catalog as $$ select date '${day}' $$`,
    );
  }
  await clock("2090-01-02");
  const auth = new LocalAuthService(
    authDb,
    passwords,
    randomBytes(40).toString("hex"),
  );
  const login = async (username: string) =>
    (await auth.login({ username, password }, randomUUID(), randomUUID()))
      .token;
  const admin = await login("operator"),
    guru = await login("teacher.one"),
    other = await login("teacher.two"),
    onboard = await login("onboard");
  const masters = new MasterService(business),
    schedules = new ScheduleService(business),
    calendar = new CalendarService(business),
    finance = new FinanceService(business),
    activities = new ActivityService(business);
  await db.query(
    "update app.app_users set additional_role='KEPALA_SEKOLAH' where id=$1",
    [adminId],
  );
  await masters.save(admin, "school", {
    version: "0",
    reason,
    data: {
      name: "Madrasah Uji",
      address: "Alamat sekolah",
      npsn: "",
      level: "SMP",
      useParallel: false,
      parallelMax: 1,
      minutesPerJtm: 40,
      headmasterId: adminId,
    },
  });
  const year = await masters.save(admin, "academic-years", {
    version: "0",
    reason,
    data: {
      label: "2090/2091",
      dateStart: "2090-01-01",
      dateEnd: "2091-12-31",
    },
  });
  const academic = await masters.save(admin, "academic-periods", {
    version: "0",
    reason,
    data: {
      academicYearId: year.id,
      semester: 1,
      dateStart: "2090-01-01",
      dateEnd: "2090-06-30",
      isActive: true,
    },
  });
  const klass = await masters.save(admin, "classes", {
    version: "0",
    reason,
    data: {
      academicPeriodId: academic.id,
      name: "Kelas 7",
      level: "SMP",
      grade: 7,
      parallel: "",
      expectedStudents: 30,
    },
  });
  const subject = await masters.save(admin, "subjects", {
    version: "0",
    reason,
    data: { name: "IPA" },
  });
  for (const [kind, amount] of [
    ["jtm", "10001"],
    ["transport", "1000"],
  ])
    await masters.save(admin, "rates", {
      version: "0",
      reason,
      data: {
        kind,
        amount: amount!,
        enabled: true,
        dateStart: "2090-01-01",
        dateEnd: "2090-12-31",
      },
    });
  await masters.save(admin, "allowances", {
    version: "0",
    reason,
    data: {
      userId: guruId,
      dutyName: "Wali kelas",
      amount: "50000",
      dateStart: "2090-01-01",
      dateEnd: "2090-12-31",
    },
  });
  const estimate = (token = admin, mode = "realized", period = "2090-01") =>
    finance.read<HonorBundle>(token, {
      kind: token === admin ? "recap" : "estimate",
      period,
      mode,
    });
  const own = (b: HonorBundle, id = guruId) =>
    b.statements.find((s) => s.recipient.id === id)!;
  const preview = (data: unknown) =>
    finance.command<FinancePreview>(admin, "preview", data);
  const commit = (p: FinancePreview) =>
    finance.command<Record<string, unknown>>(admin, "commit", {
      previewId: p.previewId,
    });
  await t.test(
    "F02 roles, onboarding, strict payload and period shape are enforced",
    async () => {
      await assert.rejects(() => estimate(onboard));
      await assert.rejects(() =>
        finance.read(guru, {
          kind: "recap",
          period: "2090-01",
          mode: "realized",
        }),
      );
      await assert.rejects(() =>
        finance.command(guru, "preview", {
          operation: "finalize",
          period: "2090-01",
          reason,
        }),
      );
      await assert.rejects(() =>
        finance.read(guru, {
          kind: "estimate",
          period: "2090-13",
          mode: "realized",
        }),
      );
      await assert.rejects(() =>
        finance.command(admin, "preview", {
          operation: "finalize",
          period: "2090-01",
          reason,
          actor: adminId,
        }),
      );
      assert.equal((await estimate(guru)).statements.length, 1);
      assert.equal(own(await estimate(guru)).recipient.id, guruId);
    },
  );
  await t.test(
    "F03 transport exact 333.34/666.67 boundaries and no per-day rounding",
    async () => {
      for (const [raw, wanted] of [
        ["10333.33", "10000"],
        ["10333.34", "10500"],
        ["10666.66", "10500"],
        ["10666.67", "11000"],
      ])
        assert.equal(
          (
            await db.query<{ v: string }>(
              "select finance.transport_round($1::numeric)::text v",
              [raw!],
            )
          ).rows[0]!.v,
          wanted,
        );
      assert.equal(
        (
          await db.query<{ v: string }>(
            "select finance.transport_round(166.67::numeric+166.67)::text v",
          )
        ).rows[0]!.v,
        "500",
      );
    },
  );
  await t.test(
    "F03b exact monthly rational boundary: 1000/3 + .02/3 settles to500, not0",
    async () => {
      const fractional = (rate: string) => ({
        distance: "0.01",
        rate,
        effectiveMicroseconds: "60000000",
        scheduledMicroseconds: "180000000",
        blocked: false,
      });
      for (const [sum, expected] of [
        ["100002", "500"],
        ["100001", "0"],
        ["200001", "1000"],
        ["200000", "500"],
      ]) {
        const rows = [fractional(String(Number(sum) - 2)), fractional("2")];
        const r = (
          await db.query<{ value: { raw: string; settled: string } }>(
            "select finance.transport_settlement($1::jsonb) value",
            [JSON.stringify(rows)],
          )
        ).rows[0]!.value;
        assert.equal(r.settled, expected);
      }
      const empty = (
        await db.query<{ value: { raw: string; settled: string } }>(
          "select finance.transport_settlement('[]'::jsonb) value",
        )
      ).rows[0]!.value;
      assert.equal(Number(empty.raw), 0);
      assert.equal(empty.settled, "0");
    },
  );
  // Production APIs create schedules; calendar is also preview/commit through its own domain.
  const scheduleData = (timeStart: string, scheduledJtm: string) => ({
    academicPeriodId: academic.id,
    userId: guruId,
    subjectId: subject.id,
    classId: klass.id,
    dayIndex: 1,
    timeStart,
    scheduledJtm,
    restMinutes: 0,
    validFrom: "2090-01-01",
    validTo: "2090-01-31",
  });
  const schedule1 = await schedules.save(admin, undefined, {
    reason,
    data: scheduleData("07:30", "2"),
  });
  await schedules.save(admin, undefined, {
    reason,
    data: scheduleData("09:30", "3"),
  });
  const hp = await calendar.preview(admin, "calendar", {
    action: "upsert",
    date: "2090-01-02",
    version: "0",
    description: "Libur uji",
    isHoliday: true,
    reason,
  });
  await calendar.commit(
    admin,
    "calendar",
    { previewId: hp.previewId },
    "upsert",
  );
  await t.test(
    "F04 two holiday schedules sum 2+3; projection never duplicates realized",
    async () => {
      const real = own(await estimate()),
        projected = own(await estimate(admin, "projection"));
      assert.equal(Number(real.totalJtm), 0);
      assert.equal(Number(projected.totalJtm), 5);
      assert.equal(projected.pendingHolidays.length, 2);
      assert.ok((await estimate()).issues.includes("HOLIDAY_PENDING"));
    },
  );
  let runId = "";
  await clock("2090-01-03");
  await t.test(
    "F05 holiday generate is idempotent by occurrence and run effects",
    async () => {
      const result = await finance.command<{ runId: string; count: number }>(
        admin,
        "holiday",
        { operation: "generate", date: "2090-01-02", reason },
      );
      runId = result.runId;
      assert.equal(result.count, 2);
      const again = await finance.command<{ count: number }>(admin, "holiday", {
        operation: "generate",
        date: "2090-01-02",
        reason,
      });
      assert.equal(again.count, 0);
      assert.equal(Number(own(await estimate()).totalJtm), 5);
      assert.equal(
        Number(own(await estimate(admin, "projection")).totalJtm),
        5,
      );
      assert.equal(
        (await db.query("select * from finance.holiday_runs")).rows.length,
        1,
      );
    },
  );
  await t.test(
    "F06 cancel preview reverses only selected run; pending remains visible then regenerate",
    async () => {
      const p = await preview({
        operation: "holiday-cancel",
        date: "2090-01-02",
        runId,
        reason,
      });
      await commit(p);
      assert.equal(Number(own(await estimate()).totalJtm), 0);
      assert.equal(
        Number(own(await estimate(admin, "projection")).totalJtm),
        5,
      );
      assert.ok((await estimate()).issues.includes("HOLIDAY_PENDING"));
      await finance.command(admin, "holiday", {
        operation: "generate",
        date: "2090-01-02",
        reason,
      });
      assert.equal(Number(own(await estimate()).totalJtm), 5);
      assert.equal(
        (await db.query("select * from finance.holiday_runs")).rows.length,
        2,
      );
    },
  );
  await t.test(
    "F07 durable transport uses actual minutes, clipped leave, caps ratio, no event-only pay",
    async () => {
      await db.query(
        "insert into app.daily_attendance(user_id,date,sched_time_in,sched_time_out,actual_time_in,actual_time_out,time_in_source,time_in_recorded_by) values($1,'2090-01-03','07:30','14:30','07:30','11:30','admin',$2)",
        [guruId, adminId],
      );
      const aid = (
        await db.query<{ id: string }>(
          "select id from app.daily_attendance where user_id=$1 and date='2090-01-03'",
          [guruId],
        )
      ).rows[0]!.id;
      await db.query(
        "insert into app.attendance_leaves(attendance_id,leave_time,return_time,reason,created_by) values($1,'11:00','12:00',$2,$3)",
        [aid, reason, adminId],
      );
      const s = own(await estimate());
      assert.equal(Number(s.transportRaw), 5000);
      assert.equal(Number(s.transportSettled), 5000);
      assert.equal(
        s.lines.find((l) => l.component === "TRANSPORT")!.ratio,
        "0.500",
      );
      assert.equal(Number(own(await estimate(), otherId).transportRaw), 0);
    },
  );
  await t.test(
    "F08 missing ordinary schedule is zero; explicit extra attendee uses actual denominator",
    async () => {
      await db.query(
        "insert into app.daily_attendance(user_id,date,actual_time_in,actual_time_out,time_in_source) values($1,'2090-01-03','07:30','09:30','admin')",
        [otherId],
      );
      assert.equal(Number(own(await estimate(), otherId).transportRaw), 0);
      await db.query(
        "update app.daily_attendance set extra_attendee=true,extra_reason=$2 where user_id=$1",
        [otherId, reason],
      );
      assert.equal(Number(own(await estimate(), otherId).transportRaw), 10000);
    },
  );
  let blockId = "";
  await t.test(
    "F09 transport block inclusive global scope and stale removal version",
    async () => {
      const b = await finance.command<{ id: string }>(admin, "block", {
        userId: null,
        from: "2090-01-03",
        to: "2090-01-03",
        reason,
      });
      blockId = b.id;
      assert.equal(Number(own(await estimate()).transportRaw), 0);
      await assert.rejects(() =>
        finance.command(admin, "block", { id: blockId, version: "9", reason }),
      );
      await finance.command(admin, "block", {
        id: blockId,
        version: "1",
        reason,
      });
      assert.equal(Number(own(await estimate()).transportRaw), 5000);
    },
  );
  await t.test(
    "F09b event H-1 3×0.8=2.4 flows into the same monthly engine",
    async () => {
      const programs = new ProgramService(business);
      const e = (await programs.saveEvent(admin, {
        version: "0",
        reason,
        data: {
          name: "Rapat golden",
          type: "insidental",
          days: [],
          dates: ["2090-01-03"],
          dateStart: "2090-01-03",
          dateEnd: "2090-01-03",
          timeStart: "10:00",
          timeEnd: "11:00",
          jtm: 3,
          description: "Rapat uji",
        },
      })) as { id: string };
      const a = (await programs.attendance(admin, {
        operation: "attend",
        eventId: e.id,
        date: "2090-01-03",
        userId: guruId,
        timeIn: "10:15",
        reason,
      })) as { id: string };
      await clock("2090-01-04");
      await db.exec(
        "insert into app.system_settings(key,typed_value) values('allow_h_minus_1_journal','true') on conflict(key) do update set typed_value='true'",
      );
      await programs.journal(guru, {
        attendanceId: a.id,
        version: "1",
        description: "Catatan rapat kemarin",
      });
      const s = own(await estimate());
      assert.equal(Number(s.totalJtm), 7.4);
      assert.equal(Number(s.teachingRaw), 74007.4);
      assert.equal(Number(s.teachingSettled), 74007);
    },
  );
  await t.test(
    "F09c exception is previewed, audited and never silently included in projection",
    async () => {
      const cp = await calendar.preview(admin, "calendar", {
        action: "upsert",
        date: "2090-01-09",
        version: "0",
        description: "Libur dikecualikan",
        isHoliday: true,
        reason,
      });
      await calendar.commit(
        admin,
        "calendar",
        { previewId: cp.previewId },
        "upsert",
      );
      await clock("2090-01-10");
      assert.equal(
        Number(own(await estimate(admin, "projection")).totalJtm),
        12.4,
      );
      const p = await preview({
        operation: "holiday-waive",
        date: "2090-01-09",
        reason,
      });
      assert.ok("count" in p.result);
      assert.equal(p.result.count, 2);
      await assert.rejects(() =>
        finance.command(guru, "commit", { previewId: p.previewId }),
      );
      await assert.rejects(() =>
        finance.command(admin, "holiday", {
          operation: "waive",
          date: "2090-01-09",
          reason,
        }),
      );
      await commit(p);
      assert.equal(
        Number(own(await estimate(admin, "projection")).totalJtm),
        7.4,
      );
    },
  );
  await t.test(
    "F10 current month finalization is blocked atomically",
    async () => {
      const p = await preview({
        operation: "finalize",
        period: "2090-01",
        reason,
      });
      assert.ok(
        "issues" in p.result && p.result.issues.includes("PERIOD_NOT_ENDED"),
      );
      await assert.rejects(() => commit(p), /FINANCE_BLOCKED/);
      assert.equal(
        (await db.query("select * from finance.honor_statements")).rows.length,
        0,
      );
    },
  );
  await clock("2090-02-01");
  let finalPreview: FinancePreview;
  await t.test(
    "F11 stale preview detects source changes and actor ownership",
    async () => {
      const p = await preview({
        operation: "finalize",
        period: "2090-01",
        reason,
      });
      await db.query(
        "update app.daily_attendance set actual_time_out='12:30',version=version+1 where user_id=$1 and date='2090-01-03'",
        [guruId],
      );
      await assert.rejects(() => commit(p), /PREVIEW_STALE/);
      await assert.rejects(() =>
        finance.command(guru, "commit", { previewId: p.previewId }),
      );
      finalPreview = await preview({
        operation: "finalize",
        period: "2090-01",
        reason,
      });
      assert.ok("issues" in finalPreview.result);
      assert.deepEqual(finalPreview.result.issues, []);
    },
  );
  await t.test(
    "F11b failure on the second slip rolls back every slip, period and outbox row",
    async () => {
      await db.exec(
        "create function finance.test_atomic_failure() returns trigger language plpgsql as $$ begin if exists(select 1 from finance.honor_statements) then raise exception 'SYNTHETIC_SECOND_SLIP_FAILURE';end if;return new;end $$; create trigger test_atomic_failure before insert on finance.honor_statements for each row execute function finance.test_atomic_failure()",
      );
      try {
        await assert.rejects(
          () => commit(finalPreview),
          /SYNTHETIC_SECOND_SLIP_FAILURE/,
        );
        assert.equal(
          (await db.query("select * from finance.honor_statements")).rows
            .length,
          0,
        );
        assert.equal(
          (await db.query("select * from finance.notification_outbox")).rows
            .length,
          0,
        );
        assert.equal(
          (
            await db.query(
              "select * from finance.period_guards where finalized_at is not null",
            )
          ).rows.length,
          0,
        );
      } finally {
        await db.exec(
          "drop trigger test_atomic_failure on finance.honor_statements; drop function finance.test_atomic_failure()",
        );
      }
    },
  );
  let statement: HonorStatement;
  await t.test(
    "F12 finalize all recipients including zero; recap equals immutable slip and idempotent replay",
    async () => {
      const before = own(await estimate());
      const r = await commit(finalPreview);
      assert.equal(r.state, "final");
      assert.deepEqual(await commit(finalPreview), r);
      const rows = (
        await db.query<{ id: string; user_id: string }>(
          "select id,user_id from finance.honor_statements",
        )
      ).rows;
      assert.equal(rows.length, 3);
      statement = await finance.statement(
        guru,
        rows.find((r) => r.user_id === guruId)!.id,
      );
      assert.equal(statement.snapshot.total, before.total);
      assert.equal(statement.snapshot.totalJtm, before.totalJtm);
      assert.equal(statement.snapshot.mode, "final");
      assert.equal(Number(statement.snapshot.teachingSettled), 74007);
      assert.equal((await estimate()).mode, "final");
      assert.equal(
        (await db.query("select * from finance.notification_outbox")).rows
          .length,
        3,
      );
      await assert.rejects(
        () => finance.statement(other, statement.id),
        /NOT_FOUND/,
      );
    },
  );
  await t.test(
    "F13 final guard covers old journal/attendance, transport, ledger and immutable snapshots",
    async () => {
      await assert.rejects(() =>
        activities.command(admin, "attendance", {
          action: "time-out",
          userId: guruId,
          date: "2090-01-03",
          version: "2",
          time: "13:00",
          reason,
        }),
      );
      await assert.rejects(
        () =>
          finance.command(admin, "block", {
            userId: null,
            from: "2090-01-03",
            to: "2090-01-03",
            reason,
          }),
        /FINAL_PERIOD/,
      );
      await assert.rejects(
        () =>
          db.query(
            "update finance.honor_statements set total_honor=0 where id=$1",
            [statement.id],
          ),
        /FINAL_IMMUTABLE/,
      );
      await assert.rejects(
        () =>
          finance.command(admin, "holiday", {
            operation: "generate",
            date: "2090-01-02",
            reason,
          }),
        /FINAL_PERIOD/,
      );
      await assert.rejects(
        () =>
          db.exec(
            "update finance.honor_periods set state='open',finalized_at=null",
          ),
        /FINAL_IMMUTABLE/,
      );
      assert.equal(
        (await finance.statement(guru, statement.id)).checksum,
        statement.checksum,
      );
    },
  );
  await t.test(
    "F14 public verification masks identity, excludes money, hashes token only and marks corrections later",
    async () => {
      const r = await finance.command<{ token: string }>(guru, "token", {
        statementId: statement.id,
      });
      assert.equal(r.token.length, 96);
      const verified = await finance.verify({ token: r.token });
      assert.equal(verified.status, "valid");
      assert.equal(verified.recipient, "t***");
      assert.equal("total" in verified, false);
      assert.equal(
        (await finance.verify({ token: "a".repeat(96) })).status,
        "not_found",
      );
      assert.equal(
        (
          await db.query<{ h: string }>(
            "select token_hash h from finance.document_tokens",
          )
        ).rows[0]!.h.length,
        64,
      );
      await assert.rejects(() =>
        finance.command(other, "token", { statementId: statement.id }),
      );
    },
  );
  const correction = (jtm: string) => ({
    operation: "correction",
    statementId: statement.id,
    targetPeriod: "2090-02",
    correctedJtm: jtm,
    correctedAllowances: statement.snapshot.allowances,
    correctedTransportRaw: statement.snapshot.transportRaw,
    reason,
    evidence: "Referensi bukti verifikasi sintetis",
  });
  await t.test(
    "F15 correction uses previous corrected basis: +10001 then -2000, original immutable",
    async () => {
      const p = await preview(correction("8.4"));
      assert.ok("delta" in p.result);
      assert.equal(p.result.delta, "10001");
      await commit(p);
      await commit(p);
      const p2 = await preview(correction("8.2"));
      assert.ok("delta" in p2.result);
      assert.equal(p2.result.delta, "-2000");
      await commit(p2);
      const b = await estimate(admin, "realized", "2090-02");
      assert.equal(Number(own(b).corrections), 8001);
      assert.equal(
        (await finance.statement(guru, statement.id)).checksum,
        statement.checksum,
      );
      assert.equal(
        (await finance.statement(guru, statement.id)).corrected,
        true,
      );
    },
  );
  await t.test(
    "F16 competing correction previews reject stale sequence and final target",
    async () => {
      const p = await preview(correction("5.9")),
        p2 = await preview(correction("5.95"));
      await commit(p);
      await assert.rejects(() => commit(p2), /PREVIEW_STALE/);
      await assert.rejects(() =>
        preview({ ...correction("5.9"), targetPeriod: "2090-01" }),
      );
      await assert.rejects(() =>
        finance.command(guru, "preview", correction("9")),
      );
    },
  );
  await t.test(
    "F17 correction request scoped to own statement and history filters do not leak",
    async () => {
      await finance.command(guru, "request", {
        statementId: statement.id,
        reason,
      });
      await assert.rejects(() =>
        finance.command(other, "request", {
          statementId: statement.id,
          reason,
        }),
      );
      const all = await finance.exportHistory(admin, {
        kind: "history",
        period: "2090-01",
        page: 2,
        pageSize: 1,
      });
      assert.equal(all.length, 3);
      const mine = await finance.exportHistory(guru, { kind: "history" });
      assert.equal(mine.length, 1);
      const operations = await finance.read<Operations>(admin, {
        kind: "operations",
        period: "2090-01",
      });
      assert.equal(operations.requests.length, 1);
    },
  );
  await t.test(
    "F18 negative correction excess blocks target finalization, never negative payout",
    async () => {
      await commit(
        await preview({
          ...correction("0"),
          correctedAllowances: "0",
          correctedTransportRaw: "0",
        }),
      );
      await clock("2090-03-01");
      const p = await preview({
        operation: "finalize",
        period: "2090-02",
        reason,
      });
      assert.ok(
        "issues" in p.result &&
          p.result.issues.some((x) => x.startsWith("NEGATIVE_PAYABLE")),
      );
      await assert.rejects(() => commit(p), /FINANCE_BLOCKED/);
      assert.equal(
        (
          await db.query(
            "select * from finance.honor_periods where period_start='2090-02-01' and state='final'",
          )
        ).rows.length,
        0,
      );
    },
  );
  await t.test(
    "F19 zero entire month still creates final period and zero statements",
    async () => {
      await db.query("update app.app_users set km_distance=0");
      await clock("2091-02-01");
      const p = await preview({
        operation: "finalize",
        period: "2091-01",
        reason,
      });
      assert.ok(
        "issues" in p.result && p.result.issues.includes("RATE_MISSING"),
      );
      await masters.save(admin, "rates", {
        version: "0",
        reason,
        data: {
          kind: "jtm",
          amount: "0",
          enabled: true,
          dateStart: "2091-01-01",
          dateEnd: "2091-12-31",
        },
      });
      await commit(
        await preview({ operation: "finalize", period: "2091-01", reason }),
      );
      const b = await estimate(admin, "realized", "2091-01");
      assert.equal(b.mode, "final");
      assert.ok(b.statements.every((s) => Number(s.total) === 0));
      await assert.rejects(
        () => preview({ operation: "finalize", period: "2091-01", reason }),
        /FINAL_PERIOD/,
      );
    },
  );
  await t.test(
    "F20 real HTTP guards, no-store, PDF ownership and persistent verify rate limit",
    async () => {
      const sessionSecret = randomBytes(40).toString("hex"),
        config = {
          appUrl: "https://sim.example.test",
          sessionSecret,
          production: true,
          vercel: true,
        },
        handler = createFinanceHandler({
          config: () => config,
          auth: async () => auth,
          service: async () => finance,
          rate: async () =>
            new AccountLifecycleService(authDb, passwords, {
              hmac: "H".repeat(40),
              encryptionKey: randomBytes(32).toString("base64"),
              appUrl: config.appUrl,
            }),
        });
      const req = (path: string, token?: string, data?: unknown, csrf = true) =>
        new Request(config.appUrl + "/api/honorarium/" + path, {
          method: data ? "POST" : "GET",
          headers: {
            origin: config.appUrl,
            "x-vercel-forwarded-for": "192.0.2.10",
            ...(token ? { cookie: "__Host-sim_guru_session=" + token } : {}),
            ...(data
              ? {
                  "Content-Type": "application/json",
                  ...(csrf
                    ? {
                        "X-CSRF-Token": issueCsrf(
                          sessionSecret,
                          "session",
                          token ?? "",
                        ),
                      }
                    : {}),
                }
              : {}),
          },
          ...(data ? { body: JSON.stringify(data) } : {}),
        });
      let r = await handler("read", req("read?kind=estimate&period=2090-01"));
      assert.equal(r.status, 401);
      r = await handler(
        "preview",
        req(
          "preview",
          admin,
          { operation: "finalize", period: "2090-01", reason },
          false,
        ),
      );
      assert.equal(r.status, 403);
      r = await handler("pdf", req("pdf?id=" + statement.id, guru));
      assert.equal(r.status, 200);
      assert.equal(r.headers.get("Cache-Control"), "no-store");
      assert.equal(
        Buffer.from(await r.arrayBuffer())
          .subarray(0, 4)
          .toString(),
        "%PDF",
      );
      r = await handler("pdf", req("pdf?id=" + statement.id, other));
      assert.equal(r.status, 404);
      r = await handler("pdf", req("pdf", guru, { statementId: statement.id }));
      assert.equal(r.status, 200);
      assert.equal(
        Buffer.from(await r.arrayBuffer())
          .subarray(0, 4)
          .toString(),
        "%PDF",
      );
      r = await handler("excel", req("excel?period=2090-01", guru));
      assert.equal(r.status, 200);
      assert.equal(
        Buffer.from(await r.arrayBuffer()).readUInt32LE(0),
        0x04034b50,
      );
      for (let i = 0; i < 30; i++) {
        r = await handler(
          "verify",
          req("verify", undefined, { token: "b".repeat(96) }),
        );
        assert.equal(r.status, 200);
      }
      r = await handler(
        "verify",
        req("verify", undefined, { token: "b".repeat(96) }),
      );
      assert.equal(r.status, 429);
    },
  );
  void schedule1;
});
