import "server-only";
import { authResponse, handleModuleRequest } from "../auth/http";
import { AuthError, type LocalAuthService } from "../auth/service";
import {
  cookieNames,
  opaqueToken,
  rejectCrossSiteRead,
  requestCookie,
  type HttpAuthConfig,
} from "../auth/security";
import type { CalendarService } from "../calendar/service";
import { wibDate } from "../../lib/calendar/schemas";
import { dashboardDto } from "./query";
export function createDashboardHandler(deps: {
  config: () => HttpAuthConfig;
  summary?: (token: string) => Promise<unknown>;
  calendar?: () => Promise<CalendarService>;
  service: () => Promise<LocalAuthService>;
}) {
  return (request: Request) =>
    handleModuleRequest("dashboard", async (requestId) => {
      const config = deps.config();
      rejectCrossSiteRead(request, config);
      const token = requestCookie(
        request,
        cookieNames(config.production).session,
      );
      if (!opaqueToken(token)) throw new AuthError("UNAUTHENTICATED", 401);
      const session = await (await deps.service()).requireSession(token, true);
      const [dayContext, summary] = await Promise.all([
        deps.calendar ? deps.calendar().then(calendar => calendar.context(token, { date: wibDate() })) : undefined,
        deps.summary ? deps.summary(token) : undefined,
      ]);
      return authResponse(
        {
          ...dashboardDto(session),
          ...(dayContext ? { dayContext } : {}),
          ...(deps.summary
            ? {
                summary,
                activitySummaryAvailable: true,
                financeSummaryAvailable: true,
              }
            : {}),
        },
        requestId,
      );
    });
}
