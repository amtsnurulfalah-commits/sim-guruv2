import "server-only";
import { authResponse, handleAuthRequest } from "../auth/http";
import { AuthError, type LocalAuthService } from "../auth/service";
import {
  assertOrigin,
  boundedJson,
  cookieNames,
  opaqueToken,
  rejectCrossSiteRead,
  requestCookie,
  sourceIp,
  verifyCsrf,
  type HttpAuthConfig,
} from "../auth/security";
import type { AccountLifecycleService } from "../accounts/lifecycle";
import type { ActivityService } from "./service";
export function createActivityHandler(deps: {
  config(): HttpAuthConfig;
  auth(): Promise<LocalAuthService>;
  service(): Promise<ActivityService>;
  rate(): Promise<AccountLifecycleService>;
}) {
  return (action: string, request: Request) =>
    handleAuthRequest(async (requestId) => {
      const config = deps.config(),
        token = requestCookie(request, cookieNames(config.production).session),
        read = request.method === "GET";
      if (!["GET", "POST"].includes(request.method))
        throw new AuthError("FORBIDDEN", 405);
      if (read) rejectCrossSiteRead(request, config);
      else {
        assertOrigin(request, config);
        verifyCsrf(
          request.headers.get("x-csrf-token"),
          config.sessionSecret,
          "session",
          token,
        );
      }
      if (!opaqueToken(token)) throw new AuthError("UNAUTHENTICATED", 401);
      const actor = await (await deps.auth()).requireSession(token, true),
        service = await deps.service();
      if (read)
        return authResponse(
          await service.read(
            token,
            action,
            Object.fromEntries(new URL(request.url).searchParams),
          ),
          requestId,
        );
      await (
        await deps.rate()
      ).activityRate(sourceIp(request, config), "activities:" + actor.user_id);
      return authResponse(
        await service.command(token, action, await boundedJson(request)),
        requestId,
      );
    });
}
