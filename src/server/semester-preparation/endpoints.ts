import "server-only";
import { getAuthService, getBusinessDatabase } from "../auth/runtime";
import { getLifecycleService } from "../accounts/runtime";
import { requireEnvironment } from "../env";
import { SemesterPreparationService } from "./service";
import { createSemesterPreparationHandler } from "./http";
export const semesterPreparationHandler = createSemesterPreparationHandler({
  auth: getAuthService,
  rate: getLifecycleService,
  service: async () => new SemesterPreparationService(getBusinessDatabase()),
  config: () => ({
    appUrl: requireEnvironment("core").APP_URL,
    sessionSecret: requireEnvironment("auth").SESSION_SECRET,
    production: process.env.NODE_ENV === "production",
    vercel: process.env.VERCEL === "1",
  }),
});
