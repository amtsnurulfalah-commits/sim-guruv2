import "server-only";
import { z } from "zod";
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
import type { CalendarService } from "./service";
type Action =
  | "calendar"
  | "calendar-preview"
  | "range"
  | "context"
  | "context-preview"
  | "context-commit"
  | "history"
  | "self-context";
export function createCalendarHandler(deps: {
  config: () => HttpAuthConfig;
  auth: () => Promise<LocalAuthService>;
  calendar: () => Promise<CalendarService>;
  rate: () => Promise<AccountLifecycleService>;
}) {
  return (action: Action, request: Request) =>
    handleModuleRequest("calendar", async (requestId) => {
      const config = deps.config(),
        token = requestCookie(request, cookieNames(config.production).session),
        read = request.method === "GET";
      const allowed =
        action === "calendar"
          ? ["GET", "POST", "PATCH", "DELETE"]
          : ["context", "history", "self-context"].includes(action)
            ? ["GET"]
            : ["POST"];
      if (!allowed.includes(request.method))
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
      if (action !== "self-context" && actor.role !== "admin")
        throw new AuthError("FORBIDDEN", 403);
      const calendar = await deps.calendar(),
        query = Object.fromEntries(new URL(request.url).searchParams);
      let result: unknown;
      if (read) {
        if (action === "calendar") result = await calendar.list(token, query);
        else if (action === "history") {
          const v = z
            .object({
              kind: z.enum(["calendar", "day-context"]),
              date: z.iso.date(),
            })
            .strict()
            .parse(query);
          result = await calendar.history(token, v.kind, v.date);
        } else result = await calendar.context(token, query);
      } else {
        await (
          await deps.rate()
        ).rate(sourceIp(request, config), "calendar:" + actor.user_id);
        const input = await boundedJson(request);
        if (action === "calendar-preview" || action === "context-preview")
          result = await calendar.preview(
            token,
            action === "calendar-preview" ? "calendar" : "context",
            input,
          );
        else
          result = await calendar.commit(
            token,
            action === "context-commit" ? "context" : "calendar",
            input,
            action === "context-commit"
              ? "context"
              : action === "range"
                ? "range"
                : request.method === "DELETE"
                  ? "delete"
                  : "upsert",
          );
      }
      return authResponse(result, requestId);
    });
}
