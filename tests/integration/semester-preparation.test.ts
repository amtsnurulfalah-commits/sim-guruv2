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
import { LocalAuthService, tokenHash } from "../../src/server/auth/service";
import { SemesterPreparationService } from "../../src/server/semester-preparation/service";
import {
  previewSchema,
  receiptSchema,
  type PreparationChoices,
} from "../../src/lib/semester-preparation/contracts";
import { createSemesterPreparationHandler } from "../../src/server/semester-preparation/http";
import { AccountLifecycleService } from "../../src/server/accounts/lifecycle";
import { issueCsrf } from "../../src/server/auth/security";
const password = "H9!vL4#qT8@bP2$wF7&z";
test("Stage6 atomic semester preparation with bounded configuration allowlist", async (t) => {
  const db = await openPgliteDatabase();
  t.after(() => db.close());
  const migrations = await readMigrations("supabase/migrations");
  await applyMigrations(db, migrations.slice(0, -1));
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

  await fixture("operator", "admin");
  const guruId = await fixture("teacher.one", "guru");
  await fixture("other.admin", "admin");
  await fixture("onboard", "guru", false);
  const before = (
    await db.query(
      "select oid::regprocedure::text routine,md5(prosrc) hash from pg_proc where oid in('finance.calculate(uuid,date,text)'::regprocedure,'finance.bundle(date,text)'::regprocedure,'app.schedule_candidate(jsonb)'::regprocedure) order by 1",
    )
  ).rows;
  await applyMigrations(db, migrations);
  assert.equal((await applyMigrations(db, migrations)).length, 0);
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
    other = await login("other.admin"),
    onboard = await login("onboard");
  const service = new SemesterPreparationService(business);
  await db.exec(`DO $fx$ DECLARE y uuid;p uuid;c uuid;s uuid;BEGIN
 PERFORM app.master_guard('${tokenHash(admin)}',true);PERFORM set_config('app.master_reason','Synthetic semester fixture',true);
 INSERT INTO app.school_profiles(name,npsn,level,use_parallel,parallel_max,minutes_per_jtm)VALUES('Synthetic','','SMP',false,1,40);
 INSERT INTO app.academic_years(label,date_start,date_end)VALUES('2090/2091','2090-01-01','2091-12-31')RETURNING id INTO y;
 INSERT INTO app.academic_periods(academic_year_id,semester,date_start,date_end,is_active)VALUES(y,1,'2090-01-01','2090-06-30',true)RETURNING id INTO p;
 INSERT INTO app.academic_periods(academic_year_id,semester,date_start,date_end,is_active)VALUES(y,2,'2090-07-01','2090-12-31',false);
 INSERT INTO app.classes(academic_period_id,name,level,grade,parallel,expected_students)VALUES(p,'Kelas 7','SMP',7,'',30)RETURNING id INTO c;
 INSERT INTO app.subjects(name)VALUES('IPA')RETURNING id INTO s;
 INSERT INTO app.teaching_schedules(academic_period_id,user_id,subject_id,class_id,day_index,time_start,time_end,scheduled_jtm,rest_minutes,minutes_per_jtm,valid_from,valid_to,snapshot)
 VALUES(p,'${guruId}',s,c,1,'07:00','07:40',1,0,40,'2090-01-01','2090-06-30','{}');
 END $fx$`);
  const periods = ((await service.read(admin, {})) as PreparationChoices)
    .periods;
  const sourceId = periods.find((p) => p.start === "2090-01-01")!.id,
    targetId = periods.find((p) => p.start === "2090-07-01")!.id;
  const req = {
    sourceId,
    targetId,
    configuration: "classes_and_schedules",
    reason: "Persiapan semester sintetis",
  };
  const preview = async (token = admin, patch = {}) =>
    previewSchema.parse(
      await service.command(token, "preview", { ...req, ...patch }),
    );
  const commit = async (id: string, token = admin) =>
    receiptSchema.parse(
      await service.command(token, "commit", { previewId: id }),
    );
  const counts = async () =>
    (
      await db.query(
        "select (select count(*) from app.daily_attendance) attendance,(select count(*) from app.activity_occurrences) occurrences,(select count(*) from app.teaching_journals) journals,(select count(*) from app.exam_baps) baps,(select count(*) from finance.jtm_ledger) ledger,(select count(*) from finance.honor_statements) statements",
      )
    ).rows;
  await t.test("RLS/private helpers and role/session boundaries", async () => {
    assert.deepEqual(
      (
        await db.query(
          "select relrowsecurity,relforcerowsecurity from pg_class where oid='ops.semester_preparations'::regclass",
        )
      ).rows,
      [{ relrowsecurity: true, relforcerowsecurity: true }],
    );
    await assert.rejects(() =>
      business.query("select * from ops.semester_preparations"),
    );
    await assert.rejects(() =>
      business.query("select app.semester_basis($1,$2)", [sourceId, targetId]),
    );
    await assert.rejects(() => service.read(guru, {}), /FORBIDDEN/);
    await assert.rejects(() => preview(guru), /FORBIDDEN/);
    await assert.rejects(
      () => preview(onboard),
      /ONBOARDING_REQUIRED|FORBIDDEN/,
    );
    assert.deepEqual(
      (
        await db.query(
          "select oid::regprocedure::text routine,md5(prosrc) hash from pg_proc where oid in('finance.calculate(uuid,date,text)'::regprocedure,'finance.bundle(date,text)'::regprocedure,'app.schedule_candidate(jsonb)'::regprocedure) order by 1",
        )
      ).rows,
      before,
    );
  });
  await t.test(
    "preview maps new IDs/dates and does not write configuration or transactional data",
    async () => {
      const evidence = await counts();
      const p = await preview();
      assert.deepEqual(p.plan.issues, []);
      assert.equal(p.plan.classes.length, 1);
      assert.equal(p.plan.schedules.length, 1);
      assert.equal(p.plan.classes[0]!.expectedStudents, 0);
      assert.notEqual(p.plan.classes[0]!.id, p.plan.classes[0]!.sourceId);
      assert.equal(p.plan.schedules[0]!.classId, p.plan.classes[0]!.id);
      assert.equal(p.plan.validFrom, "2090-07-01");
      assert.equal(p.plan.validTo, "2090-12-31");
      assert.equal(p.plan.sourceDate, "2090-06-30");
      assert.equal(
        (
          await db.query<{ n: number }>(
            "select count(*)::int n from app.classes where academic_period_id=$1",
            [targetId],
          )
        ).rows[0]!.n,
        0,
      );
      assert.deepEqual(await counts(), evidence);
      await assert.rejects(() => commit(p.previewId, other), /NOT_FOUND/);
      await assert.rejects(
        () => service.read(other, { previewId: p.previewId }),
        /NOT_FOUND/,
      );
    },
  );
  await t.test(
    "source changes, expiry and changed policies block commit",
    async () => {
      let p = await preview();
      await db.exec(
        `DO $$ BEGIN PERFORM app.master_guard('${tokenHash(admin)}',true);PERFORM set_config('app.master_reason','Synthetic source edit',true);UPDATE app.classes SET name='Kelas Tujuh',version=version+1 WHERE academic_period_id='${sourceId}';END $$`,
      );
      await assert.rejects(() => commit(p.previewId), /SEMESTER_PREVIEW_STALE/);
      p = await preview();
      await db.query(
        "update ops.semester_preparations set expires_at=clock_timestamp()-interval '1 second' where id=$1",
        [p.previewId],
      );
      await assert.rejects(() => commit(p.previewId), /SEMESTER_PREVIEW_STALE/);
      await db.query("update app.app_users set status='disabled' where id=$1", [
        guruId,
      ]);
      p = await preview();
      assert.ok(p.plan.issues.includes("INACTIVE_DEPENDENCY"));
      await assert.rejects(() => commit(p.previewId), /SEMESTER_PREVIEW_STALE/);
      await db.query("update app.app_users set status='active' where id=$1", [
        guruId,
      ]);
      assert.ok(
        (
          await preview(admin, { targetId: sourceId, sourceId: targetId })
        ).plan.issues.includes("PERIOD_INVALID"),
      );
    },
  );
  await t.test(
    "configuration allowlist, target occupancy and policy/collision checks",
    async () => {
      assert.equal(
        (await preview(admin, { configuration: "classes" })).plan.schedules
          .length,
        0,
      );
      await assert.rejects(() => preview(admin, { configuration: "all" }));
      await assert.rejects(
        () => preview(admin, { targetId: randomUUID() }),
        /SEMESTER_INVALID/,
      );
      await db.exec(
        `DO $$ BEGIN PERFORM app.master_guard('${tokenHash(admin)}',true);PERFORM set_config('app.master_reason','Synthetic JP policy change',true);UPDATE app.school_profiles SET minutes_per_jtm=45;END $$`,
      );
      assert.ok((await preview()).plan.issues.includes("JP_POLICY_CHANGED"));
      await db.exec(
        `DO $$ BEGIN PERFORM app.master_guard('${tokenHash(admin)}',true);PERFORM set_config('app.master_reason','Synthetic JP policy restore',true);UPDATE app.school_profiles SET minutes_per_jtm=40;END $$`,
      );
      // Simulate conflicting imported configuration; production triggers are never disabled.
      await db.exec(`DO $$ BEGIN PERFORM app.master_guard('${tokenHash(admin)}',true);PERFORM set_config('app.master_reason','Synthetic malformed legacy fixture',true);ALTER TABLE app.teaching_schedules DISABLE TRIGGER schedules_validate;
INSERT INTO app.teaching_schedules(academic_period_id,user_id,subject_id,class_id,day_index,time_start,time_end,scheduled_jtm,rest_minutes,minutes_per_jtm,valid_from,valid_to,snapshot)
 SELECT academic_period_id,user_id,subject_id,class_id,day_index,time_start,time_end,scheduled_jtm,rest_minutes,minutes_per_jtm,valid_from,valid_to,snapshot FROM app.teaching_schedules WHERE academic_period_id='${sourceId}';ALTER TABLE app.teaching_schedules ENABLE TRIGGER schedules_validate;END $$`);
      const bad = await preview();
      assert.ok(bad.plan.issues.includes("SCHEDULE_COLLISION"));
      await assert.rejects(
        () => commit(bad.previewId),
        /SEMESTER_PREVIEW_STALE/,
      );
      await db.exec(
        `DELETE FROM app.teaching_schedules WHERE id=(SELECT max(id::text)::uuid FROM app.teaching_schedules WHERE academic_period_id='${sourceId}')`,
      );
    },
  );
  await t.test(
    "existing attendance/journal/ledger evidence is outside the copy allowlist",
    async () => {
      await db.exec(`DO $$ DECLARE s app.teaching_schedules%ROWTYPE;o uuid;a uuid;j uuid;d date;BEGIN
      SELECT * INTO s FROM app.teaching_schedules WHERE academic_period_id='${sourceId}' LIMIT 1;
      d:=s.valid_from+((s.day_index-extract(dow FROM s.valid_from)::int+7)%7);
      INSERT INTO app.activity_occurrences(kind,schedule_id,date,academic_period_id,class_id,subject_id,time_start,time_end,scheduled_jtm,expected_students,snapshot)VALUES('KBM',s.id,d,s.academic_period_id,s.class_id,s.subject_id,s.time_start,s.time_end,s.scheduled_jtm,30,s.snapshot)RETURNING id INTO o;
      INSERT INTO app.activity_assignments(occurrence_id,original_user_id,effective_user_id)VALUES(o,s.user_id,s.user_id)RETURNING id INTO a;
      INSERT INTO app.activity_confirmations(assignment_id,confirmed_by,reason)VALUES(a,(SELECT id FROM app.app_users WHERE username='operator'),'Synthetic confirmation');
      INSERT INTO app.daily_attendance(user_id,date,actual_time_in,actual_time_out,time_in_source)VALUES(s.user_id,d,'07:00','14:00','admin');
      INSERT INTO app.teaching_journals(occurrence_id,assignment_id,user_id,material,present,absent,notes,input_type,weight,credited_jtm)VALUES(o,a,s.user_id,'Original learning material',30,0,'Original source note','SAME_DAY',1,1)RETURNING id INTO j;
      INSERT INTO finance.jtm_ledger(source_kind,occurrence_id,user_id,date,jtm,revision,journal_id,assignment_id)VALUES('KBM',o,s.user_id,d,1,1,j,null);
    END $$`);
      const c = await counts();
      assert.equal(c[0]!.attendance, 1);
      assert.equal(c[0]!.journals, 1);
      assert.equal(c[0]!.ledger, 1);
    },
  );
  await t.test(
    "late constraint failure rolls back all classes and audit/config writes",
    async () => {
      const p = await preview();
      const evidence = await counts();
      await db.exec(
        "CREATE FUNCTION app.test_reject_semester() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'SYNTHETIC_LATE_FAILURE';END $$; CREATE TRIGGER test_reject_semester BEFORE INSERT ON app.teaching_schedules FOR EACH ROW EXECUTE FUNCTION app.test_reject_semester()",
      );
      await assert.rejects(() => commit(p.previewId), /SYNTHETIC_LATE_FAILURE/);
      assert.equal(
        (
          await db.query<{ n: number }>(
            "select count(*)::int n from app.classes where academic_period_id=$1",
            [targetId],
          )
        ).rows[0]!.n,
        0,
      );
      assert.equal(
        (
          (await service.read(admin, { previewId: p.previewId })) as {
            result: unknown;
          }
        ).result,
        null,
      );
      assert.deepEqual(await counts(), evidence);
      await db.exec(
        "DROP TRIGGER test_reject_semester ON app.teaching_schedules; DROP FUNCTION app.test_reject_semester()",
      );
    },
  );
  await t.test(
    "canonical commit is atomic/idempotent, preserves source and does not activate target",
    async () => {
      const p = await preview();
      const competing = await preview();
      const sourceBefore = (
        await db.query(
          "select to_jsonb(c) row from app.classes c where academic_period_id=$1",
          [sourceId],
        )
      ).rows;
      const evidence = await counts();
      const r = await commit(p.previewId);
      assert.equal(r.classes, 1);
      assert.equal(r.schedules, 1);
      assert.equal(r.classMapping[0]!.id, p.plan.classes[0]!.id);
      assert.equal(r.scheduleMapping[0]!.id, p.plan.schedules[0]!.id);
      assert.deepEqual(await commit(p.previewId), r);
      await assert.rejects(
        () => commit(competing.previewId),
        /SEMESTER_PREVIEW_STALE/,
      );
      assert.deepEqual(
        (
          await db.query(
            "select to_jsonb(c) row from app.classes c where academic_period_id=$1",
            [sourceId],
          )
        ).rows,
        sourceBefore,
      );
      assert.deepEqual(await counts(), evidence);
      assert.equal(
        (
          await db.query<{ active: boolean }>(
            "select is_active active from app.academic_periods where id=$1",
            [targetId],
          )
        ).rows[0]!.active,
        false,
      );
      assert.equal(
        (
          await db.query<{ n: number }>(
            "select count(*)::int n from ops.activity_revisions where entity_kind='semester-preparation'",
          )
        ).rows[0]!.n,
        1,
      );
      assert.ok((await preview()).plan.issues.includes("TARGET_NOT_EMPTY"));
      const history = (await service.read(admin, {})) as PreparationChoices;
      assert.equal(history.history.length, 1);
      assert.equal(history.history[0]!.result.previewId, p.previewId);
    },
  );
  await t.test("HTTP session/origin/CSRF and unknown actions", async () => {
    const config = {
      appUrl: "https://sim.example.test",
      sessionSecret: "S".repeat(40),
      production: true,
      vercel: true,
    };
    const handler = createSemesterPreparationHandler({
      config: () => config,
      auth: async () => auth,
      service: async () => service,
      rate: async () =>
        new AccountLifecycleService(authDb, passwords, {
          hmac: "H".repeat(40),
          encryptionKey: randomBytes(32).toString("base64"),
          appUrl: config.appUrl,
        }),
    });
    const request = (
      token?: string,
      data?: unknown,
      csrf = true,
      origin = config.appUrl,
    ) =>
      new Request(
        config.appUrl +
          "/api/semester-preparation/" +
          (data ? "preview" : "read"),
        {
          method: data ? "POST" : "GET",
          headers: {
            origin,
            "x-vercel-forwarded-for": "192.0.2.26",
            ...(token ? { cookie: "__Host-sim_guru_session=" + token } : {}),
            ...(data
              ? {
                  "Content-Type": "application/json",
                  ...(csrf
                    ? {
                        "X-CSRF-Token": issueCsrf(
                          config.sessionSecret,
                          "session",
                          token ?? "",
                        ),
                      }
                    : {}),
                }
              : {}),
          },
          ...(data ? { body: JSON.stringify(data) } : {}),
        },
      );
    assert.equal((await handler("read", request())).status, 401);
    assert.equal((await handler("read", request(guru))).status, 403);
    assert.equal(
      (await handler("preview", request(admin, req, false))).status,
      403,
    );
    assert.equal(
      (await handler("preview", request(admin, req, true, "https://evil.test")))
        .status,
      403,
    );
    assert.equal((await handler("unknown", request(admin))).status, 405);
    assert.equal((await handler("read", request(admin))).status, 200);
  });
});
