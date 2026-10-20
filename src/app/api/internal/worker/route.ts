import { deliverBatch } from "@/server/operations/batch";
import { getWorkerDatabase } from "@/server/auth/runtime";
import { requireEnvironment } from "@/server/env";
import { DomainOutboxWorker } from "@/server/operations/worker";
import { SecurityOutboxWorker } from "@/server/mail/security-outbox";
import { createMailAdapter } from "@/server/mail/adapter";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request) {
  const deadline = Date.now() + 25000;
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
  // max=1 database pool: never overlap claim queries. Leave time for SMTP completion.
  const secured = policy.securityMailEnabled
    ? await deliverBatch(security, 3, deadline)
    : [];
  const business = await deliverBatch(domain, 5, deadline);
  return Response.json(
    { jobs, security: secured, domain: business },
    { headers: { "Cache-Control": "no-store" } },
  );
}
