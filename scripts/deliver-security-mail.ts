import postgres from "postgres";
import { requireEnvironment } from "../src/server/env";
import {
  ResendMailAdapter,
  SecurityOutboxWorker,
} from "../src/server/mail/security-outbox";
import type { SqlExecutor, SqlParameter } from "./lib/sql-database";
async function main() {
  const mail = requireEnvironment("mail"),
    auth = requireEnvironment("auth"),
    core = requireEnvironment("core");
  const url = process.env.WORKER_DATABASE_URL;
  if (!url) throw new Error("WORKER_DATABASE_URL_REQUIRED");
  const parsed = new URL(url);
  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    !decodeURIComponent(parsed.username).startsWith("sim_guru_worker_login")
  )
    throw new Error("WORKER_IDENTITY_REQUIRED");
  const client = postgres(url, {
    max: 1,
    prepare: false,
    ssl: {
      rejectUnauthorized: true,
      ...(process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA } : {}),
    },
    connect_timeout: 10,
    onnotice: () => {},
  });
  try {
    const db: SqlExecutor = {
      exec: async (sql) => {
        await client.unsafe(sql).simple();
      },
      query: async <T extends Record<string, unknown>>(
        sql: string,
        args: readonly SqlParameter[] = [],
      ) => ({ rows: [...(await client.unsafe<T[]>(sql, [...args]))] }),
    };
    const worker = new SecurityOutboxWorker(
      db,
      new ResendMailAdapter(mail.MAIL_API_KEY, mail.MAIL_FROM),
      auth.AUTH_OUTBOX_ENCRYPTION_KEY,
      core.APP_URL,
    );
    let processed = 0;
    for (let i = 0; i < 10; i++) {
      const result = await worker.deliverOne();
      processed += result.processed;
      if (result.processed === 0) break;
    }
    console.log(JSON.stringify({ ok: true, processed }));
  } finally {
    await client.end({ timeout: 5 });
  }
}
main().catch(() => {
  console.error(
    JSON.stringify({ ok: false, code: "SECURITY_MAIL_DELIVERY_UNAVAILABLE" }),
  );
  process.exitCode = 1;
});
