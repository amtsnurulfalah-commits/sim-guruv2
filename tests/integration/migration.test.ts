import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { openPgliteDatabase } from "../helpers/pglite-database";
import { applyMigrations, readMigrations } from "../../scripts/lib/migrations";
import {
  type SqlDatabase,
  type SqlExecutor,
  type SqlParameter,
} from "../../scripts/lib/sql-database";
import { getPasswordService } from "../../src/server/auth/passwords";
import { LocalAuthService } from "../../src/server/auth/service";
import { MigrationService } from "../../src/server/migration/service";
import { OperationsService } from "../../src/server/operations/service";
import { type MigrationBoard } from "../../src/lib/migration/contracts";
import { planHash, type ImportPlan } from "../../src/lib/migration/plan";
import { applyImportPlan } from "../../scripts/migration/apply-plan";
import { reconcilePlan } from "../../scripts/migration/reconcile-plan";
import { restoreInventory } from "../../scripts/migration/restore-inventory";
import {
  encryptBackup,
  decryptBackup,
} from "../../scripts/migration/backup-crypto";
const password = "H9!vL4#qT8@bP2$wF7&z",
  reason = "Verifikasi migrasi sintetis";
test("Tahap 8 staging, operator import, reconciliation and isolated restore", async (t) => {
  const pg = await PGlite.create(),
    db = await openPgliteDatabase(pg);
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
  const adminId = await fixture("operator", "admin"),
    guruId = await fixture("teacher.one", "guru"),
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
    guru = await login("teacher.one");
  const service = new MigrationService(business),
    ops = new OperationsService(business);
  const source = {
    version: 1,
    source: "fixture-stage8",
    exportedAt: "2026-10-20T00:00:00Z",
    timezone: "Asia/Jakarta",
    locale: "id-ID",
    dateFormat: "ISO",
    sheets: [
      {
        name: "Users",
        headers: ["user_id", "username", "nip", "password"],
        rows: [
          ["0001", "import.one", "0000123", "FORBIDDEN-OLD-PASSWORD"],
          ["0002", "import.two", "0000456", "FORBIDDEN-SECOND"],
        ],
      },
    ],
  };
  let batchId: string;
  const board = async () =>
    (await service.read(admin, "board")) as MigrationBoard;
  const userId = randomUUID(),
    secondId = randomUUID();
  let plan: ImportPlan;
  await t.test(
    "MIG01 five private staging tables enforce owner RLS; runtime auth/worker/raw denied",
    async () => {
      for (const x of [business, authDb, scope("sim_guru_worker")])
        await assert.rejects(() =>
          x.query("select raw_payload from ops.migration_staging_rows"),
        );
      assert.equal(
        (
          await db.query(
            "select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('app','auth_private','ops','finance') and c.relkind='r' and(not relrowsecurity or not relforcerowsecurity)",
          )
        ).rows.length,
        0,
      );
      await assert.rejects(() => service.command(guru, "stage", source));
      await assert.rejects(() => service.read(guru, "board"));
    },
  );
  await t.test(
    "MIG02 staging is idempotent, preserves identifiers and excludes old credentials",
    async () => {
      const v = (await service.command(admin, "stage", source)) as {
        id: string;
        replayed: boolean;
      };
      batchId = v.id;
      assert.equal(v.replayed, false);
      assert.equal(
        (
          (await service.command(admin, "stage", source)) as {
            replayed: boolean;
          }
        ).replayed,
        true,
      );
      const r = (
        await db.query<{ raw_payload: Record<string, unknown> }>(
          "select raw_payload from ops.migration_staging_rows where batch_id=$1 order by row_number",
          [batchId],
        )
      ).rows;
      assert.equal(r[0]!.raw_payload.nip, "0000123");
      assert.equal(JSON.stringify(r).includes("FORBIDDEN"), false);
      assert.equal((await board()).batches[0]!.state, "validated");
    },
  );
  await t.test(
    "MIG03 errors cannot be acknowledged or passed as ready",
    async () => {
      const bad = (await service.command(admin, "stage", {
        ...source,
        source: "invalid-fixture",
        sheets: [
          {
            name: "Users",
            headers: ["user_id", "username", "nip"],
            rows: [["bad", "bad.user", 123]],
          },
        ],
      })) as { id: string };
      await assert.rejects(() =>
        service.command(admin, "resolve", {
          batchId: bad.id,
          version: "1",
          sequence: 1,
          evidence: "Kesalahan tidak boleh diabaikan",
          reason,
        }),
      );
      await assert.rejects(() =>
        service.command(admin, "gate", {
          batchId: bad.id,
          version: "1",
          gate: "source_backup",
          passed: true,
          evidence: "Tidak ada bukti valid untuk data salah",
          reason,
        }),
      );
    },
  );
  await t.test(
    "MIG04 plan fingerprint, maintenance and backup evidence are enforced",
    async () => {
      const b = (await board()).batches.find((x) => x.id === batchId)!;
      plan = {
        version: 1,
        batchId,
        sourceChecksum: b.source_checksum,
        reason,
        entries: [
          {
            sourceTable: "Users",
            legacyId: "0001",
            targetTable: "app.app_users",
            values: {
              id: userId,
              legacy_id: "0001",
              username: "import.one",
              full_name: "Guru Impor Satu",
              role: "guru",
              status: "pending_activation",
              must_change_password: true,
              nip: "0000123",
              km_distance: "1.20",
            },
          },
          {
            sourceTable: "Users",
            legacyId: "0002",
            targetTable: "app.app_users",
            values: {
              id: secondId,
              legacy_id: "0002",
              username: "import.two",
              full_name: "Guru Impor Dua",
              role: "guru",
              status: "pending_activation",
              must_change_password: true,
              nip: "0000456",
            },
          },
        ],
      };
      await assert.rejects(
        () => applyImportPlan(db, plan, "0".repeat(64)),
        /PLAN_HASH_MISMATCH/,
      );
      await assert.rejects(
        () => applyImportPlan(db, plan, planHash(plan)),
        /MAINTENANCE/,
      );
      const o = (await ops.read(admin, "operations")) as {
        config: { version: string; value: Record<string, unknown> };
      };
      await ops.command(admin, "settings", {
        version: o.config.version,
        config: { ...o.config.value, maintenance: true },
        reason,
      });
      await assert.rejects(
        () => applyImportPlan(db, plan, planHash(plan)),
        /EVIDENCE/,
      );
      for (const gate of ["source_backup", "restore_drill", "rollback_plan"]) {
        const current = (await board()).batches.find((x) => x.id === batchId)!;
        await service.command(admin, "gate", {
          batchId,
          version: current.version,
          gate,
          passed: true,
          evidence: "Bukti sintetis khusus database uji disposable",
          reason,
        });
      }
    },
  );
  await t.test(
    "MIG05 invalid second row rolls back first account, mapping and batch state",
    async () => {
      const bad = {
        ...plan,
        entries: [
          plan.entries[0],
          {
            ...plan.entries[1],
            values: { ...plan.entries[1]!.values, username: "operator" },
          },
        ],
      };
      await assert.rejects(() =>
        applyImportPlan(db, bad, planHash(bad as ImportPlan)),
      );
      assert.equal(
        (await db.query("select id from app.app_users where id=$1", [userId]))
          .rows.length,
        0,
      );
      assert.equal(
        (
          await db.query(
            "select 1 from ops.migration_id_map where batch_id=$1",
            [batchId],
          )
        ).rows.length,
        0,
      );
    },
  );
  await t.test(
    "MIG06 apply is atomic/idempotent and imported accounts have no usable credentials",
    async () => {
      assert.deepEqual(await applyImportPlan(db, plan, planHash(plan)), {
        replayed: false,
        inserted: 2,
      });
      assert.deepEqual(await applyImportPlan(db, plan, planHash(plan)), {
        replayed: true,
        inserted: 0,
      });
      assert.equal(
        (
          await db.query(
            "select 1 from auth_private.user_credentials where user_id=$1",
            [userId],
          )
        ).rows.length,
        0,
      );
      const row = (
        await db.query<{ status: string; nip: string }>(
          "select status,nip from app.app_users where id=$1",
          [userId],
        )
      ).rows[0]!;
      assert.equal(row.status, "pending_activation");
      assert.equal(row.nip, "0000123");
      await assert.rejects(() =>
        auth.login(
          { username: "import.one", password },
          randomUUID(),
          randomUUID(),
        ),
      );
      await assert.rejects(
        () =>
          applyImportPlan(
            db,
            { ...plan, reason: "Rencana berbeda setelah impor" },
            planHash({ ...plan, reason: "Rencana berbeda setelah impor" }),
          ),
        /IMMUTABLE/,
      );
    },
  );
  await t.test(
    "MIG07 native typed reconciliation preserves NUMERIC, detects target differences",
    async () => {
      assert.equal((await reconcilePlan(db, plan)).matched, true);
      await db.query("update app.app_users set km_distance=1.21 where id=$1", [
        userId,
      ]);
      assert.equal((await reconcilePlan(db, plan)).matched, false);
      await db.query("update app.app_users set km_distance=1.20 where id=$1", [
        userId,
      ]);
      assert.equal((await reconcilePlan(db, plan)).matched, true);
    },
  );
  await t.test(
    "MIG08 cutover needs all evidence; changing a gate invalidates previous approval",
    async () => {
      let b = (await board()).batches.find((x) => x.id === batchId)!;
      await assert.rejects(() =>
        service.command(admin, "gate", {
          batchId,
          version: b.version,
          gate: "cutover_approval",
          passed: true,
          evidence: "Tidak boleh melewati pemeriksaan lain",
          reason,
        }),
      );
      for (const gate of [
        "reconciliation",
        "parallel_run",
        "uat_admin",
        "uat_guru",
        "legacy_freeze",
        "delta_reconciliation",
      ]) {
        b = (await board()).batches.find((x) => x.id === batchId)!;
        await service.command(admin, "gate", {
          batchId,
          version: b.version,
          gate,
          passed: true,
          evidence: "Bukti sintetis khusus pengujian kesiapan",
          reason,
        });
      }
      b = (await board()).batches.find((x) => x.id === batchId)!;
      await service.command(admin, "gate", {
        batchId,
        version: b.version,
        gate: "cutover_approval",
        passed: true,
        evidence: "Persetujuan sintetis bukan cutover produksi",
        reason,
      });
      b = (await board()).batches.find((x) => x.id === batchId)!;
      assert.equal(
        b.gates.find((g) => g.gate === "cutover_approval")!.passed,
        true,
      );
      await service.command(admin, "gate", {
        batchId,
        version: b.version,
        gate: "uat_guru",
        passed: false,
        evidence: "Bukti UAT dicabut pada fixture pengujian",
        reason,
      });
      b = (await board()).batches.find((x) => x.id === batchId)!;
      assert.equal(
        b.gates.find((g) => g.gate === "cutover_approval")!.passed,
        false,
      );
    },
  );
  await t.test(
    "MIG11 historical honor is imported exactly, immutable and locks its period",
    async () => {
      const batch = randomUUID(),
        period = randomUUID(),
        statement = randomUUID();
      await db.query(
        "insert into ops.migration_batches(id,source,source_checksum,exported_at,state,summary,metadata,created_by) values($1,'history-fixture',$2,clock_timestamp(),'validated','{}','{}',$3)",
        [batch, "a".repeat(64), adminId],
      );
      await db.query(
        "insert into ops.migration_staging_rows(batch_id,source_table,row_number,legacy_id,raw_payload,normalized_payload) values($1,'Honor_History',2,'hist1','{}','{}')",
        [batch],
      );
      for (const gate of ["source_backup", "restore_drill", "rollback_plan"])
        await db.query(
          "insert into ops.migration_gates(batch_id,gate,passed,evidence,actor_id) values($1,$2,true,'Synthetic operator proof only',$3)",
          [batch, gate, adminId],
        );
      const historical: ImportPlan = {
        version: 1,
        batchId: batch,
        sourceChecksum: "a".repeat(64),
        reason,
        entries: [
          {
            sourceTable: "Honor_History",
            legacyId: "hist1",
            targetTable: "finance.honor_periods",
            values: {
              id: period,
              period_start: "2024-01-01",
              state: "final",
              finalized_at: "2024-02-01T00:00:00Z",
              formula_version: "legacy",
            },
          },
          {
            sourceTable: "Honor_History",
            legacyId: "hist1",
            targetTable: "finance.honor_statements",
            values: {
              id: statement,
              period_id: period,
              user_id: otherId,
              trx_id: "LEGACY-SYNTHETIC-01",
              snapshot: {
                formulaVersion: "legacy",
                total: "9007199254740993",
                totalJtm: "1.2345",
              },
              total_jtm: "1.2345",
              total_honor: "9007199254740993",
              checksum: "b".repeat(64),
            },
          },
        ],
      };
      const unsafe = structuredClone(historical);
      unsafe.entries[1]!.values.total_honor = 9007199254740992;
      await assert.rejects(
        () => applyImportPlan(db, unsafe, planHash(unsafe)),
        /EXACT_NUMERIC_STRING_REQUIRED/,
      );
      await applyImportPlan(db, historical, planHash(historical));
      assert.equal(
        (
          await db.query(
            "select total_honor::text value from finance.honor_statements where id=$1",
            [statement],
          )
        ).rows[0]!.value,
        "9007199254740993",
      );
      assert.ok(
        (
          await db.query(
            "select finalized_at from finance.period_guards where period_start='2024-01-01'",
          )
        ).rows[0]!.finalized_at,
      );
      await assert.rejects(
        () =>
          db.query(
            "update finance.honor_statements set total_honor=1 where id=$1",
            [statement],
          ),
        /FINAL_IMMUTABLE/,
      );
      await assert.rejects(
        () => db.query("select finance.guard_open('2024-01-15'::date)"),
        /FINAL_PERIOD/,
      );
      assert.equal((await reconcilePlan(db, historical)).matched, true);
    },
  );
  await t.test(
    "MIG09 AES-GCM authenticates archives and rejects corruption/wrong keys",
    async () => {
      const key = randomBytes(32).toString("hex"),
        plain = Buffer.from(
          "Disposable fixture archive, not production backup",
        );
      const encrypted = encryptBackup(plain, key);
      assert.deepEqual(decryptBackup(encrypted.data, encrypted, key), plain);
      const broken = Buffer.from(encrypted.data);
      broken[0] = broken[0]! ^ 1;
      assert.throws(() => decryptBackup(broken, encrypted, key));
      assert.throws(() =>
        decryptBackup(
          encrypted.data,
          encrypted,
          randomBytes(32).toString("hex"),
        ),
      );
    },
  );
  await t.test(
    "MIG10 WASM snapshot restores rows, finance fingerprints, role isolation and RLS",
    async () => {
      const before = await restoreInventory(db),
        archive = await pg.dumpDataDir();
      const restored = await PGlite.create({ loadDataDir: archive }),
        copy = await openPgliteDatabase(restored);
      try {
        const after = await restoreInventory(copy);
        assert.deepEqual(after, before);
        assert.equal(after.rls, true);
        assert.equal(after.roles.length, 5);
        assert.ok(after.roles.every((r) => r.safe));
        await copy.exec("SET SESSION AUTHORIZATION sim_guru_business");
        await assert.rejects(() =>
          copy.query("select * from auth_private.user_credentials"),
        );
        await copy.exec("SET SESSION AUTHORIZATION postgres");
      } finally {
        await copy.close();
      }
    },
  );
  void guruId;
  void adminId;
  void otherId;
});
