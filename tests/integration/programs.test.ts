import { ProgramService } from "../../src/server/programs/service";
import type { ExamBoard, EventBoard } from "../../src/lib/programs/schemas";
import { ActivityService } from "../../src/server/activities/service";
import { createProgramHandler } from "../../src/server/programs/http";
import { AccountLifecycleService } from "../../src/server/accounts/lifecycle";
import { issueCsrf } from "../../src/server/auth/security";
import { readFile } from "node:fs/promises";
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
const password = "H9!vL4#qT8@bP2$wF7&z";
test("Tahap 5 — exams, BAP and events", async (t) => {
  const db = await openPgliteDatabase();
  t.after(() => db.close());
  const migrations = await readMigrations("supabase/migrations");
  await applyMigrations(db, migrations.slice(0, -4));
  const passwords = await getPasswordService(),
    hash = await passwords.hashNew(password, {
      username: "operator",
      fullName: "Operator",
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
  const adminId = await fixture("operator", "admin"),
    guruId = await fixture("teacher.one", "guru"),
    otherId = await fixture("teacher.two", "guru");
  await fixture("onboard", "guru", false);
  await t.test(
    "A01 upgrade preserves identities, migrations rerun is no-op and all new tables FORCE RLS",
    async () => {
      assert.equal((await applyMigrations(db, migrations)).length, 4);
      assert.equal((await applyMigrations(db, migrations)).length, 0);
      assert.equal(
        (await db.query("select id from app.app_users where id=$1", [guruId]))
          .rows.length,
        1,
      );
      assert.equal(
        (
          await db.query(
            "select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('app','auth_private','ops','finance') and c.relkind='r' and not(c.relrowsecurity and c.relforcerowsecurity)",
          )
        ).rows.length,
        0,
      );
    },
  );
  // Deterministic clock only in the disposable test DB. Never installed in production.
  await db.exec(
    "create or replace function app.activity_today() returns date language sql stable set search_path=pg_catalog as $$ select date '2090-01-02' $$",
  );
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
    reason = "Pengujian kegiatan sintetis",
    date = "2090-01-02";
  await masters.save(admin, "school", {
    version: "0",
    reason,
    data: {
      name: "Madrasah Uji",
      address: "",
      npsn: "",
      level: "SMP",
      useParallel: false,
      parallelMax: 1,
      minutesPerJtm: 40,
      headmasterId: "",
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
  const period = await masters.save(admin, "academic-periods", {
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
  const klass = async (grade: number) =>
    masters.save(admin, "classes", {
      version: "0",
      reason,
      data: {
        academicPeriodId: period.id,
        name: "Kelas " + grade,
        level: "SMP",
        grade,
        parallel: "",
        expectedStudents: 30,
      },
    });
  const c1 = await klass(7),
    c2 = await klass(8),
    extraClass = await klass(9);
  const subject = await masters.save(admin, "subjects", {
    version: "0",
    reason,
    data: { name: "IPA" },
  });
  const programs = new ProgramService(business);
  await db.exec(
    "create or replace function app.exam_now() returns timestamp language sql set search_path=pg_catalog as $$ select timestamp '2090-01-02 12:00' $$",
  );
  const save = async (
    entity: string,
    data: unknown,
    id?: string,
    version = "0",
  ) =>
    (await programs.saveExam(admin, { entity, data, id, version, reason })) as {
      id: string;
      version: string;
    };
  const read = async (token = admin, day = date) =>
    (await programs.read(token, { domain: "exams", date: day })) as ExamBoard;
  const rejected = async (work: () => Promise<unknown>, code?: string) =>
    assert.rejects(work, (e: unknown) => {
      if (code) assert.match(String((e as Error).message), new RegExp(code));
      return true;
    });
  const credit = async (occ: string) =>
    Number(
      (
        await db.query<{ v: string }>(
          "select coalesce(sum(jtm),0)::text v from finance.jtm_ledger where occurrence_id=$1",
          [occ],
        )
      ).rows[0]!.v,
    );
  const operate = async (
    id: string,
    operation: string,
    data: Record<string, unknown> = {},
    token = admin,
  ) => {
    const o = (await read(admin)).occurrences.find((o) => o.id === id)!;
    const p = await programs.preview(token, {
      occurrenceId: id,
      version: o.version,
      operation,
      reason,
      ...data,
    });
    await programs.commit(token, { previewId: p.previewId });
  };
  let ep: { id: string; version: string },
    ses: { id: string; version: string },
    room: { id: string; version: string },
    supOcc = "",
    comOcc = "";
  await t.test(
    "E01 strict inputs, real sessions, admin boundary and private tables",
    async () => {
      await rejected(() => programs.read(onboard, { domain: "exams", date }));
      await rejected(
        () =>
          programs.saveExam(guru, {
            entity: "period",
            version: "0",
            reason,
            data: {
              academicPeriodId: period.id,
              name: "Ujian",
              dateStart: date,
              dateEnd: "2090-01-05",
              committeeJtm: "2",
            },
          }),
        "FORBIDDEN",
      );
      await rejected(
        () => business.query("select * from app.exam_baps"),
        "permission denied",
      );
      await rejected(() =>
        programs.saveExam(admin, {
          entity: "period",
          version: "0",
          reason,
          data: {
            academicPeriodId: period.id,
            name: "Ujian",
            dateStart: date,
            dateEnd: "2090-01-05",
            committeeJtm: "2",
            role: "admin",
          },
        }),
      );
    },
  );
  await t.test(
    "E02 complete hierarchy and combined classes, exam context and empty required set",
    async () => {
      ep = await save("period", {
        academicPeriodId: period.id,
        name: "Ujian Semester",
        dateStart: date,
        dateEnd: "2090-01-05",
        committeeJtm: "2",
      });
      ses = await save("session", {
        periodId: ep.id,
        date,
        name: "Sesi I",
        timeStart: "08:00",
        timeEnd: "09:00",
        jtm: "3",
      });
      room = await save("room", {
        sessionId: ses.id,
        name: "Ruang A",
        subjectId: subject.id,
        totalStudents: 60,
        classIds: [c1.id, c2.id],
      });
      await save("supervisor", {
        roomId: room.id,
        userId: guruId,
        overrideJtm: "4",
      });
      await save("committee", {
        periodId: ep.id,
        date,
        userId: otherId,
        jtm: null,
        exclusiveStart: null,
        exclusiveEnd: null,
      });
      const b = await read();
      assert.equal(b.required.length, 2);
      supOcc = b.occurrences.find((o) => o.kind === "EXAM_SUPERVISOR")!.id;
      comOcc = b.occurrences.find((o) => o.kind === "EXAM_COMMITTEE")!.id;
      assert.equal(
        b.occurrences.find((o) => o.id === supOcc)!.scheduledJtm,
        "4.0000",
      );
      assert.equal((await read(admin, "2090-01-03")).required.length, 0);
      assert.equal(
        (
          await db.query<{ v: boolean }>(
            "select (app.day_context_internal($1::date)->>'examEnabled')::boolean v",
            [date],
          )
        ).rows[0]!.v,
        true,
      );
    },
  );
  await t.test(
    "E03 duplicate committee across periods and supervisor across same session/overlap rejected",
    async () => {
      await rejected(
        () =>
          save("committee", {
            periodId: ep.id,
            date,
            userId: otherId,
            jtm: null,
            exclusiveStart: null,
            exclusiveEnd: null,
          }),
        "DUTY_COLLISION",
      );
      const r = await save("room", {
        sessionId: ses.id,
        name: "Ruang B",
        subjectId: subject.id,
        totalStudents: 30,
        classIds: [extraClass.id],
      });
      await rejected(
        () =>
          save("supervisor", {
            roomId: r.id,
            userId: guruId,
            overrideJtm: null,
          }),
        "DUTY_COLLISION",
      );
      const s = await save("session", {
        periodId: ep.id,
        date,
        name: "Sesi tumpang tindih",
        timeStart: "08:30",
        timeEnd: "09:30",
        jtm: "1",
      });
      const rr = await save("room", {
        sessionId: s.id,
        name: "Ruang C",
        subjectId: subject.id,
        totalStudents: 0,
        classIds: [],
      });
      await rejected(
        () =>
          save("supervisor", {
            roomId: rr.id,
            userId: guruId,
            overrideJtm: null,
          }),
        "DUTY_COLLISION",
      );
    },
  );
  await t.test(
    "E04 confirmation committee credits once; supervisor requires BAP and complete recap for committee",
    async () => {
      await operate(comOcc, "confirm");
      assert.equal(await credit(comOcc), 2);
      await operate(comOcc, "confirm");
      assert.equal(await credit(comOcc), 2);
      assert.equal((await read(other)).canOperate, true);
      await rejected(
        () => operate(supOcc, "confirm", {}, other),
        "STUDENT_ATTENDANCE_MISMATCH",
      );
      await operate(supOcc, "confirm");
      assert.equal(await credit(supOcc), 0);
      await rejected(
        () =>
          programs.bap(admin, {
            occurrenceId: supOcc,
            operation: "create",
            version: "0",
            present: 60,
            absent: 0,
            notes: "",
          }),
        "NOT_FOUND",
      );
      await rejected(
        () =>
          programs.bap(other, {
            occurrenceId: supOcc,
            operation: "create",
            version: "0",
            present: 60,
            absent: 0,
            notes: "",
          }),
        "NOT_FOUND",
      );
    },
  );
  await t.test(
    "E05 BAP end+5 gate, integer counts and exact participant sum",
    async () => {
      await db.exec(
        "create or replace function app.exam_now() returns timestamp language sql set search_path=pg_catalog as $$ select timestamp '2090-01-02 09:04:59' $$",
      );
      await rejected(
        () =>
          programs.bap(guru, {
            occurrenceId: supOcc,
            operation: "create",
            version: "0",
            present: 60,
            absent: 0,
            notes: "",
          }),
        "ATTENDANCE_TIME_INVALID",
      );
      await db.exec(
        "create or replace function app.exam_now() returns timestamp language sql set search_path=pg_catalog as $$ select timestamp '2090-01-02 09:05' $$",
      );
      await rejected(
        () =>
          programs.bap(guru, {
            occurrenceId: supOcc,
            operation: "create",
            version: "0",
            present: 59,
            absent: 0,
            notes: "",
          }),
        "STUDENT_COUNT_MISMATCH",
      );
      await rejected(() =>
        programs.bap(guru, {
          occurrenceId: supOcc,
          operation: "create",
          version: "0",
          present: 59.5,
          absent: 0.5,
          notes: "",
        }),
      );
      await programs.bap(guru, {
        occurrenceId: supOcc,
        operation: "create",
        version: "0",
        present: 59,
        absent: 1,
        notes: "Ujian berlangsung tertib",
      });
      assert.equal(await credit(supOcc), 4);
    },
  );
  await t.test(
    "E06 duplicate atomic submission, version CAS and reversal on BAP edit",
    async () => {
      await rejected(
        () =>
          programs.bap(guru, {
            occurrenceId: supOcc,
            operation: "create",
            version: "0",
            present: 60,
            absent: 0,
            notes: "",
          }),
        "DUPLICATE_JOURNAL",
      );
      await programs.bap(guru, {
        occurrenceId: supOcc,
        operation: "edit",
        version: "1",
        present: 58,
        absent: 2,
        notes: "Koreksi",
      });
      assert.equal(await credit(supOcc), 4);
      await rejected(
        () =>
          programs.bap(guru, {
            occurrenceId: supOcc,
            operation: "edit",
            version: "1",
            present: 60,
            absent: 0,
            notes: "",
          }),
        "VERSION_CONFLICT",
      );
      assert.equal(
        (
          await db.query(
            "select id from finance.jtm_ledger where occurrence_id=$1 and source_kind='REVERSAL'",
            [supOcc],
          )
        ).rows.length,
        1,
      );
    },
  );
  await t.test(
    "E07 adjustment zero respected; allocation conservation and reset do not duplicate BAP credit",
    async () => {
      await operate(supOcc, "adjust", { adjustedJtm: "0" });
      assert.equal(await credit(supOcc), 0);
      const receiver = await fixture("teacher.receiver", "guru");
      await operate(supOcc, "allocate", {
        userId: receiver,
        allocatedJtm: "1.25",
      });
      assert.equal(await credit(supOcc), 1.25);
      const receiver2 = await fixture("teacher.receiver2", "guru");
      await rejected(
        () =>
          operate(supOcc, "allocate", { userId: receiver2, allocatedJtm: "3" }),
        "CONSERVATION_VIOLATION",
      );
      await operate(supOcc, "reset");
      assert.equal(await credit(supOcc), 4);
    },
  );
  await t.test(
    "E08 impact is actor-bound, stale on BAP edit and revoke locks history",
    async () => {
      let o = (await read()).occurrences.find((x) => x.id === supOcc)!;
      const p = await programs.preview(admin, {
        occurrenceId: o.id,
        version: o.version,
        operation: "revoke",
        reason,
      });
      assert.equal(p.activeBaps, 1);
      await rejected(
        () => programs.commit(other, { previewId: p.previewId }),
        "PREVIEW_STALE",
      );
      await programs.bap(guru, {
        occurrenceId: supOcc,
        operation: "edit",
        version: "2",
        present: 60,
        absent: 0,
        notes: "Perbaikan kedua",
      });
      await rejected(
        () => programs.commit(admin, { previewId: p.previewId }),
        "PREVIEW_STALE",
      );
      await operate(supOcc, "revoke");
      assert.equal(await credit(supOcc), 0);
      o = (await read()).occurrences.find((x) => x.id === supOcc)!;
      assert.equal(o.bap, null);
      assert.equal(o.lockedBaps, 1);
      await operate(supOcc, "confirm");
      assert.equal(await credit(supOcc), 0);
    },
  );
  await t.test(
    "E09 BAP after session day allowed through end inclusive, blocked afterwards/final",
    async () => {
      await db.exec(
        "create or replace function app.activity_today() returns date language sql set search_path=pg_catalog as $$ select date '2090-01-05' $$",
      );
      await programs.bap(guru, {
        occurrenceId: supOcc,
        operation: "create",
        version: "0",
        present: 60,
        absent: 0,
        notes: "Hari terakhir",
      });
      assert.equal(await credit(supOcc), 4);
      await db.exec(
        "create or replace function app.activity_today() returns date language sql set search_path=pg_catalog as $$ select date '2090-01-06' $$",
      );
      await rejected(
        () =>
          programs.bap(guru, {
            occurrenceId: supOcc,
            operation: "edit",
            version: "1",
            present: 60,
            absent: 0,
            notes: "",
          }),
        "DATE_EXPIRED",
      );
      await db.exec(
        "create or replace function app.activity_today() returns date language sql set search_path=pg_catalog as $$ select date '2090-01-02' $$",
      );
      await db.exec(
        "update finance.period_guards set finalized_at=clock_timestamp() where period_start='2090-01-01'",
      );
      await rejected(() => operate(supOcc, "revoke"), "FINAL_PERIOD");
      await db.exec(
        "update finance.period_guards set finalized_at=NULL where period_start='2090-01-01'",
      );
    },
  );
  await t.test(
    "E11 UJIAN template derives effective participants; committee needs admin time-in for recap",
    async () => {
      const activity = new ActivityService(business);
      await rejected(
        () =>
          activity.command(other, "students-save", {
            classId: c1.id,
            date,
            hadir: 30,
            sakit: 0,
            izin: 0,
            alpa: 0,
            version: "0",
            reason,
          }),
        "FORBIDDEN",
      );
      await activity.command(admin, "template-save", {
        dayIndex: 1,
        type: "UJIAN",
        timeIn: "00:00",
        timeOut: "23:59",
        version: "0",
        reason,
      });
      const ts = (await activity.read(admin, "templates", {})) as {
        items: { id: string; sched_type: string }[];
      };
      const tp = (await activity.command(admin, "template-preview", {
        date,
        templateId: ts.items.find((t) => t.sched_type === "UJIAN")!.id,
      })) as { previewId: string; participants: unknown[] };
      assert.equal(tp.participants.length, 2);
      await activity.command(admin, "template-apply", {
        previewId: tp.previewId,
        reason,
      });
      let att = (await activity.read(admin, "attendance", {
        from: date,
        to: date,
      })) as { items: { id: string; userId: string; version: string }[] };
      const com = att.items.find((a) => a.userId === otherId)!;
      await rejected(
        () =>
          activity.command(other, "in", {
            attendanceId: com.id,
            version: com.version,
            reason,
          }),
        "FORBIDDEN",
      );
      await activity.command(admin, "manual", {
        userId: otherId,
        date,
        scheduledIn: "00:00",
        scheduledOut: "23:59",
        actualIn: "09:00",
        actualOut: null,
        extra: false,
        version: com.version,
        reason,
      });
      for (const c of [c1, c2, extraClass])
        await activity.command(other, "students-save", {
          classId: c.id,
          date,
          hadir: 30,
          sakit: 0,
          izin: 0,
          alpa: 0,
          version: "0",
          reason,
        });
      await operate(supOcc, "confirm", {}, other);
      // Committee can input the supervisor, but not their own time, via the existing attendance endpoint.
      att = (await activity.read(other, "attendance", {
        from: date,
        to: date,
      })) as typeof att;
      const target = att.items.find((a) => a.userId === guruId)!;
      await activity.command(other, "in", {
        attendanceId: target.id,
        version: target.version,
        reason,
      });
      const source = (
        await db.query<{ source: string }>(
          "select time_in_source source from app.daily_attendance where id=$1",
          [target.id],
        )
      ).rows[0]!.source;
      assert.equal(source, "committee");
    },
  );
  await t.test(
    "E12 substitution cleanup preserves daily attendance and cancellation requires reconfirmation",
    async () => {
      const receiver = await fixture("exam.substitute", "guru"),
        owner = await fixture("exam.owner", "guru");
      const s = await save("session", {
        periodId: ep.id,
        date,
        name: "Sesi substitusi",
        timeStart: "15:00",
        timeEnd: "16:00",
        jtm: "2",
      });
      const r = await save("room", {
        sessionId: s.id,
        name: "Ruang substitusi",
        subjectId: subject.id,
        totalStudents: 0,
        classIds: [],
      });
      await save("supervisor", {
        roomId: r.id,
        userId: owner,
        overrideJtm: null,
      });
      const id = (await read()).occurrences.find(
        (o) => o.originalUserId === owner,
      )!.id;
      await operate(id, "substitute", { userId: receiver });
      let o = (await read()).occurrences.find((o) => o.id === id)!;
      assert.equal(o.userId, receiver);
      assert.equal(o.confirmed, false);
      await operate(id, "confirm");
      await rejected(
        () => operate(id, "replace", { userId: adminId }),
        "SUBSTITUTE_INVALID",
      );
      o = (await read()).occurrences.find((o) => o.id === id)!;
      assert.equal(o.userId, receiver);
      assert.equal(o.confirmed, true);
      await operate(id, "cancel-substitute");
      o = (await read()).occurrences.find((o) => o.id === id)!;
      assert.equal(o.userId, owner);
      assert.equal(o.confirmed, false);
      assert.equal(await credit(id), 0);
      assert.equal(
        (
          await db.query(
            "select id from app.daily_attendance where user_id=$1",
            [otherId],
          )
        ).rows.length,
        1,
      );
    },
  );
  await t.test(
    "E10 deletion preview counts cascade, final guard and history remains",
    async () => {
      const p = await programs.deleteExam(admin, {
        entity: "period",
        id: ep.id,
        reason,
      });
      assert.ok((p.assignments ?? 0) >= 2);
      assert.equal(p.baps, 2);
      await programs.deleteExam(admin, {
        previewId: p.previewId,
        confirmed: true,
      });
      assert.equal((await read()).occurrences.length, 0);
      assert.equal(await credit(supOcc), 0);
      assert.equal(await credit(comOcc), 0);
      assert.equal(
        (await db.query("select id from app.exam_baps where state='locked'"))
          .rows.length,
        2,
      );
      await rejected(
        () =>
          programs.deleteExam(admin, {
            previewId: p.previewId,
            confirmed: true,
          }),
        "PREVIEW_STALE",
      );
    },
  );
  const events = async (token = admin) =>
    (await programs.read(token, { domain: "events", date })) as EventBoard;
  let eventId = "",
    attendanceId = "",
    eventOcc = "";
  await t.test(
    "EV01 recurring and incidental definitions, uniqueness, occurrence and admin boundary",
    async () => {
      const data = {
        name: "Rapat guru",
        type: "insidental",
        days: [],
        dates: [date],
        dateStart: date,
        dateEnd: "2090-01-05",
        timeStart: "10:00",
        timeEnd: "11:00",
        jtm: 3,
        description: "Rapat madrasah",
      };
      await rejected(
        () => programs.saveEvent(guru, { version: "0", reason, data }),
        "FORBIDDEN",
      );
      const e = (await programs.saveEvent(admin, {
        version: "0",
        reason,
        data,
      })) as { id: string };
      eventId = e.id;
      await rejected(() =>
        programs.saveEvent(admin, {
          version: "0",
          reason,
          data: { ...data, name: "RAPAT GURU" },
        }),
      );
      assert.equal((await events()).today.length, 1);
      await rejected(
        () =>
          programs.attendance(admin, {
            operation: "attend",
            eventId,
            date: "2090-01-03",
            userId: guruId,
            timeIn: "10:15",
            reason,
          }),
        "FORBIDDEN",
      );
      await rejected(
        () =>
          programs.attendance(guru, {
            operation: "attend",
            eventId,
            date,
            userId: guruId,
            timeIn: "10:15",
            reason,
          }),
        "FORBIDDEN",
      );
    },
  );
  await t.test(
    "EV02 event attendance exact interval, guru only, unique and no journal means zero credit",
    async () => {
      for (const timeIn of ["09:59", "11:00"])
        await rejected(
          () =>
            programs.attendance(admin, {
              operation: "attend",
              eventId,
              date,
              userId: guruId,
              timeIn,
              reason,
            }),
          "ACTIVITY_INVALID",
        );
      await rejected(
        () =>
          programs.attendance(admin, {
            operation: "attend",
            eventId,
            date,
            userId: adminId,
            timeIn: "10:15",
            reason,
          }),
        "ACTIVITY_INVALID",
      );
      const a = (await programs.attendance(admin, {
        operation: "attend",
        eventId,
        date,
        userId: guruId,
        timeIn: "10:15",
        reason,
      })) as { id: string };
      attendanceId = a.id;
      eventOcc = (
        await db.query<{ id: string }>(
          "select id from app.activity_occurrences where event_attendance_id=$1",
          [attendanceId],
        )
      ).rows[0]!.id;
      assert.equal(await credit(eventOcc), 0);
      await rejected(
        () =>
          programs.attendance(admin, {
            operation: "attend",
            eventId,
            date,
            userId: guruId,
            timeIn: "10:20",
            reason,
          }),
        "DUPLICATE_JOURNAL",
      );
      assert.equal((await events(other)).attendance.length, 0);
    },
  );
  await t.test(
    "EV03 owner-only journal, block enforced by SQL and atomic snapshot/ledger",
    async () => {
      await rejected(
        () =>
          programs.journal(other, {
            attendanceId,
            version: "1",
            description: "Catatan orang lain",
          }),
        "NOT_FOUND",
      );
      const block = (await programs.block(admin, {
        version: "0",
        reason,
        eventId,
        dateStart: date,
        dateEnd: date,
        message: "Blok jurnal sementara",
        active: true,
      })) as { id: string };
      await rejected(
        () =>
          programs.journal(guru, {
            attendanceId,
            version: "1",
            description: "Catatan rapat",
          }),
        "JOURNAL_BLOCKED",
      );
      await programs.block(admin, {
        id: block.id,
        version: "1",
        reason,
        eventId,
        dateStart: date,
        dateEnd: date,
        message: "Blok jurnal sementara",
        active: false,
      });
      await programs.journal(guru, {
        attendanceId,
        version: "1",
        description: "Membahas perbaikan pembelajaran.",
      });
      assert.equal(await credit(eventOcc), 3);
      assert.equal((await events(guru)).attendance[0]!.creditedJtm, "3.0000");
      await rejected(
        () =>
          programs.journal(guru, {
            attendanceId,
            version: "2",
            description: "Duplikat",
          }),
        "DUPLICATE_JOURNAL",
      );
      await rejected(
        () =>
          programs.attendance(admin, {
            operation: "cancel",
            attendanceId,
            version: "2",
            reason,
          }),
        "ACTIVITY_REFERENCED",
      );
    },
  );
  await t.test(
    "EV04 H-1 flag and 80 percent weight, older day rejected",
    async () => {
      const a = (await programs.attendance(admin, {
        operation: "attend",
        eventId,
        date,
        userId: otherId,
        timeIn: "10:30",
        reason,
      })) as { id: string };
      await db.exec(
        "create or replace function app.activity_today() returns date language sql set search_path=pg_catalog as $$ select date '2090-01-03' $$",
      );
      await rejected(
        () =>
          programs.journal(other, {
            attendanceId: a.id,
            version: "1",
            description: "Hari kemarin",
          }),
        "H1_DISABLED",
      );
      await db.exec(
        "insert into app.system_settings(key,typed_value) values('allow_h_minus_1_journal','true') on conflict(key) do update set typed_value='true'",
      );
      await programs.journal(other, {
        attendanceId: a.id,
        version: "1",
        description: "Hari kemarin",
      });
      const oid = (
        await db.query<{ id: string }>(
          "select id from app.activity_occurrences where event_attendance_id=$1",
          [a.id],
        )
      ).rows[0]!.id;
      assert.equal(await credit(oid), 2.4);
      await db.exec(
        "create or replace function app.activity_today() returns date language sql set search_path=pg_catalog as $$ select date '2090-01-02' $$",
      );
    },
  );
  await t.test(
    "EV08 valid master edits preserve old journal snapshots and cannot invalidate attendance",
    async () => {
      const data = {
        name: "Rapat guru diperbarui",
        type: "insidental",
        days: [],
        dates: [date],
        dateStart: date,
        dateEnd: "2090-01-05",
        timeStart: "10:00",
        timeEnd: "11:00",
        jtm: 9,
        description: "Perubahan definisi",
      };
      await programs.saveEvent(admin, {
        id: eventId,
        version: "1",
        reason,
        data,
      });
      assert.equal(await credit(eventOcc), 3);
      await rejected(
        () =>
          programs.saveEvent(admin, {
            id: eventId,
            version: "2",
            reason,
            data: { ...data, timeStart: "10:20" },
          }),
        "ACTIVITY_REFERENCED",
      );
      assert.equal(
        (await events(guru)).attendance.find((a) => a.id === attendanceId)!
          .creditedJtm,
        "3.0000",
      );
    },
  );
  await t.test(
    "EV05 delete impact, stale preview after attendance, final lock, reversal and retained history",
    async () => {
      const p = await programs.deleteEvent(admin, {
        entity: "event",
        id: eventId,
        reason,
      });
      assert.equal(p.attendance, 2);
      assert.equal(p.journals, 2);
      await db.exec(
        "update finance.period_guards set finalized_at=clock_timestamp() where period_start='2090-01-01'",
      );
      await rejected(
        () =>
          programs.deleteEvent(admin, {
            previewId: p.previewId,
            confirmed: true,
          }),
        "FINAL_PERIOD",
      );
      await db.exec(
        "update finance.period_guards set finalized_at=NULL where period_start='2090-01-01'",
      );
      await programs.deleteEvent(admin, {
        previewId: p.previewId,
        confirmed: true,
      });
      assert.equal(await credit(eventOcc), 0);
      assert.equal((await events()).events.length, 0);
      assert.equal(
        (
          await db.query(
            "select id from app.event_journals where cancelled_at is not null",
          )
        ).rows.length,
        2,
      );
      await rejected(
        () =>
          programs.deleteEvent(admin, {
            previewId: p.previewId,
            confirmed: true,
          }),
        "PREVIEW_STALE",
      );
    },
  );
  await t.test(
    "EV06 ledger immutable, runtime cannot forge evidence and audit contains no session",
    async () => {
      await rejected(
        () =>
          business.query(
            "insert into app.exam_baps(occurrence_id) values($1)",
            [supOcc],
          ),
        "permission denied",
      );
      await rejected(
        () => db.exec("update finance.jtm_ledger set jtm=100"),
        "LEDGER_IMMUTABLE",
      );
      const audit = JSON.stringify(
        (await db.query("select * from ops.activity_revisions")).rows,
      );
      assert.ok(!audit.includes(admin));
      assert.ok(!audit.includes(guru));
    },
  );
  await t.test(
    "EV07 recurring dates, H-2/future gates and journal/ledger failure rolls back every effect",
    async () => {
      const recurring = (await programs.saveEvent(admin, {
        version: "0",
        reason,
        data: {
          name: "Acara rutin Selasa",
          type: "rutin",
          days: [2],
          dates: [],
          dateStart: date,
          dateEnd: "2090-01-05",
          timeStart: "10:00",
          timeEnd: "11:00",
          jtm: 2,
          description: "",
        },
      })) as { id: string };
      assert.equal(
        (
          await db.query<{ v: boolean }>(
            "select app.event_occurs($1,$2::date) v",
            [recurring.id, date],
          )
        ).rows[0]!.v,
        false,
      );
      assert.equal(
        (
          await db.query<{ v: boolean }>(
            "select app.event_occurs($1,$2::date) v",
            [recurring.id, "2090-01-03"],
          )
        ).rows[0]!.v,
        true,
      );
      const ev = (await programs.saveEvent(admin, {
        version: "0",
        reason,
        data: {
          name: "Acara uji atomik",
          type: "insidental",
          days: [],
          dates: [date],
          dateStart: date,
          dateEnd: date,
          timeStart: "10:00",
          timeEnd: "11:00",
          jtm: 2,
          description: "",
        },
      })) as { id: string };
      const ea = (await programs.attendance(admin, {
        operation: "attend",
        eventId: ev.id,
        date,
        userId: guruId,
        timeIn: "10:10",
        reason,
      })) as { id: string };
      await db.exec(
        "create or replace function app.activity_today() returns date language sql set search_path=pg_catalog as $$ select date '2090-01-04' $$",
      );
      await rejected(
        () =>
          programs.journal(guru, {
            attendanceId: ea.id,
            version: "1",
            description: "Terlambat",
          }),
        "DATE_EXPIRED",
      );
      await db.exec(
        "create or replace function app.activity_today() returns date language sql set search_path=pg_catalog as $$ select date '2090-01-01' $$",
      );
      await rejected(
        () =>
          programs.journal(guru, {
            attendanceId: ea.id,
            version: "1",
            description: "Mendatang",
          }),
        "FUTURE_DATE",
      );
      await db.exec(
        "create or replace function app.activity_today() returns date language sql set search_path=pg_catalog as $$ select date '2090-01-02' $$",
      );
      const preview = await programs.deleteEvent(admin, {
        entity: "event",
        id: ev.id,
        reason,
      });
      await db.exec(
        "create function public.stage5_injected_failure() returns trigger language plpgsql as $$ begin if NEW.source_kind='EVENT' then raise exception 'TEST_LEDGER_FAILURE';end if;return NEW;end $$;create trigger stage5_failure before insert on finance.jtm_ledger for each row execute function public.stage5_injected_failure()",
      );
      await rejected(
        () =>
          programs.journal(guru, {
            attendanceId: ea.id,
            version: "1",
            description: "Percobaan pertama",
          }),
        "TEST_LEDGER_FAILURE",
      );
      assert.equal(
        (
          await db.query(
            "select id from app.event_journals where attendance_id=$1",
            [ea.id],
          )
        ).rows.length,
        0,
      );
      assert.equal(
        (
          await db.query<{ v: string | null }>(
            "select snapshot_jtm::text v from app.event_attendance where id=$1",
            [ea.id],
          )
        ).rows[0]!.v,
        null,
      );
      await db.exec(
        "drop trigger stage5_failure on finance.jtm_ledger;drop function public.stage5_injected_failure()",
      );
      await programs.journal(guru, {
        attendanceId: ea.id,
        version: "1",
        description: "Berhasil setelah kegagalan rollback",
      });
      await rejected(
        () =>
          programs.deleteEvent(admin, {
            previewId: preview.previewId,
            confirmed: true,
          }),
        "PREVIEW_STALE",
      );
    },
  );
  await t.test(
    "HTTP verified sessions, origin/CSRF/method and bounded strict payloads",
    async () => {
      const config = {
        appUrl: "https://school.example",
        sessionSecret: randomBytes(40).toString("hex"),
        production: true,
        vercel: true,
      };
      const handler = createProgramHandler({
        config: () => config,
        auth: async () => auth,
        service: async () => programs,
        rate: async () =>
          new AccountLifecycleService(authDb, passwords, {
            hmac: config.sessionSecret,
            encryptionKey: randomBytes(32).toString("hex"),
            appUrl: config.appUrl,
          }),
      });
      const req = (
        token?: string,
        method = "GET",
        origin = config.appUrl,
        body: unknown = {},
      ) =>
        new Request(
          config.appUrl + "/api/programs/read?domain=events&date=" + date,
          {
            method,
            headers: {
              origin,
              "content-type": "application/json",
              "x-vercel-forwarded-for": "192.0.2.18",
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
            },
            ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
          },
        );
      assert.equal((await handler("read", req())).status, 401);
      assert.equal((await handler("read", req(onboard))).status, 403);
      assert.equal(
        (await handler("event-save", req(admin, "POST", "https://evil.test")))
          .status,
        403,
      );
      assert.equal((await handler("exam-save", req(admin))).status, 405);
      const response = await handler("read", req(guru));
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("Cache-Control"), "no-store");
      const raw = JSON.stringify(await response.json());
      assert.ok(!raw.includes(admin));
      assert.ok(!raw.includes("password_hash"));
      const bad = await handler(
        "bap",
        req(admin, "POST", config.appUrl, {
          occurrenceId: supOcc,
          operation: "create",
          version: "0",
          present: 0,
          absent: 0,
          notes: "",
          userId: guruId,
        }),
      );
      assert.equal(bad.status, 422);
    },
  );
  await t.test(
    "Native rollback probe also passes the disposable SQL engine and leaves no probe users",
    async () => {
      await db.exec(
        await readFile("docs/verification/stage-5-native-rollback.sql", "utf8"),
      );
      assert.equal(
        (
          await db.query(
            "select id from app.app_users where username like 'stage5probe.%'",
          )
        ).rows.length,
        0,
      );
    },
  );
});
