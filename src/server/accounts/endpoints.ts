import "server-only";
import { securityOtpDelivery } from "../mail/runtime";
import { createLifecycleHandler } from "./http";
import { getLifecycleService } from "./runtime";
import { requireEnvironment } from "../env";
export const lifecycleHandler = createLifecycleHandler({
  service: getLifecycleService,
  mail: securityOtpDelivery,
  config: () => ({
    appUrl: requireEnvironment("core").APP_URL,
    sessionSecret: requireEnvironment("auth").SESSION_SECRET,
    production: process.env.NODE_ENV === "production",
    vercel: process.env.VERCEL === "1",
  }),
});
