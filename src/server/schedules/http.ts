import "server-only";
import { z } from "zod";
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
import { wibDate } from "../../lib/calendar/schemas";
import type { AccountLifecycleService } from "../accounts/lifecycle";
import type { ScheduleService } from "./service";
type Action =
  | "collection"
  | "detail"
  | "mine"
  | "today"
  | "recaps"
  | "conflicts"
  | "bulk-preview"
  | "bulk-commit"
  | "history";
export function createScheduleHandler(deps: {
  config: () => HttpAuthConfig;
  auth: () => Promise<LocalAuthService>;
  schedules: () => Promise<ScheduleService>;
  rate: () => Promise<AccountLifecycleService>;
}) {
  return (action: Action, request: Request, id?: string) =>
    handleAuthRequest(async (requestId) => {
      const config = deps.config(),
        token = requestCookie(request, cookieNames(config.production).session),
        read = request.method === "GET";
      const methods =
        action === "collection"
          ? ["GET", "POST"]
          : action === "detail"
            ? ["PATCH", "DELETE"]
            : ["mine", "today", "recaps", "history"].includes(action)
              ? ["GET"]
              : ["POST"];
      if (!methods.includes(request.method))
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
      if (!["mine", "today"].includes(action) && actor.role !== "admin")
        throw new AuthError("FORBIDDEN", 403);
      const schedules = await deps.schedules();
      if (id) z.uuid().parse(id);
      const query = Object.fromEntries(new URL(request.url).searchParams);
      let result: unknown;
      if (read) {
        if (action === "today") {
          const v = z
            .object({ date: z.iso.date().default(wibDate()) })
            .strict()
            .parse(query);
          result = await schedules.today(token, v.date);
        } else if (action === "recaps")
          result = await schedules.recaps(token, query);
        else if (action === "history")
          result = await schedules.history(token, id!);
        else result = await schedules.list(token, query, action === "mine");
      } else {
        await (
          await deps.rate()
        ).rate(sourceIp(request, config), "schedules:" + actor.user_id);
        const input = await boundedJson(request);
        if (action === "conflicts")
          result = await schedules.conflicts(token, input);
        else if (action === "bulk-preview")
          result = await schedules.bulkPreview(token, input);
        else if (action === "bulk-commit")
          result = await schedules.bulkCommit(token, input);
        else if (request.method === "DELETE")
          result = await schedules.stop(token, id!, input);
        else result = await schedules.save(token, id, input);
      }
      return authResponse(result, requestId);
    });
}
