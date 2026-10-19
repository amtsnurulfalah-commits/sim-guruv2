import "server-only";
import { getAuthDatabase } from "../auth/runtime";
import { getPasswordService } from "../auth/passwords";
import { requireEnvironment } from "../env";
import { AccountLifecycleService } from "./lifecycle";
export async function getLifecycleService() {
  const auth = requireEnvironment("auth");
  return new AccountLifecycleService(
    getAuthDatabase(),
    await getPasswordService(),
    {
      hmac: auth.AUTH_CHALLENGE_HMAC_SECRET,
      encryptionKey: auth.AUTH_OUTBOX_ENCRYPTION_KEY,
      appUrl: requireEnvironment("core").APP_URL,
    },
  );
}
