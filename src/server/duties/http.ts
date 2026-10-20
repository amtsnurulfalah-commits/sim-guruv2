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
import type { DutyService } from "./service";
export function createDutyHandler(deps: {
  config(): HttpAuthConfig;
  auth(): Promise<LocalAuthService>;
  service(): Promise<DutyService>;
  rate(): Promise<AccountLifecycleService>;
}) {
  return (action: string, request: Request) =>
    handleAuthRequest(async (requestId) => {
      const config = deps.config(),
        token = requestCookie(request, cookieNames(config.production).session),
        read = action === "board" && request.method === "GET";
      if (
        !read &&
        (!["preview", "commit", "schedule"].includes(action) ||
          request.method !== "POST")
      )
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
            Object.fromEntries(new URL(request.url).searchParams),
          ),
          requestId,
        );
      await (
        await deps.rate()
      ).activityRate(sourceIp(request, config), "duties:" + actor.user_id);
      const input = await boundedJson(request),
        value =
          action === "preview"
            ? await service.preview(token, input)
            : action === "commit"
              ? await service.commit(token, input)
              : await service.schedule(token, input);
      return authResponse(value, requestId);
    });
}
