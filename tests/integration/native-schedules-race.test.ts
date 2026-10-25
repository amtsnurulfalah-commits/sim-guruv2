import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import { resolve } from "node:path";
import { openNativeDatabase } from "../../scripts/lib/native-database";
import { readMigrations, applyMigrations } from "../../scripts/lib/migrations";
import type {
  SqlDatabase,
  SqlExecutor,
  SqlParameter,
} from "../../scripts/lib/sql-database";
import { getPasswordService } from "../../src/server/auth/passwords";
import { MasterService } from "../../src/server/masters/service";
import { DutyService } from "../../src/server/duties/service";
import { ScheduleService } from "../../src/server/schedules/service";
test("Native PostgreSQL — independent business connections serialize colliding schedules", async (t) => {
  const connection = process.env.SIM_GURU_SCHEDULE_TEST_DATABASE_URL;
  if (!connection) throw Error("SIM_GURU_SCHEDULE_TEST_DATABASE_URL_REQUIRED");
  const url = new URL(connection);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    !url.pathname.endsWith("_test")
  )
    throw Error("DISPOSABLE_LOCAL_TEST_DATABASE_REQUIRED");
  const db = openNativeDatabase(connection);
  t.after(() => db.close());
  assert.equal(
    (
      await db.query<{ exists: boolean }>(
        "select to_regclass('app.app_users') is not null as exists",
      )
    ).rows[0]!.exists,
    false,
  );
  await applyMigrations(
    db,
    await readMigrations(resolve("supabase/migrations")),
  );
  const passwords = await getPasswordService(),
    hash = await passwords.hashNew("H9!vL4#qT8@bP2$wF7&z", {
      username: "race.operator",
      fullName: "Race Operator",
    });
  async function fixture(username: string, role: string) {
    const id = (
      await db.query<{ id: string }>(
        "insert into app.app_users(username,full_name,role,status,must_change_password,contact_email,email_verified_at) values($1,$1,$2,'active',false,$3,clock_timestamp()) returning id",
        [username, role, username + "@example.test"],
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
    return id;
  }
  const adminA = await fixture("race.operator.a", "admin"),
    adminB = await fixture("race.operator.b", "admin"),
    guruA = await fixture("race.guru.a", "guru"),
    guruB = await fixture("race.guru.b", "guru");
  async function session(id: string) {
    const token = randomBytes(32).toString("base64url");
    await db.query(
      "select auth_private.issue_session($1,$2,1,1,$3,'business')",
      [id, hash, createHash("sha256").update(token).digest("hex")],
    );
    return token;
  }
  const tokenA = await session(adminA),
    tokenB = await session(adminB);
  function business(raw: SqlDatabase): SqlDatabase {
    return {
      transaction: async <T>(work: (tx: SqlExecutor) => Promise<T>) =>
        raw.transaction(async (tx) => {
          await tx.exec(
            "SET LOCAL ROLE sim_guru_business; SET LOCAL lock_timeout='10s'; SET LOCAL statement_timeout='15s'",
          );
          return work(tx);
        }),
      query<T extends Record<string, unknown>>(
        sql: string,
        args: readonly SqlParameter[] = [],
      ) {
        return this.transaction((tx) => tx.query<T>(sql, args));
      },
      exec(sql) {
        return this.transaction((tx) => tx.exec(sql));
      },
      close: () => raw.close(),
    };
  }
  const rawA = openNativeDatabase(connection),
    rawB = openNativeDatabase(connection);
  t.after(() => rawA.close());
  t.after(() => rawB.close());
  const a = business(rawA),
    b = business(rawB),
    masters = new MasterService(a),
    reason = "Native race fixture";
  await masters.save(tokenA, "school", {
    version: "0",
    reason,
    data: {
      name: "Native Race School",
      address: "",
      npsn: "",
      level: "SMP",
      useParallel: false,
      parallelMax: 1,
      minutesPerJtm: 40,
      headmasterId: "",
    },
  });
  const year = await masters.save(tokenA, "academic-years", {
      version: "0",
      reason,
      data: {
        label: "2090/2091",
        dateStart: "2090-01-01",
        dateEnd: "2091-12-31",
      },
    }),
    period = await masters.save(tokenA, "academic-periods", {
      version: "0",
      reason,
      data: {
        academicYearId: year.id,
        semester: 1,
        dateStart: "2090-01-01",
        dateEnd: "2090-06-30",
        isActive: true,
      },
    }),
    subject = await masters.save(tokenA, "subjects", {
      version: "0",
      reason,
      data: { name: "Native IPA" },
    });
  const classes: Awaited<ReturnType<typeof masters.save>>[] = [];
  for (const grade of [7, 8, 9])
    classes.push(
      await masters.save(tokenA, "classes", {
        version: "0",
        reason,
        data: {
          academicPeriodId: period.id,
          name: "Kelas " + grade,
          level: "SMP",
          grade,
          parallel: "",
          expectedStudents: 32,
        },
      }),
    );
  const serviceA = new ScheduleService(a),
    serviceB = new ScheduleService(b),
    data = {
      academicPeriodId: period.id,
      userId: guruA,
      subjectId: subject.id,
      classId: classes[0]!.id,
      dayIndex: 1,
      timeStart: "08:00",
      scheduledJtm: "1",
      restMinutes: 0,
      validFrom: "2090-01-01",
      validTo: "2090-06-30",
    };
  await t.test(
    "NR01 different admins/teachers competing for same class: exactly one commits",
    async () => {
      const results = await Promise.allSettled([
        serviceA.save(tokenA, undefined, { data, reason }),
        serviceB.save(tokenB, undefined, {
          data: { ...data, userId: guruB },
          reason,
        }),
      ]);
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(
        results.filter(
          (r) =>
            r.status === "rejected" &&
            r.reason.message === "SCHEDULE_COLLISION",
        ).length,
        1,
      );
      assert.equal(
        (
          await db.query<{ n: number }>(
            "select count(*)::int as n from app.teaching_schedules where time_start='08:00'",
          )
        ).rows[0]!.n,
        1,
      );
    },
  );
  await t.test(
    "NR02 different admins/classes competing for same teacher: exactly one commits",
    async () => {
      const results = await Promise.allSettled([
        serviceA.save(tokenA, undefined, {
          data: { ...data, timeStart: "10:00", classId: classes[1]!.id },
          reason,
        }),
        serviceB.save(tokenB, undefined, {
          data: { ...data, timeStart: "10:00", classId: classes[2]!.id },
          reason,
        }),
      ]);
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(
        results.filter(
          (r) =>
            r.status === "rejected" &&
            r.reason.message === "SCHEDULE_COLLISION",
        ).length,
        1,
      );
      assert.equal(
        (
          await db.query<{ n: number }>(
            "select count(*)::int as n from app.teaching_schedules where time_start='10:00'",
          )
        ).rows[0]!.n,
        1,
      );
    },
  );
  const dutyA = new DutyService(a),
    dutyB = new DutyService(b);
  const day = "2090-01-02";
  const dutyData = (userId: string) => ({
    kind: "PIKET",
    userId,
    academicPeriodId: period.id,
    dayIndex: 1,
    date: null,
    validFrom: day,
    validTo: day,
    timeStart: "07:00",
    timeEnd: "14:00",
    active: true,
    version: "0",
    reason,
  });
  await db.exec(
    "create or replace function app.activity_today() returns date language sql stable set search_path=pg_catalog as $$ select date '2090-01-02' $$",
  );
  await t.test(
    "NR03 two distinct piket assignments cannot acquire the same substitute concurrently",
    async () => {
      const first = await fixture("race.piket.first", "guru"),
        second = await fixture("race.piket.second", "guru"),
        target = await fixture("race.piket.target", "guru");
      await dutyA.schedule(tokenA, dutyData(first));
      await dutyA.schedule(tokenA, dutyData(second));
      const rows = (await dutyA.read(tokenA, { date: day })).occurrences;
      const x = rows.find(
          (o) => o.kind === "PIKET" && o.originalUserId === first,
        )!,
        y = rows.find(
          (o) => o.kind === "PIKET" && o.originalUserId === second,
        )!;
      const p = await dutyA.preview(tokenA, {
          occurrenceId: x.id,
          version: x.version,
          operation: "substitute",
          userId: target,
          reason,
        }),
        q = await dutyB.preview(tokenB, {
          occurrenceId: y.id,
          version: y.version,
          operation: "substitute",
          userId: target,
          reason,
        });
      const outcomes = await Promise.allSettled([
        dutyA.commit(tokenA, { previewId: p.previewId }),
        dutyB.commit(tokenB, { previewId: q.previewId }),
      ]);
      assert.equal(outcomes.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(
        outcomes.filter(
          (r) =>
            r.status === "rejected" && /DUTY_COLLISION/.test(r.reason.message),
        ).length,
        1,
      );
      assert.equal(
        (await dutyA.read(tokenA, { date: day })).occurrences.filter(
          (o) => o.kind === "PIKET" && o.userId === target,
        ).length,
        1,
      );
    },
  );
  await t.test(
    "NR04 a new weekly piket and a substitution cannot both claim one teacher",
    async () => {
      const owner = await fixture("race.piket.owner2", "guru"),
        target = await fixture("race.piket.target2", "guru");
      await dutyA.schedule(tokenA, dutyData(owner));
      const current = (
        await dutyA.read(tokenA, { date: day })
      ).occurrences.find(
        (o) => o.kind === "PIKET" && o.originalUserId === owner,
      )!;
      const preview = await dutyA.preview(tokenA, {
        occurrenceId: current.id,
        version: current.version,
        operation: "substitute",
        userId: target,
        reason,
      });
      const outcomes = await Promise.allSettled([
        dutyA.commit(tokenA, { previewId: preview.previewId }),
        dutyB.schedule(tokenB, dutyData(target)),
      ]);
      assert.equal(outcomes.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(
        outcomes.filter(
          (r) =>
            r.status === "rejected" && /DUTY_COLLISION/.test(r.reason.message),
        ).length,
        1,
      );
      const rows = (await dutyA.read(tokenA, { date: day })).occurrences.filter(
        (o) => o.kind === "PIKET" && o.userId === target,
      );
      assert.equal(rows.length, 1);
      const p = await dutyA.preview(tokenA, {
        occurrenceId: rows[0]!.id,
        version: rows[0]!.version,
        operation: "confirm",
        reason,
      });
      await dutyA.commit(tokenA, { previewId: p.previewId });
      assert.equal(
        (
          await db.query<{ total: string }>(
            "select coalesce(sum(jtm),0)::text total from finance.jtm_ledger where date=$1 and user_id=$2",
            [day, target],
          )
        ).rows[0]!.total,
        "4.0000",
      );
    },
  );

});
