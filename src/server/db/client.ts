import "server-only";
import postgres from "postgres";
import { requireEnvironment } from "@/server/env";

// Cache koneksi saja; tidak menyimpan actor, sesi atau hasil query antarpermintaan.
let businessClient: postgres.Sql | undefined;
let authClient: postgres.Sql | undefined;
function createClient(url: string, max: number, ca?: string) {
  return postgres(url, {
    max,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 10,
    max_lifetime: 60 * 5,
    ...(process.env.NODE_ENV === "production" ? { ssl: { rejectUnauthorized: true, ...(ca?.trim() ? { ca } : {}) } } : {}),
    onnotice: () => { /* Pesan mentah database tidak ditulis ke log aplikasi. */ },
  });
}

export function getBusinessClient(): postgres.Sql {
  const config = requireEnvironment("database");
  businessClient ??= createClient(config.DATABASE_URL, config.DB_POOL_MAX, config.DB_SSL_CA);
  return businessClient;
}

export function getAuthClient(): postgres.Sql {
  const config = requireEnvironment("database");
  authClient ??= createClient(config.AUTH_DATABASE_URL, config.DB_POOL_MAX, config.DB_SSL_CA);
  return authClient;
}

export async function closeDatabaseClients(): Promise<void> {
  await Promise.all([businessClient?.end({ timeout: 5 }), authClient?.end({ timeout: 5 })]);
  businessClient = undefined;
  authClient = undefined;
}
