import { randomBytes } from "node:crypto";
import { getAuthClient, getBusinessClient, closeDatabaseClients } from "../src/server/db/client";
import { getAuthService } from "../src/server/auth/runtime";
import { getPasswordService } from "../src/server/auth/passwords";

async function main() {
  if (process.env.NODE_ENV !== "production") throw new Error("PRODUCTION_ENV_REQUIRED");
  const checks: string[] = [];
  const targets = [[getBusinessClient(), "sim_guru_business_login", "sim_guru_business"], [getAuthClient(), "sim_guru_auth_login", "sim_guru_auth"]] as const;
  for (const [sql, login, group] of targets) {
    const rows = await sql<{ username: string; correct_group: boolean; owner: boolean; superuser: boolean; bypass: boolean; credentials: boolean; tls: boolean }[]>`
      select current_user::text as username,
      pg_has_role(current_user,${group},'MEMBER') as correct_group,
      pg_has_role(current_user,'sim_guru_owner','MEMBER') as owner,
      (select rolsuper from pg_roles where rolname=current_user) as superuser,
      (select rolbypassrls from pg_roles where rolname=current_user) as bypass,
      has_table_privilege(current_user,(select c.oid from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='auth_private' and c.relname='user_credentials'),'SELECT') as credentials,
      (select ssl from pg_stat_ssl where pid=pg_backend_pid()) as tls`;
    const row = rows[0];
    if (!row || row.username !== login || !row.correct_group || row.owner || row.superuser || row.bypass || row.credentials) throw new Error("RUNTIME_PRIVILEGES_OR_TLS_INVALID");
    checks.push(login + ": SSL client wajib, privilege minimum; TLS backend pooler=" + String(row.tls));
  }
  const businessRows = await getBusinessClient()`select id from app.app_users limit 1`;
  if (businessRows.length !== 0) throw new Error("ANONYMOUS_BUSINESS_RLS_FAILED");
  checks.push("RLS bisnis menolak akses tanpa bukti sesi");
  const missing = await (await getAuthService()).session(randomBytes(32).toString("base64url"));
  if (missing !== null) throw new Error("UNKNOWN_SESSION_ACCEPTED");
  checks.push("Adapter auth dan session_snapshot menolak token acak");
  const marker = new Error("PROBE_ROLLBACK");
  try {
    await getAuthClient().begin(async tx => {
      const key = randomBytes(32).toString("hex");
      const [row] = await tx<{ wait: number }[]>`select auth_private.consume_login_source(${key}) as wait`;
      if (row?.wait !== 0) throw new Error("RATE_PROBE_FAILED");
      throw marker;
    });
  } catch (error) { if (error !== marker) throw error; }
  checks.push("Transaksi rate limit berhasil lalu rollback");
  const passwords = await getPasswordService();
  const synthetic = "Synthetic9!" + randomBytes(24).toString("base64url");
  const hash = await passwords.hashNew(synthetic, { username: "probe.runtime", fullName: "Probe Runtime" });
  if (!(await passwords.verify(hash, synthetic)).valid) throw new Error("ARGON2_VERIFY_FAILED");
  checks.push("Argon2id native hash dan verify");
  console.log(JSON.stringify({ kind: "Vercel build environment database probe", ok: true, checks, createsAppUser: false }));
}
main().catch((error: unknown) => {
  const code = error instanceof Error && /^[A-Z_]{1,50}$/u.test(error.message) ? error.message : "RUNTIME_DATABASE_PROBE_FAILED";
  console.error(JSON.stringify({ ok: false, code }));
  process.exitCode = 1;
}).finally(() => closeDatabaseClients());
