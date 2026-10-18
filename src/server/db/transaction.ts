import "server-only";
import type postgres from "postgres";
import { z } from "zod";
import { getBusinessClient, getAuthClient } from "@/server/db/client";

const contextSchema = z.object({ actorId: z.uuid(), sessionId: z.uuid(), requestId: z.uuid(), sessionTokenHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export type BusinessTransactionContext = z.infer<typeof contextSchema>;
export type DatabaseTransaction = postgres.TransactionSql;

/** Hanya dipanggil server setelah sesi terverifikasi (implementasi auth pada 1.4).
 * Validasi bentuk UUID di sini bukan autentikasi. Tidak ada route publik yang menerima context ini.
 */
export async function withBusinessTransaction<T>(
  context: BusinessTransactionContext,
  work: (transaction: DatabaseTransaction) => Promise<T>,
) {
  const actor = contextSchema.parse(context);
  return getBusinessClient().begin(async (transaction) => {
    await transaction`select
      set_config('app.actor_id', ${actor.actorId}, true),
      set_config('app.session_id', ${actor.sessionId}, true),
      set_config('app.request_id', ${actor.requestId}, true),
      set_config('app.session_token_hash', ${actor.sessionTokenHash}, true)`;
    return work(transaction);
  });
}

/** Hanya untuk routine auth privat dengan GRANT terbatas yang dibuat pada 1.2. */
export async function withAuthTransaction<T>(work: (transaction: DatabaseTransaction) => Promise<T>) {
  return getAuthClient().begin((transaction) => work(transaction));
}

/** Context hanya dari sesi yang sudah diverifikasi. Routine privat memvalidasi ulang bukti sesi. */
export async function withAuthenticatedAuthTransaction<T>(
  context: BusinessTransactionContext,
  work: (transaction: DatabaseTransaction) => Promise<T>,
) {
  const actor = contextSchema.parse(context);
  return getAuthClient().begin(async (transaction) => {
    await transaction`select
      set_config('app.actor_id', ${actor.actorId}, true),
      set_config('app.session_id', ${actor.sessionId}, true),
      set_config('app.request_id', ${actor.requestId}, true),
      set_config('app.session_token_hash', ${actor.sessionTokenHash}, true)`;
    return work(transaction);
  });
}
