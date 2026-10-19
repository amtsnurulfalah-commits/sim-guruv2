import "server-only";
import { getAuthService, getBusinessDatabase } from "../auth/runtime";
import { getLifecycleService } from "../accounts/runtime";
import { requireEnvironment } from "../env";
import { ActivityService } from "./service";
import { createActivityHandler } from "./http";
export const activityHandler = createActivityHandler({
  auth: getAuthService,
  rate: getLifecycleService,
  service: async () => new ActivityService(getBusinessDatabase()),
  config: () => ({
    appUrl: requireEnvironment("core").APP_URL,
    sessionSecret: requireEnvironment("auth").SESSION_SECRET,
    production: process.env.NODE_ENV === "production",
    vercel: process.env.VERCEL === "1",
  }),
});
