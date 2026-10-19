import "server-only";
import { getAuthService, getBusinessDatabase } from "../auth/runtime";
import { getLifecycleService } from "../accounts/runtime";
import { requireEnvironment } from "../env";
import { CalendarService } from "./service";
import { createCalendarHandler } from "./http";
export const calendarHandler = createCalendarHandler({
  auth: getAuthService,
  rate: getLifecycleService,
  calendar: async () => new CalendarService(getBusinessDatabase()),
  config: () => ({
    appUrl: requireEnvironment("core").APP_URL,
    sessionSecret: requireEnvironment("auth").SESSION_SECRET,
    production: process.env.NODE_ENV === "production",
    vercel: process.env.VERCEL === "1",
  }),
});
