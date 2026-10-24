import { createHash } from "node:crypto";
import { type SqlDatabase } from "../lib/sql-database";
export async function restoreInventory(db: SqlDatabase) {
  return db.transaction(async (tx) => {
    await tx.exec("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await tx.exec("SET LOCAL TimeZone='UTC'; SET LOCAL DateStyle='ISO,YMD'; SET LOCAL extra_float_digits=3");
    const migrations = (await tx.query("select name,checksum from sim_guru_migration.schema_migrations order by name")).rows;
    const metadata = (await tx.query<{ value: unknown }>(`SELECT jsonb_build_object(
      'schemas',(SELECT jsonb_agg(jsonb_build_array(nspname,pg_get_userbyid(nspowner),ARRAY(SELECT a::text FROM unnest(coalesce(nspacl,acldefault('n',nspowner))) a ORDER BY 1)) ORDER BY nspname) FROM pg_namespace WHERE nspname IN('app','auth_private','ops','finance','sim_guru_migration')),
      'relations',(SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname,c.relkind,pg_get_userbyid(c.relowner),ARRAY(SELECT a::text FROM unnest(coalesce(c.relacl,acldefault(CASE WHEN c.relkind='S' THEN 'S'::"char" ELSE 'r'::"char" END,c.relowner))) a ORDER BY 1),c.relrowsecurity,c.relforcerowsecurity) ORDER BY n.nspname,c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('app','auth_private','ops','finance','sim_guru_migration') AND c.relkind IN('r','v','S')),
      'routines',(SELECT jsonb_agg(jsonb_build_array(n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),pg_get_userbyid(p.proowner),ARRAY(SELECT a::text FROM unnest(coalesce(p.proacl,acldefault('f',p.proowner))) a ORDER BY 1),pg_get_functiondef(p.oid)) ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('app','auth_private','ops','finance') AND p.prokind IN('f','p')),
      'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY schemaname,tablename,policyname) FROM pg_policies p WHERE schemaname IN('app','auth_private','ops','finance')),
      'indexes',(SELECT jsonb_agg(to_jsonb(i) ORDER BY schemaname,tablename,indexname) FROM pg_indexes i WHERE schemaname IN('app','auth_private','ops','finance','sim_guru_migration')),
      'columns',(SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid)) ORDER BY n.nspname,c.relname,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname IN('app','auth_private','ops','finance','sim_guru_migration') AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped),
      'constraints',(SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname,k.conname,pg_get_constraintdef(k.oid)) ORDER BY n.nspname,c.relname,k.conname) FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('app','auth_private','ops','finance','sim_guru_migration')),
      'triggers',(SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid)) ORDER BY n.nspname,c.relname,t.tgname) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('app','auth_private','ops','finance') AND NOT t.tgisinternal),
      'defaults',(SELECT jsonb_agg(jsonb_build_array(pg_get_userbyid(d.defaclrole),coalesce(n.nspname,''),d.defaclobjtype,ARRAY(SELECT a::text FROM unnest(d.defaclacl) a ORDER BY 1)) ORDER BY pg_get_userbyid(d.defaclrole),n.nspname,d.defaclobjtype) FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace WHERE d.defaclrole='sim_guru_owner'::regrole)
    ) value`)).rows[0]!.value;
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
    const counts: Record<string, string> = {}, content: Record<string, string> = {};
    for (const t of tables) {
      if (!/^[a-z_]+$/.test(t.schema) || !/^[a-z_]+$/.test(t.name))
        throw new Error("INVALID_DATABASE_IDENTIFIER");
      counts[t.schema + "." + t.name] = (
        await tx.query<{ n: string }>(
          `select count(*)::text n from "${t.schema}"."${t.name}"`,
        )
      ).rows[0]!.n;
    }
    for (const table of tables) {
      const value = (await tx.query<{ digest: string }>(`SELECT encode(sha256(convert_to(coalesce(string_agg(h,'' ORDER BY h COLLATE "C"),''),'UTF8')),'hex') digest FROM (SELECT encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') h FROM "${table.schema}"."${table.name}" t) rows`)).rows[0]!.digest;
      content[table.schema + "." + table.name] = value;
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
      format: 2,
      counts,
      content,
      migrations,
      schemaDigest: createHash("sha256").update(JSON.stringify(metadata)).digest("hex"),
      finance,
      roles,
      rls: tables.every((t) => t.rls && t.forced),
    };
  });
}
