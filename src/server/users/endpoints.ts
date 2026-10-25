import "server-only";
import { getAuthDatabase, getAuthService } from "../auth/runtime";
import { getPasswordService } from "../auth/passwords";
import { getLifecycleService } from "../accounts/runtime";
import { requireEnvironment } from "../env";
import { UserService } from "./service";
import { createUserHandler } from "./http";
import { securityOtpDelivery } from "../mail/runtime";
export const userHandler = createUserHandler({
  mail: securityOtpDelivery,
  auth: getAuthService,
  rate: getLifecycleService,
  users: async () =>
    new UserService(getAuthDatabase(), await getPasswordService(), {
      appUrl: requireEnvironment("core").APP_URL,
      encryptionKey: requireEnvironment("auth").AUTH_OUTBOX_ENCRYPTION_KEY,
      hmac: requireEnvironment("auth").AUTH_CHALLENGE_HMAC_SECRET,
    }),
  config: () => ({
    appUrl: requireEnvironment("core").APP_URL,
    sessionSecret: requireEnvironment("auth").SESSION_SECRET,
    production: process.env.NODE_ENV === "production",
    vercel: process.env.VERCEL === "1",
  }),
});
