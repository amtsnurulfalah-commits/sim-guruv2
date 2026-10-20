import { type SqlDatabase } from "../lib/sql-database";
export async function restoreInventory(db: SqlDatabase) {
  return db.transaction(async (tx) => {
    await tx.exec("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await tx.exec("SET LOCAL ROLE sim_guru_owner");
    const tables = (
      await tx.query<{
        schema: string;
        name: string;
        rls: boolean;
        forced: boolean;
      }>(
        "select n.nspname schema,c.relname name,c.relrowsecurity rls,c.relforcerowsecurity forced from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('app','auth_private','ops','finance') and c.relkind='r' order by 1,2",
      )
    ).rows;
    const counts: Record<string, string> = {};
    for (const t of tables) {
      if (!/^[a-z_]+$/.test(t.schema) || !/^[a-z_]+$/.test(t.name))
        throw new Error("INVALID_DATABASE_IDENTIFIER");
      counts[t.schema + "." + t.name] = (
        await tx.query<{ n: string }>(
          `select count(*)::text n from "${t.schema}"."${t.name}"`,
        )
      ).rows[0]!.n;
    }
    const finance = (
      await tx.query<{ value: Record<string, string> }>(
        "select jsonb_build_object('ledgerCount',(select count(*)::text from finance.jtm_ledger),'jtm',(select coalesce(sum(jtm),0)::text from finance.jtm_ledger),'honorCount',(select count(*)::text from finance.honor_statements),'honorTotal',(select coalesce(sum(total_honor),0)::text from finance.honor_statements),'statementChecksums',finance.digest(coalesce((select string_agg(checksum,',' order by id) from finance.honor_statements),''))) value",
      )
    ).rows[0]!.value;
    const roles = (
      await tx.query<{ name: string; safe: boolean }>(
        "select rolname name,not(rolcanlogin or rolsuper or rolbypassrls or rolcreatedb or rolcreaterole or rolreplication) safe from pg_roles where rolname in('sim_guru_owner','sim_guru_business','sim_guru_auth','sim_guru_worker','sim_guru_bootstrap') order by rolname",
      )
    ).rows;
    return {
      counts,
      finance,
      roles,
      rls: tables.every((t) => t.rls && t.forced),
    };
  });
}
