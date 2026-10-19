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
import {
  approveRecoverySchema,
  listUsersSchema,
  statusSchema,
} from "../../lib/users/schemas";
import type { AccountLifecycleService } from "../accounts/lifecycle";
import type { UserService } from "./service";
type Action =
  "collection" | "detail" | "status" | "activation" | "recovery" | "requests";
export function createUserHandler(deps: {
  config: () => HttpAuthConfig;
  auth: () => Promise<LocalAuthService>;
  users: () => Promise<UserService>;
  rate: () => Promise<AccountLifecycleService>;
}) {
  return (action: Action, request: Request, id?: string) =>
    handleAuthRequest(async (requestId) => {
      const config = deps.config(),
        names = cookieNames(config.production),
        token = requestCookie(request, names.session),
        read = request.method === "GET";
      const allowed =
        action === "collection"
          ? ["GET", "POST"]
          : action === "detail"
            ? ["GET", "PATCH", "DELETE"]
            : action === "requests"
              ? ["GET", "POST"]
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
      if (actor.role !== "admin") throw new AuthError("FORBIDDEN", 403);
      if (id !== undefined) z.uuid().parse(id);
      const users = await deps.users();
      let input: unknown = {};
      if (!read) {
        await (
          await deps.rate()
        ).rate(sourceIp(request, config), "users-admin:" + actor.user_id);
        input = await boundedJson(request);
      }
      let result: unknown;
      if (action === "collection")
        result = read
          ? await users.list(
              token,
              listUsersSchema.parse(
                Object.fromEntries(new URL(request.url).searchParams),
              ),
            )
          : await users.create(token, input);
      else if (action === "detail") {
        if (read) result = await users.detail(token, id!);
        else if (request.method === "DELETE") {
          const v = statusSchema.parse(input);
          if (v.status !== "archived")
            throw new AuthError("VALIDATION_ERROR", 422);
          result = await users.status(token, id!, v);
        } else result = await users.edit(token, id!, input);
      } else if (action === "status")
        result = await users.status(token, id!, input);
      else if (action === "activation")
        result = await users.reissue(token, id!, input);
      else if (action === "recovery")
        result = await users.recover(token, id!, input);
      else if (read) result = await users.requests(token);
      else {
        const actionType = z
          .object({ action: z.enum(["approve", "reject"]) })
          .loose()
          .parse(input);
        if (actionType.action === "reject")
          result = await users.reject(token, input);
        else {
          const v = approveRecoverySchema.parse(input);
          const { action: _, targetId, ...proof } = v;
          void _;
          result = await users.recover(token, targetId, proof);
        }
      }
      const response = authResponse(result, requestId);
      if (
        typeof result === "object" &&
        result !== null &&
        "selfAffected" in result &&
        result.selfAffected
      )
        response.cookies.set(names.session, "", {
          httpOnly: true,
          secure: config.production,
          sameSite: "lax",
          path: "/",
          maxAge: 0,
        });
      return response;
    });
}
