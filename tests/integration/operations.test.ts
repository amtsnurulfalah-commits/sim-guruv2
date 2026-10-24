import test from "node:test";
import {
  caseDetailSchema,
  caseListSchema,
  monitorSchema,
} from "../../src/lib/operations/support-cases";
import { operationsSchema } from "../../src/lib/operations/operational-contracts";
import { deliverBatch } from "../../src/server/operations/batch";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { openPgliteDatabase } from "../helpers/pglite-database";
import { applyMigrations, readMigrations } from "../../scripts/lib/migrations";
import {
  sqlJson,
  type SqlDatabase,
  type SqlExecutor,
  type SqlParameter,
} from "../../scripts/lib/sql-database";
import { getPasswordService } from "../../src/server/auth/passwords";
import { tokenHash, LocalAuthService } from "../../src/server/auth/service";
import { OperationsService } from "../../src/server/operations/service";
import { DomainOutboxWorker } from "../../src/server/operations/worker";
import type {
  Announcement,
  Operations,
} from "../../src/lib/operations/schemas";
const password = "H9!vL4#qT8@bP2$wF7&z",
  reason = "Pengujian operasional sintetis";
test("Tahap 7 announcements, maintenance, fenced worker and scheduler", async (t) => {
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
    guru = await login("teacher.one"),
    other = await login("teacher.two");
  const service = new OperationsService(business),
    worker = scope("sim_guru_worker");
  await t.test(
    "support references are durable, admin-only, bounded and contain no submitted values",
    async () => {
      const reference = randomUUID();
      await authDb.query(
        "select ops.record_support_event($1,clock_timestamp(),'activities','JOURNAL_BLOCKED',403)",
        [reference],
      );
      const report = (await service.read(admin, "support", {
        reference,
      })) as Record<string, unknown>;
      assert.equal(report.requestId, reference);
      assert.equal(report.module, "activities");
      assert.equal(report.code, "JOURNAL_BLOCKED");
      assert.deepEqual(Object.keys(report).sort(), [
        "code",
        "module",
        "occurredAt",
        "requestId",
        "status",
      ]);
      await assert.rejects(
        service.read(guru, "support", { reference }),
        /FORBIDDEN/,
      );
      await assert.rejects(
        service.read(other, "support", { reference }),
        /FORBIDDEN/,
      );
      await assert.rejects(
        service.read("invalid-session", "support", { reference }),
        /UNAUTHENTICATED/,
      );
      await assert.rejects(
        business.query("select * from ops.support_events"),
        /permission denied/,
      );
      await assert.rejects(
        authDb.query("select * from ops.support_events"),
        /permission denied/,
      );
      await assert.rejects(
        business.query(
          "select ops.record_support_event($1,clock_timestamp(),'activities','FORBIDDEN',403)",
          [randomUUID()],
        ),
        /permission denied/,
      );
      assert.equal(
        await service.read(admin, "support", { reference: randomUUID() }),
        null,
      );
      await assert.rejects(
        service.read(admin, "support", { reference: "bad" }),
      );
      await authDb.query(
        "select ops.record_support_event($1,clock_timestamp(),'auth','FORBIDDEN',403)",
        [reference],
      );
      assert.equal(
        (
          (await service.read(admin, "support", { reference })) as Record<
            string,
            unknown
          >
        ).module,
        "activities",
      );
      const expired = randomUUID();
      await authDb.query(
        "select ops.record_support_event($1,clock_timestamp()-interval '31 days','auth','FORBIDDEN',403)",
        [expired],
      );
      assert.equal(
        await service.read(admin, "support", { reference: expired }),
        null,
      );
    },
  );
  await t.test(
    "S4 cases preserve references, CAS/retry, verified context and immutable decision history",
    async () => {
      const reference = randomUUID(),
        second = randomUUID();
      for (const ref of [reference, second])
        await authDb.query(
          "select ops.record_support_event($1,clock_timestamp(),'activities','JOURNAL_BLOCKED',403)",
          [ref],
        );
      const create = {
        operation: "create",
        operationKey: randomUUID(),
        reference,
        title: "Jurnal tidak dapat disimpan",
        summary: "Guru menghubungi admin setelah kegiatan pembelajaran",
        reporterId: guruId,
        reporterVerified: true,
        reason,
      };
      const created = (await service.command(
        admin,
        "support-case",
        create,
      )) as { id: string; version: string };
      assert.deepEqual(
        await service.command(admin, "support-case", create),
        created,
      );
      await assert.rejects(
        () =>
          service.command(admin, "support-case", {
            ...create,
            title: "Isi berbeda untuk operation key sama",
          }),
        /VERSION_CONFLICT/,
      );
      assert.equal(
        caseListSchema.parse(
          await service.read(admin, "support-cases", { kind: "list" }),
        ).total,
        1,
      );
      for (const token of [guru, other]) {
        await assert.rejects(
          () =>
            service.read(token, "support-cases", {
              kind: "detail",
              id: created.id,
            }),
          /FORBIDDEN/,
        );
        await assert.rejects(
          () => service.read(token, "support-monitor"),
          /FORBIDDEN/,
        );
        await assert.rejects(
          () =>
            service.command(token, "support-case", {
              ...create,
              operationKey: randomUUID(),
            }),
          /FORBIDDEN/,
        );
      }
      const update = (
        version: string,
        status: string,
        extra: Record<string, unknown> = {},
      ) =>
        service.command(admin, "support-case", {
          operation: "update",
          operationKey: randomUUID(),
          id: created.id,
          version,
          status,
          ownerId: adminId,
          reason,
          ...extra,
        });
      await assert.rejects(
        () =>
          update("1", "resolved", {
            resolution: "Perbaikan tervalidasi",
            verification: "Guru telah menguji ulang",
          }),
        /SUPPORT_TRANSITION_INVALID/,
      );
      await update("1", "reviewed");
      await assert.rejects(() => update("1", "processing"), /VERSION_CONFLICT/);
      await assert.rejects(
        () => update("2", "processing", { ownerId: guruId }),
        /SUPPORT_INVALID/,
      );
      await update("2", "processing");
      await service.command(admin, "support-case", {
        operation: "link",
        operationKey: randomUUID(),
        id: created.id,
        version: "3",
        reference: second,
        reason,
      });
      await assert.rejects(() => update("4", "resolved"));
      await update("4", "resolved", {
        resolution: "Pemblokiran sumber telah diperiksa dan diperbaiki",
        verification: "Guru mencoba kembali dan memastikan berhasil",
      });
      let detail = caseDetailSchema.parse(
        await service.read(admin, "support-cases", {
          kind: "detail",
          id: created.id,
        }),
      );
      assert.equal(detail.status, "resolved");
      assert.equal(detail.references.length, 2);
      assert.equal(detail.reporter_verified, true);
      assert.equal(detail.history.length, 5);
      assert.equal(
        detail.history.at(-1)!.changes.after.verification,
        "Guru mencoba kembali dan memastikan berhasil",
      );
      await assert.rejects(
        () =>
          db.exec(
            "update ops.support_case_history set note='Mengganti riwayat lama'",
          ),
        /FINAL_IMMUTABLE/,
      );
      assert.equal(
        (
          await db.query(
            "select 1 from ops.activity_revisions where entity_kind like 'support-%' and reason=$1",
            [reason],
          )
        ).rows.length,
        0,
        "free-text notes must not be copied into long-lived business audit",
      );

      await update("5", "new", {
        reason: "Pengguna mengalami kendala yang sama lagi",
      });
      detail = caseDetailSchema.parse(
        await service.read(admin, "support-cases", {
          kind: "detail",
          id: created.id,
        }),
      );
      assert.equal(detail.status, "new");
      assert.equal(detail.closed_at, null);
      assert.equal(detail.history.length, 6);
      for (const table of [
        "support_cases",
        "support_case_references",
        "support_case_history",
        "request_metrics",
      ])
        await assert.rejects(
          () => business.query("select * from ops." + table),
          /permission denied/,
        );
      await assert.rejects(
        () => business.query("select ops.support_purge()"),
        /permission denied/,
      );
      await assert.rejects(
        () => authDb.query("select * from ops.support_case_history"),
        /permission denied/,
      );
      await assert.rejects(() =>
        service.command(admin, "support-case", {
          operation: "note",
          operationKey: randomUUID(),
          id: created.id,
          version: "6",
          reason: "password=super-secret-value",
        }),
      );
      await db.query(
        "update ops.support_events set occurred_at=clock_timestamp()-interval '31 days' where request_id=$1",
        [reference],
      );
      const purge = (await service.command(admin, "support-case", {
        operation: "purge",
        operationKey: randomUUID(),
        reason,
      })) as { events: number };
      assert.ok(purge.events >= 1);
      assert.equal(
        caseListSchema.parse(
          await service.read(admin, "support-cases", {
            kind: "list",
            q: reference,
          }),
        ).total,
        1,
      );
      detail = caseDetailSchema.parse(
        await service.read(admin, "support-cases", {
          kind: "detail",
          id: created.id,
        }),
      );
      assert.equal(
        detail.references.length,
        2,
        "linked snapshots survive raw log expiry",
      );
      await update("6", "reviewed");
      await update("7", "processing");
      await update("8", "resolved", {
        resolution: "Perbaikan ulang setelah peninjauan",
        verification: "Pengguna telah mengonfirmasi berhasil",
      });
      await db.query(
        "update ops.support_cases set closed_at=clock_timestamp()-interval '366 days' where id=$1",
        [created.id],
      );
      await assert.rejects(
        () =>
          service.read(admin, "support-cases", {
            kind: "detail",
            id: created.id,
          }),
        /NOT_FOUND/,
      );
      await service.command(admin, "support-case", {
        operation: "purge",
        operationKey: randomUUID(),
        reason,
      });
      assert.equal(
        (
          await db.query(
            "select 1 from ops.support_case_history where case_id=$1",
            [created.id],
          )
        ).rows.length,
        0,
      );
      assert.equal(
        (
          await db.query(
            "select 1 from ops.support_case_references where case_id=$1",
            [created.id],
          )
        ).rows.length,
        0,
      );
    },
  );
  await t.test(
    "S4 monitoring records numeric-only module timing, accurate state counts and actionable thresholds",
    async () => {
      for (let i = 0; i < 10; i++)
        await authDb.query(
          "select ops.record_request_metric('activities',200,3000)",
        );
      await assert.rejects(
        () =>
          authDb.query(
            "select ops.record_request_metric('secret@email.test',200,1)",
          ),
        /SUPPORT_INVALID/,
      );
      const messageId = randomUUID();
      await db.query(
        "insert into ops.domain_outbox(id,dedupe_key,recipient_id,subject,body,state) values($1,$2,$3,'Sintetis','Tidak dikirim','unknown')",
        [messageId, "diagnostic:" + messageId, guruId],
      );
      await db.exec(
        "insert into ops.job_runs(business_key,kind,state) values('diagnostic-test','synthetic','failed')",
      );
      const monitor = monitorSchema.parse(
        await service.read(admin, "support-monitor"),
      );
      assert.ok(monitor.samples >= 10);
      assert.equal(monitor.averageMs, 3000);
      assert.ok(monitor.alerts.some((a) => a.code === "SLOW_API"));
      assert.ok(monitor.alerts.some((a) => a.code === "FAILED_MESSAGES"));
      assert.ok(monitor.alerts.some((a) => a.code === "FAILED_JOBS"));
      const serialized = JSON.stringify(monitor);
      assert.equal(serialized.includes("Tidak dikirim"), false);
      assert.equal(serialized.includes("@example.test"), false);
      assert.equal(serialized.includes("public_payload"), false);
      await db.query("delete from ops.domain_outbox where id=$1", [messageId]);
      await db.exec(
        "delete from ops.job_runs where business_key='diagnostic-test'",
      );
      await db.exec(
        "update ops.request_metrics set bucket=bucket-interval '31 days'",
      );
      assert.equal(
        monitorSchema.parse(await service.read(admin, "support-monitor"))
          .samples,
        0,
      );
      await service.command(admin, "support-case", {
        operation: "purge",
        operationKey: randomUUID(),
        reason,
      });
      assert.equal(
        (await db.query("select * from ops.request_metrics")).rows.length,
        0,
      );
    },
  );
  const base = {
    title: "Informasi",
    body: "Teks <script> tetap teks",
    severity: "info",
    active: true,
    targetRole: "all",
    dismissible: true,
    sendEmail: true,
    reason,
  };
  let a: Announcement;
  const list = async (token: string) =>
    (await service.read(token, "announcements")) as Announcement[];
  await t.test(
    "OP01 owner-only RLS, runtime roles cannot read payloads or issue tickets",
    async () => {
      for (const role of [business, authDb, worker])
        await assert.rejects(() =>
          role.query("select * from ops.domain_outbox"),
        );
      await assert.rejects(() =>
        worker.query("select ops.issue_worker_ticket()"),
      );
      assert.equal(
        (
          await db.query(
            "select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('app','ops','finance','auth_private') and c.relkind='r' and (not relrowsecurity or not relforcerowsecurity)",
          )
        ).rows.length,
        0,
      );
    },
  );
  await t.test(
    "OP02 admin CRUD, private user precedence and hidden recipient lists",
    async () => {
      await assert.rejects(() => service.command(guru, "save", base));
      await service.command(admin, "save", {
        ...base,
        targetRole: "admin",
        targetUsers: [guruId],
      });
      a = (await list(guru))[0]!;
      assert.ok(a);
      assert.equal((await list(admin)).length, 0);
      assert.equal((await list(other)).length, 0);
      assert.equal(a.target_users, undefined);
    },
  );
  await t.test(
    "OP03 dismiss per user/version and update resurfaces",
    async () => {
      await service.command(guru, "dismiss", {
        id: a.id,
        version: String(a.version),
      });
      assert.equal((await list(guru)).length, 0);
      await service.command(admin, "save", {
        ...base,
        id: a.id,
        version: String(a.version),
        targetUsers: [guruId],
      });
      a = (await list(guru))[0]!;
      assert.equal(a.version, 2);
      await assert.rejects(() =>
        service.command(admin, "save", { ...base, id: a.id, version: "1" }),
      );
    },
  );
  await t.test(
    "OP04 contradictory overrides, invalid CTA and reversed dates rejected",
    async () => {
      await assert.rejects(
        () =>
          service.command(admin, "save", {
            ...base,
            ctaText: "Buka",
            ctaUrl: "not-a-url",
          }),
        { name: "ZodError" },
      );
      for (const d of [
        { allowDismiss: [guruId], denyDismiss: [guruId] },
        { ctaText: "Klik", ctaUrl: "javascript:alert(1)" },
        { ctaText: "Klik", ctaUrl: "https://user:pass@example.test" },
        { from: "2090-02-02", to: "2090-01-01" },
      ])
        await assert.rejects(() =>
          service.command(admin, "save", { ...base, ...d }),
        );
    },
  );
  const settings = async (change: Record<string, unknown>) => {
    const d = (await service.read(admin, "operations")) as Operations;
    await service.command(admin, "settings", {
      version: d.config.version,
      config: { ...d.config.value, ...change },
      reason,
    });
  };
  await t.test(
    "OP05 non-dismissible override and admin always closes",
    async () => {
      await service.command(admin, "save", {
        ...base,
        id: a.id,
        version: String(a.version),
        targetRole: "all",
        dismissible: false,
        allowDismiss: [otherId],
        denyDismiss: [guruId],
      });
      a = (await list(guru))[0]!;
      assert.equal(a.canDismiss, false);
      await assert.rejects(() =>
        service.command(guru, "dismiss", {
          id: a.id,
          version: String(a.version),
        }),
      );
      await service.command(other, "dismiss", {
        id: a.id,
        version: String(a.version),
      });
      await service.command(admin, "dismiss", {
        id: a.id,
        version: String(a.version),
      });
    },
  );
  await t.test(
    "OP06 defaults fail closed and notification generation is idempotent",
    async () => {
      assert.deepEqual(
        (
          await worker.query<{ value: unknown }>(
            "select ops.run_jobs() as value",
          )
        ).rows[0]!.value,
        { paused: true },
      );
      assert.equal(
        (
          await worker.query<{ value: unknown }>(
            "select ops.domain_claim() as value",
          )
        ).rows[0]!.value,
        null,
      );
      await settings({ jobsEnabled: true });
      await db.query("select ops.enqueue_announcements()");
      const n = (
        await db.query<{ n: number }>(
          "select count(*)::int n from ops.domain_outbox",
        )
      ).rows[0]!.n;
      await db.query("select ops.enqueue_announcements()");
      assert.equal(
        (
          await db.query<{ n: number }>(
            "select count(*)::int n from ops.domain_outbox",
          )
        ).rows[0]!.n,
        n,
      );
      assert.ok(n > 0);
    },
  );
  await t.test(
    "OP07 SMTP adapter uses active verified contact email and persistent sent status",
    async () => {
      await settings({ mailEnabled: true });
      let sends = 0;
      const delivery = new DomainOutboxWorker(worker, {
        send: async (m) => {
          sends++;
          assert.ok(m.to.endsWith("@example.test"));
          return "sent";
        },
      });
      assert.equal((await delivery.deliverOne()).result, "sent");
      assert.equal(sends, 1);
    },
  );
  await t.test(
    "OP08 fencing rejects wrong lease and expired sending is ambiguous",
    async () => {
      const v = (
        await worker.query<{ value: { id: string; lease: string } }>(
          "select ops.domain_claim() as value",
        )
      ).rows[0]!.value;
      assert.ok(v);
      assert.equal(
        (
          await worker.query<{ ok: boolean }>(
            "select ops.domain_finish($1,$2,'sent') ok",
            [v.id, randomUUID()],
          )
        ).rows[0]!.ok,
        false,
      );
      await db.query(
        "update ops.domain_outbox set lease_until=clock_timestamp()-interval '1 second' where id=$1",
        [v.id],
      );
      await worker.query("select ops.domain_claim()");
      assert.equal(
        (
          await db.query<{ state: string }>(
            "select state from ops.domain_outbox where id=$1",
            [v.id],
          )
        ).rows[0]!.state,
        "unknown",
      );
      await assert.rejects(() =>
        service.command(admin, "retry", { id: v.id, reason }),
      );
      await service.command(admin, "reconcile", {
        id: v.id,
        sent: false,
        reason,
      });
    },
  );
  await t.test(
    "OP09 transient retry exhausted at five and no blind retry for unknown",
    async () => {
      await db.query(
        "update ops.domain_outbox set state='cancelled' where state in('pending','retry_wait','sending')",
      );
      const id = (
        await db.query<{ id: string }>(
          "insert into ops.domain_outbox(dedupe_key,recipient_id,subject,body,attempts) values('retry-test',$1,'Test','Test',4) returning id",
          [guruId],
        )
      ).rows[0]!.id;
      const v = (
        await worker.query<{ value: { id: string; lease: string } }>(
          "select ops.domain_claim() as value",
        )
      ).rows[0]!.value;
      assert.equal(v.id, id);
      await worker.query("select ops.domain_finish($1,$2,'retry_wait')", [
        id,
        v.lease,
      ]);
      assert.equal(
        (
          await db.query<{ state: string }>(
            "select state from ops.domain_outbox where id=$1",
            [id],
          )
        ).rows[0]!.state,
        "failed",
      );
      await service.command(admin, "retry", { id, reason });
    },
  );
  await t.test(
    "operational DTO and optimistic configuration updates preserve admin-only access",
    async () => {
      const current = operationsSchema.parse(
        await service.read(admin, "operations"),
      );
      await assert.rejects(service.read(guru, "operations"), /FORBIDDEN/);
      const input = {
        version: current.config.version,
        config: current.config.value,
        reason,
      };
      await assert.rejects(
        service.command(guru, "settings", input),
        /FORBIDDEN/,
      );
      await service.command(admin, "settings", input);
      await assert.rejects(
        service.command(admin, "settings", input),
        /VERSION_CONFLICT/,
      );
      const latest = operationsSchema.parse(
        await service.read(admin, "operations"),
      );
      assert.equal(
        BigInt(latest.config.version),
        BigInt(current.config.version) + 1n,
      );
      assert.deepEqual(latest.config.value, current.config.value);
    },
  );
  await t.test(
    "manual job retry resets only failed work and reports changed state as a conflict",
    async () => {
      const key = "audit-job:" + randomUUID();
      await db.query(
        "insert into ops.job_runs(business_key,kind,state,attempts,next_attempt_at) values($1,'honor','failed',5,clock_timestamp()+interval '1 hour')",
        [key],
      );
      await service.command(admin, "job-retry", { key, reason });
      const row = (
        await db.query<{ attempts: number; state: string; ready: boolean }>(
          "select attempts,state,next_attempt_at<=clock_timestamp() ready from ops.job_runs where business_key=$1",
          [key],
        )
      ).rows[0]!;
      assert.equal(row.attempts, 0);
      assert.equal(row.state, "failed");
      assert.equal(row.ready, true);
      await db.query(
        "update ops.job_runs set state='completed' where business_key=$1",
        [key],
      );
      await assert.rejects(
        service.command(admin, "job-retry", { key, reason }),
        { name: "Error", message: "RETRY_NOT_ALLOWED", status: 409 },
      );
    },
  );
  await t.test(
    "OP10 immediate/scheduled maintenance denies business and pauses domain but keeps security accessible",
    async () => {
      await settings({ maintenance: true });
      await assert.rejects(() => service.read(guru, "announcements"));
      assert.ok(await auth.requireSession(guru, false));
      assert.ok(await service.read(admin, "operations"));
      assert.equal(
        (
          await worker.query<{ value: unknown }>(
            "select ops.domain_claim() as value",
          )
        ).rows[0]!.value,
        null,
      );
      await settings({
        maintenance: false,
        maintenanceStart: new Date(Date.now() - 60000).toISOString(),
        maintenanceEnd: new Date(Date.now() + 60000).toISOString(),
      });
      await assert.rejects(() => service.read(guru, "announcements"));
      await settings({ maintenanceStart: null, maintenanceEnd: null });
      assert.ok(await list(guru));
    },
  );
  await t.test(
    "OP11 worker ticket single use, expiry and no permanent secret in scheduler",
    async () => {
      const ticket = (
        await db.query<{ ticket: string }>(
          "select ops.issue_worker_ticket() ticket",
        )
      ).rows[0]!.ticket;
      assert.equal(ticket.length, 96);
      assert.equal(
        (
          await worker.query<{ ok: boolean }>(
            "select ops.consume_worker_ticket($1) ok",
            [ticket],
          )
        ).rows[0]!.ok,
        true,
      );
      assert.equal(
        (
          await worker.query<{ ok: boolean }>(
            "select ops.consume_worker_ticket($1) ok",
            [ticket],
          )
        ).rows[0]!.ok,
        false,
      );
      const second = (
        await db.query<{ ticket: string }>(
          "select ops.issue_worker_ticket() ticket",
        )
      ).rows[0]!.ticket;
      await db.query(
        "update ops.worker_tickets set expires_at=clock_timestamp()-interval '1 second'",
      );
      assert.equal(
        (
          await worker.query<{ ok: boolean }>(
            "select ops.consume_worker_ticket($1) ok",
            [second],
          )
        ).rows[0]!.ok,
        false,
      );
    },
  );
  await t.test(
    "OP12 outbox payloads absent from administrative monitoring",
    async () => {
      const d = (await service.read(admin, "operations")) as Operations;
      assert.ok(d.outbox.length);
      for (const x of d.outbox) {
        assert.equal("body" in x, false);
        assert.equal("recipient_email" in x, false);
        assert.equal("lease_token" in x, false);
      }
    },
  );
  await t.test(
    "OP13 default worker cannot execute finance core or arbitrary business entrypoints",
    async () => {
      await assert.rejects(() =>
        worker.query("select finance.finalize_core(date '2026-09-01',null)"),
      );
      await assert.rejects(() =>
        worker.query("select app.operations_read('fake','manage')"),
      );
    },
  );
  await t.test(
    "OP14 dashboard reads own effective data without materializing domain rows",
    async () => {
      const before = (
        await db.query<{ n: number }>(
          "select count(*)::int n from app.activity_occurrences",
        )
      ).rows[0]!.n;
      const own = (
        await business.query<{
          value: {
            tasks: unknown[];
            planned: unknown[];
            admin: unknown;
            honor: { recipient: { id: string } };
          };
        }>("select app.dashboard_summary($1) value", [tokenHash(guru)])
      ).rows[0]!.value;
      assert.deepEqual(own.tasks, []);
      assert.deepEqual(own.planned, []);
      assert.equal(own.admin, null);
      assert.equal(own.honor.recipient.id, guruId);
      assert.equal(
        (
          await db.query<{ n: number }>(
            "select count(*)::int n from app.activity_occurrences",
          )
        ).rows[0]!.n,
        before,
      );
      const administrative = (
        await business.query<{ value: { admin: { activeUsers: number } } }>(
          "select app.dashboard_summary($1) value",
          [tokenHash(admin)],
        )
      ).rows[0]!.value;
      assert.equal(administrative.admin.activeUsers, 3);
    },
  );
  await t.test(
    "OP15 scheduler safely dispatches without SMTP and notifications remain deduplicated",
    async () => {
      await settings({ jobsEnabled: true, mailEnabled: false });
      const first = (
        await worker.query<{ value: { announcements: number; honor: number } }>(
          "select ops.run_jobs() value",
        )
      ).rows[0]!.value;
      assert.equal(typeof first.announcements, "number");
      const second = (
        await worker.query<{ value: { announcements: number; honor: number } }>(
          "select ops.run_jobs() value",
        )
      ).rows[0]!.value;
      assert.equal(second.announcements, 0);
      assert.equal(second.honor, 0);
    },
  );
  await t.test(
    "OP16 batches serialize one-connection work, stop empty and respect time budget",
    async () => {
      let active = 0,
        max = 0,
        calls = 0;
      const batch = await deliverBatch(
        {
          deliverOne: async () => {
            active++;
            max = Math.max(max, active);
            await new Promise((r) => setTimeout(r, 1));
            active--;
            calls++;
            return { processed: 1 };
          },
        },
        5,
        100,
        () => 0,
      );
      assert.equal(batch.length, 5);
      assert.equal(calls, 5);
      assert.equal(max, 1);
      calls = 0;
      await deliverBatch(
        {
          deliverOne: async () => {
            calls++;
            return { processed: 0 };
          },
        },
        5,
        100,
        () => 0,
      );
      assert.equal(calls, 1);
      calls = 0;
      await deliverBatch(
        {
          deliverOne: async () => {
            calls++;
            return { processed: 1 };
          },
        },
        5,
        100,
        () => 100,
      );
      assert.equal(calls, 0);
    },
  );
  void adminId;
  void sqlJson;
});
