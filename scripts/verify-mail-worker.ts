import { getWorkerClient, closeDatabaseClients } from "../src/server/db/client";
async function main() {
  if (process.env.NODE_ENV !== "production")
    throw new Error("PRODUCTION_ENV_REQUIRED");
  const sql = getWorkerClient();
  const [row] = await sql<
    {
      identity: string;
      worker: boolean;
      owner: boolean;
      credentials: boolean;
      targeted_claim: boolean;
    }[]
  >`
    select current_user as identity,
    pg_has_role(current_user,'sim_guru_worker','MEMBER') as worker,
    pg_has_role(current_user,'sim_guru_owner','MEMBER') as owner,
    has_table_privilege(current_user,'auth_private.user_credentials','SELECT') as credentials,
    has_function_privilege(current_user,'auth_private.claim_security_otp(uuid)','EXECUTE') as targeted_claim`;
  if (
    !row ||
    row.identity !== "sim_guru_worker_login" ||
    !row.worker ||
    row.owner ||
    row.credentials ||
    !row.targeted_claim
  )
    throw new Error("WORKER_PRIVILEGES_INVALID");
  console.log(
    JSON.stringify({
      kind: "security_mail_worker_probe",
      ok: true,
      ...row,
      tlsVerification: true,
      prepare: false,
      changesDomainData: false,
    }),
  );
}
main()
  .catch((error: unknown) => {
    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      /^[A-Z0-9_]{1,40}$/.test(String(error.code))
        ? String(error.code)
        : "WORKER_PROBE_FAILED";
    console.error(
      JSON.stringify({ kind: "security_mail_worker_probe", ok: false, code }),
    );
    process.exitCode = 1;
  })
  .finally(closeDatabaseClients);
