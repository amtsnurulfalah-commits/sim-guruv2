import "server-only";
import { authResponse, handleModuleRequest } from "../auth/http";
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
import { kindSchema, mutationSchema } from "../../lib/masters/schemas";
import type { MasterService } from "./service";
import type { AccountLifecycleService } from "../accounts/lifecycle";
export function createMasterHandler(deps: {
  config: () => HttpAuthConfig;
  auth: () => Promise<LocalAuthService>;
  masters: () => Promise<MasterService>;
  rate: () => Promise<AccountLifecycleService>;
}) {
  return (request: Request, group: string, historyId?: string) =>
    handleModuleRequest("masters", async (requestId) => {
      const config = deps.config(),
        token = requestCookie(request, cookieNames(config.production).session),
        read = request.method === "GET";
      if (
        !(historyId ? ["GET"] : ["GET", "POST", "PATCH", "DELETE"]).includes(
          request.method,
        )
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
      const actor = await (await deps.auth()).requireSession(token, true);
      if (actor.role !== "admin") throw new AuthError("FORBIDDEN", 403);
      const kind = kindSchema.parse(group),
        masters = await deps.masters();
      if (read)
        return authResponse(
          historyId
            ? await masters.history(token, kind, historyId)
            : await masters.list(
                token,
                kind,
                Object.fromEntries(new URL(request.url).searchParams),
              ),
          requestId,
        );
      await (
        await deps.rate()
      ).rate(sourceIp(request, config), "masters:" + actor.user_id);
      const input = mutationSchema.parse(await boundedJson(request));
      if (
        (request.method === "POST" && input.id) ||
        (request.method !== "POST" && !input.id)
      )
        throw new AuthError("VALIDATION_ERROR", 422);
      return authResponse(
        await masters.save(token, kind, input, request.method === "DELETE"),
        requestId,
      );
    });
}
