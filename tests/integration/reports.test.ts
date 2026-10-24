import { createReportsHandler } from "../../src/server/reports/http";
import { AccountLifecycleService } from "../../src/server/accounts/lifecycle";
import { issueCsrf } from "../../src/server/auth/security";
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
import { ReportsService } from "../../src/server/reports/service";
import { reportWorkbook } from "../../src/server/reports/export";
import type { Capabilities } from "../../src/lib/reports/contracts";
const password = "H9!vL4#qT8@bP2$wF7&z";
test("Stage 5 explicit reporting, canonical data and export", async (t) => {
  const db = await openPgliteDatabase();
  t.after(() => db.close());
  const migrations = await readMigrations("supabase/migrations");
  await applyMigrations(db, migrations.slice(0, -1));
  const before = (
    await db.query<{ hash: string }>(
      "select md5(string_agg(prosrc,'|' order by oid)) hash from pg_proc where oid in('finance.calculate(uuid,date,text)'::regprocedure,'finance.bundle(date,text)'::regprocedure)",
    )
  ).rows[0]!.hash;
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
  await db.query(
    "update app.app_users set additional_role='KEPALA_SEKOLAH' where id=$1",
    [guruId],
  );
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
    other = await login("teacher.two");
  const reports = new ReportsService(business);
  const period = "2090-01";
  const q = { kind: "academic", period };
  const reason = "Persetujuan laporan sintetis";
  await t.test(
    "HTTP enforces session, origin, CSRF and report scopes",
    async () => {
      const config = {
        appUrl: "https://sim.example.test",
        sessionSecret: "S".repeat(40),
        production: true,
        vercel: true,
      };
      const handler = createReportsHandler({
        config: () => config,
        auth: async () => auth,
        service: async () => reports,
        rate: async () =>
          new AccountLifecycleService(authDb, passwords, {
            hmac: "H".repeat(40),
            encryptionKey: randomBytes(32).toString("base64"),
            appUrl: config.appUrl,
          }),
      });
      const req = (
        action: string,
        token?: string,
        data?: unknown,
        csrf = true,
        origin = config.appUrl,
      ) =>
        new Request(config.appUrl + "/api/reports/" + action, {
          method: data ? "POST" : "GET",
          headers: {
            origin,
            "x-vercel-forwarded-for": "192.0.2.25",
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
        });
      assert.equal(
        (await handler("read", req("read?kind=academic&period=2090-01")))
          .status,
        401,
      );
      assert.equal(
        (await handler("read", req("read?kind=academic&period=2090-01", guru)))
          .status,
        403,
      );
      assert.equal(
        (await handler("read", req("read?kind=academic&period=2090-13", admin)))
          .status,
        422,
      );
      assert.equal(
        (
          await handler(
            "read",
            req(
              "read?kind=capabilities",
              admin,
              undefined,
              true,
              "https://hostile.example",
            ),
          )
        ).status,
        403,
      );
      const payload = {
        userId: guruId,
        academic: true,
        finance: false,
        version: "0",
        reason: "Synthetic grant",
      };
      assert.equal(
        (await handler("access", req("access", admin, payload, false))).status,
        403,
      );
      assert.equal(
        (await handler("access", req("access", guru, payload))).status,
        403,
      );
      const response = await handler(
        "read",
        req("read?kind=capabilities", admin),
      );
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("Cache-Control"), "no-store");
    },
  );
  await t.test(
    "migration preserves finance routines; RLS and internal helper inaccessible",
    async () => {
      assert.equal(
        (
          await db.query<{ hash: string }>(
            "select md5(string_agg(prosrc,'|' order by oid)) hash from pg_proc where oid in('finance.calculate(uuid,date,text)'::regprocedure,'finance.bundle(date,text)'::regprocedure)",
          )
        ).rows[0]!.hash,
        before,
      );
      assert.deepEqual(
        (
          await db.query(
            "select relrowsecurity,relforcerowsecurity from pg_class where oid='app.report_readers'::regclass",
          )
        ).rows,
        [{ relrowsecurity: true, relforcerowsecurity: true }],
      );
      await assert.rejects(() =>
        business.query("select * from app.report_readers"),
      );
      await assert.rejects(() =>
        business.query(
          "select app.report_academic_rows(date '2090-01-01',null)",
        ),
      );
    },
  );
  await t.test(
    "additional role is not reporting authorization; scoped admin grants and CAS",
    async () => {
      assert.deepEqual(
        await reports.read<Capabilities>(guru, { kind: "capabilities" }),
        { admin: false, academic: false, finance: false },
      );
      await assert.rejects(() => reports.read(guru, q), /FORBIDDEN/);
      await assert.rejects(() => reports.export(guru, q), /FORBIDDEN/);
      await assert.rejects(
        () =>
          reports.access(guru, {
            userId: otherId,
            academic: true,
            finance: true,
            version: "0",
            reason,
          }),
        /FORBIDDEN/,
      );
      await reports.access(admin, {
        userId: guruId,
        academic: true,
        finance: false,
        version: "0",
        reason,
      });
      await assert.rejects(
        () =>
          reports.access(admin, {
            userId: guruId,
            academic: true,
            finance: true,
            version: "0",
            reason,
          }),
        /VERSION_CONFLICT/,
      );
      await assert.rejects(
        () => reports.read(guru, { ...q, kind: "finance" }),
        /FORBIDDEN/,
      );
      await assert.rejects(() => reports.read(other, q), /FORBIDDEN/);
    },
  );
  await db.exec(
    "CREATE OR REPLACE FUNCTION app.activity_today() RETURNS date LANGUAGE sql STABLE AS $$ SELECT date '2090-01-31' $$; CREATE OR REPLACE FUNCTION finance.today() RETURNS date LANGUAGE sql STABLE AS $$ SELECT date '2090-01-31' $$",
  );
  await db.exec(
    'CREATE OR REPLACE FUNCTION app.day_context_internal(p_date date,p_calendar jsonb DEFAULT null,p_override jsonb DEFAULT null) RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT \'{"kbmEnabled":true,"examEnabled":true}\'::jsonb $$',
  );
  await db.query(
    "insert into app.daily_attendance(user_id,date,actual_time_in,actual_time_out,time_in_source) select $1,date '2090-01-01'+s,case when s%2=0 then time '07:00' end,case when s%4=0 then time '13:00' end,'admin' from generate_series(0,29)s",
    [guruId],
  );
  await db.query(
    "insert into app.daily_attendance(user_id,date,actual_time_in,actual_time_out,time_in_source) values($1,'2090-01-01','07:00','13:00','admin')",
    [otherId],
  );
  await t.test(
    "summary uses all filtered rows; pagination/detail/export reconcile; no read writes",
    async () => {
      const counts = await db.query(
        "select (select count(*) from app.activity_occurrences) activities,(select count(*) from finance.jtm_ledger) ledger",
      );
      const r = await reports.read(guru, q);
      assert.equal(r.total, 31);
      assert.equal(r.items.length, 25);
      assert.equal(r.summary.attendance, 31);
      assert.equal(r.summary.present, 16);
      assert.equal(r.summary.complete, 9);
      const p2 = await reports.read(guru, { ...q, page: 2 });
      assert.equal(p2.items.length, 6);
      assert.deepEqual(p2.summary, r.summary);
      const exp = await reports.export(guru, q);
      assert.equal(exp.items.length, 31);
      assert.deepEqual(exp.summary, r.summary);
      assert.deepEqual(exp.items, [...r.items, ...p2.items]);
      const filtered = await reports.read(guru, { ...q, teacher: otherId });
      assert.equal(filtered.total, 1);
      assert.equal(filtered.summary.present, 1);
      const empty = await reports.read(guru, { ...q, period: "2089-12" });
      assert.equal(empty.total, 0);
      assert.equal(empty.summary.attendance, 0);
      assert.deepEqual(
        (
          await db.query(
            "select (select count(*) from app.activity_occurrences) activities,(select count(*) from finance.jtm_ledger) ledger",
          )
        ).rows,
        counts.rows,
      );
      const bytes = reportWorkbook(exp);
      assert.equal(bytes.subarray(0, 2).toString(), "PK");
      assert.ok(bytes.includes(Buffer.from("Sumber: kegiatan aktif")));
      assert.ok(bytes.includes(Buffer.from("2090-01")));
    },
  );
  await t.test(
    "KBM, journals, revoked confirmations and multiple BAP states do not duplicate rows",
    async () => {
      await db.query(`DO $fixture$ DECLARE y uuid;p uuid;c uuid;s uuid;sch uuid;o uuid;a uuid;ep uuid;es uuid;er uuid;ea uuid;eo uuid;aa uuid;BEGIN
 PERFORM app.activity_guard('${tokenHash(admin)}',true);PERFORM set_config('app.master_reason','Synthetic report fixture',true);
 INSERT INTO app.school_profiles(name,npsn,level,use_parallel,parallel_max,minutes_per_jtm)VALUES('Synthetic','','SMP',false,1,40);
 INSERT INTO app.academic_years(label,date_start,date_end)VALUES('2090/2091','2090-01-01','2091-12-31')RETURNING id INTO y;
 INSERT INTO app.academic_periods(academic_year_id,semester,date_start,date_end,is_active)VALUES(y,1,'2090-01-01','2090-06-30',true)RETURNING id INTO p;
 INSERT INTO app.classes(academic_period_id,name,level,grade,parallel,expected_students)VALUES(p,'Class 7','SMP',7,'',30)RETURNING id INTO c;
 INSERT INTO app.subjects(name)VALUES('Subject')RETURNING id INTO s;
 INSERT INTO app.teaching_schedules(academic_period_id,user_id,subject_id,class_id,day_index,time_start,time_end,scheduled_jtm,rest_minutes,minutes_per_jtm,valid_from,valid_to,snapshot)VALUES(p,'${guruId}',s,c,1,'07:00','07:40',1,0,40,'2090-01-01','2090-06-30','{}')RETURNING id INTO sch;
 INSERT INTO app.activity_occurrences(kind,schedule_id,date,academic_period_id,class_id,subject_id,time_start,time_end,scheduled_jtm,expected_students,snapshot)VALUES('KBM',sch,'2090-01-01',p,c,s,'07:00','08:00',1,30,'{}')RETURNING id INTO o;
 INSERT INTO app.activity_assignments(occurrence_id,original_user_id,effective_user_id)VALUES(o,'${guruId}','${guruId}')RETURNING id INTO a;
 INSERT INTO app.activity_confirmations(assignment_id,confirmed_by,revoked_at,revoked_by,reason)VALUES(a,'${adminId}',clock_timestamp(),'${adminId}','Synthetic revoked');
 INSERT INTO app.activity_confirmations(assignment_id,confirmed_by,reason)VALUES(a,'${adminId}','Synthetic active');
 INSERT INTO app.teaching_journals(occurrence_id,assignment_id,user_id,material,present,absent,notes,input_type,weight,credited_jtm)VALUES(o,a,'${guruId}','Synthetic',30,0,'','SAME_DAY',1,1);
 INSERT INTO app.exam_periods(academic_period_id,name,date_start,date_end,default_committee_jtm)VALUES(p,'Exam','2090-01-01','2090-01-31',1)RETURNING id INTO ep;
 INSERT INTO app.exam_sessions(period_id,date,name,time_start,time_end,scheduled_jtm)VALUES(ep,'2090-01-02','Session','09:00','10:00',1)RETURNING id INTO es;
 INSERT INTO app.exam_rooms(session_id,name,subject_id,total_students)VALUES(es,'Room',s,30)RETURNING id INTO er;
 INSERT INTO app.exam_supervisor_assignments(exam_room_id,user_id)VALUES(er,'${guruId}')RETURNING id INTO ea;
 INSERT INTO app.activity_occurrences(kind,exam_supervisor_id,date,academic_period_id,subject_id,time_start,time_end,scheduled_jtm,expected_students,snapshot)VALUES('EXAM_SUPERVISOR',ea,'2090-01-02',p,s,'09:00','10:00',1,30,'{}')RETURNING id INTO eo;
 INSERT INTO app.activity_assignments(occurrence_id,original_user_id,effective_user_id)VALUES(eo,'${guruId}','${guruId}')RETURNING id INTO aa;
 INSERT INTO app.exam_baps(occurrence_id,assignment_id,user_id,present,absent,notes,state)VALUES(eo,aa,'${guruId}',30,0,'','locked'),(eo,aa,'${guruId}',30,0,'','active');
 END $fixture$`);
      const r = await reports.read(guru, q);
      assert.equal(r.total, 33);
      assert.equal(r.summary.kbm, 1);
      assert.equal(r.summary.confirmed, 1);
      assert.equal(r.summary.journals, 1);
      assert.equal(r.summary.exams, 1);
      assert.equal(r.summary.baps, 1);
      await db.exec(
        "update app.teaching_journals set deleted_at=clock_timestamp();update app.activity_confirmations set revoked_at=clock_timestamp(),revoked_by='" +
          adminId +
          "' where revoked_at is null;",
      );
      const changed = await reports.read(guru, q);
      assert.equal(changed.summary.journals, 0);
      assert.equal(changed.summary.confirmed, 0);
      assert.equal(changed.total, 33);
      await db.exec(
        "update app.exam_baps set state='locked' where state='active'",
      );
      assert.equal((await reports.read(guru, q)).summary.baps, 0);
    },
  );
  await t.test(
    "money uses canonical bundle exact strings and minimal data; final snapshot wins",
    async () => {
      await reports.access(admin, {
        userId: guruId,
        academic: true,
        finance: true,
        version: "1",
        reason,
      });
      const fq = { ...q, kind: "finance" };
      const r = await reports.read(guru, fq);
      const raw = (
        await db.query<{ value: { statements: { total: string }[] } }>(
          "select finance.bundle(date '2090-01-01','realized') value",
        )
      ).rows[0]!.value;
      assert.equal(r.total, raw.statements.length);
      assert.equal(
        r.summary.total,
        String(raw.statements.reduce((n, x) => n + BigInt(x.total), 0n)),
      );
      assert.ok(
        r.items.every(
          (x) => !("recipient" in x) && !("nip" in x) && !("lines" in x),
        ),
      );
      const p = (
        await db.query<{ id: string }>(
          "insert into finance.honor_periods(period_start,state,finalized_by,finalized_at) values('2090-01-01','final',$1,clock_timestamp()) returning id",
          [adminId],
        )
      ).rows[0]!.id;
      await db.query(
        "insert into finance.honor_statements(period_id,user_id,trx_id,snapshot,checksum,total_jtm,total_honor) values($1,$2,'STAGE5-FINAL',$3::jsonb,repeat('a',64),1,9007199254740993)",
        [
          p,
          guruId,
          JSON.stringify({
            recipient: { id: guruId, name: "Snapshot original" },
            cutoff: "2090-01-31",
            totalJtm: "1",
            teachingSettled: "9007199254740993",
            allowances: "0",
            transportSettled: "0",
            corrections: "0",
            total: "9007199254740993",
          }),
        ],
      );
      const final = await reports.read(guru, fq);
      assert.equal(final.mode, "final");
      assert.equal(final.summary.total, "9007199254740993");
      assert.equal(final.items[0]!.name, "Snapshot original");
      assert.deepEqual((await reports.export(guru, fq)).items, final.items);
    },
  );
  await t.test(
    "revocation effective on next read/export; invalid filters fail",
    async () => {
      await reports.access(admin, {
        userId: guruId,
        academic: false,
        finance: false,
        version: "2",
        reason,
      });
      await assert.rejects(() => reports.read(guru, q), /FORBIDDEN/);
      await assert.rejects(() => reports.export(guru, q), /FORBIDDEN/);
      await assert.rejects(() =>
        reports.read(admin, { ...q, period: "2090-13" }),
      );
      await assert.rejects(() => reports.read(admin, { ...q, pageSize: 999 }));
    },
  );
});
