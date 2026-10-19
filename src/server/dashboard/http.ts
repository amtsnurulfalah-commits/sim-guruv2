import "server-only";
import { authResponse, handleAuthRequest } from "../auth/http";
import { AuthError, type LocalAuthService } from "../auth/service";
import {
  cookieNames,
  opaqueToken,
  rejectCrossSiteRead,
  requestCookie,
  type HttpAuthConfig,
} from "../auth/security";
import { dashboardDto } from "./query";
export function createDashboardHandler(deps: {
  config: () => HttpAuthConfig;
  service: () => Promise<LocalAuthService>;
}) {
  return (request: Request) =>
    handleAuthRequest(async (requestId) => {
      const config = deps.config();
      rejectCrossSiteRead(request, config);
      const token = requestCookie(
        request,
        cookieNames(config.production).session,
      );
      if (!opaqueToken(token)) throw new AuthError("UNAUTHENTICATED", 401);
      const session = await (await deps.service()).requireSession(token, true);
      return authResponse(dashboardDto(session), requestId);
    });
}
