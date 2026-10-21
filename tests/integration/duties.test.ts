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
import { DutyService } from "../../src/server/duties/service";
import type { DutyOccurrence, DutyBoard } from "../../src/lib/duties/schemas";
import { ActivityService } from "../../src/server/activities/service";
import { createDutyHandler } from "../../src/server/duties/http";
import { AccountLifecycleService } from "../../src/server/accounts/lifecycle";
import { issueCsrf } from "../../src/server/auth/security";
import type {
  Attendance,
  Journal,
  Occurrence,
  List,
} from "../../src/lib/activities/schemas";
const password = "H9!vL4#qT8@bP2$wF7&z";
test("Tahap 4 — duties, substitution and JTM conservation", async (t) => {
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
  const duties = new DutyService(business),
    piketId = await fixture("duty.piket", "guru"),
    receiverId = await fixture("duty.receiver", "guru"),
    subId = await fixture("duty.substitute", "guru"),
    ceremonyId = await fixture("duty.ceremony", "guru");
  const piket = await login("duty.piket"),
    receiver = await login("duty.receiver"),
    sub = await login("duty.substitute"),
    ceremony = await login("duty.ceremony");
  const board = (token = admin) => duties.read(token, { date });
  const get = async (id: string) =>
    (await board()).occurrences.find((o) => o.id === id)!;
  const mutate = async (
    token: string,
    id: string,
    operation: string,
    extra: Record<string, unknown> = {},
  ) => {
    const o = await get(id);
    const p = await duties.preview(token, {
      occurrenceId: id,
      version: o.version,
      operation,
      reason,
      ...extra,
    });
    return duties.commit(token, { previewId: p.previewId });
  };
  const net = async (id: string, userId?: string) =>
    (
      await db.query<{ n: string }>(
        "select coalesce(sum(jtm),0)::numeric(12,4)::text n from finance.jtm_ledger where occurrence_id=$1 and ($2::uuid is null or user_id=$2)",
        [id, userId ?? null],
      )
    ).rows[0]!.n;
  const dutyData = (kind: "PIKET" | "UPACARA", userId: string) => ({
    kind,
    userId,
    academicPeriodId: period.id,
    dayIndex: 1,
    date: kind === "UPACARA" ? date : null,
    validFrom: date,
    validTo: kind === "UPACARA" ? date : "2090-01-02",
    timeStart: kind === "UPACARA" ? "07:00" : "07:00",
    timeEnd: kind === "UPACARA" ? "07:20" : "14:00",
    active: true,
    version: "0",
    reason,
  });
  let p: DutyOccurrence, c: DutyOccurrence, k: DutyOccurrence;
  await t.test(
    "D01 admin creates weekly piket and one Monday ceremony; guru/admin-target/Sunday rejected",
    async () => {
      await assert.rejects(
        () => duties.schedule(guru, dutyData("PIKET", guruId)),
        /FORBIDDEN/,
      );
      await assert.rejects(
        () => duties.schedule(admin, dutyData("PIKET", adminId)),
        /DUTY_INVALID/,
      );
      await assert.rejects(() =>
        duties.schedule(admin, {
          ...dutyData("UPACARA", ceremonyId),
          date: "2090-01-03",
          validFrom: "2090-01-03",
          validTo: "2090-01-03",
        }),
      );
      const createdDuty = await duties.schedule(admin, dutyData("PIKET", piketId)) as {id:string;version:string};
      { // Regression: editing piket works; FINAL_PERIOD remains enforced.
        const changed = await duties.schedule(admin, {...dutyData("PIKET",piketId),id:createdDuty.id,version:createdDuty.version,timeStart:"07:20"}) as {id:string;version:string;time_start:string};
        assert.equal(changed.time_start,"07:20:00");
        await db.exec("insert into finance.period_guards(period_start,finalized_at) values('2090-01-01',clock_timestamp()) on conflict(period_start) do update set finalized_at=excluded.finalized_at");
        await assert.rejects(() => duties.schedule(admin,{...dutyData("PIKET",piketId),id:changed.id,version:changed.version}),/FINAL_PERIOD/);
        await db.exec("update finance.period_guards set finalized_at=null where period_start='2090-01-01'");
        await duties.schedule(admin,{...dutyData("PIKET",piketId),id:changed.id,version:changed.version});
      }
      await duties.schedule(admin, dutyData("UPACARA", ceremonyId));
      await assert.rejects(
        () => duties.schedule(admin, dutyData("UPACARA", subId)),
        /duplicate|unique/i,
      );
      const b = await board();
      p = b.occurrences.find((o) => o.kind === "PIKET")!;
      c = b.occurrences.find((o) => o.kind === "UPACARA")!;
      k = b.occurrences.find((o) => o.kind === "KBM" && o.userId === guruId)!;
      assert.equal(b.occurrences.length, 4);
      assert.equal(p.scheduledJtm, "4.0000");
      assert.equal(c.scheduledJtm, "5.0000");
    },
  );
  await t.test(
    "D02 self piket cannot confirm, claim grants no capability or credit",
    async () => {
      await assert.rejects(() => mutate(piket, p.id, "confirm"), /FORBIDDEN/);
      await command(piket, "claim", {
        occurrenceId: p.id,
        version: p.version,
        reason,
      });
      assert.equal((await board(piket)).canOperate, false);
      assert.equal(await net(p.id), "0.0000");
    },
  );
  await t.test(
    "D03 confirmation gives exactly4, no operational right without time-in, replay no duplication",
    async () => {
      p = await mutate(admin, p.id, "confirm");
      assert.equal(await net(p.id), "4.0000");
      assert.equal((await board(piket)).canOperate, false);
      p = await mutate(admin, p.id, "confirm");
      assert.equal(await net(p.id), "4.0000");
      const dto = (await board()).occurrences.find((o) => o.id === p.id)!;
      const v = await duties.preview(admin, {
        occurrenceId: p.id,
        version: dto.version,
        operation: "confirm",
        reason,
      });
      await duties.commit(admin, { previewId: v.previewId });
      await assert.rejects(
        () => duties.commit(admin, { previewId: v.previewId }),
        /PREVIEW_STALE/,
      );
    },
  );
  let pa: Attendance;
  await t.test(
    "D04 admin time-in enables piket; self nonteaching duty attendance cannot be recorded",
    async () => {
      pa = await command<Attendance>(admin, "manual", {
        userId: piketId,
        date,
        scheduledIn: "07:00",
        scheduledOut: "14:00",
        actualIn: null,
        actualOut: null,
        extra: false,
        version: "0",
        reason,
      });
      await assert.rejects(
        () =>
          command(piket, "in", {
            attendanceId: pa.id,
            version: pa.version,
            reason,
          }),
        /FORBIDDEN/,
      );
      pa = await command<Attendance>(admin, "manual", {
        userId: piketId,
        date,
        scheduledIn: "07:00",
        scheduledOut: "14:00",
        actualIn: "07:00",
        actualOut: null,
        extra: false,
        version: pa.version,
        reason,
      });
      assert.equal((await board(piket)).canOperate, true);
    },
  );
  await t.test(
    "D05 effective ceremony owner self-confirms5, unrelated guru cannot revoke",
    async () => {
      c = await mutate(ceremony, c.id, "confirm");
      assert.equal(await net(c.id), "5.0000");
      await assert.rejects(() => mutate(guru, c.id, "revoke"), /FORBIDDEN/);
      await mutate(ceremony, c.id, "revoke");
      assert.equal(await net(c.id), "0.0000");
      c = await mutate(ceremony, c.id, "confirm");
      assert.equal(await net(c.id), "5.0000");
    },
  );
  await t.test(
    "D06 piket operational can confirm KBM and submit rekap; cannot operate own assignment",
    async () => {
      k = await mutate(piket, k.id, "confirm");
      assert.equal(k.confirmed, true);
      await command(piket, "students-save", {
        classId: c1.id,
        date,
        hadir: 28,
        sakit: 1,
        izin: 1,
        alpa: 0,
        version: "0",
        reason,
      });
      const progress = await read<{ requiredCount: number }>(
        piket,
        "students-progress",
        { date },
      );
      assert.equal(progress.requiredCount, 2);
      await assert.rejects(
        () => mutate(piket, p.id, "adjust", { adjustedJtm: "2" }),
        /SELF_OPERATION_FORBIDDEN/,
      );
    },
  );
  let j: Journal;
  await t.test(
    "D07 KBM journal uses exact basis; adjust3→1 reverses and reconciles net1",
    async () => {
      j = await command<Journal>(guru, "journal-create", {
        occurrenceId: k.id,
        material: "Struktur sel",
        present: 28,
        absent: 2,
        notes: "",
        reason,
      });
      assert.equal(await net(k.id), "3.0000");
      k = await mutate(piket, k.id, "adjust", { adjustedJtm: "1" });
      assert.equal(k.adjustedJtm, "1.0000");
      assert.equal(await net(k.id), "1.0000");
      await assert.rejects(
        () =>
          command(guru, "journal-edit", {
            journalId: j.id,
            version: j.version,
            material: "Konflik",
            present: 28,
            absent: 2,
            notes: "",
            reason,
          }),
        /VERSION_CONFLICT/,
      );
    },
  );
  await t.test(
    "D08 multi fractional recipients conserve A+R<=S, excess/precision invalid",
    async () => {
      k = await mutate(piket, k.id, "allocate", {
        userId: receiverId,
        allocatedJtm: "0.0001",
      });
      k = await mutate(piket, k.id, "allocate", {
        userId: subId,
        allocatedJtm: "1.9999",
      });
      assert.equal(k.remainingJtm, "0.0000");
      assert.equal(await net(k.id), "3.0000");
      await assert.rejects(
        () =>
          mutate(piket, k.id, "allocate", {
            userId: ceremonyId,
            allocatedJtm: "0.0001",
          }),
        /CONSERVATION_VIOLATION/,
      );
      await assert.rejects(
        () => mutate(piket, k.id, "adjust", { adjustedJtm: "2" }),
        /CONSERVATION_VIOLATION/,
      );
      await assert.rejects(() =>
        mutate(piket, k.id, "allocate", {
          userId: ceremonyId,
          allocatedJtm: "0.00001",
        }),
      );
    },
  );
  await t.test(
    "D09 remove/reset reverse allocation only, owner journal remains; no inflated ledger",
    async () => {
      k = await mutate(piket, k.id, "remove-allocation", {
        allocationId: k.allocations.find((a) => a.userId === receiverId)!.id,
      });
      assert.equal(await net(k.id), "2.9999");
      k = await mutate(piket, k.id, "reset");
      assert.equal(await net(k.id), "3.0000");
      assert.equal(k.allocations.length, 0);
      assert.equal(k.adjustedJtm, "3.0000");
    },
  );
  await t.test(
    "D10 full substitution reverses original journal, retains daily attendance, effective owner only",
    async () => {
      const priorDaily = (await db.query("select id from app.daily_attendance"))
        .rows.length;
      k = await mutate(piket, k.id, "substitute", { userId: subId });
      assert.equal(k.userId, subId);
      assert.equal(k.originalUserId, guruId);
      assert.equal(k.confirmed, false);
      assert.equal(await net(k.id), "0.0000");
      assert.equal(
        (await db.query("select id from app.daily_attendance")).rows.length,
        priorDaily,
      );
      await assert.rejects(
        () =>
          command(guru, "journal-create", {
            occurrenceId: k.id,
            material: "Ditolak",
            present: 28,
            absent: 2,
            notes: "",
            reason,
          }),
        /NOT_FOUND/,
      );
      k = await mutate(piket, k.id, "confirm");
      const substituteJournal = await command<Journal>(sub, "journal-create", {
        occurrenceId: k.id,
        material: "Jurnal pengganti",
        present: 28,
        absent: 2,
        notes: "",
        reason,
      });
      assert.equal(substituteJournal.userId, subId);
      assert.equal(await net(k.id, subId), "3.0000");
    },
  );
  await t.test(
    "D11 failed replacement preserves prior substitute, confirmation, journal and credits",
    async () => {
      await create(1, extraClass.id, receiverId, "07:30");
      const before = await get(k.id);
      const fp = await duties.preview(piket, {
        operation: "replace",
        occurrenceId: k.id,
        version: before.version,
        userId: receiverId,
        reason,
      });
      await assert.rejects(
        () => duties.commit(piket, { previewId: fp.previewId }),
        /DUTY_COLLISION/,
      );
      const after = await get(k.id);
      assert.equal(after.userId, subId);
      assert.equal(after.journalId, before.journalId);
      assert.equal(after.confirmed, true);
      assert.equal(await net(k.id), "3.0000");
      await assert.rejects(
        () => mutate(piket, k.id, "replace", { userId: piketId }),
        /SUBSTITUTE_INVALID/,
      );
      await assert.rejects(
        () => mutate(piket, k.id, "replace", { userId: adminId }),
        /SUBSTITUTE_INVALID/,
      );
    },
  );
  await t.test(
    "D12 cancel substitute restores original, clears only that occurrence, requires reconfirm",
    async () => {
      const ceremonyNet = await net(c.id);
      k = await mutate(piket, k.id, "cancel-substitute");
      assert.equal(k.userId, guruId);
      assert.equal(k.confirmed, false);
      assert.equal(k.journalId, null);
      assert.equal(await net(k.id), "0.0000");
      assert.equal(await net(c.id), ceremonyNet);
      k = await mutate(piket, k.id, "confirm");
    },
  );
  await t.test(
    "D13 piket partial allocation positive+time-in grants scope without extra4; revoke loses immediately",
    async () => {
      p = await mutate(admin, p.id, "adjust", { adjustedJtm: "2" });
      p = await mutate(admin, p.id, "allocate", {
        userId: subId,
        allocatedJtm: "2",
      });
      assert.equal(await net(p.id, subId), "2.0000");
      assert.equal((await board(sub)).canOperate, false);
      await command(admin, "manual", {
        userId: subId,
        date,
        scheduledIn: "07:00",
        scheduledOut: "14:00",
        actualIn: "07:00",
        actualOut: null,
        extra: false,
        version: "0",
        reason,
      });
      assert.equal((await board(sub)).canOperate, true);
      const allocation = p.allocations[0]!;
      p = await mutate(admin, p.id, "remove-allocation", {
        allocationId: allocation.id,
      });
      assert.equal((await board(sub)).canOperate, false);
      assert.equal(await net(p.id, subId), "0.0000");
      p = await mutate(admin, p.id, "revoke");
      assert.equal((await board(piket)).canOperate, false);
      assert.equal(await net(p.id), "0.0000");
    },
  );
  await t.test(
    "D14 stale preview and concurrent conservation requests cannot overspend",
    async () => {
      p = await mutate(admin, p.id, "confirm");
      p = await mutate(admin, p.id, "adjust", { adjustedJtm: "2" });
      const dto = await get(p.id),
        one = await duties.preview(admin, {
          operation: "allocate",
          occurrenceId: p.id,
          version: dto.version,
          userId: receiverId,
          allocatedJtm: "2",
          reason,
        }),
        two = await duties.preview(admin, {
          operation: "allocate",
          occurrenceId: p.id,
          version: dto.version,
          userId: subId,
          allocatedJtm: "2",
          reason,
        });
      const result = await Promise.allSettled([
        duties.commit(admin, { previewId: one.previewId }),
        duties.commit(admin, { previewId: two.previewId }),
      ]);
      assert.equal(result.filter((x) => x.status === "fulfilled").length, 1);
      assert.equal(await net(p.id), "4.0000");
    },
  );
  await t.test(
    "D15 ceremony replacement reverses5 and requires new owner's confirmation",
    async () => {
      c = await mutate(admin, c.id, "substitute", { userId: subId });
      assert.equal(await net(c.id), "0.0000");
      await assert.rejects(
        () => mutate(ceremony, c.id, "confirm"),
        /FORBIDDEN/,
      );
      c = await mutate(sub, c.id, "confirm");
      assert.equal(await net(c.id, subId), "5.0000");
    },
  );
  await t.test(
    "D16 final guards, raw DML/helper denial and preview identity binding",
    async () => {
      const v = await duties.preview(admin, {
        operation: "reset",
        occurrenceId: p.id,
        version: (await get(p.id)).version,
        reason,
      });
      await assert.rejects(
        () => duties.commit(guru, { previewId: v.previewId }),
        /PREVIEW_STALE/,
      );
      await db.exec(
        "update finance.period_guards set finalized_at=clock_timestamp() where period_start='2090-01-01'",
      );
      await assert.rejects(() => mutate(admin, p.id, "reset"), /FINAL_PERIOD/);
      await db.exec("update finance.period_guards set finalized_at=null");
      for (const role of [
        "sim_guru_business",
        "sim_guru_auth",
        "sim_guru_worker",
      ]) {
        await assert.rejects(() =>
          scope(role).query("select * from app.substitutions"),
        );
        await assert.rejects(() =>
          scope(role).query("select finance.reconcile_occurrence($1)", [p.id]),
        );
      }
    },
  );
  await t.test(
    "D17 API guards, scoped board and sanitization are enforced with real local sessions",
    async () => {
      const config = {
        appUrl: "https://school.example",
        sessionSecret: randomBytes(40).toString("hex"),
        production: true,
        vercel: true,
      };
      const handler = createDutyHandler({
        config: () => config,
        auth: async () => auth,
        service: async () => duties,
        rate: async () =>
          new AccountLifecycleService(authDb, passwords, {
            hmac: config.sessionSecret,
            encryptionKey: randomBytes(32).toString("hex"),
            appUrl: config.appUrl,
          }),
      });
      const req = (token?: string, method = "GET", origin = config.appUrl) =>
        new Request(config.appUrl + "/api/duties/board?date=" + date, {
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
        });
      assert.equal((await handler("board", req())).status, 401);
      assert.equal((await handler("board", req(onboard))).status, 403);
      assert.equal(
        (await handler("commit", req(other, "POST", "https://evil.test")))
          .status,
        403,
      );
      const response = await handler("board", req(other));
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("Cache-Control"), "no-store");
      const value = (await response.json()) as { data: DutyBoard };
      assert.equal(value.data.teachers.length, 0);
      assert.ok(
        value.data.occurrences.every(
          (x) => x.originalUserId === otherId || x.userId === otherId,
        ),
      );
      assert.equal((await board(receiver)).canOperate, false);
      const mine = await read<List<Occurrence>>(guru, "eligible", { date });
      assert.ok(mine.items.some((x) => x.id === k.id));
      assert.ok(schedule.schedule.id);
      const history = await read<List<Journal>>(guru, "journals", filter);
      assert.ok(history.items.every((x) => x.userId === guruId));
    },
  );
  await t.test(
    "D18 H-1 penalty applies to adjusted owner basis once; partial allocation stays unweighted",
    async () => {
      try {
        await db.exec(
          "create or replace function app.activity_today() returns date language sql stable set search_path=pg_catalog as $$ select date '2090-01-01' $$",
        );
        const previous = (
          await duties.read(admin, { date: "2090-01-01" })
        ).occurrences.find((x) => x.kind === "KBM" && x.userId === guruId)!;
        const operate = async (
          operation: string,
          extra: Record<string, unknown> = {},
        ) => {
          const v = (
            await duties.read(admin, { date: "2090-01-01" })
          ).occurrences.find((x) => x.id === previous.id)!;
          const pr = await duties.preview(admin, {
            operation,
            occurrenceId: v.id,
            version: v.version,
            reason,
            ...extra,
          });
          return duties.commit(admin, { previewId: pr.previewId });
        };
        await operate("confirm");
        await operate("adjust", { adjustedJtm: "1" });
        await operate("allocate", { userId: receiverId, allocatedJtm: "0.5" });
        await db.exec(
          "create or replace function app.activity_today() returns date language sql stable set search_path=pg_catalog as $$ select date '2090-01-02' $$",
        );
        await command(admin, "h1", { enabled: true, reason });
        const v = await command<Journal>(guru, "journal-create", {
          occurrenceId: previous.id,
          material: "Jurnal H-1",
          present: 28,
          absent: 2,
          notes: "",
          reason,
        });
        assert.equal(v.creditedJtm, "0.8000");
        assert.equal(await net(previous.id, receiverId), "0.5000");
        assert.equal(await net(previous.id), "1.3000");
        const edit = await command<Journal>(guru, "journal-edit", {
          journalId: v.id,
          version: v.version,
          material: "Revisi H-1",
          present: 28,
          absent: 2,
          notes: "",
          reason,
        });
        assert.equal(edit.creditedJtm, "0.8000");
        assert.equal(await net(previous.id), "1.3000");
      } finally {
        await db.exec(
          "create or replace function app.activity_today() returns date language sql stable set search_path=pg_catalog as $$ select date '2090-01-02' $$",
        );
      }
    },
  );
  await t.test(
    "D19 weekly edits recheck dated effective ceremony substitution",
    async () => {
      await assert.rejects(
        () => create(1, c2.id, subId, "07:00"),
        /DUTY_COLLISION/,
      );
    },
  );
});
