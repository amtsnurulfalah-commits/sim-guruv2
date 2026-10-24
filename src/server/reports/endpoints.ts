import "server-only";
import { getAuthService, getBusinessDatabase } from "../auth/runtime";
import { getLifecycleService } from "../accounts/runtime";
import { requireEnvironment } from "../env";
import { ReportsService } from "./service";
import { createReportsHandler } from "./http";
export const reportsHandler = createReportsHandler({
  auth: getAuthService,
  rate: getLifecycleService,
  service: async () => new ReportsService(getBusinessDatabase()),
  config: () => ({
    appUrl: requireEnvironment("core").APP_URL,
    sessionSecret: requireEnvironment("auth").SESSION_SECRET,
    production: process.env.NODE_ENV === "production",
    vercel: process.env.VERCEL === "1",
  }),
});
