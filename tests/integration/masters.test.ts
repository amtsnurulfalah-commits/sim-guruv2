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
import { createMasterHandler } from "../../src/server/masters/http";
import { AccountLifecycleService } from "../../src/server/accounts/lifecycle";
import { issueCsrf } from "../../src/server/auth/security";
import { payloadSchemas, type MasterRow } from "../../src/lib/masters/schemas";
const password = "H9!vL4#qT8@bP2$wF7&z";
test("Tahap 2.2 — master school, academic integrity and effective financial versions", async (t) => {
  const db = await openPgliteDatabase();
  t.after(() => db.close());
  const migrations = await readMigrations(resolve("supabase/migrations"));
  await applyMigrations(db, migrations.slice(0, -1));
  const passwords = await getPasswordService(),
    hash = await passwords.hashNew(password, {
      username: "master.operator",
      fullName: "Master Operator",
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
  const adminId = await fixture("master.operator", "admin"),
    guruId = await fixture("master.guru", "guru");
  await fixture("master.onboard", "admin", false);
  await t.test(
    "MA01 upgrade preserves existing identity and checksums; repeat is no-op",
    async () => {
      assert.equal((await applyMigrations(db, migrations)).length, 1);
      assert.equal((await applyMigrations(db, migrations)).length, 0);
      assert.equal(
        (await db.query("select id from app.app_users where id=$1", [adminId]))
          .rows.length,
        1,
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
  const admin = await login("master.operator"),
    guru = await login("master.guru"),
    onboard = await login("master.onboard");
  const service = new MasterService(business),
    reason = "Konfigurasi master sintetis";
  const create = (kind: string, data: unknown) =>
    service.save(admin, kind, { version: "0", reason, data });
  const edit = (kind: string, row: MasterRow, data: unknown) =>
    service.save(admin, kind, {
      id: row.id,
      version: row.version,
      reason,
      data,
    });
  const archive = (kind: string, row: MasterRow) =>
    service.save(
      admin,
      kind,
      { id: row.id, version: row.version, reason },
      true,
    );
  const handler = createMasterHandler({
    config: () => config,
    auth: async () => auth,
    masters: async () => service,
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
    path = "/api/settings/subjects",
    origin = config.appUrl,
  ) {
    return new Request(config.appUrl + path, {
      method,
      headers: {
        origin,
        "x-vercel-forwarded-for": "192.0.2.8",
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
  await t.test(
    "MA02 anonymous/guru/onboarding denied at HTTP and business SQL entry points",
    async () => {
      for (const [token, status] of [
        [undefined, 401],
        [guru, 403],
        [onboard, 403],
      ] as const)
        assert.equal((await handler(req(token), "school")).status, status);
      await assert.rejects(() => service.list(guru, "subjects", {}));
      await assert.rejects(() => service.list(onboard, "subjects", {}));
    },
  );
  await t.test(
    "MA03 origin, CSRF, method and spoofed filter cannot elevate",
    async () => {
      assert.equal(
        (
          await handler(
            req(admin, "POST", {}, undefined, "https://evil.example"),
            "subjects",
          )
        ).status,
        403,
      );
      assert.equal(
        (await handler(req(undefined, "POST", {}), "subjects")).status,
        403,
      );
      assert.equal(
        (await handler(req(admin, "PUT", {}), "subjects")).status,
        405,
      );
      assert.equal(
        (
          await handler(
            req(
              admin,
              "GET",
              undefined,
              "/api/settings/subjects?actorId=" + adminId,
            ),
            "subjects",
          )
        ).status,
        422,
      );
    },
  );
  let school: MasterRow,
    year: MasterRow,
    period1: MasterRow,
    period2: MasterRow,
    klass: MasterRow,
    subject: MasterRow,
    rate: MasterRow,
    allowance: MasterRow;
  const schoolData = {
    name: "Madrasah Sintetis",
    address: "Alamat uji",
    npsn: "00123456",
    level: "SMP",
    useParallel: true,
    parallelMax: 11,
    minutesPerJtm: 25,
    headmasterId: "",
  };
  const yearData = {
    label: "2026/2027",
    dateStart: "2026-07-01",
    dateEnd: "2027-06-30",
  };
  await t.test(
    "MA04 school starts empty; typed singleton create and NPSN leading zeros",
    async () => {
      assert.equal((await service.list(admin, "school", {})).total, 0);
      school = await create("school", schoolData);
      assert.equal(school.npsn, "00123456");
      assert.equal(school.minutesPerJtm, 25);
      await assert.rejects(() => create("school", schoolData));
    },
  );
  await t.test(
    "MA05 school validation: grade parallel maxima, unknown keys and headmaster relation",
    async () => {
      assert.equal(
        payloadSchemas.school.safeParse({ ...schoolData, parallelMax: 12 })
          .success,
        false,
      );
      assert.equal(
        payloadSchemas.school.safeParse({ ...schoolData, secret: "bad" })
          .success,
        false,
      );
      await assert.rejects(
        () => edit("school", school, { ...schoolData, headmasterId: guruId }),
        /MASTER_INVALID/,
      );
      await db.query(
        "update app.app_users set additional_role='KEPALA_SEKOLAH' where id=$1",
        [guruId],
      );
      school = await edit("school", school, {
        ...schoolData,
        headmasterId: guruId,
      });
    },
  );
  await t.test(
    "MA06 year dates, consecutive label and overlapping years rejected atomically",
    async () => {
      year = await create("academic-years", yearData);
      await assert.rejects(() =>
        create("academic-years", { ...yearData, label: "2026/2028" }),
      );
      await assert.rejects(
        () =>
          create("academic-years", {
            ...yearData,
            label: "2027/2028",
            dateStart: "2027-06-01",
            dateEnd: "2028-06-30",
          }),
        /MASTER_OVERLAP/,
      );
      assert.equal((await service.list(admin, "academic-years", {})).total, 1);
    },
  );
  const period1Data = () => ({
    academicYearId: year.id,
    semester: 1,
    dateStart: "2026-07-01",
    dateEnd: "2026-12-31",
    isActive: true,
  });
  const period2Data = () => ({
    academicYearId: year.id,
    semester: 2,
    dateStart: "2027-01-01",
    dateEnd: "2027-06-30",
    isActive: true,
  });
  await t.test(
    "MA07 period contained in year; unique semester and no overlapping dates",
    async () => {
      period1 = await create("academic-periods", period1Data());
      await assert.rejects(
        () =>
          create("academic-periods", {
            ...period2Data(),
            dateEnd: "2027-07-01",
          }),
        /MASTER_INVALID/,
      );
      await assert.rejects(
        () =>
          create("academic-periods", {
            ...period2Data(),
            dateStart: "2026-12-31",
          }),
        /MASTER_OVERLAP/,
      );
      await assert.rejects(() =>
        create("academic-periods", { ...period1Data(), isActive: false }),
      );
    },
  );
  await t.test(
    "MA08 active-period switch is atomic and increments previous version with audit",
    async () => {
      period2 = await create("academic-periods", period2Data());
      const list = await service.list(admin, "academic-periods", {});
      assert.equal(list.items.filter((r) => r.isActive).length, 1);
      assert.equal(list.items.find((r) => r.id === period2.id)?.isActive, true);
      const old = list.items.find((r) => r.id === period1.id)!;
      assert.equal(old.version, "2");
      await assert.rejects(
        () => edit("academic-periods", period1, period1Data()),
        /VERSION_CONFLICT/,
      );
      period1 = old;
      assert.equal(
        (await service.history(admin, "academic-periods", period1.id)).length,
        2,
      );
    },
  );
  const classData = () => ({
    academicPeriodId: period1.id,
    name: "VII A",
    level: "SMP",
    grade: 7,
    parallel: "A",
    expectedStudents: 32,
  });
  await t.test(
    "MA09 class preserves relation, normalized names and exact integer standards",
    async () => {
      klass = await create("classes", classData());
      assert.equal(klass.expectedStudents, 32);
      assert.equal(
        (await service.list(admin, "classes", { parentId: period1.id }))
          .items[0]?.parentLabel,
        "2026/2027 · Semester 1",
      );
      await assert.rejects(() =>
        create("classes", { ...classData(), name: " vii a " }),
      );
    },
  );
  await t.test(
    "MA10 class min15 or zero parallel, max per level, grade and configured parallel checked",
    async () => {
      for (const change of [
        { expectedStudents: 14 },
        { expectedStudents: 33 },
        { expectedStudents: 15.5 },
        { grade: 6 },
        { parallel: "L" },
        { parallel: "" },
        { level: "SD" },
      ])
        await assert.rejects(() =>
          create("classes", { ...classData(), name: "Alternatif", ...change }),
        );
      const zero = await create("classes", {
        ...classData(),
        name: "VII B",
        parallel: "B",
        expectedStudents: 0,
      });
      await archive("classes", zero);
    },
  );
  await t.test(
    "MA11 subject case-insensitive uniqueness and server filtering across all pages",
    async () => {
      subject = await create("subjects", { name: "Ilmu Pengetahuan Alam" });
      await create("subjects", { name: "Matematika" });
      await create("subjects", { name: "Bahasa Indonesia" });
      await assert.rejects(() =>
        create("subjects", { name: " ilmu pengetahuan alam " }),
      );
      const a = await service.list(admin, "subjects", { pageSize: 1 }),
        b = await service.list(admin, "subjects", { pageSize: 1, page: 2 });
      assert.equal(a.total, 3);
      assert.notEqual(a.items[0]?.id, b.items[0]?.id);
      assert.equal(
        (await service.list(admin, "subjects", { q: "matem" })).items[0]?.name,
        "Matematika",
      );
      assert.equal(
        (await service.list(admin, "subjects", { q: "%" })).total,
        0,
      );
      await assert.rejects(() =>
        service.list(admin, "subjects", { pageSize: 101 }),
      );
    },
  );
  await t.test(
    "MA12 CAS conflict does not append revision; unknown/server-owned payload rejected",
    async () => {
      const next = await edit("subjects", subject, { name: "IPA Terpadu" });
      const before = (await service.history(admin, "subjects", subject.id))
        .length;
      await assert.rejects(
        () => edit("subjects", subject, { name: "Stale overwrite" }),
        /VERSION_CONFLICT/,
      );
      assert.equal(
        (await service.history(admin, "subjects", subject.id)).length,
        before,
      );
      subject = next;
      await assert.rejects(() =>
        edit("subjects", subject, { name: "X", version: "999" }),
      );
    },
  );
  await t.test(
    "MA13 archive blocks referenced year/period; preserves subjects and terminal state",
    async () => {
      await assert.rejects(
        () => archive("academic-years", year),
        /MASTER_REFERENCED/,
      );
      await assert.rejects(
        () => archive("academic-periods", period1),
        /MASTER_REFERENCED/,
      );
      const archived = await archive("subjects", subject);
      assert.equal(
        (await service.list(admin, "subjects", { archived: "true" })).total,
        1,
      );
      assert.ok(archived.archivedAt);
      await assert.rejects(
        () => edit("subjects", archived, { name: "Restore" }),
        /ARCHIVED_READ_ONLY/,
      );
      assert.equal(
        (
          await db.query("select id from app.subjects where id=$1", [
            subject.id,
          ])
        ).rows.length,
        1,
      );
    },
  );
  const rateData = {
    kind: "jtm",
    amount: "12500",
    enabled: true,
    dateStart: "2090-01-01",
    dateEnd: "2090-06-30",
  };
  await t.test(
    "MA14 tariff is integer rupiah string with finite effective window and transport guard",
    async () => {
      rate = await create("rates", rateData);
      assert.equal(rate.amount, "12500");
      for (const amount of ["1.5", "-1", "1000000000", "1e3"])
        await assert.rejects(() => create("rates", { ...rateData, amount }));
      await assert.rejects(() =>
        create("rates", { ...rateData, kind: "transport", amount: "0" }),
      );
      await assert.rejects(() =>
        create("rates", { ...rateData, dateStart: "2026-02-30" }),
      );
    },
  );
  await t.test(
    "MA15 financial ranges inclusive and non-overlapping; different tariff kind allowed",
    async () => {
      await assert.rejects(
        () =>
          create("rates", {
            ...rateData,
            dateStart: "2090-06-30",
            dateEnd: "2090-12-31",
          }),
        /MASTER_OVERLAP/,
      );
      await create("rates", {
        ...rateData,
        dateStart: "2090-07-01",
        dateEnd: "2090-12-31",
      });
      await create("rates", { ...rateData, kind: "transport", amount: "1000" });
    },
  );
  await t.test(
    "MA16 financial versions cannot be edited or backdated; future cancellation retains history",
    async () => {
      await assert.rejects(
        () => edit("rates", rate, { ...rateData, amount: "15000" }),
        /MASTER_IMMUTABLE/,
      );
      await assert.rejects(
        () =>
          create("rates", {
            ...rateData,
            dateStart: "2000-01-01",
            dateEnd: "2000-12-31",
          }),
        /MASTER_PAST/,
      );
      const gone = await archive("rates", rate);
      assert.ok(gone.archivedAt);
      assert.equal((await service.history(admin, "rates", rate.id)).length, 2);
      await create("rates", rateData);
    },
  );
  const allowanceData = () => ({
    userId: guruId,
    dutyName: "Wakil Kepala",
    amount: "250000",
    dateStart: "2090-01-01",
    dateEnd: "2090-12-31",
  });
  await t.test(
    "MA17 allowances bind active user, normalize task and prevent overlapping same duty",
    async () => {
      allowance = await create("allowances", allowanceData());
      await assert.rejects(
        () =>
          create("allowances", {
            ...allowanceData(),
            dutyName: " wakil kepala ",
          }),
        /MASTER_OVERLAP/,
      );
      await create("allowances", {
        ...allowanceData(),
        dutyName: "Pembina OSIM",
      });
      await assert.rejects(
        () =>
          create("allowances", { ...allowanceData(), userId: randomUUID() }),
        /MASTER_INVALID|violates foreign key/,
      );
      assert.equal(
        (await service.list(admin, "allowances", { parentId: guruId })).total,
        2,
      );
    },
  );
  await t.test(
    "MA18 cancellation requires future effective date; today is immutable",
    async () => {
      const today = new Date(Date.now() + 7 * 3600_000)
        .toISOString()
        .slice(0, 10);
      const r = await create("rates", {
        ...rateData,
        dateStart: today,
        dateEnd: today,
      });
      await assert.rejects(() => archive("rates", r), /MASTER_IMMUTABLE/);
      await assert.rejects(
        () =>
          edit("allowances", allowance, {
            ...allowanceData(),
            amount: "300000",
          }),
        /MASTER_IMMUTABLE/,
      );
    },
  );
  await t.test(
    "MA19 RLS/default deny blocks business direct DML, helpers, auth, worker and public",
    async () => {
      await assert.rejects(() =>
        business.query("select * from app.school_profiles"),
      );
      await assert.rejects(() =>
        business.query("select app.master_guard($1,true)", [tokenHash(admin)]),
      );
      for (const role of [
        "sim_guru_auth",
        "sim_guru_worker",
        "sim_guru_bootstrap",
      ])
        assert.equal(
          (
            await db.query<{ allowed: boolean }>(
              "select has_function_privilege($1,'app.master_save(text,text,uuid,bigint,jsonb,boolean,text)','execute') as allowed",
              [role],
            )
          ).rows[0]!.allowed,
          false,
        );
      assert.equal(
        (
          await db.query<{ n: number }>(
            "select count(*)::int as n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('app','auth_private','ops') and c.relkind='r' and c.relrowsecurity and c.relforcerowsecurity",
          )
        ).rows[0]?.n,
        65,
      );
    },
  );
  await t.test(
    "MA20 history keeps original values and actor without credentials; guarded and bounded",
    async () => {
      const rows = await service.history(admin, "subjects", subject.id);
      assert.equal(rows.length, 3);
      assert.equal((rows[0] as { actor_id: string }).actor_id, adminId);
      const raw = JSON.stringify(rows);
      assert.ok(raw.includes("Ilmu Pengetahuan Alam"));
      assert.equal(raw.includes(hash), false);
      await assert.rejects(() => service.history(guru, "subjects", subject.id));
    },
  );
  await t.test(
    "MA21 SQL validates stale writes and invalid child parent even without application schema",
    async () => {
      await assert.rejects(
        () =>
          business.query(
            "select app.master_save($1,$2,$3,$4,$5::jsonb,false,$6)",
            [
              tokenHash(admin),
              "classes",
              klass.id,
              klass.version,
              JSON.stringify({
                academic_period_id: randomUUID(),
                name: "X",
                level: "SMP",
                grade: 7,
                parallel: "A",
                expected_students: 32,
              }),
              reason,
            ],
          ),
        /MASTER_REFERENCED/,
      );
      await assert.rejects(
        () =>
          business.query(
            "select app.master_save($1,$2,null,0,$3::jsonb,false,$4)",
            [
              tokenHash(admin),
              "subjects",
              JSON.stringify({ name: "X", archived_at: null }),
              reason,
            ],
          ),
        /MASTER_INVALID/,
      );
    },
  );
  await t.test(
    "MA22 HTTP create/read/history correct no-store and sanitized domain conflict",
    async () => {
      const r = await handler(
        req(admin, "POST", {
          version: "0",
          reason,
          data: { name: "Sejarah Kebudayaan Islam" },
        }),
        "subjects",
      );
      assert.equal(r.status, 200);
      assert.equal(r.headers.get("cache-control"), "no-store");
      const body = (await r.json()).data;
      assert.equal(body.version, "1");
      const h = await handler(req(admin), "subjects", body.id);
      assert.equal(h.status, 200);
      const stale = await handler(
        req(admin, "PATCH", {
          id: body.id,
          version: "99",
          reason,
          data: { name: "Stale" },
        }),
        "subjects",
      );
      assert.equal(stale.status, 409);
      const invalid = await handler(
        req(admin, "PATCH", {
          id: school.id,
          version: school.version,
          reason,
          data: { ...schoolData, headmasterId: randomUUID() },
        }),
        "school",
      );
      assert.equal(invalid.status, 422);
      assert.equal((await invalid.text()).includes("auth_private"), false);
    },
  );
  await t.test(
    "MA23 no implicit active-period fallback and archived parent hidden from choices",
    async () => {
      const current = (
        await service.list(admin, "academic-periods", {})
      ).items.find((r) => r.isActive)!;
      await edit("academic-periods", current, {
        ...period2Data(),
        isActive: false,
      });
      assert.equal(
        (await service.list(admin, "academic-periods", {})).items.filter(
          (r) => r.isActive,
        ).length,
        0,
      );
      const p = await create("academic-years", {
        label: "2028/2029",
        dateStart: "2028-07-01",
        dateEnd: "2029-06-30",
      });
      await archive("academic-years", p);
      await assert.rejects(
        () =>
          create("academic-periods", {
            academicYearId: p.id,
            semester: 1,
            dateStart: "2028-07-01",
            dateEnd: "2028-12-31",
            isActive: false,
          }),
        /MASTER_INVALID/,
      );
    },
  );
  await t.test(
    "MA24 revoked admin session cannot write master despite valid-shaped context",
    async () => {
      await authDb.query("select auth_private.revoke_session($1)", [
        tokenHash(admin),
      ]);
      await assert.rejects(() => create("subjects", { name: "Revoked write" }));
      assert.equal((await handler(req(admin), "subjects")).status, 401);
    },
  );
});
