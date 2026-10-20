import "server-only";
import type { SqlExecutor } from "../../../scripts/lib/sql-database";
import type { MailAdapter } from "../mail/security-outbox";
export class DomainOutboxWorker {
  constructor(
    private readonly db: SqlExecutor,
    private readonly mail: MailAdapter,
  ) {}
  async deliverOne() {
    const job = (
      await this.db.query<{
        value: {
          id: string;
          lease: string;
          to: string;
          subject: string;
          text: string;
        } | null;
      }>("select ops.domain_claim() as value")
    ).rows[0]!.value;
    if (!job) return { processed: 0 };
    // Unclassified adapter exceptions are ambiguous, never automatically resend.
    let result: "sent" | "retry_wait" | "failed" | "unknown";
    try {
      result = await this.mail.send(job);
    } catch {
      result = "unknown";
    }
    const finished = (
      await this.db.query<{ ok: boolean }>(
        "select ops.domain_finish($1,$2,$3) as ok",
        [job.id, job.lease, result],
      )
    ).rows[0]!.ok;
    return { processed: 1, result: finished ? result : "lease_lost" };
  }
}
