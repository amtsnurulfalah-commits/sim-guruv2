import { createDashboardHandler } from "@/server/dashboard/http";
import { getAuthService } from "@/server/auth/runtime";
import { getBusinessDatabase } from "@/server/auth/runtime";
import { CalendarService } from "@/server/calendar/service";
import { requireEnvironment } from "@/server/env";
import { tokenHash } from "@/server/auth/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = createDashboardHandler({
  service: getAuthService,
  summary: async (token) =>
    getBusinessDatabase().transaction(
      async (tx) =>
        (
          await tx.query<{ value: unknown }>(
            "select app.dashboard_summary($1) as value",
            [tokenHash(token)],
          )
        ).rows[0]!.value,
    ),
  calendar: async () => new CalendarService(getBusinessDatabase()),
  config: () => ({
    appUrl: requireEnvironment("core").APP_URL,
    sessionSecret: requireEnvironment("auth").SESSION_SECRET,
    production: process.env.NODE_ENV === "production",
    vercel: process.env.VERCEL === "1",
  }),
});
