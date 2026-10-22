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
import { MasterService } from "../../src/server/masters/service";
import { CalendarService } from "../../src/server/calendar/service";
import { ScheduleService } from "../../src/server/schedules/service";
import { createScheduleHandler } from "../../src/server/schedules/http";
import { AccountLifecycleService } from "../../src/server/accounts/lifecycle";
import { issueCsrf } from "../../src/server/auth/security";
import { wibDate } from "../../src/lib/calendar/schemas";
import type {
  ScheduleData,
  ScheduleRow,
} from "../../src/lib/schedules/schemas";
const password = "H9!vL4#qT8@bP2$wF7&z";
test("Tahap 2.4 — weekly teaching schedules and atomic resource conflicts", async (t) => {
  const db = await openPgliteDatabase();
  t.after(() => db.close());
  const migrations = await readMigrations(resolve("supabase/migrations"));
  await applyMigrations(db, migrations.slice(0, -1));
  const passwords = await getPasswordService(),
    hash = await passwords.hashNew(password, {
      username: "schedule.operator",
      fullName: "Schedule Operator",
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
  const adminId = await fixture("schedule.operator", "admin");
  await fixture("schedule.second", "admin");
  const guruAId = await fixture("schedule.guru.a", "guru"),
    guruBId = await fixture("schedule.guru.b", "guru"),
    inactive = await fixture("schedule.inactive", "guru");
  await db.query("update app.app_users set status='disabled' where id=$1", [
    inactive,
  ]);
  await fixture("schedule.onboard", "admin", false);
  await t.test(
    "SC01 incremental upgrade preserves identity and all65 RLS tables",
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
        65,
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
  const admin = await login("schedule.operator"),
    second = await login("schedule.second"),
    guruA = await login("schedule.guru.a"),
    guruB = await login("schedule.guru.b"),
    onboard = await login("schedule.onboard");
  const masters = new MasterService(business),
    calendar = new CalendarService(business),
    schedules = new ScheduleService(business),
    reason = "Pengaturan jadwal sintetis";
  const handler = createScheduleHandler({
    config: () => config,
    auth: async () => auth,
    schedules: async () => schedules,
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
    path = "/api/schedules",
    origin = config.appUrl,
  ) {
    return new Request(config.appUrl + path, {
      method,
      headers: {
        origin,
        "x-vercel-forwarded-for": "192.0.2.10",
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
  const schoolData = {
    name: "Sekolah Uji",
    address: "",
    npsn: "",
    level: "SMP",
    useParallel: false,
    parallelMax: 1,
    minutesPerJtm: 40,
    headmasterId: "",
  };
  let school = await masters.save(admin, "school", {
    version: "0",
    reason,
    data: schoolData,
  });
  const year = await masters.save(admin, "academic-years", {
      version: "0",
      reason,
      data: {
        label: "2090/2091",
        dateStart: "2090-01-01",
        dateEnd: "2091-12-31",
      },
    }),
    period = await masters.save(admin, "academic-periods", {
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
    period2 = await masters.save(admin, "academic-periods", {
      version: "0",
      reason,
      data: {
        academicYearId: year.id,
        semester: 2,
        dateStart: "2090-07-01",
        dateEnd: "2090-12-31",
        isActive: false,
      },
    });
  async function klass(periodId: string, grade: number) {
    return masters.save(admin, "classes", {
      version: "0",
      reason,
      data: {
        academicPeriodId: periodId,
        name: "Kelas " + grade,
        level: "SMP",
        grade,
        parallel: "",
        expectedStudents: 32,
      },
    });
  }
  const classA = await klass(period.id, 7),
    classB = await klass(period.id, 8),
    classC = await klass(period2.id, 7),
    subject = await masters.save(admin, "subjects", {
      version: "0",
      reason,
      data: { name: "IPA" },
    });
  const data = (change: Partial<ScheduleData> = {}): ScheduleData => ({
    academicPeriodId: period.id,
    userId: guruAId,
    subjectId: subject.id,
    classId: classA.id,
    dayIndex: 1,
    timeStart: "07:30",
    scheduledJtm: "1",
    restMinutes: 0,
    validFrom: "2090-01-01",
    validTo: "2090-01-31",
    ...change,
  });
  const create = async (v: ScheduleData) =>
    (await schedules.save(admin, undefined, { data: v, reason })).schedule;
  let first: ScheduleRow, adjacent: ScheduleRow, window2: ScheduleRow;
  await t.test(
    "SC02 anonymous/guru/onboarding cannot manage; SQL rechecks admin and business scope",
    async () => {
      for (const [token, status] of [
        [undefined, 401],
        [guruA, 403],
        [onboard, 403],
      ] as const)
        assert.equal((await handler("collection", req(token))).status, status);
      await assert.rejects(() =>
        schedules.save(guruA, undefined, { data: data(), reason }),
      );
      await assert.rejects(() => schedules.list(onboard, {}, true));
      assert.equal((await handler("mine", req(guruA))).status, 200);
    },
  );
  await t.test(
    "SC03 method/origin/CSRF and browser actor/role rejected",
    async () => {
      assert.equal(
        (
          await handler(
            "collection",
            req(admin, "POST", {}, undefined, "https://evil.example"),
          )
        ).status,
        403,
      );
      assert.equal(
        (await handler("collection", req(undefined, "POST", {}))).status,
        403,
      );
      assert.equal((await handler("conflicts", req(admin))).status, 405);
      assert.equal(
        (
          await handler(
            "collection",
            req(admin, "GET", undefined, "/api/schedules?role=admin"),
          )
        ).status,
        422,
      );
      await assert.rejects(() =>
        schedules.save(admin, undefined, {
          data: { ...data(), actorId: adminId },
          reason,
        }),
      );
    },
  );
  await t.test("SC03b invalid JTM returns 422 field feedback instead of INTERNAL_ERROR",async()=>{
    for(const action of ["collection","conflicts"] as const){
      const response=await handler(action,req(admin,"POST",{data:data({scheduledJtm:"invalid"}),...(action==="collection"?{reason}:{})}));
      assert.equal(response.status,422);
      const body=await response.json();
      assert.equal(body.error.code,"VALIDATION_ERROR");
      assert.ok(body.error.fieldErrors["data.scheduledJtm"]);
    }
  });
  await t.test(
    "SC04 end time calculated server-side from school minutes, JTM stored exact4dp",
    async () => {
      first = await create(data());
      assert.equal(first.timeEnd, "08:10:00");
      assert.equal(first.scheduledJtm, "1.0000");
      assert.equal(first.minutesPerJtm, 40);
      assert.equal(first.teacherName, "schedule.guru.a");
    },
  );
  await t.test(
    "SC05 relation/period/date and inactive teacher invalid; no client timeEnd or tariff",
    async () => {
      for (const change of [
        { userId: inactive },
        { classId: classC.id },
        { subjectId: randomUUID() },
        { validTo: "2090-07-01" },
      ])
        await assert.rejects(() => create(data(change)), /SCHEDULE_INVALID/);
      await assert.rejects(() =>
        schedules.save(admin, undefined, {
          data: { ...data(), timeEnd: "08:00" },
          reason,
        }),
      );
    },
  );
  await t.test(
    "SC06 teacher OR class overlap rejected across subjects and resources",
    async () => {
      await assert.rejects(
        () => create(data({ classId: classB.id, timeStart: "07:45" })),
        /SCHEDULE_COLLISION/,
      );
      await assert.rejects(
        () => create(data({ userId: guruBId, timeStart: "07:45" })),
        /SCHEDULE_COLLISION/,
      );
      await assert.rejects(() => create(data()), /SCHEDULE_COLLISION/);
    },
  );
  await t.test(
    "SC07 half-open adjacent intervals are accepted without travel buffer",
    async () => {
      adjacent = await create(data({ timeStart: "08:10" }));
      assert.equal(adjacent.timeEnd, "08:50:00");
    },
  );
  await t.test(
    "SC08 different day, period or disjoint validity do not collide",
    async () => {
      await create(data({ dayIndex: 2 }));
      await create(
        data({
          academicPeriodId: period2.id,
          classId: classC.id,
          validFrom: "2090-07-01",
          validTo: "2090-12-31",
        }),
      );
      window2 = await create(
        data({ validFrom: "2090-02-01", validTo: "2090-02-28" }),
      );
      assert.equal(window2.dayIndex, 1);
    },
  );
  await t.test(
    "SC09 conflict inspection is read-only and does not authorize mutation",
    async () => {
      const before = (await schedules.list(admin, {})).total,
        v = await schedules.conflicts(admin, {
          data: data({ timeStart: "07:35" }),
        });
      assert.ok(v.conflicts.length);
      assert.equal(v.authorizesMutation, false);
      assert.equal((await schedules.list(admin, {})).total, before);
    },
  );
  await t.test(
    "SC10 save rechecks after an earlier clear preview, without lost update",
    async () => {
      const v = data({
        userId: guruBId,
        classId: classB.id,
        timeStart: "09:00",
      });
      assert.equal(
        (await schedules.conflicts(admin, { data: v })).conflicts.length,
        0,
      );
      await create({ ...v, userId: guruAId });
      await assert.rejects(() => create(v), /SCHEDULE_COLLISION/);
    },
  );
  await t.test(
    "SC11 fractional JTM seconds remain exact and do not use binary floating honor math",
    async () => {
      const v = await create(
        data({
          userId: guruBId,
          classId: classB.id,
          timeStart: "13:00",
          scheduledJtm: "0.0001",
        }),
      );
      assert.equal(v.scheduledJtm, "0.0001");
      assert.equal(v.timeEnd, "13:00:00.24");
    },
  );
  await t.test(
    "SC12 midnight overflow and invalid/overprecise JTM rejected",
    async () => {
      await assert.rejects(
        () => create(data({ timeStart: "23:50" })),
        /SCHEDULE_INVALID/,
      );
      for (const scheduledJtm of ["0", "1e2", "0.00001", "NaN", "-1"])
        await assert.rejects(() => create(data({ scheduledJtm })));
    },
  );
  await t.test(
    "SC13 date windows must include chosen weekday and be bounded",
    async () => {
      let monday = "2090-01-01";
      while (new Date(monday + "T00:00:00Z").getUTCDay() !== 1)
        monday = new Date(Date.parse(monday) + 86400000)
          .toISOString()
          .slice(0, 10);
      await assert.rejects(
        () => create(data({ dayIndex: 0, validFrom: monday, validTo: monday })),
        /SCHEDULE_INVALID/,
      );
      await assert.rejects(() =>
        create(data({ validFrom: "2091-01-01", validTo: "2090-12-31" })),
      );
    },
  );
  await t.test(
    "SC14 filters cover full data; guru mine cannot expose other users",
    async () => {
      const a = await schedules.list(admin, { pageSize: 1 }),
        b = await schedules.list(admin, { pageSize: 1, page: 2 });
      assert.notEqual(a.items[0]?.id, b.items[0]?.id);
      assert.ok(a.total > 1);
      assert.equal(
        (await schedules.list(admin, { academicYearId: randomUUID() })).total,
        0,
      );
      assert.equal(
        (await schedules.list(admin, { academicYearId: year.id })).total,
        a.total,
      );
      assert.equal((await schedules.list(admin, { q: "%" })).total, 0);
      assert.ok(
        (await schedules.list(admin, { classId: classB.id })).items.every(
          (v) => v.classId === classB.id,
        ),
      );
      assert.ok(
        (await schedules.list(guruB, {}, true)).items.every(
          (v) => v.userId === guruBId,
        ),
      );
      assert.equal(
        (await schedules.list(guruA, { userId: guruBId }, true)).total,
        0,
      );
    },
  );
  await t.test(
    "SC15 recap sums exact JTM on all filtered rows, never claims attendance/honor",
    async () => {
      const v = await schedules.recaps(admin, {
        classId: classB.id,
        pageSize: 1,
      });
      assert.equal(v.rowCount, 2);
      assert.equal(v.totalScheduledJtm, "1.0001");
      assert.equal(v.basis, "filtered_schedule_rows_not_attendance_or_honor");
    },
  );
  await t.test(
    "SC16 future edit CAS, server-derived duration and stale write rollback",
    async () => {
      const updated = await schedules.save(admin, first.id, {
        data: data({ timeStart: "06:00" }),
        version: first.version,
        reason,
      });
      assert.equal(updated.revised, false);
      assert.equal(updated.schedule.timeEnd, "06:40:00");
      await assert.rejects(
        () =>
          schedules.save(admin, first.id, {
            data: data({ timeStart: "06:10" }),
            version: first.version,
            reason,
          }),
        /VERSION_CONFLICT/,
      );
      first = updated.schedule;
    },
  );
  await t.test(
    "SC17 school-minute changes do not rewrite old snapshots; new schedules use new value",
    async () => {
      school = await masters.save(admin, "school", {
        id: school.id,
        version: school.version,
        reason,
        data: { ...schoolData, minutesPerJtm: 25 },
      });
      const v = await create(
        data({
          userId: guruBId,
          classId: classB.id,
          timeStart: "14:00",
          scheduledJtm: "1.5",
        }),
      );
      assert.equal(v.timeEnd, "14:37:30");
      assert.equal(v.minutesPerJtm, 25);
      assert.equal(
        (await schedules.list(admin, {})).items.find((v) => v.id === first.id)
          ?.timeEnd,
        "06:40:00",
      );
      school = await masters.save(admin, "school", {
        id: school.id,
        version: school.version,
        reason,
        data: schoolData,
      });
    },
  );
  await t.test(
    "SC18 referenced masters cannot be archived or trimmed under live schedules",
    async () => {
      await assert.rejects(
        () =>
          masters.save(
            admin,
            "classes",
            { id: classA.id, version: classA.version, reason },
            true,
          ),
        /MASTER_REFERENCED/,
      );
      await assert.rejects(
        () =>
          masters.save(
            admin,
            "subjects",
            { id: subject.id, version: subject.version, reason },
            true,
          ),
        /MASTER_REFERENCED/,
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
              dateEnd: "2090-01-15",
              isActive: true,
            },
          }),
        /MASTER_REFERENCED/,
      );
    },
  );
  let monday = "2090-01-01";
  while (new Date(monday + "T00:00:00Z").getUTCDay() !== 1)
    monday = new Date(Date.parse(monday) + 86400000).toISOString().slice(0, 10);
  await t.test(
    "SC19 today is own-user scoped and reads the same holiday DayContext",
    async () => {
      const before = await schedules.today(guruA, monday);
      assert.ok(before.items.length >= 2);
      assert.equal(before.confirmationAvailable, true);
      const p = await calendar.preview(admin, "calendar", {
        action: "upsert",
        date: monday,
        version: "0",
        description: "Libur uji",
        isHoliday: true,
        reason,
      });
      assert.equal(p.assignmentIntegration, "exams_ready");
      await calendar.commit(
        admin,
        "calendar",
        { previewId: p.previewId },
        "upsert",
      );
      const after = await schedules.today(guruA, monday);
      assert.equal(after.items.length, 0);
      assert.equal(after.dayContext.isHoliday, true);
      assert.equal(
        (
          await handler(
            "today",
            req(
              guruA,
              "GET",
              undefined,
              "/api/schedules/today?date=" + monday + "&userId=" + guruBId,
            ),
          )
        ).status,
        422,
      );
    },
  );
  await t.test(
    "SC20 schedule mutation invalidates calendar previews and context fingerprints",
    async () => {
      const p = await calendar.preview(admin, "calendar", {
        action: "upsert",
        date: "2090-04-01",
        version: "0",
        description: "Catatan",
        isHoliday: false,
        reason,
      });
      await create(data({ timeStart: "15:00", dayIndex: 3 }));
      await assert.rejects(
        () =>
          calendar.commit(
            admin,
            "calendar",
            { previewId: p.previewId },
            "upsert",
          ),
        /CALENDAR_PREVIEW_STALE/,
      );
    },
  );
  let historical: ScheduleRow, newVersion: ScheduleRow;
  await t.test(
    "SC21 running schedule edit creates forward successor and closes old validity",
    async () => {
      const today = wibDate(),
        yearNum = Number(today.slice(0, 4)),
        y = await masters.save(admin, "academic-years", {
          version: "0",
          reason,
          data: {
            label: yearNum + "/" + (yearNum + 1),
            dateStart: yearNum + "-01-01",
            dateEnd: yearNum + 1 + "-12-31",
          },
        }),
        p = await masters.save(admin, "academic-periods", {
          version: "0",
          reason,
          data: {
            academicYearId: y.id,
            semester: 1,
            dateStart: yearNum + "-01-01",
            dateEnd: yearNum + 1 + "-12-31",
            isActive: false,
          },
        }),
        c = await klass(p.id, 7);
      const future = new Date(Date.parse(today) + 30 * 86400000)
          .toISOString()
          .slice(0, 10),
        oldStart = new Date(Date.parse(today) - 10 * 86400000)
          .toISOString()
          .slice(0, 10);
      historical = await create(
        data({
          academicPeriodId: p.id,
          classId: c.id,
          validFrom: today,
          validTo: future,
          timeStart: "10:00",
        }),
      );
      await db.transaction(async (tx) => {
        await tx.query("select app.master_guard($1,true)", [tokenHash(admin)]);
        await tx.query("select set_config('app.master_reason',$1,true)", [
          reason,
        ]);
        await tx.query(
          "update app.teaching_schedules set valid_from=$1 where id=$2",
          [oldStart, historical.id],
        );
      });
      const cutoff = new Date(Date.parse(today) + 2 * 86400000)
        .toISOString()
        .slice(0, 10);
      const v = await schedules.save(admin, historical.id, {
        version: historical.version,
        reason,
        data: {
          ...data(),
          academicPeriodId: p.id,
          classId: c.id,
          validFrom: cutoff,
          validTo: future,
          timeStart: "11:00",
        },
      });
      assert.equal(v.revised, true);
      assert.equal(v.previousId, historical.id);
      newVersion = v.schedule;
      const old = (await schedules.list(admin, { state: "closed" })).items.find(
        (v) => v.id === historical.id,
      )!;
      assert.equal(
        old.validTo,
        new Date(Date.parse(cutoff) - 86400000).toISOString().slice(0, 10),
      );
      assert.equal(old.timeStart, "10:00");
      assert.equal(v.schedule.timeStart, "11:00");
    },
  );
  await t.test(
    "SC22 closed history is read-only and snapshot labels survive master edits",
    async () => {
      await assert.rejects(
        () =>
          schedules.save(admin, historical.id, {
            version: "2",
            reason,
            data: data(),
          }),
        /SCHEDULE_HISTORICAL/,
      );
      await masters.save(admin, "subjects", {
        id: subject.id,
        version: subject.version,
        reason,
        data: { name: "IPA Diubah" },
      });
      const r = (await schedules.list(admin, { state: "closed" })).items.find(
        (v) => v.id === historical.id,
      )!;
      assert.equal(r.subjectName, "IPA");
      assert.equal((await schedules.history(admin, historical.id)).length, 3);
      assert.ok(newVersion.replacesId);
    },
  );
  await t.test(
    "SC23 stopping unstarted schedule archives logically and never deletes row",
    async () => {
      await schedules.stop(admin, window2.id, {
        version: window2.version,
        stopFrom: "2090-02-01",
        reason,
      });
      assert.equal(
        (await schedules.list(admin, { state: "archived" })).items.find(
          (v) => v.id === window2.id,
        )?.state,
        "archived",
      );
      assert.equal(
        (
          await db.query("select id from app.teaching_schedules where id=$1", [
            window2.id,
          ])
        ).rows.length,
        1,
      );
    },
  );
  let bulkA: ScheduleRow, bulkB: ScheduleRow;
  await t.test(
    "SC24 bulk preview binds actor and is read-only; no cross-account commit",
    async () => {
      bulkA = await create(data({ timeStart: "16:00", dayIndex: 4 }));
      bulkB = await create(data({ timeStart: "17:00", dayIndex: 4 }));
      const p = await schedules.bulkPreview(admin, {
        items: [
          { id: bulkA.id, version: bulkA.version },
          { id: bulkB.id, version: bulkB.version },
        ],
        stopFrom: "2090-01-01",
        reason,
      });
      assert.equal(p.count, 2);
      await assert.rejects(
        () => schedules.bulkCommit(second, { previewId: p.previewId }),
        /CALENDAR_PREVIEW_INVALID/,
      );
      assert.equal(
        (await schedules.list(admin, {})).items.find((v) => v.id === bulkA.id)
          ?.state,
        "active",
      );
    },
  );
  await t.test(
    "SC25 bulk preview stales on schedule/calendar changes with no partial writes",
    async () => {
      const p = await schedules.bulkPreview(admin, {
        items: [
          { id: bulkA.id, version: bulkA.version },
          { id: bulkB.id, version: bulkB.version },
        ],
        stopFrom: "2090-01-01",
        reason,
      });
      await create(data({ timeStart: "18:00", dayIndex: 4 }));
      await assert.rejects(
        () => schedules.bulkCommit(admin, { previewId: p.previewId }),
        /CALENDAR_PREVIEW_STALE/,
      );
    },
  );
  await t.test(
    "SC26 injected failure after first bulk item rolls back whole batch and consumption",
    async () => {
      const p = await schedules.bulkPreview(admin, {
        items: [
          { id: bulkA.id, version: bulkA.version },
          { id: bulkB.id, version: bulkB.version },
        ],
        stopFrom: "2090-01-01",
        reason,
      });
      await db.query(
        "update ops.schedule_previews set request=jsonb_set(request,'{items,1,version}','\"999\"'::jsonb) where id=$1",
        [p.previewId],
      );
      await assert.rejects(
        () => schedules.bulkCommit(admin, { previewId: p.previewId }),
        /VERSION_CONFLICT/,
      );
      assert.equal(
        (await schedules.list(admin, {})).items.find((v) => v.id === bulkA.id)
          ?.state,
        "active",
      );
      assert.equal(
        (
          await db.query<{ consumed_at: null }>(
            "select consumed_at from ops.schedule_previews where id=$1",
            [p.previewId],
          )
        ).rows[0]!.consumed_at,
        null,
      );
    },
  );
  await t.test(
    "SC27 bulk expiry/duplicate validation, atomic success and one-use replay",
    async () => {
      await assert.rejects(() =>
        schedules.bulkPreview(admin, {
          items: [
            { id: bulkA.id, version: "1" },
            { id: bulkA.id, version: "1" },
          ],
          stopFrom: "2090-01-01",
          reason,
        }),
      );
      const p = await schedules.bulkPreview(admin, {
        items: [
          { id: bulkA.id, version: "1" },
          { id: bulkB.id, version: "1" },
        ],
        stopFrom: "2090-01-01",
        reason,
      });
      await db.query(
        "update ops.schedule_previews set expires_at=clock_timestamp()-interval '1 minute' where id=$1",
        [p.previewId],
      );
      await assert.rejects(
        () => schedules.bulkCommit(admin, { previewId: p.previewId }),
        /CALENDAR_PREVIEW_INVALID/,
      );
      const fresh = await schedules.bulkPreview(admin, {
        items: [
          { id: bulkA.id, version: "1" },
          { id: bulkB.id, version: "1" },
        ],
        stopFrom: "2090-01-01",
        reason,
      });
      assert.equal(
        (await schedules.bulkCommit(admin, { previewId: fresh.previewId }))
          .count,
        2,
      );
      await assert.rejects(
        () => schedules.bulkCommit(admin, { previewId: fresh.previewId }),
        /CALENDAR_PREVIEW_INVALID/,
      );
    },
  );
  await t.test(
    "SC28 least privilege blocks raw tables, helpers, private previews and worker/auth entry points",
    async () => {
      await assert.rejects(() =>
        business.query("select * from app.teaching_schedules"),
      );
      await assert.rejects(() =>
        business.query("select * from ops.schedule_previews"),
      );
      await assert.rejects(() =>
        business.query("select app.schedule_dto($1)", [first.id]),
      );
      for (const role of [
        "sim_guru_auth",
        "sim_guru_worker",
        "sim_guru_bootstrap",
      ])
        assert.equal(
          (
            await db.query<{ allowed: boolean }>(
              "select has_function_privilege($1,'app.schedule_save(text,uuid,bigint,jsonb,text)','execute') as allowed",
              [role],
            )
          ).rows[0]!.allowed,
          false,
        );
      assert.equal(
        JSON.stringify(await schedules.history(admin, first.id)).includes(hash),
        false,
      );
    },
  );
  await t.test(
    "SC29 HTTP create/list/recaps and collision envelopes do not leak SQL or hash",
    async () => {
      const r = await handler(
        "collection",
        req(admin, "POST", {
          data: data({ timeStart: "19:00", dayIndex: 5 }),
          reason,
        }),
      );
      assert.equal(r.status, 200);
      assert.equal(r.headers.get("cache-control"), "no-store");
      const collision = await handler(
        "collection",
        req(admin, "POST", {
          data: data({ timeStart: "19:00", dayIndex: 5 }),
          reason,
        }),
      );
      assert.equal(collision.status, 409);
      const body = await collision.text();
      assert.equal(body.includes("app.teaching_schedules"), false);
      assert.equal(body.includes(hash), false);
      assert.equal(
        (await handler("history", req(guruA), first.id)).status,
        403,
      );
    },
  );
  await t.test(
    "SC30 new unsupported finance modules fail closed until adapter integrated",
    async () => {
      await db.exec("alter table finance.honor_periods rename to honor_periods_installed; create table finance.honor_periods(id uuid)");
      await assert.rejects(
        () => create(data({ timeStart: "20:00" })),
        /CONTEXT_DEPENDENCY_UNAVAILABLE/,
      );
      await assert.rejects(
        () => schedules.today(guruA, monday),
        /CONTEXT_DEPENDENCY_UNAVAILABLE/,
      );
      await db.exec("drop table finance.honor_periods; alter table finance.honor_periods_installed rename to honor_periods");
    },
  );
});
