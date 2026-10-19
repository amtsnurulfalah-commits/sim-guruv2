import "server-only";
import type postgres from "postgres";
import type { SqlDatabase, SqlExecutor, SqlParameter } from "../../../scripts/lib/sql-database";
import { getAuthClient } from "../db/client";
import { requireEnvironment } from "../env";
import { getPasswordService } from "./passwords";
import { LocalAuthService } from "./service";
function executor(sql: postgres.Sql | postgres.TransactionSql): SqlExecutor {
    return {
        async exec(statement) { await sql.unsafe(statement).simple(); },
        async query<T extends Record<string, unknown>>(statement: string, parameters: readonly SqlParameter[] = []) { const rows = await sql.unsafe<T[]>(statement, [...parameters]); return { rows: [...rows] }; }
    };
}
export async function getAuthService() {
    const config = requireEnvironment("auth"), client = getAuthClient();
    const database: SqlDatabase = { ...executor(client), transaction: async <T>(work: (tx: SqlExecutor) => Promise<T>) => {
            const result = await client.begin(async (tx) => { await tx `set local statement_timeout='10s'`; await tx `set local lock_timeout='3s'`; return { value: await work(executor(tx)) }; });
            return result.value;
        }, close: async () => { } };
    return new LocalAuthService(database, await getPasswordService(), config.AUTH_CHALLENGE_HMAC_SECRET);
}
