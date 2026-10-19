import "server-only";
import { postgresExecutor as executor } from "../../../scripts/lib/postgres-executor";
import type postgres from "postgres";
import type {
  SqlDatabase,
  SqlExecutor,
} from "../../../scripts/lib/sql-database";
import { getAuthClient, getBusinessClient } from "../db/client";
import { requireEnvironment } from "../env";
import { getPasswordService } from "./passwords";
import { LocalAuthService } from "./service";
export function databaseFromClient(client: postgres.Sql): SqlDatabase {
  const database: SqlDatabase = {
    ...executor(client),
    transaction: async <T>(work: (tx: SqlExecutor) => Promise<T>) => {
      const result = await client.begin(async (tx) => {
        await tx`set local statement_timeout='10s'`;
        await tx`set local lock_timeout='3s'`;
        return { value: await work(executor(tx)) };
      });
      return result.value;
    },
    close: async () => {},
  };
  return database;
}
export function getAuthDatabase() {
  return databaseFromClient(getAuthClient());
}
export function getBusinessDatabase() {
  return databaseFromClient(getBusinessClient());
}
export async function getAuthService() {
  return new LocalAuthService(
    getAuthDatabase(),
    await getPasswordService(),
    requireEnvironment("auth").AUTH_CHALLENGE_HMAC_SECRET,
  );
}
