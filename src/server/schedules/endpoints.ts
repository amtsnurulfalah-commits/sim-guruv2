import "server-only";
import { getAuthService, getBusinessDatabase } from "../auth/runtime";
import { getLifecycleService } from "../accounts/runtime";
import { requireEnvironment } from "../env";
import { ScheduleService } from "./service";
import { createScheduleHandler } from "./http";
export const scheduleHandler = createScheduleHandler({
  auth: getAuthService,
  rate: getLifecycleService,
  schedules: async () => new ScheduleService(getBusinessDatabase()),
  config: () => ({
    appUrl: requireEnvironment("core").APP_URL,
    sessionSecret: requireEnvironment("auth").SESSION_SECRET,
    production: process.env.NODE_ENV === "production",
    vercel: process.env.VERCEL === "1",
  }),
});
