import { createOperationsHandler } from "../../src/server/operations/http";
import { AccountLifecycleService } from "../../src/server/accounts/lifecycle";
import { issueCsrf } from "../../src/server/auth/security";
import { MasterService } from "../../src/server/masters/service";
import { ScheduleService } from "../../src/server/schedules/service";
import { ActivityService } from "../../src/server/activities/service";
import { tasksSchema, inboxSchema } from "../../src/lib/tasks/contracts";
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { openPgliteDatabase } from "../helpers/pglite-database";
import { applyMigrations, readMigrations } from "../../scripts/lib/migrations";
import {
  type SqlDatabase,
  type SqlExecutor,
  type SqlParameter,
} from "../../scripts/lib/sql-database";
import { getPasswordService } from "../../src/server/auth/passwords";
import { LocalAuthService } from "../../src/server/auth/service";
import { OperationsService } from "../../src/server/operations/service";

const password = "H9!vL4#qT8@bP2$wF7&z",
  reason = "Pengujian operasional sintetis";
test("Professional stage 2 tasks and personal notification boundaries", async (t) => {
  const db = await openPgliteDatabase();
  t.after(() => db.close());
  await applyMigrations(db, await readMigrations("supabase/migrations"));
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
  const guruId = await fixture("teacher.one", "guru"),
    otherId = await fixture("teacher.two", "guru");

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
    other = await login("teacher.two");
  const service = new OperationsService(business),
    worker = scope("sim_guru_worker");

  await db.exec(
    "create or replace function app.activity_today() returns date language sql stable set search_path=pg_catalog as $$ select date '2090-01-02' $$",
  );
  await db.exec(
    "create or replace function app.exam_now() returns timestamp language sql volatile set search_path=pg_catalog as $$ select timestamp '2090-01-02 12:00' $$",
  );
  const masters = new MasterService(business),
    schedules = new ScheduleService(business),
    activity = new ActivityService(business);
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
  const klass = await masters.save(admin, "classes", {
    version: "0",
    reason,
    data: {
      academicPeriodId: period.id,
      name: "VII",
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
  await schedules.save(admin, undefined, {
    reason,
    data: {
      academicPeriodId: period.id,
      userId: guruId,
      subjectId: subject.id,
      classId: klass.id,
      dayIndex: new Date("2090-01-02T00:00Z").getUTCDay(),
      timeStart: "07:30",
      scheduledJtm: "1",
      restMinutes: 0,
      validFrom: "2090-01-01",
      validTo: "2090-01-31",
    },
  });
  const tasks = async (token: string) =>
    tasksSchema.parse(await service.read(token, "tasks"));
  const inbox = async (token: string, page = 1, unread = false) =>
    inboxSchema.parse(
      await service.read(token, "inbox", { page, unread: String(unread) }),
    );
  let occurrenceId = "";
  await t.test(
    "T01 task identity is stable; owners see prerequisites, other users cannot spoof actor/role",
    async () => {
      const first = await tasks(guru);
      assert.equal(first.items.length, 1);
      assert.equal(first.items[0]!.kind, "journal");
      assert.equal(first.items[0]!.blocked, true);
      occurrenceId = first.items[0]!.source_id;
      assert.deepEqual((await tasks(guru)).items, first.items);
      assert.equal((await tasks(other)).items.length, 0);
      assert.ok(
        (await tasks(admin)).items.some((t) => t.kind === "confirmation"),
      );
      await assert.rejects(
        service.read(other, "tasks", { actorId: guruId, role: "admin" }),
      );
      await assert.rejects(tasks("A".repeat(43)));
    },
  );
  await t.test(
    "T02 canonical confirmation unblocks journal and completed source removes task",
    async () => {
      await activity.command(admin, "confirm", {
        occurrenceId,
        version: "1",
        reason,
      });
      const item = (await tasks(guru)).items[0]!;
      assert.equal(item.id, "journal:" + occurrenceId);
      assert.equal(item.blocked, false);
      assert.equal(item.href, "/jurnal?date=2090-01-02");
      assert.equal(
        Date.parse(item.deadline!),
        Date.parse("2090-01-03T00:00:00+07:00"),
      );
      assert.equal(
        (await tasks(admin)).items.filter((t) => t.kind === "confirmation")
          .length,
        0,
      );
    },
  );
  await t.test(
    "T03 daily digest is idempotent and recipient isolated; read receipt is not task completion",
    async () => {
      await db.query("select ops.reminders()");
      await db.query("select ops.reminders()");
      const n = (
        await db.query<{ n: number }>(
          "select count(*)::int n from ops.domain_outbox where task_keys is not null and recipient_id=$1",
          [guruId],
        )
      ).rows[0]!.n;
      assert.equal(n, 1);
      const mine = await inbox(guru);
      const msg = mine.items.find(
        (m) => m.subject === "Pengingat tugas hari ini",
      )!;
      assert.ok(msg);
      assert.equal(msg.state, "pending");
      assert.ok(!(await inbox(other)).items.some((m) => m.id === msg.id));
      await assert.rejects(
        service.command(other, "notification-read", { id: msg.id }),
        /NOT_FOUND/,
      );
      await service.command(guru, "notification-read", { id: msg.id });
      await service.command(guru, "notification-read", { id: msg.id });
      assert.ok((await inbox(guru)).items.find((m) => m.id === msg.id)?.read);
      assert.equal((await tasks(guru)).items.length, 1);
    },
  );
  await t.test(
    "T04 source completion cancels unsent reminder before worker claim",
    async () => {
      await activity.command(guru, "journal-create", {
        occurrenceId,
        material: "Pembelajaran sintetis",
        present: 30,
        absent: 0,
        notes: "",
        reason,
      });
      assert.equal((await tasks(guru)).items.length, 0);
      await worker.query("select ops.domain_claim()");
      assert.equal(
        (
          await db.query<{ state: string }>(
            "select state from ops.domain_outbox where recipient_id=$1 and task_keys is not null",
            [guruId],
          )
        ).rows[0]!.state,
        "cancelled",
      );
    },
  );
  await t.test(
    "T05 preferences use server actor and CAS; opt-out cancels only domain email and preserves inbox",
    async () => {
      await service.command(guru, "notification-preferences", {
        version: "0",
        emailEnabled: false,
        reminderEmail: false,
      });
      await assert.rejects(
        service.command(guru, "notification-preferences", {
          version: "0",
          emailEnabled: true,
          reminderEmail: true,
        }),
        /VERSION_CONFLICT/,
      );
      await assert.rejects(
        service.command(other, "notification-preferences", {
          version: "0",
          emailEnabled: false,
          reminderEmail: false,
          userId: guruId,
        }),
      );
      await worker.query("select ops.domain_claim()");
      const mine = await inbox(guru);
      assert.equal(mine.preferences.version, "1");
      assert.equal(mine.preferences.emailEnabled, false);
      assert.ok(mine.items.length > 0);
      assert.equal((await inbox(other)).preferences.emailEnabled, true);
    },
  );
  await t.test(
    "T06 FORCE RLS and grants deny direct table/private helper/legacy claim bypass",
    async () => {
      for (const role of [business, authDb, worker]) {
        await assert.rejects(
          role.query("select * from app.notification_preferences"),
        );
        await assert.rejects(
          role.query("select * from app.notification_receipts"),
        );
        await assert.rejects(
          role.query("select * from app.task_items($1)", [guruId]),
        );
      }
      await assert.rejects(worker.query("select ops.stage7_domain_claim()"));
      assert.equal(
        (
          await db.query(
            "select relname from pg_class where relname in('notification_preferences','notification_receipts') and not(relrowsecurity and relforcerowsecurity)",
          )
        ).rows.length,
        0,
      );
    },
  );
  await t.test(
    "T07 inbox stable pagination/unread, malformed input and inactive session rejection",
    async () => {
      for (let n = 0; n < 23; n++)
        await db.query(
          "insert into ops.domain_outbox(dedupe_key,recipient_id,subject,body) values($1,$2,'Information','Synthetic')",
          ["pagination:" + n, otherId],
        );
      const one = await inbox(other, 1),
        two = await inbox(other, 2);
      assert.equal(one.items.length, 20);
      assert.equal(two.items.length, 3);
      assert.ok(!one.items.some((x) => two.items.some((y) => y.id === x.id)));
      await service.command(other, "notification-read", {
        id: one.items[0]!.id,
      });
      assert.equal((await inbox(other, 1, true)).total, 22);
      await assert.rejects(service.read(other, "inbox", { page: 0 }));
      await db.query("update app.app_users set status='disabled' where id=$1", [
        otherId,
      ]);
      await assert.rejects(tasks(other));
      await assert.rejects(inbox(other));
    },
  );
  await t.test(
    "T08 HTTP session/origin/CSRF boundaries protect task reads and notification writes",
    async () => {
      const config = {
        appUrl: "https://school.example",
        sessionSecret: randomBytes(40).toString("hex"),
        production: true,
        vercel: true,
      };
      const handler = createOperationsHandler({
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
      const req = (
        method: string,
        token?: string,
        csrf?: string,
        origin = config.appUrl,
      ) =>
        new Request(config.appUrl + "/api/operations/tasks", {
          method,
          headers: {
            origin,
            "x-vercel-forwarded-for": "192.0.2.18",
            ...(token ? { cookie: "__Host-sim_guru_session=" + token } : {}),
            ...(csrf ? { "x-csrf-token": csrf } : {}),
            "content-type": "application/json",
          },
          ...(method === "POST"
            ? {
                body: JSON.stringify({
                  version: "1",
                  emailEnabled: true,
                  reminderEmail: true,
                }),
              }
            : {}),
        });
      assert.equal((await handler("tasks", req("GET"))).status, 401);
      assert.equal(
        (
          await handler(
            "tasks",
            req("GET", guru, undefined, "https://evil.example"),
          )
        ).status,
        403,
      );
      assert.equal((await handler("tasks", req("GET", guru))).status, 200);
      assert.equal(
        (await handler("notification-preferences", req("POST", guru))).status,
        403,
      );
      const csrf = issueCsrf(config.sessionSecret, "session", guru);
      assert.equal(
        (await handler("notification-preferences", req("POST", guru, csrf)))
          .status,
        200,
      );
    },
  );
  await t.test(
    "T09 recap/attendance/admin tasks reflect source changes and final periods",
    async () => {
      assert.ok((await tasks(admin)).items.some((t) => t.kind === "students"));
      await activity.command(admin, "students-save", {
        classId: klass.id,
        date: "2090-01-02",
        hadir: 30,
        sakit: 0,
        izin: 0,
        alpa: 0,
        version: "0",
        reason,
      });
      assert.ok(!(await tasks(admin)).items.some((t) => t.kind === "students"));
      await db.query(
        "insert into app.daily_attendance(user_id,date,sched_time_in,sched_time_out,actual_time_in,time_in_source) values($1,'2090-01-02','07:00','08:00','07:05','self')",
        [guruId],
      );
      assert.ok((await tasks(guru)).items.some((t) => t.kind === "attendance"));
      await db.query(
        "update app.daily_attendance set actual_time_out='08:00' where user_id=$1",
        [guruId],
      );
      assert.ok(
        !(await tasks(guru)).items.some((t) => t.kind === "attendance"),
      );
      await db.query(
        "insert into ops.job_runs(business_key,kind,state) values('task-test-job','test','failed')",
      );
      assert.ok(
        (await tasks(admin)).items.some((t) => t.id === "job:task-test-job"),
      );
      assert.ok(
        !(await tasks(guru)).items.some((t) => t.kind === "operations"),
      );
      await db.query(
        "update ops.job_runs set state='completed' where business_key='task-test-job'",
      );
      assert.ok(
        !(await tasks(admin)).items.some((t) => t.id === "job:task-test-job"),
      );
      await db.query(
        "insert into finance.period_guards(period_start,finalized_at) values('2090-01-01',clock_timestamp()) on conflict(period_start) do update set finalized_at=excluded.finalized_at",
      );
      assert.ok(!(await tasks(guru)).items.some((t) => t.deadline !== null));
      await db.query(
        "update finance.period_guards set finalized_at=null where period_start='2090-01-01'",
      );
    },
  );
  await t.test(
    "T10 event journal block, cancellation and completion use source state",
    async () => {
      const eid = randomUUID(),
        aid = randomUUID();
      await db.query(
        "insert into app.event_definitions(id,name,type,days,dates,time_start,time_end,jtm,description,date_start,date_end) values($1,'Acara tugas','insidental','{}',ARRAY[date '2090-01-02'],'08:00','09:00',1,'','2090-01-01','2090-01-31')",
        [eid],
      );
      await db.query(
        "insert into app.event_attendance(id,event_id,date,user_id,time_in,recorded_by) select $1,$2,'2090-01-02',$3,'08:00',id from app.app_users where role='admin' limit 1",
        [aid, eid, guruId],
      );
      assert.equal(
        (await tasks(guru)).items.find((t) => t.id === "event-journal:" + aid)
          ?.blocked,
        false,
      );
      await db.query(
        "insert into app.event_journal_blocks(event_id,date_start,date_end,message) values($1,'2090-01-02','2090-01-02','Blok sintetis')",
        [eid],
      );
      assert.equal(
        (await tasks(guru)).items.find((t) => t.id === "event-journal:" + aid)
          ?.blocked,
        true,
      );
      await db.query(
        "update app.event_journal_blocks set active=false where event_id=$1",
        [eid],
      );
      await db.query(
        "update app.event_attendance set cancelled_at=clock_timestamp() where id=$1",
        [aid],
      );
      assert.ok(
        !(await tasks(guru)).items.some((t) => t.id === "event-journal:" + aid),
      );
      await db.query(
        "update app.event_attendance set cancelled_at=null where id=$1",
        [aid],
      );
      await db.query(
        "insert into app.event_journals(attendance_id,description,input_type,weight,credited_jtm) values($1,'Selesai','SAME_DAY',1,1)",
        [aid],
      );
      assert.ok(
        !(await tasks(guru)).items.some((t) => t.id === "event-journal:" + aid),
      );
    },
  );
  await t.test("T12 H-1 policy includes yesterday only while enabled, with exclusive WIB deadline", async () => {
    const eid = randomUUID(), aid = randomUUID();
    await db.query("insert into app.event_definitions(id,name,type,days,dates,time_start,time_end,jtm,description,date_start,date_end) values($1,'Acara H1','insidental','{}',ARRAY[date '2090-01-01'],'08:00','09:00',1,'','2090-01-01','2090-01-31')", [eid]);
    await db.query("insert into app.event_attendance(id,event_id,date,user_id,time_in,recorded_by) select $1,$2,'2090-01-01',$3,'08:00',id from app.app_users where role='admin' limit 1", [aid,eid,guruId]);
    assert.ok(!(await tasks(guru)).items.some(t=>t.id==='event-journal:'+aid));
    await activity.command(admin,"h1",{enabled:true,reason});
    const pending = (await tasks(guru)).items.find(t=>t.id==='event-journal:'+aid)!;
    assert.ok(pending); assert.equal(Date.parse(pending.deadline!), Date.parse('2090-01-03T00:00:00+07:00'));
    await activity.command(admin,"h1",{enabled:false,reason});
    assert.ok(!(await tasks(guru)).items.some(t=>t.id===pending.id));
  });
  await t.test(
    "T11 BAP projection uses exam period deadline and active BAP completion",
    async () => {
      const ep = randomUUID(),
        es = randomUUID(),
        er = randomUUID(),
        ev = randomUUID();
      await db.query(
        "insert into app.exam_periods(id,academic_period_id,name,date_start,date_end,default_committee_jtm) values($1,$2,'Ujian tugas','2090-01-02','2090-01-05',1)",
        [ep, period.id],
      );
      await db.query(
        "insert into app.exam_sessions(id,period_id,date,name,time_start,time_end,scheduled_jtm) values($1,$2,'2090-01-02','Sesi','10:00','11:00',1)",
        [es, ep],
      );
      await db.query(
        "insert into app.exam_rooms(id,session_id,name,subject_id,total_students) values($1,$2,'Ruang', $3,30)",
        [er, es, subject.id],
      );
      await db.query(
        "insert into app.exam_supervisor_assignments(id,exam_room_id,user_id) values($1,$2,$3)",
        [ev, er, guruId],
      );
      await db.query("select app.exam_sync()");
      const item = (await tasks(guru)).items.find((t) => t.kind === "bap")!;
      assert.ok(item);
      assert.equal(item.blocked, true);
      assert.equal(
        Date.parse(item.deadline!),
        Date.parse("2090-01-06T00:00:00+07:00"),
      );
      await db.query(
        "insert into app.exam_baps(occurrence_id,assignment_id,user_id,present,absent,notes) select o.id,a.id,$1,30,0,'' from app.activity_occurrences o join app.activity_assignments a on a.occurrence_id=o.id where o.id=$2",
        [guruId, item.source_id],
      );
      assert.ok(!(await tasks(guru)).items.some((t) => t.id === item.id));
    },
  );
});
