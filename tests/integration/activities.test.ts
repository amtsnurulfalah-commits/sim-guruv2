import { attendanceSchema, attendanceListSchema, attendancePreviewSchema, attendanceTemplatesSchema } from "../../src/lib/activities/attendance-contracts";
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
import { CalendarService } from "../../src/server/calendar/service";
import { ScheduleService } from "../../src/server/schedules/service";
import { journalSchema, journalListSchema, journalOptionsSchema, eligibleJournalsSchema, journalBlocksSchema } from "../../src/lib/activities/journal-contracts";
import { confirmationListSchema, verifyConfirmationResult } from "../../src/lib/activities/confirmation-contracts";
import { studentProgressSchema, studentSavedSchema, verifyStudentList } from "../../src/lib/activities/student-contracts";
import { ActivityService } from "../../src/server/activities/service";
import { createActivityHandler } from "../../src/server/activities/http";
import { AccountLifecycleService } from "../../src/server/accounts/lifecycle";
import { issueCsrf } from "../../src/server/auth/security";
import type {
  Attendance,
  Journal,
  Occurrence,
  List,
} from "../../src/lib/activities/schemas";
const password = "H9!vL4#qT8@bP2$wF7&z";
test("Tahap 3 — occurrences, attendance, students and atomic JTM journals", async (t) => {
  const db = await openPgliteDatabase();
  t.after(() => db.close());
  const migrations = await readMigrations("supabase/migrations");
  await applyMigrations(db, migrations.slice(0, -1));
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
      assert.equal((await applyMigrations(db, migrations)).length, 1);
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
  const service = new ActivityService(business),
    masters = new MasterService(business),
    schedules = new ScheduleService(business),
    reason = "Pengujian kegiatan sintetis",
    date = "2090-01-02";
  const command = async <T = unknown>(
    token: string,
    k: string,
    data: unknown,
  ) => (await service.command(token, k, data)) as T;
  const read = async <T = unknown>(
    token: string,
    k: string,
    data: unknown = {},
  ) => (await service.read(token, k, data)) as T;
  const filter = { from: date, to: date };
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
  const create = async (
    dayIndex: number,
    classId: string,
    userId: string,
    timeStart: string,
  ) =>
    schedules.save(admin, undefined, {
      reason,
      data: {
        academicPeriodId: period.id,
        userId,
        subjectId: subject.id,
        classId,
        dayIndex,
        timeStart,
        scheduledJtm: "3",
        restMinutes: 0,
        validFrom: "2090-01-01",
        validTo: "2090-01-31",
      },
    });
  const schedule = await create(1, c1.id, guruId, "07:30");
  await create(1, c2.id, otherId, "10:00");
  await create(0, c1.id, guruId, "07:30");
  // Explicit Sunday override for the H-1 fixture.
  const calendar = new CalendarService(business);
  const preview = await calendar.preview(admin, "context", {
    action: "override",
    date: "2090-01-01",
    version: "0",
    academicPeriodId: period.id,
    kbmEnabled: true,
    examEnabled: false,
    reason,
  });
  await calendar.commit(
    admin,
    "context",
    { previewId: preview.previewId },
    "context",
  );
  let o: Occurrence, attendance: Attendance, journal: Journal;
  const occurrences = () =>
    read<{ items: Occurrence[] }>(admin, "occurrences", { date });
  await t.test(
    "A02 occurrence identity is source/date scoped, snapshots stable, owner-scoped list",
    async () => {
      const all = await occurrences();
      confirmationListSchema.parse(all);
      assert.equal(all.items.length, 2);
      o = all.items.find((x) => x.userId === guruId)!;
      assert.equal(o.scheduledJtm, "3.0000");
      assert.equal(
        (await occurrences()).items.find((x) => x.id === o.id)?.id,
        o.id,
      );
      assert.equal(
        (await read<{ items: Occurrence[] }>(guru, "occurrences", { date }))
          .items.length,
        1,
      );
      assert.equal(
        (await read<{ items: Occurrence[] }>(other, "occurrences", { date }))
          .items[0]?.classId,
        c2.id,
      );
    },
  );
  await t.test(
    "A03 claim is private and gives no confirmation or JTM; forged actor fields rejected",
    async () => {
      o = await command<Occurrence>(guru, "claim", {
        occurrenceId: o.id,
        version: o.version,
        reason,
      });
      assert.equal(o.claimed, true);
      assert.equal(o.confirmed, false);
      assert.equal(
        (await db.query("select id from finance.jtm_ledger")).rows.length,
        0,
      );
      await assert.rejects(
        () =>
          command(guru, "confirm", {
            occurrenceId: o.id,
            version: o.version,
            reason,
          }),
        /FORBIDDEN/,
      );
      await assert.rejects(() =>
        command(guru, "claim", {
          occurrenceId: o.id,
          version: o.version,
          reason,
          userId: otherId,
        }),
      );
    },
  );
  await t.test(
    "A04 admin confirmation is separate, versioned and occurrence-scoped",
    async () => {
      await assert.rejects(
        () =>
          command(guru, "journal-create", {
            occurrenceId: o.id,
            material: "Sel",
            present: 28,
            absent: 2,
            notes: "",
            reason,
          }),
        /NO_ACTIVE_CONFIRMATION/,
      );
      const before = confirmationListSchema.parse(await occurrences()).items.find(row => row.id === o.id)!;
      o = await command<Occurrence>(admin, "confirm", {
        occurrenceId: o.id,
        version: o.version,
        reason,
      });
      verifyConfirmationResult(o, before, "confirm");
      assert.equal(o.confirmed, true);
      const all = await occurrences();
      assert.equal(all.items.filter((x) => x.confirmed).length, 1);
      await assert.rejects(
        () =>
          command(admin, "revoke", {
            occurrenceId: o.id,
            version: "1",
            reason,
          }),
        /VERSION_CONFLICT/,
      );
    },
  );
  await t.test(
    "A05 snapshots protect same-day schedule and calendar mutation",
    async () => {
      await assert.rejects(
        () =>
          schedules.stop(admin, schedule.schedule.id, {
            version: schedule.schedule.version,
            stopFrom: date,
            reason,
          }),
        /ACTIVITY_REFERENCED/,
      );
      await assert.rejects(() =>
        db.query(
          "update app.day_context_overrides set kbm_enabled=false where date='2090-01-01'",
        ),
      );
    },
  );
  await t.test(
    "A06 template preview lists distinct assigned gurus and apply is once-only",
    async () => {
      await command(admin, "template-save", {
        dayIndex: 1,
        type: "KBM",
        timeIn: "07:30",
        timeOut: "14:00",
        version: "0",
        reason,
      });
      const t = (await read<{ items: { id: string }[] }>(admin, "templates"))
        .items[0]!;
      const p = await command<{ previewId: string; participants: unknown[] }>(
        admin,
        "template-preview",
        { date, templateId: t.id },
      );
      attendancePreviewSchema.parse(p);
      attendanceTemplatesSchema.parse(await read(admin,"templates"));
      attendanceListSchema.parse(await read(admin,"attendance",filter));
      assert.equal(p.participants.length, 2);
      await command(admin, "template-apply", {
        previewId: p.previewId,
        reason,
      });
      await assert.rejects(
        () =>
          command(admin, "template-apply", { previewId: p.previewId, reason }),
        /PREVIEW_STALE/,
      );
      assert.equal(
        (await read<List<Attendance>>(admin, "attendance", filter)).items
          .length,
        2,
      );
    },
  );
  await t.test(
    "A07 one daily row, admin provenance, self/other denial, stale version rejected",
    async () => {
      attendance = (await read<List<Attendance>>(guru, "attendance", filter))
        .items[0]!;
      attendance = await command<Attendance>(admin, "manual", {
        userId: guruId,
        date,
        scheduledIn: "07:00",
        scheduledOut: "14:00",
        actualIn: "07:00",
        actualOut: "15:00",
        extra: false,
        version: attendance.version,
        reason,
      });
      attendanceSchema.parse(attendance);
      assert.equal(attendance.source, "admin");
      assert.equal(Number(attendance.ratio), 1);
      assert.equal(
        (
          await db.query(
            "select id from app.daily_attendance where user_id=$1 and date=$2",
            [guruId, date],
          )
        ).rows.length,
        1,
      );
      await assert.rejects(
        () =>
          command(other, "leave", {
            attendanceId: attendance.id,
            version: attendance.version,
            leaveTime: "08:00",
            returnTime: "09:00",
            reason,
          }),
        /NOT_FOUND/,
      );
      await assert.rejects(
        () =>
          command(guru, "manual", {
            userId: guruId,
            date,
            scheduledIn: null,
            scheduledOut: null,
            actualIn: null,
            actualOut: null,
            extra: false,
            version: attendance.version,
            reason,
          }),
        /FORBIDDEN/,
      );
    },
  );
  await t.test(
    "A08 clipped izin, adjacent intervals, overlap and reverse interval denied",
    async () => {
      attendance = await command<Attendance>(guru, "leave", {
        attendanceId: attendance.id,
        version: attendance.version,
        leaveTime: "06:00",
        returnTime: "08:00",
        reason,
      });
      assert.equal(Number(attendance.effectiveMinutes), 420);
      attendance = await command<Attendance>(guru, "leave", {
        attendanceId: attendance.id,
        version: attendance.version,
        leaveTime: "08:00",
        returnTime: "09:00",
        reason,
      });
      assert.equal(Number(attendance.effectiveMinutes), 360);
      await assert.rejects(
        () =>
          command(guru, "leave", {
            attendanceId: attendance.id,
            version: attendance.version,
            leaveTime: "08:30",
            returnTime: "10:00",
            reason,
          }),
        /LEAVE_OVERLAP/,
      );
      await assert.rejects(() =>
        command(guru, "leave", {
          attendanceId: attendance.id,
          version: attendance.version,
          leaveTime: "10:00",
          returnTime: "09:00",
          reason,
        }),
      );
    },
  );
  await t.test(
    "A09 deleting izin recalculates effective duration and stale write fails",
    async () => {
      const old = attendance.version;
      attendance = await command<Attendance>(guru, "delete-leave", {
        attendanceId: attendance.id,
        version: attendance.version,
        leaveId: attendance.leaves[1]!.id,
        reason,
      });
      assert.equal(Number(attendance.effectiveMinutes), 420);
      await assert.rejects(
        () =>
          command(guru, "delete-leave", {
            attendanceId: attendance.id,
            version: old,
            leaveId: attendance.leaves[0]!.id,
            reason,
          }),
        /VERSION_CONFLICT/,
      );
    },
  );
  await t.test(
    "A10 extra attendee must be a guru with reason; no ordinary empty schedule creates 100%",
    async () => {
      await assert.rejects(
        () =>
          command(admin, "manual", {
            userId: adminId,
            date,
            scheduledIn: null,
            scheduledOut: null,
            actualIn: "07:00",
            actualOut: "08:00",
            extra: true,
            version: "0",
            reason,
          }),
        /ACTIVITY_INVALID/,
      );
      const empty = await db.query<{ id: string }>(
        "insert into app.daily_attendance(user_id,date) values($1,'2090-01-03') returning id",
        [otherId],
      );
      const v = (
        await read<List<Attendance>>(other, "attendance", {
          from: "2090-01-03",
          to: "2090-01-03",
        })
      ).items[0]!;
      assert.equal(v.id, empty.rows[0]!.id);
      assert.equal(Number(v.ratio), 0);
    },
  );
  await t.test(
    "A11 stale template preview cannot overwrite actual times",
    async () => {
      const t = (await read<{ items: { id: string }[] }>(admin, "templates"))
        .items[0]!;
      const p = await command<{ previewId: string }>(
        admin,
        "template-preview",
        { date, templateId: t.id },
      );
      await command<Attendance>(guru, "leave", {
        attendanceId: attendance.id,
        version: attendance.version,
        leaveTime: "12:00",
        returnTime: "12:10",
        reason,
      });
      attendance = (await read<List<Attendance>>(guru, "attendance", filter))
        .items[0]!;
      await assert.rejects(
        () =>
          command(admin, "template-apply", { previewId: p.previewId, reason }),
        /PREVIEW_STALE/,
      );
      assert.equal(attendance.actualIn, "07:00");
    },
  );
  const recap = (classId: string) => ({
    classId,
    date,
    hadir: 28,
    sakit: 1,
    izin: 1,
    alpa: 0,
    version: "0",
    reason,
  });
  await t.test(
    "A12 standard and integer rekap validation; extra class cannot cover missing required class",
    async () => {
      await assert.rejects(
        () => command(admin, "students-save", { ...recap(c1.id), hadir: 27 }),
        /STUDENT_COUNT_MISMATCH/,
      );
      await assert.rejects(() =>
        command(admin, "students-save", { ...recap(c1.id), hadir: 28.5 }),
      );
      studentSavedSchema.parse(await command(admin, "students-save", recap(c1.id)));
      await command(admin, "students-save", recap(extraClass.id));
      const p = await read<{
        complete: boolean;
        requiredCount: number;
        completedCount: number;
      }>(admin, "students-progress", { date });
      studentProgressSchema.parse(p);
      const rows = verifyStudentList(await read(admin,"students",{...filter,page:1,pageSize:100}),{...filter,page:1,pageSize:100,admin:true,userId:adminId});
      assert.ok(rows.items.some(row => row.class_id === c1.id && row.submitted_by === adminId));
      assert.equal(p.requiredCount, 2);
      assert.equal(p.completedCount, 1);
      assert.equal(p.complete, false);
      await command(admin, "students-save", recap(c2.id));
      assert.equal(
        (
          await read<{ complete: boolean }>(admin, "students-progress", {
            date,
          })
        ).complete,
        true,
      );
    },
  );
  await t.test(
    "A13 unassigned guru cannot write rekap or read another submitter history",
    async () => {
      await assert.rejects(
        () => command(guru, "students-save", recap(c1.id)),
        /FORBIDDEN/,
      );
      assert.equal(
        (await read<List<unknown>>(guru, "students", filter)).items.length,
        0,
      );
    },
  );
  const journalData = () => ({
    occurrenceId: o.id,
    material: "Struktur sel",
    present: 28,
    absent: 2,
    notes: "Diskusi kelompok",
    reason,
  });
  await t.test(
    "A14 journal counts bind both expected students and recap",
    async () => {
      await assert.rejects(
        () =>
          command(guru, "journal-create", {
            ...journalData(),
            present: 29,
            absent: 1,
          }),
        /STUDENT_ATTENDANCE_MISMATCH/,
      );
      await assert.rejects(
        () =>
          command(guru, "journal-create", { ...journalData(), present: 27 }),
        /STUDENT_COUNT_MISMATCH/,
      );
    },
  );
  await t.test(
    "A15 repeated/concurrent promise submissions produce one journal and one credit",
    async () => {
      const result = await Promise.allSettled([
        command<Journal>(guru, "journal-create", journalData()),
        command<Journal>(guru, "journal-create", journalData()),
      ]);
      assert.equal(result.filter((x) => x.status === "fulfilled").length, 1);
      journal = (
        result.find(
          (x) => x.status === "fulfilled",
        ) as PromiseFulfilledResult<Journal>
      ).value;
      assert.equal(journal.creditedJtm, "3.0000");
      assert.equal(
        (
          await db.query(
            "select id from finance.jtm_ledger where source_kind='KBM'",
          )
        ).rows.length,
        1,
      );
    },
  );
  await t.test(
    "A16 revoke with journal blocked; wrong owner has no access",
    async () => {
      await assert.rejects(
        () =>
          command(admin, "revoke", {
            occurrenceId: o.id,
            version: o.version,
            reason,
          }),
        /ACTIVITY_REFERENCED/,
      );
      await assert.rejects(
        () =>
          command(other, "journal-edit", {
            journalId: journal.id,
            version: journal.version,
            material: "X",
            present: 28,
            absent: 2,
            notes: "",
            reason,
          }),
        /NOT_FOUND/,
      );
      assert.equal(
        (await read<List<Journal>>(other, "journals", filter)).items.length,
        0,
      );
    },
  );
  await t.test(
    "A17 edit reverses original posting, reposts once, no net inflation",
    async () => {
      journal = await command<Journal>(guru, "journal-edit", {
        journalId: journal.id,
        version: journal.version,
        material: "Sel dan jaringan",
        present: 28,
        absent: 2,
        notes: "Revisi materi",
        reason,
      });
      const r = await db.query<{ net: string; n: number }>(
        "select sum(jtm)::text net,count(*)::int n from finance.jtm_ledger where journal_id=$1",
        [journal.id],
      );
      assert.equal(r.rows[0]!.net, "3.0000");
      assert.equal(r.rows[0]!.n, 3);
      await assert.rejects(
        () =>
          command(guru, "journal-edit", {
            journalId: journal.id,
            version: "1",
            material: "X",
            present: 28,
            absent: 2,
            notes: "",
            reason,
          }),
        /VERSION_CONFLICT/,
      );
    },
  );
  await t.test("journal reflection persists and old clients preserve content with unchanged net JTM", async () => {
    const initial = journalSchema.parse(journal);
    assert.equal(initial.reflection, "");
    assert.ok(initial.periodLabel); assert.match(initial.timeStart!, /^\d{2}:\d{2}$/);
    const { occurrenceId: _occurrenceId, ...legacyFields } = journalData();
    void _occurrenceId;
    const fields = { learningObjectives: "Mengidentifikasi struktur sel", obstacles: "Kesulitan membedakan sel", followUp: "Latihan diagram", reflection: "Diagram membantu pemahaman" };
    journal = await command<Journal>(guru, "journal-edit", { ...legacyFields, journalId: journal.id, version: journal.version, ...fields });
    for (const [key, text] of Object.entries(fields)) assert.equal(journalSchema.parse(journal)[key as keyof typeof fields], text);
    journal = await command<Journal>(guru, "journal-edit", { ...legacyFields, journalId: journal.id, version: journal.version });
    assert.equal(journalSchema.parse(journal).reflection, fields.reflection);
    assert.equal((await db.query<{ net: string }>("select sum(jtm)::text net from finance.jtm_ledger where journal_id=$1", [journal.id])).rows[0]!.net, "3.0000");
    const revisions = await db.query<{ reflection: string }>("select new_data->>'reflection' reflection from ops.activity_revisions where entity_id=$1 order by created_at desc limit 1", [journal.id]);
    assert.equal(revisions.rows[0]!.reflection, fields.reflection);
  });
  await t.test("journal UI contracts match scoped SQL DTOs without changing exact credits", async () => {
    assert.equal(journalSchema.parse(journal).creditedJtm,"3.0000");
    const list=journalListSchema.parse(await service.read(guru,"journals",filter));
    assert.equal(list.items.length,1);assert.equal(list.pageSize,25);
    assert.equal(journalOptionsSchema.parse(await service.read(admin,"options",{})).h1Enabled,false);
    const eligible=eligibleJournalsSchema.parse(await service.read(guru,"eligible",{date}));
    assert.ok(eligible.items.every(row=>row.userId===guruId));
    journalBlocksSchema.parse(await service.read(admin,"blocks",{}));
  });
  await t.test(
    "A18 rekap edits cannot contradict existing journals",
    async () => {
      const recapRow = (
        await read<List<{ class_id: string; version: string }>>(
          admin,
          "students",
          filter,
        )
      ).items.find((x) => x.class_id === c1.id)!;
      await assert.rejects(
        () =>
          command(admin, "students-save", {
            ...recap(c1.id),
            version: recapRow.version,
            hadir: 29,
            sakit: 0,
          }),
        /STUDENT_ATTENDANCE_MISMATCH/,
      );
    },
  );
  await t.test(
    "A19 block is enforced by direct service edit; no reversal on failure",
    async () => {
      await command(admin, "block", {
        subjectId: subject.id,
        dateStart: date,
        dateEnd: date,
        message: "Penutupan jurnal untuk uji",
        active: true,
        version: "0",
        reason,
      });
      await assert.rejects(
        () =>
          command(guru, "journal-edit", {
            journalId: journal.id,
            version: journal.version,
            material: "Ditolak",
            present: 28,
            absent: 2,
            notes: "",
            reason,
          }),
        /JOURNAL_BLOCKED/,
      );
      assert.equal(
        (
          await db.query<{ net: string }>(
            "select sum(jtm)::text net from finance.jtm_ledger",
          )
        ).rows[0]!.net,
        "3.0000",
      );
      const b = (
        await read<{ items: { id: string; version: string }[] }>(
          admin,
          "blocks",
        )
      ).items[0]!;
      await command(admin, "block", {
        id: b.id,
        subjectId: subject.id,
        dateStart: date,
        dateEnd: date,
        message: "Blok selesai diuji",
        active: false,
        version: b.version,
        reason,
      });
    },
  );
  await t.test(
    "A20 delete performs exact once reversal and preserves history",
    async () => {
      await command(guru, "journal-delete", {
        journalId: journal.id,
        version: journal.version,
        reason,
      });
      assert.equal(
        (
          await db.query<{ net: string }>(
            "select sum(jtm)::text net from finance.jtm_ledger",
          )
        ).rows[0]!.net,
        "0.0000",
      );
      assert.equal(
        (await read<List<Journal>>(guru, "journals", filter)).items.length,
        0,
      );
      await assert.rejects(
        () =>
          command(guru, "journal-delete", {
            journalId: journal.id,
            version: journal.version,
            reason,
          }),
        /NOT_FOUND/,
      );
    },
  );
  await t.test(
    "A21 H-1 disabled/confirmation checks and 3×80%=2.4 applied once",
    async () => {
      await read(admin, "occurrences", { date: "2090-01-01" });
      const yesterday = (
        await read<{ items: Occurrence[] }>(guru, "eligible", {
          date: "2090-01-01",
        })
      ).items[0]!;
      assert.equal(yesterday.eligibilityError, "H1_DISABLED");
      await command(admin, "h1", { enabled: true, reason });
      assert.equal(
        (
          await read<{ items: Occurrence[] }>(guru, "eligible", {
            date: "2090-01-01",
          })
        ).items[0]!.eligibilityError,
        "H1_NOT_CONFIRMED",
      );
      await db.query(
        "insert into app.activity_confirmations(assignment_id,confirmed_by,reason) values($1,$2,$3)",
        [yesterday.assignmentId, adminId, reason],
      );
      const h = await command<Journal>(guru, "journal-create", {
        ...journalData(),
        occurrenceId: yesterday.id,
      });
      assert.equal(h.creditedJtm, "2.4000");
      assert.equal(h.inputType, "H_MINUS_1");
      const edit = await command<Journal>(guru, "journal-edit", {
        journalId: h.id,
        version: h.version,
        material: "Revisi H-1",
        present: 28,
        absent: 2,
        notes: "",
        reason,
      });
      assert.equal(edit.creditedJtm, "2.4000");
    },
  );
  await t.test(
    "A22 final month blocks journal/delete/attendance; ledger remains immutable",
    async () => {
      await db.exec(
        "update finance.period_guards set finalized_at=clock_timestamp() where period_start='2090-01-01'",
      );
      const h = (
        await read<List<Journal>>(guru, "journals", {
          from: "2090-01-01",
          to: date,
        })
      ).items[0]!;
      await assert.rejects(
        () =>
          command(guru, "journal-delete", {
            journalId: h.id,
            version: h.version,
            reason,
          }),
        /FINAL_PERIOD/,
      );
      await assert.rejects(
        () =>
          command(guru, "leave", {
            attendanceId: attendance.id,
            version: attendance.version,
            leaveTime: "13:00",
            returnTime: "13:10",
            reason,
          }),
        /FINAL_PERIOD/,
      );
      await db.exec("update finance.period_guards set finalized_at=null");
    },
  );
  await t.test(
    "A23 direct DML, helpers, hashes and worker access denied",
    async () => {
      for (const role of [
        "sim_guru_business",
        "sim_guru_auth",
        "sim_guru_worker",
      ]) {
        const limited = scope(role);
        await assert.rejects(() =>
          limited.query("select * from finance.jtm_ledger"),
        );
        await assert.rejects(() =>
          limited.query("select app.ensure_occurrences('2090-01-02')"),
        );
        await assert.rejects(() =>
          limited.query("select * from app.daily_attendance"),
        );
      }
    },
  );
  await t.test(
    "A24 exports retain complete server scope; filters cannot widen guru ownership",
    async () => {
      const rows = await service.exportRows(guru, "journals", {
        from: "2090-01-01",
        to: date,
        pageSize: 1,
      });
      assert.equal(rows.length, 1);
      assert.equal(rows[0]!.userId, guruId);
      assert.equal(
        (
          await service.exportRows(other, "journals", {
            from: "2090-01-01",
            to: date,
            userId: guruId,
          })
        ).length,
        0,
      );
    },
  );
  await t.test(
    "A26 H-2 and future dates use same eligibility as submit",
    async () => {
      try {
        await db.exec(
          "create or replace function app.activity_today() returns date language sql stable set search_path=pg_catalog as $$ select date '2090-01-04' $$",
        );
        const v = await read<{ items: Occurrence[] }>(guru, "eligible", {
          date,
        });
        assert.equal(
          v.items.find((x) => x.id === o.id)?.eligibilityError,
          "DATE_EXPIRED",
        );
        await assert.rejects(
          () => command(guru, "journal-create", journalData()),
          /DATE_EXPIRED/,
        );
        await db.exec(
          "create or replace function app.activity_today() returns date language sql stable set search_path=pg_catalog as $$ select date '2090-01-01' $$",
        );
        await assert.rejects(
          () => command(guru, "journal-create", journalData()),
          /FUTURE_DATE/,
        );
      } finally {
        await db.exec(
          "create or replace function app.activity_today() returns date language sql stable set search_path=pg_catalog as $$ select date '2090-01-02' $$",
        );
      }
    },
  );
  await t.test(
    "A27 full export traverses multiple pages and prevents final/ledger tampering",
    async () => {
      await db.query(
        "insert into app.daily_attendance(user_id,date,sched_time_in,sched_time_out,actual_time_in,actual_time_out) select $1,day::date,'07:00','14:00','07:30','14:00' from generate_series('2089-01-01'::date,'2089-05-31'::date,interval '1 day') day",
        [guruId],
      );
      const exported = await service.exportRows(guru, "attendance", {
        from: "2089-01-01",
        to: "2089-05-31",
        pageSize: 1,
      });
      assert.equal(exported.length, 151);
      assert.ok(exported.every((r) => r.userId === guruId));
      await assert.rejects(
        () => db.exec("update finance.jtm_ledger set jtm=99"),
        /LEDGER_IMMUTABLE/,
      );
      await assert.rejects(
        () => db.exec("delete from finance.jtm_ledger"),
        /LEDGER_IMMUTABLE/,
      );
    },
  );
  await t.test(
    "A28 business rate permits normal class entry without consuming OTP quotas",
    async () => {
      const rate = new AccountLifecycleService(authDb, passwords, {
        hmac: randomBytes(40).toString("hex"),
        encryptionKey: randomBytes(32).toString("hex"),
        appUrl: "https://school.example",
      });
      for (let n = 0; n < 20; n++)
        await rate.activityRate("192.0.2.99", guruId);
      await assert.rejects(() =>
        business.query(
          "select auth_private.consume_activity_rate('activity_ip',$1)",
          ["a".repeat(64)],
        ),
      );
    },
  );
  await t.test(
    "A25 HTTP CSRF/origin/onboarding, safe conflicts and revoked sessions",
    async () => {
      const config = {
        appUrl: "https://school.example",
        sessionSecret: randomBytes(40).toString("hex"),
        production: true,
        vercel: true,
      };
      const handler = createActivityHandler({
        config: () => config,
        auth: async () => auth,
        service: async () => service,
        rate: async () =>
          new AccountLifecycleService(authDb, passwords, {
            hmac: config.sessionSecret,
            encryptionKey: randomBytes(32).toString("hex"),
            appUrl: config.appUrl,
          }),
      });
      const request = (
        token?: string,
        method = "GET",
        origin = config.appUrl,
      ) =>
        new Request(
          config.appUrl +
            "/api/activities/attendance?from=" +
            date +
            "&to=" +
            date,
          {
            method,
            headers: {
              origin,
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
            ...(method === "POST" ? { body: "{}" } : {}),
          },
        );
      assert.equal((await handler("attendance", request())).status, 401);
      assert.equal((await handler("attendance", request(onboard))).status, 403);
      assert.equal(
        (await handler("attendance", request(guru, "GET", "https://evil.test")))
          .status,
        403,
      );
      assert.equal(
        (await handler("manual", request(guru, "POST", "https://evil.test")))
          .status,
        403,
      );
      const r = await handler("attendance", request(guru));
      assert.equal(r.status, 200);
      assert.equal(r.headers.get("Cache-Control"), "no-store");
      await auth.logout(other, randomUUID());
      await assert.rejects(
        () => read(other, "attendance", filter),
        /UNAUTHENTICATED/,
      );
    },
  );
});
