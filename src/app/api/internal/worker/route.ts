import { getWorkerDatabase } from "@/server/auth/runtime";
import { requireEnvironment } from "@/server/env";
import { DomainOutboxWorker } from "@/server/operations/worker";
import { SecurityOutboxWorker } from "@/server/mail/security-outbox";
import { createMailAdapter } from "@/server/mail/adapter";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request) {
  const token =
    request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!/^[a-f0-9]{96}$/.test(token))
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const db = getWorkerDatabase();
  const allowed = (
    await db.query<{ ok: boolean }>(
      "select ops.consume_worker_ticket($1) as ok",
      [token],
    )
  ).rows[0]!.ok;
  if (!allowed)
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  await db.query("select ops.cleanup()");
  const jobs = await db.transaction(async (tx) => {
    await tx.exec("set local statement_timeout='30s'");
    return (await tx.query<{ value: unknown }>("select ops.run_jobs() value"))
      .rows[0]!.value;
  });
  const policy = (
    await db.query<{ value: { securityMailEnabled: boolean } }>(
      "select ops.worker_policy() value",
    )
  ).rows[0]!.value;
  const mail = createMailAdapter(requireEnvironment("mail"));
  const security = new SecurityOutboxWorker(
    db,
    mail,
    requireEnvironment("auth").AUTH_OUTBOX_ENCRYPTION_KEY,
    requireEnvironment("core").APP_URL,
  );
  const domain = new DomainOutboxWorker(db, mail);
  // Separate bounded batches: security remains available during maintenance.
  const [secured, business] = await Promise.all([
    policy.securityMailEnabled
      ? Promise.all(Array.from({ length: 3 }, () => security.deliverOne()))
      : Promise.resolve([]),
    Promise.all(Array.from({ length: 5 }, () => domain.deliverOne())),
  ]);
  return Response.json(
    { jobs, security: secured, domain: business },
    { headers: { "Cache-Control": "no-store" } },
  );
}
