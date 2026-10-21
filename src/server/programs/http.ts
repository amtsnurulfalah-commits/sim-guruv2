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
import type { AccountLifecycleService } from "../accounts/lifecycle";
import type { ProgramService } from "./service";
export function createProgramHandler(deps: {
  config(): HttpAuthConfig;
  auth(): Promise<LocalAuthService>;
  service(): Promise<ProgramService>;
  rate(): Promise<AccountLifecycleService>;
}) {
  return (action: string, request: Request) =>
    handleModuleRequest("programs", async (requestId) => {
      const config = deps.config(),
        token = requestCookie(request, cookieNames(config.production).session),
        read = action === "read" && request.method === "GET";
      if (
        !read &&
        (![
          "preview",
          "commit",
          "exam-save",
          "exam-delete",
          "bap",
          "event-save",
          "event-delete",
          "attendance",
          "journal",
          "block",
        ].includes(action) ||
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
      ).activityRate(sourceIp(request, config), "programs:" + actor.user_id);
      const input = await boundedJson(request);
      const methods = {
        preview: service.preview,
        commit: service.commit,
        "exam-save": service.saveExam,
        "exam-delete": service.deleteExam,
        bap: service.bap,
        "event-save": service.saveEvent,
        "event-delete": service.deleteEvent,
        attendance: service.attendance,
        journal: service.journal,
        block: service.block,
      };
      const handler = methods[action as keyof typeof methods];
      if (!handler) throw new AuthError("FORBIDDEN", 405);
      const value = await handler.call(service, token, input);
      return authResponse(value, requestId);
    });
}
