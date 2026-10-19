import { createDashboardHandler } from "@/server/dashboard/http";
import { getAuthService } from "@/server/auth/runtime";
import { requireEnvironment } from "@/server/env";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = createDashboardHandler({
  service: getAuthService,
  config: () => ({
    appUrl: requireEnvironment("core").APP_URL,
    sessionSecret: requireEnvironment("auth").SESSION_SECRET,
    production: process.env.NODE_ENV === "production",
    vercel: process.env.VERCEL === "1",
  }),
});
